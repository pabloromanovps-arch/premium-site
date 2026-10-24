// styles3.js: style C, a development of the designer's layout (white sheet, Dela names set big,
// round photos with an orange ring, the chord wedge, the row of industry symbols, the
// «Профессионалитет» corner mark). Kept: all of that. Changed: every frame is composed about the
// centre inside 1440 px (the screens crop the sides), the jubilee logo joins VTT's, the photo ring
// carries the chord ticks of the jubilee logo, and each person gets their speciality mark.
import * as M from './lib/motion.js';
import { sampleCover } from './lib/sample.js';
import { C, CHORD, DELA, MONT, font, SLANT, symbol, SYMBOLS, measure } from './lib/brand.js';
import { icon } from './lib/icons.js';
import { drawLogo, P, setLogoScale } from './jubilee.js';

const { W, H, TAU } = M;
const INK = '#161616', X0 = 240, X1 = W - 240;
let VTT = null;

const MAMA = { surname: 'Богатыревич', name: 'Ольга Александровна', role: 'Инженер по транспорту', role2: 'железнодорожного цеха', col: C.red, sym: 'rail' };
const CARDS = [
  { surname: 'Богатыревич', name: 'Ольга Александровна', role: 'Инженер по транспорту', col: C.blue, sym: 'rail' },
  { surname: 'Богатыревич', name: 'Александр Иванович', role: 'Транспортировщик', col: C.red, ic: 'molecule' },
  { surname: 'Хитрецова', name: 'Людмила', role: 'Выпускница ВТТ', col: C.green, ic: 'flask' },
  { surname: 'Тимошкин', name: 'Иван', role: 'Выпускник ВТТ', col: C.orange, ic: 'weld' },
  { surname: 'Иванов', name: 'Алексей Петрович', role: 'Начальник смены', col: C.slate, ic: 'gear' },
  { surname: 'Петрова', name: 'Анна Сергеевна', role: 'Повар-кондитер', col: C.sky, ic: 'chef' },
];

function text(ctx, s, x, y, f, color, align = 'left') {
  ctx.save(); ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y); ctx.restore();
}
function person(ctx, cx, cy, r, c0, c1) {
  return sampleCover(ctx, cx - r, cy - r, 2 * r, 2 * r);   // the real stand-in photo (lib/sample.js)
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.18, r * 0.32, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.78, r * 0.68, r * 0.5, 0, Math.PI, 0); ctx.fill();
}
function mark(ctx, p, x, y, s, c) { if (p.sym) symbol(ctx, p.sym, x, y, s, c); else icon(ctx, p.ic, x, y, s, c); }

// the sheet: white, the corner wordmark, VTT's and the jubilee logos top right, the chord wedge
function sheet(ctx, wedge = 1) {
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  // the chord wedge rising from the bottom right corner, bands leaning at 15 deg
  const n = 8, x0 = W * (1 - 0.62 * wedge), bw = (W - x0) / n;
  CHORD.forEach((c, i) => {
    const xa = x0 + i * bw, xb = xa + bw + 1, ha = (i / n) * 260 * wedge, hb = ((i + 1) / n) * 260 * wedge, sk = Math.tan(SLANT);
    ctx.fillStyle = c; ctx.beginPath();
    ctx.moveTo(xa, H); ctx.lineTo(xb, H); ctx.lineTo(xb + sk * hb, H - hb); ctx.lineTo(xa + sk * ha, H - ha); ctx.closePath(); ctx.fill();
  });
  // corner wordmark, inside the safe area
  ctx.save(); ctx.translate(X0 + 20, 60 + measure(ctx, 'ПРОФЕССИОНАЛИТЕТ', font(15, DELA)).w); ctx.rotate(-Math.PI / 2);
  text(ctx, 'ПРОФЕССИОНАЛИТЕТ', 0, 0, font(15, DELA), INK); ctx.restore();
  text(ctx, 'ПРОФЕССИОНАЛИТЕТ', X0 + 34, 76, font(15, DELA), INK);
  // logos: VTT and the jubilee one, side by side
  if (VTT) ctx.drawImage(VTT, X1 - 120, 34, 120, 114);
  logoAt(ctx, X1 - 250, 92, 110);
}
function logoAt(ctx, cx, cy, h) {
  const s = h / (H * 0.53);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
  setLogoScale(0.53); drawLogo(ctx, 5, P.light, { loop: 10, glints: false }); ctx.restore();
}
function symbolRow(ctx, x, y, gap, size) { SYMBOLS.forEach((n, i) => symbol(ctx, n, x + i * gap, y, size)); }

