// PROF4 (2026-09-28, Mac: "Continue") - LOGGING'S AND CARPENTRY'S LAW (src/net/professionLaw.js, nodeLaw.js,
// recipeLaw.js, productRecord.js, decorLaw.js): the woods and their templates; a pixel's trees, the rare wood and the
// unconfirmed pixel's hold; a tree's yield and finds; the chops and the ring; the forge's burns and the workbench's saws;
// Carpentry's recipes, what a craft spends (a Joiner's, a Heartwood's), the steps and the mark; the plane; the furnisher's
// stock; the Court's wood; a crafted piece's descriptor in a home. bible/06-Systems/Professions-Arc.md 4.2, 5.2, 9.3, 25.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WOODS, LOGS, PLANKS, CHARCOAL, RESIN, HEARTWOOD, WOOD_TEMPLATES, woodOf, chopsFor, CHOP_ACT, ringBand, cutsMax, woodAxeBand,
  HEARTWOOD_CHANCE, FORESTER_MULT, RESIN_CHANCE, BURN_RECIPES, SAW_RECIPES, WORK_RECIPES, SMELT_RECIPES, smeltRecipe, workPer,
  WORKBENCH_FEE, FORGE_FEE, FURNISHER_STOCK, SMITH_STOCK, STOCKS, stockOf, withdrawable, NO_PACK_FORM, LINEN, BEAR_HIDE,
  professionOfFamily, specOk, SPECIALISATIONS, materialOf, TIER_VALUES,
} from '../src/net/professionLaw.js';
import {
  WOOD_TABLES, RARE_WOODS, RARE_WOOD_CHANCE, tree, trees, TREE_YIELD, treeYield, treeFinds, NODE_COUNTS, herbTier, regionWritTable,
} from '../src/net/nodeLaw.js';
import {
  CARPENTRY_RECIPES, SMITH_RECIPES, RECIPES, recipeById, recipeOpen, recipeInputs, takesHeartwood, takesQuality, qualitySteps,
  carriesMark, WOOD_MATERIAL, ARROWS_STACK, RAM_KIT_RANK, PLANE_ACT, planeBand, planeTolerance, grainAt, craftCount, MASTERWORK,
  OUTFITTING_RECIPES,
} from '../src/net/recipeLaw.js';
import { mintProductRecord, readProductRecord } from '../src/net/productRecord.js';
import { decorItemOf } from '../src/net/decorLaw.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { SEASONS } from '../src/systems/gameDate.js';

test('PROF4 law: the woods (4.2) - Pine 1, Oak 2, Cherry 3, Teak 4, Mahogany 5, Ironwood and Ghostwood 6; logs 635-641 on Twigs\' picture, planks 645-651 on the Staff\'s dyed Iron, Charcoal 652, Resin 653 (Aloe\'s), Heartwood 654 (tier 4); the Stores know them, wood is Logging\'s', () => {
  assert.deepEqual(WOODS.map((w) => [w.id, w.tier]), [['pine', 1], ['oak', 2], ['cherry', 3], ['teak', 4], ['mahogany', 5], ['ironwood', 6], ['ghostwood', 6]]);
  assert.deepEqual(LOGS.map((l) => [l.key, l.templateIndex, l.tier, l.name, l.icon.join('/'), l.dye]), WOODS.map((w, i) => [`log:${w.id}`, 635 + i, w.tier, `${w.name} Log`, '254/9', null]));
  assert.deepEqual(PLANKS.map((l) => [l.key, l.templateIndex, l.tier, l.name, l.icon.join('/'), l.dye]), WOODS.map((w, i) => [`plank:${w.id}`, 645 + i, w.tier, `${w.name} Plank`, '207/7', 'Iron']));
  assert.deepEqual([CHARCOAL, RESIN, HEARTWOOD].map((m) => [m.key, m.templateIndex, m.tier, m.icon.join('/')]), [['wood:charcoal', 652, 1, '254/66'], ['wood:resin', 653, 1, '254/23'], ['wood:heartwood', 654, 4, '254/9']]);
  assert.equal(WOOD_TEMPLATES.length, 17);
  for (const m of WOOD_TEMPLATES) assert.deepEqual(materialOf(m.key, herbTier), { key: m.key, family: 'wood', tier: m.tier, value: TIER_VALUES[m.tier - 1], templateIndex: m.templateIndex });
  assert.deepEqual([woodOf('log:oak'), woodOf('plank:ghostwood'), woodOf('log:birch'), woodOf('wood:resin'), woodOf(null)], ['oak', 'ghostwood', null, null, null]);
  assert.equal(professionOfFamily('wood'), 'logging');
  assert.deepEqual([BEAR_HIDE.key, BEAR_HIDE.templateIndex, BEAR_HIDE.tier, LINEN.key, LINEN.templateIndex, LINEN.tier], ['hide:bear', 657, 2, 'cloth:linen', 668, 1]);
});

