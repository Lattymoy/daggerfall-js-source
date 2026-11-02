// DEX6 (2026-10-20, Mac: "I want to implement this as our next mod 1:1") - DAGGERFALL ENEMY EXPANSION'S EQUIPMENT.
// BestiaryMod.Start takes EnemyEntity.AssignEnemyEquipment over: while Roleplay & Realism: Items' realisticEnemyEquipment
// is on, the mod's copy of RRI's class arm (DEX_RRICompat.cs) kits a class foe - its class read off the row's
// EquipmentTable, its armor off its career's forbidden armor, an unknown class armed with a longblade, its second weapon
// put on - and ItemHelper's arm does while it is off (systems/enemyExpansion/dexEquipment.js over
// combat/rriEnemyEquipment.js). Each pinned against the C#, and each with a mutation it must fail under
// (tools/mutants/dex6.json).
import '../../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dexClassTable, dexArmorTemplateIndex, createDexEquipmentAssigner } from '../../../src/systems/enemyExpansion/dexEquipment.js';
import { installEnemyExpansion, _resetEnemyExpansion, dexRead, dexProperties } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { assignRriEnemyEquipment, RRI_ITEM } from '../../../src/combat/rriEnemyEquipment.js';
import { ARMOR_ENUM as A, assignEnemyStartingEquipment, setEnemyEquipmentAssigner, enemyEquipmentAssigner } from '../../../src/combat/enemyEquipment.js';
import { equipEnemy } from '../../../src/scenes/hostCombat.js';
import { setModSetting } from '../../../src/systems/modSettings.js';
import { setValue } from '../../../src/systems/settings/settings.js';
import { equipTableOf, EQUIP_SLOTS } from '../../../src/systems/equip.js';
import { MOBILE_TYPES as M } from '../../../src/characters/mobile/mobileTypes.js';
import { WEAPONS, WEAPON_MATERIALS } from '../../../src/characters/weapons.js';
import { clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { _resetFoeGhosts } from '../../../src/characters/enemy/foeLook.js';
import { _resetExtraQuestRows } from '../../../src/systems/quest/tables.js';
import { _resetEncounterTableSelectors } from '../../../src/characters/encounterTableDoor.js';
import { _resetPlayerGps } from '../../../src/world/playerGps.js';
import { _resetSpellRecordsAssets } from '../../../src/systems/spell/standardSpells.js';
import { _resetEnemySpellbooks } from '../../../src/systems/enemySpells.js';
import { _resetFormulaDoors } from '../../../src/combat/formulas.js';
import { _resetForcedGenders } from '../../../src/characters/mobile/mobileUnit.js';
import { _resetDexTroll } from '../../../src/systems/enemyExpansion/dexTroll.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const COMPAT = readFileSync(join(ROOT, 'vendor/daggerfall-enemy-expansion/Scripts/Compatibility/DEX_RRICompat.cs'), 'utf8');
const BESTIARY = readFileSync(join(ROOT, 'vendor/daggerfall-enemy-expansion/Scripts/BestiaryMod.cs'), 'utf8');
const RRI_CS = readFileSync(join(ROOT, 'vendor/roleplay-realism-items/Scripts/RoleplayRealismItemsMod.cs'), 'utf8');
const silent = () => {};
const RRI = 'roleplay-realism-items';
const DEX = 'daggerfall-enemy-expansion';
/** RRI loaded with the three modules the copy reads; DEX's switch as `dex`. */
const mods = ({ realistic = true, newArmor = true, newWeapons = true, dex = true } = {}) => {
  setModSetting(RRI, 'Enabled', true);
  setModSetting(RRI, 'realisticEnemyEquipment', realistic);
  setModSetting(RRI, 'newArmor', newArmor);
  setModSetting(RRI, 'newWeapons', newWeapons);
  setModSetting(DEX, 'Enabled', dex);
};
const reset = () => {
  _resetFormulaDoors(); _resetForcedGenders(); _resetSpellRecordsAssets(); _resetEnemySpellbooks(); _resetEncounterTableSelectors(); _resetPlayerGps();
  _resetEnemyExpansion(); _resetDexTroll(); clearCustomEnemies(); _resetMintRowEditors(); _resetFoeGhosts(); _resetExtraQuestRows();
  mods();
};
const counted = (r) => { const f = () => { f.calls++; return r(); }; f.calls = 0; return f; };
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
const player = { level: 5, gender: 'male', race: 'Breton' };
/** A class foe as the spawn hands it over: its id, level and career (the bits that forbid armor, `<< 6`). */
const foe = (mobileType, forbid = 0) => ({ mobileType, isClass: true, level: 5, careerIndex: mobileType, career: { weaponArmorShieldsBitfield: forbid << 6 } });
const PLATE = 4, CHAIN = 2, LEATHER = 1;
const armorOf = (eq) => eq.armorPieces.filter((a) => !a.shield).map((a) => a.piece);

test('DEX6-1 THE CLASS BY ITS TABLE: each of the fifteen classes kits as the class its EquipmentTable names ("Guard" the City Watch\'s), a classic class as its own id, a table naming no class as none - OrdinalIgnoreCase, the City Watch asked by "Guard" alone', () => {
  reset();
  const read = dexRead({ log: silent });
  // the C#'s law, read off the copy itself
  assert.match(COMPAT, /if \(classType == MobileTypes\.Knight_CityWatch\)\s*\{\s*return customEnemyProperties\.equipmentTable\.Equals\("Guard", System\.StringComparison\.OrdinalIgnoreCase\);/);
  assert.match(COMPAT, /return customEnemyProperties\.equipmentTable\.Equals\(classType\.ToString\(\), System\.StringComparison\.OrdinalIgnoreCase\);\s*\}\s*\}\s*return mobileId == \(int\)classType;/);
  const propsOf = (id) => read.enemies.get(id)?.props ?? null;
  const want = {
    384: M.Mage, 385: M.Knight_CityWatch, 386: M.Knight, 387: M.Rogue, 388: M.Mage, 389: M.Rogue, 390: M.Assassin, 391: M.Knight,
    392: M.Thief, 393: M.Warrior, 394: M.Assassin, 395: M.Assassin, 396: M.Healer, 397: M.Spellsword, 398: M.Archer,
  };
  for (const [id, cls] of Object.entries(want)) assert.equal(dexClassTable(Number(id), propsOf), cls, `${id} (${propsOf(Number(id))?.equipmentTable})`);
  assert.equal(dexClassTable(M.Knight, propsOf), M.Knight, 'a classic class has no table: its own id');
  assert.equal(dexClassTable(M.Knight_CityWatch, () => ({ equipmentTable: null })), M.Knight_CityWatch);
  const table = (equipmentTable) => () => ({ equipmentTable });
  assert.equal(dexClassTable(386, table('kNiGhT')), M.Knight, 'OrdinalIgnoreCase');
  assert.equal(dexClassTable(386, table('GUARD')), M.Knight_CityWatch);
  assert.equal(dexClassTable(386, table('Knight_CityWatch')), null, 'the City Watch answers to "Guard" alone - its own name asks the Knight_CityWatch test nothing');
  assert.equal(dexClassTable(386, table('Druid')), null, 'a name no class has: the unknown');
});

