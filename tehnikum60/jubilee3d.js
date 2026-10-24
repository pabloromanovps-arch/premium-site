// jubilee3d.js: the brand variant of the jubilee background, with the brandbook's eight industry
// symbols (assets/symbols.json) as glossy 3-D objects drifting slowly round the logo. A calm field
// of deep blue; three depth planes rendered separately so the near and far symbols sit out of focus
// (shallow depth of field) while the middle ones are sharp; a glass lens behind the logo.
// Every motion is periodic in the 8 s loop, so the last frame meets the first.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import * as M from './lib/motion.js';
import { drawIcon } from './lib/icons.js';

const { W, H, TAU, hash01, clamp } = M;
let LOOP = 8;
const COLORS = { plane: '#00A1D3', leaf: '#3CBA94', drop: '#F47920', gear: '#43688F', mountains: '#A5ADB7',
  rail: '#EF4323', atom: '#025EA1', ship: '#2A7DE1' };
const NAMES = Object.keys(COLORS);

let R, scene, cam, planes, low, lowB, GEO;
export async function init3d(loop = 8) {
  LOOP = loop;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setSize(W, H, false);
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.95;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture;
  cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 100); cam.position.set(0, 0, 16); cam.lookAt(0, 0, 0);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-5, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd0ff, 2.0); rim.position.set(6, -2, -6); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x0a1a3a, 0.5));

  const sym = await fetch('assets/symbols.json').then((r) => r.json());
  const loader = new SVGLoader();
  const geo = {};
  for (const n of NAMES) {
    let shapes;
    if (n === 'atom') {
      const ring = new THREE.Shape(); ring.absarc(0.5, 0.5, 0.5, 0, TAU, false);
      const hole = new THREE.Path(); hole.absarc(0.5, 0.5, 0.25, 0, TAU, true); ring.holes.push(hole);
      const dot = new THREE.Shape(); dot.absarc(0.5, 0.5, 0.12, 0, TAU, false);
      shapes = [ring, dot];
    } else {
      const { paths } = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${sym[n].d}"/></svg>`);
      const warn = console.warn; console.warn = () => {};
      shapes = paths.flatMap((p) => SVGLoader.createShapes(p));
      console.warn = warn;
    }
    const g = new THREE.ExtrudeGeometry(shapes, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 4, curveSegments: 16 });
    g.translate(-0.5, -0.5, -0.11); g.scale(1, -1, 1);   // centre it; SVG is y-down
    g.computeVertexNormals();
    geo[n] = g;
  }
  GEO = geo;
  // three planes of symbols: far (blurred), middle (sharp), near (blurred). Placed on rings round
  // the logo, each plane a different radius and depth, every symbol tumbling on its own axis.
  planes = { far: new THREE.Group(), mid: new THREE.Group(), near: new THREE.Group() };
  Object.values(planes).forEach((g) => scene.add(g));
  const spec = [['far', 6, -8, 8.5, 2.4], ['mid', 8, 0, 5.6, 1.5], ['near', 3, 7, 5.2, 1.6]];
  let k = 0;
  for (const [plane, n, z, rad, size] of spec) {
    for (let i = 0; i < n; i++, k++) {
      const name = plane === 'mid' ? NAMES[i] : NAMES[(i * 3 + k + 1) % 8];
      const mat = new THREE.MeshPhysicalMaterial({ color: COLORS[name], metalness: 0, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.35 });
      const m = new THREE.Mesh(geo[name], mat);
      m.scale.setScalar(size * (0.85 + 0.3 * hash01(k, 3)));
      m.userData = { a0: (i / n) * TAU + hash01(k, 1) * 0.4, rad: rad * (0.9 + 0.2 * hash01(k, 2)), z: z + (hash01(k, 4) - 0.5) * 2,
        spin: [1 + Math.floor(hash01(k, 5) * 2), hash01(k, 6) > 0.5 ? 1 : -1], ph: hash01(k, 7) * TAU,
        tilt: [(hash01(k, 8) - 0.5) * 1.2, (hash01(k, 9) - 0.5) * 1.2] };
      planes[plane].add(m);
    }
  }
  low = document.createElement('canvas'); low.width = W / 4; low.height = H / 4;
  lowB = document.createElement('canvas'); lowB.width = W / 4; lowB.height = H / 4;
}

