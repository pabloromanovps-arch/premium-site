// look.js: the shared house look of the logo and the captions: gold on black enamel, warm lights,
// a travelling shine light, and the traced-outline helpers (the logo's own parts, assets/logo/parts.json).
import * as G from './gl.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const { THREE } = G;
export const GOLD = '#C9A048';   // the logo's gold (#D6B161), a touch deeper: ACES tone mapping lifts it

export function materials() {
  const gold = new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.24,
    clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.0 });
  const goldEdge = gold.clone(); goldEdge.roughness = 0.32;
  const enamel = new THREE.MeshPhysicalMaterial({ color: 0x0b0a0d, metalness: 0, roughness: 0.55, envMapIntensity: 0.12 });
  const back = new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.38, envMapIntensity: 0.9 });
  // envMap set per material: envMapIntensity only scales a material's own map, not scene.environment
  for (const m of [gold, goldEdge, enamel, back]) m.envMap = G.ENV;
  return { gold, goldEdge, enamel, back };
}

// warm key, gold rim, and a point light that throws the shine across the bevels (sweep())
export function lights(scene) {
  const key = new THREE.DirectionalLight(0xffe6c0, 1.8); key.position.set(-4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc878, 3.0); rim.position.set(5, 2, -5); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x0a0806, 0.25));
  const shine = new THREE.PointLight(0xffe2a8, 0, 8, 1.6); scene.add(shine);
  return { key, rim, shine };
}

// passes: [[t0, t1, peak], ...] in seconds. The light crosses from x0 to x1 in front of the subject.
export function sweep(light, t, passes, x0, x1, y = 0.4, z = 0.9) {
  const p = passes.find(([a, b]) => t >= a && t < b);
  if (!p) { light.intensity = 0; return; }
  const k = (t - p[0]) / (p[1] - p[0]);
  const e = -(Math.cos(Math.PI * k) - 1) / 2;
  light.intensity = p[2] * Math.sin(k * Math.PI);
  light.position.set(x0 + (x1 - x0) * e, y * (1 - 2 * k), z);
}

// ---------------------------------------------------------------- traced outlines (the logo)
const svg = new SVGLoader();
export function shapesOf(d) {
  const { paths } = svg.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill-rule="evenodd"/></svg>`);
  // createShapes honours the evenodd fill rule (holes in the doll, the ring); mute its deprecation notice
  const warn = console.warn; console.warn = () => {};
  try { return paths.flatMap((p) => SVGLoader.createShapes(p)).map(clean); } finally { console.warn = warn; }
}
// Traced outlines carry near-duplicate points and hairpin turns; ExtrudeGeometry's bevel turns each
// into a spike that floods narrow counters. Re-sample, drop near-duplicates and hairpins.
function cleanRing(pts, minD = 0.0012) {
  let out = [];
  for (const p of pts) if (!out.length || p.distanceTo(out[out.length - 1]) > minD) out.push(p);
  if (out.length > 2 && out[0].distanceTo(out[out.length - 1]) <= minD) out.pop();
  for (let pass = 0; pass < 3; pass++) {
    out = out.filter((p, i) => {
      const a = out[(i - 1 + out.length) % out.length], b = out[(i + 1) % out.length];
      return p.clone().sub(a).normalize().dot(b.clone().sub(p).normalize()) > -0.94;
    });
  }
  return out;
}
function clean(shape) {
  const { shape: pts, holes } = shape.extractPoints(12);
  const s = new THREE.Shape(cleanRing(pts));
  s.holes = holes.map((h) => new THREE.Path(cleanRing(h)));
  return s;
}
export function extrudeTraced(d, depth, bevel) {
  return new THREE.ExtrudeGeometry(shapesOf(d), { depth, curveSegments: 1, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: 3 });
}
