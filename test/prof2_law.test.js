// PROF2 (2026-09-28, Mac: "Go") - MINING AND QUARRYING'S LAWS, pinned against the record (bible/06-Systems/
// Professions-Arc.md, PROF0 4.1, 4.5, 4.6, 4.7, 5.2, 6, 11 and 23; SEAT0 4.3's kingdoms) and against DFU's own tables:
// src/net/kingdomLaw.js, src/net/professionLaw.js, src/net/nodeLaw.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { KINGDOMS, MARCHES, MARCH_REGIONS as K_MARCHES, FREE_LANDS, kingdomOf, isMarch, isFreeLand } from '../src/net/kingdomLaw.js';
import {
  METALS, ORES, INGOTS, STONES, GEMS, gemTierOfPrice, minedMaterial, MINING_TEMPLATES, TIER_VALUES, strikesFor, glintsMax, MINE_ACT,
  GEM_CHANCE, PROSPECTOR_GEM, DEEP_DELVER_MULT, CUT_RATIO, pickAxeBand, actBand, SMELT_RECIPES, smeltRecipe, SMELT_MAX, FORGE_FEE,
  smeltXp, smeltOrigin, craftXpCap, xpForRank, professionOfFamily, ICON_LODESTONE, ICON_IRON,
} from '../src/net/professionLaw.js';
import {
  VEIN_TABLES, DUNGEON_VEINS, dungeonVeinTable, regionSignature, drawFromTable, vein, veins, boulder, boulders, dungeonVein,
  dungeonVeins, dungeonVeinCount, DUNGEON_VEINS_MAX, dveinKey, parseNodeKey, dungeonOk, DUNGEON_ID_MAX, VEIN_GEMS, gemOf,
  DUNGEON_GEM, VEIN_YIELD, BOULDER_YIELD, veinYield, boulderYield, material, regionWritTable, courtWrits, nodeCount, veinGem,
  MARCH_REGIONS, NODE_TIER_WEIGHTS,
} from '../src/net/nodeLaw.js';
import { CLIMATES, REGION_NAMES } from '../src/formats/mapsTables.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { SEASONS } from '../src/systems/gameDate.js';

const name = (i) => templateByIndex(i).name;
const C = CLIMATES;
const DAY = 20500;

test('PROF2 law: the kingdoms are SEAT0 4.3\'s, one home - three crowns, the Marches and the Free Lands, no region in two', () => {
  assert.deepEqual([...KINGDOMS.daggerfall.regions].map((r) => REGION_NAMES[r]), ['Daggerfall', 'Glenumbra Moors', 'Tulune', 'Ilessan Hills', 'Glenpoint', 'Shalgora', 'Daenia', 'Northmoor']);
  assert.deepEqual([...KINGDOMS.wayrest.regions], [23, 33, 34, 35, 36, 37, 5, 38, 39, 40, 57]);
  assert.deepEqual([...KINGDOMS.sentinel.regions], [20, 0, 1, 11, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 61]);
  assert.deepEqual([...K_MARCHES].map((r) => REGION_NAMES[r]), ['Betony', 'Anticlere', 'Lainlyn']);
  assert.deepEqual({ ...MARCHES[19] }, { 0: 'daggerfall', 1: 'sentinel' });
  assert.deepEqual({ ...FREE_LANDS }, { balfiera: 9, orsinium: 26, wrothgarian: 16 });
  const all = [...Object.values(KINGDOMS).flatMap((k) => k.regions), ...K_MARCHES, ...Object.values(FREE_LANDS)];
  assert.equal(new Set(all).size, all.length, 'no region in two lands');
  assert.equal(all.length, 44, 'the eighteen left out hold no seat');
  assert.deepEqual([kingdomOf(17), kingdomOf(23), kingdomOf(0), kingdomOf(21), kingdomOf(9), kingdomOf(31)], ['daggerfall', 'wayrest', 'sentinel', null, null, null]);
  assert.deepEqual([isMarch(21), isMarch(17), isFreeLand(26), isFreeLand(17)], [true, false, true, false]);
  assert.equal(MARCH_REGIONS, K_MARCHES, 'the nodes\' Marches are the kingdoms\' own object');
});

