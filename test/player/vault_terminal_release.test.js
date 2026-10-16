import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { planVault } from '../../src/player/parkour.js';
import { ClimbPose, climbRigInput } from '../../src/player/climb/climbPose.js';

test('completed vault releases hands when a slow frame skips the release window', () => {
  const motor = new PlayerMotor(new Collider(() => -100), {}, {});
  motor.spawn(0, 0, 0);
  const move = planVault([0, 0, 0], { rise: 0.7, into: [0, 0, 1] },
    { up: [0, 0.78, 0], over: [0, 0.78, 1] }, 100, 4);
  motor._parkourBegin(move);
  const law = new ClimbPose();
  // Two ordinary 100 ms motor frames leave this fast vault at 73%; the next ends it.
  for (let i = 0; i < 2; i++) {
    motor._parkourAdvance(0.1);
    law.update(0.1, climbRigInput(motor, 0));
  }
  assert.ok(law.out.hands.R.w > 0, 'last drawn frame still has a partial grip');
  motor._parkourAdvance(0.1);
  assert.equal(move.t, 1);
  assert.equal(climbRigInput(motor, 0), null, 'motor removes completed vault before pose observes t=1');
  const out = law.update(0.1, null);
  assert.ok(out.w > 0, 'body still eases out');
  for (const side of ['L', 'R']) assert.equal(out.hands[side].w, 0, 'completed vault must not retain previous grip');
});

import { readFileSync } from 'node:fs';
test('third-person cached mapping follows terminal hand release while body still fades', () => {
  const source = readFileSync(new URL('../../src/combat/fpArm.js', import.meta.url), 'utf8');
  const fn = source.slice(source.indexOf('  function thirdClimb('), source.indexOf('  /** CLIMB6: ...and the FIRST-PERSON'));
  const map = new Function('climbRequestToRig', 'MW_UNITS_PER_METER', `let climbLast = null; const built = null; ${fn}; return thirdClimb;`)(
    (world) => structuredClone(world), 70);
  const hands = { L: { at: [0, 0, 0], w: 0.2 }, R: { at: [0, 0, 0], w: 0.2 } };
  const active = { w: 1, hands };
  const cached = map(active, { climb: { feet: [0, 0, 0], yaw: 0 } });
  assert.equal(cached.hands.R.w, 0.2);
  const faded = map({ w: 0.8, hands: { L: { w: 0 }, R: { w: 0 } } }, { climb: null });
  assert.equal(faded.w, 0.8, 'body still eases out');
  assert.equal(faded.hands, null, 'cache must not resurrect released hands');
  assert.equal(cached.hands.R.w, 0.2, 'previous request was not mutated');
});

test('unfinished vault interruption retains ease-out, and a new hang can grip normally', () => {
  const law = new ClimbPose();
  const move = { kind: 'vault', from: [0, 0, 0], up: [0, 1, 0], to: [0, 1, 1], t: 0.65 };
  const active = law.update(0.1, { feet: [0, 0, 0], yaw: 0, move });
  const grip = active.hands.R.w;
  assert.ok(grip > 0);
  assert.equal(law.update(0.1, null).hands.R.w, grip, 'interruption keeps existing ease-out');
  move.t = 1;
  assert.equal(law.update(0.1, null).hands.R.w, 0);
  const hang = law.update(0.1, { feet: [0, 0, 0], yaw: 0, mode: 'hang', normal: [0, 0, -1], lipY: 1.8, grip: 1 });
  assert.ok(hang.hands.R.w > 0, 'release does not leak into the next hold');
});
