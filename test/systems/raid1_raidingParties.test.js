// RAID1 (2026-09-27, Mac: "World event mod was specially built for us"; "5. Yes" - port it offline with its bugs
// fixed; "6. Kamer made this for us") - WORLD EVENTS - RAIDING PARTIES 1.1 (Kamer).
//
// Held here: the vendored files (the manifest, the assembly, and the IL every cited number is read off); the day's
// roll (the regions the picker names, the towns, the draw order, the pace Mac chose, the day's own generator); the
// party's species; the lines; Update driven through a recording host - the announcement once and never at sea, the
// "withdrawn" only of a raid told, a defender before a raider, the caps, one foe in flight and the lapse's back-off, a
// miss that costs nothing, a pause that holds the clocks; the deaths counted once, the cleanse, the reward for a player
// who fought on the pixel, the leftovers taken out of sight; GrantReputation line by line; the save record; and the
// world host's wiring, pinned where DFU's GameManager would answer.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  RAIDING_PARTIES_VENDOR, raidingPartiesOn, RAID_DURATION_MINUTES, RAID_START_SPAN, MOD_DAILY_RAIDS, RAID_KILLS_MIN,
  RAID_KILLS_MAX_EXCLUSIVE, MAX_RAID_ENEMIES, MAX_RAID_DEFENDERS, SPAWN_INTERVAL_MAX_S, ORC_SPAWN_INTERVAL_MAX_S,
  PENDING_TIMEOUT_S, PENDING_BACKOFF_S, ACTOR_SWEEP_S, RAID_SPAWN_MIN_DISTANCE, RAID_SPAWN_MAX_DISTANCE, RAID_TOWN_TYPES,
  RAID_REGION_REAL_HOURS, raidsPerDay, raidTypeName, raidTypeAdjective, attackLine, withdrawnLine, cleansedLine,
  chooseRaider, raidRegions, rollRaids, raidsForDay, raidKey, raidActive, grantRaidReputation, outOfSight,
  newRaidSaveData as newSaveData, getRaidSaveData as getSaveData, restoreRaidSaveData as restoreSaveData, raidState, setRaidingPartiesHost, raidFrame as frame, raidDefendingHere,
  installRaidingParties, _resetRaidingParties, _raidRuntime,
} from '../../src/systems/raidingParties.js';
import { dayRng, DAY_SALT, setSharedClock } from '../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { FACTION_TYPES, GUILD_GROUPS } from '../../src/formats/factionFile.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { renownFoeStruck, _resetRenownKillsForTests } from '../../src/net/renownTracker.js';
import { modSaveRecords, restoreModSaveRecords, _resetModSaveData } from '../../src/systems/modSaveData.js';
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { ONLINE_ROOM_MOD_KEYS, ONLINE_PLAYERS_OWN_MODS } from '../../src/systems/online/onlineLane.js';
import { FEATURES } from '../../src/systems/features.js';
import { CREDITS } from '../../src/ui/credits.js';
import { travelMapPickerData, _setTravelMapArtForTests } from '../../src/ui/travel/travelMapWindow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VENDOR = join(ROOT, 'vendor/world-events-raiding-parties');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const tick = () => new Promise((r) => setImmediate(r));

const DAY = 400;
const AT = (min) => DAY * MINUTES_PER_DAY + min;
/** A raid as the save carries it. */
const raidRec = (o = {}) => ({
  regionIndex: 3, locationIndex: 7, startDay: DAY, locationName: 'Gothway Garden', type: 2,
  startMinute: AT(600), endMinute: AT(720), killed: 0, attackAmount: 3, cleansed: false,
  announced: false, struck: false, px: 200, py: 100, ...o,
});

/** A recording host: every seam the mod reaches for, answering as the test sets `h.at`, logging what it was asked. */
function rig() {
  // roll 0: every clock the restore starts is its minimum, one second
  const at = { now: AT(610), region: 3, town: { regionIndex: 3, locationIndex: 7 }, pixel: { x: 200, y: 100 }, roll: 0, allowed: true, unseen: true, raiderSpot: true, hold: false };
  const log = { said: [], raiders: [], defenders: [], removed: [], threats: [] };
  const player = { legalRep: {} };
  const store = { dict: new Map() };
  let seq = 0;
  const foe = (mobileType) => ({ mobileType, dead: false, corpse: false, entity: { health: 10 }, ai: { feet: [seq, 0, 0] }, uid: ++seq });
  const pending = [];
  const h = {
    now: () => at.now,
    random: () => at.roll,
    regionIndex: () => at.region,
    regionName: (r) => `Region${r}`,
    townHere: () => at.town,
    playerPixel: () => at.pixel,
    standRaider: (mt) => {
      if (!at.raiderSpot) return null;
      const f = foe(mt); log.raiders.push(f);
      if (at.hold) return new Promise((res) => pending.push(() => res(f)));
      return Promise.resolve(f);
    },
    standDefender: (threats) => { log.threats.push(threats); const g = foe(146); g.defender = true; log.defenders.push(g); return Promise.resolve(g); },
    defenderCount: () => log.defenders.filter((g) => !g.dead).length,
    defendersAllowed: () => at.allowed,
    removeFoe: (f) => { f.dead = true; log.removed.push(f); },
    outOfSight: () => at.unseen,
    reputation: () => ({ player, store }),
    say: (line) => log.said.push(line),
  };
  setRaidingPartiesHost(h);
  return { at, log, player, store, h, release: () => pending.splice(0).forEach((f) => f()) };
}

