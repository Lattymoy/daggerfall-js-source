// PROF3 (2026-09-28, Mac: "Lets keep moving") - THE RECIPE LAW, AS THE RECORD SAYS IT: 9.3's recipes (the ingots and
// the fittings each product asks, the chain at three quarters, Foraging's tools, the kits), the rank a recipe asks
// (its material's tier's), 9.2's quality (the margin's rows, the steps each source gives at most, Masterwright's points,
// nothing past Masterwork, what a quality does), 3.2's XP, the heat's band, the smith's stock and the signed product
// record. bible/06-Systems/Professions-Arc.md 9, 24.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  RECIPES, SMITH_RECIPES, recipeById, recipeOpen, WEAPON_PRODUCTS, PLATE, SHIELDS, CHAIN, TOOLS, INGOT_MATERIAL, ARMOR_CHAIN, ARMOR_PLATE,
  QUALITY_ROWS, qualityOdds, rollQuality, qualitySteps, craftQuality, QUALITY_EFFECTS, TOOL_LIFE, takesQuality, craftXp,
  craftCount, FIRST_CRAFT_XP, HEAT_ACT, heatWindow, glowAt, heatBand, makerName, MAKER_MAX, pieceLines, MASTERWORK,
} from '../src/net/recipeLaw.js';
import { SMITH_STOCK, stockOf, withdrawable, TIER_RANKS, materialOf } from '../src/net/professionLaw.js';
import { herbTier } from '../src/net/nodeLaw.js';
import { mintProductRecord, readProductRecord, verifyProductRecord, productRecordValid } from '../src/net/productRecord.js';
import { MARKS_KINDS } from '../src/net/marksLaw.js';

const subtle = webcrypto.subtle;

test('PROF3 law: 9.3\'s recipes - the weapons, the plate and the shields at every metal, the chain at Steel, the tools at Iron, the kits at every metal but the Warforged\'s; each its ingots and fittings', () => {
  // PROF4: the anvil's are SMITH_RECIPES now; RECIPES holds the workbench's beside them (prof4_law)
  assert.equal(SMITH_RECIPES.length, (WEAPON_PRODUCTS.length + PLATE.length + SHIELDS.length) * 11 + CHAIN.length + TOOLS.length + 10);
  assert.ok(SMITH_RECIPES.every((r) => r.profession === 'smithing' && RECIPES.includes(r)));
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length, 'one id a recipe');
  const ins = (id) => recipeById(id).inputs.map((i) => [i.key, i.n]);
  assert.deepEqual(ins('dagger:iron'), [['ingot:iron', 1], ['metal:tin', 1]]);
  assert.deepEqual(ins('wakizashi:steel'), [['ingot:steel', 2], ['metal:tin', 1]]);
  assert.deepEqual(ins('longsword:mithril'), [['ingot:mithril', 3], ['metal:copper', 1], ['leather:cured', 1]]);
  assert.deepEqual(ins('waraxe:ebony'), [['ingot:ebony', 4], ['metal:copper', 1], ['plank:oak', 1]]);
  assert.deepEqual(ins('daikatana:daedric'), [['ingot:daedric', 5], ['metal:copper', 1], ['leather:cured', 1]]);
  assert.deepEqual(ins('cuirass:silver'), [['ingot:silver', 6], ['leather:cured', 2]]);
  assert.deepEqual([ins('helm:iron'), ins('buckler:iron'), ins('greaves:iron')], [[['ingot:iron', 2], ['leather:cured', 1]], [['ingot:iron', 3], ['leather:cured', 1]], [['ingot:iron', 4], ['leather:cured', 1]]]);
  assert.deepEqual([ins('roundshield:iron'), ins('kiteshield:iron'), ins('towershield:iron')].map((x) => x[0][1]), [3, 4, 5]);
  assert.deepEqual(CHAIN.map((p) => [p.id, p.ingots]), [['chain-cuirass', 5], ['chain-greaves', 3], ['chain-helm', 2], ['chain-lpauldron', 2], ['chain-rpauldron', 2], ['chain-gauntlets', 2], ['chain-boots', 2]], 'the plate piece x 0.75, rounded up');
  assert.deepEqual(ins('chain-cuirass:steel'), [['ingot:steel', 5]], 'Steel only, nothing else');
  assert.equal(recipeById('chain-cuirass:iron'), null);
  assert.deepEqual([ins('woodaxe:iron'), ins('pickaxe:iron'), ins('sickle:iron'), ins('spade:iron')], [
    [['ingot:iron', 2], ['plank:pine', 1]], [['ingot:iron', 2], ['plank:pine', 1]], [['ingot:iron', 1], ['plank:pine', 1]], [['ingot:iron', 2], ['plank:oak', 1]]]);
  assert.deepEqual(ins('kit:mithril'), [['ingot:mithril', 1], ['leather:cured', 1]]);
  assert.equal(recipeById('kit:warforged'), null);
  assert.equal(recipeById('staff:iron'), null, 'the Staff is a carpenter\'s');
  // the piece is DFU's: its template and its material
  const ls = recipeById('longsword:mithril');
  assert.deepEqual([ls.templateIndex, ls.material, ls.name, ls.family], [120, 5, 'Mithril Longsword', 'weapons']);
  assert.deepEqual([recipeById('cuirass:ebony').material, recipeById('chain-helm:steel').material, recipeById('towershield:daedric').material], [ARMOR_PLATE + 7, ARMOR_CHAIN, ARMOR_PLATE + 9]);
  assert.deepEqual([recipeById('longsword:moonstone').name, recipeById('longsword:orichalcum').name, recipeById('longsword:warforged').material], ['Elven Longsword', 'Orcish Longsword', INGOT_MATERIAL['ingot:ebony']], 'Warforged counts as Ebony');
  assert.deepEqual([recipeById('spade:iron').templateIndex, recipeById('woodaxe:iron').templateIndex], [1606, 1600], 'Foraging\'s own templates');
});

