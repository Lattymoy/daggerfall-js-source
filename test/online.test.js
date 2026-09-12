// ONLINE1 (2026-09-12, Mac: "the basic bones of multiplayer"), re-pinned
// by AUDIT ONLINE (the deep audit before the merge). THE CLIENT
// EXECUTES: the room key from what a host knows (the world's cell, a
// town, a dungeon, an interior by MAP ID, null when the host does not
// know), the pose's change test, the easing (the yaw by the shorter
// arc), the peer id minted once; the session driven over a fake socket
// on ITS OWN clock - hello on open, a pose at most POSE_HZ when moved
// and a heartbeat regardless, the welcome merged, join/pose/leave, a
// silent peer HIDDEN not dropped, a jump snapped, a walk eased, the
// relay's frames checked, a room change closing the socket, reconnect
// backoff that doubles, the relay's terminal close codes; the look and
// the stub off an equip table, clamped; the others drawn through a
// fake renderer - the figure cropped to its alpha, the doll cached and
// evicted, a failure waited out, a look change rebuilt, the name
// projected under the docked HUD's viewport. Mutants named inline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  POSE_HZ, HEARTBEAT_MS, WORLD_CELL, PEER_TIMEOUT_MS, BACKOFF_MIN_MS, BACKOFF_MAX_MS, DEFAULT_SERVER, SNAP_WORLD_UNITS, SNAP_SCENE_UNITS,
  slug, worldRoom, roomKeyFor, poseChanged, lerpPose, peerId, peerSecret, OnlineSession,
} from '../src/net/online.js';
import { WORLD_CELL as WIRE_CELL, RANGE_PIXELS, PIXEL_UNITS, POSE_BOUND, CLOSE_REPLACED, CLOSE_POLICY, CLOSE_BUSY, roomOf, validPose, relayUrl } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';
import { composeLook, lookKey, peerStubEntity, alphaBounds, cropRgba, LOOK_ITEM_FIELDS, LOOK_GROUPS, PEER_ARCHIVE, PEER_HEIGHT, DOLLS_MAX, DOLL_RETRY_MS, RemotePlayers } from '../src/net/remotePlayers.js';
import { LOOK_GROUPS as WIRE_GROUPS, LOOK_ITEM_FIELDS as WIRE_FIELDS } from '../src/net/wire.js';
import { createEquipTable } from '../src/characters/equipTable.js';
import { CAPSULE_HEIGHT } from '../src/player/motor.js';
import { PAPERDOLL_W, PAPERDOLL_H } from '../src/ui/paperDoll.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';
import { projectToScreen } from '../src/player/tapRay.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A fake WebSocket class: records what was sent, lets the test drive the events. */
function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; }   // a real socket fires onclose LATER, never inside close()
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
    drop(code = 1006) { this.onclose?.({ code, reason: '' }); }
  }
  return { FakeWS, sockets };
}

const pose = (x, z = 0) => ({ x, y: 0, z, yaw: 0, pitch: 0, mv: 1 });

test('ONLINE1: the wire is ONE law - the relay re-exports net/wire.js; the world\'s bound admits the whole Bay, the classic start cell included (mutant: the 1e7 bound that refused most of it)', () => {
  for (const k of ['validPose', 'validLook', 'parseClient', 'inRange', 'poseGate', 'rosterFor', 'roomOf', 'sanitizeName']) assert.equal(typeof relay[k], 'function', `${k} at both ends`);
  assert.equal(relay.validPose, validPose, 'the same function object: one home');
  assert.equal(WORLD_CELL, WIRE_CELL); assert.equal(relay.WORLD_CELL, WIRE_CELL);
  assert.match(rd('server/src/relay.js'), /export \* from '\.\.\/\.\.\/src\/net\/wire\.js';/);
  // the classic start (StartCellX/Y 109,158) in MapsFile units, and the far corners
  const start = { x: 109 * PIXEL_UNITS + 100, y: 5, z: (499 - 158) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 };
  assert.ok(validPose(start), 'the classic start is inside the world');
  assert.ok(validPose({ ...start, x: 999 * PIXEL_UNITS + 32000, z: 499 * PIXEL_UNITS + 32000 }), 'the far corner too');
  assert.ok(POSE_BOUND >= 1000 * PIXEL_UNITS, 'the map is 1000 pixels wide');
  assert.equal(validPose({ ...start, x: 2 * POSE_BOUND }), null, 'past the world: refused');
});

