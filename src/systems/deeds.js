// @ts-check
// DEEDS3 (2026-10-23, the owner: "introducing more power fantasy advantages through gameplay (Not overpowered)"; asked,
// the owner chose Deeds; bible/06-Systems/Deeds-And-Talents.md section 6): ADVANTAGES EARNED BY DOING WHAT THEY NAME.
//
// THE TALLIES (`entity.deeds`, saved - save.js deedsSaved), counted while Deeds and Talents is in force (talents.js):
//   kills    - foes my own blow felled (playerKills.js), by the group the Bonus to Hit ladder reads them as (deedGroupOf:
//              a Human-affinity foe, else enemyEntityGroup's undead / daedra / animals - an orc counts for no Bane, as
//              no Bane would strike it harder); never the City Watch or an ally;
//   stand    - those felled while I stood under a quarter of my health;
//   endured  - damaging spells and poisons faced, by element (playerEndures.js).
//
// THE DEEDS (DEEDS, below): an advantage earned at its tally takes one of DEED_SLOTS, first come first served, for good;
// one earned with every slot full is recorded (`unslotted`) and shown, not granted. A disadvantage OVERCOME takes no
// slot, and repays its discount (talents.js careerAdvancementMultiplier counts the career as it stands after it): a
// Phobia at a third of its Bane's tally, a Critical Weakness lowered to Low Tolerance and a Low Tolerance lifted at
// ENDURE_STEP spells each. Nothing is earned for what the career already carries, nor against a pick it cannot sit
// beside (specialAdvantages.js cannotAdd's own pairs).
//
// THE FOLD (applyDeeds): the career's chargen flags are kept as `deedBase` the first time, and every fold writes the base
// and lays the deeds over it with parseCareerData, the chargen window's own writer - so every reader of the career reads
// a deed with no second door. Out of force the base alone is written: nothing earned is lost. The save writes the base,
// never the fold (save.js).
//
// Not a DFU member: Daggerfall has no deed. Port-Ledger A (DEEDS).
import { talentsInForce, careerAsMade, rowsOvercome } from './talents.js';
import { cannotAdd, classSpecials, parseCareerData, labelFor, ATTACK_BITS, EFFECT_BITS } from './specialAdvantages.js';
import { ENEMY_GROUPS, enemyEntityGroup } from '../combat/enemyGroups.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobile/mobileTypes.js';
import { raceById, raceByKey } from './races.js';
import { t } from './textManager.js';   // L10N4: the deeds' words in the player's language   // AUDIT DEEDS D5: the blood's own tolerances count as carried

/** How many earned advantages a character holds. */
export const DEED_SLOTS = 3;
/** The kills a Bane takes, by group - each about the same share of a life's fighting (the encounter tables' shares,
 *  bible/06-Systems/Deeds-And-Talents.md section 2). */
export const BANE_KILLS = Object.freeze({ humanoid: 250, animals: 150, undead: 100, daedra: 30 });
/** The kills that overcome a Phobia of the group: a third of its Bane's. */
export const FEAR_KILLS = Object.freeze({ humanoid: 80, animals: 50, undead: 35, daedra: 10 });
/** Last Stand: foes felled under a quarter of my health. */
export const STAND_KILLS = 20;
export const STAND_DIVISOR = 4;
/** The spells of an element a step takes (a weakness lowered, a tolerance lifted, Tempered). */
export const ENDURE_STEP = 40;
/** The elements a deed counts, as specialAdvantages.js names their tolerances. */
export const DEED_ELEMENTS = Object.freeze(['toFire', 'toFrost', 'toShock', 'toPoison', 'toMagic']);
const GROUPS = Object.freeze(['humanoid', 'animals', 'undead', 'daedra']);

/** Every deed an advantage is earned by, in the order a tally is checked. `name` is read in the player's language (L10N4:
 *  a getter over t(), read as it is read). */
