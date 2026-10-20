// @ts-check
// MARTIAL (2026-10-17) - MARTIAL SPECIALISATIONS: A FIGHTER IS THE WEAPONS THEY MASTER. bible/05-Combat/Martial-Specialisations.md
//
// The owner: "we've properly balanced mages, added a specialization tree and added the firmament system. I want to do the
// same for other weapon types/classes." Asked, the owner chose: the six weapon skills (Long Blade, Short Blade, Axe, Blunt
// Weapon, Archery, Hand-to-Hand) make the fifteen pairs, as the six schools do (SCHOOLS, systems/arcanePaths.js); a path's
// signature is a TECHNIQUE on the Weapon Technique key, answering whenever the weapon in hand is one of its pair's and
// carries no technique line of its own; one character may hold an arcane path and a martial path together; and every
// weapon skill pays past 100 in its own way (MARTIAL2, systems/weaponMastery.js).
//
// THE LAW, and nothing that acts - a leaf the runner (combat/techniques.js), the save, the sheets and the powers (systems/martialPowers.js) all read, so none of them grows a cycle:
//   - the fifteen PATHS, one for each pair of the six weapon skills, and the words a player reads (`martialWords`, through
//     the text core);
//   - every NUMBER a path's passive and rider names (`MARTIAL_NUMBERS`) - the one home the words print and
//     martialPowers.js does, so a balance pass moves one number;
//   - THE SIGNATURE TECHNIQUES (`SIGNATURE_TECHNIQUES`): the roster's own shape (combat/technique/techniqueRoster.js
//     TECHNIQUES - a mechanic the runner already performs, its multiplier on DFU's own CalculateAttackDamage, its
//     fatigue and its cooldown), a FORM a family: a pair with Archery has a bow's form and a blade's (or a fist's), and
//     the two share one cooldown. Never a loot line: they stand outside the roster, so no ladder draws one and the item
//     law reads no line naming one (systems/item/itemLaw.js, systems/loot/lootRarity.js validAffix);
//   - WHO may choose (`martialChoices`: Master Skills in force, two or more weapon skills mastered, no martial path yet)
//     and the choice (`chooseMartialPath`: undone only by SPEC-RESET's paid reset, systems/specReset.js - nothing
//     here undoes it);
//   - when a path ACTS (`martialAwake`: my own entity, Master Skills in force, both its skills mastered, not mentoring -
//     and the powers add the refereed fight's word, sigil.js sigilDueling, the one every loot and set power sleeps on).
// No judge's finding (the design page, section 7): a path acts only with both its masteries held, read here at every
// ask, and the account service's judge reads no mastery - a finding would add a version and stop nothing.
//
// An arcane path and a martial path are two choices (the owner: "Yes, one of each") - neither reads the other, and the
// masteries they need come from the one 2 / 2 / 1 (masterSkills.js MASTERY_SLOTS).
//
// Everything a player reads is `t()`, read when it is read.

import { SKILLS, SKILL_NAMES } from './skills.js';
import { masterSkillsActive, isMasteredSkill, masteredSkills, masterableCount } from './masterSkills.js';
import { t, textRevision } from './textManager.js';
import { SPEC_RESET_GOLD } from './arcanePaths.js';   // SPEC-RESET: one price for either family's reset

const { LongBlade: LB, ShortBlade: SB, Axe: AX, BluntWeapon: BL, Archery: AR, HandToHand: HH } = SKILLS;

/** The six weapon skills, in the order the paths are tabled. */
export const MARTIAL_SKILLS = Object.freeze([LB, SB, AX, BL, AR, HH]);
/** A weapon skill's technique FAMILY - combat/technique/techniqueRoster.js TECHNIQUE_FAMILIES' words (pinned equal; that
 *  leaf reads the item tables, and this one must not). The Thunderlock is scored on Archery but is a gun: no path's. */
export const MARTIAL_FAMILY = Object.freeze({ [LB]: 'longBlade', [SB]: 'shortBlade', [AX]: 'axe', [BL]: 'blunt', [AR]: 'archery', [HH]: 'handToHand' });

/**
 * THE NUMBERS every passive and rider names - the design page's table, section 5. A `pct` is a percent, `seconds` real
 * seconds, `rounds` magic rounds (a classic minute: five real seconds online), `below` a share of the health.
 */
