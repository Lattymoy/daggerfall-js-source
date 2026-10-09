import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { scene, ctxFor } from './csaScene.mjs';
import { createComeSailAwayPeers } from '../src/scenes/comeSailAwayPeers.js';
import { createComeSailAwayAboard } from '../src/scenes/comeSailAwayAboard.js';
import { csaWireRecord, csaRecordKey, validCsaRecord } from '../src/systems/comeSailAwayWire.js';
import { setBoatVariant, animatorOf } from '../src/systems/comeSailAwayBoat.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { roomKeyFor } from '../src/net/online.js';
import { privateInteriorOf, privateBoatRoom, privateInteriorPrefix } from '../src/net/privateInterior.js';
import { createSailingCabinLink } from '../src/net/sailingCabinLink.js';
import { linkBankCabin, readBankCabinLink } from '../src/systems/boatCabinOwnership.js';
import { deckPose, localOf } from '../src/scenes/comeSailAwayAboard.js';
import { worldCoordToMapPixel } from '../src/world/streamingWorld.js';
import { mintDeed, mintBoatItem, BOAT_PARTS_TEMPLATE } from '../src/systems/comeSailAwayItems.js';
import { TRIGGER_MODEL } from '../src/systems/comeSailAwayBoat.js';
import { activationModelOf } from '../src/systems/comeSailAway.js';
import { boatTriggers, boatMenuRows, boatMenuStart, BOAT_VERB, pressBoatVerb } from '../src/systems/csaBoatMenu.js';
import { hasSailingCabin, cabinBlockName, cabinSceneName, cabinEntryRefusal, readSailingCabin, savedCabinBoat, CABIN_REFUSAL } from '../src/systems/sailingCabin.js';
import { sailingCabinEntry, createSailingCabinAccess } from '../src/scenes/sailingCabin.js';
import { createSceneCache, addPermanentScene, cacheScene, clearSceneCache, restoreCachedScene, snapshotSceneCache, restoreSceneCache } from '../src/systems/sceneCache.js';
import { isSameInterior, WORLD_CONTEXT } from '../src/systems/teleportAnchor.js';

function rig() {
  const s = scene();
  const pack = [];
  let uid = 100;
  s.deps.items = { create: (t) => mintBoatItem(t, ++uid), addToPlayer: (it) => pack.push(it), player: () => pack };
  const boat = (hull, id = ++uid) => {
    const deed = mintDeed(hull, 0, id, 1); pack.push(deed);
    return s.rt.LaunchFromDeed(deed, () => pack, [100, 34, 200], [0, 0, 1], s.terrains[0]);
  };
  const state = { aboard: true, passengers: 0, mode: 'exterior', busy: false, originShift: [0, 0, 0], entered: [] };
  const deps = {
    available: () => true,
    boats: () => s.rt.AllBoats, sailing: () => s.rt.isSailing(), disembarking: () => !!s.rt.state.disembarking,
    aboard: () => state.aboard, passengers: () => state.passengers, mode: () => state.mode, busy: () => state.busy,
    feet: () => [101, 39, 202], yaw: () => 0.7, nearby: () => true,
    toNative: (p) => p.map((v, i) => v - state.originShift[i]),
    fromNative: (p) => p.map((v, i) => v + state.originShift[i]),
    enterInterior: async (c) => { state.entered.push(c); return true; }, say: (s) => state.said = s,
  };
  return { s, pack, boat, state, deps, access: createSailingCabinAccess(deps) };
}

test('cabin layouts follow enclosed hull sizes; open boats and unidentified hulls have none', () => {
  const r = rig();
  assert.deepEqual([0, 1, 2, 3, 4].map(cabinBlockName), [null, null, 'SHIPAA00.RMB', 'SHIPAA01.RMB', 'SHIPAA01.RMB']);
  for (let h = 0; h < 5; h++) assert.equal(hasSailingCabin(r.boat(h)), h >= 2);
  assert.equal(hasSailingCabin(r.s.place(3)), false, 'no cabin identity without a deed UID');
  assert.equal(cabinSceneName(0), null);
  assert.equal(cabinSceneName(Number.MAX_SAFE_INTEGER + 1), null);
});

test('the real deed boat enters without bank ownership and keeps the sailing inventory and helm untouched', async () => {
  const r = rig(); const b = r.boat(3);
  r.s.deps.ship.owns = () => false;
  r.s.deps.ship.assign = () => assert.fail('a cabin must not grant a bank ship');
  b.Cargo.Items.push({ name: 'Rope', stackCount: 3 });
  const before = JSON.stringify(r.s.rt.getSaveData());
  assert.equal(await r.access.enter(b), true);
  assert.equal(r.state.entered[0].uid, b.uid);
  assert.equal(JSON.stringify(r.s.rt.getSaveData()), before);
  assert.equal(r.s.rt.isSailing(), false);
  assert.equal(r.pack.length, 1, 'deed retained, never consumed to enter');
});

