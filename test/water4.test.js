// WATER4 (2026-09-11, Mac: "its still not taking into account all the
// water textures that are on land, and its not traced well, just
// square. Water is also still way too see through"): THE ART'S OWN
// WATER - and WATER5 the same day ("it's still not a perfect trace"):
// PER TEXEL. The leaf EXECUTES on synthetic 64x64 indexed bitmaps: the
// water palette learned from record 0 (widened by colour, test/water5),
// the per-texel mask in the record's own frame, the four turns as
// TERRAIN_FS applies them, the NEAREST texel under a point as the
// ground samples it, the any and corner tables, and the feet crossing
// into water exactly where the texel is water (a puddle no corner
// reaches included). Mutants: the turn tables swapped (t1 for t3)
// change the corner masks and the reads; the water set inverted marks
// dirt as water; the puddle's `any` dropped keeps it out of the pass.
// The shader, the renderer, the hosts and the lab are pinned in
// test/water5.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ART_SIZE, ART_TURN, waterIndexSet, recordMask, artTexel, artDistance, artCoverage, artCornerMask, buildWaterArt, SDF_RANGE,
} from '../src/world/waterArt.js';
import { buildWaterIndices, tilemapRectHasWater, SHALLOW_OPACITY, WATER_OPACITY } from '../src/render/waterSurface.js';
import { basinDepths, flatDepths } from '../src/render/waterBasin.js';
import { WATER_MASK_TABLE, waterCoverage } from '../src/world/waterCorners.js';
import { feetWaterCoverage, exteriorSurfaces, SWIM_COVERAGE, ON_EXTERIOR_WATER } from '../src/player/exteriorSurface.js';
import { createLookupTable } from '../src/world/terrainTiles.js';
import { convertTile } from '../src/world/terrainSurface.js';

// a 64x64 indexed record: index 200 where `wet(x, y)`, else 1 (dirt)
const bm = (wet) => {
  const data = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) data[y * 64 + x] = wet(x, y) ? 200 : 1;
  return { width: 64, height: 64, data };
};
const WATER = 0, DIRT = 1, HALF = 2, PUDDLE = 3, DIAG = 4, LINE = 5;
const BITMAPS = [
  bm(() => true),                                              // 0: the water tile, and so the water palette
  bm(() => false),                                             // 1: dirt
  bm((x) => x < 32),                                           // 2: water on the left half (u < 0.5)
  bm((x, y) => x >= 16 && x < 48 && y >= 16 && y < 48),        // 3: a puddle no corner reaches
  bm((x, y) => x + y < 64),                                    // 4: the diagonal, one dry corner at (1,1)
  bm((x) => x === 20),                                         // 5: a one-texel stream - what WATER4's cells smeared away
];
const ART = buildWaterArt(BITMAPS);
const byte = (r, t = 0) => (r << 2) | t;
// the raw byte as the tilemap carries it: the record in the low six bits, the turn's two bits above (convertTile makes record << 2 | turn of it)
const rawFor = (r, t) => { const raw = r | (t << 6); assert.equal(convertTile(raw), byte(r, t)); return raw; };

