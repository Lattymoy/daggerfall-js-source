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

import { savingThrow, rollMagnitude, EFFECT_FLAGS, careerTolerance } from './spellcast.js';
import { raceById, raceByKey } from './races.js';   // L2-slice (magic-10): the racial immunity arm
import { STAT_KEYS_ORDER, FATIGUE_MULTIPLIER, maxFatigue } from './statMods.js';
import { dice100 } from '../combat/formulas.js';
import { tryAbsorption, effectCastingCost } from './absorption.js';
import { enemyGroupOf, NEARBY } from './nearbyObjects.js';   // X8: Pacify matches on DFU's EnemyGroups, the same table X4 ported   // S24; X7: the Identify refund reads the same per-effect cost
// AUDIT 24 (wave 31): the concealment BREAK lives in its own leaf so that
// combat/formulas.js can reach it without the effects -> spellcast ->
// formulas cycle. Re-exported here because this is the module its readers
// already speak to.
import { breakNormalPowerConcealment, handleAttackFromSource } from './concealment.js';
import { entityAbsorbsSpells, setEnchantmentEffectDoors } from './enchantments.js';   // E1: the AbsorbsSpells fold feeds the absorption gate

export { breakNormalPowerConcealment, handleAttackFromSource, NORMAL_POWER_CONCEALMENTS } from './concealment.js';

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
  // X1: the two motor buffs. DFU keeps each as a bool on the entity
  // (IsEnhancedJumping / IsEnhancedClimbing, DaggerfallEntity.cs:84-85)
  // set by the effect's Start and cleared by its End; the port's
  // active-effect list IS that flag, read where the motor asks.
  '27,255': 'jumping',
  '28,255': 'climbing',
  // X4: the DETECT family (Thaumaturgy 39/0..2). All three classes are
  // identical but for the flag they scan with and Treasure's cheaper
  // duration cost - SupportDuration ALONE, CasterOnly, Magic element,
  // and an AddState that stacks rounds onto the incumbent and nothing
  // else (DetectMagic.cs:36-40 and its two twins). That is precisely
  // this table's arm, so the effects half of Detect is three rows: the
  // entry's PRESENCE is DFU's registeredDetectors membership, exactly
  // as jumping/climbing above are IsEnhancedJumping/IsEnhancedClimbing.
  // The scan and the compass markers live in systems/nearbyObjects.js
  // and ui/hud.js - neither belongs to the effect, which in DFU does
  // nothing but hold a list refreshed once a magic round.
  '39,0': 'detectMagic',
  '39,1': 'detectEnemy',
  '39,2': 'detectTreasure',
  // AUDIT 21 F5 SILENCE (19,255). The GATE was ported and the PRODUCER was
  // not, so `entity.isSilenced` had no writer anywhere in src/ and
  // silenceBlocksCast was a constant false for every entity in the game -
  // while mysticism.js's own header said "SILENCE IS WIRED". A Wraith casts
  // classic spell 0x1C at you and DFU silences you; here applySpell fell
  // through to `out.skipped++` and you cast freely.
  //
  // Silence.cs:27-39 is duration-and-chance with NO magnitude
  // (SupportDuration + SupportChance, no SupportMagnitude), which is exactly
  // this buff arm - so it needs no new machinery, only its row.
  '19,255': 'silenced',
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
/** Every effect class whose `properties.AllowedElements` is
 *  ElementFlags_MagicOnly, by classic (type, subType) key - the set
 *  FormulaHelper.GetElementType (:1630-1634) answers Magic for,
 *  whatever element the parent bundle rode in on. Read off the effect
 *  classes under Game/MagicAndEffects/Effects, not inferred: cures,
 *  dispels, elemental resistances, fortifies, heals, transfers, the
 *  concealments, light, lock/open, regenerate, absorption/reflection/
 *  resistance, morph, shield, pacify, the detects, identify, teleport,
 *  comprehend languages, create item - and the alteration/thaumaturgy
 *  buffs the port's old family list missed: levitate (14), slowfall
 *  (25), free action (26), jumping (27), climbing (28), water
 *  breathing (30), water walking (31). */
export const MAGIC_ONLY_KEYS = new Set([
  '2,255', '3,0', '3,1', '3,2', '6,0', '6,1', '6,2',
  '8,0', '8,1', '8,2', '8,3', '8,4', '9,0', '9,1',
  '9,2', '9,3', '9,4', '9,5', '9,6', '9,7', '10,0',
  '10,1', '10,2', '10,3', '10,4', '10,5', '10,6', '10,7',
  '10,8', '10,9', '11,0', '11,1', '11,2', '11,3', '11,4',
  '11,5', '11,6', '11,7', '11,8', '11,9', '13,0', '13,1',
  '14,255', '15,255', '16,255', '17,255', '18,255', '20,255', '21,255',
  '22,255', '23,0', '23,1', '24,0', '24,1', '25,255', '26,255',
  '27,255', '28,255', '29,255', '30,255', '31,255', '33,0', '33,1',
  '33,2', '33,3', '35,255', '39,0', '39,1', '39,2', '40,255',
  '43,255', '44,255',
]);

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
/** X5: Soul Trap (12,255). Its own arm rather than a BUFF_KINDS row -
 *  the cast-time chance is forced true and the landing gates on the
 *  target's kind. */
