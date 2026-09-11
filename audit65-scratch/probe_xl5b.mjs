import { PlayerMotor, walkSpeed } from './lane-motor-view/src/player/motor.js';
import { Collider } from './lane-motor-view/src/player/collider.js';
const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function build({ ceiling = null, roll = () => 0 } = {}) {
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-5,0,-5, 5,0,-5, 5,0,5, -5,0,5]), [0,1,2,0,2,3], I);
  col.addMesh('wall', new Float32Array([-5,0,0.4, 5,0,0.4, 5,6,0.4, -5,6,0.4]), [0,1,2,0,2,3], I);
  if (ceiling != null) col.addMesh('ceil', new Float32Array([-5,ceiling,-5, 5,ceiling,-5, 5,ceiling,5, -5,ceiling,5]), [0,1,2,0,2,3], I);
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
    climbing: { inputs: () => ({ climbing: 50, luck: 50 }), tally: () => {}, rolls: roll, say: () => {} },
  });
  m.spawn(0, 0.02, 0);
  return m;
}
console.log('--- (a) low ceiling forward start ---');
for (const c of [1.85, 1.9, 2.0, 2.2]) {
  const m = build({ ceiling: c });
  const fwd = { forward: 1, strafe: 0, run: false, jump: false };
  let first = null;
  for (let i = 0; i < 120; i++) {
    m.update(1/30, fwd, 0);
    if (m.climb.isClimbing && first == null) first = { i, g: m.grounded, s: m.standing, ml: m.movingLessThanHalfSpeed, y: m.pos[1] };
  }
  console.log('ceiling', c, 'first climbing step:', first, 'finalY', m.pos[1].toFixed(3), 'climbing', m.climb.isClimbing);
}
console.log('--- (b) slip landing ---');
{
  let roll = 0;
  const m = build({ roll: () => roll });
  const fwd = { forward: 1, strafe: 0, run: false, jump: false };
  for (let i = 0; i < 60; i++) m.update(1/30, fwd, 0);
  console.log('latched climbing', m.climb.isClimbing, 'y', m.pos[1].toFixed(3), 'grounded', m.grounded, 'standing', m.standing);
  roll = 0.99;
  for (let i = 0; i < 200; i++) {
    m.update(1/30, fwd, 0);
    if (m.climb.isClimbing && m.grounded) { console.log('GROUNDED CLIMBING STEP at', i, 'slipping', m.climb.isSlipping, 'standing', m.standing, 'ml', m.movingLessThanHalfSpeed, 'y', m.pos[1].toFixed(3)); break; }
    if (!m.climb.isClimbing) { console.log('climb ended at', i, 'slipping', m.climb.isSlipping, 'grounded', m.grounded, 'y', m.pos[1].toFixed(3)); break; }
  }
}
