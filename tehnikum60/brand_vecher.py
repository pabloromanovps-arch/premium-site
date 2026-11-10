"""The evening's approved graphic format («Профессионалитет», VTT 60), drawn in code so it scales to any
size: the green ground with faint line drawings, the slanted white card with its red shadow, the
corner wordmark, the blue «60» badge, the coloured bar along the bottom, and the slanted colour-stripe
wipe (VTT60_GRAFIKA/02_FONY_I_PEREKHOD/04_PEREKHOD_polosy.mov, cached as PNGs).
    from brand_vecher import Brand;  b = Brand(W, H)
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
BR = HERE / "vedushie_src" / "brand"
GREEN = (106, 166, 70)                         # BGR, sampled from the approved graphics
RED = (36, 64, 238)
BADGE = (161, 93, 20)
BAR = [(212, 159, 0), (76, 146, 67), (30, 122, 244), (138, 102, 67), (183, 171, 162), (34, 64, 239), (156, 93, 22), (223, 123, 40)]
BAR_H = [32, 31, 24, 22, 26, 28, 30, 30]      # per segment, in 720p pixels
SKEW = 0.295                                    # the card's lean: x shift per unit of height


def _font(size):
    return ImageFont.truetype(str(HERE / "fonts" / "dela.ttf"), size)


class Brand:
    def __init__(self, W, H):
        self.W, self.H = W, H; s = self.s = H / 720
        self.ground = self._ground()
        self.over = self._overlay()                                 # RGBA: wordmark, badge, bar
        logo = cv2.imread(str(BR / "logo60_white.png"), cv2.IMREAD_UNCHANGED)
        ys, xs = np.where(logo[..., 3] > 10); self.logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        self.wipe_files = sorted((BR / "perekhod").glob("*.png")); self._wipe = {}

    # the green ground with large faint outlines (gears, triangles, rings) like the approved slides
    def _ground(self):
        W, H, s = self.W, self.H, self.s
        g = np.zeros((H, W, 3), np.uint8); g[:] = GREEN
        lay = g.copy(); col = (88, 178, 122); th = max(1, int(2.2 * s))
        rng = np.random.default_rng(7)
        for _ in range(9):
            x, y, r = int(rng.uniform(0, W)), int(rng.uniform(0, H)), int(rng.uniform(60, 150) * s)
            kind = rng.integers(3)
            if kind == 0:                                           # a gear: ring + teeth
                cv2.circle(lay, (x, y), r, col, th, cv2.LINE_AA); cv2.circle(lay, (x, y), int(r * 0.45), col, th, cv2.LINE_AA)
                for a in np.linspace(0, 2 * np.pi, 12, endpoint=False):
                    p1 = (int(x + r * np.cos(a)), int(y + r * np.sin(a))); p2 = (int(x + r * 1.18 * np.cos(a)), int(y + r * 1.18 * np.sin(a)))
                    cv2.line(lay, p1, p2, col, th * 3, cv2.LINE_AA)
            elif kind == 1:                                         # a triangle
                pts = np.array([[x, y - r], [x - int(r * 0.9), y + int(r * 0.6)], [x + int(r * 0.9), y + int(r * 0.6)]], np.int32)
                cv2.polylines(lay, [pts], True, col, th, cv2.LINE_AA)
            else:                                                   # a wrench-like bar
                cv2.line(lay, (x - r, y + r), (x + r, y - r), col, th, cv2.LINE_AA)
                cv2.circle(lay, (x + r, y - r), int(r * 0.25), col, th, cv2.LINE_AA)
        return cv2.addWeighted(g, 0.55, lay, 0.45, 0)

    def _overlay(self):
        W, H, s = self.W, self.H, self.s
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        f = _font(int(17 * s)); word = "ПРОФЕССИОНАЛИТЕТ"
        x0, y0 = int(32 * s), int(30 * s); asc = f.getbbox("П")[3]
        # the corner: ПРОФЕСС up the left side, ИОНАЛИТЕТ across the top, meeting at the corner
        v = Image.new("RGBA", (int(f.getlength(word[:7])) + 4, asc + 6), (0, 0, 0, 0))
        ImageDraw.Draw(v).text((0, 0), word[:7], font=f, fill=(255, 255, 255, 255))
        v = v.rotate(90, expand=True); im.alpha_composite(v, (x0, y0))
        d.text((x0 + v.size[0] + int(3 * s), y0 - int(1 * s)), word[7:], font=f, fill=(255, 255, 255, 255))
        # the bar along the bottom
        seg = W / len(BAR)
        for k, (c, h) in enumerate(zip(BAR, BAR_H)):
            d.rectangle([int(k * seg), H - int(h * s), int((k + 1) * seg), H], fill=(c[2], c[1], c[0], 255))
        a = np.array(im); return a[..., [2, 1, 0, 3]].copy()          # RGBA -> BGRA

    def badge(self, img, alpha=1.0):
        """the blue slanted «60» badge, top right"""
        W, s = self.W, self.s
        x1, y0, w, h = W - int(34 * s), int(34 * s), int(122 * s), int(120 * s)
        pts = np.array([[x1 - w + int(h * 0.25), y0], [x1, y0], [x1 - int(h * 0.25), y0 + h], [x1 - w, y0 + h]], np.int32)
        lay = img.copy(); cv2.fillPoly(lay, [pts], BADGE, cv2.LINE_AA); img = cv2.addWeighted(img, 1 - alpha, lay, alpha, 0)
        lw = int(w * 0.62); lg = cv2.resize(self.logo, (lw, int(self.logo.shape[0] * lw / self.logo.shape[1])), interpolation=cv2.INTER_AREA)
        cx, cy = x1 - w // 2, y0 + h // 2
        return self.paste(img, lg, cx - lg.shape[1] // 2, cy - lg.shape[0] // 2, alpha)

    @staticmethod
    def paste(img, rgba, x, y, alpha=1.0):
        h, w = rgba.shape[:2]; H, W = img.shape[:2]
        x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        if x1 <= x0 or y1 <= y0: return img
        sub = rgba[y0 - y:y1 - y, x0 - x:x1 - x].astype(np.float32); k = sub[..., 3:4] / 255 * alpha
        img[y0:y1, x0:x1] = (img[y0:y1, x0:x1].astype(np.float32) * (1 - k) + sub[..., :3] * k).astype(np.uint8)
        return img

    def frame_on(self, img, alpha=1.0):
        """the wordmark, the badge and the bottom bar over any picture"""
        img = self.paste(img, self.over, 0, 0, alpha)
        return self.badge(img, alpha)

    def card_quad(self, cx, cy, w, h):
        """the corners of a slanted card centred at (cx, cy), w = top edge width, h = height"""
        d = SKEW * h / 2
        return np.float32([[cx - w / 2 + d, cy - h / 2], [cx + w / 2 + d, cy - h / 2], [cx + w / 2 - d, cy + h / 2], [cx - w / 2 - d, cy + h / 2]])

    def card(self, img, picture, cx, cy, w, h, alpha=1.0, white=0.0):
        """a picture inside a slanted white-edged card with the red shadow; `picture` is BGR, any size
        (it is cover-fitted into the card's box); white = 1 shows the bare white card (its entrance)"""
        s = self.s; q = self.card_quad(cx, cy, w, h)
        sh = q + np.float32([16 * s, 22 * s])
        bw, bh = int(w + SKEW * h) + 2, int(h) + 2
        x0, y0 = int(q[:, 0].min()), int(q[:, 1].min())
        sc = max(bw / picture.shape[1], bh / picture.shape[0])
        M = np.float32([[sc, 0, x0 + bw / 2 - picture.shape[1] * sc / 2], [0, sc, y0 + bh / 2 - picture.shape[0] * sc / 2]])
        pic = cv2.warpAffine(picture, M, (self.W, self.H), flags=cv2.INTER_AREA if sc < 1 else cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        if white > 0: pic = cv2.addWeighted(pic, 1 - white, np.full_like(pic, 255), white, 0)
        m_sh = np.zeros((self.H, self.W), np.uint8); cv2.fillPoly(m_sh, [sh.astype(np.int32)], 255, cv2.LINE_AA)
        m = np.zeros((self.H, self.W), np.uint8); cv2.fillPoly(m, [q.astype(np.int32)], 255, cv2.LINE_AA)
        k = (m_sh.astype(np.float32) / 255 * alpha)[..., None]
        out = img.astype(np.float32) * (1 - k) + np.float32(RED) * k
        k = (m.astype(np.float32) / 255 * alpha)[..., None]
        out = out * (1 - k) + pic.astype(np.float32) * k
        return out.astype(np.uint8)

    def wipe(self, u):
        """the colour-stripe wipe at u in 0..1 (it covers the frame fully from u ~ 0.33 to 0.6); RGBA at W x H"""
        i = min(len(self.wipe_files) - 1, max(0, int(round(u * 40))))
        if i not in self._wipe:
            self._wipe = {i: cv2.resize(cv2.imread(str(self.wipe_files[i]), cv2.IMREAD_UNCHANGED), (self.W, self.H), interpolation=cv2.INTER_LINEAR)}
        return self._wipe[i]

    def logo_screen(self, scale=0.5):
        """the green ground with the white «60» mark in the middle (the opening and closing screen)"""
        img = self.ground.copy(); lh = int(self.H * scale)
        lg = cv2.resize(self.logo, (int(self.logo.shape[1] * lh / self.logo.shape[0]), lh), interpolation=cv2.INTER_AREA)
        img = self.paste(img, lg, (self.W - lg.shape[1]) // 2, (self.H - lg.shape[0]) // 2 - int(10 * self.s))
        return self.paste(img, self.over, 0, 0)