test('PROF4 law: a pixel\'s trees - the climate\'s woods (the haunted wood Woodlands\' Oak and Cherry), tier by the weights, held to tier 2 on a pixel nobody confirmed (the Rainforest and Subtropical then stand none); the rare wood one in twenty, on confirmed ground only; the Desert none', () => {
  const C = CLIMATES;
  assert.deepEqual(Object.fromEntries(Object.entries(WOOD_TABLES).map(([k, v]) => [k, [...v]])), {
    [C.Woodlands]: ['log:oak', 'log:cherry'], [C.MountainWoods]: ['log:pine', 'log:oak'], [C.Mountain]: ['log:pine'],
    [C.HauntedWoodlands]: ['log:oak', 'log:cherry'], [C.Swamp]: ['log:oak'], [C.Rainforest]: ['log:teak', 'log:mahogany'],
    [C.Subtropical]: ['log:cherry', 'log:teak'],
  });
  assert.deepEqual({ ...RARE_WOODS }, { [C.Rainforest]: 'log:ironwood', [C.HauntedWoodlands]: 'log:ghostwood' });
  assert.equal(RARE_WOOD_CHANCE, 1 / 20);
  assert.equal(NODE_COUNTS[C.Desert].tree, 0);
  assert.equal(tree({ x: 400, y: 200, day: 20000, slot: 0, climate: C.Desert }), null);
  let seen = new Set(), rare = 0, n = 0;
  for (let x = 100; x < 700; x++) {
    for (const t of trees({ x, y: 200, day: 20000, climate: C.Woodlands })) { seen.add(`${t.material}:${t.tier}`); assert.ok(t.u >= 0.04 && t.u <= 0.96 && t.v >= 0.04 && t.v <= 0.96); }
    // PINE-SHARE: Teak and Mahogany are past tier 2 - an unconfirmed Rainforest or Subtropical pixel stands only its Pine
    assert.ok(trees({ x, y: 200, day: 20000, climate: C.Rainforest, confirmed: false }).every((t) => t.material === 'log:pine'), 'Teak and Mahogany are past tier 2');
    assert.ok(trees({ x, y: 200, day: 20000, climate: C.Subtropical, confirmed: false }).every((t) => t.material === 'log:pine'));
    for (const t of trees({ x, y: 200, day: 20000, climate: C.Rainforest, confirmed: true })) { n++; if (t.rare) { rare++; assert.deepEqual([t.material, t.tier], ['log:ironwood', 6]); } }
    for (const t of trees({ x, y: 200, day: 20000, climate: C.HauntedWoodlands, confirmed: true })) if (t.rare) assert.equal(t.material, 'log:ghostwood');
    assert.ok(!trees({ x, y: 200, day: 20000, climate: C.HauntedWoodlands, confirmed: false }).some((t) => t.rare), 'no rare wood unconfirmed');
  }
  assert.deepEqual([...seen].sort(), ['log:oak:2', 'log:pine:1'], 'an unconfirmed Woodlands pixel: Oak (Cherry is tier 3), and PINE-SHARE\'s Pine');
  assert.ok(rare > n * 0.02 && rare < n * 0.09, `about one in twenty (${rare} of ${n})`);
  assert.equal(trees({ x: 400, y: 200, day: 20000, climate: C.Woodlands }).length, NODE_COUNTS[C.Woodlands].tree);
  assert.equal(tree({ x: 400, y: 200, day: 20000, slot: NODE_COUNTS[C.Woodlands].tree, climate: C.Woodlands }), null, 'past the day\'s count');
  const conf = new Set();
  for (let x = 100; x < 400; x++) for (const t of trees({ x, y: 200, day: 20000, climate: C.Woodlands, confirmed: true })) conf.add(t.material);
  assert.deepEqual([...conf].sort(), ['log:cherry', 'log:oak', 'log:pine'], 'confirmed: the whole table, and PINE-SHARE\'s Pine');
});

