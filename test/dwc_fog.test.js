// DW-C: Iliac Puddle No More's distance fog (UnderwaterDistanceFog.shader and
// UnderwaterDistanceFogEffect.cs, jet082) - the port's per-fragment copy
// against the mod's own fragment program, transcribed below line for line
// (its GLCore read-back, u_xlat for u_xlat), over the material values the
// C# hands it. The CPU half (world/deepWaterLook.js), the GLSL every world
// program takes (render/fogGlsl.js, run through test/glsl.mjs) and the
// sky's two-pass blend (render/deepWatersRender.js) must each give the
// post effect's colour for the same pixel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from './glsl.mjs';
import { FOG_GLSL } from '../src/render/fogGlsl.js';
import { SKY_FOG_FS, DeepWatersRenderer } from '../src/render/deepWatersRender.js';
import {
  distanceFogUniforms, distanceFogAt, distanceFogRayLength, horizonAmbientColor, underwaterFogColor,
} from '../src/world/deepWaterLook.js';
import { perspective, lookAt, mirrorProjectionX, multiply } from '../src/world/mat4.js';
import { createDeepWatersPlayer } from '../src/scenes/deepWatersPlayer.js';
import { Renderer } from '../src/render/renderer.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * clamp01(t);
const lerpC = (a, b, t) => [0, 1, 2].map((i) => lerp(a[i], b[i], t));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** UnderwaterDistanceFogEffect.ConfigureMaterial + ConfigureVolumetricRegrade, and DeepWaters' slider curves. */
function material({ fogStrength, fogDistance, waterDepth }, daylight, oceanY) {
  const n = clamp01(fogDistance);
  const mult = n <= 0.5 ? lerp(0.25, 1, n / 0.5) : lerp(1, 6, (n - 0.5) / 0.5);   // FogDistanceSliderToMultiplier
  const s = clamp01(fogStrength);
  const fc = lerpC([0.035, 0.065, 0.075], [14 / 255, 25 / 255, 21 / 255], daylight);   // GetUnderwaterFogColor
  const lum = fc[0] * 0.299 + fc[1] * 0.587 + fc[2] * 0.114;
  const scatter = lerpC([0.02, 0.04, 0.045], lerpC([0.09, 0.165, 0.155], [lum * 0.6, lum * 0.95, lum * 0.85], 0.25), daylight);
  return {
    vision: Math.min(360, Math.max(22, 95 * Math.max(0.001, mult))), strength: s,
    ddStart: 6, ddEnd: Math.min(110, Math.max(55, waterDepth * 0.75)), surfaceY: oceanY,
    absorption: [1.8, 1.25, 1.05], scatter, scatterStrength: lerp(0.85, 1.3, s),
    deep: lerpC([0.003, 0.006, 0.009], [0.012, 0.022, 0.026], daylight),
  };
}

/**
 * UnderwaterDistanceFog.shader's fragment program, as read back: `col` the
 * image's colour, `ray` the corner rays' blend (per unit of eye depth),
 * `linDepth` the linear eye depth the depth texture gives (null: the far
 * plane, the sky's arm).
 */