test('PROF2 law: the metals are DFU\'s own MetalIngredients at PROF0 4.1\'s tiers; the gems DFU\'s Gems at their price\'s tier', () => {
  for (const m of METALS) {
    assert.equal(m.group, 'MetalIngredients');
    assert.ok(GROUP_TEMPLATE_INDICES.MetalIngredients.includes(m.templateIndex), m.key);
    assert.equal(name(m.templateIndex).toLowerCase(), m.key.slice(6), `${m.key} is DFU's own`);
  }
  assert.deepEqual(Object.fromEntries(METALS.map((m) => [m.key.slice(6), m.tier])), {
    iron: 1, tin: 1, copper: 1, lead: 1, sulphur: 1, lodestone: 2, mercury: 2, silver: 3, gold: 4, platinum: 5, brass: 2,
  });
  for (const g of GEMS) {
    assert.equal(g.group, 'Gems');
    assert.ok(GROUP_TEMPLATE_INDICES.Gems.includes(g.templateIndex));
    assert.equal(name(g.templateIndex).toLowerCase(), g.key.slice(4));
    assert.equal(g.tier, gemTierOfPrice(templateByIndex(g.templateIndex).basePrice), `${g.key}: its DFU price's band`);
  }
  assert.deepEqual(Object.fromEntries(GEMS.map((g) => [g.key.slice(4), g.tier])), { ruby: 5, emerald: 6, sapphire: 6, diamond: 6, jade: 2, turquoise: 3, malachite: 3, amber: 4 });
  assert.deepEqual([gemTierOfPrice(10), gemTierOfPrice(11), gemTierOfPrice(50), gemTierOfPrice(100), gemTierOfPrice(250), gemTierOfPrice(251)], [2, 3, 3, 4, 5, 6]);
});

test('PROF2 law: the new templates are the reserved range\'s - ores 610-615, ingots 620-630, stone 673-674 - on DFU\'s own pictures, dyed by DFU\'s metals', () => {
  assert.deepEqual(ORES.map((o) => [o.templateIndex, o.name, o.tier]), [
    [610, 'Moonstone Ore', 4], [611, 'Dwarven Scrap', 4], [612, 'Mithril Ore', 5], [613, 'Adamantium Ore', 6], [614, 'Ebony Ore', 6], [615, 'Orichalcum Ore', 6],
  ]);
  assert.deepEqual(INGOTS.map((o) => [o.templateIndex, o.tier]), [[620, 1], [621, 2], [622, 3], [623, 4], [624, 4], [625, 5], [626, 6], [627, 6], [628, 6], [629, 7], [630, 6]]);
  assert.deepEqual(STONES.map((o) => [o.templateIndex, o.name, o.tier]), [[673, 'Rough Stone', 1], [674, 'Cut Stone', 2]]);
  assert.deepEqual([...ICON_LODESTONE, ...ICON_IRON], [254, 66, 254, 63], 'Lodestone\'s lump and Iron\'s bar (TEXTURE.254)');
  assert.equal(name(68), 'Lodestone');
  assert.equal(name(71), 'Iron');
  assert.ok(ORES.every((o) => o.icon === ICON_LODESTONE) && INGOTS.every((o) => o.icon === ICON_IRON));
  assert.deepEqual(INGOTS.map((o) => o.dye), ['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric', 'Steel']);
  assert.equal(MINING_TEMPLATES.length, 6 + 11 + 2);
  for (const m of [...METALS, ...ORES, ...INGOTS, ...STONES, ...GEMS]) {
    const r = material(m.key);
    assert.deepEqual([r.family, r.tier, r.value], [m.family, m.tier, TIER_VALUES[m.tier - 1]], m.key);
    assert.equal(minedMaterial(m.key), m);
  }
  assert.deepEqual([professionOfFamily('metals'), professionOfFamily('stone'), professionOfFamily('gems'), professionOfFamily('wood')], ['mining', 'mining', 'mining', 'logging']);   // PROF4: wood is Logging's
  assert.equal(material('ore:nothing'), null);
});

