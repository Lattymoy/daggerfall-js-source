// DW-A: Iliac Puddle No More's coastline bake, BUILT from the player's own
// world (src/world/deepWatersBake.js) - the mod ships it as a 356 MB
// derivative of WOODS.WLD, MAPS.BSA and BLOCKS.BSA, which cannot enter
// the repo, so the port computes the same planes by the rules the file
// proves. Pinned here:
//   - the rules, on synthetic WOODS files (the real reader over bytes
//     made in the test): the threshold, fine any-of-3x3 with rows from
//     the north, the coarse strict majority of fine centres, the border
//     flood (lakes out, a diagonal link in), octile distances x 6.4
//     capped at 255 with the map's outside neither sea nor seed;
//   - the fast sampler is the streamed terrain bit for bit, and the bound
//     never lies (synthetic, and on the real archive when ARENA2_PATH is
//     set);
//   - DeepWaterDistanceBake's queries over the planes (nearest cell,
//     banker's rounding, the baked-south flip, the bilinear in floats);
//   - the cache's key and the client's same-thread fallback;
//   - with DW_BAKE_FILE pointing at the mod's own DistanceBakeVanilla:
//     the distance planes are the file's bytes over the file's masks,
//     every cell tested, and the port's own coastline agrees with the
//     file's to within the ledgered Perlin departure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { generateSamples, SCALED_OCEAN_ELEVATION } from '../src/world/terrainSampler.js';
import {
  WATER_THRESHOLD, EXTRA_NOISE_MAX, BAKE_SUB, BAKE_SUB_FINE, BAKE_DISTANCE_SCALE_METERS, BAKE_DISTANCE_CAP, BAKE_CELL_METERS,
  PIXEL_LAND, PIXEL_SEA, PIXEL_MIXED, classifyPixel, pixelHeightBounds, pixelWaterSampler, fineCellWater,
  coarseCandidateBits, fineMaskBits, fullWaterBits, buildGlobal, buildGlobalSteps, distanceBytes, DeepWatersBake,
  bakedSouthFraction, isValidMapPixel, settleRange,
} from '../src/world/deepWatersBake.js';
import { bakeCacheKey, cachedBake, fnv1a, rectsFingerprint, rectsLookup, BAKE_GENERATOR_VERSION } from '../src/world/deepWatersBakeCache.js';
import { loadDeepWatersBake } from '../src/world/deepWatersClient.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const BAKE_FILE = process.env.DW_BAKE_FILE;
const skipFile = !BAKE_FILE || !existsSync(BAKE_FILE) || !ARENA2
  ? 'DW_BAKE_FILE (the mod’s own DistanceBakeVanilla - game data, never in the repo) and ARENA2_PATH not both set' : false;
const f32 = Math.fround;
const T_SCALED = WATER_THRESHOLD * 1539;

// ---- a synthetic WOODS.WLD, read by the real reader ------------------
// Header (8 u32 + 28 null u32), 500,000 u32 offsets, the 1000 x 500 height
// bytes, then K large-map blocks the offsets share (22 bytes, then 5 x 5).
function syntheticWoods({ height = () => 2, large = () => 0, blocks = 16 } = {}) {
  const N = 1000 * 500, hdr = 32 + 28 * 4, offs = N * 4, blk = 22 + 25;
  const heightOffset = hdr + offs;
  const dataOffset = heightOffset + N;
  const bytes = new Uint8Array(dataOffset + blocks * blk);
  const v = new DataView(bytes.buffer);
  v.setUint32(0, 4, true); v.setUint32(4, 1000, true); v.setUint32(8, 500, true);
  v.setUint32(28, heightOffset, true);
  for (let i = 0; i < N; i++) v.setUint32(hdr + i * 4, dataOffset + (i % blocks) * blk, true);
  for (let y = 0; y < 500; y++) for (let x = 0; x < 1000; x++) bytes[heightOffset + y * 1000 + x] = height(x, y);
  for (let b = 0; b < blocks; b++) for (let k = 0; k < 25; k++) bytes[dataOffset + b * blk + 22 + k] = large(b, k);
  const w = new WoodsFile();
  assert.ok(w.load(bytes), 'the synthetic WOODS loads through the real reader');
  return w;
}

/** A small seeded LCG - the tests' own, so a failure reproduces. */
const lcg = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

// ---- the rules -------------------------------------------------------

test('DW-A: the threshold is the mod’s float - OceanElevation / MaxTerrainHeight + 1e-5, op by op', () => {
  assert.equal(WATER_THRESHOLD, f32(f32(f32(27.2) / 1539) + f32(1e-5)));
  assert.equal(SCALED_OCEAN_ELEVATION, f32(3.4 * 8), 'the sampler’s own float ocean');
  assert.ok(T_SCALED > 27.215 && T_SCALED < 27.216, 'about 27.2154 in scaled units');
  assert.equal(EXTRA_NOISE_MAX, 2.5, 'GetNoise(.., 0.5 amplitude) twice, times 10');
  assert.deepEqual([BAKE_SUB, BAKE_SUB_FINE, BAKE_DISTANCE_SCALE_METERS, BAKE_DISTANCE_CAP], [8, 64, 16, 255], 'the file’s v6 header');
  assert.equal(BAKE_CELL_METERS, 102.4);
});

