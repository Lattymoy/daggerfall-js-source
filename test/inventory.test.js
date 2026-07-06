// Systems S2: stacking + weight + pickup transfer, verbatim rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStackable, stacksWith, addItem, transferAll, itemWeight, totalWeight } from '../src/systems/inventory.js';

test('inventory: the stackable rule verbatim', () => {
  assert.ok(isStackable({ group: 'Currency', name: 'Gold pieces' }));
  assert.ok(isStackable({ group: 'Weapons', name: 'Arrow', templateIndex: 131 }));
  assert.ok(isStackable({ group: 'PlantIngredients1', templateIndex: 8 }));
  assert.ok(!isStackable({ group: 'Weapons', name: 'Dagger', templateIndex: 113 }));
  assert.ok(!isStackable({ group: 'PlantIngredients1', templateIndex: 8, equipped: true }));   // never stack
  assert.ok(!isStackable({ group: 'Currency', enchanted: true }));
});

test('inventory: AddItem merges same-thing stacks, appends the rest', () => {
  const inv = [];
  addItem(inv, { group: 'Currency', name: 'Gold pieces', stackCount: 40 });
  addItem(inv, { group: 'Currency', name: 'Gold pieces', stackCount: 10 });
  assert.equal(inv.length, 1);
  assert.equal(inv[0].stackCount, 50);
  addItem(inv, { group: 'CreatureIngredients1', templateIndex: 33 });
  addItem(inv, { group: 'CreatureIngredients1', templateIndex: 33, stackCount: 2 });
  addItem(inv, { group: 'CreatureIngredients1', templateIndex: 35 });   // different template: own slot
  assert.equal(inv.length, 3);
  assert.equal(inv[1].stackCount, 3);
  const dagger = { group: 'Weapons', name: 'Dagger', templateIndex: 113, material: 0 };
  addItem(inv, dagger); addItem(inv, { ...dagger });
  assert.equal(inv.length, 5);                        // weapons never merge
  assert.ok(!stacksWith({ group: 'Currency' }, { group: 'PlantIngredients1', templateIndex: 8 }));
});

test('inventory: weight = baseWeight, weapons x material/4; transfer empties the source', () => {
  // Dagger template 113 baseWeight 0.5 (classic); daedric x5/4
  const iron = { group: 'Weapons', name: 'Dagger', templateIndex: 113, material: 0 };
  const daedric = { group: 'Weapons', name: 'Dagger', templateIndex: 113, material: 9 };
  assert.ok(Math.abs(itemWeight(daedric) / itemWeight(iron) - 5 / 4) < 1e-9);   // multipliers [4,...,5]
  const gold = { group: 'Currency', name: 'Gold pieces', templateIndex: 0, stackCount: 3 };
  assert.ok(itemWeight(gold) >= 0);
  const corpse = [{ group: 'Currency', name: 'Gold pieces', stackCount: 7 }, { ...iron }];
  const inv = [{ group: 'Currency', name: 'Gold pieces', stackCount: 3 }];
  const n = transferAll(corpse, inv);
  assert.equal(n, 2);
  assert.equal(corpse.length, 0);
  assert.equal(inv[0].stackCount, 10);
  assert.ok(totalWeight(inv) > 0);
});
