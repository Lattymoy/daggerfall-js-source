// FAR-FLORA (2026-10-26, the owner: "on top of distant view, no flora/trees show. Its just a plain green flat texture.
// No band aids for any of this"; bible/06-Systems/Travel-View.md FAR-FLORA) - THE WOODS PAST THE STREAMED GRID: the near
// law's Trees read where the far views stand a vertex (world/terrain/floraCover.js, on the terrain worker for the middle
// ring), drawn as a canopy in the trees' own art over the near ground's own tiles (render/farFlora.js), raised to their
// height and grained into crowns and groves by the far ring's program (render/horizonHaze.js FLORA_GLSL). Pinned with no
// game data, on the landforms' synthetic world (test/landformWorld.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WoodsFile } from '../../src/formats/woodsFile.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE, SCALED_BEACH_ELEVATION } from '../../src/world/terrain/terrainSampler.js';
import { forestAt, FOREST } from '../../src/world/terrain/terrainNature.js';
import { tileDataAt } from '../../src/world/terrain/terrainTiles.js';
import { FLORA, midRingFloraPixel, unpackFlora, treesPerTile, floraSpec, canopyCover, expectedTrees, standsTrees, FLORA_WOOD, FLORA_DIRT, FLORA_GRASS, FLORA_STONE } from '../../src/world/terrain/floraCover.js';
import { buildMidRingHeights, midRingPixel, midRingSide, midRingNormals, MID_RADIUS, MID_REBUILD_DRIFT } from '../../src/world/terrain/midRingGrid.js';
import { midRingVertices, plantCanopy, layGround, MID_FLORA_EASE, MidRingMesh } from '../../src/render/midRing.js';
import { farFieldVertices } from '../../src/render/farField.js';
import { FarRingRenderer, buildFarRingGrid, ringHeight, FLORA_SETTLE_MS, FLORA_WAIT_MAX_MS } from '../../src/render/farRing.js';
import { opaqueMean, treeArt, groundArt, createFloraArt, floraDisabled, FLORA_MIN_LAND_VIEW, GROUND_RECORDS } from '../../src/render/farFlora.js';
import { FLORA_GLSL, FLORA_LIGHT_GLSL, FLORA_CROWN_M, FLORA_GROVE_M } from '../../src/render/horizonHaze.js';
import { capShare, SNOWCAP } from '../../src/world/peaks/snowcap.js';
import { EL_FAR_RING_FS } from '../../src/render/enhancedLighting.js';
import { classicShadowLane } from '../../src/render/classicShadowLane.js';
import { syntheticWoodsBytes } from '../landformWorld.mjs';
import { glslFunctions } from '../glsl.mjs';

const WORLD = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
const woods = new WoodsFile();
assert.equal(woods.load(syntheticWoodsBytes()), true);

const ART = Object.freeze({ rgb: Object.freeze([50, 60, 40]), h: 10, w: 6 });
const GROUND = Object.freeze({ dirt: [200, 0, 0], grass: [0, 200, 0], stone: [0, 0, 200] });
const WOODS_SPEC = floraSpec(504, false, true);

