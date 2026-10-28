// WW6 (2026-10-27, bible/03-World/World-Wide.md WW6 - the owner's call taken: "Every single thing here needs to be
// addressed. No exceptions."): THE RAIDS PAST THE BAY, AND A STAFF TOWN EVENT WITH THEM.
//
// Held here: the law (every region a key names, a province's town by its own index, the world's pixel in the tuple, the
// side of the Bay's edge, a lane a theatre and the open zone's shut); the Bay's lane to the byte against the old law
// written out (its generator, its roll, its slots, its records); a lane's parties pinned to its province's own fauna
// (TESA-BIOME's rosters); a lane's slots its roll's own; a lane's towns off the world's registry by area; the client's
// day with the lanes past the Bay - rolled for the Bay's day, kept by key and tuple, gone with the registry's places, told
// by AREA, stood by the town's own index, said to the relay on the world's grid, saved; the relay's ledger past the Bay
// (made, counted and cleansed in the town's cell, its receipt the province's key), a word on the wrong side or lane
// refused, the hub's pinned table the Bay's alone; the session's relay gate; a staff town event past the Bay (the law,
// the picker, the run); the boards' and the held map's rows past the Bay; the host's seams; and, with ARENA2, the same over
// the freeware's registry with TESA's places - every province's lane, a raid on a Skyrim town through the wire and the
// relay, and a staff event at Solitude.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  RAID_KEY_RE, RAID_SIG_RE, raidSig, raidLaneOfRegion, raidLaneOfKey, raidLaneOpen, RAID_LANES_BEYOND, RAID_REGION_COUNT,
  RAID_BAY_REGIONS, RAID_LANES, RAID_ZONE_LANE, RAID_PIXEL_BOUND, raidSideOk, raidWordSane, raidDayRandom, rollRaidTowns,
  raidDaySlots, raidOnSlot, raidsPerDay, raidLaneCount, RAID_SLOTS_MAX, RAID_LANE_PARTIES, raidLaneParties, raidLedgerId,
  RAID_DAY_MINUTES, RAID_START_LAST, RAID_TYPES, RAID_TARGET_MIN, RAID_TARGET_MAX, RAID_LANE_SALT,
} from '../../../src/net/raid/raidLaw.js';
import { readRaidReceipt } from '../../../src/net/raid/raidReceipt.js';
import { REGION_NAMES, BAY_REGION_COUNT, regionOfTheatre, theatreOfRegion } from '../../../src/formats/mapsTables.js';
import { THEATRE_COUNT, areaAt } from '../../../src/world/worldWide/worldGrid.js';
import { WILD_REGION } from '../../../src/systems/wild/wildZone.js';
import {
  WORLD_PIXEL_BOUND, validRaidIn, validRaidOut, parseClient, worldRoom, relaySupportsRaidWorld, RAID_WORLD_RELAY_MIN, RELAY_VERSION,
  PIXEL_UNITS, wallMsForClassicMinutes, raidLedgerKey,
} from '../../../src/net/wire.js';
import { dayRng, DAY_SALT } from '../../../src/systems/worldTick.js';
import { ROSTERS, TOWN_ROSTERS } from '../../../src/systems/tamrielFauna.js';
import { BIOMES } from '../../../src/world/tamriel/tamrielBiomes.js';
import { MOBILE_TYPES as M } from '../../../src/characters/mobile/mobileTypes.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { capitalPlaceId, capitalLocationIndex } from '../../../src/world/tamrielCapitals.js';
import { arenaPlaceId, arenaLocationIndex } from '../../../src/world/arenaLocations.js';
import { setTamrielTrace, PROVINCE_OF_ID } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, pictureToBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { capitalStreet } from '../../../src/scenes/livingWorld/livingIndex.js';
import { raidTownIs } from '../../../src/world/raidShared.js';
import {
  raidLaneGroups, raidsForLane, raidsForDay, rollRaids, raidHome, raidKey, raidFrame, setRaidingPartiesHost, _resetRaidingParties,
  raidState, getRaidSaveData, restoreRaidSaveData, raidTimerList, raidDefendingHere, RAID_TOWN_TYPES, RAID_DURATION_MINUTES, raidTypeName,
} from '../../../src/systems/raidingParties.js';
import { _resetModSettings } from '../../../src/systems/modSettings.js';
import { setSharedClock } from '../../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../../src/systems/gameDate.js';
import { validStaffEvent, staffEventFault, staffTownPixelOk, isAreaEvent, STAFF_EVENT_AREA, STAFF_PROVINCE_REGIONS, STAFF_TOWN_INDEX_MIN } from '../../../src/net/staffEvent/staffEventLaw.js';
import { staffPlaces, staffHere, gamePlaces } from '../../../src/net/staffPlaces.js';
import { staffEventBook, staffRaidHere } from '../../../src/systems/staffEvents.js';
import { stagedEvent } from '../../../server-account/src/staffEvents.js';
import { readRaidMarksIn, readRaidMarks } from '../../../src/ui/eventMapMarks.js';
import { eventTimerRows } from '../../../src/systems/eventTimers.js';
import { eventBoardModel } from '../../../src/systems/eventBoard.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { OnlineSession } from '../../../src/net/online.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { codeOnly } from '../../codeOnly.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const subtle = globalThis.crypto.subtle;
const quiet = async (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return await fn(); } finally { console.info = info; console.warn = warn; } };
const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));

setTamrielTrace(null); setTamrielFit(null);   // the authored shape and fit: no player's picture in the synthetic half
const at = (name) => { const c = CITIES.find((x) => x.name === name); const [x, y] = pictureToBay(c.at[0], c.at[1]).map(Math.floor); return { x, y }; };

const D = 600;   // the raids' day
const T = LOCATION_TYPES;
/** A province's towns as TESA's providers register them (world/pastBayRows.js): an Arena place by its own id and index. */
const arenaRow = (name, provinceIndex, id, type = T.TownCity, nudge = [0, 0]) => {
  const p = at(name), place = { provinceIndex, id };
  return { mapId: arenaPlaceId(place), name, px: p.x + nudge[0], py: p.y + nudge[1], type, location: arenaLocationIndex(place) };
};
/** Skyrim (its province index 2 in Arena's lane - world/arenaLocations.js ordinal), and a capital with a street. */
function skyrim() {
  const places = createWorldPlaces();
  places.register('bay', [{ mapId: 207213, name: 'Daggerfall', px: 207, py: 213, type: T.TownCity, region: 17 }]);
  const sol = at('Solitude');
  const rows = [
    { mapId: capitalPlaceId(1, 0), name: 'Solitude', px: sol.x, py: sol.y, type: T.TownCity, location: capitalLocationIndex(1, 0) },
    { mapId: capitalPlaceId(1, 1), name: 'Solitude Street', px: sol.x + 1, py: sol.y, type: T.TownCity, location: capitalLocationIndex(1, 1) },   // a slice that is no town of its own (WW7-11)
    arenaRow('Whiterun', 2, 1), arenaRow('Whiterun', 2, 2, T.TownVillage, [3, 2]), arenaRow('Windhelm', 2, 3), arenaRow('Riften', 2, 4, T.TownHamlet),
    { ...arenaRow('Riften', 2, 5, T.Tavern, [2, 0]) },   // no town SelectRaids takes
    { mapId: arenaPlaceId({ provinceIndex: 2, id: 6 }), name: 'Unindexed', px: at('Windhelm').x + 4, py: at('Windhelm').y, type: T.TownVillage },   // no location of its own: no key
  ];
  // listed against the law's own order - its areas descending, a map id's descending within one - so its sorts are read
  const area = (r) => areaAt(r.px, r.py, () => -1);
  places.register('tesa', rows.sort((a, b) => area(b) - area(a) || b.mapId - a.mapId));
  return places;
}

