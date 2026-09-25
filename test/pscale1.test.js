// PSCALE1 (2026-09-25, Mac: "I want enemy difficulty, enemy numbers, etc to scale approriately with party size";
// asked: "+50% HP, +10% dmg", "One roll per group", "Everyone in it" - and at AUDIT PSCALE1, "Whoever fights it"):
// A FIGHT WEIGHS WHAT ITS FIGHTERS WEIGH (systems/partyScale.js). The law's numbers; the outdoor pool driven - a
// shared foe's toughness at its owner's damage door by the players striking it, the remainder carried, the foes
// nobody else can help with left alone, a shared foe's hit on me harder; and the hosts by source. The audit's own
// pins, mounted and driven, are test/auditpscale1.test.js. `06-Systems/Online-Arc.md` PSCALE1, AUDIT PSCALE1.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PARTY_SCALE_HP_PCT, PARTY_SCALE_DAMAGE_PCT, PARTY_SCALE_EXTRA_EVERY, PARTY_SCALE_EXTRA_MAX, partySizeOf, partyToughness,
  partyDamageFactor, partyExtraFoes, partyGroupMembers, partyFoeLoses, partyFoeHits, _resetPartyScaleForTests,
} from '../src/systems/partyScale.js';
import { PARTY_MAX, CELL_PUPPETS_MAX } from '../src/net/wire.js';
import { createExteriorFoes, MAX_ACTIVE_ENCOUNTER_FOES } from '../src/scenes/exteriorFoes.js';
import { CAMP_SIZE, PACK_SIZE, GROUP_ROLL_RADIUS } from '../src/systems/campEncounters.js';
import { KNIGHT_CITY_WATCH } from '../src/characters/mobileTypes.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PSCALE1 the law: a party is 1..8; a shared foe fights it with 50% more health a player past the first and hits it 10% harder; outdoors one foe more for every two players past the first, three at most, drawn from the group\'s own members; the health taken over the toughness with the remainder carried, so a party of eight\'s pinpricks still kill; alone, every number Daggerfall\'s own (mutants: the toughness off by a player; the damage unweighed; the remainder dropped; an extra foe too soon)', () => {
  assert.deepEqual([PARTY_SCALE_HP_PCT, PARTY_SCALE_DAMAGE_PCT, PARTY_SCALE_EXTRA_EVERY, PARTY_SCALE_EXTRA_MAX], [50, 10, 2, 3]);
  assert.deepEqual([partySizeOf(0), partySizeOf(1), partySizeOf(4.9), partySizeOf(99), partySizeOf(Number.NaN), partySizeOf(null)], [1, 1, 4, PARTY_MAX, 1, 1]);
  assert.deepEqual([1, 2, 4, 8].map(partyToughness), [1, 1.5, 2.5, 4.5], 'the health: alone, a pair, four, a full party');
  assert.deepEqual([1, 2, 4, 8].map((n) => Math.round(partyDamageFactor(n) * 100)), [100, 110, 130, 170], 'the damage');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(partyExtraFoes), [0, 0, 1, 1, 2, 2, 3, 3], 'the foes more, outdoors');
  assert.deepEqual(partyGroupMembers([10, 11, 12], 1), [10, 11, 12], 'alone, the group as it rolled');
  assert.deepEqual(partyGroupMembers([10, 11, 12], 8), [10, 11, 12, 10, 11, 12], 'a full party: three more, from its own');
  assert.deepEqual(partyGroupMembers([7], 8), [7, 7, 7, 7], 'a lone kind repeats');
  assert.deepEqual(partyGroupMembers(null, 8), []);
  _resetPartyScaleForTests();
  const foe = {};
  assert.equal(partyFoeLoses(foe, 45, 8), 10, '45 at 4.5 is 10');
  const taken = [];
  for (let k = 0; k < 9; k++) taken.push(partyFoeLoses(foe, 1, 8));
  assert.equal(taken.reduce((a, b) => a + b, 0), 2, 'nine pinpricks of 1 against eight take 2 - the remainder carried, never lost');
  assert.ok(taken.every((t) => Number.isInteger(t)), 'and the health stays whole');
  assert.equal(partyFoeLoses({}, 7, 1), 7, 'alone, the blow');
  assert.equal(partyFoeLoses({}, 0, 8), 0);
  assert.equal(partyFoeHits(10, 4), 13);
  assert.equal(partyFoeHits(10, 1), 10);
  assert.equal(partyFoeHits(1, 8), 2, 'rounded');
  assert.equal(partyFoeHits(0, 8), 0, 'a miss stays a miss');
});

