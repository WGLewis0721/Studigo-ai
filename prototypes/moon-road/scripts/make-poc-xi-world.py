# POC XI round 3 art: doors, portcullis gates, power seals, rune altar, portal arch, ammo capsules and drops.
# Hand-drawn at half resolution (nearest 2x) into art-source/poc-xi/world-frames/. Run make-poc-xi-fx.py first
# (ammo capsules reuse the beam sprites). Then: node scripts/pack-atlas.mjs world
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

root = Path(__file__).resolve().parents[1]
out = root / 'art-source/poc-xi/world-frames'
fxdir = root / 'art-source/poc-xi/fx-frames'
out.mkdir(parents=True, exist_ok=True)
for old in out.glob('*.png'):
    old.unlink()

INK = (14, 10, 18, 255)
STONE, STONE_L, STONE_D, MORTAR = (104, 94, 78), (150, 136, 108), (68, 60, 50), (34, 29, 24)
BRASS, BRASS_L, BRASS_D = (214, 168, 84), (255, 226, 150), (130, 92, 42)
IRON, IRON_L, IRON_D = (96, 108, 128), (160, 176, 198), (46, 54, 70)
rnd = random.Random(11)


def rgba(c, a=255):
    return (*c, a)


def outline(im):
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    base = Image.new('RGBA', im.size, INK)
    base.putalpha(a.filter(ImageFilter.MaxFilter(3)))
    base.alpha_composite(im)
    return base


def save(im, name, ink=True, scale=2):
    if ink:
        im = outline(im)
    im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST).save(out / f'{name}.png')


def canvas(w, h):
    im = Image.new('RGBA', (w, h))
    return im, ImageDraw.Draw(im)


def speckle(d, box, n, cols):
    x0, y0, x1, y1 = box
    for _ in range(n):
        d.point((rnd.randint(x0, x1), rnd.randint(y0, y1)), fill=rgba(rnd.choice(cols), 150))


# ---------- door frame: posts, lintel with keystone and a gear, sill (native 44 x 154; opening 24 x 128) ----------
im, d = canvas(22, 77)
d.rectangle([0, 0, 21, 76], fill=(0, 0, 0, 0))
for x0, x1 in ((0, 4), (17, 21)):
    d.rectangle([x0, 8, x1, 70], fill=rgba(STONE))
    speckle(d, (x0, 8, x1, 70), 24, (STONE_D, STONE_L))
    d.line([(x0, 8), (x0, 70)], fill=rgba(STONE_L)); d.line([(x1, 8), (x1, 70)], fill=rgba(STONE_D))
    for y in (16, 34, 52, 66):
        d.line([(x0, y), (x1, y)], fill=rgba(MORTAR, 160))
    for y in (24, 44):
        d.rectangle([x0, y, x1, y + 1], fill=rgba(BRASS)); d.point((x0, y), fill=rgba(BRASS_L))
d.rectangle([0, 0, 21, 9], fill=rgba(STONE)); speckle(d, (0, 0, 21, 9), 20, (STONE_D, STONE_L))
d.line([(0, 0), (21, 0)], fill=rgba(STONE_L)); d.line([(0, 9), (21, 9)], fill=rgba(MORTAR))
d.polygon([(7, 0), (14, 0), (13, 9), (8, 9)], fill=rgba(STONE_L))
d.ellipse([8, 2, 13, 7], fill=rgba(BRASS)); d.ellipse([9, 3, 12, 6], fill=rgba(BRASS_D)); d.point((10, 4), fill=rgba(BRASS_L))
d.rectangle([0, 70, 21, 76], fill=rgba(STONE_D)); d.line([(0, 70), (21, 70)], fill=rgba(STONE_L))
d.rectangle([2, 70, 19, 71], fill=rgba(BRASS))
save(im, 'door_frame')

