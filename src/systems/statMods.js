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

/** FormulaHelper.MaxStatValue(), verbatim. DaggerfallStats' maxMods
 *  layer (the only writer is the unported Mace of Molag Bal effect)
 *  stays at 0, so the live ceiling is this flat 100. */
export const MAX_STAT_VALUE = 100;

/** The live value of a stat: base + every active mod on it (fortify
 *  adds, drain/transfer subtracts, disease entries carry an
 *  accumulated NEGATIVE per-stat statMods map - S18), CLAMPED to
 *  0..MaxStatValue exactly as DaggerfallStats.GetLiveStatValue does
 *  (:157-163 - `value = Mathf.Clamp(permanent + mods, 0, maxValue)`).
 *  The clamp is on the READ only: the producers (poison/disease
 *  per-minute and per-day damage, fortify magnitudes) accumulate
 *  unbounded, as DFU's do. Combat and advancement read THIS, never
 *  the raw base. */
export function liveStat(entity, statName) {
  const base = entity.stats?.[statName] ?? 0;
  let mod = 0;
  const list = entity.activeEffects;
  if (list) {
    for (const a of list) {
      // disease/poison entries carry a signed per-stat statMods map
      // (poison drugs push POSITIVE mods - S19b)
      if (a.kind === 'disease' || a.kind === 'poison') { mod += a.statMods?.[statName] ?? 0; continue; }
      if (a.stat !== statName) continue;
      if (a.kind === 'fortifyAttribute') mod += a.magnitude;
      else if (a.kind === 'drainAttribute' || a.kind === 'transferAttribute') mod -= a.magnitude;
    }
  }
  return Math.min(Math.max(base + mod, 0), MAX_STAT_VALUE);
}

/** EntityEffectManager.refreshModsDelay (:79) - UpdateEntityMods runs
 *  on a REAL-TIME timer out of Update(), "more frequently than magic
 *  rounds, but not too frequently", and the reset is to zero rather
 *  than a subtract (:213-217). */
export const REFRESH_MODS_DELAY = 0.2;

/** The tail of EntityEffectManager.UpdateEntityMods (:1855-1866):
 *
 *      // Kill host if any stat is reduced to 0 live total
 *      for (int i = 0; i < DaggerfallStats.Count; i++)
 *          if (entityBehaviour.Entity.Stats.GetLiveStatValue(i) == 0)
 *          { entityBehaviour.Entity.CurrentHealth = 0; return; }
 *
 *  AUDIT 24 (wave 31): unported. A stat drained to zero was merely a
 *  stat at zero - Drain Strength held long enough, a Transfer, or a
 *  disease with a heavy per-day stat cost left the character alive at
 *  Strength 0 (and, because the fatigue ceiling is
 *  (LiveStrength + LiveEndurance) x 64, at a max fatigue of zero and
 *  therefore permanently collapsing). DFU kills outright.
 *
 *  The port has no AssignMods moment - liveStat is computed on read -
 *  so the check rides the same real-time cadence DFU gives it, off the
 *  host tick's dt. The accumulator lives on the entity so it survives a
 *  host swap, exactly like the Running tally's.
 *
 *  @param {object} entity
 *  @param {object} sinks   the entity's own doors - the kill goes through
 *                          `hurt`, which is the one damage door, so the
 *                          death presenter runs (DFU's CurrentHealth
 *                          setter raises OnDeath the same way)
 *  @param {number} dt      real seconds since the last host tick
 *  @returns {boolean} true if the host was killed this call
 */
export function killIfAnyLiveStatZero(entity, sinks, dt = 0) {
  if (!entity) return false;
  entity._refreshModsTimer = (entity._refreshModsTimer ?? 0) + (Number(dt) || 0);
  if (!(entity._refreshModsTimer > REFRESH_MODS_DELAY)) return false;
  entity._refreshModsTimer = 0;
  if ((entity.health ?? 0) <= 0) return false;   // already dead: DecreaseHealth has nothing to take
  for (const stat of STAT_KEYS_ORDER) {
    // A stat the port has never recorded is not a stat at zero. DFU's
    // DaggerfallStats always carries all eight permanent values, so
    // GetLiveStatValue is never answering about a stat that does not
    // exist; here foes and fixtures routinely carry a partial block, and
    // reading the ?? 0 default as "drained to death" would kill every one
    // of them on their first frame.
    if (entity.stats?.[stat] == null) continue;
    if (liveStat(entity, stat) !== 0) continue;
    sinks?.hurt?.(entity.health);
    return true;
  }
  return false;
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

/** DaggerfallEntity.MaxBreath, verbatim: LiveEndurance / 2 (C# int
 *  division). Current breath is a stored field (entity.currentBreath,
 *  P12); 0 whenever the head is above water. */
export function maxBreath(entity) {
  return Math.trunc(liveStat(entity, 'endurance') / 2);
}

/** PlayerEntity per-minute/per-jump fatigue losses, verbatim (RAW
 *  fatigue units - the x64 belongs to spell magnitudes only). The
 *  swimming loss applies on a FAILED Dice100 roll vs the live
 *  Swimming skill; success costs the default. */
export const FATIGUE_LOSS = Object.freeze({
  Default: 11, Climbing: 22, Running: 88, Swimming: 44, Jumping: 11,
});
