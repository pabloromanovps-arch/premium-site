// icons.js: flat silhouettes for VTT's specialities, drawn in the brandbook's symbol manner (one
// solid colour, bold simple masses, the 15 deg cut where it fits). Each fills a unit box centred on
// the origin; icon(ctx, name, x, y, size, color).
import { icon2 } from './icons2.js';
const TAU = Math.PI * 2;

const DRAW = {
  // chemistry: a conical flask with a level of liquid cut at 15 deg
  flask(c) {
    c.beginPath();
    c.moveTo(-0.13, -0.5); c.lineTo(0.13, -0.5); c.lineTo(0.13, -0.42); c.lineTo(0.09, -0.42);
    c.lineTo(0.09, -0.14); c.lineTo(0.42, 0.38); c.quadraticCurveTo(0.47, 0.5, 0.34, 0.5);
    c.lineTo(-0.34, 0.5); c.quadraticCurveTo(-0.47, 0.5, -0.42, 0.38); c.lineTo(-0.09, -0.14);
    c.lineTo(-0.09, -0.42); c.lineTo(-0.13, -0.42); c.closePath();
    // the empty upper part is a hole: liquid fills below a slanted line
    c.moveTo(-0.05, -0.38); c.lineTo(-0.05, -0.1); c.lineTo(-0.2, 0.13); c.lineTo(0.24, 0.02);
    c.lineTo(0.05, -0.1); c.lineTo(0.05, -0.38); c.closePath();
    c.fill('evenodd');
  },
  // chemical compounds: a molecule, three atoms and two bonds
  molecule(c) {
    const at = [[-0.28, 0.22, 0.2], [0.3, 0.26, 0.17], [0.02, -0.28, 0.22]];
    c.lineWidth = 0.11; c.lineCap = 'round';
    c.beginPath(); c.moveTo(at[0][0], at[0][1]); c.lineTo(at[2][0], at[2][1]); c.lineTo(at[1][0], at[1][1]); c.stroke();
    for (const [x, y, r] of at) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  },
  // cookery and confectionery: a chef's toque
  chef(c) {
    c.beginPath();
    c.arc(-0.22, -0.08, 0.2, Math.PI * 0.7, Math.PI * 1.6);
    c.arc(0.0, -0.22, 0.24, Math.PI * 1.15, Math.PI * 1.85);
    c.arc(0.22, -0.08, 0.2, Math.PI * 1.4, Math.PI * 2.3);
    c.lineTo(0.28, 0.24); c.lineTo(-0.28, 0.24); c.closePath(); c.fill();
    c.fillRect(-0.3, 0.3, 0.6, 0.16);
  },
  // building and operating structures: a block of floors with a crane jib
  building(c) {
    c.fillRect(-0.42, -0.06, 0.46, 0.56);
    c.fillRect(0.1, 0.12, 0.32, 0.38);
    c.fillRect(-0.3, -0.5, 0.06, 0.44);
    c.beginPath(); c.moveTo(-0.38, -0.5); c.lineTo(0.42, -0.5); c.lineTo(0.42, -0.42); c.lineTo(-0.38, -0.42); c.fill();
    c.fillRect(0.3, -0.42, 0.03, 0.22);
    c.fillRect(0.25, -0.22, 0.13, 0.08);
  },
  // industrial equipment: a gear (the brand's own machine-building symbol is used instead when asked)
  gear(c) {
    c.beginPath();
    const n = 9;
    for (let i = 0; i < n * 2; i++) {
      const a0 = (i / (n * 2)) * TAU, a1 = ((i + 1) / (n * 2)) * TAU, r = i % 2 ? 0.36 : 0.5;
      c.arc(0, 0, r, a0, a1);
    }
    c.closePath();
    c.moveTo(0.16, 0); c.arc(0, 0, 0.16, 0, TAU, true);
    c.fill('evenodd');
  },
  // motor vehicles: a car in profile
  car(c) {
    c.beginPath();
    c.moveTo(-0.5, 0.18); c.lineTo(-0.46, -0.02); c.lineTo(-0.22, -0.06); c.lineTo(-0.08, -0.26);
    c.lineTo(0.22, -0.26); c.lineTo(0.36, -0.06); c.lineTo(0.48, -0.02); c.lineTo(0.5, 0.18); c.closePath();
    // the window is a hole in the same path (evenodd), so nothing under the icon is erased
    c.moveTo(-0.02, -0.19); c.lineTo(0.18, -0.19); c.lineTo(0.27, -0.07); c.lineTo(-0.11, -0.07); c.closePath();
    c.fill('evenodd');
    for (const x of [-0.27, 0.27]) {
      c.beginPath(); c.arc(x, 0.2, 0.13, 0, TAU); c.fill();
    }
  },
  // welding: a torch with a spark star
  weld(c) {
    c.save(); c.rotate(-Math.PI / 4);
    c.fillRect(-0.06, -0.08, 0.12, 0.62);
    c.fillRect(-0.1, 0.32, 0.2, 0.2);
    c.beginPath(); c.moveTo(-0.06, -0.08); c.lineTo(0.06, -0.08); c.lineTo(0.02, -0.22); c.lineTo(-0.02, -0.22); c.fill();
    c.restore();
    c.save(); c.translate(-0.22, -0.24);
    c.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 0.07 : 0.24; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.fill(); c.restore();
  },
};
export const ICONS = Object.keys(DRAW);
// Round 2: the client replaced the whole set with icons that read by their silhouette
// (lib/icons2.js). Every graphic still asks for the old names; they now draw the new icons.
export const OLD2NEW = { flask: 'flask', molecule: 'tubes', chef: 'chef', building: 'crane', gear: 'gearwrench', car: 'wheel', weld: 'holder' };
export function icon(ctx, name, x, y, size, color, s = 1) { icon2(ctx, OLD2NEW[name] ?? name, x, y, size, color, s); }
// the first-round drawings, kept for reference
export function iconV1(ctx, name, x, y, size, color, s = 1) {
  if (s <= 0.001) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(size * s, size * s);
  ctx.fillStyle = color; ctx.strokeStyle = color;
  DRAW[name](ctx);
  ctx.restore();
}

// the bare drawing of one first-round icon in its unit box, for code that records paths
export const drawIcon = (ctx, name) => DRAW[name](ctx);
