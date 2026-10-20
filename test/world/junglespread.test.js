// SPREAD (2026-10-19, the owner: "Lets spread out on the distance between trees"). BANTHA1's canopy stood a tree in every
// cell of 2 x 2 tiles (12.8 m apart, as near as 5 m), and its young trees and palms rolled a tile's dice each (two as near
// as 1.3 m): ~5,700 trees a pixel, one to 118 m², the nearest neighbour 7 m at the median. Now the canopy stands on every
// other cell - a quincunx on the world's lattice - in its middle half, and the young trees and the palms one a cell at
// most: about 16 m between the canopy's trunks, never under 9 m; a cell between the understorey's; and the owner's crowns,
// 16-19 m across, still meet overhead. world/terrain/jungleNature.js; bible/03-World/Bantha-Jungle.md "The layout".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUNGLE, JUNGLE_PALMS, JUNGLE_COVER, withJungle, canopySite } from '../../src/world/terrain/jungleNature.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_BEACH_ELEVATION, TERRAIN_SIZE as PIXEL_M } from '../../src/world/terrain/terrainSampler.js';

const WHOLE = Object.freeze([3, 3, 3, 3, 3, 3, 3, 3, 3]);
const CELL_M = (PIXEL_M / 128) * JUNGLE.cell;
/** a whole jungle pixel over flat grass */
const flat = { hm: new Float32Array(HEIGHTMAP_DIMENSION ** 2).fill((SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT) * 1.6), tm: new Uint8Array(16384).fill(2) };
const lay = (px, py) => withJungle([], flat.hm, flat.tm, { mapPixelX: px, mapPixelY: py, locationRect: null, jungle: { nine: WHOLE, pois: [], paths: null } });
const canopyOf = (l) => l.filter((f) => f.jungle != null && f.js >= JUNGLE.canopyScale[0]);
const underOf = (l) => l.filter((f) => (f.jungle != null && f.js <= JUNGLE.underScale[1]) || (f.jungle == null && JUNGLE_PALMS.includes(f.record)));
const nearest = (list) => list.map((a) => { let d = Infinity; for (const b of list) if (b !== a) d = Math.min(d, Math.hypot(a.x - b.x, a.z - b.z)); return d; }).sort((p, q) => p - q);

test('SPREAD the canopy\'s sites: every other cell, a quincunx on the world\'s lattice - the same parity across a pixel\'s edge, and every cell\'s four edge neighbours the other kind (mutants: every cell a site)', () => {
  const C = JUNGLE.cell;
  for (const [wx, wz] of [[0, 0], [C, C], [-C, C], [128 * 954, -128 * 318]]) assert.equal(canopySite(wx, wz), true, `${wx}, ${wz}`);
  for (const [wx, wz] of [[C, 0], [0, -C], [128 * 954 + C, -128 * 318]]) assert.equal(canopySite(wx, wz), false, `${wx}, ${wz}`);
  for (let i = -20; i < 20; i++) for (let j = -20; j < 20; j++) {
    const wx = i * C, wz = j * C;
    assert.notEqual(canopySite(wx, wz), canopySite(wx + C, wz)); assert.notEqual(canopySite(wx, wz), canopySite(wx, wz + C));
  }
  // a pixel's last column and its east neighbour's first: a pixel is 128 tiles, 64 cells - the lattice runs on
  assert.notEqual(canopySite(954 * 128 + 126, -318 * 128), canopySite(955 * 128, -318 * 128));
});

test('SPREAD the canopy\'s trunks: none nearer than a site\'s diagonal less its jitter (9 m) - in a pixel and across its edge; half the cells\' trees (mutants: every cell a site; the jitter the old 60%; a neighbour pixel\'s cells held as sites whatever their parity)', () => {
  const [i0, i1] = JUNGLE.inset;
  const least = CELL_M * (1 - (i1 - i0)) * Math.SQRT2;
  assert.ok(least > 9 && least < 9.1, `the least distance (${least.toFixed(2)} m)`);
  const a = lay(954, 318), b = lay(955, 318);
  const trunks = [...canopyOf(a), ...canopyOf(b).map((f) => ({ ...f, x: f.x + PIXEL_M }))];
  const nn = nearest(trunks);
  assert.ok(nn[0] >= least - 1e-6, `the nearest two trunks ${nn[0].toFixed(2)} m apart`);
  assert.ok(nn[Math.floor(nn.length / 2)] > 14, `the median ${nn[Math.floor(nn.length / 2)].toFixed(1)} m`);
  const canopy = canopyOf(a).length, sites = (128 / JUNGLE.cell) ** 2 / 2;
  assert.ok(canopy > sites * 0.6 && canopy <= sites, `a site's tree (${canopy} of ${sites} sites)`);
});

test('SPREAD the understorey: a young tree or a palm a cell at most, so never nearer each other than a cell less its spot\'s jitter; the jungle\'s trees one to 220 m² and more, the nearest neighbour 10 m and more at the median - where they stood one to 118 m² and 7 m (mutants: the understorey a tile\'s; its spot the whole cell; a plant of the floor on its tile)', () => {
  const [u0, u1] = JUNGLE.underInset;
  const least = CELL_M * (1 - (u1 - u0));
  assert.ok(least > 5, `a cell less its jitter (${least.toFixed(2)} m)`);
  const out = lay(954, 318), under = underOf(out);
  const cells = new Map();
  for (const f of under) {
    const k = `${Math.floor(f.x / CELL_M)},${Math.floor(f.z / CELL_M)}`;
    assert.ok(!cells.has(k), `one at most in cell ${k}`);
    cells.set(k, f);
  }
  // and its tile is its own: no plant of the floor grows out of a young tree's or a palm's trunk (one roll a tile stood one
  // of the three before)
  const tileOf = (f) => `${Math.floor(f.x / (PIXEL_M / 128))},${Math.floor(f.z / (PIXEL_M / 128))}`;
  const underTiles = new Set(under.map(tileOf));
  const plants = out.filter((f) => f.jungle == null && JUNGLE_COVER.includes(f.record));
  assert.ok(plants.length > 4000, `the floor (${plants.length})`);
  assert.equal(plants.filter((f) => underTiles.has(tileOf(f))).length, 0, 'no plant on an understorey tree\'s tile');
  const nn = nearest(under);
  assert.ok(nn[0] >= least - 1e-6, `the nearest two ${nn[0].toFixed(2)} m apart (a cell less its jitter: ${least.toFixed(2)} m)`);
  const trees = [...canopyOf(out), ...under];
  assert.ok(under.length > 400, `an understorey (${under.length})`);
  const area = PIXEL_M ** 2 / trees.length, all = nearest(trees);
  assert.ok(area > 220, `a tree to ${area.toFixed(0)} m²`);
  assert.ok(all[Math.floor(all.length / 2)] > 10, `the nearest neighbour ${all[Math.floor(all.length / 2)].toFixed(1)} m at the median`);
  assert.ok(all[Math.floor(all.length / 100)] > 4, `and ${all[Math.floor(all.length / 100)].toFixed(1)} m at the nearest hundredth`);
});
