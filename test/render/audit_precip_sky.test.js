// AUDIT PRECIP - THE SKY (the owner: "Audit this and ensure perfection. No band aids"): the faults the audit's sky lane
// found past SKY-ARC, each pinned on the shaders' own code (test/glsl.mjs, test/cloudSky.mjs) - SKY-BAND (the far slab
// the walk never reached left bare to the dome: a stair-stepped band at the horizon on the map's lane at dusk), SKY-HZN
// (the clouds faded into the clear base's horizon, not the sky's), SKY-CAP (a sun-coloured cap in the far haze: the
// shadow map's square clamped in metres, and a crossing's strips left all light), SKY-2 (the curtains faded by where a
// veil begins), SKY-3 (a wet cell's envelope lost) and SKY-POP (its deck swapped at the share's half). The record is
// bible/01-Overview/audits/Audit-Precip.md, the SKY-ARC section of bible/07-Rendering/Volumetric-Clouds-Arc.md beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from '../glsl.mjs';
import { marchFns } from '../cloudSky.mjs';
import { SHAFT_FS, AIR_HAZE_REACH } from '../../src/render/airPass.js';
import { perspective } from '../../src/world/mat4.js';
import { cellOf, cellOfField, CURTAIN_FADE_M } from '../../src/render/volumetricClouds.js';
import { cloudsStateUnderMod } from '../../src/render/dynamicSkiesBridge.js';
import { WEATHER_SKY } from '../../src/render/enhancedSky.js';

const read = (p) => readFileSync(p, 'utf8');
const rgbStep = (a, b) => Math.max(...[0, 1, 2].map((i) => Math.abs(a[i] - b[i])));

test('SKY-BAND: the horizon\'s opacity is continuous across the far cut, and no row past a cell\'s empty column is left bare to the dome - the slab the walk never reaches laid in the horizon\'s colour by its own length (farA), the early-out\'s answer the same law with nothing walked (mutants: the early-out fully covering; the rest unlaid)', () => {
  const T = (el) => { const f = marchFns([], { gl_FragCoord: [0.1, el / 90, 0, 1], uMapSize: [1, 1] }); f.main(); return f.globals.outColor[3]; };
  const cut = Math.asin(1400 / 120000) * 180 / Math.PI;
  assert.ok(Math.abs(T(cut - 0.01) - T(cut + 0.01)) < 0.05, `T ${T(cut - 0.01).toFixed(3)} below the cut, ${T(cut + 0.01).toFixed(3)} above`);
  // a cell whose bounding column brings the first span near: the walk spends itself in the column's empty air - the deck
  // past it is still the horizon's, never the dome's
  const cell = cellOf('rain', 0, 30000, 3000);
  const f = (el) => { const g = marchFns([cell], { gl_FragCoord: [0.25, el / 90, 0, 1], uMapSize: [1, 1], uCover: 0.6 }); g.main(); return g.globals.outColor[3]; };
  for (const el of [0.7, 0.8, 0.95]) assert.ok(f(el) < 0.5, `the far deck lies over the dome at ${el} degrees: T ${f(el).toFixed(3)}`);
  const ms = read('src/render/volumetricClouds.js');
  assert.match(ms, /\{ float a = farA\(rest\); col \+= T \* uHorizonColor \* a; T \*= 1\.0 - a; \}/, 'the walk\'s rest laid behind all it found');
});

test('SKY-HZN: the clouds fade into the horizon the SKY wears - under Dynamic Skies the mod\'s fog greyed by the player\'s own eased row, never the clear base\'s the map\'s clouds stand on; on the port\'s dome its own horizon (mutants: the base\'s row for the fade; the port\'s ungreyed palette)', () => {
  const st = { clearColor: [0.8, 0.5, 0.3], sunDir: [0, 1, 0] };
  const at = { minuteOfDay: 17 * 60, weather: 'sunny', classicMinutes: 0, seconds: 0 };
  const base = cloudsStateUnderMod(st, null, { ...at, row: WEATHER_SKY.sunny });
  const grey = cloudsStateUnderMod(st, null, { ...at, row: WEATHER_SKY.sunny, skyRow: WEATHER_SKY.thunder });
  assert.notDeepEqual(grey.horizon, base.horizon, 'the sky\'s row greys it');
  assert.deepEqual(cloudsStateUnderMod(st, null, { ...at, row: WEATHER_SKY.sunny, skyRow: WEATHER_SKY.sunny }).horizon, base.horizon, 'off the map\'s lane the two rows are one');
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /row: cb\.row, skyRow: weatherRowNow \}\)/, 'the mod path hands the sky\'s row');
  assert.match(shared, /horizon: enhancedSky\.state\.horizon \};/, 'the port path its dome\'s horizon');
});

