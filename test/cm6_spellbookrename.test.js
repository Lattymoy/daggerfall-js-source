// CM6: DaggerfallSpellBookWindow renames through a pushed
// DaggerfallInputMessageBox, not through a field painted into the book.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpellbookWindow } from '../src/ui/classicSpellbook.js';
import { ENTER_SPELL_NAME } from '../src/ui/spellbookWindow.js';
import { InputMessageBoxWindow, DEFAULT_INPUT_MAX } from '../src/ui/inputMessageBox.js';

const make = () => {
  const spells = [{ name: 'Old Name', effects: [], rangeType: 0, element: 4, icon: 1 }];
  const win = new SpellbookWindow({
    spells: () => spells,
    entity: { magicka: 100 },
    castCost: () => 5,
    rows: () => [],
  });
  return { win, spells };
};

test('CM6: clicking Name pushes the shared input box seeded from the spell', () => {
  const { win, spells } = make();
  assert.equal(win.selected, spells[0]);

  win.renameButton();
  assert.ok(win.renameBox instanceof InputMessageBoxWindow);
  assert.equal(win.top, 'rename', 'the underlying book remains blocked while the child is up');
  assert.equal(win.renameBox.label, ENTER_SPELL_NAME);
  assert.equal(win.renameBox.value, 'Old Name');
  assert.equal(win.renameBox.maxCharacters, DEFAULT_INPUT_MAX);

  // A background click belongs to the modal and does not dismiss it.
  win.click(1, 1);
  assert.ok(win.renameBox);
  assert.equal(spells[0].name, 'Old Name');
});

test('CM6: Return commits the raw name through the existing rename law', () => {
  const { win, spells } = make();
  const original = spells[0];
  win.renameButton();
  win.renameBox.value = '  New Name  ';
  win.input('Enter');

  assert.equal(win.renameBox, null);
  assert.equal(win.top, null);
  assert.equal(spells[0].name, '  New Name  ', 'DFU does not trim the input');
  assert.equal(spells[0].custom, true, 'the copied record is save-persistent');
  assert.notEqual(spells[0], original, 'the shared source spell record is not mutated');
});

test('CM6: Escape cancels without changing the spell', () => {
  const { win, spells } = make();
  win.renameButton();
  win.renameBox.value = 'Discard Me';
  win.input('Escape');

  assert.equal(win.renameBox, null);
  assert.equal(win.top, null);
  assert.equal(spells[0].name, 'Old Name');
  assert.equal(spells[0].custom, undefined);
});