function shaderOracle(m, cam, col, ray, linDepth) {
  const sky = linDepth == null;
  let x15 = -cam[1] + m.surfaceY;
  let x22 = Math.max(x15, 0);
  let x23 = m.ddStart + 0.001; x23 = Math.max(x23, m.ddEnd); x23 -= m.ddStart;
  x22 -= m.ddStart; x23 = 1 / x23; x22 = clamp01(x22 * x23);
  x23 = x22 * -2 + 3; x22 = x22 * x22 * x23;
  const x3 = [x22 * 0.649999976, x22 * 0.850000024];
  x22 = x22 * -0.449999988 + 1;
  x23 = Math.max(x22 * m.vision, 1);
  const x17 = clamp01(m.strength);
  const x4 = [x17 * -1.99999988 + 3.5999999, x17 * 0.900000036 + 0.550000012, x17 * -0.849999964 + 1.39999998, x17 * -2.1500001 + 3.20000005];
  x4[0] *= x23; x4[3] *= x23;
  let x2 = ray[0] * ray[0] + ray[1] * ray[1] + ray[2] * ray[2];
  const x16 = 1 / Math.sqrt(x2);
  let x9 = x16 * ray[1];
  const up = 9.99999975e-05 < x9 && 0 < x15;
  x15 /= x9;
  x9 = up ? Math.min(x15, x4[0]) : x4[0];
  let x1 = sky ? 0 : linDepth;
  x2 = Math.sqrt(x2);
  x1 *= x2;
  x1 = up ? Math.min(x15, x1) : x1;
  if (sky) x1 = x9;
  const absorb = m.absorption.map((c) => Math.exp(-x1 * ((x4[1] * c) / x23)));
  const scat = 1 - Math.exp(-x1 * ((x4[1] * m.scatterStrength) / x23));
  const near = Math.min(x3[0], 1);
  const d5 = m.deep.map((d, i) => d - m.scatter[i]);
  const c0 = col.map((c, i) => c * absorb[i] + (near * d5[i] + m.scatter[i]) * scat);
  const c2 = c0.map((c) => x22 * c);
  let x8 = Math.max(x4[3], x23 * x4[2] + 0.100000001) - x23 * x4[2];
  x8 = clamp01((1 / x8) * (-x23 * x4[2] + x1));
  x8 = x8 * x8 * (x8 * -2 + 3);
  let band = Math.max((x17 - 0.150000006) * 1.17647052, 0);
  band = band * band * (band * -2 + 3);
  x8 *= band;
  let f = clamp01((1 / (x23 * 0.950000048)) * (-x23 * 0.5 + x1));
  f = Math.max(f * f * (f * -2 + 3), x8);
  const far = Math.min(x17 * 0.180000007 + x3[1], 1);
  return c0.map((c, i) => f * (-c * x22 + (far * d5[i] + m.scatter[i])) + c2[i]);
}

const SETTINGS = [
  { fogStrength: 0.5, fogDistance: 0.3, waterDepth: 250 },   // the mod's defaults
  { fogStrength: 0, fogDistance: 0, waterDepth: 5 },
  { fogStrength: 0.15, fogDistance: 0.5, waterDepth: 80 },
  { fogStrength: 1, fogDistance: 1, waterDepth: 250 },
  { fogStrength: 0.8, fogDistance: 0.75, waterDepth: 120 },
];
const CAMERA_DEPTHS = [-0.2, 0.3, 4, 20, 70, 180];   // metres under the sea (the first a camera in the quarter-metre band over it)
const DAYLIGHT = [0, 0.4, 1];
const DIRS = [[0, -1, 0], [0.6, -0.5, 0.2], [1, 0, 0], [0.3, 0.05, -0.8], [0.2, 0.7, 0.1], [0, 1, 0]].map((d) => { const l = Math.hypot(...d); return d.map((v) => v / l); });
const DISTANCES = [0.4, 5, 30, 90, 300, 2500];
const COLOURS = [[0.5, 0.5, 0.5], [0.9, 0.2, 0.1], [0.02, 0.6, 0.95]];
const OCEAN = 34;
const close = (a, b, e, what) => { for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) <= e, `${what}: [${a.map((v) => v.toFixed(6))}] vs [${b.map((v) => v.toFixed(6))}]`); };
const vec4s = (u) => [0, 1, 2, 3, 4].map((k) => [u[k * 4], u[k * 4 + 1], u[k * 4 + 2], u[k * 4 + 3]]);

