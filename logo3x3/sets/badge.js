// The badge: the supplied logo traced into parts (tools/trace_logo.py -> assets/logo/parts.json),
// each part extruded in gold on a black enamel disc. update() places every part from u alone.
import * as G from '../lib/gl.js';
import * as M from '../lib/motion.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const { THREE } = G;
const { springU, SPRING, prog, lerp, kf, E, wobble, clamp, TAU, noise1 } = M;

const DISC_Z = 0.05;          // front face of the enamel disc
const svg = new SVGLoader();
function shapesOf(d) {
  const { paths } = svg.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill-rule="evenodd"/></svg>`);
  // createShapes honours the evenodd fill rule (holes in the doll, the ring); mute its deprecation notice
  const warn = console.warn; console.warn = () => {};
  try { return paths.flatMap((p) => SVGLoader.createShapes(p)).map(clean); } finally { console.warn = warn; }
}
// Traced outlines carry near-duplicate points and hairpin turns; ExtrudeGeometry's bevel turns each
// into a spike that floods narrow counters (the E's arms). Re-sample, drop near-duplicates and hairpins.
function cleanRing(pts, minD = 0.0012) {
  let out = [];
  for (const p of pts) if (!out.length || p.distanceTo(out[out.length - 1]) > minD) out.push(p);
  if (out.length > 2 && out[0].distanceTo(out[out.length - 1]) <= minD) out.pop();
  for (let pass = 0; pass < 3; pass++) {
    out = out.filter((p, i) => {
      const a = out[(i - 1 + out.length) % out.length], b = out[(i + 1) % out.length];
      const v1 = p.clone().sub(a).normalize(), v2 = b.clone().sub(p).normalize();
      return v1.dot(v2) > -0.94;            // keep unless the outline doubles back on itself
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
// extrude a traced part and move its pivot to its own centre (so it can turn about itself)
function extrude(d, depth, bevel, mat) {
  const g = new THREE.ExtrudeGeometry(shapesOf(d), { depth, curveSegments: 1, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: 3 });
  g.computeBoundingBox();
  const c = new THREE.Vector3(); g.boundingBox.getCenter(c);
  g.translate(-c.x, -c.y, 0);
  const m = new THREE.Mesh(g, mat);
  m.userData.home = new THREE.Vector3(c.x, c.y, DISC_Z);
  m.position.copy(m.userData.home);
  return m;
}

// the doll arrives like a basketball: dropped, two bounces, settles. Returns [height, squash]
function bounce(u) {
  const hops = [[3.6, 5, 2.4], [5, 6, 0.55], [6, 6.5, 0.14]];   // [start, land, apex height]
  for (const [a, b, h] of hops) if (u >= a && u < b) {
    const p = (u - a) / (b - a);
    return [a === 3.6 ? h * (1 - p * p) : 4 * h * p * (1 - p), 0];
  }
  if (u < 3.6) return [2.4, 0];
  // squash on each landing, decaying
  const sq = 0.16 * wobble(u - 5, 2.2, 7) * (u < 6 ? 1 : 0) + 0.08 * wobble(u - 6, 2.4, 7) * (u >= 6 && u < 6.5 ? 1 : 0) + 0.04 * wobble(u - 6.5, 2.4, 6) * (u >= 6.5 ? 1 : 0);
  return [0, sq];
}

export function badgeSet(P) {
  const scene = new THREE.Scene();
  scene.environment = G.ENV;
  const cam = G.camera(30, 0.1, 100);

  const gold = new THREE.MeshPhysicalMaterial({ color: P.goldHex, metalness: 1, roughness: 0.24,
    clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.0 });
  const goldEdge = gold.clone(); goldEdge.roughness = 0.32;
  const enamel = new THREE.MeshPhysicalMaterial({ color: 0x0b0a0d, metalness: 0.0, roughness: 0.55,
    clearcoat: 0.0, clearcoatRoughness: 0.08, envMapIntensity: 0.12 });
  // envMap set per material: envMapIntensity only scales a material's own map, not scene.environment
  for (const m of [gold, goldEdge, enamel]) m.envMap = G.ENV;
  const back = new THREE.MeshPhysicalMaterial({ color: P.goldHex, metalness: 1, roughness: 0.38, envMap: G.ENV, envMapIntensity: 0.9 });

  // lights: warm key, gold rim, and a travelling spot that throws the shine across the bevels
  const key = new THREE.DirectionalLight(0xffe6c0, 1.8); key.position.set(-4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc878, 3.0); rim.position.set(5, 2, -5); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x0a0806, 0.25));
  const sweep = new THREE.PointLight(0xffe2a8, 0, 6, 1.6); scene.add(sweep);

  const badge = new THREE.Group();    // flips and floats
  const coin = new THREE.Group();     // disc + outer ring: turns to face camera first
  badge.add(coin); scene.add(badge);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.975, 0.975, 0.1, 160, 1), [goldEdge, enamel, back]);
  disc.rotation.x = Math.PI / 2;
  coin.add(disc);

  const parts = {};
  const deep = { outerRing: [0.07, 0.012], innerRing: [0.05, 0.01], arcs: [0.035, 0.006], doll: [0.05, 0.008], mark3x3: [0.05, 0.008] };
  for (const [k, d] of Object.entries(P.parts)) {
    const [depth, bev] = deep[k];
    parts[k] = extrude(d, depth, bev, gold);
    (k === 'outerRing' ? coin : badge).add(parts[k]);
  }
  // outer ring also wraps the rim: push it back so its depth covers the disc edge
  parts.outerRing.userData.home.z = -0.06;
  parts.outerRing.geometry.dispose();
  parts.outerRing.geometry = (() => {
    const g = new THREE.ExtrudeGeometry(shapesOf(P.parts.outerRing), { depth: 0.19, curveSegments: 1, bevelEnabled: true,
      bevelThickness: 0.014, bevelSize: 0.011, bevelOffset: -0.011, bevelSegments: 4 });
    return g;
  })();
  parts.outerRing.userData.home.set(0, 0, -0.07);

  // letters, ordered as they are read: top arc left -> right, then bottom arc left -> right
  const top = P.letters.filter((l) => l.angle > 0).sort((a, b) => b.angle - a.angle);
  const bot = P.letters.filter((l) => l.angle <= 0).sort((a, b) => a.angle - b.angle);
  const letters = [...top, ...bot].map((l, i) => {
    const m = extrude(l.d, 0.035, 0, gold);
    m.userData.angle = Math.atan2(m.userData.home.y, m.userData.home.x);   // bbox centre, not ink centroid
    m.userData.i = i; m.userData.top = l.angle > 0;
    badge.add(m);
    return m;
  });
  const nTop = top.length;

  // floor reflection: the whole badge mirrored under a dark glass floor
  const FLOOR = -1.28;
  const mirror = new THREE.Group();
  mirror.scale.y = -1; mirror.position.y = 2 * FLOOR;
  scene.add(mirror);
  const glassTex = G.canvasTexture(16, 512);
  glassTex.draw((c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    [[0, 1], [0.4, 0.96], [0.5, 0.8], [0.65, 0.82], [0.8, 0.97], [1, 1]].forEach(([o, a]) => gr.addColorStop(o, `rgba(4,3,5,${a})`));
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: glassTex, transparent: true, depthWrite: false, toneMapped: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR, 0);
  floor.renderOrder = 2;
  scene.add(floor);

  // backdrop: a low warm pool of light behind the badge, so black reads as a space, not a void
  const bgTex = G.canvasTexture(1024, 512);
  bgTex.draw((c, w, h) => {
    c.fillStyle = '#050406'; c.fillRect(0, 0, w, h);
    const gr = c.createRadialGradient(w * 0.5, h * 0.58, 4, w * 0.5, h * 0.58, w * 0.2);
    gr.addColorStop(0, 'rgba(110,80,36,0.5)'); gr.addColorStop(0.45, 'rgba(50,34,16,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(90, 45), new THREE.MeshBasicMaterial({ map: bgTex, toneMapped: false, depthWrite: false }));
  backdrop.position.set(0, 4, -14); backdrop.renderOrder = -1;
  scene.add(backdrop);

  const all = [coin, ...Object.values(parts).filter((p) => p !== parts.outerRing), ...letters];
  let mirrorBuilt = false;
  function buildMirror() {
    // a live clone tree: each frame we copy the transforms of the real badge onto it
    const mb = badge.clone(true);
    mirror.add(mb);
    mirror.userData.src = badge; mirror.userData.dst = mb;
    mirrorBuilt = true;
  }

  return {
    scene, camera: cam, bloom: 0,
    update(t, u) {
      // ---- coin: edge-on on frame 0, turns to face the camera with a little overshoot
      const kc = springU(u, -0.6, { stiffness: 60, damping: 9 });
      coin.rotation.set(0, lerp(1.48, 0, kc), lerp(-0.5, 0, kc));

      // ---- inner ring: falls from in front of the lens and slams onto the disc at beat 2
      {
        const p = parts.innerRing, k = springU(u, 1.35, { stiffness: 260, damping: 16 });
        p.position.set(p.userData.home.x, p.userData.home.y, lerp(3.2, DISC_Z, Math.min(k, 1.0)) + (k > 1 ? (k - 1) * -0.3 : 0));
        const s = lerp(1.35, 1, clamp(k)); p.scale.set(s, s, 1);
        p.rotation.z = lerp(-0.9, 0, clamp(k));
        p.visible = u > 1.2;
      }
      // ---- side arcs: swing in around the centre on the drop
      {
        const p = parts.arcs, k = springU(u, 7.8, SPRING.bouncy);
        p.visible = k > 0.001;
        p.rotation.z = lerp(Math.PI * 0.5, 0, k);
        const s = Math.max(0.001, k); p.scale.set(1, 1, s);
        p.position.set(p.userData.home.x * Math.cos(p.rotation.z) - p.userData.home.y * Math.sin(p.rotation.z),
          p.userData.home.x * Math.sin(p.rotation.z) + p.userData.home.y * Math.cos(p.rotation.z), DISC_Z);
      }
      // ---- doll: basketball drop + bounces, squash on landing
      {
        const p = parts.doll, [hgt, sq] = bounce(u);
        p.visible = u > 3.55;
        p.position.set(p.userData.home.x, p.userData.home.y + hgt, DISC_Z + (hgt > 0 ? 0.02 : 0));
        p.scale.set(1 + sq * 0.8, 1 - sq, 1);
        p.rotation.z = hgt > 0 ? 0.05 * Math.sin(u * 3) * Math.min(1, hgt) : 0;
      }
      // ---- 3x3: punched up out of the disc at beat 7 (stamp)
      {
        const p = parts.mark3x3, k = springU(u, 6.75, { stiffness: 320, damping: 14 });
        p.visible = k > 0.001;
        const s = lerp(2.2, 1, k); p.scale.set(s, s, 1);
        p.position.set(p.userData.home.x, p.userData.home.y + (1 - k) * -0.1, lerp(1.6, DISC_Z, k));
      }
      // ---- letters: each flies in from outside the badge, along the circle, landing in reading order
      for (const m of letters) {
        const { i, angle, home } = m.userData;
        const top = m.userData.top;
        const j = top ? i : i - nTop;
        const u0 = (top ? 7.8 : 8.25) + j * 0.11;
        const k = springU(u, u0, { stiffness: 200, damping: 15 });
        m.visible = k > 0.001;
        const sweep0 = (top ? 1 : -1) * 0.9;           // arrive travelling along the arc
        const a = angle + (1 - k) * sweep0;
        const r = Math.hypot(home.x, home.y);
        const rr = r * lerp(1.9, 1, k);
        m.position.set(Math.cos(a) * rr, Math.sin(a) * rr, lerp(0.9, DISC_Z, k));
        m.rotation.set(lerp(1.2, 0, k) * (top ? 1 : -1), 0, (a - angle));
        const s = lerp(0.4, 1, clamp(k)); m.scale.set(s, s, s);
      }

      // ---- the flip: one full turn on Y, springing past and settling (beat 10 -> ~12)
      const kf_ = springU(u, 10.1, { stiffness: 75, damping: 11 });
      const lift = Math.sin(clamp(kf_) * Math.PI) * 0.35;
      // idle float after the reveal: tiny, slow, seeded
      const idle = clamp((u - 12) / 3);
      badge.rotation.set(0.05 * noise1(u * 0.18, 4) * idle, kf_ * TAU + 0.08 * noise1(u * 0.15, 7) * idle, 0);
      badge.position.set(0, lift + 0.03 * Math.sin(u * 0.6) * idle, lift * 0.6);

      // ---- shine: a warm light skims across the face on the drop and on the hold
      // passes: [from beat, to beat, peak intensity]: the intro rim, the drop, two on the hold
      const passes = [[-1, 3, 4], [8, 10, 3], [12.5, 15.5, 4.5], [16.5, 19.5, 4.5]];
      const pass = passes.find(([a, b]) => u >= a && u < b);
      const sw = pass ? prog(u, pass[0], pass[1]) : 0;
      sweep.intensity = pass ? pass[2] * Math.sin(sw * Math.PI) : 0;
      const dir = pass && pass[0] === 16.5 ? -1 : 1;
      sweep.position.set(dir * lerp(-2.4, 2.4, E.inOutSine(sw)), lerp(1.1, -0.5, sw), 0.7);

      // ---- camera: starts tight on the rim, log-dollies out, settles in front with a slow push
      // log-space dolly 2.4 -> 5.2 over the build, then a 12 % push and a slow arc across the hold
      const d = 2.4 * (5.2 / 2.4) ** E.inOutCubic(prog(u, -0.5, 7.5)) * (1 - 0.12 * E.inOutSine(prog(u, 12, 20)));
      const orbit = lerp(0.55, 0, E.inOutCubic(prog(u, -0.5, 8))) + lerp(0, -0.22, E.inOutSine(prog(u, 12.5, 20)));
      const camY = lerp(0.45, 0.12, E.inOutCubic(prog(u, 0, 8)));
      const look = [lerp(0.55, 0, E.inOutCubic(prog(u, -0.5, 6))), lerp(0.25, -0.05, E.inOutCubic(prog(u, 0, 8))), 0];
      G.lookFrom(cam, [Math.sin(orbit) * d, camY, Math.cos(orbit) * d], look, lerp(-0.12, 0, E.inOutCubic(prog(u, 0, 6))));
      cam.updateMatrixWorld();

      // ---- mirror copies the real badge's transforms
      if (!mirrorBuilt) buildMirror();
      copyTransforms(badge, mirror.userData.dst);
    },
  };
}

function copyTransforms(src, dst) {
  dst.position.copy(src.position); dst.rotation.copy(src.rotation); dst.scale.copy(src.scale); dst.visible = src.visible;
  for (let i = 0; i < src.children.length; i++) copyTransforms(src.children[i], dst.children[i]);
}
