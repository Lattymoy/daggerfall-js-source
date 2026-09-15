// CM5 follow-up: DaggerfallInventoryWindow.TransferItem does not open
// the quantity field only when capacity forces a partial move. Holding
// either Control key forces the same DaggerfallInputMessageBox for a
// whole stack, with the field seeded to "0" rather than maxAmount.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeInventoryWindow, HOW_MANY_ITEMS, SPLIT_INPUT_MAX } from '../src/ui/classicInventory.js';

const stack = () => ({
  group: 'Weapons', templateIndex: 113, name: 'Dagger', stackCount: 5,
});

const windowFor = (bag) => {
  const w = new NativeInventoryWindow({ items: () => bag, icons: {} });
  w.mode = 'remove';
  // Keep this pin about TransferItem's modal seam rather than tab
  // classification. The live scroller hands _pick exactly this row.
  w._filtered = () => bag;
  return w;
};

test('CM5: held Control forces the quantity popup even when the whole stack fits', () => {
  const bag = [stack()];
  const w = windowFor(bag);

  w.input('ControlLeft', { code: 'ControlLeft', key: 'Control' });
  assert.equal(w._controlDown, true, 'Input.GetKey(Control) state rises on the down edge');
  w._pick(0);

  assert.ok(w.splitBox, 'a whole-stack move is intercepted while Control is held');
  assert.equal(w.splitBox.label, HOW_MANY_ITEMS(5));
  assert.equal(w.splitBox.maxCharacters, SPLIT_INPUT_MAX);
  assert.equal(w.splitBox.numeric, true);
  assert.equal(w.splitBox.value, '0', 'DFU seeds a Control-forced field with "0"');
  assert.equal(bag[0].stackCount, 5, 'opening the modal moves nothing');
  assert.equal(w.dropped.length, 0);

  // Enter on the seeded zero closes the popup and SplitStack performs
  // no move, matching SplitStack(0) -> null in DFU.
  w.input('Enter');
  assert.equal(w.splitBox, null);
  assert.equal(bag[0].stackCount, 5);
  assert.equal(w.dropped.length, 0);
});

test('CM5: the key-up edge clears the Control force before the next click', () => {
  const bag = [stack()];
  const w = windowFor(bag);
  w.input('ControlRight', { code: 'ControlRight', key: 'Control' });
  w.keyup('ControlRight', { code: 'ControlRight', key: 'Control' });
  assert.equal(w._controlDown, false);

  // With no capacity split and no Control state, the wrapper must not
  // invent a modal. The audited base window handles the whole move.
  w._pick(0);
  assert.equal(w.splitBox, null);
  assert.equal(bag.length, 0, 'the whole stack moved normally');
  assert.equal(w.dropped.length, 1);
});
