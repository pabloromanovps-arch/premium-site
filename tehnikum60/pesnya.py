"""The final song «Единое целое ВТТ»: the client's scene list cut to the music. Every cut lands on a
beat of the phonogram (123 BPM), sections change where the song does (found by self-similarity of
4-bar blocks: intro+verse 1, chorus 1, verse 2, chorus 2, the break, chorus 3 and the coda); videos
play their given in-points, photos drift slowly (a gentle push in, alternately left and right), every
cut is a straight cut on the beat (photos land with a small punch-in, section changes get a burst of
light), the videos are steadied and every shot is graded to one look, and the VTT logo builds itself at the end.
    python3 tehnikum60/pesnya.py <out.mp4> [width=960] [fps=30]
"""
import json, subprocess, sys
from pathlib import Path
import cv2
import numpy as np

SRC = Path(__file__).resolve().parent / "pesnya_src"
OUT = sys.argv[1]
W = int(sys.argv[2]) if len(sys.argv) > 2 else 960
FPS = int(sys.argv[3]) if len(sys.argv) > 3 else 30
H = W * 9 // 16
XF = 0.30          # the dissolve at every cut, seconds (centred on the beat)
AUDIO = SRC / "fonogramma.mp3"

# the beat grid (librosa, cached)
bf = SRC / "beats.json"
if not bf.exists():
    import librosa
    y, sr = librosa.load(str(AUDIO), sr=22050, mono=True)
    _, b = librosa.beat.beat_track(y=y, sr=sr)
    bf.write_text(json.dumps([round(float(t), 4) for t in librosa.frames_to_time(b, sr=sr)]))
BT = json.loads(bf.read_text())
END = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(AUDIO)],
                           capture_output=True, text=True).stdout)
END = min(END, 211.0)   # the song's last note dies at ~208.5 s; the file then has 7 s of silence

K1, K2, PR, P3 = "1_kuplet_pripev", "2_kuplet_pripev", "proigrysh", "pripev3_final"
# (kind, file, in-point s, end beat): each shot runs from the previous end to its own end beat
SHOTS = [
    # intro + verse 1: videos 1-9
    ("v", f"{K1}/VID_1.mp4", 6.0, 20), ("v", f"{K1}/VID_2.mp4", 12.0, 32), ("v", f"{K1}/VID_3.mp4", 0.0, 42),
    ("v", f"{K1}/VID_4.mp4", 0.2, 52), ("v", f"{K1}/VID_5.mp4", 0.0, 60), ("v", f"{K1}/VID_6.mp4", 0.0, 66),
    ("v", f"{K1}/VID_7.mp4", 5.0, 76), ("v", f"{K1}/VID_8.mp4", 0.0, 86), ("v", f"{K1}/VID_9.mp4", 0.0, 96),
    # chorus 1: six photos
    ("p", f"{K1}/припев1 (1).webp", 0, 107), ("p", f"{K1}/припев1 (1).jpg", 0, 118), ("p", f"{K1}/pripev1_2.JPG", 0, 129),
    ("p", f"{K1}/припев1 (3).jpg", 0, 140), ("p", f"{K1}/pripev1_4.JPG", 0, 150), ("p", f"{K1}/pripev1_5.JPG", 0, 160),
    # verse 2
    ("v", f"{K2}/VID_10.mp4", 4.0, 170), ("v", f"{K2}/VID_11.mp4", 0.0, 178), ("v", f"{K2}/VID_12.mp4", 0.0, 187),
    ("p", f"{K2}/foto13.jpg", 0, 200), ("p", f"{K2}/foto14.jpg", 0, 214), ("v", f"{K2}/VID_15.mp4", 0.0, 224),
    # chorus 2: nine photos
    *[("p", f"{K2}/pripev2_{i}.{'JPG' if i in (8, 9) else 'jpg'}", 0, e)
      for i, e in zip(range(1, 10), [232, 239, 246, 253, 260, 267, 274, 281, 288])],
    # the break
    ("v", f"{PR}/VID_16.mp4", 4.0, 300), ("p", f"{PR}/foto17.jpg", 0, 307), ("p", f"{PR}/foto18.jpg", 0, 314),
    ("p", f"{PR}/foto19.jpg", 0, 320),
    # chorus 3 to the end: fifteen photos, six beats each, then the logo
    *[("p", f"{P3}/{n}", 0, 320 + 6 * (i + 1)) for i, n in enumerate(
        ["pripev3_1.jpg", "pripev3_1.webp"] + [f"pripev3_{k}.jpg" for k in range(2, 15)])],
    ("logo", f"{P3}/logo_VTT.jpg", 0, None),
]


