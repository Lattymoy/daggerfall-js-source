// HCC-PARK + RIDE + HCC-TIP (2026-09-23, Mac: "I think we should build that. And if not already, ensure this is
// compatible with our tooltip implementation and ensure it shows owned if another players. Also need to ensure over
// people see others riding on horses"). BY EXECUTION: the wire's park law and the pose's mount; the RELAY keeping a
// parked team in its cell past its owner's presence, handing it to joiners, and the owner's registry dropping the old
// cell's record from wherever the owner speaks (a world of fake rooms over the real Room); the pool merging the
// live word and the kept one per part and naming the owner from the relay's stamp when they are away; the owner's
// park word off the save record; the riders layer drawing a peer in the saddle as Eye Of The Beholder's mounted
// sprite. `06-Systems/Horse-Cart-And-Cargo.md` HCC-PARK.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validParkData, cellRoomOfWire, relaySupportsPark, validPose, poseChanged, parseClient, PARK_CELL_MAX, PARK_TTL_MS, PIXEL_UNITS,
  parkRegistryRoom, POSE_RIDE,
} from '../src/net/wire.js';
import { lerpPose } from '../src/net/online.js';
import { fakeRooms, fakeRoom } from './fakeRoom.mjs';
import { createHorseCartPool, ownedLine } from '../src/scenes/horseCartPool.js';
import { WAGON_MODE, HORSE_MODE } from '../src/systems/horseCartLaw.js';
import { createPeerRiders, rideTable, RIDER_NAME_HEIGHT } from '../src/net/peerRiders.js';
import { ARCHIVE_HORSE } from '../src/player/eotbBillboard.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// a team in map pixel (100, 150): cell world:6,9
const AX = 100 * PIXEL_UNITS + 1000, AZ = (499 - 150) * PIXEL_UNITS + 1000;
const X = 'world:6,9', Y = 'world:7,9';
const W = (x = AX, z = AZ) => [2, x, 1, z, 0, 0, 0, 1, 50, 0];
const H = (x = AX + 120, z = AZ) => [x, 1, z, 0, 1, 0];

test('HCC-PARK wire: the anchor names the cell (MapsFile\'s pixel, then the cell); the door keeps a DEPLOYED wagon and a STANDING horse near their anchor, and nothing else', () => {
  assert.equal(cellRoomOfWire(AX, AZ), X);
  assert.equal(cellRoomOfWire(AX + 16 * PIXEL_UNITS, AZ), Y);
  const v = validParkData({ a: [AX, AZ], r: { w: W(), h: H(), n: 'Be‮ss' } });
  assert.deepEqual(v, { a: [AX, AZ], r: { w: W(), h: H(), n: 'Bess' } }, 'the name through the label door');
  assert.deepEqual(validParkData({ a: [AX, AZ] }), { a: [AX, AZ] }, 'the anchor alone: a word about WHERE');
  assert.equal(validParkData({ a: [AX, AZ], r: { w: [1, AX, 1, AZ, 0, 0, 0, 1, 50, 0] } }), null, 'a trailing wagon is not parked');
  assert.equal(validParkData({ a: [AX, AZ], r: { h: [AX, 1, AZ, 0, 1, 1] } }), null, 'a walking horse is not parked');
  assert.equal(validParkData({ a: [AX, AZ], r: { w: W(AX + 20000) } }), null, 'a part far from its anchor is a second place');
  assert.equal(validParkData({ a: [-1, AZ] }), null); assert.equal(validParkData({ a: [AX] }), null);
  assert.equal(validParkData({ a: [AX, AZ], r: { n: 'Bess' } }), null, 'a name with nothing parked');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'park', data: null }), { hasHello: true }), { t: 'park', data: null });
  assert.equal(parseClient(JSON.stringify({ t: 'park', data: null })).error, 'park before hello');
  assert.equal(parseClient(JSON.stringify({ t: 'park', data: { a: 'x' } }), { hasHello: true }).error, 'bad park');
  assert.equal(relaySupportsPark('world97'), false, 'an older relay closes the socket on the frame - never sent to it');
  assert.equal(relaySupportsPark('world98'), true);
});

