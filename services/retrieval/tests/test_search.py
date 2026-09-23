from app.chunking import Page, chunk_pages
from app import index_store

from conftest import SCIENCE_PAGES


def _index_room(room_id: str):
    pages = [Page(page_number=n, text=t) for n, t in SCIENCE_PAGES]
    chunks = chunk_pages(pages, document_name="science.pdf")
    index_store.build_or_extend_index(room_id, "doc-1", chunks)


def test_search_ranks_the_semantically_relevant_chunk_first(data_dir):
    _index_room("room-a")

    hits = index_store.search("room-a", "why does water freeze and boil", top_k=3)

    assert hits, "expected at least one hit"
    assert "boil" in hits[0]["content"].lower() or "freeze" in hits[0]["content"].lower()


def test_search_distinguishes_unrelated_topics(data_dir):
    _index_room("room-b")

    solar_hits = index_store.search("room-b", "which planet is closest to the sun", top_k=1)
    behavior_hits = index_store.search("room-b", "is a spider building a web instinct or learned", top_k=1)

    assert "mercury" in solar_hits[0]["content"].lower() or "sun" in solar_hits[0]["content"].lower()
    assert "spider" in behavior_hits[0]["content"].lower() or "instinct" in behavior_hits[0]["content"].lower()
    # The two queries should not collapse onto the exact same chunk.
    assert solar_hits[0]["content"] != behavior_hits[0]["content"]


def test_similarity_scores_are_bounded(data_dir):
    _index_room("room-c")
    hits = index_store.search("room-c", "phase changes of matter", top_k=5)
    for hit in hits:
        assert 0.0 <= hit["similarity"] <= 1.0


def test_search_on_nonexistent_room_returns_empty(data_dir):
    assert index_store.search("no-such-room", "anything", top_k=3) == []
    assert index_store.index_exists("no-such-room") is False


def test_extending_an_existing_index_adds_rather_than_replaces(data_dir):
    room_id = "room-extend"
    pages_a = [Page(page_number=1, text=SCIENCE_PAGES[0][1])]
    pages_b = [Page(page_number=4, text=SCIENCE_PAGES[1][1])]

    added_a = index_store.build_or_extend_index(room_id, "doc-1", chunk_pages(pages_a, document_name="a.pdf"))
    added_b = index_store.build_or_extend_index(room_id, "doc-2", chunk_pages(pages_b, document_name="b.pdf"))

    assert added_a > 0
    assert added_b > 0
    manifest = index_store.load_chunks(room_id, limit=100)
    assert len(manifest) == added_a + added_b
