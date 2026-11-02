// BANTHA2 (2026-10-19, the owner, with a map of the Iliac Bay and an area of its south-eastern shore painted red: "The area
// is red in bantha and should be the jungle biome"): WHERE BANTHA IS - the owner's red read into map pixels
// (tools/banthaArea.mjs), the rows the jungle stands on (src/world/jungle/banthaArea.js), and the field that reads them
// (src/world/jungle/jungleRegion.js). bible/03-World/Bantha-Jungle.md "Where the jungle is" is the record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BANTHA_AREA_ROWS, banthaAreaHas } from '../../src/world/jungle/banthaArea.js';
import { jungleField, jungleFieldOf, JUNGLE_FIELD_REACH } from '../../src/world/jungle/jungleRegion.js';
import { BANTHA_DRAWN, DRAWN_W, DRAWN_H, DRAWN_SCALE, COAST_REACH, banthaArea, areaRows } from '../../tools/banthaArea.mjs';
import { REGION_RACES } from '../../src/formats/mapsTables.js';

const ROOT = join(import.meta.dirname, '..', '..');
const A = process.env.ARENA2_PATH;
const HAVE = !!A && existsSync(join(A, 'POLITIC.PAK'));

test('BANTHA2 THE AREA: the owner\'s red as map pixels - every row in order, its runs in order and apart, on the map; 25,787 pixels in the box (591, 272) to (999, 357); banthaAreaHas reads each run to its ends and nothing past them (mutants: a run\'s ends dropped; a row read off its neighbour)', () => {
  let n = 0, x0 = Infinity, x1 = -1, prev = -1;
  for (const r of BANTHA_AREA_ROWS) {
    assert.ok(r[0] > prev, `row ${r[0]} after ${prev}`);
    prev = r[0];
    assert.ok(r.length >= 3 && r.length % 2 === 1, `row ${r[0]}: runs in pairs`);
    for (let k = 1; k < r.length; k += 2) {
      assert.ok(r[k] >= 0 && r[k + 1] < 1000 && r[k] <= r[k + 1], `row ${r[0]}: a run on the map`);
      if (k > 1) assert.ok(r[k] > r[k - 1] + 1, `row ${r[0]}: two runs apart, never touching`);
      n += r[k + 1] - r[k] + 1; x0 = Math.min(x0, r[k]); x1 = Math.max(x1, r[k + 1]);
      assert.ok(banthaAreaHas(r[k], r[0]) && banthaAreaHas(r[k + 1], r[0]), `row ${r[0]}: a run's ends`);
      assert.ok(!banthaAreaHas(r[k] - 1, r[0]) && !banthaAreaHas(r[k + 1] + 1, r[0]), `row ${r[0]}: nothing past them`);
    }
  }
  assert.equal(n, 25787);
  assert.deepEqual([x0, BANTHA_AREA_ROWS[0][0], x1, BANTHA_AREA_ROWS.at(-1)[0]], [591, 272, 999, 357]);
  for (const y of [BANTHA_AREA_ROWS[0][0] - 1, BANTHA_AREA_ROWS.at(-1)[0] + 1, -1, 500]) for (let x = 0; x < 1000; x += 7) assert.ok(!banthaAreaHas(x, y));
  // the drawing it came from: the owner's red on their 400 x 200 map, 4,185 of their pixels
  assert.equal(BANTHA_DRAWN.reduce((s, [, ...runs]) => s + runs.reduce((t, v, i) => t + (i % 2 ? v + 1 : -v), 0), 0), 4185);
  assert.deepEqual([DRAWN_W, DRAWN_H, DRAWN_SCALE], [400, 200, 2.5], 'their map is the 1000 x 500 at 0.4');
});