test('PROF2 law: the act - 4 / 5 / 7 strikes by tier, the glint 1.2 s (2 s at Master) and 2.5 degrees, a finish\'s glints; the Pick-Axe\'s band is (INT + AGI) / 2', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(strikesFor), [4, 4, 5, 5, 7, 7]);
  assert.deepEqual([1, 3, 5].map(glintsMax), [2, 3, 4], 'every strike on the glint counts two');
  assert.deepEqual({ ...MINE_ACT }, { points: 5, glintS: 1.2, masterGlintS: 2.0, radiusDeg: 2.5, swingS: 0.45, spreadYawDeg: 7, spreadPitchDeg: 4 });
  assert.deepEqual([GEM_CHANCE, PROSPECTOR_GEM, DEEP_DELVER_MULT, CUT_RATIO], [0.03, 1.1, 1.5, 2]);
  assert.equal(pickAxeBand({ intelligence: 70, agility: 50 }), actBand(60));
  assert.equal(pickAxeBand({ intelligence: 39, agility: 40 }), actBand(39), 'C#\'s integer average: 79 / 2 is 39');
});

test('PROF2 law: the veins\' tables are PROF0 4.1\'s; a vein\'s tier is drawn over its table\'s tiers by the nodes\' weights, held to 2 unconfirmed', () => {
  const keys = (c) => [...VEIN_TABLES[c]];
  assert.deepEqual(keys(C.Woodlands), ['metal:iron', 'metal:copper', 'metal:tin', 'metal:lodestone']);
  assert.deepEqual(keys(C.MountainWoods), ['metal:iron', 'metal:copper', 'metal:silver', 'metal:lead']);
  assert.deepEqual(keys(C.Mountain), ['metal:iron', 'metal:silver', 'metal:gold', 'metal:platinum', 'ore:mithril']);
  assert.deepEqual(keys(C.HauntedWoodlands), ['metal:iron', 'metal:lead', 'metal:mercury']);
  assert.deepEqual(keys(C.Swamp), ['metal:iron', 'metal:mercury', 'metal:sulphur']);
  assert.deepEqual(keys(C.Rainforest), ['metal:iron', 'metal:copper', 'metal:gold']);
  assert.deepEqual(keys(C.Subtropical), ['metal:iron', 'metal:copper', 'metal:tin', 'metal:sulphur']);
  assert.deepEqual(keys(C.Desert), ['metal:iron', 'metal:lead', 'metal:sulphur', 'metal:gold', 'ore:ebony']);
  assert.deepEqual(keys(C.Desert2), keys(C.Desert));
  assert.equal(VEIN_TABLES[C.Ocean], undefined);
  // the draw: Woodlands' tiers are 1 (40) and 2 (25) - u under 40/65 draws tier 1
  assert.equal(drawFromTable(VEIN_TABLES[C.Woodlands], 0.6, 0).tier, 1);
  assert.equal(drawFromTable(VEIN_TABLES[C.Woodlands], 0.62, 0).tier, 2);
  assert.equal(drawFromTable(VEIN_TABLES[C.Woodlands], 0.62, 0).material, 'metal:lodestone');
  assert.deepEqual([0, 0.34, 0.67].map((v) => drawFromTable(VEIN_TABLES[C.Woodlands], 0, v).material), ['metal:iron', 'metal:copper', 'metal:tin'], 'a tier\'s metals evenly');
  assert.equal(drawFromTable(VEIN_TABLES[C.Mountain], 0.999, 0.999).tier, 5, 'the Mountain\'s highest');
  assert.equal(drawFromTable(VEIN_TABLES[C.Mountain], 0.999, 0.999, 2).tier, 1, 'held to 2: the Mountain has only Iron there');
  assert.deepEqual(NODE_TIER_WEIGHTS, [40, 25, 15, 10, 6, 4]);
  // over many days, an unconfirmed Mountain pixel yields Iron alone; a confirmed one reaches tiers 3-5
  const seen = new Set(), seenC = new Set();
  for (let d = 0; d < 200; d++) {
    for (const v of veins({ x: 400, y: 150, day: DAY + d, climate: C.Mountain, region: 60, confirmed: false })) seen.add(v.material);
    for (const v of veins({ x: 400, y: 150, day: DAY + d, climate: C.Mountain, region: 7, confirmed: true })) seenC.add(v.tier);
  }
  assert.deepEqual([...seen], ['metal:iron']);
  assert.ok(seenC.has(3) && seenC.has(4) && seenC.has(5), 'Silver, Gold, Platinum and Mithril come to the confirmed');
  assert.equal(veins({ x: 400, y: 150, day: DAY, climate: C.Mountain, region: 7 }).length, nodeCount(C.Mountain, 'vein'));
  assert.ok(vein({ x: 400, y: 150, day: DAY, slot: 11, climate: C.Mountain }), 'PIN MOVED (MORE-NODES): the Mountain\'s twelve');
  assert.equal(vein({ x: 400, y: 150, day: DAY, slot: 12, climate: C.Mountain }), null, 'past the count');
});