beforeEach(() => {
  _resetRaidingParties();
  _resetRenownKillsForTests();
  _resetModSettings();
  setSharedClock(null);
});

test('RAID1 vendored: the manifest verbatim, the assembly byte for byte, and every number the port cites standing in the IL at its offset', () => {
  const manifest = readFileSync(join(VENDOR, 'world-events-raiding-parties.dfmod.json'));
  assert.equal(sha(manifest), '43397dc95f48b6287f608016072135bb6c85e0deb972ad4d3612346608d904e1');
  const m = JSON.parse(manifest.toString('utf8'));
  assert.equal(m.ModTitle, 'World Events - Raiding Parties');
  assert.equal(m.ModVersion, '1.1');
  assert.equal(m.ModAuthor, 'Kamer');
  assert.equal(m.GUID, '0c4a7cde-e3bd-4060-a371-6910a8625eac');
  assert.equal(sha(readFileSync(join(VENDOR, 'World Events - Raiding Parties.dll'))), '11e17af74119a2f013a3f1f850a0eb4fbb6fc53f2a0cc8769d9a47be4077719e');
  const il = readFileSync(join(VENDOR, 'il/World_Events_Raiding_Parties.il.txt'), 'utf8');
  const at = (off, text) => assert.match(il, new RegExp(`${off}: +${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${off} ${text}`);
  at('IL_0dc5', 'ldc.i4.s       23');
  assert.equal(MOD_DAILY_RAIDS, 23);
  at('IL_0d3b', 'ldc.i4         1321');
  assert.equal(RAID_START_SPAN, 1321);
  at('IL_0da1', 'ldc.i4.s       120');
  assert.equal(RAID_DURATION_MINUTES, 120);
  at('IL_0730', 'ldc.i4.s       25');
  assert.equal(MAX_RAID_ENEMIES, 25);
  at('IL_06fa', 'ldc.i4.8');
  assert.equal(MAX_RAID_DEFENDERS, 8);
  at('IL_069f', 'ldc.r4         8.0');
  assert.equal(PENDING_TIMEOUT_S, 8);
  at('IL_06b2', 'ldc.r4         10.0');
  assert.equal(PENDING_BACKOFF_S, 10);
  at('IL_0471', 'ldc.r4         3.0');
  assert.equal(ACTOR_SWEEP_S, 3);
  at('IL_07f0', 'ldc.r4         10.0');
  at('IL_07f5', 'ldc.r4         35.0');
  assert.deepEqual([RAID_SPAWN_MIN_DISTANCE, RAID_SPAWN_MAX_DISTANCE], [10, 35]);
  at('IL_0833', 'ldc.r4         8.0');
  assert.deepEqual([SPAWN_INTERVAL_MAX_S, ORC_SPAWN_INTERVAL_MAX_S], [10, 8]);
  at('IL_0f40', 'call           DaggerfallWorkshop.Game.DaggerfallUI::AddHUDText');
  at('IL_0fd7', 'call           DaggerfallWorkshop.Game.DaggerfallUI::AddHUDText');
  at('IL_1179', 'call           DaggerfallWorkshop.Game.DaggerfallUI::AddHUDText');
  at('IL_04b5', 'call           DaggerfallWorkshop.Game.DaggerfallUI::GetImgBitmap');
  for (const s of ['" is under attack by "', '"The attackers have withdrawn from "', '" has been cleansed of the "', '" attack!"', '"TRAV0I01.IMG"']) assert.ok(il.includes(s), s);
  assert.deepEqual([RAID_KILLS_MIN, RAID_KILLS_MAX_EXCLUSIVE], [15, 26]);
  const readme = read('vendor/world-events-raiding-parties/README.md');
  assert.match(readme, /\*\*Permission: granted by the author, who made the mod for this port -\nMac, 2026-09-27: "Kamer made this for us\."\*\*/);
  assert.doesNotMatch(readme, /\[Mac: (?:paste|record)/, 'the record is filled, not a prompt');
});

test('RAID1 the region list: the picker\'s regions only, in index order, each with its raidable towns in MapTable order - the game\'s own rows (mutants: a byte not in range kept; the type set widened; the base count ignored; the order reversed)', () => {
  const row = (locationType, x, y) => ({ locationType, longitude: x * 128, latitude: (499 - y) * 128 });
  const regions = {
    2: { mapNames: ['Farm', 'Dun', 'Hamlet'], mapTable: [row(LOCATION_TYPES.HomeFarms, 1, 1), row(LOCATION_TYPES.DungeonKeep, 2, 2), row(LOCATION_TYPES.TownHamlet, 3, 3)] },
    5: { mapNames: ['City', 'Village', 'ModTown'], mapTable: [row(LOCATION_TYPES.TownCity, 10, 20), row(LOCATION_TYPES.TownVillage, 11, 21), row(LOCATION_TYPES.TownCity, 12, 22)], base: 2 },
    9: { mapNames: ['Temple'], mapTable: [row(LOCATION_TYPES.ReligionTemple, 4, 4)] },
    12: { mapNames: ['Unmapped'], mapTable: [row(LOCATION_TYPES.TownCity, 5, 5)] },
  };
  const maps = { regionCount: 62, getRegion: (r) => regions[r] ?? null, baseLocationCount: (r) => regions[r]?.base ?? regions[r]?.mapTable.length ?? 0 };
  const picker = Uint8Array.from([0, 64, 128 + 5, 128 + 2, 128 + 9, 128 + 5, 255, 128 + 62]);
  const list = raidRegions(maps, picker);
  assert.deepEqual(list.map((g) => g.region), [2, 5], 'region 12 is not on the picker; 9 has no town; 62 and 127 are out of range');
  assert.deepEqual(list[0].towns.map((t) => [t.index, t.name, t.px, t.py]), [[2, 'Hamlet', 3, 3]]);
  assert.deepEqual(list[1].towns.map((t) => t.index), [0, 1], 'the third row is a world-data mod\'s, past the base count');
  assert.deepEqual([...RAID_TOWN_TYPES], [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownVillage, LOCATION_TYPES.TownHamlet]);
  assert.equal(raidRegions(maps, null), null, 'no picker, no list [IL_04b5]');
  assert.equal(raidRegions(null, picker), null);
});

test('RAID1 the roll: a region evenly, a town in it struck off, a start in 0-1320, a party, two hours, 15-25 - in the IL\'s draw order (mutants: the town not struck off; an emptied region kept; the span, the length or the target off by one; the draws reordered)', () => {
  const town = (index, name) => ({ index, name, px: index, py: 0 });
  const regions = [{ region: 4, towns: [town(0, 'A'), town(1, 'B')] }, { region: 9, towns: [town(5, 'C')] }];
  const draws = [0.99, 0.0, 0.99999, 0.5, 0.999,   // raid 1: region 9 (i=1), its only town, start 1320, bandits, the target 25
    0.0, 0.99, 0.0, 0.0, 0.0,                    // raid 2: region 4 (i=0), town B (j=1), start 0, knights, 15
    0.0, 0.0, 0.5, 0.4, 0.5];                    // raid 3: region 4, town A, start 660, bandits, 20
  let k = 0;
  const raids = rollRaids(DAY, regions, 5, () => draws[k++]);
  assert.equal(raids.length, 3, 'three towns in all: the roll stops when every list is empty');
  assert.equal(k, 15, 'five draws a raid');
  assert.deepEqual(raids.map((r) => [r.regionIndex, r.locationIndex, r.locationName, r.startMinute - AT(0), r.type, r.attackAmount]),
    [[9, 5, 'C', 1320, 1, 25], [4, 1, 'B', 0, 0, 15], [4, 0, 'A', 660, 1, 20]]);
  for (const r of raids) {
    assert.equal(r.endMinute - r.startMinute, 120);
    assert.equal(r.startDay, DAY);
    assert.deepEqual([r.killed, r.cleansed, r.announced, r.struck], [0, false, false, false]);
  }
  assert.equal(raids[1].px, 1, 'the town\'s pixel rides with it, for the reward\'s test');
  assert.equal(regions[0].towns.length, 2, 'the caller\'s list is not spent');
});

test('RAID1 fix 1 and Mac\'s "4": the day\'s raids are the day\'s - its own generator and salt - and a region is raided about every four real hours (mutants: Math.random; another salt; the pace\'s constant)', () => {
  const regions = Array.from({ length: 44 }, (_, r) => ({ region: r, towns: [{ index: 0, name: `T${r}`, px: r, py: r }, { index: 1, name: `U${r}`, px: r, py: r + 1 }] }));
  assert.equal(RAID_REGION_REAL_HOURS, 4);
  assert.equal(raidsPerDay(44), 22, '44 regions, a day of two real hours: 22 raids - the mod\'s 23 was 3.8 hours');
  assert.equal(raidsPerDay(43), 22, 'half up');
  assert.equal(raidsPerDay(10), 5);
  assert.equal(raidsPerDay(0), 0);
  const a = raidsForDay(DAY, regions), b = raidsForDay(DAY, regions), c = raidsForDay(DAY + 1, regions);
  assert.equal(a.length, 22);
  assert.deepEqual(a, b, 'the same day rolls the same raids - a reload, or another player');
  assert.notDeepEqual(a.map(raidKey), c.map(raidKey), 'the next day is another roll');
  const g = dayRng(DAY * MINUTES_PER_DAY, DAY_SALT.raids);
  assert.deepEqual(a, rollRaids(DAY, regions, 22, g), 'the roll is the day\'s generator, salted for the raids');
  assert.equal(DAY_SALT.raids, 5);
  assert.equal(new Set(Object.values(DAY_SALT)).size, Object.keys(DAY_SALT).length, 'every consumer its own salt');
});

test('RAID1 ChooseEnemy: knights are Knights; bandits Rogue <50, Thief <80, Burglar; orcs Orc <70, Sergeant <95, Warlord - and any other party is orcs (mutants: each threshold off by one)', () => {
  const pick = (type, roll) => chooseRaider(type, () => roll / 100);
  assert.equal(pick(0, 99), MOBILE_TYPES.Knight);
  assert.deepEqual([pick(1, 0), pick(1, 49), pick(1, 50), pick(1, 79), pick(1, 80), pick(1, 99)],
    [MOBILE_TYPES.Rogue, MOBILE_TYPES.Rogue, MOBILE_TYPES.Thief, MOBILE_TYPES.Thief, MOBILE_TYPES.Burglar, MOBILE_TYPES.Burglar]);
  assert.deepEqual([pick(2, 0), pick(2, 69), pick(2, 70), pick(2, 94), pick(2, 95), pick(2, 99)],
    [MOBILE_TYPES.Orc, MOBILE_TYPES.Orc, MOBILE_TYPES.OrcSergeant, MOBILE_TYPES.OrcSergeant, MOBILE_TYPES.OrcWarlord, MOBILE_TYPES.OrcWarlord]);
  assert.equal(pick(7, 96), MOBILE_TYPES.OrcWarlord, 'RaidTypeName\'s default arm');
  assert.deepEqual([raidTypeName(0), raidTypeName(1), raidTypeName(2), raidTypeName(9)], ['knights', 'bandits', 'orcs', 'orcs']);
});

test('RAID1 the lines: verbatim - but for fix 11, "the orc attack"', () => {
  assert.equal(attackLine('Gothway Garden', 'Daggerfall', 2), 'Gothway Garden in Daggerfall is under attack by orcs!');
  assert.equal(withdrawnLine('Gothway Garden', 'Daggerfall'), 'The attackers have withdrawn from Gothway Garden in Daggerfall.');
  assert.equal(cleansedLine('Gothway Garden', 'Daggerfall', 2), 'Gothway Garden in Daggerfall has been cleansed of the orc attack!');
  assert.deepEqual([raidTypeAdjective(0), raidTypeAdjective(1), raidTypeAdjective(5)], ['knight', 'bandit', 'orc']);
});

test('RAID1 Update, the gates: off, and before the picker is at hand, nothing runs - not even the roll (online: test/systems/raid2_raidsOnline.test.js)', () => {
  const { at, log } = rig();
  setModSetting(RAIDING_PARTIES_VENDOR, 'Enabled', false);
  assert.equal(raidingPartiesOn(), false);
  assert.equal(frame(1), null);
  setModSetting(RAIDING_PARTIES_VENDOR, 'Enabled', true);
  assert.equal(frame(1), null, 'no picker: SelectRaids never ran');
  assert.equal(raidState().lastSelectedDay, -1);
  assert.deepEqual(log.said, []);
});

test('RAID1 Update, the day\'s roll and fixes 2, 3, 8, 9: the day rolls once; a raid on in the region is announced once, and again never - not after a load, not at sea; "withdrawn" only of a raid told, and the midnight raid gets its own (mutants: withdrawn untold; the announcement repeated; the sea announced; the old day thrown away first)', () => {
  const { at, log, h } = rig();
  // one region on the picker, one town in it - the eighth row of its table, the seven before it no town
  const names = Array(8).fill('Graveyard');
  names[7] = 'Gothway Garden';
  const table = [...Array(7).fill({ locationType: LOCATION_TYPES.Graveyard }), { locationType: LOCATION_TYPES.TownCity, longitude: 200 * 128, latitude: (499 - 100) * 128 }];
  h.maps = () => ({ regionCount: 62, getRegion: (r) => (r === 3 ? { mapNames: names, mapTable: table } : null) });
  h.picker = () => Uint8Array.from([128 + 3]);
  at.now = AT(0);
  at.region = -1;   // at sea
  at.town = null;
  assert.equal(frame(0.1), 'idle');
  const listed = raidState().raids;
  assert.equal(raidState().lastSelectedDay, DAY);
  assert.equal(listed.length, 1, 'one region: half a raid a day, rounded up');
  const r = listed[0];
  assert.deepEqual([r.regionIndex, r.locationIndex, r.locationName, r.px, r.py], [3, 7, 'Gothway Garden', 200, 100]);
  at.now = r.startMinute;
  frame(0.1);
  assert.deepEqual(log.said, [], 'fix 8: at sea nothing is announced');
  at.region = 3;
  frame(0.1);
  assert.deepEqual(log.said, [attackLine('Gothway Garden', 'Region3', r.type)], 'the region hears of it');
  frame(0.1);
  assert.equal(log.said.length, 1, 'once');
  // a load: the announcement is the raid's own, saved (fix 3)
  const saved = getSaveData();
  restoreSaveData(saved);
  frame(0.1);
  assert.equal(log.said.length, 1, 'not again after a load');
  // the raid runs out at the day's end - the next day's first frame expires it BEFORE the roll throws it away (fix 9)
  raidState().raids[0].endMinute = AT(MINUTES_PER_DAY);
  at.now = AT(MINUTES_PER_DAY);
  frame(0.1);
  assert.equal(log.said[1], withdrawnLine(r.locationName, 'Region3'), 'the midnight raid is withdrawn');
  assert.equal(raidState().lastSelectedDay, DAY + 1);
  // a raid never told of is withdrawn in silence (fix 2)
  const n = log.said.length;
  restoreSaveData({ lastSelectedDay: DAY + 1, raids: [raidRec({ startDay: DAY + 1, startMinute: AT(MINUTES_PER_DAY + 10), endMinute: AT(MINUTES_PER_DAY + 130) })] });
  at.now = AT(MINUTES_PER_DAY + 200);
  frame(0.1);
  assert.equal(log.said.length, n, 'untold, unsaid');
  assert.equal(raidState().raids.length, 0, 'and gone from the list');
});

test('RAID1 Update, standing a raid: a defender first, then a raider; the clocks reschedule even at a cap; one foe in flight (mutants: the defender second; the cap tests off by one; a second foe in flight; the clocks not rescheduled)', async () => {
  const { at, log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec()] });
  at.roll = 0;   // every clock the minimum, 1 s
  at.town = { regionIndex: 3, locationIndex: 8 };
  assert.equal(frame(1), 'idle', 'another town of the region, both clocks due: no raid here');
  at.town = { regionIndex: 4, locationIndex: 7 };
  assert.equal(frame(1), 'idle', 'the same index in another region: no raid here');
  at.town = { regionIndex: 3, locationIndex: 7 };
  assert.equal(frame(1), 'defender', 'both clocks due: the defender first');
  assert.equal(frame(0), 'waiting', 'one foe in flight');
  await tick();
  assert.equal(frame(0), 'raider', 'the raider\'s clock was due too');
  await tick();
  assert.equal(log.raiders[0].mobileType, MOBILE_TYPES.Orc, 'an orc raid, roll 0: an Orc');
  assert.equal(log.threats[0].length, 0, 'the first defender came before any raider');
  // the defenders' cap: eight standing (the watch's own among them) and no ninth
  while (log.defenders.length < MAX_RAID_DEFENDERS) { frame(1); await tick(); }
  assert.equal(log.defenders.length, MAX_RAID_DEFENDERS);
  for (let i = 0; i < 6; i++) { frame(1); await tick(); }
  assert.equal(log.defenders.length, MAX_RAID_DEFENDERS, 'eight, and no more');
  assert.ok(log.threats.at(-1).length >= 1, 'a later defender is sent at a raider');
  // the raiders' cap
  while (log.raiders.filter((f) => !f.dead).length < MAX_RAID_ENEMIES) { frame(1); await tick(); }
  const before = log.raiders.length;
  for (let i = 0; i < 6; i++) { frame(1); await tick(); }
  assert.equal(log.raiders.length, before, 'twenty-five standing, and no more');
  assert.ok(_raidRuntime().nextSpawnIn > 0, 'the clock was rescheduled at the cap');
  log.raiders[0].entity.health = 0;
  frame(1); await tick();
  assert.equal(log.raiders.length, before + 1, 'one fallen (health 0 is not standing): one more');
});

