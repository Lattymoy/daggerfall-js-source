// REALM P2.1 (2026-09-28; bible/06-Systems/Realm-Arc.md section 3, Mac: "eliminate duping"): A TRADE IS THE REALM'S.
// The law both ends read (src/net/realmTradeLaw.js), the service that settles it (server-account/src/realmTrade.js,
// migration 0019 - 0017 on its branch) driven through the REAL Worker over the REAL migrations, and the client that hands its commit to it
// (net/tradeSession.js's escrow, systems/realmSaves.js transact and realmTradeEscrow) - two realm tabs trading end to
// end. Every write of a realm character is a new object now, so a write that loses its race never touches the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { REALM_TRADE_BODY_MAX } from '../server-account/src/realmTrade.js';
import { SESSION_KEY } from '../src/net/accountClient.js';
import {
  realmTradeHalfOf, halvesAgree, tradeableRecord, recordIsOffered, takeTradeGoods, settleRealmTrade, realmTradeRefusalText,
  REALM_TRADE_SID_RE, REALM_TRADE_TTL_S, GOLD_PIECES_TEMPLATE, TRADE_VOLATILE_FIELDS,
} from '../src/net/realmTradeLaw.js';
import { createTradeManager, REALM_TRADE_REV_BASE, OLDER_BUILD_TRADE_TEXT } from '../src/net/tradeSession.js';
import { validTradeData, TRADE_REV_MAX, TRADE_ITEMS_MAX } from '../src/net/wire.js';
import { createTradePack, tradeRefusal } from '../src/systems/tradePack.js';
import { checkpointedTradePack } from '../src/systems/onlineCheckpoint.js';
import { GOLD_TEMPLATE } from '../src/systems/inventory.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import {
  realmIo, realmCreate, realmFetch, realmJoin, realmPut, realmTradeCall, createRealmSession, realmTradeEscrow, settleRealmTradeHalf,
  realmRefusalText, REALM_TRADE_WAIT_MS,
} from '../src/systems/realmSaves.js';
import { freshSave, layRecord } from './realmSeat.mjs';   // AUDIT REALM2 S1: a first save is a new character's
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  const api = {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return st;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
  return api;
}
function r2() {
  const m = new Map();
  return {
    _map: m,
    async put(key, body) { m.set(key, new Uint8Array(body instanceof ArrayBuffer ? body : new TextEncoder().encode(String(body)))); return { key }; },
    async get(key) {
      const v = m.get(key);
      return v === undefined ? null : { key, size: v.byteLength, body: v, async text() { return new TextDecoder().decode(v); } };
    },
    async delete(key) { m.delete(key); },
    async list({ prefix = '' } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}
function fakeStorage() {
  const m = new Map();
  return { _map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
/** One service; `player()` is a signed-in account on its own device, with a door that can fail on purpose. */
async function realm() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  async function player() {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    const storage = fakeStorage();
    storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    const door = { mode: 'ok', inits: [] };
    const fetch = async (url, init) => {
      door.inits.push({ url, init });
      if (door.mode === 'offline') throw new TypeError('network');
      return worker.fetch(new Request(url, init), env);
    };
    return { g, door, storage, env, io: realmIo({ fetch, storage }) };
  }
  return { env, player };
}
/** A realm character with its first save: `{ id, lease, seq }` after the checkpoint. AUDIT REALM2 S1: the first save a
 *  new character's (the service reads it), and `save` - the record the pins count from - laid over it at that sequence. */
async function character(P, name, save) {
  const made = (await realmCreate(P.io, name)).data;
  const put = await realmPut(P.io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name })));
  assert.equal(put.ok, true);
  layRecord(P.env, made.id, save);
  return { id: made.id, lease: made.lease, seq: 1 };
}
const record = async (io, id) => { const r = await realmFetch(io, id); return { seq: r.seq, save: JSON.parse(r.text) }; };
/** The port's own items: a Daedric dagger, a stack of arrows. */
const dagger = () => createWeapon(113, 9, () => 0.5);
const arrows = (n) => ({ ...createWeapon(131, 0, () => 0.5), stackCount: n });
const wireOf = (items, entries) => createTradePack({ items }).wire(entries);
const half = (sid, give, get) => ({ sid, give, get });
/** Wait until `ok()` holds, a few real milliseconds at a time - bounded by REAL time (performance.now: a test may move
 *  Date.now), never by a count of turns, which a loaded machine outruns. */
