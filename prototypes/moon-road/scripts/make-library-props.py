# Draws the Moon Library prop frames (half-res pixel art, nearest-neighbor 2x) into art-source/poc-xi/frames/.
# Polish them in Pixelorama if you like, then run: node scripts/pack-atlas.mjs library
from PIL import Image, ImageDraw
from pathlib import Path
out = Path(__file__).resolve().parents[1] / 'art-source/poc-xi/frames'
out.mkdir(parents=True, exist_ok=True)
WOOD, WOOD_D, WOOD_L = (78, 52, 40), (46, 30, 26), (112, 78, 56)
BOOKS = [(63, 138, 120), (214, 170, 82), (122, 88, 170), (96, 112, 150), (176, 74, 82)]
GOLD, GLOW = (230, 184, 96), (255, 232, 160)

def save(im, name): im.resize((im.width * 2, im.height * 2), Image.Resampling.NEAREST).save(out / f'{name}.png')

def books(d, x0, x1, y1, h):
    x = x0
    for i in range(99):
        w = 3 + (i * 7) % 3
        if x + w > x1: break
        bh = h - (i * 5) % 6
        d.rectangle([x, y1 - bh, x + w - 1, y1 - 1], fill=BOOKS[i % len(BOOKS)])
        d.line([x, y1 - bh, x, y1 - 1], fill=tuple(min(255, c + 30) for c in BOOKS[i % len(BOOKS)]))
        x += w

shelf = Image.new('RGBA', (32, 48)); d = ImageDraw.Draw(shelf)
d.rectangle([0, 0, 31, 47], fill=WOOD_D); d.rectangle([2, 2, 29, 45], fill=(30, 20, 20))
for y1 in (14, 28, 42):
    books(d, 3, 29, y1, 10)
    d.rectangle([2, y1, 29, y1 + 2], fill=WOOD)
    d.line([2, y1, 29, y1], fill=WOOD_L)
d.rectangle([0, 0, 31, 1], fill=WOOD_L)
save(shelf, 'shelf')

lantern = Image.new('RGBA', (12, 24)); d = ImageDraw.Draw(lantern)
d.line([6, 0, 6, 8], fill=WOOD_D)
d.rectangle([3, 8, 8, 10], fill=GOLD); d.rectangle([2, 10, 9, 19], fill=(60, 46, 36))
d.rectangle([3, 11, 8, 18], fill=GLOW); d.rectangle([4, 12, 7, 17], fill=(255, 250, 214))
d.rectangle([3, 19, 8, 21], fill=GOLD)
save(lantern, 'lantern')

lectern = Image.new('RGBA', (20, 28)); d = ImageDraw.Draw(lectern)
d.polygon([(1, 8), (18, 8), (19, 12), (0, 12)], fill=WOOD_L)
d.rectangle([2, 12, 17, 13], fill=WOOD); d.rectangle([8, 13, 11, 25], fill=WOOD); d.rectangle([4, 25, 15, 27], fill=WOOD_D)
d.polygon([(3, 3), (9, 5), (9, 10), (3, 8)], fill=(238, 226, 196)); d.polygon([(10, 5), (16, 3), (16, 8), (10, 10)], fill=(226, 212, 178))
d.line([9, 5, 9, 10], fill=WOOD_D)
save(lectern, 'lectern')

stack = Image.new('RGBA', (24, 14)); d = ImageDraw.Draw(stack)
for i, (x, y, w, c) in enumerate([(1, 9, 20, BOOKS[0]), (3, 5, 17, BOOKS[1]), (0, 1, 18, BOOKS[2])]):
    d.rectangle([x, y, x + w, y + 3], fill=c); d.line([x, y, x + w, y], fill=tuple(min(255, v + 40) for v in c)); d.line([x + 1, y + 3, x + w, y + 3], fill=WOOD_D)
save(stack, 'books')
