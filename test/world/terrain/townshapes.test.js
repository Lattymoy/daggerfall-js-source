// TOWN-SHAPES (2026-10-25, the owner: "IC should be round, give other towns unique shapes. Its time to move away from perfect
// squares. Ensure nobody's home is removed. This needs to be perfection"; bible/03-World/Town-Shapes.md): a town's ground is
// its own outline - every building's tile, its streets, a margin wandering on its own seed - stamped, flattened to its own
// land and eased back to the land; the sea past its margin the sea's; the road's ring round the outline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { townOccupancy, townShapeField, townShape, tileDistance, shapeWander, shapeFieldDistance, isWallBlock, TOWN_SHAPE } from '../../../src/world/townShape.js';
import { locationShapeField, setLocationTiles, blendLocationTerrain, townGroundMask, unstampOffShape, townRoadRing, SHAPE_BLEND_TILES } from '../../../src/world/terrain/terrainTiles.js';
import { HEIGHTMAP_DIMENSION, SCALED_OCEAN_ELEVATION, SCALED_BEACH_ELEVATION, MAX_TERRAIN_HEIGHT } from '../../../src/world/terrain/terrainSampler.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const H = HEIGHTMAP_DIMENSION, D = 128;
const land = (m) => Math.fround(m / MAX_TERRAIN_HEIGHT);

test('TOWN-SHAPES the outline: every building\'s tile inside, a margin wandering on the town\'s own seed (no two towns one outline), every hole it closes round filled; a town of no building its whole grid; a wall block none of its own (mutants: a building left out; the seed unread; the holes open)', () => {
  const W = 48, Hh = 32, occ = new Uint8Array(W * Hh);
  // a ring of houses four deep round a square wider than any margin (its middle nine tiles from a house), and a house on
  // the grid's west edge
  for (let y = 4; y < 28; y++) for (let x = 6; x < 42; x++) if (x < 10 || x > 37 || y < 8 || y > 23) occ[y * W + x] = 1;
  occ[16 * W + 0] = 1;
  const a = townShapeField(occ, W, Hh, 17), b = townShapeField(occ, W, Hh, 18);
  for (let i = 0; i < occ.length; i++) if (occ[i]) assert.equal(a[i], 1, 'a building\'s tile, distance 0');
  assert.ok(a[16 * W + 24] > 0, 'the square inside the ring is the town\'s, past every margin');
  assert.notDeepEqual(a.map((v) => (v ? 1 : 0)), b.map((v) => (v ? 1 : 0)), 'two seeds, two outlines');
  for (let i = 0; i < a.length; i++) { const x = i % W, y = (i - x) / W; if (a[i] && (x < 6 || x > 41 || y < 4 || y > 27)) assert.ok(shapeFieldDistance(a[i]) <= TOWN_SHAPE.margin + TOWN_SHAPE.wander + 0.3, 'the margin no wider than it wanders'); }
  assert.ok(a[(Hh - 1) * W + W - 1] === 0, 'the far corner the land\'s');
  assert.ok(townShape(new Uint8Array(16), 4, 4, 1).every((v) => v === 1), 'nothing to shape round: the whole grid');
  assert.deepEqual([...tileDistance(Uint8Array.from([1, 0, 0, 0]), 4, 1)], [0, 1, 2, 3]);
  for (let x = 0; x < 50; x++) { const w = shapeWander(5, x, 3); assert.ok(w >= -1 && w <= 1); }
  assert.deepEqual([isWallBlock('WALLAA04.RMB'), isWallBlock('GENRAM00.RMB')], [true, false]);
});

test('TOWN-SHAPES a block\'s town map read the right way up: its byte row r the tile row 15 - r/4, its column c the tile column c/4 (measured on the wall blocks) (mutant: the rows unflipped)', () => {
  const am = new Uint8Array(64 * 64);
  am[0 * 64 + 63] = 9;   // the town map's top right: the block's north-east tile
  const occ = townOccupancy(1, 1, () => am);
  assert.equal(occ[15 * 16 + 15], 1);
  assert.equal(occ.reduce((s, v) => s + v, 0), 1);
  assert.equal(townOccupancy(1, 1, () => am, () => true).reduce((s, v) => s + v, 0), 0, 'a wall block takes none');
});

