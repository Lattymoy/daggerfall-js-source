// DW-B: Iliac Puddle No More's world geometry, as pure functions over one
// streamed pixel - the classification the mod asks of MapPixelData (with
// DFU's two array orders and the mod's transposed tile reads), the
// bathymetry, the per-pixel tile data, the hole mask and the 65 x 65
// floor with its shore walls, the cap's clip and repaint, and the
// surface's cells and rectangles. Synthetic pixels throughout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DW_WATER_THRESHOLD, DW_CARVE_THRESHOLD, DW_VISUAL_THRESHOLD, heightSample, tileSample, tileValueContainsWater,
  mapDataHasWater, mapDataFullySubmerged, isLocalPointWater, cellContainsWaterTile, isLocalPointPureWaterTile,
  isCellVisuallyWet, heightmapCellBelowThreshold,
} from '../src/world/deepWaterClassification.js';
import { sampleDepthMeters, climateBaseDepth, climateBandSignal, resolveUserMaxDepth, depthBand01, SHELF_MIN_DEPTH } from '../src/world/deepBathymetry.js';
import { DeepWaterTileData, LOCAL_WATER_FALLBACK_DISTANCE_METERS } from '../src/world/deepWaterTileData.js';
import {
  computeHoleMask, buildFloorMesh, sampleMeshLocalY, sampleMeshLocalYAndSlope, isFloorQuadWater, VERTEX_GRID_SIZE, createVertexColor, OCEAN_THRESHOLD,
} from '../src/world/deepWaterFloor.js';
import { CLIP_SENTINEL, isClippedWaterTileData, patchTilemapForClip, shouldHidePureOceanCap, capDecision } from '../src/world/deepWaterCap.js';
import { buildSurfaceMesh, shouldHaveSurface, SURFACE_RENDER_Y_OFFSET } from '../src/world/deepWaterSurface.js';
import { convertTilemap } from '../src/world/terrainSurface.js';

const f32 = Math.fround;
const SEA = f32(f32(27.2) / 1539);          // a sample clamped to the sea
const LAND = f32(60 / 1539);                // well above the beach
const H = 129, T = 128;

/** A pixel: heights by (x, yNorth), tiles by (x, yNorth) - the raw tilemap is y * 128 + x. */
function pixel({ height = () => SEA, tile = () => 0 } = {}) {
  const samples = new Float32Array(H * H);
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) samples[x * H + y] = height(x, y);
  const tilemap = new Uint8Array(T * T);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) tilemap[y * T + x] = tile(x, y);
  return { samples, tilemap };
}

/** A bake that answers from a few functions (the real one is dw1's). */
function stubBake({ sea = () => true, land = () => false, carved = () => true, fine = () => true, edge = () => 500, dist = () => 500, waterAt = () => true } = {}) {
  return {
    loaded: true, hasFineWaterMask: true,
    mapPixelHasWaterCells: sea, mapPixelHasLandCells: land, mapPixelHasFineWaterCells: fine,
    mapPixelOrCardinalNeighborHasWaterCells: (x, y) => sea(x, y) || sea(x - 1, y) || sea(x + 1, y) || sea(x, y - 1) || sea(x, y + 1),
    isCarvedWater: (px, py, fx, fz) => carved(px, py, fx, fz), isWaterAt: (px, py, fx, fz) => waterAt(px, py, fx, fz),
    sampleEdgeDistanceMeters: (px, py, fx, fz) => edge(px, py, fx, fz), sampleLocalEdgeDistanceMeters: (px, py, fx, fz) => edge(px, py, fx, fz),
    sampleDistanceMeters: (px, py, fx, fz) => dist(px, py, fx, fz),
  };
}

// ---- classification --------------------------------------------------

test('DW-B: the mod reads DFU’s arrays in their own orders - heights [y, x], tiles [x, y] - and 0xFF is water again', () => {
  const md = pixel({ height: (x, y) => (x === 3 && y === 10 ? LAND : SEA), tile: (x, y) => (x === 5 && y === 20 ? 2 : x === 6 && y === 21 ? 0xff : 1) });
  assert.equal(heightSample(md, 10, 3), LAND, 'heightmapSamples[y, x]');
  assert.equal(heightSample(md, 3, 10), SEA);
  assert.equal(tileSample(md, 5, 20), 2, 'tilemapSamples[x, y]');
  assert.equal(tileSample(md, 20, 5), 1);
  assert.equal(tileSample(md, 6, 21), 0, 'the location sentinel 0xFF back to record 0, as CompleteMapPixelDataUpdate does');
  for (const r of [0, 5, 6, 7, 48]) assert.ok(tileValueContainsWater(r) && tileValueContainsWater(r | 64 | 128), `record ${r}, rotated or flipped`);
  for (const r of [1, 2, 3, 4, 8, 47, 49, 55]) assert.ok(!tileValueContainsWater(r), `record ${r}`);
  assert.equal(DW_WATER_THRESHOLD, f32(f32(f32(27.2) / 1539) + f32(1e-5)));
  assert.equal(DW_CARVE_THRESHOLD, f32(f32(f32(27.2) + f32(0.25)) / 1539));
  assert.equal(DW_VISUAL_THRESHOLD, f32(40 / 1539));
});

