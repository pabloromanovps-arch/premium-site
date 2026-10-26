// Export every icon for the motion designer, at the best quality the sources allow:
//   VTT60_IKONKI/<group>/<name>_<colour>.svg   vector (the brand symbols' own paths, the VTT icons as true arcs)
//   VTT60_IKONKI/<group>/<name>_<colour>.png   4096 x 4096, transparent, drawn at that size
//   VTT60_IKONKI/3D/<name>.png                 the 3-D pieces rendered at 4K, transparent
//     node tehnikum60/tools/export_icons.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd(), DST = path.join(ROOT, 'VTT60_IKONKI'), PX = 4096;
const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
}).listen(0);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.error('[page error]', e.message));
await p.goto(`http://localhost:${server.address().port}/tehnikum60/index.html?render=1&clip=ico_3d_flask3d`);
await p.waitForFunction(() => window.filmReady, null, { timeout: 600000 });
const items = await p.evaluate(async (PX) => {
  const B = await import('./lib/brand.js'), I = await import('./lib/icons.js'), X = await import('./icons_export.js');
  const sym = await fetch('assets/symbols.json').then((r) => r.json());
  const out = [];
  const png = (draw) => { const c = document.createElement('canvas'); c.width = c.height = PX; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; draw(g); return c.toDataURL('image/png'); };
  const svgOf = (paths, col, vb) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="1024" height="1024"><g fill="${col}">${paths.map((q) => `<path d="${q.d}" fill-rule="${q.rule}"/>`).join('')}</g></svg>`;
  const svg = (d, col, rule, vb) => svgOf([{ d, rule }], col, vb);
  const SPECN = { flask: '01_Khimiya_neorganicheskie', molecule: '02_Khimiya_soedineniya', chef: '03_Povar_konditer', building: '04_Stroitelstvo',
    gear: '05_Montazh_oborudovaniya', car: '06_Avtotransport', weld: '07_Svarshchik' };
  const colours = (c) => ({ cvet: c, belyy: '#FFFFFF', temnyy: B.C.ink });
  for (const [n, c] of Object.entries(X.SPEC)) for (const [v, col] of Object.entries(colours(c))) {
    out.push({ file: `SPETSIALNOSTI_VTT/${SPECN[n]}_${v}.svg`, text: svgOf(X.iconSVGPaths(n, I.drawIcon), col, '-0.5 -0.5 1 1') });
    out.push({ file: `SPETSIALNOSTI_VTT/${SPECN[n]}_${v}.png`, data: png((g) => I.icon(g, n, PX / 2, PX / 2, PX * 0.9, col)) });
  }
  B.SYMBOLS.forEach((n, i) => {
    const own = sym[n].color;
    for (const [v, col] of Object.entries(colours(own))) {
      const name = `OTRASLI_Professionalitet/${String(i + 1).padStart(2, '0')}_${n}_${v}`;
      const d = n === 'atom' ? 'M1 0.5A0.5 0.5 0 1 1 0 0.5A0.5 0.5 0 1 1 1 0.5ZM0.75 0.5A0.25 0.25 0 1 0 0.25 0.5A0.25 0.25 0 1 0 0.75 0.5ZM0.62 0.5A0.12 0.12 0 1 1 0.38 0.5A0.12 0.12 0 1 1 0.62 0.5Z' : sym[n].d;
      out.push({ file: `${name}.svg`, text: svg(d, col, n === 'atom' ? 'evenodd' : 'nonzero', '0 0 1 1') });
      out.push({ file: `${name}.png`, data: png((g) => B.symbol(g, n, PX / 2, PX / 2, PX * 0.9, col)) });
    }
  });
  // the 3-D pieces, rendered with a 4x drawing buffer so the crop is native 4K
  const G = await import('./jubilee3d.js'); G.setRenderScale(4);
  const N3 = { flask3d: '01_Kolba', molecule3d: '02_Molekula', chef3d: '03_Povarskoy_kolpak', weld3d: '07_Svarochnaya_gorelka', rail3d: 'Relsy_zh_d',
    car: '06_Avtomobil', building: '04_Stroika', flask: 'Kolba_ploskaya', molecule: 'Molekula_ploskaya', weld: 'Svarka_ploskaya', chef: 'Kolpak_ploskiy' };
  for (const [n, f] of Object.entries(N3)) out.push({ file: `3D/${f}.png`, data: G.renderPiece(n, 0.4, -0.55, PX).toDataURL('image/png') });
  B.SYMBOLS.forEach((n, i) => out.push({ file: `3D/Otrasl_${String(i + 1).padStart(2, '0')}_${n}.png`, data: G.renderPiece(n, 0.4, -0.55, PX).toDataURL('image/png') }));
  G.setRenderScale(1);
  return out;
}, PX);
for (const it of items) {
  const f = path.join(DST, it.file); fs.mkdirSync(path.dirname(f), { recursive: true });
  if (it.text) fs.writeFileSync(f, it.text); else fs.writeFileSync(f, Buffer.from(it.data.split(',')[1], 'base64'));
}
console.log(`${items.length} files -> ${DST}`);
await browser.close(); server.close();
