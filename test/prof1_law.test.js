// PROF1 (2026-09-28, Mac: "Begin!") - THE PROFESSIONS' LAWS, pinned against the record (bible/06-Systems/
// Professions-Arc.md, PROF0 3, 4.3, 6, 11, 22 and Appendix B) and against DFU's own tables: src/net/professionLaw.js,
// src/net/nodeLaw.js, and the two pure modules both ends read (src/formats/mapsTables.js, src/systems/foragingCore.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFESSIONS, RANK_NAMES, xpForRank, rankOfXp, rankName, TIER_RANKS, tierOpen, topTierOf, harvestXp, writXp, PROF_XP_MAX,
  SPECIALISATIONS, SPEC_RANKS, RESPEC, specOk, specsAt, STORES_MAX, HERB_ACT, BASKET_ACT, ACT_BANDS, actBand,
  basketStep, PLANT_GROUP_TEMPLATES, regionPlantGroup, plantGroupFor, herbKey, FOOD_KEYS, foodKey, TIER_VALUES, HERB_VALUES,
  courtWritCount, COURT_WRITS_PER_DAY, WRIT_UNITS, writPay, writRenown, profSwitchOf, PROF_RID_RE, professionOfFamily,
} from '../src/net/professionLaw.js';
import {
  NODE_COUNTS, NODE_TIER_WEIGHTS, HERB_TABLES, herbTier, material, WINTER_BARE, SPRING_BLOOM, AUTUMN_FRUIT, herbInSeason,
  herbSeasonMult, herbPatch, herbPatches, drawTier, nodeKey, parseNodeKey, HERB_YIELD, FOOD_YIELD, MARCH_REGIONS, herbYield,
  foodYield, wholeYield, basketFood, WITNESS, witnessedFact, factConfirmed, regionWritTable, courtWrits, daySeason, dayMonth,
  utcDayOfMs,
} from '../src/net/nodeLaw.js';
import * as mapsFile from '../src/formats/mapsFile.js';
import * as mapsTables from '../src/formats/mapsTables.js';
import * as foragingLaw from '../src/systems/foragingLaw.js';
import * as foragingCore from '../src/systems/foragingCore.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { SEASONS } from '../src/systems/gameDate.js';
import { MARKS_FAUCETS, MARKS_KINDS } from '../src/net/marksLaw.js';

const name = (i) => templateByIndex(i).name;
const names = (list) => list.map(name);

// TIME1 (bible/06-Systems/Online-Time-Arc.md): a UTC day's season and month are the SKY's (nodeLaw dayDate), which
// turns a year every 7.5 real days from its switch - so the winter day these pins stand on is FOUND, the first on or
// after the one they used to name whose month is 1 and whose season is winter, never named by its date.
const WINTER_DAY = (() => { let d = utcDayOfMs(Date.UTC(2027, 0, 15)); while (!(dayMonth(d) === 1 && daySeason(d) === SEASONS.Winter)) d++; return d; })();

test('PROF1 law: ten professions - five that gather, five that craft (CRAFT3: thirteen until eight crafts became five), in the tab\'s order (PROF0 3.1)', () => {
  // PIN MOVED (CRAFT3): eight crafts became five tracks (Professions-Arc 41.2) - Smithing with Jewelcrafting, Building of Carpentry and Masonry, Outfitting, Provisioning of Alchemy and Cooking, Enchanting
  assert.deepEqual(PROFESSIONS.map((p) => [p.id, p.name, p.kind]), [
    ['mining', 'Mining', 'gathering'], ['logging', 'Logging', 'gathering'], ['herbalism', 'Herbalism', 'gathering'], ['hunting', 'Hunting', 'gathering'], ['fishing', 'Fishing', 'gathering'],
    ['smithing', 'Smithing', 'crafting'], ['building', 'Building', 'crafting'], ['outfitting', 'Outfitting', 'crafting'], ['provisioning', 'Provisioning', 'crafting'],
    ['enchanting', 'Enchanting', 'crafting'],
  ]);
  assert.equal(professionOfFamily('herbs'), 'herbalism');
  assert.equal(professionOfFamily('food'), 'herbalism', 'the Basket\'s food is Herbalism\'s second harvest (FORAGE0 14.6)');
});