test('DW-B: the mod’s tile reads land TRANSPOSED - a water tile at (x, y) answers at fracX = y, fracZ = x', () => {
  // One water tile at x = 100, y = 20; every height on the carve line so the tile test decides.
  const md = pixel({ height: () => f32(27.3 / 1539), tile: (x, y) => (x === 100 && y === 20 ? 0 : 2) });
  const at = (tx, ty) => [(tx + 0.5) / 128, (ty + 0.5) / 128];
  assert.equal(isLocalPointPureWaterTile(md, ...at(20, 100)), true, 'the mod finds it across the diagonal');
  assert.equal(isLocalPointPureWaterTile(md, ...at(100, 20)), false, 'and not where it lies');
  assert.equal(cellContainsWaterTile(md, 20, 100, 128), true);
  assert.equal(cellContainsWaterTile(md, 100, 20, 128), false);
  // IsLocalPointWater: the carve line 27.45 is above 27.3, so the heights alone say water everywhere.
  assert.equal(isLocalPointWater(md, 0.5, 0.5), true);
  const high = pixel({ height: () => f32(27.6 / 1539), tile: () => 0 });
  assert.equal(isLocalPointWater(high, 0.5, 0.5), false, 'a water tile above the carve line is not water (the tile test needs the height too)');
});

test('DW-B: MapDataHasWater, FullySubmerged and the cell tests read the thresholds they name', () => {
  assert.equal(mapDataHasWater(pixel({ height: () => LAND, tile: () => 2 })), false, 'dry land');
  assert.equal(mapDataHasWater(pixel({ height: (x, y) => (x === 64 && y === 64 ? SEA : LAND), tile: () => 2 })), true, 'one sample on the sea');
  // A water tile on ground under the beach line counts; above it, not.
  assert.equal(mapDataHasWater(pixel({ height: () => f32(39 / 1539), tile: (x, y) => (x === 9 && y === 9 ? 0 : 2) })), true);
  assert.equal(mapDataHasWater(pixel({ height: () => f32(41 / 1539), tile: () => 0 })), false);
  assert.equal(mapDataFullySubmerged(pixel()), true);
  assert.equal(mapDataFullySubmerged(pixel({ height: (x, y) => (x === 128 && y === 0 ? LAND : SEA) })), false, 'one dry corner');
  // HeightmapCellBelowThreshold spans [floor(c*128/res), ceil((c+1)*128/res)]: at res 64, cell 5 is samples 10..12.
  const md = pixel({ height: (x, y) => (x === 12 && y === 0 ? SEA : LAND) });
  assert.equal(heightmapCellBelowThreshold(md, 5, 0, 64, DW_WATER_THRESHOLD), true);
  assert.equal(heightmapCellBelowThreshold(md, 6, 0, 64, DW_WATER_THRESHOLD), true, 'the shared sample');
  assert.equal(heightmapCellBelowThreshold(md, 7, 0, 64, DW_WATER_THRESHOLD), false);
  assert.equal(isCellVisuallyWet(pixel({ height: () => f32(39.9 / 1539) }), 0, 0, 128), true, 'the beach line is 40');
});

// ---- bathymetry ------------------------------------------------------

