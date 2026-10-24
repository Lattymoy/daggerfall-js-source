import '../modsOff.js';
import test from 'node:test';
import { foeHandoverFrames } from '../../src/world/foeHandover.js';
import { FOES_FRAME_MAX } from '../../src/net/wire.js';
import assert from 'node:assert/strict';
import {createExteriorFoes} from '../../src/scenes/exteriorFoes.js';
import {eliteRng, promoteEliteFoe} from '../../src/systems/eliteFoes.js';
import {validFoeRecord} from '../../src/net/wire.js';
import { goldStack } from '../../src/systems/inventory.js';
function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const poolRig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },   // the pursuit walks on open flat ground
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex,
  uploadRecordFrame: () => {},
  currentMinute: () => 0,
  currentPixelKey: () => '3,12',
  playerEntity: playerEntity(),
  audio: null,
  onPlayerHurt: () => {},
  rolls: () => 0.01,
  rand: () => 0.01,
  ...extra,
});

const net = (id = 'audit-player') => ({ selfId: () => id, room: () => 'world:3,12', peers: () => [], toWire: p => [...p], toScene: p => [...p] });
function onlinePool() {
  const player = playerEntity();
  player.level = 30; player.skills.fill(200);
  const pool = createExteriorFoes(poolRig({ inLocation: () => false, playerEntity: player, rolls: eliteRng(19) }));
  pool.setNet(net());
  return pool;
}
async function withRandom(value, fn) {
  const old = Math.random;
  Math.random = () => value;
  try { return await fn(); } finally { Math.random = old; }
}

