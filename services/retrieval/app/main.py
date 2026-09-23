"""
FastAPI service: local, zero-cost document search and flashcard generation.
No LLM, no API key, no network call once dependencies are installed and the
embedding model is cached. Meant to sit alongside (not replace) Studigo's
Next.js app: it owns retrieval and rule-based flashcards; the Coach's
free-form conversation still lives in packages/ai and still needs a model.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException

from . import flashcards, index_store
from .chunking import Page, chunk_pages
from .schemas import (
    ClozeCardOut,
    FlashcardRequest,
    FlashcardResponse,
    IndexRequest,
    IndexResponse,
    SearchRequest,
    SearchResponse,
    TrueFalseCardOut,
)

app = FastAPI(title="Studigo Retrieval Service", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/index", response_model=IndexResponse)
def index_document(req: IndexRequest):
    pages = [Page(page_number=p.page_number, text=p.text) for p in req.pages]
    chunks = chunk_pages(pages, document_name=req.document_name)
    added = index_store.build_or_extend_index(req.room_id, req.document_id, chunks)
    return IndexResponse(chunks_indexed=added)


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    if not index_store.index_exists(req.room_id):
        raise HTTPException(status_code=404, detail="No index for this room yet. POST /index first.")
    hits = index_store.search(req.room_id, req.query, top_k=req.top_k)
    return SearchResponse(hits=hits)


@app.post("/flashcards", response_model=FlashcardResponse)
def generate_flashcards(req: FlashcardRequest):
    if req.query.strip() and index_store.index_exists(req.room_id):
        pool = index_store.search(req.room_id, req.query, top_k=req.pool_size)
    else:
        pool = index_store.load_chunks(req.room_id, limit=req.pool_size)

    if not pool:
        raise HTTPException(status_code=404, detail="No material indexed for this room yet.")

    cloze = flashcards.generate_cloze_cards(pool, req.cloze_count)
    true_false = flashcards.generate_true_false_cards(pool, req.true_false_count)

    return FlashcardResponse(
        cloze=[ClozeCardOut(**c.__dict__) for c in cloze],
        true_false=[TrueFalseCardOut(**c.__dict__) for c in true_false],
    )


@app.delete("/index/{room_id}")
def delete_index(room_id: str):
    index_store.delete_room_index(room_id)
    return {"deleted": room_id}
