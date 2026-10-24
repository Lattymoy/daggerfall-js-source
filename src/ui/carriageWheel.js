// @ts-check
// OW-HUBS (FIELD BUGS 2026-10-04e, Discord: "Highlight fast travel hubs (cities with carriages)" - "WHEEL icon for
// carriage places"): THE CARRIAGE'S WHEEL, the one glyph both maps draw at a town whose gate stands a carriage driver
// (systems/immersiveTravel.js hasCarriageGate - Immersive Travel's walled cities): the Overworld beside its plate's dot
// (ui/travel/travelViewHud.js) and the held map beside its mark (ui/ink/inkMap.js), as the harbour's anchor stands by a port's.
// A rim, six spokes and a hub - one path, stroked by each map in its own pens. Pure canvas, no state.

/** The wheel's six spokes. */
export const WHEEL_SPOKES = 6;

/**
 * The wheel's path at (x, y), radius `r`: the rim, then each spoke a fresh subpath (a canvas would join the rim's end
 * to the first spoke with a stray chord otherwise), then the hub. The caller strokes it.
 * @param {CanvasRenderingContext2D | any} ctx @param {number} x @param {number} y @param {number} r
 */
export function wheelPath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
  for (let i = 0; i < WHEEL_SPOKES; i++) {
    const a = (i * Math.PI * 2) / WHEEL_SPOKES;
    ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.moveTo(x + r * 0.3, y);
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
}