test('cabin shares the boat menu; a cabin door selects entry while its open/close verb still reaches the real animation', () => {
  const r = rig(); const b = r.boat(4);
  const boxes = boatTriggers(b.GameObject, activationModelOf, TRIGGER_MODEL);
  const rows = boatMenuRows({ boxes, packable: true, cabin: hasSailingCabin(b), cabinWhy: null });
  assert.deepEqual(rows.map((x) => x.label), ['Take the helm', 'Board', 'Open storage', 'Enter cabin', 'Open / close door', 'Pick up']);
  assert.equal(rows[boatMenuStart('door', rows, 'grab')].id, BOAT_VERB.cabin);
  assert.equal(rows[boatMenuStart('cargo', rows, 'grab')].id, BOAT_VERB.cargo);
  let pressed = null;
  const node = boxes.get('door')[0];
  assert.equal(pressBoatVerb({ boxes, rows, verb: BOAT_VERB.door, distance: 1, reach: 3.2, at: node.position,
    posOf: (n) => n.position, hit: { root: b.GameObject }, aimed: node, mode: 'grab', models: TRIGGER_MODEL,
    activate: (model, hit, mode) => { pressed = [model, hit.node, mode]; r.s.rt.activate(model, hit, mode); }, say: assert.fail }), 'pressed');
  assert.deepEqual(pressed, [TRIGGER_MODEL.door, node, 'grab']);
  const refused = boatMenuRows({ boxes, cabin: true, cabinWhy: CABIN_REFUSAL.aboard }).find((x) => x.id === BOAT_VERB.cabin);
  assert.equal(refused.disabled, true);
});

test('entry rechecks ownership, deck, helm, delayed dismount, passengers, mode and ongoing travel', async () => {
  const r = rig(); const b = r.boat(3);
  const foreign = rig().boat(3);
  assert.equal(await r.access.enter(foreign), false);
  assert.equal(r.state.said, CABIN_REFUSAL.unavailable);
  r.state.aboard = false; assert.equal(await r.access.enter(b), false); assert.equal(r.state.said, CABIN_REFUSAL.aboard);
  r.state.aboard = true; r.state.passengers = 1;
  assert.equal(await r.access.enter(b), true, 'passengers never lock the owner out of the cabin');
  r.state.entered.length = 0;
  r.state.passengers = 0; r.s.helm(b);
  assert.equal(await r.access.enter(b), false); assert.equal(r.state.said, CABIN_REFUSAL.helm);
  r.s.rt.StopSailingDelayed();
  assert.equal(await r.access.enter(b), false, 'a delayed helm release cannot pin the player inside');
  r.s.rt.OnStartLoad();
  r.state.mode = 'interior'; assert.equal(await r.access.enter(b), false);
  r.state.mode = 'exterior'; r.state.busy = true; assert.equal(await r.access.enter(b), false);
  assert.equal(r.state.entered.length, 0);
  assert.equal(cabinEntryRefusal(b, { boats: [] }), CABIN_REFUSAL.unavailable);
});

test('entry is serialized, releases its latch after failure, and never changes the boat', async () => {
  const r = rig(); const b = r.boat(3);
  let finish;
  r.deps.enterInterior = () => new Promise((resolve) => { finish = resolve; });
  const first = r.access.enter(b);
  assert.equal(await r.access.enter(b), false);
  finish(false); assert.equal(await first, false);
  assert.equal(r.state.said, CABIN_REFUSAL.unavailable, 'a missing room reports the failure');
  r.deps.enterInterior = async () => { throw new Error('missing model'); };
  assert.equal(await r.access.enter(b), false);
  assert.equal(r.state.said, CABIN_REFUSAL.unavailable);
  r.deps.enterInterior = async () => true;
  assert.equal(await r.access.enter(b), true);
});

test('return follows the SAME boat when it moves and turns, ignoring other boats of the same hull', async () => {
  const r = rig(); const b = r.boat(3); const other = r.boat(3);
  await r.access.enter(b);
  const saved = JSON.parse(JSON.stringify(r.state.entered[0]));
  b.GameObject.position = [1000, 40, 3000];
  b.GameObject.rotation = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const back = r.access.returnToDeck(saved);
  back.position.forEach((v, i) => assert.ok(Math.abs(v - [1002, 45, 2999][i]) < 0.001));
  assert.equal(back.yaw, 0.7);
  r.s.rt.AllBoats.splice(r.s.rt.AllBoats.indexOf(b), 1);
  assert.ok(r.s.rt.AllBoats.includes(other));
  assert.equal(r.access.returnToDeck(saved), null, 'no substitution with another boat');
});

