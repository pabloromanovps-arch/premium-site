// styles4.js: three more art directions for the VTT 60 plates, style frames only.
//   D "Orbit": the brandbook's circle of industry symbols, with the person at its centre.
//   E "Mosaic": the brand pattern of colour tiles carrying white symbols, built round the photo.
//   F "Dark premium": graphite, the colour chord as thin lines of light, a coloured halo per person.
// Everything centred inside the middle 1440 px.
import * as M from './lib/motion.js';
import { sampleCover } from './lib/sample.js';
import { C, CHORD, DELA, MONT, font, SLANT, symbol, SYMBOLS, measure } from './lib/brand.js';
import { icon } from './lib/icons.js';
import { drawLogo, P, setLogoScale } from './jubilee.js';

const { W, H, TAU, hash01 } = M;
const INK = '#161616';

const MAMA = { surname: 'Богатыревич', name: 'Ольга Александровна', role: 'инженер по транспорту железнодорожного цеха', col: C.red, sym: 'rail' };
const TRIO = [
  { surname: 'Богатыревич', name: 'Александр Иванович', role: 'транспортировщик в цехе полимерной продукции', col: C.green, ic: 'molecule' },
  { surname: 'Хитрецова', name: 'Людмила', role: 'выпускница ВТТ', col: C.cyan, ic: 'flask' },
  { surname: 'Тимошкин', name: 'Иван', role: 'выпускник ВТТ', col: C.orange, ic: 'weld' },
];

function text(ctx, s, x, y, f, color, align = 'center', track = 0) {
  ctx.save(); ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.letterSpacing = `${track}px`; ctx.fillText(s, x, y); ctx.restore();
}
function fitFont(ctx, s, size, maxW, mk) { let f = size; while (measure(ctx, s, mk(f)).w > maxW) f -= 1; return mk(f); }
function wrap2(ctx, str, f, maxW) {
  ctx.font = f; if (ctx.measureText(str).width <= maxW) return [str];
  const w = str.split(' '); let best = null;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width); if (!best || m < best[0]) best = [m, [a, b]]; }
  return best[1];
}
function person(ctx, cx, cy, r, c0, c1, fg = 'rgba(255,255,255,0.55)') {
  return sampleCover(ctx, cx - r, cy - r, 2 * r, 2 * r);   // the real stand-in photo (lib/sample.js)
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.18, r * 0.32, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.78, r * 0.68, r * 0.5, 0, Math.PI, 0); ctx.fill();
}
function mark(ctx, p, x, y, s, c) { if (p.sym) symbol(ctx, p.sym, x, y, s, c); else icon(ctx, p.ic, x, y, s, c); }
function logoAt(ctx, cx, cy, h, pal = P.light) {
  const s = h / (H * 0.53);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
  setLogoScale(0.53); drawLogo(ctx, 5, pal, { loop: 10, glints: false }); ctx.restore();
}

// ================================================================ D: Orbit
function orbit(ctx, p, cx, cy, r, sc = 1) {
  // two thin orbits; the eight symbols ride the outer one, the person's own mark sits on the inner
  ctx.strokeStyle = 'rgba(22,22,22,0.12)'; ctx.lineWidth = 1.5;
  for (const k of [1.32, 1.62]) { ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, TAU); ctx.stroke(); }
  ctx.setLineDash([3, 9]); ctx.beginPath(); ctx.arc(cx, cy, r * 1.47, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  SYMBOLS.forEach((n, i) => {
    const a = -Math.PI / 2 + (i / 8) * TAU + 0.2, x = cx + Math.cos(a) * r * 1.62, y = cy + Math.sin(a) * r * 1.62;
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, r * 0.17, 0, TAU); ctx.fill();
    symbol(ctx, n, x, y, r * 0.2);
  });
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); person(ctx, cx, cy, r, '#6E93C2', '#2F5585'); ctx.restore();
  ctx.lineWidth = r * 0.06; ctx.strokeStyle = p.col; ctx.beginPath(); ctx.arc(cx, cy, r * 1.06, 0, TAU); ctx.stroke();
  const a = -Math.PI * 0.31, x = cx + Math.cos(a) * r * 1.32, y = cy + Math.sin(a) * r * 1.32, br = r * 0.24;
  ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.fill();
  mark(ctx, p, x, y, br * 1.15, '#FFFFFF');
  void sc;
}
function orbitName(ctx, p, cx, y, sc = 1, maxW = 760) {
  text(ctx, p.surname.toUpperCase(), cx, y, fitFont(ctx, p.surname.toUpperCase(), 74 * sc, maxW * sc, (f) => font(f, DELA)), INK);
  text(ctx, p.name, cx, y + 54 * sc, font(38 * sc, MONT, 700), INK);
  const lines = wrap2(ctx, p.role, font(28 * sc, MONT, 400), maxW * sc);
  CHORD.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(cx - 80 * sc + i * 20 * sc, y + 80 * sc, 20 * sc, 6 * sc); });
  lines.forEach((s, i) => text(ctx, s, cx, y + 128 * sc + i * 36 * sc, font(28 * sc, MONT, 400), '#3A3F4A'));
}
function orbitBg(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H / 2, W * 0.6);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#E9EEF4');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  logoAt(ctx, W / 2 + 610, 120, 120);
}
function orbitHero(ctx) { orbitBg(ctx); orbit(ctx, MAMA, W / 2, 400, 185); orbitName(ctx, MAMA, W / 2, 810); }
function orbitTrio(ctx) {
  orbitBg(ctx);
  TRIO.forEach((p, i) => { const cx = W / 2 + (i - 1) * 470; orbit(ctx, p, cx, 390, 125); orbitName(ctx, p, cx, 690, 0.66, 600); });
}

