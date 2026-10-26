// intro10.js: a 10 s intro after the client's own layout: «Профессионалитет» blue, three rounded
// hexagon frames round a white hexagon with the jubilee logo, the word ПРОФЕССИОНАЛИТЕТ set on a
// big turning ring, and the specialities' 3-D icons round it. Everything builds in, then lives.
import * as M from './lib/motion.js';
import * as B from './lib/brand.js';
import { drawLogo, setLogoScale } from './jubilee.js';
const { W, H, TAU, E, clamp, lerp, hash01, spring } = M;

const BG = '#1763AE', LINE = 'rgba(255,255,255,0.11)';
const BLUE = '#1763AE';
// the logo in the brand blue on the white hexagon, no teeth round the 0
const PAL = { logo: BLUE, accent: 'rgba(0,0,0,0)', hi: BLUE, steam: BLUE };
const ease = (t, a, b, f = E.outCubic) => f(clamp((t - a) / (b - a)));
const pop = (t, t0, cfg = { stiffness: 210, damping: 15 }) => Math.max(0, spring(t - t0, cfg));

// a rounded hexagon with a vertex at the top and bottom, rx/ry its half width/height, corners r
function hexPath(ctx, cx, cy, rx, ry, r) {
  const P = [[0, -1], [1, -0.5], [1, 0.5], [0, 1], [-1, 0.5], [-1, -0.5]].map(([x, y]) => [cx + x * rx, cy + y * ry]);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = P[(i + 5) % 6], b = P[i], c = P[(i + 1) % 6];
    const m0 = [b[0] + (a[0] - b[0]) * 0.5, b[1] + (a[1] - b[1]) * 0.5];
    if (i === 0) ctx.moveTo(m0[0], m0[1]);
    ctx.arcTo(b[0], b[1], c[0], c[1], r);
  }
  ctx.closePath();
}
const hexLen = (rx, ry) => 2 * Math.hypot(rx, ry / 2) * 2 + ry * 2;   // perimeter, near enough for a dash

// the faint line drawings of the brand symbols over the whole field, drifting very slowly
function field(ctx, t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const items = [['plane', 170, 380, 420], ['gear', 470, 140, 300], ['ship', 1500, 150, 330], ['plane', 1720, 380, 420],
    ['mountains', 280, 640, 380], ['gear', 1700, 820, 300], ['atom', 1460, 560, 320], ['leaf', 500, 980, 280], ['drop', 1180, 980, 260]];
  items.forEach(([n, x, y, s], i) => {
    const dx = Math.sin(t * 0.25 + i) * 10, dy = Math.cos(t * 0.21 + i * 1.7) * 8;
    // drawn as outlines, like the client's layout
    ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(Math.sin(t * 0.1 + i) * 0.05); ctx.scale(s, s);
    ctx.strokeStyle = LINE; ctx.lineWidth = 3 / s; ctx.lineJoin = 'round';
    if (n === 'atom') { ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.moveTo(0.25, 0); ctx.arc(0, 0, 0.25, 0, TAU); ctx.stroke(); }
    else { ctx.translate(-0.5, -0.5); ctx.stroke(B.symbolPath(n)); }
    ctx.restore();
  });
  ctx.restore();
}

// the word on a ring: letters spaced along a circle, reading clockwise, the ring turning
const WORD = 'ПРОФЕССИОНАЛИТЕТ';
function wordRing(ctx, t) {
  const R = 560, size = 190, cx = W / 2, cy = H / 2;
  const rot0 = -2.62 + 0.035 * t;                                     // slow constant turn
  const spin = lerp(-0.9, 0, ease(t, 1.6, 3.4, E.outCubic));          // swings into place
  ctx.save(); ctx.font = B.font(size); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const step = TAU / (WORD.length + 2.2);
  [...WORD].forEach((ch, i) => {
    const s = pop(t, 1.7 + i * 0.05, { stiffness: 230, damping: 16 });
    if (s <= 0.001) return;
    const a = rot0 + spin + i * step;
    ctx.save(); ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.rotate(a + Math.PI / 2); ctx.scale(s, s);
    ctx.fillText(ch, 0, 0); ctx.restore();
  });
  ctx.restore();
}

