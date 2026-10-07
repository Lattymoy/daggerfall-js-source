// @ts-check
// SD4a (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 5): THE SUPER DUNGEON'S
// DIFFICULTY - the port's hardest. A Hollow is a Super dungeon by its location's word (`superTier`, read by the one law,
// systems/dungeonTier.js), and the dungeon host (scenes/dungeonContext.js) reads these where it reads the Elite's
// (world/spawnedDungeons.js ELITE_*):
//
//   |                        | Regular      | Elite        | Super                                                  |
//   | foes per enemy marker  | 1            | 3            | 3 - the Elite's own expansion (characters/              |
//   |                        |              |              | dungeonEnemies.js expandEliteEnemies), its 64 KiB frame |
//   |                        |              |              | budget proven at 151 markers                           |
//   | foe health / damage    | x1 / x1      | x2 / x2      | x4 / x2.5                                              |
//   | foe level band         | the player's | the player's | at least SUPER_FOE_LEVEL_MIN - the tables' top band     |
//   | elite foes             | 1 at 20%     | 3-4          | 6 (systems/eliteFoes.js)                               |
//   | loot                   | -            | +20%         | +50% drop and quality, bodies and piles                |
//   | the dungeon's fires    | all          | half         | none - the Hour is cold (world/dungeonFires.js)        |
//
// THE LEVEL BAND: ChooseRandomEnemyType (characters/dungeonEnemies.js) draws from an encounter table's last six rows at
// any level past 18 on both its arms - and the alternate arm's power is full at 20 - so 24 is the top band whatever the
// dice say: Daedra, liches, ancient vampires. A class foe stands at the band's level too (its career's health and skills
// are its level's). The player's own level is never moved: the loot tables still read it.
//
// Online only, as the Hollow is. Not a DFU member. Ledger A (SUPER-DUNGEONS).

/** Health and damage multipliers for a Super dungeon's foes (the Elite's x2 and x2). */
export const SUPER_HEALTH_SCALE = 4;
export const SUPER_DAMAGE_SCALE = 2.5;
/** The least level a Super dungeon's foes are rolled and built at. */
export const SUPER_FOE_LEVEL_MIN = 24;
/** How many elite foes a Super dungeon holds (an Elite one 3 or 4) - fewer only if it has fewer foes. */
export const SUPER_ELITE_FOES = 6;
/** Loot in a Super dungeon: item drop chance x1.5, rarity odds x1.5 (the Elite's x1.2) - bodies and treasure piles. */
export const SUPER_LOOT_DROP_MULT = 1.5;
export const SUPER_LOOT_QUALITY_MULT = 1.5;

/** The level a Super dungeon's foes are rolled and built at: the player's, never under SUPER_FOE_LEVEL_MIN. */
export const superFoeLevel = (level) => Math.max(SUPER_FOE_LEVEL_MIN, Number.isFinite(level) ? Math.floor(level) : 0);

/**
 * A foe built from a Super dungeon's record: x4 health, x2.5 damage (combat/formulas.js calculateAttackDamage reads
 * `damageScale` at its tail, so every blow door is covered, as the Elite's) - and the Elite Dungeon's mark besides, so
 * its poise (ai/tells.js poiseSpecial) and its body's loot cap (systems/foeLootCap.js) are an Elite dungeon's at the
 * least. Answers the entity.
 * @template {object | null | undefined} T
 * @param {T} entity
 * @returns {T}
 */
export function scaleSuperFoe(entity) {
  if (!entity) return entity;
  const e = /** @type {any} */ (entity);
  e.maxHealth = Math.max(1, Math.round((e.maxHealth || 1) * SUPER_HEALTH_SCALE));
  e.health = e.maxHealth;
  e.healthMult = (e.healthMult ?? 1) * SUPER_HEALTH_SCALE;   // TELL1: what was stood on the kind's own health (its poise)
  e.damageScale = SUPER_DAMAGE_SCALE;
  e.elite = true;
  return entity;
}

/** A Super dungeon's loot for a foe's body (hostCombat.spawnEnemyLoot's options) - the Elite's shape, at +50%. */
export const SUPER_LOOT_OPTS = Object.freeze({ lootDropMult: SUPER_LOOT_DROP_MULT, lootQualityMult: SUPER_LOOT_QUALITY_MULT });
