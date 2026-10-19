// Alpha elements for United League Europe 3x3: the logo and three captions, each its own clip on a
// transparent background. ?clip=logo|c1|c2|c3. Every frame is a pure function of t: window.seek(t).
// tools/render_alpha.mjs renders a clip to ProRes 4444 with alpha.
import * as M from './lib/motion.js';
import * as G from './lib/gl.js';
import * as LOGO from './sets/logo.js';
import * as CAP from './sets/caption.js';

// The captions, word for word as supplied; broken into short lines so the type can be set large.
export const CAPTIONS = {
  c1: ['10 СТРАН.', '15 ИНОСТРАННЫХ', 'КОМАНД'],
  c2: ['ТЕХНОЛОГИЧЕСКИЕ', 'РЕШЕНИЯ', 'МИРОВОГО УРОВНЯ'],
  c3: ['2,2 МЛН', 'ПРОСМОТРОВ'],
  // ролик 2: театр в Перми — форум «Россия — спортивная держава»
  rolik2_1: ['ПЕРВЫЙ В МИРЕ', 'БАСКЕТБОЛЬНЫЙ', 'СПЕКТАКЛЬ'],
  rolik2_2: ['СУДЬИ — ДИРИЖЕРЫ.', 'ИГРОКИ — АРТИСТЫ'],
  rolik2_3: ['ЭКСКЛЮЗИВНАЯ', 'АУДИТОРИЯ.', 'ПРЕМИУМ-ФОРМАТ'],
  // ролик 3: театр в Питере — Буфф
  rolik3_1: ['ПЕРВЫЙ В МИРЕ', 'ФОРМАТ НА', 'ТЕАТРАЛЬНОЙ СЦЕНЕ'],
  rolik3_2: ['СПОРТ КАК', 'ИСКУССТВО'],
  rolik3_3: ['SHOW MUST GO ON'],
  // ролик 4: трансляция суперфинала — второй день
  rolik4_1: ['8 КАМЕР.', 'КАМЕРА-ДРОН'],
  rolik4_2: ['ТРАНСЛЯЦИЯ', 'МИРОВОГО УРОВНЯ'],
  rolik4_3: ['МАТЧ ТВ. ВК.', 'YOUTUBE'],
  // ролик 5: большой спортивный концерт
  rolik5_1: ['СПОРТ КАК', 'БОЛЬШОЕ ШОУ'],
  rolik5_2: ['СИНТЕЗ МУЗЫКИ', 'И СПОРТА'],
  rolik5_3: ['МАСШТАБ, КОТОРЫЙ', 'СОБИРАЕТ ТЫСЯЧИ'],
  // ролик 6: матч друзей суперфинала — production
  // 7 words: split at its own full stop into two titles (brief: no more than 5-6 words per title)
  rolik6_1a: ['МАТЧ ДРУЗЕЙ.'],
  rolik6_1b: ['ЗВЕЗДЫ И ПАРТНЕРЫ', 'НА ПЛОЩАДКЕ'],
  rolik6_2: ['ПРОДАКШЕН', 'МИРОВОГО УРОВНЯ'],
  rolik6_3: ['СОБЫТИЕ, КОТОРОЕ', 'ОБЪЕДИНЯЕТ'],
};

const params = new URLSearchParams(location.search);
const CLIP = params.get('clip') || 'logo';
const RENDER = params.get('render') === '1';
const FPS = Number(params.get('fps') || 50);
const SHUTTER = 0.5;
const { W, H } = M;

const canvas = document.getElementById('film');
canvas.width = W; canvas.height = H;
if (RENDER) document.body.classList.add('render');
const ctx = canvas.getContext('2d', { alpha: true });
const glowCv = document.createElement('canvas');
glowCv.width = W / 4; glowCv.height = H / 4;

// highlights only, shrunk, blurred, added back: a soft halo that also reads over footage
function glow(k = 0.32) {
  const g = glowCv.getContext('2d'), w = glowCv.width, h = glowCv.height;
  g.clearRect(0, 0, w, h);
  g.filter = 'brightness(0.55) contrast(3.2) saturate(1.3) blur(1.5px)';
  g.drawImage(canvas, 0, 0, w / 2, h / 2);
  g.filter = 'brightness(0.55) contrast(3.2) saturate(1.3) blur(5px)';
  g.drawImage(canvas, w / 2, 0, w / 2, h / 2);
  g.filter = 'none';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = k; ctx.drawImage(glowCv, 0, 0, w / 2, h / 2, 0, 0, W, H);
  ctx.globalAlpha = k * 0.7; ctx.drawImage(glowCv, w / 2, 0, w / 2, h / 2, 0, 0, W, H);
  ctx.restore();
}
// a thin warm anamorphic streak through the centre
function flare({ k, x, y }) {
  if (k < 0.004) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x * W, y * H); ctx.scale(1, 0.012);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.42);
  g.addColorStop(0, `rgba(255,236,190,${0.9 * k})`); g.addColorStop(0.25, `rgba(230,180,90,${0.35 * k})`); g.addColorStop(1, 'rgba(200,140,60,0)');
  ctx.fillStyle = g; ctx.fillRect(-W, -W * 0.5, 2 * W, W);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const c = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, 70);
  c.addColorStop(0, `rgba(255,240,205,${0.7 * k})`); c.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = c; ctx.fillRect(x * W - 80, y * H - 80, 160, 160);
  ctx.restore();
}

let SET, DUR;
async function init() {
  if (CLIP === 'logo') {
    await G.initGL({ exposure: 1.05 });
    SET = LOGO.logoSet(await fetch('assets/logo/parts.json').then((r) => r.json()));
    DUR = LOGO.DURATION;
  } else {
    await G.initGL({ exposure: 1.05, font: 'fonts/display.ttf' });
    // one type size for every caption, fixed by the first three (already delivered): their widest
    // plaque fills 84 % of the width, the tallest <= 78 % of the height; later lines stay within ~92 %
    const plates = ['c1', 'c2', 'c3'].map((k) => CAP.plateFor(CAPTIONS[k]));
    SET = CAP.captionSet(CAPTIONS[CLIP], { w: Math.max(...plates.map((p) => p.w)), h: Math.max(...plates.map((p) => p.h)), fw: 0.84, fh: 0.78 });
    DUR = CAP.DURATION;
  }
}

// motion blur on a transparent canvas: 'lighter' at 1/n sums premultiplied samples = their average
window.seek = (t) => {
  const t0 = t + 0.5 / FPS;
  const n = RENDER && params.get('blur') !== '0' ? SET.samples(t0) : 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  for (let k = 0; k < n; k++) G.renderSet(ctx, SET, t0 + (k / n) * (SHUTTER / FPS), 0, { alpha: 1 / n, blend: 'lighter' });
  glow();
  flare(SET.flare(t0));
};

await init();
window.DURATION = DUR; window.FPS = FPS;
window.filmReady = true;
window.seek(0);
if (!RENDER) {
  let start = performance.now();
  const loop = () => { window.seek(((performance.now() - start) / 1000) % DUR); requestAnimationFrame(loop); };
  loop();
}
