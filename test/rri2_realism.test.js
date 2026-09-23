// RRI2 - Roleplay & Realism: Items, the nine modules past the items
// (RoleplayRealismItemsMod.cs, Hazelnut & Ralzar): the loot rewrite, the
// bandage, condition prices and repair, store-quality wear, the alchemist's
// potions, weapon balance (damage spans + swing time), the enemy kit, the
// starting kit and the starting spellbook - each behind the mod's own
// switch, each pinned against the C# beside DFU's own number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import {
  RRI_LOOT_MATRICES, RRI_MOB_LOOT_KEYS, rriLootMatrix, rriEnemyLootTableKey, isRriStackable, bandageHeal, shelfBandageStack,
  randomConditionLootItems, conditionCostBase, conditionRepairCostBase, storeQualityLow, storeQualityItemCondition,
  alchemistPotionCount, RRI_WEAPON_MIN_DAMAGE, RRI_WEAPON_MAX_DAMAGE, rriMeleeWeaponAnimTime, SPEED_REDUCTION_FACTOR,
} from '../src/systems/rriRealism.js';
import { installRoleplayRealismModules } from '../src/systems/rriInstall.js';
import { generateItems, LOOT_MATRICES, enemyLootTableKey, createRandomPotion } from '../src/systems/loot.js';
import { isStackable } from '../src/systems/inventory.js';
import { useItem } from '../src/systems/useItem.js';
import { calculateCost } from '../src/systems/shopStock.js';
import { calculateItemRepairCost } from '../src/systems/repairService.js';
import { weaponMinDamage, weaponMaxDamage, WEAPONS, WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { getMeleeWeaponAnimTime, CLASSIC_FRAME_UPDATE } from '../src/characters/weaponStates.js';
import { assignEnemyStartingEquipment, equipmentItems } from '../src/combat/enemyEquipment.js';
import { assignRriEnemyEquipment, convertOrcish, getArmorTemplateIndex, RRI_ITEM } from '../src/combat/rriEnemyEquipment.js';
import { onShopShelfStocked, assignSkillEquipment, assignSkillSpellbook, RRI_SPELLS, useBandage, KIT } from '../src/systems/rriKits.js';
import { assignStartingEquipment, STARTING_GOLD } from '../src/systems/startingGear.js';
import { assignStartingSpells } from '../src/systems/chargen.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { SKILLS } from '../src/systems/skills.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { conditionPercentage, mintCondition, setItemFields, templateByIndex } from '../src/systems/itemTemplates.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { LOOT_CONTAINER_TYPES } from '../src/systems/sceneCache.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { equipTableOf } from '../src/systems/equip.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const V = 'roleplay-realism-items';
const on = (key, v = true) => setModSetting(V, key, v);
const reset = () => { _resetModSettings(); };
const mint = (item) => mintCondition(setItemFields(item));
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

installRoleplayRealismModules();

// ---- lootRebalance -----------------------------------------------------
test('RRI2 lootRebalance: LootRealismTables replaces the whole matrix (:87) and MobLootKeys re-keys sixteen mobs (:79-84) - off, DFU\'s own rows', () => {
  reset();
  assert.equal(Object.keys(RRI_LOOT_MATRICES).length, 25, '22 classic keys + LR1..LR3');
  assert.deepEqual(RRI_LOOT_MATRICES.N, { MinGold: 1, MaxGold: 40, P1: 5, P2: 5, C1: 5, C2: 5, C3: 5, M1: 5, AM: 90, WP: 60, MI: 2, CL: 20, BK: 5, M2: 2, RL: 5 }, 'Castle Loot, verbatim');
  assert.deepEqual(RRI_LOOT_MATRICES.LR3, { MinGold: 0, MaxGold: 30, P1: 3, P2: 3, C1: 1, C2: 1, C3: 1, M1: 2, AM: 0, WP: 20, MI: 1, CL: 95, BK: 45, M2: 2, RL: 10 }, 'Spellcasters');
  assert.equal(Object.keys(RRI_MOB_LOOT_KEYS).length, 16);
  assert.equal(RRI_MOB_LOOT_KEYS[MOBILE_TYPES.Mage], 'LR3'); assert.equal(RRI_MOB_LOOT_KEYS[MOBILE_TYPES.Monk], 'O'); assert.equal(RRI_MOB_LOOT_KEYS[MOBILE_TYPES.Giant], 'E');
  // on (the default)
  assert.equal(rriLootMatrix('K'), RRI_LOOT_MATRICES.K);
  assert.equal(rriLootMatrix('LR1'), RRI_LOOT_MATRICES.LR1);
  assert.equal(rriLootMatrix('nope'), RRI_LOOT_MATRICES['-'], 'an unknown key is the empty row, as DFU\'s dictionary miss is');
  assert.equal(enemyLootTableKey(MOBILE_TYPES.Warrior, 'C'), 'LR1');
  assert.equal(enemyLootTableKey(MOBILE_TYPES.Rat, 'D'), 'D', 'a mob the table does not name keeps its own key');
  // the gold line proves which matrix generateItems read: K is 10-20 here, 1-10 in DFU
  const who = { level: 1, gender: 'male' };
  const gold = (key) => generateItems(key, who, () => 0).find((it) => it.group === 'Currency')?.stackCount ?? 0;
  assert.equal(gold('K'), 10, 'the mod\'s K: MinGold 10');
  assert.equal(gold('LR2'), 0);
  on('lootRebalance', false);
  assert.equal(rriLootMatrix('K'), null);
  assert.equal(rriEnemyLootTableKey(MOBILE_TYPES.Warrior, 'C'), 'C');
  assert.equal(gold('K'), LOOT_MATRICES.K.MinGold, 'off: DFU\'s K, MinGold 1');
  assert.equal(gold('LR2'), 0, 'off: an LR key is nobody\'s row - the empty one');
  reset();
});

// ---- bandaging -----------------------------------------------------------
test('RRI2 bandaging: the bandage stacks (the override\'s one yes, :168-171), heals Min(medical/3, MaxHealth*0.4) and tallies Medical (:186-201); off, the ladder\'s catch-all', () => {
  reset();
  const bandage = () => mint({ group: 'UselessItems2', templateIndex: 249, stackCount: 3 });
  assert.equal(isRriStackable(bandage()), true);
  assert.equal(isStackable(bandage()), true, 'through FormulaHelper.IsItemStackable');
  assert.equal(isRriStackable(mint({ group: 'UselessItems2', templateIndex: 247 })), false, 'a torch is not the bandage');
  assert.equal(bandageHeal(60, 100), 20, 'medical 60 / 3 = 20 < 40');
  assert.equal(bandageHeal(150, 50), 20, '150 / 3 = 50 > 50 * 0.4 = 20');
  assert.equal(bandageHeal(59, 100), 19, 'C# int division: 59 / 3 = 19');
  assert.equal(shelfBandageStack(2, () => 0.99), 1, 'Range(1, 1) is 1');
  assert.equal(shelfBandageStack(16, () => 0.99), 7, 'Range(1, 8) tops at 7');
  assert.equal(shelfBandageStack(40, () => 0.99), 8, 'clamped at 8');
  // the registered handler, through UseItem's delegate arm (:1703-1709)
  const entity = { health: 10, maxHealth: 100, skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), activeEffects: [] };
  const item = bandage();
  const bag = [item];
  const out = useItem(item, bag, { entity });
  assert.equal(out.kind, 'bandaged');
  assert.equal(out.healed, 10, 'medical 30 / 3');
  assert.equal(entity.health, 20);
  assert.equal(item.stackCount, 2, 'RemoveOne');
  assert.equal(entity.skillUses[SKILLS.Medical], 1);
  const last = mint({ group: 'UselessItems2', templateIndex: 249, stackCount: 1 });
  const bag2 = [last];
  useItem(last, bag2, { entity: { ...entity, health: 95 } });
  assert.equal(bag2.length, 0, 'the last one leaves the list');
  assert.deepEqual(useBandage(bandage(), null, { entity }), { kind: 'bandaged', healed: 0 }, 'no collection: nothing, and still handled (`if (collection != null)`, return true)');
  on('bandaging', false);
  assert.equal(isStackable(bandage()), false, 'off: DFU\'s own arms - a bandage does not stack');
  assert.equal(useItem(bandage(), [bandage()], { entity }).kind, 'none', 'off: no handler - the catch-all (NextVariant has nothing to move)');
  reset();
});

