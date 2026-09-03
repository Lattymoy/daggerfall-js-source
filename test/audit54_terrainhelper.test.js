// AUDIT 54 F4: TERRAINHELPER'S TWO STARTUP DATA REPAIRS.
// StreamingWorld.ReadyCheck (StreamingWorld.cs:1676-1685) runs
// DilateCoastalClimate(reader, 2) and SmoothLocationNeighbourhood(reader)
// once, before anything streams; neither had a port, so every
// land-adjacent ocean pixel kept climate 223 along the whole coastline
// while terrain interpolation raised it above sea level, and the sampler
// read unsmoothed WOODS bytes under every steep location.
//
// Synthetic grids only - no ARENA2 needed. The two shapes that bite are
// pinned as behaviour, not as source text: the dilation READS the live
// buffer and WRITES a clone (so one pass reaches exactly one ring, not
// the whole scan row), and the smoothing writes the LIVE height buffer
// in scan order (so a later location sees an earlier one's mean).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PakFile, PAK_WIDTH } from '../src/formats/pakFile.js';
import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { MapsFile, getMapPixelID, getWorldClimateSettings } from '../src/formats/mapsFile.js';
import {
  dilateCoastalClimate, smoothLocationNeighbourhood, terrainGradient,
  OCEAN_CLIMATE, SMOOTH_GRADIENT_THRESHOLD,
} from '../src/world/terrainHelper.js';

/** An all-ocean CLIMATE.PAK with the named map pixels set to a climate. */
function oceanMaps(land = []) {
  const maps = new MapsFile();
  const pak = new PakFile();
  pak.buffer.fill(OCEAN_CLIMATE);
  for (const [x, y, climate] of land) pak.buffer[y * PAK_WIDTH + (x + 1)] = climate;
  maps.climatePak = pak;
  return maps;
}

test('AUDIT 54 F4: DilateCoastalClimate pushes land climate into the ocean beside it - one ring per pass', () => {
  assert.equal(OCEAN_CLIMATE, 223, 'TransferLandToOcean’s `const int oceanClimate = 223`');
  const MOUNTAIN = 226;
  // One land pixel in the middle of the sea, DFU's own +1 X column.
  const maps = oceanMaps([[501, 250, MOUNTAIN]]);
  assert.equal(maps.getClimateIndex(500, 250), OCEAN_CLIMATE, 'ocean before the repair');

  // ONE pass reaches the Moore neighbourhood and NOTHING further. This
  // is the read-live/write-clone law: writing in place would let (502,250)
  // become land mid-scan and smear the climate east across the whole row.
  const one = dilateCoastalClimate(oceanMaps([[501, 250, MOUNTAIN]]), 1);
  assert.equal(one, 8, 'eight neighbours, one pass');

  const passes = dilateCoastalClimate(maps, 2);
  assert.equal(passes, 8 + 16, 'the second pass reaches the ring outside the first');
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    assert.equal(maps.getClimateIndex(501 + dx, 250 + dy), MOUNTAIN, `ring 1 at ${dx},${dy}`);
  }
  assert.equal(maps.getClimateIndex(503, 250), MOUNTAIN, 'ring 2 - the second pass');
  assert.equal(maps.getClimateIndex(499, 248), MOUNTAIN, 'ring 2, diagonally');
  assert.equal(maps.getClimateIndex(504, 250), OCEAN_CLIMATE, 'ring 3 re-converges on ocean');
  assert.equal(maps.getClimateIndex(501, 250), MOUNTAIN, 'the land pixel is untouched');

  // The value the artefact actually costs: everything a pixel's climate
  // decides. Undilated, the raised coast wore Swamp's ground/nature/sky.
  const got = getWorldClimateSettings(maps.getClimateIndex(500, 250));
  const want = getWorldClimateSettings(MOUNTAIN);
  assert.deepEqual(got, want, 'the coastal pixel now reads its neighbour’s whole climate settings');
  assert.notDeepEqual(want, getWorldClimateSettings(OCEAN_CLIMATE), 'and the two settings really do differ');
});

