// BUSY-GATE (2026-10-13, after HOMES-SHED; the owner: "Build whatever can harden our server"): when the account database
// is overloaded, the reads a tab keeps asking stand back - the client's gate (net/accountClient.js `call`) holds them
// for a wait that doubles while the service keeps saying so, and the service's shed (server-account/src/service.js
// shedding) answers them a moment without the database for the clients from before the gate. One law between them,
// net/busyLaw.js. bible/11-Multiplayer/Scale-Arc.md BUSY-GATE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import {
  BUSY_READS, BUSY_RETRY_AFTER_S, BUSY_SHED_MS, BUSY_BASE_MS, BUSY_MAX_MS, BUSY_HOLD_MS, busyRead, busyWaitMs, busyAnswer, retryAfterMs,
} from '../../src/net/busyLaw.js';
import { call, busyUntil, _resetBusyForTests } from '../../src/net/accountClient.js';
import { ROUTES, REPLICA_ROUTES } from '../../server-account/src/service.js';

test('BUSY-GATE the law: the reads that stand back are the fourteen display reads and (BUSY-HEART) the heartbeat and the day\'s motherlodes - each a route the service serves, by its method, a replica\'s read but the three an isolate keeps; the wait doubles from BUSY_BASE_MS to BUSY_MAX_MS, spread over its upper half; an overload is a 503 that says `server` or `queue`, never a 500; a Retry-After is whole seconds (mutants: uncapped; unspread; a 500 an overload; the line unread)', () => {
  assert.deepEqual([...BUSY_READS], [
    ['/v1/homes/town', 'POST'], ['/v1/homes/yards', 'POST'], ['/v1/homes/layouts', 'POST'], ['/v1/homes/mine', 'POST'],
    ['/v1/homes/rooms', 'POST'], ['/v1/homes/decor', 'POST'], ['/v1/prof/pixels', 'POST'], ['/v1/seats/list', 'POST'],
    ['/v1/market/vendors', 'POST'], ['/v1/marks/balance', 'POST'], ['/v1/guilds/invites', 'POST'], ['/v1/realm/lineages', 'POST'],
    ['/v1/realm/unions', 'POST'], ['/v1/saves', 'GET'],
    // PIN MOVED (BUSY-HEART, 2026-10-16): and the heartbeat and the day's motherlodes (test/net/busy_heart.test.js)
    ['/v1/heartbeat', 'POST'], ['/v1/prof/motherlodes', 'POST'],
    ['/v1/towns/econ', 'POST'],   // PIN MOVED (AUDIT TOWN-ECON 2 CLI-8): and the towns' shares, an isolate's kept read
    ['/v1/festival/town', 'POST'],   // PIN MOVED (WITCH1): and a town's Hearth Offerings, a replica's read
  ]);
  for (const [path, method] of BUSY_READS) {
    assert.ok(ROUTES.has(path), `${path}: a route the service serves`);
    // PIN MOVED (DISPLAY-REPLICA, 2026-10-13): each was no replica's read; each is one now (service.js REPLICA_ROUTES), and
    // still stands back - without the tab's bookmark its first statement is the primary's
    assert.equal(REPLICA_ROUTES.get(path) === method || ['/v1/homes/yards', '/v1/homes/layouts', '/v1/seats/list', '/v1/towns/econ'].includes(path), true, `${path}: a replica's read, or one an isolate keeps`);
    assert.equal(busyRead(path, method), true);
    assert.equal(busyRead(path, method === 'GET' ? 'POST' : 'GET'), false, `${path}: by its method alone`);
  }
  for (const act of ['/v1/homes/claim', '/v1/homes/decor/place', '/v1/auth/token', '/v1/market/read', '/v1/chapters/list', '/v1/arena/board']) {   // PIN MOVED (BUSY-HEART): the heartbeat stands back now
    assert.equal(busyRead(act, 'POST'), false, `${act} always goes`);
  }
  assert.deepEqual([BUSY_RETRY_AFTER_S, BUSY_SHED_MS, BUSY_BASE_MS, BUSY_MAX_MS, BUSY_HOLD_MS], [5, 10_000, 5_000, 60_000, 250]);   // PIN MOVED (SHED-LONG, 2026-10-16): the shed 10 s, where it was 2
  assert.deepEqual([1, 2, 3, 4, 5, 6, 40].map((n) => busyWaitMs(n, 1)), [5_000, 10_000, 20_000, 40_000, 60_000, 60_000, 60_000]);
  assert.deepEqual([1, 2, 5].map((n) => busyWaitMs(n, 0)), [2_500, 5_000, 30_000], 'the bottom of its spread, half the wait');
  assert.equal(busyWaitMs(3, 0.5), 15_000);
  assert.deepEqual([[503, 'server'], [503, 'queue'], [500, 'server'], [503, 'offline'], [429, 'rate'], [200, 'server']].map(([s, e]) => busyAnswer(s, e)),
    [true, true, false, false, false, false]);
  assert.deepEqual(['5', ' 7 ', '0', '', 'x', '1.5', null, '999999'].map(retryAfterMs), [5_000, 7_000, 0, 0, 0, 0, 0, 60_000]);
});

