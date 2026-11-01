// FB1028 TOWN-GROUND x THE RECORDS' FRAME (GROUND_FRAME_LAW 4; "TS2 at FB1028"). A record's
// height is DFU's frame - DFU's own samples through a town's classic blend - and FB1028 moved that blend: on the Bay's
// 3,444 town pixels 747 moved over 5 m, 147 over 20 m (Chesterbrugh +291.8 m). A record written before it is moved by its
// town's blend's own move (scenes/groundFrameHost.js townMovedAt, world/landforms.js townGroundMovedField, TS2's law kept
// in world/terrain/townBlendBefore.js); one stamped 4 is not. The audit's case: restandHeight moved a record past the Bay
// alone, and the stamp stood at 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE, STREAMING_TERRAIN_SCALE, MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION, GROUND_FRAME_LAW, TOWN_FRAME_LAW, RELIEF_FRAME_LAW, LIFT_FRAME_LAW, RECORD_GROUND_STAMP, generateSamples } from '../../../src/world/terrain/terrainSampler.js';
import { blendLocationTerrain, calcAvgMaxHeight, locationShapeField } from '../../../src/world/terrain/terrainTiles.js';
import { townGroundMovedField } from '../../../src/world/landforms.js';
import { shapeBefore, blendShapedBefore } from '../../../src/world/terrain/townBlendBefore.js';
import { registerFlatField, _resetFlatFields } from '../../../src/world/townShape.js';
import { StreamingWorldState } from '../../../src/world/streamingWorld.js';
import { groundWoods, largeOfByte } from '../../../src/world/tamriel/tamrielGround.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../../../src/formats/woodsFile.js';
import { recordFrame, createGroundFrame } from '../../../src/scenes/groundFrameHost.js';

const H = HEIGHTMAP_DIMENSION, D = 128, U = STREAMING_TERRAIN_SCALE;

class StubWoods {
  constructor(fill) { this.heightMapBuffer = new Uint8Array(MAP_WIDTH * MAP_HEIGHT); for (let i = 0; i < this.heightMapBuffer.length; i++) this.heightMapBuffer[i] = fill(i % MAP_WIDTH, Math.floor(i / MAP_WIDTH)); }
  getHeightMapValue(x, y) { return this.heightMapBuffer[Math.max(0, Math.min(MAP_HEIGHT - 1, y)) * MAP_WIDTH + Math.max(0, Math.min(MAP_WIDTH - 1, x))]; }
  getHeightMapValuesRange1Dim(x0, y0, dim) { const d = new Uint8Array(dim * dim); for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = this.getHeightMapValue(x0 + x, y0 + y); return d; }
  getLargeMapData(x, y) { const v = Math.round(largeOfByte(this.getHeightMapValue(x, y))), d = []; for (let i = 0; i < 5; i++) d.push(new Uint8Array(5).fill(v)); return d; }
  getLargeHeightMapValuesRange(x0, y0, dim) {
    const side = dim * 3, dst = new Uint8Array(side * side);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) {
      const src = this.getLargeMapData(x0 + x, y0 - y);
      for (let iy = 1; iy < 4; iy++) for (let ix = 1; ix < 4; ix++) dst[(y * 3 + iy - 1) * side + (x * 3 + ix - 1)] = src[ix][4 - iy];
    }
    return dst;
  }
}
/** A shape: tiles x0..x1, y0..y1 buildings (code 1), and a margin of `m` tiles round them coded by its distance. */
function shapeOf(x0, x1, y0, y1, m) {
  const shape = new Uint8Array(D * D);
  for (let y = y0 - m; y <= y1 + m; y++) for (let x = x0 - m; x <= x1 + m; x++) {
    const d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
    if (d <= m) shape[x + y * D] = 1 + Math.round(d * 4);
  }
  return shape;
}

test('FB1028 the records\' frame (GROUND_FRAME_LAW 4): a record written before it rides its town\'s blend\'s move - on the Bay too, the row on or off - and one stamped 4 takes none; RELIEF-PEAKS\' move still law 3\'s and past the Bay\'s (mutants: the stamp at 3; the town\'s move by law 3; the town\'s move dropped)', () => {
  assert.deepEqual([GROUND_FRAME_LAW, TOWN_FRAME_LAW, RELIEF_FRAME_LAW, LIFT_FRAME_LAW], [5, 4, 3, 2]);
  assert.equal(RECORD_GROUND_STAMP.groundFrame, 5);
  const now = (x) => 100 + x, town = (x) => 30 - x / 2, relief = (x) => 7 + x;   // the lift; the town's blend's move; RELIEF-PEAKS'
  const liftAt = (x) => now(x), ground = 500, off = 3.5, x = 12;   // DFU's ground today at the spot
  const state = { compensation: [0, 7, 0], localFromWorld: (nx, nz) => [nx - 100, nz - 200] };
  const frame = (landform, bay) => recordFrame({ landform, liftAt, heightAt: landform ? () => ground + now(x) + 7 : () => ground + 7, state, bayAt: () => bay, movedAt: relief, townMovedAt: town });
  for (const landform of [true, false]) {
    const lift = landform ? now(x) : 0;
    assert.equal(frame(landform, true).restandHeight(ground - town(x) + off, x, 0, U, 3), ground + lift + off, `law 3 on the Bay: the town's move (row ${landform})`);
    assert.equal(frame(landform, true).restandHeight(ground + off, x, 0, U, 4), ground + lift + off, 'law 4: none');
    assert.equal(frame(landform, false).restandHeight(ground - town(x) + off, x, 0, U, 3), ground + lift + off, 'law 3 past the Bay: the town\'s alone');
    assert.equal(frame(landform, false).restandHeight(ground - town(x) - relief(x) + off, x, 0, U, 2), ground + lift + off, 'law 2 past the Bay: both');
  }
  assert.equal(recordFrame({ landform: false, liftAt, heightAt: () => ground, state, bayAt: () => true }).restandHeight(ground + off, x, 0, U, 3), ground + off, 'none handed: as before');
});

