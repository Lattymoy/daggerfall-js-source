// U4: the spellbook and death windows' pure behavior.
//
// U26 DELETED the keyed inventory window this file opened with. Its
// two laws did not go with it: the arrow exclusion is systems/equip.js's
// (pinned in test/audit18_ui_native.test.js F13, now against the
// native window), and cursor wrapping belongs to the list widgets the
// native window replaced. Nothing is left unpinned by the removal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SpellbookWindow, knownSpells,
  VAMPIRE_SPELL_TAG, LYCANTHROPY_SPELL_TAG, CANNOT_DELETE_VAMP_TEXT, CANNOT_DELETE_WERE_TEXT,
} from '../src/ui/inventory.js';

/** an entity whose book IS the window's list (the live shape:
 *  knownSpells returns entity.spells by reference) */
const book = (...spells) => {
  const entity = { magicka: 5, maxMagicka: 10, spells };
  return { entity, w: new SpellbookWindow(knownSpells(entity, null), entity, { castCost: (sp) => sp.cost }) };
};

test('spellbook: the interim known list + ready callback', () => {
  const dmg = { type: 4, subType: 0, magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  const byIndex = new Map([
    [1, { index: 1, name: 'Fireball', cost: 30, rangeType: 4, effects: [dmg] }],
    [2, { index: 2, name: 'Heal', cost: 10, rangeType: 0, effects: [{ type: 10, subType: 0 }] }],   // caster-only, non-damage: excluded
  ]);
  const list = knownSpells({ }, byIndex);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Fireball');
  // an entity WITH spells uses its own book
  const own = knownSpells({ spells: [{ index: 9, name: 'Own', cost: 5 }] }, byIndex);
  assert.equal(own[0].name, 'Own');
  let readied = null;
  const w = new SpellbookWindow(list, { magicka: 5, maxMagicka: 10 }, { ready: (sp) => { readied = sp; } });
  w.input('confirm');
  assert.equal(readied.index, 1);
  assert.ok(w.done);
  assert.equal(knownSpells({}, null).length, 0);
});

test('spellbook mgmt: delete prompts, No/Escape close the BOX not the book, Yes removes in place', () => {
  // DeleteButton_OnMouseClick:811-838 + DeleteSpellConfirm:840-852 +
  // DaggerfallEntity.DeleteSpell:767-773.
  const { entity, w } = book({ index: 1, name: 'A', cost: 5 }, { index: 2, name: 'B', cost: 5 });
  w.input('char:d');
  assert.equal(w.confirm, 'delete', 'd arms the YesNo');
  assert.equal(entity.spells.length, 2, 'nothing deleted yet');
  w.input('char:n');
  assert.equal(w.confirm, null, 'No closes the box');
  assert.equal(w.done, false, '...not the book');
  assert.equal(entity.spells.length, 2);
  w.input('char:d');
  w.input('back');
  assert.equal(w.confirm, null, 'Escape also closes just the box');
  assert.equal(w.done, false);
  // the box swallows everything that is not an answer
  w.input('char:d');
  w.input('down');
  assert.equal(w.confirm, 'delete', 'arrows do not leak through the box');
  assert.equal(w.cursor, 0);
  w.input('char:y');
  assert.deepEqual(entity.spells.map((s) => s.name), ['B'], 'Yes deletes the SELECTED spell IN PLACE');
  assert.equal(w.done, false, 'the book stays open');
  // deleting the tail clamps the selection (UpdateSelection)
  w.input('char:d'); w.input('char:y');
  assert.equal(entity.spells.length, 0);
  assert.equal(w.cursor, 0);
  w.input('char:d');
  assert.equal(w.confirm, null, 'an empty book cannot arm a delete (SelectedIndex == -1 guard)');
});

test('spellbook mgmt: the curse tags refuse BEFORE the prompt', () => {
  // DeleteButton_OnMouseClick:816-831 - "no way to get them back";
  // a plain message, no YesNo, nothing deleted. The tags are
  // PlayerEntity.cs:41-42 verbatim; INERT until vamp/lycan mint them.
  const { entity, w } = book(
    { index: 1, name: 'Bat', cost: 5, tag: VAMPIRE_SPELL_TAG },
    { index: 2, name: 'Howl', cost: 5, tag: LYCANTHROPY_SPELL_TAG },
  );
  w.input('char:d');
  assert.equal(w.notice, CANNOT_DELETE_VAMP_TEXT);
  assert.equal(w.confirm, null, 'no YesNo for a refusal');
  assert.equal(entity.spells.length, 2);
  w.input('down');
  w.input('char:d');
  assert.equal(w.notice, CANNOT_DELETE_WERE_TEXT);
  assert.equal(entity.spells.length, 2);
});

test('spellbook mgmt: u/j swap in place, bounds-guarded, and the cursor FOLLOWS the spell', () => {
  // SwapButton_OnMouseClick:872-897 + DaggerfallEntity.SwapSpells:725-732.
  const { entity, w } = book({ index: 1, name: 'A', cost: 5 }, { index: 2, name: 'B', cost: 5 }, { index: 3, name: 'C', cost: 5 });
  w.input('char:u');
  assert.deepEqual(entity.spells.map((s) => s.name), ['A', 'B', 'C'], 'up at the head is a no-op');
  assert.equal(w.cursor, 0);
  w.input('char:j');
  assert.deepEqual(entity.spells.map((s) => s.name), ['B', 'A', 'C'], 'down swaps with the next row');
  assert.equal(w.cursor, 1, 'the cursor rides the moved spell (SelectNext)');
  w.input('char:j');
  w.input('char:j');
  assert.deepEqual(entity.spells.map((s) => s.name), ['B', 'C', 'A'], 'down at the tail is a no-op');
  assert.equal(w.cursor, 2);
  w.input('char:u');
  assert.deepEqual(entity.spells.map((s) => s.name), ['B', 'A', 'C'], 'up swaps back');
  assert.equal(w.cursor, 1);
});

test('spellbook mgmt: sort confirms; alpha first, point cost when already alphabetical', () => {
  // SortButton:900-905 + SortSpellsConfirm:907-925 + DaggerfallEntity
  // SortSpellsAlpha/SortSpellsPointCost:734-752. The cost key is the
  // window's castCost - DFU's null-caster cost resolves to the
  // player's live skills, which is the same number for the player's
  // own book.
  const { entity, w } = book(
    { index: 1, name: 'Wildfire', cost: 30 },
    { index: 2, name: 'Arc Bolt', cost: 20 },
    { index: 3, name: 'Frost', cost: 10 },
  );
  w.input('char:s');
  assert.equal(w.confirm, 'sort', 's arms the YesNo (sortSpells)');
  w.input('char:n');
  assert.deepEqual(entity.spells.map((s) => s.name), ['Wildfire', 'Arc Bolt', 'Frost'], 'No sorts nothing');
  w.input('char:s'); w.input('char:y');
  assert.deepEqual(entity.spells.map((s) => s.name), ['Arc Bolt', 'Frost', 'Wildfire'], 'first sort: alpha');
  assert.equal(w.done, false, 'the book stays open');
  w.input('char:s'); w.input('char:y');
  assert.deepEqual(entity.spells.map((s) => s.name), ['Frost', 'Arc Bolt', 'Wildfire'],
    'already alphabetical: the SequenceEqual arm re-sorts by point cost');
});

test('spellbook mgmt: every mutation lands on entity.spells itself - the save envelope sees it', () => {
  // knownSpells hands back entity.spells BY REFERENCE and save.js:79
  // maps that array to SPELLS.STD indexes in order - so in-place ops
  // are the persistence story. This pin fails if the window ever
  // starts copying the list.
  const { entity, w } = book({ index: 7, name: 'B', cost: 5 }, { index: 9, name: 'A', cost: 5 });
  assert.equal(w.spells, entity.spells, 'the window list IS the book');
  w.input('char:s'); w.input('char:y');
  assert.deepEqual(entity.spells.map((s) => s.index), [9, 7], 'sort kept the array identity');
  assert.equal(w.spells, entity.spells);
  w.input('char:j');
  assert.deepEqual(entity.spells.map((s) => s.index), [7, 9], 'swap too');
  w.input('char:j');
  assert.deepEqual(entity.spells.map((s) => s.index), [7, 9], 'tail no-op');
  w.input('char:u');
  assert.deepEqual(entity.spells.map((s) => s.index), [9, 7]);
  assert.equal(w.spells, entity.spells);
});