test('WATER4/5: the art is read off the bitmaps PER TEXEL - record 0 is the water palette, the mask is the art\'s own texels in the record\'s frame, a one-texel stream survives, and an archive without a record 0 has no art', () => {
  assert.equal(ART_SIZE, 64, 'the classic terrain tile');
  assert.equal(ART.size, 64); assert.equal(ART.records, 6);
  assert.equal(ART.mask.length, 6 * 4096); assert.equal(ART.sdf.length, 6 * 4096);
  assert.deepEqual([...waterIndexSet(BITMAPS[WATER])], [200], 'the water tile\'s indices, nothing else (no palette: no widening)');
  const mask = (r) => ART.mask.subarray(r * 4096, r * 4096 + 4096);
  assert.ok(mask(WATER).every((c) => c === 1), 'the water tile is all water');
  assert.ok(mask(DIRT).every((c) => c === 0), 'dirt has none');
  for (let i = 0; i < 4096; i++) {
    assert.equal(mask(HALF)[i], BITMAPS[HALF].data[i] === 200 ? 1 : 0, `half: texel ${i} is the art's`);
    assert.equal(mask(PUDDLE)[i], BITMAPS[PUDDLE].data[i] === 200 ? 1 : 0, `puddle: texel ${i} is the art's`);
    assert.equal(mask(LINE)[i], BITMAPS[LINE].data[i] === 200 ? 1 : 0, `stream: texel ${i} is the art's - one texel wide, kept whole`);
  }
  assert.equal(mask(LINE).reduce((s, v) => s + v, 0), 64, 'the stream is sixty-four texels, none lost');
  // an empty record (the archive does not carry it), a record of another size, and a record past the art are dry
  assert.ok(recordMask({ width: 0, height: 0, data: null }, new Set([200])).every((c) => c === 0));
  assert.ok(recordMask({ width: 32, height: 32, data: new Uint8Array(1024).fill(200) }, new Set([200])).every((c) => c === 0), 'not the tile\'s size: not trusted');
  assert.equal(artDistance(ART, byte(9), 0.5, 0.5), -SDF_RANGE, 'a record the art has no layer for is dry');
  assert.equal(buildWaterArt([]), null);
  assert.equal(buildWaterArt([{ width: 0, height: 0, data: null }]), null, 'no record 0, no palette to learn');
  assert.equal(buildWaterArt(null), null);
  // mutant: the water set inverted marks the dirt as water
  assert.ok(recordMask(BITMAPS[DIRT], new Set([1])).every((c) => c === 1), 'the set decides, so an inverted set is caught here');
});

test('WATER4/5: the CPU read is the ground\'s - the four turns as TERRAIN_FS applies them, the NEAREST texel with the edge clamped, never a neighbour record\'s (mutant: t1 and t3 swapped)', () => {
  assert.deepEqual(ART_TURN[0](0.25, 0.75), [0.25, 0.75]);
  assert.deepEqual(ART_TURN[1](0.25, 0.75), [0.75, 0.75]);   // (y, 1 - x)
  assert.deepEqual(ART_TURN[2](0.25, 0.75), [0.75, 0.25]);   // (1 - x, 1 - y)
  assert.deepEqual(ART_TURN[3](0.25, 0.75), [0.25, 0.25]);   // (1 - y, x)
  // the texel under a point, as texture() NEAREST with CLAMP_TO_EDGE reads it: floor(u * 64), 63 at u = 1
  assert.deepEqual(artTexel(ART, byte(HALF, 0), 0, 0), [0, 0]);
  assert.deepEqual(artTexel(ART, byte(HALF, 0), 0.5, 0.5), [32, 32]);
  assert.deepEqual(artTexel(ART, byte(HALF, 0), 1, 1), [63, 63], 'the far edge is the last texel, not the next record');
  assert.deepEqual(artTexel(ART, byte(HALF, 0), -1, 2), [0, 63], 'clamped');
  assert.deepEqual(artTexel(ART, byte(HALF, 1), 0.25, 0.75), [48, 48], 'turned once: (y, 1 - x)');
  // the half record through each turn: where its water lands in the tile's frame
  const at = (r, t, x, y) => artCoverage(ART, byte(r, t), x, y);
  assert.equal(at(HALF, 0, 0.25, 0.5), 1); assert.equal(at(HALF, 0, 0.75, 0.5), 0);   // unturned: the left
  assert.equal(at(HALF, 1, 0.5, 0.25), 1); assert.equal(at(HALF, 1, 0.5, 0.75), 0);   // t1: the top (y < 0.5)
  assert.equal(at(HALF, 2, 0.75, 0.5), 1); assert.equal(at(HALF, 2, 0.25, 0.5), 0);   // t2: the right
  assert.equal(at(HALF, 3, 0.5, 0.75), 1); assert.equal(at(HALF, 3, 0.5, 0.25), 0);   // t3: the bottom
  // per texel: a step from one texel to the next is the whole answer, no blend between them
  assert.equal(at(HALF, 0, 31.9 / 64, 0.5), 1); assert.equal(at(HALF, 0, 32.1 / 64, 0.5), 0);
  assert.equal(at(LINE, 0, 20.5 / 64, 0.5), 1, 'the one-texel stream is water on its texel...');
  assert.equal(at(LINE, 0, 19.5 / 64, 0.5), 0); assert.equal(at(LINE, 0, 21.5 / 64, 0.5), 0, '...and dry a texel either side');
  // the diagonal: water under x + y < 64 in texels
  assert.equal(at(DIAG, 0, 0.25, 0.25), 1); assert.equal(at(DIAG, 0, 0.75, 0.75), 0);
  // the clamp: past the tile's edge the read is the edge texel, never a neighbour record's
  assert.equal(at(HALF, 0, -1, 0.5), 1); assert.equal(at(HALF, 0, 2, 0.5), 0);
  assert.equal(at(WATER, 0, 0.5, 1.5), 1, 'the water tile\'s last row, not the dirt record after it');
  assert.equal(at(DIRT, 0, 0.5, -0.5), 0, 'the dirt record\'s first row, not the water record before it');
  // mutant: t1 and t3 swapped - the top and the bottom trade places
  const swapped = [ART_TURN[0], ART_TURN[3], ART_TURN[2], ART_TURN[1]];
  const [u1, v1] = swapped[1](0.5, 0.25);
  assert.notEqual(ART.mask[HALF * 4096 + Math.floor(v1 * 64) * 64 + Math.floor(u1 * 64)], at(HALF, 1, 0.5, 0.25), 'the swap reads the other half');
});

