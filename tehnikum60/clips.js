// clips.js: every graphic of the VTT 60 film (docs/plan.md), each a pure function of t (seconds).
// A clip is { dur, draw(ctx, t, IMG), samples(t) }. All copy comes from the client's scenario.
import * as M from './lib/motion.js';
import * as B from './lib/brand.js';
import { icon } from './lib/icons.js';

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
  const ls = pop(t, t0 + 0.12, { stiffness: 140, damping: 13 });
  const img = IMG.logo, k = (R * 1.5) / Math.max(img.width, img.height) * ls;
  ctx.drawImage(img, (-img.width * k) / 2, (-img.height * k) / 2 + R * 0.02, img.width * k, img.height * k);
  ctx.restore();
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
  tmp.width = W; tmp.height = H;
  const c = tmp.getContext('2d');
  c.clearRect(0, 0, W, H);
  B.chord(c, x0 - 20, y - m.asc - 10, m.w + 40, m.asc + m.desc + 20, p);
  c.globalCompositeOperation = 'destination-in';
  c.font = f; c.fillStyle = '#000'; c.fillText(str, x0, y);
  c.globalCompositeOperation = 'source-over';
  ctx.drawImage(tmp, 0, 0);
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
  samples: (t) => (t < 2.4 ? 4 : 1),
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
    const m60 = chordText(ctx, '60', x - 8, 760, 330, ease(t, 0.85, 1.7, (q) => q));
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
const ISO = { s: 118, ox: 1010, oy: 830 };
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
  ctx.setTransform(CS, -SN, CS, SN, x, y);
  ctx.font = f; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(str, 0, 0);
  ctx.restore();
}
const chart = {
  dur: 8,
  samples: (t) => (t < 3.6 ? 4 : 1),
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
    // the growth from 2023 to 2025, in percentage points (68,4 − 60,7)
    const kg = pop(t, 2.7, { stiffness: 220, damping: 14 });
    if (kg > 0) {
      ctx.save(); ctx.translate(110, 470); ctx.scale(kg, kg);
      const f = font(76), m = B.measure(ctx, '+7,7', f);
      ctx.fillStyle = C.red; ctx.fillRect(0, 0, m.w + 250, 120);
      ctx.fillStyle = C.white;
      ctx.beginPath(); ctx.moveTo(34, 88); ctx.lineTo(64, 32); ctx.lineTo(94, 88); ctx.closePath(); ctx.fill();
      ctx.font = f; ctx.fillText('+7,7', 118, 90);
      ctx.font = font(30, MONT, 700); ctx.fillText('п.п.', 128 + m.w, 90);
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
  prof7: ['Сварщик (ручной и частично', 'механизированной сварки (наплавки))', C.red, 'weld'],
};
function profClip([l1, l2, col, ic]) {
  return {
    dur: 5,
    samples: (t) => (t < 1.6 ? 4 : 1),
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
  name_misha: ['Миша', 'ученик 9 класса', C.orange],
};
function nameClip([name, role, col]) {
  return {
    dur: 5,
    samples: (t) => (t < 1.5 ? 4 : 1),
    draw(ctx, t) {
      const x = 110, y = 800, h = 170;
      // a vertical slice of the chord as the plate's spine
      B.chord(ctx, x, y, 90, h, ease(t, 0, 0.7, (q) => q), [C.cyan, C.green, C.orange, C.red]);
      const fn = font(60), fr = font(32, MONT, 700);
      const w = Math.max(B.measure(ctx, name, fn).w, B.measure(ctx, role, fr).w + 50) + 90;
      B.plate(ctx, x + 90, y, w, h, C.white, ease(t, 0.15, 0.7, (q) => q));
      B.riseText(ctx, name, x + 134, y + 86, fn, C.ink, ease(t, 0.35, 0.8));
      B.slash(ctx, x + 134, y + 106, 32, col, ease(t, 0.5, 0.75), 4);
      B.riseText(ctx, role, x + 184, y + 136, fr, C.ink, ease(t, 0.55, 0.95));
    },
  };
}

// ---------------------------------------------------------------- 8 infographic (scene 8)
// «В создание химического кластера и масштабную модернизацию техникума ПАО «Дорогобуж» вложило свыше 100 млн рублей»
const invest = {
  dur: 6,
  samples: (t) => (t < 2.6 ? 4 : 1),
  draw(ctx, t) {
    const x = 150, y = 230;
    textPlate(ctx, 'СВЫШЕ', x, y, font(40), C.ink, C.white, t, 0, { padX: 26, h: 72 });
    // the number counts up in the chord
    const k = ease(t, 0.3, 1.9, E.outCubic);
    const m = chordText(ctx, String(Math.round(100 * k)), x - 10, y + 360, 330, ease(t, 0.3, 1.2, (q) => q));
    const fx = x + Math.max(m.w, B.measure(ctx, '100', font(330)).w) + 40;
    const pw = textW(ctx, 'РУБЛЕЙ', font(84), 36);
    textPlate(ctx, 'МЛН', fx, y + 110, font(84), C.orange, C.white, t, 0.9, { padX: 36, h: 120, w: pw });
    textPlate(ctx, 'РУБЛЕЙ', fx, y + 236, font(84), C.red, C.white, t, 1.05, { padX: 36, h: 120, w: pw });
    // what it was for, word for word
    const fs = font(36, MONT, 700);
    const lines = ['вложило ПАО «Дорогобуж» в создание химического', 'кластера и масштабную модернизацию техникума'];
    const w = Math.max(...lines.map((l) => B.measure(ctx, l, fs).w)) + 130;
    B.plate(ctx, x, y + 420, w, 150, C.white, ease(t, 1.5, 2.0, (q) => q));
    B.slash(ctx, x + 32, y + 452, 38, C.orange, ease(t, 1.7, 1.95), 5);
    lines.forEach((l, i) => B.riseText(ctx, l, x + 92, y + 482 + i * 50, fs, C.ink, ease(t, 1.75 + i * 0.1, 2.15 + i * 0.1)));
  },
};

export const CLIPS = {
  zastavka, chart, invest,
  ...Object.fromEntries(Object.entries(PROFS).map(([k, v]) => [k, profClip(v)])),
  ...Object.fromEntries(Object.entries(NAMES).map(([k, v]) => [k, nameClip(v)])),
};