test('RAID1 Update, the clocks: an orc raid\'s raider comes every 1-8 s, any other every 1-10, defenders 1-10; a pause holds them (fix 7) (mutants: 8 for every party; the pause spends time)', async () => {
  const { at } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ type: 2 })] });
  at.roll = 1;   // the maximum
  at.allowed = false;   // no defenders: watch the raider clock alone
  frame(20); await tick();
  assert.equal(_raidRuntime().nextSpawnIn, ORC_SPAWN_INTERVAL_MAX_S);
  assert.equal(_raidRuntime().nextDefenderIn, SPAWN_INTERVAL_MAX_S, 'the defender clock rescheduled though none came');
  frame(0); frame(0); frame(0);
  assert.equal(_raidRuntime().nextSpawnIn, ORC_SPAWN_INTERVAL_MAX_S, 'a paused frame spends nothing');
  _resetRaidingParties();
  const r2 = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ type: 0 })] });
  r2.at.roll = 1; r2.at.allowed = false;
  frame(20); await tick();
  assert.equal(_raidRuntime().nextSpawnIn, SPAWN_INTERVAL_MAX_S, 'knights: ten');
});

test('RAID1 Update, a spawn in flight: it lapses after eight seconds and both clocks wait ten; a spot not found costs nothing (fix 10); leaving the town cancels it, and what lands after is taken back (mutants: no lapse; the back-off on a miss; the cancel ignored)', async () => {
  const { at, log, release } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec()] });
  at.roll = 0; at.allowed = false; at.hold = true;
  assert.equal(frame(1), 'raider');
  assert.equal(frame(PENDING_TIMEOUT_S), 'waiting', 'eight seconds: still waiting');
  assert.equal(frame(0.5), 'waiting', 'past eight: the spawn lapses');
  assert.equal(_raidRuntime().pending, null);
  assert.equal(_raidRuntime().nextSpawnIn, PENDING_BACKOFF_S);
  assert.equal(_raidRuntime().nextDefenderIn, PENDING_BACKOFF_S);
  release(); await tick();
  assert.equal(log.removed.length, 1, 'the lapsed spawn landed into nothing - taken back');
  // a miss
  at.hold = false; at.raiderSpot = false;
  frame(PENDING_BACKOFF_S + 1);
  await tick();
  assert.equal(_raidRuntime().pending, null);
  assert.equal(_raidRuntime().nextSpawnIn, 1, 'no spot: the clock\'s own next tick (roll 0: one second), no ten-second wait');
  assert.equal(_raidRuntime().nextDefenderIn, 1, 'and the defenders\' clock its own');
  // the player leaves mid-spawn
  at.raiderSpot = true; at.hold = true;
  frame(20);
  assert.ok(_raidRuntime().pending);
  at.town = null;
  assert.equal(frame(0.1), 'idle');
  assert.equal(_raidRuntime().pending, null, 'FindCurrentRaid failed: CancelPending');
  release(); await tick();
  assert.equal(log.removed.length, 2, 'the raider that landed after is taken back');
});

