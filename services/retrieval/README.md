# Studigo Retrieval Service

A standalone Python service for **document search and flashcard generation
with zero LLM dependency and zero API cost**. It answers a specific
question: how far can you get on industry-standard, pre-generative-AI
machine learning and NLP — the groundwork LLMs are built on — before you
actually need a language model?

It sits *alongside* Studigo's Next.js app (`apps/web`), not inside it. It
owns:

- **Semantic document search** — LangChain's `RecursiveCharacterTextSplitter`
  for page-aware chunking, `sentence-transformers/all-MiniLM-L6-v2` (a local,
  384-dimension embedding model) via LangChain's `HuggingFaceEmbeddings`, and
  a FAISS vector index per Study Room. This is the same retrieval
  architecture OpenAI-embeddings RAG uses — cosine similarity over vectors —
  just with a smaller, free, open-weights model instead of a paid API.
- **Rule-based flashcards** — cloze (fill-in-the-blank) and true/false
  questions generated via spaCy POS/NER tagging and templated transformation,
  not text generation. A cloze card blanks out a real named entity or noun
  phrase from a real sentence; a false true/false statement swaps one entity
  for a different same-category entity found elsewhere in the material. Both
  are established techniques in the NLP literature, not something invented
  for this project.

## What this deliberately does NOT do

- **Coach conversation** — explaining, adapting to a wrong answer, follow-up
  questions. No rule-based system gets close to this; it needs a language
  model. That stays in `packages/ai`.
- **Multiple-choice with good distractors** — generating a *wrong* answer
  that's plausible rather than obviously wrong is the literally-cited hard
  problem in the cloze/MCQ-generation literature. Doable with hand-built
  per-subject templates; doesn't generalize the way a model does.
- **Writing into Studigo's Supabase `document_chunks` table.** This
  service's embeddings are 384-dimension; that table's `embedding` column is
  a pgvector(1536) column sized for OpenAI's `text-embedding-3-small`. The
  two are not interchangeable — this service owns its own FAISS index,
  separate from that column, rather than writing mismatched vectors into it.

## Architecture

```
PDF/DOCX text (already extracted by packages/documents, or passed in directly)
        │
        ▼
  chunking.py          RecursiveCharacterTextSplitter, page-aware
        │
        ▼
  embeddings.py         sentence-transformers/all-MiniLM-L6-v2 (local, CPU)
        │
        ▼
  index_store.py        FAISS index per room, persisted to disk
        │
        ├──► /search      cosine-similarity retrieval, citable chunks
        │
        └──► flashcards.py   spaCy POS/NER → cloze + true/false cards
```

## Running it

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app.main:app --port 8000
```

`RETRIEVAL_DATA_DIR` (default `./data`) controls where FAISS indexes and
chunk manifests are persisted per room.

### Endpoints

- `POST /index` — `{room_id, document_id, document_name, pages: [{page_number, text}]}` → chunks, embeds, and indexes the material.
- `POST /search` — `{room_id, query, top_k}` → ranked chunks with similarity scores and page citations.
- `POST /flashcards` — `{room_id, query?, cloze_count, true_false_count, pool_size}` → generated cards.
- `DELETE /index/{room_id}` — removes a room's index.
- `GET /health`

## Tests

```bash
python -m pytest tests/ -q
```

20 tests, exercising real content (the same Fifth Grade Science study guide
used elsewhere in this project) rather than toy sentences — semantic search
is checked for actually distinguishing unrelated topics, not just "returns
something," and flashcards are checked against the real source text rather
than just structural shape.
