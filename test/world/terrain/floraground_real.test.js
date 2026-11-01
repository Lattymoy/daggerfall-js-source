// FLORA-GROUND (FIELD BUGS 2026-10-27, the owner: "Plus floating flora and reflective flora can be seen off the ground in
// first person"; the coordinator: "Prove it across the sample cells on the real data") - THE GROUND'S ONE LAW ON THE
// GAME'S OWN GROUND (ARENA2): five cells built as the stream builds them, every plant on the walk floor
// (world/terrain/terrainSurface.js walkGroundAt); and FLORA-GROUND, THE RINGS: the same cells built at the far ring's
// stride with their beds, every plant drawn by the seat on the ground the pixel draws (scenes/floraSeat.js). Its own
// file, apart from floraground.test.js and floraground_rings.test.js, so the mutants' runs stay quick; skipped without
// the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { walkGroundAt, buildTerrainIndices } from '../../../src/world/terrain/terrainSurface.js';
import { seatFlora, standsOnGround } from '../../../src/scenes/floraSeat.js';
import { groundAt, MAX_STEEPNESS, SLOPE_SINK_RATIO } from '../../../src/world/terrain/terrainNature.js';
import { bayRoads } from '../../bayRoads.mjs';

const SINK = MAX_STEEPNESS / SLOPE_SINK_RATIO;   // the deepest a flat is sunk into its slope (DFU's steepness / 70)

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

