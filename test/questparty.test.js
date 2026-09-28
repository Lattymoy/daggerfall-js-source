// QUEST-PARTY phase 1 (2026-09-26, Mac: "Party shares them"). Online a quest stayed its player's own (Multiplayer.md's
// first lock): a party that shared one ran a copy each, and each copy stood its own foes no one else saw - two players on
// the ship raid fought two raids. Now a quest SHARED with the party streams its foes to the party (the frame's `qf`), a
// member stands them and fights them, and each member's own copy counts the injuries and the kills it sees; a receiver
// stands no wave while the member who shared the quest stands near; anyone outside the party never sees them, and a
// peer's blow and a quest foe's hunt reach only the party. Driven over the helpers, two real encounter pools and a
// third stranger, and the world host by source.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { questShareTag, sharedQuestFoe, partnerStandsQuestFoes, QUEST_SHARE_RADIUS } from '../src/scenes/questFoeHost.js';
import { createExteriorFoes, QUEST_PUPPETS_MAX } from '../src/scenes/exteriorFoes.js';
import { isPeerTarget } from '../src/characters/enemyTargets.js';
import { CELL_FRAME_RECORDS_MAX } from '../src/net/wire.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// a machine's shape, as the helpers read it: quests by uid and by name, the names kept in step with the party
function machineWith({ shared = true, tombstoned = false } = {}) {
  const pirate = { isFoe: true, symbol: { name: '_pirate_' }, killCount: 0, injuredTrigger: false, incrementKills() { this.killCount++; }, setInjured() { this.injuredTrigger = true; } };
  const quest = { uid: 7, questName: 'WAQ_SHIP_SMALLRAID', questTombstoned: tombstoned, resources: new Map([['_pirate_', pirate], ['_npc_', { isFoe: false, symbol: { name: '_npc_' } }]]) };
  return {
    pirate,
    getQuest: (uid) => (uid === 7 ? quest : null),
    hasSharedQuestNamed: (n) => shared && n === quest.questName,
    sharedCandidateNamed: (n) => (n === quest.questName && !quest.questTombstoned ? quest : null),
  };
}
const questFoe = (symbol = '_pirate_') => ({ questBehaviour: { questUID: 7, targetSymbol: { name: symbol } } });

test('QUEST-PARTY: a quest foe carries its quest\'s word only while the quest is shared and its player partied; a member\'s copy finds its own Foe by the word', () => {
  const m = machineWith();
  assert.deepEqual(questShareTag(m, questFoe(), true), { q: 'WAQ_SHIP_SMALLRAID', s: '_pirate_' });
  assert.equal(questShareTag(m, questFoe(), false), null, 'no party, no share');
  assert.equal(questShareTag(machineWith({ shared: false }), questFoe(), true), null, 'a quest not shared stays its player\'s own');
  assert.equal(questShareTag(machineWith({ tombstoned: true }), questFoe(), true), null, 'nor a finished one');
  assert.equal(questShareTag(m, { questBehaviour: null }, true), null, 'nor a foe of no quest');
  assert.equal(sharedQuestFoe(m, { q: 'WAQ_SHIP_SMALLRAID', s: '_pirate_' }), m.pirate);
  assert.equal(sharedQuestFoe(m, { q: 'WAQ_SHIP_SMALLRAID', s: '_npc_' }), null, 'a Person is no Foe');
  assert.equal(sharedQuestFoe(machineWith({ shared: false }), { q: 'WAQ_SHIP_SMALLRAID', s: '_pirate_' }), null, 'a quest I do not share counts nothing');
});

test('QUEST-PARTY: a receiver stands no wave while the member who shared the quest - still in its party - stands within reach', () => {
  const base = { questName: 'WAQ_SHIP_SMALLRAID', sharerOf: (q) => (q === 'WAQ_SHIP_SMALLRAID' ? 'acct-amy' : undefined), inMyParty: (a) => a === 'acct-amy', accountOfPeer: (id) => (id === 'amy-0003' ? 'acct-amy' : 'acct-bob'), myFeet: [0, 0, 0] };
  assert.equal(partnerStandsQuestFoes({ ...base, peers: [{ id: 'amy-0003', feet: [30, 0, 0] }] }), true, 'the sharer near: its copy stands the wave');
  assert.equal(partnerStandsQuestFoes({ ...base, peers: [{ id: 'amy-0003', feet: [QUEST_SHARE_RADIUS + 20, 0, 0] }] }), false, 'out of reach: this copy stands its own');
  assert.equal(partnerStandsQuestFoes({ ...base, peers: [{ id: 'bob-0002', feet: [5, 0, 0] }] }), false, 'another player near is not the sharer');
  assert.equal(partnerStandsQuestFoes({ ...base, inMyParty: () => false, peers: [{ id: 'amy-0003', feet: [5, 0, 0] }] }), false, 'a sharer who left the party shares nothing');
  assert.equal(partnerStandsQuestFoes({ ...base, sharerOf: () => undefined, peers: [{ id: 'amy-0003', feet: [5, 0, 0] }] }), false, 'the one who shared it stands its own');
  assert.equal(partnerStandsQuestFoes({ ...base, peers: null }), false, 'offline');
});

