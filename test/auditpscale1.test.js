// AUDIT PSCALE1 (2026-09-25, Mac: "Lets audit this"; five lenses - the damage doors, the network, the count and the
// encounters, the records, play and balance - `06-Systems/Online-Arc.md` AUDIT PSCALE1). One pin per finding paid,
// each failing on the code PSCALE1 shipped. The count is Mac's second answer, "Whoever fights it": a foe's fighters
// are the players who struck it within thirty seconds, counted at its authority's door and streamed on its record.
// Host slices are MOUNTED from comment-stripped source, never matched (the suite's precedent: audit26_dungeonfoes
// F218, FOE1's callSourceStripped) - a line inside a comment is a line that is gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './modsOff.js';
import {
  PARTY_FIGHT_WINDOW_MS, PARTY_ME, noteFighter, foeFighters, partyFoeLoses, partyFoeHeals, partyFoeHits, partyToughness,
  partyExtraFoes, partyGroupMembers, markWholeBlow, takeWholeBlow, partySizeOf, _resetPartyScaleForTests,
} from '../src/systems/partyScale.js';
import { RENOWN_ASSIST_MS } from '../src/net/renownTracker.js';
import { createExteriorFoes, MAX_ACTIVE_ENCOUNTER_FOES } from '../src/scenes/exteriorFoes.js';
import { validFoeRecord, CELL_PUPPETS_MAX, CELL_LOOSE_PUPPETS, PARTY_MAX } from '../src/net/wire.js';
import { amGroupRollOwner, CAMP_SIZE, GROUP_ROLL_RADIUS } from '../src/systems/campEncounters.js';
import { SOLITARY_TYPES } from '../src/characters/mobileFactions.js';
import { registerFormulaOverride, calculateAttackDamage } from '../src/combat/formulas.js';
import { ARTIFACTS, SPECIAL_ARTIFACT_HANDLERS, onPlayerStruckByEnemy, registerFoeDoor } from '../src/systems/artifactEffects.js';
import { ENCHANTMENT_TYPES as T } from '../src/formats/magicDef.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { killIfAnyLiveStatZero } from '../src/systems/statMods.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const mount = (src, scope, tail) => { const k = Object.keys(scope); return new Function(...k, `${src}\n${tail}`)(...k.map((x) => scope[x])); };
/** The balanced `open`..`close` run starting at the first `open` at or after `from`. */
function balanced(text, from, open = '(', close = ')') {
  let depth = 0;
  for (let i = text.indexOf(open, from); i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return text.slice(from, i + 1);
  }
  throw new Error('unbalanced');
}

