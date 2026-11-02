// FAR-TREES (2026-10-26, the owner: "no flora/trees show ... No band aids for any of this"; the coordinator: the billboard
// band, the tree line at the grid's edge gone; bible/06-Systems/Travel-View.md FAR-TREES) - THE BAND: the near trees
// carried a ring past the streamed grid (and into every pixel of it the stream has not built), each pixel's own layout on
// the terrain worker (world/terrain/floraCover.js bandTreesPixel), drawn in the far ring's pass as points of the trees'
// own art, dithered out onto the canopy over the band ring as the canopy comes in under it (render/farTrees.js,
// render/farRing.js). Pinned with no game data, on the landforms' synthetic world (test/landformWorld.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WoodsFile } from '../../src/formats/woodsFile.js';
import { generateSamples, HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { generateTileData, assignTiles } from '../../src/world/terrain/terrainTiles.js';
import { layoutNature, isTreeRecord, TREE_RECORDS } from '../../src/world/terrain/terrainNature.js';
import { bandTreesPixel } from '../../src/world/terrain/floraCover.js';
import { floraSpec } from '../../src/world/terrain/floraCover.js';
import { bandPixels, treeHash, layerPicture, bandInstanceSteps, FarTreesBand, farTreesDisabled, treesFsFor, TREES_FS, TREES_LANE_FS, TREES_VS,
  BAND_RING, BAND_FADE, TREE_LAYER, TREE_LAYERS, TREES_UNIT, TREE_STRIDE, UPLOAD_SLICE, skylineAt, HORIZON_STEPS, GROUND_UNIT, GROUND_SLACK, BAND_REACH, BAND_SIDE } from '../../src/render/farTrees.js';
import { groundHeights, MidRingMesh } from '../../src/render/midRing.js';
import { midRingSide } from '../../src/world/terrain/midRingGrid.js';
import { FarRingRenderer, HORIZON_BUDGET_MS } from '../../src/render/farRing.js';
import { EL_LANE } from '../../src/render/enhancedLighting.js';
import { classicShadowLane } from '../../src/render/classicShadowLane.js';
import { syntheticWoodsBytes } from '../landformWorld.mjs';

const woods = new WoodsFile();
assert.equal(woods.load(syntheticWoodsBytes()), true);

function fakeGl() {
  const log = { draws: [], u4: [], u3: [], u1: [], ufv: [], arrays: [], subs: [], layers: [], deleted: 0, made: 0, programs: [] };
  let n = 0;
  const gl = new Proxy({
    TRIANGLES: 4, POINTS: 0, UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125, ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, FLOAT: 3, UNSIGNED_BYTE: 6, STATIC_DRAW: 7, DYNAMIC_DRAW: 8, TEXTURE0: 33984, TEXTURE_2D_ARRAY: 35866,
    drawingBufferHeight: 400,
    createBuffer: () => { log.made++; return { id: ++n }; }, createVertexArray: () => { log.made++; return { vao: ++n }; }, createTexture: () => { log.made++; return { tex: ++n }; }, createProgram: () => ({ prog: ++n }),
    deleteBuffer: () => { log.deleted++; }, deleteVertexArray: () => { log.deleted++; }, deleteTexture: () => { log.deleted++; }, deleteProgram: () => { log.deleted++; },
    bufferSubData: (t, at, data) => log.subs.push([at, data.byteLength]),
    texSubImage3D: (t, level, x, y, layer) => log.layers.push(layer),
    drawArrays: (mode, first, count) => log.arrays.push([mode, first, count]),
    drawElements: (mode, count) => log.draws.push(count),
    uniform4f: (loc, x, y, z, w) => log.u4.push([loc, x, y, z, w]),
    uniform3f: (loc, x, y, z) => log.u3.push([loc, x, y, z]),
    uniform1i: (loc, x) => log.u1.push([loc, x]),
    uniform1fv: (loc, v) => log.ufv.push([loc, [...v]]),
    getUniformLocation: (p, name) => name,
    getShaderParameter: () => true, getProgramParameter: () => true,
    shaderSource: (sh, src) => log.programs.push(src),
  }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  return { gl, log };
}

test('FAR-TREES the band\'s pixels: the ring past the grid whole and every pixel of the grid the stream has not built, row by row from the north-west (mutant: the ring, the built test, the order)', () => {
  assert.deepEqual([BAND_RING, BAND_FADE], [1, [0.5, 1.45]]);
  const built = new Map();
  for (let y = 8; y <= 12; y++) for (let x = 8; x <= 12; x++) if (!(x === 11 && y === 9)) built.set(`${x},${y}`, {});
  const p = bandPixels(10, 10, 2, built);
  assert.equal(p.length, 7 * 7 - 5 * 5 + 1, 'the ring of 24 and the one hole');
  assert.deepEqual(p.slice(0, 3), [[7, 7], [8, 7], [9, 7]], 'the north-west first, rows south');
  assert.ok(p.some(([x, y]) => x === 11 && y === 9), 'the grid\'s unbuilt pixel');
  assert.ok(!p.some(([x, y]) => x === 10 && y === 10), 'a built one left to the stream');
  assert.ok(p.every(([x, y]) => Math.max(Math.abs(x - 10), Math.abs(y - 10)) <= 3));
  assert.equal(bandPixels(0, 0, 2, null).length, 49, 'nothing built: the grid and the ring');
});

test('FAR-TREES a band pixel\'s trees are the stream\'s own: its kernel, its tiles and the nature\'s layout, its Tree records alone, with the woods\' law and DFU\'s scatter (mutant: the samples, the squares, the law, the filter, the frame)', () => {
  for (const forests of [true, false]) {
    const px = 398, py = 251, archive = 504;
    const got = bandTreesPixel({ woods, px, py, archive, climateType: 300, forests });
    const samples = generateSamples(woods, px, py, HEIGHTMAP_DIMENSION, null);
    const tilemap = new Uint8Array(128 * 128);
    assignTiles(generateTileData(samples, px, py), tilemap, true);
    const flats = layoutNature(samples, tilemap, { mapPixelX: px, mapPixelY: py, rawWorldHeight: woods.getHeightMapValue(px, py), climateType: 300, locationRect: null, forests: forests ? { archive, pois: [], paths: null } : null });
    const want = flats.filter((f) => isTreeRecord(archive, f.record));
    assert.ok(want.length > 100 && want.length < flats.length, `${want.length} Trees of ${flats.length} flats${forests ? '' : ' (DFU)'}`);
    assert.equal(got.length, want.length * 4);
    for (let k = 0; k < want.length; k += 97) {
      assert.deepEqual([...got.subarray(k * 4, k * 4 + 4)], [want[k].x, want[k].y, want[k].z, want[k].record].map(Math.fround), `tree ${k}`);
    }
  }
});

test('FAR-TREES the instances: each tree at its place in the band\'s frame (x east, z north from the base pixel\'s south-west corner), its layer, its dither byte the same every assembly; a record with no layer not drawn; a pixel a step (mutant: the frame\'s signs, the layer, the hash, the stride, the step)', () => {
  assert.equal(TREE_STRIDE, 16);
  const pixels = [
    { px: 11, py: 20, archive: 504, trees: Float32Array.from([1, 2, 3, 12, 4, 5, 6, 13]) },
    { px: 10, py: 19, archive: 504, trees: Float32Array.from([7, 8, 9, 99]) },
  ];
  const it = bandInstanceSteps(pixels, 10, 20, (a, r) => (r === 99 ? undefined : r - 10));
  let steps = 0, r;
  while (!(r = it.next()).done) steps++;
  assert.equal(steps, 2, 'a pixel a step');
  const { data, count } = r.value;
  assert.equal(count, 2, 'the record with no layer left out');
  const f = new Float32Array(data, 0, count * 4), u = new Uint8Array(data);
  const S = TERRAIN_SIZE;
  assert.deepEqual([...f.subarray(0, 3)], [S + 1, 2, 3].map(Math.fround), 'a pixel east: x + its side, z its own');
  assert.deepEqual([...f.subarray(4, 7)], [S + 4, 5, 6].map(Math.fround));
  assert.deepEqual([u[12], u[13], u[28], u[29]], [2, treeHash(11, 20, 0), 3, treeHash(11, 20, 1)]);
  const north = bandInstanceSteps([{ px: 10, py: 19, archive: 504, trees: Float32Array.from([7, 8, 9, 12]) }], 10, 20, () => 0);
  let v; while (!(v = north.next()).done);
  assert.deepEqual([...new Float32Array(v.value.data, 0, 3)], [7, 8, S + 9].map(Math.fround), 'a pixel north: z + its side');
  const hs = Array.from({ length: 4096 }, (_, k) => treeHash(3, 4, k));
  const mean = hs.reduce((a, b) => a + b, 0) / hs.length;
  assert.ok(hs.every((h) => h >= 0 && h < 256) && mean > 118 && mean < 137, `the dither bytes spread (${mean})`);
  assert.notEqual(treeHash(3, 4, 0), treeHash(4, 3, 0));
  assert.deepEqual([treeHash(3, 4, 0), treeHash(3, 4, 1), treeHash(-7, 250, 9)], [129, 36, 152], 'the bytes themselves: an assembly\'s are the last one\'s');
});

test('FAR-TREES a record\'s picture in its layer: scaled to the layer by its larger side, bottom-centred, its rows top-down (a point\'s coordinate runs down) (mutant: the scale, the centring, the bottom, the row order)', () => {
  assert.deepEqual([TREE_LAYER, TREE_LAYERS], [64, 48]);
  // a 2 wide, 4 tall picture: its top row red, the rest green
  const pic = { width: 2, height: 4, data: Uint8Array.from({ length: 32 }, (_, i) => [i < 8 ? 255 : 0, i < 8 ? 0 : 255, 0, 255][i % 4]) };
  const out = layerPicture(pic, 8);
  const at = (i, j) => [...out.subarray((j * 8 + i) * 4, (j * 8 + i) * 4 + 4)];
  assert.deepEqual(at(0, 0), [0, 0, 0, 0], 'left of the picture: clear');
  assert.deepEqual(at(2, 0), [255, 0, 0, 255], 'the top row the picture\'s top');
  assert.deepEqual(at(3, 1), [255, 0, 0, 255]);
  assert.deepEqual(at(2, 7), [0, 255, 0, 255], 'its foot on the layer\'s bottom');
  assert.deepEqual(at(5, 4), [0, 255, 0, 255]);
  assert.deepEqual(at(6, 4), [0, 0, 0, 0], 'right of it: clear');
  // a wide one: its width the layer's, standing on its bottom
  const wide = layerPicture({ width: 4, height: 2, data: new Uint8Array(32).fill(200) }, 8);
  assert.deepEqual([wide[(3 * 8) * 4 + 3], wide[(4 * 8) * 4 + 3], wide[(7 * 8 + 7) * 4 + 3]], [0, 200, 200]);
});

test('FAR-TREES the band\'s book: the pixels it lacks asked of the worker with each one\'s nature archive and climate type, one ask at a time; each Tree a wanted pixel\'s tree is read into the atlas once; laid a pixel a step and uploaded a slice a step, swapped in whole; drawn as points by its own program at the pass\'s lens, its rim dithered over the band ring; let go whole (mutant: the ask, the archive, one at a time, the layers, the slices, the swap, the draw, the rim, dispose)', async () => {
  const { gl, log } = fakeGl();
  const asks = [];
  let answer = null;
  const source = { floraBand: (job) => { asks.push(job); return new Promise((r) => { answer = r; }); } };
  const pics = [];
  const read = () => ({ picture: async (a, r) => { pics.push([a, r]); return { width: 2, height: 4, data: new Uint8Array(32).fill(255) }; }, size: async (a, r) => ({ w: 2 * r, h: r }) });   // wider than tall: the side the larger
  const band = new FarTreesBand(gl, { source, read });
  const work = [];
  const climateOf = (x) => (x < 100 ? 231 : 224);   // the woodlands west, the desert east
  const built = new Map([['100,100', {}]]);
  band.frame({ curX: 100, curY: 100, radius: 0, built, climateOf, forests: true, landform: false, work });
  assert.equal(asks.length, 1);
  const px = [...asks[0].pixels];
  assert.equal(px.length, 8 * 4, 'the ring of eight round a built pixel');
  assert.deepEqual(px.slice(0, 4), [99, 99, 504, 300], 'the woodlands\' summer archive and their climate type (Temperate)');
  assert.deepEqual(px.slice(8, 12), [101, 99, 503, 0], 'the desert\'s');
  assert.deepEqual([asks[0].forests, asks[0].landform], [true, false]);
  band.frame({ curX: 100, curY: 100, radius: 0, built, climateOf, forests: true, landform: false, work });
  assert.equal(asks.length, 1, 'one ask at a time');
  answer(Array.from({ length: 8 }, (_, k) => Float32Array.from([k, 1, 2, 12, k, 1, 3, 5])));   // record 12 a Tree of both archives; 5 the desert's alone
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(band.kept.size, 8);
  band.frame({ curX: 100, curY: 100, radius: 0, built, climateOf, forests: true, landform: false, work });
  assert.equal(work.length, 0, 'not laid while its art is being read');
  await new Promise((r) => setTimeout(r, 10));
  // PIN MOVED (TESA-LANDS, AUDIT - the atlas's layers lent): a Tree's picture read where a wanted pixel's tree is of it,
  // not every Tree of its archive (60 of the Bay's eight overran the atlas's 48 on a journey)
  assert.deepEqual(pics.map(String).sort(), ['503,12', '503,5', '504,12'], 'the Trees the pixels\' trees are - 504:5 no Tree of the woodlands\'');
  assert.equal(log.layers.length, pics.length, 'a layer each');
  assert.equal(band.version, 3);
  band.frame({ curX: 100, curY: 100, radius: 0, built, climateOf, forests: true, landform: false, work });
  assert.equal(work.length, 1, 'laid once its art is in');
  let steps = 0;
  while (work.length) { const w = work[0], r = w.it.next(); steps++; if (r.done) { work.shift(); w.done(r.value); } }
  assert.equal(steps, 8 + 1 + 1, 'a pixel a step, a slice a step, the swap');
  assert.equal(band.count, 8 + 5, 'every tree its archive\'s layer: the woodlands\' three pixels draw no record 5');
  assert.deepEqual(log.subs, [[0, 13 * TREE_STRIDE]]);
  assert.ok(UPLOAD_SLICE >= 256 * 1024);
  // drawn: its program, the pass's lens, the rim over the band ring past the grid's radius, its atlas on its unit
  band.draw({ proj: Float32Array.from({ length: 16 }, (_, k) => (k === 5 ? 1.7 : 0)), view: new Float32Array(16), origin: [10, 0, 20], radius: 5, viewportH: 400, hazeFrom: new Float32Array(4),
    ambient: [0, 0, 0], sunScale: 1, sunColor: [1, 1, 1], moonScale: 0, moonColor: [1, 1, 1], fogColor: [0, 0, 0], fogStart: 0, fogEnd: 1, rimStart: 1, rimEnd: 2, hold: 0.85,
    haze: new Float32Array(8), hazeEye: [0, 1, 0], cloudFar: 1, cloudRect: new Float32Array(4), cloudUnit: 15, exposure: 1 });
  assert.deepEqual(log.arrays, [[0, 0, 13]], 'one draw of points');
  assert.deepEqual(log.u4.find((u) => u[0] === 'uBand'), ['uBand', (5 + BAND_FADE[0]) * TERRAIN_SIZE, (5 + BAND_FADE[1]) * TERRAIN_SIZE, 400, Math.fround(1.7)]);
  assert.deepEqual(log.u3.find((u) => u[0] === 'uBandFrom'), ['uBandFrom', 10 + TERRAIN_SIZE / 2, 0, 20 + TERRAIN_SIZE / 2], 'the base pixel\'s centre');
  assert.deepEqual(log.u1.find((u) => u[0] === 'uTrees'), ['uTrees', TREES_UNIT]);
  const sides = log.ufv.find((u) => u[0] === 'uSides')[1];
  for (const [key, layer] of band.layers) assert.equal(sides[layer], 2 * Number(key.split(',')[1]), `${key}: its billboard's larger side`);
  // the traveller moves a pixel: the set asked again, only the pixels it lacks
  band.frame({ curX: 101, curY: 100, radius: 0, built: new Map([['101,100', {}]]), climateOf, forests: true, landform: false, work });
  assert.equal(asks.length, 2);
  assert.equal(asks[1].pixels.length / 4, 9 - 1 - 4, 'the new ring less the five kept and the built');
  const freed = log.deleted;
  band.dispose();
  assert.ok(log.deleted >= freed + 4, 'the buffer, its array, the atlas, the program');
  assert.equal(band.count, 0);
  // no worker: none asked twice, nothing drawn
  const lone = new FarTreesBand(fakeGl().gl, { source: { floraBand: () => Promise.resolve(null) }, read });
  const w2 = [];
  lone.frame({ curX: 0, curY: 0, radius: 1, built: null, climateOf, forests: true, landform: false, work: w2 });
  await new Promise((r) => setTimeout(r, 0));
  lone.frame({ curX: 0, curY: 0, radius: 1, built: null, climateOf, forests: true, landform: false, work: w2 });
  assert.equal(lone.count, 0);
  assert.equal(lone._asking, false);
  assert.equal(farTreesDisabled('?world&fartrees=off'), true);
  assert.equal(farTreesDisabled('?world'), false);
});

test('FAR-TREES THE ATLAS LENDS ITS LAYERS (TESA-LANDS, AUDIT): full, it lends the layer of a picture no wanted pixel, drawn set or set being laid is of - never one they are; a picture it turned away is asked again once the drawn set moves, and the band then draws it (mutants: a drawn set\'s layer lent; the turned-away never asked again)', async () => {
  const { gl } = fakeGl();
  let answer = null;
  const source = { floraBand: () => new Promise((r) => { answer = r; }) };
  const read = () => ({ picture: async () => ({ width: 2, height: 4, data: new Uint8Array(32).fill(255) }), size: async () => ({ w: 1, h: 2 }) });
  const band = new FarTreesBand(gl, { source, read });
  const trees = Object.entries(TREE_RECORDS).flatMap(([a, rs]) => rs.map((r) => Number(a) * 256 + r));   // every Tree of the Bay's: more than the atlas holds
  assert.ok(trees.length > TREE_LAYERS);
  const settle = async (x, built, codes) => {
    const work = [];
    for (let round = 0; round < 8; round++) {
      band.frame({ curX: x, curY: 100, radius: 0, built, climateOf: () => 231, forests: true, landform: false, work });
      if (answer) { const a = answer; answer = null; a(Array.from({ length: 8 }, (_, k) => Float32Array.from(codes.slice(k * 6, k * 6 + 6).flatMap((c, i) => [i, 1, k, c])))); }
      await new Promise((r) => setTimeout(r, 5));
      while (work.length) { const w = work[0], r = w.it.next(); if (r.done) { work.shift(); w.done(r.value); } }
    }
  };
  const first = trees.slice(0, TREE_LAYERS), then = trees.slice(TREE_LAYERS);
  await settle(100, new Map([['100,100', {}]]), first);
  assert.equal(band.layers.size, TREE_LAYERS, 'full');
  assert.equal(band.count, TREE_LAYERS, 'every tree drawn');
  // the traveller three pixels on: a new ring, its Trees the rest - the drawn set's layers kept until it is swapped out
  const w0 = [];
  band.frame({ curX: 103, curY: 100, radius: 0, built: new Map([['103,100', {}]]), climateOf: () => 231, forests: true, landform: false, work: w0 });
  answer(Array.from({ length: 8 }, (_, k) => Float32Array.from(then.slice(k * 2, k * 2 + 2).flatMap((c, i) => [i, 1, k, c]))));
  answer = null;
  await new Promise((r) => setTimeout(r, 5));
  band.frame({ curX: 103, curY: 100, radius: 0, built: new Map([['103,100', {}]]), climateOf: () => 231, forests: true, landform: false, work: w0 });
  await new Promise((r) => setTimeout(r, 5));
  const key = (c) => `${Math.floor(c / 256)},${c % 256}`;
  assert.ok(first.every((c) => band.layers.has(key(c))), 'no layer of the drawn set lent');
  assert.ok(then.every((c) => band.arts.get(key(c)) === 'full'), 'the new ones turned away while it is drawn');
  await settle(103, new Map([['103,100', {}]]), then);
  assert.ok(then.every((c) => band.layers.has(key(c))), 'asked again once the drawn set moved: lent the old ones\' layers');
  assert.ok(band.layers.size <= TREE_LAYERS && new Set(band.layers.values()).size === band.layers.size, 'a layer a picture');
  assert.equal(band.count, then.length, 'and drawn');
  band.dispose();
});

test('FAR-TREES A SET PAST THE ATLAS IS LAID ONCE, AND HOLDS WHAT LANDS UNDER IT (TESA-LANDS\' second audit, lane D): a wanted set of more pictures than the atlas holds draws the 48 it can and is not laid again - its turned-away pictures had been asked again at every swap, turned away again and the set laid again, for ever; and a picture that lands while a set is laid is held by that set, so no ask after lends its layer from under its drawing (mutants: the turned-away asked whatever; the late picture unheld)', async () => {
  const { gl } = fakeGl();
  let answer = null;
  const source = { floraBand: () => new Promise((r) => { answer = r; }) };
  const read = () => ({ picture: async () => ({ width: 2, height: 4, data: new Uint8Array(32).fill(255) }), size: async () => ({ w: 1, h: 2 }) });
  const band = new FarTreesBand(gl, { source, read });
  const trees = Object.entries(TREE_RECORDS).flatMap(([a, rs]) => rs.map((r) => Number(a) * 256 + r));
  assert.ok(trees.length > TREE_LAYERS);
  let swaps = 0;
  const swap = band._swap.bind(band);
  band._swap = (...a) => { swaps++; return swap(...a); };
  const round = async (work) => {
    band.frame({ curX: 100, curY: 100, radius: 0, built: new Map([['100,100', {}]]), climateOf: () => 231, forests: true, landform: false, work });
    if (answer) { const a = answer; answer = null; const per = Math.ceil(trees.length / 8); a(Array.from({ length: 8 }, (_, k) => Float32Array.from(trees.slice(k * per, k * per + per).flatMap((c, i) => [i, 1, k, c])))); }
    await new Promise((r) => setTimeout(r, 5));
    while (work.length) { const w = work[0], r = w.it.next(); if (r.done) { work.shift(); w.done(r.value); } }
  };
  const work = [];
  for (let i = 0; i < 10; i++) await round(work);
  assert.equal(band.layers.size, TREE_LAYERS); assert.equal(band.count, TREE_LAYERS, 'the 48 it can');
  const settled = swaps;
  for (let i = 0; i < 10; i++) await round(work);
  assert.equal(swaps, settled, `laid once, not again (${swaps - settled} more swaps)`);
  band.dispose();
  // a picture that lands mid-lay: held by the set being laid, and by the drawn set once it is swapped in
  const b2 = new FarTreesBand(fakeGl().gl, { source, read });
  b2._want = [[0, 0], [1, 0]];
  b2.kept.set('0,0', { px: 0, py: 0, archive: 504, trees: Float32Array.from([0, 1, 0, 504 * 256 + 12]), arts: ['504,12'] });
  b2.kept.set('1,0', { px: 1, py: 0, archive: 504, trees: Float32Array.from([0, 1, 0, 504 * 256 + 13]), arts: ['504,13'] });
  b2.layers.set('504,12', 0);
  const w2 = [];
  b2._lay(w2, 0, 0);
  const it = w2[0].it;
  it.next(); it.next();   // the first pixel laid
  b2.layers.set('504,13', 1);   // its picture lands while the set is laid
  assert.ok(b2._layingArts.has('504,12') && !b2._layingArts.has('504,13'));
  let r = it.next();
  while (!r.done) r = it.next();
  assert.ok(b2._layingArts.has('504,13'), 'held by the set it landed under');
  w2[0].done(r.value);
  assert.ok(b2._drawnArts.has('504,13') && b2.count === 2, 'and by the drawn set');
  b2.dispose();
  // a full atlas lends no layer of a set being laid, though the wanted set has moved on before its pixels are laid
  const b3 = new FarTreesBand(fakeGl().gl, { source, read });
  const arts = Array.from({ length: TREE_LAYERS }, (_, k) => `${500 + (k % 11)},${k}`);
  arts.forEach((a, k) => b3.layers.set(a, k));
  b3._want = [[0, 0]];
  b3.kept.set('0,0', { px: 0, py: 0, archive: 504, trees: new Float32Array(0), arts });
  b3._lay([], 0, 0);
  b3._wanted.clear(); b3._drawnArts = new Set();   // the traveller moved on: nothing wanted holds them now
  assert.equal(b3._layerFor(), -1, 'every layer the laid set\'s');
  b3.dispose();
});

test('FAR-TREES the worker\'s band: each pixel its own trees, kept by the pixel and answered as copies, transferred; the client asks BAND_PIXELS_AN_ASK pixels an ask and answers them in order; none with no worker (mutant: the kept key, the copy, the transfer, the chunk, the order)', async () => {
  const posted = [];
  const was = { on: globalThis.onmessage, post: globalThis.postMessage };
  globalThis.postMessage = (m, t) => posted.push({ m: structuredClone(m, { transfer: t }), t });   // a worker's own: the transferred detached here
  try {
    await import('../../src/world/terrain/terrainGenWorker.js');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: syntheticWoodsBytes() } });
    const pixels = Int32Array.from([398, 251, 504, 300, 399, 251, 504, 300]);
    globalThis.onmessage({ data: { t: 'floraband', id: 7, pixels, forests: true, landform: false } });
    const a = posted.at(-1);
    assert.equal(a.m.t, 'band');
    assert.equal(a.m.id, 7);
    assert.deepEqual([...a.m.trees[1]], [...bandTreesPixel({ woods, px: 399, py: 251, archive: 504, climateType: 300, forests: true })]);
    assert.ok(a.t.length === 2 && a.t.every((b) => b.byteLength === 0), 'transferred');
    globalThis.onmessage({ data: { t: 'floraband', id: 8, pixels, forests: true, landform: false } });
    const b = posted.at(-1);
    assert.deepEqual([...b.m.trees[0]], [...a.m.trees[0]], 'kept, answered again whole (a copy: the first went with its transfer)');
    globalThis.onmessage({ data: { t: 'floraband', id: 9, pixels: Int32Array.from([398, 251, 504, 300]), forests: false, landform: false } });
    assert.notDeepEqual([...posted.at(-1).m.trees[0]], [...a.m.trees[0]], 'DFU\'s scatter kept apart from the woods\'');
  } finally { globalThis.onmessage = was.on; globalThis.postMessage = was.post; }
  const { TerrainGenClient, BAND_PIXELS_AN_ASK } = await import('../../src/world/terrain/terrainGenClient.js');
  assert.equal(BAND_PIXELS_AN_ASK, 4);
  const client = new TerrainGenClient({ woods, woodsBytes: null });
  assert.equal(await client.floraBand({ pixels: new Int32Array(8), forests: true, landform: false }), null, 'no worker');
  const sent = [];
  client._worker = { postMessage: (m) => sent.push(m) };
  const got = client.floraBand({ pixels: Int32Array.from({ length: 6 * 4 }, (_, k) => k), forests: true, landform: true });
  for (let k = 0; k < 5 && k < sent.length; k++) {
    const m = sent[k];
    client._midAnswer({ t: 'band', id: m.id, trees: Array.from({ length: m.pixels.length / 4 }, (_, i) => Float32Array.of(m.pixels[i * 4])) });
    await new Promise((r) => setTimeout(r, 0));
  }
  const trees = await got;
  assert.deepEqual(sent.map((m) => m.pixels.length / 4), [4, 2]);
  assert.deepEqual(trees.map((t) => t[0]), [0, 4, 8, 12, 16, 20], 'each pixel\'s, in order');
  assert.deepEqual([sent[0].forests, sent[0].landform, sent[0].t], [true, true, 'floraband']);
});

