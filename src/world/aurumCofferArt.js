// @ts-check
// AURUM-CACHES (2026-10-30, bible/06-Systems/Aurum.md section 3a): THE AURUM COFFER'S PICTURES - a dark oak chest bound in
// gold, the Aurum coin's sun struck on its lock plate (ui/aurumArt.js draws the coin), shut and full, or open and empty.
// Painted in code through the festival's paint box (world/festivalArt.js paintLayers: ramps through the ordered dither,
// the light from the top-left, a dark outline), so nothing is read from the player's data and nothing ships. Each is a
// stand-in of AURUM_COFFER_ARCHIVE (world/eliteGates/pseudoArchives.js), so a billboard asks getTexture as it asks any of
// Daggerfall's. Not a DFU member. Ledger A (AURUM-CACHES).
import { paintLayers } from './festivalArt.js';

/** The coffer's archive (world/eliteGates/pseudoArchives.js registers it) and its two pictures' records. */
export const AURUM_COFFER_ARCHIVE = 38351;
export const AURUM_COFFER_ART = Object.freeze({ shut: 0, open: 1 });
/** Each picture's size in texels: shut, 33 x 24 stands 0.83 m by 0.6 m; open, the lid stands up behind it. Odd wide, so
 *  the coin's sun has a middle texel. */
export const AURUM_COFFER_SIZE = Object.freeze({ shut: Object.freeze({ w: 33, h: 24 }), open: Object.freeze({ w: 33, h: 32 }) });

// the ramps, darkest first
const OAK = Object.freeze([[34, 20, 12], [58, 34, 18], [86, 54, 28], [116, 76, 40], [142, 98, 54]]);
const GOLD = Object.freeze([[92, 56, 12], [146, 98, 24], [200, 148, 42], [238, 198, 86], [255, 238, 164]]);
const SUN = Object.freeze([[255, 206, 84], [255, 236, 168], [255, 252, 232]]);
const HOLLOW = Object.freeze([[10, 6, 4], [24, 14, 8], [40, 26, 14]]);
/** The middle column: the picture mirrors about it. */
const MID = 16;

/** @typedef {(x: number, y: number) => boolean} Hit */
const ellipse = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ rx, /** @type {number} */ ry) => /** @type {Hit} */ ((x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
const rect = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) => /** @type {Hit} */ ((x, y) => x >= x0 && x < x1 && y >= y0 && y < y1);
const any = (/** @type {Hit[]} */ ...hs) => /** @type {Hit} */ ((x, y) => hs.some((h) => h(x, y)));
const both = (/** @type {Hit} */ a, /** @type {Hit} */ b) => /** @type {Hit} */ ((x, y) => a(x, y) && b(x, y));
/** The light from the top-left over a box: 1 at its top-left, 0 at its bottom-right, times `k`. */
const lit = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ w, /** @type {number} */ h, k = 1) =>
  (/** @type {number} */ x, /** @type {number} */ y) => Math.max(0, Math.min(1, (1 - ((x - x0) / w) * 0.4 - ((y - y0) / h) * 0.6) * k));
/** The wood's grain: a darker texel now and then along a plank. */
const grain = (/** @type {number} */ x, /** @type {number} */ y) => ((x * 7 + y * 3) % 11 === 0 ? 0.25 : 0);
/** The two gold straps, over whatever they bind. */
const straps = (/** @type {Hit} */ over) => both(any(rect(5, 0, 8, 99), rect(25, 0, 28, 99)), over);

/** The body, its top at row `y0` and its feet at `y0 + 12`: oak planks, the straps and corners, the plinth and the lock
 *  plate - the Aurum coin, a dark rim round a gold face struck with the sun of Aetherius, eight rays about a white heart.
 *  The layers both pictures share, lowest first. */
function bodyLayers(/** @type {number} */ y0) {
  const box = rect(1, y0, 32, y0 + 10), plinth = rect(0, y0 + 10, 33, y0 + 12);
  const corners = both(any(rect(1, y0 + 7, 4, y0 + 10), rect(29, y0 + 7, 32, y0 + 10)), box);
  const seams = both((_x, y) => y === y0 + 3 || y === y0 + 7, box);
  const cy = y0 + 5, d2 = (/** @type {number} */ x, /** @type {number} */ y) => (x - MID) ** 2 + (y - cy) ** 2;
  const rim = (/** @type {number} */ x, /** @type {number} */ y) => d2(x, y) <= 20.25, face = (/** @type {number} */ x, /** @type {number} */ y) => d2(x, y) <= 12.25;
  const rays = (/** @type {number} */ x, /** @type {number} */ y) => (x === MID && Math.abs(y - cy) <= 3) || (y === cy && Math.abs(x - MID) <= 3);
  const diagonals = (/** @type {number} */ x, /** @type {number} */ y) => Math.abs(x - MID) === 2 && Math.abs(y - cy) === 2;
  return [
    { hit: box, ramp: OAK, light: (/** @type {number} */ x, /** @type {number} */ y) => lit(1, y0, 31, 10, 0.8)(x, y) - grain(x, y) },
    { hit: seams, ramp: OAK, light: () => 0.05 },
    { hit: any(straps(box), corners), ramp: GOLD, light: lit(1, y0, 31, 10, 1.05) },
    { hit: plinth, ramp: GOLD, light: (/** @type {number} */ x) => 0.62 - x / 90 },
    { hit: rim, ramp: GOLD, flat: [...GOLD[0]] },
    { hit: face, ramp: GOLD, light: (/** @type {number} */ x, /** @type {number} */ y) => 0.5 - (x - MID + y - cy) / 16 },
    { hit: diagonals, ramp: SUN, light: () => 0.5 },
    { hit: rays, ramp: SUN, light: () => 0.5 },
    { hit: (/** @type {number} */ x, /** @type {number} */ y) => d2(x, y) === 1, ramp: SUN, light: () => 1 },
    { hit: (/** @type {number} */ x, /** @type {number} */ y) => x === MID && y === cy, ramp: SUN, light: () => 1 },
  ];
}

