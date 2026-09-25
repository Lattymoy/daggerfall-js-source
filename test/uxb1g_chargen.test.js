// UXB1-G / UXB1-H / UXB1-I / UXB1-J (2026-09-25, the UX backlog's CHARACTER CREATION list):
//   G "Stat explanations on hover/tiny button (Minimizes need for external resources)"
//   H "Export/Import class from file/clipboard"
//   I "Restore the difficulty dagger or some other similar visual indicator"
//   J "Try to modify the character creation menu to prevent the need for scrolling on standard aspect ratios
//      (can't account for everything, but 16:9 shouldn't need to)"
// Pinned by execution through the enhanced wizard on test/chargenDom.mjs's DOM, and by the class document's laws.
// J's measure is a browser's (every stage fits at 1920x1080, 1600x900, 1366x768 and 1280x720); what node can hold
// is the structure that measure rests on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass, text, Node_ } from './chargenDom.mjs';
import { mountEnhancedChargen, classFileName, CLASS_FILE_EXT } from '../src/ui/enhancedChargen.js';
import { ChargenFlow, NAME_MAX_CHARACTERS } from '../src/ui/chargen.js';
import {
  daggerY, daggerFraction, DAGGER_Y_MIN, DAGGER_Y_MAX, DAGGER_Y_DEFAULT, DIFFICULTY_MIN, DIFFICULTY_MAX,
  advancementMultiplier, customClassDoc, parseCustomClassDoc, CLASS_FILE_FORMAT, CLASS_FILE_VERSION,
} from '../src/systems/customClass.js';
import { ATTRIBUTE_BLURB } from '../src/ui/levelUpView.js';
import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import { SKILLS, SKILL_NAMES } from '../src/systems/skills.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';

const CAREER = { name: 'Mage', hitPointsPerLevel: 8, advancementMultiplier: 1, strength: 40, intelligence: 60, willpower: 72, agility: 48, endurance: 52, personality: 55, speed: 48, luck: 57,
  primarySkills: [SKILLS.Mysticism, SKILLS.Alteration, SKILLS.Thaumaturgy], majorSkills: [SKILLS.Illusion, SKILLS.Destruction, SKILLS.Restoration],
  minorSkills: [SKILLS.Medical, SKILLS.ShortBlade, SKILLS.BluntWeapon, SKILLS.Dragonish, SKILLS.Daedric, SKILLS.Dodging] };

/** A fresh flow on the custom class builder, and the wizard mounted over it. */
function builder() {
  const flow = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
  flow.state = 'class';
  flow.classListIndex = flow.careers.length;
  flow.useClass();
  const host = new Node_('div');
  const view = mountEnhancedChargen(host, { flow, onExit() {} });
  view.repaint();
  return { flow, host, view, c: flow.custom };
}
const buttonNamed = (root, words) => root.querySelectorAll('button').find((b) => text(b) === words);
const pct = (p) => `${(daggerFraction(p) * 100).toFixed(2)}%`;

// ── I: THE DAGGER ────────────────────────────────────────────────

test('UXB1-I: the dagger\'s place on its track is daggerY normalised - the classic dagger\'s own lopsided scale and truncation, 0 at the easiest end, 1 at the hardest', () => {
  assert.equal(daggerFraction(0), (DAGGER_Y_MAX - DAGGER_Y_DEFAULT) / (DAGGER_Y_MAX - DAGGER_Y_MIN), 'no points: the default Y (115)');
  assert.equal(daggerFraction(-1000), 0, 'the track\'s bottom (maxDaggerY 186)');
  assert.equal(daggerFraction(1000), 1, 'its top (minDaggerY 46)');
  let last = -1;
  for (let p = -30; p <= 90; p++) {
    assert.equal(daggerFraction(p), (DAGGER_Y_MAX - daggerY(p)) / (DAGGER_Y_MAX - DAGGER_Y_MIN), `${p} points`);
    assert.ok(daggerFraction(p) >= last, 'a stronger class never stands lower');
    last = daggerFraction(p);
  }
  // twelve points below the default move it 41px; forty above, 37 (:500-511)
  assert.equal(daggerY(DIFFICULTY_MIN), DAGGER_Y_DEFAULT + 41);
  assert.equal(daggerY(DIFFICULTY_MAX), DAGGER_Y_DEFAULT - 37);
});

