// @ts-check
// SCHOOLS (2026-10-13) - ARCANE SPECIALISATIONS: A MAGE IS THE SCHOOLS THEY MASTER. bible/06-Systems/Arcane-Specialisations.md
//
// The Patreon chat, through the owner: "One thing I've found with making mage characters recently, is that they all kind
// of end up the same ... specialisation based on the two master skills you pick ... Restoration and Mysticism could be the
// requirements for a Necromancer sub-class for instance, giving access to some spicy new spells." Asked, the owner chose:
// the pair CHOSEN ONCE among the schools mastered, permanent as a mastery is; each pair a signature spell, a passive, and
// every school paying past 100 in its own way; nothing below 100 changed; all of it at once.
//
// THE LAW, and nothing that acts - a leaf the price (spellcost.js castSchool), the judge (server-account/src/judge.js),
// the shelf, the sheets and the powers (systems/arcanePowers.js) all read, so none of them grows a cycle:
//   - the fifteen PATHS, one for each pair of the six schools: the signature spell's record data
//     (systems/signatureSpells.js builds the record) and the words a player reads (`pathWords`, through the text core);
//   - every NUMBER a path's passive and rider names (`PATH_NUMBERS`) - the one home the words print and
//     arcanePowers.js does, so a balance pass moves one number;
//   - WHO may choose (`pathChoices`: Master Skills in force, two or more schools mastered, no path yet) and the choice
//     (`choosePath`: undone only by SPEC-RESET's paid reset, systems/specReset.js - nothing here undoes it);
//   - when a path ACTS (`pathAwake`: my own entity, Master Skills in force, both its schools mastered, not mentoring -
//     and the powers add the refereed fight's word, sigil.js sigilDueling, the one every loot and set power sleeps on:
//     importing it here would hang the price's graph on sigil.js's, which reaches back into spellcost.js);
//   - THE SCHOOLS A SIGNATURE SPELL IS CAST IN (`pathCastSchool`): its path's two, so a Necromancer's Siphon Life is
//     priced, taught and strengthened by Restoration and Mysticism, never by a Destruction they did not choose;
//   - the judge's finding (`pathFindings`): a path no table holds, or whose schools are not both mastered (no signature
//     spell is judged - AUDIT SCHOOLS L3 F2).
//
// Everything a player reads is `t()`, read when it is read - the signature spell's name too: it is minted into the record
// in the buyer's language (a record's name is a label, as a made spell's is; a signature spell is known by its `path`
// and its index, never by its name).

import { SKILLS, MAGIC_SKILLS, SKILL_NAMES } from './skills.js';
import { masterSkillsActive, isMasteredSkill, masteredSkills, masterableCount } from './masterSkills.js';
import { t } from './textManager.js';

const { Destruction: DES, Restoration: RES, Illusion: ILL, Alteration: ALT, Thaumaturgy: THA, Mysticism: MYS } = SKILLS;

/** The classic elements a signature spell rides (DFU ElementTypes). */
const FIRE = 0, SHOCK = 3, MAGIC = 4;
/** Range types: CasterOnly 0, SingleTargetAtRange 2. */
const SELF = 0, AT_RANGE = 2;

// One slot's settings, by component: d(base, plus, perLevels), c(base, plus, perLevels), m(low, high, plusLow, plusHigh,
// perLevels). Anything unsaid is the maker's own 1 (spellMaker.js blankEffectSettings).
const d = (durationBase, durationMod, durationPerLevel) => ({ durationBase, durationMod, durationPerLevel });
const c = (chanceBase, chanceMod, chancePerLevel) => ({ chanceBase, chanceMod, chancePerLevel });
const m = (magnitudeBaseLow, magnitudeBaseHigh, magnitudeLevelBase, magnitudeLevelHigh, magnitudePerLevel) =>
  ({ magnitudeBaseLow, magnitudeBaseHigh, magnitudeLevelBase, magnitudeLevelHigh, magnitudePerLevel });
const slot = (type, subType, ...parts) => Object.freeze({ type, subType, settings: Object.freeze(Object.assign({}, ...parts)) });
const DAMAGE_HEALTH = (...p) => slot(4, 0, ...p);
const HEAL_HEALTH = (...p) => slot(10, 8, ...p);

