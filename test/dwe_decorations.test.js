// DW-E2 (2026-09-25) - ILIAC PUDDLE NO MORE 1.2.2's SEAFLOOR DECORATIONS (jet082), PINNED: the catalog
// (UnderwaterDecorationCatalog.cs), the placement and the work queue (UnderwaterDecorations.cs), the factory's three
// ways of standing a decoration and its edge clean (UnderwaterDecorationBatchFactory.cs), and the decoration program
// (DeepWaters/UnderwaterBillboardBatchUnlit, read back to GLSL). The expectations are the C#'s, spelled out here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WATER_BIOME, climateToBiome, DECORATION_POOLS, poolForBiome, pickRecord, usesArchiveAnimation, framesPerSecondOf,
  tileDecorationSeed, spacingCellKey, seededUnityRandom, rollDecorationPasses, decorationPassesForBiome, canPlaceDecoration,
  authoredVisualHeight, generateBillboardPositions, buildDecorationPositions, trimDecorationPositions, decorationCap, populateRadius,
  placeTileDecorations, clearEdgeBlackPixels, isTransparentPadding, seafloorClearance, BUBBLE_FALLBACK_VISUAL_HEIGHT,
} from '../src/world/underwaterDecorations.js';
import { createUnderwaterDecorations, createDecorTextureSource, PROMOTE_BUDGET_MS, DECORATION_ARCHIVES } from '../src/scenes/deepWatersDecor.js';
import { deepWatersDecorationSettings, createDeepWatersHost } from '../src/scenes/deepWatersHost.js';
import { scaledSliderValue } from '../src/world/deepWaterLook.js';
import { DECOR_VS, DECOR_FS, FLOOR_FS, COLUMN_GLSL, DECORATION_COLOR, DECORATION_CUTOFF } from '../src/render/deepWatersRender.js';
import { VERTEX_GRID_SIZE, TILE_WORLD_SIZE } from '../src/world/deepWaterFloor.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import { DW_OCEAN_LOCAL_Y } from '../src/world/deepWatersPixel.js';
import { DW_WATER_THRESHOLD } from '../src/world/deepWaterClassification.js';
import { lookAt } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const f32 = Math.fround;
const count = (pool, a, r) => pool.filter((x) => x.archive === a && x.record === r).length;

test('DW-E2: the catalog - six weighted pools, the climate\'s biome picks one, archive 106 records 2-6 animate at 5 fps (mutants: a weight, the biome map, the animation range)', () => {
  const sizes = Object.fromEntries(Object.entries(DECORATION_POOLS).map(([b, p]) => [b, p.length]));
  assert.deepEqual(sizes, { 1: 151, 2: 349, 4: 297, 8: 356, 16: 232, 32: 64 }, 'each pool is its weights summed');
  const open = DECORATION_POOLS[WATER_BIOME.OpenOcean];
  assert.equal(count(open, 106, 2), 3 + 12, 'AddCommonWater\'s 3 and the open ocean\'s own 12');
  assert.equal(count(open, 106, 6), 8);
  assert.equal(count(open, 305, 0), 3, 'dead sea life at weight 3');
  assert.equal(count(DECORATION_POOLS[WATER_BIOME.Cold], 206, 0), 10 + 3, 'the cold pool adds 206:0 twice (10 and 3)');
  assert.equal(count(DECORATION_POOLS[WATER_BIOME.Desert], 305, 1), 4, 'the desert has no dead sea life but its own 305:1');
  assert.equal(count(DECORATION_POOLS[WATER_BIOME.Desert], 305, 0), 0);
  assert.deepEqual([223, 229, 227, 228, 231, 232, 230, 226, 224, 225, 0, 999].map(climateToBiome),
    [1, 2, 2, 8, 4, 4, 16, 16, 32, 32, 1, 1], 'ClimateToBiome, the open ocean for any other');
  assert.equal(poolForBiome(64), open, 'any other biome: the open ocean\'s pool');
  assert.equal(pickRecord(224, { range: (lo, hi) => hi - 1 }), DECORATION_POOLS[32][63], 'Random.Range(0, Length) over the biome\'s pool');
  assert.deepEqual([1, 2, 3, 6, 7].map((r) => usesArchiveAnimation({ archive: 106, record: r })), [false, true, true, true, false]);
  assert.equal(usesArchiveAnimation({ archive: 105, record: 3 }), false);
  assert.deepEqual([106, 105, 501].map(framesPerSecondOf), [5, 0, 0]);
  assert.deepEqual(DECORATION_ARCHIVES, [105, 106, 206, 211, 213, 253, 305, 306, 380, 501, 502], 'every archive the pools name');
  const named = new Set(Object.values(DECORATION_POOLS).flatMap((p) => p.map((r) => r.archive)));
  assert.deepEqual([...named].sort((a, b) => a - b), DECORATION_ARCHIVES);
});