// ---- conditionBasedPrices --------------------------------------------------
test('RRI2 conditionBasedPrices: CalculateCost scales the base by the condition, floored at a fifth (:247-260); the repair price by the damage, 0.6 / 0.9 (:262-278); off, DFU\'s flat tenth', () => {
  reset();
  assert.equal(conditionCostBase(100, -1), 100, 'no condition given: x1');
  assert.equal(conditionCostBase(100, 50), 50);
  assert.equal(conditionCostBase(100, 10), 20, 'Max(0.1, 0.2)');
  assert.equal(conditionCostBase(0, 50), 1, 'floored at 1');
  assert.equal(calculateCost(100, 10, 1000, 50), 100, '50, then 2 * (50 * 0 / 100 + 50)');
  assert.equal(calculateCost(100, 10, 1000), 200, 'the slot left at -1: x1');
  assert.equal(calculateCost(100, 15, 1000, 50), 104, 'quality 15: 2 * (50 * 5 / 100 + 50), C# integer division');
  assert.equal(conditionRepairCostBase(1000, 50, 100, false), 300, '0.6 * (100 - 50) / 100 of 1000');
  assert.equal(conditionRepairCostBase(1000, 50, 100, true), 450, 'InstantRepairs: 0.9');
  assert.equal(conditionRepairCostBase(1, 99, 100, false), 1, 'floored at 1');
  assert.equal(calculateItemRepairCost(1000, 10, 50, 100, { instantRepairs: false }), 600, '300 through CalculateCost at quality 10');
  assert.equal(calculateItemRepairCost(1000, 10, 100, 100, { instantRepairs: false }), 0, 'free at full condition, both laws');
  // the loot roll: armor, weapons, books - not artifacts, not ingredients
  const items = [mint({ group: 'Armor', templateIndex: 102, material: 0 }), mint({ group: 'Weapons', templateIndex: 120, material: 0 }), mint({ group: 'Books', templateIndex: 277 }), mint({ group: 'Armor', templateIndex: 107, material: 0, artifact: true }), mint({ group: 'Gems', templateIndex: 0 })];
  const before = items.map((it) => it.currentCondition);
  randomConditionLootItems(items, () => 0);
  assert.equal(items[0].currentCondition, Math.trunc(items[0].maxCondition * 0.2));
  assert.equal(items[1].currentCondition, Math.trunc(items[1].maxCondition * 0.2));
  assert.equal(items[2].currentCondition, Math.trunc(items[2].maxCondition * 0.2));
  assert.equal(items[3].currentCondition, before[3], 'an artifact keeps its condition');
  assert.equal(items[4].currentCondition, before[4], 'a gem is not in the three groups');
  randomConditionLootItems([items[0]], () => 0.999999);
  assert.equal(items[0].currentCondition, Math.trunc(items[0].maxCondition * (0.2 + 0.999999 * 0.55)), 'Range(0.2f, 0.75f) - the code, not the comment\'s 70%');
  on('conditionBasedPrices', false);
  assert.equal(calculateCost(100, 10, 1000, 50), 200, 'off: the slot is not read (DFU\'s own arm)');
  assert.equal(calculateItemRepairCost(1000, 10, 50, 100, { instantRepairs: false }), 200, 'off: 10 * 1000 / 100 through CalculateCost');
  reset();
});

