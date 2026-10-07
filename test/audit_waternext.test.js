// AUDIT WATER-NEXT (2026-10-07, Mac: "I want you to do a comprehensive audit ensuring this is perfection and performance is
// unaffected"): WATER-NEXT 2-4 and PUDDLE-DRY (#674) audited - three lenses (the GL and the shader, the hosts and the
// world's lifecycle, the record and the pins) and a performance lens measured against main. One test a finding group;
// each names the ids it holds (bible/01-Overview/Audit-WATER-NEXT.md). Mutants: tools/mutants/audit_waternext.json.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  waterBedDepths, sheetDepthsOf, flatGrid, bedHalo, bedNearEdge, carveBed, bedProfile,
  BED_DEPTH, BED_RAMP, TILE_UNITS, NO_BED_DEPTH, SHEET_NO_BED, BED_HALO_TILES,
} from '../src/world/waterBed.js';
import { gridBed } from '../src/world/terrainGen.js';
import { generateTileData, assignTiles, tileDataAt, marchTile, createLookupTable, GROUND_RECORD_LIMIT } from '../src/world/terrainTiles.js';
import { convertTilemap, CLIP_SENTINEL } from '../src/world/terrainSurface.js';
import { WATER_DRAW_MASK_TABLE, packWaterMask } from '../src/world/waterCorners.js';
import { SCALED_OCEAN_ELEVATION, MAX_TERRAIN_HEIGHT, HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import {
  createRipples, createRippleStir, stirOf, RIPPLE_CELLS, RIPPLE_SPAN, RIPPLE_HZ, RIPPLE_DAMPING, RIPPLE_SCALE,
  STIR_PERIOD, BOAT_STIR, BOAT_WAKE_SPEED,
} from '../src/world/waterRipples.js';
import {
  waterSurfaceFs, WATER_SURFACE_VS, waterUniforms, SWELL_TRAINS, SWELL_CALM, SWELL_GALE, SWELL_DEPTH, SWELL_REACH,
  WATER_ABSORB, REFRACT_STRENGTH, FOAM_DEPTH, FOAM_RUNUP, CREST_SLOPE, OPEN_PATH, WATER_TINT, WATER_F0, SHORE_SOFTNESS,
} from '../src/render/waterSurface.js';
import { BED_SILT, BED_RECORD } from '../src/render/waterBedGlsl.js';
import { CLOUD_SHADOW_GLSL } from '../src/render/cloudShadow.js';
import { perspective, mirrorProjectionX } from '../src/world/mat4.js';
import { dryPuddles, groundTileWet } from '../src/world/puddleDry.js';
import { Renderer } from '../src/render/renderer.js';
import { glslFunctions } from './glsl.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DRY = 1 << 2;   // a converted grass-less dirt byte: record 1, no water corner

/** The bed's depth pass as WATER-NEXT 2 shipped it, written out here as the reference the faster pass must equal. */
function referenceDepths(bytes, { stride = 1, tileDim = 128, width = tileDim, height = tileDim, table = WATER_DRAW_MASK_TABLE } = {}) {
  const gx = width / stride + 1, gz = height / stride + 1, n = gx * gz;
  const wet = new Uint8Array(n);
  let any = false;
  const VOTES = [[-1, -1, 8], [0, -1, 4], [-1, 0, 2], [0, 0, 1]];
  for (let vz = 0; vz < gz; vz++) {
    for (let vx = 0; vx < gx; vx++) {
      let votes = 0, ok = true;
      for (const [dx, dz, bit] of VOTES) {
        const tx = vx * stride + dx, tz = vz * stride + dz;
        if (tx < 0 || tz < 0 || tx >= width || tz >= height) continue;
        votes++;
        if (!(table[bytes[tz * tileDim + tx]] & bit)) { ok = false; break; }
      }
      if (ok && votes) { wet[vz * gx + vx] = 1; any = true; }
    }
  }
  if (!any) return null;
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = wet[i] ? 1e9 : 0;
  const relax = (i, j, w) => { if (d[j] + w < d[i]) d[i] = d[j] + w; };
  for (let z = 0; z < gz; z++) for (let x = 0; x < gx; x++) {
    const i = z * gx + x; if (!wet[i]) continue;
    if (x > 0) relax(i, i - 1, 3);
    if (z > 0) { relax(i, i - gx, 3); if (x > 0) relax(i, i - gx - 1, 4); if (x < gx - 1) relax(i, i - gx + 1, 4); }
  }
  for (let z = gz - 1; z >= 0; z--) for (let x = gx - 1; x >= 0; x--) {
    const i = z * gx + x; if (!wet[i]) continue;
    if (x < gx - 1) relax(i, i + 1, 3);
    if (z < gz - 1) { relax(i, i + gx, 3); if (x < gx - 1) relax(i, i + gx + 1, 4); if (x > 0) relax(i, i + gx - 1, 4); }
  }
  const unit = (stride * TILE_UNITS) / 3, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = wet[i] ? BED_DEPTH * bedProfile(Math.min(d[i], 1e9) * unit / BED_RAMP) : 0;
  return out;
}

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

test('AUDIT WATER-NEXT P1: the bed is the kernel\'s - carved with the grid by restrideGrid (the build, the promotion and the restride on the worker), its depth pass the shipped one to the bit and none of it on the host\'s thread (mutants: the host carving again; the votes reordered; the worker\'s transfer dropped)', () => {
  for (let trial = 0; trial < 60; trial++) {
    const b = new Uint8Array(128 * 128), p = rnd();
    for (let i = 0; i < b.length; i++) b[i] = rnd() < p ? (rnd() < 0.6 ? 0 : ((Math.floor(rnd() * 56)) << 2) | Math.floor(rnd() * 4)) : DRY;
    for (const stride of [1, 2, 4, 8]) {
      for (const [width, height] of [[128, 128], [80, 48]]) {
        assert.deepEqual(waterBedDepths(b, { stride, width, height }), referenceDepths(b, { stride, width, height }), `trial ${trial}, stride ${stride}, ${width}x${height}`);
      }
    }
  }
  // the kernel's one grid law carries it; the answer's shape is the host's
  const k = rd('src/world/terrainGen.js');
  assert.match(k, /const halo = bed && stride === 1 && bedNearEdge\(bed\) \? bedHalo\(ghost, px, py\) : null;\n\s*return \{ positions: grid\.positions, normals: grid\.normals, bed: bed \? gridBed\(grid, bed, stride, halo\) : null \};/);
  assert.match(k, /const grid = restrideGrid\(\{ woods, px, py, stride, samples, landforms, bed: bed \? tilemapBytes : null \}\);/, 'the build\'s grid carves by its own TileMap');
  const g = flatGrid(128, 128, 0);
  const sea = new Uint8Array(128 * 128), kb = gridBed(g, sea, 1);
  assert.deepEqual(Object.keys(kb).sort(), ['depths', 'halo', 'normals', 'positions', 'sheetDepths']);
  assert.ok(kb.depths.every((d) => d === BED_DEPTH) && kb.sheetDepths.every((d) => d === BED_DEPTH), 'open water with no bank is deep everywhere');
  assert.equal(kb.positions[1], -BED_DEPTH, 'the carved ground'); assert.equal(g.positions[1], 0, 'the grid as it stood');
  assert.equal(gridBed(g, new Uint8Array(128 * 128).fill(DRY), 1), null, 'no water, no bed');
  const wk = rd('src/world/terrainGenWorker.js');
  assert.equal((wk.match(/bed\.depths\.buffer, (?:out\.)?bed\.sheetDepths\.buffer, (?:out\.)?bed\.positions\.buffer, (?:out\.)?bed\.normals\.buffer/g) || []).length, 2, 'both replies transfer the bed - none copied across the wire');
  assert.match(rd('src/world/terrainGenClient.js'), /g\.resolve\(\{ positions: m\.positions, normals: m\.normals, bed: m\.bed \?\? null \}\);/, 'the promotion\'s answer keeps it');
  const w = rd('src/scenes/world.js');
  assert.doesNotMatch(w, /waterBedOf\(/, 'the streaming host carves nothing on its own thread');
  assert.match(w, /bed: waterOn,   \/\/ AUDIT WATER-NEXT P1/, 'the build asks the kernel');
  assert.match(w, /terrainGen\.grid\(\{ px: p\.px, py: p\.py, stride: 1, samples: p\.samples, landform, bed: bedBytes \}\)/, 'the promotion asks the worker');
  assert.match(w, /roads: terrainGen\.roads\(\), bed: waterOn \? bedBytesOf\(p\) : null \}\)\) \{/, 'the restride asks the kernel');
});

