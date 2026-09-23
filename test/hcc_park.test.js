// HCC-PARK + RIDE + HCC-TIP (2026-09-23, Mac: "I think we should build that. And if not already, ensure this is
// compatible with our tooltip implementation and ensure it shows owned if another players. Also need to ensure over
// people see others riding on horses"), AND THE BRANCH AUDIT'S FINDINGS ON THEM (Mac: "Let's do an audit on
// everything before we merge. This needs to be perfect"). BY EXECUTION: the wire's park law and the pose's mount; the
// RELAY keeping a parked team in its cell past its owner's presence, keyed by the ACCOUNT the token verified and the
// CHARACTER the frame names (never the peer id a client picks), handing it to joiners, the owner's registry dropping
// the old cell's record in the order the words were said; the pool keeping each cell's word apart and a kept team
// under its own key, a live part standing it down only where it stands; the owner's park word off the save record;
// the riders layer drawing a peer in the saddle as Eye Of The Beholder's mounted sprite off the SHOWN pose.
// `06-Systems/Horse-Cart-And-Cargo.md` HCC-PARK and AUDIT BRANCH.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validParkData, cellRoomOfWire, relaySupportsPark, validPose, poseChanged, parseClient, PARK_CELL_MAX, PARK_ACCOUNT_MAX, PARK_TTL_MS, PIXEL_UNITS,
  parkRegistryRoom, parkKeyOf, parkKey, POSE_RIDE,
} from '../src/net/wire.js';
import { lerpPose } from '../src/net/online.js';
import { fakeRooms, fakeRoom } from './fakeRoom.mjs';
import { createHorseCartPool, ownedLine } from '../src/scenes/horseCartPool.js';
import { WAGON_MODE, HORSE_MODE } from '../src/systems/horseCartLaw.js';
import { createPeerRiders, rideTable, RIDER_RETRY_MS } from '../src/net/peerRiders.js';
import { ARCHIVE_HORSE } from '../src/player/eotbBillboard.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// a team in map pixel (100, 150): cell world:6,9
const AX = 100 * PIXEL_UNITS + 1000, AZ = (499 - 150) * PIXEL_UNITS + 1000;
const X = 'world:6,9', Y = 'world:7,9';
const W = (x = AX, z = AZ) => [2, x, 1, z, 0, 0, 0, 1, 50, 0];
const H = (x = AX + 120, z = AZ) => [x, 1, z, 0, 1, 0];
const CA = 'char-ann-0001', CA2 = 'char-ann-0002', CB = 'char-bob-0001';
const K = (acct, c) => parkKeyOf(acct, c);