test('DW-A: a fine cell is water when ANY sample of its 3 x 3 window is - rows counted from the north', () => {
  // One wet sample at x = 10, yNorth = 100: fx in {4, 5} (x in [2fx, 2fx+2]),
  // fy in {13, 14} (yNorth in [126-2fy, 128-2fy]).
  const at = (X, Y) => ({ quick: (x, y) => (x === X && y === Y ? 1 : 0), exact: () => false });
  const wetCells = (s) => { const out = []; for (let fy = 0; fy < 64; fy++) for (let fx = 0; fx < 64; fx++) if (fineCellWater(s, fx, fy)) out.push(`${fx},${fy}`); return out; };
  assert.deepEqual(wetCells(at(10, 100)), ['4,13', '5,13', '4,14', '5,14']);
  assert.deepEqual(wetCells(at(11, 101)), ['5,13'], 'an odd sample is one cell’s centre: x 2*5+1, yNorth 127-2*13');
  assert.deepEqual(wetCells(at(0, 128)), ['0,0'], 'the north-west corner sample is the first row’s first cell');
  assert.deepEqual(wetCells(at(128, 0)), ['63,63'], 'the south-east corner sample the last row’s last cell');
  // The exact test is paid only for samples the quick one cannot settle, and a wet answer ends the cell.
  let exacts = 0;
  const unsure = { quick: (x) => (x === 0 ? -1 : 0), exact: (x, y) => { exacts++; return y === 127; } };
  assert.equal(fineCellWater(unsure, 0, 0), true);
  assert.equal(exacts, 2, 'x 0 is unsettled at yNorth 126, 127: the second is wet and ends it');
  exacts = 0;
  assert.equal(fineCellWater({ quick: (x, y) => (x === 1 && y === 127 ? 1 : -1), exact: () => { exacts++; return false; } }, 0, 0), true);
  assert.equal(exacts, 0, 'a quick wet answer is final, whatever the others would cost');
  // A coarse cell is all-fine-water only when all 64 of its cells are: one dry cell in its last row spoils it.
  const fine = new Uint8Array(512).fill(0xff);
  assert.deepEqual(Array.from(fullWaterBits(fine)), [255, 255, 255, 255, 255, 255, 255, 255]);
  fine[7 * 8] = 0xfe;                                  // fine row 7, column 0: coarse cell (0, 0)'s last row
  assert.equal(fullWaterBits(fine)[0], 254);
  fine[7 * 8] = 0xff; fine[63 * 8 + 7] = 0x7f;         // fine row 63, column 63: coarse cell (7, 7)
  assert.equal(fullWaterBits(fine)[7], 127);
});

test('DW-A: a coarse cell is a candidate on a STRICT majority of its 64 fine-cell centres - 33 is sea, 32 is land', () => {
  // Centres of coarse cell (cx, cy) are (2(8cx+fx)+1, 127-2(8cy+fy)); wet the first k of cell (0,0) row-major.
  const sampler = (k) => ({
    quick: (x, y) => {
      if (x % 2 === 0 || y % 2 === 0) return 0;                       // only centres are asked
      const fx = (x - 1) / 2, fy = (127 - y) / 2;
      if (fx >= 8 || fy >= 8) return 0;
      return fy * 8 + fx < k ? 1 : 0;
    },
    exact: () => false,
  });
  assert.equal(coarseCandidateBits(sampler(33))[0] & 1, 1, '33 of 64');
  assert.equal(coarseCandidateBits(sampler(32))[0] & 1, 0, 'a tie is land');
  assert.equal(coarseCandidateBits(sampler(64))[0], 1, 'and only cell (0,0) - byte = row from the north, bit = column');
  // A cell stops asking once its answer is fixed.
  let exacts = 0;
  const allUnsure = { quick: () => -1, exact: () => { exacts++; return true; } };
  const bits = coarseCandidateBits(allUnsure);
  assert.deepEqual(Array.from(bits), [255, 255, 255, 255, 255, 255, 255, 255]);
  assert.equal(exacts, 64 * 33, 'thirty-three wet centres decide each cell');
  exacts = 0;
  assert.deepEqual(Array.from(coarseCandidateBits({ quick: () => 0, exact: () => { exacts++; return true; } })), new Array(8).fill(0));
  assert.equal(exacts, 0, 'a centre the quick test settles dry is never paid for');
  // 31 settled dry and 33 unsure that are all wet: the answer is still open at 31 dry, and it is sea.
  const mixedCell = {
    quick: (x, y) => { const k = ((127 - y) / 2) * 8 + (x - 1) / 2; return k < 31 ? 0 : -1; },
    exact: () => true,
  };
  assert.equal(coarseCandidateBits(mixedCell)[0] & 1, 1, 'thirty-one dry is not yet a decision');
});

