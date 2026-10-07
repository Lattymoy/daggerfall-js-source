// AUDIT LANDFORMS (2026-10-07, Mac: "Dont worry about it. Instead let's do just an audit and ensure this is perfect")
// - the audit of LANDFORM1-3 (bible/03-World/Landforms.md, the record bible/01-Overview/Audit-Landforms.md). Every
// finding fixed here was reproduced first, on the real WOODS.WLD and on this synthetic world, and each pin below fails
// on the code as it stood.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WoodsFile, MAP_WIDTH } from '../src/formats/woodsFile.js';
import { generateSamples, sampleKernel, HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT } from '../src/world/terrainSampler.js';
import { createLandforms, LANDFORM_DIALS } from '../src/world/landforms.js';
import { generatePixelTerrain } from '../src/world/terrainGen.js';
import { waterCorners, WATER_DRAW_MASK_TABLE } from '../src/world/waterCorners.js';
import { DIR } from '../src/world/roadNetwork.js';
import { syntheticWoodsBytes, network } from './landformWorld.mjs';

const H = HEIGHTMAP_DIMENSION;
const UNIT = MAX_TERRAIN_HEIGHT;
const at = (s, x, y) => s[x * H + y];
const load = (bytes) => { const w = new WoodsFile(); assert.equal(w.load(bytes), true); return w; };
const woods = load(syntheticWoodsBytes());
const NET = network();
const dry = new Uint8Array(NET.roads.length);

test('AUDIT LANDFORMS E2: a channel is the water\'s - a road crossing a river stands on its own bed alone, so the painted water never climbs the road\'s fill out of its floor', () => {
  // the synthetic world's crossing: the road north-south down x = 64 of pixel (300, 255), the river east-west down y = 64
  const px = 300, py = 255;
  const full = generateSamples(woods, px, py, H, createLandforms({ woods, roads: NET }));
  const water = generateSamples(woods, px, py, H, createLandforms({ woods, roads: { ...NET, roads: dry, tracks: dry } }));
  const road = LANDFORM_DIALS.road;
  // on the river's floor and off the road's own bed, the river's channel stands - the road's bank and verge give way
  for (let y = 64 - LANDFORM_DIALS.river.flat; y <= 64 + LANDFORM_DIALS.river.flat; y++) {
    for (const x of [61, 60, 58, 55, 67, 68, 70, 73]) {
      assert.ok(Math.abs(x - 64) > road.flat);
      assert.ok(Object.is(at(full, x, y), at(water, x, y)), `(${x}, ${y}): the channel's floor, not the road's fill (${((at(full, x, y) - at(water, x, y)) * UNIT).toFixed(2)} units over it)`);
    }
  }
  // and the road keeps its own bed across the river: the causeway's top, level at the road's grade
  for (const x of [63, 64, 65]) assert.ok(at(full, x, 64) > at(water, x, 64) + 1 / UNIT, `x=${x}: the causeway stands over the channel`);
  // away from the river the road's bank and verge are whole, as they were
  const roadOnly = generateSamples(woods, px, py, H, createLandforms({ woods, roads: { ...NET, rivers: dry, streams: dry } }));
  for (const x of [60, 58, 55]) assert.ok(Object.is(at(full, x, 20), at(roadOnly, x, 20)), `(${x}, 20): the road's own bank, off the channel`);
  // and past the channel's bank top - in the river's verge - the road's bank is whole again: the channel is the floor and
  // the bank, not the river's whole reach
  for (const y of [58, 70]) for (const x of [61, 67]) assert.ok(Object.is(at(full, x, y), at(roadOnly, x, y)), `(${x}, ${y}): in the river's verge the road's bank stands`);
  // the painted water, as the pipeline paints it: every wet corner off the road's bed stands on the channel's floor
  const out = generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), climateType: 231, roads: NET, landform: true });
  let wet = 0;
  for (let ty = 0; ty < 128; ty++) for (let tx = 0; tx < 128; tx++) {
    const m = waterCorners(out.tilemapBytes[ty * 128 + tx], WATER_DRAW_MASK_TABLE);
    for (let k = 0; k < 4; k++) {
      if (!(m & (1 << k))) continue;
      const x = tx + (k & 1), y = ty + (k >> 1);
      if (Math.abs(x - 64) <= road.flat) continue;   // the corner a water tile shares with the road's bed: the causeway's edge
      wet++;
      assert.ok(Math.abs(out.samples[x * H + y] - at(water, x, y)) * UNIT < 1e-3, `wet corner (${x}, ${y}) on the floor`);
    }
  }
  assert.ok(wet > 200, `the river's water tiles were read (${wet})`);
});