test('BANTHA2 THE FIELD READS THE AREA: the world\'s jungle field is the owner\'s area - Satakalaam, Lainlyn and Mournoth deep inside it, Glenpoint (BANTHA1\'s) and Daggerfall far out, the map\'s eastern edge its edge; the jungle\'s heart 32 km in (mutants: the field\'s default not the area)', () => {
  const f = jungleFieldOf({}, 1000, 500);
  const far = JUNGLE_FIELD_REACH + 0.5;
  for (const [x, y, name] of [[839, 302, 'Satakalaam'], [737, 289, 'Lainlyn'], [954, 318, 'Mournoth\'s heart']]) assert.equal(f.at(x, y), far, `${name}: inside past the reach`);
  for (const [x, y, name] of [[200, 160, 'Glenpoint'], [207, 213, 'Daggerfall'], [400, 400, 'the Alik\'r']]) assert.equal(f.at(x, y), -far, `${name}: outside past the reach`);
  assert.equal(f.at(999, 318), 0.5, 'the map\'s last column: half a pixel to its edge');
  assert.equal(f.at(1000, 318), -far, 'past the map: outside');
  const deep = jungleField({ width: 1000, height: 500, reach: 60 });
  assert.ok(Math.abs(deep.at(954, 318) * 0.8192 - 31.6) < 0.1, `the heart ${deep.at(954, 318).toFixed(2)} pixels in`);
});

/** A drawn map for the derivation: the Bay's sea to row 199, a strip of High Rock's shore (Wayrest's, region 23) across
 *  an inlet at rows 195-199 over x 600-700, Hammerfell's land (Mournoth's, 52) from row 205 with a lake at (650-652,
 *  250-252); the drawing a block from their row 78 (map 195-197, over the water) over their columns 240-339 - its
 *  columns 250-279 from their row 84 (map 210, five rows under the coast) - its south edge a staircase,
 *  a hole of 4 x 4 of their pixels left unpainted and one of a single pixel at their (320, 95); beside it a line one of
 *  their pixels wide (their column 360, rows 85-100) and one a pixel high (their row 140, columns 345-355). */
function drawnWorld() {
  const regionAt = (x, y) => {
    if (y >= 195 && y < 200 && x >= 600 && x <= 700) return 23;
    if (y < 205) return 31;
    if (x >= 650 && x <= 652 && y >= 250 && y <= 252) return 31;
    return 52;
  };
  const drawing = [];
  for (let v = 78; v <= 130; v++) {
    const runs = [];
    const south = v > 110 ? 240 + (v - 110) * 3 : 240;   // the staircase: three of their columns a row
    if (v < 84) runs.push(south, 249, 280, 339);                  // their columns 250-279 begin at their row 84: map 210, under the coast
    else if (v >= 100 && v <= 103) runs.push(south, 299, 304, 339);   // the hole: their columns 300-303
    else if (v === 95) runs.push(south, 319, 321, 339);          // a hole of one of their pixels
    else runs.push(south, 339);
    if (v >= 85 && v <= 100) runs.push(360, 360);                // a line one of their pixels wide
    drawing.push([v, ...runs]);
  }
  drawing.push([140, 345, 355]);                                 // ...and one a pixel high
  return { regionAt, drawing };
}

