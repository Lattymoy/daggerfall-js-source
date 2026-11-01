// STOREFRONT W14 (2026-10-29; bible/06-Systems/Battle-Pass.md section 6, bible/03-World/World-Wide.md, the doctrine's
// TAMRIEL-WIDE): THE SEASON IN EVERY THEATRE. The Brass Fissures stood on the Iliac Bay alone - the Bay's gate scan, its
// regions, its names. Now each theatre that stands a site-bound world event (the Bay and the eight provinces; Cyrodiil's
// open zone none, as the Starfall's nights) has its own: drawn over its theatre's scan an area at a time, a pixel by the
// world's key, its region and name the province's, kept off its own roads once they are laid and off its own gate of the
// day, on the map with the continent, in the rock's clearings, and its camp, Colossus and Maul as the Bay's. The Bay's
// fissures are the law before W14, written out. tools/mutants/storefront_seasontamriel.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  stageFissures, theatreFissures, areaFissures, areaBox, regionFissures, fissureRoll, fissureSpotLocal, fissureUnderGate,
  FISSURES_BY_STAGE, FISSURE_APART_PX, FISSURE_ROAD_M, HEART_ESCORT, COLOSSUS_MOBILE, SEASON_SALT,
} from '../../../src/systems/pass/seasonWorld.js';
import { createSeasonHost, SEASON_LANE_DRAW_MS } from '../../../src/scenes/seasonHost.js';
import { fissureLayout } from '../../../src/world/fissureModel.js';
import { TREMOR_TEXT, COLOSSUS_TEXT, FISSURE_TEXT } from '../../../src/systems/pass/seasonWords.js';
import { RESONANT_MAUL } from '../../../src/systems/pass/resonantMaul.js';
import { passSeasonById } from '../../../src/net/battlePassLaw.js';
import { gateHash, gateAt } from '../../../src/net/gate/gateLaw.js';
import { scanTheatreGate, findTheatreGateSite } from '../../../src/systems/gate/theatreGateSite.js';
import { WOD_SITE_RE, brassSiteId } from '../../../src/world/worldOfDaggerfall/wodShared.js';
import { worldPixelKey, worldPixelOfKey, districtOf, areaOfDistrict, theatreAt, theatreName, theatreOfArea, THEATRE_KEYS } from '../../../src/world/worldWide/worldGrid.js';
import { regionOfTheatre } from '../../../src/formats/mapsTables.js';
import { REGION_NAMES, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { setArenaRoads, beyondKey, keptArenaRoadsHost } from '../../../src/world/arenaRoads.js';
import { nearRoad } from '../../../src/world/road/roadBand.js';
import { pointNearPath, UNITS_PER_METRE } from '../../../src/world/road/roadClearance.js';
import { gateClearSet, boxNearGate, createGateClearSweep, FISSURE_ROCK_M } from '../../../src/world/gate/gateClearance.js';
import { readFissureMarksIn } from '../../../src/ui/fissureMapMark.js';
import { tamrielFrameInBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { createTamrielRoadsHost } from '../../../src/scenes/tamrielRoadsHost.js';
import { installEnemyExpansion } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { HAVE, ww5World } from './ww5World.mjs';
import { ROOT } from '../../arena1Data.mjs';

installEnemyExpansion({ on: true, log: () => {} });
const S1 = passSeasonById('s1');
const HEART_T = S1.stages[2].fromMs + 30 * 60_000;   // mid-hour in the third stage: no tremor
const U = UNITS_PER_METRE;
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
/** A network of the test's own on the Bay (Basic Roads' arrays are retired) - a road east-west along every
 *  seventh row; the Bay's draws keep off it as the old law's did. */
const NET = { roads: new Uint8Array(500_000), tracks: new Uint8Array(500_000) };
for (let i = 0; i < NET.roads.length; i++) if (Math.floor(i / 1000) % 7 === 0) NET.roads[i] = 0x22;

/** Two Bay regions of 400 pixels each, every pixel its own town's (the season's test scan). */
function bayScan(regions = [17, 23]) {
  const byRegion = new Map(), townAt = new Int32Array(1000 * 500).fill(-1), towns = [];
  regions.forEach((region, i) => {
    const pixels = [];
    for (let y = 20 + i * 40; y < 40 + i * 40; y++) for (let x = 300; x < 320; x++) { const id = y * 1000 + x; pixels.push(id); townAt[id] = towns.length; towns.push({ name: `Town ${towns.length}`, px: x, py: y, region }); }
    byRegion.set(region, Int32Array.from(pixels));
  });
  return { byRegion, towns, townAt };
}
const SCAN = bayScan();
/** A theatre's scan by the producer (systems/gate/theatreGateSite.js scanTheatreGate): a grid of towns past the Bay, each
 *  pixel its district's area of theatre `t` (world/worldWide/worldGrid.js) - several areas - every pixel land. */
function theatreScan(t = 3, ox = 1440, oy = -560, n = 6, step = 30) {
  const areaAt = (x, y) => { const [cx, cy] = districtOf(x, y); return areaOfDistrict(t, cx, cy); };
  const towns = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) towns.push({ name: `Town ${t}.${i}.${j}`, px: ox + i * step, py: oy + j * step, area: areaAt(ox + i * step, oy + j * step), type: LOCATION_TYPES.TownCity });
  const at = new Map(towns.map((p) => [`${p.px},${p.py}`, p]));
  return scanTheatreGate({ towns, placeAt: (x, y) => at.get(`${x},${y}`) ?? null, inTheatre: () => true, areaAt, wet: () => false, theatre: t });
}
const SKYRIM = theatreScan(3), MORROWIND = theatreScan(4, 2900, -100);

/** The Bay's fissures before W14 (systems/pass/seasonWorld.js regionFissures at 81afff56a), their identity. */
function oldRegionFissures(n, stage, region, scan, paths = null) {
  const pixels = scan?.byRegion?.get(region);
  if (!pixels?.length) return [];
  const out = [], unit = (k, j) => gateHash(SEASON_SALT, n, stage, region, k, j) / 4294967296;
  const onRoad = (id, spot) => !!paths && pointNearPath(paths, id % 1000, Math.floor(id / 1000), spot[0] * U, spot[1] * U, 12 * U);
  for (let k = 0; k < [2, 3, 3][stage]; k++) {
    let pick = -1;
    const a = unit(k, 1) * 2 * Math.PI, r = Math.sqrt(unit(k, 2)) * 200, spot = [409.6 + Math.cos(a) * r, 409.6 + Math.sin(a) * r];
    for (let d = 0; d < 24 && pick < 0; d++) {
      const id = pixels[gateHash(SEASON_SALT, n, stage, region, k, 100 + d) % pixels.length];
      if (out.every((f) => Math.max(Math.abs(f.px - (id % 1000)), Math.abs(f.py - Math.floor(id / 1000))) >= 4) && !onRoad(id, spot)) pick = id;
    }
    if (pick < 0) continue;
    const px = pick % 1000, py = Math.floor(pick / 1000), heart = stage === 2 && k === 0;
    const town = scan.towns?.[scan.townAt?.[pick]] ?? null, regionName = REGION_NAMES[region] ?? '';
    out.push({ key: `${n}.${stage}.${region}.${k}`, px, py, near: town?.name || regionName, regionName, spot, yaw: unit(k, 3) * 2 * Math.PI, site: `${px},${py}:brass.${stage}.${k}`, hSite: heart ? `${px},${py}:brass.${stage}.${k}.h` : null });
  }
  return out;
}
const idOf = (f) => ({ key: f.key, px: f.px, py: f.py, near: f.near, regionName: f.regionName, spot: f.spot, yaw: f.yaw, site: f.site, hSite: f.hSite });
const oldStage = (n, stage, scan, paths) => [...scan.byRegion.keys()].flatMap((r) => oldRegionFissures(n, stage, r, scan, paths));

// ── THE LAW ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('W14 THE LAW PAST THE BAY: a province\'s fissures an area at a time over its theatre\'s scan - each on its area\'s ground by the world\'s key, its first draw by its own area\'s roll, apart, its region and name its province\'s, its town its own; the Bay\'s the law before W14; none in Cyrodiil\'s open zone (mutants: the province unread; the pixel the Bay\'s; the roll the region\'s; the region the area; the name lost; Cyrodiil opened; every area read)', () => {
  for (const stage of [0, 1, 2]) {
    const bay = stageFissures(1, stage, SCAN, null);
    assert.deepEqual(bay.map(idOf), oldStage(1, stage, SCAN, null), `stage ${stage}: the Bay's, the law before W14`);
    assert.ok(bay.every((f) => f.area === f.region && f.theatre === 0));
    const list = theatreFissures(1, stage, SKYRIM);
    const areas = [...SKYRIM.byArea.keys()];
    assert.ok(areas.length >= 4, `${areas.length} areas`);
    for (const area of areas) {
      const pixels = SKYRIM.byArea.get(area), mine = list.filter((f) => f.area === area);
      if (pixels.length >= 40) assert.equal(mine.length, FISSURES_BY_STAGE[stage], `area ${area}: its stage's`);
      assert.ok(mine.length >= 1, `area ${area}: one at least`);
      const first = worldPixelOfKey(pixels[fissureRoll(1, stage, area, 0, 100) % pixels.length]);
      assert.deepEqual([mine[0].px, mine[0].py], first, 'its first draw by its own area\'s roll');
      for (const a of mine) for (const b of mine) if (a !== b) assert.ok(Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py)) >= FISSURE_APART_PX, 'apart');
    }
    for (const f of list) {
      const key = worldPixelKey(f.px, f.py);
      assert.ok(SKYRIM.byArea.get(f.area).includes(key), 'on its area\'s ground');
      assert.deepEqual([f.theatre, f.region, f.regionName], [3, regionOfTheatre(3), 'Skyrim'], 'its province\'s');
      assert.equal(f.near, SKYRIM.towns[SKYRIM.townOf.get(key)].name, 'by its own town');
      assert.equal(f.key, `1.${stage}.${f.area}.${f.k}`);
      assert.deepEqual(f.spot, fissureSpotLocal(1, stage, f.area, f.k));
      assert.equal(f.site, brassSiteId(f.px, f.py, stage, f.k));
      assert.ok(WOD_SITE_RE.test(f.site) && f.py < 0, `${f.site}: the camp law reads a world pixel`);
      assert.equal(f.heart, stage === 2 && f.k === 0);
      if (f.hSite) assert.ok(WOD_SITE_RE.test(f.hSite));
    }
    assert.deepEqual(theatreFissures(1, stage, SKYRIM, null, (a) => a === areas[0]).map((f) => f.key), list.filter((f) => f.area === areas[0]).map((f) => f.key), 'the areas it is asked for alone');
  }
  assert.deepEqual(theatreFissures(1, 2, theatreScan(9, 1440, 960)), [], 'Cyrodiil\'s open zone stands none (net/wire.js SITE_EVENT_LANES)');
  assert.deepEqual(areaFissures(1, 2, 17, SKYRIM), [], 'a Bay region is the Bay scan\'s');
  const a0 = [...SKYRIM.byArea.keys()][0], xs = [...SKYRIM.byArea.get(a0)].map(worldPixelOfKey);
  assert.deepEqual(areaBox(SKYRIM, a0), [Math.min(...xs.map((p) => p[0])), Math.min(...xs.map((p) => p[1])), Math.max(...xs.map((p) => p[0])) + 1, Math.max(...xs.map((p) => p[1])) + 1]);
  assert.equal(areaBox(SKYRIM, 99), null);
  // a province's fissures in two areas are each their own model (world/fissureModel.js rolls the area)
  const [p, q] = [a0, [...SKYRIM.byArea.keys()][1]].map((a) => theatreFissures(1, 2, SKYRIM).find((f) => f.area === a && f.k === 1));
  assert.notDeepEqual(fissureLayout(p).spine, fissureLayout(q).spine);
  assert.deepEqual(regionFissures(1, 2, 99, SCAN), []);
});

