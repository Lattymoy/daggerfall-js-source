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
// The saving throw applies ONCE at application; its percent scales
// every round of a continuous effect (bundle-level, as DFU applies
// saves to the bundle). Effects outside these three keys stay
// FLAGGED skipped (the library grows here).

import { savingThrow, rollMagnitude, EFFECT_FLAGS } from './spellcast.js';

const ELEMENT_EFFECT_FLAG = Object.freeze([EFFECT_FLAGS.Fire, EFFECT_FLAGS.Frost, EFFECT_FLAGS.Poison, EFFECT_FLAGS.Shock, EFFECT_FLAGS.Magic]);

// S8: the starting-set buffs, classic keys verbatim - incumbent
// self-effects tracked by kind; a re-cast RENEWS to the fresh
// duration (classic re-casting refreshes). Consumers: slowfall
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
  !!entity.activeEffects?.some((a) => a.kind === kind && a.roundsRemaining > 0);

export const isHealHealth = (e) => e.type === 10 && e.subType === 8;
export const isDamageHealth = (e) => e.type === 4 && e.subType === 0;
export const isContinuousDamage = (e) => e.type === 1 && e.subType === 0;
// SpellPoints (magicka) family, verbatim classic keys: HealSpellPoints
// = Restore Power (10, 9); DamageSpellPoints (4, 2); Continuous (1, 2).
// The magicka analog of the Health effects - same instant/active
// shapes, IncreaseMagicka/DecreaseMagicka the sinks (restoreMagicka /
// drainMagicka), MagnitudeCosts (20,28) already in the S10 table.
export const isHealSpellPoints = (e) => e.type === 10 && e.subType === 9;
export const isDamageSpellPoints = (e) => e.type === 4 && e.subType === 2;
export const isContinuousDamageSpellPoints = (e) => e.type === 1 && e.subType === 2;

/** Duration in rounds, verbatim (straight arithmetic, no roll). */
export function rollDuration(effect, casterLevel) {
  const per = Math.max(1, effect.durationPerLevel);
  return effect.durationBase + effect.durationMod * Math.floor(casterLevel / per);
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
      const pct = savingThrow(spell.element, flag, target, 0, rolls);
      const rounds = rollDuration(e, casterLevel);
      if (pct > 0 && rounds > 0) {
        target.activeEffects = target.activeEffects || [];
        target.activeEffects.push({ kind: 'continuousDamage', effect: e, casterLevel, savePct: pct, roundsRemaining: rounds });
        out.continuous++;
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
      const pct = savingThrow(spell.element, flag, target, 0, rolls);
      const rounds = rollDuration(e, casterLevel);
      if (pct > 0 && rounds > 0) {
        target.activeEffects = target.activeEffects || [];
        target.activeEffects.push({ kind: 'continuousDamageSpellPoints', effect: e, casterLevel, savePct: pct, roundsRemaining: rounds });
        out.continuous++;
      }
      continue;
    }
    const kind = buffKind(e);
    if (kind) {
      const rounds = rollDuration(e, casterLevel);
      if (rounds > 0) {
        target.activeEffects = target.activeEffects || [];
        const inc = target.activeEffects.find((a) => a.kind === kind);
        if (inc) inc.roundsRemaining = rounds;              // incumbent renews
        else target.activeEffects.push({ kind, roundsRemaining: rounds });
        out.buffs = (out.buffs ?? 0) + 1;
      }
      continue;
    }
    out.skipped++;   // FLAGGED: the library grows one family at a time
  }
  return out;
}

/** One magic round for one entity: per-round magnitude rolls, save
 *  percent held from application, expiry at 0 rounds. */
export function tickActiveEffects(entity, sinks, rolls = Math.random) {
  const list = entity.activeEffects;
  if (!list || !list.length) return;
  for (const a of list) {
    if (a.kind === 'continuousDamage') {
      const n = Math.trunc(rollMagnitude(a.effect, a.casterLevel, rolls) * a.savePct / 100);
      if (n > 0 && sinks.hurt) sinks.hurt(n);
    } else if (a.kind === 'continuousDamageSpellPoints') {
      const n = Math.trunc(rollMagnitude(a.effect, a.casterLevel, rolls) * a.savePct / 100);
      if (n > 0 && sinks.drainMagicka) sinks.drainMagicka(n);
    }
    a.roundsRemaining--;
  }
  entity.activeEffects = list.filter((a) => a.roundsRemaining > 0);
}
