// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FORAGE1-FORAGE2 (2026-09-28): FORAGING 1.7 (Harbinger451) - THE LAW.
// Mac: "Heres this for life skills"; "Yes, permission"; "Your lead".
// bible/06-Systems/Foraging.md is the record; this file is every rule
// the mod's compiled script and its quests hold, pure: the templates, the
// six tools' checks in their order with their lines, the rolls, the
// yields' lines, the foods, the console command, the quest names, Quest
// Actions Extension's arithmetic, FORAGE-FIX's patch table, and (FORAGE3)
// the three loot hooks' tables and draws.
//
// THE SOURCE is the mod's DLL, read as IL (vendor/foraging/il/, offsets
// IL_xxxx in hex); the templates and quests are vendored verbatim beside
// it and imported, never re-typed. Nothing here touches a host: the
// install (foragingInstall.js) asks the world, and hands this file the
// answers.
//
// RANDOMNESS. Every draw is UnityEngine.Random.Range(0, n) on ints -
// uniform, the max exclusive (PickOneOf, IL_0dc5) - taken from `rng`, a
// function answering [0, 1), so a test can pin a draw.
// ═══════════════════════════════════════════════════════════════════

import FORAGING_TEMPLATES_JSON from '../../../vendor/foraging/ItemTemplates.json' with { type: 'json' };
import { CLIMATES, LOCATION_TYPES, DUNGEON_TYPES } from '../../formats/mapsFile.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { LOOT_CONTAINER_TYPES } from '../sceneCache.js';
import { dice100 } from '../../combat/formulas.js';   // Dice100.SuccessRoll, one home
import { isPlayerInTown } from '../nearbyObjects.js';
import { ON_EXTERIOR_WATER } from '../../player/exteriorSurface.js';
import { SEA_REGION } from '../../net/nodeLaw.js';   // PROF8: the sea coast's region, one home
import { applyTextPatches } from '../quest/questPatches.js';   // SHAM-TRAIL: FORAGE-FIX's exact-count law, one home
import { TEMPLATE as CC_TEMPLATE } from '../survival/food.js';   // Climates & Calories' own ids, imported (ONE DFU MEMBER, ONE EXPORT)
// PROF1: the draws, the bands, the day and the Basket's blocks live in foragingCore.js - pure, so the account service rolls
// the Basket's food with the IL's own tables (bible/06-Systems/Professions-Arc.md 22) - and are this module's still.
import {
  pickOneOf, attributeAverage, attributeBand, isForagingDaylight, isDesertClimate, isWinterMonth, basketBlock, BASKET_BLOCKS,
} from './foragingCore.js';
export { pickOneOf, attributeAverage, attributeBand, isForagingDaylight, isDesertClimate, isWinterMonth, basketBlock, BASKET_BLOCKS };

/** The vendor key: the Features row, the switch, the credit. */
export const FORAGING_VENDOR = 'foraging';
/** Every Foraging item's group: `base(ItemGroups.UselessItems2, idx)` (IL_0dda). */
export const FORAGING_GROUP = 'UselessItems2';
/** `RegisterQuestList("ForagingQuests")` (IL_02e5). */
export const FORAGING_QUEST_LIST = 'ForagingQuests';

/** The twelve templates, by name (ItemTemplates.json). */
export const FT = Object.freeze({
  WoodAxe: 1600, PickAxe: 1601, Sickle: 1602, FishingNet: 1603, WoodBundle: 1604, Fish: 1605,
  Spade: 1606, Basket: 1607, Apple: 1608, Orange: 1609, Mushroom: 1610, Egg: 1611,
});

/** The mod's own rows, verbatim. */
export const FORAGING_TEMPLATES = Object.freeze(FORAGING_TEMPLATES_JSON.map((t) => Object.freeze({ ...t })));
export const isForagingTemplate = (templateIndex) => templateIndex >= FT.WoodAxe && templateIndex <= FT.Egg;

/** The six tools, in the console command's order (DCE7: 1600, 1601, 1602, 1603, 1606, 1607). */
export const TOOL_TEMPLATES = Object.freeze([FT.WoodAxe, FT.PickAxe, FT.Sickle, FT.FishingNet, FT.Spade, FT.Basket]);
export const isForagingTool = (templateIndex) => TOOL_TEMPLATES.includes(templateIndex);