function place(t) {
  const p = (t % LOOP) / LOOP;
  for (const g of Object.values(planes)) for (const m of g.children) {
    const u = m.userData;
    // drift back and forth along the ring (periodic): each symbol returns to its place every loop
    const a = u.a0 + 0.18 * Math.sin(TAU * p + u.ph) * (g === planes.near ? -1 : 1);
    const sx = g === planes.mid ? 1.22 : 1.5, sy = g === planes.mid ? 0.7 : 0.8;   // keep the sharp ring in frame
    m.position.set(Math.cos(a) * u.rad * sx, Math.sin(a) * u.rad * sy + 0.25 * Math.sin(TAU * p + u.ph), u.z);
    // whole turns per loop on Y, a gentle sway on X: tumbling without a seam
    m.rotation.set(0.35 * Math.sin(TAU * p + u.ph), 0.5 * Math.sin(TAU * p + u.ph * 1.7), 0.15 * Math.sin(TAU * p * 2 + u.ph));
  }
}

function renderPlane(name) {
  for (const [k, g] of Object.entries(planes)) g.visible = k === name;
  R.setClearColor(0x000000, 0);
  R.render(scene, cam);
  return R.domElement;
}

export function drawFon3D(ctx, t, med) {
  // the field: one deep blue, lighter behind the logo
  const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.65);
  g.addColorStop(0, '#0E4C9E'); g.addColorStop(0.55, '#082F6E'); g.addColorStop(1, '#041537');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  place(t);
  // far plane: small, blurred, a little dimmer
  const blur = (src, px, alpha) => {
    const c = low.getContext('2d'); c.clearRect(0, 0, low.width, low.height); c.drawImage(src, 0, 0, low.width, low.height);
    const b = lowB.getContext('2d'); b.clearRect(0, 0, lowB.width, lowB.height); b.filter = `blur(${px}px)`; b.drawImage(low, 0, 0); b.filter = 'none';
    ctx.globalAlpha = alpha; ctx.drawImage(lowB, 0, 0, W, H); ctx.globalAlpha = 1;
  };
  blur(renderPlane('far'), 3, 0.7);
  // the glass lens behind the logo: what is behind it, frosted and magnified, with a lit rim
  // a medallion of glass holding the whole logo
  const lx = med.cx, ly = med.cy, lr = med.r;
  ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU);
  const rg = ctx.createLinearGradient(lx - lr, ly - lr, lx + lr, ly + lr);
  rg.addColorStop(0, 'rgba(255,255,255,0.7)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.08)'); rg.addColorStop(1, 'rgba(255,255,255,0.35)');
  ctx.strokeStyle = rg; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  // middle plane: sharp
  ctx.drawImage(renderPlane('mid'), 0, 0, W, H);
  // near plane: big and very soft
  blur(renderPlane('near'), 6, 0.9);
}