test('DEX6-2 THE ARMOR BY THE CAREER: the classic piece unless newArmor is on, the career forbids plate and the coin says otherwise - then chain where chain is allowed, else leather, else none; the coin thrown only past the first two tests', () => {
  reset();
  assert.match(COMPAT, /if\(!newArmor \|\| \(\(career\.ForbiddenArmors & DaggerfallConnect\.DFCareer\.ArmorFlags\.Plate\) == 0\) \|\| CoinFlip\(\)\)/);
  const never = () => { throw new Error('no coin is thrown'); };
  const free = { weaponArmorShieldsBitfield: 0 };
  assert.equal(dexArmorTemplateIndex('ChestArmor', free, never), A.Cuirass, 'plate allowed: the classic piece, no coin');
  assert.equal(dexArmorTemplateIndex('ChestArmor', free, () => 0.9), A.Cuirass, 'a coin that would say otherwise is never asked');
  const noPlate = { weaponArmorShieldsBitfield: PLATE << 6 };
  assert.equal(dexArmorTemplateIndex('ChestArmor', noPlate, () => 0), A.Cuirass, 'plate forbidden, CoinFlip true (Range(0, 2) = 0): the classic piece all the same');
  const chain = ['ChestArmor', 'LegsArmor', 'LeftArm', 'RightArm', 'Feet', 'Gloves', 'Head'].map((s) => dexArmorTemplateIndex(s, noPlate, () => 0.9));
  assert.deepEqual(chain, [RRI_ITEM.Hauberk, RRI_ITEM.Chausses, RRI_ITEM.LeftSpaulder, RRI_ITEM.RightSpaulder, RRI_ITEM.Sollerets, RRI_ITEM.Gloves, RRI_ITEM.Helmet], 'the chain set');
  const noPlateOrChain = { weaponArmorShieldsBitfield: (PLATE | CHAIN) << 6 };
  const leather = ['ChestArmor', 'LegsArmor', 'LeftArm', 'RightArm', 'Feet', 'Gloves', 'Head'].map((s) => dexArmorTemplateIndex(s, noPlateOrChain, () => 0.9));
  assert.deepEqual(leather, [RRI_ITEM.Jerkin, RRI_ITEM.Cuisse, RRI_ITEM.LeftVambrace, RRI_ITEM.RightVambrace, RRI_ITEM.Boots, RRI_ITEM.Gloves, RRI_ITEM.Helmet], 'the leather set');
  assert.equal(dexArmorTemplateIndex('Head', { weaponArmorShieldsBitfield: (PLATE | CHAIN | LEATHER) << 6 }, () => 0.9), -1, 'all three forbidden: none');
  setModSetting(RRI, 'newArmor', false);
  assert.equal(dexArmorTemplateIndex('ChestArmor', noPlate, never), A.Cuirass, 'newArmor off: the classic piece, no coin');
});

