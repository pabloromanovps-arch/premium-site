// styles6.js: three new directions for the VTT 60 plates, each built for the sequence (one person,
// the next, then all three). Style frames only, centred in the middle 1440 px.
//   L "Chronicle": a film strip across the frame, each person one frame of it; a time ruler.
//   M "Pedestals": an isometric set, each person on a block of their industry colour, the
//     speciality on one face of the block and the name on the other.
//   O "Broadcast": TV sports-lineup graphics: 15 deg slabs, huge outline numbers, a name bar.
import * as M from './lib/motion.js';
import { sampleCover } from './lib/sample.js';
import { C, CHORD, DARK, LIGHT, DELA, MONT, font, SLANT, symbol, measure } from './lib/brand.js';
import { icon } from './lib/icons.js';
import { drawLogo, P, setLogoScale } from './jubilee.js';

const { W, H, TAU, hash01 } = M;
const TAN = Math.tan(SLANT);

const CAST = [
  { surname: 'Богатыревич', name: 'Ольга Александровна', role: 'инженер по транспорту железнодорожного цеха', col: C.red, sym: 'rail', n: '01' },
  { surname: 'Богатыревич', name: 'Александр Иванович', role: 'транспортировщик в цехе полимерной продукции', col: C.green, ic: 'molecule', n: '02' },
  { surname: 'Хитрецова', name: 'Людмила', role: 'выпускница ВТТ', col: C.cyan, ic: 'flask', n: '03' },
  { surname: 'Тимошкин', name: 'Иван', role: 'выпускник ВТТ', col: C.orange, ic: 'weld', n: '04' },
];
const [MAMA, ...TRIO] = CAST;

function text(ctx, s, x, y, f, color, align = 'left', track = 0) {
  ctx.save(); ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.letterSpacing = `${track}px`; ctx.fillText(s, x, y); ctx.restore();
}
function fit(ctx, s, size, maxW, mk, track = 0) { let f = size; while (measure(ctx, s, mk(f), track).w > maxW) f -= 1; return mk(f); }
function wrap2(ctx, str, f, maxW) {
  ctx.font = f; if (ctx.measureText(str).width <= maxW) return [str];
  const w = str.split(' '); let best = null;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width); if (!best || m < best[0]) best = [m, [a, b]]; }
  return best[1];
}
function person(ctx, x, y, w, h, c0, c1, fg) {
  return sampleCover(ctx, x, y, w, h);   // the real stand-in photo (lib/sample.js)
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, s = Math.min(w, h);
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(cx, y + h * 0.42, s * 0.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, y + h * 1.0, s * 0.44, s * 0.38, 0, Math.PI, 0); ctx.fill();
}
function mark(ctx, p, x, y, s, c) { if (p.sym) symbol(ctx, p.sym, x, y, s, c); else icon(ctx, p.ic, x, y, s, c); }
function logoAt(ctx, cx, cy, h, pal) {
  const s = h / (H * 0.53);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
  setLogoScale(0.53); drawLogo(ctx, 5, pal, { loop: 10, glints: false }); ctx.restore();
}
function grain(ctx, a, seed = 7) {
  for (let i = 0; i < 12000; i++) { ctx.fillStyle = hash01(i, seed + 2) > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; ctx.fillRect(hash01(i, seed) * W, hash01(i, seed + 1) * H, 1.6, 1.6); }
}

