import sys, glob
from PIL import Image
import numpy as np
bad = []
for f in sorted(glob.glob(sys.argv[1] + "/*.jp*g")):
    a = np.array(Image.open(f).convert("RGB")).astype(int)
    orange = ((a[:, :, 0] > 200) & (a[:, :, 1] > 90) & (a[:, :, 1] < 170) & (a[:, :, 2] < 90)).sum()
    if orange < int(sys.argv[2]): bad.append((f.split("/")[-1], int(orange)))
print("frames", len(glob.glob(sys.argv[1] + "/*.jp*g")), "blank", bad)