export const isSoulTrapEffect = (e) => e.type === 12 && classicSub(e) === 255;
/** X8: Pacify's four variants (33,0..3) and Charm (34,255). The
 *  subType IS PacifyEffect's variantIndex, and the order is the
 *  SetVariantProperties call order (:70-73), not alphabetical. */
export const PACIFY_GROUP = Object.freeze({
  0: NEARBY.Animal,
  1: NEARBY.Undead,
  2: NEARBY.Humanoid,
  3: NEARBY.Daedra,
});
export const isPacifyEffect = (e) => e.type === 33 && PACIFY_GROUP[classicSub(e)] != null;
export const isCharmEffect = (e) => e.type === 34 && classicSub(e) === 255;
/** X7: Identify (40,255) - a window opener, not a lasting effect. */
export const isIdentifyEffect = (e) => e.type === 40 && classicSub(e) === 255;
/** Identify.cs:54-55 - the refund never drops below 5. */
export const IDENTIFY_REFUND_FLOOR = 5;
export const hasActiveEffect = (entity, kind) =>
  !!entity?.activeEffects?.some((a) => a.kind === kind);   // presence = active; expired entries End on the NEXT tick pass (DFU shape)

// S22 FreeAction: the two DFU laws.
// DaggerfallEntity.IsImmuneToParalysis (THE ENTITY FLAG) is written
// by FreeAction.cs:99/109 and (when vampirism ships)
// VampirismEffect.cs:124 and by NOTHING else - this member is that
// flag alone. AUDIT 18's note stopped there and missed the OTHER
// member: the ASSIGN gate calls the MANAGER's
// IsEntityImmuneToParalysis, which adds the career/racial arms -
// see isEntityImmuneToParalysis below (L2-slice, magic-10).
export const isImmuneToParalysis = (entity) => hasActiveEffect(entity, 'freeAction');

/** EntityEffectManager.IsEntityImmuneToParalysis (:644-660, L2-slice
 *  AUDIT 23 magic-10) - the HARD-immunity gate AssignBundle tests
 *  before an incoming Paralyze even starts:
 *  1. career Paralysis tolerance Immune, or the FreeAction flag;
 *  2. the PLAYER's racial immunity bit - unless the career overrides
 *     with LowTolerance or CriticalWeakness;
 *  3. otherwise not hard-immune (the saving throw still applies).
 *  The career precedence quirk carries over: DFCareer.GetTolerance
 *  reads Resistant BEFORE Immune, so a career flagged both is merely
 *  Resistant here and falls through to the save. */
export function isEntityImmuneToParalysis(entity) {
  if (careerTolerance(entity.career ?? {}, EFFECT_FLAGS.Paralysis) === 'Immune' || isImmuneToParalysis(entity)) return true;
  if (entity.isPlayer) {
    const rt = entity.raceTemplate ?? raceById(entity.raceId) ?? raceByKey(entity.race) ?? null;
    if (((rt?.immunityFlags ?? 0) & EFFECT_FLAGS.Paralysis) !== 0) {
      const t = careerTolerance(entity.career ?? {}, EFFECT_FLAGS.Paralysis);
      return t !== 'LowTolerance' && t !== 'CriticalWeakness';
    }
  }
  return false;
}
/** DaggerfallEntity.IsSilenced, minted by Silence.StartSilence (Silence.cs:87)
 *  and cleared at :105. A read-time fold over the active effects, the same
 *  shape as the concealment and paralysis predicates above, so nothing has to
 *  remember to clear a flag when the bundle expires. */
export const isSilencedEffect = (entity) => hasActiveEffect(entity, 'silenced');
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
// X1: the two door spells (Lock.cs / Open.cs classic keys)
export const isLockSpell = (e) => e.type === 16 && classicSub(e) === 255;
export const isOpenSpell = (e) => e.type === 17 && classicSub(e) === 255;
// X1: Elemental Resistance (8, element 0..4) - Fire/Frost/Poison/Shock/Magic
export const isElementalResistance = (e) => e.type === 8 && e.subType >= 0 && e.subType <= 4;
// X1: the two chance-buff defences read by the incoming chain
export const isSpellAbsorptionEffect = (e) => e.type === 20 && classicSub(e) === 255;
export const isSpellResistanceEffect = (e) => e.type === 22 && classicSub(e) === 255;
export const isShieldEffect = (e) => e.type === 35 && classicSub(e) === 255;
/** X2: the live Spell Resistance chance - the FIRST live instance,
 *  not a sum. DFU reads FindIncumbentEffect<SpellResistance>(), which
 *  returns the first match and nothing else (EEM:666-678); summing
 *  made a 50% item and a 50% spell read as a certainty. (Elemental
 *  Resistance really IS additive - RaiseResistanceChance sums onto a
 *  per-frame-cleared slate - so that one keeps its sum.) */