export const MARTIAL_NUMBERS = Object.freeze({
  // the passives
  flowingSteel: Object.freeze({ pct: 3, stacks: 5, seconds: 4 }),
  warRhythm: Object.freeze({ pct: 15, seconds: 10 }),
  ironDiscipline: Object.freeze({ lighter: 10 }),
  huntersInstinct: Object.freeze({ pct: 20 }),
  dancersStep: Object.freeze({ oneIn: 10 }),
  bloodlust: Object.freeze({ health: 5 }),
  cheapShot: Object.freeze({ pct: 25 }),
  openingStrike: Object.freeze({ pct: 30 }),
  lightStep: Object.freeze({ agility: 10, dodging: 15 }),
  standFirm: Object.freeze({ below: 0.3, heal: 20, recover: 180 }),
  tireless: Object.freeze({ fatigue: 15 }),
  frenzy: Object.freeze({ below: 0.5, pct: 20, pace: 10 }),
  purge: Object.freeze({ pct: 20 }),
  grit: Object.freeze({ health: 1, fatigue: 2 }),
  windborne: Object.freeze({ speed: 10, running: 15, jumping: 15 }),
  // the riders
  thousandCuts: Object.freeze({ share: 1 / 2 }),
  rallyingCleave: Object.freeze({ pct: 15, seconds: 8 }),
  judgement: Object.freeze({ heal: 4, foes: 3 }),
  huntersMark: Object.freeze({ pct: 20, seconds: 12 }),
  cyclone: Object.freeze({ pace: 20, seconds: 6 }),
  guttingLunge: Object.freeze({ below: 0.25 }),
  blackjack: Object.freeze({ times: 2 }),
  vanishingStrike: Object.freeze({ rounds: 4 }),
  phantomStrike: Object.freeze({ oneIn: 3, seconds: 6 }),
  earthsplitter: Object.freeze({ lighter: 25, seconds: 10 }),
  fellingStrike: Object.freeze({ heal: 10 }),
  savageWhirl: Object.freeze({ leech: 10, seconds: 8 }),
  hallowedStrike: Object.freeze({ share: 1 / 2 }),
  knockout: Object.freeze({ lighter: 30, seconds: 8 }),
  windstrike: Object.freeze({ fatigue: 5, foes: 3 }),
});
const N = MARTIAL_NUMBERS;
const pc = (x) => Math.round(x * 100);   // a share, as the percent the words print

// ── the signature techniques ─────────────────────────────────────────
const DEG = Math.PI / 180;
/** A form: the roster's own fields (techniqueRoster.js header: the mechanic, its aim, `base` on the formula's damage,
 *  `fatigue` in the sheet's points, `cooldown` in seconds, and its mechanic's numbers), and the port's three - `path`, the
 *  path whose signature it is; `families`, the weapons in hand it answers; `fx`, the roster technique whose feel it wears
 *  (combat/technique/techniqueFx.js TECH_FX - a signature is a technique the hands already know, done its own way). */
const form = (path, families, fields) => Object.freeze({ path, families: Object.freeze([...families]), ...fields });
/** EVERY FORM, by id. PERSISTED: nothing - a cooldown is the session's - but an id is the runner's cooldown slot and the
 *  pins', so it never moves. */