const BASE = 'https://accounts.invalid';

test('BUSY-GATE the client: an overload answer holds the reads busyLaw names for its wait - each answered `server` 503 without a request, never at once - while a write, a sign-in, the heartbeat and every other read go; the wait doubles with each overload answer in a row, never shorter than its Retry-After; an answer starts the count again and lets a hold already running run out; a 500 and `offline` hold nothing (mutants: never held; held at once; the count not kept; the Retry-After unread; the count never started again; an answer cutting the hold)', async () => {
  _resetBusyForTests();
  let now = 1_000_000;
  const sent = [];
  /** @type {{status: number, body: any, headers: Record<string, string>}} */
  let answer = { status: 503, body: { error: 'server' }, headers: {} };
  const fetch = async (/** @type {string} */ url, /** @type {any} */ init) => {
    sent.push(url.slice(BASE.length));
    const a = answer;
    return { ok: a.status < 300, status: a.status, headers: { get: (/** @type {string} */ k) => a.headers[k.toLowerCase()] ?? null }, json: async () => a.body };
  };
  const held = [];
  const io = { fetch, base: BASE, now: () => now, rand: () => 1, hold: async (/** @type {number} */ ms) => { held.push(ms); } };
  const town = () => call(io, '/v1/homes/town', { mapId: 152 });

  // the service overloaded: the first ask goes, and its answer starts the wait
  let r = await town();
  assert.deepEqual([r.ok, r.error, r.status, r.busy], [false, 'server', 503, undefined]);
  assert.equal(sent.length, 1);
  assert.equal(busyUntil(), now + BUSY_BASE_MS, 'the first wait (its spread\'s top: a draw of 1)');
  // a read busyLaw names is held: no request, the service's own answer, after the hold - a GET's too
  r = await call(io, '/v1/prof/pixels', { character: 'c', pixels: [] });
  assert.deepEqual([r.ok, r.error, r.status, r.busy], [false, 'server', 503, true]);
  r = await call(io, '/v1/saves');
  assert.equal(r.busy, true);
  assert.equal(sent.length, 1, 'neither asked');
  assert.deepEqual(held, [BUSY_HOLD_MS, BUSY_HOLD_MS], 'each answered after the hold, never at once');
  // a write, a sign-in and a read busyLaw leaves out all go (PIN MOVED, BUSY-HEART: the heartbeat no longer among them)
  answer = { status: 200, body: { ok: true }, headers: {} };
  for (const p of ['/v1/homes/claim', '/v1/auth/token', '/v1/chapters/list', '/v1/market/read']) assert.equal((await call(io, p, {})).ok, true, p);
  assert.deepEqual(sent.slice(1), ['/v1/homes/claim', '/v1/auth/token', '/v1/chapters/list', '/v1/market/read']);
  // those answers started the count again, but the hold already running runs out
  assert.equal((await town()).busy, true, 'still held');
  now += BUSY_BASE_MS;
  answer = { status: 503, body: { error: 'server' }, headers: {} };
  assert.equal((await town()).busy, undefined, 'asked at the wait\'s end');
  assert.equal(busyUntil(), now + BUSY_BASE_MS, 'the count started again: the first wait');
  // each overload answer in a row doubles it, to BUSY_MAX_MS
  for (const w of [10_000, 20_000, 40_000, 60_000, 60_000]) {
    now = busyUntil();
    await town();
    assert.equal(busyUntil(), now + w, `the wait ${w} ms`);
  }
  // never shorter than the answer's own Retry-After - the sign-in line's included
  _resetBusyForTests();
  answer = { status: 503, body: { error: 'queue', position: 40, wait: 30_000 }, headers: { 'retry-after': '30' } };
  await call(io, '/v1/auth/token', {});
  assert.equal(busyUntil(), now + 30_000, 'the line\'s 30 s, past the first wait');
  // a fault and a player offline hold nothing
  _resetBusyForTests();
  answer = { status: 500, body: { error: 'server' }, headers: {} };
  await town();
  assert.equal(busyUntil(), 0, 'a 500 is a fault, not a load');
  r = await call({ ...io, fetch: async () => { throw new TypeError('Failed to fetch'); } }, '/v1/homes/town', { mapId: 152 });
  assert.equal(r.error, 'offline');
  assert.equal(busyUntil(), 0, 'the player offline holds nothing');
  _resetBusyForTests();
});

