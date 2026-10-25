// WW2 (2026-10-24, bible/03-World/World-Wide.md WW2): THE GATES OF EVERY THEATRE - a gate a game day on every lane (the
// Iliac Bay's, and each province's beyond it), the Bay's lane the gate it always was. The owner: "we can expand world
// events to happen more than once at a time since the world will be massive".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  gateNumber, gateDayOf, gateLaneOf, gateBaseMinute, isGateDay, gateTimes, gateAt, gameDayAt, gateOrder, gateIndex, gateRoomKey, isGateRoom,
  gateMarksCycleLength, gateSpotLocal, omenRing, GATE_LANES, GATE_LANE_SPAN, GATE_LANE_STAGGER, GATE_LANE_INDEX_STEP, GATE_DAY_MINUTES,
  GATE_OMEN_MINUTE, GATE_RISE_MINUTE, GATE_OPEN_MINUTE, GATE_SEAL_MINUTE, GATE_WRATH_MINUTE, GATE_COLLAPSE_MS, GATE_EVERY_DAYS,
  gateAdmits, gateHolds, GATE_LANES_OPEN, gateLaneOpen,
} from '../../../src/net/gate/gateLaw.js';
import { heraldOmenDue, gateSiteDayOk } from '../../../src/net/gate/gateHerald.js';
import {
  sharedClassicMinutes, wallMsForClassicMinutes, gateReceiptKey, gateLaneKey, gatePixelOk, gateLaneWire, relaySupportsGateLanes,
  validGateIn, validRiteIn, validRiteOut, GATE_LANES_WIRE, GATE_LANE_SPAN_WIRE, GATE_LANES_RELAY_MIN, RELAY_VERSION, WORLD_PIXEL_BOUND,
  gateLanePixelOk, WORLD_WIDE_RELAY_MIN,
} from '../../../src/net/wire.js';
import { CYRODIIL_THEATRE } from '../../../src/systems/wild/cyrodiilZone.js';
import { scanGatePixels, findGateSite, gateRegions, gateSeaPixel, politicClaimed, GATE_TOWN_MIN_PX, GATE_TOWN_MAX_PX } from '../../../src/systems/gate/gateSite.js';
import { scanTheatreGate, findTheatreGateSite, theatreGateAreas } from '../../../src/systems/gate/theatreGateSite.js';
import { createGateLanes, createTheatreGateScans } from '../../../src/scenes/gate/gateLanes.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { bayPlaceRows } from '../../../src/world/worldWide/bayPlaces.js';
import { theatreAt, areaAt, areaName, isBayArea, worldPixelKey, worldPixelOfKey, THEATRE_COUNT, THEATRE_KEYS, BAY_THEATRE } from '../../../src/world/worldWide/worldGrid.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, inBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { LOCATION_TYPES, CLIMATES } from '../../../src/formats/mapsFile.js';
import { spawnsDungeon, WORLD_SALT } from '../../../src/world/spawnedDungeons.js';
import { codeOnly } from '../../codeOnly.mjs';

setTamrielTrace(null); setTamrielFit(null);   // the authored shape and fit: no player's picture in the suite

const src = (p) => codeOnly(readFileSync(new URL('../../../' + p, import.meta.url), 'utf8'));
const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const CLASSIC_MIN_MS = 5000;

// ─── the Bay's lane as it was before WW2, word for word (net/gate/gateLaw.js and net/gate/gateHerald.js at b268ad5b0d) ───
const oldIsGateDay = (day) => Number.isSafeInteger(day) && day >= 0 && day % GATE_EVERY_DAYS === 0;
const oldGameDayAt = (nowMs) => Math.floor(sharedClassicMinutes(nowMs) / GATE_DAY_MINUTES);
function oldGateTimes(day) {
  const base = day * GATE_DAY_MINUTES;
  const at = (minute) => Math.round(wallMsForClassicMinutes(base + minute));
  return { day, omenAt: at(GATE_OMEN_MINUTE), riseAt: at(GATE_RISE_MINUTE), openAt: at(GATE_OPEN_MINUTE), sealAt: at(GATE_SEAL_MINUTE), wrathAt: at(GATE_WRATH_MINUTE) };
}
function oldGateAt(nowMs) {
  let day = oldGameDayAt(nowMs);
  if (oldIsGateDay(day - 1) && nowMs < oldGateTimes(day - 1).wrathAt + GATE_COLLAPSE_MS) return oldGateTimes(day - 1);
  while (!oldIsGateDay(day)) day++;
  return oldGateTimes(day);
}
function oldOmenDue(nowMs, postedDay = -1) {
  const today = oldGameDayAt(nowMs);
  const posted = Number.isSafeInteger(postedDay) && postedDay <= today ? postedDay : -1;
  for (let d = Math.max(0, today); d <= today + GATE_EVERY_DAYS; d++) {
    if (!oldIsGateDay(d) || d <= posted) continue;
    const t = oldGateTimes(d);
    if (t.openAt <= nowMs) continue;
    return { day: d, at: Math.max(nowMs, t.omenAt) };
  }
  return null;
}