test('AUDIT WATER-NEXT H1: Deep Waters\' cap carves the bed - a tile it repaints is ground and a tile it clips votes dry, the bed carved again from the grid as it stood when the cap\'s TileMap lands or lifts (mutants: no re-carve; the build\'s bytes kept; a clipped tile carved under the mod\'s floor)', () => {
  // a 6-tile-wide river across an 8-tile pixel: carved; the cap repaints three columns of it with ground
  const T = 16, river = new Uint8Array(T * T).fill(DRY);
  for (let z = 0; z < T; z++) for (let x = 5; x < 11; x++) river[z * T + x] = 0;
  const before = waterBedDepths(river, { tileDim: T });
  assert.ok(before[8 * 17 + 8] > 1, 'the river is carved');
  const repainted = Uint8Array.from(river);
  for (let z = 0; z < T; z++) for (let x = 5; x < 8; x++) repainted[z * T + x] = DRY;
  const after = waterBedDepths(repainted, { tileDim: T });
  for (let z = 0; z <= T; z++) for (let x = 0; x <= 7; x++) assert.equal(after[z * 17 + x], 0, `a repainted tile's vertex (${x}, ${z}) is ground, not a pit`);
  assert.equal(WATER_DRAW_MASK_TABLE[CLIP_SENTINEL], 0, 'the clipped texel is no water to the draw');
  const clipped = Uint8Array.from(river);
  for (let z = 0; z < T; z++) clipped[z * T + 10] = CLIP_SENTINEL;
  const c = waterBedDepths(clipped, { tileDim: T });
  for (let z = 0; z <= T; z++) assert.equal(c[z * 17 + 10], 0, 'the bed comes up to its bank at the clip\'s edge, where the mod\'s floor meets the shore');
  const w = rd('src/scenes/world.js');
  assert.match(w, /entry\._dwBytes = bytes === entry\.tilemapBytes \? null : bytes;\n\s*dwRecarve\(entry\);[^\n]*\n\s*dwClipTerrain\(entry\);\n\s*dwWaterSurface\(entry\);/, 'the cap carves, then clips, then re-indexes');
  assert.match(w, /function bedBytesOf\(p\) \{ return p\._dwBytes \?\? p\.tilemapBytes; \}/);
  const recarve = w.slice(w.indexOf('  function dwRecarve(p) {'), w.indexOf('  function hostBed(grid, bed)'));
  assert.match(recarve, /const depths = waterBedDepths\(bedBytesOf\(p\), \{ stride, halo \}\);/);
  assert.match(recarve, /const grid = \{ positions: p\._bed\.sheet, normals: p\._bed\.normals \};/, 'from the grid as it stood');
  assert.match(recarve, /renderer\.destroyMesh\(p\.terrain\);\n\s*p\.terrain = renderer\.createTerrainSurface\(bed\?\.positions \?\? grid\.positions, bed\?\.normals \?\? grid\.normals,/);
  assert.match(recarve, /p\._bed = \{ sheet: grid\.positions, normals: grid\.normals, depths: bed\?\.depths \?\? null, sheetDepths: bed\?\.sheetDepths \?\? null, halo \};/, 'the grid kept, so a lifted cap carves it back');
  assert.match(w, /const bed = waterOn \? hostBed\(grid, grid\.bed\) : null;/, 'the restride keeps the kernel\'s bed - no carved copy held on the host');
});

test('AUDIT WATER-NEXT F2: a seam\'s vertex is carved alike on both sides - the bed reads the neighbour\'s tiles past the edge, classified and marched by the neighbour\'s own law from its own kernel (mutants: no halo; the neighbour\'s jitter by this pixel\'s index; the south neighbour taken for the north)', () => {
  const H = HEIGHTMAP_DIMENSION;
  let withHalo = 0, without = 0, compared = 0;
  for (let trial = 0; trial < 6; trial++) {
    const px = 300 + trial, py = 200;
    const blobs = [];
    for (let i = 0; i < 6; i++) blobs.push([px * 128 + 128 + (rnd() - 0.5) * 30, -py * 128 + rnd() * 128, 4 + rnd() * 10]);
    for (let i = 0; i < 4; i++) blobs.push([px * 128 + rnd() * 128, -py * 128 + (rnd() - 0.5) * 30, 4 + rnd() * 10]);
    const K = (wx, wz) => {
      let v = 1;
      for (const [cx, cz, r] of blobs) v = Math.min(v, (Math.hypot(wx - cx, (wz - cz) * 1.3) - r) / 10);
      const h = v < 0 ? SCALED_OCEAN_ELEVATION : SCALED_OCEAN_ELEVATION + v * 12;
      return Math.min(1, h / MAX_TERRAIN_HEIGHT);
    };
    const pix = (qx, qy) => {
      const hm = new Float32Array(H * H);
      for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) hm[x * H + y] = K(qx * 128 + x, -qy * 128 + y);
      const tm = new Uint8Array(128 * 128);
      assignTiles(generateTileData(hm, qx, qy), tm, true);
      return { bytes: convertTilemap(tm), ghost: (x, y) => K(qx * 128 + x, -qy * 128 + y) };
    };
    const A = pix(px, py), E = pix(px + 1, py), S = pix(px, py + 1);
    assert.ok(bedNearEdge(A.bytes), 'the water reaches the seam');
    const dA = waterBedDepths(A.bytes, { halo: bedHalo(A.ghost, px, py) });
    const dE = waterBedDepths(E.bytes, { halo: bedHalo(E.ghost, px + 1, py) });
    const dS = waterBedDepths(S.bytes, { halo: bedHalo(S.ghost, px, py + 1) });
    const nA = waterBedDepths(A.bytes), nE = waterBedDepths(E.bytes);
    const at = (d, x, z) => (d ? d[z * 129 + x] : 0);
    for (let z = 0; z <= 128; z++) {
      compared++;
      withHalo = Math.max(withHalo, Math.abs(at(dA, 128, z) - at(dE, 0, z)));
      without = Math.max(without, Math.abs(at(nA, 128, z) - at(nE, 0, z)));
    }
    for (let x = 0; x <= 128; x++) withHalo = Math.max(withHalo, Math.abs(at(dA, x, 0) - at(dS, x, 128)));
  }
  assert.ok(compared > 700);
  assert.equal(withHalo, 0, 'both pixels carve every seam vertex to one depth');
  assert.ok(without > 1, `alone, they parted by ${without.toFixed(2)} units - the crack this closes`);
  // the neighbour's corner is its own: its index's jitter and its latitude
  assert.equal(tileDataAt(SCALED_OCEAN_ELEVATION, 3, 5, 10, 10), 0, 'water by its height alone');
  assert.equal(BED_HALO_TILES, 4, 'the ramp\'s three tiles and the vote\'s one');
  const k = rd('src/world/waterBed.js');
  assert.match(k, /v = tileDataAt\(sampleHeight\(Math\.fround\(ghost\(x, z\)\)\), x - dx \* side, z \+ dz \* side, px \+ dx, py \+ dz\);/);
  assert.match(k, /const dz = tz < 0 \? 1 : tz >= side \? -1 : 0;/, 'the map\'s Y runs south (terrainSampler.js ghostSampler)');
  // the march is AssignTilesJob's (TerrainHelper's): the shape the four corners' low bits, the ring their sum over four
  const LUT = createLookupTable();
  for (let k = 0; k < 256; k++) {
    const b = [k & 3, (k >> 2) & 3, (k >> 4) & 3, (k >> 6) & 3];
    const shape = (b[0] & 1) | ((b[1] & 1) << 1) | ((b[2] & 1) << 2) | ((b[3] & 1) << 3);
    assert.equal(marchTile(...b), LUT[shape | (((b[0] + b[1] + b[2] + b[3]) >> 2) << 4)], `corners ${b}`);
  }
  const td = new Uint8Array(129 * 129); for (let i = 0; i < td.length; i++) td[i] = Math.floor(rnd() * 4);
  const tm = new Uint8Array(128 * 128); assignTiles(td, tm, true);
  for (let i = 0; i < 400; i++) {
    const x = Math.floor(rnd() * 128), y = Math.floor(rnd() * 128), j = x + y * 129;
    assert.equal(tm[y * 128 + x], marchTile(td[j], td[j + 1], td[j + 129], td[j + 130]), 'the job marches with it');
  }
  // where the water keeps off the edges, no neighbour is read
  const inland = new Uint8Array(128 * 128).fill(DRY); inland[64 * 128 + 64] = 0;
  assert.equal(bedNearEdge(inland), false);
  inland[3 * 128 + 64] = 0;
  assert.equal(bedNearEdge(inland), true);
  const east = new Uint8Array(128 * 128).fill(DRY); east[64 * 128 + 125] = 0;
  assert.equal(bedNearEdge(east), true, 'a middle row\'s east edge too');
});

