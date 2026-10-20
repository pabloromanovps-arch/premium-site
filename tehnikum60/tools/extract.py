# /// script
# requires-python = ">=3.10"
# dependencies = ["pymupdf"]
# ///
"""Pull brandbook pages as SVG (vector shapes of the eight industry symbols) and PNG.
    uv run tools/extract.py <brandbook.pdf>
"""
import sys
from pathlib import Path
import fitz
doc = fitz.open(sys.argv[1])
out = Path(__file__).resolve().parent.parent / "assets/bb"
out.mkdir(parents=True, exist_ok=True)
for p in [1, 17, 30, 32]:
    page = doc[p - 1]
    (out / f"p{p}.svg").write_text(page.get_svg_image(text_as_path=True))
print("ok")
