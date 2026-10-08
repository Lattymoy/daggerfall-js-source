// PROF11 (2026-10-01) - MASONRY AS THE SERVICE KEEPS IT: the mason's bench's works on the forge's route (/v1/prof/smelt) -
// the cut (Rough Stone 2 : 1, a Quarryman's 1 : 1) and the mix (Mortar ten at a time) - with a craft's law: their rank
// asked, their XP Masonry's at the rank's own tier, half again for a clean chisel (read only where the work has the act),
// 500 the first time, kept with the row (0060's `first` and `clean`) and answered so, asked twice one; the Stores'
// debits and credits, bought first and their origin carried; the crafter's limit; and the Sculptor's stone decor on the
// craft route (/v1/prof/craft) - refused to all but a Sculptor (`prof-sculptor`), a piece with its signed record among
// the products. Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/06-Systems/Professions-Arc.md 3.2, 3.3, 4.5, 9.3, 9.4.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { xpForRank, topTierOf, PROF_XP_MAX } from '../src/net/professionLaw.js';
import { masonXp, FIRST_CRAFT_XP, craftXp } from '../src/net/recipeLaw.js';
import { verifyProductRecord } from '../src/net/productRecord.js';
import { accountRefusalText } from '../src/net/accountClient.js';

let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `mason-${String(++_rid).padStart(6, '0')}`;

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const xpOf = (who, prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, xp, prof, { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, prof, xp, spec50, spec100, _now);
  const work = (who, recipe, count, extra2 = {}) => s.call('/v1/prof/smelt', { character: who.character, recipe, count, rid: rid(), ...extra2 }, who.secret);
  const carve = (who, recipe, extra2 = {}) => s.call('/v1/prof/craft', { character: who.character, recipe, clean: false, name: 'Silverthorn', rid: rid(), ...extra2 }, who.secret);
  return { ...s, raw, stores, give, xpOf, setXp, work, carve };
}

// ─── THE CUT (4.5) ───────────────────────────────────────────────────

test('PROF11 service: the cut - two Rough Stone a Cut Stone, own; Masonry XP 20 a cut at the rank\'s tier, 500 the first time, answered `first` and kept with the row; asked again one, nothing moved; the next cut no 500; a clean chisel half again', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'stone:rough', 'own', 20);
  const ask = { character: mac.character, recipe: 'cut:stone', count: 3, rid: rid() };
  const first = await s.call('/v1/prof/smelt', ask, mac.secret);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual([first.body.recipe, first.body.count, first.body.own, first.body.bought, first.body.first, first.body.clean], ['cut:stone', 3, 3, 0, true, false]);
  assert.equal(first.body.xp, 3 * 20 * 1 + FIRST_CRAFT_XP);
  assert.equal(first.body.xp, masonXp(3, 0, { first: true }));
  assert.deepEqual([first.body.track.profession, first.body.track.xp], ['building', 560]);   // PIN MOVED (CRAFT3): a cut is Masonry's work, credited to the Building track
  assert.deepEqual([s.stores(mac, 'stone:cut'), s.stores(mac, 'stone:rough')], [[['own', 3]], [['own', 14]]]);
  assert.deepEqual(first.body.stores.map((st) => [st.material, st.own]), [['stone:cut', 3], ['stone:rough', 14]], 'the Stores of the product and its stone answered');
  const row = s.raw.prepare('SELECT first, clean, xp, count FROM prof_smelts WHERE rid = ?').get(ask.rid);
  assert.deepEqual([row.first, row.clean, row.xp, row.count], [1, 0, 560, 3]);
  const again = await s.call('/v1/prof/smelt', ask, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.first, again.body.xp, again.body.own], [true, true, 560, 3], 'asked twice: the row\'s answer');
  assert.deepEqual([s.stores(mac, 'stone:cut'), s.stores(mac, 'stone:rough'), s.xpOf(mac, 'building')], [[['own', 3]], [['own', 14]], 560], 'nothing moved twice');   // PIN MOVED (CRAFT3): the Building track's row
  const second = await s.work(mac, 'cut:stone', 2);
  assert.deepEqual([second.body.first, second.body.xp, second.body.clean], [false, 40, false], 'the second cut: no 500');
  const clean = await s.work(mac, 'cut:stone', 2, { clean: true });
  assert.deepEqual([clean.body.clean, clean.body.xp, clean.body.first], [true, 60, false], 'a clean chisel: half again');
  assert.equal(s.raw.prepare('SELECT clean FROM prof_smelts WHERE player = ? ORDER BY at DESC, rowid DESC LIMIT 1').get(mac.id).clean, 1);
  const notTrue = await s.work(mac, 'cut:stone', 1, { clean: 'yes' });
  assert.deepEqual([notTrue.body.clean, notTrue.body.xp], [false, 20], 'only `true` is clean');
  assert.equal(s.xpOf(mac, 'building'), 560 + 40 + 60 + 20);   // PIN MOVED (CRAFT3): the Building track's row
  assert.deepEqual(s.stores(mac, 'stone:rough'), [['own', 4]]);
  assert.deepEqual(s.stores(mac, 'stone:cut'), [['own', 8]]);
});

