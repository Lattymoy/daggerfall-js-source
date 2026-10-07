// MEND-WORN (2026-10-07, Mac: "Now we just gotta fix the 'repairs objects' not working"; asked, "Weapons as a classic
// dagger"). Repairs Objects ran - a point every four rounds, on the FIRST piece below its condition in the whole pack,
// DFU's law since 2022 (RepairsObjects.cs:86-101). The port's default pack is Roleplay & Realism's: its kit worn to
// 30-75%, its loot at 20-75%, beside the port's own pieces whose condition is their uses. So every tick went to the
// oldest worn thing carried and nothing worn was seen to mend, and WEAPON-POOL's pools left a weapon a point a tick.
// Now: what is worn first, the most worn first, then the pack (the repair kit's order - one export); never what a
// smith refuses (a quiver, a light's fuel, a supply's doses); a weapon on the pool mends a classic dagger's share, 32.
// Every piece is minted by its real producer, and the rounds are the pump's.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENCHANTMENT_TYPES as T, enchantmentMagicRound, repairsObjectsTarget, isEnchantedItem, POOL_WEAPON_MEND, CONDITION_AMOUNT,
} from '../src/systems/enchantments.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';
import { equipItem, lowerCondition } from '../src/systems/equip.js';
import { weaponOfMaterial, armorOfMaterial, createWeapon, ARROW_TEMPLATE } from '../src/combat/enemyEquipment.js';
import { WEAPONS, WEAPON_MATERIALS, WEAPON_CONDITION_POOL } from '../src/characters/weapons.js';
import { ITEM_TEMPLATES, mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { applyRarity, legendaryById } from '../src/systems/lootRarity.js';
import { createRegularMagicItem, ITEM_ARTIFACT_MASK } from '../src/systems/loot.js';
import { classicItemFromRecord } from '../src/systems/classicSave.js';
import { randomConditionLootItems } from '../src/systems/rriRealism.js';
import { assignSkillEquipment } from '../src/systems/rriKits.js';
import { SKILLS } from '../src/systems/skills.js';
import { createRestItem, REST_ITEM, spendCharge } from '../src/systems/restItems.js';
import { createSurvivalItem } from '../src/systems/survival/items.js';
import { TEMPLATE } from '../src/systems/survival/food.js';
import { repairRefusal } from '../src/systems/repairService.js';
import { useItem } from '../src/systems/useItem.js';
import { tickPlayerTorch } from '../src/systems/playerTorch.js';
import { mintFieldRepairKit, repairKitTargets } from '../src/systems/smithItems.js';
import { getBool, setValue, _resetForTests } from '../src/systems/settings.js';

const CUIRASS = 102, HELM = 107, BOOTS = 108, KITE_SHIELD = 111, RING = 135, BOOK = 277, SHIRT = 165, TORCH = 247;
const IRON_PLATE = 0x0200;
const seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const player = () => ({ isPlayer: true, level: 10, gender: 'male', activeEffects: [], health: 60, maxHealth: 60, items: [], spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } });
const share = (it) => it.currentCondition / it.maxCondition;
/** A piece at `pct` of its condition. */
const at = (item, pct) => { item.currentCondition = Math.round(item.maxCondition * pct / 100); return item; };
/** A ring of Repairs Objects, as the item maker and a Rare's flavour store it: the classic type, the number. */
const repairsRing = () => Object.assign(mintCondition(setItemFields({ group: 'Jewellery', templateIndex: RING })), { enchantments: [{ type: T.RepairsObjects, param: -1 }] });
/** A player wearing `pieces` and the ring, with `carried` in the pack beside them. */
const wearing = (pieces, carried = []) => {
  const p = player();
  const ring = repairsRing();
  p.items.push(...pieces, ring, ...carried);
  for (const it of [...pieces, ring]) equipItem(p, it);
  return p;
};
/** One tick on the round's cadence (RepairsObjects.cs:83 - every fourth). */
const tick = (p, round = 4, allowMagicRepairs = false) => enchantmentMagicRound(p, round, { ctx: { allowMagicRepairs } });
const gain = (piece, allowMagicRepairs = false) => {
  const p = wearing([piece]);
  const from = piece.currentCondition;
  tick(p, 4, allowMagicRepairs);
  return piece.currentCondition - from;
};
/** DFU's walk since 6846029b4 (RepairsObjects.cs:86-101): the first piece below its condition, in the pack's order. */
const dfuPick = (items, allowMagicRepairs) => items.find((it) => it && it.currentCondition < it.maxCondition && !(isEnchantedItem(it) && !allowMagicRepairs)) ?? null;

