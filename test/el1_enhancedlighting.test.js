// EL1 - ENHANCED LIGHTING, TIER ONE: FOUNDATIONS (2026-09-17, Mac: "enhance
// our lighting system tenfold" - tiers 1, 2 and 3).
//
// The lane (render/enhancedLighting.js) replaces the renderer's four world
// fragment shaders and the far ring's with a linear pipeline: sRGB decode,
// windowed inverse-square lanterns (48 of them), exposure + extended
// Reinhard, fog in-scatter, sRGB encode. The pure functions ARE the
// shader's terms, so the arithmetic the GPU runs is pinned here without a
// GPU; the renderer's program swap is pinned on the fake GL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EL_LANE, EL_MAX_LIGHTS, EL_CLASSIC_MAX_LIGHTS, EL_EXPOSURE, EL_WHITE, EL_LIGHT_GAIN, EL_FLAME_COLOR, EL_SCATTER,
  EL_MESH_FS, EL_BB_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_FAR_RING_FS, EL_GLSL,
  enhancedLightingOn, exposureFor, elDecode, elEncode, elDecode3, elDecodeN, elAttenuation, elTonemap, elScatter,
  elScatterDensity, syncLightingLane, lanternColor,
} from '../src/render/enhancedLighting.js';
import { Renderer } from '../src/render/renderer.js';
import { FarRingRenderer } from '../src/render/farRing.js';
import { FEATURES, featureForControl } from '../src/systems/features.js';
import { setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { setUiSkin, uiSkin } from '../src/systems/uiSkin.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/** A recording fake GL: every call logged, uniform locations are their
 *  names (so an upload can be found by the uniform it went to). */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => { calls.push(['getUniformLocation', _p, n]); return n; };   // logged too: an install looks every location up again, a no-op looks up none
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      // a typed array is COPIED at the call, as the driver copies it - the renderer's decode scratch is reused between uploads
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Float32Array.from(a) : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
const count = (calls, name) => calls.filter((c) => c[0] === name).length;
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('EL1: the switch - the enhanced skin, the pref, and ?lighting=classic as the kill door; ?exposure= the tuning door', () => {
  const skin = uiSkin(); const pref = PREF_DEFAULTS.enhancedLighting;
  try {
    setUiSkin('enhanced'); setPref('enhancedLighting', true);
    assert.equal(enhancedLightingOn(''), true, 'on by default on the enhanced skin');
    assert.equal(enhancedLightingOn('?lighting=classic'), false, 'the kill door');
    assert.equal(enhancedLightingOn('?lighting=on'), true, 'any other value is not the door');
    setPref('enhancedLighting', false);
    assert.equal(enhancedLightingOn(''), false, 'the pref is the switch');
    setPref('enhancedLighting', true); setUiSkin('classic');
    assert.equal(enhancedLightingOn(''), false, 'the classic skin lights as DFU does whatever the pref says');
  } finally { setUiSkin(skin); setPref('enhancedLighting', pref); }
  assert.equal(exposureFor(''), EL_EXPOSURE);
  assert.equal(exposureFor('?exposure=1.2'), 1.2);
  assert.equal(exposureFor('?exposure=0'), EL_EXPOSURE, 'a non-positive exposure is the default');
  assert.equal(exposureFor('?exposure=bright'), EL_EXPOSURE, 'a non-number is the default');
  assert.equal(EL_EXPOSURE, 1.4); assert.equal(EL_WHITE, 4); assert.equal(EL_MAX_LIGHTS, 48); assert.equal(EL_CLASSIC_MAX_LIGHTS, 16);
});

test('EL1: the row is the Features home\'s, on by default, forced on online', () => {
  const f = FEATURES.find((x) => x.id === 'enhanced-lighting');
  assert.ok(f, 'the row exists');
  assert.equal(f.group, 'sight');
  assert.deepEqual(f.kinds, ['enhanced']);
  assert.deepEqual(f.control, { store: 'prefs', key: 'enhancedLighting', initial: true, online: true });
  assert.equal(PREF_DEFAULTS.enhancedLighting, true, 'on by default like the other enhanced visuals');
  assert.equal(featureForControl('prefs', 'enhancedLighting'), f);
  assert.match(f.effect, /when the world next loads/);
});

test('EL1: sRGB decode and encode are the IEC curve, inverse of each other, and the triple/packed forms are the scalar one', () => {
  assert.ok(near(elDecode(0.5), 0.21404114, 1e-6), 'the textbook 0.5 -> 0.214');
  assert.ok(near(elDecode(0.04045), 0.04045 / 12.92, 1e-9), 'the linear toe');
  assert.equal(elDecode(0), 0); assert.ok(near(elDecode(1), 1, 1e-9));
  assert.ok(near(elEncode(0.21404114), 0.5, 1e-6));
  assert.equal(elEncode(-0.5), 0, 'clamped below'); assert.ok(near(elEncode(2), 1, 1e-9), 'clamped above (1.055 - 0.055, to the double\'s last bit)');
  for (const v of [0, 0.001, 0.003, 0.01, 0.12, 0.3, 0.5, 0.8, 1]) assert.ok(near(elEncode(elDecode(v)), v, 1e-9), `round trip ${v}`);
  const out = new Float32Array(3);
  assert.equal(elDecode3([0.5, 0.12, 1], out), out);
  assert.ok(near(out[0], elDecode(0.5), 1e-7) && near(out[1], elDecode(0.12), 1e-7) && near(out[2], 1, 1e-7));
  const packed = new Float32Array(9);
  const got = elDecodeN(new Float32Array([0.5, 0.5, 0.5, 0.12, 0.12, 0.12, 1, 1, 1]), packed, 2);
  assert.equal(got.length, 6, 'the first count*3');
  assert.ok(near(got[3], elDecode(0.12), 1e-7)); assert.ok(near(got[5], elDecode(0.12), 1e-7), 'the last channel of the last light'); assert.equal(packed[6], 0, 'the third light was not asked for');
});

test('EL1: the lantern falloff - GAIN at the flame, exactly zero at the range and beyond, monotone, hotter than the classic shape near and within a third of it far', () => {
  const classic = (d, r) => { const a = Math.max(0, 1 - d / r); return a * a; };
  assert.equal(elAttenuation(0, 10), EL_LIGHT_GAIN);
  assert.equal(elAttenuation(10, 10), 0); assert.equal(elAttenuation(11, 10), 0);
  assert.equal(elAttenuation(1, 0), 0, 'a zero range lights nothing'); assert.equal(elAttenuation(1, -1), 0);
  let last = Infinity;
  for (let d = 0; d <= 10; d += 0.05) { const a = elAttenuation(d, 10); assert.ok(a <= last, `monotone at ${d}`); last = a; }
  assert.ok(near(elAttenuation(5, 10), 0.4 * 0.9375 * 0.9375, 1e-12), 'the arithmetic at half range: 2/(1+4) x (1 - 0.5^4)^2');
  assert.ok(near(elAttenuation(2, 10), 2 / 1.64 * 0.9984 * 0.9984, 1e-12), 'and at a fifth');
  assert.ok(elAttenuation(1, 10) > classic(1, 10), 'hotter at a tenth of the range');
  assert.ok(elAttenuation(2, 10) > classic(2, 10), 'hotter at a fifth');
  for (const d of [5, 6, 7, 8, 9]) assert.ok(Math.abs(elAttenuation(d, 10) - classic(d, 10)) < classic(d, 10) / 3 + 0.02, `within a third of classic at ${d}: ${elAttenuation(d, 10)} vs ${classic(d, 10)}`);
  // the GLSL is the same arithmetic: GAIN, KNEE and the window, verbatim
  assert.match(EL_GLSL, /return 2\.0 \/ \(1\.0 \+ 16\.0 \* x2\) \* win;/);
});

test('EL1: the tonemap - identity in the dark end, the white point to 1.0, monotone, and never above 1 below the white', () => {
  assert.equal(elTonemap(0), 0); assert.equal(elTonemap(-1), 0);
  assert.ok(near(elTonemap(0.01), 0.01, 1e-4), 'a 0.01 (a dungeon wall\'s ambient in linear) is itself within 1%');
  assert.ok(near(elTonemap(EL_WHITE), 1, 1e-12), 'the white point maps to display white');
  let last = -1;
  for (let x = 0; x <= 8; x += 0.01) { const t = elTonemap(x); assert.ok(t >= last, `monotone at ${x}`); last = t; }
  for (let x = 0; x < EL_WHITE; x += 0.05) assert.ok(elTonemap(x) < 1, `under white at ${x}`);
  assert.equal(elTonemap(1), 0.53125, '1.0 lands on the shoulder: (1 + 1/16) / 2');
  // the numbers the module's exposure note claims, on the classic lane's scale
  const display = (v) => elEncode(elTonemap(elDecode(v) * EL_EXPOSURE));
  assert.ok(near(display(0.12), 0.14, 0.01), `a 0.12 wall lands near 0.14: ${display(0.12)}`);
  assert.ok(near(display(0.5), 0.52, 0.01), `0.5 near 0.52: ${display(0.5)}`);
  assert.ok(near(display(1), 0.82, 0.01), `1.0 near 0.82: ${display(1)}`);
});

test('EL1: the in-scatter integral matches a numeric integration of the point light along the ray, is windowed to the range, and is zero with no fog', () => {
  const numeric = (light, range, dir, dist, density, n = 20000) => {
    let acc = 0; const h = dist / n;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * h;
      const px = dir[0] * t - light[0], py = dir[1] * t - light[1], pz = dir[2] * t - light[2];
      const d2 = px * px + py * py + pz * pz;
      if (Math.sqrt(d2) > range) continue;   // the light reaches no further than its range
      acc += h / Math.max(d2, 0.0625);
    }
    return acc * density;
  };
  const dir = [0, 0, 1];
  // a torch two units off the ray, six units along it, the wall at 20
  const a = elScatter([2, 0, 6], 30, dir, 20, 0.05);
  assert.ok(near(a, numeric([2, 0, 6], 30, dir, 20, 0.05), 2e-3), `analytic ${a} vs numeric`);
  // the window: a light of range 4 lights only the ray from t=2 to t=10
  const b = elScatter([2, 0, 6], 4, dir, 20, 0.05);
  assert.ok(b < a, 'a shorter range gives back less');
  assert.ok(near(b, 0.05 * (Math.atan(4 / 2) - Math.atan(-4 / 2)) / 2, 1e-9), 'the closed form over [t0 - range, t0 + range]');
  assert.equal(elScatter([2, 0, 30], 4, dir, 20, 0.05), 0, 'a light wholly beyond the wall\'s range window contributes nothing');
  assert.equal(elScatter([2, 0, 6], 30, dir, 20, 0), 0, 'no density, no glow');
  assert.equal(elScatter([2, 0, 6], 0, dir, 20, 0.05), 0, 'no range, no glow');
  assert.equal(elScatter([2, 0, 6], 30, dir, 0, 0.05), 0, 'no ray, no glow');
  // a light ON the ray is clamped to a quarter unit off it, never a division by zero
  assert.ok(Number.isFinite(elScatter([0, 0, 6], 30, dir, 20, 0.05)));
  // the density per fog mode
  assert.equal(elScatterDensity(0, 0.5, 0, 10), 0);
  assert.equal(elScatterDensity(1, 0, 10, 50), 1 / 40, 'linear: one over the span');
  assert.equal(elScatterDensity(2, 0.02, 0, 0), 0.02); assert.equal(elScatterDensity(3, 0.02, 0, 0), 0.02);
  assert.equal(EL_SCATTER, 0.35);
});

