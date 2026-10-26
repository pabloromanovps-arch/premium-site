"""Everything for VTT 60 in one place, after the client's round-2 icons: builds VTT60_VSE/ (one tree)
and VTT60_VSE_ZIP/ (the same tree cut into zips under 380 MB; unpack them all into one folder and
the tree comes back whole). Latest version of every graphic only.
    python3 tehnikum60/tools/pack_all.py [--skip-video]
"""
import shutil, subprocess, sys, zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = root / "out/tehnikum60"
dst, zdst = root / "VTT60_VSE", root / "VTT60_VSE_ZIP"
G, Z, ALFA = root / "VTT60_GRAFIKA", root / "VTT60_ZASTAVKA", root / "VTT60_ALFA"
SKIP_VIDEO = "--skip-video" in sys.argv
# the master title and the plate concepts were not redone with the new icons: only on request
WITH_MASTER, WITH_CONCEPTS = "--with-master" in sys.argv, "--with-concepts" in sys.argv
ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
def put(src, rel):
    f = dst / rel; f.parent.mkdir(parents=True, exist_ok=True)
    if f.exists(): f.unlink()
    try: f.hardlink_to(src)          # the disk is tight: the tree shares the files it collects
    except OSError: shutil.copy2(src, f)
    return f

if dst.exists(): shutil.rmtree(dst)
if zdst.exists(): shutil.rmtree(zdst)

# ---------------------------------------------------------------- 01 film graphics
F1 = "01_GRAFIKA_FILMA"
REDONE = {"05_SPETSIALNOSTI": {f"prof{i}": n for i, n in enumerate(["01_Khim_tekhnologiya_neorganicheskikh", "02_Khim_tekhnologiya_soedineniy",
              "03_Povarskoe_i_konditerskoe", "04_Stroitelstvo_i_ekspluatatsiya", "05_Montazh_i_remont_oborudovaniya",
              "06_Remont_avtotransporta", "07_Svarshchik"], 1)},
          "06_PLASHKI_LYUDI": {"propusk": "09_Beydzh_Mikhail_Bogatyrevich"}}
webm_cache = out / "vse_webm"; webm_cache.mkdir(exist_ok=True)
for g in sorted(p for p in G.iterdir() if p.is_dir() and p.name[:2].isdigit()):
    redone = {v: k for k, v in REDONE.get(g.name, {}).items()}
    put(g / "README.txt", f"{F1}/{g.name}/README.txt")
    for mov in sorted(g.glob("*.mov")):
        n = mov.stem
        if n in redone:
            src, prev = out / f"{redone[n]}.mov", out / f"{redone[n]}_preview.mp4"
        else:
            # the alpha-fixed re-deliveries (VTT60_ALFA, named <group no>_<file>) win where they are newer
            a = ALFA / f"{g.name[:2]}_{n}.mov"
            src = a if a.exists() and a.stat().st_mtime > mov.stat().st_mtime else mov
            prev = g / "PREVYU" / f"{n}.mp4"
        put(src, f"{F1}/{g.name}/{n}.mov"); put(prev, f"{F1}/{g.name}/PREVYU/{n}.mp4")
        # a VP9 webm with alpha for Windows players and editors without ProRes (straight alpha)
        w = webm_cache / f"{g.name}__{n}.webm"
        if not SKIP_VIDEO and (not w.exists() or w.stat().st_mtime < src.stat().st_mtime):
            ff("-i", str(src), "-vf", "unpremultiply=inplace=1,format=yuva420p", "-c:v", "libvpx-vp9", "-b:v", "8M",
               "-auto-alt-ref", "0", "-row-mt", "1", str(w))
        if w.exists(): put(w, f"{F1}/{g.name}/WEBM/{n}.webm")

