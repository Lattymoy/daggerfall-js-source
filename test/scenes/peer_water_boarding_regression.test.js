// Peer water boarding regression (2026-10-02): a swimmer boards ANOTHER player's boat, then loses
// attachment after its two-frame grace. The world cached isPlayerSwimming before Deep Waters
// restored dry flags, so its later tile-0 latch resurrected swimming and detached the passenger.
// Real hulls, collision, motor, swim drivers, peer interpolation and source-lifted world phases;
// synthetic open sea and renderer, with no owned boat or live network connection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createComeSailAwayPool } from '../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createComeSailAwayPeers } from '../../src/scenes/comeSailAway/comeSailAwayPeers.js';
import { createComeSailAwayAboard, localOf } from '../../src/scenes/comeSailAway/comeSailAwayAboard.js';
import { Boat, HULL_NAMES } from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { boardPlaceOf } from '../../src/systems/comeSailAway/comeSailAway.js';
import { colliderPoses, invertAffine, boxColliderTriangles, raycastColliders, BUILTIN_COLLIDER_MESHES } from '../../src/world/prefabColliders.js';
import { quatAngleAxis } from '../../src/world/quat.js';
import { Collider } from '../../src/player/collider.js';
import { PlayerMotor, FIXED_DT, CAPSULE_HEIGHT } from '../../src/player/motor.js';

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
const FLOOR = -24;        // carved open-sea floor
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


import { alignControllerToGround } from '../../src/world/groundAlign.js';
import { CSA_ABOARD_GRACE } from '../../src/scenes/comeSailAway/comeSailAwayAboard.js';
import { createDeepWatersPlayer } from '../../src/scenes/deepWater/deepWatersPlayer.js';
import { createSwimMovement } from '../../src/scenes/deepWater/deepWatersSwimMove.js';
import { applyMotorEffectFlags } from '../../src/scenes/shared.js';
import { exteriorSwimming } from '../../src/player/exteriorSurface.js';
import { flushStateChange } from '../../src/systems/deepWater/deepWaterPlayer.js';
import { isBoatEffectBundle } from '../../src/world/deepWater/deepWaterSwim.js';

function boardViaWorld(r, ladder) {
  const player = r.player;
  const csaSetPlayerPosition = c => player.pinFeet(c[0], c[1] - player.height / 2, c[2]);
  const dwPlayerObjectPosition = () => [player.pos[0], player.pos[1] + player.height / 2, player.pos[2]];
  const scope = { csaAboard:r.aboard, csaSetPlayerPosition, csaSetFacing:(yaw,pitch)=>{r.cam.yaw=yaw*Math.PI/180;r.cam.pitch=pitch*Math.PI/180;},
    dwPlayerObjectPosition, csaRaycast:()=>null, raycastColliders, csaColliderMesh:r.geometry,
    alignControllerToGround, player, CAPSULE_HEIGHT, CSA_ABOARD_GRACE, csaSyncColliders:r.w.sync, cam:r.cam };
  const go = new Function(...Object.keys(scope), `${cutLine(WORLD, '  const csaFinishBoarding =')}${cut(WORLD,'  function csaBoardPeer(pick) {')}\nreturn csaBoardPeer;`)(...Object.values(scope));
  go({boat:r.hers,hit:{node:ladder}});
}

// Source lift covers both baseline and fixed order; no copy of the proposed fix in the test.
const preStart = Math.min(WORLD.indexOf('        const _wasSwimming ='), WORLD.indexOf('        // DW-D: OutdoorSwimDriver.Update'));
const effectWrite = 'applyMotorEffectFlags(player, playerEntity, _dwForge ?? undefined);';
const preEnd = WORLD.indexOf(effectWrite, preStart) + effectWrite.length;
assert.ok(preStart >= 0 && preEnd > preStart, 'world pre-motor swim phase found');
// eslint-disable-next-line no-new-func
const preMotor = new Function('player', 'dwPlayer', 'playerSpawned', 'now', 'cam', 'crouchHeld', 'jumpHeld', 'keys', 'held',
  'playerEntity', 'isBoatEffectBundle', 'loadGraceActive', '_dwLastForward', 'dt', 'worldTimeScale', 'applyMotorEffectFlags',
  WORLD.slice(preStart, preEnd) + '\nreturn { wasSwimming: _wasSwimming };');