test('DW-E2: the seeds and the rolls - TileDecorationSeed in int32, the passes from the frequency, 1.35x in the open ocean and 0.55x in the desert (mutants: the overflow, the fraction, the ceilings)', () => {
  assert.equal(tileDecorationSeed(415, 372), (415 * 73856093 | 0) ^ (372 * 19349663 | 0) | 0);
  assert.equal(tileDecorationSeed(415, 372), -1880111665, 'C# int multiplication wraps');
  assert.equal(spacingCellKey(-1, 2), Math.imul(-1, 73856093) ^ Math.imul(2, 19349663));
  const rng = (v) => ({ value: () => v });
  assert.equal(rollDecorationPasses(2.25, rng(0.2)), 3, 'the fraction .25 a chance of one more');
  assert.equal(rollDecorationPasses(2.25, rng(0.25)), 2, 'Random.value < fraction, strictly');
  assert.equal(rollDecorationPasses(-1, rng(0)), 0, 'Mathf.Max(0, frequency)');
  assert.equal(decorationPassesForBiome(2, 223), 3, 'ceil(2 x 1.35)');
  assert.equal(decorationPassesForBiome(1, 223), 2, 'ceil(1.35) - up, never to the nearest');
  assert.equal(decorationPassesForBiome(3, 224), 2, 'ceil(3 x 0.55)');
  assert.equal(decorationPassesForBiome(3, 231), 3);
  assert.equal(decorationPassesForBiome(0, 223), 0);
  assert.equal(scaledSliderValue(0.3, 3.75), f32(0.3 * 7.5), 'GetScaledSliderValue: 0.5 is 3.75');
  assert.equal(scaledSliderValue(2, 3.75), 7.5, 'clamped to the slider');
  assert.equal(decorationCap(5000), 2304);
  assert.equal(populateRadius(9), 3);
  assert.equal(populateRadius(0), 1);
  // the seeded stand-in is deterministic per seed and ranges as Unity's
  const a = seededUnityRandom(123), b = seededUnityRandom(123);
  for (let i = 0; i < 50; i++) { const x = a.range(0, 3); assert.equal(x, b.range(0, 3)); assert.ok(x >= 0 && x < 3); }
  assert.doesNotThrow(() => seededUnityRandom(0).value(), 'a zero seed is taken');
});

test('DW-E2: CanPlaceDecoration - five metres from every placed one, across the 3 x 3 cells (mutants: the spacing, the neighbourhood)', () => {
  const grid = new Map();
  assert.equal(canPlaceDecoration([10, 0, 10], grid), true);
  assert.equal(canPlaceDecoration([14.99, 5, 10], grid), false, '4.99 m away (height ignored)');
  assert.equal(canPlaceDecoration([15, 0, 10], grid), true, 'exactly 5 m is clear');
  assert.equal(canPlaceDecoration([10, 0, 5.1], grid), false, 'the cell below, 4.9 m');
  assert.equal(canPlaceDecoration([22, 0, 10], grid), true);
});

/** A flat floor at `y` over a whole pixel (every quad water), optionally tilted along x. */
function flatFloor(y, slope = 0) {
  const n = VERTEX_GRID_SIZE;
  const vertexLocalY = new Float32Array(n * n);
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) vertexLocalY[z * n + x] = y + slope * x * (TILE_WORLD_SIZE / (n - 1));
  return { vertexLocalY, floorQuadWater: new Uint8Array((n - 1) * (n - 1)).fill(1) };
}
const allSea = () => ({ samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(DW_WATER_THRESHOLD - 1e-4) });

test('DW-E2: GenerateBillboardPositions - a jittered walk three samples at a time, on the floor\'s triangle: 8 m of water, 35 degrees, the clearances, five metres apart (mutants: each bar)', () => {
  const rng = seededUnityRandom(tileDecorationSeed(415, 372));
  const positions = [];
  const deep = DW_OCEAN_LOCAL_Y - 20;
  generateBillboardPositions({ mapData: allSea(), floor: flatFloor(deep), climateIndex: 231, positions, spacingGrid: new Map(), rng, visualHeight: () => 2 });
  assert.ok(positions.length > 100, `a deep sea takes many (${positions.length})`);
  for (const p of positions) {
    const rec = { archive: p.archive, record: p.record };
    assert.equal(p.local[1], f32(deep + seafloorClearance(rec)), 'the floor + 0.25 (0.75 animated)');
    assert.ok(p.local[0] >= 0 && p.local[0] <= f32(TILE_WORLD_SIZE) && p.local[2] >= 0 && p.local[2] <= f32(TILE_WORLD_SIZE));
    const sx = p.local[0] / f32(TILE_WORLD_SIZE) * (HEIGHTMAP_DIMENSION - 1), sz = p.local[2] / f32(TILE_WORLD_SIZE) * (HEIGHTMAP_DIMENSION - 1);
    assert.ok(Math.abs(sx - Math.round(sx)) < 1e-3 && Math.abs(sz - Math.round(sz)) < 1e-3, 'on a heightmap sample');
    assert.ok(poolForBiome(WATER_BIOME.Temperate).some((r) => r.archive === p.archive && r.record === p.record), 'from the temperate pool');
  }
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    const dx = positions[i].local[0] - positions[j].local[0], dz = positions[i].local[2] - positions[j].local[2];
    assert.ok(dx * dx + dz * dz >= 25, 'five metres apart');
  }
  const run = (floor, vh = () => 2, mapData = allSea()) => { const out = []; generateBillboardPositions({ mapData, floor, climateIndex: 231, positions: out, spacingGrid: new Map(), rng: seededUnityRandom(7), visualHeight: vh }); return out.length; };
  assert.equal(run(flatFloor(DW_OCEAN_LOCAL_Y - 7.9)), 0, 'under 8 m of water: none');
  assert.ok(run(flatFloor(DW_OCEAN_LOCAL_Y - 8.1)) > 0, 'over 8 m: some');
  assert.equal(run(flatFloor(deep, Math.tan(36 * Math.PI / 180))), 0, 'a 36 degree floor: none');
  assert.ok(run(flatFloor(deep, Math.tan(34 * Math.PI / 180))) > 0, 'a 34 degree floor: some');
  assert.equal(run(flatFloor(deep), () => 16.2), 0, 'a record whose 1.2x height reaches within 0.5 m of the surface: none');
  assert.ok(run(flatFloor(deep), () => 15.4) > 0, 'one that stays clear: some (animated ones sit 0.5 m higher)');
  assert.equal(run(flatFloor(deep), () => 0), 0, 'a record with no height is never placed');
  const land = { samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(DW_WATER_THRESHOLD + 1e-4) };
  assert.equal(run(flatFloor(deep), () => 2, land), 0, 'a heightmap sample over the threshold is land');
  assert.equal(run(null), 0, 'no floor, nothing');
});

