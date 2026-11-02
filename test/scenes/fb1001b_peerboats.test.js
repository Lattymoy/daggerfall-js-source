// FIELD BUGS 2026-10-01b - ANOTHER PLAYER'S BOAT. Mac: "Players aren't colliding with other players' boats and can't
// stand on board". Online (CSA-K) another player's boat stood in a player's collider only while that player was ABOARD
// it - PR-WAGON1's "Others' wagons don't block", carried over to boats - so to everyone else her hull was walked and
// swum through and her deck was no floor to step, climb or come up onto (only her ladder's press or a drop onto her
// deck from above boarded her); and the aboard door took only that drop, so a body standing on her own colliders was
// never aboard her and she would sail out from under it. Mac's word sets the law aside for boats: hers is met and
// stood on as my own.
//   PEER-HULL   - her hull and her deck's furniture stand in my collider as my own boat's do, aboard her or not: a
//                 wader is stopped where my hull stops him, a ray across her deck meets her mast, the helm's sweep
//                 meets her as it meets a boat of mine (scenes/world.js csaSyncColliders)
//   PEER-DECK   - I stand on her deck from the first step, as on mine; standing on her is aboard her (the aboard door's
//                 own `on`, scenes/comeSailAway/comeSailAwayAboard.js), so her deck carries me as she sails and my place on it is said
//   FOUR-HOSTS  - only the world host's street stands her (scenes/world.js); a building's and a dungeon's frames stand
//                 no one's boat (scenes/worldModes.js, scenes/dungeonContext.js), and the standalone street
//                 (scenes/exterior.js) has no peers
// Every pin runs the REAL modules: Come Sail Away's pool over the vendored hulls (scenes/comeSailAway/comeSailAwayPool.js), a peer's
// boat posed off her owner's word (scenes/comeSailAway/comeSailAwayPeers.js), the aboard machine (scenes/comeSailAway/comeSailAwayAboard.js),
// the world's collider (player/collider.js) and the player's motor (player/motor.js) - with world.js's own
// csaSyncColliders, csaSphereCastAll and csaPeersFrame lifted from its source and run in the frame's order (the motor,
// the mod's step's sync, the peers posed and the deck's carry). `01-Overview/bugs/Field-Bugs-2026-10-01b.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool } from '../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createComeSailAwayPeers } from '../../src/scenes/comeSailAway/comeSailAwayPeers.js';
import { createComeSailAwayAboard, localOf, CSA_ABOARD_GRACE } from '../../src/scenes/comeSailAway/comeSailAwayAboard.js';
import { Boat, HULL_NAMES } from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { boardPlaceOf } from '../../src/systems/comeSailAway/comeSailAway.js';
import { colliderPoses, invertAffine, boxColliderTriangles, raycastColliders, BUILTIN_COLLIDER_MESHES } from '../../src/world/prefabColliders.js';
import { quatAngleAxis, quatRotate } from '../../src/world/quat.js';
import { meshLocalBounds, colliderBounds } from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor, FIXED_DT, CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { peerHullSweep, peerHullsMeet, hullsStood, resetHullLatch, hullPassesMyDeck, hullPlan, deckPressed } from '../../src/scenes/comeSailAway/peerHulls.js';   // HULL-PASS
import { setWildHere } from '../../src/systems/wild/wildZone.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
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
const FLOOR = -0.6;        // a shallow anchorage's floor, the world collider's ground
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
          surfaceAt, csaPixelAt, state, deepWaters, hullsStood, csaRuntime, hullPassesMyDeck } = s;
    ${cutLine(WORLD, '  const _csaBuckets = new Map();')}${cutLine(WORLD, '  const csaBoatId = (boat) =>')}
    ${cut(WORLD, '  const csaShapeOf = (c) =>', ');\n')}${cutLine(WORLD, '  const CSA_RIGID_EPS =')}${cut(WORLD, '  function csaCarry(b, m) {')}
    ${cut(WORLD, '  function csaSyncColliders() {')}${cutLine(WORLD, '  const _csaSlab = [0, 0, 0]')}
    ${cut(WORLD, '  function csaSphereCastAll(')}
    ${cutLine(WORLD, '  const csaBoatUnderMe = () =>')}${cutLine(WORLD, '  let _csaPeersPosed = false;')}${cutLine(WORLD, '  const deckMayCarry = ')}${cutLine(WORLD, '  const deckGround = ')}${cutLine(WORLD, '  const deckCarry = ')}${cut(WORLD, '  function csaPeersFrame(dt) {')}
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
  const helm = { boat: null };
  resetHullLatch();
  const w = liftWorld({
    colliderPoses, invertAffine, boxColliderTriangles, csaModeCollider: () => colliders[modes?.mode ?? 'exterior'], csaAboard: aboard,
    csaColliderBoats: () => pool.boats, csaColliderMesh: geometry, _csaBoatIds: new WeakMap(), _csaBoatSerial: 0,
    csa: pool, csaPeers: peers, csaOn: () => true, online: { id: 'me' }, walkMode: true, playerSpawned: true, _teleporting: false, _traveling: false,
    modes, playerEntity: { health: 100 }, player, cam, CAPSULE_HEIGHT, _csaMovedPlayer: false,
    surfaceAt: () => -Infinity, csaPixelAt: () => null, state: null, deepWaters: null,   // the sweep's ground: none (a sea of the anchorage's own)
    hullsStood, hullPassesMyDeck, csaRuntime: { isSailing: () => !!helm.boat, state: { get CurrentBoat() { return helm.boat; } } },   // AUDIT FB1026d D1: the deck my body stands on - my helm's (`helm.boat`), hers aboard, the one under my feet
  });
  const frame = (input = IDLE, yaw = 0) => { player.update(FIXED_DT, input, yaw); w.sync(); w.peersFrame(FIXED_DT); w.rearm(); };
  /** A boat's buckets' key head (csaSyncColliders' `csaBoat:<id>:`). */
  const keyOf = (boat) => `csaBoat:${w.boatId(boat)}:`;
  /** Whether any bucket of `boat` stands in a collider. */
  const stands = (col, boat) => [...col._buckets.keys()].some((k) => k.startsWith(keyOf(boat)));
  return { pool, peers, aboard, own, hers, colliders, player, cam, w, frame, keyOf, stands, modes, geometry, helm };
}
/** A boat's root pose, as the aboard machine reads it. */
const poseOf = (boat) => ({ position: [...boat.GameObject.position], rotation: [...boat.GameObject.rotation] });

