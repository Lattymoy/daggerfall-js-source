// AUDIT 26 (wave: enemy armour + shield condition damage).
//
// THE FINDING: FormulaHelper.DamageEquipment (:1080-1117) allocates a
// strike's condition damage to the ATTACKER's weapon and to the
// TARGET's shield-or-armour, read out of `target.ItemEquipTable`.
// AssignEnemyStartingEquipment (ItemHelper.cs:1366-1460) fills that
// table - EquipItem + Items.AddItem for the right-hand weapon, the
// left-hand shield, the left-hand weapon and each of Helm /
// Right_Pauldron / Left_Pauldron / Cuirass / Greaves / Boots - but the
// port equipped nothing, so every enemy's table was empty and the
// whole target-side half of DamageEquipment was dead code. An
// armoured knight could be hacked at for a whole fight and drop
// pristine, and the shield-covers-the-hit-body-part branch (DFU's
// deliberate departure from classic, :1088-1090) had never once run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignEnemyEquipment, equipmentItems, createArmor, createWeapon, WEAPONS_ENUM, ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { damageEquipment } from '../src/combat/formulas.js';
import { equipTableOf, EQUIP_SLOTS, isEquipped } from '../src/systems/equip.js';
import { BODY_PARTS } from '../src/systems/armorMaterials.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { unequipEnemyOnDeath } from '../src/scenes/hostCombat.js';
import { takeCorpseLoot } from '../src/scenes/corpseMarker.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

// variant 0, in AssignEnemyStartingEquipment's own draw order:
//   weapon pick .0 -> Broadsword(118); weapon material .0 -> iron;
//   shield pick .0 -> Buckler(109); shield chance .10 (< 50) HITS;
//   shield material .5 -> leather; then the six armour slots:
//   helm/R-pauldron/L-pauldron MISS, cuirass HITS (.10) leather (.5),
//   greaves/boots MISS.
const KNIGHT_ROLLS = () => seq(0, 0, 0, 0.10, 0.5, 0.99, 0.99, 0.99, 0.10, 0.5, 0.99, 0.99);
const armouredKnight = () => {
  const entity = { isClass: true, mobileType: 128, careerIndex: 0, armor: 0 };
  const eq = assignEnemyEquipment(entity, 0, 1, KNIGHT_ROLLS());
  return { entity, eq };
};
// (10 * damage + 50) / 100 with int division: 20 damage costs 2 points
// per item, with no 20%-floor roll involved.
const DAMAGE = 20;
const COST = 2;

test('AUDIT 26: AssignEnemyStartingEquipment really equips the armour and the shield (ItemHelper.cs:1366-1460)', () => {
  const { entity, eq } = armouredKnight();
  const slots = equipTableOf(entity);
  assert.equal(slots[EQUIP_SLOTS.RightHand], eq.rightHand, 'the weapon is in the right hand');
  assert.equal(slots[EQUIP_SLOTS.LeftHand]?.templateIndex, ARMOR_ENUM.Buckler, 'the shield is in the left');
  assert.equal(slots[EQUIP_SLOTS.ChestArmor]?.templateIndex, ARMOR_ENUM.Cuirass, 'the cuirass is on the chest');
  // ...and the same object is what Items.AddItem gave the corpse.
  const items = equipmentItems(eq);
  assert.equal(items.includes(slots[EQUIP_SLOTS.LeftHand]), true, 'the worn shield IS a dropped item');
  assert.equal(items.includes(slots[EQUIP_SLOTS.ChestArmor]), true, 'and so is the worn cuirass');
  assert.equal(items.length, 3, 'weapon + shield + cuirass, each exactly once');
  // ItemBuilder.CreateArmor mints through the template, so the piece
  // is born with its hit points (mintCondition) - a bare roll record
  // had no condition for DamageEquipment to lower at all.
  assert.equal(slots[EQUIP_SLOTS.ChestArmor].maxCondition, templateByIndex(ARMOR_ENUM.Cuirass).hitPoints);
  assert.equal(slots[EQUIP_SLOTS.ChestArmor].currentCondition, templateByIndex(ARMOR_ENUM.Cuirass).hitPoints);
  assert.equal(createArmor(ARMOR_ENUM.Helm, 0).currentCondition, templateByIndex(ARMOR_ENUM.Helm).hitPoints);
});

