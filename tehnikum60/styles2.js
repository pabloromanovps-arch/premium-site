// styles2.js: two other art directions for the VTT 60 plates, no glass. Style frames only (the
// settled state); each is drawn full frame on its own background. Content stays in the centre
// 1440 px: the screens at the venue crop the sides.
//   A "Poster": light, flat, Dela Gothic set big, photos cut as 15 deg parallelograms over colour
//     fields of their industry, the colour chord as a ribbon: the brandbook's cover language.
//   B "Blueprint": a navy engineering sheet, fine grid, thin white line work, scales, dimension
//     lines and a drawing's title block; the brand colours only as accents.
import * as M from './lib/motion.js';
import { C, CHORD, DARK, DELA, MONT, font, SLANT, symbol, ribbon, measure } from './lib/brand.js';
import { icon } from './lib/icons.js';
import { drawLogo, P, setLogoScale } from './jubilee.js';

const { W, H, TAU } = M;
const TAN = Math.tan(SLANT);

const MAMA = { surname: 'Богатыревич', name: 'Ольга Александровна', role: 'инженер по транспорту железнодорожного цеха', col: C.red, sym: 'rail' };
const PAPA = { surname: 'Богатыревич', name: 'Александр Иванович', role: 'транспортировщик в цехе полимерной продукции', col: C.green, ic: 'molecule' };
const LUDA = { surname: 'Хитрецова', name: 'Людмила', role: 'выпускница ВТТ', col: C.cyan, ic: 'flask' };
const IVAN = { surname: 'Тимошкин', name: 'Иван', role: 'выпускник ВТТ', col: C.orange, ic: 'weld' };

function wrap2(ctx, str, f, maxW) {
  ctx.font = f; if (ctx.measureText(str).width <= maxW) return [str];
  const w = str.split(' '); let best = null;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (!best || m < best[0]) best = [m, [a, b]];
  }
  return best[1];
}
function text(ctx, s, x, y, f, color, align = 'left', track = 0) {
  ctx.save(); ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.letterSpacing = `${track}px`; ctx.fillText(s, x, y); ctx.restore();
}
// the photo stand-in: a person silhouette on a soft gradient
function person(ctx, x, y, w, h, c0, c1, fg) {
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, s = Math.min(w, h);
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(cx, y + h * 0.4, s * 0.17, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, y + h * 0.98, s * 0.36, s * 0.3, 0, Math.PI, 0); ctx.fill();
}
const lean = (ctx, x, y, w, h) => {   // a parallelogram leaning at the house angle, (x, y) its bottom-left
  const o = TAN * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w + o, y - h); ctx.lineTo(x + o, y - h); ctx.closePath();
};
function mark(ctx, p, x, y, size, color) {   // a person's speciality mark: a brand symbol or a VTT icon
  if (p.sym) symbol(ctx, p.sym, x, y, size, color); else icon(ctx, p.ic, x, y, size, color);
}
function logoAt(ctx, cx, cy, h) {   // the jubilee logo, drawn in vector at height h
  const s = h / (H * 0.53);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
  setLogoScale(0.53); drawLogo(ctx, 5, P.prof, { loop: 10, glints: false }); ctx.restore();
}

