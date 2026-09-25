// WB1 (2026-09-25, Mac: "at any point in the world, on the timer, a large area would be shown on the map, also in
// chat"): THE OBLIVION GATE'S OMEN - the schedule, the room's key, the site, the chat's lines, the maps' ring and the
// compass's mark. Design: bible/11-Multiplayer/World-Bosses.md sections 1-2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  gateTimes, gateAt, gatePhase, gameDayAt, isGateDay, gateCountdown, countdownText, gateStands, gateMarked,
  gateRoomKey, isGateRoom, gateDayOfRoom, gateAdmits, gateHolds, gateHash, gateRoll, pickGateRegion, pickGatePixel,
  gateSpotLocal, omenRing, gateBossOf, GATE_BOSSES, PIXEL_M, GATE_DAY_MINUTES, GATE_SPOT_SPREAD_M, OMEN_RING_PIXELS,
  GATE_RISE_MS, GATE_COLLAPSE_MS, GATE_EVERY_DAYS, omenLine, riseLine, openLine, sealLine, wrathLine,
} from '../src/net/gateLaw.js';
import { scanGatePixels, findGateSite, gateRegions, politicClaimed, GATE_TOWN_MIN_PX, GATE_TOWN_MAX_PX, GATE_TOWN_TYPES } from '../src/systems/gateSite.js';
import { createGateOmen, insideGateRing, gateSceneXZ } from '../src/systems/gateOmen.js';
import { readGateMark, gateMarkKey, gateRingKey, gateRingTexels, GATE_RING_BAND } from '../src/ui/gateMapMark.js';
import { paintGateRing } from '../src/ui/inkMap.js';
import { hash32, spawnsDungeon, WORLD_SALT } from '../src/world/spawnedDungeons.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const iso = (ms) => new Date(ms).toISOString();
const MIN = 5000;   // a classic minute, real ms, online

test('WB1 the schedule: the omen 17:00, risen 19:00, open 20:00-22:00, the wrath at midnight - HH:32:30 UTC every even hour', () => {
  // the first gate day after the online epoch (2026-09-14T00:00Z is game 13:30 of day 363)
  const t = gateTimes(363);
  assert.equal(iso(t.omenAt), '2026-09-14T00:17:30.000Z');
  assert.equal(iso(t.riseAt), '2026-09-14T00:27:30.000Z');
  assert.equal(iso(t.openAt), '2026-09-14T00:32:30.000Z');
  assert.equal(iso(t.sealAt), '2026-09-14T00:42:30.000Z');
  assert.equal(iso(t.wrathAt), '2026-09-14T00:52:30.000Z');
  assert.equal(iso(gateTimes(364).openAt), '2026-09-14T02:32:30.000Z', 'a game day later is two real hours later');
  // the lengths the design names, in real time
  assert.equal(t.openAt - t.omenAt, 15 * 60_000, 'the omen fifteen minutes before');
  assert.equal(t.openAt - t.riseAt, 5 * 60_000, 'the gate stands five minutes sealed');
  assert.equal(t.sealAt - t.openAt, 10 * 60_000, 'open for ten');
  assert.equal(t.wrathAt - t.openAt, 20 * 60_000, 'and the wrath twenty after the opening');
  for (const v of Object.values(t)) assert.ok(Number.isSafeInteger(v), 'whole milliseconds');
  // the constants other modules own, pinned equal (not imported: the law is the relay's, its graph stays flat)
  assert.equal(GATE_DAY_MINUTES, MINUTES_PER_DAY);
  assert.equal(PIXEL_M, TERRAIN_SIZE);
  assert.equal(GATE_EVERY_DAYS, 1);
  assert.ok(isGateDay(363) && isGateDay(0) && !isGateDay(-1) && !isGateDay(1.5));
});