/** The signature spells' indices: their own band, below RESURRECT1's -45001 and PARTY-MAP's -46001, under the ready-made
 *  ceiling (spellMaker.js READY_MADE_INDEX_CEILING - a made spell is never minted or seeded there). PERSISTED DATA: a
 *  bought copy carries its index, so the band never moves (pinned literal, -46101..-46115). */
export const SIGNATURE_INDEX_BASE = -46100;

/** SPEC-RESET (bible/10-UI/Growth.md section 10): the gold that gives up one family's path - an arcane one or a martial
 *  one (systems/specReset.js pays it). Its home is here, where the Worker-bundled laws' choice boxes can name it:
 *  specReset.js reaches court.js, which the Worker must never bundle. */
export const SPEC_RESET_GOLD = 200000;

/**
 * THE NUMBERS every passive and rider names - the design page's table, section 5. A share is a fraction, a `pct` a
 * percent, `seconds` real seconds, `rounds` magic rounds (a classic minute: five real seconds online).
 */
export const PATH_NUMBERS = Object.freeze({
  spellsteel: Object.freeze({ pct: 15 }),
  slipAway: Object.freeze({ below: 1 / 3, rounds: 5, recover: 120 }),
  betweenMoments: Object.freeze({ pct: 20 }),
  steadfast: Object.freeze({ pct: 1 }),
  attunedWards: Object.freeze({ pct: 20 }),
  unseenStrike: Object.freeze({ pct: 25 }),
  sunder: Object.freeze({ points: 10 }),
  sanguine: Object.freeze({ perMissing: 2, most: 25 }),
  conflux: Object.freeze({ pct: 3, stacks: 5, seconds: 10 }),
  foresight: Object.freeze({ oneIn: 8 }),
  dawnsWard: Object.freeze({ pct: 20 }),
  glamour: Object.freeze({ personality: 10, etiquette: 15, streetwise: 15 }),
  deathsDue: Object.freeze({ health: 5, magicka: 5 }),
  soulWell: Object.freeze({ magicka: 10, trapped: 20 }),
  absolution: Object.freeze({ below: 0.3, heal: 25, recover: 180 }),
  // the riders
  aegisBolt: Object.freeze({ times: 2, most: 20, rounds: 8 }),
  fleetingHold: Object.freeze({ rounds: 6 }),
  riftLance: Object.freeze({ metres: 4, share: 1 / 3 }),
  livingAegis: Object.freeze({ seconds: 30, lighter: 20 }),
  prismaticWard: Object.freeze({ seconds: 30, chance: 40 }),
  shadowBolt: Object.freeze({ rounds: 3 }),
  unravel: Object.freeze({ back: 1 / 3 }),
  bloodBoil: Object.freeze({ below: 0.3 }),
  chainLightning: Object.freeze({ metres: 8, foes: 2, share: 1 / 2 }),
  psychicLance: Object.freeze({ seconds: 12, points: 20 }),
  dawnbolt: Object.freeze({ heal: 1 / 5, burn: 1 / 2 }),
  siphonLife: Object.freeze({ share: 1 / 2 }),
  soulLance: Object.freeze({ share: 1 / 4 }),
  sanctify: Object.freeze({ chance: 30, rounds: 6 }),
});
const N = PATH_NUMBERS;
const pc = (x) => Math.round(x * 100);   // a share, as the percent the words print

// THE SIGNATURE SPELLS' NAMES IN ENGLISH - each one home, read by its words' t() below and minted into the record
// (AUDIT SCHOOLS L4 4): a record's name is its canonical one, as a SPELLS.STD record's is, and the spellbook, the HUD and
// the quickslots show it in the player's language through loot.js shownSpellName - minted in the buyer's language, a
// Russian or Korean name crossed the wire's printable-ASCII label as nothing, and a language switch left a book naming a
// spell the shelf named otherwise.
const AEGIS_BOLT = 'Aegis Bolt';
const FLEETING_HOLD = 'Fleeting Hold';
const RIFT_LANCE = 'Rift Lance';
const LIVING_AEGIS = 'Living Aegis';
const PRISMATIC_WARD = 'Prismatic Ward';
const SHADOW_BOLT = 'Shadow Bolt';
const UNRAVEL = 'Unravel';
const BLOOD_BOIL = 'Blood Boil';
const CHAIN_LIGHTNING = 'Chain Lightning';
const PSYCHIC_LANCE = 'Psychic Lance';
const DAWNBOLT = 'Dawnbolt';
const BEGUILE = 'Beguile';
const SIPHON_LIFE = 'Siphon Life';
const SOUL_LANCE = 'Soul Lance';
const SANCTIFY = 'Sanctify';