test('W14 NO KEY OR SITE TWICE: the Bay\'s and every province\'s fissures of every stage - their keys, their camps\' sites and their Colossi\'s - each its own across the theatres, as every reader of them (the host, the map, the clearings, the quiet) keys them (mutants: the key by the region)', () => {
  const all = [0, 1, 2].flatMap((s) => [...stageFissures(1, s, SCAN), ...theatreFissures(1, s, SKYRIM), ...theatreFissures(1, s, MORROWIND)]);
  assert.ok(all.some((f) => f.theatre === 0) && all.some((f) => f.theatre === 3) && all.some((f) => f.theatre === 4));
  for (const field of ['key', 'site']) assert.equal(new Set(all.map((f) => f[field])).size, all.length, field);
  const hearts = all.filter((f) => f.hSite);
  assert.equal(new Set(hearts.map((f) => f.hSite)).size, hearts.length);
  assert.ok(all.every((f) => (f.theatre === 0 ? f.area < 62 : f.area >= 62)));
});

test('W14 THE ROADS PAST THE BAY: a province\'s draw whose heart comes within FISSURE_ROAD_M of a road\'s or a track\'s band as the terrain draws it there (the curves - world/road/roadBand.js nearRoad) is passed over; the Bay\'s as before (mutants: the roads read on the Bay alone)', () => {
  const empty = { roads: new Uint8Array(500_000), tracks: new Uint8Array(500_000) };
  const roads = new Map(), tracks = new Map();
  for (const l of SKYRIM.byArea.values()) for (const k of l) { const [x, y] = worldPixelOfKey(k); roads.set(beyondKey(x, y), 0x55); tracks.set(beyondKey(x, y), 0xaa); }
  try {
    setArenaRoads({ roads, tracks, join: new Map() });
    const near = (f) => nearRoad(empty, f.px, f.py, f.spot[0] * U, f.spot[1] * U, FISSURE_ROAD_M * U);
    const bare = theatreFissures(1, 2, SKYRIM), kept = theatreFissures(1, 2, SKYRIM, empty);
    assert.ok(bare.some(near), 'some drawn on a road');
    assert.equal(kept.filter(near).length, 0, 'none kept on one');
    assert.deepEqual(theatreFissures(1, 2, SKYRIM, empty).map((f) => f.key), kept.map((f) => f.key), 'the same every run');
    assert.deepEqual(stageFissures(1, 2, SCAN, NET).map(idOf), oldStage(1, 2, SCAN, NET), 'the Bay\'s keep off its roads\' arms as before');
  } finally { setArenaRoads(null); }
});

