// styles9.js: the last three directions, each one human, physical idea (no glows, no bokeh).
//   T "Magazine cover": each person is the cover of the jubilee issue: a big photo, the masthead
//     «ВТТ 60», a cover line with the name, an issue number. Three people: three covers.
//   U "Cut paper": layers of cut coloured paper in the brand colours with real shadows; the photo
//     held by masking tape; the name on a paper label strip.
//   V "Honour board": the classic board of honour, modern: a brass frame and mat round the
//     portrait, an engraved brass plate with the name, «Гордость техникума» above.
// Style frames only, centred in the middle 1440 px.
import * as M from './lib/motion.js';
import { sampleCover } from './lib/sample.js';
import { C, CHORD, DARK, DELA, MONT, font, SLANT, measure } from './lib/brand.js';
import { drawLogo, P, setLogoScale } from './jubilee.js';

const { W, H, TAU, hash01 } = M;

const CAST = [
  { surname: 'Богатыревич', name: 'Ольга Александровна', role: 'инженер по транспорту железнодорожного цеха', col: C.red, n: '01' },
  { surname: 'Богатыревич', name: 'Александр Иванович', role: 'транспортировщик в цехе полимерной продукции', col: C.green, n: '02' },
  { surname: 'Хитрецова', name: 'Людмила', role: 'выпускница ВТТ', col: C.cyan, n: '03' },
  { surname: 'Тимошкин', name: 'Иван', role: 'выпускник ВТТ', col: C.orange, n: '04' },
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
function logoAt(ctx, cx, cy, h, pal) {
  const s = h / (H * 0.53);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
  setLogoScale(0.53); drawLogo(ctx, 5, pal, { loop: 10, glints: false }); ctx.restore();
}
function speckle(ctx, n, seed, dark, light) {
  for (let i = 0; i < n; i++) { ctx.fillStyle = hash01(i, seed) > 0.5 ? light : dark; ctx.fillRect(hash01(i, seed + 1) * W, hash01(i, seed + 2) * H, 1.5, 1.5); }
}

// ================================================================ T: Magazine cover
// one cover, w x h at (x, y): photo full bleed, the masthead across the top, cover lines low left
function cover(ctx, p, x, y, w, h) {
  const s = w / 600;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 40 * s; ctx.shadowOffsetY = 20 * s;
  ctx.fillStyle = '#FFF'; ctx.fillRect(x, y, w, h); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  sampleCover(ctx, x, y, w, h);
  // a band of the person's colour under the cover lines, so the type reads on any photo
  const g = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h); g.addColorStop(0, 'rgba(10,20,40,0)'); g.addColorStop(1, 'rgba(10,20,40,0.85)');
  ctx.fillStyle = g; ctx.fillRect(x, y + h * 0.5, w, h * 0.5);
  // masthead: ВТТ huge, in white with the 60 in the person's colour
  ctx.save(); ctx.globalCompositeOperation = 'source-over';
  // the masthead fits the cover's width: «ВТТ» white, «60» in the person's colour, on a dark top band
  const tg = ctx.createLinearGradient(0, y, 0, y + 260 * s); tg.addColorStop(0, 'rgba(10,20,40,0.75)'); tg.addColorStop(1, 'rgba(10,20,40,0)');
  ctx.fillStyle = tg; ctx.fillRect(x, y, w, 260 * s);
  let ms = 130 * s; while (measure(ctx, 'ВТТ 60', font(ms, DELA)).w > w - 56 * s) ms -= 2;
  text(ctx, 'ВТТ', x + 28 * s, y + 20 * s + ms * 0.78, font(ms, DELA), '#FFFFFF');
  const mw = measure(ctx, 'ВТТ ', font(ms, DELA)).w;
  text(ctx, '60', x + 28 * s + mw, y + 20 * s + ms * 0.78, font(ms, DELA), p.col);
  ctx.restore();
  text(ctx, `ЮБИЛЕЙНЫЙ ВЫПУСК · № ${p.n} · 1965—2025`, x + 30 * s, y + 40 * s + ms * 0.95, font(17 * s, MONT, 700), '#FFFFFF', 'left', 3 * s);
  // cover lines
  let ty = y + h - 190 * s;
  ctx.fillStyle = p.col; ctx.fillRect(x + 30 * s, ty - 46 * s, measure(ctx, 'ГЕРОЙ НОМЕРА', font(16 * s, MONT, 700), 2 * s).w + 22 * s, 34 * s);
  text(ctx, 'ГЕРОЙ НОМЕРА', x + 40 * s, ty - 22 * s, font(16 * s, MONT, 700), '#FFFFFF', 'left', 2 * s);
  text(ctx, p.surname.toUpperCase(), x + 30 * s, ty + 40 * s, fit(ctx, p.surname.toUpperCase(), 66 * s, w - 60 * s, (f) => font(f, DELA)), '#FFFFFF'); ty += 86 * s;
  text(ctx, p.name, x + 30 * s, ty, fit(ctx, p.name, 32 * s, w - 60 * s, (f) => font(f, MONT, 700)), '#FFFFFF'); ty += 40 * s;
  wrap2(ctx, p.role, font(24 * s, MONT, 400), w - 60 * s).slice(0, 2).forEach((l, i) => text(ctx, l, x + 30 * s, ty + i * 30 * s, font(24 * s, MONT, 400), 'rgba(255,255,255,0.9)'));
  ctx.restore();
}
function desk(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#E9E4DC'); g.addColorStop(1, '#D6CFC4');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); speckle(ctx, 9000, 51, 'rgba(90,70,40,0.05)', 'rgba(255,255,255,0.3)');
}
function tHero(ctx) {
  desk(ctx);
  // the cover, and a second issue peeking behind it: the series continues
  ctx.save(); ctx.translate(W / 2 + 90, 540); ctx.rotate(0.05); ctx.translate(-(W / 2 + 90), -540);
  ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 30; ctx.fillRect(W / 2 - 230, 120, 600, 840); ctx.restore();
  ctx.save(); ctx.translate(W / 2 + 90, 540); ctx.rotate(0.05); ctx.translate(-(W / 2 + 90), -540);
  ctx.fillStyle = TRIO[0].col; ctx.fillRect(W / 2 - 230, 120, 600, 120); ctx.restore();
  cover(ctx, MAMA, W / 2 - 330, 110, 600, 860);
  logoAt(ctx, W / 2 + 610, 110, 110, P.light);
}
function tTrio(ctx) {
  desk(ctx);
  TRIO.forEach((p, i) => {
    const cx = W / 2 + (i - 1) * 470, w = 420, h = 600;
    ctx.save(); ctx.translate(cx, 540); ctx.rotate([-0.03, 0.01, 0.03][i]); ctx.translate(-cx, -540);
    cover(ctx, p, cx - w / 2, 540 - h / 2, w, h); ctx.restore();
  });
  logoAt(ctx, W / 2 + 640, 90, 100, P.light);
}