/** THE WORDS a player reads for each path, through the text core - read when they are read (never at module load). */
const WORDS = Object.freeze({
  battlemage: () => ({
    name: t('schools.battlemage.name', 'Battlemage'),
    spell: t('schools.battlemage.spell', AEGIS_BOLT),
    passiveName: t('schools.battlemage.passive', 'Spellsteel'),
    passive: t('schools.battlemage.passiveText', 'While your Shield holds, your damage spells deal {pct}% more damage.', { pct: N.spellsteel.pct }),
    rider: t('schools.battlemage.rider', 'Gives you a Shield worth {times} times the damage dealt (up to {most}% of your health) for {rounds} rounds.', { times: N.aegisBolt.times, most: N.aegisBolt.most, rounds: N.aegisBolt.rounds }),
  }),
  trickster: () => ({
    name: t('schools.trickster.name', 'Trickster'),
    spell: t('schools.trickster.spell', FLEETING_HOLD),
    passiveName: t('schools.trickster.passive', 'Slip Away'),
    passive: t('schools.trickster.passiveText', 'When damage drops you below {pct}% health, you turn invisible for {rounds} rounds. This can happen once every {minutes} minutes.', { pct: pc(N.slipAway.below), rounds: N.slipAway.rounds, minutes: N.slipAway.recover / 60 }),
    rider: t('schools.trickster.rider', 'If it takes hold, you gain Chameleon for {rounds} rounds.', { rounds: N.fleetingHold.rounds }),
  }),
  riftwalker: () => ({
    name: t('schools.riftwalker.name', 'Riftwalker'),
    spell: t('schools.riftwalker.spell', RIFT_LANCE),
    passiveName: t('schools.riftwalker.passive', 'Between Moments'),
    passive: t('schools.riftwalker.passiveText', 'You cast spells {pct}% faster.', { pct: N.betweenMoments.pct }),
    rider: t('schools.riftwalker.rider', 'Other enemies within {metres} meters of the target take {pct}% of the damage.', { metres: N.riftLance.metres, pct: pc(N.riftLance.share) }),
  }),
  warden: () => ({
    name: t('schools.warden.name', 'Warden'),
    spell: t('schools.warden.spell', LIVING_AEGIS),
    passiveName: t('schools.warden.passive', 'Steadfast'),
    passive: t('schools.warden.passiveText', 'While your Shield holds, you regain {pct}% of your health each round.', { pct: N.steadfast.pct }),
    rider: t('schools.warden.rider', 'For {seconds} seconds, enemy blows deal {pct}% less damage to you.', { seconds: N.livingAegis.seconds, pct: N.livingAegis.lighter }),
  }),
  wardwright: () => ({
    name: t('schools.wardwright.name', 'Wardwright'),
    spell: t('schools.wardwright.spell', PRISMATIC_WARD),
    passiveName: t('schools.wardwright.passive', 'Attuned Wards'),
    passive: t('schools.wardwright.passiveText', 'Your Alteration and Thaumaturgy spells cost {pct}% less magicka.', { pct: N.attunedWards.pct }),
    rider: t('schools.wardwright.rider', 'For {seconds} seconds, each Destruction spell that hits you has a {pct}% chance to be absorbed, if you have room for the magicka.', { seconds: N.prismaticWard.seconds, pct: N.prismaticWard.chance }),
  }),
  shadowcaster: () => ({
    name: t('schools.shadowcaster.name', 'Shadowcaster'),
    spell: t('schools.shadowcaster.spell', SHADOW_BOLT),
    passiveName: t('schools.shadowcaster.passive', 'Unseen Strike'),
    passive: t('schools.shadowcaster.passiveText', 'While you have Invisibility, Chameleon or Shadow, your damage spells deal {pct}% more damage.', { pct: N.unseenStrike.pct }),
    rider: t('schools.shadowcaster.rider', 'On a hit, you gain Shadow for {rounds} rounds.', { rounds: N.shadowBolt.rounds }),
  }),
  spellbreaker: () => ({
    name: t('schools.spellbreaker.name', 'Spellbreaker'),
    spell: t('schools.spellbreaker.spell', UNRAVEL),
    passiveName: t('schools.spellbreaker.passive', 'Sunder'),
    passive: t('schools.spellbreaker.passiveText', 'Enemies\' saving throws against your damage spells are {points} lower.', { points: N.sunder.points }),
    rider: t('schools.spellbreaker.rider', 'On a hit, refunds {pct}% of its magicka cost.', { pct: pc(N.unravel.back) }),
  }),
  bloodmage: () => ({
    name: t('schools.bloodmage.name', 'Bloodmage'),
    spell: t('schools.bloodmage.spell', BLOOD_BOIL),
    passiveName: t('schools.bloodmage.passive', 'Sanguine Tide'),
    passive: t('schools.bloodmage.passiveText', 'Your damage spells deal 1% more damage for every {per}% of health you are missing, up to {most}%.', { per: N.sanguine.perMissing, most: N.sanguine.most }),
    rider: t('schools.bloodmage.rider', 'If the target is below {pct}% health after the hit, it takes the same damage again.', { pct: pc(N.bloodBoil.below) }),
  }),
  elementalist: () => ({
    name: t('schools.elementalist.name', 'Elementalist'),
    spell: t('schools.elementalist.spell', CHAIN_LIGHTNING),
    passiveName: t('schools.elementalist.passive', 'Conflux'),
    passive: t('schools.elementalist.passiveText', 'Each of your damage spells that hits adds {pct}% to your spell damage for {seconds} seconds, building up to {stacks} times.', { seconds: N.conflux.seconds, pct: N.conflux.pct, stacks: N.conflux.stacks }),
    rider: t('schools.elementalist.rider', 'Jumps to up to {foes} other enemies within {metres} meters, dealing {pct}% of the damage.', { foes: N.chainLightning.foes, metres: N.chainLightning.metres, pct: pc(N.chainLightning.share) }),
  }),
  seer: () => ({
    name: t('schools.seer.name', 'Seer'),
    spell: t('schools.seer.spell', PSYCHIC_LANCE),
    passiveName: t('schools.seer.passive', 'Foresight'),
    passive: t('schools.seer.passiveText', 'One enemy blow in {n} misses you.', { n: N.foresight.oneIn }),
    rider: t('schools.seer.rider', 'For {seconds} seconds, the target\'s saving throws against your damage spells are {points} lower.', { seconds: N.psychicLance.seconds, points: N.psychicLance.points }),
  }),
  lightbringer: () => ({
    name: t('schools.lightbringer.name', 'Lightbringer'),
    spell: t('schools.lightbringer.spell', DAWNBOLT),
    passiveName: t('schools.lightbringer.passive', 'Dawn\'s Ward'),
    passive: t('schools.lightbringer.passiveText', 'Your damage spells deal {pct}% more damage to undead and daedra.', { pct: N.dawnsWard.pct }),
    rider: t('schools.lightbringer.rider', 'Heals you for {heal}% of the damage dealt. Undead and daedra take an extra {burn}% of the damage.', { heal: pc(N.dawnbolt.heal), burn: pc(N.dawnbolt.burn) }),
  }),
  enchanter: () => ({
    name: t('schools.enchanter.name', 'Enchanter'),
    spell: t('schools.enchanter.spell', BEGUILE),
    passiveName: t('schools.enchanter.passive', 'Glamour'),
    passive: t('schools.enchanter.passiveText', '+{personality} Personality, +{etiquette} Etiquette and +{streetwise} Streetwise.', { personality: N.glamour.personality, etiquette: N.glamour.etiquette, streetwise: N.glamour.streetwise }),
    rider: t('schools.enchanter.rider', 'If it calms the target, its magicka cost is refunded.'),
  }),
  necromancer: () => ({
    name: t('schools.necromancer.name', 'Necromancer'),
    spell: t('schools.necromancer.spell', SIPHON_LIFE),
    passiveName: t('schools.necromancer.passive', 'Death\'s Due'),
    passive: t('schools.necromancer.passiveText', 'Each kill restores {health}% of your health and {magicka}% of your magicka.', { health: N.deathsDue.health, magicka: N.deathsDue.magicka }),
    rider: t('schools.necromancer.rider', 'Heals you for {pct}% of the damage dealt.', { pct: pc(N.siphonLife.share) }),
  }),
  soulbinder: () => ({
    name: t('schools.soulbinder.name', 'Soulbinder'),
    spell: t('schools.soulbinder.spell', SOUL_LANCE),
    passiveName: t('schools.soulbinder.passive', 'Soul Well'),
    passive: t('schools.soulbinder.passiveText', 'Each kill restores {pct}% of your magicka ({trapped}% if your Soul Trap was on the target).', { pct: N.soulWell.magicka, trapped: N.soulWell.trapped }),
    rider: t('schools.soulbinder.rider', 'Restores magicka equal to {pct}% of the damage dealt.', { pct: pc(N.soulLance.share) }),
  }),
  hierophant: () => ({
    name: t('schools.hierophant.name', 'Hierophant'),
    spell: t('schools.hierophant.spell', SANCTIFY),
    passiveName: t('schools.hierophant.passive', 'Absolution'),
    passive: t('schools.hierophant.passiveText', 'When damage drops you below {below}% health, you heal {pct}% of your health. This can happen once every {minutes} minutes.', { below: pc(N.absolution.below), pct: N.absolution.heal, minutes: N.absolution.recover / 60 }),
    rider: t('schools.hierophant.rider', 'Gives you {pct}% Spell Resistance for {rounds} rounds.', { pct: N.sanctify.chance, rounds: N.sanctify.rounds }),
  }),
});
/** The signature spell's English name, by path - the record's canonical name. */
const SPELL_EN = Object.freeze({ battlemage: AEGIS_BOLT, trickster: FLEETING_HOLD, riftwalker: RIFT_LANCE, warden: LIVING_AEGIS, wardwright: PRISMATIC_WARD, shadowcaster: SHADOW_BOLT, spellbreaker: UNRAVEL, bloodmage: BLOOD_BOIL, elementalist: CHAIN_LIGHTNING, seer: PSYCHIC_LANCE, lightbringer: DAWNBOLT, enchanter: BEGUILE, necromancer: SIPHON_LIFE, soulbinder: SOUL_LANCE, hierophant: SANCTIFY });
/** A path's words now: { name, spell, passiveName, passive, rider } - in the player's language. */
export const pathWords = (id) => WORDS[id]?.() ?? null;