test('RIDE wire: the pose carries the mount (1 the horse, 2 the cart) and the sprite set, OMITTED on foot so a pose on foot is the bytes it always was; a mount is a change; the drawn pose keeps it', () => {
  const foot = validPose({ x: 1, y: 2, z: 3, yaw: 0, pitch: 0 });
  assert.equal('rd' in foot, false); assert.equal('rv' in foot, false);
  assert.deepEqual(Object.keys(validPose({ x: 1, y: 2, z: 3, yaw: 0, pitch: 0, rd: 0, rv: 3 })), Object.keys(foot), 'rd 0 is on foot: no fields');
  const horse = validPose({ x: 1, y: 2, z: 3, yaw: 0, pitch: 0, rd: 1, rv: 9 });
  assert.equal(horse.rd, POSE_RIDE.Horse); assert.equal(horse.rv, 4, 'the sprite set clamped to the five');
  assert.equal(validPose({ x: 1, y: 2, z: 3, yaw: 0, pitch: 0, rd: 7 }).rd, POSE_RIDE.Cart, 'clamped');
  assert.ok(poseChanged(foot, horse), 'mounting goes out at once');
  assert.ok(poseChanged(horse, { ...horse, rv: 1 }));
  assert.equal(lerpPose(foot, horse, 0.5).rd, 1); assert.equal('rd' in lerpPose(horse, foot, 0.5), false, 'a dismount drawn at once');
});

/** A cell world over the real Room. */
async function world() {
  const w = fakeRooms();
  // each word a second apart, as the client sends them (PARK_HZ_MAX's burst is pinned below on its own)
  const park = (name, ws, data) => { const r = w.room(name); ws.att = { ...ws.att, parkBucket: null }; r.room._idx = null; return r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data })); };
  const join = async (name, id) => { const r = w.room(name); const ws = r.connect(); await r.hello(ws, id); return ws; };
  return { w, park, join };
}
const framesOf = (ws, t) => ws.sent.filter((f) => f.t === t);

test('HCC-PARK relay: the cell KEEPS a parked team past its owner - stored from a socket in that cell, fanned, handed to a joiner with the owner\'s verified name, standing after the owner has gone', async () => {
  const { w, park, join } = await world();
  const ann = await join(X, 'ann1');
  const bob = await join(X, 'bob1');
  await park(X, ann, { a: [AX, AZ], r: { w: W(), h: H(), n: 'Bess' } });
  const kept = w.room(X).store.get('park:ann1');
  assert.deepEqual(kept.r, { w: W(), h: H(), n: 'Bess' }); assert.equal(kept.name, 'ann1', 'the socket\'s own name, never the frame\'s');
  assert.deepEqual(framesOf(bob, 'park').at(-1), { t: 'park', id: 'ann1', name: 'ann1', data: { w: W(), h: H(), n: 'Bess' } });
  assert.equal(w.made.get(parkRegistryRoom('ann1')).store.get('reg'), X, 'the owner\'s registry knows the cell');
  // the owner walks into a shop: their socket goes - the team does not
  await w.room(X).drop(ann);
  const cid = await join(X, 'cid1');
  assert.deepEqual(framesOf(cid, 'parks')[0].data.map((e) => [e.id, e.name]), [['ann1', 'ann1']], 'a joiner is handed the team whose owner is away');
});

test('HCC-PARK relay: the REGISTRY drops the old cell\'s record from wherever the owner speaks - a null from another cell, a team re-parked in another; a word ABOUT another cell stores nothing (mutants: the registry skipped - a ghost wagon; a record planted from outside its cell)', async () => {
  const { w, park, join } = await world();
  const ann = await join(X, 'ann1');
  const bob = await join(X, 'bob1');
  await park(X, ann, { a: [AX, AZ], r: { w: W() } });
  await w.room(X).drop(ann);
  // the owner is in the next cell now, and rides off with the team (nothing parked): the old cell hears it
  const annY = await join(Y, 'ann1');
  await park(Y, annY, null);
  assert.equal(w.room(X).store.has('park:ann1'), false, 'dropped by the registry, from another room');
  assert.deepEqual(framesOf(bob, 'park').at(-1), { t: 'park', id: 'ann1', data: null });
  assert.equal(w.made.get(parkRegistryRoom('ann1')).store.has('reg'), false);
  // parked again in X (from X), then summoned and parked in Y (from Y): X's goes, Y's stands
  const ann2 = await join(X, 'ann1');
  await park(X, ann2, { a: [AX, AZ], r: { w: W() } });
  const YX = AX + 16 * PIXEL_UNITS;
  await park(Y, annY, { a: [YX, AZ], r: { w: W(YX) } });
  assert.equal(w.room(X).store.has('park:ann1'), false, 'the old cell\'s record goes');
  assert.ok(w.room(Y).store.has('park:ann1'), 'the new cell keeps it');
  // a record said THROUGH Y about a team in X is a word about where - Y drops its own, X stores nothing it did not hear
  await park(Y, annY, { a: [AX, AZ], r: { w: W() } });
  assert.equal(w.room(Y).store.has('park:ann1'), false);
  assert.equal(w.room(X).store.has('park:ann1'), false, 'nothing planted from outside the cell');
  assert.equal(w.made.get(parkRegistryRoom('ann1')).store.get('reg'), X);
  // and the anchor alone in the cell that keeps it changes nothing (the owner walked out of sight of their wagon)
  await park(X, ann2, { a: [AX, AZ], r: { w: W() } });
  await park(X, ann2, { a: [AX, AZ] });
  assert.ok(w.room(X).store.has('park:ann1'), 'the cell keeps what it has');
});

