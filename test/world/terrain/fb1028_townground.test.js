// FB1028 TOWN-GROUND (FIELD BUGS 2026-10-28, Discord after #1184 shipped TOWN-SHAPES TS2: Westhead Moor "Weird crop
// hovering, giant craters and cliffs on the outskirts"; Aldwall Rock "big holes and uhm.. cubic mistakes ... The ports are
// now off a cliff instead of smooth?"; bible/03-World/Town-Shapes.md TS2, FB1028). TS2 flattened a town to its own land's
// mean and kept the sea right beside it, so a port stood 30-46 m over the water on a cliff; it eased back over 12 samples
// whatever the height to cover, so a hillside town stood in a crater or on a wall; near the pixel's edge its own ground was
// eased too; and a crop field's plants stood on the plane where only its record's tile was the town's. Synthetic pins here
// (each fails on TS2's law); the game's own towns in fb1028_townground_real.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blendLocationTerrain, townGroundMask, locationShapeField, outlineOfBasis, setLocationTiles, SHAPE_GRADE, SHAPE_BLEND_TILES, SHAPE_EDGE_TILES } from '../../../src/world/terrain/terrainTiles.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, SCALED_OCEAN_ELEVATION, TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { shapeFieldDistance, TOWN_SHAPE } from '../../../src/world/townShape.js';
import { registerFlatField, sowField } from '../../../src/world/flatFields.js';
import { BAKE_GENERATOR_VERSION } from '../../../src/world/deepWater/deepWatersBakeCache.js';
import { etherPlaceRects, etherRectAt } from '../../../src/world/etherWatersBake.js';
import { locationRectReader } from '../../../src/world/terrain/terrainTiles.js';
import { prefetchGroundTiles, _flushGroundTiles, _resetGroundTiles } from '../../../src/world/terrain/groundTilesKept.js';
import { setWorldDataDoor } from '../../../src/formats/worldData/worldDataDoor.js';
import { etherTemplateOf, etherPlaceId, synthesizeEtherLocation } from '../../../src/world/etherPlaces.js';
import { veilhaven, islesNear } from '../../../src/world/ethericSea.js';

const H = HEIGHTMAP_DIMENSION, D = 128, M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, SAMPLE = TERRAIN_SIZE / (H - 1);
const SEA = Math.fround(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT);
const norm = (m) => Math.fround(m / M);
/** The ease's steepest added rise between two samples, metres: the smoothstep's 1.5 times its grade. */
const STEEPEST = 1.5 * SHAPE_GRADE * SAMPLE;
/** The most a blend steepens any step between neighbouring samples over the land's own, metres. */
function added(after, before) {
  let worst = 0;
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (x + dx >= H || y + dy >= H) continue;
    const i = x * H + y, j = (x + dx) * H + y + dy;
    worst = Math.max(worst, (Math.abs(after[i] - after[j]) - Math.abs(before[i] - before[j])) * M);
  }
  return worst;
}
/** A shape: tiles x0..x1, y0..y1 buildings (code 1), and a margin of `m` tiles round them coded by its distance. */
function shapeOf(x0, x1, y0, y1, m) {
  const shape = new Uint8Array(D * D);
  for (let y = Math.max(0, y0 - m); y <= Math.min(D - 1, y1 + m); y++) for (let x = Math.max(0, x0 - m); x <= Math.min(D - 1, x1 + m); x++) {
    const d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
    if (d <= m) shape[x + y * D] = 1 + Math.round(d * 4);
  }
  return shape;
}
const ground = (f) => { const g = new Float32Array(H * H); for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) g[y + x * H] = f(x, y); return g; };
const blend = (g, shape) => { const s = Float32Array.from(g); const target = blendLocationTerrain(s, 0.5, { xMin: 0, xMax: 127, yMin: 0, yMax: 127, shape }, H, Float32Array.from(g)); return { s, target }; };
/** Every sample a tile of the town's ground touches. */
const insideOf = (mask) => { const out = []; for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) if (mask[x + y * D]) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) out.push((x + a) * H + y + b); return out; };
/** AUDIT FB1028 A2: every sample a tile of the town's ground within a tile of a building's touches (a model overhangs). */
const stoodOf = (shape, mask) => insideOf(mask.map((v, i) => (v && shapeFieldDistance(shape[i]) <= 1 ? 1 : 0)));

