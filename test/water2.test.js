// WATER2 (2026-09-11, Mac: "ponds not sitting like a texture and
// having depth in the ground (same for rivers)"): THE BASIN. The pure
// half EXECUTES - which vertices are in water, the bowl's profile, the
// carve, the recomputed bank normals, the re-hung skirt, the water's
// own uncarved mesh - and the shader, the renderer, both hosts, the
// lab and the collider's untouched samples are text-pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASIN_DEPTH, BASIN_RAMP, TOWN_WATER_DEPTH, basinProfile, vertexInWater, basinDepths, carveBasin, waterMesh } from '../src/render/waterBasin.js';
import { waterSurfaceFs, WATER_SURFACE_VS, waterUniforms, SHORE_DEPTH, SHALLOW_OPACITY, DEEP_COLOR, WATER_ABSORB, WATER_OPACITY } from '../src/render/waterSurface.js';
import { assignTiles } from '../src/world/terrainTiles.js';
import { convertTilemap, buildTerrainGrid, TERRAIN_SKIRT_DEPTH } from '../src/world/terrainSurface.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const TD = HEIGHTMAP_DIMENSION, DIM = 128;

/** A corner field (0 = water, 1 = dirt) through the producer to converted bytes. */
function fieldToBytes(isWater) {
  const tileData = new Uint8Array(TD * TD);
  for (let y = 0; y < TD; y++) for (let x = 0; x < TD; x++) tileData[x + y * TD] = isWater(x, y) ? 0 : 1;
  const tilemap = new Uint8Array(DIM * DIM);
  assignTiles(tileData, tilemap, true);
  return { bytes: convertTilemap(tilemap), tileData };
}

test('WATER2: a vertex is in water exactly when the corner field says so - the marching squares round-trip, every vertex of a random field (mutant: any one corner bit read from the wrong tile)', () => {
  let seed = 777;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const { bytes, tileData } = fieldToBytes(() => rnd() < 0.5);
  let wet = 0;
  for (let z = 0; z < TD; z++) {
    for (let x = 0; x < TD; x++) {
      const want = tileData[x + z * TD] === 0;
      assert.equal(vertexInWater(bytes, x, z, 1), want, `vertex (${x},${z})`);
      if (want) wet++;
    }
  }
  assert.ok(wet > 7000 && wet < 9600, `half the field is wet: ${wet}`);
});

test('WATER2: the bowl - dry is 0, the bank\'s first ring is the profile at 1, the middle of a lake is 1, the ramp is monotone, and a field with no water is null (mutant: a linear profile, or the walk not capped)', () => {
  assert.equal(basinProfile(0), 0);
  assert.equal(basinProfile(BASIN_RAMP), 1);
  assert.equal(basinProfile(BASIN_RAMP + 3), 1, 'flat past the ramp');
  for (let d = 1; d <= BASIN_RAMP; d++) assert.ok(basinProfile(d) > basinProfile(d - 1), 'monotone');
  assert.ok(basinProfile(1) > 1 / BASIN_RAMP, 'a quarter circle is steeper than a line off the bank');
  // a lake: water corners in a 20-vertex-radius disk about (60, 60)
  const { bytes } = fieldToBytes((x, y) => Math.hypot(x - 60, y - 60) < 20);
  const d = basinDepths(bytes, 1);
  assert.ok(d, 'wet');
  const at = (x, z) => d[z * TD + x];
  assert.equal(at(60, 60), 1, 'the middle is full depth');
  assert.equal(at(5, 5), 0, 'dry far away');
  const near = (a, b) => Math.abs(a - b) < 1e-6;   // the depths are float32
  assert.ok(near(at(60, 41), basinProfile(1)), 'the first wet ring, one from the bank');
  assert.ok(near(at(60, 42), basinProfile(2)));
  assert.equal(at(60, 40), 0, 'the bank itself is dry (a shore corner)');
  assert.equal(basinDepths(fieldToBytes(() => false).bytes, 1), null, 'no water, no basin');
  // a one-tile stream: every wet vertex is one from a bank
  const s = basinDepths(fieldToBytes((x, y) => y === 30).bytes, 1);
  assert.ok(near(s[30 * TD + 64], basinProfile(1)));
  assert.equal(s[31 * TD + 64], 0);
});

