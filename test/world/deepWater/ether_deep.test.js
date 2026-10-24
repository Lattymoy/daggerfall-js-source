// ETHER-DEEP (2026-10-12, the owner: "the area below water is very shallow and has no depth"; bible/03-World/
// Eltheric-Ocean.md ETHER-DEEP) - THE ELTHERIC OCEAN CARVED BY ITS OWN BAKE. Iliac Puddle No More's bake was the Bay's
// 1000 x 500: past the Veil nothing was carved and the sea stood a stride deep on the kernel's clamp. The Eltheric's
// box is a bake's own frame now (world/etherWatersBake.js), built by the Bay's own rules from the composed ground: its
// classes the bound's, its flood an isle's cell at a time (every cell's ring is open sea - pinned here over three whole
// rows of the box), its places' rects their templates', its queries the frame's own cells. Its open water is the
// Ocean's plain under the player's Water Depth, and every arm of the promote carves it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WoodsFile } from '../../../src/formats/woodsFile.js';
import {
  DeepWatersBake, BAY_FRAME, inFrame, floodSteps, classifyPixel, coarseCandidateBits, pixelWaterSampler, PIXEL_SEA, PIXEL_LAND, PIXEL_MIXED, BAKE_DISTANCE_CAP, BAKE_DISTANCE_SCALE_METERS,
  PLANE_KEEP_MAX, PLANE_KEEP_RADIUS,
} from '../../../src/world/deepWater/deepWatersBake.js';
import {
  EtherWatersBake, DeepWatersBakes, ETHER_FRAME, ETHER_ROW, etherPlaceRects, etherRectAt, worldBakes, waterFrameOf,
} from '../../../src/world/etherWatersBake.js';
import {
  etherWoods, etherClimateAt, ETHER_BOX, ISLE_CELL_PX, CELLS_W, CELLS_H, VEIL_X, veilhaven, landfall, isleOfCell, etherCellOf, islesNear, inEther,
} from '../../../src/world/ethericSea.js';
import { etherTemplateOf } from '../../../src/world/etherPlaces.js';
import { generateSamples } from '../../../src/world/terrain/terrainSampler.js';
import { generateTileData, assignTiles } from '../../../src/world/terrain/terrainTiles.js';
import { convertTilemap } from '../../../src/world/terrain/terrainSurface.js';
import { buildDeepWatersPixel, DW_OCEAN_LOCAL_Y } from '../../../src/world/deepWater/deepWatersPixel.js';
import { DeepWaterTileData } from '../../../src/world/deepWater/deepWaterTileData.js';
import { sampleMeshLocalY, TILE_WORLD_SIZE } from '../../../src/world/deepWater/deepWaterFloor.js';
import { sampleDepthMeters } from '../../../src/world/deepWater/deepBathymetry.js';
import { loadDeepWatersBake } from '../../../src/world/deepWater/deepWatersClient.js';
import { createDeepWatersHost } from '../../../src/scenes/deepWater/deepWatersHost.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A raw WOODS.WLD whose every byte is a mountain and every detail its highest - so a composed reader that read the raw
 *  file's bytes past the map (the bake's fast path) would stand land all over the Eltheric. */
function rawMountains() {
  const N = 1000 * 500, hdr = 32 + 28 * 4, offs = N * 4, blk = 22 + 25;
  const heightOffset = hdr + offs, dataOffset = heightOffset + N;
  const bytes = new Uint8Array(dataOffset + blk);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, 4, true); v.setUint32(4, 1000, true); v.setUint32(8, 500, true); v.setUint32(28, heightOffset, true);
  for (let i = 0; i < N; i++) v.setUint32(hdr + i * 4, dataOffset, true);
  bytes.fill(200, heightOffset, heightOffset + N);
  bytes.fill(9, dataOffset + 22, dataOffset + blk);
  const w = new WoodsFile();
  assert.ok(w.load(bytes));
  return w;
}
const RAW = rawMountains();
const GROUND = etherWoods(RAW);
const bake = () => new EtherWatersBake({ woods: GROUND });
const cellCorner = (cx, cy) => [ETHER_BOX.x0 + cx * ISLE_CELL_PX, ETHER_BOX.y0 + cy * ISLE_CELL_PX];
/** Cells whose flood keeps a pond out - found by search over the box (each a candidate cell no ring reaches). */
const POND_CELLS = [[547, 1], [418, 4], [361, 22], [436, 22]];

