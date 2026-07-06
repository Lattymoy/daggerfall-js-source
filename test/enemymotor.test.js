// C8 E2: the classic enemy AI core, verbatim constants + behavior on
// synthetic geometry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGHT_RADIUS, HEARING_RADIUS, FIELD_OF_VIEW, MELEE_DISTANCE,
  CLASSIC_MELEE_DISTANCE_VS_AI, CLASSIC_TURN_DEG, CLASSIC_UPDATE_INTERVAL,
  SYSTEM_TIMER_UPDATES_DIVISOR, MOVE_YAW_GATE_DEG, DF_WALK_BASE,
  enemyMoveSpeed, turnTowards, withinYaw, canSeeTarget, EnemyAI,
} from '../src/characters/enemyMotor.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { Collider } from '../src/player/collider.js';

const approx = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quadIdx = new Uint32Array([0, 1, 2, 0, 2, 3]);

test('enemyMotor: verbatim classic constants', () => {
  approx(SIGHT_RADIUS, 4096 * GLOBAL_SCALE);       // EnemySenses.cs:30
  assert.equal(HEARING_RADIUS, 25);                // EnemySenses.cs:31
  assert.equal(FIELD_OF_VIEW, 180);                // EnemySenses.cs:32
  assert.equal(MELEE_DISTANCE, 2.25);              // EnemyAttack.cs:30
  assert.equal(CLASSIC_MELEE_DISTANCE_VS_AI, 1.5); // EnemyAttack.cs:31
  assert.equal(CLASSIC_TURN_DEG, 11.25);           // EnemyMotor.cs TurnToTarget classic comment
  assert.equal(CLASSIC_UPDATE_INTERVAL, 0.0625);   // GameManager.cs:42
  approx(SYSTEM_TIMER_UPDATES_DIVISOR, 0.0549254); // EnemySenses.cs:75
  assert.equal(MOVE_YAW_GATE_DEG, 5.625);          // EnemyMotor.cs AttemptMove
  assert.equal(DF_WALK_BASE, 150);                 // PlayerSpeedChanger
  approx(enemyMoveSpeed(50), (50 + 150) * GLOBAL_SCALE);   // "same formula as when the player walks"
});

test('enemyMotor: classic turn clamps at 11.25deg per update', () => {
  const y1 = turnTowards(0, 1, 0);                  // target due +x = yaw PI/2
  approx(y1, 11.25 * Math.PI / 180);
  const y2 = turnTowards(0, Math.sin(0.05), Math.cos(0.05));   // 2.9deg away: full turn
  approx(y2, 0.05);
  assert.ok(withinYaw(y2, Math.sin(0.05), Math.cos(0.05), MOVE_YAW_GATE_DEG));
});

test('enemyMotor: LOS blocked by a wall, seen without; FOV gates the back', () => {
  const open = new Collider(() => 0);
  assert.ok(canSeeTarget(open, [0, 0, 0], 0, 1.8, [0, 0, 10]));          // facing +z, target ahead
  assert.ok(!canSeeTarget(open, [0, 0, 0], Math.PI, 1.8, [0, 0, 10]));   // facing -z: outside FOV 180
  const walled = new Collider(() => 0);
  walled.addMesh('wall', new Float32Array([-5, 0, 5, 5, 0, 5, 5, 4, 5, -5, 4, 5]), quadIdx, I);
  assert.ok(!canSeeTarget(walled, [0, 0, 0], 0, 1.8, [0, 0, 10]));       // wall at z=5 blocks
});

test('enemyMotor: pursues on the classic cadence and stops at MeleeDistance', () => {
  const c = new Collider(() => -100);
  c.addMesh('floor', new Float32Array([-40, 0, -40, 40, 0, -40, 40, 0, 40, -40, 0, 40]), quadIdx, I);
  const ai = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  const player = [0, 0, 12];
  for (let i = 0; i < 60 * 8; i++) ai.update(1 / 60, player);
  const dist = Math.hypot(player[0] - ai.feet[0], player[2] - ai.feet[2]);
  assert.ok(dist <= MELEE_DISTANCE + 0.1, `closed to ${dist}`);
  assert.ok(dist > 1.0, `orbit guard: ${dist}`);
  assert.equal(ai.moving, false);
  // never detected: never moves
  const ai2 = new EnemyAI(c, [0, 0, 0], 0, { liveSpeed: 50 });
  const far = [0, 0, SIGHT_RADIUS + 50];
  for (let i = 0; i < 60; i++) ai2.update(1 / 60, far);
  approx(ai2.feet[0], 0); approx(ai2.feet[2], 0);
});