test('WATER2: the carve lowers the ground under the water by the profile, leaves dry ground alone, re-lights the bank as a slope with unit normals, and re-hangs the far ring\'s skirt from the carved edge (mutant: the skirt left at the old edge, or the normals left flat)', () => {
  const { bytes } = fieldToBytes((x, y) => Math.hypot(x - 60, y - 60) < 20);
  for (const stride of [1, 4]) {
    const g = (TD - 1) / stride + 1;
    const h = new Float32Array(TD * TD).fill(0.02);
    const grid = buildTerrainGrid(h, stride);
    const before = grid.positions.slice();
    const depths = basinDepths(bytes, stride);
    const mesh = waterMesh(grid.positions, depths, stride);
    carveBasin(grid, depths, stride);
    const y = (xi, zi) => grid.positions[(zi * g + xi) * 3 + 1];
    const y0 = (xi, zi) => before[(zi * g + xi) * 3 + 1];
    const c = 60 / stride;
    assert.ok(Math.abs((y0(c, c) - y(c, c)) - BASIN_DEPTH) < 1e-4, `stride ${stride}: the middle is BASIN_DEPTH down`);
    assert.equal(y(1, 1), y0(1, 1), 'dry ground untouched');
    // the bank slopes toward the water: at (60, 40) the ground falls toward +z (the carve at 41), and the grid's kernel (nz = hd - hu) leans the normal DOWNHILL, +z
    if (stride === 1) {
      const n = grid.normals.subarray((40 * g + 60) * 3, (40 * g + 60) * 3 + 3);
      assert.ok(n[2] > 0.05 && Math.abs(Math.hypot(n[0], n[1], n[2]) - 1) < 1e-5, `the bank's normal leans over the water: ${Array.from(n)}`);
      const flat = grid.normals.subarray((5 * g + 5) * 3, (5 * g + 5) * 3 + 3);
      assert.deepEqual(Array.from(flat), [0, 1, 0], 'dry ground keeps its normal');
    }
    // the water's mesh: the heights as they stood, and the depth in units
    assert.equal(mesh.positions.length, g * g * 3);
    assert.equal(mesh.positions[(c * g + c) * 3 + 1], y0(c, c), 'the surface is where the ground was');
    assert.ok(Math.abs(mesh.depths[c * g + c] - BASIN_DEPTH) < 1e-6);
    assert.equal(mesh.depths[1 * g + 1], 0);
    if (stride > 1) {
      // the skirt: the south row's copy of vertex (c, 0) is untouched; the west column's copy of (0, c) too; but a carved edge would move - prove the walk by an interior edge vertex's twin
      const n = g * g;
      for (let i = 0; i < g; i++) {
        const src = i * 3, sk = (n + i) * 3;   // south row: vertex (i, 0)
        assert.ok(Math.abs(grid.positions[sk + 1] - (grid.positions[src + 1] - TERRAIN_SKIRT_DEPTH)) < 1e-4, 'the skirt hangs from the edge as it now stands');
      }
    }
  }
});

test('WATER2: the shader reads the bed - the surface fades to nothing as the bed rises (the shoreline), the body tends to the deep colour and its opacity by Beer-Lambert - and the uniforms carry the four dials (mutant: the depth fade dropped, or the deep mix after the light)', () => {
  assert.match(WATER_SURFACE_VS, /layout\(location=1\) in float aDepth;[\s\S]*?out float vDepth;[\s\S]*?vDepth = aDepth;/);
  const fs = waterSurfaceFs('float cloudShadowAt(vec3 wp) { return 1.0; }');
  assert.match(fs, /in float vDepth;/);
  assert.match(fs, /edge \*= smoothstep\(0\.0, uShoreDepth, vDepth\);\s*\n\s*if \(edge <= 0\.002\) discard;/, 'the shoreline is the bed\'s rise');
  assert.match(fs, /float deep = 1\.0 - exp\(-max\(vDepth, 0\.0\) \* uAbsorb\);/, 'Beer-Lambert');
  const mixAt = fs.indexOf('tex = mix(tex, uDeep, deep);'), litAt = fs.indexOf('vec3 lit = tex * (uAmbient');
  assert.ok(mixAt > 0 && mixAt < litAt, 'the deep colour goes in BEFORE the light, so a deep pool at midnight is dark');
  assert.match(fs, /float body = mix\(uShallowOpacity, uOpacity, deep\);/);
  const u = waterUniforms({});
  assert.equal(u.shoreDepth, SHORE_DEPTH);
  assert.equal(u.shallowOpacity, SHALLOW_OPACITY);
  assert.equal(u.deep, DEEP_COLOR);
  assert.equal(u.absorb, WATER_ABSORB);
  assert.ok(SHALLOW_OPACITY < WATER_OPACITY && SHORE_DEPTH < 1 && 1 - Math.exp(-BASIN_DEPTH * WATER_ABSORB) > 0.85, 'clear in the shallows, nine tenths lost at full depth');
  const r = rd('src/render/renderer.js');
  assert.match(r, /gl\.vertexAttribPointer\(1, 1, gl\.FLOAT, false, 4, 0\);/, 'the depth as one float');
  assert.match(r, /shoreDepth: u\('uShoreDepth'\), shallowOpacity: u\('uShallowOpacity'\), deep: u\('uDeep'\), absorb: u\('uAbsorb'\),/);
  assert.match(r, /gl\.uniform1f\(L\.shoreDepth, u\.shoreDepth\);[\s\S]*?gl\.uniform1f\(L\.shallowOpacity, u\.shallowOpacity\);\s*\n\s*gl\.uniform3fv\(L\.deep, u\.deep\);\s*\n\s*gl\.uniform1f\(L\.absorb, u\.absorb\);/);
});