test('FB1001b PEER-HULL: ANOTHER PLAYER\'S HULL TAKES ME WHERE MY OWN TAKES ME - a wader in the anchorage running at her beam meets each of the five hulls exactly as he meets the same hull of mine (a ship\'s stops him on her near side; an open boat\'s low hull has its own say), never walked through; I am not aboard her, and her buckets stand in my collider all the same (CSA-K stood them only for one aboard: PR-WAGON1\'s law, which Mac\'s word sets aside for boats)', async () => {
  for (let hull = 0; hull < HULL_NAMES.length; hull++) {
    const r = await rig({ hull });
    /** Where a wader running east from 20 m off a boat's port side comes to rest, from her keel's line, and the highest
     *  his feet stood on the way. */
    const wade = (boat) => {
      const p = boat.GameObject.position;
      r.player.spawn(p[0] - 20, FLOOR, p[2]);
      for (let i = 0; i < 30; i++) r.frame(IDLE, EAST);
      let peak = -Infinity;
      for (let i = 0; i < 60 * 6; i++) { r.frame(RUN, EAST); peak = Math.max(peak, r.player.pos[1]); }
      return { x: r.player.pos[0] - p[0], peak };
    };
    const mine = wade(r.own);
    const hers = wade(r.hers);
    const name = HULL_NAMES[hull];
    assert.ok(mine.x < 12, `${name}: my own hull meets the wader - he does not run on past her (${mine.x.toFixed(2)} m from her keel)`);
    if (hull === SMALL_SHIP || hull === CARRACK || hull === HULL_NAMES.indexOf('Large Galley')) assert.ok(mine.x < -1, `${name}: a ship's hull stops him on her near side (${mine.x.toFixed(2)})`);
    assert.ok(Math.abs(hers.x - mine.x) < 0.01 && Math.abs(hers.peak - mine.peak) < 0.01, `${name}: hers takes him where mine does - ${hers.x.toFixed(2)} m from her keel against ${mine.x.toFixed(2)}${hers.x > 12 ? ' (walked through her)' : ''}, his feet at most ${hers.peak.toFixed(2)} against ${mine.peak.toFixed(2)}`);
    assert.ok(r.stands(r.colliders.exterior, r.hers), `${name}: her hull stands in my collider though I am not aboard her`);
  }
});

