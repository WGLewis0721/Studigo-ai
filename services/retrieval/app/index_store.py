"""
Per-room FAISS vector index, built with LangChain's FAISS vectorstore
wrapper over local sentence-transformers embeddings. Persisted to disk so
a room's index survives a process restart without re-embedding.
"""
from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

from .chunking import Chunk
from .config import DATA_DIR_ENV, DEFAULT_DATA_DIR
from .embeddings import get_embedder


def _data_dir() -> Path:
    return Path(os.environ.get(DATA_DIR_ENV, DEFAULT_DATA_DIR))


def _room_path(room_id: str) -> Path:
    return _data_dir() / "indexes" / room_id


def index_exists(room_id: str) -> bool:
    return (_room_path(room_id) / "index.faiss").exists()


def build_or_extend_index(room_id: str, document_id: str, chunks: list[Chunk]) -> int:
    """Embeds chunks and adds them to the room's index, creating it if absent. Returns the count added."""
    if not chunks:
        return 0

    documents = [
        Document(
            page_content=chunk.content,
            metadata={
                **chunk.metadata,
                "documentId": document_id,
                "chunkIndex": chunk.chunk_index,
                "pageNumber": chunk.page_number,
            },
        )
        for chunk in chunks
    ]

    embedder = get_embedder()
    path = _room_path(room_id)

    if index_exists(room_id):
        store = FAISS.load_local(str(path), embedder, allow_dangerous_deserialization=True)
        store.add_documents(documents)
    else:
        store = FAISS.from_documents(documents, embedder)

    path.mkdir(parents=True, exist_ok=True)
    store.save_local(str(path))

    # A flat, append-only manifest of every chunk in the room, independent of
    # FAISS's internal representation — flashcard generation reads directly
    # from this rather than trying to enumerate FAISS's index contents.
    manifest_path = path / "chunks.jsonl"
    with manifest_path.open("a", encoding="utf-8") as fh:
        for doc in documents:
            fh.write(json.dumps({"content": doc.page_content, "metadata": doc.metadata}) + "\n")

    return len(documents)


def load_chunks(room_id: str, limit: int = 100) -> list[dict]:
    """Reads the room's flat chunk manifest, most recently indexed first."""
    manifest_path = _room_path(room_id) / "chunks.jsonl"
    if not manifest_path.exists():
        return []
    lines = manifest_path.read_text(encoding="utf-8").splitlines()
    records = [json.loads(line) for line in lines if line.strip()]
    return list(reversed(records))[:limit]


def search(room_id: str, query: str, top_k: int = 6) -> list[dict]:
    """Returns the top_k most similar chunks with a similarity score in [0, 1] (higher is closer)."""
    if not index_exists(room_id):
        return []

    embedder = get_embedder()
    store = FAISS.load_local(str(_room_path(room_id)), embedder, allow_dangerous_deserialization=True)

    # FAISS's default index here is L2 distance over normalized vectors:
    # for unit vectors, L2^2 = 2 - 2*cosine_similarity, so this converts
    # back to a similarity score, matching the pgvector cosine-similarity
    # convention Studigo's TypeScript retrieval already uses.
    results = store.similarity_search_with_score(query, k=top_k)
    hits = []
    for doc, l2_distance in results:
        similarity = max(0.0, 1.0 - (l2_distance / 2.0))
        hits.append(
            {
                "content": doc.page_content,
                "similarity": round(similarity, 4),
                "metadata": doc.metadata,
            }
        )
    return hits


def delete_room_index(room_id: str) -> None:
    path = _room_path(room_id)
    if path.exists():
        shutil.rmtree(path)
