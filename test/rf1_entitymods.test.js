// RF1 - ENTITY MODIFIER CHANNELS (2026-09-14, Mac: "is there anything in
// the codebase that can benefit from a refactor. This is our first time
// going against parity with DFU ... Lets tackle each one at a time").
//
// The first departure (loot rarity) had to add its own term inside
// five DFU-verbatim formulas beside the enchantment fold's. Now every
// producer is a FOLD registered in one home (systems/entityMods.js),
// summed onto one field at the two seams a worn set changes, and each
// formula reads ONE accessor per channel that adds DFU's own channel.
// The laws pinned here:
//   - ONE FIELD, ONE READ: the sum lands on entity._mods; the formulas
//     read entityArmorMod / entityWeightMult / weaponDamageMods /
//     entityResistMod, the leaves read the field.
//   - DFU'S CHANNEL IS INSIDE THE ACCESSOR: an enchantment's armour or
//     skill or weight channel is added there, verbatim, min-set quirks
//     and all.
//   - OFF IS DFU EXACTLY: no fold, or every fold empty, and every
//     accessor answers the enchantment channel alone.
//   - THE SEAMS: the equip listener and the magic round run the folds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  registerEntityFold, registerWeaponDamageMod, computeEntityMods, entityModsOf, entityFoldNames, newMods, EMPTY_MODS, NUMBER_BODY_PARTS,
  entityArmorMod, entityArmorDisplayMod, entitySkillMod, entityStatMod, entityWeightMult, entityResistMod, weaponDamageMods,
} from '../src/systems/entityMods.js';
import { computeEnchantmentMods, ENCHANTMENT_TYPES as T } from '../src/systems/enchantments.js';
import { equipItem, unequipItem, rebuildEquipState } from '../src/systems/equip.js';
import { liveStat } from '../src/systems/statMods.js';
import { skillValue, SKILLS } from '../src/systems/skills.js';
import { entityMaxEncumbrance, maxEncumbrance, calculateSuccessfulHit } from '../src/combat/formulas.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const entityOf = () => ({ isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, health: 20, maxHealth: 30, activeEffects: [] });
const ring = () => mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 });
const strengthens = () => ({ ...ring(), enchantments: [{ type: T.StrengthensArmor, param: -1 }] });

test('RF1: a fold registers, runs at computeEntityMods, sums with the others onto entity._mods, and unregisters', () => {
  const before = entityFoldNames();
  registerEntityFold('rf1-a', () => ({ armorParts: [1, 0, 0, 2, 0, 0, 0], stats: { strength: 3 }, skills: { [SKILLS.Stealth]: 4 }, resist: { fire: 5 }, weightMult: 0.1 }));
  registerEntityFold('rf1-b', () => ({ armorParts: [1, 0, 0, 0, 0, 0, 0], stats: { strength: 2, luck: 1 }, weightMult: 0.2 }));
  registerEntityFold('rf1-empty', () => EMPTY_MODS);
  registerEntityFold('rf1-null', () => null);
  registerEntityFold('rf1-throws', () => { throw new Error('a fold that throws is skipped'); });
  try {
    assert.ok(entityFoldNames().includes('rf1-a') && entityFoldNames().includes('rf1-b'));
    const e = entityOf();
    const m = computeEntityMods(e);
    assert.equal(e._mods, m, 'one field');
    assert.deepEqual(m.armorParts, [2, 0, 0, 2, 0, 0, 0]);
    assert.deepEqual(m.stats, { strength: 5, luck: 1 });
    assert.deepEqual(m.skills, { [SKILLS.Stealth]: 4 });
    assert.deepEqual(m.resist, { fire: 5 });
    assert.ok(Math.abs(m.weightMult - 0.3) < 1e-9);
    // the accessors, no enchantment worn
    assert.equal(entityArmorMod(e, 0), -2, 'points OFF the blow');
    assert.equal(entityArmorDisplayMod(e, 3), 2, 'the doll\'s number rises');
    assert.equal(entityArmorMod(e, 1), 0);
    assert.equal(entityStatMod(e, 'strength'), 5);
    assert.equal(entitySkillMod(e, SKILLS.Stealth), 4);
    assert.equal(entityResistMod(e, ['fire', 'frost']), 5);
    assert.ok(Math.abs(entityWeightMult(e) - 0.3) < 1e-9);
    // the leaves read the field
    assert.equal(liveStat(e, 'strength'), 55);
    assert.equal(skillValue(e, SKILLS.Stealth), 34);
    assert.equal(entityMaxEncumbrance(e), maxEncumbrance(55) + Math.trunc(maxEncumbrance(55) * 0.3));
    assert.equal(entityModsOf({}), EMPTY_MODS, 'an entity never folded reads empty');
    assert.equal(computeEntityMods(null), EMPTY_MODS);
  } finally {
    for (const n of ['rf1-a', 'rf1-b', 'rf1-empty', 'rf1-null', 'rf1-throws']) registerEntityFold(n, null);
  }
  assert.deepEqual(entityFoldNames(), before, 'unregistered');
  const e2 = entityOf();
  computeEntityMods(e2);
  assert.equal(entityArmorMod(e2, 0), 0);
  assert.equal(liveStat(e2, 'strength'), 50);
});

