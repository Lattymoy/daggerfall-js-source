import test from 'node:test';
import assert from 'node:assert/strict';
import {beaconKind,projectBeaconMarker,paintBeaconMapMarker,beaconMapBox} from '../../src/ui/travel/beaconMapMarker.js';
import {createTravelView} from '../../src/scenes/travelView.js';
test('typed campfire, tent and death fields survive the actual Overworld projection',()=>{
  let frame;const marks=['campfire','tent','skull'].map((beaconIcon,i)=>({key:String(i),at:[30,0,40],label:beaconIcon,kind:'place',beaconIcon,beaconBeam:false,beaconOpacity:.3,...(i===2?{deathId:'death-a'}:{})}));
  const view=createTravelView({canvas:{contains:()=>false},win:{addEventListener(){},removeEventListener(){}},feet:()=>[0,0,0],headView:()=>({eye:[0,1.7,0],fwd:[0,0,-1]}),yaw:()=>0,setYaw(){},heightAt:()=>0,cloudBase:()=>null,allowed:()=>({ok:true}),windowUp:()=>false,danger:()=>false,actionsOf:()=>[],movementHeld:()=>false,autopilot:()=>false,holdBody:()=>true,freeCursor(){},where:()=>'',project:p=>({x:p[0],y:p[2],front:true}),hud:{show(){},hide(){},update:f=>{frame=f;}},say(){},alive:()=>true,schedule:()=>({}),cancel(){},marks:()=>marks});
  try{view.enter();for(let i=0;i<200;i++)view.frame(1/60);view.drawHud();assert.deepEqual(frame.marks.map(beaconKind),['campfire','tent','skull']);assert.ok(frame.marks.every(m=>m.sub==='50 m'&&m.beaconBeam===false&&m.beaconOpacity===.3));assert.equal(frame.marks[2].deathId,'death-a');marks.length=0;view.drawHud();assert.equal(frame.marks.length,0);}finally{view.dispose();}
});
test('ordinary map marks stay ordinary; unknown distance is never fabricated',()=>{
  assert.deepEqual(projectBeaconMarker({kind:'place',at:[3,0,4]},[0,0,0]),{});
  assert.equal(projectBeaconMarker({beaconIcon:'tent',at:[NaN,0,4]},[0,0,0]).sub,'');
  assert.equal(projectBeaconMarker({deathId:'a',at:[3000,0,4000]},[0,0,0]).sub,'5.0 km');
});
test('beacons use icons and subtext below, never a tile, and edges are icon-only',()=>{
  const calls=[],gradient={addColorStop(){}};const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:k==='createLinearGradient'?()=>gradient:(...a)=>calls.push([k,...a]),set:(o,k,v)=>(o[k]=v,true)});
  for(const type of ['campfire','tent','skull']){
    calls.length=0;const q={x:100,y:120,m:{beaconIcon:type,label:type,sub:'50 m'}};
    assert.equal(paintBeaconMapMarker(ctx,q,400),true);assert.deepEqual(calls.filter(c=>c[0]==='fillText').map(c=>c[1]),[type,'50 m']);assert.ok(calls.filter(c=>c[0]==='fillText').every(c=>c[3]>q.y));assert.ok(!calls.some(c=>c[0]==='fillRect'));
    const box=beaconMapBox(q,400);assert.ok(box.x1-box.x0<=180);assert.ok(box.y1>=149);
    calls.length=0;paintBeaconMapMarker(ctx,{...q,held:{angle:0}},400);assert.ok(!calls.some(c=>c[0]==='fillText'));
  }
});