// ═══ THE LAW ════════════════════════════════════════════════════════════════════════════════════

test('WW6 the law: a raid\'s key names every region of the world - a Bay region with its MAPS.BSA location as it always was, a province\'s past the Bay with its town\'s own index, negative - its tuple the world\'s pixel, its lane its theatre, the open zone\'s shut, and a word on the wrong side of the Bay\'s edge no honest machine\'s (mutants: the region bound left at 99; a province\'s key with a Bay location; a Bay key with a negative one; the signature\'s Bay pixel; a lane off by one; the zone open; the side unread)', () => {
  for (const ok of ['3:7:600', '0:0:0', '61:9999:9999999', '10:100:1', '59:1:1', '60:2:2']) assert.ok(RAID_KEY_RE.test(ok), ok);
  for (const bad of ['3:07:600', '03:7:600', '3:7:0600', '00:1:1', '3:7:', '3:7:12345678', '100:1:1']) assert.equal(RAID_KEY_RE.test(bad), false, bad);
  for (const ok of ['62:-1000000:600', '64:-1000124:600', '69:-41000006:1', '70:-41009984:600', '66:-99999999:9999999']) assert.ok(RAID_KEY_RE.test(ok), ok);
  for (const bad of ['64:5:600', '64:0:600', '3:-5:600', '61:-1000124:600', '71:-1000124:600', '64:-01000124:600', '64:-0:600', '64:-123456789:600', '99:-1:1', '62:-1000000:0600']) assert.equal(RAID_KEY_RE.test(bad), false, bad);
  // pinned equal (this file imports nothing)
  assert.equal(RAID_REGION_COUNT, REGION_NAMES.length);
  assert.equal(RAID_BAY_REGIONS, BAY_REGION_COUNT);
  assert.equal(RAID_LANES, THEATRE_COUNT);
  assert.equal(RAID_ZONE_LANE, theatreOfRegion(WILD_REGION), 'the open zone\'s lane is Cyrodiil\'s');
  assert.equal(RAID_PIXEL_BOUND, WORLD_PIXEL_BOUND);
  // the lanes: a Bay region the Bay's 0, a province its theatre, past the 71 none
  assert.deepEqual(Array.from({ length: 72 }, (_, r) => raidLaneOfRegion(r)), [...Array(62).fill(0), 1, 2, 3, 4, 5, 6, 7, 8, 9, -1]);
  for (let t = 1; t < THEATRE_COUNT; t++) assert.equal(raidLaneOfRegion(regionOfTheatre(t)), t, PROVINCE_OF_ID[t]);
  assert.deepEqual([raidLaneOfRegion(-1), raidLaneOfRegion(1.5), raidLaneOfRegion('3')], [-1, -1, -1]);
  assert.deepEqual(RAID_LANES_BEYOND, [1, 2, 3, 4, 5, 6, 7, 8], 'every province but the open zone');
  assert.deepEqual([raidLaneOpen(0), raidLaneOpen(8), raidLaneOpen(9), raidLaneOpen(10), raidLaneOpen(-1)], [true, true, false, false, false]);
  assert.deepEqual([raidLaneOfKey('64:-1000124:600'), raidLaneOfKey('3:7:600'), raidLaneOfKey('70:-41000000:1'), raidLaneOfKey('junk')], [3, 0, 9, -1]);
  // the tuple on the world's grid
  assert.ok(RAID_SIG_RE.test(raidSig({ st: 864587, tg: 15, ty: 1, px: 2425, py: -430 })));
  assert.ok(RAID_SIG_RE.test(raidSig({ st: 9_999_999 * RAID_DAY_MINUTES + RAID_START_LAST, tg: 25, ty: 2, px: -8191, py: 8191 })));
  assert.ok(RAID_SIG_RE.test(raidSig({ st: 864587, tg: 15, ty: 1, px: 999, py: 499 })), 'the Bay\'s as before');
  assert.equal(RAID_SIG_RE.test('864587.15.1.12345.0'), false);
  assert.ok(raidSig({ st: 9_999_999 * RAID_DAY_MINUTES + RAID_START_LAST, tg: 25, ty: 2, px: -8191, py: -8191 }).length <= 32, 'the wire\'s bound on a signature holds');
  // the side
  const w = (key, px, py) => ({ key, px, py });
  assert.deepEqual([
    raidSideOk(w('3:7:600', 999, 499)), raidSideOk(w('3:7:600', 0, 0)), raidSideOk(w('3:7:600', 1000, 0)), raidSideOk(w('3:7:600', 0, -1)),
    raidSideOk(w('64:-1000124:600', 2425, 270)), raidSideOk(w('64:-1000124:600', 500, 200)), raidSideOk(w('64:-1000124:600', -5, 200)),
    raidSideOk(w('70:-41000000:600', 1500, 800)), raidSideOk(w('64:-1000124:600', 8192, 0)), raidSideOk(w('junk', 1, 1)),
  ], [true, true, false, false, true, false, true, false, false, false]);
  const sane = { key: `64:-1000124:${D}`, st: D * RAID_DAY_MINUTES + 600, px: 2425, py: 270 };
  assert.deepEqual([raidWordSane(sane), raidWordSane({ ...sane, px: 400 }), raidWordSane({ ...sane, key: `70:-41000000:${D}` }), raidWordSane({ ...sane, key: `3:7:${D}` })], [true, false, false, false]);
});

// ═══ THE BAY'S LANE, TO THE BYTE ═════════════════════════════════════════════════════════════════

/** The law before WW6, written out: the day's generator, SelectRaids' roll and the relay's slots as RAID-ROLL had them. */
const OLD = {
  random(day) {
    let a = ((day * 7919) ^ 0x44415953 ^ Math.imul(5, 0x9E3779B1)) >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  },
  int: (min, max, random) => (max <= min ? min : min + Math.floor(random() * (max - min))),
  roll(day, regions, count, random) {
    const lists = regions.map((g) => ({ region: g.region, towns: [...g.towns] })), out = [];
    for (let l = 0; l < count && lists.length > 0; l++) {
      const i = OLD.int(0, lists.length, random), g = lists[i], j = OLD.int(0, g.towns.length, random), town = g.towns[j];
      g.towns.splice(j, 1);
      if (g.towns.length === 0) lists.splice(i, 1);
      const st = day * 1440 + OLD.int(0, 1321, random), ty = OLD.int(0, 3, random), tg = OLD.int(15, 26, random);
      out.push({ region: g.region, town, st, ty, tg });
    }
    return out;
  },
  slots(day) {
    const random = OLD.random(day), out = new Set();
    for (let l = 0; l < 32; l++) { random(); random(); const st = day * 1440 + OLD.int(0, 1321, random), ty = OLD.int(0, 3, random), tg = OLD.int(15, 26, random); out.add(`${st}.${tg}.${ty}`); }
    return out;
  },
};
/** A Bay table of 44 regions, some with one town, some with many. */
const BAY = Object.freeze(Array.from({ length: 44 }, (_, r) => Object.freeze({ region: r, towns: Object.freeze(Array.from({ length: 1 + ((r * 7) % 9) }, (_, k) => Object.freeze({ index: k * 3, name: `T${r}.${k}`, px: 10 + r * 20, py: 5 + k * 9 }))) })));

