// EE4: the drawn ground surfaces - Daggerfall's SHAPES and COLOURS, our
// detail. Pure functions, so the real archive can be read here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { makeSurfaces, buildEnhancedTiles, identifySurface, makeNoise } from '../src/render/groundSurfaces.js';

const flat = (r, g, b) => {
  const c = new Uint8ClampedArray(64 * 64 * 4);
  for (let k = 0; k < 64 * 64; k++) { c[k * 4] = r; c[k * 4 + 1] = g; c[k * 4 + 2] = b; c[k * 4 + 3] = 255; }
  return { width: 64, height: 64, colors: c };
};

test('EE4: every surface tiles - the seam is closed BY CONSTRUCTION, in colour and in height', () => {
  const S = makeSurfaces();
  // ROADS 4 added the road; every surface here must still tile, the road included.
  assert.deepEqual(Object.keys(S).sort(), ['dirt', 'grass', 'road', 'sand', 'snow', 'stone', 'water']);
  for (const [name, fn] of Object.entries(S)) {
    for (const t of [0.13, 0.37, 0.61, 0.88]) {
      const a = fn(0, t); const b = fn(1, t); const c = fn(t, 0); const d = fn(t, 1);
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(a.rgb[i] - b.rgb[i]) < 1e-6, `${name} seams in u at v=${t}`);
        assert.ok(Math.abs(c.rgb[i] - d.rgb[i]) < 1e-6, `${name} seams in v at u=${t}`);
      }
      assert.ok(Math.abs(a.h - b.h) < 1e-6, `${name}'s HEIGHT seams, which a normal map would show`);
    }
  }
  const n = makeNoise(7);
  assert.ok(Math.abs(n(0, 1.5, 11, 7) - n(11, 1.5, 11, 7)) < 1e-9, 'x wraps on its own whole count');
  assert.ok(Math.abs(n(1.5, 0, 11, 7) - n(1.5, 7, 11, 7)) < 1e-9, 'y wraps on its own whole count');
});

test('EE4: a base is identified by its own colour, so winter is snow and desert is sand', () => {
  // the means measured off the real archives
  assert.equal(identifySurface([53, 94, 143]), 'water', 'every archive\u2019s base 0');
  assert.equal(identifySurface([134, 100, 65]), 'dirt', 'temperate base 1');
  assert.equal(identifySurface([52, 76, 42]), 'grass', 'temperate base 2');
  assert.equal(identifySurface([80, 79, 81]), 'stone', 'temperate base 3');
  assert.equal(identifySurface([209, 210, 216]), 'snow', 'winter base 1 - NOT dirt');
  assert.equal(identifySurface([208, 209, 216]), 'snow', 'winter base 2 - NOT grass');
  assert.equal(identifySurface([185, 141, 93]), 'sand', 'desert base 1');
  assert.equal(identifySurface([59, 67, 46]), 'grass', 'mountain base 2, dark');
});

test('EE4: the blends keep Daggerfall\u2019s shapes, and the bases keep its colours', () => {
  const water = flat(53, 94, 143), dirt = flat(134, 100, 65), grass = flat(52, 76, 42), stone = flat(80, 79, 81);
  const blend = flat(52, 76, 42);
  for (let y = 0; y < 64; y++) for (let x = 32; x < 64; x++) {
    const k = (y * 64 + x) * 4; blend.colors[k] = 134; blend.colors[k + 1] = 100; blend.colors[k + 2] = 65;
  }
  const out = buildEnhancedTiles([water, dirt, grass, stone, blend], { size: 64 });
  assert.equal(out.length, 5);
  assert.deepEqual(out.families, ['water', 'dirt', 'grass', 'stone']);
  const mean = (i, x0, x1) => {
    let r = 0, g = 0, b = 0, n = 0; const px = out[i].colors;
    for (let y = 8; y < 56; y++) for (let x = x0; x < x1; x++) { const k = (y * 64 + x) * 4; r += px[k]; g += px[k + 1]; b += px[k + 2]; n++; }
    return [r / n, g / n, b / n];
  };
  // COLOUR TRUTH: a drawn base's mean lands within a few units of the archive's
  const gm = mean(2, 0, 64);
  assert.ok(Math.abs(gm[0] - 52) < 8 && Math.abs(gm[1] - 76) < 8 && Math.abs(gm[2] - 42) < 8, `grass mean drifted: ${gm.map(Math.round)}`);
  // SHAPE: the blend is relatively greener on the left, browner on the right
  const [lr, lg] = mean(4, 4, 24); const [rr, rg] = mean(4, 40, 60);
  assert.ok(lg / lr > rg / rr, 'the blend lost its shape');
  assert.ok(out[4].heights instanceof Float32Array, 'every tile carries its height');
});