test('HCC-PARK relay: the cell drops its own superseded record ITSELF - a null, or the team standing elsewhere - so a relay with no registry binding (a local dev worker) still keeps no ghost (mutant: the drop left to the registry alone)', async () => {
  const r = fakeRoom(X);   // no ROOMS: the registry is unreachable
  const ws = r.connect(); await r.hello(ws, 'ann1');
  const say = (data) => { ws.att = { ...ws.att, parkBucket: null }; r.room._idx = null; return r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data })); };
  await say({ a: [AX, AZ], r: { w: W() } });
  assert.ok(r.store.has('park:ann1'));
  await say(null);
  assert.equal(r.store.has('park:ann1'), false, 'nothing parked');
  await say({ a: [AX, AZ], r: { w: W() } });
  await say({ a: [AX + 16 * PIXEL_UNITS, AZ] });
  assert.equal(r.store.has('park:ann1'), false, 'it stands in another cell now');
});

test('HCC-PARK relay: the park bucket - PARK_HZ_MAX words a second a socket, the rest dropped unread (mutant: an unmetered door)', async () => {
  const w = fakeRooms();
  const r = w.room(X);
  const ws = r.connect(); await r.hello(ws, 'ann1');
  for (let i = 0; i < 3; i++) await r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data: { a: [AX, AZ], r: { w: W(AX + i) } } }));
  assert.equal(r.store.get('park:ann1').r.w[1], AX + 1, 'the third word in the same instant was not taken');
});

test('HCC-PARK relay: bounded - PARK_TTL_MS since the owner last said it, PARK_CELL_MAX a cell with the stalest out', async () => {
  const { w, join } = await world();
  const X0 = w.room(X);
  await X0.room._parkStore('old1', 'Old', { w: W() }, Date.now() - PARK_TTL_MS - 1);
  const joiner = await join(X, 'new1');
  assert.equal(framesOf(joiner, 'parks').length, 0, 'an expired record is handed to nobody');
  assert.equal(X0.store.has('park:old1'), false, 'and swept');
  const base = Date.now();
  for (let i = 0; i <= PARK_CELL_MAX; i++) await X0.room._parkStore(`own${String(i).padStart(2, '0')}`, '', { w: W() }, base + i);
  const keys = [...X0.store.keys()].filter((k) => k.startsWith('park:'));
  assert.equal(keys.length, PARK_CELL_MAX);
  assert.equal(keys.includes('park:own00'), false, 'the stalest went');
});

/** A runtime whose save record and view the test sets. */
function rt(state, view = {}) {
  return { view: () => ({ state, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, ...view }), lateUpdate() {}, horseTargetLabel: 'Bess' };
}
const deployed = (pos) => ({ isGrounded: true, position: pos, rotation: [0, 0, 0, 1], cargoTier: 50 });

