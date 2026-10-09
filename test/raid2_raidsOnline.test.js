// RAID2 (2026-09-27, Mac on World Events - Raiding Parties online: "1. Server 2. Keep 3. ... 4. 4 5. Yes"): THE RAIDS
// ON THE ONLINE WORLD. One player in a raided town runs the raid (the first to claim it keeps it - WOD7's law; with no
// claim, the smallest id in the town claims), its raiders ride its cell stream tagged with the raid (`rz`) and stand at
// every reader under an allowance of their own, its defenders ride named as its allies (`al`) and stand as a reader's
// allies too, and every owner's word (`rk`) carries its share of the raid's deaths and its claim - a raid is cleansed
// where the shares sum to its target. Held here: the wire's validators and the election law; the runner driven through
// a recording host online; the shares, the cleanse and a peer's fight through a puppet; two real foe pools trading a
// frame; the lane, the lock's words and the world host's wiring by source.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  RAID_CLAIM_WINDOW_MS, RAID_WORD_STALE_MS, RAID_WORDS_MAX, RAID_PUPPETS_MAX, RAID_TAGS_MAX,
  validRaidWords, validRaidTags, validAlliedIds, raidRunnerOf,
} from '../src/world/raidShared.js';
import { RAID_KEY_RE } from '../src/net/raidLaw.js';
import {
  RAIDING_PARTIES_VENDOR, MAX_RAID_ENEMIES, RAID_CLAIM_GRACE_MS, raidFrame as frame, raidPeerWord, raidWireWord,
  raidKillTotal, raidKey, restoreRaidSaveData as restoreSaveData, raidState, setRaidingPartiesHost,
  cleansedLine, _resetRaidingParties, _raidRuntime,
} from '../src/systems/raidingParties.js';
import { setSharedClock } from '../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { renownFoeStruck, _resetRenownKillsForTests } from '../src/net/renownTracker.js';
import { _resetModSettings } from '../src/systems/modSettings.js';
import { ONLINE_ROOM_MOD_KEYS, ONLINE_PLAYERS_OWN_MODS } from '../src/systems/onlineLane.js';
import { CELL_PUPPETS_MAX, CELL_WATCH_PUPPETS_MAX, CELL_LOOSE_PUPPETS, CELL_FRAME_RECORDS_MAX } from '../src/net/wire.js';
import { createExteriorFoes, ENCOUNTER_PUPPETS_MAX } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));
const DAY = 400;
const AT = (min) => DAY * MINUTES_PER_DAY + min;
const KEY = `3:7:${DAY}`;
const raidRec = (o = {}) => ({
  regionIndex: 3, locationIndex: 7, startDay: DAY, locationName: 'Gothway Garden', type: 2,
  startMinute: AT(600), endMinute: AT(720), killed: 0, attackAmount: 3, cleansed: false,
  announced: true, struck: false, px: 200, py: 100, ...o,
});

/** The raid1 rig, online: the net's clock, who I am, who stands in the town, the raid's puppets and my taken foes. */
function rig({ me = 'mmm-0002' } = {}) {
  const at = { now: AT(610), wall: 100000, me, inTown: [], puppets: [], own: [], town: { regionIndex: 3, locationIndex: 7 }, pixel: { x: 200, y: 100 }, roll: 0, allowed: true };
  const log = { said: [], raiders: [], defenders: [] };
  const player = { legalRep: {} };
  let seq = 0;
  const foe = (mobileType) => ({ mobileType, dead: false, corpse: false, entity: { health: 10 }, ai: { feet: [seq, 0, 0] }, uid: ++seq });
  setRaidingPartiesHost({
    now: () => at.now, random: () => at.roll, wallNow: () => at.wall, selfId: () => at.me, maps: () => at.maps ?? null, picker: () => at.picker ?? null,
    regionIndex: () => 3, regionName: (r) => `Region${r}`, townHere: () => at.town, playerPixel: () => at.pixel,
    peersInTown: () => at.inTown, raidPuppets: () => at.puppets, ownRaidFoes: () => at.own,
    standRaider: (mt) => { const f = foe(mt); log.raiders.push(f); return Promise.resolve(f); },
    standDefender: () => { const g = foe(146); g.defender = true; log.defenders.push(g); return Promise.resolve(g); },
    defenderCount: () => log.defenders.filter((g) => !g.dead).length, defendersAllowed: () => at.allowed,
    removeFoe: (f) => { f.dead = true; }, outOfSight: () => true,
    reputation: () => ({ player, store: { dict: new Map() } }), say: (line) => log.said.push(line),
  });
  return { at, log, player };
}