/** The author's seven pictures (Textures/<archive>_0-0.png): archive = the texture name's number. */
export const FORAGING_TEXTURE_ARCHIVES = Object.freeze([11600, 11601, 11602, 11603, 11604, 11605, 11606]);

// ---- draws and bands -------------------------------------------------


// ---- the six checks --------------------------------------------------

/** Each tool's refusals, verbatim (the IL's ldstr), keyed by the check. */
export const FORAGING_REFUSALS = Object.freeze({
  [FT.WoodAxe]: Object.freeze({
    inside: 'You cannot find wood to chop in here!', town: 'You cannot chop wood in a settlement!',
    daylight: 'You need daylight to chop wood effectively!', sea: 'You cannot find wood to chop out here!',
    enemies: 'You cannot chop wood with enemies nearby!', encumbered: 'You cannot chop wood when fully encumbered!',
  }),
  [FT.PickAxe]: Object.freeze({
    inside: 'You cannot mine in here!', town: 'You cannot mine in a settlement!',
    daylight: 'You need daylight to mine effectively!', sea: 'You cannot mine out here!',
    enemies: 'You cannot mine with enemies nearby!', encumbered: 'You cannot mine when fully encumbered!',
  }),
  [FT.Sickle]: Object.freeze({
    inside: 'You cannot forage for plants in here!', town: 'You cannot forage for plants in a settlement!',
    daylight: 'You need daylight to forage for plants effectively!', sea: 'You cannot forage for plants out here!',
    enemies: 'You cannot forage for plants with enemies nearby!', encumbered: 'You cannot forage for plants when fully encumbered!',
  }),
  [FT.FishingNet]: Object.freeze({
    inside: 'You cannot fish in here!', town: 'You cannot fish in a settlement!',
    daylight: 'You need daylight to fish effectively!', enemies: 'You cannot fish with enemies nearby!',
    encumbered: 'You cannot fish when fully encumbered!', water: 'You need to be in water or on the ocean to fish!',
  }),
  [FT.Spade]: Object.freeze({
    inside: 'You cannot dig up a grave here!', town: 'You cannot dig up a grave in a settlement!',
    cemetery: 'You can only dig up a grave in a cemetery!', enemies: 'You cannot dig up a grave with enemies nearby!',
    encumbered: 'You cannot dig up a grave when fully encumbered!',
  }),
  [FT.Basket]: Object.freeze({
    inside: 'You cannot forage for food here!', town: 'You cannot forage for food in a settlement!',
    daylight: 'You need daylight to forage for food effectively!', sea: 'You cannot forage for food out here!',
    enemies: 'You cannot forage for food with enemies nearby!', encumbered: 'You cannot forage for food when fully encumbered!',
  }),
});

/** Each tool's checks, in the order its UseItem asks them. */
export const CHECK_ORDER = Object.freeze({
  [FT.WoodAxe]: Object.freeze(['inside', 'town', 'daylight', 'sea', 'enemies', 'encumbered']),   // IL_0df4-IL_0f27
  [FT.PickAxe]: Object.freeze(['inside', 'town', 'daylight', 'sea', 'enemies', 'encumbered']),   // IL_1328-IL_145b
  [FT.Sickle]: Object.freeze(['inside', 'town', 'daylight', 'sea', 'enemies', 'encumbered']),    // IL_165c-IL_178f
  [FT.FishingNet]: Object.freeze(['inside', 'dungeon', 'town', 'daylight', 'enemies', 'encumbered', 'water']),   // IL_1aa4-IL_1c45
  [FT.Spade]: Object.freeze(['inside', 'town', 'cemetery', 'enemies', 'encumbered']),   // IL_20b8-IL_21b4
  [FT.Basket]: Object.freeze(['inside', 'town', 'daylight', 'sea', 'enemies', 'encumbered']),    // IL_267e-IL_27b1
});

/**
 * @typedef {object} ForagingWorld What the checks ask the world (the install fills it).
 * @property {boolean} inside            PlayerEnterExit.IsPlayerInside (a building or a dungeon)
 * @property {boolean} insideDungeon     IsPlayerInsideDungeon
 * @property {boolean} insideCastle      IsPlayerInsideDungeonCastle
 * @property {number} locationType       PlayerGPS.CurrentLocationType (LOCATION_TYPES)
 * @property {boolean} inLocationRect    PlayerGPS.IsPlayerInLocationRect
 * @property {number} hour               WorldTime.Now.Hour
 * @property {number} climate            PlayerGPS.CurrentClimateIndex (CLIMATES)
 * @property {number} region             PlayerGPS.CurrentRegionIndex
 * @property {boolean} enemiesNear       GameManager.AreEnemiesNearby(resting: true, includingPacified: false)
 * @property {number} carriedWeight      PlayerEntity.CarriedWeight (the pack and the gold, not the wagon)
 * @property {number} maxEncumbrance     PlayerEntity.MaxEncumbrance
 * @property {boolean} swimming          PlayerMotor.IsSwimming (the levitate motor's swim)
 * @property {string} exteriorWater      PlayerMotor.OnExteriorWater (ON_EXTERIOR_WATER)
 */

