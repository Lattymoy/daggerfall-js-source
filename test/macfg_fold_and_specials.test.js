// ---------------------------------------------------------------------------
// MAC-F + MAC-G - TWO READING SCREENS (2026-09-17).
//
// Mac, with a screenshot of the Chronicle's Quests tab and an arrow at
// MAIN QUEST BACKBONE:
//   1. "In the enhanced chronicle. Quests and their tab's should be able
//      to be minimized."
//   2. "The enhanced stat page on the pause menu doesn't have any listing
//      for character advantages/disadvantages."
//
// MAC-F is a reading problem the classic window solved by force: the
// logbook draws into a 320x200 panel and pages four lines at a time, so
// it never HAS a wall of text. The enhanced window scrolls a column
// instead, which is better until twelve quests each unroll their whole
// trail into it. A card folds to its head now, and the tab folds all of
// them at once; nothing about the model changed.
//
// MAC-G is a missing screen. DFU HAS this list - GetClassSpecials
// (DaggerfallCharacterSheetWindow.cs:459-762) behind the classic sheet's
// History button - and the port had `parseCareerData`, the WRITE onto a
// career's flags, with no read anywhere in either skin. So the picks a
// player spends the whole of chargen balancing became invisible the
// moment the game started.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  foldKey, isFolded, toggleFold, allFolded, setSectionFold,
} from '../src/ui/enhancedChronicle.js';
import {
  parseCareerData, classSpecials, DEFAULT_MAGERY_BITS, SPECIAL_ABILITY_BITS,
} from '../src/systems/specialAdvantages.js';
import { sheetModel } from '../src/ui/enhancedCharSheet.js';
import { RACE_TEMPLATES } from '../src/systems/races.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A career of the shape formats/classFile.js mints, with every flag clear. */
const blankCareer = (name = 'Spellsword') => ({
  name,
  resistanceFlags: 0, immunityFlags: 0, lowToleranceFlags: 0, criticalWeaknessFlags: 0,
  abilityFlagsAndSpellPointsBitfield: DEFAULT_MAGERY_BITS << 8,
  rapidHealing: 0, regeneration: 0, spellAbsorptionFlags: 0, attackModifierFlags: 0,
  forbiddenMaterialsFlags: 0, weaponArmorShieldsBitfield: 0,
});

test('MAC-F: the fold laws, which are a Set and four functions', () => {
  const store = new Set();
  assert.equal(foldKey('quests', 2), 'quests:2');
  assert.equal(isFolded(store, 'quests', 0), false);
  toggleFold(store, 'quests', 0);
  assert.equal(isFolded(store, 'quests', 0), true);
  toggleFold(store, 'quests', 0);
  assert.equal(isFolded(store, 'quests', 0), false, 'the same handle opens it again');

  // THE SECTION IS PART OF THE KEY. Notes and Quests both count from 0
  // and a shared key would fold the wrong card in the other tab.
  toggleFold(store, 'quests', 1);
  assert.equal(isFolded(store, 'notes', 1), false);

  // ALL FOLDED reads the cards rather than a flag, so folding the last
  // one by hand flips the section control with it.
  setSectionFold(store, 'notes', 3, true);
  assert.equal(allFolded(store, 'notes', 3), true);
  toggleFold(store, 'notes', 1);
  assert.equal(allFolded(store, 'notes', 3), false, 'one open card is not all folded');
  setSectionFold(store, 'notes', 3, false);
  assert.equal(allFolded(store, 'notes', 3), false);

  // AN EMPTY SECTION IS NOT "ALL FOLDED" - there is nothing to fold, and
  // `every` over an empty list is true, which would have offered to
  // EXPAND a tab holding nothing.
  assert.equal(allFolded(new Set(), 'messages', 0), false);

  // a store that was never made does not throw at the reader
  assert.equal(isFolded(null, 'quests', 0), false);
});