test('DW-A: the flood is 8-connected from the map border - a lake stays out, a corner-to-corner link lets the sea in', () => {
  const W = 1000;
  // Sea: the whole west column x = 0. A lake of sea-class pixels at x = 10..12 walled by land.
  // A second water body at x = 20 joined to a sea arm only through two diagonally touching CELLS across a pixel corner.
  const sea = new Set();
  for (let y = 0; y < 500; y++) sea.add(y * W);
  for (let y = 100; y <= 102; y++) for (let x = 10; x <= 12; x++) sea.add(y * W + x);   // the lake
  for (let x = 1; x <= 18; x++) sea.add(300 * W + x);                                   // an arm from the sea to x 18
  sea.add(301 * W + 20);                                                                 // the body, beyond a mixed pixel
  const mixed = new Map([
    // pixel (19, 300): only its south-east cell is a candidate; pixel (19,301) only its north-west cell? No -
    // (19,300)'s SE cell (row 7, col 7) touches (20,301)'s NW cell diagonally; (19,300)'s west cells join the arm.
    [300 * W + 19, (() => { const b = new Uint8Array(8); for (let r = 0; r < 8; r++) b[r] = 1 << Math.min(7, r); return b; })()],
  ]);
  const classify = (px, py) => (sea.has(py * W + px) ? PIXEL_SEA : mixed.has(py * W + px) ? PIXEL_MIXED : PIXEL_LAND);
  const candidates = (px, py) => mixed.get(py * W + px);
  const g = buildGlobal(null, { classify, candidates });
  const st = (x, y) => g.state[y * W + x];
  assert.equal(st(0, 250), 1, 'the border is sea');
  assert.equal(st(11, 101), 0, 'the lake is candidate water the flood never reaches');
  assert.equal(st(18, 300), 1, 'the arm');
  assert.equal(st(19, 300), 2, 'the mixed pixel is partly sea');
  assert.equal(st(20, 301), 1, 'the body joins through the diagonal: cell (row 7, col 7) of (19,300) touches (row 0, col 0) of (20,301)');
  const k = Array.from(g.partialIndex).indexOf(300 * W + 19);
  assert.deepEqual(Array.from(g.partialBits.subarray(k * 8, k * 8 + 8)), [1, 2, 4, 8, 16, 32, 64, 128], 'the diagonal staircase, whole');
  assert.equal(g.stats.partial, 1);
  // The steps are the build, sliced.
  const steps = buildGlobalSteps(null, { classify, candidates });
  let r, yields = 0; do { r = steps.next(); yields++; } while (!r.done);
  assert.ok(yields > 500, 'at least a yield a row');
  assert.deepEqual(Array.from(r.value.state), Array.from(g.state));
});

test('DW-A: the flood seeds from all four map edges, and a diagonal link carries it either way', () => {
  const W = 1000;
  const run = (seaSet, mixed = new Map()) => buildGlobal(null, {
    classify: (px, py) => (seaSet.has(py * W + px) ? PIXEL_SEA : mixed.has(py * W + px) ? PIXEL_MIXED : PIXEL_LAND),
    candidates: (px, py) => mixed.get(py * W + px),
  });
  // Four seas, each touching one edge only.
  const sea = new Set([0 * W + 400, 499 * W + 400, 250 * W + 0, 250 * W + 999]);
  const g = run(sea);
  assert.equal(g.state[400], 1, 'north edge');
  assert.equal(g.state[499 * W + 400], 1, 'south edge');
  assert.equal(g.state[250 * W], 1, 'west edge');
  assert.equal(g.state[250 * W + 999], 1, 'east edge');
  // The mirror of the staircase: the flood arrives from the SOUTH-EAST and climbs north-west to a body.
  const sea2 = new Set();
  for (let x = 21; x < W; x++) sea2.add(301 * W + x);        // an arm along row 301 from the east edge to x 21
  sea2.add(299 * W + 18);                                     // the body, north-west of the staircase pixel
  const stair = new Uint8Array(8); for (let r = 0; r < 8; r++) stair[r] = 1 << r;
  // The arm's end pixel (20, 301): only its top row is water, reached from the arm at its east column and
  // running west to cell (row 0, col 0), which touches the staircase's (row 7, col 7) corner to corner.
  const g2 = run(sea2, new Map([[300 * W + 19, stair], [301 * W + 20, (() => { const b = new Uint8Array(8); b[0] = 0xff; return b; })()]]));
  assert.equal(g2.state[301 * W + 20], 2, 'the arm’s end pixel, its top row');
  assert.equal(g2.state[300 * W + 19], 2, 'the staircase, reached from its south-east corner');
  assert.equal(g2.state[299 * W + 18], 1, 'and the body beyond its north-west corner');
});

test('DW-A: the pixel-level flood IS an 8-connected cell flood - random coasts against a brute-force BFS', () => {
  const W = 1000;
  for (const seed of [1, 2, 3, 4]) {
    const rnd = lcg(seed * 7919);
    const x0 = 100, y0 = 100, side = 18;
    const cand = new Map();
    for (let py = y0; py < y0 + side; py++) {
      for (let px = x0; px < x0 + side; px++) {
        const b = new Uint8Array(8);
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (rnd() < 0.5) b[r] |= 1 << c;
        cand.set(py * W + px, b);
      }
    }
    const arm = new Set(); for (let x = 0; x < x0; x++) arm.add((y0 + 9) * W + x);    // the sea reaches the west side
    const classify = (px, py) => (arm.has(py * W + px) ? PIXEL_SEA : cand.has(py * W + px) ? PIXEL_MIXED : PIXEL_LAND);
    const g = buildGlobal(null, { classify, candidates: (px, py) => cand.get(py * W + px) });
    // Brute force over cells: candidates are the arm's cells and the region's bits; seeds the map-edge candidates.
    const isCand = (cx, cy) => {
      const px = cx >> 3, py = cy >> 3, i = py * W + px;
      if (arm.has(i)) return true;
      const b = cand.get(i);
      return !!b && ((b[cy & 7] >> (cx & 7)) & 1) === 1;
    };
    const seen = new Set(), q = [];
    for (let cy = (y0 + 9) * 8; cy < (y0 + 10) * 8; cy++) { const k = cy * 8000; seen.add(k); q.push(k); }   // the arm's x = 0 edge
    while (q.length) {
      const k = q.pop(), cx = k % 8000, cy = (k - cx) / 8000;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy, nk = ny * 8000 + nx;
        if ((dx || dy) && nx >= 0 && ny >= 0 && !seen.has(nk) && isCand(nx, ny)) { seen.add(nk); q.push(nk); }
      }
    }
    const partial = new Map(); for (let k = 0; k < g.partialIndex.length; k++) partial.set(g.partialIndex[k], g.partialBits.subarray(k * 8, k * 8 + 8));
    let mismatches = 0, reached = 0;
    for (let py = y0 - 1; py <= y0 + side; py++) {
      for (let px = x0 - 1; px <= x0 + side; px++) {
        const i = py * W + px, st = g.state[i];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
          const mine = st === 1 || (st === 2 && ((partial.get(i)[r] >> c) & 1) === 1);
          const truth = seen.has((py * 8 + r) * 8000 + px * 8 + c);
          if (mine !== truth) mismatches++;
          if (truth) reached++;
        }
      }
    }
    assert.ok(reached > 200, `seed ${seed}: the sea got into the coast (${reached} cells)`);
    assert.equal(mismatches, 0, `seed ${seed}: ${mismatches} cells differ from the brute-force flood`);
  }
});

