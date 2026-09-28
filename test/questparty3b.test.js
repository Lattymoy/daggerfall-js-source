// QUEST-PARTY phase 3b (2026-09-26, Mac: "Dungeons and buildings"). A building streamed no foes (WORLD6b-iii(d)'s
// lock, and a world room was the host's alone), so a partner in the same shop saw me fight air, and a party's shared
// quest foe in a building - the palace's imp - stood a copy each. The relay's own lane (OWN1) carries a world room's
// foes as a cell carries them: each player streams the foes it owns there, everyone else stands them as puppets and
// strikes them through their owner, and a shared quest's foe rides to the party alone. A quest MARKER stands its foe in
// every copy of the quest at the same spot, so a marker's foe stands down to one for the party. Driven over two real
// encounter pools and the helper, and the hosts by source.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes, questMarkerYields } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('QUEST-PARTY 3b: a marker\'s foe stands down to one - my untouched copy to a touched one, or, both untouched, to the lower id; a touched copy never', () => {
  const law = (mineTouched, theirsTouched, myId, theirId) => questMarkerYields({ mineTouched, theirsTouched, myId, theirId });
  assert.equal(law(false, false, 'mmm-0002', 'aaa-0001'), true, 'both untouched: the higher id stands down');
  assert.equal(law(false, false, 'aaa-0001', 'mmm-0002'), false, 'and the lower keeps its own');
  assert.equal(law(false, true, 'aaa-0001', 'mmm-0002'), true, 'an untouched copy stands down to a touched one, whatever the ids');
  assert.equal(law(true, false, 'mmm-0002', 'aaa-0001'), false, 'a touched copy never stands down');
  assert.equal(law(true, true, 'mmm-0002', 'aaa-0001'), false, 'two fights begun keep both');
  assert.equal(law(false, false, null, 'aaa-0001'), false, 'offline, no one');
});

