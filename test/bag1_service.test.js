// BAG1 (2026-10-03) - THE MATERIALS BAG, ON THE SERVICE: what a character carries is COUNTED. A carrying client's
// harvest lands in the carried count, never the Stores; a withdrawal hands units over counted, under the origin they
// left as; a deposit brings them back into the Stores - never more than the count, which is first cut to what the pack
// says it holds and never raised (law 3's guarantee, restated: bible/06-Systems/Materials-Bag.md). Driven through the
// real Worker over node:sqlite (test/accountDb.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { herbKey } from '../src/net/professionLaw.js';
import { CARRIED_MAX, DEPOSIT_MAX, CARRIED_ROW_DAYS, clampCarried, carriedUsable } from '../src/net/bagLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { runCron, CRON_HOUR } from '../server-account/src/cron.js';   // SCALE4b: the harvests' sweep is the service's clock's

const DAY = 86_400;
const WOODS = 231, ANTICLERE = 21;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
const realNow = Date.now;
Date.now = () => NOON * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `bag1-${String(++_rid).padStart(6, '0')}`;

function patchOfTier(tier, from = 300) {
  for (let x = from; x < 700; x++) {
    const p = herbPatches({ x, y: 200, day: utcDay(NOON), climate: WOODS, confirmed: false }).find((q) => q.tier === tier);
    if (p) return { x, y: 200, ...p };
  }
  throw new Error('no patch of that tier');
}
const harvestBody = (who, p, extra = {}) => ({
  character: who.character, node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: utcDay(NOON), slot: p.slot }), kind: 'herbs',
  climate: WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: NOON - 2, rid: rid(), ...extra,
});
async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const rows = (table) => (who, material) => raw.prepare(`SELECT origin, qty FROM ${table} WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin`)
    .all(who.id, who.character, material).map((r) => [r.origin, Number(r.qty)]);
  const put = (table) => (who, material, origin, qty) => raw.prepare(`INSERT INTO ${table} (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, material, origin, qty);
  return { ...s, raw, stores: rows('prof_stores'), carried: rows('prof_carried'), give: put('prof_stores'), carry: put('prof_carried') };
}

// ─── THE LAW ────────────────────────────────────────────────────────

test('BAG1 law: a count is cut to what the pack holds - gold first, own last - and never raised; a station uses none of gold', () => {
  assert.deepEqual(clampCarried({ own: 5, bought: 3, gold: 2 }, 7), { own: 5, bought: 2, gold: 0 });
  assert.deepEqual(clampCarried({ own: 5, bought: 3, gold: 2 }, 4), { own: 4, bought: 0, gold: 0 });
  assert.deepEqual(clampCarried({ own: 5, bought: 3, gold: 2 }, 100), { own: 5, bought: 3, gold: 2 }, 'a pack holding more than the count adds nothing');
  assert.deepEqual(clampCarried({ own: 1 }, 0), { own: 0, bought: 0, gold: 0 });
  assert.equal(carriedUsable({ own: 2, bought: 1, gold: 9 }, 50), 3, 'gold\'s units never spent at a station (GOLD-MARKET\'s wall)');
  assert.equal(carriedUsable({ own: 2, bought: 1, gold: 9 }, 10), 3, 'cut first: two of gold\'s off the top, bought and own whole');
  assert.equal(carriedUsable({ own: 2, bought: 1, gold: 9 }, 2), 2, 'a pack of two: gold\'s and the bought one cut, own kept');
});

// ─── A HARVEST INTO THE BAG ─────────────────────────────────────────

test('BAG1 service: a carrying client\'s harvest lands in the carried count - never the Stores - and says so; asked again it is one; an older client\'s still lands in the Stores', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const p = patchOfTier(1);
  const key = herbKey(p.herb, ANTICLERE);
  const body = harvestBody(mac, p, { carry: true, held: 0 });
  const r = await s.call('/v1/prof/harvest', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.carry, true);
  assert.deepEqual(r.body.carried, { material: key, own: r.body.qty, bought: 0 });
  assert.deepEqual(s.carried(mac, key), [['own', r.body.qty]]);
  assert.deepEqual(s.stores(mac, key), [], 'nothing into the Stores');
  const again = await s.call('/v1/prof/harvest', body, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.carry, again.body.qty], [true, true, r.body.qty]);
  assert.deepEqual(s.carried(mac, key), [['own', r.body.qty]], 'nothing counted twice');
  // the older door: no `carry` - the Stores, as before BAG1
  const q = patchOfTier(1, p.x + 1);
  const old = await s.call('/v1/prof/harvest', harvestBody(mac, q), mac.secret);
  assert.equal(old.status, 200);
  assert.equal(old.body.carry, undefined);
  assert.deepEqual(s.stores(mac, herbKey(q.herb, ANTICLERE)), [['own', old.body.qty]]);
  // the state says both
  const st = (await s.call('/v1/prof/state', { character: mac.character }, mac.secret)).body;
  assert.ok(st.carried.some((c) => c.material === key && c.own === r.body.qty));
});

test('BAG1 service: a harvest\'s `held` cuts the count first - a pack that sold its herbs is believed - and a count at its bound refuses `carried-full`', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const p = patchOfTier(1);
  const key = herbKey(p.herb, ANTICLERE);
  s.carry(mac, key, 'own', 40);
  const r = await s.call('/v1/prof/harvest', harvestBody(mac, p, { carry: true, held: 10, heldKey: key, seen: 40 }), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(s.carried(mac, key), [['own', 10 + r.body.qty]], 'cut to the ten held, then the harvest');
  const q = patchOfTier(1, p.x + 1);
  const qk = herbKey(q.herb, ANTICLERE);
  s.carry(mac, qk, 'own', CARRIED_MAX);
  const full = await s.call('/v1/prof/harvest', harvestBody(mac, q, { carry: true, held: CARRIED_MAX, heldKey: qk, seen: CARRIED_MAX }), mac.secret);
  assert.deepEqual([full.status, full.body], [409, { error: 'carried-full' }]);
});

// AUDIT BAG1 B2 (bible/06-Systems/Materials-Bag.md, the audit): a held count is only as good as the count it was read
// against. The auditors' repro: three herbs gathered offline, kept, each asked with `held: 0` - every one cut the units
// the one before had counted, and the save was minted four that the service knew as one.
test('BAG1 service (AUDIT B2): a `held` read against a count that has moved since cuts nothing - three kept harvests all keep their units; a current one is believed', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ps = [];
  for (let x = 300; ps.length < 4 && x < 900; x++) {
    const p = herbPatches({ x, y: 200, day: utcDay(NOON), climate: WOODS, confirmed: false }).find((q) => q.tier === 1);
    if (p && (!ps.length || herbKey(p.herb, ANTICLERE) === herbKey(ps[0].herb, ANTICLERE))) ps.push({ x, y: 200, ...p });
  }
  assert.equal(ps.length, 4);
  const key = herbKey(ps[0].herb, ANTICLERE);
  let sum = 0;
  for (const p of ps.slice(0, 3)) {   // kept while offline: each read the pack at 0, the count at 0
    const r = await s.call('/v1/prof/harvest', harvestBody(mac, p, { carry: true, held: 0, heldKey: key, seen: 0 }), mac.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    sum += r.body.qty;
  }
  assert.deepEqual(s.carried(mac, key), [['own', sum]], 'every unit the save was handed is counted');
  // a withdrawal and a deposit read against a stale count cut nothing either
  s.give(mac, 'p1:19', 'own', 5);
  const w = await s.call('/v1/stores/withdraw', { character: mac.character, material: 'p1:19', qty: 2, rid: rid(), carry: true, held: 0, seen: 0 }, mac.secret);
  assert.equal(w.status, 200);
  const stale = await s.call('/v1/stores/withdraw', { character: mac.character, material: 'p1:19', qty: 1, rid: rid(), carry: true, held: 0, seen: 0 }, mac.secret);
  assert.equal(stale.status, 200);
  assert.deepEqual(s.carried(mac, 'p1:19'), [['own', 3]], 'the first withdrawal\'s two, not yet in the pack, kept');
  const d = await s.call('/v1/stores/deposit', { character: mac.character, material: 'p1:19', qty: 1, held: 1, seen: 2, order: 'all', rid: rid() }, mac.secret);
  assert.equal(d.status, 200, 'a held of 1 read against 2: the count moved since, so nothing is cut before the deposit');
  assert.deepEqual(s.carried(mac, 'p1:19'), [['own', 2]]);
  // read against the count as it stands: believed - the pack sold one
  const cut = await s.call('/v1/stores/deposit', { character: mac.character, material: 'p1:19', qty: 1, held: 1, seen: 2, order: 'all', rid: rid() }, mac.secret);
  assert.equal(cut.status, 200);
  assert.deepEqual(s.carried(mac, 'p1:19'), [], 'cut to the one held, and that one put in');
  // the harvest's held count is the node's own material's alone: another material's says nothing of this one
  const r = await s.call('/v1/prof/harvest', harvestBody(mac, ps[3], { carry: true, held: 0, heldKey: 'p1:19', seen: sum }), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(s.carried(mac, key), [['own', sum + r.body.qty]], 'a held count named for another material cuts nothing here');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM prof_carried_gate').get().n, 0, 'the gate never outlives its batch');
});

// AUDIT BAG1 B3: two copies of one kept harvest (two tabs, one rid) both read no prior row; the second's cut ran after the
// first had counted its units, against the same `held: 0`, and erased them.
test('BAG1 service (AUDIT B3): a twin of a landed harvest, racing it, cuts nothing', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const p = patchOfTier(1);
  const key = herbKey(p.herb, ANTICLERE);
  const body = harvestBody(mac, p, { carry: true, held: 0, heldKey: key });   // an older client's: no `seen`
  const realBatch = s.env.DB.batch.bind(s.env.DB);
  let held = null;
  s.env.DB.batch = async (list) => {   // the first batch waits until its twin is past the prior read
    if (list.length > 8 && held === null) { let go; held = new Promise((r) => { go = r; }); held.go = go; await held; return realBatch(list); }
    if (list.length > 8 && held) { const out = await realBatch(list); held.go(); return out; }
    return realBatch(list);
  };
  const [a, b] = await Promise.all([s.call('/v1/prof/harvest', body, mac.secret), s.call('/v1/prof/harvest', body, mac.secret)]);
  s.env.DB.batch = realBatch;
  assert.deepEqual([a.status, b.status], [200, 200]);
  assert.equal(a.body.qty, b.body.qty, 'one harvest, told twice');
  assert.deepEqual(s.carried(mac, key), [['own', a.body.qty]], 'the units the save mints are the units counted');
});

// ─── A WITHDRAWAL, COUNTED ──────────────────────────────────────────

test('BAG1 service: a withdrawal to a carrying client is counted as carried, each origin as it left (gold\'s first, bought, own); asked twice it is one; `held` is required', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'p1:19', 'gold', 1);
  s.give(mac, 'p1:19', 'bought', 2);
  s.give(mac, 'p1:19', 'own', 5);
  const body = { character: mac.character, material: 'p1:19', qty: 4, rid: rid(), carry: true, held: 0 };
  assert.deepEqual((await s.call('/v1/stores/withdraw', { ...body, held: undefined }, mac.secret)).body, { error: 'bad-held' });
  const r = await s.call('/v1/stores/withdraw', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, {
    ok: true, material: 'p1:19', qty: 4, store: { material: 'p1:19', own: 4, bought: 0 },
    carry: true, carried: { material: 'p1:19', own: 1, bought: 2, gold: 1 },
  });
  assert.deepEqual(s.carried(mac, 'p1:19'), [['bought', 2], ['gold', 1], ['own', 1]]);
  const again = await s.call('/v1/stores/withdraw', body, mac.secret);
  assert.equal(again.body.repeat, true);
  assert.deepEqual(s.carried(mac, 'p1:19'), [['bought', 2], ['gold', 1], ['own', 1]], 'nothing counted twice, and the racing twin cuts nothing');
  // the older door counts nothing: the units leave the service for good, as law 3 stood
  const old = await s.call('/v1/stores/withdraw', { character: mac.character, material: 'p1:19', qty: 1, rid: rid() }, mac.secret);
  assert.equal(old.body.carry, undefined);
  assert.deepEqual(s.carried(mac, 'p1:19'), [['bought', 2], ['gold', 1], ['own', 1]]);
  // the count's bound
  s.give(mac, 'p1:20', 'own', 10);
  s.carry(mac, 'p1:20', 'own', CARRIED_MAX - 2);
  const full = await s.call('/v1/stores/withdraw', { ...body, rid: rid(), material: 'p1:20', qty: 3, held: CARRIED_MAX }, mac.secret);
  assert.deepEqual([full.status, full.body], [409, { error: 'carried-full' }]);
  assert.deepEqual(s.stores(mac, 'p1:20'), [['own', 10]], 'refused whole: nothing left the Stores');
});

// ─── A DEPOSIT ──────────────────────────────────────────────────────

test('BAG1 service: a deposit moves carried units into the Stores, each origin as it was - `all` gold\'s first, `spend` bought then own and never gold\'s; asked twice it is one', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.carry(mac, 'p1:19', 'own', 5);
  s.carry(mac, 'p1:19', 'bought', 2);
  s.carry(mac, 'p1:19', 'gold', 1);
  const body = { character: mac.character, material: 'p1:19', qty: 2, held: 8, order: 'all', rid: rid() };
  const r = await s.call('/v1/stores/deposit', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, {
    ok: true, material: 'p1:19', qty: 2, own: 0, bought: 1, gold: 1,
    store: { material: 'p1:19', own: 0, bought: 1, gold: 1 }, carried: { material: 'p1:19', own: 5, bought: 1 },
  });
  const again = await s.call('/v1/stores/deposit', body, mac.secret);
  assert.equal(again.body.repeat, true);
  assert.deepEqual(s.carried(mac, 'p1:19'), [['bought', 1], ['own', 5]], 'nothing moved twice');
  const spend = await s.call('/v1/stores/deposit', { ...body, rid: rid(), qty: 3, held: 6, order: 'spend' }, mac.secret);
  assert.deepEqual([spend.body.own, spend.body.bought, spend.body.gold], [2, 1, 0], 'bought first, then own');
  assert.deepEqual(s.stores(mac, 'p1:19'), [['bought', 2], ['gold', 1], ['own', 2]]);
  assert.deepEqual(s.carried(mac, 'p1:19'), [['own', 3]]);
  // gold's units are never a station's: a `spend` deposit cannot reach them
  s.carry(mac, 'p1:20', 'gold', 4);
  const walled = await s.call('/v1/stores/deposit', { ...body, rid: rid(), material: 'p1:20', qty: 1, held: 4, order: 'spend' }, mac.secret);
  assert.deepEqual([walled.status, walled.body.error], [409, 'carried-short']);
  for (const [bad, error] of [[{ qty: 0 }, 'bad-qty'], [{ qty: DEPOSIT_MAX + 1 }, 'bad-qty'], [{ held: -1 }, 'bad-held'], [{ order: 'x' }, 'bad-deposit-order'], [{ material: 'work:ram' }, 'bad-material']]) {
    assert.equal((await s.call('/v1/stores/deposit', { ...body, rid: rid(), ...bad }, mac.secret)).body.error, error, JSON.stringify(bad));
  }
});

test('BAG1 service: LAW 3, RESTATED - a pack that holds more than the count deposits no more than the count; one that holds fewer is believed first', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.carry(mac, 'p1:19', 'own', 3);
  const body = { character: mac.character, material: 'p1:19', qty: 4, held: 100, order: 'all', rid: rid() };
  const r = await s.call('/v1/stores/deposit', body, mac.secret);
  assert.deepEqual([r.status, r.body], [409, { error: 'carried-short' }], 'an edited save\'s hundred buys nothing past the three the service handed out');
  assert.deepEqual(s.carried(mac, 'p1:19'), [['own', 3]]);
  assert.deepEqual(s.stores(mac, 'p1:19'), []);
  const ok = await s.call('/v1/stores/deposit', { ...body, rid: rid(), qty: 3 }, mac.secret);
  assert.equal(ok.status, 200);
  assert.deepEqual(s.stores(mac, 'p1:19'), [['own', 3]]);
  // a pack that brewed two of its five: the count is cut to the three it holds before anything moves
  s.carry(mac, 'p1:20', 'own', 5);
  s.carry(mac, 'p1:20', 'bought', 1);
  const cut = await s.call('/v1/stores/deposit', { ...body, rid: rid(), material: 'p1:20', qty: 4, held: 3 }, mac.secret);
  assert.deepEqual([cut.status, cut.body.error], [409, 'carried-short']);
  assert.deepEqual(s.carried(mac, 'p1:20'), [['own', 3]], 'the bought unit went first, as the pack fills - and the count stays cut');
  // and the Stores' own bound
  s.give(mac, 'p1:9', 'own', 4999);
  s.carry(mac, 'p1:9', 'own', 5);
  const full = await s.call('/v1/stores/deposit', { ...body, rid: rid(), material: 'p1:9', qty: 2, held: 5 }, mac.secret);
  assert.deepEqual([full.status, full.body], [409, { error: 'stores-full' }]);
});

test('BAG1 service: the unbruised count follows its own units into the bag and back into the Stores', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.carry(mac, 'p1:19', 'own', 4);
  s.raw.prepare('INSERT INTO prof_unbruised (player, char_id, material, qty) VALUES (?, ?, ?, ?)').run(mac.id, mac.character, 'p1:19', 4);
  const unbruised = () => Number(s.raw.prepare('SELECT qty FROM prof_unbruised WHERE player = ? AND char_id = ? AND material = ?').get(mac.id, mac.character, 'p1:19')?.qty ?? 0);
  const r = await s.call('/v1/stores/deposit', { character: mac.character, material: 'p1:19', qty: 4, held: 4, order: 'all', rid: rid() }, mac.secret);
  assert.equal(r.status, 200);
  assert.equal(unbruised(), 4, 'own units moved, not lost: the count kept');
  await s.call('/v1/stores/withdraw', { character: mac.character, material: 'p1:19', qty: 4, rid: rid(), carry: true, held: 0 }, mac.secret);
  assert.equal(unbruised(), 4, 'carried own units still count');
  await s.call('/v1/stores/deposit', { character: mac.character, material: 'p1:19', qty: 1, held: 1, order: 'all', rid: rid() }, mac.secret);
  assert.equal(unbruised(), 1, 'a pack holding one: the count cut, and the unbruised with it');
});

// ─── THE SECOND AUDIT (bible/06-Systems/Materials-Bag.md, the second audit) ───

test('BAG1 service (AUDIT2 S1): a carried harvest\'s row is kept thirty days, not two - it is the answer a kept harvest asked again is given, and only that answer mints its items; a Stores harvest\'s still goes at two, and past its bound a carried one goes too (mutants: swept at two days; never swept)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const p = patchOfTier(1);
  const body = harvestBody(mac, p, { carry: true, held: 0 });
  const r = await s.call('/v1/prof/harvest', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const plain = harvestBody(mac, patchOfTier(1, p.x + 1));
  assert.equal((await s.call('/v1/prof/harvest', plain, mac.secret)).status, 200);
  const rowsOf = (carry) => Number(s.raw.prepare('SELECT COUNT(*) AS n FROM node_harvests WHERE player = ? AND carry = ?').get(mac.id, carry).n);
  try {
    Date.now = () => (NOON + 3 * DAY) * 1000;
    await runCron(s.env, { cron: CRON_HOUR, nowS: NOON + 3 * DAY });   // the sweep - PIN MOVED (SCALE4b): the service's clock's each hour, no longer the state's read
    assert.deepEqual([rowsOf(1), rowsOf(0)], [1, 0], 'the Stores harvest swept, the carried one kept');
    const again = await s.call('/v1/prof/harvest', body, mac.secret);
    assert.deepEqual([again.body.repeat, again.body.carry, again.body.qty], [true, true, r.body.qty], 'asked again three days on: answered, so its items are minted');
    Date.now = () => (NOON + (CARRIED_ROW_DAYS + 1) * DAY) * 1000;
    await runCron(s.env, { cron: CRON_HOUR, nowS: NOON + (CARRIED_ROW_DAYS + 1) * DAY });
    assert.equal(rowsOf(1), 0, 'past its bound, swept');
  } finally { Date.now = () => NOON * 1000; }
  assert.equal(CARRIED_ROW_DAYS, 30);
});