// ================================================================ A: Poster
const PAPER = '#F3F5F8', INK = '#14213D';
function posterBg(ctx, ry = 0.93) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  // the cover ribbon, crossing low behind everything
  ribbon(ctx, W * 0.5, H * ry, W * 1.5, 46, -SLANT * 0.55, 1);
}
function posterHero(ctx, p, cx, cy, sc = 1, compact = false) {
  // the colour field and, offset over it, the photo, both as leaning parallelograms
  const pw = 360 * sc, ph = 470 * sc, x = cx - pw / 2 - (TAN * ph) / 2, yb = cy + ph / 2;
  ctx.fillStyle = p.col; lean(ctx, x + 34 * sc, yb + 26 * sc, pw, ph); ctx.fill();
  ctx.save(); lean(ctx, x, yb, pw, ph); ctx.clip();
  person(ctx, x, yb - ph, pw + TAN * ph, ph, '#DCE3EC', '#AEB9C8', 'rgba(255,255,255,0.75)');
  ctx.restore();
  // the speciality mark in a white tab on the field's corner
  const tx = x + pw + TAN * ph + 6 * sc, ty = yb - ph + 70 * sc, ts = 92 * sc;
  ctx.fillStyle = '#FFFFFF'; lean(ctx, tx - ts * 0.7, ty + ts / 2, ts * 1.1, ts); ctx.fill();
  mark(ctx, p, tx - ts * 0.15 + TAN * ts / 2, ty, ts * 0.62, p.col);
  if (compact) return yb;
  return yb;
}
function posterName(ctx, p, x, y, align, sc = 1, maxW = 620) {
  const f1 = font(84 * sc, DELA), f2 = font(40 * sc, MONT, 700), f3 = font(28 * sc, MONT, 400);
  let fs = 84 * sc; while (measure(ctx, p.surname.toUpperCase(), font(fs, DELA)).w > maxW * sc) fs -= 2;
  text(ctx, p.surname.toUpperCase(), x, y, font(fs, DELA), INK, align);
  text(ctx, p.name, x, y + 56 * sc, f2, INK, align);
  // the slash and the role, in the person's colour
  const lines = wrap2(ctx, p.role, f3, maxW * sc);
  const bx = align === 'center' ? x - 60 * sc : x;
  ctx.fillStyle = p.col; ctx.fillRect(bx, y + 84 * sc, 120 * sc, 8 * sc);
  lines.forEach((s, i) => text(ctx, s, x, y + 136 * sc + i * 36 * sc, f3, '#3B4A66', align));
}
function posterHeroFrame(ctx) {
  posterBg(ctx);
  // the big number behind: 60, outlined, the anniversary under every plate
  ctx.save(); ctx.font = font(560, DELA); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,33,61,0.08)'; ctx.textAlign = 'center';
  ctx.strokeText('60', W / 2 + 330, 760); ctx.restore();
  posterHero(ctx, MAMA, 700, 520);
  posterName(ctx, MAMA, 1010, 470, 'left', 1, 620);
  logoBadge(ctx, 1560, 150, 150);
}
function logoBadge(ctx, cx, cy, h) {   // the logo on an ink tab, top right of the safe area
  ctx.fillStyle = INK; lean(ctx, cx - h * 0.95, cy + h * 0.62, h * 1.7, h * 1.24); ctx.fill();
  logoAt(ctx, cx + h * 0.08, cy, h);
}
function posterTrioFrame(ctx) {
  posterBg(ctx);
  [[PAPA, -1], [LUDA, 0], [IVAN, 1]].forEach(([p, i]) => {
    const cx = W / 2 + i * 470;
    posterHero(ctx, p, cx - 12, 400, 0.72);
    posterName(ctx, p, cx, 760, 'center', 0.78, 520);
  });
}
function posterPhotoFrame(ctx) {
  posterBg(ctx, 1.02);
  const w = 1240, h = 660, x = (W - w) / 2, y = 140;
  // a field of colour behind, offset, then the window cut with one leaning edge on each side
  ctx.fillStyle = C.blue; lean(ctx, x + 40, y + h + 30, w - TAN * h, h); ctx.fill();
  ctx.save(); lean(ctx, x, y + h, w - TAN * h, h); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#DCE3EC'); g.addColorStop(1, '#AEB9C8');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  text(ctx, 'ВИДЕО / ФОТО', W / 2, y + h / 2 + 14, font(36, MONT, 700), 'rgba(20,33,61,0.35)', 'center');
  ctx.restore();
  logoBadge(ctx, x + 190, y + 20, 140);
  text(ctx, 'ТЕХНОЛОГИЯ УСПЕХА', x + w - 120, y + h + 96, font(40, DELA), INK, 'right');
}

