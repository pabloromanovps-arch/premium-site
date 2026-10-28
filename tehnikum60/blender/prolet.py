# -*- coding: utf-8 -*-
# The closing flythrough: the camera flies calmly forward through 60 years, the film's own stills hanging in
# space all round the path (archive first, then 2008, 2024, 2025, the specialities, the people, Misha last), the
# specialities' icons and the brand's symbols drifting among them, and it lands square on to the
# approved closing frame (flat 2-D: the white logo on the blue). Everything is self-lit (emission),
# so the colours are exactly the stills'; far things fade into the blue.
#   python3 tehnikum60/blender/prolet.py <out dir> <frames: "100,350,600,750" or "all"> [samples] [w]
import math, random, sys
from pathlib import Path
import bpy

HERE = Path(__file__).resolve().parents[1]
TEX = HERE / "prolet_src/tex"
OUT = Path(sys.argv[1]); FRAMES = sys.argv[2] if len(sys.argv) > 2 else "750"
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 64
RES_W = int(sys.argv[4]) if len(sys.argv) > 4 else 3840
FPS, DUR = 50, 20.6   # the flight, the ease round Misha, the landing; the 5 s hold is added at encoding
N = int(FPS * DUR)
BLUE = (2 / 255, 94 / 255, 161 / 255)

def lin(c): return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False   # a denoiser smears the stills' detail; enough samples instead
sc.cycles.filter_width = 1.2
sc.render.use_persistent_data = True   # keep the scene (the 4K stills, the BVH) between frames: no reload per frame
sc.cycles.max_bounces = 0; sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
sc.render.resolution_x, sc.render.resolution_y = RES_W, RES_W * 9 // 16
sc.render.fps = FPS; sc.frame_start, sc.frame_end = 1, N
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"
sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.35
wd = bpy.data.worlds.new("w"); sc.world = wd; wd.use_nodes = True
wd.node_tree.nodes["Background"].inputs[0].default_value = lin(BLUE) + (1,)

