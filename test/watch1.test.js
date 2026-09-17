// WATCH1 (Mac, 2026-09-17: "Guards first" - the paused online arc's first stop, "guards on a shared crime"): THE
// CRIMINAL'S WATCH RIDES THE CELL. A crime is its criminal's alone (Multiplayer.md's lock: every player runs their
// own world), and until now so was the city watch it summoned - a peer standing beside a murderer saw the killer
// swing at nothing while five watchmen chased them. The smaller reading lands: the watch stays the criminal's (its
// spawn, its hunt, its despawn on the crime's clearing), and it RIDES the criminal's own cell `foes` frames as
// `t: 146` records - Knight_CityWatch, whose ENEMY_BASICS row every client holds - so every peer in range stands
// them as puppets through the one spawn chain, exactly as a rat of mine is stood. A peer's blow on a watch puppet
// goes to its owner as a hit, by the number the watchman rode under (one counter with the foes), and lands through
// cityGuards' OWN door as NOT the owner's blow: no aggro turn, no Murder for a watchman a peer killed. No relay
// change - a record is a record to the wire and the Room - so RELAY_VERSION stands.
//
// Recorded and NOT carried: a peer who strikes my watch commits nothing (the striker's door is the encounter
// pool's, which has no crime machinery); my murder marks no crime on a peer; the townspeople each client converts
// into watchmen are each client's own roll.
//
// These pins EXECUTE: a real city watch pool on a synthetic CLASS18.CFG (the un-gated G3 shape) and a real
// encounter pool on a crafted MONSTER.BSA, the net installed between them as world.js installs it.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { validFoeRecord } from '../src/net/wire.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ---- the crafted data: a rat's career and the watch's class ----------------------------------------------------
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
/** The 74-byte CLASS18.CFG record ClassFile.load walks (cityguards.test.js's synthetic career): hit points per
 *  level at 52, the eight u16 stats at 58..73. */
function stubClassCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; if (n === 'CLASS18.CFG') return stubClassCfg(); throw new Error(`no ${n} in this pin`); };
const player = () => ({ level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 }, crimeCommitted: 4 });   // Assault - a crime that holds the watch standing and is NOT Murder
const rig = (playerEntity) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9,
});
/** One client: its watch pool and its encounter pool, netted as world.js nets them (identity converters: the pin's
 *  scene IS the world frame). `hits` collects the blows this client sends to a peer. */
async function client(id, { withWatch = true } = {}) {
  const pe = player();
  const guards = createCityGuards(rig(pe));
  const pool = createExteriorFoes(rig(pe));
  const hits = [], hurt = [];
  pool.setNet({
    selfId: () => id, room: () => 'world:3,12', onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; },
    toWire: (feet) => [feet[0], feet[1], feet[2]], toScene: (p) => [p[0], p[1], p[2]],
    ...(withWatch ? { watch: { list: () => guards.guards, hurt: (g, dmg, at, dir, o) => { hurt.push([g, dmg, at, dir, o]); guards.hurtGuard(g, dmg, at, dir, { fromPlayer: false }); } } } : {}),
  });
  return { pe, guards, pool, hits, hurt };
}
const summon = (c, at = [5, 0, 5]) => c.guards.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [{ pos: at, fwdYaw: 0, guard: true, disable: () => {} }] });
const puppets = (pool) => pool.foes.filter((f) => !!f.puppet);