// ---- storeQualityItemCondition + alchemistPotions (the shelf hooks) ----------
test('RRI2 shelf hooks (PlayerActivate.OnLootSpawned, :885): the bandage stack (:173-184), store-quality wear (:280-310), the alchemist\'s potions at twice the price (:203-220) - each on its own switch, ShopShelves only', () => {
  reset();
  assert.deepEqual([3, 7, 13, 17, 18].map(storeQualityLow), [0.25, 0.40, 0.60, 0.75, null]);
  const shelf = () => [mint({ group: 'Armor', templateIndex: 102, material: 0 }), mint({ group: 'Weapons', templateIndex: 113, material: 1 }), mint({ group: 'UselessItems2', templateIndex: 249, stackCount: 1 }), mint({ group: 'Books', templateIndex: 277 })];
  let items = onShopShelfStocked(shelf(), { buildingType: BUILDING_TYPES.Armorer, quality: 5 }, { rolls: () => 0 });
  assert.equal(items[0].currentCondition, Math.trunc(items[0].maxCondition * 0.40), 'quality 5: used+');
  assert.equal(items[1].currentCondition, Math.trunc(items[1].maxCondition * 0.40));
  assert.equal(items[3].currentCondition, items[3].maxCondition, 'a book on a shelf is not worn (Armor and Weapons only here)');
  assert.equal(items[2].stackCount, 1, 'Range(1, 2) = 1');
  items = onShopShelfStocked(shelf(), { buildingType: BUILDING_TYPES.Armorer, quality: 16 }, { rolls: () => 0.999 });
  assert.equal(items[2].stackCount, 7, 'quality 16: Range(1, 8)');
  assert.equal(items[0].currentCondition, Math.trunc(items[0].maxCondition * (0.75 + 0.999 * 0.25)));
  items = onShopShelfStocked(shelf(), { buildingType: BUILDING_TYPES.Armorer, quality: 20 }, { rolls: () => 0 });
  assert.equal(items[0].currentCondition, items[0].maxCondition, 'quality 18+ stocks new');
  // the alchemist
  assert.equal(alchemistPotionCount(0, () => 0.5), 1, 'Range(0, 0) = 0, clamped to 1');
  assert.equal(alchemistPotionCount(10, () => 0.55), 5);
  assert.equal(alchemistPotionCount(20, () => 0.999), 12, 'clamped at 12');
  items = onShopShelfStocked([], { buildingType: BUILDING_TYPES.Alchemist, quality: 10 }, { rolls: () => 0.55 });
  assert.equal(items.length, 5);
  const plain = createRandomPotion(() => 0.55);
  assert.equal(items[0].value, plain.value * 2, 'item.value *= 2');
  assert.equal(items[0].potionRecipeKey, plain.potionRecipeKey);
  assert.equal(onShopShelfStocked([], { buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }).length, 0, 'not an alchemist');
  assert.equal(storeQualityItemCondition([mint({ group: 'Armor', templateIndex: 102, material: 0 })], 5, () => 0)[0].currentCondition > 0, true);
  const house = onShopShelfStocked(shelf(), { buildingType: BUILDING_TYPES.Alchemist, quality: 5, containerType: LOOT_CONTAINER_TYPES.HouseContainers }, { rolls: () => 0 });
  assert.equal(house[0].currentCondition, house[0].maxCondition, 'a house container is not a shelf');
  assert.equal(house.length, 4);
  on('storeQualityItemCondition', false);
  items = onShopShelfStocked(shelf(), { buildingType: BUILDING_TYPES.Armorer, quality: 5 }, { rolls: () => 0 });
  assert.equal(items[0].currentCondition, items[0].maxCondition, 'store quality off: new');
  reset(); on('conditionBasedPrices', false);
  items = onShopShelfStocked(shelf(), { buildingType: BUILDING_TYPES.Armorer, quality: 5 }, { rolls: () => 0 });
  assert.equal(items[0].currentCondition, items[0].maxCondition, 'InitMod nests storeQuality under conditionBasedPrices');
  reset(); on('alchemistPotions', false);
  assert.equal(onShopShelfStocked([], { buildingType: BUILDING_TYPES.Alchemist, quality: 10 }).length, 0);
  reset(); on('bandaging', false);
  items = onShopShelfStocked(shelf(), { buildingType: BUILDING_TYPES.Armorer, quality: 16 }, { rolls: () => 0.999 });
  assert.equal(items[2].stackCount, 1, 'bandaging off: the stack is the shelf\'s');
  reset();
});

