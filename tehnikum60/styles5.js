// styles5.js: two richer art directions for the VTT 60 plates, style frames only.
//   G "3-D collage": a light studio set. A huge extruded 60 behind the person, the colour chord as
//     a thick ribbon with its own shadow, the photo as a floating card, the speciality as a true
//     3-D model beside it, editorial detail (index, years, hairlines).
//   H "Cinematic": the deep blue 3-D world of the master title (no glass), beams of light, a
//     metallic ring round the photo with the jubilee chord ticks, the speciality model in 3-D.
// Everything is centred in the middle 1440 px.
import * as M from './lib/motion.js';
import { C, CHORD, DARK, DELA, MONT, font, SLANT, measure } from './lib/brand.js';
import { drawLogo, P, setLogoScale } from './jubilee.js';

const { W, H, TAU, hash01 } = M;
const INK = '#141A26';
let G = null;
const SPR = {};
// the track is already laid at an angle inside its model, so it is turned less than the others
const model = (name, rx, ry) => { if (name === 'rail3d') { rx = 0.05; ry = -0.15; } return (SPR[`${name}${rx}${ry}`] ||= G.renderPiece(name, rx, ry)); };

const MAMA = { surname: 'Богатыревич', name: 'Ольга Александровна', role: 'инженер по транспорту железнодорожного цеха', col: C.red, piece: 'rail3d', n: '01' };
const TRIO = [
  { surname: 'Богатыревич', name: 'Александр Иванович', role: 'транспортировщик в цехе полимерной продукции', col: C.green, piece: 'molecule3d', n: '02' },
  { surname: 'Хитрецова', name: 'Людмила', role: 'выпускница ВТТ', col: C.cyan, piece: 'flask3d', n: '03' },
  { surname: 'Тимошкин', name: 'Иван', role: 'выпускник ВТТ', col: C.orange, piece: 'weld3d', n: '04' },
];