// ── THE HOST ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function pool() {
  const p = { foes: [], stood: [], dropped: [], camp: 0 };
  p.newCampId = () => ++p.camp;
  p.spawnFoe = (career, pos, o) => { const f = { mobileType: career, site: o.site, opts: o, entity: { health: 100, maxHealth: 100 }, ai: { feet: [...pos] }, dead: false }; p.foes.push(f); p.stood.push(f); return Promise.resolve(f); };
  p.dropSiteFoes = (s) => { p.dropped.push(s); p.foes = p.foes.filter((f) => f.site !== s || f.puppet); };
  p.reclaimSite = () => {};
  p.removeFoe = (f) => { p.foes = p.foes.filter((x) => x !== f); };
  return p;
}
/** A world with one player and the season's host on its bindings: the Bay's scan, the provinces' (`lanes` theatre -> scan)
 *  as the gate's kept scans answer them, and the roads past the Bay's host - `laid(x0, y0, x1, y1)`, its `build`. */
function world({ t = HEART_T, lanes = { 3: SKYRIM } } = {}) {
  const w = { t, feet: null, said: [], taken: [], lanes, laid: () => false, build: 1, sprung: new Set(), days: new Set(), asks: 0 };
  w.foes = pool();
  w.renderer = { createMesh: (m) => ({ m }), destroyMesh() {}, uploadTexture() {}, uploadEmissionTexture() {}, drawMesh() {} };
  w.host = createSeasonHost({
    renderer: w.renderer, state: { pixelTranslation: (px, py, out) => { out[0] = px * 1000; out[1] = 0; out[2] = py * 1000; return out; } },
    exteriorFoes: w.foes, gateScanOf: () => SCAN, warmGateScan: () => {}, surfaceAt: () => 0,
    player: { feetAt: () => w.feet }, walkMode: true, playerSpawned: true, online: {}, collider: { surfaceHit: () => null }, _sharedOffsetMs: 0, relayNowS: () => Math.floor(w.t / 1000),
    _wodPeerSprung: new Set(), wodPeerHeldAgo: () => 0, wodForgetPeer() {}, wodSprang: (s) => w.sprung.add(s), wodUnsprang: (s) => w.sprung.delete(s),
    chatNotice() {}, say: (s) => w.said.push(s), shake() {}, burst: () => true, struckAt: () => 1, take: (item) => w.taken.push(item), who: () => 'acct|char', storage: null, bindPass: false,
    maulApi: { claim: async () => { w.asks++; const day = Math.floor(w.t / 86_400_000); if (w.days.has(day)) return { ok: false, error: 'taken', status: 409 }; w.days.add(day); return { ok: true }; } },
    rid: () => '0000000000000001', wait: async () => {}, roads: null,
    audio: { buffers: new Map(), play3d() {} }, labGrassField: { invalidate() {} }, gamePaused: () => false, townTalk: { hudHidden: false },
    theatreScans: { scanOf: (lane) => w.lanes[lane] ?? null, theatres: () => Object.keys(w.lanes).map(Number), siteOf: () => null },
    worldPlaces: { generation: () => 1 }, landVersion: () => 1, idle: null,
    pastBayRoads: { landedIn: (x0, y0, x1, y1) => w.laid(x0, y0, x1, y1), build: () => w.build },
  });
  w.heart = (f) => [f.px * 1000 + f.spot[0], 0, f.py * 1000 + f.spot[1]];
  w.at = (f, m = 0) => { const h = w.heart(f); w.feet = [h[0] + m, 0, h[2]]; };
  w.beat = async () => { w.host.frame(); await settle(); w.host.frame(); };
  /** the roads past the Bay landing: a region's layer installed (world/arenaRoads.js moves its version) */
  w.land = (laid = () => true) => { w.laid = laid; setArenaRoads(null); w.t += SEASON_LANE_DRAW_MS; };
  return w;
}
const keysOf = (l) => l.map((x) => x.key);
/** A mark's theatre, by its key's area. */
const theatreOfMark = (m) => theatreOfArea(Number(m.key.split('.')[2]));
let realNow;
test.before(() => { realNow = Date.now; });
test.after(() => { Date.now = realNow; });
const clock = (w) => { Date.now = () => w.t; };

