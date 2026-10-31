// @ts-check
// IC-GRAND x THE LIVING WORLD (2026-10-26, the owner walking the city: "Seems like NPCs arent navigating the entirety of
// the city"; bible/03-World/Arena-Provinces.md IC-GRAND, "The fabric's homes") - THE FABRIC'S HOMES. The living town makes
// its people from its slice's buildings (systems/livingWorld/census.js townCensus: households from its houses, trades
// from its shops, its tavern's keeper) and walks them between their doors (places.js townPlaces) - and the city's own
// blocks carry none: their buildings are the fabric's (world/imperialFabric.js), facades without a door, so 425 of the
// 625 slices stood nobody but the watch and its travellers, and the 200 with Daggerfall's blocks people only about those
// blocks' doors. Each near slice's fabric hands the living town a share of its buildings as homes, shops and taverns,
// each with a door on the widest of its street fronts whose ground before it is open (the fabric's own law and the
// landmarks', as the walkers' grid reads them - never a door onto a court, a wall or a canal) - one plot in HOMES_EVERY
// (HOMES_MIN to HOMES_MAX a slice: a district its density by its buildings), picked off the plot's own key, so every
// client stands the same people.
//
// THE KEY IS THE PLOT'S (imperialFabric.js's plot key, `key`), within its slice's map id (the living town is the slice's):
// the BLD stream gives these same buildings building records and doors keyed by the same plot key, and where it does the
// census takes its records - fabricHomesIn is the one door that swap goes through. A plot whose key falls in Daggerfall's
// own range (talk/talkTopics.js makeBuildingKey, under FABRIC_HOME_KEY_MIN) is left out, so no home answers a key of a
// Daggerfall block's building in the same slice.
import { IMPERIAL_SPAN, IMPERIAL_CELLS, imperialSlicePlan, imperialCodeCell, imperialClosed } from './imperialCity.js';
import { fabricCell, outwardOf, fabricGroundAt, fabricClosedOf } from './imperialFabric.js';
import { BUILDING_TYPES } from './buildingNames.js';
import { hash32, BLOCK_M } from './spawnedDungeons.js';
import { CAPITALS } from './tamrielCapitals.js';

/** One plot with a street front in this many a home (a shop, a tavern). */
export const HOMES_EVERY = 16;
/** A slice's homes, at the fewest and the most (the living town's census and its paths walk each one's people). */
export const HOMES_MIN = 24;
export const HOMES_MAX = 160;
/** Of the homes, one in TAVERN_EVERY a tavern, else one in SHOP_EVERY a shop (its kind off its key), else a house. */
export const TAVERN_EVERY = 12;
export const SHOP_EVERY = 5;
/** The shops a fabric's front keeps. */
export const FABRIC_SHOPS = Object.freeze([
  BUILDING_TYPES.GeneralStore,
  BUILDING_TYPES.Alchemist,
  BUILDING_TYPES.Armorer,
  BUILDING_TYPES.WeaponSmith,
  BUILDING_TYPES.PawnShop,
  BUILDING_TYPES.ClothingStore,
  BUILDING_TYPES.GemStore,
  BUILDING_TYPES.Bookseller,
]);
/** How far out from its front a home's door stands, metres (on the street, before the facade). */
export const DOOR_OUT = 0.8;
/** The lowest key a fabric's home takes: past every key of a Daggerfall block's buildings (column << 16 | row << 8 |
 *  record, the slice's eight by eight - under 0x80000). */
export const FABRIC_HOME_KEY_MIN = 0x80000;

const B = BLOCK_M,
  HALF = IMPERIAL_CELLS / 2;
/** How far inside its slice's edge a home's door stands, metres (a walker's grid cell and its step before the door). */
const NAV_EDGE = 3.2;
/** The homes lately asked, by slice (a near ring's and its slack's). @type {Map<number, any>} */
const _homes = new Map();
const HOMES_KEEP = 32;

/**
 * A SLICE'S FABRIC HOMES (`s` the slice: sy * IMPERIAL_SPAN + sx), for its living town: `buildings` `{ key, type, quality,
 * factionId }` and `doors` `{ key, x, z, nx, nz }` in the slice's location frame (metres east and north of its
 * south-west corner - the walkers' grid's, world/city/cityNavigation.js), each building's one door on the widest of its
 * street fronts with open ground before it (doorOf), its normal out of the building. Every plot of the slice's own cells
 * with a street front whose key stands past FABRIC_HOME_KEY_MIN is a candidate; the homes are the first of them by their
 * keys' hash that have such a door, then in their keys' order.
 * Frozen and kept (an LRU).
 * @param {number} s
 * @returns {{ buildings: ReadonlyArray<{ key: number, type: number, quality: number, factionId: number }>, doors: ReadonlyArray<{ key: number, x: number, z: number, nx: number, nz: number }> }}
 */
