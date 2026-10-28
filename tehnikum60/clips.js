// clips.js: every graphic of the VTT 60 film (docs/plan.md), each a pure function of t (seconds).
// A clip is { dur, draw(ctx, t, IMG), samples(t) }. All copy comes from the client's scenario.
import * as M from './lib/motion.js';
import * as B from './lib/brand.js';
import { icon } from './lib/icons.js';
import { jubileeClips, drawLogo, P as JP, setLogoScale } from './jubilee.js';
import { platesClips } from './plates.js';
import { styles2Clips } from './styles2.js';
import { styles3Clips } from './styles3.js';
import { styles4Clips } from './styles4.js';
import { styles5Clips, cardsClips } from './styles5.js';
import { styles6Clips } from './styles6.js';
import { styles7Clips } from './styles7.js';
import { styles8Clips } from './styles8.js';
import { styles9Clips } from './styles9.js';
import { iconExportClips } from './icons_export.js';
import { intro10Clips } from './intro10.js';

const { C, CHORD, DARK, LIGHT, DELA, MONT, font, pop, ease, lerp, clamp } = B;
const { E, spring, W, H } = M;

// ---------------------------------------------------------------- shared pieces
// the brand block around the logo: eight industry symbols on a ring, with ticks between them
function symbolRing(ctx, cx, cy, r, t, t0, size = 58) {
  B.SYMBOLS.forEach((name, i) => {
    const a = -Math.PI / 2 + (i + 0.5) * (Math.PI / 4) + 0.03 * Math.sin(t * 0.6);
    const s = pop(t, t0 + i * 0.06, { stiffness: 300, damping: 14 });
    B.symbol(ctx, name, cx + Math.cos(a) * r, cy + Math.sin(a) * r, size, null, s, (1 - Math.min(s, 1)) * -0.8);
    // tick on the segment boundary
    const b = -Math.PI / 2 + i * (Math.PI / 4) + 0.03 * Math.sin(t * 0.6);
    const k = ease(t, t0 + 0.25 + i * 0.05, t0 + 0.6 + i * 0.05);
    if (k > 0) {
      ctx.strokeStyle = C.grey; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(b) * (r - 34), cy + Math.sin(b) * (r - 34));
      ctx.lineTo(cx + Math.cos(b) * (r - 34 + 68 * k), cy + Math.sin(b) * (r - 34 + 68 * k));
      ctx.stroke();
    }
  });
}
// the logo on a white disc (the logo is navy/red on white: it needs its own ground over footage)
function logoDisc(ctx, IMG, cx, cy, R, t, t0) {
  const s = pop(t, t0, { stiffness: 170, damping: 14 });
  if (s <= 0) return;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = C.white;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, M.TAU); ctx.fill();
  // the jubilee logo (client's edit: it replaces the VTT emblem), drawn in vector, teal on white
  const ls = pop(t, t0 + 0.12, { stiffness: 140, damping: 13 }), k = ((R * 1.45) / (H * 0.53)) * ls;
  if (ls <= 0.002) { ctx.restore(); return; }   // nothing to draw yet (a zero scale breaks the logo's layer)
  ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  setLogoScale(0.53); drawLogo(ctx, 5, JP.light, { loop: 10, glints: false });
  ctx.restore();
}
const LOGO_GREEN = '#078C95';   // the jubilee logo's teal
// big digits in one solid colour, revealed left to right as the chord digits are
function solidText(ctx, str, x, y, size, p, color) {
  const f = font(size), m = B.measure(ctx, str, f), k = clamp(p);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 40, y - m.asc - 40, (m.w + 80) * E.outCubic(k), m.asc + m.desc + 80); ctx.clip();
  ctx.font = f; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(str, x, y);
  ctx.restore();
  return m;
}
// big digits filled with the colour chord
function chordText(ctx, str, x, y, size, p, { align = 'left' } = {}) {
  const f = font(size), m = B.measure(ctx, str, f);
  const x0 = align === 'left' ? x : x - m.w;
  ctx.save();
  ctx.font = f; ctx.textAlign = 'left';
  // mask: the glyphs; fill: the chord sliding in under them
  ctx.beginPath(); ctx.rect(x0 - 40, y - m.asc - 40, m.w + 80, m.asc + m.desc + 80); ctx.clip();
  const tmp = chordText.cv || (chordText.cv = document.createElement('canvas'));
  tmp.width = W * B.SS; tmp.height = H * B.SS;
  const c = tmp.getContext('2d');
  c.setTransform(B.SS, 0, 0, B.SS, 0, 0);
  c.clearRect(0, 0, W, H);
  B.chord(c, x0 - 20, y - m.asc - 10, m.w + 40, m.asc + m.desc + 20, p);
  c.globalCompositeOperation = 'destination-in';
  c.font = f; c.fillStyle = '#000'; c.fillText(str, x0, y);
  c.globalCompositeOperation = 'source-over';
  ctx.drawImage(tmp, 0, 0, W, H);
  ctx.restore();
  return m;
}
// a white plate with a dark heading, the brand's slash and a Montserrat descriptor
function headPlate(ctx, x, y, t, t0, head, sub, { size = 64, subSize = 32, pad = 34, color = C.white, ink = C.ink, accent = C.red } = {}) {
  const fh = font(size), fs = font(subSize, MONT, 700);
  const mh = B.measure(ctx, head, fh), ms = sub ? Math.max(...sub.map((l) => B.measure(ctx, l, fs).w)) : 0;
  const w = Math.max(mh.w, ms + subSize * 1.6) + pad * 2;
  const h = pad * 1.6 + size * 0.95 + (sub ? sub.length * subSize * 1.3 + subSize * 0.5 : 0);
  B.plate(ctx, x, y, w, h, color, ease(t, t0, t0 + 0.55, (q) => q));
  B.riseText(ctx, head, x + pad, y + pad * 0.8 + size * 0.86, fh, ink, ease(t, t0 + 0.2, t0 + 0.65));
  if (sub) {
    const sy = y + pad * 0.8 + size * 0.95 + subSize * 0.55;
    B.slash(ctx, x + pad, sy + 2, subSize * 0.9, accent, ease(t, t0 + 0.35, t0 + 0.6), 4);
    sub.forEach((l, i) => B.riseText(ctx, l, x + pad + subSize * 1.4, sy + subSize * 0.95 + i * subSize * 1.3, fs, ink, ease(t, t0 + 0.4 + i * 0.08, t0 + 0.8 + i * 0.08)));
  }
  return { w, h };
}

// a colour plate sized to its line of text (the text rises in after the plate opens)
function textPlate(ctx, str, x, y, f, bg, fg, t, t0, { padX = 34, h = null, w = null } = {}) {
  const m = B.measure(ctx, str, f), hh = h ?? (m.asc + m.desc) * 1.55, ww = w ?? m.w + padX * 2;
  B.plate(ctx, x, y, ww, hh, bg, ease(t, t0, t0 + 0.5, (q) => q));
  B.riseText(ctx, str, x + padX, y + hh / 2 + (m.asc - m.desc) / 2, f, fg, ease(t, t0 + 0.15, t0 + 0.55));
  return { w: ww, h: hh };
}
const textW = (ctx, str, f, padX = 34) => B.measure(ctx, str, f).w + padX * 2;

