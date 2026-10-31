// FIELD BUGS 2026-10-29c, ACROSS-EDGE on the game's own ports (ARENA2; bible/01-Overview/bugs/Field-Bugs-2026-10-29c.md).
// The report: "List of Ports with broken" - Kalunnunu's quays stood at a 14 m cliff where its pixel's north edge stood
// over open sea, and six of its jetties ran into a face. The ports as the stream builds them online - both town packs on
// the world-data door, the Landforms row, Basic Roads' network, the gates' roads - each pixel with the towns of its 3 x 3
// (scenes/townMeetsHost.js), against the same pixels with none. Skipped without the data. Its own file: the packs stay on
// the door for the rest of the process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bayRoads } from '../bayRoads.mjs';   // OWN-WORK2

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped (sh tools/fetch-data.sh)' : false;
const ROOT = new URL('../../', import.meta.url).pathname;

async function openOnline() {
  const { openTownData } = await import('../../tools/townQuestMarkers.mjs');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { longitudeLatitudeToMapPixel, getWorldClimateSettings } = await import('../../src/formats/mapsFile.js');
  const { landformClimates, landformSites } = await import('../../src/world/landforms.js');
  const { groundWoods } = await import('../../src/world/tamriel/tamrielGround.js');
  const raw = new WoodsFile(); raw.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD'))));
  const woods = groundWoods(raw);
  const { maps, blocks } = await openTownData(ARENA2);
  maps.autoDiscard = false;
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); for (let l = 0; reg && l < reg.locationCount; l++) { const lc = maps.getLocation(r, l); if (lc) rows.push(lc); } }
  const pixelOf = (loc) => longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
  const classic = rows.map((row) => (maps.locationReplaced(row.regionIndex, row.locationIndex) ? maps.readClassicLocation(row.regionIndex, row.locationIndex) : row)).filter(Boolean);
  const sites = landformSites(classic.map((loc) => { const p = pixelOf(loc); return { px: p.x, py: p.y, loc }; }));
  const climates = landformClimates((x, y) => maps.getClimateIndex(x, y));
  const bay = bayRoads();   // OWN-WORK2: the Bay's own network
  const roads = { roads: bay.roads, tracks: bay.tracks, rivers: bay.rivers, streams: bay.streams, water: false, smooth: true };
  const byPixel = new Map();
  for (const loc of rows) { const p = pixelOf(loc); if (!byPixel.has(p.y * 1000 + p.x)) byPixel.set(p.y * 1000 + p.x, loc); }
  return { woods, raw, maps, blocks, sites, climates, roads, byPixel, pixelOf, getWorldClimateSettings };
}

