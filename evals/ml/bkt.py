"""Offline advisory predictions only. No database, provider, or policy writer."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from itertools import product, groupby
import math


@dataclass(frozen=True)
class Parameters:
    prior: float = .2
    learn: float = .1
    guess: float = .2
    slip: float = .1

    def __post_init__(self):
        if any(not 0 < value < 1 for value in (self.prior, self.learn, self.guess, self.slip)):
            raise ValueError('BKT parameters must lie strictly between zero and one')


def predict(known: float, params: Parameters) -> float:
    return known * (1 - params.slip) + (1 - known) * params.guess


def update(known: float, correct: bool, params: Parameters) -> float:
    likelihood = predict(known, params)
    posterior = known * (1 - params.slip) / likelihood if correct else known * params.slip / (1 - likelihood)
    return posterior + (1 - posterior) * params.learn


def instant(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Explicit timezone required')
    return parsed


FIELDS = {'id', 'learnerId', 'conceptId', 'encounterId', 'at', 'band', 'subject', 'correct', 'evidence', 'scaffold', 'canonicalProbability', 'canonicalAt'}


def validate(records: list[dict]) -> list[dict]:
    seen = {}
    encounters, assistance = set(), set()
    unique = []
    for record in records:
        if set(record) != FIELDS:
            raise ValueError('Unexpected or missing fields; do not include learner text or personal information')
        if any(not isinstance(record[key], str) or not record[key].strip() for key in ('id', 'learnerId', 'conceptId', 'encounterId', 'subject')):
            raise ValueError('Invalid pseudonymous identifier')
        if record['band'] not in ('3-5', '6-8') or not isinstance(record['correct'], bool):
            raise ValueError('Invalid grade band or outcome')
        if record['evidence'] not in ('assessed', 'legacy', 'self_reported') or (record['scaffold'] is not None and (type(record['scaffold']) is not int or record['scaffold'] not in range(6))):
            raise ValueError('Invalid evidence')
        if not isinstance(record['canonicalProbability'], (int, float)) or isinstance(record['canonicalProbability'], bool) or not math.isfinite(record['canonicalProbability']) or not 0 <= record['canonicalProbability'] <= 1:
            raise ValueError('Invalid pre-outcome canonical probability')
        if instant(record['canonicalAt']) >= instant(record['at']):
            raise ValueError('Canonical comparator must precede the assessed outcome')
        if record['id'] in seen:
            if record != seen[record['id']]:
                raise ValueError('Conflicting retry')
            continue
        seen[record['id']] = record
        unique.append(record)
    # Assistance must remain visible while choosing a target. Filtering it first
    # could turn a coached re-answer into an independent assessed observation.
    # Equal-time unknown/help precedes independent claims, as in canonical replay.
    ordered = sorted(unique, key=lambda r: (instant(r['at']), r['scaffold'] == 0, r['id']))
    result = []
    for record in ordered:
        key = (record['learnerId'], record['conceptId'], record['encounterId'])
        if record['scaffold'] != 0:
            assistance.add(key)
        if record['evidence'] != 'assessed' or record['scaffold'] != 0 or key in assistance:
            continue
        # One independent target per issued encounter; re-answering cannot farm observations.
        if key not in encounters:
            encounters.add(key)
            result.append(record)
    return result


def fold(learner_id: str) -> str:
    return 'test' if int(sha256(learner_id.encode()).hexdigest()[:8], 16) % 5 == 0 else 'train'


def metrics(pairs: list[tuple[float, bool]]) -> dict:
    if not pairs:
        return {'n': 0, 'brier': None, 'logLoss': None, 'ece': None, 'calibration': []}
    bins = []
    for index in range(10):
        bucket = [(p, y) for p, y in pairs if min(9, int(p * 10)) == index]
        if bucket:
            bins.append({'bin': index, 'n': len(bucket), 'predicted': sum(p for p, _ in bucket) / len(bucket), 'observed': sum(y for _, y in bucket) / len(bucket)})
    return {'n': len(pairs), 'brier': sum((p - y) ** 2 for p, y in pairs) / len(pairs),
            'logLoss': -sum(math.log(max(1e-12, min(1 - 1e-12, p if y else 1 - p))) for p, y in pairs) / len(pairs),
            'ece': sum(b['n'] * abs(b['predicted'] - b['observed']) for b in bins) / len(pairs), 'calibration': bins}


def predictions(records: list[dict], params: Parameters) -> list[dict]:
    knowledge, recent = {}, {}
    result = []
    for _, group in groupby(sorted(records, key=lambda r: (instant(r['at']), r['id'])), key=lambda r: instant(r['at'])):
        batch = list(group)
        for r in batch:
            key = (r['learnerId'], r['conceptId'])
            known = knowledge.get(key, params.prior)
            history = recent.get(key, [])[-5:]
            result.append({**r, 'bkt': predict(known, params), 'recent': (sum(history) + 1) / (len(history) + 2), 'canonical': r['canonicalProbability']})
        # Equal-time outcomes are unavailable to each other's predictions.
        for r in batch:
            key = (r['learnerId'], r['conceptId'])
            knowledge[key] = update(knowledge.get(key, params.prior), r['correct'], params)
            recent[key] = [*recent.get(key, [])[-4:], r['correct']]
    return result


def evaluate(records: list[dict], cutoff: str) -> dict:
    ordered, boundary = validate(records), instant(cutoff)
    train = [r for r in ordered if fold(r['learnerId']) == 'train' and instant(r['at']) < boundary]
    if not train:
        raise ValueError('No pre-cutoff training learners')
    candidates = [Parameters(*p) for p in product((.1, .3), (.05, .15), (.1, .25), (.05, .15))]
    params = min(candidates, key=lambda p: metrics([(r['bkt'], r['correct']) for r in predictions(train, p)])['logLoss'])
    held = [r for r in ordered if fold(r['learnerId']) == 'test']
    targets = [r for r in predictions(held, params) if instant(r['at']) >= boundary]
    summary = {model: metrics([(r[model], r['correct']) for r in targets]) for model in ('bkt', 'recent', 'canonical')}
    subgroups = {}
    for dimension in ('band', 'subject'):
        subgroups[dimension] = {value: {model: metrics([(r[model], r['correct']) for r in targets if r[dimension] == value]) for model in summary} for value in sorted({r[dimension] for r in targets})}
    return {'schemaVersion': 1, 'advisoryOnly': True, 'policyWrites': False, 'cutoff': cutoff, 'parameters': params.__dict__,
            'trainLearners': sorted({r['learnerId'] for r in train}), 'testLearners': sorted({r['learnerId'] for r in held}),
            'trainAttempts': len(train), 'testAttempts': len(targets), 'metrics': summary, 'subgroups': subgroups}