# ---------- portcullis (native 20 x 128): travel door (blue lamp) and boss lock (red chains + padlock) ----------
def portcullis(lock):
    im, d = canvas(10, 64)
    glow = (220, 70, 56) if lock else (96, 196, 255)
    for x in (1, 4, 7):
        d.rectangle([x, 0, x + 1, 59], fill=rgba(IRON)); d.line([(x, 0), (x, 59)], fill=rgba(IRON_L))
        d.polygon([(x, 59), (x + 1, 59), (x + 1, 63) if False else (x + 1, 62), (x, 62)], fill=rgba(IRON))
        d.point((x, 63), fill=rgba(IRON_L))
    for y in (4, 22, 40, 56):
        d.rectangle([0, y, 9, y + 1], fill=rgba(IRON_D)); d.line([(0, y), (9, y)], fill=rgba(IRON_L, 200))
    d.ellipse([3, 28, 6, 31], fill=rgba(glow)); d.point((4, 29), fill=(255, 255, 255, 255))
    if lock:
        for k in range(8):
            d.rectangle([1 + (k % 2) * 4, 10 + k * 5, 3 + (k % 2) * 4, 12 + k * 5], outline=rgba(IRON_L), fill=None)
        d.rectangle([2, 26, 7, 34], fill=rgba(BRASS)); d.rectangle([3, 27, 6, 33], fill=rgba(BRASS_D))
        d.arc([2, 20, 7, 28], 180, 360, fill=rgba(IRON_L), width=1)
        d.point((4, 30), fill=INK); d.line([(4, 30), (4, 32)], fill=INK)
    return im


save(portcullis(False), 'door_gate')
save(portcullis(True), 'door_lock')

# ---------- power seal slab (native 32 x 136) with a glow strip ----------
im, d = canvas(16, 68)
d.rectangle([0, 3, 15, 64], fill=rgba(STONE_D))
d.rectangle([1, 3, 14, 64], fill=rgba(STONE))
speckle(d, (1, 3, 14, 64), 60, (STONE_D, STONE_L, MORTAR))
d.rectangle([4, 7, 11, 60], fill=rgba((24, 24, 34)))
d.rectangle([4, 7, 11, 60], outline=rgba(BRASS_D))
for y in (0, 64):
    d.rectangle([0, y, 15, y + 3], fill=rgba(BRASS)); d.line([(0, y), (15, y)], fill=rgba(BRASS_L)); d.line([(0, y + 3), (15, y + 3)], fill=rgba(BRASS_D))
for x, y in ((2, 5), (13, 5), (2, 62), (13, 62)):
    d.point((x, y), fill=rgba(BRASS_L))
save(im, 'seal_slab')

im, d = canvas(12, 64)
for y in range(64):
    for x in range(12):
        a = int(255 * max(0, 1 - abs(x - 5.5) / 6.2) * (0.55 + 0.45 * math.sin(y / 64 * math.pi)))
        d.point((x, y), fill=(255, 255, 255, a))
save(im, 'seal_glow', ink=False)

# ---------- rune altar (native 76 x 76) and portal arch (native 96 x 190) ----------
im, d = canvas(38, 38)
d.ellipse([0, 0, 37, 37], fill=rgba(STONE_D))
d.ellipse([1, 1, 36, 36], fill=rgba(STONE)); speckle(d, (4, 4, 33, 33), 70, (STONE_D, STONE_L))
d.ellipse([5, 5, 32, 32], fill=rgba(BRASS_D)); d.ellipse([6, 6, 31, 31], fill=rgba(BRASS))
d.arc([6, 6, 31, 31], 190, 280, fill=rgba(BRASS_L), width=1)
d.ellipse([8, 8, 29, 29], fill=rgba((18, 22, 34)))
for k in range(8):
    a = k * math.pi / 4 + 0.39
    d.point((19 + math.cos(a) * 17.5, 19 + math.sin(a) * 17.5), fill=rgba(STONE_L))
save(im, 'rune_altar')