test('DW-B: the bathymetry - a shelf off the coast to the climate’s plain, inside [the navigable minimum, Water Depth]', () => {
  assert.equal(climateBaseDepth(223), 210); assert.equal(climateBaseDepth(228), 28); assert.equal(climateBaseDepth(999), 210);
  assert.equal(climateBandSignal(223), 1); assert.equal(climateBandSignal(224), 0.3); assert.equal(climateBandSignal(999), 0.8);
  assert.equal(resolveUserMaxDepth(null), 250); assert.equal(resolveUserMaxDepth(400), 250); assert.equal(resolveUserMaxDepth(0), 1);
  assert.equal(depthBand01(125), 0.5);
  let minShore = Infinity, maxShore = -Infinity, deep = 0, n = 0;
  for (let i = 0; i < 200; i++) {
    const x = 12345 + i * 97, zc = 67890 - i * 53;
    const s = sampleDepthMeters(x, zc, 210, 0, 200);
    minShore = Math.min(minShore, s); maxShore = Math.max(maxShore, s);
    const d = sampleDepthMeters(x, zc, 210, 4000, 200);
    assert.ok(d >= 11.2 - 1e-9 && d <= 200, `deep ${d}`);
    deep += d; n++;
  }
  assert.ok(minShore >= SHELF_MIN_DEPTH - 1e-9, `at the coast never shallower than the shelf minimum (${minShore})`);
  assert.ok(maxShore < 12, `and a shelf, not a plain (${maxShore})`);
  assert.ok(deep / n > 120, `the open sea is the plain, near the Water Depth (${(deep / n).toFixed(1)})`);
  // The Water Depth scales the whole sea: a 50 m ceiling holds every point.
  for (let i = 0; i < 50; i++) assert.ok(sampleDepthMeters(i * 311, i * 177, 210, 3000, 50) <= 50);
  // A swamp's plain is shallow: its base depth 28 bounds the deep sea well under an ocean's.
  const sw = sampleDepthMeters(5000, 5000, 28, 4000, 200), oc = sampleDepthMeters(5000, 5000, 210, 4000, 200);
  assert.ok(sw < oc, `swamp ${sw} < ocean ${oc}`);
});

// ---- tile data -------------------------------------------------------

test('DW-B: tile data - the 3 x 3 climates blended between pixel centres, the fallback, the edge distance', () => {
  const climate = (x, y) => (x < 500 ? 223 : 228);
  const md = pixel();
  const bake = stubBake({ edge: () => 777, fine: () => true });
  const tile = new DeepWaterTileData({ mapPixelX: 500, mapPixelY: 250, mapData: md, climateIndex: 228, climateAt: climate, bake });
  assert.equal(tile.isOceanConnected, true);
  assert.equal(tile.usesLocalWaterFallback, false);
  assert.equal(tile.hasDistanceField, true);
  assert.equal(tile.getDistanceToEdgeMeters(400, 400), 777);
  // West neighbour ocean (210), self swamp (28): at the pixel's west edge the blend is halfway, at its centre all swamp.
  assert.equal(tile.getBlendedClimate(409.6, 409.6).baseDepth, 28, 'the pixel centre is its own climate');
  assert.equal(tile.getBlendedClimate(0, 409.6).baseDepth, (210 + 28) / 2, 'the west edge is between the two centres');
  // Noise coordinates: map-global meters, z running south like the bake.
  assert.deepEqual(tile.getNoiseWorldCoords(0, 819.2), [500 * 819.2, 250 * 819.2]);
  assert.deepEqual(tile.getNoiseWorldCoords(0, 0), [500 * 819.2, 251 * 819.2]);
  // A pixel the fine bake missed falls back, and its edge distance is the fallback constant.
  const fb = new DeepWaterTileData({ mapPixelX: 500, mapPixelY: 250, mapData: md, climateIndex: 228, climateAt: climate, bake: stubBake({ fine: () => false }) });
  assert.equal(fb.usesLocalWaterFallback, true);
  assert.equal(fb.getDistanceToEdgeMeters(10, 10), LOCAL_WATER_FALLBACK_DISTANCE_METERS);
  // A dry pixel is not ocean-connected; a pixel with no bake has no distance field.
  const dry = new DeepWaterTileData({ mapPixelX: 1, mapPixelY: 1, mapData: pixel({ height: () => LAND, tile: () => 2 }), climateIndex: 231, climateAt: climate, bake });
  assert.equal(dry.isOceanConnected, false);
  const nob = new DeepWaterTileData({ mapPixelX: 1, mapPixelY: 1, mapData: md, climateIndex: 223, climateAt: () => 231, bake: null });
  assert.equal(nob.hasDistanceField, false);
  assert.equal(nob.biomeClimateIndex, 223, 'with no bake the C#’s offshore test holds and the ocean keeps its own climate');
  // An ocean pixel near land wears the commonest land climate around it.
  const coast = new DeepWaterTileData({ mapPixelX: 499, mapPixelY: 250, mapData: md, climateIndex: 223, climateAt: (x) => (x >= 500 ? 226 : 223), bake: stubBake({ land: () => true }) });
  assert.equal(coast.biomeClimateIndex, 226);
});

// ---- the floor -------------------------------------------------------

