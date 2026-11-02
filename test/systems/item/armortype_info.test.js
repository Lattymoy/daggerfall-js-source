// ARMOR-TYPE (2026-10-26, a player: "can we add an info to every item what TYPE of armor it is (chain leather or
// plate)"). A plate piece's name says its metal and never the word "plate", and below Rare the metal is withheld - so
// the cards say the family in a row of its own. DRIVEN: real items through the real producers and the real card model.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { itemArmorTypeLine, itemStatRows } from '../../../src/systems/item/itemInfo.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { isForbiddenEquip } from '../../../src/systems/equip.js';
import { itemLine } from '../../../src/ui/enhanced/enhancedInventory.js';
import { pieceStatWords } from '../../../src/ui/questlines/qlJournal.js';

const piece = (material, templateIndex = 102) => ({ name: 'Cuirass', group: 'Armor', templateIndex, material, maxCondition: 100, currentCondition: 100 });

test('ARMOR-TYPE: every armour material answers its family - leather, both chains, every plate metal', () => {
  assert.equal(itemArmorTypeLine(piece(ARMOR_MATERIAL.Leather)), 'Leather');
  assert.equal(itemArmorTypeLine(piece(ARMOR_MATERIAL.Chain)), 'Chain');
  assert.equal(itemArmorTypeLine(piece(ARMOR_MATERIAL.Chain2)), 'Chain');
  for (const metal of ['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']) {
    assert.equal(itemArmorTypeLine(piece(ARMOR_MATERIAL[metal])), 'Plate', metal);
  }
  // DFU's nativeMaterialValue is a plain int: an armour piece minted with none IS Leather
  assert.equal(itemArmorTypeLine({ group: 'Armor', templateIndex: 107 }), 'Leather');
  assert.equal(itemArmorTypeLine(piece(ARMOR_MATERIAL.None)), null);
});

test('ARMOR-TYPE: a shield says its family; a weapon, a garment, a ring and nothing say none', () => {
  assert.equal(itemArmorTypeLine(piece(ARMOR_MATERIAL.Ebony, 112)), 'Plate');
  assert.equal(itemArmorTypeLine({ group: 'Weapons', templateIndex: 113, material: 3 }), null);
  assert.equal(itemArmorTypeLine({ group: 'MensClothing', templateIndex: 141 }), null);
  assert.equal(itemArmorTypeLine({ group: 'Jewellery', templateIndex: 133 }), null);
  assert.equal(itemArmorTypeLine(null), null);
});

test('ARMOR-TYPE: the card says the family the equip gate refuses by - a class barred from plate is barred from what reads Plate', () => {
  // weaponArmorShieldsBitfield's armour bits sit at 6..8: leather 1, chain 2, plate 4 (equip.js ARMOR_BITS_SHIFT)
  const barred = (bit) => ({ weaponArmorShieldsBitfield: bit << 6, forbiddenMaterialsFlags: 0 });
  const word = { 1: 'Leather', 2: 'Chain', 4: 'Plate' };
  for (const m of [ARMOR_MATERIAL.Leather, ARMOR_MATERIAL.Chain, ARMOR_MATERIAL.Iron, ARMOR_MATERIAL.Daedric]) {
    const it = piece(m);
    for (const bit of [1, 2, 4]) assert.equal(isForbiddenEquip(barred(bit), it), itemArmorTypeLine(it) === word[bit], `${m} vs ${word[bit]}`);
  }
});

test('ARMOR-TYPE: quick loot and the trader look panel carry a Type row, right under the Armour row', () => {
  const rows = itemStatRows(piece(ARMOR_MATERIAL.Steel));
  const labels = rows.map((r) => r.label);
  assert.equal(rows.find((r) => r.label === 'Type')?.text, 'Plate');
  assert.equal(labels.indexOf('Type'), labels.indexOf('Armour') + 1);
  assert.ok(!itemStatRows({ name: 'Dagger', group: 'Weapons', templateIndex: 113, material: 3, maxCondition: 10, currentCondition: 10 }).some((r) => r.label === 'Type'));
});

test('ARMOR-TYPE: the enhanced card model and the questline reward card carry it', () => {
  assert.equal(itemLine(piece(ARMOR_MATERIAL.Chain)).armorType, 'Chain');
  assert.equal(itemLine({ name: 'Dagger', group: 'Weapons', templateIndex: 113, material: 3 }).armorType, null);
  assert.match(pieceStatWords(piece(ARMOR_MATERIAL.Leather)), /Leather armor/);
  assert.match(pieceStatWords(piece(ARMOR_MATERIAL.Mithril)), /Plate armor/);
});