export const DEEDS = Object.freeze([
  Object.freeze({ id: 'baneMen', get name() { return t('deeds.name.baneMen', 'Bane of Men'); }, primary: 'bonusToHit', secondary: 'humanoid' }),
  Object.freeze({ id: 'baneBeasts', get name() { return t('deeds.name.baneBeasts', 'Bane of Beasts'); }, primary: 'bonusToHit', secondary: 'animals' }),
  Object.freeze({ id: 'baneDead', get name() { return t('deeds.name.baneDead', 'Bane of the Dead'); }, primary: 'bonusToHit', secondary: 'undead' }),
  Object.freeze({ id: 'baneDaedra', get name() { return t('deeds.name.baneDaedra', 'Bane of the Daedra'); }, primary: 'bonusToHit', secondary: 'daedra' }),
  Object.freeze({ id: 'lastStand', get name() { return t('deeds.name.lastStand', 'Last Stand'); }, primary: 'adrenalineRush', secondary: '' }),
  Object.freeze({ id: 'temperedFire', get name() { return t('deeds.name.temperedFire', 'Tempered: Fire'); }, primary: 'resistance', secondary: 'toFire' }),
  Object.freeze({ id: 'temperedFrost', get name() { return t('deeds.name.temperedFrost', 'Tempered: Frost'); }, primary: 'resistance', secondary: 'toFrost' }),
  Object.freeze({ id: 'temperedShock', get name() { return t('deeds.name.temperedShock', 'Tempered: Shock'); }, primary: 'resistance', secondary: 'toShock' }),
  Object.freeze({ id: 'temperedPoison', get name() { return t('deeds.name.temperedPoison', 'Tempered: Poison'); }, primary: 'resistance', secondary: 'toPoison' }),
  Object.freeze({ id: 'temperedMagic', get name() { return t('deeds.name.temperedMagic', 'Tempered: Magic'); }, primary: 'resistance', secondary: 'toMagic' }),
]);
export const DEED_BY_ID = Object.freeze(Object.fromEntries(DEEDS.map((d) => [d.id, d])));

/** The career fields a fold writes, and so the base it keeps. */
const FOLD_FIELDS = Object.freeze(['attackModifierFlags', 'abilityFlagsAndSpellPointsBitfield', 'resistanceFlags', 'lowToleranceFlags', 'criticalWeaknessFlags']);

const count = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
/** A tally record, whole, from anything (a save's, a new character's none). */
export function deedsSaved(d) {
  const src = d && typeof d === 'object' ? d : {};
  const kills = Object.fromEntries(GROUPS.map((g) => [g, count(src.kills?.[g])]));
  const endured = Object.fromEntries(DEED_ELEMENTS.map((e) => [e, count(src.endured?.[e])]));
  const granted = (Array.isArray(src.granted) ? src.granted : []).filter((id) => DEED_BY_ID[id]).slice(0, DEED_SLOTS);
  const unslotted = (Array.isArray(src.unslotted) ? src.unslotted : []).filter((id) => DEED_BY_ID[id] && !granted.includes(id));
  const overcome = (Array.isArray(src.overcome) ? src.overcome : [])
    .filter((o) => o && typeof o.primary === 'string' && typeof o.secondary === 'string')
    .map((o) => (o.to ? { primary: o.primary, secondary: o.secondary, to: String(o.to) } : { primary: o.primary, secondary: o.secondary }));
  return { kills, stand: count(src.stand), endured, granted: [...new Set(granted)], unslotted: [...new Set(unslotted)], overcome };
}
/** The character's live tallies (made whole on first touch). */
export function deedTallies(entity) {
  if (!entity) return deedsSaved(null);
  if (!entity.deeds || typeof entity.deeds !== 'object' || !entity.deeds.kills) entity.deeds = deedsSaved(entity.deeds);
  return entity.deeds;
}

/** The group a deed counts a foe in - the Bonus to Hit ladder's own (combat/formulas.js bonusOrPenaltyByEnemyType). */
export function deedGroupOf(foe) {
  if (!foe || foe.isPlayer) return null;
  if (foe.affinity === 'Human') return 'humanoid';
  const g = enemyEntityGroup(foe.careerIndex);
  return g === ENEMY_GROUPS.Undead ? 'undead' : g === ENEMY_GROUPS.Daedra ? 'daedra' : g === ENEMY_GROUPS.Animals ? 'animals' : null;
}
const neverCounts = (foe) => foe?.mobileType === KNIGHT_CITY_WATCH || foe?.team === 'PlayerAlly' || foe?.mobileTeam === 'PlayerAlly';

// ── the fold ───────────────────────────────────────────────────────

function applyOvercome(career, o) {
  if (o.primary === 'phobia') {
    const bit = ATTACK_BITS[o.secondary]?.[1] ?? 0;
    career.attackModifierFlags = (career.attackModifierFlags ?? 0) & ~bit;
    return;
  }
  const bit = EFFECT_BITS[o.secondary] ?? 0;
  const field = o.primary === 'criticalWeakness' ? 'criticalWeaknessFlags' : o.primary === 'lowTolerance' ? 'lowToleranceFlags' : null;
  if (!field) return;
  career[field] = (career[field] ?? 0) & ~bit;
  if (o.to === 'lowTolerance') career.lowToleranceFlags = (career.lowToleranceFlags ?? 0) | bit;
}

/** Lay the deeds over the career's chargen flags (out of force, the flags alone). A career no deed ever touched is left
 *  as it is. */
