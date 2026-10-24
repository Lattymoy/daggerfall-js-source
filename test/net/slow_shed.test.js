// SLOW-SHED (2026-10-19, the account database overloaded again, 18:05-18:25 UTC: the median request waited 10 s and D1
// refused almost nothing; bible/11-Multiplayer/Scale-Arc.md SLOW-SHED) - A DATABASE TOO SLOW TO ANSWER IS SHED AS ONE
// THAT REFUSES: each isolate hears its requests' D1 wait over their round trips (metrics.js measured) and, while its last
// SLOW_SHED_SPAN_MS of them average SLOW_SHED_WAIT_MS a trip over SLOW_SHED_MIN requests, sheds the reads an overload
// sheds; and the page's gate takes a display read that timed out as the overload's word, a stall once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  noteD1Wait, shedding, _resetBusyShed, SLOW_SHED_WAIT_MS, SLOW_SHED_TRIP_CAP_MS, SLOW_SHED_SPAN_MS, SLOW_SHED_MIN,
} from '../../server-account/src/service.js';
import { measured } from '../../server-account/src/metrics.js';
import { BUSY_SHED_MS, BUSY_READS, BUSY_BASE_MS, BUSY_RETRY_AFTER_S } from '../../src/net/busyLaw.js';
import { call, busyUntil, _resetBusyForTests } from '../../src/net/accountClient.js';
import { standService, T0 } from '../accountDb.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const T = T0 * 1000;
const TOWN = '/v1/homes/town';
/** The warnings said while `fn` runs. */
async function warned(fn) {
  const said = [];
  const real = console.warn;
  console.warn = (...a) => { said.push(a.join(' ')); };
  try { await fn(); } finally { console.warn = real; }
  return said;
}