test('PSCALE1 the bounds: the biggest camp and its three more fit the owner\'s encounter cap and every reader\'s puppet allowance; a lone encounter\'s four fit too (mutants: an extra past the caps)', () => {
  assert.ok(CAMP_SIZE[1] + PARTY_SCALE_EXTRA_MAX <= MAX_ACTIVE_ENCOUNTER_FOES, 'a camp of five and three more is eight');
  assert.ok(CAMP_SIZE[1] + PARTY_SCALE_EXTRA_MAX <= CELL_PUPPETS_MAX, 'and every reader stands all eight');
  assert.ok(PACK_SIZE[1] + PARTY_SCALE_EXTRA_MAX <= MAX_ACTIVE_ENCOUNTER_FOES);
  assert.ok(1 + PARTY_SCALE_EXTRA_MAX <= MAX_ACTIVE_ENCOUNTER_FOES);
  assert.equal(PARTY_MAX, 8);
});

// ── THE OUTDOOR POOL, DRIVEN (watch1.test.js's crafted rat) ─────────

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
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
const fetchBytes = async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); };
const player = () => ({ level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } });
const rig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity: player(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
  ...extra,
});
const netted = (pool) => pool.setNet({ selfId: () => 'mac-0001', room: () => 'world:3,12', peers: () => [], now: () => 1000, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });

test('PSCALE1 outdoors, driven: a shared foe (one that rides the stream, or another player\'s puppet) takes its fighters\' toughness at its owner\'s damage door, the remainder carried; a SetHealth(0) still kills; a quest\'s foe, a placed foe with no site, the watch, my own ally and a pool with no stream (a building\'s) are never weighed; a shared foe\'s hit on me is its fighters\' damage (mutants: the toughness unread at the door; the SetHealth door weighed; a quest foe weighed; the watch weighed; a pool without a stream weighed)', async () => {
  _resetPartyScaleForTests();
  const pool = createExteriorFoes(rig());
  netted(pool);
  const four = (f) => { for (const id of ['bob-0002', 'carl-0003', 'dave-0004']) pool.damageFoe(f, 0, null, null, { fromPlayer: true, peer: true, peerId: id }); };
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  assert.ok(rat && !rat.puppet && !rat.isQuestFoe, 'my own wanderer, which rides the stream');
  rat.entity.health = 100;
  four(rat);
  for (let k = 0; k < 5; k++) pool.damageFoe(rat, 3, null, null, { fromPlayer: true });
  assert.equal(rat.entity.health, 94, 'fifteen damage against its four fighters is six - 2.5 times the health');
  pool.damageFoe(rat, rat.entity.health, null, null, { fromPlayer: false, bypassShield: true });
  assert.ok(rat.dead, 'a scripted kill is no blow, and kills whatever fights it');
  const quest = await pool.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  quest.questBehaviour = { isFoeDead: false, notifyDestroyed() {} };   // what bindQuestFoeHost hangs on a quest's foe
  assert.ok(quest.isQuestFoe);
  quest.entity.health = 100;
  four(quest);
  pool.damageFoe(quest, 9, null, null, { fromPlayer: true });
  assert.equal(quest.entity.health, 91, 'a quest\'s foe is every member\'s own copy: nobody can help, nothing weighs');
  const lone = await pool.spawnFoe(0, [14, 0, 14], { feetGiven: true, placed: true });   // a World of Daggerfall foe with no site: every client stands its own
  lone.entity.health = 100;
  four(lone);
  pool.damageFoe(lone, 9, null, null, { fromPlayer: true });
  assert.equal(lone.entity.health, 91, 'a placed foe with no site rides no stream: mine alone, never weighed');
  const camp = await pool.spawnFoe(0, [16, 0, 16], { feetGiven: true, placed: true, site: 'wod:3,12:0' });   // WOD7: a site's foe is the shared camp's, and rides
  camp.entity.health = 100;
  four(camp);
  pool.damageFoe(camp, 5, null, null, { fromPlayer: true });
  assert.equal(camp.entity.health, 98, 'a placed foe with a site is the shared camp\'s: five against four is two');
  assert.equal(pool.partyHit(10, { mobileType: 0, puppet: 'bob-0002', _fightN: 4, entity: {} }), 13, 'another player\'s foe, fought by four, hits harder');
  assert.equal(pool.partyHit(10, { mobileType: KNIGHT_CITY_WATCH, puppet: 'bob-0002', _fightN: 4, entity: {} }), 10, 'never the watch');
  assert.equal(pool.partyHit(10, { mobileType: 0, _fightN: 4, entity: { team: 'PlayerAlly' } }), 10, 'never my own ally');
  assert.equal(pool.partyHit(10, { mobileType: 0, _fightN: 4, entity: {}, isQuestFoe: true }), 10, 'never a quest\'s foe');
  const indoors = createExteriorFoes(rig());   // a building's pool: no stream
  const mouse = await indoors.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  mouse.entity.health = 100;
  for (const id of ['bob-0002', 'carl-0003', 'dave-0004']) indoors.damageFoe(mouse, 0, null, null, { fromPlayer: true, peer: true, peerId: id });
  indoors.damageFoe(mouse, 9, null, null, { fromPlayer: true });
  assert.equal(mouse.entity.health, 91, 'a pool with no stream weighs nothing');
  assert.equal(indoors.partyHit(10, { ...mouse, _fightN: 4 }), 10);
});