test('HCC-PARK wire: the frame names its CHARACTER; the anchor names the cell (MapsFile\'s pixel, then the cell); the door keeps a DEPLOYED wagon and a STANDING horse near their anchor, a unit facing, and nothing else', async () => {
  assert.equal(cellRoomOfWire(AX, AZ), X);
  assert.equal(cellRoomOfWire(AX + 16 * PIXEL_UNITS, AZ), Y);
  const v = validParkData({ c: CA, a: [AX, AZ], r: { w: W(), h: H(), n: 'Be‮ss' } });
  assert.deepEqual(v, { c: CA, a: [AX, AZ], r: { w: W(), h: H(), n: 'Bess' } }, 'the name through the label door');
  assert.deepEqual(validParkData({ c: CA, a: [AX, AZ] }), { c: CA, a: [AX, AZ] }, 'the anchor alone: a word about WHERE');
  assert.deepEqual(validParkData({ c: CA }), { c: CA }, 'no anchor: nothing of that character\'s is parked');
  assert.equal(validParkData({ a: [AX, AZ] }), null, 'no character: nobody\'s word');
  assert.equal(validParkData({ c: 'x', a: [AX, AZ] }), null, 'a character id is an id');
  assert.equal(validParkData({ c: CA, r: { w: W() } }), null, 'a record with no anchor');
  assert.equal(validParkData({ c: CA, a: [AX, AZ], r: { w: [1, AX, 1, AZ, 0, 0, 0, 1, 50, 0] } }), null, 'a trailing wagon is not parked');
  assert.equal(validParkData({ c: CA, a: [AX, AZ], r: { h: [AX, 1, AZ, 0, 1, 1] } }), null, 'a walking horse is not parked');
  assert.equal(validParkData({ c: CA, a: [AX, AZ], r: { w: W(AX + 20000) } }), null, 'a part far from its anchor is a second place');
  assert.deepEqual(validParkData({ c: CA, a: [AX, AZ], r: { h: [AX, 1, AZ, 0, 1e300, 0] } }).r.h, [AX, 1, AZ, 0, 1, 0], 'AUDIT D5: a facing is a unit one - 1e300 is not stored and fanned');
  assert.equal(validParkData({ c: CA, a: [-1, AZ] }), null); assert.equal(validParkData({ c: CA, a: [AX] }), null);
  assert.equal(validParkData({ c: CA, a: [AX, AZ], r: { n: 'Bess' } }), null, 'a name with nothing parked');
  assert.deepEqual(parseClient(JSON.stringify({ t: 'park', data: { c: CA } }), { hasHello: true }), { t: 'park', data: { c: CA } });
  assert.equal(parseClient(JSON.stringify({ t: 'park', data: null }), { hasHello: true }).error, 'bad park', 'the old null word names no character');
  assert.equal(parseClient(JSON.stringify({ t: 'park', data: { c: CA } })).error, 'park before hello');
  assert.equal(relaySupportsPark('world98'), false, 'an older relay closes the socket on the frame - never sent to it (world98 is SPELLFX1\'s, which has no park arm)');
  assert.equal(relaySupportsPark('world99'), true);
  // the owner key: stable, per account AND character, opaque
  const k = await K('acct-ann1', CA);
  assert.match(k, /^[0-9a-f]{24}$/);
  assert.equal(k, await K('acct-ann1', CA), 'the same account and character: the same key in any tab');
  assert.notEqual(k, await K('acct-ann1', CA2), 'another character: another team');
  assert.notEqual(k, await K('acct-mal1', CA), 'another account naming the same character reaches nothing of ann\'s');
  assert.equal(k.includes('acct'), false);
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

/** A cell world over the real Room. `join(room, id, acct)` - the account the token verifies (acct-<id> by default). */
async function world() {
  const w = fakeRooms();
  // each word a second apart, as the client sends them (PARK_HZ_MAX's burst is pinned below on its own)
  const park = (name, ws, data) => { const r = w.room(name); ws.att = { ...ws.att, parkBucket: null }; r.room._idx = null; return r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data })); };
  const join = async (name, id, acct) => { const r = w.room(name); const ws = r.connect(); await r.hello(ws, id, null, acct ? { tokenSub: acct } : {}); return ws; };
  const reg = async (k) => w.made.get(parkRegistryRoom(k))?.store.get('reg') ?? null;
  return { w, park, join, reg };
}
const framesOf = (ws, t) => ws.sent.filter((f) => f.t === t);

test('HCC-PARK relay: the cell KEEPS a parked team past its owner - stored from a socket in that cell under the ACCOUNT and CHARACTER, fanned with an opaque key, handed to a joiner with the owner\'s verified name, standing after the owner has gone; never handed back to its own account', async () => {
  const { w, park, join, reg } = await world();
  const ann = await join(X, 'ann1');
  const bob = await join(X, 'bob1');
  await park(X, ann, { c: CA, a: [AX, AZ], r: { w: W(), h: H(), n: 'Bess' } });
  const k = await K('acct-ann1', CA);
  const kept = w.room(X).store.get(parkKey(k));
  assert.deepEqual(kept.r, { w: W(), h: H(), n: 'Bess' }); assert.equal(kept.name, 'ann1', 'the socket\'s own name, never the frame\'s');
  const fan = framesOf(bob, 'park').at(-1);
  assert.deepEqual({ ...fan, at: 0 }, { t: 'park', k, id: 'ann1', name: 'ann1', at: 0, data: { w: W(), h: H(), n: 'Bess' } });
  assert.equal('sub' in fan, false, 'the account never leaves the relay (a place room names none)');
  assert.equal(framesOf(ann, 'park').length, 0, 'the owner is not told their own word back');
  assert.equal((await reg(k)).cell, X, 'the owner\'s registry knows the cell');
  // the owner walks into a shop: their socket goes - the team does not
  await w.room(X).drop(ann);
  const cid = await join(X, 'cid1');
  const list = framesOf(cid, 'parks')[0];
  assert.deepEqual(list.data.map((e) => [e.k, e.id, e.name]), [[k, 'ann1', 'ann1']], 'a joiner is handed the team whose owner is away');
  assert.ok(Number.isFinite(list.now), 'with the relay\'s clock, so the reader can age it');
  assert.equal(list.data.some((e) => 'sub' in e), false, 'the list names no account either');
  // the owner comes back in a NEW TAB (a new peer id, the same account): handed nothing of their own
  const annTab = await join(X, 'ann2', 'acct-ann1');
  assert.deepEqual(framesOf(annTab, 'parks')[0].data, [], 'AUDIT D2: an account is never handed its own records - an empty list is said too');
  // their new tab's word REPLACES the record (the same key) - no second wagon for anyone
  await park(X, annTab, { c: CA, a: [AX, AZ], r: { w: W(AX + 5) } });
  assert.equal([...w.room(X).store.keys()].filter((key) => key.startsWith('park:')).length, 1);
  assert.equal(w.room(X).store.get(parkKey(k)).id, 'ann2', 'said under the new id');
});

