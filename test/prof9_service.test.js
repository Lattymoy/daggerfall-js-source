// PROF9 (2026-10-02) - COOKING AS THE SERVICE KEEPS IT: a dish on the craft route (/v1/prof/craft) - its inputs out of the
// Stores (bought first), no quality (-1), a piece a serving with its signed record (a Cook's two), Cooking's XP at the
// rank's own tier (a clean pan half again, the first time's 500), its rank asked; the cook's hand at 100 (a Chef's feast,
// a Provisioner's dish) signed into the record (`f`) and kept on the piece (0069's `products.hand`) and answered; the
// market's Crafted view carrying the hand; the crafter's limit. Driven through the real Worker over node:sqlite with every
// migration applied (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 3.2, 3.3, 9.3, 35.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { xpForRank, topTierOf, PROF_XP_MAX, JOURNEYMAN_RANK } from '../src/net/professionLaw.js';
import { cookXp, FIRST_CRAFT_XP } from '../src/net/recipeLaw.js';
import { readProductRecord, verifyProductRecord } from '../src/net/productRecord.js';
import { ACCOUNT_VERSION } from '../server-account/src/service.js';

let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `cook-${String(++_rid).padStart(6, '0')}`;
const DF = 17;
const HUBS = { [DF]: [207, 212], 23: [590, 166] };
const STEW = [['food:meat', 2], ['food:mushroom', 1], ['p1:13', 1]];
const FEAST = [['food:meat', 4], ['food:fish', 4], ['food:apple', 2], ['food:orange', 2], ['food:mushroom', 2], ['food:egg', 2]];

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  /** `times` of a recipe's inputs ADDED to what the Stores hold. */
  const stock = (who, list, times = 1, origin = 'own') => {
    for (const [m, n] of list) raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(who.id, who.character, m, origin, n * times);
  };
  const xpOf = (who, prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, xp, prof, { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, prof, xp, spec50, spec100, _now);
  const cook = (who, recipe, extra2 = {}) => s.call('/v1/prof/craft', { character: who.character, recipe, clean: false, name: 'Silverthorn', rid: rid(), ...extra2 }, who.secret);
  const product = (p) => raw.prepare('SELECT * FROM products WHERE provenance = ?').get(p);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  return { ...s, raw, stores, give, stock, xpOf, setXp, cook, product, fund };
}

// ─── A DISH (9.3) ────────────────────────────────────────────────────