// ================================================================ B: Blueprint
const NAVY = '#0B2C63', LINE = 'rgba(255,255,255,0.9)', FAINT = 'rgba(255,255,255,0.35)';
function blueprintBg(ctx) {
  const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, '#12408A'); g.addColorStop(1, '#071E47');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 24) { ctx.strokeStyle = x % 120 ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.11)'; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 24) { ctx.strokeStyle = y % 120 ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.11)'; ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
  // the sheet's frame, inside the safe area, with its corner ticks
  ctx.strokeStyle = FAINT; ctx.lineWidth = 1.5; ctx.strokeRect(260.5, 60.5, W - 520, H - 120);
  ctx.strokeStyle = LINE; ctx.lineWidth = 3;
  for (const [x, y, sx, sy] of [[260, 60, 1, 1], [W - 260, 60, -1, 1], [260, H - 60, 1, -1], [W - 260, H - 60, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * 40); ctx.lineTo(x, y); ctx.lineTo(x + sx * 40, y); ctx.stroke();
  }
}
// the round photo with a measuring ring: degree ticks, a dashed orbit, crosshair through the centre
function gauge(ctx, cx, cy, r, accent, p, sc = 1) {
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  person(ctx, cx - r, cy - r, 2 * r, 2 * r, '#2A64B8', '#123E82', 'rgba(255,255,255,0.4)'); ctx.restore();
  ctx.strokeStyle = LINE; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU - Math.PI / 2, l = i % 10 ? 8 * sc : 18 * sc, r0 = r + 10 * sc;
    ctx.strokeStyle = i % 10 ? FAINT : LINE; ctx.lineWidth = i % 10 ? 1 : 2;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l)); ctx.stroke();
  }
  // the accent arc: this person's share of the ring, in their colour
  ctx.strokeStyle = accent; ctx.lineWidth = 6 * sc; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.arc(cx, cy, r + 42 * sc, -Math.PI / 2, -Math.PI / 2 + TAU * 0.6); ctx.stroke();
  ctx.setLineDash([4, 8]); ctx.strokeStyle = FAINT; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r + 58 * sc, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = FAINT; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - r - 90 * sc, cy); ctx.lineTo(cx - r - 14 * sc, cy); ctx.moveTo(cx + r + 14 * sc, cy); ctx.lineTo(cx + r + 90 * sc, cy); ctx.stroke();
  // the speciality mark in a node on the ring, top right, with a leader line
  const a = -Math.PI / 4, nx = cx + Math.cos(a) * (r + 42 * sc), ny = cy + Math.sin(a) * (r + 42 * sc);
  ctx.fillStyle = NAVY; ctx.strokeStyle = LINE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(nx, ny, 46 * sc, 0, TAU); ctx.fill(); ctx.stroke();
  mark(ctx, p, nx, ny, 50 * sc, accent);
}
// a drawing's title block: labelled cells
function titleBlock(ctx, p, x, y, w, sc = 1, num = '01') {
  const f0 = font(15 * sc, MONT, 700), f1 = font(46 * sc, MONT, 700), f2 = font(30 * sc, MONT, 400), f3 = font(22 * sc, MONT, 400);
  const lines = wrap2(ctx, p.role, f3, w - 48 * sc);
  const h1 = 96 * sc, h2 = (52 + lines.length * 30) * sc;
  ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h1 + h2);
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + h1); ctx.lineTo(x + w, y + h1); ctx.stroke();
  // number cell
  const nw = 84 * sc; ctx.beginPath(); ctx.moveTo(x + w - nw, y); ctx.lineTo(x + w - nw, y + h1); ctx.stroke();
  text(ctx, 'ЛИСТ', x + w - nw / 2, y + 26 * sc, f0, FAINT, 'center', 2);
  text(ctx, num, x + w - nw / 2, y + 74 * sc, font(40 * sc, MONT, 700), p.col, 'center');
  text(ctx, 'ФАМИЛИЯ, ИМЯ', x + 22 * sc, y + 26 * sc, f0, FAINT, 'left', 2);
  let fs = 46 * sc; while (measure(ctx, p.surname.toUpperCase(), font(fs, MONT, 700), 2).w + measure(ctx, ` ${p.name}`, font(fs * 0.62, MONT, 400)).w > w - nw - 40 * sc) fs -= 1;
  text(ctx, p.surname.toUpperCase(), x + 22 * sc, y + 78 * sc, font(fs, MONT, 700), '#FFFFFF', 'left', 2);
  const sw = measure(ctx, p.surname.toUpperCase(), font(fs, MONT, 700), 2).w;
  text(ctx, p.name, x + 22 * sc + sw + 14 * sc, y + 78 * sc, font(fs * 0.62, MONT, 400), 'rgba(255,255,255,0.85)');
  text(ctx, 'СПЕЦИАЛЬНОСТЬ', x + 22 * sc, y + h1 + 28 * sc, f0, FAINT, 'left', 2);
  lines.forEach((s, i) => text(ctx, s, x + 22 * sc, y + h1 + 62 * sc + i * 30 * sc, f3, '#FFFFFF'));
  void f1; void f2;
}
function blueprintHeroFrame(ctx) {
  blueprintBg(ctx);
  gauge(ctx, 720, 540, 210, MAMA.col, MAMA);
  titleBlock(ctx, MAMA, 1040, 430, 600, 1, '01');
  // a dimension line under the gauge: the years, as on a drawing
  dim(ctx, 510, 870, 930, 870, '1965 — 2025');
  logoAt(ctx, 1500, 200, 150);
}
function dim(ctx, x0, y0, x1, y1, label) {
  ctx.strokeStyle = LINE; ctx.fillStyle = LINE; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.moveTo(x0, y0 - 14); ctx.lineTo(x0, y0 + 14); ctx.moveTo(x1, y1 - 14); ctx.lineTo(x1, y1 + 14); ctx.stroke();
  for (const [x, d] of [[x0, 1], [x1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + d * 16, y0 - 6); ctx.lineTo(x + d * 16, y0 + 6); ctx.fill(); }
  const f = font(22, MONT, 700), m = measure(ctx, label, f, 3).w;
  ctx.fillStyle = '#0E3576'; ctx.fillRect((x0 + x1) / 2 - m / 2 - 12, y0 - 16, m + 24, 32);
  text(ctx, label, (x0 + x1) / 2, y0 + 8, f, '#FFFFFF', 'center', 3);
}
function blueprintTrioFrame(ctx) {
  blueprintBg(ctx);
  [[PAPA, -1, '02'], [LUDA, 0, '03'], [IVAN, 1, '04']].forEach(([p, i, n]) => {
    const cx = W / 2 + i * 460;
    gauge(ctx, cx, 360, 130, p.col, p, 0.66);
    titleBlock(ctx, p, cx - 215, 580, 430, 0.8, n);
  });
  dim(ctx, W / 2 - 460, 900, W / 2 + 460, 900, 'ВТТ · 60 ЛЕТ В ДЕЛЕ');
}
function blueprintPhotoFrame(ctx) {
  blueprintBg(ctx);
  const w = 1180, h = 664, x = (W - w) / 2, y = 190;
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#2A64B8'); g.addColorStop(1, '#123E82');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  text(ctx, 'ВИДЕО / ФОТО', W / 2, y + h / 2 + 14, font(36, MONT, 700), 'rgba(255,255,255,0.4)', 'center');
  ctx.strokeStyle = LINE; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, h);
  // rulers along the top and the left, crop marks at the corners
  ctx.lineWidth = 1;
  for (let i = 0; i <= 40; i++) { const xx = x + (w * i) / 40, l = i % 5 ? 8 : 18; ctx.strokeStyle = i % 5 ? FAINT : LINE; ctx.beginPath(); ctx.moveTo(xx, y - 14); ctx.lineTo(xx, y - 14 - l); ctx.stroke(); }
  for (let i = 0; i <= 24; i++) { const yy = y + (h * i) / 24, l = i % 4 ? 8 : 18; ctx.strokeStyle = i % 4 ? FAINT : LINE; ctx.beginPath(); ctx.moveTo(x - 14, yy); ctx.lineTo(x - 14 - l, yy); ctx.stroke(); }
  ctx.fillStyle = C.orange; ctx.fillRect(x, y + h + 18, 220, 6);
  CHORD.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + w - 240 + i * 30, y + h + 18, 30, 6); });
  text(ctx, 'КАДР 01 · ТЕХНОЛОГИЯ УСПЕХА', x, y + h + 62, font(22, MONT, 700), '#FFFFFF', 'left', 3);
  logoAt(ctx, x + w - 90, y - 70, 120);
}

export function styles2Clips() {
  const still = (f) => ({ dur: 1, samples: () => 1, draw(ctx) { f(ctx); } });
  return {
    sa_hero: still(posterHeroFrame), sa_trio: still(posterTrioFrame), sa_photo: still(posterPhotoFrame),
    sb_hero: still(blueprintHeroFrame), sb_trio: still(blueprintTrioFrame), sb_photo: still(blueprintPhotoFrame),
  };
}
void DARK;
