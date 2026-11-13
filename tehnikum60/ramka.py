"""The frame for the anniversary film on the evening's screen (the stage curtains cover the screen's edges,
so the film is scaled back into a window). Laid out after the client's reference (the Dorogobuzh 60
frame): a large window with rounded corners and a glassy rim, the jubilee logo in a white disc over its
top left corner, decoration over the edges — but in the evening's own style: the client's green ground
(BG.mp4, a seamless 10 s loop), the red shadow of the evening's cards, the «Профессионалитет» colour
stripes slanted as the cards in the bottom right corner, two pulsing points on the rim, a ring of teeth
turning round the logo. Alpha: transparent in the window; one seamless 10 s loop.
    python3 tehnikum60/ramka.py still <out.png> [film_still.jpg]     the look, with a film frame inside
    python3 tehnikum60/ramka.py loop <out.mov>                       4K, 25 fps, 10 s, PNG with alpha
"""
import math, subprocess, sys
from pathlib import Path
import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from brand_vecher import BR, BAR, RED

W, H, FPS, LOOP = 3840, 2160, 25, 10.0
SS = 2                                                   # shapes drawn at 2x and reduced: smooth edges
SCALE = 0.83                                             # the film's size in the frame
WW, WH = int(W * SCALE) // 2 * 2, int(H * SCALE) // 2 * 2
X0, Y0 = W - WW - 120, (H - WH) // 2 + 10                # the window: to the right, the logo needs the left
R = 110                                                  # the window's corner radius
TEAL = (143, 134, 5)                                     # the jubilee logo's teal (BGR)
CYAN = (204, 190, 40)
LIME = (60, 230, 190)


def rrect(mask, x0, y0, w, h, r, val=255):
    """a filled rounded rectangle, on a 2x canvas"""
    x0, y0, w, h, r = (int(v * SS) for v in (x0, y0, w, h, r))
    cv2.rectangle(mask, (x0 + r, y0), (x0 + w - r, y0 + h), val, -1)
    cv2.rectangle(mask, (x0, y0 + r), (x0 + w, y0 + h - r), val, -1)
    for cx, cy in ((x0 + r, y0 + r), (x0 + w - r, y0 + r), (x0 + r, y0 + h - r), (x0 + w - r, y0 + h - r)):
        cv2.circle(mask, (cx, cy), r, val, -1, cv2.LINE_AA)
    return mask


def shrink(m): return cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255


big = lambda: np.zeros((H * SS, W * SS), np.uint8)
HOLE = shrink(rrect(big(), X0, Y0, WW, WH, R))                                   # 1 inside the window
RIM = shrink(rrect(big(), X0 - 7, Y0 - 7, WW + 14, WH + 14, R + 7)) - HOLE      # the white edge, outside
GLASS = HOLE - shrink(rrect(big(), X0 + 26, Y0 + 26, WW - 52, WH - 52, R - 26))  # a glassy band just inside
SHADOW = shrink(rrect(big(), X0 + 48, Y0 + 66, WW, WH, R))                       # the red shadow, as on the cards
SOFT = cv2.GaussianBlur(shrink(rrect(big(), X0, Y0 + 30, WW, WH, R)), (0, 0), 40)  # a soft dark shadow

# the ground, all 250 frames of the loop
cap = cv2.VideoCapture(str(BR / "BG.mp4")); BGF = []
while True:
    ok, f = cap.read()
    if not ok: break
    BGF.append(f)

# the logo: the white-on-green version recoloured to the teal of the original, on a white disc
lg = cv2.imread(str(BR / "logo60_white.png"), cv2.IMREAD_UNCHANGED)
ys, xs = np.where(lg[..., 3] > 10); lg = lg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
white = (lg[..., :3].min(axis=2) > 200)
lg[..., :3][white] = TEAL
DISC_R = 215; DCX, DCY = X0 // 2 - 6, Y0 + 300   # out in the left band: the film's own corner stays clear            # the disc sits over the window's top left corner
LW = int(DISC_R * 1.42); lg = cv2.resize(lg, (LW, int(lg.shape[0] * LW / lg.shape[1])), interpolation=cv2.INTER_AREA)
LX, LY = DCX - LW // 2 - 6, DCY - lg.shape[0] // 2 + 8
LOGO_A = lg[..., 3:4].astype(np.float32) / 255
DISC = big(); cv2.circle(DISC, (DCX * SS, DCY * SS), DISC_R * SS, 255, -1, cv2.LINE_AA); DISC = shrink(DISC)
DISC_SH = cv2.GaussianBlur(np.roll(DISC, 24, axis=0), (0, 0), 30)