/** THE COFFER SHUT (33 x 24): a barrel lid of oak under the two straps, a gold rim, a hasp down to the coin, a glint on
 *  the lid. Pure: the same pixels every call. */
export function cofferShutArt() {
  const { w, h } = AURUM_COFFER_SIZE.shut;
  const lid = both(ellipse(16.5, 11, 15.5, 10.5), rect(1, 0, 32, 10)), rim = rect(1, 10, 32, 12);
  const slats = both((x) => x === 12 || x === 20, lid);
  const hasp = rect(15, 11, 18, 13);
  const glint = (/** @type {number} */ x, /** @type {number} */ y) => (x === 10 && y >= 2 && y <= 4) || (y === 3 && x >= 9 && x <= 11);
  return paintLayers(w, h, [
    ...bodyLayers(12),
    { hit: lid, ramp: OAK, light: (x, y) => lit(1, 1, 31, 10, 1.1)(x, y) - grain(x, y) },
    { hit: slats, ramp: OAK, light: () => 0.1 },
    { hit: straps(lid), ramp: GOLD, light: lit(1, 1, 31, 10, 1.15) },
    { hit: rim, ramp: GOLD, light: (x) => 0.82 - x / 60 },
    { hit: hasp, ramp: GOLD, light: () => 0.55 },
    { hit: glint, ramp: SUN, light: () => 1 },
  ]);
}

/** THE COFFER OPEN AND EMPTY (33 x 32): the barrel lid thrown back, its inside in shadow and its rim gold; the box's mouth
 *  dark and bare to its floor, the far wall caught by the light; the body below as it stood shut. Pure. */
export function cofferOpenArt() {
  const { w, h } = AURUM_COFFER_SIZE.open;
  const lid = both(ellipse(16.5, 11, 14.5, 11), rect(2, 0, 31, 11)), lidIn = both(ellipse(16.5, 11, 13, 9.6), rect(3, 0, 30, 11));
  const rivets = (/** @type {number} */ x, /** @type {number} */ y) => (x === 6 || x === 26) && (y === 4 || y === 8);
  const mouth = rect(1, 11, 32, 20), wall = rect(3, 11, 30, 14), floorSeams = both((_x, y) => y === 16, rect(3, 14, 30, 18));
  const sides = (/** @type {number} */ x, /** @type {number} */ y) => y >= 11 && y < 18 && (x === 1 || x === 2 || x === 30 || x === 31);
  const rim = rect(1, 18, 32, 20);
  return paintLayers(w, h, [
    { hit: lid, ramp: GOLD, light: (x, y) => 0.55 - x / 80 - y / 60 },
    { hit: lidIn, ramp: OAK, light: (x, y) => 0.42 - y / 40 - grain(x, y) },
    { hit: rivets, ramp: GOLD, light: () => 0.6 },
    { hit: mouth, ramp: HOLLOW, light: (x, y) => 0.35 + (y - 14) / 10 },
    { hit: wall, ramp: OAK, light: (x, y) => 0.55 - (y - 11) / 8 - grain(x, y) },
    { hit: floorSeams, ramp: HOLLOW, light: () => 0 },
    { hit: sides, ramp: OAK, light: (x) => (x < MID ? 0.28 : 0.1) },
    { hit: rim, ramp: GOLD, light: (x) => 0.85 - x / 60 },
    ...bodyLayers(20),
  ]);
}

/** Each picture by its record. */
export const AURUM_COFFER_PAINTERS = Object.freeze({ [AURUM_COFFER_ART.shut]: cofferShutArt, [AURUM_COFFER_ART.open]: cofferOpenArt });

let _registered = false;
/** THE PICTURES ON THE TEXTURE DOOR, once: each a stand-in of the coffer's archive, built when first asked
 *  (world/festivalArt.js registerFestivalArt's law). Answers how many registered.
 *  @param {(entries: any[]) => number} addVendorTextures */
export function registerAurumCofferArt(addVendorTextures) {
  if (_registered || typeof addVendorTextures !== 'function') return 0;
  _registered = true;
  return addVendorTextures(Object.entries(AURUM_COFFER_PAINTERS).map(([record, paint]) => ({
    archive: AURUM_COFFER_ARCHIVE, record: Number(record), frame: 0, standIn: true, fileName: `aurum-coffer-${AURUM_COFFER_ARCHIVE}_${record}`,
    build: async () => { const img = paint(); return { width: img.width, height: img.height, data: img.colors }; },
  })));
}
/** Test seam: unregistered. */
export function _resetAurumCofferArt() { _registered = false; }
