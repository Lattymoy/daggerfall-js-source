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
//     real caster - they agree for a self-cast in DFU. The port's cast
//     is priced with its modifiers and this cost is not, so a self-cast
//     asks the room, and drinks, no more than it spent (AUDIT RPT1026 F3).
//   - the target must have ROOM: cost > (maxMagicka - magicka) refuses
//     (:1180-1184). An absorber at full magicka absorbs nothing.
//   - then the sources in order: the Spell Absorption EFFECT, the
//     CAREER flag, and a persistent absorb state.
import { SKILLS, skillValue } from './skills.js';
import { effectCost, effectSchool, TARGET_COST_MULT, CAST_COST_FLOOR } from './spellcost.js';

/** DFCareer.SpellAbsorptionFlags (:361-368). specialAdvantages.js
 *  mints its own ABSORPTION_FLAGS copy of the same enum (AUDIT 23
 *  corrected the 'one home' claim; the two are value-identical and
 *  pinned). */
export const SPELL_ABSORPTION = Object.freeze({ None: 0, InLight: 1, InDarkness: 2, Always: 4 });

/** ABSORB-NERF (2026-09-30, Discord: "Nerf spell absorption, it breaks the game"): THE PORT'S OWN, never DFU's. A
 *  100% AbsorbsSpells item (or a 100% crafted Spell Absorption) made its wearer all but immune to casters AND refilled
 *  their magicka off every bolt. Three numbers, one home:
 *   - ABSORB_ENCHANT_CHANCE: the AbsorbsSpells item enchantment is a ROLL of 50%, no longer DFU's flat always;
 *   - SPELL_ABSORPTION_CHANCE_CAP: the Spell Absorption EFFECT's computed chance never passes 50% (the Spell Maker's
 *     chanceBase for it stops at the same 50, spellMaker.js spinnerRange);
 *   - ABSORB_REFUND_SCALE: whatever absorbs, the magicka it gives back is HALF the points drunk, floored (effects.js
 *     absorbRefund) - a 0 refund is fine.
 *  The CAREER's Always (the Sorcerer, a custom class's advantage) keeps its 100%: a Sorcerer has no regen and lives on
 *  it - but it too refunds only half. The Eye of Mora sigil set is untouched. */
export const ABSORB_ENCHANT_CHANCE = 50;
export const SPELL_ABSORPTION_CHANCE_CAP = 50;
export const ABSORB_REFUND_SCALE = 0.5;
/** ABSORB-NERF: the magicka an absorb of `points` gives back - half, floored. */
export const absorbRefund = (points) => Math.max(0, Math.floor((Number(points) || 0) * ABSORB_REFUND_SCALE));

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

/** SET2 (Mora's Mantle's Eye of Mora, bible/11-Multiplayer/Sigil-Sets.md): THE PORT'S OWN ABSORPTION CHANCES - named
 *  sources, `fn(target) -> per cent`, each rolled on its own after the effect's arm and before the career's, under
 *  DFU's own two gates (a Destruction effect, and room in the target's magicka for what it drinks). A source answers 0
 *  for any target it is not about. */
const _absorbChances = new Map();
export function registerAbsorptionChance(name, fn) {
  if (typeof fn === 'function') _absorbChances.set(name, fn);
  else _absorbChances.delete(name);
}

/** TryAbsorption (:1160-1200). Returns the spell points absorbed, or 0
 *  when the effect passes through. `absorbing` is DFU's persistent
 *  IsAbsorbingSpells state (:1196) - the port has no such effect yet,
 *  so it is an injectable the caller may leave false. */
export function tryAbsorption(
  effect,
  targetType,
  target,
  { day = false, inside = true, absorbing = false, rolls = Math.random, paid = 0 } = {},
) {
  if (!effect) return 0;
  if (!isDestructionEffect(effect)) return 0;
  const cost = effectCastingCost(effect, targetType, target);
  const available = (target?.maxMagicka ?? 0) - (target?.magicka ?? 0);
  // AUDIT RPT1026 F3 (a private report: after a rest a player's own blast was never absorbed): MY OWN SPELL NEEDS NO MORE
  // ROOM THAN IT SPENT. DFU prices the absorb "as if the target cast the spell" and notes a self-absorb is "the same
  // thing" (:1177) - at a full pool the cast makes room for its own price, and its absorb fits. The port's cast is priced
  // with more (spellcost.js calculateCastCost: the focus pieces, the sets, a path's school), this absorb without, so a
  // discounted cast made too little room and a rested caster died to their own blast. `paid` is that cast's own spend
  // (effects.js applySpell: the release's token, when caster and target are one), and what it drinks is never more.
  const drink = paid > 0 ? Math.min(cost, paid) : cost;
  if (drink > available) return 0;
  // X1: the EFFECT-based arm is tried FIRST (:1186-1189), and it is
  // the one place DFU rolls the TARGET's level rather than the
  // caster's (TryEffectBasedAbsorption :1287-1292 vs the generic
  // ChanceValue). A failed roll falls THROUGH to career and to the
  // persistent flag - DFU's own order, not classic's override.
  const chance = spellAbsorptionChance(target);
  if (chance > 0 && Math.floor(rolls() * 100) < chance) return drink;
  for (const fn of _absorbChances.values()) {
    // SET2: the port's own, each its own roll - none is rolled that answers 0
    let c = 0;
    try {
      c = Number(fn(target)) || 0;
    } catch {
      c = 0;
    }
    if (c > 0 && Math.floor(rolls() * 100) < c) return drink;
  }
  if (careerAbsorbs(target?.career, { day, inside })) return drink;
  // ABSORB-NERF (2026-09-30, Discord: "Nerf spell absorption, it breaks the game"): the AbsorbsSpells enchantment is
  // a 50% roll, no longer DFU's flat always (:1196)
  if (absorbing && Math.floor(rolls() * 100) < ABSORB_ENCHANT_CHANCE) return drink;
  return 0;
}

/** X2: the live Spell Absorption chance - the FIRST incumbent
 *  (FindIncumbentEffect returns one, EEM:666-678), recomputed HERE
 *  from the TARGET's level rather than read off the entry.
 *  TryEffectBasedAbsorption is the one place DFU rolls the target's
 *  level instead of the caster's (EEM:1287-1292), so the entry
 *  carries the chance SETTINGS and the arithmetic happens at absorb
 *  time - a target who levels up mid-buff really does absorb better.
 *  A pre-X2 entry that still carries a frozen `chance` is honoured. */
export function spellAbsorptionChance(target) {
  // AUDIT SPELL-GIFT B4: THE BEST of the live entries. DFU's incumbent is the ONE bundle (a recast merges into it); a
  // gift here never merges with my own (AUDIT ALLY-CAST C2), so two may stand - and a stranger's 0% gift, first in
  // the list, made my own 100% read 0 for as long as it ran.
  let best = 0;
  for (const a of target?.activeEffects ?? []) {
    if (a.kind !== 'spellAbsorption' || a.ended) continue;
    const per = Math.max(1, a.chancePerLevel ?? 1);
    const chance =
      a.chanceBase == null
        ? (a.chance ?? 0)
        : (a.chanceBase ?? 0) + (a.chanceMod ?? 0) * Math.floor((target?.level ?? 1) / per);
    if (chance > best) best = chance;
  }
  // ABSORB-NERF (2026-09-30, Discord: "Nerf spell absorption, it breaks the game"): the effect's chance caps at 50%
  return Math.min(SPELL_ABSORPTION_CHANCE_CAP, best);
}
