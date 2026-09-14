// WORLD6b-iii(a) (Mac, 2026-09-14: "Continue" after AUDIT WORLD6b-ii): THE CAST AT A PEER - WORLD3's cast law for the
// dungeon host's foes, per owner, with the audit's bounds. The owner's foe casts at the peer it hunts (the decision
// runs as at me, reading no effects of mine; the missile leaves toward the peer's transform; nothing of mine is in
// the blast's sphere here), the record carries the cast (c the count, s the spell), and the PUPPET at me casts the
// spell itself (the missile at me, the blast against my capsule) under the owner's blow budget and the leap gate;
// at another its one-shot alone. AUDIT WORLD6b-ii A1's suppression is retired: the tick was the pay-out, the cast
// flies now.
//
// These pins EXECUTE the pool on a crafted MONSTER.BSA with a net that has peers and an id, a fake decision machine
// and observed magic hooks.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validFoeRecord } from '../src/net/wire.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { isPeerTarget } from '../src/characters/enemyTargets.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

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
const MISSILE = { index: 5, name: 'Bolt', element: 0, rangeType: 2, effects: [] };
const BLAST = { index: 6, name: 'Nova', element: 1, rangeType: 3, effects: [] };
const spells = new Map([[5, MISSILE], [6, BLAST]]);
const poolRig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
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
  spellsByIndex: () => spells,
  ...extra,
});
const netFor = (hits, peers, clock = { t: 0 }) => ({
  room: () => 'world:3,12', selfId: () => 'mac-0001', peers: () => peers.list, now: () => clock.t, staleMs: 0,
  onPeerHit: (h) => { hits.push(h); return true; },
  toWire: (feet) => [feet[0], feet[1], feet[2]], toScene: (p) => [p[0], p[1], p[2]],
});
const senses = (pe) => ({ candidates: () => [], playerEntity: pe, playerHeight: 1.8, playerCrouching: false, playerInvisible: false, movingLessThanHalfSpeed: true });
const puppets = (pool) => pool.foes.filter((f) => !!f.puppet);
const rec = (i, over = {}) => ({ i, t: 0, x: 0, f: [12, 0, 10], y: 0, h: 9, d: 0, a: 0, m: 0, g: '', l: 1, w: null, c: 0, s: 0, ...over });
const frame = (n, f, full = 1) => ({ n, k: 'world:3,12', full, f });
const step = (pool, me, pe, n = 1) => { for (let i = 0; i < n; i++) pool.update(0.05, me, [me[0], me[1] + 1.6, me[2]], senses(pe)); };

test('WORLD6b-iii: the wire - the cast rides the record as c (the count) and s (the spell index), whole numbers in [0, 65535]; anything else refuses the record whole', () => {
  for (const r of [{ i: 1, c: 0, s: 0 }, { i: 1, c: 65535, s: 12 }, { i: 1 }]) assert.deepEqual(validFoeRecord(r), r, JSON.stringify(r));
  for (const r of [{ i: 1, c: -1 }, { i: 1, c: 65536 }, { i: 1, c: 1.5 }, { i: 1, s: -1 }, { i: 1, s: 'x' }, { i: 1, c: null }]) assert.equal(validFoeRecord(r), null, JSON.stringify(r));
});