test('DW-E2: BuildDecorationPositions, TrimDecorationPositions and PopulateTile\'s roll - the passes until the cap, the shuffle cut, null when no pass (mutants: the cap check, the shuffle range)', () => {
  const floor = flatFloor(DW_OCEAN_LOCAL_Y - 30);
  const all = buildDecorationPositions({ mapData: allSea(), floor, climateIndex: 231, passes: 3, cap: 1e9, rng: seededUnityRandom(1), visualHeight: () => 1 });
  const capped = buildDecorationPositions({ mapData: allSea(), floor, climateIndex: 231, passes: 3, cap: 10, rng: seededUnityRandom(1), visualHeight: () => 1 });
  assert.ok(all.length > capped.length && capped.length >= 10, 'the cap is checked after each pass');
  const list = [1, 2, 3, 4, 5].map((n) => ({ n }));
  trimDecorationPositions(list, 3, { range: (lo, hi) => hi - 1 });   // Random.Range(0, i + 1) -> i: the identity shuffle
  assert.deepEqual(list.map((x) => x.n), [1, 2, 3], 'shuffled then cut to the cap');
  const swap = [1, 2, 3].map((n) => ({ n }));
  trimDecorationPositions(swap, 2, { range: () => 0 });
  assert.deepEqual(swap.map((x) => x.n), [2, 3], 'each slot swapped with the first: [1,2,3] -> [3,1,2] -> [2,1,3]... then cut');
  const under = [1, 2].map((n) => ({ n }));
  assert.equal(trimDecorationPositions(under, 5, { range: () => { throw new Error('no roll under the cap'); } }), under);
  assert.equal(placeTileDecorations({ mapPixelX: 0, mapPixelY: 0, mapData: allSea(), floor, climateIndex: 231, frequency: 0, cap: 10, visualHeight: () => 1 }), null, 'no pass: null (the pixel is marked current with none)');
  const a = placeTileDecorations({ mapPixelX: 9, mapPixelY: 4, mapData: allSea(), floor, climateIndex: 231, frequency: 1.5, cap: 50, visualHeight: () => 1 });
  const b = placeTileDecorations({ mapPixelX: 9, mapPixelY: 4, mapData: allSea(), floor, climateIndex: 231, frequency: 1.5, cap: 50, visualHeight: () => 1 });
  assert.deepEqual(a, b, 'the pixel\'s own seed: the same placement every time');
  assert.equal(a.length, 50);
});

test('DW-E2: TryGetAuthoredDecorationVisualHeight - the record\'s scaled height, archive 106\'s 1.8 m fallback, a replacement taller for a still record (mutants: the fallback, the animated exclusion)', () => {
  const src = (h, rep = null) => ({ scaledSize: () => (h ? { w: 1, h } : null), replacementSize: () => rep });
  assert.equal(authoredVisualHeight({ archive: 105, record: 3 }, src(2.5)), f32(2.5));
  assert.equal(authoredVisualHeight({ archive: 106, record: 2 }, src(0)), BUBBLE_FALLBACK_VISUAL_HEIGHT, 'archive 106 with no size: 1.8 m');
  assert.equal(authoredVisualHeight({ archive: 105, record: 3 }, src(0)), 0, 'another archive with none: never placed');
  assert.equal(authoredVisualHeight({ archive: 105, record: 3 }, src(1, { w: 1, h: 3 })), 3, 'the replacement\'s batch height, taller');
  assert.equal(authoredVisualHeight({ archive: 106, record: 3 }, src(1, { w: 1, h: 3 })), 1, 'not for an animated record');
  assert.equal(authoredVisualHeight({ archive: 105, record: 3 }, { scaledSize: () => { throw new Error('unreadable'); } }), 0, 'a failed read is 0');
});

test('DW-E2: the edge clean - the flood from the texture\'s edges through its padding clears the black outline and nothing it cannot reach (mutants: the alpha bar, the black bar, the neighbours)', () => {
  const w = 5, h = 5, data = new Uint8Array(w * h * 4);
  const set = (x, y, r, g, b, a) => data.set([r, g, b, a], (y * w + x) * 4);
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) set(x, y, 8, 8, 8, 255);   // a black ring...
  set(2, 2, 200, 100, 50, 255);                                                          // ...round a coloured heart
  assert.equal(clearEdgeBlackPixels({ width: w, height: h, data }), true);
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) {
    if (x === 2 && y === 2) continue;
    assert.equal(data[(y * w + x) * 4 + 3], 0, `the ring's ${x},${y} is cleared`);
  }
  assert.equal(data[(2 * w + 2) * 4 + 3], 255, 'the heart stays');
  // an enclosed black pixel the flood cannot reach stays
  const d2 = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) d2.set([100, 100, 100, 255], i * 4);
  d2.set([0, 0, 0, 255], (2 * w + 2) * 4);
  assert.equal(clearEdgeBlackPixels({ width: w, height: h, data: d2 }), false, 'nothing changed: the source is kept');
  assert.equal(d2[(2 * w + 2) * 4 + 3], 255);
  assert.deepEqual([[0, 0, 0, 15], [13, 0, 0, 255], [12, 12, 12, 16], [12, 12, 13, 255], [200, 90, 90, 15], [200, 90, 90, 16]].map((px) => isTransparentPadding(px, 0)),
    [true, false, true, false, true, false], 'alpha under 16 whatever the colour; a near-black texel whatever its alpha');
});

