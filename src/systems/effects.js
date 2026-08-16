// The effect spine (Systems S7 - effect library I; S15 grows the
// attribute/fatigue families). Verbatim from DFU EntityEffect/
// EntityEffectBroker + the effect classes (MIT, Daggerfall Workshop):
//   one MAGIC ROUND = one CLASSIC MINUTE (the broker catches up per
//   game minute - our S3b clock already counts them)
//   duration (rounds) = DurationBase + DurationPlus x
//     floor(casterLevel / DurationPerLevel)  (no roll; per-0 guarded)
//   HealHealth      = classic (10, 8): instant IncreaseHealth(mag)
//   DamageHealth    = classic (4, 0):  instant damage (S4b behavior)
//   ContinuousDamageHealth = classic (1, 0): DecreaseHealth EVERY
//     round for the duration, magnitude ROLLED PER ROUND
//     (GetMagnitude computes fresh each MagicRound - verbatim)
// The saving throw is rolled FRESH every magic round of a continuous
// effect (audit F10 - DFU GetMagnitude -> ModifyEffectAmount rolls
// SavingThrow on every call), and ONLY when the spell is not
// CasterOnly (S15 parity fix: GetMagnitude gates ModifyEffectAmount
// on ParentBundle.targetType != TargetTypes.CasterOnly - a self-cast
// spell never rolls a save; the pre-S15 shape saved damage always and
// heals never). Every effect fires its INITIAL magic round at
// assignment (audit F17 - EntityEffectManager.AssignBundle: "gets
// initial magic round"), consuming round 1; re-casts of an incumbent
// STACK rounds onto it (audit F12 - AddState "Stack my rounds onto
// incumbent") and fire no initial round (the joining instance is
// never added to liveEffects). Effects outside these keys stay
// FLAGGED skipped (the library grows here; the cure family (3, 0..2)
// pends disease/poison/paralysis).

import { savingThrow, rollMagnitude, EFFECT_FLAGS } from './spellcast.js';
import { STAT_KEYS_ORDER, FATIGUE_MULTIPLIER, maxFatigue } from './statMods.js';

export { FATIGUE_MULTIPLIER, maxFatigue };

const ELEMENT_EFFECT_FLAG = Object.freeze([EFFECT_FLAGS.Fire, EFFECT_FLAGS.Frost, EFFECT_FLAGS.Poison, EFFECT_FLAGS.Shock, EFFECT_FLAGS.Magic]);

// S8/P11: the duration buffs, classic keys verbatim - incumbent
// self-effects tracked by kind (IsLikeKind is settings-blind for all
// four); a re-cast STACKS its rounds onto the incumbent (F12).
// Consumers: slowfall scales the player's fall; chameleonNormal
// halves foe sight range (concealment); waterWalking restores normal
// speed while swimming (P11); levitate (14,255) drives the
// LevitateMotor path (P11).
export const BUFF_KINDS = Object.freeze({
  '25,255': 'slowfall',
  '31,255': 'waterWalking',
  '23,0': 'chameleonNormal',
  '14,255': 'levitate',
});
export const buffKind = (e) => BUFF_KINDS[`${e.type},${e.subType}`] ?? null;
export const hasActiveEffect = (entity, kind) =>
  !!entity.activeEffects?.some((a) => a.kind === kind);   // presence = active; expired entries End on the NEXT tick pass (DFU shape)

export const isHealHealth = (e) => e.type === 10 && e.subType === 8;
export const isDamageHealth = (e) => e.type === 4 && e.subType === 0;
export const isContinuousDamage = (e) => e.type === 1 && e.subType === 0;
// SpellPoints (magicka): DamageSpellPoints (4, 2) and
// ContinuousDamageSpellPoints (1, 2), verbatim. S15 PARITY FIX: the
// S13 slice had mapped (10, 9) to HealSpellPoints - in DFU that
// classic key belongs to HEAL FATIGUE (HealFatigue.ClassicKey);
// DFU's Heal-SpellPoints effect is potion-only and carries NO classic
// key, so no classic spell restores magicka and the restoreMagicka
// door left with the wrong key.
// Fortify{Attribute} (classic type 9, subType = the stat index 0..7).
// The stat-mod layer (STAT_KEYS_ORDER, liveStat) lives standalone in
// statMods.js to avoid a formulas<-spellcast<-effects import cycle.
export const isFortifyAttribute = (e) => e.type === 9 && e.subType >= 0 && e.subType <= 7;

