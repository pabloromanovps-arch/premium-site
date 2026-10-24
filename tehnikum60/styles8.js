// styles8.js: two warm directions with one idea each, for a hall of mostly 50+ guests: large
// type, few elements, but a concept that carries the meaning.
//   R "Gears of generations": the jubilee logo's own device, a gear with teeth in the colour
//     chord, becomes the photo frame; three people are three gears in mesh, turning each other.
//   S "Thread of generations": the eight brand colours braided into one warm cord that runs
//     through the frame and wraps each photo, tying the people together.
import * as M from './lib/motion.js';
import { sampleCover } from './lib/sample.js';
import { C, CHORD, DELA, MONT, font, measure } from './lib/brand.js';
import { drawLogo, P, setLogoScale } from './jubilee.js';

const { W, H, TAU, hash01 } = M;

const CAST = [
  { surname: 'Богатыревич', name: 'Ольга Александровна', role: 'инженер по транспорту железнодорожного цеха', col: C.red },
  { surname: 'Богатыревич', name: 'Александр Иванович', role: 'транспортировщик в цехе полимерной продукции', col: C.green },
  { surname: 'Хитрецова', name: 'Людмила', role: 'выпускница ВТТ', col: C.cyan },
  { surname: 'Тимошкин', name: 'Иван', role: 'выпускник ВТТ', col: C.orange },
];
const [MAMA, ...TRIO] = CAST;

function text(ctx, s, x, y, f, color, align = 'center') {
  ctx.save(); ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y); ctx.restore();
}
function fit(ctx, s, size, maxW, mk) { let f = size; while (measure(ctx, s, mk(f)).w > maxW) f -= 1; return mk(f); }
function wrap2(ctx, str, f, maxW) {
  ctx.font = f; if (ctx.measureText(str).width <= maxW) return [str];
  const w = str.split(' '); let best = null;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width); if (!best || m < best[0]) best = [m, [a, b]]; }
  return best[1];
}
function person(ctx, cx, cy, r, c0, c1, fg) {
  return sampleCover(ctx, cx - r, cy - r, 2 * r, 2 * r);   // the real stand-in photo (lib/sample.js)
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.18, r * 0.32, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.8, r * 0.68, r * 0.5, 0, Math.PI, 0); ctx.fill();
}
function logoAt(ctx, cx, cy, h, pal) {
  const s = h / (H * 0.53);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
  setLogoScale(0.53); drawLogo(ctx, 5, pal, { loop: 10, glints: false }); ctx.restore();
}
function names(ctx, p, cx, y, sc, maxW, ink, soft, bar) {
  text(ctx, p.surname, cx, y, fit(ctx, p.surname, 92 * sc, maxW, (f) => font(f, DELA)), ink);
  text(ctx, p.name, cx, y + 62 * sc, fit(ctx, p.name, 50 * sc, maxW, (f) => font(f, MONT, 700)), ink);
  ctx.fillStyle = bar; ctx.fillRect(cx - 60 * sc, y + 88 * sc, 120 * sc, 6 * sc);
  wrap2(ctx, p.role, font(36 * sc, MONT, 400), maxW).forEach((l, i) => text(ctx, l, cx, y + 142 * sc + i * 44 * sc, font(36 * sc, MONT, 400), soft));
}
function warmPaper(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, '#FFF9EF'); g.addColorStop(0.7, '#F4EADA'); g.addColorStop(1, '#E6D6BE');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14000; i++) { ctx.fillStyle = hash01(i, 41) > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(120,90,50,0.05)'; ctx.fillRect(hash01(i, 42) * W, hash01(i, 43) * H, 1.5, 1.5); }
}

// ================================================================ R: Gears of generations
// a gear: n teeth in the chord colours round a cream ring, turned by rot; the photo inside
function gear(ctx, p, cx, cy, r, n, rot, { photo = true, body = '#FFFDF7' } = {}) {
  const th = r * 0.16, tw = (TAU / n) * 0.5;
  ctx.save(); ctx.translate(cx, cy);
  ctx.save(); ctx.shadowColor = 'rgba(90,60,20,0.25)'; ctx.shadowBlur = r * 0.18; ctx.shadowOffsetY = r * 0.06;
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#1F3A6B'; ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, TAU); ctx.arc(0, 0, r * 0.88, 0, TAU, true); ctx.fill();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    ctx.save(); ctx.rotate(a); ctx.fillStyle = CHORD[i % 8];
    ctx.beginPath(); ctx.moveTo(r - 2, -tw * r * 0.62); ctx.lineTo(r + th, -tw * r * 0.36); ctx.lineTo(r + th, tw * r * 0.36); ctx.lineTo(r - 2, tw * r * 0.62); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (photo) {
    const ri = r * 0.86;
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, ri, 0, TAU); ctx.clip(); person(ctx, 0, 0, ri, '#C2AE8E', '#6E5A43', 'rgba(255,248,236,0.6)'); ctx.restore();
    ctx.lineWidth = r * 0.03; ctx.strokeStyle = p ? p.col : '#C9B89C'; ctx.beginPath(); ctx.arc(0, 0, ri + r * 0.03, 0, TAU); ctx.stroke();
  } else {
    ctx.fillStyle = '#F6EDDD'; ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1F3A6B'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function rHero(ctx) {
  warmPaper(ctx);
  // small gears in mesh with the big one, at its shoulders: the mechanism keeps turning
  gear(ctx, null, W / 2 - 330, 170, 90, 14, 0.11, { photo: false, body: '#FBF3E6' });
  gear(ctx, null, W / 2 + 320, 220, 70, 11, 0.2, { photo: false, body: '#FBF3E6' });
  gear(ctx, MAMA, W / 2, 360, 230, 36, 0);
  names(ctx, MAMA, W / 2, 740, 1, 1100, '#2A2733', '#5C5566', MAMA.col);
  logoAt(ctx, W / 2 + 640, 100, 110, P.light);
}
function rTrio(ctx) {
  warmPaper(ctx);
  // three gears in mesh: their centres one pitch apart, the middle one turned half a tooth
  const r = 190, n = 30, xs = [W / 2 - 2 * r - 30, W / 2, W / 2 + 2 * r + 30], ys = [380, 380, 380];
  TRIO.forEach((p, i) => gear(ctx, p, xs[i], ys[i], r, n, i === 1 ? Math.PI / n : 0));
  TRIO.forEach((p, i) => names(ctx, p, xs[i], 720, 0.6, 400, '#2A2733', '#5C5566', p.col));
  logoAt(ctx, W / 2 + 640, 90, 100, P.light);
}