test('DW-C: the distance fog\'s CPU half gives the mod\'s post effect\'s colour - every setting\'s curve, camera depth, daylight, ray and distance, the ray capped at the surface it climbs to and the sky at the band\'s reach (mutants: the darkening\'s end unclamped; the scatter strength a constant; the cap dropped; the sky given the far plane)', () => {
  let n = 0;
  for (const s of SETTINGS) for (const depth of CAMERA_DEPTHS) for (const daylight of DAYLIGHT) {
    const cam = [10, OCEAN - depth, -5];
    const u = distanceFogUniforms(s, { daylight, cameraY: cam[1], oceanY: OCEAN });
    const m = material(s, daylight, OCEAN);
    assert.equal(u[0], 1);
    for (const dir of DIRS) {
      const ray = dir.map((v) => v * 1.3);   // a corner ray is per unit of eye depth: any length along the pixel's direction
      for (const d of [...DISTANCES, null]) {
        for (const col of COLOURS) {
          const want = shaderOracle(m, cam, col, ray, d == null ? null : d / 1.3);
          const got = distanceFogAt(col, distanceFogRayLength(dir, d ?? Infinity, cam[1], u), u);
          close(got, want, 2e-5, `strength ${s.fogStrength} distance ${s.fogDistance} depth ${depth} daylight ${daylight} dir ${dir.map((v) => v.toFixed(2))} d ${d}`);
          n++;
        }
      }
    }
  }
  assert.ok(n > 5000);
});

test('DW-C: every world program\'s fogGlsl.js dwWaterFog is the same colour - run on its own text, the uniforms as the renderer uploads them; off is the colour back untouched, and an added colour (the duel wall\'s glow) keeps its share of the same affine map (mutants: the ray uncapped; the bands\' max a min; the darkening dropped)', () => {
  const src = `uniform int uFogMode; uniform float uFogDensity; uniform vec2 uFogRange; uniform vec3 uCamPos;\n${FOG_GLSL}`;
  for (const s of SETTINGS.slice(0, 4)) for (const depth of [0.3, 20, 180]) {
    const cam = [3, OCEAN - depth, 7];
    const u = distanceFogUniforms(s, { daylight: 1, cameraY: cam[1], oceanY: OCEAN });
    const m = material(s, 1, OCEAN);
    const f = glslFunctions(src, { uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: cam, uDwFog: vec4s(u) });
    for (const dir of DIRS) for (const d of DISTANCES) {
      const wp = cam.map((c, i) => c + dir[i] * d);
      for (const col of COLOURS) {
        const want = shaderOracle(m, cam, col, dir, d);
        close(f.dwWaterFog(col, wp), want, 1e-5, `glsl s ${s.fogStrength} depth ${depth} d ${d}`);
        // additive: fog(bg + g) - fog(bg) = g's share
        const bg = [0.1, 0.2, 0.3];
        const both = shaderOracle(m, cam, bg.map((b, i) => b + col[i]), dir, d), base = shaderOracle(m, cam, bg, dir, d);
        close(f.dwWaterFogAdd(col, wp), both.map((v, i) => v - base[i]), 1e-5, 'the added share');
      }
    }
  }
  const off = glslFunctions(src, { uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uDwFog: vec4s(new Float32Array(20)) });
  assert.deepEqual(off.dwWaterFog([0.25, 0.5, 0.75], [4, -30, 9]), [0.25, 0.5, 0.75]);
  assert.deepEqual(off.dwWaterFogAdd([0.25, 0.5, 0.75], [4, -30, 9]), [0.25, 0.5, 0.75]);
});

test('DW-C: the sky\'s pass - a multiply then an add at the far plane - leaves each sky pixel the colour the post effect makes of it, looking up through the surface or out along the murk (mutants: the passes swapped; the sky reach the vision distance)', () => {
  for (const s of SETTINGS) for (const depth of [-0.2, 0.3, 12, 90]) for (const daylight of [0, 1]) {
    const cam = [0, OCEAN - depth, 0];
    const u = distanceFogUniforms(s, { daylight, cameraY: cam[1], oceanY: OCEAN });
    const m = material(s, daylight, OCEAN);
    const f = glslFunctions(SKY_FOG_FS, { uCamPos: cam, uDwFog: vec4s(u), uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uPass: 0, vRay: [0, 0, 1], outColor: [0, 0, 0, 0] });
    for (const dir of DIRS) {
      const ray = dir.map((v) => v * 2.1);
      f.globals.vRay = ray;
      f.globals.uPass = 0; f.main(); const keep = f.globals.outColor.slice(0, 3);
      f.globals.uPass = 1; f.main(); const add = f.globals.outColor.slice(0, 3);
      assert.equal(f.globals.outColor[3], 0, 'the add leaves the alpha');
      for (const sky of COLOURS) {
        const want = shaderOracle(m, cam, sky, ray, null);
        close(sky.map((c, i) => c * keep[i] + add[i]), want, 1e-5, `sky s ${s.fogStrength} depth ${depth} dir ${dir.map((v) => v.toFixed(2))}`);
      }
    }
  }
});

