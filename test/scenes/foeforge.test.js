// FOE-FORGE (2026-10-17; a horde of forty Elite Daedroths round one player in a hamlet, reported on the Discord; bible/06-Systems/Integrity-Arc.md
// section 8). A cell's foes are their owner's word - each socket streams its own, the relay reads none of it - so a
// modified client could stand foes of any kind at every reader near it: each of the reader's allowances was its own (a
// forged frame filled all of them), a foe taken over left its owner's count (records naming the reader heir stood foes
// without end), and a record's `z`, `gg` and `nm` stood any foe as an elite, a Greater Giant or a revenant, at three to
// four times its blows. The reader now holds one owner to PEER_PUPPETS_TOTAL_MAX in all, the foes it took of theirs
// counted, and to an owner's honest number of elites, revenants and Greater Giants. Driven over two real encounter
// pools - an owner and a reader (DEEP-SHARE's rig); the forged frames are what a modified client sends, the honest
// ones the producer's own (foesFrame, handOverFrame).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CELL_FRAME_RECORDS_MAX } from '../../src/net/wire.js';
import { REVENANT_MAX } from '../../src/systems/revenant/revenant.js';
import { REVENANT_RETINUE_MAX } from '../../src/systems/revenant/revenantCompanions.js';
import { WILD_GIANT } from '../../src/systems/wild/wildZone.js';
import { createExteriorFoes, ENCOUNTER_PUPPETS_MAX, DEEP_PUPPETS_MAX, PEER_PUPPETS_TOTAL_MAX, PEER_ELITE_PUPPETS_MAX, PEER_REVENANT_PUPPETS_MAX } from '../../src/scenes/exteriorFoes.js';
import { RAID_PUPPETS_MAX } from '../../src/world/raidShared.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

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
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], [`ENEMY${String(WILD_GIANT).padStart(3, '0')}.CFG`, craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const pool = (self) => {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  return p;
};
const READER = 'mmm-0002', FORGER = 'fff-0006';
/** A forged record - a live foe of kind `t` at `x`, with whatever else the forger writes. */
const rec = (i, extra = {}) => ({ i, t: 0, x: 0, f: [100 + (i % 50), 0, 100 + Math.floor(i / 50)], y: 0, h: 10, k: 10, d: 0, ...extra });
const seqs = (from, n) => Array.from({ length: n }, (_, j) => from + j);
/** Every live foe at the reader that came of `from` - its puppets, and the ones it took over (the reader stands none of its own here). */
const liveOf = (p, from) => p.foes.filter((f) => !f.dead && (f.puppet === from || f.puppet == null));
let n = 0;
const send = async (p, from, frame) => { p.applyFoes(from, { n: ++n, ...frame }); await settle(); };

test('FOE-FORGE: the bounds - the total is the frame the sender may send; the revenants a character keeps and swears; the elites a reader believes', () => {
  assert.equal(PEER_PUPPETS_TOTAL_MAX, CELL_FRAME_RECORDS_MAX, 'an honest owner\'s live foes all ride one frame (its trim)');
  assert.equal(PEER_REVENANT_PUPPETS_MAX, REVENANT_MAX + REVENANT_RETINUE_MAX, 'the revenants a character keeps, and the ones sworn to it');
  assert.equal(PEER_ELITE_PUPPETS_MAX, 8);
  assert.ok(ENCOUNTER_PUPPETS_MAX + DEEP_PUPPETS_MAX + RAID_PUPPETS_MAX > PEER_PUPPETS_TOTAL_MAX, 'the allowances alone summed past one frame - the total is a bound of its own');
});

test('FOE-FORGE executed: a forged owner filling every allowance stands PEER_PUPPETS_TOTAL_MAX at the reader, never each allowance\'s sum', async () => {
  const reader = pool(READER);
  const plain = seqs(0, 32).map((i) => rec(i)), deep = seqs(100, 32).map((i) => rec(i));
  await send(reader, FORGER, { f: [...plain, ...deep], dz: deep.map((r) => r.i) });
  assert.equal(liveOf(reader, FORGER).length, 64, 'the encounter\'s and the deep\'s allowances, whole');
  const raid = seqs(200, 25).map((i) => rec(i));
  await send(reader, FORGER, { f: raid, rz: raid.map((r) => [r.i, '1:2:3']) });
  assert.equal(liveOf(reader, FORGER).length, PEER_PUPPETS_TOTAL_MAX, 'a raid\'s allowance was twenty-five more (eighty-nine) - the total holds');
  // ten its owner says fell are bodies, not foes: ten of the raid's stand in their room
  await send(reader, FORGER, { f: plain.slice(22).map((r) => ({ ...r, d: 1 })) });
  await send(reader, FORGER, { f: raid, rz: raid.map((r) => [r.i, '1:2:3']) });
  assert.equal(liveOf(reader, FORGER).length, PEER_PUPPETS_TOTAL_MAX, 'the fallen counted out');
  assert.equal(reader.foes.filter((f) => f.puppet === FORGER && !f.dead && f._pupRaid).length, 10);
  // and a full frame naming fewer gives the room back: what it stopped naming goes (after its records are read), and
  // the raid's stand on the frame after it
  const left = { f: [...raid, ...plain.slice(0, 10)], rz: raid.map((r) => [r.i, '1:2:3']) };
  await send(reader, FORGER, { full: 1, ...left });
  assert.equal(liveOf(reader, FORGER).length, 20, 'ten of the encounter\'s stay, beside the raid\'s ten');
  await send(reader, FORGER, { full: 1, ...left });
  assert.equal(liveOf(reader, FORGER).length, 35, 'and the rest of the raid\'s twenty-five stand');
});

test('FOE-FORGE executed: a takeover keeps its foes counted against their owner - records naming the reader heir, round after round, stand PEER_PUPPETS_TOTAL_MAX in all (they stood thirty-two more every round)', async () => {
  const reader = pool(READER);
  for (let round = 0; round < 4; round++) {
    const batch = seqs(round * 1000, 32);
    await send(reader, FORGER, { f: batch.map((i) => rec(i)) });
    await send(reader, FORGER, { f: batch.map((i) => rec(i, { e: READER })) });
  }
  const live = liveOf(reader, FORGER);
  assert.equal(live.length, PEER_PUPPETS_TOTAL_MAX, 'two rounds taken, then nothing more of theirs stands');
  assert.equal(live.filter((f) => f.puppet == null).length, PEER_PUPPETS_TOTAL_MAX, 'every one of them taken over - mine, and counted as theirs');
  // the foes I took die: the owner's room comes back
  for (const f of live.slice(0, 20)) f.dead = true;
  await send(reader, FORGER, { f: seqs(9000, 32).map((i) => rec(i)) });
  assert.equal(liveOf(reader, FORGER).length, PEER_PUPPETS_TOTAL_MAX, 'twenty fell, twenty of the next stand');
});

test('FOE-FORGE executed: an honest handover still lands whole - the owner\'s own handOverFrame, every foe to its heir; the owner, risen, streams its next foes beside them', async () => {
  const owner = pool('aaa-0001'), reader = pool(READER);
  for (let i = 0; i < 12; i++) await owner.spawnFoe(0, [100 + i, 0, 100], { feetGiven: true, loose: true, transient: true });
  reader.applyFoes('aaa-0001', owner.foesFrame(true));
  await settle();
  assert.equal(reader.foes.filter((f) => f.puppet === 'aaa-0001' && !f.dead).length, 12);
  reader.applyFoes('aaa-0001', owner.handOverFrame(() => READER));
  await settle();
  const took = reader.foes.filter((f) => !f.dead && f.puppet == null);
  assert.equal(took.length, 12, 'every handed foe taken over');
  owner.dropOwnLive();
  for (let i = 0; i < 12; i++) await owner.spawnFoe(0, [100 + i, 0, 120], { feetGiven: true, loose: true, transient: true });
  reader.applyFoes('aaa-0001', owner.foesFrame(true));
  await settle();
  assert.equal(reader.foes.filter((f) => f.puppet === 'aaa-0001' && !f.dead).length, 12, 'its next twelve stand beside the twelve it handed - far under the total');
});

test('FOE-FORGE executed: a peer\'s elites - an honest owner\'s stand as elites; a forged frame of forty stands PEER_ELITE_PUPPETS_MAX of them, the rest their plain kind; a taken elite stays counted', async () => {
  const owner = pool('aaa-0001'), reader = pool(READER);
  for (let i = 0; i < 6; i++) await owner.spawnFoe(0, [100 + i, 0, 100], { feetGiven: true, loose: true, transient: true });
  for (const f of owner.foes.slice(0, 3)) f.entity.eliteFoe = true;   // the owner's roll, as the producer reads it
  const honest = owner.foesFrame(true);
  assert.equal(honest.f.filter((r) => r.z === 1).length, 3, 'the producer writes `z`');
  reader.applyFoes('aaa-0001', honest);
  await settle();
  assert.equal(reader.foes.filter((f) => f.puppet === 'aaa-0001' && f.entity.eliteFoe).length, 3, 'an honest owner\'s elites are elites here');

  const r2 = pool(READER);
  await send(r2, FORGER, { f: seqs(0, 40).map((i) => rec(i, { z: 1 })) });
  const stood = r2.foes.filter((f) => f.puppet === FORGER && !f.dead);
  assert.equal(stood.length, ENCOUNTER_PUPPETS_MAX);
  assert.equal(stood.filter((f) => f.entity.eliteFoe).length, PEER_ELITE_PUPPETS_MAX, 'eight elites, never thirty-two');
  const plainScale = stood.find((f) => !f.entity.eliteFoe).entity.damageScale;
  assert.ok(!(plainScale > 1), 'the rest strike as their plain kind');
  // a full frame saying `z` again on the plain ones changes nothing
  await send(r2, FORGER, { full: 1, f: seqs(0, 32).map((i) => rec(i, { z: 1 })) });
  assert.equal(r2.foes.filter((f) => f.puppet === FORGER && !f.dead && f.entity.eliteFoe).length, PEER_ELITE_PUPPETS_MAX);
  // the elites taken over still count: the forger names me heir of all, then sends thirty fresh elites
  await send(r2, FORGER, { f: seqs(0, 32).map((i) => rec(i, { z: 1, e: READER })) });
  await send(r2, FORGER, { f: seqs(500, 30).map((i) => rec(i, { z: 1 })) });
  assert.equal(r2.foes.filter((f) => !f.dead && f.entity.eliteFoe).length, PEER_ELITE_PUPPETS_MAX, 'a taken elite is still one of the owner\'s eight');
});

test('FOE-FORGE executed: a peer\'s revenants - a forged frame naming twenty stands PEER_REVENANT_PUPPETS_MAX, and only those take the record\'s blows', async () => {
  const reader = pool(READER);
  await send(reader, FORGER, { f: seqs(0, 20).map((i) => rec(i, { nm: `Rev ${i}`, rb: 4000, p2: 1 })) });
  const stood = reader.foes.filter((f) => f.puppet === FORGER && !f.dead);
  assert.equal(stood.length, 20);
  const revs = stood.filter((f) => f.entity.revenant);
  assert.equal(revs.length, PEER_REVENANT_PUPPETS_MAX);
  assert.ok(revs.every((f) => f.entity.damageScale > 4), 'a believed revenant strikes as its record says (x4, its second phase x1.2)');
  assert.ok(stood.filter((f) => !f.entity.revenant).every((f) => !(f.entity.damageScale > 1)), 'the rest strike as their plain kind');
});

test('FOE-FORGE executed: a Greater Giant is a giant, and one of each to an owner - `gg` on any other kind is not believed, and a second giant naming the same index is a giant of the ordinary kind', async () => {
  const reader = pool(READER);
  await send(reader, FORGER, { f: [rec(0, { gg: 0 }), rec(1, { t: WILD_GIANT, gg: 1 }), rec(2, { t: WILD_GIANT, gg: 1 }), rec(3, { t: WILD_GIANT, gg: 2 })] });
  const by = (i) => reader.foes.find((f) => f.puppet === FORGER && f.seq === i);
  assert.equal(by(0).entity.zoneGiant, undefined, 'not a giant: no Greater Giant');
  assert.ok(!(by(0).entity.damageScale > 1), 'and none of its blows');
  assert.equal(by(1).entity.zoneGiant, 1, 'the first giant naming an index is it');
  assert.equal(by(2).entity.zoneGiant, undefined, 'a second naming it is not');
  assert.equal(by(3).entity.zoneGiant, 2, 'another index is another Greater Giant');
});

test('FOE-FORGE by source: the four hosts - world.js and worldModes.js (interiors) read a peer\'s foes through this pool; the dungeon\'s own lane stands no elite or giant and bounds what it takes (D8); exterior.js reads no peer', () => {
  const pool = rd('src/scenes/exteriorFoes.js');
  assert.match(pool, /if \(heldOf\(from\) >= PEER_PUPPETS_TOTAL_MAX\) \{ if \(site\) refused\.add\(site\); continue; \}/);
  assert.match(rd('src/scenes/world.js'), /exteriorFoes\.applyFoes\(id, data\)/);
  assert.match(rd('src/scenes/worldModes.js'), /mode === 'interior' && interiorFoes \? interiorFoes\.applyFoes\(id, data\)/);
  const dungeon = rd('src/scenes/dungeonContext.js');
  assert.match(dungeon, /if \(live >= QUEST_PUPPETS_MAX \+ LOOSE_PUPPETS_MAX\) return 0;/, 'the dungeon\'s takeover has its bound');
  assert.doesNotMatch(dungeon, /r\.z === 1|r\.gg\b/, 'and its records stand no elite and no Greater Giant');
  assert.doesNotMatch(rd('src/scenes/exterior.js'), /\.setNet\(|applyFoes\(/, 'the fixed city streams nothing');
  assert.doesNotMatch(rd('server/src/index.js'), /FOE-FORGE|PEER_PUPPETS_TOTAL_MAX/, 'a reader\'s law - no relay change, no version bump');
});