export function fabricHomesIn(s) {
  const had = _homes.get(s);
  if (had) {
    _homes.delete(s);
    _homes.set(s, had);
    return had;
  }
  const sx = s % IMPERIAL_SPAN,
    sy = Math.floor(s / IMPERIAL_SPAN);
  const ox = (sx * 8 - HALF) * B,
    oz = (sy * 8 + 8 - HALF) * B; // the slice's south-west corner: x east, z south
  const candidates = homeCandidates(s);
  const n = Math.min(
    candidates.length,
    Math.max(HOMES_MIN, Math.min(HOMES_MAX, Math.round(candidates.length / HOMES_EVERY))),
  );
  const chosen = [];
  for (const c of candidates
    .map((p) => ({ p, h: hash32(p.key >>> 0, 0x686f6d65) >>> 0 }))
    .sort((a, b) => a.h - b.h || (a.p.key >>> 0) - (b.p.key >>> 0))) {
    // 'home'
    if (chosen.length >= n) break;
    const door = doorOf(c.p);
    if (
      door &&
      door[0] - ox > NAV_EDGE &&
      door[0] - ox < 8 * B - NAV_EDGE &&
      oz - door[1] > NAV_EDGE &&
      oz - door[1] < 8 * B - NAV_EDGE
    )
      chosen.push({ p: c.p, door }); // its door on the slice's own grid
  }
  chosen.sort((a, b) => (a.p.key >>> 0) - (b.p.key >>> 0));
  const buildings = [],
    doors = [];
  for (const {
    p,
    door: [X, Z, nrm],
  } of chosen) {
    const key = p.key >>> 0,
      h = hash32(key, 0x74797065) >>> 0; // 'type'
    const type =
      h % TAVERN_EVERY === 0
        ? BUILDING_TYPES.Tavern
        : h % SHOP_EVERY === 0
          ? FABRIC_SHOPS[(h >>> 8) % FABRIC_SHOPS.length]
          : BUILDING_TYPES.House1 + ((h >>> 4) % 4);
    buildings.push(Object.freeze({ key, type, quality: 1 + ((h >>> 12) % 20), factionId: 0 }));
    doors.push(Object.freeze({ key, x: X - ox, z: oz - Z, nx: nrm[0], nz: -nrm[1] }));
  }
  const out = Object.freeze({ buildings: Object.freeze(buildings), doors: Object.freeze(doors) });
  _homes.set(s, out);
  if (_homes.size > HOMES_KEEP) _homes.delete(/** @type {number} */ (_homes.keys().next().value));
  return out;
}
/** A SLICE'S CANDIDATES for a home: every plot of its own cells (a Daggerfall block's cell keeps its own buildings) with a
 *  street front, none of a court's back range, its key past FABRIC_HOME_KEY_MIN, each once. @param {number} s */
export function homeCandidates(s) {
  const plan = imperialSlicePlan(s),
    sx = s % IMPERIAL_SPAN,
    sy = Math.floor(s / IMPERIAL_SPAN);
  const seen = new Set(),
    candidates = [];
  for (let pr = 0; pr < 8; pr++)
    for (let pc = 0; pc < 8; pc++) {
      if (!imperialCodeCell(plan[pr][pc])) continue;
      for (const p of fabricCell(sy * 8 + pr, sx * 8 + pc).plots) {
        const key = p.key >>> 0;
        if (!p.out || /** @type {any} */ (p).back || key < FABRIC_HOME_KEY_MIN || seen.has(key)) continue;
        seen.add(key);
        candidates.push(p);
      }
    }
  return candidates;
}
/** A plot's door: the middle of the widest of its street fronts (`out`, by its street's width, the first on a tie) whose
 *  ground DOOR_OUT before it and a step further is open - the fabric's ground no court, wall, canal or building, no
 *  landmark's inside - as [x, z, normal] in the city's metres; null where no front has. @param {any} p */
export function doorOf(p) {
  const fronts = [0, 1, 2, 3]
    .filter((k) => p.out & (1 << k))
    .sort((a, b) => (p.sw?.[b] ?? 0) - (p.sw?.[a] ?? 0) || a - b);
  for (const e of fronts) {
    const a = p.q[e],
      b = p.q[(e + 1) & 3],
      nrm = outwardOf(p.q, e),
      m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const open = (/** @type {number} */ d) => {
      const x = m[0] + nrm[0] * d,
        z = m[1] + nrm[1] * d;
      return !fabricClosedOf(fabricGroundAt(x, z)) && !imperialClosed(x, z);
    };
    if (open(DOOR_OUT) && open(DOOR_OUT + 1.6))
      return /** @type {[number, number, number[]]} */ ([m[0] + nrm[0] * DOOR_OUT, m[1] + nrm[1] * DOOR_OUT, nrm]);
  }
  return null;
}
/** No homes (a place that is no slice of the city's own). */
export const NO_HOMES = Object.freeze({ buildings: Object.freeze([]), doors: Object.freeze([]) });
/** THE FABRIC'S HOMES OF A LOCATION the pixel builds near (scenes/pixelBuild.js, beside its Daggerfall blocks' buildings
 *  and doors): a family capital's slice's (world/tamrielCapitals.js synthesizeCapitalLocation's `capital`), none for any
 *  other place. @param {any} loc */
export const cityHomesOf = (loc) =>
  loc?.capital && CAPITALS[loc.capital.k]?.family ? fabricHomesIn(loc.capital.s) : NO_HOMES;
