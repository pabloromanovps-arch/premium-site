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
FPS = 25
for s in (sys.argv[1] if len(sys.argv) > 1 else "FDPA"):
    segs = [(float(a), float(b) + 0.5) for x, a, b in used if x == s]
    todo = [(a, b) for a, b in segs if not (OUT / f"{s}_{a:.2f}_{b - 0.5:.2f}.mp4").exists()]
    if not todo: continue
    # one pass, ONE output (a multi-output split of 4K frames runs out of memory): the union of the
    # wanted stretches, back to back, at 25 fps; then each stretch is cut from that local file
    iv = []
    for a, b in sorted(todo):
        if iv and a <= iv[-1][1]: iv[-1][1] = max(iv[-1][1], b)
        else: iv.append([a, b])
    sel = "+".join(f"between(t,{a:.3f},{b:.3f})" for a, b in iv)
    union = OUT / f"tmp_union_{s}.mp4"
    print(s, len(todo), "stretches in", len(iv), "runs", flush=True)
    size = SIZES[s]
    curl = subprocess.Popen([str(HERE / "tools/drive_cat.sh"), DRIVE[s], str(size)], stdout=subprocess.PIPE)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-t", f"{iv[-1][1] + 1:.1f}", "-i", "pipe:0",
                    "-vf", f"fps={FPS},select='{sel}',setpts=N/{FPS}/TB,format=yuv420p", "-an",
                    "-c:v", "libx264", "-preset", "fast", "-crf", "14", str(union)], stdin=curl.stdout, check=True)
    curl.stdout.close()
    if curl.wait() != 0: sys.exit(f"{s}: the download broke off")
    # where each run starts in the union (in frames)
    # select keeps frame n (t = n / FPS) when a <= t <= b: frames ceil(a*FPS) .. floor(b*FPS) of each run
    import math
    first = lambda x: math.ceil(x * FPS - 1e-6); last = lambda x: math.floor(x * FPS + 1e-6)
    starts, n = [], 0
    for a, b in iv:
        starts.append(n); n += last(b) - first(a) + 1
    for a, b in todo:
        r = next(i for i, (x, y) in enumerate(iv) if x <= a + 1e-6 and b <= y + 1e-6)
        f0 = starts[r] + first(a) - first(iv[r][0]); f1 = f0 + last(b) - first(a) + 1
        final = OUT / f"{s}_{a:.2f}_{b - 0.5:.2f}.mp4"; tmp = OUT / f"tmp_{final.name}"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(union), "-vf", f"trim=start_frame={f0}:end_frame={f1},setpts=PTS-STARTPTS",
                        "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p", str(tmp)], check=True)
        d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(tmp)],
                           capture_output=True, text=True).stdout.strip()
        if d in ("", "N/A") or float(d) < 0.5: sys.exit(f"{tmp.name}: empty")
        tmp.rename(final)
    union.unlink()
print("prefetch ok")