test('RAID1 the deaths, the cleanse and the reward (fix 5): a raider\'s death counts once; a removed one never; the target cleanses; the reward is for a player who fought, on the pixel (mutants: a removal counted; a death counted twice; the pixel alone paid; the fight alone paid)', async () => {
  const { at, log, player, store } = rig();
  store.dict.set(41, { id: 41, rep: 0, region: -1, ggroup: GUILD_GROUPS.FightersGuild, type: 2 });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ attackAmount: 2, announced: true })] });
  at.roll = 0; at.allowed = false;
  for (let i = 0; i < 3; i++) { frame(1); await tick(); }
  const [a, b, c] = log.raiders;
  assert.ok(a && b && c);
  a.dead = true;   // removed: no corpse
  frame(0);
  assert.equal(raidState().raids[0].killed, 0, 'a removal is not a death');
  b.dead = true; b.corpse = true;
  frame(0); frame(0);
  assert.equal(raidState().raids[0].killed, 1, 'once');
  c.dead = true; c.corpse = true;
  frame(0);
  const raid = raidState().raids[0];
  assert.equal(raid.cleansed, true);
  assert.equal(log.said.at(-1), cleansedLine('Gothway Garden', 'Region3', 2));
  assert.equal(player.legalRep[3], undefined, 'no blow of the player\'s: the pixel alone pays nothing');
  assert.equal(raidDefendingHere(), false, 'a cleansed town calls no defenders');
  // the same raid again, the player having fought - on the pixel, then off it
  const fought = async (pixel) => {
    _resetRaidingParties(); _resetRenownKillsForTests();
    const r = rig(); r.at.pixel = pixel;
    restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ attackAmount: 1 })] });
    r.at.roll = 0; r.at.allowed = false;
    frame(1); await tick();
    renownFoeStruck(r.log.raiders[0]);
    frame(0);
    assert.equal(raidState().raids[0].struck, true, 'a blow marks the raid fought');
    r.log.raiders[0].dead = true; r.log.raiders[0].corpse = true;
    frame(0);
    return r.player;
  };
  assert.equal((await fought({ x: 200, y: 100 })).legalRep[3], 5, 'fought, on the pixel: paid');
  assert.equal((await fought({ x: 201, y: 100 })).legalRep[3], undefined, 'fought, off the pixel: the mod\'s own test');
});

