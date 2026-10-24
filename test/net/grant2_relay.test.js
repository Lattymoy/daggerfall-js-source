// GRANT2 (2026-10-18, Mac: "Lets build the plan"; bible/11-Multiplayer/Spawn-Grants.md section 12): THE RELAY TAKES
// THE ASKS AND MEASURES - a cell's `grant` frame over a real Room (test/fakeRoom.mjs): the grant minted, signed and made
// out to its asker as the relay reads it; the welcome's mode; the gate counted while measuring and said only while
// enforcing; the window posted to the service, signed, and read back by the service's own half.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../fakeRoom.mjs';
import { cellRoomOfWire, mapPixelOfWire, PIXEL_UNITS, sharedClassicMinutes, parseClient } from '../../src/net/wire.js';
import { validGrant, verifyGrant, grantMarks, validGrantOut, validGrantAsk, grantModeOf, relaySupportsGrant, grantBucketIdle,
  GRANT_TTL_MS, GRANT_KINDS, GRANT_MODES, GRANT_RELAY_MIN, GRANT_CFG_TTL_MS } from '../../src/net/grantLaw.js';
import { openGrantMeasure, GRANT_MEASURE_SIG_HEADER, GRANT_MEASURE_MS } from '../../src/net/grantMeasure.js';
import { RELAY_CFG_KEYS } from '../../src/net/relayCfg.js';

