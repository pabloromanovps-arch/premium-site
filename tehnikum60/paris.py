"""«Париж 1960-х»: a short documentary for an exhibition, cut to the narrator. The narration (one file,
seven paragraphs) is split at its pauses and laid out with a breath between paragraphs; each paragraph
is one scene of the script with its own footage and stills. One look for everything (a warm, slightly
faded film print, fine grain, a soft vignette), slow drifts and pans on the stills, soft dissolves,
place titles in a serif italic, and the credit each CC licence asks for in the corner of its still.
    python3 tehnikum60/paris.py <out.mp4> [width=1920] [music.mp3]
"""
import subprocess, sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = Path(__file__).resolve().parent / "paris_src"
OUT = sys.argv[1]
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
H = W * 9 // 16
MUSIC = sys.argv[3] if len(sys.argv) > 3 else None
MUSIC_CREDIT = "Музыка: Эрик Сати, «Гимнопедия № 1», исп. Kevin MacLeod (incompetech.com), CC BY 4.0"
FPS = 25
XF = 0.6                     # dissolve between shots
GAP, LEAD, TAIL = 1.0, 1.5, 4.5
VOICE = SRC / "golos/diktor.mp3"
# the narration's paragraph boundaries (s), found at its pauses (syllable count -> nearest long pause)
PARA = [0.0, 16.80, 34.71, 47.20, 68.76, 80.69, 90.89, 99.60]

F_TITLE = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
F_SMALL = "/usr/share/fonts/truetype/inter/Inter-Medium.ttf"
for p in ["/usr/share/fonts/opentype/inter/Inter-Medium.otf", "/usr/share/fonts/truetype/inter/Inter-Medium.ttf"]:
    if Path(p).exists(): F_SMALL = p

CR = {
    "00_periph_fortepan.jpg": "Fortepan / Urbán Tamás / CC BY-SA 3.0",
    "01_periph_gentilly.jpg": "Wikimedia Commons / Public domain",
    "02_sarcelles_flanades.jpg": "Bentz / Wikimedia Commons / CC BY-SA 4.0",
    "03_sarcelles_paul_valery.jpg": "Chabe01 / Wikimedia Commons / CC BY-SA 4.0",
    "villagexpo_adobe.jpg": "Adobe Stock",
    "04_lac_sourderie.jpg": "Jean-Marc Astesana / Flickr / CC BY-SA 2.0",
    "cergy_grand_centre.jpg": "L. Pages – Ville de Cergy / Wikimedia Commons / CC BY-SA 4.0",
    "abraxas.jpg": "Matgrt / Wikimedia Commons / CC BY 4.0",
    "05_choux_creteil.jpg": "Paul Fleury / Panoramio / CC BY 3.0",
    "06_arenes_picasso.jpg": "Zairon / Wikimedia Commons / CC BY-SA 4.0",
    "07_tours_aillaud.jpg": "Guilhem Vellut / Flickr / CC BY 2.0",
    "08_defense_tour_eiffel.jpg": "ZarlokX / Wikimedia Commons / CC BY-SA 4.0",
    "09_defense_neuilly.jpg": "Olevy / Wikimedia Commons / CC BY-SA 3.0",
    "10_panorama_defense.jpg": "Dimitri Destugues / Wikimedia Commons / CC BY-SA 3.0",
    "11_pont_neuilly.jpg": "Edison McCullen / Wikimedia Commons / CC BY-SA 4.0",
}
CROP = {"v1_periph.mp4": (14, 0, 784, 508), "v3_villagexpo.mp4": (0, 0, 776, 544), "v4_trappes.mp4": (10, 0, 786, 536),
        "v5_grande_borne.mp4": (16, 0, 782, 508), "v7_front_de_seine.mp4": (14, 0, 784, 508)}
have = lambda n: (SRC / "foto" / n).exists() and (SRC / "foto" / n).stat().st_size > 20000   # a real photo, not an error page

