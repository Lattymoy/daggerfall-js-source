// QUICK-LOOT-STATS (2026-09-22, a player relayed by Mac: "i love the
// quick loot but can it show the stats of the items next to the
// quickloot window? So i dont have to pick up everything to check in my
// inventory if its worth keeping").
//
// THE ARC WAS ONLY HALF MOVED. Arc A said what a pile HELD, Arc B let
// you take it - so "is this worth stopping for" could be answered under
// the crosshair while "is this better than what I am wearing" still
// cost a pickup, a menu and a drop. This closes that, and the player
// found the gap in a day.
//
// DRIVEN, NOT GREPPED - quickloot.test.js's own lesson, stated there:
// a 24-mutant campaign over source-text pins killed two and let
// twenty-two live, "which is the honest measure of what a source sweep
// proves: that a line is PRESENT, never that it works." So the numbers
// are computed from real items, the SIDE is computed at real window
// widths, and the sheet is read for the rules the layout depends on.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { itemStatRows, weaponDamageString, armourModString, conditionWord, conditionPercentage } from '../src/systems/itemInfo.js';
import { hoverLines, HOVER_MAX } from '../src/systems/worldHover.js';
import { foldQuickLoot, quickLootStats, quickLootWheel, resetQuickLoot, quickLootOn } from '../src/systems/quickLoot.js';
import { statsSide } from '../src/ui/worldPlaque.js';
import { readFileSync } from 'node:fs';
import { TEMPLATE, SURVIVAL_GROUP } from '../src/systems/survival/food.js';   // a real survival item, not a shape that looks like one
import { ENHANCED_CSS, PLAQUE_MAX_W, STATS_W, STATS_GAP, STATS_MARGIN } from '../src/ui/enhancedStyle.js';

const sword = (extra = {}) => ({ name: 'Dagger', group: 'Weapons', templateIndex: 121, material: 3, maxCondition: 200, currentCondition: 150, ...extra });
const mail = (extra = {}) => ({ name: 'Cuirass', group: 'Armor', templateIndex: 103, material: 0x0202, maxCondition: 100, currentCondition: 100, ...extra });
const frameOf = (key, items) => {
  const { shown, rest, empty } = hoverLines(items);
  return { key, kind: 'items', title: 'Loot Pile', subs: [], rows: shown, rest, empty };
};

test('QUICK-LOOT-STATS: the rows are the numbers a player picks a weapon by, from the SAME producers the pack reads', () => {
  const it = sword();
  const rows = itemStatRows(it);
  const by = Object.fromEntries(rows.map((r) => [r.label, r.text]));

  // Not a fixture of expected strings: the SAME functions the classic
  // popup's macro pass and the enhanced detail card call, so a change
  // to the damage formula moves this row with them rather than
  // reddening here while the pack quietly says something else.
  assert.equal(by.Damage, weaponDamageString(it));
  assert.equal(by.Hands, 'One-handed');
  assert.equal(by.Condition, `${conditionWord(it)} (${conditionPercentage(it)}%)`);
  assert.ok(by.Weight?.endsWith(' kg'));
  assert.equal(by.Armour, undefined, 'a weapon has no armour row');

  const armourRows = Object.fromEntries(itemStatRows(mail()).map((r) => [r.label, r.text]));
  assert.equal(armourRows.Armour, armourModString(mail()));
  assert.equal(armourRows.Damage, undefined, 'and armour has no damage row');
  assert.equal(armourRows.Hands, undefined);

  // NOTHING TO SAY DRAWS NOTHING - a caller shows no panel rather than
  // an empty box.
  assert.deepEqual(itemStatRows(null), []);
});