test('PROF9 service: a Hunter\'s Stew at the fire - its Raw Meat, Mushroom and Root Bulb out of the Stores (bought first), one piece with its signed record, no quality, its maker; Cooking XP 20 at rank 0 and the first time\'s 500, credited; asked twice one, nothing moved; the next stew no 500, a clean pan half again; the southern Stew the same dish - no 500 (AUDIT PROF-541 R2-S7)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.stock(mac, STEW, 3);
  s.give(mac, 'food:meat', 'bought', 1);
  const ask = { character: mac.character, recipe: 'stew:north', clean: false, name: 'Silverthorn', rid: rid() };
  const r = await s.call('/v1/prof/craft', ask, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.recipe, r.body.quality, r.body.count, r.body.maker, r.body.marked, r.body.first, r.body.xp, r.body.hand], ['stew:north', -1, 1, 'Silverthorn', false, true, 20 + FIRST_CRAFT_XP, null]);
  assert.deepEqual([r.body.track.profession, r.body.track.xp], ['cooking', 520]);
  assert.equal(r.body.pieces.length, 1);
  const p = r.body.pieces[0];
  const v = await verifyProductRecord(p.record, s.identityPublic, { subtle: globalThis.crypto.subtle });
  assert.deepEqual([v.ok, v.claims?.r, v.claims?.q, v.claims?.m, v.claims?.f], [true, 'stew:north', -1, 'Silverthorn', undefined], 'signed; no hand');
  const row = s.product(p.provenance);
  assert.deepEqual([row.owner, row.char_id, row.recipe, row.template, row.material, row.quality, row.hand], [mac.id, mac.character, 'stew:north', 685, 0, -1, null]);
  assert.deepEqual([s.stores(mac, 'food:meat'), s.stores(mac, 'food:mushroom'), s.stores(mac, 'p1:13')], [[['own', 5]], [['own', 2]], [['own', 2]]], 'the bought Raw Meat spent first');
  assert.deepEqual(r.body.stores.map((st) => st.material).sort(), ['food:meat', 'food:mushroom', 'p1:13']);
  const again = await s.call('/v1/prof/craft', ask, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.xp, again.body.pieces[0].provenance], [true, 520, p.provenance], 'asked twice: the row\'s answer');
  assert.deepEqual([s.stores(mac, 'food:meat'), s.xpOf(mac, 'cooking')], [[['own', 5]], 520], 'nothing moved twice');
  const second = await s.cook(mac, 'stew:north');
  assert.deepEqual([second.body.first, second.body.xp], [false, 20], 'the second stew: no 500');
  const clean = await s.cook(mac, 'stew:north', { clean: true });
  assert.deepEqual([clean.body.xp, clean.body.quality], [30, -1], 'a clean pan: half again, never a quality');
  assert.deepEqual((await s.cook(mac, 'stew:north')).body, { error: 'stores-short' }, 'the Root Bulb gone');
  assert.equal(s.xpOf(mac, 'cooking'), 520 + 20 + 30);
  assert.deepEqual((await s.cook(mac, 'stew:south')).body, { error: 'stores-short' }, 'the southern Root Bulb is its own material');
  // AUDIT PROF-541 R2-S7: the southern Stew is the same dish - its first no 500 (Mac's J7: once per piece and base); a
  // Supper, another dish, its own 500 - north first, then south none
  s.give(mac, 'p2:13', 'own', 1);
  s.stock(mac, [['food:meat', 2], ['food:mushroom', 1]]);
  const south = await s.cook(mac, 'stew:south');
  assert.deepEqual([south.status, south.body.first, south.body.xp], [200, false, 20], 'the southern Stew: no 500');
  s.stock(mac, [['food:fish', 2], ['food:egg', 1], ['p2:9', 1]], 2);
  s.give(mac, 'p1:9', 'own', 1);
  const supN = await s.cook(mac, 'supper:north');
  assert.deepEqual([supN.status, supN.body.first, supN.body.xp], [200, true, 20 + FIRST_CRAFT_XP], 'a Supper: its own 500');
  const supS = await s.cook(mac, 'supper:south');
  assert.deepEqual([supS.status, supS.body.first, supS.body.xp], [200, false, 40], 'the southern Supper: none (the rank\'s tier 2 now - 20 x 2)');
  assert.match(ACCOUNT_VERSION, /^acct82$/   /* PIN MOVED (PROF10, PROF12, AUDIT PROF-541, SILVER-WAYS' acct71, the arena merge's acct72, AEGIS's acct73, BAG1 and GUILD2's acct74, HOME-PRICE's acct75, PRIMARCH and FOUNDER4's acct76, FIELD BUGS 2026-10-04d KNIGHT-HOUSE's acct77, SERPENT1's acct78, GLOBAL-MARKET's acct79, SHADOW-CLOAK's acct80, SERAPH-WINGS' acct81, AUDIT ARENA-LADDER's acct82): the live version */);
});

test('PROF9 service: a dish\'s rank is asked (the Tart 10, the Feast 70 - refused below, nothing spent); XP follows the rank - a stew at rank 55 is 20 x tier 5, never a quarter; a Master\'s full track credits none, answered so', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.stock(mac, [['food:apple', 2], ['food:egg', 1], ['p2:17', 1]]);
  s.stock(mac, FEAST);
  assert.deepEqual([(await s.cook(mac, 'tart:south')).status, (await s.cook(mac, 'tart:south')).body], [403, { error: 'prof-rank' }]);
  assert.deepEqual([s.stores(mac, 'food:apple'), s.raw.prepare('SELECT COUNT(*) AS n FROM prof_crafts').get().n], [[['own', 4]], 0], 'refused before anything moved');
  s.setXp(mac, xpForRank(10), 'cooking');
  const tart = await s.cook(mac, 'tart:south');
  assert.deepEqual([tart.status, tart.body.xp, s.stores(mac, 'p2:17')], [200, 40 + FIRST_CRAFT_XP, []]);
  s.setXp(mac, xpForRank(69), 'cooking');
  assert.deepEqual((await s.cook(mac, 'feast:hearth')).body, { error: 'prof-rank' });
  s.setXp(mac, xpForRank(55), 'cooking');
  s.stock(mac, STEW);
  const at55 = await s.cook(mac, 'stew:north');
  assert.deepEqual([at55.body.xp, topTierOf(55)], [5 * 20 + FIRST_CRAFT_XP, 5]);
  assert.equal(at55.body.xp, cookXp(55) + FIRST_CRAFT_XP);
  s.setXp(mac, PROF_XP_MAX, 'cooking');
  s.stock(mac, STEW);
  const full = await s.cook(mac, 'stew:north', { clean: true });
  assert.deepEqual([full.status, full.body.xp, s.xpOf(mac, 'cooking')], [200, 0, PROF_XP_MAX]);
});