test('WW2 the lanes: a lane a theatre, a gate\'s NUMBER its day on the Bay\'s lane and its day plus its lane\'s span beyond it, both ends\' copies of the law equal; a number of no lane the world has is no gate (mutants: the lane\'s span, the lane read, a lane past the last)', () => {
  assert.equal(GATE_LANES, THEATRE_COUNT, 'a lane a theatre');
  assert.equal(GATE_LANES_WIRE, GATE_LANES);
  assert.equal(GATE_LANE_SPAN_WIRE, GATE_LANE_SPAN);
  assert.ok(GATE_LANE_SPAN * GATE_LANES - 1 <= 999_999_999, 'the room law\'s nine digits hold every lane');
  assert.equal(isGateRoom(gateRoomKey(gateNumber(GATE_LANE_SPAN - 1, GATE_LANES - 1))), true, 'the last lane\'s last day a room');
  for (const day of [0, 1, 900, 12_345, GATE_LANE_SPAN - 1]) {
    assert.equal(gateNumber(day), day, 'the Bay\'s lane: the number IS the day');
    assert.equal(gateNumber(day, 0), day);
    for (let lane = 0; lane < GATE_LANES; lane++) {
      const n = gateNumber(day, lane);
      assert.deepEqual([gateDayOf(n), gateLaneOf(n), gateLaneWire(n)], [day, lane, lane]);
      assert.equal(isGateDay(n), day % GATE_EVERY_DAYS === 0);
      assert.equal(gateRoomKey(n), `gate:${n}`, 'a lane\'s gate a room of its own');
    }
  }
  assert.equal(isGateDay(gateNumber(5, GATE_LANES)), false, 'no lane past the last theatre');
  assert.equal(isGateDay(-1), false);
  assert.equal(isGateDay(1.5), false);
});

test('WW2 the Bay\'s lane is the gate it always was: its instants, the gate the clock is about, the herald\'s omen owed and the game day, to the millisecond over three days and every edge (mutants: the stagger on the Bay\'s lane, the day read off the gate)', () => {
  const t0 = oldGateTimes(oldGameDayAt(NOW)).omenAt;
  const instants = [];
  for (let ms = NOW - 86_400_000; ms < NOW + 2 * 86_400_000; ms += 37_000) instants.push(ms);
  for (let d = oldGameDayAt(NOW) - 2; d < oldGameDayAt(NOW) + 3; d++) {
    const t = oldGateTimes(d);
    for (const at of [t.omenAt, t.riseAt, t.openAt, t.sealAt, t.wrathAt, t.wrathAt + GATE_COLLAPSE_MS]) instants.push(at - 1, at, at + 1);
  }
  let checked = 0;
  for (const ms of instants) {
    assert.equal(gameDayAt(ms), oldGameDayAt(ms));
    assert.equal(gameDayAt(ms, 0), oldGameDayAt(ms));
    assert.deepEqual({ ...gateAt(ms) }, oldGateAt(ms), `the gate at ${ms - t0}`);
    assert.deepEqual({ ...gateAt(ms, 0) }, oldGateAt(ms));
    const today = oldGameDayAt(ms);
    for (const posted of [-1, today - 2, today - 1, today, today + 1, gateNumber(today, 1)]) {
      assert.deepEqual(heraldOmenDue(ms, posted), oldOmenDue(ms, posted), `the omen owed at ${ms - t0}, ${posted} posted`);
      assert.deepEqual(heraldOmenDue(ms, posted, 0), oldOmenDue(ms, posted));
    }
    checked++;
  }
  assert.ok(checked > 7000, `${checked} instants`);
  for (let d = 0; d < 400; d++) assert.equal(gateIndex(d), Math.floor(d / GATE_EVERY_DAYS), 'the Bay\'s place in the cycles');
});

