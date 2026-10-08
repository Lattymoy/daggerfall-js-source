// CABIN-HULL (FIELD BUGS 2026-10-03b, Discord #general, Regi: "i got into my boats interior and then got out and i'm in
// the void" - and of the cabin, "(which is pretty bugged too)": things lying down in holes in the floor's planks).
// A ship's cabin (SAILING-CABINS) is built at her own root (scenes/sailingCabin.js sailingCabinEntry) and her fleet is
// kept afloat while her owner is below (world.js keepExteriorBoats) - and world.js's indoor Come Sail Away arms read a
// boat active indoors as a dungeon's boat that stands in the mode's frame: her hull was baked into the ROOM's collider
// (csaSyncColliders over csaModeCollider), drawn in the room (the host's drawModeMeshes) and pressed from it
// (csaActivationPick, csaActivate). Her decks crossed the room as floors (+0.38 m, +3.5 m over her root), a press there
// opened her rows - Board, the helm - which stood the player on her deck in the BUILDING's frame: her hull drawn in the
// black, nothing else. And the deck the way out lands on had gone with the room's collider.
// Every fixture from its real producer (TEST THE SHAPE THE PRODUCER MINTS): a Small Ship launched from a real deed by the
// real runtime over the vendored hulls (test/csaScene.mjs), a peer's boat built off a wire record csaWireRecord minted,
// the cabin record and its landing from the shipped access (createSailingCabinAccess enter / returnToDeck), the
// player's real motor and the real collider; world.js's own functions lifted from its source (test/fb1001b_peerboats's
// law). THE FOUR HOSTS: world.js is the one host with a cabin (fixed here); worldModes.js builds the room and asks these
// host arms (unchanged); the standalone exterior.js has no sailing runtime and dungeonContext.js no exterior fleet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene } from './csaScene.mjs';
import { createComeSailAwayPeers } from '../src/scenes/comeSailAwayPeers.js';
import { createComeSailAwayAboard, worldOf } from '../src/scenes/comeSailAwayAboard.js';
import { createSailingCabinAccess } from '../src/scenes/sailingCabin.js';
import { hasSailingCabin } from '../src/systems/sailingCabin.js';
import { csaWireRecord } from '../src/systems/comeSailAwayWire.js';
import { mintDeed, mintBoatItem } from '../src/systems/comeSailAwayItems.js';
import { setBoatVariant, TRIGGER_MODEL } from '../src/systems/comeSailAwayBoat.js';
import { activationModelOf, customModelOf, ACTIVATION_DISTANCE, boardPlaceOf } from '../src/systems/comeSailAway.js';
import { colliderPoses, invertAffine, boxColliderTriangles, raycastColliders, BUILTIN_COLLIDER_MESHES } from '../src/world/prefabColliders.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { plaqueActionFor } from '../src/systems/quickLoot.js';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor, FIXED_DT } from '../src/player/motor.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const cut = (start, end = '\n  }\n') => { const i = WORLD.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return WORLD.slice(i, WORLD.indexOf(end, i) + end.length); };
const cutLine = (start) => { const i = WORLD.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return WORLD.slice(i, WORLD.indexOf('\n', i) + 1); };
const SMALL_SHIP = 2;
const IDLE = { forward: 0, strafe: 0 };
const FIRST_FRAME = 0.1;   // world.js's frame clamps dt at 0.1 s: the longest first step the street's motor takes back on deck

