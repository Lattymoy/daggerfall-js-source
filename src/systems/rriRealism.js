// RRI2 - ROLEPLAY & REALISM: ITEMS, THE NINE MODULES PAST THE ITEMS.
// The laws of RoleplayRealismItemsMod.cs (Hazelnut & Ralzar, MIT;
// vendor/roleplay-realism-items/Scripts/) that InitMod registers when
// each module switch is on: the loot rewrite, bandaging, condition
// prices, store-quality condition, weapon balance, the alchemist's
// potions. Every function names the C# member it restates; the ones
// that mint items or read entities (the enemy kit, the starting kit,
// the spellbook, the shelf hooks, the bandage) live in
// combat/rriEnemyEquipment.js and systems/rriKits.js so this module
// stays a leaf the loot table and the trade window can import.
//
// The switches are the mod's own (systems/modSettings.js, vendor
// 'roleplay-realism-items'), read at the site every time - DFU reads
// them once at Awake and registers or not; here a pane toggle takes
// effect at the next roll, which the Features row says.
import { rriModule } from './rriItems.js';
import { WEAPONS } from '../characters/weapons.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';

// ---- constants (RoleplayRealismItemsMod.cs:19-22) --------------------
export const SPEED_REDUCTION_FACTOR = 3.4;
export const REPAIR_COST_FACTOR = 0.6;
export const INSTANT_REPAIR_COST_FACTOR = 0.9;

// ---- lootRebalance ----------------------------------------------------
/** LootRealismTables (:1118-1144), verbatim: the 22 classic keys re-rowed
 *  and three new ones (LR1 warrior/barbarian, LR2 healer/orc shaman,
 *  LR3 spellcasters). `LootTables.DefaultLootTables = LootRealismTables`
 *  replaces the whole matrix while the module is on. */
