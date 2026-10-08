// PROF10 (2026-10-02) - JEWELCRAFTING'S LAW: DFU's eight pieces of jewellery as recipes (their templates read off DFU's
// own Jewellery enum, their inputs as 9.3 writes them, Silver, Gold and Platinum on the jeweller's ladder, a gem a recipe),
// the enchantment points the metal and the gem add, the jeweller's hand at 50 (a Goldsmith's Silver, a Gemcutter's gem)
// signed into the record, a Lapidary's Siege-cracked Gem, a Master Jeweller's Masterwork points, the facet (its numbers and
// its machine), the bench (a Pawn Shop's or a Gem Store's, 50 gold; a home's, 50,000) and the market's Jewellery.
// bible/06-Systems/Professions-Arc.md 3.3, 4.6, 9.3, 9.4, 36.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  JEWEL_METALS, JEWEL_GEMS, JEWEL_PIECES, JEWELCRAFTING_RECIPES, RECIPES, COOKING_RECIPES, recipeById, jewelBases, gemWord,
  GEMCUTTER, GOLDSMITH, MASTER_JEWELLER, LAPIDARY, GEM_POINTS, GEMCUTTER_POINTS, JEWEL_HAND_GOLDSMITH, JEWEL_HAND_GEMCUTTER,
  jewelHand, jewelHandOk, jewelPointsPct, jewelPoints, takesCracked, masterworkSpec, recipeInputs, qualityOdds, takesQuality,
  takesHeartwood, qualitySteps, craftXp, firstCraftPays, recipeOpen, craftCount, FIRST_CRAFT_XP, pieceLines,
  FACET_ACT, facetBand, facetCount, facetWindow, bearingGap, HAND_CHEF,
} from '../src/net/recipeLaw.js';
import { SPECIALISATIONS, specOk, specDiscipline, TIER_RANKS, JEWEL_FEE, MASON_FEE, GEMS, PEARL, SIEGE_GEM, ACT_BANDS, minedMaterial } from '../src/net/professionLaw.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { mintProductRecord, readProductRecord, productRecordValid } from '../src/net/productRecord.js';
import { CRAFTED_FAMILIES, pieceListable, auctionable } from '../src/net/marketLaw.js';
import { commissionable, commissionTakesQuality } from '../src/net/writLaw.js';
import { DECOR_STATIONS, DECOR_STATION_FEES, DECOR_STATION_NAMES, decorPlaceOf } from '../src/net/decorLaw.js';
import { createFacetAct } from '../src/systems/facetAct.js';
import { material } from '../src/net/nodeLaw.js';

// ─── THE PIECES (9.3) ────────────────────────────────────────────────

