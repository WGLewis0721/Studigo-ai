# Builds a 4-frame Clockwork Warden walk cycle by rigging the existing standing frame (frame 0 of
# dist/poc-xi/art/clockwarden.png): legs, arms and torso are cut apart and re-posed (stomping legs lift and swing,
# arms swing out, torso bobs and sways). Output: dist/poc-xi/art/clockwarden-walk.png (4 x 291 x 298) and the
# per-frame clock-dial positions in art-source/poc-xi/warden-walk.json (merged into art.js by this script).
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
W, H = 291, 298
sheet = Image.open(root / 'dist/poc-xi/art/clockwarden.png').convert('RGBA')
base = sheet.crop((0, 0, W, H))
hand_painted = 0


def region(poly):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m


# masks (pixel coords in the standing frame)
PENDULUM = region([(141, 205), (169, 205), (169, 264), (141, 264)])  # hangs from the pelvis: stays with the torso
LEG_L = region([(108, 205), (153, 205), (153, 298), (80, 298), (80, 263), (108, 263)])  # fist overlaps the thigh above y262
LEG_R = region([(168, 205), (196, 205), (196, 263), (236, 263), (236, 298), (168, 298)])
ARM_L = region([(30, 150), (106, 150), (106, 262), (30, 262)])
ARM_R = region([(198, 150), (256, 150), (256, 262), (198, 262)])
from PIL import ImageChops
LEG_L = ImageChops.subtract(LEG_L, PENDULUM)
LEG_R = ImageChops.subtract(LEG_R, PENDULUM)


def cut(mask):
    part = Image.new('RGBA', (W, H))
    part.paste(base, (0, 0), mask)
    return part


def without(*masks):
    img = base.copy()
    for m in masks:
        clear = Image.new('RGBA', (W, H))
        img.paste(clear, (0, 0), m)
    return img


leg_l, leg_r, arm_l, arm_r = cut(LEG_L), cut(LEG_R), cut(ARM_L), cut(ARM_R)
torso = without(LEG_L, LEG_R, ARM_L, ARM_R)


def pose(part, pivot, angle=0, dx=0, dy=0):
    if angle:
        part = part.rotate(angle, resample=Image.Resampling.NEAREST, center=pivot)
    out = Image.new('RGBA', (W, H))
    out.alpha_composite(part, (round(dx), round(dy)))
    return out


# (left-leg lift, left-leg swing, right-leg lift, right-leg swing, body dy, body dx, arm swing deg)
CYCLE = [
    dict(ll=(14, 3), lr=(0, 0), by=-4, bx=-3, al=-7, ar=5),   # left foot lifted
    dict(ll=(0, 0), lr=(0, 0), by=3, bx=0, al=0, ar=0),        # footfall, body drops
    dict(ll=(0, 0), lr=(14, -3), by=-4, bx=3, al=5, ar=-7),    # right foot lifted
    dict(ll=(0, 0), lr=(0, 0), by=3, bx=0, al=0, ar=0),        # footfall
]
def despeckle(img, min_area=120):
    # Drop stray fragments left by the cut lines: connected pieces of fewer than min_area opaque pixels.
    import numpy as np
    a = np.array(img)
    opaque = a[..., 3] > 0
    seen = np.zeros(opaque.shape, bool)
    for y0, x0 in zip(*np.nonzero(opaque)):
        if seen[y0, x0]:
            continue
        stack, comp = [(y0, x0)], []
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < opaque.shape[0] and 0 <= nx < opaque.shape[1] and opaque[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if len(comp) < min_area:
            for y, x in comp:
                a[y, x, 3] = 0
    return Image.fromarray(a, 'RGBA')


frames = []
for c in CYCLE:
    f = Image.new('RGBA', (W, H))
    f.alpha_composite(pose(leg_l, (126, 205), c['ll'][1], 0, -c['ll'][0]))
    f.alpha_composite(pose(leg_r, (190, 205), c['lr'][1], 0, -c['lr'][0]))
    f.alpha_composite(pose(torso, (150, 205), 0, c['bx'], c['by']))
    f.alpha_composite(pose(arm_l, (80, 150), c['al'], c['bx'], c['by']))
    f.alpha_composite(pose(arm_r, (225, 150), c['ar'], c['bx'], c['by']))
    frames.append(despeckle(f))

out = Image.new('RGBA', (W * 4, H))
for i, f in enumerate(frames):
    out.paste(f, (i * W, 0))
out.save(root / 'dist/poc-xi/art/clockwarden-walk.png', optimize=True)

# clock dial per frame = standing dial shifted with the torso
art_path = root / 'dist/poc-xi/art/art.js'
txt = art_path.read_text(encoding='utf-8')
m = re.search(r'export const ART = (\{.*\});', txt, re.S)
art = json.loads(m.group(1))
d0 = art['clockwarden']['dials'][0]
art['clockwardenWalk'] = {
    'frameWidth': W, 'frameHeight': H, 'frames': 4,
    'dials': [{'x': round(d0['x'] + c['bx'] / W, 3), 'y': round(d0['y'] + c['by'] / H, 3), 'r': d0['r']} for c in CYCLE],
}
art_path.write_text(txt[:m.start()] + 'export const ART = ' + json.dumps(art) + ';' + txt[m.end():], encoding='utf-8')
print('walk sheet', out.size)

preview = Image.new('RGBA', out.size, (40, 50, 70, 255))
preview.alpha_composite(out)
preview.save(root / 'art-source/poc-xi/warden-walk-preview.png')