const FORMS = {
  thousandCuts: form('blademaster', ['longBlade', 'shortBlade'], { mech: 'dash', aim: 'lane', base: 1.0, fatigue: 5, cooldown: 12,
    length: 5, halfW: 0.9, strike: 'StrikeDown', toHit: 15, fx: 'lunge' }),
  rallyingCleave: form('warblade', ['longBlade', 'axe'], { mech: 'swing', aim: null, base: 1.1, fatigue: 5, cooldown: 12,
    reach: 3.2, arc: 80 * DEG, strike: 'StrikeRight', toHit: 15, fx: 'cleave' }),
  judgement: form('vanguard', ['longBlade', 'blunt'], { mech: 'leap', aim: 'target', base: 1.3, fatigue: 6, cooldown: 14,
    range: Object.freeze([3, 8]), apex: 1.5, radius: 2.5, strike: 'StrikeDown', toHit: 20, fx: 'leap' }),
  huntersMark: form('ranger', ['archery'], { mech: 'pierce', aim: 'lane', base: 1.2, fatigue: 4, cooldown: 12,
    through: 3, length: 30, speed: 1.6, fx: 'pierce' }),
  huntersPounce: form('ranger', ['longBlade'], { mech: 'leap', aim: 'target', base: 1.3, fatigue: 5, cooldown: 12,
    range: Object.freeze([3, 8]), apex: 1.4, radius: 1.5, strike: 'StrikeDown', toHit: 20, fx: 'leap' }),
  cyclone: form('bladedancer', ['longBlade', 'handToHand'], { mech: 'swing', aim: null, base: 1.0, fatigue: 5, cooldown: 10,
    reach: 3.0, arc: 'all', strike: 'StrikeLeft', toHit: 15, fx: 'whirlwind' }),
  guttingLunge: form('bloodletter', ['shortBlade', 'axe'], { mech: 'dash', aim: 'lane', base: 1.2, fatigue: 5, cooldown: 11,
    length: 5, halfW: 0.9, strike: 'StrikeDown', toHit: 15, fx: 'lunge' }),
  blackjack: form('cutthroat', ['shortBlade', 'blunt'], { mech: 'swing', aim: null, base: 1.4, fatigue: 4, cooldown: 10,
    reach: 2.5, arc: 'view', single: true, strike: 'StrikeDown', toHit: 30, fx: 'crush' }),
  vanishingShot: form('assassin', ['archery'], { mech: 'pierce', aim: 'lane', base: 1.6, fatigue: 4, cooldown: 14,
    through: 1, length: 30, speed: 1.6, fx: 'pierce' }),
  vanishingStrike: form('assassin', ['shortBlade'], { mech: 'dash', aim: 'foe', base: 1.3, fatigue: 5, cooldown: 14,
    range: Object.freeze([2, 8]), behind: 1.0, reach: 2.2, arc: 'view', strike: 'StrikeRight', toHit: 20, fx: 'shadowstep' }),
  phantomStrike: form('shadowdancer', ['shortBlade', 'handToHand'], { mech: 'dash', aim: 'foe', base: 1.2, fatigue: 4, cooldown: 12,
    range: Object.freeze([2, 8]), behind: 1.0, reach: 2.2, arc: 'view', strike: 'StrikeRight', toHit: 20, fx: 'shadowstep' }),
  earthsplitter: form('juggernaut', ['axe', 'blunt'], { mech: 'swing', aim: null, base: 1.0, fatigue: 6, cooldown: 14,
    reach: 3.5, arc: 'all', strike: 'StrikeDown', toHit: 15, fx: 'slam' }),
  fellingVolley: form('woodsman', ['archery'], { mech: 'rain', aim: 'ground', base: 0.6, fatigue: 6, cooldown: 14,
    arrows: 5, radius: 3, range: Object.freeze([6, 28]), height: 16, delay: 0.55, spread: 1.2, fx: 'volley' }),
  fellingStrike: form('woodsman', ['axe'], { mech: 'leap', aim: 'target', base: 1.3, fatigue: 5, cooldown: 14,
    range: Object.freeze([3, 8]), apex: 1.5, radius: 2.0, strike: 'StrikeDown', toHit: 20, fx: 'leap' }),
  savageWhirl: form('berserker', ['axe', 'handToHand'], { mech: 'swing', aim: null, base: 1.2, fatigue: 6, cooldown: 14,
    reach: 3.0, arc: 'all', strike: 'StrikeLeft', toHit: 15, fx: 'whirlwind' }),
  hallowedShot: form('crusader', ['archery'], { mech: 'pierce', aim: 'lane', base: 1.2, fatigue: 4, cooldown: 12,
    through: 3, length: 30, speed: 1.6, fx: 'pierce' }),
  hallowedStrike: form('crusader', ['blunt'], { mech: 'swing', aim: null, base: 1.5, fatigue: 5, cooldown: 12,
    reach: 2.5, arc: 'view', single: true, strike: 'StrikeDown', toHit: 25, fx: 'crush' }),
  knockout: form('brawler', ['blunt', 'handToHand'], { mech: 'swing', aim: null, base: 1.6, fatigue: 5, cooldown: 11,
    reach: 2.5, arc: 'view', single: true, strike: 'StrikeRight', toHit: 30, fx: 'haymaker' }),
  windVolley: form('windrunner', ['archery'], { mech: 'rain', aim: 'ground', base: 0.5, fatigue: 6, cooldown: 16,
    arrows: 6, radius: 3.5, range: Object.freeze([6, 28]), height: 16, delay: 0.55, spread: 1.35, fx: 'volley' }),
  windKick: form('windrunner', ['handToHand'], { mech: 'leap', aim: 'target', base: 1.2, fatigue: 4, cooldown: 11,
    range: Object.freeze([2, 7]), apex: 1.2, radius: 2.0, strike: 'StrikeDown', toHit: 20, airborne: true, fx: 'kick' }),
};
// THE SIGNATURE TECHNIQUES' NAMES IN ENGLISH - each one home, read by its words' t() below (tools/l10nExtract.mjs reads a
// module constant's English) and said by the runner's English lines (combat/techniques.js: "X is not ready", as a loot
// technique's own name is said).
const THOUSAND_CUTS = 'Thousand Cuts';
const RALLYING_CLEAVE = 'Rallying Cleave';
const JUDGEMENT = 'Judgement';
const MARK_OF_THE_HUNT = 'Mark of the Hunt';
const CYCLONE = 'Cyclone';
const GUTTING_LUNGE = 'Gutting Lunge';
const BLACKJACK = 'Blackjack';
const VANISHING_STRIKE = 'Vanishing Strike';
const PHANTOM_STRIKE = 'Phantom Strike';
const EARTHSPLITTER = 'Earthsplitter';
const FELLING_STRIKE = 'Felling Strike';
const SAVAGE_WHIRL = 'Savage Whirl';
const HALLOWED_STRIKE = 'Hallowed Strike';
const KNOCKOUT = 'Knockout';
const WINDSTRIKE = 'Windstrike';
/** The signature's English name, by path - the words' default. */
const SIGNATURE_EN = Object.freeze({ blademaster: THOUSAND_CUTS, warblade: RALLYING_CLEAVE, vanguard: JUDGEMENT, ranger: MARK_OF_THE_HUNT, bladedancer: CYCLONE, bloodletter: GUTTING_LUNGE, cutthroat: BLACKJACK, assassin: VANISHING_STRIKE, shadowdancer: PHANTOM_STRIKE, juggernaut: EARTHSPLITTER, woodsman: FELLING_STRIKE, berserker: SAVAGE_WHIRL, crusader: HALLOWED_STRIKE, brawler: KNOCKOUT, windrunner: WINDSTRIKE });
/** AUDIT MARTIAL L1 L6: a signature's name in the player's language, kept a text revision (textManager.js textRevision -
 *  a locale switched, a table patched): the HUD's chip reads it every frame, and the path's words are six lines built
 *  whole (AUDIT TECH-FX's law - a frame at rest allocates nothing). */
