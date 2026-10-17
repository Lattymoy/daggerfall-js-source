import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankCabinCandidates, linkBankCabin, readBankCabinLink } from '../../src/systems/boatCabinOwnership.js';
import { cabinSceneName } from '../../src/systems/sailingCabin.js';
import { SHIP_INTERIOR_MAP_IDS } from '../../src/systems/banking.js';
import { BUILDING_KEY_0 } from '../../src/systems/talk/talkTopics.js';
import { createSceneCache, interiorSceneName, snapshotSceneCache, restoreSceneCache } from '../../src/systems/sceneCache.js';
import { mintDeed, BOAT_PARTS_TEMPLATE } from '../../src/systems/comeSailAway/comeSailAwayItems.js';
import { privateBoatRoom, privateInteriorPrefix, privateInteriorOf } from '../../src/net/privateInterior.js';
import { validStaffDestination, staffDestinationKey } from '../../src/net/staffTeleport.js';
import { createSailingCabinLink } from '../../src/net/sailingCabinLink.js';
import { OnlineSession, roomKeyFor } from '../../src/net/online.js';
import { RELAY_VERSION } from '../../src/net/wire.js';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { fakeRoom } from '../fakeRoom.mjs';

const uid = 2 ** 40 + 123;
const boat = { uid, hull: 3 };
const cabin = { v: 1, uid, hull: 3, origin: [100, 20, 200], deck: [1, 5, 2], yaw: 0.25 };
const prefix = await privateInteriorPrefix('acct-owner', 'character-one');
const room = privateBoatRoom(prefix, uid);
const destination = { kind: 'interior', pixel: { x: 10, y: 20 }, pos: [100, 20, 200], yaw: 0.25, pitch: 0, sailingCabin: cabin, privateRoom: room, cabinOwner: 'peer-owner' };

test('cabin identity: large deed UID survives the wire, distinct boats and characters remain distinct', async () => {
  assert.equal(privateInteriorOf(room).boatUid, uid);
  assert.notEqual(room, privateBoatRoom(prefix, uid + 1));
  assert.notEqual(room, privateBoatRoom(await privateInteriorPrefix('acct-owner', 'character-two'), uid));
  assert.equal(privateBoatRoom(prefix, Number.MAX_SAFE_INTEGER + 1), null);
  assert.deepEqual(validStaffDestination({ ...destination, cargo: ['never copied'] }), destination);
  assert.equal(validStaffDestination({ ...destination, privateRoom: privateBoatRoom(prefix, uid + 1) }), null);
  assert.notEqual(staffDestinationKey(destination), staffDestinationKey({ ...destination, cabinOwner: 'other' }));
  assert.notEqual(staffDestinationKey(destination), staffDestinationKey({ ...destination, sailingCabin: { ...cabin, origin: [101, 20, 200] } }));
});

test('cabin relay: signed owner and staff enter the same UID room; a stranger cannot forge ownership', async () => {
  const r = fakeRoom(room), pose = { x: 100, y: 20, z: 200, yaw: 0, pitch: 0, mv: 0 };
  const join = async (id, sub, glyphs = []) => {
    const ws = r.connect();
    await r.hello(ws, id, pose, { name: id, tok: await r.token(id, { s: sub, n: id, k: 'guest', g: glyphs }) });
    return ws;
  };
  const owner = await join('peer-owner', 'acct-owner');
  const staff = await join('peer-staff', 'acct-staff', ['dm']);
  assert.ok(staff.sent.some((m) => m.t === 'welcome' && m.peers.some((p) => p.id === 'peer-owner')));
  const other = await join('peer-other', 'acct-other');
  assert.ok(other.closed);
  assert.equal(other.sent.some((m) => m.t === 'welcome'), false);
  await r.pose(owner, { ...pose, x: 101 });
  assert.ok(staff.sent.some((m) => m.t === 'pose' && m.p.x === 101));
});