test('FAR-TREES the programs: a tree a point the side of its billboard at the pass\'s lens, on its foot, a sub-pixel one drawn by its share of a pixel, the band\'s rim dithered; cut out at the flats\' 0.5, lit as a flat is, hazed as the ring is - the lane\'s through its tonemap, the classic-shadow lane\'s look (mutant: the foot, the size, the share, the rim, the cutout, the light, the lanes)', () => {
  assert.ok(TREES_VS.includes('vec3 world = aPos + uOrigin + vec3(0.0, 0.5 * side, 0.0);'));
  assert.ok(TREES_VS.includes('float px = side * uBand.w * uBand.z * 0.5 / max(gl_Position.w, 1.0);'));
  assert.ok(TREES_VS.includes('float keep = min(px * px, 1.0) * (1.0 - smoothstep(uBand.x, uBand.y, max(d.x, d.y)));'));
  assert.ok(TREES_VS.includes('if ((aMeta.y + 0.5) / 256.0 > keep) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);'));
  assert.ok(TREES_VS.includes('gl_PointSize = clamp(px, 1.0, 64.0);'));
  for (const fs of [TREES_FS, TREES_LANE_FS]) {
    assert.ok(fs.includes('vec4 tex = texture(uTrees, vec3(gl_PointCoord, vLayer));') && fs.includes('if (tex.a < 0.5) discard;'));
    assert.ok(fs.includes('floraLight(uAmbient, uSunColor, ringSun(), uMoonColor, uMoonScale)') && fs.includes('ringHaze(horizonHazeOf(uFogLaw, vDist, uFogStart, uFogEnd, uRimStart, uRimEnd, uHazeHold))'));   // PIN MOVED (AUDIT FB1031 L2): a weather's own law
  }
  assert.ok(TREES_LANE_FS.includes('vec3 lit = elDecode(tex.rgb) * (') && TREES_LANE_FS.includes('elEncode(elTonemapRGB(lit * uELExposure * elAdapt()))'));
  assert.equal(treesFsFor(null), TREES_FS);
  assert.equal(treesFsFor(EL_LANE), TREES_LANE_FS);
  assert.notEqual(treesFsFor(classicShadowLane()), TREES_LANE_FS, 'the classic-shadow lane\'s look over the lane\'s');
});

