"""Cut a face (or body) layer for Studigo's Rive rig from an on-model edit of the approved art.

The edit must be a Higgsfield (or similar) edit of full/center.webp upscaled to 1024 px on white, prompted
"keep pixel-identical, change ONLY X". This script checks that it registers with the source (0 px on the body,
within 1 px on the head), keeps only the named regions (feathered ellipses, in 540 artboard units), clips them
to Studigo's silhouette and away from the white background, and writes a cropped webp plus its centre.

  python -I scripts/living-companion/cut-face-layer.py <edit.png> <name> <cx,cy,rx,ry> [<cx,cy,rx,ry> ...]

Output: design/living-companion/rive/studigo/parts/<name>.webp, and one JSON line on stdout:
  {"name": ..., "cx": ..., "cy": ..., "offset": [dx, dy], "error": ...}
Common regions: eyes 224,182,30,36 and 316,182,30,36; mouth 270,240,66,26; open mouth 270,248,62,36.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "apps/web/public/mascot/companion/full/center.webp"
OUT = ROOT / "design/living-companion/rive/studigo/parts"
S = 1024 / 540


def source_1024():
    src = Image.open(SOURCE).convert("RGBA")
    flat = Image.new("RGB", src.size, (255, 255, 255))
    flat.paste(src, mask=src.getchannel("A"))
    return src, flat.resize((1024, 1024), Image.LANCZOS)


def offset(edit, base, box):
    y0, y1, x0, x1 = box
    v = np.asarray(edit.convert("L"), dtype=float)
    ref = np.asarray(base.convert("L"), dtype=float)[y0:y1, x0:x1]
    best = None
    for dy in range(-10, 11):
        for dx in range(-10, 11):
            e = float(np.mean(np.abs(v[y0 + dy:y1 + dy, x0 + dx:x1 + dx] - ref)))
            if best is None or e < best[0]:
                best = (e, dx, dy)
    return best


def main():
    path, name, *regions = sys.argv[1:]
    regions = [tuple(float(n) for n in r.split(",")) for r in regions]
    src, base = source_1024()
    edit = Image.open(path).convert("RGBA").resize((1024, 1024), Image.LANCZOS)
    body = offset(edit, base, (560, 1000, 150, 900))
    head = offset(edit, base, (140, 330, 230, 380))
    if abs(body[1]) + abs(body[2]) > 0 or abs(head[1]) > 1 or abs(head[2]) > 1:
        print(json.dumps({"name": name, "rejected": True, "body": body, "head": head}))
        sys.exit(2)
    m = Image.new("L", (1024, 1024), 0)
    d = ImageDraw.Draw(m)
    for cx, cy, rx, ry in regions:
        d.ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(5 * S))
    sil = src.getchannel("A").resize((1024, 1024), Image.LANCZOS).filter(ImageFilter.MinFilter(5))
    rgb = np.asarray(edit.convert("RGB"), dtype=int)
    not_white = Image.fromarray(((rgb.min(axis=2) < 235) * 255).astype("uint8")).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.5))
    edit.putalpha(ImageChops.multiply(ImageChops.multiply(m, sil), not_white))
    small = edit.resize((540, 540), Image.LANCZOS)
    bb = small.getchannel("A").point(lambda p: 255 if p > 3 else 0).getbbox()
    OUT.mkdir(parents=True, exist_ok=True)
    small.crop(bb).save(OUT / f"{name}.webp", "WEBP", quality=92, method=6)
    print(json.dumps({"name": name, "cx": (bb[0] + bb[2]) / 2, "cy": (bb[1] + bb[3]) / 2, "offset": [head[1], head[2]], "error": round(head[0], 2)}))


if __name__ == "__main__":
    main()
