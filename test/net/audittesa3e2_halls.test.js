// AUDIT TESA III E2-5 (2026-10-26; bible/01-Overview/audits/Audit-Tesa-III-E2.md E2-5; the owner: "Take care of exclusions
// and gaps"): WHAT ONE SOCKET CAN MAKE THE HUB KEEP, BOUNDED. A hub's `wdun` word names any world map pixel as a hall, and
// every word kept something - an epoch two days, an emptiness a day, a lock an hour - and wrote the whole record: one
// signed-in socket at WDUN_HZ_MAX grew it 69 bytes a word, toward Durable Object storage's 2 MB value in four hours
// (reproduced before the fix: 1,000 words, 1,000 writes, 500 halls in each of the epochs, the empties and the locks).
// Pins by count: an account stands in one hall; brings WDUN_NEW_HALLS_MAX halls into the record a day; every map to its
// count, the least recent let go first; the widest full record under its bytes; the record written at most each
// WDUN_SAVE_MS, the owed write made by the next word past the window and by the drain; an account's tabs one bucket.
// tools/mutants/audittesa3e2_halls.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SOCIAL_ROOM, WDUN_HZ_MAX, WDUN_LOCK_MS, WDUN_DAY_MS } from '../../src/net/wire.js';
import * as L from '../../src/net/wild/wildLaw.js';
import { fakeRooms } from '../fakeRoom.mjs';

const T = 1e12;
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const hall = (i) => `${1000 + (i % 3000)},${-2000 - Math.floor(i / 3000)}`;

test('E2-5 the law: an account stands in one hall - going into another leaves the one the record still held it in, which counts empty from then (mutants: the one hall unkept)', () => {
  const st = L.wdunEmpty();
  for (let i = 0; i < 5; i++) assert.equal(L.wdunEnter(st, 'acct-a', hall(i), T + i * 1000).ok, true);
  assert.deepEqual(Object.keys(st.inside), [hall(4)], 'one hall');
  for (let i = 0; i < 4; i++) assert.equal(st.empty[hall(i)], T + (i + 1) * 1000, 'each left as the next was entered');
  L.wdunEnter(st, 'acct-b', hall(4), T + 9000);
  L.wdunEnter(st, 'acct-a', hall(7), T + 9500);
  assert.deepEqual(st.inside[hall(4)], { 'acct-b': T + 9000 }, 'a hall another stands in is not emptied');
  assert.equal(st.empty[hall(4)], undefined);
});

