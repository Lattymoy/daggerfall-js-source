// EE5: the drawn ground surfaces - Daggerfall's SHAPES, our pixels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeSurfaces, buildEnhancedTiles, BASE_ORDER, makeNoise } from '../src/render/groundSurfaces.js';

const flat = (r, g, b) => {
  const c = new Uint8Array(64 * 64 * 4);
  for (let k = 0; k < 64 * 64; k++) { c[k * 4] = r; c[k * 4 + 1] = g; c[k * 4 + 2] = b; c[k * 4 + 3] = 255; }
  return { width: 64, height: 64, colors: c };
};

test('EE5: the surfaces carry a HEIGHT, and the seam that keeps them unwired', () => {
  const S = makeSurfaces();
  assert.deepEqual(Object.keys(S).sort(), ['dirt', 'grass', 'sand', 'stone', 'water']);
  for (const [name, fn] of Object.entries(S)) {
    const a = fn(0.31, 0.37);
    assert.ok(a.h >= 0 && a.h <= 1.4, `${name} must report a height, not a colour alone`);
    assert.equal(a.rgb.length, 3);
  }
  // THE SEAM, pinned as the fact it is rather than hidden. The noise
  // wraps on its INTEGER lattice, so a tile repeats cleanly only when
  // its coordinate step is a whole number of cells - and the surfaces
  // scale their frequency by fractions (P * 0.9, P * 1.6, P * 2.6),
  // which lands u = 0 and u = 1 on different corners. This test exists
  // to FAIL the day someone wires these in without fixing it, and to
  // pass the day the frequencies become whole cycles per tile.
  const worst = Object.entries(S).reduce((acc, [name, fn]) => {
    const a = fn(0, 0.37); const b = fn(1, 0.37);
    const d = Math.max(...[0, 1, 2].map((i) => Math.abs(a.rgb[i] - b.rgb[i])));
    return d > acc.d ? { name, d } : acc;
  }, { name: null, d: 0 });
  assert.ok(worst.d > 0.5,
    'if the surfaces now WRAP, this pin has done its job - delete it and wire them in');
  const r = readFileSync('src/render/renderer.js', 'utf8');
  assert.match(r, /const src = layers;/, 'the seamed surfaces must not reach the upload');
  assert.match(r, /EE5 IS BUILT AND NOT YET WIRED, deliberately\./, 'and the reason must be where the wiring would go');
});

test('EE5: the blends keep Daggerfall\u2019s own shapes, and only the pixels change', () => {
  // four bases, then a blend that is grass on the left and dirt on the right
  const water = flat(40, 80, 120), dirt = flat(140, 110, 70);
  const grass = flat(60, 100, 50), stone = flat(120, 120, 120);
  const blend = flat(60, 100, 50);
  for (let y = 0; y < 64; y++) for (let x = 32; x < 64; x++) {
    const k = (y * 64 + x) * 4;
    blend.colors[k] = 140; blend.colors[k + 1] = 110; blend.colors[k + 2] = 70;
  }
  const out = buildEnhancedTiles([water, dirt, grass, stone, blend], { size: 64 });
  assert.equal(out.length, 5, 'every record comes back, blends included');
  assert.equal(out[0].width, 64);
  const px = out[4].colors;
  const mean = (x0, x1) => {
    let r = 0, g = 0, n = 0;
    for (let y = 8; y < 56; y++) for (let x = x0; x < x1; x++) { const k = (y * 64 + x) * 4; r += px[k]; g += px[k + 1]; n++; }
    return [r / n, g / n];
  };
  const [lr, lg] = mean(4, 24);     // the grass half
  const [rr, rg] = mean(40, 60);    // the dirt half
  // the SHAPE survives: the left is relatively greener, the right
  // relatively redder, whatever the surfaces themselves look like
  assert.ok(lg / lr > rg / rr, `the blend lost its shape (left ${(lg / lr).toFixed(2)} vs right ${(rg / rr).toFixed(2)})`);
  assert.ok(out[4].heights instanceof Float32Array, 'a derived tile carries its height too');
});

test('EE5: nothing is shipped, and the classic path is untouched', () => {
  const r = readFileSync('src/render/renderer.js', 'utf8');
  // when they ARE wired, they will be BUILT at upload and never read
  // from disk - doctrine forbids a raster of game data in the repo
  assert.ok(!/prototype\/ground|\.png'/.test(r), 'no raster of game data may be fetched');
  // and the classic skin gets its own layers, byte for byte
  assert.match(r, /gl\.texImage3D\(gl\.TEXTURE_2D_ARRAY, 0, gl\.RGBA, w, h, src\.length/);
  assert.deepEqual(BASE_ORDER, ['water', 'dirt', 'grass', 'stone'], 'the archive\u2019s own order');
  // the noise wraps, which is what makes the whole thing seamless
  const n = makeNoise(7);
  assert.ok(Math.abs(n(0.3, 0.4, 8) - n(8.3, 0.4, 8)) < 1e-9, 'the lattice must wrap at the period');
});