test('W14 THE HOST\'S PROVINCES: a province\'s fissures stand once the roads past the Bay are laid over their areas (none before - every machine keeps off the same roads), an area at a time as its region lands, beside the Bay\'s; on the map, in the clearings; all drawn again for a new roads\' build or a new scan (mutants: the provinces unasked; the roads not waited for; every area drawn with the first; a new build kept; a new scan kept; the clearings keyed by their count)', () => {
  const w = world(); clock(w);
  const bay = keysOf(stageFissures(1, 2, SCAN));
  assert.deepEqual(keysOf(w.host.mapMarks()), bay, 'the roads past the Bay unlaid: the Bay\'s alone');
  assert.equal(w.host.fissureClears().length, bay.length);
  const split = 1504;   // a district's west edge: the areas east of it land first
  w.land((x0) => x0 >= split);
  const east = theatreFissures(1, 2, SKYRIM).filter((f) => areaBox(SKYRIM, f.area)[0] >= split);
  assert.ok(east.length > 0 && east.length < theatreFissures(1, 2, SKYRIM).length);
  assert.deepEqual(keysOf(w.host.mapMarks()), [...bay, ...keysOf(east)], 'the areas whose roads are laid');
  w.land();
  const all = theatreFissures(1, 2, SKYRIM);
  assert.deepEqual(keysOf(w.host.mapMarks()), [...bay, ...keysOf(all)], 'every area once its roads are laid');
  const clears = w.host.fissureClears();
  assert.equal(w.host.fissureClears(), clears, 'one list while the same fissures stand');
  assert.deepEqual(clears.slice(bay.length).map((c) => [c.f, c.px, c.py, c.x, c.z]), all.map((f) => [f.key, f.px, f.py, f.spot[0], f.spot[1]]));
  const heart = w.host.mapMarks().find((m) => m.key === all.find((f) => f.heart).key);
  assert.equal(heart.label, `${FISSURE_TEXT.heart()}, ${all.find((f) => f.heart).near}`, 'named by its own town');
  // a new build of the roads past the Bay: drawn again as its regions land
  w.build = 2; w.laid = () => false; w.t += SEASON_LANE_DRAW_MS;
  assert.deepEqual(keysOf(w.host.mapMarks()), bay, 'a new build: none until its roads are laid again');
  w.land();
  assert.deepEqual(keysOf(w.host.mapMarks()), [...bay, ...keysOf(all)]);
  // a new scan of the theatre (a registry generation, a picture): its fissures its own, the clearings with them
  const moved = theatreScan(3, 1440 + 96 * 2, -560);
  w.lanes = { 3: moved }; w.t += SEASON_LANE_DRAW_MS;
  const now = theatreFissures(1, 2, moved);
  assert.equal(now.length, all.length, 'as many (the same districts\' shape)');
  assert.deepEqual(keysOf(w.host.mapMarks()), [...bay, ...keysOf(now)]);
  assert.deepEqual(w.host.fissureClears().slice(bay.length).map((c) => [c.px, c.py]), now.map((f) => [f.px, f.py]), 'the clearings the new scan\'s');
});

