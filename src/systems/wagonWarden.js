// @ts-check
// WARDEN1 (2026-10-10, Mac: "Anytime there are too many carts/wagons in a city or they are parked on the road for a long
// time. I want a gaurd to navigate, lift the wagon/horse on top of their sprite and yeet it far away"; asked: it lands
// outside town, fetched or summoned; everyone sees it; ten real minutes on a road; four a town, the longest parked
// first): THE TOWN WATCH'S LAW, ON THE CLIENT. Pure.
//
// The cell keeps the clock and the count (net/wire.js WARDEN1, wardenVerdicts). The owner says what the cell cannot know,
// read off the town's layout as the team parks - THE STAMP (wardenStamp): where the wagon stands (its anchor, the save's
// natives), when it came to stand there (the wall clock), the TOWN it stands in (a city's, a hamlet's or a village's map
// id - WARDEN_TOWN_TYPES; anywhere else no watch keeps the street), whether it stands ON A ROAD (a third of its footprint
// on the town's road cells - footprintRoadShare, the walk grid's ROAD_WEIGHT), and where a throw LANDS (landingOf: straight out
// through the town's nearest edge, WARDEN_LAND_PAST beyond it). The park word carries it (wardenWordOf), so the cell can
// throw a team whose owner is away. A lone horse is no cart: only a parked wagon is stamped.
// OFFLINE THE CLIENT IS THE WATCH (offlineDue): the road's rule alone (a town holds nobody else's team), on the stamp's
// own clock, kept in the save - a wagon left on a road and loaded an hour later is thrown on the load.
// A THROWN TEAM'S RECORD (thrownRecord): every part moved by the throw, so a reader draws it where it landed; the owner's
// save moves the same way (thrownTo - systems/horseCart.js adoptYeet).
//
// Not a DFU member. Ledger A (WARDEN1).
import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { ROAD_WEIGHT } from './gothwayBoards.js';
import { WARDEN_ROAD_MS, WARDEN_LAND_REACH, WARDEN_TOWN_MAX, parkSpotOf } from '../net/wire.js';

/** The save's slot for the stamp (systems/modSaveData.js). */
export const WARDEN_VENDOR = 'WagonWarden';
/** Where a watch keeps the streets: a city, a hamlet, a village. */
export const WARDEN_TOWN_TYPES = Object.freeze([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
export const isWardenTown = (/** @type {any} */ locationType) => WARDEN_TOWN_TYPES.includes(locationType);
/** How far past the town's edge a throw lands, metres. */
export const WARDEN_LAND_PAST = 40;
/** How far along the edge a throw strays from straight out, metres either way at most (each wagon its own, off its anchor). */
export const WARDEN_LAND_SCATTER = 12;
/** The share of a wagon's footprint on road cells that stands it on the road. */
export const WARDEN_ROAD_SHARE = 1 / 3;
/** The footprint's samples a side (a square grid over the wagon's box). */
export const WARDEN_FOOT_STEPS = 3;
/** How far (natives, either axis) the save's anchor may stand from the spot a throw names and still be the team thrown -
 *  the wagon as drawn and the save's axle part by its ground solve. */
export const WARDEN_SAME_NATIVES = 400;
/** What the owner is told. */
export const WARDEN_TEXT = Object.freeze({
  thrown: (/** @type {string} */ town) => `The town watch has thrown your wagon out of ${town || 'town'}!`,
  fetch: 'It lies past the edge of town - walk out for it, or summon it.',
});

/**
 * The share of a wagon's footprint standing on the town's road: `weightAt(gx, gy)` the town's walk grid (`width` x
 * `height` cells of `cell` metres, the location frame), `at` the footprint's middle [x, z] and `forward` its facing [x, z]
 * (the location frame), `half` its half-size [across, along] in metres. A WARDEN_FOOT_STEPS square of samples, corners
 * included; one off the grid stands on no road. Pure.
 * @param {(gx: number, gy: number) => number} weightAt @param {number} width @param {number} height @param {number} cell
 * @param {number[]} at @param {number[]} forward @param {number[]} half
 */
export function footprintRoadShare(weightAt, width, height, cell, at, forward, half) {
  const fl = Math.sqrt(forward[0] * forward[0] + forward[1] * forward[1]) || 1;
  const fx = forward[0] / fl, fz = forward[1] / fl;
  const n = WARDEN_FOOT_STEPS;
  let road = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u = n > 1 ? (i / (n - 1)) * 2 - 1 : 0, v = n > 1 ? (j / (n - 1)) * 2 - 1 : 0;
      const x = at[0] + u * half[0] * fz + v * half[1] * fx, z = at[1] - u * half[0] * fx + v * half[1] * fz;
      const gx = Math.floor(x / cell), gy = Math.floor(z / cell);
      if (gx >= 0 && gy >= 0 && gx < width && gy < height && weightAt(gx, gy) === ROAD_WEIGHT) road++;
    }
  }
  return road / (n * n);
}

/**
 * Where the watch throws a wagon standing at `at` [x, z] in a town whose ground is `rect` [x0, z0, x1, z1] (the location
 * frame, metres): straight out through its nearest edge (a tie goes west, east, south, north in that order),
 * WARDEN_LAND_PAST beyond it, strayed along the edge by `stray` in [-1, 1] times WARDEN_LAND_SCATTER (never past the
 * edge's ends). Pure.
 * @param {number[]} rect @param {number[]} at @param {number} [stray]
 */
