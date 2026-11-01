// COAST-LOOK (2026-10-28, the owner: "Coastlines arent texture blended properly. They have hard edges", and, asked which
// edge, "Both edges" - the water's and the beach's; "No band aids or half assed work"; bible/07-Rendering/Water-Arc.md
// COAST-LOOK).
//  - A TRANSITION TILE IS ITS TWO KINDS' OWN GROUND (world/terrain/groundEdge.js, its GLSL twin render/groundEdgeGlsl.js):
//    its corners read back off the byte the marching squares wrote, the second kind's share their bilinear, wandered and
//    drawn across a soft rim - continuous across every seam, a pure tile its own picture, past REACH of the line whole.
//  - THE WATER'S EDGE IS THE SAME LINE: the sheet's shore (render/waterSurface.js) and the silt (render/waterBedGlsl.js)
//    wander by the same field where the ground blends, and nowhere else; the sheet's water the land's complement.
//  - DEEP WATERS' CUT FOLLOWS A WANDERING LINE inside the clipped tiles (renderer.js terrainClipFs, coastCut): never
//    into a tile the mod kept, never along a kept tile's seam, a kept point drawing the land beside it mirrored; the
//    ground's cull (world/deepWater/deepWaterCap.js clippedTerrainIndices) keeps the coast's ring for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';

