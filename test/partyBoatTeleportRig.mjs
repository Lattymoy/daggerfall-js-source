// Reuses existing FB1001b vendored-hull fixture, with a deep-water floor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool } from '../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createComeSailAwayPeers } from '../src/scenes/comeSailAway/comeSailAwayPeers.js';
import { createComeSailAwayAboard, localOf } from '../src/scenes/comeSailAway/comeSailAwayAboard.js';
import { Boat, HULL_NAMES } from '../src/systems/comeSailAway/comeSailAwayBoat.js';
import { boardPlaceOf } from '../src/systems/comeSailAway/comeSailAway.js';
import { colliderPoses, invertAffine, boxColliderTriangles, raycastColliders, BUILTIN_COLLIDER_MESHES } from '../src/world/prefabColliders.js';
import { quatAngleAxis } from '../src/world/quat.js';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor, FIXED_DT, CAPSULE_HEIGHT } from '../src/player/motor.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = src('src/scenes/world.js');
const cut = (s, start, end = '\n  }\n') => { const i = s.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return s.slice(i, s.indexOf(end, i) + end.length); };
const cutLine = (s, start) => { const i = s.indexOf(start); assert.ok(i >= 0, `lifted: ${start}`); return s.slice(i, s.indexOf('\n', i) + 1); };
const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const renderer = {
  createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s })) }),
  drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (archive, record, size) => ({ archive, record, size }), destroyBillboardBatch() {}, destroyMesh() {},
};
const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
let _pool = null;
/** One pool over the vendored hulls for the file, emptied for each rig (test/navalSea.mjs's law). */
async function readyPool() {
  if (!_pool) {
    _pool = createComeSailAwayPool({ renderer, pipeline: { getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) }, fetchFn: fileFetch, log: { warn() {} } });
    assert.equal(await _pool.preload(), true);
  }
  _pool.destroyAll();
  return _pool;
}
/** world.js csaColliderMesh's reading over the pool's own models (a classic model's - the bed - is none here). */
const geometryOf = (pool) => (c) => (c.classicModel != null ? null : c.m_Mesh?.mesh ? pool.models.geometry(c.m_Mesh.mesh) : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] ?? null : null);

const LARGE_BOAT = HULL_NAMES.indexOf('Large Boat'), SMALL_SHIP = HULL_NAMES.indexOf('Small Ship'), CARRACK = HULL_NAMES.indexOf('Carrack');
const Q0 = [0, 0, 0, 1];
const SEA = 0;             // the sea's line: every root floats on it
const FLOOR = -30;        // a shallow anchorage's floor, the world collider's ground
const MINE_X = 100;        // my own boat of the same hull, moored a hundred metres east of hers
const EAST = Math.PI / 2;  // the motor's yaw toward +x
const IDLE = { forward: 0, strafe: 0 };
const RUN = { forward: 1, strafe: 0, run: true };
/** Ann's word for one boat (systems/comeSailAway/comeSailAwayWire.js `b`): her hull, variant 0, the root's place and turn, the
 *  sails, the helm and the lanterns - with her way (`m`: velocity x, z and turn a second) while she sails. */
const annWord = (hull, pos, q = Q0, way = null) => ({ b: [[hull, 0, pos[0], pos[1], pos[2], ...q, 0, way ? 1 : 0, 0]], ...(way ? { m: [way] } : {}) });

/** world.js's own sync, sweep and peers' frame, lifted over `s` (the frame's scene - the collider by mode, the boats,
 *  the peers and the aboard machine, the motor). */
