// jubilee.js: the main title of the VTT 60 jubilee evening, from the client's jubilee logo
// («Технология успеха: 60 лет в деле», assets/jubilee/parts.json, traced by tools/trace_jubilee.py).
// Two layers that share one clock so they work together:
//   jlogo_*  the logo assembling itself, on alpha (white for dark grounds, teal for the light one)
//   jfon_*   a full-frame 8 s seamless loop: turning gears, flasks breathing steam, a sparking electrode
//   jz_*     the two composited, ready to play as the evening's main title
// Beats shared by both: the 0 closes at 1.0 s (the electrode flashes), the words land at ~2 s (the
// flasks puff), the glint crosses at 3.2 s.
import * as M from './lib/motion.js';

const { clamp, lerp, E, spring, W, H, TAU, hash01 } = M;
const ease = (t, a, b, f = E.outCubic) => f(clamp((t - a) / (b - a)));

let J = null;
export async function loadJubilee() {
  const j = await fetch('assets/jubilee/parts.json').then((r) => r.json());
  J = { ...j, path: Object.fromEntries(Object.entries(j.parts).map(([k, d]) => [k, new Path2D(d)])) };
}

// ---------------------------------------------------------------- palettes
const P = {
  teal: { bg: '#04343A', bg2: '#0A4E56', grid: '#0A434A', line: '#13737B', fill: '#0B4C53', hi: '#2BB3BB',
    steam: '#CFEFF1', logo: '#FFFFFF', accent: '#2BB3BB' },
  navy: { bg: '#0A1A33', bg2: '#12305A', grid: '#10264A', line: '#25528A', fill: '#132C52', hi: '#3FA9F5',
    steam: '#D9E9FF', logo: '#FFFFFF', accent: '#18B5BF' },
  light: { bg: '#EEF7F7', bg2: '#FFFFFF', grid: '#DCEDEE', line: '#A9D3D6', fill: '#DCEEEF', hi: '#078C95',
    steam: '#7FBFC4', logo: '#078C95', accent: '#078C95' },
};
const SPARK = ['#FFFFFF', '#FFE7A3', '#FFB84D', '#FF8A1F'];
// the «Профессионалитет» colour chord (brandbook p. 30)
const CHORD8 = ['#00A1D3', '#3CBA94', '#F47920', '#43688F', '#A5ADB7', '#EF4323', '#025EA1', '#2A7DE1'];
P.prof = { bg: '#061C46', bg2: '#0C4C9C', grid: '#0B2A5E', line: 'rgba(255,255,255,0.30)', fill: 'rgba(255,255,255,0.07)',
  hi: 'rgba(255,255,255,0.75)', steam: '#E6F2FF', logo: '#FFFFFF', accent: '#2A7DE1', chordTeeth: true };

// ---------------------------------------------------------------- the logo
// placement: the logo's own box (source px / 1000) fitted to 80 % of the frame height, centred
const BOX = { x0: 0.275, x1: 1.559, y0: 0.344, y1: 1.559 };
const K = (H * 0.8) / (BOX.y1 - BOX.y0);
const OX = W / 2 - ((BOX.x0 + BOX.x1) / 2) * K, OY = H / 2 - ((BOX.y0 + BOX.y1) / 2) * K;
const toScreen = (x, y) => [OX + x * K, OY + y * K];

function gearPath(ctx, cx, cy, r, teeth, depth, rot, hole = 0) {
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = rot + (i / teeth) * TAU, s = TAU / teeth;
    const p = [[a - s * 0.5, r - depth], [a - s * 0.28, r - depth], [a - s * 0.18, r], [a + s * 0.18, r], [a + s * 0.28, r - depth]];
    p.forEach(([aa, rr], j) => (i === 0 && j === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr));
  }
  ctx.closePath();
  if (hole) { ctx.moveTo(cx + hole, cy); ctx.arc(cx, cy, hole, 0, TAU, true); }
}

