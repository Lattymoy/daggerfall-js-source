// S24: SPELL ABSORPTION (EntityEffectManager.TryAbsorption /
// TryCareerBasedAbsorption / GetEffectCastingCost, MIT, Daggerfall
// Workshop).
//
// spellAbsorptionFlags had ZERO consumers. The SORCERER ships
// absorb = Always AND NoRegenSpellPoints, and only the penalty was
// live - the class paid its whole cost and got nothing back, which is
// the exact inverse of the classic trade. U20b then made the same
// absorption purchasable at 8-14 difficulty points.
//
// The law, in DFU's own order:
//   - DESTRUCTION ONLY (:1171). DFU's comment says why: absorption is
//     tested against every incoming effect, so a benign self-heal
//     would otherwise be swallowed.
//   - the cost is computed AS IF THE TARGET CAST IT (:1177), not the
//     real caster - they agree for a self-cast anyway.
//   - the target must have ROOM: cost > (maxMagicka - magicka) refuses
//     (:1180-1184). An absorber at full magicka absorbs nothing.
//   - then the sources in order: the Spell Absorption EFFECT, the
//     CAREER flag, and a persistent absorb state.
import { SKILLS, skillValue } from './skills.js';
import { effectCost, effectSchool, TARGET_COST_MULT, CAST_COST_FLOOR } from './spellcost.js';

/** DFCareer.SpellAbsorptionFlags (:361-368). The one home for these
 *  values - specialAdvantages.js maps the picker's rows onto it. */
export const SPELL_ABSORPTION = Object.freeze({ None: 0, InLight: 1, InDarkness: 2, Always: 4 });

/** GetEffectCastingCost (:1238-1252): the effect's own spellpoint
 *  cost, the TARGET-TYPE multiplier, then the floor of 5 - which DFU
 *  spells out as the guard that stops an absorb from DRAINING the
 *  pool (a spell costs 5 but a 0-cost absorb would credit nothing). */
export function effectCastingCost(effect, targetType, targetEntity) {
  const { sp } = effectCost(effect, (id) => skillValue(targetEntity, id));
  const scaled = Math.trunc(sp * (TARGET_COST_MULT[targetType] ?? 1.0));
  return Math.max(CAST_COST_FLOOR, scaled);
}

/** The effect's magic school, off the cost table's own entry - the
 *  port already single-sources that partition (spellcost.js), so this
 *  reads it rather than minting a second school map. */
export function isDestructionEffect(effect) {
  return effectSchool(effect) === SKILLS.Destruction;
}

/** TryCareerBasedAbsorption (:1294-1320). `inside` and `day` describe
 *  where the TARGET is - the same context rest.js's RapidHealing takes,
 *  and the same law: darkness is inside-or-night, light is
 *  outside-and-day. DFU notes it uses the PLAYER's context for both,
 *  "everything is where the player is". */
export function careerAbsorbs(career, { day = false, inside = true } = {}) {
  const flags = career?.spellAbsorptionFlags ?? SPELL_ABSORPTION.None;
  if (flags === SPELL_ABSORPTION.Always) return true;
  if (flags === SPELL_ABSORPTION.InDarkness) return inside || !day;
  if (flags === SPELL_ABSORPTION.InLight) return !inside && day;
  return false;
}

/** TryAbsorption (:1160-1200). Returns the spell points absorbed, or 0
 *  when the effect passes through. `absorbing` is DFU's persistent
 *  IsAbsorbingSpells state (:1196) - the port has no such effect yet,
 *  so it is an injectable the caller may leave false. */
export function tryAbsorption(effect, targetType, target, { day = false, inside = true, absorbing = false } = {}) {
  if (!effect) return 0;
  if (!isDestructionEffect(effect)) return 0;
  const cost = effectCastingCost(effect, targetType, target);
  const available = (target?.maxMagicka ?? 0) - (target?.magicka ?? 0);
  if (cost > available) return 0;
  if (careerAbsorbs(target?.career, { day, inside })) return cost;
  if (absorbing) return cost;
  return 0;
}