// ---------------------------------------------------------------- the master title: behind glass
// The whole frame is a pane of frosted glass. The symbols and small 3-D particles drift towards it
// and away: pressed close to the glass they are sharp, the further back they go the more the frost
// diffuses them (a per-object depth of field, in four focus bins). Soft reflections cross the pane.
let G2 = null;
// VTT's speciality icons (lib/icons.js, drawn for canvas) turned into extruded 3-D: the icon is
// drawn into a context that records its paths instead of painting them
const ICON3D = { flask: '#00A1D3', weld: '#F47920', molecule: '#3CBA94', chef: '#A5ADB7', building: '#2A7DE1', car: '#EF4323' };
function iconShapes(name) {
  const subs = []; let cur = null, T = [1, 0, 0, 1, 0, 0]; const stack = [];
  const P = (x, y) => new THREE.Vector2(T[0] * x + T[2] * y + T[4], T[1] * x + T[3] * y + T[5]);
  const mul = (a, b, c, d, e, f) => { const [A, B, C, D, E2, F] = T; T = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E2, B * e + D * f + F]; };
  const move = (x, y) => { cur = [P(x, y)]; subs.push(cur); };
  const line = (x, y) => { if (!cur) move(x, y); else cur.push(P(x, y)); };
  const quad = { lineWidth: 0.1, stroked: [] };
  const c = {
    set fillStyle(v) {}, set strokeStyle(v) {}, set lineCap(v) {},
    set lineWidth(v) { quad.lineWidth = v; }, get lineWidth() { return quad.lineWidth; },
    save() { stack.push(T); }, restore() { T = stack.pop(); },
    translate(x, y) { mul(1, 0, 0, 1, x, y); }, rotate(a) { mul(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0); },
    scale(x, y) { mul(x, 0, 0, y, 0, 0); },
    beginPath() { cur = null; quad.stroked = []; }, closePath() { cur = null; },
    moveTo(x, y) { move(x, y); quad.stroked.push([[x, y]]); }, lineTo(x, y) { line(x, y); quad.stroked.at(-1)?.push([x, y]); },
    quadraticCurveTo(cx, cy, x, y) {
      const p0 = cur.at(-1), q = P(cx, cy), e = P(x, y);
      for (let i = 1; i <= 8; i++) { const u = i / 8; cur.push(new THREE.Vector2((1 - u) ** 2 * p0.x + 2 * u * (1 - u) * q.x + u * u * e.x, (1 - u) ** 2 * p0.y + 2 * u * (1 - u) * q.y + u * u * e.y)); }
    },
    arc(x, y, r, a0, a1, ccw = false) {
      let d = a1 - a0; if (!ccw && d < 0) d += TAU; if (ccw && d > 0) d -= TAU; if (Math.abs(a1 - a0) >= TAU - 1e-6) d = ccw ? -TAU : TAU;
      for (let i = 0; i <= 32; i++) { const a = a0 + (d * i) / 32; line(x + r * Math.cos(a), y + r * Math.sin(a)); }
    },
    rect(x, y, w, h) { move(x, y); line(x + w, y); line(x + w, y + h); line(x, y + h); cur = null; },
    fillRect(x, y, w, h) { this.rect(x, y, w, h); }, fill() {},
    stroke() {   // strokes (the molecule's bonds) become thin quads
      const hw = quad.lineWidth / 2;
      for (const pts of quad.stroked) for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L * hw, ny = (x1 - x0) / L * hw;
        move(x0 + nx, y0 + ny); line(x1 + nx, y1 + ny); line(x1 - nx, y1 - ny); line(x0 - nx, y0 - ny); cur = null;
      }
    },
  };
  drawIcon(c, name);
  // a subpath inside another one is its hole (the icons fill with evenodd); the rest are solids
  const polys = subs.filter((s) => s.length > 2);
  const inside = (pt, poly) => { let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) k = !k; } return k; };
  const area = (p) => THREE.ShapeUtils.area(p);
  const shapes = [], owner = new Map();
  polys.forEach((p, i) => { const o = polys.findIndex((q, j) => j !== i && Math.abs(area(q)) > Math.abs(area(p)) && p.every((pt) => inside(pt, q))); if (o >= 0) owner.set(i, o); });
  polys.forEach((p, i) => { if (owner.has(i)) return; const sh = new THREE.Shape(area(p) < 0 ? p.slice().reverse() : p); shapes.push(sh); sh.idx = i; });
  owner.forEach((o, i) => { const sh = shapes.find((s) => s.idx === o); if (sh) sh.holes.push(new THREE.Path(area(polys[i]) > 0 ? polys[i].slice().reverse() : polys[i])); });
  // the icons are built of overlapping parts (atoms and bonds, wheels and body): a bevel would show
  // every seam, so they are extruded flat-sided and a little deeper
  const g = new THREE.ExtrudeGeometry(shapes, { depth: 0.26, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -0.13); g.scale(1, -1, 1); g.computeVertexNormals();
  return g;
}