test('WB1 gateAt: today\'s gate from midnight, yesterday\'s while it is still sinking', () => {
  const t = gateTimes(500);
  assert.equal(gateAt(t.omenAt - 3600_000).day, 500, 'before the omen: today\'s gate is upcoming');
  assert.equal(gateAt(t.openAt).day, 500);
  assert.equal(gateAt(t.wrathAt - 1).day, 500);
  assert.equal(gameDayAt(t.wrathAt), 501, 'the wrath is the next day\'s midnight');
  assert.equal(gateAt(t.wrathAt + GATE_COLLAPSE_MS - 1).day, 500, 'still sinking: still that gate');
  assert.equal(gateAt(t.wrathAt + GATE_COLLAPSE_MS).day, 501, 'gone: the next day\'s');
});

test('WB1 gatePhase: every boundary, and a fall ends it early', () => {
  const t = gateTimes(400);
  const at = (ms, fell) => gatePhase(t, ms, fell);
  assert.equal(at(t.omenAt - 1), 'quiet');
  assert.equal(at(t.omenAt), 'omen');
  assert.equal(at(t.riseAt), 'rising');
  assert.equal(at(t.riseAt + GATE_RISE_MS - 1), 'rising');
  assert.equal(at(t.riseAt + GATE_RISE_MS), 'sealed');
  assert.equal(at(t.openAt - 1), 'sealed');
  assert.equal(at(t.openAt), 'open');
  assert.equal(at(t.sealAt - 1), 'open');
  assert.equal(at(t.sealAt), 'closed');
  assert.equal(at(t.wrathAt), 'collapsing');
  assert.equal(at(t.wrathAt + GATE_COLLAPSE_MS - 1), 'collapsing');
  assert.equal(at(t.wrathAt + GATE_COLLAPSE_MS), 'gone');
  const fell = t.openAt + 5 * 60_000;
  assert.equal(at(fell - 1, fell), 'open');
  assert.equal(at(fell, fell), 'collapsing', 'the boss fell: the gate sinks then');
  assert.equal(at(fell + GATE_COLLAPSE_MS, fell), 'gone');
  assert.equal(at(t.openAt, t.omenAt), 'open', 'a fall before the opening is no fall');
  assert.equal(gatePhase(null, t.openAt), 'quiet');
  // what stands and what is marked
  assert.deepEqual(['quiet', 'omen', 'rising', 'sealed', 'open', 'closed', 'collapsing', 'gone'].map(gateStands), [false, false, true, true, true, true, true, false]);
  assert.deepEqual(['quiet', 'omen', 'rising', 'sealed', 'open', 'closed', 'collapsing', 'gone'].map(gateMarked), [false, true, true, true, true, true, true, false]);
});

test('WB1 the countdown: to the opening while sealed, to the seal while open, rounded UP', () => {
  const t = gateTimes(410);
  assert.deepEqual(gateCountdown(t, t.riseAt + 30_000), { to: 'open', ms: t.openAt - t.riseAt - 30_000 });
  assert.deepEqual(gateCountdown(t, t.openAt + 1000), { to: 'seal', ms: t.sealAt - t.openAt - 1000 });
  assert.equal(gateCountdown(t, t.sealAt), null);
  assert.equal(countdownText(247_000), '4:07');
  assert.equal(countdownText(9_000), '0:09');
  assert.equal(countdownText(500), '0:01', 'half a second left reads a second, never 0:00');
  assert.equal(countdownText(0), '0:00');
  assert.equal(countdownText(-5), '0:00');
  assert.equal(countdownText(NaN), '0:00');
});

test('WB1 the room: gate:<day>, exactly the keys the clock mints, admitted open-to-seal and held to the wrath', () => {
  assert.equal(gateRoomKey(502), 'gate:502');
  for (const k of ['gate:502', 'gate:0', 'gate:123456789']) assert.ok(isGateRoom(k), k);
  for (const k of ['gate:', 'gate:0502', 'gate:-1', 'gate:1234567890', 'gate:1.5', 'Gate:5', 'gate:5 ', 'dungeon:m5', null]) assert.ok(!isGateRoom(k), String(k));
  assert.equal(gateDayOfRoom('gate:502'), 502);
  assert.equal(gateDayOfRoom('world:1,2'), null);
  const t = gateTimes(502);
  assert.equal(gateAdmits(502, t.openAt - 1), false);
  assert.equal(gateAdmits(502, t.openAt), true);
  assert.equal(gateAdmits(502, t.sealAt - 1), true);
  assert.equal(gateAdmits(502, t.sealAt), false, 'sealed: no one else gets in');
  assert.equal(gateHolds(502, t.sealAt), true, 'whoever is in stays in');
  assert.equal(gateHolds(502, t.wrathAt + GATE_COLLAPSE_MS - 1), true);
  assert.equal(gateHolds(502, t.wrathAt + GATE_COLLAPSE_MS), false);
});

