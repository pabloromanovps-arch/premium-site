"""Pack the rendered VTT 60 graphics into VTT60_GRAFIKA/<group>/ and one zip per group (Latin names,
so Windows Explorer and WinRAR open them cleanly; each zip stays under the 400 MB upload limit).
    python3 tehnikum60/tools/pack.py
"""
import shutil, zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
src = root / "out/tehnikum60/pm"   # the premultiplied versions
prev = root / "out/tehnikum60"
dst = root / "VTT60_GRAFIKA"
GROUPS = {
    "01_ZASTAVKA_I_FINAL": {"zastavka": "01_ZASTAVKA_Tekhnologii_i_traditsii", "final": "02_FINAL_Istoriya_prodolzhaetsya"},
    "02_FONY_I_PEREKHOD": {"fon_light": "FON_svetlyy_10s_loop", "fon_blue": "FON_siniy_10s_loop", "fon_dark": "FON_temnyy_10s_loop",
                           "perehod": "PEREKHOD_polosy"},
    "03_DATY": {f"date{y}": f"DATA_{y}" for y in (1965, 1966, 1967, 2008, 2024, 2025)},
    "04_INFOGRAFIKA": {"chart": "DIAGRAMMA_trudoustroystvo_2023-2025", "invest": "100_mln_rubley",
                       "stat18000": "18000_spetsialistov", "stat85": "85_protsentov_Dorogobuzhskiy_okrug"},
    "05_SPETSIALNOSTI": {f"prof{i}": n for i, n in enumerate(["Khim_tekhnologiya_neorganicheskikh", "Khim_tekhnologiya_soedineniy",
        "Povarskoe_i_konditerskoe", "Stroitelstvo_i_ekspluatatsiya", "Montazh_i_remont_oborudovaniya",
        "Remont_avtotransporta", "Svarshchik"], 1)},
    "06_PLASHKI_LYUDI": {"name_misha": "Misha", "name_mama": "Mama_Bogatyrevich_Olga", "name_papa": "Papa_Bogatyrevich_Aleksandr",
                         "name_polina": "Polina_Chukaeva", "name_svetlana": "Svetlana_Prokhvataeva",
                         "name_lyudmila": "Lyudmila_Khitretsova", "name_ivan": "Ivan_Timoshkin",
                         "name_vypusknoy": "Vypusknoy_30_iyunya_2026", "propusk": "Propusk_Mikhail_Nikolaevich"},
}
README = """VTT 60 — grafika v stile «Professionalitet» / графика в стиле «Профессионалитет»

Все .mov — ProRes 4444 XQ с альфа-каналом (прозрачный фон), 1920x1080, 50 fps.
Альфа PREMULTIPLIED: если программа спрашивает, ставьте «Premultiplied» (Premiere: Interpret
Footage -> Alpha Channel -> Premultiplied; DaVinci: Clip Attributes -> Alpha Mode -> Premultiplied).
Кладите поверх любого видео. Фоны (02_FONY) — непрозрачные подложки на весь экран,
10 секунд, бесшовный цикл: растягивайте повтором на нужную длину.
Последний кадр каждого титра держится — можно продлить стоп-кадром.
Папка PREVYU — те же ролики в mp4 на тёмном фоне, только для просмотра.
"""
if dst.exists(): shutil.rmtree(dst)
zips = dst / "_ZIP"; zips.mkdir(parents=True)
for g, items in GROUPS.items():
    (dst / g / "PREVYU").mkdir(parents=True)
    (dst / g / "README.txt").write_text(README, encoding="utf-8")
    for clip, name in items.items():
        num = list(items).index(clip) + 1
        n = name if name[:2].isdigit() else f"{num:02d}_{name}"
        shutil.copy2(src / f"{clip}.mov", dst / g / f"{n}.mov")
        shutil.copy2(prev / f"{clip}_preview.mp4", dst / g / "PREVYU" / f"{n}.mp4")
    # zips stay under the 400 MB upload limit: a big group is split into parts
    files = sorted(f for f in (dst / g).rglob("*") if f.is_file())
    parts, cur, size = [], [], 0
    for f in files:
        n = f.stat().st_size
        if cur and size + n > 380 * 2**20: parts.append(cur); cur, size = [], 0
        cur.append(f); size += n
    parts.append(cur)
    for k, part in enumerate(parts, 1):
        zp = zips / (f"{g}.zip" if len(parts) == 1 else f"{g}_chast{k}.zip")
        with zipfile.ZipFile(zp, "w", zipfile.ZIP_STORED) as z:
            for f in part: z.write(f, f.relative_to(dst).as_posix())
        print(zp.name, round(zp.stat().st_size / 2**20), "MB")
