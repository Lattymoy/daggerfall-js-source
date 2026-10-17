// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!") - FORAGING'S PURE CORE: the draws,
// the attribute bands, the day and the Basket's five blocks, moved out
// of foragingLaw.js (which imports and re-exports every one) so the
// account service can read them without bundling a host. The
// professions' Basket (bible/06-Systems/Foraging.md 14.6) rolls its
// food on the service from these very tables - the IL's arrays still
// live once. Verbatim from the IL; nothing here touches a host.
// ═══════════════════════════════════════════════════════════════════

import { CLIMATES } from '../../formats/mapsTables.js';

// ---- draws and bands -------------------------------------------------

/** PickOneOf (IL_0dc5): `a[Random.Range(0, a.Length)]` - Random.Range on ints, the max exclusive. */
export const pickOneOf = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
/** An attribute average, C#'s integer division: `(A + B) / 2`. */
export const attributeAverage = (a, b) => Math.trunc((a + b) / 2);
/** The bands every roll uses: <=39, 40-59, 60-79, >=80 -> 0..3. */
export const attributeBand = (v) => (v <= 39 ? 0 : v <= 59 ? 1 : v <= 79 ? 2 : 3);

// ---- the day ---------------------------------------------------------

/** Refused when `Hour <= 6 || Hour >= 18` (e.g. IL_0e66): 07:00:00-17:59:59 is day. */
export const isForagingDaylight = (hour) => !(hour <= 6 || hour >= 18);

// ---- climates and months ---------------------------------------------

export const isDesertClimate = (climate) => climate === CLIMATES.Desert || climate === CLIMATES.Desert2;
export const isWinterMonth = (monthValue) => monthValue >= 8 || monthValue <= 1;

// ---- the Basket (IL_2654-IL_4a09) -------------------------------------

/** The five blocks: A deserts; B Subtropical; C Swamp, Rainforest; D Mountain or the winter months; E the rest. */
export function basketBlock(climate, monthValue) {
  if (isDesertClimate(climate)) return 'A';
  if (climate === CLIMATES.Subtropical) return 'B';
  if (climate === CLIMATES.Swamp || climate === CLIMATES.Rainforest) return 'C';
  if (climate === CLIMATES.Mountain || isWinterMonth(monthValue)) return 'D';
  return 'E';
}
const T6 = (...rows) => Object.freeze(rows.map((r) => Object.freeze(r)));
const COUNT_BD = T6([0, 0, 0, 1, 1, 2], [0, 0, 1, 1, 2, 2], [0, 1, 1, 2, 2, 3], [1, 1, 2, 2, 3, 3]);
const COUNT_CE = T6([0, 0, 1, 2, 2, 3], [0, 1, 2, 2, 3, 3], [1, 2, 2, 3, 3, 4], [2, 2, 3, 3, 4, 4]);
/** Each block's count lists (by INT's band) and its food list (2 fruit, 3 Mushroom, 4 Egg). */
export const BASKET_BLOCKS = Object.freeze({
  A: Object.freeze({ counts: T6([0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 1, 1], [0, 0, 0, 1, 1, 1], [0, 0, 1, 1, 1, 1]), foods: Object.freeze([2, 3, 4]), fruit: 'Orange' }),
  B: Object.freeze({ counts: COUNT_BD, foods: Object.freeze([2, 2, 3, 4]), fruit: 'Orange' }),
  C: Object.freeze({ counts: COUNT_CE, foods: Object.freeze([2, 2, 3, 4]), fruit: 'Orange' }),
  D: Object.freeze({ counts: COUNT_BD, foods: Object.freeze([2, 3, 3, 4, 4]), fruit: 'Apple' }),
  E: Object.freeze({ counts: COUNT_CE, foods: Object.freeze([2, 3, 4]), fruit: 'Apple' }),
});
