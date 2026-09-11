import { pickActivatableHit, DOOR_ACTIVATION_DISTANCE, RAY_DISTANCE, CORPSE_ACTIVATION_DISTANCE } from '/home/user/daggerfall-js-source/src/player/activate.js';
const eye=[0,1,0], dir=[0,0,1];
const collider={raycast:()=>Infinity};
const box=(z)=>({min:[-0.5,0.5,z],max:[0.5,1.5,z+0.6]});
// a door 8 units down the ray: past 3.2, well inside 76.8
const far=[{key:'door:1',aabb:box(8),distance:DOOR_ACTIVATION_DISTANCE}];
console.log('near pick (reach 3.2):', pickActivatableHit(eye,dir,far,collider));
const widened=[{key:'door:1',aabb:box(8),distance:RAY_DISTANCE}];
console.log('widened to RAY_DISTANCE:', pickActivatableHit(eye,dir,widened,collider));
// corpse at 5 (past 3.75)
console.log('corpse @5 at CORPSE reach:', pickActivatableHit(eye,dir,[{key:'corpse:0',aabb:box(5),distance:CORPSE_ACTIVATION_DISTANCE}],collider));
// the finder's pin shape: null collider
try { pickActivatableHit(eye,dir,[{key:'d',aabb:box(1),distance:DOOR_ACTIVATION_DISTANCE}],null); }
catch(e){ console.log('null collider ->', e.constructor.name+': '+e.message); }