export const RRI_LOOT_MATRICES = Object.freeze({
  '-':   { MinGold: 0,  MaxGold: 0,  P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0,  AM: 0,  WP: 0,  MI: 0, CL: 0,  BK: 0,  M2: 0, RL: 0 },   // None
  A:     { MinGold: 0,  MaxGold: 5,  P1: 0, P2: 0, C1: 1, C2: 1, C3: 1, M1: 0,  AM: 1,  WP: 5,  MI: 1, CL: 5,  BK: 0,  M2: 1, RL: 0 },   // Orcs
  B:     { MinGold: 0,  MaxGold: 0,  P1: 5, P2: 5, C1: 0, C2: 0, C3: 0, M1: 0,  AM: 0,  WP: 0,  MI: 0, CL: 0,  BK: 0,  M2: 0, RL: 0 },   // Nature
  C:     { MinGold: 0,  MaxGold: 10, P1: 5, P2: 5, C1: 3, C2: 3, C3: 3, M1: 3,  AM: 10, WP: 20, MI: 1, CL: 50, BK: 2,  M2: 2, RL: 1 },   // Rangers
  D:     { MinGold: 0,  MaxGold: 0,  P1: 2, P2: 2, C1: 2, C2: 2, C3: 2, M1: 2,  AM: 0,  WP: 0,  MI: 0, CL: 0,  BK: 0,  M2: 0, RL: 0 },   // Harpy
  E:     { MinGold: 0,  MaxGold: 10, P1: 2, P2: 2, C1: 5, C2: 5, C3: 5, M1: 2,  AM: 0,  WP: 5,  MI: 0, CL: 0,  BK: 0,  M2: 1, RL: 2 },   // Giant
  F:     { MinGold: 2,  MaxGold: 15, P1: 2, P2: 2, C1: 5, C2: 5, C3: 5, M1: 2,  AM: 80, WP: 70, MI: 2, CL: 0,  BK: 0,  M2: 3, RL: 10 },  // Giant Loot
  G:     { MinGold: 0,  MaxGold: 8,  P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0,  AM: 10, WP: 1,  MI: 1, CL: 10, BK: 0,  M2: 3, RL: 5 },   // Undead naked
  H:     { MinGold: 0,  MaxGold: 5,  P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0,  AM: 5,  WP: 30, MI: 1, CL: 2,  BK: 1,  M2: 0, RL: 5 },   // Undead armed
  I:     { MinGold: 0,  MaxGold: 0,  P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0,  AM: 0,  WP: 0,  MI: 1, CL: 0,  BK: 0,  M2: 0, RL: 5 },   // Undead spirits
  J:     { MinGold: 10, MaxGold: 40, P1: 3, P2: 3, C1: 3, C2: 3, C3: 3, M1: 5,  AM: 1,  WP: 1,  MI: 5, CL: 5,  BK: 5,  M2: 2, RL: 10 },  // Undead bosses
  K:     { MinGold: 10, MaxGold: 20, P1: 3, P2: 3, C1: 3, C2: 3, C3: 3, M1: 3,  AM: 70, WP: 50, MI: 3, CL: 0,  BK: 2,  M2: 2, RL: 80 },  // Undead Loot
  L:     { MinGold: 0,  MaxGold: 10, P1: 0, P2: 0, C1: 3, C2: 3, C3: 3, M1: 3,  AM: 70, WP: 50, MI: 2, CL: 20, BK: 0,  M2: 3, RL: 3 },   // Nest Loot
  M:     { MinGold: 0,  MaxGold: 7,  P1: 1, P2: 1, C1: 1, C2: 1, C3: 1, M1: 2,  AM: 80, WP: 40, MI: 2, CL: 15, BK: 2,  M2: 3, RL: 1 },   // Cave Loot
  N:     { MinGold: 1,  MaxGold: 40, P1: 5, P2: 5, C1: 5, C2: 5, C3: 5, M1: 5,  AM: 90, WP: 60, MI: 2, CL: 20, BK: 5,  M2: 2, RL: 5 },   // Castle Loot
  O:     { MinGold: 0,  MaxGold: 30, P1: 1, P2: 1, C1: 1, C2: 1, C3: 1, M1: 1,  AM: 5,  WP: 10, MI: 1, CL: 60, BK: 0,  M2: 0, RL: 0 },   // Rogues
  P:     { MinGold: 2,  MaxGold: 10, P1: 5, P2: 2, C1: 2, C2: 2, C3: 2, M1: 2,  AM: 10, WP: 10, MI: 2, CL: 50, BK: 9,  M2: 2, RL: 0 },   // Spellsword
  Q:     { MinGold: 10, MaxGold: 40, P1: 2, P2: 2, C1: 4, C2: 4, C3: 4, M1: 2,  AM: 0,  WP: 0,  MI: 2, CL: 70, BK: 5,  M2: 3, RL: 5 },   // Vampires
  R:     { MinGold: 2,  MaxGold: 10, P1: 0, P2: 0, C1: 3, C2: 3, C3: 3, M1: 5,  AM: 0,  WP: 0,  MI: 1, CL: 0,  BK: 0,  M2: 2, RL: 0 },   // Water monsters
  S:     { MinGold: 30, MaxGold: 70, P1: 5, P2: 5, C1: 5, C2: 5, C3: 5, M1: 15, AM: 0,  WP: 0,  MI: 8, CL: 5,  BK: 5,  M2: 2, RL: 10 },  // Dragon Loot, Daedras
  T:     { MinGold: 10, MaxGold: 50, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0,  AM: 60, WP: 40, MI: 0, CL: 50, BK: 10, M2: 0, RL: 10 },  // Knight Orc Warlord
  U:     { MinGold: 0,  MaxGold: 40, P1: 5, P2: 5, C1: 5, C2: 5, C3: 5, M1: 10, AM: 20, WP: 20, MI: 4, CL: 20, BK: 90, M2: 5, RL: 70 },  // Laboratory Loot
  LR1:   { MinGold: 0,  MaxGold: 20, P1: 0, P2: 0, C1: 0, C2: 0, C3: 0, M1: 0,  AM: 40, WP: 50, MI: 1, CL: 50, BK: 0,  M2: 0, RL: 5 },   // Warrior, Barbarian
  LR2:   { MinGold: 0,  MaxGold: 5,  P1: 3, P2: 3, C1: 1, C2: 1, C3: 3, M1: 3,  AM: 0,  WP: 20, MI: 1, CL: 60, BK: 10, M2: 3, RL: 0 },   // Healer, Orc Shaman
  LR3:   { MinGold: 0,  MaxGold: 30, P1: 3, P2: 3, C1: 1, C2: 1, C3: 1, M1: 2,  AM: 0,  WP: 20, MI: 1, CL: 95, BK: 45, M2: 2, RL: 10 },  // Spellcasters
});