/** world.js's own sync, picks, press and the host's two draw arms, lifted over `s` (the frame's scene). */
function liftWorld(s) {
  const body = `
    let { colliderPoses, invertAffine, boxColliderTriangles, csaModeCollider, csaColliderBoats, csaColliderMesh, _csaBoatIds, _csaBoatSerial, csa, modes,
          collider, csaRuntime, csaOn, raycastColliders, RAY_DISTANCE, csaActivationModelOf, bedSleepingOn, csaCustomModelOf, BED_MODELS, CSA_TRIGGER_MODEL,
          getInteractionMode, DEFAULT_ACTIVATION_DISTANCE, CSA_ACTIVATION_DISTANCE, csaAboard, csaPeerActivate, toggleRest, _restFromBed, plaqueActionFor,
          csaBoatVerb, hasSailingCabin, csaOpenBoatMenu, csaCall, worldPlaqueOn, renderer, csaDrawParticlesOpaque, csaDrawParticlesBlended,
          remotePlayers, peerRiders, peerWalkers, gateCourt, sdSpoilsPool, arenaBouts, cam } = s;   // SD9e: and the Brass Remnant's spoils (PIN MOVED)
    ${cutLine('  const _csaBuckets = new Map();')}${cutLine('  const csaBoatId = (boat) =>')}
    ${cut('  const csaShapeOf = (c) =>', ');\n')}${cutLine('  const CSA_RIGID_EPS =')}${cut('  function csaCarry(b, m) {')}
    ${cut('  function csaSyncColliders() {')}
    ${cut('  function csaActivationPick(eye, dir) {')}
    ${cut('  function csaPeerActivationPick(eye, dir) {')}
    ${cut('  const csaActivate = (pick) => {', '\n  };\n')}
    const host = {
    ${cutLine('    extraBillboards: () =>')}${cutLine('    drawModeMeshes: () =>')}${cutLine('    csaDrawParticlesBlended: () =>')}${cutLine('    modeLights: () =>')}    };
    return { sync: csaSyncColliders, pick: csaActivationPick, peerPick: csaPeerActivationPick, activate: csaActivate, host, boatId: csaBoatId };`;
  // eslint-disable-next-line no-new-func
  return new Function('s', body)(s);
}

/**
 * The scene of the pins: my Small Ship launched from her deed at the anchorage (the runtime's own), Ann's Small Ship
 * forty metres east of her built off Ann's word, the street's collider (the anchorage's floor under the sea) and a
 * building's (a room's: no floor of its own here, so whatever stands in it is hers), my motor on the street's, and the
 * mode as worldModes.js says it - `sailingCabin` its getter's (the cabin only while the mode is a building's).
 */