test('HCC-PARK relay (AUDIT D1): another account reaches nothing of a player\'s parked team - not by saying their peer id in another cell, not by saying it in theirs', async () => {
  const { w, park, join } = await world();
  const ann = await join(X, 'ann1');
  const bob = await join(X, 'bob1');
  await park(X, ann, { c: CA, a: [AX, AZ], r: { w: W() } });
  await w.room(X).drop(ann);
  const k = await K('acct-ann1', CA);
  const before = framesOf(bob, 'park').length;
  // mallory, far away, with her own token and ANN'S id: nothing parked
  const malY = await join(Y, 'ann1', 'acct-mal1');
  await park(Y, malY, { c: CA });
  assert.ok(w.room(X).store.has(parkKey(k)), 'ann\'s record stands');
  assert.equal(framesOf(bob, 'park').length, before, 'and nobody was told otherwise');
  // mallory in ann's own cell, ann's id, ann's character id, parking elsewhere: her own record, never ann's
  const malX = await join(X, 'ann1', 'acct-mal1');
  await park(X, malX, { c: CA, a: [AX + 5000, AZ], r: { w: W(AX + 5000) } });
  assert.deepEqual(w.room(X).store.get(parkKey(k)).r, { w: W() }, 'ann\'s record untouched');
  assert.equal(w.room(X).store.get(parkKey(k)).name, 'ann1');
});

test('HCC-PARK relay: the REGISTRY drops the old cell\'s record from wherever the owner speaks - nothing parked from another cell, a team re-parked in another; a word ABOUT another cell stores nothing (mutants: the registry skipped - a ghost wagon; a record planted from outside its cell)', async () => {
  const { w, park, join, reg } = await world();
  const k = await K('acct-ann1', CA);
  const ann = await join(X, 'ann1');
  const bob = await join(X, 'bob1');
  await park(X, ann, { c: CA, a: [AX, AZ], r: { w: W() } });
  await w.room(X).drop(ann);
  // the owner is in the next cell now, and rides off with the team (nothing parked): the old cell hears it
  const annY = await join(Y, 'ann1');
  await park(Y, annY, { c: CA });
  assert.equal(w.room(X).store.has(parkKey(k)), false, 'dropped by the registry, from another room');
  assert.deepEqual(framesOf(bob, 'park').at(-1), { t: 'park', k, id: 'ann1', data: null });
  assert.equal((await reg(k)).cell, null);
  // parked again in X (from X), then summoned and parked in Y (from Y): X's goes, Y's stands
  const ann2 = await join(X, 'ann1');
  await park(X, ann2, { c: CA, a: [AX, AZ], r: { w: W() } });
  const YX = AX + 16 * PIXEL_UNITS;
  await park(Y, annY, { c: CA, a: [YX, AZ], r: { w: W(YX) } });
  assert.equal(w.room(X).store.has(parkKey(k)), false, 'the old cell\'s record goes');
  assert.ok(w.room(Y).store.has(parkKey(k)), 'the new cell keeps it');
  // a record said THROUGH Y about a team in X is a word about where - Y drops its own, X stores nothing it did not hear
  await park(Y, annY, { c: CA, a: [AX, AZ], r: { w: W() } });
  assert.equal(w.room(Y).store.has(parkKey(k)), false);
  assert.equal(w.room(X).store.has(parkKey(k)), false, 'nothing planted from outside the cell');
  assert.equal((await reg(k)).cell, X);
  // and the anchor alone in the cell that keeps it changes nothing (the owner walked out of sight of their wagon)
  await park(X, ann2, { c: CA, a: [AX, AZ], r: { w: W() } });
  await park(X, ann2, { c: CA, a: [AX, AZ] });
  assert.ok(w.room(X).store.has(parkKey(k)), 'the cell keeps what it has');
  // another character of the same account parks too: two teams, neither touches the other
  await park(X, ann2, { c: CA2, a: [AX + 300, AZ], r: { w: W(AX + 300) } });
  assert.ok(w.room(X).store.has(parkKey(k)) && w.room(X).store.has(parkKey(await K('acct-ann1', CA2))));
});

