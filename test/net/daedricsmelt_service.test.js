// DAEDRIC-SMELT (2026-10-25; bible/06-Systems/Professions-Arc.md section 53) - THE DAEDRIC SMELT AS THE ACCOUNT SERVICE
// KEEPS IT: a looted heart into the Stores by a station's put-in alone, loose (never by the Stores page's counted order,
// never onto the market); the smelt's decision asks the account's purse for the ember (its gates', serpents' and
// Redoubts' embers less what its insignia, the Panoply and the forge took - accounts.js insigniaPurse) and spends it in
// the same batch (`insignia_spent`), so two smelts pressed at once never spend one ember twice; refused `prof-embers`
// with the purse left; the heart a catalyst (the ingot's origin its Ebony Ingot's); and the ingot then reaches the anvil
// and the market. Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { xpForRank, DAEDRA_HEART } from '../../src/net/professionLaw.js';
import { insigniaPurse } from '../../server-account/src/accounts.js';
import { utcDay } from '../../src/net/marksLaw.js';

const DAY = 86_400;
let _now = utcDay(T0) * DAY + 13 * 3600;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = (p = 'ds') => `${p}-${String(++_rid).padStart(6, '0')}`;
const DF = 17, WR = 23;
const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
const HEART = DAEDRA_HEART.key;

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac,Sab' });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const setXp = (who, prof, xp, spec100 = null) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec100 = excluded.spec100`).run(who.id, who.character, prof, xp, spec100, _now);
  // the account's embers: one a gate closed, as claimGate writes its row (gate_kills `stones`, 1 by default - WB5b, 0066)
  let day = 1000;
  const embers = (who, n) => { const ins = raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at) VALUES (?, ?, 'ruhn', 'dealt', ?)"); for (let i = 0; i < n; i++) ins.run(day++, who.id, T0); };
  const spent = (who) => Number(raw.prepare('SELECT insignia_spent AS n FROM players WHERE id = ?').get(who.id).n);
  const purse = async (who) => insigniaPurse({ db: s.env.DB }, raw.prepare('SELECT * FROM players WHERE id = ?').get(who.id));
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  return { ...s, raw, stores, give, setXp, embers, spent, purse, fund };
}
const smelt = (who, extra = {}) => ({ character: who.character, recipe: 'ingot:daedric', count: 1, rid: rid(), ...extra });
const putIn = (who, order, extra = {}) => ({ character: who.character, material: HEART, qty: 1, held: 1, order, rid: rid('dp'), ...extra });

test('DAEDRIC-SMELT service: a looted heart enters the Stores through the LOOSE door alone - a station\'s put-in, never the Stores page\'s counted order nor a writ\'s - and never reaches the market: no order for one is taken, no listing of one stands (mutants: the loose door for every order; the heart in the catalogue)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  for (const order of ['all', 'spend']) {
    const r = await s.call('/v1/stores/deposit', putIn(mac, order), mac.secret);
    assert.equal(r.body.error, 'carried-short', `${order}: the service counted no heart into this pack`);
  }
  assert.deepEqual(s.stores(mac, HEART), [], 'nothing moved');
  const w = await s.call('/v1/stores/deposit', putIn(mac, 'work'), mac.secret);
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal(w.body.loose, 1);
  assert.deepEqual(s.stores(mac, HEART), [['loose', 1]], 'a station\'s alone (bagLaw.js STATION_ORIGINS)');
  s.fund(mac, 1000);
  const o = await s.call('/v1/market/order', { character: mac.character, region: DF, material: HEART, units: 1, price: 10, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(o.body.error, 'bad-material', 'an escrow held a week for goods no door of the service counts - the loose door\'s, as CLOTH-GEMS\' graded gems are');
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'material', material: HEART, units: 1, price: 5, hubs: HUBS, rid: rid() }, mac.secret);
  assert.ok(l.status >= 400, `a loose heart is listed by no one: ${JSON.stringify(l.body)}`);
  assert.deepEqual(s.stores(mac, HEART), [['loose', 1]], 'still the station\'s');
});