test('PROF2 law: the signatures by kingdom (PROF0 4.7) - on a confirmed pixel, Daggerfall\'s Moonstone two veins, the others one, beside the climate\'s (AUDIT 29 A6); never unconfirmed', () => {
  assert.deepEqual(regionSignature(17), { ore: 'ore:moonstone', slots: 2 });
  assert.deepEqual(regionSignature(23), { ore: 'ore:mithril', slots: 1 });
  assert.deepEqual(regionSignature(0), { ore: 'ore:ebony', slots: 1 });
  assert.deepEqual([regionSignature(26), regionSignature(16)], [{ ore: 'ore:orichalcum', slots: 1 }, { ore: 'ore:orichalcum', slots: 1 }]);
  assert.deepEqual(regionSignature(9), { ore: 'ore:adamantium', slots: 1 });
  assert.equal(regionSignature(21), null, 'a March: its +25%, no signature');
  assert.equal(regionSignature(31), null);
  const at = (region, confirmed, climate = C.Woodlands) => veins({ x: 300, y: 200, day: DAY, climate, region, confirmed });
  assert.deepEqual(at(17, true).map((v) => v.signature), [false, false, false, false, true, true], 'the Woodlands\' four (PIN MOVED, MORE-NODES), then Daggerfall\'s two');
  assert.deepEqual(at(17, true).filter((v) => v.signature).map((v) => v.material), ['ore:moonstone', 'ore:moonstone']);
  assert.deepEqual(at(23, true, C.Mountain).map((v) => v.signature), [...Array(12).fill(false), true]);
  assert.equal(at(23, true, C.Mountain)[12].material, 'ore:mithril');
  assert.ok(at(17, false).every((v) => !v.signature && v.tier <= 2), 'unconfirmed: the ordinary veins alone');
  assert.equal(at(17, false).length, 4);
  const swamp = veins({ x: 300, y: 200, day: DAY, climate: C.Swamp, region: 17, confirmed: true });
  assert.deepEqual(swamp.map((v) => v.signature), [false, false, true, true], 'a Swamp pixel\'s two veins kept (MORE-NODES), and the two Moonstones');
  // Orichalcum grows nowhere else: no climate's table and no other region's signature holds it
  assert.ok(Object.values(VEIN_TABLES).every((t) => !t.includes('ore:orichalcum')));
  assert.ok(Array.from({ length: 62 }, (_, r) => r).filter((r) => regionSignature(r)?.ore === 'ore:orichalcum').every((r) => r === 26 || r === 16));
});