// ---- weaponBalance -------------------------------------------------------
test('RRI2 weaponBalance: the two damage overrides (:312-379) answer ahead of DFU\'s tables and 0 past them; the swing time reads weight and strength (:381-409); off, DFU\'s lines', () => {
  reset();
  assert.equal(RRI_WEAPON_MIN_DAMAGE[WEAPONS.Saber], 1); assert.equal(RRI_WEAPON_MIN_DAMAGE[WEAPONS.Mace], 4); assert.equal(RRI_WEAPON_MIN_DAMAGE[WEAPONS.Staff], 3);
  assert.equal(RRI_WEAPON_MAX_DAMAGE[WEAPONS.Claymore], 19); assert.equal(RRI_WEAPON_MAX_DAMAGE[WEAPONS.Tanto], 7); assert.equal(RRI_WEAPON_MAX_DAMAGE[WEAPONS.Battle_Axe], 13);
  assert.equal(Object.keys(RRI_WEAPON_MIN_DAMAGE).length, 18); assert.equal(Object.keys(RRI_WEAPON_MAX_DAMAGE).length, 18);
  assert.equal(weaponMinDamage(WEAPONS.Saber), 1, 'on: the override (DFU says 3)');
  assert.equal(weaponMaxDamage(WEAPONS.Claymore), 19, 'on: the override (DFU says 18)');
  assert.equal(weaponMinDamage(WEAPONS.Arrow), 0, 'the override\'s default arm: 0');
  assert.equal(weaponMinDamage(513), 2, 'a custom class answers its own GetBaseDamageMin ahead of the formula');
  // GetMeleeWeaponAnimTime: speed 50, strength 50, a 4 kg weapon
  assert.equal(SPEED_REDUCTION_FACTOR, 3.4);
  const t = rriMeleeWeaponAnimTime({ liveSpeed: 50, liveStrength: 50, weaponWeight: 4 }, CLASSIC_FRAME_UPDATE);
  // strWeightPerc 100 -> adjustedWeight 4 -> reduction 13.6 -> 50 - (int)(50 * 13.6 / 90) = 42
  assert.equal(t, 3 * (115 - 42) / CLASSIC_FRAME_UPDATE);
  assert.equal(rriMeleeWeaponAnimTime({ liveSpeed: 50, liveStrength: 50, melee: true }, CLASSIC_FRAME_UPDATE), 3 * (115 - 50) / CLASSIC_FRAME_UPDATE, 'bare hands: the live speed');
  assert.equal(rriMeleeWeaponAnimTime({ liveSpeed: 100, liveStrength: 50, weaponWeight: 0 }, CLASSIC_FRAME_UPDATE), 3 * (115 - 98) / CLASSIC_FRAME_UPDATE, 'speed capped at 98');
  // through the registered override, off a player wielding a longsword (4 kg)
  const player = { stats: { strength: 50, speed: 50 }, activeEffects: [], items: [] };
  const sword = mint({ group: 'Weapons', templateIndex: WEAPONS.Longsword, material: 0 });
  equipTableOf(player)[EQUIP_SLOTS.RightHand] = sword;
  const swordTime = rriMeleeWeaponAnimTime({ liveSpeed: 50, liveStrength: 50, weaponWeight: templateByIndex(WEAPONS.Longsword).baseWeight }, CLASSIC_FRAME_UPDATE);
  assert.equal(templateByIndex(WEAPONS.Longsword).baseWeight, 4.5, 'ItemTemplate.baseWeight, the C#\'s read');
  assert.equal(getMeleeWeaponAnimTime(50, { entity: player, weaponType: 0, usingRightHand: true }), swordTime, 'the widget\'s ctx reaches the override');
  assert.equal(getMeleeWeaponAnimTime(50), 3 * (115 - 50) / CLASSIC_FRAME_UPDATE, 'no ctx: DFU\'s line');
  assert.equal(getMeleeWeaponAnimTime(50, { entity: player, weaponType: 15, usingRightHand: true }), 3 * (115 - 50) / CLASSIC_FRAME_UPDATE, 'WeaponTypes.Melee: the live speed');
  on('weaponBalance', false);
  assert.equal(weaponMinDamage(WEAPONS.Saber), 3, 'off: DFU');
  assert.equal(weaponMaxDamage(WEAPONS.Claymore), 18);
  assert.equal(getMeleeWeaponAnimTime(50, { entity: player, weaponType: 0, usingRightHand: true }), 3 * (115 - 50) / CLASSIC_FRAME_UPDATE);
  reset();
});

// ---- realisticEnemyEquipment ------------------------------------------------
test('RRI2 realisticEnemyEquipment: a class is kitted by its class (:523-681) at 30-75% condition, the custom pieces under newArmor (:727-757); a monster keeps ItemHelper\'s arm then ConvertOrcish (:683-705); off, DFU\'s roll', () => {
  reset();
  const player = { level: 5, gender: 'male', race: 'Breton' };
  const mage = { mobileType: MOBILE_TYPES.Mage, isClass: true, level: 5, careerIndex: 0, basics: { team: 'KnightsAndMages' } };
  // rolls at 0: the staff at iron, no shortblade (Dice100 at 0 -> roll 1 <= 50 succeeds... so a sidearm), robes variant 0, every armor piece lands
  const eq = assignRriEnemyEquipment(mage, 0, 5, { player, rolls: () => 0 });
  assert.equal(eq.rightHand.templateIndex, WEAPONS.Staff, 'a mage holds a staff');
  assert.equal(eq.rightHand.material, WEAPON_MATERIALS.Iron);
  const robes = eq.worn.find((it) => it.group === 'MensClothing');
  assert.equal(robes.templateIndex, 163, 'Plain_robes, worn');
  assert.equal(robes.dye, 0, 'DyeColors.Blue, the factory default');
  for (const it of eq.worn) assert.equal(it.currentCondition, Math.trunc(0.3 * it.maxCondition), `AddOrEquipWornItem: Range(0.3, 0.75) at 0 - ${it.name}`);
  const sidearm = eq.items.find((it) => it.group === 'Weapons' && it !== eq.rightHand);
  assert.ok(sidearm && !eq.worn.includes(sidearm), 'the shortblade is carried, not worn');
  assert.equal(eq.items.filter((it) => it.group === 'Armor').length, 4, 'armored 35 at roll 0: torso 35, legs 25, feet 15, head 5, then -15 - four pieces, no arms, no gloves');
});