test('PROF10 law: DFU\'s eight pieces of jewellery, read off DFU\'s own Jewellery enum (Amulet, Bracer, Ring, Bracelet, Mark, Torc, Cloth Amulet, Wand) in 9.3\'s order - each its template\'s own name, its metal, cloth or wood as 9.3 writes it, the gem it takes; the Ring alone may go without one', () => {
  assert.deepEqual([...GROUP_TEMPLATE_INDICES.Jewellery], [133, 134, 135, 136, 137, 138, 139, 140]);
  assert.deepEqual(JEWEL_PIECES.map((p) => [p.id, p.word, p.templateIndex, p.n, p.gem, p.also.map(([k, n]) => `${n} ${k}`).join()]), [
    ['ring', 'Ring', 135, 1, 'may', ''], ['mark', 'Mark', 137, 1, 'yes', ''], ['bracelet', 'Bracelet', 136, 2, null, ''],
    ['bracer', 'Bracer', 134, 2, null, '1 leather:cured'], ['amulet', 'Amulet', 133, 2, 'yes', ''], ['torc', 'Torc', 138, 3, null, ''],
    ['clothamulet', 'Cloth Amulet', 139, 1, 'yes', ''], ['wand', 'Wand', 140, 2, 'yes', ''],
  ]);
  for (const p of JEWEL_PIECES) assert.equal(templateByIndex(p.templateIndex).name, p.word, `${p.id}: DFU's template's own name`);
  assert.deepEqual(jewelBases('ring').map((b) => [b.id, b.key, b.tier, b.points]), [['silver', 'metal:silver', 1, 0], ['gold', 'metal:gold', 3, 10], ['platinum', 'metal:platinum', 5, 20]]);
  assert.deepEqual(jewelBases('clothamulet').map((b) => [b.id, b.key, b.tier]), [['linen', 'cloth:linen', 1]]);
  assert.deepEqual(jewelBases('wand').map((b) => [b.id, b.key, b.word, b.tier]), [['ironwood', 'plank:ironwood', 'Ironwood', 6], ['ghostwood', 'plank:ghostwood', 'Ghostwood', 6]]);
  assert.deepEqual(JEWEL_METALS.map((m) => minedMaterial(m.key)?.templateIndex), [73, 74, 75], 'DFU\'s Silver, Gold and Platinum, the raw metals the Stores keep');
  // THE GEMS: DFU's eight and the sea's Pearl, each its DFU template's name
  assert.deepEqual([...JEWEL_GEMS], ['gem:ruby', 'gem:emerald', 'gem:sapphire', 'gem:diamond', 'gem:jade', 'gem:turquoise', 'gem:malachite', 'gem:amber', 'gem:pearl']);
  assert.deepEqual(JEWEL_GEMS, [...GEMS.map((g) => g.key), PEARL.key]);
  for (const g of JEWEL_GEMS) assert.equal(gemWord(g), templateByIndex(minedMaterial(g).templateIndex).name, g);
  assert.equal(JEWEL_GEMS.includes(SIEGE_GEM.key), false, 'the Siege-cracked Gem stands in for a gem - it is no recipe\'s own');
  assert.deepEqual([gemWord(null), gemWord('metal:gold')], ['', '']);
});