test('DW-A: distances are octile x 102.4/16, rounded, capped at 255 - the map’s outside is neither sea nor seed', () => {
  // One land cell at (row 0, col 0) of pixel (500, 250); everything else sea.
  const land = (px, py) => (px === 500 && py === 250 ? (() => { const b = new Uint8Array(8).fill(255); b[0] = 254; return b; })() : new Uint8Array(8).fill(255));
  const d = distanceBytes(500, 250, land);
  assert.equal(d[0], 0, 'the land cell');
  assert.equal(d[1], 6, 'one step: 6.4 rounds to 6');
  assert.equal(d[9], 9, 'one diagonal: 9.05');
  assert.equal(d[2], 13, 'two steps: 12.8');
  assert.equal(d[10], 15, 'a step and a diagonal: 15.45');
  assert.equal(d[18], 18, 'two diagonals: 18.1');
  assert.equal(d[3], 19, 'three steps: 19.2');
  assert.equal(d[63], 63, 'seven diagonals: 7 * 1.414 * 6.4 = 63.4');
  // Far from any land: the cap.
  const allSea = () => new Uint8Array(8).fill(255);
  assert.deepEqual(Array.from(distanceBytes(400, 200, allSea)), new Array(64).fill(255), 'no land within reach is 255');
  // At the map's edge the outside is not land: the corner pixel of an all-sea map is 255, not 6.
  const edge = distanceBytes(0, 0, (px, py) => (isValidMapPixel(px, py) ? new Uint8Array(8).fill(255) : null));
  assert.equal(edge[0], 255, 'the file’s own corner cell reads 255');
  // Land 40 cells away in a straight line still counts (255 = 39.8 cells), 41 does not reach.
  const farLand = (dx) => (px, py) => {
    const b = new Uint8Array(8).fill(255);
    if (px === 500 + dx && py === 250) b[0] = 254;
    return b;
  };
  assert.equal(distanceBytes(500, 250, farLand(5))[0], 255, '40 cells east: 256 capped');
  assert.equal(distanceBytes(500, 250, farLand(5))[7], 211, 'but 33 cells from this pixel’s east column: 211.2 - five pixels out is inside the window');
  assert.equal(distanceBytes(500, 250, farLand(4))[0], 205, '32 cells: 204.8');
});

// ---- the sampler and the bound ---------------------------------------

test('DW-A: the fast sampler IS the streamed terrain - every sample of coastal pixels, against generateSamples', () => {
  // A coast with ringing: ocean (2) west, land (6..90) east, large-map bytes noisy.
  const rnd = lcg(7);
  const woods = syntheticWoods({
    height: (x) => (x < 500 ? 2 : x < 502 ? 5 : 9 + ((x * 37) % 80)),
    large: () => Math.floor(rnd() * 6),
  });
  let mixed = 0, checked = 0, bad = 0, outside = 0, wrongClass = 0, wrongQuick = 0;
  for (let px = 496; px <= 506; px++) {
    for (const py of [100, 250]) {
      const cls = classifyPixel(woods, px, py);
      const S = generateSamples(woods, px, py);
      const [lo, hi] = pixelHeightBounds(woods, px, py);
      const s = pixelWaterSampler(woods, px, py);
      for (let x = 0; x < 129; x++) {
        for (let y = 0; y < 129; y++) {
          const h = S[x * 129 + y] * 1539;
          if (h < lo - 1e-6 || h > hi + 1e-6) outside++;
          const wet = S[x * 129 + y] <= WATER_THRESHOLD;
          if ((cls === PIXEL_SEA && !wet) || (cls === PIXEL_LAND && wet)) wrongClass++;
          if (s.water(x, y) !== wet) bad++;
          const q = s.quick(x, y);
          if (q >= 0 && (q === 1) !== wet) wrongQuick++;
          checked++;
        }
      }
      if (cls === PIXEL_MIXED) mixed++;
    }
  }
  assert.ok(mixed >= 4, `the coast has mixed pixels to test (${mixed})`);
  assert.equal(outside, 0, 'the bound holds every sample');
  assert.equal(wrongClass, 0, 'a settled class is never wrong');
  assert.equal(wrongQuick, 0, 'a settled quick answer is never wrong');
  assert.equal(bad, 0, `${bad} of ${checked} samples differ from the streamed terrain`);
});

