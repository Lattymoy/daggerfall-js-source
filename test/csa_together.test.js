// CSA-K / CSA-L (2026-09-28) - SAILING TOGETHER, AND THE HELM ON SCREEN (the player's ask: "I want people to be able to
// sail together, to walk on board as it moves ... instead of an overuse of keybinds, is there a way we can instead
// develop enhanced plus UI elements?"). The boat under way says its way (systems/comeSailAwayWire.js `m`) and its
// readers lead it (scenes/comeSailAwayPeers.js); another player's boat is boarded, stood on, carried by and left
// (scenes/comeSailAwayAboard.js), the deck standing for everyone (FIELD BUGS 2026-10-01b); the others aboard are seen on the deck; the helm's
// nine keys are a panel (ui/enhancedHelm.js) and a pad's d-pad (ui/gamepadInput.js), pressing the registry's actions
// through the host's one seam (scenes/world.js). The boats are the vendored hulls over a stand-in renderer and pipeline
// (test/csa_online.test.js's); world.js's own statements are mounted where they are behaviour (audit0928_online's law).
import { test } from 'node:test';
import { HELM_RUDDER_ACTIONS } from '../src/systems/inputActions.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { createComeSailAwayPeers, CSA_PEER_LEAD_MAX, CSA_PEER_SNAP_M } from '../src/scenes/comeSailAwayPeers.js';
import {
  createComeSailAwayAboard, validAboardWord, localOf, worldOf, poseMatrix, CSA_ABOARD_BELOW, CSA_ABOARD_STEP, CSA_ABOARD_NEAR, CSA_ABOARD_GRACE, CSA_ABOARD_LOCAL_MAX,
  deckPose,
} from '../src/scenes/comeSailAwayAboard.js';
import { csaWireRecord, validCsaRecord, csaRecordKey, CSA_WIRE_SPEED_MAX, CSA_WIRE_TURN_MAX } from '../src/systems/comeSailAwayWire.js';
import { TRIGGER_MODEL } from '../src/systems/comeSailAwayBoat.js';
import { activationModelOf, boardPlaceOf, BOAT_ACTIONS, carriedPoint, yawDelta } from '../src/systems/comeSailAway.js';
import { raycastColliders, BUILTIN_COLLIDER_MESHES } from '../src/world/prefabColliders.js';
import { quatAngleAxis, quatMultiply } from '../src/world/quat.js';
import { helmButtons, drawEnhancedHelm, hideEnhancedHelm, enhancedHelmMounted, enhancedHelmBar, helmPadGesture, helmPadPrompts, HELM_ACTIONS, HELM_CSS, ENHANCED_HELM_ID } from '../src/ui/enhancedHelm.js';
import { HELM_DPAD } from '../src/ui/plusPad.js';
import { FRAME_ROLES } from '../src/ui/enhancedFrame.js';
import { fakeDoc, all, one } from './decorFakes.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
function recordingRenderer() {
  const r = { drawn: [], batches: [], destroyed: [] };
  r.createMesh = (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) });
  r.drawMesh = (mesh, matrix) => r.drawn.push({ mesh, matrix });
  r.updateMeshVertices = () => {};
  r.createBillboardBatch = (archive, record, size, centers, opts) => { const b = { archive, record, size, centers, opts }; r.batches.push(b); return b; };
  r.destroyBillboardBatch = (b) => r.destroyed.push(b);
  r.destroyMesh = (m) => r.destroyed.push(m);
  return r;
}
function standInPipeline() {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const textureFiles = new Map(), cpuModels = new Map(), gpuMeshes = new Map();
  return {
    textureFiles, cpuModels, gpuMeshes,
    getTexture: async (a) => { if (!textureFiles.has(a)) textureFiles.set(a, texture()); return textureFiles.get(a); },
    uploadRecord: () => {},
    getGpuMesh: async (id) => { cpuModels.set(id, { positions: new Float32Array([-1, 0, -2, 1, 1.5, 2]) }); const g = { classic: id }; gpuMeshes.set(id, g); return g; },
  };
}
async function readyPool() {
  const pool = createComeSailAwayPool({ renderer: recordingRenderer(), pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  return pool;
}
/** world.js csaColliderMesh's reading over the pool's own models (a classic model's is none here). */
const geometryOf = (pool) => (c) => (c.classicModel != null ? null : c.m_Mesh?.mesh ? pool.models.geometry(c.m_Mesh.mesh) : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] ?? null : null);
const Q0 = [0, 0, 0, 1];
const word = (over = {}) => [over.hull ?? 1, over.variant ?? 0, over.x ?? 10, over.y ?? 34, over.z ?? 20, ...(over.q ?? Q0), over.sails ?? 0, over.helm ?? 0, over.light ?? 0];
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const nearV = (a, b, eps = 1e-6, msg = '') => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => assert.ok(near(v, b[i], eps), `${msg} [${i}] ${v} vs ${b[i]}`)); };
const yawOf = (q) => (Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[0] * q[0])) * 180) / Math.PI;

// ── the way on the wire ────────────────────────────────────────────────────────

test('CSA-K: the boat at the helm says its way - `m` beside `b`, a place for each boat: its velocity through the wire frame (the point a second on, converted, less the point) and its turn, to the centimetre; a boat only turning says it too; a moored fleet says no `m` at all (the record an older reader reads is unchanged), and the change key carries the way', () => {
  const toWire = (p) => [p[0] * 40 + 1000, p[1] - 5, p[2] * 40 - 2000];   // the natives' scale (SCENE_MAP_RATIO) and a corner
  const moored = { hull: 1, variant: 0, position: [1, 34, 2], rotation: Q0, sails: 0, helm: false, light: false };
  const sailing = { ...moored, position: [5, 34, 6], helm: true, velocity: [1.5, 0, -0.25], turn: 12.345 };
  const rec = csaWireRecord([moored, sailing], toWire);
  assert.deepEqual(rec.m, [[0, 0, 0], [60, -10, 12.35]], 'metres a second to natives a second; the turn in degrees');
  assert.equal(rec.b.length, 2);
  assert.deepEqual(csaWireRecord([moored, { ...sailing, velocity: [0, 0, 0], turn: 0 }], toWire), { b: csaWireRecord([moored, sailing], toWire).b.map((w, i) => (i === 1 ? [...w] : w)) }, 'nothing under way: the record is `b` alone');
  assert.equal(Object.keys(csaWireRecord([{ ...sailing, velocity: [-0.0001, 0, 0], turn: -0.001 }], toWire)).includes('m'), false, 'a way that rounds to nothing is none');
  assert.deepEqual(csaWireRecord([{ ...sailing, velocity: [0, 0, 0], turn: -20 }], toWire).m, [[0, 0, -20]], 'turning on the spot is a way');
  assert.deepEqual(csaWireRecord([{ ...sailing, velocity: [0, 0, 0.5], turn: 0 }], toWire).m, [[0, 20, 0]], 'straight ahead is a way');
  const key = csaRecordKey(rec);
  assert.notEqual(key, csaRecordKey({ b: rec.b }), 'a boat brought up short at the same place is a new word');
  assert.equal(csaRecordKey({ b: rec.b }), JSON.stringify(rec.b), 'a still fleet\'s key is the old one');
});

test('CSA-K: a peer\'s way through the door - aligned with the boats, three finite numbers each, a boat\'s speed and turn; the velocity lands as [x, 0, z] and the turn beside it; a record without `m` lands none; any bad way drops the record whole (the door\'s law)', () => {
  const ok = validCsaRecord({ b: [word(), word({ hull: 0 })], m: [[3, -4, 20], [0, 0, 0]] });
  assert.deepEqual(ok.boats.map((b) => [b.velocity, b.turn]), [[[3, 0, -4], 20], [[0, 0, 0], 0]]);
  const old = validCsaRecord({ b: [word()] });
  assert.equal('velocity' in old.boats[0], false, 'an older owner\'s word leads nothing');
  assert.equal('turn' in old.boats[0], false);
  for (const [m, why] of [
    [[[1, 1, 1]], 'one way for two boats'], [[[1, 1, 1], [1, 1, 1], [1, 1, 1]], 'three for two'], [[[1, 1], [0, 0, 0]], 'two numbers'],
    [[[1, 1, 1, 1], [0, 0, 0]], 'four numbers'], [[[NaN, 0, 0], [0, 0, 0]], 'NaN'], [[[Infinity, 0, 0], [0, 0, 0]], 'Infinity'],
    [[[CSA_WIRE_SPEED_MAX, 1, 0], [0, 0, 0]], 'a speed past a boat\'s'], [[[0, 0, CSA_WIRE_TURN_MAX + 1], [0, 0, 0]], 'a turn past one'],
    [[[0, 0, -CSA_WIRE_TURN_MAX - 1], [0, 0, 0]], 'a turn past one, the other way'], ['fast', 'not an array'], [null, 'null'], [[null, [0, 0, 0]], 'a null way'],
  ]) assert.equal(validCsaRecord({ b: [word(), word({ hull: 0 })], m }), null, why);
  assert.ok(validCsaRecord({ b: [word(), word({ hull: 0 })], m: [[CSA_WIRE_SPEED_MAX * 0.6, CSA_WIRE_SPEED_MAX * 0.6, CSA_WIRE_TURN_MAX], [0, 0, -CSA_WIRE_TURN_MAX]] }), 'at the bounds: a boat');
});

