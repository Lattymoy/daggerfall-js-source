// CAST-SPEED (2026-10-08, Mac on a Discord post, "Morrowind magic anims nerf you": "I think we nerf the animation of
// the regular sprite spellcasting to fall in line with the morrowind model. Also have casting speed a new rarity affix
// along with scaling with speed"). THE PORT'S OWN LAW. Daggerfall's hands step on a fixed clock
// (FPSSpellCasting.animSpeed) and Morrowind's spellcast group plays at speed 1; here both lanes run at ONE RATE - the
// caster's live Speed, and the casting speed the loot they wear carries (lootRarity.js's castSpeed line, summed and
// capped by systems/loot/lootPowers.js). combat/weapon/weaponRig.js castSpellAnim reads it once a cast, and hands it to both the
// classic frames (combat/fpsSpellCasting.js) and the Morrowind arm's spellcast group (combat/fpArm.js castSpell).
//
// A leaf: statMods alone, so combat/ and systems/ both read it with no cycle. The loot's share comes through a named
// registry, as SET2's spell-cost modifiers do (systems/spellcost.js registerSpellCostMod).

import { liveStat, MAX_STAT_VALUE } from './statMods.js';
import { budgeted } from './power/powerBudget.js';   // PWR1: the modifiers' percents through the castSpeed channel's curve (a leaf)

/** The Speed a cast runs at rate 1 - the attribute's middle. */
export const CAST_SPEED_PIVOT = 50;
/** Speed points per whole rate: Speed 100 casts 25% faster than the pivot, Speed 0 25% slower. */
export const CAST_SPEED_SPAN = 200;
/** The slowest and the fastest a cast runs, whatever feeds it. */
export const CAST_RATE_MIN = 0.5;
export const CAST_RATE_MAX = 2;

const _mods = new Map();
/** Named modifiers, `fn(entity) -> percent`, each added onto the rate (lootPowers' castSpeed line). A non-function
 *  removes the name. */
export function registerCastSpeedMod(name, fn) { if (typeof fn === 'function') _mods.set(name, fn); else _mods.delete(name); }

/** Speed's share alone: 1 at the pivot, the attribute clamped to its own range first. */
export function speedCastRate(speed) {
  const s = Math.min(MAX_STAT_VALUE, Math.max(0, Number.isFinite(speed) ? speed : CAST_SPEED_PIVOT));
  return 1 + (s - CAST_SPEED_PIVOT) / CAST_SPEED_SPAN;
}

/** The rate a cast runs at: Speed's share plus every modifier's percent - PWR1 (bible/05-Combat/Power-Arc.md section
 *  4): summed and landed through the castSpeed channel's curve - clamped. 1 for no caster. */
export function castRate(entity) {
  if (!entity) return 1;
  const r = speedCastRate(liveStat(entity, 'speed')) + budgeted('castSpeed', castSpeedSum(entity)) / 100;
  return Math.min(CAST_RATE_MAX, Math.max(CAST_RATE_MIN, r));
}
/** PWR1: every casting-speed modifier's percent, summed before the curve (the Stats page shows it beside what lands). */
export function castSpeedSum(entity) {
  let pct = 0;
  for (const fn of _mods.values()) {
    const v = fn(entity);
    if (Number.isFinite(v)) pct += v;
  }
  return pct;
}

/** A rate a caller handed in, made safe: a finite positive number inside the clamp, else 1. */
export const validCastRate = (rate) => (Number.isFinite(rate) && rate > 0 ? Math.min(CAST_RATE_MAX, Math.max(CAST_RATE_MIN, rate)) : 1);