test('UXB1-I: the builder carries the dagger where the bare tally stood - the mark at daggerFraction, the band Create allows, the multiplier it costs; out of the band it turns red and says why; the special picks\' pane carries it too', () => {
  const { flow, host, view, c } = builder();
  const [g] = byClass(host, 'dagger');
  assert.ok(g, 'the gauge is on the builder');
  assert.equal(g.getAttribute('role'), 'meter');
  assert.equal(g.getAttribute('aria-valuenow'), String(flow.customDifficulty()));
  assert.equal(g.className.split(/\s+/).includes('red'), false);
  assert.equal(text(byClass(g, 'dagger-val')[0]), String(flow.customDifficulty()));
  assert.equal(byClass(g, 'dagger-mark')[0].style.left, pct(flow.customDifficulty()));
  const band = byClass(g, 'dagger-band')[0];
  assert.equal(band.style.left, pct(DIFFICULTY_MIN), 'the band starts where -12 stands');
  assert.equal(band.style.width, `${((daggerFraction(DIFFICULTY_MAX) - daggerFraction(DIFFICULTY_MIN)) * 100).toFixed(2)}%`, 'and ends where +40 does');
  assert.equal(byClass(g, 'dagger-glyph').length, 1, 'a dagger, not a bar');
  assert.match(text(byClass(g, 'dagger-note')[0]), new RegExp(`×${advancementMultiplier(flow.customDifficulty()).toFixed(2)} the effort`));
  assert.equal(byClass(host, 'poolbar').filter((b) => /Difficulty/.test(text(b))).length, 0, 'the bare tally is gone');

  c.advantageAdjust = 60;   // a class stronger than Create allows
  view.repaint();
  const [red] = byClass(host, 'dagger');
  const pts = flow.customDifficulty();
  assert.ok(pts > DIFFICULTY_MAX);
  assert.ok(red.className.split(/\s+/).includes('red'), 'in the red');
  assert.equal(text(byClass(red, 'dagger-val')[0]), `+${pts}`);
  assert.equal(byClass(red, 'dagger-mark')[0].style.left, pct(pts));
  assert.match(text(byClass(red, 'dagger-note')[0]), /in the red/);

  c.advantageAdjust = 0;
  flow.applyHit({ customAdvantage: true });
  view.repaint();
  assert.equal(c.sub, 'advantage');
  assert.equal(byClass(host, 'dagger').length, 1, 'the picks that move it are made with it in sight');
});

// ── G: WHAT AN ATTRIBUTE DOES ────────────────────────────────────

test('UXB1-G: every attribute row says what it does on hover, and the selected one says it in words beside the list - the level-up screen\'s lines; selecting another changes it', () => {
  const { flow, host, view } = builder();
  const attrs = byClass(host, 'b-attrs')[0];
  const rows = byClass(attrs, 'row-main');
  assert.deepEqual(rows.map((b) => b.title), STAT_KEYS_ORDER.map((k) => ATTRIBUTE_BLURB[k]), 'the hover, row by row');
  const help = () => byClass(host, 'attrhelp')[0];
  assert.equal(text(help().querySelector('p')), ATTRIBUTE_BLURB[STAT_KEYS_ORDER[0]]);
  assert.equal(text(help().querySelector('h4')), 'Strength');
  rows[3].click();
  view.repaint();
  assert.equal(flow.custom.statCursor, 3);
  assert.equal(text(help().querySelector('h4')), 'Agility');
  assert.equal(text(help().querySelector('p')), ATTRIBUTE_BLURB.agility);
  for (const k of STAT_KEYS_ORDER) assert.ok(ATTRIBUTE_BLURB[k]?.length > 20, `${k} has a line`);
});

