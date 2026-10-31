// FB1028 TOWN-GROUND on the game's own towns (ARENA2; bible/03-World/Town-Shapes.md TS2, FB1028). The Bay's towns as the
// stream builds them online - both town packs on the world-data door, the Landforms row, Basic Roads' network, the
// gates' roads - against the same pixel built wild (no town: the land's own steps are never the blend's):
//   Westhead Moor (Daggerfall, a port): TS2 stood a 46 m step at its shore and 769 crops off the plane, up to 47 m;
//   Aldwall Rock (Anticlere, a port): a 34 m step at its shore, 706 crops off the plane;
//   every fourth of the Bay's town pixels that hold sea (22 of 86): TS2's worst 65 m, ten over 20 m, 282 crops off.
// Skipped without the data. Its own file: the packs stay on the door for the rest of the process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bayRoads } from '../../bayRoads.mjs';   // OWN-WORK2

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const ROOT = new URL('../../../', import.meta.url).pathname;
/** The sample: every fourth town pixel of the Bay's (a TownCity, a TownHamlet or a TownVillage) whose own ground holds sea. */
const SAMPLE = [285597, 199102, 221160, 236143, 347375, 373407, 382321, 195353, 281699, 286674, 243846, 273975, 35152, 140760, 478159, 364449, 308530, 326497, 277798, 354916, 285898, 77077];

async function openOnline() {
  const { openTownData } = await import('../../../tools/townQuestMarkers.mjs');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { longitudeLatitudeToMapPixel, getWorldClimateSettings } = await import('../../../src/formats/mapsFile.js');
  const { landformClimates, landformSites } = await import('../../../src/world/landforms.js');
  const { groundWoods } = await import('../../../src/world/tamriel/tamrielGround.js');
  const raw = new WoodsFile(); raw.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD'))));
  const woods = groundWoods(raw);   // the world as the world host stands it
  const { maps, blocks, getModel } = await openTownData(ARENA2);
  maps.autoDiscard = false;
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); for (let l = 0; reg && l < reg.locationCount; l++) { const lc = maps.getLocation(r, l); if (lc) rows.push(lc); } }
  const pixelOf = (loc) => longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
  // LANDFORM4's sites as world.js makes them: each row as MAPS.BSA holds it
  const classic = rows.map((row) => (maps.locationReplaced(row.regionIndex, row.locationIndex) ? maps.readClassicLocation(row.regionIndex, row.locationIndex) : row)).filter(Boolean);
  const sites = landformSites(classic.map((loc) => { const p = pixelOf(loc); return { px: p.x, py: p.y, loc }; }));
  const climates = landformClimates((x, y) => maps.getClimateIndex(x, y));
  const bay = bayRoads();   // OWN-WORK2: the Bay's own network
  const roads = { roads: bay.roads, tracks: bay.tracks, rivers: bay.rivers, streams: bay.streams, water: false, smooth: true };
  const byPixel = new Map();
  for (const loc of rows) { const p = pixelOf(loc); if (!byPixel.has(p.y * 1000 + p.x)) byPixel.set(p.y * 1000 + p.x, loc); }
  return { woods, raw, maps, blocks, getModel, sites, climates, roads, byPixel, pixelOf, getWorldClimateSettings };
}

