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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EL_GLSL, EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_BB_FS, EL_FAR_RING_FS, EL_LANE } from '../src/render/enhancedLighting.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PERF-FOG: elFinish takes the fog colour already decoded', () => {
  assert.match(EL_GLSL, /uniform vec3 uFogColorLin;/, 'declared in the shared block, so every consumer of elFinish has it');
  // elFinish lives in a block this module does not export, so the pin
  // reads the ASSEMBLED shaders - which is what the compiler sees, and
  // the only spelling that cannot pass while a header disagrees.
  for (const [n, src] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS], ['bb', EL_BB_FS]]) {
    assert.match(src, /vec3 col = mix\(uFogColorLin, tm, fogFactorAt\(wp\)\);/, `${n}: the finish takes it decoded`);
    assert.doesNotMatch(src, /mix\(elDecode\(uFogColor\), tm/, `${n}: the per-fragment decode is gone`);
    assert.match(src, /uniform vec3 uFogColorLin;/, `${n}: and declares the uniform it now reads`);
  }
  // every shader that pastes the block carries the finish, and therefore
  // the uniform - the point of putting it in the block rather than in four
  // headers is that a fifth lane shader cannot be written without it
  for (const [n, src] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS], ['bb', EL_BB_FS]]) {
    assert.ok(src.includes(EL_GLSL), `${n}: pastes the block`);
    assert.match(src, /elFinish\(/, `${n}: and calls the finish`);
  }
  // the FAR RING pastes the block but has its own finish and its own
  // upload path (farRing.draw's fogColor), so it keeps its own decode -
  // named here so the asymmetry reads as a decision
  assert.ok(EL_FAR_RING_FS.includes(EL_GLSL));
  assert.doesNotMatch(EL_FAR_RING_FS, /elFinish\(/, 'the ring finishes itself');
  assert.match(EL_FAR_RING_FS, /elDecode\(uFogColor\)/, '...so it still decodes its own, on its own path');
});

test('PERF-FOG: the host decodes through the LANE’S OWN curve, not a second copy of it', () => {
  // ONE DFU MEMBER ONE EXPORT applies to our own laws too. The lane
  // already carries the decoder the shader compiles - `decode3` - and the
  // renderer reaches it through the lane it was handed, so nothing here
  // restates the sRGB constants.
  const r = read('src/render/renderer.js');
  assert.match(r, /if \(this\._lane\) this\._lane\.decode3\(c, this\._fogLin\);/, 'the lane’s own decoder');
  assert.doesNotMatch(r, /Math\.pow\(\(v \+ 0\.055\) \/ 1\.055, 2\.4\)/, 'no second copy of the curve in the renderer');
  assert.equal(typeof EL_LANE.decode3, 'function');
  // and it really is elDecode's curve, checked at the knee the GLSL names
  const out = EL_LANE.decode3(new Float32Array([0.04045, 0.5, 1]), new Float32Array(3));
  assert.ok(Math.abs(out[0] - 0.04045 / 12.92) < 1e-7, 'below the threshold: the linear segment');
  assert.ok(Math.abs(out[1] - Math.pow((0.5 + 0.055) / 1.055, 2.4)) < 1e-6, 'above it: the power segment');
  assert.ok(Math.abs(out[2] - 1) < 1e-6, 'white stays white');
  // THE TWO MUST NOT DRIFT: read the four constants back out of the
  // shader text and hold them against the ones the host's curve uses.
  const glsl = /vec3 elDecode\(vec3 c\) \{([\s\S]*?)\n\}/.exec(EL_GLSL);
  assert.ok(glsl, 'elDecode is still in the block');
  for (const k of ['12.92', '0.055', '1.055', '2.4', '0.04045']) {
    assert.ok(glsl[1].includes(k), `the shader's curve still uses ${k} - if it moved, the host's must move with it`);
  }
});

test('PERF-FOG: the upload happens where the value MOVES, and only there', () => {
  const r = read('src/render/renderer.js');
  assert.match(r, /fogColorLin: gl\.getUniformLocation\(program, 'uFogColorLin'\),/, 'the location is looked up with the rest of the fog');
  assert.match(r, /if \(prog\.fogColorLin\) gl\.uniform3fv\(prog\.fogColorLin, this\._fogColorLinear\(\)\);/,
    'and uploaded only by a program that asked for it - a classic program does not declare it');
  // the cache is keyed on the display triple it was made from
  assert.match(r, /if \(was\[0\] !== c\[0\] \|\| was\[1\] !== c\[1\] \|\| was\[2\] !== c\[2\]\)/);
  // ...AND invalidated when the LANE changes, because a cache keyed on its
  // input alone cannot see that the function changed
  assert.match(r, /if \(this\._fogLinFrom\) this\._fogLinFrom\[0\] = NaN;/, 'a lane swap drops the old lane’s answer');
  assert.match(r, /new Float32Array\(\[NaN, NaN, NaN\]\)/, 'and the first call can never match an uninitialised zero triple');
  // ITS OWN SCRATCH. `_c3` hands `_decA` to whoever asks next, so a linear
  // fog kept in it would be overwritten by the very next colour uniform the
  // same draw uploads. The first draft grepped for `_decA` in a window after
  // the method name, and a mutant walked through it by aliasing on another
  // line - so the pin asks the two questions directly instead.
  assert.match(r, /this\._fogLin = new Float32Array\(3\);/, 'the linear fog owns its triple outright');
  assert.doesNotMatch(r, /this\._fogLin = this\._decA/, '...and is never aliased onto _c3\u2019s shared one');
});

test('PERF-FOG: a black fog is the failure this cannot be allowed to have, so the probe LINKS', () => {
  // A uniform the optimiser drops reads back as null, the upload skips it,
  // and elFinish then mixes toward a BLACK fog - a failure that compiles
  // clean and shows up only on a foggy day. Source cannot answer that;
  // only a driver can, so the probe links the four lane programs and asks
  // for the location.
  const probe = read('tools/perfSunShaderProbe.mjs');
  assert.match(probe, /getUniformLocation\(prog, 'uFogColorLin'\)/);
  assert.match(probe, /the uniform was optimised out - the fog would go black/);
  for (const k of ['mesh', 'terrain', 'char', 'bb']) assert.ok(probe.includes(`'${k}'`), `the probe covers the ${k} program`);
});
