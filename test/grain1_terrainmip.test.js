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
import { Renderer, anisotropyFor, groundSamplerFor, groundSharpnessTier } from '../src/render/renderer.js';

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
  assert.match(body, /this\._setGroundSampler\(groundSharpnessTier\(\)\)/, 'GRAIN AUDIT 1: minification is the TIER\u2019s, set by the one method the world load re-applies');
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
  const ext = r.slice(r.indexOf('  _anisoExtension() {'), r.indexOf('\n  }\n', r.indexOf('  _anisoExtension() {')));
  assert.match(ext, /getExtension\('EXT_texture_filter_anisotropic'\)/, 'asked for by name');
  assert.match(ext, /if \(this\._anisoExt === null\)/, 'GRAIN AUDIT 1: asked ONCE - null is "not asked", false is "the driver has none"; the old ||= re-asked every archive on a driver without it');
  assert.match(ext, /\?\? false;/, '...and an absent extension is remembered as false');
  const set = r.slice(r.indexOf('  _setGroundSampler(tier) {'), r.indexOf('\n  }\n', r.indexOf('  _setGroundSampler(tier) {')));
  assert.match(set, /groundSamplerFor\(tier, this\._anisoMax\)/, 'GRAIN2: how much of it is the machine\u2019s question, so it is read from the dial');
  assert.match(set, /if \(ext\) gl\.texParameterf/, 'and a driver without it still draws - the mipmap alone already fixes the grain');
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
  assert.match(row.effect, /world next loads/, 'the tile arrays are cached for the page, so the hosts RE-APPLY the tier at every world load (GRAIN AUDIT 1: before that this sentence was false - it landed on a page reload)');
  assert.deepEqual([...row.kinds], ['enhanced', 'classic'], 'GRAIN AUDIT 1: both lanes sample the one array, so both lanes get the dial');
  // the renderer reads the dial rather than a number chosen once
  const r = read('src/render/renderer.js');
  assert.match(r, /this\._setGroundSampler\(groundSharpnessTier\(\)\)/, 'read where the array is built - the door-or-pref tier into the one sampler method (GRAIN AUDIT 1)');
  assert.match(r, /groundSamplerFor\(tier, this\._anisoMax\)/, '...which asks the dial\u2019s law for the filter and the anisotropy together');
  assert.match(r, /if \(ext\) gl\.texParameterf\(gl\.TEXTURE_2D_ARRAY, ext\.TEXTURE_MAX_ANISOTROPY_EXT, s\.aniso\);/, 'GRAIN AUDIT 1: the value is SET whatever it is - 1 included - because a cached array at 16x has to come down to 1x when the player asks for Off; the old `if (want > 1)` skip left it where it was');
});


/** a GL that logs every call and answers enums with their own name (incident_dungeon_seams' rig) */
function recordingRenderer(log, { aniso = true, max = 16 } = {}) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return (p) => (p === 'MAX_TEXTURE_MAX_ANISOTROPY_EXT' ? max : new Float32Array([0, 0, 0, 0]));
      if (k === 'getExtension') return (name) => { log.push(['getExtension', name]); return name === 'EXT_texture_filter_anisotropic' ? (aniso ? { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 'MAX_TEXTURE_MAX_ANISOTROPY_EXT', TEXTURE_MAX_ANISOTROPY_EXT: 'TEXTURE_MAX_ANISOTROPY_EXT' } : null) : {}; };
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 640, clientHeight: 400, width: 640, height: 400 };
  const r = new Renderer(canvas);
  log.length = 0;
  return r;
}
const calls = (log, name) => log.filter((c) => c[0] === name);
const layers = () => [{ width: 2, height: 2, colors: new Uint8ClampedArray(16) }, { width: 2, height: 2, colors: new Uint8ClampedArray(16) }];