function fakeGl() {
  const log = { draws: [], u3: [], u4: [], attribs: [], buffers: [] };
  let n = 0;
  const gl = new Proxy({
    TRIANGLES: 4, UNSIGNED_SHORT: 5123, UNSIGNED_INT: 5125, ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, FLOAT: 3, UNSIGNED_BYTE: 6, STATIC_DRAW: 7, DYNAMIC_DRAW: 8,
    createBuffer: () => ({ id: ++n }), createVertexArray: () => ({ vao: ++n }),
    bufferData: (target, data) => { log.buffers.push([target, data]); },
    vertexAttribPointer: (loc, size, type, normalized) => log.attribs.push([loc, size, type, normalized]),
    drawElements: (mode, count) => log.draws.push(count),
    uniform3f: (loc, x, y, z) => log.u3.push([loc, x, y, z]),
    uniform4f: (loc, x, y, z, w) => log.u4.push([loc, x, y, z, w]),
    getUniformLocation: (p, name) => name,
    getShaderParameter: () => true, getProgramParameter: () => true,
  }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  return { gl, log };
}

test('FAR-FLORA the near law at a middle-ring sample: the forest field at its world tile, the ground classes tileDataAt lays at four corners about it, none under the beach line or on a face over 50 degrees; packed four bytes (mutant: the tile, the field\'s sign, a corner, the beach, the face, the packing)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(FLORA)), { dfu: { 1: 0.2, 2: 0.9, 3: 0.05 }, desert: 0.25, steep: 50, woodShare: 0.45, grazing: 2.2, lift: 0.7, ground: { 1: 0.054, 2: 0.927, 3: 0.019 } });
  assert.deepEqual([FLORA_WOOD, FLORA_DIRT, FLORA_GRASS, FLORA_STONE], [0, 8, 16, 24]);
  const sub = 8, w = sub + 1, px = 398, py = 251;
  const flat = new Float32Array(w * w).fill(300);   // well over the beach line, level
  const out = midRingFloraPixel(flat, px, py, sub);
  assert.equal(out.length, w * w);
  for (let j = 0; j <= sub; j++) {
    for (let i = 0; i <= sub; i++) {
      const [wood, dirt, grass, stone] = unpackFlora(out[j * w + i]);
      const want = forestAt(px * 128 + Math.min(127, i * 16), -py * 128 + Math.min(127, j * 16));
      assert.equal(Math.round(wood * 255), Math.round(want * 255), `sample ${i},${j}: the field at its own world tile`);
      const n = [0, 0, 0, 0];
      for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) n[tileDataAt(300 / STREAMING_TERRAIN_SCALE, Math.min(128, Math.max(0, i * 16 + dx)), Math.min(128, Math.max(0, j * 16 + dy)), px, py)]++;
      assert.deepEqual([dirt, grass, stone].map((v) => Math.round(v * 4)), [n[1], n[2], n[3]], `sample ${i},${j}: its corners' classes`);
    }
  }
  assert.ok(new Set([...out].map((v) => (v >>> FLORA_WOOD) & 255)).size > 1, 'the field varies across a pixel');
  // under the beach line: no ground grows a tree (natureStandsAt's); the field still read
  const beach = midRingFloraPixel(new Float32Array(w * w).fill((SCALED_BEACH_ELEVATION - 0.5) * STREAMING_TERRAIN_SCALE), px, py, sub);
  assert.ok(beach.every((v) => (v >>> FLORA_DIRT) === 0), 'the beach: none');
  // a face steeper than 50 degrees: none; a ramp just under it: grows
  const ramp = (tan) => Float32Array.from({ length: w * w }, (_, k) => 300 + (k % w) * (TERRAIN_SIZE / sub) * tan);
  const centre = (a) => a[4 * w + 4] >>> FLORA_DIRT;
  assert.equal(centre(midRingFloraPixel(ramp(Math.tan((51 * Math.PI) / 180)), px, py, sub)), 0, 'a face over the law');
  assert.ok(centre(midRingFloraPixel(ramp(Math.tan((49 * Math.PI) / 180)), px, py, sub)) > 0, 'a slope under it');
  assert.deepEqual(unpackFlora(((255 << FLORA_WOOD) | (51 << FLORA_DIRT) | (102 << FLORA_GRASS) | (153 << FLORA_STONE)) >>> 0), [1, 0.2, 0.4, 0.6]);
});

test('FAR-FLORA the trees a tile grows: FOREST1\'s chance by the field and the ground\'s share with the woods\' law, else DFU\'s scatter (its chances, the elevation scale, the desert\'s quarter, the Tree records\' share); the canopy\'s cover of them (mutant: the law\'s pick, a chance, the clamp, the quarter, the share, the cover\'s exponent)', () => {
  assert.deepEqual(WOODS_SPEC, { forests: true, desert: false, treeShare: 1 });
  assert.equal(treesPerTile(1, 0, 1, 0, WOODS_SPEC), FOREST.forestTree, 'the woods on grass');
  assert.equal(treesPerTile(0, 0, 1, 0, WOODS_SPEC), FOREST.plainTree, 'a plain on grass');
  assert.ok(Math.abs(treesPerTile(1, 0.5, 0, 0.5, WOODS_SPEC) - FOREST.forestTree * (0.5 * FOREST.ground[1] + 0.5 * FOREST.ground[3])) < 1e-12, 'dirt and stone at their shares');
  const dfu = floraSpec(504, false, false);
  assert.deepEqual(dfu, { forests: false, desert: false, treeShare: 9 / 31 });
  assert.ok(Math.abs(treesPerTile(1, 0, 1, 0, dfu, 64) - 0.9 * 0.5 * 9 / 31) < 1e-12, 'DFU: the grass chance, half the elevation, the Tree records\' share');
  assert.ok(Math.abs(treesPerTile(0, 1, 0, 0, dfu, 10) - 0.2 * 0.4 * 9 / 31) < 1e-12, 'the elevation scale floored at 0.4');
  assert.ok(Math.abs(treesPerTile(0, 0, 0, 1, dfu, 400) - 0.05 * 9 / 31) < 1e-12, 'and capped at 1');
  const desert = floraSpec(503, true, true);
  assert.deepEqual(desert, { forests: false, desert: true, treeShare: 6 / 31 }, 'a desert keeps DFU\'s scatter with the switch on');
  assert.ok(Math.abs(treesPerTile(1, 0, 1, 0, desert, 128) - 0.9 * 0.25 * 6 / 31) < 1e-12, 'the desert\'s quarter');
  assert.equal(treesPerTile(1, 0, 1, 0, floraSpec(999, false, true)), 0, 'no Tree table: no trees');
  assert.equal(canopyCover(0, 6), 0);
  const t = 0.3, crown = 6, want = 1 - Math.exp(-t * 2.2 * crown * crown * (Math.PI / 4) / (6.4 * 6.4));
  assert.ok(Math.abs(canopyCover(t, crown) - want) < 1e-12, 'one minus no crown met across the woods');
  assert.ok(canopyCover(0.5, 6) > canopyCover(0.02, 6) && canopyCover(0.5, 9) > canopyCover(0.5, 6) && canopyCover(5, 9) < 1);
  assert.equal(expectedTrees(WOODS_SPEC, 128), treesPerTile(0.45, 0, 1, 0, WOODS_SPEC, 128), 'the far views: the woods\' share of the land on grass');
});

