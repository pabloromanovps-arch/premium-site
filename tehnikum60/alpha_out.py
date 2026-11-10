"""Writes a picture with transparency as two ordinary files an editor puts together with a track matte
(Premiere: Track Matte Key; DaVinci Resolve: matte / Alpha Mode; After Effects: Luma Matte):
    <name>_FILL.mp4   the picture, colours straight and carried a few pixels past every edge (no dark fringe), with the sound
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
        """bgra: straight (un-premultiplied) colour, as Brand composites it in alpha mode"""
        self.fill.stdin.write(np.ascontiguousarray(bgra[..., :3]).tobytes())
        a8 = bgra[..., 3]
        self.matte.stdin.write(np.ascontiguousarray(np.where(a8 < 3, 0, np.where(a8 > 252, 255, a8)).astype(np.uint8)).tobytes())

    def close(self):
        for p in (self.fill, self.matte): p.stdin.close(); p.wait()