test('DW-B: the hole mask carves where the heights, the corners and the bake all say sea', () => {
  // West half sea, east half land (x >= 64 samples are land).
  const md = pixel({ height: (x) => (x < 64 ? SEA : LAND), tile: (x) => (x < 64 ? 0 : 2) });
  const bake = stubBake({ carved: (px, py, fx) => fx < 0.4 });
  const tile = new DeepWaterTileData({ mapPixelX: 300, mapPixelY: 200, mapData: md, climateIndex: 223, climateAt: () => 223, bake });
  const { holes, any } = computeHoleMask(md, tile, bake);
  assert.ok(any);
  assert.equal(holes[10 * 128 + 10], 0, 'sea, corners on the sea, bake carved: a hole');
  assert.equal(holes[10 * 128 + 55], 0, 'past the fine bake\u2019s carve the pixel\u2019s own heights still carve (IsLocalWaterMissedByFineBake)');
  assert.equal(holes[10 * 128 + 63], 1, 'a cell whose east corners are land');
  assert.equal(holes[10 * 128 + 100], 1, 'land');
  // The floor quads: a quad is drawn when any of its 2 x 2 cells is carved.
  assert.equal(isFloorQuadWater(holes, 5, 5, 64), true);
  assert.equal(isFloorQuadWater(holes, 40, 5, 64), false);
});

test('DW-B: the floor mesh - 65 x 65 at the bathymetry’s depth, never above 5 cm under the sea, walls where the carve meets the edge', () => {
  const md = pixel();                                     // all sea
  const bake = stubBake({ edge: () => 2000, carved: (px) => px !== 301 });   // every neighbour carved but the east one
  const tile = new DeepWaterTileData({ mapPixelX: 300, mapPixelY: 200, mapData: md, climateIndex: 223, climateAt: () => 223, bake });
  const { holes } = computeHoleMask(md, tile, bake);
  const oceanLocalY = f32(OCEAN_THRESHOLD * 1923.75);
  const floor = buildFloorMesh({ mapData: md, tile, holes, oceanLocalY, terrainHeight: 1923.75, waterDepth: 200 });
  assert.ok(floor.positions.length / 3 >= VERTEX_GRID_SIZE * VERTEX_GRID_SIZE);
  let maxY = -Infinity;
  for (let i = 0; i < VERTEX_GRID_SIZE * VERTEX_GRID_SIZE; i++) maxY = Math.max(maxY, floor.positions[i * 3 + 1]);
  assert.ok(maxY <= oceanLocalY - 0.05 + 1e-6, 'the floor keeps its clearance under the surface');
  assert.ok(floor.positions[1] < oceanLocalY - 20, '2 km out the floor is deep');
  // The east edge: the bake does not carve across it (px 301), so a wall stands there; the west edge carves across.
  const walls = floor.indices.length - floor.floorGridIndexCount;
  assert.ok(walls > 0, 'walls on the east edge');
  let eastWall = 0, westWall = 0;
  for (let k = floor.floorGridIndexCount; k < floor.indices.length; k++) {
    const x = floor.positions[floor.indices[k] * 3];
    if (x > 800) eastWall++; else if (x < 20) westWall++;
  }
  assert.ok(eastWall > 0 && westWall === 0, `the wall stands where the carve stops (${eastWall} east, ${westWall} west)`);
  // Every wall face comes in both windings.
  assert.equal(walls % 12, 0, 'two faces of two triangles a segment');
  // The mesh's own height: on a grid vertex it is the vertex.
  assert.equal(sampleMeshLocalY(floor, 12.8 * 3, 12.8 * 7), floor.vertexLocalY[7 * 65 + 3]);
  const s = sampleMeshLocalYAndSlope(floor, 100, 100);
  assert.ok(s && s.slopeDegrees >= 0 && s.slopeDegrees < 90);
  assert.equal(sampleMeshLocalY(floor, -1, 10), null, 'off the pixel');
  assert.deepEqual(createVertexColor(250, 0.5, 720, 2).map((v) => Math.round(v * 1000) / 1000), [1, 0.5, 1, 1]);
});

test('DW-B: near the coast the floor fits up to the vanilla shore - 5 cm under the sea at 10 m, the bathymetry past 180 m', () => {
  const md = pixel();
  const oceanLocalY = f32(OCEAN_THRESHOLD * 1923.75);
  const at = (edge) => {
    const bake = stubBake({ edge: () => edge });
    const tile = new DeepWaterTileData({ mapPixelX: 300, mapPixelY: 200, mapData: md, climateIndex: 223, climateAt: () => 223, bake });
    const { holes } = computeHoleMask(md, tile, bake);
    return buildFloorMesh({ mapData: md, tile, holes, oceanLocalY, terrainHeight: 1923.75, waterDepth: 200 }).vertexLocalY[32 * 65 + 32];
  };
  const near = at(10), mid = at(120), far = at(179.9), off = at(181);
  assert.ok(Math.abs(near - (oceanLocalY - 0.05)) < 0.1, `10 m out: at the clearance line (${near} vs ${oceanLocalY - 0.05})`);
  assert.ok(near > mid && mid > far, 'the fit fades with the distance');
  assert.ok(Math.abs(far - off) < 0.5, 'and is gone by 180 m');
});

