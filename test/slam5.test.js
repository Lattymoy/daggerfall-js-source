// SLAM5 (2026-09-16, AUDIT SLAM): THE HELLO PATH - A HARD WALL AT 130 PLAYERS, AND A ROSTER RANKED BY THE WRONG
// METRIC. Both found by the lenses over SLAM1-4; neither was SLAM1-4's doing.
//
// THE WALL. `webSocketMessage`'s hello arm read a look for EVERY hello'd socket - up to SOCKETS_MAX-1 = 255 keys in
// one `storage.get(keys)` - only for `rosterFor` to throw all but ROSTER_MAX away. A Durable Object's batched get
// takes at most 128 keys, which this very file already knows: `_sweep` and `alarm` both chunk their deletes at 128.
// So the 130th player made the get THROW, after `_setAttach` had already marked them present and before the welcome
// or the join fan - leaving them connected with an empty roster, no host and no clock, invisible to a room that was
// never told they arrived. An event does not degrade at 130; it stops.
//
// THE METRIC. `rosterFor` ranked by `pixelDistance` - Chebyshev on 32768-unit MAP PIXELS - while the pose fan ranks
// by squared Euclidean in the pose's own frame. Two metrics over one set do not nest, so SLAM1's
// `POSE_FAN_MAX <= ROSTER_MAX` bought nothing. In a place room the poses are SCENE units, so every pixelDistance
// floors to 0 and "the nearest 64" was the first 64 in socket order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rosterFor, ROSTER_MAX, SOCKETS_MAX, POSE_FAN_MAX, nearestFan, validPose } from '../src/net/wire.js';
import { Room } from '../server/src/index.js';
import { readFileSync } from 'node:fs';

/** The Durable Object's real batched-get limit. The runtime enforces it; `test/fakeRoom.mjs` does not, which is
 *  exactly why 7881 green tests never saw the wall. */
const STORAGE_GET_MAX = 128;
const at = (x, z) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv: 0 });

/** A room whose storage enforces the key limit, and which reports the largest batch it was ever asked for. */
function strictRoom(key) {
  const sockets = [], store = new Map();
  let maxKeys = 0;
  const state = {
    getWebSockets: () => sockets.slice(),
    acceptWebSocket: (ws) => sockets.push(ws),
    storage: {
      async get(k) {
        if (!Array.isArray(k)) return store.get(k);
        maxKeys = Math.max(maxKeys, k.length);
        if (k.length > STORAGE_GET_MAX) throw new Error(`get() supports up to ${STORAGE_GET_MAX} keys, got ${k.length}`);
        return new Map(k.filter((x) => store.has(x)).map((x) => [x, store.get(x)]));
      },
      async put(k, v) { if (k && typeof k === 'object') { for (const [kk, vv] of Object.entries(k)) store.set(kk, vv); } else store.set(k, v); },
      async delete(k) { for (const x of Array.isArray(k) ? k : [k]) store.delete(x); },
      async deleteAll() { store.clear(); },
      async list({ prefix = '' } = {}) { return new Map([...store].filter(([kk]) => kk.startsWith(prefix))); },
      async setAlarm() {}, async getAlarm() { return null; }, async deleteAlarm() {},
    },
  };
  const room = new Room(state);
  const connect = () => {
    const ws = { sent: [], closed: null, att: { key, id: null, name: null, pose: null, bucket: null, drops: 0 },
      send(s) { this.sent.push(JSON.parse(s)); },
      close(c, r) { this.closed = { code: c, reason: r }; const i = sockets.indexOf(ws); if (i >= 0) sockets.splice(i, 1); },
      serializeAttachment(a) { this.att = JSON.parse(JSON.stringify(a)); }, deserializeAttachment() { return this.att; } };
    state.acceptWebSocket(ws); return ws;
  };
  return { room, connect, get maxKeys() { return maxKeys; } };
}