test('PROF11 service: XP follows the rank - a cut at rank 55 is 20 x tier 5, never a quarter; a Quarryman\'s cut (a choice at 50) is two Cut Stone of two Rough Stone, its XP the work\'s, not the product\'s', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'stone:rough', 'own', 40);
  s.setXp(mac, xpForRank(55), 'building');   // PIN MOVED (CRAFT3): a cut reads the Building track's rank
  const r = await s.work(mac, 'cut:stone', 4);
  assert.deepEqual([r.status, r.body.own, r.body.xp], [200, 4, 4 * 20 * topTierOf(55) + FIRST_CRAFT_XP]);
  assert.equal(topTierOf(55), 5);
  s.setXp(mac, xpForRank(50), 'building', { spec50: 'quarryman' });   // PIN MOVED (CRAFT3): the Quarryman stands under Building
  const q = await s.work(mac, 'cut:stone', 5);
  assert.deepEqual([q.body.own, q.body.xp, s.stores(mac, 'stone:rough')], [10, 5 * 20 * 4, [['own', 22]]], 'a Quarryman\'s 1 : 1');
  s.setXp(mac, xpForRank(100), 'building', { spec50: 'quarryman', spec100: 'sculptor' });   // PIN MOVED (CRAFT3): the Building track
  const m = await s.work(mac, 'cut:stone', 1);
  assert.deepEqual([m.body.own, m.body.xp, s.xpOf(mac, 'building')], [2, 0, PROF_XP_MAX], 'a Master\'s track is full: credited none, answered so');   // PIN MOVED (CRAFT3): the Building track's row
});

// ─── THE MIX (4.5) ───────────────────────────────────────────────────

test('PROF11 service: the mix - Mortar asks rank 10 (refused below it, nothing moved); a Sulphur, a Lead and five Rough Stone make ten Mortar; bought stone makes bought Mortar, spent first; the Stores short and full refused', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'stone:rough', 'own', 10);
  s.give(mac, 'metal:sulphur', 'own', 3);
  s.give(mac, 'metal:lead', 'own', 3);
  const low = await s.work(mac, 'mix:mortar', 1);
  assert.deepEqual([low.status, low.body], [403, { error: 'prof-rank' }]);
  assert.deepEqual([s.stores(mac, 'stone:rough'), s.stores(mac, 'stone:mortar'), s.raw.prepare('SELECT COUNT(*) AS n FROM prof_smelts').get().n], [[['own', 10]], [], 0], 'refused before anything moved');
  s.setXp(mac, xpForRank(10), 'building');   // PIN MOVED (CRAFT3): the mix reads the Building track's rank
  const mix = await s.work(mac, 'mix:mortar', 2);
  assert.equal(mix.status, 200, JSON.stringify(mix.body));
  assert.deepEqual([mix.body.own, mix.body.bought, mix.body.first, mix.body.xp], [20, 0, true, 2 * 20 * 2 + FIRST_CRAFT_XP]);
  assert.deepEqual([s.stores(mac, 'stone:mortar'), s.stores(mac, 'stone:rough'), s.stores(mac, 'metal:sulphur'), s.stores(mac, 'metal:lead')], [[['own', 20]], [], [['own', 1]], [['own', 1]]]);
  // bought Rough Stone: spent first, and a mix it went into is bought
  s.give(mac, 'stone:rough', 'bought', 5);
  s.give(mac, 'stone:rough', 'own', 5);
  const bought = await s.work(mac, 'mix:mortar', 1);
  assert.deepEqual([bought.body.own, bought.body.bought, bought.body.first], [0, 10, false]);
  assert.deepEqual([s.stores(mac, 'stone:mortar'), s.stores(mac, 'stone:rough')], [[['bought', 10], ['own', 20]], [['own', 5]]]);
  // short: the Lead gone
  assert.deepEqual((await s.work(mac, 'mix:mortar', 1)).body, { error: 'stores-short' }, 'the Lead gone');
  s.give(mac, 'metal:lead', 'own', 1);
  s.give(mac, 'metal:sulphur', 'own', 1);
  s.give(mac, 'stone:mortar', 'own', 4_985);
  assert.deepEqual((await s.work(mac, 'mix:mortar', 1)).body, { error: 'stores-full' }, 'ten more past the Stores\' 5,000');
  assert.deepEqual([(await s.work(mac, 'mix:mortar', 0)).body, (await s.work(mac, 'mix:mortar', 101)).body, (await s.work(mac, 'mix:sand', 1)).body],
    [{ error: 'bad-qty' }, { error: 'bad-qty' }, { error: 'bad-recipe' }]);
});

