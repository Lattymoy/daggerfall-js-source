// FEUD WIRE (bible/12-Enhanced-AI/Feud-Arc.md section 25 and the FEUD WIRE record; Mac, 2026-10-05: "Take care of both
// gaps"). Online, a revenant's blows at a PEER were its kind's plain ones: its owner's `damageScale` - its rank's, its
// wrath's, a Night-stalker's night, phase two's x1.2 - rode no wire, and a signature landed at its shape's multiplier.
// Now the foe record carries its stand's blows (`rb`, per mille - systems/revenantFeud.js BLOWS_WIRE) and a wind-up its
// signature (`wk` +64, ai/puppetBlows.js WIRE_SIG); the puppet stands with them on its own scale (its kind's, its
// elite's, its champion's - never twice), so a peer is struck as its owner would be. Relay world165.
// Pinned: the law; the owner's stand and its restamp; the writer and the heir's write-back; the puppet's fold (said
// again, changed, withdrawn; on an elite's); the real door's damage; the signature both ways; the hosts' seams.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const Wire = await import('../src/net/wire.js');
const PB = await import('../src/ai/puppetBlows.js');
const { makeBlow, resetBlows, blowScaled, BLOW, IRON_COLOR } = await import('../src/ai/foeBlows.js');
const { setTacticsClock, resetTactics } = await import('../src/ai/tactics.js');
const { calculateAttackDamage } = await import('../src/combat/formulas.js');
const { makeEnemyEntity } = await import('../src/characters/enemyEntity.js');
const { ENEMY_BASICS } = await import('../src/characters/enemyBasics.js');
const { promoteEliteFoe } = await import('../src/systems/eliteFoes.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { makePlayer } = await import('../tools/tellDuel.mjs');

const { createExteriorFoes } = await import('../src/scenes/exteriorFoes.js');
const { FOES_STALE_MS } = await import('../src/net/online.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// the real street pool on a crafted MONSTER.BSA (auditfeud2's rig)
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
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
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { isPlayer: true, level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
});
const netFor = () => ({ room: () => 'world:3,12', now: () => 0, staleMs: FOES_STALE_MS, onPeerHit: (h, fate) => { fate?.sent?.(); return true; }, toWire: (p) => p, toScene: (p) => p });
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
let T = 10;
setTacticsClock(() => T);
const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-feudwire', level: 8, items: [] };
beforeEach(() => { _resetForTests(); setPref('lootRarity', true); setPref('enhancedAI', true); N._resetRevenantForTests(); _store.clear(); resetTactics(); resetBlows(); T = 10; });
/** A rank-`rank` revenant in `wrath` stood on a real entity (its kind's scale `prior` before it). */
function stood(rank = 3, wrath = 0, prior = undefined) {
  const r = N.revenantDeed(me, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  r.rank = rank; r.wrath = wrath;
  const entity = { mobileType: M.Orc, level: 6, health: 60, maxHealth: 60, team: 'Monster', items: [], ...(prior ? { damageScale: prior } : {}) };
  N.applyRevenant(entity, r);
  return { entity, r };
}

test('FEUD WIRE THE LAW: `rb` a whole per mille from x1 to x4 (the writer\'s bounds the reader\'s); `wk` +64 a signature - each refused whole outside it (mutants: a bound dropped; the flag past the law)', () => {
  assert.equal(PB.WIRE_SIG, 64);
  assert.deepEqual({ ...F.BLOWS_WIRE }, { PER: 1000, MIN: 1000, MAX: 4000 });
  assert.equal(Wire.FOE_BLOWS_MIN, F.BLOWS_WIRE.MIN);
  assert.equal(Wire.FOE_BLOWS_MAX, F.BLOWS_WIRE.MAX);
  assert.equal(Wire.RELAY_VERSION, 'world170');   // PIN MOVED (FEUD's merge of main): world165 on the branch, renumbered past main's world169
  const v = (extra) => Wire.validFoeRecord({ i: 4, ...extra });
  for (const rb of [1000, 1430, 4000]) assert.deepEqual(v({ rb }), { i: 4, rb });
  for (const rb of [999, 4001, 1430.5, '1430', null]) assert.equal(v({ rb }), null, `rb ${rb}`);
  const w = { wy: 0, wl: 500, wo: [0, 0, 0], wn: 1 };
  assert.equal(v({ ...w, wk: 2 | PB.WIRE_IRON | PB.WIRE_SIG }).wk, 2 | PB.WIRE_IRON | PB.WIRE_SIG, 'an iron signature slam');
  assert.equal(v({ ...w, wk: 0 | PB.WIRE_SIG | PB.WIRE_LANDED }).wk, PB.WIRE_SIG | PB.WIRE_LANDED, 'its landing said after it');
  assert.equal(v({ ...w, wk: 128 }), null, 'past the flags');
});

test('FEUD WIRE THE OWNER\'S STAND: its blows over its kind\'s - its rank\'s and its wrath\'s, never its elite\'s - kept on its stamp, and kept through a deed that stamps it again (mutants: the stand unrecorded; the elite\'s counted; the restamp drops it)', () => {
  const { entity } = stood(3, 2, 2);
  assert.ok(near(entity.revenant.blows, (1 + 0.1 * 3) * (1 + 0.05 * 2)), 'x1.3 its rank, x1.1 its wrath');
  assert.ok(near(entity.damageScale, 2 * entity.revenant.blows), 'its elite\'s x2 under it - its own');
  assert.ok(near(stood(1).entity.revenant.blows, 1.1));
  N.revenantDeed(me, entity, 'slew', { mobileType: M.Orc, rolls: () => 0 });
  assert.ok(near(entity.revenant.blows, 1.43), 'a killer over my body still strikes with its stand');
  assert.equal(entity.revenant.rank, 4, 'stamped again');
});

test('FEUD WIRE THE WRITER AND THE HEIR: `rb` out of the stamp (none at x1; clamped to the law), read back onto a puppet\'s stamp and written again the same by an heir (mutants: rb unwritten; the clamp; the heir\'s copy dropped)', () => {
  assert.deepEqual(F.feudWire({ learned: [], weak: null, blows: 1.43 }), { rb: 1430 });
  assert.deepEqual(F.feudWire({ learned: [], weak: null, blows: 1 }), {}, 'x1: none');
  assert.deepEqual(F.feudWire({ learned: [], weak: null }), {}, 'a plain foe made one by a deed: none');
  assert.deepEqual(F.feudWire({ learned: [], weak: null, blows: 9 }), { rb: 4000 }, 'never past the law (a record refused whole would lose its foe)');
  const { entity } = stood(5, 3);
  const wire = F.feudWire(entity.revenant);
  assert.equal(wire.rb, Math.round(1.5 * 1.15 * 1000));
  assert.ok(Wire.validFoeRecord({ i: 1, ...wire }), 'its rank-5 wrath on the wire');
  const rev = F.feudFromWire({ id: null, name: entity.revenant.name, rank: 0 }, wire);
  assert.equal(rev.blows, wire.rb / 1000);
  assert.equal(F.feudWire(rev).rb, wire.rb, 'an heir writes it back');
  assert.equal(F.feudFromWire(rev, {}).blows, null, 'a record without it: none');
});

test('FEUD WIRE THE PUPPET\'S FOLD: its stand\'s and phase two\'s on its own scale - said again never doubled, changed refolded, withdrawn given back; on an elite\'s it stays the elite\'s (mutants: the factor unread; phase two unread; the old factor never taken out)', () => {
  const e = {};
  assert.equal(F.puppetRevenantBlows(e, { rb: 1430 }), 1.43);
  assert.ok(near(e.damageScale, 1.43));
  F.puppetRevenantBlows(e, { rb: 1430 });
  assert.ok(near(e.damageScale, 1.43), 'said again: once');
  F.puppetRevenantBlows(e, { rb: 1430, p2: 1 });
  assert.ok(near(e.damageScale, 1.43 * F.PHASE_TWO.BLOWS), 'its last stand\'s phase two');
  F.puppetRevenantBlows(e, null);
  assert.ok(near(e.damageScale, 1), 'withdrawn: its own again');
  const elite = makeEnemyEntity(M.Orc, ENEMY_BASICS[M.Orc], null, 10, () => 0.5);
  promoteEliteFoe(elite, { own: false, checkLevel: false });
  const own = elite.damageScale;
  assert.ok(own > 1, 'an elite\'s blows');
  F.puppetRevenantBlows(elite, { rb: 1300, p2: 1 });
  assert.ok(near(elite.damageScale, own * 1.3 * 1.2));
  F.puppetRevenantBlows(elite, { rb: 1300 });
  assert.ok(near(elite.damageScale, own * 1.3));
  assert.equal(F.puppetRevenantBlows(null, { rb: 1300 }), 1);
});

test('FEUD WIRE THE DOOR: the puppet\'s blow at me through the real formula lands as its owner\'s would - x1.43 on the same roll (mutants: the fold unread at the door)', () => {
  const player = makePlayer('Longsword').entity;
  const rolls = () => { let i = 0; const s = [0.3, 0.99, 0.01, 0.99, 0.99]; return () => s[i++ % s.length]; };
  const swing = (ent) => calculateAttackDamage(ent, player, { rolls: rolls() });
  const plain = makeEnemyEntity(M.Orc, ENEMY_BASICS[M.Orc], null, 10, () => 0.5);
  const base = swing(plain);
  assert.ok(base > 1, `a blow that lands (${base})`);
  const pup = makeEnemyEntity(M.Orc, ENEMY_BASICS[M.Orc], null, 10, () => 0.5);
  F.puppetRevenantBlows(pup, { rb: 1430 });
  assert.equal(swing(pup), Math.max(1, Math.round(base * 1.43)));
});

test('FEUD WIRE THE SIGNATURE: its owner flags it; the puppet strikes it at x2.0 on my feet, in its ember, its WIND deeper - and with no numbers from its host, or no flag, its shape\'s (mutants: the flag unwritten; unread; the multiplier, the ember or the pitch dropped)', () => {
  const b = makeBlow('slam', [0, 0, 0], 0, 10, IRON_COLOR, 'iron');
  b.sig = true; b.mult = F.SIG.MULT;
  assert.equal(PB.blowWire({ _tac: { state: 'windup', blow: b } }, 10.1).wk, 2 | PB.WIRE_IRON | PB.WIRE_SIG);
  b.sig = false;
  assert.equal(PB.blowWire({ _tac: { state: 'windup', blow: b } }, 10.1).wk, 2 | PB.WIRE_IRON, 'a plain slam: no flag');
  const rec = { wk: 2 | PB.WIRE_SIG, wy: 0, wl: 500, wo: [0, 0, 0], wn: 1 };
  const at = (r, sig) => { const ai = { feet: [0, 0, 0] }; PB.applyBlowRecord(ai, r, { origin: [0, 0, 0], me: true, sig }); return ai; };
  let ai = at(rec, F.SIG);
  const pb = PB.puppetBlow(ai);
  assert.deepEqual([pb.sig, pb.mult, pb.windPitch, pb.color], [true, F.SIG.MULT, F.SIG.WIND_PITCH, F.SIG.COLOR]);
  T = 10.3; PB.puppetBlowTurn(ai, [0, 0, 1], T);
  T = 10.6; PB.puppetBlowTurn(ai, [0, 0, 1], T);
  assert.equal(ai._blowVerdict, true);
  assert.equal(ai._blowMult, F.SIG.MULT);
  assert.equal(blowScaled(ai, 10), 20, 'x2.0 on my feet, as on its owner\'s');
  T = 10; resetBlows();
  assert.equal(PB.puppetBlow(at(rec, null)).mult, BLOW.slam.mult, 'no numbers from the host: its shape\'s');
  T = 10; resetBlows();
  assert.equal(PB.puppetBlow(at({ ...rec, wk: 2 }, F.SIG)).mult, BLOW.slam.mult, 'no flag: its shape\'s');
});

test('FEUD WIRE THE HOSTS: both pass the signature\'s numbers to the puppet\'s blow; both streams key `rb` and stand the puppet\'s fold when it changes - the dungeon gives its own back when the record says none (mutants: each seam unwired; a key unwidened)', () => {
  const x = read('src/scenes/exteriorFoes.js');
  assert.match(x, /me: recipientIsMe\(f, r\.b \?\? r\.g \?\? p\.target\), entity: f\.entity, collider, sig: SIG \}\);/);
  assert.match(x, /\$\{r\.p2 \?\? 0\},\$\{r\.rt \?\? -1\},\$\{r\.rb \?\? 0\}\$\{r\.wk !== undefined/);
  assert.match(x, /const fw = `\$\{r\.ad \?\? 0\},\$\{r\.wq \?\? -1\},\$\{r\.p2 \?\? 0\},\$\{r\.rb \?\? 0\}`; if \(f\._feudWire !== fw\) \{ f\._feudWire = fw; f\.entity\.revenant = feudFromWire\(f\.entity\.revenant, r\); puppetRevenantBlows\(f\.entity, r\); \}/);
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /me: _to != null && _me != null && _to === _me, entity: f\.entity, collider, sig: SIG \}\);/);
  assert.match(d, /\$\{r\.v\},\$\{r\.ad \?\? 0\},\$\{r\.wq \?\? -1\},\$\{r\.p2 \?\? 0\},\$\{r\.rb \?\? 0\}\$\{r\.wk !== undefined/);
  assert.match(d, /const _fw = r\.ad !== undefined \|\| r\.wq !== undefined \|\| r\.p2 !== undefined \|\| r\.rb !== undefined \? `\$\{r\.ad \?\? 0\},\$\{r\.wq \?\? -1\},\$\{r\.p2 \?\? 0\},\$\{r\.rb \?\? 0\}` : null;/);
  assert.match(d, /: \(f\.entity\.revenant\?\.id \? f\.entity\.revenant : null\); puppetRevenantBlows\(f\.entity, r\); \}/);
});

