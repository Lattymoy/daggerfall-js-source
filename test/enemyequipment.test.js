// C8 E4b: enemy equipment verbatim - material rolls, the loadout
// variants, the armor-value pass, weapon-vs-weaponless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIALS_BY_MODIFIER, randomMaterial, randomArmorMaterial,
  materialArmorValue, ARMOR_MATERIAL, WEAPONS_ENUM, ARMOR_ENUM,
  createWeapon, assignEnemyEquipment, equipmentVariantFor,
} from '../src/combat/enemyEquipment.js';
import { chooseEnemyWeapon } from '../src/combat/formulas.js';

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
  assert.equal(eq.rightHand.flags & 0x10, 0x10);      // edged
  assert.equal(eq.leftHand.shield, true);
  // Buckler protects LeftArm(2) + Hands(4) at 1*5; everything else no-armor 100 -> clamp 60
  assert.deepEqual(eq.armorValues, [60, 60, 95 > 60 ? 60 : 95, 60, 60, 60, 60].map((v, i) => (i === 2 || i === 4 ? 60 : 60)));
  // all parts end 60: 100-5=95 still clamps to 60 for a class enemy
  assert.ok(eq.armorValues.every((v) => v === 60));
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