test('ETHER-DEEP: the raw file\'s bytes are the raw file\'s - a composed reader answers the Eltheric through its own door, and the Bay\'s map off the bytes (mutants: the inherited bytes read; AUDIT ETHER-OW C1-1: the Bay through the door)', () => {
  assert.equal(classifyPixel(RAW, 10, 10), PIXEL_LAND, 'the raw file itself: its own fast path, its mountains');
  const open = landfall();
  assert.equal(classifyPixel(GROUND, open.px, open.py), PIXEL_SEA, 'the landfall\'s open water, as the sea\'s law has it');
  assert.equal(classifyPixel(GROUND, veilhaven().px, veilhaven().py), PIXEL_MIXED, 'Veilhaven\'s town pixel - its shore\'s bound');
  // AUDIT ETHER-OW C1-1: a pixel of the Bay's map is read off the bytes whoever holds them - the mod's own clamped
  // window - never the composition's door, which built new arrays at every call (the world's reader is always one)
  const door = [];
  const spied = Object.create(GROUND);
  spied.getLargeHeightMapValuesRange = function (x, y, n) { door.push([x, y]); return GROUND.getLargeHeightMapValuesRange(x, y, n); };
  assert.equal(classifyPixel(spied, 10, 10), PIXEL_LAND, 'the Bay\'s pixel: the raw file\'s mountains');
  assert.equal(classifyPixel(spied, 0, 499), PIXEL_LAND, 'and its corner, the window clamped as the mod clamps it');
  assert.deepEqual(door, [], 'never through the composition\'s door');
  assert.equal(classifyPixel(spied, open.px, open.py), PIXEL_SEA);
  assert.ok(door.length > 0, 'the Eltheric through it');
});

test('ETHER-DEEP: every cell\'s ring of pixels is open sea by the bound, over three whole rows of the box - so a cell\'s own flood is the box\'s', () => {
  let rings = 0, isles = 0;
  for (const cy of [1, Math.floor(CELLS_H / 2), CELLS_H - 2]) {
    for (let cx = 0; cx < CELLS_W; cx++) {
      if (isleOfCell(cx, cy)) isles++;
      const [x0, y0] = cellCorner(cx, cy);
      for (let k = 0; k < ISLE_CELL_PX; k++) {
        for (const [x, y] of [[x0 + k, y0], [x0 + k, y0 + ISLE_CELL_PX - 1], [x0, y0 + k], [x0 + ISLE_CELL_PX - 1, y0 + k]]) {
          rings++;
          if (classifyPixel(GROUND, x, y) !== PIXEL_SEA) assert.fail(`cell ${cx},${cy}: its ring pixel ${x},${y} is not open sea`);
        }
      }
    }
  }
  assert.ok(isles > 700 && rings > 3 * CELLS_W * 36, `${isles} isles, ${rings} ring pixels`);
});

test('ETHER-DEEP: a cell\'s flood is the flood of the 3 x 3 cells round it - a pond kept out, the shore\'s water in (mutants: candidates for sea; the flood from the wrong cell)', () => {
  const b = bake();
  const cand = (x, y) => coarseCandidateBits(pixelWaterSampler(GROUND, x, y, null));
  let ponds = 0;
  for (const [cx, cy] of [...POND_CELLS, etherCellOf(veilhaven().px, veilhaven().py)]) {
    const [x0, y0] = cellCorner(cx - 1, cy - 1);
    const steps = floodSteps(3 * ISLE_CELL_PX, 3 * ISLE_CELL_PX, (x, y) => classifyPixel(GROUND, x0 + x, y0 + y), (x, y) => cand(x0 + x, y0 + y));
    let r = steps.next();
    while (!r.done) r = steps.next();
    const { state, partialIndex, partialBits } = r.value;
    for (let j = ISLE_CELL_PX; j < 2 * ISLE_CELL_PX; j++) {
      for (let i = ISLE_CELL_PX; i < 2 * ISLE_CELL_PX; i++) {
        const k = j * 3 * ISLE_CELL_PX + i, s = state[k];
        const want = s === 1 ? new Uint8Array(8).fill(0xff) : s === 2 ? partialBits.slice(partialIndex.indexOf(k) * 8, partialIndex.indexOf(k) * 8 + 8) : new Uint8Array(8);
        assert.deepEqual([...b.seaBits(x0 + i, y0 + j)], [...want], `pixel ${x0 + i},${y0 + j}`);
        if (classifyPixel(GROUND, x0 + i, y0 + j) === PIXEL_MIXED && cand(x0 + i, y0 + j).some((v, q) => v !== want[q])) ponds++;
      }
    }
  }
  assert.ok(ponds >= POND_CELLS.length, `a pond kept out in every pond cell (${ponds})`);
});