test('HCC-PARK relay (AUDIT D4): the registry is ORDERED by when the owner said it - a registration older than the one held moves nothing, and the other cell it named loses its superseded record; a drop older than a newer store leaves the store standing', async () => {
  const { w, park, join, reg } = await world();
  const k = await K('acct-ann1', CA);
  const annX = await join(X, 'ann1');
  await park(X, annX, { c: CA, a: [AX, AZ], r: { w: W() } });
  const held = await reg(k);
  // a stale registration (said before the one held) naming Y: the registry keeps X, and Y's record (if any) goes
  const yRoom = w.room(Y);
  await yRoom.room._parkStore(k, 'acct-ann1', 'ann1', 'ann1', { w: W(AX + 16 * PIXEL_UNITS) }, held.at - 5);
  const registry = w.made.get(parkRegistryRoom(k));
  const res = await registry.room._parkInternal('/internal/park/registry', new Request('https://relay.internal/internal/park/registry', { method: 'POST', body: JSON.stringify({ owner: k, cell: Y, at: held.at - 5 }) }));
  assert.equal(res.status, 200);
  assert.equal((await reg(k)).cell, X, 'the newer word stands');
  assert.equal(yRoom.store.has(parkKey(k)), false, 'the stale word\'s cell is superseded');
  // a drop said before the record it would remove: the record is newer, it stands
  await w.room(X).room._parkDrop(k, held.at - 1);
  assert.ok(w.room(X).store.has(parkKey(k)));
  await w.room(X).room._parkDrop(k, held.at + 1);
  assert.equal(w.room(X).store.has(parkKey(k)), false);
});

test('HCC-PARK relay: the cell drops its own superseded record ITSELF - nothing parked, or the team standing elsewhere - so a relay with no registry binding (a local dev worker) still keeps no ghost (mutant: the drop left to the registry alone)', async () => {
  const r = fakeRoom(X);   // no ROOMS: the registry is unreachable
  const ws = r.connect(); await r.hello(ws, 'ann1');
  const k = await K('acct-ann1', CA);
  const say = (data) => { ws.att = { ...ws.att, parkBucket: null }; r.room._idx = null; return r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data })); };
  await say({ c: CA, a: [AX, AZ], r: { w: W() } });
  assert.ok(r.store.has(parkKey(k)));
  await say({ c: CA });
  assert.equal(r.store.has(parkKey(k)), false, 'nothing parked');
  await say({ c: CA, a: [AX, AZ], r: { w: W() } });
  await say({ c: CA, a: [AX + 16 * PIXEL_UNITS, AZ] });
  assert.equal(r.store.has(parkKey(k)), false, 'it stands in another cell now');
});