test('UXB1-G by source: the rolled stats and the review carry the same hover, and the stats card the selected line', () => {
  const view = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  const stats = view.slice(view.indexOf('function statsStage()'), view.indexOf('function skillsStage()'));
  assert.match(stats, /main\.title = ATTRIBUTE_BLURB\[key\];/);
  assert.match(stats, /d\.append\(attrHelp\(STAT_KEYS_ORDER\[flow\.statCursor\]\)\);/);
  const summary = view.slice(view.indexOf('function summaryStage()'));
  assert.match(summary, /row\.title = ATTRIBUTE_BLURB\[key\];/);
});

// ── H: THE CLASS, TO A FILE AND BACK ─────────────────────────────

/** A builder with a class on it: name, hp, twelve skills, a moved attribute pair, picks and reputations. */
function builtClass() {
  const f = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
  f.state = 'class';
  f.classListIndex = f.careers.length;
  f.useClass();
  const c = f.custom;
  c.className = 'Spellsword';
  c.hp = 14;
  c.skills = [SKILLS.LongBlade, SKILLS.Destruction, SKILLS.Restoration, SKILLS.Alteration, SKILLS.Dodging, SKILLS.Mysticism,
    SKILLS.Medical, SKILLS.Axe, SKILLS.Streetwise, SKILLS.Etiquette, SKILLS.Swimming, SKILLS.Climbing];
  c.stats = { ...c.stats, strength: 60, intelligence: 60, personality: 40, luck: 40 };
  c.reps = { merchants: 2, peasants: -1, scholars: 0, nobility: 0, underworld: -1 };
  c.advantages = [{ primary: 'expertiseIn', secondary: 'longBlade', difficulty: 2 }, { primary: 'acuteHearing', secondary: '', difficulty: 1 }];
  c.disadvantages = [{ primary: 'forbiddenArmorType', secondary: 'plate', difficulty: -5 }];
  return { f, c };
}

test('UXB1-H: a class is a document of the builder\'s choices - skills by name in their three groups, the eight attributes, the picks, the reputations - and reads back to the same choices', () => {
  const { c } = builtClass();
  const doc = customClassDoc(c);
  assert.equal(doc.format, CLASS_FILE_FORMAT);
  assert.equal(doc.version, CLASS_FILE_VERSION);
  assert.equal(doc.name, 'Spellsword');
  assert.equal(doc.hitPointsPerLevel, 14);
  assert.deepEqual(doc.skills.primary, ['Long Blade', 'Destruction', 'Restoration'].map((n) => SKILL_NAMES[SKILLS[n.replace(' ', '')]]));
  assert.equal(doc.skills.major.length, 3);
  assert.equal(doc.skills.minor.length, 6);
  assert.deepEqual(doc.advantages, [{ primary: 'expertiseIn', secondary: 'longBlade' }, { primary: 'acuteHearing' }], 'the choice, not what the window derives from it');
  const back = parseCustomClassDoc(JSON.stringify(doc));
  assert.equal(back.ok, true);
  assert.deepEqual(back.skipped, []);
  assert.equal(back.value.name, 'Spellsword');
  assert.equal(back.value.hp, 14);
  assert.deepEqual(back.value.skills, c.skills);
  assert.deepEqual(back.value.stats, c.stats);
  assert.deepEqual(back.value.reps, c.reps);
  assert.deepEqual(back.value.advantages, c.advantages, 'each pick\'s difficulty re-derived by the window\'s own table');
  assert.deepEqual(back.value.disadvantages, c.disadvantages);
  // an unfinished class travels too - the builder's Create gate is what wants twelve
  c.skills[11] = null;
  assert.equal(customClassDoc(c).skills.minor[5], null);
  assert.equal(parseCustomClassDoc(customClassDoc(c)).value.skills[11], null);
  // skills by any case, or by id
  const loose = customClassDoc(builtClass().c);
  loose.skills.primary = ['long blade', SKILLS.Destruction, ' RESTORATION '];
  assert.deepEqual(parseCustomClassDoc(loose).value.skills.slice(0, 3), [SKILLS.LongBlade, SKILLS.Destruction, SKILLS.Restoration]);
});