test('PROF11 service: a clean report is read only where the work has the chisel - a smelt asked clean is a smelt (Smithing\'s 10 a tier a unit, no first, no `clean` answered); a log sawn clean earns nothing', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'metal:iron', 'own', 4);
  const smelt = await s.work(mac, 'ingot:iron', 2, { clean: true });
  assert.equal(smelt.status, 200, JSON.stringify(smelt.body));
  assert.deepEqual([smelt.body.xp, 'first' in smelt.body, 'clean' in smelt.body, smelt.body.track.profession], [20, false, false, 'smithing']);
  assert.deepEqual({ ...s.raw.prepare('SELECT first, clean FROM prof_smelts WHERE recipe = ?').get('ingot:iron') }, { first: 0, clean: 0 });
  s.give(mac, 'log:pine', 'own', 1);
  const saw = await s.work(mac, 'saw:pine', 1, { clean: true });
  assert.deepEqual([saw.body.xp, saw.body.own, s.xpOf(mac, 'building')], [0, 2, 0]);   // PIN MOVED (CRAFT3): the chisel's works credit the Building track - a 'masonry' row is read by nothing
});

test('PROF11 service: the crafter\'s limit holds Masonry at 50 while two other crafts stand past it - credited to the cap, answered so', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(60), 'smithing');
  s.setXp(mac, xpForRank(70), 'provisioning');   // PIN MOVED (CRAFT3): Carpentry is Building's with Masonry now - the second other craft past 50 is Provisioning
  s.setXp(mac, xpForRank(51) - 50, 'building');   // PIN MOVED (CRAFT3): Masonry's XP is the Building track's
  s.give(mac, 'stone:rough', 'own', 20);
  const r = await s.work(mac, 'cut:stone', 5);
  assert.deepEqual([r.status, r.body.xp, s.xpOf(mac, 'building')], [200, 49, xpForRank(51) - 1], 'one short of 51');   // PIN MOVED (CRAFT3): the Building track's row
  const more = await s.work(mac, 'cut:stone', 1);
  assert.deepEqual([more.body.xp, s.xpOf(mac, 'building')], [0, xpForRank(51) - 1]);   // PIN MOVED (CRAFT3): the Building track's row
});

// ─── THE SCULPTOR'S STONE DECOR (3.3, 9.3) ───────────────────────────