async function until(ok, what = 'the condition', ms = 30_000) {
  const end = performance.now() + ms;
  while (!(await ok())) {
    if (performance.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((res) => { setTimeout(res, 2); });
  }
}

// ---- the law ---------------------------------------------------------------------------------------------------------

test('REALM P2.1 law: a save\'s record may leave in a trade exactly when the pack\'s own law lets it - worn, quest, summoned, bound and gold never; the constants are the wire\'s and the pack\'s', { timeout: 60_000 }, () => {
  const table = [
    [dagger(), true],
    [{ ...dagger(), equipSlot: 3 }, false],
    [{ ...dagger(), questItem: true }, false],
    [{ ...dagger(), timeForItemToDisappear: 5000 }, false],
    [{ ...dagger(), bound: true }, false],
    [{ group: 'Currency', templateIndex: GOLD_TEMPLATE, stackCount: 40 }, false],
    [arrows(12), true],
  ];
  for (const [rec, may] of table) {
    assert.equal(tradeableRecord(JSON.parse(JSON.stringify(rec))), may, JSON.stringify(rec).slice(0, 80));
    assert.equal(tradeRefusal(rec) === null, may, 'the pack\'s own law says the same');
  }
  assert.equal(GOLD_PIECES_TEMPLATE, GOLD_TEMPLATE);
  assert.equal(REALM_TRADE_REV_BASE, TRADE_REV_MAX / 2);
  for (const sid of ['abc123', 'k3j4h5g6f7', 'A1B2C3D4E5F6G7H8', 'ab', 'a-b-c-d', 'x'.repeat(17)]) {
    assert.equal(REALM_TRADE_SID_RE.test(sid), validTradeData({ k: 'ask', to: 'peerAAAA', s: sid }) !== null, `sid ${sid}: the wire's own shape`);
  }
  assert.deepEqual(TRADE_VOLATILE_FIELDS, ['stackCount', 'value', 'equipSlot', 'questItem', 'acquired']);
  assert.equal(realmTradeHalfOf({ give: { items: [], gold: 0 }, get: { items: [], gold: 0 } }), null, 'an empty-for-empty trade is none');
  assert.equal(realmTradeHalfOf({ give: { items: new Array(TRADE_ITEMS_MAX + 1).fill({ templateIndex: 1 }) }, get: {} }), null, 'past the wire\'s sixteen');
  assert.equal(realmTradeHalfOf({ give: { gold: -1 }, get: { gold: 5 } }), null);
  assert.deepEqual(realmTradeHalfOf({ give: { gold: 5 }, get: {} }), { give: { items: [], gold: 5 }, get: { items: [], gold: 0 }, pick: [] });
  // AUDIT REALM L1-F1: a side that gives records names which of its checkpoint's records they are, each once
  const one = { give: { items: [{ templateIndex: 113 }] }, get: { gold: 1 } };
  assert.equal(realmTradeHalfOf(one), null, 'no pick, no half');
  assert.equal(realmTradeHalfOf({ ...one, pick: [-1] }), null);
  assert.equal(realmTradeHalfOf({ ...one, pick: [0, 1] }), null, 'one pick a record');
  assert.deepEqual(realmTradeHalfOf({ ...one, pick: [3] }).pick, [3]);
  assert.equal(realmTradeHalfOf({ give: { items: [{ templateIndex: 113 }, { templateIndex: 113 }] }, get: {}, pick: [2, 2] }), null, 'never one record twice');
});

test('REALM P2.1 law: an honest offer IS its record - the port\'s own items through the wire\'s projection match the save\'s copy; a stack gives part of itself; what the save cannot back is refused and a refusal changes nothing', { timeout: 60_000 }, () => {
  const d = { ...dagger(), equipSlot: null }, a = arrows(20), worn = { ...dagger(), equipSlot: 1 };   // an unworn piece may carry the field
  const entity = { items: [worn, d, a], goldPieces: 100 };
  const offer = wireOf(entity.items, [{ item: d, count: 1 }, { item: a, count: 5 }]);
  assert.ok(offer, 'the pack wires it');
  const save = JSON.parse(JSON.stringify({ items: entity.items, goldPieces: 100 }));
  assert.ok(recordIsOffered(save.items[1], offer[0]) && recordIsOffered(save.items[2], offer[1]), 'the save\'s copy is the offer, the wire\'s clamp and floor notwithstanding');
  assert.equal(recordIsOffered(save.items[2], offer[0]), false, 'arrows are not a dagger');
  assert.equal(recordIsOffered({ name: 'Nothing' }, { name: 'Nothing' }), false, 'an offer names a template, whatever the record holds (AUDIT REALM2 S4: both ways, the offer still names one)');
  const cheap = { ...dagger(), value: 0 };   // a record priced under its template: the wire floors the offer's price (WORLD6a B1)
  const cheapOffer = wireOf([cheap], [{ item: cheap, count: 1 }])[0];
  assert.ok(cheapOffer.value > 0, 'the offer carries the floored price');
  assert.equal(recordIsOffered(JSON.parse(JSON.stringify(cheap)), cheapOffer), true, 'the price is never part of what an item is');
  const moved = takeTradeGoods(save, { items: offer, gold: 30 }, [1, 2]);
  assert.equal(moved.length, 2);
  assert.deepEqual([moved[0].templateIndex, moved[1].stackCount, 'equipSlot' in moved[0], save.goldPieces], [113, 5, false, 70], 'the receiver\'s marks stripped');
  assert.deepEqual(save.items.map((r) => [r.templateIndex, r.stackCount ?? 1]), [[worn.templateIndex, 1], [131, 15]], 'the dagger gone, fifteen arrows left, the worn piece untouched');
  // what the save cannot back
  const again = JSON.parse(JSON.stringify(save));
  for (const [bad, pick] of [
    [{ items: offer.slice(0, 1), gold: 0 }, [1]],                                  // the dagger has left: the arrows stand at its place
    [{ items: [{ ...offer[1], stackCount: 16 }], gold: 0 }, [1]],                  // more arrows than the stack holds
    [{ items: [{ ...wireOf([worn], [{ item: { ...worn, equipSlot: null }, count: 1 }])[0] }], gold: 0 }, [0]],   // the worn piece
    [{ items: [{ stackCount: 1 }], gold: 0 }, [1]],                                // an offer that names no template (picking the arrows it would otherwise be)
    [{ items: [], gold: 71 }, []],                                                 // a purse too thin
    [{ items: [{ ...offer[1], enchantments: [{ type: 1, param: 1 }] }], gold: 0 }, [1]],   // a field the record does not carry
    [{ items: [offer[1]], gold: 0 }, [2]],                                         // a pick past the save's records
    [{ items: [offer[1]], gold: 0 }, []],                                          // a record with no pick
  ]) assert.equal(takeTradeGoods(again, bad, pick), null);
  assert.deepEqual(again, save, 'a refusal changed nothing');
  // a pick names each record once - two entries never draw on one stack - and a whole stack leaves whole
  const twice = JSON.parse(JSON.stringify(save));
  const five = { ...offer[1], stackCount: 5 };
  assert.equal(takeTradeGoods(JSON.parse(JSON.stringify(save)), { items: [five, five], gold: 0 }, [1, 1]), null, 'one record picked twice');
  assert.equal(takeTradeGoods(twice, { items: [{ ...offer[1], stackCount: 15 }], gold: 0 }, [1]).length, 1);
  assert.equal(twice.items.length, 1, 'fifteen less fifteen: the stack is gone');
});

test('REALM P2.1 law: the swap - each side takes what the other gives, as the giver\'s record held it; halves that disagree, or a side its record cannot back, move nothing', { timeout: 60_000 }, () => {
  const d = dagger(), a = arrows(10);
  const saveA = JSON.parse(JSON.stringify({ items: [d], goldPieces: 50 }));
  const saveB = JSON.parse(JSON.stringify({ items: [a], goldPieces: 5 }));
  const giveA = { items: wireOf([d], [{ item: d, count: 1 }]), gold: 20 }, giveB = { items: wireOf([a], [{ item: a, count: 4 }]), gold: 0 };
  const hA = { give: giveA, get: giveB, pick: [0] }, hB = { give: giveB, get: giveA, pick: [0] };
  assert.equal(halvesAgree(hA, hB), true);
  const s = settleRealmTrade(saveA, saveB, hA, hB);
  assert.equal(s.ok, true);
  assert.deepEqual([s.a.goldPieces, s.b.goldPieces, s.a.items.length, s.b.items.length], [30, 25, 1, 2]);
  assert.deepEqual([s.a.items[0].templateIndex, s.a.items[0].stackCount, s.b.items[0].stackCount, s.b.items[1].templateIndex], [131, 4, 6, 113]);
  assert.deepEqual([s.toA.gold, s.toB.gold, s.toA.items[0].stackCount, s.toB.items[0].templateIndex], [0, 20, 4, 113]);
  assert.deepEqual([saveA.goldPieces, saveB.items[0].stackCount], [50, 10], 'the service\'s copies are never changed in place');
  assert.deepEqual(settleRealmTrade(saveA, saveB, hA, { give: giveB, get: { ...giveA, gold: 19 }, pick: [0] }), { why: 'mismatch' });
  assert.deepEqual(settleRealmTrade(saveA, { items: [], goldPieces: 5 }, hA, hB), { why: 'goods' }, 'B\'s record holds no arrows');
  assert.match(realmTradeRefusalText('goods'), /nothing was traded/);
});

// ---- the service -----------------------------------------------------------------------------------------------------

/** Two players with realm characters: A holds a dagger and 50 gold, B ten arrows and 5 gold. */
async function pair() {
  const r = await realm();
  const A = await r.player(), B = await r.player();
  const d = dagger(), a = arrows(10);
  A.char = await character(A, 'Arthago', { name: 'Arthago', items: [d], goldPieces: 50 });
  B.char = await character(B, 'Brisienna', { name: 'Brisienna', items: [a], goldPieces: 5 });
  const giveA = { items: wireOf([d], [{ item: d, count: 1 }]), gold: 20 }, giveB = { items: wireOf([a], [{ item: a, count: 4 }]), gold: 0 };
  const ask = (P, sid, give, get, over = {}) => realmTradeCall(P.io, { id: P.char.id, lease: P.char.lease, seq: P.char.seq, sid, give, get, pick: give.items.map((_, i) => i), ...over });
  return { ...r, A, B, giveA, giveB, ask };
}

test('REALM P2.1: the service settles a trade - the first half waits, the second moves BOTH records one sequence on at once; either side asking again is told the same outcome, and another account nothing', { timeout: 60_000 }, async () => {
  const { env, A, B, giveA, giveB, ask, player } = await pair();
  assert.deepEqual((await ask(A, 'sidone01', giveA, giveB)).data, { state: 'waiting' });
  assert.deepEqual((await ask(A, 'sidone01', giveA, giveB)).data, { state: 'waiting' }, 'asking again is waiting still');
  const b = await ask(B, 'sidone01', giveB, giveA);
  assert.deepEqual([b.data.state, b.data.seq, b.data.gold, b.data.items.length, b.data.items[0].templateIndex], ['done', 2, 20, 1, 113], 'B receives the dagger and the gold');
  const a = await ask(A, 'sidone01', giveA, giveB);
  assert.deepEqual([a.data.state, a.data.seq, a.data.gold, a.data.items[0].stackCount], ['done', 2, 0, 4], 'A, asking after, is told its own side');
  const ra = await record(A.io, A.char.id), rb = await record(B.io, B.char.id);
  assert.deepEqual([ra.seq, ra.save.goldPieces, ra.save.items.map((i) => [i.templateIndex, i.stackCount])], [2, 30, [[131, 4]]]);
  assert.deepEqual([rb.seq, rb.save.goldPieces, rb.save.items.map((i) => [i.templateIndex, i.stackCount ?? 1])], [2, 25, [[131, 6], [113, 1]]]);
  assert.equal(ra.save.name, 'Arthago', 'the rest of the save rides untouched');
  assert.equal(env.SAVES._map.size, 4, 'each character: the trade\'s save and the one before it');
  const C = await player();
  assert.deepEqual([(await realmTradeCall(C.io, { id: A.char.id, lease: A.char.lease, seq: 2, sid: 'sidone01', give: giveA, get: giveB, pick: [0] })).error], ['no-realm-character'], 'another account: the record is not its own, and the trade is never named');
  C.char = await character(C, 'Cyrus', { name: 'Cyrus', items: [], goldPieces: 0 });
  assert.equal((await ask(C, 'sidone01', giveB, giveA)).error, 'trade-spent', 'another account\'s own character, no party to it: told nothing');
  // the next checkpoint follows the trade's sequence
  assert.equal((await realmPut(A.io, A.char.id, { lease: A.char.lease, seq: 3 }, '{"after":1}')).ok, true);
});

test('REALM P2.1: a refusal moves nothing - halves that disagree, goods a record does not hold, a half past its minute, a half made at a sequence the record left, a lease another tab took', { timeout: 60_000 }, async () => {
  const { A, B, giveA, giveB, ask } = await pair();
  const before = [await record(A.io, A.char.id), await record(B.io, B.char.id)];
  const same = async () => assert.deepEqual([await record(A.io, A.char.id), await record(B.io, B.char.id)], before, 'both records as they were');
  // disagree
  await ask(A, 'sidmis01', giveA, giveB);
  assert.deepEqual((await ask(B, 'sidmis01', giveB, { ...giveA, gold: 21 })).data, { state: 'refused', why: 'mismatch' });
  assert.deepEqual((await ask(A, 'sidmis01', giveA, giveB)).data, { state: 'refused', why: 'mismatch' }, 'the first side is told the same');
  await same();
  // goods A's record does not hold (it offers a second dagger)
  const twoDaggers = { ...giveA, items: [...giveA.items, ...giveA.items] };
  await ask(A, 'sidgoo01', twoDaggers, giveB);
  assert.deepEqual((await ask(B, 'sidgoo01', giveB, twoDaggers)).data, { state: 'refused', why: 'goods' });
  await same();
  // past its minute
  const realNow = Date.now;
  try {
    await ask(A, 'sidexp01', giveA, giveB);
    Date.now = () => realNow() + (REALM_TRADE_TTL_S + 2) * 1000;
    assert.deepEqual((await ask(B, 'sidexp01', giveB, giveA)).data, { state: 'refused', why: 'expired' });
  } finally { Date.now = realNow; }
  await same();
  // a sequence the record left: told the service's own
  const stale = await ask(A, 'sidseq01', giveA, giveB, { seq: 7 });
  assert.deepEqual([stale.ok, stale.error, stale.seq], [false, 'seq', 1]);
  // a lease another tab took: the waiting half can never settle
  await ask(A, 'sidlea01', giveA, giveB);
  const took = await realmJoin(A.io, A.char.id);
  assert.equal(took.ok, true);
  assert.deepEqual((await ask(B, 'sidlea01', giveB, giveA)).data, { state: 'refused', why: 'moved' });
  assert.equal((await ask(A, 'sidlea02', giveA, giveB)).error, 'lease', 'and the old tab\'s half is no half');
  await same();
});

test('REALM P2.1: a record that moves under the settle rolls the WHOLE batch back - the checkpoint that landed mid-settle stands, the other record never moved, and the settle\'s objects are dropped', { timeout: 60_000 }, async () => {
  const { env, A, B, giveA, giveB, ask } = await pair();
  const bBefore = await record(B.io, B.char.id);
  await ask(A, 'sidrace1', giveA, giveB);
  const realBatch = env.DB.batch.bind(env.DB);
  let raced = false;
  env.DB.batch = async (list) => {
    if (!raced) {
      raced = true;
      // A's tab checkpoints while the service settles: a modified client, or a timer that slipped the hold
      assert.equal((await realmPut(A.io, A.char.id, { lease: A.char.lease, seq: 2 }, '{"mid":"settle"}')).ok, true);
    }
    return realBatch(list);
  };
  const keysBefore = new Set(env.SAVES._map.keys());
  assert.deepEqual((await ask(B, 'sidrace1', giveB, giveA)).data, { state: 'refused', why: 'moved' });
  assert.deepEqual(await record(B.io, B.char.id), bBefore, 'B never moved');
  const ra = await realmFetch(A.io, A.char.id);
  assert.deepEqual([ra.seq, ra.text], [2, '{"mid":"settle"}'], 'A\'s own checkpoint stands');
  const added = [...env.SAVES._map.keys()].filter((k) => !keysBefore.has(k));
  assert.equal(added.length, 1, 'only the checkpoint\'s object is new - the settle dropped both of its own');
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM realm_tx_guard').first()).n, 0, 'the guard never holds a row');
});

test('REALM P2.1: a write that loses its race never touches the current save - a checkpoint racing a join drops its own object', { timeout: 60_000 }, async () => {
  const { env, A } = await pair();
  // INT2 (PIN MOVED): the checkpoint's move rides one batch with the judge's verdict (server-account/src/verdict.js) - the
  // join lands as that batch is sent, where it landed as the lone UPDATE ran
  const realPrepare = env.DB.prepare.bind(env.DB), realBatch = env.DB.batch.bind(env.DB);
  let armed = true;
  env.DB.prepare = (sql) => {
    const st = realPrepare(sql);
    if (!armed || !/^UPDATE realm_characters SET seq = \?, bytes = \?, obj = \?/.test(sql)) return st;
    st.checkpointMove = true;
    return st;
  };
  env.DB.batch = async (list) => {
    if (armed && list.some((st) => st.checkpointMove)) { armed = false; env.DB.prepare = realPrepare; await realmJoin(A.io, A.char.id); }
    return realBatch(list);
  };
  const current = [...env.SAVES._map.keys()];
  const lost = await realmPut(A.io, A.char.id, { lease: A.char.lease, seq: 2 }, '{"lost":"race"}');
  assert.deepEqual([lost.ok, lost.error], [false, 'lease']);
  assert.deepEqual([...env.SAVES._map.keys()].sort(), current.sort(), 'its object dropped; the current save untouched');
  assert.deepEqual([(await record(A.io, A.char.id)).seq], [1]);
});

test('REALM P2.1: a half of sixteen records rides past the 4 KiB every other JSON route keeps; one past its own bound is refused', { timeout: 60_000 }, async () => {
  const { A, giveB, ask } = await pair();
  const big = { items: new Array(16).fill(0).map(() => ({ ...wireOf([dagger()], [{ item: dagger(), count: 1 }])[0], shortName: 'x'.repeat(120) })), gold: 0 };
  assert.ok(JSON.stringify(big).length > 4096);
  assert.deepEqual((await ask(A, 'sidbig01', big, giveB)).data, { state: 'waiting' });
  const huge = { items: [{ templateIndex: 113, note: 'y'.repeat(REALM_TRADE_BODY_MAX) }], gold: 0 };
  assert.equal((await ask(A, 'sidbig02', huge, giveB)).status, 400);
});

// ---- the client ------------------------------------------------------------------------------------------------------

/** Two realm tabs over one service and one fake wire - each a TradeManager whose escrow is the realm's, over a real pack
 *  of a plain entity whose checkpoint is its JSON. */
async function tabs({ escrowB = true } = {}) {
  const r = await realm();
  const A = await r.player(), B = await r.player();
  const entA = { name: 'Arthago', items: [dagger(), arrows(3)], goldPieces: 50, stats: { strength: 60 } };
  const entB = { name: 'Brisienna', items: [arrows(10)], goldPieces: 5, stats: { strength: 60 } };
  const snap = (e) => JSON.stringify({ name: e.name, level: 1, items: e.items, goldPieces: e.goldPieces });   // INT2 (PIN MOVED): a character the judge reads - every save carries its level
  A.char = await character(A, 'Arthago', JSON.parse(snap(entA)));
  B.char = await character(B, 'Brisienna', JSON.parse(snap(entB)));
  const q = [], said = { A: [], B: [] };
  let clock = 0;
  const now = () => clock;
  const mk = (P, ent, me, other, id, otherId, escrowOn) => {
    P.session = createRealmSession({ io: P.io, id: P.char.id, lease: P.char.lease, seq: P.char.seq, onLost: (why) => said[me].push(`lost:${why}`) });
    const checkpoint = () => P.session.checkpoint(snap(ent));
    const pack = checkpointedTradePack(createTradePack(ent), checkpoint);   // the host's own pack: P0.5 checkpoints as the goods are reserved
    P.pack = pack;
    return createTradeManager({
      pack, now, say: (t) => said[me].push(t), peerName: () => other, selfId: () => id,
      send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id, to: v.to, d: v }); return true; },
      near: () => true, open: () => {},
      escrow: escrowOn ? realmTradeEscrow({ session: P.session, checkpoint, wait: async () => { clock += 100; await new Promise((res) => { setImmediate(res); }); }, now: () => clock }) : null,   // each wait moves the clock a little: a poll that is never answered ends
    });
  };
  const mA = mk(A, entA, 'A', 'B', 'peerAAAA', 'peerBBBB', true), mB = mk(B, entB, 'B', 'A', 'peerBBBB', 'peerAAAA', escrowB);
  const mgrs = { peerAAAA: mA, peerBBBB: mB };
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  const settle = (done, what) => until(() => { pump(); return done(); }, what);
  return { ...r, A, B, entA, entB, mA, mB, q, said, pump, settle, tickClock: (ms) => { clock += ms; } };
}

