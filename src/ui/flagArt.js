// @ts-check
// SHIP-COLOURS (2026-10-17, the owner: "Finally, a fully customizable flag with the option to use your guild insignia";
// bible/03-World/Naval-Refit.md SHIP-COLOURS) - A SHIP'S FLAG, DRAWN. The port's own art, in the heraldry's own hand
// (ui/heraldryArt.js - its divisions, its forty devices and their holes, painted as a guild's banner paints them), so a
// guild's arms flown at a masthead are the arms on its hall's door.
//
// The flag is a 150 x 100 box, its HOIST (the edge on the staff) at the left and its FLY to the right: the field, a
// divided field's second part, the border stroked inside the edge, and the device - at the cloth's middle on a flag and
// a swallowtail, near the hoist on a pennant and a burgee (their fly tapers to a point). One drawing, two faces: an SVG
// string for the designer (ui/shipColoursWindow.js) and a canvas for the cloth at the masthead (render/shipFlagPass.js).
import { HERALDRY_COLOURS } from '../net/heraldryLaw.js';
import { divisionPath, divisionComplement, deviceLayers, drawDevice, partClips } from './heraldryArt.js';
import { shipFlagOf, flagKey } from '../systems/naval/shipFlag.js';

/** The flag's box: its fly, its hoist. */
export const FLAG_BOX = Object.freeze({ w: 150, h: 100 });
/** Each shape's cloth in the box, its hoist the left edge. */
export const FLAG_CLOTH = Object.freeze({
  flag: 'M0 0 H150 V100 H0 Z',
  swallowtail: 'M0 0 H150 L112 50 L150 100 H0 Z',
  pennant: 'M0 0 L150 40 V60 L0 100 Z',
  burgee: 'M0 0 L150 50 L0 100 Z',
});
/** The border, stroked this wide inside the cloth's edge. */
export const FLAG_BORDER_W = 9;
/** Where the device stands, by shape: its 100 box scaled to `scale` and set at (x, y). */
export const FLAG_DEVICE = Object.freeze({
  flag: Object.freeze({ x: 44, y: 19, scale: 0.62 }), swallowtail: Object.freeze({ x: 34, y: 19, scale: 0.62 }),
  pennant: Object.freeze({ x: 10, y: 27, scale: 0.46 }), burgee: Object.freeze({ x: 10, y: 27, scale: 0.46 }),
});

const hexOf = (k) => HERALDRY_COLOURS.find((c) => c.key === k)?.hex ?? null;

/** THE FLAG AS SVG - the designer's picture: `flag` (shipFlag.js's) at `width` pixels wide, two thirds as tall; '' for none. */
export function flagSvg(raw, { width = 150 } = {}) {
  const f = shipFlagOf(raw);
  if (!f) return '';
  const cloth = FLAG_CLOTH[f.shape];
  const clip = `sf${flagKey(f).replace(/[^a-z0-9]/gi, '')}`;
  const divD = f.division !== 'plain' ? divisionPath(f.division, FLAG_BOX.w, FLAG_BOX.h) : '';
  const field = hexOf(f.field), d = FLAG_DEVICE[f.shape];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 100" width="${width}" height="${Math.round((width * 2) / 3)}" role="img" aria-label="flag">`
    + `<defs><clipPath id="${clip}"><path d="${cloth}"/></clipPath>${divD ? partClips(clip, divD, FLAG_BOX) : ''}</defs>`
    + `<path d="${cloth}" fill="${field}"/>`
    + (divD ? `<path d="${divD}" fill="${hexOf(f.field2)}" clip-path="url(#${clip})"/>` : '')
    + (f.border ? `<path d="${cloth}" fill="none" stroke="${hexOf(f.border)}" stroke-width="${FLAG_BORDER_W * 2}" clip-path="url(#${clip})"/>` : '')
    + (f.device ? `<g clip-path="url(#${clip})">${deviceLayers(f.device, hexOf(f.charge), field, `translate(${d.x} ${d.y}) scale(${d.scale})`, divD ? { id: `${clip}d`, comp: `${clip}c`, hex: hexOf(f.field2) } : null)}</g>` : '')
    + `<path d="${cloth}" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="2"/>`
    + '</svg>';
}

/**
 * THE FLAG ON A CANVAS - the cloth's texture: the same drawing into `ctx`, `w` by two thirds of `w` pixels, outside the
 * shape left clear (the cloth's cut). Whether it drew (none for no flag, or no Path2D).
 * @param {CanvasRenderingContext2D} ctx @param {any} raw @param {number} w
 */
export function drawFlag(ctx, raw, w) {
  const f = shipFlagOf(raw);
  const P = globalThis.Path2D;
  if (!f || typeof P !== 'function') return false;
  const cloth = new P(FLAG_CLOTH[f.shape]);
  const field = hexOf(f.field) ?? '#8a8a8a';
  ctx.save();
  ctx.clearRect(0, 0, w, (w * 2) / 3);
  ctx.scale(w / FLAG_BOX.w, w / FLAG_BOX.w);
  ctx.fillStyle = field;
  ctx.fill(cloth);
  ctx.save();
  ctx.clip(cloth);
  const divD = f.division !== 'plain' ? divisionPath(f.division, FLAG_BOX.w, FLAG_BOX.h) : '';
  const div = divD ? new P(divD) : null;
  const f2 = div ? hexOf(f.field2) ?? field : null;
  if (div) { ctx.fillStyle = f2; ctx.fill(div); }
  if (f.border) { ctx.strokeStyle = hexOf(f.border) ?? field; ctx.lineWidth = FLAG_BORDER_W * 2; ctx.stroke(cloth); }
  if (f.device) drawDevice(ctx, P, f.device, hexOf(f.charge) ?? '#e6e6e6', field, FLAG_DEVICE[f.shape], div, f2, divD ? new P(divisionComplement(divD, FLAG_BOX.w, FLAG_BOX.h)) : null);
  ctx.restore();
  ctx.restore();
  return true;
}
