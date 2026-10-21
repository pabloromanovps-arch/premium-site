// brand.js: the «Профессионалитет» brandbook (BB 4.0) as drawing helpers, for the VTT 60 film.
// Everything is flat colour on a transparent canvas: no glows, no soft shadows, so the alpha the
// edit receives is exactly the shapes and their anti-aliased edges.
import * as M from './motion.js';

const { clamp, lerp, spring, E } = M;

// the colour chord, in the brandbook's order (p. 30): each colour is one industry (p. 17)
export const C = {
  cyan: '#00A1D3', green: '#3CBA94', orange: '#F47920', slate: '#43688F',
  grey: '#A5ADB7', red: '#EF4323', blue: '#025EA1', sky: '#2A7DE1',
  ink: '#231F20', white: '#FFFFFF',
};
export const CHORD = [C.cyan, C.green, C.orange, C.slate, C.grey, C.red, C.blue, C.sky];
// the darker partner of each colour (p. 18, "б"): sides of the isometric bars, gradients
export const DARK = { [C.cyan]: '#11559B', [C.green]: '#399A7B', [C.orange]: '#D85509', [C.slate]: '#3B5571',
  [C.grey]: '#7E858D', [C.red]: '#CB2F0D', [C.blue]: '#104985', [C.sky]: '#11559B' };
export const LIGHT = { [C.cyan]: '#4DC0E3', [C.green]: '#77D1B5', [C.orange]: '#F8A263', [C.slate]: '#7B97B5',
  [C.grey]: '#C9CED4', [C.red]: '#F47B64', [C.blue]: '#4A8CC4', [C.sky]: '#6FA8EC' };

export const DELA = 'Dela', MONT = 'Mont';
// supersampling factor: frames are drawn at SS x the output size and filtered down (film.js)
export let SS = 1;
export const setSS = (k) => { SS = k; };
export const font = (size, family = DELA, weight = 400) => `${weight} ${Math.round(size)}px ${family}`;
export const SLANT = (15 * Math.PI) / 180;   // the house angle

// ---------------------------------------------------------------- symbols (assets/symbols.json)
let SYM = null;
export async function loadSymbols() {
  const j = await fetch('assets/symbols.json').then((r) => r.json());
  SYM = Object.fromEntries(Object.entries(j).map(([k, v]) => [k, { ...v, path: new Path2D(v.d) }]));
  return SYM;
}
export const SYM_COLOR = (name) => SYM[name].color;
export const SYMBOLS = ['plane', 'leaf', 'drop', 'gear', 'mountains', 'rail', 'atom', 'ship'];
// one industry symbol, centred on (x, y), fitting a size x size box; s scales it about its centre
export function symbol(ctx, name, x, y, size, color, s = 1, rot = 0) {
  if (s <= 0.001) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(size * s, size * s);
  ctx.fillStyle = color ?? SYM[name].color;
  if (name === 'atom') {                   // the target: ring + dot (the PDF draws its gap in white)
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, M.TAU); ctx.arc(0, 0, 0.25, 0, M.TAU, true); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 0.12, 0, M.TAU); ctx.fill();
  } else {
    ctx.translate(-0.5, -0.5);
    ctx.fill(SYM[name].path);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the colour chord
// Eight equal bands leaning at 15 deg, filling the box (x, y, w, h). p (0..1) slides the bands in
// one after another from the left; each band's own p is staggered.
export function chord(ctx, x, y, w, h, p = 1, colors = CHORD, lean = SLANT) {
  const n = colors.length, bw = w / n;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  colors.forEach((c, i) => {
    const k = E.outCubic(clamp(p * 1.6 - i * (0.6 / n)));
    if (k <= 0) return;
    const x0 = x + i * bw, hk = h * k, off = Math.tan(lean) * hk;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x0 - 1, y + h); ctx.lineTo(x0 + bw + 1, y + h);
    ctx.lineTo(x0 + bw + 1 + off, y + h - hk); ctx.lineTo(x0 - 1 + off, y + h - hk);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}
// the chord as a ribbon rotated by `angle` about (cx, cy): the cover device of the brandbook
export function ribbon(ctx, cx, cy, len, thick, angle, p = 1, colors = CHORD) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(angle);
  const n = colors.length, bw = len / n;
  colors.forEach((c, i) => {
    const k = E.outCubic(clamp(p * 1.7 - i * 0.09));
    if (k <= 0) return;
    ctx.fillStyle = c;
    const x0 = -len / 2 + i * bw, sk = Math.tan(SLANT) * thick;
    const hh = thick * k;
    ctx.beginPath();
    ctx.moveTo(x0, thick / 2); ctx.lineTo(x0 + bw + 0.8, thick / 2);
    ctx.lineTo(x0 + bw + 0.8 + sk * k, thick / 2 - hh); ctx.lineTo(x0 + sk * k, thick / 2 - hh);
    ctx.closePath(); ctx.fill();
  });
  ctx.restore();
}

// ---------------------------------------------------------------- type
export function measure(ctx, str, f, track = 0) {
  ctx.font = f; ctx.letterSpacing = `${track}px`;
  const m = ctx.measureText(str);
  ctx.letterSpacing = '0px';
  return { w: m.width - track, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
}
// text that rises into place from under a mask (its own line box): p 0..1
export function riseText(ctx, str, x, y, f, color, p = 1, { align = 'left', track = 0, sx = 1 } = {}) {
  if (p <= 0) return;
  const m = measure(ctx, str, f, track);
  ctx.save();
  ctx.beginPath();
  const bx = align === 'left' ? x : align === 'center' ? x - (m.w * sx) / 2 : x - m.w * sx;
  ctx.rect(bx - 20, y - m.asc - 12, m.w * sx + 40, m.asc + m.desc + 24);
  ctx.clip();
  ctx.translate(x, y + (1 - E.outCubic(clamp(p))) * (m.asc + m.desc + 24));
  ctx.scale(sx, 1);
  ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.letterSpacing = `${track}px`;
  ctx.fillText(str, 0, 0);
  ctx.restore();
  ctx.letterSpacing = '0px';
}
// the brand's 45 deg slash that separates a descriptor from what it describes
export function slash(ctx, x, y, size, color, p = 1, width = 3) {
  if (p <= 0) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(x, y + size); ctx.lineTo(x + size * E.outCubic(clamp(p)), y + size - size * E.outCubic(clamp(p)));
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- plates
export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2)));
}
// a plate that wipes open from its left edge (p 0..1); returns the visible width
export function plate(ctx, x, y, w, h, color, p = 1, r = 0) {
  const k = E.outCubic(clamp(p));   // a calm deceleration: an expo start reads as a jump
  if (k <= 0) return 0;
  ctx.fillStyle = color;
  rrect(ctx, x, y, w * k, h, r); ctx.fill();
  return w * k;
}
// clip subsequent drawing to the open part of a plate
export function clipPlate(ctx, x, y, w, h, p = 1, r = 0) {
  rrect(ctx, x, y, w * E.outCubic(clamp(p)), h, r); ctx.clip();
}

// a pop: spring scale 0 -> 1 with overshoot, starting at t0 (seconds)
export const pop = (t, t0, cfg = { stiffness: 260, damping: 15 }) => Math.max(0, spring(t - t0, cfg));
export const ease = (t, t0, t1, f = E.outCubic) => f(clamp((t - t0) / (t1 - t0)));
export { lerp, clamp };
