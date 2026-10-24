// plates.js: VTT 60 hero plates, after the client's reference layout (round portrait + name block,
// logo medallion, photo frame) but in the master title's language: glass, the colour chord, and
// VTT's specialities as 3-D pieces. Everything sits in the centre 1440 px (4:3 safe): the screens
// at the venue crop the sides. Plates are on alpha; the photo window is left transparent.
import * as M from './lib/motion.js';
import { CHORD, MONT, font } from './lib/brand.js';
import { drawLogo, P, setLogoScale } from './jubilee.js';

const { W, H, TAU, clamp, lerp, E } = M;
const SAFE = { x0: (W - 1440) / 2, x1: (W + 1440) / 2 };
let G = null;   // jubilee3d.js
const SPR = {};
const sprite = (name, rx, ry) => (SPR[`${name}${rx}${ry}`] ||= G.renderPiece(name, rx, ry));

// a stand-in for the photo, so stills read; the delivered plates leave this window empty
function placeholder(ctx, cx, cy, r) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#6FA8EC'); g.addColorStop(1, '#11559B');
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.18, r * 0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.72, r * 0.62, r * 0.48, 0, Math.PI, 0); ctx.fill();
}

// the round lens: photo inside, a thick glass ring with a lit rim and a specular arc, a ring of
// chord-coloured teeth outside (the jubilee logo's own device), turning slowly
function lens(ctx, cx, cy, r, t, k, { photo = true, spin = 0 } = {}) {
  if (k <= 0) return;
  const w = r * 0.13;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(lerp(0.7, 1, E.outBack(k)), lerp(0.7, 1, E.outBack(k))); ctx.translate(-cx, -cy);
  ctx.globalAlpha = clamp(k * 3);
  // photo
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  if (photo) placeholder(ctx, cx, cy, r);
  // fluted reflections across the photo, at the house angle
  ctx.translate(cx, cy); ctx.rotate(15 * Math.PI / 180);
  for (let x = -r * 1.4; x < r * 1.4; x += 34) {
    const g = ctx.createLinearGradient(x, 0, x + 34, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.25, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,10,40,0.08)');
    ctx.fillStyle = g; ctx.fillRect(x, -r * 1.5, 34, r * 3);
  }
  ctx.restore();
  // glass ring
  const rg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rg.addColorStop(0, 'rgba(255,255,255,0.55)'); rg.addColorStop(0.5, 'rgba(200,230,255,0.18)'); rg.addColorStop(1, 'rgba(255,255,255,0.35)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, r + w, 0, TAU); ctx.arc(cx, cy, r, 0, TAU, true); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, r + w, 0, TAU); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,25,70,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, TAU); ctx.stroke();
  ctx.lineCap = 'round'; ctx.lineWidth = w * 0.32; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(cx, cy, r + w * 0.5, Math.PI * 1.08, Math.PI * 1.32); ctx.stroke();
  ctx.lineWidth = w * 0.2; ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(cx, cy, r + w * 0.5, Math.PI * 0.1, Math.PI * 0.2); ctx.stroke();
  // chord teeth
  const n = 56, r0 = r + w + r * 0.07, r1 = r0 + r * 0.11, on = clamp((k - 0.3) / 0.7);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + spin + t * 0.15, kk = clamp(on * 1.6 - (i / n) * 0.6);
    if (kk <= 0) continue;
    ctx.save(); ctx.translate(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.rotate(a);
    ctx.fillStyle = CHORD[i % 8]; ctx.fillRect(0, -r * 0.022, (r1 - r0) * E.outCubic(kk), r * 0.044);
    ctx.restore();
  }
  ctx.restore();
}

// a frosted glass panel with the fluted texture, holding the name block
function panel(ctx, x, y, w, h, k) {
  if (k <= 0) return;
  const ww = w * E.outCubic(k), xx = x + (w - ww) / 2, r = 26;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(xx, y, ww, h, r); ctx.clip();
  ctx.fillStyle = 'rgba(190,220,255,0.16)'; ctx.fillRect(xx, y, ww, h);
  ctx.translate(xx + ww / 2, y + h / 2); ctx.rotate(15 * Math.PI / 180);
  for (let i = -30; i < 30; i++) {
    const x0 = i * 30, g = ctx.createLinearGradient(x0, 0, x0 + 30, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.09)'); g.addColorStop(0.3, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,10,40,0.07)');
    ctx.fillStyle = g; ctx.fillRect(x0, -h * 2, 30, h * 4);
  }
  ctx.restore();
  ctx.save();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.roundRect(xx, y, ww, h, r); ctx.stroke();
  const hl = ctx.createLinearGradient(xx, 0, xx + ww, 0);
  hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.3, 'rgba(255,255,255,0.9)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = hl; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(xx + r, y + 1); ctx.lineTo(xx + ww - r, y + 1); ctx.stroke();
  ctx.restore();
}

