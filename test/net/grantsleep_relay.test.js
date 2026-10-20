// GRANT-SLEEP (2026-10-20, the owner: "the server cost is skyrocketing", then "Its the durable objects";
// bible/11-Multiplayer/Spawn-Grants.md section 22, bible/11-Multiplayer/Scale-Arc.md ROOM-SLEEP): A CELL THAT TOOK A
// GRANT ASK STILL SLEEPS. A Durable Object with a timer pending cannot hibernate, and is billed for every second of it;
// GRANT2's measure armed a ten-minute timer at a cell's first ask, and again at the first ask after each post, so every
// cell a player stood in was awake and billed around the clock from world218 on. The window now posts at a door - the
// first frame or close after it is due, or the cell's drain - as the metrics' window does. Over a real Room
// (test/fakeRoom.mjs), the asks the client makes. tools/mutants/grantsleep.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { cellRoomOfWire, PIXEL_UNITS, GROUND_LAW, GRANT_HELLO_LAW } from '../../src/net/wire.js';
import { openGrantMeasure, grantAsksPastLine, GRANT_MEASURE_SIG_HEADER, GRANT_MEASURE_MS, GRANT_EVIDENCE_GAP_MS, GRANT_RELAY_READER } from '../../src/net/grantMeasure.js';

