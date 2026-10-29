"""Award portraits in one corporate look: the person cut out onto clean white, the same 4:5 frame,
the head at the same size and height in every picture, light and colour evened out gently (the faces
themselves are not redrawn: only exposure, white balance and a touch of local contrast).
    python3 tehnikum60/tools/portrety.py <in dir> <out dir> [width=2000]
"""
import sys
from pathlib import Path
import cv2
import numpy as np
from rembg import new_session, remove
from pymatting import estimate_foreground_ml

SRC, DST = Path(sys.argv[1]), Path(sys.argv[2])   # SRC: a folder, or one photo
W = int(sys.argv[3]) if len(sys.argv) > 3 else 2000
H = W * 5 // 4
FACE_H = 0.345     # the detected face box, as a share of the frame height
FACE_TOP = 0.21    # where the top of that box sits
WORK = 2000        # matting and colour work at this long side (the originals are about 2000 px)
DST.mkdir(parents=True, exist_ok=True)
session = new_session("birefnet-portrait")
FACE_MODEL = str(Path(__file__).resolve().parent / "models/face_yunet.onnx")   # OpenCV zoo, YuNet 2023mar


def even_light(img, face):
    """the colours as shot (no white-balance shift: skin stays true); only the brightness of the face
    brought to a common level, gently, and a touch of local contrast"""
    x, y, w, h = [int(v) for v in face]
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    L = lab[..., 0].astype(np.float32)
    fl = L[y + h // 4: y + h * 3 // 4, x + w // 4: x + w * 3 // 4].mean()
    g = float(np.clip(150.0 / max(fl, 1.0), 0.88, 1.18))       # face brightness to ~150 of 255, within limits
    L = 255.0 * (L / 255.0) ** (1.0 / g)                         # a curve, not a gain: no clipped highlights
    cl = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(8, 8)).apply(np.clip(L, 0, 255).astype(np.uint8)).astype(np.float32)
    lab[..., 0] = np.clip(0.75 * L + 0.25 * cl, 0, 255).astype(np.uint8)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def face_box(img):
    s = 800 / max(img.shape[:2])
    sm = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    det = cv2.FaceDetectorYN.create(FACE_MODEL, "", (sm.shape[1], sm.shape[0]), 0.7)
    _, fs = det.detect(sm)
    if fs is None or len(fs) == 0: return None
    x, y, w, h = max(fs, key=lambda r: r[2] * r[3])[:4]
    return np.array([x, y, w, h]) / s


for p in ([SRC] if SRC.is_file() else sorted(SRC.glob("*.jpg"))):
    img = cv2.imread(str(p))
    k = WORK / max(img.shape[:2])
    small = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
    a = np.asarray(remove(rgb, session=session, only_mask=True)).astype(np.float32) / 255.0
    a = np.where(a < 0.03, 0, np.where(a > 0.97, 1, a))
    # true foreground colours at the soft edges (no green or grey halo from the old background)
    # (estimated at half size, used only where the edge is soft: the memory stays small)
    hs = 0.5; rh = cv2.resize(rgb, None, fx=hs, fy=hs, interpolation=cv2.INTER_AREA); ah = cv2.resize(a, (rh.shape[1], rh.shape[0]))
    fe = estimate_foreground_ml(rh.astype(np.float64) / 255.0, ah.astype(np.float64)) * 255.0
    fe = cv2.resize(np.clip(fe, 0, 255).astype(np.float32), (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC)
    edge = ((a > 0.02) & (a < 0.98)).astype(np.float32)
    edge = cv2.GaussianBlur(cv2.dilate(edge, np.ones((5, 5), np.uint8)), (0, 0), 2)[..., None]
    fg = rgb.astype(np.float32) * (1 - edge) + fe * edge
    fg = cv2.cvtColor(np.clip(fg, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    fb = face_box(small)
    if fb is None:
        print("no face:", p.name); continue
    fg = even_light(fg, fb)
    x, y, w, h = fb
    s = FACE_H * H / h
    # place: face centred, its top at FACE_TOP, the same size in every picture (FACE_H is chosen so
    # that even the photo with the least body below the face still fills the frame to the bottom)
    ty = FACE_TOP * H - y * s
    tx = W / 2 - (x + w / 2) * s
    M = np.float32([[s, 0, tx], [0, s, ty]])
    fgw = cv2.warpAffine(fg, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    aw = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    out = fgw.astype(np.float32) * aw[..., None] + 255.0 * (1 - aw[..., None])
    # a light sharpen to restore what the resampling softened
    bl = cv2.GaussianBlur(out, (0, 0), 1.2)
    out = np.clip(out * 1.2 - bl * 0.2, 0, 255).astype(np.uint8)
    cv2.imwrite(str(DST / f"{p.stem}.jpg"), out, [cv2.IMWRITE_JPEG_QUALITY, 96])
    rgba = np.dstack([fgw, (aw * 255).astype(np.uint8)])
    cv2.imwrite(str(DST / f"{p.stem}_alfa.png"), rgba)
    print(p.name, "scale %.2f" % s, flush=True)