test('UXB1-H: every value the builder\'s windows would refuse is refused on the way in, in the player\'s words', () => {
  const good = () => customClassDoc(builtClass().c);
  const refuse = (mutate, why) => {
    const d = good();
    mutate(d);
    const r = parseCustomClassDoc(d);
    assert.equal(r.ok, false, why);
    assert.equal(typeof r.error, 'string');
    return r.error;
  };
  assert.match(parseCustomClassDoc('{ not json').error, /could not be read/);
  assert.equal(parseCustomClassDoc(null).ok, false);
  refuse((d) => { d.format = 'something-else'; }, 'another program\'s file');
  assert.match(refuse((d) => { d.version = CLASS_FILE_VERSION + 1; }, 'from the future'), /newer version/);
  refuse((d) => { d.version = 0; }, 'no version');
  refuse((d) => { d.hitPointsPerLevel = 3; }, 'below minHpPerLevel');
  refuse((d) => { d.hitPointsPerLevel = 31; }, 'above maxHpPerLevel');
  refuse((d) => { d.hitPointsPerLevel = 8.5; }, 'not whole');
  refuse((d) => { d.skills.major = d.skills.major.slice(0, 2); }, 'a group short');
  assert.match(refuse((d) => { d.skills.minor[0] = 'Basket Weaving'; }, 'no such skill'), /Basket Weaving/);
  assert.match(refuse((d) => { d.skills.minor[0] = d.skills.primary[0]; }, 'a skill twice'), /only be chosen once/);
  refuse((d) => { d.attributes.speed = 9; }, 'below the freeEdit band');
  refuse((d) => { d.attributes.speed = 76; }, 'above it');
  refuse((d) => { delete d.attributes.luck; }, 'an attribute missing');
  refuse((d) => { d.reputations.nobility = 11; }, 'past the bar');
  // AUDIT UXB1: a name is what the name box could type - no control or format characters
  const odd = good();
  odd.name = ' Spell\u202Esword\n\t\u200B ';
  assert.equal(parseCustomClassDoc(odd).value.name, 'Spellsword');
});

test('UXB1-H: the special picks pass the windows\' own gates in the windows\' order - a pick they would not take is left out and named, never loaded', () => {
  const d = customClassDoc(builtClass().c);
  d.advantages = [
    { primary: 'increasedMagery', secondary: 'intInSpellPoints2' },
    { primary: 'increasedMagery', secondary: 'intInSpellPoints3' },   // only one per character
    { primary: 'resistance', secondary: 'toFire' },
    { primary: 'flight' },                                           // no such advantage
    { primary: 'expertiseIn' },                                      // wants its weapon
    { primary: 'acuteHearing', secondary: 'loud' },                  // takes none
    { primary: 'phobia', secondary: 'undead' },                      // a disadvantage in the wrong list
  ];
  d.disadvantages = [{ primary: 'lowTolerance', secondary: 'toFire' }];   // cannot stand beside a resistance to the same
  const r = parseCustomClassDoc(d);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.advantages.map((x) => `${x.primary}/${x.secondary}`), ['increasedMagery/intInSpellPoints2', 'resistance/toFire']);
  assert.deepEqual(r.value.disadvantages, []);
  assert.deepEqual(r.skipped.map((x) => x.primary), ['increasedMagery', 'flight', 'expertiseIn', 'acuteHearing', 'phobia', 'lowTolerance']);
  // seven and no more (maxItems)
  const many = customClassDoc(builtClass().c);
  many.advantages = ['animals', 'daedra', 'humanoid', 'undead'].map((s) => ({ primary: 'bonusToHit', secondary: s }))
    .concat(['general', 'inDarkness', 'inLight', 'whileImmersed'].map((s) => ({ primary: 'regenerateHealth', secondary: s })));
  const m = parseCustomClassDoc(many);
  assert.equal(m.value.advantages.length, 7);
  assert.equal(m.skipped.length, 1);
});