test('RRI2 realisticEnemyEquipment: the armor ladder, the archer\'s quiver, the prefChain/prefLeather draw, and the assigner seam', () => {
  reset();
  const player = { level: 5, gender: 'female', race: 'Breton' };
  const mage = { mobileType: MOBILE_TYPES.Mage, isClass: true, level: 5, careerIndex: 0 };
  let eq = assignRriEnemyEquipment(mage, 0, 5, { player, rolls: () => 0 });
  // armored 35 -> torso (35), legs (25), feet (15), head (5); then armored = -15 < 0: no arms, no gloves
  assert.equal(eq.items.filter((it) => it.group === 'Armor').length, 4, 'the falling ladder at roll 0');
  eq = assignRriEnemyEquipment(mage, 0, 5, { player, rolls: () => 0.29 });
  assert.equal(eq.items.filter((it) => it.group === 'Armor').length, 1, 'a Dice100 roll of 30: the torso at 35 lands, the legs at 25 do not - the ladder FALLS by ten');
  assert.equal(eq.worn.find((it) => it.group === 'WomensClothing')?.templateIndex, 200, 'her robes');
  // prefLeather + newArmor: coin flip at 0 -> the classic piece (Range(0,2) = 0 is "true")
  assert.equal(getArmorTemplateIndex('ChestArmor', false, true, () => 0), 102, 'coin flip 0: Cuirass');
  assert.equal(getArmorTemplateIndex('ChestArmor', false, true, () => 0.9), RRI_ITEM.Jerkin, 'coin flip 1: the Jerkin');
  assert.equal(getArmorTemplateIndex('ChestArmor', true, false, () => 0.9), RRI_ITEM.Hauberk, 'chain: the Hauberk');
  assert.equal(getArmorTemplateIndex('Head', false, true, () => 0.9), RRI_ITEM.Helmet);
  assert.equal(getArmorTemplateIndex('Gloves', true, false, () => 0.9), RRI_ITEM.Gloves, 'no chain gloves: the leather pair');
  assert.equal(getArmorTemplateIndex('ChestArmor', false, false, () => 0.9), 102, 'no preference: classic');
  on('newArmor', false);
  assert.equal(getArmorTemplateIndex('ChestArmor', false, true, () => 0.9), 102, 'newArmor off: classic');
  reset();
  // an archer: bow worn, blade carried, 4-16 arrows carried
  const archer = { mobileType: MOBILE_TYPES.Archer, isClass: true, level: 5, careerIndex: 13 };
  eq = assignRriEnemyEquipment(archer, 0, 5, { player, rolls: () => 0 });
  assert.equal(eq.rightHand.templateIndex, WEAPONS.Short_Bow);
  const arrows = eq.items.find((it) => it.templateIndex === WEAPONS.Arrow);
  assert.equal(arrows.stackCount, 4, 'Range(4, 17) at 0');
  assert.ok(!eq.worn.includes(arrows));
  assert.equal(eq.armorValues.length, 7, 'the armor-value pass ran over the kit');
  // a custom piece's value reaches the pass: a jerkin (leather 3 x 5) on the chest
  const barb = { mobileType: MOBILE_TYPES.Barbarian, isClass: true, level: 5, careerIndex: 15 };
  eq = assignRriEnemyEquipment(barb, 0, 5, { player, rolls: seq(0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0) });
  assert.ok(eq.armorValues.every((v) => v <= 100));
  // the seam: DFU's arm when the module is off, the mod's when on
  on('realisticEnemyEquipment', false);
  assert.equal(assignRriEnemyEquipment(mage, 0, 5, { player, rolls: () => 0 }), null);
  let d = assignEnemyStartingEquipment(mage, 0, 5, { player, rolls: () => 0 });
  assert.equal(d.items, undefined, 'off: ItemHelper\'s shape (no minted list)');
  assert.ok(equipmentItems(d).length >= 1);
  reset();
  d = assignEnemyStartingEquipment(mage, 0, 5, { player, rolls: () => 0 });
  assert.ok(Array.isArray(d.items) && d.items.length > 0, 'on: the mod\'s list');
  assert.equal(equipmentItems(d), d.items, 'equipmentItems hands the minted list over as it is');
});

test('RRI2 ConvertOrcish: an Orc\'s ebony-and-up (a Warlord\'s mithril-and-up) is Orcish four times in five - weight, value and condition the template\'s under the new material', () => {
  reset();
  const orc = { mobileType: MOBILE_TYPES.Orc, isClass: false, level: 5, careerIndex: 7, basics: { team: 'Orcs' } };
  const eq = () => ({
    rightHand: mint({ group: 'Weapons', templateIndex: WEAPONS.Longsword, material: WEAPON_MATERIALS.Daedric, flags: 0 }),
    leftHand: mint({ group: 'Weapons', templateIndex: WEAPONS.Dagger, material: WEAPON_MATERIALS.Ebony, flags: 0 }),
    armorPieces: [{ piece: 102, material: ARMOR_MATERIAL.Daedric }, { piece: 104, material: ARMOR_MATERIAL.Leather }, { piece: 107, material: ARMOR_MATERIAL.Mithril }, { piece: 109, material: ARMOR_MATERIAL.Ebony, shield: true }],
  });
  let e = convertOrcish(orc, eq(), () => 0);
  assert.equal(e.rightHand.material, WEAPON_MATERIALS.Orcish);
  assert.equal(e.leftHand.material, WEAPON_MATERIALS.Orcish, 'Ebony converts for a plain Orc');
  assert.equal(e.rightHand.maxCondition, mint({ group: 'Weapons', templateIndex: WEAPONS.Longsword, material: WEAPON_MATERIALS.Orcish }).maxCondition, 'the condition re-minted from the template under Orcish');
  assert.equal(e.rightHand.value, mint({ group: 'Weapons', templateIndex: WEAPONS.Longsword, material: WEAPON_MATERIALS.Orcish }).value);
  assert.equal(e.armorPieces[0].material, ARMOR_MATERIAL.Orcish);
  assert.equal(e.armorPieces[1].material, ARMOR_MATERIAL.Leather, 'leather reads 0 under the mask');
  assert.equal(e.armorPieces[2].material, ARMOR_MATERIAL.Mithril, 'Mithril is below a plain Orc\'s Ebony');
  assert.equal(e.armorPieces[3].material, ARMOR_MATERIAL.Orcish, 'a shield converts too (ItemGroup Armor)');
  e = convertOrcish({ ...orc, mobileType: MOBILE_TYPES.OrcWarlord }, eq(), () => 0);
  assert.equal(e.armorPieces[2].material, ARMOR_MATERIAL.Orcish, 'a Warlord converts from Mithril');
  e = convertOrcish(orc, eq(), () => 0.99);
  assert.equal(e.rightHand.material, WEAPON_MATERIALS.Daedric, 'the 20%: untouched');
  e = convertOrcish({ ...orc, basics: { team: 'Undead' } }, eq(), () => 0);
  assert.equal(e.rightHand.material, WEAPON_MATERIALS.Daedric, 'not an Orc');
  // through the seam: a monster runs DFU's roll then the conversion
  const worn = assignEnemyStartingEquipment(orc, 0, 5, { player: { gender: 'male' }, rolls: () => 0 });
  assert.equal(worn.items, undefined, 'ItemHelper\'s shape for a monster');
  assert.equal(worn.armorValues.length, 7);
});

