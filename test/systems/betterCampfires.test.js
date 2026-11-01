import test from 'node:test';
import assert from 'node:assert/strict';
import {ownCampMarks,campOverworldMarks,campBeamStyle} from '../../src/systems/betterCampfires.js';
test('only owned visible camps survive; packing and floating origin are live',()=>{
 const mine={rec:{id:1,kind:'fire',pos:[0,0,0]},batch:{size:{h:2}}},other={owner:'peer',rec:{pos:[0,0,0]}};
 const pool={camps:[mine,other,{...mine,hidden:true}]};assert.deepEqual(ownCampMarks(pool,[0,0,0])[0].at,[0,2,0]);assert.equal(campOverworldMarks(pool).length,1);
 mine.rec.pos[0]=30;assert.equal(campOverworldMarks(pool)[0].at[0],30);pool.camps=[];assert.equal(ownCampMarks(pool,[0,0,0]).length,0);
});
test('distance scales height/opacity with hard bounds and depth occlusion',()=>{
 const near=campBeamStyle(2),far=campBeamStyle(200);assert.equal(near.height,5);assert.equal(far.height,100);assert.ok(near.opacity<far.opacity);assert.equal(far.opacity,.6);assert.equal(far.throughWalls,false);
 assert.equal(campBeamStyle(500,{height:1000,opacity:9}).height,100);assert.equal(campBeamStyle(500,{height:1000,opacity:9}).opacity,.6);
});
