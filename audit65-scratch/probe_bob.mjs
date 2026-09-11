import { PlayerMotor } from './lane-motor-view/src/player/motor.js';
import { Collider } from './lane-motor-view/src/player/collider.js';
const m = new PlayerMotor(new Collider(() => 0));
m.pos=[0,0,0]; m.grounded=true;
const walkInput = { forward: 1, strafe: 0, run: false, jump: false };
for (let i=0;i<30;i++) m.update(1/60, walkInput, 0);
console.log('bobOffset', m.bobOffset, 'eyeLevel', m._eyeLevel());
console.log('eyeAt', m.eyeAt(), 'feetAt', m.feetAt(), 'pos', m.pos);