// ================================================================ E: Mosaic
function tileGrid(ctx, x0, y0, cols, rows, s, hole, seed = 1) {
  // brand pattern tiles; `hole` = [c0, r0, c1, r1] left empty for the photo
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (hole && c >= hole[0] && c < hole[2] && r >= hole[1] && r < hole[3]) continue;
    const k = Math.floor(hash01(c * 31 + r * 7, seed) * 8), col = CHORD[k], x = x0 + c * s, y = y0 + r * s;
    ctx.fillStyle = col; ctx.fillRect(x, y, s - 4, s - 4);
    if (hash01(c * 13 + r * 5, seed + 3) < 0.55) symbol(ctx, SYMBOLS[(k + 3) % 8], x + (s - 4) / 2, y + (s - 4) / 2, s * 0.5, '#FFFFFF');
  }
}
function mosaicHero(ctx) {
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  // a 9 x 6 field of tiles centred in the safe area, a 3 x 3 window for the photo, name bar below
  const s = 104, cols = 9, rows = 6, x0 = (W - cols * s) / 2, y0 = 70;
  tileGrid(ctx, x0, y0, cols, rows, s, [3, 1, 6, 4], 5);
  const px = x0 + 3 * s, py = y0 + s, pw = 3 * s - 4;
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, pw); ctx.clip(); person(ctx, px + pw / 2, py + pw / 2, pw / 2, '#6E93C2', '#2F5585'); ctx.restore();
  // the speciality mark as one tile of the person's colour, set into the window's corner
  ctx.fillStyle = MAMA.col; ctx.fillRect(px + pw - s + 4, py + pw - s + 4, s - 4, s - 4);
  mark(ctx, MAMA, px + pw - s / 2 + 2, py + pw - s / 2 + 2, s * 0.55, '#FFFFFF');
  // name bar
  const by = y0 + rows * s + 10;
  ctx.fillStyle = INK; ctx.fillRect(x0, by, cols * s - 4, 200);
  text(ctx, MAMA.surname.toUpperCase(), W / 2, by + 86, font(72, DELA), '#FFFFFF');
  text(ctx, `${MAMA.name}  /  ${MAMA.role}`, W / 2, by + 150, fitFont(ctx, `${MAMA.name}  /  ${MAMA.role}`, 32, cols * s - 80, (f) => font(f, MONT, 400)), 'rgba(255,255,255,0.88)');
}
function mosaicTrio(ctx) {
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  const s = 72;
  TRIO.forEach((p, i) => {
    const cols = 6, rows = 6, cx = W / 2 + (i - 1) * 470, x0 = cx - (cols * s) / 2, y0 = 110;
    tileGrid(ctx, x0, y0, cols, rows, s, [1, 1, 5, 5], 11 + i * 7);
    const px = x0 + s, py = y0 + s, pw = 4 * s - 4;
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, pw); ctx.clip(); person(ctx, px + pw / 2, py + pw / 2, pw / 2, '#6E93C2', '#2F5585'); ctx.restore();
    ctx.fillStyle = p.col; ctx.fillRect(px + pw - s + 4, py + pw - s + 4, s - 4, s - 4);
    mark(ctx, p, px + pw - s / 2 + 2, py + pw - s / 2 + 2, s * 0.55, '#FFFFFF');
    const by = y0 + rows * s + 6, bw = cols * s - 4;
    ctx.fillStyle = INK; ctx.fillRect(x0, by, bw, 210);
    text(ctx, p.surname.toUpperCase(), cx - 2, by + 62, fitFont(ctx, p.surname.toUpperCase(), 44, bw - 40, (f) => font(f, DELA)), '#FFFFFF');
    text(ctx, p.name, cx - 2, by + 106, font(28, MONT, 700), '#FFFFFF');
    wrap2(ctx, p.role, font(22, MONT, 400), bw - 40).forEach((sl, j) => text(ctx, sl, cx - 2, by + 148 + j * 28, font(22, MONT, 400), 'rgba(255,255,255,0.8)'));
  });
}