test('ONLINE1: the room key - the world by cell, a town, a dungeon and an interior by MAP ID (a slug only without one), null when the host does not know, every key one the relay admits (mutant: a pooled room of the unknown)', () => {
  assert.equal(roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: { x: 400, y: 240 } }), 'world:25,15');
  assert.equal(worldRoom(400, 240), 'world:25,15'); assert.equal(worldRoom(15, 16), 'world:0,1');
  assert.equal(roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: null }), null, 'no pixel yet, no room');
  assert.equal(roomKeyFor({ host: 'exterior', mode: 'exterior', mapId: 1234, regionIndex: 17, locationName: 'Daggerfall' }), 'town:m1234', 'the map id wins');
  assert.equal(roomKeyFor({ host: 'exterior', mode: 'exterior', regionIndex: 17, locationName: 'Daggerfall' }), 'town:17.Daggerfall', 'without one, the region and the name');
  assert.equal(roomKeyFor({ host: 'world', mode: 'dungeon', mapId: 77, regionIndex: 17, locationName: "Privateer's Hold" }), 'dungeon:m77');
  assert.equal(roomKeyFor({ host: 'world', mode: 'dungeon', regionIndex: 17, locationName: "Privateer's Hold" }), 'dungeon:17.Privateer_s_Hold');
  assert.equal(roomKeyFor({ host: 'world', mode: 'interior', mapId: 1234, buildingKey: 4021 }), 'interior:m1234.4021');
  assert.equal(roomKeyFor({ host: 'exterior', mode: 'interior', mapId: 1234, buildingKey: 7 }), 'interior:m1234.7', 'the fixed city\'s interiors are the same rooms');
  assert.equal(roomKeyFor({ host: 'world', mode: 'interior', buildingKey: 7 }), null, 'an interior in a location the host cannot name: no room, not a pool');
  assert.equal(roomKeyFor({ host: 'world', mode: 'dungeon', regionIndex: -1, locationName: '' }), null);
  assert.equal(roomKeyFor({ host: 'world', mode: 'interior', mapId: 1234, buildingKey: 0 }), null, 'a door the directory cannot key: no room (mutant: every unkeyed interior in one pool)');
  for (const k of ['world:25,15', 'town:m1234', 'dungeon:17.Privateer_s_Hold', 'interior:m1234.4021']) assert.equal(roomOf('/room/' + k), k, `${k} is a key the relay admits`);
  assert.equal(slug('The Sanctum of Ilyn / Mother\'s'), 'The_Sanctum_of_Ilyn_Mother_s'); assert.equal(slug(''), 'x');
  assert.equal(slug('x'.repeat(60)).length, 40);
});