test('boat packing, relaunch and runtime save/load retain the cabin identity and independent stored items', async () => {
  const r = rig(); const b = r.boat(3); const other = r.boat(3);
  await r.access.enter(b); const cabin = r.state.entered[0];
  const cache = createSceneCache();
  const entry = (name) => ({ lootContainers: [{ key: 'container:0', items: [{ name }] }], decor: [], actionDoors: [] });
  for (const [boat, item] of [[b, 'Silver'], [other, 'Iron']]) { addPermanentScene(cache, cabinSceneName(boat.uid)); cacheScene(cache, cabinSceneName(boat.uid), entry(item)); }
  assert.equal(r.s.rt.PackBoat(b, true), true);
  const parts = r.pack.find((x) => x.templateIndex === BOAT_PARTS_TEMPLATE);
  assert.equal(parts.UID, cabin.uid);
  const launched = r.s.rt.LaunchFromParts(parts, () => r.pack, [100, 34, 200], [0, 0, 1], r.s.terrains[0]);
  assert.equal(launched.uid, cabin.uid);
  const data = JSON.parse(JSON.stringify(r.s.rt.getSaveData()));
  r.s.rt.restoreSaveData(data);
  assert.equal(r.access.canRestore(cabin, savedCabinBoat(cabin, data)), true);
  assert.ok(r.access.returnToDeck(cabin));
  clearSceneCache(cache, { start: false });
  const saved = JSON.parse(JSON.stringify(snapshotSceneCache(cache)));
  const loaded = restoreSceneCache(createSceneCache(), saved);
  assert.equal(restoreCachedScene(loaded, cabinSceneName(cabin.uid)).lootContainers[0].items[0].name, 'Silver');
  assert.equal(restoreCachedScene(loaded, cabinSceneName(other.uid)).lootContainers[0].items[0].name, 'Iron');
});

test('save records are validated; loading never borrows the previous character\'s boat', async () => {
  const r = rig(); const b = r.boat(3); await r.access.enter(b); const c = r.state.entered[0];
  assert.equal(r.access.canRestore(c), true, 'Recall can resolve the live owned boat');
  assert.equal(r.access.canRestore(c, null), false, 'load explicitly missing its boat does not use live state');
  assert.equal(r.access.canRestore(c, { UID: c.uid, Hull: 2 }), false);
  r.deps.available = () => false;
  assert.equal(r.access.canRestore(c, { UID: c.uid, Hull: 3 }), false, 'disabled sailing refuses cabin restoration');
  assert.equal(savedCabinBoat(c, { placedBoats: [{ UID: c.uid, Hull: 3, inside: true }] }), null);
  for (const bad of [{ ...c, uid: 0 }, { ...c, hull: 1 }, { ...c, origin: [0, NaN, 0] }, { ...c, v: 2 }, { ...c, deck: [] }]) assert.equal(readSailingCabin(bad), null);
  const copied = readSailingCabin(c); copied.deck[0] = 999; assert.notEqual(c.deck[0], 999);
});

test('template construction uses the existing bank block at a stable frame; different cabins have different Recall identities', async () => {
  const r = rig(); const a = r.boat(3); const b = r.boat(3);
  await r.access.enter(a); await r.access.enter(b);
  const requested = [];
  const dfBlock = { index: 630, rmbBlock: { subRecords: [{ interior: {} }] } };
  const blocks = { getBlockByName: (name) => { requested.push(name); return dfBlock; } };
  r.state.originShift = [500, 100, -600];
  const x = sailingCabinEntry(blocks, r.state.entered[0], r.deps.fromNative);
  const y = sailingCabinEntry(blocks, r.state.entered[1], r.deps.fromNative);
  assert.deepEqual(requested, ['SHIPAA01.RMB', 'SHIPAA01.RMB']);
  assert.equal(x.hit.dfBlock, dfBlock); assert.equal(x.hit.recordIndex, 0);
  assert.deepEqual([...x.hit.door.matrix].slice(12, 15), [600, 134, -400]);
  assert.notEqual(x.building.buildingKey, y.building.buildingKey);
  const pixel = { x: 10, y: 20 };
  assert.equal(isSameInterior({ worldContext: WORLD_CONTEXT.Interior, pixel, buildingKey: x.building.buildingKey },
    { insideBuilding: true, pixel, buildingKey: y.building.buildingKey }), false);
  assert.equal(sailingCabinEntry({ getBlockByName: () => null }, r.state.entered[0], r.deps.fromNative), null);
});