test('BANTHA2 THE DERIVATION (tools/banthaArea.mjs): the drawing at its own resolution smoothed - a hole of one of their pixels closed, a line one of their pixels across kept one map pixel across - on Hammerfell\'s land, each column within reach of the coast run on up to it, the water it closes round its own and the land it left unpainted not; its west edge where their pixel 240 begins, map pixel 600 (mutants: High Rock\'s shore kept; the coast not reached, or reached from inland; the lake left out; the hole filled; the smoothing gone, one way or its threshold moved; the pixel\'s corner for its centre)', () => {
  const { regionAt, drawing } = drawnWorld();
  const area = banthaArea({ width: 1000, height: 500, regionAt, races: REGION_RACES, drawing });
  const has = (x, y) => area[y * 1000 + x] === 1;
  assert.deepEqual([REGION_RACES[23], REGION_RACES[52]], [0, 1], 'Wayrest High Rock\'s, Mournoth Hammerfell\'s');
  for (let x = 600; x <= 700; x += 5) for (let y = 195; y < 200; y++) assert.ok(!has(x, y), 'High Rock\'s shore over the inlet is not Bantha');
  for (let x = 610; x < 840; x += 3) {
    assert.ok(has(x, 205), `column ${x}: run on up to the coast (625-699 drawn from five rows under it)`);
    assert.ok(!has(x, 204), `column ${x}: the sea is not`);
  }
  for (let x = 650; x <= 652; x++) for (let y = 250; y <= 252; y++) assert.ok(has(x, y), 'the lake it closes round');
  assert.ok(!has(756, 254) && !has(755, 256), 'the land left unpainted');
  assert.ok(has(600, 230) && !has(599, 230), 'the west edge: where their pixel 240 begins');
  // the staircase: three of their columns a row - 7.5 map columns a 2.5-row step, unsmoothed; smoothed, a slope
  let jump = 0, prev = null;
  for (let x = 620; x < 760; x++) {
    let bottom = -1;
    for (let y = 205; y < 500; y++) if (has(x, y)) bottom = y;
    if (prev !== null) jump = Math.max(jump, Math.abs(bottom - prev));
    prev = bottom;
  }
  assert.ok(jump <= 1, `the drawn staircase a slope, a row a column at most (${jump})`);
  // the drawing's smallest features: a hole of one of their pixels closes, a line one of their pixels across stays one
  // map pixel across, either way
  for (let y = 235; y < 243; y++) for (let x = 797; x < 806; x++) assert.ok(has(x, y), `the pinhole at (${x}, ${y}) closed`);
  assert.deepEqual([890, 895, 900, 901, 902, 905].filter((x) => has(x, 230)), [901], 'a line one of their pixels wide: one map column');
  assert.deepEqual([346, 349, 350, 351, 352, 355].filter((y) => has(870, y)), [351], 'a line one of their pixels high: one map row');
  assert.equal(COAST_REACH, 6);
  // a column whose top stands further from the water than COAST_REACH is where they drew it
  const deepDrawing = drawing.filter(([v]) => v >= 86);   // their row 86: map 215, eleven rows under the coast
  const deepArea = banthaArea({ width: 1000, height: 500, regionAt, races: REGION_RACES, drawing: deepDrawing });
  assert.ok(deepArea[215 * 1000 + 700] === 1 && deepArea[214 * 1000 + 700] === 0, 'a top inland stays where it was drawn');
  assert.deepEqual(areaRows(Uint8Array.from([0, 1, 1, 0, 1, 0, 0, 0, 0]), 3, 3), [[0, 1, 2], [1, 1, 1]]);
});

test('BANTHA2 THE ROWS ARE THE DRAWING\'S on the freeware\'s map: tools/banthaArea.mjs derives BANTHA_AREA_ROWS again row for row; every pixel Hammerfell\'s land or a lake it closes round; nine in ten the Rainforest\'s climate (mutants: the smoothing, the threshold, the coast, the lakes - any law moved)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const rd = (f) => new Uint8Array(readFileSync(join(A, f)));
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const area = banthaArea({ width: 1000, height: 500, regionAt: (x, y) => maps.getRegionIndexAt(x, y), races: REGION_RACES });
  assert.deepEqual(areaRows(area, 1000, 500), BANTHA_AREA_ROWS.map((r) => [...r]), 'the rows are the derivation\'s');
  let rain = 0, n = 0;
  for (const [y, ...runs] of BANTHA_AREA_ROWS) {
    for (let k = 0; k < runs.length; k += 2) {
      for (let x = runs[k]; x <= runs[k + 1]; x++) {
        const r = maps.getRegionIndexAt(x, y);
        assert.ok(r === 31 || REGION_RACES[r] === 1, `(${x}, ${y}): Hammerfell's or a lake`);
        n++; if (maps.getClimateIndex(x, y) === 227) rain++;
      }
    }
  }
  assert.ok(rain / n > 0.9, `the Rainforest's ${(rain / n).toFixed(3)}`);
  assert.ok(readFileSync(join(ROOT, 'tools/jungleExtent.mjs'), 'utf8').includes('banthaAreaHas'), 'the extent tool reads the area');
});