test('WW2 THE STAGGER: lane t\'s gate runs GATE_LANE_STAGGER classic minutes (twelve real) behind lane t - 1\'s, so a game day\'s ten gates open across 108 of its 120 real minutes, two or three standing at once; each lane its own today, its own gate the clock is about and its own omen owed, on its own numbers (mutants: no stagger, the lane\'s today the Bay\'s, the herald\'s lane)', () => {
  assert.equal(GATE_LANE_STAGGER * CLASSIC_MIN_MS, 12 * 60_000);
  assert.ok((GATE_LANES - 1) * GATE_LANE_STAGGER < GATE_DAY_MINUTES, 'the last lane opens inside its day');
  const day = oldGameDayAt(NOW);
  for (let lane = 1; lane < GATE_LANES; lane++) {
    const a = gateTimes(gateNumber(day, lane - 1)), b = gateTimes(gateNumber(day, lane));
    for (const k of ['omenAt', 'riseAt', 'openAt', 'sealAt', 'wrathAt']) assert.ok(Math.abs(b[k] - a[k] - 12 * 60_000) <= 1, `lane ${lane} ${k}`);
    assert.equal(gateBaseMinute(gateNumber(day, lane)), day * GATE_DAY_MINUTES + lane * GATE_LANE_STAGGER);
  }
  // each lane's own clock: at every instant its gate is its own lane's, and the Bay's gate shifted by its stagger
  for (let ms = NOW; ms < NOW + 86_400_000; ms += 61_000) {
    for (const lane of [1, 4, 9]) {
      const g = gateAt(ms, lane), shift = lane * GATE_LANE_STAGGER * CLASSIC_MIN_MS;
      assert.equal(gateLaneOf(g.day), lane);
      assert.equal(gateDayOf(g.day), gateAt(ms - shift).day, `lane ${lane} at ${ms - NOW}`);
      assert.equal(gameDayAt(ms, lane), gameDayAt(ms - shift));
      const due = heraldOmenDue(ms, -1, lane), bay = heraldOmenDue(ms - shift, -1);
      assert.deepEqual(due && { day: gateDayOf(due.day), lane: gateLaneOf(due.day), at: due.at - shift }, bay && { day: bay.day, lane, at: Math.max(bay.at, ms - shift) }, `the omen owed on lane ${lane}`);
    }
  }
  // a lane's own post stands for it, and only for it
  const n1 = heraldOmenDue(NOW, -1, 1).day;
  assert.notDeepEqual(heraldOmenDue(NOW, n1, 1)?.day, n1, 'lane 1\'s post spends lane 1\'s omen');
  assert.deepEqual(heraldOmenDue(NOW, n1, 2), heraldOmenDue(NOW, -1, 2), 'and never lane 2\'s');
  // the count at once: the gates standing (omen to wrath) at each instant of a day
  let most = 0;
  for (let ms = NOW; ms < NOW + 86_400_000; ms += 60_000) {
    let up = 0;
    for (let lane = 0; lane < GATE_LANES; lane++) { const t = gateAt(ms, lane); if (ms >= t.omenAt && ms < t.wrathAt) up++; }
    most = Math.max(most, up);
  }
  assert.ok(most >= 2 && most <= 3, `${most} gates at once at the most`);
});

test('WW2 the order of gates across lanes is when they open, never their numbers; the marks\' cycle never puts two gates of one game day, or of two that touch, at one place (mutants: the order by number, the lane step)', () => {
  assert.ok(gateOrder(gateNumber(900, 1), 901) < 0, 'lane 1\'s day 900 opens before the Bay\'s day 901');
  assert.ok(gateNumber(900, 1) > 901, 'whose number is far past it');
  assert.ok(gateOrder(901, gateNumber(900, 1)) > 0);
  assert.ok(gateOrder(gateNumber(900, 2), gateNumber(900, 3)) < 0);
  assert.equal(gateOrder(gateNumber(900, 4), gateNumber(900, 4)), 0);
  const L = gateMarksCycleLength();
  assert.ok(L > (GATE_LANES - 1) * GATE_LANE_INDEX_STEP + 1, 'the lanes\' steps inside one cycle');
  for (let d = 1; d < 500; d++) {
    for (let a = 0; a < GATE_LANES; a++) for (let b = 0; b < GATE_LANES; b++) {
      for (const dd of [0, 1]) {
        if (a === b && dd === 0) continue;
        const ga = gateIndex(gateNumber(d, a)), gb = gateIndex(gateNumber(d - dd, b));
        assert.notEqual(((ga - gb) % L + L) % L, 0, `day ${d} lane ${a} and day ${d - dd} lane ${b}`);
      }
    }
  }
});

test('WW2 the hub\'s records a lane: the Bay\'s keys the ones they always were, a lane past it its own; the hub takes a site word for a gate on its own lane\'s clock (mutants: the Bay\'s key renamed, a lane\'s key the Bay\'s, a site word of the wrong lane)', () => {
  assert.equal(gateReceiptKey('acct-1'), 'gaterc:acct-1');
  assert.equal(gateReceiptKey('acct-1', 0), 'gaterc:acct-1');
  assert.equal(gateReceiptKey('acct-1', 3), 'gaterc:acct-1.3');
  assert.equal(new Set(Array.from({ length: GATE_LANES }, (_, l) => gateReceiptKey('acct-1', l))).size, GATE_LANES);
  for (const k of ['gatefell', 'gatesite', 'herald', 'rite']) {
    assert.equal(gateLaneKey(k), k);
    assert.equal(gateLaneKey(k, 0), k);
    assert.equal(gateLaneKey(k, 7), `${k}:7`);
  }
  for (const lane of [0, 1, 6]) {
    const n = gateAt(NOW, lane).day;
    assert.equal(gateSiteDayOk(n, NOW), true, `lane ${lane}'s gate now`);
    assert.equal(gateSiteDayOk(n + GATE_EVERY_DAYS * 3, NOW), false, 'a day not its now');
  }
  const bayNow = gateAt(NOW).day;
  assert.equal(gateSiteDayOk(gateNumber(bayNow, GATE_LANES), NOW), false, 'a lane the world has not');
});

