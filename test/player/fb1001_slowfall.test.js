// FIELD BUGS 2026-10-01 part five (SLOW-SLIP, SLOW-GRASP, SLOW-PRESS) - #bug-reports, DoubleDutchess: "When the
// Slowfall effect is active, falls drift to the side and catch on the wall, getting the player stuck before they touch
// the ground"; Skeptikali: "yeah, then your speed weirdly accumulates and you pummel to ground HARD".
//
// Slowfall is a flat 2.1 m/s with its fall re-anchored every tick (motor.js ApplyGravity) - but three things around it
// did not hear of it. The classic climb's SLIP arm integrated plain gravity and anchored its fall once, at the slip
// (a slip under Slowfall hit the floor at 19 m/s and billed all 10 m it slipped); the classic AIRBORNE GRASP fired on a
// descent the spell made five times as long (the 0.77 s start timer is 1.6 m of a slow fall, re-rolled every 1.6 m);
// and the frozen air momentum kept pressing into whatever wall the glide reached, which on a face steeper than the
// slope limit lifts the capsule more than the spell's 0.035 m a step lowers it - the body hung there, or crept up it.
//
// Driven on the producers: a real PlayerMotor over a real Collider, the classic climb's ClimbingState with its dice
// scripted, the effect flag as the hosts write it (scenes/shared.js applyMotorEffectFlags).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PlayerMotor, SLOWFALL_VELOCITY, FALL_DAMAGE_THRESHOLD } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const boxVerts = (x0, y0, z0, x1, y1, z1) => new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
const press = { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false };
const still = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };

/** A floor and a 40 m wall across +z (its face at z 0.4); a motor with the classic climb, its dice `rolls`. */
function atWall(rolls) {
  const col = new Collider(() => 0);
  col.addMesh('wall', boxVerts(-5, 0, 0.4, 5, 40, 3), BOX_IDX, I);
  const deps = { inputs: () => ({ climbing: 30, luck: 50 }), tally: () => {}, rolls, say: () => {} };
  return new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 }, { climbing: deps });
}

test('SLOW-SLIP: a slip off the classic climb under Slowfall comes down at the spell\'s 2.1 m/s and bills no fall (it free-fell at 19 m/s and billed the 10 m slipped, 25 HP)', () => {
  // the climb taken from the floor and held up the wall (every roll passes), then the spell, then every roll fails
  let fail = false;
  const m = atWall(() => (fail ? 0.999 : 0));
  m.spawn(0, 0.02, 0);
  let f = 0;
  while (m.pos[1] < 10 && f++ < 2000) m.update(1 / 60, press, 0);
  assert.ok(m.climb.isClimbing && m.pos[1] >= 10, `climbed to ${m.pos[1].toFixed(2)}`);
  m.slowFalling = true;   // applyMotorEffectFlags, every frame
  fail = true;
  let slipped = false, fastest = 0, billed = 0;
  for (let i = 0; i < 3000 && !(slipped && m.grounded && !m.climb.isClimbing); i++) {
    m.update(1 / 60, press, 0);
    slipped ||= m.climb.isSlipping;
    fastest = Math.min(fastest, m.velY);
    billed = Math.max(billed, m.landedFallDistance);
  }
  assert.ok(slipped, 'the hold slipped');
  assert.ok(m.grounded, 'and came down');
  assert.ok(fastest >= -SLOWFALL_VELOCITY - 1e-9, `the slip's fastest ${fastest.toFixed(2)} m/s - Slowfall's is ${SLOWFALL_VELOCITY}`);
  assert.ok(billed < 1, `the landing billed ${billed.toFixed(2)} m (damage past ${FALL_DAMAGE_THRESHOLD})`);
});

test('SLOW-GRASP: a slow fall pressed into a wall with Forward held is not grasped onto the wall on the way down - it lands, and the climb is the ground\'s', () => {
  const m = atWall(() => 0);   // every roll passes: the grasp would always take
  m.spawn(0, 20, 0);
  m.slowFalling = true;
  let caughtAt = null, billed = 0;
  for (let i = 0; i < 1200 && !m.grounded; i++) {
    m.update(1 / 60, press, 0);
    if (m.climb.isClimbing && caughtAt == null) caughtAt = m.pos[1];
    billed = Math.max(billed, m.landedFallDistance);
  }
  assert.equal(caughtAt, null, `grasped onto the wall at ${caughtAt?.toFixed(2)} m on the way down`);
  assert.ok(m.grounded, 'came down to the floor');
  for (let i = 0; i < 60; i++) m.update(1 / 60, press, 0);   // the landing's own step bills it
  assert.ok(m.climb.isClimbing, 'Forward held at the wall on the floor still climbs (the classic start)');
  // the spell off, the classic airborne grasp stands as DFU's
  const g = atWall(() => 0);
  g.spawn(0, 20, 0);
  let grasped = false;
  for (let i = 0; i < 120 && !grasped; i++) { g.update(1 / 60, press, 0); grasped = g.climb.isClimbing && !g.grounded; }
  assert.ok(grasped, 'without Slowfall a fall pressed into the wall is grasped (ClimbingMotor\'s airborne grasp)');
});

test('SLOW-PRESS: a slow fall carried into a face steeper than the slope limit slides down it - the frozen momentum\'s press no longer holds it up (it hung at 12 m for 20 s, or crept up the face)', () => {
  for (const [deg, v] of [[72, 6.6], [75, 9]]) {
    const col = new Collider(() => 0);
    const run = 30 / Math.tan(deg * Math.PI / 180), zb = 1 + run + 2;
    col.addMesh('face', new Float32Array([-10, 0, 1, 10, 0, 1, 10, 30, 1 + run, -10, 30, 1 + run, -10, 0, zb, 10, 0, zb, 10, 30, zb, -10, 30, zb]), BOX_IDX, I);
    const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 });
    m.spawn(0, 12, 1 + 12 / Math.tan(deg * Math.PI / 180) - 0.6);
    m.slowFalling = true;
    m.update(1 / 60, still, 0);
    m._airVelZ = v;   // the run carried off the edge (airControl false: frozen at liftoff)
    let t = 0;
    while (!m.grounded && t < 20) { m.update(1 / 60, still, 0); t += 1 / 60; }
    assert.ok(m.grounded, `${deg} deg at ${v} m/s: still off the floor at y ${m.pos[1].toFixed(2)} after ${t.toFixed(1)} s`);
    assert.ok(t < 12 / SLOWFALL_VELOCITY + 1, `${deg} deg at ${v} m/s: ${t.toFixed(1)} s to come down 12 m at ${SLOWFALL_VELOCITY} m/s`);
  }
});
