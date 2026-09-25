// DW-D (2026-09-25) - ILIAC PUDDLE NO MORE 1.2.2'S SWIMMER (jet082), PINNED.
//
// The swim driver (OutdoorSwimDriver + OutdoorSwimDriverAfter), the swim
// movement (OutdoorSwimMovementController), the load grace
// (DeepWaterRuntime), the public player API (DeepWaterPlayer) and the
// pieces of DFU the forge reaches, driven the way the world host drives
// them: a REAL PlayerMotor over a REAL Collider, in world.js's frame
// order - the driver's Update ahead of the motor, the host's ONE motor
// flag write (applyMotorEffectFlags) carrying the forge, the motor, the
// tile model's flags, then OutdoorSwimDriverAfter's PostPhaseRestore, the
// state flush and the movement controller. The sea is the carved one:
// the heightfield's floor is the seafloor over the carved cells, the
// shore stands beside it, and the floor's wall stands in the step (the
// probes skip it - IsShoreGround).
//
// The expectations are the C#'s own arithmetic, spelled out here from
// the decompiled source (clean/puddle/*.cs) and DFU's
// (PlayerSpeedChanger, LevitateMotor, PlayerEnterExit), never the port's
// helpers read back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerMotor, afloatMessageStep, CANNOT_FLOAT_TEXT, CANNOT_FLOAT_HUD_SECONDS } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { applyMotorEffectFlags } from '../src/scenes/shared.js';
import { exteriorSwimming } from '../src/player/exteriorSurface.js';
import { createDeepWatersPlayer, UNCROUCH_AFTER_EXIT_SECONDS } from '../src/scenes/deepWatersPlayer.js';
import { createSwimMovement, clampAboveSeafloor } from '../src/scenes/deepWatersSwimMove.js';
import {
  swimCheckY, headUnderwater, headClearOfSurface, worldYToBlockWaterLevel, blockWaterLevelToWorldY, NO_WATER_LEVEL,
  forgedSwimWaterLineY, surfaceAscentCeiling, presentationWaterLineForFog, DeepWaterSwimState, strokeTempoScale,
  strokeFatigueCost, strokeDirection, strokeVelocity, isBoatEffectBundle, SwimSoundOdometer, STROKE, SHORE_EXIT,
} from '../src/world/deepWaterSwim.js';
import {
  deepWaterPlayer, publishState, clearState, flushStateChange, evaluateSwimmingSuppression, setColumnSource,
} from '../src/systems/deepWaterPlayer.js';
import {
  loadGraceActive, loadStarted, loadFinished, teleported, locationLoadBegan, locationLoadEnded, resetDeepWaterRuntime,
  LOAD_GRACE_SECONDS, LOCATION_LOAD_STUCK_SECONDS,
} from '../src/world/deepWaterRuntime.js';
import { breathStep, setWaterBreathingRule, isWaterBreathing } from '../src/systems/breath.js';
import { maxFatigue } from '../src/systems/statMods.js';
import { AudioEngine } from '../src/systems/audio.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

// ---- the C#'s arithmetic ------------------------------------------------
/** OutdoorSwimDriver.PlayerSwimCheckY: `playerY + 1.25f - 0.95f`. */
const csCheck = (centreY) => centreY + 1.25 - 0.95;
/** IsPlayerHeadUnderwater: `position.y + 1.9f - 0.95f < oceanSurfaceY - 0.25f`. */
const csHeadUnder = (centreY, oceanY) => centreY + 1.9 - 0.95 < oceanY - 0.25;
/** ForgedSwimWaterLineY. */
const csForgedLine = (oceanY, swimming, centreY) => { let n = oceanY + 0.75; if (!swimming) return n; const c = csCheck(centreY); if (c >= n) n = c + 0.05; return n; };
/** WorldYToBlockWaterLevel with System.Math.Round's banker's tie. */
const csLevel = (y) => { const q = -y / 0.025; const f = Math.floor(q); const r = q - f; const n = r > 0.5 ? f + 1 : r < 0.5 ? f : (f % 2 === 0 ? f : f + 1); return Math.min(32767, Math.max(-32768, n)); };
/** PlayerSpeedChanger.GetWalkSpeed / GetSwimSpeed (:389-393, :418-422). */
const csWalk = (speed) => (speed + 150 - 0.5 * (100 - Math.max(speed, 30))) / 39.5;
const csSwim = (base, swimming) => base * (swimming / 200) + base / 4;

// ---- the carved sea ------------------------------------------------------
const OCEAN = 34, FLOOR = 10, SHORE = 34.6, COAST = 100, DT = 1 / 60;
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const WALL = 'dw-wall';

/**
 * The sea west of x = 100 (floor 10, the sea at 34), the shore east of it
 * at 34.6, and the floor's wall in the step between - a bucket the
 * probes skip, as the host's wallBuckets are.
 */
function seaWorld(settings = {}, shore = SHORE, ocean = OCEAN) {
  const col = new Collider((x) => (x < COAST ? FLOOR : shore));
  col.addMesh(WALL, [COAST, FLOOR, -200, COAST, FLOOR, 400, COAST, shore, 400, COAST, shore, -200], [0, 1, 2, 0, 2, 3], I4);
  const column = (lx) => (lx < COAST ? { oceanY: ocean, seafloorY: FLOOR, renderedSeafloorY: FLOOR, depth: ocean - FLOOR } : null);
  const host = { waterColumn: (e, lx) => column(lx), rawWaterColumn: (e, lx) => column(lx), wallBuckets: new Set([WALL]) };
  const s = { fogStrength: 0.5, fogDistance: 0.5, swimSpeedMultiplier: 1, enableSwimStroke: false, argonianInfiniteBreath: true, ...settings };
  const w = { col, s, dismounts: 0, lastForward: 0, t: 0, edges: 0, hud: [], entity: { fatigue: 6400, stats: { strength: 50, endurance: 50 }, activeEffects: [] } };
  w.dw = createDeepWatersPlayer({
    host, locate: (x, z) => ({ entry: {}, lx: x, lz: z, baseY: 0 }), seaY: () => ocean,
    terrainGroundAt: (x) => (x < COAST ? -Infinity : shore), collider: col, settings: () => s, dismount: () => { w.dismounts++; w.m.transportMode = 'Foot'; },
  });
  w.move = createSwimMovement({ settings: () => s, collider: col });
  w.m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 });
  return w;
}