test('FB1001b PEER-HULL: HER DECK\'S FURNITURE AND HER HULL ARE MET AS MINE ARE - a ray across her deck at chest height meets her mainmast where the same ray meets mine, and the helm\'s sweep (world.js csaSphereCastAll, CheckCollision\'s) meets her hull at the distance it meets my boat\'s, so a boat of mine backs off hers as it backs off my own (HULL-PASS: the host hands Come Sail Away this sweep through peerHulls.js, which drops her outside a PvP zone - the next pin)', async () => {
  const r = await rig({ hull: SMALL_SHIP });
  for (let i = 0; i < 2; i++) r.frame();
  // PIN MOVED (GALLEON, 2026-10-01): the new galleon's mainmast (MainMast, Mac's), stepped 0.12 m abaft her middle
  const mast = (boat) => colliderPoses(boat.GameObject).find((x) => x.node.name === 'MainMast')?.collider;
  assert.ok(mast(r.hers) && mast(r.own), 'the Small Ship carries her mainmast\'s collider (MainMast)');
  /** A ray athwartships across a Small Ship's deck at the mainmast's station, chest high, from 3 m to port. */
  const across = (boat) => {
    const p = boat.GameObject.position;
    const deck = raycastColliders(boat.GameObject, [p[0] - 3, p[1] + 30, p[2] - 0.12], [0, -1, 0], 60, { triggers: false, geometry: r.geometry });
    assert.ok(deck, 'her deck under the ray');
    return r.colliders.exterior.raycastHit([p[0] - 3, deck.point[1] + 1.3, p[2] - 0.12], [1, 0, 0], 20);
  };
  const mine = across(r.own), hers = across(r.hers);
  assert.ok(Number.isFinite(mine.dist) && r.w.buckets.get(mine.key)?.c === mast(r.own), `across my deck: my mainmast (${mine.key})`);
  assert.ok(Number.isFinite(hers.dist), 'across her deck: something met - her deck\'s furniture stands in my collider');
  assert.ok(r.w.buckets.get(hers.key)?.c === mast(r.hers), `across her deck: her mainmast (${hers.key})`);
  assert.ok(Math.abs(hers.dist - mine.dist) < 1e-3, `at the distance mine stands (${hers.dist} vs ${mine.dist})`);
  // the helm's sweep from 25 m off each one's beam: her hull among what it meets, rooted at her, where mine is met
  const swept = (boat) => r.w.sweep([boat.GameObject.position[0] - 25, SEA + 1, boat.GameObject.position[2]], 1, [1, 0, 0], 40).filter((h) => h.root === boat.GameObject);
  const sMine = swept(r.own), sHers = swept(r.hers);
  assert.ok(sMine.length > 0, 'the sweep meets my boat');
  assert.ok(sHers.length > 0, 'the sweep meets her boat - a boat of mine sailed at hers backs off it');
  assert.ok(Math.abs(Math.min(...sHers.map((h) => h.distance)) - Math.min(...sMine.map((h) => h.distance))) < 1e-3, 'at the distance it meets mine');
});

test('HULL-PASS (Field-Bugs-2026-10-26d, "Player boat collision needs to be off outside of PVP zone or just during the Sethrakul fight"): THE HELM\'S SWEEP AS THE HOST WIRES IT (peerHulls.js peerHullSweep over world.js csaSphereCastAll) passes through her hull outside a PvP zone and meets it inside one, as it meets my own boat either way; her hull stays in my collider to be walked, stood on and swum against (mutants: the zone unread; my own boat dropped with hers)', async () => {
  assert.ok(WORLD.includes('    sphereCastAll: peerHullSweep(csaSphereCastAll, csa),'), 'the host hands Come Sail Away the wrapped sweep');
  const r = await rig({ hull: SMALL_SHIP });
  for (let i = 0; i < 2; i++) r.frame();
  const helm = peerHullSweep(r.w.sweep, r.pool);
  assert.ok(r.pool.peerBoats.includes(r.hers), 'she is among the pool\'s other players\' ships, where the peers stood her');
  const swept = (boat) => helm([boat.GameObject.position[0] - 25, SEA + 1, boat.GameObject.position[2]], 1, [1, 0, 0], 40, { boat: null }).filter((h) => h.root === boat.GameObject);
  try {
    setWildHere(false);
    assert.equal(peerHullsMeet(), false);
    assert.equal(swept(r.hers).length, 0, 'outside a PvP zone: her hull is no rock to my helm');
    assert.ok(swept(r.own).length > 0, 'my own boat is met as before');
    assert.ok(r.stands(r.colliders.exterior, r.hers), 'her hull still stands in my collider - her deck walked, her side swum against');
    setWildHere(true, 1, 'ether');
    assert.equal(peerHullsMeet(), true);
    assert.ok(swept(r.hers).length > 0, 'in a PvP zone: her hull meets my helm');
  } finally {
    setWildHere(false);
  }
});

