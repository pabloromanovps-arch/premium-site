"""Three picture beds for the presenters' opening words at the VTT 60th (no text on screen: photos and
footage only, cut to stock music, in the order of what the presenters say):
  1  «60 лет — целая эпоха»: the 19 archive-to-today photos, in their numbered order (photo 12 in b/w)
  2  «пространство возможностей / мастерские»: the VTT film, only stretches with no graphics or name plates
     (where a plate sits low-left the frame is cropped to its top part)
  3  «Дорогобуж» (close-ups of equipment, drawings, people; no wide views of the plant) and then
     «Сочетание мощной практической базы…» (practice, employers, student life, the college)
Every cut lands on a beat of its track and is a moving cut (a whip pan with motion blur or a zoom-through).
    python3 tehnikum60/vedushie.py <1|2|3> <out.mp4> [width=960] [draft|final]
draft reads the low-res proxies; final cuts the used stretches from the full-resolution sources on Drive.
"""
import json, subprocess, sys
from pathlib import Path
import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
SRC = HERE / "vedushie_src"
SONG = HERE / "pesnya_src"
N_FILE, OUT = int(sys.argv[1]), sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 960
MODE = sys.argv[4] if len(sys.argv) > 4 else "draft"
ALPHA = "alpha" in sys.argv[5:]          # fill + matte, no ground/badge/wordmarks/bar (the editor adds the originals)
BG_MODE = "bg" in sys.argv[5:]          # the client's BG.mp4 baked in as the ground (one finished file)
H = W * 9 // 16
FPS = 25
DRIVE = {"F": "1meHsQ8dSHR6eyWoszLgKGVkk41QzZ6Et",          # «60 лет ВТТ (Version 16)», 3840x2160
         "D": "1qTsS3tFGLX18kSVhmnYnQk0cmt2rHNBH",          # «Дорогобуж — О предприятии», 1920x1080
         "P": "1-nasj1MLEZ7u7M-dKBTWP-mXHak4J4JI",          # «ПМУ — 40 лет», 1920x1080 (logo top-left)
         "A": "16IFUeyspqZDSxfNjO9o1cow7eWeeHDR3"}          # «Юбилейный ролик Аммиак», 1920x1080 50p (logo top-left)
PROXY = {"F": "film_proxy.mp4", "D": "dorogobuzh_proxy.mp4", "P": "pmu40_proxy.mp4", "A": "ammiak_proxy.mp4"}
# crops, as (x0, y0, size) of the frame kept: "plate" drops the bottom quarter (name plates sit low-left),
# "logo" drops the PMU film's corner logo
CROPS = {None: (0, 0, 1), "plate": (0.12, 0.0, 0.76), "logo": (0.14, 0.14, 0.86)}

P = lambda n, d, bw=False: ("p", n, d, bw)                 # a photo, its length (s)
V = lambda s, a, b, crop=None, speed=1.0: ("v", s, a, b, crop, speed)   # a stretch a..b (s) of source s

