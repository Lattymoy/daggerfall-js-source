// SCALE5d (2026-10-11, Mac's decision 3 - a full city overflows into a layer rather than refusing `room full`; then
// "I wanna do every single slice"; bible/11-Multiplayer/Scale-Arc.md SCALE5d): A CROWDED PLACE OVERFLOWS INTO LAYERS.
// The law (net/wire.js isLayered, layerOf, layerName), the Worker's walk (server/src/relayScale.js layerWalk), the room's
// word of its layer, the session's ask and its welcome, the party's layer on its pose, and the host's wiring.
// tools/mutants/scale5d.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRoom } from '../fakeRoom.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { OnlineSession } from '../../src/net/online.js';
import { LAYERS_MAX, LAYER_HEADER, LAYER_FULL_HEADER, isLayered, layerOf, layerName, validPartyPose, SOCKETS_MAX, SOCIAL_ROOM, chatRegionRoom } from '../../src/net/wire.js';
import { layerWalk } from '../../server/src/relayScale.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };

test('SCALE5d the law: an open-world cell, a building and a dungeon layer - nothing else (a channel, a fight, a town); a layer is 1 to LAYERS_MAX - 1 on the wire, the place itself 0; a layer\'s object is `key#n` (mutants: a channel layered; an event room layered; a layer past the last; a leading zero read; the place\'s own object renamed)', () => {
  assert.equal(LAYERS_MAX, 8);
  assert.equal(SOCKETS_MAX, 256, 'a layer holds what a room held - SCALE5d measured a full cell at 37.5 MB/s out of one object on the second wire, so no room grows');
  for (const k of ['world:12,34', 'world:-3,7', 'interior:m206728581.131590', 'dungeon:m1234.s']) assert.equal(isLayered(k), true, k);
  for (const k of [SOCIAL_ROOM, 'chat:world.3', chatRegionRoom(4), 'gate:5', 'sd:3', 'arena:hall', 'siege:1:2', 'town:m8', 'caravan:x', null]) assert.equal(isLayered(k), false, String(k));
  for (const [v, n] of [['1', 1], ['7', 7], [7, 7], ['0', 0], ['8', 0], ['01', 0], ['x', 0], [null, 0], ['', 0], ['1.5', 0], ['-1', 0]]) assert.equal(layerOf(v), n, `${v}`);
  assert.equal(layerName('world:1,2', 0), 'world:1,2', 'the place itself is the object it always was');
  assert.equal(layerName('world:1,2', 3), 'world:1,2#3');
  assert.equal(LAYER_HEADER, 'x-df-layer'); assert.equal(LAYER_FULL_HEADER, 'x-df-full');
});

test('SCALE5d the Worker\'s walk: the asked layer first, then each after it, round to LAYERS_MAX; only a full room\'s refusal walks on, any other answer is the answer; every object hears its layer, whatever the page sent; every layer full is `room full` (mutants: the walk stops at the place; a full room not said full; the header the page\'s; no wrap; another refusal walked past)', async () => {
  const asked = [];
  const make = (full) => ({
    idFromName: (n) => n,
    get: (n) => ({ fetch: async (req) => { asked.push([n, req.headers.get(LAYER_HEADER)]); if (full.has(n)) { const r = new Response('{"error":"room full"}', { status: 503 }); r.headers.set(LAYER_FULL_HEADER, '1'); return r; } return new Response(`ok ${n}`, { status: 200 }); } }),
  });
  const req = () => new Request('https://relay.test/room/world:1,2?ly=9', { headers: { Upgrade: 'websocket', [LAYER_HEADER]: '6' } });
  let res = await layerWalk(make(new Set(['world:1,2', 'world:1,2#1'])), 'world:1,2', req(), 0);
  assert.equal(await res.text(), 'ok world:1,2#2', 'past the two full ones to the first with room');
  assert.deepEqual(asked, [['world:1,2', '0'], ['world:1,2#1', '1'], ['world:1,2#2', '2']], 'each told its own layer - never the page\'s');
  asked.length = 0;
  res = await layerWalk(make(new Set(['world:1,2#6', 'world:1,2#7'])), 'world:1,2', req(), 6);
  assert.equal(await res.text(), 'ok world:1,2', 'round past the last to the place itself');
  asked.length = 0;
  res = await layerWalk(make(new Set()), 'world:1,2', req(), 3);
  assert.equal(await res.text(), 'ok world:1,2#3', 'the asked layer first - a party\'s');
  const all = new Set(Array.from({ length: LAYERS_MAX }, (_, ly) => layerName('world:1,2', ly)));
  asked.length = 0;
  res = await layerWalk(make(all), 'world:1,2', req(), 0);
  assert.equal(res.status, 503); assert.equal(asked.length, LAYERS_MAX, 'every layer asked once');
  const other = { idFromName: (n) => n, get: () => ({ fetch: async () => { asked.push('x'); return new Response('{"error":"busy"}', { status: 503 }); } }) };
  asked.length = 0;
  res = await layerWalk(other, 'world:1,2', req(), 0);
  assert.equal(asked.length, 1, 'a refusal that is not a full room is answered as it was');
  const w = src('server/src/index.js');
  assert.match(w, /if \(isLayered\(key\)\) return layerWalk\(env\.ROOMS, key, request, layerOf\(url\.searchParams\.get\('ly'\)\)\);/);
});