/** The High Rock sea coast's politic region - the sea pixel's (mapsFile.getRegionIndexAt). PROF8: one home, the net's
 *  law's (net/nodeLaw.js), which the service reads too. */
export { SEA_REGION };

/** The net's water (IL_1be9-IL_1c45): any one passes. */
export function netHasWater(w) {
  return !!w.swimming
    || w.exteriorWater === ON_EXTERIOR_WATER.Swimming
    || w.exteriorWater === ON_EXTERIOR_WATER.WaterWalking
    || w.climate === CLIMATES.Ocean
    || w.region === SEA_REGION;
}

/** Whether one check fails for this world. */
function checkFails(check, w) {
  switch (check) {
    case 'inside': return !!(w.inside || w.insideDungeon || w.insideCastle);
    // The net's first check is `IsPlayerInside || IsPlayerInsideDungeonCastle`, and its second the dungeon arm -
    // DEAD CODE (Q4): DFU sets IsPlayerInside in a dungeon too, so the first has refused already.
    case 'dungeon': return !!w.insideDungeon && !(w.swimming && w.climate === CLIMATES.Ocean);
    case 'town': return isPlayerInTown(w.locationType, { mustBeInLocationRect: true, mustBeOutside: true, inLocationRect: !!w.inLocationRect, inside: !!w.inside });
    case 'daylight': return !isForagingDaylight(w.hour);
    case 'sea': return w.climate === CLIMATES.Ocean;
    case 'enemies': return !!w.enemiesNear;
    // `(float)CarriedWeight < MaxEncumbrance` (blt.un) passes - and an unordered compare (NaN) passes too; only an
    // ordered not-less refuses.
    case 'encumbered': return w.carriedWeight >= w.maxEncumbrance;
    case 'cemetery': return !(w.inLocationRect && w.locationType === LOCATION_TYPES.Graveyard);
    case 'water': return !netHasWater(w);
    default: return false;
  }
}

/** The first refusal a tool gives in this world, or null to go on. The net's inside check reads inside or a
 *  castle only (its dungeon arm follows); every other tool's reads all three. PROF2: `skip` - checks a profession's
 *  node is not asked (a dungeon vein: inside, settlement, daylight and sea - PROF0 5.1). */
export function foragingRefusal(templateIndex, w, skip = null) {
  const order = CHECK_ORDER[templateIndex];
  if (!order) return null;
  for (const check of order) {
    if (skip?.includes(check)) continue;
    const fails = check === 'inside' && templateIndex === FT.FishingNet
      ? !!(w.inside || w.insideCastle)
      : checkFails(check, w);
    if (fails) return FORAGING_REFUSALS[templateIndex][check === 'dungeon' ? 'inside' : check];
  }
  return null;
}
/** PROF7 (FORAGE0 14.3): the same checks for a tool that is not Foraging's - the Skinning Knife's `order` and its own
 *  `lines` (net/professionLaw.js KNIFE_CHECKS, KNIFE_REFUSALS), in Foraging's voice. Null where every check passes. */
export function checksRefusal(order, lines, w) {
  for (const check of order) if (checkFails(check, w)) return lines[check] ?? null;
  return null;
}

// ---- the Wood-Axe (IL_0f28-IL_110c) ------------------------------------