FOTO = SRC / "foto"
# the client's brief gives each block's length: yellow 47 s, blue 38 s, green 28 s, the last one 23 s
PLAN = {
    1: dict(music="Heartwarming.mp3", length=47.0, items=[                      # yellow: the 19 photos in order
        P("f01.jpg", 3.0), P("f01_1.jpg", 2.4), P("f02.jpg", 2.6), P("f03.jpg", 2.3), P("f04.jpg", 2.3),
        P("f05.jpg", 2.2), P("f06.webp", 2.3), P("f07.jpg", 2.2), P("f08.jpg", 2.2), P("f09.jpg", 2.2),
        P("f10.jpg", 2.2), P("f11.webp", 2.3), P("f12_chb.jpg", 2.3, True), P("f13.jpg", 2.3), P("f14.jpg", 2.6),
        P("f15.jpg", 2.3), P("f16.jpg", 2.3), P("f17.jpg", 2.3), P("f18.jpg", 4.0)]),
    2: dict(music="Inspired.mp3", length=38.0, cards=[2, 3, 8, 9], items=[      # blue; the film's shots mixed,
        # not in the film's order, each still on its line
        # «И сегодня… пространство возможностей для молодёжи»
        V("F", 480.3, 483.0), V("F", 318.0, 319.9),
        # «…не просто слушают лекции, а с первых курсов погружаются в профессиональную среду»
        V("F", 298.0, 299.9), V("F", 349.0, 351.4), V("F", 303.0, 305.4), V("F", 359.0, 360.9),
        # «…учатся на современном оборудовании и отрабатывают навыки…»
        V("F", 320.0, 321.9), V("F", 373.0, 374.9, "plate"),
        # «…новые производственные мастерские, оснащённые по актуальным отраслевым стандартам»
        V("F", 300.6, 302.9), V("F", 367.0, 369.6, "plate"), V("F", 352.0, 354.2, "plate"), V("F", 375.5, 378.0, "plate"),
        # «…рабочие операции: от базовых приёмов до сложных технологических процессов»
        V("F", 384.0, 386.4, "plate"), V("F", 407.0, 409.4),
        # «…уверенно чувствовать себя на производстве и быстрее проходить адаптацию»
        V("F", 421.0, 424.9), V("F", 415.5, 418.5)]),
    3: dict(music="Ascending_the_Vale.mp3", length=28.0, cards=[2, 3], items=[                # green: Dorogobuzh, close-ups only
        # «Получаемые навыки напрямую соотносятся с задачами… на предприятиях региона»
        V("D", 4.2, 5.8), V("D", 21.0, 23.4),
        # «…открыта по рекомендации ПАО «Дорогобуж»… с учётом реальных потребностей производства»
        V("A", 432.0, 433.9, "logo"), V("P", 277.0, 279.8, "logo"),
        # «…обслуживать насосное, компрессорное и теплообменное оборудование»
        V("A", 333.6, 336.4, "logo"), V("D", 40.2, 42.4), V("A", 354.0, 356.4, "logo"),
        # «…участвовать в монтаже и наладке технологических линий»
        V("A", 439.0, 441.6, "logo"), V("D", 132.0, 135.0),
        # «…обеспечивать бесперебойную работу цехов»
        V("A", 448.0, 450.9, "logo"), V("D", 98.0, 100.0)]),
    4: dict(music="Ascending_the_Vale.mp3", music_at=40.0, length=23.0, items=[  # the last block, mixed
        # «Сочетание мощной практической базы, тесной связи с работодателями…»
        V("F", 276.4, 277.9, "plate"), V("F", 361.0, 363.6, "plate"),
        # «…и насыщенной внеучебной жизни…»
        P(SONG / "2_kuplet_pripev/pripev2_6.jpg", 1.7), P(SONG / "pripev3_final/pripev3_13.jpg", 1.7),
        P(SONG / "2_kuplet_pripev/pripev2_3.jpg", 1.7), P(SONG / "2_kuplet_pripev/pripev2_9.JPG", 1.8),
        # «Здесь студенты… учатся быть самостоятельными, ответственными и целеустремлёнными»
        V("F", 322.0, 323.9), V("F", 486.0, 489.9), V("F", 306.0, 307.9), V("F", 63.9, 65.3, None, 0.5)]),
}
plan = PLAN[N_FILE]
MUSIC = SRC / "music" / plan["music"]

# ---- the music's beats: every cut is moved to the nearest one
bf = SRC / "music" / (MUSIC.stem + "_beats.json")
if not bf.exists():
    import librosa
    y, sr = librosa.load(str(MUSIC), sr=22050, mono=True)
    _, b = librosa.beat.beat_track(y=y, sr=sr)
    bf.write_text(json.dumps([round(float(t), 4) for t in librosa.frames_to_time(b, sr=sr)]))
BT = np.array(json.loads(bf.read_text())) - plan.get("music_at", 0.0); BT = BT[BT > 0.5]


def item_len(it):
    return it[2] if it[0] == "p" else (it[3] - it[2]) / it[5]


TARGET = plan["length"]; SCALE = TARGET / sum(item_len(it) for it in plan["items"])
spans, t = [], 0.0
for k, it in enumerate(plan["items"]):
    end = t + item_len(it) * SCALE
    if k < len(plan["items"]) - 1:
        end = float(BT[np.argmin(np.abs(BT - end))])
        if end - t < 1.0: end = float(BT[np.searchsorted(BT, t + 1.0)])
    spans.append((t, end)); t = end
END = TARGET
spans[-1] = (spans[-1][0], END)

# ---- the used stretches (final: cut from the full-resolution sources; draft: the proxies)
CACHE = SRC / ("seg_final" if MODE == "final" else "seg_draft"); CACHE.mkdir(exist_ok=True)