test('EL1: the five lane shaders declare the 48-light arrays and the lane\'s two uniforms, carry the classic terms they replace, and the classic shaders are untouched', () => {
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['bb', EL_BB_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS]]) {
    assert.match(fs, /uniform vec4 uPointLights\[48\];/, `${name}: 48 lights`);
    assert.match(fs, /uniform vec3 uPointColors\[48\];/, `${name}: 48 colours`);
    assert.match(fs, /uniform float uELExposure;/, `${name}: the exposure`);
    assert.match(fs, /uniform float uELScatter;/, `${name}: the in-scatter`);
    assert.match(fs, /elDecode\(/, `${name}: decodes`); assert.match(fs, /elEncode\(col\)/, `${name}: encodes`);
    // PERF-FOG (2026-09-19) moved the DECODE, not the law: the fog colour
    // is still blended in linear and re-encoded, so a fogged fragment is
    // still exactly the fog colour - it just arrives decoded, because
    // three pow() on a uniform, once a fragment, in every lane shader
    // there is, was the thing being paid for saying it here.
    assert.match(fs, /mix\(uFogColorLin, tm, fogFactorAt\(wp\)\)/, `${name}: the fog colour is blended in LINEAR and re-encoded, so a fogged fragment IS the fog colour`);
    assert.match(fs, /uniform vec3 uFogColorLin;/, `${name}: ...and it is the decoded one the host sends`);
    assert.ok(!/\(1\.0 - d \/ uPointLights/.test(fs), `${name}: no classic falloff`);
    assert.match(fs, /uCloudShadowRect/, `${name}: the cloud shadow`);
  }
  assert.match(EL_MESH_FS, /uTrilight > 0\.5/, 'the mesh keeps BA1\'s trilight');
  assert.match(EL_MESH_FS, /uAutomapMode/, 'the mesh keeps the automap presentation');
  assert.match(EL_MESH_FS, /max\(elDecode\(tex\.rgb\) - emission, vec3\(0\.0\)\)/, 'emission cancels other light, in linear');
  assert.match(EL_BB_FS, /uConceal\.x == 2\.0\) lit \*= /, 'the billboard keeps the shade');
  assert.match(EL_TERRAIN_FS, /texelFetch\(uTilemap, cell, 0\)/, 'the terrain keeps its tilemap read');
  assert.match(EL_CHAR_FS, /elDecode\(vColor \* texel\.rgb\)/, 'the rig\'s vertex colour decodes like a texel');
  assert.match(EL_FAR_RING_FS, /uniform float uELExposure;/); assert.match(EL_FAR_RING_FS, /gl_FragDepth = 1\.0;/, 'the ring stays at the far plane');
  assert.ok(!/uPointLights/.test(EL_FAR_RING_FS), 'the ring takes no lanterns, as before');
  // the classic shaders: the sixteen, the classic falloff, no lane uniform
  const r = read('src/render/renderer.js');
  assert.equal((r.match(/uniform vec4 uPointLights\[16\];/g) || []).length, 4, 'four classic programs at sixteen');
  assert.equal((r.match(/float att = clamp\(1\.0 - d \/ uPointLights\[i\]\.w, 0\.0, 1\.0\);/g) || []).length, 4, 'the classic falloff, four programs');
  assert.ok(!/uELExposure/.test(r.slice(0, r.indexOf('export class Renderer'))), 'no lane uniform in a classic shader');
  assert.ok(!/import .* from '\.\/enhancedLighting\.js'/.test(r), 'the renderer does not import the lane - a host hands it over, and a classic page never loads its shaders into a program');
  assert.match(r, /const CLASSIC_MAX_LIGHTS = 16;/); assert.ok(!/16 \* 4|16 \* 3|Math\.min\(15,/.test(r), 'no literal cap in the renderer');
});