/** One world.js frame (its DW-D order), with the motor's LevitateMotor.IsSwimming changes counted. */
function frame(w, { forward = 0, strafe = 0, ascend = false, descend = false, run = false, yaw = 0, pitch = 0, onBoat = false, loadGrace = false } = {}) {
  const m = w.m;
  w.t += DT;
  const swimBefore = m.swimming;
  const wasSwimming = !!m.isPlayerSwimming;   // read BEFORE the per-frame clear (OT1)
  const forge = w.dw.beforeMove({ now: w.t, player: m, cameraY: m.eye[1], yaw, pitch, descend, ascend, onBoat, loadGrace, input: { forward: w.lastForward } });
  applyMotorEffectFlags(m, w.entity, forge ?? undefined);
  if (forge) { const line = afloatMessageStep(m, m.waterWalking); if (line) w.hud.push(line); }   // the forged frame's dungeon arm
  const swimAtStep = m.swimming;
  m.update(DT, { forward, strafe, run, jump: false, up: ascend, down: descend, crouch: false }, yaw, pitch);
  w.lastForward = forward;
  const sea = m.pos[0] < COAST;
  // PlayerMotor.Update's own GetOnExteriorWaterMethod: the carved sea's floor is no DaggerfallTerrain (and the
  // mod gates the terrain collider off over it), the shore is no tile 0 - None both ways, whatever the forge says
  m.onExteriorWater = false;
  m.isPlayerSwimming = exteriorSwimming({ wasSwimming, sunk: !!m.sunk, unsunk: m.heightAction === 'unsink', tileIndex: sea ? 0 : 5 });
  const after = w.dw.afterMove({ now: w.t, player: m, cameraY: m.eye[1], descend, ascend, onBoat });
  const outdoor = !m.waterWalking && (!!m.onExteriorWater || !!m.isPlayerSwimming || w.dw.swim.presentationUnderwater(OCEAN, m.eye[1], m.pos[1] + m.height / 2));
  flushStateChange();
  const look = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  w.move.update({
    now: w.t, dt: DT, player: m, entity: w.entity, loadGrace, outdoorSwimming: outdoor, anySwimming: outdoor || (!m.waterWalking && !!m.swimming),
    input: { forward, strafe, up: ascend, down: descend, run }, yaw, pitch, lookDir: look, cameraY: m.eye[1], oceanY: OCEAN,
    seafloorY: (x) => (x < COAST ? FLOOR : null), vanillaGroundY: () => null,
  });
  w.edges += (swimBefore !== swimAtStep ? 1 : 0) + (swimAtStep !== m.swimming ? 1 : 0);
  return { forge, after };
}
const centre = (m) => m.pos[1] + m.height / 2;
/** A swimmer settled at the surface over the sea at x: up held from a metre down until the ascent clamp holds it. */
function atSurface(w, x = 50) {
  w.m.spawn(x, OCEAN - 1, 0);
  for (let i = 0; i < 150; i++) frame(w, { ascend: true });
  return w;
}

// ---- 1. the pure helpers ------------------------------------------------

test('DW-D: the driver\'s geometry is the C#\'s - the check point, the head, the forged line, the ascent ceiling, the fog\'s line (mutants: each offset)', () => {
  for (const c of [-3, 0, 12.34, 33.1, 33.7, 34.2, 34.8]) {
    near(swimCheckY(c), csCheck(c), 1e-12, `PlayerSwimCheckY(${c})`);
    for (const o of [33.5, 34, 34.5]) {
      assert.equal(headUnderwater(c, o), csHeadUnder(c, o), `IsPlayerHeadUnderwater(${c}, ${o})`);
      assert.equal(headClearOfSurface(c, o), c + 1.9 - 0.95 > o, `IsPlayerHeadClearOfSurface(${c}, ${o})`);
      for (const sw of [false, true]) near(forgedSwimWaterLineY(o, sw, c), csForgedLine(o, sw, c), 1e-12, `ForgedSwimWaterLineY(${o}, ${sw}, ${c})`);
    }
  }
  near(surfaceAscentCeiling(OCEAN), OCEAN + 0.55 - 1.25 + 0.93, 1e-12, 'ClampSurfaceAscent: oceanY + 0.55 - 1.25 + 0.93');
  near(presentationWaterLineForFog(OCEAN, 30), OCEAN, 1e-12, 'PresentationWaterLevelForFog: the sea under a low camera');
  near(presentationWaterLineForFog(OCEAN, 36), 36 + 1.25 - 0.95 - 0.65, 1e-12, '...the camera\'s check point less 0.65 over it');
});

test('DW-D: WorldYToBlockWaterLevel is (short)Mathf.Clamp(Mathf.Round(-y / 0.025)) - the tie to EVEN, never JS\'s toward +Infinity (mutant: Math.round)', () => {
  // heights whose quotient lands on an exact half in doubles
  for (const [y, q] of [[-0.0125, 0.5], [-0.0625, 2.5], [-0.1125, 4.5], [0.1375, -5.5]]) assert.equal(-y / 0.025, q, `${y} / 0.025 is exactly ${q}`);
  assert.equal(worldYToBlockWaterLevel(-0.0125), 0, '0.5 rounds to the even 0, not 1');
  assert.equal(worldYToBlockWaterLevel(-0.0625), 2, '2.5 to 2, not 3');
  assert.equal(worldYToBlockWaterLevel(-0.1125), 4, '4.5 to 4, not 5');
  assert.equal(worldYToBlockWaterLevel(0.1375), -6, '-5.5 to -6, not -5');
  for (const y of [-40, -34.75, 0, 12.3456, 34.75, 34.7625, 819.2]) assert.equal(worldYToBlockWaterLevel(y), csLevel(y), `level(${y})`);
  assert.equal(worldYToBlockWaterLevel(-1000), 32767, 'clamped to a short');
  assert.equal(worldYToBlockWaterLevel(1000), -32768);
  assert.equal(blockWaterLevelToWorldY(csLevel(34.75)), -csLevel(34.75) * 0.025, 'blockWaterLevel * -1 * GlobalScale');
  assert.equal(NO_WATER_LEVEL, 10000, 'NoWaterSentinel');
});

test('DW-D: the presentation\'s hysteresis, the contact grace and the swim hysteresis are the driver\'s (mutants: each clearance)', () => {
  const s = new DeepWaterSwimState();
  // IsPresentationUnderwater: the first read takes the flag outright; under until the camera stands 0.08 clear
  // (the head - the centre + 0.95 - clear of the sea throughout, so the camera decides)
  assert.equal(s.presentationUnderwater(OCEAN, OCEAN + 0.03, OCEAN), true, 'a camera 0.03 over the sea is under (enter clearance 0.04)');
  assert.equal(s.presentationUnderwater(OCEAN, OCEAN + 0.06, OCEAN), true, 'and stays under at 0.06 (exit clearance 0.08)');
  assert.equal(s.presentationUnderwater(OCEAN, OCEAN + 0.09, OCEAN), false, 'out past 0.08');
  assert.equal(s.presentationUnderwater(OCEAN, OCEAN + 0.05, OCEAN), false, 'and not back in at 0.05');
  assert.equal(s.presentationUnderwater(OCEAN, OCEAN + 5, OCEAN - 2), true, 'a head under the sea is under whatever the camera says');
  s.resetHead(false);
  assert.equal(s.presentationUnderwater(OCEAN, OCEAN + 0.03, OCEAN), true, 'ResetHeadWaterState: the next read takes the flag outright');
  // HasRecentCenterWaterContact
  const f = (o) => ({ now: 10, oceanY: OCEAN, centreY: OCEAN - 1, descend: false, onShore: false, grounded: false, usableColumnHere: true, ...o });
  const c = new DeepWaterSwimState();
  assert.equal(c.recentContact(f()), true, 'the check point under the sea over a usable column');
  near(c.waterContactUntil, 10 + 1.25, 1e-12, 'held 1.25 s');
  assert.equal(c.recentContact(f({ now: 11, centreY: OCEAN + 5 })), true, 'out of the water, inside the grace');
  assert.equal(c.recentContact(f({ now: 11.3, centreY: OCEAN + 5 })), false, 'past it');
  const fresh = new DeepWaterSwimState();
  assert.equal(fresh.recentContact(f({ centreY: OCEAN + 0.75 - 0.3 + 0.01 })), false, 'the check point more than 0.75 over the sea is no contact...');
  assert.equal(fresh.recentContact(f({ centreY: OCEAN + 0.75 - 0.3 + 0.01, descend: true })), true, '...but diving allows 1.5');
  assert.equal(c.recentContact(f({ onShore: true })), false, 'shore ground ends it');
  assert.equal(c.waterContactUntil, 0, 'and clears the grace');
  c.recentContact(f());
  assert.equal(c.recentContact(f({ now: 10.5, centreY: OCEAN + 5, grounded: true })), false, 'grounded out of the water: no grace');
  assert.equal(c.recentContact(f({ usableColumnHere: false, now: 20 })), false, 'no usable column, no contact');
  // IsPlayerAtSwimmingDepth: enter at 0.1 under the check point, hold to 0.75 once forged
  const d = new DeepWaterSwimState();
  const at = (centreY, o = {}) => d.step({ now: 1, oceanY: OCEAN, centreY, cameraY: OCEAN + 3, descend: false, ascend: false, onShore: false, grounded: false, usableColumnHere: true, ...o });
  const mid = OCEAN + 0.4 - 0.3;   // the check point 0.4 over the sea
  assert.equal(at(mid).swimming, false, 'unforged: 0.4 over is not at depth (enter clearance 0.1)');
  d.forged = true;
  assert.equal(at(mid).swimming, true, 'forged: 0.4 over still swims (exit clearance 0.75)');
  assert.equal(at(mid, { onShore: true }).swimming, false, 'shore ground ends it');
  d.forged = false;
  assert.equal(at(mid, { ascend: true }).swimming, true, 'rising holds the swim (ShouldHoldSurfaceSwim)');
  assert.equal(at(mid, { descend: true }).swimming, true, 'and so does diving');
});