im, d = canvas(48, 95)
d.rectangle([0, 18, 47, 94], fill=(0, 0, 0, 0))
for x0, x1 in ((0, 8), (39, 47)):
    d.rectangle([x0, 20, x1, 94], fill=rgba(STONE)); speckle(d, (x0, 20, x1, 94), 60, (STONE_D, STONE_L))
    d.line([(x0, 20), (x0, 94)], fill=rgba(STONE_L)); d.line([(x1, 20), (x1, 94)], fill=rgba(STONE_D))
    for y in range(26, 94, 12):
        d.line([(x0, y), (x1, y)], fill=rgba(MORTAR, 150))
    for y in (40, 70):
        d.rectangle([x0, y, x1, y + 2], fill=rgba(BRASS)); d.point((x0, y), fill=rgba(BRASS_L))
d.pieslice([0, 0, 47, 46], 180, 360, fill=rgba(STONE))
d.pieslice([8, 8, 39, 38], 180, 360, fill=(0, 0, 0, 0))
d.arc([0, 0, 47, 46], 180, 360, fill=rgba(STONE_L), width=1)
d.rectangle([8, 22, 39, 24], fill=(0, 0, 0, 0))
d.polygon([(20, 0), (27, 0), (26, 12), (21, 12)], fill=rgba(STONE_L))
d.ellipse([20, 3, 27, 10], fill=rgba(BRASS)); d.ellipse([22, 5, 25, 8], fill=rgba(BRASS_D))
for k, cx in enumerate((10, 16, 31, 37)):
    cy = 22 - int(abs(cx - 23.5) * 0.55) if False else 24 - (5 if cx in (16, 31) else 0)
    d.ellipse([cx - 2, cy - 7, cx + 2, cy - 3], fill=rgba(IRON_D)); d.ellipse([cx - 1, cy - 6, cx + 1, cy - 4], fill=rgba(IRON))
save(im, 'portal_arch')

# ---------- ammo capsules (beam emblem inside brass-capped glass) and small drops ----------
def beam_emblem(n, size, rot):
    src = Image.open(fxdir / f'beam{n}_0.png').convert('RGBA')
    box = src.getchannel('A').getbbox()
    src = src.crop(box)
    k = size / max(src.size)
    src = src.resize((max(1, round(src.width * k)), max(1, round(src.height * k))), Image.Resampling.NEAREST)
    return src.rotate(rot, resample=Image.Resampling.NEAREST, expand=True)


