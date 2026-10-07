// PROF11 (2026-10-01) - MASONRY'S LAW (src/net/professionLaw.js, recipeLaw.js, marketLaw.js, decorLaw.js, writLaw.js;
// systems/chiselAct.js, profTemplates.js): Mortar (675) registered beside the stone; the mason's bench's two works - the
// cut (Rough Stone 2 : 1, a Quarryman's 1 : 1) and the mix (Mortar ten at a time) - with a craft's law (their rank, their
// XP at the rank's own tier, the clean chisel's half again, the first time's 500); the bench's fee and its home station;
// the specialisations (the Quarryman's and the Sculptor's the bench's; the Builder's and the Fortifier's named for SEAT2b,
// their helpers pinned here); the Sculptor's four stone pieces (696-699) and their one DFU model each; the chisel's
// numbers and its machine. bible/06-Systems/Professions-Arc.md 3.2, 3.3, 4.5, 4.8, 9.3, 9.4.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MORTAR, ROUGH_STONE, CUT_STONE, STONES, MASONRY_TEMPLATES, ICON_LODESTONE, MINED_KEYS, materialOf, minedMaterial, withdrawable,
  TIER_VALUES, MASON_FEE, FORGE_FEE, WORKBENCH_FEE, LOOM_FEE, MASON_RECIPES, MORTAR_BATCH, WORK_RECIPES, smeltRecipe, workPer,
  workSpecRank, workOpen, CUT_RATIO, SPECIALISATIONS, specOk, specOf, topTierOf, TIER_RANKS, BUILDER_STONE_OFF_PCT, isBuilder,
  fortificationStone, fortificationNeeds, FORTIFIER_SAVES_A_SEASON, FORTIFIER_WORK, isFortifier, fortifierReady, wallsOnCapture,
  actBand, professionOfFamily, craftXpCap, xpForRank, SMELT_RECIPES, PROF_RANK_MAX, smeltOrigin,
} from '../src/net/professionLaw.js';
import {
  STONE_DECOR, STONE_DECOR_TEMPLATES, stoneDecorModel, MASONRY_RECIPES, SCULPTOR, RECIPES, recipeById, recipeOpen, takesQuality,
  qualitySteps, carriesMark, recipeInputs, firstCraftPays, MASTERWORK, CRAFT_XP_PER_TIER, FIRST_CRAFT_XP, craftXp, masonXp, masonTier,
  CHISEL_ACT, chiselBand, chiselStrikes, chiselMarkS, takesHeartwood, craftCount, qualityOdds,
} from '../src/net/recipeLaw.js';
import { CRAFTED_FAMILIES, pieceListable, marketCatalogue, UNYIELDED } from '../src/net/marketLaw.js';
import { commissionable, commissionTakesQuality } from '../src/net/writLaw.js';
import { DECOR_STATIONS, DECOR_STATION_FEES, DECOR_STATION_NAMES, decorPlaceOf, decorPieceOf, decorWhatOf, DECOR_FURNITURE_GROUP } from '../src/net/decorLaw.js';
import { createChiselAct } from '../src/systems/chiselAct.js';
import { PRESS_LEAD_MAX_S } from '../src/systems/stitchAct.js';
import { MASONRY_TEMPLATE_ROWS, STONE_DECOR_ROWS } from '../src/systems/profTemplates.js';

/** A steered die: the throws in turn, then the last again. */
const dice = (...throws) => { let i = 0; return () => throws[Math.min(i++, throws.length - 1)]; };

// ─── MORTAR (4.5, 4.8) ───────────────────────────────────────────────