FADE_NEAR, FADE_FAR = 13.0, 32.0
def plane_mat(name, img_path, fade=True, alpha=False, tint=0.0, fader=None):
    """emission of the image, mixed towards the blue with distance (and transparent where the image is)"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(str(img_path)); tex.interpolation = "Cubic"
    col = tex.outputs["Color"]
    if fade:
        cam = nt.nodes.new("ShaderNodeCameraData")
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = FADE_NEAR; mr.inputs["From Max"].default_value = FADE_FAR
        nt.links.new(cam.outputs["View Z Depth"], mr.inputs["Value"])
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
        mix.inputs["B"].default_value = lin(BLUE) + (1,)
        nt.links.new(mr.outputs["Result"], mix.inputs["Factor"]); nt.links.new(col, mix.inputs["A"]); col = mix.outputs["Result"]
    if tint:   # pushed towards the blue: a background element, quieter than the stills
        mt = nt.nodes.new("ShaderNodeMix"); mt.data_type = "RGBA"; mt.inputs["Factor"].default_value = tint
        mt.inputs["B"].default_value = lin(BLUE) + (1,); nt.links.new(col, mt.inputs["A"]); col = mt.outputs["Result"]
    em = nt.nodes.new("ShaderNodeEmission"); nt.links.new(col, em.inputs["Color"])
    if alpha:
        tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mx = nt.nodes.new("ShaderNodeMixShader")
        fac = tex.outputs["Alpha"]
        if fader is not None:   # an opacity to keyframe: alpha x value
            mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 0.0
            nt.links.new(fac, mul.inputs[0]); fac = mul.outputs[0]; fader.append(mul.inputs[1])
        nt.links.new(fac, mx.inputs["Fac"]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], out.inputs["Surface"])
    else:
        nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m

def plane(name, w, h, loc, rot, m):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = (w, h, 1); o.data.materials.append(m); return o

# ---------------------------------------------------------------- a calm flight (the client, round 3): one smooth
# path straight on through the past, no weaving; the stills hang all round it (above, below, left, right,
# at different depths), each turned a little towards the viewer, and float past. Misha at the plant is
# last, square across the path; the camera eases left past him, the logo comes up behind him, and it
# settles square on it. Speed and heading are continuous everywhere (one B-spline, one speed profile).
from mathutils import Vector
bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"   # a key every frame: no overshoot
ORDER = [4, 6, 7, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 40, 41, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
         32, 33, 34, 35, 36, 38, 39, 1]
LAST_K = 37
rnd = random.Random(60)
Y0, STEP = 8.0, 2.1
GOLD = math.pi * (3 - math.sqrt(5))
for j, k in enumerate(ORDER):
    y = Y0 + j * STEP
    a = j * GOLD + rnd.uniform(-0.25, 0.25); R = rnd.uniform(3.0, 3.8)
    x, z = R * 1.15 * math.cos(a), R * 0.72 * math.sin(a)
    while not (abs(x) >= 3.0 or abs(z) >= 2.0): x, z = x * 1.05, z * 1.05   # clear of the camera's path
    sz = rnd.uniform(0.92, 1.12)
    q = Vector((0 - x, -10.0, 0 - z)).to_track_quat("Z", "Y")              # facing a point on the path ahead
    e = q.to_euler(); e.rotate_axis("Z", rnd.uniform(-0.05, 0.05))            # a touch of tilt each
    plane(f"still{k:02d}", 3.2 * sz, 1.8 * sz, (x, y, z), e, plane_mat(f"m{k}", HERE / "prolet_src/k" / f"k{k:02d}.jpg"))
Y_LAST = Y0 + (len(ORDER) - 1) * STEP
Y_M = Y_LAST + 14.0                              # Misha, square across the path, bigger
plane(f"still{LAST_K:02d}", 3.2 * 2.0, 1.8 * 2.0, (0, Y_M, 0), (math.pi / 2, 0, 0), plane_mat(f"m{LAST_K}", HERE / "prolet_src/k" / f"k{LAST_K:02d}.jpg"))

# icons: the specialities (white) and the brand's symbols (their colours), few, far out, quiet
icons = sorted(TEX.glob("*_belyy.png")) + sorted(TEX.glob("*_cvet.png"))
def spread(n, gen, min_d, tries=4000):
    pts = []
    for _ in range(tries):
        p = gen()
        if all(sum((p[i] - q[i]) ** 2 for i in range(3)) >= min_d ** 2 for q in pts): pts.append(p)
        if len(pts) >= n: break
    return pts
def field_pt():
    a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(4.6, 6.6)
    return (math.cos(a) * r * 1.2, rnd.uniform(Y0 - 2, Y_LAST - 2), math.sin(a) * r * 0.75)
for i, (x, y, z) in enumerate(spread(26, field_pt, 3.2)):
    sz = rnd.choice([0.55, 0.7, 0.85])
    plane(f"icon{i}", sz, sz, (x, y, z), (math.pi / 2, 0, rnd.uniform(-0.4, 0.4)), plane_mat(f"im{i}", icons[i % len(icons)], alpha=True, tint=0.35))

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); bpy.context.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 32; cam.data.sensor_width = 36
D_STOP = 4.0
fw = D_STOP * cam.data.sensor_width / cam.data.lens
XL, YL = -6.0, Y_M + 7.0   # behind Misha, to his left
LOGO_FADE, WORDS_FADE = [], []
FIN = plane("final", fw, fw * 9 / 16, (XL, YL, 0), (math.pi / 2, 0, 0), plane_mat("mfinal", TEX / "logo_only.png", fade=False, alpha=True, fader=LOGO_FADE))
WORDS = plane("words", fw, fw * 9 / 16, (XL, YL - 0.01, 0), (math.pi / 2, 0, 0), plane_mat("mwords", TEX / "words_only.png", fade=False, alpha=True, fader=WORDS_FADE))

# ---------------------------------------------------------------- the camera: one clamped cubic B-spline
T_LAND = 20.0
CP = [(0, -6, 0), (0, -2, 0)]
yy = 8.0
while yy < Y_M - 22:
    CP.append((0.3 * math.sin(yy / 15.0), yy, 0.22 * math.sin(yy / 21.0 + 1.0))); yy += 12.0
CP += [(0, Y_M - 18, 0), (0, Y_M - 12, 0), (-3.2, Y_M - 6.0, 0), (XL, Y_M - 1.5, 0), (XL, Y_M + 1.5, 0), (XL, YL - D_STOP, 0)]   # wide round him
def bspline(P, n=20000):
    P = [P[0]] * 2 + P + [P[-1]] * 2          # clamped: starts and ends on the end points
    segs = len(P) - 3; out = []
    for i in range(n + 1):
        u = i / n * segs; s = min(int(u), segs - 1); t = u - s
        b = ((1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6)
        out.append(tuple(sum(b[m] * P[s + m][c] for m in range(4)) for c in range(3)))
    return out
PATH = bspline(CP)
ARC = [0.0]
for p, q in zip(PATH, PATH[1:]): ARC.append(ARC[-1] + math.dist(p, q))
L = ARC[-1]
def smoother(u): u = max(0.0, min(1.0, u)); return u * u * u * (u * (u * 6 - 15) + 10)
def accel(t): return smoother(t / 2.5) * (1 - smoother((t - (T_LAND - 4.5)) / 4.5))
TS = [i / 1000 * T_LAND for i in range(1001)]
S = [0.0]
for t0, t1 in zip(TS, TS[1:]): S.append(S[-1] + (accel(t0) + accel(t1)) / 2 * (t1 - t0))
def s_at(t):
    t = max(0.0, min(T_LAND, t)); i = min(999, int(t / T_LAND * 1000)); u = (t - TS[i]) / (TS[i + 1] - TS[i])
    return (S[i] + (S[i + 1] - S[i]) * u) / S[-1] * L
import bisect
def pos_s(s):
    i = max(1, min(len(ARC) - 1, bisect.bisect_left(ARC, s))); a, b = ARC[i - 1], ARC[i]
    u = 0 if b == a else (s - a) / (b - a); p, q = PATH[i - 1], PATH[i]
    return tuple(p[c] + (q[c] - p[c]) * u for c in range(3))
def head_s(s):
    p, q = pos_s(max(0, s - 0.3)), pos_s(min(L, s + 0.3)); return math.atan2(-(q[0] - p[0]), max(1e-6, q[1] - p[1]))
# the gaze: half the heading, smoothed over ~1 s, eased to square on as it lands
GRID = [i / FPS / 4 for i in range(int((T_LAND + 3) * FPS * 4) + 1)]
RAW = [head_s(s_at(t)) * 0.5 for t in GRID]
def yaw_at(t):
    sig = 0.5; w = tot = 0.0
    for d in range(-int(3 * sig * FPS * 4), int(3 * sig * FPS * 4) + 1):
        tt = t + d / FPS / 4; g = math.exp(-0.5 * (d / FPS / 4 / sig) ** 2)
        i = max(0, min(len(RAW) - 1, round(min(tt, T_LAND) * FPS * 4) if tt > 0 else 0))
        w += g * RAW[i]; tot += g
    return w / tot * (1 - smoother((t - (T_LAND - 2.5)) / 2.5))
for f in range(1, N + 1):
    t = (f - 1) / FPS
    cam.location = pos_s(s_at(t)); cam.rotation_euler = (math.pi / 2, 0.0, yaw_at(t))
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)
# the logo comes up as the camera starts round Misha; the words as it settles
def t_at_y(yc):
    for f in range(1, N + 1):
        if pos_s(s_at((f - 1) / FPS))[1] >= yc: return (f - 1) / FPS
    return T_LAND
T_REV = t_at_y(Y_M - 11.0)
for fd, a0, a1 in ((LOGO_FADE[0], T_REV, T_REV + 2.0), (WORDS_FADE[0], T_LAND - 0.6, T_LAND + 0.3)):
    fd.default_value = 0.0; fd.keyframe_insert("default_value", frame=int(a0 * FPS) + 1)
    fd.default_value = 1.0; fd.keyframe_insert("default_value", frame=int(a1 * FPS) + 1)
w0, w1 = int((T_LAND - 0.6) * FPS) + 1, int((T_LAND + 0.3) * FPS) + 1
WORDS.location.z = -0.06; WORDS.keyframe_insert("location", frame=w0)
WORDS.location.z = 0.0; WORDS.keyframe_insert("location", frame=w1)
print("path", round(L, 1), "Y_M", Y_M, "reveal", round(T_REV, 2), "landed", T_LAND)
CAM_TRACK = [(pos_s(s_at((f - 1) / FPS)), yaw_at((f - 1) / FPS)) for f in range(1, N + 1)]
import json; OUT.mkdir(parents=True, exist_ok=True); (OUT / "cam_track.json").write_text(json.dumps(CAM_TRACK))
if FRAMES == "track": sys.exit(0)

OUT.mkdir(parents=True, exist_ok=True)
frames = range(1, N + 1) if FRAMES == "all" else [int(x) for x in FRAMES.split(",")]
import shutil
F_STILL = int((T_LAND + 0.35) * FPS) + 1   # from here the camera has landed and the words are in: every frame is the same
for f in frames:
    if FRAMES == "all" and (OUT / f"f_{f:05d}.png").exists(): continue   # resume an interrupted render
    if FRAMES == "all" and f > F_STILL and (OUT / f"f_{F_STILL:05d}.png").exists():
        shutil.copy(OUT / f"f_{F_STILL:05d}.png", OUT / f"f_{f:05d}.png"); continue
    sc.frame_set(f); sc.render.filepath = str(OUT / f"f_{f:05d}.png")
    bpy.ops.render.render(write_still=True)
    print("frame", f, flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "prolet.blend")) if FRAMES != "all" or True else None
