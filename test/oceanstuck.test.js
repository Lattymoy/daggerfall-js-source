// OCEAN-STUCK (2026-09-26, Mac, from the Discord: "someone is stuck in the ocean" - "You can get stuck in the ocean"):
// the carved sea keeps an over-encumbered swimmer under. LevitateMotor's first arm (:81-84, AUDIT 26 F027) drags a
// swimmer past 62.5 kg DOWN and takes the float keys away, and Iliac Puddle No More's one way out - the shore exit -
// asks for a SURFACE swimmer (the check point within 0.75 m of the sea). So the weight sank the player to the carved
// floor, where the coast is the carve's wall (metres of it), and nothing lifted them: an Argonian, who breathes
// forever there, stayed for good. The exit now takes a swimmer the weight holds under, too, from wherever the weight
// has put them. The harness is test/dwd_swim.test.js's: a REAL PlayerMotor over a REAL Collider in world.js's order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, afloatMessageStep, CANNOT_FLOAT_TEXT } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { applyMotorEffectFlags } from '../src/scenes/shared.js';
import { exteriorSwimming } from '../src/player/exteriorSurface.js';
import { createDeepWatersPlayer } from '../src/scenes/deepWatersPlayer.js';
import { createSwimMovement } from '../src/scenes/deepWatersSwimMove.js';
import { flushStateChange } from '../src/systems/deepWaterPlayer.js';

const OCEAN = 34, FLOOR = 10, SHORE = 34.6, COAST = 100, DT = 1 / 60;
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const WALL = 'dw-wall';

function seaWorld({ floor = FLOOR } = {}) {
  const col = new Collider((x) => (x < COAST ? floor : SHORE));
  col.addMesh(WALL, [COAST, floor, -200, COAST, floor, 400, COAST, SHORE, 400, COAST, SHORE, -200], [0, 1, 2, 0, 2, 3], I4);
  const column = (lx) => (lx < COAST ? { oceanY: OCEAN, seafloorY: floor, renderedSeafloorY: floor, depth: OCEAN - floor } : null);
  const host = { waterColumn: (e, lx) => column(lx), rawWaterColumn: (e, lx) => column(lx), wallBuckets: new Set([WALL]) };
  const s = { fogStrength: 0.5, fogDistance: 0.5, swimSpeedMultiplier: 1, enableSwimStroke: false, argonianInfiniteBreath: true };
  const w = { col, s, lastForward: 0, t: 0, hud: [], entity: { fatigue: 6400, stats: { strength: 50, endurance: 50 }, activeEffects: [] } };
  w.dw = createDeepWatersPlayer({
    host, locate: (x, z) => ({ entry: {}, lx: x, lz: z, baseY: 0 }), seaY: () => OCEAN,
    terrainGroundAt: (x) => (x < COAST ? -Infinity : SHORE), collider: col, settings: () => s, dismount: () => {},
  });
  w.move = createSwimMovement({ settings: () => s, collider: col });
  w.m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 });
  return w;
}

