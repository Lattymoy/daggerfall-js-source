// @ts-check
// THE GROUND UNDER A SETTLEMENT. Its pads are drawn
// and walked as their own paving and decks; the terrain is carved to sit just under every cut pad near it, so a
// 6.4 m grid never pokes through a terrace finer than itself, and eases back to the land's own past the town. A raised
// pad leaves the land under it alone. Pure and worker-safe: the terrain worker and this thread read the same law. A
// departure from DFU's BlendLocationTerrain, which flattens a location's whole rect to one height.
import { edgeDistance, pointInRing, padAt } from './settlementGeometry.js';

/** How far under its pad's paving the carved ground stands, metres. */
export const PAD_CLEAR = 0.2;
/** How far round a cut pad its carve reaches: one terrain cell's diagonal, so no vertex beside its rim stands over it. */
export const PAD_REACH = 6.4 * Math.SQRT2;
/** How far past the last pad the carve eases back to the land's own, metres. */
export const GROUND_EASE = 28;

const smooth = (/** @type {number} */ t) => { const k = t < 0 ? 0 : t > 1 ? 1 : t; return k * k * (3 - 2 * k); };

/**
 * The ground a settlement asks at a point of its plan's frame: null where it leaves the land alone.
 * @param {import('./settlementContract.js').Pad[]} pads @param {number} datum metres @param {number} e @param {number} n
 * @param {number} natural the land's own height there, metres
 */
export function settlementGroundAt(pads, datum, e, n, natural) {
  /** @type {readonly [number, number]} */ const p = [e, n];
  const on = padAt(pads, p);
  if (on && (on.base === 'raised' || on.legacy)) return null;   // A legacy core's ground is its town's own
  let low = Infinity, near = Infinity;
  for (const pad of pads) {
    if (pad.base === 'raised' || pad.legacy) continue;
    const d = pointInRing(p, pad.poly) ? 0 : edgeDistance(p, pad.poly);
    near = Math.min(near, d);
    if (d <= PAD_REACH) low = Math.min(low, datum + pad.y - PAD_CLEAR);
  }
  if (low < Infinity) return low;
  if (near >= PAD_REACH + GROUND_EASE) return null;
  // past the reach: the nearest pad's carve eased back to the land
  let best = null, bd = Infinity;
  for (const pad of pads) {
    if (pad.base === 'raised' || pad.legacy) continue;
    const d = edgeDistance(p, pad.poly);
    if (d < bd) { bd = d; best = pad; }
  }
  const carve = datum + /** @type {import('./settlementContract.js').Pad} */ (best).y - PAD_CLEAR;
  return carve + (natural - carve) * smooth((bd - PAD_REACH) / GROUND_EASE);
}

/**
 * Carve a pixel's heights in place: `S[x * dim + y]` metres (x east from its west edge, y north from its south edge, `step`
 * metres apart); the plan's frame is the pixel's, shifted by its origin's metres. Answers how many vertices it moved.
 * @param {Float64Array|Float32Array|number[]} S @param {number} dim @param {number} step
 * @param {{ pads: import('./settlementContract.js').Pad[], origin: { east: number, north: number } }} plan
 * @param {number} datum @param {((e: number, n: number) => boolean)=} keep ground the carve never moves (a town's own)
 */
export function carveSettlementGround(S, dim, step, plan, datum, keep = undefined) {
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity], moved = 0;
  for (const pad of plan.pads) for (const [e, n] of pad.poly) { lo = [Math.min(lo[0], e), Math.min(lo[1], n)]; hi = [Math.max(hi[0], e), Math.max(hi[1], n)]; }
  const reach = PAD_REACH + GROUND_EASE, near = padsNear(plan.pads, reach);
  for (let x = 0; x < dim; x++) {
    const e = x * step - plan.origin.east;
    if (e < lo[0] - reach || e > hi[0] + reach) continue;
    for (let y = 0; y < dim; y++) {
      const n = y * step - plan.origin.north;
      if (n < lo[1] - reach || n > hi[1] + reach || keep?.(e, n)) continue;
      const i = x * dim + y, h = settlementGroundAt(near(e, n), datum, e, n, S[i]);
      if (h !== null && h !== S[i]) { S[i] = h; moved++; }
    }
  }
  return moved;
}

/** The size of padsNear's cells, metres. */
const NEAR_CELL = 32;
/**
 * The pads that can touch a point: each whose box, grown by `reach`, holds it, in the plan's own order - so the ground a
 * point asks of them is the ground it asks of every pad (a pad past its grown box is past `reach`), ties and all.
 * @param {import('./settlementContract.js').Pad[]} pads @param {number} reach @returns {(e: number, n: number) => import('./settlementContract.js').Pad[]}
 */
export function padsNear(pads, reach) {
  const cells = new Map(), none = [];
  pads.forEach((pad) => {
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
    for (const [e, n] of pad.poly) { west = Math.min(west, e); east = Math.max(east, e); south = Math.min(south, n); north = Math.max(north, n); }
    for (let cellX = Math.floor((west - reach) / NEAR_CELL); cellX <= Math.floor((east + reach) / NEAR_CELL); cellX++) {
      for (let cellZ = Math.floor((south - reach) / NEAR_CELL); cellZ <= Math.floor((north + reach) / NEAR_CELL); cellZ++) {
        const key = `${cellX},${cellZ}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(pad);
      }
    }
  });
  return (e, n) => cells.get(`${Math.floor(e / NEAR_CELL)},${Math.floor(n / NEAR_CELL)}`) ?? none;
}
