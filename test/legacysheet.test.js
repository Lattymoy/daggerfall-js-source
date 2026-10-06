// LEGACY-SHEET (2026-10-06, bible/06-Systems/Legacy-Arc.md section 11; Mac: "finish this to 100% completition.
// EVERYTHING"): THE HOUSE ON THE CHARACTER SHEET - the arc's last "Not built" that was the port's to build (its first
// plan: "the age and the elder's word on the character sheet"; AUDIT LEGACY F2 found it never built). The pause
// window's Stats page, Character section, draws the one played's house off their own Family card
// (ui/familyPages.js sheetHouse): the model and the generation, and in an Enduring house the age against the span,
// Arkay's toll and the elder's word - one line of age for the card and the sheet (ageWord), so they never disagree.
// Driven through the mounted pause window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass, text } from './chargenDom.mjs';
import { mountEnhancedMenu } from '../src/ui/enhancedMenu.js';
import { setFamilyProvider, sheetHouse, ageWord, SHEET_HOUSE_TEXT, resetFamilyPages } from '../src/ui/familyPages.js';
import { foundFamily, familyRng, MODELS, LEGACY_MOD } from '../src/systems/legacy/family.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { YEAR_MINUTES, spanOf } from '../src/systems/legacy/age.js';

console.warn = () => {};

const ent = () => ({
  name: 'Ysolde Hlaalu', gender: 'female', race: 'Breton', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 9, characterId: 'c-ysolde', chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)),
});
/** A house of one, the founder at `startAge` with `toll` years taken. */
function house(model, { startAge = 23, toll = 0, gen = 0 } = {}) {
  const f = foundFamily(ent(), { model, at: 0, rng: familyRng(3), id: 'fam-sheet' });
  const p = f.people[0];
  p.startAge = startAge; p.toll = toll; p.gen = gen;
  return f;
}
const provider = (f, lived = 0, on = true) => ({ on: () => on, family: () => f, lived: () => lived, switchRefusal: () => null, switchTo: () => ({ ok: false }) });

test('LEGACY-SHEET the house as the sheet says it: the model and the generation in either house; an Enduring house\'s age against the span, Arkay\'s toll, the elder\'s word and the span spent; a Bloodline counts no years; nothing with no house to show', () => {
  // nothing to show
  assert.equal(sheetHouse(null), null, 'no provider (a host with no family)');
  assert.equal(sheetHouse(provider(house(MODELS.enduring), 0, false)), null, 'Project Legacy off');
  assert.equal(sheetHouse(provider(null)), null, 'no family');
  const fallen = house(MODELS.bloodline);
  fallen.people[0].died = { at: 5, cause: 'fell' };
  assert.equal(sheetHouse(provider(fallen)), null, 'the one played fallen - the Succession\'s, not the sheet\'s');
  // an Enduring founder of 23, two years lived on their own clock
  const young = sheetHouse(provider(house(MODELS.enduring), 2 * YEAR_MINUTES));
  assert.equal(young.title, 'The House of Hlaalu');
  assert.deepEqual(young.rows, [['Model', 'Enduring'], ['Generation', '1'], ['Age', `25 of ${spanOf('Breton')}`]]);
  assert.equal(young.word, null, 'no toll taken, no elder');
  // a third generation, Arkay's toll taken
  const tolled = sheetHouse(provider(house(MODELS.enduring, { toll: 12, gen: 2 })));
  assert.deepEqual(tolled.rows, [['Model', 'Enduring'], ['Generation', '3'], ['Age', '35 of 90'], ['Arkay’s toll', '12 years']]);
  // an elder: three quarters of the span (68 of 90)
  assert.equal(sheetHouse(provider(house(MODELS.enduring, { toll: 44 }))).word, null, '67 is not yet an elder');
  assert.equal(sheetHouse(provider(house(MODELS.enduring, { toll: 45 }))).word, SHEET_HOUSE_TEXT.elder);
  // the span spent: the next death is the last
  assert.equal(sheetHouse(provider(house(MODELS.enduring, { toll: 66 }))).word, SHEET_HOUSE_TEXT.elder, '89 is an elder still');
  assert.equal(sheetHouse(provider(house(MODELS.enduring, { toll: 67 }))).word, SHEET_HOUSE_TEXT.spent);
  // a Bloodline: the house and the generation, no years
  const blood = sheetHouse(provider(house(MODELS.bloodline, { toll: 50 }), 30 * YEAR_MINUTES));
  assert.deepEqual(blood.rows, [['Model', 'Bloodline'], ['Generation', '1']]);
  assert.equal(blood.word, null);
  // the age line is the card's own
  const f = house(MODELS.enduring, { toll: 3 });
  assert.equal(ageWord(f, f.people[0], YEAR_MINUTES), '27 of 90');
  assert.equal(ageWord(house(MODELS.bloodline), house(MODELS.bloodline).people[0], 0), null);
  const dead = house(MODELS.bloodline);
  dead.people[0].died = { at: 1, cause: 'fell' };
  assert.equal(ageWord(dead, dead.people[0], 0), '23 at death', 'anyone\'s at their death');
});