# ---------------------------------------------------------------- 02 master title
F2 = "02_MASTER_ZASTAVKA"
if WITH_MASTER:
  M = dst / F2 / "MASTER_LUP"; M.mkdir(parents=True)
  fon, intro, logo = out / "jm_fon/frames/f_%05d.png", out / "jm_intro/frames/f_%05d.png", out / "jm_logo/frames/f_%05d.png"
  mcache = out / "vse_master"; mcache.mkdir(exist_ok=True)
  x264 = lambda crf: ["-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
  PR = {"ProRes422HQ": "3", "ProRes422": "2", "ProRes422LT": "1"}
  if not SKIP_VIDEO:
      # the master: the fluted glass with the logo over it (the logo is straight-alpha PNG frames)
      ff("-framerate", "50", "-i", str(fon), "-framerate", "50", "-i", str(logo), "-filter_complex", "[0][1]overlay=format=auto,format=rgb24",
         "-c:v", "png", str(mcache / "master_frames.mov"))
      for name, src in [("FON_10s_lup", ["-framerate", "50", "-i", str(fon)]), ("MASTER_10s_lup", ["-i", str(mcache / "master_frames.mov")]),
                        ("INTRO_5s", ["-framerate", "50", "-i", str(intro)])]:
          for tag, p in PR.items():
              if name != "INTRO_5s" and tag == "ProRes422HQ": continue   # 480 MB: over the upload limit, the 422 is plenty
              ff(*src, "-c:v", "prores_ks", "-profile:v", p, "-pix_fmt", "yuv422p10le", "-vendor", "apl0", str(mcache / f"{name}_{tag}.mov"))
          ff(*src, *x264(8), str(mcache / f"{name}_MAX.mp4"))
          ff(*src, *x264(18), str(mcache / f"{name}.mp4"))
      for name in ["FON", "MASTER"]:
          ff("-stream_loop", "11", "-i", str(mcache / f"{name}_10s_lup_MAX.mp4"), "-c", "copy", str(mcache / f"{name}_2min.mp4"))
      # the whole title as it plays: intro, then the loop
      lst = mcache / "seq.txt"
      for k, n in [("15s_MAX", 1), ("2min", 12)]:
          lst.write_text("".join(f"file '{f}'\n" for f in [mcache / "INTRO_5s_MAX.mp4"] + [mcache / "MASTER_10s_lup_MAX.mp4"] * n))
          ff("-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(mcache / f"ZASTAVKA_intro_plus_lup_{k}.mp4"))
  for f in sorted(mcache.glob("*.m*")):
      if f.name != "master_frames.mov": put(f, f"{F2}/MASTER_LUP/{f.name}")
  for f in sorted((Z / "MASTER_LUP").glob("LOGO_60_master_*")): put(f, f"{F2}/LOGO_60_alfa/{f.name}")
  S2 = f"{F2}/STILY"
  for src, n in [(out / "jm_fon/frames/f_00200.png", "01_Riflenoe_steklo_3D_znachki.png"), (out / "jm_fon_mat/still_4.00.png", "03_Matovoe_steklo.png")]:
      put(src, f"{F2}/FONY_STILY/{n}")
  for n in ["02_Riflenoe_steklo_bez_znachkov.png", "04_3D_simvoly_brendbuka.png", "05_Biryuzovyy_shesterni.png", "06_Temno-siniy_shesterni.png",
            "07_Svetlyy_shesterni.png", "08_Professionalitet_yarkiy.png"]:
      put(Z / "FONY_MASTER_STILY" / n, f"{F2}/FONY_STILY/{n}")
  for t in ["1.50", "4.00", "7.00"]:
      put(out / f"jmaster_reeded/still_{t}.png", f"{S2}/MASTER_riflenoe_steklo_{t}s.png")
      put(out / f"jmaster/still_{t}.png", f"{S2}/MASTER_matovoe_steklo_{t}s.png")
  put(out / "jm_intro/frames/f_00100.png", f"{S2}/INTRO_logo_iz_glubiny_2s.png")
  put(out / "jm_icons/still_0.00.png", f"{S2}/3D_znachki_specialnostey.png")

# ---------------------------------------------------------------- 03 icons
F3, V2, V1 = "02_IKONKI", root / "VTT60_IKONKI_v2", root / "VTT60_IKONKI"
for f in sorted(V2.rglob("*.*")): put(f, f"{F3}/SPETSIALNOSTI_VTT/{f.relative_to(V2)}")
for f in sorted((V1 / "OTRASLI_Professionalitet").iterdir()): put(f, f"{F3}/OTRASLI_Professionalitet/{f.name}")
for f in sorted((V1 / "3D").glob("Otrasl_*")): put(f, f"{F3}/OTRASLI_Professionalitet/3D_4K/{f.name}")
(dst / F3 / "README.txt").write_text("""VTT 60 — иконки для анимации, все на прозрачном фоне (альфа)

SPETSIALNOSTI_VTT/   7 специальностей техникума — новый набор (согласован заказчиком)
  VEKTOR_SVG/   вектор: Illustrator / After Effects, масштабируется без потерь
  PNG_4096/     4096 x 4096 px
     *_cvet — в фирменном цвете, *_belyy — белые, *_temnyy — тёмные
  3D_4K/        объёмные, 4096 x 4096 px, три ракурса: anfas, povorot_vlevo, povorot_vpravo
  00_OBZOR_*    обзорные листы

  01 Химическая технология неорганических веществ — колба
  02 Химическая технология производства химических соединений — пробирки в штативе
  03 Поварское и кондитерское дело — поварской колпак
  04 Строительство и эксплуатация зданий и сооружений — башенный кран
  05 Монтаж, ТО и ремонт промышленного оборудования — шестерня с ключом
  06 ТО и ремонт автотранспортных средств — руль
  07 Сварщик — держатель с электродом

OTRASLI_Professionalitet/   8 символов отраслей из брендбука «Профессионалитет» (без изменений)
""", encoding="utf-8")

# ---------------------------------------------------------------- 04 plate concepts
F4 = "04_KONCEPTSII_PLASHEK"
if WITH_CONCEPTS: subprocess.run([sys.executable, str(root / "tehnikum60/tools/concepts_pdf.py"), str(dst / F4)], check=True)

(dst / "README.txt").write_text("""VTT 60 — вся графика в одном месте (актуальные версии, новые иконки специальностей)

01_GRAFIKA_FILMA        графика для фильма: .mov ProRes 4444 с альфой (Premultiplied),
                        WEBM/ — те же ролики в WebM с альфой (открываются в Windows),
                        PREVYU/ — mp4 для просмотра
02_IKONKI               иконки специальностей (вектор, PNG, 3D) и символы отраслей

Архивы VTT60_VSE_*.zip распакуйте все в одну папку — получится это же дерево целиком.
""", encoding="utf-8")

# ---------------------------------------------------------------- zips, under 380 MB each, per section
zdst.mkdir()
for sec in sorted(p for p in dst.iterdir() if p.is_dir()):
    files = sorted(f for f in sec.rglob("*") if f.is_file())
    parts, cur, size = [], [], 0
    for f in files:
        n = f.stat().st_size
        if cur and size + n > 380 * 2**20: parts.append(cur); cur, size = [], 0
        cur.append(f); size += n
    parts.append(cur)
    for k, part in enumerate(parts, 1):
        zp = zdst / (f"VTT60_VSE_{sec.name}.zip" if len(parts) == 1 else f"VTT60_VSE_{sec.name}_chast{k}.zip")
        with zipfile.ZipFile(zp, "w", zipfile.ZIP_STORED) as z:
            z.write(dst / "README.txt", "VTT60_VSE/README.txt")
            for f in part: z.write(f, f"VTT60_VSE/{f.relative_to(dst).as_posix()}")
        print(zp.name, round(zp.stat().st_size / 2**20), "MB")