test('DW-A: ground built to sit on the threshold - the bound is tight where it can be, the band is paid exactly', () => {
  // Flat land at byte 4: the base is exactly 32 everywhere and the large map is 0, so every sample is 32 + the
  // ground noise - a bound that forgot the noise, or shaved the cubic's overshoot, is caught at once.
  const flat = syntheticWoods({ height: () => 4 });
  const [lo, hi] = pixelHeightBounds(flat, 300, 120);
  let above = 0, maxH = 0;
  const S = generateSamples(flat, 300, 120);
  for (let i = 0; i < S.length; i++) { const h = S[i] * 1539; if (h > maxH) maxH = h; if (h > hi + 1e-6 || h < lo - 1e-6) above++; }
  assert.equal(above, 0, `flat ground [${lo}, ${hi}] holds every sample (max ${maxH})`);
  assert.ok(maxH > 32.5, 'and the noise really lifts it');
  assert.equal(classifyPixel(flat, 300, 120), PIXEL_LAND);
  // A spike: one byte of 120 among 2s rings the cubic below and above - the overshoot terms are all that hold it.
  const spike = syntheticWoods({ height: (x, y) => (x === 301 && y === 121 ? 120 : 2) });
  let outside = 0;
  for (const [px, py] of [[300, 120], [301, 120], [302, 121], [301, 122], [302, 123], [303, 122]]) {
    const [l2, h2] = pixelHeightBounds(spike, px, py);
    const S2 = generateSamples(spike, px, py);
    for (let i = 0; i < S2.length; i++) { const h = S2[i] * 1539; if (h > h2 + 1e-6 || h < l2 - 1e-6) outside++; }
  }
  assert.equal(outside, 0, 'the spike’s ringing stays inside the bound');
  // Shallow sea: base 24 (byte 3) under a large map of alternating 0s and 1s, so the first two terms wander
  // through 24..28 and a large share of samples sit inside the 2.5-wide band only the ground noise decides.
  const shallow = syntheticWoods({ height: () => 3, large: (b, k) => (b + k) % 2 });
  let band = 0, checked = 0, bad = 0;
  for (const [px, py] of [[400, 60], [401, 61], [402, 330], [403, 331]]) {
    const s = pixelWaterSampler(shallow, px, py);
    const S3 = generateSamples(shallow, px, py);
    for (let x = 0; x < 129; x++) for (let y = 0; y < 129; y++) {
      if (s.quick(x, y) < 0) band++;
      if (s.water(x, y) !== (S3[x * 129 + y] <= WATER_THRESHOLD)) bad++;
      checked++;
    }
  }
  assert.ok(band > checked / 20, `the band is exercised (${band} of ${checked})`);
  assert.equal(bad, 0, `every band sample decided exactly, at map rows north and south of the middle (${bad} wrong)`);
  // A ramp: bytes 3 west of x = 600 and 4 from it on make pixel 600's base the line 24 + 8 * x / 128, so its
  // western large-map region is provably under 26.7 - under the threshold, but not by the ground noise's 2.5.
  // That region may not be settled wet: where the base passes 24.7 the noise decides, sample by sample.
  const ramp = syntheticWoods({ height: (x) => (x < 600 ? 3 : 4) });
  const s4 = pixelWaterSampler(ramp, 600, 100);
  const S4 = generateSamples(ramp, 600, 100);
  let dryInWestRegion = 0, wrong = 0;
  for (let x = 0; x <= 42; x++) for (let y = 0; y < 129; y++) {
    const wet = S4[x * 129 + y] <= WATER_THRESHOLD;
    if (!wet) dryInWestRegion++;
    if (s4.water(x, y) !== wet) wrong++;
  }
  assert.ok(dryInWestRegion > 50, `the noise lifts some of the western region above the sea (${dryInWestRegion})`);
  assert.equal(wrong, 0, 'and the sampler says so');
  // The region's own decision, by the numbers: heights without the ground noise.
  assert.equal(settleRange(28, 40), 0, 'all above the threshold: land, whatever the noise');
  assert.equal(settleRange(20, 24.6), 1, 'under the threshold by more than the noise can lift');
  assert.equal(settleRange(20, 25), -1, '25 + 2.5 reaches the sea\u2019s 27.2: the samples say');
  assert.equal(settleRange(27, 28), -1);
  assert.equal(settleRange(T_SCALED, T_SCALED), -1, 'on the threshold itself nothing is settled');
});

test('DW-A: a location pixel is sampled whole and blended - the streamed build’s own order', () => {
  const woods = syntheticWoods({ height: (x) => (x < 500 ? 2 : 12) });
  const rect = { xMin: 40, xMax: 88, yMin: 40, yMax: 88 };
  const S = generateSamples(woods, 500, 250);
  let avg = 0; for (let i = 0; i < S.length; i++) avg += S[i]; avg /= S.length;
  const s = pixelWaterSampler(woods, 500, 250, rect);
  // Inside the rect the ground is the pixel's mean: one answer everywhere.
  const inside = s.water(64, 64);
  for (let x = 44; x <= 84; x += 8) for (let y = 44; y <= 84; y += 8) assert.equal(s.water(x, y), inside);
  assert.equal(inside, f32(avg) <= WATER_THRESHOLD, 'the flattened ground reads the average');
});