test('SLOW-SHED the law: SLOW_SHED_MIN requests in SLOW_SHED_SPAN_MS averaging SLOW_SHED_WAIT_MS a trip or more open the shed for BUSY_SHED_MS - the reads busyLaw.js names alone - and say so once; fewer, quicker or older requests, a request that asked nothing, and one heavy statement in a quiet isolate open none (mutants: the floor, the threshold\'s side, the span, the sums keeping the gone, the mean unweighted, a shed read counted, the cap, a quick request keeping it open, the word unsaid)', async () => {
  assert.equal(SLOW_SHED_WAIT_MS, 1_000, 'measured: a healthy service at most some 820 ms a trip, every overload 1,212 or more (Scale-Arc SLOW-SHED, AUDIT LEAN-READS C2)');
  assert.equal(SLOW_SHED_TRIP_CAP_MS, 5_000);
  assert.equal(SLOW_SHED_SPAN_MS, 30_000);
  assert.equal(SLOW_SHED_MIN, 16);
  _resetBusyShed();
  for (let i = 0; i < SLOW_SHED_MIN - 1; i++) noteD1Wait(3 * SLOW_SHED_WAIT_MS, 3, T + i);
  assert.equal(shedding(TOWN, 'POST', T + 20), false, 'one fewer than the floor: no shed');
  for (let i = 0; i < 40; i++) noteD1Wait(0, 0, T + 20);
  assert.equal(shedding(TOWN, 'POST', T + 20), false, 'a request that asked nothing says nothing');
  const said = await warned(() => { noteD1Wait(3 * SLOW_SHED_WAIT_MS, 3, T + 30); noteD1Wait(3 * SLOW_SHED_WAIT_MS, 3, T + 31); });
  assert.equal(shedding(TOWN, 'POST', T + 30), true, 'the floor: shed');
  assert.equal(said.filter((w) => w.startsWith('[busy] slow: the shed opened')).length, 1, 'said once, as it opened (AUDIT LEAN-READS C6)');
  assert.equal(shedding('/v1/market/buy', 'POST', T + 30), false, 'an act is never shed');
  assert.equal(shedding(TOWN, 'POST', T + 31 + BUSY_SHED_MS), false, 'BUSY_SHED_MS on, closed');
  // the mean is the database's wait over its trips, a request of many weighing as many: fifteen requests of one trip at
  // 600 ms and one of a hundred at 1,100 ms a trip - 1,047 ms a trip (a request's mean: 631)
  _resetBusyShed();
  for (let i = 0; i < SLOW_SHED_MIN - 1; i++) noteD1Wait(600, 1, T + i);
  noteD1Wait(100 * 1_100, 100, T + 20);
  assert.equal(shedding(TOWN, 'POST', T + 20), true, 'the trips\' wait, not the requests\'');
  // exactly the threshold sheds; a hair under does not
  _resetBusyShed();
  for (let i = 0; i < SLOW_SHED_MIN; i++) noteD1Wait(SLOW_SHED_WAIT_MS, 1, T + i);
  assert.equal(shedding(TOWN, 'POST', T + 20), true, 'at the threshold');
  _resetBusyShed();
  for (let i = 0; i < SLOW_SHED_MIN; i++) noteD1Wait(SLOW_SHED_WAIT_MS - 1, 1, T + i);
  assert.equal(shedding(TOWN, 'POST', T + 20), false, 'under it');
  // AUDIT LEAN-READS C4: a quiet isolate's one heavy statement - fifteen quick requests and a 25 s measure - is no queue
  _resetBusyShed();
  for (let i = 0; i < SLOW_SHED_MIN - 1; i++) noteD1Wait(60, 1, T + i);
  noteD1Wait(25_000, 1, T + 20);
  assert.equal(shedding(TOWN, 'POST', T + 20), false, 'a trip counts SLOW_SHED_TRIP_CAP_MS at most');
  // the span: slow requests older than SLOW_SHED_SPAN_MS are forgotten
  _resetBusyShed();
  for (let i = 0; i < SLOW_SHED_MIN - 1; i++) noteD1Wait(4 * SLOW_SHED_WAIT_MS, 1, T);
  noteD1Wait(4 * SLOW_SHED_WAIT_MS, 1, T + SLOW_SHED_SPAN_MS + 1);
  assert.equal(shedding(TOWN, 'POST', T + SLOW_SHED_SPAN_MS + 1), false, 'the slow ones a span ago are gone');
  // and their waits with them: the window's sums kept as requests come and go - a drained database's quick window, past
  // a slow one, reads quick
  _resetBusyShed();
  for (let i = 0; i < SLOW_SHED_MIN; i++) noteD1Wait(4 * SLOW_SHED_WAIT_MS, 1, T + i);
  const later = T + SLOW_SHED_SPAN_MS + 100;
  for (let i = 0; i < SLOW_SHED_MIN; i++) noteD1Wait(0.9 * SLOW_SHED_WAIT_MS, 1, later + i);
  noteD1Wait(1.1 * SLOW_SHED_WAIT_MS, 1, later + 50);
  assert.equal(shedding(TOWN, 'POST', later + 50), false, 'the gone requests\' waits gone from the sums');
  // the database drained: quick requests keep nothing open - closed BUSY_SHED_MS after the last slow one
  _resetBusyShed();
  for (let i = 0; i < SLOW_SHED_MIN; i++) noteD1Wait(4 * SLOW_SHED_WAIT_MS, 1, T + i);
  for (let i = 0; i < 4 * SLOW_SHED_MIN; i++) noteD1Wait(10, 1, T + 100 + i);
  assert.equal(shedding(TOWN, 'POST', T + 15 + BUSY_SHED_MS), false, 'quick again: closed on time');
  _resetBusyShed();
});