test('PROF10 law: the jeweller\'s bench\'s 120 recipes - each piece in each base, the plain Ring then a gem each; Silver and the Cloth Amulet at rank 0, Gold at 25, Platinum at 55, the Wand at 70; every input a Stores material; Jewelcrafting\'s, a jewel, the Jewellery family; after every other recipe', () => {
  assert.equal(JEWELCRAFTING_RECIPES.length, 120);
  const by = (product) => JEWELCRAFTING_RECIPES.filter((r) => r.product === product).length;
  assert.deepEqual(['ring', 'mark', 'bracelet', 'bracer', 'amulet', 'torc', 'clothamulet', 'wand'].map(by), [30, 27, 3, 3, 27, 3, 9, 18]);
  assert.deepEqual(JEWELCRAFTING_RECIPES.slice(0, 3).map((r) => [r.id, r.name]), [['ring:silver', 'Silver Ring'], ['ring:silver:ruby', 'Silver Ruby Ring'], ['ring:silver:emerald', 'Silver Emerald Ring']]);
  const row = (id) => { const r = recipeById(id); return [r.id, r.name, r.kind, r.family, r.profession, r.templateIndex, r.material, r.metal, r.wood, r.cloth, r.gem, r.tier, r.rank, r.inputs.map((i) => `${i.n} ${i.key}`).join()]; };
  assert.deepEqual(row('ring:gold'), ['ring:gold', 'Gold Ring', 'jewel', 'jewellery', 'jewelcrafting', 135, 0, 'metal:gold', null, null, null, 3, 25, '1 metal:gold']);
  assert.deepEqual(row('ring:platinum:pearl'), ['ring:platinum:pearl', 'Platinum Pearl Ring', 'jewel', 'jewellery', 'jewelcrafting', 135, 0, 'metal:platinum', null, null, 'gem:pearl', 5, 55, '1 metal:platinum,1 gem:pearl']);
  assert.deepEqual(row('mark:silver:jade'), ['mark:silver:jade', 'Silver Jade Mark', 'jewel', 'jewellery', 'jewelcrafting', 137, 0, 'metal:silver', null, null, 'gem:jade', 1, 0, '1 metal:silver,1 gem:jade']);
  assert.deepEqual(row('bracelet:gold'), ['bracelet:gold', 'Gold Bracelet', 'jewel', 'jewellery', 'jewelcrafting', 136, 0, 'metal:gold', null, null, null, 3, 25, '2 metal:gold']);
  assert.deepEqual(row('bracer:silver'), ['bracer:silver', 'Silver Bracer', 'jewel', 'jewellery', 'jewelcrafting', 134, 0, 'metal:silver', null, null, null, 1, 0, '2 metal:silver,1 leather:cured']);
  assert.deepEqual(row('amulet:platinum:diamond'), ['amulet:platinum:diamond', 'Platinum Diamond Amulet', 'jewel', 'jewellery', 'jewelcrafting', 133, 0, 'metal:platinum', null, null, 'gem:diamond', 5, 55, '2 metal:platinum,1 gem:diamond']);
  assert.deepEqual(row('torc:silver'), ['torc:silver', 'Silver Torc', 'jewel', 'jewellery', 'jewelcrafting', 138, 0, 'metal:silver', null, null, null, 1, 0, '3 metal:silver']);
  assert.deepEqual(row('clothamulet:linen:amber'), ['clothamulet:linen:amber', 'Amber Cloth Amulet', 'jewel', 'jewellery', 'jewelcrafting', 139, 0, null, null, 'cloth:linen', 'gem:amber', 1, 0, '1 cloth:linen,1 gem:amber']);
  assert.deepEqual(row('wand:ghostwood:ruby'), ['wand:ghostwood:ruby', 'Ghostwood Ruby Wand', 'jewel', 'jewellery', 'jewelcrafting', 140, 0, null, 'plank:ghostwood', null, 'gem:ruby', 6, 70, '2 plank:ghostwood,1 gem:ruby']);
  assert.deepEqual([recipeById('bracelet:gold:ruby'), recipeById('mark:gold'), recipeById('clothamulet:linen'), recipeById('wand:oak:ruby')], [null, null, null, null], 'a gem only where the piece takes one, and only 9.3\'s bases');
  assert.deepEqual([TIER_RANKS[0], TIER_RANKS[2], TIER_RANKS[4], TIER_RANKS[5]], [0, 25, 55, 70]);
  for (const r of JEWELCRAFTING_RECIPES) for (const i of r.inputs) assert.ok(material(i.key), `${r.id}: ${i.key} a Stores material`);
  assert.deepEqual(RECIPES.slice(-120), [...JEWELCRAFTING_RECIPES]);
  assert.deepEqual(RECIPES.slice(-127, -120), [...COOKING_RECIPES]);
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length, 'every id its own');
  assert.deepEqual([recipeOpen(recipeById('ring:gold'), 24), recipeOpen(recipeById('ring:gold'), 25), recipeOpen(recipeById('torc:platinum'), 54), recipeOpen(recipeById('torc:platinum'), 55),
    recipeOpen(recipeById('wand:ironwood:jade'), 69), recipeOpen(recipeById('wand:ironwood:jade'), 70), recipeOpen(recipeById('clothamulet:linen:jade'), 0)], [false, true, false, true, false, true, true]);
  assert.ok(JEWELCRAFTING_RECIPES.every((r) => firstCraftPays(r)), 'a gathered metal or gem in every one: the first time\'s 500 pays (the Cloth Amulet\'s gem)');
  assert.deepEqual([craftXp(1, 0, false), craftXp(3, 25, true), craftXp(1, 40, false), craftXp(5, 100, false)], [20, 60 + FIRST_CRAFT_XP, 5, 100], 'a craft\'s XP by its tier (3.2) - the ladder\'s first quartered from 40');
});

