// WORLD1 (Mac, 2026-09-12: "So now that this is situated its now
// important that we bring the world in line for anyone online.
// Currently theres a lot disconnected like enemies, doors, etc. The
// world is the server and every player should inhabit that world while
// also being able to continue their progress ... True persistance").
// SLICE 1: THE ROOM'S MEMORY. A world room (a dungeon, today) keeps a
// snapshot of its world in the relay's own storage - the layout's foes
// and how they stand, the piles, the dropped loot, the actions and door
// locks - published by the room's HOST (the hello'd socket in the room
// longest, the relay's word in the welcome and in a host frame) and
// handed to a joiner in the welcome, so a dungeon one player cleared is
// cleared for the next and stays so through an empty room. THE ARM
// EXECUTES: the wire's world frame (after hello, an object, the one
// frame past MAX_FRAME_BYTES, capped at WORLD_FRAME_MAX) and the world
// rooms; the Room over fake sockets and a fake state (the host elected
// and re-elected on a leave with a host frame; the welcome carrying the
// host and the raw world; a host's world stored chunked with its meta,
// re-published smaller with no stale tail, served verbatim; a non-host's
// or a sooner-than-WORLD_MIN_MS frame ignored, a place with no memory
// keeping none; the sweeps - the empty hello, the drain - forgetting
// looks, secrets and the hello bucket and never the world); the session
// (the host in the welcome and the host frame, isHost, onHost, onWorld,
// sendWorld the host's alone and never past the cap, the host forgotten
// on leave); the dungeon host, the mode machine and the world host by
// source (the layout's foes alone and the quest owner's left standing,
// the leave hook before the teardown, the publish clock and the four
// farewells).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseClient, isWorldRoom, isChatRoom, WORLD_FRAME_MAX, WORLD_MIN_MS, WORLD_CHUNK, WORLD_PREFIX, MAX_FRAME_BYTES, PIXEL_UNITS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { fakeRoom } from './fakeRoom.mjs';
import { OnlineSession, WORLD_PUBLISH_MS } from '../src/net/online.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('WORLD1: the wire - the world frame is the one frame past MAX_FRAME_BYTES (an object, from a hello\'d socket, capped at WORLD_FRAME_MAX), every other frame keeps its cap; a world room is a dungeon\'s today; one home at both ends', () => {
  assert.equal(WORLD_FRAME_MAX, 512 * 1024); assert.equal(WORLD_MIN_MS, 5000); assert.equal(WORLD_CHUNK, 96 * 1024);
  assert.ok(WORLD_CHUNK < 128 * 1024, 'under a Durable Object value\'s cap');
  assert.ok(WORLD_PUBLISH_MS > WORLD_MIN_MS, 'the client publishes slower than the relay would drop');
  for (const k of ['isWorldRoom', 'WORLD_FRAME_MAX', 'WORLD_MIN_MS', 'WORLD_CHUNK', 'WORLD_PREFIX']) assert.equal(relay[k], { isWorldRoom, WORLD_FRAME_MAX, WORLD_MIN_MS, WORLD_CHUNK, WORLD_PREFIX }[k], `${k} at both ends`);
  assert.equal(JSON.stringify({ t: 'world', data: {} }).startsWith(WORLD_PREFIX), true, 'the prefix is what the client mints');
  assert.equal(isWorldRoom('dungeon:m187'), true); assert.equal(isWorldRoom('town:m9'), false); assert.equal(isWorldRoom('world:1,2'), false); assert.equal(isWorldRoom('interior:m9.4'), false);
  assert.equal(isWorldRoom('chat:world'), false); assert.equal(isChatRoom('dungeon:m187'), false); assert.equal(isWorldRoom(null), false);
  const world = { locationKey: 'dungeon:1234', world: { foes: [{ health: 3, dead: false }], piles: [], actions: {} } };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'world', data: world }), { hasHello: true }), { t: 'world', data: world, final: false });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'world', data: world, final: true }), { hasHello: true }), { t: 'world', data: world, final: true }, 'the farewell\'s mark (AUDIT WORLD B5)');
  assert.equal(parseClient(JSON.stringify({ t: 'world', data: world, final: 1 }), { hasHello: true }).final, false, 'true alone');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'world', data: world })), { error: 'world before hello' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'world' }), { hasHello: true }), { error: 'bad world' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'world', data: 'x' }), { hasHello: true }), { error: 'bad world' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'world', data: [1] }), { hasHello: true }), { error: 'bad world' });
  const big = { t: 'world', data: { pad: 'x'.repeat(MAX_FRAME_BYTES * 4) } };
  assert.equal(parseClient(JSON.stringify(big), { hasHello: true }).t, 'world', 'a world frame past MAX_FRAME_BYTES parses');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'world', data: { pad: 'x'.repeat(WORLD_FRAME_MAX) } }), { hasHello: true }), { error: 'frame too large' }, 'and past WORLD_FRAME_MAX does not');
  assert.deepEqual(parseClient(JSON.stringify({ data: big.data, t: 'world' }), { hasHello: true }), { error: 'frame too large' }, 'a big frame without the prefix is refused before any parse');
  assert.deepEqual(parseClient('x'.repeat(MAX_FRAME_BYTES + 1), { hasHello: true }), { error: 'frame too large' }, 'and so is big junk');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: 'x'.repeat(MAX_FRAME_BYTES) }), { hasHello: true }), { error: 'frame too large' }, 'every other frame keeps MAX_FRAME_BYTES');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'pose', p: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, pad: 'x'.repeat(MAX_FRAME_BYTES) } }), { hasHello: true }), { error: 'frame too large' });
});