/** A decoration world: pixels by key, the player's pixel, the texture source stubbed. */
function decorWorld({ spawn = true, radius = 1, frequency = 2, heavy = true, promote = 0 } = {}) {
  const w = { entries: new Map(), cur: { x: 10, y: 10 }, heavy, promote, created: [], destroyed: [], warmLeft: 0, spawn, radius, frequency, rolls: [] };
  const deep = DW_OCEAN_LOCAL_Y - 30;
  w.add = (x, y, version = 1) => {
    const e = { px: x, py: y, samples: allSea().samples, floor: flatFloor(deep), version };
    w.entries.set(`${x},${y}`, e);
    return e;
  };
  const textures = {
    ready: () => true, load() {},
    visualHeight: (rec) => (w.vh ? w.vh(rec) : 1),
    replacement: (rec) => (w.replacements?.[`${rec.archive}_${rec.record}`] ?? null),
    scaledSize: () => ({ w: 1, h: 2 }),
    texture: (rec, kind) => ({ tex: `${rec.archive}_${rec.record}:${kind}`, frames: rec.archive === 106 ? 4 : 1 }),
    warm: () => (w.warmLeft-- > 0),
  };
  w.decor = createUnderwaterDecorations({
    terrainAt: (x, y) => w.entries.get(`${x},${y}`) ?? null,
    currentPixel: () => w.cur,
    settings: () => ({ spawn: w.spawn, radius: w.radius, frequency: w.frequency, maxPerTile: 768 }),
    canRunLight: () => true, canRunHeavy: () => w.heavy, promoteMs: () => w.promote,
    floorOf: (e) => (e.floor ? { floor: e.floor, version: e.version, climateIndex: 223 } : null),
    textures,
    gpu: { create: (e, groups) => { const h = { e, groups }; w.created.push(h); return h; }, destroy: (h) => w.destroyed.push(h) },
    worldPoint: (e, l) => [e.px * 1000 + l[0], l[1], e.py * 1000 + l[2]],
    now: () => 5,
    roll: () => { const v = w.rolls.length ? w.rolls.shift() : 0.5; return v; },
  });
  return w;
}

test('DW-E2: the work queue - one pixel placed a frame, its batch stood the next, nothing while heavy work waits or the promote spent a millisecond; the player\'s pixel keeps its batch; a pixel is placed again only when its floor is rebuilt (mutants: each gate)', () => {
  const w = decorWorld();
  const a = w.add(10, 10), b = w.add(11, 10);
  w.decor.onPromote(a); w.decor.onPromote(b);
  assert.equal(w.decor.pendingWorkCount, 2);
  w.heavy = false; w.decor.process();
  assert.equal(w.decor.pendingWorkCount, 2, 'no heavy work: nothing');
  w.heavy = true; w.promote = PROMOTE_BUDGET_MS + 0.01; w.decor.process();
  assert.equal(w.decor.pendingWorkCount, 2, 'the promote work spent over a millisecond: nothing');
  w.promote = 0;
  w.decor.process();
  assert.equal(w.decor.pendingWorkCount, 2, 'the first pixel placed (one work item out, one pending batch in)');
  assert.equal(w.decor.queuedTerrainCount, 1, 'and only the first: one pixel a frame (MaxTilesPerWorkCycle)');
  assert.equal(w.created.length, 0, 'placed, not yet stood');
  w.decor.process();
  assert.equal(w.created.length, 1, 'the pending batch stands, and the frame ends there');
  assert.ok(w.decor.batchOf(a), 'the player\'s pixel is decorated');
  assert.equal(w.decor.pendingWorkCount, 1);
  w.decor.process(); w.decor.process();
  assert.equal(w.created.length, 2, 'the second pixel');
  // the player's pixel keeps its batch; a rebuilt floor elsewhere is placed again
  a.version = 2; b.version = 2;
  w.decor.onFloorRefreshed(a); w.decor.onFloorRefreshed(b);
  for (let i = 0; i < 6; i++) w.decor.process();
  assert.equal(w.created.length, 3, 'b rebuilt; a, under the player, kept (ShouldPreservePlayerTileDecorations)');
  assert.equal(w.destroyed.length, 1, 'b\'s old batch went');
  w.decor.onFloorRefreshed(b);
  for (let i = 0; i < 4; i++) w.decor.process();
  assert.equal(w.created.length, 3, 'a current decoration is not placed again (IsCurrentDecoration)');
  // the switch off removes
  w.spawn = false;
  w.decor.refreshLoadedTile(b);
  w.decor.process();
  assert.equal(w.decor.batchOf(b), null, 'CanPopulate false: removed');
  // the warm-up holds a pending batch a frame per archive
  w.spawn = true;
  const c = w.add(10, 11);
  w.decor.onPromote(c);
  w.decor.process();
  w.warmLeft = 2;
  w.decor.process(); w.decor.process();
  assert.equal(w.decor.batchOf(c), null, 'warming');
  w.decor.process();
  assert.ok(w.decor.batchOf(c), 'stood once its pictures are in');
  // a pixel outside the radius is not queued on promote; a crossing queues the rings
  const far = w.add(14, 10);
  w.decor.onPromote(far);
  assert.equal(w.decor.queuedTerrainCount, 0, 'outside the radius');
  w.cur = { x: 13, y: 10 };
  w.decor.onMapPixelChanged(w.cur);
  assert.equal(w.decor.queuedTerrainCount, 1, 'the crossing queues the new rings (14,10 is one of them)');
  // the transient reset empties everything
  w.decor.reset();
  assert.equal(w.decor.pendingWorkCount, 0);
  assert.equal(w.decor.batchOf(a), null);
  assert.equal(w.decor.markerOf(a), null);
});