test('RAID1 fix 6: an ended raid\'s raiders fight on while seen and go at the first sweep out of sight; they count nothing (mutants: taken in view; never taken; still counting)', async () => {
  const { at, log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ attackAmount: 1 })] });
  at.roll = 0; at.allowed = false;
  for (let i = 0; i < 3; i++) { frame(1); await tick(); }
  const [a, b] = log.raiders;
  frame(ACTOR_SWEEP_S);
  assert.equal(b.dead, false, 'a raid still on: its raiders are not routed, seen or not');
  a.dead = true; a.corpse = true;
  at.unseen = false;
  frame(0);
  assert.equal(raidState().raids[0].cleansed, true);
  frame(ACTOR_SWEEP_S);
  assert.equal(b.dead, false, 'in view: it fights on');
  at.unseen = true;
  frame(ACTOR_SWEEP_S);
  assert.equal(b.dead, true, 'out of sight: gone at the sweep');
  assert.ok(log.removed.includes(b));
  assert.equal(raidState().raids[0].killed, 1, 'a routed raider taken is not a kill');
});

test('RAID1 outOfSight: the view\'s cone and its margin, the port\'s yaw; indoors nothing is seen', () => {
  const eye = [0, 0, 0];
  assert.equal(outOfSight([0, 0, 10], eye, 0, 90), false, 'straight ahead');
  assert.equal(outOfSight([10, 0, 10], eye, 0, 90), false, '45 degrees: the edge');
  assert.equal(outOfSight([10, 0, 8], eye, 0, 90), false, 'past the edge (51 degrees), inside the margin');
  assert.equal(outOfSight([10, 0, 6], eye, 0, 90), true, 'past the margin (59 degrees)');
  assert.equal(outOfSight([10, 0, 0], eye, 0, 90), true, '90 degrees: out');
  assert.equal(outOfSight([0, 0, -10], eye, 0, 90), true, 'behind');
  assert.equal(outOfSight([10, 0, 0], eye, Math.PI / 2, 90), false, 'the port\'s yaw: forward is [sin, 0, cos]');
  assert.equal(outOfSight([0, 0, 10], eye, 0, 90, false), true, 'indoors');
});

