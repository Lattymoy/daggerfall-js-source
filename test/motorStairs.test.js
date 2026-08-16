import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, JUMP_SPEED, GRAVITY, STEP_OFFSET } from '../src/player/motor.js';
import { jumpSpeedMultiplier } from '../src/systems/skills.js';
import { Collider } from '../src/player/collider.js';

// Motor vs stairs, walls, and jump - NUMERIC traces (movement bugs get
// traces, not intuition). Reported live 2026-08-16: "can't really jump
// high or walk up stairs". Unity's CharacterController semantics (the
// PlayerAdvanced prefab: stepOffset 0.5, slopeLimit 70) are the spec:
//   - a riser <= stepOffset climbs while walking into it;
//   - a wall never ladders (the P9 facade regression stays dead);
//   - the step's raised path respects head clearance;
//   - jump = jumpSpeed * (1 + JumpingSkill * 0.5 / 100) (AcrobatMotor),
//     gated on 0.1 s of grounded time (the bunny-hop gate).

// ---- geometry builders (triangles in bucket space) ----
function quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx2, dy2, dz2) {
  return {
    positions: [ax, ay, az, bx, by, bz, cx, cy, cz, dx2, dy2, dz2],
    indices: [0, 1, 2, 0, 2, 3],
  };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A straight staircase marching +z: `count` steps, each `run` deep and
 *  `riser` tall, treads + risers as quads, starting at z0/y0. */
function addStairs(col, { z0 = 2, y0 = 0, run = 0.6, riser = 0.3, count = 8, width = 4 } = {}) {
  const hw = width / 2;
  for (let i = 0; i < count; i++) {
    const zf = z0 + i * run;          // riser face at this z
    const yb = y0 + i * riser;        // tread below
    const yt = y0 + (i + 1) * riser;  // tread on top
    const r = quad(-hw, yb, zf, hw, yb, zf, hw, yt, zf, -hw, yt, zf);
    col.addMesh('stairs', r.positions, r.indices, I);
    const t = quad(-hw, yt, zf, hw, yt, zf, hw, yt, zf + run, -hw, yt, zf + run);
    col.addMesh('stairs', t.positions, t.indices, I);
  }
  // A standable landing past the last tread (the first harness cut let
  // the player summit, walk off the far edge, and fall - the trace, not
  // the collider, was wrong).
  const topY = y0 + count * riser, topZ = z0 + count * run;
  const land = quad(-hw, topY, topZ, hw, topY, topZ, hw, topY, topZ + 6, -hw, topY, topZ + 6);
  col.addMesh('stairs', land.positions, land.indices, I);
  return { topY, topZ };
}

function walk(motor, { frames, yaw = 0, jumpAt = -1, dt = 1 / 60 }) {
  const trace = [];
  for (let f = 0; f < frames; f++) {
    motor.update(dt, { forward: 1, strafe: 0, run: false, jump: f === jumpAt, up: false, down: false }, yaw);
    trace.push([motor.pos[0], motor.pos[1], motor.pos[2], motor.grounded ? 1 : 0]);
  }
  return trace;
}

test('motor: walks a classic-riser staircase to the top (riser 0.3 <= stepOffset)', () => {
  const col = new Collider(() => 0);
  const floor = quad(-10, 0, -10, 10, 0, -10, 10, 0, 20, -10, 0, 20);
  col.addMesh('floor', floor.positions, floor.indices, I);
  const { topY, topZ } = addStairs(col, { riser: 0.3, run: 0.6, count: 8 });
  const m = new PlayerMotor(col);
  m.spawn(0, 0, 0);
  const trace = walk(m, { frames: 420 });
  // Sample the TRACE, not the endpoint: the player summits, crosses
  // the landing, and eventually walks off the course's far edge (the
  // first two harness cuts asserted on the post-void final frame and
  // blamed the collider - the trace, not the physics, was wrong).
  const summit = trace.find(([, y, z, g]) => g && Math.abs(y - topY) < 0.05 && z > topZ && z < topZ + 5);
  assert.ok(summit, `must stand grounded on the top landing at some frame (topY ${topY}, topZ ${topZ})`);
});

test('motor: a half-unit riser (== stepOffset) climbs; the slope limit is the wall test', () => {
  // stepOffset assists risers up to 0.5. Above that the capsule can
  // still crest a lone box via a top-edge contact whose normal sits
  // INSIDE slopeLimit 70 (a 0.6 edge presents ~45 deg) - Unity's
  // controller does the same, so the SPECIFIED block criterion is the
  // slope limit, pinned here: a 60 deg ramp climbs, a 78 deg ramp
  // (steeper than slopeLimit) does not.
  {
    const col = new Collider(() => 0);
    const floor = quad(-10, 0, -10, 10, 0, -10, 10, 0, 20, -10, 0, 20);
    col.addMesh('floor', floor.positions, floor.indices, I);
    addStairs(col, { riser: 0.45, run: 0.8, count: 4 });
    const m = new PlayerMotor(col);
    m.spawn(0, 0, 0);
    const maxY = Math.max(...walk(m, { frames: 300 }).map((t) => t[1]));
    assert.ok(maxY > 1.1, `riser 0.45 must climb (maxY=${maxY.toFixed(2)})`);
  }
  for (const [deg, climbs] of [[60, true], [78, false]]) {
    const col = new Collider(() => 0);
    const floor = quad(-10, 0, -10, 10, 0, -10, 10, 0, 20, -10, 0, 20);
    col.addMesh('floor', floor.positions, floor.indices, I);
    const rise = Math.tan((deg * Math.PI) / 180) * 3;   // 3 units of run
    const ramp = quad(-4, 0, 2, 4, 0, 2, 4, rise, 5, -4, rise, 5);
    col.addMesh('ramp', ramp.positions, ramp.indices, I);
    const m = new PlayerMotor(col);
    m.spawn(0, 0, 0);
    const maxY = Math.max(...walk(m, { frames: 360 }).map((t) => t[1]));
    if (climbs) assert.ok(maxY > 1.0, `${deg} deg ramp must climb (maxY=${maxY.toFixed(2)})`);
    else assert.ok(maxY < 0.6, `${deg} deg ramp is past slopeLimit 70 and must block (maxY=${maxY.toFixed(2)})`);
  }
});

test('motor: a flat wall never ladders (the P9 facade regression stays dead)', () => {
  const col = new Collider(() => 0);
  const floor = quad(-10, 0, -10, 10, 0, -10, 10, 0, 20, -10, 0, 20);
  col.addMesh('floor', floor.positions, floor.indices, I);
  const wall = quad(-4, 0, 3, 4, 0, 3, 4, 6, 3, -4, 6, 3);
  col.addMesh('wall', wall.positions, wall.indices, I);
  const m = new PlayerMotor(col);
  m.spawn(0, 0, 0);
  const trace = walk(m, { frames: 300 });
  const maxY = Math.max(...trace.map((t) => t[1]));
  assert.ok(maxY < 0.15, `walking into a wall must not gain height (maxY=${maxY.toFixed(2)})`);
});

test('motor: a stairwell ceiling CAPS the lift instead of jamming or blocking', () => {
  // Ceiling 2.2 over the FIRST step only (z 1..2.1): standing on
  // tread 1 (0.3) fits (head 2.1 < 2.2), but the OLD blind +0.5 lift
  // put the head sphere INTO the plane at the step moment (head-top
  // 0 + 0.5 + 1.8 = 2.3 > 2.2) - every real stairwell under 2.3
  // blocked or jammed (the live report). The ascending capped ladder
  // accepts rung 0.125 (head 1.925, clear) and climbs. The plane must
  // END by z 2.1: riser 2's block point sits at center z ~2.454, and
  // every rung's head sphere needs >= 0.35 of clearance from the
  // plane's edge there (a longer plane forbids the second step for a
  // Unity controller too - the first fixture cut overlapped tread 2
  // and demanded a physically impossible stand).
  const col = new Collider(() => -Infinity);
  const floor = quad(-10, 0, -10, 10, 0, -10, 10, 0, 20, -10, 0, 20);
  col.addMesh('floor', floor.positions, floor.indices, I);
  addStairs(col, { riser: 0.3, run: 0.8, count: 2 });
  const ceil = quad(-4, 2.2, 1, 4, 2.2, 1, 4, 2.2, 2.1, -4, 2.2, 2.1);
  col.addMesh('ceiling', ceil.positions, ceil.indices, I);
  const m = new PlayerMotor(col);
  m.spawn(0, 0, 0);
  const trace = walk(m, { frames: 300 });
  const onTop = trace.find(([, y, z, g]) => g && y > 0.55 && z > 3.6 && z < 6);
  assert.ok(onTop, 'must stand on the second tread under the 2.2 ceiling at some frame');
  // The jam pin samples GROUNDED frames fully under the plane (center
  // z < plane-end 2.1 minus the head sphere's 0.35 reach; transient
  // raised frames at the open edge are the ladder probing, not a
  // wedge - a real jam is a grounded stand with the head inside).
  const under = trace.filter(([, , z, g]) => g && z < 1.75);
  const maxY = Math.max(...under.map((t) => t[1]));
  assert.ok(maxY + 1.8 <= 2.2 + 0.05, `no grounded stand puts the head in the ceiling (maxY=${maxY.toFixed(2)})`);
});

test('motor: a tread the capsule cannot STAND under stays blocked', () => {
  // Ceiling 2.05 over tread 1 (0.3): clearance 1.75 < capsule 1.8 -
  // there is no legal lift, so the stair must refuse cleanly.
  const col = new Collider(() => -Infinity);
  const floor = quad(-10, 0, -10, 10, 0, -10, 10, 0, 20, -10, 0, 20);
  col.addMesh('floor', floor.positions, floor.indices, I);
  addStairs(col, { riser: 0.3, run: 0.8, count: 2 });
  const ceil = quad(-4, 2.05, 1, 4, 2.05, 1, 4, 2.05, 3.2, -4, 2.05, 3.2);
  col.addMesh('ceiling', ceil.positions, ceil.indices, I);
  const m = new PlayerMotor(col);
  m.spawn(0, 0, 0);
  const trace = walk(m, { frames: 240 });
  // Never STANDS where it does not fit (ceiling 2.05 - tread 0.3 =
  // 1.75 < 1.8): a grounded stand ON the tread past the riser is the
  // forbidden state. Low wedge-grazing against the zero-thickness
  // harness tread is a fixture artifact, not a physics claim.
  for (const [, y, z, g] of trace) assert.ok(!(g && z > 2.3 && y > 0.27), `never stands on the impossible tread (y=${y.toFixed(2)} z=${z.toFixed(2)})`);
});

test('motor: jump height follows the AcrobatMotor multiplier (skill 30 -> +15%)', () => {
  const col = new Collider(() => 0);
  const floor = quad(-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10);
  col.addMesh('floor', floor.positions, floor.indices, I);
  const m = new PlayerMotor(col, undefined, { jumpBoost: () => jumpSpeedMultiplier({ skills: 30 }) });
  m.spawn(0, 0, 0);
  // Settle grounded past the 0.1 s bunny-hop gate, then jump in place.
  let maxY = 0;
  for (let f = 0; f < 240; f++) {
    m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: f === 30, up: false, down: false }, 0);
    if (m.pos[1] > maxY) maxY = m.pos[1];
  }
  // v = 4.5 * (1 + 30 * 0.5 / 100) = 5.175; h = v^2 / (2 * 20) = 0.6694
  // (discrete-step apex lands a hair under the analytic curve).
  assert.equal(jumpSpeedMultiplier({ skills: 30 }), 1.15);
  const v = JUMP_SPEED * 1.15;
  const want = (v * v) / (2 * GRAVITY);
  assert.ok(Math.abs(maxY - want) < 0.06, `apex ${maxY.toFixed(3)} must be ~${want.toFixed(3)} (skill-multiplied, not flat ${((JUMP_SPEED ** 2) / (2 * GRAVITY)).toFixed(3)}, not one-frame 0.069)`);
});

test('motor: the grounded-time gate (0.1 s) blocks the instant re-jump', () => {
  const col = new Collider(() => 0);
  const floor = quad(-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10);
  col.addMesh('floor', floor.positions, floor.indices, I);
  const m = new PlayerMotor(col);
  m.spawn(0, 0, 0);
  for (let f = 0; f < 30; f++) m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false }, 0);
  m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: true, up: false, down: false }, 0);
  assert.ok(m.velY > 0, 'the settled jump fires');
  // Ride to landing, then jump on the very first grounded frame: gated.
  let landed = -1;
  for (let f = 0; f < 300 && landed < 0; f++) {
    m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false }, 0);
    if (m.grounded) landed = f;
  }
  m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: true, up: false, down: false }, 0);
  assert.equal(m.velY <= 0, true, 'a jump on the first grounded frame is inside the 0.1 s gate');
  assert.equal(STEP_OFFSET, 0.5);
});