test('HCC-PARK pool: MY word is off the SAVE record - parked whether or not it is drawn; the record rides only when it is shown; nothing parked, the switch off or persistence off is null', () => {
  const toWire = (p) => [p[0] + AX, p[1], p[2] + AZ];
  const state = { Mode: WAGON_MODE.Deployed, WorldX: AX, WorldZ: AZ, HorseMode: HORSE_MODE.HitchedToWagon, HorseWorldX: 0, HorseWorldZ: 0, HorseName: 'Bess' };
  const pool = createHorseCartPool({ renderer: null, meshes: null });
  pool.attach(rt(state));
  assert.deepEqual(pool.parkWord(toWire), { a: [AX, AZ] }, 'indoors, far off: the anchor, never "nothing"');
  pool.attach(rt(state, { deployed: deployed([0, 1, 0]), horse: { isInteractive: true, position: [3.1, 1, 0], forward: [0, 0, 1], walk: { walking: false } } }));
  const w = pool.parkWord(toWire);
  assert.deepEqual(w.a, [AX, AZ]); assert.equal(w.r.w[0], 2); assert.equal(w.r.h[5], 0); assert.equal(w.r.n, 'Bess');
  assert.deepEqual(validParkData(w), w, 'my word passes the relay\'s own door');
  pool.attach(rt({ ...state, Mode: WAGON_MODE.WithPlayer, HorseMode: HORSE_MODE.WithPlayer }));
  assert.equal(pool.parkWord(toWire), null, 'ridden off: nothing parked');
  pool.attach(rt(state, { persistence: false }));
  assert.equal(pool.parkWord(toWire), null, 'persistence off: nothing stays in the world');
  pool.attach(rt({ ...state, Mode: WAGON_MODE.WithPlayer, HorseMode: HORSE_MODE.LooseStationary, HorseWorldX: AX + 50, HorseWorldZ: AZ }));
  assert.deepEqual(pool.parkWord(toWire).a, [AX + 50, AZ], 'a loose horse alone anchors on itself');
  pool.setEnabled(false);
  assert.equal(pool.parkWord(toWire), null, 'the switch off: a mod never loaded parks nothing');
});

test('HCC-PARK pool + HCC-TIP: the cell\'s kept team stands when its owner is away and is named by the relay\'s stamp; the live word wins PER PART; a room I left takes its kept teams (mutants: the sweep taking the kept team; the plaque with no owner)', () => {
  const names = { p1: 'Ann' };
  const pool = createHorseCartPool({ renderer: null, meshes: null, collider: () => null, selfId: () => 'me', peerName: (id) => names[id] ?? null });
  pool.attach(rt({ Mode: 0 }));
  const toScene = (p) => [p[0] - AX, p[1], p[2] - AZ];
  pool.replaceKept(X, [{ id: 'p1', name: 'Ann', r: { w: W(), h: H(), n: 'Bess' } }, { id: 'me', name: 'Me', r: { w: W() } }], toScene);
  assert.deepEqual([...pool.peers.keys()], ['p1'], 'never my own');
  assert.deepEqual(pool.peers.get('p1').wagon.position, [0, 1, 0]);
  assert.equal(pool.peers.get('p1').kept, true);
  // the owner walks in, their live word says only a horse by them (the wagon is out of their sight): the wagon stays
  pool.applyOwner('p1', { h: [AX + 500, 1, AZ, 0, 1, 1] }, toScene, 1);
  assert.deepEqual(pool.peers.get('p1').horse.position, [500, 1, 0], 'the live horse wins');
  assert.deepEqual(pool.peers.get('p1').wagon.position, [0, 1, 0], 'the kept wagon stands');
  // the owner goes indoors: the live word is swept, the team stands off the memory
  pool.sweepOwners(new Set(), 10, 1);
  assert.deepEqual(pool.peers.get('p1').horse.position, [120, 1, 0]);
  // HCC-TIP: named - by the session while they are here, by the relay's stamp when they are not
  assert.deepEqual(pool.hoverName('hccPeer:p1:w'), { title: 'Wagon', subs: ['Owned by Ann'] });
  delete names.p1;
  pool.applyKept(X, 'p1', 'Ann (away)', { w: W(), h: H(), n: 'Bess' }, toScene);
  assert.deepEqual(pool.hoverName('hccPeer:p1:h'), { title: 'Bess', subs: ['Owned by Ann (away)'] });
  assert.equal(ownedLine(null), 'Owned by another player');
  // the cell says it is gone; and a room I no longer hold takes what it kept
  pool.applyKept(X, 'p1', 'Ann', null, toScene);
  assert.equal(pool.peers.size, 0);
  pool.replaceKept(Y, [{ id: 'p2', name: 'Cid', r: { w: W() } }], toScene);
  pool.pruneKept([X]);
  assert.equal(pool.peers.size, 0, 'the halo cell let go');
  // a kept record that is not a parked one is refused at the door
  assert.equal(pool.applyKept(X, 'p3', 'Dee', { w: [1, AX, 1, AZ, 0, 0, 0, 1, 50, 0] }, toScene), false);
});