// ---------------------------------------------------------------- 01 opening title (scene 1)
// «Технологии и традиции: 60 лет мастерства и профессионализма»
const zastavka = {
  dur: 6,
  samples: (t) => (t < 3.2 ? 8 : 1),
  draw(ctx, t, IMG) {
    const cx = 470, cy = 540;
    symbolRing(ctx, cx, cy, 372, t, 0.25);
    logoDisc(ctx, IMG, cx, cy, 300, t, 0.0);
    const x = 900;
    // title on two colour plates
    const f1 = font(66);
    [['ТЕХНОЛОГИИ', C.blue, 0.45], ['И ТРАДИЦИИ', C.red, 0.6]].forEach(([s, col, t0], i) => {
      const m = B.measure(ctx, s, f1), y = 210 + i * 116;
      B.plate(ctx, x, y, m.w + 70, 104, col, ease(t, t0, t0 + 0.5, (q) => q));
      B.riseText(ctx, s, x + 35, y + 80, f1, C.white, ease(t, t0 + 0.15, t0 + 0.55));
    });
    // the hero: 60 in the colour chord, ЛЕТ beside it
    const m60 = solidText(ctx, '60', x - 8, 760, 330, ease(t, 0.85, 1.7, (q) => q), LOGO_GREEN);
    const lx = x + m60.w + 34;
    textPlate(ctx, 'ЛЕТ', lx, 562, font(104), C.ink, C.white, t, 1.3, { h: 150 });
    // descriptor
    const fs = font(40, MONT, 700);
    const lines = ['мастерства и профессионализма'];
    const mw = B.measure(ctx, lines[0], fs).w;
    B.plate(ctx, x, 800, mw + 120, 92, C.white, ease(t, 1.6, 2.1, (q) => q));
    B.slash(ctx, x + 30, 826, 40, C.orange, ease(t, 1.8, 2.05), 5);
    B.riseText(ctx, lines[0], x + 90, 862, fs, C.ink, ease(t, 1.85, 2.3));
  },
};

// ---------------------------------------------------------------- 11 isometric chart (scene 11)
// «Динамика роста числа трудоустроенных выпускников техникума по специальности»
const DATA = [['2023', 60.7, C.green], ['2024', 62.8, C.cyan], ['2025', 68.4, C.sky]];
// isometric axes: +X runs down-right, +Y down-left, Z up. The years step along -Y, i.e. up and to
// the right across the frame, so the staircase itself reads as growth.
const ISO = { s: 112, ox: 1010, oy: 790 };
const CS = Math.cos(Math.PI / 6), SN = Math.sin(Math.PI / 6);
const iso = (X, Y, Z) => [ISO.ox + (X - Y) * CS * ISO.s, ISO.oy + (X + Y) * SN * ISO.s - Z * ISO.s];
const STEP = 2.3;
function poly(ctx, pts, color) {
  ctx.fillStyle = color; ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fill();
}
// an iso box from (X, Y, Z0) size (w, d, h): the +Y face (left), +X face (right), top
function isoBox(ctx, X, Y, Z0, w, d, h, top, left, right) {
  if (h <= 0.001) return;
  const Z1 = Z0 + h;
  poly(ctx, [iso(X, Y + d, Z0), iso(X + w, Y + d, Z0), iso(X + w, Y + d, Z1), iso(X, Y + d, Z1)], left);
  poly(ctx, [iso(X + w, Y, Z0), iso(X + w, Y + d, Z0), iso(X + w, Y + d, Z1), iso(X + w, Y, Z1)], right);
  poly(ctx, [iso(X, Y, Z1), iso(X + w, Y, Z1), iso(X + w, Y + d, Z1), iso(X, Y + d, Z1)], top);
}
// text lying on the floor, reading along -Y (up and to the right), centred on (X, Y)
function floorText(ctx, str, X, Y, f, color) {
  const [x, y] = iso(X, Y, 0);
  ctx.save();
  ctx.transform(CS, -SN, CS, SN, x, y);   // relative to the current (supersampled) transform
  ctx.font = f; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(str, 0, 0);
  ctx.restore();
}
const chart = {
  dur: 8,
  samples: (t) => (t < 4.4 ? 8 : 1),
  draw(ctx, t) {
    headPlate(ctx, 110, 110, t, 0.1, 'ТРУДОУСТРОЙСТВО', ['выпускников техникума', 'по специальности'], { size: 62, subSize: 34, accent: C.green });
    // the slab under the staircase
    const ks = pop(t, 0.3, { stiffness: 150, damping: 16 });
    if (ks > 0) {
      const [ax, ay] = iso(0.5, -STEP, 0);
      ctx.save(); ctx.translate(ax, ay); ctx.scale(ks, ks); ctx.translate(-ax, -ay);
      isoBox(ctx, -0.55, -2 * STEP - 0.6, -0.3, 2.6, 2 * STEP + 2.2, 0.3, C.white, '#D3D8DE', '#BCC2CA');
      DATA.forEach(([y], i) => floorText(ctx, y, 1.55, -i * STEP + 0.5, font(40, MONT, 700), C.ink));
      ctx.restore();
    }
    // bars, drawn far to near (the 2025 bar is furthest back)
    const bars = DATA.map(([, v, col], i) => {
      const t0 = 0.9 + i * 0.45;
      const k = spring(t - t0, { stiffness: 120, damping: 12 });
      // the scale starts at 40 % so the year-on-year growth reads; the labels carry the true values
      return { i, v, col, t0, k, h: Math.max(0, ((v - 40) / 10) * 1.25 * k) };
    });
    [...bars].reverse().forEach(({ i, col, h }) => isoBox(ctx, 0, -i * STEP, 0, 1, 1, h, LIGHT[col], col, DARK[col]));
    bars.forEach(({ i, v, col, t0, k, h }) => {
      if (k <= 0.02) return;
      const [x, y] = iso(0.5, -i * STEP + 0.5, h);
      const val = (v * Math.min(1, clamp(k))).toFixed(1).replace('.', ',') + '%';
      const pv = pop(t, t0 + 0.15, { stiffness: 260, damping: 16 });
      ctx.save(); ctx.translate(x, y - 70); ctx.scale(pv, pv);
      ctx.font = font(60); ctx.textAlign = 'center';
      const mw = ctx.measureText(val).width;
      ctx.fillStyle = C.white; B.rrect(ctx, -mw / 2 - 24, -62, mw + 48, 84, 0); ctx.fill();
      ctx.fillStyle = col; ctx.fillRect(-mw / 2 - 24, 22, mw + 48, 8);
      ctx.fillStyle = C.ink; ctx.fillText(val, 0, 2);
      ctx.restore();
    });
    // the growth from 2023 to 2025 (68,4 − 60,7), shown as «+7,7%» as the client asked
    const kg = pop(t, 2.7, { stiffness: 220, damping: 14 });
    if (kg > 0) {
      ctx.save(); ctx.translate(110, 470); ctx.scale(kg, kg);
      const f = font(76), m = B.measure(ctx, '+7,7%', f);
      ctx.fillStyle = C.red; ctx.fillRect(0, 0, m.w + 160, 120);
      ctx.fillStyle = C.white;
      ctx.beginPath(); ctx.moveTo(34, 88); ctx.lineTo(64, 32); ctx.lineTo(94, 88); ctx.closePath(); ctx.fill();
      ctx.font = f; ctx.fillText('+7,7%', 118, 90);
      ctx.restore();
      textPlate(ctx, 'с 2023 по 2025 год', 110, 590, font(32, MONT, 700), C.white, C.ink, t, 2.85, { padX: 26, h: 64 });
    }
  },
};