test('EE4: the builder against the REAL archives, when they are present', async () => {
  const A = process.env.ARENA2_PATH ?? '/tmp/dfx/app/ARENA2';
  if (!existsSync(`${A}/TEXTURE.303`)) { console.log('  (no ARENA2 here - skipped)'); return; }
  const { TextureFile } = await import('../src/formats/textureFile.js');
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const p = new DFPalette(); p.load(new Uint8Array(readFileSync(`${A}/ART_PAL.COL`)), 'ART_PAL.COL');
  for (const [arch, want] of [['302', 'water/dirt/grass/stone'], ['303', 'water/snow/snow/snow'], ['002', 'water/sand/sand/dirt']]) {
    const f = new TextureFile(); f.load(new Uint8Array(readFileSync(`${A}/TEXTURE.${arch}`)), `TEXTURE.${arch}`, p);
    const layers = [];
    for (let r = 0; r < f.recordCount; r++) layers.push(f.getColor32(f.getDFBitmap(r, 0), 0));
    const out = buildEnhancedTiles(layers, { size: 64 });
    assert.equal(out.length, layers.length, `${arch}: every record comes back`);
    assert.equal(out.families.join('/'), want, `${arch}: the families the archive actually is`);
    const c = out[2].colors; let sum = 0;
    for (let k = 0; k < 64 * 64; k++) sum += c[k * 4] + c[k * 4 + 1] + c[k * 4 + 2];
    assert.ok(sum / (64 * 64 * 3) > 20, `${arch}: a base is not a void`);
    // RESIDUALS: a record carrying a material that is none of the four
    // bases keeps its own colour. In the winter town the cobbled streets
    // are a grey the archive's bases do not include, and nearest-base
    // classification drew them as WATER. No record's blue channel may
    // drift more than 25 from the archive's own.
    for (let r = 4; r < layers.length; r++) {
      const N = layers[r].width * layers[r].height; let ob = 0;
      for (let k = 0; k < N; k++) ob += layers[r].colors[k * 4 + 2];
      let db = 0; for (let k = 0; k < 64 * 64; k++) db += out[r].colors[k * 4 + 2];
      assert.ok(Math.abs(ob / N - db / (64 * 64)) <= 25, `${arch} record ${r}: blue drifted from ${(ob / N).toFixed(0)} to ${(db / 4096).toFixed(0)} - a street drawn as water`);
    }
  }
});

