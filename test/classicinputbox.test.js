// CM3 - SHARED DAGGERFALL INPUT MESSAGE BOX.
// Pins the modal itself and the first retired inline field: Item Maker rename.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputMessageBoxWindow, DEFAULT_INPUT_MAX } from '../src/ui/inputMessageBox.js';
import { ItemMakerWindow, MAX_ITEM_NAME, ENTER_NEW_NAME } from '../src/ui/itemMakerWindow.js';

const icons = () => ({
  getTexture: async () => ({ recordCount: 0 }),
  uploadRecord() {},
  textures: new Map(),
});

const maker = () => {
  const item = { group: 'Gems', templateIndex: 0, name: 'Ruby' };
  const player = { items: [item], goldPieces: 0 };
  const w = new ItemMakerWindow({
    packItems: () => player.items,
    player,
    entity: player,
    icons: icons(),
  });
  w._selectItem(item);
  return { w, item };
};

test('CM3: input box defaults to DFU TextBox max 31 and consumes background clicks without closing', () => {
  const box = new InputMessageBoxWindow({ label: 'Name: ' });
  assert.equal(DEFAULT_INPUT_MAX, 31);
  assert.equal(box.maxCharacters, 31);
  assert.equal(box.click(), true);
  assert.equal(box.done, false, 'DaggerfallInputMessageBox is modal, not ClickAnywhereToClose');
});

test('CM3: input box reads both overlay action chars and raw keyboard chars, with the fixed cap', () => {
  const box = new InputMessageBoxWindow({ maxCharacters: 3 });
  box.input('char:a');
  box.input('KeyB', { key: 'B' });
  box.input('Digit7');
  box.input('char:z');
  assert.equal(box.value, 'aB7', 'the fourth character is rejected at MaxCharacters');
  box.input('Backspace');
  assert.equal(box.value, 'aB');
});

test('CM3: numeric input filters non-digits and Return submits after closing', () => {
  const events = [];
  const box = new InputMessageBoxWindow({
    value: '0', maxCharacters: 8, numeric: true,
    onSubmit: (value) => events.push(['submit', value, box.done]),
    onCancel: () => events.push(['cancel']),
  });
  box.input('char:x');
  box.input('Digit4');
  box.input('Numpad2');
  box.input('Enter');
  assert.equal(box.value, '042');
  assert.deepEqual(events, [['submit', '042', true]], 'ReturnPlayerInputEvent closes before OnGotUserInput');
});

test('CM3: Escape cancels without delivering text', () => {
  const events = [];
  const box = new InputMessageBoxWindow({
    value: 'keep me',
    onSubmit: (v) => events.push(['submit', v]),
    onCancel: () => events.push(['cancel']),
  });
  box.input('Escape');
  assert.equal(box.done, true);
  assert.deepEqual(events, [['cancel']]);
});

test('CM3: Item Maker rename is a pushed input box seeded from the displayed item name', () => {
  const { w } = maker();
  w._openRename();
  assert.ok(w.renameBox instanceof InputMessageBoxWindow);
  assert.equal(w.renameBox.label, ENTER_NEW_NAME);
  assert.equal(w.renameBox.value, 'Ruby');
  assert.equal(w.renameBox.maxCharacters, MAX_ITEM_NAME);

  w.renameBox.value = 'The Red Ruby';
  w.renameBox.input('Enter');
  w.input('noop');   // parent notices the pushed box is done and pops it
  assert.equal(w.itemName, 'The Red Ruby');
  assert.equal(w.renameBox, null);
});

test('CM3: cancelling Item Maker rename preserves the old name', () => {
  const { w } = maker();
  w._openRename();
  w.renameBox.value = 'Discarded';
  w.renameBox.input('Escape');
  w.input('noop');
  assert.equal(w.itemName, 'Ruby');
  assert.equal(w.renameBox, null);
});
