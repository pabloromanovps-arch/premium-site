# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools", "skia-pathops"]
# ///
"""Merge overlapping contours in the display face: three's TextGeometry triangulates each contour
on its own, so overlapping strokes (Ш, Ж, Ы in Montserrat) fill in as solid blocks.

    uv run alpha/tools/fix_font.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps

p = Path(__file__).resolve().parent.parent / "fonts/display.ttf"
f = TTFont(p)
removeOverlaps(f)
f.save(p)
print("overlaps removed ->", p)