// ── the readers lead it ────────────────────────────────────────────────────────

test('CSA-K: a word under way LEADS the boat - carried on by its way every frame and eased to the word led from its arrival, so it moves at the owner\'s even speed (never five surges a second); past CSA_PEER_LEAD_MAX a late word leads no further; a word with no way stands where it says; the turn leads the same way', async () => {
  const pool = await readyPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  peers.applyOwner('ann', { b: [word({ x: 10 })], m: [[5, 0, 0]] }, (p) => p, 0);
  const xs = [];
  for (let i = 0; i < 10; i++) { peers.frame(0.1); xs.push(pool.peerBoats[0].GameObject.position[0]); }
  const steps = xs.slice(1).map((x, i) => x - xs[i]);
  nearV(steps.slice(0, 4), [0.5, 0.5, 0.5, 0.5], 1e-9, 'half a metre each tenth of a second');
  nearV([xs[0]], [10.5], 1e-9, 'the first frame stands it on its word led one frame');
  const held = xs[Math.round(CSA_PEER_LEAD_MAX / 0.1) + 2];
  nearV([held], [10 + 5 * CSA_PEER_LEAD_MAX], 1e-6, `led no further than ${CSA_PEER_LEAD_MAX} s`);
  nearV([xs[9]], [held], 1e-6, 'and held there until the next word');
  // the next word, a lead's worth on: no jump, no stall
  peers.applyOwner('ann', { b: [word({ x: 10 + 5 * 0.9 })], m: [[5, 0, 0]] }, (p) => p, 900);
  peers.frame(0.1);
  assert.ok(pool.peerBoats[0].GameObject.position[0] > held, 'on again');
  // no way: the word's place, eased
  const p2 = createComeSailAwayPeers({ pool: await readyPool(), selfId: () => 'me' });
  p2.applyOwner('bob', { b: [word({ x: 10 })] }, (p) => p, 0);
  p2.frame(0.1); p2.frame(0.1);
  nearV([p2.shown()[0].boats[0].position[0]], [10], 1e-9, 'a moored word stands where it says');
  // the turn: 90 degrees a second, Rotate(up * turn) in the boat's own frame
  const p3pool = await readyPool();
  const p3 = createComeSailAwayPeers({ pool: p3pool, selfId: () => 'me' });
  p3.applyOwner('cyd', { b: [word()], m: [[0, 0, 90]] }, (p) => p, 0);
  p3.frame(0.1); p3.frame(0.1); p3.frame(0.1);
  assert.ok(near(yawOf(p3pool.peerBoats[0].GameObject.rotation), 27, 0.05), `led to 27 degrees (${yawOf(p3pool.peerBoats[0].GameObject.rotation)})`);
});

test('CSA-K: each boat\'s frame keeps the pose before it - moveOf: none the frame it is built, before and after while it moves, none across a snap (a teleport carries nobody); poseAhead is the next frame\'s pose, peeked; boatAt and placeOf name a peer\'s boat by its owner\'s place', async () => {
  const pool = await readyPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  peers.applyOwner('ann', { b: [word({ hull: 0 }), word({ x: 10 })], m: [[0, 0, 0], [5, 0, 0]] }, (p) => p, 0);
  peers.frame(0.1); peers.frame(0.1);
  const boat = peers.boatAt('ann', 1);
  assert.ok(boat && boat.hull === 1, 'the second place is the Large Boat');
  assert.deepEqual(peers.placeOf(boat), { owner: 'ann', slot: 1 });
  assert.equal(peers.placeOf({}), null, 'no peer\'s');
  assert.equal(peers.boatAt('ann', 5), null);
  const ahead = peers.poseAhead(boat, 0.1);
  peers.frame(0.1);
  const mv = peers.moveOf(boat);
  nearV(mv.after.position, ahead.position, 1e-12, 'the peek is the frame');
  nearV(mv.after.rotation, ahead.rotation, 1e-12);
  nearV([mv.after.position[0] - mv.before.position[0]], [0.5], 1e-9, 'before and after this frame');
  // a teleport: past the snap, no move to carry anyone by
  peers.applyOwner('ann', { b: [word({ hull: 0 }), word({ x: 10 + CSA_PEER_SNAP_M * 3 })] }, (p) => p, 400);
  peers.frame(0.1);
  assert.equal(peers.moveOf(peers.boatAt('ann', 1)), null, 'a snap carries nobody');
  // a boat just built: none
  peers.applyOwner('bob', { b: [word()] }, (p) => p, 500);
  peers.frame(0.1);
  const fresh = peers.boatAt('bob', 0);
  assert.ok(fresh);
  assert.equal(peers.moveOf(fresh), null, 'built this frame: no pose before it');
});

test('FIELD BUGS 2026-10-09 #7: a word that drops a boat (or changes its hull) before the frame realigns it - poseAhead answers null for the place it no longer names, never "reading \'velocity\' of undefined"', async () => {
  const pool = await readyPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  peers.applyOwner('ann', { b: [word({ hull: 0 }), word({ x: 10 })], m: [[0, 0, 0], [5, 0, 0]] }, (p) => p, 0);
  peers.frame(0.1); peers.frame(0.1);
  const second = peers.boatAt('ann', 1);
  assert.ok(second && peers.poseAhead(second, 0.1), 'stood and led');
  // her word now names one boat: the second place still stands until the next frame's realign
  peers.applyOwner('ann', { b: [word({ hull: 0 })] }, (p) => p, 100);
  assert.equal(peers.boatAt('ann', 1), second, 'still standing, unmatched');
  assert.equal(peers.poseAhead(second, 0.1), null, 'no place in her word: no pose ahead');
  // her word names the first place for another hull
  const first = peers.boatAt('ann', 0);
  peers.applyOwner('ann', { b: [word({ hull: 1 })] }, (p) => p, 200);
  assert.equal(peers.poseAhead(first, 0.1), null, 'another hull: no pose ahead');
  peers.frame(0.1);
  assert.equal(peers.boatAt('ann', 1), null, 'the frame matched her word');
});

// ── aboard ─────────────────────────────────────────────────────────────────────

/** A peer's Large Boat standing at (10, 34, 20), its deck found under its ladder's place, and an aboard machine. */
async function deckRig({ m = null } = {}) {
  const pool = await readyPool();
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  peers.applyOwner('ann', { b: [word({ x: 10, z: 20 })], ...(m ? { m } : {}) }, (p) => p, 0);
  peers.frame(0.1); peers.frame(0.1);
  const boat = peers.boatAt('ann', 0);
  const geometry = geometryOf(pool);
  const aboard = createComeSailAwayAboard({ peers, geometry, selfId: () => 'me' });
  const ladder = boat.BoardTriggers[0];
  const at = boardPlaceOf(ladder);
  const hit = raycastColliders(boat.GameObject, [at.position[0], at.position[1] + 1, at.position[2]], [0, -1, 0], 6, { triggers: false, geometry });
  assert.ok(hit, 'a deck under the ladder\'s place');
  const deck = hit.point;
  const me = { feet: [...deck], height: 1.8, swimming: false, ground: null, carried: [], allowed: true };
  const view = () => ({
    allowed: me.allowed, feet: () => me.feet, height: me.height, swimming: me.swimming,
    ground: (b) => (typeof me.ground === 'function' ? me.ground(b) : me.ground),
    carry: (d, yaw) => { me.carried.push([d, yaw]); me.feet = [me.feet[0] + d[0], me.feet[1] + d[1], me.feet[2] + d[2]]; },
  });
  return { pool, peers, boat, aboard, deck, me, view, ladder, geometry };
}

test('CSA-K: ABOARD by landing on the deck from above - in the air over it, the ray down from the centre meeting its colliders no higher than a step over the feet; never taken off what the body stands on (a pier over a moored boat), never from the water (the ladder is the way up), never a boat past CSA_ABOARD_NEAR', async () => {
  const r = await deckRig();
  r.me.feet = [r.deck[0], r.deck[1] + 2, r.deck[2]];   // falling onto it, two metres up
  r.me.ground = 'other';   // standing on a pier over it
  assert.equal(r.aboard.frame(r.view()), null, 'standing on something else: not aboard');
  r.me.ground = null; r.me.swimming = true;
  assert.equal(r.aboard.frame(r.view()), null, 'afloat: not aboard (inside a hull the ray meets its floor from within)');
  r.me.swimming = false;
  assert.equal(r.aboard.frame(r.view()), r.boat, 'in the air over its deck: aboard');
  assert.deepEqual(r.aboard.aboard && { owner: r.aboard.aboard.owner, slot: r.aboard.aboard.slot }, { owner: 'ann', slot: 0 });
  // under the deck, or a deck standing in the body (a step and more over the feet): not aboard
  const r2 = await deckRig();
  r2.me.feet = [r2.deck[0], r2.deck[1] - CSA_ABOARD_STEP - 0.05, r2.deck[2]];
  assert.equal(r2.aboard.frame(r2.view()), null, 'the deck over the feet is in the body, not under it');
  r2.me.feet = [r2.deck[0], r2.deck[1] + 0.9 + CSA_ABOARD_BELOW + 0.2, r2.deck[2]];
  assert.equal(r2.aboard.frame(r2.view()), null, 'too far above: not met yet');
  r2.me.feet = [r2.deck[0], r2.deck[1] + CSA_ABOARD_BELOW - 0.2, r2.deck[2]];
  assert.equal(r2.aboard.frame(r2.view()), r2.boat, 'within reach below: met');
  // a boat farther than CSA_ABOARD_NEAR is never asked
  const r3 = await deckRig();
  const calls = [];
  const far = { ...r3.view(), feet: () => [r3.boat.GameObject.position[0] + CSA_ABOARD_NEAR + 1, r3.deck[1] + 1, r3.boat.GameObject.position[2]], ground: (b) => { calls.push(b); return null; } };
  assert.equal(r3.aboard.frame(far), null);
  assert.equal(calls.length, 0, 'not even its ground asked');
});