test('FAR-FLORA a vertex\'s canopy and its ground: the near ground\'s tiles by their shares; the canopy four bytes - its cover and the trees\' own art - raised to their height; no art no woods (mutant: the mix, the vertex\'s bytes, the lift, the cover byte)', () => {
  const c = new Uint8Array(8);
  const cover = canopyCover(0.4, ART.w);
  const lift = plantCanopy(c, 1, 0.4, ART);
  assert.ok(Math.abs(lift - cover * ART.h * FLORA.lift) < 1e-9, 'the canopy over the ground');
  assert.deepEqual([...c], [0, 0, 0, 0, Math.round(cover * 255), ...ART.rgb], 'the second vertex\'s: its cover, then the art');
  const bare = new Uint8Array(4).fill(9);
  assert.equal(plantCanopy(bare, 0, 0.4, null), 0);
  assert.deepEqual([...bare], [0, 9, 9, 9], 'no art read: no cover');
  const g = Uint8Array.from([9, 9, 9]);
  layGround(g, 0, GROUND, 0.25, 0.5, 0.25);
  assert.deepEqual([...g], [50, 100, 50]);
  const h = Uint8Array.from([9, 9, 9]);
  layGround(h, 0, GROUND, 0.1, 0.2, 0.1);
  assert.deepEqual([...h], [50, 100, 50], 'the shares of what grows, whatever grows nothing beside it');
  layGround(g, 0, GROUND, 0, 0, 0);
  assert.deepEqual([...g], [50, 100, 50], 'nothing grows there: left');
  layGround(g, 0, null, 1, 0, 0);
  assert.deepEqual([...g], [50, 100, 50], 'no tiles read: left');
});

