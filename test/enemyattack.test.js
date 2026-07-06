// C8 E2b: the verbatim attack decision on the shared machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACK_SPEED_FLOOR, ATTACK_YAW_DEG, resetMeleeTimer, attackRollPasses, EnemyAttack,
} from '../src/characters/enemyAttack.js';
import { MELEE_DISTANCE } from '../src/characters/enemyMotor.js';
import { HIT_FRAME_MELEE } from '../src/characters/weaponStates.js';

const approx = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('enemyAttack: verbatim reset-timer arithmetic', () => {
  assert.equal(ATTACK_SPEED_FLOOR, 8);
  assert.equal(ATTACK_YAW_DEG, 22.5);
  approx(resetMeleeTimer(10, 2, 0), 1500 / 980);           // min roll, neutral terms
  approx(resetMeleeTimer(10, 2, 1), 3001 / 980);           // max roll (Range max inclusive)
  approx(resetMeleeTimer(20, 2, 0), (1500 - 500) / 980);   // -50 per level over 10
  approx(resetMeleeTimer(10, 4, 0), (1500 + 900) / 980);   // +450 per reflex step
  approx(resetMeleeTimer(60, 0, 0), 0);                    // floors at 0 (1500-2500-900)
});

test('enemyAttack: the classic roll uses floored speed and the >> 3 gate', () => {
  // rand() % speed >= (speed >> 3) + 6, speed floored at 8: with
  // speed 8 the gate is 7, so only rand%8 == 7 passes.
  assert.equal(attackRollPasses(1, () => 7), true);
  assert.equal(attackRollPasses(1, () => 6), false);
  // speed 64: gate 14
  assert.equal(attackRollPasses(64, () => 14), true);
  assert.equal(attackRollPasses(64, () => 13), false);
});

test('enemyAttack: strikes only in range+sight+yaw; hit event at the melee hit frame', () => {
  const mkAi = (dist, inSight) => ({ _dist: dist, inSight, yaw: 0, feet: [0, 0, 0] });
  const player = [0, 0, 1.5];
  // out of range: never fires even with a passing roll
  const far = new EnemyAttack({ liveSpeed: 50 });
  for (let i = 0; i < 200; i++) far.update(1 / 60, mkAi(30, true), [0, 0, 30]);
  assert.equal(far.machine.state, 'Idle');
  // in range + sight + facing: fires within a few seconds, hit lands
  // at HIT_FRAME_MELEE, machine returns to Idle, timer re-arms
  const atk = new EnemyAttack({ liveSpeed: 50 });
  let hits = 0, started = false;
  for (let i = 0; i < 60 * 12; i++) {
    const ev = atk.update(1 / 60, mkAi(1.5, true), player);
    if (atk.machine.state !== 'Idle') started = true;
    if (ev.includes('hit')) { hits++; assert.equal(atk.machine.frame, HIT_FRAME_MELEE); }
  }
  assert.ok(started, 'never started a strike');
  assert.ok(hits >= 1, 'no hit events');
  assert.ok(atk.meleeTimer >= 0);
  // facing away (yaw PI): never fires
  const away = new EnemyAttack({ liveSpeed: 50 });
  for (let i = 0; i < 300; i++) away.update(1 / 60, { _dist: 1.5, inSight: true, yaw: Math.PI, feet: [0, 0, 0] }, player);
  assert.equal(away.machine.state, 'Idle');
});