test('PROF10 law: a piece of jewellery takes a quality and lists among the Jewellery (commissioned at a quality; a Masterwork to auction); one piece a craft; a Wand takes a Heartwood for a plank, its step; no family step for a jeweller', () => {
  for (const r of JEWELCRAFTING_RECIPES) {
    assert.equal(takesQuality(r), true, r.id);
    assert.deepEqual([pieceListable(r.id), commissionable(r.id), commissionTakesQuality(r.id), auctionable(r.id, 4), auctionable(r.id, 3)], [true, true, true, true, false], r.id);
    assert.equal(craftCount(r, 'quartermaster', 'cook'), 1);
  }
  assert.deepEqual(CRAFTED_FAMILIES.at(-1), ['jewellery', 'Jewellery']);
  const wand = recipeById('wand:ironwood:ruby'), ring = recipeById('ring:silver');
  assert.deepEqual([takesHeartwood(wand), takesHeartwood(ring)], [true, false]);
  assert.deepEqual(recipeInputs(wand, { heartwood: true }), [{ key: 'plank:ironwood', n: 1 }, { key: 'gem:ruby', n: 1 }, { key: 'wood:heartwood', n: 1 }]);
  assert.deepEqual([qualitySteps(wand, { heartwood: true }), qualitySteps(ring, { clean: true, spec50: GOLDSMITH }), qualitySteps(ring, { spec50: GEMCUTTER })], [1, 1, 0]);
});

// ─── THE SPECIALISATIONS AND THE POINTS (3.3, 9.3) ───────────────────

test('PROF10 law: Jewelcrafting\'s four (3.3) - the Gemcutter and the Goldsmith at 50, the Master Jeweller and the Lapidary at 100, every one chosen now', () => {
  // PIN MOVED (CRAFT3): Jewelcrafting's four stand under the Smithing track now, after the smith's own two at each rank
  assert.deepEqual(SPECIALISATIONS.smithing[50].map((s) => [s.id, s.name, s.later ?? null]), [['weaponsmith', 'Weaponsmith', null], ['armoursmith', 'Armoursmith', null], ['gemcutter', 'Gemcutter', null], ['goldsmith', 'Goldsmith', null]]);
  assert.deepEqual(SPECIALISATIONS.smithing[100].map((s) => [s.id, s.name, s.later ?? null]), [['masterwright', 'Masterwright', null], ['quartermaster', 'Quartermaster', null], ['master-jeweller', 'Master Jeweller', null], ['lapidary', 'Lapidary', null]]);
  assert.equal(SPECIALISATIONS.jewelcrafting, undefined);   // PIN MOVED (CRAFT3): no track of its own
  assert.deepEqual([GEMCUTTER, GOLDSMITH, MASTER_JEWELLER, LAPIDARY].map(specDiscipline), ['jewelcrafting', 'jewelcrafting', 'jewelcrafting', 'jewelcrafting']);   // PIN MOVED (CRAFT3): still Jewelcrafting's choices
  assert.deepEqual([GEMCUTTER, GOLDSMITH, MASTER_JEWELLER, LAPIDARY], ['gemcutter', 'goldsmith', 'master-jeweller', 'lapidary']);
  assert.ok([[50, GEMCUTTER], [50, GOLDSMITH], [100, MASTER_JEWELLER], [100, LAPIDARY]].every(([r, s]) => specOk('jewelcrafting', r, s) && specOk('smithing', r, s)));   // PIN MOVED (CRAFT3): asked of the discipline or its track
});

