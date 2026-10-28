# -*- coding: utf-8 -*-
# The closing flythrough: the camera flies forward through 60 years, weaving round the film's own stills hanging in
# space (archive first, then 2008, 2024, 2025, the specialities, the people, Misha last), the
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
FPS, DUR = 50, 19.0   # the flight, the turn round Misha, the landing; the 5 s hold is added at encoding
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

FADE_NEAR, FADE_FAR = 18.0, 46.0
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

# ---------------------------------------------------------------- a slalom (the client): the stills stand in the
# way like walls, on the left and the right in turn; the camera flies on and weaves round each, never
# through. Misha at the plant stands last, square across the path; the camera rounds him on the left,
# and the logo is hidden there, behind and to the left: it turns and lands square on it.
ORDER = [4, 6, 7, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 40, 41, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
         32, 33, 34, 35, 36, 38, 39, 1]
LAST_K = 37
rnd = random.Random(60)
Y0, STEP = 9.0, 4.2
WAY = []                                        # the camera's waypoints (y, x, z), one beside each still
side = 1
for j, k in enumerate(ORDER):
    if j and rnd.random() < 0.2: pass           # now and then two on the same side
    else: side = -side if j else 1
    y = Y0 + j * STEP
    x = side * rnd.uniform(2.3, 2.7); z = rnd.uniform(-0.6, 0.6)
    plane(f"still{k:02d}", 3.2, 1.8, (x, y, z), (math.pi / 2, 0, side * 0.12), plane_mat(f"m{k}", HERE / "prolet_src/k" / f"k{k:02d}.jpg"))
    WAY.append((y, -side * 0.7, -z * 0.2))
Y_M = Y0 + len(ORDER) * STEP + 6.0              # Misha, square across the path, bigger
plane(f"still{LAST_K:02d}", 3.2 * 2.0, 1.8 * 2.0, (0, Y_M, 0), (math.pi / 2, 0, 0), plane_mat(f"m{LAST_K}", HERE / "prolet_src/k" / f"k{LAST_K:02d}.jpg"))
WAY.append((Y_M - 7.0, 0.0, 0.0))               # the camera centres on him before the turn

# icons: the specialities (white) and the brand's symbols (their colours), few, spread out, quiet
icons = sorted(TEX.glob("*_belyy.png")) + sorted(TEX.glob("*_cvet.png"))
def spread(n, gen, min_d, tries=4000):
    pts = []
    for _ in range(tries):
        p = gen()
        if all(sum((p[i] - q[i]) ** 2 for i in range(3)) >= min_d ** 2 for q in pts): pts.append(p)
        if len(pts) >= n: break
    return pts
def field_pt():
    a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(3.4, 6.0)
    return (math.cos(a) * r * 1.3, rnd.uniform(4, Y_M - 6), math.sin(a) * r * 0.75)
for i, (x, y, z) in enumerate(spread(40, field_pt, 2.8)):
    sz = rnd.choice([0.55, 0.7, 0.85])
    plane(f"icon{i}", sz, sz, (x, y, z), (math.pi / 2, 0, rnd.uniform(-0.5, 0.5)), plane_mat(f"im{i}", icons[i % len(icons)], alpha=True, tint=0.35))

# the destination, hidden left of and behind Misha, out of view until the camera turns to it
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); bpy.context.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 32; cam.data.sensor_width = 36
D_STOP = 4.0
fw = D_STOP * cam.data.sensor_width / cam.data.lens
XL, YL = -4.4, Y_M + 6.0   # right behind Misha's left edge: hidden by him until the camera rounds him
FIN = plane("final", fw, fw * 9 / 16, (XL, YL, 0), (math.pi / 2, 0, 0), plane_mat("mfinal", TEX / "logo_only.png", fade=False, alpha=True))
WORDS_FADE = []
WORDS = plane("words", fw, fw * 9 / 16, (XL, YL - 0.01, 0), (math.pi / 2, 0, 0), plane_mat("mwords", TEX / "words_only.png", fade=False, alpha=True, fader=WORDS_FADE))

# ---------------------------------------------------------------- the camera
T_FLY, T_LAND = 15.6, 18.4                      # weave to Misha; round him and land
def ease(u): return u * u * (3 - 2 * u)
def way_xz(y):
    """the weave: eased from waypoint to waypoint (no corners), starting on the axis"""
    pts = [(-4.0, 0.0, 0.0)] + WAY
    if y <= pts[0][0]: return 0.0, 0.0
    for (y0, x0, z0), (y1, x1, z1) in zip(pts, pts[1:]):
        if y <= y1:
            u = ease((y - y0) / (y1 - y0)); return x0 + (x1 - x0) * u, z0 + (z1 - z0) * u
    return 0.0, 0.0