test('FB1028 with ARENA2: Westhead Moor and Aldwall Rock meet their sea on a slope - no step the blend adds over 8 m where TS2 stood 46 m and 34 m - every crop on the plane it stands on, every model on its ground, some of their sea kept, the Deep Waters bake\'s sea the stream\'s; every fourth of the Bay\'s sea towns no step over 20 m and no flat off its plane', { skip: skipReal, timeout: 600_000 }, async () => {
  const w = await openOnline();
  const { setLocationTiles, getLocationTerrainTileOrigin } = await import('../../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../../src/world/terrain/terrainGen.js');
  const { townGateRoads } = await import('../../../src/world/townGates.js');
  const { walkGroundAt } = await import('../../../src/world/terrain/terrainSurface.js');
  const { layoutLocation } = await import('../../../src/world/locationLayout.js');
  const { collectBlockFlats } = await import('../../../src/world/rmbFlats.js');
  const { pixelWaterSampler, WATER_THRESHOLD } = await import('../../../src/world/deepWater/deepWatersBake.js');
  const { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, HEIGHTMAP_DIMENSION: H } = await import('../../../src/world/terrain/terrainSampler.js');
  const M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, TILE = 6.4;
  const build = (loc, town) => {
    const p = w.pixelOf(loc), cl = w.getWorldClimateSettings(w.maps.getClimateIndex(p.x, p.y)), tilemap = new Uint8Array(128 * 128);
    let rect = null;
    if (town) { rect = setLocationTiles(loc, w.maps, w.blocks, tilemap); const gr = townGateRoads(loc, w.maps, w.blocks); if (gr) rect.gateRoads = gr; }
    return { ...generatePixelTerrain({ woods: w.woods, px: p.x, py: p.y, tilemap, locationRect: rect, hasLocation: town, climateType: cl.climateType, roads: w.roads, sites: w.sites, climates: w.climates, landform: true }), rect, cl, px: p.x, py: p.y };
  };
  /** The steepest step the town's blend adds over the land's own, metres, and how many it adds 10 m or more to. */
  const added = (t, wild) => {
    let worst = 0, over10 = 0;
    for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (x + dx >= H || y + dy >= H) continue;
      const i = x * H + y, j = (x + dx) * H + y + dy, d = Math.abs(t.samples[i] - t.samples[j]) * M;
      if (d - Math.abs(wild.samples[i] - wild.samples[j]) * M < 3) continue;
      worst = Math.max(worst, d); if (d > 10) over10++;
    }
    return { worst, over10 };
  };
  /** The town's own things on the ground they stand over: every model's foot, every flat that stands on its block's plane. */
  const offPlane = (loc, t) => {
    const lay = layoutLocation(loc, w.maps, w.blocks, { enhanced: true }), tp = getLocationTerrainTileOrigin(loc), L = Math.fround(t.avg) * M;
    let models = 0, flats = 0, n = 0;
    const off = (x, z) => x >= 0 && z >= 0 && x <= 819.2 && z <= 819.2 && Math.abs(walkGroundAt(t.samples, x, z) - L) > 0.5;
    for (const b of lay.blocks) {
      const ox = tp.x * TILE + b.originX, oz = tp.y * TILE + b.originZ;
      for (const m of b.layout.models) {
        const g = w.getModel(m.modelIdNum), A = m.matrix;
        if (!g) continue;
        const P = g.positions, pts = [];
        for (let k = 0; k < P.length; k += 3) pts.push([A[0] * P[k] + A[4] * P[k + 1] + A[8] * P[k + 2] + A[12], A[1] * P[k] + A[5] * P[k + 1] + A[9] * P[k + 2] + A[13], A[2] * P[k] + A[6] * P[k + 1] + A[10] * P[k + 2] + A[14]]);
        const lo = Math.min(...pts.map((q) => q[1]));
        if (pts.some((q) => q[1] <= lo + 0.3 && off(ox + q[0], oz + q[2]))) models++;
      }
      for (const f of collectBlockFlats(b.dfBlock, t.cl.natureArchive, { climateIndex: w.maps.getClimateIndex(t.px, t.py) })) {
        if (f.editor || f.archive === t.cl.natureArchive) continue;   // the nature flats stand on the ground itself
        n++; if (off(ox + f.x, oz + f.z)) flats++;
      }
    }
    return { models, flats, n };
  };
  const report = [];
  for (const [id, cap] of [[223207, 'Westhead Moor'], [183401, 'Aldwall Rock']]) {
    const loc = w.byPixel.get(id);
    assert.equal(loc?.name, cap);
    const t = build(loc, true), wild = build(loc, false), a = added(t, wild), o = offPlane(loc, t);
    const kept = t.samples.filter((v) => v * M <= 34 + 1e-3).length;
    report.push(`${cap}: worst ${a.worst.toFixed(2)} m, ${o.flats} of ${o.n} flats and ${o.models} models off the plane, ${kept} sea samples kept`);
    assert.ok(a.worst <= 8, `${cap}: the blend adds a step of ${a.worst.toFixed(2)} m`);
    assert.equal(o.flats, 0, `${cap}: ${o.flats} flats off their plane`);
    assert.equal(o.models, 0, `${cap}: ${o.models} models off their ground`);
    assert.ok(kept > 300, `${cap}: its sea past the ease kept (${kept} samples)`);
    // the Deep Waters bake blends DFU's own samples as the stream's classic pass does - its sea by its own line
    const bake = pixelWaterSampler(w.raw, t.px, t.py, t.rect);
    let differ = 0;
    for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) if (bake.water(x, y) !== (t.beach[x * H + y] <= WATER_THRESHOLD)) differ++;
    assert.equal(differ, 0, `${cap}: the bake's sea and the stream's part at ${differ} samples`);
  }
  let worst = 0, over10 = 0, flats = 0;
  for (const id of SAMPLE) {
    const loc = w.byPixel.get(id), t = build(loc, true), a = added(t, build(loc, false)), o = offPlane(loc, t);
    worst = Math.max(worst, a.worst); over10 += a.over10; flats += o.flats;
    assert.ok(a.worst <= 20, `${loc.name} (${id}): the blend adds a step of ${a.worst.toFixed(2)} m`);
  }
  report.push(`${SAMPLE.length} sea towns: worst ${worst.toFixed(2)} m, ${over10} steps over 10 m, ${flats} flats off the plane`);
  assert.equal(flats, 0, `${flats} flats off their plane over the sample`);
  assert.ok(over10 < 400, `${over10} steps the blend adds over 10 m (TS2: 2,450)`);
  console.log(`# FB1028 ${report.join('; ')}`);
});