test('WB1 the rolls: the spawned dungeons\' own mix, the region never the day before\'s, the spot and the ring', () => {
  for (const ns of [[1], [0x6a7e, 363, 1], [4294967295, 2, 3, 4], [7, 0, 999, 499]]) assert.equal(gateHash(...ns), hash32(...ns), 'one mix for both rolls');
  const regions = [1, 5, 9, 17, 23, 30, 44];
  let last = null;
  for (let day = 300; day < 700; day++) {
    const r = pickGateRegion(day, regions);
    assert.ok(regions.includes(r));
    assert.notEqual(r, last, `day ${day} repeats the day before's province`);
    assert.equal(pickGateRegion(day, regions), r, 'deterministic');
    last = r;
  }
  // THE BAG: every province takes one gate a round, in the round's shuffled order
  for (let round = 40; round < 70; round++) {
    const seen = new Set();
    for (let i = 0; i < regions.length; i++) seen.add(pickGateRegion(round * regions.length + i, regions));
    assert.equal(seen.size, regions.length, `round ${round} visits every province once`);
  }
  assert.deepEqual([10, 11, 12, 13].map((d) => pickGateRegion(d, [3, 8])), [3, 8, 3, 8], 'two provinces alternate');
  assert.equal(pickGateRegion(5, [42]), 42, 'one province: it is that one');
  assert.equal(pickGateRegion(5, []), null);
  assert.equal(pickGatePixel(5, Int32Array.from([10, 20, 30])), [10, 20, 30][gateRoll(5, 2) % 3]);
  assert.equal(pickGatePixel(5, []), null);
  for (let day = 0; day < 300; day++) {
    const [x, z] = gateSpotLocal(day);
    assert.ok(Math.hypot(x - PIXEL_M / 2, z - PIXEL_M / 2) <= GATE_SPOT_SPREAD_M + 1e-9, 'within the spread of the centre');
    const ring = omenRing(day, 400, 200, [x, z]);
    assert.ok(Math.hypot(ring.gx - ring.cx, ring.gy - ring.cy) < ring.r, 'the gate stands inside its ring');
    assert.equal(ring.r, OMEN_RING_PIXELS);
    assert.ok(ring.gx >= 400 && ring.gx <= 401 && ring.gy >= 200 && ring.gy <= 201, 'the gate is in its own pixel');
  }
  // north is up the map: a spot at the pixel's northern edge is at the pixel's top row (y runs south)
  assert.equal(omenRing(1, 10, 20, [0, PIXEL_M]).gy, 20);
  assert.equal(omenRing(1, 10, 20, [0, 0]).gy, 21);
  assert.equal(gateBossOf(502), GATE_BOSSES[0]);
});

/** A world in the maps' shape: 1000 x 500 - the open sea west of x=100 (politic 0), then a band of SEA COAST to x=116
 *  (water, but politic 64: High Rock's coast, a value the politic test believes - only the climate says it is sea),
 *  then three provinces in bands of x - and the locations given. */
const COAST_END = 116;
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
    getClimateIndex: (x) => (x < COAST_END ? CLIMATES.Ocean : 231),
    getPoliticIndex: politic,
    getRegionIndexAt: (x) => { const pol = politic(x); return pol === 64 ? 31 : pol < 128 ? 0 : pol - 128; },   // MapsFile's own bands
  };
}