test('RAID1 GrantReputation: legal +5 to 100 at most; the region\'s own People +5 (the region-less fallback refused); the FIRST knightly order of the region +3; the Fighters Guild +3 - none of it propagating (mutants: the clamp dropped; the fallback taken; every order paid; propagation on)', () => {
  const f = (id, o) => [id, { id, rep: 0, region: -1, type: 0, ggroup: 0, parent: 0, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, ...o }];
  const store = { dict: new Map([
    f(500, { type: FACTION_TYPES.People, region: -1 }),
    f(518, { type: FACTION_TYPES.People, region: 17, ally1: 500 }),
    f(999, { region: 17, ggroup: GUILD_GROUPS.KnightlyOrder }),   // group 9, but no order of KnightlyOrder.Orders - passed over
    f(409, { region: 17, ggroup: GUILD_GROUPS.KnightlyOrder }),
    f(415, { region: 17, ggroup: GUILD_GROUPS.KnightlyOrder }),
    f(41, { ggroup: GUILD_GROUPS.FightersGuild, ally1: 518 }),
  ]) };
  const player = { legalRep: { 17: 98 } };
  assert.equal(grantRaidReputation({ player, store }, 17), true);
  assert.equal(player.legalRep[17], 100, 'clamped');
  const rep = (id) => store.dict.get(id).rep;
  assert.equal(rep(518), 5 + 0, 'the region\'s People');
  assert.equal(rep(500), 0, 'nothing propagates to an ally');
  assert.deepEqual([rep(409), rep(415), rep(999)], [3, 0, 0], 'the first order in the dictionary, and a group-9 faction that is no order is not one');
  assert.equal(rep(41), 3, 'the Fighters Guild, member or not');
  const lone = { dict: new Map([f(500, { type: FACTION_TYPES.People, region: -1 }), f(41, {})]) };
  const p2 = {};
  grantRaidReputation({ player: p2, store: lone }, 20);
  assert.equal(lone.dict.get(500).rep, 0, 'DFU\'s region-less match is refused');
  assert.equal(p2.legalRep[20], 5);
  player.legalRep[17] = -100;
  grantRaidReputation({ player, store }, 17);
  assert.equal(player.legalRep[17], -95);
  assert.equal(grantRaidReputation(null, 17), false);
});