function waterRig(r, dt = FIXED_DT) {
  const col=r.colliders.exterior, m=r.player;
  const settings={fogStrength:.5,fogDistance:.5,swimSpeedMultiplier:1,enableSwimStroke:false,argonianInfiniteBreath:true};
  const column=()=>({oceanY:SEA,seafloorY:FLOOR,renderedSeafloorY:FLOOR,depth:SEA-FLOOR});
  const dw=createDeepWatersPlayer({host:{waterColumn:column,rawWaterColumn:column,wallBuckets:new Set()},locate:(x,z)=>({entry:{},lx:x,lz:z,baseY:0}),seaY:()=>SEA,terrainGroundAt:()=>-Infinity,collider:col,settings:()=>settings});
  const swimMove=createSwimMovement({settings:()=>settings,collider:col});
  const entity={fatigue:6400,stats:{strength:50,endurance:50},activeEffects:[]};
  let time=0, lastForward=0;
  return (up=false, input={}) => {
    time+=dt;
    const forward=input.forward ?? 0, strafe=input.strafe ?? 0, yaw=input.yaw ?? r.cam.yaw;
    const f={now:time,player:m,cameraY:m.eye[1],yaw:r.cam.yaw,pitch:0,descend:false,ascend:up,onBoat:false,loadGrace:false,input:{forward:lastForward},frameDelta:dt};
    // Execute the real world pre-motor block, including WHEN its host swim latch is captured.
    const names = { player:m, dwPlayer:dw, playerSpawned:true, now:time*1000,
      cam:{pos:m.eye,yaw:r.cam.yaw,pitch:0}, crouchHeld:false, jumpHeld:up, keys:new Set(), held:()=>false,
      playerEntity:entity, isBoatEffectBundle, loadGraceActive:()=>false, _dwLastForward:lastForward,
      dt, worldTimeScale:()=>1, applyMotorEffectFlags };
    const { wasSwimming } = preMotor(...Object.values(names));
    m.update(dt,{forward,strafe,jump:!!input.jump,up,down:false,crouch:false},yaw);
    lastForward=forward;
    m.onExteriorWater=false;
    m.isPlayerSwimming=exteriorSwimming({wasSwimming,sunk:!!m.sunk,unsunk:m.heightAction==='unsink',tileIndex:0});
    const outdoor=!m.waterWalking&&((dw.waterMethod==='Swimming')||!!m.isPlayerSwimming||dw.swim.presentationUnderwater(SEA,m.eye[1],m.pos[1]+m.height/2));
    swimMove.update({now:time,dt,player:m,entity,loadGrace:false,outdoorSwimming:outdoor,anySwimming:outdoor||!!m.swimming,
      input:{forward,strafe,up,down:false,run:false},yaw,pitch:0,lookDir:[Math.sin(r.cam.yaw),0,Math.cos(r.cam.yaw)],cameraY:m.eye[1],oceanY:SEA,seafloorY:()=>FLOOR,vanillaGroundY:()=>null});
    dw.afterMove({...f,cameraY:m.eye[1]});flushStateChange();
    r.w.sync();r.w.peersFrame(dt);r.w.rearm();
  };
}