/**
 * THE FIFTEEN, one per pair of the six schools - the design page's table, section 5. `spell` is the signature record's
 * data; `name`, `spell.name`, `passive` and `rider` are read through pathWords as they are read.
 */
/** @type {Array<[string, number[], [number, number, number, number, ReadonlyArray<any>]]>} */
const PATH_ROWS = [
  ['battlemage', [ALT, DES], [1, 23, SHOCK, AT_RANGE, [DAMAGE_HEALTH(m(10, 18, 2, 3, 1))]]],
  ['trickster', [ALT, ILL], [2, 30, MAGIC, AT_RANGE, [slot(0, 255, d(2, 1, 4), c(35, 2, 2))]]],
  ['riftwalker', [ALT, MYS], [3, 47, MAGIC, AT_RANGE, [DAMAGE_HEALTH(m(8, 16, 2, 3, 1))]]],
  ['warden', [ALT, RES], [4, 36, MAGIC, SELF, [slot(35, 255, d(8, 1, 2), m(10, 20, 2, 3, 1)), HEAL_HEALTH(m(8, 14, 1, 2, 1))]]],
  ['wardwright', [ALT, THA], [5, 12, MAGIC, SELF, [slot(8, 0, d(10, 2, 2), c(25, 2, 2)), slot(8, 1, d(10, 2, 2), c(25, 2, 2)), slot(8, 3, d(10, 2, 2), c(25, 2, 2))]]],
  ['shadowcaster', [DES, ILL], [6, 52, MAGIC, AT_RANGE, [DAMAGE_HEALTH(m(8, 16, 2, 3, 1))]]],
  ['spellbreaker', [DES, MYS], [7, 41, MAGIC, AT_RANGE, [DAMAGE_HEALTH(m(8, 14, 2, 3, 1)), slot(19, 255, d(3, 1, 4), c(30, 2, 2))]]],
  ['bloodmage', [DES, RES], [8, 3, FIRE, AT_RANGE, [DAMAGE_HEALTH(m(10, 18, 2, 3, 1))]]],
  ['elementalist', [DES, THA], [9, 25, SHOCK, AT_RANGE, [DAMAGE_HEALTH(m(10, 18, 2, 3, 1))]]],
  ['seer', [ILL, MYS], [10, 44, MAGIC, AT_RANGE, [DAMAGE_HEALTH(m(8, 14, 2, 3, 1))]]],
  ['lightbringer', [ILL, RES], [11, 18, MAGIC, AT_RANGE, [DAMAGE_HEALTH(m(8, 16, 2, 3, 1))]]],
  ['enchanter', [ILL, THA], [12, 33, MAGIC, AT_RANGE, [slot(33, 2, c(30, 2, 2)), slot(34, 255, c(30, 2, 2))]]],
  ['necromancer', [RES, MYS], [13, 57, MAGIC, AT_RANGE, [DAMAGE_HEALTH(m(8, 16, 2, 3, 1))]]],
  ['soulbinder', [MYS, THA], [14, 62, MAGIC, AT_RANGE, [slot(12, 255, d(6, 1, 2), c(40, 2, 2)), DAMAGE_HEALTH(m(6, 12, 2, 3, 1))]]],
  ['hierophant', [RES, THA], [15, 9, MAGIC, SELF, [HEAL_HEALTH(m(12, 20, 2, 4, 1)), slot(3, 1, c(100, 1, 20)), slot(3, 0, c(100, 1, 20))]]],
];
export const PATHS = Object.freeze(PATH_ROWS.map(([id, schools, [n, icon, element, rangeType, slots]]) => Object.freeze({
  id, schools: Object.freeze([...schools]),
  spell: Object.freeze({ get name() { return pathWords(id).spell; }, nameEn: SPELL_EN[id], index: SIGNATURE_INDEX_BASE - n, icon, element, rangeType, slots: Object.freeze([...slots]) }),
  get name() { return pathWords(id).name; },
  get passive() { const w = pathWords(id); return { name: w.passiveName, text: w.passive }; },
  get rider() { return pathWords(id).rider; },
})));

