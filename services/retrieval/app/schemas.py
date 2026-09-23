from __future__ import annotations

from pydantic import BaseModel, Field


class PageIn(BaseModel):
    page_number: int
    text: str


class IndexRequest(BaseModel):
    room_id: str
    document_id: str
    document_name: str
    pages: list[PageIn]


class IndexResponse(BaseModel):
    chunks_indexed: int


class SearchRequest(BaseModel):
    room_id: str
    query: str
    top_k: int = Field(default=6, ge=1, le=20)


class SearchHit(BaseModel):
    content: str
    similarity: float
    metadata: dict


class SearchResponse(BaseModel):
    hits: list[SearchHit]


class FlashcardRequest(BaseModel):
    room_id: str
    query: str = ""
    cloze_count: int = Field(default=5, ge=0, le=20)
    true_false_count: int = Field(default=5, ge=0, le=20)
    # How many source chunks to draw cards from; defaults to a generous pool
    # covering the whole room when query is empty.
    pool_size: int = Field(default=20, ge=1, le=100)


class ClozeCardOut(BaseModel):
    kind: str
    prompt: str
    answer: str
    source: dict


class TrueFalseCardOut(BaseModel):
    kind: str
    statement: str
    is_true: bool
    source: dict


class FlashcardResponse(BaseModel):
    cloze: list[ClozeCardOut]
    true_false: list[TrueFalseCardOut]