test('MAC-F: the head is the handle, and the body goes with the fold', () => {
  const cr = read('src/ui/enhancedChronicle.js');
  // The caret and the date are ONE button - the handle is the thing the
  // player was already reading, which is what the screenshot pointed at.
  assert.match(cr, /const fold = el\('button', 'cr-fold'\);/);
  assert.match(cr, /fold\.append\(el\('span', 'px-c cr-caret', shut \? '\\u25b8' : '\\u25be'\)\);/);
  assert.match(cr, /fold\.append\(el\('span', 'cr-when', head \?\? ''\)\);/);
  assert.match(cr, /fold\.setAttribute\('aria-expanded', String\(!shut\)\);/);
  // THE BODY IS WHAT FOLDS. The head, the date and the remove all stay.
  assert.match(cr, /if \(!isFolded\(folded, section, i\)\) for \(const line of e\.body\)/);
  // and the remove is a SIBLING of that button, not inside it: a button
  // in a button is not HTML, and the click would toggle as well as remove
  assert.doesNotMatch(cr, /fold\.append\(rm\)/);
  assert.match(cr, /top\.append\(fold\);/);
  assert.match(cr, /top\.append\(rm\);/);
  // PX24c's headless card keeps its class - a message still has no date
  assert.match(cr, /if \(!head\) top\.classList\.add\('cr-headless'\);/);
});

test('MAC-F: the tab folds all of them at once, and the control reads the cards', () => {
  const cr = read('src/ui/enhancedChronicle.js');
  assert.match(cr, /const shutAll = allFolded\(folded, section, rows\.length\);/);
  assert.match(cr, /shutAll \? 'Expand all' : 'Collapse all'/);
  assert.match(cr, /setSectionFold\(folded, section, rows\.length, !shutAll\);/);
  // It lives with the ENTRIES, so an empty tab does not offer to collapse
  // nothing and the history - one page of prose, no cards - has none.
  const entriesArm = cr.slice(cr.indexOf('const shutAll'));
  assert.ok(entriesArm.includes("const box = el('div', 'cr-entries');"),
    'the control is inside the arm that draws cards');
  const historyArm = cr.slice(cr.indexOf("if (section === 'history')"), cr.indexOf('const rows = model[section]'));
  assert.doesNotMatch(historyArm, /foldall/);
});

test('MAC-F: a fold is a reading position, not a setting', () => {
  const cr = read('src/ui/enhancedChronicle.js');
  // cleared when the window opens and when it is torn down: a player who
  // shut every quest last night opens the book READ this morning
  assert.match(cr, /folded\.clear\(\);   \/\/ MAC-F/);
  assert.match(cr, /section = 'notes'; draft = ''; folded\.clear\(\);/);
  // and nothing about it reaches disk
  assert.doesNotMatch(cr, /localStorage|indexedDB|setItem/);
  // the style carries the fold's own parts, including the SHUT card -
  // a card that keeps a rule under its title looks like one whose body
  // failed to draw
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.cr-shell \.cr-fold \{ flex: 1;/);
  assert.match(css, /\.cr-shell \.cr-entry\.cr-shut \.cr-head \{ padding-bottom: 0; margin-bottom: 0; border-bottom: 0; \}/);
});