test('FAR-FLORA the middle ring\'s woods: each vertex its sample\'s trees in its pixel\'s climate, coloured and raised, its normals the canopy\'s, the sea none; eased to the far ring\'s expectation over the geomorph\'s band, the ground\'s shares with them; half the rows a step (mutant: the pixel, the sea, the lift into the normals, the ease, the ground\'s ease, the step, the attribute)', async () => {
  assert.deepEqual(MID_FLORA_EASE, [MID_RADIUS - MID_REBUILD_DRIFT - 2, MID_RADIUS - MID_REBUILD_DRIFT]);
  const radius = 1, sub = 2, side = midRingSide(radius, sub), bx = 50, by = 60, seaY = ringHeight(0);
  const heights = new Float32Array(side * side).fill(100);
  heights[0] = seaY;   // the south-west corner: the sea
  const pack = (wood, grass) => ((Math.round(wood * 255) << FLORA_WOOD) | (Math.round(grass * 255) << FLORA_GRASS)) >>> 0;
  // the woods in the north-east pixel (51, 59) alone; grass everywhere
  const flora = Uint32Array.from({ length: side * side }, (_, v) => {
    const gx = v % side, gz = Math.floor(v / side);
    return Math.floor(gx / sub) === 2 && Math.floor(gz / sub) === 2 ? pack(1, 1) : pack(0, 1);
  });
  const asked = [];
  const floraAt = (px, py) => { asked.push(`${px},${py}`); return { spec: WOODS_SPEC, art: ART, ground: GROUND, byte: 128 }; };
  const v = midRingVertices({ heights, baseX: bx, baseY: by, radius, sub, tintAt: () => [7, 7, 7], seaY, flora, floraAt });
  assert.equal(new Set(asked).size, asked.length, 'each pixel\'s flora read once');
  assert.ok(asked.includes('51,59') && asked.includes('49,61'), 'the pixels of the footprint, rows north from the south');
  const at = (gx, gz) => gz * side + gx;
  const woodsV = at(5, 5), plainV = at(3, 1);
  const wantWood = canopyCover(FOREST.forestTree, ART.w), wantPlain = canopyCover(FOREST.plainTree, ART.w);
  assert.equal(v.flora[woodsV * 4], Math.round(wantWood * 255), 'the woods\' cover');
  assert.equal(v.flora[plainV * 4], Math.round(wantPlain * 255), 'a plain\'s');
  assert.equal(v.flora[0], 0, 'the sea grows none');
  assert.ok(Math.abs(v.positions[woodsV * 3 + 1] - (100 + wantWood * ART.h * FLORA.lift)) < 1e-4, 'raised to the canopy');
  assert.equal(v.positions[1], Math.fround(seaY), 'the sea stays at its floor');
  assert.deepEqual([...v.colors.subarray(woodsV * 3, woodsV * 3 + 3)], GROUND.grass, 'the grass tile under the trees (the program lays the canopy)');
  assert.deepEqual([...v.flora.subarray(woodsV * 4 + 1, woodsV * 4 + 4)], ART.rgb, 'the canopy the trees\' art');
  assert.deepEqual([...v.colors.subarray(0, 3)], [7, 7, 7], 'the sea keeps its tint');
  // a vertex reads its own pixel's climate: the art in the south-east pixel (51, 61) alone
  const one = midRingVertices({ heights, baseX: bx, baseY: by, radius, sub, tintAt: () => [7, 7, 7], seaY, flora: new Uint32Array(side * side).fill(pack(1, 1)), floraAt: (px, py) => ({ spec: WOODS_SPEC, art: px === 51 && py === 61 ? ART : null, ground: GROUND, byte: 128 }) });
  assert.ok(one.flora[at(5, 1) * 4] > 0 && one.flora[at(1, 5) * 4] === 0, 'east and south: its own pixel\'s');
  const { gl, log } = fakeGl();
  new MidRingMesh(gl).build(v, { baseX: bx, baseY: by, radius, sub, curX: bx, curY: by });
  assert.deepEqual(log.attribs.find((a) => a[0] === 5), [5, 4, 6, true], 'the canopy four normalized bytes at location 5');
  // PEAKS1's snow whitens the ring's canopy as it whitens its ground
  const snowy = midRingVertices({ heights, baseX: bx, baseY: by, radius, sub, tintAt: () => [7, 7, 7], seaY, flora, floraAt, snowAt: () => 0 });
  const sv = woodsV, ssh = capShare(heights[sv] - seaY, snowy.normals[sv * 3 + 1], 0);
  assert.ok(ssh > 0.5);
  assert.deepEqual([...snowy.flora.subarray(sv * 4 + 1, sv * 4 + 4)], ART.rgb.map((c, k2) => Math.round(c + (SNOWCAP.rgb[k2] - c) * ssh)), 'the middle ring\'s canopy whitened');
  // the normals are the canopy's: the woods' edge tilts them
  const lifted = Float32Array.from({ length: side * side }, (_, k) => v.positions[k * 3 + 1]);
  const n = midRingNormals(lifted, side, sub);
  assert.deepEqual([...v.normals], [...n]);
  assert.ok(Math.abs(v.normals[at(4, 5) * 3]) > 1e-4, 'the edge of the woods leans');
  // the ease: a vertex a whole band out keeps the far ring's expectation, one inside it the field's own
  const R = 12, S1 = 1, side2 = midRingSide(R, S1);
  const h2 = new Float32Array(side2 * side2).fill(100), f2 = new Uint32Array(side2 * side2).fill(pack(1, 1));
  const v2 = midRingVertices({ heights: h2, baseX: 0, baseY: 0, radius: R, sub: S1, tintAt: () => [7, 7, 7], seaY, flora: f2, floraAt: () => ({ spec: WOODS_SPEC, art: ART, ground: GROUND, byte: 128 }) });
  const cov = (dx) => v2.flora[(R * side2 + (R + dx)) * 4];   // a vertex dx pixels east of the base's corner, on its row
  const exp = canopyCover(expectedTrees(WOODS_SPEC, 128), ART.w);
  assert.equal(cov(0), Math.round(wantWood * 255), 'inside the band: the field\'s');
  assert.equal(cov(12), Math.round(exp * 255), 'past it: the far ring\'s expectation');
  const e = 0.25 * 0.25 * (3 - 2 * 0.25), mid = (1 - e) * FOREST.forestTree + e * expectedTrees(WOODS_SPEC, 128);   // 9.5 pixels from the base's centre: a quarter into 9..11
  assert.equal(cov(10), Math.round(canopyCover(mid, ART.w) * 255), 'a quarter into the band: the smoothstep\'s share');
  // the ground's shares ease with the woods: all dirt inside, the near law's mean past the band
  const dirtOnly = ((255 << FLORA_WOOD) | (255 << FLORA_DIRT)) >>> 0;
  const v3 = midRingVertices({ heights: h2, baseX: 0, baseY: 0, radius: R, sub: S1, tintAt: () => [7, 7, 7], seaY, flora: new Uint32Array(side2 * side2).fill(dirtOnly), floraAt: () => ({ spec: WOODS_SPEC, art: null, ground: GROUND, byte: 128 }) });
  const rgb = (dx) => [...v3.colors.subarray((R * side2 + R + dx) * 3, (R * side2 + R + dx) * 3 + 3)];
  assert.deepEqual(rgb(0), GROUND.dirt, 'inside: its own tiles');
  assert.deepEqual(rgb(12), [0, 1, 2].map((c) => Math.round(GROUND.dirt[c] * 0.054 + GROUND.grass[c] * 0.927 + GROUND.stone[c] * 0.019)), 'past the band: the law\'s mean, as the far ring\'s');
  // the woods' rows are twice the work: a step lays half as many
  const { midRingVertexSteps, MID_ROWS_A_STEP } = await import('../../src/render/midRing.js');
  const count = (o) => { let k = 0; const it = midRingVertexSteps(o); while (!it.next().done) k++; return k; };
  const plainSteps = count({ heights: h2, baseX: 0, baseY: 0, radius: R, sub: S1, tintAt: () => [7, 7, 7], seaY });
  const woodsSteps = count({ heights: h2, baseX: 0, baseY: 0, radius: R, sub: S1, tintAt: () => [7, 7, 7], seaY, flora: f2, floraAt: () => ({ spec: WOODS_SPEC, art: ART, ground: GROUND, byte: 128 }) });
  assert.equal(woodsSteps - plainSteps, Math.floor((side2 - 1) / (MID_ROWS_A_STEP / 2)) - Math.floor((side2 - 1) / MID_ROWS_A_STEP), 'half the rows a step with the woods');
});

