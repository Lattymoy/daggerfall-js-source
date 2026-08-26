// AUDIT 26, the SAVE campaign - THE FOE EQUIP TABLE IS RESTORED WHOLE.
//
// SerializableEnemy.RestoreSaveData (Game/Serialization/SerializableEnemy
// .cs:173-174) is two lines in one order:
//
//     entity.Items.DeserializeItems(data.items);
//     entity.ItemEquipTable.DeserializeEquipTable(data.equipTable, entity.Items);
//
// - the WHOLE 27-slot table, relinked against the restored collection.
// The port relinked only the RIGHT HAND. That was invisible while an
// enemy's equip table was empty; commit 24be79b ended that, because
// AssignEnemyStartingEquipment (ItemHelper.cs:1366-1460) equips the
// shield and every armour piece as well as the weapon, and
// DamageEquipment (FormulaHelper.cs:1080-1117) bills the struck slot
// out of that table. So a load replaced entity.items with the saved
// copies while the table still held the RESPAWN's throwaway roll: a
// foe's shield and armour condition was billed to objects that were
// not in its inventory and would never drop.
//
// The other half of the law is a NEGATIVE. DFU does not re-derive an
// enemy's armour values on restore: the wipe-to-100-and-re-apply block
// is SerializablePlayer.RestoreItems' own (:355-368) and has no
// counterpart in SerializableEnemy, because a foe's values were
// already derived by its spawn's SetEnemyEquipment pass, clamps and
// all (EnemyEntity.cs:409-427).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deserializeEquipTable, rebuildEquipState, equipTableOf, armorValuesOf,
  equipItem, EQUIP_SLOTS,
} from '../src/systems/equip.js';
import { assignEnemyEquipment, equipmentItems } from '../src/combat/enemyEquipment.js';
import { unequipEnemyOnDeath } from '../src/scenes/hostCombat.js';
import { damageEquipment } from '../src/combat/formulas.js';
import { BODY_PARTS } from '../src/systems/armorMaterials.js';

/** A knight who rolls every piece: variant 0 takes the shield arm, and
 *  the six armour rolls all land. Deterministic, so the pin reads the
 *  law and not the dice. */