test('AUDIT 54 F4: the dilation only ever writes OCEAN, and only from LAND', () => {
  const MOUNTAIN = 226;
  const DESERT = 224;
  // Two land pixels side by side: neither overwrites the other.
  const maps = oceanMaps([[501, 250, MOUNTAIN], [502, 250, DESERT]]);
  dilateCoastalClimate(maps, 2);
  assert.equal(maps.getClimateIndex(501, 250), MOUNTAIN, 'land is never a destination');
  assert.equal(maps.getClimateIndex(502, 250), DESERT, 'nor is its neighbour');
  // An all-ocean map is a no-op: nothing is a source.
  const sea = oceanMaps();
  assert.equal(dilateCoastalClimate(sea, 2), 0, 'ocean alone dilates nothing');
  assert.equal(sea.getClimateIndex(400, 200), OCEAN_CLIMATE);
  // The x/y bounds are DFU's [1, dim-1): a land pixel on the edge column
  // is never a source, so the map margin stays sea.
  const edge = oceanMaps([[0, 250, MOUNTAIN]]);
  dilateCoastalClimate(edge, 2);
  assert.equal(edge.getClimateIndex(1, 250), OCEAN_CLIMATE, 'x=0 is outside the scan');
});

/** A WOODS-shaped height surface plus a map dictionary holding locations. */
function heightWorld(locations = []) {
  const woods = { heightMapBuffer: new Uint8Array(MAP_WIDTH * MAP_HEIGHT) };
  const mapDict = new Map();
  for (const [x, y] of locations) mapDict.set(getMapPixelID(x, y), { id: getMapPixelID(x, y) });
  return { woods, mapDict };
}

test('AUDIT 54 F4: SmoothLocationNeighbourhood flattens a steep location’s 3x3 to its truncated mean', () => {
  assert.equal(SMOOTH_GRADIENT_THRESHOLD, 20, 'DFU’s `int threshold = 20`');
  assert.equal(terrainGradient(10, 40, 5), 35, '|dx| + |dy|, DFU’s faster arm');

  const { woods, mapDict } = heightWorld([[400, 200]]);
  const h = woods.heightMapBuffer;
  const at = (x, y) => y * MAP_WIDTH + x;
  // A ramp steep enough to trip the gradient: dx = 35, dy = 0.
  for (let y = 199; y <= 201; y++) for (let x = 399; x <= 401; x++) h[at(x, y)] = 10;
  h[at(401, 200)] = 45;
  assert.equal(terrainGradient(h[at(400, 200)], h[at(401, 200)], h[at(400, 201)]), 35);

  assert.equal(smoothLocationNeighbourhood(mapDict, woods), 1, 'one location smoothed');
  // 8 cells of 10 plus one of 45 = 125 / 9 = 13.888 -> C#'s `(byte)average`
  // TRUNCATES toward zero, so 13 and not the 14 a round would give.
  for (let y = 199; y <= 201; y++) {
    for (let x = 399; x <= 401; x++) assert.equal(h[at(x, y)], 13, `3x3 mean at ${x},${y}`);
  }
  assert.equal(h[at(402, 200)], 0, 'nothing outside the 3x3 moves');
});

test('AUDIT 54 F4: the gradient gate is strict, and only a map-dict pixel is a candidate', () => {
  const at = (x, y) => y * MAP_WIDTH + x;
  // Exactly at the threshold: `> threshold` does NOT fire.
  const flat = heightWorld([[400, 200]]);
  for (let y = 199; y <= 201; y++) for (let x = 399; x <= 401; x++) flat.woods.heightMapBuffer[at(x, y)] = 10;
  flat.woods.heightMapBuffer[at(401, 200)] = 30;
  assert.equal(smoothLocationNeighbourhood(flat.mapDict, flat.woods), 0, 'gradient 20 is not > 20');
  assert.equal(flat.woods.heightMapBuffer[at(400, 200)], 10, 'and nothing was averaged');

  // The same terrain with NO location on it is left alone.
  const wild = heightWorld([]);
  for (let y = 199; y <= 201; y++) for (let x = 399; x <= 401; x++) wild.woods.heightMapBuffer[at(x, y)] = 10;
  wild.woods.heightMapBuffer[at(401, 200)] = 40;
  assert.equal(smoothLocationNeighbourhood(wild.mapDict, wild.woods), 0, 'wilderness is never smoothed');
  assert.equal(wild.woods.heightMapBuffer[at(401, 200)], 40);
});