test('DW-E2: the budget the decorations read is PumpDeferredBuilds\' - a promote the event deferred is timed; a near promote (StreamingWorld\'s own frame) and a refresh (a settings callback) are not, the mod having flushed them before it reads (mutants: the timing gate)', async () => {
  let t = 0;
  const clock = () => (t += 2);   // every read two milliseconds on
  const pixel = (px, py) => ({ px, py, samples: new Float32Array(4), tilemap: new Uint8Array(4), tilemapBytes: new Uint8Array(4) });
  const built = new Map();
  const standing = pixel(12, 10);
  built.set('12,10', standing);
  let answer;
  const client = { ready: new Promise((r) => { answer = r; }), buildPixel: async () => ({ ocean: true }) };
  const host = createDeepWatersHost({ built, climateAt: () => 223, currentPixel: () => ({ x: 10, y: 10 }), client, clock });
  answer({ mapPixelOrCardinalNeighborHasWaterCells: () => true });
  await host.ready; await null;
  const settle = async () => { for (let i = 0; i < 5; i++) await null; };
  // the bake's arrival refreshes what stands (RefreshLoadedTiles) - built, not timed
  host.pump(); await settle();
  assert.ok(standing.deepWaters, 'the refresh stood');
  assert.equal(host.promoteMs, 0, 'a refresh is not the budget\'s');
  // the near arm, inside the promote
  const near = pixel(10, 10); built.set('10,10', near);
  host.published(near, { ocean: true });
  assert.ok(near.deepWaters);
  assert.equal(host.promoteMs, 0, 'HandlePromote\'s near arm is not the budget\'s');
  // a far promote, deferred to PumpDeferredBuilds
  const far = pixel(13, 10); built.set('13,10', far);
  host.published(far);
  assert.equal(host.promoteMs, 0);
  host.pump(); await settle();
  assert.ok(far.deepWaters, 'the deferred build stood');
  assert.equal(host.promoteMs, 2, 'PumpDeferredBuilds\' build: timed');
  host.flushPromoteTiming();
  assert.equal(host.promoteMs, 0, 'Flush');
});

