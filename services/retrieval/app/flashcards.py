"""
Rule-based flashcard generation: cloze deletion and true/false. Both are
well-established, non-generative NLP techniques (POS/NER tagging, then
templated transformation) — no language model involved. Deterministic by
design (no randomness) so results are reproducible and testable.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache

import spacy

from .config import SPACY_MODEL_NAME

# Entity labels worth testing a learner on, roughly in order of how
# "quiz-able" a fact of that type tends to be.
BLANKABLE_LABELS = (
    "DATE",
    "CARDINAL",
    "QUANTITY",
    "PERCENT",
    "ORDINAL",
    "PERSON",
    "ORG",
    "GPE",
    "LOC",
    "EVENT",
    "LAW",
    "NORP",
    "WORK_OF_ART",
    "TIME",
    "MONEY",
)

MIN_SENTENCE_CHARS = 30
MAX_SENTENCE_CHARS = 260


@lru_cache(maxsize=1)
def _nlp():
    return spacy.load(SPACY_MODEL_NAME)


@dataclass
class ClozeCard:
    kind: str
    prompt: str
    answer: str
    source: dict


@dataclass
class TrueFalseCard:
    kind: str
    statement: str
    is_true: bool
    source: dict


# Curriculum documents often carry standards-code boilerplate (bullet lists
# of codes like "AIT.6" or "DC.5", "Embedded ... Standards" headers) that is
# short, entity-dense, and easily mistaken by length/NER heuristics for good
# quiz material. It reads as a citation index, not teachable content, so it's
# excluded before scoring rather than left for the heuristics to rank.
_BOILERPLATE_PATTERN = re.compile(
    r"●|standards\s*:?$|\b[A-Z]{2,5}\d?\.\d+\b", re.IGNORECASE
)


def _is_boilerplate(raw: str) -> bool:
    return bool(_BOILERPLATE_PATTERN.search(raw))


def _candidate_sentences(text: str):
    doc = _nlp()(text)
    for sent in doc.sents:
        raw = sent.text.strip()
        if MIN_SENTENCE_CHARS <= len(raw) <= MAX_SENTENCE_CHARS and not _is_boilerplate(raw):
            yield sent


def _best_blank(sent) -> tuple[str, int, int] | None:
    """Picks one span to blank: the first entity with a quiz-worthy label, else the longest noun chunk."""
    for label in BLANKABLE_LABELS:
        for ent in sent.ents:
            if ent.label_ == label:
                return ent.text, ent.start_char - sent.start_char, ent.end_char - sent.start_char

    noun_chunks = sorted(sent.noun_chunks, key=lambda nc: len(nc.text), reverse=True)
    for nc in noun_chunks:
        if len(nc.text.strip()) >= 4:
            return nc.text, nc.start_char - sent.start_char, nc.end_char - sent.start_char

    return None


def generate_cloze_cards(chunks: list[dict], count: int) -> list[ClozeCard]:
    """chunks: [{content, metadata}, ...] in priority order. Returns up to `count` cloze cards."""
    cards: list[ClozeCard] = []
    seen_answers: set[str] = set()

    for chunk in chunks:
        if len(cards) >= count:
            break
        for sent in _candidate_sentences(chunk["content"]):
            if len(cards) >= count:
                break
            blank = _best_blank(sent)
            if not blank:
                continue
            answer, start, end = blank
            answer_key = answer.lower().strip()
            if answer_key in seen_answers:
                continue
            raw = sent.text
            prompt = raw[:start] + "_____" + raw[end:]
            seen_answers.add(answer_key)
            cards.append(ClozeCard(kind="cloze", prompt=prompt.strip(), answer=answer.strip(), source=chunk.get("metadata", {})))

    return cards


def _entity_pool(chunks: list[dict]) -> dict[str, list[str]]:
    pool: dict[str, list[str]] = {}
    for chunk in chunks:
        for sent in _candidate_sentences(chunk["content"]):
            for ent in sent.ents:
                if ent.label_ in BLANKABLE_LABELS:
                    pool.setdefault(ent.label_, [])
                    if ent.text not in pool[ent.label_]:
                        pool[ent.label_].append(ent.text)
    return pool


def generate_true_false_cards(chunks: list[dict], count: int) -> list[TrueFalseCard]:
    """
    Alternates true/false deterministically. A "false" card swaps one entity
    for a different same-label entity found elsewhere in the material — a
    standard distractor strategy for factual true/false items, per the
    literature on rule-based cloze/T-F generation (entity swap rather than
    syntactic negation, which is grammatically fragile without a model).
    """
    pool = _entity_pool(chunks)
    cards: list[TrueFalseCard] = []
    seen: set[str] = set()

    for chunk in chunks:
        if len(cards) >= count:
            break
        for sent in _candidate_sentences(chunk["content"]):
            if len(cards) >= count:
                break
            raw = sent.text.strip()
            key = raw.lower()
            if key in seen:
                continue

            want_false = len(cards) % 2 == 1
            if not want_false:
                seen.add(key)
                cards.append(TrueFalseCard(kind="true_false", statement=raw, is_true=True, source=chunk.get("metadata", {})))
                continue

            swapped = _swap_one_entity(sent, pool)
            if swapped is None:
                continue
            seen.add(key)
            cards.append(TrueFalseCard(kind="true_false", statement=swapped, is_true=False, source=chunk.get("metadata", {})))

    return cards


def _swap_one_entity(sent, pool: dict[str, list[str]]) -> str | None:
    for label in BLANKABLE_LABELS:
        for ent in sent.ents:
            if ent.label_ != label:
                continue
            candidates = [c for c in pool.get(label, []) if c.lower() != ent.text.lower()]
            if not candidates:
                continue
            # Deterministic choice: the lexicographically first differing candidate.
            replacement = sorted(candidates)[0]
            raw = sent.text
            start = ent.start_char - sent.start_char
            end = ent.end_char - sent.start_char
            return raw[:start] + replacement + raw[end:]
    return None


def strip_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()