test('PROF11 law: Mortar is 675 - the stone family, tier 2, worth 2 Marks, Lodestone\'s grey lump undyed as Rough and Cut Stone are (4.8: "DFU Lodestone, greyed"); a Stores material the market knows and the pack takes; its row 1 kg and 2 gold, stacking, never shelved', () => {
  assert.deepEqual([MORTAR.key, MORTAR.family, MORTAR.tier, MORTAR.templateIndex, MORTAR.name, MORTAR.icon, MORTAR.dye], ['stone:mortar', 'stone', 2, 675, 'Mortar', ICON_LODESTONE, null]);
  assert.deepEqual(STONES.map((s) => [s.key, s.templateIndex, s.tier, s.icon, s.dye]), [['stone:rough', 673, 1, ICON_LODESTONE, null], ['stone:cut', 674, 2, ICON_LODESTONE, null]], 'the stone 673-674 as PROF2 left it');
  assert.deepEqual([ROUGH_STONE, CUT_STONE], STONES);
  assert.deepEqual(MASONRY_TEMPLATES, [MORTAR]);
  assert.deepEqual(materialOf('stone:mortar', () => null), { key: 'stone:mortar', family: 'stone', tier: 2, value: 2, templateIndex: 675 });
  assert.equal(TIER_VALUES[MORTAR.tier - 1], 2, '4.5: Mortar tier 2 (2)');
  assert.equal(minedMaterial('stone:mortar'), MORTAR);
  assert.ok(MINED_KEYS.includes('stone:mortar'), 'the registry, the market\'s catalogue');
  assert.deepEqual(MINED_KEYS.slice(-19, -17), ['stone:mortar', 'work:ram'], 'registered last - no key before it moved (SEAT2b part two\'s Ram Kit after it - PIN MOVED; PROF12\'s sixteen reagents and Arcane Essence after them - PIN MOVED)');
  assert.equal(withdrawable('stone:mortar'), true);
  assert.ok(marketCatalogue().some((m) => m.key === 'stone:mortar'), 'listed on the Materials view');
  assert.equal(UNYIELDED.includes('stone:mortar'), false, 'the bench yields it');
  assert.equal(professionOfFamily('stone'), 'mining', 'a stone writ is Mining\'s still');
  assert.deepEqual(MASONRY_TEMPLATE_ROWS.map((r) => [r.index, r.name, r.baseWeight, r.basePrice, r.rarity, r.stackable, r.worldTextureArchive, r.worldTextureRecord, r.iconDye]),
    [[675, 'Mortar', 1, 2, 10, true, 254, 66, undefined]]);
});

// ─── THE MASON'S BENCH (9.3) ─────────────────────────────────────────

test('PROF11 law: the mason\'s bench\'s works (4.5) - the cut, two Rough Stone a Cut Stone (a Quarryman\'s two, a choice read at 50), tier 1 at rank 0; the mix, a Sulphur, a Lead and five Rough Stone to ten Mortar, tier 2 at rank 10; each Masonry\'s, the chisel its act; the forge\'s works ask no rank; the fee 50 a cut, a mix or a carving, as every station\'s', () => {
  assert.deepEqual(MASON_RECIPES.map((r) => [r.id, r.out, r.inputs.map((i) => `${i.n} ${i.key}`).join(), r.station, r.per, r.more, r.xp, r.tier, r.rank, r.act]), [
    ['cut:stone', 'stone:cut', '2 stone:rough', 'mason', 1, { profession: 'masonry', spec: 'quarryman', per: 2, rank: 50 }, 'masonry', 1, 0, 'chisel'],
    ['mix:mortar', 'stone:mortar', '1 metal:sulphur,1 metal:lead,5 stone:rough', 'mason', 10, null, 'masonry', 2, 10, 'chisel'],
  ]);
  assert.equal(MORTAR_BATCH, 10, '4.5: "ten at a time"');
  assert.equal(CUT_RATIO, 2, 'the cut at the rock stays 2 : 1 (PROF0 23) - the bench cuts at the same');
  assert.deepEqual(WORK_RECIPES.slice(-6, -4), [...MASON_RECIPES], 'the works after the loom\'s (PIN MOVED (PROF12): the Transmuter\'s four after them)');
  assert.equal(smeltRecipe('cut:stone'), MASON_RECIPES[0]);
  assert.equal(smeltRecipe('mix:mortar'), MASON_RECIPES[1]);
  // the Quarryman (3.3): "Rough Stone cuts 1:1, not 2:1" - a choice at 50
  const [cut, mix] = MASON_RECIPES;
  assert.equal(workSpecRank(cut), 50);
  assert.deepEqual([workPer(cut), workPer(cut, { masonry: 'quarryman' }), workPer(cut, { masonry: 'builder' }), workPer(mix, { masonry: 'quarryman' })], [1, 2, 1, 10]);
  assert.deepEqual(smeltOrigin(cut, 3, [4]), { own: 1, bought: 2 }, 'a cut is bought where its Rough Stone was');
  // the ranks: the cut a Novice's, the mix rank 10's; the forge's works ask none
  assert.deepEqual([workOpen(cut, 0), workOpen(mix, 0), workOpen(mix, 9), workOpen(mix, 10), workOpen(null, 100)], [true, false, false, true, false]);
  assert.ok(SMELT_RECIPES.every((r) => workOpen(r, 0)), 'a smelt asks no rank');
  assert.equal(workOpen(smeltRecipe('saw:pine'), 0), true);
  assert.deepEqual([MASON_FEE, FORGE_FEE, WORKBENCH_FEE, LOOM_FEE], [50, 50, 50, 50]);
  // the home's mason's bench: a seventh station at the loom's licence
  assert.deepEqual([DECOR_STATIONS.at(-3), DECOR_STATION_FEES.mason, DECOR_STATION_NAMES.mason], ['mason', 50_000, 'Mason\'s bench']);   // PIN MOVED (PROF10): the jeweller's bench an eighth after it; PIN MOVED (HOME-VENDOR): the hired trader a ninth
  assert.equal(decorPlaceOf({ pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, paid: 120, station: 'mason' })?.station, 'mason');
  assert.equal(decorPlaceOf({ pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, paid: 120, station: 'mason', storage: true }), null, 'one thing a piece does');
});

