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
import { cellRoomOfWire, PIXEL_UNITS } from '../../src/net/wire.js';
import { openGrantMeasure, GRANT_MEASURE_SIG_HEADER, GRANT_MEASURE_MS } from '../../src/net/grantMeasure.js';

const { subtle } = globalThis.crypto;
const T = 1_800_000_000;
const at = (px, py, dx = 100) => ({ x: px * PIXEL_UNITS + dx, y: 60, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
const P0 = at(402, 151);
const KEY = cellRoomOfWire(P0.x, P0.z);
/** Every timer the room asks for, and how long - one at least a minute long is never scheduled (a pin that left one
 *  pending would hold the process open), the rest run as they always do. */
const LONG_MS = 60_000;

/** A cell room with the relay's receipt key and the grants' door, `n` players helloed into it at P0. */
async function cell(t, n = 1) {
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
  // a post is never awaited by the frame that begins it, so the pins await the room's own flushes - its signing takes a
  // turn of its own, which no count of idle turns is sure to outlast on a loaded machine
  const flushes = [], flush = r.room._grantFlush.bind(r.room);
  r.room._grantFlush = () => { const p = flush(); flushes.push(p); return p; };
  const ws = [];
  for (let i = 0; i < n; i++) { ws.push(r.connect()); await r.hello(ws[i], `peer-000${i + 1}`, P0, { lv: 7, charLevel: 12 }); }
  const ask = (kind, k, id) => r.raw(ws[0], JSON.stringify({ t: 'grant', k: 'mint', id, kind, n: k }));
  /** The posts the room has made once every post it began has finished. */
  const posted = async () => { await Promise.all(flushes); return posts; };
  return { r, ws, kp, ask, posts, posted, timers, tick: (ms) => { now += ms; }, get now() { return now; } };
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