test('WW2 the wire: a gate\'s pixel the Bay\'s map on the Bay\'s lane, as it always was, and a pixel of the world on a lane past it - the site word, the rite\'s word in and out; the lanes ride a relay that keeps them (mutants: the Bay\'s last column, the world\'s pixel refused, the lanes\' relay)', () => {
  const lane1 = gateNumber(900, 1);
  for (const [d, px, py, ok] of [[900, 0, 0, true], [900, 999, 499, true], [900, 1000, 0, false], [900, -1, 5, false], [900, 5, 500, false],
    [lane1, -1200, 300, true], [lane1, 1800, -700, true], [lane1, WORLD_PIXEL_BOUND, 0, false], [lane1, 0.5, 0, false],
    [lane1, 500, 200, false], [lane1, 999, 499, false], [lane1, 1000, 499, true], [lane1, 999, -1, true]]) {   // AUDIT WW F6: a lane past the Bay never on its map
    assert.equal(gateLanePixelOk(gateLaneOf(d), px, py), ok, `${d} ${px},${py}`);
    const heard = ok && gateLaneOpen(gateLaneOf(d));   // AUDIT WW F2: a lane that does not stand takes no word at all
    assert.equal(gatePixelOk(d, px, py), heard, `${d} ${px},${py}`);
    assert.equal(!!validGateIn({ k: 'site', d, px, py, pl: 'Solitude, Skyrim' }), heard);
    assert.equal(!!validRiteIn({ d, px, py, s: 0, f: 0 }), heard);
    assert.equal(!!validRiteOut({ k: 'cl', d, px, py, at: 5 }), heard);
  }
  // AUDIT WW F2, F3: the lanes that stand - the Bay's; Cyrodiil's never (the open zone stands no gate); a spent word on
  // no lane that stands names no receipt
  assert.ok(GATE_LANES_OPEN.includes(0) && !GATE_LANES_OPEN.includes(CYRODIIL_THEATRE));
  assert.ok(GATE_LANES_OPEN.every((l) => Number.isSafeInteger(l) && l >= 0 && l < GATE_LANES));
  for (const lane of [0, 1, 8, 9, 10, 4000]) {
    const d = gateNumber(900, lane);
    assert.equal(!!validGateIn({ k: 'spent', d }), gateLaneOpen(lane), `spent on lane ${lane}`);
    assert.equal(gateAdmits(d, gateTimes(d).openAt + 1), gateLaneOpen(lane), `admits on lane ${lane}`);
    assert.equal(gateHolds(d, gateTimes(d).openAt + 1), gateLaneOpen(lane), `holds on lane ${lane}`);
  }
  // PIN MOVED (AUDIT TESA II Z2): 256 (world254 on WORLD-WIDE's branch, renumbered past AUDIT FOE-KEEPS's world254 and AUDIT
  // TESA-BIOME's world255), then 260 at the merge with main - and the literal pinned at 256 while main's world256-world259
  // read no lane. One number now, the world-wide relay's (test/net/audittesa2z_worldwide.test.js ties it to its LAW row)
  assert.equal(GATE_LANES_RELAY_MIN, WORLD_WIDE_RELAY_MIN);
  assert.equal(relaySupportsGateLanes(RELAY_VERSION), true, 'this relay keeps them');
  assert.equal(relaySupportsGateLanes(`world${WORLD_WIDE_RELAY_MIN - 1}`), false, 'the relay before the world-wide one keeps no lane');
  assert.equal(relaySupportsGateLanes(`world${WORLD_WIDE_RELAY_MIN}`), true);
  assert.equal(relaySupportsGateLanes(null), false);
});

// ─── the site past the Bay ───────────────────────────────────────────────────────────────────────

/** A world in the maps' shape (test/ui/wb1_gate_omen.test.js's): the open sea west of x=100, a sea coast to x=116, then
 *  three provinces in bands of x - and the locations given; and a LAKE in the second province (the climate's water on
 *  land a province claims - only the water law refuses it). */