test('PROF1 law: ranks 0-100 by 10 x n^2 XP, their five names; tiers by the rank ladder; XP 15 x tier, +50% clean, a quarter more than two tiers down; a writ twice its pay (PROF0 3.2, Appendix B)', () => {
  assert.deepEqual(RANK_NAMES.map(([n, at]) => [n, at]), [['Novice', 0], ['Apprentice', 25], ['Journeyman', 50], ['Expert', 75], ['Master', 100]]);
  assert.deepEqual([25, 50, 75, 100].map(xpForRank), [6250, 25000, 56250, 100000]);
  assert.equal(PROF_XP_MAX, 100000);
  assert.deepEqual([-5, 0, 9, 10, 999, 1000, 6249, 6250, 99999, 100000, 1e9, NaN].map(rankOfXp), [0, 0, 0, 1, 9, 10, 24, 25, 99, 100, 100, 0]);
  for (let n = 0; n <= 100; n++) { assert.equal(rankOfXp(xpForRank(n)), n); if (n) assert.equal(rankOfXp(xpForRank(n) - 1), n - 1); }
  assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 99, 100].map(rankName), ['Novice', 'Novice', 'Apprentice', 'Apprentice', 'Journeyman', 'Journeyman', 'Expert', 'Expert', 'Master']);
  assert.deepEqual(TIER_RANKS, [0, 10, 25, 40, 55, 70, 90]);
  assert.deepEqual([0, 9, 10, 24, 25, 55, 89, 90, 100].map(topTierOf), [1, 1, 2, 2, 3, 5, 6, 7, 7]);
  assert.deepEqual([[0, 1], [0, 2], [10, 2], [24, 3], [25, 3], [100, 8], [100, 0]].map(([r, t]) => tierOpen(r, t)), [true, false, true, false, true, false, false]);
  assert.deepEqual([harvestXp(1, 0, false), harvestXp(1, 0, true), harvestXp(2, 10, true), harvestXp(3, 25, false)], [15, 22, 45, 45]);
  assert.deepEqual([harvestXp(1, 55, false), harvestXp(2, 55, false), harvestXp(3, 55, false), harvestXp(3, 55, true)], [3, 7, 45, 67], 'rank 55 works tier 5: tiers 1-2 are more than two below');
  assert.equal(writXp(72), 144);
});

test('PROF1 law: every profession offers two specialisations at 50 and two at 100 (CRAFT3: a merged craft its two disciplines\' four), the record\'s names; a change is 1,000 Marks and a week, standing from its day (PROF0 3.3)', () => {
  assert.deepEqual(Object.keys(SPECIALISATIONS), PROFESSIONS.map((p) => p.id));
  // PIN MOVED (CRAFT3): a track of one discipline offers its own two a rank; a merged craft (Smithing, Building, Provisioning) its two disciplines' four, in the discipline table's order
  const MERGED = ['smithing', 'building', 'provisioning'];
  for (const [p, by] of Object.entries(SPECIALISATIONS)) for (const r of SPEC_RANKS) assert.equal(by[r].length, MERGED.includes(p) ? 4 : 2, `${p} at ${r}`);
  const ids = (p) => SPEC_RANKS.map((r) => SPECIALISATIONS[p][r].map((s) => s.id));
  assert.deepEqual(ids('smithing'), [['weaponsmith', 'armoursmith', 'gemcutter', 'goldsmith'], ['masterwright', 'quartermaster', 'master-jeweller', 'lapidary']]);   // PIN MOVED (CRAFT3): Smithing's and Jewelcrafting's
  assert.deepEqual(ids('building'), [['bowyer', 'joiner', 'quarryman', 'builder'], ['siegewright', 'master-joiner', 'fortifier', 'sculptor']]);   // PIN MOVED (CRAFT3): Carpentry's and Masonry's
  assert.deepEqual(ids('provisioning'), [['brewer', 'distiller', 'cook', 'field-cook'], ['master-alchemist', 'transmuter', 'chef', 'provisioner']]);   // PIN MOVED (CRAFT3): Alchemy's and Cooking's
  assert.deepEqual(SPECIALISATIONS.herbalism[50].map((s) => s.name).concat(SPECIALISATIONS.herbalism[100].map((s) => s.name)), ['Gardener', 'Botanist', 'Seasonal Eye', "Apothecary's Friend"]);
  assert.deepEqual(SPECIALISATIONS.fishing[50].map((s) => s.name), ['Angler', 'Netter']);
  assert.deepEqual(RESPEC, { marks: 1000, days: 7 });
  assert.equal(specOk('herbalism', 50, 'gardener'), true);
  assert.equal(specOk('herbalism', 100, 'gardener'), false, 'a 50 choice is not a 100 choice');
  assert.equal(specOk('logging', 50, 'gardener'), false);
  const row = { spec50: 'gardener', spec100: null, respec_rank: 50, respec_to: 'botanist', respec_at: 1000 };
  assert.deepEqual(specsAt(row, 999), { 50: 'gardener', 100: null });
  assert.deepEqual(specsAt(row, 1000), { 50: 'botanist', 100: null });
  assert.deepEqual(specsAt(null, 5), { 50: null, 100: null });
});

