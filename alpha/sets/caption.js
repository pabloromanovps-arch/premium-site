// A caption in the logo's style: gold 3-D type on a black enamel capsule with a gold rim and a fine
// inner ring (the badge's double ring). The capsule opens from a gold dot, the letters stand up one
// by one, digits run like a split-flap board before they lock, then the shine crosses.
import * as G from '../lib/gl.js';
import * as M from '../lib/motion.js';
import * as L from '../lib/look.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const { THREE } = G;
const { spring, lerp, clamp, noise1, hash01 } = M;

export const DURATION = 5;
const SIZE = 0.5;                 // em, world units
// cap height and line spacing are measured from the face itself (capMetrics), not assumed
let CAP_H = null, LEAD = null;
function capMetrics() {
  if (CAP_H) return;
  const g = glyphGeo('Н'); g.computeBoundingBox();
  CAP_H = g.boundingBox.max.y - g.boundingBox.min.y - 0.012;
  LEAD = CAP_H * 1.55;
}
const DEPTH = { plate: 0.06, rim: 0.1, ring: 0.075, type: 0.06 };
const RIM = 0.045, RING = 0.014, RING_INSET = 0.075;

const glyphCache = new Map();
function glyphGeo(ch) {
  if (glyphCache.has(ch)) return glyphCache.get(ch);
  const g = new TextGeometry(ch, { font: G.FONT, size: SIZE, depth: DEPTH.type, curveSegments: 8,
    bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.006, bevelSegments: 2 });
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.max.x + b.min.x) / 2, 0, 0);   // centred in x, baseline kept at y = 0 (the hinge)
  glyphCache.set(ch, g);
  return g;
}
const adv = (ch) => {
  const gl = G.FONT.data.glyphs[ch] || G.FONT.data.glyphs['?'];
  return (gl.ha * SIZE) / G.FONT.data.resolution;
};
const TRACK = 0.02 * SIZE;
function measure(line) { return [...line].reduce((w, ch) => w + adv(ch) + TRACK, -TRACK); }

// rounded-rectangle outline w x h, corner radius r, centred on the origin
function rrect(w, h, r, path = new THREE.Shape()) {
  r = Math.min(r, w / 2, h / 2);
  const x = w / 2 - r, y = h / 2 - r;
  path.moveTo(-x, -h / 2);
  path.lineTo(x, -h / 2); path.absarc(x, -y, r, -Math.PI / 2, 0, false);
  path.lineTo(w / 2, y); path.absarc(x, y, r, 0, Math.PI / 2, false);
  path.lineTo(-x, h / 2); path.absarc(-x, y, r, Math.PI / 2, Math.PI, false);
  path.lineTo(-w / 2, -y); path.absarc(-x, -y, r, Math.PI, 1.5 * Math.PI, false);
  return path;
}
function ring(w, h, r, t) {
  const s = rrect(w, h, r);
  s.holes.push(rrect(w - 2 * t, h - 2 * t, r - t, new THREE.Path()));
  return s;
}
const BEVEL = (b) => ({ curveSegments: 14, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.7, bevelOffset: -b * 0.7, bevelSegments: 3 });

// the plaque that holds some lines of text: { w, h, r }
export function plateFor(lines) {
  capMetrics();
  const textW = Math.max(...lines.map(measure));
  const textH = CAP_H + (lines.length - 1) * LEAD;
  return { w: textW + CAP_H * 2.4, h: textH + CAP_H * 1.9, r: CAP_H * 0.85 };
}