// Execute the shipped host entry with only the expensive GPU builder replaced.
const modesSource = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
const modesAst = parse(modesSource, { ecmaVersion: 'latest', sourceType: 'module' });
function functionSource(name, source = modesSource, ast = modesAst) {
  const walk = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) return source.slice(node.start, node.end);
    if (node.type === 'AssignmentExpression' && node.left?.property?.name === name && node.right?.type === 'ArrowFunctionExpression') return source.slice(node.right.start, node.right.end);
    if (node.type === 'VariableDeclarator' && node.id?.name === name && node.init?.type === 'ArrowFunctionExpression') return source.slice(node.init.start, node.init.end);
    if (node.type === 'Property' && node.method && node.key?.name === name) return `${node.value.async ? 'async ' : ''}function ${name}${source.slice(node.value.start, node.value.end)}`;
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) { for (const n of v) { const f = walk(n); if (f) return f; } }
      else if (v && typeof v === 'object') { const f = walk(v); if (f) return f; }
    }
    return null;
  };
  const found = walk(ast);
  assert.ok(found, name); return found;
}
test('worldModes cabin entry uses its ONE existing interior transition and keeps the saved player position', async () => {
  const r = rig(); await r.access.enter(r.boat(4)); const cabin = r.state.entered[0];
  const calls = [];
  const scope = { mode: 'exterior', host: { sailingCabin: r.access }, sailingCabinEntry,
    blocks: { getBlockByName: () => ({ index: 630, rmbBlock: { subRecords: [{ interior: {} }] } }) },
    enterInteriorCore: async (...args) => { calls.push(args); return true; } };
  const enter = new Function(...Object.keys(scope), `return (${functionSource('enterSailingCabin')});`)(...Object.values(scope));
  assert.equal(await enter(cabin, [4, 5, 6]), true);
  assert.deepEqual(calls[0][2].pos, [4, 5, 6]);
  assert.deepEqual(calls[0][0].sailingCabin, cabin);
  assert.equal(calls[0][1][0], calls[0][0]);
});

test('worldModes exit caches the cabin, tears down the room, and lands at deck height without terrain snapping', async () => {
  const r = rig(); await r.access.enter(r.boat(3)); const cabin = r.state.entered[0];
  const actions = []; const noop = () => {};
  const scope = {
    privateVisitOwner: null, interiorCabin: cabin, host: { sailingCabin: r.access, onTransitionExterior: () => actions.push('sailing transition') },
    say: (s) => actions.push(s), exteriorLanding: () => assert.fail('cabin must return through its boat'), exitReturn: null,
    player: { pos: [0, 0, 0], spawn: (...p) => actions.push(p) }, cam: { yaw: 0 },
    unleveledLootPreTransition: noop, cacheInteriorScene: () => actions.push('cache'), teardownQuestFlats: noop,
    interiorCtx: { destroy: () => actions.push('destroy') }, _intShared: null, interiorFoes: null, interiorGuards: null,
    interiorDropped: { restorePiles: noop }, interiorHitEffects: { clear: noop }, interiorBloodMarks: { clear: noop },
    interiorCamps: { destroyAll: noop }, interiorHearths: [], interiorBuilding: {}, interiorHome: null, interiorSeatHall: null,
    _seatHallVisit: false, exteriorDoor: {}, interiorWindows: { reconcile: noop, clear: noop }, interiorOverlay: null,
    _insideTavern: false, playerEntity: {}, _insidePartyRestExempt: false,
    baseCollider: () => ({ heightAt: () => assert.fail('deck height must not be replaced with seabed height') }),
    repositionFeetY: () => assert.fail('saved deck position is feet already'), setMode: (m) => actions.push(m), destroyWorldPlaque: noop,
    weaponPoseOf: noop, interiorWeapon: { playerWeapon: {} }, mwViewTransition: noop,
    immersiveFootsteps: { onTransitionExterior: noop }, betterAmbience: { onTransition: noop },
    interiorTorches: { destroyAll: noop }, interiorDecor: { destroyAll: noop }, _decorVisit: 0, decorTool: { close: noop },
    questBridge: null, npcSession: null, unleveledLootExteriorTransition: noop, console: { log: noop, error: assert.fail },
    standFromCardTable: noop,   // CARDS4: the door cashes the card table out
    isCaravanRoom: (room) => room?.kind === 'caravan', CARAVAN_TEXT: { notHere: 'Your caravan is not here.' },   // WAGONS1: the caravan's room shares the slot
    dropViewOut: () => actions.push('view out dropped'),   // RW1 (AUDIT): the view out goes with the building
  };
  const exit = new Function(...Object.keys(scope), `return (${functionSource('exitInteriorNow')});`)(...Object.values(scope));
  assert.equal(exit(), true);
  assert.deepEqual(actions, ['cache', 'destroy', 'view out dropped', [101, 39, 202], 'exterior', 'sailing transition']);   // RW1 (AUDIT): the view out goes with the room
  assert.equal(scope.cam.yaw, 0.7);
  actions.length = 0;
  scope.host = { sailingCabin: { returnToDeck: () => null } };
  const missing = new Function(...Object.keys(scope), `return (${functionSource('exitInteriorNow')});`)(...Object.values(scope));
  assert.equal(missing(), false);
  assert.deepEqual(actions, ['Your ship is not available at this location.'], 'a missing boat does not destroy the saved room or spawn in the sea');
  // WAGONS1: the caravan's room leaves by its own door - the landing its access hands back (grounded there), as given
  actions.length = 0;
  Object.assign(scope, { interiorCabin: { v: 1, kind: 'caravan', origin: [0, 0, 0], step: [5, 2, 6], yaw: 1 }, interiorCtx: { destroy: () => actions.push('destroy') },
    host: { caravanRoom: { returnToWagon: (room) => ({ position: room.step, yaw: room.yaw }) }, sailingCabin: { returnToDeck: () => assert.fail('a caravan is no ship') }, onTransitionExterior: noop } });
  const caravanExit = new Function(...Object.keys(scope), `return (${functionSource('exitInteriorNow')});`)(...Object.values(scope));
  assert.equal(caravanExit(), true);
  assert.deepEqual(actions.slice(0, 4), ['cache', 'destroy', 'view out dropped', [5, 2, 6]], 'out behind the caravan');
  assert.equal(scope.cam.yaw, 1);
});