test('WORLD6b-iii: the owner\'s foe CASTS at the peer it hunts - the decision runs as at me and reads no effects of mine, the missile leaves toward the peer\'s transform, an area blast puts nothing of mine in its sphere, and the cast rides the record (c up by one, s the spell)', async () => {
  const hits = [], missiles = [], blasts = [], seen = [];
  const peers = { list: [{ id: 'bob-0002', feet: [12, 0, 10], height: 2 }] };
  const pe = playerEntity(); pe.activeEffects = [{ kind: 'shield' }];
  const pool = createExteriorFoes(poolRig({ playerEntity: pe, rolls: () => 0.99, magicHooks: { fireMissile: (from, sp, lvl, foe, aimAt) => missiles.push({ sp, aimAt }), explodeAt: (pos, sp, lvl, feet) => blasts.push({ sp, feet }) } }));   // the dice fail my Stealth: the rat detects me when it turns to me
  pool.setNet(netFor(hits, peers));
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true, yaw: Math.PI / 2 });
  rat.ai.isHostile = true; rat.ai.detected = true;
  let pick = MISSILE;
  rat.caster = { update: (dt, ai, attack, feet, targetEntity) => { seen.push(targetEntity); return { spell: pick }; } };
  const far = [80, 0, 80];
  step(pool, far, pe, 40);
  assert.ok(isPeerTarget(rat.ai.target), 'the rat hunts Bob');
  assert.ok(seen.length > 0, 'the decision ran');
  assert.ok(seen.slice(-5).every((e) => e !== pe && Array.isArray(e.activeEffects) && e.activeEffects.length === 0), 'and read no effects of mine - a peer\'s are none to it');
  assert.ok(missiles.length > 0, 'the missile left');
  assert.deepEqual(missiles.at(-1).aimAt, [12, 1, 10], 'aimed at the peer\'s transform (its feet plus half its height)');
  assert.deepEqual(blasts, [], 'no blast yet');
  const before = pool.foesFrame(true).f[0];
  assert.ok(before.c > 0, 'the cast count rides'); assert.equal(before.s, 5, 'and the spell');
  pick = BLAST;
  const c0 = before.c;
  step(pool, far, pe, 3);
  assert.ok(blasts.length > 0, 'an area cast blasts at the owner too (the foes around it)');
  assert.equal(blasts.at(-1).feet, null, 'with nothing of mine in the sphere - I am not its target');
  const after = pool.foesFrame(true).f[0];
  assert.ok(after.c > c0, 'the count moved'); assert.equal(after.s, 6, 'the spell moved with it');
  // at me: the missile aims at me, the blast is measured against my capsule
  peers.list = [];
  const me = [11, 0, 10];
  pick = MISSILE;
  step(pool, me, pe, 30);
  assert.equal(missiles.at(-1).aimAt, null, 'at me the missile aims where it always did (the hook\'s own law)');
  pick = BLAST;
  step(pool, me, pe, 3);
  assert.deepEqual(blasts.at(-1).feet, me, 'and the blast is measured against my feet');
});