export const isDamageSpellPoints = (e) => e.type === 4 && e.subType === 2;
export const isContinuousDamageSpellPoints = (e) => e.type === 1 && e.subType === 2;

// S15: the attribute families, classic keys verbatim.
//   Drain{Attribute}     (7, 0..7)  - permanent-until-healed negative stat mod
//   Heal{Attribute}      (10, 0..7) - instant heal of DRAIN damage only
//   Transfer{Attribute}  (11, 0..7) - drain on target + caster heals the same stat
//   TransferHealth       (11, 8)    - instant damage target / heal caster
//   TransferFatigue      (11, 9)    - instant fatigue drain target / restore caster
//   HealFatigue          (10, 9)    - instant fatigue restore (x64)
//   DamageFatigue        (4, 1)     - instant fatigue damage (x64)
//   ContinuousDamageFatigue (1, 1)  - per-round fatigue damage (x64)
//   Regenerate           (18, 255)  - per-round IncreaseHealth for the duration
export const isDrainAttribute = (e) => e.type === 7 && e.subType >= 0 && e.subType <= 7;
export const isHealAttribute = (e) => e.type === 10 && e.subType >= 0 && e.subType <= 7;
export const isTransferAttribute = (e) => e.type === 11 && e.subType >= 0 && e.subType <= 7;
export const isTransferHealth = (e) => e.type === 11 && e.subType === 8;
export const isTransferFatigue = (e) => e.type === 11 && e.subType === 9;
export const isHealFatigue = (e) => e.type === 10 && e.subType === 9;
export const isDamageFatigue = (e) => e.type === 4 && e.subType === 1;
export const isContinuousDamageFatigue = (e) => e.type === 1 && e.subType === 1;
export const isRegenerate = (e) => e.type === 18 && e.subType === 255;

/** Duration in rounds, verbatim (straight arithmetic, no roll).
 *  The per-level multiplier CLAMPS AT 1 (audit F11 - DFU SetDuration:
 *  "or player can lose a round depending on spell settings and
 *  level"). The max(1, per) guard on the divisor is ours (classic
 *  data never carries 0; C# would throw). */
export function rollDuration(effect, casterLevel) {
  const per = Math.max(1, effect.durationPerLevel);
  let mult = Math.floor(casterLevel / per);
  if (mult < 1) mult = 1;
  return effect.durationBase + effect.durationMod * mult;
}

/** CompareSettings identity for settings-keyed like-kind (F12): the
 *  classic record's duration + chance + magnitude component fields. */
export const settingsKeyOf = (e) => [
  e.durationBase, e.durationMod, e.durationPerLevel,
  e.chanceBase, e.chanceMod, e.chancePerLevel,
  e.magnitudeBaseLow, e.magnitudeBaseHigh, e.magnitudeLevelBase,
  e.magnitudeLevelHigh, e.magnitudePerLevel,
].join(',');

/** EntityEffect.GetMagnitude, verbatim: the magnitude roll, then
 *  ModifyEffectAmount (the saving throw) ONLY when the parent bundle
 *  is not CasterOnly (rangeType 0). C# int division truncates. */
function effectMagnitude(e, casterLevel, saveScaled, element, flag, target, rolls) {
  let n = rollMagnitude(e, casterLevel, rolls);
  if (saveScaled) n = Math.trunc(n * savingThrow(element, flag, target, 0, rolls) / 100);
  return n;
}

