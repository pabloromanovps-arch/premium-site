"""Writes a picture with transparency as two ordinary files an editor puts together with a track matte
(Premiere: Track Matte Key; DaVinci Resolve: matte / Alpha Mode; After Effects: Luma Matte):
    <name>_FILL.mp4   the picture, colours un-premultiplied (no dark fringes at soft edges), with the sound
    <name>_MATTE.mp4  white = opaque, black = transparent
A true alpha file (ProRes 4444) would be tens of GB in 4K; these two are small and frame-identical.
"""
import subprocess
import numpy as np


class FillMatte:
    def __init__(self, out_base, W, H, fps, audio_args, crf="17"):
        raw = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-"]
        self.fill = subprocess.Popen(raw + audio_args + ["-c:v", "libx264", "-preset", "medium", "-crf", crf, "-pix_fmt", "yuv420p",
                                                         "-movflags", "+faststart", f"{out_base}_FILL.mp4"], stdin=subprocess.PIPE)
        self.matte = subprocess.Popen(raw + ["-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p",
                                             "-movflags", "+faststart", f"{out_base}_MATTE.mp4"], stdin=subprocess.PIPE)

    def write(self, bgra):
        a = bgra[..., 3:4].astype(np.float32)
        col = bgra[..., :3].astype(np.float32)
        col = np.where(a > 0, np.clip(col * 255 / np.maximum(a, 1), 0, 255), 0)      # un-premultiply
        self.fill.stdin.write(col.astype(np.uint8).tobytes())
        self.matte.stdin.write(np.repeat(bgra[..., 3:4], 3, axis=2).tobytes())

    def close(self):
        for p in (self.fill, self.matte): p.stdin.close(); p.wait()