test('E2-5 the law: every map to its count, the least recent or soonest-ending let go first; the hub\'s meters by account bounded, a day\'s count afresh (mutants: each cap unread; the order reversed; the meters unbounded; the day never turning)', () => {
  const st = L.wdunEmpty();
  // an account's locks: its WDUN_ACCT_LOCKS_MAX latest-ending kept
  for (let i = 0; i < L.WDUN_ACCT_LOCKS_MAX + 8; i++) (st.locks['acct-a'] ??= {})[hall(i)] = T + i;
  // all locks: WDUN_LOCKS_MAX, the soonest-ending let go
  for (let i = 0; i < L.WDUN_LOCKS_MAX + 100; i++) (st.locks[`acct-${String(i).padStart(5, '0')}`] ??= {})[hall(i)] = T + WDUN_LOCK_MS + i;
  for (let i = 0; i < L.WDUN_PILES_MAX + 10; i++) st.piles[`pile-${i}`] = { h: hall(i), until: T + i };
  for (let i = 0; i < L.WDUN_HALLS_MAX + 10; i++) { st.eps[hall(i)] = { n: 1, at: T + i }; st.empty[hall(i)] = T + i; st.crows[hall(i)] = T + i; }
  for (let i = 0; i < L.WDUN_HALLS_MAX + 10; i++) st.inside[hall(i)] = { [`in-${i}`]: T + i };
  assert.equal(L.wdunBound(st), true);
  assert.equal(Object.keys(st.locks['acct-a'] ?? {}).length, 0, 'the soonest-ending locks of all went first - acct-a\'s were the soonest');
  const locks = Object.values(st.locks).reduce((n, h) => n + Object.keys(h).length, 0);
  assert.equal(locks, L.WDUN_LOCKS_MAX, 'all locks');
  assert.equal(st.locks['acct-00000'], undefined, 'the soonest-ending went');
  assert.ok(st.locks[`acct-${String(L.WDUN_LOCKS_MAX + 99).padStart(5, '0')}`], 'the latest stayed');
  assert.equal(Object.keys(st.piles).length, L.WDUN_PILES_MAX);
  assert.equal(st.piles['pile-0'], undefined);
  for (const k of ['eps', 'empty', 'crows']) { assert.equal(Object.keys(st[k]).length, L.WDUN_HALLS_MAX, k); assert.equal(st[k][hall(0)], undefined, `${k}: the least recent went`); assert.ok(st[k][hall(L.WDUN_HALLS_MAX + 9)], `${k}: the newest stayed`); }
  assert.equal(Object.keys(st.inside).length, L.WDUN_HALLS_MAX, 'the halls stood in');
  assert.equal(st.inside[hall(0)], undefined, 'the one stood in least recently went');
  assert.ok(st.inside[hall(L.WDUN_HALLS_MAX + 9)], 'the newest hall stood in stayed');
  // the accounts standing in halls, in all: WDUN_INSIDE_MAX, the one heard from least recently let go
  const crowd = L.wdunEmpty();
  crowd.inside['5,5'] = Object.fromEntries(Array.from({ length: L.WDUN_INSIDE_MAX + 10 }, (_, i) => [`in-${i}`, T + i]));
  assert.equal(L.wdunBound(crowd), true);
  assert.equal(Object.keys(crowd.inside['5,5']).length, L.WDUN_INSIDE_MAX, 'the accounts standing');
  assert.equal(crowd.inside['5,5']['in-0'], undefined, 'the least recently heard went');
  // an account's own locks past its count, alone
  const one = L.wdunEmpty();
  for (let i = 0; i < L.WDUN_ACCT_LOCKS_MAX + 8; i++) (one.locks['acct-a'] ??= {})[hall(i)] = T + i;
  L.wdunBound(one);
  assert.equal(Object.keys(one.locks['acct-a']).length, L.WDUN_ACCT_LOCKS_MAX, 'an account\'s locks');
  assert.equal(one.locks['acct-a'][hall(0)], undefined, 'its soonest-ending went');
  assert.equal(L.wdunBound(one), false, 'and a bounded record moves nothing');
  // the hub's meters, by account: WDUN_ACCTS_MAX at the most, the least recent let go; a new day counts afresh
  const meters = new Map();
  for (let i = 0; i <= L.WDUN_ACCTS_MAX; i++) L.wdunMeterOf(meters, `m-${i}`, T);
  assert.equal(meters.size, L.WDUN_ACCTS_MAX);
  assert.equal(meters.has('m-0'), false, 'the least recent went');
  L.wdunMeterOf(meters, 'm-1', T).n = 9;
  assert.equal(L.wdunMeterOf(meters, 'm-1', T + 1).n, 9, 'the same day: its count');
  assert.equal(L.wdunMeterOf(meters, 'm-1', T + WDUN_DAY_MS).n, 0, 'a new day: none');
});

test('E2-5 the counts: a long day\'s play under each - the zone stands some 840 halls a day and a hall takes minutes, so 64 new ones an account a day (halls nobody stood in for a day or two) is more than one player\'s day; a write each ten seconds (mutants: another count)', () => {
  assert.deepEqual([L.WDUN_NEW_HALLS_MAX, L.WDUN_SAVE_MS, L.WDUN_HALLS_MAX, L.WDUN_INSIDE_MAX, L.WDUN_ACCT_LOCKS_MAX, L.WDUN_LOCKS_MAX, L.WDUN_PILES_MAX], [64, 10_000, 2048, 4096, 32, 8192, 4096]);
});