test('QUICK-LOOT-STATS: the CONDITIONAL rows are tested on the items they are conditional about', () => {
  // Two mutants walked through the first draft of this file because it
  // only ever looked at a weapon and a cuirass - and both of the rows
  // that ASK a question about the item are invisible on those two.

  // MATERIAL is a Weapons/Armor row. A book has a `material` field like
  // everything else and `materialName` would happily answer 'Iron' for
  // it, which is a number about an item that has no material at all.
  const book = { name: 'A Dubious Tome', group: 'Books', templateIndex: 87, material: 0 };
  const bookRows = itemStatRows(book).map((r) => r.label);
  assert.ok(!bookRows.includes('Material'), 'a book has no material to name');
  assert.ok(bookRows.includes('Weight'), '...but it still weighs something');

  // A SURVIVAL item answers in its own tokens and NOT with a condition:
  // AUDIT SURV C's rule, which the enhanced card already follows -
  // "Condition New 100%" on a stale loaf beside "25 uses left" is two
  // words for one thing, and the uses ARE the condition field.
  const bread = { name: 'Bread', group: SURVIVAL_GROUP, templateIndex: TEMPLATE.Bread, maxCondition: 100, currentCondition: 100 };
  const breadRows = itemStatRows(bread);
  assert.ok(!breadRows.some((r) => r.label === 'Condition'), 'a loaf does not wear a condition word');
  assert.ok(breadRows.some((r) => r.label === '' && /Nourishes/.test(r.text)), 'it says what it is FOR instead');
  assert.ok(breadRows.some((r) => r.label === 'Weight'));
  // And the sentence rows are LABEL-LESS on purpose, so the draw can
  // tell a sentence from a pair.
  assert.ok(breadRows.filter((r) => r.label === '').length > 0);
});

test('QUICK-LOOT-STATS: the weight is the STACK\'s, because that is what the player is deciding about', () => {
  const one = itemStatRows(sword())?.find((r) => r.label === 'Weight')?.text;
  const twenty = itemStatRows(sword({ stackCount: 20 }))?.find((r) => r.label === 'Weight')?.text;
  assert.notEqual(one, twenty, 'twenty daggers do not weigh what one does');
  assert.equal(parseFloat(twenty), parseFloat(one) * 20);
});

test('QUICK-LOOT-STATS: the panel describes the row that is LIT, and follows the wheel', () => {
  resetQuickLoot();
  assert.ok(quickLootOn(), 'the fixture runs with the feature on');
  const items = [sword({ name: 'Dagger' }), mail({ name: 'Cuirass' })];
  const f = frameOf('loot:1', items);

  foldQuickLoot(f);
  const top = quickLootStats(f);
  assert.ok(top.some((r) => r.label === 'Damage'), 'row 0 is the weapon, so it has a damage row');
  assert.ok(!top.some((r) => r.label === 'Armour'));

  // The wheel moves the highlight; the panel must move with it, or the
  // player reads one item's numbers while looking at another's name -
  // which is worse than no panel at all.
  assert.equal(quickLootWheel(1), true, 'the plaque owns the wheel while it is listing');
  foldQuickLoot(f);
  const next = quickLootStats(f);
  assert.ok(next.some((r) => r.label === 'Armour'), 'row 1 is the armour');
  assert.ok(!next.some((r) => r.label === 'Damage'));

  // Nothing lit, nothing said: look at a door and the panel is gone.
  resetQuickLoot();
  const door = { key: 'door:1', kind: 'name', title: 'Door', subs: [], rows: [], rest: 0, empty: false };
  foldQuickLoot(door);
  assert.deepEqual(quickLootStats(door), []);

  // THE CASE THE ROW GUARD IS ACTUALLY FOR, and the one a mutant walked
  // through: a selection that belongs to ANOTHER pile. The door above
  // has no rows at all, so an unguarded read finds nothing either way
  // and proves nothing. Here the highlight is pile A's while the frame
  // in hand is pile B's - `selectedRow` answers -1, and without the
  // guard the panel would describe row -1 of a list that HAS rows.
  resetQuickLoot();
  foldQuickLoot(frameOf('loot:A', items));
  const other = frameOf('loot:B', [mail({ name: 'Someone else\'s cuirass' })]);
  assert.ok(other.rows.length > 0, 'the other pile really does have rows');
  assert.deepEqual(quickLootStats(other), [],
    'a highlight is about ONE pile - it describes nothing in another');
  resetQuickLoot();
});

test('QUICK-LOOT-STATS: the row carries its ITEM, and the tail row carries none', () => {
  // The panel reads the item off the row rather than walking the pile a
  // second time - two walks is two chances for the row SEEN and the row
  // DESCRIBED to disagree.
  const items = Array.from({ length: HOVER_MAX + 3 }, (_, i) => sword({ name: `Dagger ${i}` }));
  const { shown, rest } = hoverLines(items);
  assert.equal(shown.length, HOVER_MAX);
  assert.equal(rest, 3);
  for (let i = 0; i < shown.length; i++) assert.equal(shown[i].item, items[i], `row ${i} carries its own item`);

  // The "and 3 more" tail is not a row, so there is nothing under it to
  // describe - the same bound `hoverItemAt` already holds for the take.
  resetQuickLoot();
  const f = frameOf('loot:2', items);
  foldQuickLoot(f);
  for (let i = 0; i < HOVER_MAX - 1; i++) { quickLootWheel(1); foldQuickLoot(f); }
  assert.ok(quickLootStats(f).length > 0, 'the last real row still describes itself');
  quickLootWheel(1); foldQuickLoot(f);   // clamped, never onto the tail
  assert.ok(quickLootStats(f).length > 0, 'and the wheel cannot fall off the end onto the tail');
  resetQuickLoot();
});