// ---------------------------------------------------------------- 10 speciality plate (scene 10)
const PROFS = {
  prof1: ['Химическая технология', 'неорганических веществ', C.green, 'flask'],
  prof2: ['Химическая технология производства', 'химических соединений', C.cyan, 'molecule'],
  prof3: ['Поварское', 'и кондитерское дело', C.orange, 'chef'],
  prof4: ['Строительство и эксплуатация', 'зданий и сооружений', C.slate, 'building'],
  prof5: ['Монтаж, техническое обслуживание', 'и ремонт промышленного оборудования', C.blue, 'gear'],
  prof6: ['Техническое обслуживание и ремонт', 'автотранспортных средств', C.sky, 'car'],
  prof7: ['Сварщик (ручной и частично', 'механизированной сварки (наплавки)', C.red, 'weld'],
};
function profClip([l1, l2, col, ic]) {
  return {
    dur: 5,
    samples: (t) => (t < 2.4 ? 8 : 1),
    draw(ctx, t) {
      const x = 110, y = 770, h = 200;
      // the colour tile with the speciality's icon
      const s = pop(t, 0, { stiffness: 230, damping: 15 });
      ctx.save(); ctx.translate(x + h / 2, y + h / 2); ctx.scale(s, s);
      ctx.fillStyle = col; B.rrect(ctx, -h / 2, -h / 2, h, h, 0); ctx.fill();
      ctx.restore();
      icon(ctx, ic, x + h / 2, y + h / 2, 118, C.white, pop(t, 0.15, { stiffness: 260, damping: 13 }));
      // the white plate: label, slash, two lines in the heading face
      const f = font(46), fl = font(24, MONT, 700);
      const w = Math.max(B.measure(ctx, l1.toUpperCase(), f).w, B.measure(ctx, l2.toUpperCase(), f).w) + 90;
      B.plate(ctx, x + h, y, w, h, C.white, ease(t, 0.2, 0.75, (q) => q));
      ctx.save(); B.clipPlate(ctx, x + h, y, w, h, ease(t, 0.2, 0.75, (q) => q));
      B.chord(ctx, x + h, y + h - 14, w, 14, ease(t, 0.5, 1.3, (q) => q));
      ctx.restore();
      B.slash(ctx, x + h + 44, y + 26, 26, col, ease(t, 0.45, 0.7), 4);
      B.riseText(ctx, 'СПЕЦИАЛЬНОСТЬ', x + h + 84, y + 50, fl, '#6D7279', ease(t, 0.5, 0.85), { track: 2 });
      B.riseText(ctx, l1.toUpperCase(), x + h + 44, y + 108, f, C.ink, ease(t, 0.55, 0.95));
      B.riseText(ctx, l2.toUpperCase(), x + h + 44, y + 162, f, C.ink, ease(t, 0.65, 1.05));
    },
  };
}

// ---------------------------------------------------------------- name plates (scenes 3, 11, 12...)
const NAMES = {
  name_polina: ['Полина Чукаева', 'выпускница ВТТ', C.green],
  name_svetlana: ['Светлана Прохватаева', 'выпускница ВТТ', C.cyan],
  name_lyudmila: ['Людмила Хитрецова', 'выпускница ВТТ', C.orange],
  name_ivan: ['Иван Тимошкин', 'выпускник ВТТ', C.blue],
  name_misha: ['Михаил Богатыревич', null, C.orange],
  // Misha's grandparents
  name_babushka: ['Нина Николаевна Стифеева', 'бабушка', C.green],
  name_dedushka: ['Александр Сергеевич Стифеев', 'дедушка', C.blue],
};
const GOV = {
  name_gubernator: ['Василий Николаевич Анохин', 'Губернатор Смоленской области', C.red],
};
function nameClip([name, role, col]) {
  return {
    dur: 5,
    samples: (t) => (t < 2.3 ? 8 : 1),
    draw(ctx, t) {
      const h = role ? 170 : 120, x = 110, y = 970 - h;
      // a vertical slice of the chord as the plate's spine
      B.chord(ctx, x, y, 90, h, ease(t, 0, 0.7, (q) => q), [C.cyan, C.green, C.orange, C.red]);
      const fn = font(60), fr = font(32, MONT, 700);
      const w = Math.max(B.measure(ctx, name, fn).w, role ? B.measure(ctx, role, fr).w + 50 : 0) + 90;
      B.plate(ctx, x + 90, y, w, h, C.white, ease(t, 0.15, 0.7, (q) => q));
      B.riseText(ctx, name, x + 134, y + (role ? 86 : 84), fn, C.ink, ease(t, 0.35, 0.8));
      if (role) {
        B.slash(ctx, x + 134, y + 106, 32, col, ease(t, 0.5, 0.75), 4);
        B.riseText(ctx, role, x + 184, y + 136, fr, C.ink, ease(t, 0.55, 0.95));
      }
    },
  };
}

// the governor: the name plate with the Smolensk region's coat of arms in front of it
let GERB = null;
function govClip([name, role, col]) {
  const base = nameClip([name, role, col]);
  return {
    dur: 5,
    samples: (t) => (t < 2.3 ? 8 : 1),
    async init() {
      if (!GERB) await new Promise((ok, no) => { GERB = new Image(); GERB.onload = ok; GERB.onerror = no; GERB.src = 'assets/gerb_smolensk.png'; });
    },
    draw(ctx, t) {
      // the plate moves right to make room for the arms
      ctx.save(); ctx.translate(230, 0); base.draw(ctx, t); ctx.restore();
      const h = 250, w = (h * GERB.width) / GERB.height, cx = 110 + w / 2, cy = 970 - 85;
      const s = pop(t, 0.1, { stiffness: 220, damping: 15 });
      if (s <= 0.001) return;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
      ctx.drawImage(GERB, -w / 2, -h / 2, w, h); ctx.restore();
    },
  };
}

