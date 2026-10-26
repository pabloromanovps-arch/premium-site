"""The eight plate concepts as one PDF (one page each: the hero plate and the trio on top, the hero
large below) and the same stills as PNGs in a zip.
    python3 tehnikum60/tools/concepts_pdf.py <dst dir>
"""
import sys, zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
out, dst = root / "out/tehnikum60", Path(sys.argv[1])
F = root / "tehnikum60/fonts"
CONCEPTS = [  # title, (clip, label) top left, (clip, label) top right, clip below
    ("Стекло", ("jp_hero", "один герой"), ("jp_trio", "трое"), "jp_photo"),
    ("Плакат", ("sa_hero", "один герой"), ("sa_trio", "трое"), "sa_hero"),
    ("Развитие макета дизайнера", ("sc_hero", "один герой"), ("sc_grid", "все вместе"), "sc_hero"),
    ("3D-коллаж", ("sg_hero", "один герой"), ("sg_trio", "трое"), "sg_hero"),
    ("Кино", ("sh_hero", "один герой"), ("sh_trio", "трое"), "sh_hero"),
    ("Карточки героя", ("sk_0", "один герой"), ("sk_3", "вчетвером"), "sk_0"),
    ("Обложка журнала", ("st_hero_navy", "один герой"), ("st_trio_navy", "трое"), "st_hero_navy"),
    ("Аппликация", ("su_hero", "один герой"), ("su_trio", "трое"), "su_hero"),
]
still = lambda c: sorted((out / c).glob("still_*.png"))[-1]
BG, INK, DIM = (18, 36, 74), (255, 255, 255), (150, 165, 190)
title, label = ImageFont.truetype(str(F / "dela.ttf"), 44), ImageFont.truetype(str(F / "mont400.ttf"), 26)
pages = []
dst.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(dst / "VTT60_8_konceptsiy_PNG.zip", "w", zipfile.ZIP_STORED) as z:
    for i, (name, (a, la), (b, lb), big) in enumerate(CONCEPTS, 1):
        pg = Image.new("RGB", (1920, 1260), BG); d = ImageDraw.Draw(pg)
        d.text((60, 40), f"{i}. {name}", font=title, fill=INK)
        for x, (c, l) in [(60, (a, la)), (990, (b, lb))]:
            d.text((x, 122), l, font=label, fill=DIM)
            pg.paste(Image.open(still(c)).convert("RGB").resize((870, 489), Image.LANCZOS), (x, 168))
        pg.paste(Image.open(still(big)).convert("RGB").resize((960, 540), Image.LANCZOS), (480, 700))
        pages.append(pg)
        for tag, c in [("geroy", a), ("troe", b)] + ([("ramka_foto", big)] if big not in (a, b) else []):
            z.write(still(c), f"{i:02d}_{tag}_{c}.png")
pages[0].save(dst / "VTT60_8_konceptsiy.pdf", save_all=True, append_images=pages[1:], resolution=150, quality=92)
print("pdf + zip ->", dst)
