import { PlayerMotor, CAPSULE_HEIGHT } from './lane-motor-view/src/player/motor.js';
import { Collider } from './lane-motor-view/src/player/collider.js';
const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
console.log('CAPSULE_HEIGHT', CAPSULE_HEIGHT);
for (const c of [1.80, 1.805, 1.81, 1.82, 1.83]) {
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-5,0,-5, 5,0,-5, 5,0,5, -5,0,5]), [0,1,2,0,2,3], I);
  col.addMesh('wall', new Float32Array([-5,0,0.4, 5,0,0.4, 5,6,0.4, -5,6,0.4]), [0,1,2,0,2,3], I);
  col.addMesh('ceil', new Float32Array([-5,c,-5, 5,c,-5, 5,c,5, -5,c,5]), [0,1,2,0,2,3], I);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
    climbing: { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => {}, rolls: () => 0, say: () => {} },
  });
  m.spawn(0, 0.02, 0);
  const fwd = { forward: 1, strafe: 0, run: false, jump: false };
  let first = null, groundedCount = 0, steps = 0;
  for (let i = 0; i < 300; i++) {
    m.update(1/60, fwd, 0);
    if (m.climb.isClimbing) { steps++; if (m.grounded) groundedCount++; if (!first) first = { i, g: m.grounded, s: m.standing, ml: m.movingLessThanHalfSpeed, y: +m.pos[1].toFixed(4) }; }
  }
  console.log('ceil', c, 'first', first, 'steps', steps, 'groundedSteps', groundedCount, 'finalY', m.pos[1].toFixed(4));
}
