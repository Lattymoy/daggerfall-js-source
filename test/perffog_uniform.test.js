// PERF-FOG (2026-09-19, the PERF-SUN sweep: Mac, "keep looking for
// improvements") - A UNIFORM WAS BEING DECODED ONCE A FRAGMENT.
//
// `elFinish` runs in every lane shader there is - the terrain, the meshes,
// the rigs and every flat in the world - and it opened with
// `mix(elDecode(uFogColor), tm, ...)`. `elDecode` is the piecewise sRGB
// curve: three `pow()` calls. On a UNIFORM. The value is the same for
// every pixel of the frame and it was being recomputed for every one of
// them. GLSL has nowhere to hoist a uniform-only expression to, so the
// only place it can be computed once is the host.
//
// EL-DISTANCE (2026-09-25, Mac: "It almost gives this weird darkness/foggy
// look to distant terrian which I really dont like") took the rest of the
// way: the lane blends the fog in DISPLAY space now, as the classic lane
// does, so the fog colour is used exactly as the host sends it and no
// fragment - and no host - decodes it at all. PERF-FOG's law (never a
// per-fragment decode of the fog uniform) holds more strongly than it did;
// its decoded uniform, cache and upload went with the linear blend.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EL_GLSL, EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_BB_FS, EL_FAR_RING_FS, EL_LANE } from '../src/render/enhancedLighting.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LANE = [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS], ['bb', EL_BB_FS]];

test('PERF-FOG + EL-DISTANCE: no lane fragment decodes the fog colour - the finish uses it as sent, in display space', () => {
  // elFinish lives in a block this module does not export, so the pin
  // reads the ASSEMBLED shaders - which is what the compiler sees, and
  // the only spelling that cannot pass while a header disagrees.
  for (const [n, src] of LANE) {
    assert.ok(src.includes(EL_GLSL), `${n}: pastes the block`);
    assert.match(src, /elFinish\(/, `${n}: and calls the finish`);
    assert.match(src, /vec3 col = mix\(uFogColor, elEncode\(tm\), fogFactorAt\(wp\)\);/, `${n}: the fog blended with the encoded surface`);
    assert.doesNotMatch(src, /elDecode\(uFogColor\)/, `${n}: never decoded a fragment`);
    assert.doesNotMatch(src, /uFogColorLin/, `${n}: and no decoded twin is asked for`);
    assert.match(src, /if \(glow\.r \+ glow\.g \+ glow\.b > 0\.0\) col = elEncode\(elDecode\(col\) \+ glow\);/, `${n}: a lantern's glow in the fog is still ADDED in linear, over the fogged surface`);
  }
  // the FAR RING finishes itself, and blends the same way
  assert.ok(EL_FAR_RING_FS.includes(EL_GLSL));
  assert.doesNotMatch(EL_FAR_RING_FS, /elFinish\(/, 'the ring finishes itself');
  assert.doesNotMatch(EL_FAR_RING_FS, /elDecode\(uFogColor\)/, '...and decodes no fog either');
});

test('PERF-FOG: the lane\u2019s decode3 is still elDecode\u2019s curve - the host\u2019s other colours go through it', () => {
  // ONE DFU MEMBER ONE EXPORT applies to our own laws too. The lane
  // carries the decoder the shader compiles - `decode3` - and the renderer
  // reaches it through the lane (its colour uniforms, `_c3`; the far ring),
  // so nothing restates the sRGB constants.
  const r = read('src/render/renderer.js');
  assert.match(r, /this\._lane \? this\._lane\.decode3\(src, scratch\) : src/, 'the lane\u2019s own decoder');
  assert.doesNotMatch(r, /Math\.pow\(\(v \+ 0\.055\) \/ 1\.055, 2\.4\)/, 'no second copy of the curve in the renderer');
  assert.equal(typeof EL_LANE.decode3, 'function');
  const out = EL_LANE.decode3(new Float32Array([0.04045, 0.5, 1]), new Float32Array(3));
  assert.ok(Math.abs(out[0] - 0.04045 / 12.92) < 1e-7, 'below the threshold: the linear segment');
  assert.ok(Math.abs(out[1] - Math.pow((0.5 + 0.055) / 1.055, 2.4)) < 1e-6, 'above it: the power segment');
  assert.ok(Math.abs(out[2] - 1) < 1e-6, 'white stays white');
  // THE TWO MUST NOT DRIFT: read the constants back out of the shader text
  const glsl = /vec3 elDecode\(vec3 c\) \{([\s\S]*?)\n\}/.exec(EL_GLSL);
  assert.ok(glsl, 'elDecode is still in the block');
  for (const k of ['12.92', '0.055', '1.055', '2.4', '0.04045']) {
    assert.ok(glsl[1].includes(k), `the shader's curve still uses ${k} - if it moved, the host's must move with it`);
  }
});

test('PERF-FOG + EL-DISTANCE: the host keeps no decoded fog - no uniform, no cache, no upload', () => {
  const r = read('src/render/renderer.js');
  assert.doesNotMatch(r, /uFogColorLin|fogColorLin|_fogColorLinear|_fogLin\b|_fogLinFrom/, 'the decoded fog\u2019s location, upload and cache are gone with the need for them');
  assert.match(r, /gl\.uniform3fv\(prog\.fogColor, this\._fogColor\);/, 'the display fog colour, as every program takes it');
});

test('PERF-FOG: a black fog is the failure this cannot be allowed to have, so the probe LINKS', () => {
  // A uniform the optimiser drops reads back as null, the upload skips it,
  // and elFinish then mixes toward a BLACK fog - a failure that compiles
  // clean and shows up only on a foggy day. Source cannot answer that;
  // only a driver can, so the probe links the four lane programs and asks
  // for the location.
  const probe = read('tools/perfSunShaderProbe.mjs');
  assert.match(probe, /getUniformLocation\(prog, 'uFogColor'\)/);
  assert.match(probe, /the uniform was optimised out - the fog would go black/);
  for (const k of ['mesh', 'terrain', 'char', 'bb']) assert.ok(probe.includes(`'${k}'`), `the probe covers the ${k} program`);
});
