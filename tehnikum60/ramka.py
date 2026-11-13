"""The frame for the anniversary film on the evening's screen: the stage curtains cover the screen's edges,
so the film is scaled back into a window and the evening's graphics fill the border all round — the
client's animated green ground (BG.mp4, a seamless 10 s loop), the film's window edged in white with the
red shadow of the evening's cards, the jubilee logo «Технология успеха: 60 лет в деле» in the left band
and the «Профессионалитет» colour bar along the bottom. Transparent inside the window (alpha), one
10 s loop: the ground moves as it does in BG.mp4 and a soft light passes over the logo and the bar once
per loop.
    python3 tehnikum60/ramka.py still <out.png> [film_still.jpg]     the look, with a film frame inside
    python3 tehnikum60/ramka.py loop <out.mov>                       4K, 25 fps, 10 s, PNG with alpha
"""
import subprocess, sys
from pathlib import Path
import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from brand_vecher import BR, BAR, BAR_H, RED

W, H, FPS, LOOP = 3840, 2160, 25, 10.0
s = H / 720
SCALE = 0.75                                            # the film's size in the frame
WW, WH = int(W * SCALE), int(H * SCALE)                 # 2880 x 1620
Y0 = int((H - WH) / 2 - 12 * s)                         # a little above centre: the bar takes the bottom
X0 = W - WW - Y0                                        # the same margin right as top: the left band is wider
BORDER = int(4 * s)                                     # the white edge
SHADOW = (int(16 * s), int(22 * s))                     # the red shadow, as on the cards

# the ground, all 250 frames of the loop
cap = cv2.VideoCapture(str(BR / "BG.mp4")); BGF = []
while True:
    ok, f = cap.read()
    if not ok: break
    BGF.append(f)

# the logo, fitted into the left band
lg = cv2.imread(str(BR / "logo60_white.png"), cv2.IMREAD_UNCHANGED)
ys, xs = np.where(lg[..., 3] > 10); lg = lg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
LW = int(X0 * 0.82); lg = cv2.resize(lg, (LW, int(lg.shape[0] * LW / lg.shape[1])), interpolation=cv2.INTER_AREA)
LX, LY = (X0 - LW) // 2 - int(4 * s), Y0 + (WH - lg.shape[0]) // 2
LOGO_A = lg[..., 3].astype(np.float32) / 255

# the bar along the bottom (as on every slide of the evening)
BARL = np.zeros((H, W), np.float32); BARC = np.zeros((H, W, 3), np.uint8); seg = W / len(BAR)
for k, (c, h) in enumerate(zip(BAR, BAR_H)):
    x0, x1, y = int(k * seg), int((k + 1) * seg), H - int(h * s)
    BARC[y:, x0:x1] = c; BARL[y:, x0:x1] = 1

# the window's edge: the red shadow behind, the white rim, the hole
MASK = np.full((H, W), 255, np.uint8); MASK[Y0:Y0 + WH, X0:X0 + WW] = 0
SH = np.zeros((H, W), np.uint8)
cv2.rectangle(SH, (X0 + SHADOW[0], Y0 + SHADOW[1]), (X0 + WW + SHADOW[0], Y0 + WH + SHADOW[1]), 255, -1)
RIM = np.zeros((H, W), np.uint8)
cv2.rectangle(RIM, (X0 - BORDER, Y0 - BORDER), (X0 + WW + BORDER, Y0 + WH + BORDER), 255, -1)


def frame(n):
    t = n / FPS
    img = cv2.resize(BGF[n % len(BGF)], (W, H), interpolation=cv2.INTER_CUBIC)
    img[SH > 0] = RED
    img[RIM > 0] = (255, 255, 255)
    # the light: a soft diagonal band crossing the frame once per loop, seen only on the logo and the bar
    u = (t % LOOP) / LOOP
    p = -0.3 + 1.6 * np.clip((u - 0.55) / 0.3, 0, 1)                    # passes from 5.5 s to 8.5 s, rests the rest
    xs_ = np.arange(W, dtype=np.float32)[None, :] / W; ys_ = np.arange(H, dtype=np.float32)[:, None] / H
    glint = np.exp(-((xs_ + 0.35 * ys_ - p) / 0.05) ** 2) if 0 < u - 0.55 < 0.3 else None
    a = LOGO_A[..., None]; region = img[LY:LY + lg.shape[0], LX:LX + LW].astype(np.float32)
    logo = lg[..., :3].astype(np.float32)
    if glint is not None:
        g = glint[LY:LY + lg.shape[0], LX:LX + LW][..., None]
        logo = logo + (255 - logo) * 0.7 * g                            # the teal teeth light up to white
    img[LY:LY + lg.shape[0], LX:LX + LW] = (region * (1 - a) + logo * a).astype(np.uint8)
    bar = BARC.astype(np.float32)
    if glint is not None: bar = np.minimum(255, bar + 110 * glint[..., None])
    img = np.where(BARL[..., None] > 0, bar.astype(np.uint8), img)
    alpha = MASK.copy()
    return img, alpha


if __name__ == "__main__":
    mode, out = sys.argv[1], sys.argv[2]
    if mode == "still":
        img, alpha = frame(int(7.0 * FPS))
        if len(sys.argv) > 3:                                          # a film frame in the window, to judge the look
            f = cv2.imread(sys.argv[3]); f = cv2.resize(f, (WW, WH), interpolation=cv2.INTER_AREA)
            img[Y0:Y0 + WH, X0:X0 + WW] = f
        cv2.imwrite(out, img)
    else:
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS),
                                "-i", "-", "-c:v", "png", "-pix_fmt", "rgba", out], stdin=subprocess.PIPE)
        for n in range(int(LOOP * FPS)):
            img, alpha = frame(n)
            enc.stdin.write(np.dstack([img, alpha]).tobytes())
            if n % 50 == 0: print(n, flush=True)
        enc.stdin.close(); enc.wait(); print("done", out)