// ---------------------------------------------------------------- infographics (scenes 8, 10, 11)
// a big number in the chord that counts up, a stack of colour plates beside it, a descriptor below
function statClip({ prefix, value, fmt, plates, lines, accent, below = false, size = 330 }) {
  return {
    dur: 6,
    samples: (t) => (t < 3.4 ? 8 : 1),
    draw(ctx, t) {
      // sk scales the number and its plates; the descriptor keeps its size
      const sk = size / 330, x = 150, y = 230 + (330 - size) * 1.1, big = font(size);
      if (prefix) textPlate(ctx, prefix, x, y, font(40), C.ink, C.white, t, 0, { padX: 26, h: 72 });
      const k = ease(t, 0.3, 1.9, E.outCubic);
      chordText(ctx, fmt(value * k), x - 10, y + 360 * sk, size, ease(t, 0.3, 1.2, (q) => q));
      // plates beside the number, or (for a wide number) one plate under it
      const fx = below ? x : x + B.measure(ctx, fmt(value), big).w + 40, pf = font(84 * sk);
      const pw = Math.max(...plates.map(([str]) => textW(ctx, str, pf, 36 * sk)));
      const ph = (plates.length > 1 ? 120 : 150) * sk, py = below ? y + 400 * sk : y + 360 - plates.length * (ph + 6) + 6 - 4;
      plates.forEach(([str, col], j) => textPlate(ctx, str, fx, py + j * (ph + 6), pf, col, C.white, t, 0.9 + j * 0.15, { padX: 36 * sk, h: ph, w: pw }));
      const fs = font(36, MONT, 700), dy = below ? y + 420 * sk + ph + 16 : y + 420;
      const w = Math.max(...lines.map((l) => B.measure(ctx, l, fs).w)) + 130;
      B.plate(ctx, x, dy, w, 50 + lines.length * 50, C.white, ease(t, 1.5, 2.0, (q) => q));
      B.slash(ctx, x + 32, dy + 32, 38, accent, ease(t, 1.7, 1.95), 5);
      lines.forEach((l, i) => B.riseText(ctx, l, x + 92, dy + 62 + i * 50, fs, C.ink, ease(t, 1.75 + i * 0.1, 2.15 + i * 0.1)));
    },
  };
}
const thousands = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
// the number sits higher when its plate goes under it
const STATS = {
  // scene 8: «...ПАО «Дорогобуж» вложило свыше 100 млн рублей»
  invest: { prefix: 'СВЫШЕ', value: 100, fmt: (v) => String(Math.round(v)), plates: [['МЛН', C.orange], ['РУБЛЕЙ', C.red]],
    lines: ['вложило ПАО «Дорогобуж» в создание химического', 'кластера и масштабную модернизацию техникума'], accent: C.orange },
  // scene 10 (voice-over): «подготовило более 18 тысяч специалистов разных профессий»
  stat18000: { prefix: 'БОЛЕЕ', value: 18000, fmt: thousands, plates: [['СПЕЦИАЛИСТОВ', C.blue]], below: true,
    lines: ['разных профессий подготовил техникум', 'за 60 лет своей деятельности'], accent: C.blue },
  // scene 11: «85% от общего количества трудоустроенных находят работу на предприятиях Дорогобужского округа»
  stat85: { prefix: null, value: 85, fmt: (v) => Math.round(v) + '%', plates: [['ДОРОГОБУЖСКИЙ ОКРУГ', C.green]], below: true, size: 200,
    lines: ['от общего количества трудоустроенных находят', 'работу на предприятиях Дорогобужского округа'], accent: C.green },
};

// ---------------------------------------------------------------- dates (voice-over, scenes 4, 6, 8)
const DATES = {
  date1965: ['1965', ['началось строительство профессионально-', 'технического училища в Верхнеднепровском'], C.grey],
  date1966: ['1966', ['в сентябре ТУ-17 приняло', '300 первых учащихся'], C.slate],
  date1967: ['1967', ['первый выпуск', 'квалифицированных рабочих'], C.blue],
  date2008: ['2008', ['училище реорганизовано в Верхнеднепровский', 'технологический техникум'], C.cyan],
  date2024: ['2024', ['17 июля — соглашение о создании кластера', '«Химические технологии»', 'программы «Профессионалитет»'], C.green],
  date2025: ['2025', ['1 сентября кластер «Химические технологии»', 'начал подготовку специалистов'], C.orange],
};
function dateClip([year, lines, col]) {
  return {
    dur: 5,
    samples: (t) => (t < 2.6 ? 8 : 1),
    draw(ctx, t) {
      const x = 110, y = 760;
      const m = chordText(ctx, year, x, y + 160, 190, ease(t, 0, 0.8, (q) => q));
      const px = x + m.w + 30, fs = font(34, MONT, 700);
      const w = Math.max(...lines.map((l) => B.measure(ctx, l, fs).w)) + 120;
      const ph = 44 + lines.length * 48, py = y + 166 - ph;
      B.plate(ctx, px, py, w, ph, C.white, ease(t, 0.35, 0.85, (q) => q));
      ctx.save(); B.clipPlate(ctx, px, py, w, ph, ease(t, 0.35, 0.85, (q) => q));
      ctx.fillStyle = col; ctx.fillRect(px, py, 12, ph);
      ctx.restore();
      B.slash(ctx, px + 36, py + 30, 34, col, ease(t, 0.55, 0.8), 5);
      lines.forEach((l, i) => B.riseText(ctx, l, px + 90, py + 60 + i * 48, fs, C.ink, ease(t, 0.6 + i * 0.1, 1.0 + i * 0.1)));
    },
  };
}

// ---------------------------------------------------------------- 15 closing title (scene 15)
// round 2 (the client): the jubilee logo alone in the centre, «История продолжается!» under it;
// the line «Верхнеднепровскому технологическому техникуму — 60 лет» is gone
const final = {
  dur: 7,
  samples: (t) => (t < 3.6 ? 8 : 1),
  draw(ctx, t, IMG) {
    const cx = W / 2, cy = 455;
    symbolRing(ctx, cx, cy, 352, t, 0.25);
    logoDisc(ctx, IMG, cx, cy, 284, t, 0.0);
    const fs = font(48, MONT, 700), str = 'История продолжается!';
    const pw = B.measure(ctx, str, fs).w + 140, px = W / 2 - pw / 2, py = 870;
    B.plate(ctx, px, py, pw, 104, C.white, ease(t, 1.3, 1.8, (q) => q));
    B.slash(ctx, px + 34, py + 30, 46, C.red, ease(t, 1.5, 1.75), 5);
    B.riseText(ctx, str, px + 104, py + 70, fs, C.ink, ease(t, 1.55, 2.0));
  },
};