test('DW-C: the sky pass\'s rays are the view\'s own - through the port\'s mirrored projection, the centre and both axes land on the unprojected screen edges (mutants: the mirror ignored; up for right)', () => {
  const calls = {};
  const gl = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? k : (...a) => { if (k === 'uniform3f') calls[a[0]] = a.slice(1); return k === 'createVertexArray' || k === 'createProgram' || k === 'createShader' ? {} : k === 'getUniformLocation' ? a[1] : k === 'getProgramParameter' || k === 'getShaderParameter' ? true : null; })) });
  const proj = mirrorProjectionX(perspective(1.1, 1.6, 0.1, 5000));
  const eye = [5, 20, -3];
  const view = lookAt(eye, [5 + Math.sin(0.7) * Math.cos(0.3), 20 + Math.sin(0.3), -3 + Math.cos(0.7) * Math.cos(0.3)], [0, 1, 0]);
  const renderer = { gl, _proj: proj, _view: view, _camPos: new Float32Array(eye), _dwFog: Object.assign(new Float32Array(20), { 0: 1 }) };
  const r = new DeepWatersRenderer(renderer);
  r.drawSkyFog();
  const vp = multiply(proj, view);
  for (const [nx, ny] of [[0, 0], [1, 0], [0, 1], [-1, -1], [0.4, -0.7]]) {
    const ray = [0, 1, 2].map((i) => calls.uRayC[i] + nx * calls.uRayX[i] + ny * calls.uRayY[i]);
    const p = eye.map((e, i) => e + ray[i] * 40);   // 40 units of eye depth along it
    const c = [0, 1, 2, 3].map((row) => vp[row] * p[0] + vp[4 + row] * p[1] + vp[8 + row] * p[2] + vp[12 + row]);
    assert.ok(Math.abs(c[0] / c[3] - nx) < 1e-4 && Math.abs(c[1] / c[3] - ny) < 1e-4, `ndc ${nx},${ny} -> ${(c[0] / c[3]).toFixed(5)},${(c[1] / c[3]).toFixed(5)}`);
    assert.ok(Math.abs(c[3] - 40) < 1e-3, 'per unit of eye depth');
  }
});

test('DW-C: ComputeHorizonAmbientColor - the underside\'s horizon while the camera is under: the scatter to the deep colour by the camera\'s depth past 6 m and the strength', () => {
  for (const s of SETTINGS) for (const depth of [0, 5, 6, 30, 80, 150]) for (const daylight of DAYLIGHT) {
    const m = material(s, daylight, OCEAN);
    const t = clamp01((Math.max(0, depth) - 6) / Math.max(0.001, m.ddEnd - 6));
    const k = t * t * (3 - 2 * t);
    const want = lerpC(m.scatter, m.deep, clamp01(k * 0.85 + clamp01(s.fogStrength) * 0.18));
    close(horizonAmbientColor(s, { daylight, cameraY: OCEAN - depth, oceanY: OCEAN }), want, 1e-9, `depth ${depth}`);
  }
  // and the fog colour it is lit from goes to the night tint by the daylight
  close(underwaterFogColor(0), [0.035, 0.065, 0.075], 1e-12, 'night');
  close(underwaterFogColor(1), [14 / 255, 25 / 255, 21 / 255], 1e-12, 'day');
});

/** A sea of one column kind: x in [0, 100] is 24 m deep (a floor at 10), the rest dry. */
function fakeSwimmer({ columnOcean = OCEAN } = {}) {
  const col = (entry, lx) => (lx >= 0 && lx <= 100 ? { oceanY: columnOcean, seafloorY: 10, renderedSeafloorY: 10, depth: columnOcean - 10, entry } : null);
  const host = { waterColumn: col, rawWaterColumn: col };
  return createDeepWatersPlayer({
    host, locate: (x, z) => ({ entry: {}, lx: x, lz: z, baseY: 0 }), seaY: () => OCEAN, terrainGroundAt: () => -Infinity,
    collider: { raycastHit: () => null }, settings: () => ({ fogStrength: 0.5, fogDistance: 0.3 }),
  });
}