test('DW-D: the stroke\'s law - tempo, fatigue, direction through the CAMERA\'s transform, the float lean, the surface rule, the eased velocity (mutants: each constant)', () => {
  near(strokeTempoScale(1), 1, 1e-12, 'CurrentStrokeTempoScale(1)');
  near(strokeTempoScale(0.1), Math.pow(0.25, 0.35), 1e-12, 'the multiplier clamped to 0.25 first');
  near(strokeTempoScale(30), Math.pow(30, 0.35), 1e-12, 'Pow(m, 0.35)');
  near(strokeTempoScale(100), Math.pow(30, 0.35), 1e-12, 'clamped to 30');
  assert.ok(strokeTempoScale(0.25) >= 0.5, 'Max(0.5, ...)');
  assert.equal(strokeFatigueCost(6400), 160, 'Mathf.CeilToInt(6400 * 0.025)');
  assert.equal(strokeFatigueCost(640), 24, 'Mathf.Max(24, ...)');
  assert.equal(strokeFatigueCost(6401), 161, 'the ceiling');
  // TransformDirection(h * k, 0, v * k), y zeroed: a pitched view shortens the forward part by its cosine
  const base = { strafe: 0, forward: 0, yaw: 0, pitch: 0, lookDir: [0, 0, 1], up: false, down: false, cameraY: 20, oceanY: OCEAN };
  const d1 = strokeDirection({ ...base, forward: 1, strafe: 1, pitch: Math.PI / 3 });
  const k = 0.7071, raw = [k, 0, Math.cos(Math.PI / 3) * k], len = Math.hypot(...raw);
  for (let i = 0; i < 3; i++) near(d1[i], raw[i] / len, 1e-9, `diagonal under a 60 degree pitch [${i}]`);
  const d2 = strokeDirection({ ...base, lookDir: [0, -0.6, 0.8] });
  assert.deepEqual(d2.map((v) => +v.toFixed(9)), [0, -0.6, 0.8], 'no key: the look itself');
  const d3 = strokeDirection({ ...base, forward: 1, up: true });
  near(d3[1], 0.65 / Math.hypot(1, 0.65), 1e-9, 'a float-up key leans it 0.65');
  const d4 = strokeDirection({ ...base, forward: 1, up: true, cameraY: OCEAN + 0.36 });
  assert.deepEqual(d4, [0, 0, 1], 'never up with the camera 0.35 over the sea');
  const d5 = strokeDirection({ ...base, forward: 1, up: true, cameraY: OCEAN + 0.36, oceanY: null });
  assert.ok(d5[1] > 0, 'indoors there is no such rule');
  assert.equal(strokeDirection({ ...base, lookDir: [0, 1, 0], cameraY: OCEAN + 1 }), null, 'straight up out of the water: nothing left (sqrMagnitude < 0.001)');
  // ApplyStrokeMotion: speed x 2.65 x tempo x SmoothStep(0, 1, remaining / duration)
  const sm = (t) => { t = Math.min(1, Math.max(0, t)); t = -2 * t * t * t + 3 * t * t; return t; };
  const v = strokeVelocity({ direction: [0, 0, 1], swimSpeed: 2, tempo: 1.5, remaining: 0.12, duration: 0.32 });
  near(v[2], 2 * 2.65 * 1.5 * sm(0.12 / 0.32), 1e-12, 'the eased burst');
  assert.equal(isBoatEffectBundle('ImOnABoat'), true);
  assert.equal(isBoatEffectBundle("I'm On A Boat"), true);
  assert.equal(isBoatEffectBundle('Levitate'), false);
});

test('DW-D: UpdateSwimSfx\'s odometer - the first frame marks, a splash every 2.5 m, a recentre is not travel (mutants: the distance, the rebase)', () => {
  const o = new SwimSoundOdometer();
  assert.equal(o.step([0, 0, 0]), false, 'the first frame only marks the place');
  assert.equal(o.step([0, 0, 1.2]), false);
  assert.equal(o.step([0, 0, 2.4]), false, '2.4 m: not yet');
  assert.equal(o.step([0, 0, 2.5]), true, '2.5 m: a splash (!(distance < 2.5))');
  assert.equal(o.distance, 0, 'and a fresh count');
  o.rebase([-1000, 0, 0]);
  assert.equal(o.step([-1000, 0, 2.6]), false, 'the floating origin moved the mark with the world');
  near(o.distance, 0.1, 1e-9, 'only the 0.1 m swum');
  o.reset();
  assert.equal(o.step([5, 5, 5]), false, 'ResetSwimTracking: the next frame marks again');
});

// ---- 2. the swimmer, through a real motor --------------------------------

test('DW-D: a swimmer in the carved sea is forged at once and travels at GetSwimSpeed - one LevitateMotor.IsSwimming edge on entry and none after, nothing cancelled (the XL-1 law under the forge)', () => {
  const w = seaWorld();
  w.m.spawn(50, OCEAN - 3, 0);
  const { forge } = frame(w);
  assert.ok(forge && forge.swimming === true, 'the driver\'s Update forges: swimming');
  // the line DFU is handed, through the short: ForgedSwimWaterLineY's 0.75 over the sea, quantised
  assert.equal(forge.waterSurfaceY, -csLevel(csForgedLine(OCEAN, true, OCEAN - 3 + 0.9)) * 0.025, 'the motor\'s surface is the level\'s own height');
  assert.equal(w.m.swimming, true, 'LevitateMotor.IsSwimming');
  assert.equal(w.m.isPlayerSwimming, true, 'PlayerEnterExit.IsPlayerSwimming');
  assert.equal(w.dw.waterMethod, 'Swimming', 'OnExteriorWaterMethod.Swimming, as the forge leaves it for the late readers');
  assert.equal(w.m.onExteriorWater, false, 'the motor\'s own is PlayerMotor.Update\'s ground method - None over the carved sea');
  assert.equal(w.dw.forged, true, 'currentlyForged');
  assert.equal(w.edges, 1, 'the entry is the one edge');
  // a sea off the level's 0.025 grid: the motor's surface is the short's height, not the line itself
  const off = seaWorld({}, SHORE, OCEAN + 0.013);
  off.m.spawn(50, OCEAN - 3, 0);
  const f2 = frame(off).forge;
  near(f2.waterSurfaceY, -csLevel(OCEAN + 0.013 + 0.75) * 0.025, 1e-12, 'blockWaterLevel * -GlobalScale');
  assert.ok(Math.abs(f2.waterSurfaceY - (OCEAN + 0.013 + 0.75)) > 0.005, 'which is not the raw line');
  for (let i = 0; i < 10; i++) frame(w);
  const z0 = w.m.pos[2];
  for (let i = 0; i < 60; i++) {
    frame(w, { forward: 1 });
    assert.equal(w.m.cancelMovement, false, `frame ${i}: no CancelMovement left pending`);
  }
  const want = csSwim(csWalk(50), 30);
  near(w.m.pos[2] - z0, want, 1e-3, 'a second of forward is GetSwimSpeed(GetBaseSpeed())');
  assert.equal(w.edges, 1, 'no edge while swimming steadily');
  // DecideHeightAction reads None, so no sink - the swim arm crouches the swimmer instead, a dungeon swimmer's pose
  assert.equal(w.m.sunk, false, 'never sunk (onWater is PlayerMotor.Update\'s None)');
  assert.equal(w.m.crouching, true, 'force-crouched (swimming && !forcedSwimCrouch && !grounded)');
  assert.equal(w.m.height, 0.9, 'the crouched capsule');
  // the published state and the forged water audio state
  assert.equal(deepWaterPlayer.isInWater, true);
  assert.equal(deepWaterPlayer.isSwimming, true);
  assert.equal(deepWaterPlayer.isHeadSubmerged, csHeadUnder(centre(w.m), OCEAN), 'IsHeadSubmerged is the head test');
  assert.equal(w.dw.submerged, csHeadUnder(centre(w.m), OCEAN), 'PlayerEnterExit.isPlayerSubmerged, as forged');
  assert.equal(w.dw.waterLevelY, -csLevel(csForgedLine(OCEAN, true, centre(w.m))) * 0.025, 'blockWaterLevel as forged');
});

