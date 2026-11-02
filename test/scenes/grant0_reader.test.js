// GRANT0 (2026-10-18; bible/11-Multiplayer/Spawn-Grants.md sections 1 and 8; the owner, asked what to build first: "Quick
// fixes first"). Three things a reader believed of a peer's foe that FOE-FORGE's bounds did not reach, closed by the
// reader's law alone (no relay change): the wind-up's signature bit (x2) on any foe, where an honest owner sets it only
// on a revenant's blow (ai/tactics.js sigBlow); a champion's trait on every record, past what an owner rolls and its
// revenants wear; and the dungeon's copies taking a peer's cast from the whole spell table and its revenant fields
// without a count. Driven over FOE-FORGE's rig - two real encounter pools, the forged frames a modified client's, the
// honest ones the producer's own - and the dungeon host by source.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WILD_GIANT } from '../../src/systems/wild/wildZone.js';
import { createExteriorFoes, ENCOUNTER_PUPPETS_MAX, PEER_ELITE_PUPPETS_MAX, PEER_REVENANT_PUPPETS_MAX, PEER_CHAMPION_PUPPETS_MAX } from '../../src/scenes/exteriorFoes.js';
import { enemySpellIndices, assignEnemySpells, MONSTER_SPELL_LISTS } from '../../src/systems/enemySpells.js';
import { puppetBlow, WIRE_SIG } from '../../src/ai/puppetBlows.js';
import { BLOW } from '../../src/ai/blowShapes.js';
import { SIG } from '../../src/systems/revenant/revenantFeud.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';

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
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(100) });
const pool = (self) => {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, m) => [feet[0] + m[0], feet[1] + m[1], feet[2] + m[2]] },
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
/** A slam wound up with the signature's bit - all five wind-up fields together (net/wire.js validFoeRecord). */
const sigSlam = (i) => ({ wk: 2 | WIRE_SIG, wy: 0, wl: 900, wo: [100 + (i % 50), 0, 100], wn: 1 });
let n = 0;
const send = async (p, from, frame) => { p.applyFoes(from, { n: ++n, ...frame }); await settle(); };
const lootOn = () => { _resetForTests(); setPref('lootRarity', true); };

test('GRANT0: the bounds - a champion\'s trait for the elites\' allowance and the revenants\' bound; what a foe casts is assignEnemySpells\' own list, at any level asked', () => {
  assert.equal(PEER_CHAMPION_PUPPETS_MAX, PEER_ELITE_PUPPETS_MAX + PEER_REVENANT_PUPPETS_MAX, 'an owner\'s capped spawns roll one in fourteen, and each of its revenants may wear its trait');
  assert.equal(PEER_CHAMPION_PUPPETS_MAX, 17);   // PIN MOVED (UNQUIET, #1008): the revenants' bound is nine now (REVENANT_MAX three), so eight and nine
  // DFU EnemyEntity.cs's lists, as indices: a monster's its career's; a class caster's EnemyClassSpells[min(6, level / 3)]
  assert.deepEqual(enemySpellIndices({ isClass: false, careerIndex: 27 }), [0x16, 0x17, 0x1F], 'a Daedroth\'s');
  assert.deepEqual(enemySpellIndices({ isClass: false, careerIndex: 0 }), [], 'a rat casts nothing');
  const mage = (level) => ({ isClass: true, careerIndex: 1, level, basics: { castsMagic: true } });
  assert.deepEqual(enemySpellIndices(mage(2)), [0x10, 0x14], 'levels 0-2: the Frost Daedra\'s');
  assert.deepEqual(enemySpellIndices(mage(3)), [0x16, 0x17, 0x1F], 'levels 3-5: the Daedroth\'s');
  assert.deepEqual(enemySpellIndices(mage(18)), [0x08, 0x0A, 0x0E, 0x1D, 0x1F, 0x22, 0x3C], 'from 18: the Ancient Lich\'s');
  assert.deepEqual(enemySpellIndices(mage(100)), [0x08, 0x0A, 0x0E, 0x1D, 0x1F, 0x22, 0x3C], 'and never past it');
  assert.deepEqual(enemySpellIndices({ isClass: true, careerIndex: 8, level: 30, basics: { castsMagic: false } }), [], 'a class that casts nothing');
  // a copy built at MY level asks its owner's: a level-1 copy's own list holds no Lich's 0x3C, its level-30 owner's does
  assert.ok(!enemySpellIndices(mage(1)).includes(0x3C) && enemySpellIndices(mage(1), 30).includes(0x3C), 'the level asked, not the copy\'s');
  // and assignEnemySpells stands exactly those (one law, one home)
  const table = new Map(Array.from({ length: 128 }, (_, i) => [i, { index: i }]));
  for (const careerIndex of [...Object.keys(MONSTER_SPELL_LISTS).map(Number), 0, 2, 40]) {
    const e = { isClass: false, careerIndex, level: 5 };
    assignEnemySpells(e, table);
    assert.deepEqual((e.spells ?? []).map((s) => s.index), [...enemySpellIndices(e)], `monster ${careerIndex}`);
  }
  for (let level = 0; level <= 25; level++) {
    const e = mage(level);
    assignEnemySpells(e, table);
    assert.deepEqual(e.spells.map((s) => s.index), [...enemySpellIndices(e)], `a caster at ${level}`);
  }
});

