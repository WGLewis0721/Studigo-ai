# ADR: retain TypeScript provisionally while measuring framework alternatives

Status: provisional, architecture selection gate open.

The existing TypeScript provider/RAG path uses canonical Supabase chunks and caller-scoped RLS. The Python prototype uses different local embeddings, FAISS, and unauthenticated room-ID endpoints. Comparing their present outputs would confound framework, embedding, chunking and authorization differences.

Retain the working TypeScript path while preparing a matched benchmark. No new production Python/LangChain service is introduced. `evals/rag` supplies 120 authored synthetic candidates, separate review records, comparison-setting checks, source/revision/tool isolation checks and explicit selection gates. Candidate/unit-test results do not establish production quality, physical scan accuracy or measured provider cost. All cases remain pending independent review and live adapter measurements.

Require zero unauthorized retrieval, at least 95% claim-level citation support, at least 95% correct unsupported-answer abstention, and no regression over two percentage points. Python needs at least five points of quality improvement or 20% lower latency/cost, plus an operational/deletion/maintainability review. Equivalent results retain TypeScript. Reviewed JSON output artifacts and reproducible workload details must accompany a future accepted decision.

The next backend work can proceed without selecting a new provider framework: durable session contracts, explicit director inputs, atomic evidence and RLS remain TypeScript responsibilities. Do not present this provisional retention decision as the measured Phase 1 exit.