beforeEach(() => {
  _resetRaidingParties();
  _resetRenownKillsForTests();
  _resetModSettings();
  setSharedClock(null);
});

test('RAID2 the wire\'s validators: a word is [key, deaths, claim age], at most four, each raid once; a tag [record, key]; an allied watchman a record number - junk is dropped, never guessed at (mutants: a bound off by one; a duplicate kept; a junk key kept)', () => {
  assert.ok(RAID_KEY_RE.test(KEY) && !RAID_KEY_RE.test('3:7') && !RAID_KEY_RE.test('a:7:400'));
  const words = validRaidWords([[KEY, 4, 1500], [KEY, 9, 0], ['1:2:400', 0, -1], ['bad', 1, 0], ['2:2:400', -1, 0], ['4:4:400', 1000, 0], ['5:5:400', 1, -2], ['6:6:400', 1.5, 0], [7, 1, 0], ['8:8:400', 1], ['9:9:400', 999, 7200000], ['10:1:400', 0, 7200001]]);
  assert.deepEqual(words, [{ key: KEY, n: 4, age: 1500 }, { key: '1:2:400', n: 0, age: -1 }, { key: '9:9:400', n: 999, age: 7200000 }]);
  const many = Array.from({ length: 9 }, (_, i) => [`${i}:1:400`, 1, 0]);
  assert.equal(validRaidWords(many).length, RAID_WORDS_MAX);
  assert.deepEqual(validRaidWords('nope'), []);
  const tags = validRaidTags([[5, KEY], [6, 'bad'], [-1, KEY], [1.5, KEY], [7], [8, KEY, 1], [1e9, KEY], [1e9 + 1, KEY]]);
  assert.deepEqual([...tags], [[5, KEY], [1e9, KEY]]);
  assert.equal(validRaidTags(Array.from({ length: 80 }, (_, i) => [i, KEY])).size, RAID_TAGS_MAX);
  assert.deepEqual([...validAlliedIds([1, 2, 2, -1, 'x', 3.5, 4])], [1, 2, 4]);
  assert.equal(validAlliedIds(Array.from({ length: 80 }, (_, i) => i)).size, RAID_TAGS_MAX);
  assert.equal(RAID_PUPPETS_MAX, MAX_RAID_ENEMIES, 'the reader\'s allowance is the mod\'s cap whole (Mac: "Keep")');
  assert.ok(RAID_PUPPETS_MAX + CELL_WATCH_PUPPETS_MAX + CELL_LOOSE_PUPPETS <= CELL_FRAME_RECORDS_MAX, 'a runner\'s raiders, its watch and its loose stands ride one frame');
});

test('RAID2 who runs a raid: the oldest claim keeps it; a later one inside the window takes it only with a smaller id; with no claim, the smallest id in the town (mutants: the window ignored; the newest claim kept; the largest id)', () => {
  assert.equal(raidRunnerOf({ me: 'mmm', inTown: [], claims: [] }), 'mmm', 'alone');
  assert.equal(raidRunnerOf({ me: 'mmm', inTown: ['zzz', 'aaa'], claims: [] }), 'aaa', 'no claim: the smallest id standing there claims');
  assert.equal(raidRunnerOf({ me: 'mmm', inTown: ['zzz'], claims: [] }), 'mmm');
  assert.equal(raidRunnerOf({ me: 'mmm', claims: [{ id: 'zzz', age: 60000 }, { id: 'aaa', age: 1000 }] }), 'zzz', 'the first to claim keeps it, whatever the ids');
  assert.equal(raidRunnerOf({ me: 'mmm', claims: [{ id: 'zzz', age: 3000 }, { id: 'aaa', age: 1000 }] }), 'aaa', 'inside the window: a race, the smaller id');
  assert.equal(raidRunnerOf({ me: 'mmm', claims: [{ id: 'aaa', age: 3000 }, { id: 'zzz', age: 1000 }] }), 'aaa');
  assert.equal(raidRunnerOf({ me: 'mmm', claims: [{ id: 'zzz', age: RAID_CLAIM_WINDOW_MS + 1001 }, { id: 'aaa', age: 1000 }] }), 'zzz', 'just past the window');
  assert.equal(raidRunnerOf({ me: 'mmm', claims: [{ id: 'zzz', age: RAID_CLAIM_WINDOW_MS + 1000 }, { id: 'aaa', age: 1000 }] }), 'aaa', 'on its edge');
  assert.equal(raidRunnerOf({ me: null, claims: [] }), null);
});