test('AUDIT WATER-NEXT H2: the sheet\'s own depths - a vertex the carve reaches keeps its depth, its bank 0, and water on ground never carved NO_BED_DEPTH negated, which the shader reads as tint with no swell (mutants: the stream given the carve\'s 0; the swell on uncarved ground; the constant positive)', () => {
  const T = 16, b = new Uint8Array(T * T).fill(DRY);
  for (let z = 4; z < 12; z++) for (let x = 2; x < 8; x++) b[z * T + x] = 0;   // a pond, carved
  for (let z = 0; z < T; z++) b[z * T + 13] = 0;                               // a one-tile stream across the pixel
  const d = waterBedDepths(b, { tileDim: T });
  const s = sheetDepthsOf(d, 17, 17);
  assert.ok(s[8 * 17 + 5] > 0 && s[8 * 17 + 5] === d[8 * 17 + 5], 'the pond\'s heart keeps the carve\'s depth');
  assert.equal(s[4 * 17 + 3], 0, 'its bank is 0 - the shore\'s foam');
  for (let z = 1; z < 16; z++) assert.equal(s[z * 17 + 13], Math.fround(SHEET_NO_BED), `the stream's vertex ${z} is uncarved water (a Float32Array's)`);
  assert.equal(SHEET_NO_BED, -NO_BED_DEPTH);
  assert.equal(NO_BED_DEPTH, 1.2);
  assert.match(WATER_SURFACE_VS, /float grow = uOpen == 1 \? 1\.0 : \(aDepth < 0\.0 \? 0\.0 : smoothstep\(0\.0, 2\.50, aDepth\)\);/);
  assert.match(WATER_SURFACE_VS, /vDepth = max\(abs\(aDepth\) \+ lift, 0\.0\);/);
  assert.match(rd('src/render/renderer.js'), /gl\.vertexAttrib1f\(1, -NO_BED_DEPTH\);/, 'a sheet with no bed at all: the same constant');
  const w = rd('src/scenes/world.js');
  assert.match(w, /function waterSheetOf\(bed, terrain\) \{ return bed\?\.depths \? \{ positions: bed\.sheet, depths: bed\.sheetDepths \} : \{ terrain \}; \}/);
  assert.match(rd('src/scenes/exterior.js'), /\{ positions: townBed\.sheet, depths: townBed\.sheetDepths \}/);
});