// ─── THE XP (3.2) ────────────────────────────────────────────────────

test('PROF11 law: the bench\'s XP - 20 a tier a unit of work at the RANK\'s own tier (XP follows the rank: the stone is tiers 1-2, and at its own tier a quarter would hold Masonry from 40), half again for a clean chisel (the Stores keep no quality - Mining\'s clean act at the rock), 500 the first time; a Quarryman\'s second Cut Stone earns nothing more', () => {
  assert.equal(CRAFT_XP_PER_TIER, 20);
  assert.equal(FIRST_CRAFT_XP, 500);
  for (const rank of [0, 9, 10, 24, 25, 40, 55, 70, 89, 90, 99, 100]) {
    assert.equal(masonTier(rank), topTierOf(rank), `rank ${rank}`);
    assert.equal(masonXp(3, rank), 20 * topTierOf(rank) * 3, `rank ${rank}: never quartered`);
  }
  assert.deepEqual([masonTier(0), masonTier(10), masonTier(25), masonTier(40), masonTier(55), masonTier(70), masonTier(90), masonTier(100)], [1, 2, 3, 4, 5, 6, 7, 7]);
  assert.equal(craftXp(1, 55, false), 5, 'the craft\'s own law would quarter Cut Stone\'s tier at 55 - the bench\'s does not');
  assert.equal(masonXp(5, 0), 100);
  assert.equal(masonXp(5, 0, { clean: true }), 150, 'a clean chisel half again');
  assert.equal(masonXp(1, 0, { clean: true }), 30);
  assert.equal(masonXp(1, 10, { clean: true }), 60);
  assert.equal(masonXp(1, 25, { clean: true }), 90);
  assert.equal(masonXp(5, 0, { first: true }), 600, 'the first time\'s 500 on top');
  assert.equal(masonXp(5, 0, { clean: true, first: true }), 650, 'the 500 is no part of the half again');
  assert.equal(masonXp(100, 90), 14_000, 'a full press at the top tier');
  for (const bad of [0, -2, 1.5, NaN, '3', null]) assert.equal(masonXp(bad, 50, { clean: true }), 0, String(bad));
  assert.equal(masonXp(0, 0, { first: true }), 500);
  assert.equal(firstCraftPays(MASON_RECIPES[0]), true, 'quarried stone is the world\'s, never a counter\'s');
  assert.equal(firstCraftPays(MASON_RECIPES[1]), true);
  // the crafter's limit stands over Masonry as over every craft
  assert.equal(craftXpCap('masonry', { smithing: 60, provisioning: 70 }), xpForRank(51) - 1);   // PIN MOVED (CRAFT3): Carpentry is Building's with Masonry now - the two other crafts past 50 are tracks (Smithing, Provisioning)
  assert.equal(craftXpCap('masonry', { building: 70, smithing: 60 }), xpForRank(PROF_RANK_MAX), 'Masonry raises Building - its own track is none of the two');   // PIN MOVED (CRAFT3): the ranks are the tracks'
  assert.equal(craftXpCap('masonry', { smithing: 60, mining: 90 }), xpForRank(PROF_RANK_MAX));
});

