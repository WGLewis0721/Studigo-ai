from app.chunking import Page, chunk_pages
from app.config import TARGET_CHUNK_CHARS

from conftest import SCIENCE_PAGES


def test_chunk_pages_keeps_one_page_number_per_chunk():
    pages = [Page(page_number=n, text=t) for n, t in SCIENCE_PAGES]
    chunks = chunk_pages(pages, document_name="science.pdf")

    assert len(chunks) >= len(pages)
    page_numbers_present = {c.page_number for c in chunks}
    assert page_numbers_present == {1, 4, 6}


def test_chunk_pages_respects_target_size_with_slack_for_overlap():
    long_text = "Photosynthesis converts light energy into chemical energy. " * 60
    chunks = chunk_pages([Page(page_number=1, text=long_text)], document_name="bio.pdf")

    assert len(chunks) > 1
    for chunk in chunks:
        # Overlap can push a chunk a bit past the target; it must never be wildly over.
        assert len(chunk.content) <= TARGET_CHUNK_CHARS + 200


def test_chunk_pages_drops_near_empty_pages():
    pages = [Page(page_number=1, text="  \n "), Page(page_number=2, text=SCIENCE_PAGES[0][1])]
    chunks = chunk_pages(pages, document_name="science.pdf")

    assert all(c.page_number != 1 for c in chunks)


def test_chunk_metadata_carries_document_name():
    chunks = chunk_pages([Page(page_number=1, text=SCIENCE_PAGES[0][1])], document_name="fifth-grade-science.pdf")
    assert all(c.metadata["documentName"] == "fifth-grade-science.pdf" for c in chunks)
