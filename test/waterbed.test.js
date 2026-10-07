// WATER-NEXT 2 - THE BED (world/waterBed.js): clear water must have something under it. The ground the eye sees is
// carved into a bowl under the water - the game's ground never moves - and the water's sheet keeps the grid as it
// stood, the bed's depth under each vertex. The record: bible/07-Rendering/Water-Arc.md WATER-NEXT 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waterBedDepths, carveBed, waterBedOf, flatGrid, bedProfile, BED_DEPTH, BED_RAMP, TILE } from '../src/world/waterBed.js';
import { buildTerrainGrid } from '../src/world/terrainSurface.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import { buildWaterIndices } from '../src/render/waterSurface.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const DRY = 1 << 2;   // record 1 (dirt), unturned - no water corner
const WET = 0;        // record 0, the water tile: all four corners
/** A converted tilemap `dim` square, `wet(x, z)` choosing each tile. */
const map = (dim, wet) => { const b = new Uint8Array(dim * dim); for (let z = 0; z < dim; z++) for (let x = 0; x < dim; x++) b[z * dim + x] = wet(x, z) ? WET : DRY; return b; };

test('WATER-NEXT 2 the profile: nothing at the bank, the whole depth past the ramp, a shallow shelf off the bank and a flat heart (mutants: a linear ramp; an ease-out\'s sliver of shallows; the depth unbounded)', () => {
  assert.equal(bedProfile(0), 0);
  assert.equal(bedProfile(1), 1);
  assert.equal(bedProfile(3), 1, 'never past the bed\'s depth');
  assert.equal(bedProfile(0.5), 0.5, 'halfway down at half the ramp');
  assert.ok(BED_DEPTH * bedProfile(TILE / BED_RAMP) < 1.1, 'a tile from the bank, the water is still shallow enough to see into');
  assert.ok(bedProfile(0.25) - bedProfile(0) < bedProfile(0.5) - bedProfile(0.25), 'the shelf falls slower than the slope');
  assert.deepEqual([BED_DEPTH, BED_RAMP, TILE], [4, 19.2, 6.4]);
});

test('WATER-NEXT 2 the depths: a vertex is wet only where every tile meeting it is water at that corner; a dry map has no bed; the bank is 0 and the heart of a lake the bed\'s depth (mutants: one vote enough; the chamfer\'s diagonal; the map\'s edge read as dry)', () => {
  assert.equal(waterBedDepths(map(16, () => false), { tileDim: 16 }), null, 'no water, no bed');
  // a lake: tiles 2..13 square in a 16 map - the vertices 2 and 14 are its banks, 3..13 under water
  const lake = waterBedDepths(map(16, (x, z) => x >= 2 && x <= 13 && z >= 2 && z <= 13), { tileDim: 16 });
  const at = (x, z) => lake[z * 17 + x];
  assert.equal(at(2, 8), 0, 'the bank: a dry tile meets it');
  assert.equal(at(14, 8), 0);
  assert.ok(at(3, 8) > 0 && at(3, 8) < BED_DEPTH, 'one cell in: under water, not yet deep');
  assert.ok(Math.abs(at(3, 8) - BED_DEPTH * bedProfile(TILE / BED_RAMP)) < 1e-5, 'a step of the chamfer is one cell');
  assert.ok(Math.abs(at(8, 8) - BED_DEPTH) < 1e-6, 'the heart: the whole depth');
  assert.equal(at(3, 8), at(13, 8), 'the same cell from either bank, the same depth');
  assert.equal(at(8, 3), at(3, 8), 'and from a bank across the grid\'s other axis');
  // an island: one dry tile in open water - the vertex off its corner has its bank on the DIAGONAL, the chamfer's 4
  const isle = waterBedDepths(map(16, (x, z) => !(x === 8 && z === 8)), { tileDim: 16 });
  assert.equal(isle[9 * 17 + 9], 0, 'the island\'s corner is a bank');
  assert.ok(Math.abs(isle[10 * 17 + 10] - BED_DEPTH * bedProfile((4 / 3) * TILE / BED_RAMP)) < 1e-5, 'the diagonal step is 4/3 of a cell');
  // one tile of water: no vertex is under it - the stream lies on its ground, as WATER1's
  assert.equal(waterBedDepths(map(16, (x, z) => x === 8 && z === 8), { tileDim: 16 }), null);
  // the sea to the map's edge: the edge is no bank (a pixel's seam is not dammed)
  const sea = waterBedDepths(map(16, (x) => x >= 8), { tileDim: 16 });
  assert.ok(sea[8 * 17 + 16] > 0, 'the edge vertex in open water is under it');
  assert.ok(sea[8 * 17 + 16] >= sea[8 * 17 + 15], 'and no shallower for the edge');
});

test('WATER-NEXT 2 the corners are the shader\'s: a shore tile\'s dry corner is a bank (mutants: the vote bits turned)', () => {
  const b = new Uint8Array(4).fill(WET);
  const d = waterBedDepths(b, { tileDim: 2 });
  assert.ok(d[1 * 3 + 1] > 0, 'the middle vertex of four water tiles is wet');
  const c = Uint8Array.of(WET, WET, WET, DRY);
  assert.equal(waterBedDepths(c, { tileDim: 2 })?.[4] ?? 0, 0, 'a dry tile north-east of it makes it the bank');
});

