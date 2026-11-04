"""The VTT logo on white, kept whole and readable at every moment (the client: never split it): it
opens out of a soft circle from the centre while settling to size, a glint runs across, and it stays.
The last frame is the logo exactly as given.
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
        """the logo whole, never taken apart: it opens out of a soft circle from the centre while
        settling from slightly small to its size, then a glint runs across it, and it stays"""
        out = np.full((self.h, self.w, 3), 255.0, np.float32)
        u = ease_out(t / 1.3)
        z = 0.93 + 0.07 * u
        M = cv2.getRotationMatrix2D((self.w / 2, self.h / 2), 0, z)
        ink = sum(self.L.values())
        m = cv2.warpAffine(ink, M, (self.w, self.h), flags=cv2.INTER_LINEAR)
        c = cv2.warpAffine(self.im, M, (self.w, self.h), flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255))
        yy, xx = np.mgrid[0:self.h, 0:self.w].astype(np.float32)
        rr = np.hypot(xx - self.w / 2, yy - self.h / 2) / (0.5 * np.hypot(self.w, self.h))
        reveal = np.clip((1.15 * ease_out(t / 1.1) - rr) / 0.18, 0, 1) * min(1.0, t / 0.4)
        m = m * reveal
        out = out * (1 - m[..., None]) + c * m[..., None]
        g = (t - 1.6) / 0.9
        if 0 < g < 1:
            d = (self.xx * 0.8 + self.yy * 0.6) / 1000.0
            band = np.exp(-((d - (-0.1 + 1.3 * g)) / 0.05) ** 2)
            out = out + (255 - out) * (0.4 * band * m)[..., None]
        return np.clip(out, 0, 255).astype(np.uint8)


if __name__ == "__main__":
    import sys
    a = LogoAnim(sys.argv[1], 1.0)
    row = [cv2.resize(a.frame(t), (374, 354)) for t in (0.3, 0.7, 1.1, 1.5, 1.9, 2.3, 2.8, 3.4)]
    cv2.imwrite(sys.argv[2], np.vstack([np.hstack(row[:4]), np.hstack(row[4:])]))