test('WB1 the site: land, no location beside it, a town two to four pixels off, no spawned dungeon', () => {
  const locations = [];
  let n = 0;
  for (let y = 20; y < 480; y += 23) for (let x = 30; x < 980; x += 31) locations.push({ region: x < 400 ? 0 : x < 700 ? 1 : 2, px: x, py: y, type: (n++ % 3 === 0) ? LOCATION_TYPES.TownCity : LOCATION_TYPES.DungeonRuin, name: `Place${n}` });
  // a town on the coast, whose ring reaches the sea coast's water (politic 64 - only the climate refuses it), and a
  // ruin three pixels from it, whose eight neighbours all lie in that ring (only the location mask refuses them)
  locations.push({ region: 0, px: 119, py: 262, type: LOCATION_TYPES.TownVillage, name: 'Coastwatch' });
  locations.push({ region: 0, px: 122, py: 262, type: LOCATION_TYPES.DungeonRuin, name: 'Old Ruin' });
  const maps = fakeMaps(locations);
  const scan = scanGatePixels(maps);
  const at = new Set(locations.map((l) => l.py * 1000 + l.px));
  const towns = locations.filter((l) => GATE_TOWN_TYPES.includes(l.type));
  let checked = 0;
  for (const [, pixels] of scan.byRegion) {
    for (const p of pixels) {
      const x = p % 1000, y = Math.floor(p / 1000);
      assert.ok(maps.getClimateIndex(x, y) !== CLIMATES.Ocean, `never the sea (${x},${y})`);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.ok(!at.has((y + dy) * 1000 + x + dx), 'no location on it or beside it');
      assert.ok(!spawnsDungeon(WORLD_SALT, x, y), 'no spawned dungeon');
      const d = Math.min(...towns.map((t) => Math.max(Math.abs(t.px - x), Math.abs(t.py - y))));
      assert.ok(d >= GATE_TOWN_MIN_PX && d <= GATE_TOWN_MAX_PX, `a town ${d} off`);
      const town = scan.towns[scan.townAt[p]];
      assert.equal(Math.max(Math.abs(town.px - x), Math.abs(town.py - y)), d, 'the named town is the nearest');
      checked++;
    }
  }
  assert.ok(checked > 1000, `the scan found ground (${checked})`);
  // the sharpened cases are live: the coast town's ring offers LAND east of the ruin's mask, and none of its water
  const coast = scan.byRegion.get(0).filter((p) => Math.abs(p % 1000 - 119) <= 4 && Math.abs(Math.floor(p / 1000) - 262) <= 4);
  assert.ok(coast.length > 0 && coast.every((p) => p % 1000 >= COAST_END), 'the coast town is reached from land alone');
  assert.deepEqual(gateRegions(scan), [0, 1, 2]);
  const site = findGateSite(777, scan);
  assert.deepEqual(findGateSite(777, scan), site, 'every client finds the same site');
  assert.ok(site.town && site.place === `${site.town.name}, ${site.regionName}` && site.near === site.town.name);
  assert.equal(scan.byRegion.get(site.region).includes(site.py * 1000 + site.px), true);
  // the politic bands the scan believes
  assert.ok(politicClaimed(64) && politicClaimed(128) && politicClaimed(189) && politicClaimed(233));
  assert.ok(!politicClaimed(0) && !politicClaimed(127) && !politicClaimed(190) && !politicClaimed(255));
});

/** A clock the test turns, and a chat the omen speaks into. */
function omenOver(day, site = { place: 'Copperham, Wrothgarian Mountains', near: 'Copperham', px: 400, py: 200, spot: [409.6, 409.6], ring: { cx: 400.3, cy: 200.6, r: 2 } }) {
  const t = gateTimes(day);
  const clock = { now: t.omenAt - 60_000 };
  const lines = [];
  let fell = null;
  const omen = createGateOmen({ now: () => clock.now, site: () => site, say: (s) => lines.push(s), localTime: (m) => `L${m}`, fellAt: () => fell });
  return { t, clock, lines, omen, fall: (at) => { fell = at; } };
}