test('ONLINE1: the pose - changed past a hair, eased between two with the yaw by the shorter arc; the id minted once (mutant: the long way round)', () => {
  const a = pose(0);
  assert.equal(poseChanged(a, { ...a }), false); assert.equal(poseChanged(a, { ...a, x: 0.005 }), false, 'a hair is not a move');
  assert.equal(poseChanged(a, { ...a, x: 0.02 }), true); assert.equal(poseChanged(a, { ...a, yaw: 0.02 }), true); assert.equal(poseChanged(a, { ...a, mv: 0 }), true);
  assert.equal(poseChanged(null, a), true);
  const m = lerpPose({ ...a, x: 0, yaw: 0.1 }, { ...a, x: 10, yaw: 2 * Math.PI - 0.1, mv: 1 }, 0.5);
  assert.equal(m.x, 5); assert.ok(Math.abs(m.yaw - 0) < 1e-9, 'from 0.1 to -0.1 (spelled 2pi - 0.1): through zero, not round the back'); assert.equal(m.mv, 1);
  assert.deepEqual(lerpPose(null, a, 0.3), a, 'no from: the target');
  assert.equal(lerpPose(a, { ...a, x: 10 }, 2).x, 10, 'clamped past one');
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const id = peerId(storage); assert.match(id, /^[A-Za-z0-9_-]{4,40}$/); assert.equal(peerId(storage), id, 'the same id next time');
  assert.match(peerId({ getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } }), /^p/, 'a storage that throws: a fresh id, never a crash');
  const sec = peerSecret(storage); assert.match(sec, /^[A-Za-z0-9_-]{8,64}$/); assert.equal(peerSecret(storage), sec, 'the secret kept beside the id'); assert.notEqual(sec, id);
  assert.equal(relayUrl('wss://daggerfall-online.example.workers.dev/'), 'wss://daggerfall-online.example.workers.dev'); assert.equal(relayUrl('ws://localhost:8787'), 'ws://localhost:8787');
  for (const bad of ['http://relay.test', 'ws://relay.test', 'wss://relay.test/x?y=1', 'javascript:alert(1)', '']) assert.equal(relayUrl(bad), null, `${bad || 'empty'} is no relay`);
  assert.match(DEFAULT_SERVER, /^wss:\/\/daggerfall-online\./, 'the relay this port hosts');
});