// «ПРОФЕССИОНАЛИТЕТ» as an L round a corner, sharing the С. Top left: ПРОФЕСС up the side,
// ИОНАЛИТЕТ along the top. Bottom right: ПРОФЕСС along the bottom, ИОНАЛИТЕТ up the side.
function cornerMark(ctx, x, y, s, k, br = false) {
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = k; ctx.translate(x + (br ? 1 : -1) * (1 - k) * 30, y);
  ctx.fillStyle = '#FFFFFF'; ctx.font = B.font(s); ctx.textBaseline = 'alphabetic';
  if (!br) {
    ctx.textAlign = 'left'; ctx.fillText('ИОНАЛИТЕТ', 2, 0);
    ctx.rotate(-Math.PI / 2); ctx.textAlign = 'left'; ctx.fillText('ПРОФЕСС', -B.measure(ctx, 'ПРОФЕСС', B.font(s)).w, 0);
  } else {
    ctx.textAlign = 'right'; ctx.fillText('ПРОФЕСС', -2, 0);
    ctx.rotate(-Math.PI / 2); ctx.textAlign = 'left'; ctx.fillText('ИОНАЛИТЕТ', 0, s * 0.72);
  }
  ctx.restore();
}

// the chord of brand colours along the bottom edge, wiping in from the left
function chordBar(ctx, k) {
  if (k <= 0) return;
  const segs = [B.C.cyan, B.C.green, B.C.orange, B.C.slate, B.C.grey, B.C.red], w = 250, h = 38, y = H - h;
  ctx.save(); ctx.beginPath(); ctx.rect(0, y, W * k, h); ctx.clip();
  segs.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * w, y, w + 1, h); });
  ctx.fillStyle = B.C.sky; ctx.fillRect(W - 250, y, 250, h);
  ctx.restore();
}

// the 3-D icons: where they sit, their turn and their tilt in the picture plane
const ICONS = [
  ['flask', B.C.green, 560, 250, 0.35, -0.55, -0.5],
  ['gearwrench', B.C.blue, 1345, 215, 0.3, 0.6, 0.15],
  ['holder', B.C.red, 225, 485, 0.35, -0.5, 0.0],
  ['wheel', B.C.sky, 1755, 530, 0.25, 0.7, -0.1],
  ['crane', B.C.slate, 395, 840, 0.4, -0.6, -0.15],
  ['chef', B.C.orange, 1460, 800, 0.35, 0.55, 0.3],
];
function icons3d(ctx, t, G) {
  ICONS.forEach(([n, col, x, y, rx, ry, rz], i) => {
    const t0 = 2.3 + i * 0.12, s = pop(t, t0, { stiffness: 170, damping: 13 });
    if (s <= 0.002) return;
    const live = clamp((t - t0) / 1.5);
    const spinIn = (1 - E.outCubic(clamp((t - t0) / 1.4))) * 2.2;
    const sway = Math.sin(t * 0.9 + i * 1.3) * 0.18 * live, bob = Math.sin(t * 1.1 + i * 2.1) * 9 * live;
    const c = G.renderPiece(G.addIcon2Piece(n, col), rx + Math.sin(t * 0.7 + i) * 0.06 * live, ry + spinIn + sway, 600);
    const D = 300 * s;
    ctx.save(); ctx.translate(x, y + bob); ctx.rotate(rz + Math.sin(t * 0.6 + i) * 0.04 * live);
    ctx.drawImage(c, -D / 2, -D / 2, D, D); ctx.restore();
  });
}

function intro(ctx, t, G) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  field(ctx, t, ease(t, 0, 1.2));
  const cx = W / 2, cy = H / 2;
  // the three frames draw themselves on, from the inside out
  [[B.C.green, 365, 405, 0.25], [B.C.red, 455, 510, 0.45], [B.C.orange, 715, 600, 0.65]].forEach(([c, rx, ry, t0]) => {
    const k = ease(t, t0, t0 + 1.3, E.inOutCubic);
    if (k <= 0) return;
    const L = hexLen(rx, ry) * 1.02;
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.setLineDash([L * k, L]); hexPath(ctx, cx, cy, rx, ry, 70); ctx.stroke(); ctx.restore();
  });
  wordRing(ctx, t);
  // the white hexagon, popping up from the centre, the logo writing itself on it
  const sh = pop(t, 0.7, { stiffness: 190, damping: 14 });
  if (sh > 0.001) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sh, sh); ctx.fillStyle = '#FFFFFF';
    hexPath(ctx, 0, 0, 305, 335, 60); ctx.fill(); ctx.restore();
  }
  if (t > 1.2) { setLogoScale(0.4); drawLogo(ctx, t - 1.2, PAL, { glints: false }); }
  icons3d(ctx, t, G);
  const km = ease(t, 3.3, 4.1, E.outCubic);
  cornerMark(ctx, 130, 125, 28, km);
  cornerMark(ctx, W - 130, H - 85, 28, km, true);
  chordBar(ctx, ease(t, 3.0, 3.9, E.inOutCubic));
}

export function intro10Clips() {
  let G = null;
  const init = async () => { if (!G) { G = await import('./jubilee3d.js'); await G.initGlass(10); } };
  return { intro_prof10: { dur: 10, samples: (t) => (t < 4.5 ? 3 : 2), init, draw(ctx, t) { intro(ctx, t, G); } } };
}