test('WB1 the chat: each moment\'s line ONCE, in order, and a late arrival hears where the gate stands now', () => {
  const { t, clock, lines, omen } = omenOver(600);
  for (let ms = clock.now; ms <= t.wrathAt + GATE_COLLAPSE_MS + 5000; ms += 1000) { clock.now = ms; omen.frame(); }
  assert.equal(lines.length, 5, lines.join('\n'));
  assert.equal(lines[0], omenLine({ place: 'Copperham, Wrothgarian Mountains', at: `L${600 * 1440 + 1200}` }));
  assert.match(lines[0], /^The sky burns over the wilds near Copperham, Wrothgarian Mountains\. An Oblivion Gate opens there at 20:00 \(L\d+ your time\)/);
  assert.equal(lines[1], riseLine({ near: 'Copperham', left: '5:00' }));
  assert.equal(lines[2], openLine({ near: 'Copperham', at: `L${600 * 1440 + 1320}` }));
  assert.equal(lines[3], sealLine({ near: 'Copperham' }));
  assert.equal(lines[4], wrathLine({ near: 'Copperham', boss: 'Valkynaz Ruhn' }));
  // a player arriving 90 s into the sealed wait hears the rise line with what is LEFT, and nothing before it
  const late = omenOver(601);
  late.clock.now = late.t.riseAt + GATE_RISE_MS + 90_000;
  late.omen.frame(); late.omen.frame();
  assert.deepEqual(late.lines, [riseLine({ near: 'Copperham', left: countdownText(late.t.openAt - late.clock.now) })]);
});

test('WB1 the chat: a fallen boss\'s gate says no wrath, and a host with no map data says nothing at all', () => {
  const { t, clock, lines, omen, fall } = omenOver(602);
  clock.now = t.openAt + 1000; omen.frame();
  fall(t.openAt + 60_000);
  for (let ms = t.openAt + 60_000; ms <= t.openAt + 60_000 + GATE_COLLAPSE_MS + 1000; ms += 500) { clock.now = ms; omen.frame(); }
  assert.deepEqual(lines, [openLine({ near: 'Copperham', at: `L${602 * 1440 + 1320}` })], 'the fall is the relay\'s line to say (WB3)');
  const blind = createGateOmen({ now: () => gateTimes(603).openAt, site: () => null, say: () => assert.fail('no site, no line') });
  assert.equal(blind.frame().phase, 'open');
  assert.equal(blind.mapMark(), null);
  assert.equal(blind.standing(), null);
});

test('WB1 the map\'s mark and the compass: the ring while marked, its words counting, the gate while it stands', () => {
  const { t, clock, omen } = omenOver(604);
  clock.now = t.omenAt - 1; omen.frame();
  assert.equal(omen.mapMark(), null, 'quiet: no ring');
  clock.now = t.omenAt + 1000; omen.frame();
  const m = omen.mapMark();
  assert.deepEqual({ cx: m.cx, cy: m.cy, r: m.r, day: m.day }, { cx: 400.3, cy: 200.6, r: 2, day: 604 });
  assert.equal(m.label, `Oblivion Gate - opens in ${countdownText(t.openAt - clock.now)}`);
  assert.equal(omen.standing(), null, 'the omen marks the land before the gate stands on it');
  clock.now = t.openAt + 2000; omen.frame();
  assert.match(omen.mapMark().label, /^Oblivion Gate - seals in 9:58$/);
  assert.deepEqual(omen.standing(), { day: 604, px: 400, py: 200, spot: [409.6, 409.6], phase: 'open' });
  // the compass: inside the ring (with a pixel's slack), and the spot added to the pixel's corner, north +z
  assert.ok(insideGateRing(m, 400, 200) && insideGateRing(m, 402, 202) && !insideGateRing(m, 404, 200));
  assert.deepEqual(gateSceneXZ({ spot: [10, 20] }, [100, 5, -300]), [110, -280]);
});