test('SCALE5d the room: a full room\'s refusal says it is full; an object hears its layer from the Worker and keeps it on each socket, a room that does not layer never; its welcome says it (mutants: the full word unsaid; the header unread; a channel given a layer; the welcome silent)', async () => {
  const hadPair = globalThis.WebSocketPair;
  let held = null;
  globalThis.WebSocketPair = class { constructor() { this[0] = {}; this[1] = { serializeAttachment(a) { held = a; } }; } };
  const realNow = Date.now; const now = realNow(); Date.now = () => now;
  try {
    await quiet(async () => {
      const upgrade = (p, ly) => new Request(`https://relay.test${p}`, { headers: { Upgrade: 'websocket', ...(ly != null ? { [LAYER_HEADER]: String(ly) } : {}) } });
      const full = fakeRoom('world:5,5');
      for (let i = 0; i < SOCKETS_MAX; i++) { const ws = full.connect(); ws.att.at = now - 1; }
      const r = await full.room.fetch(upgrade('/room/world:5,5', 0));
      assert.equal(r.status, 503);
      assert.equal(r.headers.get(LAYER_FULL_HEADER), '1', 'said full - the Worker walks on');
      const open = (key, ly) => { held = null; const R = fakeRoom(key); return R.room.fetch(upgrade(`/room/${key}`, ly)).catch(() => null).then(() => held); };   // Node will not build a 101; the socket's attachment is what is read
      assert.equal((await open('world:5,5', 3))?.ly, 3, 'a layer\'s socket carries it');
      assert.equal((await open('interior:m206728581.131590', 2))?.ly, 2);
      assert.equal((await open('world:5,5', 0))?.ly, undefined, 'the place itself carries none');
      assert.equal((await open('world:5,5', 9))?.ly, undefined, 'a layer past the last is the place itself');
      assert.equal((await open('town:m8', 3))?.ly, undefined, 'a room that does not layer never');
    });
  } finally { globalThis.WebSocketPair = hadPair; Date.now = realNow; }
  await quiet(async () => {
    const R = fakeRoom('world:5,5');
    const ws = R.connect();
    ws.att.ly = 4;
    await R.hello(ws, 'peer-0001', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0, ts: 0 });
    assert.equal(ws.sent[0].t, 'welcome');
    assert.equal(ws.sent[0].ly, 4, 'the welcome says which layer of the place this is');
    const base = R.connect();
    await R.hello(base, 'peer-0002', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0, ts: 0 });
    assert.equal(base.sent[0].ly, undefined, 'and the place itself says none');
  });
});

test('SCALE5d the session: a join asks for its party\'s layer, a reconnect for its own; the welcome says the layer it holds, a halo\'s kept with it and carried by a crossing that promotes it; a room that does not layer is never asked one; the party pose carries it (mutants: the hint unasked; the reconnect asking the hint; the welcome unread; a halo\'s layer lost at a crossing; a channel asked a layer; the pose\'s layer dropped)', async () => {
  await quiet(() => {
    const { FakeWS, sockets } = fakeSocketClass();
    let t = 1_000_000;
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => t, rand: () => 0, presence: true });
    s.layerHint = 3;
    s.join('world:10,10', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0, ts: 0 });
    assert.match(sockets[0].url, /\/room\/world:10,10\?ly=3$/, 'my party\'s layer asked first');
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null, now: t, v: 'world192', ly: 5 });
    assert.equal(s.layer, 5, 'the layer the Worker found');
    s.layerHint = 0;
    sockets[0].drop(1006);
    t += 5000; s.tick();
    assert.match(sockets.at(-1).url, /\/room\/world:10,10\?ly=5$/, 'a reconnect asks for its own layer again');
    sockets.at(-1).open();
    sockets.at(-1).receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null, now: t, v: 'world192' });
    assert.equal(s.layer, 0, 'a welcome that says none is the place itself');
    // a halo's layer is kept with it, and a crossing carries it
    s.setHalo(['world:11,10']);
    const halo = sockets.at(-1);
    assert.match(halo.url, /\/room\/world:11,10$/, 'a halo asks for the place itself - the Worker walks on past a full one');
    halo.open();
    halo.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: null, world: null, now: t, v: 'world192', ly: 2 });
    s.join('world:11,10', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0, ts: 0 });
    assert.equal(s.room, 'world:11,10');
    assert.equal(s.layer, 2, 'the promoted halo\'s layer is mine now');
    // a channel is never asked one
    const { FakeWS: F2, sockets: s2 } = fakeSocketClass();
    const link = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: F2, now: () => t, rand: () => 0, presence: false });
    link.layerHint = 3;
    link.join(SOCIAL_ROOM);
    assert.doesNotMatch(s2[0].url, /\?ly=/);
  });
  const pose = { px: 100, py: 100, h: 1, hm: 1, f: 1, fm: 1, m: 1, mm: 1 };
  assert.equal(validPartyPose({ ...pose, ly: 3 }).ly, 3);
  for (const ly of [0, 8, '2', 1.5, -1]) assert.equal(validPartyPose({ ...pose, ly }).ly, undefined, String(ly));
  const w = src('src/scenes/world.js');
  assert.match(w, /online\.layerHint = partyLayerAt\(key\); online\.join\(key, \{ \.\.\.pose, \.\.\.arm \}\);/, 'the host asks for its party\'s layer before a join');
  assert.match(w, /\.\.\.\(online\?\.layer \? \{ ly: online\.layer \} : \{\}\),/, 'and says its own on its party pose');
  assert.match(w, /const mate = party\.members\.find\(\(m\) => m\.acct === party\.leader && near\(m\)\) \?\? party\.members\.find\(near\);/, 'the leader\'s layer first');
});