test('CSA-K: CARRIED by the boat\'s move - the feet kept at their place on the deck (the helm\'s child\'s law, carriedPoint) and the facing turned with it (yawDelta); my word is that place in the boat\'s own frame, to the centimetre', async () => {
  const r = await deckRig({ m: [[4, 0, 30]] });   // under way and turning
  r.me.feet = [r.deck[0], r.deck[1], r.deck[2]];
  r.me.ground = (b) => (b === r.boat ? 'boat' : 'other');
  assert.ok(r.aboard.frame(r.view()) === r.boat, 'standing on its colliders: aboard (FIELD BUGS 2026-10-01b - they stand for everyone, as one\'s own boat\'s do; a landing is the ABOARD pin\'s)');
  const pose = () => ({ position: [...r.boat.GameObject.position], rotation: [...r.boat.GameObject.rotation] });
  const was = pose();
  const local = localOf(was, r.me.feet);
  r.peers.frame(0.1);
  const now = pose();
  r.me.carried.length = 0;
  assert.equal(r.aboard.frame(r.view()), r.boat, 'still aboard: standing on its deck');
  assert.equal(r.me.carried.length, 1, 'one carry a frame');
  const [d, yaw] = r.me.carried[0];
  assert.ok(Math.hypot(d[0], d[2]) > 0.3, 'moved with the boat');
  nearV(localOf(now, r.me.feet), local, 1e-9, 'the same place on the deck');
  const want = carriedPoint(poseMatrix(was), poseMatrix(now), [r.deck[0], r.deck[1], r.deck[2]]);
  nearV(r.me.feet, want, 1e-9, 'the helm\'s own law');
  assert.ok(near(yaw, yawDelta(poseMatrix(was), poseMatrix(now)), 1e-12) && Math.abs(yaw) > 1, `turned with it (${yaw} degrees)`);
  const w = r.aboard.word(r.me.feet);
  assert.deepEqual(w.slice(0, 2), ['ann', 0]);
  nearV(w.slice(2), localOf(now, r.me.feet).map((v) => Math.round(v * 100) / 100), 1e-12, 'the feet in the boat\'s frame, centimetres');
  // in the air over the deck (a jump): still carried
  r.me.ground = null;
  r.me.feet = [r.me.feet[0], r.me.feet[1] + 1, r.me.feet[2]];
  r.peers.frame(0.1);
  r.me.carried.length = 0;
  assert.equal(r.aboard.frame(r.view()), r.boat, 'a jump on the deck: aboard');
  assert.equal(r.me.carried.length, 1, 'carried in the air too');
});

test('CSA-K: OFF - walking off the side (nothing of it under the body, nothing of it stood on), standing on something else, swimming, the host\'s leave (a transition, a death, the mod off), the boat gone and a jump of the boat\'s each put the one aboard off, the word null', async () => {
  const off = async (mutate, why) => {
    const r = await deckRig();
    r.me.feet = [r.deck[0], r.deck[1] + 0.5, r.deck[2]];
    assert.equal(r.aboard.frame(r.view()), r.boat, `${why}: aboard first`);
    r.peers.frame(0.1);
    mutate(r);
    assert.equal(r.aboard.frame(r.view()), null, why);
    assert.equal(r.aboard.aboard, null);
    assert.equal(r.aboard.word(r.me.feet), null, `${why}: the word says none`);
  };
  await off((r) => { r.me.feet = [r.boat.GameObject.position[0] + 40, r.deck[1] + 0.5, r.boat.GameObject.position[2]]; }, 'over the water past its side');
  await off((r) => { r.me.ground = 'other'; }, 'standing on something else');
  await off((r) => { r.me.swimming = true; }, 'swimming');
  await off((r) => { r.me.allowed = false; }, 'the host\'s leave');
  await off((r) => { r.peers.applyOwner('ann', null, (p) => p, 1); }, 'the boat gone with its owner\'s word');
  await off((r) => { r.peers.applyOwner('ann', { b: [word({ x: 10 + CSA_PEER_SNAP_M * 4, z: 20 })] }, (p) => p, 1); r.peers.frame(0.1); }, 'a snap: nobody carried across a teleport');
  // standing on its own deck keeps them aboard even where the centre's ray passes its edge
  const r = await deckRig();
  r.me.feet = [r.deck[0], r.deck[1] + 0.5, r.deck[2]];
  r.aboard.frame(r.view());
  r.me.ground = (b) => (b === r.boat ? 'boat' : 'other');
  r.me.feet = [r.boat.GameObject.position[0] + 40, r.deck[1], r.boat.GameObject.position[2]];
  assert.equal(r.aboard.frame(r.view()), r.boat, 'the motor stands on its collider: aboard');
});

test('CSA-K: the LADDER - BoardBoat\'s place on another\'s boat (boardPlaceOf, the mod\'s own sibling before the trigger) and aboard at once, the ground\'s law held off CSA_ABOARD_GRACE frames (the motor has not stood there yet); a boat that is no peer\'s boards nothing', async () => {
  const r = await deckRig();
  const at = r.aboard.boardPlace({ node: r.ladder });
  assert.deepEqual(at, boardPlaceOf(r.ladder));
  const parent = r.ladder.parent;
  assert.equal(parent.getChild(parent.children.indexOf(r.ladder) - 1).name, 'BoardPosition', 'the mod\'s own place');
  assert.equal(r.aboard.board({ GameObject: r.boat.GameObject }, CSA_ABOARD_GRACE), false, 'no peer\'s boat: nothing');
  assert.equal(r.aboard.board(r.boat, CSA_ABOARD_GRACE), true);
  r.me.feet = [...at.position];
  r.me.ground = 'other'; r.me.swimming = true;   // the frame's flags are the step before the ladder
  for (let i = 0; i < CSA_ABOARD_GRACE; i++) { r.peers.frame(0.1); assert.equal(r.aboard.frame(r.view()), r.boat, `grace frame ${i + 1}`); }
  r.peers.frame(0.1);
  assert.equal(r.aboard.frame(r.view()), null, 'past the grace the ground\'s law holds again');
});

