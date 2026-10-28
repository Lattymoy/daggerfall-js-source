// CAKE-WEIGHT (2026-10-27, the owner: "can soulcakes weight nothing since its an event item you cant get rid off"): THE
// SOUL CAKE WEIGHS NOTHING - systems/festival/festivalRows.js SOUL_CAKE_LAW_ROW, read through the producer's own mint
// (soulCake.js soulCakes, restackSoulCakes) and the pack's own scales (systems/inventory.js itemWeight, totalWeight).
// Mutant: tools/mutants/cake_weight.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soulCakes, restackSoulCakes, hearthOffering, SOUL_CAKE_ROW } from '../../../src/systems/festival/soulCake.js';
import { itemWeight, totalWeight } from '../../../src/systems/inventory.js';
import { SOUL_CAKE_LAW_ROW } from '../../../src/systems/festival/festivalRows.js';

test('CAKE-WEIGHT a Soul Cake weighs nothing - one, a stack of five hundred, and the stack the account\'s count restacks the pack to; the pack weighs what it held before the cakes (mutant: the cake\'s old 0.05 kg)', () => {
  assert.equal(SOUL_CAKE_LAW_ROW.baseWeight, 0);
  assert.equal(SOUL_CAKE_ROW.baseWeight, 0, 'the named row the game registers');
  assert.equal(itemWeight(soulCakes(1)), 0);
  assert.equal(itemWeight(soulCakes(500)), 0);
  const bowl = hearthOffering(1);
  const items = [bowl];
  const before = totalWeight(items);
  assert.equal(restackSoulCakes(items, 777), true);
  assert.equal(totalWeight(items), before, 'the cakes add nothing to the pack');
  assert.ok(before > 0, 'the Hearth Offering still weighs its own');
});
