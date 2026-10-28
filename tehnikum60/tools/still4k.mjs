// A clip's frame at 3840 x 2160 (the supersampled canvas itself): node tehnikum60/tools/still4k.mjs <clip> <t> <out.png>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright';
const [CLIP, T, OUT] = process.argv.slice(2), ROOT = process.cwd();
const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg' };
const sv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const p = await b.newPage();
p.on('pageerror', (e) => console.error('[page error]', e.message));
await p.goto(`http://localhost:${sv.address().port}/tehnikum60/index.html?render=1&clip=${CLIP}`);
await p.waitForFunction(() => window.filmReady, null, { timeout: 600000 });
const d = await p.evaluate((t) => window.bigPNG(t), Number(T));
fs.writeFileSync(OUT, Buffer.from(d.split(',')[1], 'base64')); console.log('written', OUT);
await b.close(); sv.close();