test('PROF10 law: the piece\'s enchantment points (9.3) - Silver +0%, Gold +10%, Platinum +20%, a set gem +10% (a Gemcutter\'s +20%), a Goldsmith\'s Silver counted as Gold; over DFU\'s template\'s, floored', () => {
  const pct = (id, hand = null) => jewelPointsPct(recipeById(id), hand);
  assert.deepEqual([pct('ring:silver'), pct('ring:gold'), pct('ring:platinum'), pct('ring:silver:ruby'), pct('ring:gold:ruby'), pct('ring:platinum:diamond')], [0, 10, 20, 10, 20, 30]);
  assert.deepEqual([pct('clothamulet:linen:jade'), pct('wand:ironwood:pearl'), pct('bracer:gold')], [10, 10, 10], 'a cloth or a wood adds nothing; the gem its ten');
  assert.deepEqual([GEM_POINTS, GEMCUTTER_POINTS], [10, 10]);
  assert.deepEqual([pct('ring:silver', JEWEL_HAND_GOLDSMITH), pct('ring:silver:ruby', JEWEL_HAND_GOLDSMITH), pct('ring:gold', JEWEL_HAND_GOLDSMITH)], [10, 20, 10], 'a Goldsmith\'s Silver is Gold\'s; Gold stays Gold\'s');
  assert.deepEqual([pct('ring:gold:ruby', JEWEL_HAND_GEMCUTTER), pct('ring:platinum:diamond', JEWEL_HAND_GEMCUTTER), pct('ring:gold', JEWEL_HAND_GEMCUTTER)], [30, 40, 10], 'a Gemcutter\'s gem +20%');
  assert.deepEqual([pct('longsword:iron'), pct('stew:north', 1), jewelPointsPct(null)], [0, 0, 0], 'no other piece\'s');
  // over the template's: the Ring's 1,800, the Amulet's 2,300, the Cloth Amulet's 600, floored
  assert.deepEqual([templateByIndex(135).enchantmentPoints, templateByIndex(133).enchantmentPoints, templateByIndex(139).enchantmentPoints, templateByIndex(140).enchantmentPoints], [1800, 2300, 600, 1200]);
  assert.deepEqual([jewelPoints(recipeById('ring:silver'), 1800), jewelPoints(recipeById('ring:gold:ruby'), 1800), jewelPoints(recipeById('amulet:platinum:diamond'), 2300, JEWEL_HAND_GEMCUTTER),
    jewelPoints(recipeById('clothamulet:linen:jade'), 605), jewelPoints(recipeById('ring:gold'), 'x'), jewelPoints(recipeById('ring:gold'), -5)], [1800, 2160, 3220, 665, 0, 0]);
});

test('PROF10 law: the jeweller\'s hand (a choice at 50) - a Goldsmith\'s on a Silver piece, a Gemcutter\'s on a gemmed one, none else; signed into the record (`f`) and refused where it cannot stand; a dish\'s hand no jewel\'s', async () => {
  const r = (id) => recipeById(id);
  assert.deepEqual([JEWEL_HAND_GOLDSMITH, JEWEL_HAND_GEMCUTTER], [1, 2]);
  assert.deepEqual([jewelHand(r('ring:silver'), GOLDSMITH), jewelHand(r('torc:silver'), GOLDSMITH), jewelHand(r('ring:gold'), GOLDSMITH), jewelHand(r('clothamulet:linen:jade'), GOLDSMITH)], [1, 1, null, null]);
  assert.deepEqual([jewelHand(r('ring:gold:ruby'), GEMCUTTER), jewelHand(r('wand:ironwood:jade'), GEMCUTTER), jewelHand(r('ring:gold'), GEMCUTTER), jewelHand(r('ring:silver:ruby'), null)], [2, 2, null, null]);
  assert.deepEqual([jewelHand(r('longsword:iron'), GOLDSMITH), jewelHand(r('stew:north'), GEMCUTTER), jewelHand(null, GOLDSMITH), jewelHand(r('ring:silver'), MASTER_JEWELLER)], [null, null, null, null]);
  assert.deepEqual([jewelHandOk(r('ring:silver'), 1), jewelHandOk(r('ring:gold'), 1), jewelHandOk(r('ring:gold:ruby'), 2), jewelHandOk(r('ring:gold'), 2), jewelHandOk(r('ring:silver:ruby'), 1), jewelHandOk(r('ring:silver:ruby'), 3), jewelHandOk(r('stew:north'), 2)],
    [true, false, true, false, true, false, false]);
  const base = { p: '0123456789abcdef', s: 'acct_0000000001', h: 'char-0001', q: 2, m: 'Ann', c: 7, i: 5 };
  assert.ok(productRecordValid({ ...base, r: 'ring:silver' }));
  assert.ok(productRecordValid({ ...base, r: 'ring:silver', f: 1 }));
  assert.ok(productRecordValid({ ...base, r: 'ring:gold:ruby', f: 2 }));
  assert.equal(productRecordValid({ ...base, r: 'ring:gold', f: 1 }), false, 'a Goldsmith\'s hand is a Silver piece\'s');
  assert.equal(productRecordValid({ ...base, r: 'ring:gold', f: 2 }), false, 'a Gemcutter\'s a gemmed piece\'s');
  assert.equal(productRecordValid({ ...base, r: 'ring:gold:ruby', q: -1 }), false, 'a piece of jewellery takes a quality');
  assert.equal(productRecordValid({ ...base, r: 'feast:hearth', q: -1, f: HAND_CHEF }), true, 'the cook\'s hand still the feast\'s');
  const rec = await mintProductRecord({ ...base, r: 'amulet:gold:pearl', f: 2 }, null, { subtle: globalThis.crypto.subtle, nowS: 9 });
  assert.equal(readProductRecord(rec).f, 2);
  await assert.rejects(mintProductRecord({ ...base, r: 'amulet:gold:pearl', f: 1 }, null, { subtle: globalThis.crypto.subtle, nowS: 9 }), /refused/);
});

