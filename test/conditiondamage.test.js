// C-slice (AUDIT 23 combat-1): equipment CONDITION DAMAGE.
// FormulaHelper.DamageEquipment (:1080-1118) +
// ApplyConditionDamageThroughPhysicalHit (:1123-1138) +
// DaggerfallUnityItem.LowerCondition/ItemBreaks (:1170-1214).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { damageEquipment, calculateAttackDamage } from '../src/combat/formulas.js';
import { equipItem, equipTableOf, armorValuesOf, EQUIP_SLOTS, lowerCondition } from '../src/systems/equip.js';
import { BODY_PARTS } from '../src/systems/armorMaterials.js';
import { mintCondition } from '../src/systems/itemTemplates.js';

const saber = () => mintCondition({ group: 'Weapons', name: 'Saber', templateIndex: 117, material: 2 });
const cuirass = () => mintCondition({ group: 'Armor', name: 'Cuirass', templateIndex: 102, material: 0x0200 });
const buckler = () => mintCondition({ group: 'Armor', name: 'Buckler', templateIndex: 109, material: 0x0200 });
const boots = () => mintCondition({ group: 'Armor', name: 'Boots', templateIndex: 108, material: 0x0200 });
const dude = () => ({ isPlayer: false, items: [], stats: {} });

test('conditiondamage: the (10*damage+50)/100 amount, the 20% floor roll PER ITEM, and the gates', () => {
  // damage 5 -> exactly 1; damage 4 -> 0, floored to 1 only on the roll.
  const att = dude(), tgt = dude();
  const w = saber();
  const w0 = w.currentCondition;
  damageEquipment(att, tgt, 5, w, BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(w.currentCondition, w0 - 1, '(10*5+50)/100 = 1');
  damageEquipment(att, tgt, 4, w, BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(w.currentCondition, w0 - 1, 'amount 0 and the floor roll FAILS: nothing');
  damageEquipment(att, tgt, 4, w, BODY_PARTS.Chest, { rolls: () => 0.1 });
  assert.equal(w.currentCondition, w0 - 2, 'amount 0 and the floor roll passes: 1');
  damageEquipment(att, tgt, 30, w, BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(w.currentCondition, w0 - 5, '(10*30+50)/100 = 3 (int division)');
  // the gates: no weapon, or no damage -> nothing degrades
  const w2 = saber();
  damageEquipment(att, tgt, 50, null, BODY_PARTS.Chest, { rolls: () => 0.5 });
  damageEquipment(att, tgt, 0, w2, BODY_PARTS.Chest, { rolls: () => 0.5 });
  assert.equal(w2.currentCondition, w2.maxCondition, 'hand-to-hand and whiffs degrade nothing');
});

test('conditiondamage: the struck side routes shield-first when COVERED, else the body-part armor', () => {
  // GetShieldProtectedBodyParts: a Buckler covers LeftArm + Hands.
  const att = dude(), tgt = dude();
  const armor = cuirass(), shield = buckler();
  equipItem(tgt, armor);
  equipItem(tgt, shield);
  const a0 = armor.currentCondition, s0 = shield.currentCondition;
  damageEquipment(att, tgt, 10, saber(), BODY_PARTS.Hands, { rolls: () => 0.99 });
  assert.equal(shield.currentCondition, s0 - 1, 'a covered part damages the SHIELD');
  assert.equal(armor.currentCondition, a0, '...not the armor');
  damageEquipment(att, tgt, 10, saber(), BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(armor.currentCondition, a0 - 1, 'an uncovered part damages its own slot');
  assert.equal(shield.currentCondition, s0 - 1);
  // an empty slot degrades nothing on the target side
  damageEquipment(att, tgt, 10, saber(), BODY_PARTS.Feet, { rolls: () => 0.99 });
  assert.equal(armor.currentCondition, a0 - 1);
  assert.equal(shield.currentCondition, s0 - 1);
});

test('conditiondamage: a break clamps at 0, speaks the classic line, and UNEQUIPS (armor table restored)', () => {
  const tgt = dude();
  const armor = cuirass();
  equipItem(tgt, armor);
  const avBefore = armorValuesOf(tgt)[BODY_PARTS.Chest];
  armor.currentCondition = 1;
  const said = [];
  damageEquipment(dude(), tgt, 5, saber(), BODY_PARTS.Chest, { rolls: () => 0.99, say: (l) => said.push(l) });
  assert.equal(armor.currentCondition, 0, 'clamped at zero');
  assert.deepEqual(said, ['Cuirass has broken.'], 'itemHasBroken');
  assert.equal(equipTableOf(tgt)[EQUIP_SLOTS.ChestArmor], null, 'the slot is emptied');
  assert.equal(armor.equipSlot, undefined, 'the item is unequipped');
  assert.ok(armorValuesOf(tgt)[BODY_PARTS.Chest] > avBefore, 'the armor table gave the protection back');
  // the plural variant (Gauntlets/Greaves/Boots)
  const said2 = [];
  const b = boots();
  b.currentCondition = 1;
  lowerCondition(b, 1, null, (l) => said2.push(l));
  assert.deepEqual(said2, ['Boots have broken.'], 'itemHasBrokenPlural');
});

test('conditiondamage: CalculateAttackDamage runs it at the TAIL - both sides degrade on a landed weapon hit', () => {
  // FormulaHelper.cs:699-701.
  const attacker = { isPlayer: true, level: 1, skills: 90, stats: { strength: 75, agility: 50, luck: 50 } };
  const target = { isPlayer: false, careerIndex: 0, health: 500, maxHealth: 500, armor: 0, skills: 10, minMetalToHit: -1, stats: { strength: 50, agility: 50, luck: 50 }, items: [] };
  const armor = cuirass();
  equipItem(target, armor);
  const w = saber();
  const w0 = w.currentCondition, a0 = armor.currentCondition;
  // rolls 0.45: struck = BODY_PARTS table[9] = Chest; the hit passes
  // vs skill 90; dice100(20, 0.45) fails so only real amounts land.
  const dmg = calculateAttackDamage(attacker, target, { weapon: w, rolls: () => 0.45 });
  assert.ok(dmg > 0, `the hit landed (${dmg})`);
  assert.ok(w.currentCondition < w0, 'the attacker weapon degraded');
  assert.ok(armor.currentCondition < a0, 'the struck chest armor degraded');
});