export function spellResistanceChance(target) {
  for (const a of target?.activeEffects ?? []) {
    if (a.kind === 'spellResistance' && !a.ended) return a.chance ?? 0;
  }
  return 0;
}
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
    handleAttackFromSource(a.caster);   // DamageHealthFromSource's tail, wave 31
  } else if (a.kind === 'continuousDamageSpellPoints') {
    const n = effectMagnitude(a.effect, a.casterLevel, a.saveScaled ?? true, a.element, a.flag, target, rolls);
    if (n > 0 && sinks.drainMagicka) sinks.drainMagicka(n);
    handleAttackFromSource(a.caster);
  } else if (a.kind === 'continuousDamageFatigue') {
    // DamageFatigueFromSource(..., assignMultiplier: true) - x64
    const n = effectMagnitude(a.effect, a.casterLevel, a.saveScaled ?? true, a.element, a.flag, target, rolls);
    if (n > 0 && sinks.drainFatigue) sinks.drainFatigue(n * FATIGUE_MULTIPLIER);
    handleAttackFromSource(a.caster);
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
  // B1: ctx.bypassSavingThrows is AssignBundleFlags.BypassSavingThrows
  // (EntityEffectManager.AssignBundle) - the quest machine's casts
  // (CastSpellOnFoe's queue drain, CastSpellDo) land with no save
  // rolled, which is exactly the CasterOnly no-save arm below.
  // Immunities are NOT saves and still apply, as in DFU.
  const saveScaled = spell.rangeType !== 0 && !ctx.bypassSavingThrows;   // GetMagnitude's CasterOnly gate (S15)
  // L2-slice (AUDIT 23 magic-11) - FormulaHelper.GetElementType
  // (:1630-1634): an effect whose AllowedElements is MAGIC-ONLY
  // always saves as MAGIC, whatever element the parent spell rode in
  // on. AUDIT 24 systems: the port's predicate was a hand-picked list
  // of families and it missed the alteration/thaumaturgy buffs -
  // Levitate, Slowfall, WaterWalking, WaterBreathing, FreeAction,
  // Jumping, Climbing and the detects all set
  // ElementFlags_MagicOnly too, and three of them are
  // TargetFlags_All, so touch and ranged casts of them really exist.
  // MAGIC_ONLY_KEYS below is the whole set, read off the effect
  // classes rather than guessed at.
  const savesAsMagic = (e) => MAGIC_ONLY_KEYS.has(`${e.type},${classicSub(e)}`);
  const saveElement = (e) => (savesAsMagic(e) ? 4 : spell.element);          // DFCareer.Elements.Magic
  // AUDIT 24 systems: the FLAG is NOT overridden. SavingThrow computes
  // its two arguments from different sources (FormulaHelper.cs:
  // 1568-1569): GetEffectFlags (:1592-1623) looks only at
  // Paralyze/DiseaseEffect and then switches on the PARENT BUNDLE's
  // element - it never consults AllowedElements. Only GetElementType
  // applies the magic-only override. The port had driven both off the
  // same predicate, folding in Career.Magic tolerance and
  // BiographyResistMagicMod where DFU folds in Career.Fire.
  const saveFlag = () => flag;
  const magnitude = (e) => effectMagnitude(e, casterLevel, saveScaled, saveElement(e), saveFlag(e), target, rolls);
  const out = { damage: 0, healed: 0, continuous: 0, skipped: 0 };
  // E2: ctx.heldItem is CastWhenHeld's InstantiateSpellBundle - the
  // whole apply is a HeldMagicItem bundle pinned to the worn item
  // (bundle.FromEquippedItem, CastWhenHeld.cs:~165). A pinned apply
  // NEVER merges into an incumbent and no later cast merges into a
  // pinned entry - DFU keeps the held bundle its own LiveEffectBundle
  // beside any spell bundle, where the port's F12 incumbent-stacking
  // would otherwise weld them (and an unequip could then strip a
  // spell's rounds, or a spell could immortalize itself). The entries
  // are tagged at the tail; tickActiveEffects re-ticks them every
  // round while the item stays worn (DoMagicRound :1733 "item effects
  // are always ticked").
  const heldItem = ctx.heldItem ?? null;
  const pinStart = target.activeEffects?.length ?? 0;
  const findInc = (pred) => (heldItem ? undefined : target.activeEffects?.find((a) => !a.heldItem && pred(a)));
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
      // E1: IsAbsorbingSpells (:1196) is LIVE - the AbsorbsSpells
      // enchantment's constant fold on the target. The caller's own
      // ctx.absorbing (probe surface) still wins when set.
      const sp = tryAbsorption(e, spell.rangeType ?? 0, target, { ...ctx, absorbing: ctx?.absorbing ?? entityAbsorbsSpells(target), rolls });
      if (sp > 0) {
        totalAbsorbed += sp;
        out.absorbed = (out.absorbed ?? 0) + sp;
        continue;
      }
      // X1: SPELL RESISTANCE, third in DFU's chain (TryResistance
      // :1247-1270). On success the effect simply FAILS - no magicka,
      // no re-target, no reduced magnitude, just dropped. A CasterOnly
      // spell is never resisted (:1256), so a self-buff cannot be
      // refused by the caster's own resistance.
      if ((spell.rangeType ?? 0) !== 0 && ctx.bypassSavingThrows !== true) {
        const rc = spellResistanceChance(target);
        if (rc > 0 && Math.floor(rolls() * 100) < rc) {
          out.resisted = (out.resisted ?? 0) + 1;
          continue;
        }
      }
    }
    if (e.type === 43) {
      // TP-slice: Teleport-Effect (43,255) - Start PROMPTS rather
      // than assigning anything (Teleport.cs:63-68); the HOST owns
      // the anchor/teleport box. TargetFlags_Self is the property
      // gate (:52), so only a CasterOnly arrival raises the marker.
      if ((spell.rangeType ?? 0) === 0) out.teleport = true;
      continue;
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
      // DamageHealthFromSource runs HandleAttackFromSource whatever the
      // amount - the `n > 0` guard above is the port's sink contract, not
      // DFU's, and the concealment break is NOT behind it (:162-169).
      handleAttackFromSource(caster?.entity ?? null);
      pushInstantMarker(target, 'damageHealth');
      continue;
    }
    if (isContinuousDamage(e)) {
      // IsLikeKind is settings-blind: ANY ContinuousDamageHealth is
      // incumbent (F12) - a re-cast stacks rounds, keeps the
      // incumbent's own settings, fires no initial round.
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const inc = findInc((a) => a.kind === 'continuousDamage');
        if (inc) inc.roundsRemaining += rounds;
        else pushActive(target, { kind: 'continuousDamage', effect: e, casterLevel, caster: caster?.entity ?? null, element: spell.element, flag, saveScaled, roundsRemaining: rounds }, sinks, rolls);
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
        const inc = findInc((a) => a.kind === 'fortifyAttribute' && a.stat === stat && a.settingsKey === sKey);
        if (inc) inc.roundsRemaining += rounds;
        else pushActive(target, { kind: 'fortifyAttribute', stat, settingsKey: sKey, magnitude: magnitude(e), roundsRemaining: rounds }, sinks, rolls);
        out.fortified = (out.fortified ?? 0) + 1;
      }
      continue;
    }
    if (isDrainAttribute(e) || isTransferAttribute(e)) {
      // Drain{Attribute} (7, s) / Transfer{Attribute} (11, s):
      // permanent-until-healed; Become/AddState both roll a fresh
      // magnitude onto the incumbent's total. Transfer additionally
      // heals the CASTER's drained stat by the PRE-CLAMP roll
      // (lastMagnitudeIncreaseAmount), verbatim.
      // L2-slice (AUDIT 23 magic-12): the incumbent search runs the
      // EXISTING incumbent's like-kind test against the arrival
      // (IncumbentEffect.FindIncumbent - other.IsLikeKind(this)),
      // and TransferEffect IS-A DrainEffect - so a DRAIN incumbent
      // CLAIMS an incoming Transfer of its stat (the roll stacks
      // onto the drain entry, the caster heal still fires), while a
      // TRANSFER incumbent never claims a plain Drain (its test
      // needs a TransferEffect). The claimed entry keeps its own
      // kind; the old same-kind-only search split the pools.
      const kind = isDrainAttribute(e) ? 'drainAttribute' : 'transferAttribute';
      const stat = STAT_KEYS_ORDER[e.subType];
      const amt = magnitude(e);
      if (amt > 0) {
        let entry = findInc((a) => !a.ended && a.stat === stat &&
          (kind === 'transferAttribute'
            ? (a.kind === 'drainAttribute' || a.kind === 'transferAttribute')
            : a.kind === 'drainAttribute'));
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
      handleAttackFromSource(caster?.entity ?? null);
      pushInstantMarker(target, 'damageFatigue');
      out.fatigueDrained = (out.fatigueDrained ?? 0) + 1;
      continue;
    }
    if (isContinuousDamageFatigue(e)) {
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const inc = findInc((a) => a.kind === 'continuousDamageFatigue');
        if (inc) inc.roundsRemaining += rounds;   // settings-blind incumbent (F12)
        else pushActive(target, { kind: 'continuousDamageFatigue', effect: e, casterLevel, caster: caster?.entity ?? null, element: spell.element, flag, saveScaled, roundsRemaining: rounds }, sinks, rolls);
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
      handleAttackFromSource(caster?.entity ?? null);
      pushInstantMarker(target, 'damageSpellPoints');
      continue;
    }
    if (isContinuousDamageSpellPoints(e)) {
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const inc = findInc((a) => a.kind === 'continuousDamageSpellPoints');
        if (inc) inc.roundsRemaining += rounds;   // settings-blind incumbent (F12)
        else pushActive(target, { kind: 'continuousDamageSpellPoints', effect: e, casterLevel, caster: caster?.entity ?? null, element: spell.element, flag, saveScaled, roundsRemaining: rounds }, sinks, rolls);
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
        const inc = findInc((a) => a.kind === 'regenerate' && a.settingsKey === sKey);
        if (inc) inc.roundsRemaining += rounds;
        else pushActive(target, { kind: 'regenerate', effect: e, casterLevel, element: saveElement(e), flag: saveFlag(e), saveScaled, settingsKey: sKey, roundsRemaining: rounds }, sinks, rolls);   // magic-11
        out.continuous++;
      }
      continue;
    }
    if (isParalyze(e)) {
      // S22: AssignBundle drops an incoming Paralyze BEFORE Start
      // when the entity is hard-immune - silently, no stack, no
      // chance roll, no message (EntityEffectManager.cs:496).
      // L2-slice (magic-10): the gate is the MANAGER's check, which
      // carries the career/racial arms beside the FreeAction flag.
      if (isEntityImmuneToParalysis(target)) continue;
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
      const chanceOk = ctx.bypassChance === true || dice100(chanceValue(e, casterLevel), rolls());   // E2: AssignBundleFlags.BypassChance (CastWhenUsed's CasterOnly arm)
      if (!chanceOk) out.chanceFailed = (out.chanceFailed ?? 0) + 1;   // "Spell effect failed."/"Save versus spell made."
      if (rounds > 0) {
        const inc = findInc((a) => a.kind === 'paralyze');
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
      const chanceOk = ctx.bypassChance === true || dice100(chanceValue(e, casterLevel), rolls());   // E2: BypassChance
      if (!chanceOk) { out.chanceFailed = (out.chanceFailed ?? 0) + 1; continue; }
      if (saveScaled && savingThrow(saveElement(e), saveFlag(e), target, 0, rolls) === 0) {   // magic-11: cures save as MAGIC
        out.saved = (out.saved ?? 0) + 1;
        continue;
      }
      cureAllOfKind(target, CURE_KINDS[e.subType]);
      pushInstantMarker(target, CURE_MARKER_KINDS[e.subType]);   // after the removal pass, as AssignBundle adds before MagicRound cures
      out.cured = (out.cured ?? 0) + 1;
      continue;
    }
    // X1: SHIELD (Alteration 35) - the magnitude IS the pool, one
    // point per hit point, rolled once through the same magnitude
    // path every other effect uses (so a ranged cast still runs the
    // saving throw). A like-kind recast stacks rounds and TOPS UP the
    // pool, capped at the incumbent's ORIGINAL startingShield -
    // never above it, and startingShield itself never rises
    // (Shield.cs:53-63).
    if (isShieldEffect(e)) {
      const rounds = rollDuration(e, casterLevel);
      // REVIEW FIX: the pool rides the SAME magnitude path every other
      // magnitude family uses, which is what GetMagnitude does - so a
      // By-Touch or ranged Shield really does run the target's saving
      // throw (EntityEffect.cs:804-806 ModifyEffectAmount). The raw
      // roll this used to take made a ranged Shield unsaveable, which
      // the comment above already claimed it was not.
      const pool = magnitude(e);
      if (rounds > 0 && pool > 0) {
        // REVIEW FIX: a BUSTED pool is no longer an incumbent - that
        // is exactly what DamageShield's ResignAsIncumbent does on
        // bust (Shield.cs:85). Without the `!a.ended` test a recast
        // merged into the corpse, refilled a pool nothing reads
        // (damageShieldPool skips ended entries) and pushed its rounds
        // back above zero so the ticker never swept it - Shield
        // stopped absorbing for good after its first bust.
        const inc = findInc((a) => a.kind === 'shield' && !a.ended);
        if (inc) {
          inc.roundsRemaining += rounds;
          inc.shieldRemaining = Math.min(inc.startingShield, inc.shieldRemaining + pool);
        } else {
          pushActive(target, { kind: 'shield', startingShield: pool, shieldRemaining: pool, roundsRemaining: rounds }, sinks, rolls);
        }
        out.buffs = (out.buffs ?? 0) + 1;
      }
      continue;
    }
    // X1: SPELL ABSORPTION (20) and SPELL RESISTANCE (22) - both are
    // chance-carrying duration buffs the INCOMING-spell chain reads,
    // not effects that act when cast. Absorption's chance is consulted
    // by absorption.js at the top of every incoming effect;
    // Resistance's by the resistance gate below. Both declare
    // ChanceFunction.Custom (SpellAbsorption.cs:30 / SpellResistance
    // .cs:30) so they never roll at cast time - the chance IS the
    // defence. Reflection (21) still pends: it re-targets the whole
    // bundle at its caster, which needs the caster's own effect
    // manager, and the port has no such re-entry yet. FLAGGED.
    if (isSpellAbsorptionEffect(e) || isSpellResistanceEffect(e)) {
      // X2: the same no-magnitude saving throw as above.
      if (saveScaled && savingThrow(saveElement(e), saveFlag(e), target, 0, rolls) === 0) {
        out.saved = (out.saved ?? 0) + 1;
        continue;
      }
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const k = isSpellAbsorptionEffect(e) ? 'spellAbsorption' : 'spellResistance';
        const inc = findInc((a) => a.kind === k);
        if (inc) inc.roundsRemaining += rounds;   // rounds stack; the incumbent's chance stands
        else {
          // X2: ABSORPTION carries its chance SETTINGS, not a frozen
          // number - TryEffectBasedAbsorption recomputes
          // base + plus * floor(level / perLevel) from the TARGET's
          // level at absorb time (EEM:1287-1292), the one place DFU
          // reads the target rather than the caster. RESISTANCE is
          // the opposite: RollChance -> ChanceValue uses the CASTER's
          // level (EntityEffect.cs:740-745), so its chance is
          // rightly fixed at cast.
          const entry = k === 'spellAbsorption'
            ? { kind: k, chanceBase: e.chanceBase, chanceMod: e.chanceMod, chancePerLevel: e.chancePerLevel, roundsRemaining: rounds }
            : { kind: k, chance: chanceValue(e, casterLevel), roundsRemaining: rounds };
          pushActive(target, entry, sinks, rolls);
        }
        out.buffs = (out.buffs ?? 0) + 1;
      }
      continue;
    }
    // X1: ELEMENTAL RESISTANCE (Alteration 8, subType = the element).
    // Not part of the absorb/reflect chain at all: it raises a
    // per-element resistance the SAVING THROW consults first, and a
    // successful resistance roll drops the incoming effect whole
    // (FormulaHelper.SavingThrow :1442-1452). ChanceSuccess is
    // overridden true (ElementalResistance.cs:50-54), so its own
    // startup roll can never fail - the chance IS the resistance.
    if (isElementalResistance(e)) {
      // X2: the NO-MAGNITUDE saving throw (EEM:563-579). These three
      // declare SupportMagnitude = false, so AssignBundle rolls the
      // target's save on any non-CasterOnly cast and drops the effect
      // WHOLE when it makes it - a By-Touch buff can be refused.
      if (saveScaled && savingThrow(saveElement(e), saveFlag(e), target, 0, rolls) === 0) {
        out.saved = (out.saved ?? 0) + 1;
        continue;
      }
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const chance = chanceValue(e, casterLevel);
        const inc = findInc((a) => a.kind === 'elementalResistance' && a.element === e.subType);
        // AddState stacks ROUNDS onto the incumbent and nothing else
        // (ElementalResistance.cs:153-157) - the like-kind instance is
        // discarded, so the incumbent KEEPS its own chance.
        if (inc) inc.roundsRemaining += rounds;
        else pushActive(target, { kind: 'elementalResistance', element: e.subType, chance, roundsRemaining: rounds }, sinks, rolls);
        out.buffs = (out.buffs ?? 0) + 1;
      }
      continue;
    }
    // X1: OPEN and LOCK (Mysticism 17/16) - the ARMING half. DFU's
    // Open and Lock do not act at cast: each sets forcedRoundsRemaining
    // = 1 and waits, and RemoveRound returns it UNDECREMENTED, so the
    // effect never expires on its own - only the door activation that
    // triggers it (or a new cast) ends it. That is a PERMANENT entry
    // here, consumed by the host's door path (world/actionSystem.js).
    // Open rolls its own chance (ChanceFunction.Custom, Open.cs:36) and
    // a failed roll wastes the cast; Lock takes the OnCast default,
    // which the shared gate below would apply - so it rolls here too.
    if (isOpenSpell(e) || isLockSpell(e)) {
      const opening = isOpenSpell(e);
      const chanceOk = ctx.bypassChance === true || dice100(chanceValue(e, casterLevel), rolls());
      if (!chanceOk) { out.chanceFailed = (out.chanceFailed ?? 0) + 1; continue; }
      const armedKind = opening ? 'openArmed' : 'lockArmed';
      const inc = findInc((a) => a.kind === armedKind);
      // X3: AddState is EMPTY on both classes (Open.cs:77-79,
      // Lock.cs:72-74) - a like-kind recast changes NOTHING about the
      // incumbent, and there is nothing to change: the trigger reads
      // the HOLDER's level live (Open.cs:118, Lock.cs:116), so no
      // level is latched at cast at all. The port used to store the
      // cast-time casterLevel and refresh it on a recast; both halves
      // of that are gone. The entry is now pure presence.
      if (!inc) pushPermanent(target, { kind: armedKind, permanent: true });
      // The HOST speaks the alert (mysticism.js owns the texts; this
      // module cannot import it - mysticism imports effects).
      out.armed = armedKind;
      continue;
    }
    // X8: PACIFY (33,0..3) and CHARM (34,255). One arm, because they
    // are one effect split by target class - DFU's own note on Charm
    // says it "operates just like Pacify Humanoid, but only on enemy
    // classes", and Pacify Humanoid's note says it "only operates on
    // humanoid monsters (not enemy classes)". Between them they cover
    // every humanoid and neither overlaps the other.
    //
    // A RECORDED DEPARTURE, and the only one in this lane.
    // Both classes do their work in MagicRound(), and neither sets
    // SupportDuration - Charm's is commented out DELIBERATELY, with
    // the reason written above it: "As Duration has no effect in
    // classic, it is intentionally disabled here." But
    // EntityEffect.SetDuration (:920-933) gives an effect with no
    // duration support roundsRemaining = 0, and
    // EntityEffectManager.DoMagicRound (:1733-1734) calls MagicRound()
    // only `if (effect.RoundsRemaining > 0 || fromEquippedItem)`. So
    // in DFU as it stands the pacify NEVER RUNS: the spell rolls its
    // chance, spends its magicka and does nothing at all. The two
    // deliberate decisions collided.
    //
    // The port implements the INTENT, which the source states in full
    // rather than leaving to inference: "Enemy class will remain
    // pacified permanently until player attacks them (confirmed in
    // classic)". So the pacify lands AT CAST and is PERMANENT, and
    // the "until attacked" half already exists here - every foe
    // damage door re-hostiles a pacified target
    // (MakeEnemyHostileToAttacker), which enemyMotor.js:397 has
    // anticipated by name since the C-slice.
    //
    // Chance-only, no magnitude, TargetFlags_Other - so it takes the
    // ordinary OnCast chance gate and nothing else.
    if (isPacifyEffect(e) || isCharmEffect(e)) {
      const mt = target?.mobileType;
      if (mt == null) continue;                 // not an enemy: IsGroupMatch/IsEnemyClass both refuse
      const matches = isCharmEffect(e)
        ? mt >= 128                             // IsClassEnemyId - Charm is enemy CLASSES only
        : enemyGroupOf(mt) === PACIFY_GROUP[classicSub(e)];
      if (!matches) continue;                   // a mismatch is silent, exactly as DFU's `if` is
      if (!dice100(chanceValue(e, casterLevel), rolls())) { out.chanceFailed = (out.chanceFailed ?? 0) + 1; continue; }
      out.pacify = true;
      continue;
    }
    // X7: IDENTIFY (Thaumaturgy 40,255). DFU's whole effect is a
    // WINDOW OPENER (Identify.cs:46-77) - its own comment says
    // "currently just opens a free identify window". Three laws:
    //
    //  1. It REFUNDS its own spell point cost before opening, floored
    //     at 5 (:50-56), because the real magicka is spent when the
    //     player clicks Identify in the window. DFU is explicit that
    //     only THIS effect's cost comes back: "any other effects
    //     bundled with identify on spell will not have their spell
    //     point cost refunded", so a spell that bundles Identify with
    //     something else still pays for the something else.
    //  2. The target must be the PLAYER (:66-69) - no effect on any
    //     other entity, and nothing lands on them either.
    //  3. ChanceFunction.Custom (:32), so the chance is NOT rolled at
    //     cast; it travels to the window as the per-item roll.
    //
    // The window itself is the host's - this arm hands over the two
    // numbers it needs and the refund it owes.
    if (isIdentifyEffect(e)) {
      if (target?.mobileType != null) continue;   // "target must be player"
      out.identify = {
        chance: chanceValue(e, casterLevel),
        refund: Math.max(IDENTIFY_REFUND_FLOOR, effectCastingCost(e, spell.rangeType, target)),
      };
      continue;
    }
    // X5: SOUL TRAP (Mysticism 12,255). It does not belong in
    // BUFF_KINDS: two of its three laws are its own.
    //
    // 1. ChanceSuccess is hardcoded TRUE (SoulTrap.cs:47-52) so the
    //    effect ALWAYS attaches - the chance is deliberately saved for
    //    the kill, where RollTrapChance() spends it. The cast cannot
    //    fail. The chance is still computed HERE, from the caster's
    //    level, and frozen on the entry (the X2 asymmetry: RollChance
    //    -> ChanceValue -> the CASTER's level, not the target's).
    // 2. BecomeIncumbent (:64-87) gates on the TARGET's entity type
    //    and kills its own effect for two of the three cases:
    //      EnemyMonster    -> "Trap active." and it stays
    //      EnemyClass /
    //      CivilianNPC     -> "Trap will not work on humanoids." and
    //                         it Resigns + Ends AT ONCE. Note DFU's
    //                         humanoid arm `break`s rather than
    //                         `return`s, so the message DOES print;
    //                         the default arm returns first and is
    //                         therefore SILENT.
    //      anything else   -> Resign + End, no message at all.
    //    The port reads mobileType for that split: monsters are
    //    0..127, class enemies 128+, and a target with no mobileType
    //    at all (the player) takes the silent default.
    if (isSoulTrapEffect(e)) {
      const rounds = rollDuration(e, casterLevel);
      const mt = target?.mobileType;
      if (mt == null) continue;                          // the silent default arm
      if (mt >= 128) { out.trapAlert = 'trapHumanoid'; continue; }   // humanoid: speaks, then ends
      if (rounds > 0) {
        const inc = findInc((a) => a.kind === 'soulTrap' && !a.ended);
        // AddState stacks ROUNDS onto the incumbent and nothing else
        // (SoulTrap.cs:94-97) - the incumbent keeps its own chance,
        // so a recast cannot sharpen a trap already running.
        if (inc) inc.roundsRemaining += rounds;
        else {
          pushActive(target, { kind: 'soulTrap', chance: chanceValue(e, casterLevel), roundsRemaining: rounds }, sinks, rolls);
          out.trapAlert = 'trapActive';   // BecomeIncumbent speaks only for a NEW incumbent
        }
        out.buffs = (out.buffs ?? 0) + 1;
      }
      continue;
    }
    const kind = buffKind(e);
    if (kind) {
      // L2-slice (AUDIT 23 magic-3): the landing gates the paralyze
      // and cure arms already carried apply to the whole buff family,
      // in AssignBundle's exact order - the incumbent stack happens
      // INSIDE Start (AddState), so it lands BEFORE the chance and
      // save gates and survives both; a NEW instance passes the
      // OnCast chance, then (no buff has a magnitude) the entity
      // saves against the ENTIRE effect when the cast is not
      // CasterOnly (:560-579). Among these kinds only SILENCE
      // supports chance (Silence.cs:32 - every other buff class sets
      // duration alone), on the OnCast default.
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const inc = findInc((a) => a.kind === kind);
        if (inc) inc.roundsRemaining += rounds;             // incumbent STACKS (F12; = ConcealmentEffect.AddState)
        const chanceOk = kind !== 'silenced' || ctx.bypassChance === true || dice100(chanceValue(e, casterLevel), rolls());   // E2: BypassChance
        if (!chanceOk) { out.chanceFailed = (out.chanceFailed ?? 0) + 1; continue; }
        if (!inc) {
          if (saveScaled && savingThrow(saveElement(e), saveFlag(e), target, 0, rolls) === 0) {   // magic-11: concealments save as MAGIC
            out.saved = (out.saved ?? 0) + 1;
            continue;
          }
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
  // E2: pin the pushed entries to the held item (FromEquippedItem).
  // Instant MARKERS stay unpinned - they are one-round probe residue,
  // not the effect itself. FLAGGED (recorded divergence): DFU re-runs
  // a held bundle's INSTANT effects every magic round too (:1733 - a
  // cast-when-held Fireball burns its wearer per round); the port's
  // instant families act inline at apply, so a held instant fires
  // once per equip. The classic held list is dominated by duration
  // effects, which re-tick exactly.
  if (heldItem) {
    const list = target.activeEffects ?? [];
    for (let i = pinStart; i < list.length; i++) if (!list[i].instant) list[i].heldItem = heldItem;
  }
  // S24: refund the absorbed points (:596-608). A SELF-cast cannot
  // give back more than it cost - absorption is tallied per effect and
  // can otherwise exceed the spell's own price - and the cap does NOT
  // apply to another entity's spell.
  if (totalAbsorbed > 0) {
    const selfCastCost = ctx.selfCastCost ?? 0;
    // AUDIT 23 (magic-5): the caster arrives as the {entity, sinks}
    // WRAPPER every live producer mints - comparing the wrapper itself
    // to the raw target entity never matched, so the cap was dead.
    if (caster?.entity === target && selfCastCost > 0 && totalAbsorbed > selfCastCost) totalAbsorbed = selfCastCost;
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
    // E2: an ITEM-PINNED entry (a held bundle's) is "always ticked" -
    // DoMagicRound :1733 `RoundsRemaining > 0 || fromEquippedItem !=
    // null` runs it whatever its rounds say, and :1739 keeps the
    // bundle alive while the item IS EQUIPPED. The unequip/break doors
    // strip pins through removeItemPinnedEffects; an entry whose item
    // slipped out some other way (a restored save mid-surgery) dies
    // here, DFU's own expiry once IsEquipped answers false. Rounds
    // still count down (BaseEntityEffect.RemoveRound floors at 0) -
    // they just never end the entry.
    if (a.heldItem) {
      if (a.heldItem.equipSlot == null || (a.heldItem.currentCondition ?? 1) <= 0) return false;
      runEffectRound(a, entity, sinks, rolls);
      if (a.roundsRemaining > 0) a.roundsRemaining--;
      return true;
    }
    if (a.permanent) return !a.ended;
    if (a.roundsRemaining <= 0) return false;   // End(): expired last pass
    runEffectRound(a, entity, sinks, rolls);
    a.roundsRemaining--;
    return true;
  });
}

/** E2: UnequipHeldItem's bundle sweep (EntityEffectManager.cs:
 *  1074-1084) - every live entry pinned to THIS item goes, whatever
 *  effect made it. Identity is the pin: the port's items are the one
 *  live record each (DFU matches by UID). Removal IS the port's
 *  End() for these kinds - their mods are read from list presence. */
export function removeItemPinnedEffects(entity, item) {
  const list = entity?.activeEffects;
  if (!list?.length) return;
  entity.activeEffects = list.filter((a) => a.heldItem !== item);
}

// E2: the cast doors, registered UPWARD - enchantments.js sits below
// this module in the import graph (the absorption fold above), so it
// cannot import applySpell; the registration runs once at load, the
// setEnchantmentHooks shape. assignHeldSpell rides these.
setEnchantmentEffectDoors({ applySpell, removeItemPinnedEffects });