// ---- the cap ---------------------------------------------------------

test('DW-B: the cap clips water texels on the sea, repaints raised water from the nearest ground, hides a pure ocean', () => {
  // Converted tilemap: water (record 0 -> byte 0) in the west half, grass (record 2 -> byte 8) east.
  const raw = pixel({ tile: (x) => (x < 64 ? 0 : 2) }).tilemap;
  const bytes = convertTilemap(raw);
  // Heights: sea west of x = 40, raised (above the sea, under the beach) between 40 and 64.
  const md = { samples: pixel({ height: (x) => (x <= 40 ? SEA : f32(30 / 1539)) }).samples, tilemap: raw };
  const patched = patchTilemapForClip(bytes, md);
  assert.equal(patched[5 * 128 + 10], CLIP_SENTINEL, 'water on the sea: clipped');
  assert.equal(patched[5 * 128 + 60], 8, 'raised water: the nearest ground texel (grass, four tiles east) in its place');
  assert.equal(patched[5 * 128 + 50], 0, 'raised water with no ground within eight tiles keeps its tile');
  assert.equal(patched[5 * 128 + 100], 8, 'ground untouched');
  assert.ok(isClippedWaterTileData(0) && isClippedWaterTileData(48 << 2) && !isClippedWaterTileData(1 << 2));
  assert.equal(patchTilemapForClip(convertTilemap(pixel({ tile: () => 2 }).tilemap), md), null, 'no water tile, no patch');
  // Hide: the bake all sea and no land, the pixel all on the sea.
  const allSea = pixel();
  assert.equal(shouldHidePureOceanCap(1, 1, allSea, stubBake()), true);
  assert.equal(shouldHidePureOceanCap(1, 1, allSea, stubBake({ land: () => true })), false);
  assert.equal(shouldHidePureOceanCap(1, 1, md, stubBake()), false, 'a raised sample keeps the ground');
  const d = capDecision(1, 1, md, bytes, stubBake({ land: () => true }));
  assert.equal(d.hide, false); assert.ok(d.tilemap);
  assert.deepEqual(capDecision(1, 1, allSea, convertTilemap(allSea.tilemap), stubBake()), { hide: true, tilemap: null });
});

// ---- the surface -----------------------------------------------------

test('DW-B: the surface - one quad over a pure ocean, merged rectangles over a coast, nothing inland', () => {
  const allSea = pixel();
  const full = buildSurfaceMesh({ mapPixelX: 1, mapPixelY: 1, mapData: allSea, tilemapBytes: convertTilemap(allSea.tilemap), tile: null, bake: stubBake() });
  assert.equal(full.indices.length, 6, 'one quad');
  assert.deepEqual(Array.from(full.positions.filter((_, i) => i % 3 === 0)), [0, 819.2 * 1, 819.2, 0].map((v) => f32(v)));
  // A coast: water tiles (and sea heights) west of tile 32.
  const coast = pixel({ height: (x) => (x <= 64 ? SEA : LAND), tile: (x) => (x < 32 ? 0 : 2) });
  const bake = stubBake({ land: () => true, waterAt: (px, py, fx) => fx < 0.25 });
  const tile = new DeepWaterTileData({ mapPixelX: 2, mapPixelY: 2, mapData: coast, climateIndex: 223, climateAt: () => 223, bake });
  const mesh = buildSurfaceMesh({ mapPixelX: 2, mapPixelY: 2, mapData: coast, tilemapBytes: convertTilemap(coast.tilemap), tile, bake });
  assert.ok(mesh && mesh.cells);
  assert.equal(mesh.cells[64 * 128 + 10], 1, 'a water tile');
  assert.equal(mesh.cells[64 * 128 + 120], 0, 'high land');
  assert.ok(mesh.indices.length / 6 < 64, `merged into few rectangles (${mesh.indices.length / 6})`);
  // Inland and dry: no surface at all.
  assert.equal(shouldHaveSurface(5, 5, pixel({ height: () => LAND, tile: () => 2 }), stubBake({ sea: () => false })), false);
  assert.equal(SURFACE_RENDER_Y_OFFSET, 0.03);
});