// ── the outdoor pool, driven (watch1.test.js's crafted rat) ─────────────────────────────────────────
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
const playerEntity = () => ({ isPlayer: true, level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const rig = (extra = {}) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes, getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
  ...extra,
});
const clock = { t: 1000 };
const netted = (pool, { self = 'mac-0001', peers = [], hits = [] } = {}) => pool.setNet({ selfId: () => self, room: () => 'world:3,12', inRoom: () => true, peers: () => peers, now: () => clock.t, onPeerHit: (h) => { hits.push(h); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
const settle = () => new Promise((r) => setTimeout(r, 20));
/** Land a blow of `dmg` from each named player (PARTY_ME's is mine, fromPlayer; a peer's through its door). */
const blowFrom = (pool, f, who, dmg = 0) => pool.damageFoe(f, dmg, null, null, who === 'me' ? { fromPlayer: true } : { fromPlayer: true, peer: true, peerId: who });

test('AUDIT PSCALE1 the law of who fights: a foe\'s fighters are the distinct players who struck it within the Renown assist window - never fewer than one, never past the seats; a remainder is each foe\'s own; a heal is weighed as the damage is; a hit on a victim carries its remainder (a rat\'s 1 rises too); a kill mark is spent once (mutants: the window, the distinct count, a shared remainder, the heal unweighed, the hit carry lost, the mark kept)', () => {
  _resetPartyScaleForTests();
  assert.equal(PARTY_FIGHT_WINDOW_MS, RENOWN_ASSIST_MS, 'the window Renown pays a kill by');
  const f = {};
  assert.equal(foeFighters(f, 0), 1, 'nobody has struck it: one');
  noteFighter(f, PARTY_ME, 0); noteFighter(f, 'bob-0002', 1000); noteFighter(f, 'bob-0002', 2000); noteFighter(f, 'carl-0003', 3000);
  assert.equal(foeFighters(f, 3000), 3, 'me, bob and carl - bob twice is bob once');
  assert.equal(foeFighters(f, PARTY_FIGHT_WINDOW_MS + 1), 2, 'my blow at 0 has lapsed; bob\'s and carl\'s have not');
  assert.equal(foeFighters(f, 3000 + PARTY_FIGHT_WINDOW_MS + 1), 1, 'every blow lapsed: one again');
  const crowd = {};
  for (let i = 0; i < 12; i++) noteFighter(crowd, `p${i}-000${i}`, 0);
  assert.equal(foeFighters(crowd, 0), PARTY_MAX, 'twelve strikers are the party\'s eight seats');
  noteFighter(null, PARTY_ME, 0); noteFighter(f, null, 0); noteFighter(f, PARTY_ME, Number.NaN);
  assert.equal(foeFighters(null, 0), 1);
  // REC-9: the remainder is the FOE's own
  const a = {}, b = {};
  assert.equal(partyFoeLoses(a, 2, 4), 0, '2 at 2.5 is 0.8 owed on a');
  assert.equal(partyFoeLoses(b, 2, 4), 0, 'and 0.8 on b - not 1.6 on one shared purse');
  assert.equal(partyFoeLoses(a, 1, 4), 1, 'a\'s own 0.8 + 0.4 pays a point');
  // REC-11: every 4.5 blows of 1 against eight take a point - the 5th and the 9th
  const pin = {};
  assert.deepEqual(Array.from({ length: 9 }, () => partyFoeLoses(pin, 1, 8)), [0, 0, 0, 0, 1, 0, 0, 0, 1]);
  // DOORS-5: a heal is weighed as the damage is, on its own remainder
  const h = {};
  assert.equal(partyFoeHeals(h, 20, 4), 8, 'a heal of 20 against four is 8 of the bigger pool');
  assert.equal(partyFoeHeals(h, 1, 4), 0); assert.equal(partyFoeHeals(h, 1, 4), 0); assert.equal(partyFoeHeals(h, 1, 4), 1, 'and its remainder carried');
  assert.equal(partyFoeHeals(h, 20, 1), 20, 'alone, the heal itself');
  // DOORS-4: a small hit rises too
  const me = {};
  assert.deepEqual([1, 1, 1, 1].map(() => partyFoeHits(1, 4, me)), [1, 1, 1, 2], 'a rat\'s 1 against four: 1.3 each, the remainder carried');
  const me2 = {};
  for (let i = 0; i < 50; i++) assert.ok(partyFoeHits(3, 2, me2) >= 3, 'never less than the hit');
  assert.equal(partyFoeHits(10, 4), 13, 'without a victim to carry for, rounded');
  // DOORS-1: the kill mark
  const e = {};
  assert.equal(takeWholeBlow(e), false);
  markWholeBlow(e);
  assert.equal(takeWholeBlow(e), true, 'a marked strike is a kill');
  assert.equal(takeWholeBlow(e), false, 'once');
  assert.equal(partySizeOf(0), 1); assert.equal(partyToughness(8), 4.5);
});

test('AUDIT PSCALE1 outdoors, driven - WHOEVER FIGHTS IT: my foe is as tough as the players striking it (a stranger\'s blow counts, a partymate idling does not), and every reader weighs its hits by the owner\'s streamed count; a kill - the sinks\' flag, the Razor\'s mark, a peer\'s kill through applyHit - is never divided; a heal on it is weighed; the reflection runs through its door (mutants: fighters unnoted, the count unstreamed, the record unread, a kill divided, the divert dropping the kill, the heal unweighed, the door unregistered)', async () => {
  _resetPartyScaleForTests();
  clock.t = 1000;
  const hits = [];
  const peers = [{ id: 'bob-0002', feet: [11, 0, 10] }, { id: 'carl-0003', feet: [10, 0, 11] }, { id: 'dave-0004', feet: [9, 0, 10] }];
  const owner = createExteriorFoes(rig());
  netted(owner, { peers, hits });
  const rat = await owner.spawnFoe(0, [10, 0, 10], { feetGiven: true });
  rat.entity.health = rat.entity.maxHealth = 100;
  blowFrom(owner, rat, 'me', 3);
  assert.equal(rat.entity.health, 97, 'I alone: the blow itself');
  for (const p of peers) blowFrom(owner, rat, p.id, 0);
  for (let k = 0; k < 5; k++) blowFrom(owner, rat, 'me', 3);
  assert.equal(rat.entity.health, 91, 'four fighting it: fifteen is six');
  // the stream carries the count; a reader takes it
  const frame = owner.foesFrame(true);
  const rec = frame.f.find((r) => r.i === rat.seq);
  assert.equal(rec.n, 4, 'the record says four fight it');
  const reader = createExteriorFoes(rig({ onPlayerHurt: () => {} }));
  netted(reader, { self: 'eve-0005' });
  reader.applyFoes('mac-0001', frame); await settle();
  const pup = reader.foes.find((f) => f.puppet === 'mac-0001');
  assert.equal(pup._fightN, 4, 'the reader reads the owner\'s count');
  assert.equal(reader.partyHit(10, pup), 13, 'and its blow on me is four fighters\' - 13 for 10');
  // the window: a minute of nobody striking and it fights one again
  clock.t += PARTY_FIGHT_WINDOW_MS + 1;
  blowFrom(owner, rat, 'me', 3);
  assert.equal(rat.entity.health, 88, 'thirty seconds on, only my fresh blow counts');
  assert.equal(owner.foesFrame(true).f.find((r) => r.i === rat.seq).n, undefined, 'and the record omits a count of one');
  // DOORS-1: a kill is a kill
  for (const p of peers) blowFrom(owner, rat, p.id, 0);
  owner.damageFoe(rat, rat.entity.health, null, null, { fromPlayer: false, kind: 'spell', whole: true });
  assert.ok(rat.dead, 'a Disintegrate at four fighters kills');
  const orc = await owner.spawnFoe(0, [12, 0, 12], { feetGiven: true });
  orc.entity.health = 100;
  for (const p of peers) blowFrom(owner, orc, p.id, 0);
  markWholeBlow(orc.entity);
  blowFrom(owner, orc, 'me', 110);
  assert.ok(orc.dead, 'the Razor\'s whole-health strike kills at four');
  const ogre = await owner.spawnFoe(0, [14, 0, 14], { feetGiven: true });
  ogre.entity.health = 100;
  for (const p of peers) blowFrom(owner, ogre, p.id, 0);
  owner.applyHit('bob-0002', { i: ogre.seq, dmg: 100, kind: 'spell', k: 'world:3,12', z: 1 });
  assert.ok(ogre.dead, 'a peer\'s kill arrives as a kill');
  // the divert: a puppet struck with a kill tells its owner so
  hits.length = 0;
  const other = createExteriorFoes(rig());
  const sent = [];
  netted(other, { self: 'eve-0005', hits: sent, peers: [{ id: 'mac-0001', feet: [10, 0, 10] }] });
  other.applyFoes('mac-0001', { n: 1, k: 'world:3,12', full: 1, f: [{ i: 77, t: 0, x: 0, f: [10, 0, 10], y: 0, h: 50, d: 0 }] }); await settle();
  const pup2 = other.foes.find((f) => f.puppet === 'mac-0001');
  other.damageFoe(pup2, 50, [10, 0, 10], null, { fromPlayer: true, whole: true });
  assert.equal(sent.at(-1)?.z, 1, 'the owner is told it is a kill');
  other.damageFoe(pup2, 5, [10, 0, 10], null, { fromPlayer: true });
  assert.equal(sent.at(-1)?.z, undefined, 'and a blow is a blow');
  // DOORS-5: a heal on a shared foe is a heal of the bigger pool
  const troll = await owner.spawnFoe(0, [16, 0, 16], { feetGiven: true });
  troll.entity.health = 50; troll.entity.maxHealth = 200;
  for (const p of peers) blowFrom(owner, troll, p.id, 0);
  blowFrom(owner, troll, 'me', 0);
  owner.healFoe(troll, 20);
  assert.equal(troll.entity.health, 58, 'twenty against four is eight');
  // DOORS-2: Namira's reflection through the foe's own door - its death, its fighters
  const wearer = { ...playerEntity(), equip: { slots: { Ring0: { name: 'Artifact', currentCondition: 800, maxCondition: 800, enchantments: [{ type: T.SpecialArtifactEffect, param: ARTIFACTS.RingOfNamira }] } } } };
  const zombie = await owner.spawnFoe(0, [18, 0, 18], { feetGiven: true });
  zombie.mobileType = MOBILE_TYPES.Zombie ?? zombie.mobileType; zombie.entity.mobileType = zombie.mobileType;
  zombie.entity.health = 4;
  onPlayerStruckByEnemy(zombie.entity, wearer, 10);
  assert.ok(zombie.dead, 'a reflected blow through the door kills - it wrote the number and left a foe at -16, alive');
});

test('AUDIT PSCALE1 the dungeon, mounted: a layout foe is as tough as the players striking it at the host (a joiner\'s through applyHit); a joiner reads the host\'s count off the record; a foe past the layout and my ally never; the blow and the arrow at me are weighed ONCE, in the declaration the flash and the cry read (mutants: fighters unread at the door, a kill divided, the joiner\'s count unread, the hit weighed after the flash, the heal unweighed)', () => {
  _resetPartyScaleForTests();
  const D = read('src/scenes/dungeonContext.js');
  const a = D.indexOf('function _sharedFoe(f) {'), b = D.indexOf('function damageFoe(foe, damage,', a);
  assert.ok(a > 0 && b > a, 'the helpers are found');
  const helpers = strip(D.slice(a, b));
  const door = strip(D.slice(b, D.indexOf('if (foe.entity.health <= 0) {', b))).match(/foe\.entity\.health -=[^;]*;/g);
  assert.equal(door?.length, 1, 'one subtraction at the door');
  const pe = playerEntity();
  const lf = { entity: { health: 100, maxHealth: 200 } }, ally = { entity: { health: 100, team: 'PlayerAlly' } }, ambush = { entity: { health: 100 } };
  const scope = { foes: [lf, ally, ambush], _layoutFoes: 2, _authority: true, playerEntity: pe, partyFoeLoses, partyFoeHits, partyFoeHeals, foeFighters, performance };
  const d = mount(helpers, scope, `return { _sharedFoe, fightN, _weighHit, healFoe,
    door: (foe, healthDamage, bypassShield, _whole) => { ${door[0]} } };`);
  const now = performance.now();
  for (const who of [PARTY_ME, 'bob-0002', 'carl-0003', 'dave-0004']) noteFighter(lf, who, now);
  d.door(lf, 5, false, false); assert.equal(lf.entity.health, 98, 'five at four fighters is two');
  d.door(lf, 10, false, true); assert.equal(lf.entity.health, 88, 'a kill\'s damage whole');
  d.door(lf, 3, true, false); assert.equal(lf.entity.health, 85, 'a SetHealth(0) whole');
  noteFighter(ambush, 'bob-0002', now); noteFighter(ambush, PARTY_ME, now);
  d.door(ambush, 5, false, false); assert.equal(ambush.entity.health, 95, 'past the layout, never');
  for (const who of [PARTY_ME, 'bob-0002', 'carl-0003', 'dave-0004']) noteFighter(ally, who, now);
  d.door(ally, 5, false, false); assert.equal(ally.entity.health, 95, 'an ally inside the layout, never - even struck by four');
  assert.equal(d._weighHit(lf, 10), 13, 'a layout foe\'s blow on me at four: 13 for 10');
  assert.equal(d._weighHit(ambush, 10), 10, 'past the layout: 10');
  assert.equal(d._weighHit(null, 0), 0);
  d.healFoe(lf, 20); assert.equal(lf.entity.health, 93, 'a heal of 20 on a layout foe fought by four is 8');
  scope._authority = false;
  const j = mount(helpers, { ...scope, _authority: false }, 'return { fightN, _weighHit, healFoe };');
  lf._fightN = 3;
  assert.equal(j.fightN(lf), 3, 'a joiner reads the host\'s word');
  assert.equal(j._weighHit(lf, 10), 12, 'and is struck by three fighters\' weight');
  j.healFoe(lf, 20); assert.equal(lf.entity.health, 113, 'a joiner\'s copy is the host\'s to heal - unweighed until the record');
  // the blow and the arrow at me: weighed where the damage is declared, so the flash and the cry read what I took
  const S = strip(D);
  assert.match(S, /const dmg = _weighHit\(f, foeDeps\.calculateAttackDamage\(f\.entity, foeDeps\.playerEntity, \{/, 'the blow');
  assert.match(S, /const dmg = foeDeps && shooter \? _weighHit\(shooter, foeDeps\.calculateAttackDamage\(shooter\.entity, playerEntity, \{/, 'the arrow');
  const melee = S.slice(S.indexOf('function resolveFoeMelee('), S.indexOf('function collisionTriggers('));
  assert.deepEqual(melee.match(/hurtPlayer\([^)]*\)/g), ['hurtPlayer(dmg)'], 'the blow lands the weighed number');
  assert.match(melee, /flashPlayerDamage\(dmg\);\s*playPlayerVoice\(audio, playerPainVoice\(playerEntity, dmg\)\);/, 'and the flash and the cry read it');
  // the stream: the host's record carries the count; the joiner's record reader takes it
  assert.match(S, /if \(!f\.dead && _sharedFoe\(f\)\) \{ const n = fightN\(f\); if \(n > 1\) r\.n = n; \}/, 'the host streams n');
  assert.match(S, /f\._fightN = r\.n \?\? 1;/, 'a joiner reads n');
  assert.match(S, /if \(fromPlayer\) noteFighter\(foe, peer \? peerId : PARTY_ME, performance\.now\(\)\);/, 'the door names every player\'s blow a fighter');
  assert.match(S, /damageFoe\(f, dmg, at, dir, \{ fromPlayer: true, peer: true, kind, peerId: id, whole: data\.z === 1 \}\);/, 'a joiner\'s kill is a kill at the host');
});

test('AUDIT PSCALE1 the count\'s other readers: the outdoor roll counts the partymates within the radius (outdoors only - the dungeon arm is gone), and a shared foe\'s Renown bonus counts no more partymates than fought it (mutants: strangers counted, a far mate counted, the bonus uncapped)', () => {
  const W = read('src/scenes/world.js');
  const a = W.indexOf('const partySize = () => {');
  const size = (over) => mount(strip(balanced(W, a, '{', '}')), { online: null, partyNear: () => [], player: { feetAt: () => [0, 0, 0] }, GROUP_ROLL_RADIUS, partySizeOf, ...over }, 'return partySize;')();
  const mates = [{ feet: [60, 0, 0] }, { feet: [0, 40, 80] }, { feet: [150, 0, 0] }];
  assert.equal(size({}), 1, 'offline');
  assert.equal(size({ online: { status: 'open', room: 'world:3,12' }, partyNear: () => mates }), 3, 'me + the two mates within 100 (flat); the one at 150 out');
  assert.equal(size({ online: { status: 'open', room: 'dungeon:m7' }, partyNear: () => [] }), 1, 'a dungeon room counts no strangers - a fight there weighs its fighters');
  assert.equal(size({ online: { status: 'connecting', room: 'world:3,12' }, partyNear: () => mates }), 1, 'a room not open');
  assert.equal(size({ online: { status: 'open', room: 'world:3,12' }, partyNear: () => new Array(9).fill({ feet: [1, 0, 1] }) }), 8, 'never past the seats');
  assert.match(strip(W), /setRenownKillHandler\(\(foe\) => \{ const party = 1 \+ \(partyNear\(\)\?\.length \?\? 0\); renownTracker\.earn\(renownPartyXp\(renownKillXp\(renownFoeLevel\(foe\), renownNow\), Number\.isInteger\(foe\?\._fightN\) \? Math\.min\(party, foe\._fightN\) : party\)\); \}\);/, 'PLAY-4: the bonus');
  assert.ok(!/partySize: \(\) => partySize\(\)/.test(strip(W)), 'no pool or mode is handed the roll\'s count for a fight');
  assert.ok(!/partySize:/.test(strip(read('src/scenes/worldModes.js'))), 'nor the dungeon');
});

function stands(over = {}) {
  const W = read('src/scenes/world.js');
  const a = W.indexOf('let _updatedGuards = false;'), b = W.indexOf('// CAMP1 - GROUP ENCOUNTERS', a);
  assert.ok(a > 0 && b > a, 'the tick\'s head is found');
  const out = [];
  mount(strip(W.slice(a, b)), {
    modes: { mode: 'exterior' }, span: 1, amGroupRollOwner, online: { id: 'mac-0002' }, player: { feetAt: () => [0, 0, 0], isPlayerSwimming: false },
    partyNear: () => [], walkMode: true, playerSpawned: true, intermittentEnemySpawn: () => ({ mobileType: over.mobileType ?? 7 }), _lastEncMinutes: 0,
    playerEntity: { isResting: false, level: 1 }, _musicInLocationRect: () => false, maps: { getClimateIndex: () => 0 }, playerTravelPixel: () => ({ x: 0, y: 0 }),
    SOLITARY_TYPES, partyExtraFoes, partySize: () => 1, _standEncounterFoe: (hit) => out.push(hit.mobileType), playerFeet: [0, 0, 0], ...over,
  }, '}');
  return out;
}

test('AUDIT PSCALE1 the party\'s one roll, mounted: the lowest id among my PARTYMATES rolls (a stranger never silences mine), greedy so a chain leaves nobody out; a REST is always its rester\'s own; a solitary foe meets a party alone (mutants: strangers in the vote, the rest unexempted, a squad of Liches)', () => {
  assert.deepEqual(stands(), [7], 'alone: one wanderer');
  assert.deepEqual(stands({ online: null }), [7], 'offline: one');
  assert.deepEqual(stands({ partySize: () => 5 }), [7, 7, 7], 'the roller for five stands two more of its kind');
  assert.deepEqual(stands({ partySize: () => 5, partyNear: () => [{ id: 'bob-0001', feet: [50, 0, 0] }] }), [], 'a partymate with the lower id within 100 rolls for the party');
  assert.deepEqual(stands({ partySize: () => 5, partyNear: () => [{ id: 'bob-0001', feet: [50, 0, 0] }], playerEntity: { isResting: true, level: 1, restAsks: 1 } }), [7, 7, 7], 'COUNT-1: resting, my roll is mine - the mirror beside me never rolls');
  assert.deepEqual(stands({ peersNear: () => [{ id: 'aaa-0001', feet: [5, 0, 0] }] }), [7], 'PLAY-2: a stranger with the lowest id beside me takes nothing of mine');
  const lich = [...SOLITARY_TYPES][0];
  assert.deepEqual(stands({ partySize: () => 8, mobileType: lich }), [lich], 'COUNT-2: a solitary foe alone, whatever the party');
  assert.deepEqual(stands({ partySize: () => 8 }), [7, 7, 7, 7], 'and a pack animal three more');
  // COUNT-5: the election, greedy by id
  const at = (x) => [x, 0, 0];
  assert.equal(amGroupRollOwner('a-01', at(0), [{ id: 'b-02', feet: at(60) }, { id: 'c-03', feet: at(120) }]), true, 'the chain\'s low end');
  assert.equal(amGroupRollOwner('b-02', at(60), [{ id: 'a-01', feet: at(0) }, { id: 'c-03', feet: at(120) }]), false, 'within reach of it');
  assert.equal(amGroupRollOwner('c-03', at(120), [{ id: 'a-01', feet: at(0) }, { id: 'b-02', feet: at(60) }]), true, 'COUNT-5: out of the roller\'s reach - rolls (it deferred to B, who deferred to A)');
  assert.equal(amGroupRollOwner('c-03', at(20), [{ id: 'a-01', feet: at(0) }, { id: 'b-02', feet: at(10) }]), false, 'a huddle: the lowest alone');
  assert.equal(amGroupRollOwner('c-03', at(0), []), true, 'nobody to defer to');
});

test('AUDIT PSCALE1 a camp or a pack grows by its own members, mounted - one more for every two partymates past the first, from its own in order, each placed against the spots in flight (mutants: the camp not growing, a camp grown by strangers\' kinds)', () => {
  const t = strip(read('src/scenes/world.js'));
  const at = t.indexOf('const _standCampEncounter = (hit, feet) => {');
  assert.ok(at > 0, 'the camp stand is found');
  const fn = balanced(t, at + 'const _standCampEncounter = '.length, '{', '}');
  const camp = (n) => {
    const stood = [];
    const standCamp = mount('', {
      placeFoeEnv: () => ({}), collider: {}, cam: { yaw: 0 }, fieldOfView: () => 1, entityOccupancy: () => () => false, _placingPool: () => [],
      LOOSE_FOE_PLACE_ATTEMPTS: 1, placeFoeFreely: () => ({ x: 1, y: 0, z: 1 }), _inAnyLocationRect: () => false, _nextCampId: 1,
      partyGroupMembers, partySize: () => n, ENEMY_BASICS: {},
      exteriorFoes: { spawnFoe: (mobileType) => { stood.push(mobileType); return Promise.resolve(null); } },
    }, `return (hit, feet) => ${fn.slice(fn.indexOf('{'))};`);
    standCamp({ mobileTypes: [10, 11, 12], minDistance: 14, maxDistance: 26, spacing: 3, alertRadius: 9 }, [0, 0, 0]);
    return stood;
  };
  assert.deepEqual(camp(1), [10, 11, 12], 'alone, the camp as it rolled');
  assert.deepEqual(camp(5), [10, 11, 12, 10, 11], 'five: two more, from its own in order');
  assert.deepEqual(camp(8), [10, 11, 12, 10, 11, 12], 'eight: three more');
});

test('AUDIT PSCALE1 COUNT-3: a stand in flight holds its spot - the pool names the feet crossing spawnFoe\'s awaits, and the camp and the wanderer place against them (mutants: the pending feet unexported, the placing pool without them)', async () => {
  const pool = createExteriorFoes(rig());
  const p = pool.spawnFoe(0, [3, 0, 4], { feetGiven: true });
  assert.deepEqual(pool.pendingFeet(), [[3, 0, 4]], 'the spot is held before the first await');
  await p;
  assert.deepEqual(pool.pendingFeet(), [], 'and let go when it lands');
  const W = strip(read('src/scenes/world.js'));
  const a = W.indexOf('const _placingPool = () =>');
  const placing = mount(W.slice(a, W.indexOf(';', a) + 1), { exteriorFoePool: () => [{ ai: { feet: [1, 0, 1] } }], exteriorFoes: { pendingFeet: () => [[5, 0, 5]] } }, 'return _placingPool;');
  assert.deepEqual(placing().map((f) => f.ai?.feet ?? f.feet), [[1, 0, 1], [5, 0, 5]], 'the street and the spots in flight');
  assert.equal((W.match(/entityOccupancy\(\(f\) => f\.ai\?\.feet \?\? f\.feet, _placingPool,/g) ?? []).length, 3, 'the wanderer, the camp\'s anchor and its members');
});

test('AUDIT PSCALE1 COUNT-4: a reader stands an owner\'s loose stand beside a camp of five grown by three - the allowance is the owner\'s encounter cap and CELL_LOOSE_PUPPETS more; `n` is a whole 2..8 on the wire (mutants: the allowance back at eight, n unvalidated)', async () => {
  assert.equal(CELL_PUPPETS_MAX, MAX_ACTIVE_ENCOUNTER_FOES + CELL_LOOSE_PUPPETS);
  assert.ok(CAMP_SIZE[1] + 3 + 1 <= CELL_PUPPETS_MAX, 'the widest camp, its three more and a loose stand');
  const owner = createExteriorFoes(rig()); netted(owner, { self: 'own-0001' });
  const reader = createExteriorFoes(rig()); netted(reader, { self: 'rdr-0002' });
  await Promise.all(partyGroupMembers([0, 0, 0, 0, 0], 8).map((t, k) => owner.spawnFoe(t, [10 + k * 2, 0, 10], { feetGiven: true })));
  const loose = await owner.spawnFoe(0, [30, 0, 30], { feetGiven: true, loose: true });
  reader.applyFoes('own-0001', owner.foesFrame(true)); await settle();
  const stood = reader.foes.filter((f) => f.puppet === 'own-0001' && !f.dead);
  assert.equal(stood.length, 9, 'eight and the loose one');
  assert.ok(stood.some((f) => f.seq === loose.seq), 'the loose foe is seen');
  assert.equal(validFoeRecord({ i: 1, n: 4 })?.n, 4);
  for (const bad of [1, 9, 2.5, '3', -2]) assert.equal(validFoeRecord({ i: 1, n: bad }), null, `n ${JSON.stringify(bad)} refused whole`);
  assert.equal('n' in validFoeRecord({ i: 1 }), false, 'absent is one');
});

test('AUDIT PSCALE1 DOORS-1 at the sources and NET-2/NET-3 in the host: a Disintegrate and a stat drained to zero hand their sinks a kill, the Razor marks its strike; peersNear reads the session\'s own clock; a door out of the open country hands my foes over (mutants: the flags dropped, the clock foreign, the handover unhooked)', () => {
  // the stat-zero kill
  const said = [];
  const sinks = { hurt: (n, o) => said.push([n, o]) };
  assert.equal(killIfAnyLiveStatZero({ health: 30, stats: { strength: 0 }, activeEffects: [] }, sinks, 1), true);
  assert.deepEqual(said.at(-1), [30, { whole: true }], 'a stat at zero is a kill of the whole health');
  // the Razor
  const razor = SPECIAL_ARTIFACT_HANDLERS.get?.(ARTIFACTS.MehrunesRazor) ?? SPECIAL_ARTIFACT_HANDLERS[ARTIFACTS.MehrunesRazor];
  const target = { health: 40, stats: { willpower: 0 }, activeEffects: [], items: [] };
  assert.equal(takeWholeBlow(target), false);
  assert.equal(razor.strikes({ target, item: {}, rolls: () => 0.999 })?.strikesModulateDamage, 40, 'the save failed: the whole health');
  assert.equal(takeWholeBlow(target), true, 'the Razor\'s strike marks its target - the door takes it undivided');
  assert.equal(razor.strikes({ target, item: {}, rolls: () => 0.001 }), null, 'a saved strike...');
  assert.equal(takeWholeBlow(target), false, '...marks nothing');
  // Disintegrate passes the flag (by source: the effect engine's sink call)
  assert.match(strip(read('src/systems/effects.js')), /sinks\.hurt\(left, \{ whole: true \}\);/, 'a Disintegrate is a kill');
  // NET-2
  const W = strip(read('src/scenes/world.js'));
  const pn = W.indexOf('const peersNear = () => {');
  const seen = [];
  const peersNear = mount(balanced(W, pn, '{', '}'), {
    online: { room: 'world:3,12', status: 'open', peers: new Map([['bob-0002', { id: 'bob-0002', shown: { x: 1, y: 0, z: 1 } }]]), visible: (p, now) => { seen.push(now); return true; } },
    peerBodies: null, _peerHeights: new Map(), onlineToScene: (p) => [p.x, p.y, p.z],
  }, 'return peersNear;');
  assert.equal(peersNear().length, 1);
  assert.deepEqual(seen, [undefined], 'visible() on its own clock - performance.now() against Date.now() stamps never timed a peer out');
  // NET-3
  const hn = W.indexOf('const handOverFoes = () => {');
  const sentFrames = [];
  let dropped = 0;
  const hand = (over) => mount(balanced(W, hn, '{', '}'), {
    online: { room: 'world:3,12', sendFoes: (f) => { sentFrames.push(f); return true; } }, isCellRoom: (k) => String(k).startsWith('world:'), modes: { mode: 'exterior' },
    peersNear: () => [{ id: 'bob-0002', feet: [5, 0, 5] }], exteriorFoes: { handOverFrame: (heirOf) => ({ f: [heirOf({ ai: { feet: [4, 0, 4] } })] }), dropOwnLive: () => (dropped = 2) }, ...over,
  }, 'return handOverFoes;')();
  assert.equal(hand({}), 2, 'my foes to the nearest player outside');
  assert.deepEqual(sentFrames.at(-1), { f: ['bob-0002'] });
  assert.equal(hand({ peersNear: () => [] }), 0, 'nobody to take them: they stay mine');
  assert.equal(hand({ modes: { mode: 'interior' } }), 0, 'never from inside');
  assert.match(W, /onPreTransition: \(\) => \{ const n = handOverFoes\(\);/, 'the modes host is handed it');
  const M = strip(read('src/scenes/worldModes.js'));
  assert.equal((M.match(/host\.onPreTransition\?\.\(\);\s*host\.horseCart\?\.\(\)\?\.handlePreTransition\(\{ type: 'To(?:Building|Dungeon)Interior'/g) ?? []).length, 2, 'both doors ask it first');
});

test('AUDIT PSCALE1 REC-3/REC-6: the shared archer\'s arrow and a puppet\'s real swing at me land the fighters\' weight - 13 for 10 at four, driven', async () => {
  registerFormulaOverride('calculateAttackDamage', () => 10);
  try {
    const t = strip(read('src/scenes/world.js'));
    const at = t.indexOf('onPlayerHit: (m) => {', t.indexOf('arrows.update(dt, {'));
    assert.ok(at > 0, 'the handler is found');
    const fn = balanced(t, at + 'onPlayerHit: '.length, '{', '}');
    const pool = createExteriorFoes(rig());
    netted(pool);
    const got = [], noop = () => {};
    const handler = mount('', {
      exteriorFoes: pool, calculateAttackDamage, tallySkill: noop, playerEntity: playerEntity(), SKILLS: { Dodging: 0 }, inflictPoison: noop, playerTicker: { classicMinutes: 0 },
      townTalk: { say: noop }, hurtPlayer: (e, d) => got.push(d), audio: { playOneShot: noop }, hitSoundFor: () => 0, PLAYER_HIT_VOLUME: 1, flashPlayerDamage: noop,
      playPlayerVoice: noop, playerPainVoice: () => null, surfacePlayer: noop, addItem: noop, bowDamageArrow: () => ({}),
    }, `return (m) => ${fn.slice(fn.indexOf('{'))};`);
    handler({ shooterFoe: { mobileType: 0, puppet: 'bob-0002', _fightN: 4, entity: {}, dead: false }, weapon: null });
    handler({ shooterFoe: { mobileType: 0, entity: {}, dead: false, isQuestFoe: true }, weapon: null });
    assert.deepEqual(got, [13, 10], 'a streamed archer fought by four; a quest\'s archer never');
  } finally { registerFormulaOverride('calculateAttackDamage', null); }
});