test('DW-C: TryGetUnderwaterPresentation - the fog\'s own "under": a camera a quarter metre OVER the sea already counts, the swimmer\'s presentation does, a swimming head 0.15 under does, and a head in deep water - over a column not 8 m past its floor, or with one within 36 m - does with no swim at all; a column 12 m off the sea is the sea (mutants: the band dropped; the head\'s padding 0; the ring\'s far radius only)', () => {
  let p = fakeSwimmer();
  const at = (camY, centreY, x = 50, swimming = false) => p.fogPresentation({ camera: [x, camY, 0], centre: [x, centreY, 0], swimming });
  assert.deepEqual(at(34.25, 40), { under: true, oceanY: OCEAN }, 'the camera 0.25 over the sea');
  assert.equal(at(34.3, 40).under, false, 'just past the band, a dry head');
  p = fakeSwimmer();
  assert.equal(at(34.3, 32.7, 50, false).under, true, 'the swimmer\'s presentation: the head (centre + 0.95) under by more than 0.25, no swim needed');
  p = fakeSwimmer();
  assert.equal(at(34.3, 32.9, 50, false).under, false, '...a head 0.15 under without a swim is not');
  p = fakeSwimmer();
  assert.equal(at(35, 32.85, 50, true).under, true, 'a swimming head 0.2 under (the rule is 0.15; the presentation\'s 0.25 is not reached)');
  p = fakeSwimmer();
  assert.equal(at(35, 33.0, 50, true).under, false, '...and not 0.05 under');
  // IsPointInsideDeepWater, behind the presentation's own head test (which it shadows but at its very edge - the C#'s order)
  p = fakeSwimmer();
  assert.equal(p.insideDeepWater(50, 33.7, 0, OCEAN, -0.25), true, 'under the sea by the padding, over a deep column');
  assert.equal(p.insideDeepWater(50, 33.8, 0, OCEAN, -0.25), false, '...not above the padding');
  assert.equal(p.insideDeepWater(50, 1.9, 0, OCEAN, -0.25), false, 'more than 8 m under the floor is not in the water');
  assert.equal(p.insideDeepWater(50, 2.1, 0, OCEAN, -0.25), true, '...less is');
  assert.equal(p.insideDeepWater(120, 33, 0, OCEAN, -0.25), true, 'off every column: one on the ring within 36 m (x 100, 20 m off)');
  assert.equal(p.insideDeepWater(137, 33, 0, OCEAN, -0.25), false, '...and none within it');
  assert.equal(p.hasNearbyColumn(104, 0, 4, 36, 8, 0.25), true, 'the near ring (4 m)');
  assert.equal(p.hasNearbyColumn(136, 0, 4, 36, 8, 0.25), true, 'the far ring (36 m)');
  p = fakeSwimmer();
  assert.equal(at(35, 30, 50, false).under, true, 'a head under the sea: the presentation\'s own test says so first');
  p = fakeSwimmer({ columnOcean: 50 });
  assert.deepEqual(at(50.2, 60), { under: true, oceanY: 50 }, 'a local column 12 m off the terrain\'s sea is the sea');
});