test('DW-A: the global build on a synthetic world - the sea west, the land east, the bound’s classes sound', () => {
  const woods = syntheticWoods({
    height: (x, y) => (x < 480 ? 2 : x < 486 ? 5 : x < 490 ? 12 : 60) + (y > 200 && y < 204 && x >= 700 && x <= 704 ? -58 : 0),
  });
  const g = buildGlobal(woods);
  const st = (x, y) => g.state[y * 1000 + x];
  assert.equal(st(100, 100), 1, 'open sea');
  assert.equal(st(900, 100), 0, 'inland');
  assert.equal(st(702, 202), 0, 'a sunken pocket in the land is water the flood cannot reach');
  assert.equal(g.classes[202 * 1000 + 702], PIXEL_SEA, '...though the bound calls it sea');
  let coast = 0; for (let y = 0; y < 500; y++) for (let x = 470; x < 500; x++) if (st(x, y) === 2) coast++;
  assert.ok(coast > 0, 'a partial coastline');
  assert.equal(g.stats.land + g.stats.sea + g.stats.mixed, 500000);
});

// ---- the queries -----------------------------------------------------

test('DW-A: DeepWaterDistanceBake’s queries over the planes - nearest cell, banker’s rounding, the baked-south flip', () => {
  const state = new Uint8Array(500000), classes = new Uint8Array(500000);
  // Pixel (100, 50): west half sea (columns 0..3), east half land; everything else land.
  const bits = new Uint8Array(8).fill(0x0f);
  const g = { state, classes, partialIndex: Int32Array.of(50 * 1000 + 100), partialBits: bits };
  state[50 * 1000 + 100] = 2; classes[50 * 1000 + 100] = PIXEL_MIXED;
  const fine = new Uint8Array(512); for (let r = 0; r < 64; r++) fine[r * 8] = 0xff;   // fine columns 0..7 wet
  const bake = new DeepWatersBake({ woods: null, global: g, fineAt: () => fine });
  assert.equal(bake.mapPixelHasWaterCells(100, 50), true);
  assert.equal(bake.mapPixelHasLandCells(100, 50), true);
  assert.equal(bake.mapPixelHasWaterCells(101, 50), false);
  assert.equal(bake.mapPixelOrCardinalNeighborHasWaterCells(101, 50), true, 'the west neighbour has water');
  assert.equal(bake.mapPixelOrCardinalNeighborHasWaterCells(102, 50), false);
  assert.equal(bake.mapPixelHasWaterCells(-1, 50), false, 'off the map');
  // IsWaterAt: fracX 0.3 -> 100*8 + 2.4 - 0.5 = 801.9 -> cell 802 -> column 2: sea; 0.6 -> 804.3 -> 804: land.
  assert.equal(bake.isWaterAt(100, 50, 0.3, 0.5), true);
  assert.equal(bake.isWaterAt(100, 50, 0.6, 0.5), false);
  // Banker's tie: fracX 0.375 -> 800 + 3 - 0.5 = 802.5 -> 802 (even), where Math.round would say 803.
  assert.equal(bake._nearestCell(100, 50, 0.375, 0.5)[0], 802, 'RoundToInt sends x.5 to even');
  // Baked south: fracZ 1 (the north edge) is row 0 of the pixel; fracZ 0.01 its last row. fracZ 0 exactly is
  // 400 + 8 - 0.5 = 407.5 -> 408, the NEXT pixel's first row - the C#'s nearest-cell rounding at the edge.
  assert.equal(bakedSouthFraction(1), 0);
  assert.equal(bake._nearestCell(100, 50, 0.1, 1)[1], 400, 'north edge -> first row');
  assert.equal(bake._nearestCell(100, 50, 0.1, 0.01)[1], 407, 'just north of the south edge -> last row');
  assert.equal(bake._nearestCell(100, 50, 0.1, 0)[1], 408, 'the south edge itself rounds over');
  // IsCarvedWater on the fine plane: fracX 0.1 -> 6400 + 6.4 - 0.5 = 6405.9 -> 6406 -> column 6: wet; 0.2 -> 12.3 -> 12: dry.
  assert.equal(bake.isCarvedWater(100, 50, 0.1, 0.5), true);
  assert.equal(bake.isCarvedWater(100, 50, 0.2, 0.5), false);
  assert.equal(bake.mapPixelHasFineWaterCells(100, 50), true);
  assert.equal(bake.mapPixelHasFineWaterCells(300, 300), false);
  // The distance plane: sea columns 0..3 between the land of pixel 99 and this pixel's column 4.
  assert.equal(bake._byte('dist', 803, 403), 6, 'column 3 is one cell from the land at column 4');
  assert.equal(bake._byte('dist', 800, 403), 6, 'column 0 is one cell from pixel 99’s land');
  assert.equal(bake._byte('dist', 801, 403), 13, 'column 1 is two: 12.8');
  assert.equal(bake._byte('dist', 804, 403), 0, 'land reads 0');
  // The bilinear, in floats: halfway between columns 1 and 2 (13 and 13 bytes) at row 3.5's taps.
  assert.equal(bake.sampleDistanceMeters(100, 50, 2 / 8, 1 - 4 / 8), f32(13 * 16), 'taps at columns 1, 2 and rows 3, 4 are all 13');
  // The edge plane reads the full-fine-water cells: only fine columns 0..7 are wet, so coarse column 0 is full.
  assert.equal(bake._byte('edge', 800, 403), 6, 'coarse column 0 is all-fine-water, next to column 1 which is not');
  assert.equal(bake._byte('edge', 801, 403), 0);
  // Column 1 exactly (fracX 0.1875 -> 800 + 1.5 - 0.5 = 801.0): dist 13 bytes, edge 0.
  assert.equal(bake.sampleDistanceMeters(100, 50, 0.1875, 0.5), 208);
  assert.equal(bake.sampleEdgeDistanceMeters(100, 50, 0.1875, 0.5), 0);
  assert.equal(bake.sampleLocalEdgeDistanceMeters(100, 50, 0.1875, 0.5), 0, 'the local plane is the EDGE plane, not the distance one');
  // The fine plane's own banker's tie: fracX 3/64 -> 6400 + 3 - 0.5 = 6402.5 -> 6402, and only fine column 2 is wet.
  const col2 = new Uint8Array(512); for (let r = 0; r < 64; r++) col2[r * 8] = 0b100;
  const tie = new DeepWatersBake({ woods: null, global: g, fineAt: () => col2 });
  assert.equal(tie.isCarvedWater(100, 50, 3 / 64, 0.5), true, 'RoundToInt(6402.5) is 6402 - Math.round would read the dry column 3');
});

