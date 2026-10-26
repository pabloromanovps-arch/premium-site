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
  // cookery and confectionery: the classic pleated toque
  chef(c) {
    c.beginPath();
    c.arc(-0.24, -0.06, 0.2, Math.PI * 0.5, Math.PI * 1.55);
    c.arc(-0.06, -0.26, 0.2, Math.PI * 1.05, Math.PI * 1.75);
    c.arc(0.14, -0.24, 0.2, Math.PI * 1.25, Math.PI * 1.95);
    c.arc(0.25, -0.04, 0.19, Math.PI * 1.45, Math.PI * 2.5);
    c.lineTo(0.27, 0.16); c.lineTo(-0.27, 0.16); c.closePath(); c.fill();
    // the band, with two pleat slits
    c.beginPath(); rr(c, -0.29, 0.21, 0.58, 0.25, 0.04);
    c.moveTo(-0.1, 0.25); c.lineTo(-0.07, 0.25); c.lineTo(-0.07, 0.42); c.lineTo(-0.1, 0.42); c.closePath();
    c.moveTo(0.07, 0.25); c.lineTo(0.1, 0.25); c.lineTo(0.1, 0.42); c.lineTo(0.07, 0.42); c.closePath();
    c.fill('evenodd');
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
  // welding: an electrode holder gripping an electrode, a few sparks at its tip
  holder(c) {
    c.save(); c.rotate(-Math.PI / 4);
    c.beginPath(); rr(c, -0.075, 0.02, 0.15, 0.44, 0.06); c.fill();             // the insulated grip
    c.beginPath(); rr(c, -0.06, -0.12, 0.12, 0.16, 0.02); c.fill();             // the jaws
    c.beginPath(); rr(c, -0.09, -0.16, 0.18, 0.05, 0.02); c.fill();
    c.restore();
    // the electrode, held across the jaws, down to the right
    c.save(); c.translate(-0.03, -0.03); c.rotate(Math.PI / 4 + 0.35);
    c.beginPath(); rr(c, -0.015, 0, 0.03, 0.42, 0.012); c.fill();
    c.restore();
    c.lineWidth = 0.022; c.lineCap = 'round'; c.beginPath();
    for (const [a, l] of [[1.9, 0.1], [2.4, 0.12], [2.9, 0.1], [3.4, 0.09], [1.4, 0.08]]) { const x = -0.41, y = 0.15; c.moveTo(x + Math.cos(a) * 0.04, y + Math.sin(a) * 0.04); c.lineTo(x + Math.cos(a) * (0.04 + l), y + Math.sin(a) * (0.04 + l)); }
    c.stroke();
  },
  // welding: a canvas work glove, thumb up
  glove(c) {
    c.beginPath(); rr(c, -0.24, -0.06, 0.44, 0.36, 0.1);
    // the folded fingers: three seams on the right
    for (const y of [0.04, 0.13, 0.22]) { c.moveTo(0.05, y); c.lineTo(0.2, y); c.lineTo(0.2, y + 0.02); c.lineTo(0.05, y + 0.02); c.closePath(); }
    c.fill('evenodd');
    c.save(); c.translate(-0.13, -0.05); c.rotate(-0.15);
    c.beginPath(); rr(c, -0.075, -0.4, 0.15, 0.44, 0.075); c.fill(); c.restore();   // the thumb
    c.beginPath(); rr(c, -0.28, 0.32, 0.52, 0.18, 0.03);                            // the cuff, with its stitch line
    c.moveTo(-0.24, 0.39); c.lineTo(0.2, 0.39); c.lineTo(0.2, 0.41); c.lineTo(-0.24, 0.41); c.closePath();
    c.fill('evenodd');
  },
};
export const ICONS2 = Object.keys(DRAW2);
export function icon2(ctx, name, x, y, size, color, s = 1) {
  if (s <= 0.001) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(size * s, size * s);
  ctx.fillStyle = color; ctx.strokeStyle = color; DRAW2[name](ctx); ctx.restore();
}
export const drawIcon2 = (ctx, name) => DRAW2[name](ctx);