test('RF1: DFU\'s enchantment channel is INSIDE the accessor, verbatim - Strengthens Armor is -5 to the blow and +5 on the doll on every part', () => {
  const e = entityOf();
  const r = strengthens();
  e.items.push(r);
  equipItem(e, r);
  computeEnchantmentMods(e);
  for (let p = 0; p < NUMBER_BODY_PARTS; p++) {
    assert.equal(entityArmorMod(e, p), -5);
    assert.equal(entityArmorDisplayMod(e, p), 5);
  }
  registerEntityFold('rf1-c', () => ({ armorParts: [0, 0, 0, 4, 0, 0, 0] }));
  try {
    computeEntityMods(e);
    assert.equal(entityArmorMod(e, 3), -9, 'the two channels sum on the chest');
    assert.equal(entityArmorMod(e, 0), -5, 'and the enchantment alone elsewhere');
    assert.equal(entityArmorDisplayMod(e, 3), 9);
    // the hit formula reads the one accessor: 40 + (100 - 9) + 1 - 10 - 50 = 72 on the chest, 76 on the head
    const A = { skills: 40, stats: { strength: 50, agility: 60, luck: 50 } };
    const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
    const target = { ...e, skills: 40, stats: { strength: 50, agility: 50, luck: 50 }, armorValues: new Array(7).fill(100) };
    assert.equal(calculateSuccessfulHit(A, target, 40, 3, seq(0.99, 0.71)), true);
    assert.equal(calculateSuccessfulHit(A, target, 40, 3, seq(0.99, 0.72)), false);
    assert.equal(calculateSuccessfulHit(A, target, 40, 0, seq(0.99, 0.75)), true);
    assert.equal(calculateSuccessfulHit(A, target, 40, 0, seq(0.99, 0.76)), false);
  } finally { registerEntityFold('rf1-c', null); }
});

test('RF1: the weapon-damage modifiers run in registration order over the roll, and none is DFU\'s roll alone', () => {
  const w = { group: 'Weapons', templateIndex: 120, material: 1 };
  assert.equal(weaponDamageMods(w, 10), 10, 'the loot-rarity modifier is registered but the switch is off: the roll stands');
  registerWeaponDamageMod('rf1-x', (weapon, d) => d + 3);
  registerWeaponDamageMod('rf1-y', (weapon, d) => d * 2);
  try {
    assert.equal(weaponDamageMods(w, 10), 26);
  } finally { registerWeaponDamageMod('rf1-x', null); registerWeaponDamageMod('rf1-y', null); }
  assert.equal(weaponDamageMods(w, 10), 10);
});