def bez(p0, p1, p2, p3, u):
    v = 1 - u; return tuple(v ** 3 * a + 3 * v * v * u * b + 3 * v * u * u * c + u ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3))
Y_T = Y_M - 7.0                                 # where the turn begins
def cam_xy(t):
    if t <= T_FLY:
        u = t / T_FLY; y = -4.0 + (Y_T + 4.0) * (u * u * (3 - 2 * u) * 0.25 + u * 0.75)   # a soft start, then steady
        x, z = way_xz(y); return x, y, z
    v = min(1.0, (t - T_FLY) / (T_LAND - T_FLY)); v = v * v * (3 - 2 * v)
    x, y = bez((0, Y_T), (0, Y_M - 2.5), (XL, Y_M - 2.0), (XL, YL - D_STOP), v)
    return x, y, 0.0
def heading(t):
    x1, y1, _ = cam_xy(t + 0.08); x0, y0, _ = cam_xy(max(0, t - 0.08))
    return math.atan2(-(x1 - x0), max(1e-6, y1 - y0))
def cam_at(f):
    t = (f - 1) / FPS
    x, y, z = cam_xy(t)
    # look where it is going, but calmly: the heading averaged over 0.8 s; in the weave only a third
    # of it (a glance into each turn), in the turn round Misha all of it; square on once landed
    hs = [heading(min(T_LAND, max(0, t + d))) for d in (-0.4, -0.2, 0, 0.2, 0.4)]
    yaw = sum(hs) / len(hs)
    # round Misha by sliding left, the gaze almost straight: he slides off to the right and the logo is
    # uncovered from behind his edge
    k = 0.35 if t < T_FLY else 0.35 * (1 - ease(min(1, (t - T_FLY) / 1.0)))
    if t >= T_LAND: yaw = 0.0
    return (x, y, z), yaw * k
prev = None
for f in list(range(1, N + 1, 2)) + [N]:
    (x, y, z), yaw = cam_at(f)
    roll = 0.0 if prev is None else max(-0.06, min(0.06, (yaw - prev) * 4.0))   # a slight bank into the turns
    prev = yaw
    cam.location = (x, y, z); cam.rotation_euler = (math.pi / 2, roll, yaw)
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)
# the logo out of sight until the turn has begun (Misha hides it; this makes sure)
for o in (FIN, WORDS):
    o.hide_render = True; o.keyframe_insert("hide_render", frame=int((T_FLY + 0.3) * FPS))
    o.hide_render = False; o.keyframe_insert("hide_render", frame=int((T_FLY + 0.3) * FPS) + 1)
# the words come in as the camera settles on the logo
w0, w1 = int((T_LAND - 0.4) * FPS), int((T_LAND + 0.3) * FPS)
WORDS_FADE[0].default_value = 0.0; WORDS_FADE[0].keyframe_insert("default_value", frame=w0)
WORDS_FADE[0].default_value = 1.0; WORDS_FADE[0].keyframe_insert("default_value", frame=w1)
WORDS.location.z = -0.06; WORDS.keyframe_insert("location", frame=w0)
WORDS.location.z = 0.0; WORDS.keyframe_insert("location", frame=w1)
print("turn from", int(T_FLY * FPS), "landed", int(T_LAND * FPS), "words", w0, w1)

OUT.mkdir(parents=True, exist_ok=True)
frames = range(1, N + 1) if FRAMES == "all" else [int(x) for x in FRAMES.split(",")]
import shutil
F_STILL = int((18.4 + 0.35) * FPS) + 1   # from here the camera has landed and the words are in: every frame is the same
for f in frames:
    if FRAMES == "all" and (OUT / f"f_{f:05d}.png").exists(): continue   # resume an interrupted render
    if FRAMES == "all" and f > F_STILL and (OUT / f"f_{F_STILL:05d}.png").exists():
        shutil.copy(OUT / f"f_{F_STILL:05d}.png", OUT / f"f_{f:05d}.png"); continue
    sc.frame_set(f); sc.render.filepath = str(OUT / f"f_{f:05d}.png")
    bpy.ops.render.render(write_still=True)
    print("frame", f, flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "prolet.blend")) if FRAMES != "all" or True else None