test('MEND-WORN: the field - Roleplay & Realism\'s kit put on, beside its worn loot: DFU\'s walk mends the shoes nobody wears, MEND-WORN the worn piece with the least share left, one a tick', () => {
  const p = player();
  p.career = { primarySkills: [SKILLS.Running, SKILLS.LongBlade, SKILLS.Streetwise], majorSkills: [], luck: 50 };
  assignSkillEquipment(p, { rolls: seeded(11), torchesFromItems: false });
  // the kit's blade and cuirass, worn to its 30-75% (AddOrEquipWornItem), put on; its shoes carried
  const blade = p.items.find((it) => it.group === 'Weapons' && it.currentCondition < it.maxCondition);
  const cuirass = p.items.find((it) => it.group === 'Armor');
  equipItem(p, blade);
  equipItem(p, cuirass);
  // a looted book and axe at the mod's 20-75% (RandomConditionFoundLootItems), and a fight's wear on the blade
  p.items.push(...randomConditionLootItems([mintCondition(setItemFields({ group: 'Books', templateIndex: BOOK })), weaponOfMaterial(WEAPONS.Battle_Axe, WEAPON_MATERIALS.Steel)], seeded(5)));
  lowerCondition(blade, blade.currentCondition - Math.trunc(blade.maxCondition * 0.3), p);
  const ring = repairsRing();
  p.items.push(ring);
  equipItem(p, ring);
  const first = dfuPick(p.items, true);
  assert.deepEqual([first?.name, first?.equipSlot], ['Shoes', undefined], 'the fixture is the field\'s: DFU\'s walk mends the shoes, carried and not worn');
  const start = new Map(p.items.map((it) => [it, it.currentCondition]));
  for (let round = 4; round <= 160; round += 4) {
    const worn = p.items.filter((it) => it.equipSlot != null && it.currentCondition < it.maxCondition);
    const want = worn.reduce((a, b) => (share(b) < share(a) ? b : a));
    const before = new Map(p.items.map((it) => [it, it.currentCondition]));
    tick(p, round, true);
    const moved = p.items.filter((it) => it.currentCondition !== before.get(it));
    assert.deepEqual(moved.map((it) => it.name), [want.name], `round ${round}: one piece, the worn one with the least share left`);
    assert.equal(want.currentCondition - before.get(want), want === blade ? POOL_WEAPON_MEND : CONDITION_AMOUNT);
  }
  const mended = (it) => it.currentCondition - start.get(it);
  assert.ok(mended(blade) >= 5 * POOL_WEAPON_MEND, `the blade in hand, the most worn, took the first ticks (${mended(blade)})`);
  assert.deepEqual(p.items.filter((it) => it.equipSlot == null && mended(it) !== 0).map((it) => it.name), [], 'nothing carried was touched');
});

test('MEND-WORN: a weapon on the pool mends the share a classic Dagger did - 32 a tick, iron 2% and Daedric 0.25% - every other piece DFU\'s point, and nothing past its condition', () => {
  assert.equal(POOL_WEAPON_MEND, WEAPON_CONDITION_POOL / ITEM_TEMPLATES[WEAPONS.Dagger].hitPoints, 'the Dagger row\'s 50, on the pool');
  assert.equal(POOL_WEAPON_MEND, 32);
  assert.equal(CONDITION_AMOUNT, 1, 'RepairsObjects.cs:26 conditionAmount');
  const dagger = at(weaponOfMaterial(WEAPONS.Dagger, WEAPON_MATERIALS.Iron), 20);
  assert.equal(dagger.maxCondition, 1600);
  assert.equal(gain(dagger), 32);
  assert.equal(POOL_WEAPON_MEND / dagger.maxCondition, 1 / ITEM_TEMPLATES[WEAPONS.Dagger].hitPoints, 'iron: what a classic iron dagger got, 2% a tick');
  const hammer = at(weaponOfMaterial(WEAPONS.Warhammer, WEAPON_MATERIALS.Daedric), 20);
  assert.equal(hammer.maxCondition, 12800);
  assert.equal(gain(hammer), 32, 'Daedric 0.25% a tick - and the type does not matter, the pool is one');
  assert.equal(gain(at(weaponOfMaterial(WEAPONS.Short_Bow, WEAPON_MATERIALS.Elven), 20)), 32);
  assert.equal(gain(at(armorOfMaterial(CUIRASS, IRON_PLATE), 20)), 1, 'armour keeps DFU\'s point');
  assert.equal(gain(at(mintCondition(setItemFields({ group: 'MensClothing', templateIndex: SHIRT })), 20)), 1, 'clothing too');
  const nearly = weaponOfMaterial(WEAPONS.Longsword, WEAPON_MATERIALS.Iron);
  nearly.currentCondition = nearly.maxCondition - 10;
  assert.equal(gain(nearly), 10, 'never past its condition');
  assert.equal(nearly.currentCondition, nearly.maxCondition);
});