test('E2-5 the bytes: the record at every count full, with the widest keys an account and a hall have, is under WDUN_RECORD_BYTES_MAX and Durable Object storage\'s 2 MB value (mutants: a count raised past it)', () => {
  const st = L.wdunEmpty();
  const acct = (i) => `${'x'.repeat(34)}${String(i).padStart(6, '0')}`;   // net/identityToken.js ID_RE: 40 at the most
  const wide = (i) => `-${String(1000 + (i % 8000)).padStart(4, '0')},-${String(1000 + Math.floor(i / 8000)).padStart(4, '0')}`;   // 11, the widest a pixel's
  const far = 9_999_999_999_999;
  for (let i = 0; i < L.WDUN_LOCKS_MAX; i++) st.locks[acct(i)] = { [wide(i)]: far };   // every lock its own account: the most keys
  for (let i = 0; i < L.WDUN_PILES_MAX; i++) st.piles[acct(i)] = { h: wide(i), until: far };
  const per = Math.ceil(L.WDUN_INSIDE_MAX / L.WDUN_HALLS_MAX);
  for (let i = 0; i < L.WDUN_HALLS_MAX; i++) {
    st.eps[wide(i)] = { n: 99_999, at: far }; st.empty[wide(i)] = far; st.crows[wide(i)] = far;
    st.inside[wide(i)] = Object.fromEntries(Array.from({ length: per }, (_, k) => [acct(i * per + k), far]));
  }
  for (let g = 0; g < 8; g++) st.giants[g] = far;
  assert.equal(L.wdunBound(st), false, 'every count full, none past');
  const bytes = JSON.stringify(st).length;
  assert.ok(bytes <= L.WDUN_RECORD_BYTES_MAX, `${bytes} bytes`);
  assert.ok(L.WDUN_RECORD_BYTES_MAX < 2 * 1024 * 1024, 'under the storage value\'s 2 MB');
});

/** A hub with sockets of their own accounts, its clock, and the writes of the halls record counted. */
async function hubWith(t, names) {
  let clock = T;
  t.mock.method(Date, 'now', () => clock);
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  const socks = {};
  for (const [peer, acct] of names) { const ws = hub.connect(); await quiet(() => hub.hello(ws, peer, null, { name: peer, acct, asecret: `secret-${acct}` })); socks[peer] = ws; }
  const writes = [];
  const put = hub.state.storage.put.bind(hub.state.storage);
  hub.state.storage.put = async (k, v) => { if (k === L.WDUN_KEY) writes.push(clock); return put(k, v); };
  const wd = (ws, o) => quiet(() => hub.raw(ws, JSON.stringify({ t: 'wdun', ...o })));
  const got = (ws, k) => ws.sent.filter((m) => m.t === 'wdun' && m.k === k);
  return { hub, socks, writes, wd, got, tick: (ms) => { clock += ms; }, now: () => clock };
}

