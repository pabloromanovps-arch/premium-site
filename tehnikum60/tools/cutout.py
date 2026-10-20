# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "scipy"]
# ///
"""Cut the VTT logo out of its white background -> assets/logo_vtt.png (RGBA, 2x).
White touching the border and small enclosed white (letter counters) become transparent; the
book's large white pages stay. Edges get a soft matte from how white each border pixel is, with the white unmixed from it.
    uv run tools/cutout.py
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

root = Path(__file__).resolve().parent.parent
im = Image.open(root / "assets/logo_source.jpg").convert("RGB")
im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
a = np.asarray(im).astype(np.float32) / 255
white = a.min(-1)                                    # 1 = white
bg = white > 0.93
lab, _ = ndimage.label(bg)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
# white that touches the border is background; enclosed white is background too when small (letter
# counters), and stays white when large (the open book's pages)
sizes = ndimage.sum(np.ones_like(bg), lab, index=np.arange(lab.max() + 1))
# ...except white lettering knocked out of the grey gear (СОГБПОУ): it is white on purpose
sl = ndimage.find_objects(lab)
small = []
for i in np.nonzero(sizes < 9000)[0]:
    if i == 0 or sl[i - 1] is None: continue
    y, x = sl[i - 1]
    y = slice(max(0, y.start - 4), y.stop + 4); x = slice(max(0, x.start - 4), x.stop + 4)
    m = lab[y, x] == i
    ring = ndimage.binary_dilation(m, iterations=3) & ~m & ~bg[y, x]
    c = a[y, x][ring]
    grey = len(c) and (c.max(-1) - c.min(-1)).mean() < 0.08 and c.mean() > 0.55
    if not grey: small.append(i)
outside = np.isin(lab, list(edge)) | np.isin(lab, small)
# matte: inside = 1; a 3 px band around the outside gets alpha from its distance to white
band = ndimage.binary_dilation(outside, iterations=3) & ~outside
alpha = np.where(outside, 0.0, 1.0)
alpha[band] = np.clip((1 - white[band]) / (1 - 0.6), 0, 1)
# unmix white from the edge colour: c = a*fg + (1-a)*1  ->  fg = (c - (1-a)) / a
fg = a.copy()
m = (alpha > 0.02) & (alpha < 1)
fg[m] = np.clip((a[m] - (1 - alpha[m])[:, None]) / alpha[m][:, None], 0, 1)
fg[alpha <= 0.02] = 0
out = np.dstack([fg, alpha])
Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA").save(root / "assets/logo_vtt.png")
ys, xs = np.nonzero(alpha > 0.5)
print("bbox", xs.min(), xs.max(), ys.min(), ys.max(), "of", im.size)
