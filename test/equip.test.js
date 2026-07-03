import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EQUIP_SLOTS, getTemplate } from '../src/characters/paperdoll.js';
import { ITEM_GROUPS, SLOT_RULES, WEAPON_HANDS, SHIELD_INDICES } from '../src/characters/equipRules.js';
import { createEquipTable, getItemHands, ITEM_HANDS } from '../src/characters/equipTable.js';

test('equip: extraction pins', () => {
  assert.equal(Object.keys(SLOT_RULES.Armor).length, 11);
  assert.equal(Object.keys(SLOT_RULES.Jewellery).length, 7);
  assert.equal(Object.keys(SLOT_RULES.MensClothing).length, 41);
  assert.equal(Object.keys(SLOT_RULES.WomensClothing).length, 35);
  assert.equal(SLOT_RULES.Armor[102].slot, 'ChestArmor');       // Cuirass
  assert.equal(SLOT_RULES.Armor[112].slot, 'LeftHand');         // Tower Shield
  assert.deepEqual(SHIELD_INDICES, [109, 110, 111, 112]);
  assert.equal(Object.keys(WEAPON_HANDS).length, 18);
});

test('equip: hands verbatim (bow rides the classic default)', () => {
  const W = ITEM_GROUPS.Weapons;
  assert.equal(getItemHands({ group: W, templateIndex: 113 }), ITEM_HANDS.Either); // Dagger
  assert.equal(getItemHands({ group: W, templateIndex: 123 }), ITEM_HANDS.Both);   // Claymore
  assert.equal(getItemHands({ group: ITEM_GROUPS.Armor, templateIndex: 109 }), ITEM_HANDS.LeftOnly); // Buckler
  assert.equal(getItemHands({ group: ITEM_GROUPS.Gems, templateIndex: 0 }), ITEM_HANDS.None);
  const bows = Object.entries(WEAPON_HANDS).filter(([, v]) => v === 'Both').length;
  assert.ok(bows >= 8); // 2H set + both bows land Both
});

test('equip: paired slots pick first open, else first', () => {
  const t = createEquipTable();
  const ring = { group: ITEM_GROUPS.Jewellery, templateIndex: 135 };
  const s1 = t.getEquipSlot(ring);
  assert.equal(s1, EQUIP_SLOTS.Ring0);
  t.slots[EQUIP_SLOTS.Ring0] = ring;
  assert.equal(t.getEquipSlot(ring), EQUIP_SLOTS.Ring1);
  t.slots[EQUIP_SLOTS.Ring1] = ring;
  assert.equal(t.getEquipSlot(ring), EQUIP_SLOTS.Ring0); // both full -> first
});

test('equip: 2H right-hand replacement rule', () => {
  const t = createEquipTable();
  const claymore = { group: ITEM_GROUPS.Weapons, templateIndex: 123 };
  const dagger = { group: ITEM_GROUPS.Weapons, templateIndex: 113 };
  const buckler = { group: ITEM_GROUPS.Armor, templateIndex: 109 };
  t.slots[EQUIP_SLOTS.RightHand] = claymore;
  // Either-hand weapon with a 2H equipped -> forced RightHand.
  assert.equal(t.getEquipSlot(dagger), EQUIP_SLOTS.RightHand);
  // Shields stay LeftOnly regardless.
  assert.equal(t.getEquipSlot(buckler), EQUIP_SLOTS.LeftHand);
});

test('equip: corpus - every clothing/armor/jewellery template resolves', () => {
  const t = createEquipTable();
  for (const [group, name] of [[ITEM_GROUPS.Armor, 'Armor'], [ITEM_GROUPS.Jewellery, 'Jewellery'], [ITEM_GROUPS.MensClothing, 'MensClothing'], [ITEM_GROUPS.WomensClothing, 'WomensClothing']]) {
    for (const idxStr of Object.keys(SLOT_RULES[name])) {
      const idx = Number(idxStr);
      assert.ok(getTemplate(idx), `template ${idx} exists`);
      const slot = t.getEquipSlot({ group, templateIndex: idx });
      assert.notEqual(slot, EQUIP_SLOTS.None, `${name} ${idx} resolves`);
    }
  }
});