test('AUDIT FB1028: #1371\'s build stood the new town ground and still stamped 3 - a record it wrote stands nearer today\'s ground than the old, and is not moved again; one nearer the old moves; the ground unloaded, it moves (mutant: the test unread)', () => {
  const now = (x) => 100 + x, town = () => 24, ground = 500, off = 1.5, x = 12;
  const state = { compensation: [0, 7, 0], localFromWorld: (nx, nz) => [nx - 100, nz - 200] };
  for (const landform of [true, false]) {
    const lift = landform ? now(x) : 0, heightAt = () => ground + lift + 7;
    const f = recordFrame({ landform, liftAt: now, heightAt, state, bayAt: () => true, townMovedAt: town });
    assert.equal(f.restandHeight(ground + off, x, 0, U, 3), ground + lift + off, `written on today's ground: kept (row ${landform})`);
    assert.equal(f.restandHeight(ground - town() + off, x, 0, U, 3), ground + lift + off, 'written on the old: moved');
    const unloaded = recordFrame({ landform, liftAt: now, heightAt: () => -Infinity, state, bayAt: () => true, townMovedAt: town });
    assert.equal(unloaded.restandHeight(ground - town() + off, x, 0, U, 3), (landform ? ground + lift + off : ground + off), 'the ground unloaded: moved');
  }
});

/** The world host's frame over a steep Bay pixel (a cliff of 720 m across it) with a town built there. */
function steepTown() {
  const woods = groundWoods(new StubWoods((x) => Math.max(20, Math.min(250, 30 + 45 * (x - 300)))));
  const px = 301, py = 200, rect = { xMin: 0, xMax: 127, yMin: 0, yMax: 127, shape: shapeOf(50, 78, 50, 78, 4) };
  const state = new StreamingWorldState();
  state.init(px, py);
  const heightCell = TERRAIN_SIZE / (H - 1);
  const host = createGroundFrame({
    _liftLocationAt: () => null, blocks: {}, built: new Map([[`${px},${py}`, { locationRect: rect }]]), heightAt: () => -Infinity, heightCell, landform: false,
    landformsHere: () => null, beyondSites: { generation: () => 1 }, maps: {}, terrainGen: { roads: () => null }, state, woods,
  });
  const scene = (sx, sy, qx = px) => { const t = state.pixelTranslation(qx, py); return [t[0] + sx * heightCell, t[2] + sy * heightCell]; };
  return { host, scene, woods, px, py, rect };
}

test('FB1028 a record on a steep town\'s ease comes back on today\'s ground: 16 samples out TS2 stood the land\'s own (its ease 12 samples), today the ease reaches it - the record written then moved by the difference, its height over the ground kept; one stamped 4, and one with no town under it, untouched (mutants: TS2\'s ease read as today\'s; its reach not 12; the move\'s sign)', () => {
  const { host, scene, woods, px, py, rect } = steepTown();
  const land = generateSamples(woods, px, py), today = Float32Array.from(land);
  blendLocationTerrain(today, calcAvgMaxHeight(land)[0], rect, H, land);   // today's classic blend
  const off = 2.25, at = (sx, sy) => sx * H + sy;
  const [x, z] = scene(30, 64);   // 16 samples west of the town's ground
  const then = land[at(30, 64)] * MAX_TERRAIN_HEIGHT * U, nowY = today[at(30, 64)] * MAX_TERRAIN_HEIGHT * U;
  assert.ok(nowY - then > 100, `the ease lifts the land there by ${(nowY - then).toFixed(1)} m`);
  assert.ok(Math.abs(host.restandHeight(then + off, x, z, U, 3) - (nowY + off)) < 1e-3, `law 3: back on today's ground (${host.restandHeight(then + off, x, z, U, 3).toFixed(2)} against ${(nowY + off).toFixed(2)})`);
  assert.equal(host.restandHeight(then + off, x, z, U, 4), then + off, 'law 4: none');
  assert.equal(host.townMovedAt(...scene(30, 64, px - 1)), 0, 'no town in the pixel west: none');
  // the field itself: today's blend less TS2's, which at 16 samples out is the land's own
  const f = townGroundMovedField(woods, px, py, rect);
  assert.ok(Math.abs(f(30, 64) - (today[at(30, 64)] - land[at(30, 64)]) * MAX_TERRAIN_HEIGHT) < 1e-3);
  assert.equal(townGroundMovedField(woods, px, py, { xMin: 40, xMax: 88, yMin: 40, yMax: 88 }), null, 'a rect with no outline: no field');
});