test('PROF1 law: the Stores - 5,000 a material (CAP-OFF: the day\'s 60 harvests a gathering profession are gone - test/cap_off.test.js); the Herbalism acts\' numbers; the bands; the Basket\'s step (PROF0 5.2, FORAGE0 14.4, 14.6, Appendix B)', () => {
  assert.equal(STORES_MAX, 5000);
  assert.deepEqual(HERB_ACT, { commonS: 0.8, steadyS: 2.5, steadyDeg: 3, moveM: 0.25, botanist: 1.5 });
  assert.deepEqual([BASKET_ACT.finds, BASKET_ACT.glintS, BASKET_ACT.masterGlintS], [3, 1.0, 1.4]);
  assert.deepEqual(ACT_BANDS, [0.85, 1.0, 1.15, 1.3]);
  assert.deepEqual([39, 40, 59, 60, 79, 80].map(actBand), [0.85, 1.0, 1.0, 1.15, 1.15, 1.3]);
  assert.deepEqual([0, 1, 2, 3].map(basketStep), [1, 1, 1.25, 1.5]);
  assert.deepEqual(['on', 'dev', 'off', 'ON', undefined].map(profSwitchOf), ['on', 'dev', 'off', 'off', 'off']);
  assert.ok(PROF_RID_RE.test('prof-000001') && !PROF_RID_RE.test('a:b-000001'), 'a client id never carries the service\'s `:`');
});

test('PROF1 law: the herb tables are PROF0 4.3\'s, by DFU\'s own names; an herb\'s own tier is its commonest place\'s, its value common 1 / uncommon 2 / rare 5', () => {
  const byName = (c) => HERB_TABLES[c].map(names);
  const C = mapsFile.CLIMATES;
  assert.deepEqual(byName(C.Woodlands), [['Green Leaves', 'Clover', 'Red Flowers', 'Yellow Flowers'], ['Red Berries', 'Yellow Berries', 'Red Rose', 'Yellow Rose', 'Red Poppy'], ['Golden Poppy', 'White Poppy']]);
  assert.deepEqual(byName(C.MountainWoods), [['Pine Branch', 'Clover', 'Green Berries'], ['Root Tendrils'], ['White Rose']]);
  assert.deepEqual(byName(C.Mountain), [['Pine Branch', 'Twigs'], ['Root Bulb'], ['White Poppy']]);
  assert.deepEqual(byName(C.HauntedWoodlands), [['Twigs', 'Root Tendrils'], ['Black Rose', 'Black Poppy'], ['Ginkgo Leaves']]);
  assert.deepEqual(byName(C.Swamp), [['Root Tendrils', 'Root Bulb', 'Green Leaves'], ['Bamboo'], ['Black Poppy']]);
  assert.deepEqual(byName(C.Rainforest), [['Bamboo', 'Green Berries'], ['Ginkgo Leaves', 'Fig', 'Red Flowers'], ['White Rose']]);
  assert.deepEqual(byName(C.Subtropical), [['Palm', 'Aloe', 'Yellow Flowers'], ['Fig', 'Bamboo'], ['Golden Poppy']]);
  assert.deepEqual(byName(C.Desert), [['Cactus', 'Twigs'], ['Aloe', 'Palm'], ['Golden Poppy']]);
  assert.deepEqual(HERB_TABLES[C.Desert2], HERB_TABLES[C.Desert]);
  assert.equal(HERB_TABLES[C.Ocean], undefined, 'the sea grows no herbs');
  const tiers = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [name(i + 8), herbTier(i + 8)]));
  assert.deepEqual(tiers, {
    Twigs: 1, 'Green Leaves': 1, 'Red Flowers': 1, 'Yellow Flowers': 1, 'Root Tendrils': 1, 'Root Bulb': 1, 'Pine Branch': 1, 'Green Berries': 1,
    'Red Berries': 2, 'Yellow Berries': 2, Clover: 1, 'Red Rose': 2, 'Yellow Rose': 2, 'Black Rose': 2, 'White Rose': 3, 'Red Poppy': 2,
    'Black Poppy': 2, 'Golden Poppy': 3, 'White Poppy': 3, 'Ginkgo Leaves': 2, Bamboo: 1, Palm: 1, Aloe: 1, Fig: 2, Cactus: 1,
  });
  assert.deepEqual(HERB_VALUES, [1, 2, 5]);
  assert.deepEqual(TIER_VALUES, [1, 2, 4, 6, 9, 14, 40]);
  assert.deepEqual(material('p1:25'), { key: 'p1:25', family: 'herbs', tier: 3, value: 5, group: 'PlantIngredients1', templateIndex: 25 });
  assert.deepEqual(material('food:egg'), { key: 'food:egg', family: 'food', tier: 1, value: 1 });
  assert.deepEqual(['p1:21', 'p3:8', 'p1:7', 'food:bread', 8, null].map(material), [null, null, null, null, null, null]);
});

