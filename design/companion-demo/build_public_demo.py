"""Build the shipped copies of this folder.

- apps/web/public/mascot/companion: the one set of Studigo sprites the live site
  uses (the app's companion window, the Home stage, the homepage guide and the
  demo phone). Waist-up poses are converted to WebP.
- apps/web/public/demo: the phone demo the homepage embeds in an iframe. It is
  embed-only (the phone, no side panel), is not indexed, and reads its sprites
  from /mascot/companion.

Run this after changing the demo or the art, from anywhere:

    python design/companion-demo/build_public_demo.py

Needs Pillow.
"""
import re
import shutil
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parent
PUBLIC = SRC.parents[1] / "apps" / "web" / "public"
OUT = PUBLIC / "demo"
ART = PUBLIC / "mascot" / "companion"

for folder in (OUT, ART):
    if folder.exists():
        shutil.rmtree(folder)
OUT.mkdir(parents=True)
(ART / "full").mkdir(parents=True)

for name in ["app.js", "companion.js", "flows.js", "studigo.css", "companion.css", "flows.css"]:
    text = (SRC / name).read_text(encoding="utf-8").replace("\r\n", "\n")
    if name == "app.js":
        assert "assets/center.png" in text
        text = text.replace("assets/center.png", "assets/center.webp")
    if name == "companion.js":
        assert 'src="assets/${MIRROR[pose] || pose}.png"' in text
        text = text.replace('src="assets/${MIRROR[pose] || pose}.png"', 'src="assets/${MIRROR[pose] || pose}.webp"')
    text = text.replace('"assets/', '"/mascot/companion/')
    assert "assets/" not in text, name
    (OUT / name).write_text(text, encoding="utf-8", newline="\n")

before = after = 0
for png in sorted((SRC / "assets").glob("*.png")):
    if png.name == "app-icon.png":
        continue
    target = ART / (png.stem + ".webp")
    Image.open(png).convert("RGBA").save(target, "WEBP", quality=88, method=6)
    before += png.stat().st_size
    after += target.stat().st_size
shutil.copy2(SRC / "assets" / "mark.jpg", ART / "mark.jpg")
for webp in sorted((SRC / "assets" / "full").glob("*.webp")):
    shutil.copy2(webp, ART / "full" / webp.name)

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


def size(folder):
    return sum(f.stat().st_size for f in folder.rglob("*") if f.is_file()) / 1024


print(f"waist-up sprites: {before / 1024:.0f} KB png -> {after / 1024:.0f} KB webp")
print(f"public/mascot/companion: {size(ART):.0f} KB, public/demo: {size(OUT):.0f} KB")