export async function initGlass(loop = 10) {
  await init3d(loop);
  // reuse the symbol geometries; one flat group of drifting objects, big symbols and small particles
  const geos = {}; for (const g of Object.values(planes)) for (const m of g.children) geos[m.geometry.uuid] = m.geometry;
  const byName = {}; for (const g of Object.values(planes)) for (const m of g.children) byName[m.material.color.getHexString()] = m.geometry;
  for (const g of Object.values(planes)) g.visible = false;
  const group = new THREE.Group(); scene.add(group);
  const items = [];
  for (const n of Object.keys(ICON3D)) if (!GEO[n]) GEO[n] = iconShapes(n);
  const add = (name, size, k) => {
    const geo = GEO[name];
    const mat = new THREE.MeshPhysicalMaterial({ color: COLORS[name] ?? ICON3D[name], metalness: 0, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.35 });
    const m = new THREE.Mesh(geo, mat); m.scale.setScalar(size);
    // keep clear of the logo: positions inside the central ellipse are pushed out to its rim
    let x = (hash01(k, 11) - 0.5) * 22, y = (hash01(k, 12) - 0.5) * 11;
    const e = Math.hypot(x / 5.2, y / 3.6);
    if (e < 1) { const f = (1.05 + 0.4 * hash01(k, 16)) / Math.max(e, 0.2); x *= f; y *= f; }
    m.userData = { x, y, ph: hash01(k, 13) * TAU, n: 1, sway: hash01(k, 14) * TAU };
    group.add(m); items.push(m);
  };
  // the big pieces: VTT's specialities (flask, welding, ...) and four of the brand's symbols
  const BIG = ['flask', 'gear', 'weld', 'molecule', 'atom', 'chef', 'building', 'drop', 'car', 'leaf'];
  BIG.forEach((n, i) => add(n, 1.4, i));
  const SMALL = [...NAMES, ...Object.keys(ICON3D)];
  for (let i = 0; i < 34; i++) add(SMALL[i % SMALL.length], 0.32 + 0.25 * hash01(i, 15), 20 + i);   // particles
  // a fixed frost grain for the pane (drawn once, seeded)
  const grain = document.createElement('canvas'); grain.width = W / 2; grain.height = H / 2;
  const gc = grain.getContext('2d'), img = gc.createImageData(grain.width, grain.height);
  for (let i = 0; i < img.data.length; i += 4) { const v = 255 * hash01(i, 31); img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = v < 30 ? 10 : 0; }
  gc.putImageData(img, 0, 0);
  G2 = { group, items, grain, bins: [0, 1, 2, 3, 4, 5].map(() => { const c = document.createElement('canvas'); c.width = W / 2; c.height = H / 2; return c; }) };
}