test('PROF2 law: the boulders - the climate\'s count a day, tier 1, Rough Stone; the dungeon veins 1-4 a day, tiers 3-6, a dungeon\'s own id', () => {
  const b = boulders({ x: 300, y: 200, day: DAY, climate: C.Mountain });
  assert.equal(b.length, 5, 'PIN MOVED (BOULDERS, acct47): the Mountain\'s five');
  assert.ok(b.every((n) => n.tier === 1 && n.material === 'stone:rough' && n.u >= 0.04 && n.u <= 0.96));
  assert.deepEqual(boulders({ x: 300, y: 200, day: DAY, climate: C.Swamp }), [], 'the Swamp has none');
  assert.ok(boulder({ x: 300, y: 200, day: DAY, slot: 4, climate: C.Mountain }));
  assert.equal(boulder({ x: 300, y: 200, day: DAY, slot: 5, climate: C.Mountain }), null);
  const counts = new Set(), tiers = new Set(), mats = new Set();
  for (let id = 1; id < 400; id++) {
    const n = dungeonVeinCount(id, DAY);
    counts.add(n);
    const list = dungeonVeins({ dungeon: id, day: DAY, climate: C.Mountain, confirmed: true });
    assert.equal(list.length, n);
    for (const v of list) { tiers.add(v.tier); mats.add(v.material); assert.ok(v.marker >= 0 && v.marker < 1 && v.bearing >= 0 && v.bearing < 2 * Math.PI); }
  }
  assert.deepEqual([...counts].sort(), [1, 2, 3, 4]);
  assert.equal(DUNGEON_VEINS_MAX, 4);
  assert.deepEqual([...tiers].sort(), [3, 4, 5, 6]);
  assert.ok(!mats.has('ore:moonstone'), 'a Mountain dungeon has no Moonstone');
  assert.ok(mats.has('ore:dwarven') && mats.has('ore:adamantium'), 'Dwarven Scrap and Adamantium are found here');
  assert.deepEqual([...DUNGEON_VEINS], ['metal:silver', 'metal:gold', 'ore:dwarven', 'metal:platinum', 'ore:adamantium']);
  assert.ok(dungeonVeinTable(C.Woodlands).includes('ore:moonstone') && dungeonVeinTable(C.HauntedWoodlands).includes('ore:moonstone'));
  for (let id = 1; id < 200; id++) for (const v of dungeonVeins({ dungeon: id, day: DAY, climate: C.Woodlands, confirmed: false })) assert.deepEqual([v.tier, v.material], [3, 'metal:silver'], 'unconfirmed: the least a deep vein is');
  assert.equal(dveinKey({ dungeon: 123456, day: DAY, slot: 2 }), `dvein:123456:${DAY}:2`);
  assert.deepEqual(parseNodeKey(`dvein:123456:${DAY}:2`), { kind: 'dvein', dungeon: 123456, day: DAY, slot: 2 });
  assert.equal(parseNodeKey(`dvein:${DUNGEON_ID_MAX + 1}:${DAY}:0`), null, 'past DFU\'s 20 bits');
  assert.deepEqual([dungeonOk(0), dungeonOk(0xfffff), dungeonOk(-1), dungeonOk(1.5)], [true, true, false, false]);
  assert.equal(dungeonVein({ dungeon: 5, day: DAY, slot: 4, climate: C.Mountain }), null);
});

test('PROF2 law: the yields (PROF0 6) - a vein 2-3, Deep Delver x1.5 underground only, a march +25%; a boulder 3-5, cut two to one', () => {
  assert.deepEqual([VEIN_YIELD, BOULDER_YIELD], [[2, 3], [3, 5]]);
  assert.equal(veinYield({ roll: 2 }, 0.9), 2);
  assert.equal(veinYield({ roll: 2, deep: true, deepDelver: true }, 0.9), 3);
  assert.equal(veinYield({ roll: 2, deepDelver: true }, 0.1), 2, 'Deep Delver works the dungeon\'s veins alone');
  assert.equal(veinYield({ roll: 3, deep: true, deepDelver: true }, 0.4), 5, '4.5: a coin for the fifth');
  assert.equal(veinYield({ roll: 2, march: true }, 0.4), 3, '2.5');
  assert.deepEqual(boulderYield({ roll: 4 }, 0.9), { material: 'stone:rough', qty: 4 });
  assert.deepEqual(boulderYield({ roll: 4, cut: true }, 0.9), { material: 'stone:cut', qty: 2 });
  assert.deepEqual(boulderYield({ roll: 3, cut: true }, 0.4), { material: 'stone:cut', qty: 2 }, '1.5: the half a coin');
  assert.deepEqual(boulderYield({ roll: 3, cut: true }, 0.6), { material: 'stone:cut', qty: 1 });
  assert.deepEqual(boulderYield({ roll: 5, march: true }, 0.1), { material: 'stone:rough', qty: 7 }, '6.25');
});

