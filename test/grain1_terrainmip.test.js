// GRAIN1 (2026-09-19, Mac: "distance terrian has a weird grain look") -
// THE DISTANT GROUND WAS UNFILTERED, AND THE REASON IT WAS UNFILTERED IS
// IN THE SHADER.
//
// The grain is minification aliasing: past a few tiles out a screen pixel
// covers many texels and NEAREST picks one, so the ground boils as the
// camera drifts. A mipmap is the only cure - and it could not be turned
// on while the shader sampled the WRAPPED coordinate, because `fract`
// jumps 1 -> 0 at every tile edge and the hardware picks its mip from the
// screen-space derivative of the coordinate it is handed. Those jumps
// read as "this pixel covers the whole texture", so every tile edge in
// every pixel would draw a line of the coarsest mip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { waterSurfaceFs } from '../src/render/waterSurface.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Every shader that samples the tile array, and the name of the
 *  continuous coordinate its footprint must come from. */
const SAMPLERS = [
  ['src/render/renderer.js', 'the classic terrain'],
  ['src/render/enhancedLighting.js', 'the enhanced terrain'],
];

test('GRAIN1: every tile-array sample takes its footprint from the UNWRAPPED coordinate, never the fract', () => {
  for (const [file, what] of SAMPLERS) {
    const s = read(file);
    assert.match(s, /vec2 gx = ROT\[t\] \* dFdx\(unwrapped\);\s*\n\s*vec2 gy = ROT\[t\] \* dFdy\(unwrapped\);/,
      `${what}: the gradient is the unwrapped one, rotated as the UV is`);
    assert.match(s, /textureGrad\(uTileArr, vec3\(tuv, float\(layer\)\), gx, gy\)/, `${what}: and it is handed to the sampler`);
    // the implicit-derivative spelling must be GONE, or the mipmap draws a
    // blurred line around all 16,384 tiles of every pixel
    assert.doesNotMatch(s, /texture\(uTileArr, vec3\(tuv, float\(layer\)\)\)/, `${what}: no implicit-derivative sample survives`);
  }
  // the water pass samples the same array, with the same wrap
  const fs = waterSurfaceFs('');
  assert.match(fs, /vec2 wgx = dFdx\(unwrapped\), wgy = dFdy\(unwrapped\);/, 'the water pass measures from the unwrapped coordinate too');
  assert.match(fs, /textureGrad\(uTileArr, vec3\(uv, 0\.0\), wgx, wgy\)/, 'and hands it over');
  assert.doesNotMatch(fs, /texture\(uTileArr, vec3\(uv, 0\.0\)\)/, 'no implicit sample survives there either');
});

test('GRAIN1: the tile array is mipmapped and minified trilinear - and MAGNIFIED nearest, so the ground underfoot keeps its texels', () => {
  const r = read('src/render/renderer.js');
  const up = r.slice(r.indexOf('  uploadTileArray(archive, layers) {'));
  const body = up.slice(0, up.indexOf('\n  }\n'));
  assert.match(body, /gl\.generateMipmap\(gl\.TEXTURE_2D_ARRAY\);/, 'the chain is built');
  assert.match(body, /TEXTURE_MIN_FILTER, gl\.LINEAR_MIPMAP_LINEAR/, 'minification takes it');
  assert.match(body, /TEXTURE_MAG_FILTER, gl\.NEAREST/, 'MAGNIFICATION DOES NOT MOVE - the near field is where Daggerfall’s texels are meant to be square and visible, and a mipmap has no say there');
  // the mipmap is generated AFTER every layer is uploaded, or the chain is
  // built from an empty texture and the distance goes black
  assert.ok(body.indexOf('texSubImage3D') < body.indexOf('generateMipmap'), 'every layer is uploaded before the chain is built');
  // CLAMP survives: a 2D ARRAY mipmaps each layer on its own, so no tile can
  // bleed into another the way an atlas would
  assert.match(body, /TEXTURE_WRAP_S, gl\.CLAMP_TO_EDGE/);
  assert.match(body, /TEXTURE_WRAP_T, gl\.CLAMP_TO_EDGE/);
});