let _names = { rev: -1, by: /** @type {Record<string, string>} */ (Object.create(null)) };
function signatureName(path) {
  const rev = textRevision();
  if (_names.rev !== rev) _names = { rev, by: Object.create(null) };
  return (_names.by[path] ??= martialWords(path)?.technique ?? SIGNATURE_EN[path]);
}
/** Every form, by id - each carries its `id`, `en` its path's signature's English name (what the runner's English status
 *  lines say - AUDIT MARTIAL L4 N1: "Mal der Jagd is not ready"), and `name`, the signature in the player's language. */
export const SIGNATURE_TECHNIQUES = Object.freeze(Object.fromEntries(Object.entries(FORMS).map(([id, f]) => [id, Object.freeze(Object.defineProperty({ ...f, id, en: SIGNATURE_EN[f.path] },
  'name', { get() { return signatureName(f.path); }, enumerable: true }))])));
/** The form ids, in the table's order. */
export const SIGNATURE_IDS = Object.freeze(Object.keys(SIGNATURE_TECHNIQUES));
/** A form by id, or null. */
export const signatureById = (id) => (typeof id === 'string' && Object.hasOwn(SIGNATURE_TECHNIQUES, id) ? SIGNATURE_TECHNIQUES[id] : null);
/** Is this technique id a signature's form? */
export const isSignatureTechnique = (id) => signatureById(id) != null;