test('CSA-K: THE OTHERS ABOARD - a word through the door ([owner, place, x, y, z] within the bound), never my own, a bad one drops the sender\'s; each stands on its boat as it is drawn here at the eased place (glue), the rest pass untouched; gone from the room or quiet, and a clear, take theirs; an owner counts them', () => {
  assert.deepEqual(validAboardWord(['ann', 2, 1.5, 0.25, -3]), { owner: 'ann', slot: 2, local: [1.5, 0.25, -3] });
  for (const [raw, why] of [
    [null, 'null'], [['ann', 0, 1, 2], 'four'], [['ann', 0, 1, 2, 3, 4], 'six'], [['', 0, 1, 2, 3], 'no owner'], [[5, 0, 1, 2, 3], 'an owner not a string'],
    [['x'.repeat(65), 0, 1, 2, 3], 'an owner too long'], [['ann', -1, 1, 2, 3], 'a place below the list'], [['ann', 8, 1, 2, 3], 'past eight boats'],
    [['ann', 1.5, 1, 2, 3], 'a fractional place'], [['ann', 0, NaN, 2, 3], 'NaN'], [['ann', 0, CSA_ABOARD_LOCAL_MAX + 1, 2, 3], 'past the bound'],
    [['ann', 0, 1, -CSA_ABOARD_LOCAL_MAX - 1, 3], 'past the bound below'],
  ]) assert.equal(validAboardWord(raw), null, why);
  const aboard = createComeSailAwayAboard({ peers: { shown: () => [], placeOf: () => null, moveOf: () => null }, geometry: () => null, selfId: () => 'me' });
  assert.equal(aboard.applyRider('me', ['ann', 0, 1, 2, 3], 0), false, 'my own word is never a rider\'s');
  assert.equal(aboard.applyRider('bob', ['ann', 0, 1, 2, 3], 100), true);
  assert.equal(aboard.applyRider('cyd', ['ann', 1, 0, 0, 0], 100), true);
  assert.equal(aboard.passengersOn('ann', 0), 1);
  assert.equal(aboard.passengersOn('ann', 1), 1);
  assert.equal(aboard.passengersOn('ann', 2), 0);
  // the glue: bob on ann's first boat, turned a quarter and moved; the frame's ease taken whole (a long dt)
  const pose = { position: [100, 34, 200], rotation: quatAngleAxis(90, [0, 1, 0]) };
  const toWire = (p) => [p[0] * 40, p[1] - 5, p[2] * 40];
  const dave = { id: 'dave', shown: { x: 1, y: 2, z: 3, yaw: 0 } };
  const out = aboard.glue([{ id: 'bob', shown: { x: 0, y: 0, z: 0, yaw: 1.25, mv: 1 } }, dave], { poseOf: (o, i) => (o === 'ann' && i === 0 ? pose : null), toWire, dt: 10 });
  const want = toWire(worldOf(pose, [1, 2, 3]));
  nearV([out[0].shown.x, out[0].shown.y, out[0].shown.z], want, 1e-6, 'on the deck');
  assert.equal(out[0].shown.yaw, 1.25, 'the facing is the pose\'s own');
  assert.equal(out[0].shown.mv, 1, 'and the rest of it');
  assert.ok(out[1] === dave, 'a peer aboard nothing passes untouched');
  // cyd's boat stands nowhere here: as the pose says
  const cydIn = { id: 'cyd', shown: { x: 7, y: 8, z: 9 } };
  assert.ok(aboard.glue([cydIn], { poseOf: () => null, toWire, dt: 0.1 })[0] === cydIn, 'no boat here: the pose stands');
  // the ease: a new place is walked toward, not jumped to
  aboard.applyRider('bob', ['ann', 0, 11, 2, 3], 200);
  const eased = aboard.glue([{ id: 'bob', shown: { x: 0, y: 0, z: 0 } }], { poseOf: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), toWire: (p) => p, dt: 0.05 })[0].shown.x;
  assert.ok(eased > 1 && eased < 11, `eased toward 11 (${eased})`);
  aboard.applyRider('bob', ['ann', 3, 0, 0, 0], 200);
  assert.deepEqual(aboard.riders().find((x) => x.id === 'bob').shown, [0, 0, 0], 'another boat: the place is its own at once');
  // the owner law
  aboard.sweepRiders(new Set(['bob', 'cyd']), 6000, 6000);
  assert.deepEqual(aboard.riders().map((x) => x.id).sort(), ['bob', 'cyd']);
  aboard.sweepRiders(new Set(['bob', 'cyd']), 6201, 6000);
  assert.deepEqual(aboard.riders().map((x) => x.id), [], 'quiet past the stale time');
  aboard.applyRider('bob', ['ann', 0, 1, 2, 3], 7000);
  aboard.sweepRiders(new Set([]), 7001, 6000);
  assert.equal(aboard.riders().length, 0, 'gone from the room');
  aboard.applyRider('bob', ['ann', 0, 1, 2, 3], 8000);
  assert.equal(aboard.applyRider('bob', null, 8001), true, 'null: aboard nothing');
  assert.equal(aboard.riders().length, 0);
  aboard.applyRider('bob', ['ann', 0, 1, 2, 3], 8000);
  assert.equal(aboard.applyRider('bob', ['ann', 99, 1, 2, 3], 8001), false, 'a bad word drops the sender\'s');
  assert.equal(aboard.riders().length, 0);
  aboard.applyRider('bob', ['ann', 0, 1, 2, 3], 8000);
  aboard.clearRiders();
  assert.equal(aboard.riders().length, 0, 'a clear takes everyone\'s');
});

test('CSA-K: the ray on another\'s boat - PlayerActivate\'s one ray on the peers\' boats, triggers taken: the ladder\'s box answers as the ladder (its registration), with whose boat and which', async () => {
  const r = await deckRig();
  const box = r.ladder.position;
  const p = r.aboard.pick([box[0] + 2.5, box[1], box[2]], [-1, 0, 0], 76.8);   // from the water at its side: the ladder's box, a trigger, and nothing else on that ray
  assert.ok(p, 'met');
  assert.equal(p.boat, r.boat);
  assert.deepEqual([p.owner, p.slot], ['ann', 0]);
  assert.equal(p.modelId, TRIGGER_MODEL.board, 'the ladder');
  assert.equal(p.modelId, activationModelOf(p.hit.node?.name), 'the registration read off the box\'s name');
  assert.ok(near(p.distance, 2, 1e-6), 'at its own distance');
  const root = r.boat.GameObject.position;
  const hull = r.aboard.pick([root[0] + 5, root[1] + 0.5, root[2]], [-1, 0, 0], 76.8);   // amidships, from the water
  assert.ok(hull && hull.modelId === null, 'the hull is met and answers nothing');
  assert.equal(r.aboard.pick([0, 500, 0], [0, 1, 0], 76.8), null, 'nothing under the ray: none');
});

// ── the host ───────────────────────────────────────────────────────────────────

