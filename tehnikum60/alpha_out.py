"""Writes a picture with transparency as two ordinary files an editor puts together with a track matte
(Premiere: Track Matte Key; DaVinci Resolve: matte / Alpha Mode; After Effects: Luma Matte):
    <name>_FILL.mp4   the picture, colours un-premultiplied (no dark fringes at soft edges), with the sound
    <name>_MATTE.mov  white = opaque, black = transparent; lossless (PNG in QuickTime)
A true alpha file (ProRes 4444) would be tens of GB in 4K; these two are small and frame-identical.
"""
import subprocess
import cv2
import numpy as np


class FillMatte:
    def __init__(self, out_base, W, H, fps, audio_args, crf="17"):
        raw = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-"]
        self.fill = subprocess.Popen(raw + audio_args + ["-c:v", "libx264", "-preset", "medium", "-crf", crf, "-pix_fmt", "yuv420p",
                                                         "-movflags", "+faststart", f"{out_base}_FILL.mp4"], stdin=subprocess.PIPE)
        # the matte lossless (PNG frames in a QuickTime .mov, read by Premiere, Resolve, After Effects, Final
        # Cut): transparent is exactly 0, opaque exactly 255, the soft edges exactly as drawn; a flat matte
        # packs small
        self.matte = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{W}x{H}", "-r", str(fps),
                                       "-i", "-", "-c:v", "png", "-pix_fmt", "gray", f"{out_base}_MATTE.mov"], stdin=subprocess.PIPE)
        self.k = np.ones((5, 5), np.uint8)

    def write(self, bgra):
        a8 = bgra[..., 3]
        if a8.min() == 255:                                                # a full-frame shot: as is
            self.fill.stdin.write(np.ascontiguousarray(bgra[..., :3]).tobytes())
            self.matte.stdin.write(np.ascontiguousarray(a8).tobytes()); return
        col = bgra[..., :3].copy()
        edge = (a8 > 0) & (a8 < 255)                                       # un-premultiply the soft edges
        if edge.any():
            col[edge] = np.clip(col[edge].astype(np.float32) * 255 / a8[edge, None].astype(np.float32), 0, 255).astype(np.uint8)
        # the transparent area takes the colour of what is near it (normalised blur at 1/8 size), so
        # compression and chroma subsampling mix an edge with its own colour, not with black: no dark fringe
        h, w = a8.shape; sh = (w // 8, h // 8)
        af = cv2.resize(a8.astype(np.float32) / 255, sh, interpolation=cv2.INTER_AREA)
        cf = cv2.resize(bgra[..., :3].astype(np.float32), sh, interpolation=cv2.INTER_AREA)  # premultiplied already
        af = cv2.blur(af, (15, 15)); cf = cv2.blur(cf, (15, 15))
        ext = cv2.resize(np.clip(cf / np.maximum(af, 1e-3)[..., None], 0, 255).astype(np.uint8), (w, h), interpolation=cv2.INTER_LINEAR)
        t = a8 == 0; col[t] = ext[t]
        self.fill.stdin.write(col.tobytes())
        self.matte.stdin.write(np.ascontiguousarray(np.where(a8 < 3, 0, np.where(a8 > 252, 255, a8)).astype(np.uint8)).tobytes())

    def close(self):
        for p in (self.fill, self.matte): p.stdin.close(); p.wait()