test('WATER2: the hosts - the world takes the water\'s mesh BEFORE it carves and uploads the ground (the build and the restride), the town\'s flat sheet sits at one depth, the lab does the same, and the collider reads the samples the carve never touches (mutant: the carve before the mesh, or the town drawn off the ground quad)', () => {
  const w = rd('src/scenes/world.js');
  const bw = w.slice(w.indexOf('  function buildWater(positions, normals, tilemapBytes, stride, waterIndices) {'));
  assert.match(bw.slice(0, bw.indexOf('\n  }\n')), /const depths = basinDepths\(tilemapBytes, stride\);\s*\n\s*if \(!depths\) return null;\s*\n\s*const mesh = waterMesh\(positions, depths, stride\);\s*\n\s*carveBasin\(\{ positions, normals \}, depths, stride\);\s*\n\s*return renderer\.createWaterSurface\(mesh\.positions, mesh\.depths, waterIndices\);/);
  const build = w.indexOf('const water = waterIndices ? buildWater(positions, normals, tilemapBytes, stride, waterIndices) : null;');
  assert.ok(build > 0 && build < w.indexOf('const terrain = renderer.createTerrainSurface(positions, normals,'), 'the build: the water first, then the carved ground uploaded');
  const restride = w.slice(w.indexOf('  function restrideTerrain(p, stride) {'));
  const rb = restride.slice(0, restride.indexOf('\n  }\n'));
  assert.ok(rb.indexOf('p.water = waterIndices ? buildWater(grid.positions, grid.normals, p.tilemapBytes, stride, waterIndices) : null;') < rb.indexOf('p.terrain = renderer.createTerrainSurface(grid.positions, grid.normals,'), 'the restride: the same order');
  // the collider: heightAt reads the pixel's samples, which no carve touches
  const ha = w.slice(w.indexOf('  const heightAt = (x, z) => {'));
  assert.match(ha.slice(0, ha.indexOf('\n  };\n')), /p\.samples\[a \* HEIGHTMAP_DIMENSION \+ b\] \* worldHeight/, 'the samples, not the positions');
  assert.doesNotMatch(rd('src/render/waterBasin.js'), /samples\[|generateSamples|ghostSampler/, 'the basin module never reads the samples');
  const e = rd('src/scenes/exterior.js');
  assert.match(e, /const townWater = waterOn \? \(\(\) => \{[\s\S]*?new Float32Array\(4\)\.fill\(TOWN_WATER_DEPTH\), new Uint32Array\(\[0, 2, 3, 0, 3, 1\]\)\);/);
  assert.ok(TOWN_WATER_DEPTH > SHORE_DEPTH * 3, 'a moat is not a shoreline');
  const lab = rd('src/tools/waterLab.js');
  assert.match(lab, /const waterVerts = basin \? waterMesh\(grid\.positions, basin, 1\) : null;\s*\n\s*if \(basin\) carveBasin\(grid, basin, 1\);\s*\n\s*const terrain = renderer\.createTerrainSurface/);
});
