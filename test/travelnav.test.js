// TRAVEL-NAV1 (2026-09-25, Mac: "Improving travel options navigation to
// properly route around objects and stopping before running into
// buildings. Currently it could be so much better") - THE WALK GOES ROUND,
// AND STOPS SHORT.
//
// Travel Options' autopilot beelines: one bearing, latched a pixel at a
// time, and a force pushed along it at up to a hundred times walking pace -
// so a house, a wall or a boulder on the line is walked into and ground
// against. systems/travelSteer.js is the port's own steering between the
// autopilot and the motor, and these pins FLY it: a body on a table, a
// motor that steps the way player/motor.js steps (a fixed step scaled by
// the clock, an accumulator that can carry one over), obstacles as boxes
// and trunks, and a probe that casts the steering's feelers at them. Each
// layout the slice was asked for is flown at the accelerations the mod
// allows, and every flight asks the same four things: did it get there
// (or stop, where it should), did it EVER touch anything, did it dither,
// and what did each frame cost. Then the mod's door (travelOptions.js),
// the arrival buffer (travelAutopilot.js), the feelers through a REAL
// collider, the switch, and the host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createTravelSteer, steerDrive, travelFrameReach, createColliderProbe, TRAVEL_STEER, FEELER_HEIGHT, WALKABLE_NY,
} from '../src/systems/travelSteer.js';
import * as STEER from '../src/systems/travelSteer.js';   // TRAVEL-NAV2: read by name, so a pin on a constant the base lacks fails as an assertion
import { TravelAutopilot, calculateYaw, rectDistance, ARRIVAL_BUFFER } from '../src/systems/travelAutopilot.js';
import { readTravelOptionsSettings, createTravelOptions } from '../src/systems/travelOptions.js';
import { TRAVEL_OPTIONS_TEXT, TRAVEL_NAV_TEXT } from '../src/systems/travelOptionsText.js';
import { mapPixelWorldOrigin, E, W } from '../src/systems/travelPaths.js';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { Collider } from '../src/player/collider.js';
import { FIXED_DT, MAX_FRAME_DT, CAPSULE_RADIUS, STEP_OFFSET, SLOPE_LIMIT_DEG } from '../src/player/motor.js';
import { MOD_SETTINGS, modSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { MOD_CURATED, modDials } from '../src/systems/features.js';
import { mapPixelToWorldCoords, worldCoordToMapPixel, SCENE_MAP_RATIO } from '../src/world/streamingWorld.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DEG = Math.PI / 180;
const P = TRAVEL_STEER;

// ─── the table ──────────────────────────────────────────────────────────

const box = (xMin, zMin, xMax, zMax) => ({ box: true, xMin, xMax, zMin, zMax });
const trunk = (x, z, r = 0.3) => ({ box: false, x, z, r });

/** A 2-D ray against one obstacle: the distance to its face, 0 from inside. */
function rayHit(ox, oz, dx, dz, o) {
  if (o.box) {
    if (ox >= o.xMin && ox <= o.xMax && oz >= o.zMin && oz <= o.zMax) return 0;
    let t0 = 0, t1 = Infinity;
    for (const [p, d, lo, hi] of [[ox, dx, o.xMin, o.xMax], [oz, dz, o.zMin, o.zMax]]) {
      if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) return Infinity; continue; }
      let a = (lo - p) / d, b = (hi - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return Infinity;
    }
    return t0;
  }
  const fx = ox - o.x, fz = oz - o.z;
  const c = fx * fx + fz * fz - o.r * o.r;
  if (c <= 0) return 0;
  const b = fx * dx + fz * dz, disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : Infinity;
}
/** How far the CAPSULE's skin stands from the nearest obstacle - below zero is touching. */
function clearance(x, z, obs) {
  let m = Infinity;
  for (const o of obs) {
    const d = o.box
      ? Math.hypot(Math.max(o.xMin - x, 0, x - o.xMax), Math.max(o.zMin - z, 0, z - o.zMax))
      : Math.hypot(x - o.x, z - o.z) - o.r;
    m = Math.min(m, d - CAPSULE_RADIUS);
  }
  return m;
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Fly the steering from `start` to `target` over `obs` (metres). The mod's
 *  bearing is LATCHED at the start, as PlayerAutoPilot latches it for a
 *  pixel - so a body that is not brought back to the line after a detour
 *  walks parallel to it and misses. The motor is motor.js's shape: a step
 *  of FIXED_DT x scale, the real frame clamped to MAX_FRAME_DT BEFORE the
 *  scale, and an accumulator; a step that would put the capsule into an
 *  obstacle stops at contact and is counted. `unseen` obstacles block the
 *  body but not the feelers; `held` frames have their drive zeroed by the
 *  host (the ground gate) after the steering asked. */
function fly({ obs, start = [0, 0], target = [0, 100], speed = 4.4, scale = 1, dt = 1 / 60, maxFrames = 12000, arrive = 2, unseen = [], held = () => false }) {
  const steer = createTravelSteer();
  const body = { x: start[0], z: start[1] };
  const probe = (dx, dz, lateral) => {
    const ox = body.x + dz * lateral, oz = body.z - dx * lateral;
    let t = Infinity;
    for (const o of obs) t = Math.min(t, rayHit(ox, oz, dx, dz, o));
    return t;
  };
  const yaw = calculateYaw(start[0], start[1], target[0], target[1]) * DEG;
  const key = {};
  const all = obs.concat(unseen);
  const r = { arrived: false, stop: null, touched: false, minClear: Infinity, path: 0, frames: 0, maxProbes: 0, probes: 0, trace: [], headings: [], outs: new Set(), sides: [] };
  let acc = 0, asked = 0;
  const stepLen = FIXED_DT * scale;
  for (let fr = 0; fr < maxFrames && !r.arrived; fr++) {
    const gx = Math.max(Math.abs(body.x - target[0]) - arrive, 0), gz = Math.max(Math.abs(body.z - target[1]) - arrive, 0);
    Object.assign(steer.input, {
      key, x: body.x, z: body.z, tx: target[0], tz: target[1], yaw, goal: Math.hypot(gx, gz),
      reach: travelFrameReach(speed, dt, scale), quantum: speed * FIXED_DT * scale, asked,
    });
    const out = steer.step(steer.input, probe, steer.output);
    r.outs.add(out);
    r.frames++;
    r.maxProbes = Math.max(r.maxProbes, steer.state.probes);
    r.probes += steer.state.probes;
    r.headings.push(out.yaw);
    r.trace.push({ x: body.x, z: body.z, out: { ...out }, probes: steer.state.probes, want: steer.input.yaw });
    // the side each detour went, in order - a change between two detours is a row threaded left-right
    if (steer.state.episode && steer.state.side && r.sides.at(-1)?.episode !== steer.state.episodes) r.sides.push({ episode: steer.state.episodes, side: steer.state.side });
    if (out.stop) { r.stop = out.stop; break; }
    const force = held(fr) ? 0 : out.forward;
    asked = force * speed * scale * Math.min(dt, MAX_FRAME_DT);
    acc += Math.min(dt, MAX_FRAME_DT) * scale;
    const sx = Math.sin(out.yaw), sz = Math.cos(out.yaw);
    while (acc >= stepLen && !r.arrived) {
      acc -= stepLen;
      let d = speed * stepLen * force;
      while (d > 1e-9) {
        const q = Math.min(0.05, d);
        const nx = body.x + sx * q, nz = body.z + sz * q;
        if (clearance(nx, nz, all) < 0) { if (clearance(nx, nz, obs) < 0) r.touched = true; break; }
        body.x = nx; body.z = nz; r.path += q; d -= q;
        r.minClear = Math.min(r.minClear, clearance(body.x, body.z, obs));
        if (Math.abs(body.x - target[0]) <= arrive && Math.abs(body.z - target[1]) <= arrive) { r.arrived = true; break; }
      }
    }
  }
  r.flips = steer.state.flips; r.episodes = steer.state.episodes;
  r.body = body; r.steer = steer;
  let last = 0;
  r.reversals = 0;
  for (let i = 1; i < r.headings.length; i++) {
    const d = wrap(r.headings[i] - r.headings[i - 1]);
    if (Math.abs(d) > 1e-6) { const s = Math.sign(d); if (last && s !== last) r.reversals++; last = s; }
  }
  return r;
}

const LAYOUTS = {
  building: [box(-6, 40, 9, 55)],
  wall: [box(-2000, 40, 2000, 41)],
  pocket: [box(-10, 50, 10, 51), box(-10, 30, -9, 51), box(9, 30, 10, 51)],
  treesAcross: [-18, -12, -6, 0, 6, 12, 18].map((x) => trunk(x, 40)),
  treesAlong: [20, 26, 32, 38, 44, 50].map((z) => trunk(0, z)),
  gap: [box(-2000, 40, -0.5, 41), box(0.5, 40, 2000, 41)],
  gapOffCentre: [box(-2000, 40, -0.5, 41), box(0.7, 40, 2000, 41)],
  gapAside: [box(-2000, 40, 4.4, 41), box(5.6, 40, 2000, 41)],
};
const PACES = [[1, 1 / 60], [10, 1 / 60], [60, 1 / 60], [60, 0.1], [100, 0.1], [100, 0.25]];

// ─── the flights ────────────────────────────────────────────────────────

test('TRAVEL-NAV1: an open road is the mod\'s own journey to the bit - its bearing untouched, its force whole, three feelers a frame, and the steer\'s own shapes every frame', () => {
  for (const [scale, dt] of PACES) {
    const r = fly({ obs: [box(40, -50, 41, 150)], scale, dt });   // a wall beside the road, never across it
    assert.ok(r.arrived, `x${scale}: arrived`);
    for (const t of r.trace) {
      assert.equal(t.out.deflected, false, 'nothing in the way: the mod\'s bearing');
      assert.equal(t.out.yaw, t.want, '...to the bit, not a round trip through the fan');
      assert.equal(t.out.forward, 1, 'and the whole force');
      assert.equal(t.probes, 3, 'a corridor: the centre and the two edges');
    }
    assert.ok(r.path <= 100 + r.steer.input.reach, `x${scale}: the straight line (${r.path.toFixed(1)} m)`);
    assert.equal(r.outs.size, 1, 'EVERY ALLOCATION HAS AN OWNER: one output, the steer\'s, every frame');
  }
});

test('TRAVEL-NAV1 ROUTE AROUND: a building across the line is walked round and the target reached - never touched, one detour, one side, and back ON the line after it', () => {
  for (const [scale, dt] of PACES) {
    const r = fly({ obs: LAYOUTS.building, scale, dt });
    assert.ok(r.arrived, `x${scale}@${dt}: arrived (${r.stop})`);
    assert.equal(r.touched, false, `x${scale}@${dt}: never touched`);
    assert.equal(r.episodes, 1, 'one detour');
    assert.equal(r.flips, 0, 'on one side');
    if (dt < 0.05) {
      assert.ok(r.path < 1.2 * 100, `x${scale}: round the near edge, not the far one (${r.path.toFixed(1)} m)`);
      // THE LINE IS RE-ACQUIRED: the mod's bearing was latched at the start,
      // so a body left beside the line walks parallel to it and misses; the
      // pursuit brings it back well before the target
      const late = r.trace.filter((t) => t.z > 85);
      assert.ok(late.length && late.every((t) => Math.abs(t.x) < 0.5), `x${scale}: back on the line after the building (worst ${Math.max(...late.map((t) => Math.abs(t.x))).toFixed(2)} m off)`);
      assert.ok(r.reversals <= 3, `x${scale}: no dithering (${r.reversals} turn reversals)`);
    }
  }
});

test('TRAVEL-NAV1 STOP SHORT: a wall with no gap stops the journey BEFORE contact - once, on its detour budget, never touching, at every pace', () => {
  for (const [scale, dt] of PACES) {
    const r = fly({ obs: LAYOUTS.wall, scale, dt });
    assert.equal(r.stop, 'blocked', `x${scale}@${dt}: stopped as blocked`);
    assert.equal(r.touched, false, `x${scale}@${dt}: never touched`);
    assert.ok(r.minClear > 0, 'the skin never met the wall');
    assert.equal(r.episodes, 1, 'one detour, not a string of them each with a fresh budget');
    assert.ok(r.path <= 40 + P.detourBudget + 2 * r.steer.input.reach + 10, `x${scale}@${dt}: bounded (${r.path.toFixed(1)} m)`);
    assert.equal(r.trace.at(-1).out.forward, 0, 'and the frame that stops it moves nothing');
    assert.equal(r.trace.at(-1).out.yaw, r.trace.at(-1).want, '...facing the mod\'s own bearing, as InterruptTravel leaves it');
  }
});

test('TRAVEL-NAV1 THE WAY TO THE GOAL: a wall BEHIND the arrival rect is no reason to turn away from it - and the frame that carries the body toward it stops STANDOFF short of the wall, never at it', () => {
  // the town's walls stand behind its arrival buffer: the way only has to
  // be clear as far as the rect the journey arrives in
  const behind = [box(-50, 104, 50, 105)];
  for (const [scale, dt] of [[60, 0.1], [100, 0.1], [100, 0.25]]) {
    const r = fly({ obs: behind, scale, dt });
    assert.ok(r.arrived, `x${scale}@${dt}: arrived (${r.stop})`);
    assert.equal(r.episodes, 0, `x${scale}@${dt}: no detour round a wall it never had to pass`);
    assert.equal(r.touched, false);
  }
  // one frame, by the numbers: a wall five metres ahead, a frame that
  // would carry the body fifty, the arrival rect three metres out - the
  // way is open (clear past the rect) and the frame is capped at the
  // stand-off: four metres, not five
  const steer = createTravelSteer();
  Object.assign(steer.input, { key: {}, x: 0, z: 0, tx: 0, tz: 10, yaw: 0, goal: 3, reach: 50, quantum: 5, asked: 0 });
  const out = steer.step(steer.input, (dx, dz) => (dz > 0.999 ? 5 : Infinity), steer.output);
  assert.equal(out.stop, null);
  assert.equal(out.deflected, false, 'straight on');
  assert.ok(out.forward > 0, 'it moves');
  assert.ok(Math.abs(out.forward * 50 - (5 - P.standoff)) < 1e-9, `to the stand-off and no further (${(out.forward * 50).toFixed(3)} m)`);
});

test('TRAVEL-NAV1 THE POCKET: a U-shaped pocket across the line is backed out of and gone round - one detour, one side, no flip-flop, never touched', () => {
  for (const [scale, dt] of PACES) {
    const r = fly({ obs: LAYOUTS.pocket, scale, dt });
    assert.ok(r.arrived, `x${scale}@${dt}: escaped and arrived (${r.stop})`);
    assert.equal(r.touched, false, `x${scale}@${dt}: never touched`);
    assert.equal(r.episodes, 1, 'the pocket is ONE detour - the way wanted is never taken back into it');
    assert.equal(r.flips, 0, 'on one side');
    if (dt < 0.05) assert.ok(r.reversals <= 3, `x${scale}: no oscillation (${r.reversals} turn reversals)`);
  }
  // and a pocket DEEPER than the look-ahead: the way wanted is open for the
  // depth of the U and no further - the Bug2 rule is what keeps it shut
  for (const scale of [1, 10, 60]) {
    const r = fly({ obs: [box(-10, 80, 10, 81), box(-10, 20, -9, 81), box(9, 20, 10, 81)], target: [0, 150], scale });
    assert.ok(r.arrived, `deep, x${scale}: arrived (${r.stop})`);
    assert.equal(r.touched, false);
    assert.equal(r.episodes, 1, `deep, x${scale}: one detour`);
  }
});

test('TRAVEL-NAV1 TREES IN A LINE: a row of trunks across the line is passed through a gap, a row along it on one side - never touched, never flipped', () => {
  for (const name of ['treesAcross', 'treesAlong']) {
    for (const [scale, dt] of PACES) {
      const r = fly({ obs: LAYOUTS[name], scale, dt });
      assert.ok(r.arrived, `${name} x${scale}@${dt}: arrived (${r.stop})`);
      assert.equal(r.touched, false, `${name} x${scale}@${dt}: never touched`);
      assert.equal(r.flips, 0, `${name}: one side`);
      if (dt < 0.05) assert.ok(r.path < 1.05 * 100, `${name} x${scale}: weaves, does not wander (${r.path.toFixed(1)} m)`);
    }
  }
  // COMMIT: trunks along the line, each its own detour, all passed on the
  // SAME side - the side is kept for COMMIT metres after a detour ends,
  // where a fresh choice would tie and turn back toward the line, and the
  // row would be threaded left-right-left
  const along = fly({ obs: [16, 22, 28, 34].map((z) => trunk(0, z)).concat([trunk(0.9, 46)]), scale: 1 });
  assert.ok(along.arrived);
  assert.equal(along.touched, false);
  assert.ok(along.sides.length >= 2, `more than one detour (${along.sides.length})`);
  assert.equal(new Set(along.sides.map((e) => e.side)).size, 1, `one side for the whole row: ${along.sides.map((e) => e.side)}`);
});

test('TRAVEL-NAV1 THE OTHER SIDE: a detour whose side is a dead end tries the other once - the body held for the frame the scan changes hands - and a body boxed on both sides stops short; a tie turns back toward the line', () => {
  // committed RIGHT by an earlier detour, then walled in on the right:
  // only the left is open
  const steer = createTravelSteer();
  const rightShut = (dx) => (dx > -1e-9 ? 1.2 : Infinity);   // every heading with an eastward part (and dead ahead/behind) is shut at 1.2 m - under a step past the stand-off
  const inp = steer.input;
  Object.assign(inp, { key: {}, x: 0, z: 0, tx: 0, tz: 100, yaw: 0, goal: 90, reach: 0.15, quantum: 0.07, asked: 0 });
  steer.step(inp, () => Infinity, steer.output);   // the line, from here
  steer.state.commitSide = 1; steer.state.commitLeft = 40;
  let out = steer.step(inp, rightShut, steer.output);
  assert.equal(steer.state.flips, 1, 'the committed side was a dead end: the other side is tried');
  assert.equal(out.forward, 0, 'the body holds for the frame the scan changes hands');
  assert.equal(out.stop, null);
  out = steer.step(inp, rightShut, steer.output);
  assert.equal(out.stop, null);
  assert.ok(out.forward > 0 && Math.sin(out.yaw) < 0, 'and goes left');
  // boxed on both sides: after the flip, a stop - short of everything
  const boxed = createTravelSteer();
  Object.assign(boxed.input, inp, { key: {} });
  let r = boxed.step(boxed.input, () => 1.2, boxed.output);
  for (let i = 0; i < 10 && !r.stop; i++) r = boxed.step(boxed.input, () => 1.2, boxed.output);
  assert.equal(r.stop, 'blocked');
  assert.equal(boxed.state.flips, 1, 'both sides were tried');
  assert.equal(r.forward, 0);
  // A TIE TURNS BACK TOWARD THE LINE: a body a metre right of its line
  // meets a trunk dead ahead, open both ways at the first offset
  const tie = createTravelSteer();
  Object.assign(tie.input, { key: {}, x: 0, z: 0, tx: 0, tz: 100, yaw: 0, goal: 90, reach: 0.15, quantum: 0.07, asked: 0 });
  tie.step(tie.input, () => Infinity, tie.output);   // the line runs up x = 0
  const at = { x: 1, z: 10 };
  const post = trunk(1 + 8 * Math.sin(Math.atan2(-1, 8)), 10 + 8 * Math.cos(Math.atan2(-1, 8)), 0.3);   // on the pursuit bearing, 8 m out
  const probeAt = (dx, dz, lat) => rayHit(at.x + dz * lat, at.z - dx * lat, dx, dz, post);
  Object.assign(tie.input, { x: at.x, z: at.z, goal: 80 });
  tie.step(tie.input, probeAt, tie.output);
  assert.equal(tie.state.episode, true, 'a detour');
  assert.equal(tie.state.side, -1, 'right of the line, a tie goes LEFT - back toward it');
});

test('TRAVEL-NAV1 A NARROW GAP: a gap wider than the body is gone THROUGH, not round - on the line or a little off it; one off to the side is found walking the wall', () => {
  for (const [scale, dt] of PACES) {
    for (const name of ['gap', 'gapOffCentre']) {
      const r = fly({ obs: LAYOUTS[name], scale, dt });
      assert.ok(r.arrived, `${name} x${scale}@${dt}: through (${r.stop})`);
      assert.equal(r.touched, false, `${name} x${scale}@${dt}: never touched`);
      assert.equal(r.episodes, 0, `${name}: no detour at all - the corridor fits`);
      assert.ok(r.path < 100 + 1e-6, `${name} x${scale}: the straight line`);
    }
  }
  const tight = box(-2000, 40, -0.42, 41), tight2 = box(0.42, 40, 2000, 41);   // 0.84: wider than the capsule, narrower than the corridor
  const t = fly({ obs: [tight, tight2], scale: 10 });
  assert.equal(t.touched, false, 'a gap the corridor does not fit is not tried');
  // five metres off the line: the detour walks the wall, and the way it
  // began (REF) is tried each frame - so the gap is met as the body
  // passes in front of it
  for (const scale of [1, 10]) {
    const r = fly({ obs: LAYOUTS.gapAside, scale });
    assert.ok(r.arrived, `aside x${scale}: found (${r.stop})`);
    assert.equal(r.touched, false);
    assert.ok(r.path < 1.1 * 100, `aside x${scale}: found near, not after a long walk (${r.path.toFixed(1)} m)`);
  }
});

test('TRAVEL-NAV1 EVERY ACCELERATION: the feelers cover the frame\'s whole reach - x1 to x100 and a hitching frame, over every layout, nothing is ever touched', () => {
  assert.equal(travelFrameReach(4.4, 1 / 60, 60), 4.4 * 60 * (1 / 60 + FIXED_DT), 'speed x scale x (the frame + one carried step)');
  assert.equal(travelFrameReach(4.4, 10, 100), 4.4 * 100 * (MAX_FRAME_DT + FIXED_DT), 'the frame clamped to maximumDeltaTime BEFORE the scale (motor.js)');
  assert.equal(travelFrameReach(4.4, 1 / 60, 0), 0, 'a clock at zero moves nothing');
  for (const [name, obs] of Object.entries(LAYOUTS)) {
    for (const [scale, dt] of PACES) {
      for (const speed of [4.4, 11]) {   // walking, and a horse
        const r = fly({ obs, scale, dt, speed });
        assert.equal(r.touched, false, `${name} x${scale}@${dt} at ${speed} m/s: touched`);
        assert.ok(r.arrived || r.stop === 'blocked', `${name} x${scale}@${dt}: arrived or stopped short (${r.stop})`);
      }
    }
  }
});

test('TRAVEL-NAV1 CHEAP: no frame casts more than MAX_FEELERS, a detour frame is a handful, and a full scan is resumed rather than cast in one frame', () => {
  let worst = 0, frames = 0, probes = 0, detourFrames = 0, detourProbes = 0;
  for (const obs of Object.values(LAYOUTS)) {
    for (const [scale, dt] of PACES) {
      const r = fly({ obs, scale, dt });
      worst = Math.max(worst, r.maxProbes);
      frames += r.frames; probes += r.probes;
      for (const t of r.trace) if (t.out.deflected) { detourFrames++; detourProbes += t.probes; }
    }
  }
  assert.ok(worst <= P.maxFeelers, `the worst frame cast ${worst}`);
  assert.equal(P.maxFeelers, 16);
  assert.ok(probes / frames <= 6, `a handful on average (${(probes / frames).toFixed(2)})`);
  assert.ok(detourFrames > 0 && detourProbes / detourFrames <= 7, `a detour frame is a handful (${(detourProbes / detourFrames).toFixed(2)})`);
  // the cap is real: a steer with a tiny budget still gets round, holding while it scans
  const tiny = { ...P, maxFeelers: 7 };
  const steer = createTravelSteer(tiny);
  const body = { x: 0, z: 31 };
  const probe = (dx, dz, lat) => {
    let t = Infinity;
    for (const o of LAYOUTS.pocket) t = Math.min(t, rayHit(body.x + dz * lat, body.z - dx * lat, dx, dz, o));
    return t;
  };
  body.z = 45;   // five metres short of the pocket's back wall: the way wanted is shut from the first frame
  Object.assign(steer.input, { key: {}, x: 0, z: 45, tx: 0, tz: 100, yaw: 0, goal: 50, reach: 0.15, quantum: 0.07, asked: 0 });
  let heldFrames = 0, moving = null;
  for (let i = 0; i < 30 && !moving; i++) {
    const out = steer.step(steer.input, probe, steer.output);
    assert.ok(steer.state.probes <= 7, 'never more than the budget');
    assert.equal(out.stop, null, 'a scan in progress is not a stop');
    if (out.forward === 0) heldFrames++;
    else moving = { ...out };
  }
  assert.ok(heldFrames >= 1, 'the scan was spread over frames, the body held for them');
  assert.ok(moving && moving.deflected, 'and it finished, with a way round');
});

test('TRAVEL-NAV1 GRINDING: a body that stops moving while the drive asks it to is stopped - and a drive the HOST held (the ground gate) is not grinding', () => {
  // a sill the feelers pass over: it stops the body, not the probe
  const sill = [box(-3, 30, 3, 31)];
  for (const scale of [1, 10, 60]) {
    const r = fly({ obs: [], unseen: sill, scale });
    assert.equal(r.stop, 'stuck', `x${scale}: grinding is a stop`);
    assert.ok(r.body.z < 31, 'never through it');
    // promptly: GRIND_WINDOWS windows of asked-for travel after the body
    // first met it, and one more for the window it met it in
    const perFrame = 4.4 * scale / 60, quantum = 4.4 * FIXED_DT * scale;
    const window = Math.ceil(Math.max(P.grindWindow, P.grindSteps * quantum) / perFrame);
    const met = r.trace.findIndex((t) => t.z > 30 - CAPSULE_RADIUS - 0.06);
    assert.ok(met > 0 && r.frames - met <= (P.grindWindows + 1) * window + 2, `x${scale}: promptly (${r.frames - met} frames after it met the sill)`);
  }
  // the same road with the host holding the drive for a long while (the
  // terrain streaming in): nothing moved because nothing was ASKED
  const r = fly({ obs: [], held: (fr) => fr < 600 });
  assert.ok(r.arrived, `held, then walked on (${r.stop})`);
  assert.equal(r.stop, null);
});

test('TRAVEL-NAV2 NO HEADWAY: a body that keeps moving and gets no nearer is stopped - the fuzzed pocket where a detour ended and began again for ever, the clock racing - and the budget is twice the detour\'s, so an honest detour ends on its own', () => {
  // THE RULE, on its own: an open road, and a body driven round a ring ten
  // metres across, a metre a frame, never nearer the target than forty -
  // it moves every frame (so it is not grinding) and gets nowhere
  const steer = createTravelSteer();
  const inp = steer.input;
  const open = () => Infinity;
  Object.assign(inp, { key: {}, x: 0, z: 40, tx: 0, tz: 100, yaw: 0, goal: 50, reach: 1, quantum: 0.07, asked: 0 });
  let out = steer.step(inp, open, steer.output);
  let walked = 0, lastGain = 0, best = Infinity;
  for (let i = 1; i < 3000 && !out.stop; i++) {
    const t = i / 10;
    const x = 10 * Math.sin(t), z = 50 - 10 * Math.cos(t);
    const step = Math.hypot(x - inp.x, z - inp.z);
    walked += step;
    inp.x = x; inp.z = z; inp.asked = step;   // what was asked is what moved: no grinding
    const toGo = Math.hypot(x, 100 - z);
    if (toGo < best - P.headwayGain) { best = toGo; lastGain = walked; }
    out = steer.step(inp, open, steer.output);
  }
  assert.equal(out.stop, 'stuck', 'no headway is a stop - "Paused the journey since you\'re making no headway."');
  assert.equal(P.headwayBudget, 2 * P.detourBudget, 'twice the detour budget: a detour honestly going round ends on its own budget first (the wall above stops as blocked, not stuck)');
  assert.ok(walked - lastGain > P.headwayBudget && walked - lastGain <= P.headwayBudget + 1.01, `stopped the frame it walked the budget past its last metre of headway (${(walked - lastGain).toFixed(2)} m)`);
  assert.equal(out.forward, 0, 'and the frame that stops it moves nothing');
  // a leg is its own: a new target starts the count again
  const legs = createTravelSteer();
  Object.assign(legs.input, { key: {}, x: 0, z: 0, tx: 0, tz: 100, yaw: 0, goal: 90, reach: 1, quantum: 0.07, asked: 1 });
  legs.step(legs.input, open, legs.output);
  for (let i = 1; i <= 300; i++) { legs.input.x = (i % 2) * 1; legs.step(legs.input, open, legs.output); }
  assert.ok(legs.state.noGain > 250, 'three hundred metres of no headway on this leg');
  legs.input.tz = 200;
  legs.step(legs.input, open, legs.output);
  assert.equal(legs.state.noGain, 0, '...and none on the next');
  // THE FLIGHT the fuzz found (seed 29, trial 151, cut down to the four
  // that make it): a building across the line sends the detour left, and
  // two trunks by a second building's corner catch it - each detour ended
  // as soon as the way wanted opened and a new one began a frame later with
  // a fresh budget, so the old steering walked this for ever (four
  // thousand detours at x1, a hundred kilometres at x60) and never stopped
  const fuzzed = [box(-5.2, 32.6, 15.4, 46.6), box(-10.8, 68, -2.5, 86.1), trunk(-0.7, 77.7, 0.5), trunk(-1.9, 78.6, 0.5)];
  for (const scale of [1, 10]) {
    const r = fly({ obs: fuzzed, scale });
    assert.ok(r.arrived || r.stop === 'stuck', `x${scale}: arrived, or stopped for no headway (${r.stop}, ${r.frames} frames, ${r.path.toFixed(0)} m)`);
    assert.equal(r.touched, false, `x${scale}: never touched`);
    assert.ok(r.path < 100 + 2 * P.headwayBudget, `x${scale}: within the budget, not for ever (${r.path.toFixed(0)} m)`);
  }
});

test('TRAVEL-NAV2 A JUMP IS NOT A WALK: a fast travel taken from the map mid-journey starts the line again from where the body lands - the mod\'s own bearing, not a pursuit back to a line miles away - and charges nothing to the detour, grinding or headway', () => {
  const steer = createTravelSteer();
  const inp = steer.input;
  const open = () => Infinity;
  Object.assign(inp, { key: {}, x: 0, z: 0, tx: 0, tz: 1000, yaw: 0, goal: 990, reach: 0.15, quantum: 0.07, asked: 0 });
  steer.step(inp, open, steer.output);   // the line runs up x = 0
  for (let i = 1; i <= 30; i++) { inp.z = i * 0.1; inp.asked = 0.1; steer.step(inp, open, steer.output); }
  // the travel map opened over the journey, a ship taken from it: the body
  // is put down 500 m east, and the mod re-aims from the new pixel
  inp.x = 500; inp.z = 3; inp.yaw = calculateYaw(500, 3, 0, 1000) * DEG;
  const out = steer.step(inp, open, steer.output);
  assert.equal(out.deflected, false, 'the mod\'s own bearing from where it landed');
  assert.equal(out.yaw, inp.yaw, '...to the bit - not a pursuit point on the old line, 500 m west');
  assert.equal(out.forward, 1);
  assert.deepEqual([steer.state.ox, steer.state.oz], [500, 3], 'the line starts again from here');
  assert.equal(steer.state.winMoved, 0, 'the jump is not travel for the grinding check');
  assert.equal(steer.state.noGain, 0, '...nor for headway');
  // and walking on from there, the line is the new one
  for (let i = 1; i <= 20; i++) {
    inp.x = 500 + Math.sin(inp.yaw) * i * 0.1; inp.z = 3 + Math.cos(inp.yaw) * i * 0.1;
    assert.equal(steer.step(inp, open, steer.output).deflected, false, 'on the new line');
  }
  // a jump mid-detour ends the detour; nothing it covered is walked
  const det = createTravelSteer();
  const wall = (dx, dz) => (dz > 0.9 ? 3 : Infinity);
  Object.assign(det.input, { key: {}, x: 0, z: 0, tx: 0, tz: 1000, yaw: 0, goal: 990, reach: 0.15, quantum: 0.07, asked: 0 });
  det.step(det.input, wall, det.output);
  assert.equal(det.state.episode, true, 'a detour is running');
  det.input.x = 2000; det.input.yaw = calculateYaw(2000, 0, 0, 1000) * DEG;
  const landed = det.step(det.input, open, det.output);
  assert.equal(landed.stop, null, 'the journey goes on from where it landed - two kilometres are not a detour over its budget');
  assert.equal(det.state.episode, false, 'the jump ended it');
  assert.equal(det.state.walked, 0, 'and walked none of it');
  // A FRAME THE MOTOR COULD HAVE CARRIED IS A WALK: a hitching x100 frame
  // whose reach was 200 m moves the body 150 m - the line stays
  const fast = createTravelSteer();
  Object.assign(fast.input, { key: {}, x: 0, z: 0, tx: 0, tz: 5000, yaw: 0, goal: 4990, reach: 200, quantum: 7, asked: 0 });
  fast.step(fast.input, open, fast.output);
  fast.input.x = 1; fast.input.z = 150; fast.input.asked = 150;
  fast.step(fast.input, open, fast.output);
  assert.deepEqual([fast.state.ox, fast.state.oz], [0, 0], 'a walk, however fast, keeps its line');
});

// ─── the arrival buffer ─────────────────────────────────────────────────

test('TRAVEL-NAV1 THE ARRIVAL STAND-OFF: a city that fills its pixel is arrived at OUTSIDE its walls - its buffer lies wholly in the neighbours, so it is an arrival there; the mod\'s own pixel-gated arm walks into the wall', () => {
  const o = mapPixelToWorldCoords(500, 250);
  // an eight-block city: (128 - 8 * 16) / 2 = 0, its footprint IS the pixel
  const rect = { xMin: o.x, xMax: o.x + 32768, zMin: o.z, zMax: o.z + 32768 };
  const southM = o.z / SCENE_MAP_RATIO;
  const walls = [box(o.x / SCENE_MAP_RATIO, southM + 0.2, (o.x + 32768) / SCENE_MAP_RATIO, southM + 1.2)];
  const journey = ({ edgeArrival, steerOn, scale, dt }) => {
    const ap = new TravelAutopilot({ x: 500, y: 250 }, rect, 1, { grow: true, isLocation: true, edgeArrival });
    let arrived = false;
    ap.onArrival = () => { arrived = true; };
    const steer = createTravelSteer();
    const body = { x: (o.x + 16384) / SCENE_MAP_RATIO, z: southM - 120 };
    const probe = (dx, dz, lat) => {
      let t = Infinity;
      for (const b of walls) t = Math.min(t, rayHit(body.x + dz * lat, body.z - dx * lat, dx, dz, b));
      return t;
    };
    const frame = { speed: 4.4, dt, scale, asked: 0, ratio: SCENE_MAP_RATIO };
    let stop = null, touched = false, minClear = Infinity, acc = 0;
    for (let fr = 0; fr < 8000 && !arrived && !stop; fr++) {
      const wx = body.x * SCENE_MAP_RATIO, wz = body.z * SCENE_MAP_RATIO;
      const px = worldCoordToMapPixel(wx, wz);
      const drive = ap.update({ worldX: wx, worldZ: wz, mapPixelX: px.x, mapPixelY: px.y });
      if (drive.arrived) break;
      if (steerOn) stop = steerDrive(steer, drive, wx, wz, ap, frame, probe);
      if (stop) break;
      frame.asked = drive.forward * 4.4 * scale * Math.min(dt, MAX_FRAME_DT);
      acc += Math.min(dt, MAX_FRAME_DT) * scale;
      const yaw = drive.yaw * DEG;
      while (acc >= FIXED_DT * scale) {
        acc -= FIXED_DT * scale;
        let d = 4.4 * FIXED_DT * scale * drive.forward;
        while (d > 1e-9) {
          const q = Math.min(0.05, d);
          const nx = body.x + Math.sin(yaw) * q, nz = body.z + Math.cos(yaw) * q;
          if (clearance(nx, nz, walls) < 0) { touched = true; break; }
          body.x = nx; body.z = nz; d -= q;
          minClear = Math.min(minClear, clearance(body.x, body.z, walls));
        }
      }
    }
    return { arrived, stop, touched, minClear };
  };
  for (const [scale, dt] of [[1, 1 / 60], [60, 1 / 60], [100, 0.1]]) {
    const r = journey({ edgeArrival: true, steerOn: true, scale, dt });
    assert.ok(r.arrived, `x${scale}: arrived`);
    assert.equal(r.touched, false, `x${scale}: never at the wall`);
    assert.ok(r.minClear > 5, `x${scale}: well outside it (${r.minClear.toFixed(2)} m)`);
    // the mod's own: the buffer is never asked about outside the pixel, and
    // the pixel begins AT the wall - the traveller grinds there for ever
    const mod = journey({ edgeArrival: false, steerOn: false, scale, dt });
    assert.equal(mod.arrived, false, 'the mod\'s own arm never arrives');
    assert.equal(mod.touched, true, '...and walks into the wall');
    // and the steering alone, the buffer's arrival taken away: the goal is
    // reached and no arrival comes, so the way is judged on its own room -
    // the body never PARKS at the stand-off with the clock racing; it
    // stops, and says so
    const parked = journey({ edgeArrival: false, steerOn: true, scale, dt });
    assert.equal(parked.stop, 'blocked', `x${scale}: stopped, not parked (${parked.stop})`);
    assert.equal(parked.touched, false);
  }
  // the arm is plain containment, only for a rect that asks for it, only outside the destination pixel
  const ap = new TravelAutopilot({ x: 500, y: 250 }, rect, 1, { grow: true, isLocation: true, edgeArrival: true });
  let n = 0;
  ap.onArrival = () => { n++; };
  const inBuffer = { worldX: o.x + 16384, worldZ: o.z - ARRIVAL_BUFFER / 2, mapPixelX: 500, mapPixelY: 251 };
  assert.equal(ap.update(inBuffer).arrived, true, 'in the buffer, in the neighbour pixel: arrived');
  assert.equal(n, 1);
  const plain = new TravelAutopilot({ x: 500, y: 250 }, rect, 1, { grow: true, isLocation: true });
  assert.equal(plain.update(inBuffer).arrived, false, 'without it: the mod\'s own, pixel-gated');
  const far = new TravelAutopilot({ x: 500, y: 250 }, rect, 1, { grow: true, isLocation: true, edgeArrival: true });
  assert.equal(far.update({ ...inBuffer, worldZ: o.z - ARRIVAL_BUFFER - 1 }).arrived, false, 'outside the buffer: walking on');
  // and the distance the steering reads
  assert.equal(rectDistance({ xMin: 0, xMax: 10, zMin: 0, zMax: 10 }, 5, 5), 0, 'inside: nothing');
  assert.equal(rectDistance({ xMin: 0, xMax: 10, zMin: 0, zMax: 10 }, 13, 14), 5, 'a corner: 3-4-5');
  assert.equal(rectDistance({ xMin: 0, xMax: 10, zMin: 0, zMax: 10 }, -2, 5), 2, 'an edge');
});

// ─── the mod's door ─────────────────────────────────────────────────────

test('TRAVEL-NAV1 THE DOOR: steerDrive speaks metres to the steer, leaves an open road\'s drive exactly as the mod made it, and turns and caps it only when it must', () => {
  const steer = createTravelSteer();
  const ap = new TravelAutopilot({ x: 500, y: 250 }, { xMin: 0, xMax: 40, zMin: 4000, zMax: 4040 }, 1);
  const frame = { speed: 4.4, dt: 1 / 60, scale: 10, asked: 0, ratio: SCENE_MAP_RATIO };
  const open = () => Infinity;
  // a bearing whose degrees-radians round trip is NOT exact (127.39788550675681 back), so a
  // door that always wrote the steer's answer back would be caught by the last bit
  const bearing = 127.3978855067568;
  assert.notEqual(((bearing * DEG) / DEG), bearing, 'the fixture is one that does not round-trip');
  const drive = { yaw: bearing, pitch: 0, forward: 0.8, arrived: false };
  assert.equal(steerDrive(steer, drive, 20, 0, ap, frame, open), null);
  assert.equal(drive.yaw, bearing, 'the mod\'s bearing, untouched to the last bit - no degrees-radians round trip');
  assert.equal(drive.forward, 0.8, 'and its force (the cautious 0.8), whole');
  const inp = steer.input;
  assert.equal(inp.x, 20 / SCENE_MAP_RATIO, 'world units over the ratio: metres');
  assert.equal(inp.tx, ap.destinationCentre.x / SCENE_MAP_RATIO);
  assert.equal(inp.goal, (4000 - 0) / SCENE_MAP_RATIO, 'the distance to the arrival rect');
  assert.equal(inp.reach, travelFrameReach(4.4, 1 / 60, 10) * 0.8, 'the reach at the drive\'s own force');
  // a wall three metres ahead of a frame that would carry the body ten
  const wall = (dx, dz) => (dz > 0.99 ? 3 : Infinity);
  const d2 = { yaw: 0, pitch: 0, forward: 1, arrived: false };
  const fast = { ...frame, scale: 60, dt: 0.1 };
  steerDrive(createTravelSteer(), d2, 20, 0, new TravelAutopilot({ x: 500, y: 250 }, { xMin: -20, xMax: 60, zMin: 40000, zMax: 40040 }, 1), fast, wall);
  assert.notEqual(d2.yaw, 0, 'turned off a way that is not open');
  assert.ok(d2.forward > 0 && d2.forward <= 1);
});

/** A travel rig on the mod's own shape (roadcrash.test.js's), its host's
 *  onClose wired as world.js wires it, and a `steer` the test writes. */
function rig(steer, over = {}, { panelInterrupts = true } = {}) {
  const net = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' };
  const o = mapPixelWorldOrigin(500, 250);
  const state = { pos: { x: o.x + 16384, z: o.z + 16384 }, pixel: { x: 500, y: 250 }, yaw: 90, location: null };
  const boxed = [], said = [];
  let to = null;
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: panelInterrupts ? () => to?.interruptTravel() : undefined });
  const settings = { ...readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key))), ...over };
  to = createTravelOptions({
    settings, ui,
    roads: () => net,
    worldPos: () => state.pos,
    mapPixel: () => state.pixel,
    yaw: () => state.yaw,
    setFacing: (y) => { state.yaw = y; },
    currentLocation: () => state.location,
    hasCurrentLocation: () => !!state.location,
    localizedCurrentLocationName: () => '',
    localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231,
    entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => false,
    diseaseCount: () => 0,
    say: (l) => said.push(l),
    messageBox: (l) => boxed.push(l),
    setTimeScale: () => {},
    now: () => 0,
    worldTimeNow: () => 0,
    pushWindow: (w) => w.show(),
    locationWorldRect: (s) => { const q = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return { xMin: q.x + 16000, xMax: q.x + 16768, zMin: q.z + 16000, zMax: q.z + 16768 }; },
    locationTileRect: () => null,
    steer,
  });
  return { to, ui, net, state, boxed, said };
}
const FRAME = { topWindowIsTravelUI: true, isPlayerOnHUD: false };