def segment(src, a, b):
    out = CACHE / f"{src}_{a:.2f}_{b:.2f}.mp4"
    if not out.exists():
        tmp = CACHE / "tmp.mp4"
        if MODE == "final":
            inp = ["-ca_file", "/root/.ccr/ca-bundle.crt", "-http_proxy", __import__("os").environ["HTTPS_PROXY"],
                   "-ss", f"{a:.3f}", "-t", f"{b - a + 0.5:.3f}",
                   "-i", f"https://drive.usercontent.google.com/download?id={DRIVE[src]}&export=download&confirm=t"]
            enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "16"]
        else:
            inp = ["-ss", f"{a:.3f}", "-t", f"{b - a + 0.5:.3f}", "-i", str(SRC / PROXY[src])]
            enc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"]
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inp, "-an", "-r", str(FPS), *enc, "-pix_fmt", "yuv420p", str(tmp)], check=True)
        tmp.rename(out)
    return out


def grade_for(img, bw=False):
    sm = cv2.resize(img, (320, 180), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    lum = sm.mean(axis=2); mid = (lum > 0.12) & (lum < 0.92)
    means = sm[mid].mean(axis=0) if mid.sum() > 500 else sm.reshape(-1, 3).mean(axis=0)
    wb = np.ones(3) if bw else np.clip((means.mean() / means) ** 0.45, 0.94, 1.06)
    g = float(np.clip(np.log(0.46) / np.log(max(1e-3, float(np.median(lum)))), 0.85, 1.2))
    x = np.arange(256, dtype=np.float32) / 255; luts = []
    for c in range(3):
        y = np.clip(x * wb[c], 0, 1) ** g
        y = y + 0.10 * (y - 0.5) * (1 - np.abs(2 * y - 1))
        luts.append(np.clip(y * 255, 0, 255).astype(np.uint8))
    return luts


def apply_grade(img, luts, sat=1.08):
    out = np.dstack([cv2.LUT(img[..., c], luts[c]) for c in range(3)])
    grey = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)[..., None].astype(np.float32)
    return np.clip(grey + (out.astype(np.float32) - grey) * sat, 0, 255).astype(np.uint8)


def ease_out(u): u = min(1.0, max(0.0, u)); return 1 - (1 - u) ** 3
def ease_io(u): u = min(1.0, max(0.0, u)); return u * u * u * (u * (6 * u - 15) + 10)