test('GRANT0 executed: the signature at the street - a forged foe\'s wind-up strikes as its shape, a believed revenant\'s at the signature\'s x2, and one past the revenants\' bound as its shape', async () => {
  const reader = pool(READER);
  await send(reader, FORGER, { f: [rec(0, sigSlam(0))] });
  const plain = reader.foes.find((f) => f.puppet === FORGER && f.seq === 0);
  assert.ok(puppetBlow(plain.ai), 'its wind-up stands');
  assert.equal(puppetBlow(plain.ai).mult, BLOW.slam.mult, 'a plain foe\'s: the slam\'s own weight, never x2');
  assert.notEqual(puppetBlow(plain.ai).sig, true);
  const r2 = pool(READER);
  await send(r2, FORGER, { f: seqs(0, PEER_REVENANT_PUPPETS_MAX + 1).map((i) => rec(i, { nm: `Rev ${i}`, rb: 1300, ...sigSlam(i) })) });
  const stood = r2.foes.filter((f) => f.puppet === FORGER && !f.dead);
  const revs = stood.filter((f) => f.entity.revenant), rest = stood.filter((f) => !f.entity.revenant);
  assert.equal(revs.length, PEER_REVENANT_PUPPETS_MAX);
  assert.equal(rest.length, 1);
  assert.ok(revs.every((f) => puppetBlow(f.ai)?.sig === true && puppetBlow(f.ai).mult === SIG.MULT), 'a revenant\'s signature: x2, in its ember');
  assert.equal(puppetBlow(rest[0].ai).mult, BLOW.slam.mult, 'the tenth is no revenant here, and its slam no signature');
});

test('GRANT0 executed: champions - an honest owner\'s stand as champions; a forged frame of forty stands PEER_CHAMPION_PUPPETS_MAX of them, the builds in flight counted, the rest their plain kind', async () => {
  lootOn();
  try {
    const owner = pool('aaa-0001'), reader = pool(READER);
    for (let i = 0; i < 4; i++) await owner.spawnFoe(WILD_GIANT, [100 + i, 0, 100], { feetGiven: true, loose: true, transient: true, champion: i });
    const honest = owner.foesFrame(true);
    assert.equal(honest.f.filter((r) => Number.isInteger(r.cp)).length, 4, 'the producer writes `cp`');
    reader.applyFoes('aaa-0001', honest);
    await settle();
    assert.equal(reader.foes.filter((f) => f.puppet === 'aaa-0001' && !f.dead && f.entity.champion).length, 4, 'an honest owner\'s champions are champions here');

    const r2 = pool(READER);
    await send(r2, FORGER, { f: seqs(0, 40).map((i) => rec(i, { t: WILD_GIANT, cp: 2 })) });   // one frame: every build in flight at once
    const stood = r2.foes.filter((f) => f.puppet === FORGER && !f.dead);
    assert.equal(stood.length, ENCOUNTER_PUPPETS_MAX);
    assert.equal(stood.filter((f) => f.entity.champion).length, PEER_CHAMPION_PUPPETS_MAX, 'seventeen champions, never thirty-two');
    const plainScale = stood.find((f) => !f.entity.champion).entity.damageScale;
    assert.ok(!(plainScale > 1), 'the rest strike as their plain kind');
    // the champions fall: the next frame's traits are believed again, up to the bound
    for (const f of stood.filter((x) => x.entity.champion)) f.dead = true;
    await send(r2, FORGER, { f: seqs(500, 10).map((i) => rec(i, { t: WILD_GIANT, cp: 2 })) });
    assert.equal(r2.foes.filter((f) => f.puppet === FORGER && !f.dead && f.entity.champion).length, 10, 'room given back as they fall');
  } finally { _resetForTests(); }
});

test('GRANT0 by source: the street gates the signature and both of a puppet\'s stands count champions; the dungeon\'s copies take a cast its kind casts at its owner\'s level and never paralysed, believe a revenant\'s fields inside FOE-FORGE\'s bound, and a signature on a revenant alone; no relay change', () => {
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /entity: f\.entity, collider, sig: f\.entity\.revenant \? SIG : null \}\);/);
  assert.equal((x.match(/const cp = Number\.isInteger\(r\.cp\) && championsOf\(from\) < PEER_CHAMPION_PUPPETS_MAX \? r\.cp : null;/g) ?? []).length, 2);
  assert.match(x, /for \(const \[k, r\] of _pupPending\) if \(r\._cp && k\.startsWith\(from \+ ':'\)\) n\+\+;/, 'the builds in flight counted');
  assert.match(x, /_camp: campTags\.get\(r\.i\) \?\? _pupPending\.get\(key\)\._camp, _cp: _pupPending\.get\(key\)\._cp \}\); continue; \}/, 'a later word keeps the build\'s count');
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /const sp = f\._pupMine && !entityIsParalyzed\(f\.entity\) && enemySpellIndices\(f\.entity, f\.streamedLevel \?\? f\.entity\.level\)\.includes\(p\.cast\) \? \(spellsByIndex\?\.get\(p\.cast\) \?\? null\) : null;/);
  assert.match(d, /const _feudOk = _fw == null \|\| f\._feudWire != null \|\| !!f\.entity\.revenant\?\.id \|\| foes\.filter\(\(x\) => x !== f && !x\.dead && x\._feudWire != null && \(x\._ownFrom \?\? null\) === \(f\._ownFrom \?\? null\)\)\.length < PEER_REVENANT_PUPPETS_MAX;\s*if \(_feudOk && _fw !== \(f\._feudWire \?\? null\)\)/);
  assert.match(d, /_to === _me, entity: f\.entity, collider, sig: f\.entity\.revenant \? SIG : null \}\);/);
  assert.doesNotMatch(rd('server/src/index.js'), /GRANT0|PEER_CHAMPION_PUPPETS_MAX/, 'a reader\'s law - no relay change, no version bump');
});