test('WW6 THE BAY\'S LANE IS THE LAW BEFORE IT, to the byte: its generator worldTick\'s and the old one\'s, draw for draw; its roll and its slots the old law\'s over three hundred days; its raids\' records the shape they were, no area among them (mutants: the lane stirred into the Bay\'s seed; the Bay\'s parties drawn as a lane\'s; an area on a Bay raid)', () => {
  for (const day of [0, 1, D, 9_999_999]) {
    const a = raidDayRandom(day), b = raidDayRandom(day, 0), o = OLD.random(day), w = dayRng(day * MINUTES_PER_DAY, DAY_SALT.raids);
    for (let i = 0; i < 400; i++) { const x = a(); assert.equal(x, b()); assert.equal(x, o()); assert.equal(x, w()); }
  }
  for (let day = D; day < D + 300; day++) {
    assert.deepEqual(rollRaidTowns(day, BAY, raidsPerDay(BAY.length), raidDayRandom(day)), OLD.roll(day, BAY, raidsPerDay(BAY.length), OLD.random(day)), `day ${day}`);
    assert.deepEqual([...raidDaySlots(day)], [...OLD.slots(day)], `day ${day}'s slots`);
  }
  assert.equal(raidLaneCount(BAY.length), raidsPerDay(BAY.length), 'the Bay\'s pace the mod\'s');
  const raids = raidsForDay(D, BAY);
  assert.equal(raids.length, 22);
  for (const r of raids) assert.deepEqual(Object.keys(r), ['regionIndex', 'locationIndex', 'startDay', 'locationName', 'type', 'startMinute', 'endMinute', 'killed', 'attackAmount', 'cleansed', 'announced', 'struck', 'px', 'py', 'sacked', 'safe', 'lost'], 'the record it always was');
  assert.deepEqual(raids.map((r) => raidHome(r)), raids.map((r) => r.regionIndex), 'a Bay raid is told of in its region');
});

// ═══ THE LANES ═══════════════════════════════════════════════════════════════════════════════════

test('WW6 a lane\'s parties are its province\'s OWN FAUNA\'s - the mod\'s three whose kinds TESA-BIOME\'s rosters (by day, by night, its towns\') name there: no orc war band raids Black Marsh (its Recorded choice 4), Orsinium\'s High Rock and Malabal Tor\'s Valenwood stand orcs, the open zone none; the Bay\'s three as ever (mutants: a party a province\'s fauna never stands; the Bay\'s narrowed)', () => {
  const kinds = { 0: [M.Knight], 1: [M.Rogue, M.Thief, M.Burglar], 2: [M.Orc, M.OrcSergeant, M.OrcWarlord, M.OrcShaman] };
  const derived = PROVINCE_OF_ID && Array.from({ length: RAID_LANES - 1 }, (_, i) => {
    const prov = PROVINCE_OF_ID[i + 1];
    const ids = new Set();
    for (const b of BIOMES.filter((x) => x.province === prov)) for (const e of [...(ROSTERS[b.key]?.day ?? []), ...(ROSTERS[b.key]?.night ?? [])]) ids.add(e[0]);
    for (const e of TOWN_ROSTERS[prov] ?? []) ids.add(e[0]);
    return i + 1 === RAID_ZONE_LANE ? [] : [0, 1, 2].filter((p) => kinds[p].some((k) => ids.has(k)));
  });
  assert.deepEqual(RAID_LANE_PARTIES.slice(1), derived, 'each province\'s own');
  assert.deepEqual(RAID_LANE_PARTIES, [[0, 1, 2], [0, 1, 2], [1], [1], [0, 1], [0, 1], [1, 2], [1], [1], []]);
  assert.equal(PROVINCE_OF_ID[8], 'BlackMarsh');
  assert.equal(raidLaneParties(8).includes(2), false, 'Black Marsh stands no orc');
  assert.deepEqual(raidLaneParties(0), [0, 1, 2]);
  assert.deepEqual(raidLaneParties(99), [], 'no lane, no party');
});

test('WW6 a lane\'s day: its own generator (the Bay\'s untouched), its raids each on its own slots and never the Bay\'s, its parties its province\'s, its pace half a raid an area to the relay\'s slots; the open zone\'s lane draws no slot (mutants: the lanes one generator; a lane read against the Bay\'s slots; the pace uncapped)', () => {
  const groups = Array.from({ length: 30 }, (_, a) => ({ region: 64, area: 1000 + a, towns: [{ index: -(1000000 + a), name: `S${a}`, px: 1300 + a * 10, py: -100 }] }));
  const seen = new Set();
  for (let lane = 0; lane < RAID_LANES; lane++) { const r = raidDayRandom(D, lane); const first = [r(), r(), r()].join(','); assert.ok(!seen.has(first), `lane ${lane} its own`); seen.add(first); }
  const salted = (s) => [0, 1, 2].map(((g) => () => g())(dayRng(D * MINUTES_PER_DAY, s))).join(',');
  for (let s = 0; s < DAY_SALT.raids; s++) assert.ok(!seen.has(salted(s)), `no lane is another day salt's (${s})`);
  const r0 = raidDayRandom(D, 0);
  assert.equal([r0(), r0(), r0()].join(','), salted(DAY_SALT.raids), 'the Bay\'s lane is the raids\' own salt');
  assert.equal(RAID_LANE_SALT >>> 0, 0x85ebca6b);
  for (const lane of RAID_LANES_BEYOND) {
    for (let day = D; day < D + 20; day++) {
      const raids = raidsForLane(day, lane, groups), slots = raidDaySlots(day, lane);
      assert.equal(raids.length, 15, 'half a raid an area');
      for (const r of raids) {
        const w = { st: r.startMinute, tg: r.attackAmount, ty: r.type };
        assert.ok(raidOnSlot(w, slots), `lane ${lane} day ${day}: on its own slots`);
        assert.ok(raidLaneParties(lane).includes(r.type), 'its province\'s party');
        assert.ok(r.attackAmount >= RAID_TARGET_MIN && r.attackAmount <= RAID_TARGET_MAX && r.type < RAID_TYPES);
        assert.equal(r.endMinute - r.startMinute, RAID_DURATION_MINUTES);
      }
      assert.ok(raids.filter((r) => raidOnSlot({ st: r.startMinute, tg: r.attackAmount, ty: r.type }, raidDaySlots(day))).length < raids.length, 'the Bay\'s slots are not its');
    }
  }
  assert.equal(raidDaySlots(D, RAID_ZONE_LANE).size, 0, 'the open zone draws none');
  assert.equal(raidDaySlots(D, 99).size, 0);
  assert.equal(raidLaneCount(200), RAID_SLOTS_MAX, 'never past the relay\'s slots');
  assert.deepEqual(rollRaids(D, groups, 3, raidDayRandom(D, 3), raidLaneParties(3)).map((r) => r.area), rollRaidTowns(D, groups, 3, raidDayRandom(D, 3), raidLaneParties(3)).map((r) => r.area), 'each raid keeps its area');
});