test('WATER4/5: the tables by converted byte - `any` admits a puddle no corner reaches, `corners` are the corner TEXELS through the turn, and both feed the quads, the basin and the town gate', () => {
  for (let t = 0; t < 4; t++) {
    assert.equal(ART.any[byte(WATER, t)], 1); assert.equal(ART.any[byte(DIRT, t)], 0);
    assert.equal(ART.any[byte(HALF, t)], 1); assert.equal(ART.any[byte(PUDDLE, t)], 1, 'the puddle enters the pass'); assert.equal(ART.any[byte(LINE, t)], 1, 'so does the stream');
    assert.equal(ART.corners[byte(WATER, t)], 0xF); assert.equal(ART.corners[byte(DIRT, t)], 0);
    assert.equal(ART.corners[byte(PUDDLE, t)], 0, 'the puddle reaches no corner - the basin leaves its tile alone');
    assert.equal(ART.corners[byte(LINE, t)], 0, 'nor does the stream');
  }
  assert.deepEqual([0, 1, 2, 3].map((t) => ART.corners[byte(HALF, t)]), [0b0101, 0b0011, 0b1010, 0b1100], 'the half: left, top, right, bottom');
  assert.deepEqual([0, 1, 2, 3].map((t) => ART.corners[byte(DIAG, t)]), [0b0111, 0b1011, 0b1110, 0b1101], 'the diagonal: the dry corner walks round');
  assert.equal(artCornerMask(ART, byte(DIAG, 0)), 0b0111);
  // the quads: a puddle tile has a quad by the art, none by the corner table
  const dim = 128, bytes = new Uint8Array(dim * dim).fill(byte(DIRT));
  bytes[5 + 5 * dim] = byte(PUDDLE);
  assert.equal(buildWaterIndices(bytes, 1), null, 'the corner table: no water');
  assert.equal(buildWaterIndices(bytes, 1, ART.any)?.length, 6, 'the art: the puddle\'s one quad');
  assert.equal(basinDepths(bytes, 1, dim, ART.corners), null, 'and no basin under it (no vertex is wet)');
  // the town gate by the art
  assert.equal(tilemapRectHasWater(bytes, dim, 8, 8), false);
  assert.equal(tilemapRectHasWater(bytes, dim, 8, 8, ART.any), true);
  // the half record carves as WATER1's edge would
  const shore = new Uint8Array(dim * dim).fill(byte(DIRT));
  for (let y = 0; y < dim; y++) for (let x = 0; x < 64; x++) shore[x + y * dim] = byte(WATER);
  for (let y = 0; y < dim; y++) shore[64 + y * dim] = byte(HALF);   // water on its left half: the shore runs down x = 64.5
  const d = basinDepths(shore, 1, dim, ART.corners);
  assert.ok(d, 'a basin');
  assert.equal(d[65 + 10 * (dim + 1)], 0, 'the vertex at x = 65: the half tile\'s right corners are dry - the bank');
  assert.ok(d[64 + 10 * (dim + 1)] > 0 && d[64 + 10 * (dim + 1)] < 0.5, 'the vertex at x = 64: one ring off the bank');
  assert.ok(d[60 + 10 * (dim + 1)] > d[64 + 10 * (dim + 1)], 'deeper away from the bank');
  // the flat sheet: every vertex at zero, buildTerrainGrid's count
  const flat = flatDepths(1, dim);
  assert.equal(flat.length, (dim + 1) ** 2); assert.ok(flat.every((v) => v === 0));
  assert.equal(flatDepths(4, dim).length, 33 * 33);
});