async function rig() {
  const s = scene();
  const pack = [];
  let uid = 100;
  s.deps.items = { create: (t) => mintBoatItem(t, ++uid), addToPlayer: (it) => pack.push(it), player: () => pack };
  const deed = mintDeed(SMALL_SHIP, 0, ++uid, 1); pack.push(deed);
  const own = s.rt.LaunchFromDeed(deed, () => pack, [100, 34, 200], [0, 0, 1], s.terrains[0]);
  assert.ok(own && hasSailingCabin(own), 'a deed ship with a cabin');
  const peerPool = { ready: () => true, spawnPeerNow: (b) => s.deps.pool.spawnNow(b, s.deps.player()), remove: (b) => b.GameObject.setActive(false),
    setVariant: (b, v) => setBoatVariant(b, v, { models: s.deps.pool.models, player: s.deps.player }) };
  const peers = createComeSailAwayPeers({ pool: peerPool, selfId: () => 'me' });
  const ownAt = own.GameObject.position;
  peers.applyOwner('ann', csaWireRecord([{ hull: SMALL_SHIP, variant: 0, position: [ownAt[0] + 40, ownAt[1], ownAt[2]], rotation: [...own.GameObject.rotation], sails: 0, helm: false, light: false }]), (p) => p, 0);
  peers.frame(0.1); peers.frame(0.1);
  const hers = peers.boatAt('ann', 0);
  assert.ok(hers, 'Ann\'s Small Ship stands off her word');
  const geometry = (c) => (c.classicModel != null ? null : c.m_Mesh?.mesh ? s.deps.pool.models.geometry(c.m_Mesh.mesh) : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] ?? null : null);
  const aboard = createComeSailAwayAboard({ peers, geometry, selfId: () => 'me' });
  const colliders = { exterior: new Collider(() => 0), interior: new Collider(() => -Infinity) };
  let interiorCabin = null;
  const modes = { mode: 'exterior', get sailingCabin() { return this.mode === 'interior' ? interiorCabin : null; } };   // worldModes.js's own getter
  const player = new PlayerMotor(colliders.exterior);
  const calls = { draw: 0, opaque: 0, blended: 0, menus: 0, verbs: 0, peerPress: 0 };
  const w = liftWorld({
    colliderPoses, invertAffine, boxColliderTriangles, csaModeCollider: () => colliders[modes.mode], csaColliderBoats: () => s.rt.AllBoats, csaColliderMesh: geometry,
    _csaBoatIds: new WeakMap(), _csaBoatSerial: 0, csa: { get boats() { return s.rt.AllBoats; }, peerBoats: [hers], draw: () => { calls.draw++; }, batches: () => ['crew'], lights: () => ['lantern'] }, modes, collider: colliders.exterior,
    csaRuntime: s.rt, csaOn: () => true, raycastColliders, RAY_DISTANCE, csaActivationModelOf: activationModelOf, bedSleepingOn: () => false, csaCustomModelOf: customModelOf,
    BED_MODELS: [], CSA_TRIGGER_MODEL: TRIGGER_MODEL, getInteractionMode: () => 'grab', DEFAULT_ACTIVATION_DISTANCE, CSA_ACTIVATION_DISTANCE: ACTIVATION_DISTANCE,
    csaAboard: aboard, csaPeerActivate: () => { calls.peerPress++; }, toggleRest: () => {}, _restFromBed: false, plaqueActionFor, csaBoatVerb: () => { calls.verbs++; },
    hasSailingCabin, csaOpenBoatMenu: () => { calls.menus++; }, csaCall: (f) => f(), worldPlaqueOn: () => false, renderer: {},
    csaDrawParticlesOpaque: () => { calls.opaque++; }, csaDrawParticlesBlended: () => { calls.blended++; },
    arenaBouts: { batches: () => [] }, cam: { pos: [0, 0, 0] },
  });
  // the shipped access, over this world: the cabin record and the landing are its own
  const entered = [];
  const access = createSailingCabinAccess({
    available: () => true, boats: () => s.rt.AllBoats, sailing: () => s.rt.isSailing(), disembarking: () => !!s.rt.state.disembarking,
    aboard: () => player.grounded && String(player.groundKey).startsWith(`csaBoat:${w.boatId(own)}:`), mode: () => modes.mode, busy: () => false,
    nearby: () => true, feet: () => [...player.pos], yaw: () => 0.3, toNative: (p) => [...p], fromNative: (p) => [...p],
    enterInterior: async (c) => { entered.push(c); return true; }, say: () => {},
  });
  const keyOf = (boat) => `csaBoat:${w.boatId(boat)}:`;
  const stands = (col, boat) => [...col._buckets.keys()].some((k) => k.startsWith(keyOf(boat)));
  const pose = (boat) => ({ position: [...boat.GameObject.position], rotation: [...boat.GameObject.rotation] });
  /** One street frame in world.js's order: the motor, then the mod's step's sync. */
  const streetFrame = (dt = FIXED_DT) => { player.update(dt, IDLE, 0); w.sync(); };
  /** Stood on her deck, outside, where the cabin's verb asks me to stand (scenes/sailingCabin.js cabinEntryRefusal). */
  const standAboard = () => {
    w.sync();
    const at = worldOf(pose(own), [0, 10, -5]);
    player.spawn(at[0], at[1], at[2]);
    for (let i = 0; i < 180; i++) streetFrame();
    assert.ok(player.grounded && String(player.groundKey).startsWith(keyOf(own)), `stood on her deck (${player.groundKey}, feet ${player.pos[1].toFixed(2)})`);
  };
  /** The verb pressed and the room entered as worldModes.js commits it (interiorCabin, the mode, the room's collider). */
  const goBelow = async () => {
    assert.equal(await access.enter(own), true, 'Enter cabin');
    interiorCabin = entered.at(-1);
    modes.mode = 'interior';
    player.collider = colliders.interior;
    for (let i = 0; i < 3; i++) w.sync();   // the building's frames: host.csaFrame -> csaUpdate -> csaSyncColliders
  };
  /** Return to deck as worldModes.js exitInteriorNow takes it: the landing the access resolves, the street's collider, the mode. */
  const comeUp = () => {
    const landing = access.returnToDeck(interiorCabin);
    assert.ok(landing, 'her deck resolved');
    interiorCabin = null;
    player.collider = colliders.exterior;
    player.spawn(landing.position[0], landing.position[1], landing.position[2]);
    modes.mode = 'exterior';
    return landing.position;
  };
  return { s, own, hers, peers, aboard, colliders, modes, player, w, calls, access, keyOf, stands, pose, streetFrame, standAboard, goBelow, comeUp };
}