test('DW-E2: the factory\'s three ways - the archive batch (the record\'s size, its base on the point, a random start frame), the material batch (a replacement\'s size x 0.7..1.2, its base on the point), the animated replacement (the same scale, its CENTRE on the point, 5 fps from frame 0); the suppression event (mutants: each geometry)', () => {
  const w = decorWorld();
  const a = w.add(10, 10);
  w.replacements = { '105_5': { size: { w: 3, h: 4 }, frames: 1, animated: false }, '106_2': { size: { w: 2, h: 2 }, frames: 3, animated: true } };
  // only the three records under test are ever placed (a record with no height never is)
  w.vh = (rec) => (['105_5', '105_6', '106_2'].includes(`${rec.archive}_${rec.record}`) ? 1 : 0);
  w.rolls = Array.from({ length: 4000 }, (_, i) => (i % 7) / 7);
  const heard = [];
  const off = w.decor.onShouldSuppressDecoration((e, at) => { heard.push(at); return at[0] - e.px * 1000 < 100; });
  const offThrow = w.decor.onShouldSuppressDecoration(() => { throw new Error('a bad subscriber'); });
  const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
  try {
    w.decor.onPromote(a); w.decor.process(); w.decor.process();
  } finally { console.warn = warn; off(); offThrow(); }
  assert.ok(heard.length > 0, 'every point asked of the subscriber, in the world');
  assert.equal(warned, 1, 'a throwing subscriber is one warning, whatever it throws');
  const h = w.decor.batchOf(a);
  const all = h.groups.flatMap((g) => g.billboards.map((bb) => ({ ...bb, key: g.texture.tex, fps: g.fps })));
  // the facing: the batches the program's own, the animated replacements a DaggerfallBillboard's (DECOR_VS's uFacing)
  assert.deepEqual(Object.fromEntries(h.groups.map((g) => [g.texture.tex, g.facing])), { '105_6:archive': 0, '105_5:replacement': 0, '106_2:animated': 1 });
  assert.ok(all.every((bb) => bb.centre[0] >= 100), 'the suppressed strip (x < 100 m) is gone, every kind');
  const floorY = DW_OCEAN_LOCAL_Y - 30;
  const archs = all.filter((bb) => bb.key === '105_6:archive');
  assert.ok(archs.length > 0, 'the archive batch');
  for (const bb of archs) {
    assert.equal(bb.width, 1); assert.equal(bb.height, 2, 'the record\'s own scaled size, no scale of its own');
    assert.equal(bb.centre[1], f32(floorY + 0.25) + 1, 'its base on the point (the floor + 0.25), the centre half its height up');
    assert.equal(bb.start, 0, 'a one-frame record starts at 0');
    assert.equal(bb.fps, 0);
  }
  const reps = all.filter((bb) => bb.key === '105_5:replacement');
  assert.ok(reps.length > 0, 'the material batch');
  const scales = new Set();
  for (const bb of reps) {
    const k = bb.width / 3;
    assert.ok(Math.abs(k - bb.height / 4) < 1e-9, 'one scale on both axes');
    assert.ok(k >= 0.7 - 1e-12 && k <= 1.2 + 1e-12, 'Random.Range(0.7, 1.2)');
    assert.ok(Math.abs(bb.centre[1] - (f32(floorY + 0.25) + bb.height / 2)) < 1e-4, 'its base on the point');
    scales.add(k.toFixed(6));
  }
  assert.ok(scales.size > 1, 'a scale per decoration');
  const anims = all.filter((bb) => bb.key === '106_2:animated');
  assert.ok(anims.length > 0, 'the animated replacement');
  for (const bb of anims) {
    assert.equal(bb.start, 0, 'DaggerfallBillboard: from frame 0');
    assert.equal(bb.fps, 5, 'FramesPerSecond = max(1, round(5))');
    assert.equal(bb.centre[1], f32(floorY + 0.75), 'its CENTRE on the point (the animated clearance, 0.75)');
  }
  const src = rd('src/scenes/deepWatersDecor.js');
  assert.match(src, /\.billboards\.push\(\{ centre: \[p\.local\[0\], p\.local\[1\], p\.local\[2\]\], width: w, height: h, start: 0 \}\);/, 'the animated replacement: its centre on the point');
  assert.match(src, /group\(`\$\{rec\.archive\}_\$\{rec\.record\}#r`[\s\S]{0,200}centre: \[p\.local\[0\], p\.local\[1\] \+ h \* 0\.5, p\.local\[2\]\]/, 'the material batch: its base on the point');
  assert.match(src, /start: Math\.floor\(roll\(\) \* frames\)/, 'RandomStartFrame: Random.Range(0, frameCount)');
  assert.match(src, /const scale = DECORATION_SCALE_MIN \+ roll\(\) \* \(DECORATION_SCALE_MAX - DECORATION_SCALE_MIN\);/);
  // an archive batch of an animated record takes a random start frame of its frames
  const w3 = decorWorld();
  const e3 = w3.add(10, 10);
  w3.vh = (rec) => (rec.archive === 106 && rec.record === 3 ? 1 : 0);
  w3.rolls = Array.from({ length: 4000 }, (_, i) => (i % 4) / 4 + 0.01);
  w3.decor.onPromote(e3); w3.decor.process(); w3.decor.process();
  const g106 = w3.decor.batchOf(e3).groups.find((g) => g.texture.tex === '106_3:archive');
  assert.equal(g106.fps, 5, 'archive 106 animates at 5 fps');
  assert.deepEqual([...new Set(g106.billboards.map((bb) => bb.start))].sort(), [0, 1, 2, 3], 'Random.Range(0, frameCount) over its four frames');
});

test('DW-E2: the pictures - the archive\'s record and a replacement are edge-cleaned, an animated replacement\'s frames are not (its billboard sets them raw); each built once, every missing one started together (mutants: the clean\'s gate)', async () => {
  // a 3 x 3 black picture on a black surround: GetEdgeCleanedTexture's flood clears every texel of it
  const black = () => ({ width: 3, height: 3, colors: new Uint8ClampedArray(3 * 3 * 4).map((_, i) => (i % 4 === 3 ? 255 : 0)) });
  const file = {
    recordCount: 10, getFrameCount: () => 1, getSize: () => ({ width: 3, height: 3 }), getScale: () => ({ width: 0, height: 0 }),
    getDFBitmap: () => null, getColor32: () => black(),
  };
  const built = [];
  const replaced = new Set(['105_5_0', '106_2_0', '106_2_1', '106_2_2']);
  const tex = createDecorTextureSource({
    getTexture: async () => file, scaledSize: () => ({ w: 1, h: 1 }), replacementSize: () => ({ w: 2, h: 2 }),
    replacementsOn: () => true, hasReplacement: (a, r, f) => replaced.has(`${a}_${r}_${f}`),
    loadReplacement: async () => black(),
    createTexture: (frames) => { built.push(frames); return { tex: built.length, frames: frames.length }; },
  });
  await tex.load();
  const batch = { warm: 0, positions: [{ archive: 105, record: 6 }, { archive: 105, record: 5 }, { archive: 106, record: 2 }, { archive: 106, record: 2 }] };
  assert.equal(tex.warm(batch), true, 'the pictures are not in yet: the batch waits');
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  assert.equal(tex.warm(batch), false, 'all in: it stands');
  assert.equal(built.length, 3, 'one texture a record and kind, every missing one started together');
  const alphas = (frames) => frames.map((f) => [...f.data].filter((_, i) => i % 4 === 3));
  const byFrames = new Map(built.map((f) => [f.length, f]));
  assert.deepEqual(alphas(byFrames.get(3)), [[255, 255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255, 255]],
    'the animated replacement\'s three frames, raw');
  const stills = built.filter((f) => f.length === 1);
  assert.equal(stills.length, 2);
  for (const f of stills) assert.deepEqual(alphas(f), [[0, 0, 0, 0, 0, 0, 0, 0, 0]], 'the archive record and the still replacement, cleaned');
  assert.equal(tex.texture({ archive: 106, record: 2 }, 'animated').frames, 3);
});

test('DW-E2: the decoration program is the mod\'s - the right vector off the view\'s third column in Unity\'s convention, the corner offsets, the cut-out, the tint, the distance fog, no Unity fog (pins + the column\'s arithmetic)', () => {
  assert.match(DECOR_VS, /vec3 right = uFacing == 0 \? normalize\(cross\(uViewCol2, uUpVector\)\) : uCamRight;/);
  assert.match(DECOR_VS, /vec3 up = uFacing == 2 \? uCamUp : uUpVector;/);
  assert.match(DECOR_VS, /vec3 p = aPos \+ right \* \(corner\.x \* aTangent\.x\) \+ up \* \(corner\.y \* aTangent\.y\);/);
  assert.match(DECOR_FS, /if \(t\.w \* uColor\.w - uCutoff < 0\.0\) discard;/);
  assert.match(DECOR_FS, /vec3 tint = uSceneTint\.www \* \(uSceneTint\.xyz - vec3\(1\.0\)\) \+ vec3\(1\.0\);/);
  assert.match(DECOR_FS, /vec3 col = dwColumn\(t\.xyz \* uColor\.xyz \* tint, vWorldPos\);[^\n]*\n\s+outColor = vec4\(dwWaterFog\(col, vWorldPos\), 1\.0\);/,
    'the column\'s share, then the distance fog (the post effect is last)');
  assert.doesNotMatch(DECOR_FS.replace(/float fogFactorAt[\s\S]*?\n}\n/, ''), /fogFactorAt\(/, 'the forward pass takes no Unity fog');
  assert.deepEqual(DECORATION_COLOR, [1.12, 1.12, 1.12, 1]);
  assert.equal(DECORATION_CUTOFF, 0.5);
  // Unity's view is (right, up, back) by rows; the port's lookAt (DFU's left-handed world, the projection mirrored) is
  // (-right, up, back): Unity's column 2 is then (-v[8], v[9], v[10]). Check it against the camera's own basis.
  for (const [yaw, pitch] of [[0, 0], [0.7, 0], [2.1, -0.4], [-1.2, 0.9]]) {
    const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const v = lookAt([0, 0, 0], fwd, [0, 1, 0]);
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];   // every host's camRight
    const back = fwd.map((c) => -c);
    const up = [back[1] * right[2] - back[2] * right[1], back[2] * right[0] - back[0] * right[2], back[0] * right[1] - back[1] * right[0]].map((c) => -c);
    const unityCol2 = [right[2], up[2], back[2]];
    const port = [-v[8], v[9], v[10]];
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(port[i] - unityCol2[i]) < 1e-6, `yaw ${yaw} pitch ${pitch}: component ${i}`);
    // facings 1 and 2: the lookAt's first row is minus the camera's right (the flats' camRight), its second the camera's up
    const camRight = [-v[0], -v[4], -v[8]], camUp = [v[1], v[5], v[9]];
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(camRight[i] - right[i]) < 1e-6, `uCamRight is every host's camRight (yaw ${yaw} pitch ${pitch})`);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    assert.ok(Math.abs(dot(camUp, fwd)) < 1e-6 && Math.abs(dot(camUp, camRight)) < 1e-6, 'uCamUp: square to the view and the right');
    assert.ok(Math.abs(camUp[1] - Math.cos(pitch)) < 1e-6, 'uCamUp: the camera\'s up, tilted with the pitch');
    if (pitch === 0) {
      // with no pitch DFU's right vector is the camera's right
      const c = unityCol2, r = [-c[2], 0, c[0]];
      const n = Math.hypot(r[0], r[2]);
      assert.ok(Math.abs(r[0] / n - right[0]) < 1e-6 && Math.abs(r[2] / n - right[2]) < 1e-6);
    }
  }
  const renderSrc = rd('src/render/deepWatersRender.js');
  assert.match(renderSrc, /gl\.uniform3f\(u\.uViewCol2, -v\[8\], v\[9\], v\[10\]\);/);
  assert.match(renderSrc, /gl\.uniform3f\(u\.uCamRight, -v\[0\], -v\[4\], -v\[8\]\);/);
  assert.match(renderSrc, /gl\.uniform3f\(u\.uCamUp, v\[1\], v\[5\], v\[9\]\);/);
  assert.match(renderSrc, /gl\.uniform1i\(u\.uFacing, g\.facing\);/, 'each group its own facing');
  assert.match(renderSrc, /facing: g\.facing \|\| 0 \}\);/, 'a group with none is a batch');
});

