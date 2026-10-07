# @studigo/documents

File policy, extraction, and chunking for uploads. No network and no model SDK.

Public exports are `packages/documents/src/index.ts`. Input is bytes plus a MIME type. Output is pages and chunks with page or slide numbers.

Invariants:

- Bytes must match the declared type before parsing.
- ZIP archives are bounded by entry count, declared size, and expansion ratio.
- A PDF that also contains a web page in its header is rejected.

Test: `pnpm --filter @studigo/documents test`

Does not belong here: embeddings, retrieval, learner state, storage credentials.