// the WORLD6b-ii rig: a synthetic MONSTER.BSA on flat open ground, with a net
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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg({ hpPerLevel: 40 })]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const PARTY = new Set(['host-0001', 'amy-0003', 'cat-0004']);
function pool(self, { peers = () => [], shared = () => true } = {}) {
  const pe = playerEntity();
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers, now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  const credit = { hurt: [], died: [] };
  p.setQuestShare({
    tagOf: (f) => (shared() && f.questBehaviour ? { q: 'WAQ_SHIP_SMALLRAID', s: f.questBehaviour.targetSymbol.name } : null),
    accepts: (from) => PARTY.has(self) && PARTY.has(from),
    peerMayHit: (peerId, f) => PARTY.has(peerId) && f.entity?.team !== 'PlayerAlly' && shared(),
    onPuppetHurt: (tag) => credit.hurt.push(tag.s),
    onPuppetDied: (tag) => credit.died.push(tag.s),
  });
  return { p, pe, credit };
}
async function questFoes(p, n, at = [100, 0, 100]) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = await p.spawnFoe(0, [at[0] + i, at[1], at[2]], { feetGiven: true, loose: true });   // loose: past the encounter cap, as a quest's wave stands
    f.questBehaviour = { questUID: 7, targetSymbol: { name: '_pirate_' }, update() {} };   // bound as the quest's foe (isQuestFoe reads it)
    out.push(f);
  }
  return out;
}

test('QUEST-PARTY executed: a shared quest\'s foes ride tagged, a party member stands them and a stranger none; a quest not shared stays home', async () => {
  let shared = false;
  const host = pool('host-0001', { shared: () => shared });
  await questFoes(host.p, 3);
  assert.equal(host.p.foesFrame(true).f.length, 0, 'not shared: its foes are its quest\'s own, as ever');
  shared = true;
  const frame = host.p.foesFrame(true);
  assert.equal(frame.f.length, 3);
  assert.deepEqual(frame.qf.map((e) => e.slice(1)), [['WAQ_SHIP_SMALLRAID', '_pirate_'], ['WAQ_SHIP_SMALLRAID', '_pirate_'], ['WAQ_SHIP_SMALLRAID', '_pirate_']]);
  const amy = pool('amy-0003'), bob = pool('bob-0002');
  amy.p.applyFoes('host-0001', frame);
  bob.p.applyFoes('host-0001', frame);
  await settle();
  assert.equal(amy.p.foes.filter((f) => f.puppet === 'host-0001' && !f.dead && f._pupQuest).length, 3, 'the party member stands the raid');
  assert.equal(bob.p.foes.filter((f) => f.puppet === 'host-0001').length, 0, 'a stranger never sees it');
  const junk = pool('amy-0003');
  junk.p.applyFoes('host-0001', { ...frame, qf: [[frame.f[0].i, 'bad name!', '_pirate_'], 'x', [1, 2]] });
  await settle();
  assert.equal(junk.p.foes.filter((f) => f._pupQuest).length, 0, 'a malformed word names no quest foe');
});

test('QUEST-PARTY executed: the host takes a party member\'s blow on a shared quest foe and refuses a stranger\'s, a quest ally\'s and an unshared quest\'s - and a member\'s copy counts the injury once and the kill once', async () => {
  let shared = true;
  const host = pool('host-0001', { shared: () => shared });
  const [a, b] = await questFoes(host.p, 2);
  const amy = pool('amy-0003');
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  await settle();
  const hit = (from, f, dmg) => host.p.applyHit(from, { k: 'world:3,12', i: f.seq, dmg, kind: 'melee', p: [f.ai.feet[0] + 1, 0, f.ai.feet[2]], d: [1, 0, 0] });
  const h0 = a.entity.health;
  assert.equal(hit('bob-0002', a, 3), false, 'a stranger\'s blow is refused');
  assert.equal(a.entity.health, h0);
  assert.equal(hit('amy-0003', a, 3), true, 'the party\'s lands');
  assert.ok(a.entity.health < h0);
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  assert.deepEqual(amy.credit.hurt, ['_pirate_'], 'the member\'s copy reads the injury');
  hit('amy-0003', a, 2);
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  assert.equal(amy.credit.hurt.length, 1, 'once');
  hit('amy-0003', a, 10000);
  assert.equal(a.dead, true);
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  assert.deepEqual(amy.credit.died, ['_pirate_'], 'and the kill, once');
  hit('amy-0003', b, 1); hit('cat-0004', b, 1);
  assert.equal(host.p.foesFrame(true).f.find((r) => r.i === b.seq)?.n, 2, 'a shared quest foe counts who fights it, as any shared foe (PSCALE1)');
  b.entity.team = 'PlayerAlly';
  assert.equal(hit('amy-0003', b, 3), false, 'a quest\'s own ally takes no peer\'s blow');
  b.entity.team = null;
  shared = false;
  assert.equal(hit('amy-0003', b, 3), false, 'a quest not shared takes no peer\'s blow at all - any peer\'s word landed on one before');
});