test('PROF10 law: a Lapidary\'s Siege-cracked Gem stands in for a piece\'s gem (3.3: "set as any gem") - the piece the recipe\'s; never in a piece that sets none; a Master Jeweller\'s Masterwork points as a Masterwright\'s (3.3: "+5%"), nothing else\'s', () => {
  const ruby = recipeById('ring:gold:ruby'), plain = recipeById('ring:gold'), wand = recipeById('wand:ghostwood:diamond');
  assert.deepEqual([takesCracked(ruby), takesCracked(plain), takesCracked(wand), takesCracked(recipeById('longsword:iron')), takesCracked(null)], [true, false, true, false, false]);
  assert.deepEqual(recipeInputs(ruby, { cracked: true }), [{ key: 'metal:gold', n: 1 }, { key: SIEGE_GEM.key, n: 1 }]);
  assert.deepEqual(recipeInputs(ruby), [{ key: 'metal:gold', n: 1 }, { key: 'gem:ruby', n: 1 }]);
  assert.deepEqual(recipeInputs(plain, { cracked: true }), [{ key: 'metal:gold', n: 1 }], 'no gem to stand in for');
  assert.deepEqual(recipeInputs(wand, { cracked: true, heartwood: true }), [{ key: 'plank:ghostwood', n: 1 }, { key: SIEGE_GEM.key, n: 1 }, { key: 'wood:heartwood', n: 1 }], 'a Heartwood and a cracked gem together');
  assert.equal(SIEGE_GEM.key, 'gem:siege');
  // PIN MOVED (CRAFT3): both choices the Smithing track's now - the Master Jeweller's points a jewel's alone, the Masterwright's every other (none asked, the smith's)
  const sword = recipeById('longsword:iron');
  assert.deepEqual([masterworkSpec(MASTER_JEWELLER, ruby), masterworkSpec('masterwright', ruby), masterworkSpec(LAPIDARY, ruby), masterworkSpec(null, ruby)], [true, false, false, false]);
  assert.deepEqual([masterworkSpec('masterwright', sword), masterworkSpec(MASTER_JEWELLER, sword), masterworkSpec('masterwright'), masterworkSpec(MASTER_JEWELLER), masterworkSpec(null)], [true, false, true, false, false]);
  assert.deepEqual(qualityOdds(100, { masterwright: masterworkSpec(MASTER_JEWELLER, ruby) }), [0, 0, 35, 52, 13]);   // PIN MOVED (CRAFT3): asked of the jewel
  assert.deepEqual(qualityOdds(100, { masterwright: masterworkSpec(LAPIDARY, ruby) }), [0, 0, 40, 52, 8]);   // PIN MOVED (CRAFT3): asked of the jewel
});

