import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from bkt import evaluate

parser = argparse.ArgumentParser(description='Offline synthetic BKT harness; no child data ingestion')
parser.add_argument('--input', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if args.input:
    data = json.loads(args.input.read_text(encoding='utf-8'))
else:
    records = []
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for learner in range(40):
        for attempt in range(20):
            at = start + timedelta(days=attempt)
            records.append({'id': f'synthetic-{learner}-{attempt}', 'learnerId': f'synthetic-{learner}', 'conceptId': 'recall', 'encounterId': f'encounter-{attempt}',
                            'at': at.isoformat(), 'band': '3-5' if learner % 2 else '6-8', 'subject': ('math', 'science', 'reading')[learner % 3],
                            'correct': (learner + attempt) % 5 != 0, 'evidence': 'assessed', 'scaffold': 0, 'canonicalProbability': .7,
                            'canonicalAt': (at - timedelta(seconds=1)).isoformat()})
    data = {'synthetic': True, 'cutoff': '2026-01-11T00:00:00+00:00', 'records': records}
if data.get('synthetic') is not True or any(not r['learnerId'].startswith('synthetic-') for r in data['records']):
    raise ValueError('This CLI accepts synthetic fixtures only. Real child data needs a separately authorized privacy-controlled workflow.')
result = evaluate(data['records'], data['cutoff'])
result.update({'synthetic': True, 'releaseEvidence': False})
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({'synthetic': True, 'trainAttempts': result['trainAttempts'], 'testAttempts': result['testAttempts'], 'advisoryOnly': True}))
