// @ts-check
// WILD-ROAD (FIELD BUGS 2026-10-04e, Discord - Private Joker, "Wilderness Encounter Chances": "having to completely halt
// my travel because 1 rat chose today to die can be quite the interruption ... If I'm going to be stopped on the road,
// let it be for something important or dangerous. a roving orc patrol, a bandit holdup, interrupting a necromancer
// party. This shouldn't be every encounter of course. A level 1 leaving privateers hold can take care of the rat
// problems"). DFU's lone wanderer (PlayerEntity.IntermittentEnemySpawn, systems/encounters.js chooseRandomEnemy - the
// verbatim band [L-3, L+3] four rolls in five, [0, L+1] or [0, 19] the fifth) keeps the bottom of its table in reach
// at every level, and a journey (Travel Options) or the Overworld stops for every wanderer it meets (AUDIT OW5b E1,
// journeyMet) - so a level 20 traveller was pulled off the road by a rat.
//
// ON THE ROAD - a Travel Options journey under way, or the Overworld's raised view up, and not resting - with the switch
// on (systems/features.js 'road-encounters', on by default; off is DFU's wanderer, unchanged):
//   - a TRIVIAL wanderer is passed by: a monster whose own level (ENEMY_BASICS) is at most a third of the traveller's
//     (TRIVIAL_LEVEL_RATIO) - a Rat from level 3, an Imp from 6, a Giant Bat from 9, an Orc from 15, a Giant from 30, a
//     Lich from 60. The minute passes, nothing stands and nothing stops. A class foe (id 128 and up) has no level of its
//     own there - it is built at the traveller's - and is never trivial.
//   - the rest come in COMPANY now and then, a patrol of their own kind: from level 5, a chance of level/50 (at most
//     two in five) of one more, then one more each six levels past five (ROAD_COMPANY_MAX at most) - an orc patrol, a
//     brigands' holdup. Never a solitary kind (mobileFactions.js SOLITARY_TYPES - the PSCALE1 law), and never past
//     ROAD_PARTY_MAX with the party's own extras (partyScale.js).
// Off the road nothing changes. Pure. Not a DFU member - Ledger A (WILD-ROAD).

import { ENEMY_BASICS } from '../characters/enemy/enemyBasics.js';
import { SOLITARY_TYPES } from '../characters/mobile/mobileFactions.js';

/** SOLITARY_TYPES asked of any mobile id (the Set is typed by its own members). @param {number} t */
const solitary = (t) => /** @type {Set<number>} */ (SOLITARY_TYPES).has(t);

/** A monster this many times weaker (by level) than the traveller is passed by on the road. */
export const TRIVIAL_LEVEL_RATIO = 3;
/** From this level a wanderer may bring company on the road. */
export const ROAD_COMPANY_LEVEL = 5;
/** At most this many more with it, and this many in all with the party's own extras. */
export const ROAD_COMPANY_MAX = 3;
export const ROAD_PARTY_MAX = 4;

/**
 * Whether a wanderer of `mobileType` is passed by on the road by a traveller of `playerLevel`. Pure.
 * @param {number} mobileType @param {number} playerLevel
 */
export function trivialOnRoad(mobileType, playerLevel) {
  const lv = /** @type {any} */ (ENEMY_BASICS)[mobileType]?.level;   // none for a class foe (built at the traveller's level)
  if (!Number.isFinite(lv) || !Number.isFinite(playerLevel)) return false;
  return lv * TRIVIAL_LEVEL_RATIO <= playerLevel;
}

/**
 * How many more of its kind come with a wanderer met on the road: 0 most often; `roll01` the one roll. Pure.
 * @param {number} mobileType @param {number} playerLevel @param {number} roll01
 */
export function roadCompany(mobileType, playerLevel, roll01) {
  if (solitary(mobileType) || !(playerLevel >= ROAD_COMPANY_LEVEL)) return 0;
  const chance = Math.min(0.4, playerLevel / 50);
  if (!(roll01 < chance)) return 0;
  return Math.min(ROAD_COMPANY_MAX, 1 + Math.floor((playerLevel - ROAD_COMPANY_LEVEL) / 6));
}

/**
 * How many stand for a wanderer: one for a solitary kind (PSCALE1), else one, the party's extras and the road's company,
 * at most ROAD_PARTY_MAX. Pure.
 * @param {number} mobileType @param {number} partyExtra @param {number} [company]
 */
export function wandererCount(mobileType, partyExtra, company = 0) {
  if (solitary(mobileType)) return 1;
  return Math.min(ROAD_PARTY_MAX, 1 + Math.max(0, partyExtra | 0) + Math.max(0, company | 0));
}