test('FAR-FLORA the far ring\'s and the far field\'s woods: the law\'s expectation in the climate\'s art over the near ground\'s tiles, the ground kept under the canopy, none on the sea or a face; none asked, the grid of before (mutant: the expectation, the sea, the face, the ground array, the field\'s lift before its normals)', () => {
  const W = 40, Hh = 40, bytes = new Uint8Array(W * Hh).fill(40);
  for (let x = 0; x < W; x++) bytes[30 * W + x] = 0;   // a row of sea
  for (let y = 0; y < Hh; y++) bytes[y * W + 25] = 120;   // a ridge
  for (let y = 0; y < Hh; y++) bytes[y * W + 15] = 4;   // a beach: over the sea's floor (byte 3), under the beach line (5 x 8)
  const inputs = { heightBytes: bytes, mapWidth: W, mapHeight: Hh, climateAt: () => 231, baseX: 20, baseY: 20, radius: 12 };
  const plain = buildFarRingGrid(inputs);
  const asked = [];
  const floraOf = (climate) => { asked.push(climate); return { spec: WOODS_SPEC, art: ART, ground: GROUND }; };
  const g = buildFarRingGrid({ ...inputs, floraOf });
  assert.ok(asked.length > 0 && asked.every((c) => c === 231));
  assert.equal(plain.flora, null);
  assert.equal(plain.ground, null);
  const side = g.side, at = (px, py) => (py - 20 + 12) * side + (px - 20 + 12);
  const k = at(20, 20), cover = canopyCover(expectedTrees(WOODS_SPEC, 40), ART.w);
  assert.equal(g.flora[k * 4], Math.round(cover * 255));
  assert.deepEqual([...g.flora.subarray(k * 4 + 1, k * 4 + 4)], ART.rgb, 'the canopy the trees\' art');
  assert.equal(g.ground[k], plain.positions[k * 3 + 1], 'the ground under the canopy');
  assert.ok(Math.abs(g.positions[k * 3 + 1] - (plain.positions[k * 3 + 1] + cover * ART.h * FLORA.lift)) < 1e-3, 'the canopy over it');
  const want = [0, 1, 2].map((c) => Math.round((GROUND.dirt[c] * 0.054 + GROUND.grass[c] * 0.927 + GROUND.stone[c] * 0.019) / 1));
  assert.deepEqual([...g.colors.subarray(k * 3, k * 3 + 3)], want, 'the tiles by the law\'s shares');
  assert.equal(g.flora[at(20, 30) * 4], 0, 'the sea');
  assert.equal(g.sea[at(15, 20)], 0);
  assert.equal(g.flora[at(15, 20) * 4], 0, 'the beach');
  assert.ok(g.flora[at(25, 20) * 4] > 0 && g.flora[at(24, 20) * 4] > 0, 'a ridge and its flank under the law (central differences over 1,638 m: 26 degrees)');
  // PEAKS1's snow whitens the canopy as it whitens the ground (a mix of the two whitened is the mix whitened)
  const snowy = buildFarRingGrid({ ...inputs, relief: false, floraOf, snowAt: () => 0 });
  const sk = at(20, 20), sh = capShare(snowy.ground[sk] - ringHeight(0), snowy.normals[sk * 3 + 1], 0);
  assert.ok(sh > 0.5, `under the line (${sh})`);
  const wh = (c, k2) => Math.round(c + (SNOWCAP.rgb[k2] - c) * sh);
  assert.deepEqual([...snowy.colors.subarray(sk * 3, sk * 3 + 3)], want.map(wh), 'the ground whitened');
  assert.deepEqual([...snowy.flora.subarray(sk * 4 + 1, sk * 4 + 4)], ART.rgb.map(wh), 'and the canopy with it');
  // the two tests a far vertex stands a tree by: the face (FLORA.steep) and the beach line (the byte's own height)
  const cos = Math.cos((50 * Math.PI) / 180);
  assert.deepEqual([standsTrees(cos + 1e-6, 100), standsTrees(cos - 1e-6, 100), standsTrees(1, SCALED_BEACH_ELEVATION), standsTrees(1, SCALED_BEACH_ELEVATION - 0.01)], [true, false, true, false]);
  assert.deepEqual([...g.normals], [...plain.normals], 'the normals the ground\'s');
  // the far field: its cells the same, lifted after their normals
  const side3 = 5, n3 = side3 * side3;
  const base = { high: new Uint8Array(n3).fill(60), low: new Uint8Array(n3), baseCX: 10, baseCY: 10, radius: 2, heightOf: (b) => ringHeight(b), tintAt: () => [7, 7, 7], oceanAt: () => false, seaY: ringHeight(0) };
  base.high[12] = 90;
  const f0 = farFieldVertices(base), f1 = farFieldVertices({ ...base, floraAt: () => ({ spec: WOODS_SPEC, art: ART, ground: GROUND }) });
  assert.deepEqual([...f1.normals], [...f0.normals], 'the cells\' ground\'s normals');
  const fc = canopyCover(expectedTrees(WOODS_SPEC, 60), ART.w);
  assert.ok(Math.abs(f1.positions[1] - (f0.positions[1] + fc * ART.h * FLORA.lift)) < 1e-3);
  assert.equal(f1.flora[0], Math.round(fc * 255));
  assert.deepEqual([...f1.flora.subarray(1, 4)], ART.rgb);
  const f2 = farFieldVertices({ ...base, floraAt: () => ({ spec: WOODS_SPEC, art: ART, ground: GROUND }), snowAt: () => 0 });
  const fsh = capShare(f0.positions[1] - ringHeight(0), f2.normals[1], 0);
  assert.deepEqual([...f2.flora.subarray(1, 4)], ART.rgb.map((c, k2) => Math.round(c + (SNOWCAP.rgb[k2] - c) * fsh)), 'the far field\'s canopy whitened');
  assert.equal(f0.flora, null);
});