test('ETHER-DEEP: the frame - the box\'s own cells, the Bay\'s map untouched; a query routed to the bake whose frame holds its pixel (mutants: the Bay\'s frame for the box; the rows misrouted)', () => {
  assert.deepEqual(ETHER_FRAME, { x0: ETHER_BOX.x0, y0: ETHER_BOX.y0, w: ETHER_BOX.x1 - ETHER_BOX.x0, h: ETHER_BOX.y1 - ETHER_BOX.y0 });
  assert.deepEqual(BAY_FRAME, { x0: 0, y0: 0, w: 1000, h: 500 });
  const lf = landfall();
  assert.deepEqual([waterFrameOf(lf.px, lf.py, true), waterFrameOf(lf.px, lf.py, null), waterFrameOf(500, 250, true), waterFrameOf(-5, 250, true)], [ETHER_FRAME, BAY_FRAME, BAY_FRAME, BAY_FRAME]);
  assert.deepEqual([inFrame(ETHER_FRAME, ETHER_BOX.x0, ETHER_BOX.y0), inFrame(ETHER_FRAME, ETHER_BOX.x1, ETHER_BOX.y0), inFrame(ETHER_FRAME, ETHER_BOX.x0, ETHER_BOX.y1 - 1)], [true, false, true]);
  // AUDIT ETHER-OW T-7: closed on every side - the box's and the Bay's
  assert.deepEqual([inFrame(ETHER_FRAME, ETHER_BOX.x0, ETHER_BOX.y1), inFrame(ETHER_FRAME, ETHER_BOX.x0 - 1, ETHER_BOX.y0), inFrame(ETHER_FRAME, ETHER_BOX.x0, ETHER_BOX.y0 - 1),
    inFrame(BAY_FRAME, 0, 500), inFrame(BAY_FRAME, 1000, 0), inFrame(ETHER_FRAME, ETHER_BOX.x1 - 1, ETHER_BOX.y1 - 1)], [false, false, false, false, false, true]);
  const b = bake();
  // the open Veil: no isle east of Veilhaven's cell, so its water is the cap's distance from any coast
  const far = { px: VEIL_X + 4, py: veilhaven().py + 40 };
  assert.equal(b.sampleDistanceMeters(far.px, far.py, 0.5, 0.5), BAKE_DISTANCE_CAP * BAKE_DISTANCE_SCALE_METERS, 'the open sea, as far from a coast as the planes see');
  assert.equal(b.isWaterAt(far.px, far.py, 0.5, 0.5), true);
  assert.equal(b.isCarvedWater(far.px, far.py, 0.5, 0.5), true);
  assert.equal(b.mapPixelHasLandCells(far.px, far.py), false);
  const h = veilhaven();
  assert.equal(b.mapPixelHasLandCells(h.px, h.py), true, 'Veilhaven\'s town stands on land');
  assert.deepEqual([b.isCarvedWater(h.px, h.py, 0.5, 0.5), b.isWaterAt(h.px, h.py, 0.5, 0.5)], [false, false], 'its middle neither carved nor sea - its own cells, never the box\'s clamped edge');
  assert.ok(b.sampleDistanceMeters(lf.px, lf.py, 0.5, 0.5) < 4000, 'the landfall lies off Veilhaven\'s shore');
  // routed: a bay bake that answers nothing, the Eltheric's beside it
  const bay = new DeepWatersBake({ woods: GROUND, global: { state: new Uint8Array(500000), classes: new Uint8Array(500000), partialIndex: new Int32Array(0), partialBits: new Uint8Array(0) } });
  const both = worldBakes(bay, { woods: GROUND, ether: true });
  assert.ok(both instanceof DeepWatersBakes);
  assert.equal(worldBakes(bay, { woods: GROUND, ether: null }), bay, 'no Eltheric, the Bay\'s alone');
  assert.deepEqual([both.frameOf(far.px, far.py), both.frameOf(500, 250)], [ETHER_FRAME, BAY_FRAME]);
  assert.deepEqual([both.isWaterAt(far.px, far.py, 0.5, 0.5), both.isWaterAt(500, 250, 0.5, 0.5)], [true, false]);
  both.prepare(lf.px, lf.py);
  const rows = both.exportPlanes(lf.px, lf.py);
  assert.equal(rows.length, 9, 'the 3 x 3, each with its sea bits and class');
  assert.ok(rows.every((r) => r.f === ETHER_ROW && r.sea?.length === 8 && [PIXEL_SEA, PIXEL_MIXED, PIXEL_LAND].includes(r.cls)));
  const there = worldBakes(new DeepWatersBake({ woods: GROUND, global: { state: new Uint8Array(500000), classes: new Uint8Array(500000), partialIndex: new Int32Array(0), partialBits: new Uint8Array(0) } }), { woods: GROUND, ether: true });
  there.adoptPlanes(rows);
  assert.equal(there.ether._sea.size, 9, 'the other thread adopts the rows - it floods nothing the worker flooded');
  // a pixel by the box's north-west corner: its rows' slots lie inside the Bay's own range, so only the route keeps them out
  const nw = { px: ETHER_BOX.x0 + 5, py: ETHER_BOX.y0 + 5 };
  both.prepare(nw.px, nw.py);
  const low = both.exportPlanes(nw.px, nw.py);
  assert.ok(low.every((r) => r.i < 500000 && r.dist), 'slots the Bay\'s planes could hold');
  there.adoptPlanes(low);
  assert.deepEqual([there.bay._dist.size, there.bay._edge.size], [0, 0], 'and the Bay\'s planes take none of them');
  // AUDIT ETHER-OW T-4: nor the box\'s the Bay\'s - its row slots would land on box pixels and poison their planes
  both.prepare(500, 250);
  const bayRows = both.exportPlanes(500, 250);
  assert.ok(bayRows.length > 0 && bayRows.every((r) => r.f === undefined), 'the Bay\'s rows, unmarked');
  const fresh = worldBakes(new DeepWatersBake({ woods: GROUND, global: { state: new Uint8Array(500000), classes: new Uint8Array(500000), partialIndex: new Int32Array(0), partialBits: new Uint8Array(0) } }), { woods: GROUND, ether: true });
  fresh.adoptPlanes(bayRows);
  assert.deepEqual([fresh.ether._dist.size, fresh.ether._edge.size, fresh.ether._fine.size, fresh.ether._sea.size, fresh.bay._dist.size], [0, 0, 0, 0, bayRows.filter((r) => r.dist).length]);
  // every query the pair answers routed by its pixel's frame, and an eviction reaching both halves
  const calls = [];
  const stub = (name) => new Proxy({}, { get: (_t, k) => (...a) => { calls.push([name, k, ...a.slice(0, 2)]); return name; } });
  const pair = new DeepWatersBakes(stub('bay'), stub('ether'));
  const queries = ['holdsSea', 'sampleDistanceMeters', 'sampleEdgeDistanceMeters', 'sampleLocalEdgeDistanceMeters', 'isWaterAt', 'isCarvedWater', 'mapPixelHasFineWaterCells',
    'mapPixelHasWaterCells', 'mapPixelOrCardinalNeighborHasWaterCells', 'mapPixelHasLandCells', 'exportPlanes'];
  assert.deepEqual(queries.map((m) => [pair[m](far.px, far.py, 0.5, 0.5), pair[m](500, 250, 0.5, 0.5), pair[m](-5, 250, 0.5, 0.5)]), queries.map(() => ['ether', 'bay', 'bay']));
  calls.length = 0;
  pair.prepare(far.px, far.py);
  pair.prepare(500, 250);
  pair.evictOutside(1, 2, 3);
  assert.deepEqual(calls, [['ether', 'prepare', far.px, far.py], ['bay', 'prepare', 500, 250], ['bay', 'evictOutside', 1, 2], ['ether', 'evictOutside', 1, 2]]);
});