/** The water's fragment shader on the repo's GLSL evaluator, the pixel composed as the blend composes it. */
function shade({ dist, waterDepth, sceneOn, scene, sun = 0, wind = 0 }) {
  const fs = waterSurfaceFs(CLOUD_SHADOW_GLSL);
  const proj = mirrorProjectionX(perspective(1.2, 16 / 9, 0.2, 6000));
  const win = (z) => ((proj[10] * -z + proj[14]) / z) * 0.5 + 0.5;
  const mask = packWaterMask(WATER_DRAW_MASK_TABLE), words = [];
  for (let i = 0; i < 8; i++) words.push([mask[i * 4], mask[i * 4 + 1], mask[i * 4 + 2], mask[i * 4 + 3]]);
  const wp = [10.5, 0, 10.5], cam = [wp[0], wp[1] + dist, wp[2]];
  const bed = win(dist + waterDepth);
  const sample = (s) => (s === 'uSceneDepth' ? [bed, 0, 0, 1] : s === 'uScene' ? [...scene, 1] : s === 'uRipple' ? [0.5, 0, 0, 1] : [0.2, 0.35, 0.45, 1]);
  const fns = glslFunctions(fs, {
    texelFetch: () => [0, 0, 0, 0], textureLod: sample, texture: sample, textureGrad: () => [0, 0, 0, 1],
    dFdx: (x) => (Array.isArray(x) ? x.map(() => 0.01) : 0.01), dFdy: (x) => (Array.isArray(x) ? x.map(() => 0.01) : 0.01),
    vWorldPos: wp, vLocalXZ: [wp[0], wp[2]], vDepth: waterDepth, vGrow: 1,
    uTileSize: 6.4, uTileDim: 128, uWaterMask: words, uOpen: 0, uOpenColor: [1, 1, 1],
    uTime: 0, uWindDir: [1, 0], uWindStrength: wind, uSwell: 0, uRain: 0,
    uLightDir: [0, 1, 0], uAmbient: [0.5, 0.5, 0.5], uSunScale: sun, uSunColor: [1, 0.95, 0.9],
    uMoonDir: [0, 1, 0], uMoonScale: 0, uMoonColor: [0, 0, 0],
    uPointCount: 0, uPointLights: Array(16).fill([0, 0, 0, 1]), uPointColors: Array(16).fill([0, 0, 0]),
    uIndirect: [0, 0, 0, 0], uIndirectColor: [0, 0, 0],
    uSkyZenith: [0.3, 0.5, 0.9], uSkyHorizon: [0.7, 0.8, 0.9], uTint: WATER_TINT, uF0: WATER_F0, uShoreSoft: SHORE_SOFTNESS,
    uAbsorb: WATER_ABSORB, uSceneOn: sceneOn, uSceneSize: [1920, 1080], uProj: Array.from(proj),
    uRippleOn: 0, uRippleRect: [0, 0, 48], uCloudShadowRect: [0, 0, 0, 0],
    uFogColor: [0.7, 0.75, 0.8], uFogMode: 1, uFogDensity: 0, uFogRange: [0, 2400], uCamPos: cam, uFocus: [0, 0, 0, 0],
    uDwFog: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    gl_FragCoord: [960, 540, win(dist), 1],
  });
  fns.main();
  const o = fns.globals.outColor;
  return [0, 1, 2].map((i) => o[i] * o[3] + scene[i] * (1 - o[3]));   // SRC_ALPHA, ONE_MINUS_SRC_ALPHA over the frame
}