/** Path id -> its record. */
export const PATH_BY_ID = Object.freeze(Object.fromEntries(PATHS.map((p) => [p.id, p])));
export const isPathId = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(PATH_BY_ID, id);
const pairKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
const PATH_BY_PAIR = new Map(PATHS.map((p) => [pairKey(p.schools[0], p.schools[1]), p]));
/** The path two schools name, or null. */
export const pathOfPair = (a, b) => (a !== b ? PATH_BY_PAIR.get(pairKey(a, b)) ?? null : null);
/** The path a signature spell's index names, or null. */
export const pathOfSignatureIndex = (index) => PATHS.find((p) => p.spell.index === index) ?? null;
/** Is this record a signature spell (the path it carries is a path's, and the index is that path's own)? */
export const isSignatureSpell = (sp) => !!sp && isPathId(sp.path) && sp.index === PATH_BY_ID[sp.path].spell.index;

/** A path's two schools, by DFU's own skill names (in the player's language). */
const schoolsOf = (p) => ({ a: SKILL_NAMES[p.schools[0]], b: SKILL_NAMES[p.schools[1]] });
/** A path's two schools as one line ("Restoration and Mysticism"). */
export const pathSchoolsText = (p) => t('schools.choice.schools', '{a} and {b}', schoolsOf(p));
/** AUDIT SCHOOLS L4 8: can this character EVER meet a path - two of the six schools mastered, or masterable in the slots
 *  its career groups have left (masterSkills.js masterableCount - AUDIT MARTIAL L4 L3: two schools both minor skills, one
 *  minor slot between them, showed the card for good)? */