// text rising out of the panel, line by line
function line(ctx, str, x, y, f, color, k, track = 0) {
  if (k <= 0) return;
  ctx.save(); ctx.font = f; ctx.letterSpacing = `${track}px`; ctx.fillStyle = color; ctx.textAlign = 'center';
  ctx.globalAlpha = clamp(k * 1.5); ctx.fillText(str, x, y + (1 - E.outCubic(k)) * 24);
  ctx.restore();
}
// one line if it fits, else two lines of about equal width (no orphan word on the second)
function wrap(ctx, str, f, maxW) {
  ctx.font = f; if (ctx.measureText(str).width <= maxW) return [str];
  const words = str.split(' '); let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (!best || m < best[0]) best = [m, [a, b]];
  }
  return best[1];
}

function hero(ctx, t, { cx, cy, r, surname, name, role, piece, scale = 1, delay = 0 }) {
  const tt = t - delay;
  lens(ctx, cx, cy, r, t, clamp(tt / 0.9));
  // the speciality piece flies in from behind and settles on the ring, top right
  const kp = E.outCubic(clamp((tt - 0.35) / 1.0));
  if (kp > 0) {
    const s = sprite(piece, 0.25, -0.5), d = r * 0.95 * lerp(0.4, 1, kp);
    const a = -Math.PI / 4, px = cx + Math.cos(a) * r * 1.08, py = cy + Math.sin(a) * r * 1.08;
    ctx.save(); ctx.globalAlpha = clamp(kp * 2);
    ctx.translate(px, py + 6 * Math.sin(TAU * t / 4)); ctx.rotate(0.08 * Math.sin(TAU * t / 5));
    ctx.drawImage(s, -d / 2, -d / 2, d, d); ctx.restore();
  }
  const fs = scale, top = cy + r + r * 0.32 + 26;
  const sur = font(58 * fs, MONT, 700), nm = font(38 * fs, MONT, 400), rl = font(24 * fs, MONT, 400);
  const roleLines = wrap(ctx, role, rl, 560 * fs);
  const ph = (58 + 46 + 24 + roleLines.length * 32) * fs + 40, pw = 640 * fs;
  panel(ctx, cx - pw / 2, top, pw, ph, clamp((tt - 0.5) / 0.7));
  let y = top + 24 + 52 * fs;
  line(ctx, surname.toUpperCase(), cx, y, sur, '#FFFFFF', clamp((tt - 0.8) / 0.6), 2 * fs); y += 46 * fs;
  line(ctx, name, cx, y, nm, 'rgba(255,255,255,0.92)', clamp((tt - 0.95) / 0.6)); y += 22 * fs;
  // a short chord bar between name and role
  const kb = clamp((tt - 1.1) / 0.6);
  if (kb > 0) { const bw = 160 * fs * E.outCubic(kb); CHORD.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(cx - bw / 2 + (i * bw) / 8, y, bw / 8 + 0.5, 4 * fs); }); }
  y += 40 * fs;
  roleLines.forEach((s, i) => line(ctx, s, cx, y + i * 32 * fs, rl, 'rgba(255,255,255,0.85)', clamp((tt - 1.2 - i * 0.08) / 0.6)));
}

const MAMA = { surname: 'Богатыревич', name: 'Ольга Александровна', role: 'инженер по транспорту железнодорожного цеха', piece: 'rail3d' };
const PAPA = { surname: 'Богатыревич', name: 'Александр Иванович', role: 'транспортировщик в цехе полимерной продукции', piece: 'molecule3d' };
const LUDA = { surname: 'Хитрецова', name: 'Людмила', role: 'выпускница ВТТ', piece: 'flask3d' };
const IVAN = { surname: 'Тимошкин', name: 'Иван', role: 'выпускник ВТТ', piece: 'weld3d' };