test('AUDIT WATER-NEXT G1/G3: the water composes premultiplied - what is seen through it is fogged once, as its bank is, and a glint and the foam are as strong without the copy as with it (mutants: the copy fogged again; the glint divided out of the blend; the foam\'s alpha off the reduced edge)', () => {
  const G = [0.4, 0.3, 0.2], fogC = [0.7, 0.75, 0.8];
  for (const dist of [100, 800, 1600]) {
    const f = (2400 - dist) / 2400;
    const bank = G.map((g, i) => f * g + (1 - f) * fogC[i]);   // the ground beside it, fogged once by its own pass
    const full = shade({ dist, waterDepth: 0.05, sceneOn: 1, scene: bank });
    const simple = shade({ dist, waterDepth: 0.05, sceneOn: 0, scene: bank });
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(full[i] - bank[i]) < 0.03, `Full at ${dist}: ${full[i].toFixed(3)} against the bank's ${bank[i].toFixed(3)} - not fogged twice`);
      assert.ok(Math.abs(full[i] - simple[i]) < 0.03, `Full and Simple agree at ${dist}`);
    }
  }
  const S = [0.2, 0.2, 0.2];
  for (const depth of [0.05, 3.0]) {
    const glint = (sceneOn) => {
      const a = shade({ dist: 20, waterDepth: depth, sceneOn, scene: S, sun: 1 }), b = shade({ dist: 20, waterDepth: depth, sceneOn, scene: S, sun: 0 });
      return a[0] - b[0];
    };
    const gf = glint(1), gs = glint(0);
    assert.ok(gf > 1, `Full's glint ${gf.toFixed(2)}`);
    assert.ok(Math.abs(gs - gf) / gf < 0.1, `Simple's glint ${gs.toFixed(2)} against Full's ${gf.toFixed(2)} over ${depth} units`);
  }
  const fs = waterSurfaceFs('');
  assert.match(fs, /own = mix\(own, foamLit, k\); trans \*= 1\.0 - k; cover = mix\(cover, 1\.0, k\);/, 'the foam hides what is under it, in both');
  assert.match(fs, /outColor = uSceneOn == 1 \? vec4\(under \* trans \+ fogged, edge\) : vec4\(fogged \/ max\(cover, 1e-3\), edge \* cover\);/);
  assert.doesNotMatch(fs, /edge \*= a;/, 'no edge reduced before the foam reads it');
});