test('HCC-PARK relay: the park bucket - PARK_HZ_MAX words a second a socket, the rest dropped unread; the same word again is no news (mutants: an unmetered door; a repeat fanned)', async () => {
  const w = fakeRooms();
  const r = w.room(X);
  const ws = r.connect(); await r.hello(ws, 'ann1');
  const bob = r.connect(); await r.hello(bob, 'bob1');
  const k = await K('acct-ann1', CA);
  for (let i = 0; i < 3; i++) await r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data: { c: CA, a: [AX, AZ], r: { w: W(AX + i) } } }));
  assert.equal(r.store.get(parkKey(k)).r.w[1], AX + 1, 'the third word in the same instant was not taken');
  const fans = framesOf(bob, 'park').length;
  ws.att = { ...ws.att, parkBucket: null }; r.room._idx = null;   // a second later
  await r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data: { c: CA, a: [AX, AZ], r: { w: W(AX + 1) } } }));
  assert.equal(framesOf(bob, 'park').length, fans, 'a socket repeating itself buys no fan');
  ws.att = { ...ws.att, parkBucket: null }; r.room._idx = null;
  await r.room.webSocketMessage(ws, JSON.stringify({ t: 'park', data: { c: CA, a: [AX, AZ], r: { w: W(AX + 2) } } }));
  assert.equal(framesOf(bob, 'park').length, fans + 1, 'a changed word is news (the gate above was open)');
});

test('HCC-PARK relay: bounded - PARK_TTL_MS since the owner last said it (and SAID gone to whoever is here), PARK_ACCOUNT_MAX of one account\'s a cell (its own stalest out first), PARK_CELL_MAX a cell (the stalest out)', async () => {
  const { w, join } = await world();
  const X0 = w.room(X);
  const hex = (i) => String(i).padStart(24, '0');
  const watcher = await join(X, 'bob1');
  await X0.room._parkStore(hex(999), 'acct-old', 'old1', 'Old', { w: W() }, Date.now() - PARK_TTL_MS - 1);
  const joiner = await join(X, 'new1');
  assert.deepEqual(framesOf(joiner, 'parks')[0].data, [], 'an expired record is handed to nobody');
  assert.equal(X0.store.has(parkKey(hex(999))), false, 'and swept');
  assert.ok(framesOf(watcher, 'park').some((f) => f.k === hex(999) && f.data === null), 'AUDIT D5: and whoever was drawing it is told');
  const base = Date.now();
  // one account, many characters: PARK_ACCOUNT_MAX stand, its own stalest going first
  for (let i = 0; i <= PARK_ACCOUNT_MAX; i++) await X0.room._parkStore(hex(100 + i), 'acct-one', `one${i}`, '', { w: W() }, base + i);
  const ones = [...X0.store.values()].filter((v) => v?.sub === 'acct-one');
  assert.equal(ones.length, PARK_ACCOUNT_MAX, 'AUDIT D3: one account cannot fill a cell');
  assert.equal(X0.store.has(parkKey(hex(100))), false, 'its own stalest went');
  // many accounts: PARK_CELL_MAX stand, the stalest going
  for (let i = 0; i <= PARK_CELL_MAX; i++) await X0.room._parkStore(hex(i), `acct-${i}`, `own${i}`, '', { w: W() }, base + 100 + i);
  const keys = [...X0.store.keys()].filter((key) => key.startsWith('park:'));
  assert.equal(keys.length, PARK_CELL_MAX);
  assert.equal(keys.includes(parkKey(hex(101))), false, 'the stalest went');
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
  assert.deepEqual(validParkData({ c: CA, ...w }), { c: CA, ...w }, 'my word (with my character) passes the relay\'s own door');
  pool.attach(rt({ ...state, Mode: WAGON_MODE.WithPlayer, HorseMode: HORSE_MODE.WithPlayer }));
  assert.equal(pool.parkWord(toWire), null, 'ridden off: nothing parked');
  pool.attach(rt(state, { persistence: false }));
  assert.equal(pool.parkWord(toWire), null, 'persistence off: nothing stays in the world');
  pool.attach(rt({ ...state, Mode: WAGON_MODE.WithPlayer, HorseMode: HORSE_MODE.LooseStationary, HorseWorldX: AX + 50, HorseWorldZ: AZ }));
  assert.deepEqual(pool.parkWord(toWire).a, [AX + 50, AZ], 'a loose horse alone anchors on itself');
  pool.setEnabled(false);
  assert.equal(pool.parkWord(toWire), null, 'the switch off: a mod never loaded parks nothing');
});

