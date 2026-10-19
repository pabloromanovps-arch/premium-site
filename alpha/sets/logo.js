// The whole logo, never taken apart: gold relief on a black enamel coin. It turns in from edge-on
// (a thin gold sliver on frame 0), springs past and settles, then the shine crosses it and it floats.
import * as G from '../lib/gl.js';
import * as M from '../lib/motion.js';
import * as L from '../lib/look.js';

const { THREE } = G;
const { spring, lerp, clamp, noise1 } = M;

export const DURATION = 6;
const DISC_Z = 0.05;

export function logoSet(P) {
  const scene = new THREE.Scene();
  const cam = G.camera(30, 0.1, 100);
  const mat = L.materials();
  const lit = L.lights(scene);

  const badge = new THREE.Group(); scene.add(badge);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.975, 0.975, 0.1, 160, 1), [mat.goldEdge, mat.enamel, mat.back]);
  disc.rotation.x = Math.PI / 2;
  badge.add(disc);
  // [depth, bevel, z of the back face]; the outer ring is deep enough to wrap the coin's edge
  const deep = { outerRing: [0.19, 0.012, -0.07], innerRing: [0.05, 0.01, DISC_Z], arcs: [0.035, 0.006, DISC_Z],
    doll: [0.05, 0.008, DISC_Z], mark3x3: [0.05, 0.008, DISC_Z] };
  for (const [k, d] of Object.entries(P.parts)) {
    const [depth, bev, z] = deep[k];
    const m = new THREE.Mesh(L.extrudeTraced(d, depth, bev), mat.gold);
    m.position.z = z; badge.add(m);
  }
  // letters without a bevel: at this size the bevel floods the counters of the E
  for (const l of P.letters) {
    const m = new THREE.Mesh(L.extrudeTraced(l.d, 0.035, 0), mat.gold);
    m.position.z = DISC_Z; badge.add(m);
  }

  // the badge fills ~80 % of the frame height
  const d = 2 / 0.8 / 2 / Math.tan((15 * Math.PI) / 180);
  G.lookFrom(cam, [0, 0, d], [0, 0, 0]);

  return {
    scene, camera: cam, bloom: 0,
    update(t) {
      // the turn: edge-on at t = 0, under-damped so it swings ~8 deg past front and settles by ~1.8 s
      const k = spring(t + 0.02, { stiffness: 52, damping: 8.5 });
      const idle = clamp((t - 1.8) / 1.5);
      badge.rotation.set(0.05 * noise1(t * 0.35, 4) * idle, lerp(Math.PI / 2, 0, k) + 0.07 * noise1(t * 0.3, 7) * idle, lerp(-0.22, 0, clamp(k)));
      const s = lerp(0.86, 1, clamp(k)); badge.scale.setScalar(s);
      badge.position.set(0, 0.025 * Math.sin(t * 1.3) * idle, lerp(-0.8, 0, clamp(k)));
      // shine passes: across the face as it lands, then once more on the hold
      L.sweep(lit.shine, t, [[0.45, 1.9, 5], [3.2, 4.8, 4.5]], -2.4, 2.4, 1.0, 0.8);
      // the key light drifts so the reflections in the gold keep moving on the hold
      lit.key.position.set(-4 + 1.5 * Math.sin(t * 0.5), 5, 6);
    },
    // fast motion only in the turn: sub-frame blur there, a single sample once it has settled
    samples: (t) => (t < 2.0 ? 6 : 1),
    // the anamorphic streak as the sliver catches the light
    flare: (t) => ({ k: Math.max(0, Math.sin(Math.PI * clamp((t - 0.0) / 0.9))) ** 2, x: 0.5, y: 0.5 }),
  };
}
