// @ts-check
// LEVEL-45 (2026-10-26, the owner: "Also bring the level cap to 45"; bible/01-Overview/bugs/Field-Bugs-2026-10-26d.md):
// THE CHARACTER'S LEVEL STOPS AT 45. A LEAF, read by advancement.js (Daggerfall's sum) and oblivionLeveling.js (the
// virtue bar), which import each other's neighbours, so neither grows a cycle.
//
// DFU HAS NO CAP: PlayerEntity.CheckForLevelUp raises the flag whenever FormulaHelper.CalculatePlayerLevel's
// floor((current - starting + 28) / 15) passes the level, and the sum stops only because six counted skills stop at
// 100 - a character made with a sum of 156 tops out at 31 (Field-Bugs-2026-10-20g, SWAP-CYCLE). The port's skills
// climb past 100 where they are mastered (masterSkills.js), each point a quarter of one in the sum (skillSoftcap.js
// effectiveSkill: 200 reads 140), so the ceiling moved with the masteries: 44 at 2/2/1 every mastered skill at 200, 47
// at MASTER-THREE's 3/2/1. The cap is the ceiling named: 45 on either lane, and never passed. On Daggerfall's sum it is
// reached at the end of the long climb past 100 by a career as made with Master Skills on (any starting sum up to 193;
// AUDIT FB1026d C7: a skill swap that raises the class's sum lowers the ceiling a level for every 15, and with Master
// Skills off it is 29 to 32); the virtue bar takes nothing from a skill at 100 (oblivionLeveling.js addSkillProgress),
// and fills to 45 well below it - the class's twelve skills at 100 carry it some twenty levels past (AUDIT FB1026d II C1). A
// DEPARTURE from CheckForLevelUp, offline and online.
//
// A character already past it (a level earned before the cap, SWAP-CYCLE's ladder) keeps its level: nothing lowers a
// level, the cap only stops the next one.

/** The highest level a character reaches. */
export const LEVEL_CAP = 45;

/** Whether `entity` stands at (or past) the cap - no level is owed it. */
export const atLevelCap = (entity) => (entity?.level ?? 1) >= LEVEL_CAP;

/**
 * AUDIT FB1026d C1/C2: A LEVEL LATCHED BEFORE THE CAP IS LET GO AT IT. A save from before the cap can hold a level owed
 * past it (`readyToLevelUp` rides the save), and so can an offline Oblivion character brought online (realmCustoms.js
 * crossLeveling) - and the window it opened had no level to give: the virtue screen's Ascend never closed it, the
 * classic sheet handed out the pool with no level. So the latch is let go where it is read - the load, both checks, the
 * sheet's door and its rollout. The Oghma Infinium's latch (artifactEffects.js) is the book's: its points come at the
 * cap too, and it is never let go here. Answers whether one was let go. @param {any} entity
 */
export function releaseCapLatch(entity) {
  if (!entity?.readyToLevelUp || entity.oghmaLevelUp || !atLevelCap(entity)) return false;
  entity.readyToLevelUp = false;
  entity.pendingLevel = null;
  entity.pendingBonusPool = null;
  return true;
}