test('PROF4 law: a tree yields 2-4 logs (a march +25%, the fraction a chance); Resin one tree in four, any ground; Heartwood 2% a Clean Cut, a Forester\'s twice, one at most, confirmed ground only; the chops 5, 6, 8 by tier (a Lumberjack two fewer, three at least); the ring\'s band 12% to 20% x the Wood-Axe\'s, its (INT + STR) / 2', () => {
  assert.deepEqual([...TREE_YIELD], [2, 4]);
  assert.deepEqual([treeYield({ roll: 2 }, 0.99), treeYield({ roll: 4, march: true }, 0), treeYield({ roll: 3, march: true }, 0.99), treeYield({ roll: 3, march: true }, 0.7)], [2, 5, 3, 4], 'four in a march are five; three are 3.75 - a three-in-four chance of the fourth');
  assert.deepEqual([RESIN_CHANCE, HEARTWOOD_CHANCE, FORESTER_MULT], [0.25, 0.02, 2]);
  const seq = (arr) => { let i = 0; return () => arr[i++] ?? 0.99; };
  assert.deepEqual(treeFinds({ cuts: 3, confirmed: true }, seq([0.24, 0.5, 0.019])), { resin: 'wood:resin', heartwood: 'wood:heartwood' });
  assert.deepEqual(treeFinds({ cuts: 3, confirmed: true }, seq([0.25, 0.021, 0.03, 0.5])), { resin: null, heartwood: null });
  assert.deepEqual(treeFinds({ cuts: 1, confirmed: true, forester: true }, seq([0.9, 0.039])), { resin: null, heartwood: 'wood:heartwood' });
  assert.deepEqual(treeFinds({ cuts: 3, confirmed: false }, seq([0.1, 0, 0, 0])), { resin: 'wood:resin', heartwood: null }, 'none unconfirmed');
  assert.deepEqual(treeFinds({ cuts: 0, confirmed: true }, seq([0.9, 0])), { resin: null, heartwood: null }, 'no cut, none');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((t) => chopsFor(t)), [5, 5, 6, 6, 8, 8]);
  assert.deepEqual([1, 3, 5].map((t) => chopsFor(t, true)), [3, 4, 6]);
  assert.deepEqual([1, 2, 5].map((t) => cutsMax(t)), [3, 3, 4]);
  assert.deepEqual({ ...CHOP_ACT }, { ringS: 0.9, ringFrom: 3, ringTo: 0.5, bandNovice: 0.12, bandMaster: 0.2, swingS: 0.45, creakAt: 0.5 });
  assert.deepEqual([ringBand(0), ringBand(100), ringBand(50), ringBand(200), ringBand(0, 1.3)].map((x) => Math.round(x * 1000) / 1000), [0.12, 0.2, 0.16, 0.2, 0.156]);
  assert.equal(woodAxeBand({ intelligence: 80, strength: 80 }), 1.3);
  assert.equal(woodAxeBand({ intelligence: 30, strength: 45 }), 0.85, '(30 + 45) / 2 = 37, the lowest band');
  assert.equal(woodAxeBand({ intelligence: 30, strength: 100 }), woodAxeBand({ intelligence: 65, strength: 65 }), 'the pair\'s mean, STR its half');
  assert.notEqual(woodAxeBand({ intelligence: 30, strength: 100 }), 0.85);
});

