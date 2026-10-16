// BOUNTY-PACK-ROCK-SPAWN: the actual world's bounty/camp placement seam,
// not a new placement algorithm. Geometry supplied by the regression fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../../src/player/collider.js';
import { placeFoeEnv, entityOccupancy } from '../../../src/scenes/quest/questFoeHost.js';
import { placeFoeFreely } from '../../../src/systems/quest/sceneMount.js';
import { campAnchorSpot, PACK_SPACING, PACK_ALERT_RADIUS, CAMP_SIGHT_RADIUS } from '../../../src/systems/campEncounters.js';
import { CAMP_ROAD_CLEAR_M } from '../../../src/world/road/roadClearance.js';
import { LOOSE_FOE_PLACE_ATTEMPTS } from '../../../src/scenes/hostEnchant.js';
import { Arch3dFile } from '../../../src/formats/arch3dFile.js';
import { dfMeshToModel } from '../../../src/world/meshReader.js';
import { loadLocationPrefab } from '../../../src/world/worldOfDaggerfall/wodLocationData.js';
import { objectMatrix } from '../../../src/world/worldOfDaggerfall/wodLocationObjects.js';
import { rockFootprint } from '../../../src/world/terrain/terrainNature.js';
import { createBountyHost, BOUNTY_RETRY_S } from '../../../src/scenes/bountyHost.js';

const world = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const camp = world.slice(world.indexOf('  const _standCampEncounter ='), world.indexOf('  // BOUNTY1: A BOUNTY\'S PACK'));
const bounty = world.slice(world.indexOf('  const _standBountyPack ='), world.indexOf('  // BOUNTY1 (Mac: "Dungeon bounties'));

export function worldStand({collider, feet, inRock=(x,y,z)=>collider.insideSolid([x,y+0.5,z]), inBuilding=()=>false, random=()=>0.5}) {
  const spawned=[];
  const deps={collider, player:{feetAt:()=>feet}, bountyFarms:{inBuilding}, _inRock:inRock,
    cam:{yaw:0}, fieldOfView:()=>Math.PI/2, campAnchorSpot, LOOSE_FOE_PLACE_ATTEMPTS,
    _inAnyLocationRect:()=>false, _nearRoad:()=>false, _overDeepWater:()=>false,
    CAMP_ROAD_CLEAR_M, PACK_SPACING, PACK_ALERT_RADIUS, CAMP_SIGHT_RADIUS,
    campMembers:a=>a, placeFoeEnv, placeFoeFreely, entityOccupancy, _placingPool:()=>spawned,
    ENEMY_BASICS:{0:{behaviour:'General'}}, BOUNTY_GROUP_REACH_M:150, _bountyTrailSpot:()=>null,
    exteriorFoes:{newCampId:()=>1,spawnFoe:async (mobileType,p,opts)=>{
      const f={mobileType,ai:{feet:p},entity:{},opts};spawned.push(f);return f;
    }}
  };
  const stand=new Function(...Object.keys(deps),`${camp}\n${bounty}\nreturn _standBountyPack;`)(...Object.values(deps));
  return {spawned,run:(count=4)=>{
    const old=Math.random;Math.random=random;
    try{return stand({id:'fixture',mobileType:0,count});}finally{Math.random=old;}
  }};
}

// A broad enclosed rock shell: the terrain runs under it. Both near-surface
// overlap and the 8m member rays miss its walls when the anchor is deep inside.
function shell() {
  const p=new Float32Array([-20,-5,100,20,-5,100,20,20,100,-20,20,100,-20,-5,140,20,-5,140,20,20,140,-20,20,140]);
  const i=new Uint32Array([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2]);
  const c=new Collider(()=>0);c.addMesh('rock',p,i,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);return c;
}

test('bounty rock: blocked anchor is retried and no foe is stood inside the shell', async()=>{
  const c=shell();
  const h=worldStand({collider:c,feet:[0,0,205]});
  const stood=h.run(); if(stood)await stood.foes;
  assert.equal(stood,null);
  assert.equal(h.spawned.length,0);
});

test('bounty rock: unchanged clear meadow still stands the requested fixed pack', async()=>{
  const h=worldStand({collider:new Collider(()=>0),feet:[0,0,205]});
  const stood=h.run(4);assert.ok(stood);await stood.foes;
  assert.ok(h.spawned.length>0);
  assert.ok(h.spawned.every(f=>f.opts.loose&&f.opts.transient));
});