test('TRAVEL-NAV1 THE STOP: a way the steering cannot find ends the journey in the mod\'s own manner - the panel closed, the destination KEPT for the resume, the port\'s words in a box, and nothing moved', () => {
  _resetModSettings();
  for (const [why, words] of [['blocked', TRAVEL_NAV_TEXT.MsgBlocked], ['stuck', TRAVEL_NAV_TEXT.MsgStuck]]) {
    let asked = 0;
    const r = rig((drive) => { asked++; drive.forward = 0; return why; });
    r.to.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, false);
    const report = r.to.update(FRAME);
    assert.equal(asked, 1, 'the steering is asked, once, last');
    assert.equal(report.stopped, why);
    assert.equal(report.drive.forward, 0, 'the frame that stops it moves nothing');
    assert.equal(r.ui.isShowing, false, 'the panel is down');
    assert.equal(r.to.state.autopilot, null, 'the journey is over');
    assert.equal(r.to.destinationName, 'Daggerfall', 'and the destination stays, for the map\'s resume prompt (InterruptTravel, :1273)');
    assert.deepEqual(r.boxed, [words], 'the port\'s own words, in the mod\'s message box');
  }
  // a host whose panel does not interrupt is stopped outright (ROAD-CRASH's guard)
  const bare = rig(() => 'blocked', {}, { panelInterrupts: false });
  bare.to.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, false);
  assert.equal(bare.to.update(FRAME).stopped, 'blocked');
  assert.equal(bare.to.state.autopilot, null, 'no panel to do it: the journey is stopped here');
  // the words are the port's, kept OUT of the mod's CSV table
  for (const v of Object.values(TRAVEL_NAV_TEXT)) {
    assert.ok(!Object.values(TRAVEL_OPTIONS_TEXT).includes(v), 'not in the mod\'s table');
    assert.match(v, /^Paused the journey since /, 'in the mod\'s voice (MsgNearLocation\'s sentence)');
  }
  // an open way: the journey runs on
  const open = rig(() => null);
  open.to.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, false);
  assert.equal(open.to.update(FRAME).stopped, undefined);
  assert.equal(open.ui.isShowing, true);
  // THE SWITCH OFF: the mod's own beeline - the steering is never asked
  let never = 0;
  const off = rig(() => { never++; return 'blocked'; }, { avoidObstacles: false });
  off.to.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, false);
  off.to.update(FRAME);
  assert.equal(never, 0, 'off is the mod\'s own journey');
  assert.equal(off.ui.isShowing, true);
  assert.equal(off.to.state.autopilot.edgeArrival, false, '...and its own pixel-gated arrival');
  const on = rig(() => null);
  on.to.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, false);
  assert.equal(on.to.state.autopilot.edgeArrival, true, 'on: the buffer is an arrival wherever it lies');
});

