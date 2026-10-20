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
const ctx = canvas.getContext('2d', { alpha: true });
const buf = document.createElement('canvas');
buf.width = W; buf.height = H;
const bctx = buf.getContext('2d');

await Promise.all(['400 40px Dela', '400 40px Mont', '700 40px Mont'].map((f) => document.fonts.load(f, 'АБВ60')));
await B.loadSymbols();
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
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.globalAlpha = 1; bctx.globalCompositeOperation = 'source-over';
    bctx.clearRect(0, 0, W, H);
    CLIP.draw(bctx, t0 + (k / n) * (SHUTTER / FPS), IMG);
    ctx.globalAlpha = 1 / n; ctx.globalCompositeOperation = n > 1 ? 'lighter' : 'source-over';
    ctx.drawImage(buf, 0, 0);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
};
window.DURATION = CLIP.dur; window.FPS = FPS;
window.filmReady = true;
window.seek(0);
if (!RENDER) {
  const start = performance.now();
  const loop = () => { window.seek(((performance.now() - start) / 1000) % CLIP.dur); requestAnimationFrame(loop); };
  loop();
}