test('MAC-G: classSpecials is parseCareerData read backwards', () => {
  // THE STRONGEST PIN THIS PAIR ADMITS: fold a pick list onto a career
  // with the writer, read it back with the reader, and every pick has to
  // come home. The two walk the same bitfields in the same file.
  const picks = [
    { primary: 'acuteHearing', secondary: '' },
    { primary: 'athleticism', secondary: '' },
    { primary: 'adrenalineRush', secondary: '' },
    { primary: 'expertiseIn', secondary: 'longBlade' },
    { primary: 'immunity', secondary: 'toFire' },
    { primary: 'increasedMagery', secondary: 'intInSpellPoints2' },
    { primary: 'regenerateHealth', secondary: 'inDarkness' },
    { primary: 'spellAbsorption', secondary: 'inLight' },
    { primary: 'rapidHealing', secondary: 'general' },
    { primary: 'bonusToHit', secondary: 'undead' },
    { primary: 'damage', secondary: 'fromSunlight' },
    { primary: 'phobia', secondary: 'animals' },
    { primary: 'forbiddenMaterial', secondary: 'daedric' },
    { primary: 'forbiddenArmorType', secondary: 'plate' },
    { primary: 'forbiddenShieldTypes', secondary: 'towerShield' },
    { primary: 'forbiddenWeaponry', secondary: 'axe' },
    { primary: 'lowTolerance', secondary: 'toPoison' },
    { primary: 'inabilityToRegen', secondary: '' },
    { primary: 'darknessPoweredMagery', secondary: 'lowerMagicAbilityDaylight' },
  ];
  const career = parseCareerData(blankCareer(), picks);
  const back = classSpecials(career);
  const pair = (r) => `${r.primary}|${r.secondary}`;
  assert.deepEqual(
    new Set(back.map(pair)),
    new Set(picks.map((p) => `${p.primary}|${p.secondary}`)),
    'every pick comes home, and nothing else does');

  // the two lists chargen built them from, which is the split the page draws
  const kind = Object.fromEntries(back.map((r) => [r.primary, r.kind]));
  assert.equal(kind.acuteHearing, 'advantage');
  assert.equal(kind.immunity, 'advantage');
  assert.equal(kind.phobia, 'disadvantage');
  assert.equal(kind.forbiddenMaterial, 'disadvantage');
  assert.equal(kind.inabilityToRegen, 'disadvantage');

  // the label is DFU's own pairing: primary, space, secondary
  assert.ok(back.some((r) => r.label === 'Expertise in Long Blade'));
  assert.ok(back.some((r) => r.label === 'Acute Hearing'), 'and no trailing space when there is no secondary');
  assert.ok(back.every((r) => r.source === 'career'));
});

test('MAC-G: GetClassSpecials\u2019 own order, section by section', () => {
  const career = parseCareerData(blankCareer(), [
    { primary: 'damage', secondary: 'fromSunlight' },      // last career section
    { primary: 'acuteHearing', secondary: '' },            // talents
    { primary: 'forbiddenMaterial', secondary: 'iron' },   // the forbidden sets
    { primary: 'expertiseIn', secondary: 'axe' },          // proficiencies
    { primary: 'immunity', secondary: 'toFire' },          // tolerances, first
    { primary: 'bonusToHit', secondary: 'undead' },        // attack modifiers
  ]);
  const order = classSpecials(career, { resistanceFlags: 2 }).map((r) => r.primary);
  assert.deepEqual(order, [
    'immunity', 'expertiseIn', 'bonusToHit', 'forbiddenMaterial',
    'acuteHearing', 'damage',
    'resistance',   // the blood comes last, as the sheet appends it (:687-760)
  ]);
});

test('MAC-G: the blood is named, and never said twice', () => {
  // A Breton mage can carry Resistance To Magic from the class AND from
  // the blood. DFU prints it once (:707-739) and so does this - as the
  // CLASS's, because that is the one already in the list.
  const career = parseCareerData(blankCareer(), [{ primary: 'resistance', secondary: 'toMagic' }]);
  const breton = RACE_TEMPLATES.find((r) => r.key === 'Breton');
  const rows = classSpecials(career, breton).filter((r) => r.label === 'Resistance To Magic');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'career');

  // and with no class pick it is the blood's, which is what the page tags
  const bare = classSpecials(blankCareer(), breton);
  assert.deepEqual(bare.map((r) => [r.label, r.source]), [['Resistance To Magic', 'race']]);

  // the High Elf's paralysis immunity, the other flag any playable race sets
  const highElf = RACE_TEMPLATES.find((r) => r.key === 'HighElf');
  assert.deepEqual(classSpecials(blankCareer(), highElf).map((r) => r.label), ['Immunity To Paralysis']);

  // NO PLAYABLE RACE SETS SpecialAbilities (RaceTemplate.cs:172-345), so
  // DFU's copy-paste slip at :744 - Athleticism mapped to the ACUTE
  // HEARING string - is unreachable there and here. The port writes what
  // the flag means; this pin holds the premise that makes that safe.
  assert.ok(RACE_TEMPLATES.every((r) => (r.specialAbilities ?? 0) === 0));
  const athletic = classSpecials(blankCareer(), { specialAbilities: SPECIAL_ABILITY_BITS.athleticism });
  assert.deepEqual(athletic.map((r) => r.label), ['Athleticism'], 'the slip is recorded, not ported');
});

