// jubilee3d.js: the brand variant of the jubilee background, with the brandbook's eight industry
// symbols (assets/symbols.json) as glossy 3-D objects drifting slowly round the logo. A calm field
// of deep blue; three depth planes rendered separately so the near and far symbols sit out of focus
// (shallow depth of field) while the middle ones are sharp; a glass lens behind the logo.
// Every motion is periodic in the 8 s loop, so the last frame meets the first.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import * as M from './lib/motion.js';

const { W, H, TAU, hash01 } = M;
let LOOP = 8;
const COLORS = { plane: '#00A1D3', leaf: '#3CBA94', drop: '#F47920', gear: '#43688F', mountains: '#A5ADB7',
  rail: '#EF4323', atom: '#025EA1', ship: '#2A7DE1' };
const NAMES = Object.keys(COLORS);

let R, scene, cam, planes, low, lowB;
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
export async function initGlass(loop = 10) {
  await init3d(loop);
  // reuse the symbol geometries; one flat group of drifting objects, big symbols and small particles
  const geos = {}; for (const g of Object.values(planes)) for (const m of g.children) geos[m.geometry.uuid] = m.geometry;
  const byName = {}; for (const g of Object.values(planes)) for (const m of g.children) byName[m.material.color.getHexString()] = m.geometry;
  for (const g of Object.values(planes)) g.visible = false;
  const group = new THREE.Group(); scene.add(group);
  const items = [];
  const add = (name, size, k) => {
    const geo = Object.values(planes).flatMap((g) => g.children).find((m) => m.material.color.getHexString() === new THREE.Color(COLORS[name]).getHexString())?.geometry;
    const mat = new THREE.MeshPhysicalMaterial({ color: COLORS[name], metalness: 0, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.12, envMapIntensity: 0.35 });
    const m = new THREE.Mesh(geo, mat); m.scale.setScalar(size);
    // keep clear of the logo: positions inside the central ellipse are pushed out to its rim
    let x = (hash01(k, 11) - 0.5) * 22, y = (hash01(k, 12) - 0.5) * 11;
    const e = Math.hypot(x / 5.2, y / 3.6);
    if (e < 1) { const f = (1.05 + 0.4 * hash01(k, 16)) / Math.max(e, 0.2); x *= f; y *= f; }
    m.userData = { x, y, ph: hash01(k, 13) * TAU, n: 1, sway: hash01(k, 14) * TAU };
    group.add(m); items.push(m);
  };
  NAMES.forEach((n, i) => add(n, 1.4, i));                         // the eight symbols
  for (let i = 0; i < 34; i++) add(NAMES[i % 8], 0.32 + 0.25 * hash01(i, 15), 20 + i);   // particles
  // a fixed frost grain for the pane (drawn once, seeded)
  const grain = document.createElement('canvas'); grain.width = W / 2; grain.height = H / 2;
  const gc = grain.getContext('2d'), img = gc.createImageData(grain.width, grain.height);
  for (let i = 0; i < img.data.length; i += 4) { const v = 255 * hash01(i, 31); img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = v < 30 ? 10 : 0; }
  gc.putImageData(img, 0, 0);
  G2 = { group, items, grain, bins: [0, 1, 2, 3].map(() => { const c = document.createElement('canvas'); c.width = W / 4; c.height = H / 4; return c; }) };
}

const GLASS_Z = 5;
// reeded: fluted glass. Everything behind the pane is drawn to its own layer, then laid back in
// vertical ribs, each rib a little cylinder lens (magnified, so the image breaks at every rib),
// lit on one side and shaded on the other. That is what makes the glass read as glass.
export function drawGlassMaster(ctx, t, { reeded = false } = {}) {
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
  const binOf = [];
  for (const m of G2.items) {
    const u = m.userData;
    const k = 0.5 + 0.5 * Math.sin(TAU * p * u.n + u.ph);
    const z = -12 + (GLASS_Z - 0.4 + 12) * k;
    m.position.set(u.x + 0.6 * Math.sin(TAU * p + u.sway), u.y + 0.4 * Math.cos(TAU * p + u.sway), z);
    m.rotation.set(0.35 * Math.sin(TAU * p + u.ph), 0.5 * Math.sin(TAU * p + u.sway), 0.15 * Math.sin(TAU * p * 2 + u.ph));
    const d = GLASS_Z - z;                         // distance behind the glass
    binOf.push(d < 1.6 ? 0 : d < 4.5 ? 1 : d < 9 ? 2 : 3);
  }
  // render far bins first (most diffused), the sharp bin last
  const BLUR = [0, 1.2, 2.8, 5];
  for (let b = 3; b >= 0; b--) {
    G2.items.forEach((m, i) => { m.visible = binOf[i] === b; });
    R.setClearColor(0x000000, 0); R.render(scene, cam);
    if (b === 0) { dst.drawImage(R.domElement, 0, 0, W, H); continue; }
    const c = G2.bins[b].getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W / 4, H / 4);
    c.filter = `blur(${BLUR[b]}px)`; c.drawImage(R.domElement, 0, 0, W / 4, H / 4); c.filter = 'none';
    dst.globalAlpha = b === 3 ? 0.75 : 0.9; dst.drawImage(G2.bins[b], 0, 0, W, H); dst.globalAlpha = 1;
  }
  if (reeded) {
    // a light behind the logo, inside the glass world, so the flutes bend it too
    const pulse = 0.85 + 0.15 * Math.sin(TAU * p);
    const lg = dst.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * 0.62);
    lg.addColorStop(0, `rgba(80,190,255,${0.42 * pulse})`); lg.addColorStop(0.45, `rgba(42,125,225,${0.18 * pulse})`);
    lg.addColorStop(1, 'rgba(42,125,225,0)');
    dst.globalCompositeOperation = 'lighter'; dst.fillStyle = lg; dst.fillRect(0, 0, W, H);
    dst.globalCompositeOperation = 'source-over';
    // flutes at the house angle (15 deg). Each one is a little cylinder: across it the image is
    // sampled through sin(), so it is magnified in the middle and squeezed hard at the edges.
    const sw = 72, mag = 1.3, SUB = 10, ang = 15 * Math.PI / 180;
    const span = Math.hypot(W, H);
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
      const near = Math.exp(-(((cx - beamX) / 260) ** 2)) + 0.4 * Math.exp(-(((cx - beamX + span * 0.55) / 200) ** 2));
      const rg = ctx.createLinearGradient(x0, 0, x0 + sw, 0);
      rg.addColorStop(0, `rgba(255,255,255,${0.10 + 0.32 * near})`);
      rg.addColorStop(0.08, `rgba(255,255,255,${0.04 + 0.12 * near})`);
      rg.addColorStop(0.35, 'rgba(255,255,255,0)');
      rg.addColorStop(0.8, 'rgba(0,8,35,0)'); rg.addColorStop(1, 'rgba(0,8,35,0.22)');
      ctx.fillStyle = rg; ctx.fillRect(x0, -span / 2, sw, span);
    }
    ctx.restore();
  }
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