test('EE4: wired as the enhanced default, built before any GL call, and the upload law holds', () => {
  const r = readFileSync('src/render/renderer.js', 'utf8');
  const start = r.indexOf('uploadTileArray(archive, layers) {');
  const up = r.slice(start, r.indexOf('\n  }\n', start) + 4);
  assert.match(up, /const src = mode === 'drawn' \? buildEnhancedTiles\(layers, \{ size: 128 \}\) : layers;/);
  assert.ok(up.indexOf('buildEnhancedTiles(') < up.indexOf('gl.createTexture()'), 'the CPU build precedes every GL call');
  assert.ok(!/drawArrays|drawElements|bindFramebuffer|gl\.clear\(|viewport\(/.test(up), 'the upload law');
  assert.ok(!/prototype\/ground|\.png'/.test(r), 'no raster of game data may be fetched');
});

// ═══ EE6: the ground is lit, not painted ════════════════════════════
test('EE6: normals from the surfaces\u2019 own height, seamless, and read inside the terrain shader', async () => {
  const { buildTileNormals } = await import('../src/render/groundSurfaces.js');
  const S = makeSurfaces();
  const size = 32;
  const heights = new Float32Array(size * size); const colors = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) heights[y * size + x] = S.dirt(x / size, y / size).h;
  const [n] = buildTileNormals([{ width: size, height: size, colors, heights }]);
  assert.equal(n.width, size);
  // a normal is a unit vector encoded 0..255, z up: the mean points up
  let sz = 0; for (let k = 0; k < size * size; k++) sz += n.colors[k * 4 + 2];
  assert.ok(sz / (size * size) > 160, 'normals lean up, not sideways');
  // and it WRAPS: the Sobel at column 0 reads column 31 as its
  // neighbour. Proven directly: a height field that is a ramp across
  // the tile has a CLIFF at the wrap edge, and a wrapping Sobel sees
  // that cliff at columns 0 and 31 while a clamping one sees nothing.
  const ramp = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) ramp[y * size + x] = x / size;
  const [rn] = buildTileNormals([{ width: size, height: size, colors, heights: ramp }]);
  const nx = (x) => rn.colors[(5 * size + x) * 4];
  // the interior leans one way (the ramp); the two edge columns lean the
  // OTHER way (the cliff). A clamping Sobel gives the edges the ramp's
  // own lean, and this fails.
  assert.ok(nx(10) < 100, `the interior leans with the ramp (got ${nx(10)})`);
  assert.ok(nx(0) > 200, `column 0 must see the wrap cliff (got ${nx(0)})`);
  assert.ok(nx(size - 1) > 200, `column ${size - 1} must see the wrap cliff (got ${nx(size - 1)})`);
  // a tile with no height gets the flat normal, so the other modes are safe
  const [flat] = buildTileNormals([{ width: 2, height: 2, colors: new Uint8Array(16) }]);
  assert.deepEqual([...flat.colors.slice(0, 4)], [128, 128, 255, 255]);

  const r = readFileSync('src/render/renderer.js', 'utf8');
  const ti = r.indexOf('const TERRAIN_FS = `'); const tj = r.indexOf('`;', ti); const terrain = r.slice(ti, tj);
  assert.match(terrain, /uniform sampler2DArray uTileNrm;/, 'declared INSIDE the shader that uses it');
  assert.match(terrain, /if \(uNormalAmt > 0\.0\) \{/, 'free outside the drawn mode');
  assert.match(terrain, /vec2 tr = ROT\[t\] \* tn\.xy;/, 'the tile\u2019s rotation places its normal as it placed its colours');
  assert.match(terrain, /float low = tfbm\(vWorldPos\.xz \* 0\.011\);/, 'the detail read is over WORLD position');
  // the draw binds a valid array on the normal unit even when the amount is 0
  assert.match(r, /gl\.bindTexture\(gl\.TEXTURE_2D_ARRAY, normalTex \?\? arrayTex\);\s*\n\s*gl\.uniform1i\(this\.tUTileNrm, 3\);\s*\n\s*gl\.uniform1f\(this\.tUNormalAmt, normalTex \? 1\.0 : 0\.0\);/);
  // the upload: a second array, built and uploaded under the same law
  const start = r.indexOf('uploadTileArray(archive, layers) {'); const up = r.slice(start, r.indexOf('\n  }\n', start) + 4);
  assert.match(up, /const nrm = buildTileNormals\(src\);/);
  assert.ok(!/drawArrays|drawElements|bindFramebuffer|gl\.clear\(|viewport\(/.test(up), 'the upload law, still');
  assert.match(r, /tileNormalFor\(archive\) \{/, 'one door for the normals too');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(readFileSync(host, 'utf8'), /renderer\.tileNormalFor\((p\.)?groundArchive\) \/\* EE6 \*\/\)/, host);
  }
});

// ROADS 4 (2026-09-01, Mac: the enhanced skin's road from "textures we've
// developed in the grass proto"): THE ROAD IS A SURFACE, KEYED BY RECORD.
// EE4's residual path identifies a record's own material by its COLOUR -
// grey cobbles read as stone, brown ruts as dirt - and a road is neither,
// it is a road. Records 46/47/55 (the tileset's road and its two edges,
// the same three the painter writes) take the road surface by INDEX and
// stay colour-matched to the archive's mean, so a winter road is pale and
// a desert road is sandy while both are unmistakably road.
test('ROADS 4: record 46\u2019s residual is drawn as ROAD, not as whatever its colour is called', async () => {
  const { makeSurfaces, ROAD_RECORDS } = await import('../src/render/groundSurfaces.js');
  assert.deepEqual([...ROAD_RECORDS].sort((a, b) => a - b), [46, 47, 55], 'the painter\u2019s three records');
  assert.equal(typeof makeSurfaces().road, 'function', 'the road is a surface in the set');
  // A 56-record set: four bases, then blends, with record 46 carrying a
  // GREY residual - the colour EE4 would call stone.
  const water = flat(53, 94, 143), dirt = flat(134, 100, 65), grass = flat(52, 76, 42), stone = flat(200, 120, 60);
  const layers = [water, dirt, grass, stone];
  for (let i = 4; i < 56; i++) layers.push(flat(52, 76, 42));
  layers[46] = flat(110, 108, 106);   // grey cobbles, far from every base
  layers[45] = flat(110, 108, 106);   // the SAME grey on a non-road record
  const out = buildEnhancedTiles(layers, { size: 64 });
  const mean = (i) => { let r = 0, g = 0, b = 0; const px = out[i].colors; const n = 64 * 64;
    for (let k = 0; k < n; k++) { r += px[k * 4]; g += px[k * 4 + 1]; b += px[k * 4 + 2]; } return [r / n, g / n, b / n]; };
  // Both are colour-matched to the same grey (law 2 holds for the road)...
  const m46 = mean(46), m45 = mean(45);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(m46[c] - 110) < 10, `road mean stays the archive\u2019s: ${m46.map(Math.round)}`);
  // ...but they are DIFFERENT SURFACES: the same grey on record 45 is
  // drawn by colour (stone) and on record 46 by index (road), so the two
  // tiles cannot be pixel-identical.
  let diff = 0; const a = out[46].colors, b = out[45].colors;
  for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2]) diff++;
  assert.ok(diff > 64 * 64 * 0.5, `record 46 is not record 45 in grey (${diff} texels differ of ${64 * 64})`);
  // The road tiles carry height like every other tile, so EE6 lights them.
  assert.ok(out[46].heights instanceof Float32Array);
});