// ================================================================ L: Chronicle
const STRIP_Y = 150, STRIP_H = 600;
function chronicleBg(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0E1C38'); g.addColorStop(1, '#060C1A');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  grain(ctx, 0.05);
}
// the strip, slightly tilted at a fraction of the house angle, with sprocket holes top and bottom
function strip(ctx, frames, focus) {
  ctx.save(); ctx.translate(W / 2, STRIP_Y + STRIP_H / 2); ctx.rotate(-SLANT * 0.18); ctx.translate(-W / 2, -(STRIP_Y + STRIP_H / 2));
  ctx.fillStyle = '#05070C'; ctx.fillRect(-200, STRIP_Y, W + 400, STRIP_H);
  for (let x = -200; x < W + 200; x += 46) for (const y of [STRIP_Y + 18, STRIP_Y + STRIP_H - 44]) {
    ctx.fillStyle = '#1A2335'; ctx.beginPath(); ctx.roundRect(x, y, 26, 26, 5); ctx.fill();
  }
  // edge print, in the person's colour, like the numbers on a negative
  for (let x = -100; x < W + 100; x += 620) text(ctx, 'ВТТ · ТЕХНОЛОГИЯ УСПЕХА · 60', x, STRIP_Y + 72, font(16, MONT, 700), 'rgba(244,121,32,0.75)', 'left', 6);
  frames.forEach(([p, cx, k]) => {
    const fw = 400, fh = 410, x = cx - fw / 2, y = STRIP_Y + 92;
    ctx.save(); ctx.globalAlpha = k;
    ctx.beginPath(); ctx.roundRect(x, y, fw, fh, 12); ctx.clip();
    person(ctx, x, y, fw, fh, '#6E93C2', '#22406E', 'rgba(255,255,255,0.55)');
    if (p !== focus) { ctx.fillStyle = 'rgba(5,7,12,0.55)'; ctx.fillRect(x, y, fw, fh); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = k; ctx.lineWidth = 6; ctx.strokeStyle = p === focus || !focus ? p.col : 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.roundRect(x, y, fw, fh, 12); ctx.stroke();
    // frame number and the speciality mark on the strip margin under the frame
    text(ctx, p.n, x + 4, y + fh + 34, font(24, MONT, 700), p === focus || !focus ? '#FFFFFF' : 'rgba(255,255,255,0.3)', 'left', 4);
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x + fw - 22, y + fh + 26, 20, 0, TAU); ctx.fill(); mark(ctx, p, x + fw - 22, y + fh + 26, 24, '#FFFFFF');
    ctx.restore();
  });
  ctx.restore();
}
function ruler(ctx, mark0) {
  const y = 960, x0 = 330, x1 = W - 330;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  for (let yr = 1965; yr <= 2025; yr += 5) {
    const x = x0 + ((yr - 1965) / 60) * (x1 - x0), big = yr % 10 === 5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - (big ? 18 : 9)); ctx.stroke();
    if (big || yr === 2025) text(ctx, String(yr), x, y + 30, font(18, MONT, 700), 'rgba(255,255,255,0.6)', 'center', 2);
  }
  CHORD.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x0 + (i * (x1 - x0)) / 8, y - 3, (x1 - x0) / 8, 3); });
  if (mark0) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x1, y, 8, 0, TAU); ctx.fill(); }
}
function chronicleName(ctx, p, cx, y, sc = 1, maxW = 900, split = false) {
  text(ctx, p.surname.toUpperCase(), cx, y, fit(ctx, p.surname.toUpperCase(), 64 * sc, maxW, (f) => font(f, DELA)), '#FFFFFF', 'center');
  if (!split) { text(ctx, `${p.name}  ·  ${p.role}`, cx, y + 46 * sc, fit(ctx, `${p.name}  ·  ${p.role}`, 28 * sc, maxW, (f) => font(f, MONT, 400)), 'rgba(255,255,255,0.8)', 'center'); return; }
  text(ctx, p.name, cx, y + 40, font(26, MONT, 700), 'rgba(255,255,255,0.92)', 'center');
  wrap2(ctx, p.role, font(20, MONT, 400), maxW).forEach((l, i) => text(ctx, l, cx, y + 70 + i * 24, font(20, MONT, 400), 'rgba(255,255,255,0.7)', 'center'));
}
function lHero(ctx) {
  chronicleBg(ctx);
  strip(ctx, [[TRIO[2], W / 2 - 500, 0.9], [MAMA, W / 2, 1], [TRIO[0], W / 2 + 500, 0.9]], MAMA);
  chronicleName(ctx, MAMA, W / 2, 836, 1, 900);
  ruler(ctx, true);
  logoAt(ctx, W / 2 + 610, 80, 100, P.prof);
}
function lTrio(ctx) {
  chronicleBg(ctx);
  strip(ctx, TRIO.map((p, i) => [p, W / 2 + (i - 1) * 470, 1]), null);
  TRIO.forEach((p, i) => chronicleName(ctx, p, W / 2 + (i - 1) * 470, 810, 0.7, 420, true));
  ruler(ctx, true);
  logoAt(ctx, W / 2 + 610, 80, 100, P.prof);
}

