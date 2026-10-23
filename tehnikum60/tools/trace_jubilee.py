# /// script
# requires-python = ">=3.10"
# dependencies = ["potracer", "numpy", "pillow", "scipy"]
# ///
"""Trace the jubilee logo («Технология успеха: 60 лет в деле») into animatable vector parts.
    uv run tehnikum60/tools/trace_jubilee.py  -> tehnikum60/assets/jubilee/parts.json
Parts: six (the 6 stroke), zero (the ring), top1/top2 (the two heading lines), inner1/inner2 (inside
the ring). Coordinates in source pixels / 1000 (y down), so Path2D draws them at any scale.
"""
import json
from pathlib import Path
import numpy as np
import potrace
from PIL import Image, ImageFilter
from scipy import ndimage

root = Path(__file__).resolve().parent.parent
im = Image.open(root / "assets/jubilee/source.webp").convert("RGB")
UP = 2
im = im.resize((im.width * UP, im.height * UP), Image.LANCZOS)
a = np.asarray(im).astype(np.float32)
# teal-ness, smooth, thresholded at the half-way point between white and the teal
tealness = np.clip(((a[..., 1] - a[..., 0]) - 20) / 90, 0, 1)
m = np.asarray(Image.fromarray((tealness * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))) > 127

# the ring: the white hole inside the 0 is the largest enclosed white region
holes = ndimage.binary_fill_holes(m) & ~m
lab, n = ndimage.label(holes)
sizes = ndimage.sum(holes, lab, range(1, n + 1))
hole = lab == (1 + int(np.argmax(sizes)))
# (the text inside makes an area estimate too small: use the hole's bounding box)
hy, hx = np.nonzero(ndimage.binary_fill_holes(hole))
cx, cy = (hx.min() + hx.max()) / 2, (hy.min() + hy.max()) / 2
rin = (hx.max() - hx.min()) / 2
yy, xx = np.mgrid[: m.shape[0], : m.shape[1]]
d = np.hypot(xx - cx, yy - cy)
# outer radius: the ring's outer edge along +x from the centre
row = m[int(cy), int(cx + rin) + 2:]
rout = rin + 2 + np.argmax(~row)
print(f"ring centre ({cx:.0f},{cy:.0f}) r {rin:.0f}..{rout:.0f}")

big_lab, nb = ndimage.label(m)
bsz = ndimage.sum(m, big_lab, range(1, nb + 1))
big = big_lab == (1 + int(np.argmax(bsz)))          # the 6 and the 0, joined
zero = big & (d <= rout + 3) & (d >= rin - 3)
six = big & ~zero
inside = m & ~big & (d < rin)
top = m & ~big & ~inside
# heading lines split by the gap between them
rows = np.nonzero(top.any(1))[0]
gap = rows[np.argmax(np.diff(rows))]
irows = np.nonzero(inside.any(1))[0]
igap = irows[np.argmax(np.diff(irows))]
parts = {"top1": top & (yy <= gap), "top2": top & (yy > gap), "six": six, "zero": zero,
         "inner1": inside & (yy <= igap), "inner2": inside & (yy > igap)}

def trace(mask):
    bm = potrace.Bitmap(~mask)                         # potracer traces the False pixels
    path = bm.trace(turdsize=30, alphamax=1.0, opticurve=True, opttolerance=0.2)
    T = lambda p: (round(p.x / UP / 1000, 5), round(p.y / UP / 1000, 5))
    out = []
    for c in path:
        x, y = T(c.start_point); out.append(f"M{x} {y}")
        for s in c.segments:
            if s.is_corner:
                (ax, ay), (bx, by) = T(s.c), T(s.end_point); out.append(f"L{ax} {ay}L{bx} {by}")
            else:
                (ax, ay), (bx, by), (ex, ey) = T(s.c1), T(s.c2), T(s.end_point)
                out.append(f"C{ax} {ay} {bx} {by} {ex} {ey}")
        out.append("Z")
    return "".join(out)

res = {"size": [im.width / UP / 1000, im.height / UP / 1000], "color": "#078C95",
       "ring": {"cx": cx / UP / 1000, "cy": cy / UP / 1000, "rin": rin / UP / 1000, "rout": rout / UP / 1000},
       "parts": {k: trace(v) for k, v in parts.items()}}
for k, v in parts.items():
    ys, xs = np.nonzero(v); print(k, int(v.sum()), xs.min() // UP, xs.max() // UP, ys.min() // UP, ys.max() // UP)
(root / "assets/jubilee/parts.json").write_text(json.dumps(res))
