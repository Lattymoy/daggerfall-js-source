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

test('EE7: every surface tiles - the seam is closed BY CONSTRUCTION', () => {
  const S = makeSurfaces();
  assert.deepEqual(Object.keys(S).sort(), ['dirt', 'grass', 'sand', 'stone', 'water']);
  // frequencies are whole cycles per tile now, per axis, so u = 0 and
  // u = 1 are an exact number of lattice cells apart. This was the one
  // thing keeping the drawn surfaces out of the game.
  for (const [name, fn] of Object.entries(S)) {
    for (const t of [0.13, 0.37, 0.61, 0.88]) {
      const a = fn(0, t); const b = fn(1, t);
      const c = fn(t, 0); const d = fn(t, 1);
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(a.rgb[i] - b.rgb[i]) < 1e-6, `${name} seams in u at v=${t}`);
        assert.ok(Math.abs(c.rgb[i] - d.rgb[i]) < 1e-6, `${name} seams in v at u=${t}`);
      }
      assert.ok(Math.abs(a.h - b.h) < 1e-6, `${name}'s HEIGHT seams too, which the normal map would show`);
    }
    assert.ok(fn(0.31, 0.37).h >= 0, `${name} must report a height, not a colour alone`);
  }
  // and the noise itself wraps on a whole number of cells, per axis,
  // which is what lets an anisotropic term (a rut, a ripple) tile
  const n = makeNoise(7);
  assert.ok(Math.abs(n(0, 1.5, 11, 7) - n(11, 1.5, 11, 7)) < 1e-9, 'x must wrap on its own count');
  assert.ok(Math.abs(n(1.5, 0, 11, 7) - n(1.5, 7, 11, 7)) < 1e-9, 'y must wrap on its own count');
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
  // BUILT at upload and never read from disk - doctrine forbids a
  // raster of game data in the repo, and these are derived from one
  assert.match(r, /const src = this\.enhancedGround \? buildEnhancedTiles\(layers, \{ size: 128 \}\) : layers;/,
    'EE7 wired them: the seam is closed, so they go in');
  assert.ok(!/prototype\/ground|\.png'/.test(r), 'no raster of game data may be fetched');
  // and the classic skin gets its own layers, byte for byte
  assert.match(r, /gl\.texImage3D\(gl\.TEXTURE_2D_ARRAY, 0, gl\.RGBA8, w, h, src\.length/);   // EE8: sized, or no mips
  assert.deepEqual(BASE_ORDER, ['water', 'dirt', 'grass', 'stone'], 'the archive\u2019s own order');
  // the noise wraps, which is what makes the whole thing seamless
  const n = makeNoise(7);
  assert.ok(Math.abs(n(0.3, 0.4, 8) - n(8.3, 0.4, 8)) < 1e-9, 'the lattice must wrap at the period');
});

test('EE8: the tile array is SIZED, and a failed mipmap falls back instead of drawing black', () => {
  const r = readFileSync('src/render/renderer.js', 'utf8');
  // generateMipmap needs a colour-renderable, filterable format. An
  // UNSIZED gl.RGBA on a 2D array is not one, so the call failed, no
  // mips existed, and LINEAR_MIPMAP_LINEAR left the sampler
  // MIPMAP-INCOMPLETE - which samples BLACK, everywhere. That was the
  // void. It had worked for years under NEAREST because NEAREST needs
  // no mips at all.
  assert.match(r, /gl\.texImage3D\(gl\.TEXTURE_2D_ARRAY, 0, gl\.RGBA8, w, h, src\.length, 0, gl\.RGBA, gl\.UNSIGNED_BYTE, null\);/,
    'the array must be allocated with a SIZED internal format');
  assert.ok(!/texImage3D\(gl\.TEXTURE_2D_ARRAY, 0, gl\.RGBA,/.test(r), 'the unsized form must be gone');
  // and if it fails anyway, the ground must degrade to classic rather
  // than to nothing
  assert.match(r, /gl\.generateMipmap\(gl\.TEXTURE_2D_ARRAY\);\n\s*if \(gl\.getError\(\) !== gl\.NO_ERROR\) \{/);
  assert.match(r, /gl\.texParameteri\(gl\.TEXTURE_2D_ARRAY, gl\.TEXTURE_MIN_FILTER, gl\.NEAREST\);\n\s*gl\.texParameteri\(gl\.TEXTURE_2D_ARRAY, gl\.TEXTURE_MAG_FILTER, gl\.NEAREST\);/);
  assert.match(r, /while \(gl\.getError\(\) !== gl\.NO_ERROR\) \{/, 'the error queue must be drained first, or the read is someone else\u2019s');
});