// ================================================================ U: Cut paper
function paperShape(ctx, pts, color, depth = 10) {
  ctx.save(); ctx.shadowColor = 'rgba(20,20,40,0.28)'; ctx.shadowBlur = depth * 2; ctx.shadowOffsetY = depth * 0.8;
  ctx.fillStyle = color; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.restore();
  // a faint fibre on the paper
  ctx.save(); ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
  speckle(ctx, 3000, pts.length * 7 + depth, 'rgba(0,0,0,0.05)', 'rgba(255,255,255,0.12)'); ctx.restore();
}
function cutPaperBg(ctx) {
  ctx.fillStyle = '#F3EEE6'; ctx.fillRect(0, 0, W, H); speckle(ctx, 9000, 61, 'rgba(90,70,40,0.05)', 'rgba(255,255,255,0.35)');
  // big leaning paper bands at the house angle, layered from the back
  const t = Math.tan(SLANT);
  const band = (x, w, col, d) => paperShape(ctx, [[x, H + 20], [x + w, H + 20], [x + w + t * (H + 40), -20], [x + t * (H + 40), -20]], col, d);
  band(-260, 260, C.blue, 8); band(60, 120, C.sky, 10); band(W - 600, 170, C.orange, 10); band(W - 380, 90, C.green, 12); band(W - 250, 300, C.cyan, 8);
}
function tape(ctx, x, y, w, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(236,226,196,0.85)'; ctx.beginPath();
  ctx.moveTo(-w / 2, -16); for (let i = 0; i <= 6; i++) ctx.lineTo(-w / 2 + (w * i) / 6, -16 + (i % 2 ? 2 : -2));
  ctx.lineTo(w / 2, 16); for (let i = 6; i >= 0; i--) ctx.lineTo(-w / 2 + (w * i) / 6, 16 + (i % 2 ? -2 : 2)); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function taped(ctx, p, cx, cy, w, h, rot) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.save(); ctx.shadowColor = 'rgba(20,20,40,0.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
  sampleCover(ctx, -w / 2 + 14, -h / 2 + 14, w - 28, h - 28);
  ctx.restore();
  tape(ctx, cx - w * 0.38, cy - h / 2 + 4, w * 0.36, -0.5 + rot); tape(ctx, cx + w * 0.38, cy - h / 2 + 4, w * 0.36, 0.45 + rot);
}
function label(ctx, p, cx, y, sc = 1, maxW = 760) {
  // a strip of white paper with the surname, a coloured strip with the name, the role below
  const f1 = fit(ctx, p.surname, 80 * sc, maxW, (f) => font(f, DELA)), w1 = measure(ctx, p.surname, f1).w + 60 * sc;
  ctx.save(); ctx.translate(cx, y); ctx.rotate(-0.02);
  paperShape(ctx, [[-w1 / 2, -70 * sc], [w1 / 2, -66 * sc], [w1 / 2 + 6 * sc, 22 * sc], [-w1 / 2 - 4 * sc, 18 * sc]], '#FFFFFF', 8);
  text(ctx, p.surname, 0, 0, f1, '#1E2230', 'center');
  ctx.restore();
  const f2 = fit(ctx, p.name, 40 * sc, maxW, (f) => font(f, MONT, 700)), w2 = measure(ctx, p.name, f2).w + 50 * sc;
  ctx.save(); ctx.translate(cx, y + 70 * sc); ctx.rotate(0.015);
  paperShape(ctx, [[-w2 / 2, -40 * sc], [w2 / 2, -38 * sc], [w2 / 2 + 4 * sc, 14 * sc], [-w2 / 2, 12 * sc]], p.col, 6);
  text(ctx, p.name, 0, 0, f2, '#FFFFFF', 'center');
  ctx.restore();
  wrap2(ctx, p.role, font(34 * sc, MONT, 700), maxW).forEach((l, i) => text(ctx, l, cx, y + 136 * sc + i * 42 * sc, font(34 * sc, MONT, 700), '#2E3344', 'center'));
}
function uHero(ctx) {
  cutPaperBg(ctx);
  taped(ctx, MAMA, W / 2, 330, 380, 440, -0.03);
  label(ctx, MAMA, W / 2, 680);
  logoAt(ctx, W / 2 + 610, 110, 110, P.light);
}
function uTrio(ctx) {
  cutPaperBg(ctx);
  TRIO.forEach((p, i) => {
    const cx = W / 2 + (i - 1) * 470;
    taped(ctx, p, cx, 340, 300, 350, [-0.04, 0.02, -0.02][i]);
    label(ctx, p, cx, 640, 0.62, 400);
  });
  logoAt(ctx, W / 2 + 640, 90, 100, P.light);
}

