// CYRODIIL'S RIVERS AS A SETTLEMENT'S WATER. Past the Bay the landforms carve rivers and lakes into the land
// (world/tamriel/tamrielWaters.js); a settlement's layout reads them as water, and its carve never raises one's bed off a
// pad, so a quay meets the channel as it meets the sea. Corrol Ford stands on the White Rose. Pins mutation-checked
// (tools/mutants/rmbc3.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { settlementGroundAt, carveSettlementGround, PAD_CLEAR } from '../../../src/world/settlement/settlementGround.js';
import { sampleEnv, pixelWaters, SAMPLE_M, SEA_M } from '../../../src/world/settlement/settlementStand.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';

const D = HEIGHTMAP_DIMENSION, U = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
const sq = (e0, n0, e1, n1) => [[e0, n0], [e1, n0], [e1, n1], [e0, n1]];
const PADS = [{ id: 'quay', poly: sq(0, 0, 40, 40), y: 0, base: 'cut' }];

test('RIVERS the carve never raises a river\'s bed off a pad: lower land beside the quay left, higher land cut down to it, the pad\'s own ground still its own (mutants: the river unread, read on the pad too)', () => {
  assert.equal(settlementGroundAt(PADS, 100, 20, 45, 95, -Infinity, true), null, 'the channel beside the quay, under the carve: left');
  assert.equal(settlementGroundAt(PADS, 100, 20, 45, 95), 100 - PAD_CLEAR, 'dry, raised as ever');
  assert.equal(settlementGroundAt(PADS, 100, 20, 45, 105, -Infinity, true), 100 - PAD_CLEAR, 'a bank over the carve: cut down');
  assert.equal(settlementGroundAt(PADS, 100, 20, 20, 95, -Infinity, true), 100 - PAD_CLEAR, 'under the pad itself: its ground');
  const S = new Float64Array(D * D).fill(95), wet = (e) => e > 44 && e < 60;
  carveSettlementGround(S, D, SAMPLE_M, { pads: PADS, origin: { east: 0, north: 0 } }, 100, undefined, -Infinity, wet);
  let left = 0, raised = 0;
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) {
    const e = x * SAMPLE_M, n = y * SAMPLE_M, v = S[x * D + y];
    if (n > 40 + 40 || e > 100) continue;
    if (wet(e)) { assert.equal(v, 95, `the bed at ${e}, ${n}`); left++; } else if (v > 95) raised++;
  }
  assert.ok(left >= 20 && raised > 50, `${left} of the channel left, ${raised} dry samples raised`);
});

test('RIVERS a pixel\'s ground reads a river\'s channel as water beside the sea\'s; a pixel no river reaches, or the Bay, reads none (mutants: the river unread by the ground, every pixel wet)', () => {
  const samples = new Float32Array(D * D).fill((SEA_M + 10) / U);
  const plain = sampleEnv(samples), river = sampleEnv(samples, (e) => e > 300 && e < 340);
  assert.equal(plain.waterAt(320, 400), false);
  assert.equal(river.waterAt(320, 400), true, 'in the channel');
  assert.equal(river.waterAt(200, 400), false, 'on its bank');
  const sea = sampleEnv(new Float32Array(D * D).fill(SEA_M / U), () => false);
  assert.equal(sea.waterAt(10, 10), true, 'the sea still the sea');
  assert.equal(pixelWaters(500, 250), null, 'the Bay\'s own pixels: its water is its own');
});

test('RIVERS a published settlement beside a river: its stand hands the channel to its carve, which leaves the bed off its pads; read dry, the carve fills it (mutant: the river unread by the stand\'s carve)', async () => {
  const { standSettlementGround } = await import('../../../src/world/settlement/settlementStand.js');
  const { SETTLEMENT_ROWS, settlementPixel } = await import('../../../src/world/settlement/settlementPlaces.js');
  const { padAt } = await import('../../../src/world/settlement/settlementGeometry.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  setTamrielFit(null);
  const [px, py] = settlementPixel(SETTLEMENT_ROWS[1]), band = (e) => e > 505 && e < 545, samples = new Float32Array(D * D);
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) samples[x * D + y] = (SEA_M + 20 - (band(x * SAMPLE_M) ? 3 : 0)) / U;
  const filled = (wet) => {
    const g = standSettlementGround(px, py, Float32Array.from(samples), () => Float32Array.from(samples), wet);
    let n = 0;
    for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) if (band(x * SAMPLE_M) && g.moved[x * D + y] > 0 && !padAt(g.layout.pads, [x * SAMPLE_M, y * SAMPLE_M])) n++;
    return n;
  };
  assert.ok(filled(null) > 10, `read dry: ${filled(null)} of the channel filled`);
  assert.equal(filled((e) => band(e)), 0, 'read as a river: its bed left');
});

