// PSCALE1 (2026-09-25, Mac: "I want enemy difficulty, enemy numbers, etc to scale approriately with party size";
// asked: "+50% HP, +10% dmg", "One roll per group", "Everyone in it"): A FIGHT WEIGHS WHAT THE PARTY WEIGHS
// (systems/partyScale.js). The law's numbers; the outdoor pool driven - a shared foe's toughness at its owner's
// damage door with the remainder carried, the foes nobody else can help with left alone, a shared foe's hit on me
// harder; and the hosts by source - the count (everyone in a dungeon's room, the partymates within the camp's radius
// outdoors), the dungeon's shared foes (its layout's), the group's one roll and the foes more it stands.
// `06-Systems/Online-Arc.md` PSCALE1.
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

test('PSCALE1 outdoors, driven: a shared foe (one that rides the stream, or another player\'s puppet) takes the party\'s toughness at its owner\'s damage door, the remainder carried; a SetHealth(0) still kills; a quest\'s foe, the watch, my own ally and a pool with no stream (a building\'s) are never weighed; a shared foe\'s hit on me is the party\'s damage (mutants: the toughness unread at the door; the SetHealth door weighed; a quest foe weighed; the watch weighed; a pool without a stream weighed)', async () => {
  _resetPartyScaleForTests();
  let n = 4;
  const pool = createExteriorFoes(rig({ partySize: () => n }));
  netted(pool);
  const rat = await pool.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  assert.ok(rat && !rat.puppet && !rat.isQuestFoe, 'my own wanderer, which rides the stream');
  rat.entity.health = 100;
  for (let k = 0; k < 5; k++) pool.damageFoe(rat, 3, null, null, { fromPlayer: false });
  assert.equal(rat.entity.health, 94, 'fifteen damage against four is six - 2.5 times the health');
  n = 1;
  pool.damageFoe(rat, 3, null, null, { fromPlayer: false });
  assert.equal(rat.entity.health, 91, 'alone again: the blow itself');
  n = 8;
  pool.damageFoe(rat, rat.entity.health, null, null, { fromPlayer: false, bypassShield: true });
  assert.ok(rat.dead, 'a scripted kill is no blow, and kills whatever the party');
  const quest = await pool.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  quest.questBehaviour = { isFoeDead: false, notifyDestroyed() {} };   // what bindQuestFoeHost hangs on a quest's foe
  assert.ok(quest.isQuestFoe);
  quest.entity.health = 100;
  pool.damageFoe(quest, 9, null, null, { fromPlayer: false });
  assert.equal(quest.entity.health, 91, 'a quest\'s foe is every member\'s own copy: nobody can help, nothing weighs');
  n = 4;
  const lone = await pool.spawnFoe(0, [14, 0, 14], { feetGiven: true, placed: true });   // a World of Daggerfall foe with no site: every client stands its own
  lone.entity.health = 100;
  pool.damageFoe(lone, 9, null, null, { fromPlayer: false });
  assert.equal(lone.entity.health, 91, 'a placed foe with no site rides no stream: mine alone, never weighed');
  const camp = await pool.spawnFoe(0, [16, 0, 16], { feetGiven: true, placed: true, site: 'wod:3,12:0' });   // WOD7: a site's foe is the shared camp's, and rides
  camp.entity.health = 100;
  pool.damageFoe(camp, 5, null, null, { fromPlayer: false });
  assert.equal(camp.entity.health, 98, 'a placed foe with a site is the shared camp\'s: five against four is two');
  assert.equal(pool.partyHit(10, { mobileType: 0, puppet: 'bob-0002', entity: {} }), 13, 'another player\'s foe, stood here, hits the party harder');
  assert.equal(pool.partyHit(10, { mobileType: KNIGHT_CITY_WATCH, puppet: 'bob-0002', entity: {} }), 10, 'never the watch');
  assert.equal(pool.partyHit(10, { mobileType: 0, entity: { team: 'PlayerAlly' } }), 10, 'never my own ally');
  assert.equal(pool.partyHit(10, { mobileType: 0, entity: {}, isQuestFoe: true }), 10, 'never a quest\'s foe');
  const indoors = createExteriorFoes(rig({ partySize: () => 8 }));   // a building's pool: no stream
  const mouse = await indoors.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  mouse.entity.health = 100;
  indoors.damageFoe(mouse, 9, null, null, { fromPlayer: false });
  assert.equal(mouse.entity.health, 91, 'a foe nobody else can see is never weighed');
  assert.equal(indoors.partyHit(10, mouse), 10);
  const x = src('src/scenes/exteriorFoes.js');
  assert.match(x, /const dmg = partyHit\(calculateAttackDamage\(f\.entity, playerEntity, \{/, 'the owner\'s foe\'s blow and a puppet\'s alike reach me weighed');
  assert.match(x, /\}\), f\);   \/\/ PSCALE1: harder for the party beside me/);
});