test('FB1001b PEER-DECK: I STAND ON HER DECK AS ON MINE AND SHE CARRIES ME AS SHE SAILS - set down on the Small Ship\'s deck at her ladder\'s place I stand on her own collider from the first step (never falling into it), standing on her is aboard her, and with her owner at her helm sailing her north and turning, every step stands on her deck at the place I took on it while she sails twelve metres; my place aboard is said in her frame', async () => {
  const r = await rig({ hull: SMALL_SHIP, mine: false });
  const at = boardPlaceOf(r.hers.BoardTriggers[0]);
  const deck = raycastColliders(r.hers.GameObject, [at.position[0], at.position[1] + 1, at.position[2]], [0, -1, 0], 6, { triggers: false, geometry: r.geometry });
  assert.ok(deck && deck.point[1] > SEA + 3, `her deck under her ladder's place (${deck?.point[1]})`);
  r.frame();   // her buckets where she stands, before I step on her
  r.player.spawn(deck.point[0], deck.point[1] + 0.02, deck.point[2]);
  r.frame();
  assert.ok(r.player.grounded, `the first step stands on her deck (feet ${r.player.pos[1].toFixed(3)}, her deck ${deck.point[1].toFixed(3)}) - her deck is a floor to me as my own boat's is, not only once I am aboard`);
  assert.ok(String(r.player.groundKey).startsWith(r.keyOf(r.hers)), `on her own collider (${r.player.groundKey})`);
  assert.equal(r.aboard.aboard?.owner, 'ann', 'standing on her is aboard her');
  const place = localOf(poseOf(r.hers), r.player.pos);
  const start = [...r.player.pos], from = [...r.hers.GameObject.position];
  // Ann takes her helm: her word every fifth of a second (the wire's cadence) where her way has brought her
  const v = [0, 4], turn = 6;
  let t = 0, worst = 0;
  for (let i = 0; i < 60 * 3; i++) {
    if (i % 12 === 0) {
      const q = quatAngleAxis(turn * t, [0, 1, 0]);
      r.peers.applyOwner('ann', annWord(SMALL_SHIP, [from[0] + v[0] * t, SEA, from[2] + v[1] * t], q, [v[0], v[1], turn]), (p) => p, t * 1000);
    }
    r.frame();
    t += FIXED_DT;
    assert.ok(r.player.grounded && String(r.player.groundKey).startsWith(r.keyOf(r.hers)), `step ${i}: standing on her deck (${r.player.groundKey})`);
    assert.equal(r.aboard.aboard?.owner, 'ann', `step ${i}: aboard her`);
    const now = localOf(poseOf(r.hers), r.player.pos);
    worst = Math.max(worst, Math.hypot(now[0] - place[0], now[1] - place[1], now[2] - place[2]));
  }
  const sailed = Math.hypot(r.hers.GameObject.position[0] - from[0], r.hers.GameObject.position[2] - from[2]);
  const carried = Math.hypot(r.player.pos[0] - start[0], r.player.pos[2] - start[2]);
  assert.ok(sailed > 10, `she sailed (${sailed.toFixed(2)} m)`);
  assert.ok(worst < 0.02, `my place on her deck kept as she sailed and turned - CSA-K's carry (${worst.toFixed(4)} m at worst)`);
  assert.ok(carried > 10, `carried with her (${carried.toFixed(2)} m)`);
  const said = r.aboard.word(r.player.pos);
  assert.deepEqual(said.slice(0, 2), ['ann', 0], 'my place aboard said: her owner and which of her boats');
  const here = localOf(poseOf(r.hers), r.player.pos);
  said.slice(2).forEach((x, k) => assert.ok(Math.abs(x - here[k]) <= 0.005 + 1e-9, `my feet in her frame, to the centimetre (${x} vs ${here[k]})`));
});

test('FB1001b PEER-DECK: THE ABOARD DOOR - a body standing on her own colliders is aboard her, whose and which, as one landed on her from above is; standing on anything else over her (a pier) is not, nor is a swimmer, nor one past her reach', async () => {
  const r = await rig({ hull: LARGE_BOAT, mine: false });
  const at = boardPlaceOf(r.hers.BoardTriggers[0]);
  const deck = raycastColliders(r.hers.GameObject, [at.position[0], at.position[1] + 1, at.position[2]], [0, -1, 0], 6, { triggers: false, geometry: r.geometry }).point;
  const me = { feet: [...deck], ground: null, swimming: false };
  const view = () => ({ allowed: true, feet: () => me.feet, height: CAPSULE_HEIGHT, swimming: me.swimming, ground: (b) => (typeof me.ground === 'function' ? me.ground(b) : me.ground), carry() {} });
  // (identity asked of booleans: a failed equal on a boat would print her whole prefab tree)
  me.ground = 'other';
  assert.ok(r.aboard.frame(view()) === null, 'standing on a pier over her deck: not aboard');
  me.ground = null; me.swimming = true;
  assert.ok(r.aboard.frame(view()) === null, 'afloat in her: not aboard (the ladder is the way up out of the water)');
  me.swimming = false;
  me.ground = (b) => (b === r.hers ? 'boat' : 'other');
  me.feet = [deck[0] + 200, deck[1], deck[2]];
  assert.ok(r.aboard.frame(view()) === null, 'past her reach: not asked');
  me.feet = [...deck];
  assert.ok(r.aboard.frame(view()) === r.hers, 'standing on her own colliders: aboard her');
  assert.deepEqual([r.aboard.aboard?.owner, r.aboard.aboard?.slot], ['ann', 0], 'whose, and which of her boats');
});

/** Ann's word, sailing her `hull` along flat `dir` at `speed` from `from` (x, z), `t` seconds on. */
const sailing = (hull, from, dir, speed, t) => annWord(hull, [from[0] + dir[0] * speed * t, SEA, from[1] + dir[1] * speed * t], undefined, [dir[0] * speed, dir[1] * speed, 0]);
/** A body set down on `boat`'s deck at her first ladder's place, settled. */
function standOn(r, boat) {
  const at = boardPlaceOf(boat.BoardTriggers[0]);
  const deck = raycastColliders(boat.GameObject, [at.position[0], at.position[1] + 1, at.position[2]], [0, -1, 0], 6, { triggers: false, geometry: r.geometry });
  r.frame();
  r.player.spawn(deck.point[0], deck.point[1] + 0.02, deck.point[2]);
  for (let i = 0; i < 30; i++) r.frame();
  return localOf(poseOf(boat), r.player.pos);
}