test('FAR-TREES in the far ring: the band made with the woods and a worker, its turn taken only while the woods stand (the knob), drawn last in the pass; the canopy laid back over the ground under it by the same rim from the band\'s base (mutant: the band\'s gate, its turn\'s knob, the canopy\'s rim, its base, the door)', async () => {
  const { gl, log } = fakeGl();
  const book = { version: 1, forests: true, floraOf: () => ({ spec: floraSpec(504, false, true), art: { rgb: [60, 70, 40], h: 10, w: 6 }, ground: null }) };
  const asks = [];
  const mid = { midRing: () => new Promise(() => {}), farField: () => new Promise(() => {}), floraBand: (job) => { asks.push(job); return Promise.resolve(Array.from({ length: job.pixels.length / 4 }, () => Float32Array.from([1, 2, 3, 12]))); } };
  const ring = new FarRingRenderer(gl, { mid, flora: book });
  ring._band.read = () => ({ picture: async () => ({ width: 2, height: 4, data: new Uint8Array(32).fill(255) }), size: async () => ({ w: 6, h: 10 }) });
  ring._now = (() => { let t = 0; return () => (t += HORIZON_BUDGET_MS); })();
  const W = 200, inputs = { heightBytes: new Uint8Array(W * W).fill(40), mapWidth: W, mapHeight: W, climateAt: () => 231, baseX: 100, baseY: 100, relief: false };
  ring.build(inputs, 100, 100, 3, null);
  assert.equal(asks.length, 0, 'Low (Land View 3): no band');
  ring.punchHole(100, 100, 4, null);
  assert.equal(asks.length, 1, 'Land View 4: asked');
  assert.equal(asks[0].pixels.length / 4, 11 * 11, 'nothing built: the grid and its ring');
  for (let k = 0; k < 400 && !ring._band.count; k++) { await new Promise((r) => setTimeout(r, 0)); ring.punchHole(100, 100, 4, null); }
  assert.equal(ring._band.count, 121);
  assert.equal(ring.horizonStats().trees, 121);
  log.arrays.length = 0; log.u4.length = 0; log.u3.length = 0;
  ring.draw(new Float32Array(16), { origin: [10, 0, 20], lightDir: [0, 1, 0], ambient: [0, 0, 0], sunScale: 1, sunColor: [1, 1, 1], fogColor: [0, 0, 0], fogEnd: 1, fovY: 1, aspect: 1 });
  assert.equal(log.arrays.length, 1, 'the band drawn');
  assert.deepEqual(log.u4.find((u) => u[0] === 'uCanopyBand'), ['uCanopyBand', (4 + BAND_FADE[0]) * TERRAIN_SIZE, (4 + BAND_FADE[1]) * TERRAIN_SIZE, 1, 0], 'the canopy over the band\'s rim');
  assert.deepEqual(log.u3.find((u) => u[0] === 'uCanopyFrom'), ['uCanopyFrom', 10 + 0.5 * TERRAIN_SIZE, 0, 20 + 0.5 * TERRAIN_SIZE], 'from the band\'s base pixel\'s centre');
  assert.deepEqual(log.u3.find((u) => u[0] === 'uBandFrom'), ['uBandFrom', 10 + 0.5 * TERRAIN_SIZE, 0, 20 + 0.5 * TERRAIN_SIZE], 'the band\'s rim from the same');
  ring.punchHole(100, 100, 3, null);   // the knob turned down
  log.arrays.length = 0;
  ring.draw(new Float32Array(16), { origin: [10, 0, 20], lightDir: [0, 1, 0], ambient: [0, 0, 0], sunScale: 1, sunColor: [1, 1, 1], fogColor: [0, 0, 0], fogEnd: 1, fovY: 1, aspect: 1 });
  assert.equal(log.arrays.length, 0, 'Low: not drawn');
  ring.dispose();
  assert.equal(ring._band, null);
  assert.equal(new FarRingRenderer(fakeGl().gl, { mid, flora: null })._band, null, 'no woods: no band');
  assert.equal(new FarRingRenderer(fakeGl().gl, { flora: book })._band, null, 'no worker: no band');
});