test('legacy linking: hull sizes, duplicate deed/boat and packed parts resolve to one owned UID', () => {
  const deed = mintDeed(3, 0, uid, 1);
  assert.deepEqual(bankCabinCandidates(1, [boat], [deed]), [boat]);
  assert.deepEqual(bankCabinCandidates(0, [boat], [deed]), []);
  assert.deepEqual(bankCabinCandidates(1, [], [{ ...deed, templateIndex: BOAT_PARTS_TEMPLATE }]), [boat]);
  assert.deepEqual(bankCabinCandidates(1, [{ ...boat, hull: 4 }], [deed]), [], 'conflicting identities are not guessed');
  assert.deepEqual(bankCabinCandidates(1, [{ ...boat, inside: true }], []), []);
});

function owner() {
  const player = { ownedShip: 1, sceneCache: createSceneCache() };
  const old = interiorSceneName(SHIP_INTERIOR_MAP_IDS[1], BUILDING_KEY_0);
  const contents = { frame: 'building', lootContainers: [{ key: 'container:0', items: [{ UID: 12, name: 'Silver' }] }], actionDoors: [],
    decor: [{ id: 'chair', pos: [1, 2, 3] }], decorItems: { chest: [{ UID: 13 }] }, droppedPiles: [{ pos: [4, 5, 6], items: [{ UID: 14 }] }] };
  player.sceneCache.scenes.set(old, contents); player.sceneCache.permanent.add(old);
  return { player, old, contents };
}

test('legacy linking: one match moves all saved contents intact once, and survives cache save/load', () => {
  const { player, old, contents } = owner();
  const key = cabinSceneName(uid), pack = [mintDeed(3, 0, uid, 1)];
  const before = JSON.stringify(pack);
  const result = linkBankCabin(player, [boat], pack);
  assert.equal(result.status, 'linked');
  assert.equal(player.sceneCache.scenes.get(key), contents);
  assert.equal(player.sceneCache.scenes.has(old), false);
  assert.equal(player.sceneCache.permanent.has(old), false);
  assert.ok(player.sceneCache.permanent.has(key));
  assert.deepEqual(linkBankCabin(player, [{ uid: uid + 1, hull: 4 }], [], uid + 1), result, 'an existing link never silently changes boat');
  assert.equal(JSON.stringify(pack), before, 'never mint, replace or consume the existing deed');
  const loaded = restoreSceneCache(createSceneCache(), JSON.parse(JSON.stringify(snapshotSceneCache(player.sceneCache))));
  for (const field of ['frame', 'lootContainers', 'decorItems', 'droppedPiles']) assert.deepEqual(loaded.scenes.get(key)[field], contents[field]);
  assert.deepEqual(loaded.scenes.get(key).decor[0].pos, contents.decor[0].pos);
  assert.deepEqual(readBankCabinLink(JSON.parse(JSON.stringify(player.boatCabinLink))), result.link);
});

test('legacy linking: multiple compatible boats require the existing menu choice; no match leaves housing untouched', () => {
  const { player, old, contents } = owner();
  assert.equal(linkBankCabin(player, [{ ...boat, hull: 2 }], []).status, 'unmatched');
  assert.equal(player.sceneCache.scenes.get(old), contents);
  const boats = [boat, { uid: uid + 1, hull: 4 }];
  assert.equal(linkBankCabin(player, boats, []).status, 'choose');
  assert.equal(player.boatCabinLink, undefined);
  assert.equal(linkBankCabin(player, boats, [], uid + 1).link.uid, uid + 1);
  assert.equal(player.sceneCache.scenes.get(cabinSceneName(uid + 1)), contents);
});

test('legacy linking: two furnished rooms refuse destructive merging; mismatched saved ownership grants no link', () => {
  const { player } = owner();
  player.sceneCache.scenes.set(cabinSceneName(uid), { lootContainers: [], actionDoors: [] });
  const before = JSON.stringify(snapshotSceneCache(player.sceneCache));
  assert.equal(linkBankCabin(player, [boat], []).status, 'conflict');
  assert.equal(JSON.stringify(snapshotSceneCache(player.sceneCache)), before);
  player.boatCabinLink = { v: 1, uid, hull: 2, type: 0 };
  assert.equal(linkBankCabin(player, [], []).status, 'unmatched');
});

