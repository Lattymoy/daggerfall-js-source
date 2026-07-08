// Attribute stat-mod layer (S14). Standalone (no imports) so both the
// effect system and the combat formulas can read a live stat without
// forming an import cycle (formulas <- spellcast <- effects would close
// one if liveStat lived in effects.js).
//
// DFCareer.Stats order: 0 Strength .. 7 Luck - matches chargen's
// STAT_KEYS_ORDER exactly. Fortify effects (classic type 9, subType =
// the stat index) push a TEMPORARY additive modifier onto
// entity.activeEffects for a duration (DFU ChangeStatMod:
// statMods[stat] += magnitude). The live value any consumer reads is
// base + the sum of active fortify mods on that stat, so expiry
// restores the base cleanly and the raw stat is never mutated.

export const STAT_KEYS_ORDER = Object.freeze([
  'strength', 'intelligence', 'willpower', 'agility',
  'endurance', 'personality', 'speed', 'luck',
]);

/** The live value of a stat: base + every active fortify mod on it.
 *  Combat and advancement read THIS, never the raw base. */
export function liveStat(entity, statName) {
  const base = entity.stats?.[statName] ?? 0;
  let mod = 0;
  const list = entity.activeEffects;
  if (list) {
    for (const a of list) {
      if (a.kind === 'fortifyAttribute' && a.stat === statName) mod += a.magnitude;
    }
  }
  return base + mod;
}