test('PROF1 law: north and south - an herb\'s group is its region\'s by FALL.EXE\'s REGION_RACES, a plant one group holds is that group\'s; the groups are DFU\'s own', () => {
  assert.deepEqual(PLANT_GROUP_TEMPLATES.p1, GROUP_TEMPLATE_INDICES.PlantIngredients1);
  assert.deepEqual(PLANT_GROUP_TEMPLATES.p2, GROUP_TEMPLATE_INDICES.PlantIngredients2);
  const regions = mapsTables.REGION_NAMES;
  assert.equal(regionPlantGroup(regions.indexOf('Anticlere')), 'p1', 'a Breton region: northern');
  assert.equal(regionPlantGroup(regions.indexOf('Sentinel')), 'p2', 'a Redguard region: southern');
  assert.deepEqual([herbKey(8, 21), herbKey(8, 20), herbKey(19, 20), herbKey(26, 21), herbKey(33, 21)], ['p1:8', 'p2:8', 'p1:19', 'p2:26', null]);
  assert.equal(plantGroupFor(14, 20), 'p1', 'Pine Branch is northern only');
  assert.deepEqual(FOOD_KEYS, ['food:apple', 'food:orange', 'food:mushroom', 'food:egg', 'food:meat', 'food:fish']);   // PROF7 moved it: a body's butchery
  assert.deepEqual([foodKey(2, 'Apple'), foodKey(2, 'Orange'), foodKey(3, 'Apple'), foodKey(4, 'Orange'), foodKey(5, 'Apple')], ['food:apple', 'food:orange', 'food:mushroom', 'food:egg', null]);
});

test('PROF1 law: the pure tables both ends read are the same objects their old homes export (one home, re-exported)', () => {
  for (const k of ['REGION_NAMES', 'REGION_RACES', 'CLIMATES', 'MAX_MAP_PIXEL_X', 'MAX_MAP_PIXEL_Y']) assert.equal(mapsFile[k], mapsTables[k], k);
  for (const k of ['pickOneOf', 'attributeAverage', 'attributeBand', 'isForagingDaylight', 'isDesertClimate', 'isWinterMonth', 'basketBlock', 'BASKET_BLOCKS']) {
    assert.equal(foragingLaw[k], foragingCore[k], k);
  }
});

test('PROF1 law: the seasons - winter bares the flowers, roses, poppies and berries; spring\'s blooms and autumn\'s berries +50%; Green Leaves and Clover grow all year', () => {
  assert.deepEqual(names(WINTER_BARE).sort(), ['Black Poppy', 'Black Rose', 'Golden Poppy', 'Green Berries', 'Red Berries', 'Red Flowers', 'Red Poppy', 'Red Rose', 'White Poppy', 'White Rose', 'Yellow Berries', 'Yellow Flowers', 'Yellow Rose']);
  assert.deepEqual(names(AUTUMN_FRUIT), ['Green Berries', 'Red Berries', 'Yellow Berries']);
  assert.deepEqual(SPRING_BLOOM.filter((t) => AUTUMN_FRUIT.includes(t)), []);
  assert.deepEqual([9, 18, 8, 12, 13, 14, 27, 28, 29, 30, 31, 32].map((t) => herbInSeason(t, SEASONS.Winter)), Array(12).fill(true));
  assert.deepEqual([19, 16].map((t) => herbInSeason(t, SEASONS.Winter)), [false, false]);
  assert.deepEqual([herbSeasonMult(19, SEASONS.Spring), herbSeasonMult(16, SEASONS.Spring), herbSeasonMult(16, SEASONS.Fall), herbSeasonMult(19, SEASONS.Fall), herbSeasonMult(9, SEASONS.Spring)], [1.5, 1, 1.5, 1, 1]);
});