test('CABIN-HULL: below deck her hull stands in the street\'s collider, never in her cabin\'s - the room built at her root holds none of her decks as floors, and Ann\'s boat moored beside her stays solid outside too (mutants: the street\'s collider for a cabin dropped; the peers\' while below)', async () => {
  const r = await rig();
  r.standAboard();
  assert.ok(r.stands(r.colliders.exterior, r.own) && r.stands(r.colliders.exterior, r.hers), 'on deck: both hulls in the street\'s collider');
  await r.goBelow();
  assert.equal(r.modes.sailingCabin?.uid, r.own.uid, 'below deck in her own cabin');
  assert.ok(!r.stands(r.colliders.interior, r.own), 'none of her buckets in the room\'s collider');
  assert.deepEqual([...r.colliders.interior._buckets.keys()].filter((k) => k.startsWith('csaBoat:')), [], 'no boat\'s bucket at all in the room');
  // straight down through her root: the room's collider meets nothing of hers (her decks stood at +0.38 and +3.5 m)
  const root = r.own.GameObject.position;
  assert.ok(!Number.isFinite(r.colliders.interior.raycast([root[0], root[1] + 20, root[2] - 5], [0, -1, 0], 40)), 'no floor of hers in the room');
  assert.ok(r.stands(r.colliders.exterior, r.own), 'her hull still stands in the street\'s collider');
  assert.ok(r.stands(r.colliders.exterior, r.hers), 'and Ann\'s');
});

test('CABIN-HULL: Return to deck lands on a deck that is already there - the street\'s motor takes its first step (a whole 0.1 s frame, before the mod\'s step stands any boat again) standing on her own bucket where the access put me (mutant: the street\'s collider for a cabin dropped)', async () => {
  const r = await rig();
  r.standAboard();
  const stood = [...r.player.pos];
  await r.goBelow();
  const landing = r.comeUp();
  assert.ok(Math.hypot(landing[0] - stood[0], landing[1] - stood[1], landing[2] - stood[2]) < 1e-6, 'the landing is where I stood');
  r.player.update(FIRST_FRAME, IDLE, 0);   // world.js: the motor (player.update) runs before csaUpdate's sync
  assert.ok(r.player.grounded && String(r.player.groundKey).startsWith(r.keyOf(r.own)), `the first step stands on her deck (${r.player.groundKey}, feet ${r.player.pos[1].toFixed(3)} from ${landing[1].toFixed(3)})`);
  assert.ok(Math.abs(r.player.pos[1] - landing[1]) < 0.05, `and where it landed (${r.player.pos[1].toFixed(3)} against ${landing[1].toFixed(3)})`);
});