// sparks thrown off a point: seeded, each a solid disc that shrinks to nothing (no soft alpha)
function sparks(ctx, x, y, t, t0, n, seed, { speed = 520, life = 0.7, size = 7, up = -0.5, spread = Math.PI * 0.9 } = {}) {
  for (let i = 0; i < n; i++) {
    const tt = t - t0 - hash01(i, seed + 3) * 0.15;
    const L = life * (0.6 + 0.4 * hash01(i, seed + 7));
    if (tt <= 0 || tt >= L) continue;
    const a = -Math.PI / 2 + up + (hash01(i, seed) - 0.5) * spread, v = speed * (0.5 + hash01(i, seed + 1));
    const px = x + Math.cos(a) * v * tt, py = y + Math.sin(a) * v * tt + 900 * tt * tt;
    const k = 1 - tt / L, r = size * k * (0.6 + 0.5 * hash01(i, seed + 2));
    ctx.fillStyle = SPARK[Math.min(3, Math.floor((1 - k) * 4))];
    ctx.beginPath(); ctx.arc(px, py, Math.max(0, r), 0, TAU); ctx.fill();
  }
}

function drawLogo(ctx, t, pal, { glints = true } = {}) {
  const { ring } = J;
  const [rcx, rcy] = toScreen(ring.cx, ring.cy), rout = ring.rout * K;
  ctx.save();
  // the gear teeth behind the 0: they come out once the ring has closed, then keep turning
  const kg = ease(t, 1.0, 1.7, E.outBack);
  if (t > 1.0 && kg > 0.001) {   // (outBack(0) is a hair above zero: guard on the start time)
    if (pal.chordTeeth) {
      // one tooth per brand colour, the chord running round the 0
      const n = 32, rot = -t * 0.18, r0 = rout - 4, r1 = rout + 34 * kg;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU, sA = TAU / n;
        ctx.fillStyle = CHORD8[i % 8];
        ctx.beginPath();
        ctx.moveTo(rcx + Math.cos(a - sA * 0.3) * r0, rcy + Math.sin(a - sA * 0.3) * r0);
        ctx.lineTo(rcx + Math.cos(a - sA * 0.2) * r1, rcy + Math.sin(a - sA * 0.2) * r1);
        ctx.lineTo(rcx + Math.cos(a + sA * 0.2) * r1, rcy + Math.sin(a + sA * 0.2) * r1);
        ctx.lineTo(rcx + Math.cos(a + sA * 0.3) * r0, rcy + Math.sin(a + sA * 0.3) * r0);
        ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle = pal.accent;
      gearPath(ctx, rcx, rcy, rout + 34 * kg, 28, 34 * kg, -t * 0.18, rout - 4);
      ctx.fill('evenodd');
    }
  }
  // the logo is drawn into its own layer so the glint can be clipped to its shapes
  const L = drawLogo.L || (drawLogo.L = document.createElement('canvas'));
  const SS = ctx.getTransform().a;
  if (L.width !== W * SS) { L.width = W * SS; L.height = H * SS; }
  const c = L.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, L.width, L.height);
  c.setTransform(SS, 0, 0, SS, 0, 0);
  c.fillStyle = pal.logo;
  const part = (name, clipFn) => {
    c.save();
    if (clipFn) { c.beginPath(); clipFn(c); c.clip(); }
    c.translate(OX, OY); c.scale(K, K);
    c.fill(J.path[name]);
    c.restore();
  };
  // 1. the 0 draws itself clockwise from the top (0.0 - 1.0 s), a spark riding its leading edge
  const kz = ease(t, 0.0, 1.0, E.inOutCubic);
  if (kz > 0) part('zero', (cc) => { cc.moveTo(rcx, rcy); cc.arc(rcx, rcy, rout + 60, -Math.PI / 2, -Math.PI / 2 + TAU * kz); cc.closePath(); });
  // 2. the 6 is written along its stroke: down the diagonal, then round the bowl (0.45 - 1.45 s)
  const k6 = ease(t, 0.45, 1.45, E.inOutCubic);
  if (k6 > 0) {
    const [ax, ay] = toScreen(0.72, 0.53), [bx, by] = toScreen(0.27, 1.62);
    part('six', (cc) => {
      // a band perpendicular to the stroke direction, sweeping from its top end to past its foot
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      const reach = len * 1.15 * k6, wide = 2000;
      cc.moveTo(ax - uy * wide - ux * 200, ay + ux * wide - uy * 200);
      cc.lineTo(ax + uy * wide - ux * 200, ay - ux * wide - uy * 200);
      cc.lineTo(ax + uy * wide + ux * reach, ay - ux * wide + uy * reach);
      cc.lineTo(ax - uy * wide + ux * reach, ay + ux * wide + uy * reach);
      cc.closePath();
    });
  }
  // 3. the heading rises out of its line, line by line; 4. the words inside the 0 pop in
  [['top1', 1.15, 0.344, 0.462], ['top2', 1.3, 0.53, 0.65]].forEach(([nm, t0, y0, y1]) => {
    const k = ease(t, t0, t0 + 0.55, E.outCubic);
    if (k <= 0) return;
    const [, sy0] = toScreen(0, y0 - 0.01), [, sy1] = toScreen(0, y1 + 0.01);
    c.save(); c.beginPath(); c.rect(0, sy0, W, sy1 - sy0); c.clip();
    c.translate(0, (1 - k) * (sy1 - sy0));
    part(nm);
    c.restore();
  });
  [['inner1', 1.7], ['inner2', 1.85]].forEach(([nm, t0]) => {
    const s = Math.max(0, spring(t - t0, { stiffness: 260, damping: 16 }));
    if (s <= 0) return;
    c.save(); c.translate(rcx, rcy); c.scale(s, s); c.translate(-rcx, -rcy); part(nm); c.restore();
  });
  // the glint: a bright band crossing the logo at the house angle, clipped to the logo's shapes
  if (glints) for (const g0 of [3.2, 6.4]) {
    const kgl = clamp((t - g0) / 0.9);
    if (kgl <= 0 || kgl >= 1) continue;
    const gx = lerp(OX - 300, OX + (BOX.x1 + 0.1) * K + 300, E.inOutSine(kgl));
    c.save(); c.globalCompositeOperation = 'source-atop';
    c.fillStyle = pal.logo === '#FFFFFF' ? '#BFF3F6' : '#3FD0D8';
    c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx + 90, 0); c.lineTo(gx - 200, H); c.lineTo(gx - 290, H); c.closePath(); c.fill();
    c.restore();
  }
  ctx.drawImage(L, 0, 0, W, H);
  // the spark at the head of the 0 while it draws, and a burst where it closes
  const rm = (ring.rin + ring.rout) / 2 * K;
  const head = (tt) => { const a = -Math.PI / 2 + TAU * ease(tt, 0.0, 1.0, E.inOutCubic); return [rcx + Math.cos(a) * rm, rcy + Math.sin(a) * rm]; };
  if (kz > 0 && kz < 1) { const [hx, hy] = head(t); ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, TAU); ctx.fill(); }
  // sparks shed by the head: a small group every 40 ms from where the head was then (continuous)
  for (let gi = 0; gi < 25; gi++) {
    const t0 = gi * 0.04;
    if (t0 > t || t - t0 > 0.4) continue;
    const [hx, hy] = head(t0);
    sparks(ctx, hx, hy, t, t0, 3, 500 + gi, { speed: 260, life: 0.35, size: 5 });
  }
  sparks(ctx, rcx, rcy - (ring.rin + ring.rout) / 2 * K, t, 1.0, 40, 11, { speed: 620, life: 0.9, size: 8, up: 0, spread: TAU });
  ctx.restore();
}