test('AUDIT 54 F4: the smoothing writes the LIVE buffer in scan order - a later location reads an earlier one’s mean', () => {
  const at = (x, y) => y * MAP_WIDTH + x;
  // Two locations three apart on the same row, sharing no 3x3 cell but
  // the second's gradient sample (x+1) lands in the first's neighbourhood.
  const { woods, mapDict } = heightWorld([[400, 200], [402, 200]]);
  const h = woods.heightMapBuffer;
  for (let y = 199; y <= 201; y++) for (let x = 399; x <= 403; x++) h[at(x, y)] = 10;
  h[at(401, 200)] = 45;   // trips (400,200); it is also (402,200)'s dx sample
  // Before: (402,200)'s gradient is |10 - 10| + |10 - 10| = 0 read forward,
  // but its x-1 neighbour is what the FIRST average rewrites.
  assert.equal(smoothLocationNeighbourhood(mapDict, woods), 1, 'only the steep one fires');
  assert.equal(h[at(401, 200)], 13, 'the 45 was averaged away by the first location');
  // ...and that new 13 is what (402,200) saw: had the first average gone
  // into a copy, the 45 would still be sitting at (401,200).
  assert.equal(h[at(399, 200)], 13);
  assert.equal(h[at(402, 200)], 10, 'outside the first 3x3, untouched');
});

test('AUDIT 54 F4: the smoothed heights reach the raw WOODS bytes the terrain worker reads', () => {
  // The EV7 worker builds its OWN WoodsFile from the raw file bytes, and
  // _readHeightMap takes a COPY - so a repair of the live buffer has to be
  // written back or the two kernels sample different heights.
  const bytes = syntheticWoodsBytes();
  const w = new WoodsFile();
  assert.equal(w.load(bytes), true);
  const before = w.getHeightMapValue(400, 200);
  w.heightMapBuffer[200 * MAP_WIDTH + 400] = (before + 77) & 0xff;
  const worker = new WoodsFile();
  assert.equal(worker.load(bytes.slice()), true);
  assert.equal(worker.getHeightMapValue(400, 200), before, 'the worker’s copy is stale until the sync');
  assert.equal(w.syncHeightMapBytes(), true);
  const after = new WoodsFile();
  assert.equal(after.load(bytes.slice()), true);
  assert.equal(after.getHeightMapValue(400, 200), (before + 77) & 0xff, 'the sync carried it into the bytes');
  assert.equal(new WoodsFile().syncHeightMapBytes(), false, 'nothing loaded, nothing to write');
});

test('AUDIT 54 F4: the host runs both repairs at ReadyCheck’s point - before the terrain client copies the bytes', () => {
  const host = readFileSync('src/scenes/world.js', 'utf8');
  const at = (re, what) => {
    const i = host.search(re);
    assert.ok(i > 0, `world.js never ${what}`);
    return i;
  };
  const dict = at(/const mapDict = buildMapDict\(maps\);/, 'builds the map dict');
  const dilate = at(/const dilated = dilateCoastalClimate\(maps, 2\);/, 'dilates the coastal climate');
  const smooth = at(/smoothLocationNeighbourhood\(mapDict, woods\);/, 'smooths the location neighbourhoods');
  const sync = at(/woods\.syncHeightMapBytes\(\);/, 'syncs the smoothed heights back');
  const client = at(/new TerrainGenClient\(\{ woods, woodsBytes \}\)/, 'builds the terrain client');
  assert.ok(dict < dilate, 'HasLocation’s dictionary exists before the smoothing needs it');
  assert.ok(dilate < smooth && smooth < sync, 'DFU’s order: dilate, then smooth');
  assert.ok(sync < client, 'and the worker gets the SMOOTHED bytes, not the raw ones');
  // Classic-lane law: neither repair sits behind the enhanced gate.
  const block = host.slice(dilate - 400, client);
  assert.ok(!/isEnhanced/.test(block), 'no isEnhanced() gate on either repair');
});

// The synthetic WOODS.WLD of test/terrain.test.js, kept local so this
// suite needs no ARENA2 and no export from another test file.
function syntheticWoodsBytes() {
  const offsetsStart = 32 + 28 * 4;
  const cellsStart = offsetsStart + MAP_WIDTH * MAP_HEIGHT * 4;
  const cellSize = 22 + 25;
  const heightMapOffset = cellsStart + 2 * cellSize;
  const bytes = new Uint8Array(heightMapOffset + MAP_WIDTH * MAP_HEIGHT);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, MAP_WIDTH * MAP_HEIGHT * 4, true);
  v.setUint32(4, MAP_WIDTH, true);
  v.setUint32(8, MAP_HEIGHT, true);
  v.setUint32(16, cellsStart, true);
  v.setUint32(28, heightMapOffset, true);
  for (let i = 0; i < MAP_WIDTH * MAP_HEIGHT; i++) v.setUint32(offsetsStart + i * 4, cellsStart, true);
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) bytes[heightMapOffset + y * MAP_WIDTH + x] = (x + y) & 0xff;
  }
  return bytes;
}
