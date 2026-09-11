import { PlayerMotor, walkSpeed } from './lane-motor-view/src/player/motor.js';
import { Collider } from './lane-motor-view/src/player/collider.js';
const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
let roll = 0;
const col = new Collider(() => -100);
col.addMesh('floor', new Float32Array([-5,0,-5, 5,0,-5, 5,0,5, -5,0,5]), [0,1,2,0,2,3], I);
col.addMesh('wall', new Float32Array([-5,0,0.4, 5,0,0.4, 5,6,0.4, -5,6,0.4]), [0,1,2,0,2,3], I);
const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
  climbing: { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => {}, rolls: () => roll, say: () => {} },
});
m.spawn(0, 0.02, 0);
const fwd = { forward: 1, strafe: 0, run: false, jump: false };
let climbSteps = 0, groundedClimbSteps = 0, bad = 0;
for (let i = 0; i < 400; i++) {
  m.update(1/60, fwd, 0);
  if (m.climb.isClimbing) {
    climbSteps++;
    if (m.standing !== m.grounded) bad++;
    if (m.grounded) { groundedClimbSteps++; console.log('grounded climbing step', i, 'slipping', m.climb.isSlipping, 'standing', m.standing, 'ml', m.movingLessThanHalfSpeed, 'y', m.pos[1].toFixed(3)); }
  }
  if (climbSteps === 1) console.log('first climbing step at', i, 'y', m.pos[1].toFixed(3));
  if (i === 120) { roll = 0.99; console.log('--- rolls flipped to fail at', i, 'y', m.pos[1].toFixed(3), 'climbing', m.climb.isClimbing); }
}
console.log({ climbSteps, groundedClimbSteps, bad, finalY: m.pos[1], climbing: m.climb.isClimbing });