export function applyDeeds(entity) {
  const career = entity?.career;
  if (!career) return;
  const d = entity.deeds;
  if (!career.deedBase && !(d?.granted?.length || d?.overcome?.length)) return;
  if (!career.deedBase) career.deedBase = Object.fromEntries(FOLD_FIELDS.map((k) => [k, career[k] ?? 0]));
  for (const k of FOLD_FIELDS) career[k] = career.deedBase[k];
  if (!talentsInForce(entity)) return;
  for (const o of d?.overcome ?? []) applyOvercome(career, o);
  parseCareerData(career, (d?.granted ?? []).map((id) => DEED_BY_ID[id]).filter(Boolean));
}

// ── what a tally earns ─────────────────────────────────────────────

/** The specials the character carries from birth: the career as made and the birth race's (AUDIT DEEDS D5 - a Breton's
 *  Resistance to Magic or a Nord's to Frost is carried already, so no Tempered deed is offered over it). The live race
 *  (a vampire's) is not asked: a curse can end. */
const madeSpecials = (entity) => classSpecials(careerAsMade(entity?.career) ?? {}, raceById(entity?.raceId) ?? raceByKey(entity?.race) ?? null);
const careerRows = (rows) => rows.filter((r) => r.source === 'career');
const toleranceOf = (rows, element) => rows.find((r) => r.secondary === element
  && ['resistance', 'immunity', 'lowTolerance', 'criticalWeakness'].includes(r.primary))?.primary ?? null;
const stepsToNormal = (tol) => (tol === 'criticalWeakness' ? 2 : tol === 'lowTolerance' ? 1 : 0);
const hasOvercome = (d, primary, secondary) => d.overcome.some((o) => o.primary === primary && o.secondary === secondary);

/** The tally a deed needs, given the career as made (a Bane past its phobia, Tempered past its weakness). */
export function deedNeed(entity, deed) {
  const made = careerRows(madeSpecials(entity));
  if (deed.primary === 'bonusToHit') {
    const phobic = made.some((r) => r.primary === 'phobia' && r.secondary === deed.secondary);
    return BANE_KILLS[deed.secondary] + (phobic ? FEAR_KILLS[deed.secondary] : 0);
  }
  if (deed.primary === 'adrenalineRush') return STAND_KILLS;
  return (stepsToNormal(toleranceOf(made, deed.secondary)) + 1) * ENDURE_STEP;
}
/** What the tally has toward a deed. */
export function deedHave(entity, deed) {
  const d = deedTallies(entity);
  if (deed.primary === 'bonusToHit') return d.kills[deed.secondary] ?? 0;
  if (deed.primary === 'adrenalineRush') return d.stand;
  return d.endured[deed.secondary] ?? 0;
}

/** Every overcoming and deed the tallies have reached, taken now - answers the lines a HUD says, in order. */
export function checkDeeds(entity) {
  const said = [];
  if (!entity?.career || !talentsInForce(entity)) return said;
  const d = deedTallies(entity);
  const birth = madeSpecials(entity);
  const made = careerRows(birth);
  // overcomings first: a Bane waits on its phobia, Tempered on its weakness
  for (const g of GROUPS) {
    if (made.some((r) => r.primary === 'phobia' && r.secondary === g) && !hasOvercome(d, 'phobia', g) && d.kills[g] >= FEAR_KILLS[g]) {
      d.overcome.push({ primary: 'phobia', secondary: g });
      said.push(t('deeds.fearConquered', 'Fear conquered: you no longer suffer your Phobia of {group}.', { group: labelFor(g) }));
    }
  }
  for (const e of DEED_ELEMENTS) {
    const tol = toleranceOf(made, e);
    const n = d.endured[e];
    if (tol === 'criticalWeakness' && !hasOvercome(d, 'criticalWeakness', e) && n >= ENDURE_STEP) {
      d.overcome.push({ primary: 'criticalWeakness', secondary: e, to: 'lowTolerance' });
      said.push(t('deeds.weaknessLowered', 'Hardened: your Critical Weakness {element} is now a Low Tolerance.', { element: labelFor(e) }));
    }
    if ((tol === 'lowTolerance' || tol === 'criticalWeakness') && !hasOvercome(d, 'lowTolerance', e) && n >= stepsToNormal(tol) * ENDURE_STEP) {
      d.overcome.push({ primary: 'lowTolerance', secondary: e });
      said.push(t('deeds.toleranceLifted', 'Hardened: you no longer suffer a Low Tolerance {element}.', { element: labelFor(e) }));
    }
  }
  const live = [...rowsOvercome(made, d.overcome), ...birth.filter((r) => r.source === 'race')];
  for (const deed of DEEDS) {
    if (d.granted.includes(deed.id) || d.unslotted.includes(deed.id)) continue;
    const pick = { primary: deed.primary, secondary: deed.secondary };
    if (cannotAdd(pick, live) || deedHave(entity, deed) < deedNeed(entity, deed)) continue;
    const label = deed.secondary ? `${labelFor(deed.primary)} ${labelFor(deed.secondary)}` : labelFor(deed.primary);
    if (d.granted.length < DEED_SLOTS) {
      d.granted.push(deed.id);
      live.push(pick);
      said.push(t('deeds.earned', 'Deed done: {deed}. {advantage} is yours ({n} of {max} deeds).', { deed: deed.name, advantage: label, n: d.granted.length, max: DEED_SLOTS }));
    } else {
      d.unslotted.push(deed.id);
      said.push(t('deeds.unslotted', 'Deed done: {deed} - but all {max} of your deeds are taken.', { deed: deed.name, max: DEED_SLOTS }));
    }
  }
  if (said.length) applyDeeds(entity);
  return said;
}