# scenes: (title, title delay, [(kind, file, weight, extra)]) — weights share the scene's length
def scenes():
    s1 = [("v", "v1_periph.mp4", 9 if have("00_periph_fortepan.jpg") else 12, 0.5)]
    if have("00_periph_fortepan.jpg"): s1.append(("p", "00_periph_fortepan.jpg", 5, None))
    s1.append(("p", "01_periph_gentilly.jpg", 6, None))
    sar = ["02_sarcelles_flanades.jpg", "03_sarcelles_paul_valery.jpg"] + sorted(p.name for p in (SRC / "foto").glob("sarcelles_x*.jpg"))
    s5_still = "05_choux_creteil.jpg" if have("05_choux_creteil.jpg") else "06_arenes_picasso.jpg"
    return [
        (("1950-е — 1980-е", "ПАРИЖ", "город архитектурных утопий", "centre"), 1.2, s1),
        (("Большой ансамбль", "Сарсель", "Sarcelles", "left"), 0.6, [("p", n, 1, None) for n in sar]),
        (("1966 · выставка типового жилья", "Villagexpo", "Сен-Мишель-сюр-Орж", "left"), 0.6,
         [("v", "v3_villagexpo.mp4", 9.5, 0.0), ("p", "villagexpo_adobe.jpg", 4, None)]),
        (("Новые города · строительство", "Сен-Кантен-ан-Ивелин", "Saint-Quentin-en-Yvelines", "left"), 2.0,
         [("v", "v4_trappes.mp4", 14, 0.5), ("p", "04_lac_sourderie.jpg", 4.3, "pan"), ("p", "cergy_grand_centre.jpg", 4.3, None)]),
        (("Квартал", "La Grande Borne", "Гриньи", "left"), 0.6, [("v", "v5_grande_borne.mp4", 6.2, 0.0),
         ("p", s5_still, 3.4, ("Новая постройка", "Les Choux", "новый район Кретей", "left") if "choux" in s5_still else None),
         ("p", "abraxas.jpg", 3.3, None)]),
        (("Деловой район", "Ла-Дефанс", "La Défense", "left"), 0.6, [("p", "08_defense_tour_eiffel.jpg", 4.0, "pan"),
         ("p", "09_defense_neuilly.jpg", 3.6, None), ("p", "07_tours_aillaud.jpg", 3.6, None)]),
        (None, 0, [("v", "v7_front_de_seine.mp4", 6, 0.5), ("p", "10_panorama_defense.jpg", 4.4, "pan"), ("p", "11_pont_neuilly.jpg", 3.4, None)]),
    ]


# ---------------------------------------------------------------- the look
rng = np.random.default_rng(7)
GRAIN = [rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32) for _ in range(12)]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIG = (1 - 0.32 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) ** 1.4).clip(0.55, 1)[..., None]
x = np.arange(256, dtype=np.float32) / 255
TONE = np.clip(0.035 + 0.93 * (x + 0.08 * (x - 0.5) * (1 - np.abs(2 * x - 1))), 0, 1)   # lifted blacks, soft highlights


def look(img, n):
    """a warm, slightly faded print: colour eased back, a touch of warmth, soft curve, grain, vignette"""
    f = img.astype(np.float32) / 255
    g = f.mean(axis=2, keepdims=True)
    f = g + (f - g) * 0.78
    f = f * np.array([0.95, 1.0, 1.04], np.float32)          # BGR: a little warmer
    f = np.interp(np.clip(f, 0, 1), x, TONE)
    gr = cv2.resize(GRAIN[n % len(GRAIN)], (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
    f = f * VIG + gr * 0.022
    return (np.clip(f, 0, 1) * 255).astype(np.uint8)


# ---------------------------------------------------------------- sources
def cover(w, h): return max(W / w, H / h)


class Video:
    def __init__(self, name, t0):
        self.cap = cv2.VideoCapture(str(SRC / "video" / name)); self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT)); self.crop = CROP[name]; self.t0 = t0
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, int(t0 * self.fps)); self.idx = int(t0 * self.fps) - 1; self.last = None
        self.at(0)
    def at(self, t):
        want = min(self.n - 1, int(round((self.t0 + max(0, t)) * self.fps)))
        while self.idx < want:
            ok, f = self.cap.read()
            if not ok: break
            self.idx += 1; self.last = f
        return self.last
    def frame(self, t, dur):
        x0, y0, w, h = self.crop; f = self.at(t)[y0:y0 + h, x0:x0 + w]
        s = cover(w, h) * (1.0 + 0.03 * t / dur)
        M = np.float32([[s, 0, W / 2 - w * s / 2], [0, s, H / 2 - h * s / 2]])
        img = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        bl = cv2.GaussianBlur(img, (0, 0), 1.4); return cv2.addWeighted(img, 1.5, bl, -0.5, 0)   # the upscale, crisped


