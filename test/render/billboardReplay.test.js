import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBillboardReplay} from '../../src/render/billboardReplay.js';
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function setup(){
  const calls=[],renderer={_view:identity(),_proj:identity(),_bbRight:new Float32Array(3),_bbUp:new Float32Array(3),drawBillboards(batches,right,up){this._bbRight.set(right);this._bbUp.set(up);calls.push({batches,right:[...right],up:[...up]});}};
  return {renderer,calls};
}
test('direct pattern reads captured per-sprite basis without issuing another native draw',()=>{
  const {renderer:r,calls}=setup(),replay=createBillboardReplay(r),batch={};replay.setEnabled(true);
  assert.equal(replay.basis(batch),null);r.drawBillboards([batch],[-1,0,0],[0,.8,.6]);
  const count=calls.length,basis=replay.basis(batch);assert.ok(basis);assert.equal(calls.length,count);
  assert.deepEqual([...basis.right],[-1,0,0]);r._view[12]=1;assert.equal(replay.basis(batch),null);replay.dispose();
});
test('party and enemy replay retain their own basis after a swinging lantern, without advancing animation',()=>{
  const {renderer:r,calls}=setup(),original=r.drawBillboards,a=createBillboardReplay(r),b=createBillboardReplay(r);
  const party={},enemy={},lamp={};a.setEnabled(true);b.setEnabled(true);a.track(party);b.track(enemy);
  r._proj[0]=-.123456789; // normal JS matrices must not fail an artificial float32 equality check
  r.drawBillboards([party,enemy],[-1,0,0],[0,1,0]);
  r.drawBillboards([lamp],[-.8,.6,0],[.6,.8,0]);
  const tilted=[...r._bbRight];assert.equal(a.draw(party),true);assert.equal(b.draw(enemy),true);
  assert.deepEqual(calls.at(-1).right,[-1,0,0]);assert.deepEqual(calls.at(-1).up,[0,1,0]);assert.deepEqual([...r._bbRight],tilted);
  a.dispose();assert.notEqual(r.drawBillboards,original);b.dispose();assert.equal(r.drawBillboards,original);
});
test('new sprites and changed cameras wait for their real draw; raised-view lean is preserved',()=>{
  const {renderer:r,calls}=setup(),replay=createBillboardReplay(r),sprite={};replay.setEnabled(true);
  assert.equal(replay.draw(sprite),false);
  r.drawBillboards([sprite],[-1,0,0],[0,.8,.6]);assert.equal(replay.draw(sprite),true);
  assert.ok(Math.abs(calls.at(-1).up[2]-.6)<1e-6);
  r._view[12]=3;assert.equal(replay.draw(sprite),false);
  r.drawBillboards([sprite],[-1,0,0],[0,1,0]);assert.equal(replay.draw(sprite),true);
  replay.setEnabled(false);assert.equal(replay.draw(sprite),false);replay.dispose();
});
test('throwing draws restore replay bookkeeping and cached axes',()=>{
  const {renderer:r}=setup(),native=r.drawBillboards;let fail=false;
  r.drawBillboards=function(...args){native.apply(this,args);if(fail)throw Error('synthetic');};
  const replay=createBillboardReplay(r),sprite={};replay.setEnabled(true);replay.track(sprite);
  r.drawBillboards([sprite],[-1,0,0],[0,1,0]);r.drawBillboards([{}],[0,1,0],[1,0,0]);
  fail=true;assert.throws(()=>replay.draw(sprite),/synthetic/);assert.deepEqual([...r._bbRight],[0,1,0]);
  fail=false;r.drawBillboards([sprite],[1,0,0],[0,1,0]);assert.equal(replay.draw(sprite),true);replay.dispose();
});
