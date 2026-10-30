// @ts-check
// FIXED-PVE STAGE 7 (bible/05-Combat/Fixed-PvE.md section 9): THE FIXED-LEVEL ZONES. Every place in Tamriel has a level
// band set by where it stands - its region (0..70: the Bay's 62 and the provinces' nine), the 96-pixel district inside it
// and what the place is - and never by who walks there. A province holds several bands, a rare district is a high-level
// enclave with a warning, a road keeps its region's band, a town is safe and a dungeon is a step harder. The
// recommendation is advice only: it changes no foe and bars no one. Ledger A (FIXED-PVE).
import { BAY_REGION_COUNT, REGION_NAMES } from '../../formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../formats/mapsFile.js';
import { districtOf } from '../../world/worldWide/worldGrid.js';
import { placeRng } from './pveEncounter.js';
import { BUILD_KIND_KEYS, buildAt } from './pveBuilds.js';
import { combatScore } from './pveProfile.js';

/** The six fixed bands, each overlapping the next so a zone's edge is never a wall. */
export const ZONE_BANDS = Object.freeze([[1, 8], [6, 15], [12, 22], [20, 30], [28, 38], [36, 45]].map((b) => Object.freeze(b)));
const TOP = ZONE_BANDS.length - 1;

/** Each region's base band, by index 0..70 - a first pass from the map's own country: the Bay's cities and their
 *  shores low, its deserts, mountains and isles high, then the nine provinces past it. */
export const REGION_TIER = Object.freeze([
  3, 4, 1, 1, 2, 1, 2, 3, 2, 4, 2, 3, 2, 1, 2, 1,   // Alik'r .. Bjoulsae River
  4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 2,               // Wrothgarian Mountains, the seven cities, two villages, Orsinium Area, Skeffington Wood
  1, 2, 1, 2,                                       // the four coasts
  2, 1, 1, 2, 2, 2, 2, 2, 3, 2, 2, 3, 3, 3, 2, 3, 3, 2, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1, 2,   // Northmoor .. Cybiades
  2, 3, 4, 4, 3, 3, 3, 5, 5,                        // High Rock, Hammerfell, Skyrim, Morrowind, Sumurset Isle, Valenwood, Elsweyr, Black Marsh, Cyrodiil
]);

/** A district's step from its region's band, drawn from its key - most stand at the base, some a step either side. */
export const DISTRICT_STEP = Object.freeze([-1, 0, 0, 0, 1, 1]);
/** Of each hundred districts: the first ENCLAVE are high-level enclaves (three bands up), the next FARMING farming
 *  grounds (a dense, steady population at the band). */
export const ZONE_SHARE = Object.freeze({ enclave: 4, farming: 10 });
/** Dungeon types one band deeper still than any dungeon: the old, the undead and the great beasts. */
export const DEEP_DUNGEONS = /** @type {readonly number[]} */ (Object.freeze([DUNGEON_TYPES.VampireHaunt, DUNGEON_TYPES.DragonsDen, DUNGEON_TYPES.Laboratory,
  DUNGEON_TYPES.DesecratedTemple, DUNGEON_TYPES.GiantStronghold, DUNGEON_TYPES.VolcanicCaves]));
/** What a place can be. */
export const ZONE_PLACES = Object.freeze(['wild', 'road', 'town', 'dungeon']);

const clampTier = (t) => Math.max(0, Math.min(TOP, t));

/** The district's draw: one number in [0, 100) from its key alone. @param {number} px @param {number} py */
export function districtRoll(px, py) {
  const [cx, cy] = districtOf(px, py);
  return Math.floor(placeRng(`district|${cx}|${cy}`)() * 100);
}

/**
 * The zone at world pixel (`px`, `py`) in `region`, for a place of kind `place` (dungeon: its `dungeon` type). Every
 * machine reads the same zone: nothing here knows a player.
 * @param {{ px: number, py: number, region: number, place?: string, dungeon?: number|null }} at
 */
export function pveZoneAt({ px, py, region, place = 'wild', dungeon = null }) {
  const base = REGION_TIER[region];
  if (base == null || !ZONE_PLACES.includes(place)) return null;
  const roll = districtRoll(px, py);
  const enclave = place === 'wild' && roll < ZONE_SHARE.enclave;
  const farming = place === 'wild' && !enclave && roll < ZONE_SHARE.enclave + ZONE_SHARE.farming;
  let tier = clampTier(base + DISTRICT_STEP[roll % DISTRICT_STEP.length]);
  if (enclave) tier = clampTier(base + 3);
  else if (place === 'road') tier = Math.min(tier, base);
  else if (place === 'town') tier = 0;
  else if (place === 'dungeon') tier = clampTier(tier + 1 + (DEEP_DUNGEONS.includes(/** @type {number} */ (dungeon)) ? 1 : 0));
  const band = ZONE_BANDS[tier];
  return Object.freeze({ region, name: REGION_NAMES[region], pastBay: region >= BAY_REGION_COUNT, place, tier, band,
    safe: place === 'town', enclave, farming, warning: enclave || tier >= base + 2 });
}

/** The Combat Score a band's foes ask (advice only): the middle of the six reference builds at the band's floor. @param {readonly number[]} band */
export function recommendedScore(band) {
  const scores = BUILD_KIND_KEYS.map((k) => combatScore(buildAt(k, band[0]))).sort((a, b) => a - b);
  return scores[Math.floor(scores.length / 2)];
}