test('WW6 a lane\'s towns off the world\'s registry: its theatre\'s LISTED towns of SelectRaids\' types, a capital one town (its centre), each by its own location index, grouped by AREA ascending and by map id within - never the Bay\'s, never a place with no index of its own, none for the Bay\'s lane or the open zone\'s (mutants: the types unread; a capital\'s street a town; a place with no index kept; the areas unsorted; the Bay\'s lane walked)', () => {
  const places = skyrim();
  const g = raidLaneGroups(places, 3, capitalStreet);
  const towns = g.flatMap((x) => x.towns.map((t) => [x.region, x.area, t.index, t.name]));
  const sol = at('Solitude'), wr = at('Whiterun'), wh = at('Windhelm'), ri = at('Riften');
  const area = (p) => areaAt(p.x, p.y, () => -1);
  const want = [
    [area(sol), capitalLocationIndex(1, 0), 'Solitude'], [area(wr), arenaLocationIndex({ provinceIndex: 2, id: 1 }), 'Whiterun'],
    [areaAt(wr.x + 3, wr.y + 2, () => -1), arenaLocationIndex({ provinceIndex: 2, id: 2 }), 'Whiterun'], [area(wh), arenaLocationIndex({ provinceIndex: 2, id: 3 }), 'Windhelm'],
    [area(ri), arenaLocationIndex({ provinceIndex: 2, id: 4 }), 'Riften'],
  ];
  const byArea = new Map();
  for (const [a, loc, name] of want) { if (!byArea.has(a)) byArea.set(a, []); byArea.get(a).push([loc, name]); }
  assert.deepEqual(towns, [...byArea.keys()].sort((x, y) => x - y).flatMap((a) => byArea.get(a).map(([loc, name]) => [64, a, loc, name])), 'Skyrim\'s towns, by area, each its own index');
  assert.deepEqual(g.map((x) => x.area), [...g.map((x) => x.area)].sort((x, y) => x - y));
  assert.ok(g.length >= 3, 'areas enough to be out of order as listed');
  assert.equal(area(wr), areaAt(wr.x + 3, wr.y + 2, () => -1), 'two towns of one district, listed by map id descending');
  assert.deepEqual(g.find((x) => x.area === area(wr)).towns.map((t) => t.index), [arenaLocationIndex({ provinceIndex: 2, id: 1 }), arenaLocationIndex({ provinceIndex: 2, id: 2 })], 'within an area by map id');
  for (const x of g) assert.ok(x.towns.every((t, i, a) => i === 0 || a[i - 1].index !== t.index));
  assert.ok(RAID_TOWN_TYPES.includes(T.TownHamlet) && RAID_TOWN_TYPES.includes(T.TownVillage));
  assert.equal(towns.length, 5, 'no street, no tavern, no place without its own index');
  assert.deepEqual(raidLaneGroups(places, 0, capitalStreet), [], 'the Bay\'s lane is raidRegions\' own');
  assert.deepEqual(raidLaneGroups(places, RAID_ZONE_LANE, capitalStreet), [], 'the open zone');
  assert.deepEqual(raidLaneGroups(null, 3), []);
  assert.equal(raidLaneGroups(places, 3).flatMap((x) => x.towns).length, 6, 'no street law handed: the street a town of its own');
});

// ═══ THE CLIENT'S DAY ════════════════════════════════════════════════════════════════════════════

const DAY_AT = (min) => D * MINUTES_PER_DAY + min;
const bayRaid = (o = {}) => ({ regionIndex: 3, locationIndex: 7, startDay: D, locationName: 'Gothway Garden', type: 2, startMinute: DAY_AT(600), endMinute: DAY_AT(720), killed: 0, attackAmount: 15, cleansed: false, announced: false, struck: false, px: 200, py: 100, ...o });
function rig(places) {
  const at = { now: DAY_AT(0), region: 3, pixel: { x: 200, y: 100 }, town: null, places, relay: false };
  const log = { said: [], raiders: [], words: [] };
  let seq = 0;
  const foe = (mobileType) => ({ mobileType, dead: false, corpse: false, entity: { health: 10, maxHealth: 10 }, ai: { feet: [seq++, 0, 0] } });
  setRaidingPartiesHost({
    now: () => at.now, random: () => 0, regionIndex: () => at.region, regionName: (r) => REGION_NAMES[r] ?? String(r),
    townHere: () => at.town, playerPixel: () => at.pixel, places: () => at.places, street: capitalStreet,
    standRaider: (mt) => { const f = foe(mt); log.raiders.push(f); return Promise.resolve(f); },
    standDefender: () => Promise.resolve(null), defenderCount: () => 0, defendersAllowed: () => true, removeFoe: (f) => { f.dead = true; },
    outOfSight: () => true, say: (line) => log.said.push(line), sendRaid: (w, cell) => { log.words.push({ w, cell }); return true; }, relayRaids: () => at.relay,
    selfId: () => 'me', wallNow: () => 0, peersInTown: () => [],
  });
  return { at, log };
}
beforeEach(() => { _resetRaidingParties(); _resetModSettings(); setSharedClock(null); });

test('WW6 the client\'s day: the lanes past the Bay rolled for the day the Bay\'s list was (the Bay\'s raids untouched), each kept by its key and tuple through a roll again, gone when the registry\'s places go, never one run out rolled back in, nor said; saved with its area and restored (mutants: the lanes never synced; a held raid replaced by its roll; a lane\'s raids kept with no places; a run-out raid rolled again withdrawn aloud; the area unsaved)', () => {
  const places = skyrim();
  const { at, log } = rig(places);
  restoreRaidSaveData({ lastSelectedDay: D, raids: [bayRaid()] });
  const was = structuredClone(raidState().raids);
  raidFrame(0);
  const lane = raidsForLane(D, 3, raidLaneGroups(places, 3, capitalStreet));
  assert.ok(lane.length > 0);
  assert.equal(raidState().raids.filter((r) => r.regionIndex < RAID_BAY_REGIONS).length, 1);
  assert.deepEqual(raidState().raids[0], was[0], 'the Bay\'s raid as it was');
  assert.deepEqual(raidState().raids.slice(1).map(raidKey), lane.map(raidKey), 'Skyrim\'s raids beside it, the day\'s own');
  for (const r of raidState().raids.slice(1)) { assert.equal(r.regionIndex, 64); assert.ok(r.locationIndex < 0); assert.ok(Number.isInteger(r.area) && r.area >= RAID_BAY_REGIONS); assert.match(raidKey(r), RAID_KEY_RE); }
  // a raid held keeps what it has through a roll again (the registry's places moved - another provider)
  const held = raidState().raids[1];
  held.killed = 4; held.announced = true;
  places.register('other', [{ mapId: 99, name: 'X', px: 900, py: 400, type: T.TownCity, region: 30 }]);
  raidFrame(0);
  assert.equal(raidState().raids.find((r) => raidKey(r) === raidKey(held)), held, 'the very record');
  assert.equal(held.killed, 4);
  // one run out is never rolled back in (the expiry pass after the lanes' roll takes it, unsaid)
  at.now = Math.max(...lane.map((r) => r.endMinute)) + 1;
  raidFrame(0);
  assert.equal(raidState().raids.filter((r) => r.regionIndex === 64).length, 0, 'every one ran out');
  // ...and unsaid, though I stand in its district as the roll names it again (WW6's finish: it was never announced, so its
  // withdrawal is no line - the expiry pass's fix 2)
  at.region = 64; at.pixel = { x: lane[0].px, y: lane[0].py };
  const said = log.said.length;
  places.register('other2', []);
  raidFrame(0);
  assert.equal(raidState().raids.filter((r) => r.regionIndex === 64).length, 0, 'and none rolled back in');
  assert.deepEqual(log.said.slice(said), [], 'nor a word said of one');
  at.region = 3; at.pixel = { x: 200, y: 100 };
  // saved with its area; the registry gone, the lane's raids go
  _resetRaidingParties(); rig(places);
  restoreRaidSaveData({ lastSelectedDay: D, raids: [bayRaid()] });
  raidFrame(0);
  const saved = getRaidSaveData();
  const one = saved.raids.find((r) => r.regionIndex === 64);
  assert.equal(one.area, raidState().raids.find((r) => r.regionIndex === 64).area, 'the area saved');
  assert.equal(saved.raids.find((r) => r.regionIndex === 3).area, undefined, 'a Bay raid\'s record the one it was');
  _resetRaidingParties(); const r2 = rig(places);
  restoreRaidSaveData(saved);
  assert.equal(raidState().raids.find((r) => raidKey(r) === raidKey(one)).area, one.area, 'restored');
  raidFrame(0);
  assert.equal(raidState().raids.filter((r) => r.regionIndex === 64).length, saved.raids.filter((r) => r.regionIndex === 64).length, 'kept by key and tuple');
  r2.at.places = null;
  raidFrame(0);
  assert.deepEqual(raidState().raids.map(raidKey), [raidKey(bayRaid())], 'no registry, no lane: the Bay\'s alone');
});

