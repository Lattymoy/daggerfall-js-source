// Regression tests execute the real outdoor spawn/save/restore pool with synthetic art/career fixtures.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { eliteRng, rollOverworldElite, pickDungeonElites, promoteEliteFoe, grantEliteLoot, ELITE_FOE_OVERWORLD_CHANCE, ELITE_FOE_NORMAL_DUNGEON_CHANCE, ELITE_FOE_MIN_LEVEL } from '../../src/systems/eliteFoes.js';
// Ported onto ELITE-RARITY/ELITE-FLOOR (#536): an eligible kind (ENEMY002, level >= ELITE_FOE_MIN_LEVEL) and the live odds.
import { setPref } from '../../src/systems/uiPrefs.js';
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
const bsa = craftMonsterBsa([['ENEMY002.CFG', craftCfg()]]);
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
async function restored(pool, saved) {
  pool.clearLive();
  pool.restoreWorld(saved, (x,z) => [x,z]);
  for (let i = 0; i < 20 && !pool.foes.length; i++) await settle();
  assert.equal(pool.foes.length, 1, 'the actual async spawn completed');
  return pool.foes[0];
}
for (const wasElite of [false,true]) {
 test(`elite persistence: ${wasElite ? 'elite stays elite' : 'normal stays normal'} when reload dice disagree`, async () => {
  setPref('lootRarity', false);
  const pool = onlinePool();
  try {
   const f = await withRandom(wasElite ? 0.01 : 0.99, () => pool.spawnFoe(2, [10,0,10], {feetGiven:true}));
   assert.equal(!!f.entity.eliteFoe, wasElite);
   f.entity.health = Math.max(1, Math.floor(f.entity.maxHealth / 3));
   const expected = { hp:f.entity.health, max:f.entity.maxHealth, damage:f.entity.damageScale, items: structuredClone(f.entity.items) };
   const saved = pool.snapshotWorld(p => ({x:p[0],z:p[2]}));
   const after = await withRandom(wasElite ? 0.99 : 0.01, () => restored(pool,saved));
   console.log(JSON.stringify({wasElite,restoredElite:!!after.entity.eliteFoe,hpBefore:expected.hp,hpAfter:after.entity.health,damageBefore:expected.damage,damageAfter:after.entity.damageScale,lootKept:JSON.stringify(after.entity.items)===JSON.stringify(expected.items)}));
   assert.equal(!!after.entity.eliteFoe, wasElite, 'reload must not reroll classification');
   assert.equal(after.entity.health, expected.hp);
   assert.equal(after.entity.maxHealth, expected.max);
   assert.equal(after.entity.damageScale, expected.damage);
   assert.deepEqual(after.entity.items, expected.items, 'restore preserves the exact saved reward, no fresh elite loot');
  } finally { pool.destroy(); }
 });
}
test('legacy outdoor snapshots do not acquire a new elite on load',async()=>{
 const pool=onlinePool();
 try{
  await withRandom(0.99,()=>pool.spawnFoe(2,[10,0,10],{feetGiven:true}));
  const saved=pool.snapshotWorld(p=>({x:p[0],z:p[2]}));delete saved[0].eliteFoe;
  const f=await withRandom(0.01,()=>restored(pool,saved));
  assert.equal(!!f.entity.eliteFoe,false);
 }finally{pool.destroy();}
});
test('new outdoor elite odds: 5 seeded streams, 1,000,000 rolls; strict ELITE_FOE_OVERWORLD_CHANCE boundary',()=>{
 const P=ELITE_FOE_OVERWORLD_CHANCE;
 assert.equal(rollOverworldElite(()=>0),true);
 assert.equal(rollOverworldElite(()=>P-1e-6),true);
 assert.equal(rollOverworldElite(()=>P),false);
 let total=0;
 for(const seed of [1,42,523,524,20261002]){
  const r=eliteRng(seed);let count=0;
  for(let i=0;i<200000;i++)if(rollOverworldElite(r))count++;
  assert.ok(Math.abs(count/200000-P)<0.002,`${seed}: ${count}`);total+=count;
 }
 console.log(`Outdoor RNG: ${total}/1000000 elites (${(total/10000).toFixed(4)}%).`);
});
test('dungeon elites: ELITE_FOE_NORMAL_DUNGEON_CHANCE of normal locations; 3-4 in elite locations; stable picks and exclusions',()=>{
 let normal=0,three=0,four=0;
 for(let key=0;key<10000;key++){
  const layout=()=>Array.from({length:40},(_,i)=>({mobileType:7,allied:i===0,reaction:i===1?'passive':'hostile',...(i===2?{champion:0}:{})}));
  const a=layout(),b=layout();
  const n=pickDungeonElites(a,key,{elite:false});normal+=n;
  assert.ok(n===0||n===1);
  pickDungeonElites(b,key,{elite:false});assert.deepEqual(a,b,'reloading the same dungeon does not reroll picks');
  const e=layout(),count=pickDungeonElites(e,key);
  assert.equal(e.slice(0,3).some(x=>x.eliteFoe),false,'allies, passive foes and champions are excluded');
  if(count===3)three++;else if(count===4)four++;else assert.fail(`elite count ${count}`);
 }
 assert.ok(Math.abs(normal/10000-ELITE_FOE_NORMAL_DUNGEON_CHANCE)<0.02);
 console.log(`Dungeon selection: ${normal}/10000 normal dungeons; elite dungeons: ${three} with 3, ${four} with 4.`);
});
test('elite promotion and bonus loot are idempotent on the same entity',()=>{
 const e={level:ELITE_FOE_MIN_LEVEL,health:10,maxHealth:10,items:[]};
 promoteEliteFoe(e);promoteEliteFoe(e);
 assert.equal(e.maxHealth,50);assert.equal(e.damageScale,3);
 grantEliteLoot(e,30,eliteRng(4));const items=structuredClone(e.items);
 for(let i=0;i<50;i++)grantEliteLoot(e,30,eliteRng(i));
 assert.deepEqual(e.items,items);
});
