# Orientation eval

Scored against `AGENTS.md` and `ENGINEERING.md` only, after the lookup facts were added to `ENGINEERING.md`. This is not a second model session with a fresh context window. It is a check that those two files contain the answers.

| # | Question | Answer in the two files | File |
| --- | --- | --- | --- |
| 1 | Where is the citation check? | `packages/ai/src/grounding.ts` | ENGINEERING.md lookup facts |
| 2 | What is the retrieval cutoff? | `0.35` | ENGINEERING.md lookup facts |
| 3 | What stops a user reading another user's chunks? | RLS plus `match_study_chunks` owner and room filters | ENGINEERING.md lookup facts |
| 4 | Who owns progression? | `packages/learning` | ENGINEERING.md technology catalog |
| 5 | Why is Python retrieval not production? | Unauthenticated FAISS prototype. ADR 001 | ENGINEERING.md technology catalog |
| 6 | What does `grounded` mean? | A citation marker is present. Not semantic support | ENGINEERING.md principles and lookup facts |
| 7 | Where are uploads parsed? | `packages/documents/` and `apps/web/lib/ingest.ts` | ENGINEERING.md repository map |
| 8 | What is the public-launch decision? | The security-readiness gate is not ready | ENGINEERING.md lookup facts |
| 9 | Where does mastery math live? | `packages/mastery`, advisory | ENGINEERING.md technology catalog |
| 10 | What must a retry not do? | Create a second learning event or a second ingest | AGENTS.md and ENGINEERING.md principle 4 |

Score: 10/10 after the lookup section. Before that section, questions 2 and 10 were not answerable from `ENGINEERING.md` alone.

Token note: `wc -w` on `AGENTS.md` and `ENGINEERING.md` was 418 + 1974 = 2392 words, about 3,100 tokens at 1.3 tokens per word. Do not add `docs/CODEMAP.md`. The ten answers fit in `ENGINEERING.md`.
