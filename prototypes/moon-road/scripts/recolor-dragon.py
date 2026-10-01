# POC XI player sheet: recolor the jade dragon orange and ground every standing frame (feet on row 122).
# Reads dist/assets/dragon.png (never modified) and writes dist/poc-xi/art/dragon-orange.png, same 12 x 128 layout.
import colorsys
import numpy as np
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
src = np.array(Image.open(root / 'dist/assets/dragon.png').convert('RGBA'), dtype=np.float32) / 255
r, g, b, a = src[..., 0], src[..., 1], src[..., 2], src[..., 3]
mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
d = mx - mn
h = np.zeros_like(mx)
m = d > 1e-6
rc, gc, bc = [np.where(m, (mx - c) / np.where(m, d, 1), 0) for c in (r, g, b)]
h = np.where(mx == r, (bc - gc) % 6, np.where(mx == g, 2 + rc - bc, 4 + gc - rc)) * 60 % 360
s = np.where(mx > 0, d / np.where(mx > 0, mx, 1), 0)
green = (h >= 95) & (h <= 200) & (s > 0.25)
h2 = np.where(green, 24 + (h - 150) * 0.12, h)
mx = np.where(green, np.minimum(1, mx ** 0.7 * 1.12), mx)
s2 = np.where(green, np.minimum(1, s * 1.2 + 0.18), s)
rgb = np.zeros_like(src[..., :3])
hh = (h2 % 360) / 60
i = np.floor(hh).astype(int) % 6
f = hh - np.floor(hh)
p, q, t = mx * (1 - s2), mx * (1 - s2 * f), mx * (1 - s2 * (1 - f))
for k, (rr, gg, bb) in enumerate([(mx, t, p), (q, mx, p), (p, mx, t), (p, q, mx), (t, p, mx), (mx, p, q)]):
    sel = i == k
    rgb[..., 0] = np.where(sel, rr, rgb[..., 0]); rgb[..., 1] = np.where(sel, gg, rgb[..., 1]); rgb[..., 2] = np.where(sel, bb, rgb[..., 2])
out = np.dstack([rgb, a])
sheet = Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')
BASELINE, GROUND = 122, {0, 1, 2, 3, 4, 5, 6, 9, 10, 11}
final = Image.new('RGBA', sheet.size)
for n in range(12):
    cell = sheet.crop((n * 128, 0, n * 128 + 128, 128))
    if n in GROUND:
        rows = np.where((np.array(cell)[..., 3] > 90).any(axis=1))[0]
        shift = BASELINE - int(rows.max())
        moved = Image.new('RGBA', cell.size)
        moved.paste(cell, (0, shift))
        cell = moved
    final.paste(cell, (n * 128, 0))
dest = root / 'dist/poc-xi/art/dragon-orange.png'
final.save(dest, optimize=True)
print('wrote', dest)