test('REALM P2.1 end to end: two realm tabs trade - both confirm, each checkpoints and sends its half, the realm moves both records at once, both packs change exactly as the records did, and no commit frame is ever sent', { timeout: 60_000 }, async () => {
  const t = await tabs();
  const sent = [];
  const origPush = t.q.push.bind(t.q);
  t.q.push = (f) => { sent.push(f.d.k); return origPush(f); };
  assert.deepEqual(t.mA.request('peerBBBB'), { ok: true }); t.pump();
  assert.deepEqual(t.mB.request('peerAAAA'), { ok: true }); t.pump();
  const sa = t.mA.session, sb = t.mB.session;
  assert.deepEqual([sa.rev, sb.theirRev], [REALM_TRADE_REV_BASE, REALM_TRADE_REV_BASE], 'a realm trade numbers from the base');
  assert.equal(sa.setOffer([{ item: t.entA.items[0], count: 1 }], 20).ok, true); t.pump();
  assert.equal(sb.setOffer([{ item: t.entB.items[0], count: 4 }], 0).ok, true); t.pump();
  assert.equal(sa.lock().ok, true); t.pump();
  assert.equal(sb.lock().ok, true); t.pump();
  assert.equal(sa.confirm().ok, true); t.pump();
  assert.equal(sb.confirm().ok, true); t.pump();
  await t.settle(() => sa.isOver && sb.isOver, 'both sides settled');
  assert.deepEqual([sa.phase, sb.phase], ['done', 'done'], `${t.said.A} / ${t.said.B}`);
  assert.ok(!sent.includes('commit'), 'the realm settled it - never a commit frame');
  // the packs
  assert.deepEqual([t.entA.goldPieces, t.entB.goldPieces], [30, 25]);
  assert.deepEqual(t.entA.items.map((i) => [i.templateIndex, i.stackCount ?? 1]), [[131, 7]], 'A: its three arrows and the four it took, one stack');
  assert.deepEqual(t.entB.items.map((i) => [i.templateIndex, i.stackCount ?? 1]).sort(), [[113, 1], [131, 6]]);
  // the records: the checkpoint before the goods left at 2, the trade at 3, and the outcome's own checkpoint at 4 (the
  // pack's, P0.5's - held while the half was with the realm, sent once it answered)
  await until(async () => (await record(t.A.io, t.A.char.id)).seq === 4 && (await record(t.B.io, t.B.char.id)).seq === 4, 'the outcome\'s checkpoints');
  const ra = await record(t.A.io, t.A.char.id), rb = await record(t.B.io, t.B.char.id);
  assert.deepEqual([ra.seq, t.A.session.seq, rb.seq, t.B.session.seq], [4, 4, 4, 4], 'the checkpoint at 2, the trade at 3, the outcome at 4');
  assert.deepEqual([ra.save.goldPieces, rb.save.goldPieces], [30, 25]);
  const count = (s, ti) => s.items.filter((i) => i.templateIndex === ti).reduce((n, i) => n + (i.stackCount ?? 1), 0);
  assert.deepEqual([count(ra.save, 131), count(ra.save, 113), count(rb.save, 131), count(rb.save, 113)], [7, 0, 6, 1], 'the records hold what the packs hold');
  // and the next checkpoint follows on
  assert.equal((await t.A.session.checkpoint('{"next":1}')).ok, true);
  assert.equal((await record(t.A.io, t.A.char.id)).seq, 5);
});