test('ONLINE1: the session over a fake socket, on its own clock - hello on open, a pose at most POSE_HZ when moved and a heartbeat regardless, the welcome merged, join, pose, leave, a walk eased and a jump snapped, the silent peer hidden not dropped, the relay\'s frames checked (mutants: tick fed the frame\'s clock, a pose every frame, the welcome wiping the peers, a peer dropped for standing still)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;   // Date.now()-sized: a tick(now) fed a rAF stamp would freeze everything
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 2, items: [] }, id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => now });
  s.join('world:25,15', pose(0));
  assert.equal(sockets.length, 1); assert.equal(sockets[0].url, 'wss://relay.test/room/world:25,15', 'the trailing slash trimmed, the room in the path');
  assert.equal(s.status, 'connecting'); assert.equal(s.statusLine(), 'online: connecting');
  assert.equal(s.sendPose(pose(1)), false, 'nothing goes before the socket opens');
  sockets[0].open();
  assert.equal(s.status, 'open'); assert.equal(s.statusLine(), null);
  assert.deepEqual(sockets[0].sent[0], { t: 'hello', id: 'mac-0001', secret: 'shh-shh-shh-0001', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 2, items: [] }, pose: pose(1) }, 'the hello carries the id, its secret and the latest pose');
  assert.equal(s.sendPose(pose(2)), true); now += 20; assert.equal(s.sendPose(pose(3)), false, 'twenty ms later: throttled');
  now += 100; assert.equal(s.sendPose(pose(3)), true, 'a tenth of a second: sent'); now += 100; assert.equal(s.sendPose(pose(3)), false, 'unmoved: not sent');
  assert.equal(sockets[0].sent.filter((m) => m.t === 'pose').length, 2); assert.equal(POSE_HZ, 10);
  now += HEARTBEAT_MS; assert.equal(s.sendPose(pose(3)), true, 'unmoved past the heartbeat: sent anyway - the socket\'s keepalive and the peers\' clock');
  assert.equal(s.stats.poses, 3);
  // the roster, a join, a pose, easing, a leave - all on the session's clock, ticked with NO argument
  const far = pose(20 * PIXEL_UNITS);   // twenty pixels off: in the roster, past the relay's range
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0001', name: 'Bob', look: {}, pose: pose(10) }, { id: 'zed-0001', name: 'Zed', look: {}, pose: far }, { id: 'mac-0001', name: 'me' }] });
  assert.equal(s.peers.size, 2, 'myself left out');
  assert.deepEqual(s.drawable().map((p) => p.id), ['bob-0001'], `a peer past RANGE_PIXELS (${RANGE_PIXELS}) is known but not drawn`);
  sockets[0].receive({ t: 'join', id: 'eve-0001', name: 'Eve', look: {}, pose: null });
  assert.equal(s.peers.size, 3); assert.equal(s.drawable().length, 1, 'a peer without a pose is not drawn yet');
  sockets[0].receive({ t: 'pose', id: 'bob-0001', p: pose(20) });
  now += 50; s.tick(); assert.ok(Math.abs(s.peers.get('bob-0001').shown.x - 15) < 1e-9, 'half an interval on: halfway from 10 to 20');
  now += 50; s.tick(); assert.equal(s.peers.get('bob-0001').shown.x, 20);
  sockets[0].receive({ t: 'pose', id: 'bob-0001', p: pose(20 + SNAP_WORLD_UNITS + 1) });
  assert.equal(s.peers.get('bob-0001').shown.x, 20 + SNAP_WORLD_UNITS + 1, 'a jump past the snap distance: snapped, not swept across the map');
  sockets[0].receive({ t: 'pose', id: 'bob-0001', p: pose(21) });
  assert.equal(s.peers.get('bob-0001').shown.x, 20 + SNAP_WORLD_UNITS + 1, '...and then a jump back: snapped again');
  sockets[0].receive({ t: 'leave', id: 'eve-0001' }); assert.equal(s.peers.size, 2);
  // silence hides, it does not drop: the room's leave is the only goodbye
  now += PEER_TIMEOUT_MS + 1; s.tick();
  assert.equal(s.peers.size, 2, 'silent past the timeout: still known'); assert.equal(s.drawable().length, 0, '...but hidden');
  sockets[0].receive({ t: 'pose', id: 'bob-0001', p: pose(22) }); assert.equal(s.drawable().length, 1, 'a pose brings the peer back');
  // the welcome merges: a reconnect keeps where a known peer is drawn
  s.peers.get('bob-0001').shown = pose(22.5);
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0001', name: 'Bob', look: {}, pose: pose(30) }] });
  assert.equal(s.peers.size, 1, 'Zed, not in the roster, is gone'); assert.equal(s.peers.get('bob-0001').from.x, 22.5, 'Bob eases from where he was drawn');
  // the relay's frames are checked by the wire's own law
  sockets[0].receive({ t: 'welcome', peers: 5 }); assert.equal(s.peers.size, 0, 'a roster that is not a list: no peers, no throw');
  sockets[0].receive({ t: 'join', id: 'bob-0001', name: '<b>Bob☃</b>', look: null, pose: { x: 'NaN-town' } });
  assert.equal(s.peers.get('bob-0001').name, '<b>Bob</b>', 'the name sanitized as the relay would'); assert.equal(s.peers.get('bob-0001').pose, null, 'a pose that is not one: none');
  sockets[0].receive({ t: 'pose', id: 'bob-0001', p: { x: 1, y: 0, z: 0, yaw: 0, pitch: 0 } }); assert.equal(s.peers.get('bob-0001').pose.mv, 0, 'mv defaulted');
  sockets[0].receive({ t: 'pose', id: 'nobody', p: pose(1) }); assert.equal(s.peers.size, 1, 'a pose from an id never introduced: ignored');
  sockets[0].receive('not json'); sockets[0].receive({ t: 'pose', id: 'bob-0001', p: { x: 1e12, y: 0, z: 0, yaw: 0, pitch: 0 } });
  assert.equal(s.peers.get('bob-0001').pose.x, 1, 'a pose past the world: ignored');
  s.leave(); assert.equal(s.room, null); assert.equal(s.status, 'closed'); assert.equal(sockets[0].closed.code, 1000);
});