const own = p => p.foes.filter(f => !f.puppet);
const spawn = p => withRandom(0.01, () => p.spawnFoe(0, [10,0,10], {feetGiven:true}));
const pair = () => { const a=onlinePool(),b=onlinePool();a.setNet(net('ann-0001'));b.setNet(net('bob-0002'));return [a,b]; };
for (const warm of [false,true]) test(`live loot survives handover through real pools, warm=${warm}`, async () => {
  const [a,b]=pair(),c=onlinePool();c.setNet(net('cat-0003'));
  try {
    const f=await spawn(a);promoteEliteFoe(f.entity, { checkLevel: false });f.entity.health=Math.floor(f.entity.maxHealth/2);
    f.entity.items = [goldStack(127)];   // Existing loot is the subject; generation is tested independently.
    const expected=structuredClone(f.entity.items);assert.ok(expected.length>0);
    const normal=a.foesFrame(true);assert.ok(normal.f.every(r=>r.it===undefined));
    if(warm){b.applyFoes('ann-0001',normal);await settle();await settle();}
    let sent;
    assert.equal(a.handOver(()=> 'bob-0002', frame=>{sent=structuredClone(frame);b.applyFoes('ann-0001',sent);c.applyFoes('ann-0001',sent);return true;}),1);
    await settle();await settle();
    assert.equal(own(a).length,0);assert.equal(own(b).length,1);assert.equal(own(c).length,0);
    const taken=own(b)[0];assert.deepEqual(taken.entity.items,expected);
    assert.equal(taken.entity.health,f.entity.health);assert.equal(taken.entity.maxHealth,f.entity.maxHealth);assert.equal(taken.entity.damageScale,f.entity.damageScale);assert.equal(taken.entity.eliteFoe,true);
    taken.entity.items.length=0;
    b.applyFoes('ann-0001',{...sent,n:sent.n+1});await settle();
    assert.equal(own(b).length,1);assert.equal(own(b)[0],taken);assert.equal(taken.entity.items.length,0,'replay must not refill items');
    taken.dead=true;
    b.applyFoes('ann-0001',{...sent,n:sent.n+2});await settle();
    assert.equal(own(b).length,1);assert.equal(taken.dead,true,'replay must not resurrect');
  }finally{a.destroy();b.destroy();c.destroy();}
});
for (const throwing of [false,true]) test(`a failed sender retains foe and loot, throwing=${throwing}`,async()=>{
  const [a,b]=pair();try{
    const f=await spawn(a),items=structuredClone(f.entity.items);
    assert.equal(a.handOver(()=> 'bob-0002',()=>{if(throwing)throw Error('offline');return false;}),0);
    assert.equal(own(a)[0],f);assert.deepEqual(f.entity.items,items);
    assert.equal(a.handOver(()=> 'bob-0002',frame=>{b.applyFoes('ann-0001',frame);return true;}),1);
    await settle();await settle();assert.deepEqual(own(b)[0].entity.items,items);
  }finally{a.destroy();b.destroy();}
});
test('malformed inventory and wrong-room handovers are refused',async()=>{
  const [a,b]=pair();try{
    await spawn(a);const frame=a.handOverFrame(()=> 'bob-0002');
    b.applyFoes('ann-0001',{...frame,k:'world:99,99'});await settle();assert.equal(b.foes.length,0);
    const bad=structuredClone(frame);bad.n++;bad.f[0].it=[{group:'MadeUp',templateIndex:-1}];
    b.applyFoes('ann-0001',bad);await settle();assert.equal(b.foes.length,0);
    frame.n=bad.n+1;b.applyFoes('ann-0001',frame);await settle();await settle();assert.equal(own(b).length,1);
  }finally{a.destroy();b.destroy();}
});
test('unreadable owner inventory is retained, not converted to an empty reward',async()=>{
  const [a,b]=pair();try{
    const f=await spawn(a);f.entity.items=[{group:'MadeUp',templateIndex:-1}];let calls=0;
    assert.equal(a.handOver(()=> 'bob-0002',()=>{calls++;return true;}),0);assert.equal(calls,0);assert.equal(own(a)[0],f);
  }finally{a.destroy();b.destroy();}
});
test('wire accepts inventory only for a live named handover and bounds list count',()=>{
  const r={i:1,t:0,d:0,e:'bob-0002',it:[]};assert.deepEqual(validFoeRecord(r).it,[]);
  for(const bad of [{...r,e:undefined},{...r,d:1},{...r,it:{}},{...r,it:new Array(65).fill({})}])assert.equal(validFoeRecord(bad),null);
});
test('large handover batches preserve associated tags and obey the wire budget',()=>{
  const records=Array.from({length:8},(_,i)=>({i:i+1,e:'bob-0002',it:[{name:'x'.repeat(20000)}]}));
  const frame={n:1,k:'world:3,12',f:records,st:records.map(r=>[r.i,'site']),cz:records.map(r=>[r.i,7]),qf:records.map(r=>[r.i,'quest']),rz:records.map(r=>[r.i,'raid']),dz:[1,4],al:[2],cw:[3],cp:[3,7],cn:['Alice','Bob']};
  let n=1;const batches=foeHandoverFrames(frame,()=>++n);assert.ok(batches.length>1);
  assert.deepEqual(batches.flatMap(f=>f.f),records);
  for(const [i,b]of batches.entries()){
    assert.equal(b.n,i+2);assert.equal(b.full,0);assert.ok(JSON.stringify({t:'foes',data:b}).length<=FOES_FRAME_MAX);
    const ids=b.f.map(r=>r.i);for(const key of ['st','cz','qf','rz'])assert.deepEqual(b[key],frame[key].filter(r=>ids.includes(r[0])));
    for(const key of ['dz','al','cw','cp'])assert.deepEqual(b[key]??[],frame[key].filter(id=>ids.includes(id)));
    assert.deepEqual(b.cn??[],(b.cp??[]).map(id=>frame.cn[frame.cp.indexOf(id)]));
  }
  assert.deepEqual(foeHandoverFrames({...frame,f:[{i:99,e:'bob',it:['x'.repeat(FOES_FRAME_MAX)]}]},()=>++n),[]);
});

test('a mid-batch send failure releases only accepted batches',async()=>{
  const [a,b]=pair();try{
    for(let i=0;i<5;i++){
      const f=await spawn(a);
      f.entity.items=Array.from({length:64},()=>({group:'Weapons',templateIndex:113,material:1,notes:'x'.repeat(256),extra:'y'.repeat(256)}));
    }
    const before=own(a);let attempts=0,accepted=[];
    const dropped=a.handOver(()=> 'bob-0002',frame=>{attempts++;if(attempts>1)return false;accepted=frame.f.map(r=>r.i);return true;});
    assert.ok(attempts>1,'multiple bounded batches are necessary');assert.ok(dropped>0&&dropped<before.length);
    assert.equal(dropped,accepted.length);assert.equal(own(a).length,before.length-dropped);
    assert.ok(own(a).every(f=>!accepted.includes(f.seq)&&f.entity.items.length===64));
  }finally{a.destroy();b.destroy();}
});
