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
    def __init__(self, W, H, alpha=False):
        """alpha: the pictures go out with a transparency matte and without the ground, the badge, the
        corner wordmarks and the bar (the editor lays the evening's original background and logo under them)"""
        self.W, self.H = W, H; s = self.s = H / 720; self.alpha = alpha
        self.ground = np.zeros((H, W, 4), np.uint8) if alpha else self._ground()
        self.over = self._overlay()                                 # RGBA: wordmark, badge, bar
        logo = cv2.imread(str(BR / "logo60_white.png"), cv2.IMREAD_UNCHANGED)
        ys, xs = np.where(logo[..., 3] > 10); self.logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        self.wipe_files = sorted((BR / "perekhod").glob("*.png")); self._wipe = {}

    # the approved ground: the green with the «Профессионалитет» icons as faint outlines, rebuilt clean
    # from the evening's slides (nov.pdf: per pixel, the green/outline value from the pages it shows on)
    def _ground(self):
        g = cv2.imread(str(BR / "podlozhka_4k.png"))
        return cv2.resize(g, (self.W, self.H), interpolation=cv2.INTER_AREA)

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
        # and its mirror in the bottom right corner: ПРОФЕСС across the bottom, ИОНАЛИТЕТ up the right side
        v2 = Image.new("RGBA", (int(f.getlength(word[7:])) + 4, asc + 6), (0, 0, 0, 0))
        ImageDraw.Draw(v2).text((0, 0), word[7:], font=f, fill=(255, 255, 255, 255))
        v2 = v2.rotate(90, expand=True)
        xr, yb = W - int(32 * s) - v2.size[0], H - int(44 * s)
        im.alpha_composite(v2, (xr, yb - v2.size[1]))
        d.text((xr - int(3 * s) - int(f.getlength(word[:7])), yb - asc - int(2 * s)), word[:7], font=f, fill=(255, 255, 255, 255))
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
    def _over(dst, src_col, k, grow=None):
        """`src_col` (H x W x 3) over the region `dst` (BGR or BGRA, uint8, edited in place) with coverage
        k (H x W x 1, 0..1). With BGRA the colour stays straight (un-premultiplied); where `grow` (a
        slightly larger mask) says so, the fully transparent pixels just outside take the source colour
        too, so the fill never fades to black at an edge. Full coverage is a plain copy (fast)."""
        k2 = k[..., 0]; full = k2 >= 0.999; part = (k2 > 0.001) & ~full
        src = src_col if src_col.dtype == np.uint8 else np.clip(src_col, 0, 255).astype(np.uint8)
        if dst.shape[2] == 4:
            if grow is not None:
                ring = grow[..., 0] & (dst[..., 3] == 0) & ~full & ~part
                dst[ring, :3] = src[ring]
            dst[full, :3] = src[full]; dst[full, 3] = 255
            if part.any():
                d = dst[part].astype(np.float32); kk = k2[part][:, None]; sc = src[part].astype(np.float32)
                a = d[:, 3:4] / 255; na = kk + a * (1 - kk)
                col = (sc * kk + d[:, :3] * a * (1 - kk)) / np.maximum(na, 1e-4)
                dst[part] = np.clip(np.concatenate([col, na * 255], axis=1), 0, 255).astype(np.uint8)
        else:
            dst[full] = src[full]
            if part.any():
                d = dst[part].astype(np.float32); kk = k2[part][:, None]
                dst[part] = np.clip(d * (1 - kk) + src[part].astype(np.float32) * kk, 0, 255).astype(np.uint8)

    @staticmethod
    def paste(img, rgba, x, y, alpha=1.0):
        h, w = rgba.shape[:2]; H, W = img.shape[:2]
        x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        if x1 <= x0 or y1 <= y0: return img
        sub = rgba[y0 - y:y1 - y, x0 - x:x1 - x]
        k = sub[..., 3:4].astype(np.float32) / 255 * alpha
        Brand._over(img[y0:y1, x0:x1], np.ascontiguousarray(sub[..., :3]), k, grow=k > 0)
        return img

    def use_bg(self, path):
        """the client's own animated background (BG.mp4, a 10 s loop) as the ground; their logo goes on
        top in the edit, so no wordmarks / badge / bar from here"""
        cap = cv2.VideoCapture(str(path)); self.bg_frames = []
        while True:
            ok, f = cap.read()
            if not ok: break
            self.bg_frames.append(f)
        self.bg_fps = cap.get(cv2.CAP_PROP_FPS) or 25; self.no_overlay = True

    def ground_at(self, t):
        if not getattr(self, "bg_frames", None): return self.ground.copy()
        f = self.bg_frames[int(round(t * self.bg_fps)) % len(self.bg_frames)]
        return cv2.resize(f, (self.W, self.H), interpolation=cv2.INTER_CUBIC) if f.shape[1] != self.W else f.copy()

    def frame_on(self, img, alpha=1.0):
        """the wordmark, the badge and the bottom bar over any picture (not in the alpha or BG version)"""
        if self.alpha or getattr(self, "no_overlay", False): return img
        img = self.paste(img, self.over, 0, 0, alpha)
        return self.badge(img, alpha)

    def card_quad(self, cx, cy, w, h):
        """the corners of a slanted card centred at (cx, cy), w = top edge width, h = height"""
        d = SKEW * h / 2
        return np.float32([[cx - w / 2 + d, cy - h / 2], [cx + w / 2 + d, cy - h / 2], [cx + w / 2 - d, cy + h / 2], [cx - w / 2 - d, cy + h / 2]])

    def card(self, img, picture, cx, cy, w, h, alpha=1.0, white=0.0):
        """a picture inside a slanted white-edged card with the red shadow; `picture` is BGR(A), any size
        (it is cover-fitted into the card's box); white = 1 shows the bare white card (its entrance).
        Only the card's own box is worked on (fast at 4K)."""
        s = self.s; q = self.card_quad(cx, cy, w, h)
        sh = q + np.float32([16 * s, 22 * s])
        pad = int(6 * s) + 2
        allp = np.vstack([q, sh])
        bx0, by0 = max(0, int(allp[:, 0].min()) - pad), max(0, int(allp[:, 1].min()) - pad)
        bx1, by1 = min(self.W, int(allp[:, 0].max()) + pad), min(self.H, int(allp[:, 1].max()) + pad)
        if bx1 <= bx0 or by1 <= by0: return img
        bw_, bh_ = bx1 - bx0, by1 - by0
        if picture.shape[2] == 4: picture = picture[..., :3]
        cw, ch = w + SKEW * h, h                                       # the card's own box
        x0, y0 = q[:, 0].min() - bx0, q[:, 1].min() - by0
        sc = max(cw / picture.shape[1], ch / picture.shape[0])
        M = np.float32([[sc, 0, x0 + cw / 2 - picture.shape[1] * sc / 2], [0, sc, y0 + ch / 2 - picture.shape[0] * sc / 2]])
        pic = cv2.warpAffine(picture, M, (bw_, bh_), flags=cv2.INTER_AREA if sc < 1 else cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
        if white > 0: pic = cv2.addWeighted(pic, 1 - white, np.full_like(pic, 255), white, 0)
        off = np.float32([bx0, by0]); kern = np.ones((3, 3), np.uint8)
        region = img[by0:by1, bx0:bx1]
        for quad, colour in ((sh, np.float32(RED)), (q, None)):
            m = np.zeros((bh_, bw_), np.uint8); cv2.fillPoly(m, [(quad - off).astype(np.int32)], 255, cv2.LINE_AA)
            k = (m.astype(np.float32) / 255 * alpha)[..., None]
            grow = (cv2.dilate(m, kern, iterations=int(3 * s) + 1) > 0)[..., None] if region.shape[2] == 4 else None
            src = pic if colour is None else np.broadcast_to(colour.astype(np.uint8), (bh_, bw_, 3))
            self._over(region, src, k, grow)
        return img

    def wipe(self, u):
        """the colour-stripe wipe at u in 0..1 (it covers the frame fully from u ~ 0.33 to 0.6); RGBA at W x H"""
        i = min(len(self.wipe_files) - 1, max(0, int(round(u * 40))))
        if i not in self._wipe:
            self._wipe = {i: cv2.resize(cv2.imread(str(self.wipe_files[i]), cv2.IMREAD_UNCHANGED), (self.W, self.H), interpolation=cv2.INTER_LINEAR)}
        return self._wipe[i]

    def logo_screen(self, scale=0.5):
        """the green ground with the white «60» mark in the middle (the opening and closing screen);
        in the alpha version: nothing (transparent), the editor's own background and logo show"""
        img = self.ground.copy(); lh = int(self.H * scale)
        if self.alpha: return img
        lg = cv2.resize(self.logo, (int(self.logo.shape[1] * lh / self.logo.shape[0]), lh), interpolation=cv2.INTER_AREA)
        img = self.paste(img, lg, (self.W - lg.shape[1]) // 2, (self.H - lg.shape[0]) // 2 - int(10 * self.s))
        return self.paste(img, self.over, 0, 0)
