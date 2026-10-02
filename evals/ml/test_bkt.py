import copy
from datetime import datetime, timedelta, timezone
import unittest
from bkt import Parameters, predict, update, metrics, validate, evaluate, fold, predictions


def record(learner, attempt, correct=True):
    at = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=attempt)
    return {'id': f'{learner}:{attempt}', 'learnerId': learner, 'conceptId': 'c', 'encounterId': str(attempt), 'at': at.isoformat(), 'band': '3-5', 'subject': 'math', 'correct': correct,
            'evidence': 'assessed', 'scaffold': 0, 'canonicalProbability': .5, 'canonicalAt': (at - timedelta(seconds=1)).isoformat()}


class BktTests(unittest.TestCase):
    def test_bayes_update(self):
        p = Parameters()
        self.assertAlmostEqual(predict(.2, p), .34)
        self.assertAlmostEqual(update(.2, True, p), (.18 / .34) * .9 + .1)
        self.assertLess(update(.2, False, p), .2)

    def test_filters_help_self_report_duplicates(self):
        rows = [record('synthetic-1', i) for i in range(4)]
        rows[1]['scaffold'] = 2
        rows[2]['evidence'] = 'self_reported'
        rows[3]['evidence'] = 'legacy'
        self.assertEqual(len(validate([*rows, rows[0]])), 1)
        bad = copy.deepcopy(rows[0]); bad['correct'] = False
        with self.assertRaises(ValueError): validate([rows[0], bad])

    def test_metrics_and_temporal_validation(self):
        self.assertEqual(metrics([(.5, True), (.5, False)])['brier'], .25)
        self.assertEqual(metrics([])['brier'], None)
        row = record('synthetic-1', 0); row['canonicalAt'] = row['at']
        with self.assertRaises(ValueError): validate([row])

    def test_no_learner_or_future_outcome_leakage(self):
        rows = [record(f'synthetic-{i}', day, day % 3 != 0) for i in range(40) for day in range(12)]
        first = evaluate(rows, '2026-01-07T00:00:00Z')
        self.assertFalse(set(first['trainLearners']) & set(first['testLearners']))
        modified = copy.deepcopy(rows)
        for row in modified:
            if fold(row['learnerId']) == 'test' or datetime.fromisoformat(row['at']).day >= 7: row['correct'] = not row['correct']
        second = evaluate(modified, '2026-01-07T00:00:00Z')
        self.assertEqual(first['parameters'], second['parameters'])
        self.assertGreater(first['testAttempts'], 0)
        self.assertTrue(first['advisoryOnly'])
        self.assertFalse(first['policyWrites'])

    def test_rejects_personal_fields_and_nonfinite_probabilities(self):
        row = record('synthetic-1', 0); row['learnerName'] = 'private'
        with self.assertRaises(ValueError): validate([row])
        del row['learnerName']; row['canonicalProbability'] = float('nan')
        with self.assertRaises(ValueError): validate([row])

    def test_encounter_assistance_cannot_be_erased_by_later_zero_support(self):
        help_row, answer = record('synthetic-1', 0), record('synthetic-1', 1)
        help_row['scaffold'] = 2; answer['encounterId'] = help_row['encounterId']
        self.assertEqual(validate([answer, help_row]), [])
        answer['at'] = help_row['at']; answer['canonicalAt'] = help_row['canonicalAt']
        self.assertEqual(validate([answer, help_row]), [])
        help_row['scaffold'] = None
        self.assertEqual(validate([answer, help_row]), [])

    def test_later_feedback_does_not_remove_a_preceding_independent_target(self):
        attempt, feedback = record('synthetic-1', 0, False), record('synthetic-1', 1)
        feedback['encounterId'] = attempt['encounterId']; feedback['scaffold'] = 5
        self.assertEqual(validate([feedback, attempt]), [attempt])
        row = record('synthetic-1', 0); row['scaffold'] = False
        with self.assertRaises(ValueError): validate([row])

    def test_equal_time_outcomes_cannot_inform_each_others_predictions(self):
        first, second = record('synthetic-1', 0), record('synthetic-1', 1, False)
        second['at'] = first['at']; second['canonicalAt'] = first['canonicalAt']
        result = predictions([first, second], Parameters())
        self.assertEqual(result[0]['bkt'], result[1]['bkt'])
        self.assertEqual(result[0]['recent'], result[1]['recent'])


if __name__ == '__main__': unittest.main()
