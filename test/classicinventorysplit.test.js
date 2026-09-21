// CM5 - DaggerfallInventoryWindow partial-stack input popup.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeInventoryWindow, HOW_MANY_ITEMS, SPLIT_INPUT_MAX } from '../src/ui/nativeInventory.js';
import { InputMessageBoxWindow } from '../src/ui/inputMessageBox.js';
import { totalWeight } from '../src/systems/inventory.js';

const book = (n = 1) => ({ group: 'Books', templateIndex: 277, name: 'Book', stackCount: n });
const icons = () => ({
  getTexture: async () => ({ recordCount: 0 }),
  uploadRecord() {}, textures: new Map(),
});
const windowFor = (bag, entity = { stats: { strength: 100 }, items: bag }) =>
  new NativeInventoryWindow({
    items: () => bag,
    entity,
    icons: icons(),
    wagonItems: () => [],
  });

test('CM5: a wagon partial fit opens numeric DaggerfallInputMessageBox defaulted to maxAmount', () => {
  const bag = [book(400)];
  const wagon = [];
  const w = windowFor(bag);
  w.usingWagon = true;
  w._filtered = () => bag;
  w._remote = () => wagon;

  w._pick(0, 'remove');
  assert.ok(w.inputBox instanceof InputMessageBoxWindow);
  assert.equal(w.inputBox.label, HOW_MANY_ITEMS(375));
  assert.equal(w.inputBox.value, '375');
  assert.equal(w.inputBox.numeric, true);
  assert.equal(w.inputBox.maxCharacters, SPLIT_INPUT_MAX);
  assert.equal(totalWeight(wagon), 0, 'nothing moves before the prompt is submitted');

  w.inputBox.value = '10';
  w.inputBox.input('Enter');
  w.input('noop');
  assert.equal(w.inputBox, null);
  assert.equal(bag[0].stackCount, 390);
  assert.equal(wagon.length, 1);
  assert.equal(wagon[0].stackCount, 10);
});

test('CM5: remote carry-limit partial fit prompts before taking anything', () => {
  const bag = [];
  const pile = [book(100)];
  const entity = { stats: { strength: 50 }, items: bag, goldPieces: 0 };
  const w = windowFor(bag, entity);
  w._remote = () => pile;

  w._pickRemote(0, 'remove');
  assert.ok(w.inputBox instanceof InputMessageBoxWindow);
  assert.equal(w.inputBox.value, '37', '75kg carry limit / 2kg book = 37 max');
  assert.equal(pile[0].stackCount, 100);
  assert.equal(bag.length, 0);

  w.inputBox.value = '5';
  w.inputBox.input('Enter');
  w.input('noop');
  assert.equal(pile[0].stackCount, 95);
  assert.equal(bag.length, 1);
  assert.equal(bag[0].stackCount, 5);
});

test('CM5: an invalid split amount closes the popup and transfers nothing', () => {
  const bag = [book(400)];
  const wagon = [];
  const w = windowFor(bag);
  w.usingWagon = true;
  w._filtered = () => bag;
  w._remote = () => wagon;
  w._pick(0, 'remove');
  w.inputBox.value = '376';
  w.inputBox.input('Enter');
  w.input('noop');
  assert.equal(bag[0].stackCount, 400);
  assert.equal(wagon.length, 0);
});

test('CM5: a whole-stack transfer does not invent a split popup', () => {
  const bag = [book(3)];
  const ground = [];
  const w = windowFor(bag);
  w._filtered = () => bag;
  w._remote = () => ground;
  w._pick(0, 'remove');
  assert.equal(w.inputBox, null);
  assert.equal(bag.length, 0);
  assert.equal(ground.length, 1);
  assert.equal(ground[0].stackCount, 3);
});