test('W14 ONE THEATRE\'S DRAWS A MOMENT: two provinces laid at once draw one theatre\'s fissures, then the next a frame on - never every theatre in one frame (mutants: every theatre drawn at once)', () => {
  const w = world({ lanes: { 3: SKYRIM, 4: MORROWIND } }); clock(w);
  w.laid = () => true;
  const theatres = () => new Set(w.host.mapMarks().map(theatreOfMark));
  assert.deepEqual([...theatres()].sort(), [0, 3], 'one theatre first');
  w.t += SEASON_LANE_DRAW_MS;
  assert.deepEqual([...theatres()].sort(), [0, 3, 4], 'the next a frame on');
});

test('W14 A PROVINCE\'S GATE: a fissure beside its own theatre\'s gate of the day (systems/gate/theatreGateSite.js) gives way to it - its card says so, nothing is built or stood there (mutants: the Bay\'s gate asked for a province\'s)', async () => {
  let tq = null, fq = null;
  for (let t = HEART_T; t < S1.stages[2].toMs && !tq; t += 3_600_000) {
    const g = findTheatreGateSite(gateAt(t, 3).day, SKYRIM), f = theatreFissures(1, 2, SKYRIM).find((x) => fissureUnderGate(x, g));
    if (f) { tq = t; fq = f; }
  }
  assert.ok(tq, 'a day its gate stands beside one');
  const w = world({ t: tq }); clock(w);
  w.land();
  const gate = findTheatreGateSite(gateAt(tq, 3).day, SKYRIM), byKey = new Map(theatreFissures(1, 2, SKYRIM).map((x) => [x.key, x]));
  const cards = w.host.mapMarks().filter((m) => theatreOfMark(m) === 3);
  assert.equal(cards.length, byKey.size);
  assert.ok(cards.find((m) => m.key === fq.key).tip.lines.includes(FISSURE_TEXT.quiet()), 'its card: quiet');
  for (const m of cards) assert.equal(m.tip.lines.includes(FISSURE_TEXT.quiet()), fissureUnderGate(byKey.get(m.key), gate), `${m.key}: as its own gate says`);
  w.at(fq, 20); await w.beat();
  assert.deepEqual([w.host.state().find((s) => s.key === fq.key)?.mesh, w.foes.stood.length], [false, 0], 'nothing built or stood');
});