// ---------------------------------------------------------------- the background (8 s loop)
const LOOP = 8;
function flask(ctx, x, y, s, pal, t, phase, round = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineWidth = 6 / s; ctx.lineJoin = 'round';
  const body = new Path2D();
  if (round) {
    body.moveTo(-14, -120); body.lineTo(-14, -60); body.arc(0, 0, 62, -Math.PI / 2 - 0.23, Math.PI * 1.5 + 0.23 - TAU, true);
    body.lineTo(14, -60); body.lineTo(14, -120);
  } else {
    body.moveTo(-16, -120); body.lineTo(-16, -50); body.lineTo(-70, 50); body.quadraticCurveTo(-76, 64, -60, 64);
    body.lineTo(60, 64); body.quadraticCurveTo(76, 64, 70, 50); body.lineTo(16, -50); body.lineTo(16, -120);
  }
  // liquid: the lower part of the body, its surface wobbling
  ctx.save(); ctx.clip(body);
  const lv = round ? 0 : 6, wob = 4 * Math.sin(TAU * (t / LOOP) * 2 + phase);
  ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.moveTo(-90, lv + wob); ctx.quadraticCurveTo(0, lv - wob * 2, 90, lv + wob); ctx.lineTo(90, 90); ctx.lineTo(-90, 90); ctx.fill();
  ctx.globalAlpha = 1;
  // bubbles rising through the liquid (4 per loop each, seamless)
  for (let i = 0; i < 6; i++) {
    const p = ((t / LOOP) * 4 + i / 6 + phase) % 1;
    const bx = (hash01(i, 5) - 0.5) * 70, by = lerp(58, lv + 6, p);
    ctx.fillStyle = pal.steam; ctx.beginPath(); ctx.arc(bx, by, 3 + 4 * hash01(i, 9), 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = pal.hi; ctx.stroke(body);
  ctx.beginPath(); ctx.moveTo(-24, -120); ctx.lineTo(24, -120); ctx.stroke();
  // steam: puffs leave the neck, rise, swell and thin away (period 2 s, so 4 per loop)
  for (let i = 0; i < 5; i++) {
    const p = ((t / 2) + i / 5 + phase) % 1;
    const py = -130 - p * 240, px = 18 * Math.sin(p * 5 + i + phase * 6);
    ctx.globalAlpha = 0.5 * Math.sin(Math.PI * p);
    ctx.fillStyle = pal.steam; ctx.beginPath(); ctx.arc(px, py, 10 + 34 * p, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
function electrode(ctx, x, y, pal, t) {
  // the work piece and the electrode holder, line art; the arc at the tip flickers and spits sparks
  ctx.save();
  ctx.strokeStyle = pal.hi; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 260, y + 24); ctx.lineTo(x + 200, y + 24); ctx.stroke();
  ctx.fillStyle = pal.fill; ctx.fillRect(x - 260, y + 27, 460, 40);
  ctx.beginPath(); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x + 150, y - 190); ctx.stroke();
  ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(x + 150, y - 190); ctx.lineTo(x + 240, y - 300); ctx.stroke();
  ctx.lineWidth = 6;
  // flicker: a seeded per-frame brightness (frame-quantised so the loop repeats exactly)
  const f = Math.floor((t % LOOP) * 25), fl = 0.6 + 0.4 * hash01(f, 21);
  const flash = Math.max(fl, 1.6 * Math.exp(-Math.max(0, ((t % LOOP) - 1.0)) * 6) * ((t % LOOP) >= 1.0 ? 1 : 0));
  const g = ctx.createRadialGradient(x, y, 0, x, y, 260 * flash);
  g.addColorStop(0, 'rgba(255,200,120,0.55)'); g.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 300, y - 300, 600, 600);
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, 10 + 6 * fl, 0, TAU); ctx.fill();
  // star
  ctx.save(); ctx.translate(x, y); ctx.rotate(hash01(f, 4) * TAU);
  ctx.fillStyle = '#FFF4D6';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = i % 2 ? 6 : 34 * fl; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.fill(); ctx.restore();
  // a stream of sparks: groups launched every 0.2 s, plus the big burst on the 0's close (1.0 s)
  const tl = t % LOOP;
  for (let k = -4; k <= 0; k++) {
    const t0 = (Math.floor(tl / 0.2) + k) * 0.2;
    sparks(ctx, x, y, tl, t0, 6, ((Math.round(t0 / 0.2) % 40) + 40) % 40 + 100, { speed: 420, life: 0.8, size: 6, up: -0.9, spread: 1.6 });
  }
  sparks(ctx, x, y, tl, 1.0, 36, 300, { speed: 700, life: 1.1, size: 8, up: -0.7, spread: 2.4 });
  ctx.restore();
}
function drawFon(ctx, t, pal) {
  const tl = t % LOOP;
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, pal.bg2); g.addColorStop(1, pal.bg);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // blueprint grid
  ctx.strokeStyle = pal.grid; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 64) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 64) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  drawMid(ctx, tl, pal);
}
// gears, flasks and the electrode: the in-focus layer, shared by every background
function drawMid(ctx, tl, pal) {
  // gears: a meshing train, lower left and upper right; each turns a whole number of teeth per loop
  const w = (TAU / 24) / LOOP;   // the 24-tooth gear advances one tooth per loop
  const gears = [[250, 870, 230, 24, w, 0], [250 + 230 + 128 - 22, 870 - 120, 128, 12, -2 * w, Math.PI / 12],
    [1720, 170, 260, 24, -w, 0], [1720 - 260 - 112 + 20, 170 + 190, 112, 12, 2 * w, 0.1]];
  for (const [cx, cy, r, n, om, ph] of gears) {
    ctx.fillStyle = pal.fill; gearPath(ctx, cx, cy, r, n, r * 0.13, ph + om * tl, r * 0.28); ctx.fill('evenodd');
    ctx.strokeStyle = pal.line; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = ph + om * tl + (i / 6) * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3); ctx.lineTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62); ctx.stroke(); }
  }
  // flasks breathing steam (upper left), the electrode at work (lower right)
  flask(ctx, 230, 470, 1.6, pal, tl, 0.0);
  flask(ctx, 470, 430, 1.15, pal, tl, 0.37, true);
  electrode(ctx, 1600, 900, pal, tl);
}

