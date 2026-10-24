// @ts-check
// LEVEL-EVEN (2026-10-19, Discord #suggestions "Make Health from Endurance retroactive", through Mac; asked which of
// retroactive endurance health, an averaged roll and a fixed bonus pool, Mac: "Your opinion" - the floor and the fixed
// pool, online): "make the endurance effect on health per level retroactive, so that people are not penalized dozens or
// possibly hundreds of hp for not investing in endurance as early as possible ... making class health per level apply as
// an average would help people not get gimped or buffed permanently by sheer randomness ... Making levels consistently
// give 5 attribute points".
//
// THE FLOOR. Daggerfall keeps one number - the stored maximum, each level's FormulaHelper.CalculateHitPointsPerLevelUp
// roll added to it (advancement.js applyLevelUp) - so what a level rolled under a low Endurance is never paid back, and a
// run of low rolls is a body short for good. Online the character's maximum is never below what a character of its class
// and level would hold had it rolled every level at the class's average with the Endurance it has NOW:
//
//     25 + h + (level - 1) * max(1, (trunc(h / 2) + h) / 2 + HitPointsModifier(endurance))
//
// (`h` the career's HitPointsPerLevel; 25 + h is RollMaxHealth's level 1). The Endurance is the permanent one with the
// Firmament's stars in it (FIRM1's attribute gain, awake online alone) - not a spell's or a ring's, which come and go
// in a fight and are read by nothing that stores health. The floor rides the ONLINE LAYER beside Renown's
// (renownLayer.js), so it is never saved, never offline, and lifts current health by its share as the layer does; a
// character whose rolls were above it keeps them. A DEPARTURE from CalculateHitPointsPerLevelUp's accumulation, online.
//
// THE POOL. Online every level's bonus pool is 5 - FormulaHelper.BonusPool's Range(4, 7) is 4 to 6 (advancement.js
// bonusPoolFor), whose mean this is. A DEPARTURE, online.

import { hitPointsModifier } from '../combat/formulas.js';

/** LEVEL-EVEN: the bonus pool every online level hands out. */
export const ONLINE_BONUS_POOL = 5;

/** The class's average CalculateHitPointsPerLevelUp roll at `endurance`, before the floor of 1. */
export const averageLevelHp = (h, endurance) => (Math.trunc(h / 2) + h) / 2 + hitPointsModifier(endurance);

/** The floor: the maximum health of `entity`'s class at its level, every level rolled at the average with `endurance`.
 *  0 for an entity with no career or level. Whole. */
export function evenHpFloor(entity, endurance) {
  const h = entity?.career?.hitPointsPerLevel, level = entity?.level;
  if (!(h > 0) || !(level >= 1) || !Number.isFinite(endurance)) return 0;
  return Math.floor(25 + h + (Math.trunc(level) - 1) * Math.max(1, averageLevelHp(h, endurance)));
}

/** The health the floor lays over the stored maximum (`rawMaxHealth`) at `endurance`: whole, never negative. */
export function evenHpOf(entity, endurance) {
  const stored = Number.isFinite(entity?.rawMaxHealth) ? entity.rawMaxHealth : entity?.maxHealth;
  if (!Number.isFinite(stored)) return 0;
  return Math.max(0, evenHpFloor(entity, endurance) - stored);
}
