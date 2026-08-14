// The effect spine (Systems S7 - effect library I). Verbatim from
// DFU EntityEffect/EntityEffectBroker + the effect classes (MIT,
// Daggerfall Workshop):
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
// SavingThrow on every call). Every effect fires its INITIAL magic
// round at assignment (audit F17 - EntityEffectManager.AssignBundle:
// "gets initial magic round"), consuming round 1; re-casts of an
// incumbent STACK rounds onto it (audit F12 - AddState
// "Stack my rounds onto incumbent") and fire no initial round (the
// joining instance is never added to liveEffects). Effects outside
// these keys stay FLAGGED skipped (the library grows here).

import { savingThrow, rollMagnitude, EFFECT_FLAGS } from './spellcast.js';
import { STAT_KEYS_ORDER } from './statMods.js';

const ELEMENT_EFFECT_FLAG = Object.freeze([EFFECT_FLAGS.Fire, EFFECT_FLAGS.Frost, EFFECT_FLAGS.Poison, EFFECT_FLAGS.Shock, EFFECT_FLAGS.Magic]);

// S8: the starting-set buffs, classic keys verbatim - incumbent
// self-effects tracked by kind (IsLikeKind is settings-blind for all
// three); a re-cast STACKS its rounds onto the incumbent (F12).
// Consumers: slowfall
// scales the player's fall; chameleonNormal halves foe sight range
// (concealment); waterWalking tracks but its consumer FLAGGED
// (swimming pends).
export const BUFF_KINDS = Object.freeze({
  '25,255': 'slowfall',
  '31,255': 'waterWalking',
  '23,0': 'chameleonNormal',
});
export const buffKind = (e) => BUFF_KINDS[`${e.type},${e.subType}`] ?? null;
export const hasActiveEffect = (entity, kind) =>
  !!entity.activeEffects?.some((a) => a.kind === kind);   // presence = active; expired entries End on the NEXT tick pass (DFU shape)

export const isHealHealth = (e) => e.type === 10 && e.subType === 8;
export const isDamageHealth = (e) => e.type === 4 && e.subType === 0;
export const isContinuousDamage = (e) => e.type === 1 && e.subType === 0;
// SpellPoints (magicka) family, verbatim classic keys: HealSpellPoints
// = Restore Power (10, 9); DamageSpellPoints (4, 2); Continuous (1, 2).
// The magicka analog of the Health effects - same instant/active
// shapes, IncreaseMagicka/DecreaseMagicka the sinks (restoreMagicka /
// drainMagicka), MagnitudeCosts (20,28) already in the S10 table.
// Fortify{Attribute} (classic type 9, subType = the stat index 0..7).
// The stat-mod layer (STAT_KEYS_ORDER, liveStat) lives standalone in
// statMods.js to avoid a formulas<-spellcast<-effects import cycle.
export const isFortifyAttribute = (e) => e.type === 9 && e.subType >= 0 && e.subType <= 7;

export const isHealSpellPoints = (e) => e.type === 10 && e.subType === 9;
export const isDamageSpellPoints = (e) => e.type === 4 && e.subType === 2;
export const isContinuousDamageSpellPoints = (e) => e.type === 1 && e.subType === 2;

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

/** CompareSettings identity for fortify like-kind (F12): the classic
 *  record's duration + chance + magnitude component fields. */
export const settingsKeyOf = (e) => [
  e.durationBase, e.durationMod, e.durationPerLevel,
  e.chanceBase, e.chanceMod, e.chancePerLevel,
  e.magnitudeBaseLow, e.magnitudeBaseHigh, e.magnitudeLevelBase,
  e.magnitudeLevelHigh, e.magnitudePerLevel,
].join(',');

/** One magic round for one ACTIVE entry - the saving throw rolls
 *  FRESH here every round (F10). Fortify/buff rounds only count down
 *  (their state applies via liveStat / hasActiveEffect). */
