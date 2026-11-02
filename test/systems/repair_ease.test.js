// REPAIR-EASE (2026-09-30, Mac: "nerf repair costs", "instant repair on by default", "Add repair items you can find by
// looting"). Every repair costs two thirds of Daggerfall's price; the port's InstantRepairs default is on; and a Field
// Repair Kit - any metal, 15% - turns up in dungeon piles (keys J-O) and on foes that carry loot.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateItemRepairCost, dfuItemRepairCost, REPAIR_COST_SCALE } from '../../src/systems/repairService.js';
import { PORT_DEFAULTS } from '../../src/systems/settings/settings.js';
import {
  mintFieldRepairKit, useRepairKit, repairKitUse, kitMends, FIELD_KIT, maybeAddFieldKit, installSmithing,
  FIELD_KIT_PILE_CHANCE, FIELD_KIT_ENEMY_CHANCE,
} from '../../src/systems/smithItems.js';
import { FIELD_KIT_REPAIR, KIT_REPAIR, REPAIR_KIT_TEMPLATE, pieceLines } from '../../src/net/recipeLaw.js';
import { addPileLootExtras, addEnemyLootExtras } from '../../src/systems/loot/loot.js';
import { validItemField } from '../../src/systems/item/itemFields.js';

test('REPAIR-EASE, REPAIR-RATE: a repair costs a THIRD of Daggerfall\'s price (REPAIR-EASE\'s two thirds until REPAIR-RATE, repair_rate.test.js), rounded, never under 1 - and nothing at full condition', () => {
  assert.equal(REPAIR_COST_SCALE, 1 / 3);
  for (const [value, q, cond, max] of [[300, 10, 500, 1000], [1000, 20, 1, 100], [40, 5, 10, 100], [5, 1, 0, 100]]) {
    const dfu = dfuItemRepairCost(value, q, cond, max, { instantRepairs: false });
    assert.equal(calculateItemRepairCost(value, q, cond, max, { instantRepairs: false }), Math.max(1, Math.round(dfu / 3)), `${value}/${q}`);
  }
  assert.equal(calculateItemRepairCost(300, 10, 1000, 1000), 0, 'free at full condition');
  assert.equal(calculateItemRepairCost(300, 10, 500, 1000, { reducedRepairCost: () => 0 }), 0, 'a guild\'s free repair stays free');
});

test('REPAIR-EASE: InstantRepairs is the port\'s default', () => {
  assert.equal(PORT_DEFAULTS.Controls.InstantRepairs, 'True');
});

const sword = (material, cond = 20, max = 100) => ({ group: 'Weapons', material, currentCondition: cond, maxCondition: max });
const plate = (m, cond = 30) => ({ group: 'Armor', material: 0x0200 + m, currentCondition: cond, maxCondition: 100 });

test('REPAIR-EASE: a Field Repair Kit mends ANY metal\'s weapon or armour by 15%, the most worn first, and is spent', () => {
  const kit = mintFieldRepairKit();
  assert.equal(kit.templateIndex, REPAIR_KIT_TEMPLATE);
  assert.equal(kit.name, 'Field Repair Kit');
  assert.equal(kit.fieldKit, true);
  assert.equal(kit.kitMetal, undefined, 'no metal - so no dye');
  assert.equal(FIELD_KIT_REPAIR, 0.15);
  assert.ok(FIELD_KIT_REPAIR < KIT_REPAIR, 'less than a smith\'s kit');
  assert.ok(kitMends(FIELD_KIT, sword(9)) && kitMends(FIELD_KIT, plate(5)) && !kitMends(FIELD_KIT, { group: 'MensClothing', maxCondition: 10 }));
  const daedric = sword(9, 50), ebonyPlate = plate(7, 10);
  const items = [kit, daedric, ebonyPlate];
  const done = useRepairKit(kit, items);
  assert.equal(done.item, ebonyPlate, 'the most worn');
  assert.equal(ebonyPlate.currentCondition, 25);
  assert.ok(!items.includes(kit), 'spent');
  const none = mintFieldRepairKit();
  assert.equal(repairKitUse(none, [none, sword(1, 100)]).text, 'Nothing here wants mending.');
  assert.deepEqual(pieceLines(kit), ['Mends 15% of a weapon\'s or armor\'s condition, up to 75%, once'], 'KIT-CEILING');
  assert.equal(validItemField('fieldKit', true), true);
});

test('REPAIR-EASE: field kits turn up in dungeon piles J-O and on looting foes, at their chances', () => {
  installSmithing();
  const kits = (items) => items.filter((it) => it.fieldKit === true).length;
  assert.equal(FIELD_KIT_PILE_CHANCE, 6);
  assert.equal(FIELD_KIT_ENEMY_CHANCE, 3);
  const always = () => 0, never = () => 0.999;
  assert.equal(kits(addPileLootExtras([], 'J', always, { online: false })), 1, 'a J pile');
  assert.equal(kits(addPileLootExtras([], 'O', always, { online: false })), 1, 'an O pile');
  assert.equal(kits(addPileLootExtras([], 'A', always, { online: false })), 0, 'not an A pile (DFU\'s J-O window)');
  assert.equal(kits(addPileLootExtras([], 'J', never, { online: false })), 0);
  assert.equal(kits(addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, always)), 1, 'a foe with a loot table');
  assert.equal(kits(addEnemyLootExtras([], { lootTableKey: '-', mapChance: 0 }, always)), 0, 'a foe without one');
  const at = (r) => { const out = []; maybeAddFieldKit(out, 6, () => r); return out.length; };
  assert.equal(at(0.059), 1);
  assert.equal(at(0.06), 0);
});

test('AUDIT REPAIR-EASE F4: the live price carries no instant-repair premium - the default does not undo the scale (a third, REPAIR-RATE)', () => {
  for (const [value, q, cond, max] of [[1000, 10, 50, 100], [300, 5, 10, 100]]) {
    const plain = calculateItemRepairCost(value, q, cond, max, { instantRepairs: false });
    assert.equal(calculateItemRepairCost(value, q, cond, max, { instantRepairs: true }), plain);
    assert.equal(plain, Math.max(1, Math.round(dfuItemRepairCost(value, q, cond, max, { instantRepairs: false }) / 3)));
  }
});