test('DEX6-3 THE KIT: a Knight Rider fights as a Knight where RRI\'s own arm hands it nothing; a class the arm does not know holds a longblade at armored 50; a Barbarian\'s table forgoes armor; a career that forbids plate wears chain; a piece that is none still rolls its material', () => {
  reset();
  dexRead({ log: silent });
  const propsOf = (id) => dexProperties(id);
  const dex = createDexEquipmentAssigner(propsOf);
  // rolls at 0: variant 0's weapon is GetCombatClassWeapon(Knight) - the coin true, RandomBlunt's first of four (newWeapons): the Mace
  let eq = dex(foe(386), 0, 5, { player, rolls: () => 0 });
  assert.equal(eq.rightHand?.templateIndex, WEAPONS.Mace, 'the Knight\'s blunt-or-blade');
  assert.equal(eq.poisonClass, M.Knight);
  const rri = assignRriEnemyEquipment(foe(386), 0, 5, { player, rolls: () => 0 });
  assert.equal(rri.rightHand, null, 'RRI\'s own switch has no arm for id 386: it holds nothing (why the mod ships its copy)');
  // the unknown: a longblade worn, armored 50 - at 0.39 (Dice100's Range(0, 100) = 39) the torso (50) and the legs (40) land, the feet (30) not
  const druid = createDexEquipmentAssigner(() => ({ equipmentTable: 'Druid' }));
  eq = druid(foe(384), 0, 5, { player, rolls: () => 0.39 });
  assert.ok(eq.rightHand && eq.rightHand.templateIndex >= WEAPONS.Broadsword && eq.rightHand.templateIndex <= WEAPONS.Longsword, 'RandomLongblade');
  assert.deepEqual(armorOf(eq), [A.Cuirass, A.Greaves], 'armored 50: the torso and the legs');
  assert.equal(eq.poisonClass, null, 'no class: the poison roll reads the id');
  // a table naming the Barbarian: armored 30 (by the table), its raised legs and head by the id (384 is none)
  const barb = createDexEquipmentAssigner(() => ({ equipmentTable: 'Barbarian' }));
  eq = barb(foe(384), 0, 5, { player, rolls: () => 0.29 });
  assert.deepEqual(armorOf(eq), [A.Cuirass], 'a roll of 29: the torso at 30 lands, the legs at 20 do not, and no id raises them');
  // at 0.5 every coin says otherwise (Range(0, 2) = 1) and a Knight's 100 falls through torso, legs, feet and head
  eq = dex(foe(386, PLATE), 0, 5, { player, rolls: () => 0.5 });
  assert.deepEqual(armorOf(eq), [RRI_ITEM.Hauberk, RRI_ITEM.Chausses, RRI_ITEM.Sollerets, RRI_ITEM.Helmet], 'the career forbids plate: the chain set');
  eq = dex(foe(386), 0, 5, { player, rolls: () => 0.5 });
  assert.deepEqual(armorOf(eq), [A.Cuirass, A.Greaves, A.Boots, A.Helm], 'a career that allows plate: the classic pieces, whatever the coin');
  // a piece that is none: the dice and the material rolled as for one minted (CreateArmor's arguments), the condition not
  // (and at a coin that says the classic piece, an all-forbidding career wears it: `CoinFlip()` answers before the rest)
  assert.deepEqual(armorOf(dex(foe(386, PLATE | CHAIN | LEATHER), 0, 5, { player, rolls: () => 0 })), [A.Cuirass, A.Greaves, A.Boots, A.Helm, A.Right_Pauldron, A.Left_Pauldron, A.Gauntlets]);
  const all = counted(() => 0.5), chain = counted(() => 0.5);
  const none = dex(foe(386, PLATE | CHAIN | LEATHER), 0, 5, { player, rolls: all });
  const worn = dex(foe(386, PLATE), 0, 5, { player, rolls: chain });
  assert.equal(armorOf(none).length, 0, 'every piece forbidden: none worn');
  assert.ok(armorOf(worn).length > 0);
  assert.equal(all.calls, chain.calls - armorOf(worn).length, 'one draw fewer per piece - its worn condition - and no other');
  // off: ItemHelper's arm (null from the copy, the caller's fallback)
  setModSetting(RRI, 'realisticEnemyEquipment', false);
  assert.equal(dex(foe(386), 0, 5, { player, rolls: () => 0 }), null);
});