test('AUDIT WATER-NEXT G2/G11/G12/G14: the sea takes its own copy; a copy forgets the units\' shadows; a frame starts with no ripple field; a resolve drops the copy (mutants: the sea\'s stale copy; the shadow kept; the field carried over; the copy kept past the resolve)', () => {
  const r = rd('src/render/renderer.js');
  const sea = r.slice(r.indexOf('  drawSeaSurfaces(list, liftY, u, color, arrayTex) {'));
  assert.ok(sea.indexOf('this._underWater = undefined;') > 0 && sea.indexOf('this._underWater = undefined;') < sea.indexOf('this._waterFrameBlock(L, u, 1, liftY);'), 'a fresh copy, before the sea\'s frame block takes one');
  const begin = r.slice(r.indexOf('beginFrame(proj, view, lightDir, opts = null) {'), r.indexOf('beginFrame(proj, view, lightDir, opts = null) {') + 6000);
  assert.match(begin, /this\._frameStamp\+\+;   \/\/ PERF3\n\s*this\._ripples = null;/, 'beginFrame: no field but this frame\'s');
  const comp = r.slice(r.indexOf('  _compositeAir() {'), r.indexOf('  _compositeAir() {') + 1600);
  assert.ok(comp.indexOf('this._underWater = undefined;') > comp.indexOf('if (!this._air?.pending) return;'), 'dropped at the resolve');
  // behaviour, on a bare renderer: a capture forgets the units it may have touched; a field is handed as itself
  const bare = Object.create(Renderer.prototype);
  Object.assign(bare, { _air: { snapshotUnderWater: () => ({ color: 1, depth: 2, w: 4, h: 4 }), snapshotAoDepth: () => true }, _frameFbo: {}, waterSimple: false, _underWater: undefined, _tex0Bound: 'T0', _tex1Bound: 'T1' });
  bare.captureUnderWater();
  assert.equal(bare._tex0Bound, null); assert.equal(bare._tex1Bound, null);
  bare._tex0Bound = 'T0'; bare.captureUnderWater();
  assert.equal(bare._tex0Bound, 'T0', 'once a frame: the second ask takes nothing');
  bare.snapshotAoDepth();
  assert.equal(bare._tex0Bound, null, 'the AO\'s copy too');
  const field = createRipples();
  bare.setWaterRipples(field, RIPPLE_SPAN, RIPPLE_CELLS);
  assert.equal(bare._ripples, field, 'the field itself, no object a frame');
  bare.setWaterRipples(null);
  assert.equal(bare._ripples, null);
});

