// RIVER-FORDS (2026-10-26, the owner: "Take care of exclusions and gaps"; AUDIT RELEASE R1-3, bible/01-Overview/audits/
// Audit-Release-R1.md; bible/03-World/Roads.md RIVER-FORDS) - THE CARVED RIVERS CROSSED AS FORDS. CYRODIIL-WATERS carves its
// rivers narrower than a pixel inside the kernel, so the pixels' bytes the roads' worker routes on carried none: the roads
// crossed the channels anywhere, ran along them (192 road pixels on a channel in five of Cyrodiil's regions, 37 along
// one), priced as dry ground, and the kernel then painted the channel's water over the road. Now the roads' build prices
// a step onto a channel's pixel (riverRaster, the router's question) as a ford's, more for a wider channel, and the paint
// keeps a road's own tiles - the crossing a ford.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { route, MAP_W, MAP_H } from '../../../src/world/road/roadNetwork.js';
import { VOYAGER_DIALS, RIVER_FORD, riverFords, landForRoutes, landStep } from '../../../src/world/road/roadLand.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const N = MAP_W * MAP_H;
/** A flat land with a channel (no water in the bytes) where `width(x, y)` says its width in metres (0 none). */
const riverLand = (width) => {
  const heights = new Uint8Array(N).fill(20), water = new Uint8Array(N);
  const land = landForRoutes(heights, water, null, MAP_W, MAP_H, VOYAGER_DIALS);
  const dir = new Uint8Array(N), w = new Uint16Array(N);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const m = width(x, y); if (m) { dir[y * MAP_W + x] = 8; w[y * MAP_W + x] = m; } }
  land.river = riverFords({ dir, width: w });
  return { land, heightAt: (x, y) => heights[y * MAP_W + x], isWater: () => false };
};

test('RIVER-FORDS the price: a channel\'s pixel stepped onto pays the ford\'s 12 a step and a twentieth more for each metre of its width; a diagonal through the channel\'s corner between two of its pixels pays it too; one beside the step does not (mutants: the width, the corner, the price unread)', () => {
  assert.deepEqual({ ...RIVER_FORD }, { cost: 12, perM: 0.05 });
  assert.equal(RIVER_FORD.cost, VOYAGER_DIALS.fordCost, 'a channel\'s ford is a ford\'s');
  const f = riverFords({ dir: new Uint8Array([0, 8, 2]), width: new Uint16Array([0, 40, 400]) });
  assert.deepEqual([...f], [0, 14, 32]);
  const t = { height: new Float32Array(N), shore: new Uint8Array(N), ford: new Uint8Array(N), grain: null, river: new Float32Array(N), d: VOYAGER_DIALS };
  t.river[0 * MAP_W + 5] = 14;
  assert.equal(landStep(t, 4, 0, 5, 0, 1), 15, 'onto the channel: its length and fourteen');
  assert.equal(landStep(t, 5, 0, 6, 0, 1), 1, 'off it: its length');
  // a channel running north-east through the corner between (10, 1) and (11, 0) - the step (10, 0) -> (11, 1) crosses it
  t.river[1 * MAP_W + 10] = 14; t.river[0 * MAP_W + 11] = 14;
  assert.ok(Math.abs(landStep(t, 10, 0, 11, 1, Math.SQRT2) - Math.SQRT2 * 15) < 1e-9, 'through the corner');
  t.river[0 * MAP_W + 11] = 0;
  assert.equal(landStep(t, 10, 0, 11, 1, Math.SQRT2), Math.SQRT2, 'one beside: no crossing');
  t.river = null;
  assert.equal(landStep(t, 4, 0, 5, 0, 1), 1, 'no channels handed: the land as it was');
});

