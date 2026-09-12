// ONLINE1 (2026-09-12, Mac: "the basic bones of multiplayer"). THE
// CLIENT EXECUTES: the room key from what a host knows (the world's
// cell, a town, a dungeon, an interior - the relay's own shard size,
// held equal to the server's), the pose's change test, the easing
// between poses (the yaw by the shorter arc), the screen projection
// under the hosts' own matrices, the peer id minted once; the session
// driven over a fake socket - hello on open, a pose at most POSE_HZ and
// only when moved, the welcome's roster, join/leave/pose, a peer eased
// toward its last pose and dropped when silent, a room change closing
// the socket, reconnect backoff; the look composed off an equip table
// and the stub entity that stands in for a peer. Mutants: the shard
// size drifting from the relay's, a pose sent every frame, the yaw
// eased the long way round.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  POSE_HZ, WORLD_CELL, PEER_TIMEOUT_MS, BACKOFF_MIN_MS, BACKOFF_MAX_MS, DEFAULT_SERVER, slug, worldRoom, roomKeyFor, poseChanged, lerpPose, peerId, OnlineSession,
} from '../src/net/online.js';
import { WORLD_CELL as RELAY_CELL, roomOf, worldRoom as relayWorldRoom } from '../server/src/relay.js';
import { composeLook, lookKey, peerStubEntity, LOOK_ITEM_FIELDS, PEER_ARCHIVE, PEER_HEIGHT, PEER_WIDTH } from '../src/net/remotePlayers.js';
import { createEquipTable } from '../src/characters/equipTable.js';
import { CAPSULE_HEIGHT } from '../src/player/motor.js';
import { PAPERDOLL_W, PAPERDOLL_H } from '../src/ui/paperDoll.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A fake WebSocket class: records what was sent, lets the test drive the events. */
function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; this.onclose?.({ code, reason }); }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
    drop() { this.onclose?.({ code: 1006, reason: '' }); }
  }
  return { FakeWS, sockets };
}

test('ONLINE1: the room key - the world by cell (the relay\'s own shard), a town, a dungeon and an interior by location, every key one the relay admits (mutant: WORLD_CELL drifting from the relay\'s)', () => {
  assert.equal(WORLD_CELL, RELAY_CELL, 'one shard size, both ends');
  assert.equal(worldRoom(400, 240), relayWorldRoom(400, 240));
  assert.equal(roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: { x: 400, y: 240 } }), 'world:25,15');
  assert.equal(roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: null }), null, 'no pixel yet, no room');
  assert.equal(roomKeyFor({ host: 'exterior', mode: 'exterior', regionIndex: 17, locationName: 'Daggerfall' }), 'town:17.Daggerfall');
  assert.equal(roomKeyFor({ host: 'world', mode: 'dungeon', regionIndex: 17, locationName: "Privateer's Hold" }), 'dungeon:17.Privateer_s_Hold');
  assert.equal(roomKeyFor({ host: 'world', mode: 'interior', regionIndex: 17, locationName: 'Daggerfall', buildingKey: 4021 }), 'interior:17.Daggerfall.4021');
  assert.equal(roomKeyFor({ host: 'exterior', mode: 'interior', regionIndex: 1, locationName: 'Wayrest', buildingKey: 7 }), 'interior:1.Wayrest.7', 'the fixed city\'s interiors are the same rooms');
  for (const k of ['world:25,15', 'town:17.Daggerfall', 'dungeon:17.Privateer_s_Hold', 'interior:17.Daggerfall.4021']) assert.equal(roomOf('/room/' + k), k, `${k} is a key the relay admits`);
  assert.equal(slug('The Sanctum of Ilyn / Mother\'s'), 'The_Sanctum_of_Ilyn_Mother_s'); assert.equal(slug(''), 'x');
  assert.equal(slug('x'.repeat(60)).length, 40);
});