test('FB1028 the shore: a town over its sea meets it on a slope no steeper than SHAPE_GRADE allows - the sea it needs lifted, the sea past it kept; TS2 kept the sea a sample off its ground and stood a cliff there (mutants: the sea never lifted; the grade unread)', () => {
  // the sea west of x = 40, the land rising a metre a sample from 36 m; a town's buildings from x 42, its margin over the sea
  const g = ground((x) => (x < 40 ? SEA : norm(36 + (x - 40))));
  const shape = shapeOf(42, 90, 30, 100, 6);
  const { s, target } = blend(g, shape);
  const mask = townGroundMask(shape, Float32Array.from(g));
  assert.equal(mask[38 + 60 * D], 0, 'the margin over the sea, past seaMargin: no ground of the town\'s');
  for (const i of insideOf(mask)) assert.equal(s[i], Math.fround(target), 'the town\'s ground flat at its level');
  assert.ok(target * M > 55, `the town stands ${(target * M - 34).toFixed(1)} m over its sea`);
  const worst = added(s, g);
  assert.ok(worst <= STEEPEST + 0.25, `no step at the shore: the blend steepens a step by ${worst.toFixed(2)} m at most (its grade allows ${STEEPEST.toFixed(2)})`);
  assert.ok(s[60 + 38 * H] * M > 34.01, 'the sea beside the town lifted into its shore');
  assert.equal(s[60 + 5 * H], g[60 + 5 * H], 'the sea past the ease kept');
});

test('FB1028 the hillside: a town far over the land it eases back to eases as far as it needs at SHAPE_GRADE, never over TS2\'s 12 samples whatever the drop - no wall at its edge, no crater (mutants: the ease its 12 samples alone; the reach read off the blended samples)', () => {
  // a hillside falling 2.5 m a sample east: the town flattened to its own land's mean stands far over its downhill edge
  // and far under its uphill one
  const g = ground((x) => norm(330 - 2.5 * Math.min(116, Math.max(12, x))));
  const shape = shapeOf(30, 60, 30, 100, 4);
  const { s, target } = blend(g, shape);
  assert.ok(target * M > 200 && target * M < 240, `the town at its land's mean (${(target * M).toFixed(2)} m)`);
  const worst = added(s, g);
  assert.ok(worst <= STEEPEST + 0.25, `the blend steepens a step by ${worst.toFixed(2)} m at most (its grade allows ${STEEPEST.toFixed(2)})`);
  assert.ok(worst > STEEPEST * 0.8, `the grade reached (${worst.toFixed(2)} m): the ease runs at SHAPE_GRADE where it must`);
  assert.ok(s[60 + 80 * H] * M > 120, `the slope below the town eased up past TS2's twelve samples (${(s[60 + 80 * H] * M).toFixed(1)} m where the land is ${(g[60 + 80 * H] * M).toFixed(1)} m)`);
  assert.ok(s[60 + 16 * H] * M < 280, `the slope above it eased down (${(s[60 + 16 * H] * M).toFixed(1)} m where the land is ${(g[60 + 16 * H] * M).toFixed(1)} m)`);
  assert.equal(s[60 + 128 * H], g[60 + 128 * H], 'the pixel\'s edge the land\'s own');
  // where the town stands near its land the ease is TS2's own: SHAPE_BLEND_TILES at the least
  const gentle = ground((x) => norm(120 + Math.max(0, x - 64) * 0.5)), g2 = blend(gentle, shape);
  assert.ok(g2.s[60 + (64 + SHAPE_BLEND_TILES - 2) * H] !== gentle[60 + (64 + SHAPE_BLEND_TILES - 2) * H], 'eased within the twelve samples');
  assert.equal(g2.s[60 + (64 + SHAPE_BLEND_TILES + 2) * H], gentle[60 + (64 + SHAPE_BLEND_TILES + 2) * H], 'its own past them');
});