const COAST_END = 116;
const inLake = (x, y) => x >= 600 && x < 610 && y >= 300 && y < 306;
function fakeMaps(locations) {
  const regions = [0, 1, 2].map(() => ({ mapTable: [], mapNames: [] }));
  for (const l of locations) {
    regions[l.region].mapTable.push({ mapId: (7 << 20) | (l.py * 1000 + l.px), locationType: l.type });
    regions[l.region].mapNames.push(l.name);
  }
  const regionOfX = (x) => (x < 400 ? 0 : x < 700 ? 1 : 2);
  const politic = (x) => (x < 100 ? 0 : x < COAST_END ? 64 : 128 + regionOfX(x));
  return {
    regionCount: 3,
    getRegion: (r) => regions[r],
    getClimateIndex: (x, y) => (x < COAST_END || inLake(x, y) ? CLIMATES.Ocean : 231),
    getPoliticIndex: politic,
    getRegionIndexAt: (x) => { const pol = politic(x); return pol === 64 ? 31 : pol < 128 ? 0 : pol - 128; },
  };
}
/** The town-driven scan over the Bay's own places, read by the Bay scan's own laws. */
function bayTheatreScan(maps, places, heightAt = () => 255) {
  return scanTheatreGate({
    towns: places.inTheatre(BAY_THEATRE), placeAt: places.at, theatre: BAY_THEATRE,
    inTheatre: (x, y) => x >= 1 && y >= 1 && x < 999 && y < 499,
    areaAt: (x, y) => (politicClaimed(maps.getPoliticIndex(x, y)) ? maps.getRegionIndexAt(x, y) : -1),
    wet: (x, y) => gateSeaPixel(maps.getClimateIndex(x, y), heightAt(x, y)),
  });
}
/** The two scans equal: every list pixel for pixel, each pixel's naming town, every area's draw, and a hundred sites. */
function assertScansEqual(old, scan) {
  assert.deepEqual(theatreGateAreas(scan), gateRegions(old), 'the areas a gate may open in');
  const keys = new Set([...old.byRegion.keys(), ...scan.byArea.keys()]);
  let pixels = 0;
  for (const r of keys) {
    const a = [...(old.byRegion.get(r) ?? [])];
    const b = [...(scan.byArea.get(r) ?? [])].map((k) => { const [x, y] = worldPixelOfKey(k); return y * 1000 + x; });
    assert.deepEqual(b, a, `region ${r}'s list`);
    for (const id of a) {
      const ot = old.towns[old.townAt[id]], nt = scan.towns[/** @type {number} */ (scan.townOf.get(worldPixelKey(id % 1000, Math.floor(id / 1000))))];
      assert.deepEqual([nt?.name, nt?.px, nt?.py], [ot?.name, ot?.px, ot?.py], `the town naming ${id}`);
    }
    pixels += a.length;
  }
  for (let d = 800; d < 900; d++) {
    const a = findGateSite(d, old), b = findTheatreGateSite(d, scan);
    assert.deepEqual(b && [b.day, b.region, b.area, b.theatre, b.px, b.py, b.near, b.place, b.spot, b.ring], a && [a.day, a.region, a.region, BAY_THEATRE, a.px, a.py, a.near, a.place, a.spot, a.ring], `day ${d}'s site`);
  }
  return pixels;
}

test('WW2 THE SAME LAW, TOWN BY TOWN: the theatre scan over the Bay\'s own places finds the Bay scan\'s every list, pixel for pixel, each pixel\'s naming town, and the same hundred sites - so a lane past the Bay stands by the gate\'s own law (mutants: the ring\'s inner bound, the neighbours\' test, the nearest town, the spawned dungeon, the water)', () => {
  const locations = [];
  let n = 0;
  for (let y = 20; y < 480; y += 23) for (let x = 30; x < 980; x += 31) locations.push({ region: x < 400 ? 0 : x < 700 ? 1 : 2, px: x, py: y, type: (n++ % 3 === 0) ? LOCATION_TYPES.TownCity : (n % 3 === 1 ? LOCATION_TYPES.TownHamlet : LOCATION_TYPES.DungeonRuin), name: `Place${n}` });
  locations.push({ region: 0, px: 119, py: 262, type: LOCATION_TYPES.TownVillage, name: 'Coastwatch' });
  locations.push({ region: 0, px: 122, py: 262, type: LOCATION_TYPES.DungeonRuin, name: 'Old Ruin' });
  locations.push({ region: 1, px: 607, py: 308, type: LOCATION_TYPES.TownVillage, name: 'Lakeside' });   // its ring on the lake's shore
  locations.push({ region: 1, px: 503, py: 101, type: LOCATION_TYPES.TownCity, name: 'Twinside' });   // two towns whose rings overlap: the nearest names
  locations.push({ region: 1, px: 509, py: 101, type: LOCATION_TYPES.TownCity, name: 'Farside' });
  const maps = fakeMaps(locations);
  const places = createWorldPlaces();
  places.register('bay', locations.map((l, i) => ({ mapId: (7 << 20) | (l.py * 1000 + l.px), name: l.name, px: l.px, py: l.py, type: l.type, region: l.region, i })));
  const pixels = assertScansEqual(scanGatePixels(maps), bayTheatreScan(maps, places));
  assert.ok(pixels > 5000, `${pixels} pixels`);
});

const ARENA2 = process.env.ARENA2_PATH;
const NO_ARENA2 = (!ARENA2 || !existsSync(join(ARENA2 ?? '', 'MAPS.BSA'))) && 'ARENA2_PATH not set or missing - real-data validation skipped';