const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const welcomeOf = (ws) => ofType(ws, 'welcome')[0];

test('WORLD1: the Room - the host is the hello\'d socket in the room longest, said in every welcome and in a host frame when it changes; the host\'s world is stored chunked with its meta and served raw in the next welcome, a smaller one leaves no stale tail; a non-host\'s frame, a sooner-than-WORLD_MIN_MS frame and a frame into a place that keeps no world are ignored, not refused; the sweeps forget looks, secrets and the hello bucket and never the world', async () => {
  const r = fakeRoom('dungeon:m187');
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'aaaa-0001', at(1, 1));
  assert.equal(welcomeOf(a).host, 'aaaa-0001', 'alone: the host'); assert.equal(welcomeOf(a).world, null, 'a room with no memory yet');
  assert.equal(ofType(a, 'host').length, 0, 'the welcome said it: no host frame besides');
  await r.hello(b, 'bbbb-0002', at(1, 1));
  assert.equal(welcomeOf(b).host, 'aaaa-0001', 'the joiner is told the host'); assert.equal(ofType(a, 'host').length, 0, 'unchanged: nothing said');
  // the memory, from the host
  const foes = Array.from({ length: 40 }, (_, i) => ({ health: i, dead: i % 3 === 0, feet: [i, 0, i], yaw: 0, items: [], pad: 'p'.repeat(3000) }));
  const world = { locationKey: 'dungeon:1234', world: { foes, piles: [{ items: [] }], droppedLoot: [], actions: { 'act:1': { state: 'end' } } } };
  const raw = JSON.stringify(world);
  assert.ok(raw.length > WORLD_CHUNK && raw.length < 2 * WORLD_CHUNK, 'a world of two chunks');
  await r.world(b, world);
  assert.equal(r.store.has('world:meta'), false, 'a non-host\'s world is ignored');
  assert.equal(b.closed, null, 'and no offence');
  await r.world(a, world);
  const meta = r.store.get('world:meta');
  assert.equal(meta.chunks, 2); assert.equal(meta.size, raw.length); assert.equal(meta.by, 'aaaa-0001'); assert.equal(typeof meta.at, 'number');
  assert.equal(r.store.get('world:0') + r.store.get('world:1'), raw, 'stored as it came, in WORLD_CHUNK pieces');
  assert.equal(a.att.worldAt, undefined, 'the floor\'s stamp is the room\'s, in storage - not the socket\'s, which a reconnect reset (AUDIT WORLD A5)');
  const small = { locationKey: 'dungeon:1234', world: { foes: [], piles: [], droppedLoot: [], actions: {} } };
  await r.world(a, small);
  assert.equal(r.store.get('world:meta').chunks, 2, 'a second frame within WORLD_MIN_MS is dropped');
  r.store.get('world:meta').at -= WORLD_MIN_MS - 100;   // most of the floor gone
  await r.world(a, small);
  assert.equal(r.store.get('world:meta').chunks, 2, 'still inside WORLD_MIN_MS: dropped - the floor is the constant, not less (AUDIT WORLD D9)');
  r.store.get('world:meta').at -= 101; r.wake();   // the clock moves past it (the stamp is the room's: it survives a wake)
  await r.world(a, small);
  assert.equal(r.store.get('world:meta').chunks, 1, 'the smaller world took'); assert.equal(r.store.has('world:1'), false, 'and left no stale tail');
  assert.equal(r.store.get('world:0'), JSON.stringify(small));
  r.store.get('world:meta').at -= WORLD_MIN_MS + 1;
  await r.world(a, world);
  // served raw in the next welcome
  await r.hello(c, 'cccc-0003', at(1, 1));
  assert.deepEqual(welcomeOf(c).world, world, 'the joiner is handed the room\'s memory as the host sent it');
  assert.equal(welcomeOf(c).host, 'aaaa-0001'); assert.equal(ofType(a, 'host').length + ofType(b, 'host').length, 0, 'a hello into a led room (across a wake) says no host frame');
  assert.deepEqual(welcomeOf(c).peers.map((p) => p.id).sort(), ['aaaa-0001', 'bbbb-0002'], 'and the roster still');
  // AUDIT WORLD D4: the joiner that LEADS (a stamp before everyone's - the same-millisecond tie the smaller id wins)
  // is said to the rest and not to itself, and its leave hands the seat back
  { const tie = r.connect(); a.att.since += 10; b.att.since += 10; c.att.since += 10; r.wake();
    await r.hello(tie, '0000-tie0', at(1, 1));
    assert.equal(welcomeOf(tie).host, '0000-tie0', 'the joiner leads');
    for (const ws of [a, b, c]) assert.deepEqual(ofType(ws, 'host').at(-1), { t: 'host', id: '0000-tie0' }, 'said to the rest');
    assert.equal(ofType(tie, 'host').length, 0, 'not to itself: its welcome said it');
    await r.drop(tie);
    for (const ws of [a, b, c]) assert.deepEqual(ofType(ws, 'host').at(-1), { t: 'host', id: 'aaaa-0001' }, 'the seat handed back'); }
  // the host leaves: the next-longest, said to everyone
  await r.drop(a);
  assert.deepEqual(ofType(b, 'host').at(-1), { t: 'host', id: 'bbbb-0002' }, 'b has been here longest now');
  assert.deepEqual(ofType(c, 'host').at(-1), { t: 'host', id: 'bbbb-0002' });
  r.store.get('world:meta').at -= WORLD_MIN_MS + 1;   // the floor is the room's: the new host waits it out like anyone
  await r.world(b, small);
  assert.equal(r.store.get('world:meta').by, 'bbbb-0002', 'the new host publishes');
  // the drain: looks, secrets and the bucket go; the world stays
  await r.drop(b); await r.drop(c);
  assert.equal(r.store.has('secret:bbbb-0002'), false); assert.equal(r.store.has('look:cccc-0003'), false); assert.equal(r.store.has('hellos'), false);
  assert.equal(r.store.get('world:meta').by, 'bbbb-0002', 'the room\'s memory outlives an empty room');
  assert.equal(r.store.get('world:0'), JSON.stringify(small));
  // the empty hello: the same sweep, the same memory, the joiner handed it
  const d = r.connect(); await r.hello(d, 'dddd-0004', at(1, 1));
  assert.deepEqual(welcomeOf(d).world, small, 'a joiner into an empty room gets what the last host left');
  assert.equal(welcomeOf(d).host, 'dddd-0004');
  assert.equal(r.store.has('hellos'), true, 'the bucket re-minted');
  // a place that keeps no world
  const town = fakeRoom('town:m9');
  const t = town.connect(); await town.hello(t, 'town-0001', at(1, 1));
  assert.equal(welcomeOf(t).host, 'town-0001', 'a host in every place'); assert.equal(welcomeOf(t).world, null);
  await town.world(t, small);
  assert.equal(town.store.has('world:meta'), false, 'a town keeps no memory yet'); assert.equal(t.closed, null);
  // a channel: no host frame business, no world
  const chat = fakeRoom('chat:world');
  const ch = chat.connect(); await chat.hello(ch, 'chat-0001');
  assert.deepEqual(welcomeOf(ch), { t: 'welcome', id: 'chat-0001', peers: [] }, 'a channel\'s welcome is what it was');
});