// two livelier takes on the new closing title, in the opening's own language (bold colour plates,
// the chord ribbon), the logo still at the centre and no dedication line
// A: the chord ribbon sweeps across the whole frame behind the logo; ИСТОРИЯ / ПРОДОЛЖАЕТСЯ! stack
//    under it in colour plates, offset like the opening's ТЕХНОЛОГИИ / И ТРАДИЦИИ
const finalA = {
  dur: 7,
  samples: (t) => (t < 3.6 ? 8 : 1),
  draw(ctx, t, IMG) {
    const cx = W / 2, cy = 400;
    B.ribbon(ctx, cx, cy + 40, 2600, 150, -B.SLANT, ease(t, 0, 1.4, (q) => q));
    symbolRing(ctx, cx, cy, 330, t, 0.35, 54);
    logoDisc(ctx, IMG, cx, cy, 262, t, 0.15);
    // kept inside the middle 1440 px (the hall's screens lose the sides)
    const f = font(68), w1 = textW(ctx, 'ИСТОРИЯ', f, 34), w2 = textW(ctx, 'ПРОДОЛЖАЕТСЯ!', f, 34), x0 = cx - (w1 * 0.6 + w2) / 2;
    textPlate(ctx, 'ИСТОРИЯ', x0, 790, f, C.blue, C.white, t, 1.3, { padX: 34, h: 100 });
    textPlate(ctx, 'ПРОДОЛЖАЕТСЯ!', x0 + w1 * 0.6, 896, f, C.orange, C.white, t, 1.5, { padX: 34, h: 100 });
  },
};
// B: continuation. The words sit in one line of plates and the chord runs on out of the last one,
//    past the frame's edge: the story goes on
const finalB = {
  dur: 7,
  samples: (t) => (t < 3.6 ? 8 : 1),
  draw(ctx, t, IMG) {
    const cx = W / 2, cy = 420;
    symbolRing(ctx, cx, cy, 345, t, 0.25);
    logoDisc(ctx, IMG, cx, cy, 276, t, 0.0);
    const f = font(76), h = 112, w1 = textW(ctx, 'ИСТОРИЯ', f, 34), w2 = textW(ctx, 'ПРОДОЛЖАЕТСЯ', f, 34);
    const x0 = cx - (w1 + w2 + 8) / 2, y = 860;
    // the chord leaves the plates and runs out of the frame on the right
    const k = ease(t, 2.0, 3.2, E.inOutCubic), x1 = x0 + w1 + w2 + 8;
    if (k > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x1, y, (W - x1 + 40) * k, h); ctx.clip(); B.chord(ctx, x1 - 20, y, W - x1 + 80, h, 1); ctx.restore(); }
    textPlate(ctx, 'ИСТОРИЯ', x0, y, f, C.blue, C.white, t, 1.3, { padX: 34, h });
    textPlate(ctx, 'ПРОДОЛЖАЕТСЯ', x0 + w1 + 8, y, f, C.white, C.ink, t, 1.5, { padX: 34, h });
  },
};

// round 2, more ideas for the closing title
const TAU_ = Math.PI * 2;
function gear(ctx, x, y, r, teeth, rot, col, hole = 0.38) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath();
  const d = r * 0.2;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU_, s = TAU_ / teeth;
    [[a - s * 0.5, r - d], [a - s * 0.25, r - d], [a - s * 0.17, r], [a + s * 0.17, r], [a + s * 0.25, r - d]].forEach(([aa, rr], j) =>
      (i === 0 && j === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, Math.cos(aa) * rr, Math.sin(aa) * rr));
  }
  ctx.closePath(); ctx.moveTo(r * hole, 0); ctx.arc(0, 0, r * hole, 0, TAU_, true); ctx.fill('evenodd'); ctx.restore();
}
// C: a timeline. 1965 ... 2025 run in from the left as a chord line, the logo rises over 2026 at the
//    centre, and the line goes on to the right as a dashed path with an arrow: the story continues
const finalC = {
  dur: 7,
  samples: (t) => (t < 3.6 ? 8 : 1),
  draw(ctx, t, IMG) {
    const ly = 760, x0 = 250, xc = W / 2, x1 = 1690;
    const kp = ease(t, 0, 1.2, E.inOutCubic);
    if (kp > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x0, ly - 8, (xc - x0) * kp, 16); ctx.clip(); B.chord(ctx, x0 - 20, ly - 8, xc - x0 + 40, 16, 1, undefined, 0); ctx.restore(); }
    ['1965', '1966', '1967', '2008', '2024', '2025'].forEach((y, i) => {
      const x = x0 + 20 + i * 108, k = pop(t, 0.2 + i * 0.12, { stiffness: 300, damping: 16 });
      if (k <= 0) return;
      ctx.save(); ctx.translate(x, ly); ctx.scale(k, k);
      ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU_); ctx.fill();
      ctx.font = font(26, MONT, 700); ctx.textAlign = 'center';
      B.plate(ctx, -46, 26, 92, 40, C.white, 1); ctx.fillStyle = C.ink; ctx.fillText(y, 0, 56);
      ctx.restore();
    });
    // the future: dashes drawing on to the right, an arrow at the end
    const kf = ease(t, 2.2, 3.4, E.inOutCubic);
    if (kf > 0) {
      const xe = xc + 60 + (x1 - xc - 60) * kf;
      ctx.save(); ctx.strokeStyle = C.white; ctx.lineWidth = 8; ctx.setLineDash([26, 18]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(xc + 60, ly); ctx.lineTo(xe - 20, ly); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.white; ctx.beginPath(); ctx.moveTo(xe + 22, ly); ctx.lineTo(xe - 18, ly - 24); ctx.lineTo(xe - 18, ly + 24); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // 2026: the logo over its point on the line
    const kd = pop(t, 1.1, { stiffness: 240, damping: 14 });
    if (kd > 0) { ctx.save(); ctx.translate(xc, ly); ctx.scale(kd, kd); ctx.fillStyle = LOGO_GREEN; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU_); ctx.fill();
      ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU_); ctx.fill(); ctx.restore(); }
    const kl = ease(t, 1.2, 1.7);
    if (kl > 0) { ctx.fillStyle = C.white; ctx.fillRect(xc - 3, ly - 22 - 100 * kl, 6, 100 * kl); }
    logoDisc(ctx, IMG, xc, 390, 250, t, 1.35);
    const fs = font(44, MONT, 700), str = 'История продолжается!', pw = B.measure(ctx, str, fs).w + 130;
    const px = xc - pw / 2, py = ly + 110;   // under the line, centred (inside the middle 1440 px)
    B.plate(ctx, px, py, pw, 92, C.white, ease(t, 3.0, 3.5, (q) => q));
    B.slash(ctx, px + 32, py + 26, 42, C.red, ease(t, 3.2, 3.45), 5);
    B.riseText(ctx, str, px + 96, py + 62, fs, C.ink, ease(t, 3.25, 3.7));
  },
};
// D: the mechanism keeps running. The logo's own gear meshes with gears in the brand colours that
//    turn round it, and under them the words in colour plates
const finalD = {
  dur: 7,
  samples: (t) => (t < 3.6 ? 8 : 1),
  draw(ctx, t, IMG) {
    const cx = W / 2, cy = 420, run = t * 0.5;
    [[-370, -150, 150, 18, C.blue, 1], [-330, 190, 105, 13, C.orange, -1], [355, -175, 120, 15, C.green, -1], [380, 150, 165, 20, C.red, 1], [560, -10, 70, 9, C.slate, 1], [-560, 30, 80, 10, C.cyan, -1]]
      .forEach(([dx, dy, r, n, col, dir], i) => {
        const k = pop(t, 0.3 + i * 0.1, { stiffness: 200, damping: 14 });
        if (k <= 0) return;
        gear(ctx, cx + dx, cy + dy, r * k, n, dir * run * (150 / r) + i, col);
      });
    logoDisc(ctx, IMG, cx, cy, 260, t, 0.0);
    const f = font(70), w1 = textW(ctx, 'ИСТОРИЯ', f, 34), w2 = textW(ctx, 'ПРОДОЛЖАЕТСЯ!', f, 34), x0 = cx - (w1 + w2 + 10) / 2;
    textPlate(ctx, 'ИСТОРИЯ', x0, 840, f, C.blue, C.white, t, 1.4, { padX: 34, h: 106 });
    textPlate(ctx, 'ПРОДОЛЖАЕТСЯ!', x0 + w1 + 10, 840, f, C.white, C.ink, t, 1.6, { padX: 34, h: 106 });
  },
};
// E: a salute. The brand's symbols burst out of the logo like confetti, spin, and come to rest
//    scattered round it; the words come last
const finalE = {
  dur: 7,
  samples: (t) => (t < 3.6 ? 8 : 1),
  draw(ctx, t, IMG) {
    const cx = W / 2, cy = 430;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU_ + (M.hash01(i, 5) - 0.5) * 0.4, R = 330 + 230 * M.hash01(i, 6);
      const tx = cx + Math.cos(a) * R * 1.35, ty = cy + Math.sin(a) * R * 0.82;
      if (ty > 760 || ty < 70 || tx < 250 || tx > 1670) continue;   // clear of the words and the cropped sides
      const k = clamp((t - 0.35 - M.hash01(i, 7) * 0.25) / 1.1), e = E.outCubic(k);
      if (k <= 0) continue;
      const n = B.SYMBOLS[i % 8], sz = 46 + 40 * M.hash01(i, 8);
      const x = cx + (tx - cx) * e, y = cy + (ty - cy) * e - Math.sin(Math.PI * k) * 60;
      B.symbol(ctx, n, x + Math.sin(t * 0.8 + i) * 6 * e, y + Math.cos(t * 0.7 + i) * 6 * e, sz, null, Math.min(1, k * 3), (1 - e) * 6 * (i % 2 ? 1 : -1) + Math.sin(t * 0.5 + i) * 0.1);
    }
    logoDisc(ctx, IMG, cx, cy, 270, t, 0.0);
    const f = font(70), w1 = textW(ctx, 'ИСТОРИЯ', f, 34), w2 = textW(ctx, 'ПРОДОЛЖАЕТСЯ!', f, 34), x0 = cx - (w1 + w2 + 10) / 2;
    textPlate(ctx, 'ИСТОРИЯ', x0, 840, f, C.red, C.white, t, 1.6, { padX: 34, h: 106 });
    textPlate(ctx, 'ПРОДОЛЖАЕТСЯ!', x0 + w1 + 10, 840, f, C.white, C.ink, t, 1.8, { padX: 34, h: 106 });
  },
};

