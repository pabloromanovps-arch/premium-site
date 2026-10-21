// Render one alpha clip frame-exact and encode it with its alpha channel.
//
//   node tehnikum60/tools/render.mjs --clip <name> [--fps 50] [--workers 4] [--at 0.5,2]
//
// From the project folder. Writes out/tehnikum60/<clip>/frames/*.png (RGBA), then
//   out/tehnikum60/<clip>.mov          ProRes 4444 + alpha (yuva444p10le): for the edit
//   out/tehnikum60/<clip>_preview.mp4  the same over a dark grey: for looking at it anywhere
// --at renders stills only (out/tehnikum60/<clip>/still_<t>.png) for checking a look.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const CLIP = opt('clip', 'logo'), FPS = Number(opt('fps', 50)), WORKERS = Number(opt('workers', 4));
const AT = opt('at', null);
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'out', 'tehnikum60', CLIP);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b);
  });
}).listen(0);
const URL = `http://localhost:${server.address().port}/tehnikum60/index.html?render=1&clip=${CLIP}&fps=${FPS}`;

const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function page() {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', (e) => console.error('[page error]', e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  await p.goto(URL);
  await p.waitForFunction(() => window.filmReady, null, { timeout: 600000 });
  return p;
}
const grab = (p, t) => p.evaluate((t) => { window.seek(t); return document.getElementById('film').toDataURL('image/png'); }, t);
const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));

if (AT) {
  const p = await page();
  for (const t of AT.split(',').map(Number)) save(path.join(OUT, `still_${t.toFixed(2)}.png`), await grab(p, t));
  console.log(`stills -> ${OUT}`);
} else {
  const p0 = await page();
  const dur = await p0.evaluate(() => window.DURATION);
  const N = Math.round(dur * FPS);
  const pages = [p0, ...(await Promise.all(Array.from({ length: WORKERS - 1 }, page)))];
  let done = 0; const t0 = Date.now();
  await Promise.all(pages.map(async (p, w) => {
    for (let i = w; i < N; i += WORKERS) {
      save(path.join(OUT, 'frames', `f_${String(i).padStart(5, '0')}.png`), await grab(p, i / FPS));
      if (++done % 25 === 0) console.log(`${CLIP}: ${done}/${N} frames, ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`);
    }
  }));
  const seq = path.join(OUT, 'frames', 'f_%05d.png');
  const mov = path.join(ROOT, 'out', 'tehnikum60', `${CLIP}.mov`);
  const prev = path.join(ROOT, 'out', 'tehnikum60', `${CLIP}_preview.mp4`);
  const run = (a) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: 'inherit' }); if (r.status) process.exit(r.status); };
  // premultiplied alpha: edges stay smooth in players and edits that ignore alpha or read it as
// premultiplied (the common default); a straight-alpha file shows hard stair-stepped edges there
  run(['-framerate', String(FPS), '-i', seq, '-vf', 'format=gbrap16le,premultiply=inplace=1,format=yuva444p10le',
    '-c:v', 'prores_ks', '-profile:v', '4444xq', '-pix_fmt', 'yuva444p10le',
    '-alpha_bits', '16', '-vendor', 'apl0', mov]);   // ProRes 4444 XQ, 16-bit alpha: clean edges in the edit
  run(['-f', 'lavfi', '-i', `color=c=0x2b2b30:s=1920x1080:r=${FPS}`, '-framerate', String(FPS), '-i', seq,
    '-filter_complex', '[0][1]overlay=shortest=1,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-movflags', '+faststart', prev]);
  console.log(`-> ${mov}\n-> ${prev}`);
}
await browser.close(); server.close();