test('RAID2 online, the runner: alone in the town I claim the raid and stand it - my word says so; a peer with an older claim runs it and I stand by, my claim dropped (mutants: the election skipped online; the claim kept after a loss)', async () => {
  const { at, log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec()] });
  setSharedClock(() => at.now);
  assert.equal(frame(1), 'defender', 'alone: mine to run');
  assert.deepEqual(raidWireWord(at.wall), [[KEY, 0, 0]], 'my word: the raid, no deaths yet, claimed just now');
  at.wall += 2000;
  assert.deepEqual(raidWireWord(at.wall), [[KEY, 0, 2000]]);
  await tick();
  at.allowed = false;   // no more defenders: the raider's clock next
  assert.equal(frame(1), 'raider');
  await tick();
  assert.equal(log.raiders[0].raidKey, KEY, 'my raider rides my frame tagged with its raid');
  // a peer's word that fought and claims nothing (-1) is no claim
  raidPeerWord('aaa-0001', [[KEY, 0, -1]], at.wall);
  assert.notEqual(frame(0), 'standing-by', 'still mine');
  // a peer who claimed it well before me
  raidPeerWord('aaa-0001', [[KEY, 0, 60000]], at.wall);
  assert.equal(frame(1), 'standing-by', 'theirs: I stand nothing');
  assert.equal(raidWireWord(at.wall), null, 'and claim nothing - no deaths of mine to say either');
  const stood = log.raiders.length + log.defenders.length;
  for (let i = 0; i < 4; i++) { frame(1); await tick(); }
  assert.equal(log.raiders.length + log.defenders.length, stood, 'no foe stood while another runs it');
  // their word goes quiet: the claim is stale, and the town is mine again
  at.wall += RAID_WORD_STALE_MS + 1;
  assert.notEqual(frame(1), 'standing-by');
  // leaving the town, I run nothing
  at.town = null;
  assert.equal(frame(0), 'idle');
  assert.equal(raidWireWord(at.wall), null, 'no claim once I am out of the town');
});

test('RAID2 a runner who stands down keeps its share: its word says its deaths and no claim (mutants: the share unsaid without a claim; a claim age for no claim)', () => {
  const { at } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ killed: 2, attackAmount: 9 })] });
  setSharedClock(() => at.now);
  raidPeerWord('aaa-0001', [[KEY, 0, 60000]], at.wall);
  assert.equal(frame(0), 'standing-by');
  assert.deepEqual(raidWireWord(at.wall), [[KEY, 2, -1]]);
});

test('RAID2 online, no claim yet: the smallest id in the town claims it - a larger one waits, and claims itself once the smaller has left it unclaimed the grace (mutants: no wait; no grace; the grace from the wrong clock)', () => {
  const { at } = rig({ me: 'mmm-0002' });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec()] });
  setSharedClock(() => at.now);
  at.inTown = ['aaa-0001'];
  assert.equal(frame(1), 'standing-by', 'a smaller id stands in the town: it will claim');
  at.wall += RAID_CLAIM_GRACE_MS - 1;
  assert.equal(frame(1), 'standing-by');
  at.wall += 1;
  assert.notEqual(frame(1), 'standing-by', 'it never did: mine');
  assert.equal(raidWireWord(at.wall)[0][2], 0, 'claimed now');
  const { at: at2 } = (() => { _resetRaidingParties(); return rig({ me: 'aaa-0001' }); })();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec()] });
  at2.inTown = ['mmm-0002'];
  setSharedClock(() => at2.now);
  assert.notEqual(frame(1), 'standing-by', 'the smallest id claims at once');
});