/** THE WORDS a player reads for each path, through the text core - read when they are read (never at module load). */
const WORDS = Object.freeze({
  blademaster: () => ({
    name: t('martial.blademaster.name', 'Blademaster'),
    passiveName: t('martial.blademaster.passive', 'Flowing Steel'),
    passive: t('martial.blademaster.passiveText', 'Each of your blows or arrows that lands adds {pct}% to your damage for {seconds} seconds, building up to {stacks} times.', { seconds: N.flowingSteel.seconds, pct: N.flowingSteel.pct, stacks: N.flowingSteel.stacks }),
    technique: t('martial.blademaster.technique', THOUSAND_CUTS),
    techniqueText: t('martial.blademaster.techniqueText', 'Dash {metres} meters, hitting every enemy you pass.', { metres: FORMS.thousandCuts.length }),
    rider: t('martial.blademaster.rider', 'Each enemy it hits takes an extra {pct}% of the damage.', { pct: pc(N.thousandCuts.share) }),
  }),
  warblade: () => ({
    name: t('martial.warblade.name', 'Warblade'),
    passiveName: t('martial.warblade.passive', 'War Rhythm'),
    passive: t('martial.warblade.passiveText', 'Each kill makes you swing {pct}% faster for {seconds} seconds.', { pct: N.warRhythm.pct, seconds: N.warRhythm.seconds }),
    technique: t('martial.warblade.technique', RALLYING_CLEAVE),
    techniqueText: t('martial.warblade.techniqueText', 'Hit every enemy in a wide arc in front of you.'),
    rider: t('martial.warblade.rider', 'For {seconds} seconds, your blows and arrows deal {pct}% more damage.', { pct: N.rallyingCleave.pct, seconds: N.rallyingCleave.seconds }),
  }),
  vanguard: () => ({
    name: t('martial.vanguard.name', 'Vanguard'),
    passiveName: t('martial.vanguard.passive', 'Iron Discipline'),
    passive: t('martial.vanguard.passiveText', 'Enemy blows deal {pct}% less damage to you.', { pct: N.ironDiscipline.lighter }),
    technique: t('martial.vanguard.technique', JUDGEMENT),
    techniqueText: t('martial.vanguard.techniqueText', 'Leap up to {metres} meters onto an enemy and hit every enemy within {radius} meters of where you land.', { metres: FORMS.judgement.range[1], radius: FORMS.judgement.radius }),
    rider: t('martial.vanguard.rider', 'Each enemy it hits restores {pct}% of your health (up to {foes} enemies).', { pct: N.judgement.heal, foes: N.judgement.foes }),
  }),
  ranger: () => ({
    name: t('martial.ranger.name', 'Ranger'),
    passiveName: t('martial.ranger.passive', 'Hunter\'s Instinct'),
    passive: t('martial.ranger.passiveText', 'Your blows and arrows deal {pct}% more damage to beasts.', { pct: N.huntersInstinct.pct }),
    technique: t('martial.ranger.technique', MARK_OF_THE_HUNT),
    techniqueText: t('martial.ranger.techniqueText', 'Bow: a shot that passes through up to {through} enemies. Long blade: leap at an enemy up to {metres} meters away.', { through: FORMS.huntersMark.through, metres: FORMS.huntersPounce.range[1] }),
    rider: t('martial.ranger.rider', 'Each enemy it hits is marked for {seconds} seconds: your blows and arrows deal {pct}% more damage to it.', { seconds: N.huntersMark.seconds, pct: N.huntersMark.pct }),
  }),
  bladedancer: () => ({
    name: t('martial.bladedancer.name', 'Skirmisher'),
    passiveName: t('martial.bladedancer.passive', 'Dancer\'s Step'),
    passive: t('martial.bladedancer.passiveText', 'One enemy blow in {n} misses you.', { n: N.dancersStep.oneIn }),
    technique: t('martial.bladedancer.technique', CYCLONE),
    techniqueText: t('martial.bladedancer.techniqueText', 'Hit every enemy within {metres} meters.', { metres: FORMS.cyclone.reach }),
    rider: t('martial.bladedancer.rider', 'You swing {pct}% faster for {seconds} seconds.', { pct: N.cyclone.pace, seconds: N.cyclone.seconds }),
  }),
  bloodletter: () => ({
    name: t('martial.bloodletter.name', 'Bloodletter'),
    passiveName: t('martial.bloodletter.passive', 'Bloodlust'),
    passive: t('martial.bloodletter.passiveText', 'Each kill restores {pct}% of your health.', { pct: N.bloodlust.health }),
    technique: t('martial.bloodletter.technique', GUTTING_LUNGE),
    techniqueText: t('martial.bloodletter.techniqueText', 'Dash {metres} meters, hitting every enemy you pass.', { metres: FORMS.guttingLunge.length }),
    rider: t('martial.bloodletter.rider', 'An enemy already below {pct}% health takes the blow twice.', { pct: pc(N.guttingLunge.below) }),
  }),
  cutthroat: () => ({
    name: t('martial.cutthroat.name', 'Cutthroat'),
    passiveName: t('martial.cutthroat.passive', 'Cheap Shot'),
    passive: t('martial.cutthroat.passiveText', 'Your blows and arrows deal {pct}% more damage to enemies that haven\'t noticed you.', { pct: N.cheapShot.pct }),
    technique: t('martial.cutthroat.technique', BLACKJACK),
    techniqueText: t('martial.cutthroat.techniqueText', 'A heavy blow at the nearest enemy in front of you, +{toHit} to hit.', { toHit: FORMS.blackjack.toHit }),
    rider: t('martial.cutthroat.rider', 'An enemy that hadn\'t noticed you takes the blow twice.'),   // N.blackjack.times is 2 (pinned beside the word)
  }),
  assassin: () => ({
    name: t('martial.assassin.name', 'Assassin'),
    passiveName: t('martial.assassin.passive', 'Opening Strike'),
    passive: t('martial.assassin.passiveText', 'Your first blow or arrow at each enemy deals {pct}% more damage.', { pct: N.openingStrike.pct }),
    technique: t('martial.assassin.technique', VANISHING_STRIKE),
    techniqueText: t('martial.assassin.techniqueText', 'Bow: one heavy shot. Short blade: dash behind an enemy and strike.'),
    rider: t('martial.assassin.rider', 'On a hit, you gain Chameleon for {rounds} rounds.', { rounds: N.vanishingStrike.rounds }),
  }),
  shadowdancer: () => ({
    name: t('martial.shadowdancer.name', 'Shadowdancer'),
    passiveName: t('martial.shadowdancer.passive', 'Light Step'),
    passive: t('martial.shadowdancer.passiveText', '+{agility} Agility and +{dodging} Dodging.', { agility: N.lightStep.agility, dodging: N.lightStep.dodging }),
    technique: t('martial.shadowdancer.technique', PHANTOM_STRIKE),
    techniqueText: t('martial.shadowdancer.techniqueText', 'Dash behind an enemy up to {metres} meters away and strike.', { metres: FORMS.phantomStrike.range[1] }),
    rider: t('martial.shadowdancer.rider', 'For {seconds} seconds, one enemy blow in {n} misses you.', { seconds: N.phantomStrike.seconds, n: N.phantomStrike.oneIn }),
  }),
  juggernaut: () => ({
    name: t('martial.juggernaut.name', 'Juggernaut'),
    passiveName: t('martial.juggernaut.passive', 'Stand Firm'),
    passive: t('martial.juggernaut.passiveText', 'When damage drops you below {below}% health, you heal {pct}% of your health. This can happen once every {minutes} minutes.', { below: pc(N.standFirm.below), pct: N.standFirm.heal, minutes: N.standFirm.recover / 60 }),
    technique: t('martial.juggernaut.technique', EARTHSPLITTER),
    techniqueText: t('martial.juggernaut.techniqueText', 'Hit every enemy within {metres} meters.', { metres: FORMS.earthsplitter.reach }),
    rider: t('martial.juggernaut.rider', 'For {seconds} seconds, enemy blows deal {pct}% less damage to you.', { seconds: N.earthsplitter.seconds, pct: N.earthsplitter.lighter }),
  }),
  woodsman: () => ({
    name: t('martial.woodsman.name', 'Woodsman'),
    passiveName: t('martial.woodsman.passive', 'Tireless'),
    passive: t('martial.woodsman.passiveText', 'Each kill restores {pct}% of your fatigue.', { pct: N.tireless.fatigue }),
    technique: t('martial.woodsman.technique', FELLING_STRIKE),
    techniqueText: t('martial.woodsman.techniqueText', 'Bow: {arrows} arrows rain down on a spot. Axe: leap onto an enemy up to {metres} meters away.', { arrows: FORMS.fellingVolley.arrows, metres: FORMS.fellingStrike.range[1] }),
    rider: t('martial.woodsman.rider', 'Each enemy it kills restores {pct}% of your health.', { pct: N.fellingStrike.heal }),
  }),
  berserker: () => ({
    name: t('martial.berserker.name', 'Berserker'),
    passiveName: t('martial.berserker.passive', 'Frenzy'),
    passive: t('martial.berserker.passiveText', 'Below {below}% health, your blows and arrows deal {pct}% more damage and you swing {pace}% faster.', { below: pc(N.frenzy.below), pct: N.frenzy.pct, pace: N.frenzy.pace }),
    technique: t('martial.berserker.technique', SAVAGE_WHIRL),
    techniqueText: t('martial.berserker.techniqueText', 'Hit every enemy within {metres} meters.', { metres: FORMS.savageWhirl.reach }),
    rider: t('martial.berserker.rider', 'For {seconds} seconds, every blow or arrow you land heals you for {pct}% of its damage.', { seconds: N.savageWhirl.seconds, pct: N.savageWhirl.leech }),
  }),
  crusader: () => ({
    name: t('martial.crusader.name', 'Crusader'),
    passiveName: t('martial.crusader.passive', 'Purge'),
    passive: t('martial.crusader.passiveText', 'Your blows and arrows deal {pct}% more damage to undead and daedra.', { pct: N.purge.pct }),
    technique: t('martial.crusader.technique', HALLOWED_STRIKE),
    techniqueText: t('martial.crusader.techniqueText', 'Bow: a shot that passes through up to {through} enemies. Blunt weapon: a heavy blow at the nearest enemy in front of you, +{toHit} to hit.', { through: FORMS.hallowedShot.through, toHit: FORMS.hallowedStrike.toHit }),
    rider: t('martial.crusader.rider', 'Undead and daedra it hits take an extra {pct}% of the damage.', { pct: pc(N.hallowedStrike.share) }),
  }),
  brawler: () => ({
    name: t('martial.brawler.name', 'Brawler'),
    passiveName: t('martial.brawler.passive', 'Grit'),
    passive: t('martial.brawler.passiveText', 'Each round, you regain {health}% of your health and {fatigue}% of your fatigue.', { health: N.grit.health, fatigue: N.grit.fatigue }),
    technique: t('martial.brawler.technique', KNOCKOUT),
    techniqueText: t('martial.brawler.techniqueText', 'A heavy blow at the nearest enemy in front of you, +{toHit} to hit.', { toHit: FORMS.knockout.toHit }),
    rider: t('martial.brawler.rider', 'For {seconds} seconds, blows from the enemy it hits deal {pct}% less damage to you.', { seconds: N.knockout.seconds, pct: N.knockout.lighter }),
  }),
  windrunner: () => ({
    name: t('martial.windrunner.name', 'Strider'),
    passiveName: t('martial.windrunner.passive', 'Windborne'),
    passive: t('martial.windrunner.passiveText', '+{speed} Speed, +{running} Running and +{jumping} Jumping.', { speed: N.windborne.speed, running: N.windborne.running, jumping: N.windborne.jumping }),
    technique: t('martial.windrunner.technique', WINDSTRIKE),
    techniqueText: t('martial.windrunner.techniqueText', 'Bow: {arrows} arrows rain down on a spot. Bare hands: a flying kick at an enemy up to {metres} meters away, even in mid-air.', { arrows: FORMS.windVolley.arrows, metres: FORMS.windKick.range[1] }),
    rider: t('martial.windrunner.rider', 'Each enemy it hits restores {pct}% of your fatigue (up to {foes} enemies).', { pct: N.windstrike.fatigue, foes: N.windstrike.foes }),
  }),
});
/** A path's words now: { name, passiveName, passive, technique, techniqueText, rider } - in the player's language. */
export function martialWords(id) { return Object.hasOwn(WORDS, id) ? WORDS[/** @type {keyof typeof WORDS} */ (id)]() : null; }