test('WATER-NEXT 2 the carve: the ground the eye sees lowered by the bed, the inputs untouched, the slopes re-lit where it reached; a strided grid\'s skirt follows its edge (mutants: the carve in place; the normals left flat; the skirt left)', () => {
  const H = HEIGHTMAP_DIMENSION;
  const samples = new Float32Array(H * H).fill(0.1);
  const grid = buildTerrainGrid(samples, 1);
  const bytes = map(128, (x, z) => x >= 40 && x <= 80 && z >= 40 && z <= 80);
  const before = grid.positions.slice();
  const bed = waterBedOf(grid, bytes, { stride: 1 });
  assert.deepEqual(grid.positions, before, 'the build\'s grid is the sheet, untouched');
  assert.equal(bed.sheet, grid.positions);
  const i = 60 * 129 + 60;
  assert.ok(Math.abs(bed.ground.positions[i * 3 + 1] - (before[i * 3 + 1] - BED_DEPTH)) < 1e-4, 'the heart lowered the whole depth');
  assert.equal(bed.ground.positions[10 * 3 + 1], before[10 * 3 + 1], 'dry ground stays');
  const bank = 60 * 129 + 41;
  assert.ok(bed.ground.normals[bank * 3] !== grid.normals[bank * 3], 'the bank\'s new slope lit');
  assert.ok(bed.ground.normals[bank * 3 + 1] < 1, 'tilted');
  // stride 4 with its skirt: the skirt under a carved edge vertex goes down with it
  const g4 = buildTerrainGrid(samples, 4);
  const sea = map(128, (x) => x >= 64);
  const b4 = waterBedOf(g4, sea, { stride: 4 });
  const g = 33, eastEdge = 3 * g;   // the east column's skirt starts after the south, north and west rows
  const v = 16 * g + 32;            // the east edge vertex in the sea
  assert.ok(b4.depths[v] > 0);
  const skirt = g * g + eastEdge + 16;
  assert.ok(Math.abs(b4.ground.positions[skirt * 3 + 1] - (g4.positions[skirt * 3 + 1] - b4.depths[v])) < 1e-4, 'the skirt follows');
  const carved = carveBed(grid.positions, grid.normals, new Float32Array(129 * 129), 129, 129);
  assert.deepEqual(carved.positions, grid.positions, 'no depth, no carve');
});

test('WATER-NEXT 2 the town\'s grid: DFU\'s flat ground as its tiles, the terrain\'s winding; the water quads over a town\'s real extent only (mutants: the padding\'s zeros read as water; the winding turned)', () => {
  const g = flatGrid(3, 2, -0.025, 6.4);
  assert.equal(g.positions.length, 4 * 3 * 3);
  assert.deepEqual([...g.positions.slice(0, 6)], [0, -0.025, 0, 6.4, -0.025, 0].map(Math.fround));
  assert.deepEqual([...g.indices.slice(0, 6)], [0, 4, 5, 0, 5, 1], 'buildTerrainIndices\' own triangles');
  // a 4-wide town in an 8-square tilemap padded with zeros (water): only the town's quads
  const bytes = new Uint8Array(64).fill(0);
  for (let z = 0; z < 2; z++) for (let x = 0; x < 4; x++) bytes[z * 8 + x] = DRY;
  bytes[0] = WET;
  const idx = buildWaterIndices(bytes, 1, undefined, 8, 4, 2);
  assert.deepEqual([...idx], [0, 5, 6, 0, 6, 1], 'one quad, in the 5-wide grid');
});

test('WATER-NEXT 2 the hosts: the world carves at the build and at a restride and keeps the bed for the cap\'s re-index; the fixed town lays its grid; the lab as the hosts (mutants: a host uploading the uncarved grid; the sheet off the terrain\'s buffers)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const bed = waterOn \? waterBedOf\(\{ positions, normals \}, tilemapBytes, \{ stride \}\) : null;/);
  assert.match(w, /const terrain = renderer\.createTerrainSurface\(bed\?\.ground\.positions \?\? positions, bed\?\.ground\.normals \?\? normals,/);
  assert.match(w, /const water = waterIndices \? renderer\.createWaterSheet\(waterIndices, waterSheetOf\(bed, terrain\)\) : null;/);
  assert.match(w, /const bed = waterOn \? waterBedOf\(grid, p\.tilemapBytes, \{ stride \}\) : null;/, 'the restride');
  assert.match(w, /p\.water = idx \? renderer\.createWaterSheet\(idx, waterSheetOf\(p\._bed, p\.terrain\)\) : null;/, 'the cap\'s re-index');
  assert.match(w, /_bed: bed \? \{ sheet: bed\.sheet, depths: bed\.depths \} : null,/);
  assert.match(w, /function waterSheetOf\(bed, terrain\) \{ return bed \? \{ positions: bed\.sheet, depths: bed\.depths \} : \{ terrain \}; \}/);
  const e = read('src/scenes/exterior.js');
  assert.match(e, /const townBed = townGrid \? waterBedOf\(townGrid, tilemapBytes, \{ tileDim: tilemapDim, width: loc\.width \* GROUND_TILE_DIM, height: loc\.height \* GROUND_TILE_DIM \}\) : null;/);
  assert.match(e, /renderer\.drawWaterSurface\(townWater, identityMatrix,/);
  assert.match(read('src/tools/waterLab.js'), /renderer\.createWaterSheet\(waterIndices, bed \? \{ positions: bed\.sheet, depths: bed\.depths \} : \{ terrain \}\)/);
  // the game's ground is the samples', never the drawn grid's
  assert.doesNotMatch(w.slice(w.indexOf('const heightAt = (x, z, terrainOnly = false) => {'), w.indexOf('// BLOOD1 AUDIT 3: WHERE THE GROUND IS DRAWN.')), /positions|_bed/);
});