// ─── THE SPECIALISATIONS (3.3) ───────────────────────────────────────

test('PROF11 law: Masonry\'s four (3.3) - the Quarryman (50) and the Sculptor (100) chosen now, the bench\'s; the Builder (50) and the Fortifier (100) chosen since SEAT2b built the fortifications they act on (AUDIT 29 A17, the Siegewright\'s law, until then)', () => {
  // PIN MOVED (CRAFT3): Masonry's choices stand under the Building track, after Carpentry's two - four a rank, one chosen
  assert.deepEqual(SPECIALISATIONS.building[50].map((s) => [s.id, s.name, s.text, s.later ?? null]), [
    ['bowyer', 'Bowyer', 'Bows +1 quality step (arrows take none).', null], ['joiner', 'Joiner', 'Furniture at half the planks.', null],
    ['quarryman', 'Quarryman', 'Rough Stone cuts 1:1, not 2:1.', null], ['builder', 'Builder', 'Fortification projects need 10% less stone.', null],   // PIN MOVED (SEAT2b): chosen now
  ]);
  assert.deepEqual(SPECIALISATIONS.building[100].map((s) => [s.id, s.name, s.text, s.later ?? null]), [
    ['siegewright', 'Siegewright', 'Rams +50% vitality; siege works a day sooner.', null], ['master-joiner', 'Master Joiner', 'Furniture carries the maker\'s mark.', null],
    ['fortifier', 'Fortifier', 'Once a Season a seat\'s Walls skip their drop on capture.', null], ['sculptor', 'Sculptor', 'Stone decor pieces.', null],   // PIN MOVED (SEAT2b)
  ]);
  assert.equal(SPECIALISATIONS.masonry, undefined, 'no track of its own');   // PIN MOVED (CRAFT3): a discipline, not a track
  assert.deepEqual([specOk('masonry', 50, 'quarryman'), specOk('masonry', 50, 'builder'), specOk('masonry', 100, 'fortifier'), specOk('masonry', 100, 'sculptor'), specOk('masonry', 50, 'sculptor')],
    [true, true, true, true, false]);   // PIN MOVED (SEAT2b): the Builder and the Fortifier chosen
  assert.equal(specOf('masonry', 100, 'fortifier').later, undefined);   // PIN MOVED (SEAT2b): the fortifications stand
  assert.equal(SCULPTOR, 'sculptor');
});

test('PROF11 law: THE BUILDER, for SEAT2b - a fortification project\'s stone a tenth less (rounded up, never cut past the tenth): SEAT0 7.5\'s counts exactly; every stone of the Stores\' stone family, nothing else; a fresh needs object', () => {
  assert.equal(BUILDER_STONE_OFF_PCT, 10);
  const table = [[400, 360], [800, 720], [1600, 1440], [300, 270], [600, 540], [1000, 900], [200, 180], [100, 90]];
  for (const [need, cut] of table) {
    assert.equal(fortificationStone(need, true), cut, `${need}`);
    assert.equal(fortificationStone(need), need, `${need}, no Builder`);
    assert.equal(fortificationStone(need, false), need);
  }
  assert.deepEqual([fortificationStone(1, true), fortificationStone(7, true), fortificationStone(11, true), fortificationStone(19, true)], [1, 7, 10, 18], 'rounded up');
  for (const bad of [0, -10, 2.5, NaN, '400', null]) assert.equal(fortificationStone(bad, true), 0, String(bad));
  const needs = { 'stone:cut': 1600, 'ingot:steel': 200, 'plank:oak': 100, 'stone:mortar': 50, 'stone:rough': 30 };
  const built = fortificationNeeds(needs, true);
  assert.deepEqual(built, { 'stone:cut': 1440, 'ingot:steel': 200, 'plank:oak': 100, 'stone:mortar': 45, 'stone:rough': 27 });
  assert.notEqual(built, needs);
  assert.deepEqual(needs['stone:cut'], 1600, 'the asked needs untouched');
  assert.deepEqual(fortificationNeeds(needs), needs, 'no Builder: as asked');
  assert.deepEqual(fortificationNeeds(null, true), {});
  assert.deepEqual([isBuilder({ 50: 'builder', 100: null }), isBuilder({ 50: 'quarryman' }), isBuilder(null)], [true, false, false]);
});