test('SLAM5: A FULL ROOM FILLS - two hundred players join a town and every one gets a welcome, against storage that enforces the batched-get limit the runtime enforces (mutant: the pre-SLAM5 get over every socket, which throws at the 130th and leaves them connected but invisible)', async () => {
  const r = strictRoom('town:m9');
  const real = Date.now;
  let t = 1e12;
  Date.now = () => t;   // the Room reads the global clock directly, so the hello gate is spent on OUR clock
  let welcomed = 0, threw = null;
  try {
    for (let i = 0; i < 200; i++) {
      const ws = r.connect();
      try {
        await r.room.webSocketMessage(ws, JSON.stringify({ t: 'hello', id: `p${String(i).padStart(4, '0')}`, secret: `secret-of-${i}`, name: `n${i}`,
          look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: at((i % 20) * 3, Math.floor(i / 20) * 3) }));
        if (!ws.closed && ws.sent.some((m) => m.t === 'welcome')) welcomed++;
      } catch (e) { threw ??= { at: i, msg: e.message }; }
      t += 1000 / 10 + 20;   // the room's own admission rate
    }
  } finally { Date.now = real; }
  assert.equal(threw, null, `the hello path threw at player ${threw?.at}: ${threw?.msg}`);
  assert.equal(welcomed, 200, 'every player was welcomed');
  // and the awake object serves the whole hello path from its own `_looks`, so it asks storage for nothing at all
  assert.equal(r.maxKeys, 0, 'an awake room reads no looks on the hello path - it already heard them');
  // THE ROSTER CARRIES THE LOOKS. Reading nothing is only a win if the answer is still right: a roster of nulls
  // reads as "asked for nothing" too, and draws nobody at all.
});

test('SLAM5: the welcome\'s roster CARRIES each peer\'s look - reading nothing from storage is only a win if the answer is still right (mutant: the cache never consulted, which asks for nothing and answers null for everyone, and draws no peer at all)', async () => {
  const r = strictRoom('town:m9');
  const real = Date.now;
  let t = 1e12;
  Date.now = () => t;
  let welcome = null;
  try {
    for (let i = 0; i < 6; i++) {
      const ws = r.connect();
      await r.room.webSocketMessage(ws, JSON.stringify({ t: 'hello', id: `p${String(i).padStart(4, '0')}`, secret: `secret-of-${i}`, name: `n${i}`,
        look: { race: i % 2 ? 'Redguard' : 'Nord', gender: 'male', faceIndex: i, items: [] }, pose: at(i * 3, 0) }));
      welcome = ws.sent.find((m) => m.t === 'welcome') ?? welcome;
      t += 120;
    }
  } finally { Date.now = real; }
  assert.ok(welcome && welcome.peers.length >= 5, 'the last joiner was told about the rest');
  for (const p of welcome.peers) {
    assert.ok(p.look, `${p.id} arrived with no look - nothing will draw it`);
    assert.ok(p.look.race === 'Nord' || p.look.race === 'Redguard', 'and it is the look that peer said hello with');
    assert.equal(typeof p.look.faceIndex, 'number');
  }
});