test('SLOW-SHED the service hears its own wait a trip at a time - a batch is one trip, whatever it carries; a trip that threw is one; each trip counts SLOW_SHED_TRIP_CAP_MS at most, however many trips its request made - and a shed town read is answered `server` 503 with its Retry-After and no statement; production binds the metrics that hear it (mutants: the wait unheard, a batch counted by its statements, a batch or a statement untripped, a trip only where it answered, the cap the request\'s)', async () => {
  assert.match(src('server-account/wrangler.toml'), /\[\[analytics_engine_datasets\]\]\nbinding = "METRICS"/, 'measured() hears the wait where METRICS is bound (AUDIT LEAN-READS C5)');
  const svc = await standService();   // a fresh isolate - nothing shed
  const g = await svc.guest();
  _resetBusyShed();
  const realNow = Date.now;
  let clock = T;
  Date.now = () => clock;
  try {
    // each request's trips waiting TRIP each - the requests in turn, so each is its own (AUDIT LEAN-READS: a shared clock
    // under Promise.all made each wait the sum of the others' before it)
    const TRIP = 1_800;
    let wait = TRIP;
    const slow = async () => { clock += wait; };
    const st = { bind() { return st; }, first: async () => { await slow(); return null; }, run: async () => { await slow(); throw new Error('D1_ERROR: a refusal'); } };
    const env = { DB: { prepare: () => st, batch: async (l) => { await slow(); return l.map(() => ({ results: [] })); } }, METRICS: { writeDataPoint() {} } };
    const request = (ask) => measured(new Request('https://accounts.invalid/v1/account/played'), env,
      async (_r, e) => { try { await ask(e.DB); } catch { /* the route answers its own refusal */ } return new Response('{}'); });
    const moment = async (ask, n = SLOW_SHED_MIN) => { for (let i = 0; i < n; i++) await request(ask); };
    const said = await warned(() => moment((db) => db.batch(Array.from({ length: 12 }, () => db.prepare('SELECT 1')))));
    assert.equal(shedding(TOWN, 'POST', clock), true, 'the isolate sheds: a batch is the queue\'s one trip (AUDIT LEAN-READS C1)');
    assert.ok(said.some((w) => w.includes(`waited ${TRIP} ms a trip`)), said.join(' | '));
    _resetBusyShed();
    await moment((db) => db.prepare('SELECT 1').first());
    assert.equal(shedding(TOWN, 'POST', clock), true, 'and a statement awaited alone is one');
    _resetBusyShed();
    await moment((db) => db.prepare('SELECT 1').run());
    assert.equal(shedding(TOWN, 'POST', clock), true, 'and one that threw: it waited all the same');
    let asked = 0;
    const base = svc.env.DB;
    svc.env.DB = Object.create(base);
    svc.env.DB.prepare = (sql) => { asked++; return base.prepare(sql); };
    const res = await svc.fetch('https://accounts.invalid' + TOWN, { method: 'POST', headers: { authorization: `Bearer ${g.secret}`, 'content-type': 'application/json' }, body: JSON.stringify({ mapId: 7 }) });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'server');
    assert.equal(res.headers.get('retry-after'), String(BUSY_RETRY_AFTER_S), 'with its Retry-After (AUDIT LEAN-READS C7)');
    assert.equal(asked, 0, 'no statement');
    // AUDIT LEAN-READS C4, a trip's own cap: fifteen quick requests, and one of ten trips - nine quick and one of 25 s - is no
    // queue (capped by its request, 25,090 ms over ten trips read 1,040 ms a trip across the window)
    _resetBusyShed();
    wait = 60;
    await moment((db) => db.prepare('SELECT 1').first(), SLOW_SHED_MIN - 1);
    await request(async (db) => { wait = 10; for (let i = 0; i < 9; i++) await db.prepare('SELECT 1').first(); wait = 25_000; await db.prepare('SELECT 1').first(); });
    assert.equal(shedding(TOWN, 'POST', clock), false, 'each trip at most SLOW_SHED_TRIP_CAP_MS');
  } finally { Date.now = realNow; _resetBusyShed(); }
});