test('ETHER-DEEP: the planes are bounded - past PLANE_KEEP_MAX the far ones let go, the near kept; AUDIT ETHER-OW C1-2: the Bay\'s adopted planes too (mutants: kept for ever; the Bay\'s never let go)', () => {
  const b = bake();
  const h = veilhaven();
  for (let i = 0; i <= PLANE_KEEP_MAX; i++) b._sea.set(i, new Uint8Array(8));   // the box's north-west row: far from Veilhaven
  b.prepare(h.px, h.py);
  assert.ok(![...b._sea.keys()].some((i) => i <= PLANE_KEEP_MAX), 'the far planes let go');
  assert.ok(b._sea.size > 0 && b._sea.size < PLANE_KEEP_MAX, `the near built again (${b._sea.size})`);
  for (const i of b._sea.keys()) {
    const x = (i % ETHER_FRAME.w) + ETHER_FRAME.x0, y = Math.floor(i / ETHER_FRAME.w) + ETHER_FRAME.y0;
    assert.ok(Math.max(Math.abs(x - h.px), Math.abs(y - h.py)) <= PLANE_KEEP_RADIUS + ISLE_CELL_PX, `${x},${y} near`);   // the planes' windows' cells
  }
  assert.ok(b.seaBits(h.px, h.py), 'and what is asked again is built again');
  // AUDIT ETHER-OW T-5: the near KEPT, not built again - a plane marked by Veilhaven is the same bytes after; at
  // PLANE_KEEP_MAX exactly nothing is let go; an adopt is bounded as a prepare is; and the classes let go with the planes
  const slot = (x, y) => (y - ETHER_FRAME.y0) * ETHER_FRAME.w + (x - ETHER_FRAME.x0);
  const marked = bake(), mark = new Uint8Array(64).fill(7);
  for (let i = 0; i <= PLANE_KEEP_MAX; i++) marked._sea.set(i, new Uint8Array(8));
  marked._dist.set(slot(h.px, h.py), mark);
  marked.prepare(h.px, h.py);
  assert.equal(marked._dist.get(slot(h.px, h.py)), mark, 'the near plane kept, its own bytes');
  assert.equal(marked._sea.has(0), false);
  const full = bake();
  for (let i = 0; i < PLANE_KEEP_MAX; i++) full._sea.set(i, new Uint8Array(8));
  full.prepare(h.px, h.py);
  assert.equal(full._sea.has(0), true, 'at PLANE_KEEP_MAX, nothing let go');
  const source = bake();
  source.prepare(h.px, h.py);
  const adopt = bake();
  for (let i = 0; i <= PLANE_KEEP_MAX; i++) adopt._sea.set(i, new Uint8Array(8));
  adopt.adoptPlanes(source.exportPlanes(h.px, h.py));
  assert.equal(adopt._sea.has(0), false, 'the main thread adopts, bounded');
  assert.equal(adopt._sea.has(slot(h.px, h.py)), true, 'about the rows it took');
  const cls = bake();
  for (let i = 0; i <= PLANE_KEEP_MAX; i++) cls._cls.set(i, PIXEL_SEA);
  cls.prepare(h.px, h.py);
  assert.equal(cls._cls.has(0), false, 'the classes let go as the planes are');
  // AUDIT ETHER-OW C1-2: the Bay's bake on this thread takes the worker's rows at every promote - a voyage's worth now
  const bay = new DeepWatersBake({ woods: RAW, global: null, locationRectAt: () => null, fineAt: () => null });
  const row = (x, y) => ({ i: y * BAY_FRAME.w + x, dist: new Uint8Array(64), edge: new Uint8Array(64) });
  let most = 0;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 1000; x++) { bay.adoptPlanes([row(x, y)]); most = Math.max(most, bay._dist.size, bay._edge.size); }   // a voyage of 5,000 pixels
  assert.ok(most <= PLANE_KEEP_MAX, `the Bay's planes never past the bound (${most})`);
  const once = new DeepWatersBake({ woods: RAW, global: null, locationRectAt: () => null, fineAt: () => null });
  for (let i = 0; i <= PLANE_KEEP_MAX; i++) once.adoptPlanes([row(i % 1000, Math.floor(i / 1000))]);   // one past the bound
  const [ox, oy] = [PLANE_KEEP_MAX % 1000, Math.floor(PLANE_KEEP_MAX / 1000)];
  assert.ok(once._dist.size > 0 && once._dist.size < PLANE_KEEP_MAX, `let go (${once._dist.size})`);
  for (const i of once._dist.keys()) assert.ok(Math.max(Math.abs((i % BAY_FRAME.w) - ox), Math.abs(Math.floor(i / BAY_FRAME.w) - oy)) <= PLANE_KEEP_RADIUS, 'all but the near');
});