const WORLD = rd('src/scenes/world.js');
function cut(src, head, end) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `${head} is in the source`);
  const j = src.indexOf(end, i);
  assert.ok(j > i, 'and it ends');
  return src.slice(i, j + end.length);
}
function mount(scope, code, name) {
  const proxy = new Proxy(scope, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { ${code}\n return ${name}; }`)(proxy);
}

test('CSA-K: the host - another\'s boat stands in MY collider beside my boats, aboard it or not (FIELD BUGS 2026-10-01b); the peers are posed once a frame after the mod\'s step and its colliders, before the eye; the carry is the motor\'s carryBy and the look\'s yaw; the gate is online, walking, outdoors, alive and the mod on', () => {
  const sync = cut(WORLD, 'function csaSyncColliders() {', '\n  }\n');
  // THE MERGE with NAV-H (2026-09-28): MY boats are csaColliderBoats() - mine, and the sea's ships near enough to board
  // and to ram (test/nav_h_host.test.js pins its body) - and every peer's boat joins them on the street, aboard it or not
  // (FIELD BUGS 2026-10-01b: test/fb1001b_peerboats.test.js runs it) - and below deck in a ship's cabin, where the street's
  // collider keeps the whole fleet (CABIN-HULL, FIELD BUGS 2026-10-03b: test/fb1003b_cabinhull.test.js runs it)
  assert.match(sync, /const peers = \(modes\?\.mode \?\? 'exterior'\) === 'exterior' \|\| modes\?\.sailingCabin \? csa\.peerBoats : \[\];[^\n]*\n\s+for \(const boat of peers\.length \? \[\.\.\.csaColliderBoats\(\), \.\.\.peers\] : csaColliderBoats\(\)\) \{/);
  const upd = cut(WORLD, 'function csaUpdate(dt) {', '\n  }\n');
  assert.match(upd, /csaSyncColliders\(\);\n\s+csaPeersFrame\(dt\);[^\n]*\n\s+if \(_csaMovedPlayer\) cam\.pos = player\.eyeAt\(\);/, 'after the colliders, before the eye');
  const peersFrame = cut(WORLD, 'function csaPeersFrame(dt) {', '\n  }\n');
  assert.match(peersFrame, /if \(_csaPeersPosed\) return;\n\s+_csaPeersPosed = true;/, 'once a frame');
  assert.match(peersFrame, /allowed: csaOn\(\) && !!online && walkMode && playerSpawned && !_teleporting && !_traveling && \(modes\?\.mode \?\? 'exterior'\) === 'exterior' && !\(playerEntity\.health <= 0 \|\| modes\?\.deathUp\?\.\(\)\),/);
  assert.match(peersFrame, /ground: \(b\) => \(!player\.grounded \? null : typeof player\.groundKey === 'string' && player\.groundKey\.startsWith\(`csaBoat:\$\{csaBoatId\(b\)\}:`\) \? 'boat' : 'other'\),/, 'its own buckets are the boat\'s ground');
  assert.match(peersFrame, /carry: \(d, yawDeg\) => \{ player\.carryBy\(d\[0\], d\[1\], d\[2\]\); cam\.yaw \+= \(yawDeg \* Math\.PI\) \/ 180; _csaMovedPlayer = true; \}/);
  assert.match(peersFrame, /if \(boat \|\| _csaBuckets\.size\) csaSyncColliders\(\);/, 'the boats where they stand now');
  const pool = cut(WORLD, 'function csaPoolFrame(dt) {', '\n  }\n');
  assert.match(pool, /csaPeersFrame\(dt\);[^\n]*\n\s+_csaPeersPosed = false;/, 'posed here when the step did not run; the latch re-armed for the next frame');
});

test('CSA-K: the host - my place aboard rides my foes frame as `ab` (a changed word asks for the frame, every full frame says it, null aboard nothing), the receiver lands a peer\'s past the room test and a clear takes it, and the glue stands them on the deck as drawn', () => {
  // the word, mounted: world.js's own csaAboardWord and foesStream over a stand-in pool
  let aboardWord = null, helmAt = null;
  const sent = [];
  const scope = {
    online: { status: 'open', room: 'world:3,12', isHost: () => false, sendFoes: (f) => { sent.push(f); return true; } },
    isCellRoom: (r) => /^world:/.test(r), isWorldRoom: () => false, FOES_MS: 200, FOES_FULL_MS: 2000, _foesSentAt: -Infinity, _foesFullAt: -Infinity, modes: { mode: 'exterior' },
    exteriorFoes: { foesFrame: (full, force) => (full || force ? { n: 1, k: 'world:3,12', full: full ? 1 : 0, f: [] } : null) },
    _hccDirty: false, camps: { wireRecords: () => [] }, hcc: { wireRecord: () => null }, duelRingWord: () => {}, campToWire: (p) => p,
    portalWord: () => {},   // PORTAL1: no portal standing on this deck
    csaWord: () => false, csaOn: () => true, csaAboard: { word: () => aboardWord }, player: { pos: [0, 0, 0] }, _csaAboardKey: '',
    csaHelmWord: () => helmAt,   // FIELD BUGS 2026-09-29 (the sea) #1: my place at my own helm, when aboard nothing else
    raidWireWord: () => null,   // THE MERGE: RAID2's word rides the same line
    bandWord: () => false,   // THE MERGE (TV7b): no band chases on this deck
    navalWord: () => false,   // THE MERGE with NAV-G: the sea's word rides beside it - no sea here, this pin is the aboard word's
    seaRaidWord: () => false,   // OW6: nor raider chases
  };
  scope.csaAboardWord = mount(scope, cut(WORLD, 'function csaAboardWord(frame, full) {', '\n  }\n'), 'csaAboardWord');
  const foesStream = mount(scope, cut(WORLD, 'const foesStream = (now) => {', '\n  };\n'), 'foesStream');
  foesStream(0);
  assert.deepEqual(sent.map((f) => f.ab), [null], 'the full frame says it: aboard nothing');
  foesStream(300);
  assert.equal(sent.length, 1, 'nothing changed: no frame');
  aboardWord = ['ann', 0, 1, 0.5, -2];
  foesStream(600);
  assert.deepEqual(sent.at(-1).ab, ['ann', 0, 1, 0.5, -2], 'a new place asks for its frame');
  assert.equal(sent.at(-1).full, 0);
  foesStream(900);
  assert.equal(sent.length, 2, 'standing still on the deck: no word');
  aboardWord = null;
  foesStream(1200);
  assert.equal(sent.at(-1).ab, null, 'off: said at once');
  // FIELD BUGS 2026-09-29 (the sea) #1: at my own helm my place is the helm's - said once, then nothing while I sail on
  helmAt = ['me', 0, 0, 9.1, -15.2];
  foesStream(1500);
  assert.deepEqual(sent.at(-1).ab, ['me', 0, 0, 9.1, -15.2], 'the helmsman says where they stand');
  const n = sent.length;
  foesStream(1800);
  assert.equal(sent.length, n, 'sailing on at the wheel: no word');
  aboardWord = ['ann', 1, 2, 0.5, 3];
  foesStream(2100);
  assert.deepEqual(sent.at(-1).ab, ['ann', 1, 2, 0.5, 3], 'aboard another\'s boat, that place first');
  aboardWord = null; helmAt = null;
  // the receiver: past the room test, the same law as the boats; the clears
  const foes = rd('src/scenes/exteriorFoes.js');
  assert.match(foes, /if \(data\.sa !== undefined\) _onCsa\?\.\(from, data\.sa, _now\(\)\);[^\n]*\n\s+if \(data\.ab !== undefined\) _onCsaAboard\?\.\(from, data\.ab, _now\(\)\);/);
  assert.equal((foes.match(/_onCsaClear\?\.\(\);[^\n]*\n\s+_onCsaAboardClear\?\.\(\);/g) ?? []).length, 2, 'the teardown and the room change take theirs');
  assert.match(WORLD, /exteriorFoes\.setOnCsaAboard\(\(from, ab, at\) => csaAboard\.applyRider\(from, ab, at\), \(\) => csaAboard\.clearRiders\(\)\);/);
  assert.match(WORLD, /if \(isCellRoom\(online\.room\)\) \{ const ids = ownerIds\(\); if \(ids\) csaAboard\.sweepRiders\(ids, now, FOES_STALE_MS\); \}/);
  assert.match(WORLD, /const drawable = isCellRoom\(online\.room\) && csaOn\(\) \? csaAboard\.glue\(online\.drawable\(\), \{ poseOf: \(o, i\) => csaPoseAhead\(o, i, dt\), toWire: campToWire, dt \}\) : online\.drawable\(\);/);
  // my own boat, a frame ahead: the helm's move of this frame made before the mod's LateUpdate makes it
  const boat = { GameObject: { activeSelf: true, position: [10, 34, 20], rotation: [0, 0, 0, 1] } };
  const s2 = {
    online: { id: 'me' }, csaRuntime: { AllBoats: [{ GameObject: { activeSelf: false } }, boat], helmMotion: () => ({ boat, velocity: [2, 0, 0], turn: 90 }) },
    gamePaused: () => false, worldTimeScale: () => 5, csaQuatMultiply: quatMultiply, csaQuatAngleAxis: quatAngleAxis, csaPeers: { boatAt: () => null },
    csaDeckPose: deckPose,   // #1: a boat with no bob answers her root's own pose
  };
  const ahead = mount(s2, cut(WORLD, 'function csaPoseAhead(owner, slot, dt) {', '\n  }\n'), 'csaPoseAhead');
  const p = ahead('me', 0, 0.1);
  nearV(p.position, [11, 34, 20], 1e-9, 'my word\'s own order (the active boats), the helm\'s way at my time scale');
  assert.ok(near(yawOf(p.rotation), 45, 1e-6), 'and its turn');
  s2.gamePaused = () => true;
  nearV(ahead('me', 0, 0.1).position, [10, 34, 20], 1e-12, 'a pause holds it');
  assert.equal(ahead('me', 1, 0.1), null, 'no such boat');
});

test('CSA-K: the host - another\'s boat is pressed only where none of mine is under the ray, and yields (PR-WAGON1); its ladder boards it, its status box says the mod\'s words, its door turns over, the position is the instruments, the helm, cargo and variant say whose; the plaque names the hull and its owner; my pack is refused while the others stand aboard', () => {
  const pick = cut(WORLD, 'function csaActivationPick(eye, dir) {', '\n  }\n');
  assert.match(pick, /if \(!best\) return csaPeerActivationPick\(eye, dir\);/);
  const peerPick = cut(WORLD, 'function csaPeerActivationPick(eye, dir) {', '\n  }\n');
  assert.match(peerPick, /key: `csaPeer:\$\{p\.owner\}:\$\{p\.slot\}:\$\{p\.modelId \?\? \(bed \? 'bed' : 'hull'\)\}`, distance: p\.distance, yields: true, peer: true,/);
  assert.match(peerPick, /const wall = csaModeCollider\(\)\?\.raycastHit\(eye, dir, p\.distance, _csaBuckets\.size \? \{ skip: _csaBuckets\.keys\(\) \} : null\);\n\s+if \(wall && Number\.isFinite\(wall\.dist\) && wall\.dist < p\.distance\) return null;/);
  const press = cut(WORLD, 'function csaPeerActivate(pick) {', '\n  }\n');
  assert.match(press, /if \(pick\.modelId == null \|\| !\(pick\.distance <= pick\.reach\)\) return;/, 'silent past its reach');
  assert.match(press, /case CSA_TRIGGER_MODEL\.board: csaBoardPeer\(pick\); break;/);
  assert.match(press, /case CSA_TRIGGER_MODEL\.status: messageBox\(\[CSA_NICE_BOAT_TEXT\]\); break;/);
  assert.match(press, /case CSA_TRIGGER_MODEL\.door: csaCall\(\(\) => csaRuntime\?\.turnDoor\(pick\.hit\.node\)\); break;/);
  assert.match(press, /case CSA_TRIGGER_MODEL\.position: csaCall\(\(\) => csaRuntime\?\.StartShowBoatPosition\(pick\.boat\)\); break;/);
  assert.match(press, /default: \{ const owned = ownedLine\(peerName\(pick\.owner\)\); townTalk\.say\(`This \$\{CSA_HULL_NAMES\[pick\.boat\.hull\] \?\? 'boat'\} - \$\{owned\.charAt\(0\)\.toLowerCase\(\)\}\$\{owned\.slice\(1\)\}\.`\); \}/);
  assert.match(WORLD, /if \(pick\?\.peer\) \{ csaPeerActivate\(pick\); return; \}/);
  const board = cut(WORLD, 'function csaBoardPeer(pick) {', '\n  }\n');
  assert.match(board, /const at = csaAboard\.boardPlace\(pick\.hit\);\n\s+csaSetPlayerPosition\(at\.position\);\n\s+csaSetFacing\(at\.yaw, 0\);/, 'stood at the ladder\'s place, facing its forward');
  assert.match(board, /const deck = raycastColliders\(pick\.boat\.GameObject, o, \[0, -1, 0\], 3, \{ triggers: true, geometry: csaColliderMesh \}\);/, 'set down on THEIR deck within 3 m');
  assert.match(board, /if \(csaAboard\.board\(pick\.boat, CSA_ABOARD_GRACE\)\) csaSyncColliders\(\);/);
  const hover = cut(WORLD, 'const csaHoverName = (key) => {', '\n  };\n');
  // PIN MOVED (HOLDINGS, bible/03-World/Holdings.md): the plaque names her by her captain's name where she has one (her hull's under
  // it), else her hull's - and its owner, as ever
  assert.match(hover, /const hullName = CSA_HULL_NAMES\[boat\.hull\] \?\? 'Boat', named = csaPeers\.nameAt\?\.\(peer\[1\], Number\(peer\[2\]\)\) \?\? '';[^\n]*\n\s*return \{ title: named \|\| hullName, subs: \[\.\.\.\(named \? \[hullName\] : \[\]\), ownedLine\(peerName\(peer\[1\]\)\)\] \};/);
  assert.match(WORLD, /const csaPassengersOn = \(boat\) => \{ const i = csaRuntime\?\.AllBoats\.filter\(\(b\) => b\.GameObject\?\.activeSelf\)\.indexOf\(boat\) \?\? -1; return i < 0 \|\| !online\?\.id \? 0 : csaAboard\.passengersOn\(online\.id, i\); \};/);
  assert.match(WORLD, /passengersAboard: csaPassengersOn,/, 'OWS2: named, the landfall\'s pack reads it too');
});

test('CSA-K: the motor carries the body by the deck\'s move - the body and BOTH ends of the render span (no lerp across it), the smoothed eye and a fall\'s start with it, and no motion state', async () => {
  const { PlayerMotor } = await import('../src/player/motor.js');
  const m = new PlayerMotor({ collider: null });
  m.pos[0] = 1; m.pos[1] = 2; m.pos[2] = 3;
  m._prevPos[0] = 0.5; m._prevPos[1] = 2; m._prevPos[2] = 3;
  m._eyeFeetY = 2.1;
  m.falling = true; m.fallStart = 9;
  const vel = [m._airVelX, m._airVelZ, m.velY];
  m.carryBy(0.25, -0.5, 4);
  assert.deepEqual([...m.pos], [1.25, 1.5, 7]);
  assert.deepEqual([...m._prevPos], [0.75, 1.5, 7], 'the span moved whole');
  assert.equal(m._eyeFeetY, 1.6);
  assert.equal(m.fallStart, 8.5, 'a deck\'s dip is no fall');
  assert.deepEqual([m._airVelX, m._airVelZ, m.velY], vel, 'no motion state touched');
  m.falling = false;
  m.carryBy(0, 1, 0);
  assert.equal(m.fallStart, 8.5, 'standing, the fall start is left');
});

// ── the helm on screen ─────────────────────────────────────────────────────────

const H = (over = {}) => ({ hull: 1, hasSails: true, sailsUp: false, squareToggle: false, squareUp: false, hasSquare: false, light: false, timeScaleIndex: 0, timeScale: 1, timeScaleMax: 4, manualTrim: false, squareOnly: false, ...over });

test('CSA-L: the helm\'s buttons for the mod\'s state - the sails (their label turning), the square sails where the key\'s chord would raise them alone, the trim only while it is the player\'s (and the square sails\' own where the hull has both kinds), the lanterns, the time scale\'s three (the ends refused), the position and leaving; each presses the registry action its key presses', () => {
  assert.deepEqual(HELM_ACTIONS, {
    sail: BOAT_ACTIONS.toggleSail, light: BOAT_ACTIONS.toggleLight, disembark: BOAT_ACTIONS.disembark, trimLeft: BOAT_ACTIONS.trimLeft, trimRight: BOAT_ACTIONS.trimRight,
    trimModifier: BOAT_ACTIONS.trimModifier, slower: BOAT_ACTIONS.timeScaleDown, faster: BOAT_ACTIONS.timeScaleUp, normal: BOAT_ACTIONS.timeScaleReset,
    more: BOAT_ACTIONS.sailUp, less: BOAT_ACTIONS.sailDown,   // HELM-KEYS
  });
  const acts = (h) => helmButtons(h).map((b) => b.act);
  assert.deepEqual(acts(H()), ['sails', 'light', 'slower', 'normal', 'faster', 'position', 'leave']);
  assert.deepEqual(acts(H({ hasSails: false })), ['light', 'slower', 'normal', 'faster', 'position', 'leave'], 'a sailless boat');
  assert.deepEqual(acts(H({ squareToggle: true })), ['sails', 'square', 'light', 'slower', 'normal', 'faster', 'position', 'leave']);
  assert.deepEqual(acts(H({ manualTrim: true })), ['sails', 'trimLeft', 'trimRight', 'light', 'slower', 'normal', 'faster', 'position', 'leave']);
  assert.deepEqual(acts(H({ manualTrim: true, hasSquare: true })), ['sails', 'trimLeft', 'trimRight', 'squareLeft', 'squareRight', 'light', 'slower', 'normal', 'faster', 'position', 'leave']);
  assert.deepEqual(acts(H({ manualTrim: true, hasSquare: true, squareOnly: true })), ['sails', 'trimLeft', 'trimRight', 'light', 'slower', 'normal', 'faster', 'position', 'leave'], 'a square rig alone trims with the bare brackets');
  const by = (h, act) => helmButtons(h).find((b) => b.act === act);
  assert.deepEqual([by(H(), 'sails').label, by(H({ sailsUp: true }), 'sails').label], ['Raise sails', 'Stow sails']);
  // PIN MOVED (HELM-LADDER): the sails' button is the mod's own toggle, raising or striking all her canvas from any rung -
  // the arrows climb her oars first now
  assert.deepEqual([by(H(), 'sails').action, by(H({ sailsUp: true }), 'sails').action, by(H({ sailsUp: true, squareToggle: true }), 'sails').action], ['BoatToggleSail', 'BoatToggleSail', 'BoatToggleSail']);
  assert.deepEqual([by(H({ squareToggle: true }), 'square').label, by(H({ squareToggle: true, squareUp: true }), 'square').label], ['Raise square sails', 'Stow square sails']);
  assert.deepEqual([by(H(), 'light').label, by(H({ light: true }), 'light').label], ['Light lanterns', 'Douse lanterns']);
  assert.deepEqual(by(H({ squareToggle: true }), 'square'), { act: 'square', label: 'Raise square sails', kind: 'tap', action: 'BoatToggleSail', withHeld: 'BoatTrimModifier' }, 'End with the modifier held, as the key\'s chord');
  assert.deepEqual(by(H({ manualTrim: true, hasSquare: true }), 'squareRight'), { act: 'squareRight', label: 'Square ▶', kind: 'hold', action: 'BoatTrimRight', withHeld: 'BoatTrimModifier' });
  assert.equal(by(H({ manualTrim: true }), 'trimLeft').kind, 'hold', 'the trim is held');
  assert.deepEqual([by(H(), 'slower').disabled, by(H(), 'normal').disabled, by(H(), 'faster').disabled], [true, true, false], 'at one: nothing slower');
  assert.deepEqual([by(H({ timeScaleIndex: 4, timeScale: 30 }), 'slower').disabled, by(H({ timeScaleIndex: 4, timeScale: 30 }), 'faster').disabled], [false, true], 'at thirty: nothing faster');
  assert.equal(by(H({ timeScaleIndex: 2, timeScale: 10 }), 'normal').label, '×10');
  assert.deepEqual([by(H(), 'leave').action, by(H(), 'position').kind], ['BoatDisembark', 'hook']);
  assert.deepEqual(helmButtons(null), []);
});

test('CSA-L: the panel on a page - under the compass, titled with the hull, a key hint on each button (none on a finger), a hint to free the mouse while the look holds it; a click presses its action (the square sails with the modifier\'s chord), a hold holds it until let go; a window over the HUD hides it and lets every hold go; aboard another\'s boat it names whose and holds no button; gone, it lets go too', () => {
  const doc = fakeDoc();
  const pressed = [], holds = [];
  const hooks = { press: (a, w) => pressed.push([a, w]), hold: (a, on) => holds.push([a, on]), position: () => pressed.push(['position']) };
  const keyOf = (a) => ({ BoatToggleSail: 'End', BoatToggleLight: ';', BoatDisembark: "'", BoatSailUp: 'UP', BoatSailDown: 'DOWN', TurnLeft: 'LEFT', TurnRight: 'RIGHT' })[a] ?? '';
  try {
    const root = drawEnhancedHelm({ helm: H({ squareToggle: true, manualTrim: true, hasSquare: true }), keyOf, mouseFree: false, freeKey: 'Y' }, hooks, { doc });
    assert.ok(root && root.id === ENHANCED_HELM_ID && doc.body.children.includes(root), 'mounted on the page');
    assert.equal(enhancedHelmBar(), one(root, 'helmpanel-bar'), 'THE MERGE with NAV-F: the bar standing, which the sea\'s target card stands under');
    assert.equal(one(root, 'helmpanel-name').textContent, 'At the helm - Large Boat');
    assert.equal(one(root, 'helmpanel-hint').textContent, 'Oars & sails UP DOWN · Steer LEFT RIGHT · Free the mouse (Y) to use these', 'HELM-KEYS: the helm\'s hand at a glance (HELM-LADDER: her oars and her sails on one ladder)');
    const btn = (act) => all(root, 'helmpanel-btn').find((b) => b.dataset.act === act);
    assert.equal(one(btn('sails'), 'helmpanel-key').textContent, 'End', 'the key it stands for (HELM-LADDER: the toggle\'s)');
    assert.equal(one(btn('leave'), 'helmpanel-key').textContent, "'");
    btn('sails').fire('click');
    btn('square').fire('click');
    btn('position').fire('click');
    assert.deepEqual(pressed, [['BoatToggleSail', null], ['BoatToggleSail', 'BoatTrimModifier'], ['position']]);
    btn('trimRight').fire('pointerdown', { pointerId: 1 });
    assert.deepEqual(holds, [['BoatTrimRight', true]]);
    btn('trimRight').fire('pointerdown', { pointerId: 1 });
    assert.equal(holds.length, 1, 'held once');
    btn('trimRight').fire('pointerup');
    assert.deepEqual(holds.at(-1), ['BoatTrimRight', false]);
    holds.length = 0;
    btn('squareLeft').fire('pointerdown', { pointerId: 4 });
    btn('squareLeft').fire('lostpointercapture');
    assert.deepEqual(holds, [['BoatTrimModifier', true], ['BoatTrimLeft', true], ['BoatTrimLeft', false], ['BoatTrimModifier', false]], 'the square sails\' trim holds the modifier with it');
    holds.push(['BoatTrimRight', true], ['BoatTrimRight', false]);   // (the log as it stood)
    // a window over the HUD while a trim is held: hidden, and the hold let go
    btn('trimLeft').fire('pointerdown', { pointerId: 2 });
    drawEnhancedHelm({ helm: H({ squareToggle: true, manualTrim: true, hasSquare: true }), covered: true, keyOf }, hooks, { doc });
    assert.equal(root.style.display, 'none');
    assert.equal(enhancedHelmBar(), null, 'covered: no bar stands to stack under');
    assert.deepEqual(holds.slice(-2), [['BoatTrimLeft', true], ['BoatTrimLeft', false]], 'the window let it go');
    drawEnhancedHelm({ helm: H({ squareToggle: true, manualTrim: true, hasSquare: true, sailsUp: true }), keyOf, mouseFree: true }, hooks, { doc });
    assert.equal(root.style.display, '');
    assert.equal(one(btn('sails'), 'helmpanel-label').textContent, 'Stow sails', 'updated in place');
    assert.equal(one(root, 'helmpanel-hint').textContent, 'Oars & sails UP DOWN · Steer LEFT RIGHT', 'the mouse free: the legend alone');
    // a disabled button presses nothing
    btn('slower').fire('click');
    assert.equal(pressed.length, 3, 'nothing slower than one');
    // a finger: its size, no key hints
    drawEnhancedHelm({ helm: H(), touch: true, keyOf }, hooks, { doc });
    assert.match(root.className, /\btouch\b/);
    assert.equal(one(btn('sails'), 'helmpanel-key').textContent, '');
    // aboard another's boat: whose, and no button
    drawEnhancedHelm({ helm: null, aboard: { hull: 2, owner: 'Ann' } }, hooks, { doc });
    assert.equal(one(root, 'helmpanel-name').textContent, "Aboard Ann's Small Ship");
    assert.equal(all(root, 'helmpanel-btn').length, 0);
    assert.match(root.className, /\baboard\b/);
    // a hold, then the panel taken down: let go
    drawEnhancedHelm({ helm: H({ manualTrim: true }), keyOf }, hooks, { doc });
    btn('trimLeft').fire('pointerdown', { pointerId: 3 });
    hideEnhancedHelm();
    assert.deepEqual(holds.at(-1), ['BoatTrimLeft', false], 'taken down: let go');
    assert.equal(root.removed, true);
    assert.equal(enhancedHelmMounted(), false);
    assert.equal(enhancedHelmBar(), null, 'taken down: none');
    assert.equal(drawEnhancedHelm({ helm: null, aboard: null }, hooks, { doc }), null, 'nothing to show: nothing stands');
  } finally { hideEnhancedHelm(); }
});

test('CSA-L: the panel wears the Plus kit - its bar a window of the kit and its presses the kit\'s buttons (enhancedFrame.js FRAME_ROLES); its own sheet places and letters and paints no ground, so the kit\'s paint stands; its presses are swallowed (never a swing or an activation in the world)', () => {
  assert.ok(FRAME_ROLES.window.includes('.helmpanel-bar'));
  assert.ok(FRAME_ROLES.button.includes('.helmpanel-btn'));
  const css = HELM_CSS.replace(/\/\*[^]*?\*\//g, '');
  for (const cls of ['helmpanel', 'helmpanel-bar', 'helmpanel-btn', 'helmpanel-key', 'helmpanel-hint']) assert.match(css, new RegExp(`\\.${cls}\\b`), `.${cls} drawn`);
  assert.doesNotMatch(css, /background\s*:/, 'the kit paints the ground');
  assert.match(css, /\.helmpanel \{[^}]*pointer-events: none/, 'the panel lets the world have the pointer');
  assert.match(css, /\.helmpanel-btn \{[^}]*pointer-events: auto/, 'its buttons take it');
  assert.match(css, /\.helmpanel\.touch \.helmpanel-btn \{ min-height: 44px; min-width: 44px; \}/, 'a finger\'s size');
  const src = rd('src/ui/enhancedHelm.js');
  assert.match(src, /for \(const t of \['pointerdown', 'mousedown', 'mouseup', 'click', 'touchstart', 'wheel', 'contextmenu'\]\) node\.addEventListener\(t, swallow\);/);
});

test('CSA-L: a pad at the helm - up raises or stows the sails (held: the square sails alone), down the lanterns (held: leaves the helm), left and right step the time scale (held: the trim while it is the player\'s, else left puts the time back to one); the prompt bar says so', () => {
  const log = [];
  const io = { press: (a, w) => log.push(['press', a, w ?? null]), hold: (a, on) => log.push(['hold', a, on]) };
  const g = (dir, kind, h) => { log.length = 0; const r = helmPadGesture(dir, kind, h, io); return [r, [...log]]; };
  assert.deepEqual(g('up', 'tap', H()), [false, [['press', 'BoatToggleSail', null]]]);
  assert.deepEqual(g('up', 'tap', H({ hasSails: false })), [false, []], 'no sails: nothing');
  assert.deepEqual(g('up', 'hold', H({ squareToggle: true })), [false, [['press', 'BoatToggleSail', 'BoatTrimModifier']]]);
  assert.deepEqual(g('up', 'hold', H()), [false, [['press', 'BoatToggleSail', null]]], 'no chord to make: a hold is the tap');
  assert.deepEqual(g('down', 'tap', H()), [false, [['press', 'BoatToggleLight', null]]]);
  assert.deepEqual(g('down', 'hold', H()), [false, [['press', 'BoatDisembark', null]]]);
  assert.deepEqual(g('left', 'tap', H()), [false, [['press', 'BoatTimeScaleDown', null]]]);
  assert.deepEqual(g('right', 'tap', H()), [false, [['press', 'BoatTimeScaleUp', null]]]);
  assert.deepEqual(g('left', 'hold', H()), [false, [['press', 'BoatTimeScaleReset', null]]]);
  assert.deepEqual(g('right', 'hold', H()), [false, [['press', 'BoatTimeScaleUp', null]]]);
  assert.deepEqual(g('left', 'hold', H({ manualTrim: true })), [true, [['hold', 'BoatTrimLeft', true]]], 'the trim, held until let go');
  assert.deepEqual(g('right', 'release', H({ manualTrim: true })), [false, [['hold', 'BoatTrimRight', false]]]);
  assert.deepEqual(g('up', 'tap', null), [false, []], 'no helm: nothing');
  assert.deepEqual(Object.values(HELM_DPAD).sort(), ['down', 'left', 'right', 'up']);
  const rows = helmPadPrompts(H({ squareToggle: true, manualTrim: true }));
  assert.deepEqual(rows, [[['JoystickAxis7Button0'], 'Sails (hold: square sails)'], [['JoystickAxis7Button1'], 'Lanterns (hold: leave the helm)'], [['JoystickAxis6Button1', 'JoystickAxis6Button0'], 'Slower / faster (hold: trim)']]);
  assert.equal(helmPadPrompts(H())[2][1], 'Slower / faster (hold left: normal time)');
  assert.equal(helmPadPrompts(null), null);
});

test('CSA-L: the pad layer at the helm - the d-pad is the helm\'s (a tap, a hold past DPAD_HOLD_S once, its let-go after a held trim), none of it pressed as the d-pad\'s own keys; a bumper held is the crossbar\'s; the helm left mid-hold lets the trim go; the prompt bar asks the helm', async () => {
  const { attachGamepad, DPAD_HOLD_S } = await import('../src/ui/gamepadInput.js');
  const { createBindings, resetDefaults } = await import('../src/systems/inputActions.js');
  const { setBindings } = await import('../src/ui/input.js');
  const { setPref, _resetForTests: resetPrefs } = await import('../src/systems/uiPrefs.js');
  const { _resetForTests: resetSettings } = await import('../src/systems/settings.js');
  const { registerCrossbar } = await import('../src/ui/plusPad.js');
  const prevW = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  resetPrefs(); resetSettings();
  setPref('plusPadLayout', 0);
  const store = createBindings(); resetDefaults(store); setBindings(store);
  registerCrossbar({ inForce: () => true, press() {}, setActive() {} });
  const events = []; const dispatch = (t, c) => events.push(`${t}:${c}`);
  const gestures = [];
  let atHelm = true, prompted = 0;
  const helm = { up: () => atHelm, gesture: (dir, kind) => { gestures.push(`${dir}:${kind}`); return kind === 'hold' && (dir === 'left' || dir === 'right'); }, prompts: () => { prompted++; return null; } };
  const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const set = (i, on) => { pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; };
  try {
    const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
    const gp = attachGamepad(canvas, { overlayActive: () => false, paused: () => false, attack() {}, look() {}, helm }, { getPads: () => [pad], dispatch, makeEvent: (type, init) => ({ type, ...init }) });
    pad.axes[0] = 0.9; gp.tick(1 / 60); pad.axes[0] = 0; gp.tick(1 / 60);   // the pad in hand
    events.length = 0;
    set(12, true); gp.tick(1 / 60); set(12, false); gp.tick(1 / 60);   // up, a tap
    assert.deepEqual(gestures, ['up:tap'], 'a tap on its release');
    set(13, true);
    for (let t = 0; t < DPAD_HOLD_S + 0.2; t += 1 / 60) gp.tick(1 / 60);
    assert.deepEqual(gestures.slice(1), ['down:hold'], 'a hold, once');
    set(13, false); gp.tick(1 / 60);
    assert.deepEqual(gestures.slice(1), ['down:hold'], 'no tap after a hold, nothing to let go');
    set(14, true);
    for (let t = 0; t < DPAD_HOLD_S + 0.2; t += 1 / 60) gp.tick(1 / 60);
    set(14, false); gp.tick(1 / 60);
    assert.deepEqual(gestures.slice(2), ['left:hold', 'left:release'], 'a held trim is let go');
    assert.ok(prompted > 0, 'the prompt bar asked the helm');
    // the helm left mid-hold
    set(15, true);
    for (let t = 0; t < DPAD_HOLD_S + 0.2; t += 1 / 60) gp.tick(1 / 60);
    atHelm = false; gp.tick(1 / 60);
    assert.deepEqual(gestures.slice(4), ['right:hold', 'right:release'], 'the helm gone: the trim let go');
    set(15, false); gp.tick(1 / 60);
    // at the helm every direction was tapped or held, and none reached the bare d-pad's own actions or a d-pad key
    assert.ok(!events.some((e) => /Joystick(Axis6|Axis7)/.test(e)), `no d-pad code pressed as a key at the helm: ${events}`);
    const { getBinding } = await import('../src/systems/inputActions.js');
    const bare = ['SwitchHand', 'AutoMap', 'TravelMap', 'LogBook', 'Transport', 'Rest'].map((a) => [a, getBinding(store, a) ?? getBinding(store, a, false)]);
    assert.ok(bare.filter(([, c]) => c).length >= 4, `the bare d-pad's actions are bound to be seen (${bare})`);
    for (const [a, code] of bare) if (code) assert.ok(!events.includes(`keydown:${code}`), `the bare d-pad's ${a} stands down at the helm (${events})`);
    // a bumper held: the crossbar's, never the helm's
    atHelm = true; gestures.length = 0;
    pad.buttons[4].pressed = true; set(12, true); gp.tick(1 / 60); set(12, false); gp.tick(1 / 60); pad.buttons[4].pressed = false; gp.tick(1 / 60);
    assert.deepEqual(gestures, [], 'LB + up is a hotbar slot');
    gp.dispose();
  } finally { registerCrossbar(null); globalThis.window = prevW; resetPrefs(); }
});

