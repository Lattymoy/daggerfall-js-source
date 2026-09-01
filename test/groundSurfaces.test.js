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
  assert.deepEqual(Object.keys(S).sort(), ['dirt', 'grass', 'sand', 'snow', 'stone', 'water']);
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