test('FB1028 the pixel\'s edge: a town\'s margin keeps off the band its ease needs to meet the edge\'s own ground, its own ground flat to the last sample and the edge the land\'s; TS2 eased the town\'s own ground in its last four samples (mutants: the band unread; the band SHAPE_EDGE_TILES alone; the edge share unread)', () => {
  // the land level at 100 m, rising 6 m a sample over the last 8 to the south edge; the town's margin to y 1
  const g = ground((x, y) => norm(100 + 6 * Math.max(0, 8 - y)));
  const shape = shapeOf(20, 100, 9, 100, 8);
  const { s, target } = blend(g, shape);
  const mask = townGroundMask(shape, Float32Array.from(g));
  for (let y = 0; y < 16; y++) for (let x = 24; x < D - 24; x++) {   // the south edge the nearest side
    if (!shape[x + y * D] || shapeFieldDistance(shape[x + y * D]) <= TOWN_SHAPE.seaMargin) continue;
    if (y < (48 / (SHAPE_GRADE * SAMPLE))) assert.equal(mask[x + y * D], 0, `the margin's tile (${x}, ${y}) in the band the ease needs`);
  }
  assert.equal(mask[60 + 2 * D], 0, 'nor within SHAPE_EDGE_TILES');
  for (const i of insideOf(mask)) assert.equal(s[i], Math.fround(target), 'every sample of the town\'s ground at its level');
  for (let x = 0; x < H; x++) assert.equal(s[0 + x * H], g[0 + x * H], 'the edge the land\'s own');
  const worst = added(s, g);
  assert.ok(worst <= 48 / 7 + 0.25, `the edge met over the room the buildings leave (${worst.toFixed(2)} m)`);
  // the same town on level land keeps its margin to SHAPE_EDGE_TILES of the edge
  const level = townGroundMask(shape, Float32Array.from(ground(() => norm(100))));
  assert.equal(level[60 + SHAPE_EDGE_TILES * D], 1, 'level land: the margin to the band\'s least');
  assert.equal(level[60 + (SHAPE_EDGE_TILES - 1) * D], 0);
  // a town whose own buildings stand in the band: its ground flat under them to the last sample but the edge's
  // PIN MOVED (AUDIT FB1028 A2): every sample a building stands on, not every sample of its ground - the margin's in the
  // band eases with the seam
  const near = shapeOf(20, 100, 1, 100, 4), n2 = blend(g, near), m2 = townGroundMask(near, Float32Array.from(g));
  for (const i of stoodOf(near, m2)) if (i % H !== 0) assert.equal(n2.s[i], Math.fround(n2.target), 'its buildings\' ground at its level');
  for (let x = 0; x < H; x++) assert.equal(n2.s[0 + x * H], g[0 + x * H], 'the edge the land\'s own under its buildings too');
});

test('AUDIT FB1028 A2 the seam: where a town\'s own ground reaches the band its seam needs, the run eases from its last stood sample out to the edge - FB1028 kept the margin at the town\'s level to the edge\'s last sample but one, a cliff there (mutants: the band\'s run unread; the stood samples unread)', () => {
  // the land level at 100 m, rising 6 m a sample over the last 8 to the south edge (148 m there); buildings from y 3, x 30
  const g = ground((x, y) => norm(100 + 6 * Math.max(0, 8 - y)));
  const shape = shapeOf(30, 90, 3, 100, 6), { s, target } = blend(g, shape), mask = townGroundMask(shape, Float32Array.from(g));
  assert.equal(mask[60 + 2 * D], 1, 'the margin\'s tile beside the buildings is the town\'s ground in the band');
  for (const i of stoodOf(shape, mask)) assert.equal(s[i], Math.fround(target), 'every sample a building stands on at the level');
  for (let x = 0; x < H; x++) assert.equal(s[0 + x * H], g[0 + x * H], 'the edge the land\'s own');
  // the core's corner tile (29, 2), a tile and a half off the buildings, is the town's ground no model reaches: it
  // eases with the seam, FB1028 held it at the level
  assert.ok(shapeFieldDistance(shape[29 + 2 * D]) > 1 && mask[29 + 2 * D] === 1, 'the corner\'s tile the town\'s, past a tile');
  const corner = s[2 + 29 * H];
  assert.ok(corner > target + norm(1) && corner < g[2 + 29 * H], `the corner eased toward the edge (${((corner - target) * M).toFixed(2)} m over the level)`);
  // buildings on the edge row itself: the edge still the land's (mutant: the edge row blended)
  const onEdge = blend(g, shapeOf(30, 90, 0, 100, 6)).s;
  for (let x = 0; x < H; x++) assert.equal(onEdge[0 + x * H], g[0 + x * H], 'the edge the land\'s own under buildings on it');
});