def teeth(t):
    """a ring of teeth round the disc, turning one tooth per loop (so the loop is seamless)"""
    m = big(); n = 48; ph = 2 * math.pi / n * (t / LOOP)
    for k in range(n):
        a = 2 * math.pi * k / n + ph
        r0, r1, half = (DISC_R + 16) * SS, (DISC_R + 36) * SS, 0.016
        pts = [(DCX * SS + r * math.cos(a + d), DCY * SS + r * math.sin(a + d)) for r, d in ((r0, -half), (r1, -half * 0.8), (r1, half * 0.8), (r0, half))]
        cv2.fillPoly(m, [np.int32(pts)], 255, cv2.LINE_AA)
    return shrink(m)


def stripes(t):
    """the «Профессионалитет» colour stripes in the bottom right corner, slanted as the evening's cards,
    each swaying a little, one 10 s period"""
    lay = np.zeros((H, W, 3), np.float32); a = np.zeros((H, W), np.float32)
    bx, by, sw, sh_, gap = X0 + WW - 470, Y0 + WH + 20, 50, 330, 16
    for k, c in enumerate(BAR[:7]):
        m = big(); dy = 26 * math.sin(2 * math.pi * (t / LOOP + k / 7))
        x = bx + k * (sw + gap); y0, y1 = by - sh_ * (0.55 + 0.45 * ((k * 37) % 7) / 6) + dy, by + 110 + dy
        lean = 0.295 * (y1 - y0)
        pts = [(x + lean, y0), (x + lean + sw, y0), (x + sw, y1), (x, y1)]
        cv2.fillPoly(m, [np.int32(np.array(pts) * SS)], 255, cv2.LINE_AA); m = shrink(m)
        lay = lay * (1 - m[..., None]) + np.array(c, np.float32) * m[..., None]; a = np.maximum(a, m)
    return lay, a


def dot(img, alpha, cx, cy, t, phase):
    """a lime point on the rim with a ring pulsing out of it (twice per loop)"""
    u = (t / LOOP * 2 + phase) % 1.0
    m = big(); cv2.circle(m, (int(cx * SS), int(cy * SS)), 20 * SS, 255, -1, cv2.LINE_AA); m = shrink(m)
    ring = big(); cv2.circle(ring, (int(cx * SS), int(cy * SS)), int((28 + 70 * u) * SS), 255, 5 * SS, cv2.LINE_AA)
    ring = shrink(ring) * (1 - u)
    for mm in (ring, m):
        img[:] = img * (1 - mm[..., None]) + np.array(LIME, np.float32) * mm[..., None]
        alpha[:] = np.maximum(alpha, mm)


def frame(n):
    t = n / FPS
    img = cv2.resize(BGF[n % len(BGF)], (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    def over(colour, m, k=1.0):
        img[:] = img * (1 - m[..., None] * k) + np.array(colour, np.float32) * m[..., None] * k
    over((30, 50, 20), SOFT * (1 - HOLE), 0.35)
    over(RED, SHADOW * (1 - HOLE))
    over((255, 255, 255), RIM)
    alpha = 1 - HOLE                                                      # the window: transparent...
    over((255, 255, 255), GLASS); alpha = np.maximum(alpha, GLASS * 0.22)   # ...but for the glassy band
    dot(img, alpha, X0 - 4, Y0 + WH * 0.72, t, 0.0)
    dot(img, alpha, X0 + WW + 4, Y0 + WH * 0.42, t, 0.5)
    over((20, 40, 10), DISC_SH, 0.35); alpha = np.maximum(alpha, DISC_SH * 0.35)
    tt = teeth(t); over(CYAN, tt); alpha = np.maximum(alpha, tt)
    over((255, 255, 255), DISC); alpha = np.maximum(alpha, DISC)
    reg = img[LY:LY + lg.shape[0], LX:LX + LW]
    reg[:] = reg * (1 - LOGO_A) + lg[..., :3].astype(np.float32) * LOGO_A
    return np.clip(img, 0, 255).astype(np.uint8), np.clip(alpha * 255 + 0.5, 0, 255).astype(np.uint8)


if __name__ == "__main__":
    mode, out = sys.argv[1], sys.argv[2]
    if mode == "still":
        img, alpha = frame(int(3.0 * FPS))
        under = np.zeros_like(img)
        if len(sys.argv) > 3:                                          # a film frame in the window, to judge the look
            f = cv2.imread(sys.argv[3]); under[Y0:Y0 + WH, X0:X0 + WW] = cv2.resize(f, (WW, WH), interpolation=cv2.INTER_AREA)
        a = alpha[..., None].astype(np.float32) / 255
        cv2.imwrite(out, (img * a + under * (1 - a)).astype(np.uint8))
    else:
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS),
                                "-i", "-", "-c:v", "png", "-pix_fmt", "rgba", out], stdin=subprocess.PIPE)
        for n in range(int(LOOP * FPS)):
            img, alpha = frame(n)
            enc.stdin.write(np.dstack([img, alpha]).tobytes())
            if n % 25 == 0: print(n, flush=True)
        enc.stdin.close(); enc.wait(); print("done", out)
