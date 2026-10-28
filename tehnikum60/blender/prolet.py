# -*- coding: utf-8 -*-
# The closing flythrough: the camera flies forward through 60 years, the film's own stills hanging in
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
FPS, DUR = 50, 15.4   # the flight and landing; the 7 s hold on the closing frame is added at encoding (a still)
N = int(FPS * DUR)
BLUE = (2 / 255, 94 / 255, 161 / 255)

def lin(c): return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False   # a denoiser smears the stills' detail; enough samples instead
sc.cycles.filter_width = 1.2
sc.cycles.max_bounces = 0; sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
sc.render.resolution_x, sc.render.resolution_y = RES_W, RES_W * 9 // 16
sc.render.fps = FPS; sc.frame_start, sc.frame_end = 1, N
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"
sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.5
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

# ---------------------------------------------------------------- the path: the camera flies along +Y
# order: the archive, 2008, 2024, 2025, the specialities, the people, Misha
ORDER = [4, 6, 7, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 40, 41, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
         32, 33, 34, 35, 36, 38, 39, 1, 37]   # the client: Misha at the plant (37) is the last
rnd = random.Random(60)
# a tunnel: the stills stand round the camera's straight path on a ring (radius ~2.8), facing it and
# leaning in a little; every fourth stands right on the path and the camera flies through it.
# Misha at the plant is the last, on the path, and hides the logo until the camera is through him.
Y0, STEP = 8.0, 3.4
LAST_K = 37
LAST_Y = None
for j, k in enumerate(ORDER):
    y = Y0 + j * STEP
    through = j % 4 == 3 or k == LAST_K
    if through:
        x, z, rz, rx, s = 0.0, 0.0, 0.0, 0.0, 1.35
        if k == LAST_K: LAST_Y = y; s = 2.2          # Misha: big enough to fill the view as the camera nears
    else:
        a = j * 2.399 + rnd.uniform(-0.3, 0.3); r = rnd.uniform(2.5, 3.1)
        x, z = math.cos(a) * r * 1.25, math.sin(a) * r * 0.85
        rz, rx, s = -x * 0.12, z * 0.12, 1.0     # lean in towards the path
    plane(f"still{k:02d}", 3.2 * s, 1.8 * s, (x, y, z), (math.pi / 2 + rx, 0, rz), plane_mat(f"m{k}", HERE / "prolet_src/k" / f"k{k:02d}.jpg"))   # the 4K stills as they are

# icons: the specialities (white) and the brand's symbols (their colours), drifting round the path
icons = sorted(TEX.glob("*_belyy.png")) + sorted(TEX.glob("*_cvet.png"))
Y_END = LAST_Y + 7.0
DRIFT = []
def spread(n, gen, min_d, tries=4000):
    # random points kept at least min_d apart: an even scatter, no clumps
    pts = []
    for _ in range(tries):
        p = gen()
        if all(sum((p[i] - q[i]) ** 2 for i in range(3)) >= min_d ** 2 for q in pts): pts.append(p)
        if len(pts) >= n: break
    return pts
def tunnel_pt():
    a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(2.3, 4.8)
    return (math.cos(a) * r * 1.35, rnd.uniform(3, LAST_Y - 2), math.sin(a) * r * 0.85)
for i, (x, y, z) in enumerate(spread(40, tunnel_pt, 2.6)):   # few, spread out: the stills lead
    sz = rnd.choice([0.55, 0.7, 0.85, 1.0])
    o = plane(f"icon{i}", sz, sz, (x, y, z), (math.pi / 2, 0, rnd.uniform(-0.5, 0.5)), plane_mat(f"im{i}", icons[i % len(icons)], alpha=True, tint=0.35))

# the destination: the approved closing frame, exactly filling the view where the camera stops
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); bpy.context.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 32; cam.data.sensor_width = 36
D_STOP = 4.0
fw = D_STOP * cam.data.sensor_width / cam.data.lens
# the landing, clean (the client): the logo alone on the blue; the words a layer just in front, faded in after
FIN = plane("final", fw, fw * 9 / 16, (0, Y_END, 0), (math.pi / 2, 0, 0), plane_mat("mfinal", TEX / "logo_only.png", fade=False, alpha=True))
WORDS_FADE = []
WORDS = plane("words", fw, fw * 9 / 16, (0, Y_END - 0.01, 0), (math.pi / 2, 0, 0), plane_mat("mwords", TEX / "words_only.png", fade=False, alpha=True, fader=WORDS_FADE))
STOP_BACK = 1.0   # lands on a full-frame fit; the smaller framing is drawn into the layers
# the ground of the closing view: icons on a few depths behind the logo, spread over the whole view,
# quiet (tinted towards the blue), clear of the logo and the words
d_cam = D_STOP * STOP_BACK
# an even scatter in screen space (so nothing overlaps on screen), each icon then put at its own depth
pts = []
for _ in range(30000):
    sx, sy = rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5)
    if abs(sx) < 0.33 and abs(sy) < 0.42: continue                     # clear of the logo and the words
    if all((sx - p[0]) ** 2 + ((sy - p[1]) * 9 / 16) ** 2 > 0.115 ** 2 for p in pts): pts.append((sx, sy))
    if len(pts) >= 0: break   # no icons round the logo: its own quiet pattern is the ground
