# -*- coding: utf-8 -*-
# The flythrough's destination: the jubilee logo as one solid (never split), its own teal on the
# front, dark navy-grey thickness, a soft shadow, a slight turn; ИСТОРИЯ ПРОДОЛЖАЕТСЯ! under it in
# brand plates. One still per background.
#   python3 tehnikum60/blender/final_logo.py <light|navy> <out.png> [samples]
import math, re, sys
from pathlib import Path
import bpy

HERE = Path(__file__).resolve().parents[1]
BG = sys.argv[1] if len(sys.argv) > 1 else "light"
OUT = sys.argv[2] if len(sys.argv) > 2 else str(HERE / f"blender_final_{BG}.png")
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 96

def hexrgb(h, a=1.0):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (a,)

def mat(name, col, rough=0.35, coat=0.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hexrgb(col); b.inputs["Roughness"].default_value = rough
    if "Coat Weight" in b.inputs: b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = hexrgb(col); b.inputs["Emission Strength"].default_value = emit
    return m

# ---------------------------------------------------------------- the logo's outlines
def parse(d):
    """absolute M L C A Z into closed polylines (curves sampled finely)"""
    toks = re.findall(r"[MLCAZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    loops, cur, pos, i, cmd = [], [], (0, 0), 0, None
    num = lambda: float(toks[i])
    while i < len(toks):
        t = toks[i]
        if t in "MLCAZ": cmd = t; i += 1
        if cmd == "Z":
            if cur: loops.append(cur); cur = []
            continue
        if cmd == "M":
            if cur: loops.append(cur)
            pos = (float(toks[i]), float(toks[i + 1])); i += 2; cur = [pos]; cmd = "L"
        elif cmd == "L":
            pos = (float(toks[i]), float(toks[i + 1])); i += 2; cur.append(pos)
        elif cmd == "C":
            p0 = pos; c1 = (float(toks[i]), float(toks[i + 1])); c2 = (float(toks[i + 2]), float(toks[i + 3])); p3 = (float(toks[i + 4]), float(toks[i + 5])); i += 6
            for k in range(1, 13):
                u = k / 12; v = 1 - u
                cur.append((v ** 3 * p0[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u ** 3 * p3[0],
                            v ** 3 * p0[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u ** 3 * p3[1]))
            pos = p3
        elif cmd == "A":   # only half circles here (the hole of the gear)
            r = float(toks[i]); sweep = float(toks[i + 4]); e = (float(toks[i + 5]), float(toks[i + 6])); i += 7
            c = ((pos[0] + e[0]) / 2, (pos[1] + e[1]) / 2); a0 = math.atan2(pos[1] - c[1], pos[0] - c[0])
            for k in range(1, 33):
                a = a0 + (math.pi if sweep else -math.pi) * k / 32
                cur.append((c[0] + math.cos(a) * r, c[1] + math.sin(a) * r))
            pos = e
    if cur: loops.append(cur)
    return loops

def logo_object(size=4.2, depth=0.22):
    # clean outlines traced from the rendered logo (tools: logo_svg.py, then the trace): the source
    # paths touch themselves (the 6), which Blender cannot fill
    import json
    cons = json.loads((HERE / "assets/jubilee/logo_contours.json").read_text())
    x0, x1, y0, y1 = 0.275, 1.559, 0.344, 1.559
    k = size / (y1 - y0); mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    # a mesh built directly: each shape's face triangulated with its holes (earcut), front and back,
    # and walls round every outline; a bevel modifier rounds the edges
    import mapbox_earcut as earcut, numpy as np
    verts, faces, front = [], [], []
    tr = lambda x, y: ((x - mx) * k, -(y - my) * k)
    for sh in cons:
        rings = [sh["outer"]] + sh["holes"]
        flat = np.array([tr(x, y) for r in rings for (x, y) in r], dtype=np.float64)
        ends = np.cumsum([len(r) for r in rings]).astype(np.uint32)
        tri = earcut.triangulate_float64(flat, ends).reshape(-1, 3)
        base = len(verts); n = len(flat)
        verts += [(x, y, depth / 2) for x, y in flat] + [(x, y, -depth / 2) for x, y in flat]
        for a_, b_, c_ in tri:
            faces.append((base + a_, base + b_, base + c_)); front.append(True)
            faces.append((base + n + c_, base + n + b_, base + n + a_)); front.append(False)
        st = 0
        for e in ends:
            for i in range(st, e):
                j = i + 1 if i + 1 < e else st
                faces.append((base + i, base + n + i, base + n + j, base + j)); front.append(False)
            st = e
    me = bpy.data.meshes.new("logo"); me.from_pydata(verts, [], faces); me.update()
    # consistent outward normals
    import bmesh
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("logo", me); bpy.context.collection.objects.link(ob); objs = [ob]
    bv = ob.modifiers.new("bevel", "BEVEL"); bv.width = 0.012; bv.segments = 3; bv.limit_method = "ANGLE"
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    logo = bpy.context.active_object; logo.name = "LOGO"
    # teal on the front face, navy-grey on the thickness
    logo.data.materials.append(mat("logo_front", "#078C95", 0.32, 0.6))
    logo.data.materials.append(mat("logo_side", "#22313F", 0.45))
    for p in logo.data.polygons: p.material_index = 0 if p.normal.z > 0.6 else 1
    return logo

def box(name, x, y, z, w, h, d, m):
    bpy.ops.mesh.primitive_cube_add(location=(x, y, z)); o = bpy.context.active_object; o.name = name
    o.scale = (w / 2, h / 2, d / 2); bpy.ops.object.transform_apply(scale=True)
    bv = o.modifiers.new("bevel", "BEVEL"); bv.width = 0.015; bv.segments = 3
    o.data.materials.append(m); return o

def text(s, x, y, z, size, font, m, depth=0.03, align="LEFT"):
    cu = bpy.data.curves.new("t", "FONT"); cu.body = s; cu.font = bpy.data.fonts.load(str(font)); cu.size = size
    cu.extrude = depth; cu.align_x = align; cu.align_y = "CENTER"
    o = bpy.data.objects.new("t", cu); bpy.context.collection.objects.link(o); o.location = (x, y, z)
    o.data.materials.append(m); return o

# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1920, 1080; sc.render.film_transparent = False
sc.view_settings.view_transform = "Standard"

logo = logo_object()
logo.location = (0, 0.75, 0.75); logo.rotation_euler = (0, math.radians(-12), 0)

# the words: ИСТОРИЯ in a blue plate, ПРОДОЛЖАЕТСЯ! in a white one, a little proud of the backdrop
dela = HERE / "fonts/dela.ttf"
blue, white, ink = mat("blue", "#025EA1", 0.4), mat("white", "#FFFFFF", 0.4), mat("ink", "#1E2228", 0.5)
txt_white = mat("txt_white", "#FFFFFF", 0.4)
y = -2.55
t1 = text("ИСТОРИЯ", 0, y, 0.13, 0.42, dela, txt_white); t2 = text("ПРОДОЛЖАЕТСЯ!", 0, y, 0.13, 0.42, dela, ink)
bpy.context.view_layer.update()
w1, w2 = t1.dimensions.x + 0.5, t2.dimensions.x + 0.5; gap = 0.08; x0 = -(w1 + w2 + gap) / 2
box("p1", x0 + w1 / 2, y, 0.05, w1, 0.72, 0.12, blue); box("p2", x0 + w1 + gap + w2 / 2, y, 0.05, w2, 0.72, 0.12, white)
t1.location.x = x0 + 0.25; t2.location.x = x0 + w1 + gap + 0.25

# backdrop, light and world per background
if BG == "light":
    back, world, key = "#E4EAF0", "#EEF2F5", 420
else:
    back, world, key = "#0B2A5E", "#081F47", 600
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.12)); bd = bpy.context.active_object
bd.data.materials.append(mat("backdrop", back, 0.9))
wd = bpy.data.worlds.new("w"); sc.world = wd; wd.use_nodes = True
wd.node_tree.nodes["Background"].inputs[0].default_value = hexrgb(world); wd.node_tree.nodes["Background"].inputs[1].default_value = 0.35
def area(name, loc, rot, size, power, col="#FFFFFF"):
    l = bpy.data.lights.new(name, "AREA"); l.size = size; l.energy = power; l.color = hexrgb(col)[:3]
    o = bpy.data.objects.new(name, l); bpy.context.collection.objects.link(o); o.location = loc; o.rotation_euler = rot
area("key", (-4, -3, 9), (math.radians(25), math.radians(-20), 0), 6, key)
area("fill", (6, 2, 6), (math.radians(-20), math.radians(40), 0), 8, key * 0.35)
if BG != "light":   # a glow behind the logo on the night blue
    area("halo", (0, 0.8, 0.6), (math.radians(180), 0, 0), 5, 260, "#3FA9F5")

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); bpy.context.collection.objects.link(cam)
cam.data.lens = 50; cam.location = (0, -0.3, 17.5); cam.rotation_euler = (0, 0, 0); sc.camera = cam
cam.data.dof.use_dof = False
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("written", OUT)