test('ETHER-DEEP: a place\'s pixel blends with its template\'s rect - the pick the place\'s own (etherTemplateOf), list for list', () => {
  const t = (n) => ({ n });
  const templates = { towns: [t(1), t(2), t(3)], havens: [t(4), t(5)], ruins: [t(6), t(7), t(8), t(9)] };
  const rects = etherPlaceRects(templates, (x) => ({ xMin: x.n, xMax: x.n + 10, yMin: x.n + 20, yMax: x.n + 30 }));
  const at = etherRectAt(rects);
  const h = veilhaven();
  const n = etherTemplateOf(templates, h).n;
  assert.deepEqual(at(h.px, h.py), { xMin: n, xMax: n + 10, yMin: n + 20, yMax: n + 30 }, 'Veilhaven\'s, its haven template\'s');
  assert.equal(at(h.px + 1, h.py), null, 'an isle\'s other pixels stand no place');
  assert.equal(at(landfall().px, landfall().py), null);
  assert.equal(etherRectAt(null)(h.px, h.py), null, 'no templates, no rects');
  // AUDIT ETHER-OW T-10: a ruin's pixel its dungeon template's, a port's its town's - each list its own
  for (const kind of ['ruin', 'port']) {
    const isle = islesNear(h.px, h.py, 80).find((i) => i.kind === kind && !i.haven);
    assert.ok(isle, `a ${kind} by Veilhaven`);
    const k = etherTemplateOf(templates, isle).n;
    assert.ok(templates[kind === 'ruin' ? 'ruins' : 'towns'].some((x) => x.n === k), `its own list's (${kind})`);
    assert.deepEqual(at(isle.px, isle.py), { xMin: k, xMax: k + 10, yMin: k + 20, yMax: k + 30 }, kind);
  }
});