test('REALM P2.1: an older build never settles with the realm - its first rev-bearing frame ends the trade in words, and nobody\'s goods leave', { timeout: 60_000 }, async () => {
  const t = await tabs({ escrowB: false });
  t.mA.request('peerBBBB'); t.pump();
  t.mB.request('peerAAAA'); t.pump();
  assert.equal(t.mB.session.setOffer([{ item: t.entB.items[0], count: 4 }], 0).ok, true); t.pump();
  assert.equal(t.mA.session, null, 'A ended it at B\'s first offer');
  assert.ok(t.said.A.includes(OLDER_BUILD_TRADE_TEXT));
  assert.deepEqual([t.entA.items.length, t.entA.goldPieces, t.entB.items[0].stackCount, t.entB.goldPieces], [2, 50, 10, 5], 'nothing left anyone');
});

test('REALM P2.1: in a realm trade a commit frame is never goods; a refusal restores what was reserved; an answer that never comes keeps the goods out and ends the session', { timeout: 60_000 }, async () => {
  // (a) the peer's half never comes: A's half waits, is refused at its minute, and A's goods come back
  const t = await tabs();
  t.mA.request('peerBBBB'); t.pump(); t.mB.request('peerAAAA'); t.pump();
  const sa = t.mA.session, sb = t.mB.session;
  sa.setOffer([{ item: t.entA.items[0], count: 1 }], 20); t.pump();
  sa.lock(); t.pump(); sb.lock(); t.pump();
  // B confirms, but B's commit is swallowed: only A settles, and B's escrow never sends
  sb._escrow = { hold: () => ({ settle: () => new Promise(() => {}) }) };
  sb.confirm(); t.pump();
  sa.confirm(); t.pump();
  assert.equal(sa.phase, 'committing');
  // a forged commit frame from B, the goods A would love: ignored
  sa.receive({ k: 'commit', s: sa.sid, r: sa.theirRev, o: sa.rev, items: [], g: 999 });
  assert.equal(sa.phase, 'committing');
  await until(async () => !!(await t.env.DB.prepare("SELECT 1 AS one FROM realm_trades WHERE sid = ? AND state = 'waiting'").bind(sa.sid).first()), 'A\'s half waiting');   // A's checkpoint landed, and its half waits
  assert.equal(sa.phase, 'committing', 'still waiting for B\'s half');
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + (REALM_TRADE_TTL_S + 2) * 1000;   // the service's clock: the half has waited past its minute
    await t.settle(() => sa.isOver, 'A told its half expired');
  } finally { Date.now = realNow; }
  assert.equal(sa.phase, 'cancelled');
  assert.ok(t.said.A.includes(realmTradeRefusalText('expired')), t.said.A.join(' | '));
  assert.deepEqual([t.entA.items.length, t.entA.goldPieces], [2, 50], 'the dagger and the gold came back');
  assert.equal(t.A.session.lost, null, 'a refusal is not a loss');

  // (b) no answer at all: the goods stay out, and the session ends - only a join reads how it ended
  const u = await tabs();
  u.mA.request('peerBBBB'); u.pump(); u.mB.request('peerAAAA'); u.pump();
  const ua = u.mA.session, ub = u.mB.session;
  ua.setOffer([{ item: u.entA.items[0], count: 1 }], 20); u.pump();
  ua.lock(); u.pump(); ub.lock(); u.pump();
  ub._escrow = { hold: () => ({ settle: () => new Promise(() => {}) }) };
  ub.confirm(); u.pump();
  u.A.door.mode = 'ok';
  const origFetch = u.A.io.fetch;
  let halves = 0;
  u.A.io.fetch = async (url, init) => {
    if (String(url).endsWith('/v1/realm/trade')) { halves++; u.tickClock(REALM_TRADE_WAIT_MS / 4); throw new TypeError('network'); }
    return origFetch(url, init);
  };
  ua.confirm(); u.pump();
  await u.settle(() => ua.isOver, 'A giving up asking');
  assert.ok(halves >= 4, 'it kept asking');
  assert.equal(ua.phase, 'done');
  assert.deepEqual([u.entA.items.length, u.entA.goldPieces], [1, 30], 'the goods stay out: restoring them could be the duplication');
  assert.deepEqual([u.A.session.lost, u.said.A.includes('lost:unknown')], ['unknown', true]);
  assert.match(realmRefusalText('unknown'), /Join again/);
});