test('QUICK-LOOT-STATS: the side is decided by arithmetic at real widths, and the sheet agrees with it', () => {
  // "Next to" has to mean next to on every screen, not on the author's.
  const need = PLAQUE_MAX_W / 2 + STATS_GAP + STATS_W + STATS_MARGIN;
  assert.equal(statsSide(640, 1280), 'right', 'the middle of a desktop has room on the reading side');
  assert.equal(statsSide(1280 - need + 1, 1280), 'left', 'hard against the right edge it flips');
  assert.equal(statsSide(180, 360), 'below', 'a phone fits nothing beside anything');
  // The boundary itself, both sides of it - an off-by-one here is a
  // panel exactly one pixel off the screen.
  assert.equal(statsSide(1280 - need, 1280), 'right');
  assert.equal(statsSide(need, 2 * need - 1), 'left');
  // A window that has not reported itself yet is not guessed at.
  assert.equal(statsSide(640, 0), 'below');
  assert.equal(statsSide(NaN, 1280), 'below');

  // THE SHEET AND THE ARITHMETIC ARE ONE SOURCE. If the CSS width and
  // the number this reasons with ever part, the panel is laid out
  // against a width it is not drawn at.
  const css = ENHANCED_CSS;
  assert.ok(new RegExp('\\.wplaque-stats \\{[^}]*width: ' + STATS_W + 'px').test(css), 'the drawn width is the computed one');
  assert.ok(new RegExp('\\.wplaque \\{[^}]*max-width: ' + PLAQUE_MAX_W + 'px').test(css), "and the plaque's own max-width");
  assert.ok(css.includes('[data-side="right"] { left: calc(100% + ' + STATS_GAP + 'px)'), 'right rides the gap');
  assert.ok(css.includes('[data-side="left"] { right: calc(100% + ' + STATS_GAP + 'px)'), 'left rides the same gap');
  // BELOW is not a broken 'right': it leaves the absolute flow rather
  // than hanging off an edge it was told not to use.
  assert.match(css, /\[data-side="below"\] \{ position: static;/);

  // ...AND THE TWO CANNOT PART, which the four lines above do NOT hold:
  // they compare the sheet against the very constant the sheet is built
  // from, so they agree by construction and a mutant that widened the
  // panel sailed through all of them. A pin asserting the wiring as it
  // is always agrees with it. What has to be true is that the sheet
  // INTERPOLATES the constant rather than restating the number - the
  // only shape in which one edit cannot move the drawing without
  // moving the arithmetic.
  const sheet = readFileSync('src/ui/enhancedStyle.js', 'utf8');
  assert.match(sheet, /\.wplaque-stats \{[^}]*width: \$\{STATS_W\}px/, 'the drawn width IS the constant, not a copy of it');
  assert.match(sheet, /max-width: \$\{PLAQUE_MAX_W\}px/, 'and so is the plaque\'s own');
  assert.match(sheet, /\[data-side="right"\] \{ left: calc\(100% \+ \$\{STATS_GAP\}px\)/);
  assert.match(sheet, /\[data-side="left"\] \{ right: calc\(100% \+ \$\{STATS_GAP\}px\)/);
  // A MUTANT THAT WIDENED THE PANEL (190 -> 220) WAS WITHDRAWN RATHER
  // THAN KILLED, and the reason belongs here. It survives every pin in
  // this file and it should: the sheet interpolates the constant and
  // the arithmetic reads the same constant, so re-tuning the width
  // moves the drawing AND the layout decision together and the panel is
  // still laid out against the width it is drawn at. That is the whole
  // property this test is for, working. Pinning the literal 190 would
  // not be holding a law - it would be freezing a number nobody
  // decided, and the next person to nudge it would delete the pin.
});