const GLASS_Z = 5;
// reeded: fluted glass. Everything behind the pane is drawn to its own layer, then laid back in
// vertical ribs, each rib a little cylinder lens (magnified, so the image breaks at every rib),
// lit on one side and shaded on the other. That is what makes the glass read as glass.
export const FLUTE = { sw: 72, ang: 15 * Math.PI / 180, span: Math.hypot(W, H) };
export function drawGlassMaster(ctx, t, { reeded = false, glow = 1, behind = null, pane = true } = {}) {
  const SS = ctx.getTransform().a;
  let dst = ctx;
  if (reeded) {
    G2.behind = G2.behind || document.createElement('canvas');
    if (G2.behind.width !== W * SS) { G2.behind.width = W * SS; G2.behind.height = H * SS; }
    dst = G2.behind.getContext('2d'); dst.setTransform(SS, 0, 0, SS, 0, 0); dst.clearRect(0, 0, W, H);
  }
  const p = (t % LOOP) / LOOP;
  const g = dst.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.65);
  g.addColorStop(0, '#0E4C9E'); g.addColorStop(0.55, '#082F6E'); g.addColorStop(1, '#041537');
  dst.fillStyle = g; dst.fillRect(0, 0, W, H);
  // each object breathes in depth once per loop: from deep behind (-12) up against the glass (4.6)
  // focus is continuous: each object has a blur level L (0 sharp .. 5 most diffused) from its
  // distance behind the glass. It is drawn in the two levels around L: the blurrier one fully,
  // the sharper one on top at (1 - f), so the image is lerp(sharper, blurrier, f): no pops.
  const lev = [];
  for (const m of G2.items) {
    const u = m.userData;
    const k = 0.5 + 0.5 * Math.sin(TAU * p * u.n + u.ph);
    const z = -12 + (GLASS_Z - 0.4 + 12) * k;
    m.position.set(u.x + 0.6 * Math.sin(TAU * p + u.sway), u.y + 0.4 * Math.cos(TAU * p + u.sway), z);
    m.rotation.set(0.35 * Math.sin(TAU * p + u.ph), 0.5 * Math.sin(TAU * p + u.sway), 0.15 * Math.sin(TAU * p * 2 + u.ph));
    const d = GLASS_Z - z;                         // distance behind the glass, 0.4 .. 17.4
    lev.push(5 * clamp((d - 0.6) / 15.5) ** 0.85);
  }
  const NL = 5, BLUR = [0, 1.0, 2.2, 3.8, 5.6, 7.6];   // px at half size
  for (let b = NL; b >= 0; b--) {
    let any = false;
    G2.items.forEach((m, i) => {
      const L = lev[i], lo = Math.floor(L), f = L - lo;
      let o = 0;
      if (b === lo + 1) o = 1;                     // the blurrier neighbour, full
      else if (b === lo) o = lo === NL ? 1 : 1 - f; // the sharper one on top
      m.visible = o > 0.002; m.material.transparent = true; m.material.opacity = o; any ||= m.visible;
    });
    if (!any) continue;
    R.setClearColor(0x000000, 0); R.render(scene, cam);
    const fade = 1 - 0.05 * b;
    if (b === 0) { dst.drawImage(R.domElement, 0, 0, W, H); continue; }
    const c = G2.bins[b].getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W / 2, H / 2);
    c.filter = `blur(${BLUR[b]}px)`; c.drawImage(R.domElement, 0, 0, W / 2, H / 2); c.filter = 'none';
    dst.globalAlpha = fade; dst.drawImage(G2.bins[b], 0, 0, W, H); dst.globalAlpha = 1;
  }
  if (reeded) {
    // a light behind the logo, inside the glass world, so the flutes bend it too
    const pulse = (0.85 + 0.15 * Math.sin(TAU * p)) * glow;
    const lg = dst.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * 0.62);
    lg.addColorStop(0, `rgba(80,190,255,${0.42 * pulse})`); lg.addColorStop(0.45, `rgba(42,125,225,${0.18 * pulse})`);
    lg.addColorStop(1, 'rgba(42,125,225,0)');
    dst.globalCompositeOperation = 'lighter'; dst.fillStyle = lg; dst.fillRect(0, 0, W, H);
    dst.globalCompositeOperation = 'source-over';
    if (behind) behind(dst);
    // flutes at the house angle (15 deg). Each one is a little cylinder: across it the image is
    // sampled through sin(), so it is magnified in the middle and squeezed hard at the edges.
    const { sw, ang, span } = FLUTE, mag = 1.3, SUB = 10;
    // a glint that runs across the flutes once per loop (and its weaker echo)
    const beamX = -span / 2 + ((p * 1.0) % 1) * span * 1.6 - span * 0.3;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(ang);
    for (let x0 = -span / 2 - sw; x0 < span / 2 + sw; x0 += sw) {
      const cx = x0 + sw / 2;
      for (let j = 0; j < SUB; j++) {
        const ua = -1 + (2 * j) / SUB, ub = ua + 2 / SUB;
        const xa = cx + ua * sw / 2, xb = cx + ub * sw / 2;
        const fa = Math.sin(ua * Math.PI / 2) / mag, fb = Math.sin(ub * Math.PI / 2) / mag;
        const sa = cx + fa * sw / 2, sb = cx + fb * sw / 2;
        ctx.save();
        ctx.beginPath(); ctx.rect(xa - 0.3, -span / 2, xb - xa + 0.6, span); ctx.clip();
        // map rotated-frame x in [sa, sb] onto [xa, xb], then back into screen space
        const k = (xb - xa) / (sb - sa);
        ctx.translate(xa, 0); ctx.scale(k, 1); ctx.translate(-sa, 0);
        ctx.rotate(-ang); ctx.translate(-W / 2, -H / 2);
        ctx.drawImage(G2.behind, 0, 0, W * SS, H * SS, 0, 0, W, H);
        ctx.restore();
      }
      // the flute's own light: a bright lip on one side, shade on the other; the glint lifts it
      // the echo is still on screen when the loop wraps, so it fades out over the last 1.5 s
      const echo = 0.4 * (0.5 + 0.5 * Math.cos(Math.PI * clamp((p - 0.85) / 0.15)));
      const near = Math.exp(-(((cx - beamX) / 260) ** 2)) + echo * Math.exp(-(((cx - beamX + span * 0.55) / 200) ** 2));
      const rg = ctx.createLinearGradient(x0, 0, x0 + sw, 0);
      rg.addColorStop(0, `rgba(255,255,255,${0.10 + 0.32 * near})`);
      rg.addColorStop(0.08, `rgba(255,255,255,${0.04 + 0.12 * near})`);
      rg.addColorStop(0.35, 'rgba(255,255,255,0)');
      rg.addColorStop(0.8, 'rgba(0,8,35,0)'); rg.addColorStop(1, 'rgba(0,8,35,0.22)');
      ctx.fillStyle = rg; ctx.fillRect(x0, -span / 2, sw, span);
    }
    ctx.restore();
  }
  if (!pane) return;   // the 3-D world alone, no glass in front (styles5.js)
  // the pane: a faint frost, grain, two soft reflections sweeping across once per loop
  ctx.fillStyle = 'rgba(200,225,255,0.05)'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(G2.grain, 0, 0, W, H);
  [[0.0, 520, 0.10], [0.45, 260, 0.07]].forEach(([off, wid, a]) => {
    const x = -W * 0.5 + ((p + off) % 1) * W * 2;
    const sg = ctx.createLinearGradient(x - wid, 0, x + wid, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${a})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.translate(x, H / 2); ctx.transform(1, 0, -0.27, 1, 0, 0); ctx.translate(-x, -H / 2);
    ctx.fillStyle = sg; ctx.fillRect(x - wid, -200, wid * 2, H + 400); ctx.restore();
  });
  // the pane's edge catching light: a thin bright line round the frame
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
}