/** manager.HealAttribute, verbatim: walk the live effects carrying a
 *  negative mod on this stat (drain/transfer entries), healing each
 *  in turn until the amount is spent. A drain healed to magnitude 0
 *  ENDS (DrainEffect.HealAttributeDamage: forcedRoundsRemaining = 0)
 *  and the next tick pass removes it. Heal never overshoots into a
 *  bonus (base HealAttributeDamage clamps the mod at 0). */
export function healAttributeDamage(entity, stat, amount) {
  if (amount < 0) return;
  let remaining = amount;
  for (const a of entity.activeEffects ?? []) {
    if (a.kind !== 'drainAttribute' && a.kind !== 'transferAttribute') continue;
    if (a.stat !== stat || a.magnitude <= 0) continue;   // mod >= 0 -> not damaged
    const damage = a.magnitude;
    if (remaining > damage) {
      a.magnitude = 0;
      remaining -= damage;
    } else {
      a.magnitude -= remaining;
      remaining = 0;
    }
    if (a.magnitude === 0) a.ended = true;   // forcedRoundsRemaining = 0
    if (remaining === 0) return;
  }
}

/** DrainEffect.IncreaseMagnitude, verbatim: the drain never reduces
 *  the stat below 1 relative to its PERMANENT value ("no invisible
 *  healing debt" - drain alone cannot zero a stat). */
function increaseDrainMagnitude(target, entry, amount) {
  const permanentValue = target.stats?.[entry.stat] ?? 0;
  if (permanentValue - (entry.magnitude + amount) < 1) entry.magnitude = permanentValue - 1;
  else entry.magnitude += amount;
}

/** One magic round for one ACTIVE entry - the saving throw rolls
 *  FRESH here every round (F10), gated on the spell's range (S15).
 *  Fortify/buff/drain rounds carry no per-round action (their state
 *  applies via liveStat / hasActiveEffect). */
function runEffectRound(a, target, sinks, rolls) {
  if (a.kind === 'continuousDamage') {
    const n = effectMagnitude(a.effect, a.casterLevel, a.saveScaled ?? true, a.element, a.flag, target, rolls);
    if (n > 0 && sinks.hurt) sinks.hurt(n);
  } else if (a.kind === 'continuousDamageSpellPoints') {
    const n = effectMagnitude(a.effect, a.casterLevel, a.saveScaled ?? true, a.element, a.flag, target, rolls);
    if (n > 0 && sinks.drainMagicka) sinks.drainMagicka(n);
  } else if (a.kind === 'continuousDamageFatigue') {
    // DamageFatigueFromSource(..., assignMultiplier: true) - x64
    const n = effectMagnitude(a.effect, a.casterLevel, a.saveScaled ?? true, a.element, a.flag, target, rolls);
    if (n > 0 && sinks.drainFatigue) sinks.drainFatigue(n * FATIGUE_MULTIPLIER);
  } else if (a.kind === 'regenerate') {
    // Regenerate.MagicRound: IncreaseHealth(GetMagnitude) every round
    const n = effectMagnitude(a.effect, a.casterLevel, a.saveScaled ?? false, a.element, a.flag, target, rolls);
    if (n > 0 && sinks.heal) sinks.heal(n);
  }
}

/** Push a new active entry and fire its INITIAL magic round (F17):
 *  acts now and consumes round 1, exactly as AssignBundle does. */
function pushActive(target, entry, sinks, rolls) {
  target.activeEffects = target.activeEffects || [];
  target.activeEffects.push(entry);
  runEffectRound(entry, target, sinks, rolls);
  entry.roundsRemaining--;
}

/** Push a PERMANENT entry (drain/transfer attribute): no rounds, no
 *  initial-round action - the constant stat mod IS the effect. */
function pushPermanent(target, entry) {
  target.activeEffects = target.activeEffects || [];
  target.activeEffects.push(entry);
}