test('GRAIN AUDIT 1: the tier is sampler state - EXECUTED: one chain per archive, nothing on a cached archive, the filter and the anisotropy by tier, and the dial LANDS on a world load', () => {
  assert.deepEqual(groundSamplerFor('off', 16), { aniso: 1, minFilter: 'NEAREST_MIPMAP_NEAREST' }, 'Off is the mipmap alone, point-sampled: ONE fetch, the pre-GRAIN1 cost with the boil gone');
  assert.deepEqual(groundSamplerFor('default', 16), { aniso: 4, minFilter: 'LINEAR_MIPMAP_LINEAR' });
  assert.deepEqual(groundSamplerFor('max', 16), { aniso: 16, minFilter: 'LINEAR_MIPMAP_LINEAR' });
  assert.deepEqual(groundSamplerFor('nonsense', 8), { aniso: 4, minFilter: 'LINEAR_MIPMAP_LINEAR' }, 'a junk tier is the default');
  assert.equal(groundSharpnessTier('?ground=max'), 'max', 'the ?ground door names the tier');
  assert.equal(groundSharpnessTier('?x=1'), 'default', '...and without it the pref answers (a fresh shelf: the row\u2019s default)');
  const log = [];
  const r = recordingRenderer(log);
  r.uploadTileArray(302, layers());
  assert.equal(calls(log, 'generateMipmap').length, 1, 'one chain per archive');
  assert.ok(log.findIndex((c) => c[0] === 'texSubImage3D') < log.findIndex((c) => c[0] === 'generateMipmap'), 'built after the layers');
  const minOf = (l) => calls(l, 'texParameteri').filter((c) => c[2] === 'TEXTURE_MIN_FILTER').pop()?.[3];
  const anisoOf = (l) => calls(l, 'texParameterf').filter((c) => c[2] === 'TEXTURE_MAX_ANISOTROPY_EXT').pop()?.[3];
  assert.equal(minOf(log), 'LINEAR_MIPMAP_LINEAR', 'the default tier: trilinear'); assert.equal(anisoOf(log), 4, '...at 4x');
  assert.equal(calls(log, 'texParameteri').find((c) => c[2] === 'TEXTURE_MAG_FILTER')[3], 'NEAREST');
  assert.equal(calls(log, 'getExtension').filter((c) => c[1] === 'EXT_texture_filter_anisotropic').length, 1, 'the extension asked once');
  log.length = 0;
  r.uploadTileArray(302, layers());
  assert.equal(log.length, 0, 'a cached archive costs NOTHING - no upload, no chain, no parameter (the cache is what makes this feature free per frame, and nothing had pinned it)');
  r.uploadTileArray(303, layers());
  assert.equal(calls(log, 'generateMipmap').length, 1, 'a second archive builds its own chain');
  assert.equal(calls(log, 'getExtension').length, 0, '...and asks for no extension again');
  // THE DIAL LANDS: the world load re-applies the tier over every cached array
  log.length = 0;
  r._tArrayTex = {};   // as if a terrain draw had bound an array this frame
  const s = r.applyGroundSharpness('off');
  assert.deepEqual(s, { aniso: 1, minFilter: 'NEAREST_MIPMAP_NEAREST' });
  assert.equal(calls(log, 'bindTexture').filter((c) => c[1] === 'TEXTURE_2D_ARRAY').length, 2, 'both cached arrays bound');
  assert.deepEqual(calls(log, 'texParameteri').filter((c) => c[2] === 'TEXTURE_MIN_FILTER').map((c) => c[3]), ['NEAREST_MIPMAP_NEAREST', 'NEAREST_MIPMAP_NEAREST'], 'Off: point-sampled over the chain, on BOTH');
  assert.deepEqual(calls(log, 'texParameterf').map((c) => c[3]), [1, 1], 'and the anisotropy SET to 1, not skipped - a cached array at 16x must come down');
  assert.equal(calls(log, 'generateMipmap').length, 0, 'no chain rebuilt'); assert.equal(calls(log, 'texSubImage3D').length, 0, 'no upload');
  assert.equal(r.groundTier, 'off');
  assert.equal(r._tArrayTex, null, 'PERF-TEX2\u2019s array shadow is forgotten, so the next terrain draw binds its own');
  log.length = 0;
  r.applyGroundSharpness('max');
  assert.deepEqual(calls(log, 'texParameterf').map((c) => c[3]), [16, 16], 'Maximum: the driver\u2019s ceiling');
  assert.deepEqual(calls(log, 'texParameteri').filter((c) => c[2] === 'TEXTURE_MIN_FILTER').map((c) => c[3]), ['LINEAR_MIPMAP_LINEAR', 'LINEAR_MIPMAP_LINEAR']);
  // a driver WITHOUT the extension: asked once, remembered as false, never asked again, and the filter still set
  const log2 = [];
  const r2 = recordingRenderer(log2, { aniso: false });
  r2.uploadTileArray(302, layers()); r2.uploadTileArray(303, layers()); r2.applyGroundSharpness('max');
  assert.equal(calls(log2, 'getExtension').filter((c) => c[1] === 'EXT_texture_filter_anisotropic').length, 1, 'asked ONCE on a driver without it (the old ||= memo of null re-asked every archive)');
  assert.equal(calls(log2, 'texParameterf').length, 0, 'and no anisotropy call is made');
  assert.equal(r2._anisoExt, false);
  assert.deepEqual(calls(log2, 'texParameteri').filter((c) => c[2] === 'TEXTURE_MIN_FILTER').map((c) => c[3]).slice(-2), ['LINEAR_MIPMAP_LINEAR', 'LINEAR_MIPMAP_LINEAR'], 'the filter is still the tier\u2019s');
  // the hosts: both call the re-apply at their world load, AFTER the tile-array guard
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = read(host);
    const guard = h.indexOf('if (!renderer.tileArrays.has(groundArchive)) {');
    const apply = h.indexOf('renderer.applyGroundSharpness();', guard);
    assert.ok(guard > 0 && apply > guard && apply - guard < 1200, `${host}: the tier is re-applied right after the guard, cached or not`);
  }
  // the one real-GPU instrument can be pointed at a tier
  const probe = read('tools/perfProbe.mjs');
  assert.ok(probe.includes("process.env.GROUND ? `&ground=${encodeURIComponent(process.env.GROUND)}` : ''") && probe.includes('${url}${GROUND}`'), 'GROUND=off|default|max rides every scene URL through the ?ground door');
});