test('bounty rock: actual ARCH3D 60711 / WoD Large00 object8 refuses the terrain below its shell', {skip:!process.env.ARENA2_PATH}, async()=>{
  const a=new Arch3dFile();a.load(new Uint8Array(readFileSync(`${process.env.ARENA2_PATH}/ARCH3D.BSA`)));
  const o=loadLocationPrefab(readFileSync(new URL('../../../vendor/world-of-daggerfall/LocationPrefab/WOD_Rocks_Large_00.txt',import.meta.url),'utf8')).obj.find(o=>o.objectID===8);
  const cpu=dfMeshToModel(a.getMesh(a.getRecordIndex(60711)),()=>({width:64,height:64}));
  const m=objectMatrix([o.pos.x,o.pos.y,o.pos.z],o.rot,o.scale);
  const c=new Collider(()=>0);c.addMesh('actual-rock',cpu.positions,cpu.indices,m);
  const inside=[0,1.25,123.5];
  assert.equal(c.sphereOverlaps(inside,.65),false,'the surface-only overlap misses the inside');
  assert.ok(c.raycastHit(inside,[0,1,0],200).dist>10,'the rock shell is far above the candidate');
  assert.ok(c.raycastHit([0,30,123.5],[0,-1,0],200).dist<30,'a player on the shell cannot descend to this terrain floor');
  const h=worldStand({collider:c,feet:[0,0,205]});
  const stood=h.run();if(stood)await stood.foes;
  assert.equal(stood,null);
  assert.equal(h.spawned.length,0);
});

test('bounty rock: final members are checked even when their anchor is clear', async()=>{
  let calls=0;
  const h=worldStand({collider:new Collider(()=>0),feet:[0,0,205],inRock:()=>++calls!==1});
  assert.equal(h.run(),null);
  assert.equal(h.spawned.length,0);
  assert.ok(calls>4,'every member tries again instead of standing on refused ground');
});

test('bounty rock: existing farm-building exclusion remains in force',()=>{
  const h=worldStand({collider:new Collider(()=>0),feet:[0,0,205],inBuilding:()=>true});
  assert.equal(h.run(),null);
});

test('bounty rock: geometry crosses pixel boundaries and unloading removes exclusion',()=>{
  const c=shell();
  assert.equal(c.insideSolid([0,0.5,120]),true);
  assert.equal(c.insideSolid([21,0.5,120]),false,'outside the solid remains valid');
  c.removeBucket('rock');
  assert.equal(c.insideSolid([0,0.5,120]),false,'unloaded geometry does not remain stale');
});

test('bounty rock: a fully buried rock contributes no footprint on flat or raised terrain',()=>{
  const p=new Float32Array([-2,-5,-2,2,-5,-2,0,-1,2]);
  const m=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  assert.equal(rockFootprint(p,[0,1,2],m,new Float32Array(129*129)),null);
  assert.equal(rockFootprint(p,[0,1,2],m,new Float32Array(129*129).fill(.2)),null);
});

test('bounty rock: trail spot retries solid obstructions and refuses an entirely covered trail',()=>{
  const trail=world.slice(world.indexOf('  const _bountyTrailSpot ='),world.indexOf('  const _standBountyPack ='));
  let tries=0,allow=3;
  const dep={state:{pixelTranslation:()=>[100,0,200]},farmSpotLocal:(_id,k)=>[k*10,20],collider:new Collider(()=>0),
    _inAnyLocationRect:()=>false,_nearRoad:()=>false,_overDeepWater:()=>false,bountyFarms:{occupied:()=>false},
    _inRock:()=>++tries<=allow};
  const pick=new Function(...Object.keys(dep),`${trail}\nreturn _bountyTrailSpot;`)(...Object.values(dep));
  assert.deepEqual(pick('hunt',1,1),[130,0,220]);
  tries=0;allow=8;
  assert.equal(pick('hunt',1,1),null);
  assert.equal(tries,8,'same bounded attempts, no unbounded loop');
});

test('bounty rock: a refused pack stays held, earns no reward and retries after four seconds',async()=>{
  let board,here=null,allowed=false,calls=0;
  const entity={goldPieces:0,items:[]}, pool=[];
  const host=createBountyHost({now:()=>900*1440,level:()=>5,entity:()=>entity,townName:()=> 'Daggerfall',siteOk:()=>true,
    playerPixel:()=>here,canStand:()=>true,say:()=>{},showNotice:()=>true,openBoardWindow:d=>{board=d;},foePool:()=>pool,
    standPack:({count})=>{calls++;if(!allowed)return null;const foes=Array.from({length:count},()=>({dead:false,entity:{health:10}}));pool.push(...foes);return {foes:Promise.resolve(foes),dx:0,dz:80};}});
  host.openBoard({px:300,py:200,name:'Daggerfall'});
  const p=board.rows().find(r=>r.posting.kind!=='dungeon').posting;
  assert.equal(board.take(p.id).ok,true);here={x:p.target.px,y:p.target.py};
  host.tick(.5);assert.equal(calls,1);
  host.tick(BOUNTY_RETRY_S-.5);assert.equal(calls,1);
  assert.equal(host.held().length,1);assert.equal(host.held()[0].killed,0);assert.equal(entity.goldPieces,0);
  allowed=true;host.tick(.5);await Promise.resolve();
  assert.equal(calls,2);assert.ok(pool.length>0);assert.equal(host.held().length,1);
});

test('bounty rock: 10000 geometry checks reject solid interiors and allow open ground',()=>{
  const c=shell();
  let seed=41286;
  const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
  for(let i=0;i<10000;i++){
    const x=rand()*38-19,z=101+rand()*38;
    assert.equal(c.insideSolid([x,0.5,z]),true);
    assert.equal(c.insideSolid([x+100,0.5,z]),false);
  }
});