test('WATCH1: the criminal STREAMS its watch - a watchman rides the cell frame behind the foes as a `t: 146` record in the foes\' own shape, numbered off the one counter the first time he rides, the wire\'s own projection admitting it; nothing rides twice unchanged; a killed watchman rides dead with his pile, a walk-away rides no more; a net without a watch streams the foes alone', async () => {
  const mac = await client('mac-0001');
  const rat = await mac.pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  assert.equal(rat.seq, 1, 'the rat is one');
  await summon(mac);
  assert.equal(mac.guards.guards.length, 1, 'one watchman off the synthetic CLASS18.CFG');
  const g = mac.guards.guards[0];
  assert.equal(g.seq, null, 'unnumbered until he rides');
  const f1 = mac.pool.foesFrame(false);
  assert.deepEqual(f1.f.map((r) => [r.i, r.t]), [[1, 0], [2, GUARD_MOBILE_TYPE]], 'the rat then the watchman, numbered two off the foes\' own counter');
  assert.equal(g.seq, 2, 'and the number is his now');
  const w = f1.f[1];
  assert.deepEqual(validFoeRecord(w), w, 'the record is the wire\'s own (validFoeRecord admits it whole)');
  assert.equal(w.x, 0, 'the watch is male art'); assert.equal(w.d, 0); assert.equal(w.h, g.entity.health); assert.equal(w.l, g.entity.level | 0);
  assert.ok(w.g === '.' || w.g === '', `a watchman hunts me or my foes, never a peer: ${JSON.stringify(w.g)}`);
  assert.ok(Array.isArray(w.w) && w.w.length === 2, 'the watch spawns armed - its right hand rides as the foes\' does');
  assert.equal(mac.pool.foesFrame(false), null, 'nothing changed: nothing rides');
  const bear = await mac.pool.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  assert.equal(bear.seq, 3, 'the next foe is three - the watchman took two');
  // a walk-away: the crime clears, the watch goes home, the record leaves the roll (the readers\' full frame sweeps him)
  mac.pe.crimeCommitted = 0;
  mac.guards.update(0.016, [0, 0, 0], [0, 1.7, 0]);
  assert.equal(g.dead, true); assert.equal(!!g.corpse, false, 'a walk-away leaves no body');
  assert.deepEqual(mac.pool.foesFrame(true).f.map((r) => r.i), [1, 3], 'a full frame no longer names him');
  // a killed watchman rides dead, his pile on him (`o`), for the readers to lay a body
  mac.pe.crimeCommitted = 4;
  await summon(mac, [6, 0, 6]);
  const g2 = mac.guards.guards.find((x) => !x.dead);
  assert.ok(g2, 'a second watchman');
  mac.pool.foesFrame(false);
  g2.entity.items = [{ name: 'Gold', group: 'Currency', stackCount: 7 }, { name: 'Longsword', group: 'Weapons' }];
  mac.guards._damage(mac.guards.guards.indexOf(g2), 9999);
  assert.equal(g2.corpse, true);
  const dead = mac.pool.foesFrame(false).f.find((r) => r.i === g2.seq);
  assert.deepEqual([dead.d, dead.o, dead.h], [1, 2, 0], 'dead, two things on the body, no health');
  // no watch in the net: the foes alone (exterior.js\'s guard-only host, the dungeon)
  const solo = await client('sol-0001', { withWatch: false });
  await summon(solo);
  await solo.pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  assert.deepEqual(solo.pool.foesFrame(true).f.map((r) => r.t), [0], 'a net without a watch streams no watchman');
  assert.equal(solo.guards.guards[0].seq, null, 'and numbers none');
});