test('W14 THE COLOSSUS IN A PROVINCE: a province\'s Heart Fissure is built where the law puts it, its camp sprung on its world pixel\'s brass sites, its Colossus woken by its own town\'s name, and its fall gives the Maul on the service\'s yes, as on the Bay; the tremor is felt there (the clock\'s alone)', async () => {
  const w = world(); clock(w);
  w.land();
  const gate = findTheatreGateSite(gateAt(w.t, 3).day, SKYRIM);
  const f = theatreFissures(1, 2, SKYRIM).find((x) => x.heart && !fissureUnderGate(x, gate));
  w.at(f, 30); await w.beat();
  const st = w.host.state().find((s) => s.key === f.key);
  assert.ok(st?.mesh && st.floor, 'built');
  assert.deepEqual(st.heart, w.heart(f));
  assert.deepEqual(w.foes.stood.map((x) => x.mobileType), [...HEART_ESCORT, COLOSSUS_MOBILE]);
  assert.deepEqual([...new Set(w.foes.stood.map((x) => x.site))], [f.site, f.hSite]);
  assert.ok(w.sprung.has(f.site) && w.sprung.has(f.hSite));
  assert.ok(w.said.includes(COLOSSUS_TEXT.wakes(f.near)) && /^Town 3\./.test(f.near));
  for (const x of w.foes.foes) { x.dead = true; x.corpse = {}; }
  w.host.frame(); await settle();
  assert.equal(w.taken[0]?.legendary, RESONANT_MAUL.id, 'the Maul');
  assert.ok(w.said.includes(COLOSSUS_TEXT.falls()));
  const hour = Math.ceil(HEART_T / 3_600_000) * 3_600_000 + 3_600_000;
  const q = world({ t: hour + 1000 }); clock(q);
  q.at(f, 500); q.host.frame();
  assert.ok(q.said.includes(TREMOR_TEXT[2]()), 'the tremor');
});