// ═══ EE7: the grass - the renderer's first instanced draw ═══════════
test('EE7: the placer is deterministic, stands blades on grass records only, and reads the height under each', async () => {
  const { placeGrass } = await import('../src/render/groundSurfaces.js');
  const dim = 8; const tm = new Uint8Array(dim * dim);
  for (let k = 0; k < dim * dim; k++) tm[k] = (k % 2 ? 2 : 1) << 2;      // alternate records 1 and 2
  const heights = new Float32Array((dim + 1) * (dim + 1));
  for (let x = 0; x <= dim; x++) for (let z = 0; z <= dim; z++) heights[x * (dim + 1) + z] = x;   // a ramp in x
  const g = placeGrass({ tilemap: tm, grassOf: [0, 0, 1, 0], heights, tileDim: dim, tileSize: 6.4, heightScale: 2 });
  assert.equal(g.count, 32 * 6, 'six blades on each of the 32 grass tiles, none on the others');
  for (let i = 0; i < g.count; i++) {
    const x = g.data[i * 8], y = g.data[i * 8 + 1];
    const tx = Math.floor(x / 6.4); const tz = Math.floor(g.data[i * 8 + 2] / 6.4);
    assert.equal(tm[tz * dim + tx] >> 2, 2, 'a blade stands on a grass record');
    assert.ok(Math.abs(y - (x / 6.4) * 2) < 0.02, `a blade's root is the ground's own height (${y} at x=${x})`);
  }
  const g2 = placeGrass({ tilemap: tm, grassOf: [0, 0, 1, 0], heights, tileDim: dim, tileSize: 6.4, heightScale: 2 });
  assert.ok(g.data.every((v, i) => v === g2.data[i]), 'deterministic: a blade is where it was');
  // half-grass records get half the blades; a record under half gets none
  const g3 = placeGrass({ tilemap: tm, grassOf: [0, 0, 0.5, 0], heights, tileDim: dim, tileSize: 6.4 });
  assert.equal(g3.count, 0, 'half is not enough - blades want a lawn, not an edge');
});

