// DEX1 (bible/04-Characters/Enemy-Expansion.md) - AN ENEMY PAST MobileTypes: WHAT A MOD REGISTERS SO DFU CALLS IT ONE.
//
// Daggerfall Unity's enemies are MobileTypes 0-42 and 128-146, and any other id is an enemy exactly when a mod has
// registered a career for it: SetupDemoEnemy.ApplyEnemySettings (:160-185) makes 0-42 a monster and 128-146 a class,
// and otherwise asks DaggerfallEntity.GetCustomCareerTemplate - a template there makes the id an enemy, a monster or a
// class by DaggerfallEntity.IsClassEnemyId's 128 bit, and no template makes it EntityTypes.None. EnemyEntity.SetEnemyCareer
// (:248-276) reads the same template first, and TextManager.GetLocalizedEnemyName (:432-461) names such an id by the
// text provider's GetCustomEnemyName, else the template's own Name. This module is those two registries
// (DaggerfallEntity.CustomCareerTemplates :935-962, the TextProvider's GetCustomEnemyName chain) and nothing else: a
// leaf, so the enemy table and the entity builder both read it without a cycle.
//
// A career here is a TEMPLATE, not a career: the port's careers are read out of the player's ARENA2 (MONSTER.BSA's
// ENEMY*.CFG, CLASS*.CFG) when they are first asked for, and a mod's career may be one of those under the mod's edits.
// So a template carries the career's name - all a name lookup needs - and `load(fetchBytes)`, which resolves the career
// itself (enemy/enemyEntity.js loadEnemyCareer).

/** @typedef {{ name: string, load: (fetchBytes: Function) => Promise<object|null> }} CustomCareerTemplate */

/** @type {Map<number, CustomCareerTemplate>} */
const _careers = new Map();

/** DaggerfallEntity.RegisterCustomCareerTemplate (:957-962): by the indexer, so a later mod overwrites an earlier one's
 *  ("mod 1 provides new enemies, mod 2 rebalances them"). */
export function registerCustomCareerTemplate(enemyId, template) {
  if (!Number.isInteger(enemyId) || typeof template?.load !== 'function') throw new Error(`registerCustomCareerTemplate: ${enemyId} needs a template with load()`);
  _careers.set(enemyId, Object.freeze({ name: String(template.name ?? ''), load: template.load }));
}

/** DaggerfallEntity.GetCustomCareerTemplate (:942-948): the template, or null. */
export const customCareerTemplate = (enemyId) => _careers.get(Number(enemyId)) ?? null;

/** The ids a mod registered a career for, ascending (a census's read; DFU keeps no such list). */
export const customEnemyIds = () => [..._careers.keys()].sort((a, b) => a - b);

/** @type {Array<(enemyId: number) => (string|null|undefined)>} */
const _names = [];
/** A text provider's GetCustomEnemyName (ITextProvider; a mod wraps the provider it found - BestiaryTextProvider -
 *  so the LAST registered answers first and hands on what it does not know, FallbackTextProvider's chain). */
export function registerCustomEnemyName(fn) {
  if (typeof fn !== 'function') throw new Error('registerCustomEnemyName: a function of the enemy id');
  _names.unshift(fn);
}

/** TextProvider.GetCustomEnemyName down the chain: the first non-empty answer, or null (the base provider's). */
export function customEnemyName(enemyId) {
  for (const fn of _names) {
    const n = fn(Number(enemyId));
    if (typeof n === 'string' && n !== '') return n;
  }
  return null;
}

/** The test seam: every registration let go. */
export function clearCustomEnemies() { _careers.clear(); _names.length = 0; }