// a check sheet: the ten big pieces in a row, sharp, facing the camera (clip jm_icons)
export function drawPieceSheet(ctx) {
  ctx.fillStyle = '#082F6E'; ctx.fillRect(0, 0, W, H);
  G2.items.forEach((m, i) => {
    m.visible = i < 10;
    m.position.set(-8 + (i % 5) * 4, i < 5 ? 2.2 : -2.2, 0); m.rotation.set(0.25, -0.35, 0);
  });
  R.setClearColor(0x000000, 0); R.render(scene, cam); ctx.drawImage(R.domElement, 0, 0, W, H);
}

// true 3-D models of VTT's specialities, for close-ups where an extruded silhouette would not
// read: a molecule of glossy balls, a glass flask with liquid, a stretch of track, a chef's toque,
// a welding torch with its spark. Each fits about a unit box, centred.
function gloss(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.6, ...extra });
}
function makeModel(name) {
  const g = new THREE.Group();
  if (name === 'molecule3d') {
    const at = [[-0.28, -0.2, 0, 0.2, '#3CBA94'], [0.3, -0.24, 0.05, 0.17, '#00A1D3'], [0.02, 0.3, -0.04, 0.22, '#F47920'], [0.33, 0.33, 0.12, 0.11, '#A5ADB7']];
    const bond = (a, b) => {
      const va = new THREE.Vector3(...a.slice(0, 3)), vb = new THREE.Vector3(...b.slice(0, 3)), L = va.distanceTo(vb);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, L, 24), gloss('#E8EEF6'));
      m.position.copy(va).add(vb).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      g.add(m);
    };
    bond(at[0], at[2]); bond(at[1], at[2]); bond(at[0], at[1]); bond(at[2], at[3]);
    for (const [x, y, z, r, c] of at) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), gloss(c)); m.position.set(x, y, z); g.add(m); }
  } else if (name === 'flask3d') {
    const prof = [[0.02, -0.5], [0.36, -0.5], [0.4, -0.46], [0.4, -0.42], [0.1, 0.12], [0.1, 0.42], [0.13, 0.45], [0.13, 0.5], [0.0, 0.5]];
    const glass = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 64),
      new THREE.MeshPhysicalMaterial({ color: '#DDF3FF', roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.32, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false }));
    const liq = new THREE.Mesh(new THREE.LatheGeometry([[0.0, -0.47], [0.34, -0.47], [0.37, -0.43], [0.2, -0.12], [0.0, -0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 64),
      gloss('#00A1D3', { roughness: 0.15 }));
    const surf = new THREE.Mesh(new THREE.CircleGeometry(0.2, 48), gloss('#4DC0E3')); surf.rotation.x = -Math.PI / 2; surf.position.y = -0.12;
    g.add(liq, surf, glass); glass.renderOrder = 2;
  } else if (name === 'rail3d') {
    const steel = gloss('#C9CED4', { metalness: 0.6, roughness: 0.25 }), sleeper = gloss('#EF4323', { roughness: 0.45 });
    for (const x of [-0.17, 0.17]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 1.1), steel); r.position.set(x, 0.06, 0); g.add(r);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 1.1), steel); h.position.set(x, 0.1, 0); g.add(h); }
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.12), sleeper); s.position.set(0, 0, -0.44 + i * 0.22); g.add(s); }
    g.rotation.set(0.55, 0.6, 0); const w = new THREE.Group(); w.add(g); return w;
  } else if (name === 'chef3d') {
    const white = gloss('#F4F7FB', { roughness: 0.5, clearcoat: 0.3 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 64, 1, true), white); band.position.y = -0.3; band.material.side = THREE.DoubleSide;
    g.add(band);
    for (const [x, y, z, r] of [[0, 0.12, 0, 0.3], [-0.2, 0.0, 0.05, 0.22], [0.2, 0.0, 0.05, 0.22], [0, 0.0, -0.18, 0.22], [0, 0.02, 0.2, 0.2]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), white); m.position.set(x, y, z); m.scale.y = 0.85; g.add(m);
    }
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.05, 64, 1, true), gloss('#F47920')); stripe.position.y = -0.33; g.add(stripe);
  } else if (name === 'weld3d') {
    const body = gloss('#43688F'), tip = gloss('#C9CED4', { metalness: 0.7 }), hand = gloss('#F47920');
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.5, 32), hand); grip.position.y = -0.2;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 32), body); neck.position.y = 0.2;
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.12, 32), tip); noz.position.y = 0.4;
    const arm = new THREE.Group(); arm.add(grip, neck, noz); arm.rotation.z = -0.7; arm.position.set(0.1, -0.05, 0); g.add(arm);
    // the spark: a bright star of thin cones
    const spark = new THREE.Group(), hot = new THREE.MeshBasicMaterial({ color: '#FFE7A8' });
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.16 + 0.1 * (i % 3), 8), hot); const a = (i / 9) * TAU;
      c.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0); c.rotation.z = a - Math.PI / 2; spark.add(c); }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), new THREE.MeshBasicMaterial({ color: '#FFFFFF' })); spark.add(core);
    spark.position.set(-0.22, 0.34, 0.05); g.add(spark);
  }
  return g;
}