test('HULL-PASS WHAT PASSES MY HELM PASSES MY DECK (AUDIT FB1026d D1): outside a PvP zone a ship sailed through the deck I stand on - hers through my moored one, or hers carrying me through mine - neither shoves me off my place nor carries me away aboard another; and inside a zone her hull stands again (mutants: the deck\'s hulls left standing; the deck under my feet unread; the deck kept through no jump)', async () => {
  setWildHere(false);
  for (const along of [[1, 0], [0, 1]]) {
    // A: on my own moored deck, Ann sails her Small Ship through it at 4 m/s
    const r = await rig({ hull: SMALL_SHIP });
    const place = standOn(r, r.own);
    assert.equal(r.aboard.aboard, null, 'on my own deck');
    const me = r.own.GameObject.position, from = [me[0] - along[0] * 40, me[2] - along[1] * 40];
    r.peers.applyOwner('ann', annWord(SMALL_SHIP, [from[0], SEA, from[1]]), (p) => p, 0);
    for (let i = 0; i < 10; i++) r.frame();
    let worst = 0, carried = false, t = 0;
    for (let i = 0; i < Math.ceil(20 / FIXED_DT); i++) {
      if (i % 12 === 0) r.peers.applyOwner('ann', sailing(SMALL_SHIP, from, along, 4, t), (p) => p, 1000 + t * 1000);
      r.frame(i % 90 === 45 ? { forward: 0, strafe: 0, jump: true } : IDLE); t += FIXED_DT;   // a jump every second and a half: the deck kept while my feet are off it
      const now = localOf(poseOf(r.own), r.player.pos);
      worst = Math.max(worst, Math.hypot(now[0] - place[0], now[2] - place[2]));
      carried ||= r.aboard.aboard?.owner === 'ann';
    }
    assert.ok(worst < 0.5, `A ${along}: my place on my deck held, jumping (${worst.toFixed(2)} m)`);
    assert.ok(Math.abs(localOf(poseOf(r.own), r.player.pos)[1] - place[1]) < 0.3, 'and I stand on my deck at the end');
    assert.equal(carried, false, `A ${along}: never carried off aboard hers`);
    // B: aboard Ann's, she sails me through my own moored ship
    const q = await rig({ hull: SMALL_SHIP });
    const onHers = standOn(q, q.hers);
    assert.equal(q.aboard.aboard?.owner, 'ann');
    q.own.GameObject.position = along[0] ? [MINE_X, SEA, 0] : [0, SEA, 60];
    let worstB = 0, lost = false; t = 0;
    for (let i = 0; i < Math.ceil((along[0] ? MINE_X + 40 : 100) / 4 / FIXED_DT); i++) {
      if (i % 12 === 0) q.peers.applyOwner('ann', sailing(SMALL_SHIP, [0, 0], along, 4, t), (p) => p, 1000 + t * 1000);
      q.frame(); t += FIXED_DT;
      const now = localOf(poseOf(q.hers), q.player.pos);
      worstB = Math.max(worstB, Math.hypot(now[0] - onHers[0], now[1] - onHers[1], now[2] - onHers[2]));
      lost ||= q.aboard.aboard?.owner !== 'ann';
    }
    assert.ok(worstB < 0.5, `B ${along}: my place on her deck held through my own ship (${worstB.toFixed(2)} m)`);
    assert.equal(lost, false, `B ${along}: aboard her all the way`);
  }
  // and inside a zone her hull stands in my collider over my deck, as a rock
  const z = await rig({ hull: SMALL_SHIP });
  standOn(z, z.own);
  z.peers.applyOwner('ann', annWord(SMALL_SHIP, [MINE_X + 3, SEA, 0]), (p) => p, 0);
  for (let i = 0; i < 4; i++) z.frame();
  assert.equal(z.stands(z.colliders.exterior, z.hers), false, 'outside: through my deck, out of my collider');
  setWildHere(true, 1, 'ether');
  resetHullLatch();   // a deck first stood on inside the zone - nothing passing to latch
  for (let i = 0; i < 4; i++) z.frame();
  assert.equal(z.stands(z.colliders.exterior, z.hers), true, 'inside a zone: she stands');
  setWildHere(false);
});