test('AUDIT 26: the struck slot loses condition on a damaging hit (FormulaHelper.cs:1108-1115)', () => {
  const { entity, eq } = armouredKnight();
  const attacker = { isPlayer: true };
  const weapon = createWeapon(WEAPONS_ENUM.Longsword, 0);
  const cuirass = equipTableOf(entity)[EQUIP_SLOTS.ChestArmor];
  const shield = equipTableOf(entity)[EQUIP_SLOTS.LeftHand];
  const before = cuirass.currentCondition;
  // Chest is NOT one of a Buckler's protected parts ([LeftArm, Hands]),
  // so GetEquipSlotForBodyPart(Chest) -> ChestArmor takes the damage.
  damageEquipment(attacker, entity, DAMAGE, weapon, BODY_PARTS.Chest, { rolls: seq(0.99) });
  assert.equal(cuirass.currentCondition, before - COST, 'the cuirass wears down');
  assert.equal(shield.currentCondition, shield.maxCondition, 'a shield that does not cover the part takes nothing');
  // the attacker's own weapon is billed the same amount, per item
  assert.equal(weapon.currentCondition, weapon.maxCondition - COST);
  // and the wear reaches the corpse: the worn piece IS the dropped one
  assert.equal(equipmentItems(eq).find((it) => it.templateIndex === ARMOR_ENUM.Cuirass).currentCondition, before - COST);
});

test('AUDIT 26: a shield covering the struck part takes the damage INSTEAD of the armour (FormulaHelper.cs:1088-1109)', () => {
  const { entity } = armouredKnight();
  const attacker = { isPlayer: true };
  const weapon = createWeapon(WEAPONS_ENUM.Longsword, 0);
  const cuirass = equipTableOf(entity)[EQUIP_SLOTS.ChestArmor];
  const shield = equipTableOf(entity)[EQUIP_SLOTS.LeftHand];
  // "In classic, shields are never damaged, only armor specific to the
  // hit body part is. Here, if an equipped shield covers the hit body
  // part, it takes damage instead." A Buckler covers LeftArm + Hands.
  damageEquipment(attacker, entity, DAMAGE, weapon, BODY_PARTS.LeftArm, { rolls: seq(0.99) });
  assert.equal(shield.currentCondition, shield.maxCondition - COST, 'the shield takes it');
  assert.equal(cuirass.currentCondition, cuirass.maxCondition, 'the armour is spared');
  // Hands too - the pauldron/gauntlet slots are empty, and it is the
  // SHIELD that takes it, not nothing.
  damageEquipment(attacker, entity, DAMAGE, weapon, BODY_PARTS.Hands, { rolls: seq(0.99) });
  assert.equal(shield.currentCondition, shield.maxCondition - 2 * COST);
  // Head: the Buckler does not cover it and no helm was rolled, so
  // nothing on the target side is billed.
  damageEquipment(attacker, entity, DAMAGE, weapon, BODY_PARTS.Head, { rolls: seq(0.99) });
  assert.equal(shield.currentCondition, shield.maxCondition - 2 * COST, 'an uncovered, unarmoured part costs nothing');
  assert.equal(cuirass.currentCondition, cuirass.maxCondition);
});

test('AUDIT 26: EnemyDeath strips the equip table before the loot transfer (EnemyDeath.cs:107-123)', () => {
  const { entity, eq } = armouredKnight();
  entity.items = equipmentItems(eq);
  for (const it of entity.items) assert.equal(isEquipped(it), true, 'worn on the living enemy');
  const playerEntity = { items: [] };
  const said = [];
  const n = takeCorpseLoot({ entity }, playerEntity, (s) => said.push(s));
  assert.equal(n, 3);
  // "This is still required so enemy equipment is not marked as
  // equipped" - an item that kept the dead enemy's slot is dropped
  // from every inventory tab by FilterLocalItems, so a looted cuirass
  // would vanish out of the pack.
  for (const it of playerEntity.items) assert.equal(isEquipped(it), false, `${it.name} is not still worn`);
  assert.equal(equipTableOf(entity).filter(Boolean).length, 0, 'the corpse wears nothing');
  assert.equal(playerEntity.items.some((it) => it.templateIndex === ARMOR_ENUM.Cuirass), true);
  // the law itself, on its own: Head..Feet INCLUSIVE (a `<=`), so the
  // boots and both hands are reached.
  const { entity: e2 } = armouredKnight();
  unequipEnemyOnDeath(e2);
  assert.equal(equipTableOf(e2).filter(Boolean).length, 0);
  unequipEnemyOnDeath(null);   // a foe with no entity is a no-op, not a throw
});