/** The game's own ground, read once for both tests: the world as the world host stands it and the five cells. */
let _world = null;
async function realWorld() {
  if (_world) return _world;
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile, getWorldClimateSettings, longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { generatePixelTerrain } = await import('../../../src/world/terrain/terrainGen.js');
  const { setLocationTiles } = await import('../../../src/world/terrain/terrainTiles.js');
  const { landformClimates } = await import('../../../src/world/landforms.js');
  const { groundWoods } = await import('../../../src/world/tamriel/tamrielGround.js');
  const b = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const raw = new WoodsFile(); raw.load(b('WOODS.WLD'));
  const woods = groundWoods(raw);   // the continent round the Bay, as the world host stands it (its authored shape)
  const maps = new MapsFile(); maps.load(b('MAPS.BSA'), b('CLIMATE.PAK'), b('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(b('BLOCKS.BSA'));
  const climates = landformClimates((x, y) => maps.getClimateIndex(x, y));
  const bay = bayRoads();   // The Bay's own network
  const roads = { roads: bay.roads, tracks: bay.tracks, rivers: bay.rivers, streams: bay.streams, water: false, smooth: true };
  const town = maps.getLocationByName('Daggerfall', 'Daggerfall');
  const tp = longitudeLatitudeToMapPixel(town.mapTableData.longitude, town.mapTableData.latitude);
  const cells = [
    { what: 'the Bay\'s wilderness', px: 500, py: 340 },
    { what: 'a slope', px: 780, py: 460 },
    { what: 'a coast', px: 540, py: 300 },
    { what: 'a town (Daggerfall)', px: tp.x, py: tp.y, loc: town },
    { what: 'past the Bay', px: 1050, py: 200 },
  ];
  _world = { generatePixelTerrain, setLocationTiles, getWorldClimateSettings, woods, maps, blocks, climates, roads, cells };
  return _world;
}

test('FLORA-GROUND on the game\'s own ground (ARENA2): the Bay\'s wilderness, a slope, a coast, a town and past the Bay, built as the stream builds them (the Landforms row, the climates, Basic Roads\' network, the woods) - no plant more than 5 cm off the walk floor, none sunk past its slope; where the woods stood on the bilinear patch, hundreds stood over the drawn ground', { skip: skipReal }, async () => {
  const { generatePixelTerrain, setLocationTiles, getWorldClimateSettings, woods, maps, blocks, climates, roads, cells } = await realWorld();
  const report = [];
  let stoodOver = 0;
  for (const c of cells) {
    const cl = getWorldClimateSettings(maps.getClimateIndex(c.px, c.py));
    const tilemap = new Uint8Array(128 * 128);
    const rect = c.loc ? setLocationTiles(c.loc, maps, blocks, tilemap) : null;
    const out = generatePixelTerrain({ woods, px: c.px, py: c.py, tilemap, locationRect: rect, hasLocation: !!c.loc, climateType: cl.climateType, roads, climates, landform: true, forests: { archive: cl.natureArchive, hidden: false } });
    let over = 0, under = 0, bilinear = 0;
    for (const f of out.nature) {
      const g = walkGroundAt(out.samples, f.x, f.z), off = f.y - g;
      if (off > 0.05) over++;
      if (off < -SINK - 1e-6) under++;
      if (groundAt(out.samples, f.x, f.z) + off - g > 0.05) bilinear++;   // the same flat stood on the bilinear patch, its sink kept
    }
    report.push(`${c.what} (${c.px},${c.py}): ${out.nature.length} flats, ${over} over the walk floor, ${bilinear} on the old patch`);
    assert.ok(out.nature.length > 300, `${c.what}: ${out.nature.length} flats`);
    assert.equal(over, 0, `${c.what}: ${over} flats more than 5 cm over the walk floor`);
    assert.equal(under, 0, `${c.what}: ${under} flats sunk past their slope`);
    if (!c.loc) assert.ok(bilinear > 0, `${c.what}: the cell reaches the bug - ${bilinear} flats stood over the drawn ground on the bilinear patch`);
    stoodOver += bilinear;
  }
  assert.ok(stoodOver > 300, `${stoodOver} flats of the five cells stood more than 5 cm over the drawn ground on the bilinear patch`);
  console.log(`# FLORA-GROUND ${report.join('; ')}`);
});

/** The drawn mesh under (x, z): a grid's own vertices (`positions`, its bed carved where it has one) and its triangles at
 *  `stride` - no law of the code under test. */
function meshUnder(positions, stride) {
  const idx = buildTerrainIndices(stride), q = 128 / stride, cell = (819.2 / 128) * stride;
  return (x, z) => {
    const qx = Math.min(q - 1, Math.floor(x / cell)), qz = Math.min(q - 1, Math.floor(z / cell)), o = (qz * q + qx) * 6;
    for (let t = 0; t < 2; t++) {
      const [a, b, c] = [0, 1, 2].map((k) => idx[o + t * 3 + k] * 3).map((i) => [positions[i], positions[i + 1], positions[i + 2]]);
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
      const l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
      const l3 = 1 - l1 - l2;
      if (l1 >= -1e-5 && l2 >= -1e-5 && l3 >= -1e-5) return l1 * a[1] + l2 * b[1] + l3 * c[1];
    }
    throw new Error(`no triangle under ${x}, ${z}`);
  };
}

test('FLORA-GROUND THE RINGS on the game\'s own ground (ARENA2): the five cells built at the far ring\'s stride with their beds, as the stream builds a pixel three or more out - every plant the seat draws (scenes/floraSeat.js) within a millimetre of the far ring\'s drawn mesh, over or under; on the walk floor they stood thousands more than 25 cm over it and under it, metres at worst', { skip: skipReal }, async () => {
  const { generatePixelTerrain, setLocationTiles, getWorldClimateSettings, woods, maps, blocks, climates, roads, cells } = await realWorld();
  const report = [];
  const T = [0.05, 0.25, 1];
  const before = { over: [0, 0, 0], under: [0, 0, 0], worst: 0 };
  let after = 0, plants = 0;
  for (const c of cells) {
    const cl = getWorldClimateSettings(maps.getClimateIndex(c.px, c.py));
    const tilemap = new Uint8Array(128 * 128);
    const rect = c.loc ? setLocationTiles(c.loc, maps, blocks, tilemap) : null;
    const out = generatePixelTerrain({ woods, px: c.px, py: c.py, stride: 4, bed: true, tilemap, locationRect: rect, hasLocation: !!c.loc, climateType: cl.climateType, roads, climates, landform: true, forests: { archive: cl.natureArchive, hidden: false } });
    const mesh = meshUnder(out.bed?.positions ?? out.positions, 4);
    const centers = out.nature.map((f) => { const k = [f.x, f.y, f.z]; standsOnGround(k); return k; });
    const batch = {};
    let drawn = null;
    seatFlora({ samples: out.samples, _stride: 4, _bed: out.bed ? { depths: out.bed.depths } : null, _box: [0, 0, 0, 0, 0, 0], forest: { groups: new Map([['all', { batch, centers, size: { w: 1, h: 1 } }]]) } },
      { moveBillboardBatch: (b, at) => { drawn = at; return true; } });
    assert.ok(drawn, `${c.what}: the far ring moved its plants`);
    let cellOver = 0, cellUnder = 0, cellAfter = 0;
    centers.forEach((k, i) => {
      const walk = walkGroundAt(out.samples, k[0], k[2]), rise = k[1] - walk, m = mesh(k[0], k[2]), e = walk - m;
      T.forEach((t, j) => { if (e > t) before.over[j]++; if (e < -t) before.under[j]++; });
      if (e > 0.25) cellOver++;
      if (e < -0.25) cellUnder++;
      before.worst = Math.max(before.worst, Math.abs(e));
      cellAfter = Math.max(cellAfter, Math.abs(drawn[i][1] - rise - m));
    });
    report.push(`${c.what}: ${centers.length} plants, on the walk floor ${cellOver} over and ${cellUnder} under the far ring's ground by 25 cm, drawn ${(cellAfter * 1000).toFixed(3)} mm off it at worst`);
    assert.ok(cellAfter < 1e-3, `${c.what}: a plant drawn ${(cellAfter * 1000).toFixed(2)} mm off the far ring's ground`);
    assert.ok(cellOver > 0 && cellUnder > 0, `${c.what}: the cell reaches the bug both ways (${cellOver} over, ${cellUnder} under)`);
    after = Math.max(after, cellAfter);
    plants += centers.length;
  }
  assert.ok(before.over[1] > plants / 10 && before.under[1] > plants / 10, `on the walk floor ${before.over[1]} and ${before.under[1]} of ${plants} stood more than 25 cm over and under the far ring's ground`);
  assert.ok(before.worst > 3, `the worst ${before.worst.toFixed(2)} m`);
  console.log(`# FLORA-GROUND THE RINGS ${plants} plants; before over 5/25/100 cm ${before.over.join('/')}, under ${before.under.join('/')}, worst ${before.worst.toFixed(3)} m; after worst ${(after * 1000).toFixed(3)} mm. ${report.join('; ')}`);
});
