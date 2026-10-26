"""Pack the client's round of edits: every re-rendered clip into VTT60_GRAFIKA_PRAVKI/ in four forms
(ProRes 4444 premultiplied .mov, VP9 alpha .webm, straight-alpha PNG sequence .zip, preview .mp4),
and refresh the same clips in VTT60_GRAFIKA/<group>/ (old names kept where the content kept its name).
    python3 tehnikum60/tools/pack_pravki.py
"""
import shutil, subprocess, zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = root / "out/tehnikum60"
dst = root / "VTT60_GRAFIKA_PRAVKI"
CLIPS = {  # clip: (group in VTT60_GRAFIKA, file name, old file name it replaces or None)
    "zastavka": ("01_ZASTAVKA_I_FINAL", "01_ZASTAVKA_Tekhnologii_i_traditsii", None),
    "final": ("01_ZASTAVKA_I_FINAL", "02_FINAL_Istoriya_prodolzhaetsya", None),
    "date1966": ("03_DATY", "02_DATA_1966", None),
    "chart": ("04_INFOGRAFIKA", "01_DIAGRAMMA_trudoustroystvo_2023-2025", None),
    "stat85": ("04_INFOGRAFIKA", "85_protsentov_Dorogobuzhskiy_okrug", None),
    "prof7": ("05_SPETSIALNOSTI", "07_Svarshchik", None),
    "name_misha": ("06_PLASHKI_LYUDI", "01_Mikhail_Bogatyrevich", "01_Misha"),
    "name_papa": ("06_PLASHKI_LYUDI", "03_Papa_Bogatyrevich_Aleksandr", None),
    "propusk": ("06_PLASHKI_LYUDI", "09_Beydzh_Mikhail_Bogatyrevich", "09_Propusk_Mikhail_Nikolaevich"),
    "name_babushka": ("06_PLASHKI_LYUDI", "10_Babushka_Stifeeva_Nina", None),
    "name_dedushka": ("06_PLASHKI_LYUDI", "11_Dedushka_Stifeev_Aleksandr", None),
}
run = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
if dst.exists(): shutil.rmtree(dst)
for clip, (group, name, old) in CLIPS.items():
    d = dst / group; d.mkdir(parents=True, exist_ok=True)
    frames = out / clip / "frames"
    shutil.copy2(out / f"{clip}.mov", d / f"{name}.mov")
    run("-framerate", "50", "-i", str(frames / "f_%05d.png"), "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
        "-b:v", "8M", "-auto-alt-ref", "0", "-row-mt", "1", str(d / f"{name}.webm"))
    with zipfile.ZipFile(d / f"{name}_PNG.zip", "w", zipfile.ZIP_STORED) as z:
        for f in sorted(frames.glob("*.png")): z.write(f, f"{name}/{f.name}")
    (d / "PREVYU").mkdir(exist_ok=True)
    shutil.copy2(out / f"{clip}_preview.mp4", d / "PREVYU" / f"{name}.mp4")
    # refresh the main delivery folder
    g = root / "VTT60_GRAFIKA" / group
    if old:
        for f in [g / f"{old}.mov", g / "PREVYU" / f"{old}.mp4"]: f.unlink(missing_ok=True)
    shutil.copy2(out / f"{clip}.mov", g / f"{name}.mov")
    shutil.copy2(out / f"{clip}_preview.mp4", g / "PREVYU" / f"{name}.mp4")
    print("packed", clip, "->", group, name)