test('DEX6-4 THE POISON: a Bounty Hunter (its table the Assassin\'s) poisons its blade at the Assassin\'s 60% through the spawn\'s roll, a Knight Rider at 5%', () => {
  reset();
  assert.match(COMPAT, /if \(HasClassTable\(enemyEntity\.MobileEnemy\.ID, MobileTypes\.Assassin\)\)\s*chanceToPoison = 60;/);
  installEnemyExpansion({ on: true, log: silent });
  // every draw 0.59: Dice100's Range(0, 100) = 59 - the 60% lands, the 5% does not
  const hunter = { ...foe(390), items: [] };
  equipEnemy(hunter, 390, 5, () => 0.59, { player });
  assert.ok(hunter.weapon, 'armed');
  assert.ok(hunter.weapon.poisonType >= 128 && hunter.weapon.poisonType <= 135, `poisoned (${hunter.weapon.poisonType})`);
  const rider = { ...foe(386), items: [] };
  equipEnemy(rider, 386, 5, () => 0.59, { player });
  assert.ok(rider.weapon);
  assert.ok(!(rider.weapon.poisonType >= 128), 'the 5%');
  _resetEnemyExpansion();
});

test('DEX6-5 THE DELEGATE: the mod\'s Start takes AssignEnemyEquipment over (after RRI\'s Awake wrote its own) while the mod is loaded, and RRI\'s stands while it is not; the test seam puts RRI\'s back', () => {
  reset();
  assert.match(BESTIARY, /EnemyEntity\.AssignEnemyEquipment = AssignEnemyStartingEquipment;\s*DEX_RRICompat\.OnStart\(\);/);
  assert.match(BESTIARY, /if \(DEX_RRICompat\.hasRRIRealisticEnemyEquipment\)\s*\{\s*DEX_RRICompat\.AssignEnemyStartingEquipment\(playerEntity, enemyEntity, variant\);\s*\}\s*else\s*\{\s*DaggerfallUnity\.Instance\.ItemHelper\.AssignEnemyStartingEquipment\(playerEntity, enemyEntity, variant\);/);
  const rriOwn = (entity, variant, playerLevel, opts) => assignRriEnemyEquipment(entity, variant, playerLevel, opts);
  setEnemyEquipmentAssigner(rriOwn);
  installEnemyExpansion({ on: true, log: silent });
  assert.notEqual(enemyEquipmentAssigner(), rriOwn, 'the mod\'s delegate');
  assert.equal(assignEnemyStartingEquipment(foe(386), 0, 5, { player, rolls: () => 0 }).rightHand?.templateIndex, WEAPONS.Mace, 'through the seam: the Knight Rider armed');
  _resetEnemyExpansion();
  assert.equal(enemyEquipmentAssigner(), rriOwn, 'the seam puts RRI\'s back');
  mods({ dex: false });
  installEnemyExpansion({ on: false, log: silent });
  assert.equal(enemyEquipmentAssigner(), rriOwn, 'not loaded: RRI\'s stands');
  _resetEnemyExpansion();
  setEnemyEquipmentAssigner(null);
});

test('DEX6-6 THE SECOND WEAPON PUT ON (AUDIT DEX E1/E2): a combat class\'s left-hand weapon and a sneaky class\'s second go on where RRI\'s arm carries them, and EquipItem\'s hand rules keep what they keep - beside a one-hander held left, after a two-hander in the right hand, a Short Bow in both (the left, under BowLeftHandWithSwitching)', () => {
  reset();
  assert.match(COMPAT, /else if \(Dice100\.SuccessRoll\(chance\)\)\s*AddAndEquipWornItem\(enemyEntity, CreateWeapon\(SecondaryWeapon\(\), FormulaHelper\.RandomMaterial\(itemLevel\)\)\);/);
  assert.match(COMPAT, /if \(Dice100\.SuccessRoll\(chance\)\)\s*AddAndEquipWornItem\(enemyEntity, CreateWeapon\(SecondaryWeapon\(\), FormulaHelper\.RandomMaterial\(itemLevel \/ 2\)\)\);/);
  assert.match(RRI_CS, /else if \(Dice100\.SuccessRoll\(chance\)\)\s*AddOrEquipWornItem\(enemyEntity, CreateWeapon\(SecondaryWeapon\(\), FormulaHelper\.RandomMaterial\(itemLevel\)\)\);/, 'RRI\'s own: carried');
  assert.match(RRI_CS, /if \(Dice100\.SuccessRoll\(chance\)\)\s*AddOrEquipWornItem\(enemyEntity, CreateWeapon\(SecondaryWeapon\(\), FormulaHelper\.RandomMaterial\(itemLevel\/2\)\)\);/);
  dexRead({ log: silent });
  const dex = createDexEquipmentAssigner((id) => dexProperties(id));
  const held = (eq) => [eq.rightHand?.templateIndex ?? null, eq.leftHand?.templateIndex ?? null];
  const off = (eq, t) => eq.items.some((it) => it.templateIndex === t) && !eq.worn.some((it) => it.templateIndex === t);
  // variant 0, the Knight's draws: the coin (blunt), RandomBlunt's pick, the material, the condition; the shield's
  // Dice100 at 60 fails, the left-hand weapon's at 0 lands; SecondaryWeapon's Range(0, 4), its material, its condition
  const rider = (blunt, second) => seq(0, blunt, 0, 0, 0.6, 0, second, 0, 0, 0);
  let eq = dex(foe(386), 0, 5, { player, rolls: rider(0, 0) });
  assert.deepEqual(held(eq), [WEAPONS.Mace, WEAPONS.Dagger], 'a Mace and the Dagger held left (GetFirstSlot: the right taken)');
  assert.ok(eq.worn.some((it) => it.templateIndex === WEAPONS.Dagger), 'worn');
  const rri = assignRriEnemyEquipment(foe(M.Knight), 0, 5, { player, rolls: rider(0, 0) });
  assert.deepEqual(held(rri), [WEAPONS.Mace, null], 'RRI\'s own Knight on the same draws: the Dagger carried');
  assert.ok(off(rri, WEAPONS.Dagger));
  eq = dex(foe(386), 0, 5, { player, rolls: rider(0.25, 0) });
  assert.deepEqual(held(eq), [WEAPONS.Dagger, null], 'after a Flail (two-handed) the Dagger takes the right hand (GetWeaponSlot :439-441)');
  assert.ok(off(eq, WEAPONS.Flail), 'the Flail comes off - in Items, the corpse\'s, not worn');
  eq = dex(foe(386), 0, 5, { player, rolls: rider(0, 0.9) });
  assert.deepEqual(held(eq), [WEAPONS.Short_Bow, null], 'a Short Bow takes both hands (ItemHands.Both): the Mace comes off');
  assert.ok(off(eq, WEAPONS.Mace));
  setValue('Enhancements', 'BowLeftHandWithSwitching', true);
  try {
    eq = dex(foe(386), 0, 5, { player, rolls: rider(0, 0.9) });
    assert.deepEqual(held(eq), [WEAPONS.Mace, WEAPONS.Short_Bow], 'BowLeftHandWithSwitching: the bow is LeftOnly, held left beside the Mace');
    eq = dex(foe(386), 0, 5, { player, rolls: rider(0.25, 0.9) });
    assert.deepEqual(held(eq), [null, WEAPONS.Short_Bow], 'and a LeftOnly piece takes a two-hander off the right (:125-132): bare-handed');
    assert.ok(off(eq, WEAPONS.Flail));
  } finally { setValue('Enhancements', 'BowLeftHandWithSwitching', false); }
  // the sneaky classes: the Thief Rider (its table the Thief's) - RandomShortblade's Dice100(40) at 0, the Shortsword;
  // its material and condition; the second's Dice100 at 0 lands, SecondaryWeapon at 0 the Dagger
  eq = dex(foe(392), 0, 5, { player, rolls: () => 0 });
  assert.deepEqual(held(eq), [WEAPONS.Shortsword, WEAPONS.Dagger], 'the second blade held left');
  const thief = assignRriEnemyEquipment(foe(M.Thief), 0, 5, { player, rolls: () => 0 });
  assert.deepEqual(held(thief), [WEAPONS.Shortsword, null], 'RRI\'s own Thief: carried');
  assert.ok(off(thief, WEAPONS.Dagger));
});

test('DEX6-7 THE ID\'S TESTS AND THE TABLE\'S (AUDIT DEX E4): the City Watch\'s item level asks the id (the mod\'s Guard, a City Watch by its table, rolls at its own level), the Ranger\'s longblade the id (a row whose table names the Ranger carries the shortblade), a fighter the table (a Knight Rider\'s big weapon at armored 100)', () => {
  reset();
  assert.match(COMPAT, /int itemLevel = \(enemyEntity\.MobileEnemy\.ID == \(int\)MobileTypes\.Knight_CityWatch\) \? 1 : enemyEntity\.Level;/);
  assert.match(COMPAT, /AddWornItem\(enemyEntity, CreateWeapon\(\(enemyEntity\.MobileEnemy\.ID == \(int\)MobileTypes\.Ranger\) \? RandomLongblade\(\) : RandomShortblade\(\)/);
  assert.match(COMPAT, /AddAndEquipWornItem\(enemyEntity, CreateWeapon\(RandomBigWeapon\(\), FormulaHelper\.RandomMaterial\(itemLevel\)\)\);\s*if \(!IsFighter\(enemyEntity\.MobileEnemy\.ID\)\)\s*armored = 90;/);
  assert.match(COMPAT, /static bool IsFighter\(int mobileId\)\s*\{\s*return HasClassTable\(mobileId, MobileTypes\.Knight\) \|\| HasClassTable\(mobileId, MobileTypes\.Warrior\);/);
  dexRead({ log: silent });
  const dex = createDexEquipmentAssigner((id) => dexProperties(id));
  // at 0.99 the City Watch's RandomAxeOrBlade is a Longsword, and RandomMaterial's Range(0, 256) = 253: at level 20
  // (20 - 10) * 2 + 253 clamps to 256 - Daedric; at item level 1, -36 + 253 = 217 - Elven
  const at20 = (mobileType) => ({ ...foe(mobileType), level: 20 });
  assert.equal(dexClassTable(385, dexProperties), M.Knight_CityWatch, 'the Guard kits as the City Watch');
  assert.equal(dex(at20(385), 0, 20, { player, rolls: () => 0.99 }).rightHand.material, WEAPON_MATERIALS.Daedric, 'the Guard (385): its own level');
  assert.equal(dex(at20(M.Knight_CityWatch), 0, 20, { player, rolls: () => 0.99 }).rightHand.material, WEAPON_MATERIALS.Elven, 'the City Watch (146): item level 1');
  // a row whose table names the Ranger: the bow, then the sidearm by the id - RandomShortblade's Dice100(40) at 0, the Shortsword
  const ranger = createDexEquipmentAssigner((id) => (id === 398 ? { equipmentTable: 'Ranger' } : null));
  const sidearm = (eq) => eq.items.find((it) => it.group === 'Weapons' && it !== eq.rightHand && it.templateIndex !== WEAPONS.Arrow)?.templateIndex;
  let eq = ranger(foe(398), 0, 5, { player, rolls: () => 0 });
  assert.equal(eq.rightHand.templateIndex, WEAPONS.Short_Bow, 'kitted as a Ranger');
  assert.equal(sidearm(eq), WEAPONS.Shortsword, 'not the Ranger by id: the shortblade');
  assert.equal(sidearm(ranger(foe(M.Ranger), 0, 5, { player, rolls: () => 0 })), WEAPONS.Broadsword, 'the Ranger itself: RandomLongblade at 0');
  // variant 1 at 0.95: the War Axe, then the torso's Dice100 = 95 - under 100 (a fighter, by the table), not under 90
  eq = dex(foe(386), 1, 5, { player, rolls: () => 0.95 });
  assert.equal(eq.rightHand.templateIndex, WEAPONS.War_Axe);
  assert.deepEqual(armorOf(eq), [A.Cuirass], 'the Knight Rider is a fighter: armored 100');
  assert.deepEqual(armorOf(assignRriEnemyEquipment(foe(M.Spellsword), 1, 5, { player, rolls: () => 0.95 })), [], 'a Spellsword is not: armored 90');
});

test('DEX6-8 THE POISON\'S FALLBACK (AUDIT DEX E4): a class the arm does not know answers no poison class, and the spawn\'s roll asks its own id - 5%, as DEX_RRICompat\'s does for every class', () => {
  reset();
  assert.match(COMPAT, /int chanceToPoison = 5;\s*if \(HasClassTable\(enemyEntity\.MobileEnemy\.ID, MobileTypes\.Assassin\)\)/);
  setEnemyEquipmentAssigner(createDexEquipmentAssigner(() => ({ equipmentTable: 'Druid' })));
  try {
    // every draw 0.04: Range(0, 2) = 0 the variant; the unknown's longblade; Dice100's Range(0, 100) = 4 - the 5% lands,
    // and Range(128, 136) at 0.04 is 128
    const druid = { ...foe(384), items: [] };
    const eq = equipEnemy(druid, 384, 5, () => 0.04, { player });
    assert.equal(eq.poisonClass, null, 'no class the arm knows');
    assert.ok(druid.weapon, 'the longblade');
    assert.equal(druid.weapon.poisonType, 128, 'poisoned through its own id (384, a class by the 128 bit)');
  } finally { setEnemyEquipmentAssigner(null); }
});