/** THE FIFTEEN, one per pair of the six weapon skills - the design page's table, section 5. AUDIT MARTIAL L4 N2: the ids
 *  stand (a save's), and two names moved off the Firmament's own - the bladedancer is the Skirmisher (the sky's Blade
 *  Dancer notable), the windrunner the Strider (its Wind Runner keystone). */
/** @type {Array<[string, number[]]>} */
const PATH_ROWS = [
  ['blademaster', [LB, SB]],
  ['warblade', [LB, AX]],
  ['vanguard', [LB, BL]],
  ['ranger', [LB, AR]],
  ['bladedancer', [LB, HH]],
  ['bloodletter', [SB, AX]],
  ['cutthroat', [SB, BL]],
  ['assassin', [SB, AR]],
  ['shadowdancer', [SB, HH]],
  ['juggernaut', [AX, BL]],
  ['woodsman', [AX, AR]],
  ['berserker', [AX, HH]],
  ['crusader', [BL, AR]],
  ['brawler', [BL, HH]],
  ['windrunner', [AR, HH]],
];
export const MARTIAL_PATHS = Object.freeze(PATH_ROWS.map(([id, skills]) => Object.freeze({
  id, skills: Object.freeze([...skills]),
  /** the signature's forms, by family: { longBlade: 'huntersPounce', archery: 'huntersMark' } */
  forms: Object.freeze(Object.fromEntries(SIGNATURE_IDS.filter((f) => FORMS[f].path === id).flatMap((f) => FORMS[f].families.map((fam) => [fam, f])))),
  get name() { return martialWords(id).name; },
  get passive() { const w = martialWords(id); return { name: w.passiveName, text: w.passive }; },
  get technique() { const w = martialWords(id); return { name: w.technique, text: w.techniqueText }; },
  get rider() { return martialWords(id).rider; },
})));