test('HULL-PASS A LADDER PRESSED IS THE DECK I STAND ON (AUDIT FB1026d II E2): aboard hers with my ship overlapping hers, my own ladder sets me on my deck and I stand there - my ship in my collider, aboard none - where I fell through my deck onto her hull; and her ladder after sets me aboard her again (mutants: the ladder unsaid; the press kept past the host\'s word)', async () => {
  setWildHere(false);
  assert.match(cut(CSA_SRC, '  function BoardBoat(hit) {'), /deckPressed\(boat\);/, 'Come Sail Away\'s BoardBoat says the deck it set me on');
  const r = await rig({ hull: SMALL_SHIP });
  r.own.GameObject.position = [10, SEA, 0];   // mine moored overlapping hers, at the origin
  for (let i = 0; i < 3; i++) r.frame();
  standOn(r, r.hers);
  assert.equal(r.aboard.aboard?.owner, 'ann', 'aboard hers');
  assert.equal(r.stands(r.colliders.exterior, r.own), false, 'and my ship passes - her deck carries me through it');
  const placeIn = (boat, over) => { const P = hullPlan(over, r.geometry); return boat.BoardTriggers.map((t) => boardPlaceOf(t)).find((at) => Math.abs(at.position[0] - P.c[0]) <= P.hw && Math.abs(at.position[2] - P.c[1]) <= P.hl); };
  const deckAt = (boat, at) => raycastColliders(boat.GameObject, [at.position[0], at.position[1] + 1.2, at.position[2]], [0, -1, 0], 4, { triggers: false, geometry: r.geometry }).point;
  const mine = placeIn(r.own, r.hers);
  assert.ok(mine, 'a ladder of mine over her deck');
  const myDeck = deckAt(r.own, mine);
  r.player.spawn(mine.position[0], myDeck[1] + 0.02, mine.position[2]); deckPressed(r.own);   // BoardBoat: set down at my ladder, aligned, the deck said
  for (let i = 0; i < 180; i++) r.frame();
  assert.ok(Math.abs(r.player.pos[1] - myDeck[1]) < 0.3, `on my deck (${r.player.pos[1].toFixed(2)}, my deck ${myDeck[1].toFixed(2)})`);
  assert.equal(r.aboard.aboard, null, 'aboard none');
  assert.equal(r.stands(r.colliders.exterior, r.own), true, 'my ship stands in my collider');
  assert.ok(String(r.player.groundKey).startsWith(r.keyOf(r.own)), 'standing on my own');
  // her ladder over my deck (world.js csaBoardPeer: set down, aboard her at once, synced)
  const hers = placeIn(r.hers, r.own);
  assert.ok(hers, 'a ladder of hers over my deck');
  const herDeck = deckAt(r.hers, hers);
  r.player.spawn(hers.position[0], herDeck[1] + 0.02, hers.position[2]);   // her ladder says no deck of mine: the host's word does (csaAboard.board)
  assert.equal(r.aboard.board(r.hers, CSA_ABOARD_GRACE), true);
  r.w.sync();
  for (let i = 0; i < 180; i++) r.frame();
  assert.equal(r.aboard.aboard?.owner, 'ann', 'aboard her again');
  assert.ok(Math.abs(r.player.pos[1] - herDeck[1]) < 0.3, `on her deck (${r.player.pos[1].toFixed(2)}, her deck ${herDeck[1].toFixed(2)})`);
});

const CSA_SRC = src('src/systems/comeSailAway/comeSailAway.js');
const CSA = readFileSync(new URL('../../src/systems/comeSailAway/comeSailAway.js', import.meta.url), 'utf8');
/** Come Sail Away's own CheckCollision, CanTurnLeft and CanTurnRight, lifted from source over `deps` and `state`. */
function liftHelm(deps, state) {
  const helpers = CSA.slice(CSA.indexOf('const K_EPSILON = '), CSA.indexOf('const vCross')).replace(/export function/g, 'function').replace(/export const/g, 'const');
  const body = `
    const f = Math.fround; const V_UP = [0, 1, 0];
    ${helpers}
    const conj = (q) => [-q[0], -q[1], -q[2], q[3]];
    const inverseTransformDirection = (node, v) => quatRotate(conj(node.rotation), v).map(f);
    const log = () => {}; const ResetTimeScale = () => {};
    ${cut(CSA, '  function combinedCollisionDirection() {')}
    ${cut(CSA, '  function CanTurnLeft(boat) {')}
    ${cut(CSA, '  function CanTurnRight(boat) {')}
    ${cut(CSA, '  function CheckCollision(boat) {')}
    return { CheckCollision, CanTurnLeft, CanTurnRight };`;
  // eslint-disable-next-line no-new-func
  return new Function('deps', 'state', 'meshLocalBounds', 'colliderBounds', 'quatRotate', body)(deps, state, meshLocalBounds, colliderBounds, quatRotate);
}