test('ONLINE1: the pose - changed past a hair, eased between two with the yaw by the shorter arc; a point projected to the screen under the hosts\' mirrored projection (mutant: the long way round)', () => {
  const a = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 };
  assert.equal(poseChanged(a, { ...a }), false); assert.equal(poseChanged(a, { ...a, x: 0.005 }), false, 'a hair is not a move');
  assert.equal(poseChanged(a, { ...a, x: 0.02 }), true); assert.equal(poseChanged(a, { ...a, yaw: 0.02 }), true); assert.equal(poseChanged(a, { ...a, mv: 1 }), true);
  assert.equal(poseChanged(null, a), true);
  const m = lerpPose({ ...a, x: 0, yaw: 0.1 }, { ...a, x: 10, yaw: 2 * Math.PI - 0.1, mv: 1 }, 0.5);
  assert.equal(m.x, 5); assert.ok(Math.abs(m.yaw - 0) < 1e-9, 'from 0.1 to -0.1 (spelled 2pi - 0.1): through zero, not round the back'); assert.equal(m.mv, 1);
  assert.deepEqual(lerpPose(null, a, 0.3), a, 'no from: the target');
  assert.equal(lerpPose(a, { ...a, x: 10 }, 2).x, 10, 'clamped past one');
  // the projection is player/tapRay.js's one (audit24 onehome; pinned in touchinput.test.js) - the name pass reads its `front`
  const rp = readFileSync(new URL('../src/net/remotePlayers.js', import.meta.url), 'utf8');
  assert.match(rp, /import \{ projectToScreen \} from '\.\.\/player\/tapRay\.js'/, 'one home for the projection');
  assert.match(rp, /projectToScreen\(\[f\[0\], f\[1\] \+ PEER_HEIGHT \+ 0\.25, f\[2\]\], w, h, proj, view\);\n\s*if \(!s\.front/, 'the name sits over the head and hides behind the eye');
  // the id: minted once, kept
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const id = peerId(storage); assert.match(id, /^[A-Za-z0-9_-]{4,40}$/); assert.equal(peerId(storage), id, 'the same id next time');
  assert.match(DEFAULT_SERVER, /^wss:\/\/daggerfall-online\./, 'the relay this port hosts');
});

test('ONLINE1: the session over a fake socket - hello on open, a pose at most POSE_HZ and only when moved, the roster, join, pose, leave, easing, the silent peer dropped, a room change, reconnect backoff (mutant: a pose every frame)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 2, items: [] }, id: 'mac-0001', WebSocketImpl: FakeWS, now: () => now });
  const pose = (x) => ({ x, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 });
  s.join('world:25,15', pose(0));
  assert.equal(sockets.length, 1); assert.equal(sockets[0].url, 'wss://relay.test/room/world:25,15', 'the trailing slash trimmed, the room in the path');
  assert.equal(s.status, 'connecting');
  assert.equal(s.sendPose(pose(1)), false, 'nothing goes before the socket opens');
  sockets[0].open();
  assert.equal(s.status, 'open');
  assert.deepEqual(sockets[0].sent[0], { t: 'hello', id: 'mac-0001', name: 'Mac', look: { race: 'Nord', gender: 'male', faceIndex: 2, items: [] }, pose: pose(1) }, 'the hello carries the latest pose');
  assert.equal(s.sendPose(pose(2)), true); now += 20; assert.equal(s.sendPose(pose(3)), false, 'twenty ms later: throttled');
  now += 100; assert.equal(s.sendPose(pose(3)), true, 'a tenth of a second: sent'); now += 100; assert.equal(s.sendPose(pose(3)), false, 'unmoved: not sent');
  assert.equal(sockets[0].sent.filter((m) => m.t === 'pose').length, 2); assert.equal(POSE_HZ, 10);
  // the roster, a join, a pose, easing, a leave
  let changes = 0; s.onPeers = () => changes++;
  sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0001', name: 'Bob', look: {}, pose: pose(10) }, { id: 'mac-0001', name: 'me' }] });
  assert.equal(s.peers.size, 1, 'myself left out'); assert.equal(changes, 1);
  sockets[0].receive({ t: 'join', id: 'eve-0001', name: 'Eve', look: {}, pose: null });
  assert.equal(s.peers.size, 2); assert.equal(s.drawable().length, 1, 'a peer without a pose is not drawn yet');
  sockets[0].receive({ t: 'pose', id: 'bob-0001', p: pose(20) });
  s.tick(now + 50); assert.ok(Math.abs(s.peers.get('bob-0001').shown.x - 15) < 1e-9, 'half an interval on: halfway from 10 to 20');
  s.tick(now + 100); assert.equal(s.peers.get('bob-0001').shown.x, 20);
  sockets[0].receive({ t: 'leave', id: 'eve-0001' }); assert.equal(s.peers.size, 1);
  now += PEER_TIMEOUT_MS + 1; s.tick(now); assert.equal(s.peers.size, 0, 'silent past the timeout: dropped');
  // a room change: the socket closes, a new one opens on the new room
  s.join('dungeon:17.Privateer_s_Hold', pose(0));
  assert.equal(sockets[0].closed.code, 1000); assert.equal(sockets.length, 2); assert.equal(sockets[1].url, 'wss://relay.test/room/dungeon:17.Privateer_s_Hold');
  assert.equal(s.join('dungeon:17.Privateer_s_Hold'), undefined); assert.equal(sockets.length, 2, 'the same room again: no new socket');
  // a drop reconnects with backoff
  sockets[1].open(); sockets[1].drop(); assert.equal(s.status, 'closed');
  s.tick(now + BACKOFF_MIN_MS - 1); assert.equal(sockets.length, 2, 'not before the backoff');
  s.tick(now + BACKOFF_MIN_MS + 1); assert.equal(sockets.length, 3, 'then a new socket'); assert.equal(s.stats.reconnects, 1);
  sockets[2].drop(); now += BACKOFF_MIN_MS * 2 + 2; s.tick(now); assert.equal(sockets.length, 4, 'the backoff doubles');
  assert.ok(BACKOFF_MAX_MS >= BACKOFF_MIN_MS * 4);
  s.leave(); assert.equal(s.room, null); assert.equal(s.status, 'closed'); const n = sockets.length; s.tick(now + 60000); assert.equal(sockets.length, n, 'left: no reconnect');
});

