// Attribute stat-mod layer (S14; drains joined in S15). Standalone
// (no imports) so both the effect system and the combat formulas can
// read a live stat without forming an import cycle (formulas <-
// spellcast <- effects would close one if liveStat lived in
// effects.js).
//
// DFCareer.Stats order: 0 Strength .. 7 Luck - matches chargen's
// STAT_KEYS_ORDER exactly. Fortify effects (classic type 9, subType =
// the stat index) push a TEMPORARY additive modifier onto
// entity.activeEffects for a duration (DFU ChangeStatMod:
// statMods[stat] += magnitude); Drain/Transfer effects (types 7/11)
// push a PERMANENT-until-healed negative one (DFU SetStatMod(stat,
// -magnitude)). The live value any consumer reads is base + the sum
// of active mods on that stat, so expiry/heal restores the base
// cleanly and the raw (permanent) stat is never mutated.

export const STAT_KEYS_ORDER = Object.freeze([
  'strength', 'intelligence', 'willpower', 'agility',
  'endurance', 'personality', 'speed', 'luck',
]);

/** The live value of a stat: base + every active mod on it (fortify
 *  adds, drain/transfer subtracts). Combat and advancement read THIS,
 *  never the raw base. */
export function liveStat(entity, statName) {
  const base = entity.stats?.[statName] ?? 0;
  let mod = 0;
  const list = entity.activeEffects;
  if (list) {
    for (const a of list) {
      if (a.stat !== statName) continue;
      if (a.kind === 'fortifyAttribute') mod += a.magnitude;
      else if (a.kind === 'drainAttribute' || a.kind === 'transferAttribute') mod -= a.magnitude;
    }
  }
  return base + mod;
}

// ---- The fatigue stat (S15), DaggerfallEntity verbatim ----
// Classic fatigue is stored x64: FatigueMultiplier = 64,
// MaxFatigue = (LiveStrength + LiveEndurance) * 64. Spell effects
// that heal/damage fatigue pass assignMultiplier=true, i.e. their
// magnitude lands x64. Current fatigue is a stored entity field
// (entity.fatigue); the max is always derived live, so a fortified
// or drained strength moves the ceiling exactly as DFU's getter does.
export const FATIGUE_MULTIPLIER = 64;

/** DaggerfallEntity.MaxFatigue, verbatim (live stats). */
export function maxFatigue(entity) {
  return (liveStat(entity, 'strength') + liveStat(entity, 'endurance')) * FATIGUE_MULTIPLIER;
}