test('AUDIT FB1028 A3 tall relief: the departure the ease keeps never falls as the land stands further off its town at the same distance, so a hill beside a town keeps its order - FB1028 read each sample\'s reach off its own height and dug a pit on the flank (mutants: the cone unread; the smoothstep alone)', () => {
  // a town at 200 m; east of it the land climbs 10 m a sample northward, 0 to 280 m over the town's level
  const g = ground((x, y) => norm(200 + (x > 78 ? 10 * Math.max(0, Math.min(28, y - 50)) : 0)));
  const shape = shapeOf(54, 70, 54, 70, 3), { s, target } = blend(g, shape);
  assert.ok(Math.abs(target * M - 200) < 0.5, 'the town at its land\'s level');
  for (const x of [80, 84, 90, 100, 110]) {
    let last = -Infinity;
    for (let y = 54; y <= 70; y++) {
      const off = (s[y + x * H] - target) * M;
      assert.ok(off >= last - 1e-3, `x ${x}, y ${y}: the eased ground ${off.toFixed(2)} m over the town, under ${last.toFixed(2)} m beside land lower`);
      last = off;
    }
  }
  assert.ok((s[70 + 90 * H] - target) * M > 40, 'the hill kept as far over the town as the cone allows');
});

test('FB1028 every blend of a pixel eases alike: the shaped samples less DFU\'s own are the landforms\' lift blended (its reach read on DFU\'s ground alone), so a record\'s lift, the tiles and the Deep Waters bake read the ground the stream lays; the bake\'s key moved (mutants: the reach read off the blended field)', () => {
  const classic = ground((x, y) => (x < 30 ? SEA : norm(40 + (x - 30) * 1.2 + 10 * Math.sin(y / 9))));
  const shaped = ground((x, y) => (x < 30 ? SEA : classic[y + x * H] + norm(15 + 8 * Math.cos(x / 11))));
  const shape = shapeOf(40, 80, 30, 90, 5);
  const rect = { xMin: 0, xMax: 127, yMin: 0, yMax: 127, shape };
  const g = Float32Array.from(classic), a = Float32Array.from(shaped), b = Float32Array.from(classic);
  blendLocationTerrain(a, 0.5, rect, H, g);
  blendLocationTerrain(b, 0.5, rect, H, g);
  const field = shaped.map((v, i) => v - classic[i]);
  let sum = 0; for (const v of field) sum += v;
  blendLocationTerrain(field, sum / field.length, rect, H, Float32Array.from(classic), true);
  let worst = 0;
  for (let i = 0; i < field.length; i++) worst = Math.max(worst, Math.abs((a[i] - b[i]) - field[i]) * M);
  assert.ok(worst < 0.01, `the lift blended is the blends' difference to ${worst.toFixed(4)} m`);
  assert.equal(BAKE_GENERATOR_VERSION, 4, 'PIN MOVED (AUDIT FB1028 A2-A3): the ease at the seam and beside tall relief (was 3); the sea a town\'s ease needs lifted (was 2)');
});