// the photo: an orange ring, and outside it the jubilee chord ticks; the speciality mark in a badge
function portrait(ctx, p, cx, cy, r, ring = C.orange) {
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); person(ctx, cx, cy, r, '#5D86B5', '#2F5585'); ctx.restore();
  ctx.lineWidth = r * 0.05; ctx.strokeStyle = ring; ctx.beginPath(); ctx.arc(cx, cy, r + r * 0.07, 0, TAU); ctx.stroke();
  const n = 64, r0 = r * 1.16, r1 = r * 1.24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2; ctx.save(); ctx.translate(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.rotate(a);
    ctx.fillStyle = CHORD[i % 8]; ctx.fillRect(0, -r * 0.012, r1 - r0, r * 0.024); ctx.restore();
  }
  const a = Math.PI * 0.25, bx = cx + Math.cos(a) * r * 1.02, by = cy + Math.sin(a) * r * 1.02, br = r * 0.2;
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
  ctx.lineWidth = r * 0.025; ctx.strokeStyle = p.col; ctx.stroke();
  mark(ctx, p, bx, by, br * 1.15, p.col);
}

function heroFrame(ctx) {
  sheet(ctx);
  portrait(ctx, MAMA, 690, 520, 255);
  const x = 1050; let y = 400;
  let fs = 96; while (measure(ctx, MAMA.surname, font(fs, DELA)).w > 620) fs -= 2;
  text(ctx, MAMA.surname, x, y, font(fs, DELA), INK); y += fs * 0.98;
  const [n1, n2] = MAMA.name.split(' ');
  text(ctx, n1, x, y, font(64, DELA), INK); y += 72;
  text(ctx, n2, x, y, font(64, DELA), INK); y += 30;
  ctx.fillStyle = MAMA.col; ctx.fillRect(x, y, 120, 8); y += 58;
  text(ctx, MAMA.role, x, y, font(34, MONT, 400), INK); y += 44;
  text(ctx, MAMA.role2, x, y, font(34, MONT, 400), INK);
  symbolRow(ctx, x + 22, 880, 70, 40);
}

function card(ctx, p, x, y, w, h) {
  ctx.fillStyle = p.col; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
  // chord strip at the foot
  CHORD.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + 14 + (i * (w - 28)) / 8, y + h - 10, (w - 28) / 8 + 0.5, 5); });
  const r = w * 0.36, cx = x + w / 2, cy = y + r + 26;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); person(ctx, cx, cy, r, '#E6ECF3', '#B7C3D2'); ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, TAU); ctx.stroke();
  const bx = cx + r * 0.78, by = cy + r * 0.72, br = r * 0.24;
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); mark(ctx, p, bx, by, br * 1.2, p.col);
  const fit = (str, f0, mk) => { let f = f0; while (measure(ctx, str, mk(f)).w > w - 36) f -= 1; return mk(f); };
  text(ctx, p.surname, x + 18, cy + r + 52, fit(p.surname, 26, (f) => font(f, DELA)), '#FFFFFF');
  text(ctx, p.name, x + 18, cy + r + 84, fit(p.name, 20, (f) => font(f, MONT, 700)), '#FFFFFF');
  text(ctx, p.role, x + 18, cy + r + 112, fit(p.role, 18, (f) => font(f, MONT, 400)), 'rgba(255,255,255,0.9)');
}
function gridFrame(ctx) {
  sheet(ctx, 0.8);
  const w = 236, h = 330, g = 22, x = 300, y = 190;
  CARDS.forEach((p, i) => card(ctx, p, x + (i % 3) * (w + g), y + Math.floor(i / 3) * (h + g), w, h));
  const tx = 1110; let ty = 400;
  ['ТЕХНОЛОГИЯ', 'УСПЕХА:', '60 ЛЕТ В ДЕЛЕ'].forEach((s, i) => { text(ctx, s, tx, ty, font(i === 2 ? 50 : 62, DELA), i === 2 ? C.blue : INK); ty += 72; });
  text(ctx, 'Выпускники и мастера ВТТ', tx, ty + 10, font(32, MONT, 400), INK);
  symbolRow(ctx, tx + 22, ty + 110, 64, 36);
}
function logoFrame(ctx) {
  sheet(ctx);
  const x = 330; let y = 420;
  ['Технология', 'успеха'].forEach((s) => { text(ctx, s, x, y, font(92, DELA), INK); y += 104; });
  text(ctx, '60 лет в деле', x, y + 10, font(48, MONT, 700), C.blue);
  text(ctx, 'Верхнеднепровский технологический техникум', x, y + 70, font(30, MONT, 400), INK);
  symbolRow(ctx, x + 22, y + 170, 70, 40);
  // the jubilee logo on a navy disc with the orange ring, as the designer's placeholder asked
  const cx = 1420, cy = 520, r = 220;
  ctx.fillStyle = '#43688F'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 12; ctx.strokeStyle = C.orange; ctx.beginPath(); ctx.arc(cx, cy, r + 16, 0, TAU); ctx.stroke();
  const s = (r * 1.45) / (H * 0.53);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
  setLogoScale(0.53); drawLogo(ctx, 5, P.prof, { loop: 10, glints: false }); ctx.restore();
}

export function styles3Clips() {
  const init = async () => { if (!VTT) { VTT = new Image(); VTT.src = 'assets/logo_vtt.png'; await VTT.decode(); } };
  const still = (f) => ({ dur: 1, samples: () => 1, init, draw(ctx) { f(ctx); } });
  return { sc_hero: still(heroFrame), sc_grid: still(gridFrame), sc_logo: still(logoFrame) };
}
