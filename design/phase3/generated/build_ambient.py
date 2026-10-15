"""Build restrained, deterministic UI-ready variants from the Higgsfield plate.

Requires Pillow. The generated PNG stays untouched as the editable source.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "ambient-snow-teal-source.png"
EXPORTS = ROOT / "exports"
EXPORTS.mkdir(exist_ok=True)

snow = (247, 248, 251)
source = Image.open(SOURCE).convert("RGB")
canvas = Image.new("RGB", source.size, snow)

# The model rendered a dramatic dark corner. Reduce it to an accent that cannot
# visually overpower the brand's Snow canvas or any foreground component.
desktop = Image.blend(canvas, source, 0.17)
desktop.save(EXPORTS / "ambient-snow-teal-wide.webp", "WEBP", quality=82, method=6)

# A tall crop of the right-side light field can sit behind compact home content.
# Keep the effect at the far edge; content and reading panels must have opaque
# backgrounds. This is a decorative image, never a text or control surface.
phone_source = source.crop((source.width - 600, 0, source.width, source.height))
phone_canvas = Image.new("RGB", phone_source.size, snow)
phone = Image.blend(phone_canvas, phone_source, 0.12)
phone.save(EXPORTS / "ambient-snow-teal-compact.webp", "WEBP", quality=82, method=6)