test('FB1028 CROP-GROUND: a field of flats is the town\'s ground under every plant it sows - its record\'s tile alone left the rest over the land\'s slope and the sea (mutants: the fields unread; the field\'s half-range unread)', () => {
  registerFlatField(990001, { rangeX: 85, rangeZ: 35, spacing: 4, noise: 0.5 });
  const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2 })));
  const am = new Uint8Array(64 * 64);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) am[r * 64 + c] = 5;   // one house in the north-west corner
  const rec = { modelIdNum: 990001, xPos: 2048, zPos: -1024, yPos: 0 };   // the block's middle west to east, north of it
  const rmb = { fldHeader: { autoMapData: am, groundData: { groundTiles } }, misc3dObjectRecords: [rec], miscFlatObjectRecords: [] };
  const loc = { exterior: { exteriorData: { width: 1, height: 1, blockNames: ['F.RMB'] } }, mapTableData: { mapId: 77, locationType: 2 } };
  const shape = locationShapeField(loc, () => rmb);
  const o = 56;   // a 1 x 1 grid's tile origin: (128 - 16) / 2
  const plants = sowField({ rangeX: 85, rangeZ: 35, spacing: 4, noise: 0.5 }, 504, rec.xPos * 0.025, 0, (rec.zPos + 4096) * 0.025);
  assert.ok(plants.length > 150, `${plants.length} plants`);
  for (const p of plants) {
    const tx = o + Math.floor(p.x / 6.4), ty = o + Math.floor(p.z / 6.4);
    assert.equal(shape[tx + ty * D], 1, `a plant at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) on the town's own tile`);
  }
  // a walled city past the Bay (TS4): its round is its buildings' alone - a field far from them is not walled in
  const house = { fldHeader: { autoMapData: am, groundData: { groundTiles } }, misc3dObjectRecords: [], miscFlatObjectRecords: [] };
  registerFlatField(990002, { rangeX: 35, rangeZ: 35, spacing: 4, noise: 0.5 });   // 17 m and the nudge each way: to tile 10.8
  const far = { ...rmb, fldHeader: { ...rmb.fldHeader, autoMapData: new Uint8Array(64 * 64) }, misc3dObjectRecords: [{ ...rec, modelIdNum: 990002 }] };
  const walled = { ...loc, exterior: { exteriorData: { width: 2, height: 1, blockNames: ['H.RMB', 'F.RMB'] } }, outline: { walled: true } };
  const ws = locationShapeField(walled, (bx) => (bx === 0 ? house : far)), wo = 48;   // a 2 x 1 grid's tile origin x: (128 - 32) / 2
  assert.equal(ws[(wo + 16 + 8) + (o + 8) * D], 1, 'the field\'s middle the town\'s');
  assert.notEqual(ws[(wo + 16 + 16) + (o + 8) * D], 1, 'five tiles past the field: no round\'s apron (a round through it: 1)');
});