// HORIZON-TREES (2026-10-27; KPbICA through the owner: "Strange projections above the horizon line"; bible/03-World/Tamriel.md
// RELIEF-PEAKS Cause 7): the band is drawn last in a pass with no depth among its layers, so a band tree behind a nearer
// hill of the middle ring stood over the hill's skyline. Its sight line is marched over the middle ring's own heights.
const ridge = (side, cell, x0, z0, at, h) => {   // a flat ground at 100 m and a ridge `h` high along the row z = at
  const heights = new Float32Array(side * side).fill(100);
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) if (Math.abs(z0 + j * cell - at) < cell / 2) heights[j * side + i] = 100 + h;
  return { heights, side, cell, x0, z0 };
};

test('HORIZON-TREES the skyline at a tree: the highest line the nearer ground lifts at its foot, read at HORIZON_STEPS - 1 points between the eye and the foot, bilinearly between the ring\'s vertices; a pixel the stream has built left to the depth, a point past the ring not read; the ground over the line by GROUND_SLACK before it cuts (mutant: the march, the lift, the built skip, the ring\'s edge, the slack)', () => {
  const g = ridge(41, 100, -2000, -2000, 0, 60);   // a ridge 60 m high across the line, halfway
  const eye = [0, 120, -1000], foot = [0, 100, 1000];
  // the line from the eye over the ridge's crest (z 0, 160 m less the slack) to the tree 2 km on: 120 + 2 * (160 - 1.5 - 120)
  const sky = skylineAt(eye, foot, g);
  assert.ok(Math.abs(sky - (120 + 2 * (160 - GROUND_SLACK - 120))) < 1e-3, `the ridge lifts the line at the tree: ${sky}`);
  assert.ok(sky - foot[1] > 12, 'a 12 m tree behind it whole');
  assert.equal(skylineAt([0, 400, -1000], foot, g) < foot[1], true, 'from 400 m up the ridge hides none of it');
  assert.equal(skylineAt(eye, foot, ridge(41, 100, -2000, -2000, 0, 0)) < foot[1], true, 'a flat ground hides nothing');
  assert.ok(skylineAt(eye, foot, g, (x, z) => Math.abs(z) < 200) < foot[1], 'the ridge in a built pixel: the depth\'s, not the march\'s');
  assert.equal(skylineAt(eye, foot, g, () => true), -1e9, 'every pixel built: nothing read');
  assert.equal(skylineAt(eye, foot, { ...g, x0: 5000 }), -1e9, 'past the ring: not read');
  assert.equal(skylineAt(eye, foot, null), -1e9, 'no middle ring: no skyline');
  assert.ok(skylineAt(eye, foot, ridge(41, 100, -2000, -2000, 0, 10 + GROUND_SLACK)) <= foot[1] + 1e-9, 'a crest on the eye\'s line to the foot by the slack (110 m halfway, 120 to 100) does not cut it');
  assert.ok(skylineAt(eye, foot, ridge(41, 100, -2000, -2000, 0, 11 + GROUND_SLACK)) > foot[1] + 1, 'a metre over it does');
  // bilinear between the vertices: a ridge vertex row read half a cell off stands half its height
  const half = skylineAt([0, 100, -1000], [0, 100, 1000], { ...g, z0: -2050 });
  assert.ok(half > 100 && half < 100 + 2 * (60 - GROUND_SLACK), 'read between its vertices');
  assert.ok(skylineAt(eye, foot, ridge(41, 100, -2000, -2000, 0, 11)) < foot[1], 'a crest a metre over the line - under the slack: the drawn triangles against the bilinear - does not cut it');
  assert.equal(HORIZON_STEPS, 24);
  assert.equal(GROUND_SLACK, 1.5);
});