test('PROF11 law: THE FORTIFIER, for SEAT2b - once a Season a seat\'s Walls keep their tier at a capture (the save spent), else one tier down (SEAT0 7.5); Walls at tier 0 spend nothing; one save a Season', () => {
  assert.deepEqual([FORTIFIER_SAVES_A_SEASON, FORTIFIER_WORK], [1, 'walls']);
  assert.deepEqual([fortifierReady(0), fortifierReady(), fortifierReady(1), fortifierReady(2), fortifierReady(-1), fortifierReady(0.5), fortifierReady('0')], [true, true, false, false, true, false, false]);
  assert.deepEqual(wallsOnCapture(3), { tier: 2, saved: false }, 'no Fortifier: a tier down');
  assert.deepEqual(wallsOnCapture(3, { fortifier: true }), { tier: 3, saved: true });
  assert.deepEqual(wallsOnCapture(3, { fortifier: true, saves: 0 }), { tier: 3, saved: true });
  assert.deepEqual(wallsOnCapture(3, { fortifier: true, saves: 1 }), { tier: 2, saved: false }, 'the Season\'s save spent');
  assert.deepEqual(wallsOnCapture(1, { fortifier: false, saves: 0 }), { tier: 0, saved: false });
  assert.deepEqual(wallsOnCapture(0, { fortifier: true }), { tier: 0, saved: false }, 'no drop to skip');
  assert.deepEqual(wallsOnCapture(1, { fortifier: 'yes' }), { tier: 0, saved: false }, 'only a Fortifier that stands');
  for (const bad of [-1, 2.5, NaN, '2', null]) assert.deepEqual(wallsOnCapture(bad, { fortifier: true }), { tier: 0, saved: false }, String(bad));
  assert.deepEqual([isFortifier({ 50: null, 100: 'fortifier' }), isFortifier({ 100: 'sculptor' }), isFortifier(undefined)], [true, false, false]);
});

// ─── THE SCULPTOR'S STONE DECOR (9.3) ────────────────────────────────