order = list(range(len(icons))); rnd.shuffle(order)
for i, (sx, sy) in enumerate(pts):
    dz = rnd.uniform(0.6, 4.0); d = d_cam + dz; vw = d * 36 / 32
    sz = rnd.uniform(0.045, 0.06) * vw                                   # 4.5-6 % of the view's width: a quiet ground
    o = plane(f"edge{i}", sz, sz, (sx * vw, Y_END + dz, sy * vw * 9 / 16), (math.pi / 2, 0, rnd.uniform(-0.4, 0.4)),
              plane_mat(f"em{i}", icons[order[i % len(order)]], alpha=True, fade=False, tint=0.6))

# camera: rises out of the blue, speeds through the years, slows and lands square on the frame
def ease(u): return u * u * (3 - 2 * u)
def cam_at(f):
    u = (f - 1) / (N - 1)
    # steady through the tunnel, through Misha at 84 % of the time, then a soft landing on the frame
    yM, yS = LAST_Y + 0.3, Y_END - D_STOP * STOP_BACK
    # through Misha at 12.6 s, landed by 14.6 s (then still)
    t = (f - 1) / FPS; ut = min(1.0, t / 12.6)
    if t < 12.6: y = -2 + (yM + 2) * ut ** 1.08
    else: v = min(1.0, (t - 12.6) / 2.0); y = yM + (yS - yM) * (1 - (1 - v) ** 3)
    u = min(1.0, t / 14.6)
    # a light weave, as if easing round the stills: small, slow, dying away before the landing
    k = 1 - (lambda q: q * q * (3 - 2 * q))(min(1, max(0, (u - 0.70) / 0.14)))
    a = 2 * math.pi * u * 0.85
    return (math.sin(a) * 0.32 * k, y, math.sin(a * 0.6 + 1.0) * 0.18 * k), math.sin(a) * -0.025 * k
for f in list(range(1, N + 1, 5)) + [N]:
    loc, roll = cam_at(f)
    cam.location = loc; cam.rotation_euler = (math.pi / 2, roll, 0)
    cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)
# the logo stays out of sight until the camera is through Misha
f_through = next(f for f in range(1, N + 1) if cam_at(f)[0][1] > LAST_Y)
for o in [FIN, WORDS]:
    o.hide_render = True; o.keyframe_insert("hide_render", frame=f_through - 1)
    o.hide_render = False; o.keyframe_insert("hide_render", frame=f_through)
# and past Misha nothing else: the flight's icons and stills are gone, the logo stands alone on the blue
for o in bpy.data.objects:
    if o.name.startswith(("icon", "still")):
        o.hide_render = False; o.keyframe_insert("hide_render", frame=f_through - 1)
        o.hide_render = True; o.keyframe_insert("hide_render", frame=f_through)
print("logo from frame", f_through)
w0, w1 = int(14.3 * FPS), int(15.0 * FPS)   # the words come in once the camera has nearly landed
WORDS_FADE[0].default_value = 0.0; WORDS_FADE[0].keyframe_insert("default_value", frame=w0)
WORDS_FADE[0].default_value = 1.0; WORDS_FADE[0].keyframe_insert("default_value", frame=w1)
WORDS.location.z = -0.06; WORDS.keyframe_insert("location", frame=w0)
WORDS.location.z = 0.0; WORDS.keyframe_insert("location", frame=w1)
for o, spin, ph in DRIFT:
    for f in (1, N):
        o.rotation_euler.y = ph + spin * (f / N) * 3; o.keyframe_insert("rotation_euler", frame=f)

OUT.mkdir(parents=True, exist_ok=True)
frames = range(1, N + 1) if FRAMES == "all" else [int(x) for x in FRAMES.split(",")]
for f in frames:
    if FRAMES == "all" and (OUT / f"f_{f:05d}.png").exists(): continue   # resume an interrupted render
    sc.frame_set(f); sc.render.filepath = str(OUT / f"f_{f:05d}.png")
    bpy.ops.render.render(write_still=True)
    print("frame", f, flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "prolet.blend")) if FRAMES != "all" or True else None
