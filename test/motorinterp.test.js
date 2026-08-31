// EV1 - THE JUDDER FIX. The motor steps at a fixed 1/60 (the
// mobile-hotfix accumulator, motor.js) while the look filter, bob and
// nod advance at render rate - so a camera reading the raw stepped
// eye translated in quanta under a smooth rotation. eyeAt(alpha)
// lerps between the last two physics steps, read-side only: no step,
// no flag, no law of the simulation changes, which is why the
// fixed-step pins (audit18_player, motorStairs, enemymotor) needed no
// edits. These pin the interpolation's own laws:
//
//   - alpha is the accumulator's leftover over FIXED_DT, clamped;
//   - the span is per-STEP (a zero-step frame keeps the last real
//     span and only advances alpha - the 120Hz case the fix exists
//     for);
//   - eyeAt(1) is eye's own math; eye itself is untouched (rays,
//     audio and probes still read the simulation's truth);
//   - offsetOrigin shifts BOTH ends, so a floating-origin recenter
//     never lerps the camera across 819.2 units;
//   - a PLACED position (teleport, load) snaps - the guard, not a
//     one-frame sweep through the world;
//   - footsteps.rebase re-seeds the stride anchor so a recenter is
//     not 819.2 units of walking.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, FIXED_DT } from '../src/player/motor.js';
import { FootstepMachine } from '../src/systems/footsteps.js';
import { Collider } from '../src/player/collider.js';

const IDLE = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };

/** motorStairs' own floored() shape: a real collider with one floor
 *  quad, so the motor falls onto ground instead of forever. */
function walker(y = 10) {
  const col = new Collider(() => 0);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  col.addMesh('floor', [-50, 0, -50, 50, 0, -50, 50, 0, 50, -50, 0, 50], [0, 1, 2, 0, 2, 3], I);
  const m = new PlayerMotor(col);
  m.spawn(0, y, 0);
  return m;
}

test('EV1: alpha is the leftover accumulator, and a half-step frame runs no step', () => {
  const m = walker();
  const y0 = m.pos[1];
  m.update(FIXED_DT / 2, IDLE, 0);
  assert.equal(m.pos[1], y0, 'no step ran');
  assert.ok(Math.abs(m._alpha - 0.5) < 1e-9, `alpha ${m._alpha}`);
  m.update(FIXED_DT / 2, IDLE, 0);
  assert.ok(m._alpha < 1e-9, 'the second half completes exactly one step, leftover 0');
  assert.notEqual(m.pos[1], y0, 'gravity stepped once');
});

test('EV1: eyeAt lerps the last STEP span; a zero-step frame keeps the span and advances alpha', () => {
  const m = walker();
  // two full steps so prev/pos hold a real gravity span
  m.update(FIXED_DT, IDLE, 0);
  const afterOne = m.pos[1];
  m.update(FIXED_DT, IDLE, 0);
  const afterTwo = m.pos[1];
  const span = afterTwo - afterOne;
  assert.ok(span !== 0, 'gravity moves the span');
  assert.ok(Math.abs(m._prevPos[1] - afterOne) < 1e-6, 'prev is the span start');
  // a zero-step frame: pos unchanged, alpha advances, the eye keeps moving
  const eyeLow = m.eyeAt(0)[1];
  m.update(FIXED_DT / 4, IDLE, 0);
  assert.equal(m.pos[1], afterTwo, 'no step ran');
  const eyeQuarter = m.eyeAt()[1];
  assert.ok(Math.abs((eyeQuarter - eyeLow) - span * 0.25) < 1e-6,
    'the eye advanced a quarter of the span with no step');
  // and eyeAt(1) is eye's own answer
  const e1 = m.eyeAt(1), e = m.eye;
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(e1[i] - e[i]) < 1e-9, `eyeAt(1)[${i}] === eye`);
});

test('EV1: eye itself is untouched - the simulation truth, bob and all', () => {
  const m = walker();
  m.update(FIXED_DT, IDLE, 0);
  m.bobOffset = [0.1, 0.2, 0.3];
  const e = m.eye;
  assert.ok(Math.abs(e[0] - (m.pos[0] + 0.1)) < 1e-9);
  assert.ok(Math.abs(e[2] - (m.pos[2] + 0.3)) < 1e-9);
  // and the interpolated eye carries the same bob (the bob already
  // rides the render clock; only the base position lerps)
  const ei = m.eyeAt(0.5);
  assert.ok(Math.abs(ei[0] - (m._prevPos[0] + (m.pos[0] - m._prevPos[0]) * 0.5 + 0.1)) < 1e-9);
});

test('EV1: offsetOrigin shifts both ends - a recenter never lerps across 819.2 units', () => {
  const m = walker();
  m.update(FIXED_DT, IDLE, 0);
  m.update(FIXED_DT, IDLE, 0);
  const before = m.eyeAt(0.5);
  m.offsetOrigin([-819.2, 0, 0]);
  const after = m.eyeAt(0.5);
  assert.ok(Math.abs((after[0] - before[0]) + 819.2) < 1e-3,
    'the interpolated eye moved exactly the shift');
  assert.ok(Math.abs(after[1] - before[1]) < 1e-9, 'nothing else changed');
});

test('EV1: a placed position snaps - no one-frame sweep through the world', () => {
  const m = walker();
  m.update(FIXED_DT, IDLE, 0);
  // a load/door/teleport writes pos wholesale, prev goes stale
  m.pos[0] = 500; m.pos[2] = -500;
  const e = m.eyeAt(0.0);   // even alpha 0 must not show the old spot
  assert.ok(Math.abs(e[0] - 500) < 1e-6 && Math.abs(e[2] + 500) < 1e-6,
    'the guard snapped to the placed position');
});

test('EV1: footsteps.rebase - a recenter is not 819.2 units of walking', () => {
  const fs = new FootstepMachine();
  const m = { levitating: false, swimming: false, grounded: true, standingStill: false };
  const set = ['a', 'b'];
  fs.update([0, 0, 0], m, set);
  fs.update([1, 0, 0], m, set);   // walk a unit; under the 2.5 interval, no step
  assert.ok(fs.distance > 0.9, 'stride accumulates');
  const d = fs.distance;
  fs.rebase();
  const step = fs.update([1 - 819.2, 0, 0], m, set);   // the recentred position arrives
  assert.equal(step, null, 'no spurious footstep');
  assert.ok(Math.abs(fs.distance - d) < 1e-9, 'and no distance was added for the shift');
});