/** MobLootKeys (:1098-1116). The C# keys are EnemyBasics.Enemies ARRAY
 *  indices - `MobileTypes.Mage - G` with G = 85, "Mob Array Gap from
 *  42 .. 128" - and the port's basics are keyed by mobile id, so the
 *  rows are spelled by id here: the monsters as they are, the class
 *  rows as 128+. */
export const RRI_MOB_LOOT_KEYS = Object.freeze({
  [MOBILE_TYPES.Giant]: 'E',
  [MOBILE_TYPES.Nymph]: 'B',
  [MOBILE_TYPES.Mummy]: 'J',
  [MOBILE_TYPES.OrcShaman]: 'LR2',
  [MOBILE_TYPES.Lich]: 'J',
  [MOBILE_TYPES.FireDaedra]: 'S',
  [MOBILE_TYPES.Daedroth]: 'S',
  [MOBILE_TYPES.DaedraSeducer]: 'S',
  [MOBILE_TYPES.Mage]: 'LR3',
  [MOBILE_TYPES.Battlemage]: 'LR3',
  [MOBILE_TYPES.Sorcerer]: 'LR3',
  [MOBILE_TYPES.Healer]: 'LR2',
  [MOBILE_TYPES.Nightblade]: 'LR3',
  [MOBILE_TYPES.Monk]: 'O',
  [MOBILE_TYPES.Barbarian]: 'LR1',
  [MOBILE_TYPES.Warrior]: 'LR1',
});

export const lootRebalanceOn = () => rriModule('lootRebalance');
/** `LootTables.DefaultLootTables = LootRealismTables` (:87): the matrix
 *  a key answers while the module is on, or null (the classic table's
 *  turn). */
export const rriLootMatrix = (key) => (lootRebalanceOn() ? (RRI_LOOT_MATRICES[key] ?? RRI_LOOT_MATRICES['-']) : null);
/** `EnemyBasics.Enemies[mobDataId].LootTableKey = MobLootKeys[...]`
 *  (:79-84): the key a mobile rolls with. */
export const rriEnemyLootTableKey = (mobileType, key) => (lootRebalanceOn() ? (RRI_MOB_LOOT_KEYS[mobileType] ?? key) : key);

// ---- bandaging --------------------------------------------------------
/** UselessItems2.Bandage (ItemEnums.cs). */
export const BANDAGE_TEMPLATE = 249;
/** IsItemStackable (:168-171), the override: `item.IsOfTemplate(
 *  UselessItems2, Bandage)`. FormulaHelper's own arm returns true only
 *  when the override says true (FormulaHelper.cs:2100-2102), so this is
 *  an added yes, never a no. */
export const isRriStackable = (item) => rriModule('bandaging') && item?.group === 'UselessItems2' && item?.templateIndex === BANDAGE_TEMPLATE;
/** UseBandage (:186-201): `Mathf.Min(medical / 3, MaxHealth * 0.4f)`
 *  cast to int - C# int division on the skill, the float min truncated. */