test('HORIZON-TREES the programs: the vertex program marches the same law over the ring\'s heights (GROUND_UNIT, filtered), skips the built slots as FLORA-GROUND\'s test reads them, takes the eye from the view, hands the share of the tree the ground hides, and stands down a tree hidden whole; both fragment programs draw above the skyline alone (mutant: the march\'s steps, the lift, the built skip, the eye, the share, the whole tree, the cut)', () => {
  assert.ok(TREES_VS.includes(`for (int k = 1; k < ${HORIZON_STEPS}; k++) {`) && TREES_VS.includes(`float t = float(k) / ${HORIZON_STEPS.toFixed(1)};`));
  assert.ok(TREES_VS.includes(`float h = textureLod(uGround, (g + 0.5) / uGroundAt.w, 0.0).r - ${GROUND_SLACK.toFixed(1)};`));
  assert.ok(TREES_VS.includes('cut = max(cut, eye.y + (h - eye.y) / t);'));
  assert.ok(TREES_VS.includes('if (builtAt(p)) continue;') && TREES_VS.includes(`ivec2 s = ivec2(floor((xz - uOrigin.xz) / ${TERRAIN_SIZE.toFixed(1)})) + ${BAND_REACH};`) && TREES_VS.includes(`int k = s.y * ${BAND_SIDE} + s.x;`));
  assert.ok(TREES_VS.includes('vec3 eye = -(transpose(mat3(uView)) * uView[3].xyz);'));
  assert.ok(TREES_VS.includes('vCut = (skyline(eye, aPos + uOrigin) - (aPos.y + uOrigin.y)) / max(side, 1.0e-3);'));
  assert.ok(TREES_VS.includes('if (vCut >= 1.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);'));
  for (const fs of [TREES_FS, TREES_LANE_FS, treesFsFor(classicShadowLane())]) assert.ok(fs.includes('if (1.0 - gl_PointCoord.y < vCut) discard;'));
});

