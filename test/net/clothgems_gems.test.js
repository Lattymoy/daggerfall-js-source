// CLOTH-GEMS (2026-10-25; the player SaberGGaming's "Profession oversights", the owner: "No band aids") - EVERY GEM'S GRADE
// AT THE JEWELLER'S BENCH. The jeweller took DFU's eight and the Pearl alone; the port's graded gems (Chipped, Flawed,
// Flawless, Perfect - templates 1900-1931, systems/gems.js) were pack-only socket loot and no material at all. The
// owner's decision: accept every grade. Each grade has a material key (net/professionLaw.js GRADED_GEMS) that enters the
// Stores by the loose door alone (net/bagLaw.js looseOrder), a recipe id a grade (net/recipeLaw.js JEWEL_GEMS -
// 'ring:gold:flawless-ruby'), the first-craft key still the pattern at its tier, and a gem's points its grade's own ladder
// (gemPointsPct over systems/loot/gemGrades.js GEM_GRADE_PRICE). The law, then the real Worker over node:sqlite.
// bible/06-Systems/Professions-Arc.md 50; bible/06-Systems/Gem-Sockets.md 7.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import {
  GEMS, GRADED_GEMS, GEM_DFU_PRICES, LOOSE_ONLY_KEYS, looseOnly, gemGradeOfKey, gemTierOfPrice, materialOf, minedMaterial,
  MINED_KEYS, withdrawable, PEARL, SIEGE_GEM,
} from '../../src/net/professionLaw.js';
import {
  JEWEL_GEMS, JEWELCRAFTING_RECIPES, recipeById, gemWord, gemPointsPct, jewelPointsPct, jewelPoints, takesCracked, firstCraftKey,
  firstCraftKin, firstCraftPays, GEM_POINTS, JEWEL_HAND_GEMCUTTER, firstCraftXp,
} from '../../src/net/recipeLaw.js';
import { GEM_IDS, GEM_ROW_GRADES, GEM_GRADE_PRICE, GEM_NAMES, gemId, gemTemplateOf, gradedGemPrice } from '../../src/systems/loot/gemGrades.js';
import { looseOrder, LOOSE_ORIGIN } from '../../src/net/bagLaw.js';
import { marketCatalogue } from '../../src/net/marketLaw.js';
import { writMaterialOk } from '../../src/net/writLaw.js';
import { templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { GEM_GRADE_ROWS } from '../../src/systems/gems.js';
import { utcDay } from '../../src/net/marksLaw.js';

const NOON = utcDay(T0) * 86_400 + 12 * 3600;

test('CLOTH-GEMS law: A MATERIAL KEY A GRADE - the thirty-two graded gems, `gem:<grade>-<kind>`, DFU\'s Gems group on the port\'s own rows (1900-1931), each its graded price\'s tier, its row\'s name; DFU\'s prices one home, pinned to its templates (mutants: a price, a key\'s spelling, a tier off the plain price)', () => {
  for (const [k, kind] of GEM_IDS.entries()) assert.equal(GEM_DFU_PRICES[kind], templateByIndex(k).basePrice, `${kind}: DFU's own price`);
  assert.deepEqual(GEMS.map((g) => [g.key, g.tier, g.templateIndex]), GEM_IDS.map((kind, k) => [`gem:${kind}`, gemTierOfPrice(GEM_DFU_PRICES[kind]), k]));
  assert.equal(GRADED_GEMS.length, 32);
  assert.deepEqual(GRADED_GEMS.map((g) => g.key), GEM_ROW_GRADES.flatMap((gr) => GEM_IDS.map((kind) => `gem:${gr}-${kind}`)));
  for (const g of GRADED_GEMS) {
    const id = g.key.slice('gem:'.length);
    assert.deepEqual([g.family, g.group, g.templateIndex, g.name], ['gems', 'Gems', gemTemplateOf(id), GEM_NAMES[id]], g.key);
    const kind = id.slice(id.indexOf('-') + 1), grade = id.slice(0, id.indexOf('-'));
    assert.equal(g.tier, gemTierOfPrice(gradedGemPrice(GEM_DFU_PRICES[kind], grade)), `${g.key}: its own price's band`);
    assert.equal(GEM_GRADE_ROWS.find((r) => r.index === g.templateIndex)?.name, g.name, `${g.key}: the row the loot mints`);
    assert.equal(gemWord(g.key), g.name);
    assert.equal(minedMaterial(g.key), g);
    assert.deepEqual(materialOf(g.key, () => null), { key: g.key, family: 'gems', tier: g.tier, value: [1, 2, 4, 6, 9, 14, 40][g.tier - 1], group: 'Gems', templateIndex: g.templateIndex });
  }
  assert.deepEqual(['gem:chipped-jade', 'gem:perfect-jade', 'gem:chipped-diamond', 'gem:perfect-diamond'].map((k) => minedMaterial(k).tier), [2, 3, 5, 6], 'a Chipped stone below its kind, a Perfect above');
  assert.deepEqual([gemGradeOfKey('gem:ruby'), gemGradeOfKey(PEARL.key), gemGradeOfKey(SIEGE_GEM.key), gemGradeOfKey('gem:flawed-amber'), gemGradeOfKey('metal:gold'), gemGradeOfKey(null)],
    ['plain', 'plain', 'plain', 'flawed', null, null]);
});

test('CLOTH-GEMS law: THE LOOSE DOOR ALONE - a graded gem is a material a station spends and a withdrawal gives back, and in no market\'s catalogue, no writ\'s choice and no Stores form a pack listing is refused for (mutants: a graded key in MINED_KEYS, the wall lost)', () => {
  assert.deepEqual(LOOSE_ONLY_KEYS, GRADED_GEMS.map((g) => g.key));
  assert.ok(LOOSE_ONLY_KEYS.every((k) => looseOnly(k) && withdrawable(k) && !MINED_KEYS.includes(k)));
  assert.equal(looseOnly('gem:ruby'), false, 'DFU\'s own gems are the veins\', every door\'s');
  const catalogue = marketCatalogue().map((m) => m.key);
  assert.ok(LOOSE_ONLY_KEYS.every((k) => !catalogue.includes(k) && !writMaterialOk(k)), 'no buy order, no writ');
  assert.ok(catalogue.includes('gem:ruby') && writMaterialOk('gem:ruby'));
  assert.deepEqual([looseOrder('work'), looseOrder('spend'), looseOrder('all')], [true, false, false], 'a station\'s put-in alone moves what the service never handed out');
  assert.equal(LOOSE_ORIGIN, 'loose');
});

test('CLOTH-GEMS law: EVERY GRADE AT THE JEWELLER\'S BENCH - 41 gems, a recipe each in every piece that sets one, its id the gem\'s grade and kind; the first-craft key still the piece and base at its tier, no key new; a gem\'s points its grade\'s ladder - Chipped 2.5 and Flawed 5 below the plain 10, Flawless 20 and Perfect 40 above - a Gemcutter\'s +10 beside it whole; a Lapidary\'s cracked gem for a plain one alone (mutants: a grade left out, the ladder flat, the cracked gem anywhere)', () => {
  assert.deepEqual(JEWEL_GEMS, [...GEMS.map((g) => g.key), PEARL.key, ...GRADED_GEMS.map((g) => g.key)]);
  assert.equal(JEWEL_GEMS.length, 41);
  for (const g of GRADED_GEMS) {
    for (const id of [`ring:gold:${g.key.slice(4)}`, `mark:silver:${g.key.slice(4)}`, `amulet:platinum:${g.key.slice(4)}`, `clothamulet:linen:${g.key.slice(4)}`, `wand:ironwood:${g.key.slice(4)}`]) {
      const r = recipeById(id);
      assert.ok(r && r.gem === g.key && r.inputs.some((i) => i.key === g.key), id);
    }
  }
  assert.deepEqual(['name', 'madeOf', 'tier', 'rank'].map((f) => recipeById('ring:gold:flawless-ruby')[f]), ['Gold Flawless Ruby Ring', 'Gold Flawless Ruby', 3, 25]);
  // the first-craft keys: pattern@tier, the very set the plain gems made
  const keys = new Set(JEWELCRAFTING_RECIPES.map(firstCraftKey));
  const plain = new Set(JEWELCRAFTING_RECIPES.filter((r) => gemGradeOfKey(r.gem) !== null ? gemGradeOfKey(r.gem) === 'plain' : true).map(firstCraftKey));
  assert.deepEqual([...keys].sort(), [...plain].sort());
  assert.equal(keys.size, 20);
  assert.equal(firstCraftKey(recipeById('ring:gold:perfect-ruby')), 'ring@3');
  assert.ok(firstCraftKin(recipeById('ring:gold:perfect-ruby')).includes('ring:gold:ruby'), 'a Perfect Ruby Ring after a Ruby Ring is no first');
  assert.ok(JEWELCRAFTING_RECIPES.every((r) => firstCraftPays(r)), 'a jewel is never S1\'s');
  // the points, by grade
  assert.deepEqual(GEM_GRADE_PRICE, { chipped: 0.25, flawed: 0.5, plain: 1, flawless: 2, perfect: 4 });
  assert.equal(GEM_POINTS, 10);
  assert.deepEqual(['chipped', 'flawed', 'plain', 'flawless', 'perfect'].map((gr) => gemPointsPct(`gem:${gemId('ruby', gr)}`)), [2.5, 5, 10, 20, 40]);
  assert.deepEqual([gemPointsPct(PEARL.key), gemPointsPct(SIEGE_GEM.key), gemPointsPct('metal:gold'), gemPointsPct(null)], [10, 10, 0, 0]);
  const pct = (id, hand = null) => jewelPointsPct(recipeById(id), hand);
  assert.deepEqual(['chipped-ruby', 'flawed-ruby', 'ruby', 'flawless-ruby', 'perfect-ruby'].map((g) => pct(`ring:gold:${g}`)), [12.5, 15, 20, 30, 50], 'Gold\'s 10 and the stone\'s');
  assert.deepEqual(['chipped-ruby', 'perfect-ruby'].map((g) => pct(`ring:silver:${g}`, JEWEL_HAND_GEMCUTTER)), [12.5, 50], 'a Gemcutter\'s +10, whole');
  assert.deepEqual(['ring:gold:chipped-jade', 'ring:gold:jade', 'ring:gold:perfect-jade'].map((id) => jewelPoints(recipeById(id), 1800)), [2025, 2160, 2700]);
  assert.deepEqual([takesCracked(recipeById('ring:gold:ruby')), takesCracked(recipeById('ring:gold:pearl')), takesCracked(recipeById('ring:gold:perfect-ruby')), takesCracked(recipeById('ring:gold:chipped-ruby'))],
    [true, true, false, false], 'a cracked stone stands in for a plain gem, never a graded one');
});

/** The real Worker: a seated character, its Stores and track written as the service keeps them. */
async function stand() {
  const realNow = Date.now;
  Date.now = () => NOON * 1000;
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  let n = 0;
  const rid = () => `clgg-${String(++n).padStart(6, '0')}`;
  const stores = (m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(mac.id, mac.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, origin, qty);
  const setXp = (xp, spec100 = null) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'smithing', ?, NULL, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec100 = excluded.spec100`).run(mac.id, mac.character, xp, spec100, NOON);
  const put = (material, qty, order = 'work') => s.call('/v1/stores/deposit', { character: mac.character, material, qty, held: qty, order, rid: rid() }, mac.secret);
  const cut = (recipe, extra = {}) => s.call('/v1/prof/craft', { character: mac.character, recipe, clean: false, name: 'Silverthorn', rid: rid(), ...extra }, mac.secret);
  const fund = (marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(mac.id, marks);
  return { s, raw, mac, rid, stores, give, setXp, put, cut, fund, done: () => { Date.now = realNow; } };
}

test('CLOTH-GEMS service: a Flawless Ruby from the pack comes in by the loose door and is set in a Gold Ring - the piece walled to gold as every loose good\'s, its first the Ring\'s at tier 3; the counted doors move none; a withdrawal gives it back; no buy order and no Stores listing names a graded gem; a Lapidary\'s cracked gem is no Perfect; a Wand\'s 82 kin are one bind (mutants: the kin\'s bind, the market\'s wall)', async () => {
  const w = await stand();
  try {
    const { raw, mac, stores, give, setXp, put, cut, fund, s, rid } = w;
    // the counted doors: the service never handed a graded gem out, so the Stores page's Put in and a writ's move none
    assert.deepEqual((await put('gem:flawless-ruby', 1, 'all')).body.error, 'carried-short');
    assert.deepEqual((await put('gem:flawless-ruby', 1, 'spend')).body.error, 'carried-short');
    // a station's shortfall: the pack's gem, loose
    const loose = await put('gem:flawless-ruby', 2);
    assert.deepEqual([loose.status, loose.body.loose, stores('gem:flawless-ruby')], [200, 2, [[LOOSE_ORIGIN, 2]]]);
    give('metal:gold', 'own', 3);
    setXp(26 * 26 * 10);
    const ring = await cut('ring:gold:flawless-ruby');
    assert.equal(ring.status, 200, JSON.stringify(ring.body));
    assert.deepEqual([ring.body.recipe, ring.body.first, ring.body.firstPaid, stores('gem:flawless-ruby'), stores('metal:gold')], ['ring:gold:flawless-ruby', true, true, [[LOOSE_ORIGIN, 1]], [['own', 2]]]);
    const p = raw.prepare('SELECT recipe, bought_with, loose FROM products WHERE provenance = ?').get(ring.body.pieces[0].provenance);
    assert.deepEqual([p.recipe, p.bought_with, Number(p.loose)], ['ring:gold:flawless-ruby', 'gold', 1], 'a piece of loose goods: for gold alone');
    const again = await cut('ring:gold');
    assert.deepEqual([again.status, again.body.first], [200, false], 'the Ring at tier 3 was made - one first, whatever the gem\'s grade');
    // a withdrawal gives the loose gem back to the pack, uncounted
    const back = await s.call('/v1/stores/withdraw', { character: mac.character, material: 'gem:flawless-ruby', qty: 1, held: 0, carry: true, rid: rid() }, mac.secret);
    assert.deepEqual([back.status, back.body.qty, stores('gem:flawless-ruby'), back.body.carried?.own ?? 0], [200, 1, [], 0]);
    // the market: no buy order, no Stores listing
    fund(1000);
    const DF = 17, HUBS = { [DF]: [207, 212], 23: [590, 166] };
    const order = await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'gem:perfect-amber', units: 1, price: 5, hubs: HUBS, rid: rid() }, mac.secret);
    assert.equal(order.body.error, 'bad-material');
    const ruby = await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'gem:ruby', units: 1, price: 5, hubs: HUBS, rid: rid() }, mac.secret);
    assert.equal(ruby.status, 200, 'a plain Ruby is every door\'s, as it was');
    await put('gem:chipped-jade', 1);
    const list = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'material', material: 'gem:chipped-jade', units: 1, price: 5, hubs: HUBS, rid: rid() }, mac.secret);
    assert.equal(list.body.error, 'bad-material');
    // a Lapidary's cracked gem stands in for a plain gem alone
    setXp(100 * 100 * 10, 'lapidary');
    give('gem:siege', 'own', 1);
    assert.equal((await cut('ring:gold:perfect-ruby', { cracked: true })).body.error, 'prof-lapidary');
    assert.equal((await cut('ring:gold:emerald', { cracked: true })).status, 200);
    // a Wand's pattern at tier 6 is 82 recipes - read as one bind (at rank 70, the Wand's own, with room for its XP)
    setXp(70 * 70 * 10);
    give('plank:ironwood', 'own', 2);
    give('plank:ghostwood', 'own', 2);
    await put('gem:perfect-amber', 1);
    const wand = await cut('wand:ironwood:perfect-amber');
    assert.deepEqual([wand.status, wand.body.first, wand.body.xp], [200, true, 6 * 20 + 500], JSON.stringify(wand.body));   // PIN MOVED (FIRST-BUDGET, Professions-Arc 52): Smithing's share, the 500 it always was
    assert.equal(firstCraftXp(recipeById('wand:ironwood:perfect-amber')), 500);
    give('gem:ruby', 'own', 1);
    const second = await cut('wand:ghostwood:ruby');
    assert.deepEqual([second.status, second.body.first], [200, false], 'the other wood, a plain gem: the same first');
  } finally {
    w.done();
  }
});
