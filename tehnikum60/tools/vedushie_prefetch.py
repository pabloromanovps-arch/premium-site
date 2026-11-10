"""Cut every stretch the presenters' beds use out of the full-resolution Drive sources in ONE sequential
read per source, piped from tools/drive_cat.sh (Drive refuses many ranged requests in a row, and seeking over HTTP is not frame-exact).
Writes vedushie_src/seg_final/<src>_<a>_<b>.mp4, the names vedushie.py looks for.
    python3 tehnikum60/tools/vedushie_prefetch.py [sources, e.g. FDPA]
"""
import os, subprocess, sys, re
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
src_text = (HERE / "vedushie.py").read_text()
DRIVE = dict(re.findall(r'"([FDPA])": "([\w-]{20,})"', src_text))
used = sorted(set(re.findall(r'V\("([FDPA])", ([\d.]+), ([\d.]+)', src_text)))
SIZES = {"F": 1688198260, "D": 387349263, "P": 610202544, "A": 2511664957}
OUT = HERE / "vedushie_src" / "seg_final"; OUT.mkdir(exist_ok=True)
for s in (sys.argv[1] if len(sys.argv) > 1 else "FDPA"):
    segs = [(float(a), float(b)) for x, a, b in used if x == s]
    segs = [(a, b) for a, b in segs if not (OUT / f"{s}_{a:.2f}_{b:.2f}.mp4").exists()]
    if not segs: continue
    url = f"https://drive.usercontent.google.com/download?id={DRIVE[s]}&export=download&confirm=t"
    fc = f"[0:v]split={len(segs)}" + "".join(f"[s{i}]" for i in range(len(segs))) + ";"
    fc += ";".join(f"[s{i}]trim=start={a:.3f}:end={b + 0.5:.3f},setpts=PTS-STARTPTS,fps=25,format=yuv420p[o{i}]"
                   for i, (a, b) in enumerate(segs))
    cmd = ["ffmpeg", "-v", "error", "-y", "-t", f"{max(b for a, b in segs) + 1:.1f}", "-i", "pipe:0", "-filter_complex", fc]
    tmps = []
    for i, (a, b) in enumerate(segs):
        t = OUT / f"tmp_{s}_{i}.mp4"; tmps.append((t, OUT / f"{s}_{a:.2f}_{b:.2f}.mp4"))
        cmd += ["-map", f"[o{i}]", "-c:v", "libx264", "-preset", "fast", "-crf", "16", str(t)]
    print(s, len(segs), "stretches", flush=True)
    size = SIZES[s]                                     # in ranged pieces: a whole-file GET hits Drive's download quota
    curl = subprocess.Popen([str(HERE / "tools/drive_cat.sh"), DRIVE[s], str(size)], stdout=subprocess.PIPE)
    subprocess.run(cmd, stdin=curl.stdout, check=True); curl.stdout.close()
    if curl.wait() != 0: sys.exit(f"{s}: the download broke off")
    for t, final in tmps:
        d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(t)],
                           capture_output=True, text=True).stdout.strip()
        if d in ("", "N/A") or float(d) < 0.5: sys.exit(f"{t.name}: empty")
        t.rename(final)
print("prefetch ok")