/** One world.js frame (its DW-D order) - test/dwd_swim.test.js's. */
function frame(w, { forward = 0, ascend = false, descend = false, yaw = 0, pitch = 0 } = {}) {
  const m = w.m;
  w.t += DT;
  const wasSwimming = !!m.isPlayerSwimming;
  const forge = w.dw.beforeMove({ now: w.t, player: m, cameraY: m.eye[1], yaw, pitch, descend, ascend, onBoat: false, loadGrace: false, input: { forward: w.lastForward }, frameDelta: DT });
  applyMotorEffectFlags(m, w.entity, forge ?? undefined);
  if (forge) { const line = afloatMessageStep(m, m.waterWalking); if (line) w.hud.push(line); }
  m.update(DT, { forward, strafe: 0, run: false, jump: false, up: ascend, down: descend, crouch: false }, yaw, pitch);
  w.lastForward = forward;
  const sea = m.pos[0] < COAST;
  m.onExteriorWater = false;
  m.isPlayerSwimming = exteriorSwimming({ wasSwimming, sunk: !!m.sunk, unsunk: m.heightAction === 'unsink', tileIndex: sea ? 0 : 5 });
  w.dw.afterMove({ now: w.t, player: m, cameraY: m.eye[1], descend, ascend, onBoat: false });
  const outdoor = !m.waterWalking && (!!m.onExteriorWater || !!m.isPlayerSwimming || w.dw.swim.presentationUnderwater(OCEAN, m.eye[1], m.pos[1] + m.height / 2));
  flushStateChange();
  const look = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  w.move.update({
    now: w.t, dt: DT, player: m, entity: w.entity, loadGrace: false, outdoorSwimming: outdoor, anySwimming: outdoor || (!m.waterWalking && !!m.swimming),
    input: { forward, strafe: 0, up: ascend, down: descend, run: false }, yaw, pitch, lookDir: look, cameraY: m.eye[1], oceanY: OCEAN,
    seafloorY: (x) => (x < COAST ? FLOOR : null), vanillaGroundY: () => null,
  });
}

/** Swim at the coast from x, pushing east, until out or out of time; answers whether the swimmer left the water. */
function pushAtCoast(w, frames = 1500) {
  const yaw = Math.PI / 2;
  for (let i = 0; i < frames; i++) {
    frame(w, { forward: 1, yaw });
    if (!w.dw.forged && w.m.pos[0] > COAST) return i;
  }
  return -1;
}

test('OCEAN-STUCK: the weight holds the swimmer under - it sinks to the carved floor, the float keys do nothing, and the line says why (DFU\'s own laws, unchanged)', () => {
  const w = seaWorld();
  w.m.carriedWeight = () => 80;   // * 4 > 250
  w.m.spawn(90, OCEAN - 1, 0);
  for (let i = 0; i < 900; i++) frame(w, { ascend: true });
  assert.ok(w.m.pos[1] < FLOOR + 0.5, `dragged to the floor, up held all the way (${w.m.pos[1].toFixed(2)})`);
  assert.deepEqual(w.hud, [CANNOT_FLOAT_TEXT], 'You are carrying too much to stay afloat.');
});

test('OCEAN-STUCK: an over-encumbered swimmer pushing at the coast is lifted onto the shore from the floor - where the carve\'s wall held it for good', () => {
  const w = seaWorld();
  w.m.carriedWeight = () => 80;
  w.m.spawn(97, OCEAN - 1, 0);
  const out = pushAtCoast(w);
  assert.ok(out >= 0, `out of the water (the swimmer stood at x ${w.m.pos[0].toFixed(2)}, y ${w.m.pos[1].toFixed(2)})`);
  assert.ok(w.m.pos[0] > COAST && w.m.pos[1] > SHORE - 0.5, 'up on the shore');
  for (let i = 0; i < 60; i++) frame(w, { forward: 1, yaw: Math.PI / 2 });
  assert.equal(w.m.grounded, true, 'standing on it');
  assert.equal(w.m.swimming, false);
});

test('OCEAN-STUCK: the weight is the only new door - a light swimmer on the floor still swims up to leave, as the mod asks', () => {
  const w = seaWorld();
  w.m.carriedWeight = () => 10;
  w.m.spawn(97, FLOOR + 0.2, 0);
  // diving holds it down; pushing at the wall from the floor is no exit for a swimmer who can rise
  let left = false;
  for (let i = 0; i < 240; i++) {
    frame(w, { forward: 1, descend: true, yaw: Math.PI / 2 });
    if (!w.dw.forged && w.m.pos[0] > COAST) left = true;
  }
  assert.equal(left, false, 'no lift while diving');
  // ...and at the surface the mod's own exit takes it, as ever
  const out = pushAtCoast(w, 1500);
  assert.equal(out, -1, 'not from the floor, pushing forward alone');
});
