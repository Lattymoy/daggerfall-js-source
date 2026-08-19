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
// FLAGGED skipped (the library grows here).

import { savingThrow, rollMagnitude, EFFECT_FLAGS } from './spellcast.js';
import { STAT_KEYS_ORDER, FATIGUE_MULTIPLIER, maxFatigue } from './statMods.js';
import { dice100 } from '../combat/formulas.js';
import { tryAbsorption } from './absorption.js';   // S24

/** "Spell was absorbed." - the HUD line DFU prints on every absorbed
 *  effect (:515). FLAGGED: DFU pulls it from the localised string
 *  table; this surface has no text source, so the literal stands. */
export const SPELL_ABSORBED_TEXT = 'Spell was absorbed.';

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
  '30,255': 'waterBreathing',   // P12: gates the drowning tick (IsWaterBreathing)
  // S21 concealment (ConcealmentEffect subclasses, verbatim classic
  // keys): the P13 illusion gate's inert invisible/shade branches go
  // live. Normal and true variants FOLD for detection (DFU's
  // IsInvisible/IsBlending/IsAShade OR both powers); the split
  // matters to future consumers (IsMagicallyConcealed*Power).
  '13,0': 'invisNormal',
  '13,1': 'invisTrue',
  '24,0': 'shadeNormal',
  '24,1': 'shadeTrue',
  '23,1': 'chameleonTrue',
  // S22 FreeAction (26,255): Restoration duration buff - the entity
  // is IMMUNE TO PARALYSIS while it lives (IsImmuneToParalysis).
  '26,255': 'freeAction',
});

/** DaggerfallEntity.IsInvisible / IsBlending / IsAShade, verbatim:
 *  normal OR true power. The senses' illusion gate consumes these
 *  (S21); foe-side concealment VISUALS pend their arc. */
export const isInvisible = (en) => hasActiveEffect(en, 'invisNormal') || hasActiveEffect(en, 'invisTrue');
export const isBlending = (en) => hasActiveEffect(en, 'chameleonNormal') || hasActiveEffect(en, 'chameleonTrue');
export const isAShade = (en) => hasActiveEffect(en, 'shadeNormal') || hasActiveEffect(en, 'shadeTrue');

/** ConcealmentEffect start messages (Internal_Strings verbatim),
 *  shown ONCE when the effect becomes incumbent on the player host
 *  (awakeAlert) - a stacking re-cast stays silent. */
export const CONCEALMENT_START_TEXT = Object.freeze({
  invisNormal: 'You are invisible.', invisTrue: 'You are invisible.',
  chameleonNormal: 'You are blending.', chameleonTrue: 'You are blending.',
  shadeNormal: 'You are a shade.', shadeTrue: 'You are a shade.',
});
/** Classic subType as DFU keys it: the record's sbyte cast to BYTE
 *  (ClassicSpellRecordDataToEffectBundleSettings does
 *  MakeClassicKey((byte)type, (byte)subType)). SPELLS.STD 0xFF reads
 *  -1 through the verbatim sbyte decode, so every 255-keyed check
 *  must normalize (parity fix 2026-08-16d: the 255-keyed families -
 *  Levitate/Slowfall/WaterWalking/Regenerate - never fired from REAL
 *  records; unit fixtures hand-wrote 255 and stayed green - "a pin
 *  certifies what it pins", again). */
export const classicSub = (e) => e.subType & 0xff;
export const buffKind = (e) => BUFF_KINDS[`${e.type},${classicSub(e)}`] ?? null;
export const hasActiveEffect = (entity, kind) =>
  !!entity.activeEffects?.some((a) => a.kind === kind);   // presence = active; expired entries End on the NEXT tick pass (DFU shape)