// the photo / video frame: a rounded glass bevel round an empty window, the logo medallion on its corner
let LOGO = null;
function photoFrame(ctx, t, k) {
  const w = 1280, h = 720, x = (W - w) / 2, y = (H - h) / 2 + 10, r = 44, b = 22;
  const kk = E.outCubic(k);
  ctx.save(); ctx.globalAlpha = clamp(k * 2);
  ctx.translate(W / 2, H / 2); ctx.scale(lerp(0.92, 1, kk), lerp(0.92, 1, kk)); ctx.translate(-W / 2, -H / 2);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#2A7DE1'); g.addColorStop(1, '#0B3A7E');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = font(34, MONT, 700); ctx.textAlign = 'center'; ctx.fillText('ВИДЕО / ФОТО', W / 2, y + h / 2 + 12);
  ctx.restore();
  const bg = ctx.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, 'rgba(255,255,255,0.55)'); bg.addColorStop(0.5, 'rgba(200,230,255,0.16)'); bg.addColorStop(1, 'rgba(255,255,255,0.35)');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - b, y - b, w + 2 * b, h + 2 * b, r + b); ctx.roundRect(x, y, w, h, r); ctx.fill('evenodd');
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.roundRect(x - b, y - b, w + 2 * b, h + 2 * b, r + b); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,25,70,0.35)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
  // a light running round the bevel
  const p = (t / 6) % 1, sx = x - b + (w + 2 * b) * p;
  const sg = ctx.createRadialGradient(sx, y - b / 2, 0, sx, y - b / 2, 160);
  sg.addColorStop(0, 'rgba(255,255,255,0.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save(); ctx.beginPath(); ctx.roundRect(x - b, y - b, w + 2 * b, h + 2 * b, r + b); ctx.roundRect(x, y, w, h, r); ctx.clip('evenodd');
  ctx.fillStyle = sg; ctx.fillRect(sx - 160, y - b - 20, 320, b + 40); ctx.restore();
  ctx.restore();
  // logo medallion, top-left corner, inside a small lens
  const km = clamp((k - 0.4) / 0.6);
  if (km > 0) {
    const mx = x + 40, my = y + 30, mr = 92;
    ctx.save(); ctx.fillStyle = 'rgba(8,47,110,0.85)'; ctx.beginPath(); ctx.arc(mx, my, mr * E.outBack(km), 0, TAU); ctx.fill(); ctx.restore();
    lens(ctx, mx, my, mr, t, km, { photo: false });
    if (!LOGO) LOGO = document.createElement('canvas');
    const SS = ctx.getTransform().a; if (LOGO.width !== W * SS) { LOGO.width = W * SS; LOGO.height = H * SS; }
    const lc = LOGO.getContext('2d'); lc.setTransform(SS, 0, 0, SS, 0, 0); lc.clearRect(0, 0, W, H);
    setLogoScale(0.53); drawLogo(lc, 0, P.prof, { loop: 10 });
    const s = (mr * 1.18) / (H * 0.53) * E.outBack(km);
    ctx.save(); ctx.globalAlpha = km; ctx.translate(mx, my); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); ctx.drawImage(LOGO, 0, 0, W, H); ctx.restore();
  }
}

export function platesClips() {
  const init = async () => { if (!G) { G = await import('./jubilee3d.js'); await G.initGlass(10); } };
  return {
    jp_hero: { dur: 6, samples: () => 2, init, draw(ctx, t) { hero(ctx, t, { cx: W / 2, cy: 330, r: 200, ...MAMA }); } },
    jp_trio: { dur: 6, samples: () => 2, init, draw(ctx, t) {
      [[PAPA, -1], [LUDA, 0], [IVAN, 1]].forEach(([p, i]) =>
        hero(ctx, t, { cx: W / 2 + i * 470, cy: 360, r: 150, scale: 0.68, delay: (i + 1) * 0.18, ...p }));
    } },
    jp_photo: { dur: 6, samples: () => 2, init, draw(ctx, t) { photoFrame(ctx, t, clamp(t / 1.2)); } },
  };
}
export { SAFE };