// ================================================================ S: Thread of generations
function warmEvening(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.38, 60, W / 2, H * 0.45, W * 0.7);
  g.addColorStop(0, '#4A3D33'); g.addColorStop(0.4, '#252840'); g.addColorStop(1, '#0D1226');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) {
    const x = hash01(i, 11) * W, y = hash01(i, 12) * H * 0.7, r = 12 + 36 * hash01(i, 13), a = 0.05 + 0.1 * hash01(i, 14);
    const bg = ctx.createRadialGradient(x, y, 0, x, y, r); bg.addColorStop(0, `rgba(255,196,120,${a})`); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
// a braided cord along a list of points: eight strands, each the chord colour, twisting round
// the path; the strand at the back of the twist is drawn darker and first
function cord(ctx, pts, width = 16, twist = 0.05) {
  // resample
  const P2 = []; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4); for (let k = 0; k < n; k++) P2.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
  P2.push(pts[pts.length - 1]);
  let s = 0; const S = [0]; for (let i = 1; i < P2.length; i++) { s += Math.hypot(P2[i][0] - P2[i - 1][0], P2[i][1] - P2[i - 1][1]); S.push(s); }
  ctx.save(); ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,190,110,0.35)'; ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(30,20,10,0.6)'; ctx.lineWidth = width + 6; ctx.beginPath(); P2.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.shadowBlur = 0;
  for (let pass = 0; pass < 2; pass++) for (let j = 0; j < 8; j++) {
    ctx.strokeStyle = CHORD[j]; ctx.lineWidth = width * 0.34;
    for (let i = 1; i < P2.length; i++) {
      const ph = S[i] * twist + (j / 8) * TAU, front = Math.cos(ph) > 0;
      if (front !== (pass === 1)) continue;
      const [x0, y0] = P2[i - 1], [x1, y1] = P2[i], L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const o0 = Math.sin(S[i - 1] * twist + (j / 8) * TAU) * width * 0.4, o1 = Math.sin(ph) * width * 0.4;
      ctx.globalAlpha = front ? 1 : 0.55;
      ctx.beginPath(); ctx.moveTo(x0 + nx * o0, y0 + ny * o0); ctx.lineTo(x1 + nx * o1, y1 + ny * o1); ctx.stroke();
    }
  }
  ctx.restore();
}
const arcPts = (cx, cy, r, a0, a1, n = 90) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
function framed(ctx, p, cx, cy, r) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.6); glow.addColorStop(0, 'rgba(255,190,110,0.35)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = glow; ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); person(ctx, cx, cy, r, '#C8B08C', '#6B5640', 'rgba(255,245,230,0.55)'); ctx.restore();
}
function sHero(ctx) {
  warmEvening(ctx);
  const cx = W / 2, cy = 350, r = 200;
  framed(ctx, MAMA, cx, cy, r);
  // the cord comes in from the left, wraps the photo once, and runs off to the right
  const a0 = Math.PI * 0.8, wrap = arcPts(cx, cy, r + 14, a0, a0 + TAU);
  cord(ctx, [[-40, cy + 300], [cx - 520, cy + 260], ...wrap, [cx, cy + r + 70], [cx + 560, cy + 250], [W + 40, cy + 290]], 18);
  names(ctx, MAMA, cx, 740, 1, 1100, '#FFF6E8', 'rgba(255,240,220,0.85)', MAMA.col);
  logoAt(ctx, W / 2 + 640, 100, 110, P.prof);
}
function sTrio(ctx) {
  warmEvening(ctx);
  const r = 140, xs = [W / 2 - 470, W / 2, W / 2 + 470], cy = 360;
  TRIO.forEach((p, i) => framed(ctx, p, xs[i], cy, r));
  // one cord through all three: it wraps each photo and dips between them
  const pts = [[-40, cy + 200]];
  xs.forEach((x) => { const a0 = Math.PI * 0.8; pts.push([x - r - 90, cy + r + 40]); pts.push(...arcPts(x, cy, r + 12, a0, a0 + TAU)); pts.push([x + 20, cy + r + 60]); });
  pts.push([W + 40, cy + 180]);
  cord(ctx, pts, 15);
  TRIO.forEach((p, i) => names(ctx, p, xs[i], 680, 0.62, 400, '#FFF6E8', 'rgba(255,240,220,0.85)', p.col));
  logoAt(ctx, W / 2 + 640, 90, 100, P.prof);
}

export function styles8Clips() {
  const still = (f) => ({ dur: 1, samples: () => 1, draw(ctx) { f(ctx); } });
  return { sr_hero: still(rHero), sr_trio: still(rTrio), ss_hero: still(sHero), ss_trio: still(sTrio) };
}