test('WW6 the client\'s raid past the Bay: told in its AREA (a player in its district hears it, one elsewhere in the province not; on the Bay its region as ever), stood in its town by the town\'s own index, its word to the town\'s cell on the world\'s grid; the board\'s and the timers\' rows the player\'s own by area, a Bay raid\'s row the one it was (mutants: told to the province; the town matched by region; the home flag unread)', async () => {
  const places = skyrim();
  const { at, log } = rig(places);
  restoreRaidSaveData({ lastSelectedDay: D, raids: [bayRaid({ startMinute: DAY_AT(0), endMinute: DAY_AT(1439) })] });   // a Bay raid the whole day, on the board beside it
  raidFrame(0);
  assert.deepEqual(log.said, [`Gothway Garden in ${REGION_NAMES[3]} is under attack by orcs!`], 'on the Bay, its region\'s as ever');
  log.said.length = 0;
  const r = raidState().raids.find((x) => x.regionIndex === 64);
  at.now = r.startMinute + 5;
  // in another district of Skyrim: not told
  const far = places.inTheatre(3).find((p) => p.area !== r.area);
  at.region = 64; at.pixel = { x: far.px, y: far.py };
  raidFrame(0);
  assert.equal(log.said.length, 0, 'another district of the province: not told');
  assert.equal(raidTimerList(() => 0).find((x) => x.key === raidKey(r)).home, false);
  // the host's -1 (at sea, past the Veil - fix 8) tells of nothing, past the Bay as on it
  at.region = -1; at.pixel = { x: r.px, y: r.py };
  raidFrame(0);
  assert.equal(log.said.length, 0, 'no region, no area');
  at.region = 64;
  // in its own district: told once, its province named
  raidFrame(0);
  assert.deepEqual(log.said, [`${r.locationName} in Skyrim is under attack by ${raidTypeName(r.type)}!`]);
  raidFrame(0);
  assert.equal(log.said.length, 1, 'once');
  const rows = raidTimerList(() => 0);
  assert.equal(rows.find((x) => x.key === raidKey(r)).home, true);
  assert.equal('home' in rows.find((x) => x.key === raidKey(bayRaid())), false, 'a Bay raid\'s row as it was');
  // the board and the timers read the flag
  const now = 1000, src = { now, pixel: at.pixel, region: 'Skyrim', raids: rows.map((x) => ({ ...x, startMs: now - 1, endMs: now + 1000 })) };
  const card = (home) => eventBoardModel({ ...src, raids: [{ ...src.raids.find((x) => x.key === raidKey(r)), home, px: 9999, py: 9999 }] }, { raids: 5 }).all.find((x) => x.kind === 'raid');
  assert.deepEqual([card(true).announce, card(false).announce], [true, false], 'the province\'s name names no district');
  const titles = (home) => eventTimerRows({ now, region: 'Skyrim', raids: [{ name: 'A', region: 'Skyrim', startMs: now - 1, endMs: now + 1000, home }, { name: 'B', region: 'Skyrim', startMs: now - 1, endMs: now + 2000, home }] }).filter((x) => x.kind === 'raid').map((x) => x.title);
  assert.deepEqual(titles(true), ['Raid on A', 'Raid on B'], 'my district\'s listed whole');
  assert.deepEqual(titles(false), ['Raids elsewhere: A'], 'the province\'s others one row');
  // stood in its town by the town's own index - its record's region the pixel's as the land read it
  at.town = { regionIndex: 0, locationIndex: r.locationIndex };
  assert.equal(raidDefendingHere(at.now), true, 'the town\'s own index');
  assert.ok(raidTownIs(r, at.town) && !raidTownIs(r, { regionIndex: 64, locationIndex: r.locationIndex - 1 }));
  assert.equal(raidTownIs(bayRaid(), { regionIndex: 4, locationIndex: 7 }), false, 'a Bay town by its region and row, as ever');
  assert.equal(raidFrame(20), 'defender', 'the town\'s watch called first [IL_06d1] - the town past the Bay stands its raid');
  await new Promise((res) => setImmediate(res));
  assert.equal(raidFrame(0.5), 'raider', 'and its raiders (the watch\'s clock not yet run out again)');
  await new Promise((res) => setImmediate(res));
  assert.equal(log.raiders.length, 1);
  // online, at a raid relay: my word to the town's cell
  r.killed = 2;
  at.relay = true;
  setSharedClock(() => at.now);
  try { raidFrame(1); } finally { setSharedClock(null); }
  const word = log.words.find((x) => x.w.key === raidKey(r));
  assert.ok(word, 'said to the relay');
  assert.deepEqual(word.w, { k: 'w', key: raidKey(r), st: r.startMinute, tg: r.attackAmount, ty: r.type, px: r.px, py: r.py, n: 2, s: 0 });
  assert.equal(word.cell, worldRoom(r.px, r.py), 'the town\'s own cell past the Bay');
  assert.ok(validRaidIn(word.w) && raidWordSane(word.w) && raidOnSlot(word.w, raidDaySlots(D, 3)), 'a word the relay takes');
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════

async function onTheRelay(fn, raid) {
  const realNow = Date.now; let clock = wallMsForClassicMinutes(raid.startMinute + 10); Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  try { await fn({ world, step: (ms) => { clock += ms; }, set: (t) => { clock = t; }, now: () => clock }); } finally { Date.now = realNow; }
}
const poseOn = (px, py) => ({ x: px * PIXEL_UNITS + 16384, y: 0, z: (499 - py) * PIXEL_UNITS + 16384, yaw: 0, pitch: 0 });
const wordOf = (r, o = {}) => ({ k: 'w', key: raidKey(r), st: r.startMinute, tg: r.attackAmount, ty: r.type, px: r.px, py: r.py, n: 0, s: 0, ...o });

test('WW6 the relay: a raid past the Bay is kept in its town\'s cell as the Bay\'s is - made from its pixel, counted, cleansed once with a receipt naming the province\'s key; a word on the wrong side of the Bay\'s edge, of the open zone or off its lane\'s slots is no raid; the hub\'s pinned table (MAPS.BSA\'s) the Bay\'s lane\'s alone (mutants: the relay reads a lane against the Bay\'s slots; the hub\'s roll asked of a lane; the side unread)', async () => {
  const places = skyrim();
  const r = raidsForLane(D, 3, raidLaneGroups(places, 3, capitalStreet))[0];
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
  await onTheRelay(async ({ world, step, set }) => {
    const cell = world.room(worldRoom(r.px, r.py));
    cell.env.GATE_SIGNING_KEY = pkcs8;
    const a = cell.connect(); await quiet(() => cell.hello(a, 'peer-0001', poseOn(r.px, r.py)));
    const say = (o) => quiet(() => cell.raw(a, JSON.stringify({ t: 'raid', ...wordOf(r, o) })));
    assert.equal(raidOnSlot(wordOf(r), raidDaySlots(D, 0)), false, 'its tuple its lane\'s alone - read against the Bay\'s slots it is none');
    await say({ s: 1 });
    const led = cell.store.get(raidLedgerKey(raidLedgerId(wordOf(r))));
    assert.ok(led, 'its ledger in the town\'s cell past the Bay');
    assert.deepEqual([led.key, led.px, led.py, led.tg], [raidKey(r), r.px, r.py, r.attackAmount]);
    step(30_000);
    await say({ n: r.attackAmount, s: 1 });
    const out = a.sent.filter((m) => m.t === 'raid');
    assert.ok(out.some((m) => m.k === 'cl' && m.key === raidKey(r) && m.g === raidSig(wordOf(r))), 'cleansed, its tuple the world\'s');
    const rc = out.find((m) => m.k === 'rc');
    assert.equal(readRaidReceipt(rc.r).w, raidKey(r), 'the receipt names the province\'s key');
    assert.ok(validRaidOut(out.find((m) => m.k === 'cl')), 'the client takes its word back');
    // the wrong side, the open zone, another lane's slots: no raid (struck, or dropped)
    const junk0 = a.meters.junk ?? 0;
    await quiet(() => cell.raw(a, JSON.stringify({ t: 'raid', ...wordOf(r, { key: `3:7:${D}` }) })));
    step(1000);   // the raid frames' own bucket
    await quiet(() => cell.raw(a, JSON.stringify({ t: 'raid', ...wordOf(r, { key: `70:${r.locationIndex}:${D}` }) })));
    assert.equal((a.meters.junk ?? 0) - junk0, 2, 'a Bay key past the Bay, a raid of the open zone: no honest machine\'s');
    // a tuple the Bay's day drew and the lane's never: on its pixel, in its window - no ledger
    const [st, tg, ty] = [...raidDaySlots(D)][0].split('.').map(Number);
    const off = { ...wordOf(r), st, tg, ty };
    assert.equal(raidOnSlot(off, raidDaySlots(D, 3)), false, 'the lane never drew it');
    set(wallMsForClassicMinutes(st + 10));
    await quiet(() => cell.raw(a, JSON.stringify({ t: 'raid', ...off, s: 1 })));
    assert.equal(cell.store.has(raidLedgerKey(raidLedgerId(off))), false, 'a tuple the lane never drew: no ledger');
    // the hub's pinned roll names the Bay's raids alone - a lane past the Bay is never read against it
    const r2 = raidsForLane(D, 3, raidLaneGroups(places, 3, capitalStreet))[1];
    set(wallMsForClassicMinutes(r2.startMinute + 10));   // inside its own window
    const cell2 = world.room(worldRoom(r2.px, r2.py));
    cell2.room._raidDayIdsOf = async () => new Set();
    const b = cell2.connect(); await quiet(() => cell2.hello(b, 'peer-0002', poseOn(r2.px, r2.py)));
    await quiet(() => cell2.raw(b, JSON.stringify({ t: 'raid', ...wordOf(r2, { s: 1 }) })));
    assert.ok(cell2.store.get(raidLedgerKey(raidLedgerId(wordOf(r2)))), 'a hub holding the Bay\'s table never refuses a lane\'s raid');
    // a cell at the Bay's edge holds both sides' raids: each lane-day its own slots, the Bay's by its day as before
    const edge = world.room(worldRoom(999, 200)).room;
    assert.deepEqual([...edge._raidSlotsOf(D, 0)], [...raidDaySlots(D)]);
    assert.deepEqual([...edge._raidSlotsOf(D, 2)], [...raidDaySlots(D, 2)], 'not the Bay\'s, read first');
    assert.deepEqual([...edge._raidSlotsOf(D)], [...raidDaySlots(D)]);
  }, r);
  const relay = codeOnly(rd('server/src/index.js'));
  assert.match(relay, /const day = raidDayOfKey\(m\.key\), lane = raidLaneOfKey\(m\.key\);\n\s*if \(!raidOnSlot\(m, this\._raidSlotsOf\(day, lane\)\)\) return;\n\s*const rolled = lane === 0 \? await this\._raidDayIdsOf\(day, now\) : null;/);
  assert.match(relay, /const k = lane === 0 \? day : `\$\{day\}:\$\{lane\}`;\n\s*let s = this\._raidSlots\.get\(k\);\n\s*if \(!s\) \{ if \(this\._raidSlots\.size >= 4\) this\._raidSlots\.clear\(\); s = raidDaySlots\(day, lane\); this\._raidSlots\.set\(k, s\); \}/, 'a lane-day\'s slots kept, the Bay\'s by its day as before');
});

test('WW6 the session: a raid past the Bay goes only to a relay that hears one (world274 on - an older relay refuses the word); a Bay raid to any raid relay as before; the halo says for itself (mutants: the gate unread; the version floor off)', () => {
  assert.equal(RAID_WORLD_RELAY_MIN, 276);   // PIN MOVED (the eighth merge of main into #1184): world276, past main's world275 (SD-PARTY, live), which refuses; PIN MOVED (the seventh merge of main into #1184): the gate is world275, past main's world274 (LADDER-CUT), which refuses; PIN MOVED (the fourth merge of main into #1184): the gate is world274, past main's world273, which refuses; PIN MOVED (the third merge of main into #1184): the gate is world272, past MASTER-THREE's world271 (main's), which refuses; world271 at the second merge, past CHAT-POST's world270
  assert.deepEqual([relaySupportsRaidWorld('world275'), relaySupportsRaidWorld('world278'), relaySupportsRaidWorld(RELAY_VERSION), relaySupportsRaidWorld('x')], [false, true, true, false]);
  const rigOf = (cell, v, pose) => {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
    const info = console.info; console.info = () => {};
    try { s.join(cell, { x: pose.x, y: 0, z: pose.z, yaw: 0 }); const ws = sockets[0]; ws.open(); ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v }); } finally { console.info = info; }
    return s;
  };
  const past = { key: `64:-1000124:${D}`, st: D * 1440 + 700, tg: 17, ty: 1, px: 2425, py: 270, n: 0, s: 0, k: 'w' };
  const bay = { ...past, key: `3:7:${D}`, px: 100, py: 200 };
  const oldPast = rigOf(worldRoom(past.px, past.py), 'world271', poseOn(past.px, past.py));
  assert.deepEqual([oldPast.raidOk, oldPast.raidWorldOk, oldPast.sendRaid(past, worldRoom(past.px, past.py))], [true, false, false], 'an older raid relay hears no raid past the Bay');
  const oldBay = rigOf(worldRoom(bay.px, bay.py), 'world271', poseOn(bay.px, bay.py));
  assert.equal(oldBay.sendRaid(bay, worldRoom(bay.px, bay.py)), true, 'the Bay\'s as before');
  const now = rigOf(worldRoom(past.px, past.py), RELAY_VERSION, poseOn(past.px, past.py));
  assert.deepEqual([now.raidWorldOk, now.sendRaid(past, worldRoom(past.px, past.py))], [true, true]);
  const on = codeOnly(rd('src/net/online.js'));
  assert.match(on, /if \(raidLaneOfKey\(w\.key\) !== 0 && !\(this\._mine\(cell\) \? this\.raidWorldOk : halo\?\.raidWorldOk\)\) return false;/);
  assert.match(on, /else \{ const h = this\._halo\.get\(room\); if \(h\) h\.raidWorldOk = relaySupportsRaidWorld\(relayV\); \}/);
  assert.match(on, /old\.raidWorldOk = this\.raidWorldOk;/);
  assert.match(on, /this\.raidWorldOk = !!h\.raidWorldOk;/);
});