test('DAEDRIC-SMELT service: the smelt - an Ebony Ingot, a loose heart and an ember from the account\'s purse make a Daedric Ingot, OWN as its Ebony Ingot was; Smithing\'s 70; the ember spent in the same batch (`insignia_spent`) and the purse said; asked twice one; a purse short refused `prof-embers` with nothing moved (mutants: the purse unasked; the ember unspent; the catalyst counted; the refusal said as the Stores\')', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.give(mac, 'ingot:ebony', 'own', 3);
  s.give(mac, HEART, 'loose', 3);
  // no ember in the purse: refused
  const none = await s.call('/v1/prof/smelt', smelt(mac), mac.secret);
  assert.deepEqual([none.status, none.body], [409, { error: 'prof-embers' }]);
  assert.deepEqual([s.stores(mac, 'ingot:ebony'), s.stores(mac, HEART), s.stores(mac, 'ingot:daedric')], [[['own', 3]], [['loose', 3]], []], 'nothing moved');
  s.embers(mac, 2);
  assert.equal(await s.purse(mac), 2);
  const body = smelt(mac);
  const r = await s.call('/v1/prof/smelt', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.recipe, r.body.count, r.body.own, r.body.bought, r.body.loose, r.body.xp, r.body.embers, r.body.purse], ['ingot:daedric', 1, 1, 0, undefined, 70, 1, 1]);
  assert.deepEqual([s.stores(mac, 'ingot:daedric'), s.stores(mac, 'ingot:ebony'), s.stores(mac, HEART)], [[['own', 1]], [['own', 2]], [['loose', 2]]], 'own: the loose heart gave the ingot no origin');
  assert.deepEqual([s.spent(mac), await s.purse(mac)], [1, 1], 'the ember spent from the purse the Broker reads');
  const again = await s.call('/v1/prof/smelt', body, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.embers, s.spent(mac)], [true, 1, 1], 'once');
  // two more asked, one ember left: the purse refuses
  const two = await s.call('/v1/prof/smelt', smelt(mac, { count: 2 }), mac.secret);
  assert.deepEqual(two.body, { error: 'prof-embers' });
  assert.equal(s.spent(mac), 1);
  // the inputs short is the Stores' word still, the purse full or not
  const short = await s.call('/v1/prof/smelt', smelt(mac, { count: 3 }), mac.secret);
  assert.equal(short.body.error, 'stores-short');
});

test('DAEDRIC-SMELT service: two smelts pressed at once with one ember in the purse - one made, one refused; the ember spent once (mutants: the purse read before the batch, not in the decision)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.give(mac, 'ingot:ebony', 'own', 2);
  s.give(mac, HEART, 'loose', 2);
  s.embers(mac, 1);
  const [a, b] = await Promise.all([s.call('/v1/prof/smelt', smelt(mac), mac.secret), s.call('/v1/prof/smelt', smelt(mac), mac.secret)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal([a, b].find((x) => x.status === 409).body.error, 'prof-embers');
  assert.deepEqual([s.spent(mac), await s.purse(mac), s.stores(mac, 'ingot:daedric')], [1, 0, [['own', 1]]]);
});

test('DAEDRIC-SMELT service: the ingot\'s origin is its Ebony Ingot\'s - a bought one\'s bought, a loose one\'s loose; a Quartermaster makes two a unit for one ember a unit; the purse spent is the Broker\'s purse (mutants: the catalyst counted; the embers a product\'s not a unit\'s)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.embers(mac, 10);
  s.give(mac, 'ingot:ebony', 'bought', 1);
  s.give(mac, HEART, 'own', 1);   // were a heart ever counted, its origin still none of the ingot's
  const b = await s.call('/v1/prof/smelt', smelt(mac), mac.secret);
  assert.deepEqual([b.body.own, b.body.bought], [0, 1], 'a bought Ebony Ingot, a bought Daedric');
  s.give(mac, 'ingot:ebony', 'loose', 1);
  s.give(mac, HEART, 'loose', 1);
  const l = await s.call('/v1/prof/smelt', smelt(mac), mac.secret);
  assert.deepEqual([l.body.own, l.body.bought, l.body.loose], [0, 0, 1], 'a loose Ebony Ingot, a loose Daedric - a station\'s alone');
  const sab = await s.seated('Sab');
  s.embers(sab, 3);
  s.setXp(sab, 'smithing', xpForRank(100), 'quartermaster');
  s.give(sab, 'ingot:ebony', 'own', 2);
  s.give(sab, HEART, 'loose', 2);
  const q = await s.call('/v1/prof/smelt', smelt(sab, { count: 2 }), sab.secret);
  assert.equal(q.status, 200, JSON.stringify(q.body));
  assert.deepEqual([q.body.own, q.body.embers, q.body.purse, s.stores(sab, 'ingot:daedric')], [4, 2, 1, [['own', 4]]], 'two ingots a unit, an ember a unit');
  assert.equal(await s.purse(sab), 1, 'what the Broker\'s sale would read');
});

test('DAEDRIC-SMELT service: the smelted ingot reaches the anvil and the market - a Daedric Dagger made at Smithing 90 from it, and an ingot listed and an order for one taken (the 27 works were unreachable) (mutants: the ingot unyielded again)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.embers(mac, 2);
  s.give(mac, 'ingot:ebony', 'own', 2);
  s.give(mac, HEART, 'loose', 2);
  assert.equal((await s.call('/v1/prof/smelt', smelt(mac, { count: 2 }), mac.secret)).status, 200);
  s.setXp(mac, 'smithing', xpForRank(90));
  s.give(mac, 'metal:tin', 'own', 1);
  const d = await s.call('/v1/prof/craft', { character: mac.character, recipe: 'dagger:daedric', clean: false, name: 'Mac', rid: rid() }, mac.secret);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.deepEqual([d.body.recipe, d.body.pieces.length, s.stores(mac, 'ingot:daedric')], ['dagger:daedric', 1, [['own', 1]]]);
  s.fund(mac, 1000);
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'material', material: 'ingot:daedric', units: 1, price: 50, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const o = await s.call('/v1/market/order', { character: mac.character, region: DF, material: 'ingot:daedric', units: 1, price: 40, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(o.status, 200, JSON.stringify(o.body));
});