test('RAID1 the save record: RaidSaveData\'s own fields and the port\'s two; a raid not whole is dropped; a target of 0 re-rolled as the mod does; the slot registers once, and a new game starts it fresh (mutants: a field unsaved; a broken raid kept)', () => {
  assert.deepEqual(newSaveData(), { lastSelectedDay: -1, raids: [] });
  rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ killed: 2, struck: true, announced: true, cleansed: true }), { regionIndex: 'x' }, raidRec({ endMinute: AT(600) }), raidRec({ attackAmount: 0, locationIndex: 9 })] });
  const s = getSaveData();
  assert.equal(s.lastSelectedDay, DAY);
  assert.equal(s.raids.length, 2, 'the malformed and the zero-length are dropped');
  assert.deepEqual(s.raids[0], raidRec({ killed: 2, struck: true, announced: true, cleansed: true }));
  assert.ok(s.raids[1].attackAmount >= 15 && s.raids[1].attackAmount <= 25, 'Random.Range(15, 26) [IL_035d]');
  _resetModSaveData();
  assert.equal(installRaidingParties(), true);
  assert.equal(installRaidingParties(), false, 'once');
  assert.deepEqual(modSaveRecords()[RAIDING_PARTIES_VENDOR], s);
  restoreModSaveRecords({});
  assert.deepEqual(getSaveData(), newSaveData(), 'a save without the record: NewSaveData');
});