test('DW-D: the swim multiplier is a WALK speed modifier - the swim, the grounded walk arm and the half-speed base take it; the crouch, the ride and the run do not (mutants: the scale dropped from each reader)', () => {
  const w = seaWorld({ swimSpeedMultiplier: 2 });
  w.m.spawn(50, OCEAN - 3, 0);
  for (let i = 0; i < 10; i++) frame(w);
  assert.equal(w.m.swimSpeedScale, 2, 'ApplySpeedMultiplier while swimming');
  const z0 = w.m.pos[2];
  for (let i = 0; i < 60; i++) frame(w, { forward: 1 });
  near(w.m.pos[2] - z0, csSwim(csWalk(50) * 2, 30), 2e-3, 'GetSwimSpeed(RefreshWalkSpeed()) at x2');
  // the motor's own readers of RefreshWalkSpeed, with the modifier held
  const m = new PlayerMotor(new Collider(() => 0), { speed: 50, running: 30, swimming: 30 });
  m.spawn(0, 0, 0);
  for (let i = 0; i < 10; i++) m.update(DT, { forward: 0, strafe: 0 }, 0);
  m.swimSpeedScale = 2;
  m.update(DT, { forward: 1, strafe: 0 }, 0);
  near(m.speed, csWalk(50) * 2, 1e-9, 'GetBaseSpeed\'s walk arm is RefreshWalkSpeed');
  m.isPlayerSwimming = true;
  m.update(DT, { forward: 1, strafe: 0 }, 0);
  near(m.speed, csSwim(csWalk(50) * 2, 30), 1e-9, 'UpdateSpeed\'s swim law over it');
  m.isPlayerSwimming = false;
  m.update(DT, { forward: 1, strafe: 0, run: true }, 0);
  near(m.speed, ((50 + 150) / 39.5) * (1.35 + 30 / 200), 1e-9, 'RefreshRunSpeed has its own list - the walk modifier is not in it');
  // IsMovingLessThanHalfSpeed: GetBaseSpeed() / 2 - RefreshWalkSpeed's, modifier and all - against the sneak's speed
  m.update(DT, { forward: 1, strafe: 0, sneak: true }, 0);
  near(m.speed, csWalk(50) * 2 / 2 - 1 / 39.5, 1e-9, 'the sneak halves the modded walk');
  assert.equal(m.movingLessThanHalfSpeed, true, 'and is under half of it (half of the plain walk would say no)');
  m.swimSpeedScale = 1;
  assert.equal(m._refreshWalkSpeed(), csWalk(50), 'no modifier, the plain walk');
  // the controller hands it back when the swim ends (RemoveSpeedModifier)
  w.move.update({ now: 99, dt: DT, player: w.m, anySwimming: false, loadGrace: false });
  assert.equal(w.m.swimSpeedScale, 1, 'off with the swim');
});

test('DW-D: surfacing - up rises at the swim speed, ClampSurfaceAscent holds the centre at the sea + 0.23, the head clears, the eye stands over the sea in the swim crouch; the swim holds on release (mutants: the ceiling, the crouch reset)', () => {
  const w = seaWorld();
  w.m.spawn(50, OCEAN - 3, 0);
  for (let i = 0; i < 10; i++) frame(w);
  const y0 = w.m.pos[1];
  for (let i = 0; i < 30; i++) frame(w, { ascend: true });
  near(w.m.pos[1] - y0, csSwim(csWalk(50), 30) * 30 * DT, 1e-3, 'rising at GetSwimSpeed');
  for (let i = 0; i < 200; i++) frame(w, { ascend: true });
  const ceiling = OCEAN + 0.55 - 1.25 + 0.93;
  near(centre(w.m), ceiling, 1e-5, 'the centre stopped at the ceiling (Float32 feet)');
  assert.equal(w.m.crouching, true, 'still in the swim crouch');
  assert.ok(w.m.eye[1] > OCEAN + 0.08, 'the eye over the sea, past the presentation\'s exit clearance');
  // KeepSurfaceCameraUnsunk drops the forced crouch every post phase; the next decision forces it again (DFU's own
  // arm) - so the flag reads false after the post phase and the capsule never moves
  assert.equal(w.m.forcedSwimCrouch, false, 'ForcedSwimCrouch = false with the head clear');
  assert.equal(deepWaterPlayer.isUnderwater, false, 'the presentation is above');
  assert.equal(w.m.isPlayerSwimming, true, 'still swimming');
  assert.equal(w.edges, 1, 'no edge through it all');
  for (let i = 0; i < 120; i++) frame(w);
  near(centre(w.m), ceiling, 1e-5, 'released: the forged swim holds (the exit clearance 0.75) and nothing moves it');
  assert.equal(w.m.crouching, true);
  assert.equal(w.m.swimming, true);
  const z0 = w.m.pos[2];
  for (let i = 0; i < 60; i++) frame(w, { forward: 1 });
  near(w.m.pos[2] - z0, csSwim(csWalk(50), 30), 1e-3, 'the surface swim is still GetSwimSpeed - the crouch penalty is off while LevitateMotor swims (GetBaseSpeed :150)');
});