test('WW2 (ARENA2) THE SAME LAW ON THE GAME\'S OWN MAP: the theatre scan over the registry\'s Bay places (bayPlaceRows of the game\'s own rows) finds the Bay scan\'s 43 regions\' every pixel and a hundred sites, with WOODS.WLD\'s heights', { skip: NO_ARENA2 }, async () => {
  const bytes = (f) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), f)));
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const heightAt = (x, y) => woods.getHeightMapValue(x, y);
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    if (!maps.getRegion(r)) continue;
    const base = maps.baseLocationCount(r);
    for (let l = 0; l < base; l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); }
  }
  const places = createWorldPlaces();
  places.register('bay', bayPlaceRows(rows));
  const old = scanGatePixels(maps, { heightAt });
  const pixels = assertScansEqual(old, bayTheatreScan(maps, places, heightAt));
  assert.ok(gateRegions(old).length >= 40 && pixels > 50_000, `${gateRegions(old).length} regions, ${pixels} pixels`);
});

/** The authored cities of a province past the Bay, as a provider past it would list them - each a town on its pixel. */
const provinceTowns = (province, from = 50_000) => CITIES.filter((c) => c.province === province).map((c, i) => {
  const [px, py] = pictureToBay(c.at[0], c.at[1]).map(Math.floor);
  return { mapId: from + i, name: c.name, px, py, type: LOCATION_TYPES.TownCity };
}).filter((r) => !inBay(r.px, r.py));

test('WW2 a theatre past the Bay: its gate\'s ground the law\'s - its own theatre\'s land, no place on a pixel or beside it, a town two to four pixels off naming it, no spawned dungeon - drawn by its own lane\'s number, its site a province\'s district and town, no Bay region (mutants: another theatre\'s pixel, the lane\'s bag, the region past the Bay)', () => {
  const skyrim = THEATRE_KEYS.indexOf('Skyrim');
  const towns = provinceTowns('Skyrim');
  assert.ok(towns.length >= 5, `${towns.length} towns`);
  const ruin = { mapId: 59_999, name: 'Old Barrow', px: towns[0].px + 3, py: towns[0].py, type: LOCATION_TYPES.DungeonRuin };
  // and a town two pixels inside the province's border, south of Falkreath - its ring reaches the next theatre's land
  const falk = towns.find((t) => t.name === 'Falkreath');
  let edge = falk.py;
  while (theatreAt(falk.px, edge + 1) === skyrim) edge++;
  const marcher = { mapId: 59_998, name: 'Marcher', px: falk.px, py: edge - 1, type: LOCATION_TYPES.TownVillage };
  assert.ok(edge - falk.py > 8, 'clear of Falkreath\'s own ring');
  const places = createWorldPlaces();
  places.register('beyond', [...towns, ruin, marcher]);
  const scan = scanTheatreGate({
    towns: places.inTheatre(skyrim), placeAt: places.at, theatre: skyrim, wet: () => false,
    inTheatre: (x, y) => theatreAt(x, y) === skyrim, areaAt: (x, y) => areaAt(x, y, () => -1),
  });
  assert.equal(scan.towns.length, towns.length + 1, 'the ruin no town');
  let checked = 0;
  for (const [a, list] of scan.byArea) {
    assert.equal(isBayArea(a), false);
    for (const k of list) {
      const [x, y] = worldPixelOfKey(k);
      assert.equal(theatreAt(x, y), skyrim);
      assert.equal(areaAt(x, y, () => -1), a);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.equal(places.at(x + dx, y + dy), null, 'no place on it or beside it');
      assert.ok(!spawnsDungeon(WORLD_SALT, x, y));
      const ds = scan.towns.map((t) => Math.max(Math.abs(t.px - x), Math.abs(t.py - y)));
      const d = Math.min(...ds);
      assert.ok(d >= GATE_TOWN_MIN_PX && d <= GATE_TOWN_MAX_PX);
      assert.equal(scan.townOf.get(k), ds.indexOf(d), 'the nearest town, the first listed on a tie');
      checked++;
    }
  }
  assert.ok(checked > 100, `${checked} pixels`);
  const areas = theatreGateAreas(scan);
  assert.ok(areas.length >= 2, `${areas.length} districts with ground`);
  const sites = new Set();
  for (let d = 900; d < 960; d++) {
    const n = gateNumber(d, skyrim), s = findTheatreGateSite(n, scan);
    assert.ok(s);
    assert.deepEqual([s.day, s.region, s.theatre], [n, null, skyrim]);
    assert.ok(areas.includes(s.area));
    assert.ok([...(scan.byArea.get(s.area) ?? [])].includes(worldPixelKey(s.px, s.py)));
    assert.equal(s.place, `${s.town.name}, ${areaName(s.area)}`);
    assert.equal(areaName(s.area), 'Skyrim');
    assert.deepEqual(s.spot, gateSpotLocal(n));
    assert.deepEqual(s.ring, omenRing(n, s.px, s.py, s.spot));
    assert.deepEqual(findTheatreGateSite(n, scan), s, 'every client the same');
    sites.add(s.area);
  }
  assert.ok(sites.size >= 2, 'the lane\'s bag walks its districts');
});