/** The bundles drawn, by (INT + STR) / 2's band: desert (224, 225) and everywhere else. */
export const WOOD_BUNDLE_TABLES = Object.freeze({
  desert: Object.freeze([[0, 0, 0, 0, 1], [0, 0, 0, 1, 1], [0, 0, 1, 1, 1], [0, 1, 1, 1, 2]].map((r) => Object.freeze(r))),
  other: Object.freeze([[0, 0, 0, 1, 2], [0, 0, 1, 2, 3], [0, 1, 2, 3, 4], [1, 2, 3, 4, 4]].map((r) => Object.freeze(r))),
});
export function woodAxeBundles({ intelligence, strength, climate }, rng) {
  const table = isDesertClimate(climate) ? WOOD_BUNDLE_TABLES.desert : WOOD_BUNDLE_TABLES.other;
  return pickOneOf(table[attributeBand(attributeAverage(intelligence, strength))], rng);
}
const COUNT_WORDS = Object.freeze(['', 'one', 'two', 'three', 'four']);
export function woodAxeMessage(n) {
  if (n <= 0) return 'You were unable to chop and gather any usable wood!';
  return `You were able to chop and gather ${COUNT_WORDS[n]} Wood Bundle${n === 1 ? '' : 's'}!`;
}

// ---- the Pick-Axe (IL_1328-IL_1622) -----------------------------------

/** (INT + AGI) / 2 - the IL reads LiveAgility (IL_147a); the readme says Endurance (Q3). */
export const MINING_QUESTS = Object.freeze(['MiningQuestWeakest', 'MiningQuestWeaker', 'MiningQuestWeak', 'MiningQuest']);
export const pickAxeQuest = ({ intelligence, agility }) => MINING_QUESTS[attributeBand(attributeAverage(intelligence, agility))];

// ---- the Sickle (IL_1790-IL_1a2a) -------------------------------------

/** The plant quest by climate, then by the 0-based month: 8-11, 0, 1 winter; 2-7 summer. */
export function sickleQuest(climate, monthValue) {
  if (isDesertClimate(climate)) return 'ForageAridPlantsQuest';
  if (climate === CLIMATES.Subtropical || climate === CLIMATES.Mountain) return 'ForageWinterPlantsQuest';
  if (climate === CLIMATES.Swamp || climate === CLIMATES.Rainforest) return 'ForageSummerPlantsQuest';
  return isWinterMonth(monthValue) ? 'ForageWinterPlantsQuest' : 'ForageSummerPlantsQuest';
}

// ---- the Fishing-Net (IL_1c4a-IL_1fb3) --------------------------------

/** The fish drawn, by (INT + AGI) / 2's band. */
export const FISH_TABLES = Object.freeze([[0, 0, 0, 1, 1, 2], [0, 0, 1, 1, 2, 2], [0, 1, 2, 2, 3, 3], [1, 2, 2, 3, 3, 4]].map((r) => Object.freeze(r)));
export const fishingCount = ({ intelligence, agility }, rng) => pickOneOf(FISH_TABLES[attributeBand(attributeAverage(intelligence, agility))], rng);
export function fishingMessage(n) {
  if (n <= 0) return "You cast your Fishing Net, but don't catch any Fish!";
  return `You cast your Fishing Net and catch ${COUNT_WORDS[n]} Fish!`;
}

// ---- the Spade (IL_2280-IL_2619) --------------------------------------

/** (INT + END) / 2 picks the quest; Cheb's Necromancy's family when that mod is on (never, in the port). */
export const GRAVE_QUESTS = Object.freeze(['GraveRobbingQuestWeakest', 'GraveRobbingQuestWeaker', 'GraveRobbingQuestWeak', 'GraveRobbingQuest']);
export const GRAVE_CN_QUESTS = Object.freeze(['GraveRobbingCNQuestWeakest', 'GraveRobbingCNQuestWeaker', 'GraveRobbingCNQuestWeak', 'GraveRobbingCNQuest']);
export const spadeQuest = ({ intelligence, endurance }, chebs = false) =>
  (chebs ? GRAVE_CN_QUESTS : GRAVE_QUESTS)[attributeBand(attributeAverage(intelligence, endurance))];

// ---- the Basket (IL_2654-IL_4a09) -------------------------------------

/** Two draws, the count first (by INT alone), then the food. */
export function basketDraw({ intelligence, climate, monthValue }, rng) {
  const block = basketBlock(climate, monthValue);
  const b = BASKET_BLOCKS[block];
  const count = pickOneOf(b.counts[attributeBand(intelligence)], rng);
  const food = pickOneOf(b.foods, rng);
  return { block, count, food };
}

// ---- which template a find is ----------------------------------------