test('RF1: the two seams - the equip listener (and the save\'s rebuild) and the magic round run the folds', () => {
  let runs = 0;
  registerEntityFold('rf1-count', (entity) => { runs++; return { stats: { luck: entity.items.filter((it) => it.equipSlot != null).length } }; });
  try {
    const e = entityOf();
    const a = ring(); const b = ring();
    e.items.push(a, b);
    equipItem(e, a);
    assert.equal(entityStatMod(e, 'luck'), 1, 'the equip listener folded');
    equipItem(e, b);
    assert.equal(entityStatMod(e, 'luck'), 2);
    unequipItem(e, a);
    assert.equal(entityStatMod(e, 'luck'), 1, 'and on the way off');
    const n = runs;
    rebuildEquipState(e);
    assert.ok(runs > n, 'the save\'s rebuild runs the listeners');
    const n2 = runs;
    runMagicRoundsFor(e, 0, 1, { sinks: {} });
    assert.ok(runs > n2, 'the magic round runs the folds');
  } finally { registerEntityFold('rf1-count', null); }
});

test('RF1: the read sites - one accessor per channel in the formulas, the field in the leaves, nothing of the affix fold\'s left there', () => {
  const f = read('src/combat/formulas.js');
  assert.match(f, /chance \+= \(target\.armorValues\?\.\[struckBodyPart\] \?\? 0\) \+ entityArmorMod\(target, struckBodyPart\);/, 'the hit formula\'s armour term');
  assert.match(f, /weaponDamageMods\(weapon, wMin \+ Math\.floor\(rolls\(\) \* \(wMax \+ 1 - wMin\)\)\) \+ damageMod/, 'the weapon roll');
  assert.match(f, /const mult = entityWeightMult\(entity\);/, 'the carrying capacity');
  assert.match(read('src/combat/pcaao.js'), /result = 100 - entityArmorMod\(target, struckBodyPart\);/, 'PCAAO\'s read');
  assert.match(read('src/systems/statMods.js'), /mod \+= entity\._mods\?\.stats\?\.\[statName\] \?\? 0;/, 'liveStat, import-free');
  assert.doesNotMatch(read('src/systems/statMods.js'), /^import /m, 'statMods stays a leaf');
  assert.match(read('src/systems/skills.js'), /mod \+= entity\._mods\?\.skills\?\.\[skillId\] \?\? 0;/, 'skillValue');
  assert.match(read('src/systems/spellcast.js'), /saving \+= entityResistMod\(target, RESIST_NAMES/, 'the saving throw');
  assert.match(read('src/ui/nativeInventory.js'), /armorLabelValue\(av\[i\] \?\? 100, entityArmorDisplayMod\(this\.hooks\.entity, i\)\)/, 'the doll');
  assert.match(read('src/systems/worldTick.js'), /enchantmentMagicRound\(entity, r \+ 1, \{[\s\S]*?\}\);\s*\/\/ RF1[\s\S]*?computeEntityMods\(entity\);/, 'the magic round, after the enchant fold');
  assert.match(read('src/systems/entityMods.js'), /addEquipChangeListener\(computeEntityMods\);/, 'the equip seam');
  for (const file of ['src/combat/formulas.js', 'src/combat/pcaao.js', 'src/systems/statMods.js', 'src/systems/skills.js', 'src/systems/spellcast.js', 'src/ui/nativeInventory.js', 'src/systems/worldTick.js']) {
    assert.doesNotMatch(read(file), /affixArmor|affixWeightMult|affixWeaponDamage|affixResist|_affixMods|computeAffixMods|lootRarity\.js/, `${file} reads no fold by name`);
  }
  assert.ok(newMods().armorParts.length === NUMBER_BODY_PARTS && Object.isFrozen(EMPTY_MODS));
});