test('DW-E2: seen from over the sea a decoration takes the top\'s column share, as the floor does - the split sum is the mod\'s depth-read alpha over its fragment (the arithmetic + pins)', () => {
  // COLUMN_GLSL, line for line: the view ray's crossing of the sea, the eye depth past it, t = min(behind / vision, 1)
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  function dwColumn(col, frag, { cam, fwd, seaY, vision, top, on = true }) {
    if (!(on && frag[1] < seaY && cam[1] > frag[1])) return col;
    const toFrag = frag.map((x, i) => x - cam[i]);
    const s = Math.min(Math.max((seaY - cam[1]) / Math.min(toFrag[1], -1e-4), 0), 1);
    const entry = cam.map((x, i) => x + toFrag[i] * s);
    const behind = Math.max(dot(frag.map((x, i) => x - entry[i]), fwd), 0);
    return mix(col, top, Math.min(behind / Math.max(vision, 1), 1));
  }
  // the mod: the top blended over the weed at alpha = a + (1 - a) min(behind / vision, 1), behind = the depth
  // texture's eye depth (the weed's - the cut-out queue writes it) minus the surface fragment's
  const cam = [0, 40, 0], seaY = 34, vision = 18, a = 0.35, top = [0.1, 0.3, 0.35], weed = [0.6, 0.2, 0.25];
  for (const [frag, fwdRaw] of [[[0, 20, 0], [0, -1, 0]], [[6, 25, 9], [0.3, -0.6, 0.5]], [[-30, 31, 4], [-0.9, -0.2, 0.1]], [[2, 10, 2], [0.1, -1, 0.1]]]) {
    const n = Math.hypot(...fwdRaw), fwd = fwdRaw.map((c) => c / n);
    const toFrag = frag.map((x, i) => x - cam[i]);
    const entry = cam.map((x, i) => x + toFrag[i] * ((seaY - cam[1]) / toFrag[1]));
    const behind = dot(frag.map((x, i) => x - cam[i]), fwd) - dot(entry.map((x, i) => x - cam[i]), fwd);
    const mod = mix(weed, top, a + (1 - a) * Math.min(behind / vision, 1));
    const port = mix(dwColumn(weed, frag, { cam, fwd, seaY, vision, top }), top, a);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(port[i] - mod[i]) < 1e-12, `frag ${frag}: channel ${i}`);
  }
  assert.deepEqual(dwColumn(weed, [0, 20, 0], { cam, fwd: [0, -1, 0], seaY, vision, top, on: false }), weed, 'no share while the top is not drawn');
  assert.deepEqual(dwColumn(weed, [0, 36, 0], { cam, fwd: [0, -1, 0], seaY, vision, top }), weed, 'nothing over the sea takes it');
  assert.deepEqual(dwColumn(weed, [0, 20, 0], { cam: [0, 15, 0], fwd: [0, 1, 0], seaY, vision, top }), weed, 'nor anything the camera looks up at');
  // the GLSL is that function, and both programs run it before the distance fog
  assert.match(COLUMN_GLSL, /if \(uColumnOn > 0\.5 && worldPos\.y < uSeaY && uCamPos\.y > worldPos\.y\) \{/);
  assert.match(COLUMN_GLSL, /float s = clamp\(\(uSeaY - uCamPos\.y\) \/ min\(toFrag\.y, -1e-4\), 0\.0, 1\.0\);/);
  assert.match(COLUMN_GLSL, /float behind = max\(dot\(worldPos - entry, uCamFwd\), 0\.0\);/);
  assert.match(COLUMN_GLSL, /float t = min\(behind \/ max\(uTopVision, 1\.0\), 1\.0\);/);
  assert.match(COLUMN_GLSL, /col = mix\(col, st, t\);/);
  assert.ok(FLOOR_FS.includes(COLUMN_GLSL) && DECOR_FS.includes(COLUMN_GLSL), 'one column, both programs');
  assert.match(FLOOR_FS, /col = dwColumn\(col, vWorldPos\);\n\s+outColor = vec4\(dwWaterFog\(col, vWorldPos\), 1\.0\);/);
  const renderSrc = rd('src/render/deepWatersRender.js');
  const draw = renderSrc.slice(renderSrc.indexOf('  drawDecorations(list, frame) {'), renderSrc.indexOf('  drawSkyFog() {'));
  assert.match(draw, /this\._columnUniforms\(u, frame\);/);
  assert.match(draw, /gl\.uniform3fv\(u\.uPixelOrigin, it\.origin\);/, 'the surface uv is pixel-local');
  const world = rd('src/scenes/world.js');
  assert.match(world, /dwRender\.drawFloors\(_dwFloorList, dwColumnFrame\(f\)\);/);
  assert.match(world, /dwRender\.drawDecorations\(_dwDecorList, dwColumnFrame\(f\)\);/, 'the decorations take the floors\' frame');
  assert.match(world, /columnOn: f\.s\.spawnSurfaces && !f\.underwater,/);
});