test('PROF11 law: the Sculptor\'s four (9.3) - a column, a bench, a font, a statue plinth: 696-699, each its one DFU model (World of Daggerfall\'s names), its Cut Stone and Mortar, its worth and weight; Masonry\'s recipes at Cut Stone\'s tier and rank, their door the Sculptor\'s choice at 100', () => {
  assert.deepEqual(STONE_DECOR.map((d) => [d.id, d.name, d.templateIndex, d.model, d.cut, d.mortar, d.price, d.weight]), [
    ['column', 'Stone Column', 696, 62315, 12, 3, 150, 200], ['bench', 'Stone Bench', 697, 62322, 8, 2, 90, 120],
    ['font', 'Stone Font', 698, 41220, 10, 3, 120, 150], ['plinth', 'Statue Plinth', 699, 74091, 6, 2, 60, 80],
  ]);
  assert.deepEqual([...STONE_DECOR_TEMPLATES], [696, 697, 698, 699]);
  assert.deepEqual([stoneDecorModel(696), stoneDecorModel(699), stoneDecorModel(225), stoneDecorModel(undefined)], [62315, 74091, null, null]);
  assert.deepEqual(MASONRY_RECIPES.map((r) => [r.id, r.product, r.name, r.kind, r.family, r.profession, r.templateIndex, r.material, r.tier, r.rank, r.spec, r.inputs.map((i) => `${i.n} ${i.key}`).join()]), [
    ['column:stone', 'column', 'Stone Column', 'furniture', 'stonework', 'masonry', 696, 0, 2, 10, 'sculptor', '12 stone:cut,3 stone:mortar'],
    ['bench:stone', 'bench', 'Stone Bench', 'furniture', 'stonework', 'masonry', 697, 0, 2, 10, 'sculptor', '8 stone:cut,2 stone:mortar'],
    ['font:stone', 'font', 'Stone Font', 'furniture', 'stonework', 'masonry', 698, 0, 2, 10, 'sculptor', '10 stone:cut,3 stone:mortar'],
    ['plinth:stone', 'plinth', 'Statue Plinth', 'furniture', 'stonework', 'masonry', 699, 0, 2, 10, 'sculptor', '6 stone:cut,2 stone:mortar'],
  ]);
  assert.deepEqual(RECIPES.slice(-4 - 7 - 120, -7 - 120), [...MASONRY_RECIPES]);   // PIN MOVED (PROF9): the fire's seven dishes come after the Sculptor's four; PIN MOVED (PROF10): and the jeweller's 120 pieces after them
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length, 'every id its own');
  assert.equal(recipeById('font:stone'), MASONRY_RECIPES[2]);
  assert.deepEqual(STONE_DECOR_ROWS.map((r) => [r.index, r.name, r.baseWeight, r.basePrice, r.hitPoints, r.stackable, r.rarity, r.worldTextureArchive, r.worldTextureRecord]), [
    [696, 'Stone Column', 200, 150, 200, false, 10, 254, 66], [697, 'Stone Bench', 120, 90, 200, false, 10, 254, 66],
    [698, 'Stone Font', 150, 120, 200, false, 10, 254, 66], [699, 'Statue Plinth', 80, 60, 200, false, 10, 254, 66],
  ]);
  // the Sculptor's door (3.3): a Master standing as one; the rank alone opens nothing; and every other recipe as before
  const col = MASONRY_RECIPES[0];
  assert.deepEqual([recipeOpen(col, 100), recipeOpen(col, 100, { 50: null, 100: null }), recipeOpen(col, 100, { 100: 'fortifier' }), recipeOpen(col, 100, { 100: 'sculptor' }), recipeOpen(col, 9, { 100: 'sculptor' }), recipeOpen(col, 100, { 50: 'sculptor' })],
    [false, false, false, true, false, false]);
  assert.equal(recipeOpen(recipeById('dagger:iron'), 0), true, 'a recipe that asks no choice is the rank\'s alone');
  assert.equal(recipeOpen(recipeById('ramkit:oak'), 100, { 100: 'sculptor' }), true, 'the Ram Kit made since SEAT2b part two (PIN MOVED: it waited for the sieges)');
  // its quality, steps, mark: furniture's - the clean chisel a step, no family choice, the mark a Masterwork's alone
  assert.equal(takesQuality(col), true);
  assert.equal(takesHeartwood(col), false);
  assert.deepEqual([qualitySteps(col, { clean: true }), qualitySteps(col, { clean: false, spec50: 'quarryman' }), qualitySteps(col, { clean: true, spec50: 'joiner', heartwood: true })], [1, 0, 1]);
  assert.deepEqual([carriesMark(col, MASTERWORK), carriesMark(col, 3), carriesMark(col, 3, 'master-joiner'), carriesMark(col, 3, 'sculptor')], [true, false, false, false]);
  assert.deepEqual(recipeInputs(col, { joiner: true, heartwood: true }), [{ key: 'stone:cut', n: 12 }, { key: 'stone:mortar', n: 3 }], 'no Joiner\'s half, no Heartwood');
  assert.equal(craftCount(col, 'quartermaster'), 1);
  assert.equal(firstCraftPays(col), true);
  assert.deepEqual(qualityOdds(100 - col.rank), [0, 0, 40, 52, 8], 'a Master\'s margin, 90: the finest row');
  // the market lists them (Stonework) and a commission may name them
  assert.deepEqual(CRAFTED_FAMILIES.at(-3), ['stonework', 'Stonework']);   // PIN MOVED (PROF9): the fire's dishes list after it; PIN MOVED (PROF10): and the jeweller's pieces after them
  assert.deepEqual(MASONRY_RECIPES.map((r) => pieceListable(r.id)), [true, true, true, true]);
  assert.deepEqual([commissionable('column:stone'), commissionTakesQuality('plinth:stone')], [true, true]);
});

test('PROF11 law: a stone piece stands in a room as its model with its own item - DFU\'s Furniture group carried; any other group\'s item on a model is no piece', () => {
  const item = { t: 696, g: DECOR_FURNITURE_GROUP, pv: '0123456789abcdef', mk: 'Silverthorn' };
  assert.deepEqual(decorWhatOf({ model: 62315, flat: null, item }), { model: 62315, flat: null, item: { t: 696, g: 8, m: null, v: null, a: null, p: null, pv: '0123456789abcdef', mk: 'Silverthorn' } });
  assert.equal(decorWhatOf({ model: 62315, flat: null, item: { t: 696, g: 9 } }), null);
  const piece = decorPieceOf({ id: 'col1', model: 62315, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, item });
  assert.deepEqual([piece?.model, piece?.item?.t, piece?.paid], [62315, 696, 0], 'one\'s own: free');
  assert.equal(decorPieceOf({ id: 'col1', model: 62315, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, station: 'mason', item }), null, 'one\'s own item serves no craft');
});