const { subtle } = globalThis.crypto;
const T = 1_800_000_000;
const at = (px, py, dx = 100) => ({ x: px * PIXEL_UNITS + dx, y: 60, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
const P0 = at(402, 151);
const KEY = cellRoomOfWire(P0.x, P0.z);

/** A cell room with the relay's receipt key, one player helloed into it at P0. */
async function cell(t, { mode, feed } = {}) {
  let now = T * 1000;
  t.mock.method(Date, 'now', () => now);
  const r = fakeRoom(KEY, { now: () => now });
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  if (mode) r.env.GRANT_MODE = mode;
  const posts = [];
  if (feed) {
    r.env.GRANT_FEED_URL = 'https://accounts.example/v1/mod/grant-feed';
    r.env.ACCOUNTS = { fetch: async (req) => { posts.push({ url: req.url, sig: req.headers.get(GRANT_MEASURE_SIG_HEADER), body: new Uint8Array(await req.arrayBuffer()) }); return new Response('{}', { status: 202 }); } };
  }
  t.after(() => r.room._grantFlush());   // the window's timer cleared, pass or fail, as a test of the chat feed flushes its own
  const ws = r.connect();
  await r.hello(ws, 'peer-0001', P0, { lv: 7, charLevel: 12 });
  const ask = (kind, n, id = 1) => r.raw(ws, JSON.stringify({ t: 'grant', k: 'mint', id, kind, n }));
  const answers = () => ws.sent.filter((m) => m.t === 'grant');
  return { r, ws, kp, ask, answers, posts, tick: (ms) => { now += ms; }, get now() { return now; } };
}

test('GRANT2 THE ASK\'S LAW: a mint of a kind and a size within its most, an id that names its answer; the answer read whole - a grant, a refusal of the law\'s words, or off; the mode a setting names, measure unless off or enforce; the relay that takes it world218 or later; the setting `grantMode` (mutants: the kind\'s most ignored; an unknown setting read as enforce)', () => {
  assert.deepEqual(validGrantAsk({ k: 'mint', id: 9, kind: 'enc', n: 4 }), { k: 'mint', id: 9, kind: 'enc', n: 4 });
  for (const bad of [{ k: 'mint', id: 9, kind: 'enc', n: 5 }, { k: 'mint', id: 9, kind: 'camp', n: 9 }, { k: 'mint', id: 9, kind: 'raid', n: 1 }, { k: 'mint', id: -1, kind: 'enc', n: 1 },
    { k: 'renew', id: 1, kind: 'enc', n: 1 }, { k: 'mint', id: 1, kind: 'constructor', n: 1 }, null]) assert.equal(validGrantAsk(bad), null, JSON.stringify(bad));
  assert.deepEqual(validGrantOut({ k: 'off', id: 3 }), { k: 'off', id: 3 });
  assert.deepEqual(validGrantOut({ k: 'no', id: 3, r: 'bucket' }), { k: 'no', id: 3, r: 'bucket' });
  assert.equal(validGrantOut({ k: 'no', id: 3, r: 'because' }), null, 'a refusal in the law\'s words alone');
  assert.equal(validGrantOut({ k: 'ok', id: 3, gr: { g: 1 } }), null, 'a grant read whole or not at all');
  assert.deepEqual(GRANT_MODES, ['off', 'measure', 'enforce']);
  assert.deepEqual(['off', 'enforce', 'measure', undefined, '', 'Enforce', 'on'].map(grantModeOf), ['off', 'enforce', 'measure', 'measure', 'measure', 'measure', 'measure']);
  assert.equal(GRANT_RELAY_MIN, 218);
  assert.deepEqual(['world217', 'world218', 'world300', 'nope', undefined].map(relaySupportsGrant), [false, true, true, false, false]);
  assert.ok(RELAY_CFG_KEYS.includes('grantMode'));
  assert.equal(GRANT_CFG_TTL_MS, 300_000);
  assert.deepEqual(parseClient('{"t":"grant","k":"mint","id":1,"kind":"enc","n":2}', { hasHello: true }), { t: 'grant', k: 'mint', id: 1, kind: 'enc', n: 2 });
  assert.deepEqual(parseClient('{"t":"grant","k":"mint","id":1,"kind":"enc","n":2}'), { error: 'grant before hello' });
  assert.equal(grantBucketIdle('enc', undefined, 0), true, 'no bucket is a full one');
  assert.equal(grantBucketIdle('enc', { tokens: 0, at: 0 }, 359_999), false);
  assert.equal(grantBucketIdle('enc', { tokens: 0, at: 0 }, 360_000), true, 'six asks\' refill at one a minute');
});

test('GRANT2 THE MINT: a cell\'s welcome says `measure`; an ask is answered with a grant made out to its socket, its cell, its account, the pixel its pose stands in, the world minute, its signed level and Renown, the marks its seed rolls, ten minutes\' life - signed with the relay\'s key; a halo\'s pose is told `cell`; a bad ask and a channel\'s are junk (mutants: the pose\'s cell unchecked; the Renown not the token\'s; the grant unsigned)', async (t) => {
  const c = await cell(t);
  const welcome = c.ws.sent.find((m) => m.t === 'welcome');
  assert.equal(welcome.gm, 'measure', 'the law measures from its deploy');
  await c.ask('enc', 3, 41);
  const [a] = c.answers();
  const out = validGrantOut(a);
  assert.ok(out && out.k === 'ok' && out.id === 41, JSON.stringify(a));
  const g = out.gr;
  assert.deepEqual([g.o, g.q, g.a, g.k, g.n, g.l, g.r], ['peer-0001', KEY, 'acct-peer-0001', 'enc', 3, 12, 7]);
  assert.deepEqual(g.p, mapPixelOfWire(P0.x, P0.z));
  assert.equal(g.m, Math.floor(sharedClassicMinutes(c.now)));
  assert.equal(g.x, c.now + GRANT_TTL_MS);
  assert.deepEqual({ e: g.e, c: g.c }, grantMarks(g.s, 3, 7), 'the marks are the seed\'s');
  assert.equal(await verifyGrant(g, c.kp.publicKey, { subtle }), true, 'signed with the relay\'s receipt key');
  await c.ask('enc', 2, 42);
  assert.equal(c.answers()[1].gr.g, g.g + 1, 'the cell\'s own counter');
  assert.notEqual(c.answers()[1].gr.s, g.s, 'each its own seed');
  // a halo's pose (the next cell east - a cell is sixteen pixels): the owner's own cell mints
  assert.notEqual(cellRoomOfWire(at(418, 151).x, at(418, 151).z), KEY);
  await c.r.pose(c.ws, at(418, 151));
  await c.ask('enc', 1, 43);
  assert.deepEqual(c.answers()[2], { t: 'grant', k: 'no', id: 43, r: 'cell' });
  await c.r.pose(c.ws, P0);
  // junk: a bad ask
  const before = c.answers().length;
  await c.ask('enc', 5, 44);
  await c.ask('raid', 1, 45);
  assert.equal(c.answers().length, before, 'nothing said to a bad ask');
  assert.equal(c.ws.meters.junk, 2);
  // a channel is no cell
  const ch = fakeRoom('chat:world');
  const cws = ch.connect();
  await ch.hello(cws, 'peer-0002', null);
  await ch.raw(cws, JSON.stringify({ t: 'grant', k: 'mint', id: 1, kind: 'enc', n: 1 }));
  assert.equal(cws.sent.filter((m) => m.t === 'grant').length, 0);
  assert.equal(cws.sent.find((m) => m.t === 'welcome')?.gm, undefined, 'and its welcome says no mode');
});

test('GRANT2 THE GATE MEASURED, AND ENFORCED ONLY WHEN SET: measuring, the seventh encounter in a minute is granted all the same; enforcing, it is refused `bucket` and the next minute\'s is granted; off, every ask is answered `off` (mutants: a refusal said while measuring; the bucket not kept while measuring)', async (t) => {
  const m = await cell(t);
  for (let i = 0; i < GRANT_KINDS.enc.cap + 1; i++) await m.ask('enc', 1, i);
  assert.equal(m.answers().filter((a) => a.k === 'ok').length, GRANT_KINDS.enc.cap + 1, 'measuring: every ask granted');
  const e = await cell(t, { mode: 'enforce' });
  assert.equal(e.ws.sent.find((x) => x.t === 'welcome').gm, 'enforce');
  for (let i = 0; i < GRANT_KINDS.enc.cap + 1; i++) await e.ask('enc', 1, i);
  assert.deepEqual(e.answers().map((a) => a.k), [...Array(GRANT_KINDS.enc.cap).fill('ok'), 'no']);
  assert.equal(e.answers().at(-1).r, 'bucket');
  e.tick(60_000);
  await e.ask('enc', 1, 99);
  assert.equal(e.answers().at(-1).k, 'ok', 'one ask a minute');
  await e.ask('camp', 8, 100);
  assert.equal(e.answers().at(-1).k, 'ok', 'a camp\'s bucket is its own');
  const o = await cell(t, { mode: 'off' });
  assert.equal(o.ws.sent.find((x) => x.t === 'welcome').gm, 'off');
  await o.ask('enc', 1, 7);
  assert.deepEqual(o.answers(), [{ t: 'grant', k: 'off', id: 7 }]);
});

test('GRANT2 THE MEASURE POSTED: the window\'s asks per account and kind, the members, what the bucket would have refused, the most live - signed with the relay\'s key and read back by the service\'s own half; posted once its first ask has waited ten minutes; nothing posts without the door set (mutants: the bucket\'s refusal not counted; the window not begun again)', async (t) => {
  const c = await cell(t, { feed: true });
  for (let i = 0; i < 8; i++) await c.ask('enc', 2, i);
  c.tick(1000);   // the socket's own burst (GRANT_BURST_MAX) spent
  await c.ask('camp', 5, 20);
  assert.equal(c.posts.length, 0, 'nothing yet');
  c.tick(GRANT_MEASURE_MS);
  assert.equal(await c.r.room._grantFlush(), true);
  assert.equal(c.posts.length, 1);
  assert.equal(c.posts[0].url, 'https://accounts.example/v1/mod/grant-feed');
  const opened = await openGrantMeasure(c.posts[0].body, c.posts[0].sig, c.kp.publicKey, { subtle, nowMs: c.now });
  assert.ok(opened.ok, JSON.stringify(opened));
  const b = opened.batch;
  assert.equal(b.q, KEY);
  assert.equal(b.live, 16 + 5, 'every grant still live');
  assert.deepEqual(b.rows, [
    { a: 'acct-peer-0001', k: 'enc', asks: 8, members: 16, bucket: 2, ceiling: 0 },
    { a: 'acct-peer-0001', k: 'camp', asks: 1, members: 5, bucket: 0, ceiling: 0 },
  ]);
  assert.equal(await c.r.room._grantFlush(), false, 'a new window, empty');
  const quiet = await cell(t);
  await quiet.ask('enc', 1, 1);
  assert.equal(await quiet.r.room._grantFlush(), false, 'no door, no post');
});