test('REALM P2.1: a hold whose goods could not be reserved is released - the trade ends in words and the tab checkpoints again', { timeout: 60_000 }, async () => {
  const t = await tabs();
  t.mA.request('peerBBBB'); t.pump(); t.mB.request('peerAAAA'); t.pump();
  const sa = t.mA.session, sb = t.mB.session;
  sa.setOffer([{ item: t.entA.items[0], count: 1 }], 0); t.pump();
  sa.lock(); t.pump(); sb.lock(); t.pump();
  sb.confirm(); t.pump();
  t.entA.items.splice(0, 1);   // the dagger leaves the pack between the confirms (a drop, a sale)
  sa.confirm(); t.pump();
  assert.equal(sa.phase, 'cancelled');
  assert.ok(t.said.A.includes('Your goods changed - the trade is off.'));
  await until(async () => (await t.A.session.checkpoint('{"after":"release"}')).ok === true, 'the hold let go');
});

test('REALM P2.1: while a transaction is in flight no checkpoint is sent; the one asked before it lands first, and the service\'s move is adopted', { timeout: 60_000 }, async () => {
  const { player } = await realm();
  const P = await player();
  P.char = await character(P, 'Nystul', { items: [], goldPieces: 1 });
  const s = createRealmSession({ io: P.io, id: P.char.id, lease: P.char.lease, seq: P.char.seq });
  s.checkpoint('{"before":1}');
  let inside = null;
  const r = await s.transact(async (at) => {
    inside = at.seq;
    const n = P.door.inits.length;
    assert.deepEqual(await s.checkpoint('{"during":1}'), { ok: false, error: 'held' });
    assert.equal(P.door.inits.length, n, 'nothing sent');
    return { ok: true, seq: at.seq + 1 };
  });
  assert.equal(inside, 2, 'the checkpoint asked before it landed first');
  assert.deepEqual([r.ok, s.seq], [true, 3], 'the move adopted');
  assert.deepEqual(await settleRealmTradeHalf({ session: { transact: async () => ({ ok: false, why: 'goods' }) }, half: {} }), { ok: false, why: 'goods', text: realmTradeRefusalText('goods') });
});

test('REALM P2.1 by source: the world host hands every trade of a realm character to the realm; the session\'s hold is its own', { timeout: 60_000 }, () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /escrow: realmSession \? realmTradeEscrow\(\{ session: realmSession, checkpoint: \(\) => onlineCheckpoint\(\) \}\) : null,/);
  const ts = src('src/net/tradeSession.js');
  assert.match(ts, /if \(this\._escrow\) \{ this\._settle\(\); return; \}/, 'the commit is the realm\'s');
  assert.match(ts, /if \(this\._handle && !this\._sentCommit && !this\._settling\)/, 'a half with the realm is restored only by its answer');
});
