# /// script
# requires-python = ">=3.10"
# dependencies = ["pymupdf"]
# ///
"""Pull the brandbook's vector pages as SVG (for the eight industry symbols) and a few pages as PNG.
    uv run tools/extract.py <brandbook.pdf>
"""
import sys
from pathlib import Path
import fitz
doc = fitz.open(sys.argv[1])
out = Path(__file__).resolve().parent.parent / "assets/bb"
out.mkdir(parents=True, exist_ok=True)
for p in [1, 7, 17, 30, 53]:
    page = doc[p - 1]
    (out / f"p{p}.svg").write_text(page.get_svg_image(text_as_path=True))
    page.get_pixmap(dpi=110).save(out / f"p{p}.png")
print("ok", out)
