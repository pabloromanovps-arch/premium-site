# /// script
# requires-python = ">=3.10"
# dependencies = ["svgpathtools"]
# ///
"""The eight industry symbols of the brandbook (page 1 footer row), as normalised SVG paths.
    uv run tools/symbols.py   -> assets/symbols.json  {name: {color, d}}  (d fits a 1x1 box, y down)
"""
import json, re
from pathlib import Path
from svgpathtools import parse_path

root = Path(__file__).resolve().parent.parent
s = (root / "assets/bb/p1.svg").read_text()
NAMES = {"00a1d4": "plane", "39bb95": "leaf", "f47920": "drop", "436990": "gear",
         "a6adb8": "mountains", "ef4323": "rail", "0e5fa2": "atom", "297de0": "ship"}
COLORS = {"plane": "#00A1D3", "leaf": "#3CBA94", "drop": "#F47920", "gear": "#43688F",
          "mountains": "#A5ADB7", "rail": "#EF4323", "atom": "#025EA1", "ship": "#2A7DE1"}
paths = {}
for m in re.finditer(r'<path ([^>]*)/>', s):
    a = m.group(1)
    f = re.search(r'fill="#([0-9a-f]{6})"', a)
    t = re.search(r'transform="matrix\(([^)]*)\)"', a)
    d = re.search(r' d="([^"]*)"', a)
    if not (f and t and d) or f.group(1) not in NAMES: continue
    A, B, C, D, E, F = map(float, t.group(1).split(","))
    if F < 300: continue                      # the footer row only (y ~ 400)
    p = parse_path(d.group(1))
    p = p.scaled(1)  # copy
    # apply the affine matrix to every point
    def tf(z): return complex(A * z.real + C * z.imag + E, B * z.real + D * z.imag + F)
    from svgpathtools import Line, CubicBezier, QuadraticBezier, Path as SP
    segs = []
    for sg in p:
        if isinstance(sg, Line): segs.append(Line(tf(sg.start), tf(sg.end)))
        elif isinstance(sg, CubicBezier): segs.append(CubicBezier(*map(tf, (sg.start, sg.control1, sg.control2, sg.end))))
        elif isinstance(sg, QuadraticBezier): segs.append(QuadraticBezier(*map(tf, (sg.start, sg.control, sg.end))))
    paths.setdefault(NAMES[f.group(1)], []).append(SP(*segs))
out = {}
for name, ps in paths.items():
    xs = [b for p in ps for b in p.bbox()[:2]]; ys = [b for p in ps for b in p.bbox()[2:]]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    k = 1 / max(x1 - x0, y1 - y0); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ds = [p.translated(complex(-cx, -cy)).scaled(k).translated(complex(.5, .5)).d() for p in ps]
    out[name] = {"color": COLORS[name], "d": " ".join(ds), "parts": len(ps), "aspect": round((x1 - x0) / (y1 - y0), 3)}
    print(name, len(ps), out[name]["aspect"])
(root / "assets/symbols.json").write_text(json.dumps(out))