test('PROF4 law: the forge burns a log to a Charcoal (a Charcoal Burner two) and the workbench saws one to two planks (a Timberwright three), no XP; a smelt\'s ingot a Quartermaster\'s two, Brass never; the fees; the furnisher\'s Linen at 2 Marks; Cured Leather, Linen and Bear Hide have no pack form - the woods do', () => {
  assert.deepEqual(BURN_RECIPES.map((r) => [r.id, r.out, r.inputs[0].key, r.station, r.per, r.xp]), WOODS.map((w) => [`burn:${w.id}`, 'wood:charcoal', `log:${w.id}`, 'forge', 1, null]));
  assert.deepEqual(SAW_RECIPES.map((r) => [r.id, r.out, r.inputs[0].key, r.station, r.per, r.xp]), WOODS.map((w) => [`saw:${w.id}`, `plank:${w.id}`, `log:${w.id}`, 'workbench', 2, null]));
  assert.equal(WORK_RECIPES.length, SMELT_RECIPES.length + 14 + 9 + 2 + 4);   // PIN MOVED (PROF12): the Transmuter's four   // PROF7 moved it: the loom's eight cures and its weave after them; PIN MOVED (PROF11): the mason's bench's cut and mix after them
  assert.deepEqual([workPer(smeltRecipe('burn:oak'), { logging: 'charcoal-burner' }), workPer(smeltRecipe('burn:oak'), { logging: 'timberwright' }), workPer(smeltRecipe('burn:oak'), {})], [2, 1, 1]);
  assert.deepEqual([workPer(smeltRecipe('saw:oak'), { logging: 'timberwright' }), workPer(smeltRecipe('saw:oak'), { smithing: 'timberwright' }), workPer(smeltRecipe('saw:oak'))], [3, 2, 2]);
  assert.deepEqual([workPer(smeltRecipe('ingot:iron'), { smithing: 'quartermaster' }), workPer(smeltRecipe('metal:brass'), { smithing: 'quartermaster' }), smeltRecipe('ingot:iron').xp], [2, 1, 'smithing']);
  assert.deepEqual([WORKBENCH_FEE, FORGE_FEE], [50, 50]);
  assert.deepEqual(FURNISHER_STOCK.map((x) => [x.key, x.marks, x.counter]), [['cloth:linen', 2, 'furnisher']]);
  assert.ok(SMITH_STOCK.every((x) => x.counter === 'smith'));
  assert.deepEqual(STOCKS.map((x) => x.key).slice(0, 7), ['leather:cured', 'plank:oak', 'plank:pine', 'wood:charcoal', 'cloth:linen', 'cloth:linen', 'cloth:wool']);   // PROF5: the Weavers' counter's two after them; PIN MOVED (PROF12): the Apothecaries' sixteen after those
  assert.equal(stockOf('cloth:linen').counter, 'furnisher');
  assert.deepEqual([...NO_PACK_FORM], ['work:ram', 'essence:arcane']);   // AUDIT PROF12 E1 (PIN MOVED): Arcane Essence the Stores'; PROF5: Wool Bolt beside the Linen; PROF7 moved it: every one has its template now; SEAT2b part two (PIN MOVED): a Ram Kit's road is the writ's
  assert.deepEqual(['leather:cured', 'cloth:linen', 'hide:bear', 'plank:oak', 'log:teak', 'wood:charcoal', 'ingot:iron'].map(withdrawable), [true, true, true, true, true, true, true]);
});