test('RIVER-FORDS the routes: a road between two towns either side of a river crosses it once, square to it, and at its narrowest a few pixels off - never along it (mutants: the price unread, the width)', () => {
  // a river down column 500, 400 m wide but at its narrows (rows 196-204: 20 m), towns either side at row 190
  const L = riverLand((x, y) => (x === 500 ? (Math.abs(y - 200) <= 4 ? 20 : 400) : 0));
  const r = route({ x: 480, y: 190 }, { x: 520, y: 190 }, { heightAt: L.heightAt, isWater: L.isWater, existing: new Uint8Array(N), d: {}, terrain: L.land });
  const wet = r.filter((q) => q.x === 500);
  assert.equal(wet.length, 1, 'once');
  assert.ok(Math.abs(wet[0].y - 200) <= 4, `at the narrows (row ${wet[0].y})`);
  // a river along the row between two towns on it: the road keeps off it beside it, never along its channel
  const A = riverLand((x, y) => (y === 300 && x > 600 && x < 700 ? 40 : 0));
  const along = route({ x: 590, y: 300 }, { x: 710, y: 300 }, { heightAt: A.heightAt, isWater: A.isWater, existing: new Uint8Array(N), d: {}, terrain: A.land });
  assert.ok(along.filter((q) => q.y === 300 && q.x > 600 && q.x < 700).length <= 1, 'beside it, not along it');
});

test('RIVER-FORDS the wiring: the regions\' build reads the rivers\' raster over its grid as the land\'s channels, the kernel hands the water\'s paint the road\'s own tiles, and the roads\' version moves (returning players lay the roads past the Bay once - SMOOTH-LAND\'s GROUND_ROLL_VERSION 4 lays them once in this release too, so one rebuild, not two)', async () => {
  assert.match(read('src/world/tamrielRoads.js'), /land\.river = riverFords\(riverRaster\(gx, gy, MAP_W, MAP_H\)\);/);
  assert.match(read('src/world/terrain/terrainGen.js'), /paintTamrielWaters\(tileData, px, py, hasLocation \? locationRect : null, undefined, paths\);/);
  const { TAMRIEL_ROADS_VERSION, GROUND_ROLL_VERSION } = await import('../../../src/world/tamrielRoads.js');
  assert.deepEqual([TAMRIEL_ROADS_VERSION, GROUND_ROLL_VERSION], [5, 4]);
});

// ── WITH ARENA2: the freeware's own Cyrodiil ────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('RIVER-FORDS on the freeware\'s Cyrodiil: the water\'s paint over a channel\'s pixel keeps every corner of a tile the road painter wrote, and paints the channel elsewhere (mutant: the paths unread)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { tamrielWaters, paintTamrielWaters, riverRaster } = await import('../../../src/world/tamriel/tamrielWaters.js');
  const { WATER } = await import('../../../src/world/terrain/terrainTiles.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (test/ui/tamriel4.test.js)
  try {
    const law = tamrielWaters();
    assert.ok(law && law.pixels.size > 0, 'the carved rivers');
    // a channel's pixel well past the Bay's seam, and the raster over a box about it names it
    let at = null;
    for (const k of law.pixels.keys()) { const x = Math.floor(k / 65536), y = k - x * 65536; if (x > 1100) { at = { x, y }; break; } }
    assert.ok(at);
    const ras = riverRaster(at.x - 2, at.y - 2, 5, 5);
    assert.ok(ras.dir[2 * 5 + 2] > 0, 'riverRaster names it');
    const D = 129, span = 128;
    const bare = new Uint8Array(D * D).fill(1);   // the ground's tiles (WATER is 0)
    const painted = paintTamrielWaters(bare, at.x, at.y);
    assert.ok(painted > 0, 'the channel painted');
    // the road painter's tiles: every tile - the paint keeps them all; half of them - it keeps their corners
    const all = new Uint8Array(span * span).fill(1);
    assert.equal(paintTamrielWaters(new Uint8Array(D * D).fill(1), at.x, at.y, null, D, all), 0, 'a road over every tile: no water');
    const half = new Uint8Array(span * span);
    for (let ty = 0; ty < span; ty++) for (let tx = 0; tx < 64; tx++) half[ty * span + tx] = 1;
    const out = new Uint8Array(D * D).fill(1);
    paintTamrielWaters(out, at.x, at.y, null, D, half);
    for (let y = 0; y < D; y++) for (let x = 0; x <= 64; x++) assert.notEqual(out[y * D + x], WATER, `a road tile's corner kept (${x}, ${y})`);
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