export const pathPossible = (entity) => masterableCount(entity, MAGIC_SKILLS) >= 2;

// ── the choice ──────────────────────────────────────────────────────

/** The six schools this entity has MASTERED, in MAGIC_SKILLS order.
 *  @returns {number[]} */
export const masteredSchools = (entity) => MAGIC_SKILLS.filter((id) => masteredSkills(entity).includes(id));
/** The path this entity chose, or null. */
export const pathOf = (entity) => (isPathId(entity?.arcanePath) ? PATH_BY_ID[entity.arcanePath] : null);

/** The paths this entity may choose NOW, in PATHS order: Master Skills in force, no path yet, both schools mastered. */
export function pathChoices(entity) {
  if (!entity || pathOf(entity) || !masterSkillsActive(entity)) return [];
  const have = masteredSchools(entity);
  return PATHS.filter((p) => have.includes(p.schools[0]) && have.includes(p.schools[1]));
}

/** Why this path cannot be chosen now, or null when it can. */
export function pathRefusal(entity, id) {
  if (!isPathId(id)) return t('schools.refuse.none', 'No such specialization.');
  if (pathOf(entity)) return t('schools.refuse.already', 'Your specialization is already chosen: {name}.', { name: pathOf(entity).name });
  if (!masterSkillsActive(entity)) return t('schools.refuse.off', 'Master Skills is off.');
  const p = PATH_BY_ID[id];
  if (!p.schools.every((s) => isMasteredSkill(entity, s))) return t('schools.refuse.schools', 'Master {a} and {b} first.', schoolsOf(p));
  return null;
}

