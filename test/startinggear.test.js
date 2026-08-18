// S3d: AssignStartingGear (ItemHelper.cs:1277-1364) verbatim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignStartingGear, STARTING_WEAPON_BY_CLASS, STARTING_MATERIAL_BY_CLASS, ARCHER_CLASS_INDEX, ARCHER_ARROWS, STARTING_GOLD } from '../src/systems/startingGear.js';
import { EQUIP_SLOTS, isEquipped } from '../src/systems/equip.js';
import { CLOTHING_DYES } from '../src/characters/dyes.js';
import { goldAmount } from '../src/systems/court.js';

const ent = (gender = 'male') => ({ gender, items: [] });
const byTemplate = (e, t) => e.items.find((i) => i.templateIndex === t);

test('startingGear: the class weapon tables verbatim', () => {
  // StartingWeaponTypesByClass / StartingWeaponMaterialsByClass in
  // career order (Mage .. Knight). Pinned WHOLE - a spot check would
  // survive shuffling a class's weapon.
  assert.deepEqual([...STARTING_WEAPON_BY_CLASS], [
    116, 119, 119, 116, 124, 116, 116, 114, 119, 116, 116, 120, 115, 130, 127, 126, 118, 120,
  ]);
  assert.deepEqual([...STARTING_MATERIAL_BY_CLASS], [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0]);
  assert.equal(STARTING_WEAPON_BY_CLASS.length, 18, 'one per classic career');
  assert.equal(STARTING_MATERIAL_BY_CLASS.length, 18);
  // spot-read the ones a player would notice
  assert.equal(STARTING_WEAPON_BY_CLASS[0], 116, 'Mage: Shortsword');
  assert.equal(STARTING_MATERIAL_BY_CLASS[0], 1, 'Mage: STEEL');
  assert.equal(STARTING_WEAPON_BY_CLASS[16], 118, 'Warrior: Broadsword');
  assert.equal(STARTING_WEAPON_BY_CLASS[13], 130, 'Archer: Long Bow');
  assert.equal(STARTING_WEAPON_BY_CLASS[12], 115, 'Monk: Staff');
});

test('startingGear: a male Warrior begins dressed, armed and funded', () => {
  const e = ent('male');
  assignStartingGear(e, { classIndex: 16, rolls: () => 0.5 });
  // gender-specific clothes, EQUIPPED
  const shirt = byTemplate(e, 165), pants = byTemplate(e, 151);
  assert.ok(shirt && pants, "men get Short_shirt 165 + Casual_pants 151");
  assert.equal(shirt.equipSlot, EQUIP_SLOTS.ChestClothes);
  assert.equal(pants.equipSlot, EQUIP_SLOTS.LegsClothes);
  assert.ok(CLOTHING_DYES.includes(shirt.dye), 'the shirt takes a RandomClothingDye');
  assert.ok(pants.variant >= 0 && pants.variant < 4, 'the pants take a random variant');
  // spellbook: carried, never worn
  const book = byTemplate(e, 132);
  assert.ok(book, 'every player starts with a Spellbook');
  assert.equal(isEquipped(book), false);
  // the class weapon, unequipped (classic hands it over sheathed)
  const weapon = byTemplate(e, 118);
  assert.ok(weapon, 'Warrior: Broadsword');
  assert.equal(weapon.material, 0, 'iron');
  assert.equal(goldAmount(e), STARTING_GOLD);
  // no torches by default - PlayerTorchFromItems is a DFU setting
  assert.equal(byTemplate(e, 247), undefined);
  assert.equal(byTemplate(e, 253), undefined);
});

test('startingGear: women get their own clothing templates', () => {
  const e = ent('female');
  assignStartingGear(e, { classIndex: 0, rolls: () => 0.5 });
  assert.ok(byTemplate(e, 206), 'women get Short_shirt_closed 206');
  assert.ok(byTemplate(e, 190), 'women get their own Casual_pants 190');
  assert.equal(byTemplate(e, 165), undefined, "not the men's shirt");
  assert.equal(byTemplate(e, 151), undefined, "not the men's pants");
  assert.equal(byTemplate(e, 206).equipSlot, EQUIP_SLOTS.ChestClothes);
});

test('startingGear: the ARCHER alone gets the axe and the arrow stack', () => {
  const archer = ent('male');
  assignStartingGear(archer, { classIndex: ARCHER_CLASS_INDEX, rolls: () => 0.5 });
  assert.ok(byTemplate(archer, 130), 'Long Bow');
  const axe = byTemplate(archer, 127);
  assert.ok(axe, 'plus a Battle Axe');
  assert.equal(axe.material, 1, 'STEEL axe');
  const arrows = byTemplate(archer, 131);
  assert.equal(arrows?.stackCount, ARCHER_ARROWS, '24 arrows');
  assert.equal(arrows.material, 0, 'iron arrows');
  // the Ranger also carries a battle axe as its CLASS weapon - but no
  // bow and no arrows, so the archer branch is genuinely archer-only
  const ranger = ent('male');
  assignStartingGear(ranger, { classIndex: 14, rolls: () => 0.5 });
  assert.ok(byTemplate(ranger, 127), 'Ranger: Battle Axe as the class weapon');
  assert.equal(byTemplate(ranger, 131), undefined, 'no arrows');
  assert.equal(byTemplate(ranger, 130), undefined, 'no bow');
});

test('startingGear: a custom class gets an iron longsword, and torches ride the DFU setting', () => {
  const custom = ent('male');
  assignStartingGear(custom, { classIndex: 16, isCustom: true, rolls: () => 0.5 });
  const sword = byTemplate(custom, 120);
  assert.ok(sword, 'custom classes get a Longsword');
  assert.equal(sword.material, 0, 'iron');
  assert.equal(byTemplate(custom, 118), undefined, 'not the class table weapon');
  // PlayerTorchFromItems is a DFU enhancement, not classic - ported
  // but defaulted off
  const lit = ent('male');
  assignStartingGear(lit, { classIndex: 16, rolls: () => 0.5, torchesFromItems: true });
  assert.equal(lit.items.filter((i) => i.templateIndex === 247).length, 5, '5 torches');
  assert.equal(lit.items.filter((i) => i.templateIndex === 253).length, 2, '2 candles');
});

test('startingGear: every minted item carries a value (the 17e F2 root fix)', () => {
  const e = ent('male');
  assignStartingGear(e, { classIndex: 13, rolls: () => 0.5 });
  for (const it of e.items) {
    if (it.group === 'Currency') continue;
    assert.ok(it.value >= 1, `no item may reach the shop without a value: ${JSON.stringify(it)}`);
    assert.ok(it.name, `and every item is named: ${JSON.stringify(it)}`);
  }
});