test('W14 THE MAP AND THE ROCK: a province\'s fissure is on the held map over the continent\'s frame (and not over the Bay\'s sheet), and its clearing keeps World of Daggerfall\'s rock off its heart in its own pixel; the sweep reads a clearing\'s key once, however many pixels were built against it (mutants: the key read every pixel)', () => {
  const w = world(); clock(w);
  w.land();
  const f = theatreFissures(1, 2, SKYRIM)[0];
  const marks = () => w.host.mapMarks();
  assert.ok(readFissureMarksIn(marks, tamrielFrameInBay()).some((m) => m.key === f.key), 'over the continent');
  assert.ok(!readFissureMarksIn(marks, { x0: 0, y0: 0, w: 1000, h: 500 }).some((m) => m.key === f.key), 'not on the Bay\'s sheet');
  const set = gateClearSet(null, [], [], w.host.fissureClears());
  assert.equal(boxNearGate(set, f.px, f.py, f.spot[0] + FISSURE_ROCK_M - 1, f.spot[1], f.spot[0] + FISSURE_ROCK_M - 1, f.spot[1]), true, 'its clearing');
  assert.equal(boxNearGate(set, f.px, f.py, f.spot[0] + FISSURE_ROCK_M + 1, f.spot[1], f.spot[0] + FISSURE_ROCK_M + 1, f.spot[1]), false);
  // the sweep at a turn: 300 pixels built against one key - the key's members read once
  const built = new Map();
  for (let i = 0; i < 300; i++) built.set(`${i}`, { px: f.px + (i % 20), py: f.py + Math.floor(i / 20), gateClearKey: set.key, gateRefused: false, wodReach: [] });
  const next = gateClearSet(null, [], [], w.host.fissureClears().slice(1));
  const sweep = createGateClearSweep();
  sweep.step(set, new Map());
  const split = String.prototype.split;
  let reads = 0;
  String.prototype.split = function (...a) { if (String(this) === set.key) reads++; return split.apply(this, a); };
  try { assert.deepEqual(sweep.step(next, built), []); } finally { String.prototype.split = split; }
  assert.equal(reads, 1, 'the key read once');
});

