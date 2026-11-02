// KEY-WEIGHT (2026-10-31, Mac: "Remove weight from weir keys"): THE WEIR KEY WEIGHS NOTHING - systems/eliteGates/
// weirKeyRow.js WEIR_KEY_LAW_ROW, read through the producer's own mint (weirKey.js weirKeys, restackWeirKeys) and the
// pack's own scales (systems/inventory.js itemWeight, totalWeight). Mutant: tools/mutants/key_weight.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weirKeys, restackWeirKeys, WEIR_KEY_ROW, _resetWeirKeyFacesForTests } from '../../../src/systems/eliteGates/weirKey.js';
import { WEIR_KEY_LAW_ROW } from '../../../src/systems/eliteGates/weirKeyRow.js';
import { itemWeight, totalWeight } from '../../../src/systems/inventory.js';

test('KEY-WEIGHT a Weir Key weighs nothing - one, a stack of fifty, and the stack the account\'s balance restacks the pack to (mutant: the key\'s old 0.25 kg)', () => {
  _resetWeirKeyFacesForTests();
  assert.equal(WEIR_KEY_LAW_ROW.baseWeight, 0);
  assert.equal(WEIR_KEY_ROW.baseWeight, 0, 'the named row the game registers');
  assert.equal(itemWeight(weirKeys(1)), 0);
  assert.equal(itemWeight(weirKeys(50)), 0);
  const items = [];
  assert.equal(restackWeirKeys(items, 12), true);
  assert.equal(items[0].stackCount, 12);
  assert.equal(totalWeight(items), 0, 'the keys add nothing to the pack');
});