/** Choose it - for good, short of the paid reset (specReset.js). Returns { ok, text }. */
export function choosePath(entity, id) {
  const why = pathRefusal(entity, id);
  if (why) return { ok: false, text: why };
  entity.arcanePath = id;
  const p = PATH_BY_ID[id];
  // AUDIT MARTIAL L4 M1: one short line - the classic sheet's notice and the HUD draw it unwrapped in 312 px (with the
  // spell's sentence it ran past the screen in English and every Latin language); where it is sold is the card's and the
  // OK box's (schools.sheet.sold)
  return { ok: true, text: t('schools.chosen', 'Specialization chosen: {name}.', { name: p.name }) };
}

export const PATH_DECLINED_TEXT = 'You can choose a specialization later in your skill screen.';
/** The No's line, in the player's language. */
export const pathDeclinedText = () => t('schools.declined', PATH_DECLINED_TEXT);
/** GROWTH4 (bible/10-UI/Growth.md section 7): the No's line where the enhanced pause window stands - its Growth tab is
 *  where every path is read and chosen (the classic skin's stays the skill screen's: its S row opens the same guide). */
export const PATH_DECLINED_GROWTH_TEXT = 'You can choose a specialization later on the Growth tab of the pause menu.';
export const pathDeclinedGrowthText = () => t('schools.declinedGrowth', PATH_DECLINED_GROWTH_TEXT);

/** The first path the game still owes an ASK (asked once a character; the skill screen keeps the rest), or null. */
export const nextPathChoice = (entity) => (entity?.pathPrompted ? null : pathChoices(entity)[0] ?? null);

/** What a path does, in two rows: its passive, then its signature spell and the spell's rider. */
export const pathPowerRows = (p) => [
  t('schools.row.passive', '{name}: {text}', { name: p.passive.name, text: p.passive.text }),
  t('schools.row.spell', '{spell} (signature spell): {text}', { spell: p.spell.name, text: p.rider }),
];

/** The choice box's rows - short enough for Daggerfall's parchment box (a long row wraps) as for the enhanced card.
 *  `others` false leaves out the count of the other open paths (the classic sheet says its own). */
export function pathChoiceRows(entity, id, { others = true } = {}) {
  const p = PATH_BY_ID[id];
  if (!p) return [];
  const more = others ? pathChoices(entity).length - 1 : 0;
  return [
    t('schools.choice.title', 'Specialize as {name}?', { name: p.name }),
    pathSchoolsText(p),
    '',
    ...pathPowerRows(p),
    '',
    t('schools.choice.reset', 'Resetting it later costs {gold, number} gold.', { gold: SPEC_RESET_GOLD }),
    ...(more > 0 ? [t('schools.choice.others', '{n, plural, one {# other specialization is open to you.} other {# other specializations are open to you.}}', { n: more })] : []),
  ];
}

/** AUDIT SCHOOLS L4 M1: the one ask when SEVERAL paths are open - their names, and where each is chosen (GROWTH4:
 *  `growth` - the enhanced pause window's Growth tab, else the skill screen). */
export function pathsOpenRows(open, { growth = false } = {}) {
  return [
    t('schools.open.title', 'Specialization'),
    '',
    t('schools.open.count', '{n, plural, one {# specialization is open to you:} other {# specializations are open to you:}}', { n: open.length }),
    open.map((p) => p.name).join(', '),
    '',
    growth ? t('schools.open.whereGrowth', 'See them all and choose one on the Growth tab of the pause menu.')
      : t('schools.open.where', 'Choose one in your skill screen.'),
    // AUDIT SPEC-RESET L4-5: the price a row of its own - in the classic parchment box (288 px) one sentence more wrapped
    // a lone word onto a line of its own in six languages
    t('schools.choice.reset', 'Resetting it later costs {gold, number} gold.', { gold: SPEC_RESET_GOLD }),
  ];
}

/** What a chosen path is, in rows (the sheets' description). */
export function pathAboutRows(p) {
  if (!p) return [];
  return [t('schools.about.title', '{name} - {a} and {b}', { name: p.name, ...schoolsOf(p) }), '', ...pathPowerRows(p)];
}