// ================================================================ M: Pedestals
const ISO = { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) };
function isoFloor(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#EEF4FB'); g.addColorStop(1, '#CFDDEE');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(37,80,140,0.08)'; ctx.lineWidth = 1;
  for (let i = -40; i < 40; i++) {
    const o = i * 60;
    ctx.beginPath(); ctx.moveTo(W / 2 + o, 560); ctx.lineTo(W / 2 + o + ISO.x * 1400, 560 + ISO.y * 1400); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + o, 560); ctx.lineTo(W / 2 + o - ISO.x * 1400, 560 + ISO.y * 1400); ctx.stroke();
  }
  const fog = ctx.createLinearGradient(0, 520, 0, 700); fog.addColorStop(0, '#EEF4FB'); fog.addColorStop(1, 'rgba(238,244,251,0)');
  ctx.fillStyle = fog; ctx.fillRect(0, 0, W, 700);
}
// an isometric block: top face centred at (cx, cy), half-width a (along each iso axis), height h.
// The left face carries the name, the right face the speciality.
function pedestal(ctx, p, cx, cy, a, h, sc = 1) {
  const L = [cx - ISO.x * a, cy], R = [cx + ISO.x * a, cy], F = [cx, cy + ISO.y * a * 2 / 2 + ISO.y * a], B = [cx, cy - ISO.y * a];
  F[1] = cy + ISO.y * a;
  // shadow on the floor
  ctx.save(); ctx.fillStyle = 'rgba(20,40,80,0.18)'; ctx.filter = 'blur(24px)';
  ctx.beginPath(); ctx.moveTo(L[0] + 40, L[1] + h + 30); ctx.lineTo(F[0] + 60, F[1] + h + 40); ctx.lineTo(R[0] + 80, R[1] + h + 30); ctx.lineTo(B[0] + 60, B[1] + h + 20); ctx.fill(); ctx.restore();
  const poly = (pts, fill) => { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };
  poly([L, F, [F[0], F[1] + h], [L[0], L[1] + h]], p.col);
  poly([F, R, [R[0], R[1] + h], [F[0], F[1] + h]], DARK[p.col] || p.col);
  poly([B, R, F, L], LIGHT[p.col] || p.col);
  // name on the left face: the face's own skew (x along the face, y straight down)
  ctx.save(); ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([ISO.x, ISO.y, 0, 1, L[0], L[1]])));
  const fw = a * 2 / 2 / ISO.x * ISO.x * 1.0, faceW = Math.hypot(F[0] - L[0], F[1] - L[1]);
  text(ctx, p.surname.toUpperCase(), faceW / 2, h * 0.42, fit(ctx, p.surname.toUpperCase(), 40 * sc, faceW - 30 * sc, (f) => font(f, DELA)), '#FFFFFF', 'center');
  text(ctx, p.name, faceW / 2, h * 0.42 + 34 * sc, fit(ctx, p.name, 22 * sc, faceW - 30 * sc, (f) => font(f, MONT, 700)), 'rgba(255,255,255,0.92)', 'center');
  wrap2(ctx, p.role, font(16 * sc, MONT, 400), faceW - 40 * sc).forEach((s, i) => text(ctx, s, faceW / 2, h * 0.42 + 62 * sc + i * 20 * sc, font(16 * sc, MONT, 400), 'rgba(255,255,255,0.85)', 'center'));
  void fw; ctx.restore();
  // speciality on the right face
  ctx.save(); ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([ISO.x, -ISO.y, 0, 1, F[0], F[1]])));
  const rw = Math.hypot(R[0] - F[0], R[1] - F[1]);
  mark(ctx, p, rw / 2, h * 0.5, Math.min(rw, h) * 0.5, 'rgba(255,255,255,0.95)');
  ctx.restore();
  return B;
}
function standee(ctx, p, cx, baseY, w, h) {
  // the photo stands upright on the block: a card with a thin white border and a soft shadow
  const x = cx - w / 2, y = baseY - h;
  ctx.save(); ctx.shadowColor = 'rgba(20,40,80,0.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(x - 8, y - 8, w + 16, h + 16, 18); ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.clip(); person(ctx, x, y, w, h, '#8EA9CC', '#3D5F8E', 'rgba(255,255,255,0.6)'); ctx.restore();
  ctx.fillStyle = p.col; ctx.beginPath(); ctx.roundRect(x + 14, y + 14, 70, 34, 8); ctx.fill();
  text(ctx, `№ ${p.n}`, x + 49, y + 38, font(18, MONT, 700), '#FFFFFF', 'center', 2);
}
function mHero(ctx) {
  isoFloor(ctx);
  const cx = W / 2, cy = 620, a = 360, h = 260;
  pedestal(ctx, MAMA, cx, cy, a, h, 1.15);
  standee(ctx, MAMA, cx, cy + 50, 380, 500);
  logoAt(ctx, W / 2 + 600, 110, 120, P.light);
}
function mTrio(ctx) {
  isoFloor(ctx);
  TRIO.forEach((p, i) => {
    const cx = W / 2 + (i - 1) * 470, cy = 680, a = 210, h = 170;
    pedestal(ctx, p, cx, cy, a, h, 0.82);
    standee(ctx, p, cx, cy + 26, 240, 310);
  });
  logoAt(ctx, W / 2 + 600, 110, 120, P.light);
}

