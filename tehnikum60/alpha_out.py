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
        a = bgra[..., 3:4].astype(np.float32)
        col = bgra[..., :3].astype(np.float32)
        col = np.where(a > 0, np.clip(col * 255 / np.maximum(a, 1), 0, 255), 0).astype(np.uint8)   # un-premultiply
        # beyond the edges, the edge's own colour (grown outwards a few pixels): compression and chroma
        # subsampling then mix the edge with itself, not with black, so no dark fringe after keying
        if (a < 255).any() and (a > 0).any():
            grown = col.copy(); m = (a[..., 0] > 0).astype(np.uint8)
            for _ in range(3):
                d = cv2.dilate(grown, self.k); md = cv2.dilate(m, self.k)
                new = (md > 0) & (m == 0); grown[new] = d[new]; m = md
            col = grown
        self.fill.stdin.write(col.tobytes())
        alpha = bgra[..., 3]; alpha = np.where(alpha < 3, 0, np.where(alpha > 252, 255, alpha)).astype(np.uint8)
        self.matte.stdin.write(np.ascontiguousarray(alpha).tobytes())

    def close(self):
        for p in (self.fill, self.matte): p.stdin.close(); p.wait()