test('SLOW-SHED the page: a display read that timed out holds the reads as an overload answer does - a stall once, however many reads it caught, and a burst of the shed\'s 503s once - doubling while reads sent after the hold keep timing out or being shed; a write, a sign-in or an act that times out, and a call that could not be made, hold nothing (mutants: the timeout unheard, every read held, an act held, a stall counted per read, a stall\'s late read counted again, a burst of 503s counted per answer, no doubling)', async () => {
  let at = 1_000_000;
  const now = () => at;
  const timeout = async () => { throw new DOMException('the wait ran out', 'TimeoutError'); };
  const unreachable = async () => { throw new TypeError('Failed to fetch'); };
  _resetBusyForTests();
  assert.ok(BUSY_READS.has('/v1/market/vendors'));
  assert.equal((await call({ fetch: timeout, now, rand: () => 1 }, '/v1/market/vendors', { region: 17 })).error, 'offline');
  assert.equal(busyUntil(), at + BUSY_BASE_MS, 'the reads held the first wait');
  assert.equal((await call({ fetch: timeout, now, rand: () => 1, hold: async () => {} }, '/v1/homes/town', { mapId: 1 })).busy, true, 'and the next is held');
  // AUDIT LEAN-READS C3: one stall, seven reads out together - one word
  _resetBusyForTests();
  let release;
  const stalled = () => new Promise((_, reject) => { const prev = release; release = () => { prev?.(); reject(new DOMException('the wait ran out', 'TimeoutError')); }; });
  const out = Array.from({ length: 7 }, (_, i) => call({ fetch: stalled, now, rand: () => 1 }, i % 2 ? '/v1/homes/town' : '/v1/market/vendors', { region: 17 }));
  release();
  await Promise.all(out);
  assert.equal(busyUntil(), at + BUSY_BASE_MS, 'a stall holds the first wait, not seven doublings');
  // and after the hold, still timing out: doubled
  at += BUSY_BASE_MS;
  await call({ fetch: timeout, now, rand: () => 1 }, '/v1/market/vendors', { region: 17 });
  assert.equal(busyUntil(), at + 2 * BUSY_BASE_MS, 'doubled');
  // a read that left before the stall's hold began and times out after it ran out is that stall still - 15 s to time out,
  // past the first hold's wait - so it holds nothing more; one that left after the hold, timing out, is the word again
  _resetBusyForTests();
  at = 0;
  const pending = [];
  const late = () => new Promise((_, reject) => { pending.push(() => reject(new DOMException('the wait ran out', 'TimeoutError'))); });
  const first = call({ fetch: late, now, rand: () => 1 }, '/v1/market/vendors', { region: 17 });
  at = 6_000;
  const second = call({ fetch: late, now, rand: () => 1 }, '/v1/homes/town', { mapId: 1 });
  at = 15_000;
  pending[0]();
  await first;
  assert.equal(busyUntil(), 15_000 + BUSY_BASE_MS);
  at = 21_000;
  pending[1]();
  await second;
  assert.equal(busyUntil(), 15_000 + BUSY_BASE_MS, 'the stall\'s read, timed out after its hold: counted once');
  at = 22_000;
  const third = call({ fetch: late, now, rand: () => 1 }, '/v1/market/vendors', { region: 17 });
  at = 37_000;
  pending[2]();
  await third;
  assert.equal(busyUntil(), 37_000 + 2 * BUSY_BASE_MS, 'a read sent after it timed out too: doubled');
  // AUDIT LEAN-READS: ONE BURST IS ONE WORD - seven reads out together, every one answered 503 by the shed: the first wait
  // (or the answer's own Retry-After), never seven doublings; after it, the shed's word again: doubled
  _resetBusyForTests();
  at = 100_000;
  const shed = async () => new Response(JSON.stringify({ error: 'server' }), { status: 503, headers: { 'content-type': 'application/json', 'retry-after': '1' } });
  await Promise.all(Array.from({ length: 7 }, (_, i) => call({ fetch: shed, now, rand: () => 1 }, i % 2 ? '/v1/homes/town' : '/v1/market/vendors', { region: 17 })));
  assert.equal(busyUntil(), 100_000 + BUSY_BASE_MS, 'a burst holds the first wait');
  at += BUSY_BASE_MS;
  await call({ fetch: shed, now, rand: () => 1 }, '/v1/market/vendors', { region: 17 });
  assert.equal(busyUntil(), at + 2 * BUSY_BASE_MS, 'the shed\'s word after the hold: doubled');
  for (const [path, body] of [['/v1/market/buy', { listing: 'x' }], ['/v1/auth/login', { handle: 'a' }], ['/v1/prof/harvest', { node: 'n' }]]) {
    _resetBusyForTests();
    await call({ fetch: timeout, now, rand: () => 0 }, path, body);
    assert.equal(busyUntil(), 0, `${path} timed out: nothing held`);
  }
  _resetBusyForTests();
  await call({ fetch: unreachable, now, rand: () => 0 }, '/v1/market/vendors', { region: 17 });
  assert.equal(busyUntil(), 0, 'a call that could not be made is the player\'s own line - nothing held');
  _resetBusyForTests();
});