// ═══ A STAFF TOWN EVENT PAST THE BAY ═════════════════════════════════════════════════════════════

test('WW6 a staff TOWN event past the Bay: the law takes a town past the Bay by its own index at its own pixel in a province\'s region (a city\'s word kept), refuses either side\'s location at the other\'s pixel by name (`town`); an area is -1 alone; the picker offers a province\'s town as itself; the account door stages it, the hub\'s book holds it, and the game stands it in its town by its index (mutants: the side unread; an area any negative; a town past the Bay offered as an area; a province\'s region unasked)', () => {
  const sol = at('Solitude');
  const EV = { id: 'ab12cd34ef', rg: 64, loc: capitalLocationIndex(1, 0), px: sol.x, py: sol.y, nm: 'Solitude', ct: 1, mt: [7, 12], n: 50, m: 25, b: 24, bs: 200, bh: 10, at: 1_700_000_000_000, ue: 0, eb: 1, fb: 0, by: 'Mob' };
  assert.equal(staffEventFault(EV), null, 'Solitude, by its own index');
  assert.deepEqual(validStaffEvent(EV), { ...EV, hp: 0 }, 'a city\'s word kept');
  assert.equal(isAreaEvent(EV), false);
  assert.deepEqual([isAreaEvent({ loc: STAFF_EVENT_AREA }), isAreaEvent({ loc: -2 }), isAreaEvent({ loc: 0 })], [true, false, false]);
  assert.equal(staffEventFault({ ...EV, loc: 3 }), 'town', 'a Bay location at a pixel past the Bay');
  assert.equal(staffEventFault({ ...EV, px: 207, py: 213 }), 'town', 'a town past the Bay\'s index at a Bay pixel');
  assert.equal(staffEventFault({ ...EV, rg: 17 }), 'town', 'a town past the Bay in no province\'s region');
  assert.equal(staffEventFault({ ...EV, rg: 70, nm: 'X' }), null, 'any province\'s - staff\'s own call');
  assert.equal(staffEventFault({ ...EV, loc: STAFF_TOWN_INDEX_MIN - 1 }), 'place');
  assert.deepEqual([staffEventFault({ ...EV, loc: -99_999_999 }), staffEventFault({ ...EV, loc: -100_000_000 })], [null, 'place'], 'eight digits, as a raid\'s key holds a town\'s index');
  assert.deepEqual([RAID_KEY_RE.test('64:-99999999:1'), RAID_KEY_RE.test('64:-100000000:1')], [true, false], 'the raid\'s key the same eight');
  assert.equal(staffEventFault({ ...EV, rg: 17, loc: 0, px: 207, py: 213 }), null, 'a Bay town\'s as it was');
  assert.equal(staffEventFault({ ...EV, loc: STAFF_EVENT_AREA }), null, 'an area anywhere');
  assert.deepEqual([staffTownPixelOk(999, 499), staffTownPixelOk(1000, 0), staffTownPixelOk(sol.x, sol.y, -5, 64), staffTownPixelOk(sol.x, sol.y, -5, 61), staffTownPixelOk(5, 5, -5, 64)], [true, false, true, false, false]);
  assert.deepEqual(STAFF_PROVINCE_REGIONS, [regionOfTheatre(1), regionOfTheatre(9)]);
  assert.ok(stagedEvent({ ...EV, mins: 60 }, 'ab12cd34ef', 1_700_000_000, 'Mob'), 'the account door stages it');
  // the picker offers it as itself
  const places = skyrim();
  const maps = { getRegion: () => null, getRegionName: (r) => REGION_NAMES[r] ?? '', getRegionIndexAt: () => 64 };
  const list = staffPlaces(maps, 64, places).list;
  assert.deepEqual(list.find((x) => x.name === 'Solitude'), { loc: capitalLocationIndex(1, 0), name: 'Solitude', kind: 'town', px: sol.x, py: sol.y });
  assert.equal(list.find((x) => x.name === 'Unindexed').loc, -1, 'a place with no index of its own an area');
  for (const x of list) assert.equal(staffEventFault({ ...EV, loc: x.loc, px: x.px, py: x.py, nm: x.name }), null, `${x.name}: what the picker offers runs`);
  gamePlaces(places);
  assert.equal(staffHere(maps, sol).loc, capitalLocationIndex(1, 0), 'where I stand: the town');
  gamePlaces(null);
  // the hub's book, and the game stands it in its town
  assert.equal(staffEventBook([EV]), 1);
  assert.equal(staffRaidHere({ regionIndex: 0, locationIndex: EV.loc }, null, true)?.staff.id, EV.id, 'in its town, by its own index');
  assert.equal(staffRaidHere({ regionIndex: 64, locationIndex: EV.loc - 1 }, null, true), null);
  staffEventBook([]);
});