// Expected behavior: a passenger remains attached after the peer's water-board action.
// These water cases fail on base 68f21a4 and pass with the update-order fix.
for (let hull = 0; hull < HULL_NAMES.length; hull++) {
  for (const water of [false, true]) {
    test(`Peer water boarding: ${HULL_NAMES[hull]} / ${water ? 'swimming start' : 'dry control'}`, async (t) => {
      const r = await rig({ hull, mine: false });
      assert.equal(r.own, null, 'passenger owns no boat in this simulation');
      assert.equal(r.peers.placeOf(r.hers).owner, 'ann', 'the boat belongs to another player');
      r.w.sync();
      const step = water ? waterRig(r) : () => r.frame();
      r.player.spawn(-40, -1, 0);
      if (water) for (let i = 0; i < 150; i++) step(true);
      assert.equal(!!r.player.isPlayerSwimming, water, 'real swim driver establishes the starting state');
      boardViaWorld(r, r.hers.BoardTriggers[0]);
      assert.equal(r.aboard.aboard?.owner, 'ann', 'water-board function initially attaches the passenger');
      let firstOff = -1;
      let offState = null;
      for (let i = 0; i < 180; i++) {
        const seconds = i * FIXED_DT;
        if (i % 12 === 0) r.peers.applyOwner('ann', annWord(hull, [0, SEA, 4 * seconds], quatAngleAxis(6 * seconds, [0, 1, 0]), [0, 4, 6]), p => p, seconds * 1000);
        step();
        if (firstOff < 0 && !r.aboard.aboard) {
          firstOff = i;
          offState = { swimming: r.player.isPlayerSwimming, grounded: r.player.grounded, groundKey: r.player.groundKey };
        }
      }
      t.diagnostic(JSON.stringify({ hull: HULL_NAMES[hull], water, firstOff, offState }));
      assert.equal(firstOff, -1, 'idle passenger must stay attached after boarding from water onto another player boat');
    });
  }
}

for (let hull = 0; hull < HULL_NAMES.length; hull++) {
  test(`Peer water boarding: ${HULL_NAMES[hull]} / moving boat at 30 Hz, then owner removes it`, async () => {
    const r = await rig({ hull, mine: false });
    const dt = 1 / 30;
    r.w.sync();
    const step = waterRig(r, dt);
    r.player.spawn(-40, -1, 0);
    // Boat is already moving and turning BEFORE the passenger activates its ladder.
    let frame = 0;
    const sail = () => {
      const t = frame * dt;
      if (frame % 6 === 0) r.peers.applyOwner('ann', annWord(hull, [0, SEA, 8*t], quatAngleAxis(-12*t, [0,1,0]), [0,8,-12]), p => p, t*1000);
      frame++;
    };
    for (let i=0;i<90;i++) { sail(); step(true); }
    assert.equal(r.player.isPlayerSwimming, true, 'passenger starts swimming');
    boardViaWorld(r, r.hers.BoardTriggers[0]);
    for (let i=0;i<180;i++) {
      sail(); step();
      assert.equal(r.aboard.aboard?.owner, 'ann', `still on another player boat at frame ${i}`);
    }
    assert.equal(r.player.isPlayerSwimming, false, 'dry on deck');
    r.peers.applyOwner('ann', null, p => p, frame*dt*1000);
    for (let i=0;i<180;i++) step();
    assert.equal(r.aboard.aboard, null, 'removed boat releases the passenger');
    assert.equal(r.player.isPlayerSwimming, true, 'falling into the sea restores swimming');
  });
}

test('Peer water boarding: leaving the deck restores swimming and clears the passenger word', async () => {
  const r = await rig({ hull: HULL_NAMES.indexOf('Rowboat'), mine: false });
  r.w.sync();
  const step = waterRig(r);
  r.player.spawn(-40, -1, 0);
  for (let i=0;i<150;i++) step(true);
  boardViaWorld(r, r.hers.BoardTriggers[0]);
  for (let i=0;i<60;i++) step();
  assert.equal(r.aboard.aboard?.owner, 'ann');
  assert.equal(r.player.isPlayerSwimming, false);
  // Real motor input takes the passenger over the gunwale and back into the water.
  for (let i=0;i<240;i++) step(false, { strafe:1, jump:i===0, yaw:0 });
  assert.equal(r.aboard.aboard, null, 'no attachment after leaving the deck');
  assert.equal(r.aboard.word(r.player.pos), null, 'other players see the passenger leave');
  assert.equal(r.player.isPlayerSwimming, true, 'swimming resumes in the sea');
  const from=[...r.player.pos];
  for (let i=0;i<60;i++) step(false, { strafe:1, yaw:0 });
  assert.ok(Math.hypot(r.player.pos[0]-from[0], r.player.pos[2]-from[2]) > 0.25, 'swimming controls still move the player');
});