/** Climates & Calories' own (its TEMPLATE: Apple 532, Orange 533, Raw Fish 535) when it is on (IL_1d1c, IL_286b). */
export const CC_FRUIT = Object.freeze({ Apple: CC_TEMPLATE.Apple, Orange: CC_TEMPLATE.Orange });
export const CC_RAW_FISH = CC_TEMPLATE.RawFish;
export const fishTemplate = (cc) => (cc ? CC_RAW_FISH : FT.Fish);
export const fruitTemplate = (fruit, cc) => (cc ? CC_FRUIT[fruit] : (fruit === 'Apple' ? FT.Apple : FT.Orange));

/**
 * A Basket find: the template, how many, and the line. A count of 0 finds nothing.
 * FORAGE-FIX Q10: the C&C branch answers with the non-C&C branch's cases (its fruit C&C's) - the build's C&C branch
 * dropped (2, Egg) in block C and (4, Egg) in block E.
 */
export function basketFind({ count, food, block }, cc) {
  if (!(count > 0) || count > 4) return { templateIndex: null, count: 0, message: 'You could not find any food to forage!' };
  if (food === 4) return { templateIndex: FT.Egg, count, message: `You manage to find ${COUNT_WORDS[count]} Egg${count === 1 ? '' : 's'}!` };
  const name = food === 3 ? 'Mushroom' : BASKET_BLOCKS[block].fruit;
  const templateIndex = food === 3 ? FT.Mushroom : fruitTemplate(name, cc);
  return { templateIndex, count, message: `You manage to pick ${COUNT_WORDS[count]} ${name}${count === 1 ? '' : 's'}!` };
}

// ---- after a use -----------------------------------------------------

/** The quest each tool starts after its yield (the Pick-Axe, Sickle and Spade pick theirs above). */
export const TOOL_QUESTS = Object.freeze({ [FT.WoodAxe]: 'ChopWoodQuest', [FT.FishingNet]: 'FishingQuest', [FT.Basket]: 'ForageFoodQuest' });

/** "Your <Tool> broke." - the tool's own name, as the template names it. */
export const brokeMessage = (templateIndex, name = null) => `Your ${FORAGING_TEMPLATES.find((t) => t.index === templateIndex)?.name ?? name ?? 'tool'} broke.`;   // PROF7: a tool not Foraging's by its own name (the Skinning Knife)

// ---- the foods (IL_4a63-IL_4c2a) --------------------------------------

/** `IncreaseFatigue(n, true)` (n points), then health or magicka; one item eaten. */
export const FOODS = Object.freeze({
  [FT.Fish]: Object.freeze({ text: 'You eat a fish and feel better for it!', fatigue: 15, health: 5, magicka: 0 }),
  [FT.Apple]: Object.freeze({ text: 'You eat an Apple and feel better for it!', fatigue: 10, health: 5, magicka: 0 }),
  [FT.Orange]: Object.freeze({ text: 'You eat an Orange and feel better for it!', fatigue: 10, health: 5, magicka: 0 }),
  [FT.Mushroom]: Object.freeze({ text: 'You eat a Mushroom and feel better for it!', fatigue: 5, health: 0, magicka: 10 }),
  [FT.Egg]: Object.freeze({ text: 'You eat an Egg and feel better for it!', fatigue: 15, health: 10, magicka: 0 }),
});

// ---- the console command (IL_4c54-IL_4cd6) ----------------------------

export const FORAGING_COMMAND = Object.freeze({
  name: 'Foraging_Tools',
  description: "Adds one of each Foraging Tool to player's inventory.",
  usage: 'Foraging_Tools 0/1 n',
  answer: 'Foraging Tools added',
  /** DECIDED (FORAGE0 8): online the door is the player's own setting, so the tools are not given there. */
  refusedOnline: 'Foraging Tools are not given online.',
});

// ---- the loot hooks (FORAGE3; ForagingLoot_*, IL_0520-IL_0b8f) --------
// Every hook runs one procedure per item: PickOneOf its table, and - the
// id always a tool or the Wood Bundle (IL_05a6-IL_05ba's gate) - then
// RollForagingItemUsed over the seven codes and DetermineForagingItem. The
// tables' duplicates and gaps decide nothing: the seven rarities are all
// 10, so the seven codes weigh the same (Q1). Each item `AddItem(item,
// AddPosition.Back)`.

