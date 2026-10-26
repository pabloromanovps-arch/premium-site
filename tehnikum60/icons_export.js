// icons_export.js: every icon on its own, centred, on transparency, for the motion designer:
// VTT's speciality icons and the brandbook's industry symbols (flat, in three colourings), and
// the 3-D pieces. One clip per file: ico_<name>_<variant>.
import * as B from './lib/brand.js';
import { icon } from './lib/icons.js';
import * as M from './lib/motion.js';

const { W, H } = M;
const SIZE = 860;   // the icon's box; tools/export_icons.py crops a 1000 px square round it
export const SPEC = { flask: B.C.green, molecule: B.C.cyan, chef: B.C.orange, building: B.C.slate, gear: B.C.blue, car: B.C.sky, weld: B.C.red };
export const PIECES = ['flask3d', 'molecule3d', 'rail3d', 'chef3d', 'weld3d', 'car', 'building', 'flask', 'molecule', 'chef', 'weld',
  'plane', 'leaf', 'drop', 'gear', 'mountains', 'rail', 'atom', 'ship'];
let G = null;
export function iconExportClips() {
  const clips = {};
  const still = (f, init) => ({ dur: 1, samples: () => 1, init, draw(ctx) { f(ctx); } });
  for (const v of ['color', 'white', 'ink']) {
    const col = (c) => (v === 'color' ? c : v === 'white' ? '#FFFFFF' : B.C.ink);
    for (const [n, c] of Object.entries(SPEC)) clips[`ico_spec_${n}_${v}`] = still((ctx) => icon(ctx, n, W / 2, H / 2, SIZE, col(c)));
    for (const n of B.SYMBOLS) clips[`ico_sym_${n}_${v}`] = still((ctx) => B.symbol(ctx, n, W / 2, H / 2, SIZE, v === 'color' ? null : col()));
  }
  const init = async () => { if (!G) { G = await import('./jubilee3d.js'); await G.initGlass(10); } };
  for (const n of PIECES) clips[`ico_3d_${n}`] = still((ctx) => {
    const c = G.renderPiece(n, 0.4, -0.55, 1200); ctx.drawImage(c, W / 2 - 600, H / 2 - 600, 1200, 1200);
  }, init);
  clips.ico2_sheet = still((ctx) => icons2Sheet(ctx));
  // the seven in 3-D, on the hall's dark blue and on light, for approval
  for (const [k, bg, ink] of [['ico2_3d_sheet', '#0E1B33', '#FFFFFF'], ['ico2_3d_sheet_light', '#F2F4F7', B.C.ink]]) clips[k] = still((ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    SPEC2.forEach(([n, col, label], i) => {
      const row = i < 4 ? 0 : 1, cnt = row ? 3 : 4, j = row ? i - 4 : i, cx = W / 2 + (j - (cnt - 1) / 2) * 440, cy = 280 + row * 470;
      const c = G.renderPiece(G.addIcon2Piece(n, col), 0.35, -0.5, 900); ctx.drawImage(c, cx - 190, cy - 190, 380, 380);
      ctx.font = B.font(22, B.MONT, 700); ctx.fillStyle = ink; ctx.textAlign = 'center';
      label.split(' — ').forEach((l, q) => ctx.fillText(l, cx, cy + 215 + q * 28));
    });
  }, init);
  return clips;
}