test('FAR-FLORA the far ring\'s knob and its builds: the woods at Land View 4 and up (Low\'s 3 keeps the ring of before: no ask, no attribute, the grain off), asked beside the middle ring\'s heights, built again when a tree\'s art lands; the ground answered under the canopy; the kill door (mutant: the knob, the job, the stale test, the uniform, groundAt)', async () => {
  assert.equal(FLORA_MIN_LAND_VIEW, 4);
  let version = 0, clock = 0;
  const book = { get version() { return version; }, floraOf: () => ({ spec: WOODS_SPEC, art: version ? ART : null, ground: version ? GROUND : null }) };
  const W = 200, Hh = 200, inputs = { heightBytes: new Uint8Array(W * Hh).fill(40), mapWidth: W, mapHeight: Hh, climateAt: () => 231, baseX: 100, baseY: 100, relief: false };
  const ring = (lv) => {
    const { gl, log } = fakeGl();
    const asks = [];
    const r = new FarRingRenderer(gl, { mid: { midRing: (job) => { asks.push(job); return new Promise(() => {}); } }, flora: book, now: () => clock });
    r.build(inputs, 100, 100, lv, null);
    r.draw(new Float32Array(16), { origin: [0, 0, 0], lightDir: [0, 1, 0], ambient: [0, 0, 0], sunScale: 1, sunColor: [1, 1, 1], fogColor: [0, 0, 0], fogEnd: 1, fovY: 1, aspect: 1 });
    return { r, log, asks };
  };
  const low = ring(3);
  assert.equal(low.asks[0].flora, false, 'Low: the middle ring asks no woods');
  assert.ok(!low.log.attribs.some((a) => a[0] === 5), 'no canopy attribute');
  assert.deepEqual(low.log.u3.find((u) => u[0] === 'uFlora'), ['uFlora', 0, FLORA_CROWN_M, FLORA_GROVE_M], 'the grain off');
  assert.equal(low.r.needsRebuild(100, 100), false);
  const med = ring(4);
  assert.equal(med.asks[0].flora, true);
  assert.deepEqual(med.log.u3.find((u) => u[0] === 'uFlora'), ['uFlora', 1, FLORA_CROWN_M, FLORA_GROVE_M]);
  assert.deepEqual(med.log.attribs.find((a) => a[0] === 5), [5, 4, 6, true], 'the canopy four normalized bytes at location 5');
  assert.deepEqual(med.log.u4.find((u) => u[0] === 'uCanopyBand'), ['uCanopyBand', 0, 1, 0, 0], 'no band: the canopy everywhere');
  assert.equal(med.r.needsRebuild(100, 100), false, 'built with the book as it stands');
  version = 1;   // a tree's art landed
  // PIN MOVED (OW-RING): built again once the book has stood still FLORA_SETTLE_MS - a burst of arts one build
  assert.deepEqual([FLORA_SETTLE_MS, FLORA_WAIT_MAX_MS], [1500, 6000]);
  assert.equal(med.r.needsRebuild(100, 100), false, 'the book just moved: not yet');
  clock += FLORA_SETTLE_MS - 1;
  assert.equal(med.r.needsRebuild(100, 100), false);
  clock += 1;
  assert.equal(med.r.needsRebuild(100, 100), true, 'built again with it, once the book stands still');
  assert.equal(low.r.needsRebuild(100, 100), false, 'Low never');
  med.r.build(inputs, 100, 100, 4, null);
  assert.equal(med.r.needsRebuild(100, 100), false);
  assert.equal(med.r._floraStale({ floraVersion: 0 }), true, 'a middle ring or far field laid before it: owed');
  assert.equal(med.r._floraStale({ floraVersion: 1 }), false);
  assert.equal(low.r._floraStale({ floraVersion: -1 }), false, 'Low: none owed');
  // OW-RING: a burst - an art a second, each beginning the wait again - is built FLORA_WAIT_MAX_MS after its first
  const first = clock;
  for (let k = 0; k < 6; k++) { version++; assert.equal(med.r.needsRebuild(100, 100), false, `art ${k + 1} of the burst: waiting`); clock += 1000; }
  version++;
  assert.equal(clock - first, FLORA_WAIT_MAX_MS);
  assert.equal(med.r.needsRebuild(100, 100), true, 'the burst never stilled: built at the longest wait');
  med.r.build(inputs, 100, 100, 4, null);
  assert.equal(med.r.needsRebuild(100, 100), false, 'built: owed nothing, the wait let go');
  version++;
  assert.equal(med.r.needsRebuild(100, 100), false, 'an art after the build: a wait of its own');
  version = 1;
  const ground = ringHeight(40);
  assert.ok(Math.abs(med.r.groundAt(100, 100) - ground) < 1e-3, `the ground, never the canopy (${med.r.groundAt(100, 100)})`);
  assert.ok(med.r._ringY.positions[(12 * 0 + 48 * 97 + 48) * 3 + 1] > ground + 1, 'the canopy drawn over it');
  assert.equal(floraDisabled('?world&farflora=off'), true);
  assert.equal(floraDisabled('?world'), false);
  const off = new FarRingRenderer(fakeGl().gl, { flora: null });
  assert.equal(off._flora, null);
  for (const r of [low.r, med.r, off]) r.dispose();
});

