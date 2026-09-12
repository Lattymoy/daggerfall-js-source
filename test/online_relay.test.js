// ONLINE1 (2026-09-12, Mac: "the basic bones of multiplayer"). THE
// RELAY'S LAW EXECUTES: what a client may say (a hello once and first,
// a pose after it, nothing else), the pose's bounds, the look's
// bounds, the room key's shape, the world's cell shard and the range a
// pose travels inside it, the rate gate's bucket, and what a joiner is
// told. Mutants: the range widened to the whole cell, the gate that
// never refills, a pose relayed before hello.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_CELL, RANGE_PIXELS, POSE_HZ_MAX, PIXEL_UNITS, sanitizeName, validPose, validLook, roomOf, worldRoom, pixelOf, inRange, parseClient, poseGate, rosterFor,
} from '../server/src/relay.js';

test('ONLINE1: the client frames - hello once and first with an id and a look, a pose after it, ping any time, everything else an error', () => {
  const hello = JSON.stringify({ t: 'hello', id: 'abcd-1234', name: '  Mac <b>  ', look: { race: 'Redguard', gender: 'female', faceIndex: 3, items: [{ templateIndex: 102 }] }, pose: { x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0, mv: 1 } });
  const h = parseClient(hello);
  assert.equal(h.t, 'hello'); assert.equal(h.id, 'abcd-1234'); assert.equal(h.name, 'Mac <b>');
  assert.deepEqual(h.look, { race: 'Redguard', gender: 'female', faceIndex: 3, items: [{ templateIndex: 102 }] });
  assert.deepEqual(h.pose, { x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0, mv: 1 });
  assert.equal(parseClient(hello, { hasHello: true }).error, 'hello twice');
  assert.equal(parseClient(JSON.stringify({ t: 'pose', p: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 } })).error, 'pose before hello');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'pose', p: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 } }), { hasHello: true }), { t: 'pose', p: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 } });
  assert.equal(parseClient(JSON.stringify({ t: 'pose', p: { x: 'a' } }), { hasHello: true }).error, 'bad pose');
  assert.deepEqual(parseClient('{"t":"ping"}'), { t: 'ping' });
  assert.equal(parseClient('not json').error, 'not JSON');
  assert.equal(parseClient(JSON.stringify({ t: 'hello', id: 'x', look: {} })).error, 'bad id', 'ids are 4-40 of [A-Za-z0-9_-]');
  assert.equal(parseClient(JSON.stringify({ t: 'hello', id: 'abcd', look: null })).error, 'bad look');
  assert.equal(parseClient(JSON.stringify({ t: 'shout' })).error, 'unknown message');
  assert.equal(parseClient('x'.repeat(16 * 1024 + 1)).error, 'frame too large');
  assert.equal(parseClient(new Uint8Array(4)).error, 'text frames only');
});

test('ONLINE1: the bounds - a name printable and short, a pose finite and inside the world, a look with a known gender and at most the equip table\'s slots', () => {
  assert.equal(sanitizeName('  Sir Lancelot du Lac of Camelot the Brave  '), 'Sir Lancelot du Lac of C');
  assert.equal(sanitizeName(String.fromCharCode(9731)), 'Traveller'); assert.equal(sanitizeName(null), 'Traveller');
  assert.equal(validPose({ x: 1e8, y: 0, z: 0, yaw: 0, pitch: 0 }), null, 'past the world');
  assert.equal(validPose({ x: 0, y: NaN, z: 0, yaw: 0, pitch: 0 }), null);
  assert.deepEqual(validPose({ x: 1, y: 2, z: 3, yaw: 4, pitch: 5, mv: 'yes' }), { x: 1, y: 2, z: 3, yaw: 4, pitch: 5, mv: 1 });
  const look = validLook({ race: 'Nord', gender: 'other', faceIndex: 42.7, items: new Array(40).fill({ templateIndex: 1 }).concat([null, 'x']) });
  assert.equal(look.gender, 'male'); assert.equal(look.faceIndex, 9); assert.equal(look.items.length, 27);
  assert.deepEqual(validLook({}), { race: 'Breton', gender: 'male', faceIndex: 0, items: [] });
});

test('ONLINE1: the rooms - the key from the path, the world sharded into cells, a pose reaching only the peers within range inside a cell and everyone elsewhere (mutant: the range the whole cell)', () => {
  assert.equal(roomOf('/room/world:3,4'), 'world:3,4');
  assert.equal(roomOf('/room/town:Daggerfall/Daggerfall'), null, 'a slash is not a key character');
  assert.equal(roomOf('/room/town:17.Daggerfall'), 'town:17.Daggerfall');
  assert.equal(roomOf('/health'), null); assert.equal(roomOf('/room/'), null);
  assert.equal(WORLD_CELL, 16); assert.equal(RANGE_PIXELS, 3);
  assert.equal(worldRoom(0, 0), 'world:0,0'); assert.equal(worldRoom(15, 16), 'world:0,1'); assert.equal(worldRoom(400, 240), 'world:25,15');
  assert.deepEqual(pixelOf({ x: 32768 * 5 + 1, z: 32768 * 7 - 1 }), [5, 6]);
  assert.equal(PIXEL_UNITS, 32768, 'MapsFile world units per map pixel - streamingWorld.js NATIVE_PIXEL');
  const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
  assert.equal(inRange('world:0,0', at(5, 5), at(8, 8)), true, 'three pixels away, seen');
  assert.equal(inRange('world:0,0', at(5, 5), at(9, 5)), false, 'four away, not');
  assert.equal(inRange('world:0,0', at(5, 5), null), false, 'a peer with no pose yet hears nothing');
  assert.equal(inRange('town:17.Daggerfall', at(5, 5), at(900, 900)), true, 'a town hears everything');
  assert.equal(inRange('dungeon:17.Privateers_Hold', at(0, 0), null), true, 'a dungeon too, pose or not');
});

test('ONLINE1: the rate gate and the roster - a bucket of POSE_HZ_MAX a second that refills, a joiner told everyone else who has said hello (mutant: a gate that never refills)', () => {
  assert.equal(POSE_HZ_MAX, 20);
  let g = poseGate(null, 1000); assert.equal(g.pass, true);
  for (let i = 0; i < POSE_HZ_MAX - 1; i++) { g = poseGate(g.bucket, 1000); assert.equal(g.pass, true, `pose ${i + 2} of the burst`); }
  g = poseGate(g.bucket, 1000); assert.equal(g.pass, false, 'the twenty-first in the same instant is dropped');
  g = poseGate(g.bucket, 1100); assert.equal(g.pass, true, 'a tenth of a second refills two');
  g = poseGate(g.bucket, 1100); assert.equal(g.pass, true); g = poseGate(g.bucket, 1100); assert.equal(g.pass, false);
  const peers = [{ id: 'a', name: 'A', look: {}, pose: null }, { id: null }, { id: 'b', name: 'B', look: { race: 'Nord' }, pose: { x: 1 } }, { id: 'me', name: 'Me' }];
  assert.deepEqual(rosterFor(peers, 'me'), [{ id: 'a', name: 'A', look: {}, pose: null }, { id: 'b', name: 'B', look: { race: 'Nord' }, pose: { x: 1 } }], 'the unhello\'d and myself left out');
});
