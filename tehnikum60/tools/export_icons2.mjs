// Export the second round of VTT's speciality icons (lib/icons2.js, the seven the client approved):
//   VTT60_IKONKI_v2/VEKTOR_SVG/<file>_<colour>.svg   vector; strokes stay true SVG strokes, cuts are masks
//   VTT60_IKONKI_v2/PNG_4096/<file>_<colour>.png     4096 x 4096, transparent
//   VTT60_IKONKI_v2/3D_4K/<file>_<angle>.png        the 3-D icons at 4K on transparency (with --3d)
//     node tehnikum60/tools/export_icons2.mjs [--3d]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ONLY3D = process.argv.includes('--3d');
const ROOT = process.cwd(), DST = path.join(ROOT, 'VTT60_IKONKI_v2'), PX = 4096;
const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
}).listen(0);
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.error('[page error]', e.message));
await p.goto(`http://localhost:${server.address().port}/tehnikum60/index.html?render=1&clip=${ONLY3D ? 'ico2_3d_sheet' : 'ico2_sheet'}`);
await p.waitForFunction(() => window.filmReady, null, { timeout: 600000 });
const items = await p.evaluate(async ([PX, ONLY3D]) => {
  const B = await import('./lib/brand.js'), I = await import('./lib/icons2.js'), X = await import('./icons_export.js');
  // the icons reach a little past their unit box (bubbles over the flask, the crane's jib): the
  // view is 1.2 units, and the PNG draws the icon at the same share of its width
  const VB = 1.2, out = [];
  const svgOf = (paths, col) => {
    let defs = '';
    const body = paths.map((q, i) => {
      const paint = q.stroke ? `fill="none" stroke="${col}" stroke-width="${+q.stroke.toFixed(5)}" stroke-linecap="${q.cap}"` : `fill="${col}" fill-rule="${q.rule}"`;
      if (!q.cuts) return `<path d="${q.d}" ${paint}/>`;
      defs += `<mask id="c${i}" maskUnits="userSpaceOnUse" x="-1" y="-1" width="2" height="2"><rect x="-1" y="-1" width="2" height="2" fill="#fff"/>${q.cuts.map((k) => `<path d="${k.d}" fill-rule="${k.rule}" fill="#000"/>`).join('')}</mask>`;
      return `<path d="${q.d}" ${paint} mask="url(#c${i})"/>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-VB / 2} ${-VB / 2} ${VB} ${VB}" width="1200" height="1200">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
  };
  const png = (n, col) => { const c = document.createElement('canvas'); c.width = c.height = PX; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; I.icon2(g, n, PX / 2, PX / 2, PX / VB, col); return c.toDataURL('image/png'); };
  if (ONLY3D) {
    // three turns of each: nearly front on, turned to the left, turned to the right
    const G = await import('./jubilee3d.js'); G.setRenderScale(4);
    X.SPEC2.forEach(([n, c], i) => {
      const key = G.addIcon2Piece(n, c);
      for (const [v, rx, ry] of [['anfas', 0.12, -0.18], ['povorot_vlevo', 0.35, -0.5], ['povorot_vpravo', 0.35, 0.5]])
        out.push({ file: `3D_4K/${X.SPEC2_FILES[i]}_${v}.png`, data: G.renderPiece(key, rx, ry, PX).toDataURL('image/png') });
    });
    G.setRenderScale(1);
    return out;
  }
  X.SPEC2.forEach(([n, c], i) => {
    for (const [v, col] of Object.entries({ cvet: c, belyy: '#FFFFFF', temnyy: B.C.ink })) {
      const f = X.SPEC2_FILES[i];
      out.push({ file: `VEKTOR_SVG/${f}_${v}.svg`, text: svgOf(X.iconSVGPaths(n, I.drawIcon2, { native: true }), col) });
      out.push({ file: `PNG_4096/${f}_${v}.png`, data: png(n, col) });
    }
  });
  return out;
}, [PX, ONLY3D]);
for (const it of items) {
  const f = path.join(DST, it.file); fs.mkdirSync(path.dirname(f), { recursive: true });
  if (it.text) fs.writeFileSync(f, it.text); else fs.writeFileSync(f, Buffer.from(it.data.split(',')[1], 'base64'));
}
console.log(`${items.length} files -> ${DST}`);
await browser.close(); server.close();
