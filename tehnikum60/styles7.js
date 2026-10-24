// styles7.js: two warm ("lamp-lit") directions for the VTT 60 plates. The hall is mostly 50+, so
// type is large and high-contrast, the elements are few, the mood is a family album, not tech.
//   P "Family album": warm cream paper, the photo as a print with white margins and album corners
//     in the brand colours, large names.
//   Q "Warm light": an evening hall, deep blue with a warm golden glow and soft out-of-focus
//     lights, the photo in a soft round frame, a large white name.
// Style frames only, centred in the middle 1440 px.
import * as M from './lib/motion.js';
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

function text(ctx, s, x, y, f, color, align = 'center', track = 0) {
  ctx.save(); ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.letterSpacing = `${track}px`; ctx.fillText(s, x, y); ctx.restore();
}
function fit(ctx, s, size, maxW, mk) { let f = size; while (measure(ctx, s, mk(f)).w > maxW) f -= 1; return mk(f); }
function wrap2(ctx, str, f, maxW) {
  ctx.font = f; if (ctx.measureText(str).width <= maxW) return [str];
  const w = str.split(' '); let best = null;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width); if (!best || m < best[0]) best = [m, [a, b]]; }
  return best[1];
}
function person(ctx, x, y, w, h, c0, c1, fg) {
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, s = Math.min(w, h);
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(cx, y + h * 0.42, s * 0.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, y + h * 1.0, s * 0.44, s * 0.38, 0, Math.PI, 0); ctx.fill();
}
function logoAt(ctx, cx, cy, h, pal) {
  const s = h / (H * 0.53);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
  setLogoScale(0.53); drawLogo(ctx, 5, pal, { loop: 10, glints: false }); ctx.restore();
}

// ================================================================ P: Family album
const INK = '#2A2733', SOFT = '#5C5566';
function paper(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 100, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, '#FBF6EC'); g.addColorStop(0.7, '#F2E8D6'); g.addColorStop(1, '#E3D4BB');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // paper fibre: faint speckle
  for (let i = 0; i < 14000; i++) { ctx.fillStyle = hash01(i, 41) > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(120,90,50,0.05)'; ctx.fillRect(hash01(i, 42) * W, hash01(i, 43) * H, 1.5, 1.5); }
  // warm light from the top left, as from a window
  const l = ctx.createRadialGradient(W * 0.2, -100, 50, W * 0.2, -100, W * 0.8);
  l.addColorStop(0, 'rgba(255,214,150,0.35)'); l.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = l; ctx.fillRect(0, 0, W, H);
}
// a print: white margins, a soft shadow, a little turn, album corners in the brand colours
function print(ctx, p, cx, cy, w, h, rot, sc = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.save(); ctx.shadowColor = 'rgba(80,55,20,0.28)'; ctx.shadowBlur = 40 * sc; ctx.shadowOffsetY = 18 * sc;
  ctx.fillStyle = '#FFFDF8'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
  const m = 22 * sc, iw = w - 2 * m, ih = h - 2 * m - 40 * sc;
  ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 + m, -h / 2 + m, iw, ih); ctx.clip();
  person(ctx, -w / 2 + m, -h / 2 + m, iw, ih, '#B9A98F', '#6F6252', 'rgba(255,250,240,0.6)');
  ctx.fillStyle = 'rgba(255,200,120,0.12)'; ctx.fillRect(-w / 2, -h / 2, w, h);   // a warm cast on the print
  ctx.restore();
  // album corners: little triangles holding the print, in the person's colour
  const k = 46 * sc;
  ctx.fillStyle = p.col;
  for (const [x, y, sx, sy] of [[-w / 2, -h / 2, 1, 1], [w / 2, -h / 2, -1, 1], [-w / 2, h / 2, 1, -1], [w / 2, h / 2, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x - sx * 6 * sc, y - sy * 6 * sc); ctx.lineTo(x + sx * k, y - sy * 6 * sc); ctx.lineTo(x - sx * 6 * sc, y + sy * k); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function albumName(ctx, p, cx, y, sc = 1, maxW = 1100) {
  text(ctx, p.surname, cx, y, fit(ctx, p.surname, 92 * sc, maxW, (f) => font(f, DELA)), INK);
  text(ctx, p.name, cx, y + 64 * sc, fit(ctx, p.name, 52 * sc, maxW, (f) => font(f, MONT, 700)), INK);
  CHORD.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(cx - 96 * sc + i * 24 * sc, y + 94 * sc, 24 * sc, 6 * sc); });
  wrap2(ctx, p.role, font(38 * sc, MONT, 400), maxW).forEach((l, i) => text(ctx, l, cx, y + 150 * sc + i * 46 * sc, font(38 * sc, MONT, 400), SOFT));
}
function pHero(ctx) {
  paper(ctx);
  print(ctx, MAMA, W / 2, 330, 400, 470, -0.025);
  albumName(ctx, MAMA, W / 2, 690);
  logoAt(ctx, W / 2 + 610, 110, 120, P.light);
}
function pTrio(ctx) {
  paper(ctx);
  TRIO.forEach((p, i) => {
    const cx = W / 2 + (i - 1) * 480;
    print(ctx, p, cx, 400, 320, 380, [-0.04, 0.015, -0.02][i], 0.85);
    albumName(ctx, p, cx, 700, 0.7, 440);
  });
  logoAt(ctx, W / 2 + 640, 90, 100, P.light);
}