import { GROUND_KIND, GROUND_EDGE, GROUND_EDGE_REACH, GROUND_KIND_TABLE, COAST_CUT, COAST_CUT_WANDER, groundKindsOf, packGroundKinds, cornerShare, groundEdgeWander, edgeShare, groundEdgeAt, coastCutAt } from '../../src/world/terrain/groundEdge.js';
import { groundEdgeGlsl, groundWanderGlsl, groundKindsGlsl, coastEdgesOn } from '../../src/render/groundEdgeGlsl.js';
import { roadEdgeGlsl, EDGE_NOISE_GLSL } from '../../src/render/roadEdgeGlsl.js';
import { roadEdgeNoise } from '../../src/world/road/roadEdge.js';
import { WATER_BED_GLSL, waterBedMix } from '../../src/render/waterBedGlsl.js';
import { waterSurfaceFs, SHORE_SOFTNESS } from '../../src/render/waterSurface.js';
import { waterBedOf, flatGrid } from '../../src/world/water/waterBed.js';
import { fanCut } from '../../src/world/water/waterLevel.js';
import { EL_TERRAIN_FS } from '../../src/render/enhancedLighting.js';
import { terrainClipFs } from '../../src/render/renderer.js';
import { marchTile, assignTiles } from '../../src/world/terrain/terrainTiles.js';
import { convertTile, convertTilemap, CLIP_SENTINEL } from '../../src/world/terrain/terrainSurface.js';
import { WATER_MASK_TABLE, WATER_DRAW_MASK_TABLE, SHORE_FAMILIES, waterCoverage, packWaterMask } from '../../src/world/water/waterCorners.js';
import { clippedTerrainIndices } from '../../src/world/deepWater/deepWaterCap.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const D = 128, TD = 129, TILE = 6.4;
const { water: WATER, dirt: DIRT, grass: GRASS, stone: STONE } = GROUND_KIND;
/** Each ring's pair: the kind at the unset corners, the kind at the set ones (marchTile: the set bits are the odd kinds). */
const RINGS = [[WATER, DIRT], [GRASS, DIRT], [GRASS, STONE]];
const WANDER_MAX = GROUND_EDGE.wander.reduce((s, o) => s + o.amp, 0);
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** GLSL's ROT and TRANS (column-major), read off the lane's program - never restated. */
const tables = (() => {
  const m = /const mat2 ROT\[4\] = mat2\[4\]\(([\s\S]*?)\);\nconst vec2 TRANS\[4\] = vec2\[4\]\(([\s\S]*?)\);/.exec(EL_TERRAIN_FS);
  const nums = (s) => [...s.matchAll(/-?\d+\.\d+/g)].map((x) => Number(x[0]));
  const r = nums(m[1]), t = nums(m[2]);
  return { src: m[0], ROT: [0, 1, 2, 3].map((k) => r.slice(4 * k, 4 * k + 4)), TRANS: [0, 1, 2, 3].map((k) => t.slice(2 * k, 2 * k + 2)) };
})();
const rot = (t, v) => { const R = tables.ROT[t]; return [R[0] * v[0] + R[2] * v[1], R[1] * v[0] + R[3] * v[1]]; };
const unrot = (t, v) => { const R = tables.ROT[t]; return [R[0] * v[0] + R[1] * v[1], R[2] * v[0] + R[3] * v[1]]; };
const turned = (t, l) => { const p = rot(t, l), T = tables.TRANS[t]; return [p[0] + T[0], p[1] + T[1]]; };
const mirror = (n, p) => [0, 1].map((i) => { const l = p[i] - n[i]; return l < 0 ? -l : l > 1 ? 2 - l : l; });
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} against ${b}`);
const nearAll = (a, b, eps, msg) => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => near(v, b[i], eps, `${msg} [${i}]`)); };

/** A pixel's converted tilemap off a corner field (tileData, the marching squares' input) - assignTiles' own march. */
function bytesOf(tileData) {
  const tm = new Uint8Array(D * D);
  assignTiles(tileData, tm, true);
  return convertTilemap(tm);
}
/** A coast of bands, each wider than a tile, so a cell holds at most two kinds: stone, grass, a beach of dirt, the sea -
 *  a ring about a centre wobbled, so every turn and every shape of each ring is met. */
const COAST = (() => {
  const td = new Uint8Array(TD * TD);
  for (let y = 0; y < TD; y++) for (let x = 0; x < TD; x++) {
    const r = Math.hypot(x - 64, y - 64) + 6 * Math.sin(x * 0.21) + 5 * Math.cos(y * 0.17);
    td[x + y * TD] = r < 20 ? STONE : r < 33 ? GRASS : r < 40 ? DIRT : WATER;
  }
  return { td, bytes: bytesOf(td) };
})();
const cornersOf = (td, x, y) => [td[x + y * TD], td[x + 1 + y * TD], td[x + (y + 1) * TD], td[x + 1 + (y + 1) * TD]];
/** The kinds' weights a tile's byte draws at its tile-local (fx, fy) and pixel-local (x, y) point: a transition its two
 *  kinds at their shares, a pure tile its own kind whole; null for any other record (its own art). */
function weights(byte, fx, fy, x, y) {
  const w = [0, 0, 0, 0], g = groundKindsOf(byte);
  if (!g) { const r = byte >> 2; if (r > 3) return null; w[r] = 1; return w; }
  const s = edgeShare(cornerShare(g.mask, fx, fy), x, y);
  w[g.a] += 1 - s; w[g.b] += s;
  return w;
}
/** Every seam point of a tilemap, on a fine step: the picture from each side (the same point, each tile's own frame). */
function* seamPoints(step = 0.037) {
  for (let i = 1; i < D; i++) {
    for (let v = 0.001; v < D; v += step) {
      const c = Math.floor(v), fv = v - c;
      yield { left: [i - 1, c, 1, fv], right: [i, c, 0, fv], at: [i, v] };   // x = i: west tile at fx 1, east at fx 0
      yield { left: [c, i - 1, fv, 1], right: [c, i, fv, 0], at: [v, i] };   // y = i: south tile at fy 1, north at fy 0
    }
  }
}

test('COAST-LOOK the transitions\' corners are the marching squares\' own: every two-kind shape of each ring read back off the byte it writes, its kinds the unset corners\' and the set ones\'; a pure tile none; the shore\'s twins the water-dirt column\'s, their water the water\'s own tables\' (law and draw), the sheet\'s coverage the land share\'s complement; a saddle half turned its unturned self; packed two to a word as the shader reads them (mutants: the kinds swapped; the mask its complement; the twins unwritten; the saddle\'s turn unread; the pack\'s half)', () => {
  let shapes = 0;
  for (const [a, b] of RINGS) {
    for (let shape = 0; shape < 16; shape++) {
      const c = [0, 1, 2, 3].map((i) => ((shape >> i) & 1 ? b : a));
      const byte = convertTile(marchTile(...c));
      if (shape === 0 || shape === 15) { assert.equal(groundKindsOf(byte), null, `ring ${a}/${b} shape ${shape}: a pure tile is its own picture`); continue; }
      assert.deepEqual(groundKindsOf(byte), { a, b, mask: shape }, `ring ${a}/${b} shape ${shape} (byte ${byte})`);
      shapes++;
    }
  }
  assert.equal(shapes, 42);
  // the shore families: each byte with water at its unset corners is a shore whose water the water's own tables hold
  const kindOfFamily = [DIRT, GRASS, STONE];
  let shore = 0;
  for (let byte = 0; byte < 256; byte++) {
    const g = groundKindsOf(byte), fam = SHORE_FAMILIES.findIndex((f) => f.includes(byte >> 2));
    const drawn = WATER_DRAW_MASK_TABLE[byte];
    if (fam >= 0 && drawn > 0 && drawn < 15) {
      assert.deepEqual(g, { a: WATER, b: kindOfFamily[fam], mask: ~drawn & 15 }, `byte ${byte}: a shore of family ${fam} - its land the set corners, its water the draw table's`);
      // the law's table the same corners (what the player swims in) - but a saddle half turned, which DFU's motor reads as
      // dry ground (WATER-DRAW2 draws it as its unturned self)
      const halfSaddle = SHORE_FAMILIES[fam][3] === byte >> 2 && (byte & 3) >= 2;
      assert.equal(WATER_MASK_TABLE[byte], halfSaddle ? 0 : drawn, `byte ${byte}: the law's table`);
      for (const [fx, fy] of [[0.13, 0.71], [0.5, 0.5], [0.94, 0.06]]) near(waterCoverage(drawn, fx, fy) + cornerShare(g.mask, fx, fy), 1, 1e-12, `byte ${byte}: the sheet's water the land's complement`);
      shore++;
    } else if (g && g.a === WATER) assert.fail(`byte ${byte}: a shore the water's tables do not hold`);
  }
  assert.ok(shore >= 3 * 14, `every shore shape of the three families (${shore})`);
  // a saddle half turned is itself (a diagonal turned half round): the table answers turns 2 and 3 as 0 and 1
  for (const fam of [SHORE_FAMILIES[0], SHORE_FAMILIES[1], SHORE_FAMILIES[2], [10, 11, 12, 51], [15, 16, 17, 53]]) {
    for (const t of [2, 3]) assert.deepEqual(groundKindsOf((fam[3] << 2) | t), groundKindsOf((fam[3] << 2) | (t - 2)), `saddle ${fam[3]} turn ${t}`);
  }
  // every entry is a transition of its kinds' family - no other record is blended
  const families = new Map([[`${WATER},${DIRT}`, SHORE_FAMILIES[0]], [`${WATER},${GRASS}`, SHORE_FAMILIES[1]], [`${WATER},${STONE}`, SHORE_FAMILIES[2]], [`${GRASS},${DIRT}`, [10, 11, 12, 51]], [`${GRASS},${STONE}`, [15, 16, 17, 53]]]);
  for (let byte = 0; byte < 256; byte++) {
    const g = groundKindsOf(byte);
    if (g) assert.ok(families.get(`${g.a},${g.b}`).includes(byte >> 2), `byte ${byte}: record ${byte >> 2} is of its kinds' family`);
  }
  const words = packGroundKinds();
  for (let i = 0; i < 256; i++) assert.equal((words[i >> 1] >>> ((i & 1) * 16)) & 0xffff, GROUND_KIND_TABLE[i], `entry ${i} packed`);
});