test('RIDE: a peer in the saddle is Eye Of The Beholder\'s mounted sprite - their own set, the table off the move bit, a bottom-anchored batch at their feet; the other layers stand nothing for them; the dismount takes it', async () => {
  const made = [], gone = [], uploads = [];
  const renderer = {
    uploadTexture: (a, rec) => uploads.push(`${a}:${rec}`),
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, origin: null }; made.push(b); return b; },
    destroyBillboardBatch: (b) => gone.push(b),
  };
  const riders = createPeerRiders({ renderer, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 64, height: 80, colors: new Uint32Array(64 * 80) }) });
  const peer = { id: 'p1', shown: true, pose: { x: 10, y: 0, z: 5, yaw: 0, pitch: 0, mv: 1, rd: 1, rv: 2 } };
  const toScene = (p) => [p.x, p.y, p.z];
  riders.sync([peer, { id: 'p2', shown: true, pose: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 } }], toScene, { eye: [10, 1, 20], dt: 0.01 });
  assert.equal(riders.isRiding('p1'), true); assert.equal(riders.isRiding('p2'), false, 'on foot: the doll and the body as before');
  assert.equal(riders.heightOf('p1'), RIDER_NAME_HEIGHT); assert.equal(riders.heightOf('p2'), 0);
  await new Promise((r) => setTimeout(r, 5));
  riders.sync([peer], toScene, { eye: [10, 1, 20], dt: 0.01 });
  assert.equal(riders.batches().length, 1);
  const b = riders.batches()[0];
  assert.equal(b.archive, ARCHIVE_HORSE + 2, 'the rider\'s own mounted sprite set');
  assert.equal(rideTable(1), 'MoveHorse'); assert.equal(rideTable(2), 'GallopHorse'); assert.equal(rideTable(0), 'IdleHorse');
  assert.ok(Math.abs(b.origin[1] - 0) < 1 && Math.abs(b.origin[2] - 5) < 1, `at the feet: ${b.origin}`);
  assert.ok(uploads.some((u) => u.startsWith(`${ARCHIVE_HORSE + 2}:`)));
  riders.sync([{ ...peer, pose: { ...peer.pose, rd: undefined } }], toScene, { eye: [10, 1, 20], dt: 0.01 });
  assert.equal(riders.isRiding('p1'), false); assert.equal(gone.length >= 1, true, 'the dismount frees the batch');
});

test('HCC-PARK / RIDE hosts: the owner\'s word is ticked with the frame\'s out-words (after the stream, the flushes and the seat) and routed to the team\'s cell; a kept team is its cell\'s; the rider layer runs first and hands the others the rider\'s height; the pose sends the mount', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /modes\?\.setDungeonAuthority\?\.\(dungeonAuthority\(now\)\);[^\n]*\n\s+hccParkTick\(now\);/);   // after the stream, the flushes and the seat - the frame's out-words, in order
  assert.match(w, /const via = online\.sendPark\(word, cell\);/);
  assert.match(w, /online\.onPark = \(room, id, name, r\) => hcc\.applyKept\(room, id, name, r, campToScene\);/);
  assert.match(w, /online\.onParks = \(room, list\) => hcc\.replaceKept\(room, list, campToScene\);/);
  assert.match(w, /hcc\.pruneKept\(isCellRoom\(online\.room\) \? \[online\.room, \.\.\.online\.haloRooms\(\)\] : \[\]\);/);
  assert.match(w, /peerRiders\.sync\(drawable, onlineToScene,[^\n]*\n\s+const afoot = drawable\.filter\(\(d\) => !peerRiders\.isRiding\(d\.id\)\);\n\s+peerBodies\.sync\(afoot,/);
  assert.match(w, /bodyHeight: \(id\) => peerRiders\.heightOf\(id\) \|\| peerBodies\.heightOf\(id\)/);
  assert.match(w, /rd: \(modes\?\.mode \?\? 'exterior'\) !== 'exterior' \? 0 : player\.transportMode === TRANSPORT_MODES\.Horse \? 1 : player\.transportMode === TRANSPORT_MODES\.Cart \? 2 : 0,/);
  const s = rd('server/src/index.js');
  assert.match(s, /if \(path === PARK_INTERNAL_REG \|\| path === PARK_INTERNAL_DROP\) return this\._parkInternal\(path, request\);/);
  assert.match(s, /if \(m\.data\?\.r && cell === here\) await this\._parkStore\(owner, a\.name \?\? '', m\.data\.r, now\);/);
});
