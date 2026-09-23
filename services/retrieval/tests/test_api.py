from fastapi.testclient import TestClient

from app.main import app

from conftest import SCIENCE_PAGES

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_full_index_search_flashcard_flow(data_dir):
    room_id = "api-room-1"

    index_resp = client.post(
        "/index",
        json={
            "room_id": room_id,
            "document_id": "doc-1",
            "document_name": "science.pdf",
            "pages": [{"page_number": n, "text": t} for n, t in SCIENCE_PAGES],
        },
    )
    assert index_resp.status_code == 200
    assert index_resp.json()["chunks_indexed"] > 0

    search_resp = client.post(
        "/search",
        json={"room_id": room_id, "query": "why does water freeze and boil", "top_k": 3},
    )
    assert search_resp.status_code == 200
    hits = search_resp.json()["hits"]
    assert len(hits) > 0
    assert all(0.0 <= h["similarity"] <= 1.0 for h in hits)

    flashcard_resp = client.post(
        "/flashcards",
        json={"room_id": room_id, "cloze_count": 3, "true_false_count": 3, "pool_size": 20},
    )
    assert flashcard_resp.status_code == 200
    body = flashcard_resp.json()
    assert len(body["cloze"]) > 0
    assert len(body["true_false"]) > 0
    for card in body["cloze"]:
        assert "_____" in card["prompt"]


def test_search_without_index_returns_404(data_dir):
    resp = client.post("/search", json={"room_id": "never-indexed", "query": "anything"})
    assert resp.status_code == 404


def test_flashcards_without_index_returns_404(data_dir):
    resp = client.post("/flashcards", json={"room_id": "never-indexed"})
    assert resp.status_code == 404


def test_delete_index_removes_it(data_dir):
    room_id = "api-room-delete"
    client.post(
        "/index",
        json={
            "room_id": room_id,
            "document_id": "doc-1",
            "document_name": "science.pdf",
            "pages": [{"page_number": 1, "text": SCIENCE_PAGES[0][1]}],
        },
    )
    from app import index_store

    assert index_store.index_exists(room_id) is True
    resp = client.delete(f"/index/{room_id}")
    assert resp.status_code == 200
    assert index_store.index_exists(room_id) is False