/** Path id -> its record. */
export const MARTIAL_BY_ID = Object.freeze(Object.fromEntries(MARTIAL_PATHS.map((p) => [p.id, p])));
export const isMartialPathId = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(MARTIAL_BY_ID, id);
const pairKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
const PATH_BY_PAIR = new Map(MARTIAL_PATHS.map((p) => [pairKey(p.skills[0], p.skills[1]), p]));
/** The path two weapon skills name, or null. */
export const martialOfPair = (a, b) => (a !== b ? PATH_BY_PAIR.get(pairKey(a, b)) ?? null : null);

/** A path's two skills, by DFU's own skill names (in the player's language). */
const skillsOf = (p) => ({ a: SKILL_NAMES[p.skills[0]], b: SKILL_NAMES[p.skills[1]] });
/** A path's two skills as one line ("Long Blade and Archery"). */
export const martialSkillsText = (p) => t('martial.choice.skills', '{a} and {b}', skillsOf(p));
/** Can this character EVER meet a martial path - two of the six weapon skills mastered, or masterable in the slots its
 *  career groups have left (masterSkills.js masterableCount - AUDIT MARTIAL L4 L3: two weapon skills that were both minor
 *  ones, one minor slot between them, showed the card for good)? */
export const martialPossible = (entity) => masterableCount(entity, MARTIAL_SKILLS) >= 2;

// ── the choice ──────────────────────────────────────────────────────

/** The six weapon skills this entity has MASTERED, in MARTIAL_SKILLS order.
 *  @returns {number[]} */
export const masteredWeapons = (entity) => MARTIAL_SKILLS.filter((id) => masteredSkills(entity).includes(id));
/** The martial path this entity chose, or null. */
export const martialPathOf = (entity) => (isMartialPathId(entity?.martialPath) ? MARTIAL_BY_ID[entity.martialPath] : null);

/** The martial paths this entity may choose NOW, in table order: Master Skills in force, none yet, both skills mastered. */
export function martialChoices(entity) {
  if (!entity || martialPathOf(entity) || !masterSkillsActive(entity)) return [];
  const have = masteredWeapons(entity);
  return MARTIAL_PATHS.filter((p) => have.includes(p.skills[0]) && have.includes(p.skills[1]));
}

/** Why this martial path cannot be chosen now, or null when it can. */
export function martialRefusal(entity, id) {
  if (!isMartialPathId(id)) return t('martial.refuse.none', 'No such specialization.');
  if (martialPathOf(entity)) return t('martial.refuse.already', 'Your martial specialization is already chosen: {name}.', { name: martialPathOf(entity).name });
  if (!masterSkillsActive(entity)) return t('martial.refuse.off', 'Master Skills is off.');
  const p = MARTIAL_BY_ID[id];
  if (!p.skills.every((s) => isMasteredSkill(entity, s))) return t('martial.refuse.skills', 'Master {a} and {b} first.', skillsOf(p));
  return null;
}

/** Choose it - for good, short of the paid reset (specReset.js). Returns { ok, text }. */
export function chooseMartialPath(entity, id) {
  const why = martialRefusal(entity, id);
  if (why) return { ok: false, text: why };
  entity.martialPath = id;
  const p = MARTIAL_BY_ID[id];
  // AUDIT MARTIAL L4 M1: one short line - the classic sheet's notice and the HUD draw it unwrapped in 312 px; what the
  // technique key does is the card's and the OK box's (martial.sheet.key)
  return { ok: true, text: t('martial.chosen', 'Martial specialization chosen: {name}.', { name: p.name }) };
}