test('PROF2 law: the gems (PROF0 4.6) - Amber, Jade, Turquoise, Malachite, and the Mountain\'s three; a Diamond from a dungeon\'s vein; no gem in stone', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(VEIN_GEMS).map(([c, l]) => [c, [...l]])), {
    [C.Woodlands]: ['gem:amber'], [C.Rainforest]: ['gem:jade'], [C.Desert]: ['gem:turquoise'], [C.Desert2]: ['gem:turquoise'],
    [C.Swamp]: ['gem:malachite'], [C.Mountain]: ['gem:ruby', 'gem:sapphire', 'gem:emerald'],
  });
  assert.deepEqual([0, 0.4, 0.8].map((u) => gemOf({ kind: 'vein', climate: C.Mountain }, u)), ['gem:ruby', 'gem:sapphire', 'gem:emerald']);
  assert.equal(gemOf({ kind: 'vein', climate: C.MountainWoods }, 0.5), null);
  assert.equal(gemOf({ kind: 'dvein', climate: C.MountainWoods }, 0.5), DUNGEON_GEM);
  assert.equal(DUNGEON_GEM, 'gem:diamond');
  assert.equal(gemOf({ kind: 'boulder', climate: C.Mountain }, 0.5), null);
  // the strikes' chances, on scripted dice: a strike under 3% finds the climate's gem; a Prospector's under 3.3%
  const dice = (...u) => { let i = 0; return () => u[i++] ?? 0.99; };
  assert.equal(veinGem({ kind: 'vein', climate: C.Woodlands, glints: 2, confirmed: true }, dice(0.5, 0.029, 0)), 'gem:amber', 'the second strike\'s');
  assert.equal(veinGem({ kind: 'vein', climate: C.Woodlands, glints: 2, confirmed: true }, dice(0.5, 0.031)), null);
  assert.equal(veinGem({ kind: 'vein', climate: C.Woodlands, glints: 2, confirmed: true, prospector: true }, dice(0.5, 0.031, 0)), 'gem:amber', 'a Prospector\'s x1.1');
  assert.equal(veinGem({ kind: 'vein', climate: C.Woodlands, glints: 1, confirmed: true }, dice(0.5, 0)), null, 'no more chances than strikes on the glint');
  assert.equal(veinGem({ kind: 'vein', climate: C.Woodlands, glints: 4, confirmed: false }, dice(0, 0, 0, 0)), null, 'never on ground nobody confirmed');
  assert.equal(veinGem({ kind: 'dvein', climate: C.Swamp, glints: 3, confirmed: true }, dice(0.01, 0.7)), 'gem:diamond');
});

