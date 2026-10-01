# POC XI round 2 art: beam projectiles, muzzle/impact flashes, Clock Shield and carved number blocks.
# Hand-drawn at half resolution, outlined, then nearest-neighbor 2x into art-source/poc-xi/fx-frames/.
# Then pack: node scripts/pack-atlas.mjs fx
import sys
from pathlib import Path as _P
sys.path.insert(0, str(_P(__file__).resolve().parent))
from pixel_style import OUTLINE, snap
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

out = Path(__file__).resolve().parents[1] / 'art-source/poc-xi/fx-frames'
out.mkdir(parents=True, exist_ok=True)
for old in out.glob('*.png'):
    old.unlink()

INK = OUTLINE
WHITE = (255, 250, 232, 255)
BEAM = {
    1: ((214, 232, 239), (150, 196, 214), (255, 255, 255)),
    2: ((255, 180, 74), (226, 104, 34), (255, 236, 168)),
    3: ((87, 184, 255), (36, 96, 214), (214, 242, 255)),
    4: ((127, 224, 160), (36, 150, 98), (224, 255, 226)),
    5: ((255, 111, 138), (196, 40, 92), (255, 216, 226)),
}


def rgba(c, a=255):
    return (*c, a)


def outline(im, color=INK):
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    grown = a.filter(ImageFilter.MaxFilter(3))
    base = Image.new('RGBA', im.size, color)
    base.putalpha(grown)
    base.alpha_composite(im)
    return base


def save(im, name, ink=True):
    if ink:
        im = outline(im)
    im = snap(im, keep_alpha=not ink)
    im.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST).save(out / f'{name}.png')


def canvas(w, h):
    im = Image.new('RGBA', (w, h))
    return im, ImageDraw.Draw(im)


# ---------- beams, drawn pointing right (+x); the game rotates them to the shot direction ----------
def bolt(f):
    mid, deep, hot = BEAM[1]
    im, d = canvas(20, 10)
    tail = 8 + 2 * f
    for i in range(tail):
        d.point((11 - i, 5), fill=rgba(deep, 255 - i * 22))
    d.ellipse([10, 3, 17, 6], fill=rgba(mid))
    d.ellipse([12, 4, 16, 5], fill=rgba(hot))
    d.point((18, 4), fill=rgba(hot))
    d.point((6 + f, 2), fill=rgba(mid, 180))
    d.point((4 - f, 7), fill=rgba(mid, 180))
    return im


