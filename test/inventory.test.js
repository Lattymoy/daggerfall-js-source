// Systems S2: stacking + weight + pickup transfer, verbatim rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStackable, stacksWith, addItem, transferAll, itemWeight, totalWeight, weightForMaterial } from '../src/systems/inventory.js';

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

test('inventory: CalculateWeightForMaterial verbatim (quarter-kg + banker rounding); transfer empties the source', () => {
  // Dagger (0.5 kg): iron trunc(2)*4/4=2 -> 0.5; daedric 2*5/4=2.5,
  // Round half-to-EVEN banks to 2 -> ALSO 0.5 (the source's quirk).
  const iron = { group: 'Weapons', name: 'Dagger', templateIndex: 113, material: 0 };
  const daedric = { group: 'Weapons', name: 'Dagger', templateIndex: 113, material: 9 };
  assert.equal(itemWeight(iron), 0.5);
  assert.equal(itemWeight(daedric), 0.5);
  // heavier piece shows the multiplier: 6 kg -> 24 quarters; dwarven
  // (x3) 24*3/4=18 -> 4.5; daedric (x5) 30 -> 7.5
  assert.equal(weightForMaterial(6, 4), 4.5);
  assert.equal(weightForMaterial(6, 9), 7.5);
  // leather: Round(INT(w*4)/2)/4 - 6 kg -> trunc 24 /2 = 12 -> 3
  assert.equal(itemWeight({ group: 'Armor', templateIndex: 999, material: 0x0000 }) , 0);   // unknown template -> 0 base

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

test('containers: the verbatim house-container predicate (S2b)', async () => {
  const { isHouseContainerModel, containerTextureRecord } = await import('../src/systems/containers.js');
  assert.ok(isHouseContainerModel(41800));   // 418xx group
  assert.ok(isHouseContainerModel(41851));
  assert.ok(isHouseContainerModel(41003));   // offset list: 3
  assert.ok(isHouseContainerModel(41051));   // 51
  assert.ok(!isHouseContainerModel(41005));  // 5 is a SHOP shelf, not a house container
  assert.ok(!isHouseContainerModel(41409));  // the ladder
  assert.equal(containerTextureRecord(41837), 37);
});