function runEffectRound(a, target, sinks, rolls) {
  if (a.kind === 'continuousDamage') {
    const pct = savingThrow(a.element, a.flag, target, 0, rolls);
    const n = Math.trunc(rollMagnitude(a.effect, a.casterLevel, rolls) * pct / 100);
    if (n > 0 && sinks.hurt) sinks.hurt(n);
  } else if (a.kind === 'continuousDamageSpellPoints') {
    const pct = savingThrow(a.element, a.flag, target, 0, rolls);
    const n = Math.trunc(rollMagnitude(a.effect, a.casterLevel, rolls) * pct / 100);
    if (n > 0 && sinks.drainMagicka) sinks.drainMagicka(n);
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

/**
 * Apply a spell to a target entity through the sinks:
 *   hurt(n)  - damage (the caller owns floors/death)
 *   heal(n)  - IncreaseHealth (the caller owns the max clamp)
 * Instant families act now; continuous joins target.activeEffects
 * for the round ticker. Returns what happened (tested).
 */
export function applySpell(spell, casterLevel, target, sinks, rolls = Math.random) {
  const flag = ELEMENT_EFFECT_FLAG[spell.element] ?? EFFECT_FLAGS.Magic;
  const out = { damage: 0, healed: 0, continuous: 0, skipped: 0 };
  for (const e of spell.effects) {
    if (e.type <= -1) continue;
    if (isHealHealth(e)) {
      const n = rollMagnitude(e, casterLevel, rolls);
      out.healed += n;
      if (sinks.heal) sinks.heal(n);
      continue;
    }
    if (isDamageHealth(e)) {
      const pct = savingThrow(spell.element, flag, target, 0, rolls);
      const n = Math.trunc(rollMagnitude(e, casterLevel, rolls) * pct / 100);
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
        else pushActive(target, { kind: 'continuousDamage', effect: e, casterLevel, element: spell.element, flag, roundsRemaining: rounds }, sinks, rolls);
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
        else pushActive(target, { kind: 'fortifyAttribute', stat, settingsKey: sKey, magnitude: rollMagnitude(e, casterLevel, rolls), roundsRemaining: rounds }, sinks, rolls);
        out.fortified = (out.fortified ?? 0) + 1;
      }
      continue;
    }
    if (isHealSpellPoints(e)) {
      // HealSpellPoints.MagicRound: IncreaseMagicka(magnitude), self,
      // instant (the caller owns the maxMagicka clamp).
      const n = rollMagnitude(e, casterLevel, rolls);
      out.magickaHealed = (out.magickaHealed ?? 0) + n;
      if (sinks.restoreMagicka) sinks.restoreMagicka(n);
      continue;
    }
    if (isDamageSpellPoints(e)) {
      // DamageSpellPoints.MagicRound: DamageMagickaFromSource(magnitude),
      // single-target-other, instant, saving-throw scaled like damage.
      const pct = savingThrow(spell.element, flag, target, 0, rolls);
      const n = Math.trunc(rollMagnitude(e, casterLevel, rolls) * pct / 100);
      out.magickaDrained = (out.magickaDrained ?? 0) + n;
      if (n > 0 && sinks.drainMagicka) sinks.drainMagicka(n);
      continue;
    }
    if (isContinuousDamageSpellPoints(e)) {
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        const inc = target.activeEffects?.find((a) => a.kind === 'continuousDamageSpellPoints');
        if (inc) inc.roundsRemaining += rounds;   // settings-blind incumbent (F12)
        else pushActive(target, { kind: 'continuousDamageSpellPoints', effect: e, casterLevel, element: spell.element, flag, roundsRemaining: rounds }, sinks, rolls);
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

/** One magic round for one entity, DoMagicRound's exact shape:
 *  entries found at 0 rounds END this pass (removed WITHOUT acting);
 *  live entries act (saves rolled fresh per round - F10), decrement,
 *  and stay through this pass even on reaching 0 - so a fortify's
 *  mod, like DFU's, survives until the pass that finds it expired. */
export function tickActiveEffects(entity, sinks, rolls = Math.random) {
  const list = entity.activeEffects;
  if (!list || !list.length) return;
  entity.activeEffects = list.filter((a) => {
    if (a.roundsRemaining <= 0) return false;   // End(): expired last pass
    runEffectRound(a, entity, sinks, rolls);
    a.roundsRemaining--;
    return true;
  });
}