// S22 FreeAction: the two DFU laws.
// AUDIT 18 retires the "career/racial hard-immunity pends" flag that
// stood here: it was wrong about DFU. DaggerfallEntity
// .IsImmuneToParalysis is written by FreeAction.cs:99/109 and (when
// vampirism ships) VampirismEffect.cs:124 and by NOTHING else - a
// career or racial paralysis tolerance never reaches this gate, it
// enters through FormulaHelper.SavingThrow, which carries both arms.
export const isImmuneToParalysis = (entity) => hasActiveEffect(entity, 'freeAction');
/** DaggerfallEntity.IsParalyzed, verbatim: the immunity folds at READ
 *  time - `!IsImmuneToParalysis && isParalyzed`. A paralysis bundle
 *  that landed BEFORE FreeAction keeps ticking underneath; casting
 *  FreeAction frees the entity NOW, and if FreeAction expires while
 *  the paralysis still has rounds, the paralysis RESUMES. */
export const entityIsParalyzed = (entity) =>
  hasActiveEffect(entity, 'paralyze') && !isImmuneToParalysis(entity);

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
export const isRegenerate = (e) => e.type === 18 && classicSub(e) === 255;
// S19: Paralyze (0, 255) - duration + CHANCE, no magnitude. The
// entity is paralyzed while a 'paralyze' entry is live
// (ConstantEffect sets IsParalyzed every frame; presence = paralyzed
// here). Scene consumers: player motor input/jump zeroed, weapons
// hidden, foe motor+attack frozen (FrictionMotor/AcrobatMotor/
// WeaponManager/EnemyMotor/EnemyAttack gates). Casting is NOT gated
// (DFU has no IsParalyzed check in the casting path).
export const isParalyze = (e) => e.type === 0 && classicSub(e) === 255;

/** BaseEntityEffect.ChanceValue, verbatim: base + plus x
 *  floor(casterLevel / perLevel) - NO min-1 clamp (unlike duration);
 *  the per-0 guard is ours. */
export const chanceValue = (e, casterLevel) =>
  e.chanceBase + e.chanceMod * Math.floor(casterLevel / Math.max(1, e.chancePerLevel));

// S19c: the Cure family (type 3) - chance-only INSTANT effects.
//   Cure-Disease      (3, 0) -> manager.CureAllDiseases
//   Cure-Poison       (3, 1) -> manager.CureAllPoisons
//   Cure-Paralyzation (3, 2) -> EndIncumbentEffect<Paralyze>
// CureAll* is RemoveBundle IMMEDIATELY - the entries and their
// statMods lift at once (no next-tick lag); ending the paralyze
// incumbent lifts the paralysis NOW (End() clears IsParalyzed).
export const isCureDisease = (e) => e.type === 3 && e.subType === 0;
export const isCurePoison = (e) => e.type === 3 && e.subType === 1;
export const isCureParalyzation = (e) => e.type === 3 && e.subType === 2;
export const CURE_KINDS = Object.freeze(['disease', 'poison', 'paralyze']);   // subType-indexed

/** EntityEffectManager.CureAll* (:1523-1546) as ONE primitive: the
 *  kind's entries leave the list at once, lifting their statMods with
 *  them. The three named wrappers below are the members DFU actually
 *  exposes, and the temple's cure-disease service (U24) calls the
 *  first one directly - not through a spell. */
export function cureAllOfKind(target, kind) {
  if (target?.activeEffects) target.activeEffects = target.activeEffects.filter((a) => a.kind !== kind);
}
export const cureAllDiseases = (t) => cureAllOfKind(t, 'disease');
export const cureAllPoisons = (t) => cureAllOfKind(t, 'poison');
export const cureParalyzation = (t) => cureAllOfKind(t, 'paralyze');
const CURE_MARKER_KINDS = Object.freeze(['cureDisease', 'curePoison', 'cureParalyzation']);   // the three cure CLASSES themselves

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
 *  negative mod on this stat (drain/transfer entries AND disease
 *  statMods - S18), healing each in turn until the amount is spent.
 *  A drain healed to magnitude 0 ENDS (DrainEffect.HealAttributeDamage:
 *  forcedRoundsRemaining = 0) and the next tick pass removes it; a
 *  disease's healed stat does NOT end the disease (base
 *  HealAttributeDamage - it keeps draining daily). Heal never
 *  overshoots into a bonus (the mod clamps at 0). */
