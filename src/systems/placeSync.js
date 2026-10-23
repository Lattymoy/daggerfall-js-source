// @ts-check
// PWR3 (2026-10-23, bible/05-Combat/Power-Arc.md section 6; Mac, asked: "Online only, keep a 15% edge"): THE PLACE SETS
// THE PLAYER - where a place's CEILING comes from, and which place the player stands in.
//
// Daggerfall builds every place around the player (DFU RDBLayout.ChooseRandomEnemyType and
// RandomEncounters.ChooseRandomEnemy band a place's table on the player's level; a class foe stands at it - EnemyEntity
// .SetEnemyCareer), so a place has no level of its own. It has a BAND: the natives its own encounter table can field,
// and the deadliest of them is its CEILING - the highest base level of a monster in its table, read here off DFU's
// EncounterTables and its bestiary (characters/encounterTables.js, characters/enemy/enemyBasics.js), never restated. A
// Cemetery's is 11 (its Mummy), a Prison's 16, an Orc's or a Giant's Stronghold 18, a Human Stronghold 19, every other
// dungeon kind 20 or 21 - the bestiary's top. The open country is its climate's three tables (a town's rect at night,
// the wilds by day and by night - ChooseRandomEnemy's climate band): the deadliest native of any, 19 or 20 - and a
// building stands on that ground. A mod's table edits (DEX3) leave the ceiling DFU's: every client reads the same one.
//
// What a ceiling does is systems/mentorMode.js's (the overlay, placeEdgeLevel, effectiveLevel). Where the port tuned a
// place for the top of the curve - a made level, the arena's floor, the gate's court, the Shattered Hour, a Super or an
// Elite dungeon, a dungeon of the open zone - there is no ceiling: the player plays whole. Offline, never.
//
// Not a DFU member: DFU levels every place to the player. Ledger A (PWR3).

import { ENCOUNTER_TABLES } from '../characters/encounterTables.js';
import { ENEMY_BASICS } from '../characters/enemy/enemyBasics.js';
import { CLIMATE_TABLE } from './encounters.js';
import { isOnlinePage } from './online/onlineLane.js';

/** A mobile id under this is a monster; at or over it a class foe, who stands at the player's level (SetEnemyCareer). */
const CLASS_FOE_FROM = 128;
/** DFU's dungeon kinds (DFRegion.DungeonTypes): tables 0..18. */
export const DUNGEON_KINDS = 19;

/** The deadliest native a table fields - the highest base level among its monsters; null for a table of class foes
 *  alone or none. @param {number} index EncounterTables' */
export function tableCeiling(index) {
  const t = ENCOUNTER_TABLES[index];
  if (!Array.isArray(t)) return null;
  let most = 0;
  for (const id of t) if (id < CLASS_FOE_FROM) most = Math.max(most, /** @type {any} */ (ENEMY_BASICS)[id]?.level ?? 0);
  return most > 0 ? most : null;
}
/** Every dungeon kind's ceiling, by its DungeonTypes index. */
export const DUNGEON_CEILINGS = Object.freeze(Array.from({ length: DUNGEON_KINDS }, (_, k) => tableCeiling(k)));
/** A dungeon kind's ceiling, or null. @param {number} dungeonType */
export const dungeonCeiling = (dungeonType) => (Number.isInteger(dungeonType) ? DUNGEON_CEILINGS[dungeonType] ?? null : null);
/** The open country's ceiling at a climate - the deadliest native of its three tables (a town's rect at night, the wilds
 *  by day and by night), or null for a climate with none. @param {number} climateIndex */
export function groundCeiling(climateIndex) {
  const band = /** @type {Map<number, number[]>} */ (CLIMATE_TABLE).get(climateIndex);
  if (!band) return null;
  const tops = band.map(tableCeiling).filter((c) => c != null);
  return tops.length ? Math.max(...tops) : null;
}

/** The dungeon the player was last built into: its ceiling (null where none binds). */
let _dungeon = null;
/**
 * THE DUNGEON'S BUILD (scenes/dungeonContext.js, once): its ceiling, online - null for a tuned place (`tuned`, the
 * host's word: a made level, the arena's floor, the gate's court, the Hour, a Super or an Elite dungeon, the open
 * zone's) - kept for the frame (placeCeilingAt) and answered for the build's own reads, which run before the frame has
 * seen the dungeon. @param {any} dfLocation @param {boolean} tuned @returns {number|null}
 */
export function enterDungeonPlace(dfLocation, tuned) {
  _dungeon = !tuned && isOnlinePage() ? dungeonCeiling(dfLocation?.mapTableData?.dungeonType) : null;
  return _dungeon;
}
/**
 * THE FRAME'S PLACE (scenes/world.js partyFrame, every frame, into mentorMode.js refreshMentor): online, inside a
 * dungeon the one built last; anywhere else the climate's ground. null offline.
 * @param {boolean} online @param {{ insideDungeon?: boolean } | null | undefined} inside worldModes.js insideContext's
 * @param {number} climateIndex @returns {number|null}
 */
export function placeCeilingAt(online, inside, climateIndex) {
  if (!online) return null;
  return inside?.insideDungeon ? _dungeon : groundCeiling(climateIndex);
}
/** Tests: no dungeon built. */
export function _resetPlaceSyncForTests() { _dungeon = null; }