// round 3: concepts built to move
function wordsUnder(ctx, t, t0, y = 850, c1 = C.blue) {
  const f = font(66), w1 = textW(ctx, 'ИСТОРИЯ', f, 32), w2 = textW(ctx, 'ПРОДОЛЖАЕТСЯ!', f, 32), x0 = W / 2 - (w1 + w2 + 10) / 2;
  textPlate(ctx, 'ИСТОРИЯ', x0, y, f, c1, C.white, t, t0, { padX: 32, h: 100 });
  textPlate(ctx, 'ПРОДОЛЖАЕТСЯ!', x0 + w1 + 10, y, f, C.white, C.ink, t, t0 + 0.2, { padX: 32, h: 100 });
}
// F: one line. A ribbon of the brand colours flies in from the left, loops once round the logo
//    (drawing its frame) and runs off to the top right: the story leaves the frame and goes on
function ribbonPath(ctx, cx, cy, R) {
  ctx.moveTo(-80, 980);
  ctx.bezierCurveTo(300, 960, cx - R - 260, cy + R + 60, cx - R * 0.2, cy + R);
  ctx.arc(cx, cy, R, Math.PI / 2 + 0.2, Math.PI / 2 + 0.2 + TAU_ * 0.97);
  ctx.bezierCurveTo(cx + R + 200, cy - 60, 1600, 120, 2050, -60);
}
const finalF = {
  dur: 7,
  samples: (t) => (t < 3.6 ? 8 : 1),
  draw(ctx, t, IMG) {
    const cx = W / 2, cy = 420, R = 300, k = ease(t, 0, 2.4, E.inOutCubic);
    logoDisc(ctx, IMG, cx, cy, 262, t, 1.0);
    if (k > 0) {
      const L = 5200, cols = [C.cyan, C.green, C.orange, C.red, C.blue];
      cols.forEach((c, i) => {
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const lag = i * 0.035, kk = clamp((k - lag) / (1 - lag));
        ctx.setLineDash([L * kk, L]);
        ctx.translate(0, (i - 2) * 16); ctx.beginPath(); ribbonPath(ctx, cx, cy, R + (i - 2) * 2); ctx.stroke(); ctx.restore();
      });
    }
    wordsUnder(ctx, t, 2.4);
  },
};
// G: shutters. Eight slanted bands of the chord close over the frame, then part to the sides like
//    blinds opening onto the logo, and stay as the frame's wings
const finalG = {
  dur: 7,
  samples: (t) => (t < 3.6 ? 8 : 1),
  draw(ctx, t, IMG) {
    const bw = 150, sk = Math.tan(B.SLANT) * H, close = ease(t, 0, 0.7, E.outCubic), open = ease(t, 0.9, 2.0, E.inOutCubic);
    logoDisc(ctx, IMG, W / 2, 420, 270, t, 1.1);
    wordsUnder(ctx, t, 2.0);
    B.CHORD.forEach((c, i) => {
      const side = i < 4 ? -1 : 1, j = i < 4 ? i : 7 - i;
      const shut = W / 2 + side * (bw * (j + 0.5)) - bw / 2;             // closed: the bands meet in the middle
      const rest = side < 0 ? -bw * 1.2 + j * 58 : W - bw * 0.2 - j * 58 - bw + 120;   // open: stacked at the edge
      const fromX = side < 0 ? -bw * 2 - sk : W + bw * 2;
      const x = lerp(lerp(fromX, shut, close), rest, open);
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + sk, 0); ctx.lineTo(x + sk + bw, 0); ctx.lineTo(x + bw, H); ctx.lineTo(x, H); ctx.closePath(); ctx.fill();
    });
  },
};
// H: orbit. The industry symbols circle the logo on a tilted ellipse, passing behind it and in front
const finalH = {
  dur: 7,
  samples: (t) => (t < 3.6 ? 8 : 1),
  draw(ctx, t, IMG) {
    const cx = W / 2, cy = 420, rx = 560, ry = 170, tilt = -0.18, k = ease(t, 0.2, 1.6, E.outCubic);
    const pos = (i) => { const a = (i / 8) * TAU_ + t * 0.35; const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      return { x: cx + x * Math.cos(tilt) - y * Math.sin(tilt), y: cy + x * Math.sin(tilt) + y * Math.cos(tilt), front: Math.sin(a) > 0, d: Math.sin(a) }; };
    const draw = (front) => B.SYMBOLS.forEach((n, i) => { const p = pos(i); if (p.front !== front) return;
      B.symbol(ctx, n, p.x, p.y, 70 + 30 * p.d, null, pop(t, 0.2 + i * 0.07)); });
    // the orbit itself, a thin solid line, its back half behind the logo
    ctx.save(); ctx.strokeStyle = C.grey; ctx.lineWidth = 3; ctx.translate(cx, cy); ctx.rotate(tilt);
    ctx.beginPath(); ctx.ellipse(0, 0, rx * k, ry * k, 0, Math.PI, TAU_); ctx.stroke(); ctx.restore();
    draw(false);
    logoDisc(ctx, IMG, cx, cy, 255, t, 0.0);
    ctx.save(); ctx.strokeStyle = C.grey; ctx.lineWidth = 3; ctx.translate(cx, cy); ctx.rotate(tilt);
    ctx.beginPath(); ctx.ellipse(0, 0, rx * k, ry * k, 0, 0, Math.PI); ctx.stroke(); ctx.restore();
    draw(true);
    wordsUnder(ctx, t, 1.8, 850, C.green);
  },
};
// I: the years. Cards with the film's years slide in one by one and fan out behind the logo like
//    a hand of cards; the last card, 2026, is the logo itself
const finalI = {
  dur: 7,
  samples: (t) => (t < 3.6 ? 8 : 1),
  draw(ctx, t, IMG) {
    const cx = W / 2, cy = 440;
    const years = [['1965', C.grey], ['1966', C.slate], ['1967', C.blue], ['2008', C.cyan], ['2024', C.green], ['2025', C.orange]];
    years.forEach(([y, col], i) => {
      const k = pop(t, 0.15 + i * 0.16, { stiffness: 160, damping: 15 });
      if (k <= 0) return;
      const a = lerp(-1.1, 1.1, i / 5) * Math.min(1, k), r = 600;
      ctx.save(); ctx.translate(cx, cy + 330); ctx.rotate(a); ctx.translate(0, -r);
      const w = 210, h = 290;
      ctx.fillStyle = col; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = C.white; ctx.font = font(54); ctx.textAlign = 'center'; ctx.fillText(y, 0, -h / 2 + 76);
      ctx.restore();
    });
    logoDisc(ctx, IMG, cx, cy, 250, t, 1.15);
    wordsUnder(ctx, t, 1.9, 850, C.red);
  },
};