test('WW2 the theatres\' scans: a lane past the Bay for each theatre whose listed towns give a gate ground, made once a registry generation and once a picture; the Bay\'s lane none of theirs (mutants: the generation, the picture)', () => {
  const skyrim = THEATRE_KEYS.indexOf('Skyrim'), hammerfell = THEATRE_KEYS.indexOf('Hammerfell');
  const places = createWorldPlaces();
  places.register('bay', [{ mapId: 1, name: 'Daggerfall', px: 210, py: 340, type: LOCATION_TYPES.TownCity, region: 17 }]);
  let land = 0;
  const scans = createTheatreGateScans({ places, wet: () => false, land: () => land, open: () => true });   // PIN MOVED (AUDIT TESA II P7): the lanes opened, as the host's gates test opens one
  assert.deepEqual(scans.theatres(), [], 'nothing past the Bay: no lane past it');
  assert.equal(scans.siteOf(gateNumber(900, 0)), null, 'the Bay\'s lane is the Bay scan\'s');
  places.register('beyond', provinceTowns('Skyrim'));
  assert.deepEqual(scans.theatres(), [skyrim]);
  const a = scans.scanOf(skyrim);
  assert.equal(scans.scanOf(skyrim), a, 'made once');
  const site = scans.siteOf(gateNumber(900, skyrim));
  assert.deepEqual(site, findTheatreGateSite(gateNumber(900, skyrim), a));
  land = 1;
  assert.notEqual(scans.scanOf(skyrim), a, 'a new picture, a new scan');
  places.register('beyond2', provinceTowns('Hammerfell', 60_000));
  assert.deepEqual(scans.theatres(), [skyrim, hammerfell].sort((x, y) => x - y), 'a new generation, its theatres again');
  places.drop('beyond');
  assert.deepEqual(scans.theatres(), [hammerfell]);
  assert.equal(scans.siteOf(gateNumber(900, skyrim)), null, 'a theatre with no ground draws no gate');
});

// ─── the host's gates, a lane each ───────────────────────────────────────────────────────────────

const siteAt = (n, px, py, place) => { const spot = gateSpotLocal(n); return { day: n, px, py, spot, ring: omenRing(n, px, py, spot), near: place, place }; };

test('WW2 the host\'s gates: one omen a lane, each saying its own lines with its own gate\'s number; the Bay\'s gate what frame/current/mapMark always answered; the nearest gate\'s stone, circle and cage; every lane\'s ring and row; the lanes past the Bay only while the relay keeps them (mutants: the lanes ungated, the nearest by lane, a lane\'s line on the Bay\'s card)', () => {
  const day = oldGameDayAt(NOW) + 1;
  const now = { t: gateTimes(gateNumber(day, 0)).openAt + 60_000 };   // the Bay's gate open a minute; lane 1's in its omen
  const bayAt = [300, 200], skyAt = [-1500, -900];
  const said = [];
  let ok = true, here = { x: bayAt[0], y: bayAt[1] };
  const gates = createGateLanes({
    omen: { now: () => now.t, say: (text, n) => said.push(n), localTime: () => '8:00 PM' },
    bayGateSite: (n) => siteAt(n, bayAt[0], bayAt[1], 'Daggerfall, Daggerfall'),
    scans: { theatres: () => [1], siteOf: (n) => (gateLaneOf(n) === 1 ? siteAt(n, skyAt[0], skyAt[1], 'Solitude, Skyrim') : null) },
    lanesOk: () => ok, here: () => here, open: () => true,   // a lane opened (AUDIT WW F2: none past the Bay stands yet - below)
  });
  const bayN = gateNumber(day, 0), skyN = gateNumber(day, 1);
  const c = gates.frame();
  assert.equal(c.t.day, bayN, 'the frame answers the Bay\'s');
  assert.equal(gates.current().t.day, bayN);
  assert.equal(gates.mapMark().day, bayN);
  assert.deepEqual(gates.lanes(), [0, 1]);
  assert.deepEqual(gates.currents().map((x) => [x.lane, x.c.t.day, x.c.phase]), [[0, bayN, c.phase], [1, skyN, 'omen']]);
  assert.deepEqual(gates.mapMarks().map((m) => m.day), [skyN], 'every ring past the Bay');
  assert.ok(said.includes(bayN) && said.includes(skyN), 'each lane said its own lines');
  assert.ok(said.every((n) => n === bayN || n === skyN));
  assert.deepEqual([gates.siteOf(skyN).place, gates.siteOf(bayN).place], ['Solitude, Skyrim', 'Daggerfall, Daggerfall']);
  assert.deepEqual([gates.markOf(skyN)?.day, gates.markOf(bayN)?.day], [skyN, bayN]);
  assert.equal(gates.siteOf(gateNumber(day, 2)), null);
  // the nearest
  assert.equal(gates.nearCurrent().t.day, bayN, 'at the Bay\'s, the Bay\'s');
  here = { x: skyAt[0] + 3, y: skyAt[1] };
  assert.equal(gates.nearCurrent().t.day, skyN, 'in Skyrim, Skyrim\'s');
  assert.equal(gates.cageSite().day, skyN);
  here = null;
  assert.equal(gates.nearCurrent().t.day, bayN, 'nowhere: the Bay\'s');
  // the relay that does not keep the lanes: the Bay's alone
  ok = false;
  assert.deepEqual(gates.lanes(), [0]);
  assert.deepEqual(gates.currents().map((x) => x.lane), [0]);
  assert.deepEqual(gates.mapMarks(), []);
  here = { x: skyAt[0], y: skyAt[1] };
  assert.equal(gates.nearCurrent().t.day, bayN);
  const none = createGateLanes({ omen: { now: () => now.t, say: () => {} }, bayGateSite: (n) => siteAt(n, 1, 1, 'X'), scans: null, lanesOk: () => true, here: () => null });
  assert.deepEqual(none.lanes(), [0], 'no scans, no lanes past the Bay');
  // AUDIT WW F2: the lanes that stand - a theatre with ground on a lane the relay does not admit stands no gate
  const shut = createGateLanes({ omen: { now: () => now.t, say: () => {} }, bayGateSite: (n) => siteAt(n, 1, 1, 'X'), scans: { theatres: () => [1, 9], siteOf: () => null }, lanesOk: () => true, here: () => null });
  assert.deepEqual(shut.lanes(), [0, ...[1, 9].filter(gateLaneOpen)], 'the open lanes alone');
});