test('WATER4/5: the feet read the art texel-exact - the player swims where the texel under the feet is water, a puddle and a one-texel stream included, and the corner table answers where no art is read', () => {
  assert.equal(feetWaterCoverage(rawFor(HALF, 0), [0.25, 0.5], ART), 1, 'in the half tile\'s water');
  assert.equal(feetWaterCoverage(rawFor(HALF, 0), [0.75, 0.5], ART), 0, 'on its dirt');
  assert.equal(feetWaterCoverage(rawFor(HALF, 2), [0.75, 0.5], ART), 1, 'turned twice: the water is on the right');
  assert.equal(feetWaterCoverage(rawFor(PUDDLE, 0), [0.5, 0.5], ART), 1, 'the puddle\'s middle');
  assert.equal(feetWaterCoverage(rawFor(PUDDLE, 0), [0.05, 0.05], ART), 0, 'its corner');
  assert.equal(feetWaterCoverage(rawFor(LINE, 0), [20.5 / 64, 0.5], ART), 1, 'standing in the stream');
  assert.equal(feetWaterCoverage(rawFor(LINE, 0), [22.5 / 64, 0.5], ART), 0, 'two texels off it');
  assert.ok(feetWaterCoverage(rawFor(DIAG, 0), [0.25, 0.25], ART) >= SWIM_COVERAGE);
  assert.ok(feetWaterCoverage(rawFor(DIAG, 0), [0.75, 0.75], ART) < SWIM_COVERAGE);
  assert.equal(SWIM_COVERAGE, 0.5, 'the fold\'s midpoint: at or past it the texel is water');
  // no art: MAC2's corner read, untouched (the marching squares' own byte)
  const raw = createLookupTable()[0b0011];
  assert.ok(Math.abs(feetWaterCoverage(raw, [0.5, 0.9]) - waterCoverage(WATER_MASK_TABLE[convertTile(raw)], 0.5, 0.9)) < 1e-9);
  assert.ok(Math.abs(feetWaterCoverage(raw, [0.5, 0.9], null) - 0.9) < 1e-9);
  assert.equal(feetWaterCoverage(null, [0.5, 0.5], ART), null);
  // through exteriorSurfaces: the puddle swims, its dirt is DFU's dry (a record DFU has no water law for)
  const probe = { hit: true, terrain: true, staticGeometry: false, dist: 0.9 };
  const { Swimming, None } = ON_EXTERIOR_WATER;
  assert.equal(exteriorSurfaces({ rawTile: rawFor(PUDDLE, 0), feet: [0.5, 0.5], art: ART, probe }).water, Swimming, 'the player swims in the puddle the art paints');
  assert.equal(exteriorSurfaces({ rawTile: rawFor(PUDDLE, 0), feet: [0.05, 0.05], art: ART, probe }).water, None);
  assert.equal(exteriorSurfaces({ rawTile: rawFor(PUDDLE, 0), feet: [0.5, 0.5], art: null, probe }).water, None, 'without the art the record is dry, as MAC2 left it');
  // the glass: Mac's "still way too see through" (0.30 before WATER4)
  assert.ok(SHALLOW_OPACITY >= 0.75 && SHALLOW_OPACITY < WATER_OPACITY, `the shallows are ${SHALLOW_OPACITY} opaque`);
});