test('PROF9 service: the cook\'s choices - a Cook\'s dish two servings, each its own piece and record (3.3: "+1 serving a dish"), its XP the cook\'s, not the servings\'; a Provisioner\'s dish carries its hand 2 (record and piece); a Chef\'s feast its hand 1, a Chef\'s stew none', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(50), 'cooking', { spec50: 'cook' });
  s.stock(mac, STEW, 2);
  const two = await s.cook(mac, 'stew:north');
  assert.equal(two.status, 200, JSON.stringify(two.body));
  assert.deepEqual([two.body.count, two.body.pieces.length, two.body.xp], [2, 2, cookXp(50) + FIRST_CRAFT_XP]);
  assert.notEqual(two.body.pieces[0].provenance, two.body.pieces[1].provenance);
  assert.deepEqual(two.body.pieces.map((p) => readProductRecord(p.record)?.r), ['stew:north', 'stew:north']);
  assert.deepEqual(two.body.pieces.map((p) => s.product(p.provenance)?.owner), [mac.id, mac.id]);
  assert.deepEqual(s.stores(mac, 'food:meat'), [['own', 2]], 'one cook\'s inputs');
  // the Provisioner
  s.setXp(mac, xpForRank(100), 'cooking', { spec50: null, spec100: 'provisioner' });
  const prov = await s.cook(mac, 'stew:north');
  assert.deepEqual([prov.body.hand, prov.body.count], [2, 1]);
  assert.deepEqual([readProductRecord(prov.body.pieces[0].record).f, s.product(prov.body.pieces[0].provenance).hand], [2, 2]);
  // the Chef: a feast's hand, a stew's none
  s.setXp(mac, xpForRank(100), 'cooking', { spec100: 'chef' });
  s.stock(mac, FEAST);
  s.stock(mac, STEW);
  const feast = await s.cook(mac, 'feast:hearth', { clean: true });
  assert.equal(feast.status, 200, JSON.stringify(feast.body));
  assert.deepEqual([feast.body.hand, readProductRecord(feast.body.pieces[0].record).f, s.product(feast.body.pieces[0].provenance).hand], [1, 1, 1]);
  assert.equal(feast.body.xp, 0, 'a Master\'s track: full');
  const stew = await s.cook(mac, 'stew:north');
  assert.deepEqual([stew.body.hand, readProductRecord(stew.body.pieces[0].record).f, s.product(stew.body.pieces[0].provenance).hand], [null, undefined, null]);
});

test('PROF9 service: the crafter\'s limit holds Cooking at Journeyman while two other crafts stand past it - credited to the cap, answered so', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(60), 'smithing');
  s.setXp(mac, xpForRank(60), 'carpentry');
  s.setXp(mac, xpForRank(JOURNEYMAN_RANK + 1) - 10, 'cooking');
  s.stock(mac, STEW);
  const r = await s.cook(mac, 'stew:north');
  assert.deepEqual([r.status, r.body.xp, s.xpOf(mac, 'cooking')], [200, 9, xpForRank(JOURNEYMAN_RANK + 1) - 1]);
});

test('PROF9 service: a Provisioner\'s dish lists on the market among the Dishes and is read with its hand - the Crafted view and the lister\'s own; 0069 gives every piece a hand column, none before it, and refuses a hand that is no cook\'s', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(100), 'cooking', { spec100: 'provisioner' });
  s.stock(mac, STEW);
  const made = await s.cook(mac, 'stew:north');
  const provenance = made.body.pieces[0].provenance;
  s.fund(mac, 100);
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance, wear: 1000, price: 5, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const mine = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS }, mac.secret);
  const row = mine.body.rows.find((x) => x.piece?.provenance === provenance);
  assert.deepEqual([row?.piece?.recipe, row?.piece?.hand, row?.piece?.quality], ['stew:north', 2, -1]);
  const crafted = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'crafted', hubs: HUBS }, mac.secret);
  assert.equal(crafted.body.rows.find((x) => x.piece?.provenance === provenance)?.piece?.hand, 2);
  // a plain dish reads no hand
  s.setXp(mac, xpForRank(0), 'cooking');
  s.stock(mac, STEW);
  const plain = await s.cook(mac, 'stew:north');
  const pp = plain.body.pieces[0].provenance;
  s.fund(mac, 100);
  assert.equal((await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance: pp, wear: 1000, price: 5, hubs: HUBS, rid: rid() }, mac.secret)).status, 200);
  const mine2 = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS }, mac.secret);
  assert.equal(Object.hasOwn(mine2.body.rows.find((x) => x.piece?.provenance === pp)?.piece ?? {}, 'hand'), false);
  // the column
  const cols = s.raw.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
  assert.ok(cols.includes('hand'));
  assert.throws(() => s.raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at, hand)
    VALUES ('fedcba9876543210', ?, ?, NULL, 'stew:north', 685, 0, -1, 1, 'p1.x.', 1, 3)`).run(mac.id, mac.character), /CHECK/);
});