test('COAST-LOOK the blend is continuous across every seam - a transition and its neighbour, a transition and a pure tile, two rings\' transitions on their shared kind - on a coast of stone, grass, a beach and the sea; past REACH of the line a point is one kind whole, and nearer it blends; the wander bounded, moving the line, the same at a pixel\'s two edges (mutants: the bilinear\'s corner; the rim\'s width; the wander\'s amplitude or sign; the octaves\' lattice off the pixel)', () => {
  const { td, bytes } = COAST;
  // the field's cells hold at most two kinds, and every ring is met (a test of the field, not the law)
  const met = new Set();
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const k = [...new Set(cornersOf(td, x, y))].sort();
    assert.ok(k.length <= 2 && (k.length < 2 || k[1] - k[0] === 1), `cell ${x},${y}: two neighbouring kinds at most`);
    const g = groundKindsOf(bytes[x + y * D]);
    if (k.length === 2) {
      const mask = cornersOf(td, x, y).reduce((m, v, i) => m | ((v === g.b ? 1 : 0) << i), 0);
      assert.deepEqual([g.a, g.b].sort(), k, `cell ${x},${y}: its two kinds`);
      assert.equal(g.mask, mask, `cell ${x},${y}: its corners`);
      met.add(`${g.a}${g.b}${g.mask}`);
    } else assert.equal(g, null, `cell ${x},${y}: one kind, its own picture`);
  }
  const saddles = (m) => m === 6 || m === 9;
  assert.deepEqual([...met].filter((k) => !saddles(Number(k.slice(2)))).length, 36, `the coast meets every corner, edge and three-corner shape of each ring (a smooth field makes no saddle - the table's test holds those) (${met.size})`);
  let blended = 0, n = 0;
  for (const { left, right, at } of seamPoints()) {
    const wl = weights(bytes[left[0] + left[1] * D], left[2], left[3], at[0], at[1]);
    const wr = weights(bytes[right[0] + right[1] * D], right[2], right[3], at[0], at[1]);
    nearAll(wl, wr, 1e-12, `the seam at (${at[0].toFixed(3)}, ${at[1].toFixed(3)})`);
    if (wl.some((v) => v > 0 && v < 1)) blended++;
    n++;
  }
  assert.ok(blended > 500, `seams through the blend itself (${blended} of ${n})`);
  // REACH: a point whose corner share is REACH or more from the line is one kind whole; nearer, the share is not
  let soft = 0;
  for (let byte = 0; byte < 256; byte++) {
    const g = groundKindsOf(byte);
    if (!g) continue;
    for (let y = 0.02; y < 1; y += 0.07) for (let x = 0.03; x < 1; x += 0.07) {
      const c = cornerShare(g.mask, x, y), p = [17 + x + byte % 50, 9 + y + (byte >> 3)], s = groundEdgeAt(byte, p[0], p[1]).share;
      if (Math.abs(c - 0.5) >= GROUND_EDGE_REACH) assert.ok(s === 0 || s === 1, `byte ${byte} at ${x.toFixed(2)},${y.toFixed(2)}: past REACH, one kind (${s})`);
      else if (s > 0 && s < 1) soft++;
    }
  }
  assert.ok(soft > 1000, `the line is drawn across a rim (${soft} points between)`);
  assert.equal(GROUND_EDGE_REACH, GROUND_EDGE.soft + WANDER_MAX);
  assert.ok(GROUND_EDGE_REACH < 0.5, 'a pure tile\'s edge is whole: the line never reaches a corner of one kind');
  // the wander: bounded by its amplitudes, used, and the lattice taken modulo the pixel
  let lo = 0, hi = 0;
  for (let y = 0.05; y < D; y += 0.61) for (let x = 0.07; x < D; x += 0.53) { const w = groundEdgeWander(x, y); lo = Math.min(lo, w); hi = Math.max(hi, w); }
  assert.ok(lo >= -WANDER_MAX && hi <= WANDER_MAX, `within the amplitudes (${lo}, ${hi})`);
  assert.ok(hi - lo > WANDER_MAX, `and wandering (${lo}, ${hi})`);
  for (const v of [3.3, 50.7, 101.1]) { assert.equal(groundEdgeWander(0, v), groundEdgeWander(128, v)); assert.equal(groundEdgeWander(v, 0), groundEdgeWander(v, 128)); }
  // the line wanders: along a straight edge the share at the corners' mid-line is not one number
  const edge = convertTile(marchTile(DIRT, DIRT, WATER, WATER));   // dirt along y = 0, the sea along y = 1
  const shares = new Set();
  for (let x = 0.5; x < D; x += 1) shares.add(groundEdgeAt(edge, x, 40.5).share.toFixed(3));
  assert.ok(shares.size > 30, `the shore wanders (${shares.size} shares on its mid-line)`);
});

/** The terrain programs' chunk alone, over the ROT and TRANS it reads and ROAD-LOOK's cell fetch. */
const terrainChunk = `uniform highp usampler2D uTilemap;\nuniform sampler2DArray uTileArr;\n${tables.src}\n${roadEdgeGlsl('')}\n${groundEdgeGlsl('')}`;
/** A sea cut by Deep Waters: the clipped tiles (CLIP_SENTINEL) north of a coast - straight, then a staircase, then
 *  straight - a lone clipped tile in the land, a lone kept tile in the sea and a notch; the land dirt and grass, turned. */
const CUT = (() => {
  const b = new Uint8Array(D * D);
  const sea = (x, y) => (x === 20 && y === 30) || (!(x === 100 && y === 100) && !(x === 60 && y >= 90 && y <= 93) && y > 70 + (x < 40 ? 0 : x < 80 ? x - 40 : 40));
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) b[x + y * D] = sea(x, y) ? CLIP_SENTINEL : ((((x * 7 + y * 13) % 3 === 0) ? GRASS : DIRT) << 2) | ((x + 2 * y) & 3);
  const byteAt = (x, y) => b[Math.min(D - 1, Math.max(0, y)) * D + Math.min(D - 1, Math.max(0, x))];
  return { bytes: b, byteAt, cutAt: (x, y) => byteAt(x, y) === CLIP_SENTINEL };
})();

