// sample.js: one real stand-in photo (from the designer's layout) for every photo window in the
// style frames, so the layouts are judged on a real face rather than a grey silhouette.
let IMG = null;
export async function loadSample() {
  IMG = new Image(); IMG.src = 'assets/sample_person.jpg'; await IMG.decode();
}
// fill the box (x, y, w, h) with the photo, cropped to cover it, the face kept in the upper part
export function sampleCover(ctx, x, y, w, h) {
  if (!IMG) return;
  const iw = IMG.width, ih = IMG.height, s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s;
  const sx = (iw - sw) / 2, sy = Math.min(ih - sh, Math.max(0, (ih - sh) * 0.2));
  ctx.drawImage(IMG, sx, sy, sw, sh, x, y, w, h);
}