test('EL1: the renderer builds the classic set alone, compiles the lane once on install, keeps it across swaps, and re-cuts the light cap', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  const boot = count(calls, 'compileShader');
  assert.equal(boot, 12, 'the classic boot: four world programs + water + water surface, a VS and an FS each');
  const classicMesh = r.program, classicBb = r.bbProgram, classicTerrain = r.terrainProgram, classicChar = r.charProgram;
  assert.equal(r.lightingLane, null); assert.equal(r.maxPointLights, 16);
  r.setLightingLane(EL_LANE);
  assert.equal(count(calls, 'compileShader') - boot, 18, 'the lane: four programs, a VS and an FS each; EL2: and the shadow pass\'s three depth programs; EL7: the rigs\' depth program and the water surface\'s lane program');
  assert.equal(r.lightingLane, EL_LANE); assert.equal(r.maxPointLights, 48);
  assert.notEqual(r.program, classicMesh); assert.notEqual(r.bbProgram, classicBb); assert.notEqual(r.terrainProgram, classicTerrain); assert.notEqual(r.charProgram, classicChar);
  const laneMesh = r.program;
  const lookups = count(calls, 'getUniformLocation');
  r.setLightingLane(EL_LANE);
  assert.equal(count(calls, 'compileShader') - boot, 18, 'the same lane again compiles nothing');
  assert.equal(count(calls, 'getUniformLocation'), lookups, 'and looks nothing up: the same lane again is a no-op');
  r.setLightingLane(null);
  assert.equal(count(calls, 'compileShader') - boot, 18, 'back to classic compiles nothing');
  assert.equal(r.program, classicMesh); assert.equal(r.bbProgram, classicBb); assert.equal(r.terrainProgram, classicTerrain); assert.equal(r.charProgram, classicChar);
  assert.equal(r.maxPointLights, 16); assert.equal(r.lightingLane, null);
  r.setLightingLane(EL_LANE);
  assert.equal(count(calls, 'compileShader') - boot, 18, 'the lane again is the kept set');
  assert.equal(r.program, laneMesh);
  // the cap: 48 lights survive setPointLights on the lane, 16 on classic
  const lights = new Float32Array(60 * 4).map((_, i) => i);
  r.setPointLights(lights, new Float32Array([1, 1, 1]));
  assert.equal(r._pointLights.length, 48 * 4);
  r.setLightingLane(null);
  assert.equal(r._pointLights.length, 16 * 4, 'a list stored under the lane is re-cut to the classic cap');
  r.setPointLights(lights, new Float32Array([1, 1, 1]));
  assert.equal(r._pointLights.length, 16 * 4);
  // the flash rides one slot under the installed cap
  r.setLightingLane(EL_LANE);
  r.setPointLights(lights, new Float32Array([1, 1, 1]));
  r.setFlashLight({ x: 1, y: 2, z: 3, range: 500, color: [1, 1, 1] });
  assert.equal(r._pointLights.length, 48 * 4, 'the flash plus 47 of the host\'s');
  assert.equal(r._pointLights[0], 1);
  // the cloud-shadow slot the water surface adds survives every install
  assert.ok(Array.isArray(r._csLoc.water) && r._csLoc.water.length === 2);
});

