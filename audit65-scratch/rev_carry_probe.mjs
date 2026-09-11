import { PlayerMotor } from './lane-swim/src/player/motor.js';
import { Collider } from './lane-swim/src/player/collider.js';
import { applyMotorEffectFlags } from './lane-swim/src/scenes/shared.js';
import { exteriorSwimming, exteriorSwimLatch } from './lane-swim/src/player/exteriorSurface.js';

const I4 = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const col = () => { const c = new Collider(() => 0); c.addMesh('floor',[-200,0,-200,200,0,-200,200,0,400,-200,0,400],[0,1,2,0,2,3],I4); return c; };
const STILL = { forward:0,strafe:0,run:false,jump:false,up:false,down:false };
const FWD = { forward:1,strafe:0,run:false,jump:false,up:false,down:false };

// THE DUNGEON EXIT: the modal frame leaves BOTH members true (worldModes:5295),
// then the exterior arm resumes on tile 0 with the sink NOT yet armed.
function exitCarry({ tile, water }) {
  const m = new PlayerMotor(col(), { speed: 50, running: 30, swimming: 30 });
  m.pos = [0,0,0]; m.grounded = true;
  m.isPlayerSwimming = true; m.swimming = true;     // the dungeon arm's last frame
  const seen = [];
  for (let i=0;i<4;i++) {
    const was = !!m.isPlayerSwimming;
    applyMotorEffectFlags(m, { activeEffects: [] });
    m.update(1/60, FWD, 0);
    m.onExteriorWater = water;
    m.isPlayerSwimming = exteriorSwimming({ wasSwimming: was, sunk: !!m.sunk, unsunk: m.heightAction === 'unsink', tileIndex: tile });
    seen.push(`f${i}: was=${was} sunk=${m.sunk} ips=${m.isPlayerSwimming} sw=${m.swimming} speed=${m.speed?.toFixed(4)}`);
  }
  return seen;
}
console.log('EXIT ONTO OPEN WATER (tile 0, onExteriorWater=Swimming):');
for (const l of exitCarry({ tile: 0, water: true })) console.log('  ', l);
console.log('EXIT ONTO LAND (tile 5):');
for (const l of exitCarry({ tile: 5, water: false })) console.log('  ', l);
console.log('EXIT ONTO A WATER TILE THE PLAYER IS NOT IN (tile 0, no sink source):');
for (const l of exitCarry({ tile: 0, water: false })) console.log('  ', l);
console.log('latch contract:', JSON.stringify(exteriorSwimLatch(true, 0)), JSON.stringify(exteriorSwimLatch(true, 5)));

// BUILDING ENTERED FROM WATER: worldModes' interior arm clears both; on exit
// the exterior arm re-derives from the tile.
const m2 = new PlayerMotor(col(), { speed: 50, running: 30, swimming: 30 });
m2.pos=[0,0,0]; m2.grounded=true; m2.isPlayerSwimming = true;
applyMotorEffectFlags(m2, { activeEffects: [] }); m2.isPlayerSwimming = false;   // the interior arm
console.log('after the interior arm: ips=', m2.isPlayerSwimming, 'sw=', m2.swimming);
// back outdoors, standing on a water tile but NOT sunk (walked out of a door onto a water tile)
const was = !!m2.isPlayerSwimming;
applyMotorEffectFlags(m2, { activeEffects: [] });
m2.update(1/60, STILL, 0);
m2.isPlayerSwimming = exteriorSwimming({ wasSwimming: was, sunk: !!m2.sunk, unsunk: m2.heightAction==='unsink', tileIndex: 0 });
console.log('first exterior frame after the building: ips=', m2.isPlayerSwimming, '(DFU: the else arm keeps whatever it was on tile 0 -> false)');
