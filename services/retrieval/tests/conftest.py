from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest

from app.config import DATA_DIR_ENV


@pytest.fixture()
def data_dir(monkeypatch):
    tmp = Path(tempfile.mkdtemp(prefix="retrieval-test-"))
    monkeypatch.setenv(DATA_DIR_ENV, str(tmp))
    yield tmp
    shutil.rmtree(tmp, ignore_errors=True)


# Real study-guide text (the same 2022-2023 Fifth Grade Science content used
# elsewhere in this session), so tests exercise genuine semantic behavior
# rather than toy sentences.
SCIENCE_PAGES = [
    (
        1,
        "Big Ideas: Animal responses can be compared and contrasted as either "
        "inherited or learned. I can explain that an animal's instinctual "
        "response is not learned over time but instead comes naturally to the "
        "animal. I can explain that an animal's learned response is gathered "
        "through its senses, processed, and stored as memories that guide its "
        "actions. I can classify whether an animal's behavior is instinctive "
        "or learned. A spider building a web is an example of instinctive "
        "behavior. A dog sitting on command is an example of learned behavior.",
    ),
    (
        4,
        "Matter can undergo phase changes between a solid, liquid, or gas. I "
        "can explain that matter has physical properties which include phase "
        "changes. For example, at sea level, water will boil to a gas when "
        "its temperature reaches 100 degrees Celsius and freeze to a solid "
        "when its temperature reaches 0 degrees Celsius. I can explain that "
        "the amount of matter is conserved even when it changes form, "
        "including transitions where matter seems to vanish.",
    ),
    (
        6,
        "Earth has a specific place in the Universe. I can explain that the "
        "sun appears much larger and brighter than other stars because the "
        "sun is much closer to Earth than any other star. I can research and "
        "explain the position of the Earth and the solar system within the "
        "Milky Way galaxy. Jupiter is the largest planet in our solar "
        "system, and Mercury is the closest planet to the Sun.",
    ),
]