test('PROF2 law: smelting (PROF0 4.1) - two of a raw metal an ingot, Steel and Brass of two, 10 XP a unit a tier, an ingot own only when all its units were', () => {
  assert.deepEqual(SMELT_RECIPES.map((r) => [r.id, r.out, r.inputs.map((i) => `${i.n} ${i.key}`).join(' + ')]), [
    ['ingot:iron', 'ingot:iron', '2 metal:iron'],
    ['ingot:steel', 'ingot:steel', '1 ingot:iron + 1 wood:charcoal'],
    ['ingot:silver', 'ingot:silver', '2 metal:silver'],
    ['metal:brass', 'metal:brass', '1 metal:copper + 1 metal:tin'],
    ['ingot:moonstone', 'ingot:moonstone', '2 ore:moonstone'],
    ['ingot:dwarven', 'ingot:dwarven', '2 ore:dwarven'],
    ['ingot:mithril', 'ingot:mithril', '2 ore:mithril'],
    ['ingot:adamantium', 'ingot:adamantium', '2 ore:adamantium'],
    ['ingot:ebony', 'ingot:ebony', '2 ore:ebony'],
    ['ingot:orichalcum', 'ingot:orichalcum', '2 ore:orichalcum'],
  ]);
  assert.equal(smeltRecipe('ingot:daedric'), null, 'Daedric waits on its heart and its stone');
  assert.deepEqual([SMELT_MAX, FORGE_FEE], [100, 50]);
  assert.equal(smeltXp(5, 3), 150);
  assert.deepEqual(smeltOrigin(smeltRecipe('ingot:iron'), 5, [3]), { own: 3, bought: 2 }, 'units 0-2 bought: ingots 0 and 1 hold one');
  assert.deepEqual(smeltOrigin(smeltRecipe('ingot:iron'), 5, [0]), { own: 5, bought: 0 });
  assert.deepEqual(smeltOrigin(smeltRecipe('ingot:iron'), 2, [99]), { own: 0, bought: 2 });
  assert.deepEqual(smeltOrigin(smeltRecipe('metal:brass'), 5, [1, 4]), { own: 1, bought: 4 }, 'the most any input\'s bought units reach');
  // PIN MOVED (CRAFT3): the limit counts the five crafting TRACKS - Alchemy and Cooking are one track now (Provisioning), so the two others past Journeyman are Provisioning and Building
  assert.equal(craftXpCap('smithing', { provisioning: 60, building: 51 }), xpForRank(51) - 1, 'a third craft past Journeyman stops at 50');
  assert.equal(craftXpCap('smithing', { provisioning: 60, building: 50, mining: 90 }), xpForRank(100), 'a gathering track is no craft; 50 is not past');   // PIN MOVED (CRAFT3): track ids
  assert.equal(craftXpCap('smithing', { smithing: 70, provisioning: 60 }), xpForRank(100), 'its own rank is never counted against it');   // PIN MOVED (CRAFT3): track ids
  assert.equal(craftXpCap('jewelcrafting', { smithing: 70, provisioning: 60 }), xpForRank(100), 'a discipline is its craft\'s track: Smithing\'s own rank is Jewelcrafting\'s');   // PIN MOVED (CRAFT3): the profession asked maps through trackOf
});

test('PROF2 law: the Court writs ask metal and stone too - the ground\'s veins (tiers 1-2 unconfirmed), its region\'s signature on a confirmed pixel, Rough Stone where boulders stand; never an ingot, Cut Stone or a gem', () => {
  const un = regionWritTable(23, [{ climate: C.Mountain, confirmed: false }], SEASONS.Summer).map((m) => m.material);
  assert.ok(un.includes('metal:iron') && un.includes('stone:rough'));
  assert.ok(!un.includes('metal:silver') && !un.includes('ore:mithril'), 'unconfirmed: tiers 1-2 only');
  const conf = regionWritTable(23, [{ climate: C.Mountain, confirmed: true }], SEASONS.Summer);
  const keys = conf.map((m) => m.material);
  assert.ok(['metal:silver', 'metal:gold', 'metal:platinum', 'ore:mithril'].every((k) => keys.includes(k)));
  assert.ok(regionWritTable(17, [{ climate: C.Woodlands, confirmed: true }], SEASONS.Summer).some((m) => m.material === 'ore:moonstone'), 'Daggerfall\'s Moonstone');
  assert.ok(!regionWritTable(17, [{ climate: C.Woodlands, confirmed: false }], SEASONS.Summer).some((m) => m.material === 'ore:moonstone'));
  assert.ok(!regionWritTable(17, [{ climate: C.Swamp, confirmed: true }], SEASONS.Summer).some((m) => m.material === 'stone:rough'), 'no boulders in a Swamp');
  assert.ok(keys.every((k) => !/^(ingot|gem):|^stone:cut$/.test(k)));
  const writs = courtWrits(DAY, 23, 12, conf);
  assert.ok(writs[0].tier >= 5, 'the day\'s first: tier 5-6 now the metals reach it');
  for (const w of writs) assert.equal(w.pay, (w.units * material(w.material).value * 6) / 5);
});