test('RIVERS a town\'s outskirts beside a river: its cells keep off the channel and its carve leaves the bed off its pads; read dry, the carve fills it (mutants: the river unread by the growth\'s ground, by its carve)', async () => {
  const { standTownGrowth } = await import('../../../src/world/settlement/townGrowth.js');
  const { padAt } = await import('../../../src/world/settlement/settlementGeometry.js');
  const { PRINT_GROWTH, printTownRect } = await import('../../../tools/groundPrint.mjs');
  const band = (e) => e > 660 && e < 700, rect = printTownRect(), samples = new Float32Array(D * D);
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) samples[x * D + y] = (SEA_M + 20 - (band(x * SAMPLE_M) ? 3 : 0)) / U;   // a channel 3 m deep past the town's east wall
  const stand = (wet) => {
    const g = standTownGrowth(300, 250, Float32Array.from(samples), PRINT_GROWTH, rect, { paths: null, tilemap: null, camps: [], wet });
    let raisedOff = 0, under = 0;
    for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) {
      const p = [x * SAMPLE_M, y * SAMPLE_M], on = padAt(g.layout.pads, p);
      if (!band(p[0])) continue;
      if (on) under++;
      else if (g.moved[x * D + y] > 0) raisedOff++;
    }
    return { raisedOff, under };
  };
  const dry = stand(null), river = stand((e) => band(e));
  assert.ok(dry.raisedOff > 100 && dry.under > 50, `read dry: ${dry.raisedOff} of the channel filled, ${dry.under} under its pads`);
  assert.equal(river.raisedOff, 0, 'read as a river: none of its bed raised off a pad');
  assert.ok(river.under * 10 < dry.under, `its cells keep off it: ${river.under} under its pads`);
});

test('RIVERS the kernel hands a settlement its pixel\'s rivers where the landforms carve them - the row on, past the Bay - as the paint\'s own water (by source; mutants: handed on the Bay or with the row off, kept from the growth)', () => {
  const gen = readFileSync(new URL('../../../src/world/terrain/terrainGen.js', import.meta.url), 'utf8');
  assert.match(gen, /const wet = landforms && !inBay\(px, py\) \? pixelWaters\(px, py\) : null;/);
  assert.match(gen, /standTownGrowth\(px, py, samples, growth, locationRect, \{ paths, tilemap, camps, wet \}\)/);
  assert.match(gen, /standSettlementGround\(px, py, samples, bare, wet\)/);
  assert.match(gen, /if \(landforms && !inBay\(px, py\)\) paintTamrielWaters\(/, 'the paint\'s own condition');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2, f)));
test('RIVERS on the freeware: Corrol Ford stands on the White Rose - its row toward the channel, its docks out over it, the channel\'s bed never raised by its carve; with the row off, no river and no docks (mutants: the river unread by the stand, its carve)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { groundWoods } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { carvedWatersOn, carvedWaterAt, riverAt, waterAt } = await import('../../../src/world/tamriel/tamrielWaters.js');
  const { SETTLEMENT_ROWS, settlementPixel } = await import('../../../src/world/settlement/settlementPlaces.js');
  const { generatePixelTerrain } = await import('../../../src/world/terrain/terrainGen.js');
  const { CLIMATES } = await import('../../../src/formats/mapsTables.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (test/ui/tamriel4.test.js)
  try {
    const row = SETTLEMENT_ROWS.find((r) => r.name === 'Corrol Ford'), [px, py] = settlementPixel(row);
    assert.equal(row.archetype, 'river');
    assert.equal(row.fix.layout, 'row');
    assert.ok(carvedWatersOn(px, py), 'a river crosses its pixel');
    assert.equal(riverAt(px + row.site.east / TERRAIN_SIZE, py + 1 - row.site.north / TERRAIN_SIZE)?.name, 'White Rose River');
    const w0 = new WoodsFile(); w0.load(bytes('WOODS.WLD'));
    const job = { woods: groundWoods(w0), px, py, stride: 1, climateType: CLIMATES.Woodlands };
    const on = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), landform: true }).settlement;
    assert.ok(on && on.layout.shore, 'its row toward the channel');
    assert.ok(on.layout.docks.length >= 2, `${on.layout.docks.length} docks out over it`);
    for (const dock of on.layout.docks) assert.ok(pixelWaters(px, py)(...dock.path[1]), `${dock.id} ends in the river`);
    let bed = 0;
    for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) {
      if (!carvedWaterAt(px + x / (D - 1), py + 1 - y / (D - 1))) continue;
      assert.ok(on.moved[x * D + y] <= 0, `the bed at ${x}, ${y} never raised`);
      bed++;
    }
    assert.ok(bed > 100, `${bed} of the channel's samples on the pixel`);
    let sea = null;
    for (let y = -600; y < 1800 && !sea; y += 37) for (let x = 1100; x < 3600 && !sea; x += 37) if (waterAt(x + 0.5, y + 0.5)?.kind === 'sea') sea = [x + 0.5, y + 0.5];
    assert.ok(sea && !carvedWaterAt(...sea), `the trace's own water at ${sea} is the ground's, read by its height`);
    const off = generatePixelTerrain({ ...job, tilemap: new Uint8Array(128 * 128), landform: false }).settlement;
    assert.ok(off && !off.layout.shore && off.layout.docks.length === 0, 'the row off: no river carved, no docks');
  } finally {
    setTamrielTrace(null);
    setTamrielFit(null);
  }
});
