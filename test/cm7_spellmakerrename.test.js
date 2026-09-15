// CM7: DaggerfallSpellMakerWindow names spells through a pushed
// DaggerfallInputMessageBox, not through an inline field painted into
// the maker window.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpellMakerWindow } from '../src/ui/spellMakerWindow.js';
import { ENTER_SPELL_NAME } from '../src/ui/spellbookWindow.js';
import { InputMessageBoxWindow } from '../src/ui/inputMessageBox.js';
import { MAX_SPELL_NAME } from '../src/systems/spellMaker.js';

const make = () => new SpellMakerWindow({
  entity: { maxMagicka: 100, gold: 0, goldPieces: 0 },
  rows: () => [],
});

test('CM7: Name Spell pushes the shared input box seeded from current name', () => {
  const win = make();
  win.name = 'Old Name';

  win._openNameBox();
  assert.ok(win.nameBox instanceof InputMessageBoxWindow);
  assert.equal(win.nameBox.label, ENTER_SPELL_NAME);
  assert.equal(win.nameBox.value, 'Old Name');
  assert.equal(win.nameBox.maxCharacters, MAX_SPELL_NAME);

  // The child owns pointer input. A background click does not dismiss it.
  win.click(1, 1);
  assert.ok(win.nameBox);
  assert.equal(win.name, 'Old Name');
});

test('CM7: Return commits the raw spell name', () => {
  const win = make();
  win.name = 'Old Name';
  win._openNameBox();
  win.nameBox.value = '  New Name  ';
  win.input('Enter');

  assert.equal(win.nameBox, null);
  assert.equal(win.name, '  New Name  ', 'DFU does not trim name-box input');
});

test('CM7: Escape cancels without changing the spell name', () => {
  const win = make();
  win.name = 'Old Name';
  win._openNameBox();
  win.nameBox.value = 'Discard Me';
  win.input('Escape');

  assert.equal(win.nameBox, null);
  assert.equal(win.name, 'Old Name');
});