test('a cabin reload takes the same interior enemy/pool restoration path and never searches for a town door', async () => {
  const r = rig(); const b = r.boat(3); await r.access.enter(b); const cabin = r.state.entered[0];
  const saved = { sailingCabin: cabin, door: { blockIndex: 630, recordIndex: 0, doorIndex: 0 }, foes: [], guards: [] };
  const args = { mode: 'exterior', host: { sailingCabin: r.access }, readSailingCabin,
    doorTargets: () => assert.fail('a sailing cabin is not a town door'), buildingDataForDoor: null,
    enterInteriorCore: () => assert.fail('cabin needs its template adapter'), console,
  };
  const make = new Function(...Object.keys(args), `
    let _enemyRestoreInProgress = false;
    const calls = [];
    const enterSailingCabin = async (c, p) => { calls.push([c, p, _enemyRestoreInProgress]); mode = 'interior'; return true; };
    const restoreSailingCabin = (${functionSource('restoreSailingCabin')});
    const restoreInteriorPools = (...a) => calls.push(a);
    return { restore: (${functionSource('restoreInterior')}), calls, restoring: () => _enemyRestoreInProgress };
  `);
  const h = make(...Object.values(args)); const fromNative = () => [];
  const record = savedCabinBoat(cabin, r.s.rt.getSaveData());
  assert.equal(await h.restore(saved, [1, 2, 3], { fromNative, yOffset: 10, sailingBoat: record }), true);
  assert.deepEqual(h.calls[0], [cabin, [1, 2, 3], true]);
  assert.deepEqual(h.calls[1], [saved, fromNative, 10]);
  assert.equal(h.restoring(), false);
  const absent = make(...Object.values(args));
  assert.equal(await absent.restore(saved, [1, 2, 3], { sailingBoat: null }), false);
  assert.deepEqual(absent.calls, []);
});


// The owner's shipped network producer and the passenger's actual prefab/aboard path.
const worldSource = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const worldAst = parse(worldSource, { ecmaVersion: 'latest', sourceType: 'module' });
const worldFunction = (name) => functionSource(name, worldSource, worldAst);
function passengerRig() {
  const s = scene(); const removed = [];
  const pool = { ready: () => true, spawnPeerNow: (b) => s.deps.pool.spawnNow(b, s.deps.player()),
    remove: (b) => { removed.push(b); b.GameObject.setActive(false); },
    setVariant: (b, v) => setBoatVariant(b, v, ctxFor(s.deps.player())) };
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'passenger' });
  const aboard = createComeSailAwayAboard({ peers, geometry: () => null, selfId: () => 'passenger' });
  peers.setKeepAboard((b) => aboard.aboard?.boat === b);
  const raw = csaWireRecord([{ hull: 3, variant: 0, position: [100, 34, 200], rotation: [0, 0, 0, 1], sails: 0, helm: false, light: false }]);
  peers.applyOwner('owner', raw, (p) => p, 0); peers.frame(0.1); peers.frame(0.1);
  const b = peers.boatAt('owner', 0); assert.ok(b); assert.equal(aboard.board(b), true);
  const me = { allowed: true, feet: () => [100, 39, 200], height: 1.8, swimming: false, ground: () => 'boat', carry: assert.fail };
  return { peers, aboard, b, raw, removed, me };
}