test('HCC-PARK pool + HCC-TIP: a kept team stands under its OWNER KEY, off the newest word a held cell said, and is named by the relay\'s stamp; its owner\'s live part stands it down only where the two stand together; each cell\'s word is its own; a room I left, or a record past its life, goes', () => {
  const names = { p1: 'Ann' };
  const pool = createHorseCartPool({ renderer: null, meshes: null, collider: () => null, selfId: () => 'me', peerName: (id) => names[id] ?? null });
  pool.attach(rt({ Mode: 0 }));
  const toScene = (p) => [p[0] - AX, p[1], p[2] - AZ];
  const kA = 'a'.repeat(24), kB = 'b'.repeat(24), kM = 'c'.repeat(24);
  pool.replaceKept(X, [{ k: kA, id: 'p1', name: 'Ann', r: { w: W(), h: H(), n: 'Bess' }, ttl: 1000 }, { k: kM, id: 'me', name: 'Me', r: { w: W() } }], toScene, 0);
  assert.deepEqual([...pool.peers.keys()], [`kept:${kA}`], 'never my own');
  const kept = () => pool.peers.get(`kept:${kA}`);
  assert.deepEqual(kept().wagon.position, [0, 1, 0]);
  assert.equal(kept().kept, true);
  // the owner walks in: their live word has a horse ELSEWHERE (walking) - both stand, the kept horse is another place
  pool.applyOwner('p1', { h: [AX + 5000, 1, AZ, 0, 1, 1] }, toScene, 1);
  assert.deepEqual(pool.peers.get('p1').horse.position, [5000, 1, 0], 'the live horse stands under the owner');
  assert.deepEqual(kept().horse.position, [120, 1, 0], 'the kept one where it was parked');
  // their live word shows the parked wagon where it is: the kept wagon stands down - one wagon, never two
  pool.applyOwner('p1', { w: [2, AX + 10, 1, AZ, 0, 0, 0, 1, 50, 0] }, toScene, 2);
  assert.equal(kept().wagon, null, 'the live word is the fresher one');
  assert.deepEqual(kept().horse.position, [120, 1, 0]);
  // the owner goes indoors: the live word is swept, the kept team stands whole
  pool.sweepOwners(new Set(), 10, 1);
  assert.equal(pool.peers.has('p1'), false);
  assert.deepEqual(kept().wagon.position, [0, 1, 0]);
  // HCC-TIP: named - by the session while they are here, by the relay's stamp when they are not
  assert.deepEqual(pool.hoverName(`hccPeer:kept:${kA}:w`), { title: 'Wagon', subs: ['Owned by Ann'] });
  delete names.p1;
  pool.applyKept(X, { k: kA, id: 'p1', name: 'Ann (away)', r: { w: W(), h: H(), n: 'Bess' } }, toScene, 0);
  assert.deepEqual(pool.hoverName(`hccPeer:kept:${kA}:h`), { title: 'Bess', subs: ['Owned by Ann (away)'] });
  assert.equal(ownedLine(null), 'Owned by another player');
  // AUDIT client C2: two cells, one owner (a move in flight) - X's "gone" does not unsay Y's fresh word
  pool.applyKept(Y, { k: kA, id: 'p1', name: 'Ann', r: { w: W(AX + 16 * PIXEL_UNITS) } }, toScene, 0);
  assert.deepEqual(kept().wagon.position, [16 * PIXEL_UNITS, 1, 0], 'the NEWEST word a held cell said stands (X\'s older one is still held)');
  pool.applyKept(X, { k: kA, id: 'p1', name: 'Ann', r: null }, toScene, 0);
  assert.deepEqual(kept().wagon.position, [16 * PIXEL_UNITS, 1, 0], 'Y\'s word stands');
  // AUDIT client C3: a welcome's EMPTY list is the whole truth for its room
  pool.replaceKept(Y, [], toScene, 0);
  assert.equal(pool.peers.size, 0);
  // a new session of the same owner (a new id, the same key) is one team
  pool.applyKept(X, { k: kA, id: 'p1', name: 'Ann', r: { w: W() } }, toScene, 0);
  pool.applyKept(X, { k: kA, id: 'p9', name: 'Ann', r: { w: W(AX + 3) } }, toScene, 0);
  assert.equal(pool.peers.size, 1); assert.equal(kept().ownerId, 'p9');
  // a room I no longer hold takes what it kept; a record past its life goes (AUDIT D5)
  pool.replaceKept(Y, [{ k: kB, id: 'p2', name: 'Cid', r: { w: W() }, ttl: 500 }], toScene, 0);
  pool.pruneKept([X, Y], 499);
  assert.ok(pool.peers.has(`kept:${kB}`));
  pool.pruneKept([X, Y], 500);
  assert.equal(pool.peers.has(`kept:${kB}`), false, 'past its life on the relay\'s clock');
  pool.pruneKept([Y]);
  assert.equal(pool.peers.size, 0, 'the cell I left let go');
  // a kept record that is not a parked one is refused at the door
  assert.equal(pool.applyKept(X, { k: kA, id: 'p3', name: 'Dee', r: { w: [1, AX, 1, AZ, 0, 0, 0, 1, 50, 0] } }, toScene, 0), false);
});

