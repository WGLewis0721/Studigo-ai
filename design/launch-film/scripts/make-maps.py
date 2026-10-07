"""Generates the displacement maps (secondary-motion rig) and paper grain. Run: python3 -I scripts/make-maps.py"""
import numpy as np
from PIL import Image
N = 256
y, x = np.mgrid[0:N, 0:N] / (N - 1)
sm = lambda a, b, v: np.clip((v - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((v - a) / (b - a), 0, 1))
# SHEAR: horizontal lag grows from hips (0) to crest/frills (1). R channel only.
ramp = np.clip((0.86 - y) / 0.62, 0, 1) ** 1.5
shear = np.stack([0.5 + 0.5 * ramp, np.full_like(x, .5), np.full_like(x, .5)], -1)
# TAIL: vertical flick, left side of the sprite box (tail + flame), strongest at the tip. G channel only.
w = sm(0.36, 0.10, x) * sm(0.28, 0.40, y) * (1 - sm(0.84, 0.95, y))
tail = np.stack([np.full_like(x, .5), 0.5 + 0.5 * w, np.full_like(x, .5)], -1)
for name, a in (("shear", shear), ("tail", tail)):
    Image.fromarray((a * 255).astype(np.uint8)).save(f"public/maps/{name}.png")
rng = np.random.default_rng(7)
g = rng.normal(0, 1, (512, 512)); g = (g - g.min()) / (g.max() - g.min())
Image.fromarray((np.stack([g, g, g], -1) * 255).astype(np.uint8)).save("public/tex/grain.png")
print("ok")
