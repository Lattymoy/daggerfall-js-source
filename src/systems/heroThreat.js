// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BAL11 (2026-10-17) — THE HERO'S THREAT: past level 10 and Renown 15 the foes answer the hero.
//
// The field report (the Discord, LostMyLeg, 2026-10-17): "with all the systems we have in place the game gets too
// easy pretty early, i would say starting around character level 10/renown 15ish ... they prob need like 4x-6x more
// damage and 2x-3x more hp ... Those multipliers should also count to every type of mobs elite etc ... early game is
// fine". Mac handed it over to be calculated rather than guessed (bible/05-Combat/Balance-Arc.md section 17).
//
// THE MEASUREMENT (section 17.2): a stated player at every level against DFU's own encounter band at that level, through
// the real overhaul blow both ways, with the online layer (Renown's health, the Firmament's blow and guard channels at
// their caps) and a stated kit (the ladder's bands' middles) - tools/heroMeasure.mjs, seeded. What a kill costs the
// player's health falls about 13% a level from 10 to 30 offline - x4.3 by level 20, x16 by 30, flat after it (the
// encounter band tops out at 16, the bestiary at 21, the skills at 100) - and Renown takes it down by x1.6 more from 15
// to 30, x2 by 50. DFU's foes do not move past their row; the place (BAL3) and the elites do not read the hero at all.
//
// THE LAW. Each Daggerfall level past HERO_THREAT.level.from, to its `to`, a foe's blows land 7% harder and it stands
// 4% tougher; each Renown past HERO_THREAT.renown.from, to its `to`, 1% and 0.5% more - compounding, so the threat
// keeps the measured shape (the player's growth compounds too). It answers three quarters of the measured growth (of
// its compounding) and leaves the hero the last quarter: a kill costs a level-20 Renown-30 hero about two thirds of what
// it costs a level-10 Renown-15 one, where it cost under a fifth (16% of a life to 24%; it was 4%). Damage carries two
// thirds of it (the report's split - "mobs dont need much more hp": the danger is the blow, never a longer fight). At
// level 30 and Renown 50 a foe hits x5.5 and stands x2.6 - the report's 4x-6x and 2x-3x, reached at the top of the
// curve, not at its foot.
//
// WHOSE LEVEL. The threat is read where the foe is built, off the builder's player - and every client builds its own copy
// of every foe it sees, so a foe's blows at me are MY threat's: my own foes, a dungeon's layout copy, a peer's puppet
// (its blows alone - its maximum is its owner's word, `k`). Mentoring, the group's level (mentorMode.js effectiveLevel)
// and no Renown (the Firmament sleeps while mentoring). Offline Renown is null - the level alone.
//
// WHERE IT STANDS. The seams BAL3's place already runs through (systems/skillSoftcap.js progressionScaling, one writer -
// characters/enemy/enemyEntity.js applyProgressionScaling): every dungeon foe and every foe of the wilds, of every kind -
// an elite, a champion, a revenant, the zone's own - over its kind's own scale, as the place compounds with them. Never
// an ally, the watch, a town's or a building's ground, or a tuned stage (a made level, the arena's floor); never a body
// the relay keeps (a gate's lord, an Elite Breach's, the Remnant). The gate is the loot ladder's, as the place's,
// the elites' and the champions' are: the ladder off is DFU's own foes.
//
// Not a DFU member: DFU's monsters stand at their row whatever the player's level (EnemyEntity.SetEnemyCareer), and a
// class foe at the player's level. Ledger A (BAL11).
// ═══════════════════════════════════════════════════════════════════

import { effectiveLevel } from './mentorMode.js';
import { sigilRenown } from './sigil/sigil.js';
import { lootRarityOn } from './loot/lootRarity.js';

/** THE TUNING TABLE. `from`: the first level that pays nothing; `to`: the last that pays; `damage` and `health`: the
 *  factor each level between them stands on a foe, compounding. */
export const HERO_THREAT = Object.freeze({
  level: Object.freeze({ from: 10, to: 30, damage: 1.07, health: 1.04 }),
  renown: Object.freeze({ from: 15, to: 50, damage: 1.01, health: 1.005 }),
});

/** How many of a track's levels pay: `v` past `from`, never past `to` (a whole number; 0 for anything not a number). */
const stepsOf = (v, { from, to }) => (Number.isFinite(v) ? Math.max(0, Math.min(to, Math.trunc(/** @type {number} */ (v))) - from) : 0);

/**
 * The hero's threat at a Daggerfall level and a Renown (null offline, or not yet known): the factors a foe's blows and
 * its health are stood at, each 1 at or under level 10 and Renown 15. Pure.
 * @param {number} level
 * @param {number|null} [renown]
 * @returns {{ damage: number, health: number, level: number, renown: number }} `level` and `renown`: the steps paid
 */
export function heroThreat(level, renown = null) {
  const L = stepsOf(level, HERO_THREAT.level), R = stepsOf(renown, HERO_THREAT.renown);
  return {
    damage: HERO_THREAT.level.damage ** L * HERO_THREAT.renown.damage ** R,
    health: HERO_THREAT.level.health ** L * HERO_THREAT.renown.health ** R,
    level: L, renown: R,
  };
}

/**
 * The spawn door's reader: the threat a foe built now stands at against `player` - its level as the world is built
 * around it (a mentor's, the group's), its Renown unless mentoring - or null where none stands (the ladder off, or
 * nothing to pay). `puppet`: another client's foe - its blows alone; its health is its owner's word.
 * @param {any} player
 * @param {{ puppet?: boolean }} [o]
 * @returns {{ damage: number, health: number, level: number, renown: number } | null}
 */
export function heroThreatOf(player, { puppet = false } = {}) {
  if (!player || !lootRarityOn()) return null;
  const t = heroThreat(effectiveLevel(player), player._mentor ? null : sigilRenown());
  if (!(t.damage > 1 || t.health > 1)) return null;
  return puppet ? { ...t, health: 1 } : t;
}