test('CSA-L: the host\'s helm seam - the panel\'s and the pad\'s presses reach the mod beside the keys: a tap one frame\'s edge (its chord\'s modifier held that frame), a hold until let go; the mod\'s step spends the frame\'s taps; the panel is drawn once a frame in every mode, the pad asks the same seam', () => {
  const scope = {};
  const seam = cut(WORLD, '  const csaHelmInput = { edges: new Set(), chord: new Set(), held: new Set() };', '\n');
  const press = cut(WORLD, '  const csaHelmPress = (action, withHeld = null) =>', '\n');
  const hold = cut(WORLD, '  const csaHelmHold = (action, on) =>', '\n');
  const journey = cut(WORLD, '  const csaJourneyHelm = { held: new Set(), row: false };', '\n');   // OWS2: the journey's hand, beside the panel's
  const api = mount(scope, `${seam}${press}${hold}${journey}`, '{ csaHelmInput, csaHelmPress, csaHelmHold, csaJourneyHelm }');
  const keys = new Set(), latch = { edge: { downFrame: new Set() } };
  let atHelm = false;   // HELM-KEYS: whether the turn keys are the rudder's (scenes/world.js helmTurnKeys)
  Object.assign(scope, { ...api, keys, latch, held: (k, a) => k.has(a), pressed: (e, k, a) => e.downFrame.has(a), HELM_RUDDER_ACTIONS, helmTurnKeys: () => atHelm });
  const input = cut(WORLD, '      has: (action) => held(keys, action) ||', '\n') + cut(WORLD, '      started: (action) => (pressed(latch.edge, keys, action) &&', '\n');   // PIN MOVED (AUDIT NAV2 F17): the sail keys' press gated by the travel view (test/auditnav2_helm.test.js)
  const { has, started } = mount(scope, `const __i = { ${input} };`, '__i');
  api.csaHelmPress('BoatToggleSail', 'BoatTrimModifier');
  assert.equal(started('BoatToggleSail'), true, 'the tap is the action\'s edge');
  assert.equal(has('BoatTrimModifier'), true, 'its chord held that frame');
  assert.equal(started('BoatToggleLight'), false);
  api.csaHelmHold('BoatTrimLeft', true);
  assert.equal(has('BoatTrimLeft'), true);
  const spend = cut(WORLD, '    csaHelmInput.edges.clear(); csaHelmInput.chord.clear();', '\n');
  mount(scope, spend, 'null');
  assert.equal(started('BoatToggleSail'), false, 'spent by the mod\'s step');
  assert.equal(has('BoatTrimModifier'), false);
  assert.equal(has('BoatTrimLeft'), true, 'a hold outlives the step');
  api.csaHelmHold('BoatTrimLeft', false);
  assert.equal(has('BoatTrimLeft'), false);
  api.csaJourneyHelm.held.add('MoveLeft');
  assert.equal(has('MoveLeft'), true, 'OWS2: a journey\'s rudder key reaches the mod through the same seam');
  api.csaJourneyHelm.held.clear();
  // HELM-KEYS: at a helm the turn keys hold the rudder's two - and only there
  keys.add('TurnLeft');
  assert.equal(has('MoveLeft'), false, 'off a helm the turn key turns the view alone');
  atHelm = true;
  assert.equal(has('MoveLeft'), true, 'at a helm the left arrow is the rudder\'s');
  assert.equal(has('MoveRight'), false);
  assert.equal(has('TurnLeft'), true, 'and still its own');
  keys.delete('TurnLeft'); atHelm = false;
  keys.add('BoatToggleLight'); latch.edge.downFrame.add('BoatToggleLight');
  assert.equal(started('BoatToggleLight') && has('BoatToggleLight'), true, 'the keys still press');
  api.csaHelmPress(42);
  assert.equal(api.csaHelmInput.edges.size, 0, 'no action: nothing');
  // the step spends them after the mod's own frame, before the colliders
  const upd = cut(WORLD, 'function csaUpdate(dt) {', '\n  }\n');
  assert.ok(upd.indexOf('csaHelmInput.edges.clear()') > upd.indexOf('csaRuntime.lateUpdate('), 'after LateUpdate read them');
  // once a frame, every mode; Enhanced Plus, walking, the mod on - hidden under a window, the HUD off or a pause
  assert.match(WORLD, /csaDrawHelmPanel\(\);[^\n]*\n\s+spoilsRecoverFrame\(\);[^\n]*\n\s+if \(onlineOn && playerSpawned\) \{ if \(!online\) onlineStart\(\); onlineFrame\(now, dt\); \}/);
  const draw = cut(WORLD, 'function csaDrawHelmPanel() {', '\n  }\n');
  assert.match(draw, /if \(!csaRuntime \|\| !csaOn\(\) \|\| !isEnhancedPlus\(\) \|\| typeof document === 'undefined' \|\| !walkMode\) \{ if \(enhancedHelmMounted\(\)\) hideEnhancedHelm\(\); csaHelmInput\.held\.clear\(\); return; \}/);
  assert.match(draw, /covered: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\) \|\| !hudRenderEnabled\(\) \|\| !!travelView\?\.active \|\| !!_travelUIHolder\.ui\?\.isShowing,/);   // PIN MOVED (AUDIT NAV2 F17): under overhead and first-person journey controls, where a journey holds the helm
  assert.match(WORLD, /up: \(\) => !!\(csaRuntime\?\.isSailing\(\) && csaOn\(\) && isEnhancedPlus\(\)\),\n\s+gesture: \(dir, kind\) => \{ let r = false; csaCall\(\(\) => \{ r = helmPadGesture\(dir, kind, csaRuntime\?\.helmPanelState\(\) \?\? null, \{ press: csaHelmPress, hold: csaHelmHold \}\); \}\); return r; \},/);
});