export const bandageHeal = (medical, maxHealth) => Math.trunc(Math.min(Math.trunc(medical / 3), maxHealth * 0.4));
/** StackableBandages_OnLootSpawned (:173-184): a shelf's bandage stack
 *  is `Clamp(Range(1, Quality / 2), 1, 8)` - Range's max is exclusive
 *  and, at quality 2 or 3, equal to or below its min, where Unity
 *  answers the min. */
export function shelfBandageStack(quality, rolls = Math.random) {
  const max = Math.trunc(quality / 2);
  const roll = max <= 1 ? 1 : 1 + Math.floor(rolls() * (max - 1));
  return Math.max(1, Math.min(8, roll));
}

// ---- conditionBasedPrices ---------------------------------------------
/** RandomConditionFoundLootItems (:232-245): armor, weapons and books
 *  that are not artifacts land at `Range(0.2f, 0.75f)` of their max -
 *  the comment says "20% and 70%", the code says 0.75. */
export function randomConditionLootItems(items, rolls = Math.random) {
  if (!Array.isArray(items)) return items;
  for (const item of items) {
    if (!item) continue;
    if ((item.group === 'Armor' || item.group === 'Weapons' || item.group === 'Books') && !item.artifact) {
      const conditionMod = 0.2 + rolls() * (0.75 - 0.2);
      item.currentCondition = Math.trunc((item.maxCondition ?? 0) * conditionMod);
    }
  }
  return items;
}
/** CalculateConditionCost (:247-260), the part ahead of the regional
 *  adjustment: `conditionMod = (conditionPercentage == -1) ? 1 :
 *  Max(conditionPercentage / 100f, 0.2f)`, `cost = (int)(baseValue *
 *  conditionMod)`, floored at 1. The rest of the override is
 *  FormulaHelper's own two lines, which the port's calculateCost keeps. */
export function conditionCostBase(baseValue, conditionPercentage = -1) {
  const conditionMod = conditionPercentage === -1 ? 1 : Math.max(conditionPercentage / 100, 0.2);
  let cost = Math.trunc(baseValue * conditionMod);
  if (cost < 1) cost = 1;
  return cost;
}
/** CalculateItemRepairCost (:262-278), the cost ahead of CalculateCost:
 *  `repairCostScaleFactor * (max - condition) / max` over the base
 *  value, floored at 1 - the mod's repair price scales with the damage
 *  where DFU's is a flat tenth. */
export function conditionRepairCostBase(baseItemValue, condition, max, instantRepairs = false) {
  const repairCostScaleFactor = instantRepairs ? INSTANT_REPAIR_COST_FACTOR : REPAIR_COST_FACTOR;
  const conditionFactor = max > 0 ? repairCostScaleFactor * (max - condition) / max : 0;
  return Math.max(Math.trunc(baseItemValue * conditionFactor), 1);
}
export const conditionBasedPricesOn = () => rriModule('conditionBasedPrices');

// ---- storeQualityItemCondition ---------------------------------------
/** StoreQualityItemCondition (:280-310): the low end of the condition
 *  roll by the store's quality; null at 18+ ("only ever stock new
 *  items"). Runs only under conditionBasedPrices (InitMod nests it). */
export function storeQualityLow(quality) {
  if (quality <= 3) return 0.25;        // 01 - 03, worn+
  if (quality <= 7) return 0.40;        // 04 - 07, used+
  if (quality <= 13) return 0.60;       // 08 - 13, slightly used+
  if (quality <= 17) return 0.75;       // 14 - 17, almost new+
  return null;
}
export function storeQualityItemCondition(items, quality, rolls = Math.random) {
  const low = storeQualityLow(quality);
  if (low == null || !Array.isArray(items)) return items;
  for (const item of items) {
    if (item && (item.group === 'Armor' || item.group === 'Weapons') && !item.artifact) {
      const conditionMod = low + rolls() * (1 - low);
      item.currentCondition = Math.trunc((item.maxCondition ?? 0) * conditionMod);
    }
  }
  return items;
}
export const storeQualityOn = () => conditionBasedPricesOn() && rriModule('storeQualityItemCondition');