function liftWorld(s) {
  const body = `
    let { colliderPoses, invertAffine, boxColliderTriangles, csaModeCollider, csaAboard, csaColliderBoats, csaColliderMesh, _csaBoatIds, _csaBoatSerial,
          csa, csaPeers, csaOn, online, walkMode, playerSpawned, _teleporting, _traveling, modes, playerEntity, player, cam, CAPSULE_HEIGHT, _csaMovedPlayer,
          surfaceAt, csaPixelAt, state, deepWaters } = s;
    ${cutLine(WORLD, '  const _csaBuckets = new Map();')}${cutLine(WORLD, '  const csaBoatId = (boat) =>')}
    ${cut(WORLD, '  const csaShapeOf = (c) =>', ');\n')}${cutLine(WORLD, '  const CSA_RIGID_EPS =')}${cut(WORLD, '  function csaCarry(b, m) {')}
    ${cut(WORLD, '  function csaSyncColliders() {')}${cutLine(WORLD, '  const _csaSlab = [0, 0, 0]')}
    ${cut(WORLD, '  function csaSphereCastAll(')}
    ${cutLine(WORLD, '  let _csaPeersPosed = false;')}${cutLine(WORLD, '  const deckMayCarry = ')}${cutLine(WORLD, '  const deckGround = ')}${cutLine(WORLD, '  const deckCarry = ')}${cut(WORLD, '  function csaPeersFrame(dt) {')}
    return { sync: csaSyncColliders, sweep: csaSphereCastAll, peersFrame: csaPeersFrame, rearm: () => { _csaPeersPosed = false; }, buckets: _csaBuckets, boatId: csaBoatId };`;
  // eslint-disable-next-line no-new-func
  return new Function('s', body)(s);
}

/**
 * The scene of the pins: Ann's boat of `hull` moored at the origin (built and posed off her word, as every reader
 * stands it), my own of the same hull at MINE_X (`mine`), the world's colliders by mode (the street's over the
 * anchorage's floor), the motor on the street's, and world.js's frame over them. `frame` is one world frame in its
 * order: the motor's step, csaUpdate's sync, csaPeersFrame (the peers posed, the deck's carry, the sync again), the
 * latch csaPoolFrame re-arms.
 */
async function rig({ hull = SMALL_SHIP, mine = true, modes = { mode: 'exterior' } } = {}) {
  const pool = await readyPool();
  const geometry = geometryOf(pool);
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  const aboard = createComeSailAwayAboard({ peers, geometry, selfId: () => 'me' });
  const own = mine ? pool.spawnNow(new Boat(hull, 0), { position: [0, 0, 0], rotation: Q0 }) : null;
  if (own) own.GameObject.position = [MINE_X, SEA, 0];
  assert.equal(peers.applyOwner('ann', annWord(hull, [0, SEA, 0]), (p) => p, 0), true);
  peers.frame(0.1); peers.frame(0.1);   // built, then posed on her word
  const hers = peers.boatAt('ann', 0);
  assert.ok(hers && hers.hull === hull, `Ann's ${HULL_NAMES[hull]} stands`);
  const colliders = { exterior: new Collider(() => FLOOR), interior: new Collider(() => -Infinity), dungeon: new Collider(() => -Infinity) };
  const player = new PlayerMotor(colliders.exterior);
  const cam = { yaw: 0, pitch: 0 };
  const w = liftWorld({
    colliderPoses, invertAffine, boxColliderTriangles, csaModeCollider: () => colliders[modes?.mode ?? 'exterior'], csaAboard: aboard,
    csaColliderBoats: () => pool.boats, csaColliderMesh: geometry, _csaBoatIds: new WeakMap(), _csaBoatSerial: 0,
    csa: pool, csaPeers: peers, csaOn: () => true, online: { id: 'me' }, walkMode: true, playerSpawned: true, _teleporting: false, _traveling: false,
    modes, playerEntity: { health: 100 }, player, cam, CAPSULE_HEIGHT, _csaMovedPlayer: false,
    surfaceAt: () => -Infinity, csaPixelAt: () => null, state: null, deepWaters: null,   // the sweep's ground: none (a sea of the anchorage's own)
  });
  const frame = (input = IDLE, yaw = 0) => { player.update(FIXED_DT, input, yaw); w.sync(); w.peersFrame(FIXED_DT); w.rearm(); };
  /** A boat's buckets' key head (csaSyncColliders' `csaBoat:<id>:`). */
  const keyOf = (boat) => `csaBoat:${w.boatId(boat)}:`;
  /** Whether any bucket of `boat` stands in a collider. */
  const stands = (col, boat) => [...col._buckets.keys()].some((k) => k.startsWith(keyOf(boat)));
  return { pool, peers, aboard, own, hers, colliders, player, cam, w, frame, keyOf, stands, modes, geometry };
}
/** A boat's root pose, as the aboard machine reads it. */
const poseOf = (boat) => ({ position: [...boat.GameObject.position], rotation: [...boat.GameObject.rotation] });


export { rig, poseOf, HULL_NAMES, boardPlaceOf, raycastColliders, FLOOR, SEA, IDLE, FIXED_DT };