test('UXB1-H: the flow\'s one door loads a class whole - derives the pool, the picks\' totals and the reputation ledger, caps the name, closes any picker - and the Create gates still stand', () => {
  const { c: src } = builtClass();
  const doc = customClassDoc(src);
  const f = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
  assert.equal(f.customImport(doc).ok, false, 'no builder open: nothing to load into');
  f.state = 'class';
  f.classListIndex = f.careers.length;
  f.useClass();
  const c = f.custom;
  c.sub = 'skillPick'; c.pickSlot = 4; c.box = [{ text: 'x' }];
  const before = JSON.stringify(c);
  const bad = f.customImport({ ...doc, hitPointsPerLevel: 99 });
  assert.equal(bad.ok, false);
  assert.equal(JSON.stringify(c), before, 'a refused file changes nothing');
  const r = f.customImport(JSON.stringify({ ...doc, name: `${'x'.repeat(40)}` }));
  assert.deepEqual(r, { ok: true, skipped: [] });
  assert.equal(c.className.length, NAME_MAX_CHARACTERS, 'the name box\'s own cap');
  assert.deepEqual(c.skills, src.skills);
  assert.deepEqual(c.stats, src.stats);
  assert.equal(c.statPool, 0, '60+60+40+40: still a balanced 400');
  assert.deepEqual(c.reps, src.reps);
  assert.equal(c.repPoints, 0, 'the ledger, derived: 2 - 1 - 1');
  assert.equal(c.advantageAdjust, 3);
  assert.equal(c.disadvantageAdjust, -5);
  assert.equal(c.sub, null); assert.equal(c.pickSlot, null); assert.equal(c.box, null);
  // an unbalanced pool loads, and Create refuses it (TEXT.RSC 302) as it would a hand-built one
  f.customImport({ ...doc, attributes: { ...doc.attributes, luck: 45 } });
  assert.equal(c.statPool, -5);
  f.applyHit({ customExit: true });
  assert.equal(f.state, 'customClass');
  assert.ok(c.box, 'refused, with the box');
  c.box = null;
  f.customImport(doc);
  f.applyHit({ customExit: true });
  assert.notEqual(f.state, 'customClass', 'the balanced class is created');
  assert.equal(f.customCareer.name, 'Spellsword');
});

test('UXB1-H: the card - Export copies the document and saves it as a named file; Import loads a paste, the clipboard or a file, and says why when it will not', async () => {
  const { flow, host, view } = builder();
  const { c: src } = builtClass();
  Object.assign(flow.custom, { className: src.className, hp: src.hp, skills: [...src.skills], stats: { ...src.stats }, reps: { ...src.reps } });
  view.repaint();
  let clip = '';
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (t) => { clip = t; }, readText: async () => clip } } });
  const made = [];
  const create = globalThis.document.createElement;
  globalThis.document.createElement = (t) => { const n = create(t); made.push(n); return n; };
  const settle = () => new Promise((r) => setImmediate(r));
  try {
    buttonNamed(host, 'Export').click();
    const card = () => byClass(host, 'classio')[0];
    assert.ok(card(), 'the export card');
    buttonNamed(card(), 'Copy to clipboard').click();
    await settle();
    assert.deepEqual(JSON.parse(clip), customClassDoc(flow.custom), 'the clipboard holds the document');
    assert.match(text(byClass(host, 'classio-note')[0]), /Copied/);
    // the file's name is the class's
    assert.equal(classFileName('Spellsword'), `spellsword${CLASS_FILE_EXT}`);
    assert.equal(classFileName('Night Blade!'), `night-blade${CLASS_FILE_EXT}`);
    assert.equal(classFileName(''), `custom-class${CLASS_FILE_EXT}`);
    assert.equal(classFileName('???'), `custom-class${CLASS_FILE_EXT}`);

    // Import: a paste the file law refuses says so, and loads nothing
    buttonNamed(host, 'Import').click();
    const field = byClass(host, 'classio-text')[0];
    assert.ok(field, 'a box to paste into');
    field.value = '{"format":"nope"}';
    buttonNamed(card(), 'Load').click();
    assert.match(text(byClass(host, 'classio-note')[0]), /not a Daggerfall Enhanced class file/);
    assert.equal(flow.custom.className, 'Spellsword');
    // the clipboard's class loads, and the card closes on it
    clip = JSON.stringify({ ...JSON.parse(clip), name: 'Battlemage' });
    buttonNamed(card(), 'Paste from clipboard').click();
    await settle();
    assert.equal(flow.custom.className, 'Battlemage');
    assert.equal(byClass(host, 'classio').length, 0, 'loaded: the card goes');
    // and a file
    buttonNamed(host, 'Import').click();
    made.length = 0;
    buttonNamed(card(), 'Open a file').click();
    const input = made.find((n) => n.tagName === 'INPUT' && n.type === 'file');
    assert.ok(input, 'a file picker');
    assert.match(input.accept, new RegExp(CLASS_FILE_EXT.replace('.', '\\.')));
    input.files = [{ text: async () => JSON.stringify({ ...JSON.parse(clip), name: 'Witchhunter' }) }];
    await input.onchange();
    assert.equal(flow.custom.className, 'Witchhunter');
    // the card is the builder's: leaving the builder takes it away
    buttonNamed(host, 'Import').click();
    assert.equal(byClass(host, 'classio').length, 1);
    flow.state = 'classMethod';
    view.repaint();
    flow.state = 'customClass';
    view.repaint();
    assert.equal(byClass(host, 'classio').length, 0);
  } finally {
    globalThis.document.createElement = create;
    if (nav) Object.defineProperty(globalThis, 'navigator', nav); else delete globalThis.navigator;
  }
});