test('ONLINE1: the socket\'s lifecycle - a room change closes and reopens, a stale socket\'s events are ignored, a drop reconnects with a backoff that DOUBLES, the relay\'s error and its terminal close codes end the retries, the same room again opens nothing (mutants: the stale-socket guard gone, a constant backoff, 4000 retried into a two-tab eviction loop)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => now });
  s.join('world:25,15', pose(0)); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0001', name: 'Bob', look: {}, pose: pose(1) }] });
  // a room change: the socket closes, a new one opens on the new room; the old socket's late events do nothing
  s.join('dungeon:m77', pose(0));
  assert.equal(sockets[0].closed.code, 1000); assert.equal(sockets.length, 2); assert.equal(sockets[1].url, 'wss://relay.test/room/dungeon:m77');
  assert.equal(s.peers.size, 0, 'the old room\'s peers went with it');
  sockets[0].receive({ t: 'join', id: 'eve-0001', name: 'Eve', look: {}, pose: pose(1) }); assert.equal(s.peers.size, 0, 'a frame on the STALE socket: ignored');
  sockets[0].drop(); assert.equal(s.status, 'connecting', 'the stale socket\'s close: ignored'); assert.equal(s._retryAt, null);
  s.join('dungeon:m77'); assert.equal(sockets.length, 2, 'the same room again: no new socket');
  // a drop reconnects with a backoff that doubles
  sockets[1].open(); sockets[1].drop(); assert.equal(s.status, 'closed'); assert.equal(s.statusLine(), 'online: reconnecting');
  now += BACKOFF_MIN_MS - 1; s.tick(); assert.equal(sockets.length, 2, 'not before the backoff');
  now += 2; s.tick(); assert.equal(sockets.length, 3, 'then a new socket'); assert.equal(s.stats.reconnects, 1);
  sockets[2].drop();
  now += BACKOFF_MIN_MS + 1; s.tick(); assert.equal(sockets.length, 3, 'the second wait is longer than the first');
  now += BACKOFF_MIN_MS; s.tick(); assert.equal(sockets.length, 4, 'twice the first: the backoff doubled');
  assert.ok(BACKOFF_MAX_MS >= BACKOFF_MIN_MS * 4);
  sockets[3].open(); assert.equal(s._backoff, BACKOFF_MIN_MS, 'a good open resets it');
  // the relay's error frame, then its policy close: terminal - no storm
  sockets[3].receive({ t: 'error', m: 'bad pose' }); assert.equal(s.status, 'error'); assert.equal(s.error, 'bad pose');
  sockets[3].drop(CLOSE_POLICY); assert.equal(s.terminal, true); assert.equal(s.statusLine(), 'online: bad pose');
  now += BACKOFF_MAX_MS * 4; s.tick(); assert.equal(sockets.length, 4, 'refused: not retried');
  // replaced by another window: terminal too
  s.join('town:m5', pose(0)); assert.equal(sockets.length, 5); assert.equal(s.terminal, false, 'a new room starts clean');
  sockets[4].open(); sockets[4].drop(CLOSE_REPLACED);
  assert.equal(s.terminal, true); assert.match(s.error, /another window/);
  now += BACKOFF_MAX_MS * 4; s.tick(); assert.equal(sockets.length, 5, 'replaced: not retried, or two tabs would evict each other forever');
  // busy (1013): not terminal, but a hard backoff
  s.join('town:m6', pose(0)); sockets[5].open(); sockets[5].drop(CLOSE_BUSY);
  assert.equal(s.terminal, false); assert.ok(s._backoff >= BACKOFF_MAX_MS / 2, 'a full room is waited out, not hammered'); now += BACKOFF_MAX_MS + 1; s.tick(); assert.equal(sockets.length, 7, 'then tried again');
  s.leave(); const n = sockets.length; now += 60000; s.tick(); assert.equal(sockets.length, n, 'left: no reconnect');
  // a relay that is not wss:// is no relay at all
  const bad = new OnlineSession({ url: 'http://relay.test', id: 'mac-0002', secret: 'shh-shh-shh-0002', WebSocketImpl: FakeWS, now: () => now });
  bad.join('world:0,0', pose(0)); assert.equal(sockets.length, n, 'no socket'); assert.equal(bad.terminal, true); assert.match(bad.statusLine(), /wss/);
});

