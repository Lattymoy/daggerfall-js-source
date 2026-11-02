import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const idle = { forward: 0, strafe: 0, run: false, jump: false, crouch: false };
function setup() {
  const collider = new Collider(() => -100);
  collider.addMesh('floor', new Float32Array([-20, 0, -20, 20, 0, -20, 20, 0, 20, -20, 0, 20]), [0, 1, 2, 0, 2, 3], I);
  const box = (name, x0, y0, z0, x1, y1, z1) => collider.addMesh(name, new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), IDX, I);
  box('counter', -8, 0, 1, 8, 1, 8);
  box('ceiling', -1, 2.3, -4, 1, 2.6, 8);
  const motor = new PlayerMotor(collider, { speed: 50, running: 30 }, {
    parkour: { enabled: () => true, inputs: () => ({ climbing: 50, jumping: 50 }) },
  });
  motor.spawn(0, 0.02, 0.4);
  return motor;
}
function mantle(motor, manual = false) {
  let started = false;
  for (let frame = 0; frame < 150; frame++) {
    motor.update(1 / 60, { ...idle, jump: frame === 10, crouch: manual && frame === 9 }, 0);
    started ||= motor.parkoured === 'mantle';
  }
  assert.ok(started, 'real ledge sensing starts the low-ceiling mantle');
  assert.ok(motor.crouching && motor.grounded && motor.pos[1] > 0.98, 'stays safely crouched on counter beneath ceiling');
}
test('automatic mantle crouch restores standing only after the whole capsule clears the ceiling', () => {
  const motor = setup();
  mantle(motor);
  for (let i = 0; i < 150; i++) {
    motor.update(1 / 60, { ...idle, strafe: 1 }, 0);
    if (Math.abs(motor.pos[0]) < 1.3) assert.ok(motor.crouching, 'never stands through low overhead geometry');
  }
  assert.ok(Math.abs(motor.pos[0]) > 2, 'walked out from under the ceiling');
  assert.equal(motor.crouching, false, 'temporary parkour crouch is not a permanent player stance');
  assert.equal(motor.height, CAPSULE_HEIGHT);
});
test('ordinary jump and manually chosen crouch retain their own stance', () => {
  const motor = setup();
  motor.spawn(4, 1.02, 4);
  for (let i = 0; i < 90; i++) motor.update(1 / 60, { ...idle, jump: i === 2 }, 0);
  assert.equal(motor.crouching, false, 'jump in open space does not force crouch');
  for (let i = 0; i < 90; i++) motor.update(1 / 60, { ...idle, crouch: i === 0 }, 0);
  assert.equal(motor.crouching, true, 'manual crouch is never automatically undone');
});
test('manual crouch already requested before a mantle remains the player stance', () => {
  const motor = setup();
  mantle(motor, true);
  for (let i = 0; i < 150; i++) motor.update(1 / 60, { ...idle, strafe: 1 }, 0);
  assert.ok(Math.abs(motor.pos[0]) > 2);
  assert.equal(motor.crouching, true, 'mantle must not overwrite pending manual crouch intent');
});
test('placement clears automatic restoration instead of changing a loaded crouch stance', () => {
  const motor = setup();
  mantle(motor);
  motor.spawn(4, 1.02, 4);
  for (let i = 0; i < 30; i++) motor.update(1 / 60, idle, 0);
  assert.equal(motor.crouching, true, 'placement owns the stance and forgets previous mantle');
});
test('open headroom and crouch presses cannot restore standing during an active mantle', () => {
  const motor = setup();
  for (let i = 0; i < 60 && !motor.mantling; i++) motor.update(1 / 60, { ...idle, jump: i === 10 }, 0);
  assert.ok(motor.mantling && motor.crouching);
  motor.collider.removeBucket('ceiling');
  let activeFrames = 0;
  while (motor.mantling && activeFrames < 180) {
    motor.update(1 / 120, { ...idle, crouch: activeFrames % 2 === 0 }, 0);
    assert.equal(motor.crouching, true, 'move retains its proven short capsule until it finishes');
    activeFrames++;
  }
  assert.ok(activeFrames > 1 && !motor.mantling, 'completed actual mantle at high frame rate');
  for (let i = 0; i < 30; i++) motor.update(1 / 60, idle, 0);
  assert.equal(motor.crouching, false, 'ignored in-move toggles neither stand early nor steal automatic stance ownership');
});