/** The hooks' tables, <PrivateImplementationDetails> read off the DLL. */
export const FORAGING_LOOT_TABLES = Object.freeze({
  /** 65C8: the shelves, the houses, Crypt / Ruined Castle / Cemetery, the corpses. */
  common: Object.freeze([FT.WoodAxe, FT.PickAxe, FT.Sickle, FT.FishingNet, FT.WoodBundle, FT.Spade, FT.Basket]),
  /** 1CE8: Prison, Mine. */
  prisonMine: Object.freeze([1600, 1600, 1601, 1601, 1601, 1602, 1603, 1604, 1606, 1606, 1607]),
  /** 362D: Orc, Human and Barbarian Strongholds. */
  stronghold: Object.freeze([1600, 1600, 1601, 1601, 1602, 1603, 1604, 1604, 1606, 1607]),
  /** AE25: Desecrated Temple, Coven. */
  templeCoven: Object.freeze([1600, 1601, 1602, 1602, 1603, 1606, 1607]),
  /** DCE7: Vampire Haunt, Laboratory - the console command's own array. */
  haunt: TOOL_TEMPLATES,
});
/** 447E: RollForagingItemUsed's codes; B272: their rarities, all 10. */
export const FORAGING_ITEM_CODES = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
export const FORAGING_ITEM_RARITIES = Object.freeze([10, 10, 10, 10, 10, 10, 10]);

/** DetermineForagingItem (IL_0b9c): code 1-7 -> 1600-1604, 1606, 1607; anything else 0. */
export const determineForagingItem = (code) => [FT.WoodAxe, FT.PickAxe, FT.Sickle, FT.FishingNet, FT.WoodBundle, FT.Spade, FT.Basket][code - 1] ?? 0;

/**
 * RollForagingItemUsed's weights (IL_0c23-IL_0d64): a code's copies in the list its pick is drawn from. The weight is
 * `101 - 5 x rarity`; at 60 or more `ceil(w x 2.5 + (q + luck') x 2)`, at 35 or more `ceil(w x 1.5 + q + luck')`, below
 * that `ceil(w - (q + luck'))`, clamped to 1-400 - where luck' is `(luck - 50) / 5` and q the quality, or 0 when the
 * caller passes -1 (the piles and the corpses do). Float arithmetic (conv.r4), as the IL's.
 */
export function foragingItemCount(rarity, luck, quality) {
  const w = -(rarity * 5 - 101);
  const luckMod = Math.fround(Math.fround(luck - 50) / 5);
  const mod = quality === -1 ? luckMod : Math.fround(Math.fround(quality) + luckMod);
  const raw = w >= 60 ? Math.fround(Math.fround(w * 2.5) + Math.fround(mod * 2))
    : w >= 35 ? Math.fround(Math.fround(w * 1.5) + mod)
      : Math.fround(w - mod);
  return Math.trunc(Math.min(400, Math.max(1, Math.ceil(raw))));
}
/** RollForagingItemUsed (IL_0bfc): each code's index FillArray'd its count times, one index drawn, its code answered. */
export function rollForagingItemUsed(codes, luck, quality, rng) {
  const list = [];
  for (let i = 0; i < codes.length; i++) {
    const n = foragingItemCount(FORAGING_ITEM_RARITIES[i], luck, quality);
    for (let k = 0; k < n; k++) list.push(i);
  }
  if (list.length === 0) return -1;
  return codes[pickOneOf(list, rng)];
}
/** One item of a hook's loop: the table's id (a gate the tables always pass), then the roll. Null when the gate fails. */
export function foragingLootItem(table, luck, quality, rng) {
  const picked = pickOneOf(table, rng);
  if (!((picked - FT.WoodAxe) >>> 0 <= 4 || (picked - FT.Spade) >>> 0 <= 1)) return null;
  return determineForagingItem(rollForagingItemUsed(FORAGING_ITEM_CODES, luck, quality, rng));
}

/**
 * ForagingLoot_OnLootSpawned (IL_0520-IL_083c), PlayerActivate's event: a shop shelf in a Pawn Shop draws
 * `Range(0, 1)` - always 0 (Q2) - and in a General Store `Range(0, 2)`; a house container in a Palace rolls 30% then
 * draws `Range(0, 1)` - always 0 (Q2) - and anywhere else rolls 15% then draws `Range(0, 2)`. Any other shelf, or no
 * interior: nothing drawn at all. Answers the table and the count.
 */
