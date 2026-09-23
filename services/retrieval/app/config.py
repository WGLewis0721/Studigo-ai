"""
Shared constants. Chunk sizing mirrors packages/documents/src/chunk.ts
(TARGET_CHUNK_CHARS / CHUNK_OVERLAP_CHARS) so both the TypeScript app and
this Python retrieval service produce comparably-sized, citable chunks —
neither is a "toy" version of the other.
"""

TARGET_CHUNK_CHARS = 1400
CHUNK_OVERLAP_CHARS = 180
MIN_CHUNK_CHARS = 25

# sentence-transformers/all-MiniLM-L6-v2: 384-dim, ~90MB, CPU-friendly.
# Deliberately NOT OpenAI's text-embedding-3-small (1536-dim) — this is the
# local, zero-cost embedding path. Its vectors are NOT interchangeable with
# the pgvector column Studigo's TypeScript app uses; this service owns its
# own FAISS index rather than writing into that column.
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSIONS = 384

SPACY_MODEL_NAME = "en_core_web_sm"

DATA_DIR_ENV = "RETRIEVAL_DATA_DIR"
DEFAULT_DATA_DIR = "./data"
