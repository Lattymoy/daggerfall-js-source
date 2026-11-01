// FORAGING 1.7 (Harbinger451), THE LAW. bible/06-Systems/Foraging.md is the record. The pins hold src/systems/foraging/foragingLaw.js to the
// mod's own build: every table is the IL's (FORAGE0 section 6, read off <PrivateImplementationDetails> and the inline
// stelem arrays) and every check comes in its tool's order. OWN-WORK3: the rows, the lines and the quests
// are our own, pinned here as literals, and the quests carry FORAGE-FIX's mends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

import {
  FT, FORAGING_TEMPLATES, TOOL_TEMPLATES, FORAGING_GROUP, FORAGING_QUEST_LIST, FORAGING_TEXTURE_ARCHIVES,
  FORAGING_REFUSALS, CHECK_ORDER, foragingRefusal, isForagingDaylight, netHasWater,
  WOOD_BUNDLE_TABLES, woodAxeBundles, woodAxeMessage, MINING_QUESTS, pickAxeQuest, sickleQuest,
  FISH_TABLES, fishingCount, fishingMessage, GRAVE_QUESTS, GRAVE_CN_QUESTS, spadeQuest,
  basketBlock, BASKET_BLOCKS, basketDraw, basketFind, fishTemplate, fruitTemplate, TOOL_QUESTS, brokeMessage,
  FOODS, FORAGING_COMMAND, raiseTimeSeconds, reduceFatigueBy,
  attributeAverage, attributeBand, pickOneOf,
} from '../../../src/systems/foraging/foragingLaw.js';
import { CLIMATES, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { ON_EXTERIOR_WATER } from '../../../src/player/exteriorSurface.js';
import { TEMPLATE as CC } from '../../../src/systems/survival/food.js';
import { stringBreach } from '../../../tools/plainText.mjs';
import { FORAGING_QUESTS, ownQuest, asBuilt, AS_BUILT } from './foragingAsBuilt.mjs';
import { FORAGING_ART } from '../../../src/systems/foraging/foragingArt.js';   // Our own seven pictures

/** A draw that answers `i` of an `n`-long list: Random.Range(0, n) == i. */
const at = (i, n) => () => (i + 0.5) / n;

/** A world where every check passes. */
const OPEN = Object.freeze({
  inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: CLIMATES.Woodlands, region: 17, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100,
  swimming: false, exteriorWater: ON_EXTERIOR_WATER.None,
});

test('FORAGE1: the twelve templates (OWN-WORK3: our own rows), group 9, and nothing else registers in their range', () => {
  // id, name, kg, uses, gold, rarity, picture - the ids, names and pictures facts, the rest our design
  assert.deepEqual(FORAGING_TEMPLATES.map((t) => [t.index, t.name, t.baseWeight, t.hitPoints, t.basePrice, t.rarity, t.worldTextureArchive, t.worldTextureRecord]), [
    [1600, 'Wood-Axe', 3.0, 50, 90, 10, 11600, 0], [1601, 'Pick-Axe', 3.5, 50, 110, 10, 11601, 0],
    [1602, 'Sickle', 1.0, 50, 60, 10, 11602, 0], [1603, 'Fishing-Net', 2.0, 50, 70, 10, 11603, 0],
    [1604, 'Wood Bundle', 2.5, 1, 15, 10, 11604, 0], [1605, 'Fish', 0.5, 1, 6, 100, 211, 9],
    [1606, 'Spade', 3.0, 50, 80, 10, 11606, 0], [1607, 'Basket', 0.5, 50, 30, 10, 205, 9],
    [1608, 'Apple', 0.2, 1, 3, 100, 213, 1], [1609, 'Orange', 0.2, 1, 4, 100, 213, 0],
    [1610, 'Mushroom', 0.1, 1, 5, 100, 504, 23], [1611, 'Egg', 0.1, 1, 4, 100, 11605, 0],
  ]);
  for (const t of FORAGING_TEMPLATES) {
    assert.deepEqual([t.capacityOrTarget, t.enchantmentPoints, t.variants, t.drawOrderOrEffect, t.playerTextureArchive, t.playerTextureRecord], [0, 0, 0, 0, 0, 0], t.name);
    assert.deepEqual([t.isBluntWeapon, t.isLiquid, t.isOneHanded, t.isIngredient, t.stackable], [false, false, false, false, undefined], `${t.name}: none of them stack`);
  }
  assert.equal(FORAGING_GROUP, 'UselessItems2');
  assert.deepEqual(TOOL_TEMPLATES, [1600, 1601, 1602, 1603, 1606, 1607], "the console command's DCE7 order");
  assert.deepEqual(FORAGING_TEXTURE_ARCHIVES, [11600, 11601, 11602, 11603, 11604, 11605, 11606]);
  assert.deepEqual(Object.keys(FORAGING_ART).map(Number), [...FORAGING_TEXTURE_ARCHIVES], 'OWN-WORK4: each picture is a recipe of ours');
  assert.equal(FORAGING_QUEST_LIST, 'ForagingQuests', 'RegisterQuestList("ForagingQuests"), IL_02e5');
});

test('FORAGE1: the six tools\' refusals, word for word (OWN-WORK3: our own words for the build\'s checks)', () => {
  assert.deepEqual(FORAGING_REFUSALS, {
    [FT.WoodAxe]: {
      inside: 'There are no trees to cut in here.', town: 'You cannot cut trees inside a settlement.',
      daylight: 'It is too dark to swing an axe safely.', sea: 'There are no trees to cut out here.',
      enemies: 'You cannot cut wood with enemies close by.', encumbered: 'You are carrying too much to cut wood.',
    },
    [FT.PickAxe]: {
      inside: 'There is no rock to work in here.', town: 'You cannot dig for ore inside a settlement.',
      daylight: 'It is too dark to see the seams in the rock.', sea: 'There is no rock to work out here.',
      enemies: 'You cannot work the rock with enemies close by.', encumbered: 'You are carrying too much to work the rock.',
    },
    [FT.Sickle]: {
      inside: 'There are no plants to cut in here.', town: 'You cannot cut plants inside a settlement.',
      daylight: 'It is too dark to tell one plant from another.', sea: 'There are no plants to cut out here.',
      enemies: 'You cannot cut plants with enemies close by.', encumbered: 'You are carrying too much to cut plants.',
    },
    [FT.FishingNet]: {
      inside: 'There is no water to fish in here.', town: 'You cannot cast a net inside a settlement.',
      daylight: 'It is too dark to see where the fish are.', enemies: 'You cannot cast a net with enemies close by.',
      encumbered: 'You are carrying too much to cast a net.', water: 'Stand in water, or be out at sea, to cast a net.',
    },
    [FT.Spade]: {
      inside: 'There is no grave to dig in here.', town: 'You cannot open a grave inside a settlement.',
      cemetery: 'Graves are dug in a cemetery, not here.', enemies: 'You cannot open a grave with enemies close by.',
      encumbered: 'You are carrying too much to dig.',
    },
    [FT.Basket]: {
      inside: 'There is no wild food to find in here.', town: 'You cannot gather wild food inside a settlement.',
      daylight: 'It is too dark to find anything worth eating.', sea: 'There is no wild food to find out here.',
      enemies: 'You cannot gather food with enemies close by.', encumbered: 'You are carrying too much to gather food.',
    },
  });
});

test('FORAGE1: every line the law speaks is a plain sentence (OWN-WORK3: our own, PLAIN-TEXT\'s limits)', () => {
  const lines = [];
  for (const t of TOOL_TEMPLATES) lines.push(...Object.values(FORAGING_REFUSALS[t]), brokeMessage(t));
  for (let n = 0; n <= 4; n++) lines.push(woodAxeMessage(n), fishingMessage(n));
  for (const block of Object.keys(BASKET_BLOCKS)) for (const food of [2, 3, 4]) for (let n = 0; n <= 4; n++) lines.push(basketFind({ count: n, food, block }, false).message);
  lines.push(...Object.values(FOODS).map((f) => f.text));
  lines.push(FORAGING_COMMAND.description, FORAGING_COMMAND.answer, FORAGING_COMMAND.refusedOnline);
  for (const l of new Set(lines)) {
    assert.equal(stringBreach(l), null, l);
    assert.match(l, /^[A-Z].*[.!]$/, `${l}: a whole sentence`);
  }
  assert.deepEqual(Object.values(FOODS).map((f) => f.text), ['You eat the Fish. You feel stronger.', 'You eat the Apple. You feel refreshed.',
    'You eat the Orange. You feel refreshed.', 'You eat the Mushroom. Your mind feels clearer.', 'You eat the Egg. You feel stronger.']);
  assert.deepEqual([FORAGING_COMMAND.name, FORAGING_COMMAND.description, FORAGING_COMMAND.usage, FORAGING_COMMAND.answer],
    ['Foraging_Tools', 'Gives you one of each of the six Foraging tools.', 'Foraging_Tools', 'One of each Foraging tool is in your pack.']);
  assert.deepEqual([brokeMessage(FT.Sickle), brokeMessage(603, 'Skinning Knife'), brokeMessage(603)], ['Your Sickle is worn out.', 'Your Skinning Knife is worn out.', 'Your tool is worn out.']);
  // the quest names the law starts are the build's (its ldstr), and so the list's
  assert.deepEqual([...MINING_QUESTS, ...GRAVE_QUESTS, ...Object.values(TOOL_QUESTS)], ['MiningQuestWeakest', 'MiningQuestWeaker', 'MiningQuestWeak', 'MiningQuest',
    'GraveRobbingQuestWeakest', 'GraveRobbingQuestWeaker', 'GraveRobbingQuestWeak', 'GraveRobbingQuest', 'ChopWoodQuest', 'FishingQuest', 'ForageFoodQuest']);
});

test('FORAGE1: each tool asks its checks in its own order, and the earlier failure speaks', () => {
  assert.deepEqual(CHECK_ORDER[FT.WoodAxe], ['inside', 'town', 'daylight', 'sea', 'enemies', 'encumbered']);
  assert.deepEqual(CHECK_ORDER[FT.FishingNet], ['inside', 'dungeon', 'town', 'daylight', 'enemies', 'encumbered', 'water']);
  assert.deepEqual(CHECK_ORDER[FT.Spade], ['inside', 'town', 'cemetery', 'enemies', 'encumbered']);
  for (const t of [FT.WoodAxe, FT.PickAxe, FT.Sickle, FT.Basket]) {
    assert.equal(foragingRefusal(t, OPEN), null);
    assert.equal(foragingRefusal(t, { ...OPEN, insideDungeon: true }), FORAGING_REFUSALS[t].inside);
    assert.equal(foragingRefusal(t, { ...OPEN, locationType: LOCATION_TYPES.TownCity, inLocationRect: true }), FORAGING_REFUSALS[t].town);
    assert.equal(foragingRefusal(t, { ...OPEN, hour: 20 }), FORAGING_REFUSALS[t].daylight);
    assert.equal(foragingRefusal(t, { ...OPEN, climate: CLIMATES.Ocean }), FORAGING_REFUSALS[t].sea);
    assert.equal(foragingRefusal(t, { ...OPEN, enemiesNear: true }), FORAGING_REFUSALS[t].enemies);
    assert.equal(foragingRefusal(t, { ...OPEN, carriedWeight: 100 }), FORAGING_REFUSALS[t].encumbered);
    assert.equal(foragingRefusal(t, { ...OPEN, carriedWeight: 99.9 }), null, 'under the maximum: not encumbered');
    assert.equal(foragingRefusal(t, { ...OPEN, carriedWeight: NaN }), null, 'blt.un: an unordered compare passes');
    // two failing: the earlier one
    assert.equal(foragingRefusal(t, { ...OPEN, hour: 3, enemiesNear: true }), FORAGING_REFUSALS[t].daylight);
    assert.equal(foragingRefusal(t, { ...OPEN, climate: CLIMATES.Ocean, carriedWeight: 500 }), FORAGING_REFUSALS[t].sea);
  }
  // the net: no sea refusal, water last; the dungeon arm is dead (inside already refused)
  const wet = { ...OPEN, exteriorWater: ON_EXTERIOR_WATER.Swimming };
  assert.equal(foragingRefusal(FT.FishingNet, OPEN), FORAGING_REFUSALS[FT.FishingNet].water);
  assert.equal(foragingRefusal(FT.FishingNet, wet), null);
  assert.equal(foragingRefusal(FT.FishingNet, { ...wet, climate: CLIMATES.Ocean }), null);
  assert.equal(foragingRefusal(FT.FishingNet, { ...wet, inside: true, insideDungeon: true, swimming: true, climate: CLIMATES.Ocean }), FORAGING_REFUSALS[FT.FishingNet].inside);
  assert.equal(foragingRefusal(FT.FishingNet, { ...OPEN, enemiesNear: true }), FORAGING_REFUSALS[FT.FishingNet].enemies, 'enemies before water');
  // the Spade: no daylight, a cemetery
  assert.equal(foragingRefusal(FT.Spade, { ...OPEN, hour: 3 }), FORAGING_REFUSALS[FT.Spade].cemetery);
  assert.equal(foragingRefusal(FT.Spade, { ...OPEN, hour: 3, locationType: LOCATION_TYPES.Graveyard, inLocationRect: true }), null);
  assert.equal(foragingRefusal(FT.Spade, { ...OPEN, locationType: LOCATION_TYPES.Graveyard, inLocationRect: false }), FORAGING_REFUSALS[FT.Spade].cemetery);
});

test('FORAGE1: the settlement check is IsPlayerInTown(true, true) - a HomePoor, a Graveyard and a dungeon pass', () => {
  for (const type of [LOCATION_TYPES.HomePoor, LOCATION_TYPES.Graveyard, LOCATION_TYPES.DungeonRuin, LOCATION_TYPES.ReligionCult, LOCATION_TYPES.Coven]) {
    assert.equal(foragingRefusal(FT.WoodAxe, { ...OPEN, locationType: type, inLocationRect: true }), null, `type ${type}`);
  }
  for (const type of [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage, LOCATION_TYPES.HomeFarms, LOCATION_TYPES.HomeWealthy, LOCATION_TYPES.Tavern, LOCATION_TYPES.ReligionTemple]) {
    assert.equal(foragingRefusal(FT.WoodAxe, { ...OPEN, locationType: type, inLocationRect: true }), FORAGING_REFUSALS[FT.WoodAxe].town, `type ${type}`);
    assert.equal(foragingRefusal(FT.WoodAxe, { ...OPEN, locationType: type, inLocationRect: false }), null, 'outside the rect is wilderness');
  }
});

test('FORAGE1: the day is 07:00:00 to 17:59:59; the load refuses at the maximum; the net\'s water', () => {
  assert.deepEqual([6, 7, 17, 18].map(isForagingDaylight), [false, true, true, false]);
  assert.equal(foragingRefusal(FT.WoodAxe, { ...OPEN, carriedWeight: 99.9 }), null);
  assert.equal(foragingRefusal(FT.WoodAxe, { ...OPEN, carriedWeight: 100 }), FORAGING_REFUSALS[FT.WoodAxe].encumbered);
  assert.equal(netHasWater(OPEN), false);
  assert.equal(netHasWater({ ...OPEN, exteriorWater: ON_EXTERIOR_WATER.WaterWalking }), true, 'a shallow shore tile');
  assert.equal(netHasWater({ ...OPEN, swimming: true }), true);
  assert.equal(netHasWater({ ...OPEN, climate: CLIMATES.Ocean }), true);
  assert.equal(netHasWater({ ...OPEN, region: 31 }), true, 'the sea\'s politic region on a land-climate pixel');
});

test('FORAGE1: the Wood-Axe\'s eight lists, desert 224 and 225 only, and its lines', () => {
  assert.deepEqual(WOOD_BUNDLE_TABLES, {
    desert: [[0, 0, 0, 0, 1], [0, 0, 0, 1, 1], [0, 0, 1, 1, 1], [0, 1, 1, 1, 2]],
    other: [[0, 0, 0, 1, 2], [0, 0, 1, 2, 3], [0, 1, 2, 3, 4], [1, 2, 3, 4, 4]],
  });
  assert.equal(woodAxeBundles({ intelligence: 62, strength: 55, climate: CLIMATES.Woodlands }, at(3, 5)), 2, 'average 58: {0,0,1,2,3}[3]');
  assert.equal(woodAxeBundles({ intelligence: 62, strength: 55, climate: CLIMATES.Desert2 }, at(4, 5)), 1);
  assert.equal(woodAxeBundles({ intelligence: 62, strength: 55, climate: CLIMATES.Mountain }, at(4, 5)), 3, 'Mountain is not desert');
  assert.equal(woodAxeMessage(1), 'You cut and tie one Wood Bundle.');
  assert.equal(woodAxeMessage(4), 'You cut and tie four Wood Bundles.');
  assert.equal(woodAxeMessage(0), 'You find no wood worth cutting.');
});

test('FORAGE1: the bands and the average are C#\'s', () => {
  assert.deepEqual([0, 39, 40, 59, 60, 79, 80, 100].map(attributeBand), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(attributeAverage(62, 55), 58);
  assert.equal(attributeAverage(79, 80), 79, 'integer division');
  assert.equal(pickOneOf([0, 1, 2, 3, 4], () => 0.9999999), 4);
  assert.equal(pickOneOf([0, 1, 2, 3, 4], () => 0), 0);
});

test('FORAGE1: the Pick-Axe reads Agility, the Spade Endurance; the Sickle by climate then month', () => {
  assert.equal(pickAxeQuest({ intelligence: 70, agility: 90 }), 'MiningQuest');
  assert.equal(pickAxeQuest({ intelligence: 30, agility: 40 }), 'MiningQuestWeakest');
  assert.equal(spadeQuest({ intelligence: 50, endurance: 50 }), 'GraveRobbingQuestWeaker');
  assert.equal(spadeQuest({ intelligence: 50, endurance: 50 }, true), 'GraveRobbingCNQuestWeaker');
  assert.equal(sickleQuest(CLIMATES.Desert2, 5), 'ForageAridPlantsQuest');
  assert.equal(sickleQuest(CLIMATES.Mountain, 5), 'ForageWinterPlantsQuest', 'Mountain before the month');
  assert.equal(sickleQuest(CLIMATES.Subtropical, 5), 'ForageWinterPlantsQuest');
  assert.equal(sickleQuest(CLIMATES.Rainforest, 10), 'ForageSummerPlantsQuest');
  assert.deepEqual([0, 1, 2, 7, 8, 11].map((m) => sickleQuest(CLIMATES.Woodlands, m)),
    ['ForageWinterPlantsQuest', 'ForageWinterPlantsQuest', 'ForageSummerPlantsQuest', 'ForageSummerPlantsQuest', 'ForageWinterPlantsQuest', 'ForageWinterPlantsQuest']);
});

test('FORAGE1: the net\'s four lists, and a fish is C&C\'s Raw Fish while C&C is on', () => {
  assert.deepEqual(FISH_TABLES, [[0, 0, 0, 1, 1, 2], [0, 0, 1, 1, 2, 2], [0, 1, 2, 2, 3, 3], [1, 2, 2, 3, 3, 4]]);
  assert.equal(fishingCount({ intelligence: 80, agility: 80 }, at(0, 6)), 1);
  assert.equal(fishTemplate(true), CC.RawFish);
  assert.equal(fishTemplate(false), FT.Fish);
  assert.equal(fishingMessage(2), 'Your net comes up with two Fish.');
  assert.equal(fishingMessage(0), 'Your net comes up empty.');
});

test('FORAGE1: the Basket\'s five blocks, INT alone, and its finds - FORAGE-FIX Q10 fills the C&C holes', () => {
  assert.deepEqual([CLIMATES.Desert, CLIMATES.Subtropical, CLIMATES.Swamp, CLIMATES.Rainforest, CLIMATES.Mountain].map((c) => basketBlock(c, 5)), ['A', 'B', 'C', 'C', 'D']);
  assert.equal(basketBlock(CLIMATES.Woodlands, 9), 'D', 'Frostfall');
  assert.equal(basketBlock(CLIMATES.HauntedWoodlands, 4), 'E');
  assert.deepEqual(BASKET_BLOCKS.A.counts, [[0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 1, 1], [0, 0, 0, 1, 1, 1], [0, 0, 1, 1, 1, 1]]);
  assert.deepEqual(BASKET_BLOCKS.C.counts, [[0, 0, 1, 2, 2, 3], [0, 1, 2, 2, 3, 3], [1, 2, 2, 3, 3, 4], [2, 2, 3, 3, 4, 4]]);
  assert.deepEqual(BASKET_BLOCKS.B.counts, [[0, 0, 0, 1, 1, 2], [0, 0, 1, 1, 2, 2], [0, 1, 1, 2, 2, 3], [1, 1, 2, 2, 3, 3]]);
  assert.deepEqual(BASKET_BLOCKS.D.counts, BASKET_BLOCKS.B.counts);
  assert.deepEqual(BASKET_BLOCKS.E.counts, BASKET_BLOCKS.C.counts);
  assert.deepEqual([BASKET_BLOCKS.A.foods, BASKET_BLOCKS.B.foods, BASKET_BLOCKS.D.foods, BASKET_BLOCKS.E.foods], [[2, 3, 4], [2, 2, 3, 4], [2, 3, 3, 4, 4], [2, 3, 4]]);
  assert.deepEqual(BASKET_BLOCKS.C.foods, [2, 2, 3, 4]);
  // Brannoc, FORAGE0 Appendix A: INT 62 in Woodlands in Frostfall - {0,1,1,2,2,3}[3] then {2,3,3,4,4}[1]
  let i = 0; const draws = [(3 + 0.5) / 6, (1 + 0.5) / 5];
  const d = basketDraw({ intelligence: 62, climate: CLIMATES.Woodlands, monthValue: 9 }, () => draws[i++]);
  assert.deepEqual(d, { block: 'D', count: 2, food: 3 });
  assert.deepEqual(basketFind(d, false), { templateIndex: FT.Mushroom, count: 2, message: 'You gather two Mushrooms.' });
  assert.deepEqual(basketFind({ block: 'D', count: 1, food: 2 }, true), { templateIndex: CC.Apple, count: 1, message: 'You gather one Apple.' });
  assert.deepEqual(basketFind({ block: 'B', count: 3, food: 2 }, false), { templateIndex: FT.Orange, count: 3, message: 'You gather three Oranges.' });
  assert.equal(fruitTemplate('Orange', true), CC.Orange);
  // The build's C&C branch found nothing for these two; the fix finds the eggs
  assert.deepEqual(basketFind({ block: 'C', count: 2, food: 4 }, true), { templateIndex: FT.Egg, count: 2, message: 'You find two Eggs.' });
  assert.deepEqual(basketFind({ block: 'E', count: 4, food: 4 }, true), { templateIndex: FT.Egg, count: 4, message: 'You find four Eggs.' });
  assert.deepEqual(basketFind({ block: 'A', count: 0, food: 3 }, false), { templateIndex: null, count: 0, message: 'You find nothing fit to eat.' });
});

test('FORAGE1: the foods\' numbers, fixed', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(FOODS).map(([k, f]) => [k, [f.fatigue, f.health, f.magicka]])), {
    1605: [15, 5, 0], 1608: [10, 5, 0], 1609: [10, 5, 0], 1610: [5, 0, 10], 1611: [15, 10, 0],
  });
});

