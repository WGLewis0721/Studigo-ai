"""
Page-aware chunking via LangChain's RecursiveCharacterTextSplitter. Each
chunk keeps exactly one citable page number, matching the citation model
Studigo's TypeScript ingestion pipeline uses.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from langchain_text_splitters import RecursiveCharacterTextSplitter

from .config import CHUNK_OVERLAP_CHARS, MIN_CHUNK_CHARS, TARGET_CHUNK_CHARS


@dataclass
class Page:
    page_number: int
    text: str


@dataclass
class Chunk:
    chunk_index: int
    page_number: int
    content: str
    metadata: dict = field(default_factory=dict)


def _splitter() -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=TARGET_CHUNK_CHARS,
        chunk_overlap=CHUNK_OVERLAP_CHARS,
        separators=["\n\n", "\n", ". ", " ", ""],
    )


def chunk_pages(pages: list[Page], *, document_name: str) -> list[Chunk]:
    """Chunks page-by-page so every chunk keeps exactly one page number."""
    splitter = _splitter()
    chunks: list[Chunk] = []
    index = 0

    for page in pages:
        text = page.text.strip()
        if len(text.replace(" ", "").replace("\n", "")) < MIN_CHUNK_CHARS:
            continue

        for piece in splitter.split_text(text):
            piece = piece.strip()
            if len(piece.replace(" ", "").replace("\n", "")) < MIN_CHUNK_CHARS:
                continue
            chunks.append(
                Chunk(
                    chunk_index=index,
                    page_number=page.page_number,
                    content=piece,
                    metadata={"documentName": document_name, "pageNumber": page.page_number},
                )
            )
            index += 1

    return chunks
