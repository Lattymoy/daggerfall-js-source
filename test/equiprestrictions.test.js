// S23: THE CAREER EQUIP RESTRICTIONS
// (DaggerfallInventoryWindow.EquipItem :1343-1381, MIT, Daggerfall
// Workshop). 17 of the 18 classic classes carry these and the port had
// never enforced one of them - AUDIT 17n found the fields with zero
// consumers, and U20b then made the same restrictions purchasable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isForbiddenEquip, weaponProficiencyFlag, FORBIDDEN_EQUIPMENT_TEXT_ID } from '../src/systems/equip.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { parseCareerData } from '../src/systems/specialAdvantages.js';
import { buildCustomCareer } from '../src/systems/customClass.js';
import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import { ClassFile } from '../src/formats/classFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

/** a career with nothing forbidden, then bits set by hand */
const bare = () => buildCustomCareer({
  name: 'X', hp: 8, skills: Array(12).fill(0),
  stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 50])),
});
const armor = (material, templateIndex = 102) => ({ group: 'Armor', templateIndex, material, name: 'Cuirass' });
const shield = (templateIndex) => ({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Iron, name: 'Shield' });
const weapon = (name, material = 0) => ({ group: 'Weapons', templateIndex: 0, material, name });

test('S23: forbidden ARMOR TYPE blocks by the material\'s high byte', () => {
  // :1352 - `1 << (NativeMaterialValue >> 8) & ForbiddenArmors`, and
  // the port's ARMOR_MATERIAL values ARE that raw value.
  const c = bare();
  parseCareerData(c, [{ primary: 'forbiddenArmorType', secondary: 'plate' }]);
  assert.equal(isForbiddenEquip(c, armor(ARMOR_MATERIAL.Iron)), true, 'iron is plate');
  assert.equal(isForbiddenEquip(c, armor(ARMOR_MATERIAL.Daedric)), true, 'so is daedric');
  assert.equal(isForbiddenEquip(c, armor(ARMOR_MATERIAL.Leather)), false);
  assert.equal(isForbiddenEquip(c, armor(ARMOR_MATERIAL.Chain)), false);
  // Chain2 (0x0103) is chain too - the drift armorMaterials.js warns about
  assert.equal(isForbiddenEquip(c, armor(ARMOR_MATERIAL.Chain2)), false, 'Chain2 must not read as plate');
});

test('S23: the armor MATERIAL test is gated on PLATE only - a verbatim quirk', () => {
  // :1356-1358 - `((nativeMaterialValue >> 8) == 2) && ...`.
  //
  // The gate BITES on Chain2. Its raw value is 0x0103, so its low byte
  // is 3 - the same index Elven occupies in the plate block - while its
  // high byte says chain. Without the plate-only gate a career that
  // forbids ELVEN would refuse a Chain2 piece that has nothing to do
  // with elven metal. That is the case this pin exists for; a
  // "daedric chain" cannot be built, because chain carries no material
  // in its low byte the way plate does.
  const elven = bare();
  parseCareerData(elven, [{ primary: 'forbiddenMaterial', secondary: 'elven' }]);
  assert.equal(isForbiddenEquip(elven, armor(ARMOR_MATERIAL.Elven)), true, 'elven PLATE is refused (0x0203)');
  assert.equal(isForbiddenEquip(elven, armor(ARMOR_MATERIAL.Chain2)), false,
    'Chain2 (0x0103) shares the low byte and must NOT be refused - the gate is plate-only');
  const c = bare();
  parseCareerData(c, [{ primary: 'forbiddenMaterial', secondary: 'daedric' }]);
  assert.equal(isForbiddenEquip(c, armor(ARMOR_MATERIAL.Daedric)), true, 'daedric PLATE is refused');
  assert.equal(isForbiddenEquip(c, armor(ARMOR_MATERIAL.Ebony)), false, 'another plate material is fine');
  assert.equal(isForbiddenEquip(c, armor(ARMOR_MATERIAL.Chain)), false, 'and plain chain never carries a material');
});

test('S23: forbidden SHIELDS index from the Buckler template', () => {
  // :1348 - `1 << (TemplateIndex - Armor.Buckler)`; 109..112.
  const c = bare();
  parseCareerData(c, [{ primary: 'forbiddenShieldTypes', secondary: 'towerShield' }]);
  assert.equal(isForbiddenEquip(c, shield(112)), true, 'tower shield');
  for (const t of [109, 110, 111]) assert.equal(isForbiddenEquip(c, shield(t)), false, `template ${t}`);
  // a shield is tested as a SHIELD, never as body armor - its material
  // must not route into the armor-type branch
  const plateBan = bare();
  parseCareerData(plateBan, [{ primary: 'forbiddenArmorType', secondary: 'plate' }]);
  assert.equal(isForbiddenEquip(plateBan, shield(109)), false, 'an iron buckler is not "plate armor"');
});

test('S23: forbidden WEAPONRY blocks by proficiency, and by flat material', () => {
  // :1363-1367. Weapons carry the flat 0..9 material index, not the
  // packed armor value.
  const c = bare();
  parseCareerData(c, [{ primary: 'forbiddenWeaponry', secondary: 'axe' }]);
  assert.equal(isForbiddenEquip(c, weapon('Battle Axe')), true);
  assert.equal(isForbiddenEquip(c, weapon('War Axe')), true, 'both axes share the proficiency');
  assert.equal(isForbiddenEquip(c, weapon('Longsword')), false);
  const m = bare();
  parseCareerData(m, [{ primary: 'forbiddenMaterial', secondary: 'daedric' }]);
  assert.equal(isForbiddenEquip(m, weapon('Longsword', 9)), true, 'daedric = index 9');
  assert.equal(isForbiddenEquip(m, weapon('Longsword', 0)), false, 'iron = index 0');
});