// ── the tallies' doors ─────────────────────────────────────────────

/** My blow felled `foe` (playerKills.js's word). Answers the lines earned. */
export function deedKill(entity, foe) {
  if (!entity?.isPlayer || !talentsInForce(entity) || !foe || neverCounts(foe)) return [];
  const g = deedGroupOf(foe);
  const d = deedTallies(entity);
  if (g) d.kills[g] += 1;
  if ((entity.health ?? 0) > 0 && (entity.health ?? 0) < Math.trunc((entity.maxHealth ?? 0) / STAND_DIVISOR)) d.stand += 1;
  return checkDeeds(entity);
}
/** I endured a spell or a poison carrying `flags` (playerEndures.js's word). Answers the lines earned. */
export function deedEndured(entity, flags) {
  if (!entity?.isPlayer || !talentsInForce(entity)) return [];
  const d = deedTallies(entity);
  let any = false;
  for (const e of DEED_ELEMENTS) if (flags & EFFECT_BITS[e]) { d.endured[e] += 1; any = true; }
  return any ? checkDeeds(entity) : [];
}

// ── the sheet's rows ───────────────────────────────────────────────

/** The made disadvantage a deed waits on (AUDIT DEEDS D6): its group's Phobia, or its element's weakness - one an
 *  overcoming lifts. null when nothing it can lift stands in the way. */
const blockerOf = (deed, live) => live.find((r) => r.secondary === deed.secondary
  && ((deed.primary === 'bonusToHit' && r.primary === 'phobia')
   || (deed.primary === 'resistance' && (r.primary === 'lowTolerance' || r.primary === 'criticalWeakness')))) ?? null;

/** Every deed for the character sheet: its name, the advantage, and where it stands - 'earned', 'unslotted' (done, no
 *  slot), 'progress' (with have / need), 'blocked' (with have / need, and the disadvantage it waits on - AUDIT DEEDS D6:
 *  the deed past a phobia or a weakness, its tally counting the overcoming's), or 'closed' (nothing to earn: the
 *  character carries it or cannot take it). */
export function deedRows(entity) {
  const d = deedTallies(entity);
  const birth = madeSpecials(entity);
  const live = [...rowsOvercome(careerRows(birth), d.overcome), ...birth.filter((r) => r.source === 'race')];
  return DEEDS.map((deed) => {
    const label = deed.secondary ? `${labelFor(deed.primary)} ${labelFor(deed.secondary)}` : labelFor(deed.primary);
    const blocker = blockerOf(deed, live);
    const state = d.granted.includes(deed.id) ? 'earned' : d.unslotted.includes(deed.id) ? 'unslotted'
      : blocker ? 'blocked' : cannotAdd({ primary: deed.primary, secondary: deed.secondary }, live) ? 'closed' : 'progress';
    const row = { id: deed.id, name: deed.name, label, state, have: deedHave(entity, deed), need: deedNeed(entity, deed) };
    return blocker && state === 'blocked' ? { ...row, blocker: `${labelFor(blocker.primary)} ${labelFor(blocker.secondary)}` } : row;
  });
}
/** The overcomings, as the sheet says them. */
export function overcomeRows(entity) {
  return deedTallies(entity).overcome.map((o) => (o.to
    ? t('deeds.row.lowered', '{from} lowered to {to}', { from: `${labelFor(o.primary)} ${labelFor(o.secondary)}`, to: labelFor(o.to) })
    : t('deeds.row.overcome', '{what} overcome', { what: `${labelFor(o.primary)} ${labelFor(o.secondary)}` })));
}

/** The character sheet's specials (specialAdvantages.js classSpecials over the folded career) with each advantage a
 *  deed laid on marked `source: 'deed'` - a pick the career as made never carried. */
export function deedSpecials(entity, rows) {
  const made = careerRows(madeSpecials(entity));
  const granted = deedTallies(entity).granted.map((id) => DEED_BY_ID[id]).filter(Boolean);
  return (rows ?? []).map((r) => (r.source === 'career'
    && granted.some((g) => g.primary === r.primary && g.secondary === r.secondary)
    && !made.some((m) => m.primary === r.primary && m.secondary === r.secondary) ? { ...r, source: 'deed' } : r));
}