/** A pixel of the Eltheric as the world streams it: its samples, its tiles, its climates. */
function streamed(px, py) {
  const samples = generateSamples(GROUND, px, py);
  const tilemap = new Uint8Array(128 * 128);
  assignTiles(generateTileData(samples, px, py), tilemap, true);
  const climates = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) climates.push(etherClimateAt(px + dx, py + dy));
  return { px, py, samples, tilemap, tilemapBytes: convertTilemap(tilemap), climates, neighbours: {}, waterDepth: 250, spawnSurfaces: true };
}

test('ETHER-DEEP: the open Eltheric is carved to the Ocean\'s plain - its floor, its swim column and its bathymetry agree, a coast\'s shallower (mutant: the Bay\'s bake alone)', () => {
  const both = worldBakes(new DeepWatersBake({ woods: GROUND, global: { state: new Uint8Array(500000), classes: new Uint8Array(500000), partialIndex: new Int32Array(0), partialBits: new Uint8Array(0) } }), { woods: GROUND, ether: true });
  const open = { px: VEIL_X + 4, py: veilhaven().py + 40 };
  const job = streamed(open.px, open.py);
  const r = buildDeepWatersPixel(job, both);
  assert.equal(r.ocean, true);
  assert.ok(r.floor, 'the open sea carved');
  assert.equal(r.cap.hide, true, 'a pure ocean pixel\'s ground not drawn - the floor is the ground');
  const mid = TILE_WORLD_SIZE / 2;
  const floorY = sampleMeshLocalY(r.floor, mid, mid);
  const tile = new DeepWaterTileData({ mapPixelX: open.px, mapPixelY: open.py, mapData: { samples: job.samples, tilemap: job.tilemap }, climateIndex: job.climates[4], climateAt: (x, y) => etherClimateAt(x, y), bake: both });
  assert.equal(tile.isCarvedWaterLocal(mid, mid), true, 'the swim\'s gate: carved water');
  const [nx, nz] = tile.getNoiseWorldCoords(mid, mid);
  const depth = sampleDepthMeters(nx, nz, tile.getBlendedClimateBaseDepth(mid, mid), tile.getDistanceToEdgeMeters(mid, mid), 250);
  assert.ok(depth > 150 && depth <= 250, `the Ocean's plain, under the Water Depth (${depth.toFixed(1)} m)`);
  assert.ok(Math.abs((DW_OCEAN_LOCAL_Y - floorY) - depth) < 25, `the drawn floor is the bathymetry's (${(DW_OCEAN_LOCAL_Y - floorY).toFixed(1)} against ${depth.toFixed(1)})`);
  // the landfall, off Veilhaven's shore: carved, and nearer the coast than the open sea
  const lf = landfall();
  const near = buildDeepWatersPixel(streamed(lf.px, lf.py), both);
  assert.ok(near.ocean && near.floor, 'the landfall carved');
  assert.ok(both.sampleDistanceMeters(lf.px, lf.py, 0.5, 0.5) < both.sampleDistanceMeters(open.px, open.py, 0.5, 0.5));
  // the tree before: one bake, the Bay's, its frame the Bay's clamped corner
  const bayOnly = new DeepWatersBake({ woods: GROUND, global: { state: new Uint8Array(500000), classes: new Uint8Array(500000), partialIndex: new Int32Array(0), partialBits: new Uint8Array(0) } });
  const old = new DeepWaterTileData({ mapPixelX: open.px, mapPixelY: open.py, mapData: { samples: job.samples, tilemap: job.tilemap }, climateIndex: job.climates[4], climateAt: (x, y) => etherClimateAt(x, y), bake: bayOnly });
  assert.equal(old.isCarvedWaterLocal(mid, mid), false, 'read through the Bay\'s corner, no water to swim in');
});

test('ETHER-DEEP: a tile by an isle wears its neighbours\' climates by the box\'s own frame - an ocean pixel by Veilhaven wears the isle\'s, asked nowhere but the box - and its east edge is the box\'s last pixel (AUDIT ETHER-OW T-6, T-16; mutants: the climates clamped to the Bay\'s map, the edge one past)', () => {
  const both = worldBakes(new DeepWatersBake({ woods: GROUND, global: { state: new Uint8Array(500000), classes: new Uint8Array(500000), partialIndex: new Int32Array(0), partialBits: new Uint8Array(0) } }), { woods: GROUND, ether: true });
  const h = veilhaven();
  const asked = [];
  const climateAt = (x, y) => { asked.push([x, y]); return x === h.px && y === h.py ? 229 : 223; };
  const t = new DeepWaterTileData({ mapPixelX: h.px + 1, mapPixelY: h.py, mapData: { samples: new Float32Array(4), tilemap: new Uint8Array(4) }, climateIndex: 223, climateAt, bake: both });
  t.getBlendedClimateBaseDepth(400, 400);
  assert.equal(t.biomeClimateIndex, 229, 'the isle\'s climate');
  assert.ok(asked.length > 0 && asked.every(([x, y]) => inEther(x, y)), JSON.stringify(asked.filter(([x, y]) => !inEther(x, y)).slice(0, 3)));
  // the box's east edge: a query at the tile's far side is the box's last pixel, never the Bay's past it
  const east = new DeepWaterTileData({ mapPixelX: ETHER_BOX.x1 - 1, mapPixelY: h.py + 40, mapData: { samples: new Float32Array(4), tilemap: new Uint8Array(4) }, climateIndex: 223, climateAt: () => 223, bake: both });
  assert.deepEqual(east._global(TILE_WORLD_SIZE, 400), { mapPixelX: ETHER_BOX.x1 - 1, mapPixelY: h.py + 40, fracX: 1, fracZ: east._global(TILE_WORLD_SIZE, 400).fracZ });
  assert.equal(east.getDistanceToEdgeMeters(TILE_WORLD_SIZE, 400), east.getDistanceToEdgeMeters(TILE_WORLD_SIZE - 0.1, 400), 'the open Veil\'s, either side of the line');
});