test('WORLD6b-iii: the PUPPET at me casts the spell itself - a streamed cast count is a cast once (a joiner latches the count it arrives with), the missile flies at me, the blast is measured against my capsule, under the owner\'s blow budget and the leap gate; at another peer or at nobody its one-shot alone', async () => {
  const hits = [], missiles = [], blasts = [], clock = { t: 0 };
  const peers = { list: [{ id: 'bob-0002', feet: [30, 0, 30], height: 1.8 }, { id: 'eve-0003', feet: [20, 0, 20], height: 1.8 }] };
  const pe = playerEntity();
  const pool = createExteriorFoes(poolRig({ playerEntity: pe, magicHooks: { fireMissile: (from, sp, lvl, foe, aimAt) => missiles.push({ sp, aimAt }), explodeAt: (pos, sp, lvl, feet) => blasts.push({ sp, feet }) } }));
  pool.setNet(netFor(hits, peers, clock));
  const me = [10, 0, 10];
  pool.applyFoes('bob-0002', frame(1, [rec(5, { f: [14, 0, 10], y: -Math.PI / 2, g: 'mac-0001', c: 3, s: 5 })])); await settle();
  const pup = puppets(pool)[0];
  const casts = []; const orig = pup.mobile.update.bind(pup.mobile); pup.mobile.update = (dt, o, ...r) => { casts.push(!!o.casting); return orig(dt, o, ...r); };
  step(pool, me, pe);
  assert.equal(missiles.length, 0, 'the count a joiner arrived with (3) casts nothing'); assert.equal(casts.at(-1), false);
  pool.applyFoes('bob-0002', frame(2, [{ i: 5, c: 4, s: 5 }], 0));
  step(pool, me, pe);
  assert.equal(missiles.length, 1, 'a count up by one: one cast'); assert.equal(missiles[0].sp, MISSILE); assert.equal(missiles[0].aimAt, null, 'the missile flies at me');
  assert.equal(casts.at(-1), true, 'the Spell one-shot');
  step(pool, me, pe, 3);
  assert.equal(missiles.length, 1, 'once'); assert.equal(casts.at(-1), false);
  pool.applyFoes('bob-0002', frame(3, [{ i: 5, c: 5, s: 6 }], 0));
  step(pool, me, pe);
  assert.equal(blasts.length, 1, 'an area cast blasts'); assert.deepEqual(blasts[0].feet, me, 'measured against my capsule');
  // at another, at nobody: the one-shot alone
  pool.applyFoes('bob-0002', frame(4, [{ i: 5, g: 'eve-0003', c: 6, s: 5 }], 0));
  step(pool, me, pe);
  assert.equal(missiles.length, 1, 'at Eve: no missile of mine'); assert.equal(casts.at(-1), true, 'its one-shot plays');
  pool.applyFoes('bob-0002', frame(5, [{ i: 5, g: '', c: 7, s: 5 }], 0));
  step(pool, me, pe);
  assert.equal(missiles.length, 1, 'at nobody: none'); assert.equal(casts.at(-1), true, 'the one-shot');
  // the budget: casts and blows share the owner's
  pool.applyFoes('bob-0002', frame(6, [{ i: 5, g: 'mac-0001', c: 7, s: 5 }], 0));
  let c = 7;
  for (let i = 0; i < 12; i++) { pool.applyFoes('bob-0002', frame(7 + i, [{ i: 5, c: ++c, s: 5 }], 0)); step(pool, me, pe); }
  assert.equal(missiles.length, 5, 'the owner\'s budget of six, shared by the blow and the cast: the first missile and the blast spent two, four more casts land, then none (the clock stands still)');
  // the leap: a puppet that teleported to me casts nothing until it walks
  clock.t = 5000;
  pool.applyFoes('bob-0002', frame(30, [{ i: 5, f: [60, 0, 10], c: ++c, s: 5 }], 0));
  clock.t = 5200;
  pool.applyFoes('bob-0002', frame(31, [{ i: 5, f: [14, 0, 10], c: ++c, s: 5 }], 0));
  step(pool, me, pe);
  assert.equal(pup._pup.leap, true); assert.equal(missiles.length, 5, 'leapt: no cast (the clock moved five seconds - the budget is full again, the leap alone refuses)');
});

test('WORLD6b-iii: by source - the executor aims its missile where it is told (a peer\'s transform) and at the player otherwise; the world host\'s hook takes the aim point; the pool\'s decision reads a bare stand-in for a peer; the record', () => {
  const c = rd('src/characters/enemyCasting.js');
  assert.match(c, /aimAt = null,/, 'the executor\'s option'); assert.match(c, /fireMissile\?\.\(from, spell, f\.entity\.level, f, aimAt\);/);
  assert.doesNotMatch(c, /suppress/, 'the suppress arm is retired');
  const w = rd('src/scenes/world.js');
  assert.match(w, /fireMissile: \(from, spell, casterLevel, foe, aimAt = null\) => \{[^\n]*\n\s*if \(!\(walkMode && playerSpawned\)\) return;\s*const at = aimAt \?\? \[player\.pos\[0\], player\.pos\[1\] \+ player\.height \/ 2, player\.pos\[2\]\];/, 'the host\'s hook');
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /const PEER_CAST_TARGET = Object\.freeze\(\{ activeEffects: Object\.freeze\(\[\]\) \}\);/);
  assert.match(x, /\? playerEntity : \(f\.ai\.target\?\.entity \?\? PEER_CAST_TARGET\);/, 'a peer\'s effects are none to the pick');
  assert.match(x, /playerFeet: atPeer \? null : playerFeet, playerHeight: _lastPlayerHeight,/, 'nothing of mine in a blast at a peer');
  assert.match(x, /aimAt: atPeer \? \[atPeer\.feet\[0\], atPeer\.feet\[1\] \+ \(atPeer\.height \?\? CAPSULE_HEIGHT\) \/ 2, atPeer\.feet\[2\]\] : null,/, 'the missile at the peer\'s transform');
  assert.match(x, /if \(sp && blowAllowed\(f\)\) castSpellFrom\(f, sp, playerFeet, true\); else f\._castPending = true;/, 'the puppet\'s cast under the budget, or the one-shot');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /### 6b-iii\(a\): the cast at a peer/, 'the record');
});