test('MEND-WORN: a magic item\'s and an artifact\'s condition is their uses, not the pool - each keeps DFU\'s point, and the artifact its own maximum', () => {
  // MAGIC.DEF's record, through the real producer: group 2 is always a weapon, its condition the record's uses
  const magicDef = [{ index: 0, name: 'Blade of the Test', type: 0, group: 2, groupIndex: 0, enchantments: [{ type: T.PotentVs, param: 0 }], uses: 1000, value: 0, material: 0 }];
  const blade = createRegularMagicItem(magicDef, 1, 'male', seeded(2));
  assert.deepEqual([blade.group, blade.magic, blade.maxCondition], ['Weapons', true, 1000]);
  blade.currentCondition = 500;
  assert.equal(gain(blade, true), 1, 'a magic weapon: one use back a tick');
  // a classic save's artifact, through the importer: `artifact` and never `magic` (AUDIT WEAPON-POOL P4)
  const artifact = classicItemFromRecord({ parsedData: { group: 3, index: 0, name: 'Dagger', material: WEAPON_MATERIALS.Daedric, value: 1, flags: ITEM_ARTIFACT_MASK, currentCondition: 300, maxCondition: 400, typeDependentData: 0, enchantmentPoints: 0, message: 0, magic: [] } });
  assert.deepEqual([artifact.group, artifact.artifact, artifact.magic], ['Weapons', true, undefined]);
  assert.equal(gain(artifact, true), 1);
  assert.equal(artifact.maxCondition, 400, 'its uses, not moved to the pool');
});

test('MEND-WORN: nothing a smith refuses - DFU\'s quiver minted at 0 and its lit torch\'s fuel, the port\'s bedroll nights and campfire fuel - are passed by for the axe', () => {
  const quiver = createWeapon(ARROW_TEMPLATE, 0, () => 0.5);
  assert.equal(share(quiver), 0, 'DFU mints a quiver at 0 (ItemBuilder.CreateWeapon) - the most worn piece any repair could find');
  const bedroll = createRestItem(REST_ITEM.Bedroll);
  for (let i = 0; i < 8; i++) spendCharge(bedroll, null);
  const campfire = createSurvivalItem(TEMPLATE.Campfire, { condition: 3 });
  const torch = mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: TORCH }));
  const axe = at(weaponOfMaterial(WEAPONS.Battle_Axe, WEAPON_MATERIALS.Iron), 60);
  const p = wearing([], [quiver, torch, bedroll, campfire, axe]);
  // the torch lit and burned on its own law, a point every twenty seconds (EnablePlayerTorch.Update)
  assert.equal(useItem(torch, p.items, { entity: p }).kind, 'lit');
  for (let i = 0; i < 30; i++) tickPlayerTorch(p, 21, { fromItems: true });
  assert.equal(torch.currentCondition, torch.maxCondition - 30);
  for (const it of [quiver, torch, bedroll, campfire]) {
    assert.ok(share(it) < share(axe), `${it.name} is more worn than the axe, by the order alone`);
    assert.equal(repairRefusal(it), 'notRepairable', `the smith refuses the ${it.name}`);
  }
  const before = [quiver, torch, bedroll, campfire].map((it) => it.currentCondition);
  tick(p);
  assert.deepEqual([quiver, torch, bedroll, campfire].map((it) => it.currentCondition), before);
  assert.equal(axe.currentCondition, Math.round(axe.maxCondition * 0.6) + POOL_WEAPON_MEND);
});

