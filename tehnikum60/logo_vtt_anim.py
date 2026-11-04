"""The VTT logo (a flat raster) taken apart into its pieces and put together on white: the grey gear
turns into place, the blue-red gear arc draws on tooth by tooth, the open book comes forward, the name
writes on line by line, the little book rises, and a glint runs across. The last frame is the logo
exactly as given.
    from logo_vtt_anim import LogoAnim;  LogoAnim(path, scale).frame(t) -> BGR on white
"""
import cv2
import numpy as np

C_RING, R_IN, R_OUT, Y_RING = (380.0, 365.0), 262.0, 350.0, 375.0      # in the source's pixels (748 x 708)
TEXT = (90, 298, 640, 492)                                             # x0, y0, x1, y1
GEAR_C = (205.0, 175.0)                                                # the grey gear's hub (approx.)


def ease(u): u = min(1.0, max(0.0, u)); return u * u * (3 - 2 * u)
def ease_out(u): u = min(1.0, max(0.0, u)); return 1 - (1 - u) ** 3


class LogoAnim:
    DUR = 3.4

    def __init__(self, path, scale):
        src = cv2.imread(str(path))
        self.s = scale
        im = cv2.resize(src, None, fx=scale, fy=scale, interpolation=cv2.INTER_LANCZOS4)
        bl = cv2.GaussianBlur(im, (0, 0), 1.0); im = cv2.addWeighted(im, 1.25, bl, -0.25, 0)
        self.im = im.astype(np.float32); h, w = im.shape[:2]; self.h, self.w = h, w
        ink = np.clip((255 - im.min(axis=2).astype(np.float32) - 10) / 40, 0, 1)
        sat = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)[..., 1].astype(np.float32)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32) / scale
        r = np.hypot(xx - C_RING[0], yy - C_RING[1])
        ring = (r >= R_IN) & (r <= R_OUT) & (yy > Y_RING)
        x0, y0, x1, y1 = TEXT
        text = ~ring & (yy >= y0) & (yy <= y1) & (xx >= x0) & (xx <= x1) & (r < R_IN)
        small = ~ring & ~text & (yy > y1)
        grey0 = ~ring & ~text & ~small & (sat < 60) & (yy < 330) & (ink > 0.3)
        # the gear is the one big grey blob; the book's light lines are grey too, but apart from it
        n, lab, st, _ = cv2.connectedComponentsWithStats(grey0.astype(np.uint8), 8)
        big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])) if n > 1 else 0
        blob = cv2.morphologyEx((lab == big).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((int(9 * scale),) * 2, np.uint8)) > 0
        grey = ~ring & ~text & ~small & blob & (sat < 60)
        book = ~ring & ~text & ~small & ~grey
        soft = lambda m: cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2 * scale) * ink
        self.L = dict(ring=soft(ring), text=soft(text), small=soft(small), grey=soft(grey), book=soft(book))
        # sweep coordinates: the ring's angle (left end -> right end), the text's x within each line
        self.ang = np.arctan2(yy - C_RING[1], xx - C_RING[0])         # ~pi (left) .. 0 (right), positive below
        self.xx, self.yy = xx, yy

    def _warp(self, layer, rgb, M):
        return (cv2.warpAffine(layer, M, (self.w, self.h), flags=cv2.INTER_LINEAR),
                cv2.warpAffine(rgb, M, (self.w, self.h), flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255)))

    def frame(self, t):
        """built from its pieces (the client chose this): the grey gear turns into place, the gear arc
        draws on tooth by tooth, the book comes forward, the name writes on line by line, the little book
        rises, a glint runs across; from 2.5 s on it is the logo exactly as given"""
        out = np.full((self.h, self.w, 3), 255.0, np.float32)
        def put(mask, rgb):
            nonlocal out
            out = out * (1 - mask[..., None]) + rgb * mask[..., None]
        s = self.s
        u = ease_out(t / 1.1)
        if u > 0:
            M = cv2.getRotationMatrix2D((GEAR_C[0] * s, GEAR_C[1] * s), -35 * (1 - u), 1.0)
            m, c = self._warp(self.L["grey"], self.im, M); put(m * ease(t / 0.5), c)
        u = ease((t - 0.25) / 1.2)
        if u > 0:
            front = np.pi - u * (np.pi + 0.35)
            m = self.L["ring"] * np.clip((self.ang - front) / 0.25, 0, 1)
            M = cv2.getRotationMatrix2D((C_RING[0] * s, C_RING[1] * s), 12 * (1 - u), 1.0)
            m2, c = self._warp(m, self.im, M); put(m2, c)
        u = ease_out((t - 0.55) / 0.95)
        if u > 0:
            M = cv2.getRotationMatrix2D((520 * s, 150 * s), 0, 0.9 + 0.1 * u)
            m, c = self._warp(self.L["book"], self.im, M); put(m * ease((t - 0.55) / 0.5), c)
        for k, (ya, yb) in enumerate([(298, 368), (368, 428), (428, 492)]):
            u = ease((t - 1.0 - 0.3 * k) / 0.6)
            if u <= 0: continue
            x0, _, x1, _ = TEXT
            front = x0 + (x1 - x0 + 60) * u
            band = (self.yy >= ya) & (self.yy < yb)
            put(self.L["text"] * band * np.clip((front - self.xx) / 40, 0, 1), self.im)
        u = ease_out((t - 1.8) / 0.7)
        if u > 0:
            M = np.float32([[1, 0, 0], [0, 1, 18 * s * (1 - u)]])
            m, c = self._warp(self.L["small"], self.im, M); put(m * u, c)
        g = (t - 2.5) / 0.8
        if 0 < g < 1:
            d = (self.xx * 0.8 + self.yy * 0.6) / 1000.0
            band = np.exp(-((d - (-0.1 + 1.3 * g)) / 0.05) ** 2)
            out = out + (255 - out) * (0.45 * band * sum(self.L.values()))[..., None]
        return np.clip(out, 0, 255).astype(np.uint8)


if __name__ == "__main__":
    import sys
    a = LogoAnim(sys.argv[1], 1.0)
    row = [cv2.resize(a.frame(t), (374, 354)) for t in (0.3, 0.7, 1.1, 1.5, 1.9, 2.3, 2.8, 3.4)]
    cv2.imwrite(sys.argv[2], np.vstack([np.hstack(row[:4]), np.hstack(row[4:])]))
