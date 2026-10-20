"""Pack ГРАФИКА/ into one zip per folder with Latin-only names (Windows Explorer / WinRAR safe).

    python3 alpha/tools/pack.py
Writes GRAFIKA_zip/<NN_NAME>.zip; files are stored (ProRes doesn't compress), names transliterated.
"""
import zipfile
from pathlib import Path

T = dict(zip("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ", ["A","B","V","G","D","E","E","ZH","Z","I","Y","K","L","M","N","O","P","R","S","T","U","F","KH","TS","CH","SH","SCH","","Y","","E","YU","YA"]))
lat = lambda s: "".join(T.get(c.upper(), c) for c in s).replace(",", "_").replace(" ", "_")

root = Path(__file__).resolve().parents[2]
src, out = root / "ГРАФИКА", root / "GRAFIKA_zip"
out.mkdir(exist_ok=True)
readme = src / "ПРОЧТИ.txt"
for d in sorted(p for p in src.iterdir() if p.is_dir() and p.name[:2].isdigit() and not p.name.startswith("99")):
    zp = out / f"{lat(d.name)}.zip"
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_STORED) as z:
        z.write(readme, f"{lat(d.name)}/README.txt")
        for f in sorted(d.rglob("*")):
            if f.is_file():
                z.write(f, "/".join(lat(p) for p in f.relative_to(src).parts))
    print(zp.name, round(zp.stat().st_size / 2**20), "MB")