test('DW-E2: the settings and the host wiring - the four decoration reads, the promote and the crossing hooks, the draw after the floors (pins)', () => {
  const s = deepWatersDecorationSettings();
  assert.equal(s.spawn, true, 'Decorate the seafloor, on');
  assert.equal(s.radius, 2);
  assert.equal(s.frequency, scaledSliderValue(0.3, 3.75));
  assert.equal(s.maxPerTile, 1080);
  const world = rd('src/scenes/world.js');
  assert.match(world, /if \(deepWaters\) deepWaters\.published\(built\.get\(key\), dwResult\);[^\n]*\n\s+if \(dwDecor\) dwDecor\.onPromote\(built\.get\(key\)\);/, 'HandlePromote after the floor builder\'s');
  assert.match(world, /if \(dwDecor\) dwDecor\.destroyed\(p\);/);
  assert.match(world, /queue\.push\(\.\.\.r\.load\);\n\s+announceNearbySpawns\([^\n]*\n\s+if \(dwDecor\) dwDecor\.onMapPixelChanged\(r\.current\);/, 'the crossing: PlayerGPS.OnMapPixelChanged');
  assert.match(world, /if \(deepWaters\.pump\(\) && dwDecor\) dwDecor\.refreshPlayerArea\(\);/, 'LoadSettings\' RefreshPlayerArea');
  assert.match(world, /if \(dwDecor\) \{ dwDecor\.process\(\); deepWaters\.flushPromoteTiming\(\); \}/);
  assert.match(world, /if \(deepWaters\) drawDeepWatersFloors\(groundQueue\);[^\n]*\n\s+if \(dwDecor\) drawDeepWatersDecorations\(groundQueue\);/);
  assert.match(world, /onTransientReset\(\(\) => dwDecor\.reset\(\)\);/);
  assert.match(world, /setPostTransitionRefresh\(\(\) => dwDecor\.refreshPlayerArea\(\)\);/);
  const tex = createDecorTextureSource({ getTexture: async () => null, textureFile: () => null, scaledSize: () => null, replacementSize: () => null, replacementsOn: () => false, hasReplacement: () => false, loadReplacement: async () => null, createTexture: () => null });
  assert.equal(tex.replacement({ archive: 105, record: 3 }), null, 'Asset Injection off: never a replacement');
});