test('PROF4 law: Carpentry\'s recipes (9.3) - staves 3 planks, short bows 3 and a Resin, long bows 4 and a Resin at every wood, their DFU material the wood\'s tier\'s; arrows twenty of a Pine Plank, an Iron Ingot and 4 Twigs (either land\'s); the tables 6 and 3, the chairs 2, the beds 8 and 2 Linen by DFU\'s rarity; the Basket; the Ram Kit named and never made', () => {
  assert.equal(CARPENTRY_RECIPES.length, 21 + 2 + 1 + 12 + 4 + 1 + 1);   // PROF7 moved it: the Harpy-feathered arrows
  assert.equal(RECIPES.length, SMITH_RECIPES.length + CARPENTRY_RECIPES.length + OUTFITTING_RECIPES.length + 4 + 7 + 120);   // PROF7: the loom's; PIN MOVED (PROF11): the Sculptor's four stone pieces; PIN MOVED (PROF9): the fire's seven dishes; PIN MOVED (PROF10): the jeweller's 120 pieces
  assert.ok(CARPENTRY_RECIPES.every((r) => r.profession === 'carpentry' && r.metal === null));
  assert.deepEqual({ ...WOOD_MATERIAL }, { pine: 0, oak: 1, cherry: 2, teak: 3, mahogany: 5, ironwood: 6, ghostwood: 7 });
  const ins = (id) => recipeById(id).inputs.map((i) => `${i.n} ${i.key}`).join(' + ');
  assert.deepEqual(['staff:teak', 'shortbow:oak', 'longbow:ghostwood'].map(ins), ['3 plank:teak', '3 plank:oak + 1 wood:resin', '4 plank:ghostwood + 1 wood:resin']);
  assert.deepEqual(['staff:pine', 'shortbow:mahogany', 'longbow:ironwood'].map((id) => { const r = recipeById(id); return [r.templateIndex, r.material, r.tier, r.rank, r.family]; }), [[115, 0, 1, 0, 'staves'], [129, 5, 5, 55, 'bows'], [130, 6, 6, 70, 'bows']]);
  assert.deepEqual(['arrows:north', 'arrows:south'].map(ins), ['1 plank:pine + 1 ingot:iron + 4 p1:8', '1 plank:pine + 1 ingot:iron + 4 p2:8']);
  assert.deepEqual([recipeById('arrows:north').stack, ARROWS_STACK, recipeById('arrows:north').templateIndex], [20, 20, 131]);
  assert.deepEqual(['table-large:oak', 'table-small:teak', 'chair:mahogany'].map((id) => [recipeById(id).templateIndex, ins(id), recipeById(id).tier]), [[221, '6 plank:oak', 2], [228, '3 plank:teak', 4], [231, '2 plank:mahogany', 5]]);
  assert.deepEqual(['bed-plain-single:pine', 'bed-plain-double:oak', 'bed-fancy-single:cherry', 'bed-fancy-double:teak'].map((id) => [recipeById(id).templateIndex, ins(id)]),
    [[217, '8 plank:pine + 2 cloth:linen'], [219, '8 plank:oak + 2 cloth:linen'], [218, '8 plank:cherry + 2 cloth:linen'], [220, '8 plank:teak + 2 cloth:linen']]);
  assert.deepEqual([recipeById('basket:pine').templateIndex, ins('basket:pine'), recipeById('basket:pine').kind], [1607, '2 plank:pine', 'tool']);
  const ram = recipeById('ramkit:oak');
  assert.deepEqual([ram.templateIndex, ram.rank, RAM_KIT_RANK, ins('ramkit:oak'), ram.later], [690, 60, 60, '40 plank:oak + 20 ingot:iron + 4 hide:bear', undefined]);   // SEAT2b part two (PIN MOVED): made with the sieges
  assert.equal(recipeOpen(ram, 100), true, 'made since SEAT2b part two (PIN MOVED: named, never made until the sieges)');
  assert.equal(recipeOpen(ram, 59), false, 'at Carpentry 60');
  assert.equal(recipeOpen(recipeById('chair:oak'), 10), true);
  assert.equal(recipeOpen(recipeById('chair:oak'), 9), false);
  assert.ok(SMITH_RECIPES.every((r) => r.profession === 'smithing'));
});