test('TRAVEL-NAV1 THE FACING THE MOD READS: a leg that arrives while the steering has the body turned picks its next edge by the BEARING, not the turned camera', () => {
  _resetModSettings();
  // the steering has turned the body 150 degrees left - backing out of a pocket
  const r = rig((drive) => { drive.yaw -= 150; return null; });
  const at = (x, y) => x + y * 1000;
  r.net.roads[at(500, 250)] = E | W;
  r.net.roads[at(501, 250)] = E | W;
  r.state.yaw = 90;
  assert.equal(r.to.followPath(), true, 'a leg east');
  const report = r.to.update(FRAME);
  r.state.yaw = report.drive.yaw;   // the host writes the drive to the camera (world.js cam.yaw)
  assert.equal(r.state.yaw, r.to.state.autopilot.yaw - 150, 'the camera is turned');
  assert.equal(r.to.state.steeredBy, r.to.state.autopilot, 'and the mod knows it was');
  // the leg arrives at a two-way pixel: carry straight on - EAST
  r.state.pixel = { x: 501, y: 250 };
  r.to.selectNextPath();
  assert.equal(r.ui.isShowing, true, 'carried on');
  assert.equal(r.to.state.autopilot.destinationMapPixel.x, 502, 'east, the way the road runs - the turned camera (NW) would have sent it back west');
  // and with nothing turned, the camera is read as it always was
  const plain = rig(() => null);
  plain.net.roads[at(500, 250)] = E | W;
  plain.state.yaw = 90;
  plain.to.followPath();
  plain.to.update(FRAME);
  assert.equal(plain.to.state.steeredBy, null, 'an open road leaves the facing to the camera');
});