test('WB1 the maps\' reading: a bad mark is none, the held map repaints on the words, the page on the ring alone', () => {
  const size = { width: 1000, height: 500 };
  assert.equal(readGateMark(undefined, size), null);
  assert.equal(readGateMark(() => { throw new Error('x'); }, size), null);
  assert.equal(readGateMark(() => ({ cx: NaN, cy: 1, r: 2 }), size), null);
  assert.equal(readGateMark(() => ({ cx: 1, cy: 1, r: 0 }), size), null);
  assert.equal(readGateMark(() => ({ cx: 2000, cy: 1, r: 2 }), size), null, 'off the map');
  const a = readGateMark(() => ({ day: 5, cx: 10.5, cy: 20.25, r: 2, label: 'Oblivion Gate - opens in 4:00', phase: 'sealed' }), size);
  const b = { ...a, label: 'Oblivion Gate - opens in 3:59' };
  assert.notEqual(gateMarkKey(a), gateMarkKey(b), 'the held map shows the countdown');
  assert.equal(gateRingKey(a), gateRingKey(b), 'the classic page draws no words and does not rebuild for them');
  const texels = gateRingTexels(a, 0, 0, 320, 160);
  assert.ok(texels.length >= 8, `a ring, not a dot (${texels.length})`);
  for (const [x, y] of texels) {
    const d = Math.hypot(x + 0.5 - a.cx, y + 0.5 - a.cy);
    assert.ok(d <= a.r && d >= a.r - GATE_RING_BAND, 'on the edge band');
  }
  assert.deepEqual(gateRingTexels(a, 100, 100, 320, 160), [], 'a page that does not hold it draws none');
});

test('WB1 the ink: the ring in map pixels, never under ten paper pixels, with its words over its top', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...args) => calls.push([k, ...args])), set: (o, k, v) => { o[k] = v; return true; } });
  paintGateRing(ctx, { ox: 0, oy: 0, scale: 12 }, { cx: 10, cy: 5, r: 2, label: 'Oblivion Gate - opens in 1:00' }, 0.5);
  const arcs = calls.filter(([k]) => k === 'arc');
  assert.deepEqual(arcs[0].slice(1, 4), [120, 60, 24], 'the area: two map pixels at twelve paper pixels each');
  assert.ok(calls.some(([k, text]) => k === 'fillText' && text === 'Oblivion Gate - opens in 1:00'));
  calls.length = 0;
  paintGateRing(ctx, { ox: 0, oy: 0, scale: 1 }, { cx: 10, cy: 5, r: 2 }, 0);
  assert.equal(calls.find(([k]) => k === 'arc')[3], 10, 'the whole bay on the sheet: still findable');
});

test('WB1 the seams: online alone, the omen before the dead return, both maps handed the ring, the compass its mark', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /const gateOmen = params\.has\('online'\) \? createGateOmen\(/, 'offline there is no gate');
  const frame = world.slice(world.indexOf('const onlineFrame = (now, dt) => {'));
  const dead = frame.indexOf('if (townTalk.overlay instanceof DeathScreen');
  assert.ok(frame.indexOf('gateFrame();') > 0 && frame.indexOf('gateFrame();') < dead, 'the omen speaks to the dead too');
  assert.match(world, /gate: \(\) => gateOmen\?\.mapMark\(\) \?\? null,/);
  assert.match(world, /gate: gateCompassMark\(\),/);
  assert.match(world, /now: \(\) => Date\.now\(\) \+ _sharedOffsetMs,/, 'the relay\'s clock, as the sky reads it');
  assert.match(world, /say: \(text\) => chatNotice\(text\),/, 'a line on every tab - the gate happened to the whole game');
  const hud = read('src/ui/hud.js');
  assert.match(hud, /gate: gate \?\? null,/);
  const ehud = read('src/ui/enhancedHud.js');
  assert.match(ehud, /drawGateMark\(opts\.gate \?\? null, opts\.playerXZ \?\? null, heading01\);/);
  assert.match(ehud, /compassMarkerLerp\(gate, playerXZ, heading01\)/, 'the Detect markers\' own bearing law');
  const held = read('src/ui/heldMap.js');
  assert.match(held, /readGateMark\(this\.deps\.gate, this\._size\)/);
  assert.match(held, /gate: this\._gate,/);
  const page = read('src/ui/travelMapWindow.js');
  assert.match(page, /gateRingTexels\(gate, originX, originY, width, height\)\) plot\(x, y, gatePx\)/);
  assert.match(page, /gateRingKey\(readGateMark\(this\.deps\.gate,/, 'the page rebuilds when the ring comes, goes or moves');
  // the law is the relay's to import later (WB3): it reaches for wire.js alone
  const law = read('src/net/gateLaw.js');
  assert.deepEqual([...law.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]), ['./wire.js']);
});