test('SKY-CAP: under a solid deck the far haze at dusk is shaded at every camera pixel the square can stand on, in the GPU\'s own precision - the square\'s edge read in its own UV, never a hair past it where the map answers full sun; and a crossing\'s uncovered strips marched in the same update, never left all light (mutants: the clamp in metres; the strips white)', () => {
  const P = perspective(65 * Math.PI / 180, 16 / 9, 0.1, 6000);
  const ext = 819.2 * 16, z = Math.fround(1 / ext);
  const lowSun = [-Math.cos(7.5 * Math.PI / 180), Math.sin(7.5 * Math.PI / 180), 0];
  const bad = [];
  for (let k = -6; k <= 6; k++) {
    const lo = k * 819.2 - ext / 2 + 409.6, eye = [k * 819.2 + 409.6, 0, 409.6];
    const f = glslFunctions(SHAFT_FS, {
      uProjInfo: [P[0], P[5], P[10], P[14]], uRect: [0, 0, 96, 54], uCanvas: [96, 54], uViewRot: [1, 0, 0, 0, 0.94, 0.34, 0, -0.34, 0.94],
      uEye: eye, uLightDir: lowSun, uSunColor: [1, 1, 1], uHaze: [6e-4, 1, AIR_HAZE_REACH, 1],
      uCloudShadowRect: [lo, -6144, z, 1], uCloudSkyOn: 0, uSunOn: 0, vUV: [0.3, 0.9], gl_FragCoord: [28.5, 48.5, 0, 1],
      textureLod: (name) => (name === 'uDepth' ? [1, 0, 0, 1] : [0, 0, 0, 1]),
      texture: (name, uv) => [uv[0] < 0 || uv[1] < 0 || uv[0] > 1 || uv[1] > 1 ? 1 : 0, 0, 0, 1],
    }, { fp32: true });
    const h = f.haze()[0];
    if (h !== 0) bad.push(`corner ${lo.toFixed(1)}: ${h.toExponential(3)}`);
  }
  assert.deepEqual(bad, [], 'every step shaded - the ones whose ground lies past the square read its edge');
  const vc = read('src/render/volumetricClouds.js');
  const shift = vc.slice(vc.indexOf('  _shiftShadowMap(dx, dz, viewport) {'), vc.indexOf('\n  }\n', vc.indexOf('  _shiftShadowMap(dx, dz, viewport) {')));
  assert.doesNotMatch(shift, /texSubImage2D/, 'no strip filled all light');
  assert.match(shift, /this\.shadowStrips = \[\];/);
  assert.match(vc, /if \(!this\.shadowFull && this\.shadowStrips\) for \(const \[x, y, w, h\] of this\.shadowStrips\) \{ gl\.viewport\(x, y, w, h\); gl\.drawArrays\(gl\.TRIANGLES, 0, 3\); \}/, 'marched in the same update');
});

test('SKY-2a: a curtain is laid the same either side of a jump in the slab\'s start (a fog column left at its base) - each of its samples in its own aerial perspective (veilFade), so the front and the back cut there agree (mutants: the back\'s fade by the slab\'s law; the veil by the piece\'s start)', () => {
  const fog = cellOf('fog', 0, -2500, 3000), rain = cellOf('rain', 0, 1500, 2000);
  const cut = Math.atan2(150, 500) * 180 / Math.PI;
  const at = (el) => { const f = marchFns([fog, rain], { uCover: 0, uHorizonColor: [0.9, 0.6, 0.3], uMapSize: [1, 1], gl_FragCoord: [0.0001, el / 90, 0, 1] }); f.main(); return f.globals.outColor; };
  const across = rgbStep(at(cut - 0.02), at(cut + 0.02)), beside = rgbStep(at(cut - 0.3), at(cut - 0.26));
  assert.ok(across < 3 * beside + 1e-3, `across the cut ${across.toFixed(4)}, beside it ${beside.toFixed(4)}`);
});

test('SKY-2b: a far curtain keeps its own fade where a near curtain\'s chord ends - no one entry for the whole veil (mutants: the nearest entry\'s fade for every piece)', () => {
  const near = cellOf('rain', 0, 10000, 8000), far = cellOf('rain', 0, 45000, 20000);
  const f = marchFns([near, far], { uCover: 0, uHorizonColor: [0.9, 0.6, 0.3], uMapSize: [1, 1], gl_FragCoord: [0, 0, 0, 1] });
  const front = (azDeg) => {
    const az = azDeg * Math.PI / 180, el = 0.3 * Math.PI / 180, dir = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    f.raySpans([0, 0, 0], dir);
    const fr = { value: [0, 0, 0, 0] }, bk = { value: [0, 0, 0, 0] }, tb = { value: 0 };
    f.curtains([0, 0, 0], dir, f.globals.spanA[0], fr, bk, tb);
    return fr.value;
  };
  let worst = 0;
  for (let a = 11.2; a < 11.5; a += 0.02) worst = Math.max(worst, rgbStep(front(a), front(a + 0.02)));
  assert.ok(worst < 0.02, `the largest 0.02-degree step along the near chord's end: ${worst.toFixed(4)}`);
});