// ═══ THE MAP AND THE HOST ════════════════════════════════════════════════════════════════════════

test('WW6 the held map stands a raid past the Bay on the continent\'s sheet (the bounties\' law), the Bay\'s sheet the Bay\'s; the host\'s seams: the raids\' host hands the registry and the capital\'s street, the host constructs it (mutants: the sheet unread; the registry unhanded)', () => {
  // PIN MOVED (AUDIT BAY-LEFT, its packages merged): WW6's readRaidMarksIn and BAY-LEFT-MAPS' met, and the one kept bounds the
  // marks by the box itself - so the sheet is asked of a mark north of the Bay (Solitude's pixel, kept) and one past the
  // frame's east edge though under its width (dropped), which only the box's origin tells apart
  const marks = () => [{ key: 'a', px: 2425, py: 270, label: 'T', tip: null }, { key: 'b', px: 100, py: 100, label: 'B', tip: null }, { key: 'c', px: 9000, py: 0, label: 'X' }, { key: 'd', px: 1569, py: -430, label: 'S', tip: null }, { key: 'e', px: 5500, py: 10, label: 'E', tip: null }];
  assert.deepEqual(readRaidMarksIn(marks, { x0: 0, y0: 0, w: 1000, h: 500 }).map((m) => m.key), ['b'], 'the Bay\'s sheet');
  assert.deepEqual(readRaidMarksIn(marks, { x0: 0, y0: 0, w: 1000, h: 500 }), readRaidMarks(marks), 'the Bay\'s as before');
  const sheet = readRaidMarksIn(marks, { x0: -862, y0: -975, w: 6000, h: 3750 });
  assert.deepEqual(sheet.map((m) => [m.key, m.px, m.py, m.x, m.y]), [['a', 2425, 270, 2425.5, 270.5], ['b', 100, 100, 100.5, 100.5], ['d', 1569, -430, 1569.5, -429.5]], 'past the Bay over the continent\'s frame');
  assert.deepEqual(readRaidMarksIn(() => { throw new Error('x'); }, { x0: 0, y0: 0, w: 1000, h: 500 }), []);
  const hm = codeOnly(rd('src/ui/heldMap.js'));
  assert.match(hm, /const raids = readRaidMarksIn\(this\.deps\.raids, sheet\);/);
  const rh = codeOnly(rd('src/scenes/raidHost.js'));
  assert.match(rh, /places: \(\) => keptPlaces\(\),\n\s*street: capitalStreet,/);
  assert.match(codeOnly(rd('src/scenes/world.js')), /const worldPlaces = gamePlaces\(createWorldPlaces\(\)\);/, 'the registry the boot keeps');
  assert.match(codeOnly(rd('src/scenes/world.js')), /\n {2}createRaidHost\(\{/);
});

// ═══ WITH ARENA2: THE FREEWARE'S REGISTRY WITH TESA'S PLACES ═════════════════════════════════════

test('WW6 with ARENA2: every province\'s lane over the freeware\'s registry with TESA\'s places (the game\'s own templates) - its towns, its areas and its day\'s raids, the open zone none; the Bay\'s roll the old law\'s on the real table; a raid rolled on a Skyrim town, its word through the wire\'s parse and the relay\'s law and its cell; a staff event at Solitude', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { ImgFile } = await import('../../../src/formats/imgFile.js');
  const { groundMaps, dropGroundCache } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { bayPlaceRows, BAY_SOURCE } = await import('../../../src/world/worldWide/bayPlaces.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await import('../../../src/world/pastBayRows.js');
  const { arenaPixels } = await import('../../../src/world/arenaPlaces.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../../src/world/arenaLocations.js');
  const { isMainStoryDungeon } = await import('../../../src/world/dungeon/dungeonTextures.js');
  const { raidRegions } = await import('../../../src/systems/raidingParties.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const picker = new ImgFile(); picker.load(bytes('TRAV0I01.IMG'), 'TRAV0I01.IMG');
    const bay = raidRegions(maps, picker.getDFBitmap().data);
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
    const aT = arenaTemplates(rows, isMainStoryDungeon);
    const places = createWorldPlaces();
    places.register(BAY_SOURCE, bayPlaceRows(rows.filter((l) => l?.exterior?.exteriorData)));
    places.registerLive(PAST_BAY_SOURCE, { stamp: () => [arenaPixels()], rows: () => pastBayPlaceRows({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(aT, p), capitals: true }) });
    // every lane: its towns, its areas, its day's raids (measured on the freeware)
    const lanes = Array.from({ length: RAID_LANES - 1 }, (_, i) => { const g = raidLaneGroups(places, i + 1, capitalStreet); return [PROVINCE_OF_ID[i + 1], g.reduce((s, x) => s + x.towns.length, 0), g.length, raidsForLane(D, i + 1, g).length]; });
    assert.deepEqual(lanes, [['HighRock', 29, 28, 14], ['Hammerfell', 31, 31, 16], ['Skyrim', 33, 33, 17], ['Morrowind', 31, 31, 16], ['Sumurset', 32, 30, 15], ['Valenwood', 31, 31, 16], ['Elsweyr', 31, 29, 15], ['BlackMarsh', 32, 31, 16], ['Imperial', 0, 0, 0]]);
    for (let lane = 1; lane < RAID_LANES; lane++) for (const g of raidLaneGroups(places, lane, capitalStreet)) for (const t of g.towns) assert.ok(raidSideOk({ key: `${g.region}:${t.index}:${D}`, px: t.px, py: t.py }), `${t.name}: its own side`);
    // the Bay's roll on the real table the old law's, to the byte
    assert.deepEqual([bay.length, bay.reduce((s, g) => s + g.towns.length, 0)], [43, 3444]);
    for (let day = D; day < D + 30; day++) assert.deepEqual(rollRaidTowns(day, bay, raidsPerDay(bay.length), raidDayRandom(day)), OLD.roll(day, bay, raidsPerDay(bay.length), OLD.random(day)));
    // a raid on a Skyrim town
    const r = raidsForLane(D, 3, raidLaneGroups(places, 3, capitalStreet))[0];
    assert.deepEqual([raidKey(r), r.locationName, r.px, r.py, raidTypeName(r.type), r.startMinute, r.attackAmount], [`64:-1000124:${D}`, 'Torbarke', 2425, 270, 'bandits', 865294, 17]);
    const word = wordOf(r, { n: 3, s: 1 });
    assert.deepEqual(parseClient(JSON.stringify({ t: 'raid', ...word }), { hasHello: true }), { t: 'raid', ...word }, 'the relay\'s parse');
    assert.ok(raidWordSane(word) && raidOnSlot(word, raidDaySlots(D, 3)) && !raidOnSlot(word, raidDaySlots(D, 0)), 'its lane\'s slots, not the Bay\'s');
    assert.equal(worldRoom(word.px, word.py), 'world:151,16');
    await onTheRelay(async ({ world }) => {
      const cell = world.room(worldRoom(r.px, r.py));
      const a = cell.connect(); await quiet(() => cell.hello(a, 'peer-0001', poseOn(r.px, r.py)));
      await quiet(() => cell.raw(a, JSON.stringify({ t: 'raid', ...wordOf(r, { s: 1 }) })));
      assert.deepEqual(a.sent.filter((m) => m.t === 'raid').at(-1), { t: 'raid', k: 'st', key: raidKey(r), n: 0, tg: r.attackAmount, st: r.startMinute, c: 0, g: raidSig(word) }, 'the relay keeps Torbarke\'s raid');
    }, r);
    // a staff event at Solitude, as the picker offers it
    const sol = staffPlaces({ getRegion: () => null, getRegionName: (x) => REGION_NAMES[x] ?? '' }, 64, places).list.find((x) => x.name === 'Solitude');
    assert.deepEqual([sol.loc, sol.kind], [capitalLocationIndex(1, 0), 'town']);
    assert.equal(staffEventFault({ id: 'ab12cd34ef', rg: 64, loc: sol.loc, px: sol.px, py: sol.py, nm: sol.name, ct: 1, mt: [7], n: 50, m: 25, b: 24, bs: 200, bh: 10, at: 1_700_000_000_000, ue: 0, eb: 1, fb: 0, by: 'Mob' }), null);
  } finally { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); }
});