test('ONLINE1: the look and the stub - the equipped items\' doll fields off the equip table, one key per look, a stand-in entity with the items in their slots, every field clamped at the door (mutant: relay data trusted)', () => {
  const entity = { race: 'Redguard', gender: 'female', faceIndex: 4, equip: createEquipTable() };
  entity.equip.slots[3] = { templateIndex: 102, group: 'Armor', material: 2, dye: 3, variant: 1, equipSlot: 3, currentCondition: 40, name: 'x' };
  entity.equip.slots[10] = { templateIndex: 20, group: 'MensClothing', equipSlot: 10, uid: 99 };
  const look = composeLook(entity);
  assert.deepEqual(look, { race: 'Redguard', gender: 'female', faceIndex: 4, items: [{ templateIndex: 102, group: 'Armor', material: 2, dye: 3, variant: 1, equipSlot: 3 }, { templateIndex: 20, group: 'MensClothing', equipSlot: 10 }] }, 'the doll\'s fields, nothing else');
  assert.deepEqual(LOOK_ITEM_FIELDS, ['templateIndex', 'group', 'material', 'dye', 'variant', 'equipSlot']);
  assert.deepEqual(composeLook(null), { race: 'Breton', gender: 'male', faceIndex: 0, items: [] });
  assert.equal(lookKey(look), lookKey(JSON.parse(JSON.stringify(look)))); assert.notEqual(lookKey(look), lookKey({ ...look, faceIndex: 5 }));
  const stub = peerStubEntity(look);
  assert.equal(stub.race, 'Redguard'); assert.equal(stub.equip.slots[3].templateIndex, 102); assert.equal(stub.equip.slots[10].templateIndex, 20);
  assert.equal(stub.items.length, 2); assert.deepEqual(stub.activeEffects, [], 'no racial override on a peer');
  // the door clamps
  const bad = peerStubEntity({ race: 'x'.repeat(40), gender: 'other', faceIndex: 42, items: [
    { templateIndex: 1, group: 'Armor', equipSlot: 99 }, { templateIndex: -5, group: 'Armor', equipSlot: 1 }, { templateIndex: 7, group: 'Bombs', equipSlot: 2 },
    { templateIndex: 8.9, group: 'Weapons', equipSlot: 4.7, variant: -1, material: 1e9, dye: 'red' }, null, 'x',
  ] });
  assert.equal(bad.race.length, 16); assert.equal(bad.gender, 'male'); assert.equal(bad.faceIndex, 9);
  assert.deepEqual(bad.items, [{ templateIndex: 8, group: 'Weapons', equipSlot: 4, material: 4095 }], 'a slot past the table, a negative index, an unknown group, a string dye: dropped or clamped');
  assert.equal(peerStubEntity({ items: new Array(60).fill({ templateIndex: 1, group: 'Armor', equipSlot: 1 }) }).items.length, 27, 'the table\'s slots bound the items');
  assert.deepEqual(LOOK_GROUPS, ['MensClothing', 'WomensClothing', 'Armor', 'Weapons', 'Jewellery']); assert.equal(LOOK_GROUPS, WIRE_GROUPS); assert.equal(LOOK_ITEM_FIELDS, WIRE_FIELDS, 'the look\'s vocabulary has one home');
  assert.equal(PEER_HEIGHT, CAPSULE_HEIGHT); assert.ok(PEER_ARCHIVE > 100000);
});