// ─── the feelers, through a real collider ───────────────────────────────

/** A box mesh for the collider: 8 corners, 12 triangles. */
function boxMesh(x0, y0, z0, x1, y1, z1) {
  const p = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  const i = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]);
  return { p, i };
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

test('TRAVEL-NAV1 THE FEELERS ARE THE COLLIDER\'S: a wall is met at its distance, a ramp is walked on, a house on a rise is met at its wall where a level ray passes under it, and every feeler reuses one origin, one direction and one hit', () => {
  const feet = [0, 0, 0];
  // a wall ten metres ahead, two to the side of it clear
  const flat = new Collider(() => 0);
  const w = boxMesh(-3, 0, 10, 3, 3, 11);
  flat.addMesh('wall', w.p, w.i, IDENTITY);
  const probe = createColliderProbe({ collider: flat, feet: () => feet });
  assert.ok(Math.abs(probe(0, 1, 0, 24) - 10) < 1e-6, 'straight at it: ten metres');
  assert.ok(Math.abs(probe(0, 1, 2.5, 24) - 10) < 1e-6, 'a feeler 2.5 m to the right starts 2.5 m to the right, still on it');
  assert.equal(probe(0, 1, 3.5, 24), Infinity, '3.5 m right is past its end');
  assert.equal(probe(0, 1, 0, 8), Infinity, 'and no further than asked');
  assert.equal(FEELER_HEIGHT, STEP_OFFSET + 0.1, 'over a step the motor climbs');
  // a sill lower than the step offset is under the feelers; one above it is not
  const low = new Collider(() => 0);
  const s1 = boxMesh(-3, 0, 5, 3, STEP_OFFSET - 0.05, 6);
  low.addMesh('sill', s1.p, s1.i, IDENTITY);
  assert.equal(createColliderProbe({ collider: low, feet: () => feet })(0, 1, 0, 24), Infinity, 'a step is walked up');
  // a RAMP: a face flatter than the slope limit is ground
  const ramp = new Collider(() => 0);
  const rise = Math.tan(20 * DEG) * 10;
  ramp.addMesh('ramp', new Float32Array([-5, 0, 5, 5, 0, 5, 5, rise, 15, -5, rise, 15]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
  assert.equal(createColliderProbe({ collider: ramp, feet: () => feet })(0, 1, 0, 24), Infinity, 'a 20 degree ramp is walked on');
  assert.equal(WALKABLE_NY, Math.cos(SLOPE_LIMIT_DEG * DEG), 'the collider\'s own slope limit');
  // A HOUSE ON A RISE. The terrain is not in the collider's buckets, so a
  // level feeler runs into the hill and under the house; the feelers ride
  // the ground in legs and meet its wall
  const hill = new Collider((x, z) => 0.3 * z);
  const house = boxMesh(-4, 6, 20, 4, 9, 24);
  hill.addMesh('house', house.p, house.i, IDENTITY);
  assert.equal(hill.raycast([0, FEELER_HEIGHT, 0], [0, 0, 1], 30), Infinity, 'a level ray passes under it');
  const up = createColliderProbe({ collider: hill, feet: () => feet })(0, 1, 0, 30);
  assert.ok(up > 19 && up < 21, `the feelers meet it (${up.toFixed(2)})`);
  // ...and a body stood on a structure keeps its feelers level
  const deck = [0, 5, 0];
  const raised = new Collider(() => 0);
  const rw = boxMesh(-3, 4, 12, 3, 8, 13);
  raised.addMesh('rail', rw.p, rw.i, IDENTITY);
  assert.ok(Math.abs(createColliderProbe({ collider: raised, feet: () => deck })(0, 1, 0, 24) - 12) < 1e-6, 'on a deck: level from the feet');
  // THE SCRATCH IS THE PROBE'S OWN - one origin, one direction, one hit,
  // every leg of every feeler
  const seen = { o: new Set(), d: new Set(), out: new Set(), calls: 0 };
  const spy = { heightAt: () => 0, raycastHit(o, d, max, filter, out) { seen.o.add(o); seen.d.add(d); seen.out.add(out); seen.calls++; out.dist = Infinity; out.key = null; out.normal[0] = 0; out.normal[1] = 0; out.normal[2] = 0; return out; } };
  const sp = createColliderProbe({ collider: spy, feet: () => feet });
  for (let k = 0; k < 5; k++) sp(Math.sin(k), Math.cos(k), k - 2, 40);
  assert.ok(seen.calls >= 25, 'legs of eight metres');
  assert.equal(seen.o.size, 1); assert.equal(seen.d.size, 1); assert.equal(seen.out.size, 1);
});

test('TRAVEL-NAV2 A FACE THAT IS WALKED ON HIDES NOTHING: a wall at a ramp\'s head, a deck\'s rail and a wall behind a face met from beneath are all seen - a deck the ramp leads onto is not read as a wall from inside it - and the ride is bounded and follows the ground again after', () => {
  const feet = [0, 0, 0];
  const probeOver = (c) => createColliderProbe({ collider: c, feet: () => feet });
  const wedgeTris = new Uint32Array([0, 1, 2, 0, 2, 3, 0, 4, 5, 0, 5, 1, 4, 3, 2, 4, 2, 5, 0, 3, 4, 1, 5, 2]);
  // A WALL AT THE RAMP'S HEAD, inside the first eight-metre leg: the
  // feeler meets the ramp at ~2 m, and used to give up the rest of the leg
  const r1 = new Collider(() => 0);
  const rise = Math.tan(20 * DEG) * 4.5;
  r1.addMesh('ramp', new Float32Array([-5, 0, 0.5, 5, 0, 0.5, 5, rise, 5, -5, rise, 5]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
  const w1 = boxMesh(-5, 0, 6, 5, 4, 7);
  r1.addMesh('wall', w1.p, w1.i, IDENTITY);
  assert.ok(Math.abs(probeOver(r1)(0, 1, 0, 24) - 6) < 1e-4, `the wall at 6 m is seen past the ramp (${probeOver(r1)(0, 1, 0, 24)})`);
  // A CLOSED WEDGE onto a DECK longer than a leg: the next leg used to
  // start back at the ground's height, INSIDE the deck, and read its far
  // side from within as a wall 30 m out
  const h = Math.tan(20 * DEG) * 4;
  const wedge = new Float32Array([-3, 0, 2, 3, 0, 2, 3, h, 6, -3, h, 6, -3, 0, 6, 3, 0, 6]);
  const deck = boxMesh(-3, 0, 6, 3, h, 30);
  const d1 = new Collider(() => 0);
  d1.addMesh('wedge', wedge, wedgeTris, IDENTITY);
  d1.addMesh('deck', deck.p, deck.i, IDENTITY);
  assert.equal(probeOver(d1)(0, 1, 0, 40), Infinity, 'up the ramp and along the deck: nothing in the way');
  const rail = boxMesh(-3, h, 20, 3, h + 3, 21);
  d1.addMesh('rail', rail.p, rail.i, IDENTITY);
  assert.ok(Math.abs(probeOver(d1)(0, 1, 0, 40) - 20) < 1e-4, `a wall ON the deck is met where it stands (${probeOver(d1)(0, 1, 0, 40)})`);
  // A FACE MET FROM BENEATH: rising ground carries the feeler up through a
  // slab's underside; a wall standing on the slab in the same leg is seen
  const u1 = new Collider((x, z) => 0.25 * z);
  u1.addMesh('slab', new Float32Array([-5, 1.5, 2, 5, 1.5, 2, 5, 1.5, 12, -5, 1.5, 12]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
  const w2 = boxMesh(-5, 1.5, 6, 5, 5, 7);
  u1.addMesh('wall', w2.p, w2.i, IDENTITY);
  assert.ok(Math.abs(probeOver(u1)(0, 1, 0, 24) - 6) < 1e-4, `the wall behind the underside at 6 m (${probeOver(u1)(0, 1, 0, 24)})`);
  // ...and it is gone on under, along the same line - not RIDDEN (nothing
  // walks on an underside): a low block on the slab is met where the line
  // meets it, which a feeler lifted over the underside would pass above
  const u2 = new Collider((x, z) => 0.25 * z);
  u2.addMesh('slab', new Float32Array([-5, 1.5, 2, 5, 1.5, 2, 5, 1.5, 12, -5, 1.5, 12]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
  const low = boxMesh(-5, 1.5, 5, 5, 2.0, 5.5);
  u2.addMesh('low', low.p, low.i, IDENTITY);
  assert.ok(Math.abs(probeOver(u2)(0, 1, 0, 24) - 5) < 1e-4, `the low block on the slab at 5 m (${probeOver(u2)(0, 1, 0, 24)})`);
  // THE RIDE IS NOT STICKY: over a mound and down again, the next leg
  // comes back to the ground and meets a fence a metre high in the dip
  const m1 = new Collider(() => 0);
  const mh = Math.tan(20 * DEG) * 4;
  m1.addMesh('mound', new Float32Array([-5, 0, 2, 5, 0, 2, 5, mh, 6, -5, mh, 6, -5, mh, 8, 5, mh, 8]), new Uint32Array([0, 1, 2, 0, 2, 3, 3, 2, 5, 3, 5, 4]), IDENTITY);
  const fence = boxMesh(-5, 0, 15, 5, 1, 15.2);
  m1.addMesh('fence', fence.p, fence.i, IDENTITY);
  assert.ok(Math.abs(probeOver(m1)(0, 1, 0, 24) - 15) < 1e-4, `the fence past the mound (${probeOver(m1)(0, 1, 0, 24)})`);
  // BOUNDED: a collider that answers a walkable face at every cast is
  // asked at most FEELER_RIDES + 1 times a leg
  assert.equal(STEER.FEELER_RIDES, 4, 'four faces a leg');
  let calls = 0;
  const floors = { heightAt: () => 0, raycastHit(o, dd, max, filter, out) { calls++; out.dist = Math.min(0.5, max); out.key = 'f'; out.normal[0] = 0; out.normal[1] = 1; out.normal[2] = 0; return out; } };
  assert.equal(probeOver(floors)(0, 1, 0, 16), Infinity, 'faces to walk on, all the way');
  assert.ok(calls <= 2 * (STEER.FEELER_RIDES + 1), `two legs, ${calls} casts`);
});

test('TRAVEL-NAV1 raycastHit\'s `out`: the caller\'s own result, written and returned in place - the normal into the caller\'s array - and without it the answer it always was', () => {
  const c = new Collider(() => -Infinity);
  const w = boxMesh(-3, 0, 10, 3, 3, 11);
  c.addMesh('wall', w.p, w.i, IDENTITY);
  const n = [9, 9, 9];
  const out = { dist: 0, key: 'stale', normal: n };
  const r = c.raycastHit([0, 1, 0], [0, 0, 1], 50, null, out);
  assert.equal(r, out, 'the same object back');
  assert.equal(out.normal, n, 'the same array in it');
  assert.ok(Math.abs(out.dist - 10) < 1e-6);
  assert.equal(out.key, 'wall');
  assert.deepEqual([...n].map((v) => Math.round(v * 1e6) / 1e6 + 0), [0, 0, -1], 'facing the ray');
  const miss = c.raycastHit([0, 1, 0], [0, 0, -1], 50, null, out);
  assert.equal(miss, out);
  assert.equal(out.dist, Infinity); assert.equal(out.key, null);
  assert.deepEqual(n, [0, 0, 0], 'a miss writes no normal');
  const fresh = c.raycastHit([0, 1, 0], [0, 0, 1], 50);
  assert.notEqual(fresh, out, 'no out: a fresh result, as ever');
  assert.ok(Math.abs(fresh.dist - 10) < 1e-6);
  assert.equal(c.raycastHit([0, 1, 0], [0, 0, -1], 50).normal, null, '...with no normal on a miss');
});

// ─── the switch and the host ────────────────────────────────────────────

test('TRAVEL-NAV1 THE SWITCH: the port\'s own key on the mod\'s pane - on by default, saying it is the port\'s, on the tile, read into the settings; the vendored modsettings.json does not carry it', () => {
  const KEY = 'GeneralOptions.AvoidObstacles';
  const def = MOD_SETTINGS['travel-options'].keys[KEY];
  assert.ok(def, 'declared');
  assert.equal(def.default, true, 'ON - the improvement Mac asked for is the default');
  assert.equal(typeof def.default, 'boolean', 'a toggle');
  assert.match(def.description, /port’s own switch - the mod has none/);
  const shipped = JSON.parse(read('vendor/travel-options/modsettings.json'));
  assert.ok(!shipped.Sections.flatMap((s) => s.Keys.map((k) => `${s.Name}.${k.Name}`)).includes(KEY), 'the author\'s file is untouched');
  assert.ok(MOD_CURATED['travel-options'].includes(KEY) && modDials('travel-options').includes(KEY), 'reachable: on the tile');
  _resetModSettings();
  assert.equal(readTravelOptionsSettings().avoidObstacles, true, 'the shipped store: on');
});

test('TRAVEL-NAV1 THE HOST: the steering rides the mod\'s own frame with THIS host\'s collider, the frame\'s dt before the update, and the motor\'s real travel after it', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /import \{ createTravelSteer, createColliderProbe, steerDrive \} from '\.\.\/systems\/travelSteer\.js';/);
  assert.match(w, /const travelNavProbe = createColliderProbe\(\{ collider, feet: \(\) => \(walkMode && playerSpawned \? player\.pos : cam\.pos\) \}\);/,
    'the feelers are cast through the host\'s own collider, from the feet the motor moves');
  assert.match(w, /const travelNavFrame = \{ speed: 0, dt: 0, scale: 1, asked: 0, ratio: SCENE_MAP_RATIO \};/);
  assert.match(w, /steer: \(drive, worldX, worldZ, autopilot\) => \{\s*\n\s*travelNavFrame\.speed = player\.speed;\s*\n\s*travelNavFrame\.scale = worldTimeScale\(\);\s*\n\s*return steerDrive\(travelNav, drive, worldX, worldZ, autopilot, travelNavFrame, travelNavProbe\);/,
    'the mod\'s door, with the speed and the clock read live');
  const dtAt = w.indexOf('travelNavFrame.dt = dt;');
  const updAt = w.indexOf('const report = travelOptions.update({');
  assert.ok(dtAt > 0 && dtAt < updAt && updAt - dtAt < 200, 'the frame\'s dt, just before the mod\'s update');
  const motorAt = w.indexOf('}, cam.yaw, cam.pitch);', updAt);
  const askedAt = w.indexOf('travelNavFrame.asked = _travelDrive && !_overlayHeld && !_seasonHeld && !paralyzed', updAt);
  assert.ok(motorAt > 0 && askedAt > motorAt && askedAt - motorAt < 400, 'the travel really asked, written after the motor ran');
  assert.match(w, /\? axes\.forward \* player\.speed \* worldTimeScale\(\) \* Math\.min\(dt, MAX_FRAME_DT\) : 0;/, 'after the ground gate wrote axes.forward');
});
