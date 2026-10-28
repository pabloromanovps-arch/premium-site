"""The jubilee logo as one SVG (its parts plus the gear teeth round the 0, which the film draws in code),
in the logo's own teal, for Blender (curves extruded into a solid logo).
    python3 tehnikum60/tools/logo_svg.py
"""
import json, math
from pathlib import Path
here = Path(__file__).resolve().parents[1]
j = json.loads((here / "assets/jubilee/parts.json").read_text())
r = j["ring"]; cx, cy, rout = r["cx"], r["cy"], r["rout"]
depth, n = 0.06, 28
R, hole = rout + depth, rout - 0.006
pts = []
for i in range(n):
    a, s = i / n * 2 * math.pi - math.pi / 2, 2 * math.pi / n
    for aa, rr in [(a - s * .5, R - depth), (a - s * .28, R - depth), (a - s * .18, R), (a + s * .18, R), (a + s * .28, R - depth)]:
        pts.append(f"{cx + math.cos(aa) * rr:.5f} {cy + math.sin(aa) * rr:.5f}")
teeth = "M" + " L".join(pts) + " Z " + f"M{cx + hole:.5f} {cy:.5f} A{hole} {hole} 0 1 0 {cx - hole:.5f} {cy:.5f} A{hole} {hole} 0 1 0 {cx + hole:.5f} {cy:.5f} Z"
w, h = j["size"]
paths = "".join(f'<path id="{k}" d="{d}"/>' for k, d in j["parts"].items())
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * 1000:.0f}" height="{h * 1000:.0f}">'
       f'<g fill="{j["color"]}"><path id="teeth" fill-rule="evenodd" d="{teeth}"/>{paths}</g></svg>')
(here / "assets/jubilee/logo_full.svg").write_text(svg)
print("ok", len(svg))