test('ACROSS-EDGE with ARENA2: Kalunnunu\'s north meets its sea - its worst step 8.2 m where it stood 14.4 m, no jetty at a face where six were, the ground 8 m past a jetty\'s end within a metre of its deck where it stood 19 m over it - no seam in its 3 x 3, no location\'s level moved, the bake\'s sea the stream\'s; Tunmont and Naresa met; Chesterbrugh and Sentinel, which no cone of MEET_REACH meets, unmoved (mutants: the meets unwired; the cone not the grade; the bake unmet)', { skip: skipReal, timeout: 900_000 }, async () => {
  const w = await openOnline();
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { townGateRoads } = await import('../../src/world/townGates.js');
  const { meetsTown } = await import('../../src/scenes/townMeetsHost.js');
  const { townMeetOf } = await import('../../src/world/terrain/townMeet.js');
  const { pixelWaterSampler, bakeMeetsAt, classifyPixel, meetClass, PIXEL_MIXED, WATER_THRESHOLD } = await import('../../src/world/deepWater/deepWatersBake.js');
  const { deepWatersLocationRects } = await import('../../src/world/deepWater/deepWatersClient.js');
  const { rectsLookup } = await import('../../src/world/deepWater/deepWatersBakeCache.js');
  const { surfaceHeightAt } = await import('../../src/world/terrain/terrainSurface.js');
  const { createHarbourBook } = await import('../../src/systems/naval/harbourBook.js');
  const { harbourKeep } = await import('../../src/systems/naval/harbourKeep.js');
  const { HARBOUR_REACH } = await import('../../src/systems/naval/shipLife.js');
  const { planQuay, quayToScene, QUAY_DECK_UP, STEP_M } = await import('../../src/systems/naval/quays.js');
  const { locationWorldRect } = await import('../../src/world/streamingWorld.js');
  const { GLOBAL_SCALE } = await import('../../src/world/meshReader.js');
  const { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, SCALED_OCEAN_ELEVATION, TERRAIN_SIZE: TS, HEIGHTMAP_DIMENSION: H, generateSamples } = await import('../../src/world/terrain/terrainSampler.js');
  const M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, SEA = SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE;
  const rects = new Map();
  const rectAt = (x, y) => { const k = y * 1000 + x; if (!rects.has(k)) { const l = w.byPixel.get(k); rects.set(k, l?.exterior?.exteriorData ? setLocationTiles(l, w.maps, w.blocks, new Uint8Array(128 * 128)) : null); } return rects.get(k); };
  /** The towns of a pixel's 3 x 3 as the host hands them (townMeetsHost.js createTownMeets). */
  const aboutOf = (px, py) => { const out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const l = w.byPixel.get((py + dy) * 1000 + px + dx), r = meetsTown(l) ? rectAt(px + dx, py + dy) : null; if (r?.shape) out.push({ px: px + dx, py: py + dy, shape: r.shape }); } return out.length ? out : null; };
  const built = new Map();
  /** The pixel as the stream builds it: its location's own rect and gates, the towns about it met (or not), the row on or off. */
  const build = (px, py, { meets = true, landform = true } = {}) => {
    const key = `${px},${py},${meets},${landform}`;
    if (built.has(key)) return built.get(key);
    const loc = w.byPixel.get(py * 1000 + px) ?? null, cl = w.getWorldClimateSettings(w.maps.getClimateIndex(px, py)), tilemap = new Uint8Array(128 * 128);
    let rect = null;
    if (loc?.exterior?.exteriorData) { rect = setLocationTiles(loc, w.maps, w.blocks, tilemap); const gr = townGateRoads(loc, w.maps, w.blocks); if (gr) rect.gateRoads = gr; }
    const t = generatePixelTerrain({ woods: w.woods, px, py, tilemap, locationRect: rect, hasLocation: !!rect, climateType: cl.climateType, roads: w.roads, sites: w.sites, climates: w.climates, landform, about: meets ? aboutOf(px, py) : null });
    built.set(key, t);
    return t;
  };
  const worst = (s) => { let m = 0; for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) { if (x + 1 < H) m = Math.max(m, Math.abs(s[x * H + y] - s[(x + 1) * H + y])); if (y + 1 < H) m = Math.max(m, Math.abs(s[x * H + y] - s[x * H + y + 1])); } return m * M; };
  const named = (name) => { const loc = [...w.byPixel.values()].find((l) => l.name === name); return { loc, ...w.pixelOf(loc) }; };
  const report = [];

  // Kalunnunu: its 3 x 3 - the seams, the sea raised, the levels
  const K = named('Kalunnunu');
  assert.deepEqual([K.x, K.y], [754, 279]);
  let seam = 0, raised = 0, most = 0, levels = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = K.x + dx, y = K.y + dy, t = build(x, y), b = build(x, y, { meets: false });
    for (let i = 0; i < H * H; i++) { const d = (t.samples[i] - b.samples[i]) * M; assert.ok(d > -1e-3, 'raise-only'); if (b.samples[i] * M <= SEA + 1e-3 && d > 1e-3) raised++; most = Math.max(most, d); }
    if (dx < 1) { const e = build(x + 1, y); for (let k = 0; k < H; k++) seam = Math.max(seam, Math.abs(t.samples[128 * H + k] - e.samples[k]) * M); }
    if (dy < 1) { const s = build(x, y + 1); for (let k = 0; k < H; k++) seam = Math.max(seam, Math.abs(t.samples[k * H] - s.samples[k * H + 128]) * M); }
    if (w.byPixel.get(y * 1000 + x)?.exterior?.exteriorData && t.avg !== b.avg) levels++;
  }
  const kOwn = worst(build(K.x, K.y).samples), kWas = worst(build(K.x, K.y, { meets: false }).samples);
  report.push(`Kalunnunu: worst ${kWas.toFixed(1)} -> ${kOwn.toFixed(1)} m, ${raised} sea samples raised up to ${most.toFixed(1)} m, seams ${seam.toFixed(4)} m`);
  assert.ok(kWas > 14 && kOwn < 8.5, `Kalunnunu's worst step ${kWas.toFixed(1)} -> ${kOwn.toFixed(1)} m`);
  assert.ok(raised > 2000 && most > 60 && most < 80, `${raised} sea samples raised, ${most.toFixed(1)} m the most`);
  assert.ok(seam < 1e-3, `a seam of ${seam.toFixed(4)} m`);
  assert.equal(levels, 0, 'a location\'s level moved');

  // Kalunnunu's harbour: its berths and their jetties over the ground the stream builds (scratch survey's law, the quays')
  const harbourOf = (meets) => {
    const pixelOf = (x, z) => [Math.floor(x / TS), 499 - Math.floor(z / TS)];
    const local = (x, z) => { const [px, py] = pixelOf(x, z); return [px, py, x - px * TS, z - (499 - py) * TS]; };
    const isWater = (x, z) => { const [px, py, lx, lz] = local(x, z), tx = Math.min(127, Math.max(0, Math.trunc((lx / TS) * 128))), tz = Math.min(127, Math.max(0, Math.trunc((lz / TS) * 128))); return (build(px, py, { meets }).tilemapBytes[tz * 128 + tx] >> 2) === 0; };
    const ground = (x, z) => { const [px, py, lx, lz] = local(x, z); return surfaceHeightAt(build(px, py, { meets }).samples, lx, lz) - SEA; };
    const r = locationWorldRect(K.loc, K.x, K.y), rect = { minX: r.minX * GLOBAL_SCALE, maxX: r.maxX * GLOBAL_SCALE, minZ: r.minZ * GLOBAL_SCALE, maxZ: r.maxZ * GLOBAL_SCALE };
    const book = createHarbourBook({ harbourNear: () => ({ key: 'K', name: 'Kalunnunu', rect, reach: HARBOUR_REACH, ready: () => true, keep: harbourKeep(K.loc, rect) }), isWater, ground });
    book.step(0);
    const berths = book.get('K')?.harbour?.berths ?? [], plans = [];
    let faces = 0, past = -Infinity;
    for (const [i, b] of berths.entries()) {
      const plan = planQuay({ berth: b, key: 'K', index: i, seaY: 0, groundAt: ground, others: plans.map((q) => ({ plan: q })) });
      plans.push(plan);
      if (!plan?.jetty) continue;
      const j = plan.jetty, zJ = (j.z0 + j.z1) / 2, at = (s) => { const [x, z] = quayToScene(plan.frame, j.x1 + s, zJ); return ground(x, z) - QUAY_DECK_UP; };
      if (at(0) > 2 * STEP_M) faces++;
      past = Math.max(past, at(8));
    }
    return { berths: berths.length, faces, past };
  };
  const hNow = harbourOf(true), hWas = harbourOf(false);
  report.push(`Kalunnunu's harbour: ${hWas.berths} berths, ${hWas.faces} at a face, 8 m past ${hWas.past.toFixed(1)} m -> ${hNow.berths}, ${hNow.faces}, ${hNow.past.toFixed(1)} m`);
  assert.ok(hWas.faces >= 5 && hWas.past > 15, 'the report: its jetties at a face');
  assert.equal(hNow.berths, 6);
  assert.equal(hNow.faces, 0, 'a jetty at a face');
  assert.ok(hNow.past < 2, `ground 8 m past a jetty's end ${hNow.past.toFixed(2)} m over its deck`);

  // the bake reads Kalunnunu's 3 x 3 as the classic pass builds it: its sea the stream's at every sample it samples
  const locations = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const l = w.byPixel.get((K.y + dy) * 1000 + K.x + dx); if (l) locations.push([K.x + dx, K.y + dy, l]); }
  const at = rectsLookup(deepWatersLocationRects(w.raw, locations, w.maps, w.blocks, meetsTown)), met = bakeMeetsAt(w.raw, at);
  let sampled = 0, differ = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = K.x + dx, y = K.y + dy;
    if (meetClass(classifyPixel(w.raw, x, y), met(x, y)) !== PIXEL_MIXED) continue;
    sampled++;
    const own = build(x, y, { landform: false }), bake = pixelWaterSampler(w.raw, x, y, at(x, y), met(x, y));
    for (let i = 0; i < H; i++) for (let j = 0; j < H; j++) if (bake.water(i, j) !== (own.samples[i * H + j] <= WATER_THRESHOLD)) differ++;
  }
  assert.ok(sampled >= 6, `${sampled} of the 3 x 3 sampled`);
  assert.equal(differ, 0, `the bake's sea parts from the stream's at ${differ} samples`);

  // the other measured ports
  for (const [name, was, now] of [['Tunmont', 18, 7.5], ['Naresa', 13, 10.5]]) {
    const p = named(name), a = worst(build(p.x, p.y, { meets: false }).samples), b = worst(build(p.x, p.y).samples);
    report.push(`${name}: ${a.toFixed(1)} -> ${b.toFixed(1)} m`);
    assert.ok(a > was && b < now, `${name}'s worst step ${a.toFixed(1)} -> ${b.toFixed(1)} m`);
  }
  // Chesterbrugh stands 946 m over its sea (a cone of MEET_REACH cannot meet it whole) and Sentinel under its land: no meet
  for (const name of ['Chesterbrugh', 'Sentinel']) {
    const p = named(name), S = generateSamples(w.woods, p.x, p.y);
    assert.equal(townMeetOf(S, rectAt(p.x, p.y).shape, S)?.edges.N ?? null, null);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.deepEqual(build(p.x + dx, p.y + dy).samples, build(p.x + dx, p.y + dy, { meets: false }).samples, `${name}'s 3 x 3 unmoved at ${dx},${dy}`);
  }
  console.log(`# ACROSS-EDGE ${report.join('; ')}`);
});