test('PSCALE1 the hosts, by source (AUDIT PSCALE1: the rest is mounted and driven in auditpscale1.test.js): the owner\'s door names every player\'s blow a fighter and weighs by them; the count rides the record and a reader reads it; a shared foe\'s blow and a shared archer\'s arrow at me are weighed by the foe\'s own fighters; the dungeon\'s door the same (mutants: the fighter unnoted, the door unweighed, the count unstreamed or unread)', () => {
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const x = strip(src('src/scenes/exteriorFoes.js'));
  assert.match(x, /if \(fromPlayer\) noteFighter\(f, peer \? peerId : PARTY_ME, _now\(\)\);\s*f\.entity\.health -= !bypassShield && !_whole && _sharedFoe\(f\) \? partyFoeLoses\(f, healthDamage, fightN\(f\)\) : healthDamage;/, 'the owner\'s damage door');
  assert.match(x, /const dmg = partyHit\(calculateAttackDamage\(f\.entity, playerEntity, \{/, 'the owner\'s foe\'s blow and a puppet\'s alike reach me weighed');
  assert.match(x, /const partyHit = \(dmg, f\) => \(_sharedFoe\(f\) \? partyFoeHits\(dmg, fightN\(f\), playerEntity\) : dmg\);/, 'by the foe\'s own fighters, the remainder on me');
  assert.match(x, /if \(!onWatch && !f\.dead && _sharedFoe\(f\)\) \{ const n = fightN\(f\); if \(n > 1\) r\.n = n; \}/, 'the record carries the count');
  assert.match(x, /f\._fightN = r\.n \?\? 1;/, 'a reader reads it');
  const w = strip(src('src/scenes/world.js'));
  assert.match(w, /exteriorFoes\.partyHit\(calculateAttackDamage\(shooter\.entity, playerEntity, \{[\s\S]{0,700}?\}\), shooter\) : 0;/, 'a shared archer\'s arrow, weighed by its own shooter');
  const d = strip(src('src/scenes/dungeonContext.js'));
  assert.match(d, /foe\.entity\.health -= !bypassShield && !_whole && _sharedFoe\(foe\) \? partyFoeLoses\(foe, healthDamage, fightN\(foe\)\) : healthDamage;/, 'the host\'s damage door');
});