def cover(img, w, h):
    s = max(w / img.shape[1], h / img.shape[0]); return s


STAB = SRC / "stab"                 # stabilised copies of the video stretches used (vid.stab, two passes)


def stabilised(path, t0, dur):
    """the used stretch of a hand-held video, steadied (the intended camera moves kept, the shake gone)"""
    STAB.mkdir(exist_ok=True)
    out = STAB / f"{Path(path).stem}_{t0:.1f}.mp4"
    if not out.exists():
        trf = STAB / "t.trf"; span = ["-ss", f"{t0:.3f}", "-t", f"{dur + 0.6:.3f}", "-i", str(SRC / path)]
        ff = ["ffmpeg", "-v", "error", "-y"]
        subprocess.run(ff + span + ["-vf", f"vidstabdetect=shakiness=6:accuracy=12:result={trf}", "-f", "null", "-"], check=True)
        subprocess.run(ff + span + ["-vf", f"vidstabtransform=input={trf}:smoothing=24:optzoom=1:zoomspeed=0.1:interpol=bicubic,unsharp=5:5:0.4",
                                    "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", str(out)], check=True)
        trf.unlink()
    return out


def grade_for(img):
    """one look for every shot: neutral white balance (gently), a common exposure, a soft S-curve and a
    touch more colour; measured once per shot (no flicker) and applied as lookup tables"""
    sm = cv2.resize(img, (320, 180), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    lum = sm.mean(axis=2); mid = (lum > 0.12) & (lum < 0.92)
    means = sm[mid].mean(axis=0) if mid.sum() > 500 else sm.reshape(-1, 3).mean(axis=0)
    wb = np.clip((means.mean() / means) ** 0.45, 0.94, 1.06)
    g = float(np.clip(np.log(0.46) / np.log(max(1e-3, float(np.median(lum)))), 0.85, 1.25))
    x = np.arange(256, dtype=np.float32) / 255
    luts = []
    for c in range(3):
        y = np.clip(x * wb[c], 0, 1) ** g
        y = y + 0.10 * (y - 0.5) * (1 - np.abs(2 * y - 1))     # the S-curve: more snap in the mid-tones, ends kept
        luts.append(np.clip(y * 255, 0, 255).astype(np.uint8))
    return luts


def apply_grade(img, luts, sat=1.10):
    out = np.dstack([cv2.LUT(img[..., c], luts[c]) for c in range(3)])
    grey = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)[..., None].astype(np.float32)
    return np.clip(grey + (out.astype(np.float32) - grey) * sat, 0, 255).astype(np.uint8)


class Video:
    def __init__(self, path, t0, dur):
        sp = str(stabilised(path, t0, dur))
        self.cap = cv2.VideoCapture(sp); self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT)); self.idx = -1; self.last = None
        self.at(0)
        peek = cv2.VideoCapture(sp); peek.set(cv2.CAP_PROP_POS_FRAMES, int(self.fps * dur / 2))   # the grade from the middle
        ok, mid = peek.read(); self.luts = grade_for(mid if ok else self.last)
    def at(self, t):
        want = min(self.n - 1, int(round(max(0.0, t) * self.fps)))
        while self.idx < want:
            ok, f = self.cap.read()
            if not ok: break
            self.idx += 1; self.last = f
        return self.last


class Photo:
    def __init__(self, path, k):
        img = cv2.imread(str(SRC / path))
        s = cover(img, W, H) * 1.22                       # room for the drift and the punch-in
        self.img = cv2.resize(img, (int(img.shape[1] * s) + 1, int(img.shape[0] * s) + 1), interpolation=cv2.INTER_AREA)
        self.luts = grade_for(self.img)
        self.dir = 1 if k % 2 else -1