// ================================================================ Q: Warm light
function evening(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.38, 60, W / 2, H * 0.45, W * 0.7);
  g.addColorStop(0, '#5A4A3A'); g.addColorStop(0.35, '#2A2D45'); g.addColorStop(1, '#0D1226');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // soft out-of-focus lights, warm, in the upper part, like garlands in a hall
  for (let i = 0; i < 46; i++) {
    const x = hash01(i, 11) * W, y = hash01(i, 12) * H * 0.75, r = 14 + 46 * hash01(i, 13), a = 0.08 + 0.16 * hash01(i, 14);
    const warm = hash01(i, 15) > 0.25;
    const bg = ctx.createRadialGradient(x, y, 0, x, y, r);
    bg.addColorStop(0, warm ? `rgba(255,196,120,${a})` : `rgba(120,180,255,${a})`); bg.addColorStop(0.7, warm ? `rgba(255,170,90,${a * 0.6})` : `rgba(100,160,255,${a * 0.6})`); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
function softPortrait(ctx, p, cx, cy, r) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.7);
  glow.addColorStop(0, 'rgba(255,190,110,0.45)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = glow; ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  person(ctx, cx - r, cy - r, 2 * r, 2 * r, '#C8B08C', '#6B5640', 'rgba(255,245,230,0.55)'); ctx.restore();
  ctx.lineWidth = r * 0.035; ctx.strokeStyle = 'rgba(255,236,205,0.95)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = r * 0.02; ctx.strokeStyle = p.col; ctx.beginPath(); ctx.arc(cx, cy, r * 1.08, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
}
function warmName(ctx, p, cx, y, sc = 1, maxW = 1100) {
  ctx.save(); ctx.shadowColor = 'rgba(255,180,90,0.35)'; ctx.shadowBlur = 30;
  text(ctx, p.surname, cx, y, fit(ctx, p.surname, 92 * sc, maxW, (f) => font(f, DELA)), '#FFF6E8'); ctx.restore();
  text(ctx, p.name, cx, y + 64 * sc, fit(ctx, p.name, 52 * sc, maxW, (f) => font(f, MONT, 700)), '#FFE9C8');
  ctx.fillStyle = p.col; ctx.fillRect(cx - 60 * sc, y + 92 * sc, 120 * sc, 6 * sc);
  wrap2(ctx, p.role, font(38 * sc, MONT, 400), maxW).forEach((l, i) => text(ctx, l, cx, y + 148 * sc + i * 46 * sc, font(38 * sc, MONT, 400), 'rgba(255,240,220,0.85)'));
}
function qHero(ctx) { evening(ctx); softPortrait(ctx, MAMA, W / 2, 330, 210); warmName(ctx, MAMA, W / 2, 690); logoAt(ctx, W / 2 + 610, 110, 120, P.prof); }
function qTrio(ctx) {
  evening(ctx);
  TRIO.forEach((p, i) => { const cx = W / 2 + (i - 1) * 480; softPortrait(ctx, p, cx, 380, 150); warmName(ctx, p, cx, 680, 0.7, 440); });
  logoAt(ctx, W / 2 + 640, 90, 100, P.prof);
}

export function styles7Clips() {
  const still = (f) => ({ dur: 1, samples: () => 1, draw(ctx) { f(ctx); } });
  return { sp_hero: still(pHero), sp_trio: still(pTrio), sq_hero: still(qHero), sq_trio: still(qTrio) };
}