// ================================================================ F: Dark premium
function darkBg(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, '#1B2230'); g.addColorStop(1, '#07090D');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // the chord as eight hairlines of light, leaning at 15 deg, across the lower third
  CHORD.forEach((c, i) => {
    ctx.save(); ctx.translate(W / 2, H * 0.84 + i * 7); ctx.rotate(-SLANT * 0.35);
    const lg = ctx.createLinearGradient(-W * 0.6, 0, W * 0.6, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.5, c); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.globalAlpha = 0.85; ctx.fillRect(-W * 0.6, 0, W * 1.2, 2); ctx.restore();
  });
}
function halo(ctx, p, cx, cy, r) {
  const g = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.9);
  g.addColorStop(0, p.col); g.addColorStop(0.25, `${p.col}66`); g.addColorStop(1, `${p.col}00`);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.globalAlpha = 0.55; ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); person(ctx, cx, cy, r, '#3A4A66', '#151C2A', 'rgba(255,255,255,0.35)'); ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = p.col; ctx.beginPath(); ctx.arc(cx, cy, r + 14, -Math.PI * 0.75, -Math.PI * 0.25); ctx.stroke();
  const a = Math.PI * 0.25, x = cx + Math.cos(a) * (r + 14), y = cy + Math.sin(a) * (r + 14), br = r * 0.2;
  ctx.fillStyle = '#0B0E14'; ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = p.col; ctx.stroke(); mark(ctx, p, x, y, br * 1.1, p.col);
}
function darkName(ctx, p, cx, y, sc = 1, maxW = 800) {
  text(ctx, p.surname.toUpperCase(), cx, y, fitFont(ctx, p.surname.toUpperCase(), 64 * sc, maxW * sc, (f) => font(f, MONT, 700)), '#FFFFFF', 'center', 10 * sc);
  text(ctx, p.name, cx, y + 52 * sc, font(36 * sc, MONT, 400), 'rgba(255,255,255,0.82)', 'center', 2 * sc);
  ctx.fillStyle = p.col; ctx.fillRect(cx - 30 * sc, y + 80 * sc, 60 * sc, 3 * sc);
  wrap2(ctx, p.role.toUpperCase(), font(20 * sc, MONT, 700), maxW * sc).forEach((s, i) =>
    text(ctx, s, cx, y + 124 * sc + i * 30 * sc, font(20 * sc, MONT, 700), 'rgba(255,255,255,0.6)', 'center', 4 * sc));
}
function darkHero(ctx) { darkBg(ctx); halo(ctx, MAMA, W / 2, 360, 210); darkName(ctx, MAMA, W / 2, 700); logoAt(ctx, W / 2 + 600, 120, 120, P.teal); }
function darkTrio(ctx) {
  darkBg(ctx);
  TRIO.forEach((p, i) => { const cx = W / 2 + (i - 1) * 470; halo(ctx, p, cx, 380, 140); darkName(ctx, p, cx, 650, 0.66, 600); });
}

export function styles4Clips() {
  const still = (f) => ({ dur: 1, samples: () => 1, draw(ctx) { f(ctx); } });
  return {
    sd_hero: still(orbitHero), sd_trio: still(orbitTrio),
    se_hero: still(mosaicHero), se_trio: still(mosaicTrio),
    sf_hero: still(darkHero), sf_trio: still(darkTrio),
  };
}