test('EL1: on the lane every colour goes up decoded and the lane\'s uniforms ride each program; on classic the colours go up as given and nothing of the lane is uploaded', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  const amb = new Float32Array([0.5, 0.12, 1]);
  r.setLighting(amb, 0.55, new Float32Array([1, 0.9, 0.8]));
  r.setFog('linear', 0, 10, 50, new Float32Array([0.3, 0.3, 0.3]));
  const up = (name) => calls.filter((c) => (c[0] === 'uniform3fv' || c[0] === 'uniform1f' || c[0] === 'uniform3f') && c[1] === name);
  // classic
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  assert.deepEqual([...up('uAmbient')[0][2]], [...amb], 'classic: as given');
  assert.equal(up('uELExposure').length, 0, 'classic: no lane uniform');
  // the lane
  r.setLightingLane(EL_LANE); r.setExposure(1.25);
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  const a = up('uAmbient')[0][2];
  assert.ok(near(a[0], elDecode(0.5), 1e-6) && near(a[1], elDecode(0.12), 1e-6) && near(a[2], 1, 1e-6), 'the lane: decoded');
  const s = up('uSunColor')[0][2];
  assert.ok(near(s[1], elDecode(0.9), 1e-6));
  assert.equal(up('uELExposure')[0][2], 1.25, 'the exposure');
  assert.ok(near(up('uELScatter')[0][2], EL_SCATTER / 40, 1e-9), 'the in-scatter gain folded with the linear fog\'s 1/span');
  // the terrain block, the billboards and the character carry the lane too
  calls.length = 0;
  r.drawTerrain({ vao: {}, indexCount: 6 }, I, {}, {}, 6.4);
  assert.equal(up('uELExposure').length, 1, 'terrain'); assert.ok(near(up('uAmbient')[0][2][1], elDecode(0.12), 1e-6));
  calls.length = 0;
  r.drawBillboards([], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  assert.equal(up('uELExposure').length, 1, 'billboards');
  const tint = up('uTint')[0];
  assert.ok(near(tint[2], elDecode(0.5), 1e-6) && near(tint[3], elDecode(0.12), 1e-6), 'the billboard tint is the decoded ambient (no moon)');
  const bbSun = up('uBBSun')[0];
  assert.ok(near(bbSun[3], elDecode(0.9) * 0.55 * 0.5, 1e-6), 'the sun\'s half, decoded first');
  calls.length = 0;
  r.drawCharacter({ vao: {}, count: 3 }, I);
  assert.equal(up('uELExposure').length, 1, 'character');
  // the fog off: the in-scatter gain is zero
  r.setFog('off', 0, 0, 0, null);
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  assert.equal(up('uELScatter')[0][2], 0);
  // the point colours decode too (the shared colour splatted, then decoded)
  r.setPointLights(new Float32Array([0, 0, 0, 10]), new Float32Array([0.5, 0.5, 0.5]));
  const pc = r._pointColorData(1);
  assert.ok(near(pc[0], elDecode(0.5), 1e-6));
  r.setLightingLane(null);
  assert.equal(r._pointColorData(1)[0], 0.5, 'classic: as given');
});

