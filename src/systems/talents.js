// @ts-check
// DEEDS0/DEEDS1 (2026-10-23, the owner: "balancing advantages/disadvantages"; bible/06-Systems/Deeds-And-Talents.md
// sections 3-4): THE SWITCH AND THE ADVANTAGES' OWN LAWS - Deeds and Talents in force or not, the price a pick costs,
// the career's advancement multiplier as its specials cost NOW, and the four weak advantages made worth their price.
//
// WHO DECIDES (the owner: "Both modes with toggle. Online always on"): Master Skills' shape (masterSkills.js
// masterSkillsActive) - an entity playing online answers true whatever the shelf says; anything else reads the
// Features row's switch (features.js `deedsAndTalents`, on by default, and the online lane forces it on too).
//
// THE CAREER KEEPS ITS PRICE (section 4.3). The table prices a class when the builder makes it: a custom class built
// with the switch on carries `advPricing: 'dfo'` and is charged DFO's prices while the switch is on, DFU's when it is
// off. Every other career keeps the multiplier it carries - the eighteen stock classes (CLASS.CFG's own, set by hand,
// not by the table: of them only the Archer carries a repriced pick) and every class built before DEEDS. The live
// multiplier adds CreateCharCustomClass's own slope (customClass.js advancementMultiplier: 2.7 / 52 a point) for each
// point the career's specials cost now, as they stand after any disadvantage a deed overcame, minus what they cost when
// the class was made. A deed's GRANT costs nothing (it was earned); an OVERCOMING repays the disadvantage's discount
// (deeds.js), at the price the career is charged.
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

/** The difficulty points the career's specials are charged now, less what they cost when the class was made: DFO's
 *  table charges only a class it built (`advPricing: 'dfo'`), and only in force. */
export function careerPriceDelta(entity) {
  const made = careerAsMade(entity?.career);
  if (!made) return 0;
  const rows = classSpecials(made);
  const inForce = talentsInForce(entity);
  const builtDfo = made.advPricing === 'dfo';
  const now = inForce ? rowsOvercome(rows, entity?.deeds?.overcome) : rows;
  return priceOf(now, builtDfo && inForce) - priceOf(rows, builtDfo);
}

/** The advancement multiplier skill advancement reads (advancement.js): the stored one, moved by careerPriceDelta. */
export function careerAdvancementMultiplier(entity) {
  const stored = entity?.career?.advancementMultiplier ?? 1;
  const delta = careerPriceDelta(entity);
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

/** Adrenaline Rush's bar: under a quarter of maximum health in force; off, the core's own (8 classic, 6 overhaul). */
export const RUSH_DIVISOR = 4;
export function inAdrenalineRush(entity, coreDivisor) {
  if (!entity || !carries(entity, SPECIAL_ABILITY_BITS.adrenalineRush)) return false;
  const div = talentsInForce(entity) ? RUSH_DIVISOR : coreDivisor;
  return (entity.health ?? 0) < Math.trunc((entity.maxHealth ?? 0) / div);   // C# integer division
}
/** The rush's blows, in force: 20% harder, 30% with Improved Adrenaline Rush (enchantments.js's fold field). */
export const RUSH_DAMAGE = 0.2;
export const IMPROVED_RUSH_DAMAGE = 0.3;
export function rushBlow(damage, attacker) {
  if (!(damage > 0) || !talentsInForce(attacker) || !inAdrenalineRush(attacker, RUSH_DIVISOR)) return damage;
  return Math.round(damage * (1 + (attacker._enchantMods?.improvedAdrenalineRush ? IMPROVED_RUSH_DAMAGE : RUSH_DAMAGE)));
}

/** Athleticism, in force: +15 Running and +15 Climbing for the motor's reads, and the fatigue it saves deeper. */
export const ATHLETE_SKILL = 15;
export const athleteSkill = (entity) => (carries(entity, SPECIAL_ABILITY_BITS.athleticism) && talentsInForce(entity) ? ATHLETE_SKILL : 0);
/** The fatigue multiplier Athleticism gives: DFU's 0.9 (0.8 improved) off, 0.8 (0.7 improved) in force. */
export function athleteFatigue(entity, improved) {
  return talentsInForce(entity) ? (improved ? 0.7 : 0.8) : (improved ? 0.8 : 0.9);
}