test('BUSY-GATE the service: an overloaded database met on any route opens the isolate\'s shed - for BUSY_SHED_MS the reads busyLaw names are answered `server` 503 with a Retry-After and not one statement, not even the session\'s lookup, while a write still runs; a moment without an overload closes it; a fault (500) opens nothing; every overload answer says its Retry-After (mutants: the shed unread; the shed never opened; shed forever; every route shed; no Retry-After)', async (t) => {
  const svc = await standService();
  const who = await svc.registered('Shedda');
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  const prepare = svc.env.DB.prepare;
  const asked = [];
  let fault = null;
  svc.env.DB.prepare = (sql) => {
    asked.push(sql);
    const st = prepare.call(svc.env.DB, sql);
    // the siege question's read refused as an overloaded (or a broken) database refuses it, however it is run
    if (fault && /FROM town_seat_battles/.test(sql)) for (const k of ['first', 'all', 'run']) st[k] = async () => { throw new Error(fault); };
    return st;
  };
  const post = (path, body) => svc.fetch(`https://accounts.invalid${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body),
  });
  const town = () => post('/v1/homes/town', { mapId: 152, character: who.character });
  const live = () => svc.fetch('https://accounts.invalid/v1/seats/sieges/live', { method: 'GET' });
  const error = console.error;
  console.error = () => {};
  try {
    assert.equal((await town()).status, 200, 'answered, before any overload');
    // the database overloaded, met on the siege question: its own answer says how long to stand back
    fault = 'D1_ERROR: D1 DB is overloaded. Requests queued for too long. [code: 7429]';
    let res = await live();
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('retry-after'), String(BUSY_RETRY_AFTER_S), 'the overload\'s answer says its Retry-After');
    fault = null;
    // the shed: the town's homes answered as the overload is, and not one statement asked
    asked.length = 0;
    res = await town();
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'server' });
    assert.equal(res.headers.get('retry-after'), String(BUSY_RETRY_AFTER_S));
    assert.deepEqual(asked, [], 'not one statement - not even the session\'s lookup');
    // a write still runs
    res = await post('/v1/account/played', {});
    assert.equal(res.status, 200, 'a write is never shed');
    assert.ok(asked.length > 0);
    // a moment without an overload closes it
    clock += BUSY_SHED_MS - 1;
    assert.equal((await town()).status, 503, 'still shed');
    clock += 1;
    asked.length = 0;
    assert.equal((await town()).status, 200, 'shed no more');
    assert.ok(asked.length > 0, 'the database asked again');
    // a fault opens nothing
    fault = 'D1_ERROR: no such table: town_seat_battles';
    assert.equal((await live()).status, 500);
    fault = null;
    assert.equal((await town()).status, 200, 'a fault sheds nothing');
  } finally {
    console.error = error;
    svc.env.DB.prepare = prepare;
  }
});