test('COAST-LOOK the GLSL is the JS: the wander to the float, the table entry for entry, the blend\'s kinds and share at every transition, a kind\'s base record unturned at the coordinate\'s own gradient, and Deep Waters\' cut - cut or kept, the kept point handed the kept tile\'s byte, its mirrored point turned by its own transform and the gradient turned with it; off, nothing blended and no wander (mutants: any term of either side; the switch unread)', () => {
  const grads = [];
  const fns = glslFunctions(terrainChunk, {
    uGroundEdge: 1, uRoadEdge: 1,
    texelFetch: (_s, c) => [CUT.byteAt(c[0], c[1]), 0, 0, 0],
    textureGrad: (_s, p, gx, gy) => { grads.push({ p, gx, gy }); return [p[0], p[1], p[2] / 64, 1]; },
  });
  for (let y = 0.05; y < D; y += 3.17) for (let x = 0.07; x < D; x += 2.93) {
    near(fns.geWander([x, y]), groundEdgeWander(x, y), 1e-12, `the wander at (${x}, ${y})`);
    for (const [k, o] of GROUND_EDGE.wander.entries()) near(fns.reNoise([x, y], o.cells, GROUND_EDGE.salt + k), roadEdgeNoise(x, y, o.cells, GROUND_EDGE.salt + k), 1e-12, 'its octave');
  }
  for (let byte = 0; byte < 256; byte++) assert.equal(fns.geEntry(byte), GROUND_KIND_TABLE[byte], `entry ${byte}`);
  let mixes = 0;
  for (let byte = 0; byte < 256; byte++) {
    for (const [fx, fy] of [[0.03, 0.97], [0.5, 0.41], [0.77, 0.12], [0.5, 0.5], [0.99, 0.99]]) {
      const x = 40 + fx + (byte % 17), y = 33 + fy + (byte >> 4);
      const A = { value: 9 }, B = { value: 9 }, S = { value: 9 };
      const on = fns.groundMix(byte, [fx, fy], [x, y], A, B, S), want = groundEdgeAt(byte, x, y);
      assert.equal(on, !!want, `byte ${byte}: a transition or not`);
      if (!want) { assert.deepEqual([A.value, B.value, S.value], [0, 0, 0], `byte ${byte}: nothing handed back`); continue; }
      assert.deepEqual([A.value, B.value], [want.a, want.b], `byte ${byte}: its kinds`);
      near(S.value, want.share, 1e-12, `byte ${byte} at (${fx}, ${fy}): the share`);
      mixes++;
    }
  }
  assert.ok(mixes > 300);
  grads.length = 0;
  nearAll(fns.geBase(GRASS, [0.25, 0.75], [0.01, 0.002], [-0.003, 0.02]), [0.25, 0.75, GRASS / 64], 1e-12, 'the base record at the tile\'s own point');
  assert.deepEqual(grads.map((g) => [g.p, g.gx, g.gy]), [[[0.25, 0.75, GRASS], [0.01, 0.002], [-0.003, 0.02]]], 'unturned, at the coordinate\'s own gradient');
  // the cut, cell by cell along the coast: the JS answers, the GLSL agrees, a kept point handed its tile
  let cut = 0, kept = 0;
  const du = [0.013, -0.002], dv = [0.001, 0.017];
  for (let y = 60.013; y < 115; y += 0.093) for (let x = 0.017; x < D; x += 0.371) {
    const cx = Math.floor(x), cy = Math.floor(y), d = CUT.byteAt(cx, cy), t = d & 3;
    const io = { data: { value: d }, layer: { value: d >> 2 }, t: { value: t }, tileUV: { value: [x - cx, y - cy] }, tuv: { value: turned(t, [x - cx, y - cy]) }, gx: { value: rot(t, du) }, gy: { value: rot(t, dv) } };
    const before = JSON.stringify(Object.values(io).map((b) => b.value));
    const got = fns.coastCut([x, y], io.data, io.layer, io.t, io.tileUV, io.tuv, io.gx, io.gy), want = coastCutAt(CUT.cutAt, x, y);
    assert.equal(got, want.cut, `(${x.toFixed(3)}, ${y.toFixed(3)}): cut or kept`);
    if (want.cut) { cut++; continue; }
    if (!want.from) { assert.equal(JSON.stringify(Object.values(io).map((b) => b.value)), before, 'a kept tile\'s fragment untouched'); continue; }
    const dn = CUT.byteAt(...want.from), tn = dn & 3, l = mirror(want.from, [x, y]);
    assert.deepEqual([io.data.value, io.layer.value, io.t.value], [dn, dn >> 2, tn], `(${x.toFixed(3)}, ${y.toFixed(3)}): the kept tile's byte`);
    nearAll(io.tileUV.value, l, 1e-12, 'its point, mirrored about its own square');
    nearAll(io.tuv.value, turned(tn, l), 1e-12, '...turned by its own transform');
    nearAll(io.gx.value, rot(tn, du), 1e-12, 'the gradient the coordinate\'s own, turned by the kept tile\'s');
    nearAll(io.gy.value, rot(tn, dv), 1e-12, 'and the other');
    kept++;
  }
  assert.ok(cut > 1000 && kept > 300, `cut and kept points of the clipped tiles (${cut}, ${kept})`);
  fns.globals.uGroundEdge = 0;
  assert.equal(fns.geWander([31.3, 77.7]), 0, 'off: no wander');
  assert.equal(fns.groundMix(convertTile(marchTile(DIRT, WATER, WATER, WATER)), [0.3, 0.3], [5.3, 5.3], { value: 0 }, { value: 0 }, { value: 0 }), false, 'off: every tile its own');
});