// the WORLD6b-ii rig: a synthetic MONSTER.BSA on flat open ground, with a net
function craftCfg({ hpPerLevel = 40, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
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
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const PARTY = new Set(['aaa-0001', 'mmm-0002', 'zzz-0009']);
const ROOM = 'interior:m187.4';
// a building's pool, as worldModes mounts one: the room's net (the own lane), the party's law
function pool(self) {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => null, playerInside: true,
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  const sent = [];
  p.setNet({ room: () => ROOM, inRoom: (k) => k === ROOM, selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: (hit) => { sent.push({ ...hit, own: 1 }); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  const credit = { died: [] };
  p.setQuestShare({
    tagOf: (f) => (f.questBehaviour ? { q: 'M0B00Y16', s: f.questBehaviour.targetSymbol.name } : null),
    accepts: (from) => PARTY.has(self) && PARTY.has(from),
    peerMayHit: (peerId) => PARTY.has(peerId),
    onPuppetHurt: () => {}, onPuppetDied: (tag) => credit.died.push(tag.s),
  });
  return { p, sent, credit };
}
const behaviour = (symbol = '_imp_') => ({ questUID: 7, targetSymbol: { name: symbol }, destroyed: false, update() {}, notifyDestroyed() { this.destroyed = true; } });
async function markerFoe(p, at = [10, 0, 10]) {
  const f = await p.spawnFoe(0, at, { feetGiven: true, loose: true, questMarker: true });
  f.questBehaviour = behaviour();
  return f;
}

test('QUEST-PARTY 3b executed: a marker\'s foe rides flagged (1, and 2 once a blow lands), a wave\'s bare; a flag past the law names nothing', async () => {
  const a = pool('aaa-0001');
  const imp = await markerFoe(a.p);
  const wave = await a.p.spawnFoe(0, [20, 0, 20], { feetGiven: true, loose: true });
  wave.questBehaviour = behaviour('_assassin_');
  const frame = a.p.foesFrame(true);
  const byI = new Map(frame.qf.map((e) => [e[0], e]));
  assert.deepEqual(byI.get(imp.seq), [imp.seq, 'M0B00Y16', '_imp_', 1], 'the marker\'s foe, untouched');
  assert.deepEqual(byI.get(wave.seq), [wave.seq, 'M0B00Y16', '_assassin_'], 'a wave\'s foe keeps the three-word tag');
  imp.entity.health = imp.entity.maxHealth - 3;
  assert.deepEqual(a.p.foesFrame(true).qf.find((e) => e[0] === imp.seq), [imp.seq, 'M0B00Y16', '_imp_', 3], 'touched');
  const m = pool('mmm-0002');
  m.p.applyFoes('aaa-0001', { ...frame, qf: frame.qf.map((e) => (e[0] === imp.seq ? [e[0], e[1], e[2], 7] : e)) });
  await settle();
  assert.equal(m.p.foes.filter((f) => f.puppet === 'aaa-0001' && f._pupQuest?.s === '_imp_').length, 0, 'a flag outside 0-3 is a malformed word: no quest foe');
});

test('QUEST-PARTY 3b executed: two party members in one building each stood the imp at its marker - the higher id\'s untouched copy stands down, its copy of the quest counts the other\'s, and a stranger\'s frame stands down nothing', async () => {
  const a = pool('aaa-0001'), m = pool('mmm-0002');
  const impA = await markerFoe(a.p), impM = await markerFoe(m.p);
  const bM = impM.questBehaviour;
  const wave = await m.p.spawnFoe(0, [30, 0, 30], { feetGiven: true, loose: true });
  wave.questBehaviour = behaviour('_imp_');   // the same quest's foe by the same symbol, but a wave's - not a marker's
  const fa = a.p.foesFrame(true), fm = m.p.foesFrame(true);
  a.p.applyFoes('mmm-0002', fm); m.p.applyFoes('aaa-0001', fa);
  await settle();
  assert.equal(impA.dead, false, 'the lower id keeps its imp');
  assert.equal(impM.dead, true, 'the higher id\'s untouched imp stands down');
  assert.equal(bM.destroyed, true, 'its quest resource uncoupled, as the cull\'s');
  assert.equal(wave.dead, false, 'a wave\'s foe of the same symbol is no marker\'s copy: it stands');
  assert.equal(m.p.foes.filter((f) => f.puppet === 'aaa-0001' && !f.dead && f._pupQuest?.s === '_imp_').length, 1, 'and it stands the lower id\'s');
  assert.deepEqual(m.p.foesFrame(true).f.map((r) => r.i), [wave.seq], 'the stood-down imp rides no more');
  // the lower id's imp falls: the higher id's copy counts the kill it saw
  impA.entity.health = 0; a.p.damageFoe(impA, 999, null, null, { fromPlayer: true });
  m.p.applyFoes('aaa-0001', a.p.foesFrame(true));
  assert.deepEqual(m.credit.died, ['_imp_'], 'the kill counts on the higher id\'s copy');
  // a stranger's frame never stands mine down
  const z = pool('bob-0005'), imp2 = await markerFoe(z.p);
  const n = pool('zzz-0009'), imp3 = await markerFoe(n.p);
  n.p.applyFoes('bob-0005', z.p.foesFrame(true));
  await settle();
  assert.equal(imp3.dead, false, 'a stranger\'s copy is none of the party\'s');
  assert.equal(imp2.dead, false);
  // nor does a party member's marker foe of ANOTHER symbol
  const lo = pool('aaa-0001'), ghost = await lo.p.spawnFoe(0, [10, 0, 10], { feetGiven: true, loose: true, questMarker: true });
  ghost.questBehaviour = behaviour('_ghost_');
  const hi = pool('mmm-0002'), imp4 = await markerFoe(hi.p);
  hi.p.applyFoes('aaa-0001', lo.p.foesFrame(true));
  await settle();
  assert.equal(imp4.dead, false, 'the ghost is not the imp');
});

test('QUEST-PARTY 3b executed: a copy already fallen stands nothing down - the member arriving after the kill keeps its own', async () => {
  const a = pool('aaa-0001'), m = pool('mmm-0002');
  const impA = await markerFoe(a.p);
  a.p.damageFoe(impA, 999, null, null, { fromPlayer: true });
  assert.equal(impA.dead, true);
  const impM = await markerFoe(m.p);
  m.p.applyFoes('aaa-0001', a.p.foesFrame(true));
  await settle();
  assert.equal(impM.dead, false, 'a body is no copy standing');
});

test('QUEST-PARTY 3b executed: my copy a blow has touched keeps standing beside another\'s; my untouched copy stands down to a touched one whatever the ids', async () => {
  const a = pool('aaa-0001'), m = pool('mmm-0002');
  const impA = await markerFoe(a.p), impM = await markerFoe(m.p);
  impM.entity.health = impM.entity.maxHealth - 5;   // the higher id began its fight first
  a.p.applyFoes('mmm-0002', m.p.foesFrame(true)); m.p.applyFoes('aaa-0001', a.p.foesFrame(true));
  await settle();
  assert.equal(impM.dead, false, 'a fight begun keeps its foe');
  assert.equal(impA.dead, true, 'the lower id\'s untouched copy stands down to it');
});

test('QUEST-PARTY 3b by source: the building pool\'s net and the party\'s law, installed once a session is open; the marker\'s foe flagged; the host\'s own lane out, in and struck; the owners swept; the handover at the door and at a death; the wave indoors left to a near sharer', () => {
  const wm = rd('src/scenes/worldModes.js'), w = rd('src/scenes/world.js');
  assert.match(wm, /_intNetOn = false; ensureInteriorNet\(\);/, 'at the pool\'s birth');
  assert.match(wm, /ensureInteriorNet\(\);   \/\/ QUEST-PARTY phase 3b: a session that opened after the door[^\n]*\n\s*interiorFoes\.update\(/, 'and every frame until it lands');
  assert.match(wm, /interiorFoes\.setQuestShare\(host\.foesQuestShare\?\.\(\) \?\? null\);/);
  assert.match(wm, /gender, questBehaviour: behaviour, feetGiven: true,\n\s*questMarker: true,/, 'the marker\'s stand is flagged');
  assert.match(wm, /applyOwnHit\(id, data\) \{ return mode === 'interior' && interiorFoes \? interiorFoes\.applyHit\(id, data\) : mode === 'dungeon'/);
  assert.match(w, /onPeerHit: \(hit, fate\) => hitSend\(\{ \.\.\.hit, own: 1 \}, fate\),/, 'a blow on a peer\'s foe in the building is marked own');
  assert.match(w, /toWire: \(feet\) => \[feet\[0\], feet\[1\] - state\.compensation\[1\], feet\[2\]\],\n\s*toScene: \(p\) => \[p\[0\], p\[1\] \+ state\.compensation\[1\], p\[2\]\],\n\s*\} : null\),/, 'the room\'s frame is the pose\'s');
  assert.match(w, /foesQuestShare: \(\) => questShareSeam,/);
  assert.match(w, /exteriorFoes\.setQuestShare\(questShareSeam\);/, 'one law for both pools');
  assert.match(w, /const ownStream = \(now\) => \{\n\s*if \(!online \|\| online\.status !== 'open' \|\| !online\.ownOk \|\| !isWorldRoom\(online\.room\)\) return false;/, 'only through a relay that carries the lane');
  assert.match(w, /if \(!online\.sendOwnFoes\(frame\)\) \{ _ownFullAt = -Infinity; return false; \}/);
  assert.match(w, /online\.onOwnFoes = \(id, data\) => \{ modes\?\.applyOwnFoes\?\.\(id, data\); \};/);
  assert.match(wm, /applyOwnFoes\(id, data\) \{ return mode === 'interior' && interiorFoes \? interiorFoes\.applyFoes\(id, data\) : /, 'a building\'s frame onto its pool');
  assert.match(w, /onInteriorLeave: \(\) => \{ const n = handOverRoomFoes\(\);/, 'the building\'s door hands my foes to those who stay');
  assert.match(w, /const _handed = handOverFoes\(\) \|\| handOverRoomFoes\(\);/, 'and a death in it');
  assert.match(w, /const handOverRoomFoes = \(\) => \{[\s\S]*?if \(\(isPrivateQuestFoe\(f\) \|\| f\._keptTag\) && !social\?\.isPartyPeer\(q\.id\)\) continue;[\s\S]*?return frame && online\.sendOwnFoes\(frame\) \? \(modes\?\.dropOwnHanded\?\.\(\) \?\? 0\) : 0;/, 'a quest\'s foe to the party alone (CURSE-SYNC: a private quest\'s)');
  assert.match(w, /if \(\(m === 'interior' \|\| m === 'dungeon'\) && online\?\.ownOk && isWorldRoom\(online\.room\) && partnerStandsQuestFoes\(\{/, 'the wave indoors');
});