test('PROF1 law: how many nodes a pixel holds a day, by climate (PROF0 6); the tier weights; a node\'s id', () => {
  const C = mapsFile.CLIMATES;
  const row = (c) => { const n = NODE_COUNTS[c]; return [n.tree, n.herb, n.vein, n.boulder]; };
  assert.deepEqual([C.Woodlands, C.MountainWoods, C.Mountain, C.HauntedWoodlands, C.Swamp, C.Rainforest, C.Subtropical, C.Desert, C.Desert2].map(row),
    [[12, 8, 4, 3], [10, 6, 6, 4], [4, 4, 12, 5], [8, 8, 4, 3], [6, 10, 2, 0], [12, 10, 2, 0], [8, 8, 4, 3], [0, 6, 10, 5], [0, 6, 10, 5]]);   // PIN MOVED (BOULDERS, acct47): the boulders 1/2/3 -> 3/4/5, the Swamp and the Rainforest none still; (MORE-NODES, acct48): the trees, patches and veins doubled
  assert.equal(NODE_COUNTS[C.Ocean], undefined);
  assert.deepEqual(NODE_TIER_WEIGHTS, [40, 25, 15, 10, 6, 4]);
  assert.deepEqual([0, 0.4999, 0.5, 0.8124, 0.8125, 0.9999].map((u) => drawTier(u, 3)), [1, 1, 2, 2, 3, 3], 'herbs: 40 : 25 : 15 renormalised (8 : 5 : 3)');
  const id = nodeKey({ kind: 'herb', x: 412, y: 188, day: 20724, slot: 2 });
  assert.equal(id, 'herb:412:188:20724:2');
  assert.deepEqual(parseNodeKey(id), { kind: 'herb', x: 412, y: 188, day: 20724, slot: 2 });
  assert.deepEqual(['herb:1000:1:1:0', 'herb:1:500:1:0', 'rock:1:1:1:0', 'herb:1:1:1', 7].map(parseNodeKey), [null, null, null, null, null]);
});

test('PROF1 law: a pixel\'s patches are the clock\'s - the same for every asker; held to tier 2 unconfirmed; a bare first draw draws again at that tier or below; a Seasonal Eye keeps it, off-season', () => {
  const C = mapsFile.CLIMATES;
  const T = WINTER_DAY;   // winter on the shared clock - TIME1: the sky's, found rather than named by its date
  assert.equal(daySeason(T), SEASONS.Winter);
  const a = herbPatches({ x: 400, y: 200, day: T, climate: C.Woodlands, confirmed: true });
  assert.deepEqual(a, herbPatches({ x: 400, y: 200, day: T, climate: C.Woodlands, confirmed: true }), 'pure');
  assert.equal(a.length, 8, 'PIN MOVED (MORE-NODES): the Woodlands\' eight');
  for (const p of a) {
    assert.ok(p.u >= 0.04 && p.u <= 0.96 && p.v >= 0.04 && p.v <= 0.96);
    assert.ok(herbInSeason(p.herb, SEASONS.Winter), 'winter: only what grows');
    assert.ok(HERB_TABLES[C.Woodlands][p.tier - 1].includes(p.herb));
  }
  // a game year is 7.5 real days on the sky (TIME1: 360 game days of thirty minutes), so a summer day is found by walking forward
  let S = T;
  while (daySeason(S) !== SEASONS.Summer) S++;
  let rare = 0, unconfRare = 0, eyeOff = 0;
  for (let x = 0; x < 400; x++) {
    for (let slot = 0; slot < 4; slot++) {
      const conf = herbPatch({ x, y: 7, day: S, slot, climate: C.Woodlands, confirmed: true });
      const unconf = herbPatch({ x, y: 7, day: S, slot, climate: C.Woodlands, confirmed: false });
      if (conf.tier === 3) rare++;
      if (unconf.tier === 3) unconfRare++;
      const eye = herbPatch({ x, y: 7, day: T, slot, climate: C.Woodlands, confirmed: true, seasonalEye: true });
      if (eye.offSeason) { eyeOff++; assert.equal(herbInSeason(eye.herb, SEASONS.Winter), false); }
    }
  }
  assert.ok(rare > 100 && rare < 400, `a rare patch about 3 in 16 (${rare} of 1600)`);
  assert.equal(unconfRare, 0, 'an unconfirmed pixel never shows tier 3');
  assert.ok(eyeOff > 0, 'a Seasonal Eye sees the bare herbs');
  assert.equal(herbPatch({ x: 1, y: 1, day: T, slot: 0, climate: C.Ocean }), null);
  assert.deepEqual([dayMonth(T), daySeason(T)], [1, SEASONS.Winter]);
});