// ── awake ───────────────────────────────────────────────────────────

/** Does the path ACT for this entity now? My own player entity (never a peer's stand-in), Master Skills in force, both
 *  its schools mastered, not mentoring. Answers the path, or null. (A refereed fight is the powers' word to add -
 *  systems/arcanePowers.js; the price reads none, and a duel's opponent takes the plain bundle whatever it cost.) */
export function pathAwake(entity) {
  return entity?._mentor ? null : pathHeld(entity);
}
/** The path this entity HOLDS now, mentoring or not - my own player entity, Master Skills in force, both its schools
 *  mastered. What a signature spell is cast in and the shelf read (AUDIT SCHOOLS L2 F5: through pathAwake, a mentored
 *  Necromancer's Siphon Life priced and trained as the Destruction they never chose - 9 magicka became 105 on joining a
 *  lower party); mentoring's own law lowers the schools' values (skillValue) and their climb (schoolPotency). */
export function pathHeld(entity) {
  if (!entity?.isPlayer || entity.peer) return null;
  const p = pathOf(entity);
  if (!p || !masterSkillsActive(entity) || !p.schools.every((s) => isMasteredSkill(entity, s))) return null;
  return p;
}

/** THE SCHOOL AN EFFECT OF THIS SPELL IS CAST IN, for its caster: the effect's own school, except in MY signature spell
 *  of MY awake path, where an effect outside the pair is cast in the stronger of the pair (the permanent value; a tie
 *  the path's first). The price, the tally and the school past 100 all read it. */
export function pathCastSchool(entity, spell, school) {
  if (!spell || !isSignatureSpell(spell)) return school;
  const p = pathHeld(entity);
  if (!p || p.id !== spell.path) return school;
  if (p.schools.includes(school)) return school;
  const [a, b] = p.schools;
  const v = (id) => (Array.isArray(entity.skills) && Number.isFinite(entity.skills[id]) ? entity.skills[id] : 0);
  return v(b) > v(a) ? b : a;
}

// ── the judge ───────────────────────────────────────────────────────

/** SCHOOLS5: the judge's word on a SAVE's path - [] when lawful, else `{ code: 'path', at }` findings: a path no table
 *  holds, or a path whose schools are not both mastered - what GRANTS a path's powers. A signature spell is NOT judged
 *  (AUDIT SCHOOLS L3 F2): one without its awake path is the plain bundle the spell maker could make (no rider, its own
 *  schools - arcanePaths.js pathCastSchool, arcanePowers.js), so flagging it protected nothing, and it froze the trade of
 *  an honest player whose save an older build had carried (that build kept the spell whole and dropped `arcanePath`).
 *  A save with no path is lawful whatever else it holds. */
export function pathFindings(save) {
  const out = [];
  if (!save || typeof save !== 'object') return out;
  const raw = save.arcanePath;
  if (raw == null) return out;
  if (!isPathId(raw)) return [{ code: 'path', at: 'id' }];
  // both schools mastered - a mastery is only ever made at 100 (masterSkills.js masteryRefusal), and the judge reads no
  // skill's value here: a value can be lowered after its mastery, and a mastery is never undone
  const mastered = Array.isArray(save.masteredSkills) ? save.masteredSkills : [];
  if (!PATH_BY_ID[raw].schools.every((s) => mastered.includes(s))) out.push({ code: 'path', at: 'schools' });
  return out;
}

/** AUDIT SCHOOLS L3 F2: THE PATH A BOOK BEARS WITNESS TO - a save an older build carried keeps its signature spell whole
 *  (made spells are saved as records) and drops `arcanePath`, which a permanent choice must not lose. The book's
 *  signature spells name ONE path, both its schools mastered: that path; anything else (none, two paths' spells, a school
 *  unmastered): null. Only the shelf sells a signature spell, and only to its own path's holder. */
export function pathWitnessed(spells, masteredSkills) {
  const ids = new Set((Array.isArray(spells) ? spells : []).filter(isSignatureSpell).map((sp) => sp.path));
  if (ids.size !== 1) return null;
  const id = [...ids][0];
  const mastered = Array.isArray(masteredSkills) ? masteredSkills : [];
  return PATH_BY_ID[id].schools.every((s) => mastered.includes(s)) ? id : null;
}