test('FAR-FLORA the worker answers the middle ring\'s woods beside its heights, kept by the pixel and transferred; the client assembles the bands (mutant: the job\'s flag, the pixel\'s samples, the transfer, the band\'s place)', async () => {
  const posted = [];
  const was = { on: globalThis.onmessage, post: globalThis.postMessage };
  globalThis.postMessage = (m, t) => posted.push({ m, t });
  try {
    await import('../../src/world/terrain/terrainGenWorker.js');
    globalThis.onmessage({ data: { t: 'init', woodsBytes: syntheticWoodsBytes() } });
    globalThis.onmessage({ data: { t: 'midring', id: 3, baseX: 398, baseY: 251, radius: 1, sub: 2, landform: false, flora: true } });
    const a = posted.find((p) => p.m.t === 'mid');
    const want = buildMidRingHeights({ woods, baseX: 398, baseY: 251, radius: 1, sub: 2, pixel: (px, py) => midRingFloraPixel(midRingPixel(woods, px, py, 2), px, py, 2), Kind: /** @type {any} */ (Uint32Array) });
    assert.ok(a.m.flora instanceof Uint32Array);
    assert.deepEqual([...a.m.flora], [...want]);
    assert.ok(a.t.includes(a.m.flora.buffer) && a.t.includes(a.m.heights.buffer), 'transferred');
    globalThis.onmessage({ data: { t: 'midring', id: 4, baseX: 398, baseY: 251, radius: 1, sub: 2, landform: false } });
    assert.equal(posted.at(-1).m.flora, null, 'not asked: none');
  } finally { globalThis.onmessage = was.on; globalThis.postMessage = was.post; }
  // the client: a band at a time, each band's woods at its rows
  const { TerrainGenClient } = await import('../../src/world/terrain/terrainGenClient.js');
  const client = new TerrainGenClient({ woods, woodsBytes: null });
  const side = midRingSide(3, 2), sent = [];
  client._worker = { postMessage: (m) => sent.push(m) };
  const got = client.midRing({ baseX: 0, baseY: 0, radius: 3, sub: 2, flora: true });
  for (let k = 0; k < 10 && sent.length > k; k++) {
    const m = sent[k], rows = (m.rows[1] - m.rows[0]) * 2 + (m.rows[1] === 7 ? 1 : 0);
    client._midAnswer({ t: 'mid', id: m.id, heights: new Float32Array(rows * side), flora: new Uint32Array(rows * side).fill(m.rows[0] + 1) });
    await new Promise((r) => setTimeout(r, 0));
  }
  const ans = await got;
  assert.equal(ans.flora.length, side * side);
  assert.equal(ans.flora[0], 1);
  assert.equal(sent.length, 2, 'two bands of four pixel rows');
  assert.deepEqual([ans.flora[8 * side - 1], ans.flora[8 * side], ans.flora[side * side - 1]], [1, 5, 5], 'the second band at its own rows');
});

test('FAR-FLORA the canopy\'s art: the opaque texels\' mean over every Tree record (weighted by its texels), their billboards\' mean size, the ground\'s three tiles whole; the book asks an archive once and moves its version when it lands (mutant: the alpha test, the weighting, the size, the ask once, the version)', async () => {
  assert.deepEqual(opaqueMean(Uint8Array.from([10, 20, 30, 255, 99, 99, 99, 0, 30, 40, 50, 255])), [20, 30, 40, 2]);
  assert.deepEqual(opaqueMean(Uint8Array.from([10, 20, 30, 255, 40, 50, 60, 0]), true), [25, 35, 45, 2], 'a ground tile: every texel');
  const pic = (rgb, n) => ({ data: Uint8Array.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : rgb[i % 4])) });
  const reads = [];
  const read = {
    rgba: async (a, r) => { reads.push([a, r]); return r === 12 ? pic([100, 0, 0], 3) : pic([0, 100, 0], 1); },
    size: async (a, r) => (r === 12 ? { w: 4, h: 8 } : { w: 2, h: 4 }),
  };
  const art = await treeArt(504, read);
  assert.deepEqual(reads.map((x) => x[1]), [12, 13, 14, 15, 16, 17, 18, 25, 30], 'TEXTURE.504\'s Trees');
  // record 12: three red texels, eight others one green each: (300, 800, 0) over 11
  assert.deepEqual(art.rgb.map((x) => Math.round(x * 100) / 100), [27.27, 72.73, 0]);
  assert.deepEqual([art.w, art.h], [(4 + 8 * 2) / 9, (8 + 8 * 4) / 9]);
  assert.equal(await treeArt(999, read), null);
  assert.deepEqual(GROUND_RECORDS, { dirt: 1, grass: 2, stone: 3 });
  const tiles = await groundArt(302, { rgba: async (a, r) => pic([r * 10, 0, 0], 4) });
  assert.deepEqual(tiles, { dirt: [10, 0, 0], grass: [20, 0, 0], stone: [30, 0, 0] });
  let asks = 0;
  const book = createFloraArt({ read: () => ({ rgba: async (a, r) => { asks++; return read.rgba(a, r); }, size: read.size }) });
  const first = book.floraOf(231);
  assert.deepEqual([first.spec, first.art, first.ground], [WOODS_SPEC, null, null], 'asked, not yet read');
  book.floraOf(231);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(book.version, 2, 'the trees and the ground landed');
  assert.equal(asks, 9 + 3, 'each archive once');
  assert.ok(book.floraOf(231).art && book.floraOf(231).ground);
  const none = createFloraArt({ read: () => null });
  assert.equal(none.floraOf(231).art, null);
  assert.equal(none.version, 0, 'no pipeline: nothing asked yet');
});

