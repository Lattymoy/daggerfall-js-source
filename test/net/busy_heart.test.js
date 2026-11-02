// BUSY-HEART (2026-10-16, the owner: "Fix this" - the account database overloaded from 13:50 UTC and staying so;
// bible/11-Multiplayer/Scale-Arc.md BUSY-HEART): the heartbeat and the day's motherlodes stand back while the database is
// overloaded, as the display reads do (net/busyLaw.js BUSY_READS) - held by the client's gate, shed by an isolate that
// has just met an overload, not one statement asked. They spent the most of the database's time in the overload, asked
// again on their own schedules. Each pin failed on the build before it. tools/mutants/busy_heart.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { BUSY_RETRY_AFTER_S, BUSY_SHED_MS, busyRead } from '../../src/net/busyLaw.js';
import { call, _resetBusyForTests } from '../../src/net/accountClient.js';

const BASE = 'https://accounts.invalid';

test('BUSY-HEART the client: after an overload answer the heartbeat and the motherlodes are held - each `server` 503 without a request - and asked again at the wait\'s end (mutants: either dropped from the law)', async () => {
  assert.equal(busyRead('/v1/heartbeat', 'POST'), true);
  assert.equal(busyRead('/v1/prof/motherlodes', 'POST'), true);
  _resetBusyForTests();
  let now = 1_000_000;
  const sent = [];
  let answer = { status: 503, body: { error: 'server' }, headers: { 'retry-after': '5' } };
  const fetch = async (/** @type {string} */ url) => {
    sent.push(url.slice(BASE.length));
    const a = answer;
    return { ok: a.status < 300, status: a.status, headers: { get: (/** @type {string} */ k) => a.headers[k.toLowerCase()] ?? null }, json: async () => a.body };
  };
  const io = { fetch, base: BASE, now: () => now, rand: () => 1, hold: async () => {} };
  assert.equal((await call(io, '/v1/homes/town', { mapId: 1 })).status, 503, 'the overload told once');
  for (const [path, body] of [['/v1/heartbeat', { beat: true, board: 1 }], ['/v1/prof/motherlodes', { character: 'c' }]]) {
    const r = await call(io, path, body);
    assert.deepEqual([r.ok, r.error, r.status, r.busy], [false, 'server', 503, true], `${path}: held`);
  }
  assert.deepEqual(sent, ['/v1/homes/town'], 'neither asked while the wait runs');
  now += 5_000;
  answer = { status: 200, body: {}, headers: {} };
  assert.equal((await call(io, '/v1/heartbeat', { beat: true })).ok, true, 'the wait over: asked');
  assert.deepEqual(sent, ['/v1/homes/town', '/v1/heartbeat']);
  _resetBusyForTests();
});

test('BUSY-HEART the service: an isolate that has met an overload answers the heartbeat and the motherlodes `server` 503 with a Retry-After for BUSY_SHED_MS, not one statement asked - not even the session\'s lookup (mutant: either dropped from the law)', async (t) => {
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
    if (fault && /FROM town_seat_battles/.test(sql)) for (const k of ['first', 'all', 'run']) st[k] = async () => { throw new Error(fault); };
    return st;
  };
  const post = (path, body) => svc.fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${who.secret}` }, body: JSON.stringify(body),
  });
  const error = console.error;
  console.error = () => {};
  try {
    assert.equal((await post('/v1/heartbeat', { board: 1 })).status, 200, 'answered, before any overload');
    fault = 'D1_ERROR: D1 DB is overloaded. Requests queued for too long. [code: 7429]';
    assert.equal((await svc.fetch(`${BASE}/v1/seats/sieges/live`, { method: 'GET' })).status, 503, 'the overload met');
    fault = null;
    for (const [path, body] of [['/v1/heartbeat', { beat: true, board: 1 }], ['/v1/prof/motherlodes', { character: who.character }]]) {
      asked.length = 0;
      const res = await post(path, body);
      assert.equal(res.status, 503, `${path}: shed`);
      assert.deepEqual(await res.json(), { error: 'server' });
      assert.equal(res.headers.get('retry-after'), String(BUSY_RETRY_AFTER_S));
      assert.deepEqual(asked, [], `${path}: not one statement`);
    }
    clock += BUSY_SHED_MS;
    asked.length = 0;
    assert.equal((await post('/v1/heartbeat', { board: 1 })).status, 200, 'shed no more');
    assert.ok(asked.length > 0, 'the database asked again');
  } finally {
    console.error = error;
    svc.env.DB.prepare = prepare;
  }
});
