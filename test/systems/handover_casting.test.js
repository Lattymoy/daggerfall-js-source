import '../modsOff.js';
import assert from 'node:assert/strict';
import {createExteriorFoes} from '../../src/scenes/exteriorFoes.js';
import {eliteRng} from '../../src/systems/eliteFoes.js';
import test from 'node:test';
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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY001.CFG', craftCfg()]]);
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
  spellsByIndex: () => new Map([7,10,29,44].map(i => [i, { index:i, name:'Audit bolt', element:0, rangeType:2, effects:[{type:0}] }])),
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

for (const mobileType of [0, 1]) test(`handover restores casting only for a caster (mobile ${mobileType})`, async () => {
  const owner=onlinePool(), heir=onlinePool();
  owner.setNet(net('ann-0001')); heir.setNet(net('bob-0002'));
  try {
    const original = await withRandom(0.8, () => owner.spawnFoe(mobileType, [10,0,10], {feetGiven:true}));
    heir.applyFoes('ann-0001', owner.foesFrame(true));
    await settle(); await settle();
    const puppet=heir.foes[0];
    assert.ok(puppet?.puppet);
    assert.equal(puppet.caster, null, 'a remote copy must not make independent cast decisions');
    const spells=puppet.entity.spells;
    puppet.entity.magicka=47;
    const frame=owner.handOverFrame(() => 'bob-0002');
    heir.applyFoes('ann-0001', frame);
    await settle(); await settle();
    const adopted=heir.foes.find(f => !f.puppet);
    assert.equal(adopted, puppet);
    assert.equal(adopted.entity.health, original.entity.health);
    assert.equal(adopted.entity.spells, spells, 'keep the resolved spell list');
    assert.equal(adopted.entity.magicka, 47, 'adoption itself must not refill mana');
    if (mobileType === 0) { assert.equal(adopted.caster, null); return; }
    assert.ok(adopted.caster, 'an adopted caster needs its decision driver');
    adopted.caster.rolls=() => 0;
    Object.assign(adopted.ai, {_dist:10,inSight:true,detected:true,giveUpTimer:5,yaw:0,hasClearPathToShootProjectile:() => true});
    const p=adopted.ai.feet;
    const decision=adopted.caster.update(0.5,adopted.ai,adopted.attack,[p[0],p[1],p[2]+10],{activeEffects:[]});
    assert.ok(decision?.spell, 'a clear, in-range target produces a real cast decision');
    assert.equal(adopted.ai.canCastRangedSpell(), true, 'the motor must read the adopted driver, not its old null closure');
    adopted.caster.selectedSpell=null;
    assert.equal(adopted.ai.canCastRangedSpell(), false);
    const driver=adopted.caster;
    heir.applyFoes('ann-0001',frame);
    assert.equal(adopted.caster,driver,'replaying the handover does not create a second driver');
  } finally {owner.destroy();heir.destroy();}
});
