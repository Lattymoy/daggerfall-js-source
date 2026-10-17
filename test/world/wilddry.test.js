// WILD-DRY (2026-10-12, a player's live client: the map's first open froze 6.7 s, the zone's giants' walking ground
// asking every pixel of the zone whether it is dry and each answer reading the whole 129 x 129 kernel;
// bible/07-Rendering/Performance-Priority.md WILD-DRY) - THE SAME ANSWER, READ ONLY UNTIL IT IS CERTAIN: spawnGroundDry
// is `spawnPlateauFloor(...) > SPAWN_DRY_ELEVATION` for every pixel of every ground - the sea, a beach, a coast either
// way, slopes, ground just over and just under the line - and a dry pixel stops reading early, a wet one reads it all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnGroundDry, spawnPlateauFloor, SPAWN_DRY_ELEVATION } from '../../src/world/spawnedDungeons.js';
import { sampleKernel, HEIGHTMAP_DIMENSION } from '../../src/world/terrain/terrainSampler.js';

const woodsOf = (byteAt, large = 0) => ({
  getHeightMapValue: byteAt,
  getHeightMapValuesRange1Dim(x0, y0, dim) {
    const dst = new Uint8Array(dim * dim);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) dst[x + y * dim] = byteAt(x0 + x, y0 + y);
    return dst;
  },
  getLargeHeightMapValuesRange: (x, y, dim) => new Uint8Array(dim * 3 * dim * 3).fill(large),
});
const GROUNDS = {
  sea: () => 0,
  beach: () => 5,
  justOver: () => 6,
  land: () => 20,
  eastCoast: (x) => (x >= 101 ? 30 : 0),
  westCoast: (x) => (x <= 100 ? 30 : 0),
  northCoast: (x, y) => (y <= 100 ? 30 : 0),
  southCoast: (x, y) => (y >= 101 ? 30 : 0),
  slope: (x, y) => Math.max(0, Math.min(255, (x - 100) * 2 + (y - 100))),
  ridge: (x, y) => (Math.abs(x - 101) + Math.abs(y - 101) < 2 ? 40 : 1),
  lowShore: (x) => (x >= 101 ? 8 : 0),
  // a pixel whose first columns stand over the line and the rest under it (a reading that stopped on the columns read
  // so far would call it dry), and one just under the line that the ground noise would lift over it
  fallingCoast: (x, y) => Math.max(0, Math.min(255, Math.round(-8 * (x - 100) - 8 * (y - 100) + 2))),
  underTheLine: (x, y) => Math.max(0, Math.min(255, Math.round(-8 * (x - 100) - 2 * (y - 100)))),
};

test('WILD-DRY: every pixel of every ground answers as spawnPlateauFloor over SPAWN_DRY_ELEVATION did', () => {
  let dry = 0, wet = 0;
  for (const [name, byteAt] of Object.entries(GROUNDS)) {
    for (const large of [0, 1, 3, 40]) {
      const woods = woodsOf(byteAt, large);
      for (let py = 98; py <= 104; py++) for (let px = 98; px <= 104; px++) {
        const want = spawnPlateauFloor(woods, px, py) > SPAWN_DRY_ELEVATION;
        assert.equal(spawnGroundDry(woods, px, py), want, `${name} (large ${large}) at ${px},${py}`);
        if (want) dry++; else wet++;
      }
    }
  }
  assert.ok(dry > 100 && wet > 100, `both answers met: ${dry} dry, ${wet} wet`);
});

test('WILD-DRY: a dry pixel stops reading early, a wet one reads the whole kernel', () => {
  let reads = 0;
  const counted = (...a) => { const k = sampleKernel(...a); return (x, y) => { reads++; return k(x, y); }; };
  const N = HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION;
  reads = 0; assert.equal(spawnGroundDry(woodsOf(GROUNDS.land), 100, 100, counted), true);
  assert.ok(reads < N / 2, `inland (160 m): ${reads} of ${N} samples read`);
  reads = 0; assert.equal(spawnGroundDry(woodsOf(() => 80), 100, 100, counted), true);
  assert.ok(reads < N / 10, `the mountains (640 m): ${reads} of ${N} samples read`);
  reads = 0; assert.equal(spawnGroundDry(woodsOf(GROUNDS.sea), 100, 100, counted), false);
  assert.equal(reads, N, 'the open sea: every sample');
});

test('WILD-DRY: the spawns\' ground keeps its answer per pixel by it (createSpawnGround)', () => {
  const src = readFileSync(new URL('../../src/world/spawnedDungeons.js', import.meta.url), 'utf8');
  assert.match(src, /if \(d === undefined\) dry\.set\(key, d = spawnGroundDry\(woods, px, py\)\);/);
});