test('RIDE: a peer in the saddle is Eye Of The Beholder\'s mounted sprite off the SHOWN pose - their own set, the table off the move bit, a bottom-anchored batch at their feet, the name at the sprite\'s top; the other layers stand nothing for them only once it is DRAWN; failed art is asked again; the dismount takes it', async () => {
  const made = [], gone = [], uploads = [];
  const renderer = {
    uploadTexture: (a, rec) => uploads.push(`${a}:${rec}`),
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, origin: null }; made.push(b); return b; },
    destroyBillboardBatch: (b) => gone.push(b),
  };
  let failing = false, clock = 0;
  const riders = createPeerRiders({ renderer, urlFor: (k) => `u:${k}`, clock: () => clock, decode: async () => { if (failing) throw new Error('404'); return { width: 64, height: 80, colors: new Uint32Array(64 * 80) }; } });
  // the latest word is far ahead of the eased pose: the rider stands where the name and the body would
  const peer = { id: 'p1', pose: { x: 90, y: 0, z: 5, yaw: 0, pitch: 0, mv: 1, rd: 1, rv: 2 }, shown: { x: 10, y: 0, z: 5, yaw: 0, pitch: 0, mv: 1, rd: 1, rv: 2 } };
  const toScene = (p) => [p.x, p.y, p.z];
  riders.sync([peer, { id: 'p2', pose: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 }, shown: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 } }], toScene, { eye: [10, 1, 20], dt: 0.01 });
  assert.equal(riders.isRiding('p1'), false, 'AUDIT RIDE: art not up yet - the doll or the body still stands for them, never nothing');
  assert.equal(riders.heightOf('p1'), 0); assert.equal(riders.isRiding('p2'), false, 'on foot: the doll and the body as before');
  await new Promise((r) => setTimeout(r, 5));
  riders.sync([peer], toScene, { eye: [10, 1, 20], dt: 0.01 });
  assert.equal(riders.isRiding('p1'), true);
  assert.equal(riders.batches().length, 1);
  const b = riders.batches()[0];
  assert.equal(b.archive, ARCHIVE_HORSE + 2, 'the rider\'s own mounted sprite set');
  assert.equal(rideTable(1), 'MoveHorse'); assert.equal(rideTable(2), 'GallopHorse'); assert.equal(rideTable(0), 'IdleHorse');
  assert.ok(Math.abs(b.origin[0] - 10) < 2 && Math.abs(b.origin[2] - 5) < 1, `at the SHOWN feet, not the latest word's: ${b.origin}`);
  const r = riders.riders.get('p1');
  assert.ok(Math.abs(riders.heightOf('p1') - (r.size.h + r.xml.y / r.xml.scale)) < 1e-9 && riders.heightOf('p1') > 1, 'the name at the sprite\'s own top');
  assert.ok(uploads.some((u) => u.startsWith(`${ARCHIVE_HORSE + 2}:`)));
  // a set whose art fails: not riding (the doll stands), asked again after RIDER_RETRY_MS
  failing = true;
  const p3 = { id: 'p3', shown: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0, rd: 1, rv: 4 } };
  riders.sync([p3], toScene, { eye: [0, 1, 10], dt: 0 });
  await new Promise((res) => setTimeout(res, 5));
  riders.sync([p3], toScene, { eye: [0, 1, 10], dt: 0 });
  assert.equal(riders.isRiding('p3'), false);
  failing = false;
  riders.sync([p3], toScene, { eye: [0, 1, 10], dt: 0 });
  await new Promise((res) => setTimeout(res, 5));
  riders.sync([p3], toScene, { eye: [0, 1, 10], dt: 0 });
  assert.equal(riders.isRiding('p3'), false, 'not asked again inside the cooldown');
  clock += RIDER_RETRY_MS;
  riders.sync([p3], toScene, { eye: [0, 1, 10], dt: 0 });
  await new Promise((res) => setTimeout(res, 5));
  riders.sync([p3], toScene, { eye: [0, 1, 10], dt: 0 });
  assert.equal(riders.isRiding('p3'), true, 'asked again after it');
  riders.sync([{ ...peer, shown: { ...peer.shown, rd: undefined } }], toScene, { eye: [10, 1, 20], dt: 0.01 });
  assert.equal(riders.isRiding('p1'), false); assert.equal(gone.length >= 1, true, 'the dismount frees the batch');
});