/**
 * Apply a spell to a target entity through the sinks:
 *   hurt(n)           - damage (the caller owns floors/death)
 *   heal(n)           - IncreaseHealth (the caller owns the max clamp)
 *   drainMagicka(n)   (restoreMagicka returns with potions/absorption - no classic spell key reaches it)
 *   drainFatigue(n) / restoreFatigue(n)  - RAW fatigue points (the x64
 *                       is applied here; the caller owns the 0/max
 *                       clamps and the exhaustion consumer)
 * caster (optional) = { entity, sinks } - the casting entity and ITS
 * sinks, needed by the Transfer family (DFU heals the caster through
 * its own manager/entity; without a caster, TransferHealth/Fatigue
 * no-op entirely and Transfer{Attribute} drains without the heal-back,
 * verbatim).
 * Instant families act now; continuous joins target.activeEffects
 * for the round ticker. Returns what happened (tested).
 */
export function applySpell(spell, casterLevel, target, sinks, rolls = Math.random, caster = null) {
  const flag = ELEMENT_EFFECT_FLAG[spell.element] ?? EFFECT_FLAGS.Magic;
  const saveScaled = spell.rangeType !== 0;   // GetMagnitude's CasterOnly gate (S15)
  const magnitude = (e) => effectMagnitude(e, casterLevel, saveScaled, spell.element, flag, target, rolls);
  const out = { damage: 0, healed: 0, continuous: 0, skipped: 0 };
  for (const e of spell.effects) {
    if (e.type <= -1) continue;
    if (isHealHealth(e)) {
      const n = magnitude(e);
      out.healed += n;
      if (n > 0 && sinks.heal) sinks.heal(n);
      continue;
    }
    if (isDamageHealth(e)) {
      const n = magnitude(e);
      out.damage += n;
      if (n > 0 && sinks.hurt) sinks.hurt(n);
      continue;
    }
    if (isContinuousDamage(e)) {
      // IsLikeKind is settings-blind: ANY ContinuousDamageHealth is
      // incumbent (F12) - a re-cast stacks rounds, keeps the
      // incumbent's own settings, fires no initial round.
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const inc = target.activeEffects?.find((a) => a.kind === 'continuousDamage');
        if (inc) inc.roundsRemaining += rounds;
        else pushActive(target, { kind: 'continuousDamage', effect: e, casterLevel, element: spell.element, flag, saveScaled, roundsRemaining: rounds }, sinks, rolls);
        out.continuous++;
      }
      continue;
    }
    if (isFortifyAttribute(e)) {
      // Fortify{Attribute} (type 9, subType = stat index): a temporary
      // additive stat mod. IsLikeKind = same stat AND CompareSettings
      // (F12); a like-kind re-cast STACKS rounds onto the incumbent
      // and keeps its magnitude; a different-settings fortify of the
      // same stat coexists (liveStat sums the mods, as DFU's parallel
      // instances do).
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const stat = STAT_KEYS_ORDER[e.subType];
        const sKey = settingsKeyOf(e);
        const inc = target.activeEffects?.find((a) => a.kind === 'fortifyAttribute' && a.stat === stat && a.settingsKey === sKey);
        if (inc) inc.roundsRemaining += rounds;
        else pushActive(target, { kind: 'fortifyAttribute', stat, settingsKey: sKey, magnitude: magnitude(e), roundsRemaining: rounds }, sinks, rolls);
        out.fortified = (out.fortified ?? 0) + 1;
      }
      continue;
    }
    if (isDrainAttribute(e) || isTransferAttribute(e)) {
      // Drain{Attribute} (7, s) / Transfer{Attribute} (11, s):
      // permanent-until-healed. IsLikeKind = same FAMILY + same stat
      // (a Drain is never incumbent for a Transfer); Become/AddState
      // both roll a fresh magnitude onto the incumbent's total.
      // Transfer additionally heals the CASTER's drained stat by the
      // PRE-CLAMP roll (lastMagnitudeIncreaseAmount), verbatim.
      const kind = isDrainAttribute(e) ? 'drainAttribute' : 'transferAttribute';
      const stat = STAT_KEYS_ORDER[e.subType];
      const amt = magnitude(e);
      if (amt > 0) {
        let entry = target.activeEffects?.find((a) => a.kind === kind && a.stat === stat && !a.ended);
        if (!entry) {
          entry = { kind, stat, magnitude: 0, permanent: true };
          pushPermanent(target, entry);
        }
        increaseDrainMagnitude(target, entry, amt);
        if (kind === 'transferAttribute' && caster?.entity) healAttributeDamage(caster.entity, stat, amt);
        out.drained = (out.drained ?? 0) + 1;
      }
      continue;
    }
    if (isHealAttribute(e)) {
      // Heal{Attribute} (10, s): instant manager.HealAttribute walk -
      // heals DRAIN damage only, never fortifies past the base.
      const n = magnitude(e);
      if (n > 0) healAttributeDamage(target, STAT_KEYS_ORDER[e.subType], n);
      out.attrHealed = (out.attrHealed ?? 0) + 1;
      continue;
    }
    if (isTransferHealth(e)) {
      // TransferHealth (11, 8): requires a caster (DFU MagicRound
      // returns before acting without one) - damage target, heal
      // caster by the same magnitude.
      if (caster?.entity) {
        const n = magnitude(e);
        out.damage += n;
        if (n > 0) {
          if (sinks.hurt) sinks.hurt(n);
          if (caster.sinks?.heal) caster.sinks.heal(n);
        }
      }
      continue;
    }
    if (isTransferFatigue(e)) {
      // TransferFatigue (11, 9): requires a caster - fatigue x64 both
      // directions (DamageFatigueFromSource / IncreaseFatigue, both
      // assignMultiplier: true).
      if (caster?.entity) {
        const n = magnitude(e);
        if (n > 0) {
          if (sinks.drainFatigue) sinks.drainFatigue(n * FATIGUE_MULTIPLIER);
          if (caster.sinks?.restoreFatigue) caster.sinks.restoreFatigue(n * FATIGUE_MULTIPLIER);
          out.fatigueDrained = (out.fatigueDrained ?? 0) + 1;
        }
      }
      continue;
    }
    if (isHealFatigue(e)) {
      // HealFatigue (10, 9): instant IncreaseFatigue(mag, x64).
      const n = magnitude(e);
      if (n > 0 && sinks.restoreFatigue) sinks.restoreFatigue(n * FATIGUE_MULTIPLIER);
      out.fatigueHealed = (out.fatigueHealed ?? 0) + 1;
      continue;
    }
    if (isDamageFatigue(e)) {
      // DamageFatigue (4, 1): instant DamageFatigueFromSource(mag, x64).
      const n = magnitude(e);
      if (n > 0 && sinks.drainFatigue) sinks.drainFatigue(n * FATIGUE_MULTIPLIER);
      out.fatigueDrained = (out.fatigueDrained ?? 0) + 1;
      continue;
    }
    if (isContinuousDamageFatigue(e)) {
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const inc = target.activeEffects?.find((a) => a.kind === 'continuousDamageFatigue');
        if (inc) inc.roundsRemaining += rounds;   // settings-blind incumbent (F12)
        else pushActive(target, { kind: 'continuousDamageFatigue', effect: e, casterLevel, element: spell.element, flag, saveScaled, roundsRemaining: rounds }, sinks, rolls);
        out.continuous++;
      }
      continue;
    }
    if (isDamageSpellPoints(e)) {
      // DamageSpellPoints (4, 2): DamageMagickaFromSource(magnitude),
      // instant, saving-throw scaled like damage.
      const n = magnitude(e);
      out.magickaDrained = (out.magickaDrained ?? 0) + n;
      if (n > 0 && sinks.drainMagicka) sinks.drainMagicka(n);
      continue;
    }
    if (isContinuousDamageSpellPoints(e)) {
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const inc = target.activeEffects?.find((a) => a.kind === 'continuousDamageSpellPoints');
        if (inc) inc.roundsRemaining += rounds;   // settings-blind incumbent (F12)
        else pushActive(target, { kind: 'continuousDamageSpellPoints', effect: e, casterLevel, element: spell.element, flag, saveScaled, roundsRemaining: rounds }, sinks, rolls);
        out.continuous++;
      }
      continue;
    }
    if (isRegenerate(e)) {
      // Regenerate (18, 255): IncreaseHealth(GetMagnitude) every round
      // for the duration. IsLikeKind = Regenerate AND CompareSettings.
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const sKey = settingsKeyOf(e);
        const inc = target.activeEffects?.find((a) => a.kind === 'regenerate' && a.settingsKey === sKey);
        if (inc) inc.roundsRemaining += rounds;
        else pushActive(target, { kind: 'regenerate', effect: e, casterLevel, element: spell.element, flag, saveScaled, settingsKey: sKey, roundsRemaining: rounds }, sinks, rolls);
        out.continuous++;
      }
      continue;
    }
    const kind = buffKind(e);
    if (kind) {
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const inc = target.activeEffects?.find((a) => a.kind === kind);
        if (inc) inc.roundsRemaining += rounds;             // incumbent STACKS (F12)
        else pushActive(target, { kind, roundsRemaining: rounds }, sinks, rolls);
        out.buffs = (out.buffs ?? 0) + 1;
      }
      continue;
    }
    out.skipped++;   // FLAGGED: the library grows one family at a time
  }
  return out;
}