export function containerLootDraw({ containerType, buildingType }, rng) {
  const none = { table: FORAGING_LOOT_TABLES.common, count: 0 };
  if (containerType === LOOT_CONTAINER_TYPES.ShopShelves) {
    if (buildingType === BUILDING_TYPES.PawnShop) return { ...none, count: Math.floor(rng() * 1) };
    if (buildingType === BUILDING_TYPES.GeneralStore) return { ...none, count: Math.floor(rng() * 2) };
    return none;
  }
  if (containerType === LOOT_CONTAINER_TYPES.HouseContainers) {
    if (buildingType === BUILDING_TYPES.Palace) return dice100(30, rng()) ? { ...none, count: Math.floor(rng() * 1) } : none;
    return dice100(15, rng()) ? { ...none, count: Math.floor(rng() * 2) } : none;
  }
  return none;
}

/** ForagingLoot_OnDungeonLootSpawned's switch (IL_0873), LootTables' event, by the index GenerateLoot was given. */
export const DUNGEON_LOOT_ARMS = Object.freeze(Object.fromEntries(/** @type {Array<[number[], { chance: number, max: number, table: readonly number[] }]>} */ ([
  [[DUNGEON_TYPES.Prison, DUNGEON_TYPES.Mine], { chance: 25, max: 5, table: FORAGING_LOOT_TABLES.prisonMine }],
  [[DUNGEON_TYPES.OrcStronghold, DUNGEON_TYPES.HumanStronghold, DUNGEON_TYPES.BarbarianStronghold], { chance: 20, max: 4, table: FORAGING_LOOT_TABLES.stronghold }],
  [[DUNGEON_TYPES.Crypt, DUNGEON_TYPES.RuinedCastle, DUNGEON_TYPES.Cemetery], { chance: 15, max: 3, table: FORAGING_LOOT_TABLES.common }],
  [[DUNGEON_TYPES.DesecratedTemple, DUNGEON_TYPES.Coven], { chance: 10, max: 2, table: FORAGING_LOOT_TABLES.templeCoven }],
  // Range(0, 1): always 0 (Q2) - the roll is made and nothing follows it
  [[DUNGEON_TYPES.VampireHaunt, DUNGEON_TYPES.Laboratory], { chance: 5, max: 1, table: FORAGING_LOOT_TABLES.haunt }],
]).flatMap(([indices, arm]) => indices.map((i) => [i, Object.freeze(arm)]))));
/** A pile's roll then its count, `Range(0, max)`; a failed roll, or an index with no arm, is 0. */
export function dungeonLootDraw(locationIndex, rng) {
  const arm = DUNGEON_LOOT_ARMS[locationIndex];
  if (!arm) return { table: [], count: 0 };
  if (!dice100(arm.chance, rng())) return { table: arm.table, count: 0 };
  return { table: arm.table, count: Math.floor(rng() * arm.max) };
}

/** ForagingLoot_OnEnemyDeath's careers (IL_0a5d-IL_0af9): ClassCareers Spellsword, Rogue, Archer-Warrior; monsters
 *  Orc, Orc Sergeant, Giant. */
export const CORPSE_CLASS_CAREERS = Object.freeze([1, 8, 13, 14, 15, 16]);
export const CORPSE_MONSTER_CAREERS = Object.freeze([7, 12, 16]);
/** 1362 and 3918: the counts; the chance `Floor(5 x 1.0)` for a class, `Floor(5 x 0.5)` for a monster. */
export const CORPSE_COUNTS = Object.freeze({ class: Object.freeze([1, 1, 1, 1, 2]), monster: Object.freeze([1, 1, 1, 2]) });
/** The count drawn, then the roll (IL_0afc); a foe of no listed career draws nothing. */
export function corpseLootDraw({ isClass, careerIndex }, rng) {
  const careers = isClass ? CORPSE_CLASS_CAREERS : CORPSE_MONSTER_CAREERS;
  if (!careers.includes(careerIndex)) return { table: FORAGING_LOOT_TABLES.common, count: 0 };
  const count = pickOneOf(isClass ? CORPSE_COUNTS.class : CORPSE_COUNTS.monster, rng);
  const chance = Math.floor(5 * (isClass ? 1.0 : 0.5));
  return { table: FORAGING_LOOT_TABLES.common, count: dice100(chance, rng()) ? count : 0 };
}

// ---- Quest Actions Extension (Jagget, 2.0.0 @ 56a407e) ----------------

