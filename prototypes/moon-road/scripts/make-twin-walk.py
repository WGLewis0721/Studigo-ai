# Twin Warden walk cycle, rigged from its idle frame (frame 0 of dist/poc-xi/art/twin.png): legs lift and plant,
# body bobs, the lantern arm swings. Output dist/poc-xi/art/twin-walk.png (4 x 179 x 176) and ART.twinWalk in art.js.
import json
import re
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

root = Path(__file__).resolve().parents[1]
W, H = 179, 176
base = Image.open(root / 'dist/poc-xi/art/twin.png').convert('RGBA').crop((0, 0, W, H))


def region(poly):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m


LEG_L = region([(46, 128), (84, 128), (84, H), (46, H)])
LEG_R = region([(104, 128), (144, 128), (144, H), (104, H)])
ARM = region([(128, 50), (176, 50), (176, 118), (128, 118)])


def cut(mask):
    part = Image.new('RGBA', (W, H))
    part.paste(base, (0, 0), mask)
    return part


torso = base.copy()
for m in (LEG_L, LEG_R, ARM):
    torso.paste(Image.new('RGBA', (W, H)), (0, 0), m)
leg_l, leg_r, arm = cut(LEG_L), cut(LEG_R), cut(ARM)


def pose(part, pivot, angle=0, dx=0, dy=0):
    if angle:
        part = part.rotate(angle, resample=Image.Resampling.NEAREST, center=pivot)
    out = Image.new('RGBA', (W, H))
    out.alpha_composite(part, (round(dx), round(dy)))
    return out


CYCLE = [
    dict(ll=(9, 3), lr=(0, 0), by=-3, bx=-2, arm=-8),
    dict(ll=(0, 0), lr=(0, 0), by=2, bx=0, arm=0),
    dict(ll=(0, 0), lr=(9, -3), by=-3, bx=2, arm=8),
    dict(ll=(0, 0), lr=(0, 0), by=2, bx=0, arm=0),
]
frames = []
for c in CYCLE:
    f = Image.new('RGBA', (W, H))
    f.alpha_composite(pose(leg_l, (65, 128), c['ll'][1], 0, -c['ll'][0]))
    f.alpha_composite(pose(leg_r, (124, 128), c['lr'][1], 0, -c['lr'][0]))
    f.alpha_composite(pose(torso, (90, 128), 0, c['bx'], c['by']))
    f.alpha_composite(pose(arm, (128, 60), c['arm'], c['bx'], c['by']))
    frames.append(f)
sheet = Image.new('RGBA', (W * 4, H))
for i, f in enumerate(frames):
    sheet.paste(f, (i * W, 0))
sheet.save(root / 'dist/poc-xi/art/twin-walk.png', optimize=True)

art_path = root / 'dist/poc-xi/art/art.js'
txt = art_path.read_text(encoding='utf-8')
m = re.search(r'export const ART = (\{.*\});', txt, re.S)
art = json.loads(m.group(1))
art['twinWalk'] = {'frameWidth': W, 'frameHeight': H, 'frames': 4}
art_path.write_text(txt[:m.start()] + 'export const ART = ' + json.dumps(art) + ';' + txt[m.end():], encoding='utf-8')
prev = Image.new('RGBA', sheet.size, (40, 50, 70, 255)); prev.alpha_composite(sheet)
prev.save(root / 'art-source/poc-xi/twin-walk-preview.png')
print('twin walk', sheet.size)