test('FEUD WIRE THROUGH THE REAL STREET POOL: a peer\'s revenant stands with its owner\'s blows - said again once, phase two folded on them, withdrawn given back; an heir\'s foe writes them (mutants: the reader unwired; the key unwidened; the writer unwritten)', async () => {
  const pool = createExteriorFoes(poolRig());
  pool.setNet(netFor());
  const rec = (n, extra) => ({ n, k: 'world:3,12', full: 1, f: [{ i: 5, t: 0, x: 0, f: [20, 0, 20], y: 0, h: 9, d: 0, a: 0, m: 0, nm: 'Grushnak the Butcher', ...extra }] });
  pool.applyFoes('bob-0002', rec(1, { rb: 1430 }));
  await settle();
  const pup = pool.foes.find((f) => f.puppet);
  const own = 1;   // a plain foe of the crafted kind - its own scale x1
  assert.ok(near(pup.entity.damageScale, own * 1.43), 'its owner\'s blows');
  assert.equal(pup.entity.revenant.blows, 1.43);
  pool.applyFoes('bob-0002', rec(2, { rb: 1430 }));
  assert.ok(near(pup.entity.damageScale, 1.43), 'said again: once');
  pool.applyFoes('bob-0002', rec(3, { rb: 1430, p2: 1 }));
  assert.ok(near(pup.entity.damageScale, 1.43 * F.PHASE_TWO.BLOWS), 'its last stand\'s phase two');
  pool.applyFoes('bob-0002', rec(4, {}));
  assert.ok(near(pup.entity.damageScale, own), 'withdrawn: its own');
  const f = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  f.entity.revenant = F.feudFromWire({ id: null, name: 'Grushnak the Butcher', rank: 0 }, { rb: 1430 });
  const r = pool.foesFrame(true)?.f?.find((x) => x.i === f.seq);
  assert.equal(r?.rb, 1430, 'an heir writes them back');
});