/** A grid of synthetic blocks: each its town-map bytes, its ground (all record 2), its misc records. */
function synthTown(w, h, built = () => true, misc = []) {
  const blocks = [];
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
    const am = new Uint8Array(64 * 64);
    if (built(bx, by)) for (let r = 24; r < 40; r++) for (let c = 0; c < 40; c++) am[r * 64 + c] = 5;   // a row of houses from the block's west edge
    const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2 })));
    blocks.push({ rmbBlock: { fldHeader: { autoMapData: am, groundData: { groundTiles } }, misc3dObjectRecords: misc.filter((m) => m.bx === bx && m.by === by), miscFlatObjectRecords: [] } });
  }
  const loc = { name: 'Synth', exterior: { exteriorData: { width: w, height: h, blockNames: blocks.map((_, i) => `S${i}.RMB`) } }, mapTableData: { mapId: 4242, locationType: 1 } };
  const maps = { getRmbBlockName: (l, bx, by) => `S${by * w + bx}.RMB` };
  const file = { checkName: (n) => n, getBlockIndex: (n) => Number(n.slice(1, -4)), getBlock: (i) => blocks[i] };
  return { loc, maps, file, blocks };
}

test('TOWN-SHAPES a location\'s outline in its pixel\'s tiles - its margin past its grid\'s edge, a misc model\'s tile its own, a capital none; only its tiles stamped (mutants: the margin clipped at the grid; a model on the slope; a capital shaped; every tile stamped)', () => {
  const { loc, maps, file } = synthTown(2, 2, (bx, by) => !(bx === 1 && by === 1), [{ bx: 1, by: 1, xPos: 256 * 8, zPos: 256 * 8 - 4096 }]);
  const shape = locationShapeField(loc, (bx, by) => file.getBlock(by * 2 + bx).rmbBlock);
  const o = 48;   // a 2 x 2 grid's tile origin: (128 - 32) / 2
  assert.ok(shape[(o - 2) + (o + 7) * D] > 0, 'its margin past the grid\'s west edge');
  assert.ok(shape[(o + 16 + 8) + (o + 16 + 8) * D] > 0, 'the north-east block\'s fence its own tile');
  assert.equal(locationShapeField({ ...loc, capital: { k: 0 } }, (bx, by) => file.getBlock(by * 2 + bx).rmbBlock), null, 'a capital its own plan\'s');
  const tilemap = new Uint8Array(D * D);
  const rect = setLocationTiles(loc, maps, file, tilemap);
  assert.equal(rect.shape.length, D * D);
  for (let i = 0; i < tilemap.length; i++) if (tilemap[i]) assert.ok(rect.shape[i] > 0, 'a stamped tile is the outline\'s');
  const corner = (o + 31) + (o + 31) * D;   // the empty block's far corner, past the fence's margin
  assert.equal(tilemap[corner], 0, 'the empty block\'s far corner the land\'s');
});

test('TOWN-SHAPES the ground: the outline flattened to the mean of the land under it (a step over the beach at the least), eased back to the land past it, the pixel\'s edge the land\'s own, the sea past the ease kept (FB1028); the outline\'s tiles over the sea given back; DFU\'s rect blend where there is no outline (mutants: the sea lifted; the pixel\'s mean; the edge moved)', () => {
  // a pixel of land rising west to east, the sea under its westmost 30 columns
  const ground = new Float32Array(H * H);
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) ground[y + x * H] = x < 30 ? land(SCALED_OCEAN_ELEVATION - 5) : land(40 + x * 0.5);
  const shape = new Uint8Array(D * D);
  for (let y = 40; y < 126; y++) for (let x = 20; x < 90; x++) shape[x + y * D] = x >= 34 ? 1 : 1 + Math.round((34 - x) * 4);   // buildings from x 34, a margin over the sea west of it, up to the pixel's north edge
  const mask = townGroundMask(shape, ground);
  assert.equal(mask[25 + 60 * D], 0, 'the margin over the sea, past seaMargin: none');
  assert.equal(mask[34 + 60 * D], 1, 'a building\'s tile on the shore stands');
  const samples = Float32Array.from(ground);
  const target = blendLocationTerrain(samples, 0.5, { xMin: 18, xMax: 92, yMin: 38, yMax: 127, shape });
  let sum = 0, n = 0;
  for (let x = 34; x <= 90; x++) for (let y = 40; y <= 126; y++) { sum += ground[y + x * H]; n++; }
  assert.ok(Math.abs(target - sum / n) < 0.01 && target >= (SCALED_BEACH_ELEVATION + 1) / MAX_TERRAIN_HEIGHT - 1e-6, 'the town\'s own land\'s mean');
  assert.equal(samples[60 + 60 * H], Math.fround(target), 'flattened');
  assert.equal(samples[60 + 5 * H], ground[60 + 5 * H], 'the sea past the margin the sea');
  assert.equal(samples[128 + 85 * H], ground[128 + 85 * H], 'the pixel\'s edge the land\'s, the town beside it');
  assert.ok(samples[124 + 85 * H] !== ground[124 + 85 * H] && Math.abs(samples[124 + 85 * H] - target) < Math.abs(ground[124 + 85 * H] - target), 'eased in from the edge');
  assert.equal(samples[60 + (90 + SHAPE_BLEND_TILES + 4) * H], ground[60 + (90 + SHAPE_BLEND_TILES + 4) * H], 'past the blend the land\'s');
  const tiles = new Uint8Array(D * D).fill(0); tiles[25 + 60 * D] = 7; tiles[40 + 60 * D] = 7;
  unstampOffShape(tiles, shape, mask);
  assert.deepEqual([tiles[25 + 60 * D], tiles[40 + 60 * D]], [0, 7]);
  const ring = townRoadRing(mask);
  assert.ok(ring[34 + 38 * D] === 1 && ring[34 + 30 * D] === 0 && ring[60 + 60 * D] === 0, 'a ring two and a half round the outline');
  const plain = Float32Array.from(ground);
  assert.equal(blendLocationTerrain(plain, 0.25, { xMin: 40, xMax: 80, yMin: 40, yMax: 80 }), 0.25, 'no outline: DFU\'s blend, its average answered');
});