test('actual indoor transition keeps the fleet active only for a sailing cabin, with helm and save unchanged', () => {
  const r = rig(); const b = r.boat(3); const other = r.boat(4);
  let cabin = false;
  r.s.deps.keepExteriorBoats = () => cabin;
  const saved = r.s.rt.getSaveData();
  r.s.world.inside = true; cabin = true; r.s.rt.OnTransition();
  assert.equal(b.GameObject.activeSelf, true); assert.equal(other.GameObject.activeSelf, true);
  assert.equal(r.s.rt.isSailing(), false);
  assert.deepEqual(r.s.rt.getSaveData().placedBoats, saved.placedBoats);
  cabin = false; r.s.rt.OnTransition();
  assert.equal(b.GameObject.activeSelf, false, 'ordinary interiors retain their original visibility rule');
  r.s.world.inside = false; r.s.rt.OnTransition();
  assert.equal(b.GameObject.activeSelf, true);
});

test('the shipped boat producer sends a stationary cabin fleet and publishes both cabin edges immediately', () => {
  const r = rig(); r.boat(3);
  const modes = { sailingCabin: null };
  // PIN MOVED (TOUGHER-SHIPS + HOLDINGS' merge of main's #574): the producer reads each boat's name through the Fleet's host
  // (HOLDINGS - her name on the boats' word); none named here
  const args = { csaRuntime: r.s.rt, csaOn: () => true, gamePaused: () => false, worldTimeScale: () => 1,
    csaAnimatorOf: animatorOf, campToWire: (p) => p, modes, csaWireRecord, csaRecordKey, fleetHost: null };
  const producer = new Function(...Object.keys(args), `let _csaWordKey = null; return (${worldFunction('csaWord')});`)(...Object.values(args));
  const deck = {}; assert.equal(producer(deck, true), true); assert.equal(deck.sa.cabin, undefined);
  modes.sailingCabin = { uid: 101 }; const cabin = {};
  assert.equal(producer(cabin, false), true); assert.equal(cabin.sa.cabin, 1);
  assert.deepEqual(cabin.sa.b, deck.sa.b); assert.equal(cabin.sa.m, undefined);
  assert.equal(validCsaRecord(cabin.sa).cabin, true);
  assert.equal(producer(null, false), false, 'stationary cabin uses the normal full-frame heartbeat');
  modes.sailingCabin = null; const returned = {};
  assert.equal(producer(returned, false), true); assert.equal(returned.sa.cabin, undefined);
  assert.equal(validCsaRecord({ ...cabin.sa, cabin: 2 }), null);
  assert.equal(validCsaRecord({ ...cabin.sa, m: [[1, 0, 0]] }), null, 'a cabin never advertises a moving fleet');
});

test('primary cabin routing publishes the actual indoor pose to the shared owner/boat room', async () => {
  const start = worldSource.indexOf("    const mode = modes?.mode ?? 'exterior';   // audit24_wave37");
  const end = worldSource.indexOf('    // ONLINE-MVFLICKER1', start);
  assert.ok(start > -1 && end > start);
  const room = privateBoatRoom(await privateInteriorPrefix('acct-owner', 'character'), 101);
  const args = { modes: { mode: 'interior', sailingCabin: { origin: [10, 20, 30] }, roomIdentity: () => ({ private: true, boatUid: 101 }) },
    state: { compensation: [0, 100, 0], localFromWorld: (x, z) => [x - 500, z - 600], worldCoords: (p) => ({ x: p[0] + 500, z: p[2] + 600 }) },
    player: { pos: [1, -30, 2] }, cam: { yaw: 0.2, pitch: 0.1 }, worldCoordToMapPixel, roomKeyFor, privateInteriorOf,
    _questLoc: () => null, privateRoomHere: () => room, siegeSession: null, royalSession: null, campToWire: (p) => p };
  const route = new Function(...Object.keys(args), `let onlineToScene, sceneToOnline; ${worldSource.slice(start, end)} return { key, pose, mp, onlineToScene };`)(...Object.values(args));
  assert.equal(route.key, room); assert.equal(route.mp, null);
  assert.deepEqual([route.pose.x, route.pose.y, route.pose.z], [501, -130, 602]);
  assert.deepEqual(route.onlineToScene(route.pose), args.player.pos);
});

