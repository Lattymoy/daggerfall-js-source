// MAC3 (2026-09-11, Mac: "when moving down hills, the camera hitches
// badly"). The collider's ground snap - the port's answer to
// AcrobatMotor.ApplyGravity's anti-bump (:191-197), recorded at
// player/motor.js A6 - probed MESHES only; the terrain floor beneath
// everything (heightAt) was a floor and nothing more. A capsule walking
// down a heightmap slope steeper than a fresh fall left the floor on
// every step, fell for a dozen, landed hard and left again: measured on
// a 20-degree slope, 540 of 600 steps airborne and 59 landings in ten
// seconds, each landing a hard stop of the descent. The floor takes the
// snap's STEP_OFFSET reach now, under the same jump gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerMotor, STEP_OFFSET } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

const walk = { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false };
const slopeOf = (deg) => Math.tan(deg * Math.PI / 180);
function walkDown(deg, steps = 600, dt = 1 / 60) {
  const slope = slopeOf(deg);
  const m = new PlayerMotor(new Collider((x, z) => -slope * z));
  m.pos = [0, 0, 0]; m.grounded = true;
  let airborne = 0, landings = 0, worstDrop = 0, rises = 0, prevE = m.eyeAt()[1];
  for (let i = 0; i < steps; i++) {
    m.update(dt, walk, 0);
    if (m.falling || !m.grounded) airborne++;
    if (m.landedFallDistance > 0) landings++;
    const e = m.eyeAt()[1]; const d = e - prevE; prevE = e;
    if (d > 1e-9) rises++;
    worstDrop = Math.min(worstDrop, d);
  }
  return { m, airborne, landings, worstDrop, rises, slope };
}

test('MAC3: walking down a terrain slope keeps the capsule on the floor - no hops, no landings, the eye descends at the slope\'s own rate (mutant: the floor snap in collider._moveStep deleted)', () => {
  for (const deg of [20, 30, 45]) {
    const r = walkDown(deg);
    assert.equal(r.airborne, 0, `${deg} degrees: airborne steps`);
    assert.equal(r.landings, 0, `${deg} degrees: landings`);
    assert.equal(r.rises, 0, `${deg} degrees: the eye never climbs on the way down`);
    assert.ok(Math.abs(r.m.pos[1] - (-r.slope * r.m.pos[2])) < 1e-6, `${deg} degrees: the feet are on the floor at the end`);
    // one frame's drop is one frame's travel down the slope, not a fall
    const perStep = r.slope * (r.m.pos[2] / 600);
    assert.ok(-r.worstDrop <= perStep * 1.05 + 1e-6, `${deg} degrees: worst eye drop ${(-r.worstDrop).toFixed(4)} vs the slope's ${perStep.toFixed(4)} per step`);
  }
  // the reach is the snap's own: a floor more than STEP_OFFSET below is a fall, as it should be
  const cliff = new PlayerMotor(new Collider((x, z) => (z > 3 ? -(STEP_OFFSET + 0.3) : 0)));
  cliff.pos = [0, 0, 0]; cliff.grounded = true;
  let fell = false;
  for (let i = 0; i < 120; i++) { cliff.update(1 / 60, walk, 0); if (cliff.falling) fell = true; }
  assert.ok(fell, 'a drop past STEP_OFFSET is still a fall, not a snap');
  assert.ok(Math.abs(cliff.pos[1] - -(STEP_OFFSET + 0.3)) < 1e-6, 'and it lands on the lower floor');
});

test('MAC3: a jump on a slope still leaves the ground - the floor snap keeps the mesh snap\'s jump gate (mutant: `snap &&` dropped from the floor arm)', () => {
  const m = new PlayerMotor(new Collider((x, z) => -slopeOf(20) * z));
  m.pos = [0, 0, 0]; m.grounded = true;
  for (let i = 0; i < 30; i++) m.update(1 / 60, walk, 0);
  m.update(1 / 60, { ...walk, jump: true }, 0);
  let airborne = 0, apex = -Infinity, landings = 0;
  for (let i = 0; i < 90; i++) {
    m.update(1 / 60, walk, 0);
    if (m.jumping) airborne++;
    apex = Math.max(apex, m.pos[1] + slopeOf(20) * m.pos[2]);
    if (m.landedFallDistance > 0) landings++;
  }
  assert.ok(airborne > 20, `the jump was airborne (${airborne} steps)`);
  assert.ok(apex > 0.5, `the jump rose above the slope (${apex.toFixed(3)})`);
  assert.equal(landings, 1, 'and came down once');
  // the arm's shape, so the gate cannot quietly widen
  const src = readFileSync(new URL('../src/player/collider.js', import.meta.url), 'utf8');
  assert.match(src, /if \(snap && dy <= 0 && !out\.grounded && feet\[1\] > floor && feet\[1\] - floor <= STEP_OFFSET\) \{/, 'the floor snap rides the mesh snap\'s gate and reach');
});