test('DW-D: diving - down descends, the head goes under, the presentation follows, the breath runs on the head test; the ear gets the forged level and submersion (mutants: the head offset, the audio state)', () => {
  const w = atSurface(seaWorld());
  assert.equal(w.dw.submerged, false, 'at the surface the head is clear');
  const y0 = w.m.pos[1];
  for (let i = 0; i < 120; i++) frame(w, { descend: true });
  assert.ok(w.m.pos[1] < y0 - 3, 'down went down');
  assert.equal(w.m.crouching, true, 'the swim crouch, diving as at the surface');
  assert.equal(w.m.forcedSwimCrouch, true, 'a diver keeps it forced (KeepSurfaceCameraUnsunk stands aside)');
  assert.equal(deepWaterPlayer.isHeadSubmerged, true);
  assert.equal(deepWaterPlayer.isUnderwater, true);
  assert.equal(w.dw.submerged, true, 'isPlayerSubmerged as forged - the ambient\'s bubbles and Temple.AvoidDeath read it');
  assert.equal(w.dw.waterLevelY, -csLevel(csForgedLine(OCEAN, true, centre(w.m))) * 0.025);
  // PlayerEntity's breath clause on the head test: a dive from empty fills it, the 19th tick drains
  const e = { stats: { endurance: 60 }, raceId: 1, activeEffects: [], currentBreath: 0 };
  const st = { tally: 0 };
  breathStep(e, deepWaterPlayer.isHeadSubmerged, st);
  assert.ok(e.currentBreath > 0, 'the dive fills the lungs');
  // the fog while under: DFU's UnderwaterFog with the mod's neutral grey
  const fog = w.dw.fog({ mode: 'exp2', density: 0.001, start: 0, end: 1000, color: [0.5, 0.6, 0.7] }, w.m.eye[1], 1);
  assert.ok(fog && fog.color[0] === fog.color[1] && fog.color[1] === fog.color[2], 'ApplyNeutralUnderwaterFogColor: a grey');
});

test('DW-D: the shore exit - a surface swimmer pushing into the shore is lifted onto it (a landing 1 m ahead, the centre 1.5 over it), the forge restored, the stand requested (mutants: the landing offset, the forward gate, the restore)', () => {
  const w = atSurface(seaWorld(), 97);
  const yaw = Math.PI / 2;   // +x, toward the coast
  let exited = -1;
  for (let i = 0; i < 400 && exited < 0; i++) {
    frame(w, { forward: 1, yaw });
    if (!w.dw.forged) exited = i;
  }
  assert.ok(exited > 0, 'the swimmer left the water');
  assert.ok(w.m.pos[0] > COAST, 'over the shore');
  // the crouched capsule's centre put 1.5 m over the landing by a swept move, then DoStanding grew it on planted feet
  const feetWant = SHORE + 1.5 - 0.9 / 2;
  assert.ok(w.m.pos[1] > feetWant - 0.02 && w.m.pos[1] < feetWant + 0.1, `the feet ${w.m.pos[1]} under a centre lifted to the landing + 1.5 (${feetWant})`);
  assert.equal(w.m.heightAction === 'stand' || w.m.height === 1.8, true, 'and the stand requested');
  assert.equal(w.m.isPlayerSwimming, false, 'Restore: IsPlayerSwimming down');
  assert.equal(w.dw.waterMethod, 'None', 'OnExteriorWaterMethod.None, as Restore writes it');
  assert.equal(w.m.swimming, false, 'LevitateMotor.IsSwimming down');
  assert.equal(w.dw.waterLevelY, null, 'blockWaterLevel back to the sentinel');
  assert.equal(w.dw.submerged, false);
  assert.equal(deepWaterPlayer.isInWater, false, 'ClearState');
  for (let i = 0; i < 60; i++) frame(w, { forward: 1, yaw });
  assert.equal(w.m.grounded, true, 'standing on the shore');
  assert.equal(w.m.crouching, false, 'RequestStandAfterWaterExit stood the swim crouch up');
  assert.equal(w.m.height, 1.8);
  near(w.m.pos[1], SHORE, 1e-5, 'on it, not over it (a step in the floor is no slope - restFloor)');
  assert.equal(w.dw.decision?.onShore ?? true, true, 'the driver sees shore ground');
  assert.equal(deepWaterPlayer.isInWater, false);
  // no forward input, no exit: the swimmer floats against the wall
  const still = atSurface(seaWorld(), COAST - 0.5);
  for (let i = 0; i < 120; i++) frame(still, { yaw: Math.PI / 2 });
  assert.equal(still.dw.forged, true, 'InputManager.Vertical <= 0.02: no exit');
  // looking straight down, the camera's forward flattens to nothing (sqrMagnitude < 0.01)
  for (let i = 0; i < 120; i++) frame(still, { forward: 1, yaw: Math.PI / 2, pitch: -Math.PI / 2 });
  assert.equal(still.dw.forged, true, 'no direction, no exit');
});

test('DW-D: a swimmer who steps up onto a shelving shore is stood out of the water in the POST phase - PostPhaseRestore\'s shore arm: Restore, the stand, LevitateMotor.IsSwimming down at once (mutants: the arm, the flag)', () => {
  const BEACH = OCEAN - 0.4;   // 0.4 under the sea: a step the swimmer's capsule climbs, and shore ground (>= the sea - 0.5)
  const w = atSurface(seaWorld({}, BEACH), 98.5);
  const yaw = Math.PI / 2;
  let out = -1, lowest = Infinity;
  const surfaceFeet = w.m.pos[1];
  for (let i = 0; i < 200 && out < 0; i++) {
    const { forge } = frame(w, { forward: 1, yaw });
    if (forge && !w.dw.forged) out = i;   // forged ahead of the motor, restored after it
    else lowest = Math.min(lowest, w.m.pos[1]);
  }
  assert.ok(lowest > surfaceFeet - 1e-3, `the swimmer never dipped on the way in (${lowest} vs ${surfaceFeet}): LevitateMotor's move is a bare Move - no ground snap onto the wall's edge`);
  assert.ok(out >= 0, 'the post phase restored a frame the Update had forged');
  assert.ok(w.m.pos[0] >= COAST, 'up on the beach');
  assert.equal(w.m.swimming, false, 'ApplyDfuSwimFlags(false) in the post phase itself - not a frame late');
  assert.equal(w.m.isPlayerSwimming, false);
  assert.equal(w.dw.waterMethod, 'None');
  assert.equal(w.dw.waterLevelY, null);
  assert.equal(deepWaterPlayer.isInWater, false, 'ClearState');
  assert.ok(Math.abs(w.m.pos[1] - (OCEAN - 0.4)) < 0.2, 'no knee-catch on the wall\'s edge: the swimmer glided over it (no ground snap in LevitateMotor\'s move)');
  frame(w, { forward: 1, yaw });
  assert.equal(w.dw.forged, false, 'and the next Update sees shore ground');
});

test('DW-D: the load grace - the shore exit waits while a load or a location is in progress; the stroke and the multiplier stand down (mutants: the grace ignored by either)', () => {
  const w = atSurface(seaWorld({ swimSpeedMultiplier: 3 }), 97);
  const yaw = Math.PI / 2;
  for (let i = 0; i < 400; i++) frame(w, { forward: 1, yaw, loadGrace: true });
  assert.equal(w.dw.forged, true, 'no exit while the grace holds - the swimmer stays against the wall');
  assert.ok(w.m.pos[0] < COAST, 'still in the sea');
  assert.equal(w.m.swimSpeedScale, 1, 'no multiplier in the grace');
  for (let i = 0; i < 60 && w.dw.forged; i++) frame(w, { forward: 1, yaw });
  assert.equal(w.dw.forged, false, 'the grace over: out onto the shore');
  // the clock itself (DeepWaterRuntime)
  resetDeepWaterRuntime();
  assert.equal(loadGraceActive(100), false, 'at boot, none');
  loadStarted();
  assert.equal(loadGraceActive(1e9), true, 'OnStartLoad: until the load lands');
  loadFinished(200);
  assert.equal(loadGraceActive(200 + LOAD_GRACE_SECONDS - 0.01), true, '1.5 s more');
  assert.equal(loadGraceActive(200 + LOAD_GRACE_SECONDS), false);
  teleported(300);
  assert.equal(loadGraceActive(300.5), true, 'OnTeleportToCoordinates: 1.5 s');
  assert.equal(loadGraceActive(301.6), false);
  locationLoadBegan(400);
  assert.equal(loadGraceActive(405), true, 'a location loading');
  locationLoadEnded();
  assert.equal(loadGraceActive(405), false, 'and done');
  locationLoadBegan(500);
  assert.equal(loadGraceActive(500 + LOCATION_LOAD_STUCK_SECONDS + 0.1), false, 'stuck past 12 s: dropped');
  assert.equal(loadGraceActive(500.1), false, 'and stays dropped');
  locationLoadBegan(600); locationLoadBegan(600.5);
  teleported(601);
  assert.equal(loadGraceActive(602.6), false, 'a teleport resets the location count with the transition');
  resetDeepWaterRuntime();
});