test('FAR-FLORA the program: the canopy\'s four bytes at location 5, its share by the band\'s crossfade, and every ring lane\'s land the ground\'s light and the canopy\'s - the flats\' light, grained - mixed by the cover; the grain 1 off, crowns and groves about 1 near, faded to 1 where they fall under a fragment (mutant: the attribute, the share, the lanes\' mix, the flats\' light, the off test, the fade)', () => {
  const fr = readFileSync('src/render/farRing.js', 'utf8');
  assert.ok(fr.includes('layout(location=5) in vec4 aCanopy;'));
  assert.ok(fr.includes('vFlora = aCanopy.x * (uCanopyBand.z > 0.5 ? smoothstep(uCanopyBand.x, uCanopyBand.y, max(cb.x, cb.y)) : 1.0);') && fr.includes('vCanopy = aCanopy.yzw;') && fr.includes('vColor = aColor;'));
  const classicFs = fr.slice(fr.indexOf('const FS = `#version 300 es'));
  const MIX = 'vCanopy * floraLight(uAmbient, uSunColor, sun, uMoonColor, uMoonScale) * floraGrain(vWorld.xz), vFlora);';
  assert.ok(classicFs.includes('${FLORA_GLSL}') && classicFs.includes(`vec3 lit = mix(vColor * (uAmbient + uSunColor * (sun * diff) + uMoonColor * (uMoonScale * mdiff)), ${MIX}`));
  for (const fs of [EL_FAR_RING_FS, classicShadowLane().farRingFs]) {
    assert.ok(fs.includes('float floraGrain(vec2 xz)') && fs.includes(`vec3 lit = mix(elDecode(vColor) * (uAmbient + uSunColor * (sun * diff) + uMoonColor * (uMoonScale * mdiff)), ${MIX.replace('vCanopy', 'elDecode(vCanopy)')}`), 'the lanes');
  }
  // the flats' light: the ambient, half the moon, half the sun (render/renderer.js BB_FS's uTint and uBBSun)
  const fl = glslFunctions(`${FLORA_LIGHT_GLSL}\nuniform float uK;\nvec3 run() { return floraLight(vec3(0.1, 0.2, 0.3), vec3(1.0, 0.8, 0.6), 0.9, vec3(0.5, 0.5, 1.0), 0.4); }`, { uK: 0 });
  const got = fl.run(), want = [0.1 + 0.5 * 0.2 + 0.45, 0.2 + 0.5 * 0.2 + 0.8 * 0.45, 0.3 + 1.0 * 0.2 + 0.6 * 0.45];
  assert.ok(got.every((g, k) => Math.abs(g - want[k]) < 1e-9), `${got} against ${want}`);
  const near = [];
  for (let k = 0; k < 40; k++) near.push(grainAt([1, FLORA_CROWN_M, FLORA_GROVE_M], [k * 3.7, k * 5.3], 0.01));
  assert.ok(near.some((s) => s < 0.9) && near.some((s) => s > 1.1) && near.every((s) => s > 0.5 && s < 1.5), `crowns and groves near: ${near.map((s) => s.toFixed(2))}`);
  assert.equal(grainAt([0, FLORA_CROWN_M, FLORA_GROVE_M], [3, 5], 0.01), 1, 'the grain off');
  assert.equal(grainAt([1, FLORA_CROWN_M, FLORA_GROVE_M], [3, 5], 10), 1, 'far: faded to the woods\' mean');
});

/** floraGrain evaluated with fwidth a constant (the evaluator's derivative of a uniform is 0: the screen's rate is
 *  handed as the cells' size a fragment). */
function grainAt(uFlora, xz, fw) {
  const src = FLORA_GLSL.replace(/fwidth\([cg]\)/g, `vec2(${fw.toFixed(6)})`)
    + '\nuniform vec2 uXz;\nfloat run() { return floraGrain(uXz); }';
  const fns = glslFunctions(src, { uFlora, uXz: xz, uFloraUnused: 0 });
  return fns.run();
}
