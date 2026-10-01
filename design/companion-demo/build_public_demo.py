"""Build apps/web/public/demo from this folder.

The homepage embeds the phone demo in an iframe. The shipped copy is embed-only
(the phone, no side panel), is not indexed, and uses WebP for the waist-up
sprites. Run this after changing the demo, from anywhere:

    python design/companion-demo/build_public_demo.py

Needs Pillow.
"""
import re
import shutil
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parent
OUT = SRC.parents[1] / "apps" / "web" / "public" / "demo"

if OUT.exists():
    shutil.rmtree(OUT)
(OUT / "assets" / "full").mkdir(parents=True)

for name in ["app.js", "companion.js", "flows.js", "studigo.css", "companion.css", "flows.css"]:
    text = (SRC / name).read_text(encoding="utf-8").replace("\r\n", "\n")
    if name == "app.js":
        assert "assets/center.png" in text
        text = text.replace("assets/center.png", "assets/center.webp")
    if name == "companion.js":
        assert 'src="assets/${MIRROR[pose] || pose}.png"' in text
        text = text.replace('src="assets/${MIRROR[pose] || pose}.png"', 'src="assets/${MIRROR[pose] || pose}.webp"')
    (OUT / name).write_text(text, encoding="utf-8", newline="\n")

before = after = 0
for png in sorted((SRC / "assets").glob("*.png")):
    if png.name == "app-icon.png":
        continue
    target = OUT / "assets" / (png.stem + ".webp")
    Image.open(png).convert("RGBA").save(target, "WEBP", quality=88, method=6)
    before += png.stat().st_size
    after += target.stat().st_size
shutil.copy2(SRC / "assets" / "mark.jpg", OUT / "assets" / "mark.jpg")
for webp in sorted((SRC / "assets" / "full").glob("*.webp")):
    shutil.copy2(webp, OUT / "assets" / "full" / webp.name)

html = (SRC / "index.html").read_text(encoding="utf-8").replace("\r\n", "\n")
html, n = re.subn(r"\n  <aside class=\"demoPanel\".*?</aside>\n", "\n", html, flags=re.S)
assert n == 1
html = html.replace("<title>Studigo Companion Demo</title>", "<title>Studigo demo</title>")
html, n = re.subn(
    r"  <meta name=\"description\"[^>]*>\n",
    "  <meta name=\"robots\" content=\"noindex\">\n"
    "  <script>if (!new URLSearchParams(location.search).has(\"embed\")) location.replace(location.pathname + \"?embed\");</script>\n",
    html,
)
assert n == 1
(OUT / "index.html").write_text(html, encoding="utf-8", newline="\n")

total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
print(f"sprites: {before / 1024:.0f} KB png -> {after / 1024:.0f} KB webp")
print(f"public/demo: {total / 1024:.0f} KB in {sum(1 for f in OUT.rglob('*') if f.is_file())} files")