test('WATCH1: a PEER stands the watchman as a puppet - through the one spawn chain (Knight_CityWatch, at the streamed feet and level, no loot, outside my cap), hunting its owner and never me; my blow on it goes to the OWNER as a hit by the watchman\'s number and marks NO crime of mine; a full frame that stops naming him takes him down', async () => {
  const mac = await client('mac-0001');
  await summon(mac);
  const g = mac.guards.guards[0];
  const frame = mac.pool.foesFrame(true);
  const bob = await client('bob-0002');
  assert.equal(bob.pool.applyFoes('mac-0001', frame), true, 'Mac\'s frame is the world at Bob');
  await settle();
  const p = puppets(bob.pool);
  assert.equal(p.length, 1, 'one puppet: Mac\'s watchman'); const pup = p[0];
  assert.equal(pup.mobileType, GUARD_MOBILE_TYPE); assert.equal(pup.puppet, 'mac-0001'); assert.equal(pup.seq, g.seq);
  assert.equal(ENEMY_BASICS[pup.mobileType].team, 'CityWatch', 'the row every client holds');
  assert.deepEqual(pup.ai.feet, [g.ai.feet[0], g.ai.feet[1], g.ai.feet[2]].map((v) => Math.round(v * 100) / 100), 'at the streamed feet');
  assert.equal(pup.builtLevel, g.entity.level | 0, 'built at the owner\'s watchman\'s level (AUDIT WORLD6b-ii B2)');
  assert.deepEqual(pup.entity.items, [], 'a puppet carries no loot of mine (AUDIT WORLD6b B14)');
  assert.equal(bob.pool.activeCount(), 0, 'not my cap\'s');
  assert.equal(bob.guards.guards.length, 0, 'and NOT in my watch pool: Mac\'s watch is Mac\'s');
  bob.pool.update(0.05, [0, 0, 0], [0, 1.6, 0]);
  assert.equal(pup._pupMine, false, 'the watchman hunts its owner (\'.\'), so it lands nothing on me');
  // my blow: diverted to Mac by the watchman\'s number, and no crime of mine
  bob.pe.crimeCommitted = 0;
  bob.pool.damageFoe(pup, 6, [1, 0, 1], [0, 0, 1], { kind: 'melee' });
  assert.equal(bob.hits.length, 1, 'one blow out');
  assert.equal(bob.hits[0].to, 'mac-0001'); assert.equal(bob.hits[0].i, g.seq); assert.equal(bob.hits[0].dmg, 6); assert.equal(bob.hits[0].k, 'world:3,12');
  assert.equal(pup.entity.health, g.entity.health, 'the puppet takes no damage here - the owner\'s next frame says');
  assert.equal(bob.pe.crimeCommitted, 0, 'striking another\'s watch is not my crime (recorded, not carried)');
  assert.equal(bob.hurt.length, 0, 'and nothing went through MY watch\'s door');
  // the sweep: Mac\'s crime clears, his next full frame names no watchman
  mac.pe.crimeCommitted = 0;
  mac.guards.update(0.016, [0, 0, 0], [0, 1.7, 0]);
  const gone = mac.pool.foesFrame(true);
  assert.deepEqual(gone.f, [], 'Mac streams an empty full frame');
  assert.equal(bob.pool.applyFoes('mac-0001', gone), true);
  assert.equal(puppets(bob.pool).length, 0, 'the watchman went home at Bob too');
});