test('RAID2 the deaths are every owner\'s summed: a peer\'s word adds its share - the most it said, never taken back - and the raid is cleansed where the sum meets the target, the reward for one who fought (a puppet struck) on the pixel (mutants: a share replaced by a smaller; the peers\' shares ignored; a puppet\'s blow unread)', async () => {
  const { at, log, player } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ attackAmount: 5 })] });
  setSharedClock(() => at.now);
  raidPeerWord('aaa-0001', [[KEY, 2, 60000]], at.wall);
  raidPeerWord('aaa-0001', [[KEY, 1, 60000]], at.wall);
  raidPeerWord('zzz-0009', [[KEY, 1, -1]], at.wall);
  const raid = raidState().raids[0];
  assert.equal(raidKillTotal(raid), 3, 'two and one; a stale word of one takes nothing back');
  assert.equal(frame(1), 'standing-by', 'aaa runs it');
  const pup = { _pupRaid: KEY, dead: false };
  at.puppets = [pup];
  renownFoeStruck(pup);
  frame(0);
  assert.equal(raid.struck, true, 'a blow on the runner\'s raider - a puppet here - is a fight in the raid');
  raidPeerWord('aaa-0001', [[KEY, 4, 60000]], at.wall);
  frame(0);
  assert.equal(raid.cleansed, true, 'four and one: five, the target');
  assert.equal(log.said.at(-1), cleansedLine('Gothway Garden', 'Region3', 2));
  assert.equal(player.legalRep[3], 5, 'fought, on the pixel: paid');
  assert.equal(raidWireWord(at.wall), null, 'a cleansed raid is no one\'s to run');
  assert.equal(log.raiders.length, 0, 'and this client stood none of it');
});

test('RAID2 a save from a clock of its own: online, a list rolled for a day the world has not reached is rolled afresh for the world\'s day - offline the mod\'s law holds, only a later day rolls (mutants: the world\'s day ignored; the rule taken offline)', () => {
  const { at } = rig();
  const names = Array(8).fill('x'); names[7] = 'Gothway Garden';
  const table = [...Array(7).fill({ locationType: 12 }), { locationType: 0, longitude: 200 * 128, latitude: (499 - 100) * 128 }];
  at.maps = { regionCount: 62, getRegion: (r) => (r === 3 ? { mapNames: names, mapTable: table } : null) };
  at.picker = Uint8Array.from([128 + 3]);
  const ahead = raidRec({ startDay: DAY + 5, startMinute: AT(5 * MINUTES_PER_DAY + 600), endMinute: AT(5 * MINUTES_PER_DAY + 720) });
  restoreSaveData({ lastSelectedDay: DAY + 5, raids: [ahead] });
  frame(0);
  assert.equal(raidState().lastSelectedDay, DAY + 5, 'offline: the mod\'s law - an earlier day rolls nothing');
  setSharedClock(() => at.now);
  frame(0);
  assert.equal(raidState().lastSelectedDay, DAY, 'online: the world\'s day, rolled');
  assert.ok(raidState().raids.every((r) => r.startDay === DAY), 'the future list gone');
});

test('RAID2 a raider taken over is counted: a foe of the raid I took from a fallen runner rides in my word as my share when it dies (mutants: the taken foe ignored)', async () => {
  const { at } = rig({ me: 'aaa-0001' });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ attackAmount: 9 })] });
  setSharedClock(() => at.now);
  const taken = { raidKey: KEY, dead: false, corpse: false, entity: { health: 5 }, ai: { feet: [0, 0, 0] } };
  at.own = [taken];
  frame(0);
  taken.dead = true; taken.corpse = true;
  frame(0);
  assert.equal(raidState().raids[0].killed, 1);
  assert.deepEqual(raidWireWord(at.wall), [[KEY, 1, 0]], 'my share said, my claim beside it');
});

// ---- two real foe pools, an owner and a reader (the DEEP-SHARE rig)
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
const pool = (self, watch = []) => {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (/^CLASS\d\d\.CFG$/.test(n)) return craftCfg(); throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: () => true, watch: { list: () => watch, hurt: () => {} }, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  return p;
};

