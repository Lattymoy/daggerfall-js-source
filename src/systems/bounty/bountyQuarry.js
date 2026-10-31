// @ts-check
// ═══════════════════════════════════════════════════════════════════
// QUARRY-WORLD (2026-10-27, bible/06-Systems/Bounty-Boards.md section 13, QUARRY-WORLD; the audit NO SYSTEM LEFT BEHIND IN THE BAY item 37 -
// "a note; Bay-wide too"; the owner: "Every single thing here needs to be addressed. No exceptions.") - THE LAND'S OWN WILD
// ABOUT A BOUNTY BOARD'S TOWN.
//
// A board's beasts were one global ladder by level (systems/bounty/bountyBoard.js BOUNTY_TIERS), so a Black Marsh board
// posted Orc Warlords and Centaurs and an Alik'r board Grizzly Bears. The land's own wild is what the encounter law rolls
// there (systems/encounters.js resolveEncounterTableIndex): the wild by day and by night of the town pixel's band - DFU's
// climate tables on the Bay (RandomEncounters.cs), a zone's tables past it (TESA-BIOME, systems/tamrielFauna.js
// faunaBandAt, the maps' `getFaunaBand`) - every table a mod may answer for it (characters/encounterTableDoor.js
// encounterTableChoices: Daggerfall Enemy Expansion's or the classic, the same on every machine of a game), its monsters
// (no person, nothing aquatic), each at its level as the game loaded it (tamrielFauna.js faunaLevelIn). The board picks a
// tier's beasts out of it (bountyBoard.js bountyQuarry).
// ═══════════════════════════════════════════════════════════════════
import { resolveEncounterTableIndex } from '../encounters.js';
import { encounterTableChoices, encounterTableGeneration } from '../../characters/encounterTableDoor.js';
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import { faunaLevelIn } from '../tamrielFauna.js';
import { dexLoaded, mudexLoaded } from '../enemyExpansion/dexSwitches.js';
import { tamrielLandVersion } from '../../world/tamriel/tamrielLand.js';

/** A monster's id: Daggerfall's (under 128) or Daggerfall Enemy Expansion's (256 to 383) - never a person's. */
const isMonster = (id) => Number.isInteger(id) && ((id >= 0 && id < 128) || (id >= 256 && id < 384));
/** A monster's level as the game loaded it (Daggerfall Enemy Expansion's and Meaner Monsters' edits, or Daggerfall's). */
const levelLoaded = (id) => {
  const dex = dexLoaded();
  return faunaLevelIn(id, dex, dex && mudexLoaded());
};

/**
 * THE LAND'S WILD on a pixel of `climateIndex` (MapsFile.getClimateIndex) and `fauna` (a zone's band past the Bay, null on
 * the Bay): `[id, level]` for every monster of its wild-by-day and wild-by-night tables, by id; none at sea or where the
 * law knows no band.
 * @param {number} climateIndex @param {?readonly number[]} fauna @param {(id: number) => number|null} [levelOf]
 * @returns {Array<[number, number]>}
 */
export function landWildOf(climateIndex, fauna, levelOf = levelLoaded) {
  const ids = new Set();
  for (const isDay of [true, false]) {
    const index = resolveEncounterTableIndex({ climateIndex, fauna, inLocationRect: false, isDay });
    if (index == null) continue;
    for (const table of encounterTableChoices(index))
      for (const id of table) if (isMonster(id) && ENEMY_BASICS[id]?.behaviour !== 'Aquatic') ids.add(id);
  }
  /** @type {Array<[number, number]>} */
  const out = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const lv = levelOf(id);
    if (Number.isFinite(lv)) out.push([id, /** @type {number} */ (lv)]);
  }
  return out;
}

/**
 * THE HOST'S DOOR: `(px, py) => wild` over its maps (`getClimateIndex`, and past the Bay `getFaunaBand` - scenes/world.js
 * hands systems/tamrielFauna.js faunaBandAt to it), kept a pixel while the tables, the land and the mods stand.
 * @param {{ getClimateIndex: (px: number, py: number) => number, getFaunaBand?: (px: number, py: number) => ?readonly number[] }} maps
 */
export function bountyLandWild(maps) {
  const kept = new Map();
  let key = '';
  return (/** @type {number} */ px, /** @type {number} */ py) => {
    const k = `${encounterTableGeneration()}|${tamrielLandVersion()}|${dexLoaded()}|${mudexLoaded()}`;
    if (k !== key) {
      key = k;
      kept.clear();
    }
    const at = `${px},${py}`;
    if (!kept.has(at)) kept.set(at, landWildOf(maps.getClimateIndex(px, py), maps.getFaunaBand?.(px, py) ?? null));
    return kept.get(at);
  };
}