test('RAID1 the lane, the row, the credit: the switch on by default, the room\'s online (RAID2); a world row; Kamer credited with the permission record', () => {
  const mod = MOD_SETTINGS[RAIDING_PARTIES_VENDOR];
  assert.equal(mod.author, 'Kamer');
  assert.equal(mod.keys.Enabled.default, true);
  assert.deepEqual(Object.keys(mod.keys), ['Enabled'], 'no modsettings of its own');
  assert.ok(!ONLINE_PLAYERS_OWN_MODS.includes(RAIDING_PARTIES_VENDOR), 'RAID2: online the raids are the world\'s');
  assert.deepEqual({ ...ONLINE_ROOM_MOD_KEYS[RAIDING_PARTIES_VENDOR] }, { Enabled: true }, 'forced on, its own default');
  const row = FEATURES.find((f) => f.id === `mod-${RAIDING_PARTIES_VENDOR}`);
  assert.equal(row.group, 'world');
  assert.equal(row.title, 'World Events - Raiding Parties by Kamer');
  assert.equal(row.effect, 'Takes effect at once.');
  const credit = CREDITS.mods.find((m) => m.vendor.includes(RAIDING_PARTIES_VENDOR));
  assert.equal(credit.version, '1.1');
  assert.equal(credit.terms, 'Made by Kamer for this game, used with his permission, with some bugs fixed.');
});

test('RAID1 the picker\'s bytes: the travel map\'s own TRAV0I01 bitmap, null until its art has loaded (mutant: never at hand)', () => {
  _setTravelMapArtForTests(null);
  assert.equal(travelMapPickerData(), null);
  const data = Uint8Array.from([128 + 17]);
  _setTravelMapArtForTests({ pickerBitmap: { data } });
  assert.equal(travelMapPickerData(), data);
  _setTravelMapArtForTests(null);
});

test('RAID1 the world host by source: the seams answered where GameManager would - the street\'s pool, loose and transient, on the mod\'s band; the watch\'s defender; the sea refused; the street alone; both frames; the watch kept up for a raid', () => {
  const w = read('src/scenes/world.js');
  const at = w.indexOf('  setRaidingPartiesHost({');
  assert.ok(at > 0);
  const body = w.slice(at, w.indexOf('\n  });', at));
  assert.match(body, /spawn: \(mt, pos, o\) => exteriorFoes\.spawnFoe\(mt, pos, \{ yaw: o\.yawRad, loose: true, transient: true \}\)/);
  assert.match(body, /\}, mobileType, \{ minDistance: RAID_SPAWN_MIN_DISTANCE, maxDistance: RAID_SPAWN_MAX_DISTANCE \}\),/);
  assert.match(body, /standDefender: \(threats\) => cityGuards\.standDefender\(\{/);
  // PIN MOVED (AUDIT CAPTAIN'S SEA G7): nor the Eltheric Ocean, whose composed politic is the isles' region's
  assert.match(body, /regionIndex: \(\) => \{ const px = playerTravelPixel\(\); return !\(etherSea && inEther\(px\.x, px\.y\)\) && politicClaimed\(maps\.getPoliticIndex\(px\.x, px\.y\)\) \? _questRegionIndex\(\) : -1; \}/);
  assert.match(body, /townHere: \(\) => \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior' && _musicInLocationRect\(\) \? _questLoc\(\) : null\)/);
  assert.match(body, /picker: \(\) => travelMapPickerData\(\)/);
  assert.match(body, /defendersAllowed: \(\) => !playerEntity\.crimeCommitted && !isTransformedLycanthrope\(playerEntity\)/);
  assert.match(body, /reputation: \(\) => \(\{ player: playerEntity, store: _questStore\(\) \}\)/);
  assert.match(w, /if \(playerSpawned\) _townWatchFrame\(foeDt\);[^\n]*\n\s+if \(playerSpawned\) raidingPartiesFrame\(gamePaused\(\) \? 0 : foeDt\);/, 'the street\'s frame, after the pools and the watch');
  assert.match(w, /warmAshesFrame\(gamePaused\(\) \? 0 : dt \* worldTimeScale\(\)\);[^\n]*\n\s+raidingPartiesFrame\(gamePaused\(\) \? 0 : dt\);/, 'and indoors');
  assert.equal((w.match(/raidingPartiesFrame\(/g) ?? []).length, 2);
  assert.match(w, /enabled: \(getPref\('townWatch'\) !== false \|\| raidDefendingHere\(\)\) && !isTransformedLycanthrope\(playerEntity\),/);
  assert.match(read('src/scenes/shared.js'), /\n {2}installRaidingParties\(\);/);
  const g = read('src/scenes/cityGuards.js');
  const sd = g.slice(g.indexOf('  async function standDefender('), g.indexOf('\n  }', g.indexOf('  async function standDefender(')));
  assert.match(sd, /if \(!playerFeet \|\| where\?\.isPlayerInsideDungeon \|\| where\?\.isPlayerInside\) return null;/);
  assert.match(sd, /placeFoeFreely\(placing, \{ minDistance, maxDistance, lineOfSightCheck: true \}\)/);
  assert.match(sd, /\{ defender: true, threat: foe \}\);/);
  assert.match(g, /summonDefenders, standDefender, dismissDefenders/);
});