test('COAST-LOOK the silt and the sheet take the ground\'s line where the ground blends, and their own elsewhere: the bed\'s share the water\'s coverage less the wander on a blended transition, the art\'s painted water no fringe there, a tile not blended its own share and its art\'s; the sheet\'s program the same wander and the same table, its shore the coverage less the wander on a blended transition alone (mutants: the bed\'s wander ungated; the fringe kept on a blend; the sheet\'s wander ungated or its sign)', () => {
  const words = packWaterMask(WATER_DRAW_MASK_TABLE);
  const bed = glslFunctions(`uniform sampler2DArray uTileArr;\n${EDGE_NOISE_GLSL}\n${groundWanderGlsl()}\n${WATER_BED_GLSL}`, {
    uGroundEdge: 1, uWaterBed: 1, uSnowArr: [0, 0, 0, 0],
    uBedMask: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [...words.slice(4 * i, 4 * i + 4)]),
    textureGrad: () => [0, 0, 0, 0.9],   // the art paints water everywhere: a fringe wherever it is read
  });
  let shores = 0;
  for (let byte = 0; byte < 256; byte++) {
    const m = WATER_DRAW_MASK_TABLE[byte];
    if (!m || m === 15 || !groundKindsOf(byte)) continue;
    for (const [fx, fy] of [[0.1, 0.2], [0.5, 0.5], [0.8, 0.35]]) {
      const p = [70 + fx, 20 + fy + (byte >> 3)], w = groundEdgeWander(p[0], p[1]), c = waterCoverage(m, fx, fy);
      nearAll(bed.bedCover(byte, [fx, fy], p, [fx, fy, byte >> 2], [0.01, 0], [0, 0.01], 0, true), [smooth(0.3, 0.7, c - w), 0], 1e-12, `byte ${byte} blended: the ground's line, no fringe`);
      const k = smooth(0.3, 0.7, c), art = k < 1 ? smooth(0.3, 0.7, 0.9) : 0;
      nearAll(bed.bedCover(byte, [fx, fy], p, [fx, fy, byte >> 2], [0.01, 0], [0, 0.01], 0, false), [Math.max(k, art), Math.max(art - k, 0)], 1e-12, `byte ${byte} drawn as its art: its own line and its art's water`);
    }
    shores++;
  }
  assert.ok(shores >= 42);
  assert.match(waterBedMix(), /vec2 bedK = bedCover\(data, tileUV, unwrapped, vec3\(tuv, float\(layer\)\), gx, gy, snowC, ge\);/, 'the ground tells the bed which tiles it blended');
  const fs = waterSurfaceFs('');
  const sheet = glslFunctions(fs, { uGroundEdge: 1 });
  for (let y = 0.05; y < D; y += 7.1) for (let x = 0.07; x < D; x += 6.3) near(sheet.geWander([x, y]), groundEdgeWander(x, y), 1e-12, `the sheet's wander at (${x}, ${y})`);
  for (let byte = 0; byte < 256; byte++) assert.equal(sheet.geEntry(byte), GROUND_KIND_TABLE[byte], `the sheet's entry ${byte}`);
  assert.match(fs, /\n {4}edge = smoothstep\(0\.5 - uShoreSoft, 0\.5 \+ uShoreSoft, 0\.5 - 0\.5 \* vCut - \(geEntry\(data\) != 0u \? geWander\(unwrapped\) : 0\.0\)\);/, 'the shore on the ground\'s line where the ground blends it');
  // the sheet and the sand on one line: where the ground's share of land is a half, the sheet's water is a half - the
  // sheet built over a dirt row, a row of the march's edge and a row of water, its cut as the GPU interpolates it
  const edge = convertTile(marchTile(DIRT, DIRT, WATER, WATER)), dirt = convertTile(marchTile(DIRT, DIRT, DIRT, DIRT));
  const rows = new Uint8Array(3 * 3);
  for (let x = 0; x < 3; x++) { rows[x] = dirt; rows[3 + x] = edge; rows[6 + x] = 0; }
  const built = waterBedOf(flatGrid(3, 3, 0), rows, { tileDim: 3 }).sheet, q = built.indices.findIndex((v, i) => i % 12 === 1 && v === 1 * 4 + 1);
  const [c00, c10, c01, c11] = [5, 6, 9, 10].map((i) => built.cut[i]), cc = built.cut[built.indices[q - 1]];
  for (let x = 0.5; x < 20; x += 0.77) {
    for (let fy = 0.02; fy < 1; fy += 0.01) {
      const land = cornerShare(groundKindsOf(edge).mask, x % 1, fy) + groundEdgeWander(x, 50 + fy);
      const sea = 0.5 - 0.5 * fanCut(c00, c10, c01, c11, cc, x % 1, fy) - groundEdgeWander(x, 50 + fy);
      near(land + sea, 1, 1e-12, 'the sea the land\'s complement');
    }
  }
  assert.ok(SHORE_SOFTNESS > GROUND_EDGE.soft, 'the sheet\'s feather wider than the ground\'s rim, about the same line');
});