GLOW = {2: (255, 180, 74), 3: (87, 184, 255), 4: (127, 224, 160), 5: (255, 111, 138)}
ROT = {2: 0, 3: 35, 4: 0, 5: 0}
for n in (2, 3, 4, 5):
    im = Image.new('RGBA', (44, 44))
    d = ImageDraw.Draw(im)
    d.ellipse([3, 3, 40, 40], fill=(*[int(c * 0.25) for c in GLOW[n]], 235))
    d.ellipse([3, 3, 40, 40], outline=rgba(BRASS), width=2)
    d.ellipse([6, 6, 37, 37], outline=(*GLOW[n], 150), width=1)
    d.arc([7, 7, 27, 27], 190, 270, fill=(255, 255, 255, 190), width=2)
    emb = beam_emblem(n, 30, ROT[n])
    im.alpha_composite(emb, ((44 - emb.width) // 2, (44 - emb.height) // 2))
    d.rectangle([14, 38, 29, 43], fill=rgba(BRASS)); d.line([(14, 38), (29, 38)], fill=rgba(BRASS_L)); d.line([(14, 43), (29, 43)], fill=rgba(BRASS_D))
    d.rectangle([14, 0, 29, 3], fill=rgba(BRASS)); d.line([(14, 0), (29, 0)], fill=rgba(BRASS_L))
    im = outline(im)
    im.save(out / f'ammo_{n}.png')
    drop = beam_emblem(n, 20, ROT[n])
    dc = Image.new('RGBA', (24, 24)); dc.alpha_composite(drop, ((24 - drop.width) // 2, (24 - drop.height) // 2))
    outline(dc).save(out / f'drop_{n}.png')

# refill-all / boss knowledge orb: a gold cross in a brass-capped crystal ball
im = Image.new('RGBA', (44, 44)); d = ImageDraw.Draw(im)
d.ellipse([3, 3, 40, 40], fill=(60, 52, 24, 235)); d.ellipse([3, 3, 40, 40], outline=rgba(BRASS), width=2)
d.rectangle([19, 10, 24, 33], fill=rgba(BRASS_L)); d.rectangle([10, 19, 33, 24], fill=rgba(BRASS_L))
d.rectangle([20, 11, 23, 32], fill=(255, 250, 220, 255)); d.rectangle([11, 20, 32, 23], fill=(255, 250, 220, 255))
d.arc([7, 7, 27, 27], 190, 270, fill=(255, 255, 255, 190), width=2)
d.rectangle([14, 38, 29, 43], fill=rgba(BRASS)); d.rectangle([14, 0, 29, 3], fill=rgba(BRASS))
outline(im).save(out / 'ammo_all.png')

# unlock orb frame: same capsule shell, empty (the game tints/overlays the beam on top)
# ---------- shrine: carved plinth with a brass brazier (native 60 x 92), flame frames and a gem ----------
im, d = canvas(30, 46)
d.rectangle([0, 38, 29, 45], fill=rgba(STONE_D)); d.rectangle([1, 38, 28, 44], fill=rgba(STONE)); speckle(d, (1, 38, 28, 44), 22, (STONE_D, STONE_L))
d.line([(1, 38), (28, 38)], fill=rgba(STONE_L)); d.rectangle([3, 34, 26, 37], fill=rgba(STONE)); d.line([(3, 34), (26, 34)], fill=rgba(STONE_L))
d.rectangle([2, 40, 27, 41], fill=rgba(BRASS)); d.point((2, 40), fill=rgba(BRASS_L))
d.polygon([(8, 34), (22, 34), (20, 14), (10, 14)], fill=rgba(STONE)); speckle(d, (9, 15, 21, 33), 26, (STONE_D, STONE_L))
d.line([(10, 14), (8, 34)], fill=rgba(STONE_L)); d.line([(20, 14), (22, 34)], fill=rgba(STONE_D))
for y, w in ((19, 2), (25, 2), (30, 2)):
    d.line([(15 - w, y), (15 + w, y)], fill=(143, 245, 224, 255)); d.point((15, y - 1), fill=(143, 245, 224, 255))
d.rectangle([9, 14, 21, 15], fill=rgba(BRASS)); d.line([(9, 14), (21, 14)], fill=rgba(BRASS_L))
d.polygon([(4, 6), (26, 6), (22, 13), (8, 13)], fill=rgba(BRASS)); d.polygon([(6, 7), (24, 7), (21, 12), (9, 12)], fill=rgba(BRASS_D))
d.line([(4, 6), (26, 6)], fill=rgba(BRASS_L)); d.ellipse([7, 4, 23, 8], fill=rgba((26, 20, 22)))
d.arc([5, 5, 14, 12], 180, 270, fill=rgba(BRASS_L))
save(im, 'shrine_base')

for f in range(3):
    im, d = canvas(14, 20)
    sway = (-1, 0, 1)[f]
    d.polygon([(7, 19), (2, 13), (4, 6 - f), (7, 0 + f), (10, 6 - f), (12, 13)], fill=(255, 150, 54, 255))
    d.polygon([(7, 19), (4, 14), (5 + sway, 8), (7 + sway, 3 + f), (9 + sway, 8), (10, 14)], fill=(255, 210, 96, 255))
    d.polygon([(7, 19), (5, 15), (7, 9 + f), (9, 15)], fill=(255, 250, 214, 255))
    save(im, f'shrine_flame_{f}', ink=False)

im, d = canvas(7, 9)
d.polygon([(3, 0), (6, 3), (3, 8), (0, 3)], fill=(255, 255, 255, 255))
d.polygon([(3, 1), (5, 3), (3, 6), (1, 3)], fill=(214, 224, 236, 255))
d.point((2, 2), fill=(255, 255, 255, 255))
save(im, 'shrine_gem')

print('world frames:', len(list(out.glob('*.png'))))
