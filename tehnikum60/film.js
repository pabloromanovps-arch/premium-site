// VTT 60 graphics on alpha: ?clip=<name> (clips.js). Every frame is a pure function of t: window.seek(t).
// tools/render.mjs renders a clip to ProRes 4444 with alpha. Flat shapes only: the alpha is clean.
import * as M from './lib/motion.js';
import * as B from './lib/brand.js';
import { CLIPS } from './clips.js';

const params = new URLSearchParams(location.search);
const CLIP = CLIPS[params.get('clip') || 'zastavka'];
const RENDER = params.get('render') === '1';
const FPS = Number(params.get('fps') || 50);
const SHUTTER = 0.5;
const { W, H } = M;

const canvas = document.getElementById('film');
canvas.width = W; canvas.height = H;
if (RENDER) document.body.classList.add('render');
const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
// every sample is drawn at SS x the size and filtered down: smooth slanted edges, no stair steps
const SS = RENDER ? 2 : 1;
B.setSS(SS);
const big = document.createElement('canvas');
big.width = W * SS; big.height = H * SS;
const gctx = big.getContext('2d');
const buf = document.createElement('canvas');
buf.width = W; buf.height = H;
const bctx = buf.getContext('2d');
bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = 'high';

// Straight-alpha output: in a partly transparent edge pixel the canvas's 8-bit premultiplied colour,
// divided back by a small alpha, comes out as noise. Give every such pixel the colour of its most
// opaque neighbour (the shape's own flat colour); keep its alpha. Fully transparent pixels get black.
function cleanEdges() {
  const img = ctx.getImageData(0, 0, W, H), d = img.data, src = new Uint8ClampedArray(d);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, a = src[i + 3];
    if (a === 255) continue;
    if (a === 0) { d[i] = d[i + 1] = d[i + 2] = 0; continue; }
    let best = -1, bj = i;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = (yy * W + xx) * 4, aj = src[j + 3];
      if (aj > best) { best = aj; bj = j; }
    }
    if (best > a) { d[i] = src[bj]; d[i + 1] = src[bj + 1]; d[i + 2] = src[bj + 2]; }
  }
  ctx.putImageData(img, 0, 0);
}

await Promise.all(['400 40px Dela', '400 40px Mont', '700 40px Mont'].map((f) => document.fonts.load(f, 'АБВ60')));
await B.loadSymbols();
await (await import('./jubilee.js')).loadJubilee();
await (await import('./lib/sample.js')).loadSample();
if (CLIP.init) await CLIP.init();
const IMG = {};
await Promise.all(Object.entries({ logo: 'assets/logo_vtt.png' }).map(async ([k, src]) => {
  const im = new Image(); im.src = src; await im.decode(); IMG[k] = im;
}));

// motion blur on a transparent canvas: 'lighter' at 1/n sums premultiplied samples = their average
window.seek = (t) => {
  const t0 = t + 0.5 / FPS;
  const n = RENDER && params.get('blur') !== '0' ? CLIP.samples(t0) : 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  for (let k = 0; k < n; k++) {
    gctx.setTransform(SS, 0, 0, SS, 0, 0); gctx.globalAlpha = 1; gctx.globalCompositeOperation = 'source-over';
    gctx.clearRect(0, 0, W, H);
    CLIP.draw(gctx, t0 + (k / n) * (SHUTTER / FPS), IMG);
    bctx.clearRect(0, 0, W, H);
    bctx.drawImage(big, 0, 0, W, H);
    ctx.globalAlpha = 1 / n; ctx.globalCompositeOperation = n > 1 ? 'lighter' : 'source-over';
    ctx.drawImage(buf, 0, 0);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (RENDER) cleanEdges();
};
window.DURATION = CLIP.dur; window.FPS = FPS;
window.filmReady = true;
window.seek(0);
if (!RENDER) {
  const start = performance.now();
  const loop = () => { window.seek(((performance.now() - start) / 1000) % CLIP.dur); requestAnimationFrame(loop); };
  loop();
}