test('HULL-PASS THE ZONE TURNING DOES NOT JAM THEM (AUDIT FB1026d D2): my ship at my helm inside hers when hulls start to meet goes on passing through her - no contact, both turns free - until she is clear of me, and a ship that comes into mine after meets it as a rock (mutants: the latch dropped; the latch never let go)', async () => {
  setWildHere(false);
  const r = await rig({ hull: SMALL_SHIP, mine: true });
  r.own.GameObject.position = [3, SEA, 0];   // mine 3 m abeam inside hers, at the origin
  r.helm.boat = r.own;
  for (let i = 0; i < 3; i++) r.frame();
  const state = { collisionDirections: [], CollisionVector: [0, 0, 0], timeScaleIndex: 0 };
  const csa = liftHelm({ pool: r.pool, sphereCastAll: peerHullSweep(r.w.sweep, r.pool) }, state);
  const look = () => { csa.CheckCollision(r.own); return { contacts: state.collisionDirections.length, left: csa.CanTurnLeft(r.own), right: csa.CanTurnRight(r.own) }; };
  assert.deepEqual(look(), { contacts: 0, left: true, right: true }, 'outside a zone: she passes');
  setWildHere(true, 1, 'ether');
  for (let i = 0; i < 2; i++) r.frame();
  assert.deepEqual(look(), { contacts: 0, left: true, right: true }, 'the zone turned: already through me, she goes on passing');
  assert.equal(r.stands(r.colliders.exterior, r.hers), false, 'and my collider lets her pass too');
  // she sails clear, then back into me: a rock now
  r.peers.applyOwner('ann', annWord(SMALL_SHIP, [-60, SEA, 0]), (p) => p, 2000);
  for (let i = 0; i < 40; i++) r.frame();
  look();
  r.peers.applyOwner('ann', annWord(SMALL_SHIP, [0, SEA, 0]), (p) => p, 4000);
  for (let i = 0; i < 40; i++) r.frame();
  const met = look();
  assert.ok(met.contacts > 0, `clear of me and back: she meets my helm (${met.contacts} contacts)`);
  assert.equal(r.stands(r.colliders.exterior, r.hers), true, 'and stands in my collider');
  setWildHere(false);
});

test('HULL-PASS ONE OWNER\'S HULLS MEET (AUDIT FB1026d II E1): outside a PvP zone, at my helm, my own other ship moored 3 m inside mine stands in my collider and meets my sweep - only another owner\'s hull passes (mutant: the owner unread)', async () => {
  setWildHere(false);
  const r = await rig({ hull: SMALL_SHIP, mine: true });
  r.peers.applyOwner('ann', annWord(SMALL_SHIP, [-300, SEA, 0]), (p) => p, 0);   // hers far off
  const other = r.pool.spawnNow(new Boat(SMALL_SHIP, 0), { position: [0, 0, 0], rotation: Q0 });
  other.GameObject.position = [MINE_X + 3, SEA, 0];
  r.helm.boat = r.own;
  for (let i = 0; i < 40; i++) r.frame();
  assert.equal(r.stands(r.colliders.exterior, other), true, 'my other ship stands in my collider');
  const state = { collisionDirections: [], CollisionVector: [0, 0, 0], timeScaleIndex: 0 };
  const csa = liftHelm({ pool: r.pool, sphereCastAll: peerHullSweep(r.w.sweep, r.pool) }, state);
  csa.CheckCollision(r.own);
  assert.ok(state.collisionDirections.length > 0, `and meets my helm (${state.collisionDirections.length} contacts)`);
  // hers in the same place passes, as before
  other.GameObject.position = [MINE_X + 300, SEA, 0];
  r.peers.applyOwner('ann', annWord(SMALL_SHIP, [MINE_X + 3, SEA, 0]), (p) => p, 2000);
  for (let i = 0; i < 40; i++) r.frame();
  state.collisionDirections.length = 0;
  csa.CheckCollision(r.own);
  assert.equal(state.collisionDirections.length, 0, 'another owner\'s hull passes');
  assert.equal(r.stands(r.colliders.exterior, r.hers), false);
});

test('HULL-PASS A BOAT THE POOL LET GO IS NO DECK (AUDIT FB1026d II, lane E\'s suspicion): the deck I stood on, removed from the pool (a peer gone, a boat packed) while my feet stay over its plan, keeps no other player\'s hull out of my collider (mutant: the pool unread)', async () => {
  setWildHere(false);
  const r = await rig({ hull: SMALL_SHIP });
  standOn(r, r.own);
  r.peers.applyOwner('ann', annWord(SMALL_SHIP, [MINE_X + 3, SEA, 0]), (p) => p, 0);
  for (let i = 0; i < 4; i++) r.frame();
  assert.equal(r.stands(r.colliders.exterior, r.hers), false, 'through my deck: she passes');
  const boats = [r.hers];
  assert.deepEqual(hullsStood(boats, null, r.player.pos, { boats: [], peerBoats: [r.hers] }, r.geometry), boats, 'my deck gone from the pool: no deck, and she stands');
});