test('SKY-2c: a piece of a curtain is faded sample by sample - each of its Simpson samples by its own distance, never the whole piece by where it begins (mutants: the veil by its start)', () => {
  const f = marchFns([cellOf('rain', 0, 45000, 20000)], { uCover: 0, uHorizonColor: [0.9, 0.6, 0.3], uMapSize: [1, 1], gl_FragCoord: [0, 0, 0, 1] });
  const fade = (t) => 1 - Math.exp(-t / CURTAIN_FADE_M), cam = [0, 0, 0], dir = [0, 0, 1], a = 25000, b = 65000, rad = 20000;
  const N = Number(/const int VEIL_PANELS = (\d+);/.exec(read('src/render/volumetricClouds.js'))[1]), h = (b - a) / N;
  let x = 0, y = 0;
  for (let k = 0; k <= N; k++) {
    const t = a + h * k, d = (k === 0 || k === N ? 1 : k % 2 ? 4 : 2) * f.veilAcross(0, [cam[0] + dir[0] * t, cam[2] + dir[2] * t], rad);
    x += d; y += d * fade(t);
  }
  const p = f.veilPiece(0, cam, dir, a, b, rad, 1e6, 2e6);
  assert.ok(Math.abs(p[0] - x * h / 3) < 1e-6 * x * h && Math.abs(p[1] - y * h / 3) < 1e-6 * x * h, `the piece ${p}, its samples ${[x * h / 3, y * h / 3]}`);
  assert.ok(p[1] / p[0] > fade(a) + 0.1, `faded by its far samples' own distance: ${(p[1] / p[0]).toFixed(3)} against ${fade(a).toFixed(3)} at its start`);
});

test('SKY-2d: the curtains behind the slab fade as those before it - a far curtain wears the horizon by its own distance, never its tint whole (mutants: the back unfaded)', () => {
  const back = (H) => {
    const f = marchFns([cellOf('rain', 0, 45000, 20000)], { uCover: 0, uHorizonColor: H, uMapSize: [1, 1], gl_FragCoord: [0, 0, 0, 1] });
    const el = 0.3 * Math.PI / 180, dir = [0, Math.sin(el), Math.cos(el)];
    const fr = { value: [0, 0, 0, 0] }, bk = { value: [0, 0, 0, 0] }, tb = { value: 0 };
    f.curtains([0, 0, 0], dir, 0, fr, bk, tb);
    return bk.value;
  };
  const b1 = back([0.9, 0.6, 0.3]), b2 = back([0.3, 0.6, 0.9]);
  assert.ok(b1[3] < 0.999, `a curtain behind the slab: T ${b1[3]}`);
  const sens = (b1[0] - b2[0]) / (0.6 * (1 - b1[3]));
  assert.ok(sens > 0.6, `the horizon's share of a far curtain's colour: ${sens.toFixed(3)} (its tint alone carries 0.3-0.4)`);
});

test('SKY-3 / SKY-POP: under the law a wet cell is as grown as its system, and its cloud walks with the share - no deck swapped at the half (mutants: the growth after the share; the cloud a switch; a snow front its own warm side)', () => {
  const at = (x, z) => [x, z];
  const c = (o) => cellOfField({ x: 0, z: 0, r: 30000, imp: 1, rank: 1, env: 1, ...o }, at);
  for (const env of [0.6, 0.3, 0.05]) {
    const law = c({ word: 'rain', raw: 'rain', snow: 0, env }), off = c({ word: 'rain', raw: 'rain', env });
    assert.ok(Math.abs(law.fall - off.fall) < 1e-9, `env ${env}: ${law.fall} on the law, ${off.fall} off it`);
  }
  // a snow front whose air rains: the rain's cloud and curtain, its own warm side (AUDIT PRECIP T-1: it kept the snow's)
  const sf = c({ word: 'rain', raw: 'snow', snow: 0 }), rf = c({ word: 'rain', raw: 'rain', snow: 0 });
  for (const k of ['base', 'top', 'density', 'dark', 'fall']) assert.ok(Math.abs(sf[k] - rf[k]) < 1e-9, `${k}: a snow front falling as rain ${sf[k]}, a rain ${rf[k]}`);
  const lo = c({ word: 'rain', raw: 'rain', snow: 0.499 }), hi = c({ word: 'snow', raw: 'rain', snow: 0.501 });
  for (const k of ['base', 'top', 'density', 'dark', 'flat', 'cover', 'grey']) assert.ok(Math.abs(lo[k] - hi[k]) < 0.01 * Math.max(1, Math.abs(lo[k])), `${k}: ${lo[k]} at 0.499, ${hi[k]} at 0.501`);
});