test('QUEST-PARTY executed: a shared quest foe hunts the party and never a stranger; an unshared one hunts no peer at all; a member stands at most the quest allowance, and a crowded frame keeps the quest\'s foes', async () => {
  const near = [{ id: 'bob-0002', feet: [101, 0, 100] }, { id: 'amy-0003', feet: [106, 0, 100] }];
  let shared = true;
  const host = pool('host-0001', { peers: () => near, shared: () => shared });
  const [f] = await questFoes(host.p, 1);
  f.ai.isHostile = true;
  const me = [160, 0, 160];
  const step = (n) => { for (let i = 0; i < n; i++) host.p.update(0.05, me, [me[0], 1.6, me[2]], senses(host.pe)); };
  step(40);
  assert.ok(isPeerTarget(f.ai.target), 'it hunts a peer');
  assert.equal(f.ai.target.id, 'amy-0003', 'the party member - never the stranger standing closer');
  shared = false;
  f.ai.target = null;
  step(40);
  assert.ok(!isPeerTarget(f.ai.target), 'unshared, it hunts no peer: none stands a puppet of it');
  shared = true;
  const big = pool('host-0001', { shared: () => true });
  await questFoes(big.p, 30);
  const amy = pool('amy-0003');
  amy.p.applyFoes('host-0001', big.p.foesFrame(true));
  await settle();
  assert.equal(amy.p.foes.filter((x) => x.puppet === 'host-0001' && !x.dead).length, QUEST_PUPPETS_MAX, 'the quest allowance');
  assert.ok(QUEST_PUPPETS_MAX >= 20, 'a raid\'s thirteen and its crew stand whole');
  const crowd = pool('host-0001', { shared: () => true });
  for (let i = 0; i < 60; i++) await crowd.p.spawnFoe(0, [300 + i, 0, 300], { feetGiven: true, loose: true, transient: true, managed: true });
  await questFoes(crowd.p, 10, [400, 0, 400]);
  const packed = crowd.p.foesFrame(true);
  assert.equal(packed.f.length, CELL_FRAME_RECORDS_MAX, 'the frame at its bound');
  assert.equal(packed.qf.length, 10, 'and every one of the quest\'s foes in it - the sea\'s own are cut first');
});

test('QUEST-PARTY by source: the world host keeps who shared each quest, hands the pool the party\'s law, and a receiver\'s wave counts as placed while the sharer stands near', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(!result\.resync && acct\) _questSharer\.set\(quest\.questName, acct\);/, 'a fresh receipt names its sharer');
  assert.match(w, /tagOf: \(f\) => questShareTag\(questBridge\?\.machine, f, !!social\?\.party\),/);
  assert.match(w, /accepts: \(from\) => !!social\?\.isPartyPeer\(from\),/);
  assert.match(w, /peerMayHit: \(peerId, f\) => !!social\?\.isPartyPeer\(peerId\) && f\.entity\?\.team !== 'PlayerAlly' && !!questShareTag\(questBridge\?\.machine, f, !!social\?\.party\),/);
  assert.match(w, /onPuppetHurt: \(tag\) => sharedQuestFoe\(questBridge\?\.machine, tag\)\?\.setInjured\?\.\(\),/);
  assert.match(w, /onPuppetDied: \(tag\) => sharedQuestFoe\(questBridge\?\.machine, tag\)\?\.incrementKills\?\.\(\),/);
  assert.match(w, /if \(partnerStandsQuestFoes\(\{ questName: handle\.foe\?\.parentQuest\?\.questName, sharerOf: \(q\) => _liveSharer\(q\), inMyParty: \(a\) => !!social\?\.inMyParty\(a\), peers: peersNear\(\), accountOfPeer: \(id\) => social\?\.accountOfPeer\(id\), myFeet: feet \}\)\) return true;/, 'the exterior arm: counted as placed, stood by the sharer');
});