test('COAST-LOOK DEEP WATERS\' CUT stays inside the clipped tiles: never a point of a tile the mod kept, never along a kept tile\'s seam, every point of a whole-cut quadrant; the line wanders and rounds the staircase; a kept point draws the land beside it, continuous at their seam (mutants: the wander unscaled; the line\'s dial; the early cut dropped; the nearer edge second; the mirror dropped)', () => {
  assert.ok(COAST_CUT.line - COAST_CUT.reach > 0.75 && COAST_CUT.line + COAST_CUT.reach < 1, 'the line within (0.75, 1): a kept corner\'s seam at most 0.75, a whole quadrant 1');
  near(COAST_CUT_WANDER * WANDER_MAX, COAST_CUT.reach, 1e-12, 'the wander carried at reach, its widest');
  let inKept = 0, seam = 0, whole = 0, rounded = 0, boundary = 0;
  const lines = new Map();
  for (let y = 0.0031; y < D; y += 0.0517) for (let x = 0.0047; x < D; x += 0.0793) {
    const cx = Math.floor(x), cy = Math.floor(y), r = coastCutAt(CUT.cutAt, x, y);
    if (!CUT.cutAt(cx, cy)) { assert.equal(r.cut, false, `(${x}, ${y}): a kept tile is never cut`); inKept++; continue; }
    const fx = x - cx, fy = y - cy, sx = fx < 0.5 ? -1 : 1, sy = fy < 0.5 ? -1 : 1;
    if (CUT.cutAt(cx + sx, cy) && CUT.cutAt(cx, cy + sy) && CUT.cutAt(cx + sx, cy + sy)) { assert.equal(r.cut, true, 'a whole-cut quadrant'); whole++; continue; }
    // within a hair of a kept neighbour's seam the point is kept: the line never runs along it
    const dx = sx < 0 ? fx : 1 - fx, dy = sy < 0 ? fy : 1 - fy;
    if ((!CUT.cutAt(cx + sx, cy) && dx < 0.005) || (!CUT.cutAt(cx, cy + sy) && dy < 0.005)) { assert.equal(r.cut, false, `(${x}, ${y}): beside a kept seam`); seam++; }
    if (!r.cut) {
      // the kept point draws the land beside it - at their seam, the very point that land draws there
      const l = mirror(r.from, [x, y]), own = [x - r.from[0], y - r.from[1]];
      for (const i of [0, 1]) if (own[i] >= -0.004 && own[i] <= 1.004) near(l[i], Math.min(1, Math.max(0, own[i])), 0.0081, 'the mirror at the seam');
    }
  }
  assert.ok(inKept > 10000 && whole > 10000 && seam > 30, `the kept land, the open sea and the kept seams sampled (${inKept}, ${whole}, ${seam})`);
  // the line itself: along the straight coast's columns it wanders; along the staircase it is off the tile edges
  for (let x = 0.25; x < 40; x += 0.5) {
    let edgeY = null;
    for (let y = 71; y < 72; y += 0.002) if (coastCutAt(CUT.cutAt, x, y).cut) { edgeY = y; break; }
    assert.ok(edgeY !== null && edgeY - 71 > 0.25 - 0.01 && edgeY - 71 < 0.5 + 0.01, `x ${x}: the cut inside the row's land half (${edgeY})`);
    lines.set(x, edgeY.toFixed(3));
  }
  assert.ok(new Set(lines.values()).size > 20, `the straight coast's line wanders (${new Set(lines.values()).size} depths)`);
  for (let s = 41.5; s < 79; s += 0.37) {
    // walk across the staircase's diagonal (y = x + 30) from the land out to the sea: the first cut point
    for (let k = 0; k < 4; k += 0.004) {
      const x = s + 1 - k * Math.SQRT1_2, y = s + 29 + k * Math.SQRT1_2;
      if (!coastCutAt(CUT.cutAt, x, y).cut) continue;
      boundary++;
      // its distance to the nearest square the mod kept: on the old staircase nought
      let d = Infinity;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = Math.floor(x) + i, cy = Math.floor(y) + j;
        if (CUT.cutAt(cx, cy)) continue;
        d = Math.min(d, Math.hypot(Math.max(cx - x, 0, x - cx - 1), Math.max(cy - y, 0, y - cy - 1)));
      }
      if (d > 0.02) rounded++;
      break;
    }
  }
  assert.ok(boundary > 80 && rounded / boundary > 0.9, `the staircase rounded: its line off the tile edges (${rounded} of ${boundary})`);
});