test('RAID2 executed over two pools: a runner\'s twenty raiders ride named with their raid and a reader stands all twenty (it stood twelve), each knowing its raid; thirty stand the allowance; the word reaches the raids\' hook past the room test (mutants: the tag unwritten; the allowance the old one; the raid unread at the build)', async () => {
  const owner = pool('aaa-0001'), reader = pool('mmm-0002');
  for (let i = 0; i < 20; i++) { const f = await owner.spawnFoe(0, [100 + i, 0, 100], { feetGiven: true, loose: true, transient: true }); f.raidKey = KEY; }
  const fr = owner.foesFrame(true);
  assert.equal(fr.f.length, 20);
  assert.deepEqual(fr.rz.map(([, k]) => k), Array(20).fill(KEY));
  assert.deepEqual(fr.rz.map(([i]) => i).sort((a, b) => a - b), fr.f.map((r) => r.i).sort((a, b) => a - b));
  const heard = [];
  reader.setOnRaids((from, rk) => heard.push([from, rk]));
  reader.applyFoes('aaa-0001', { ...fr, rk: [[KEY, 3, 1000]] });
  for (let i = 0; i < 5; i++) await settle();
  const pups = reader.foes.filter((f) => f.puppet === 'aaa-0001' && !f.dead);
  assert.equal(pups.length, 20, 'every raider stands here');
  assert.ok(pups.every((f) => f._pupRaid === KEY));
  assert.deepEqual(heard, [['aaa-0001', [[KEY, 3, 1000]]]]);
  const big = pool('bbb-0004'), reader2 = pool('mmm-0002');
  for (let i = 0; i < 30; i++) { const f = await big.spawnFoe(0, [100 + i, 0, 100], { feetGiven: true, loose: true, transient: true }); f.raidKey = KEY; }
  reader2.applyFoes('bbb-0004', big.foesFrame(true));
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(reader2.foes.filter((f) => f.puppet === 'bbb-0004' && !f.dead).length, RAID_PUPPETS_MAX, 'the raid\'s allowance holds');
  const plain = pool('ccc-0003'), reader3 = pool('mmm-0002');
  for (let i = 0; i < 20; i++) await plain.spawnFoe(0, [100 + i, 0, 100], { feetGiven: true, loose: true, transient: true });
  const pf = plain.foesFrame(true);
  assert.equal(pf.rz, undefined, 'a foe of no raid is not named');
  reader3.applyFoes('ccc-0003', pf);
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(reader3.foes.filter((f) => f.puppet === 'ccc-0003' && !f.dead).length, Math.min(20, ENCOUNTER_PUPPETS_MAX), 'held to the owner\'s encounter allowance (DESYNC-ZERO: ENCOUNTER_PUPPETS_MAX)');
});

test('RAID2 the defenders\' side: a watchman who is the owner\'s ally rides named (`al`) and stands as the reader\'s ally; a later frame that no longer names him stands him as the watch again (mutants: al unwritten; the build\'s side ignored; the flip back ignored)', async () => {
  const guard = { seq: null, mobileType: 146, gender: 'male', ai: { feet: [120, 0, 100], yaw: 0, target: null, moving: false }, entity: { health: 30, level: 1, weapon: null }, dead: false, corpse: false, defender: true, puppet: null, placed: false };
  const owner = pool('aaa-0001', [guard]), reader = pool('mmm-0002');
  const fr = owner.foesFrame(true);
  const rec = fr.f.find((r) => r.t === 146);
  assert.ok(rec, 'the watchman rides');
  assert.deepEqual(fr.al, [rec.i], 'named as the owner\'s ally');
  reader.applyFoes('aaa-0001', fr);
  for (let i = 0; i < 5; i++) await settle();
  const pup = reader.foes.find((f) => f.puppet === 'aaa-0001' && f.mobileType === 146);
  assert.ok(pup, 'stood here');
  assert.equal(pup.entity.team, 'PlayerAlly');
  assert.equal(pup.entity.mobileTeam, 'PlayerAlly');
  guard.defender = false;   // a crime turned him (cityGuards.js enlistDefender)
  const fr2 = owner.foesFrame(true);
  assert.equal(fr2.al, undefined);
  reader.applyFoes('aaa-0001', fr2);
  assert.equal(pup.entity.team, 'CityWatch', 'the watch again');
  assert.equal(pup.entity.mobileTeam, 'CityWatch');
});