test('cabin fleet heartbeats keep a real passenger deck alive and owner returns without a duplicate hull', () => {
  const r = passengerRig(), sent = [];
  const foes = createExteriorFoes({ renderer: {}, collider: {} });
  foes.setNet({ room: () => 'owned:interior', toWire: (p) => p });
  class Session {
    constructor() { this.status = 'open'; this.welcomes = 1; }
    join(key) { this.room = key; }
    setHalo() {} haloRooms() { return []; } tick() {} sendPose() {} leave() {}
    sendFoes(f) { sent.push(f); return true; } drawable() { return []; }
  }
  const link = createSailingCabinLink({ Session, frame: () => ({ ...foes.emptyFoesFrame(), sa: { ...r.raw, cabin: 1 }, ab: null }), receive: () => {}, sweep: () => {} });
  const main = { room: 'owned:interior', inRoom: () => false };
  for (let now = 0; now <= 15000; now += 1000) {
    link.tick(main, { origin: [100, 34, 200], yaw: 0 }, { x: 16, y: 16 }, now);
    const f = sent.at(-1); assert.deepEqual(f.f, []); assert.equal(f.ab, null);
    assert.ok(!sent.at(-2) || f.n > sent.at(-2).n);
    r.peers.applyOwner('owner', f.sa, (p) => p, now);
    r.peers.sweepOwners(new Set(['owner']), now, 3000); r.peers.frame(0.1);
    assert.equal(r.aboard.frame(r.me), r.b); assert.equal(r.peers.isBelowDeck('owner'), true);
  }
  r.peers.applyOwner('owner', r.raw, (p) => p, 16000); r.peers.frame(0.1);
  assert.equal(r.peers.isBelowDeck('owner'), false);
  assert.equal(r.peers.boatAt('owner', 0), r.b); assert.deepEqual(r.removed, []);
  link.close();
});

test('cabin peers are visible indoors; the owner remains hidden from deck actors but present in deck liveness', () => {
  const p = { id: 'owner', shown: { x: 1, y: 2, z: 3 } };
  const modes = { sailingCabin: null };
  const args = { online: { room: 'world:1,1', status: 'open', peers: new Map([[p.id, p]]), visible: () => true }, modes,
    csaPeers: { isBelowDeck: () => true }, peerBodies: null, onlineToScene: (p) => [p.x, p.y, p.z] };
  const near = new Function(...Object.keys(args), `const _peerHeights = new Map(); return (${worldFunction('peersNear')});`)(...Object.values(args));
  assert.deepEqual(near(), []); assert.equal(near({ presenceOnly: true })[0].id, 'owner');
  modes.sailingCabin = { uid: 101 };
  assert.equal(near()[0].id, 'owner');
});

test('stable UID lookup never substitutes a different same-hull boat after fleet slots reorder', () => {
  const r = passengerRig();
  const row = r.raw.b[0];
  r.peers.applyOwner('owner', { b: [row, [...row.slice(0, 2), 200, ...row.slice(3)]], u: [101, 102] }, (p) => p, 100);
  r.peers.frame(0.1);
  assert.equal(r.peers.boatByUid('owner', 101).uid, 101);
  r.peers.applyOwner('owner', { b: [[...row.slice(0, 2), 200, ...row.slice(3)], row], u: [102, 101] }, (p) => p, 200);
  assert.equal(r.peers.boatByUid('owner', 101).uid, 101, 'network receipt before the render realignment never returns the old slot occupant');
  r.peers.frame(0.1);
  assert.equal(r.peers.boatByUid('owner', 101).uid, 101);
  assert.equal(r.peers.boatByUid('owner', 102).uid, 102);
  assert.equal(r.peers.boatByUid('owner', 103), null);
});

test('existing bank Transport callback enters the launched deed boat through the shared interior call', async () => {
  const r = rig(), boat = r.boat(3), playerEntity = { ownedShip: 1 };
  const calls = [], said = [];
  const player = { pos: [0, 0, 0] }, cam = { yaw: 0 };
  r.s.deps.helm.setPlayerPosition = (p) => { player.pos = [p[0], p[1] - 0.9, p[2]]; calls.push('board'); };
  r.s.deps.helm.setFacing = (yaw) => { cam.yaw = yaw * Math.PI / 180; };
  const args = { csaOn: () => true, csaRuntime: r.s.rt, worldMoveBusy: () => false,
    ensureBankCabinLink: () => linkBankCabin(playerEntity, r.s.rt.AllBoats, r.pack), playerEntity,
    modes: { forceExitToExterior: () => calls.push('exit'), enterSailingCabin: async (c) => { calls.push(c); return true; } },
    cabinLink: { close: () => calls.push('close link') }, _teleporting: false,
    hudFade: { smashHUDToBlack: () => {}, fadeHUDFromBlack: () => calls.push('fade') },
    _teleportToPixel: async (x, y) => calls.push(['pixel', x, y]), state: { worldCoords: (p) => ({ x: p[0], z: p[2] }), compensation: [0, 0, 0] },
    csaSyncColliders: () => {}, CSA_TRIGGER_MODEL: TRIGGER_MODEL, player, cam, csaLocalOf: localOf, csaDeckPose: deckPose, townTalk: { say: (line) => said.push(line) } };
  const enter = new Function(...Object.keys(args), `return (${worldFunction('enterLinkedBankCabin')});`)(...Object.values(args));
  const saved = JSON.stringify(r.s.rt.getSaveData());
  assert.equal(await enter(), true);
  assert.ok(readBankCabinLink(playerEntity.boatCabinLink));
  const cabin = calls.find((c) => c?.v === 1);
  assert.deepEqual(readSailingCabin(cabin), cabin); assert.equal(cabin.uid, boat.uid);
  assert.ok(calls.includes('board'), 'uses the existing Board activation before saving the return feet');
  assert.deepEqual(cabin.deck, localOf(deckPose(boat), player.pos));
  assert.equal(JSON.stringify(r.s.rt.getSaveData()), saved, 'no spawned duplicate or helm mutation');
  assert.deepEqual(said, []);
});