// ---- skillBasedStartingEquipment ---------------------------------------------
test('RRI2 skillBasedStartingEquipment: the kit by the six skills (:759-897) - no class weapon, Range(5, Luck) gold, the iron dagger, the ebony dagger worn to a fifth; off, AssignStartingGear', () => {
  reset();
  const career = { luck: 60, primarySkills: [SKILLS.Archery, SKILLS.Medical, SKILLS.Mercantile], majorSkills: [SKILLS.Lockpicking, SKILLS.Dodging, SKILLS.Stealth], forbiddenMaterialsFlags: 0, weaponArmorShieldsBitfield: 0 };
  const fresh = () => ({ gender: 'male', race: 'Breton', career, items: [mint({ group: 'Weapons', templateIndex: WEAPONS.Dagger, material: WEAPON_MATERIALS.Ebony })], goldPieces: 0, stats: { luck: 60 }, activeEffects: [] });
  let e = fresh();
  const added = assignStartingEquipment(e, { rolls: () => 0, torchesFromItems: false });
  const has = (pred) => e.items.filter(pred);
  assert.equal(e.items[0].currentCondition, Math.trunc(e.items[0].maxCondition * 0.2), 'the biography\'s ebony dagger at 20%');
  assert.equal(has((it) => it.templateIndex === WEAPONS.Short_Bow).length, 1, 'Archery: a short bow');
  assert.equal(has((it) => it.templateIndex === WEAPONS.Arrow)[0].stackCount, 30, 'and 30 arrows');
  assert.equal(has((it) => it.templateIndex === 249)[0].stackCount, 4, 'Medical: four bandages');
  assert.equal(has((it) => it.group === 'UselessItems1').length, 1, 'Lockpicking: a potion');
  assert.equal(has((it) => it.templateIndex === KIT.MensCasualCloak).length, 1, 'Dodging: a cloak');
  assert.equal(has((it) => it.templateIndex === KIT.MensKhajiitSuit).length, 1, 'Stealth: a khajiit suit');
  assert.equal(has((it) => it.templateIndex === KIT.MensShortShirt).length, 1);
  assert.equal(has((it) => it.templateIndex === KIT.MensCasualPants).length, 1);
  assert.equal(has((it) => it.templateIndex === KIT.Spellbook).length, 1);
  const dagger = has((it) => it.templateIndex === WEAPONS.Dagger && it.material === WEAPON_MATERIALS.Iron);
  assert.equal(dagger.length, 1, 'the iron dagger');
  assert.equal(has((it) => it.templateIndex === 120).length, 0, 'no class weapon (AssignStartingGear is set aside)');
  assert.equal(e.goldPieces, 60 + 5, 'Mercantile Range(60, 240) at 0, then Range(5, 60) at 0');
  const slots = equipTableOf(e);
  assert.ok(!slots.some((it) => it?.templateIndex === KIT.MensCasualCloak), 'the cloak is carried - AssignSkillItems never passes equip: true');
  assert.ok(slots.some((it) => it?.templateIndex === KIT.MensShortShirt) && slots.some((it) => it?.templateIndex === KIT.MensCasualPants), 'the clothes go on');
  assert.ok(!slots.some((it) => it?.templateIndex === WEAPONS.Short_Bow), 'the bow is carried, not drawn (AddOrEquipWornItem without equip)');
  assert.equal(added.length, e.items.length - 1, 'answers what it added');
  // the upgrade: luck 60 -> Dice100(60) at roll 0 succeeds -> steel and chain
  const bow = has((it) => it.templateIndex === WEAPONS.Short_Bow)[0];
  assert.equal(bow.material, WEAPON_MATERIALS.Steel, 'upgrade at luck 60: steel');
  e = { ...fresh(), career: { ...career, luck: 40, primarySkills: [SKILLS.Streetwise], majorSkills: [] } };
  assignStartingEquipment(e, { rolls: () => 0.5, torchesFromItems: false });
  assert.equal(e.items.find((it) => it.templateIndex === 102).material, ARMOR_MATERIAL.Leather, 'luck 40: Dice100(20) at roll 51 fails - leather');
  e = { ...fresh(), career: { ...career, luck: 40, primarySkills: [SKILLS.Streetwise], majorSkills: [], weaponArmorShieldsBitfield: 1 << 6 } };
  assignStartingEquipment(e, { rolls: () => 0.5, torchesFromItems: false });
  assert.equal(e.items.find((it) => it.templateIndex === 102).material, ARMOR_MATERIAL.Chain, 'leather forbidden: chain regardless');
  e = { ...fresh(), career: { ...career, luck: 90, primarySkills: [SKILLS.LongBlade], majorSkills: [], forbiddenMaterialsFlags: 2 } };
  assignStartingEquipment(e, { rolls: () => 0, torchesFromItems: false });
  assert.equal(e.items.find((it) => it.templateIndex === WEAPONS.Saber).material, WEAPON_MATERIALS.Iron, 'steel forbidden: no upgrade');
  e = fresh();
  assignStartingEquipment(e, { rolls: () => 0, torchesFromItems: true });
  assert.equal(e.items.filter((it) => it.templateIndex === KIT.Torch).length, 6, 'PlayerTorchFromItems: six torches');
  assert.equal(e.items.filter((it) => it.templateIndex === KIT.Candle).length, 4, 'and four candles');
  on('skillBasedStartingEquipment', false);
  e = { gender: 'male', race: 'Breton', career, items: [], goldPieces: 0, activeEffects: [] };
  assignStartingEquipment(e, { classIndex: 0, rolls: () => 0, torchesFromItems: false });
  assert.equal(e.goldPieces, STARTING_GOLD, 'off: AssignStartingGear\'s 100 gold');
  assert.ok(e.items.some((it) => it.templateIndex === 116), 'off: the Mage\'s class shortsword');
  reset();
});