// ---- the cache and the client ----------------------------------------

test('DW-A: the cache key covers what shapes the coastline, and a miss builds once', async () => {
  const k = bakeCacheKey({ woodsHash: 123, rectsHash: 456 });
  assert.equal(k, `dwbake:v${BAKE_GENERATOR_VERSION}:123:456`, 'the generator version leads the key');
  assert.notEqual(k, bakeCacheKey({ woodsHash: 124, rectsHash: 456 }), 'a different WOODS');
  assert.notEqual(k, bakeCacheKey({ woodsHash: 123, rectsHash: 457 }), 'different locations');
  assert.equal(fnv1a(new Uint8Array([1, 2, 3])), fnv1a(Uint8Array.of(1, 2, 3)));
  assert.notEqual(fnv1a(Uint8Array.of(1, 2, 3)), fnv1a(Uint8Array.of(1, 2, 4)), 'one byte of the smoothed heightmap moves the key');
  const rows = [[250500, 10, 20, 30, 40], [100, 1, 2, 3, 4]];
  assert.equal(rectsFingerprint(rows), rectsFingerprint([...rows].reverse()), 'the rows’ order does not matter');
  assert.notEqual(rectsFingerprint(rows), rectsFingerprint([[250500, 10, 21, 30, 40], [100, 1, 2, 3, 4]]), 'a rect one tile wider does');
  assert.deepEqual(rectsLookup(rows)(500, 250), { xMin: 10, xMax: 20, yMin: 30, yMax: 40 });
  assert.equal(rectsLookup(rows)(501, 250), null);
  const mem = new Map(); const store = { async get(x) { return mem.get(x) ?? null; }, async set(x, v) { mem.set(x, v); } };
  let builds = 0;
  const build = () => { builds++; return { state: new Uint8Array(4), classes: new Uint8Array(4), partialIndex: new Int32Array(0), partialBits: new Uint8Array(0), stats: {} }; };
  const a = await cachedBake({ key: k, build, store });
  const b = await cachedBake({ key: k, build, store });
  assert.equal(builds, 1, 'built once');
  assert.equal(a.cached, false); assert.equal(b.cached, true);
  const c = await cachedBake({ key: k, build, store: null });
  assert.equal(builds, 2, 'no store: always builds, never throws'); assert.equal(c.cached, false);
});

test('DW-A: the client falls back to this thread - no Worker, a factory that throws, a worker that errors', async () => {
  const woods = syntheticWoods({ height: (x) => (x < 480 ? 2 : 60) });
  const here = await loadDeepWatersBake({ woods, rects: [], workerFactory: null, store: null });
  assert.ok(here instanceof DeepWatersBake, 'no worker: built here');
  assert.equal(here.mapPixelHasWaterCells(100, 100), true);
  assert.equal(here.mapPixelHasWaterCells(900, 100), false);
  const threw = await loadDeepWatersBake({ woods, woodsBytes: new Uint8Array(4), rects: [], workerFactory: () => { throw new Error('no workers here'); }, store: null });
  assert.ok(threw instanceof DeepWatersBake, 'a factory that throws: built here');
  const erring = () => {
    const w = { terminate() { w.dead = true; }, postMessage() { queueMicrotask(() => w.onmessage({ data: { t: 'error', message: 'boom' } })); } };
    return w;
  };
  const errored = await loadDeepWatersBake({ woods, woodsBytes: new Uint8Array(4), rects: [], workerFactory: erring, store: null });
  assert.ok(errored instanceof DeepWatersBake, 'a worker that answers an error: built here');
  assert.equal(await loadDeepWatersBake({ woods: null }), null, 'no WOODS, no bake');
});

// ---- the real archive ------------------------------------------------

async function realWorld() {
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { buildMapDict } = await import('../src/systems/mapDirectory.js');
  const { smoothLocationNeighbourhood } = await import('../src/world/terrainHelper.js');
  const woods = new WoodsFile();
  woods.load(new Uint8Array(readFileSync(join(ARENA2, 'WOODS.WLD'))));
  const maps = new MapsFile();
  maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  smoothLocationNeighbourhood(buildMapDict(maps), woods);   // the boot repair the baker read after
  return { woods, maps };
}