// ================================================================ V: Honour board
function brass(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  [['#7A5A24', 0], ['#D9B866', 0.22], ['#F4E2A6', 0.38], ['#B48A3E', 0.55], ['#E9CF86', 0.75], ['#8C6A2C', 1]].forEach(([c, s]) => g.addColorStop(s, c));
  return g;
}
function wall(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.35, 100, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, '#1C3F7A'); g.addColorStop(1, '#0A1E45');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // a soft fabric weave
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#FFFFFF';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  for (let x = 0; x < W; x += 4) ctx.fillRect(x, 0, 1, H);
  ctx.globalAlpha = 1;
  // a warm light falling on the board from above
  const l = ctx.createRadialGradient(W / 2, -200, 100, W / 2, -200, H * 1.3);
  l.addColorStop(0, 'rgba(255,220,160,0.22)'); l.addColorStop(1, 'rgba(255,220,160,0)'); ctx.fillStyle = l; ctx.fillRect(0, 0, W, H);
}
function header(ctx, y, size = 64) {
  ctx.save(); ctx.font = font(size, DELA); ctx.textAlign = 'center'; ctx.letterSpacing = '6px';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
  ctx.fillStyle = brass(ctx, W / 2 - 500, y - size, W / 2 + 500, y); ctx.fillText('ГОРДОСТЬ ТЕХНИКУМА', W / 2, y); ctx.restore();
  ctx.fillStyle = brass(ctx, W / 2 - 300, 0, W / 2 + 300, 0); ctx.fillRect(W / 2 - 300, y + 24, 600, 3);
}
function framedPortrait(ctx, cx, cy, w, h, sc = 1) {
  const b = 26 * sc, m = 30 * sc;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 40 * sc; ctx.shadowOffsetY = 20 * sc;
  ctx.fillStyle = brass(ctx, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2); ctx.fillRect(cx - w / 2 - b - m, cy - h / 2 - b - m, w + 2 * (b + m), h + 2 * (b + m)); ctx.restore();
  ctx.strokeStyle = 'rgba(80,55,20,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(cx - w / 2 - m - 1, cy - h / 2 - m - 1, w + 2 * m + 2, h + 2 * m + 2);
  ctx.fillStyle = '#F4EEE2'; ctx.fillRect(cx - w / 2 - m, cy - h / 2 - m, w + 2 * m, h + 2 * m);   // the mat
  sampleCover(ctx, cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
}
function plate(ctx, p, cx, y, w, sc = 1) {
  const lines = wrap2(ctx, p.role, font(28 * sc, MONT, 700), w - 60 * sc), h = (150 + lines.length * 34) * sc;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 20 * sc; ctx.shadowOffsetY = 10 * sc;
  ctx.fillStyle = brass(ctx, cx - w / 2, y, cx + w / 2, y + h); ctx.beginPath(); ctx.roundRect(cx - w / 2, y, w, h, 8 * sc); ctx.fill(); ctx.restore();
  // engraved: dark text with a light lower edge
  const eng = (s, yy, f) => { text(ctx, s, cx, yy + 1.5 * sc, f, 'rgba(255,240,200,0.6)', 'center'); text(ctx, s, cx, yy, f, '#3B2A0E', 'center'); };
  eng(p.surname.toUpperCase(), y + 62 * sc, fit(ctx, p.surname.toUpperCase(), 54 * sc, w - 50 * sc, (f) => font(f, DELA)));
  eng(p.name, y + 104 * sc, fit(ctx, p.name, 34 * sc, w - 50 * sc, (f) => font(f, MONT, 700)));
  lines.forEach((l, i) => eng(l, y + 142 * sc + i * 34 * sc, font(28 * sc, MONT, 700)));
  for (const sx of [-1, 1]) { ctx.fillStyle = '#6E5220'; ctx.beginPath(); ctx.arc(cx + sx * (w / 2 - 18 * sc), y + 18 * sc, 5 * sc, 0, TAU); ctx.fill(); }
}
function vHero(ctx) {
  wall(ctx); header(ctx, 120, 58);
  framedPortrait(ctx, W / 2, 440, 340, 400);
  plate(ctx, MAMA, W / 2, 720, 760);
  logoAt(ctx, W / 2 + 620, 110, 110, P.prof);
}
function vTrio(ctx) {
  wall(ctx); header(ctx, 110, 52);
  TRIO.forEach((p, i) => {
    const cx = W / 2 + (i - 1) * 470;
    framedPortrait(ctx, cx, 400, 240, 290, 0.75);
    plate(ctx, p, cx, 610, 420, 0.7);
  });
  logoAt(ctx, W / 2 + 640, 100, 100, P.prof);
}

export function styles9Clips() {
  const still = (f) => ({ dur: 1, samples: () => 1, draw(ctx) { f(ctx); } });
  return { st_hero: still(tHero), st_trio: still(tTrio), su_hero: still(uHero), su_trio: still(uTrio), sv_hero: still(vHero), sv_trio: still(vTrio) };
}
void CHORD; void DARK;