class Still:
    def __init__(self, name, mode, k):
        im = cv2.imread(str(SRC / "foto" / name)); self.mode = mode if mode == "pan" else None; self.dir = 1 if k % 2 else -1
        s = cover(im.shape[1], im.shape[0]) * (1.0 if self.mode else 1.14)
        self.im = cv2.resize(im, (int(im.shape[1] * s) + 2, int(im.shape[0] * s) + 2), interpolation=cv2.INTER_AREA)
    def frame(self, t, dur):
        u = min(1, max(0, t / dur)); h, w = self.im.shape[:2]
        if self.mode:                                            # a slow pan across a wide view
            z = 1.0; cx = W / 2 + (w - W) * (0.5 - self.dir * (u - 0.5) * 0.9); cy = h / 2
        else:                                                    # a slow push in with a little drift
            z = 0.89 + 0.07 * u; cx = w / 2 + self.dir * (u - 0.5) * (w - W / z) * 0.3; cy = h / 2
        M = np.float32([[z, 0, W / 2 - cx * z], [0, z, H / 2 - cy * z]])
        return cv2.warpAffine(self.im, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


# ---------------------------------------------------------------- titles and credits
def text_layer(lines):
    """an RGBA overlay: [(text, font, size, (x, y), alpha, anchor)]"""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for txt, font, size, xy, a, anchor in lines:
        f = ImageFont.truetype(font, size)
        for dx, dy in ((2, 2), (1, 1)):                          # a soft drop for legibility on light skies
            d.text((xy[0] + dx, xy[1] + dy), txt, font=f, fill=(0, 0, 0, int(a * 90)), anchor=anchor)
        d.text(xy, txt, font=f, fill=(255, 250, 240, int(a * 255)), anchor=anchor)
    return np.asarray(im)


def over(img, rgba):
    a = rgba[..., 3:4].astype(np.float32) / 255
    return (img.astype(np.float32) * (1 - a) + rgba[..., 2::-1].astype(np.float32) * a).astype(np.uint8)


_cache = {}
F_LABEL = "/usr/share/fonts/opentype/inter/Inter-Medium.otf"
F_MAIN = "/usr/share/fonts/opentype/inter/InterDisplay-Light.otf"
INK = (255, 250, 240)


def sprite(text, font, size, track=0.0):
    """text as an RGBA sprite (letter-spaced by `track` x size), with a soft shadow, cached"""
    key = ("s", text, font, size, track)
    if key not in _cache:
        f = ImageFont.truetype(font, size); pad = size
        widths = [f.getlength(c) for c in text]; tw = int(sum(widths) + track * size * max(0, len(text) - 1)) + 2 * pad
        asc, desc = f.getmetrics(); im = Image.new("RGBA", (tw, asc + desc + 2 * pad), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        for off, col in (((2, 2), (0, 0, 0, 80)), ((0, 0), INK + (255,))):
            xx = pad + off[0]
            for c, w in zip(text, widths):
                d.text((xx, pad + off[1]), c, font=f, fill=col); xx += w + track * size
        _cache[key] = (np.asarray(im), pad, asc)
    return _cache[key]


def put(img, spr, x, y, alpha, clip=None):
    """composite a sprite with its text origin at x and its baseline at y; clip = (y0, y1) rows kept"""
    a, pad, asc = spr; h, w = a.shape[:2]
    X, Y = int(x - pad), int(y - asc - pad)
    x0, y0, x1, y1 = max(0, X), max(0, Y), min(W, X + w), min(H, Y + h)
    if clip: y0, y1 = max(y0, clip[0]), min(y1, clip[1])
    if x1 <= x0 or y1 <= y0 or alpha <= 0: return img
    sub = a[y0 - Y:y1 - Y, x0 - X:x1 - X].astype(np.float32)
    k = sub[..., 3:4] / 255 * alpha
    reg = img[y0:y1, x0:x1].astype(np.float32)
    img[y0:y1, x0:x1] = (reg * (1 - k) + sub[..., 2::-1] * k).astype(np.uint8)
    return img


def eo(u): u = min(1.0, max(0.0, u)); return 1 - (1 - u) ** 3


def draw_title(img, spec, tt, life):
    """label (spaced caps) / main (light, large, rising out of a mask) / rule (drawn on) / sub (serif
    italic); in over ~1.2 s, out over the last 0.6 s with a small lift"""
    label, main, sub, where = spec; s = W / 1920
    out = 1 - min(1, max(0, (tt - (life - 0.6)) / 0.6)); lift = (1 - out) * 10 * s
    centre = where == "centre"
    sz_l, sz_m, sz_s = int((22 if centre else 19) * s), int((132 if centre else 76) * s), int((34 if centre else 30) * s)
    L, M, S = sprite(label.upper(), F_LABEL, sz_l, 0.32), sprite(main, F_MAIN, sz_m, 0.06 if centre else 0.0), sprite(sub, F_TITLE, sz_s)
    wm = M[0].shape[1] - 2 * M[1]; wl = L[0].shape[1] - 2 * L[1]; ws = S[0].shape[1] - 2 * S[1]
    if centre:
        yb = H * 0.55; xm, xl, xs = (W - wm) / 2, (W - wl) / 2, (W - ws) / 2
    else:
        yb = H - 170 * s; xm = xl = xs = 120 * s
    y_label, y_main, y_rule, y_sub = yb - sz_m * 0.78 - 26 * s, yb, yb + 30 * s, yb + 30 * s + 22 * s + sz_s
    put(img, L, xl, y_label - lift, eo((tt - 0.1) / 0.6) * 0.85 * out)
    rise = (1 - eo((tt - 0.25) / 0.75)) * sz_m * 1.05                                # the name rises out of its mask
    if tt > 0.25:
        put(img, M, xm, y_main + rise - lift, out * min(1, (tt - 0.25) / 0.3),
            clip=(int(y_main - sz_m * 1.1 - lift), int(y_main + sz_m * 0.3 - lift)))
    rl = eo((tt - 0.05) / 0.7) * (220 * s if centre else min(wm, 260 * s))
    if rl > 1 and out > 0.05:
        x0 = W / 2 - rl / 2 if centre else xm
        over_line = img.copy()
        cv2.line(over_line, (int(x0), int(y_rule - lift)), (int(x0 + rl), int(y_rule - lift)), INK[::-1], max(1, int(1.6 * s)), cv2.LINE_AA)
        img = cv2.addWeighted(img, 1 - out, over_line, out, 0)
    put(img, S, xs, y_sub - lift, eo((tt - 0.65) / 0.6) * 0.92 * out)
    return img


def credit_card(text, k):
    key = ("c", text, round(k, 2))
    if key not in _cache:
        s = W / 1920
        _cache[key] = text_layer([(text, F_SMALL, int(19 * s), (int(W - 40 * s), int(H - 34 * s)), 0.72 * k, "rs")])
    return _cache[key]


# ---------------------------------------------------------------- the timeline
SC = scenes()
seg = [b - a for a, b in zip(PARA, PARA[1:])]
shots, t = [], 0.0
for i, (title, tdel, items) in enumerate(SC):
    L = seg[i] + GAP + (LEAD if i == 0 else 0) + (TAIL if i == len(SC) - 1 else 0)
    wsum = sum(it[2] for it in items); t_scene = t
    for j, it in enumerate(items):
        d = L * it[2] / wsum
        shots.append(dict(kind=it[0], name=it[1], t0=t, dur=d, extra=it[3], scene=i, j=j,
                          title=title if j == 0 else None, tdel=tdel, scene_t=t_scene))
        t += d
END = t
# the narration laid out: paragraph i starts at the start of scene i (+ the lead-in for the first)
VSTART = []
acc = LEAD
for i in range(len(seg)):
    VSTART.append(acc); acc += seg[i] + GAP

objs = {}
def obj(k):
    if k not in objs:
        s = shots[k]
        objs[k] = Video(s["name"], s["extra"] or 0.0) if s["kind"] == "v" else Still(s["name"], s["extra"] if s["extra"] == "pan" else None, k)
    return objs[k]


def shot_frame(k, t):
    s = shots[k]; return obj(k).frame(t - s["t0"] + XF / 2, s["dur"] + XF)


# the audio: voice paragraphs at their places (+ the music under it, ducked, if given)
amix = SRC / "golos" / "_mix.wav"
n_p = len(PARA) - 1
parts = [f"[s{i}]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,adelay={int(v * 1000)}:all=1[p{i}]" for i, (a, b, v) in enumerate(zip(PARA, PARA[1:], VSTART))]
fc = (f"[0]aresample=48000,asplit={n_p}" + "".join(f"[s{i}]" for i in range(n_p)) + ";" + ";".join(parts) + ";"
      + "".join(f"[p{i}]" for i in range(n_p)) + f"amix=inputs={n_p}:normalize=0:duration=longest,apad=whole_dur={END:.3f}[v]")
cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(VOICE)]
if MUSIC:
    cmd += ["-i", MUSIC]
    fc += (f";[v]asplit=2[v1][v2];[1]aresample=48000,aformat=channel_layouts=mono,atrim=0:{END:.3f},volume=0.32,"
           f"afade=t=in:d=1.5,afade=t=out:st={END - 3:.3f}:d=3[m];"
           f"[m][v1]sidechaincompress=threshold=0.04:ratio=6:attack=80:release=600[md];[md][v2]amix=inputs=2:normalize=0[a]")
    out_label = "[a]"
else:
    out_label = "[v]"
subprocess.run(cmd + ["-filter_complex", fc + ";" + out_label + "loudnorm=I=-16:TP=-1.5[o]", "-map", "[o]", "-ar", "48000", "-t", f"{END:.3f}", str(amix)], check=True)

enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                        "-i", str(amix), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
N = int(END * FPS)
for n in range(N):
    t = n / FPS
    k = max(i for i, s in enumerate(shots) if s["t0"] <= t)
    s = shots[k]
    img = shot_frame(k, t)
    if k + 1 < len(shots) and t > s["t0"] + s["dur"] - XF / 2:        # dissolve into the next shot
        u = (t - (s["t0"] + s["dur"] - XF / 2)) / XF; u = u * u * (3 - 2 * u)
        img = cv2.addWeighted(img, 1 - u, shot_frame(k + 1, t), u, 0)
    for j in [j for j in objs if j < k - 1]: del objs[j]
    img = look(img, n)
    # the scene's title: in after its delay, held ~4.5 s (or to just before the scene's first shot ends)
    first = next(i for i, x in enumerate(shots) if x["scene"] == s["scene"])
    f0 = shots[first]
    if f0["title"]:
        ta = f0["scene_t"] + f0["tdel"]; life = min(4.8, f0["t0"] + f0["dur"] - 0.2 - ta)
        if ta <= t < ta + life: img = draw_title(img, f0["title"], t - ta, life)
    if s["kind"] == "p" and isinstance(s["extra"], tuple):              # a still's own title
        ta = s["t0"] + 0.3; life = s["dur"] - 0.5
        if ta <= t < ta + life: img = draw_title(img, s["extra"], t - ta, life)
    # the credit: stills by their licence, the archive footage as INA's
    cr = CR.get(s["name"]) if s["kind"] == "p" else "© INA"
    if cr:
        kk = min(1, max(0, (t - s["t0"]) / 0.4)) * min(1, max(0, (s["t0"] + s["dur"] - t) / 0.4))
        if kk > 0:
            sc = W / 1920; spr = sprite(cr, F_SMALL, int(18 * sc), 0.02)
            img = put(img, spr, W - 40 * sc - (spr[0].shape[1] - 2 * spr[1]), H - 34 * sc, 0.7 * kk)
    if MUSIC and t > END - 4.2:                                          # the music's credit, as its licence asks
        sc = W / 1920; spr = sprite(MUSIC_CREDIT, F_SMALL, int(20 * sc), 0.02)
        kk = min(1, (t - (END - 4.2)) / 0.6)
        img = put(img, spr, (W - (spr[0].shape[1] - 2 * spr[1])) / 2, H - 70 * sc, 0.8 * kk)
    if t < 0.8: img = (img.astype(np.float32) * (t / 0.8)).astype(np.uint8)                    # in from black
    if t > END - 1.5: img = (img.astype(np.float32) * max(0, (END - t) / 1.5)).astype(np.uint8)  # out to black
    enc.stdin.write(img.tobytes())
    if n % (FPS * 10) == 0: print(f"{t:.0f}s / {END:.0f}s", flush=True)
enc.stdin.close(); enc.wait()
print("done", OUT, f"{END:.1f}s")