// ─── the wiring ──────────────────────────────────────────────────────────────────────────────────

test('WW2 the wiring: the world host stands the lanes off the registry (its gate lanes, its theatres\' scans, the relay\'s word on both links), says each lane\'s site past the Bay, and keeps a seat\'s gate the Bay\'s; the client says a site a gate, and none past the Bay to a relay that would close on it; the hub keeps a fall, a site, a herald and a rite a lane and hands a receipt a lane; the account service keeps a gate past the Bay out of a seat (mutants: the lanes\' links, the site said per gate, the hub\'s lane keys, the seat\'s lane)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /const theatreGates = params\.has\('online'\) \? createTheatreGateScans\(\{\s*places: worldPlaces,/);
  assert.match(world, /const gateOmen = params\.has\('online'\) \? createGateLanes\(\{/);
  assert.match(world, /scans: theatreGates, lanesOk: \(\) => !!online\?\.gateLanesOk && !!socialLink\(\)\?\.gateLanesOk, here: \(\) => playerTravelPixel\(\)/);
  assert.match(world, /for \(const \{ lane, c \} of gateOmen\?\.currents\(\) \?\? \[\]\) if \(lane && c\.site\) socialLink\(\)\?\.sendGateSite\?\.\(c\.site\.day, c\.site\.px, c\.site\.py, c\.site\.place\)/);
  assert.match(world, /gateLaneOf\(c\.d\) === 0 \? findGateSite\(c\.d, _gateScan\) : null/);
  const online = src('src/net/online.js');
  assert.match(online, /this\.gateLanesOk = relaySupportsGateLanes\(relayV\)/);
  assert.match(online, /if \(gateLaneWire\(day\) !== 0 && !this\.gateLanesOk\) return false;/);
  assert.match(online, /if \(said\.has\(day\)\) return true;/);
  const relay = src('server/src/index.js');
  for (const k of ['gatefell', 'gatesite', 'herald']) assert.match(relay, new RegExp(`gateLaneKey\\('${k}', lane\\)`), `the hub's ${k} a lane`);
  assert.match(relay, /gateLaneKey\(RITE_KEY, lane\)/);
  assert.match(relay, /for \(const lane of GATE_LANES_OPEN\) await this\._heraldLaneBeat\(h, lane, now\);/);
  assert.match(relay, /const keys = GATE_LANES_OPEN\.map\(\(lane\) => gateReceiptKey\(sub, lane\)\);/);
  assert.match(relay, /const k = gateReceiptKey\(sub, gateLaneOf\(day\)\);/);
  assert.match(src('server-account/src/accounts.js'), /c\.x !== 'rite' && gateLaneOf\(c\.d\) === 0 && seatRegionOk\(region\) \? region : null/);
  assert.match(src('server-account/src/seatInfluence.js'), /if \(gateLaneOf\(day\) !== 0\) return \{ counted: false, why: 'beyond-the-bay' \};/);
});