// ---- skillBasedStartingSpells --------------------------------------------------
test('RRI2 skillBasedStartingSpells: the spellbook by the six skills (:916-968), the nine new spells as classic records (:1001-1096); off, SetStartingSpells\' sets', () => {
  reset();
  const byIndex = new Map([1, 2, 38, 44, 94, 97].map((i) => [i, { index: i, name: `classic ${i}`, effects: [] }]));
  const career = { primarySkills: [SKILLS.Destruction, SKILLS.Mysticism, SKILLS.Thaumaturgy], majorSkills: [SKILLS.Alteration, SKILLS.Illusion, SKILLS.Restoration] };
  const spells = assignSkillSpellbook(career, byIndex);
  assert.deepEqual(spells.map((s) => s.name), ['Arcane Arrow', 'Minor Shock', 'Knock', 'Knick-Knack', 'classic 1', 'classic 94', 'classic 2', 'Rise', 'Gentle Fall', 'Candle', 'Salve Bruise'],
    'primary: Destruction both, Mysticism both + Door Jam + Recall, Thaumaturgy Buoyancy + Rise; major: one each');
  assert.deepEqual(assignSkillSpellbook({ primarySkills: [SKILLS.Thaumaturgy, SKILLS.Restoration], majorSkills: [SKILLS.Archery] }, byIndex).map((s) => s.name), ['classic 2', 'Rise', 'Salve Bruise', 'Smelling Salts', 'classic 97']);
  assert.deepEqual(assignSkillSpellbook({ primarySkills: [], majorSkills: [SKILLS.Thaumaturgy, SKILLS.Restoration] }, byIndex).map((s) => s.name), ['classic 2', 'Salve Bruise'], 'as a major skill: Buoyancy alone, the bruise alone');
  // the records: EffectBundleSettings the other way round (EntityEffectBroker.cs:950-1027)
  const ms = RRI_SPELLS.minorShock;
  assert.equal(ms.rangeType, 1, 'ByTouch'); assert.equal(ms.element, 3, 'Shock'); assert.equal(ms.icon, 37);
  assert.deepEqual([ms.effects[0].type, ms.effects[0].subType], [4, 0], 'DamageHealth = MakeClassicKey(4, 0)');
  assert.deepEqual([ms.effects[0].magnitudeBaseLow, ms.effects[0].magnitudeBaseHigh, ms.effects[0].magnitudeLevelBase, ms.effects[0].magnitudeLevelHigh, ms.effects[0].magnitudePerLevel], [2, 10, 1, 2, 1], '2-10 + 1-2 per level');
  assert.equal(ms.effects[1].type, -1, 'the two unused slots');
  assert.equal(RRI_SPELLS.arcaneArrow.rangeType, 2, 'SingleTargetAtRange');
  assert.deepEqual([RRI_SPELLS.gentleFall.effects[0].type, RRI_SPELLS.gentleFall.effects[0].subType], [25, 255], 'Slowfall');
  assert.deepEqual([RRI_SPELLS.gentleFall.effects[0].durationBase, RRI_SPELLS.gentleFall.effects[0].durationMod, RRI_SPELLS.gentleFall.effects[0].durationPerLevel], [2, 1, 2]);
  assert.deepEqual([RRI_SPELLS.knock.effects[0].type, RRI_SPELLS.knock.effects[0].subType, RRI_SPELLS.knock.effects[0].chanceBase, RRI_SPELLS.knock.effects[0].chanceMod, RRI_SPELLS.knock.effects[0].chancePerLevel], [17, 255, 8, 0, 2], 'Open: chance 8 + 2 per level (Open supports chance alone)');
  assert.deepEqual([RRI_SPELLS.salveBruise.effects[0].type, RRI_SPELLS.salveBruise.effects[0].subType], [10, 8], 'HealHealth');
  assert.deepEqual([RRI_SPELLS.smellingSalts.effects[0].type, RRI_SPELLS.smellingSalts.effects[0].subType], [10, 9], 'HealFatigue');
  assert.deepEqual([RRI_SPELLS.rise.effects[0].type, RRI_SPELLS.candle.effects[0].type, RRI_SPELLS.knickKnack.effects[0].type], [14, 15, 2], 'Levitate, LightNormal, CreateItem');
  for (const sp of Object.values(RRI_SPELLS)) { assert.ok(Number.isFinite(sp.cost) && sp.cost >= 5, `${sp.name} costs`); assert.ok(sp.index >= 990 && sp.rri, 'the port\'s own index'); }
  assert.equal(new Set(Object.values(RRI_SPELLS).map((s) => s.index)).size, 9);
  // the seam
  assert.equal(assignStartingSpells(0, byIndex, career).map((s) => s.name)[0], 'Arcane Arrow', 'on: the mod\'s book');
  on('skillBasedStartingSpells', false);
  assert.deepEqual(assignStartingSpells(0, byIndex, career).map((s) => s.index), [1, 2, 97], 'off: the Mage set, the ids the map holds (37 and 8 are not in this map)');
  reset();
});