function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
  }
  return { FakeWS, sockets };
}

test('WORLD1: the session - the host from the welcome and the host frame, isHost, onHost on a change alone, onWorld when the welcome carries a memory; sendWorld the host\'s alone, an object alone, never a frame past WORLD_FRAME_MAX; the host forgotten on leave', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  const hosts = [], worlds = [];
  s.onHost = (id, mine) => hosts.push([id, mine]); s.onWorld = (w) => worlds.push(w);
  s.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0]; ws.open();
  assert.equal(s.host, null); assert.equal(s.isHost(), false, 'unknown until the welcome');
  assert.equal(s.sendWorld({ a: 1 }), false, 'not the host: nothing goes');
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'bob-0002', world: null });
  assert.equal(s.host, 'bob-0002'); assert.equal(s.isHost(), false); assert.deepEqual(hosts, [['bob-0002', false]]); assert.deepEqual(worlds, [], 'no memory: onWorld silent');
  ws.receive({ t: 'host', id: 'bob-0002' });
  assert.deepEqual(hosts, [['bob-0002', false]], 'the same host again: nothing said');
  ws.receive({ t: 'host', id: 'mac-0001' });
  assert.equal(s.isHost(), true); assert.deepEqual(hosts.at(-1), ['mac-0001', true], 'mine now');
  const shared = { locationKey: 'dungeon:1234', world: { foes: [] } };
  assert.equal(s.sendWorld(shared), true);
  assert.deepEqual(ws.sent.at(-1), { t: 'world', data: shared }); assert.equal(s.stats.worlds, 1);
  assert.equal(s.sendWorld(null), false); assert.equal(s.sendWorld([1]), false); assert.equal(s.sendWorld('x'), false);
  assert.equal(s.sendWorld({ pad: 'x'.repeat(WORLD_FRAME_MAX) }), false, 'past the cap: kept home, never a terminal close');
  assert.equal(ws.sent.filter((m) => m.t === 'world').length, 1);
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', world: shared });
  assert.deepEqual(worlds, [shared], 'a welcome with a memory: onWorld');
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', world: [1] });
  assert.deepEqual(worlds, [shared], 'not an object: not a memory');
  s.leave();
  assert.equal(s.host, null); assert.equal(s.isHost(), false, 'forgotten with the room');
});

