// United League Europe 3x3 — logo reveal: pure function of time. window.seek(t) paints frame t (see lib/motion.js).
// Timing is in beats (u) on the measured grid (120 bpm, beat = 0.5 s); docs/shotlist.md is the plan.
// The badge is the supplied logo, traced into parts (tools/trace_logo.py) and built in 3-D (sets/badge.js).
import * as M from './lib/motion.js';
import * as G from './lib/gl.js';
import { badgeSet } from './sets/badge.js';

const { TS } = M;

// Brand tokens, sampled from the supplied logo: gold on near-black. One accent: the gold.
const C = { gold: '#D6B161', ink: '#1B1A1F' };
const GOLD_3D = '#C9A048';   // the brand gold, a touch deeper: ACES tone mapping lifts and desaturates it

// Every visual accent: [beat, label, sfx, opts]
const HITS = [
  [0, 'coin catches the light', 'swell', { len: 0.9 }],
  [2, 'inner ring slams down', 'thud', { pitch: 70, to: 40 }],
  [3.6, 'doll dropped', 'whoosh', { len: 0.5, from: 2400, to: 500 }],
  [5, 'doll bounce 1', 'thud', { pitch: 110, to: 60 }],
  [6, 'doll bounce 2', 'thud', { pitch: 140, to: 80, gain: 0.3 }],
  [6.5, 'doll settles', 'tick'],
  [7, '3x3 stamp', 'thud', { pitch: 60, to: 35 }],
  [8, 'drop: letters + arcs', 'impact'],
  [8.5, 'letters run', 'tick'],
  [9, 'letters run', 'tick'],
  [9.5, 'letters run', 'tick'],
  [10.1, 'flip', 'whoosh', { len: 0.7, from: 400, to: 3000 }],
  [12, 'badge lands front', 'impact'],
  [12.5, 'shine', 'bell', { pitch: 'D6' }],
];

let SET = null, GLOW = null;
// cheap bloom: the 3-D frame shrunk to 1/8, crushed to its highlights, blurred, added back
function glow(ctx, k = 0.4) {
  const g = GLOW.getContext('2d'), w = GLOW.width, h = GLOW.height;
  g.clearRect(0, 0, w, h);
  g.filter = 'brightness(0.55) contrast(3.2) saturate(1.3) blur(1.5px)';
  g.drawImage(G.R.domElement, 0, 0, w / 2, h / 2);         // tight halo, top-left quarter
  g.filter = 'brightness(0.55) contrast(3.2) saturate(1.3) blur(5px)';
  g.drawImage(G.R.domElement, w / 2, 0, w / 2, h / 2);     // wide halo, top-right quarter
  g.filter = 'none';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = k; ctx.drawImage(GLOW, 0, 0, w / 2, h / 2, 0, 0, M.W, M.H);
  ctx.globalAlpha = k * 0.7; ctx.drawImage(GLOW, w / 2, 0, w / 2, h / 2, 0, 0, M.W, M.H);
  ctx.restore();
}
M.film({
  hits: HITS,
  // sub-frame motion blur where things move fast, fewer samples on the still hold (software WebGL is slow)
  samples: (t) => (t < TS(12.6) ? 8 : 3),
  async init() {
    await G.initGL({ exposure: 1.05 });
    const P = await fetch('assets/logo/parts.json').then((r) => r.json());
    SET = badgeSet({ ...P, goldHex: GOLD_3D, inkHex: C.ink });
    GLOW = document.createElement('canvas'); GLOW.width = M.W / 4; GLOW.height = M.H / 4;   // two 1/8-size quarters
  },
  draw(ctx, u, t) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, M.W, M.H);
    G.renderSet(ctx, SET, t, u);
    glow(ctx);
  },
  post(ctx, u) {
    // fine film grain, seeded per frame (after the blur so it isn't averaged away)
    const f = Math.floor(u * 1000);
    ctx.globalAlpha = 0.045;
    for (let i = 0; i < 900; i++) {
      const x = M.hash01(i, f) * M.W, y = M.hash01(i + 7777, f) * M.H;
      ctx.fillStyle = M.hash01(i + 333, f) > 0.5 ? '#fff' : '#000';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  },
});
