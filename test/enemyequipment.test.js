// C8 E4b: enemy equipment verbatim - material rolls, the loadout
// variants, the armor-value pass, weapon-vs-weaponless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIALS_BY_MODIFIER, randomMaterial, randomArmorMaterial,
  materialArmorValue, ARMOR_MATERIAL, WEAPONS_ENUM, ARMOR_ENUM,
  createWeapon, assignEnemyEquipment, equipmentVariantFor, equipmentItems, shieldProtectedBodyParts } from '../src/combat/enemyEquipment.js';
import { chooseEnemyWeapon } from '../src/combat/formulas.js';
import { equipTableOf, EQUIP_SLOTS } from '../src/systems/equip.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('equipment: material tables + rolls verbatim', () => {
  assert.deepEqual([...MATERIALS_BY_MODIFIER], [64, 128, 10, 21, 13, 8, 5, 3, 2, 5]);
  // level 1: modifier -36; roll 0 -> combined 0 -> iron (0 < 64 stops)
  assert.equal(randomMaterial(1, seq(0)), 0);
  // roll 255 at level 1 -> combined 219: -64 -> 155, -128 -> 27(mat 2), 27 >= 10 -> -10 -> 17(mat 3), 17 < 21 stop -> Elven(3)
  assert.equal(randomMaterial(1, seq(0.999)), 3);
  // level 10 max roll: combined 255: 63 after iron+steel; -10 -> 53? (63>=10) mat3: 53>=21 -> 32 mat4: 32>=13 -> 19 mat5: 19>=8 -> 11 mat6: 11>=5 -> 6 mat7: 6>=3 -> 3 mat8: 3>=2 -> 1 mat9: 1<5 stop -> Daedric(9)
  assert.equal(randomMaterial(10, seq(0.999)), 9);
  // armor: roll < 70 leather; 70-89 chain; >= 90 plate base + weapon material
  assert.equal(randomArmorMaterial(1, seq(0.50)), ARMOR_MATERIAL.Leather);
  assert.equal(randomArmorMaterial(1, seq(0.75)), ARMOR_MATERIAL.Chain);
  assert.equal(randomArmorMaterial(1, seq(0.95, 0)), ARMOR_MATERIAL.PLATE_BASE + 0);
  assert.equal(materialArmorValue(ARMOR_MATERIAL.Leather), 3);
  assert.equal(materialArmorValue(ARMOR_MATERIAL.Chain), 6);
  assert.equal(materialArmorValue(ARMOR_MATERIAL.PLATE_BASE + 9), 21);   // Daedric plate
});

test('equipment: variant 0 loadout + the armor-value pass (class clamp)', () => {
  const entity = { isClass: true, mobileType: 128, careerIndex: 0, armor: 0 };
  // rolls: weapon pick .0 -> Broadsword(118); material .0 iron; shield chance .10 hits (50);
  // shield pick .0 -> Buckler(109); shield material .5 leather; then 6 armor slots .99 all MISS
  const eq = assignEnemyEquipment(entity, 0, 1, seq(0, 0, 0.10, 0, 0.5, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99));
  assert.equal(eq.rightHand.name, 'Broadsword');
  assert.equal(eq.rightHand.material, 0);
  // AUDIT 18: DaggerfallUnityItem.SetItem gives every generated item
  // flags 0 - no DFU path mints the 0x10 "edged" bit, and the port's
  // minting of it inverted the Skeletal Warrior halving.
  assert.equal(eq.rightHand.flags, 0);
  // AUDIT 26: this line used to read `eq.leftHand.shield === true`,
  // which pinned the PORT's invention - a bare {templateIndex, shield}
  // marker standing in for a shield that was never equipped anywhere.
  // ItemHelper.cs:1387-1391 mints a real armour item and equips it,
  // and ItemEquipTable.GetEquipSlot puts a shield in LeftHand (the
  // slot FormulaHelper.DamageEquipment reads at :1087).
  assert.equal(eq.leftHand.group, 'Armor');
  assert.equal(eq.leftHand.templateIndex, ARMOR_ENUM.Buckler);
  assert.equal(equipTableOf(entity)[EQUIP_SLOTS.LeftHand], eq.leftHand, 'the shield is WORN, in the left hand');
  assert.equal(equipTableOf(entity)[EQUIP_SLOTS.RightHand], eq.rightHand, 'and the weapon in the right');
  // KNOWN-VACUOUS UNTIL NOW, flagged by AUDIT 18 and again by its
  // re-measurement: this line used to be
  //   deepEqual(eq.armorValues, [60,60, 95>60?60:95, 60,60,60,60]
  //             .map((v, i) => (i === 2 || i === 4 ? 60 : 60)))
  // whose ternary has IDENTICAL branches, so it evaluated to seven 60s
  // and pinned nothing about which parts a Buckler covers. It is the
  // only unfalsifiable assertion in 5,635 assert sites, and it survived
  // two audits because it LOOKS like it pins the shield table.
  //
  // On a class enemy every part clamps to 60 regardless, so this fixture
  // can never discriminate. Pin the table itself against DFU instead -
  // GetShieldProtectedBodyParts (DaggerfallUnityItem.cs:1082-1095).
  assert.ok(eq.armorValues.every((v) => v === 60), 'class enemy: every part clamps to 60');
  assert.deepEqual(shieldProtectedBodyParts(109), [2, 4], 'Buckler: LeftArm, Hands');
  assert.deepEqual(shieldProtectedBodyParts(110), [2, 4, 5], 'Round: + Legs');
  assert.deepEqual(shieldProtectedBodyParts(111), [2, 4, 5], 'Kite: same as Round');
  assert.deepEqual(shieldProtectedBodyParts(112), [0, 2, 4, 5], 'Tower: + Head');
  assert.deepEqual(shieldProtectedBodyParts(999), [], 'anything else: no parts');
});