test('ETHER-DEEP: the client builds the Eltheric\'s bake beside the Bay\'s on this thread, and the worker is told to (mutants: the build message without it; the worker\'s reader not composed)', async () => {
  const flat = new WoodsFile();
  {
    const N = 1000 * 500, hdr = 32 + 28 * 4, offs = N * 4, blk = 22 + 25;
    const heightOffset = hdr + offs, dataOffset = heightOffset + N;
    const bytes = new Uint8Array(dataOffset + blk);
    const v = new DataView(bytes.buffer);
    v.setUint32(0, 4, true); v.setUint32(4, 1000, true); v.setUint32(8, 500, true); v.setUint32(28, heightOffset, true);
    for (let i = 0; i < N; i++) v.setUint32(hdr + i * 4, dataOffset, true);
    bytes.fill(60, heightOffset, heightOffset + N);
    assert.ok(flat.load(bytes));
  }
  const ground = etherWoods(flat);
  const kept = new Map(), store = { get: async (k) => kept.get(k), set: async (k, v) => { kept.set(k, v); } };   // the Bay's record built once
  const b = await loadDeepWatersBake({ woods: ground, rects: [], ether: true, workerFactory: null, store });
  assert.ok(b instanceof DeepWatersBakes, 'the world\'s bakes');
  const open = { px: VEIL_X + 4, py: veilhaven().py + 40 };
  assert.deepEqual([b.isWaterAt(open.px, open.py, 0.5, 0.5), b.isWaterAt(500, 250, 0.5, 0.5)], [true, false], 'the Eltheric\'s sea, the Bay\'s land');
  assert.ok(!(await loadDeepWatersBake({ woods: ground, rects: [], workerFactory: null, store }) instanceof DeepWatersBakes), 'not told, the Bay\'s alone');
  let said = null;
  const listening = () => { const w = { terminate() {}, postMessage(m) { said = m; queueMicrotask(() => w.onmessage({ data: { t: 'error', message: 'stop here' } })); } }; return w; };
  await loadDeepWatersBake({ woods: ground, woodsBytes: new Uint8Array(4), rects: [], ether: { towns: [], havens: [], ruins: [] }, workerFactory: listening, store });
  assert.deepEqual(said.ether, { towns: [], havens: [], ruins: [] }, 'the worker\'s build carries the places\' rects');
  const worker = src('src/world/deepWater/deepWatersWorker.js');
  assert.match(worker, /bake = worldBakes\(new DeepWatersBake\(\{ woods, global: g, locationRectAt \}\), \{ woods: m\.ether \? etherWoods\(woods\) : woods, ether: m\.ether \?\? null \}\);/, 'the worker composes the sea over its own reader');
});