test('FB1001b FOUR-HOSTS: HER BOAT STANDS ON THE STREET ALONE - the world host stands her in the street\'s collider (and with no mode named, the street is the mode, as csaModeCollider reads it); a building\'s and a dungeon\'s frames stand none of hers (mine stand in the mode\'s, CSA-D\'s law), and back on the street she stands again; the other three hosts name no peer\'s boat', async () => {
  const modes = { mode: 'exterior' };
  const r = await rig({ hull: LARGE_BOAT, modes });
  r.w.sync();
  assert.ok(r.stands(r.colliders.exterior, r.hers), 'on the street: hers in the street\'s collider');
  assert.ok(r.stands(r.colliders.exterior, r.own), 'and mine');
  for (const mode of ['interior', 'dungeon']) {
    modes.mode = mode;
    r.w.sync();
    assert.ok(r.stands(r.colliders[mode], r.own), `${mode}: mine in the mode's collider (CSA-D)`);
    assert.equal(r.stands(r.colliders[mode], r.hers), false, `${mode}: none of hers in the mode's collider`);
    assert.equal(r.stands(r.colliders.exterior, r.hers), false, `${mode}: and none left in the street's`);
  }
  modes.mode = 'exterior';
  r.w.sync();
  assert.ok(r.stands(r.colliders.exterior, r.hers), 'back on the street: hers again');
  // no mode named: the street (csaModeCollider's own default)
  const bare = await rig({ hull: LARGE_BOAT, modes: null });
  bare.w.sync();
  assert.ok(bare.stands(bare.colliders.exterior, bare.hers), 'with no mode named: hers on the street');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/exterior.js']) {
    assert.doesNotMatch(src(host), /peerBoats|csaPeers|comeSailAwayPeers|comeSailAwayAboard/, `${host} stands no peer's boat`);
  }
});

for (const owner of ['own', 'hers']) {
  test(`Ladder arrival clears incoming motion on ${owner} boat and stays on deck`, async () => {
    const r = await rig({ hull: SMALL_SHIP });
    const boat = r[owner];
    const at = boardPlaceOf(boat.BoardTriggers[0]);
    const deck = raycastColliders(boat.GameObject, [at.position[0], at.position[1] + 1, at.position[2]], [0, -1, 0], 6, { triggers: false, geometry: r.geometry });
    assert.ok(deck);
    r.frame();
    r.player.spawn(0, 20, 0);
    r.player._airVelX = 8;
    r.player._airVelZ = -8;
    r.player.velY = -12;
    r.player.falling = true;
    r.player.fallStart = 20;
    r.player.pinFeet(deck.point[0], deck.point[1] + 0.02, deck.point[2]);
    // Run the actual host's completion seam after the ladder's deck alignment.
    // eslint-disable-next-line no-new-func
    const finish = new Function('player', `${cutLine(WORLD, '  const csaFinishBoarding =')} return csaFinishBoarding;`)(r.player);
    finish();
    assert.deepEqual([r.player._airVelX, r.player._airVelZ, r.player.velY, r.player.falling], [0, 0, 0, false]);
    const start = [...r.player.pos];
    for (let i = 0; i < 60; i++) r.frame();
    assert.ok(r.player.grounded);
    assert.ok(String(r.player.groundKey).startsWith(r.keyOf(boat)));
    // The ladder marker overlaps nearby geometry: permit initial capsule
    // separation, then require the player to remain still on this boat.
    assert.ok(Math.hypot(r.player.pos[0] - start[0], r.player.pos[2] - start[2]) < 0.75);
    const settled = [...r.player.pos];
    for (let i = 0; i < 120; i++) r.frame();
    assert.ok(Math.hypot(r.player.pos[0] - settled[0], r.player.pos[2] - settled[2]) < 0.02);
    assert.ok(r.player.grounded && String(r.player.groundKey).startsWith(r.keyOf(boat)));
  });
}

test('Both ladder activation paths finish placement after aligning to the deck', () => {
  const motor = new PlayerMotor(new Collider(() => 0));
  const finishBoarding = () => motor.spawn(...motor.pos);
  const calls = [];
  const deps = { helm: {
    setPlayerPosition: () => { calls.push('place'); motor.pinFeet(1, 2, 3); },
    setFacing: () => {},
    alignToGround: () => { calls.push('align'); motor.pinFeet(1, 3, 3); },
    finishBoarding: () => { calls.push('finish'); finishBoarding(); },
  } };
  motor._airVelX = 8;
  // eslint-disable-next-line no-new-func
  const own = new Function('deps', 'boatOfHit', 'boardPlaceOf', 'deckPressed', `${cut(src('src/systems/comeSailAway/comeSailAway.js'), '  function BoardBoat(hit) {')} return BoardBoat;`)(deps, () => ({}), () => ({ position: [1, 2, 3], yaw: 0 }), () => calls.push('said'));
  own({ node: {} });
  assert.deepEqual(calls, ['place', 'align', 'finish', 'said']);   // AUDIT FB1026d II E2: and the deck said
  assert.equal(motor._airVelX, 0);
  assert.deepEqual([...motor.pos], [1, 3, 3]);
  const peer = cut(WORLD, '  function csaBoardPeer(pick) {');
  assert.ok(peer.indexOf('csaFinishBoarding();') > peer.indexOf('alignControllerToGround('));
  assert.ok(peer.indexOf('csaFinishBoarding();') < peer.indexOf('csaAboard.board('));
  assert.match(WORLD, /finishBoarding: csaFinishBoarding/);
});