// ================================================================ O: Broadcast
function broadcastBg(ctx, col) {
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0A2A66'); g.addColorStop(1, '#04112B');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // speed lines at the house angle
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 2 + SLANT);
  for (let i = 0; i < 70; i++) {
    const y = (hash01(i, 3) - 0.5) * W * 1.4, l = 200 + hash01(i, 4) * 900, x = (hash01(i, 5) - 0.5) * H * 2;
    ctx.fillStyle = `rgba(120,180,255,${0.03 + 0.06 * hash01(i, 6)})`; ctx.fillRect(x, y, l, 2 + 3 * hash01(i, 7));
  }
  ctx.restore();
  // two big slabs of the person's colour, leaning
  if (col) {
    ctx.save(); ctx.globalAlpha = 0.9;
    for (const [x, w, a] of [[W / 2 - 520, 260, 0.35], [W / 2 + 330, 140, 0.25]]) {
      ctx.fillStyle = col; ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + w, H); ctx.lineTo(x + w + TAN * H, 0); ctx.lineTo(x + TAN * H, 0); ctx.fill();
    }
    ctx.restore();
  }
}
function slantPhoto(ctx, p, x, yb, w, h) {
  const o = TAN * h, path = () => { ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x + w, yb); ctx.lineTo(x + w + o, yb - h); ctx.lineTo(x + o, yb - h); ctx.closePath(); };
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24; ctx.fillStyle = p.col; path(); ctx.fill(); ctx.restore();
  ctx.save(); path(); ctx.clip(); person(ctx, x, yb - h, w + o, h, '#6E93C2', '#1E3E72', 'rgba(255,255,255,0.55)');
  const hl = ctx.createLinearGradient(x, yb - h, x + w, yb); hl.addColorStop(0, 'rgba(255,255,255,0.18)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(x, yb - h, w + o, h); ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = p.col; path(); ctx.stroke();
}
function bigNumber(ctx, n, x, y, size, col) {
  ctx.save(); ctx.font = font(size, DELA); ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.globalAlpha = 0.9; ctx.strokeText(n, x, y); ctx.restore();
}
function nameBar(ctx, p, x, y, w, sc = 1, nameInRole = false) {
  // the dark bar with the surname, the person's colour bar with the role under it, a chord tick
  const h1 = 96 * sc, h2 = 54 * sc, o1 = TAN * h1, o2 = TAN * h2;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(x, y + h1); ctx.lineTo(x + w, y + h1); ctx.lineTo(x + w + o1, y); ctx.lineTo(x + o1, y); ctx.fill(); ctx.restore();
  ctx.fillStyle = p.col; ctx.beginPath(); ctx.moveTo(x - o2, y + h1 + h2); ctx.lineTo(x + w * 0.86 - o2, y + h1 + h2); ctx.lineTo(x + w * 0.86, y + h1); ctx.lineTo(x, y + h1); ctx.fill();
  text(ctx, p.surname.toUpperCase(), x + o1 + 26 * sc, y + 66 * sc, fit(ctx, p.surname.toUpperCase(), 58 * sc, w * 0.62, (f) => font(f, DELA)), '#0A1A3A');
  const sw = measure(ctx, p.surname.toUpperCase(), fit(ctx, p.surname.toUpperCase(), 58 * sc, w * 0.62, (f) => font(f, DELA))).w;
  if (!nameInRole) text(ctx, p.name, x + o1 + 40 * sc + sw, y + 64 * sc, fit(ctx, p.name, 30 * sc, w - sw - 90 * sc, (f) => font(f, MONT, 700)), '#0A1A3A');
  const role = nameInRole ? `${p.name}` : p.role.toUpperCase();
  text(ctx, role, x + 20 * sc, y + h1 + 36 * sc, fit(ctx, role, (nameInRole ? 26 : 22) * sc, w * 0.8, (f) => font(f, MONT, 700), 3), '#FFFFFF', 'left', nameInRole ? 1 : 3);
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x + w + o1 - 6 * sc, y + h1 / 2, 34 * sc, 0, TAU); ctx.fill();
  mark(ctx, p, x + w + o1 - 6 * sc, y + h1 / 2, 40 * sc, p.col);
}
function oHero(ctx) {
  broadcastBg(ctx, MAMA.col);
  bigNumber(ctx, MAMA.n, W / 2 + 330, 640, 560, 'rgba(255,255,255,0.18)');
  slantPhoto(ctx, MAMA, 520, 760, 520, 600);
  nameBar(ctx, MAMA, 800, 600, 860);
  logoAt(ctx, W / 2 + 610, 110, 110, P.prof);
  CHORD.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(300 + i * 40, 900, 40, 8); });
}
function oTrio(ctx) {
  broadcastBg(ctx, null);
  TRIO.forEach((p, i) => {
    const cx = W / 2 + (i - 1) * 470;
    bigNumber(ctx, p.n, cx + 40, 540, 380, 'rgba(255,255,255,0.14)');
    slantPhoto(ctx, p, cx - 170, 640, 300, 450);
    nameBar(ctx, p, cx - 215, 680, 400, 0.72, true);
    wrap2(ctx, p.role, font(22, MONT, 400), 400).forEach((l, j) => text(ctx, l, cx - 10, 842 + j * 28, font(22, MONT, 400), 'rgba(220,235,255,0.8)', 'center'));
  });
  logoAt(ctx, W / 2 + 610, 110, 110, P.prof);
}

export function styles6Clips() {
  const still = (f) => ({ dur: 1, samples: () => 1, draw(ctx) { f(ctx); } });
  return { sl_hero: still(lHero), sl_trio: still(lTrio), sm_hero: still(mHero), sm_trio: still(mTrio), so_hero: still(oHero), so_trio: still(oTrio) };
}