test('E2-5 the hub: one socket saying a thousand words over made-up halls keeps WDUN_NEW_HALLS_MAX of them and its own locks, every `in` answered; a real hall another stood in before keeps its epoch; the record written once a WDUN_SAVE_MS, never a word (mutants: the meter unread; the day\'s count never kept; a write a word)', async (t) => {
  const h = await hubWith(t, [['peer-a', 'acct-a'], ['peer-b', 'acct-b']]);
  const { socks: { 'peer-a': a, 'peer-b': b } } = h;
  await h.wd(b, { k: 'in', h: '512,88' }); h.tick(1000);
  await h.wd(b, { k: 'out', h: '512,88' }); h.tick(1000);
  const start = h.now(), w0 = h.writes.length;
  const N = 1000;
  for (let i = 0; i < N; i++) { h.tick(1000 / WDUN_HZ_MAX); await h.wd(a, { k: i % 2 ? 'out' : 'in', h: hall(i >> 1) }); }
  const span = h.now() - start;
  const st = h.hub.room._wdun;
  assert.equal(h.got(a, 'ok').length, N / 2, 'every `in` answered');
  const mine = Object.keys(st.eps).filter((k) => k !== '512,88');
  assert.equal(mine.length, L.WDUN_NEW_HALLS_MAX, 'a day\'s new halls of one account, and no more');
  assert.equal(Object.keys(st.empty).filter((k) => k !== '512,88').length, L.WDUN_NEW_HALLS_MAX);
  assert.ok(Object.keys(st.locks['acct-a']).length <= L.WDUN_ACCT_LOCKS_MAX, 'its own locks bounded');
  assert.ok(st.eps['512,88'] && st.locks['acct-b']?.['512,88'], 'the real hall\'s epoch and its lock stand');
  const writes = h.writes.length - w0;
  assert.ok(writes <= Math.ceil(span / L.WDUN_SAVE_MS) + 1, `${writes} writes in ${span / 1000} s`);
  assert.ok(writes >= Math.floor(span / L.WDUN_SAVE_MS) - 1, 'and the record is written all the same');
  // a new day: the account's count begins again
  h.tick(WDUN_DAY_MS);
  await h.wd(a, { k: 'in', h: hall(5000) });
  assert.ok(h.hub.room._wdun.inside[hall(5000)]?.['acct-a'], 'a new day, a new hall kept');
});

test('E2-5 the owed write: a word inside the window is written by the next word past it, and by the hub\'s drain (mutants: the owed never written; the drain silent)', async (t) => {
  const h = await hubWith(t, [['peer-a', 'acct-a']]);
  const a = h.socks['peer-a'];
  h.tick(L.WDUN_SAVE_MS);
  await h.wd(a, { k: 'in', h: '512,88' });
  const n = h.writes.length;
  h.tick(1000);
  await h.wd(a, { k: 'out', h: '512,88' });
  assert.equal(h.writes.length, n, 'inside the window: owed');
  assert.equal(h.hub.store.get(L.WDUN_KEY)?.locks?.['acct-a'], undefined, 'not yet in storage');
  h.tick(L.WDUN_SAVE_MS);
  await h.wd(a, { k: 'hi' });
  assert.equal(h.writes.length, n + 1, 'the next word past the window writes it');
  assert.ok(h.hub.store.get(L.WDUN_KEY).locks['acct-a']['512,88'], 'the lock kept');
  h.tick(1000);
  await h.wd(a, { k: 'in', h: '600,90' });
  assert.equal(h.writes.length, n + 1, 'owed again');
  await quiet(() => h.hub.drop(a));
  assert.equal(h.writes.length, n + 2, 'the drain writes what is owed');
  assert.ok(h.hub.store.get(L.WDUN_KEY).eps['600,90'], 'the hall kept');
});

test('E2-5 an account\'s sockets one after another: a reconnect is no fresh bucket - ten sockets of one account, each saying ten words at once and gone, are heard at one account\'s burst and rate (the hub seats one socket an account at a time, ONE-SEAT; the bucket was a socket\'s) (mutants: the account\'s bucket unread)', async (t) => {
  const h = await hubWith(t, []);
  let heard = 0;
  for (let round = 0; round < 10; round++) {
    const ws = h.hub.connect();
    await quiet(() => h.hub.hello(ws, 'peer-a', null, { name: 'peer-a', acct: 'acct-a', asecret: 'secret-acct-a' }));
    for (let i = 0; i < 10; i++) await h.wd(ws, { k: 'hi' });
    heard += h.got(ws, 'st').length;
    await quiet(() => h.hub.drop(ws));
    h.tick(100);
  }
  assert.ok(heard <= 6 + Math.ceil(10 * 0.1 * WDUN_HZ_MAX) + 1, `${heard} of 100 words heard: the account's one bucket`);
  assert.ok(heard >= 6, 'its burst heard');
});
