# Shared pixel style for the POC XI hand-built sprites, derived from the accepted generated art
# (dragon, skeleton, bat, Twin Warden, Clockwork Warden, Pendulum Sentinel, Trine Guardian):
#   - one outline colour (the plum-black those sheets use at their edges),
#   - one master palette (median-cut of all of their opaque pixels),
#   - hard pixel edges (no antialiased alpha), colours snapped to the palette.
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
SOURCES = ['dist/poc-xi/art/dragon-orange.png', 'dist/poc-xi/art/skeleton.png', 'dist/poc-xi/art/bat.png', 'dist/poc-xi/art/twin.png',
           'dist/poc-xi/art/clockwarden.png', 'dist/poc-xi/art/sentinel.png', 'dist/assets/guardian.png']
OUTLINE = (26, 8, 26, 255)
PALETTE_SIZE = 48
ACCENTS = [(255, 180, 74), (87, 184, 255), (127, 224, 160), (255, 111, 138), (143, 245, 224), (150, 104, 232), (214, 232, 239), (214, 168, 84)]
_cache = {}


def master_palette():
    if 'pal' in _cache:
        return _cache['pal']
    px = []
    for f in SOURCES:
        a = np.array(Image.open(root / f).convert('RGBA'))
        op = a[..., 3] > 200
        px.append(a[op][::7, :3])
    px = np.concatenate(px)
    side = int(np.ceil(np.sqrt(len(px))))
    img = Image.new('RGB', (side, side))
    img.putdata([tuple(p) for p in px] + [tuple(px[0])] * (side * side - len(px)))
    q = img.quantize(colors=PALETTE_SIZE, method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:PALETTE_SIZE * 3], dtype=np.int32).reshape(-1, 3)
    # accent ramps for the beam colours, shield teal and arcane violet so snapping keeps them vivid
    ramps = []
    for c in ACCENTS:
        c = np.array(c)
        ramps += [(c * 0.45).astype(int), (c * 0.72).astype(int), c, (c + (255 - c) * 0.55).astype(int)]
    pal = np.vstack([pal, [OUTLINE[:3]], [255, 255, 255], np.array(ramps)])
    _cache['pal'] = pal
    return pal


def snap(im, hard_alpha=True, keep_alpha=False):
    """Snap an RGBA image to the master palette. hard_alpha=True turns partial alpha into on/off (crisp edges);
    keep_alpha=True leaves alpha alone (glows, gradients) but still snaps colours."""
    a = np.array(im.convert('RGBA'))
    rgb = a[..., :3].astype(np.int32)
    pal = master_palette()
    d = ((rgb[..., None, :] - pal[None, None, :, :]) ** 2).sum(-1)
    a[..., :3] = pal[d.argmin(-1)].astype(np.uint8)
    if hard_alpha and not keep_alpha:
        a[..., 3] = np.where(a[..., 3] >= 110, 255, 0).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


if __name__ == '__main__':
    pal = master_palette()
    print(len(pal), 'colours;', 'outline', OUTLINE)
