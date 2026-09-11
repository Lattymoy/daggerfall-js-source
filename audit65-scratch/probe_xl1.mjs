import { PlayerMotor } from './lane-swim/src/player/motor.js';
import { Collider } from './lane-swim/src/player/collider.js';
import { applyMotorEffectFlags } from './lane-swim/src/scenes/shared.js';
import { exteriorSwimming } from './lane-swim/src/player/exteriorSurface.js';

const I4 = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const quad=(ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz)=>({positions:[ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz],indices:[0,1,2,0,2,3]});
function floorCollider(){
  const col = new Collider(() => 0);
  const f = quad(-200,0,-200, 200,0,-200, 200,0,400, -200,0,400);
  col.addMesh('floor', f.positions, f.indices, I4);
  return col;
}
const INPUT = { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false };
const entity = { activeEffects: [] };

function run({ target, water, steps, warm = 0 }) {
  const m = new PlayerMotor(floorCollider(), { speed: 50, running: 30, swimming: 30 });
  m.pos = [0,0,0]; m.grounded = true;
  const frame = () => {
    const was = !!(target === 'host' ? m.isPlayerSwimming : m.swimming);
    applyMotorEffectFlags(m, entity);
    m.update(1/60, INPUT, 0);
    m.onExteriorWater = water;
    const v = exteriorSwimming({ wasSwimming: was, sunk: !!m.sunk, unsunk: m.heightAction === 'unsink', tileIndex: water ? 0 : 5 });
    if (target === 'host') m.isPlayerSwimming = v; else m.swimming = v;
  };
  for (let i=0;i<warm;i++) frame();
  const z0 = m.pos[2], y0 = m.pos[1];
  for (let i=0;i<steps;i++) frame();
  return { dz: m.pos[2]-z0, dy: m.pos[1]-y0, speed: m.speed, cancel: m.cancelMovement, sunk: m.sunk, host: m.isPlayerSwimming, motor: m.swimming };
}
const walk = (s) => { const drag = 0.5*(100 - (s>=30?s:30)); return (s + 150 - drag)/39.5; };
const swim = (b, sk) => b*(sk/200) + b/4;
console.log('C# walk(50)=', walk(50), 'swim=', swim(walk(50),30));
console.log('DRY  60:', run({ target:'host', water:false, steps:60 }));
console.log('WET  60 (warm 5):', run({ target:'host', water:true, steps:60, warm:5 }));
console.log('WET 600 (warm 5):', run({ target:'host', water:true, steps:600, warm:5 }));
console.log('OLD WIRING 60 (warm 5):', run({ target:'motor', water:true, steps:60, warm:5 }));
console.log('OLD WIRING 600:', run({ target:'motor', water:true, steps:600, warm:5 }));