// ---- alchemistPotions --------------------------------------------------
/** AddPotions_OnLootSpawned (:203-220): `Clamp(Range(0, Quality), 1,
 *  12)` potions at twice their value on an alchemist's shelf. */
export function alchemistPotionCount(quality, rolls = Math.random) {
  const roll = quality <= 0 ? 0 : Math.floor(rolls() * quality);
  return Math.max(1, Math.min(12, roll));
}
export const alchemistPotionsOn = () => rriModule('alchemistPotions');

// ---- weaponBalance -----------------------------------------------------
const W = WEAPONS;
/** CalculateWeaponMinDamage (:312-341), the override's case groups. */
export const RRI_WEAPON_MIN_DAMAGE = Object.freeze(Object.fromEntries([
  [[W.Dagger, W.Tanto, W.Wakazashi, W.Saber, W.Katana, W.Dai_Katana], 1],
  [[W.Shortsword, W.Broadsword, W.Longsword, W.Claymore], 2],
  [[W.Battle_Axe, W.War_Axe, W.Staff], 3],
  [[W.Mace, W.Flail, W.Warhammer, W.Short_Bow, W.Long_Bow], 4],
].flatMap(([ws, v]) => ws.map((w) => [w, v]))));
/** CalculateWeaponMaxDamage (:343-379). */
export const RRI_WEAPON_MAX_DAMAGE = Object.freeze(Object.fromEntries([
  [[W.Dagger], 6],
  [[W.Tanto], 7],
  [[W.Shortsword, W.Staff], 8],
  [[W.Wakazashi], 10],
  [[W.Mace], 12],
  [[W.Battle_Axe], 13],
  [[W.Broadsword, W.Saber], 14],
  [[W.Longsword], 15],
  [[W.Katana, W.Flail, W.Short_Bow], 16],
  [[W.Dai_Katana, W.War_Axe, W.Warhammer, W.Long_Bow], 18],
  [[W.Claymore], 19],
].flatMap(([ws, v]) => ws.map((w) => [w, v]))));
export const weaponBalanceOn = () => rriModule('weaponBalance');
/** The override's answer for a classic weapon while the module is on
 *  (`default: return 0` for anything else), or null for DFU's turn. */
export const rriWeaponMinDamage = (weapon) => (weaponBalanceOn() ? (RRI_WEAPON_MIN_DAMAGE[weapon] ?? 0) : null);
export const rriWeaponMaxDamage = (weapon) => (weaponBalanceOn() ? (RRI_WEAPON_MAX_DAMAGE[weapon] ?? 0) : null);

/** GetMeleeWeaponAnimTime (:381-409), the override: bare hands or no
 *  weapon read the live speed as DFU does; a weapon's base weight,
 *  scaled by `150 - LiveStrength` per cent, times 3.4, comes off a
 *  speed capped at 98 as `speed * reduction / 90`; then DFU's own
 *  `3 * (115 - speed)` over the classic frame update. Truncations are
 *  the C# int casts. `weaponWeight` is the ItemTemplate's baseWeight;
 *  `melee` is `weaponType == WeaponTypes.Melee`. */
export function rriMeleeWeaponAnimTime({ liveSpeed, liveStrength, weaponWeight = null, melee = false }, classicFrameUpdate) {
  let adjustedSpeed;
  if (melee || weaponWeight == null) {
    adjustedSpeed = liveSpeed;
  } else {
    const strWeightPerc = 150 - liveStrength;
    const adjustedWeight = strWeightPerc * weaponWeight / 100;
    const speedReductionPerc = adjustedWeight * SPEED_REDUCTION_FACTOR;
    const playerSpeed = Math.min(liveSpeed, 98);
    adjustedSpeed = Math.trunc(playerSpeed - (playerSpeed * speedReductionPerc / 90));
  }
  const frameSpeed = 3 * (115 - adjustedSpeed);
  return frameSpeed / classicFrameUpdate;
}