test('S23: GetWeaponSkillUsed maps the port\'s own weapon partition', () => {
  // :910-940 as ProficiencyFlags, mapped across WEAPON_SKILL rather
  // than minting a second weapon table.
  assert.equal(weaponProficiencyFlag(weapon('Dagger')), 1, 'ShortBlades');
  assert.equal(weaponProficiencyFlag(weapon('Claymore')), 2, 'LongBlades');
  assert.equal(weaponProficiencyFlag(weapon('War Axe')), 8, 'Axes');
  assert.equal(weaponProficiencyFlag(weapon('Warhammer')), 16, 'BluntWeapons');
  assert.equal(weaponProficiencyFlag(weapon('Long Bow')), 32, 'MissileWeapons');
  // Skills.None = -1 for a template DFU does not name (:938). -1 masks
  // against every bit, so an unnamed weapon-group item reads as
  // forbidden to any career with any forbidden proficiency at all.
  assert.equal(weaponProficiencyFlag(weapon('Arrow')), -1);
  const c = bare();
  parseCareerData(c, [{ primary: 'forbiddenWeaponry', secondary: 'axe' }]);
  assert.equal(isForbiddenEquip(c, weapon('Arrow')), true, 'the -1 quirk, ported deliberately');
});

test('S23: an unrestricted career forbids nothing, and a null career never throws', () => {
  const c = bare();
  for (const it of [armor(ARMOR_MATERIAL.Daedric), shield(112), weapon('Battle Axe', 9)]) {
    assert.equal(isForbiddenEquip(c, it), false);
  }
  assert.equal(isForbiddenEquip(null, weapon('Dagger')), false, 'the pre-chargen entity has no career');
  assert.equal(isForbiddenEquip(c, null), false);
  // groups the rule does not cover
  assert.equal(isForbiddenEquip(c, { group: 'Books', templateIndex: 500, material: 0 }), false);
  assert.equal(FORBIDDEN_EQUIPMENT_TEXT_ID, 1068);
});

test('S23: the CLASSIC classes are restricted exactly as their files say', { skip: skipReal }, () => {
  // The whole point of the slice: these are not custom-class rules.
  const load = (i) => {
    const cf = new ClassFile();
    cf.load(new Uint8Array(readFileSync(join(ARENA2, `CLASS${String(i).padStart(2, '0')}.CFG`))));
    return cf.career;
  };
  const byName = new Map();
  for (let i = 0; i < 18; i++) { const c = load(i); byName.set(c.name, c); }

  const mage = byName.get('Mage');
  assert.equal(isForbiddenEquip(mage, armor(ARMOR_MATERIAL.Iron)), true, 'a Mage cannot wear plate');
  assert.equal(isForbiddenEquip(mage, armor(ARMOR_MATERIAL.Chain)), true, 'nor chain');
  assert.equal(isForbiddenEquip(mage, armor(ARMOR_MATERIAL.Leather)), false, 'leather is fine');
  assert.equal(isForbiddenEquip(mage, weapon('Battle Axe')), true, 'nor an axe');
  // the live probe reached for a Longsword as the Mage's ALLOWED
  // weapon and was rightly refused: the Mage forbids longBlade, axe
  // AND missileWeapon, so only short blades and blunt remain
  assert.equal(isForbiddenEquip(mage, weapon('Longsword')), true, 'a Mage cannot draw a LONG blade');
  assert.equal(isForbiddenEquip(mage, weapon('Long Bow')), true, 'nor a bow');
  assert.equal(isForbiddenEquip(mage, weapon('Dagger')), false, 'a short blade is fine');
  assert.equal(isForbiddenEquip(mage, weapon('Staff')), false, 'and so is a staff');
  assert.equal(isForbiddenEquip(mage, shield(112)), true, 'no tower shield');
  assert.equal(isForbiddenEquip(mage, shield(109)), false, 'a buckler is fine');

  const monk = byName.get('Monk');
  for (const m of [ARMOR_MATERIAL.Leather, ARMOR_MATERIAL.Chain, ARMOR_MATERIAL.Iron]) {
    assert.equal(isForbiddenEquip(monk, armor(m)), true, 'a Monk wears NO armor');
  }
  for (const t of [109, 110, 111, 112]) assert.equal(isForbiddenEquip(monk, shield(t)), true, 'and carries no shield');

  const knight = byName.get('Knight');
  assert.equal(isForbiddenEquip(knight, armor(ARMOR_MATERIAL.Leather)), true, 'a Knight refuses LEATHER');
  assert.equal(isForbiddenEquip(knight, armor(ARMOR_MATERIAL.Iron)), false, 'and wears plate');

  const barb = byName.get('Barbarian');
  assert.equal(isForbiddenEquip(barb, weapon('Longsword', 9)), true, 'a Barbarian refuses a daedric blade');
  assert.equal(isForbiddenEquip(barb, weapon('Longsword', 0)), false, 'but not an iron one');

  const warrior = byName.get('Warrior');
  for (const it of [armor(ARMOR_MATERIAL.Iron), shield(112), weapon('Battle Axe', 9)]) {
    assert.equal(isForbiddenEquip(warrior, it), false, 'the Warrior is the one class with no restrictions');
  }
});