test('ONLINE1: the look and the stub - the equipped items\' doll fields off the equip table, one key per look, a stand-in entity with the items in their slots; the doll\'s size is the player\'s capsule', () => {
  const entity = { race: 'Redguard', gender: 'female', faceIndex: 4, equip: createEquipTable() };
  entity.equip.slots[3] = { templateIndex: 102, group: 5, material: 2, dye: 3, variant: 1, equipSlot: 3, currentCondition: 40, name: 'x' };
  entity.equip.slots[10] = { templateIndex: 20, group: 1, equipSlot: 10, uid: 99 };
  const look = composeLook(entity);
  assert.deepEqual(look, { race: 'Redguard', gender: 'female', faceIndex: 4, items: [{ templateIndex: 102, group: 5, material: 2, dye: 3, variant: 1, equipSlot: 3 }, { templateIndex: 20, group: 1, equipSlot: 10 }] }, 'the doll\'s fields, nothing else');
  assert.deepEqual(LOOK_ITEM_FIELDS, ['templateIndex', 'group', 'material', 'dye', 'variant', 'equipSlot']);
  assert.deepEqual(composeLook(null), { race: 'Breton', gender: 'male', faceIndex: 0, items: [] });
  assert.equal(lookKey(look), lookKey(JSON.parse(JSON.stringify(look)))); assert.notEqual(lookKey(look), lookKey({ ...look, faceIndex: 5 }));
  const stub = peerStubEntity(look);
  assert.equal(stub.race, 'Redguard'); assert.equal(stub.equip.slots[3].templateIndex, 102); assert.equal(stub.equip.slots[10].templateIndex, 20);
  assert.equal(stub.items.length, 2); assert.deepEqual(stub.activeEffects, [], 'no racial override on a peer');
  assert.equal(peerStubEntity({ items: [{ templateIndex: 1, equipSlot: 99 }] }).equip.slots.filter(Boolean).length, 0, 'a slot past the table is not written');
  assert.equal(PEER_HEIGHT, CAPSULE_HEIGHT); assert.ok(Math.abs(PEER_WIDTH - PEER_HEIGHT * PAPERDOLL_W / PAPERDOLL_H) < 1e-12); assert.ok(PEER_ARCHIVE > 100000);
  // the compositor's new door: a doll without its panel background
  assert.match(rd('src/ui/paperDoll.js'), /export async function refreshPaperDoll\(entity, \{ background = true \} = \{\}\)/);
  assert.match(rd('src/ui/paperDoll.js'), /for \(let y = 0; background && y < PAPERDOLL_H; y\+\+\) \{/, 'the background loop is skipped, the panel stays clear');
});