test('equipment: variant 2 chances + monster keep-better rule + city watch iron', () => {
  // variant 2: claymore-range weapon, 90% per armor slot; all .0 rolls -> every piece lands, leather
  const orcWarlord = { isClass: false, mobileType: 24, careerIndex: 24, armor: 8 * 5 };   // definition armor 40
  const eq = assignEnemyEquipment(orcWarlord, 2, 1, seq(0));
  assert.equal(eq.rightHand.name, 'Claymore');
  // every non-shield part: 100 - leather(3)*5 = 85 -> keep-better vs 40 -> 40
  assert.ok(eq.armorValues.every((v) => v === 40));
  assert.equal(equipmentVariantFor(24, false), 2);     // OrcWarlord
  assert.equal(equipmentVariantFor(21, false), 0);     // OrcShaman = 21 (EntityEnums, verified)
  assert.equal(equipmentVariantFor(3, false), null);   // plain monster: none
  // city watch (146) rolls at itemLevel 1 regardless of player level:
  // player level 20 would push materials up; max roll at itemLevel 1 caps at Elven(3)
  const cw = { isClass: true, mobileType: 146, careerIndex: 18, armor: 0 };
  const eqCw = assignEnemyEquipment(cw, 1, 20, seq(0, 0.999, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99));
  assert.ok(eqCw.rightHand.material <= 3, `city watch material ${eqCw.rightHand.material}`);
  // weapon-vs-weaponless: rat h2h avg (1+4)/2=2 beats a dagger avg (1+6)/2=3? no: 3>2 -> weapon kept
  const dagger = createWeapon(WEAPONS_ENUM.Dagger, 0);
  assert.equal(chooseEnemyWeapon(dagger, { minDamage: 1, maxDamage: 4 }), dagger);
  // orc warlord h2h 20-36 avg 28 > claymore avg 10 -> weaponless
  assert.equal(chooseEnemyWeapon(eq.rightHand, { minDamage: 20, maxDamage: 36 }), null);
  assert.equal(chooseEnemyWeapon(null, { minDamage: 1, maxDamage: 4 }), null);
});

test('equipment G3: every equipped piece is a droppable item (DFU Items.AddItem)', () => {
  const entity = { isClass: true, mobileType: 128, careerIndex: 0, armor: 0 };
  // the variant-0 shield loadout from above: Broadsword + Buckler
  const eq = assignEnemyEquipment(entity, 0, 1, seq(0, 0, 0.10, 0, 0.5, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99));
  const items = equipmentItems(eq);
  // the weapon + the shield's ARMOR item (the shield leftHand marker
  // never duplicates; a leftHand WEAPON would be its own item)
  assert.equal(items.length, 2);
  assert.equal(items[0].group, 'Weapons');
  assert.equal(items[0].name, 'Broadsword');
  assert.equal(items[1].group, 'Armor');
  assert.equal(items[1].templateIndex, ARMOR_ENUM.Buckler);
});

// AUDIT 26: THE EQUIPPED WEAPON AND THE DROPPED ITEM ARE ONE OBJECT.
// MUTATION: restore `items.push({ group: 'Weapons', ...eq.rightHand })`
// -> the identity assertions fail and the condition loss stops
// reaching the corpse's copy.
test('equipment G3: AssignEnemyStartingEquipment equips the SAME item it adds to Items (ItemHelper.cs:1366-1460)', () => {
  // ItemHelper.cs:1379-1381:
  //     DaggerfallUnityItem weapon = ItemBuilder.CreateWeapon(...);
  //     enemyEntity.ItemEquipTable.EquipItem(weapon, true, false);
  //     enemyEntity.Items.AddItem(weapon);
  // EquipItem stores the reference in the slot (ItemEquipTable.cs:140-141),
  // so the swung weapon and the looted weapon are the same
  // DaggerfallUnityItem - which is the only reason the equip table can
  // serialize as a UID at all (:333-373).
  const entity = { isClass: true, mobileType: 128, careerIndex: 0, armor: 0 };
  // variant 0: Broadsword right hand, the shield roll MISSES (0.99 vs
  // chance 50) and the left-hand WEAPON roll hits -> a Dagger.
  const eq = assignEnemyEquipment(entity, 0, 1, seq(0, 0, 0, 0.99, 0, 0, 0, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99));
  assert.equal(eq.leftHand?.name, 'Dagger', 'the left hand holds a weapon, not a shield');
  const items = equipmentItems(eq);
  assert.equal(items[0], eq.rightHand, 'the right hand IS the item, not a copy of it');
  assert.equal(items[1], eq.leftHand, 'and so is the left');
  // the consequence, before any save is involved: condition damage
  // billed to the swung weapon reaches what the corpse drops.
  const before = eq.rightHand.currentCondition;
  assert.ok(before > 0, 'createWeapon mints the condition with the item');
  eq.rightHand.currentCondition -= 5;
  assert.equal(items[0].currentCondition, before - 5, 'a degraded blade drops degraded');
});