/** A 110x184 RGBA buffer with a figure rectangle at (x0,y0)-(x1,y1) inclusive. */
function figure(x0, y0, x1, y1) {
  const rgba = new Uint8Array(PAPERDOLL_W * PAPERDOLL_H * 4);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const o = (y * PAPERDOLL_W + x) * 4; rgba[o] = 200; rgba[o + 3] = 255; }
  return { width: PAPERDOLL_W, height: PAPERDOLL_H, rgba };
}
function fakeRenderer() {
  const log = { uploads: [], releases: [], batches: [], destroyed: [] };
  return { log,
    uploadTexture(archive, record, c) { log.uploads.push({ archive, record, w: c.width, h: c.height }); },
    releaseTexture(archive, record) { log.releases.push({ archive, record }); },
    createBillboardBatch(archive, record, size, centers) { const b = { archive, record, size, centers, origin: null }; log.batches.push(b); return b; },
    destroyBillboardBatch(b) { log.destroyed.push(b); },
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test('ONLINE1: the others drawn through a fake renderer - the figure cropped to its alpha and stood the capsule tall, one doll per look, a failure waited out, a look change rebuilt, a peer gone released, the oldest doll evicted past DOLLS_MAX, the name over the head under the docked HUD\'s viewport (mutants: the panel-tall doll, a failure retried every frame, the name projected through the whole canvas)', async () => {
  const b = alphaBounds(figure(30, 10, 79, 173).rgba, PAPERDOLL_W, PAPERDOLL_H);
  assert.deepEqual(b, { x: 30, y: 10, w: 50, h: 164 }); assert.equal(alphaBounds(new Uint8Array(16), 2, 2), null, 'nothing drawn: no figure');
  const crop = cropRgba(figure(30, 10, 79, 173).rgba, PAPERDOLL_W, b); assert.equal(crop.length, 50 * 164 * 4); assert.equal(crop[3], 255); assert.equal(crop[0], 200);
  const renderer = fakeRenderer();
  let now = 1000; const composed = [];
  const compose = async (deps, stub, opts) => { composed.push(stub.race); assert.equal(opts.background, false, 'no panel behind a peer'); return stub.race === 'Nobody' ? null : figure(30, 10, 79, 173); };
  const rp = new RemotePlayers({ renderer, deps: { fetchBytes() {}, palette: null, getTexture() {} }, compose, now: () => now });
  const peer = (id, race, x = 0) => ({ id, name: id.toUpperCase(), look: { race, gender: 'male', faceIndex: 0, items: [] }, shown: { x, y: 0, z: -10, yaw: 0, pitch: 0, mv: 0 } });
  rp.sync([peer('bob', 'Nord'), peer('eve', 'Nord', 2)]);
  assert.equal(rp.batches().length, 0, 'composing'); await flush(); await flush();
  assert.deepEqual(composed, ['Nord'], 'one compose for two peers of one look');
  rp.sync([peer('bob', 'Nord'), peer('eve', 'Nord', 2)]);
  assert.equal(rp.batches().length, 2); assert.equal(renderer.log.uploads.length, 1);
  assert.deepEqual(renderer.log.uploads[0], { archive: PEER_ARCHIVE, record: renderer.log.uploads[0].record, w: 50, h: 164 }, 'the crop is what goes up');
  const size = rp.batches()[0].size; assert.equal(size.h, PEER_HEIGHT); assert.ok(Math.abs(size.w - PEER_HEIGHT * 50 / 164) < 1e-12, 'the width from the figure\'s own aspect, not the panel\'s');
  assert.deepEqual(rp.batches()[1].origin, [2, 0, -10], 'stood at the peer\'s feet');
  // a failure is waited out, not retried every frame
  rp.sync([peer('bob', 'Nord'), peer('nob', 'Nobody')]); await flush(); await flush();
  const tries = composed.length; rp.sync([peer('nob', 'Nobody')]); rp.sync([peer('nob', 'Nobody')]); await flush();
  assert.equal(composed.length, tries, 'no retry before DOLL_RETRY_MS');
  now += DOLL_RETRY_MS + 1; rp.sync([peer('nob', 'Nobody')]); await flush(); await flush(); assert.equal(composed.length, tries + 1, 'one retry after it');
  // a look change rebuilds the batch; a peer gone is released
  rp.sync([peer('bob', 'Redguard')]); await flush(); await flush(); rp.sync([peer('bob', 'Redguard')]);
  assert.equal(rp.batches().length, 1); assert.equal(rp.batches()[0].record, renderer.log.uploads[1].record, 'the new doll'); assert.ok(renderer.log.destroyed.length >= 2, 'the old batch and eve\'s went');
  rp.sync([]); assert.equal(rp.batches().length, 0);
  // the name: over the head, projected through the world viewport the host draws with
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)); const view = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
  rp.sync([peer('bob', 'Redguard')]);
  const rect = { x: 0, y: 0, w: 1, h: 0.77 };
  const [n] = rp.namePoints(proj, view, 1600, 900, [0, 1.7, 0], undefined, rect);
  assert.equal(n.name, 'BOB');
  const want = projectToScreen([0, PEER_HEIGHT + 0.25, -10], 1600, 900, proj, view, rect);
  assert.ok(Math.abs(n.x - want.x) < 1e-9 && Math.abs(n.y - want.y) < 1e-9, 'the same point tapRay projects, in the rect');
  const whole = projectToScreen([0, PEER_HEIGHT + 0.25, -10], 1600, 900, proj, view, null);
  assert.ok(Math.abs(whole.y - n.y) > 20, 'the docked HUD\'s rect moves it - the whole canvas would land the name off the head');
  assert.equal(rp.namePoints(proj, view, 1600, 900, [500, 0, 0]).length, 0, 'out of NAME_RANGE: no name');
  // the oldest doll goes past DOLLS_MAX, its texture released
  for (let i = 0; i < DOLLS_MAX; i++) { rp.sync([peer('p' + i, 'R' + i)]); await flush(); await flush(); }
  assert.ok(renderer.log.releases.length >= 1, 'past the cap: released'); assert.equal(renderer.log.releases[0].archive, PEER_ARCHIVE);
  rp.destroy(); assert.equal(rp.batches().length, 0); assert.equal(renderer.log.releases.length, renderer.log.uploads.length, 'every doll released');
});