function networkRig() {
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 10000;
  class Session extends OnlineSession {
    constructor(options) { super({ ...options, WebSocketImpl: FakeWS, now: () => now }); }
  }
  const main = new Session({ url: 'wss://relay.test', id: 'peer-owner', secret: 'secret-owner', name: 'Owner' });
  main.join(room, { x: 999, y: -50, z: 999, yaw: 2, pitch: 0.3, mv: 2 });
  const received = [], sweeps = [];
  const link = createSailingCabinLink({ Session, frame: () => ({ k: room, n: 1, f: [], sa: { b: [], cabin: 1 }, ab: null }),
    receive: (...v) => received.push(v), sweep: (...v) => sweeps.push(v) });
  const pixel = { x: 10, y: 20 }, cell = roomKeyFor({ host: 'world', mode: 'exterior', mapPixel: pixel });
  const tick = (ms = 0, saved = cabin) => { now += ms; link.tick(main, saved, pixel, now); };
  // SCALE2b: a deck cell with somebody else in it - the boat's record is said to a cell where someone can see it, and
  // held back from an empty one (`alone`)
  const guest = { id: 'peer-guest', name: 'Guest', look: null, pose: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0 } };
  const open = (alone = false) => { for (const ws of sockets.filter((s) => !s.closed)) { ws.open(); ws.receive({ t: 'welcome', id: 'peer-owner', peers: alone ? [] : [guest], n: alone ? 1 : 2, v: RELAY_VERSION }); } };
  return { main, link, sockets, received, sweeps, cell, tick, open };
}

test('cabin connection: real OnlineSession keeps indoor pose private and sends exterior fleet heartbeats with the exterior room key', () => {
  const lone = networkRig(); lone.tick(); lone.open(true); lone.tick(); lone.tick(1000); lone.tick(1000);
  assert.equal(lone.sockets.find((ws) => ws.url.includes(lone.cell)).sent.map(JSON.parse).filter((m) => m.t === 'foes').length, 0, 'SCALE2b: a deck cell nobody else is in hears no fleet record');
  lone.link.close(); lone.main.leave();
  const r = networkRig(); r.tick(); r.open(); r.tick();
  const deck = r.sockets.find((ws) => ws.url.includes(r.cell)); assert.ok(deck);
  const hello = deck.sent.map(JSON.parse).find((m) => m.t === 'hello');
  assert.equal(hello.id, 'peer-owner');
  assert.equal(hello.pose.x, cabin.origin[0]); assert.equal(hello.pose.y, cabin.origin[1]); assert.equal(hello.pose.mv, 0);
  assert.equal(r.main.room, room); assert.equal(r.main._pose.y, -50);
  const frames = () => deck.sent.map(JSON.parse).filter((m) => m.t === 'foes');
  assert.equal(frames().length, 1);
  assert.equal(frames()[0].data.k, r.cell); assert.equal(frames()[0].data.sa.cabin, 1);
  r.tick(999); assert.equal(frames().length, 1);
  r.tick(1); assert.equal(frames().length, 2);
  assert.ok(r.sweeps.length);
  r.link.close(); r.main.leave();
});

test('cabin connection: retry reconnect resends fleet; leaving or losing the seat closes exterior sockets', () => {
  const r = networkRig(); r.tick(); r.open(); r.tick();
  const deck = r.sockets.find((ws) => ws.url.includes(r.cell)); deck.drop();
  r.tick(20000); r.open(); r.tick();
  const replacement = r.sockets.filter((ws) => ws.url.includes(r.cell)).at(-1);
  assert.notEqual(replacement, deck);
  assert.ok(replacement.sent.map(JSON.parse).some((m) => m.t === 'foes' && m.data.sa.cabin === 1));
  r.tick(0, null);
  assert.ok(replacement.closed);
  r.tick(); r.open(); r.main.terminal = true; r.tick();
  assert.ok(r.sockets.slice(1).every((ws) => ws.closed || ws === deck));
  r.main.leave();
});

test('cabin connection: entry handoff cannot supersede a main session still in the deck cell', () => {
  const r = networkRig(); r.main.join(r.cell); const count = r.sockets.length;
  r.tick(); assert.equal(r.sockets.length, count);
  r.link.close(); r.main.leave();
});