test('PROF11 service: the stone decor is a Sculptor\'s - refused (`prof-sculptor`, 403) to a Master who chose otherwise and to a Novice, nothing spent; a Sculptor carves a Stone Column of 12 Cut Stone and 3 Mortar - a piece with its signed record among the products, furniture\'s worth, a clean chisel a step', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'stone:cut', 'own', 30);
  s.give(mac, 'stone:mortar', 'own', 10);
  const novice = await s.carve(mac, 'column:stone');
  assert.deepEqual([novice.status, novice.body], [403, { error: 'prof-sculptor' }]);
  s.setXp(mac, PROF_XP_MAX, 'building', { spec50: 'quarryman', spec100: 'fortifier' });   // PIN MOVED (CRAFT3): the choices stand under the Building track
  const fortifier = await s.carve(mac, 'column:stone');
  assert.deepEqual([fortifier.status, fortifier.body], [403, { error: 'prof-sculptor' }], 'a Master is not a Sculptor by rank');
  assert.deepEqual([s.stores(mac, 'stone:cut'), s.raw.prepare('SELECT COUNT(*) AS n FROM prof_crafts').get().n], [[['own', 30]], 0], 'nothing spent, nothing written');
  s.setXp(mac, PROF_XP_MAX, 'building', { spec50: 'quarryman', spec100: 'sculptor' });   // PIN MOVED (CRAFT3): the Sculptor stands under the Building track
  const ask = { character: mac.character, recipe: 'column:stone', clean: true, name: 'Silverthorn', rid: rid() };
  const col = await s.call('/v1/prof/craft', ask, mac.secret);
  assert.equal(col.status, 200, JSON.stringify(col.body));
  assert.deepEqual([col.body.recipe, col.body.count, col.body.first, col.body.xp, col.body.track.profession], ['column:stone', 1, true, 0, 'building'], 'a Master\'s track is full');   // PIN MOVED (CRAFT3): a carving answers the Building track
  assert.ok(col.body.quality >= 2, `a Master's margin and a clean chisel: Fine at the least (${col.body.quality})`);
  assert.deepEqual([s.stores(mac, 'stone:cut'), s.stores(mac, 'stone:mortar')], [[['own', 18]], [['own', 7]]]);
  const prov = col.body.pieces[0].provenance;
  const product = s.raw.prepare('SELECT template, material, recipe, owner, maker FROM products WHERE provenance = ?').get(prov);
  assert.deepEqual([product.template, product.material, product.recipe, product.owner, product.maker], [696, 0, 'column:stone', mac.id, 'Silverthorn']);
  const v = await verifyProductRecord(col.body.pieces[0].record, s.identityPublic, { subtle: globalThis.crypto.subtle });
  assert.deepEqual([v.ok, v.claims?.r], [true, 'column:stone']);
  const again = await s.call('/v1/prof/craft', ask, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.pieces[0].provenance], [true, prov], 'asked twice: one column');
  // the plain carving: the next, no first
  const plinth = await s.carve(mac, 'plinth:stone');
  assert.deepEqual([plinth.status, plinth.body.first], [200, true]);
  const plinth2 = await s.carve(mac, 'plinth:stone');
  assert.deepEqual([plinth2.body.first, s.stores(mac, 'stone:cut'), s.stores(mac, 'stone:mortar')], [false, [['own', 6]], [['own', 3]]]);
  assert.deepEqual((await s.carve(mac, 'column:stone')).body, { error: 'stores-short' });
  assert.equal(craftXp(2, 100, false), 10, 'a carving\'s craft XP, quartered at a Master\'s rank - nothing past a full track');
  assert.match(accountRefusalText('prof-sculptor'), /Sculptor/);
});

test('PROF11 service: 0060 gives the forge\'s table its `first` and `clean` - every row before it neither - and the index the decision reads a work\'s first by', async () => {
  const s = await stand();
  const cols = s.raw.prepare('PRAGMA table_info(prof_smelts)').all().map((c) => [c.name, c.dflt_value, c.notnull]);
  assert.deepEqual(cols.filter(([n]) => n === 'first' || n === 'clean'), [['first', '0', 1], ['clean', '0', 1]]);
  const idx = s.raw.prepare('PRAGMA index_list(prof_smelts)').all().map((i) => i.name);
  assert.ok(idx.includes('idx_prof_smelts_recipe'), idx.join());
  assert.deepEqual(s.raw.prepare('PRAGMA index_info(idx_prof_smelts_recipe)').all().map((c) => c.name), ['player', 'char_id', 'recipe']);
  const mac = await s.registered('Mac');
  s.raw.prepare(`INSERT INTO prof_smelts (player, rid, char_id, recipe, count, own, bought, xp, at, n) VALUES (?, 'old-row-01', ?, 'ingot:iron', 1, 1, 0, 10, ?, 'n')`).run(mac.id, mac.character, _now);
  assert.deepEqual({ ...s.raw.prepare('SELECT first, clean FROM prof_smelts WHERE rid = ?').get('old-row-01') }, { first: 0, clean: 0 });
  assert.throws(() => s.raw.prepare(`INSERT INTO prof_smelts (player, rid, char_id, recipe, count, own, bought, xp, at, n, first) VALUES (?, 'bad-row-01', ?, 'cut:stone', 1, 1, 0, 10, ?, 'n', 2)`).run(mac.id, mac.character, _now), /CHECK/);
});