test('DW-D: a boat or a subscriber suppresses the swim - ClearBoatSwimPose: the forge restored, every flag down, the capsule unsunk; a throwing subscriber is logged once and counts false (mutants: the boat ignored, the suppression ignored)', () => {
  const w = seaWorld();
  w.m.spawn(50, OCEAN - 3, 0);
  for (let i = 0; i < 10; i++) frame(w);
  assert.equal(w.dw.forged, true);
  const { forge } = frame(w, { onBoat: true });
  assert.equal(forge, null, 'no forge on a boat');
  assert.equal(w.dw.forged, false, 'Restore');
  assert.equal(w.m.isPlayerSwimming, false);
  assert.equal(w.dw.waterMethod, 'None', 'ClearBoatSwimPose: ApplyWaterAudioState(10000, None, false)');
  assert.equal(w.m.swimming, false);
  assert.equal(w.m.forcedSwimCrouch, false, 'ForcedSwimCrouch = false');
  assert.equal(deepWaterPlayer.isSwimming, false, 'ClearState');
  assert.equal(w.dw.waterLevelY, null);
  // a subscriber answering true does the same; unsubscribing hands the swim back
  const off = deepWaterPlayer.shouldSuppressOutdoorSwimming(() => true);
  frame(w);
  assert.equal(w.dw.forged, false, 'suppressed by a subscriber');
  off();
  frame(w);
  assert.equal(w.dw.forged, true, 'handed back');
  // a throwing subscriber: logged once, counts false, never stops the others
  const warn = console.warn; let logged = 0; console.warn = () => { logged++; };
  try {
    const a = deepWaterPlayer.shouldSuppressOutdoorSwimming(() => { throw new Error('bad mod'); });
    assert.equal(evaluateSwimmingSuppression(), false, 'a throw is no suppression');
    assert.equal(evaluateSwimmingSuppression(), false);
    assert.equal(logged, 1, 'logged once');
    const b = deepWaterPlayer.shouldSuppressOutdoorSwimming(() => true);
    assert.equal(evaluateSwimmingSuppression(), true, 'any one true wins, whatever threw before it');
    a(); b();
  } finally { console.warn = warn; }
  assert.equal(evaluateSwimmingSuppression(), false, 'none left');
});

test('DW-D: a dismount for the swim, and the inside frame - IsPlayerInside restores the forge, clears the state, ends the exterior context (mutants: either dropped)', () => {
  const w = seaWorld();
  w.m.spawn(50, OCEAN - 3, 0);
  w.m.transportMode = 'Horse';
  frame(w);
  assert.equal(w.dismounts, 1, 'DismountForSwimming: off the horse');
  assert.equal(w.m.transportMode, 'Foot');
  frame(w);
  assert.equal(w.dismounts, 1, 'once');
  assert.equal(w.dw.exteriorContext, true);
  w.dw.insideFrame(w.m, w.t);
  assert.equal(w.dw.exteriorContext, false, 'exteriorContextActive down');
  assert.equal(w.dw.forged, false, 'Restore');
  assert.equal(w.m.isPlayerSwimming, false);
  assert.equal(w.dw.decision, null);
  flushStateChange();
  assert.equal(deepWaterPlayer.isInWater, false, 'ClearState');
});

test('DW-D: the crouch is cleared for 1.5 s after the water is left (ClearCrouchAfterWaterExit), and not after (mutant: the window)', () => {
  assert.equal(UNCROUCH_AFTER_EXIT_SECONDS, 1.5);
  const w = atSurface(seaWorld(), 97);
  const yaw = Math.PI / 2;
  for (let i = 0; i < 400 && w.dw.forged; i++) frame(w, { forward: 1, yaw });
  assert.equal(w.dw.forged, false);
  for (let i = 0; i < 30; i++) frame(w);
  w.m.crouching = true; w.m.heightAction = null;
  frame(w);
  assert.equal(w.m.heightAction === 'stand' || !w.m.crouching, true, 'inside the window: stood');
  for (let i = 0; i < 120; i++) frame(w);
  w.m.crouching = true; w.m.heightAction = null;
  frame(w);
  assert.equal(w.m.crouching, true, 'past it: the crouch stands');
});

// ---- 3. the movement controller ------------------------------------------

/** A player and a recording collider: the stroke's swept moves, summed. */
function strokeRig(settings = {}) {
  const s = { swimSpeedMultiplier: 1, enableSwimStroke: true, ...settings };
  const moved = [0, 0, 0];
  const col = { move(pos, dx, dy, dz) { pos[0] += dx; pos[1] += dy; pos[2] += dz; moved[0] += dx; moved[1] += dy; moved[2] += dz; } };
  const player = { pos: [0, 0, 0], height: 0.3, swimSpeedScale: 1, swimSpeedNow() { return csSwim(csWalk(50) * this.swimSpeedScale, 30); } };
  const entity = { fatigue: 6400, stats: { strength: 50, endurance: 50 } };
  const ctl = createSwimMovement({ settings: () => s, collider: () => col });
  let now = 0;
  const step = (o = {}) => { now += DT; ctl.update({ now, dt: DT, player, entity, anySwimming: true, outdoorSwimming: false, loadGrace: false, input: { forward: 1, strafe: 0, up: false, down: false, run: false, ...o.input }, yaw: 0, pitch: 0, lookDir: [0, 0, 1], cameraY: 0, oceanY: null, seafloorY: () => null, ...o }); };
  return { s, moved, player, entity, ctl, step, get now() { return now; } };
}