test('PROF1 law: the yields - an herb 1-3, the Basket by its block; the order base, season, the bruise, a march +25%, the fraction a chance (PROF0 6, FORAGE0 14.6)', () => {
  assert.deepEqual(HERB_YIELD, [1, 3]);
  assert.deepEqual(FOOD_YIELD, { A: [1, 1], B: [1, 2], C: [1, 3], D: [1, 2], E: [1, 3] });
  assert.deepEqual(MARCH_REGIONS.map((r) => mapsTables.REGION_NAMES[r]), ['Betony', 'Anticlere', 'Lainlyn']);
  assert.deepEqual([wholeYield(2, 0.99), wholeYield(1.5, 0.49), wholeYield(1.5, 0.5), wholeYield(3.75, 0.7), wholeYield(3.75, 0.8)], [2, 2, 1, 4, 3]);
  assert.equal(herbYield({ roll: 2 }, 0), 2);
  assert.equal(herbYield({ roll: 1, common: true, gardener: true }, 0.9), 2, 'a Gardener\'s common herb +1');
  assert.equal(herbYield({ roll: 1, common: false, gardener: true }, 0.9), 1, '...only a common herb');
  assert.equal(herbYield({ roll: 1, bruised: true }, 0.9), 1, 'a bruise never takes the last');
  assert.equal(herbYield({ roll: 3, bruised: true }, 0.9), 2);
  assert.equal(herbYield({ roll: 1, bruised: true, march: true }, 0.1), 2, 'the bruise stops at one BEFORE the march: 1.25, a coin for the second');
  assert.equal(herbYield({ roll: 2, seasonMult: 1.5 }, 0.9), 3);
  assert.equal(herbYield({ roll: 2, offSeason: true }, 0.9), 1);
  assert.equal(herbYield({ roll: 2, march: true }, 0.49), 3, '2.5: a coin for the third');
  assert.equal(herbYield({ roll: 2, march: true }, 0.5), 2);
  assert.equal(foodYield({ roll: 2, step: 1.5 }, 0.9), 3);
  assert.equal(foodYield({ roll: 1, step: 1.25 }, 0.2), 2);
  assert.equal(foodYield({ roll: 1, step: 1.25 }, 0.3), 1);
  const C = mapsFile.CLIMATES;
  const T = WINTER_DAY;   // TIME1: the sky's winter, month 1
  assert.deepEqual(basketFood(C.Desert, T, 0), { block: 'A', material: 'food:orange' });
  assert.deepEqual(basketFood(C.Woodlands, T, 0), { block: 'D', material: 'food:apple' }, 'winter months: block D');
  assert.deepEqual(basketFood(C.Swamp, T, 0.99), { block: 'C', material: 'food:egg' });
});