class Clip:
    def __init__(self, it, dur):
        _, src, a, b, crop, speed = it
        self.cap = cv2.VideoCapture(str(segment(src, a, b))); self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.idx, self.last, self.speed, self.crop = -1, None, speed, CROPS[crop]
        self.at(0)
        peek = cv2.VideoCapture(str(segment(src, a, b))); peek.set(cv2.CAP_PROP_POS_FRAMES, self.n // 2)
        ok, mid = peek.read(); self.luts = grade_for(mid if ok else self.last)
    def at(self, t):
        want = min(self.n - 1, int(round(max(0.0, t) * self.speed * FPS)))
        while self.idx < want:
            ok, f = self.cap.read()
            if not ok: break
            self.idx += 1; self.last = f
        return self.last
    def frame(self, t, dur, k):
        f = self.at(t); h, w = f.shape[:2]
        x0, y0, s = self.crop
        z = 1.0 + 0.04 * t / max(dur, 1e-3)                      # a slow push in, for life
        sc = W / (w * s) * z
        cx, cy = (x0 + s / 2) * w, (y0 + s / 2) * h
        M = np.float32([[sc, 0, W / 2 - cx * sc], [0, sc, H / 2 - cy * sc]])
        img = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_AREA if sc < 1 else cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        return apply_grade(img, self.luts)


class Photo:
    def __init__(self, it, k):
        _, name, _, bw = it
        path = Path(name) if Path(name).is_absolute() else FOTO / name
        img = cv2.imread(str(path))
        if bw: img = cv2.cvtColor(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
        s = max(W / img.shape[1], H / img.shape[0]) * 1.2
        self.img = cv2.resize(img, (int(img.shape[1] * s) + 1, int(img.shape[0] * s) + 1),
                              interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
        self.luts = grade_for(self.img, bw or img.std(axis=2).mean() < 6)
        self.dir = 1 if k % 2 else -1
    def frame(self, t, dur, k):
        u = min(1.0, max(0.0, t / dur)); u = u * u * (3 - 2 * u) * 0.4 + u * 0.6
        im = self.img; z = 0.85 + 0.08 * u
        cx = im.shape[1] / 2 + self.dir * (u - 0.5) * (im.shape[1] - W / z) * 0.35
        cy = im.shape[0] / 2
        M = np.float32([[z, 0, W / 2 - cx * z], [0, z, H / 2 - cy * z]])
        img = cv2.warpAffine(im, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        return apply_grade(img, self.luts)


# ---- the moving cuts (as in the song): whip pans with motion blur, now and then a zoom-through
TW = 0.22
STYLES = ["whip_l", "zoom", "whip_r", "whip_l", "whip_u", "whip_r", "zoom", "whip_d"]


def motion_blur(img, length, vertical):
    if length < 3: return img
    sm = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    L = max(1, int(length / 4)); k = (1, L) if vertical else (L, 1)
    return cv2.resize(cv2.blur(sm, k), (W, H), interpolation=cv2.INTER_LINEAR)


def zoom_blur(img, z, amount):
    sm = cv2.resize(img, (W // 3, H // 3), interpolation=cv2.INTER_AREA); acc = np.zeros(sm.shape, np.float32)
    n = 6 if amount > 0.01 else 1
    for j in range(n):
        M = cv2.getRotationMatrix2D((sm.shape[1] / 2, sm.shape[0] / 2), 0, z * (1 + amount * j / 5))
        acc += cv2.warpAffine(sm, M, (sm.shape[1], sm.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    blurred = cv2.resize((acc / n).astype(np.uint8), (W, H), interpolation=cv2.INTER_LINEAR)
    M = cv2.getRotationMatrix2D((W / 2, H / 2), 0, z)
    sharp = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    k = min(1.0, amount * 6)
    return cv2.addWeighted(sharp, 1 - k, blurred, k, 0)


def transition(A, B, u, style):
    sharp = np.sin(np.pi * u)
    if style.startswith("whip"):
        p = ease_io(u); vertical = style in ("whip_u", "whip_d"); n = H if vertical else W
        off = int(round(p * n)); out = np.empty_like(A)
        if style in ("whip_l", "whip_u"):
            if vertical: out[:n - off] = A[off:]; out[n - off:] = B[:off]
            else: out[:, :n - off] = A[:, off:]; out[:, n - off:] = B[:, :off]
        else:
            if vertical: out[off:] = A[:n - off]; out[:off] = B[n - off:]
            else: out[:, off:] = A[:, :n - off]; out[:, :off] = B[:, n - off:]
        return motion_blur(out, 0.22 * n * sharp ** 1.5, vertical)
    if u < 0.5:
        v = u / 0.5; return zoom_blur(A, 1 + 0.9 * v ** 2.2, 0.25 * sharp)
    v = (u - 0.5) / 0.5; return zoom_blur(B, 1 + 0.6 * (1 - ease_out(v)), 0.25 * sharp)


items = plan["items"]
# ---- the evening's graphic format: photos (and some videos) sit in slanted white cards with the red shadow
# on the green «Профессионалитет» ground; the other videos run full frame under the brand frame (corner
# wordmarks, «60» badge, colour bar). Card to card: the new card flies in and the last one steps back
# behind it; full to full: a whip; between the two: the colour-stripe wipe. The end: the stripes wipe
# to the «60» mark.
sys.path.insert(0, str(HERE))
from brand_vecher import Brand
BRAND = Brand(W, H, alpha=ALPHA)
if BG_MODE: BRAND.use_bg(SRC / "brand" / "BG.mp4")
CARD_SET = set(plan.get("cards", [])) | {k for k, it in enumerate(items) if it[0] == "p"}
LAYOUT = ["card" if k in CARD_SET else "full" for k in range(len(items))]
MAIN = [(0.47, 0.49, 0.56, 0.66), (0.58, 0.55, 0.50, 0.60)]           # cx, cy, w, h (fractions of W, H)
BACK = {1: (0.29, 0.40, 0.33, 0.40), 0: (0.73, 0.38, 0.30, 0.37)}     # where the previous card steps back to
CARD_IN = 0.5                                                         # the card's flight, s
WIPE_DUR = 1.0; WIPE_PRE, WIPE_POST = 0.55, 0.45                      # the stripe wipe (played 1.6x) around a cut, s
TRANS = {}
for k in range(1, len(items)):
    a_, b_ = LAYOUT[k - 1], LAYOUT[k]
    TRANS[k] = "card" if a_ == b_ == "card" else STYLES[(k - 1) % len(STYLES)] if a_ == b_ == "full" else "stripes"
objs = {}
def obj_for(k):
    if k not in objs:
        a, b = spans[k]
        objs[k] = Photo(items[k], k) if items[k][0] == "p" else Clip(items[k], b - a)
    return objs[k]


def run_start(k):
    """the first index of the run of cards that k belongs to"""
    while k > 0 and LAYOUT[k - 1] == "card": k -= 1
    return k


def px(r): return r[0] * W, r[1] * H, r[2] * W, r[3] * H


def lerp(p, q, u): return tuple(a + (b - a) * u for a, b in zip(p, q))


def shot(k, t):
    a, b = spans[k]; f = obj_for(k).frame(t - a, b - a, k)
    return np.dstack([f, np.full(f.shape[:2], 255, np.uint8)]) if ALPHA else f


def card_scene(k, t):
    """the green ground with card k as the main card (and the previous card of the run stepping back)"""
    img = BRAND.ground_at(t); a = spans[k][0]; slot = (k - run_start(k)) % 2
    u = ease_out((t - a) / CARD_IN)
    if k > run_start(k):                                              # the previous card: from main to back
        prev_main = MAIN[(k - 1 - run_start(k)) % 2]
        pk = k - 1; pa, pb = spans[pk]
        pic = obj_for(pk).frame(min(t, pb) - pa, pb - pa, pk)
        img = BRAND.card(img, pic, *px(lerp(prev_main, BACK[slot], u)))
    pic = shot(k, t)
    target = MAIN[slot]; start = (target[0] + 0.75, target[1] + 0.10, target[2] * 0.9, target[3] * 0.9)
    pos = lerp(start, target, u) if k > run_start(k) or k > 0 else target
    white = max(0.0, 1 - (t - a) / (CARD_IN * 0.9)) if k > 0 else 0.0
    return BRAND.card(img, pic, *px(pos), white=white)


def base_frame(k, t):
    return card_scene(k, t) if LAYOUT[k] == "card" else shot(k, t)


END_WIPE = 2.0                                                        # the closing stripes to the «60» mark, then a hold
LOGO = BRAND.logo_screen(0.5)

AUDIO_ARGS = ["-ss", str(plan.get("music_at", 0)), "-i", str(MUSIC), "-map", "0:v", "-map", "1:a",
              "-af", f"afade=t=in:d=0.3,afade=t=out:st={END - 3.0:.2f}:d=3.0,loudnorm=I=-16:TP=-1.5",
              "-t", f"{END:.3f}", "-c:a", "aac", "-b:a", "320k", "-ar", "48000"]
if ALPHA:
    from alpha_out import FillMatte
    out = FillMatte(OUT[:-4] if OUT.endswith(".mp4") else OUT, W, H, FPS, AUDIO_ARGS)
else:
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-ss", str(plan.get("music_at", 0)), "-i", str(MUSIC), "-map", "0:v", "-map", "1:a",
                            "-af", f"afade=t=in:d=0.3,afade=t=out:st={END - 3.0:.2f}:d=3.0,loudnorm=I=-16:TP=-1.5",
                            "-t", f"{END:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "17" if W >= 1920 else "20",
                            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", OUT],
                           stdin=subprocess.PIPE)
for n in range(int(END * FPS)):
    t = n / FPS
    i = next(k for k, (a, b) in enumerate(spans) if t < b or k == len(spans) - 1)
    img = None
    for k in range(max(1, i), min(len(items), i + 2)):                 # a cut nearby?
        c = spans[k][0]; style = TRANS[k]
        if style == "stripes" and c - WIPE_PRE <= t < c + WIPE_POST:
            img = base_frame(k - 1 if t < c else k, t)
            img = BRAND.paste(img, BRAND.wipe((t - (c - WIPE_PRE)) / WIPE_DUR), 0, 0); break
        if style not in ("stripes", "card") and abs(t - c) < TW:
            A, B = shot(k - 1, t), shot(k, t)
            img = transition(A, B, (t - (c - TW)) / (2 * TW), style); break
    if img is None: img = base_frame(i, t)
    if t > END - END_WIPE:                                            # the closing wipe to the «60» mark
        u = (t - (END - END_WIPE)) / WIPE_DUR                         # 0..1: the wipe, then the mark holds
        if u > 0.5: img = BRAND.ground_at(t) if BG_MODE else LOGO.copy()
        if u < 1.0: img = BRAND.paste(img, BRAND.wipe(u), 0, 0)
    img = BRAND.frame_on(img)
    if t < 0.4 and not ALPHA and not BG_MODE: img = (img.astype(np.float32) * (t / 0.4)).astype(np.uint8)
    for j in [j for j in objs if j < i - 2]: del objs[j]
    if ALPHA: out.write(img)
    else: enc.stdin.write(img.tobytes())
    if n % (FPS * 10) == 0: print(f"{t:.0f}s / {END:.0f}s item {i + 1}/{len(items)}", flush=True)
out.close() if ALPHA else (enc.stdin.close(), enc.wait())
print("done", OUT, f"{END:.1f}s")