test('DW-D: the swim stroke - Run\'s edge spends max(24, ceil(MaxFatigue x 0.025)) for an eased burst along the keys; the cooldown; either edge; the switch off consumes nothing (mutants: the cost, the cooldown, the short-circuit order)', () => {
  const r = strokeRig();
  const cost = Math.max(24, Math.ceil(maxFatigue(r.entity) * 0.025));
  assert.equal(cost, 160, 'MaxFatigue (STR + END) x 64 = 6400: 160 raw');
  r.step();
  assert.equal(r.entity.fatigue, 6400, 'no edge, no stroke');
  r.step({ input: { run: true } });
  assert.equal(r.entity.fatigue, 6400 - cost, 'the press: DecreaseFatigue(cost, false)');
  for (let i = 0; i < 60; i++) r.step({ input: { run: true } });
  // the burst's displacement: the eased share summed frame by frame at the swim speed x 2.65 x tempo
  const sm = (t) => { t = Math.min(1, Math.max(0, t)); return -2 * t * t * t + 3 * t * t; };
  let rem = STROKE.duration, want = 0;
  for (let i = 0; i < 61 && rem > 0; i++) { want += csSwim(csWalk(50), 30) * 2.65 * sm(rem / STROKE.duration) * DT; rem = Math.max(0, rem - DT); }
  near(r.moved[2], want, 1e-9, 'the burst along +z');
  assert.equal(r.moved[0], 0);
  // either edge: the release strokes again once the cooldown (0.9 s at tempo 1) is spent - it has been ~1.0 s
  r.step();
  assert.equal(r.entity.fatigue, 6400 - 2 * cost, 'the release is an edge too');
  r.step({ input: { run: true } });
  assert.equal(r.entity.fatigue, 6400 - 2 * cost, 'inside the cooldown: the edge is spent for nothing');
  // not enough fatigue: nothing
  const poor = strokeRig();
  poor.entity.fatigue = cost - 1;
  poor.step({ input: { run: true } });
  assert.equal(poor.entity.fatigue, cost - 1, 'CurrentFatigue >= cost, or no stroke');
  assert.equal(poor.moved[2], 0);
  // the switch off: the edge is NOT consumed (HandleStrokeInput's first test), so switching it on with Run held strokes
  const off = strokeRig({ enableSwimStroke: false });
  off.step({ input: { run: true } });
  assert.equal(off.entity.fatigue, 6400, 'switched off: no stroke');
  off.s.enableSwimStroke = true;
  off.step({ input: { run: true } });
  assert.equal(off.entity.fatigue, 6400 - cost, 'switched on with Run still held: the edge was never read, so it is one now');
  // a big frame moves a tenth of a second's worth (SwimMoveDeltaScale), and the tempo scales duration and cooldown
  const big = strokeRig({ swimSpeedMultiplier: 4 });
  big.step({ input: { run: true }, dt: 0.5 });
  const tempo = Math.pow(4, 0.35);
  near(big.moved[2], csSwim(csWalk(50) * 4, 30) * 2.65 * tempo * 1 * 0.1, 1e-9, 'a 0.5 s frame: the first sample at full share, 0.1 s of it');
});

test('DW-D: ClampAboveRenderedSeafloor - the centre 0.18 over the swimmable floor; else over a distance-field pixel\'s own terrain when that is 2.5 m or less up (mutants: the clearance, the cap)', () => {
  const p = { pos: [0, 9, 0], height: 0.3 };
  clampAboveSeafloor(p, { seafloorY: () => 10, vanillaGroundY: () => null });
  near(p.pos[1] + 0.15, 10.18, 1e-12, 'lifted to the floor + 0.18');
  const q = { pos: [0, 12, 0], height: 0.3 };
  clampAboveSeafloor(q, { seafloorY: () => 10 });
  assert.equal(q.pos[1], 12, 'above it: untouched');
  const t1 = { pos: [0, 8, 0], height: 0.3 };
  clampAboveSeafloor(t1, { seafloorY: () => null, vanillaGroundY: () => 10 });
  near(t1.pos[1] + 0.15, 10.18, 1e-12, 'the terrain, 2.03 up: lifted');
  const t2 = { pos: [0, 7, 0], height: 0.3 };
  clampAboveSeafloor(t2, { seafloorY: () => null, vanillaGroundY: () => 10 });
  assert.equal(t2.pos[1], 7, 'more than 2.5 m under it: left alone');
});

// ---- 4. the public API, the ear, the breath, the hosts ---------------------

test('DW-D: DeepWaterPlayer - a change is announced once per frame, each listener on its own; TryGetWaterColumn answers from the host\'s source (mutants: the flush, the isolation)', () => {
  clearState(); flushStateChange();
  let a = 0, b = 0;
  const offA = deepWaterPlayer.onStateChanged(() => { a++; throw new Error('listener bug'); });
  const offB = deepWaterPlayer.onStateChanged(() => { b++; });
  const warn = console.warn; console.warn = () => {};
  try {
    publishState(true, true, false, false);
    publishState(true, true, true, true);
    assert.equal(a + b, 0, 'nothing until the flush');
    flushStateChange();
    assert.deepEqual([a, b], [1, 1], 'one announcement, and a throwing listener does not stop the next');
    flushStateChange();
    assert.deepEqual([a, b], [1, 1], 'no change, no announcement');
    publishState(true, true, true, true);
    flushStateChange();
    assert.deepEqual([a, b], [1, 1], 'the same state is no change');
    assert.equal(deepWaterPlayer.isUnderwater, true);
  } finally { console.warn = warn; offA(); offB(); }
  clearState(); flushStateChange();
  setColumnSource(() => ({ terrain: 'T', surfaceY: 34, seafloorY: 10, depth: 24 }));
  assert.deepEqual(deepWaterPlayer.tryGetWaterColumn(), { terrain: 'T', surfaceY: 34, seafloorY: 10, depth: 24 });
  setColumnSource(null);
  assert.equal(deepWaterPlayer.tryGetWaterColumn(), null, 'no source, no column');
});

test('DW-D: the listener\'s low-pass - every bus through one node, a 1000 Hz filter hung on it and taken off (UnderwaterPresentationEffects.UpdateAudioFilter), Unity\'s Q 1 as Web Audio\'s 0 dB (mutants: the bus bypassed, the Q)', () => {
  const ctx = { state: 'running', destination: { type: 'dest' }, sampleRate: 48000, resume() {} };
  const mk = (kind) => ({ kind, context: ctx, out: new Set(), connect(x) { this.out.add(x); return x; }, disconnect() { this.out.clear(); }, gain: { value: 1 }, frequency: { value: 0 }, Q: { value: NaN } });
  Object.assign(ctx, { createGain: () => mk('gain'), createBiquadFilter: () => mk('biquad') });
  const a = new AudioEngine();
  a.ctx = ctx; a._ensureCtx = () => {};
  const bus = a.listenerBus();
  assert.ok(bus && bus.out.has(ctx.destination), 'the listener bus feeds the speakers');
  assert.ok(a._master.out.has(bus), 'the master feeds the listener');
  a.setListenerLowPass(1000);
  const f = [...bus.out][0];
  assert.equal(f.kind, 'biquad');
  assert.equal(f.type, 'lowpass');
  assert.equal(f.frequency.value, 1000, 'lowPassFilter.cutoffFrequency = 1000f');
  assert.equal(f.Q.value, 0, 'linear Q 1 is 0 dB');
  assert.ok(f.out.has(ctx.destination));
  assert.equal(a.listenerLowPass, 1000);
  a.setListenerLowPass(0);
  assert.ok(bus.out.has(ctx.destination) && bus.out.size === 1, 'off: straight through');
  assert.equal(a.listenerLowPass, 0);
});

test('DW-D: ApplyArgonianInfiniteBreath is IsWaterBreathing for an Argonian player wherever the player is - the dungeon\'s breath too (mutants: the rule unread)', () => {
  const argonian = { stats: { endurance: 60 }, raceId: 8, activeEffects: [], currentBreath: 5 };
  const st = { tally: 19 };
  const prev = setWaterBreathingRule((e) => e === argonian && e.raceId === 8);
  try {
    assert.equal(isWaterBreathing(argonian), true);
    breathStep(argonian, true, st);
    assert.equal(argonian.currentBreath, 0, 'no drain - the clause\'s else arm zeroes the counter as DFU\'s does when breathing');
  } finally { setWaterBreathingRule(prev); }
  assert.equal(isWaterBreathing(argonian), false, 'the rule gone, the effect alone');
  const world = rd('src/scenes/world.js');
  assert.match(world, /if \(dwPlayer\) setWaterBreathingRule\(\(e\) => e === playerEntity && dwSettings\(\)\.argonianInfiniteBreath && e\.raceId === RACES\.Argonian\);/, 'the world host installs it with the mod');
  assert.match(world, /if \(breathStep\(playerEntity, dwPlayer\.submerged, _dwBreathState\) === 'drowned'\)/, 'the sea\'s breath on the forged isPlayerSubmerged, the rule inside breathStep');
});

