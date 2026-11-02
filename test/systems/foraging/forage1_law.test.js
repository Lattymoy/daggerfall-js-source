// FORAGE1-FORAGE2 - FORAGING 1.7 (Harbinger451), THE LAW (2026-09-28, Mac: "Heres this for life skills";
// "Your lead"). bible/06-Systems/Foraging.md is the record. The pins hold src/systems/foraging/foragingLaw.js to the
// mod's own build: every line it speaks is one of the IL's string literals, the templates are the vendored
// rows, every table is the IL's (FORAGE0 section 6, read off <PrivateImplementationDetails> and the inline
// stelem arrays), every check comes in its tool's order, and FORAGE-FIX patches only the lines it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FT, FORAGING_TEMPLATES, TOOL_TEMPLATES, FORAGING_GROUP, FORAGING_QUEST_LIST, FORAGING_TEXTURE_ARCHIVES,
  FORAGING_REFUSALS, CHECK_ORDER, foragingRefusal, isForagingDaylight, netHasWater,
  WOOD_BUNDLE_TABLES, woodAxeBundles, woodAxeMessage, MINING_QUESTS, pickAxeQuest, sickleQuest,
  FISH_TABLES, fishingCount, fishingMessage, GRAVE_QUESTS, GRAVE_CN_QUESTS, spadeQuest,
  basketBlock, BASKET_BLOCKS, basketDraw, basketFind, fishTemplate, fruitTemplate, TOOL_QUESTS, brokeMessage,
  FOODS, FORAGING_COMMAND, raiseTimeSeconds, reduceFatigueBy, FORAGE_FIX_PATCHES, applyForageFix,
  attributeAverage, attributeBand, pickOneOf,
} from '../../../src/systems/foraging/foragingLaw.js';
import { CLIMATES, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { ON_EXTERIOR_WATER } from '../../../src/player/exteriorSurface.js';
import { TEMPLATE as CC } from '../../../src/systems/survival/food.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const V = join(ROOT, 'vendor/foraging');
const IL = readFileSync(join(V, 'il/Foraging.il.txt'), 'utf8');
const LITERALS = new Set([...IL.matchAll(/ldstr\s+"([^"]*)"/g)].map((m) => m[1]));
const quest = (name) => readFileSync(join(V, 'Quests', `${name}.txt`), 'utf8');
/** A draw that answers `i` of an `n`-long list: Random.Range(0, n) == i. */
const at = (i, n) => () => (i + 0.5) / n;

/** A world where every check passes. */
const OPEN = Object.freeze({
  inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: CLIMATES.Woodlands, region: 17, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100,
  swimming: false, exteriorWater: ON_EXTERIOR_WATER.None,
});

test('FORAGE1: the twelve templates are the vendored rows, group 9, and nothing else registers in their range', () => {
  const rows = JSON.parse(readFileSync(join(V, 'ItemTemplates.json'), 'utf8'));
  assert.deepEqual(FORAGING_TEMPLATES.map((t) => ({ ...t })), rows);
  assert.deepEqual(FORAGING_TEMPLATES.map((t) => t.index), [1600, 1601, 1602, 1603, 1604, 1605, 1606, 1607, 1608, 1609, 1610, 1611]);
  assert.equal(FORAGING_GROUP, 'UselessItems2');
  assert.deepEqual(TOOL_TEMPLATES, [1600, 1601, 1602, 1603, 1606, 1607], "the console command's DCE7 order");
  assert.deepEqual(FORAGING_TEMPLATES.filter((t) => TOOL_TEMPLATES.includes(t.index)).map((t) => t.hitPoints), [50, 50, 50, 50, 50, 50]);
  assert.deepEqual(FORAGING_TEXTURE_ARCHIVES, readdirSync(join(V, 'Textures')).map((f) => Number(f.split('_')[0])).sort());
  assert.equal(FORAGING_QUEST_LIST, 'ForagingQuests');
  assert.ok(LITERALS.has(FORAGING_QUEST_LIST));
});

test('FORAGE1: the Wood-Axe\'s six refusals, word for word (ForagingMain.WoodAxe\'s ldstr, typed here from the IL)', () => {
  assert.deepEqual(FORAGING_REFUSALS[FT.WoodAxe], {
    inside: 'You cannot find wood to chop in here!',
    town: 'You cannot chop wood in a settlement!',
    daylight: 'You need daylight to chop wood effectively!',
    sea: 'You cannot find wood to chop out here!',
    enemies: 'You cannot chop wood with enemies nearby!',
    encumbered: 'You cannot chop wood when fully encumbered!',
  });
});

test('FORAGE1: every line the law speaks is one of the IL\'s own string literals', () => {
  const lines = [];
  for (const t of TOOL_TEMPLATES) lines.push(...Object.values(FORAGING_REFUSALS[t]), brokeMessage(t));
  for (let n = 0; n <= 4; n++) lines.push(woodAxeMessage(n), fishingMessage(n));
  for (const block of Object.keys(BASKET_BLOCKS)) for (const food of [2, 3, 4]) for (let n = 0; n <= 4; n++) lines.push(basketFind({ count: n, food, block }, false).message);
  lines.push(...Object.values(FOODS).map((f) => f.text));
  lines.push(FORAGING_COMMAND.name, FORAGING_COMMAND.description, FORAGING_COMMAND.usage, FORAGING_COMMAND.answer);
  lines.push(...MINING_QUESTS, ...GRAVE_QUESTS, ...GRAVE_CN_QUESTS, ...Object.values(TOOL_QUESTS));
  lines.push(sickleQuest(CLIMATES.Desert, 0), sickleQuest(CLIMATES.Swamp, 0), sickleQuest(CLIMATES.Mountain, 5));
  const missing = [...new Set(lines)].filter((l) => !LITERALS.has(l));
  assert.deepEqual(missing, [], 'a line the build never says');
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
  assert.equal(woodAxeMessage(1), 'You were able to chop and gather one Wood Bundle!');
  assert.equal(woodAxeMessage(4), 'You were able to chop and gather four Wood Bundles!');
  assert.equal(woodAxeMessage(0), 'You were unable to chop and gather any usable wood!');
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
  assert.equal(fishingMessage(2), 'You cast your Fishing Net and catch two Fish!');
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
  assert.deepEqual(basketFind(d, false), { templateIndex: FT.Mushroom, count: 2, message: 'You manage to pick two Mushrooms!' });
  assert.deepEqual(basketFind({ block: 'D', count: 1, food: 2 }, true), { templateIndex: CC.Apple, count: 1, message: 'You manage to pick one Apple!' });
  assert.deepEqual(basketFind({ block: 'B', count: 3, food: 2 }, false), { templateIndex: FT.Orange, count: 3, message: 'You manage to pick three Oranges!' });
  assert.equal(fruitTemplate('Orange', true), CC.Orange);
  // Q10: the build's C&C branch found nothing for these two; the fix finds the eggs
  assert.deepEqual(basketFind({ block: 'C', count: 2, food: 4 }, true), { templateIndex: FT.Egg, count: 2, message: 'You manage to find two Eggs!' });
  assert.deepEqual(basketFind({ block: 'E', count: 4, food: 4 }, true), { templateIndex: FT.Egg, count: 4, message: 'You manage to find four Eggs!' });
  assert.equal(basketFind({ block: 'A', count: 0, food: 3 }, false).templateIndex, null);
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

test('FORAGE-FIX: every patch finds its verbatim line the named number of times, and changes only that', () => {
  assert.deepEqual(Object.keys(FORAGE_FIX_PATCHES).sort(), ['FetchWood01', 'FetchWood02', 'FetchWood03', 'FetchWood04', 'ForageSummerPlantsQuest', 'MiningQuest', 'MiningQuestWeak', 'MiningQuestWeaker', 'MiningQuestWeakest', 'QuestList-ForagingQuests']);
  for (const name of Object.keys(FORAGE_FIX_PATCHES)) {
    const before = quest(name);
    const after = applyForageFix(name, before);
    for (const p of FORAGE_FIX_PATCHES[name]) {
      assert.equal(before.split(p.old).length - 1, p.count, `${name}: ${p.old.trim()}`);
      assert.ok(after.includes(p.new), `${name} carries its fix`);
    }
  }
  const mining = applyForageFix('MiningQuest', quest('MiningQuest'));
  assert.match(mining, /_rich_ task:\n\twhen _desert_ or _desert2_ or _mountain_ or _mountainwoods_ or _atmine_\n/);
  assert.match(mining, /\twhen _elements_ and not _rich_\n/);
  assert.doesNotMatch(mining, /and _desert_ or/);
  assert.match(applyForageFix('FetchWood03', quest('FetchWood03')), /player handsover 6 items class 9 subclass 1604/);
  const summer = applyForageFix('ForageSummerPlantsQuest', quest('ForageSummerPlantsQuest'));
  assert.equal((quest('ForageSummerPlantsQuest').match(/make _plant4_ permanent/g) ?? []).length, 6, 'the build: the fourth plant made permanent six times');
  assert.equal((summer.match(/make _plant4_ permanent/g) ?? []).length, 3, 'the fix: once in each of _4plant_, _5plant_, _6plant_ - the fourth plant\'s own');
  assert.equal((summer.match(/make _plant6_ permanent/g) ?? []).length, 1);
  const list = applyForageFix('QuestList-ForagingQuests', quest('QuestList-ForagingQuests'));
  assert.match(list, /^FetchWood01, Commoners, N, 0, 0,/m, 'Q13');
  assert.match(list, /^FetchWood04, Nobility, N, 10, 0,/m, 'Q13');
  assert.doesNotMatch(list, /, (Commoner|Noble), /);
  assert.equal(applyForageFix('ChopWoodQuest', quest('ChopWoodQuest')), quest('ChopWoodQuest'), 'an unpatched quest is untouched');
  assert.throws(() => applyForageFix('FetchWood01', 'nothing here'), /FORAGE-FIX/);
});

test('FORAGE1: the quests the law names are the vendored files, and the list names them all', () => {
  const files = readdirSync(join(V, 'Quests')).map((f) => f.replace(/\.txt$/, ''));
  for (const q of [...MINING_QUESTS, ...GRAVE_QUESTS, ...GRAVE_CN_QUESTS, ...Object.values(TOOL_QUESTS), 'ForageAridPlantsQuest', 'ForageWinterPlantsQuest', 'ForageSummerPlantsQuest']) {
    assert.ok(files.includes(q), q);
  }
  const list = readFileSync(join(V, 'Quests/QuestList-ForagingQuests.txt'), 'utf8');
  for (const f of files.filter((n) => !n.startsWith('QuestList'))) assert.match(list, new RegExp(`^${f},`, 'm'), f);
});