// ---- the wiring --------------------------------------------------------------
test('RRI2 wiring: the install registers the six delegates; the read-through sites; DFU\'s order at the corpse and the pile; the two shelf doors; the use-handler arm ahead of the ladder; the stackable arm', () => {
  const inst = rd('src/systems/rriInstall.js');
  assert.match(inst, /installRoleplayRealismModules\(\);/);
  for (const s of ['registerItemUseHandler(BANDAGE_TEMPLATE, useBandage)', 'setEnemyEquipmentAssigner(assignRriEnemyEquipment)', "setStartingEquipmentAssigner((entity, opts) => (rriModule('skillBasedStartingEquipment') ? assignSkillEquipment(entity, opts) : null))", "setStartingSpellsAssigner((career, spellsByIndex) => (rriModule('skillBasedStartingSpells') ? assignSkillSpellbook(career, spellsByIndex) : null))", 'registerWeaponDamageOverride({ min: rriWeaponMinDamage, max: rriWeaponMaxDamage })', 'registerMeleeWeaponAnimTime(rriAnimTimeOverride)']) assert.ok(inst.includes(s), s);
  assert.match(rd('src/systems/loot.js'), /const matrix = rriLootMatrix\(lootTableKey\) \?\? LOOT_MATRICES\[lootTableKey\] \?\? LOOT_MATRICES\['-'\];/, 'the matrix read-through');
  assert.match(rd('src/systems/loot.js'), /randomlyAddPotionRecipe\(2, items, rolls\);\n[\s\S]{0,400}?if \(conditionBasedPricesOn\(\)\) randomConditionLootItems\(items, rolls\);\n  return items;\n\}/, 'the pile: LootTables.OnLootSpawned after the J..O tail');
  const hc = rd('src/scenes/hostCombat.js');
  assert.match(hc, /addEnemyLootExtras\(entity\.items, basics, rolls\);\n[\s\S]{0,700}?if \(conditionBasedPricesOn\(\)\) randomConditionLootItems\(\[\.\.\.new Set\(\[\.\.\.entity\.items, \.\.\.\(eq\?\.worn \?\? \[\]\)\]\)\], rolls\);\n  rollCorpseLoot/, 'the corpse: EnemyEntity.OnLootSpawned after the trio, before the port\'s arm');
  assert.match(hc, /const worn = eq\.worn \?\? all;\n  eq\.worn = worn;/, 'the assigner\'s worn subset is what the table takes');
  assert.match(hc, /for \(const it of worn\) \{\n    const slot = getEquipSlot\(entity, it\);/, 'and only that');
  const wm = rd('src/scenes/worldModes.js');
  assert.equal((wm.match(/onShopShelfStocked\(stockShopShelf\(\{ buildingType: b\.buildingType, quality: b\.quality \}, playerEntity\), b\)/g) ?? []).length, 2, 'both shelf doors');
  assert.match(rd('src/systems/useItem.js'), /const handler = itemUseHandler\(item\.templateIndex\);\n  if \(handler\) \{\n    const handled = handler\(item, collection, \{ entity, rolls, nowMinute \}\);\n    if \(handled\) return questItem \? \{ \.\.\.handled, questItem: true \} : handled;\n  \}\n\n  let out = null;/, 'the delegate arm, then the ladder');
  assert.match(rd('src/systems/inventory.js'), /if \(isRriStackable\(item\)\) return true;/);
  assert.match(rd('src/systems/shopStock.js'), /let cost = conditionBasedPricesOn\(\) \? conditionCostBase\(baseValue, conditionPercentage\) : baseValue;/);
  assert.match(rd('src/systems/tradeModes.js'), /calculateCost\(itemValueOf\(item\), quality, priceAdjustment, conditionPercentage\(item\)\) \* stack;/, 'the Sell arm passes ConditionPercentage (:462)');
  assert.match(rd('src/systems/repairService.js'), /conditionBasedPricesOn\(\) \? conditionRepairCostBase\(baseItemValue, condition, max, instantRepairs\) : Math\.trunc\(10 \* baseItemValue \/ 100\)/);
  assert.match(rd('src/systems/chargenSession.js'), /assignStartingSpells\(setIndex, spellsByIndex, result\.career\)/);
  assert.match(rd('src/systems/chargenSession.js'), /assignStartingEquipment\(playerEntity, \{ classIndex: result\.careerIndex/);
  assert.match(rd('src/combat/weaponWidget.js'), /const animCtx = \(\) => \(\{ entity: ctx\?\.entity \?\? null, weaponType: w\.currentWeaponType, usingRightHand: usingRightHand\(\) \}\);/);
  assert.equal((rd('src/combat/weaponWidget.js').match(/widgetAnimTickTime\(w\.currentWeaponType, liveSpeed\(\), w\.s\.swing, animCtx\(\)\)/g) ?? []).length, 4, 'every tick asks with the ctx');
  assert.equal(conditionPercentage({ currentCondition: 1, maxCondition: 3 }), 33, 'ConditionPercentage: C# integer division');
  assert.equal(conditionPercentage({ currentCondition: 0, maxCondition: 0 }), 100);
});