// ─── THE CHISEL (9.4) ────────────────────────────────────────────────

test('PROF11 law: the chisel\'s numbers - five lines (the glint\'s five points), a cut\'s or a mix\'s four strikes (Mining\'s tier 1-2) and a carving\'s seven (its 5-6), the mark 1.2 s (2.0 at Master) x the band, a strike a 0.45 s swing; the band (STR + END) / 2 on Foraging\'s four', () => {
  assert.deepEqual({ ...CHISEL_ACT }, { lines: 5, strikes: 4, carveStrikes: 7, markS: 1.2, masterMarkS: 2.0, gapS: 0.45 });
  assert.deepEqual([chiselStrikes(MASON_RECIPES[0]), chiselStrikes(MASON_RECIPES[1]), chiselStrikes(MASONRY_RECIPES[3]), chiselStrikes(null), chiselStrikes(recipeById('table-small:oak'))], [4, 4, 7, 4, 4]);
  assert.deepEqual([chiselMarkS(0), chiselMarkS(99), chiselMarkS(100), chiselMarkS(100, 1.3)], [1.2, 1.2, 2.0, 2.6]);
  assert.ok(Math.abs(chiselMarkS(50, 0.85) - 1.02) < 1e-9);
  for (const [str, end] of [[30, 30], [50, 40], [80, 40], [90, 90], [100, 59]]) assert.equal(chiselBand({ strength: str, endurance: end }), actBand(Math.trunc((str + end) / 2)), `${str} ${end}`);
  assert.deepEqual([chiselBand({ strength: 30, endurance: 40 }), chiselBand({ strength: 50, endurance: 69 }), chiselBand({ strength: 80, endurance: 80 }), chiselBand({ strength: 79, endurance: 80 })], [0.85, 1.0, 1.3, 1.15]);
  assert.equal(PRESS_LEAD_MAX_S, 0.1);
});

test('PROF11 law: THE CHISEL\'S MACHINE - a line marked, moved after its time and after every strike (the glint\'s rule, never onto itself); a strike where the chisel is set true on the mark, false off it; the gap a swing; the last strike ends it; every one true clean, one off not; the press\'s own moment judged; cancelled short, never clean', () => {
  // the dice: the first mark line 1, the next line 3; then each throw in turn
  const a = createChiselAct({ rng: dice(0.25, 0.6, 0.0, 0.99, 0.5, 0.3, 0.7, 0.1) });
  assert.deepEqual([a.state.lines, a.state.need, a.state.markS, a.state.at, a.mark, a.state.next], [5, 4, 1.2, 2, 1, 3]);
  assert.equal(a.onMark, false);
  a.aim(1);
  assert.equal(a.onMark, true);
  assert.equal(a.strike(), true, 'on the mark');
  assert.notEqual(a.mark, 1, 'the mark moves after a strike');
  assert.equal(a.strike(), null, 'too soon: a mallet falls once a swing');
  a.tick(0.3);
  assert.equal(a.strike(), null, '0.3 s - still too soon');
  a.tick(0.2);
  a.aim(a.mark === 0 ? 4 : 0);   // off the mark
  assert.equal(a.strike(), false, 'off the mark');
  a.tick(0.5); a.aim(a.mark); assert.equal(a.strike(), true);
  assert.equal(a.state.done, false);
  a.tick(0.5); a.aim(a.mark); assert.equal(a.strike(), true);
  assert.equal(a.state.done, true, 'the fourth strike ends it');
  assert.deepEqual(a.report(), { strikes: 4, hits: 3, clean: false }, 'one off: not clean');
  a.tick(1); assert.equal(a.strike(), null, 'nothing after the end');
  // every strike true: clean
  const b = createChiselAct({ rng: dice(0.1, 0.3, 0.5, 0.7, 0.9, 0.2) });
  for (let i = 0; i < 4; i++) { b.tick(0.5); b.aim(b.mark); assert.equal(b.strike(), true, `strike ${i}`); }
  assert.deepEqual(b.report(), { strikes: 4, hits: 4, clean: true });
  // a carving's seven
  const c = createChiselAct({ strikes: 7, rng: dice(0.5) });
  for (let i = 0; i < 6; i++) { c.tick(0.5); c.aim(c.mark); c.strike(); }
  assert.equal(c.state.done, false);
  c.tick(0.5); c.aim(c.mark); c.strike();
  assert.deepEqual(c.report(), { strikes: 7, hits: 7, clean: true });
});

