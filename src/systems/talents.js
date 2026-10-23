// @ts-check
// DEEDS0/DEEDS1 (2026-10-23, the owner: "balancing advantages/disadvantages"; bible/06-Systems/Deeds-And-Talents.md
// sections 3-4): THE SWITCH AND THE ADVANTAGES' OWN LAWS - Deeds and Talents in force or not, the price a pick costs,
// the career's advancement multiplier as its specials cost NOW, and the four weak advantages made worth their price.
//
// WHO DECIDES (the owner: "Both modes with toggle. Online always on"): Master Skills' shape (masterSkills.js
// masterSkillsActive) - an entity playing online answers true whatever the shelf says; anything else reads the
// Features row's switch (features.js `deedsAndTalents`, on by default, and the online lane forces it on too).
//
// THE CAREER KEEPS ITS PRICE (section 4.3). The table prices a class when the builder makes it, and for good: a custom
// class built with the switch on carries `advPricing: 'dfo'` (DFO's prices), one built with it off `'dfu'`, and every
// other career - the eighteen stock classes (CLASS.CFG's own multipliers, set by hand, not by the table: of them only
// the Archer carries a repriced pick) and every class built before DEEDS - keeps the multiplier it carries. AUDIT DEEDS
// A1/A2: the price never follows the live switch - a class built off and played on paid DFU's prices for DFO's effects,
// and one built on could turn the switch off for a rest and train at DFU's. The one thing that moves the multiplier is
// an OVERCOMING, in force (deeds.js): it repays the disadvantage's discount at the price the class was made with,
// CreateCharCustomClass's own slope (customClass.js advancementMultiplier: 2.7 / 52 a point) a point. A deed's GRANT
// costs nothing - it was earned.
//
// Departs from DFU's CreateCharSpecialAdvantageWindow.InitializeAdjustmentDict (the prices), PassiveSpecialsEffect
// .RegenerateHealth (the amount), FormulaHelper.CalculateAdrenalineRushToHit (the bar), and AcrobatMotor / PlayerEntity's
// Athleticism terms - Port-Ledger A (DEEDS).
import { getPref } from './uiPrefs.js';
import { advDisAdjustment, classSpecials, SPECIAL_ABILITY_BITS } from './specialAdvantages.js';

/** The Features row's prefs key (features.js declares the row, its default and its online answer). */
export const TALENTS_PREF = 'deedsAndTalents';

/** Deeds and Talents in force: always for an entity playing online, else the player's switch. */
export function talentsInForce(entity = null) {
  return entity?._online === true ? true : !!getPref(TALENTS_PREF);
}

/** The price of a pick under the table in force - what the chargen window charges (section 4.1). */
export const pickDifficulty = (primary, secondary = '') => advDisAdjustment(primary, secondary, talentsInForce());

// ── the career's live multiplier (section 4.3) ─────────────────────

/** CreateCharCustomClass's slope: the multiplier a difficulty point moves (customClass.js advancementMultiplier). */
export const MULTIPLIER_PER_POINT = 2.7 / 52;
/** The builder's own range: 0.3 at -12 points, 3.0 at +40. */
export const MULTIPLIER_MIN = 0.3;
export const MULTIPLIER_MAX = 3.0;

/** The career as it was MADE - its chargen flags under any deed's fold (deeds.js keeps them as `deedBase`). */
export const careerAsMade = (career) => (career?.deedBase ? { ...career, ...career.deedBase } : career);

/** The specials' rows after a deed's overcomings (deeds.js): a removed pick goes, a Critical Weakness lowered is a Low
 *  Tolerance. `overcome` is entity.deeds.overcome - {primary, secondary, to?}, applied in order. */
export function rowsOvercome(rows, overcome) {
  let out = rows.map((r) => ({ primary: r.primary, secondary: r.secondary }));
  for (const o of Array.isArray(overcome) ? overcome : []) {
    const i = out.findIndex((r) => r.primary === o?.primary && r.secondary === o?.secondary);
    if (i < 0) continue;
    if (o.to) out[i] = { primary: o.to, secondary: o.secondary };
    else out = out.filter((_, j) => j !== i);
  }
  return out;
}

const priceOf = (rows, dfo) => rows.reduce((sum, r) => sum + advDisAdjustment(r.primary, r.secondary, dfo), 0);

/** The difficulty points an overcoming repays: the career's specials as they stand after the deeds' overcomings, less
 *  as they were made, both at the price the class was made with - 0 out of force, or with nothing overcome. */