test('FB1028 CROP-GROUND the isles\' bake: an Eltheric isle\'s outline, drawn off its template\'s packed basis, holds the crops\' tiles its clone\'s streamed build stands - the packing carried the grid alone, so the bake eased the isle\'s sea under another outline; two grids alike but for their fields are two bases (mutants: the fields packed none; unpacked none; the key blind to them)', () => {
  let on = true;
  registerFlatField(990003, { rangeX: 85, rangeZ: 85, spacing: 4, noise: 0.5 }, () => on);
  const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2 })));
  const am = new Uint8Array(64 * 64);
  for (let r = 40; r < 56; r++) for (let c = 40; c < 56; c++) am[r * 64 + c] = 5;   // a house in the south-east
  const rmb = { fldHeader: { autoMapData: am, groundData: { groundTiles } }, misc3dObjectRecords: [{ modelIdNum: 990003, xPos: 1024, zPos: -3072, yPos: 0 }], miscFlatObjectRecords: [] };
  const blocksFile = { checkName: (n) => n, getBlockIndex: () => 0, getBlock: () => ({ rmbBlock: rmb }) };
  const mapsFile = { getRmbBlockName: () => 'C.RMB' };
  const template = (mapId) => ({ name: `t${mapId}`, regionIndex: 17, locationIndex: mapId, climate: 231, politic: 0,
    mapTableData: { mapId, locationType: 6, longitude: 0, latitude: 0 },
    exterior: { buildings: [], exteriorData: { width: 1, height: 1, blockNames: ['C.RMB'], mapId, locationId: mapId } } });
  const sown = template(905), bare = template(906), templates = { towns: [sown], havens: [bare], ruins: [sown] };
  const rectOf = (loc, fields) => { on = fields; return setLocationTiles(loc, mapsFile, blocksFile, new Uint8Array(D * D)); };
  const rects = etherPlaceRects(templates, (t) => rectOf(t, t === sown));
  assert.equal(rects.bases.length, 2, 'one grid, its fields sown and not: two bases');
  const h = veilhaven(), at = etherRectAt(rects);
  for (const isle of [h, islesNear(h.px, h.py, 80).find((i) => i.kind === 'port' && !i.haven)]) {
    const t = etherTemplateOf(templates, isle), streamed = rectOf(synthesizeEtherLocation(t, isle), t === sown);
    assert.deepEqual([...at(isle.px, isle.py).shape], [...streamed.shape], `${t.name}: the clone's own outline, to the tile`);
    if (t !== sown) continue;
    const grid = outlineOfBasis({ ...streamed.shape.basis, fields: null }, etherPlaceId(isle));
    assert.ok(streamed.shape.some((v, i) => v && !grid[i]), 'its crops\' tiles past the grid\'s outline');
  }
});

test('FB1028 CROP-GROUND a warm launch: the boot walks\' kept blocks (FIRST-VISIT, groundTilesKept.js) give back a model\'s id, so a town\'s outline holds its crops\' tiles on the second launch as on the first - kept as places alone, the Deep Waters bake eased the sea under another outline from the second launch on (mutant: the id kept none)', async () => {
  registerFlatField(990004, { rangeX: 85, rangeZ: 85, spacing: 4, noise: 0.5 });
  const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2 })));
  const am = new Uint8Array(64 * 64);
  for (let r = 40; r < 56; r++) for (let c = 40; c < 56; c++) am[r * 64 + c] = 5;
  const rmb = { fldHeader: { autoMapData: am, groundData: { groundTiles } }, misc3dObjectRecords: [{ modelIdNum: 990004, xPos: 1024, zPos: -3072, yPos: 0 }], miscFlatObjectRecords: [] };
  const blocks = { checkName: (n) => n, getBlockIndex: () => 0, getBlockName: () => 'C.RMB', getBlock: () => ({ rmbBlock: rmb }) };
  const loc = { regionIndex: 17, locationIndex: 9, mapTableData: { mapId: 908, locationType: 6 }, exterior: { exteriorData: { width: 1, height: 1, blockNames: ['C.RMB'] } } };
  const mem = new Map(), store = { get: async (k) => mem.get(k) ?? null, set: async (k, v) => { mem.set(k, structuredClone(v)); return true; } };
  const launch = async () => {
    _resetGroundTiles();
    setWorldDataDoor(null);
    const found = await prefetchGroundTiles({ blocksBytes: new Uint8Array(4096).map((_, i) => i & 255), serving: 'open|A', store });
    const rect = locationRectReader({ getRmbBlockName: () => 'C.RMB' }, blocks)(loc);
    await _flushGroundTiles();
    return { found, rect };
  };
  const cold = await launch(), warm = await launch();
  _resetGroundTiles();
  assert.deepEqual([cold.found, warm.found], [false, true], 'the second launch reads the kept record');
  const grid = outlineOfBasis({ ...cold.rect.shape.basis, fields: null }, 908);
  assert.ok(cold.rect.shape.some((v, i) => v && !grid[i]), 'the crops\' tiles on the first launch\'s outline');
  assert.deepEqual([...warm.rect.shape], [...cold.rect.shape], 'the second launch\'s outline the first\'s, to the tile');
});