// ── J: 16:9 WITHOUT SCROLLING ────────────────────────────────────

test('UXB1-J: the builder\'s DOM keeps the phone\'s reading order and the desk places it in three columns; the long lists take the width a desk has, on a fine pointer only', () => {
  const { host } = builder();
  const wrap = byClass(host, 'builder')[0];
  const order = wrap.children.map((n) => n.className.split(/\s+/).find((x) => /^b-/.test(x)));
  assert.deepEqual(order, ['b-name', 'b-skills', 'b-attrs', 'b-class', 'b-acts'], 'name, skills, attributes, class, acts');
  const desk = ENHANCED_CSS.slice(ENHANCED_CSS.indexOf('@media (min-width: 1100px) and (pointer: fine) {'));
  assert.ok(desk.length > 0, 'the desk block');
  const block = desk.slice(0, desk.indexOf('\n}\n'));
  assert.match(block, /\.skillpane\.builder \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(block, /grid-template-areas: "skills attrs name" "skills attrs klass" "skills attrs acts" "io io io";/);
  assert.match(block, /\.wizard \.stagebody > \.list\.classlist \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(block, /\.wizard \.skillpane\.skills3 \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(block, /\.wizard \.reviewgrid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.doesNotMatch(block, /pointer: coarse/, 'the finger keeps its 44px floor');
  const view = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  assert.match(view, /const list = el\('div', 'list classlist'\);/);
  assert.match(view, /const wrap = el\('div', 'skillpane skills3'\);/);
});

test('UXB1-J: the review is three columns - the attributes, the primary and major skills, the minor ones', () => {
  const flow = new ChargenFlow([{ name: 'Mage', career: CAREER }], () => 0);
  flow.biogFor = () => ({ backstoryId: 0, questions: [{ text: ['Q1', ''], answers: [{ text: 'a', effects: [] }] }] });
  const host = new Node_('div');
  const view = mountEnhancedChargen(host, { flow, onExit() {} });
  flow.input('confirm'); flow.input('confirm'); flow.input('char:m'); flow.input('confirm'); flow.input('confirm');
  if (flow.state === 'class' && flow.classConfirm) flow.applyHit({ confirmClass: true });
  if (flow.state === 'bioMethod') { flow.input('down'); flow.input('confirm'); }
  if (flow.state === 'biography') { flow.answerBiography(0); if (flow.biogRepBox) flow.input('confirm'); }
  flow.state = 'summary';
  view.repaint();
  const [grid] = byClass(host, 'reviewgrid');
  assert.ok(grid, 'the review grid');
  const cols = byClass(grid, 'reviewcol');
  assert.equal(cols.length, 3);
  const heads = cols.map((col) => byClass(col, 'skillhead').map((h) => text(byClass(h, 'skillk')[0])));
  assert.deepEqual(heads, [['Attributes'], ['Primary', 'Major'], ['Minor']]);
});