// ---------------------------------------------------------------- the brand variant: depth + glass
// Three planes. Far: the colour chord, huge and out of focus, sliding one pattern width per loop.
// Middle (in focus): the gears, flasks and electrode. Near: big out-of-focus industry symbols and
// bokeh drifting past. Over the middle plane, liquid-glass pieces refract and frost what is behind
// them: a lens behind the logo and two capsules that float on closed orbits (seamless loop).
const LOW = 4;   // blurred planes are drawn at 1/4 size, blurred there, then scaled up: cheap and smooth
const lowCv = () => { const c = document.createElement('canvas'); c.width = W / LOW; c.height = H / LOW; return c; };
const PL = { far: null, mid: null, tmp: null, near: null };
function blurInto(dst, src, px) {
  const c = dst.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, dst.width, dst.height);
  c.filter = `blur(${px}px)`; c.drawImage(src, 0, 0); c.filter = 'none';
}
function farPlane(c, tl) {
  c.fillStyle = P.prof.bg; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, H * 0.55, 40, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, P.prof.bg2); g.addColorStop(1, P.prof.bg);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // the chord as a broad ribbon crossing the frame at 15 deg, repeating every 8 bands
  const bw = 170, period = bw * 8, shift = (tl / LOOP) * period;
  c.save(); c.translate(W / 2, H * 0.62); c.rotate(-15 * Math.PI / 180);
  for (let i = -16; i < 16; i++) {
    c.fillStyle = CHORD8[((i % 8) + 8) % 8]; c.globalAlpha = 0.85;
    c.fillRect(i * bw + shift - period, -150, bw + 1, 300);
  }
  c.restore(); c.globalAlpha = 1;
}
function nearPlane(c, tl) {
  // bokeh: soft discs in the brand colours drifting up and across (each wraps once per loop)
  for (let i = 0; i < 22; i++) {
    const p = (tl / LOOP + hash01(i, 77)) % 1;
    const x = (hash01(i, 78) * W * 1.2 - W * 0.1) + Math.sin(TAU * p + i) * 40, y = H * 1.1 - p * H * 1.3;
    c.globalAlpha = 0.35 * Math.sin(Math.PI * p);
    c.fillStyle = CHORD8[i % 8]; c.beginPath(); c.arc(x, y, 30 + 60 * hash01(i, 79), 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
  // two big out-of-focus gears in the near corners, turning slowly
  const w = (TAU / 16) / LOOP;
  [[-60, H + 40, 330, w, '#2A7DE1'], [W + 80, H * 0.45, 260, -w, '#3CBA94']].forEach(([cx, cy, r, om, col]) => {
    c.globalAlpha = 0.55; c.fillStyle = col;
    gearPath(c, cx, cy, r, 16, r * 0.16, om * tl, r * 0.35); c.fill('evenodd');
  });
  c.globalAlpha = 1;
}
// one liquid-glass shape: the plane behind, magnified and frosted inside it, a tint, a lit rim
function glass(ctx, path, cx, cy, behindLow, mag = 1.08) {
  ctx.save();
  ctx.clip(path);
  // refraction: the frosted plane behind, scaled about the glass centre
  ctx.translate(cx, cy); ctx.scale(mag, mag); ctx.translate(-cx, -cy);
  ctx.drawImage(behindLow, 0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(path);
  // rim light: bright towards the top left, fading round to the bottom right
  const rg = ctx.createLinearGradient(cx - 300, cy - 300, cx + 300, cy + 300);
  rg.addColorStop(0, 'rgba(255,255,255,0.85)'); rg.addColorStop(0.5, 'rgba(255,255,255,0.12)'); rg.addColorStop(1, 'rgba(255,255,255,0.45)');
  ctx.strokeStyle = rg; ctx.lineWidth = 3; ctx.stroke(path);
  ctx.restore();
}
function drawFonProf(ctx, t) {
  const tl = t % LOOP;
  if (!PL.far) { PL.far = lowCv(); PL.farB = lowCv(); PL.mid = lowCv(); PL.midB = lowCv(); PL.near = lowCv(); PL.nearB = lowCv(); }
  // far plane: drawn small, blurred hard (out of focus), scaled up
  const fc = PL.far.getContext('2d'); fc.setTransform(1 / LOW, 0, 0, 1 / LOW, 0, 0); farPlane(fc, tl);
  blurInto(PL.farB, PL.far, 10);
  ctx.drawImage(PL.farB, 0, 0, W, H);
  // grid, then the in-focus middle plane
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= W; x += 64) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 64) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  drawMid(ctx, tl, P.prof);
  // what the glass sees: the far + middle planes, small and frosted
  const mc = PL.mid.getContext('2d'); mc.setTransform(1, 0, 0, 1, 0, 0); mc.drawImage(PL.farB, 0, 0);
  mc.setTransform(1 / LOW, 0, 0, 1 / LOW, 0, 0); drawMid(mc, tl, P.prof);
  blurInto(PL.midB, PL.mid, 4);
  // liquid glass: the lens behind the logo, and two capsules on closed orbits
  const lx = W / 2 + 40, ly = H / 2 + 60;
  const lens = new Path2D(); lens.arc(lx, ly, 470, 0, TAU);
  glass(ctx, lens, lx, ly, PL.midB, 1.1);
  [[380, 760, 300, 110, 0], [1500, 300, 260, 96, 0.5]].forEach(([x0, y0, w, h, ph]) => {
    const a = TAU * (tl / LOOP + ph), x = x0 + Math.cos(a) * 40, y = y0 + Math.sin(a) * 26, rot = -0.26 + 0.06 * Math.sin(a);
    const cap = new Path2D(); cap.roundRect(-w / 2, -h / 2, w, h, h / 2);
    const placed = new Path2D(); placed.addPath(cap, new DOMMatrix().translate(x, y).rotate((rot * 180) / Math.PI));
    glass(ctx, placed, x, y, PL.midB, 1.12);
  });
  // near plane: out of focus, over everything
  const nc = PL.near.getContext('2d'); nc.setTransform(1 / LOW, 0, 0, 1 / LOW, 0, 0); nc.clearRect(0, 0, W, H); nearPlane(nc, tl);
  blurInto(PL.nearB, PL.near, 7);
  ctx.drawImage(PL.nearB, 0, 0, W, H);
}

export function jubileeClips() {
  const logo = (pal) => ({ dur: 8, samples: (t) => (t < 2.6 ? 8 : 4), draw(ctx, t) { drawLogo(ctx, t, pal); } });
  const fon = (pal) => ({ dur: LOOP, samples: () => 4, draw(ctx, t) { drawFon(ctx, t, pal); } });
  const both = (pal) => ({ dur: 8, samples: (t) => (t < 2.6 ? 8 : 4), draw(ctx, t) { drawFon(ctx, t, pal); drawLogo(ctx, t, pal); } });
  return {
    jlogo_white: logo(P.teal), jlogo_teal: logo(P.light),
    jfon_teal: fon(P.teal), jfon_navy: fon(P.navy), jfon_light: fon(P.light),
    jz_teal: both(P.teal), jz_navy: both(P.navy), jz_light: both(P.light),
    jlogo_prof: logo(P.prof),
    jz_prof3d: { dur: 8, samples: (t) => (t < 2.6 ? 6 : 3),
      async init() { this.m = await import('./jubilee3d.js'); await this.m.init3d(); },
      draw(ctx, t) { this.m.drawFon3D(ctx, t); drawLogo(ctx, t, P.prof); } },
    jfon_prof: { dur: LOOP, samples: () => 4, draw(ctx, t) { drawFonProf(ctx, t); } },
    jz_prof: { dur: 8, samples: (t) => (t < 2.6 ? 8 : 4), draw(ctx, t) { drawFonProf(ctx, t); drawLogo(ctx, t, P.prof); } },
  };
}
