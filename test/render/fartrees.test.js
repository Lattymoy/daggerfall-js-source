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
  BAND_RING, BAND_FADE, TREE_LAYER, TREE_LAYERS, TREES_UNIT, TREE_STRIDE, UPLOAD_SLICE } from '../../src/render/farTrees.js';
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

test('FAR-TREES the band\'s book: the pixels it lacks asked of the worker with each one\'s nature archive and climate type, one ask at a time; each archive\'s Trees read into the atlas once; laid a pixel a step and uploaded a slice a step, swapped in whole; drawn as points by its own program at the pass\'s lens, its rim dithered over the band ring; let go whole (mutant: the ask, the archive, one at a time, the layers, the slices, the swap, the draw, the rim, dispose)', async () => {
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
  assert.deepEqual([...new Set(pics.map((p) => p[0]))].sort(), [503, 504], 'each archive\'s pictures read');
  assert.equal(pics.length, TREE_RECORDS[503].length + TREE_RECORDS[504].length, 'once');
  assert.equal(log.layers.length, pics.length, 'a layer each');
  assert.equal(band.version, 2);
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
    assert.ok(fs.includes('floraLight(uAmbient, uSunColor, ringSun(), uMoonColor, uMoonScale)') && fs.includes('ringHaze(horizonHaze(vDist, uFogStart, uFogEnd, uRimStart, uRimEnd, uHazeHold))'));
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