const { subtle } = globalThis.crypto;
const T = 1_800_000_000;
const at = (px, py, dx = 100) => ({ x: px * PIXEL_UNITS + dx, y: 60, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
const P0 = at(402, 151);
const KEY = cellRoomOfWire(P0.x, P0.z);
/** Every timer the room asks for, and how long - one at least a minute long is never scheduled (a pin that left one
 *  pending would hold the process open), the rest run as they always do. */
const LONG_MS = 60_000;

/** A cell room with the relay's receipt key and the grants' door, `n` players helloed into it at P0 (`extra` laid over each
 *  hello, `env` over the Worker's). */
async function cell(t, n = 1, { env = {}, extra = {} } = {}) {
  let now = T * 1000;
  t.mock.method(Date, 'now', () => now);
  const timers = [];
  const real = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (fn, ms, ...rest) => { timers.push(ms); return ms >= LONG_MS ? { unref() {}, ref() {} } : real(fn, ms, ...rest); });
  const r = fakeRoom(KEY, { now: () => now });
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  r.env.GRANT_FEED_URL = 'https://accounts.example/v1/mod/grant-feed';
  const posts = [];
  r.env.ACCOUNTS = { fetch: async (req) => { posts.push({ sig: req.headers.get(GRANT_MEASURE_SIG_HEADER), body: new Uint8Array(await req.arrayBuffer()) }); return new Response('{}', { status: 202 }); } };
  Object.assign(r.env, env);
  // a post is never awaited by the frame that begins it, so the pins await the room's own flushes - its signing takes a
  // turn of its own, which no count of idle turns is sure to outlast on a loaded machine
  const flushes = [], flush = r.room._grantFlush.bind(r.room);
  r.room._grantFlush = () => { const p = flush(); flushes.push(p); return p; };
  const ws = [];
  for (let i = 0; i < n; i++) { ws.push(r.connect()); await r.hello(ws[i], `peer-000${i + 1}`, P0, { lv: 7, charLevel: 12, ...extra }); }
  const ask = (kind, k, id) => r.raw(ws[0], JSON.stringify({ t: 'grant', k: 'mint', id, kind, n: k }));
  /** Reader `i`'s tally of what its game refused of peer-0001's foes. */
  const tally = (i, r0 = 'marks', id = 900 + i) => r.raw(ws[i], JSON.stringify({ t: 'grant', k: 'tally', id, rows: [{ o: 'peer-0001', r: r0, n: 1 }] }));
  /** The batch posted `i`th, opened by the service's half. */
  const opened = async (i) => { const o = await openGrantMeasure(posts[i].body, posts[i].sig, kp.publicKey, { subtle, nowMs: now }); assert.ok(o.ok, o.error ?? ''); return o.batch; };
  /** The posts the room has made once every post it began has finished. */
  const posted = async () => { await Promise.all(flushes); return posts; };
  return { r, ws, kp, ask, tally, opened, posts, posted, timers, tick: (ms) => { now += ms; }, get now() { return now; } };
}

test('GRANT-SLEEP NO TIMER: a cell that takes a mint, then another past the bucket\'s burst, asks for no timer a minute long or longer - nothing holds it awake past its frames, as it was before world218 (mutants: the ten-minute timer armed at a fold)', async (t) => {
  const c = await cell(t);
  for (let i = 0; i < 8; i++) await c.ask('enc', 2, i);
  c.tick(1000);
  await c.ask('camp', 5, 20);
  assert.equal(c.r.room._grants.w.rows.size, 2, 'both kinds folded into the window');
  assert.deepEqual(c.timers.filter((ms) => ms >= LONG_MS), [], 'no long timer pending: the cell may hibernate between frames');
});

test('GRANT-SLEEP THE WINDOW AT ITS DOOR: a frame before the window\'s first ask has waited GRANT_MEASURE_MS posts nothing; the first frame at it posts the window, signed and whole, from its first ask to that frame - and the next frame, the window empty, posts nothing more (mutants: no tick at a frame; the window posted at any frame; the bound read as past it)', async (t) => {
  const c = await cell(t);
  await c.ask('enc', 2, 1);
  const from = c.now;
  c.tick(GRANT_MEASURE_MS - 1);
  await c.r.ping(c.ws[0]);
  assert.equal((await c.posted()).length, 0, 'not yet due');
  c.tick(1);
  await c.r.ping(c.ws[0]);
  assert.equal((await c.posted()).length, 1, 'due at the first frame at its bound');
  const opened = await openGrantMeasure(c.posts[0].body, c.posts[0].sig, c.kp.publicKey, { subtle, nowMs: c.now });
  assert.ok(opened.ok, JSON.stringify(opened));
  assert.equal(opened.batch.from, from);
  assert.equal(opened.batch.at, c.now);
  assert.deepEqual(opened.batch.rows, [{ a: 'acct-peer-0001', k: 'enc', asks: 1, members: 2, bucket: 0, ceiling: 0 }]);
  c.tick(GRANT_MEASURE_MS);
  await c.r.ping(c.ws[0]);
  assert.equal((await c.posted()).length, 1, 'an empty window posts nothing');
});

test('GRANT-SLEEP THE DRAIN: the last socket\'s close posts the window, whatever its age - the players it measured are gone, and the cell then sleeps with nothing owed; a close that leaves a socket posts nothing; a drained cell that took no ask posts nothing (mutants: the drain unforced; every close forced)', async (t) => {
  const c = await cell(t, 2);
  await c.ask('enc', 1, 1);
  c.tick(1000);
  await c.r.drop(c.ws[1]);
  assert.equal((await c.posted()).length, 0, 'a socket still stands: the window waits');
  await c.r.drop(c.ws[0]);
  assert.equal((await c.posted()).length, 1, 'the drain posts it');
  const opened = await openGrantMeasure(c.posts[0].body, c.posts[0].sig, c.kp.publicKey, { subtle, nowMs: c.now });
  assert.ok(opened.ok, JSON.stringify(opened));
  assert.equal(opened.batch.rows.length, 1);
  assert.equal(c.r.room._grants.w.rows.size, 0, 'nothing owed');
  const quiet = await cell(t);
  await quiet.r.drop(quiet.ws[0]);
  assert.equal((await quiet.posted()).length, 0, 'no ask, no post');
});

test('AUDIT GRANT-SLEEP S1 THE LINE AT ITS DOOR: an account whose asks of a kind cross GRANT-ASKS\' line in a window - the evidence its case reads - has the window posted at the frame that crossed it, long before GRANT_MEASURE_MS; one ask short of the line posts nothing (mutants: the line unread at the fold; the line\'s word unread at the door)', async (t) => {
  const c = await cell(t);
  const atLine = (asks) => grantAsksPastLine({ k: 'giant', asks }, GRANT_MEASURE_MS / 1000) > 0;
  let line = 1;
  while (!atLine(line)) line++;
  for (let i = 1; i < line; i++) { await c.ask('giant', 1, i); c.tick(600); }   // the socket's grant bucket, two a second
  assert.equal((await c.posted()).length, 0, 'short of the line: the window waits');
  await c.ask('giant', 1, line);
  assert.equal((await c.posted()).length, 1, 'posted at the frame that crossed it');
  assert.ok(c.now - T * 1000 < GRANT_MEASURE_MS);
  assert.deepEqual((await c.opened(0)).rows.map((r) => [r.a, r.k, r.asks]), [['acct-peer-0001', 'giant', line]]);
});

test('AUDIT GRANT-SLEEP S2 NO TIMER ON ANY FOLD: a reader\'s tally and the relay\'s own count of a record it stripped ask for no timer a minute long or longer, as a mint does not - and each, a case\'s evidence, posts at its door (mutants: the ten-minute timer armed at a tally; at the relay\'s count)', async (t) => {
  const c = await cell(t, 2, { env: { GRANT_STRIP: 'on' }, extra: { gl: GROUND_LAW, gv: GRANT_HELLO_LAW } });
  await c.tally(1);
  await c.r.raw(c.ws[0], JSON.stringify({ t: 'foes', data: { n: 1, k: KEY, full: 1, f: [{ i: 1, t: 0, f: [1, 2, 3], k: 99_999, h: 99_999 }] } }));
  c.tick(GRANT_EVIDENCE_GAP_MS);
  await c.r.ping(c.ws[1]);
  assert.deepEqual(c.timers.filter((ms) => ms >= LONG_MS), [], 'no long timer pending: the cell may hibernate between frames');
  assert.equal((await c.posted()).length, 2, 'the reader\'s word and the relay\'s count, each at its door');
  assert.deepEqual([(await c.opened(0)).tl.map((x) => x.a), (await c.opened(1)).tl.map((x) => x.a)], [['acct-peer-0002'], [GRANT_RELAY_READER]]);
});

test('AUDIT GRANT-SLEEP S1 THE TALLIES\' GAP: a second reader\'s tally inside GRANT_EVIDENCE_GAP_MS of the cell\'s last evidence post waits for the first door past it - fresh evidence a frame never makes the relay post a frame (mutants: the gap unread; the gap never counted from a post)', async (t) => {
  const c = await cell(t, 3);
  await c.tally(1);
  assert.equal((await c.posted()).length, 1, 'the first reader\'s word at its door');
  c.tick(GRANT_EVIDENCE_GAP_MS - 1);
  await c.tally(2);
  assert.equal((await c.posted()).length, 1, 'the second waits out the gap');
  c.tick(1);
  await c.r.ping(c.ws[0]);
  assert.equal((await c.posted()).length, 2, 'and posts at the first door past it');
  assert.deepEqual((await c.opened(1)).tl.map((x) => x.a), ['acct-peer-0003']);
});

test('GRANT-SLEEP THE CLOSE\'S DOOR: a window due at a close that leaves a socket standing posts at that close - a close is a door as a frame is (mutants: the close unticked)', async (t) => {
  const c = await cell(t, 2);
  await c.ask('enc', 1, 1);
  c.tick(GRANT_MEASURE_MS);
  await c.r.drop(c.ws[1]);
  assert.equal((await c.posted()).length, 1, 'due, and posted at the close');
});