// one piece (a speciality icon or a brand symbol) rendered alone, for 2-D layouts: returns a
// square canvas `px` wide with the piece on transparency, turned by (rx, ry)
const PIECE = {};
// the window is 900 px of the frame, wide enough for any piece at any turn (540 cut corners off)
export function renderPiece(name, rx = 0.2, ry = -0.35, px = 600) {
  if (!PIECE.mesh) PIECE.mesh = {};
  let m = PIECE.mesh[name];
  if (!m && name.endsWith('3d')) { m = makeModel(name); PIECE.mesh[name] = m; scene.add(m); }
  if (!m) {
    const src = G2.items.find((it) => it.geometry === GEO[name]);
    m = new THREE.Mesh(GEO[name], src ? src.material.clone() : new THREE.MeshPhysicalMaterial({ color: COLORS[name] }));
    m.material.transparent = false; m.material.opacity = 1; m.material.envMapIntensity = 0.5;
    PIECE.mesh[name] = m; scene.add(m);
  }
  const vis = scene.children.map((c) => c.visible);
  G2.items.forEach((it) => { it.visible = false; });
  Object.values(PIECE.mesh).forEach((x) => { x.visible = x === m; });
  m.position.set(0, 0, 0); m.rotation.set(rx, ry, 0); m.scale.setScalar(name.endsWith('3d') ? 5.4 : 6.2);
  R.setClearColor(0x000000, 0); R.render(scene, cam);
  m.visible = false;
  const c = document.createElement('canvas'); c.width = c.height = px;
  const k = R.domElement.height / H;
  c.getContext('2d').drawImage(R.domElement, (W / 2 - 450) * k, (H / 2 - 450) * k, 900 * k, 900 * k, 0, 0, px, px);
  return c;
}