test('PROF11 law: the mark stands its time and moves on, to the line drawn for it, never the same; a press past the mark\'s end is judged against the line it moved to; the chisel set and moved within the stone; Gentle acts mark nothing and are never clean; cancelled short never clean', () => {
  const a = createChiselAct({ markS: 1.0, rng: dice(0.0, 0.0, 0.0, 0.0, 0.0) });
  assert.deepEqual([a.mark, a.state.next], [0, 1], 'one throw a line: never onto itself, even on a stuck die');
  a.tick(0.6);
  assert.equal(a.mark, 0, 'within its time');
  a.tick(0.4);
  assert.deepEqual([a.mark, a.state.next], [1, 0], 'its time out: the line drawn for it');
  assert.ok(Math.abs(a.state.markLeft - 1.0) < 1e-9);
  a.tick(2.5);
  assert.equal(a.mark, 1, 'two more marks in 2.5 s: to line 0, and back to 1');
  assert.ok(Math.abs(a.state.markLeft - 0.5) < 1e-9, 'the time over carried');
  // the press's own moment: 0.08 s past the frame, the mark had moved by then
  const b = createChiselAct({ markS: 1.0, rng: dice(0.2, 0.8, 0.5, 0.5) });
  assert.deepEqual([b.mark, b.state.next], [1, 4]);
  b.tick(0.95);
  b.aim(4);
  assert.equal(b.strike(0.08), true, 'judged on the line it moved to');
  const b2 = createChiselAct({ markS: 1.0, rng: dice(0.2, 0.8, 0.5, 0.5) });
  b2.tick(0.95); b2.aim(1);
  assert.equal(b2.strike(0.08), false, 'not the line it left');
  const b3 = createChiselAct({ markS: 1.0, rng: dice(0.2, 0.8, 0.5, 0.5) });
  b3.tick(0.95); b3.aim(1);
  assert.equal(b3.strike(0.04), true, 'a press before the end: the line it stood on');
  const b4 = createChiselAct({ markS: 1.0, rng: dice(0.2, 0.8, 0.5, 0.5) });
  b4.tick(0.85); b4.aim(1);
  assert.equal(b4.strike(5), true, 'a lead past the bound is the bound\'s tenth');
  // the chisel's line, clamped; moved
  const c = createChiselAct({ rng: dice(0.5) });
  c.aim(9); assert.equal(c.state.at, 4);
  c.aim(-3); assert.equal(c.state.at, 0);
  c.move(2); assert.equal(c.state.at, 2);
  c.move(-5); assert.equal(c.state.at, 0);
  c.aim(1.5); assert.equal(c.state.at, 0, 'a line is whole');
  c.move(0.5); assert.equal(c.state.at, 0);
  c.cancel();
  c.aim(3); assert.equal(c.state.at, 0, 'set down: nothing moves');
  assert.equal(c.strike(), null);
  assert.deepEqual(c.report(), { strikes: 0, hits: 0, clean: false });
  // cancelled short
  const d = createChiselAct({ rng: dice(0.5) });
  d.aim(d.mark); d.strike(); d.tick(0.5); d.aim(d.mark); d.strike();
  d.cancel();
  assert.deepEqual(d.report(), { strikes: 2, hits: 2, clean: false });
  // Gentle acts: no mark, every strike plain, never clean
  const g = createChiselAct({ gentle: true, rng: dice(0.5) });
  assert.deepEqual([g.mark, g.state.next, g.onMark], [-1, -1, false]);
  for (let i = 0; i < 4; i++) { g.tick(0.5); g.aim(i); assert.equal(g.strike(), false); }
  assert.equal(g.mark, -1);
  assert.deepEqual(g.report(), { strikes: 4, hits: 0, clean: false });
  // a tick of nothing moves nothing
  const h = createChiselAct({ rng: dice(0.5) });
  const before = h.state.markLeft;
  for (const dt of [0, -1, NaN, Infinity]) h.tick(dt);
  assert.equal(h.state.markLeft, before);
  assert.equal(h.state.t, 0);
});