def fireball(f):
    mid, deep, hot = BEAM[2]
    im, d = canvas(30, 16)
    for k, (dy, ln) in enumerate([(-3, 11), (0, 15), (3, 10)]):
        ln += f * (1 if k != 1 else 2)
        d.polygon([(19, 8 + dy), (19 - ln, 8 + dy * 2 // 3 - 1), (19 - ln, 8 + dy * 2 // 3 + 1)], fill=rgba(deep if k != 1 else mid, 230))
    d.ellipse([15, 3, 27, 13], fill=rgba(deep))
    d.ellipse([16, 4, 26, 12], fill=rgba(mid))
    d.ellipse([19, 6, 26, 11], fill=rgba(hot))
    d.point((22, 8), fill=WHITE)
    d.arc([13, 1, 28, 15], 300, 80, fill=rgba(hot, 200))
    return im


def lance(f):
    mid, deep, hot = BEAM[3]
    im, d = canvas(36, 14)
    d.line([(2, 7), (24, 7)], fill=rgba(deep), width=3)
    d.line([(4, 7), (24, 7)], fill=rgba(mid), width=1)
    d.polygon([(34, 7), (24, 2), (21, 7), (24, 12)], fill=rgba(mid))
    d.polygon([(34, 7), (26, 4), (24, 7)], fill=rgba(hot))
    d.polygon([(21, 7), (14, 2), (17, 7)], fill=rgba(deep))
    d.polygon([(21, 7), (14, 12), (17, 7)], fill=rgba(deep))
    for i in range(4):
        d.point((1 + i * 3 + f, 3 + (i * 2) % 3 * 3), fill=rgba(hot, 200))
    return im


def crescent(f):
    mid, deep, hot = BEAM[4]
    im, d = canvas(26, 22)

    def moon(cx, r_out, r_in, off, col):
        m = Image.new('L', im.size, 0)
        md = ImageDraw.Draw(m)
        md.ellipse([cx - r_out, 11 - r_out, cx + r_out, 11 + r_out], fill=255)
        md.ellipse([cx - off - r_in, 11 - r_in, cx - off + r_in, 11 + r_in], fill=0)
        im.paste(Image.new('RGBA', im.size, rgba(col)), (0, 0), m)
    moon(14, 10, 9, 6, deep)
    moon(14, 9, 8, 6, mid)
    moon(15, 7, 7, 6, hot)
    for i in range(5):
        d.point((1 + i * 2, 5 + (i * 5 + f * 3) % 12), fill=rgba(hot, 190))
    return im


def star(f):
    mid, deep, hot = BEAM[5]
    im, d = canvas(32, 22)

    def spike(cx, cy, r, rot):
        pts = []
        for i in range(8):
            ang = rot + i * math.pi / 4
            rr = r if i % 2 == 0 else r * 0.38
            pts.append((cx + math.cos(ang) * rr, cy + math.sin(ang) * rr))
        return pts
    d.polygon(spike(22, 11, 9.5, f * 0.4), fill=rgba(deep))
    d.polygon(spike(22, 11, 8, f * 0.4), fill=rgba(mid))
    d.ellipse([19, 8, 25, 14], fill=rgba(hot))
    d.polygon(spike(10, 11, 4.5, -f * 0.5), fill=rgba(mid, 210))
    d.polygon(spike(3, 11, 2.5, f * 0.5), fill=rgba(hot, 190))
    return im


for n, fn in ((1, bolt), (2, fireball), (3, lance), (4, crescent), (5, star)):
    for f in (0, 1):
        save(fn(f), f'beam{n}_{f}')


# ---------- muzzle flash and impact (white so the game can tint them per beam) ----------
for f in range(3):
    im, d = canvas(20, 20)
    r = 8 - f * 2
    for i in range(8):
        ang = i * math.pi / 4 + f * 0.2
        ln = r + (3 if i % 2 == 0 else -1)
        d.line([(10, 10), (10 + math.cos(ang) * ln, 10 + math.sin(ang) * ln)], fill=WHITE, width=2 if f == 0 else 1)
    d.ellipse([10 - 3 + f, 10 - 3 + f, 10 + 3 - f, 10 + 3 - f], fill=WHITE)
    save(im, f'muzzle_{f}', ink=False)

for f in range(3):
    im, d = canvas(28, 28)
    r = 4 + f * 4
    d.ellipse([14 - r, 14 - r, 14 + r, 14 + r], outline=(255, 255, 255, 255 - f * 70), width=2)
    for i in range(6):
        ang = i * math.pi / 3 + 0.3
        d.line([(14 + math.cos(ang) * (r - 1), 14 + math.sin(ang) * (r - 1)), (14 + math.cos(ang) * (r + 3), 14 + math.sin(ang) * (r + 3))], fill=WHITE)
    save(im, f'impact_{f}', ink=False)

# ---------- Clock Shield ----------
TEAL, TEAL_D, TEAL_L = (143, 245, 224), (44, 150, 150), (222, 255, 246)
im, d = canvas(44, 56)
d.ellipse([2, 2, 41, 53], fill=(143, 245, 224, 40))
d.ellipse([2, 2, 41, 53], outline=rgba(TEAL_D), width=2)
d.ellipse([4, 4, 39, 51], outline=rgba(TEAL, 200), width=1)
for i in range(16):
    ang = i * math.pi / 8
    x1, y1 = 22 + math.cos(ang) * 19.5, 28 + math.sin(ang) * 25.5
    x2, y2 = 22 + math.cos(ang) * 22, 28 + math.sin(ang) * 28
    d.line([(x1, y1), (x2, y2)], fill=rgba(TEAL_L if i % 2 == 0 else TEAL), width=2)
d.arc([6, 6, 24, 30], 190, 275, fill=rgba(TEAL_L), width=2)
d.arc([8, 8, 20, 22], 200, 260, fill=WHITE, width=1)
save(im, 'shield_shell', ink=False)

im, d = canvas(13, 13)
for i in range(8):
    ang = i * math.pi / 4
    d.polygon([(6.5 + math.cos(ang - 0.28) * 5, 6.5 + math.sin(ang - 0.28) * 5), (6.5 + math.cos(ang) * 6.4, 6.5 + math.sin(ang) * 6.4),
               (6.5 + math.cos(ang + 0.28) * 5, 6.5 + math.sin(ang + 0.28) * 5)], fill=rgba(TEAL))
d.ellipse([2, 2, 10, 10], fill=rgba(TEAL))
d.ellipse([4, 4, 8, 8], fill=INK)
save(im, 'shield_gear')

for name, col, ink in (('shield_pip_on', TEAL_L, True), ('shield_pip_off', (40, 70, 84), True)):
    im, d = canvas(9, 9)
    d.polygon([(4, 0), (8, 4), (4, 8), (0, 4)], fill=rgba(col))
    if name.endswith('on'):
        d.polygon([(4, 2), (6, 4), (4, 6), (2, 4)], fill=WHITE)
    save(im, name, ink)

# ---------- carved stone blocks (32 x 32 tiles, assembled to any size in the game) ----------
STONE, STONE_L, STONE_D, MORTAR = (104, 94, 78), (150, 136, 108), (68, 60, 50), (34, 29, 24)
BRASS, BRASS_L = (214, 168, 84), (255, 226, 150)
rnd = random.Random(7)


def tile(top, bottom, left, right, name):
    im, d = canvas(16, 16)
    d.rectangle([0, 0, 15, 15], fill=rgba(STONE))
    for _ in range(26):
        x, y = rnd.randrange(16), rnd.randrange(16)
        d.point((x, y), fill=rgba(STONE_D if rnd.random() < 0.55 else STONE_L, 150))
    d.line([(1, 7), (14, 7)], fill=rgba(MORTAR, 120))
    if top:
        d.line([(0, 0), (15, 0)], fill=rgba(MORTAR)); d.line([(0, 1), (15, 1)], fill=rgba(STONE_L)); d.line([(0, 2), (15, 2)], fill=rgba(STONE_L, 120))
    if bottom:
        d.line([(0, 15), (15, 15)], fill=rgba(MORTAR)); d.line([(0, 14), (15, 14)], fill=rgba(STONE_D)); d.line([(0, 13), (15, 13)], fill=rgba(STONE_D, 140))
    if left:
        d.line([(0, 0), (0, 15)], fill=rgba(MORTAR)); d.line([(1, 1 if top else 0), (1, 14 if bottom else 15)], fill=rgba(STONE_L))
    if right:
        d.line([(15, 0), (15, 15)], fill=rgba(MORTAR)); d.line([(14, 1 if top else 0), (14, 14 if bottom else 15)], fill=rgba(STONE_D))
    for (cx, cy, on) in ((2, 2, top and left), (13, 2, top and right), (2, 13, bottom and left), (13, 13, bottom and right)):
        if on:
            d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=rgba(BRASS))
            d.point((cx - 1, cy - 1), fill=rgba(BRASS_L))
    save(im, name, ink=False)


for ry, rn in ((0, 't'), (1, 'm'), (2, 'b'), (3, 's')):
    for cx, cn in ((0, 'l'), (1, 'c'), (2, 'r'), (3, 's')):
        top = rn in ('t', 's')
        bottom = rn in ('b', 's')
        left = cn in ('l', 's')
        right = cn in ('r', 's')
        tile(top, bottom, left, right, f'block_{rn}{cn}')

for stage in (1, 2, 3):
    im, d = canvas(16, 16)
    r = random.Random(stage * 11)
    pts = [(r.randrange(2, 14), 0)]
    for k in range(3 + stage * 2):
        x, y = pts[-1]
        pts.append((max(0, min(15, x + r.randrange(-3, 4))), min(15, y + r.randrange(2, 5))))
    d.line(pts, fill=rgba(MORTAR), width=2)
    if stage >= 2:
        d.line([(0, 9), (5, 11), (8, 10), (12, 14)], fill=rgba(MORTAR), width=2)
    if stage >= 3:
        d.line([(15, 3), (11, 5), (9, 9), (4, 12)], fill=rgba(MORTAR), width=2)
        for _ in range(6):
            d.point((r.randrange(16), r.randrange(16)), fill=(0, 0, 0, 0))
    save(im, f'crack_{stage}', ink=False)

im, d = canvas(20, 12)
d.rounded_rectangle([0, 0, 19, 11], radius=3, fill=(30, 25, 21, 255))
d.rounded_rectangle([1, 1, 18, 10], radius=2, outline=rgba(BRASS, 220))
d.line([(3, 11), (16, 11)], fill=rgba(STONE_L, 150))
save(im, 'plaque', ink=False)
print('fx frames:', len(list(out.glob('*.png'))))