test('AUDIT LANDFORMS E1: a road on a hillside is cut into the high side and filled down to the low side over the same bank - no level shelf the bank\'s whole width', () => {
  // a steep hillside: bytes rising 16 a pixel eastward across pixels (150..156, 400..420), so the land climbs about one
  // kernel unit a sample across a road run north-south down the middle of pixel (153, 410)
  const bytes = syntheticWoodsBytes();
  const hm = new DataView(bytes.buffer).getUint32(28, true);
  for (let y = 396; y <= 424; y++) for (let x = 146; x <= 160; x++) bytes[hm + y * MAP_WIDTH + x] = Math.max(2, Math.min(126, 22 + (x - 150) * 16));
  const hill = load(bytes);
  const net = network();
  for (let y = 400; y <= 420; y++) net.roads[y * MAP_WIDTH + 153] |= DIR.N | DIR.S;
  const px = 153, py = 410;
  const cut = generateSamples(hill, px, py, H, createLandforms({ woods: hill, roads: net }));
  const smooth = sampleKernel(hill, px, py, H, false, createLandforms({ woods: hill }));   // the lifted land, no ground noise
  const road = LANDFORM_DIALS.road, edge = road.flat + road.bank;
  for (const y of [30, 64, 96]) {
    const bed = at(cut, 64, y);
    for (const x of [63, 65]) assert.ok(Math.abs(at(cut, x, y) - bed) * UNIT < 0.02, `y=${y}: level across the painted road`);
    // the low side (west): the bank falls from the bed toward the land, between them - never level with the bed
    for (let d = 2; d < edge; d++) {
      const x = 64 - d, v = at(cut, x, y) * UNIT, b = bed * UNIT, land = smooth(x, y) * UNIT;
      assert.ok(land < b - 1, `y=${y} d=${d}: the land lies below the bed here`);
      assert.ok(v < b - 0.05 && v >= land - 1e-6, `y=${y} d=${d}: the low bank (${v.toFixed(2)}) falls from the bed (${b.toFixed(2)}) toward the land (${land.toFixed(2)})`);
    }
    // the high side (east): cut, between the bed and the land, as before
    for (let d = 2; d < edge; d++) {
      const x = 64 + d, v = at(cut, x, y) * UNIT, b = bed * UNIT, land = smooth(x, y) * UNIT;
      assert.ok(land > b + 1 && v > b + 0.05 && v <= land + 1e-6, `y=${y} d=${d}: the high bank rises from the bed toward the land`);
    }
  }
  // a river keeps its levee: on the same hillside its low bank still stands `drop` over its floor (LANDFORM3)
  const wet = network();
  for (let y = 400; y <= 420; y++) wet.rivers[y * MAP_WIDTH + 153] |= DIR.N | DIR.S;
  const river = generateSamples(hill, px, py, H, createLandforms({ woods: hill, roads: wet }));
  const floor = at(river, 64, 64) * UNIT, rd = LANDFORM_DIALS.river;
  for (const x of [61, 60]) assert.ok(at(river, x, 64) * UNIT > floor + 0.5 * rd.drop, `x=${x}: the river's low bank is a levee over its floor`);
});