test('GRAIN1: anisotropy is asked for, capped, and optional - terrain is read at a grazing angle almost everywhere', () => {
  const r = read('src/render/renderer.js');
  const up = r.slice(r.indexOf('  uploadTileArray(archive, layers) {'));
  const body = up.slice(0, up.indexOf('\n  }\n'));
  assert.match(body, /getExtension\('EXT_texture_filter_anisotropic'\)/, 'asked for by name');
  assert.match(body, /if \(aniso\) \{/, 'and a driver without it still draws - the mipmap alone already fixes the grain');
  assert.match(body, /anisotropyFor\(getPref\('groundSharpness'\), this\._anisoMax\)/, 'GRAIN2: how much of it is the machine\u2019s question, so it is read from the dial');
  assert.match(body, /this\._anisoExt \|\|=/, 'the extension is fetched once, not once an archive');
  assert.match(body, /this\._anisoMax \|\|=/, 'and so is its maximum');
});

test('GRAIN1: the tile array is the ONLY texture this touches - the sprites keep their hard edges', () => {
  const r = read('src/render/renderer.js');
  // every other generateMipmap in the renderer predates this; the sprite and
  // flat paths must not have acquired one, or every billboard goes soft.
  const mips = [...r.matchAll(/gl\.generateMipmap\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(mips, ['gl.TEXTURE_2D_ARRAY'], `only the tile array is mipmapped (found: ${mips.join(', ')})`);
});

test('GRAIN2: the anisotropy is a DIAL, and its tiers never exceed what the driver allows', async () => {
  const { anisotropyFor } = await import('../src/render/renderer.js');
  const { FEATURE_PREF_DEFAULTS, FEATURES } = await import('../src/systems/features.js');
  // 1 is the extension's own word for "no anisotropy" - not 0, which is
  // not a legal value for TEXTURE_MAX_ANISOTROPY_EXT.
  assert.equal(anisotropyFor('off', 16), 1);
  assert.equal(anisotropyFor('default', 16), 4, 'the safe end, and the default');
  assert.equal(anisotropyFor('max', 16), 16, 'the driver’s own ceiling');
  // NEVER past the driver: a machine that allows 2 gets 2 for both the
  // default and the maximum, and a driver with no extension at all is 1.
  assert.equal(anisotropyFor('max', 2), 2);
  assert.equal(anisotropyFor('default', 2), 2);
  for (const t of ['off', 'default', 'max']) assert.equal(anisotropyFor(t, 0), 1, `${t} with no extension`);
  // an unknown tier - a pref stored by a future build - is the default,
  // never the maximum and never off
  for (const t of [undefined, null, '', 'nonsense', 16, true]) assert.equal(anisotropyFor(t, 16), 4, `${JSON.stringify(t)} falls back`);
  // and the row exists, with the safe default, as the player's own online
  assert.equal(FEATURE_PREF_DEFAULTS.groundSharpness, 'default');
  const row = FEATURES.find((f) => f.id === 'ground-sharpness');
  assert.ok(row, 'the Features row is there for the player to turn');
  assert.deepEqual(row.control.tiers.map(([k]) => k), ['off', 'default', 'max']);
  assert.equal(row.control.online, 'player', 'one player’s dial is not everyone’s');
  assert.match(row.effect, /world next loads/, 'the tile arrays are cached, so it lands on the next load - as the cloud dial does');
  // the renderer reads the dial rather than a number chosen once
  const r = read('src/render/renderer.js');
  assert.match(r, /const want = anisotropyFor\(getPref\('groundSharpness'\), this\._anisoMax\);/, 'read where the array is built');
  assert.match(r, /if \(want > 1\) gl\.texParameterf/, 'and 1 asks the driver for nothing at all');
});