test('COAST-LOOK THE CUT ENDS TO END: the clip variant of the lane\'s terrain program, switched on, discards exactly where the law cuts and samples a kept point of a clipped tile as the kept tile beside it; switched off, the mod\'s whole tile; the ground\'s cull keeps the coast\'s ring for it - every quad it drops cut at every point, every point kept on a quad it keeps - and off, the mod\'s cull (mutants: the switch\'s arms; the cull\'s ring unread; a neighbour unasked)', () => {
  class Sampled extends Error {}
  let sample = null;
  const f = glslFunctions(terrainClipFs(EL_TERRAIN_FS), {
    vLocalXZ: [0, 0], vWorldPos: [0, 30, 0], vNormal: [0, 1, 0], uTileSize: TILE, uGroundEdge: 1,
    texelFetch: (_s, c) => [CUT.byteAt(c[0], c[1]), 0, 0, 0],
    dFdx: (x) => x.map(() => 0.01), dFdy: (x) => x.map(() => 0.02),
    textureGrad: (_s, p, gx, gy) => { sample = { layer: p[2], uv: p.slice(0, 2), gx, gy }; throw new Sampled(); },
  });
  const frag = (x, y) => {
    f.globals.vLocalXZ = [x * TILE, y * TILE];
    sample = null;
    try { f.main(); } catch (e) { if (e instanceof GlslDiscard) return { discarded: true }; if (e instanceof Sampled) return { discarded: false, ...sample }; throw e; }
    throw new Error('ran to its end without sampling the tile array');
  };
  let cut = 0, kept = 0;
  for (let y = 66.21; y < 112; y += 0.137) for (let x = 0.013; x < D; x += 0.583) {
    const want = coastCutAt(CUT.cutAt, x, y), got = frag(x, y);
    assert.equal(got.discarded, want.cut, `(${x.toFixed(3)}, ${y.toFixed(3)}): the program's cut is the law's`);
    if (want.cut) { cut++; continue; }
    const from = want.from ?? [Math.floor(x), Math.floor(y)], d = CUT.byteAt(...from), l = want.from ? mirror(from, [x, y]) : [x - from[0], y - from[1]];
    assert.equal(got.layer, d >> 2, 'the tile it draws');
    nearAll(got.uv, turned(d & 3, l), 1e-9, 'at its own point, turned');
    if (want.from) kept++;
  }
  assert.ok(cut > 500 && kept > 100, `cut and kept fragments of clipped tiles (${cut}, ${kept})`);
  f.globals.uGroundEdge = 0;
  for (let y = 66.21; y < 112; y += 0.731) for (let x = 0.013; x < D; x += 1.583) assert.equal(frag(x, y).discarded, CUT.cutAt(Math.floor(x), Math.floor(y)), 'off: the mod\'s whole tile');
  // the cull: a quad it drops is cut at every point; a quad it keeps covers every point the law keeps
  for (const stride of [1, 4]) {
    const ring = clippedTerrainIndices(CUT.bytes, stride, true), mod = clippedTerrainIndices(CUT.bytes, stride, false);
    const g = 128 / stride + 1, quads = (idx) => { const s = new Set(); for (let i = 0; i < idx.length; i += 6) if (idx[i] < g * g && idx[i + 1] < g * g) s.add(idx[i]); return s; };
    const keep = quads(ring), keepMod = quads(mod);
    for (let z = 0; z < 128 / stride; z++) for (let x = 0; x < 128 / stride; x++) {
      const has = keep.has(z * g + x);
      let anyKept = false, anyTile = false;
      for (let tz = z * stride; tz < (z + 1) * stride; tz++) for (let tx = x * stride; tx < (x + 1) * stride; tx++) {
        anyTile ||= !CUT.cutAt(tx, tz);
        for (let s = 0.05; s < 1 && !anyKept; s += 0.15) for (let r = 0.05; r < 1 && !anyKept; r += 0.15) anyKept = !coastCutAt(CUT.cutAt, tx + s, tz + r).cut;
      }
      if (anyKept) assert.ok(has, `stride ${stride} quad ${x},${z}: a point the law keeps is drawn`);
      assert.equal(keepMod.has(z * g + x), anyTile, `stride ${stride} quad ${x},${z}: off, the mod's own cull`);
    }
    assert.ok(keep.size > keepMod.size, `stride ${stride}: the ring kept (${keep.size} quads against ${keepMod.size})`);
  }
  const whole = new Uint8Array(D * D).fill(CLIP_SENTINEL);
  assert.equal(clippedTerrainIndices(whole, 1, true).length, 0, 'a sea cut whole keeps nothing');
});