test('WORLD1: the hosts by source - the dungeon host\'s shared world is the layout\'s foes alone (the leading run before any quest foe) with nothing of the player\'s own, keyed by the dungeon, and its restore leaves the quest owner\'s foes standing (applyWorld without its cut); the mode machine forwards both and fires the leave hook before either teardown; the world host restores on the welcome, publishes every WORLD_PUBLISH_MS while it hosts, and at once on the dungeon\'s exit, the death screen and the page\'s hide', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /function applyWorld\(w, \{ truncate = true \} = \{\}\) \{/);
  assert.match(d, /for \(let i = foes\.length - 1; truncate && i >= \(w\.foes\?\.length \?\? 0\); i--\) \{/, 'the cut is the save\'s alone');
  assert.match(d, /sharedWorld\(\) \{\s*const w = collectWorld\(\);\s*w\.foes = w\.foes\.slice\(0, _layoutFoes\);\s*delete w\.teleportedIntoDungeon;\s*delete w\.droppedLoot;\s*return \{ locationKey: _locationKey, stamp: _sharedStamp, world: w \};\s*\},/, 'the layout\'s run alone (AUDIT WORLD B2), nothing of the player\'s own - not the drops (B3) - keyed and stamped (B1)');
  assert.match(d, /restoreSharedWorld\(shared\) \{\s*if \(!shared \|\| shared\.locationKey !== _locationKey \|\| !shared\.world \|\| typeof shared\.world !== 'object'\) return false;\s*if \(shared\.stamp === _sharedStamp \|\| _sharedApplied\) return false;\s*_sharedApplied = true;\s*applyWorld\(\{ \.\.\.shared\.world, foes: Array\.isArray\(shared\.world\.foes\) \? shared\.world\.foes\.slice\(0, _layoutFoes\) : \[\] \}, \{ truncate: false \}\);\s*return true;\s*\},/, 'another dungeon\'s memory refused, its own refused (B1), once (B7), the layout\'s run alone in (B2), the rest left standing');
  assert.match(d, /for \(const e of enemies\) await buildFoeAt\(e\);\s*const _layoutFoes = foes\.length;/, 'the run measured right after the markers\' build');
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /dungeonSharedWorld\(\) \{ return mode === 'dungeon' && dungeonCtx \? dungeonCtx\.sharedWorld\(\) : null; \},/);
  assert.match(m, /restoreDungeonSharedWorld\(shared\) \{ return mode === 'dungeon' && dungeonCtx \? dungeonCtx\.restoreSharedWorld\(shared\) : false; \},/);
  const ex = m.slice(m.indexOf('function exitDungeonNow() {'), m.indexOf('function exitDungeonNow() {') + 600);
  assert.match(ex, /host\.onDungeonLeave\?\.\(\);[^\n]*\n\s*teardownDungeonQuestFlats\(\);[^\n]*\n\s*dungeonCtx\.destroy\(\);/, 'the exit: the hook while the dungeon still stands - before the flats and the destroy, inside THIS function (AUDIT WORLD D1: a lazy regex ran on to the other teardown)');
  assert.match(m, /if \(dungeonCtx\) \{\s*host\.onDungeonLeave\?\.\(\);[^\n]*\n\s*teardownDungeonQuestFlats\(\);\s*dungeonCtx\.overlayWindow/, 'a load or a teleport out: the same hook');
  assert.equal((m.match(/host\.onDungeonLeave\?\.\(\)/g) ?? []).length, 2, 'the two teardowns, no third');
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ OnlineSession, roomKeyFor, DEFAULT_SERVER, WORLD_PUBLISH_MS \} from '\.\.\/net\/online\.js';/);
  assert.match(w, /const worldPublish = \(now, force = false\) => \{\s*if \(!online \|\| !online\.isHost\(\) \|\| online\.status !== 'open' \|\| !isWorldRoom\(online\.room\)\) return false;\s*if \(!force && now - _worldPublishedAt < WORLD_PUBLISH_MS\) return false;\s*const shared = modes\?\.dungeonSharedWorld\?\.\(\);\s*if \(!shared\) return false;\s*_worldPublishedAt = now;\s*const ok = online\.sendWorld\(shared, \{ final: force \}\);\s*if \(!ok\) console\.warn\([^\n]*\);\s*return ok;\s*\};/, 'the host\'s alone, into a world room alone (AUDIT WORLD B8), on the publish clock unless forced - and forced is the farewell (B5); a refusal said once, never retried at frame rate (B9)');
  assert.match(w, /online\.onWorld = \(shared\) => \{ if \(modes\?\.restoreDungeonSharedWorld\?\.\(shared\)\)/, 'the welcome\'s memory lands on the standing dungeon');
  assert.match(w, /online\.onHost = \(id, mine\) => \{ if \(mine\) _worldPublishedAt = -Infinity; \};/, 'a new host publishes at once');
  assert.match(w, /online\.tick\(\);\s*worldPublish\(now\);/, 'every frame asks');
  assert.match(w, /if \(online\.room\) \{ worldPublish\(now, true\); online\.leave\(\); \}/, 'the dead leave the room its memory');
  assert.match(w, /'pagehide', \(\) => \{ worldPublish\(performance\.now\(\), true\); online\?\.leave\(\);/, 'the page\'s hide too');
  assert.match(w, /onDungeonLeave: \(\) => worldPublish\(performance\.now\(\), true\),/, 'and the dungeon\'s exit, through the mode machine\'s hook');
  const online = rd('src/net/online.js');
  assert.match(online, /if \(!this\.isHost\(\) \|\| !this\._ws \|\| this\.status !== 'open'\) return false;\s*const s = JSON\.stringify\(final \? \{ t: 'world', data, final: true \} : \{ t: 'world', data \}\);[^\n]*\n\s*if \(s\.length > WORLD_FRAME_MAX\) return false;/, 'the cap kept at the client: the relay\'s refusal is terminal; t first, the prefix the relay reads');
  const room = rd('server/src/index.js');
  assert.doesNotMatch(room, /storage\.deleteAll\(\)/, 'no sweep forgets the world');
  assert.match(room, /for \(const prefix of \['look:', 'secret:'\]\) \{ const m = await this\.state\.storage\.list\(\{ prefix \}\);/, 'the sweep by prefix');
});