test('PROF3 law: a recipe\'s rank is its material\'s tier\'s (0 10 25 40 55 70 90); the tools rank 0, the Spade 10; open by rank alone', () => {
  const rank = (id) => recipeById(id).rank;
  assert.deepEqual(['dagger:iron', 'dagger:steel', 'dagger:silver', 'dagger:moonstone', 'dagger:dwarven', 'dagger:mithril', 'dagger:adamantium', 'dagger:ebony', 'dagger:orichalcum', 'dagger:daedric', 'dagger:warforged'].map(rank),
    [0, 10, 25, 40, 40, 55, 70, 70, 70, 90, 70]);
  assert.deepEqual(TIER_RANKS, [0, 10, 25, 40, 55, 70, 90]);
  assert.deepEqual(['woodaxe:iron', 'sickle:iron', 'spade:iron', 'chain-boots:steel', 'kit:daedric'].map(rank), [0, 0, 10, 10, 90]);
  assert.equal(recipeOpen(recipeById('longsword:mithril'), 54), false);
  assert.equal(recipeOpen(recipeById('longsword:mithril'), 55), true);
});

test('PROF3 law: the quality - the margin\'s four rows, a roll on them, a step each at most from the clean act, the family\'s specialisation and a Warforged ingot; nothing past Masterwork; Masterwright\'s 5 off the row\'s lowest', () => {
  assert.deepEqual(QUALITY_ROWS.map((r) => [r.upTo, [...r.odds]]), [[9, [20, 60, 20, 0, 0]], [24, [0, 50, 40, 10, 0]], [44, [0, 20, 50, 28, 2]], [Infinity, [0, 0, 40, 52, 8]]]);
  for (const r of QUALITY_ROWS) assert.equal(r.odds.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual([qualityOdds(0), qualityOdds(9), qualityOdds(10), qualityOdds(24), qualityOdds(25), qualityOdds(44), qualityOdds(45), qualityOdds(100)].map((o) => o.join()),
    ['20,60,20,0,0', '20,60,20,0,0', '0,50,40,10,0', '0,50,40,10,0', '0,20,50,28,2', '0,20,50,28,2', '0,0,40,52,8', '0,0,40,52,8']);
  assert.deepEqual(qualityOdds(10, { masterwright: true }), [0, 45, 40, 10, 5]);
  assert.deepEqual(qualityOdds(45, { masterwright: true }), [0, 0, 35, 52, 13]);
  assert.deepEqual([rollQuality(0, [20, 60, 20, 0, 0]), rollQuality(0.199, [20, 60, 20, 0, 0]), rollQuality(0.2, [20, 60, 20, 0, 0]), rollQuality(0.8, [20, 60, 20, 0, 0]), rollQuality(0.9999, [0, 0, 40, 52, 8])], [0, 0, 1, 2, 4]);
  const ls = recipeById('longsword:mithril'), cu = recipeById('cuirass:mithril'), wf = recipeById('longsword:warforged');
  assert.deepEqual([qualitySteps(ls), qualitySteps(ls, { clean: true }), qualitySteps(ls, { spec50: 'weaponsmith' }), qualitySteps(cu, { spec50: 'weaponsmith' }), qualitySteps(cu, { spec50: 'armoursmith', clean: true }), qualitySteps(wf, { clean: true, spec50: 'weaponsmith' })], [0, 1, 1, 0, 2, 3]);
  assert.deepEqual([craftQuality(2, 1), craftQuality(3, 3), craftQuality(4, 0)], [3, MASTERWORK, MASTERWORK]);
  // what a quality does (9.2), and a tool's life (FORAGE0 14.7); a kit takes none
  assert.deepEqual(QUALITY_EFFECTS.map((e) => [e.condition, e.weight, e.rarity]), [[0.75, 1, null], [1, 1, null], [1.15, 0.95, null], [1.3, 0.9, 'magic'], [1.3, 0.9, 'rare']]);
  assert.deepEqual(TOOL_LIFE, [37, 50, 57, 65, 65]);
  assert.deepEqual([takesQuality(ls), takesQuality(recipeById('kit:iron'))], [true, false]);
  assert.deepEqual([craftCount(recipeById('kit:iron'), 'quartermaster'), craftCount(ls, 'quartermaster'), craftCount(recipeById('kit:iron'), 'masterwright')], [2, 1, 1]);
});

test('PROF3 law: the XP - 20 x the tier, a quarter more than two tiers below the rank\'s top, +500 the first; the heat\'s band and glow; the maker\'s name; a piece\'s lines', () => {
  assert.deepEqual([craftXp(5, 55, true), craftXp(5, 55, false), craftXp(1, 55, false), craftXp(1, 25, false), craftXp(7, 100, false)], [600, 100, 5, 20, 140]);
  assert.equal(FIRST_CRAFT_XP, 500);
  assert.deepEqual(HEAT_ACT, { strikes: 3, periodS: 2, bandLo: 0.62, bandW: 0.2, gapS: 0.35 });
  assert.deepEqual(heatWindow(1).map((x) => +x.toFixed(3)), [0.62, 0.82]);
  assert.deepEqual(heatWindow(1.3).map((x) => +x.toFixed(3)), [0.62, 0.88]);
  assert.deepEqual([glowAt(0), glowAt(1), +glowAt(0.5).toFixed(3)], [0, 1, 0.5], 'cold, white at the breath\'s middle');
  assert.deepEqual([heatBand({ strength: 30, agility: 40 }), heatBand({ strength: 50, agility: 50 }), heatBand({ strength: 90, agility: 80 })], [0.85, 1, 1.3]);
  assert.deepEqual([makerName('  Silverthorn  '), makerName(''), makerName(null), makerName('x'.repeat(40)).length, makerName('Ta\u0007ra')], ['Silverthorn', null, null, MAKER_MAX, 'Tara']);
  assert.deepEqual(pieceLines({ quality: 2, maker: 'Ann', provenance: '0123456789abcdef' }), ['Fine', 'Made by Ann']);
  assert.deepEqual(pieceLines({ kitMetal: 5, provenance: '0123456789abcdef' }), ['Mends a quarter of a Mithril piece\'s condition, up to 75%, once'], 'KIT-CEILING');
  // PIN MOVED (CRAFT4, Professions-Arc 41.7): a piece no anvil made says no maker - but a found piece a temper raised says
  // its quality (Fine, Superior); the Standard it was says nothing
  assert.deepEqual(pieceLines({ quality: 2, maker: 'Ann' }), ['Fine'], 'no provenance, no anvil made it - a temper\'s quality alone');
  assert.deepEqual([pieceLines({ quality: 1 }), pieceLines({ quality: 3 }), pieceLines({ quality: 4 }), pieceLines({})], [[], ['Superior'], [], []]);
});

test('PROF3 law: the smith\'s stock - Cured Leather 4, Oak Plank 4, Pine Plank 2, Charcoal 2 Marks (twice each one\'s value), materials the Stores know, Cured Leather never withdrawn (PROF4: the planks and Charcoal are); a `stock` line burns', () => {
  assert.deepEqual(SMITH_STOCK.map((s) => [s.key, s.marks]), [['leather:cured', 4], ['plank:oak', 4], ['plank:pine', 2], ['wood:charcoal', 2]]);
  for (const s of SMITH_STOCK) {
    const m = materialOf(s.key, herbTier);
    assert.equal(s.marks, 2 * m.value, s.key);
    // PROF4 registered the planks' and Charcoal's templates (PROF0 25); PROF7 moved it: Cured Leather's too (665)
    assert.equal(withdrawable(s.key), true, s.key);
  }
  assert.deepEqual([materialOf('leather:cured', herbTier).tier, materialOf('plank:oak', herbTier).tier, materialOf('plank:pine', herbTier).tier], [2, 2, 1]);
  assert.equal(stockOf('ingot:iron'), null);
  assert.equal(withdrawable('ingot:iron'), true);
  assert.equal(MARKS_KINDS.stock, 'burn');
});

test('PROF3 law: the product record - p1, signed with the identity key, read by anyone, verified only with the key; another signed shape\'s fields refused; a kit\'s quality -1', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const what = { p: '00ff00ff00ff00ff', s: 'acct-0001', h: 'char-mac', r: 'longsword:mithril', q: 3, m: 'Silverthorn', c: 42 };
  const rec = await mintProductRecord(what, kp.privateKey, { subtle, nowS: 1_800_000_000 });
  assert.match(rec, /^p1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(readProductRecord(rec), { ...what, i: 1_800_000_000, signed: true });
  assert.deepEqual((await verifyProductRecord(rec, kp.publicKey, { subtle })).ok, true);
  assert.deepEqual(await verifyProductRecord(rec, other.publicKey, { subtle }), { ok: false, why: 'signature' });
  const unsigned = await mintProductRecord(what, null, { subtle, nowS: 1 });
  assert.equal(readProductRecord(unsigned).signed, false);
  assert.deepEqual(await verifyProductRecord(unsigned, kp.publicKey, { subtle }), { ok: false, why: 'unsigned' });
  assert.deepEqual(await verifyProductRecord(rec.replace(/^p1/, 'w1'), kp.publicKey, { subtle }), { ok: false, why: 'version' });
  for (const k of ['n', 'k', 't', 'o', 'd', 'b', 'w', 'y', 'e']) assert.equal(productRecordValid({ ...what, i: 1, [k]: 1 }), false, `a record never carries ${k}`);
  assert.equal(productRecordValid({ ...what, i: 1, q: 5 }), false);
  // PIN MOVED (CRAFT5, Professions-Arc 41.8): a kit's craft rolls a quality now (its reach) - a kit made before none
  assert.equal(productRecordValid({ ...what, i: 1, r: 'kit:iron', q: 0 }), true, 'a kit its quality');
  assert.equal(productRecordValid({ ...what, i: 1, r: 'kit:iron', q: 5 }), false, 'never past Masterwork');
  assert.equal(productRecordValid({ ...what, i: 1, q: -1 }), false, 'a piece that takes a quality always carries one - only a kit made before none');
  assert.equal(productRecordValid({ ...what, i: 1, r: 'kit:iron', q: -1, m: null }), true);
  assert.equal(productRecordValid({ ...what, i: 1, p: '00FF00FF00FF00FF' }), false, 'lower-case hex');
  await assert.rejects(mintProductRecord({ ...what, r: 'staff:iron' }, null, { subtle, nowS: 1 }), /refused/);
});