test('CABIN-HULL: below deck no boat answers a press - her hull under the room\'s floor, the ladder\'s box a press took to her deck, Ann\'s boat; a pick held from the deck is not pressed below; on deck every one of them answers as before (mutants: the pick\'s guard, the peer pick\'s, the press\'s)', async () => {
  const r = await rig();
  r.standAboard();
  const p = r.pose(r.own), q = r.pose(r.hers);
  const at = (pose, l) => worldOf(pose, l);
  const down = [0, -1, 0];
  const floorRay = [at(p, [0, 1.6, -5]), down];   // from a standing eye at her root: what was the cabin's floor
  const annRay = [at(q, [0, 1.6, -5]), down];
  // her ladder's box (BoardBoat): a ray at it from three metres outboard, level
  const ladder = r.own.BoardTriggers.find((n) => activationModelOf(n.name) === TRIGGER_MODEL.board);
  const lp = ladder.position, out = Math.sign(lp[0] - p.position[0]) || 1;
  const ladderRay = [[lp[0] + out * 3, lp[1], lp[2]], [-out, 0, 0]];
  const onDeck = { floor: r.w.pick(...floorRay), ladder: r.w.pick(...ladderRay), ann: r.w.peerPick(...annRay) };
  assert.ok(onDeck.floor && onDeck.floor.boat === r.own && onDeck.floor.distance <= ACTIVATION_DISTANCE, `on deck: her hull answers within reach (${onDeck.floor?.key} at ${onDeck.floor?.distance})`);
  assert.ok(onDeck.ladder && onDeck.ladder.modelId === TRIGGER_MODEL.board && onDeck.ladder.distance <= ACTIVATION_DISTANCE, `on deck: her ladder's box answers within reach (${onDeck.ladder?.key} at ${onDeck.ladder?.distance})`);
  assert.ok(onDeck.ann && onDeck.ann.owner === 'ann', 'on deck: Ann\'s boat answers');
  await r.goBelow();
  assert.equal(r.w.pick(...floorRay)?.key ?? null, null, 'below: her hull under the cabin\'s floor answers nothing');   // the key, never the pick: a failure prints its actual, and a pick holds her whole hull
  assert.equal(r.w.pick(...ladderRay)?.key ?? null, null, 'below: her ladder\'s box answers nothing');
  assert.equal(r.w.peerPick(...annRay)?.key ?? null, null, 'below: Ann\'s boat answers nothing');
  // the press: the ladder's pick taken on deck, pressed below - BoardBoat would stand me on her deck in the building's frame
  const before = [...r.s.player.position];
  r.w.activate(onDeck.ladder);
  r.w.activate(onDeck.floor);
  r.w.activate({ ...onDeck.ann, peer: true });
  assert.deepEqual(r.s.player.position, before, 'below: no press moved me (BoardBoat\'s setPlayerPosition never ran)');
  assert.deepEqual([r.calls.menus, r.calls.verbs, r.calls.peerPress], [0, 0, 0], 'below: no boat\'s rows opened, no verb, no peer press');
  // and on deck again the same press boards her: the guard is the cabin's alone
  r.comeUp();
  r.w.activate(onDeck.ladder);
  const board = boardPlaceOf(onDeck.ladder.hit.node).position;
  assert.deepEqual(r.s.player.position.map((v) => +v.toFixed(4)), board.map((v) => +v.toFixed(4)), 'on deck: her ladder\'s press stands me at its place (BoardBoat)');
});

test('CABIN-HULL: below deck the fleet is not drawn in the room - neither her hull nor its wake, splashes and drops; in a dungeon (a boat on its water) and outside the host\'s arms draw as before; nor its crew, lanterns and lights (mutants: drawModeMeshes\' cabin guard; csaDrawParticlesBlended\'s; extraBillboards\'; modeLights\')', async () => {
  const r = await rig();
  r.standAboard();
  await r.goBelow();
  r.w.host.drawModeMeshes(); r.w.host.csaDrawParticlesBlended();
  assert.deepEqual([r.calls.draw, r.calls.opaque, r.calls.blended], [0, 0, 0], 'nothing of the fleet drawn in her cabin');
  assert.deepEqual([r.w.host.extraBillboards(), r.w.host.modeLights()], [[], []], 'her crew and lanterns neither stand nor light in her cabin');
  r.comeUp();
  r.modes.mode = 'dungeon';   // a dungeon's frame: the boat UpdateBoatVisibility keeps on its water is drawn there
  r.w.host.drawModeMeshes(); r.w.host.csaDrawParticlesBlended();
  assert.deepEqual([r.calls.draw, r.calls.opaque, r.calls.blended], [1, 1, 1], 'a dungeon\'s frame draws its boat, its quads and its drops');
  assert.deepEqual([r.w.host.extraBillboards(), r.w.host.modeLights()], [['crew'], ['lantern']], 'and its crew and lanterns');
});
