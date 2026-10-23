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
const LOOP = 8;
const COLORS = { plane: '#00A1D3', leaf: '#3CBA94', drop: '#F47920', gear: '#43688F', mountains: '#A5ADB7',
  rail: '#EF4323', atom: '#025EA1', ship: '#2A7DE1' };
const NAMES = Object.keys(COLORS);

let R, scene, cam, planes, low, lowB;
export async function init3d() {
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
    // the whole ring turns 1/8 of a turn per loop (one symbol slot: seamless), each symbol bobbing
    const a = u.a0 + p * (TAU / 8) * (g === planes.near ? -1 : 1);
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

export function drawFon3D(ctx, t) {
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
  const lx = W / 2 + 40, ly = H / 2 + 60, lr = 470;
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