test('DW-A: on the real archive the bound never lies and the fast sampler is the streamed terrain', { skip: skipReal }, async () => {
  const { woods } = await realWorld();
  const rnd = lcg(1304);
  let mixedSeen = 0, checked = 0, bad = 0, wrongClass = 0;
  for (let k = 0; k < 400 && mixedSeen < 24; k++) {
    const px = Math.floor(rnd() * 1000), py = Math.floor(rnd() * 500);
    const cls = classifyPixel(woods, px, py);
    if (cls !== PIXEL_MIXED && k % 8) continue;          // mostly coast; one pure pixel in eight for the classes
    const S = generateSamples(woods, px, py);
    const s = pixelWaterSampler(woods, px, py);
    for (let i = 0; i < S.length; i++) {
      const x = Math.floor(i / 129), y = i % 129, wet = S[i] <= WATER_THRESHOLD;
      if ((cls === PIXEL_SEA && !wet) || (cls === PIXEL_LAND && wet)) wrongClass++;
      if (s.water(x, y) !== wet) bad++;
      checked++;
    }
    if (cls === PIXEL_MIXED) mixedSeen++;
  }
  assert.ok(mixedSeen >= 10, `coastal pixels tested (${mixedSeen})`);
  assert.equal(wrongClass, 0);
  assert.equal(bad, 0, `${bad} of ${checked}`);
});

// ---- the mod's own file, when the player points at it ----------------

function readFile() {
  const b = readFileSync(BAKE_FILE);
  const v = new DataView(b.buffer, b.byteOffset, 18);
  assert.equal(v.getUint32(0, true), 0x44574442, 'BDWD'); assert.equal(v.getUint16(4, true), 6, 'v6');
  const n = 8000 * 4000, fineBytes = 64000 * 32000 / 8;
  let o = 18;
  const dist = b.subarray(o, o + n); o += n;
  o += n / 8;                                           // the mask: dist > 0, byte for byte (checked below)
  const fine = b.subarray(o, o + fineBytes); o += fineBytes;
  const edge = b.subarray(o, o + n); o += n;
  const local = b.subarray(o, o + n);
  const pixelSea = (px, py) => {
    if (!isValidMapPixel(px, py)) return null;
    const out = new Uint8Array(8);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (dist[(py * 8 + r) * 8000 + px * 8 + c] > 0) out[r] |= 1 << c;
    return out;
  };
  const pixelFine = (px, py) => {
    const out = new Uint8Array(512);
    for (let r = 0; r < 64; r++) out.set(fine.subarray(((py * 64 + r) * 64000 + px * 64) >> 3, (((py * 64 + r) * 64000 + px * 64) >> 3) + 8), r * 8);
    return out;
  };
  return { dist, edge, local, pixelSea, pixelFine };
}

test('DW-A oracle: the distance planes ARE the file’s bytes over the file’s own masks', { skip: skipFile }, () => {
  const F = readFile();
  const rnd = lcg(81);
  let cells = 0, dBad = 0, eBad = 0, lBad = 0;
  const fullOf = (px, py) => (isValidMapPixel(px, py) ? fullWaterBits(F.pixelFine(px, py)) : null);
  for (let k = 0; k < 2000 && cells < 64 * 120; k++) {
    const px = Math.floor(rnd() * 1000), py = Math.floor(rnd() * 500);
    const d = distanceBytes(px, py, F.pixelSea), e = distanceBytes(px, py, fullOf);
    let coastal = false;
    for (let i = 0; i < 64; i++) {
      const g = (py * 8 + (i >> 3)) * 8000 + px * 8 + (i & 7);
      if (F.dist[g] > 0 && F.dist[g] < 255) coastal = true;
    }
    if (!coastal && k % 10) continue;
    for (let i = 0; i < 64; i++) {
      const g = (py * 8 + (i >> 3)) * 8000 + px * 8 + (i & 7);
      if (d[i] !== F.dist[g]) dBad++;
      if (e[i] !== F.edge[g]) eBad++;
      if (F.local[g] !== F.edge[g]) lBad++;
      cells++;
    }
  }
  assert.ok(cells >= 64 * 100);
  assert.equal(dBad, 0, 'dist = octile distance of the sea mask, x 6.4, rounded, capped');
  assert.equal(eBad, 0, 'edge = the same over the all-fine-water cells');
  assert.equal(lBad, 0, 'local = edge');
});

test('DW-A oracle: the port’s own coastline agrees with the file to within the Perlin departure', { skip: skipFile }, async () => {
  const F = readFile();
  const { woods } = await realWorld();
  const g = buildGlobal(woods);   // no location rects: the pixels sampled below are location-free
  const bake = new DeepWatersBake({ woods, global: g });
  let sea = 0, seaAgree = 0;
  for (let cy = 0; cy < 4000; cy += 3) {
    for (let cx = 0; cx < 8000; cx += 3) {
      const f = F.dist[cy * 8000 + cx] > 0;
      if (f === bake._coarseBit(cx, cy)) seaAgree++;
      sea++;
    }
  }
  assert.ok(seaAgree / sea > 0.998, `coarse sea agreement ${(seaAgree / sea).toFixed(5)}`);
  let fine = 0, fineAgree = 0, pixels = 0;
  const rnd = lcg(1313);
  while (pixels < 40) {
    const px = Math.floor(rnd() * 1000), py = Math.floor(rnd() * 500);
    const f = F.pixelFine(px, py);
    let any = 0, all = 0xff; for (const b of f) { any |= b; all &= b; }
    if (!any || all === 0xff) continue;                  // coastal pixels only
    const p = bake.fineBits(px, py);
    for (let i = 0; i < 512; i++) { let x = ~(p[i] ^ f[i]) & 0xff; while (x) { fineAgree += x & 1; x >>= 1; } }
    fine += 4096; pixels++;
  }
  assert.ok(fineAgree / fine > 0.9, `fine agreement on coastal pixels ${(fineAgree / fine).toFixed(4)}`);
});