test('HORIZON-TREES the band\'s ground: the ring\'s heights a half float a vertex on GROUND_UNIT, uploaded when the ring hands new ones and never again for the same, filtered; its place handed as uGroundAt; none, uGroundAt\'s side 0; let go with the band. The far ring hands its middle ring\'s heights, their corner in the band\'s frame; the ring\'s heights are its vertices\' (mutant: the upload\'s once, the format, the filter, the place, none, the corner, the heights)', () => {
  const calls = [];
  const gl = new Proxy({ TEXTURE0: 33984, TEXTURE_2D: 3553, R16F: 33325, RED: 6403, FLOAT: 5126, LINEAR: 9729 }, {
    get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); return k === 'createTexture' ? { tex: 1 } : undefined; }),
  });
  const band = Object.create(FarTreesBand.prototype);
  Object.assign(band, { gl, groundTex: null, _groundOf: null });
  const heights = new Float32Array(9).fill(5), ground = { heights, side: 3, cell: 100, x0: -150, z0: -250 };
  assert.equal(band._ground(ground), ground);
  const up = calls.filter((c) => c[0] === 'texImage2D');
  assert.deepEqual(up.map((c) => c.slice(1, 9)), [[3553, 0, 33325, 3, 3, 0, 6403, 5126]], 'a half float a vertex');
  assert.equal(up[0][9], heights);
  assert.deepEqual(calls.filter((c) => c[0] === 'activeTexture')[0], ['activeTexture', 33984 + GROUND_UNIT]);
  assert.ok(calls.some((c) => c[0] === 'texParameteri' && c[3] === 9729), 'filtered');
  band._ground(ground);
  assert.equal(calls.filter((c) => c[0] === 'texImage2D').length, 1, 'the same heights: not again');
  band._ground({ ...ground, heights: new Float32Array(9) });
  assert.equal(calls.filter((c) => c[0] === 'texImage2D').length, 2, 'new heights: again');
  assert.equal(band._ground(null), null);
  assert.equal(band._ground({ side: 3 }), null, 'no heights: none');
  // the far ring's hand-off
  const ring = Object.create(FarRingRenderer.prototype);
  Object.assign(ring, { baseX: 100, baseY: 200, _mid: { built: true, heights, baseX: 103, baseY: 198, radius: 14, sub: 8 } });
  const g = ring._bandGround([10, 0, 20]), cell = TERRAIN_SIZE / 8;
  assert.equal(g.heights, heights);
  assert.equal(g.side, midRingSide(14, 8));
  assert.equal(g.cell, cell);
  assert.ok(Math.abs(g.x0 - (10 + 3 * TERRAIN_SIZE - 14 * 8 * cell)) < 1e-9 && Math.abs(g.z0 - (20 + 2 * TERRAIN_SIZE - 14 * 8 * cell)) < 1e-9, 'its corner: the far ring\'s origin moved by the bases\' pixels (z north), less the ring\'s radius');
  ring._mid = { built: false, heights, baseX: 103, baseY: 198, radius: 14, sub: 8 };
  assert.equal(ring._bandGround([0, 0, 0]), null, 'no middle ring: none');
  assert.deepEqual([...groundHeights(Float32Array.from([1, 2, 3, 4, 5, 6]))], [2, 5], 'a vertex\'s y');
  assert.ok(FarRingRenderer.prototype._drawBand.toString().includes('ground: this._bandGround(origin),'), 'the far ring hands them to the band\'s draw');
  assert.ok(MidRingMesh.prototype.build.toString().includes('this.heights = groundHeights(v.positions);'), 'the middle ring keeps the heights it draws');
});