test('DW-C: the renderer carries the fog as a FRAME\'s - beginFrame clears it, a panel saves and restores it, the character sprite borrows it off, and every world program the one fog door feeds looks it up and uploads it (the lighting lane\'s finish on the display colour)', () => {
  const r = rd('src/render/renderer.js');
  assert.match(r, /this\._dwFog = new Float32Array\(20\);/);
  const begin = r.slice(r.indexOf('  beginFrame(proj, view, lightDir, opts = null) {'), r.indexOf('this._beginLane(proj, view, lightDir'));
  assert.match(begin, /this\._dwFog\[0\] = 0;/, 'beginFrame clears it');
  assert.match(r, /dwFog: gl\.getUniformLocation\(program, 'uDwFog'\)/, '_fogLocs looks it up');
  assert.match(r, /if \(prog\.dwFog\) gl\.uniform4fv\(prog\.dwFog, this\._dwFog\);/, '_uploadFog uploads it');
  assert.match(r, /dwFog: Float32Array\.from\(this\._dwFog\),/, 'the panel saves it');
  assert.match(r, /this\._dwFog\.set\(s\.dwFog\);/, '...and restores it');
  assert.match(r, /sf = this\._fogMode;\n\s*const sw = this\._dwFog\[0\];[^\n]*\n[\s\S]{0,400}this\._fogMode = 0; this\._dwFog\[0\] = 0;[\s\S]*?this\._fogMode = sf; this\._dwFog\[0\] = sw;/, 'the sprite bracket borrows it off and back');   // AUDIT 39 F47 keeps the scene's own borrow its own statement
  assert.equal((r.match(/outColor = vec4\(dwWaterFog\(/g) || []).length, 7, 'the seven classic world programs');
  assert.match(rd('src/render/enhancedLighting.js'), /return dwWaterFog\(elEncode\(col\), wp\) \+ \(bayer4/, 'the lane: on the display colour, before the dither');
  assert.match(rd('src/render/waterSurface.js'), /outColor = vec4\(dwWaterFog\(mix\(uFogColor, col, fogFactorAt\(vWorldPos\)\), vWorldPos\), alpha\);/);
  // the behaviour of the door itself, on a bare renderer
  const calls = [];
  const bare = { gl: { uniform3fv() {}, uniform1i() {}, uniform1f() {}, uniform2fv() {}, uniform4fv: (loc, v) => calls.push([loc, Array.from(v)]) }, _fogColor: new Float32Array(3), _fogMode: 0, _fogDensity: 0, _fogRange: new Float32Array(2), _camPos: new Float32Array(3), _dwFog: new Float32Array(20) };
  Renderer.prototype.setWaterFog.call(bare, Object.assign(new Float32Array(20), { 0: 1, 1: 34 }));
  assert.equal(bare._dwFog[1], 34);
  Renderer.prototype._uploadFog.call(bare, { dwFog: 'L' });
  assert.deepEqual(calls.at(-1), ['L', Array.from(bare._dwFog)]);
  Renderer.prototype.setWaterFog.call(bare, null);
  assert.equal(bare._dwFog[0], 0, 'null is off');
});

test('DW-C: the world host - the fog\'s presentation drives the surfaces\' _DeepWatersUnderwater and the floor\'s column, the fog is set after beginFrame, the sky is drawn under the sea and its pass follows the ring, and the air\'s own effects are the fog\'s', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const underwater = !!_dwFogP\?\.under;/);
  assert.match(w, /renderer\.beginFrame\(proj, view, sunDirection\(minute\), WORLD_FRAME\);[^\n]*\n\s*meterFor\(renderer\.gl\)\?\.markCpu\('bodies'\);[^\n]*\n\s*if \(deepWaters\) \{ _dwNowMs = now; beginDeepWatersFrame\(minute\); \}/);
  assert.match(w, /if \(f\.underwater\) renderer\.setWaterFog\(distanceFogUniforms\(/);
  assert.match(w, /\n {4}sky\.draw\(cam\.yaw, cam\.pitch/, 'the sky is drawn under the sea too - the fog closes it');
  assert.match(w, /renderer\.setClearColor\(SKY_CLEAR\);/);
  const ring = w.indexOf('farRing.draw(view, {');
  const skyFog = w.indexOf('if (deepWaters) dwRender.drawSkyFog();');
  assert.ok(skyFog > ring && skyFog < w.indexOf('const wu = waterUniforms({'), 'after the ring, before the first blend');
  assert.match(w, /if \(wisps && wd\.on && wispsOn\(\) && !_dwAirOff\) \{/);
  assert.match(w, /if \(boltsGl && boltFrame\.bolts\.length && !_dwAirOff\) \{/);
  assert.match(w, /const _dwPrecipOff = _dwAirOff \|\| \(!!dwPlayer && walkMode && !!player\.isPlayerSwimming && !player\.waterWalking\);/);
});