test('AUDIT WATER-NEXT M1/G13/P2: a field with live rings slides with the eye and still falls asleep, its edge still water; the texture is placed where its bytes were packed; asleep, a slide costs nothing (mutants: the slide onto the edge; the origin for the packed corner; the asleep slide)', () => {
  const r = createRipples();
  r.recenter(0, 0);
  r.disturb(0, 0, 0.1, 1);
  for (let i = 0; i < 20; i++) r.step(1 / RIPPLE_HZ + 1e-9);
  for (let k = 1; k <= 30; k++) { r.recenter(k * 0.5, 0); r.step(1 / RIPPLE_HZ + 1e-9); }
  let steps = 0;
  while (!r.asleep() && steps < 3000) { r.step(1 / RIPPLE_HZ + 1e-9); steps++; }
  assert.ok(r.asleep(), `asleep after ${steps} steps - a slide had pinned a ring's height on the edge forever`);
  assert.ok(r.bytes.every((b) => b === 128), 'still water, packed');
  // the packed corner: a slide between steps moves the field, not the texture
  const q = createRipples();
  q.recenter(0, 0); q.disturb(0, 0, 0.2, 1); q.step(1 / RIPPLE_HZ + 1e-9);
  const packed = [...q.packed];
  q.recenter(0.5, 0);
  assert.notDeepEqual([...q.origin], packed, 'the field slid');
  assert.deepEqual([...q.packed], packed, 'its bytes still stand where they were packed');
  q.step(1 / RIPPLE_HZ + 1e-9);
  assert.deepEqual([...q.packed], [...q.origin], 'packed again at the new corner');
  const rr = rd('src/render/renderer.js');
  assert.match(rr, /gl\.uniform3f\(L\.rippleRect, r\.packed\[0\], r\.packed\[1\], this\._rippleSpan\);/);
  const src = rd('src/world/waterRipples.js');
  assert.match(src, /origin\[0\] = ox; origin\[1\] = oz;\n[^\n]*\n[^\n]*\n\s*if \(!live\) return true;/, 'asleep, the slide is the origin alone');
  assert.match(src, /for \(let z = 1; z < cells - 1; z\+\+\) \{\n\s*const sz = z \+ dz;/, 'the slide writes the inside only');
});

test('AUDIT WATER-NEXT P3/m12/F4: the hosts\' one stir - a hull stirs under way alone, a still swimmer bobs, and the fixed town stirs as the streaming world does (mutants: a moored hull stirring; the bob gone; the town without a field)', () => {
  const field = createRipples(), stir = createRippleStir(field);
  const hull = {}, swimmer = {};
  let t = 0;
  for (let i = 0; i < 40; i++) {
    t += 1000 / 30;
    stir.begin(1 / 30, 0, 0);
    stir.stir(hull, [3, 0, 3], true, t, BOAT_STIR, BOAT_WAKE_SPEED);
    stir.end(1 / 30);
  }
  assert.ok(field.asleep(), 'a moored hull leaves the field asleep');
  const moving = [3, 0, 3];
  for (let i = 0; i < 6; i++) { t += 1000 / 30; moving[0] += 0.1; stir.begin(1 / 30, 0, 0); stir.stir(hull, moving, true, t, BOAT_STIR, BOAT_WAKE_SPEED); stir.end(1 / 30); }
  assert.ok(!field.asleep(), 'a hull under way stirs it');
  const still = createRipples(), s2 = createRippleStir(still);
  for (let i = 0; i < 6; i++) { t += 1000 / 30; s2.begin(1 / 30, 0, 0); s2.stir(swimmer, [1, 0, 1], true, t); s2.end(1 / 30); }
  assert.ok(!still.asleep(), 'a still swimmer bobs');
  assert.equal(BOAT_WAKE_SPEED, 0.25); assert.equal(BOAT_STIR, 2.5); assert.equal(STIR_PERIOD, 0.1);
  const e = rd('src/scenes/exterior.js');
  assert.match(e, /const townRipples = waterOn && !renderer\.waterSimple \? createRippleStir\(createRipples\(\)\) : null;/);
  assert.match(e, /_townOnWater = _onWater;/);
  assert.match(e, /if \(_townOnWater\) townRipples\.stir\(player, player\.pos, !!\(player\.isPlayerSwimming \|\| player\.swimming\), now\);/);
  assert.match(e, /renderer\.setWaterRipples\(townRipples\?\.field \?\? null, RIPPLE_SPAN, RIPPLE_CELLS\);\n\s*renderer\.drawWaterSurface\(townWater,/, 'handed over before its water draws');
});

test('AUDIT WATER-NEXT m7: the record\'s numbers are the code\'s (mutants: any of them moved)', () => {
  assert.deepEqual(SWELL_TRAINS.map((t) => [...t]), [[0.0, 48.0, 0.55], [0.54, 31.0, 0.28], [-0.75, 25.6, 0.17]]);
  assert.deepEqual([SWELL_CALM, SWELL_GALE, SWELL_DEPTH], [0.05, 0.34, 2.5]);
  assert.deepEqual([...SWELL_REACH], [300, 600]);
  assert.deepEqual([...WATER_ABSORB], [0.55, 0.30, 0.22]);
  assert.deepEqual([REFRACT_STRENGTH, FOAM_DEPTH, FOAM_RUNUP, CREST_SLOPE, OPEN_PATH], [0.035, 0.22, 2.2, 0.075, 60.0]);
  assert.deepEqual([RIPPLE_CELLS, RIPPLE_SPAN, RIPPLE_HZ, RIPPLE_DAMPING, RIPPLE_SCALE], [96, 48, 30, 0.975, 0.012]);
  assert.deepEqual([stirOf(0, true), stirOf(0, false), stirOf(1, false), stirOf(20, true)], [0.035, 0.02, 0.02 + 0.012, 0.035 + 8 * 0.012]);
  assert.deepEqual([BED_DEPTH, BED_RAMP, TILE_UNITS], [4.0, 19.2, 6.4]);
  assert.deepEqual([...BED_SILT], [0.62, 0.6, 0.52]); assert.equal(BED_RECORD, 1);
  assert.equal(GROUND_RECORD_LIMIT, 56);
  // the uniforms carry no dead field
  const u = waterUniforms({ seconds: 2 });
  assert.equal(u.opacity, undefined); assert.equal(u.scroll, undefined);
  assert.doesNotMatch(rd('src/render/renderer.js'), /u\('uScroll'\)|u\('uOpacity'\)/);
  // the carve's normals are re-lit only where it reached, and the grid's skirt follows its edge
  const g = 3, pos = new Float32Array((g * g + 4 * g) * 3), nrm = new Float32Array(pos.length);
  for (let i = 0; i < g * g; i++) { pos[i * 3] = (i % g) * 6.4; pos[i * 3 + 2] = Math.floor(i / g) * 6.4; nrm[i * 3 + 1] = 1; }
  const carved = carveBed(pos, nrm, Float32Array.from([0, 0, 0, 0, 2, 0, 0, 0, 0]), g, g);
  assert.equal(carved.positions[4 * 3 + 1], -2, 'the heart lowered');
  assert.equal(pos[4 * 3 + 1], 0, 'the grid itself untouched');
});

test('AUDIT WATER-NEXT G7/G8/G10: the open sea\'s underside is not drawn, the heave fades before the strided rings, and every sample after a discard names its level (mutants: the underside drawn; the far lattice; an implicit level)', () => {
  const fs = waterSurfaceFs('');
  assert.match(fs, /if \(uOpen == 1 && uCamPos\.y - vWorldPos\.y \+ 0\.02 < 0\.0\) discard;/);
  assert.match(WATER_SURFACE_VS, /uniform vec3 uCamPos;/);
  assert.doesNotMatch(fs, /\btexture\(uRipple|\btexture\(uScene/, 'the ripple field and the copy read at an explicit level');
  assert.equal((fs.match(/textureLod\(uRipple, /g) || []).length, 4);
  assert.equal((fs.match(/textureLod\(uSceneDepth, /g) || []).length, 2);
});

test('AUDIT WATER-NEXT m8: PUDDLE-DRY\'s tie goes to the first ground in the walk, and no reader of the ground dries its own (mutants: the tie to the last; a reader with a law of its own)', () => {
  // one puddle tile, its eight neighbours four of one ground and four of another, the first in the walk's order (-1, -1) the A's
  const tile = (bits) => ({ tileBitfield: bits, textureRecord: bits & 0x3f, isRotated: (bits & 0x40) === 0x40, isFlipped: (bits & 0x80) === 0x80 });
  const A = 1, B = 3;   // dirt and stone, round a pool in the grass
  for (const b of [A, B, 2]) assert.equal(groundTileWet(tile(b)), false);
  const grid = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => tile(2)));
  grid[5][5] = tile(8);
  const ring = [[-1, -1, A], [0, -1, B], [1, -1, A], [-1, 0, B], [1, 0, A], [-1, 1, B], [0, 1, A], [1, 1, B]];
  for (const [dx, dy, bits] of ring) grid[5 + dx][5 + dy] = tile(bits);
  assert.equal(dryPuddles(grid), 1);
  assert.equal(grid[5][5].tileBitfield, A, 'a tie: the first ground the walk met');
  for (const p of ['src/scenes/world.js', 'src/ui/inkTown.js']) {
    const s = rd(p);
    assert.doesNotMatch(s, /dryPuddles|from '\.\.\/world\/puddleDry\.js'/, `${p} reads the ground served, with no drying of its own`);
  }
});
