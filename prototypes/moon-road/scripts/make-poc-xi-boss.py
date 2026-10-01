# POC XI round 6 boss attack art: thrown bone, arcane shards, spinning gears, shockwave crest, charge orb,
# rune telegraph circle, floor crack, steam puff, chime ring. Half-res, outlined, nearest 2x -> art-source/poc-xi/boss-frames/.
# Then: node scripts/pack-atlas.mjs boss
import sys
from pathlib import Path as _P
sys.path.insert(0, str(_P(__file__).resolve().parent))
from pixel_style import OUTLINE, snap
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

out = Path(__file__).resolve().parents[1] / 'art-source/poc-xi/boss-frames'
out.mkdir(parents=True, exist_ok=True)
for old in out.glob('*.png'):
    old.unlink()
INK = OUTLINE
BONE, BONE_D, BONE_L = (226, 214, 184), (156, 140, 112), (255, 250, 232)
BRONZE, BRONZE_D, BRONZE_L = (206, 140, 62), (120, 74, 34), (255, 214, 130)
VIO, VIO_D, VIO_L = (150, 104, 232), (84, 50, 150), (222, 200, 255)
rgba = lambda c, a=255: (*c, a)


def outline(im):
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    base = Image.new('RGBA', im.size, INK)
    base.putalpha(a.filter(ImageFilter.MaxFilter(3)))
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


# thrown bone (horizontal; the game spins it)
im, d = canvas(22, 9)
d.rectangle([4, 3, 17, 5], fill=rgba(BONE))
d.line([(4, 3), (17, 3)], fill=rgba(BONE_L)); d.line([(4, 5), (17, 5)], fill=rgba(BONE_D))
for cx in (3, 18):
    d.ellipse([cx - 3, 1, cx + 2, 7], fill=rgba(BONE)); d.ellipse([cx - 1, 2, cx + 1, 4], fill=rgba(BONE_L))
d.point((1, 4), fill=(0, 0, 0, 0)); d.point((20, 4), fill=(0, 0, 0, 0))
save(im, 'bone')

# arcane shard (points right)
im, d = canvas(24, 11)
d.polygon([(23, 5), (14, 1), (3, 3), (1, 5), (3, 7), (14, 9)], fill=rgba(VIO_D))
d.polygon([(22, 5), (14, 2), (4, 4), (4, 6), (14, 8)], fill=rgba(VIO))
d.polygon([(21, 5), (14, 3), (7, 5), (14, 7)], fill=rgba(VIO_L))
d.line([(6, 5), (20, 5)], fill=(255, 255, 255, 255))
d.point((0, 3), fill=rgba(VIO, 160)); d.point((0, 7), fill=rgba(VIO, 160))
save(im, 'shard')

# spinning gear
im, d = canvas(15, 15)
for k in range(8):
    a = k * math.pi / 4
    x, y = 7 + math.cos(a) * 6.2, 7 + math.sin(a) * 6.2
    d.rectangle([x - 1.2, y - 1.2, x + 1.2, y + 1.2], fill=rgba(BRONZE))
d.ellipse([2, 2, 12, 12], fill=rgba(BRONZE_D)); d.ellipse([3, 3, 11, 11], fill=rgba(BRONZE))
d.arc([3, 3, 11, 11], 190, 280, fill=rgba(BRONZE_L))
d.ellipse([5, 5, 9, 9], fill=INK); d.point((7, 7), fill=rgba(BRONZE_D))
save(im, 'gear')

# ground shockwave crest (travels to the right; flipped in game)
im, d = canvas(26, 18)
d.polygon([(25, 17), (21, 9), (15, 4), (8, 1), (3, 5), (0, 17)], fill=rgba((200, 120, 52)))
d.polygon([(23, 17), (19, 10), (14, 6), (8, 3), (4, 7), (3, 17)], fill=rgba((255, 178, 90)))
d.polygon([(19, 17), (16, 11), (12, 8), (8, 6), (7, 17)], fill=rgba((255, 232, 170)))
for x, y in ((9, 0), (15, 3), (20, 7)):
    d.rectangle([x, y, x + 2, y + 2], fill=rgba(BRONZE_L))
save(im, 'wave')

# charge orb (3 frames) and rune telegraph circle (3 frames)
for f in range(3):
    im, d = canvas(16, 16)
    r = 4 + f
    d.ellipse([8 - r - 2, 8 - r - 2, 8 + r + 1, 8 + r + 1], fill=rgba(VIO, 90))
    d.ellipse([8 - r, 8 - r, 8 + r - 1, 8 + r - 1], fill=rgba(VIO))
    d.ellipse([8 - r + 2, 8 - r + 2, 8 + r - 3, 8 + r - 3], fill=rgba(VIO_L))
    d.ellipse([7, 7, 8, 8], fill=(255, 255, 255, 255))
    for k in range(6):
        a = k * math.pi / 3 + f * 0.5
        d.point((8 + math.cos(a) * (r + 3), 8 + math.sin(a) * (r + 3)), fill=rgba(VIO_L))
    save(im, f'charge_{f}', ink=False)
for f in range(3):
    im, d = canvas(40, 12)
    d.ellipse([0, 0, 39, 11], outline=rgba(VIO_L, 230), width=1)
    d.ellipse([3, 2, 36, 9], outline=rgba(VIO, 200), width=1)
    for k in range(10):
        a = k * math.pi / 5 + f * 0.31
        x, y = 20 + math.cos(a) * 15.5, 6 + math.sin(a) * 3.8
        d.rectangle([x - 1, y - 1, x, y], fill=rgba(VIO_L))
    save(im, f'rune_mark_{f}', ink=False)

# floor crack and steam puff
im, d = canvas(34, 6)
pts = [(0, 3), (5, 2), (9, 4), (14, 2), (19, 4), (25, 2), (33, 3)]
d.line(pts, fill=INK, width=1)
d.line([(p[0], p[1] - 1) for p in pts[1:-1]], fill=rgba((90, 74, 60), 160))
save(im, 'floor_crack', ink=False)
for f in range(3):
    im, d = canvas(14, 14)
    r = 3 + f * 1.5
    for cx, cy in ((6, 7), (8, 6), (7, 8)):
        d.ellipse([cx - r / 2, cy - r / 2, cx + r / 2, cy + r / 2], fill=(236, 236, 240, 255 - f * 70))
    save(im, f'steam_{f}', ink=False)

# chime ring (the dummy's harmless rings)
im, d = canvas(13, 13)
d.ellipse([1, 1, 11, 11], outline=(216, 226, 236, 255), width=2)
d.ellipse([3, 3, 9, 9], outline=(150, 170, 190, 255), width=1)
d.point((3, 2), fill=(255, 255, 255, 255))
save(im, 'chime')
print('boss frames:', len(list(out.glob('*.png'))))