test('SLAM5: the batched get is bounded by the ROSTER, not by the room - so it cannot breach the limit however full the room gets (mutant: the get over every socket, which is SOCKETS_MAX-1 keys)', () => {
  assert.ok(ROSTER_MAX <= STORAGE_GET_MAX, `a roster of ${ROSTER_MAX} fits one batched get`);
  assert.ok(SOCKETS_MAX > STORAGE_GET_MAX, 'and a full room does NOT - which is the whole finding');
  const src = readFileSync(new URL('../server/src/index.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  // the selection happens BEFORE the read: `others` (every socket) must not be what is handed to storage
  assert.doesNotMatch(src, /storage\.get\(others\.map/, 'the room is never the batch');
  assert.match(src, /const near = rosterFor\(others, m\.id, m\.pose\);/, 'the roster is chosen first');
  const i = src.indexOf('const near = rosterFor(others');
  assert.match(src.slice(i, i + 400), /near\.filter\(\(b\) => !this\._looks\.has\(b\.id\)\)/, 'and only what is not already known is asked for');
});

test('SLAM5: ONE METRIC at both doors - the roster and the pose fan rank the same way, so the fan\'s reach really is a subset of what the welcome named (mutant: pixelDistance, which floors to 0 inside one town and makes "nearest" mean socket order)', () => {
  // a crowd in a plaza: every one of these is inside a single map pixel, where the old metric was blind
  const peers = Array.from({ length: 200 }, (_, i) => ({ id: `p${String(i).padStart(4, '0')}`, name: 'x', look: null, pose: at((i % 20) * 2, Math.floor(i / 20) * 2) }));
  const me = at(0, 0);
  const roster = rosterFor(peers, 'me', me);
  assert.equal(roster.length, ROSTER_MAX);
  const d2 = (p) => p.pose.x ** 2 + p.pose.z ** 2;
  for (let i = 1; i < roster.length; i++) assert.ok(d2(roster[i - 1]) <= d2(roster[i]), 'the roster really is sorted by distance');
  // the far half of the plaza is NOT in the roster - under pixelDistance it would have been, by socket order
  const farthest = peers[peers.length - 1];
  assert.ok(!roster.some((p) => p.id === farthest.id), 'the far corner of the crowd is not "nearest"');
  // NESTING: what the fan reaches is a subset of what the welcome named, which is what SLAM1 believed and did not have
  const fan = nearestFan(peers, me, (p) => p.pose, POSE_FAN_MAX);
  const named = new Set(roster.map((p) => p.id));
  for (const p of fan) assert.ok(named.has(p.id), `the fan reaches ${p.id}, whom the welcome never named`);
});

test('SLAM5: a roster asked for with no pose to measure from still answers, bounded (mutant: the no-near arm dropped, which is every chat room and every hello that carried no pose)', () => {
  const peers = Array.from({ length: 200 }, (_, i) => ({ id: `p${i}`, name: 'x', look: null, pose: null }));
  const r = rosterFor(peers, 'me', null);
  assert.equal(r.length, ROSTER_MAX);
  assert.equal(rosterFor([], 'me', at(0, 0)).length, 0);
  // and a mixture: the ones that have said where they are outrank the ones that have not
  const mixed = [{ id: 'quiet', name: 'x', look: null, pose: null }, ...Array.from({ length: 80 }, (_, i) => ({ id: `p${i}`, name: 'x', look: null, pose: at(i + 1, 0) }))];
  const got = rosterFor(mixed, 'me', at(0, 0));
  assert.ok(!got.some((p) => p.id === 'quiet'), 'a peer that has never said where it is cannot be near');
});

test('PINS (AUDIT SLAM S7): the welcome\'s roster CARRIES EACH PEER\'S POSE - the joiner stands the room where it is, not at the origin (mutant: `{ id, name, look }` built from the ranked entry, which drops the pose and survived the whole suite)', async () => {
  const r = strictRoom('town:m9');
  const real = Date.now; let t = 1e12; Date.now = () => t;
  const hello = async (id, pose) => { const ws = r.connect(); await r.room.webSocketMessage(ws, JSON.stringify({ t: 'hello', id, secret: `secret-of-${id}`, name: `n-${id}`, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose })); t += 200; return ws; };
  try {
    await hello('aaaa-0001', at(3, 4)); await hello('bbbb-0002', at(5, 6));
    const c = await hello('cccc-0003', at(7, 8));
    const welcome = c.sent.find((m) => m.t === 'welcome');
    const byId = Object.fromEntries(welcome.peers.map((p) => [p.id, p]));
    assert.deepEqual(byId['aaaa-0001'].pose, validPose(at(3, 4)), 'the first peer where it said it stood');
    assert.deepEqual(byId['bbbb-0002'].pose, validPose(at(5, 6)), 'and the second');
    assert.ok(welcome.peers.every((p) => p.look !== undefined && p.name), 'beside the look and the name the roster always carried');
  } finally { Date.now = real; }
});
