import { PlayerMotor } from './lane-swim/src/player/motor.js';
import { Collider } from './lane-swim/src/player/collider.js';
import { applyMotorEffectFlags } from './lane-swim/src/scenes/shared.js';
import { exteriorSwimming } from './lane-swim/src/player/exteriorSurface.js';

const I4 = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
function floorCollider() {
  const col = new Collider(() => 0);
  col.addMesh('floor', [-200,0,-200, 200,0,-200, 200,0,400, -200,0,400], [0,1,2,0,2,3], I4);
  return col;
}
const FORWARD = { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false };
const NO_EFFECTS = { activeEffects: [] };

function harness({ target, water, steps, warm = 0, spawn = false }) {
  const m = new PlayerMotor(floorCollider(), { speed: 50, running: 30, swimming: 30 });
  if (spawn) { m.spawn(0, 0.05, 0); for (let i=0;i<40;i++) m.update(1/60, { forward:0,strafe:0,run:false,jump:false,up:false,down:false }, 0); }
  else { m.pos = [0,0,0]; m.grounded = true; }
  const trace = [];
  const frame = () => {
    const was = !!(target === 'host' ? m.isPlayerSwimming : m.swimming);
    applyMotorEffectFlags(m, NO_EFFECTS);
    m.update(1/60, FORWARD, 0);
    m.onExteriorWater = water;
    const v = exteriorSwimming({ wasSwimming: was, sunk: !!m.sunk, unsunk: m.heightAction === 'unsink', tileIndex: water ? 0 : 5 });
    if (target === 'host') m.isPlayerSwimming = v; else m.swimming = v;
    trace.push({ z: m.pos[2], y: m.pos[1], sunk: m.sunk, speed: m.speed, cancel: m.cancelMovement, sw: m.swimming, ips: m.isPlayerSwimming });
  };
  for (let i=0;i<warm;i++) frame();
  const z0 = m.pos[2];
  for (let i=0;i<steps;i++) frame();
  return { m, dz: m.pos[2]-z0, trace };
}

const DF_WALK_BASE=150, C2U=39.5;
const csWalk = s => (s + DF_WALK_BASE - 0.5*(100 - (s>=30?s:30)))/C2U;
const csSwim = (b,k) => b*(k/200) + b/4;
const walk = csWalk(50), swim = csSwim(walk,30);
console.log('walk', walk, 'swim', swim);

for (const warm of [0,1,2,3,4,5,10,60]) {
  const h = harness({ target:'host', water:true, steps:60, warm });
  console.log(`host water warm=${warm} dz60=${h.dz.toFixed(6)} err=${(h.dz-swim).toExponential(2)} speed=${h.m.speed}`);
}
for (const warm of [0,1,2,5,10]) {
  const h = harness({ target:'host', water:false, steps:60, warm });
  console.log(`host DRY  warm=${warm} dz60=${h.dz.toFixed(6)} err=${(h.dz-walk).toExponential(2)}`);
}
// spawn-settled variant
const sp = harness({ target:'host', water:true, steps:60, warm:5, spawn:true });
console.log('spawn-settled water warm=5 dz60=', sp.dz.toFixed(6), 'err', (sp.dz-swim).toExponential(2));
const spd = harness({ target:'host', water:false, steps:60, warm:0, spawn:true });
console.log('spawn-settled DRY warm=0 dz60=', spd.dz.toFixed(6), 'err', (spd.dz-walk).toExponential(2));

// frozen control
const fr = harness({ target:'motor', water:true, steps:600, warm:5 });
console.log('frozen dz600=', fr.dz, 'speed=', fr.m.speed, 'swim=', swim, 'cancel=', fr.m.cancelMovement, 'sunk=', fr.m.sunk);
console.log('frozen first 8 frames:', fr.trace.slice(0,8).map(t=>`z=${t.z.toFixed(4)} sunk=${t.sunk} sp=${t.speed?.toFixed?.(4)} c=${t.cancel}`).join(' | '));
