// @ts-check
// AUDIT DEX C3 (2026-10-20, bible/01-Overview/audits/Audit-DEX.md): ENEMYENTITY.GETENEMYGROUP'S ONE HOME - a leaf,
// importing nothing. EnemyEntity.GetEnemyGroup (EnemyEntity.cs:486-489) is FormulaHelper.GetEnemyEntityEnemyGroup, and
// every reader asks it: the to-hit bonus by enemy type (FormulaHelper.cs:1015-1029, combat/formulas.js), PlayerGPS
// .GetEntityFlags (PlayerGPS.cs:788) and PacifyEffect.IsGroupMatch (PacifyEffect.cs:132) - Detect, Dispel and Pacify,
// systems/nearbyObjects.js. formulas.js held the switch and the door a mod answers through (DEX4b); nearbyObjects held a
// copy of the switch beside it, so a mod's enemies took no group there - no Detect Undead found them, no Pacify Animal
// calmed them, no Dispel Daedra banished them. The switch and its door live here, where the pure readers reach them;
// formulas.js re-exports them.

/** DFCareer.EnemyGroups (DFCareer.cs). */
export const ENEMY_GROUPS = Object.freeze({ None: -1, Undead: 0, Daedra: 1, Humanoid: 2, Animals: 3 });

/** FormulaHelper.GetEnemyEntityEnemyGroup (FormulaHelper.cs:2746-2805),
 *  verbatim: the switch is on CareerIndex, NOT on MobileEnemy.Affinity.
 *  The four atronachs and every unlisted career are None; the horse is an animal.
 *  (Careers whose classic grouping disagrees carry DFU's own comment.) */
const ENEMY_GROUP_BY_CAREER = Object.freeze({
  0: 3, 3: 3, 4: 3, 5: 3, 6: 3, 11: 3, 20: 3, 34: 3, 39: 3, 40: 3,          // Animals (39/40 "grouped as undead in classic")
  1: 2, 2: 2, 7: 2, 8: 2, 9: 2, 10: 2, 12: 2, 13: 2, 14: 2, 16: 2,          // Humanoid
  21: 2, 22: 2, 24: 2, 41: 2, 42: 2,                                        // (41/42 "grouped as undead in classic")
  15: 0, 17: 0, 18: 0, 19: 0, 23: 0, 28: 0, 30: 0, 32: 0, 33: 0,            // Undead (17 "grouped as animal in classic")
  25: 1, 26: 1, 27: 1, 29: 1, 31: 1,                                        // Daedra
});
/** DEX4b (bible/04-Characters/Enemy-Expansion.md section 9): A MOD'S GROUP. DFU asks TryGetOverride
 *  ("GetEnemyEntityEnemyGroup") first (:2748-2750); Daggerfall Enemy Expansion's answers its own enemies' row and DFU's
 *  switch for the rest. `fn(careerIndex)` -> a group, or null for DFU's (a mod's enemy's career index is its id). */
const _groups = [];
/** @param {(careerIndex: number) => (number | null | undefined)} fn */
export function registerEnemyGroup(fn) {
  if (typeof fn !== 'function') throw new Error('registerEnemyGroup: a function of (careerIndex)');
  _groups.push(fn);
}
/** @param {number} careerIndex @returns {number} */
export function enemyEntityGroup(careerIndex) {
  for (const fn of _groups) {
    const g = fn(careerIndex);
    if (g != null) return g;
  }
  return ENEMY_GROUP_BY_CAREER[careerIndex] ?? ENEMY_GROUPS.None;
}
/** The test seam (formulas.js _resetFormulaDoors): every mod's group let go. */
export function _resetEnemyGroups() { _groups.length = 0; }