test('PROF4 law: what a craft spends - a Joiner\'s furniture at half the planks (rounded up), a Heartwood for one plank where the recipe asks one and takes a quality; the steps (Bowyer the bows; a Heartwood or a Warforged ingot, one between them); arrows and the Ram Kit take no quality; a Master Joiner\'s mark on furniture at any quality', () => {
  const sp = (id, o) => recipeInputs(recipeById(id), o).map((i) => `${i.n} ${i.key}`).join(' + ');
  assert.deepEqual([sp('table-large:oak', {}), sp('table-large:oak', { joiner: true }), sp('table-small:oak', { joiner: true }), sp('staff:oak', { joiner: true })], ['6 plank:oak', '3 plank:oak', '2 plank:oak', '3 plank:oak'], 'half, up; a staff is no furniture');
  assert.deepEqual([sp('chair:oak', { heartwood: true }), sp('table-small:oak', { heartwood: true, joiner: true }), sp('basket:pine', { heartwood: true }), sp('warhammer:iron', { heartwood: true })],
    ['1 plank:oak + 1 wood:heartwood', '1 plank:oak + 1 wood:heartwood', '1 plank:pine + 1 wood:heartwood', '4 ingot:iron + 1 metal:copper + 1 wood:heartwood']);
  assert.deepEqual([sp('arrows:north', { heartwood: true }), sp('longsword:iron', { heartwood: true })], ['1 plank:pine + 1 ingot:iron + 4 p1:8', '3 ingot:iron + 1 metal:copper + 1 leather:cured'], 'arrows take no quality, a longsword asks no plank');
  assert.deepEqual(['chair:oak', 'arrows:north', 'ramkit:oak', 'longsword:iron', 'shortbow:oak'].map((id) => takesHeartwood(recipeById(id))), [true, false, false, false, true]);
  assert.deepEqual(['arrows:north', 'ramkit:oak', 'kit:iron', 'chair:oak', 'staff:oak'].map((id) => takesQuality(recipeById(id))), [false, false, false, true, true]);
  const r = (id) => recipeById(id);
  assert.deepEqual([qualitySteps(r('shortbow:oak'), { spec50: 'bowyer' }), qualitySteps(r('staff:oak'), { spec50: 'bowyer' }), qualitySteps(r('chair:oak'), { heartwood: true, clean: true }), qualitySteps(r('warhammer:warforged'), { heartwood: true }), qualitySteps(r('longsword:iron'), { heartwood: true })], [1, 0, 2, 1, 0]);
  assert.deepEqual([carriesMark(r('chair:oak'), 1, 'master-joiner'), carriesMark(r('staff:oak'), 1, 'master-joiner'), carriesMark(r('chair:oak'), 1, null), carriesMark(r('staff:oak'), MASTERWORK, null)], [true, false, false, true]);
  assert.equal(craftCount(r('arrows:north'), 'quartermaster'), 1);
  assert.equal(specOk('carpentry', 100, 'siegewright'), true, 'the sieges\' choice, chosen since SEAT2b part two (PIN MOVED: it waited for them)');
  assert.equal(SPECIALISATIONS.building[100][0].id, 'siegewright');   // PIN MOVED (CRAFT3): SPECIALISATIONS is keyed by track - Carpentry's choices stand first under Building
  assert.equal(SPECIALISATIONS.building[100][0].later, undefined, 'SEAT2b part two (PIN MOVED): the Siegewright chosen since');   // PIN MOVED (CRAFT3): Building's, Carpentry's craft
  assert.equal(specOk('building', 100, 'siegewright'), true, 'a discipline\'s choice is its craft\'s track\'s');   // PIN MOVED (CRAFT3): specOk maps 'carpentry' through trackOf to Building
  assert.equal(specOk('carpentry', 100, 'master-joiner'), true);
});

test('PROF4 law: the plane (9.4) - a board\'s grain a wave its own each act, pressed at its head and drawn to its foot; the tolerance 18% of the half-height, x Carpentry\'s band ((AGI + WIL) / 2), wider by half at Master; 1.2 to 4 seconds a pass', () => {
  assert.deepEqual({ ...PLANE_ACT }, { tol: 0.18, masterWiden: 0.5, minS: 1.2, maxS: 4, headX: 0.08, footX: 0.98, waveA: 0.35, waves: 1.5, step: 0.025 });   // AUDIT 30 A1: `step`
  assert.deepEqual([planeTolerance(0), planeTolerance(100), planeTolerance(100, 1.3)].map((x) => Math.round(x * 1000) / 1000), [0.18, 0.27, 0.351]);
  assert.equal(planeBand({ agility: 80, willpower: 80 }), 1.3);
  assert.equal(planeBand({ agility: 80, willpower: 20 }), 1, '(80 + 20) / 2 = 50');
  assert.equal(Math.round(grainAt(0, 0.25) * 1000) / 1000, 0.35, 'the wave\'s crest');
  assert.equal(Math.round(grainAt(1 / 3, 0) * 1000) / 1000, 0);
});

