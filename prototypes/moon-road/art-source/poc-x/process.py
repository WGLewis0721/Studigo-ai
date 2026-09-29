"""Slice the generated POC X sheets into game-ready assets.

Inputs: *-raw.png generated with Higgsfield Nano Banana (see ASSETS.md for prompts).
Outputs: ../../dist/poc-x/art/*.png and art.json (frame sizes, anchors, clock-dial centres).
Run: python art-source/poc-x/process.py (from prototypes/moon-road).
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'dist', 'poc-x', 'art'))
os.makedirs(OUT, exist_ok=True)
manifest = {}


def load(name):
    return np.asarray(Image.open(os.path.join(HERE, name)).convert('RGBA')).astype(np.int16)


def key_magenta(a):
    """Magenta background -> transparent, with de-spill on anti-aliased edges."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magenta = (r - g > 110) & (b - g > 110) & (np.abs(r - b) < 90)
    spill = (r - g > 50) & (b - g > 50) & (np.abs(r - b) < 70) & ~magenta
    out = a.copy()
    out[..., 3] = np.where(magenta, 0, 255)
    # Pull pink fringe toward neutral so edges don't glow magenta in game.
    avg = ((r + b) // 2)
    out[..., 0] = np.where(spill, np.minimum(r, g + (avg - g) // 3), r)
    out[..., 2] = np.where(spill, np.minimum(b, g + (avg - g) // 3), b)
    return out


def cells(a, cols, rows):
    h, w = a.shape[:2]
    for j in range(rows):
        for i in range(cols):
            yield (i, j), a[j * h // rows:(j + 1) * h // rows, i * w // cols:(i + 1) * w // cols]


def main_blob(cell, keep_near=18):
    """Largest opaque component plus pieces touching its box (glows, gears) — drops text labels."""
    mask = cell[..., 3] > 0
    lab, n = ndimage.label(mask)
    if n == 0:
        return None
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    big = int(np.argmax(sizes)) + 1
    ys, xs = np.where(lab == big)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    keep = lab == big
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        if k == big or sizes[k - 1] < 40:
            continue
        ky, kx = sl
        if ky.start <= y1 + keep_near and ky.stop >= y0 - keep_near and kx.start <= x1 + keep_near and kx.stop >= x0 - keep_near:
            keep |= lab == k
    out = cell.copy()
    out[..., 3] = np.where(keep, out[..., 3], 0)
    ys, xs = np.where(out[..., 3] > 0)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def shrink(img, scale):
    w, h = img.shape[1], img.shape[0]
    im = Image.fromarray(img.astype(np.uint8), 'RGBA')
    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    a = np.asarray(im).copy()
    a[..., 3] = np.where(a[..., 3] > 110, 255, 0)  # crisp pixel-art silhouette
    return a


def sheet(name, frames, scale, anchor='bottom', pad=4):
    """Pack frames on a shared canvas, aligned bottom-centre (feet) or centre (flyers)."""
    small = [shrink(f, scale) for f in frames]
    fw = max(f.shape[1] for f in small) + pad * 2
    fh = max(f.shape[0] for f in small) + pad * 2
    canvas = np.zeros((fh, fw * len(small), 4), np.uint8)
    offsets = []
    for i, f in enumerate(small):
        x = i * fw + (fw - f.shape[1]) // 2
        y = fh - pad - f.shape[0] if anchor == 'bottom' else (fh - f.shape[0]) // 2
        canvas[y:y + f.shape[0], x:x + f.shape[1]] = f
        offsets.append((x - i * fw, y))
    Image.fromarray(canvas, 'RGBA').save(os.path.join(OUT, name + '.png'))
    manifest[name] = {'frameWidth': fw, 'frameHeight': fh, 'frames': len(small)}
    return small, offsets, fw, fh


def dial_centres(small, offsets, fw, fh):
    """Centre of the largest cream region (the blank clock dial) in each frame, as fractions of the frame."""
    out = []
    for f, (ox, oy) in zip(small, offsets):
        r, g, b, al = (f[..., k].astype(int) for k in range(4))
        cream = (al > 0) & (r > 200) & (g > 185) & (b > 150) & (r - b < 70)
        lab, n = ndimage.label(cream)
        if n == 0:
            out.append(None)
            continue
        sizes = ndimage.sum(cream, lab, range(1, n + 1))
        k = int(np.argmax(sizes)) + 1
        ys, xs = np.where(lab == k)
        out.append({'x': round((ox + xs.mean()) / fw, 3), 'y': round((oy + ys.mean()) / fh, 3), 'r': round((xs.max() - xs.min()) / 2 / fw, 3)})
    return out


# Enemies: row 1 skeleton (walk A, walk B, attack, hurt); row 2 bat up, bat down, warden idle, warden throw.
en = key_magenta(load('enemies-raw.png'))
grid = {pos: main_blob(c) for pos, c in cells(en, 4, 2)}
sheet('skeleton', [grid[(i, 0)] for i in range(4)], 84 / grid[(0, 0)].shape[0])
sheet('bat', [grid[(0, 1)], grid[(1, 1)]], 78 / grid[(0, 1)].shape[1], anchor='centre')
sheet('twin', [grid[(2, 1)], grid[(3, 1)]], 168 / grid[(2, 1)].shape[0])

# Bosses: row 1 Clockwork Warden idle, windup, slam, hurt; row 2 collapse, Sentinel idle, swing, hurt.
bo = key_magenta(load('bosses-raw.png'))
grid = {pos: main_blob(c) for pos, c in cells(bo, 4, 2)}
small, offs, fw, fh = sheet('clockwarden', [grid[(i, 0)] for i in range(4)] + [grid[(0, 1)]], 250 / grid[(0, 0)].shape[0])
manifest['clockwarden']['dials'] = dial_centres(small, offs, fw, fh)
small, offs, fw, fh = sheet('sentinel', [grid[(1, 1)], grid[(2, 1)], grid[(3, 1)]], 150 / grid[(1, 1)].shape[0], anchor='centre')
manifest['sentinel']['dials'] = dial_centres(small, offs, fw, fh)

# Items: tank, boots, expansion, x5 core / clock shield, shield upgrade, heart, crystal.
it = key_magenta(load('items-raw.png'))
icons = [main_blob(c[: c.shape[0] * 3 // 4]) for _, c in cells(it, 4, 2)]
names = ['tank', 'boots', 'expansion', 'core5', 'shield', 'shieldplus', 'heart', 'crystal']
small = [shrink(i, 44 / max(i.shape[:2])) for i in icons]
size = 48
canvas = np.zeros((size, size * len(small), 4), np.uint8)
for k, f in enumerate(small):
    x, y = k * size + (size - f.shape[1]) // 2, (size - f.shape[0]) // 2
    canvas[y:y + f.shape[0], x:x + f.shape[1]] = f
Image.fromarray(canvas, 'RGBA').save(os.path.join(OUT, 'items.png'))
manifest['items'] = {'frameWidth': size, 'frameHeight': size, 'frames': len(names), 'names': names}

# Backgrounds: 2x2 panels -> 576x324 each (shown at 2x, like the observatory backdrop).
bg = Image.open(os.path.join(HERE, 'backgrounds-raw.png')).convert('RGB')
W, H = bg.size
for (i, j), name in zip([(0, 0), (1, 0), (0, 1), (1, 1)], ['crypt', 'stars', 'vault', 'clock']):
    panel = bg.crop((i * W // 2 + 4, j * H // 2 + 4, (i + 1) * W // 2 - 4, (j + 1) * H // 2 - 4))
    panel.resize((576, 324), Image.LANCZOS).save(os.path.join(OUT, f'bg-{name}.png'))

# Wall textures: 3x2 squares -> 128x128 (sliced into 32 px tile frames in game).
tx = Image.open(os.path.join(HERE, 'textures-raw.png')).convert('RGB')
W, H = tx.size
for k, name in enumerate(['atrium', 'crypt', 'stars', 'vault', 'clock', 'shaft']):
    i, j = k % 3, k // 3
    inset = 10
    sq = tx.crop((i * W // 3 + inset, j * H // 2 + inset, (i + 1) * W // 3 - inset, (j + 1) * H // 2 - inset))
    sq.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, f'tex-{name}.png'))

with open(os.path.join(OUT, 'art.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
with open(os.path.join(OUT, 'art.js'), 'w') as f:
    f.write('// Generated by art-source/poc-x/process.py. Frame sizes, anchors and clock-dial centres.\n')
    f.write('export const ART = ' + json.dumps(manifest) + ';\n')