test('PROF1 law: the witnessed pixel - three agreeing confirm, and the confirmed answer stands; two agreeing after it dispute it; unconfirmed, the most-given answer; a week\'s registration witnesses (SEAT0 3.2)', () => {
  assert.deepEqual(WITNESS, { ageS: 604800, confirm: 3, dispute: 2 });
  const r = (account, report, at) => ({ account, report, at });
  assert.deepEqual(witnessedFact([]), { state: 'none', climate: null, region: null });
  assert.deepEqual(witnessedFact([r('a', '231,21', 1), r('b', '230,21', 2), r('c', '230,21', 3)]), { state: 'unconfirmed', climate: 230, region: 21 });
  assert.deepEqual(witnessedFact([r('a', '231,21', 1), r('b', '231,21', 2), r('c', '231,21', 3)]), { state: 'confirmed', climate: 231, region: 21 });
  const disputed = witnessedFact([r('a', '231,21', 1), r('b', '231,21', 2), r('c', '231,21', 3), r('d', '230,21', 4), r('e', '230,21', 5)]);
  assert.deepEqual(disputed, { state: 'disputed', climate: 231, region: 21 });
  assert.equal(factConfirmed(disputed), true, 'a disputed pixel keeps its confirmed worth');
  assert.deepEqual(witnessedFact([r('d', '230,21', 1), r('e', '230,21', 2), r('a', '231,21', 3), r('b', '231,21', 4), r('c', '231,21', 5)]).state, 'confirmed', 'two before three is no dispute - there was nothing to dispute');
  assert.deepEqual(witnessedFact([r('a', 'nonsense', 1)]).state, 'none');
});

test('PROF1 law: Court writs - 6 x max(1, ceil(active / 100)) a region a day; the pay units x value x 1.2, the Renown 25 x tier x units / 10 (Appendix A: 30 Red Poppies, 72 Marks and 150 Renown); three an account a day, the Marks\' second faucet', () => {
  assert.deepEqual([0, 1, 100, 101, 250, 300, 301].map(courtWritCount), [6, 6, 6, 12, 18, 18, 24]);
  assert.equal(COURT_WRITS_PER_DAY, 3);
  assert.deepEqual([writPay(30, 2), writRenown(2, 30)], [72, 112]);   // MERGE 2: the Renown at main's RENOWN-ACCOUNT rate - 150 at the full rate, three quarters floored (renown.js renownRate)
  assert.deepEqual(MARKS_FAUCETS.writ, { perDay: 3 });
  assert.equal(MARKS_KINDS.writ, 'mint');
  assert.equal(MARKS_KINDS.respec, 'burn');
  for (const [t, [lo, hi]] of Object.entries(WRIT_UNITS)) assert.ok(lo % 10 === 0 && hi % 10 === 0 && lo >= 10 && hi <= 50 && lo <= hi, `tier ${t}`);
});

test('PROF1 law: a region\'s writs ask what its witnessed ground grows in the season - a confirmed pixel\'s whole table, an unconfirmed one\'s tiers 1-2; the day\'s first the highest tier; units in tens', () => {
  const C = mapsFile.CLIMATES;
  const table = regionWritTable(21, [{ climate: C.Woodlands, confirmed: false }], SEASONS.Summer);
  const herbsOf = (t) => t.filter((m) => /^p[12]:/.test(m.material));   // PROF2: the ground's metal and stone beside them (prof2_law)
  assert.deepEqual(herbsOf(table).map((m) => name(m.material.split(':')[1] * 1)).sort(), ['Clover', 'Green Leaves', 'Red Berries', 'Red Flowers', 'Red Poppy', 'Red Rose', 'Yellow Berries', 'Yellow Flowers', 'Yellow Rose']);
  const confirmed = regionWritTable(21, [{ climate: C.Woodlands, confirmed: true }], SEASONS.Summer);
  assert.ok(confirmed.some((m) => m.tier === 3), 'the rare poppies once the ground is confirmed');
  assert.deepEqual(herbsOf(regionWritTable(21, [{ climate: C.Woodlands, confirmed: true }], SEASONS.Winter)).map((m) => m.material), ['p1:18', 'p1:9'], 'winter: Clover and Green Leaves');
  assert.deepEqual(regionWritTable(21, [], SEASONS.Summer), []);
  assert.deepEqual(courtWrits(20000, 21, 6, []), []);
  const writs = courtWrits(20000, 21, 12, herbsOf(confirmed));
  assert.equal(writs.length, 12);
  assert.equal(writs[0].tier, 3, 'the day\'s first: the highest the herbs reach');
  for (const w of writs) {
    const m = confirmed.find((x) => x.material === w.material);
    assert.ok(m && m.tier === w.tier);
    const [lo, hi] = WRIT_UNITS[w.tier];
    assert.ok(w.units % 10 === 0 && w.units >= lo && w.units <= hi);
    assert.equal(w.pay, writPay(w.units, m.value));
    assert.ok(Number.isInteger(w.pay) && Number.isInteger(w.renown));
  }
  assert.deepEqual(courtWrits(20000, 21, 12, herbsOf(confirmed)), writs, 'a pure function of the day, the region and the count');
});