test('FORAGE1: Quest Actions Extension\'s arithmetic', () => {
  assert.equal(raiseTimeSeconds(1, 30), 5400);
  assert.equal(raiseTimeSeconds(2, 0), 7200);
  assert.equal(reduceFatigueBy(64 * 100, 64 * 100, 25), 64 * 75, 'a percent of the maximum');
  assert.equal(reduceFatigueBy(64 * 20, 64 * 100, 25), 1, 'the floor of 1');
  assert.equal(reduceFatigueBy(640, 6400, 10), 1);
});

test('FORAGE-FIX (OWN-WORK3): our quests carry the mends - taken out again, each gives back the build\'s line the named number of times', () => {
  for (const [name, mends] of Object.entries(AS_BUILT)) {
    const built = asBuilt(name);
    for (const m of mends) assert.equal(built.split(m.new).length - 1, m.count, `${name}: ${m.new.trim()}`);
  }
  const summer = ownQuest('ForageSummerPlantsQuest');
  assert.equal((asBuilt('ForageSummerPlantsQuest').match(/make _plant4_ permanent/g) ?? []).length, 6, 'the build: the fourth plant made permanent six times');
  assert.equal((summer.match(/make _plant4_ permanent/g) ?? []).length, 3, 'ours: once in each of _4plant_, _5plant_, _6plant_ - the fourth plant\'s own');
  assert.equal((summer.match(/make _plant6_ permanent/g) ?? []).length, 1);
  const list = ownQuest('QuestList-ForagingQuests');
  assert.match(list, /^FetchWood01, Commoners, N, 0, 0,/m, 'Q13');
  assert.match(list, /^FetchWood04, Nobility, N, 10, 0,/m, 'Q13');
  assert.equal(asBuilt('ChopWoodQuest'), ownQuest('ChopWoodQuest'), 'a quest with no mend is the build\'s logic as it stands');
  assert.throws(() => asBuilt('FetchWood01', 'nothing here'), /AS-BUILT/);
});

test('FORAGE1: the quests the law names are our files, and the list names them all', () => {
  const files = readdirSync(FORAGING_QUESTS).map((f) => f.replace(/\.txt$/, ''));
  for (const q of [...MINING_QUESTS, ...GRAVE_QUESTS, ...GRAVE_CN_QUESTS, ...Object.values(TOOL_QUESTS), 'ForageAridPlantsQuest', 'ForageWinterPlantsQuest', 'ForageSummerPlantsQuest']) {
    assert.ok(files.includes(q), q);
  }
  assert.equal(files.length, 23, 'the 22 quests and the list');
  const list = ownQuest('QuestList-ForagingQuests');
  for (const f of files.filter((n) => !n.startsWith('QuestList'))) assert.match(list, new RegExp(`^${f},`, 'm'), f);
});