const KNIGHT_ROLLS = () => {
  const v = [0, 0, 0.10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let i = 0;
  return () => v[i++] ?? 0;
};
function knight() {
  const entity = { isClass: true, careerIndex: 5, armor: 0, items: [] };
  const eq = assignEnemyEquipment(entity, 0, 5, KNIGHT_ROLLS());
  entity.weapon = eq.rightHand;
  entity.items.push(...equipmentItems(eq));
  return entity;
}
/** The restore both foe hosts run: DeserializeItems, then
 *  DeserializeEquipTable, then the port's cached right hand. */
function restoreFoe(entity, savedItems) {
  entity.items = savedItems.map((it) => ({ ...it }));
  deserializeEquipTable(entity);
  entity.weapon = equipTableOf(entity)[EQUIP_SLOTS.RightHand] ?? null;
  return entity;
}

test(':174 - after a restore EVERY equipped slot points at an object that IS in entity.items', () => {
  const saved = knight();
  const worn = equipTableOf(saved).filter(Boolean);
  assert.ok(worn.length > 2, 'the fixture really wears a weapon, a shield and armour');
  for (const it of worn) assert.ok(saved.items.includes(it), 'the spawn equips the same object it adds to Items (ItemHelper.cs:1379-1381)');

  const snapItems = saved.items.map((it) => ({ ...it }));   // the envelope

  // the respawn: a fresh roll, whose table is a throwaway
  const foe = knight();
  const ghosts = equipTableOf(foe).filter(Boolean);
  restoreFoe(foe, snapItems);

  const slots = equipTableOf(foe);
  const rworn = slots.filter(Boolean);
  assert.equal(rworn.length, worn.length, 'the WHOLE table comes back, slot for slot - not the right hand alone');
  // IDENTITY, not a field match. This is the bug: only RightHand was
  // relinked, so the shield and armour slots still held the respawn's
  // objects, which are not in entity.items and will never drop.
  for (const it of rworn) assert.ok(foe.items.includes(it), 'every restored slot IS an object in entity.items');
  for (const g of ghosts) assert.equal(slots.includes(g), false, 'no slot still holds the respawn throwaway');
  assert.equal(foe.weapon, slots[EQUIP_SLOTS.RightHand], 'entity.weapon is the cached RightHand slot (EnemyAttack.cs:141/:143/:192/:409)');
  assert.ok(foe.items.includes(foe.weapon), 'and it is in the inventory the corpse drops');
});

test(':174 - a shield damaged before the save is still the damaged one after it, and keeps taking the blows', () => {
  const saved = knight();
  const shield = equipTableOf(saved)[EQUIP_SLOTS.LeftHand];
  assert.ok(shield, 'the fixture carries a shield in LeftHand');
  const pristine = shield.currentCondition;
  // hack at it: DamageEquipment bills the LeftHand shield when the
  // struck body part is one it covers (FormulaHelper.cs:1088-1090).
  damageEquipment({}, saved, 40, { currentCondition: 100, maxCondition: 100 }, BODY_PARTS.LeftArm, { rolls: () => 0.99 });
  const damaged = shield.currentCondition;
  assert.ok(damaged < pristine, 'the shield really wore down before the save');

  const snapItems = saved.items.map((it) => ({ ...it }));
  const foe = restoreFoe(knight(), snapItems);
  const rshield = equipTableOf(foe)[EQUIP_SLOTS.LeftHand];
  assert.equal(rshield.currentCondition, damaged, 'the restored foe carries the DAMAGED shield, not the respawn’s pristine roll');
  assert.ok(foe.items.includes(rshield), 'and it is the one in his inventory');

  // keep hacking after the load: the blow must land on that same
  // object, the one his corpse will drop.
  damageEquipment({}, foe, 40, { currentCondition: 100, maxCondition: 100 }, BODY_PARTS.LeftArm, { rolls: () => 0.99 });
  assert.ok(rshield.currentCondition < damaged, 'a post-load blow wears the restored shield down further');
  assert.equal(equipTableOf(foe)[EQUIP_SLOTS.LeftHand], foe.items.find((it) => it === rshield),
    'the worn shield and the droppable shield are one object');
});

test('SerializableEnemy has no :355-368 block - the relink leaves armorValues exactly as the spawn derived them', () => {
  const saved = knight();
  const spawnValues = [...armorValuesOf(saved)];
  // SetEnemyEquipment's own pass: the class clamp is 60 and the loop's
  // bound is EXCLUSIVE of Feet, so this is not what a re-derive gives.
  assert.deepEqual(spawnValues, [60, 60, 60, 60, 60, 60, 60], 'EnemyEntity.cs:409-427 - clamped at 60 for a class enemy');

  const snapItems = saved.items.map((it) => ({ ...it }));
  const foe = knight();
  restoreFoe(foe, snapItems);
  assert.deepEqual(armorValuesOf(foe), spawnValues, 'DeserializeEquipTable touches no armour value');

  // ...and the mistake this pin exists to forbid: the PLAYER's
  // rebuildEquipState refills to 100 and re-derives from the table,
  // which re-counts the boots SetEnemyEquipment skips and drops the
  // clamp. A foe restored through it comes back markedly easier to hit.
  const wrong = knight();
  wrong.items = snapItems.map((it) => ({ ...it }));
  rebuildEquipState(wrong);
  assert.notDeepEqual(armorValuesOf(wrong), spawnValues,
    'the player’s re-derive really would change a foe’s armour - which is why the foe path must not call it');
  assert.ok(armorValuesOf(wrong).every((v) => v > 60), 'and every part comes back weaker than the 60 clamp');
});

test('a monster keeps its definition’s armour bound across a restore too (EnemyEntity.cs:421-427)', () => {
  const m = { isClass: false, careerIndex: 7, armor: 15, items: [] };
  const eq = assignEnemyEquipment(m, 0, 5, KNIGHT_ROLLS());
  m.weapon = eq.rightHand;
  m.items.push(...equipmentItems(eq));
  const spawnValues = [...armorValuesOf(m)];
  assert.deepEqual(spawnValues, [15, 15, 15, 15, 15, 15, 15], 'a monster keeps the BETTER of equipment vs its definition');
  const snapItems = m.items.map((it) => ({ ...it }));
  const foe = { isClass: false, careerIndex: 7, armor: 15, items: [], armorValues: [...spawnValues] };
  restoreFoe(foe, snapItems);
  assert.deepEqual(armorValuesOf(foe), spawnValues, 'the relink leaves the monster bound alone');
});

test('the PLAYER’s restore path is unchanged - rebuildEquipState still re-derives (:301 + :355-368)', () => {
  const player = { isPlayer: true, items: [] };
  const cuirass = { group: 'Armor', templateIndex: 102, material: 0x0200, currentCondition: 100, maxCondition: 100 };
  player.items.push(cuirass);
  equipItem(player, cuirass);
  const wornValues = [...armorValuesOf(player)];
  assert.ok(wornValues[BODY_PARTS.Chest] < 100, 'a worn cuirass subtracts on the Chest');

  // a load: fresh copies, a stale table and a stale armour fold
  const restored = { isPlayer: true, items: player.items.map((it) => ({ ...it })), equip: player.equip, armorValues: [1, 2, 3, 4, 5, 6, 7] };
  rebuildEquipState(restored);
  assert.deepEqual(armorValuesOf(restored), wornValues, 'the values are wiped to 100 and re-applied from the rebuilt table');
  const slots = equipTableOf(restored);
  assert.equal(slots[EQUIP_SLOTS.ChestArmor], restored.items[0], 'and the table relinks to the RESTORED objects');
});

test('the slot is the link, and it survives the JSON round trip a cold boot makes', () => {
  const saved = knight();
  const worn = equipTableOf(saved).filter(Boolean).length;
  const onDisk = JSON.parse(JSON.stringify(saved.items));   // through the quicksave envelope
  const foe = knight();
  restoreFoe(foe, onDisk);
  const slots = equipTableOf(foe);
  assert.equal(slots.filter(Boolean).length, worn, 'every worn piece relinks after a round trip - equipSlot is the UID');
  for (const it of slots.filter(Boolean)) assert.ok(foe.items.includes(it), 'identity, against the restored collection');
});

test('a PRE-FIX snapshot still restores - the link always rode inside the items', () => {
  // A snapshot written before this wave carried the items with their
  // own equipSlot (equipItem stamps it) PLUS a now-ignored RightHand
  // index. The whole-table relink subsumes that index: it reads the
  // same items, so the old envelope restores - and restores better.
  const saved = knight();
  const legacy = {
    items: saved.items.map((it) => ({ ...it })),
    equipRight: saved.items.indexOf(saved.weapon),   // the removed equippedWeaponIndex
  };
  assert.ok(legacy.equipRight >= 0, 'the pre-fix envelope really carried a right-hand index');

  const foe = restoreFoe(knight(), legacy.items);
  // what the OLD code produced for the right hand, reproduced exactly:
  const oldWeapon = foe.items[legacy.equipRight];
  assert.equal(foe.weapon, oldWeapon, 'the right hand lands where the pre-fix restore put it');
  assert.deepEqual(
    { templateIndex: foe.weapon.templateIndex, material: foe.weapon.material, currentCondition: foe.weapon.currentCondition },
    { templateIndex: saved.weapon.templateIndex, material: saved.weapon.material, currentCondition: saved.weapon.currentCondition },
    'and it is the weapon the old save recorded',
  );
  // an envelope with no items at all leaves an empty table, not a throw
  const empty = knight();
  restoreFoe(empty, []);
  assert.equal(equipTableOf(empty).filter(Boolean).length, 0, 'nothing to relink leaves the table cleared (Clear(), :358)');
  assert.equal(empty.weapon, null, 'and a bare RightHand reads as no weapon');
});

test('a saved CORPSE relinks to an empty table - CompleteDeath already unequipped it (EnemyDeath.cs:107-117)', () => {
  // "This is still required so enemy equipment is not marked as
  // equipped / This item collection is transferred to loot container
  // below" - CompleteDeath walks Head..Feet inclusive and unequips
  // every slot, so a dead foe's items carry no slot at all and its
  // right hand is empty. DFU reads that hand live as
  // ItemEquipTable.GetItem(EquipSlots.RightHand), which is null for a
  // corpse; the port's cached entity.weapon now follows it, where the
  // RightHand-only index used to hand a corpse its blade back.
  const saved = knight();
  unequipEnemyOnDeath(saved);
  assert.equal(equipTableOf(saved).filter(Boolean).length, 0, 'the corpse wears nothing');
  for (const it of saved.items) assert.equal('equipSlot' in it, false, 'and no item is still marked equipped (FilterLocalItems would hide it)');

  const foe = restoreFoe(knight(), saved.items.map((it) => ({ ...it })));
  assert.equal(equipTableOf(foe).filter(Boolean).length, 0, 'so nothing relinks on restore');
  assert.equal(foe.weapon, null, 'and the restored corpse holds no weapon');
  assert.equal(foe.items.length, saved.items.length, 'while every piece is still there to loot');
});