test('EL1: the far ring takes the lane at construction - its FS, the decode, the exposure - and is the classic ring without one', () => {
  const { calls, gl } = recordingGl();
  const classic = new FarRingRenderer(gl);
  assert.equal(classic.lane, null);
  const laned = new FarRingRenderer(gl, { lane: EL_LANE });
  const sources = calls.filter((c) => c[0] === 'shaderSource').map((c) => c[2]);
  assert.equal(sources.length, 4);
  assert.ok(!/uELExposure/.test(sources[1]), 'the classic ring\'s FS');
  assert.equal(sources[3], EL_FAR_RING_FS, 'the lane\'s FS');
  // draw on the lane decodes the scene colours and uploads the exposure
  laned._built = true; laned.indexCount = 3; laned.vao = {};
  calls.length = 0;
  laned.draw(I, { origin: [0, 0, 0], lightDir: [0, 1, 0], ambient: new Float32Array([0.5, 0.5, 0.5]), sunScale: 1, sunColor: new Float32Array([1, 1, 1]), fogColor: new Float32Array([0.5, 0.5, 0.5]), fogEnd: 100, fovY: 1, aspect: 1, exposure: 1.4 });
  const amb = calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uAmbient');
  assert.ok(near(amb[2][0], elDecode(0.5), 1e-6));
  assert.ok(calls.some((c) => c[0] === 'uniform1f' && c[1] === 'uELExposure' && c[2] === 1.4));
  const fog = calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uFogColor');
  assert.equal(fog[2][0], 0.5, 'the fog colour goes up as given - the shader decodes it beside the sky');
});