function text(ctx, s, x, y, f, color, align = 'left', track = 0) {
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
  ctx.beginPath(); ctx.arc(cx, y + h * 0.42, s * 0.19, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, y + h * 1.0, s * 0.42, s * 0.36, 0, Math.PI, 0); ctx.fill();
}
function shadow(ctx, blur, oy, a = 0.28) { ctx.shadowColor = `rgba(20,30,60,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; }
function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function logoAt(ctx, cx, cy, h, pal) {
  const s = h / (H * 0.53);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
  setLogoScale(0.53); drawLogo(ctx, 5, pal, { loop: 10, glints: false }); ctx.restore();
}
function grain(ctx, a = 0.035) {
  for (let i = 0; i < 9000; i++) {
    const x = hash01(i, 71) * W, y = hash01(i, 72) * H;
    ctx.fillStyle = hash01(i, 73) > 0.5 ? `rgba(255,255,255,${a * 2})` : `rgba(0,0,30,${a})`; ctx.fillRect(x, y, 1.5, 1.5);
  }
}

// ================================================================ G: 3-D collage
function studio(ctx) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.35, 80, W * 0.5, H * 0.5, W * 0.75);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.6, '#EEF1F6'); g.addColorStop(1, '#D9DFE8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  grain(ctx);
}
// a big number set in Dela and extruded down-right: dark sides stepped back, a pale front face
function extruded(ctx, str, x, y, size, depth = 34) {
  ctx.save(); ctx.font = font(size, DELA); ctx.textAlign = 'center';
  shadow(ctx, 60, 40, 0.22); ctx.fillStyle = '#C9D1DC'; ctx.fillText(str, x + depth, y + depth); noShadow(ctx);
  for (let i = depth; i > 0; i--) { const k = i / depth; ctx.fillStyle = `rgb(${Math.round(176 + 40 * (1 - k))},${Math.round(186 + 38 * (1 - k))},${Math.round(201 + 34 * (1 - k))})`; ctx.fillText(str, x + i, y + i); }
  const fg = ctx.createLinearGradient(0, y - size * 0.8, 0, y); fg.addColorStop(0, '#FFFFFF'); fg.addColorStop(1, '#EDF1F6');
  ctx.fillStyle = fg; ctx.fillText(str, x, y);
  ctx.restore();
}
// the colour chord as a thick ribbon: each band has a top face and a darker front edge
function thickRibbon(ctx, x0, y0, len, thick, ang, depth = 22) {
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(ang);
  const bw = len / 8;
  shadow(ctx, 40, 26, 0.25); ctx.fillStyle = '#000'; ctx.fillRect(0, -thick / 2, len, thick + depth); noShadow(ctx);
  CHORD.forEach((c, i) => {
    const x = i * bw, sk = Math.tan(SLANT) * thick;
    ctx.fillStyle = DARK[c] || c; ctx.beginPath(); ctx.moveTo(x, thick / 2); ctx.lineTo(x + bw + 1, thick / 2); ctx.lineTo(x + bw + 1, thick / 2 + depth); ctx.lineTo(x, thick / 2 + depth); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, thick / 2); ctx.lineTo(x + bw + 1, thick / 2); ctx.lineTo(x + bw + 1 + sk, -thick / 2); ctx.lineTo(x + sk, -thick / 2); ctx.fill();
    const hl = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2); hl.addColorStop(0, 'rgba(255,255,255,0.25)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fill();
  });
  ctx.restore();
}
function card(ctx, p, x, y, w, h, sc = 1) {
  ctx.save(); shadow(ctx, 70 * sc, 36 * sc, 0.32);
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(x - 12 * sc, y - 12 * sc, w + 24 * sc, h + 24 * sc, 22 * sc); ctx.fill(); noShadow(ctx);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 14 * sc); ctx.clip();
  person(ctx, x, y, w, h, '#8EA9CC', '#3D5F8E', 'rgba(255,255,255,0.6)');
  const sh = ctx.createLinearGradient(x, y, x + w, y + h); sh.addColorStop(0, 'rgba(255,255,255,0.25)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(x, y, w, h);
  ctx.restore();
  // the person's colour as a tab on the card's top edge, with the index
  ctx.fillStyle = p.col; ctx.beginPath(); ctx.roundRect(x + 22 * sc, y - 30 * sc, 96 * sc, 40 * sc, 8 * sc); ctx.fill();
  text(ctx, `№ ${p.n}`, x + 70 * sc, y - 2 * sc, font(22 * sc, MONT, 700), '#FFFFFF', 'center', 2 * sc);
}
// a white paper panel with a soft shadow: the name sits on it, clear of the big 60 behind
function panel(ctx, x, y, w, h, r = 22) {
  ctx.save(); shadow(ctx, 60, 30, 0.22); ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.restore();
}
function gHero(ctx) {
  studio(ctx);
  // the 60 stands centre right; its top half shows above the name panel
  extruded(ctx, '60', 1150, 780, 780, 40);
  thickRibbon(ctx, -100, 960, W + 400, 70, -0.12);
  card(ctx, MAMA, 390, 200, 420, 560);
  ctx.save(); ctx.fillStyle = 'rgba(20,30,60,0.18)'; ctx.filter = 'blur(18px)'; ctx.beginPath(); ctx.ellipse(805, 850, 110, 20, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.drawImage(model(MAMA.piece, 0.45, -0.6), 600, 520, 420, 420);
  const px = 930, py = 560, pw = 700, ph = 330;
  panel(ctx, px, py, pw, ph);
  const x = px + 44; let y = py + 54;
  text(ctx, 'ВТТ · 1965 — 2025', x, y, font(18, MONT, 700), '#6B778C', 'left', 6); y += 18;
  ctx.fillStyle = INK; ctx.fillRect(x, y, pw - 88, 2); y += 84;
  text(ctx, MAMA.surname.toUpperCase(), x, y, fit(ctx, MAMA.surname.toUpperCase(), 80, pw - 88, (f) => font(f, DELA)), INK); y += 54;
  text(ctx, MAMA.name, x, y, font(40, MONT, 700), INK); y += 30;
  CHORD.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + i * 22, y, 22, 7); }); y += 50;
  text(ctx, MAMA.role, x, y, fit(ctx, MAMA.role, 30, pw - 88, (f) => font(f, MONT, 400)), '#3A4458');
  logoAt(ctx, 1560, 130, 130, P.light);
}
function gTrio(ctx) {
  studio(ctx);
  extruded(ctx, '60', W / 2, 760, 820);
  thickRibbon(ctx, -100, 990, W + 400, 56, -0.08);
  TRIO.forEach((p, i) => {
    const cx = W / 2 + (i - 1) * 470, w = 290, h = 360, x = cx - w / 2, y = 150;
    card(ctx, p, x, y, w, h, 0.75);
    ctx.drawImage(model(p.piece, 0.45, -0.6), x + w - 170, y + h - 250, 320, 320);
    panel(ctx, cx - 215, y + h + 40, 430, 230, 18);
    let ty = y + h + 110;
    text(ctx, p.surname.toUpperCase(), cx, ty, fit(ctx, p.surname.toUpperCase(), 54, 400, (f) => font(f, DELA)), INK, 'center'); ty += 44;
    text(ctx, p.name, cx, ty, font(30, MONT, 700), INK, 'center'); ty += 26;
    CHORD.forEach((c, j) => { ctx.fillStyle = c; ctx.fillRect(cx - 64 + j * 16, ty, 16, 6); }); ty += 42;
    wrap2(ctx, p.role, font(24, MONT, 400), 400).forEach((s, j) => text(ctx, s, cx, ty + j * 30, font(24, MONT, 400), '#3A4458', 'center'));
  });
}

// ================================================================ H: Cinematic
function stage(ctx) {
  G.drawGlassMaster(ctx, 3.2, { pane: false });
  // beams of light from top left, at the house angle, and a vignette
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [x, w, a] of [[520, 160, 0.10], [760, 90, 0.07], [1180, 220, 0.06]]) {
    ctx.save(); ctx.translate(x, -60); ctx.rotate(-SLANT);
    const g = ctx.createLinearGradient(-w, 0, w, 0); g.addColorStop(0, 'rgba(120,190,255,0)'); g.addColorStop(0.5, `rgba(150,210,255,${a})`); g.addColorStop(1, 'rgba(120,190,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-w, 0, 2 * w, H * 1.4); ctx.restore();
  }
  ctx.restore();
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,6,20,0.65)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
function metalRing(ctx, p, cx, cy, r, sc = 1) {
  // glow of the person's colour behind
  const gl = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.8); gl.addColorStop(0, `${p.col}AA`); gl.addColorStop(1, `${p.col}00`);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gl; ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); person(ctx, cx - r, cy - r, 2 * r, 2 * r, '#3B6BB0', '#0E2D63', 'rgba(255,255,255,0.4)'); ctx.restore();
  // the metal: a conic sweep of light round a thick ring
  const w = r * 0.12, cg = ctx.createConicGradient(-0.6, cx, cy);
  [['#5A6A80', 0], ['#F4F8FF', 0.12], ['#8C9AB0', 0.3], ['#E6EDF7', 0.55], ['#56657A', 0.75], ['#F4F8FF', 0.9], ['#5A6A80', 1]].forEach(([c, s]) => cg.addColorStop(s, c));
  ctx.lineWidth = w; ctx.strokeStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, r + w / 2, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, r + w, 0, TAU); ctx.stroke();
  // the jubilee chord ticks outside, the arc of the person's colour
  const n = 72, r0 = r + w + r * 0.08, r1 = r0 + r * 0.1;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; ctx.save(); ctx.translate(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.rotate(a); ctx.fillStyle = CHORD[i % 8]; ctx.fillRect(0, -r * 0.012, r1 - r0, r * 0.024); ctx.restore(); }
  ctx.save(); ctx.shadowColor = p.col; ctx.shadowBlur = 24; ctx.lineWidth = 5 * sc; ctx.strokeStyle = p.col; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, r1 + 16 * sc, -Math.PI * 0.85, -Math.PI * 0.35); ctx.stroke(); ctx.restore();
}
function hName(ctx, p, cx, y, sc = 1, maxW = 760) {
  const f1 = fit(ctx, p.surname.toUpperCase(), 76 * sc, maxW * sc, (f) => font(f, DELA));
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
  ctx.font = f1; ctx.textAlign = 'center';
  const tg = ctx.createLinearGradient(0, y - 70 * sc, 0, y); tg.addColorStop(0, '#FFFFFF'); tg.addColorStop(1, '#BFD6F2');
  ctx.fillStyle = tg; ctx.fillText(p.surname.toUpperCase(), cx, y); ctx.restore();
  text(ctx, p.name, cx, y + 54 * sc, font(38 * sc, MONT, 400), 'rgba(255,255,255,0.9)', 'center', 1);
  ctx.save(); ctx.shadowColor = p.col; ctx.shadowBlur = 16; ctx.fillStyle = p.col; ctx.fillRect(cx - 60 * sc, y + 80 * sc, 120 * sc, 5 * sc); ctx.restore();
  wrap2(ctx, p.role.toUpperCase(), font(22 * sc, MONT, 700), maxW * sc).forEach((s, i) =>
    text(ctx, s, cx, y + 128 * sc + i * 32 * sc, font(22 * sc, MONT, 700), 'rgba(220,235,255,0.75)', 'center', 4 * sc));
}
function hHero(ctx) {
  stage(ctx);
  metalRing(ctx, MAMA, W / 2, 380, 205);
  ctx.drawImage(model(MAMA.piece, 0.45, -0.6), W / 2 + 90, 360, 370, 370);
  hName(ctx, MAMA, W / 2, 790);
  logoAt(ctx, W / 2 + 600, 120, 120, P.prof);
}
function hTrio(ctx) {
  stage(ctx);
  TRIO.forEach((p, i) => {
    const cx = W / 2 + (i - 1) * 470;
    metalRing(ctx, p, cx, 380, 130, 0.7);
    ctx.drawImage(model(p.piece, 0.45, -0.6), cx + 20, 370, 250, 250);
    hName(ctx, p, cx, 680, 0.68, 600);
  });
}

export function styles5Clips() {
  const init = async () => { if (!G) { G = await import('./jubilee3d.js'); await G.initGlass(10); } };
  const still = (f) => ({ dur: 1, samples: () => 1, init, draw(ctx) { f(ctx); } });
  return { sg_hero: still(gHero), sg_trio: still(gTrio), sh_hero: still(hHero), sh_trio: still(hTrio) };
}