export function landingOf(rect, at, stray = 0) {
  const [x0, z0, x1, z1] = rect;
  const d = [at[0] - x0, x1 - at[0], at[1] - z0, z1 - at[1]];
  let side = 0;
  for (let i = 1; i < 4; i++) if (d[i] < d[side]) side = i;
  const s = Math.max(-1, Math.min(1, Number.isFinite(stray) ? stray : 0)) * WARDEN_LAND_SCATTER;
  const along = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Math.max(lo, Math.min(hi, v + s));
  if (side === 0) return [x0 - WARDEN_LAND_PAST, along(at[1], z0, z1)];
  if (side === 1) return [x1 + WARDEN_LAND_PAST, along(at[1], z0, z1)];
  if (side === 2) return [along(at[0], x0, x1), z0 - WARDEN_LAND_PAST];
  return [along(at[0], x0, x1), z1 + WARDEN_LAND_PAST];
}
/** A wagon's stray off its anchor's natives, in [-1, 1] - the same anchor, the same stray. Pure. */
export function strayOf(/** @type {number[]} */ anchor) {
  let h = (Math.imul(anchor[0] | 0, 73856093) ^ Math.imul(anchor[1] | 0, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = (h ^ (h >>> 12)) >>> 0;
  return (h / 0xffffffff) * 2 - 1;
}

/**
 * THE STAMP of my parked wagon: `a` its anchor ([x, z] natives - the save's), `at` when it came to stand there (the wall
 * clock, ms), `tw` its town's map id (null: no watch keeps where it stands), `rd` whether it stands on a road, `ly` where
 * a throw lands ([x, z] natives; null with no town). Pure - a fresh record.
 * @param {number[]} a @param {number} at @param {number|null} [tw] @param {boolean} [rd] @param {number[]|null} [ly]
 */
export function wardenStamp(a, at, tw = null, rd = false, ly = null) {
  const town = tw !== null && Number.isInteger(tw) && tw >= 0 && tw <= WARDEN_TOWN_MAX && Array.isArray(ly);
  return { a: [a[0], a[1]], at, tw: town ? tw : null, rd: town && rd === true, ly: town && ly ? [ly[0], ly[1]] : null };
}
/** A stamp read back from a save, or null (a save from before WARDEN1, or a record that is none). Pure. */
export function validWardenStamp(/** @type {any} */ s) {
  const pt = (/** @type {any} */ p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  if (!s || typeof s !== 'object' || !pt(s.a) || !Number.isFinite(s.at)) return null;
  return wardenStamp(s.a, s.at, Number.isInteger(s.tw) ? s.tw : null, s.rd === true, pt(s.ly) ? s.ly : null);
}
/** Whether `stamp` is the one of my wagon parked at `anchor` (the save's natives, exactly - a parked anchor never drifts). */
export const stampFits = (/** @type {any} */ stamp, /** @type {number[]|null} */ anchor) => !!stamp && !!anchor && stamp.a[0] === anchor[0] && stamp.a[1] === anchor[1];
/**
 * The park word's watch fields for my wagon parked at `anchor`: `{ ly, tw, rd? }` (net/wire.js validParkData) - or null:
 * no stamp of it, no town, or a landing past WARDEN_LAND_REACH (the cell would drop it). Pure.
 * @param {any} stamp @param {number[]} anchor
 */
export function wardenWordOf(stamp, anchor) {
  if (!stampFits(stamp, anchor) || stamp.tw === null || !stamp.ly) return null;
  if (Math.abs(stamp.ly[0] - anchor[0]) > WARDEN_LAND_REACH || Math.abs(stamp.ly[1] - anchor[1]) > WARDEN_LAND_REACH) return null;
  return { ly: [stamp.ly[0], stamp.ly[1]], tw: stamp.tw, ...(stamp.rd ? { rd: 1 } : {}) };
}
/** OFFLINE: whether the watch throws my wagon parked at `anchor` at `now` (the wall clock) - its stamp's, on a road in a
 *  town, WARDEN_ROAD_MS since it came to stand there. Pure. */
export function offlineDue(/** @type {any} */ stamp, /** @type {number[]} */ anchor, /** @type {number} */ now) {
  return stampFits(stamp, anchor) && stamp.rd === true && !!stamp.ly && now - stamp.at >= WARDEN_ROAD_MS;
}
/** A thrown team's park record: each part moved by the throw (the record's `ly` less where it stood - parkSpotOf), its
 *  heights as said (a reader stands it on its own ground). A record with no landing is answered as it is. Pure - a fresh
 *  record. */
export function thrownRecord(/** @type {any} */ r) {
  const from = parkSpotOf(r), to = r?.ly;
  if (!from || !Array.isArray(to) || to.length !== 2 || !to.every(Number.isFinite)) return r;
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const out = { ...r };
  if (Array.isArray(r.w)) { out.w = [...r.w]; out.w[1] += dx; out.w[3] += dz; }
  if (Array.isArray(r.h)) { out.h = [...r.h]; out.h[0] += dx; out.h[2] += dz; }
  return out;
}
/** Where a save's anchor goes when the watch threw its team from `from` to `to` ([x, z] natives each): by the same move -
 *  or null when the anchor is not the team thrown (it stands past WARDEN_SAME_NATIVES from `from`: moved, summoned or
 *  driven off since). Pure. */
export function thrownTo(/** @type {number[]} */ anchor, /** @type {number[]} */ from, /** @type {number[]} */ to) {
  if (Math.abs(anchor[0] - from[0]) > WARDEN_SAME_NATIVES || Math.abs(anchor[1] - from[1]) > WARDEN_SAME_NATIVES) return null;
  return [anchor[0] + to[0] - from[0], anchor[1] + to[1] - from[1]];
}