test('RAID2 a raider handed over is still the raid\'s: the heir takes it tagged, and it rides the heir\'s frame named (mutants: the tag dropped at the adopt)', async () => {
  const owner = pool('aaa-0001'), heir = pool('mmm-0002');
  const f = await owner.spawnFoe(0, [100, 0, 100], { feetGiven: true, loose: true, transient: true });
  f.raidKey = KEY;
  heir.applyFoes('aaa-0001', owner.foesFrame(true));
  for (let i = 0; i < 5; i++) await settle();
  heir.applyFoes('aaa-0001', owner.handOverFrame(() => 'mmm-0002'));
  for (let i = 0; i < 5; i++) await settle();
  const mine = heir.foes.filter((x) => !x.puppet && !x.dead);
  assert.equal(mine.length, 1, 'taken over');
  assert.equal(mine[0].raidKey, KEY);
  assert.equal(mine[0]._pupRaid, null);
  assert.deepEqual(heir.foesFrame(true).rz.map(([, k]) => k), [KEY]);
});

test('RAID2 the lane and the lock: the raids\' switch is the room\'s online, forced on - with a world event\'s own words', () => {
  assert.deepEqual({ ...ONLINE_ROOM_MOD_KEYS[RAIDING_PARTIES_VENDOR] }, { Enabled: true });
  assert.ok(!ONLINE_PLAYERS_OWN_MODS.includes(RAIDING_PARTIES_VENDOR));
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /const ONLINE_WORLD_EVENT_NOTE = 'On for everyone online: a raid is shared[^']*';/);
});

test('RAID2 the world host by source: my word rides my cell frame, a peer\'s reaches the raids through the pool\'s room test, and the seams answer who I am, who stands in the town (the watch\'s own rect), the raid\'s puppets and my taken raiders on the net\'s clock', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(cell\) duelRingWord\(frame, full\); if \(cell\) csaWord\(frame, full\);( if \(cell\) csaAboardWord\(frame, full\);)?(?: if \(cell\) bandWord\(frame, full\);)?( if \(cell\) navalWord\(frame, full\);)?(?: if \(cell\) seaRaidWord\(frame, full\);)? if \(cell\) \{ const rk = raidWireWord\(\); if \(rk\) frame\.rk = rk; \}[^\n]*\n\s+if \(!online\.sendFoes\(frame\)\)/, 'on the riders\' own line, beside the camps, the horse, the ring and (THE MERGE) the boats - and (THE MERGE with NAV-G) the sea\'s word before it, and (OW6) the raiders\' after it');
  assert.match(w, /exteriorFoes\.setOnRaids\(\(from, rk, at\) => raidPeerWord\(from, rk, at\)\);/);
  const at = w.indexOf('  setRaidingPartiesHost({');
  const body = w.slice(at, w.indexOf('\n  });', at));
  assert.match(body, /selfId: \(\) => online\?\.id \?\? null,/);
  assert.match(body, /wallNow: \(\) => performance\.now\(\),/, 'the clock the pool hands the word on');
  assert.match(w, /now: \(\) => performance\.now\(\),\n\s+staleMs: FOES_STALE_MS,/, 'which is the net\'s own');
  assert.match(body, /peersInTown: \(\) => \(peersNear\(\) \?\? \[\]\)\.filter\(\(p\) => _foeInTownRect\(\{ ai: \{ feet: p\.feet \} \}\)\)\.map\(\(p\) => p\.id\),/);
  assert.match(body, /raidPuppets: \(\) => exteriorFoes\.foes\.filter\(\(f\) => f\.puppet && f\._pupRaid && !f\.dead\),/);
  assert.match(body, /ownRaidFoes: \(\) => exteriorFoes\.foes\.filter\(\(f\) => !f\.puppet && f\.raidKey && !f\.dead\),/);
  const pool = rd('src/scenes/exteriorFoes.js');
  assert.match(pool, /if \(data\.rk !== undefined\) _onRaids\?\.\(from, data\.rk, _now\(\)\);/);
  assert.doesNotMatch(rd('server/src/index.js'), /\brz\b|\brk\b|\bal\b/, 'the relay reads nothing inside a foes frame - no relay change');
  assert.doesNotMatch(rd('src/net/wire.js'), /RAID2|raidKey/, 'nor does the record\'s law change');
});