test('PSCALE1 the hosts, by source: the count - everyone in a dungeon\'s room, the partymates within the camp\'s radius outdoors, one offline; the dungeon\'s shared foes are its layout\'s and weigh at its damage door, its blows and its arrows; outdoors the group rolls its wanderers once and stands the foes more, and a camp or a pack grows by its own members; a shared archer\'s arrow is weighed (mutants: strangers counted outdoors; the dungeon counting only the party; every player rolling; no foes more; a camp not growing)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(String\(online\.room\)\.startsWith\('dungeon:'\)\) return partySizeOf\(1 \+ \(peersNear\(\)\?\.length \?\? 0\)\);/, 'a dungeon counts everyone in its room ("Everyone in it")');
  assert.match(w, /for \(const m of partyNear\(\)\) \{ const dx = m\.feet\[0\] - me\[0\], dz = m\.feet\[2\] - me\[2\]; if \(dx \* dx \+ dz \* dz <= r2\) n\+\+; \}/, 'outdoors, my partymates within the radius alone');
  assert.match(w, /const r2 = GROUP_ROLL_RADIUS \* GROUP_ROLL_RADIUS;/);
  assert.equal(GROUP_ROLL_RADIUS, 100);
  assert.match(w, /const _rollsForGroup = _mOuter !== 'exterior' \|\| span <= 0 \|\| amGroupRollOwner\(online\?\.id \?\? null, player\.feetAt\(\), peersNear\(\)\);/, '"One roll per group"');
  assert.match(w, /if \(hit && _rollsForGroup\) \{/);
  assert.match(w, /for \(let k = 0, n = 1 \+ partyExtraFoes\(partySize\(\)\); k < n; k\+\+\) _standEncounterFoe\(hit, playerFeet\);/, 'the wanderer and the party\'s foes more');
  assert.match(w, /for \(const mobileType of partyGroupMembers\(hit\.mobileTypes, partySize\(\)\)\) \{/, 'a camp or a pack grows by its own');
  assert.match(w, /exteriorFoes\.partyHit\(calculateAttackDamage\(shooter\.entity, playerEntity, \{/, 'a shared archer\'s arrow');
  assert.match(w, /partySize: \(\) => partySize\(\),   \/\/ PSCALE1: the party the streamed foes weigh/, 'the outdoor pool is handed the count');
  assert.match(w, /partySize: \(\) => partySize\(\),   \/\/ PSCALE1: the party a fight here weighs - the dungeon's shared foes read it/, 'and the mode host');
  assert.match(src('src/scenes/worldModes.js'), /partySize: host\.partySize \? \(\) => host\.partySize\(\) : null,/, 'the dungeon is handed it, and a standalone dungeon (no host) weighs nothing');
  const d = src('src/scenes/dungeonContext.js');
  assert.match(d, /function _sharedFoe\(f\) \{\n\s*if \(!opts\.partySize \|\| !f \|\| f\.entity\?\.team === 'PlayerAlly'\) return false;\n\s*const i = foes\.indexOf\(f\);\n\s*return i >= 0 && i < _layoutFoes;\n\s*\}/, 'a dungeon\'s shared foes are its layout\'s - a rest\'s ambush or a quest\'s wave is mine alone');
  assert.match(d, /foe\.entity\.health -= !bypassShield && _sharedFoe\(foe\) \? partyFoeLoses\(foe, healthDamage, _partyN\(\)\) : healthDamage;/, 'the host\'s damage door');
  assert.match(d, /hurtPlayer\(_sharedFoe\(f\) \? partyFoeHits\(dmg, _partyN\(\)\) : dmg\);   \/\/ PSCALE1/, 'a blow at me');
  assert.match(d, /hurtPlayer\(shooter && _sharedFoe\(shooter\) \? partyFoeHits\(dmg, _partyN\(\)\) : dmg\);   \/\/ PSCALE1/, 'an arrow at me');
  assert.match(src('src/scenes/exteriorFoes.js'), /f\.entity\.health -= !bypassShield && _sharedFoe\(f\) \? partyFoeLoses\(f, healthDamage, _partyN\(\)\) : healthDamage;/, 'the owner\'s damage door');
});