test('HCC-PARK / RIDE hosts: the owner\'s word names the character, is ticked with the frame\'s out-words and said again after any welcome; a kept team is its cell\'s and its life\'s; the rider layer runs first and hands the others the rider\'s height; the pose sends the mount, the gallop as the rider sees it; a rider hears no footsteps and casts from the saddle; the dead see no rider', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /modes\?\.setDungeonAuthority\?\.\(dungeonAuthority\(now\)\);[^\n]*\n\s+hccParkTick\(now\);/);   // after the stream, the flushes and the seat - the frame's out-words, in order
  assert.match(w, /const c = characterIdOf\(playerEntity\);/);
  assert.match(w, /const data = word \? \{ c, \.\.\.word \} : \{ c \};/);
  assert.match(w, /const rejoin = online\.room !== _parkRoom \|\| online\.welcomes !== _parkWelcomes;/);
  assert.match(w, /const via = online\.sendPark\(data, cell\);/);
  assert.match(w, /online\.onPark = \(room, e\) => hcc\.applyKept\(room, e, campToScene, performance\.now\(\)\);/);
  assert.match(w, /online\.onParks = \(room, list\) => hcc\.replaceKept\(room, list, campToScene, performance\.now\(\)\);/);
  assert.match(w, /hcc\.pruneKept\(isCellRoom\(online\.room\) \? \[online\.room, \.\.\.online\.haloRooms\(\)\] : \[\], now\);/);
  assert.match(w, /peerRiders\.sync\(drawable, onlineToScene,[^\n]*\n\s+const afoot = drawable\.filter\(\(d\) => !peerRiders\.isRiding\(d\.id\)\);\n\s+peerBodies\.sync\(afoot,/);
  assert.match(w, /bodyHeight: \(id\) => peerRiders\.heightOf\(id\) \|\| peerBodies\.heightOf\(id\)/);
  assert.match(w, /const riding = \(modes\?\.mode \?\? 'exterior'\) === 'exterior' && isRiding\(player\.transportMode\);/);
  assert.match(w, /rd: !riding \? 0 : player\.transportMode === TRANSPORT_MODES\.Cart \? 2 : 1,/);
  assert.match(w, /rv: [^\n]*modSetting\('eye-of-the-beholder', 'Graphics\.OnHorse'\)/);
  assert.match(w, /const eye = \[feet\[0\], feet\[1\] \+ \(s\.rd \? RIDE_EYE_HEIGHT : h - 0\.2\), feet\[2\]\];/);
  assert.match(rd('src/net/remotePlayers.js'), /onFoot: !shown\.rd,/);
  const o = rd('src/net/online.js');
  assert.match(o, /this\.welcomes\+\+;/);
  const s = rd('server/src/index.js');
  assert.match(s, /if \(path === PARK_INTERNAL_REG \|\| path === PARK_INTERNAL_DROP\) return this\._parkInternal\(path, request\);/);
  assert.match(s, /const k = await parkKeyOf\(a\.sub, m\.data\.c\);/);
  assert.match(s, /if \(m\.data\.r && cell === here\) await this\._parkStore\(k, a\.sub, a\.id, a\.name \?\? '', m\.data\.r, now\);/);
});