export const MARTIAL_DECLINED_TEXT = 'You can choose a martial specialization later in your skill screen.';
/** GROWTH4: the No's line where the enhanced pause window stands - its Growth tab (arcanePaths.js's own law). */
export const MARTIAL_DECLINED_GROWTH_TEXT = 'You can choose a martial specialization later on the Growth tab of the pause menu.';
export const martialDeclinedGrowthText = () => t('martial.declinedGrowth', MARTIAL_DECLINED_GROWTH_TEXT);
/** The No's line, in the player's language. */
export const martialDeclinedText = () => t('martial.declined', MARTIAL_DECLINED_TEXT);

/** The first path the game still owes an ASK (asked once a character; the skill screen keeps the rest), or null. */
export const nextMartialChoice = (entity) => (entity?.martialPrompted ? null : martialChoices(entity)[0] ?? null);

/** What a path does, in two rows: its passive, then its signature technique and the technique's rider. */
export const martialPowerRows = (p) => [
  t('martial.row.passive', '{name}: {text}', { name: p.passive.name, text: p.passive.text }),
  t('martial.row.technique', '{technique} (signature technique): {text} {rider}', { technique: p.technique.name, text: p.technique.text, rider: p.rider }),
];

/** The choice box's rows - as arcanePaths.js pathChoiceRows: Daggerfall's parchment box and the enhanced card alike.
 *  `others` false leaves out the count of the other open paths (the classic sheet says its own). */
export function martialChoiceRows(entity, id, { others = true } = {}) {
  const p = MARTIAL_BY_ID[id];
  if (!p) return [];
  const more = others ? martialChoices(entity).length - 1 : 0;
  return [
    t('martial.choice.title', 'Martial specialization: {name}?', { name: p.name }),   // AUDIT MARTIAL L4 L4: never the arcane ask's own words
    martialSkillsText(p),
    '',
    ...martialPowerRows(p),
    '',
    t('martial.choice.reset', 'Resetting it later costs {gold, number} gold.', { gold: SPEC_RESET_GOLD }),
    ...(more > 0 ? [t('martial.choice.others', '{n, plural, one {# other martial specialization is open to you.} other {# other martial specializations are open to you.}}', { n: more })] : []),
  ];
}

/** The one ask when SEVERAL martial paths are open - their names, and where each is chosen (AUDIT SCHOOLS L4 M1's law;
 *  GROWTH4: `growth` - the enhanced pause window's Growth tab, else the skill screen). */
export function martialOpenRows(open, { growth = false } = {}) {
  return [
    t('martial.open.title', 'Martial Specialization'),
    '',
    t('martial.open.count', '{n, plural, one {# martial specialization is open to you:} other {# martial specializations are open to you:}}', { n: open.length }),
    open.map((p) => p.name).join(', '),
    '',
    growth ? t('martial.open.whereGrowth', 'See them all and choose one on the Growth tab of the pause menu.')
      : t('martial.open.where', 'Choose one in your skill screen.'),
    t('martial.choice.reset', 'Resetting it later costs {gold, number} gold.', { gold: SPEC_RESET_GOLD }),   // AUDIT SPEC-RESET L4-5: a row of its own
  ];
}

/** What a chosen path is, in rows (the sheets' description). */
export function martialAboutRows(p) {
  if (!p) return [];
  return [t('martial.about.title', '{name} - {a} and {b}', { name: p.name, ...skillsOf(p) }), '', ...martialPowerRows(p)];
}

// ── held and awake ──────────────────────────────────────────────────

/** The martial path this entity HOLDS now, mentoring or not - my own player entity, Master Skills in force, both its
 *  skills mastered. What answers the technique key with a signature (a technique rides the formula, whose skills
 *  mentoring already lowers - as a loot line's does). */
export function martialHeld(entity) {
  if (!entity?.isPlayer || entity.peer) return null;
  const p = martialPathOf(entity);
  // two reads, never a closure: the HUD's chip and the swing's pace ask it every frame (AUDIT TECH-FX's law)
  if (!p || !masterSkillsActive(entity) || !isMasteredSkill(entity, p.skills[0]) || !isMasteredSkill(entity, p.skills[1])) return null;
  return p;
}
/** Does the path ACT for this entity now - its passive and its signature's rider? Held, and not mentoring. (A refereed
 *  fight is the powers' word to add - systems/martialPowers.js.) */
export function martialAwake(entity) {
  return entity?._mentor ? null : martialHeld(entity);
}

/** THE SIGNATURE IN HAND: the form of MY held path's signature that answers a weapon of `family` (techniqueRoster.js
 *  techniqueFamily's word; 'handToHand' for the bare hand), or null. */
export function signatureFor(entity, family) {
  const p = martialHeld(entity);
  const id = p && typeof family === 'string' ? p.forms[family] : null;
  return id ? SIGNATURE_TECHNIQUES[id] : null;
}
