// AUDIT TESA III E1-1 (2026-10-26, bible/01-Overview/audits/Audit-Tesa-III-E1.md, routed to the roads' stream) - TS2'S ROAD
// RING ROUND A TOWN'S OUTLINE, PAVED WHOLE AND NEVER OVER THE SEA. TOWN-SHAPES TS2 moved Basic Roads' "paint roads around
// locations" from the rect's padding to its outline's ring (world/terrain/terrainTiles.js townRoadRing), and the ring runs
// past the rect - where FAST-SUITE's guard (world/road/roadPainter.js paintRoads) passed every tile off the centre cross,
// the diagonals and the rect by, so 17.9% of the Bay's ring tiles were ever paved; and the ring paved 46 on any ground, the
// sea a shore town keeps among it. Now the guard passes no ring tile, the ring paves no water, and smoothRoadHeights keeps
// off the ring as it keeps off the rect (the padding it stands for was never smoothed). The roads past the Bay's curved
// painter (world/road/roadCurves.js paintCurvedPaths) paved the whole ring already and keeps off the water too.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { paintRoads, smoothRoadHeights, TILE } from '../../../src/world/road/roadPainter.js';
import { paintCurvedPaths } from '../../../src/world/road/roadCurves.js';
import { DIR } from '../../../src/world/road/roadNetwork.js';

const DIM = 128, H = 129;
/** A town's rect in the middle and its ring a band round it, beyond the rect: rows 20 and 107 and columns 20 and 107, from
 *  20 to 107 - off the centre cross and the two diagonals where (30, 20) and (20, 90) stand. */
const ringRect = () => {
  const ring = new Uint8Array(DIM * DIM);
  for (let k = 20; k <= 107; k++) { ring[20 * DIM + k] = 1; ring[107 * DIM + k] = 1; ring[k * DIM + 20] = 1; ring[k * DIM + 107] = 1; }
  return { xMin: 40, xMax: 88, yMin: 40, yMax: 88, ring };
};

test('AUDIT TESA III E1-1 the ring is paved whole: a ring tile off the rect, the cross and the diagonals - the guard passed it by - is paved; every tile off the ring as the painter laid it (mutant: the guard\'s ring clause)', () => {
  const rect = ringRect();
  const td = new Uint8Array(H * H).fill(TILE.grass), tm = new Uint8Array(DIM * DIM);
  paintRoads(td, tm, DIR.N | DIR.S, 0, rect, H, {});
  assert.equal(tm[20 * DIM + 30], 46, 'the ring at (30, 20)');
  assert.equal(tm[90 * DIM + 20], 46, 'and at (20, 90)');
  let ring = 0, paved = 0;
  for (let i = 0; i < DIM * DIM; i++) if (rect.ring[i]) { ring++; if (tm[i]) paved++; }
  assert.equal(paved, ring, `every ring tile: ${paved} of ${ring}`);
  // off the ring, the rect's law as ever: the same pixel with no ring paves its padding, the arms alike
  const plain = new Uint8Array(DIM * DIM), bare = new Uint8Array(DIM * DIM);
  paintRoads(new Uint8Array(H * H).fill(TILE.grass), plain, DIR.N | DIR.S, 0, { ...rect, ring: null }, H, {});
  paintRoads(new Uint8Array(H * H).fill(TILE.grass), bare, DIR.N | DIR.S, 0, null, H, {});
  for (let i = 0; i < DIM * DIM; i++) if (!rect.ring[i] && !(i % DIM > 40 && i % DIM < 88 && (i / DIM | 0) > 40 && (i / DIM | 0) < 88)) assert.equal(tm[i], bare[i], `tile ${i} off the ring and the rect: the arms' own`);
  assert.equal(plain[50 * DIM + 50], 46, 'no ring: the rect\'s padding');
});

test('AUDIT TESA III E1-1 the ring paves no sea: a ring tile over water stays the water a shore town keeps - on the Bay and past it (mutants: the water clause, the curved painter\'s)', () => {
  const rect = ringRect();
  const td = new Uint8Array(H * H).fill(TILE.grass);
  td[20 * H + 30] = TILE.water;   // the ring at (30, 20) over the sea
  const tm = new Uint8Array(DIM * DIM);
  paintRoads(td, tm, DIR.N | DIR.S, 0, rect, H, {});
  assert.equal(tm[20 * DIM + 30], 0, 'the Bay\'s painter: water');
  assert.equal(tm[20 * DIM + 31], 46, 'its dry neighbour paved');
  const tc = new Uint8Array(DIM * DIM);
  paintCurvedPaths(td, tc, { px: 0, py: 0, road: DIR.N | DIR.S, track: 0, byteAt: () => 0, rect });
  assert.equal(tc[20 * DIM + 30], 0, 'past the Bay: water');
  assert.equal(tc[20 * DIM + 31], 46);
});

test('AUDIT TESA III E1-1 a ring tile\'s ground is never smoothed, as the rect\'s padding never was; a road\'s tile off it as ever (mutant: the smoothing\'s ring clause)', () => {
  const rect = ringRect();
  const tm = new Uint8Array(DIM * DIM);
  tm[20 * DIM + 30] = 46;   // a ring tile paved
  tm[10 * DIM + 64] = 46;   // a road's tile off the ring and the rect
  const samples = new Float32Array(H * H);
  for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) samples[x * H + y] = (x * 7 + y * 13) % 5;
  const before = Float32Array.from(samples);
  smoothRoadHeights(samples, tm, H, rect);
  for (const [x, y] of [[30, 20], [31, 20], [30, 21], [31, 21]]) assert.equal(samples[x * H + y], before[x * H + y], `the ring's corner (${x}, ${y})`);
  assert.notEqual(samples[64 * H + 10], before[64 * H + 10], 'the road\'s own smoothed');
});