test('W14 THE ROADS\' HOST KEPT: the world host\'s roads past the Bay are the season\'s to ask (world/arenaRoads.js keptArenaRoadsHost) while they stand, and let go with them', () => {
  const host = createTamrielRoadsHost({ terrainGen: { addArenaRoads() {}, roads: () => null, hasRoads: false }, woodsBytes: new Uint8Array(0), heightAt: () => 0, joinLand: () => false, onLanded() {}, standing: { pixels: () => null, towns: () => [], spec: () => null, capitals: () => false }, client: { dispose() {}, pending: () => 0 }, log: { log() {}, warn() {} } });
  assert.equal(keptArenaRoadsHost(), host);
  assert.equal(host.landedIn(1500, -500, 1501, -499), false, 'no build yet: nothing past the Bay laid');
  host.dispose();
  assert.equal(keptArenaRoadsHost(), null);
});

// ── THE FREEWARE ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('W14 ON THE FREEWARE\'S WORLD: every province\'s every stage stands its fissures, each in its own theatre on its scan\'s ground by a town of its own, its region and name its province\'s; every area with ground one at least; no key or site twice across the world; the Bay\'s the law before W14 with Basic Roads (TESA\'s places registered, WW7-1)', { skip: HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)', timeout: 600_000 }, async () => {
  const W = await ww5World();
  for (const stage of [0, 1, 2]) {
    const bay = stageFissures(1, stage, W.bayScan, NET);
    assert.deepEqual(bay.map(idOf), oldStage(1, stage, W.bayScan, NET), `stage ${stage}: the Bay's, to the byte`);
    const all = [...bay];
    for (let t = 1; t <= 8; t++) {
      const sc = W.scans.scanOf(t), list = theatreFissures(1, stage, sc);
      assert.ok(list.length >= sc.byArea.size, `${THEATRE_KEYS[t]} stage ${stage}: ${list.length} over ${sc.byArea.size} areas`);
      for (const a of sc.byArea.keys()) assert.ok(list.some((f) => f.area === a), `${THEATRE_KEYS[t]}: area ${a}`);
      for (const f of list) {
        const key = worldPixelKey(f.px, f.py);
        assert.equal(theatreAt(f.px, f.py), t, `${f.key} in its own theatre`);
        assert.ok(sc.byArea.get(f.area).includes(key), 'on its ground');
        assert.ok(f.town && sc.towns[sc.townOf.get(key)] === f.town && f.near === f.town.name, 'by a town of its own');
        assert.deepEqual([f.region, f.regionName], [regionOfTheatre(t), theatreName(t)]);
      }
      all.push(...list);
    }
    for (const field of ['key', 'site']) assert.equal(new Set(all.map((f) => f[field])).size, all.length, `stage ${stage}: no ${field} twice`);
  }
});
