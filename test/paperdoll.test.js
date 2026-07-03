import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EQUIP_SLOTS, ITEM_TEMPLATES, getTemplate, paperdollOrder } from '../src/characters/paperdoll.js';

test('paperdoll: equip slots verbatim', () => {
  assert.equal(EQUIP_SLOTS.None, -1);
  assert.equal(EQUIP_SLOTS.Head, 12);
  assert.equal(EQUIP_SLOTS.ChestClothes, 17);
  assert.equal(EQUIP_SLOTS.ChestArmor, 18);
  assert.equal(EQUIP_SLOTS.LegsArmor, 23);
  assert.equal(EQUIP_SLOTS.Feet, 26);
  assert.equal(Object.keys(EQUIP_SLOTS).length, 28); // 27 slots + None
});

test('paperdoll: template DB committed whole', () => {
  assert.equal(ITEM_TEMPLATES.length, 288);
  const shirt = getTemplate(165);
  assert.equal(shirt.name, 'Short Shirt');
  assert.equal(shirt.drawOrderOrEffect, 40);
  assert.equal(shirt.variants, 5);
  const ruby = getTemplate(0);
  assert.equal(ruby.name, 'Ruby');
  // Every template resolves by its own index.
  for (const t of ITEM_TEMPLATES) assert.equal(getTemplate(t.index), t);
});

test('paperdoll: blit order sorts ascending drawOrder', () => {
  const items = [{ drawOrder: 40 }, { drawOrder: 8 }, { drawOrder: 23 }];
  assert.deepEqual(paperdollOrder(items).map((i) => i.drawOrder), [8, 23, 40]);
});