test('existing boat UI dispatcher rechecks link reach/ownership and retains the cabin callback', () => {
  const boat = { uid: 101 }, calls = [];
  const args = { csaRuntime: { AllBoats: [boat] }, CSA_ACTIVATION_DISTANCE: 3.2, worldMoveBusy: () => false,
    ensureBankCabinLink: (id) => { calls.push(['link', id]); return { status: 'linked' }; },
    townTalk: { say: (line) => calls.push(['say', line]) }, BOAT_VERB,
    sailingCabins: { enter: (b) => calls.push(['enter', b]) } };
  const press = new Function(...Object.keys(args), `return (${worldFunction('csaBoatVerb')});`)(...Object.values(args));
  press({ boat, distance: 5 }, 'linkCabin'); press({ boat: {}, distance: 1 }, 'linkCabin');
  assert.deepEqual(calls, []);
  press({ boat, distance: 1 }, 'linkCabin'); assert.deepEqual(calls[0], ['link', 101]);
  press({ boat, distance: 1 }, BOAT_VERB.cabin); assert.deepEqual(calls.at(-1), ['enter', boat]);
});

for (const loss of ['disconnect', 'timeout', 'withdraw', 'teleport']) {
  test(`an occupied passenger deck survives owner ${loss} until the passenger steps off`, () => {
    const r = passengerRig();
    if (loss === 'disconnect') r.peers.sweepOwners(new Set(), 100, 3000);
    if (loss === 'timeout') r.peers.sweepOwners(new Set(['owner']), 9000, 3000);
    if (loss === 'withdraw') r.peers.applyOwner('owner', null);
    if (loss === 'teleport') {
      const far = JSON.parse(JSON.stringify(r.raw)); far.b[0][2] += 1000;
      r.peers.applyOwner('owner', far); r.peers.frame(0.1);
    }
    r.peers.frame(0.1);
    assert.equal(r.b.GameObject.activeSelf, true);
    assert.deepEqual(r.b.GameObject.position, [100, 34, 200]);
    assert.equal(r.aboard.frame(r.me), r.b, 'the real aboard state and deck remain');
    assert.ok(r.peers.placeOf(r.b)); assert.equal(r.removed.includes(r.b), false);
    r.peers.rebase([500, 20, -200]); r.peers.frame(0.1);
    assert.deepEqual(r.b.GameObject.position, [600, 54, 0]);
    r.aboard.leave(); r.peers.frame(0.1);
    assert.equal(r.removed.includes(r.b), true, 'no orphan hull remains after disembarking');
  });
}

test('a reconnect at the same berth reuses the retained occupied deck without duplicating it', () => {
  const r = passengerRig();
  r.peers.sweepOwners(new Set(), 100, 3000); r.peers.frame(0.1);
  r.peers.applyOwner('owner', r.raw, (p) => p, 200); r.peers.frame(0.1);
  assert.equal(r.peers.boatAt('owner', 0), r.b);
  assert.equal(r.peers.shown().flatMap((x) => x.boats).filter((b) => b?.boat === r.b).length, 1);
  assert.equal(r.aboard.frame(r.me), r.b);
});


test('the shipped cabin intake accepts fleet/rider updates from held cells without spawning exterior actors', () => {
  const calls = [];
  const modes = { mode: 'interior', sailingCabin: { uid: 101 } };
  const args = { modes, online: { room: 'world:1,1', inRoom: (k) => k === 'world:1,1' },
    isCellRoom: () => true, exteriorFoes: { applyFoes: () => calls.push('actors') },
    csaPeers: { applyOwner: (...v) => calls.push(['boat', ...v]) }, csaAboard: { applyRider: (...v) => calls.push(['rider', ...v]) },
    campToScene: (p) => p, performance: { now: () => 123 } };
  const receive = new Function(...Object.keys(args), `return (${worldFunction('onFoes')});`)(...Object.values(args));
  receive('guest', { k: 'world:9,9', sa: null, ab: null }); assert.deepEqual(calls, []);
  receive('guest', { k: 'world:1,1', sa: null, ab: null });
  assert.deepEqual(calls.map((c) => c[0]), ['boat', 'rider']);
  modes.sailingCabin = null; modes.mode = 'exterior'; calls.length = 0;
  receive('guest', { k: 'world:1,1', f: [] }); assert.deepEqual(calls, ['actors']);
});