// ---------------------------------------------------------------- 12 the pass (scene 12)
// «Михаил Богатыревич, технолог цеха слабой азотной кислоты ПАО «Дорогобуж»» as a badge in the
// brandbook's corporate-badge layout (p. 53): it swings in on its lanyard and settles
const propusk = {
  dur: 6,
  samples: (t) => (t < 3.8 ? 8 : 1),
  draw(ctx, t) {
    const bw = 560, bh = 800, px = W / 2, py = 120;     // pivot: the lanyard clip
    const kin = spring(t, { stiffness: 60, damping: 7 });
    const ang = (1 - kin) * 0.5 * Math.cos(t * 2.2) * Math.exp(-0.2 * t) + 0.012 * Math.sin(t * 1.3);
    const drop = (1 - Math.min(1, kin)) * -900;
    ctx.save();
    ctx.translate(px, py + drop); ctx.rotate(ang);
    // lanyard
    ctx.fillStyle = C.red;
    ctx.beginPath(); ctx.moveTo(-40, -800); ctx.lineTo(40, -800); ctx.lineTo(18, 0); ctx.lineTo(-18, 0); ctx.fill();
    ctx.fillStyle = C.grey; B.rrect(ctx, -30, -10, 60, 40, 8); ctx.fill();
    // the card
    const x = -bw / 2, y = 24;
    ctx.fillStyle = '#E9ECEF'; B.rrect(ctx, x - 14, y - 14, bw + 28, bh + 28, 22); ctx.fill();
    ctx.fillStyle = '#C9CED4'; B.rrect(ctx, -70, y + 6, 140, 26, 13); ctx.fill();
    ctx.save();
    B.rrect(ctx, x, y + 48, bw, bh - 48, 6); ctx.clip();
    ctx.fillStyle = C.white; ctx.fillRect(x, y + 48, bw, bh - 48);
    // the chord falling in from the top right corner, as on the brandbook badge
    ctx.save(); ctx.translate(x + bw - 30, y + 60); ctx.rotate(SLANT_RIBBON);
    B.chord(ctx, -360, -40, 520, 110, ease(t, 0.5, 1.4, (q) => q));
    ctx.restore();
    // photo place: a circle in the industry colour with the chemistry icon
    const s = pop(t, 0.9, { stiffness: 200, damping: 14 });
    ctx.save(); ctx.translate(x + 200, y + 330); ctx.scale(s, s);
    ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(0, 0, 150, 0, M.TAU); ctx.fill();
    icon(ctx, 'flask', 0, 0, 150, C.white);
    ctx.restore();
    // symbols column with hairlines (p. 53)
    B.SYMBOLS.forEach((nm, i) => {
      const yy = y + 230 + i * 50, k = pop(t, 1.1 + i * 0.05, { stiffness: 300, damping: 15 });
      B.symbol(ctx, nm, x + bw - 52, yy, 30, null, k);
      if (i < 7 && k > 0.5) { ctx.fillStyle = C.ink; ctx.fillRect(x + bw - 70, yy + 24, 36, 2); }
    });
    // role, name, place
    B.riseText(ctx, 'Технолог', x + 36, y + 600, font(84, MONT, 700), C.ink, ease(t, 1.3, 1.7));
    B.slash(ctx, x + 40, y + 628, 34, C.green, ease(t, 1.5, 1.7), 4);
    B.riseText(ctx, 'Михаил', x + 96, y + 650, font(32, MONT, 700), C.ink, ease(t, 1.55, 1.9));
    B.riseText(ctx, 'Богатыревич', x + 96, y + 688, font(32, MONT, 700), C.ink, ease(t, 1.6, 1.95));
    B.riseText(ctx, 'цех слабой азотной кислоты', x + 36, y + 740, font(24, MONT, 400), C.ink, ease(t, 1.7, 2.05));
    B.riseText(ctx, 'ПАО «ДОРОГОБУЖ»', x + 36, y + 778, font(28), C.ink, ease(t, 1.8, 2.15));
    ctx.restore();
    ctx.restore();
  },
};
const SLANT_RIBBON = (15 * Math.PI) / 180;

