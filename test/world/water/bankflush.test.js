// BANK-FLUSH (2026-10-12) - THE WATER'S EDGE MEETS THE GROUND, PINNED. The bed lowered every wet grid vertex, and the
// sheet stops mid-tile (its corner table's coverage, a puddle's art), so at a shore the sheet's edge hung over a carved
// slope and the eye at the bank looked under it ("the whole water texture is flying"). The ground is now carved only
// past a cell from the bank and round no puddle tile; the sheet keeps the bed's own depths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { waterBedDepths, waterBedCarve, bedFields, waterBedOf, flatGrid, bedProfile, BED_DEPTH, BED_RAMP, TILE_UNITS, SHELF_CHAMFER } from '../../../src/world/water/waterBed.js';
import { WATER_DRAW_MASK_TABLE } from '../../../src/world/water/waterCorners.js';
import { PUDDLE_RECORDS } from '../../../src/world/puddleMask.js';
import { WATER_SURFACE_VS } from '../../../src/render/waterSurface.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const DRY = 1 << 2;
/** a seeded generator, so a failure names its map */
const rng = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

test('BANK-FLUSH: the shelf is one cell, diagonal included, and the swell grows only where water stands over the ground (mutants: the shelf, the swell\'s depth)', () => {
  assert.equal(SHELF_CHAMFER, 4);
  // ground, 0 on the shelf (its ground stands at the level), so the swell grows from nothing there
  assert.match(WATER_SURFACE_VS, /smoothstep\(0\.0, 2\.500, aDepth\.x\)/, 'the swell grows with the depth over the ground');
});

test('BANK-FLUSH: on any shore, every tile the sheet has an edge in - a corner its table calls dry, or a puddle\'s art - has all four corners uncarved, so the sheet\'s edge lies on its ground; open water still carves to BED_DEPTH; the carve never passes the sheet\'s depth (mutants: the shelf skipped, the puddles kept, the halo\'s carve)', () => {
  const shores = [];
  for (let b = 0; b < 256; b++) { const m = WATER_DRAW_MASK_TABLE[b]; if (m && m !== 15 && !PUDDLE_RECORDS.includes(b >> 2)) shores.push(b); }
  const puddles = PUDDLE_RECORDS.map((r) => r << 2);
  for (let seed = 1; seed <= 12; seed++) {
    const r = rng(seed), T = 24, bytes = new Uint8Array(T * T).fill(DRY);
    // a blob of open water, ringed by shore tiles and dotted with puddle tiles
    for (let z = 3; z < T - 3; z++) for (let x = 3; x < T - 3; x++) {
      const k = r();
      bytes[z * T + x] = k < 0.7 ? 0 : k < 0.92 ? shores[Math.floor(r() * shores.length)] : puddles[Math.floor(r() * puddles.length)];
    }
    for (const stride of [1, 2]) {
      const f = bedFields(bytes, { tileDim: T, stride });
      if (!f) continue;
      const g = T / stride + 1;
      assert.deepEqual(f.depths, waterBedDepths(bytes, { tileDim: T, stride }), 'the sheet\'s depths are the bed\'s, as before');
      assert.deepEqual(f.carve, waterBedCarve(bytes, { tileDim: T, stride }));
      for (let i = 0; i < f.carve.length; i++) assert.ok(f.carve[i] <= f.depths[i] + 1e-6, `seed ${seed}: the carve under the sheet's depth at ${i}`);
      if (stride !== 1) continue;
      for (let tz = 0; tz < T; tz++) for (let tx = 0; tx < T; tx++) {
        const b = bytes[tz * T + tx], m = WATER_DRAW_MASK_TABLE[b];
        if (!m || (m === 15 && !PUDDLE_RECORDS.includes(b >> 2))) continue;
        for (const [vx, vz] of [[tx, tz], [tx + 1, tz], [tx, tz + 1], [tx + 1, tz + 1]]) {
          assert.equal(f.carve[vz * g + vx], 0, `seed ${seed}: tile (${tx}, ${tz}) byte ${b} has an edge - its corner (${vx}, ${vz}) is ground`);
        }
      }
    }
  }
  const open = new Uint8Array(16 * 16);   // no bank at all
  assert.ok(waterBedCarve(open, { tileDim: 16 }).every((d) => d === BED_DEPTH), 'open water with no bank is carved whole');
  // a straight bank: a cell in is the shelf (uncarved), the bed's profile a cell further in
  const bank = new Uint8Array(32 * 32).fill(DRY);
  for (let z = 0; z < 32; z++) for (let x = 8; x < 32; x++) bank[z * 32 + x] = 0;
  const c = waterBedCarve(bank, { tileDim: 32 }), d = waterBedDepths(bank, { tileDim: 32 }), row = 16 * 33;
  assert.deepEqual([c[row + 8], c[row + 9]], [0, 0], 'the bank and a cell in: ground');
  assert.ok(d[row + 9] > 0.9, 'where the sheet still reads a unit of water');
  assert.ok(Math.abs(c[row + 10] - BED_DEPTH * bedProfile((6 - SHELF_CHAMFER) * (TILE_UNITS / 3) / BED_RAMP)) < 1e-5, 'two cells in, the profile\'s first step');
});

test('BANK-FLUSH: a grid\'s bed - the ground lowered by the carve, the sheet\'s shading never under the bed\'s depths; the fixed town alike; the re-carve levels the sheet again and uploads the ground where it moved (mutants: the ground by the sheet\'s depths)', () => {
  const T = 16, bytes = new Uint8Array(T * T).fill(DRY);
  for (let z = 2; z < 14; z++) for (let x = 2; x < 14; x++) bytes[z * T + x] = 0;
  const grid = flatGrid(T, T, 10);
  const bed = waterBedOf(grid, bytes, { tileDim: T, width: T, height: T });
  const f = bedFields(bytes, { tileDim: T });
  assert.deepEqual(bed.depths, f.carve, '`depths` is what the ground moved (the snow\'s height reads it)');
  for (let i = 0; i < f.depths.length; i++) {
    assert.ok(Math.abs(bed.sheet.depths[i * 2] - f.carve[i]) < 1e-5, 'flat water: the plane over the carve by the carve');
    assert.ok(bed.sheet.depths[i * 2 + 1] >= f.depths[i] - 1e-6, 'the shading never under the bed\'s profile');
  }
  for (let i = 0; i < f.carve.length; i++) assert.ok(Math.abs(bed.ground.positions[i * 3 + 1] - (10 - f.carve[i])) < 1e-5);
  assert.equal(bed.ground.positions[(3 * 17 + 3) * 3 + 1], 10, 'a cell in from the bank, the ground stands');
  const w = rd('src/scenes/world.js'), recarve = w.slice(w.indexOf('  function dwRecarve(p) {'), w.indexOf('  function hostBed(grid, bed)'));
  assert.match(recarve, /const bed = gridBed\(grid, bedBytesOf\(p\), stride, halo, p\);/, 'PIN MOVED (WATER-LEVEL): levelled by the TileMap that stands, the pixel\'s own laws');
  assert.match(recarve, /const moved = !same\(bed\?\.depths \?\? null, p\._bed\.depths\);[^\n]*\n\s*p\._bed = [^\n]*\n\s*if \(!moved\) return;/, 'the sheet kept new always, the ground uploaded where the carve moved');
});