def ease_out(u): u = min(1.0, max(0.0, u)); return 1 - (1 - u) ** 3


def frame_of(shot, obj, t, dur):
    kind = shot[0]
    if kind == "v":
        f = obj.at(t)
        s = cover(f, W, H) * (1.0 + 0.03 * t / max(dur, 1e-3))       # a barely-there push in, for life
        M = np.float32([[s, 0, W / 2 - f.shape[1] * s / 2], [0, s, H / 2 - f.shape[0] * s / 2]])
        img = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        return apply_grade(img, obj.luts)
    if kind == "p":
        u = min(1.0, max(0.0, t / dur)); u = u * u * (3 - 2 * u) * 0.5 + u * 0.5          # soft start, steady drift
        punch = 0.06 * (1 - ease_out(t / 0.35))                                          # lands a touch big, settles at once
        im = obj.img; z = (0.84 + 0.07 * u) * (1 + punch)
        cx = im.shape[1] / 2 + obj.dir * (u - 0.5) * (im.shape[1] - W / z) * 0.35
        cy = im.shape[0] / 2
        M = np.float32([[z, 0, W / 2 - cx * z], [0, z, H / 2 - cy * z]])
        img = cv2.warpAffine(im, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        return apply_grade(img, obj.luts)
    # the logo, built from its pieces on white, then held
    lg = obj; f = lg.frame(t)
    out = np.full((H, W, 3), 255, np.uint8)
    x0, y0 = (W - f.shape[1]) // 2, (H - f.shape[0]) // 2
    out[y0:y0 + f.shape[0], x0:x0 + f.shape[1]] = f
    return out


# shot spans in seconds
spans, prev = [], 0.0
for sh in SHOTS:
    end = END if sh[3] is None else BT[sh[3]]
    spans.append((prev, end)); prev = end
# where the song changes section: a short burst of light across the cut
SECTION_CUTS = [BT[b] for b in (96, 160, 224, 288, 320)] + [spans[-1][0]]

enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                        "-i", "-", "-i", str(AUDIO), "-map", "0:v", "-map", "1:a",
                        "-af", f"afade=t=out:st={END - 1.5}:d=1.5", "-t", f"{END:.3f}", "-c:v", "libx264", "-preset", "medium",
                        "-crf", "14" if W >= 1920 else "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "320k",
                        "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
objs = {}
def obj_for(i):
    if i not in objs:
        sh = SHOTS[i]; a, b = spans[i]
        if sh[0] == "v": objs[i] = Video(sh[1], sh[2], b - a)
        elif sh[0] == "p": objs[i] = Photo(sh[1], i)
        else:
            from logo_vtt_anim import LogoAnim
            src = cv2.imread(str(SRC / sh[1])); objs[i] = LogoAnim(SRC / sh[1], min(W * 0.42 / src.shape[1], H * 0.64 / src.shape[0]))
    return objs[i]

sys.path.insert(0, str(Path(__file__).resolve().parent))
N = int(END * FPS)
for n in range(N):
    t = n / FPS
    i = next(k for k, (a, b) in enumerate(spans) if t < b or k == len(spans) - 1)
    a, b = spans[i]
    img = frame_of(SHOTS[i], obj_for(i), t - a, b - a)          # straight cuts, on the beat
    for c in SECTION_CUTS:
        d = t - c
        if -0.1 < d < 0.3:
            k = 0.85 * (np.exp(-(d / 0.05) ** 2) if d < 0 else np.exp(-d / 0.09))
            img = cv2.addWeighted(img, 1 - k, np.full_like(img, 255), k, 0)
    if t > END - 1.2:                                   # a fade to white at the very end
        k = min(1.0, (t - (END - 1.2)) / 1.0); img = cv2.addWeighted(img, 1 - k, np.full_like(img, 255), k, 0)
    for j in [j for j in objs if j < i - 1]: del objs[j]
    enc.stdin.write(img.tobytes())
    if n % (FPS * 10) == 0: print(f"{t:.0f}s shot {i + 1}/{len(SHOTS)}", flush=True)
enc.stdin.close(); enc.wait()
print("done", OUT)