test('EE7: the draw goes through every door the renderer has, and reports', () => {
  const r = readFileSync('src/render/renderer.js', 'utf8');
  const gi = r.indexOf('  drawGrass(grass, modelMatrix'); const body = r.slice(gi, r.indexOf('\n  }\n', gi) + 4);
  assert.match(body, /this\._use\(this\.grassProgram\);/, 'EV6: one door for useProgram');
  assert.match(body, /this\._bindVao\(grass\.vao\);/, 'EV6: one door for bindVertexArray');
  assert.match(body, /this\.stats\.draws\+\+;\s*\n\s*gl\.drawArraysInstanced\(gl\.TRIANGLES, 0, this\._grassBladeVerts, grass\.count\);/, 'F50: every draw reports');
  assert.match(body, /this\._uploadFog\(u\);/, 'the same fog as everything else');
  assert.match(body, /gl\.uniform3fv\(u\.lightDir, this\._lightDir\);/, 'the same sun as the terrain');
  assert.match(body, /gl\.uniform1f\(u\.shadowAmt, cs \? cs\.amount : 0\);/, 'the same cloud deck as the terrain');
  // the shader shares the cloud block, fades by the frame's fog, and
  // thins with distance rather than shrinking
  const fs = r.slice(r.indexOf('const GRASS_FS = `'), r.indexOf('`;', r.indexOf('const GRASS_FS = `')));
  assert.match(fs, /\$\{CLOUD_SHADOW_GLSL\}/);
  assert.match(fs, /outColor = vec4\(mix\(uFogColor, lit, fogFactorAt\(vWorldPos\)\), 1\.0\);/);
  const vs = r.slice(r.indexOf('const GRASS_VS = `'), r.indexOf('`;', r.indexOf('const GRASS_VS = `')));
  assert.match(vs, /fract\(aInst2\.x \* 91\.7\) > fade \* 1\.15/, 'the fade thins the field, it does not shrink the blades');
  // create binds only what it builds and releases the VAO through the door
  const ci = r.indexOf('  createGrass(data, count) {'); const cb = r.slice(ci, r.indexOf('\n  }\n', ci) + 4);
  assert.match(cb, /this\._bindVao\(vao\);[\s\S]*this\._bindVao\(null\);/);
  assert.ok(!/drawArrays|bindFramebuffer|gl\.clear\(/.test(cb), 'the upload law holds for a buffer too');
  // the host: placed from the pixel's own tilemap and heightmap, drawn
  // after its terrain inside the same cull, destroyed with it, and killed by ?grass=off
  const w = readFileSync('src/scenes/world.js', 'utf8');
  // the host: placed by ONE function from the pixel's own tilemap and
  // heightmap, on the NEAR ring only (stride 1 - grass on a far LOD
  // pixel is a vertex cost that is never seen), following the ring as
  // the pixel comes near and recedes; drawn after its terrain inside
  // the same cull; destroyed with it; killed by ?grass=off; and
  // ?grass=<n> sets the density so a software rasteriser can be gated
  assert.match(w, /function buildGrassFor\(px, py, groundArchive, tilemapBytes, samples\) \{/);
  assert.match(w, /if \(!grassOf \|\| door === 'off'\) return null;/, 'the kill switch');
  assert.match(w, /tilemap: tilemapBytes, grassOf, heights: samples, tileDim: TERRAIN_TILE_DIM, tileSize: 6\.4,/);
  assert.match(w, /heightScale: MAX_TERRAIN_HEIGHT \* DEFAULT_TERRAIN_SCALE/, 'the same height scale the terrain grid uses');
  assert.match(w, /const grass = stride === 1 \? buildGrassFor\(px, py, groundArchive, tilemapBytes, samples\) : null;/, 'near ring only');
  assert.match(w, /if \(stride === 1 && !p\.grass\) p\.grass = buildGrassFor\(/, 'born when the pixel comes near');
  assert.match(w, /else if \(stride !== 1 && p\.grass\) \{ renderer\.destroyGrass\(p\.grass\); p\.grass = null; \}/, 'gone when it recedes');
  assert.match(w, /renderer\.destroyGrass\(p\.grass\);   \/\/ EE7/, 'and gone with the pixel');
  assert.match(w, /renderer\.tileNormalFor\(p\.groundArchive\) \/\* EE6 \*\/\);\n[\s\S]{0,900}if \(p\.grass\) renderer\.drawGrass\(p\.grass, pixelMatrix,/, 'drawn right after its terrain (EE15: the near patch sits between)');
  assert.match(w, /window\.__grassCensus = \(\) => \{/, 'the census the probe reads');
});

// ═══ ROADS fix: no dome per tile ════════════════════════════════════
test('ROADS: the road surface carries no tile-centred term - four tiles read as one road', () => {
  const S = makeSurfaces(); const N = 64;
  // a dome centred on the tile lights (0.5, 0.5) and darkens the corners:
  // the "small repeating squares" Mac saw on every road
  const src = readFileSync('src/render/groundSurfaces.js', 'utf8');
  const road = src.slice(src.indexOf('const road = (u, v) => {'), src.indexOf('return { water, dirt, grass, stone, sand, snow, road };'));
  assert.ok(!/hypot\(u - 0\.5, v - 0\.5\)/.test(road), 'no term may be centred on the tile');
  // and measured: the brightness jump across a tile edge is no larger
  // than the jump between two neighbouring texels inside the tile
  const lum = (x, y) => { const r = S.road((x % N) / N, (y % N) / N); return (r.rgb[0] + r.rgb[1] + r.rgb[2]) / 3; };
  let edge = 0, inner = 0;
  for (let y = 0; y < 2 * N; y++) { edge += Math.abs(lum(N, y) - lum(N - 1, y)); inner += Math.abs(lum(N / 2, y) - lum(N / 2 - 1, y)); }
  assert.ok(edge < inner * 1.6 + 2 * N, `the tile edge is not a seam (edge ${(edge / (2 * N)).toFixed(2)} vs inner ${(inner / (2 * N)).toFixed(2)})`);
});
