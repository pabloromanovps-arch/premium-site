// icons2.js: VTT's speciality icons, second round. The client asked for icons that read at a
// glance by their silhouette (a trowel, a tower crane, a steering wheel, a welding mask...), not
// abstract brand marks. Same contract as icons.js: each draws into a unit box centred on the
// origin with the current fill colour, fill() per part (so overlaps stay solid), evenodd for holes.
const TAU = Math.PI * 2;
const rr = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -Math.PI / 2, 0); c.lineTo(x + w, y + h - r);
  c.arc(x + w - r, y + h - r, r, 0, Math.PI / 2); c.lineTo(x + r, y + h); c.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI); c.lineTo(x, y + r); c.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5); c.closePath(); };
const disc = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };

export const DRAW2 = {
  // chemistry of inorganic substances: an Erlenmeyer flask, glass outline, liquid, bubbles rising
  flask(c) {
    c.beginPath();
    // the glass: outer outline minus the inner space above the liquid
    c.moveTo(-0.14, -0.36); c.lineTo(0.14, -0.36); c.lineTo(0.14, -0.3); c.lineTo(0.1, -0.3); c.lineTo(0.1, -0.08);
    c.lineTo(0.4, 0.36); c.quadraticCurveTo(0.45, 0.46, 0.33, 0.46); c.lineTo(-0.33, 0.46); c.quadraticCurveTo(-0.45, 0.46, -0.4, 0.36);
    c.lineTo(-0.1, -0.08); c.lineTo(-0.1, -0.3); c.lineTo(-0.14, -0.3); c.closePath();
    c.moveTo(-0.045, -0.3); c.lineTo(0.045, -0.3); c.lineTo(0.045, -0.06); c.lineTo(0.19, 0.16); c.lineTo(-0.19, 0.16); c.lineTo(-0.045, -0.06); c.closePath();
    c.fill('evenodd');
    // bubbles in the liquid's space and over the neck
    c.save(); c.globalCompositeOperation = 'destination-out';
    for (const [x, y, r] of [[-0.12, 0.34, 0.035], [0.06, 0.28, 0.045], [0.16, 0.38, 0.03]]) disc(c, x, y, r);
    c.restore();
    for (const [x, y, r] of [[0.02, -0.44, 0.03], [-0.05, -0.52, 0.022], [0.07, -0.56, 0.018]]) disc(c, x, y, r);
  },
  // production of chemical compounds: three test tubes in a rack, each with its liquid level
  tubes(c) {
    for (const [x, lv] of [[-0.25, 0.08], [0, -0.06], [0.25, 0.14]]) {
      c.beginPath();
      // the tube: rounded bottom outline, hollow above the liquid
      c.moveTo(x - 0.08, -0.42); c.lineTo(x + 0.08, -0.42); c.lineTo(x + 0.08, 0.3); c.arc(x, 0.3, 0.08, 0, Math.PI); c.closePath();
      c.moveTo(x - 0.045, -0.4); c.lineTo(x + 0.045, -0.4); c.lineTo(x + 0.045, lv); c.lineTo(x - 0.045, lv); c.closePath();
      c.fill('evenodd');
      c.beginPath(); rr(c, x - 0.1, -0.48, 0.2, 0.06, 0.02); c.fill();   // the lip
    }
    // the rack: a bar across and two feet
    c.beginPath(); rr(c, -0.46, 0.0, 0.92, 0.07, 0.02); c.fill();
    c.beginPath(); rr(c, -0.46, 0.0, 0.06, 0.5, 0.02); c.fill();
    c.beginPath(); rr(c, 0.4, 0.0, 0.06, 0.5, 0.02); c.fill();
    c.beginPath(); rr(c, -0.5, 0.44, 1.0, 0.06, 0.02); c.fill();
  },
  // cookery and confectionery: the tall chef's toque: band, a pleated crown widening upwards,
  // a row of puffs along its top
  chef(c) {
    c.beginPath();
    c.moveTo(-0.22, 0.2); c.lineTo(-0.3, -0.2); c.lineTo(0.3, -0.2); c.lineTo(0.22, 0.2); c.closePath();
    for (const x of [-0.12, 0, 0.12]) { c.moveTo(x - 0.012, -0.1); c.lineTo(x + 0.012, -0.1); c.lineTo(x + 0.01, 0.16); c.lineTo(x - 0.01, 0.16); c.closePath(); }
    c.fill('evenodd');
    for (const [x, y, r] of [[-0.24, -0.24, 0.13], [-0.08, -0.31, 0.15], [0.08, -0.31, 0.15], [0.24, -0.24, 0.13]]) disc(c, x, y, r);
    c.beginPath(); rr(c, -0.25, 0.24, 0.5, 0.18, 0.04); c.fill();            // the band
  },
  // building: a pointing trowel, seen from above, lying across the box
  trowel(c) {
    c.save(); c.rotate(Math.PI / 4);
    c.beginPath(); rr(c, -0.64, -0.075, 0.36, 0.15, 0.075); c.fill();          // the wooden handle
    c.beginPath(); rr(c, -0.3, -0.05, 0.08, 0.1, 0.015); c.fill();              // the ferrule
    c.beginPath(); c.moveTo(-0.22, -0.02); c.lineTo(-0.1, -0.02); c.lineTo(-0.1, 0.02); c.lineTo(-0.22, 0.02); c.fill();   // the neck
    c.beginPath(); c.moveTo(-0.13, -0.24); c.quadraticCurveTo(-0.2, 0, -0.13, 0.24); c.lineTo(0.66, 0); c.closePath(); c.fill();   // the blade
    c.restore();
  },
  // building: a tower crane with its jib, counterweight, cab and a hook on its line
  crane(c) {
    c.lineCap = 'round';
    // the mast as a lattice
    c.beginPath(); rr(c, -0.24, -0.3, 0.03, 0.76, 0.01); c.fill();
    c.beginPath(); rr(c, -0.1, -0.3, 0.03, 0.76, 0.01); c.fill();
    c.lineWidth = 0.022; c.beginPath();
    for (let k = 0; k < 6; k++) { const y0 = -0.3 + k * 0.126; c.moveTo(-0.225, y0); c.lineTo(-0.085, y0 + 0.126); }
    c.stroke();
    c.beginPath(); rr(c, -0.36, 0.44, 0.38, 0.06, 0.02); c.fill();              // the base
    // the jib and the counter-jib, the peak and its ties
    c.beginPath(); rr(c, -0.46, -0.34, 0.96, 0.05, 0.015); c.fill();
    c.beginPath(); c.moveTo(-0.22, -0.34); c.lineTo(-0.16, -0.5); c.lineTo(-0.1, -0.34); c.closePath(); c.fill();
    c.lineWidth = 0.018; c.beginPath(); c.moveTo(-0.16, -0.49); c.lineTo(0.48, -0.33); c.moveTo(-0.16, -0.49); c.lineTo(-0.44, -0.33); c.stroke();
    c.beginPath(); rr(c, -0.46, -0.29, 0.13, 0.1, 0.015); c.fill();             // the counterweight
    c.beginPath(); rr(c, -0.07, -0.29, 0.09, 0.08, 0.015); c.fill();            // the cab
    // the trolley, the line, the hook
    c.beginPath(); rr(c, 0.26, -0.29, 0.07, 0.03, 0.01); c.fill();
    c.lineWidth = 0.016; c.beginPath(); c.moveTo(0.295, -0.26); c.lineTo(0.295, 0.06); c.stroke();
    c.lineWidth = 0.03; c.beginPath(); c.arc(0.275, 0.1, 0.045, -Math.PI * 0.6, Math.PI * 0.95); c.stroke();
  },
  // industrial equipment: a gear with a spanner laid across it
  gearwrench(c) {
    c.save(); c.translate(-0.1, -0.08);
    c.beginPath();
    const n = 10;
    for (let i = 0; i < n * 2; i++) { const a0 = (i / (n * 2)) * TAU, a1 = ((i + 1) / (n * 2)) * TAU, r = i % 2 ? 0.27 : 0.36; c.arc(0, 0, r, a0, a1); }
    c.closePath(); c.moveTo(0.11, 0); c.arc(0, 0, 0.11, 0, TAU, true);
    c.fill('evenodd'); c.restore();
    // the spanner: open jaw at the top right, a long handle to the bottom left
    c.save(); c.translate(0.2, 0.2); c.rotate(-Math.PI / 4);
    c.beginPath(); rr(c, -0.05, -0.02, 0.1, 0.4, 0.05); c.fill();
    c.beginPath(); c.arc(0, -0.08, 0.13, 0, TAU);
    c.moveTo(-0.045, -0.24); c.lineTo(0.045, -0.24); c.lineTo(0.045, -0.08); c.lineTo(-0.045, -0.08); c.closePath();
    c.fill('evenodd');
    c.restore();
  },
  // motor vehicles: a steering wheel, rim, three spokes and the hub
  wheel(c) {
    c.beginPath(); c.arc(0, 0, 0.46, 0, TAU); c.arc(0, 0, 0.36, 0, TAU, true); c.fill('evenodd');
    c.beginPath(); c.arc(0, 0, 0.12, 0, TAU); c.fill();
    c.beginPath(); rr(c, -0.38, -0.04, 0.3, 0.1, 0.03); c.fill();
    c.beginPath(); rr(c, 0.08, -0.04, 0.3, 0.1, 0.03); c.fill();
    c.beginPath(); rr(c, -0.05, 0.08, 0.1, 0.3, 0.03); c.fill();
  },
  // welding: the welding mask, seen from the front, with its dark window
  mask(c) {
    c.beginPath();
    c.moveTo(-0.3, -0.36); c.quadraticCurveTo(0, -0.5, 0.3, -0.36); c.lineTo(0.36, 0.12);
    c.quadraticCurveTo(0.34, 0.4, 0, 0.48); c.quadraticCurveTo(-0.34, 0.4, -0.36, 0.12); c.closePath();
    rr(c, -0.2, -0.16, 0.4, 0.19, 0.03);
    c.fill('evenodd');
    c.beginPath(); rr(c, -0.15, -0.12, 0.3, 0.11, 0.02); c.fill();              // the dark glass inside the window
    // the headgear knobs at the sides
    disc(c, -0.42, -0.02, 0.06); disc(c, 0.42, -0.02, 0.06);
  },
  // welding: the electrode holder seen from the side: ribbed grip, spring lever, jaws clamping the
  // electrode, the cable behind; the electrode's tip on a metal plate, sparks flying from the arc
  holder(c) {
    const O = [0.06, -0.2], th = 0.5, co = Math.cos(th), si = Math.sin(th);
    const W2 = (x, y) => [O[0] + x * co - y * si, O[1] + x * si + y * co];
    // the cable, out of the grip's end and off the box
    c.lineWidth = 0.07; c.lineCap = 'round';
    const e = W2(0.46, 0);
    c.beginPath(); c.moveTo(e[0], e[1]); c.quadraticCurveTo(e[0] + 0.06, e[1] + 0.2, 0.36, 0.48); c.stroke();
    c.save(); c.translate(O[0], O[1]); c.rotate(th);
    // the grip
    c.beginPath(); rr(c, 0.06, -0.075, 0.42, 0.15, 0.07); c.fill();
    c.beginPath(); rr(c, -0.02, -0.05, 0.1, 0.1, 0.015); c.fill();             // the metal neck
    c.beginPath(); c.moveTo(0.0, -0.12); c.lineTo(-0.2, -0.06); c.lineTo(-0.22, -0.02); c.lineTo(-0.02, -0.04); c.closePath(); c.fill();   // upper jaw
    c.beginPath(); c.moveTo(-0.02, 0.05); c.lineTo(-0.22, 0.04); c.lineTo(-0.2, 0.08); c.lineTo(0.0, 0.06); c.closePath(); c.fill();     // lower jaw
    // the gloved fist round the grip: knuckles below, finger folds as slits, the thumb on top
    c.beginPath(); rr(c, 0.13, -0.12, 0.25, 0.27, 0.09);
    for (const x of [0.19, 0.25, 0.31]) { c.moveTo(x, 0.04); c.lineTo(x + 0.016, 0.04); c.lineTo(x + 0.016, 0.15); c.lineTo(x, 0.15); c.closePath(); }
    c.fill('evenodd');
    c.beginPath(); rr(c, 0.05, -0.16, 0.2, 0.08, 0.04); c.fill();             // the thumb
    // the gauntlet, wide, reaching up and out of the frame
    c.beginPath(); c.moveTo(0.16, -0.08); c.quadraticCurveTo(0.26, -0.13, 0.36, -0.08); c.quadraticCurveTo(0.45, -0.22, 0.44, -0.38); c.quadraticCurveTo(0.26, -0.43, 0.08, -0.38); c.quadraticCurveTo(0.08, -0.22, 0.16, -0.08); c.closePath();
    c.moveTo(0.12, -0.27); c.lineTo(0.4, -0.27); c.lineTo(0.4, -0.25); c.lineTo(0.12, -0.25); c.closePath();   // the cuff's seam
    c.fill('evenodd');
    c.restore();
    // the electrode, clamped across the jaws, down to the plate
    const j = W2(-0.19, 0.01), tip = [-0.3, 0.17];
    c.lineWidth = 0.034; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(j[0] + 0.02, j[1] - 0.04); c.lineTo(tip[0], tip[1]); c.stroke();
    // the plate being welded
    c.beginPath(); rr(c, -0.5, 0.22, 0.48, 0.06, 0.01); c.fill();
    // the arc: a bright point and sparks thrown up and out
    disc(c, tip[0], tip[1] + 0.02, 0.035);
    c.lineWidth = 0.02; c.lineCap = 'round'; c.beginPath();
    for (const [a, r0, l] of [[-2.9, 0.06, 0.12], [-2.4, 0.06, 0.16], [-1.9, 0.06, 0.1], [-0.6, 0.06, 0.12], [-0.2, 0.06, 0.15], [0.2, 0.06, 0.09], [-3.3, 0.06, 0.1]]) {
      c.moveTo(tip[0] + Math.cos(a) * r0, tip[1] + 0.02 + Math.sin(a) * r0); c.lineTo(tip[0] + Math.cos(a) * (r0 + l), tip[1] + 0.02 + Math.sin(a) * (r0 + l));
    }
    c.stroke();
    for (const [x, y, r] of [[-0.12, 0.08, 0.014], [-0.47, 0.06, 0.012], [-0.08, 0.15, 0.01]]) disc(c, x, y, r);
  },
};
export const ICONS2 = Object.keys(DRAW2);
export function icon2(ctx, name, x, y, size, color, s = 1) {
  if (s <= 0.001) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(size * s, size * s);
  ctx.fillStyle = color; ctx.strokeStyle = color; DRAW2[name](ctx); ctx.restore();
}
export const drawIcon2 = (ctx, name) => DRAW2[name](ctx);
