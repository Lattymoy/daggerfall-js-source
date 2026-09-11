import { PlayerMotor, walkSpeed } from './lane-motor-view/src/player/motor.js';
import { Collider } from './lane-motor-view/src/player/collider.js';
const col = new Collider(() => -100);
const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
col.addMesh('floor', new Float32Array([-5,0,-5, 5,0,-5, 5,0,5, -5,0,5]), [0,1,2,0,2,3], I);
col.addMesh('wall', new Float32Array([-5,0,0.4, 5,0,0.4, 5,6,0.4, -5,6,0.4]), [0,1,2,0,2,3], I);
const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
  climbing: { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => {}, rolls: () => 0, say: () => {} },
});
m.spawn(0, 0.02, 0);
console.log('walkSpeed(50)=', walkSpeed(50));
const fwd = { forward: 1, strafe: 0, run: false, jump: false };
let was = false;
for (let i = 0; i < 90; i++) {
  m.update(1/30, fwd, 0);
  const now = m.climb.isClimbing;
  if (now !== was || (now && i < 70)) {
    console.log(i, 'climbing=', now, 'grounded=', m.grounded, 'standing=', m.standing, 'mlths=', m.movingLessThanHalfSpeed, 'y=', m.pos[1].toFixed(4), 'speed=', m.speed);
  }
  was = now;
  if (now && i > 66) break;
}