// ---------------------------------------------------------------- vector export (tools/export_icons.mjs)
// A context that records what an icon draws as SVG paths (arcs stay true arcs), one path per
// fill call with that call's fill rule, so overlapping parts (atoms and bonds, wheels and body)
// stay solid. Coordinates are in the icon's unit box, centred on 0. Returns [{ d, rule }].
export function iconSVGPaths(name, drawIcon, { native = false } = {}) {
  let T = [1, 0, 0, 1, 0, 0], d = '', cur = null, lw = 0.1, cap = 'butt', strokes = [], op = 'source-over';
  const stack = [], out = [];
  const P = (x, y) => [T[0] * x + T[2] * y + T[4], T[1] * x + T[3] * y + T[5]];
  const sc = () => Math.hypot(T[0], T[1]);
  const mul = (a, b, c, dd, e, f) => { const [A, Bb, Cc, D, E2, F] = T; T = [A * a + Cc * b, Bb * a + D * b, A * c + Cc * dd, Bb * c + D * dd, A * e + Cc * f + E2, Bb * e + D * f + F]; };
  const f = (v) => +v.toFixed(5);
  const to = (cmd, [x, y]) => { d += `${cmd}${f(x)} ${f(y)} `; cur = [x, y]; };
  const rectD = (x, y, w, h) => { to('M', P(x, y)); to('L', P(x + w, y)); to('L', P(x + w, y + h)); to('L', P(x, y + h)); d += 'Z '; cur = null; };
  const c = {
    set fillStyle(v) {}, set strokeStyle(v) {}, set lineCap(v) { cap = v; },
    set lineWidth(v) { lw = v; }, get lineWidth() { return lw; },
    set globalCompositeOperation(v) { op = v; }, get globalCompositeOperation() { return op; },
    save() { stack.push([T, op]); }, restore() { [T, op] = stack.pop(); },
    translate(x, y) { mul(1, 0, 0, 1, x, y); }, rotate(a) { mul(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0); }, scale(x, y) { mul(x, 0, 0, y, 0, 0); },
    beginPath() { d = ''; cur = null; strokes = []; }, closePath() { if (cur) d += 'Z '; cur = null; },
    moveTo(x, y) { to('M', P(x, y)); strokes.push([[x, y]]); }, lineTo(x, y) { to(cur ? 'L' : 'M', P(x, y)); strokes.at(-1)?.push([x, y]); },
    quadraticCurveTo(cx, cy, x, y) { const q = P(cx, cy), e = P(x, y); d += `Q${f(q[0])} ${f(q[1])} ${f(e[0])} ${f(e[1])} `; cur = e; },
    arc(x, y, r, a0, a1, ccw = false) {
      let span = a1 - a0; if (!ccw && span < 0) span += 2 * Math.PI; if (ccw && span > 0) span -= 2 * Math.PI;
      if (Math.abs(a1 - a0) >= 2 * Math.PI - 1e-6) span = ccw ? -2 * Math.PI : 2 * Math.PI;
      const pt = (a) => P(x + r * Math.cos(a), y + r * Math.sin(a)), R = r * sc();
      to(cur ? 'L' : 'M', pt(a0));
      const n = Math.ceil(Math.abs(span) / (Math.PI * 0.99));
      for (let i = 1; i <= n; i++) { const e = pt(a0 + (span * i) / n); d += `A${f(R)} ${f(R)} 0 0 ${(span > 0) === (T[0] * T[3] - T[1] * T[2] > 0) ? 1 : 0} ${f(e[0])} ${f(e[1])} `;  cur = e; }
    },
    rect(x, y, w, h) { rectD(x, y, w, h); },
    fillRect(x, y, w, h) { const keep = d; d = ''; rectD(x, y, w, h); out.push({ d: d.trim(), rule: 'nonzero' }); d = keep; },
    fill(rule = 'nonzero') {
      if (!d.trim()) return;
      if (op === 'destination-out') out.forEach((q) => (q.cuts ||= []).push({ d: d.trim(), rule }));   // erase: a cut on what is already there
      else out.push({ d: d.trim(), rule });
    },
    stroke() {   // a stroke (the molecule's bonds) becomes its outline; { native: true } keeps it a true SVG stroke (curves, round caps)
      if (native) { if (d.trim()) out.push({ d: d.trim(), stroke: lw * sc(), cap }); return; }
      const hw = lw / 2, keep = d; d = '';
      for (const pts of strokes) for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0), nx = (-(y1 - y0) / L) * hw, ny = ((x1 - x0) / L) * hw;
        to('M', P(x0 + nx, y0 + ny)); to('L', P(x1 + nx, y1 + ny)); to('L', P(x1 - nx, y1 - ny)); to('L', P(x0 - nx, y0 - ny)); d += 'Z ';
      }
      out.push({ d: d.trim(), rule: 'nonzero' }); d = keep; cur = null;
    },
  };
  drawIcon(c, name);
  return out;
}

// ---------------------------------------------------------------- round 2: a sheet for approval
import { icon2 } from './lib/icons2.js';
export const SPEC2 = [
  ['flask', B.C.green, 'Химия — неорганические вещества'], ['tubes', B.C.cyan, 'Химия — соединения'],
  ['chef', B.C.orange, 'Повар — кондитер'], ['crane', B.C.slate, 'Строительство — башенный кран'],
  ['gearwrench', B.C.blue, 'Монтаж — ремонт оборудования'], ['wheel', B.C.sky, 'Ремонт — автотранспорт'],
  ['holder', B.C.red, 'Сварщик — держатель с электродом'],
];
// the files, in the film's order of the specialities (prof1..prof7)
export const SPEC2_FILES = ['01_Khimiya_neorganicheskie', '02_Khimiya_soedineniya', '03_Povar_konditer', '04_Stroitelstvo',
  '05_Montazh_oborudovaniya', '06_Avtotransport', '07_Svarshchik'];
export function icons2Sheet(ctx) {
  ctx.fillStyle = '#F2F4F7'; ctx.fillRect(0, 0, W, H);
  SPEC2.forEach(([n, col, label], i) => {
    const row = i < 4 ? 0 : 1, cnt = row ? 3 : 4, j = row ? i - 4 : i, cx = W / 2 + (j - (cnt - 1) / 2) * 440, cy = 300 + row * 470;
    icon2(ctx, n, cx, cy, 260, col);
    ctx.font = B.font(22, B.MONT, 700); ctx.fillStyle = B.C.ink; ctx.textAlign = 'center';
    const w = label.split(' — ');
    w.forEach((l, j) => ctx.fillText(l, cx, cy + 200 + j * 28));
  });
}