test('ETHER-DEEP: the host carves the Eltheric by every arm, and holds the continent past the map (PIN MOVED from ETHER-HOLD: the box was held with the rest)', async () => {
  const lf = landfall();
  const pixel = (px, py) => ({ px, py, samples: new Float32Array(4), tilemap: new Uint8Array(4), tilemapBytes: new Uint8Array(4) });
  const ether = pixel(lf.px, lf.py), next = pixel(lf.px + 1, lf.py), west = pixel(-5, 250), bay = pixel(500, 250);
  const built = new Map([ether, next, west, bay].map((p) => [`${p.px},${p.py}`, p]));
  const asked = [];
  let answer;
  const floor = () => ({ positions: new Float32Array(9), indices: new Uint32Array(0), floorGridIndexCount: 0, vertexLocalY: new Float32Array(4225) });
  const client = { ready: new Promise((r) => { answer = r; }), buildPixel: async (job) => { asked.push(`${job.px},${job.py}:${job.climates[0]}`); return { ocean: true, floor: floor() }; } };
  const host = createDeepWatersHost({ built, climateAt: (x, y) => (y < 0 ? 77 : 223), currentPixel: () => ({ x: ether.px, y: ether.py }), client, clock: () => 0, ether: true });
  answer({ mapPixelOrCardinalNeighborHasWaterCells: () => true });
  await host.ready;
  for (let i = 0; i < 8; i++) { host.pump(); for (let k = 0; k < 5; k++) await null; }
  assert.equal(await host.promoteNear(ether) !== null || asked.some((a) => a.startsWith(`${ether.px},${ether.py}:`)), true, 'the landfall asked of the worker');
  assert.ok(asked.some((a) => a.startsWith(`${next.px},${next.py}:`)), 'and its neighbour, by the pump');
  assert.ok(!asked.some((a) => a.startsWith('-5,250')), 'the continent past the map held');
  assert.ok(asked.filter((a) => !a.startsWith('500,')).every((a) => a.endsWith(':77')), 'the climates read in the box\'s own frame - never the Bay\'s clamp to row 0');
  assert.ok(asked.some((a) => a === '500,250:223'), 'the Bay\'s pixel as ever');
  assert.match(src('src/scenes/deepWater/deepWatersHost.js'), /const dw = client \?\? openDeepWaters\(\{ woods, woodsBytes, rects: deepWatersLocationRects\(woods, locations, maps, blocks\), ether \}\);/, 'the host hands the client the sea');
  // AUDIT ETHER-OW C1-3: the dry check reads only the sea bits this thread holds - a fresh Eltheric cell is the trip's to
  // answer, never flooded here first (it was, 1-8 ms on the main thread at a landfall, then again on the worker)
  const real = worldBakes(new DeepWatersBake({ woods: GROUND, global: { state: new Uint8Array(500000), classes: new Uint8Array(500000), partialIndex: new Int32Array(0), partialBits: new Uint8Array(0) } }), { woods: GROUND, ether: true });
  let res;
  const asked2 = [];
  const client2 = { ready: new Promise((r) => { res = r; }), buildPixel: async (job) => { asked2.push(`${job.px},${job.py}`); return null; } };
  const dry = { px: lf.px - 30, py: lf.py, samples: new Float32Array(4).fill(1e6), tilemap: new Uint8Array(4), tilemapBytes: new Uint8Array(4) };
  const host2 = createDeepWatersHost({ built: new Map([[`${dry.px},${dry.py}`, dry]]), climateAt: () => 77, currentPixel: () => ({ x: dry.px, y: dry.py }), client: client2, clock: () => 0, ether: true });
  res(real);
  await host2.ready;
  assert.equal(real.holdsSea(dry.px, dry.py), false, 'a cell this thread never flooded nor was sent');
  await host2.promoteNear(dry);
  assert.equal(real.ether._sea.size, 0, 'nothing flooded on this thread');
  assert.ok(asked2.includes(`${dry.px},${dry.py}`), 'the trip asked instead');
  real.prepare(dry.px, dry.py);
  assert.equal(real.holdsSea(dry.px, dry.py), true, 'held once flooded (or adopted)');
  // the dry check reads its cardinal neighbours' bits too: a pixel's own row alone is not enough
  const rowsOf = real.exportPlanes(dry.px, dry.py), own = (dry.py - ETHER_FRAME.y0) * ETHER_FRAME.w + (dry.px - ETHER_FRAME.x0);
  const sent = worldBakes(new DeepWatersBake({ woods: GROUND, global: { state: new Uint8Array(500000), classes: new Uint8Array(500000), partialIndex: new Int32Array(0), partialBits: new Uint8Array(0) } }), { woods: GROUND, ether: true });
  sent.adoptPlanes(rowsOf.filter((r) => r.i === own));
  assert.equal(sent.holdsSea(dry.px, dry.py), false, 'its own row sent, its neighbours\' not');
  sent.adoptPlanes(rowsOf);
  assert.equal(sent.holdsSea(dry.px, dry.py), true, 'the 3 x 3 sent: held');
  assert.equal(real.holdsSea(500, 250), true, 'the Bay\'s always - its global record');
  const world = src('src/scenes/world.js');
  // PIN MOVED (AUDIT ETHER-OW C1-4, then BOOT-RECTS): one walk over every template - its tilemap and its blocks the reader's
  // (world/terrain/terrainTiles.js locationRectReader, test/world/terrain/bootrects.test.js), read as the isles' clones
  assert.match(world, /ether: etherSea \? etherPlaceRects\(_etherTemplates, locationRectReader\(maps, blocks, \{ regionIndex: ETHER_REGION, locationIndex: -1000 \}\)\) : null,[^\n]*\n\s+\}\) : null;/, 'the world hands the host its places\' rects with the sea standing');
});