/** The ACTIVE-entry identity an effect would instantiate
 *  ({ kind, stat? }), or null for instant families (S16). DFU's
 *  EnemyMotor.EffectsAlreadyOnTarget compares live-effect TEMPLATE
 *  types; per-stat classes (FortifyStrength vs FortifyAgility...) are
 *  distinct templates, so stat families carry the stat in the key. */
export function effectActiveIdentity(e) {
  if (isContinuousDamage(e)) return { kind: 'continuousDamage' };
  if (isContinuousDamageFatigue(e)) return { kind: 'continuousDamageFatigue' };
  if (isContinuousDamageSpellPoints(e)) return { kind: 'continuousDamageSpellPoints' };
  if (isFortifyAttribute(e)) return { kind: 'fortifyAttribute', stat: STAT_KEYS_ORDER[e.subType] };
  if (isDrainAttribute(e)) return { kind: 'drainAttribute', stat: STAT_KEYS_ORDER[e.subType] };
  if (isTransferAttribute(e)) return { kind: 'transferAttribute', stat: STAT_KEYS_ORDER[e.subType] };
  if (isRegenerate(e)) return { kind: 'regenerate' };
  const b = buffKind(e);
  return b ? { kind: b } : null;
}

/** EnemyMotor.EffectsAlreadyOnTarget, verbatim shape: true only when
 *  EVERY effect of the spell is already live on the target - one
 *  absent effect (instants always count as absent, like DFU's expired
 *  instant bundles) makes the spell castable. */