// ---------------------------------------------------------------- transition: the chord sweeps across
const perehod = {
  dur: 2.0,
  samples: () => 12,
  draw(ctx, t) {
    // the eight bands sweep across as one wipe: in from the left (covering the frame at 0.9-1.1 s,
    // where the cut goes), then out to the right. One smooth curve for all bands, heavy
    // motion blur: nothing jumps.
    const n = CHORD.length, bw = (W * 1.6) / n, sk = Math.tan(B.SLANT) * H;
    const span = W * 1.6 + sk + 200;
    CHORD.forEach((c, i) => {
      // a rigid wipe: all bands share one curve, so their widths never change mid-move
      const kin = ease(t, 0, 0.9, E.inOutSine), kout = ease(t, 1.1, 2.0, E.inOutSine);
      const x0 = -sk - 100 + i * bw - span * (1 - kin) + span * kout;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x0 + sk, 0); ctx.lineTo(x0 + sk + bw + 2, 0); ctx.lineTo(x0 + bw + 2, H); ctx.lineTo(x0, H);
      ctx.closePath(); ctx.fill();
    });
  },
};

const NAMES2 = {
  name_vypusknoy: ['Выпускной в ВТТ', '30 июня 2026 г.', C.blue],
  // Misha's parents (supplied by the client)
  name_mama: ['Ольга Александровна Богатыревич', 'инженер по транспорту железнодорожного цеха', C.red],
  name_papa: ['Александр Иванович Богатыревич', 'транспортировщик цеха полимерной продукции', C.sky],
};

// ---------------------------------------------------------------- full-frame backgrounds
// A field in one colour, the industry symbols as a quiet repeating pattern (the business card's
// back, p. 44) drifting at 15 deg, and the colour chord rising from the lower left corner (the cover,
// p. 5). Seamless 10 s loop: the pattern moves exactly one tile per loop.
function fonClip(bg, tint, chordAlpha = 1) {
  const dur = 10, g = 150;
  return {
    dur,
    samples: () => 1,
    draw(ctx, t) {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const p = (t % dur) / dur;
      // the grid moves two tiles right and down per loop; symbol k = (3r + 5c) mod 8 is invariant
      // under that shift (3*2 + 5*2 = 16), so the last frame meets the first
      for (let r = -3; r < H / g + 1; r++) for (let c = -3; c < W / g + 1; c++) {
        const name = B.SYMBOLS[(((r * 3 + c * 5) % 8) + 8) % 8];
        const x = c * g + (r & 1 ? g / 2 : 0) + p * 2 * g, y = r * g + p * 2 * g;
        B.symbol(ctx, name, x, y, 54, M.mix(B.SYM_COLOR(name), bg, tint));
      }
      // the chord rising from the lower left, as on the brandbook's section covers
      ctx.save(); ctx.globalAlpha = chordAlpha;
      ctx.translate(-80, H + 40); ctx.rotate(-B.SLANT);
      const bw = 92;
      CHORD.forEach((col, i) => {
        const hh = 150 + 14 * Math.sin(M.TAU * (p + i / 8));
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(i * bw, 0); ctx.lineTo((i + 1) * bw + 1, 0);
        ctx.lineTo((i + 1) * bw + 1 + Math.tan(B.SLANT) * hh, -hh); ctx.lineTo(i * bw + Math.tan(B.SLANT) * hh, -hh);
        ctx.closePath(); ctx.fill();
      });
      ctx.restore();
    },
  };
}

// round 4: no white disc. The logo itself, large, on a background chosen so it reads (the client:
// the teal must not melt into the picture): full-frame, opaque versions
const FON_L = fonClip('#F2F4F6', 0.82), FON_B = fonClip(C.blue, 0.8);
function bigLogo(ctx, t, pal, dy = -90, share = 0.6) {
  ctx.save(); ctx.translate(0, dy); setLogoScale(share); drawLogo(ctx, t, pal, { glints: true }); ctx.restore();
}
// J: the opening's own light background, the logo in its teal, the words in colour plates
const finalJ = { dur: 7, samples: (t) => (t < 3.6 ? 8 : 1), draw(ctx, t) {
  FON_L.draw(ctx, t); bigLogo(ctx, t - 0.2, JP.light); wordsUnder(ctx, t, 2.4, 860, C.blue);
} };
// K: brand blue background, the logo in white with the chord running round its gear
const finalK = { dur: 7, samples: (t) => (t < 3.6 ? 8 : 1), draw(ctx, t) {
  FON_B.draw(ctx, t); bigLogo(ctx, t - 0.2, JP.prof); wordsUnder(ctx, t, 2.4, 860, C.orange);
} };
// L: deep night blue, a light behind the logo, the chord ribbon sweeping under it
const finalL = { dur: 7, samples: (t) => (t < 3.6 ? 8 : 1), draw(ctx, t) {
  const g = ctx.createRadialGradient(W / 2, 430, 60, W / 2, 430, 1100);
  g.addColorStop(0, '#1B5FB4'); g.addColorStop(0.55, '#0B2F6B'); g.addColorStop(1, '#061C46');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  B.ribbon(ctx, W / 2, 760, 2600, 70, -B.SLANT * 0.6, ease(t, 0.1, 1.5, (q) => q));
  bigLogo(ctx, t - 0.3, JP.prof, -100, 0.58); wordsUnder(ctx, t, 2.5, 860, C.red);
} };

const finalJ2 = { dur: 7, samples: (t) => (t < 3.6 ? 8 : 1), draw(ctx, t) {
  const g = ctx.createRadialGradient(W / 2, 430, 80, W / 2, 500, 1150);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#DCE6EE'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  bigLogo(ctx, t - 0.2, JP.light); wordsUnder(ctx, t, 2.4, 860, C.blue);
} };

export const CLIPS = {
  ...jubileeClips(),
  ...platesClips(),
  ...styles2Clips(),
  ...styles3Clips(),
  ...styles4Clips(),
  ...styles5Clips(),
  ...cardsClips(),
  ...styles6Clips(),
  ...styles7Clips(),
  ...styles8Clips(),
  ...styles9Clips(),
  ...iconExportClips(),
  ...intro10Clips(),
  fon_light: fonClip('#F2F4F6', 0.82),
  fon_blue: fonClip(C.blue, 0.8),
  fon_dark: fonClip(C.ink, 0.8),
  zastavka, final, final_a: finalA, final_b: finalB, final_c: finalC, final_d: finalD, final_e: finalE, final_f: finalF, final_g: finalG, final_h: finalH, final_i: finalI, final_j: finalJ, final_j2: finalJ2, final_k: finalK, final_l: finalL, chart, propusk, perehod,
  ...Object.fromEntries(Object.entries(STATS).map(([k, v]) => [k, statClip(v)])),
  ...Object.fromEntries(Object.entries(PROFS).map(([k, v]) => [k, profClip(v)])),
  ...Object.fromEntries(Object.entries({ ...NAMES, ...NAMES2 }).map(([k, v]) => [k, nameClip(v)])),
  ...Object.fromEntries(Object.entries(GOV).map(([k, v]) => [k, govClip(v)])),
  ...Object.fromEntries(Object.entries(GOV).map(([k, v]) => [`${k}_bez_gerba`, nameClip(v)])),
  ...Object.fromEntries(Object.entries(DATES).map(([k, v]) => [k, dateClip(v)])),
};