test('WATCH1: the OWNER lands a peer\'s blow on its watchman through the watch\'s OWN door as NOT its blow - the health drops, the shove goes the way the blow went, a lethal blow kills and lays a body that rides the next frame, and the crime stays what it was (no Murder for a watchman a peer killed); a blow naming a dead watchman, or a number nobody rode under, is refused', async () => {
  const mac = await client('mac-0001');
  await summon(mac);
  const g = mac.guards.guards[0];
  assert.equal(mac.pool.applyHit('bob-0002', { k: 'world:3,12', i: 77, dmg: 3, kind: 'melee' }), false, 'a number nobody rode under: refused');
  mac.pool.foesFrame(true);   // he rides, he is numbered
  const hp = g.entity.health;
  assert.equal(mac.pool.applyHit('bob-0002', { k: 'world:3,12', i: g.seq, dmg: 3, kind: 'melee', p: [1, 0, 1], d: [0, 0, 1] }), true, 'Bob\'s blow lands');
  assert.equal(g.entity.health, hp - 3, 'through the watch\'s door');
  assert.equal(mac.hurt.length, 1); assert.deepEqual(mac.hurt[0].slice(1, 4), [3, [1, 0, 1], [0, 0, 1]], 'the blow\'s number, the striker\'s feet, its direction');
  assert.deepEqual(g.ai.knockbackDir, [0, 0, 1], 'the shove goes the way the blow went (C15, the gate is knockDir\'s)');
  assert.ok(g.ai.knockbackSpeed > 0);
  assert.equal(mac.pe.crimeCommitted, 4, 'Assault stands as it was: a blow on my watch by a peer is nothing of mine');
  // the kill: a body, no Murder
  assert.equal(mac.pool.applyHit('bob-0002', { k: 'world:3,12', i: g.seq, dmg: 9999, kind: 'melee' }), true);
  assert.equal(g.dead, true); assert.equal(g.corpse, true, 'killed, not walked away - a body lies');
  assert.equal(mac.pe.crimeCommitted, 4, 'and the crime is STILL Assault - never Murder (F035\'s law: DaggerfallEntityBehaviour.cs:203\'s player gate, which a peer is outside)');
  const r = mac.pool.foesFrame(false).f.find((x) => x.i === g.seq);
  assert.deepEqual([r.d, r.h], [1, 0], 'the body rides the next frame');
  assert.equal(mac.pool.applyHit('bob-0002', { k: 'world:3,12', i: g.seq, dmg: 3, kind: 'melee' }), false, 'a dead watchman takes nothing');
  // the foes\' door is untouched by the watch\'s: a blow on my rat still lands on the rat
  const rat = await mac.pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  mac.pool.foesFrame(true);
  const rhp = rat.entity.health;
  assert.equal(mac.pool.applyHit('bob-0002', { k: 'world:3,12', i: rat.seq, dmg: 2, kind: 'melee' }), true);
  assert.equal(rat.entity.health, rhp - 2); assert.equal(mac.hurt.length, 2, 'the watch\'s door was not asked again');
});

test('WATCH1 by source: world.js hands the pool the watch (the guards list, hurtGuard with fromPlayer false); the strike edge latches the attack count and its recipient; the striker\'s melee door routes a puppet past the watch\'s crime arms; the wire is unchanged', () => {
  const w = rd('src/scenes/world.js'), cg = rd('src/scenes/cityGuards.js'), ef = rd('src/scenes/exteriorFoes.js');
  assert.ok(w.includes("watch: { list: () => cityGuards.guards, hurt: (g, dmg, at, dir) => cityGuards.hurtGuard(g, dmg, at, dir, { fromPlayer: false }) },"), 'the net carries the watch, and a peer\'s blow is not this player\'s');
  assert.ok(cg.includes("if (strikeEdge) { g._atkA = ((((g._atkA | 0) >> 1) + 1) << 1); g._atkB = isPlayerTarget(_tgt) ? '.' : ''; }"), 'the count on the wire, the ranged bit low, the recipient never a peer');
  assert.ok(cg.includes("seq: null, _atkA: 0, _atkB: '',"), 'the record\'s three wire fields, null and zero until he rides');
  assert.ok(ef.includes("for (const f of [...foes, ...watchList()]) {"), 'the watch rides behind the foes');
  assert.ok(ef.includes("if (f.seq == null) f.seq = _nextSeq++;"), 'numbered off the one counter');
  assert.ok(ef.includes("if (onWatch) _net.watch.hurt(f, dmg, at, dir, { kind });"), 'the owner\'s door for a watchman');
  // the striker\'s melee door: a guard of MINE goes through the watch\'s crime arms, anything else (a puppet) the pool\'s
  assert.match(w, /dealDamage: \(f, d\) => \(cityGuards\.guards\.includes\(f\)/, 'by pool membership, never by species - a 146 puppet is the encounter pool\'s');
  assert.match(w, /onAttackFromPlayer: \(f\) => \(cityGuards\.guards\.includes\(f\)/);
  assert.equal(ef.includes('crimeCommitted'), false, 'the striker\'s pool has no crime machinery (exteriorfoes.test.js\'s sweep, still true)');
  assert.ok(rd('src/net/wire.js').includes("export const RELAY_VERSION = 'world80'"), 'no wire change: a record is a record');
});