test('FB1028 CROP-GROUND\'s outline: the town\'s outline of before is its basis with no fields - a record on a field\'s tiles moves by the blend over the outline it stood on (mutants: the fields kept)', () => {
  _resetFlatFields();
  const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2 })));
  const am = new Uint8Array(64 * 64);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) am[r * 64 + c] = 5;   // one house in the north-west corner
  const rmb = { fldHeader: { autoMapData: am, groundData: { groundTiles } }, misc3dObjectRecords: [{ modelIdNum: 990001, xPos: 2048, zPos: -1024, yPos: 0 }], miscFlatObjectRecords: [] };
  const loc = { exterior: { exteriorData: { width: 1, height: 1, blockNames: ['F.RMB'] } }, mapTableData: { mapId: 77, locationType: 2 } };
  const plain = locationShapeField(loc, () => rmb);
  registerFlatField(990001, { rangeX: 85, rangeZ: 35, spacing: 4, noise: 0.5 });
  const shape = locationShapeField(loc, () => rmb);
  assert.notDeepEqual([...shape], [...plain], 'the field moved the outline');
  assert.deepEqual([...shapeBefore(shape, 77)], [...plain], 'the outline of before');
  assert.equal(shapeBefore(plain, 77), plain, 'no fields: the outline as it is');
  _resetFlatFields();
});

test('FB1028 TS2\'s law as it stood (townBlendBefore.js, the base 2036a509e): the sea past the margin kept, the land eased over 12 samples and no further - the ground a record before law 4 stood on (mutants: its sea lifted; its reach not 12)', () => {
  const SEA = Math.fround(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT), norm = (m) => Math.fround(m / (MAX_TERRAIN_HEIGHT * U));
  const g = new Float32Array(H * H);
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) g[y + x * H] = x < 40 ? SEA : norm(36 + 3 * Math.abs(x - 60));
  const s = Float32Array.from(g), target = blendShapedBefore(s, shapeOf(42, 90, 30, 100, 6), g, H);
  assert.ok(target > norm(40), 'the town over its sea');
  assert.equal(s[60 + 38 * H], g[60 + 38 * H], 'the sea past its margin kept: TS2\'s step at the shore');
  assert.equal(s[60 + 112 * H], g[60 + 112 * H], 'the land 15 samples out its own');
  assert.notEqual(s[60 + 106 * H], g[60 + 106 * H], 'the land 9 samples out eased');
});

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('FB1028 with ARENA2: Westhead Moor\'s ground under a record moved with the blend - TS2\'s and today\'s blend of DFU\'s own samples part, and the move is that', { skip: skipReal, timeout: 300_000 }, async () => {
  const { openTownData } = await import('../../../tools/townQuestMarkers.mjs');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { longitudeLatitudeToMapPixel } = await import('../../../src/formats/mapsFile.js');
  const { setLocationTiles } = await import('../../../src/world/terrain/terrainTiles.js');
  const raw = new WoodsFile(); raw.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD'))));
  const woods = groundWoods(raw);
  const { maps, blocks } = await openTownData(ARENA2);
  let loc = null;
  for (let r = 0; r < 62 && !loc; r++) { const reg = maps.getRegion(r); for (let l = 0; reg && l < reg.locationCount && !loc; l++) { const lc = maps.getLocation(r, l); if (lc?.name === 'Westhead Moor') loc = lc; } }
  const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
  assert.equal(p.y * 1000 + p.x, 223207);
  const rect = setLocationTiles(loc, maps, blocks, new Uint8Array(D * D));
  assert.ok(rect.shape, 'a town with an outline');
  const f = townGroundMovedField(woods, p.x, p.y, rect, shapeBefore(rect.shape, loc.mapTableData.mapId));
  const land = generateSamples(woods, p.x, p.y), was = Float32Array.from(land), now = Float32Array.from(land);
  blendLocationTerrain(now, calcAvgMaxHeight(land)[0], rect, H, land);
  blendShapedBefore(was, shapeBefore(rect.shape, loc.mapTableData.mapId), land, H);
  let worst = 0, over5 = 0;
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) {
    const m = f(x, y) * U;
    assert.ok(Math.abs(m - (now[x * H + y] - was[x * H + y]) * MAX_TERRAIN_HEIGHT * U) < 1e-3);
    worst = Math.max(worst, Math.abs(m)); if (Math.abs(m) > 5) over5++;
  }
  console.log(`# FB1028 Westhead Moor: the blend moved DFU's ground up to ${worst.toFixed(1)} m, ${over5} samples over 5 m`);
  assert.ok(worst > 52 && worst < 58, `a record there was off its ground by up to ${worst.toFixed(1)} m (Daggerfall's own layout: 54.9 m)`);
});
