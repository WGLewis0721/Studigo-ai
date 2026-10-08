import sys, glob
from PIL import Image, ImageDraw
d, a, b, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
fs = sorted(glob.glob(f"{d}/f_*.jpg"))[a:b]
W, H = 480, 270; cols = 6; rows = (len(fs) + cols - 1) // cols
sh = Image.new("RGB", (W * cols, H * rows), "white")
for i, f in enumerate(fs):
    im = Image.open(f).resize((W, H)); dr = ImageDraw.Draw(im); dr.rectangle((0, 0, 60, 20), fill=(255, 255, 255)); dr.text((6, 4), f"{(a + i) / 2:.1f}s", fill=(255, 0, 0)); sh.paste(im, ((i % cols) * W, (i // cols) * H))
sh.save(out, quality=86)
