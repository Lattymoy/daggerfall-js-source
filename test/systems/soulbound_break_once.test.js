import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ENCHANTMENT_TYPES as T, PAYLOAD, doItemEnchantmentPayloads, doEnchantedPayloads, setDefaultEnchantCtx } from '../../src/systems/enchantments.js';
import { equipItem, lowerCondition, equipTableOf } from '../../src/systems/equip.js';
import { damageEquipment } from '../../src/combat/formulas.js';
import { BODY_PARTS } from '../../src/systems/armorMaterials.js';
import { leaveForRepair, repairJobsAt, collectRepaired } from '../../src/systems/repairService.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { createTradePack } from '../../src/systems/tradePack.js';
import { validLootItem } from '../../src/systems/loot/loot.js';
import { magicPowersLines } from '../../src/systems/item/itemPowers.js';
import { powersRows } from '../../src/ui/native/nativeInventory.js';
import { itemInfoBoxes } from '../../src/ui/enhanced/enhancedInventory.js';
import { SOUL_TRAP_TEMPLATE } from '../../src/systems/mysticism.js';

afterEach(() => setDefaultEnchantCtx(null));
const weapon = (param = 9) => ({ name: 'Soulbound Saber', group: 'Weapons', templateIndex: 117, material: 2,
  maxCondition: 100, currentCondition: 1, isIdentified: true,
  enchantments: [{ type: T.SoulBound, param }] });
const owner = (item) => ({ isPlayer: true, name: 'Tester', level: 5, items: [item], stats: {}, skills: [], career: {}, spells: [], activeEffects: [] });
function rig(item = weapon()) {
  const entity = owner(item), spawns = [];
  setDefaultEnchantCtx({ spawnFoe: (type) => spawns.push(type), allowMagicRepairs: true });
  return { item, entity, spawns };
}
function repair(item) {
  leaveForRepair(item, 'test-smith', 1, 0);
  repairJobsAt({ otherItems: [item] }, 'test-smith', 1);
  collectRepaired(item);
  assert.equal(item.currentCondition, item.maxCondition);
}

test('Soulbound: repeated combat wear of the same broken weapon releases one enemy', () => {
  const { item, entity, spawns } = rig();
  equipItem(entity, item);
  for (let i = 0; i < 20; i++) damageEquipment(entity, { items: [], stats: {} }, 5, item, BODY_PARTS.Chest, { rolls: () => .99 });
  assert.deepEqual(spawns, [9]);
  assert.equal(item.currentCondition, 0);
  assert.ok(equipTableOf(entity).every((it) => it !== item));
});

test('Soulbound: repair and break cycles cannot refill the released soul', () => {
  const { item, entity, spawns } = rig();
  const originalPowers = structuredClone(item.enchantments);
  for (let i = 0; i < 20; i++) {
    repair(item); equipItem(entity, item);
    lowerCondition(item, item.maxCondition, entity);
  }
  assert.deepEqual(spawns, [9]);
  assert.ok(entity.items.includes(item), 'repairable item stays in the pack');
  assert.deepEqual(item.enchantments, originalPowers, 'other item properties/powers are not stripped');
});

test('Soulbound: actual player save/load carries the spent soul through another repair and break', () => {
  const { item, entity, spawns } = rig();
  lowerCondition(item, 1, entity);
  const restored = {};
  restorePlayer(restored, JSON.parse(JSON.stringify(snapshotPlayer(entity))));
  assert.equal(restored.items[0].soulBoundReleased, true);
  repair(restored.items[0]);
  lowerCondition(restored.items[0], 100, restored);
  assert.deepEqual(spawns, [9]);
});

test('Soulbound: another player receiving the repaired item cannot release its soul again', () => {
  const { item, entity, spawns } = rig();
  lowerCondition(item, 1, entity); repair(item);
  const sender = createTradePack(entity);
  const receiverEntity = owner(null); receiverEntity.items = [];
  const receiver = createTradePack(receiverEntity);
  const entries = [{ item, count: 1 }];
  const wire = JSON.parse(JSON.stringify(sender.wire(entries)));
  const received = receiver.unwire(wire);
  assert.ok(received);
  assert.ok(sender.take(entries, 0));
  receiver.give(received, 0);
  const otherItem = receiverEntity.items[0];
  assert.equal(otherItem.soulBoundReleased, true);
  lowerCondition(otherItem, 100, receiverEntity);
  assert.deepEqual(spawns, [9]);
  assert.equal(entity.items.length, 0);
});

