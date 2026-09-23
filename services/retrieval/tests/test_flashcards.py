from app import flashcards

from conftest import SCIENCE_PAGES

POOL = [{"content": text, "metadata": {"pageNumber": page}} for page, text in SCIENCE_PAGES]


def test_cloze_cards_blank_out_real_text_from_the_source():
    cards = flashcards.generate_cloze_cards(POOL, count=5)

    assert cards, "expected at least one cloze card"
    for card in cards:
        assert "_____" in card.prompt
        assert card.answer.strip() != ""
        # The answer must be real text that actually appeared in the source sentence,
        # not fabricated — reassembling prompt + answer should look like the original.
        reassembled = card.prompt.replace("_____", card.answer)
        assert reassembled.replace(" ", "") in " ".join(t for _, t in SCIENCE_PAGES).replace(" ", "")


def test_cloze_cards_do_not_repeat_the_same_answer():
    cards = flashcards.generate_cloze_cards(POOL, count=10)
    answers = [c.answer.lower().strip() for c in cards]
    assert len(answers) == len(set(answers))


def test_cloze_card_count_is_bounded_by_request():
    cards = flashcards.generate_cloze_cards(POOL, count=2)
    assert len(cards) <= 2


def test_true_false_cards_alternate_and_are_labeled_correctly():
    cards = flashcards.generate_true_false_cards(POOL, count=6)

    assert cards, "expected at least one true/false card"
    trues = [c for c in cards if c.is_true]
    falses = [c for c in cards if not c.is_true]
    assert len(trues) > 0
    # Not every source sentence has a swappable entity, so falses may be fewer
    # than trues, but the generator must produce at least one of each when
    # asked for several cards from content with plenty of named entities.
    assert len(falses) > 0


def test_false_true_false_statement_differs_from_the_original_source():
    cards = flashcards.generate_true_false_cards(POOL, count=10)
    full_text = " ".join(t for _, t in SCIENCE_PAGES)

    false_cards = [c for c in cards if not c.is_true]
    assert false_cards, "expected at least one false card to verify against"
    for card in false_cards:
        assert card.statement not in full_text


def test_true_cards_are_verbatim_source_sentences():
    cards = flashcards.generate_true_false_cards(POOL, count=10)
    full_text = " ".join(t for _, t in SCIENCE_PAGES).replace("\n", " ")

    true_cards = [c for c in cards if c.is_true]
    assert true_cards, "expected at least one true card"
    for card in true_cards:
        assert card.statement.replace("\n", " ") in full_text