test('DW-D: the forge reaches past the motor - the exterior ambient\'s water arm, Temple.AvoidDeath on both exterior hooks, the host\'s one motor write (pins)', () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /ambience\.update\(dt, \{ playerPos: cam\.pos, inside: false, underground: modes\?\.mode === 'dungeon', waterSurfaceY: dwPlayer\?\.waterLevelY \?\? null, submerged: !!dwPlayer\?\.submerged \}\);/, 'AmbientEffectsPlayer: blockWaterLevel != 10000 and IsPlayerSubmerged');
  assert.match(world, /avoidDeath\(activeMemberships\(playerEntity\), \{ submerged: !!dwPlayer\?\.submerged \}\)/, 'the boot host\'s consult');
  assert.match(world, /exteriorSubmerged: \(\) => !!dwPlayer\?\.submerged,/, 'handed to the mode router');
  const modes = rd('src/scenes/worldModes.js');
  assert.match(modes, /avoidDeath\(activeMemberships\(playerEntity\), \{ submerged: !!host\.exteriorSubmerged\?\.\(\) \}\)/, 'the router\'s consult, which outlives a building');
  // the forge rides the ONE write, never a second
  const i = world.indexOf('const _dwForge = dwPlayer && playerSpawned ? dwPlayer.beforeMove({');
  const j = world.indexOf('applyMotorEffectFlags(player, playerEntity, _dwForge ?? undefined);');
  assert.ok(i > 0 && j > i, 'Update ahead of the one write');
  const k = world.indexOf('dwPlayer.afterMove({ now: now / 1000, player,');
  assert.ok(k > j, 'PostPhaseRestore after the motor');
  assert.ok(world.indexOf('dwFlushStateChange();   // OutdoorSwimDriverAfter') > k, 'then FlushStateChange');
});

test('DW-D: a step in the heightfield is no slope - the capsule rests on the ground beneath it at a carved cell\'s edge, and the ground\'s normal there is the ground\'s (mutant: the centred difference back)', () => {
  const col = new Collider((x) => (x < 0 ? -20 : 0));
  for (const x of [0.01, 0.1, 0.3]) assert.equal(col.restFloor(x, 0), 0, `the shore ${x} m from the step rests on the shore`);
  for (const x of [-0.01, -0.3]) assert.equal(col.restFloor(x, 0), -20, `the sea's bed ${-x} m from it rests on the bed`);
  assert.deepEqual(col.groundNormal(0.2, 0), [0, 1, 0], 'the shore\'s normal is up');
  // a plane keeps its rest exactly (DISC16-A)
  const g = Math.tan(Math.PI / 6);
  const plane = new Collider((x, z) => g * z);
  near(plane.restFloor(0, 0), 0.35 * (1 / Math.cos(Math.PI / 6) - 1), 1e-12, 'a 30 degree plane: r (1/cos - 1)');
});

test('DW-D: the dungeon arm\'s afloat line - once per over-encumbered swim, the latch dropped by the weight or the swim, never while water walking; at sea it runs only while the forge holds the arm open (mutants: the strict weight test, the latch, the water-walking term, the forge gate)', () => {
  // PlayerEnterExit.cs:395-404 and Internal_Strings.csv:18, spelled out
  assert.equal(CANNOT_FLOAT_TEXT, 'You are carrying too much to stay afloat.');
  assert.equal(CANNOT_FLOAT_HUD_SECONDS, 1.75, 'AddHUDText(..., 1.75f)');
  const p = { swimming: true, displayAfloatMessage: false, carriedWeight: () => 62.75 };   // x 4 = 251
  assert.equal(afloatMessageStep(p, false), CANNOT_FLOAT_TEXT, 'over 250: the line');
  assert.equal(p.displayAfloatMessage, true);
  assert.equal(afloatMessageStep(p, false), null, 'once - the latch holds it');
  p.carriedWeight = () => 62.5;   // x 4 = 250, not over
  assert.equal(afloatMessageStep(p, false), null);
  assert.equal(p.displayAfloatMessage, false, 'the weight gone, the latch drops');
  p.carriedWeight = () => 62.75;
  assert.equal(afloatMessageStep(p, true), null, 'no line while water walking');
  assert.equal(p.displayAfloatMessage, false, 'and nothing moves: the else arm wants the weight or the swim gone');
  assert.equal(afloatMessageStep(p, false), CANNOT_FLOAT_TEXT, 'the walk ended, the line');
  p.swimming = false;
  assert.equal(afloatMessageStep(p, false), null);
  assert.equal(p.displayAfloatMessage, false, 'out of the swim, the latch drops');
  p.levitating = true; p.swimming = true;
  assert.equal(afloatMessageStep(p, false), CANNOT_FLOAT_TEXT, 'the arm\'s own test has no levitation term (LevitateMotor\'s :83 has)');
  assert.equal(new PlayerMotor(new Collider(() => 0)).displayAfloatMessage, false, 'PlayerEnterExit\'s member starts false');

  // at sea, through the world frame: the line on the first forged frame of a heavy swim, and no other
  const w = seaWorld();
  w.m.carriedWeight = () => 100;
  w.m.spawn(50, OCEAN - 3, 0);
  for (let i = 0; i < 30; i++) frame(w, { forward: 1 });
  assert.deepEqual(w.hud, [CANNOT_FLOAT_TEXT], 'once, at the swim\'s start');
  // out of the water (a heavy swimmer sinks, so a teleport to the shore): the forge restores and the arm stops
  // running, so the latch stays where it was
  w.m.spawn(COAST + 10, SHORE, 0);
  for (let i = 0; i < 10; i++) frame(w);
  assert.equal(w.dw.forged, false, 'out of the water');
  assert.equal(w.m.displayAfloatMessage, true, 'unforged, nothing drops the latch');
  w.m.spawn(50, OCEAN - 3, 0);
  for (let i = 0; i < 10; i++) frame(w);
  assert.deepEqual(w.hud, [CANNOT_FLOAT_TEXT], 'back in, still heavy: no second line');
  w.m.carriedWeight = () => 10;
  frame(w);
  assert.equal(w.m.displayAfloatMessage, false, 'lightened while swimming, the forged arm drops it');
  w.m.carriedWeight = () => 100;
  frame(w);
  assert.deepEqual(w.hud, [CANNOT_FLOAT_TEXT, CANNOT_FLOAT_TEXT], 'and heavy again, the line again');

  // the three hosts: each dungeon arm right after its swim write, the world host behind the forge
  const dungeon = rd('src/scenes/dungeon.js');
  assert.match(dungeon, /player\.waterWalking = ctx\.playerWaterWalking\(\);\n\s+const afloat = afloatMessageStep\(player, player\.waterWalking\);[^\n]*\n\s+if \(afloat\) ctx\.hudSay\?\.\(afloat, CANNOT_FLOAT_HUD_SECONDS\);/);
  const modes = rd('src/scenes/worldModes.js');
  assert.match(modes, /player\.waterWalking = dungeonCtx\.playerWaterWalking\(\);\n\s+const afloat = afloatMessageStep\(player, player\.waterWalking\);[^\n]*\n\s+if \(afloat\) dungeonCtx\.hudSay\(afloat, CANNOT_FLOAT_HUD_SECONDS\);/);
  const world = rd('src/scenes/world.js');
  assert.match(world, /applyMotorEffectFlags\(player, playerEntity, _dwForge \?\? undefined\);\n[^\n]*\n\s+if \(_dwForge\) \{ const afloat = afloatMessageStep\(player, player\.waterWalking\); if \(afloat\) townTalk\.say\(afloat, CANNOT_FLOAT_HUD_SECONDS\); \}/);
});