test('Soulbound: reentrant break delivery is consumed before calling the host', () => {
  const item = weapon(); let calls = 0;
  const ctx = { spawnFoe: () => { if (++calls < 4) doItemEnchantmentPayloads(PAYLOAD.Breaks, item, { ctx }); } };
  doItemEnchantmentPayloads(PAYLOAD.Breaks, item, { ctx });
  assert.equal(calls, 1);
});

test('Soulbound: a throwing or unavailable spawn host does not reopen the release', () => {
  const item = weapon(); let calls = 0;
  const ctx = { spawnFoe: () => { calls++; throw new Error('host failed'); } };
  assert.throws(() => doItemEnchantmentPayloads(PAYLOAD.Breaks, item, { ctx }), /host failed/);
  assert.doesNotThrow(() => doItemEnchantmentPayloads(PAYLOAD.Breaks, item, { ctx }));
  assert.equal(calls, 1);
  const unmounted = weapon();
  doItemEnchantmentPayloads(PAYLOAD.Breaks, unmounted);
  doItemEnchantmentPayloads(PAYLOAD.Breaks, unmounted, { ctx: { spawnFoe: () => calls++ } });
  assert.equal(calls, 1);
});

test('Soulbound: 10000 repeated break deliveries remain bounded; separate items still release', () => {
  const { item, spawns } = rig();
  for (let i = 0; i < 10000; i++) doItemEnchantmentPayloads(PAYLOAD.Breaks, item);
  doItemEnchantmentPayloads(PAYLOAD.Breaks, weapon(0));
  doItemEnchantmentPayloads(PAYLOAD.Breaks, weapon(9));
  assert.equal(spawns.length, 3, 'one release per item, regardless of repeated delivery count');
  assert.deepEqual(spawns, [9, 0, 9]);
});

test('Soulbound: only consuming a fresh trapped soul can reset a spent binding', () => {
  const { item, entity, spawns } = rig();
  doItemEnchantmentPayloads(PAYLOAD.Breaks, item);
  doEnchantedPayloads(item, item.enchantments, { entity });
  doItemEnchantmentPayloads(PAYLOAD.Breaks, item);
  assert.deepEqual(spawns, [9], 'no free rearm without a filled trap');
  entity.items.push({ group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: 9 });
  doEnchantedPayloads(item, item.enchantments, { entity });
  assert.equal(entity.items.length, 1, 'the fresh trap was consumed');
  doItemEnchantmentPayloads(PAYLOAD.Breaks, item);
  assert.deepEqual(spawns, [9, 9]);
});

test('Soulbound: shared powers text reports the released soul in classic and enhanced inventory', () => {
  const { item, spawns } = rig();
  const before = magicPowersLines(item)[0];
  doItemEnchantmentPayloads(PAYLOAD.Breaks, item);
  const lines = magicPowersLines(item);
  assert.equal(lines[0], before + ' (released)');
  assert.deepEqual(powersRows([{ text: '%mpw', center: true }], lines), [{ text: lines[0], center: true }]);
  const boxes = itemInfoBoxes(item, { rows: (id) => id === 1016 ? [{ text: '%mpw', center: true }] : [] });
  assert.ok(boxes.flat().some((row) => row.text === lines[0]));
  assert.deepEqual(magicPowersLines(item, { identified: false }), ['Powers unknown.']);
  assert.deepEqual(spawns, [9]);
});

test('Soulbound: release state survives the item validator and rejects wrong types', () => {
  assert.equal(validLootItem({ ...weapon(), soulBoundReleased: true }).soulBoundReleased, true);
  assert.equal(validLootItem({ ...weapon(), soulBoundReleased: 'false' }), null);
});

test('Scope: non-Soulbound items keep existing condition, retention, repair and power behavior', () => {
  for (const enchantments of [[], [{ type: T.StrengthensArmor, param: -1 }]]) {
    const item = { ...weapon(), name: 'Ordinary Saber', enchantments };
    const { entity, spawns } = rig(item);
    const before = magicPowersLines(item);
    lowerCondition(item, 1, entity);
    assert.ok(entity.items.includes(item), 'not destroyed');
    assert.equal(item.currentCondition, 0, 'existing durability law unchanged');
    repair(item);
    assert.equal(item.currentCondition, 100);
    assert.equal(Object.hasOwn(item, 'soulBoundReleased'), false);
    assert.deepEqual(magicPowersLines(item), before);
    assert.deepEqual(spawns, []);
  }
});