test('MAC-G: the magery band is only read when the career carries it', () => {
  // 0 in that band is Times_3_00 - the strongest magery in the game - so
  // a career object without the field would otherwise announce it.
  assert.deepEqual(classSpecials({}).map((r) => r.label), []);
  assert.deepEqual(classSpecials({ immunityFlags: 8 }).map((r) => r.label), ['Immunity To Fire']);
  // the Times_0_50 default is silent, as it is in DFU (:616)
  assert.deepEqual(classSpecials(blankCareer()).map((r) => r.label), []);
  // and a real pick speaks
  const x3 = parseCareerData(blankCareer(), [{ primary: 'increasedMagery', secondary: 'intInSpellPoints3' }]);
  assert.deepEqual(classSpecials(x3).map((r) => r.label), ['Increased Magery 3X INT In Spell Points']);
});

test('MAC-G: a bonus and a phobia against ONE group read as the bonus', () => {
  // `cannotAdd` makes this pair impossible at chargen (EXCLUSIVE_PAIRS,
  // bonusToHit/phobia with equal secondaries), so only a hand-edited or
  // modded CLASS.CFG can present both bits for one group. DFU still has
  // an order for it - GetAttackModifier asks for the bonus first
  // (:520-537 prints whatever that answers) - and a reader without one
  // would flip a class's headline advantage into a fear of animals.
  const career = blankCareer();
  career.attackModifierFlags = 0x08 | 0x80;   // ATTACK_BITS.animals: [bonus, phobia]
  assert.deepEqual(classSpecials(career).map((r) => r.label), ['Bonus to hit Animals']);
});

test('MAC-G: the sheet carries the list, and the pause page draws it', () => {
  const career = parseCareerData(blankCareer('Spellsword'), [
    { primary: 'expertiseIn', secondary: 'longBlade' },
    { primary: 'forbiddenArmorType', secondary: 'plate' },
  ]);
  // The model is ONE model - the enhanced sheet IS the pause window's
  // Stats page (PX27), so the list rides sheetModel like every number.
  const m = sheetModel({ name: 'Janome', race: 'Breton', career });
  assert.deepEqual(m.specials.map((r) => r.label),
    ['Expertise in Long Blade', 'Forbidden Armor Type Plate', 'Resistance To Magic']);
  // the race is taken however the character was made: key, display name or id
  assert.equal(sheetModel({ race: 'Dark Elf', career: blankCareer() }).specials.length, 0, 'a Dark Elf sets no flags');
  assert.equal(sheetModel({ raceId: 5, career: blankCareer() }).specials[0]?.label, 'Immunity To Paralysis');
  assert.deepEqual(sheetModel({}).specials, [], 'no career is no rows, not a crash');

  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /\['skills', 'Skills'\], \['specials', 'Advantages'\], \['standing', 'Standing'\]/);
  assert.match(menu, /specials: statsSpecials/);
  assert.match(menu, /\[\['advantage', 'Advantages'\], \['disadvantage', 'Disadvantages'\]\]/);
  // the SOURCE tag, because Resistance To Magic from the blood and from
  // the class are different facts about a re-rollable character
  assert.match(menu, /r\.source === 'race' \? \(m\.race \|\| 'Race'\) : \(m\.career \|\| 'Class'\)/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.px-stat \.v\.px-src \{ font-size: 13px;/);
});

test('MAC-F + MAC-G: both were driven in a real browser', () => {
  // Neither report is a law - one is a card that folds and one is a page
  // that lists - so the pins above are source and model, and the CLAIM
  // that the two windows work is the probe's. It mounts both over the
  // live /play/ page, with no ARENA2 anywhere.
  const probe = read('tools/macfgProbe.mjs');
  assert.match(probe, /mountEnhancedChronicle/);
  assert.match(probe, /mountEnhancedMenu\(host, \{ mode: 'pause', at: 'stats' \}\)/);
  assert.match(probe, /Collapse all shuts the whole tab/);
  assert.match(probe, /one head opens ONE card/);
  assert.match(probe, /a fold survives walking to another tab and back/);
  assert.match(probe, /the blood is marked as the blood/);
});