test('EL1: syncLightingLane is the host\'s one call, the flame colour rides the lane, and every host reads the installed cap', () => {
  const skin = uiSkin(); const pref = PREF_DEFAULTS.enhancedLighting;
  const seen = [];
  const fake = { setLightingLane: (l) => seen.push(['lane', l]), setExposure: (v) => seen.push(['exposure', v]), setAir: (v) => seen.push(['air', v]) };
  try {
    setUiSkin('enhanced'); setPref('enhancedLighting', true);
    assert.equal(syncLightingLane(fake, '?exposure=1.1'), true);
    assert.deepEqual(seen, [['lane', EL_LANE], ['exposure', 1.1], ['air', true]]);   // EL3: the air door too
    seen.length = 0;
    assert.equal(syncLightingLane(fake, '?exposure=1.1&air=off'), true);
    assert.deepEqual(seen, [['lane', EL_LANE], ['exposure', 1.1], ['air', false]], 'EL3: ?air=off keeps the lane and closes the air');
    seen.length = 0;
    assert.equal(syncLightingLane(fake, '?lighting=classic'), false);
    assert.deepEqual(seen, [['lane', null]], 'off installs the classic set and leaves the exposure and the air alone');
  } finally { setUiSkin(skin); setPref('enhancedLighting', pref); }
  const white = new Float32Array([1, 1, 1]);
  assert.equal(lanternColor(false, white), white, 'off: the host\'s own colour, the same object');
  const flame = lanternColor(true, white);
  assert.deepEqual([...flame].map((v) => +v.toFixed(3)), [...EL_FLAME_COLOR]);
  const dim = lanternColor(true, new Float32Array([0.8, 0.8, 0.8]));
  assert.ok(near(dim[1], 0.72 * 0.8, 1e-6), 'the flame at the host\'s intensity');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/interior.js']) {
    assert.match(read(f), /syncLightingLane\(renderer\)/, `${f} installs the lane at mount`);
  }
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/interior.js', 'src/scenes/worldModes.js']) {
    const s = read(f);
    assert.ok(!/nearestLights\([^)]*, 16,/.test(s), `${f}: no literal sixteen`);
    assert.match(s, /nearestLights\([^)]*renderer\.maxPointLights/, `${f}: the installed cap`);
  }
  assert.match(read('src/scenes/world.js'), /new FarRingRenderer\(renderer\.gl, \{ lane: renderer\.lightingLane \}\)/, 'the ring takes the same lane');
  assert.match(read('src/scenes/world.js'), /exposure: renderer\.exposure/, 'and the same exposure');
  assert.match(read('src/scenes/worldModes.js'), /lanternColor\(!!renderer\.lightingLane, new Float32Array\(DUNGEON_LIGHT_COLOR\)\)/);
  assert.ok(!/lanternColor/.test(read('src/scenes/interior.js')), 'the interior\'s lights carry their own colours (interiorLightProperties) - no flame over them');
});