test('PROF10 law: a piece of jewellery\'s card says its quality, its maker and its enchantment points; the bench is a Pawn Shop\'s or a Gem Store\'s at 9.3\'s 50 gold, or a home\'s jeweller\'s bench - the eighth station, the workbench\'s 50,000', () => {
  assert.deepEqual(pieceLines({ provenance: '0123456789abcdef', recipe: 'ring:gold:ruby', quality: 2, maker: 'Ann', enchantmentPoints: 2160 }), ['Fine', 'Made by Ann', '2,160 enchantment points']);
  assert.deepEqual(pieceLines({ provenance: '0123456789abcdef', recipe: 'ring:gold:ruby', quality: 2 }), ['Fine']);
  assert.deepEqual(pieceLines({ provenance: '0123456789abcdef', recipe: 'longsword:iron', quality: 2, enchantmentPoints: 900 }), ['Fine'], 'a sword says none');
  assert.deepEqual([JEWEL_FEE, MASON_FEE], [50, 50]);
  assert.equal(DECOR_STATIONS.at(-2), 'jeweller');   // PIN MOVED (HOME-VENDOR): the hired trader a ninth after it
  assert.deepEqual([DECOR_STATION_FEES.jeweller, DECOR_STATION_NAMES.jeweller], [50_000, 'Jeweller\'s bench']);
  assert.equal(decorPlaceOf({ pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, paid: 120, station: 'jeweller' })?.station, 'jeweller');
});

// ─── THE FACET (9.4) ─────────────────────────────────────────────────

test('PROF10 law: the facet\'s numbers - three facets a piece, five a gemmed one; a slow turn, 60 degrees a second (six seconds round), the light 60-300 degrees, lost after two turns; the window 10 degrees (9.4) x the band, half again by Master; the band (WIL + LUC) / 2 on Foraging\'s four', () => {
  assert.deepEqual({ ...FACET_ACT }, { facets: 3, gemFacets: 5, degPerS: 60, windowDeg: 10, masterWiden: 0.5, turns: 2, lightLo: 60, lightHi: 300, gapS: 0.3 });
  assert.deepEqual([facetCount(recipeById('ring:silver')), facetCount(recipeById('ring:silver:ruby')), facetCount(recipeById('torc:gold')), facetCount(null)], [3, 5, 3, 3]);
  assert.deepEqual([facetWindow(0), facetWindow(50), facetWindow(100), facetWindow(150), facetWindow(-4), facetWindow(0, 1.3)], [10, 12.5, 15, 15, 10, 13]);
  assert.deepEqual([facetBand({ willpower: 39, luck: 39 }), facetBand({ willpower: 50, luck: 60 }), facetBand({ willpower: 70, luck: 60 }), facetBand({ willpower: 100, luck: 60 }), facetBand({ willpower: 30, luck: 51 })],
    [ACT_BANDS[0], ACT_BANDS[1], ACT_BANDS[2], ACT_BANDS[3], ACT_BANDS[1]]);
  assert.deepEqual([bearingGap(10, 350), bearingGap(350, 10), bearingGap(90, 90), bearingGap(0, 180), bearingGap(720, 5), bearingGap(-30, 30)], [20, 20, 0, 180, 5, 60]);
});