export function healAttributeDamage(entity, stat, amount) {
  if (amount < 0) return;
  let remaining = amount;
  for (const a of entity.activeEffects ?? []) {
    if (a.kind === 'disease' || a.kind === 'poison') {
      // signed statMods map (S18/S19b): heal the negative side only -
      // neither a disease nor a poison ENDS on heal (a healed-out
      // completed poison expires on its own CompletePoison round)
      const mod = a.statMods?.[stat] ?? 0;
      if (mod >= 0) continue;   // not damaged by this effect
      const healed = Math.min(remaining, -mod);
      a.statMods[stat] = mod + healed;
      remaining -= healed;
      if (remaining === 0) return;
      continue;
    }
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

/** AssignBundle adds an INSTANT effect to liveEffects exactly like a
 *  lasting one (EntityEffectManager.cs:584-593) and keeps its bundle
 *  in instancedBundles (:610-612); only the NEXT DoMagicRound finds
 *  it at 0 rounds and drops it (:1728-1760). So for up to one magic
 *  round the target really does carry that effect - which is what
 *  EnemyMotor.EffectsAlreadyOnTarget walks. A 0-round marker entry
 *  reproduces that lifetime exactly: tickActiveEffects removes a
 *  0-round entry WITHOUT acting, and no round branch matches these
 *  kinds. (AUDIT 18: instants used to count as always-absent, so an
 *  instant-only caster - Fire Daedra, whose whole list is (4,0) -
 *  could re-cast every 2.5s where DFU vetoes the pick.) */
function pushInstantMarker(target, kind, stat = null) {
  target.activeEffects = target.activeEffects || [];
  const entry = { kind, instant: true, roundsRemaining: 0 };
  if (stat) entry.stat = stat;
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
export function applySpell(spell, casterLevel, target, sinks, rolls = Math.random, caster = null, ctx = {}) {
  const flag = ELEMENT_EFFECT_FLAG[spell.element] ?? EFFECT_FLAGS.Magic;
  const saveScaled = spell.rangeType !== 0;   // GetMagnitude's CasterOnly gate (S15)
  const magnitude = (e) => effectMagnitude(e, casterLevel, saveScaled, spell.element, flag, target, rolls);
  const out = { damage: 0, healed: 0, continuous: 0, skipped: 0 };
  // S24: absorption is tested PER EFFECT, before any of them lands
  // (EntityEffectManager :507-518), and an absorbed effect is skipped
  // entirely - `continue`, not a reduced magnitude.
  let totalAbsorbed = 0;
  for (const e of spell.effects) {
    if (e.type <= -1) continue;
    // DFU requires a CASTER ENTITY on the bundle (:505) and
    // BundleType == Spell (:509). The port's applySpell is the spell
    // path only, so the caster check is the whole gate here; item and
    // enchantment bundles are FLAGGED to their own arc.
    if (caster) {
      const sp = tryAbsorption(e, spell.rangeType ?? 0, target, ctx);
      if (sp > 0) {
        totalAbsorbed += sp;
        out.absorbed = (out.absorbed ?? 0) + sp;
        continue;
      }
    }
    if (isHealHealth(e)) {
      const n = magnitude(e);
      out.healed += n;
      if (n > 0 && sinks.heal) sinks.heal(n);
      pushInstantMarker(target, 'healHealth');
      continue;
    }
    if (isDamageHealth(e)) {
      const n = magnitude(e);
      out.damage += n;
      if (n > 0 && sinks.hurt) sinks.hurt(n);
      pushInstantMarker(target, 'damageHealth');
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
      pushInstantMarker(target, 'healAttribute', STAT_KEYS_ORDER[e.subType]);
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
      pushInstantMarker(target, 'transferHealth');   // added to liveEffects at assignment, caster or not
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
      pushInstantMarker(target, 'transferFatigue');
      continue;
    }
    if (isHealFatigue(e)) {
      // HealFatigue (10, 9): instant IncreaseFatigue(mag, x64).
      const n = magnitude(e);
      if (n > 0 && sinks.restoreFatigue) sinks.restoreFatigue(n * FATIGUE_MULTIPLIER);
      pushInstantMarker(target, 'healFatigue');
      out.fatigueHealed = (out.fatigueHealed ?? 0) + 1;
      continue;
    }
    if (isDamageFatigue(e)) {
      // DamageFatigue (4, 1): instant DamageFatigueFromSource(mag, x64).
      const n = magnitude(e);
      if (n > 0 && sinks.drainFatigue) sinks.drainFatigue(n * FATIGUE_MULTIPLIER);
      pushInstantMarker(target, 'damageFatigue');
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
      pushInstantMarker(target, 'damageSpellPoints');
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
    if (isParalyze(e)) {
      // S22: AssignBundle drops an incoming Paralyze BEFORE Start
      // when the entity is hard-immune (FreeAction's
      // IsImmuneToParalysis; career/racial pend) - silently, no
      // stack, no chance roll, no message (EntityEffectManager.cs:496).
      if (isImmuneToParalysis(target)) continue;
      // Paralyze (0, 255): AssignBundle's exact gate order. The
      // chance rolls ALWAYS (SetChanceSuccess runs in Start); an
      // incumbent re-cast stacks its rounds INSIDE Start (AddState)
      // BEFORE the chance and saving-throw gates - so a re-cast
      // always stacks, chance/save notwithstanding (verbatim quirk;
      // the chance-fail MESSAGE still fires, gate order). A NEW
      // instance needs the chance, then (no-magnitude effects,
      // non-CasterOnly) the entity saves against the ENTIRE effect
      // on a FULL save. Flags = Paralysis | the spell's element.
      const rounds = rollDuration(e, casterLevel);
      const chanceOk = dice100(chanceValue(e, casterLevel), rolls());
      if (!chanceOk) out.chanceFailed = (out.chanceFailed ?? 0) + 1;   // "Spell effect failed."/"Save versus spell made."
      if (rounds > 0) {
        const inc = target.activeEffects?.find((a) => a.kind === 'paralyze');
        if (inc) inc.roundsRemaining += rounds;
        else if (chanceOk) {
          if (!saveScaled || savingThrow(spell.element, EFFECT_FLAGS.Paralysis | flag, target, 0, rolls) !== 0) {
            pushActive(target, { kind: 'paralyze', roundsRemaining: rounds }, sinks, rolls);
            out.paralyzed = (out.paralyzed ?? 0) + 1;   // "You are paralyzed." rides this (player hosts, once per instance)
          } else {
            out.saved = (out.saved ?? 0) + 1;           // "Save versus spell made."
          }
        }
      }
      continue;
    }
    if (isCureDisease(e) || isCurePoison(e) || isCureParalyzation(e)) {
      // The Cure family (3, 0..2): chance-only instants through the
      // same AssignBundle gates - the chance rolls always, a fail
      // skips with the failure message; non-CasterOnly no-magnitude
      // effects save against the ENTIRE effect on a FULL save; then
      // the initial MagicRound cures (immediate bundle removal).
      const chanceOk = dice100(chanceValue(e, casterLevel), rolls());
      if (!chanceOk) { out.chanceFailed = (out.chanceFailed ?? 0) + 1; continue; }
      if (saveScaled && savingThrow(spell.element, flag, target, 0, rolls) === 0) {
        out.saved = (out.saved ?? 0) + 1;
        continue;
      }
      cureAllOfKind(target, CURE_KINDS[e.subType]);
      pushInstantMarker(target, CURE_MARKER_KINDS[e.subType]);   // after the removal pass, as AssignBundle adds before MagicRound cures
      out.cured = (out.cured ?? 0) + 1;
      continue;
    }
    const kind = buffKind(e);
    if (kind) {
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const inc = target.activeEffects?.find((a) => a.kind === kind);
        if (inc) inc.roundsRemaining += rounds;             // incumbent STACKS (F12; = ConcealmentEffect.AddState)
        else {
          pushActive(target, { kind, roundsRemaining: rounds }, sinks, rolls);
          // S21: the concealment start message fires once on NEW
          // incumbency (ConcealmentEffect awakeAlert); a stack is
          // silent. Only hosts wiring sinks.say (the player) hear it.
          const msg = CONCEALMENT_START_TEXT[kind];
          if (msg) sinks?.say?.(msg);
        }
        out.buffs = (out.buffs ?? 0) + 1;
      }
      continue;
    }
    out.skipped++;   // FLAGGED: the library grows one family at a time
  }
  // S24: refund the absorbed points (:596-608). A SELF-cast cannot
  // give back more than it cost - absorption is tallied per effect and
  // can otherwise exceed the spell's own price - and the cap does NOT
  // apply to another entity's spell.
  if (totalAbsorbed > 0) {
    const selfCastCost = ctx.selfCastCost ?? 0;
    if (caster === target && selfCastCost > 0 && totalAbsorbed > selfCastCost) totalAbsorbed = selfCastCost;
    out.absorbed = totalAbsorbed;
    if (target.maxMagicka != null) {
      target.magicka = Math.min(target.maxMagicka, (target.magicka ?? 0) + totalAbsorbed);
    }
    sinks?.say?.(SPELL_ABSORBED_TEXT);
  }
  return out;
}

/** The ACTIVE-entry identity an effect would instantiate
 *  ({ kind, stat? }), or null for a family the library has not
 *  reached (S16). DFU's EnemyMotor.EffectsAlreadyOnTarget compares
 *  live-effect TEMPLATE types; per-stat classes (FortifyStrength vs
 *  FortifyAgility, HealStrength vs HealAgility...) are distinct
 *  templates, so stat families carry the stat in the key. The INSTANT
 *  families are here too (AUDIT 18): DFU keeps an instant effect live
 *  in its bundle until the next DoMagicRound, so it is "already on
 *  the target" for one round - see pushInstantMarker. */
export function effectActiveIdentity(e) {
  if (isContinuousDamage(e)) return { kind: 'continuousDamage' };
  if (isContinuousDamageFatigue(e)) return { kind: 'continuousDamageFatigue' };
  if (isContinuousDamageSpellPoints(e)) return { kind: 'continuousDamageSpellPoints' };
  if (isFortifyAttribute(e)) return { kind: 'fortifyAttribute', stat: STAT_KEYS_ORDER[e.subType] };
  if (isDrainAttribute(e)) return { kind: 'drainAttribute', stat: STAT_KEYS_ORDER[e.subType] };
  if (isTransferAttribute(e)) return { kind: 'transferAttribute', stat: STAT_KEYS_ORDER[e.subType] };
  if (isRegenerate(e)) return { kind: 'regenerate' };
  if (isParalyze(e)) return { kind: 'paralyze' };
  if (isDamageHealth(e)) return { kind: 'damageHealth' };
  if (isDamageFatigue(e)) return { kind: 'damageFatigue' };
  if (isDamageSpellPoints(e)) return { kind: 'damageSpellPoints' };
  if (isHealHealth(e)) return { kind: 'healHealth' };
  if (isHealFatigue(e)) return { kind: 'healFatigue' };
  if (isHealAttribute(e)) return { kind: 'healAttribute', stat: STAT_KEYS_ORDER[e.subType] };
  if (isTransferHealth(e)) return { kind: 'transferHealth' };
  if (isTransferFatigue(e)) return { kind: 'transferFatigue' };
  if (isCureDisease(e) || isCurePoison(e) || isCureParalyzation(e)) return { kind: CURE_MARKER_KINDS[e.subType] };
  const b = buffKind(e);
  return b ? { kind: b } : null;
}

/** EnemyMotor.EffectsAlreadyOnTarget, verbatim shape: true only when
 *  EVERY effect of the spell is already live on the target - one
 *  absent effect makes the spell castable. A family the port has not
 *  implemented has no identity and so always counts as absent. */
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
