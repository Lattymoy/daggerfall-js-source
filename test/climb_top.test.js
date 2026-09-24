// DISC21 (2026-09-24, the contributor's report: "You can climb up walls a bit but you fall right back down as you reach
// the top instead of getting over the edge (currently stuck in a pit)").
//
// THE BUG: the climb's wall probe sampled the body at 0.4h and 0.8h above the feet only, so with the lip 0.72 m over the
// feet the wall read "untouched" - ClimbingMotor :396 `!touchingSides` stopped the climb - while the bottom of the capsule
// still hugged it. The player fell back into the pit, every time, at the same height. DFU's Sides flag is the whole
// capsule's, down to its lower cap.
//
// Driven through the real motor and the real collider: a floor, a wall to a lip, a top beyond it; a climber holding
// forward from the foot of the wall must end STANDING ON THE TOP, for a pit wall, a tall one and a lip just over a step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, CAPSULE_RADIUS, CLIMB_SIDE_REACH, CLIMB_CAP_LOW, STEP_OFFSET } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const DT = 1 / 60;
const still = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };

/** A climber at the foot of a wall rising to `top` at z = 1, holding forward; where the climb leaves them. */
function climbTo(top) {
  const col = new Collider(() => 0);
  col.addMesh('floor', [-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40], [0, 1, 2, 0, 2, 3], I);
  col.addMesh('wall', [-40, 0, 1, 40, 0, 1, 40, top, 1, -40, top, 1], [0, 2, 1, 0, 3, 2], I);
  col.addMesh('top', [-40, top, 1, 40, top, 1, 40, top, 20, -40, top, 20], [0, 1, 2, 0, 2, 3], I);
  const m = new PlayerMotor(col, { speed: 50, running: 30, swimming: 30 },
    { climbing: { inputs: () => ({ climbing: 100, luck: 100 }), tally: () => {}, rolls: () => 0, say: () => {} } });
  m.spawn(0, 0.05, 0);
  for (let f = 0; f < 40; f++) m.update(DT, still, 0);
  let climbed = false, falls = 0, was = false;
  for (let f = 0; f < 60 * 20; f++) {
    m.update(DT, { ...still, forward: 1 }, 0);
    if (m.climb.isClimbing) climbed = true;
    if (was && !m.climb.isClimbing && m.pos[1] < top - 0.05 && m.pos[2] < 1) falls++;
    was = m.climb.isClimbing;
    if (m.grounded && m.pos[2] > 1 + CAPSULE_RADIUS * 0.5 && Math.abs(m.pos[1] - top) < 0.05) return { onTop: true, climbed, falls, m };
  }
  return { onTop: false, climbed, falls, m };
}

test('DISC21: a climber holding forward goes over the lip and stands on the top - a pit wall, a tall wall, a lip just over a step - never released under the lip to fall back (mutants: the probe back to 0.4h/0.8h alone; the cap ray at the cylinder base)', () => {
  for (const top of [3, 6, STEP_OFFSET + 0.4]) {
    const r = climbTo(top);
    assert.ok(r.climbed, `${top} m: the climb started`);
    assert.equal(r.falls, 0, `${top} m: the climb never let go below the lip`);
    assert.ok(r.onTop, `${top} m: standing on the top (feet ${[...r.m.pos].map((v) => v.toFixed(2))})`);
  }
});

test('DISC21: the lowest ray is where the capsule\'s lower cap still meets the wall - its skin shell about the cap\'s centre, reaching a wall the side rests on (mutant: the height made up)', () => {
  assert.equal(CLIMB_SIDE_REACH, CAPSULE_RADIUS + 0.1, 'M3\'s reach: radius and the skin');
  // the cap's centre is feet + r; a wall at standoff r is met by the shell r + skin at depth sqrt((r+skin)^2 - r^2)
  const depth = Math.hypot(CLIMB_SIDE_REACH, 0) ** 2 - CAPSULE_RADIUS ** 2;
  assert.ok(Math.abs(CAPSULE_RADIUS - Math.sqrt(depth) - CLIMB_CAP_LOW) < 1e-12);
  assert.ok(CLIMB_CAP_LOW > 0.06 && CLIMB_CAP_LOW < 0.07, 'about 0.067 above the feet');
});