test('PROF10 law: THE FACET\'S MACHINE - the stone turns from 0 toward the light; stopped within the window it is caught, outside it lost; let go round twice it is lost by itself and the next begun; every facet caught is clean, one lost not; the gap between stops; the press\'s own moment judged; Gentle acts never caught, never clean; cancelled short never clean', () => {
  const mid = () => 0.5;   // the light at 180 degrees
  const a = createFacetAct({ facets: 3, windowDeg: 10, rng: mid });
  assert.deepEqual([a.state.need, a.state.light, a.state.half, a.bearing], [3, 180, 5, 0]);
  a.tick(1);
  assert.deepEqual([a.bearing, a.inWindow], [60, false]);
  assert.equal(a.stop(), false, 'stopped in the dark: lost');
  assert.equal(a.stop(), null, 'the next within the gap');
  a.tick(0.5);
  a.tick(176 / 60 - 0.5);
  assert.equal(a.inWindow, true, '176 degrees: within five of the light');
  assert.equal(a.stop(), true, 'caught');
  a.tick(173 / 60);
  assert.equal(a.inWindow, false, 'the frame: 173, just short');
  assert.equal(a.stop(0.1), true, 'the press\'s own moment: six degrees on is in the window (AUDIT 32 P1)');
  assert.deepEqual(a.report(), { facets: 3, hits: 2, passed: 0, clean: false });
  assert.equal(a.state.done, true);
  assert.equal(a.stop(), null, 'over');
  // clean: every facet caught
  const b = createFacetAct({ facets: 3, windowDeg: 10, rng: mid });
  for (let i = 0; i < 3; i++) { b.tick(181 / 60); assert.equal(b.stop(), true, `facet ${i}`); }
  assert.deepEqual(b.report(), { facets: 3, hits: 3, passed: 0, clean: true });
  // let go round twice: lost by itself, the next begun from 0
  const c = createFacetAct({ facets: 2, windowDeg: 10, rng: mid });
  c.tick(359 / 60);
  assert.deepEqual([c.state.cuts.length, c.bearing], [0, 359], 'round once, still turning');
  c.tick(1);
  c.tick(5);
  assert.equal(c.state.cuts.length, 0, '719 degrees: still the first facet');
  c.tick(1 / 60);
  assert.deepEqual([c.state.cuts, c.state.passed, c.state.turned, c.state.done], [[false], 1, 0, false]);
  c.tick(180 / 60);
  assert.equal(c.stop(), true);
  assert.deepEqual(c.report(), { facets: 2, hits: 1, passed: 1, clean: false });
  // the second turn round still catches the light
  const d = createFacetAct({ facets: 1, windowDeg: 10, rng: mid });
  d.tick((360 + 182) / 60);
  assert.deepEqual([d.inWindow, d.stop()], [true, true]);
  // a press's lead is bounded (PRESS_LEAD_MAX_S): at 170 degrees, a half-second's lead is judged a tenth's on - 176, caught
  const lead = createFacetAct({ facets: 1, windowDeg: 10, rng: mid });
  lead.tick(170 / 60);
  assert.equal(lead.stop(0.5), true, 'never judged past the bound (200 degrees would be dark)');
  // the light drawn each facet, 60 to 300
  const lights = [0, 0.25, 1];
  const e = createFacetAct({ facets: 3, rng: () => lights.shift() ?? 0 });
  const seen = [e.state.light];
  e.stop(); e.tick(0.4); seen.push(e.state.light); e.stop(); e.tick(0.4); seen.push(e.state.light);
  assert.deepEqual(seen, [60, 120, 300]);
  assert.equal(createFacetAct({ rng: () => 5 }).state.light, 300, 'never past its bound');
  assert.equal(createFacetAct({ rng: () => Number.NaN }).state.light, 60);
  // Gentle acts: never caught, every stop counts, never clean
  const g = createFacetAct({ facets: 3, windowDeg: 10, gentle: true, rng: mid });
  for (let i = 0; i < 3; i++) { g.tick(180 / 60); assert.equal(g.inWindow, false); assert.equal(g.stop(), false); }
  assert.deepEqual(g.report(), { facets: 3, hits: 0, passed: 0, clean: false });
  // cancelled short
  const h = createFacetAct({ facets: 3, windowDeg: 10, rng: mid });
  h.tick(3); assert.equal(h.stop(), true); h.cancel();
  assert.deepEqual([h.state.done, h.report().clean, h.stop()], [true, false, null]);
  h.tick(1);
  assert.equal(h.state.t, 3, 'a cancelled act ticks no more');
  assert.equal(createFacetAct({ facets: 0 }).state.need, 1);
});