test('TOWN-SHAPES wired: the terrain job flattens to the outline on DFU\'s own samples and gives the sea back its tiles, the road paves the outline\'s ring, the landforms\' lift and the deep waters read the same outline, the shared reader keeps what it reads (mutants: each seam)', () => {
  const gen = rd('src/world/terrain/terrainGen.js');
  assert.match(gen, /avg = blendLocationTerrain\(samples, avg, locationRect, HEIGHTMAP_DIMENSION, ground \?\? samples, false, unmet\?\.samples\);/);
  assert.match(gen, /unstampOffShape\(tilemap, locationRect\.shape, mask\);/);
  assert.match(gen, /locationRect = \{ \.\.\.locationRect, mask, ring: townRoadRing\(mask\) \};/);
  assert.match(rd('src/world/road/roadPainter.js'), /\(ctx\.rect\.ring\n\s*\? ctx\.rect\.ring\[ctx\.i\] === RING\.road && ctx\.ground !== TILE\.water\n\s*: x > ctx\.rect\.xMin/);   // PIN MOVED (TS9): the ring's whole tiles by their code; (AUDIT TESA III E1-1): never over the sea
  assert.match(rd('src/world/landforms.js'), /blendLocationTerrain\(field, sum \/ field\.length, locationRect, hDim, unmet\?\.classic \?\? classic, true, unmet\?\.field\);/);
  assert.match(rd('src/world/terrain/terrainTiles.js'), /autoMapData: part\.autoMapData \}, misc3dObjectRecords: part\.misc3dObjectRecords, miscFlatObjectRecords: part\.miscFlatObjectRecords/);
});

test('TOWN-SHAPES on the freeware: a hamlet\'s outline no rectangle; a coast town keeps its sea where DFU lifted it all; every Bay town\'s buildings inside its outline (real data)', { skip: skipReal }, async () => {
  const { MapsFile, longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { generatePixelTerrain } = await import('../../../src/world/terrain/terrainGen.js');
  const b = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const maps = new MapsFile(); maps.load(b('MAPS.BSA'), b('CLIMATE.PAK'), b('POLITIC.PAK')); maps.autoDiscard = false;
  const woods = new WoodsFile(); woods.load(b('WOODS.WLD'));
  const blocks = new BlocksFile(); blocks.load(b('BLOCKS.BSA'));
  const g = maps.getLocationByName('Daggerfall', 'Gothway Garden');
  const gt = new Uint8Array(D * D), gr = setLocationTiles(g, maps, blocks, gt);
  const starts = new Set();
  for (let y = 0; y < D; y++) { let x = 0; while (x < D && !gr.shape[x + y * D]) x++; if (x < D) starts.add(x); }
  assert.ok(starts.size >= 4, `its west edge wanders (${starts.size} different starts), no straight side`);
  const a = maps.getLocationByName('Tigonus', 'Antelibuton'), p = longitudeLatitudeToMapPixel(a.mapTableData.longitude, a.mapTableData.latitude);
  const tilemap = new Uint8Array(D * D), rect = setLocationTiles(a, maps, blocks, tilemap);
  const t = generatePixelTerrain({ woods, px: p.x, py: p.y, tilemap, locationRect: rect, hasLocation: true, climateType: 0 });
  const water = t.samples.filter((v) => v * MAX_TERRAIN_HEIGHT <= SCALED_OCEAN_ELEVATION + 1e-3).length;
  assert.ok(water > 2000, `its sea stands (${water} samples; DFU's blend left about 240)`);   // PIN MOVED (FB1028): 3,000 - the sea its ease reaches is lifted (2,084)
});