/** The pause window at `at`, drawn: the Stats page's house section ({ title, rows, notes }) and the Family card's facts. */
function drawn(at) {
  const host = globalThis.document.createElement('div');
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: () => {}, at });
  const div = byClass(host, 'px-divider').find((d) => /^The House of /.test(text(d)));
  let sheet = null;
  if (div) {
    const sibs = div.parentNode.children;
    const i = sibs.indexOf(div);
    const grid = sibs[i + 1];
    const note = sibs[i + 2];
    sheet = {
      title: text(div),
      rows: byClass(grid, 'px-stat').map((r) => [text(r.children[0]), text(r.children[1])]),
      note: note && /\bpx-note\b/.test(note.className) ? text(note) : null,
    };
  }
  const card = byClass(host, 'fam-card')[0];
  const facts = {};
  if (card) {
    const grid = byClass(card, 'fam-grid')[0];
    for (let k = 0; grid && k + 1 < grid.children.length; k += 2) facts[text(grid.children[k])] = text(grid.children[k + 1]);
  }
  menu.unmount();
  return { sheet, facts };
}

test('LEGACY-SHEET the pause window\'s Stats page draws the house under the burden, the elder\'s word beneath; the Family card says the same age; no house, no section', () => {
  _resetModSettings();
  setModSetting(LEGACY_MOD, 'Enabled', true);   // the Family tab is drawn while the mod is on
  const f = house(MODELS.enduring, { toll: 45 });
  setFamilyProvider(provider(f, YEAR_MINUTES));
  resetFamilyPages();
  try {
    const { sheet } = drawn('stats');
    assert.ok(sheet, 'the section is drawn');
    assert.equal(sheet.title, 'The House of Hlaalu');
    assert.deepEqual(sheet.rows, [['Model', 'Enduring'], ['Generation', '1'], ['Age', '69 of 90'], ['Arkay’s toll', '45 years']]);
    assert.equal(sheet.note, SHEET_HOUSE_TEXT.elder);
    const { facts } = drawn('family');
    assert.equal(facts.Age, '69 of 90', 'the card and the sheet never disagree');
    assert.equal(facts['Arkay’s toll'], '45 years');
    // a Bloodline: the model and the generation, no word
    setFamilyProvider(provider(house(MODELS.bloodline)));
    const blood = drawn('stats').sheet;
    assert.deepEqual(blood.rows, [['Model', 'Bloodline'], ['Generation', '1']]);
    assert.equal(blood.note, null);
    // no house: no section
    setFamilyProvider(null);
    assert.equal(drawn('stats').sheet, null);
  } finally {
    setFamilyProvider(null);
    resetFamilyPages();
    _resetModSettings();
  }
});