export function careerPriceDelta(entity) {
  const made = careerAsMade(entity?.career);
  const overcome = entity?.deeds?.overcome;
  if (!made || !Array.isArray(overcome) || !overcome.length || !talentsInForce(entity)) return 0;
  const rows = classSpecials(made);
  const dfo = made.advPricing === 'dfo';
  return priceOf(rowsOvercome(rows, overcome), dfo) - priceOf(rows, dfo);
}

/** AUDIT DEEDS A3: the HUD asks every skill's readiness every frame (advancement.js countReadyToImprove), so a career's
 *  repayment is remembered by what decides it - the career, its overcomings and the switch. */
const _delta = new WeakMap();
const priceDeltaOf = (entity) => {
  const career = entity?.career;
  if (!career || !(entity?.deeds?.overcome?.length > 0)) return 0;
  const key = `${entity.deeds.overcome.length}|${talentsInForce(entity)}|${career.advPricing ?? ''}`;
  const hit = _delta.get(career);
  if (hit?.key === key) return hit.delta;
  const delta = careerPriceDelta(entity);
  _delta.set(career, { key, delta });
  return delta;
};

/** The advancement multiplier skill advancement reads (advancement.js): the stored one, moved by careerPriceDelta. */
export function careerAdvancementMultiplier(entity) {
  const stored = entity?.career?.advancementMultiplier ?? 1;
  const delta = priceDeltaOf(entity);
  if (delta === 0) return stored;
  return Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, stored + MULTIPLIER_PER_POINT * delta));
}

// ── the four weak advantages (section 4.2) ─────────────────────────

const ability = (entity) => entity?.career?.abilityFlagsAndSpellPointsBitfield ?? 0;
const carries = (entity, bit) => (ability(entity) & bit) === bit;

/** Regenerate Health: 2% of maximum health a pulse (at least 1) in force; DFU's flat 1 off. */
export const REGENERATE_SHARE = 0.02;
export function regenerateAmount(entity) {
  if (!talentsInForce(entity)) return 1;
  return Math.max(1, Math.round((entity?.maxHealth ?? 0) * REGENERATE_SHARE));
}

/** Acute Hearing marks foes on the compass in force (the host scales the reach by enemySounds.js's own law). */
export const hearsFoes = (entity) => carries(entity, SPECIAL_ABILITY_BITS.acuteHearing) && talentsInForce(entity);

/** The player's own, in force - AUDIT DEEDS B2/B3: a foe carrying the career bit (the Acrobat's class, the atronachs, the
 *  Dreugh) keeps the core's law, and a refereed fight's sheet for a peer (duelCombat.js) is no player of mine. */
const mineInForce = (entity) => !!entity?.isPlayer && !entity.peer && talentsInForce(entity);

/** Adrenaline Rush's bar: under a quarter of maximum health for the player in force; else the core's own (8 classic, 6
 *  overhaul). */
export const RUSH_DIVISOR = 4;
export function inAdrenalineRush(entity, coreDivisor) {
  if (!entity || !carries(entity, SPECIAL_ABILITY_BITS.adrenalineRush)) return false;
  const div = mineInForce(entity) ? RUSH_DIVISOR : coreDivisor;
  return (entity.health ?? 0) < Math.trunc((entity.maxHealth ?? 0) / div);   // C# integer division
}
/** The rush's blows, the player's in force: 20% harder, 30% with Improved Adrenaline Rush (enchantments.js's fold field)
 *  - at a foe alone: never at a player, nor at a warded body (the blow modifiers' own rule, entityMods.js). */
export const RUSH_DAMAGE = 0.2;
export const IMPROVED_RUSH_DAMAGE = 0.3;
export function rushBlow(damage, attacker, target = null) {
  if (!(damage > 0) || !mineInForce(attacker) || target?.isPlayer || target?.warded || !inAdrenalineRush(attacker, RUSH_DIVISOR)) return damage;
  return Math.round(damage * (1 + (attacker._enchantMods?.improvedAdrenalineRush ? IMPROVED_RUSH_DAMAGE : RUSH_DAMAGE)));
}

/** Athleticism, in force: +15 Running and +15 Climbing for the motor's reads, and the fatigue it saves deeper. */
export const ATHLETE_SKILL = 15;
export const athleteSkill = (entity) => (carries(entity, SPECIAL_ABILITY_BITS.athleticism) && talentsInForce(entity) ? ATHLETE_SKILL : 0);
/** The fatigue multiplier Athleticism gives: DFU's 0.9 (0.8 improved) off, 0.8 (0.7 improved) in force. */
export function athleteFatigue(entity, improved) {
  return talentsInForce(entity) ? (improved ? 0.7 : 0.8) : (improved ? 0.8 : 0.9);
}