export function captionSet(lines, fit) {
  capMetrics();
  const scene = new THREE.Scene();
  const cam = G.camera(24, 0.1, 100);
  const mat = L.materials();
  const lit = L.lights(scene);
  const root = new THREE.Group(); scene.add(root);

  const P = plateFor(lines);
  const plate = new THREE.Mesh(undefined, mat.enamel);
  const rim = new THREE.Mesh(undefined, mat.gold);
  const inner = new THREE.Mesh(undefined, mat.gold);
  plate.position.z = -DEPTH.plate; rim.position.z = -DEPTH.plate - 0.02; inner.position.z = -0.03;
  root.add(plate, rim, inner);
  let builtW = null;
  function buildPlate(w) {
    w = Math.round(w * 400) / 400;            // geometry rebuilt only when the width visibly changes
    if (w === builtW) return;
    builtW = w;
    for (const m of [plate, rim, inner]) m.geometry?.dispose();
    const { h, r } = P, i = RING_INSET;
    plate.geometry = new THREE.ExtrudeGeometry(rrect(w - RIM, h - RIM, r - RIM / 2), { depth: DEPTH.plate, ...BEVEL(0) });
    rim.geometry = new THREE.ExtrudeGeometry(ring(w, h, r, RIM), { depth: DEPTH.rim, ...BEVEL(0.012) });
    inner.geometry = new THREE.ExtrudeGeometry(ring(w - 2 * i, h - 2 * i, r - i, RING), { depth: DEPTH.ring, ...BEVEL(0.004) });
  }

  // glyphs: one mesh per character, hinged on its baseline
  const capH = CAP_H;
  const glyphs = [];
  let order = 0;
  lines.forEach((line, li) => {
    const total = measure(line);
    const base = -capH / 2 + ((lines.length - 1) * LEAD) / 2 - li * LEAD;
    let x = -total / 2;
    [...line].forEach((ch) => {
      const a = adv(ch);
      if (ch !== ' ') {
        const m = new THREE.Mesh(glyphGeo(ch), mat.gold);
        m.userData = { ch, x: x + a / 2, y: base, i: order++, digit: /[0-9]/.test(ch), seed: order * 17 + li };
        root.add(m); glyphs.push(m);
      }
      x += a + TRACK;
    });
  });

  // the same camera distance for every caption, so all three share one type size:
  // the widest plaque fills fit.fw of the frame width, the tallest at most fit.fh of its height
  const tv = Math.tan((12 * Math.PI) / 180);
  const d = Math.max(fit.w / fit.fw / 2 / tv / cam.aspect, fit.h / fit.fh / 2 / tv);
  G.lookFrom(cam, [0, 0, d], [0, 0, 0]);
  const half = P.w / 2;

  return {
    scene, camera: cam, bloom: 0,
    update(t) {
      // 1. capsule opens from a dot: width springs out, the whole plate swings up from a slight tilt
      const ko = spring(t - 0.05, { stiffness: 95, damping: 14 });
      buildPlate(lerp(2 * P.r + 0.02, P.w, ko));
      const kr = spring(t, { stiffness: 70, damping: 11 });
      const idle = clamp((t - 2.2) / 1.5);
      root.rotation.set(lerp(-0.5, 0, clamp(kr)) + 0.035 * noise1(t * 0.4, 3) * idle, 0.05 * noise1(t * 0.3, 9) * idle, 0);
      root.position.z = lerp(-0.6, 0, clamp(kr));
      const s = lerp(0.6, 1, clamp(ko)); root.scale.setScalar(s);

      // 2. letters stand up in reading order, each on its own spring
      for (const m of glyphs) {
        const { x, y, i, digit, ch, seed } = m.userData;
        const t0 = 0.42 + i * 0.03;
        const k = spring(t - t0, { stiffness: 190, damping: 13 });
        m.visible = k > 0.002;
        m.rotation.x = lerp(-Math.PI / 2, 0, k);
        m.position.set(x, y + (1 - clamp(k)) * -0.06, 0);
        // 3. digits: a split-flap run (each step flips in) until they lock on the real value
        if (digit) {
          const lock = t0 + 0.75 + (seed % 3) * 0.08, step = 0.06;
          if (t < lock) {
            const n = Math.floor((t - t0) / step);
            const ph = ((t - t0) / step) - n;
            m.geometry = glyphGeo(String(Math.floor(hash01(n, seed) * 10)));
            m.rotation.x = Math.min(m.rotation.x, 0) - (1 - ph) * 0.9;
          } else {
            m.geometry = glyphGeo(ch);
            const kl = spring(t - lock, { stiffness: 260, damping: 12 });
            m.rotation.x = lerp(-0.9, 0, kl);
          }
        }
      }
      // 4. the shine crosses once the type is up, and once more on the hold
      L.sweep(lit.shine, t, [[1.55, 2.75, 5], [3.4, 4.6, 3.5]], -half - 0.5, half + 0.5, 0.5, 0.9);
      lit.key.position.set(-4 + 1.5 * Math.sin(t * 0.5), 5, 6);
    },
    samples: (t) => (t < 2.3 ? 6 : 1),
    flare: (t) => ({ k: Math.max(0, Math.sin(Math.PI * clamp(t / 0.7))) ** 2 * 0.8, x: 0.5, y: 0.5 }),
  };
}