/** RaiseTime: `WorldTime.Now.RaiseTime(H * 3600 + MM * 60)`. */
export const raiseTimeSeconds = (hours, minutes) => Math.max(0, hours) * 3600 + Math.max(0, minutes) * 60;
/** ReducePlayerFatigue: `max(1, (int)(CurrentFatigue - MaxFatigue * N / 100f))`, raw (x64) values. */
export const reduceFatigueBy = (current, max, percent) => Math.max(1, Math.trunc(current - max * percent / 100));

// ---- FORAGE-FIX (FORAGE0 12): the quest patches ----------------------
//
// The vendored quests stay verbatim; these are applied when the pack is
// read, each an exact old text with how many times it must occur - a
// patch that finds its text any other number of times throws, so a
// changed file can never be patched silently wrong.

const RICH = '\n_rich_ task:\n\twhen _desert_ or _desert2_ or _mountain_ or _mountainwoods_ or _atmine_\n';
const miningPatches = () => Object.freeze([
  // Q7: one task fires - bounty on rich ground, scarce elsewhere, as the author meant.
  { old: '_mountainwoods_ task:\n\tclimate mountainwoods\n', new: `_mountainwoods_ task:\n\tclimate mountainwoods\n${RICH}`, count: 1 },
  { old: '\twhen _elements_ and _desert_ or _desert2_ or _mountain_ or _mountainwoods_ or _atmine_\n', new: '\twhen _elements_ and _rich_\n', count: 1 },
  { old: '\twhen _gems_ and _desert_ or _desert2_ or _mountain_ or _mountainwoods_ or _atmine_\n', new: '\twhen _gems_ and _rich_\n', count: 1 },
  { old: '\twhen _elements_ and not _desert_ or _desert2_ or _mountain_ or _mountainwoods_ or _atmine_\n', new: '\twhen _elements_ and not _rich_\n', count: 1 },
  { old: '\twhen _gems_ and not _desert_ or _desert2_ or _mountain_ or _mountainwoods_ or _atmine_\n', new: '\twhen _gems_ and not _rich_\n', count: 1 },
].map(Object.freeze));
const fetchPatches = (n) => Object.freeze([
  // Q8: bundles are group 9 (UselessItems2), not 20.
  { old: `\tplayer possesses ${n} items class 20 subclass 1604`, new: `\tplayer possesses ${n} items class 9 subclass 1604`, count: 1 },
  { old: `\tplayer handsover ${n} items class 20 subclass 1604`, new: `\tplayer handsover ${n} items class 9 subclass 1604`, count: 1 },
].map(Object.freeze));
export const FORAGE_FIX_PATCHES = Object.freeze({
  // Q13: the list files the four fetch quests under `Commoner` and `Noble`, which name no social group - DFU's
  // ParseQuestList files a row only under an exact FactionFile.SocialGroups name (QuestListsManager.cs:223-251), so the
  // quests were never offered, in DFU or here. `Commoners` and `Nobility` are the groups the author meant.
  'QuestList-ForagingQuests': Object.freeze([
    { old: ', Commoner, ', new: ', Commoners, ', count: 2 },
    { old: ', Noble, ', new: ', Nobility, ', count: 2 },
  ].map(Object.freeze)),
  MiningQuest: miningPatches(), MiningQuestWeak: miningPatches(), MiningQuestWeaker: miningPatches(), MiningQuestWeakest: miningPatches(),
  FetchWood01: fetchPatches(2), FetchWood02: fetchPatches(4), FetchWood03: fetchPatches(6), FetchWood04: fetchPatches(8),
  // Q9: the fifth and sixth plants made permanent, not the fourth again.
  ForageSummerPlantsQuest: Object.freeze([
    { old: '\tget item _plant5_\n\tmake _plant4_ permanent\n', new: '\tget item _plant5_\n\tmake _plant5_ permanent\n', count: 2 },
    { old: '\tget item _plant6_\n\tmake _plant4_ permanent\n', new: '\tget item _plant6_\n\tmake _plant6_ permanent\n', count: 1 },
  ].map(Object.freeze)),
});

/** A quest's (or the list's) text with its FORAGE-FIX patches applied (unchanged when it has none). Line endings are
 *  read as LF first - a checkout that turned the files to CRLF patches the same. Throws on a mismatch. SHAM-TRAIL: the
 *  law is quest/questPatches.js applyTextPatches, which DFU's own quests' patches share. */
export function applyForageFix(questName, text) {
  const patches = FORAGE_FIX_PATCHES[questName];
  return patches ? applyTextPatches('FORAGE-FIX', questName, patches, text) : text;
}
