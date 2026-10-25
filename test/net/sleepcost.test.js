// GRANT-SLEEP and PROVINCE-SLEEP (2026-10-25, Mac: "ensuring this new integration doesnt implode the server or insanely
// skyrocket our server cost"; bible/11-Multiplayer/Spawn-Grants.md section 22, bible/11-Multiplayer/Scale-Arc.md
// PROVINCE-SLEEP): what keeps a Durable Object awake is billed, so the two things the live relay showed holding rooms
// awake are gone from the land past the Bay before it opens - a cell's grant measure holds no timer, and a province's
// channel is one object that sleeps between its lines. tools/mutants/sleepcost.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import { cellRoomOfWire, PIXEL_UNITS, chatRegionRoom, CHAT_BAY_REGIONS, CHAT_REGION_COUNT, isChatRoom } from '../../src/net/wire.js';
import { openGrantMeasure, GRANT_MEASURE_SIG_HEADER, GRANT_MEASURE_MS, grantMeasureDue, newGrantMeasure, foldGrantAsk } from '../../src/net/grantMeasure.js';
import * as H from '../../src/net/hubShards.js';

const { subtle } = globalThis.crypto;
const T = 1_800_000_000;
const at = (px, py) => ({ x: px * PIXEL_UNITS + 100, y: 60, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
const P0 = at(402, 151);
const KEY = cellRoomOfWire(P0.x, P0.z);
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
/** Every timer of a minute or more armed while the pin runs - recorded, never scheduled (a pending one is what keeps an
 *  object from hibernating). */
function longTimers(t) {
  const real = globalThis.setTimeout, armed = [];
  globalThis.setTimeout = /** @type {any} */ ((fn, ms, ...rest) => { if (ms >= 60_000) { armed.push(ms); return { long: ms }; } return real(fn, ms, ...rest); });
  t.after(() => { globalThis.setTimeout = real; });
  return armed;
}
/** The posts a `void`ed flush owes, let land. */
const landed = async (posts, n) => { for (let i = 0; i < 200 && posts.length < n; i++) await new Promise((r) => setImmediate(r)); };

/** A cell room with the relay's receipt key and the measure's door, one player helloed into it at P0. */
async function cell(t) {
  let now = T * 1000;
  t.mock.method(Date, 'now', () => now);
  const r = fakeRoom(KEY, { now: () => now });
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  r.env.GRANT_FEED_URL = 'https://accounts.example/v1/mod/grant-feed';
  const posts = [];
  r.env.ACCOUNTS = { fetch: async (req) => { posts.push({ sig: req.headers.get(GRANT_MEASURE_SIG_HEADER), body: new Uint8Array(await req.arrayBuffer()) }); return new Response('{}', { status: 202 }); } };
  const ws = r.connect();
  await r.hello(ws, 'peer-0001', P0, { lv: 7, charLevel: 12 });
  const ask = (kind, n, id) => r.raw(ws, JSON.stringify({ t: 'grant', k: 'mint', id, kind, n }));
  const rows = async (i) => { const o = await openGrantMeasure(posts[i].body, posts[i].sig, kp.publicKey, { subtle, nowMs: now }); assert.ok(o.ok, JSON.stringify(o)); return o.batch.rows.map((x) => [x.k, x.asks]); };
  return { r, ws, ask, posts, rows, tick: (ms) => { now += ms; } };
}

test('GRANT-SLEEP the law: a window is owed its post once it holds anything and is GRANT_MEASURE_MS old, never sooner, never empty (mutants: never due; due at once)', () => {
  const w = newGrantMeasure(1000);
  assert.equal(grantMeasureDue(w, 1000 + GRANT_MEASURE_MS), false, 'an empty window owes nothing');
  foldGrantAsk(w, 'acct-a', 'enc', 2, null, 2);
  assert.deepEqual([grantMeasureDue(w, 1000), grantMeasureDue(w, 1000 + GRANT_MEASURE_MS - 1), grantMeasureDue(w, 1000 + GRANT_MEASURE_MS)], [false, false, true]);
  assert.equal(GRANT_MEASURE_MS, 600_000);
});

test('GRANT-SLEEP the cell: an ask arms no timer; the first fold once the window is ten minutes old posts it, the one before posts nothing; the last socket leaving posts what is left; a cell with nothing measured posts nothing (mutants: the timer back; never due; the drain silent)', async (t) => {
  const armed = longTimers(t);
  const c = await cell(t);
  await c.ask('enc', 2, 1);
  assert.deepEqual(armed, [], 'nothing pending - the cell may hibernate');
  c.tick(GRANT_MEASURE_MS - 1);
  await c.ask('enc', 1, 2);
  await landed(c.posts, 1);
  assert.equal(c.posts.length, 0, 'not yet owed');
  c.tick(1);
  await c.ask('enc', 1, 3);
  await landed(c.posts, 1);
  assert.equal(c.posts.length, 1, 'owed, and posted by the fold that found it so');
  assert.deepEqual(await c.rows(0), [['enc', 3]]);
  await c.ask('camp', 5, 4);
  await landed(c.posts, 2);
  assert.equal(c.posts.length, 1, 'a new window, not yet owed');
  await c.r.drop(c.ws);
  await landed(c.posts, 2);
  assert.equal(c.posts.length, 2, 'the drained cell posts its window before it sleeps');
  assert.deepEqual(await c.rows(1), [['camp', 1]]);
  assert.deepEqual(armed, [], 'and never a timer');
  const idle = await cell(t);
  await idle.r.drop(idle.ws);
  await landed(idle.posts, 1);
  assert.equal(idle.posts.length, 0, 'nothing measured, nothing sent');
  assert.doesNotMatch(src('server/src/index.js'), /setTimeout\([^;]*_grantFlush/, 'no timer posts the window');
});

test('PROVINCE-SLEEP the law: the Bay\'s 62 regions are split four ways, a province past the Bay is one channel - no shard key, none a chat room, no account sent to one (mutants: every region split; the split read off the channels; a province\'s shard)', () => {
  assert.equal(H.REGION_SPLIT, CHAT_BAY_REGIONS, 'pinned equal (wire.js imports hubShards.js)');
  assert.equal(H.REGION_SHARD_ROOMS.length, CHAT_BAY_REGIONS * H.REGION_SHARDS);
  for (let r = 0; r < CHAT_REGION_COUNT; r++) {
    const bus = chatRegionRoom(r), split = r < CHAT_BAY_REGIONS;
    assert.equal(H.isRegionBus(bus), true, `region ${r}'s channel`);
    assert.equal(isChatRoom(bus), true);
    for (let k = 0; k < H.REGION_SHARDS; k++) {
      assert.equal(H.isRegionShard(`${bus}.${k}`), split, `${bus}.${k}`);
      assert.equal(isChatRoom(`${bus}.${k}`), split, `${bus}.${k} a room`);
      assert.equal(H.regionShardRoom(r, k), split ? `${bus}.${k}` : null);
    }
    assert.equal(H.shardOf(bus, 'acct-x'), split ? `${bus}.${H.shardHash('acct-x') % H.REGION_SHARDS}` : null, `region ${r}: ${split ? 'its shard' : 'the channel itself'}`);
  }
});

test('PROVINCE-SLEEP the relay: a current build\'s link to a province\'s channel is held by the channel - no hop, no shard made, no ShardSocket - and its line reaches the province\'s other link; a Bay region\'s link is still sent to its shard (mutants: every region split; a province\'s shard)', async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const W = fakeRooms({ now: () => clock });
      const link = async (n, key) => { const R = W.room(key); const ws = R.connect(); clock += 30; await R.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, hs: 1 }); return ws; };
      const SKYRIM = chatRegionRoom(64);
      const a = await link('ska', SKYRIM), b = await link('skb', SKYRIM);
      for (const ws of [a, b]) assert.equal(ws.sent[0].t, 'welcome', 'held, never hopped');
      assert.deepEqual([...W.made.keys()].filter((k) => k.startsWith(`${SKYRIM}.`)), [], 'no shard of it made');
      const bus = W.room(SKYRIM).room;
      assert.equal(bus._vsocks.size, 0, 'no ShardSocket - its own sockets');
      b.sent.length = 0;
      await W.room(SKYRIM).raw(a, JSON.stringify({ t: 'chat', text: 'hail, Skyrim' }));
      assert.deepEqual(b.sent.filter((f) => f.t === 'chat').map((f) => f.text), ['hail, Skyrim']);
      const DAGGERFALL = chatRegionRoom(17);
      const d = await link('dag', DAGGERFALL);
      assert.deepEqual(d.sent, [{ t: 'hub', key: H.shardOf(DAGGERFALL, 'acct-dag') }], 'a Bay region\'s link to its shard');
      for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._feedQ?.timer); }
    });
  } finally { Date.now = realNow; }
});