export function effectsAlreadyOnTarget(spell, target) {
  const list = target.activeEffects ?? [];
  for (const e of spell.effects) {
    if (e.type <= -1) continue;   // classic record padding (bundles drop these)
    const id = effectActiveIdentity(e);
    const found = !!id && list.some((a) => a.kind === id.kind && (id.stat == null || a.stat === id.stat));
    if (!found) return false;
  }
  return true;
}

/** One magic round for one entity, DoMagicRound's exact shape:
 *  entries found at 0 rounds END this pass (removed WITHOUT acting);
 *  live entries act (saves rolled fresh per round - F10), decrement,
 *  and stay through this pass even on reaching 0 - so a fortify's
 *  mod, like DFU's, survives until the pass that finds it expired.
 *  PERMANENT entries (drain/transfer attribute) never count down and
 *  never act; they leave only via the healed-to-zero flag
 *  (DrainEffect presents forcedRoundsRemaining = 1 until healed). */
export function tickActiveEffects(entity, sinks, rolls = Math.random) {
  const list = entity.activeEffects;
  if (!list || !list.length) return;
  entity.activeEffects = list.filter((a) => {
    if (a.permanent) return !a.ended;
    if (a.roundsRemaining <= 0) return false;   // End(): expired last pass
    runEffectRound(a, entity, sinks, rolls);
    a.roundsRemaining--;
    return true;
  });
}
