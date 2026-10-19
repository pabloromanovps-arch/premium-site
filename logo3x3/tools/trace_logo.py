# /// script
# requires-python = ">=3.10"
# dependencies = ["potracer", "numpy", "pillow", "scipy"]
# ///
"""Trace the supplied logo raster into one SVG path per animatable part -> assets/logo/parts.json.

    uv run showreel/tools/trace_logo.py

Parts are split by radius/angle around the badge centre so each can be extruded and moved alone.
Coordinates are normalised: badge centre at (0, 0), outer radius = 1, y up.
"""
import json
from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/logo/source.jpg"
UP = 4

im = Image.open(SRC).convert("RGB")
im = im.resize((im.width * UP, im.height * UP), Image.LANCZOS)
a = np.asarray(im).astype(np.float32)
# soft gold-ness, blurred a touch so the traced curves come out smooth, then thresholded
goldness = np.clip((a[..., 0] - a[..., 2] - 30) / 60, 0, 1)
g = np.asarray(Image.fromarray((goldness * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(UP * 0.6))) > 127
dark = (a.sum(-1) < 3 * 90) | g
dark = ndimage.binary_fill_holes(ndimage.binary_closing(dark, iterations=3))

ys, xs = np.nonzero(dark)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
R = (xs.max() - xs.min()) / 2
yy, xx = np.mgrid[: g.shape[0], : g.shape[1]]
r = np.hypot(xx - cx, yy - cy) / R
ang = np.degrees(np.arctan2(-(yy - cy), xx - cx))  # 0 = right, 90 = up

S = 342 / 340  # source radii (px at 1x) -> fractions of R
f = lambda px: px / 340
parts = {
    "outerRing": g & (r >= f(312)),
    "innerRing": g & (r >= f(208)) & (r < f(245)),
    "arcs": np.zeros_like(g),
    "doll": g & (r < f(208)) & (yy < cy + f(85) * R),
    "mark3x3": g & (r < f(208)) & (yy >= cy + f(85) * R),
}

# the band between the rings: two long side arcs + one component per letter (animated one by one)
band = g & (r >= f(245)) & (r < f(312))
lab, n = ndimage.label(band)
letters = []
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    m = lab == i
    if m.sum() < 200 * UP * UP / 16:
        continue
    if (sl[0].stop - sl[0].start) > 0.3 * R:
        parts["arcs"] |= m
        continue
    my, mx = ndimage.center_of_mass(m)
    letters.append((float(np.degrees(np.arctan2(-(my - cy), mx - cx))), m))


def trace(mask):
    bm = potrace.Bitmap(~mask)  # potracer traces the False pixels
    path = bm.trace(turdsize=20, alphamax=1.0, opticurve=True, opttolerance=0.2)
    T = lambda p: (round((p.x - cx) / R, 5), round(-(p.y - cy) / R, 5))
    d = []
    for c in path:
        x, y = T(c.start_point)
        d.append(f"M{x} {y}")
        for s in c.segments:
            if s.is_corner:
                (ax, ay), (bx, by) = T(s.c), T(s.end_point)
                d.append(f"L{ax} {ay}L{bx} {by}")
            else:
                (ax, ay), (bx, by), (ex, ey) = T(s.c1), T(s.c2), T(s.end_point)
                d.append(f"C{ax} {ay} {bx} {by} {ex} {ey}")
        d.append("Z")
    return "".join(d)


out = {"gold": "#%02x%02x%02x" % (214, 177, 97), "ink": "#1b1a1f", "discRadius": 1.0,
       "parts": {k: trace(m) for k, m in parts.items()},
       "letters": [{"angle": round(a, 2), "d": trace(m)} for a, m in letters]}
print("letters", len(letters))
(ROOT / "assets/logo/parts.json").write_text(json.dumps(out))
for k, m in parts.items():
    print(f"{k:11s} px={int(m.sum()):8d}  pathlen={len(out['parts'][k])}")
# preview: colour each part
pal = [(230, 80, 80), (80, 200, 90), (80, 120, 240), (240, 200, 60), (200, 80, 220), (60, 210, 220), (250, 140, 40)]
pv = np.zeros(g.shape + (3,), np.uint8)
for (k, m), c in zip(parts.items(), pal):
    pv[m] = c
for j, (a_, m) in enumerate(letters):
    pv[m] = pal[(j % 3) + 3]
Image.fromarray(pv).resize((886, 886)).save(ROOT / "assets/logo/parts_preview.png")