test('PROF4 law: a crafted piece\'s record takes the workbench\'s recipes (arrows -1); a home\'s descriptor carries a provenance id and, with it, a mark - a mark alone, or one out of shape, is nothing; the Court asks the ground\'s logs', async () => {
  const at = { subtle: globalThis.crypto.subtle, nowS: 1 };
  const rec = await mintProductRecord({ p: '0123456789abcdef', s: 'acct-aaaaaaaaaa', h: 'char-aldric', r: 'arrows:north', q: -1, m: 'Ann', c: 7 }, null, at);
  assert.equal(readProductRecord(rec).q, -1);
  await assert.rejects(mintProductRecord({ p: '0123456789abcdef', s: 'acct-aaaaaaaaaa', h: 'char-aldric', r: 'arrows:north', q: 2, m: 'Ann', c: 7 }, null, at), 'arrows at a quality');
  assert.equal(readProductRecord(await mintProductRecord({ p: '0123456789abcdef', s: 'acct-aaaaaaaaaa', h: 'char-aldric', r: 'table-small:oak', q: 4, m: 'Ann', c: 7 }, null, at)).r, 'table-small:oak');
  assert.deepEqual(decorItemOf({ t: 225, g: 8, pv: '0123456789abcdef', mk: 'Ann' }), { t: 225, g: 8, m: null, v: null, a: null, p: null, pv: '0123456789abcdef', mk: 'Ann' });
  assert.deepEqual(decorItemOf({ t: 225, g: 8, mk: 'Ann' }), { t: 225, g: 8, m: null, v: null, a: null, p: null }, 'a mark with no id is dropped');
  assert.deepEqual(decorItemOf({ t: 225, g: 8 }), { t: 225, g: 8, m: null, v: null, a: null, p: null }, 'a plain piece as it always was');
  assert.equal(decorItemOf({ t: 225, pv: 'XYZ' }), null);
  assert.equal(decorItemOf({ t: 225, pv: '0123456789abcdef', mk: ' Ann ' }), null, 'a mark not as the maker\'s name keeps it');
  assert.equal(decorItemOf({ t: 225, pv: '0123456789abcdef', mk: 'x'.repeat(33) }), null);
  const woods = regionWritTable(17, [{ climate: CLIMATES.Woodlands, confirmed: false }], SEASONS.Summer).map((m) => m.material).filter((k) => k.startsWith('log:'));
  assert.deepEqual(woods, ['log:oak', 'log:pine'], 'an unconfirmed Woodlands pixel: its Oak, and PINE-SHARE\'s Pine');
  const haunted = (confirmed) => regionWritTable(17, [{ climate: CLIMATES.HauntedWoodlands, confirmed }], SEASONS.Summer).map((m) => m.material).filter((k) => k.startsWith('log:'));
  assert.deepEqual([haunted(false).includes('log:ghostwood'), haunted(true).includes('log:ghostwood')], [false, true], 'the rare wood is confirmed ground\'s alone');
  const conf = regionWritTable(17, [{ climate: CLIMATES.Rainforest, confirmed: true }], SEASONS.Summer).map((m) => m.material).filter((k) => k.startsWith('log:') || k.startsWith('plank:') || k.startsWith('wood:'));
  assert.deepEqual(conf, ['log:ironwood', 'log:mahogany', 'log:pine', 'log:teak'], 'confirmed: its woods, its rare wood and PINE-SHARE\'s Pine - never a plank, Charcoal, Resin or Heartwood');
  assert.deepEqual(regionWritTable(17, [{ climate: CLIMATES.Desert, confirmed: true }], SEASONS.Summer).filter((m) => m.material.startsWith('log:')), [], 'the Desert grows no tree');
});