test('ONLINE1: the compositor\'s door is PURE - composePaperDollPixels composes over its own art set and buffer, and the compose body reads nothing of the singleton (mutant: the peer composed through the inventory\'s doll)', () => {
  const pd = rd('src/ui/paperDoll.js');
  assert.match(pd, /export async function composePaperDollPixels\(deps, entity, \{ context = 'town', background = true \} = \{\}\)/);
  const from = pd.indexOf('async function composeDoll(art, deps, entity, { background = true } = {}) {');
  assert.ok(from > 0, 'the compose is a function of its art and deps');
  const body = pd.slice(from, pd.indexOf('\nexport async function refreshPaperDoll(', from));
  const names = (text, list, what) => { for (const name of list) assert.ok(!new RegExp(`\\b${name}\\b`).test(text), `${what} ${name}`); };
  names(body, ['_art', '_deps', '_live', '_pixels', '_layout', '_identity', '_refreshing', '_pending'], 'the compose reads no');
  assert.match(body, /for \(let y = 0; background && y < PAPERDOLL_H; y\+\+\) \{/, 'the background loop is skipped for a peer, the panel stays clear');
  assert.match(pd, /export async function refreshPaperDoll\(entity\) \{[\s\S]*?const \{ out, layout \} = await composeDoll\(_art, _deps, entity\);/, 'the inventory\'s doll rides the same compose');
  const door = pd.slice(pd.indexOf('export async function composePaperDollPixels('), pd.indexOf('/** Test seam. */'));
  names(door, ['_art', '_deps', '_live', '_pixels', '_layout', '_identity', 'refreshPaperDoll', 'preloadPaperDollArt'], 'the door touches no');
  assert.match(door, /_artSets\.set\(key, art\)/, 'an art set per identity');
  assert.match(rd('src/net/remotePlayers.js'), /import \{ composePaperDollPixels \} from '\.\.\/ui\/paperDoll\.js';/, 'the others compose through the door alone');
  assert.doesNotMatch(rd('src/net/remotePlayers.js'), /refreshPaperDoll|paperDollPixels\(|preloadPaperDoll/);
});