test('MEND-WORN: an enchanted piece mends only under AllowMagicRepairs - the Wall of Daggerfall mends itself at the port\'s default, and a player\'s own Off passes it for the helm (DISC22-A)', () => {
  _resetForTests();
  try {
    const wall = at(applyRarity(armorOfMaterial(KITE_SHIELD, IRON_PLATE), 'legendary', () => 0, [legendaryById('wall-of-daggerfall')]), 30);
    assert.deepEqual(wall.enchantments, [{ type: T.RepairsObjects, param: -1 }], 'the legendary\'s own power');
    const helm = at(armorOfMaterial(HELM, IRON_PLATE), 60);
    const p = player();
    p.items.push(helm, wall);
    equipItem(p, helm);
    equipItem(p, wall);
    assert.equal(getBool('Controls', 'AllowMagicRepairs'), true, 'the port\'s default');
    const [w0, h0] = [wall.currentCondition, helm.currentCondition];
    tick(p, 4, getBool('Controls', 'AllowMagicRepairs'));
    assert.deepEqual([wall.currentCondition - w0, helm.currentCondition - h0], [1, 0], '"The gate fell; this did not." - the most worn, itself');
    setValue('Controls', 'AllowMagicRepairs', 'False');
    tick(p, 8, getBool('Controls', 'AllowMagicRepairs'));
    assert.deepEqual([wall.currentCondition - w0, helm.currentCondition - h0], [1, 1], 'Off: the enchanted wall passed by, the helm mended');
  } finally {
    _resetForTests();
  }
});

test('MEND-WORN: through the pump every host shares, a worn piece mends once every fourth round - and only a player\'s (RepairsObjects.cs:79)', () => {
  const cuirass = at(armorOfMaterial(CUIRASS, IRON_PLATE), 50);
  const p = wearing([cuirass]);
  const from = cuirass.currentCondition;
  assert.equal(runMagicRoundsFor(p, 0, 40, { sinks: {} }), 40);
  assert.equal(cuirass.currentCondition - from, 10, 'rounds 4, 8 ... 40');
  const foesCuirass = at(armorOfMaterial(CUIRASS, IRON_PLATE), 50);
  const foe = wearing([foesCuirass]);
  foe.isPlayer = false;
  runMagicRoundsFor(foe, 0, 40, { sinks: {} });
  assert.equal(foesCuirass.currentCondition, from, 'a foe\'s ring mends nothing');
});

test('MEND-WORN: a weapon still on its row\'s pool moves to the one pool before it mends, at its share - the door lowerCondition keeps before a wear (AUDIT WEAPON-POOL P2)', () => {
  const old = Object.assign(weaponOfMaterial(WEAPONS.Dagger, WEAPON_MATERIALS.Iron), { maxCondition: 50, currentCondition: 10 });   // the mint before WEAPON-POOL
  assert.equal(gain(old), 320 + POOL_WEAPON_MEND - 10, '10 of 50 is 320 of 1,600, and the tick lands on the pool');
  assert.deepEqual([old.maxCondition, old.currentCondition], [1600, 352]);
});

test('MEND-WORN: one order, the repair kit\'s and Repairs Objects\' - worn first, the most worn first, then the pack\'s most worn', () => {
  const sword = at(weaponOfMaterial(WEAPONS.Longsword, WEAPON_MATERIALS.Iron), 60);
  const cuirass = at(armorOfMaterial(CUIRASS, IRON_PLATE), 50);
  const axe = at(weaponOfMaterial(WEAPONS.Battle_Axe, WEAPON_MATERIALS.Iron), 20);
  const kit = mintFieldRepairKit();
  const p = wearing([sword, cuirass], [kit, axe]);
  assert.equal(repairKitTargets(kit, p.items)[0], cuirass, 'the kit: worn, and the most worn of what is worn');
  assert.equal(repairsObjectsTarget(p.items), cuirass, 'Repairs Objects: the same piece');
  sword.currentCondition = sword.maxCondition;
  cuirass.currentCondition = cuirass.maxCondition;
  assert.equal(repairKitTargets(kit, p.items)[0], axe);
  assert.equal(repairsObjectsTarget(p.items), axe, 'nothing worn wants it: the pack\'s most worn');
  // two worn pieces at one share keep the pack's order, not the equip table's (the boots' Feet is after the helm's Head)
  const helm = at(armorOfMaterial(HELM, IRON_PLATE), 40), boots = at(armorOfMaterial(BOOTS, IRON_PLATE), 40);
  const q = wearing([boots, helm]);
  assert.equal(share(helm), share(boots));
  assert.ok(helm.equipSlot < boots.equipSlot);
  assert.equal(repairsObjectsTarget(q.items), boots);
});