test('COAST-LOOK both terrain programs draw a transition as its two kinds right after their own tile - the lane decoding the kinds as its own - each kind taking the border\'s neighbours by its own record and the snow\'s winter twin by the same, the bed told; the clip variant one line, its switch\'s arms the cut and the mod\'s; the renderer\'s switch a frame\'s for the ground and the sheet, taken as the renderer is made from coastEdgesOn - the enhanced skin, the kill door; no host\'s own line but the cull\'s (mutants: the blend dropped from either program; the lane\'s kinds undecoded; the snow\'s kinds; the switch never uploaded, the sheet\'s never; the renderer never taking it; the classic skin blended; the kill door unread; the cull told nothing)', () => {
  const r = read('src/render/renderer.js');
  const classic = r.slice(r.indexOf('const TERRAIN_FS = `'), r.indexOf('}`;', r.indexOf('const TERRAIN_FS = `')));
  assert.match(classic, /\n\$\{roadEdgeGlsl\(\)\}\n\$\{groundEdgeGlsl\(\)\}[^\n]*\n\$\{WATER_BED_GLSL\}\nvoid main\(\) \{/, 'the classic chunk after ROAD-LOOK\'s, before the bed that reads its wander');
  assert.ok(EL_TERRAIN_FS.includes(`${roadEdgeGlsl('elDecode')}\n${groundEdgeGlsl('elDecode')}`), 'the lane\'s, its kinds in its own linear light');
  assert.match(EL_TERRAIN_FS, /vec3 geBase\(highp uint k, vec2 f, vec2 dux, vec2 duy\) \{ return elDecode\(textureGrad\(uTileArr, vec3\(f, float\(k\)\), dux, duy\)\.rgb\); \}/);
  const BLOCK = String.raw`\n {2}highp uint geA, geB; float geS;\n {2}bool ge = groundMix\(data, tileUV, unwrapped, geA, geB, geS\);\n {2}vec2 dux = transpose\(ROT\[t\]\) \* gx, duy = transpose\(ROT\[t\]\) \* gy;[^\n]*\n {2}vec4 ew = ecoWeights\(vLocalXZ\);[^\n]*\n {2}if \(ge\) tex = mix\(ecotone\(geBase\(geA, tileUV, dux, duy\), ew, vec3\(tileUV, float\(geA\)\), dux, duy\), ecotone\(geBase\(geB, tileUV, dux, duy\), ew, vec3\(tileUV, float\(geB\)\), dux, duy\), geS\);\n {2}tex = roadEdge\(`;
  const SNOW = String.raw`\n {2}tex = ge \? mix\(snowGround\(tex, ew, snowC, vec3\(tileUV, float\(geA\)\), dux, duy\), snowGround\(tex, ew, snowC, vec3\(tileUV, float\(geB\)\), dux, duy\), geS\) : snowGround\(tex, ew, snowC, vec3\(tuv, float\(layer\)\), gx, gy\);\n`;
  for (const [name, fs] of [['classic', classic], ['lane', EL_TERRAIN_FS]]) {
    assert.match(fs, new RegExp(`\\.rgb\\)?;\\n {2}//[^\\n]*\\n {2}//[^\\n]*${BLOCK}`), `${name}: the kinds right after the tile, each with its neighbours' share`);
    assert.match(fs, new RegExp(SNOW), `${name}: each kind's winter twin`);
    assert.match(fs, /\n {2}if \(!ge\) tex = ecotone\(tex, ew, vec3\(tuv, float\(layer\)\), gx, gy\);/, `${name}: every other tile its neighbours' share as before`);
  }
  const clip = terrainClipFs(EL_TERRAIN_FS);
  assert.equal(clip.split('\n').length, EL_TERRAIN_FS.split('\n').length + 1, 'the clip still one line');
  assert.match(clip, new RegExp(String.raw`\n {2}if \(uGroundEdge > 0\.0 \? coastCut\(unwrapped, data, layer, t, tileUV, tuv, gx, gy\) : data == ${CLIP_SENTINEL}u\) discard;`), 'its arms: the wandering cut, the mod\'s whole tile');
  assert.match(r, /this\.tUGroundEdge = gl\.getUniformLocation\(this\.terrainProgram, 'uGroundEdge'\);/);
  assert.match(r, /gl\.uniform1f\(this\.tUGroundEdge, this\.coastEdges \? 1 : 0\);/);
  assert.match(r, /groundEdge: u\('uGroundEdge'\)/, 'the sheet\'s location');
  assert.match(r, /gl\.uniform1f\(L\.groundEdge, this\.coastEdges \? 1 : 0\);/, 'the sheet\'s upload');
  assert.match(r, /\n {2}coastEdges = coastEdgesOn\(\);\n/, 'the renderer takes the page\'s switch as it is made (a new skin reloads the page)');
  const world = read('src/scenes/world.js');
  assert.doesNotMatch(world, /coastEdgesOn/);
  assert.deepEqual(world.match(/renderer\.coastEdges/g), ['renderer.coastEdges'], 'the host\'s one read: the cull\'s ring');
  assert.match(world, /clippedTerrainIndices\(p\._dwBytes, p\._stride \?\? 1, renderer\.coastEdges\)/);
  assert.doesNotMatch(read('src/scenes/exterior.js'), /coastEdges|coastEdgesOn/, 'src/scenes/exterior.js: no host\'s own line');
  assert.deepEqual([coastEdgesOn('?skin=enhanced'), coastEdgesOn('?skin=enhanced&coastedges=off'), coastEdgesOn('?skin=classic'), coastEdgesOn('?skin=classic&coastedges=on')], [true, false, false, false], 'the enhanced skin\'s, the kill door its own');
});

// ── WITH ARENA2: the freeware's own coasts ──────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA'].every((f) => existsSync(join(ARENA2, f)));
test('COAST-LOOK on the freeware\'s coasts, in the Bay and past it: no cell puts the sea against grass or stone, every two-kind cell\'s byte its entry with the cell\'s own corners, and the blend continuous across every seam between them (the rare dirt-against-stone cell and the rarer three-kind one Daggerfall draws as one picture, as the art does) (mutants: the table\'s kinds; the bilinear\'s corner)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit, inBay } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundMaps, groundWoods } = await import('../../src/world/tamriel/tamrielGround.js');
  const { generateSamples, HEIGHTMAP_DIMENSION } = await import('../../src/world/terrain/terrainSampler.js');
  const { generateTileData } = await import('../../src/world/terrain/terrainTiles.js');
  const { createLandforms, landformClimates } = await import('../../src/world/landforms.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const raw = new WoodsFile(); raw.load(bytes('WOODS.WLD'));
    const woods = groundWoods(raw);
    const landforms = createLandforms({ woods, climates: landformClimates((x, y) => maps.getClimateIndex(x, y)) });
    const places = { bay: 0, past: 0 };
    let shore = 0, two = 0, seams = 0, odd = 0;
    for (const [px, py] of [[509, 151], [354, 182], [819, 213], [478, -252], [881, 709], [1408, -407]]) {
      const td = generateTileData(generateSamples(woods, px, py, HEIGHTMAP_DIMENSION, landforms), px, py), b = bytesOf(td);
      places[inBay(px, py) ? 'bay' : 'past']++;
      const plain = new Uint8Array(D * D);   // a cell of one kind or two neighbouring ones, its byte the law's
      for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
        const c = cornersOf(td, x, y), k = [...new Set(c)].sort();
        if (k.includes(WATER)) assert.ok(k.every((v) => v <= DIRT), `${px},${py} cell ${x},${y}: the sea meets only a beach (${k})`);
        if (k.length === 1) { plain[x + y * D] = 1; continue; }
        if (k.length > 2 || k[1] - k[0] !== 1) { odd++; continue; }
        const g = groundKindsOf(b[x + y * D]), mask = c.reduce((m, v, i) => m | ((v === g?.b ? 1 : 0) << i), 0);
        assert.ok(g && [g.a, g.b].sort().join() === k.join() && g.mask === mask, `${px},${py} cell ${x},${y}: its corners (${c})`);
        plain[x + y * D] = 1; two++;
        if (k[0] === WATER) shore++;
      }
      for (const { left, right, at } of seamPoints(0.113)) {
        if (!plain[left[0] + left[1] * D] || !plain[right[0] + right[1] * D]) continue;
        const wl = weights(b[left[0] + left[1] * D], left[2], left[3], at[0], at[1]), wr = weights(b[right[0] + right[1] * D], right[2], right[3], at[0], at[1]);
        if (!wl || !wr) continue;   // a road's or a town's own art
        nearAll(wl, wr, 1e-12, `${px},${py}: the seam at (${at[0].toFixed(3)}, ${at[1].toFixed(3)})`);
        seams++;
      }
    }
    assert.ok(places.bay >= 3 && places.past >= 3, 'the Bay and past it');
    assert.ok(shore > 800 && two > 3000 && seams > 500000, `the coasts measured (${shore} shore cells, ${two} two-kind cells, ${seams} seam points)`);
    assert.ok(odd * 100 < two, `the cells Daggerfall draws as one picture rare (${odd} of ${two + odd})`);
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
