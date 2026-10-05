// GRASS-LIT2 (2026-10-02, Mac: "Tackle the not done" - the five things GRASS-LIT's report left unpaid): the lanterns
// light the grass as they light the ground under it; a blade is lit about the ground's own normal, so a hillside's
// field darkens with the hillside; the grass's colour is taken off the tile set that is DRAWN, a texture mod's
// included; and the classic lane paints the field in its own tones, as the default lane shows it at noon. The vertex
// stage is run on its OWN TEXT through test/glsl.mjs and held against TERRAIN_FS's and EL_TERRAIN_FS's formulas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LAB_GRASS_HEAD, GAME_GRASS_FIELD, GAME_GRASS_VS, GAME_GRASS_FS, GRASS_TONES, GRASS_TONES_CLASSIC, GRASS_TILE_MEANS,
  GRASS_SLOPE_SPAN, GRASS_SLOPE_STEPS, GRASS_HEIGHT_BITS, GRASS_MAX_LIGHTS, GRASS_MEAN_SAMPLES, GRASS_SUN_LIFT,
  packHeightSlope, unpackHeightSlope, beginGrassCell, stepGrassCell, placeLabGrassCell, createGrassField, tileMeanColour,
  grassLit, LabGrassRenderer, heightFloor, heightSpan, GRASS_CELL_LIGHTS, grassMeanStep,
} from '../src/render/labGrass.js';
import { elDecode, elDecode3, elDecodeN, elEncode, elTonemapRGB, elAttenuation, EL_EXPOSURE, EL_GLSL, EL_ATTEN_GLSL, EL_MAX_LIGHTS, EL_TERRAIN_FS } from '../src/render/enhancedLighting.js';
import { buildTerrainGrid, buildTerrainIndices, surfaceNormalAt } from '../src/world/terrainSurface.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { packAdapt, unpackAdapt } from '../src/render/airPass.js';
import { SHADOW_POINT_CASTERS } from '../src/render/shadowPass.js';
import { glslFunctions } from './glsl.mjs';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const close = (a, b, e = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) <= e);
const NOON = { amb: [0.9, 0.9, 0.9], sunCol: [0.8161765, 0.954361, 1], sunScale: 0.6, sunDir: [0, 1, 0] };
const LOW = { amb: [0.55, 0.55, 0.55], sunCol: [0.8161765, 0.954361, 1], sunScale: 0.35, sunDir: [-0.9, 0.4358899, 0] };
const WOOD = GRASS_TILE_MEANS.woodland;
const zeros4 = (n) => Array.from({ length: n }, () => [0, 0, 0, 0]);
const zeros3 = (n) => Array.from({ length: n }, () => [0, 0, 0]);

/** The grass vertex stage, run on the compiled text: one blade at the cell's middle (15, rootY 0, 15) with no lean and
 *  no wind, its height lane `w`, the frame's `lights` ([{ at, range, color }], colours as the host uploads them),
 *  `casterOf` the lights' shadow slots (-1: none). Answers the stage's outputs. */
function vertex({ w = packHeightSlope(0.5, 0, 0, 0), sunDir = [0, 1, 0], moonDir = [0, 1, 0], lean = [0.5, 0.5], lane = 0, lights = [], vertexId = 2, casterOf = null, shadow = 1, cell = null, bind = {} }) {   // AUDIT A1: `cell` the cell's list (default: every light, in order); AUDIT C: `lean` aPB.xy, `bind` more globals
  const f = glslFunctions(LAB_GRASS_HEAD + GAME_GRASS_FIELD + GAME_GRASS_VS, {
    // AUDIT GRASS-LIT2 C1: a unorm16 reaches the stage as a FLOAT32, and a GPU may normalise it by the reciprocal -
    // the value such a GPU hands the stage; w / 65535 in doubles is exact, and hid a floor
    aCorner: [0.5, 0.5], aPA: [0.5, 0.5, 0, Math.fround(w * Math.fround(1 / 65535))], aPB: [...lean, 0.5, 0.5], aPC: [0.2, 0.3, 0.1, 0],
    uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uTime: 0, uWind: 0, uRange: 300, uEye: [0, 1, 0], uSunDir: sunDir, uMoonDir: moonDir, uWindDir: [1, 0],
    uSnowFull: 1.1, uSlotN: 0, uCellFrame: [0, 0, 0, 1], uBladeScale: [heightFloor(), heightSpan(), 0.05, 0.05], uCellSize: 30, uPixel: 0, uPxVariants: 8,
    uGFieldOrigin: [0, 0], uGFieldM: 1, uSnowGlobal: 0, uWindV: [0, 0], uSunScale: 0.6, uCamPos: [0, 0, 0], uIndirect: [0, 0, 0, 0], uIndirectColor: [0, 0, 0],
    uCloudShadowRect: [0, 0, 0, 0], uSunVP: [Array(16).fill(0), Array(16).fill(0), Array(16).fill(0)], uSunOrigin: [0, 0, 0, 0], uSunShadowParams: [0, 0, 0, 0], uSunTexel: [0, 0, 0, 0],
    // a caster's map answers `shadow` everywhere: its params name a far plane, its taps the value
    uPointShadowParams: [[0, 0, 0, 50], ...zeros4(SHADOW_POINT_CASTERS - 1)], uShadowIndex: Array(SHADOW_POINT_CASTERS).fill(-1), uCasterOf: casterOf ?? Array(EL_MAX_LIGHTS).fill(-1),   // FLICKER-FIX: sized by the casters (twelve), not a literal
    uLane: lane, uPointCount: (cell ?? lights.map((_, k) => k)).length,
    uPointIdx: Array.from({ length: GRASS_CELL_LIGHTS }, (_, k) => (cell ?? lights.map((_, j) => j))[k] ?? 0),   // AUDIT A1: the cell's list
    uPointLights: [...lights.map((l) => [...l.at, l.range]), ...zeros4(GRASS_MAX_LIGHTS - lights.length)],
    uPointColors: [...lights.map((l) => [...l.color]), ...zeros3(GRASS_MAX_LIGHTS - lights.length)],
    gl_VertexID: vertexId, gl_InstanceID: 0,
    texture: (name) => (name === 'uPointShadow' || name === 'uPointShadowLo' ? shadow : [0, 0, 0, 0]),
    ...bind,
  });
  f.main();
  return f.globals;
}
/** TERRAIN_FS's lantern term on the ground at `p` with normal `n` (the classic (1 - d/r)^2), or EL_TERRAIN_FS's
 *  diffuse with its spec set aside (elAttenuation) - per light, its colour as uploaded */
function groundLanterns(p, n, lights, lane) {
  const acc = [0, 0, 0];
  for (const l of lights) {
    const L = l.at.map((v, i) => v - p[i]), d = Math.hypot(...L);
    if (d >= l.range) continue;
    const att = lane ? elAttenuation(d, l.range) : Math.max(0, 1 - d / l.range) ** 2;
    const ndl = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / Math.max(d, 1e-4));
    for (let i = 0; i < 3; i++) acc[i] += att * ndl * l.color[i];
  }
  return acc;
}

test('GRASS-LIT2: the numbers - the classic lane\'s tones, the slope\'s span and steps, the height\'s bits, the lanterns\' cap, the mean\'s reads', () => {
  assert.deepEqual(GRASS_TONES_CLASSIC.map((t) => [...t]), [[0.93, 0.93, 0.98], [1.06, 1.10, 1.01], [1.24, 1.33, 1.05], [1.45, 1.57, 1.16]]);
  assert.deepEqual([GRASS_SLOPE_SPAN, GRASS_SLOPE_STEPS, GRASS_HEIGHT_BITS, GRASS_MAX_LIGHTS, GRASS_MEAN_SAMPLES], [0.75, 15, 6, 48, 65536]);
  assert.equal(GRASS_MAX_LIGHTS, EL_MAX_LIGHTS, 'the lane\'s own cap - every light the ground takes, the grass takes');
  assert.ok(GRASS_HEIGHT_BITS + 2 * 5 === 16, 'the height and the slope\'s two five-bit codes fill the lane exactly');
  assert.ok(heightSpan() / (2 ** GRASS_HEIGHT_BITS - 1) < 0.008, `the height's step ${(heightSpan() / 63 * 1000).toFixed(1)} mm`);
  assert.ok(Math.atan(GRASS_SLOPE_SPAN / GRASS_SLOPE_STEPS) * 180 / Math.PI < 3, 'the slope\'s step under three degrees');
});

test('GRASS-LIT2: the classic lane\'s tones - photographed against the default lane at noon: no brighter and no greener than the default lane shows its field, the highlight its per-channel match', () => {
  // the default lane's displayed colour of a tone over the ground's at noon, the five grass climates averaged
  const el = (c) => elTonemapRGB(c.map((v, i) => elDecode(v) * (elDecode(NOON.amb[i]) + elDecode(NOON.sunCol[i]) * NOON.sunScale) * EL_EXPOSURE)).map(elEncode);
  const climates = Object.values(GRASS_TILE_MEANS);
  const shown = (k) => [0, 1, 2].map((i) => climates.reduce((a, g) => a + el(g.map((v, j) => v * GRASS_TONES[k][j]))[i] / el(g)[i], 0) / climates.length);
  for (let k = 0; k < 4; k++) {
    const lane = shown(k);
    assert.ok(GRASS_TONES_CLASSIC[k].every((v, i) => v <= lane[i] + 0.012), `tone ${k}: ${GRASS_TONES_CLASSIC[k]} no brighter than the lane's ${lane.map((v) => v.toFixed(3))}`);
    if (k > 0) assert.ok(GRASS_TONES_CLASSIC[k][1] / GRASS_TONES_CLASSIC[k][0] <= lane[1] / lane[0] + 1e-3, `tone ${k}: and no greener`);
    if (k > 0) assert.ok(GRASS_TONES_CLASSIC[k].every((v, i) => v < GRASS_TONES[k][i]), `tone ${k}: darker than the shipped tones on every channel`);
  }
  assert.ok(close([...GRASS_TONES_CLASSIC[3]], shown(3), 0.012), 'the highlight is the per-channel match');
  // still a field lighter than its ground, root to highlight, the root melting into it
  assert.ok(GRASS_TONES_CLASSIC[0].every((v) => v < 1) && GRASS_TONES_CLASSIC.slice(1).every((t) => t.every((v) => v > 1)));
  for (let k = 1; k < 4; k++) assert.ok(GRASS_TONES_CLASSIC[k].every((v, i) => v > GRASS_TONES_CLASSIC[k - 1][i]));
  // the twin: a classic blade over its ground no brighter than the default lane's, at noon
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const ground = (lane) => (lane ? el(WOOD) : WOOD.map((v, i) => v * (NOON.amb[i] + NOON.sunCol[i] * NOON.sunScale)));
  for (const t of [0.3, 0.7]) {
    const ratio = (lane) => lum(grassLit(WOOD, t, NOON, lane)) / lum(ground(lane));
    assert.ok(ratio(false) <= ratio(true) + 0.005, `t ${t}: classic ${ratio(false).toFixed(3)}x the ground, the lane ${ratio(true).toFixed(3)}x`);
  }
});

test('GRASS-LIT2: the height lane packs the height and the ground\'s slope - level packs level for every blade, the dither is unbiased, a steep normal keeps its heading', () => {
  const step = GRASS_SLOPE_SPAN / GRASS_SLOPE_STEPS;
  for (let i = 0; i < 4096; i++) {
    const w = packHeightSlope(0.37, 0, 0, i);
    assert.ok(w >= 0 && w <= 65535);
    const u = unpackHeightSlope(w);
    assert.equal(u.nx, 0); assert.equal(u.nz, 0);
    assert.ok(Math.abs(u.hn - 0.37) <= 0.5 / 63 + 1e-12);
    assert.ok((((w >> 5) & 31) ^ 15) !== 31 && ((w & 31) ^ 15) !== 31, 'code 31 is never written - 15 either side of the level');
    assert.equal(w & 1023, 0, 'AUDIT A3: and level is stored as zero - each code XOR 15');
  }
  // a hillside's normal lands on its two nearest steps, in proportion: the mean of a patch is the slope's own
  for (const [nx, nz] of [[0.3, -0.2], [0.123, 0.456], [-0.61, 0.07]]) {
    let sx = 0, sz = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const u = unpackHeightSlope(packHeightSlope(0.5, nx, nz, i));
      assert.ok(Math.abs(u.nx - nx) <= step + 1e-12 && Math.abs(u.nz - nz) <= step + 1e-12, 'within a step of the slope');
      sx += u.nx; sz += u.nz;
    }
    assert.ok(Math.abs(sx / N - nx) < 0.002 && Math.abs(sz / N - nz) < 0.002, `[${nx}, ${nz}]: the mean ${(sx / N).toFixed(4)}, ${(sz / N).toFixed(4)}`);
  }
  // past the span: held to it, its heading kept
  const u = unpackHeightSlope(packHeightSlope(1, 0.9, 0.9, 0));
  assert.ok(Math.abs(u.nx - u.nz) < 1e-12 && Math.hypot(u.nx, u.nz) <= GRASS_SLOPE_SPAN + step, `${u.nx}, ${u.nz}`);
  assert.equal(unpackHeightSlope(packHeightSlope(1, 0, 0, 0)).hn, 1);
  assert.equal(unpackHeightSlope(packHeightSlope(0, 0, 0, 0)).hn, 0);
  // AUDIT GRASS-LIT2 A3: a ZERO word (a pad blade, a cleared slot) is the height floor on LEVEL ground, not the steepest
  // lean; A4: and a normal that is not one packs level
  assert.deepEqual(unpackHeightSlope(0), { hn: 0, nx: 0, nz: 0 });
  assert.equal(packHeightSlope(0.5, NaN, NaN, 3) & 1023, 0);
  assert.equal(packHeightSlope(0.5, Infinity, 0.2, 3) & 1023, 0);
  // every word decodes to a code in 0..30 either side, and the pack's every code comes back
  for (let w = 0; w < 65536; w += 7) { const u = unpackHeightSlope(w); assert.ok(Math.abs(u.nx) <= 0.8 + 1e-9 && Math.abs(u.nz) <= 0.8 + 1e-9); }
});

test('GRASS-LIT2: the vertex stage decodes the lane as packHeightSlope packs it, and lights the blade about the ground\'s normal - the sun on a hillside is the terrain\'s own lambert there', () => {
  assert.equal(vertex({ w: 0, sunDir: [0, 1, 0] }).vLam, 1, 'AUDIT A3: a zero word stands level in the stage too');
  for (const [nx, nz] of [[0, 0], [0.3, -0.2], [-0.45, 0.25], [0.6, 0.0]]) {
    const w = packHeightSlope(0.5, nx, nz, 0);   // index 0: the dither's centre, so the code is the nearest step
    const { nx: qx, nz: qz } = unpackHeightSlope(w);
    const n = [qx, Math.sqrt(1 - qx * qx - qz * qz), qz];
    for (const sun of [[0, 1, 0], LOW.sunDir, [0.6, 0.8, 0]]) {
      const g = vertex({ w, sunDir: sun });
      const want = Math.max(0, (n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]) / Math.hypot(...sun));
      assert.ok(Math.abs(g.vLam - want) < 1e-9, `normal [${qx}, ${qz}], sun ${sun}: ${g.vLam} vs ${want}`);
    }
    // the height is the lane's high six bits over the height law's span
    assert.ok(Math.abs(vertex({ w }).gl_Position[1] - (heightFloor() + 0.5 * heightSpan()) * 0.5) < heightSpan() / 63, 'the blade\'s middle at half its height');
  }
  // a hillside facing away from a low sun: the blade loses the sun with the ground (it used to stand straight up and keep it)
  assert.equal(vertex({ w: packHeightSlope(0.5, 0.5, 0, 0), sunDir: LOW.sunDir }).vLam, 0, 'the ground\'s own lambert there is nothing');
  assert.ok(vertex({ w: packHeightSlope(0.5, 0, 0, 0), sunDir: LOW.sunDir }).vLam > 0.43, 'on the level, the low sun\'s');
  assert.ok(GAME_GRASS_VS.includes('vec3 nrm = normalize(vec3(-lean.y, 0.0, lean.x) + 1.2 * gN);'), 'level ground\'s gN is the up the blade stood about (0.35 + 0.85 = 1.2)');
});

test('GRASS-LIT2: the lanterns light the root as they light the ground under it - TERRAIN_FS\'s (1 - d/r)^2 on the classic lane, the lane\'s elAttenuation on its own, each light\'s map where it has one, in the provoking vertex alone', () => {
  const lights = [
    { at: [16, 1.5, 15], range: 10, color: [1, 0.8, 0.6] },
    { at: [10, 2.0, 20], range: 18, color: [0.5, 0.45, 0.4] },
    { at: [60, 1.0, 15], range: 12, color: [3, 3, 3] },   // out of range: nothing
  ];
  const root = [15, 0, 15];
  for (const [nx, nz] of [[0, 0], [0.3, -0.2]]) {
    const w = packHeightSlope(0.5, nx, nz, 0);
    const { nx: qx, nz: qz } = unpackHeightSlope(w);
    const n = [qx, Math.sqrt(1 - qx * qx - qz * qz), qz];
    for (const lane of [0, 1]) {
      const got = vertex({ w, lane, lights }).vPoint;
      assert.ok(close(got, groundLanterns(root, n, lights, lane), 1e-9), `lane ${lane}, normal [${qx}, ${qz}]: ${got}`);
    }
  }
  // a light with a map: its shadow at the root, lifted off the ground's depth (half lit here); the others unshadowed
  const casterOf = Array(EL_MAX_LIGHTS).fill(-1); casterOf[0] = 0;
  const half = vertex({ lane: 1, lights, casterOf, shadow: 0.5 }).vPoint;
  const full = groundLanterns(root, [0, 1, 0], lights.slice(1), 1), first = groundLanterns(root, [0, 1, 0], lights.slice(0, 1), 1);
  assert.ok(close(half, full.map((v, i) => v + 0.5 * first[i]), 1e-9), `${half}`);
  // the other two vertices of a triangle hand nothing down - the provoking vertex's value is the triangle's (flat)
  assert.deepEqual(vertex({ lane: 1, lights, vertexId: 0 }).vPoint, [0, 0, 0]);
  assert.deepEqual(vertex({ lane: 1, lights: [] }).vPoint, [0, 0, 0], 'no lights, no light');
  assert.ok(GAME_GRASS_VS.includes(`shadowOfLight(i, uPointLights[i], rootW + vec3(0.0, ${GRASS_SUN_LIFT}, 0.0), vec3(0.0))`), 'the flats\' reader, at the sun\'s lift');
  assert.ok(GAME_GRASS_VS.includes('flat out vec3 vPoint;') && GAME_GRASS_FS.includes('flat in vec3 vPoint;'));
  assert.ok(GAME_GRASS_FS.includes('+ vNear + vPoint;'), 'and the fragment adds it beside the player\'s light, on the albedo, under the lane\'s pipeline');
  // the lane's falloff is ONE text - EL_GLSL carries it, and so does the grass
  assert.ok(EL_GLSL.includes(EL_ATTEN_GLSL) && GAME_GRASS_VS.includes(EL_ATTEN_GLSL));
  // the JS twin carries the lanterns as the stage does: on the classic lane the lanterns alone are an ambient of their
  // sum over the sward's shade; on the lane they add to the light
  const shade = 0.9 + 0.1 * 0.5;
  const pt = groundLanterns(root, [0, 1, 0], lights, 0);
  assert.ok(close(grassLit(WOOD, 0.5, { ...NOON, sunScale: 0, amb: [0, 0, 0], root, points: lights }, false), grassLit(WOOD, 0.5, { ...NOON, sunScale: 0, amb: pt.map((v) => v / shade) }, false), 1e-12));
  assert.ok(grassLit(WOOD, 0.5, { ...NOON, root, points: lights }, true).every((v, i) => v > grassLit(WOOD, 0.5, NOON, true)[i]));
});

test('GRASS-LIT2: the vertex stage still fits the vectors WebGL2 promises every device - 96 of them are the lanterns\' now', () => {
  // an upper bound: every declared non-sampler uniform live, every scalar a whole vector, a mat4 four (a compiler packs
  // scalars and drops what no path reads, so the real count is lower); MAX_VERTEX_UNIFORM_VECTORS is at least 256
  // AUDIT GRASS-LIT2 A5: off the CODE - the comments say "uniform random k" and were counted as six vectors
  const vs = (LAB_GRASS_HEAD + GAME_GRASS_FIELD + GAME_GRASS_VS).split('\n').map((l) => l.split('//')[0]).join('\n');
  let vectors = 0;
  for (const [, type, names] of vs.matchAll(/uniform\s+(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+([^;]+);/g)) {
    if (/sampler/.test(type)) continue;
    for (const v of names.split(',')) vectors += Number(v.match(/\[(\d+)\]/)?.[1] ?? 1) * (type === 'mat4' ? 4 : 1);
  }
  assert.ok(vectors <= 256, `${vectors} vectors at most`);
  assert.equal(vectors, 220, 'the count the docs quote');   // FLICKER-FIX: 212 with eight casters - uPointShadowParams and uShadowIndex are twelve now (+8)
  // the two const face tables are 12 more if a driver keeps a dynamically indexed const array in uniform storage
  assert.ok(vectors + 12 <= 256);
  assert.ok(GAME_GRASS_VS.includes(`uniform vec4 uPointLights[${GRASS_MAX_LIGHTS}];`) && GAME_GRASS_VS.includes(`uniform vec3 uPointColors[${GRASS_MAX_LIGHTS}];`));
});

test('GRASS-LIT2: the draw hands the shader the frame\'s lanterns - the list the ground took, linear under the lane, raw on the classic, cut to the program\'s slots; none handed is none', () => {
  const run = (light) => {
    const calls = []; let ids = 0;
    const gl = new Proxy({}, { get(_, k) {
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'isEnabled') return () => false;
      if (/^create/.test(k)) return () => ++ids;
      if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return k;
      return (...args) => { calls.push([k, ...args]); };
    } });
    const r = new LabGrassRenderer(gl);
    r.count = 1; r.slotBox = [];
    r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, { sunDir: [0, 1, 0], amb: [0.5, 0.5, 0.5], sunCol: [1, 1, 1], ...light }, { dir: [1, 0], speed: 0, windV: [0, 0] });
    return (name) => calls.filter((c) => c[1] === name).map((c) => c.slice(2));
  };
  const points = new Float32Array(50 * 4).map((_, i) => i);
  const colors = new Float32Array(50 * 3).map((_, i) => (i % 7) / 7);
  const lane = run({ points, pointColors: colors, lane: { decode3: elDecode3, decodeN: elDecodeN } });
  assert.deepEqual(lane('uPointCount'), [[0]], 'AUDIT A1: the count is a CELL\'s - none until a cell is drawn (this field draws none)');
  assert.deepEqual([...lane('uPointLights')[0][0]], [...points.subarray(0, GRASS_MAX_LIGHTS * 4)]);
  assert.ok(close([...lane('uPointColors')[0][0]], [...colors.subarray(0, GRASS_MAX_LIGHTS * 3)].map(elDecode), 1e-7), 'decoded, as the ground\'s');
  assert.deepEqual([...lane('uGrassTone')[0][0]], [...new Float32Array(GRASS_TONES.flat())], 'the lane\'s tones');
  const classic = run({ points: points.subarray(0, 8), pointColors: colors.subarray(0, 6) });
  assert.deepEqual(classic('uPointLights')[0][0].length, 8, 'as many as both arrays hold - two lights');
  assert.deepEqual([...classic('uPointColors')[0][0]], [...colors.subarray(0, 6)], 'display colours on the classic lane');
  assert.deepEqual([...classic('uGrassTone')[0][0]], [...new Float32Array(GRASS_TONES_CLASSIC.flat())], 'and its own tones');
  const none = run({});
  assert.deepEqual(none('uPointCount'), [[0]]);
  assert.equal(none('uPointLights').length, 0);
  // the host hands the list the ground took and its display colours
  const w = src('scenes/world.js');
  assert.ok(w.includes('points: renderer._pointLights, pointColors: renderer._pointColorData(renderer._pointLights.length >> 2, true) },'));
});

/** the drawn mesh's normal at a point: the triangle that holds it, off the real index buffer, its three vertex normals
 *  interpolated as the rasteriser does, normalised as TERRAIN_FS does */
function meshNormalAt(normals, lx, lz) {
  const g = HEIGHTMAP_DIMENSION, q = g - 1, cell = TERRAIN_SIZE / q;
  const idx = buildTerrainIndices(1);
  const P = (i) => [(i % g) * cell, Math.floor(i / g) * cell];
  const cx = Math.max(0, Math.min(q - 1, Math.floor(lx / cell))), cz = Math.max(0, Math.min(q - 1, Math.floor(lz / cell)));
  const base = (cz * q + cx) * 6;
  for (let t = 0; t < 2; t++) {
    const ia = idx[base + t * 3], ib = idx[base + t * 3 + 1], ic = idx[base + t * 3 + 2];
    const a = P(ia), b = P(ib), c = P(ic);
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    const u = ((b[1] - c[1]) * (lx - c[0]) + (c[0] - b[0]) * (lz - c[1])) / den;
    const v = ((c[1] - a[1]) * (lx - c[0]) + (a[0] - c[0]) * (lz - c[1])) / den;
    const wgt = 1 - u - v;
    if (u >= -1e-9 && v >= -1e-9 && wgt >= -1e-9) {
      const n = [0, 1, 2].map((k) => u * normals[ia * 3 + k] + v * normals[ib * 3 + k] + wgt * normals[ic * 3 + k]);
      const l = Math.hypot(...n);
      return n.map((x) => x / l);
    }
  }
  return null;
}

test('GRASS-LIT2: the ground\'s normal under a blade IS the drawn mesh\'s - the near grid\'s vertex normals over the triangle the root stands in, ghost rows and all', () => {
  const g = HEIGHTMAP_DIMENSION;
  const data = new Float32Array(g * g);
  for (let x = 0; x < g; x++) for (let z = 0; z < g; z++) data[x * g + z] = 0.5 + 0.03 * (Math.sin(x * 0.11) * Math.cos(z * 0.09) + 0.4 * Math.sin((x + z) * 0.34));
  const ghost = (x, z) => 0.5 + 0.03 * Math.sin(x * 0.2 + z * 0.1);
  const { normals } = buildTerrainGrid(data, 1, ghost);
  let s = 0x2f6b1d3 >>> 0;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  let worst = 0;
  for (let k = 0; k < 3000; k++) {
    const lx = rnd() * (TERRAIN_SIZE - 0.01), lz = rnd() * (TERRAIN_SIZE - 0.01);
    const m = meshNormalAt(normals, lx, lz), got = surfaceNormalAt(normals, lx, lz);
    worst = Math.max(worst, ...m.map((v, i) => Math.abs(v - got[i])));
  }
  assert.ok(worst < 1e-6, `the law is the mesh to ${worst}`);
  // at a vertex, the vertex's own normal; on the pixel's edge, the ghost row's (it is in the grid's normals)
  for (const [xi, zi] of [[0, 0], [5, 7], [g - 1, g - 1], [0, 64]]) {
    const at = surfaceNormalAt(normals, xi * TERRAIN_SIZE / (g - 1), zi * TERRAIN_SIZE / (g - 1));
    assert.ok(close(at, [0, 1, 2].map((c) => normals[(zi * g + xi) * 3 + c]), 1e-6), `vertex ${xi}, ${zi}`);
  }
  // a plane is its own normal everywhere
  for (let x = 0; x < g; x++) for (let z = 0; z < g; z++) data[x * g + z] = 0.4 + 0.002 * x - 0.001 * z;
  const plane = buildTerrainGrid(data, 1, (x, z) => 0.4 + 0.002 * x - 0.001 * z).normals;
  const want = surfaceNormalAt(plane, 400, 400);
  for (const [lx, lz] of [[3.3, 700.1], [511.7, 12.9], [818, 818]]) assert.ok(close(surfaceNormalAt(plane, lx, lz), want, 1e-5), 'to the float32 samples\' grain');
  // the out array is written and handed back - the host's one scratch
  const out = [9, 9, 9];
  assert.equal(surfaceNormalAt(plane, 1, 1, out), out);
});

test('GRASS-LIT2: the placer asks the slope of every blade that stands, sliced or whole the same bytes, and writeSlot packs it into the height lane', () => {
  const keep = (x, z) => ((Math.floor(x) + Math.floor(z)) % 7 === 0 ? null : 0.1 * x);
  const slope = (x, z) => [Math.sin(x * 0.1) * 0.4, 0.9, Math.cos(z * 0.1) * 0.3];
  const opts = { perCell: 1500, cell: 30 };
  const whole = placeLabGrassCell(2, -1, { ...opts, keep, slope });
  assert.ok(whole.count > 1000 && whole.count < 1500);
  for (let i = 0; i < whole.count; i++) {
    const [x, z] = [whole.inst[i * 4], whole.inst[i * 4 + 1]];
    assert.ok(Math.abs(whole.slope[i * 2] - Math.sin(x * 0.1) * 0.4) < 1e-5 && Math.abs(whole.slope[i * 2 + 1] - Math.cos(z * 0.1) * 0.3) < 1e-5, 'the normal\'s x and z at the root');
  }
  const st = beginGrassCell(2, -1, opts);
  while (!stepGrassCell(st, 211, { keep, slope }));
  assert.deepEqual([...st.slope], [...whole.slope], 'sliced, the same');
  // no slope asked, or none answered: level
  const level = placeLabGrassCell(2, -1, { ...opts, keep });
  assert.ok(level.slope.every((v) => v === 0));
  assert.deepEqual([...level.inst], [...whole.inst], 'and asking it moved no blade - the stream is the placer\'s');
  // the pack: lane A's fourth u16 is packHeightSlope's, blade by blade
  const subs = [];
  const gl = new Proxy({}, { get(_, k) {
    if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (/^create/.test(k)) return () => ({});
    if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return k;
    if (k === 'bufferSubData') return (_t, off, data) => subs.push(data.slice());
    return () => {};
  } });
  const r = new LabGrassRenderer(gl);
  r.allocSlots(1500, 2, 30);
  r.writeSlot(1, whole);
  const A = subs[0];
  for (const i of [0, 7, whole.count - 1]) {
    const hn = (whole.inst[i * 4 + 2] - heightFloor()) / heightSpan();
    assert.equal(A[i * 4 + 3], packHeightSlope(hn, whole.slope[i * 2], whole.slope[i * 2 + 1], i));
  }
  // a placed cell from before GRASS-LIT2 (no slope) packs level
  subs.length = 0;
  r.writeSlot(0, { ...whole, slope: undefined });
  assert.equal(unpackHeightSlope(subs[0][3]).nx, 0);
  // the field threads the host's slope to every cell it places
  const placed = [];
  const field = createGrassField({ allocSlots() {}, writeSlot: (s, c) => placed.push(c), clearSlot() {} }, { keep, slope, span: 40, range: 30, cell: 30, perFrame: 4, slots: 16, density: 1200000 });
  field.update(0, 0);
  assert.ok(placed.length > 0 && placed.every((c) => c.slope && [...c.slope.subarray(0, c.count * 2)].some((v) => v !== 0)));
});

test('GRASS-LIT2: the host reads the slope off the near grid\'s normals it keeps, and takes the grass\'s colour off the tile set that is drawn', () => {
  const w = src('scenes/world.js');
  assert.ok(w.includes('groundNormals: labGrass && stride === 1 ? normals : null,'), 'a near pixel keeps its grid\'s normals - AUDIT B1: only where there is grass');
  assert.ok(w.includes('p.groundNormals = labGrass && stride === 1 ? grid.normals : null;'), 'and a promotion or a demotion moves them with the surface');
  assert.ok(w.includes('return surfaceNormalAt(p.groundNormals, x - t[0], z - t[2], grassNormalScratch);'));
  // the mod's tile set, asked before the three are learned so they land in one step
  const learn = w.slice(w.indexOf('const drawnMeans = '), w.indexOf('const terrain = renderer.createTerrainSurface('));
  assert.ok(learn.startsWith('const drawnMeans = grassRecords.has(groundArchive) ? null\n      : groundDrawnMeans.has(groundArchive) ? groundDrawnMeans.get(groundArchive)\n      : (await dfmodGroundLayers(groundArchive, groundTex))?.map(tileMeanColour) ?? null;'));
  assert.ok(learn.indexOf('await') < learn.indexOf('grassRecords.set(') && learn.includes('groundMeanColour.set(groundArchive, drawnMeans ?? layers.map(tileMeanColour));'));
  // AUDIT GRASS-LIT2 B2: the means are the UPLOADED layers' - taken beside the upload, not asked of the door again
  assert.ok(w.includes('if (labGrass) groundDrawnMeans.set(groundArchive, modLayers ? modLayers.map(tileMeanColour) : null);'));
  assert.ok(w.indexOf('renderer.uploadTileArray(groundArchive, modLayers ? layers : markPuddleWater(layers));') < w.indexOf('if (labGrass) groundDrawnMeans.set('));
  assert.ok(learn.includes('grassRecords.set(groundArchive, grassRecordsOf(layers));'), 'which records are grass stays the classic file\'s question');
  // a mod's big tile is read every k-th texel, k odd - a two-texel pattern (the blue here) is read on both its phases; a classic tile whole
  const big = { width: 1024, height: 1024, colors: new Uint8Array(1024 * 1024 * 4) };
  for (let k = 0; k < 1024 * 1024; k++) { big.colors[k * 4] = 40 + (k % 3); big.colors[k * 4 + 1] = 90; big.colors[k * 4 + 2] = 30 + (k % 2) * 4; }
  const m = tileMeanColour(big);
  assert.ok(close(m, [41 / 255, 90 / 255, 32 / 255], 0.002), `${m.map((v) => (v * 255).toFixed(2))}`);
  const small = { width: 64, height: 64, colors: new Uint8Array(64 * 64 * 4) };
  let sr = 0;
  for (let k = 0; k < 4096; k++) { small.colors[k * 4] = (k * 37) % 251; sr += (k * 37) % 251; }
  assert.equal(tileMeanColour(small)[0], sr / 4096 / 255, 'a classic tile, every texel');
  // AUDIT GRASS-LIT2 A5: never more than the cap - a 256 x 384 tile read all 98,304 under the floor
  for (const n of [4096, 65536, 65537, 98304, 131044, 262144, 1048576, 1536 * 1536]) {
    const st = grassMeanStep(n);
    assert.ok(st % 2 === 1 && Math.ceil(n / st) <= GRASS_MEAN_SAMPLES, `${n} texels at step ${st}`);
  }
  assert.equal(grassMeanStep(4096), 1, 'a classic tile is read whole');
});

test('GRASS-LIT2: the shot hooks - the classic lane\'s tones by hand, and the heart of the deepest wood to look down on', () => {
  const w = src('scenes/world.js');
  assert.ok(w.includes("labGrass[classic ? 'tonesClassic' : 'tones'] = new Float32Array((tones ?? (classic ? GRASS_TONES_CLASSIC : GRASS_TONES)).flat())"));
  const hook = w.slice(w.indexOf('window.__forestSpot = (r = 10, here = false) => {'), w.indexOf('/** CSA-C probe: a land tile 3 tiles off a water tile'));
  assert.ok(hook.includes('forestAt(p.px * 128 + tx + dx, -p.py * 128 + tz + dz)'), 'FOREST1\'s field at the world tile');
  assert.ok(hook.includes('for (const p of here ? [cur] : built.values())') && hook.includes('origin: [t[0], t[2]]'), 'the player\'s own pixel on asking, and its origin - a pose off it stays in it');
  // AUDIT GRASS-LIT2 B5: a zero step never left either hook's loop; a hillside's yaw looks down it, read at the far half's middle
  assert.ok(w.includes('window.__grassSpot = (r = 6, skip = 0, steep = 0) => {\n      r = Math.max(1, r | 0);'));
  assert.ok(hook.startsWith('window.__forestSpot = (r = 10, here = false) => {\n      r = Math.max(1, r | 0);'));
  assert.ok(w.includes('(tz + r * 2 + 0.5) * 6.4, [0, 1, 0])') && w.includes('yaw: n ? Math.atan2(n[0], n[2]) : 0,'));
  // shot mode only: the hooks sit in the block the shot flag opens, beside __grassSpot
  const block = w.slice(0, w.indexOf('window.__forestSpot'));
  assert.ok(block.lastIndexOf('window.__grassSpot') > block.lastIndexOf('  if (shotMode) {'));
});

// ═══ AUDIT GRASS-LIT2 (2026-10-02, Mac: "Audit this") ═══════════════════
/** a GL that records, names every uniform location by its name, and hands out ids */
function recGl() {
  const calls = []; let ids = 0;
  const gl = new Proxy({}, { get(_, k) {
    if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (k === 'isEnabled') return () => false;
    if (/^create/.test(k)) return () => ++ids;
    if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return k;
    return (...args) => { calls.push([k, ...args]); };
  } });
  return { gl, calls, of: (name) => calls.filter((c) => c[1] === name).map((c) => c.slice(2)) };
}

test('AUDIT GRASS-LIT2 A1: a cell walks only the lanterns whose reach meets its box, nearest first, at most GRASS_CELL_LIGHTS - and the list goes up only when it changes', () => {
  assert.equal(GRASS_CELL_LIGHTS, 8);
  const { gl, calls, of } = recGl();
  const r = new LabGrassRenderer(gl);
  const box = [0, 10, 0, 30, 12, 30];   // a 30 m cell, its roots at 10 and its tallest tip at 12
  const lights = [
    [15, 11, 15, 5],     // 0: in the cell
    [100, 11, 15, 18],   // 1: 70 m off - its 18 m does not reach
    [40, 11, 15, 18],    // 2: 10 m past the edge - reaches
    [15, 40, 15, 18],    // 3: 28 m above the tips - does not
    [15, 25, 15, 18],    // 4: 13 m above - reaches
  ];
  r._pts = new Float32Array(lights.flat()); r._pn = lights.length; r._cellN = -1;
  r._cellLights(box);
  assert.deepEqual(of('uPointCount'), [[3]]);
  assert.deepEqual([...of('uPointIdx')[0][0]].slice(0, 3), [0, 2, 4], 'nearest first: inside (0), then 10 m (2), then 13 m (4)');
  const n0 = calls.length;
  r._cellLights(box);
  assert.equal(calls.length, n0, 'the same list again uploads nothing');
  r._cellLights([500, 10, 500, 530, 12, 530]);
  assert.deepEqual(of('uPointCount').at(-1), [0], 'a cell no lantern reaches walks none');
  const n1 = calls.length;
  r._cellLights([600, 10, 600, 630, 12, 630]);
  assert.equal(calls.length, n1, 'and an open field\'s cells are one upload, not one a cell');
  // past the cap: the nearest eight, ties to the earlier light
  const many = Array.from({ length: 12 }, (_, i) => [46 + (11 - i), 11, 15, 30]);   // light i stands 27 - i m past the cell's edge, inside its 30 m reach
  r._pts = new Float32Array(many.flat()); r._pn = many.length; r._cellN = -1;
  r._cellLights(box);
  assert.deepEqual(of('uPointCount').at(-1), [8]);
  assert.deepEqual([...of('uPointIdx').at(-1)[0]], [11, 10, 9, 8, 7, 6, 5, 4], 'the eight nearest, nearest first');
  // AUDIT GRASS-LIT2 C: the ties the line above names - nine lights all 10 m off, either side of the cell
  const ring9 = Array.from({ length: 9 }, (_, i) => [i % 2 ? 40 : -10, 11, 15, 30]);
  r._pts = new Float32Array(ring9.flat()); r._pn = ring9.length; r._cellN = -1;
  r._cellLights(box);
  assert.deepEqual([...of('uPointIdx').at(-1)[0]], [0, 1, 2, 3, 4, 5, 6, 7], 'a tie keeps the earlier light first, and the ninth off');
  // the draw resets the cell list each frame and walks it per drawn cell
  const src = readFileSync(new URL('../src/render/labGrass.js', import.meta.url), 'utf8');
  assert.ok(src.includes('this._pts = pn > 0 ? pts : null; this._pn = pn; this._cellN = -1;') && src.includes('if (this._pn > 0) this._cellLights(box);   // AUDIT GRASS-LIT2 A1'));
  assert.ok(GAME_GRASS_VS.includes(`uniform int uPointIdx[${GRASS_CELL_LIGHTS}];`) && GAME_GRASS_VS.includes('    int i = uPointIdx[j];\n'));
  // and the stage reads the cell's list: a light the list does not name lights nothing, though it is in the frame's
  const two = [{ at: [16, 1.5, 15], range: 10, color: [1, 0, 0] }, { at: [14, 1.5, 15], range: 10, color: [0, 0, 1] }];
  const both = vertex({ lights: two }).vPoint, second = vertex({ lights: two, cell: [1] }).vPoint;
  assert.ok(both[0] > 0 && both[2] > 0);
  assert.ok(second[0] === 0 && Math.abs(second[2] - both[2]) < 1e-12, 'the named one alone, by its own index');
});

test('AUDIT GRASS-LIT2 A2: a draw without shadows hands every lantern NO caster - a program\'s uniforms outlive the frame that set them, and a stale slot zeroed a lantern', () => {
  const { gl, of } = recGl();
  const r = new LabGrassRenderer(gl);
  r.count = 1; r.slotBox = [];
  r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, { sunDir: [0, 1, 0], amb: [0.5, 0.5, 0.5], sunCol: [1, 1, 1] }, { dir: [1, 0], speed: 0, windV: [0, 0] });
  const caster = of('uCasterOf');
  assert.equal(caster.length, 1);
  assert.ok([...caster[0][0]].length === 48 && [...caster[0][0]].every((v) => v === -1), 'every light without a map');
  assert.ok([...of('uPointShadowParams')[0][0]].every((v) => v === 0), 'every slot off');
  // what the stale state did: light 0 on caster slot 0, the slot's map answering black - the lantern went out; reset, lit
  const lights = [{ at: [16, 1.5, 15], range: 10, color: [1, 0.8, 0.6] }];
  const stale = Array(48).fill(-1); stale[0] = 0;
  assert.deepEqual(vertex({ lights, casterOf: stale, shadow: 0 }).vPoint, [0, 0, 0]);
  assert.ok(vertex({ lights, casterOf: Array(48).fill(-1), shadow: 0 }).vPoint[0] > 0);
});

// ─── AUDIT GRASS-LIT2 C: the tests' own holes - what a mutation of the new code walked past ─────────────────────────
/** The grass fragment's colour on the compiled stage (GRASS-LIT's fragment(), with the vertex stage's lamberts and
 *  lanterns handed in rather than assumed level): the smooth style at `t`, the patch tint at its mean, no snow, wet,
 *  fog or rim. `lane` hands the light decoded as the host does. */
function fragment({ ground = WOOD, t = 0.5, light = NOON, lane = false, vLam = 1, vMoonLam = 0, vPoint = [0, 0, 0], adapt = 1 }) {
  const dec = (c) => (lane ? c.map(elDecode) : c);
  const [hi, lo] = packAdapt(adapt);
  const f = glslFunctions(LAB_GRASS_HEAD + GAME_GRASS_FS, {
    vT: t, vTint: 0.5, vFade: 1, vLam, vSnow: 0, vWet: 0, vGround: [...ground], vMoonLam,
    vUV: [0.5, 0.5], vVar: 0, vWorld: [0, 0, 10], vSun: 1, vFar: 0, vNear: [0, 0, 0], vPoint,
    uAmb: dec(light.amb), uSunCol: dec(light.sunCol), uMoonCol: dec(light.moonCol ?? [0, 0, 0]), uDim: 1, uSunScale: light.sunScale, uMoonScale: light.moonScale ?? 0,
    uPixel: 0, uPxSteps: 8, uPxVariants: 8, uPxTintBands: 4, uLane: lane ? 1 : 0, uELExposure: EL_EXPOSURE,
    uGrassTone: (lane ? GRASS_TONES : GRASS_TONES_CLASSIC).map((k) => [...k]),
    uFogColor: [0, 0, 0], uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0],
    uDwFog: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    gl_FragCoord: [3, 5, 0.5, 1], o: [0, 0, 0, 0],
    texture: (name) => (name === 'uAdapt' ? [hi / 255, lo / 255, 0, 1] : [0.75, 0.9, 0.5, 1]),
  });
  f.main();
  return f.globals.o.slice(0, 3);
}

test('AUDIT GRASS-LIT2 C1: the stage rounds its word, never floors it - a GPU that normalises a unorm16 by the reciprocal in float32 hands 512 of the 65,536 words over a hair under themselves; the six bits\' top is the height law\'s top', () => {
  const f = Math.fround, recip = f(1 / 65535);
  const under = [];
  let exact = 0;
  for (let w = 0; w < 65536; w++) {
    if (f(f(w * recip) * 65535) < w) under.push(w);   // the reciprocal, the product in float32
    if (f(f(w / 65535) * 65535) < w) exact++;          // a correctly rounded normalise
  }
  assert.equal(under.length, 512, 'the words a floor reads one down on such a GPU');
  assert.equal(exact, 0, 'and none where the normalise is correctly rounded - the + 0.5 is for the GPUs that are not');
  const sun = [0.5, 0.7, -0.3], sl = Math.hypot(...sun);
  const check = (w) => {
    const u = unpackHeightSlope(w), g = vertex({ w, sunDir: sun });
    const n = [u.nx, Math.sqrt(Math.max(0, 1 - u.nx * u.nx - u.nz * u.nz)), u.nz];
    assert.ok(Math.abs(g.vLam - Math.max(0, (n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]) / sl)) < 1e-9, `word ${w}: its slope`);
    assert.ok(Math.abs(g.gl_Position[1] - (heightFloor() + u.hn * heightSpan()) * 0.5) < 1e-12, `word ${w}: its height`);
  };
  // a spread of those words, decoded as packed (the harness multiplies in doubles; each is under itself there too)
  for (let k = 0; k < under.length; k += 64) check(under[k]);
  // and packed blades at odd and even heights and steep slopes either way
  for (const [hn, nx, nz] of [[1, 0.3, -0.2], [0, -0.45, 0.25], [0.37, 0.6, 0], [0.81, -0.2, -0.65]]) for (const i of [0, 1, 2, 5]) check(packHeightSlope(hn, nx, nz, i));
  // the top code is the tallest blade the height law draws, the bottom its shortest - 63 steps between, not 62 or 64
  assert.ok(Math.abs(vertex({ w: packHeightSlope(1, 0, 0, 0) }).gl_Position[1] - (heightFloor() + heightSpan()) * 0.5) < 1e-12);
  assert.ok(Math.abs(vertex({ w: packHeightSlope(0, 0, 0, 0) }).gl_Position[1] - heightFloor() * 0.5) < 1e-12);
});

test('AUDIT GRASS-LIT2 C2: the slope\'s dither is R2 as its comment says - the plastic number\'s two powers, from the middle - so the two axes\' grain is independent, a patch takes the four steps round its slope in proportion, and a steep normal is held to the span itself', () => {
  let g = 1.3;
  for (let k = 0; k < 80; k++) g = Math.cbrt(1 + g);   // the plastic number: g^3 = g + 1
  const a1 = 1 / g, a2 = 1 / (g * g);
  const codes = (w) => [((w >> 5) & 31) ^ 15, (w & 31) ^ 15];
  // a slope between steps: x at 21.6 of the 31, z at 10.8
  const nx = 6.6 * GRASS_SLOPE_SPAN / GRASS_SLOPE_STEPS, nz = -4.2 * GRASS_SLOPE_SPAN / GRASS_SLOPE_STEPS;
  const joint = new Map();
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const dx = ((0.5 + i * a1) % 1) - 0.5, dz = ((0.5 + i * a2) % 1) - 0.5;
    const [cx, cz] = codes(packHeightSlope(0.5, nx, nz, i));
    assert.deepEqual([cx, cz], [Math.round(21.6 + dx), Math.round(10.8 + dz)], `blade ${i}`);
    joint.set(`${cx},${cz}`, (joint.get(`${cx},${cz}`) ?? 0) + 1);
  }
  // independent: each pair as often as its two axes' shares multiply (x up 60%, z up 80%)
  for (const [k, p] of [['22,11', 0.48], ['22,10', 0.12], ['21,11', 0.32], ['21,10', 0.08]]) {
    assert.ok(Math.abs((joint.get(k) ?? 0) / N - p) < 0.01, `steps ${k}: ${((joint.get(k) ?? 0) / N).toFixed(3)} of the patch, ${p} wanted`);
  }
  // past the span: the patch's mean IS the span, its heading kept
  for (const [sx, sz] of [[0.9, 0.9], [-0.95, 0.1], [0.2, -0.85]]) {
    let mx = 0, mz = 0;
    for (let i = 0; i < 4000; i++) { const u = unpackHeightSlope(packHeightSlope(0.5, sx, sz, i)); mx += u.nx / 4000; mz += u.nz / 4000; }
    const want = GRASS_SLOPE_SPAN / Math.hypot(sx, sz);
    assert.ok(Math.abs(mx - sx * want) < 0.003 && Math.abs(mz - sz * want) < 0.003, `[${sx}, ${sz}]: the mean ${mx.toFixed(4)}, ${mz.toFixed(4)}`);
  }
});

test('AUDIT GRASS-LIT2 C3: a lantern\'s lambert is the sun\'s - about the blade\'s own normal, its lean and the ground\'s - and a root no lantern reaches hands down nothing, whatever its out held', () => {
  const at = [17, 1.2, 14], L = [at[0] - 15, at[1], at[2] - 15], d = Math.hypot(...L);
  const lights = [{ at, range: 12, color: [1, 1, 1] }];
  let leaned = null;
  for (const lean of [[0.5, 0.5], [0.95, 0.2], [0.1, 0.75]]) for (const [nx, nz] of [[0, 0], [0.3, -0.2]]) {
    const g = vertex({ w: packHeightSlope(0.5, nx, nz, 0), lean, lights, sunDir: L, lane: 1 });
    assert.ok(g.vLam > 0.05, 'the lantern faces the blade');
    assert.ok(Math.abs(g.vPoint[0] - elAttenuation(d, 12) * g.vLam) < 1e-9, `lean ${lean}, slope [${nx}, ${nz}]: ${g.vPoint[0]} against the sun's ${g.vLam}`);
    if (lean[0] !== 0.5) leaned = g.vLam;
  }
  assert.ok(Math.abs(leaned - vertex({ w: packHeightSlope(0.5, 0.3, -0.2, 0), lights, sunDir: L }).vLam) > 0.02, 'and a lean moves it - the case is one the ground\'s normal alone would miss');
  // an out the stage does not write is undefined on a GPU - it must write it: none in reach, none in the list, none at all
  const garbage = { vPoint: [NaN, NaN, NaN] };
  assert.deepEqual(vertex({ lights: [], bind: garbage }).vPoint, [0, 0, 0]);
  assert.deepEqual(vertex({ lights: [{ at: [90, 1, 15], range: 12, color: [1, 1, 1] }], bind: garbage }).vPoint, [0, 0, 0]);
  assert.deepEqual(vertex({ lights, cell: [], bind: garbage }).vPoint, [0, 0, 0]);
});

test('AUDIT GRASS-LIT2 C4: the JS twin is the two stages end to end - on a hillside, under the moon, beside the lanterns, on both lanes - what the probe prints is what the GPU draws', () => {
  const lights = [{ at: [17, 1.2, 14], range: 12, color: [0.9, 0.7, 0.4] }, { at: [12, 2, 18], range: 9, color: [0.3, 0.3, 0.5] }];
  const root = [15, 0, 15];
  const NIGHT = { ...LOW, sunScale: 0.2, moonCol: [0.5, 0.55, 0.7], moonScale: 0.3, moonDir: [0.3, 0.8, -0.5] };
  const eye = unpackAdapt(...packAdapt(1));
  for (const [nx, nz] of [[0, 0], [0.3, -0.2], [-0.5, 0.35]]) {
    const w = packHeightSlope(0.5, nx, nz, 0), u = unpackHeightSlope(w);
    const normal = [u.nx, Math.sqrt(1 - u.nx * u.nx - u.nz * u.nz), u.nz];
    for (const lane of [false, true]) {
      const up = lights.map((l) => ({ ...l, color: lane ? l.color.map(elDecode) : l.color }));   // as the draw uploads them
      const v = vertex({ w, sunDir: NIGHT.sunDir, moonDir: NIGHT.moonDir, lane: lane ? 1 : 0, lights: up });
      assert.ok(v.vPoint.some((c) => c > 0) && v.vMoonLam > 0, 'the lanterns and the moon both reach the root');
      for (const t of [0.3, 0.7]) {
        const got = fragment({ t, light: NIGHT, lane, vLam: v.vLam, vMoonLam: v.vMoonLam, vPoint: v.vPoint });
        const want = grassLit(WOOD, t, { ...NIGHT, normal, root, points: lights }, lane, eye);
        assert.ok(close(got, want, 1e-6), `slope [${u.nx}, ${u.nz}], lane ${lane}, t ${t}: ${got} vs ${want}`);
      }
    }
  }
});

test('AUDIT GRASS-LIT2 C5: the draw cuts the lanterns to the shorter of its two lists - a light with no colour is no light - and the classic lane\'s colours to the count', () => {
  const run = (light, lane = null) => {
    const { gl, of } = recGl();
    const r = new LabGrassRenderer(gl);
    r.count = 1; r.slotBox = [];
    r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, { sunDir: [0, 1, 0], amb: [0.5, 0.5, 0.5], sunCol: [1, 1, 1], lane, ...light }, { dir: [1, 0], speed: 0, windV: [0, 0] });
    return { of, r };
  };
  const points = new Float32Array(5 * 4).map((_, i) => i + 1), colors = new Float32Array(3 * 3).map((_, i) => (i + 1) / 10);
  const short = run({ points, pointColors: colors });
  assert.equal(short.r._pn, 3, 'five lights, three colours: three lanterns');
  assert.equal(short.of('uPointLights')[0][0].length, 12);
  const long = run({ points: points.subarray(0, 8), pointColors: new Float32Array(5 * 3).fill(0.5) });
  assert.equal(long.r._pn, 2);
  assert.equal(long.of('uPointColors')[0][0].length, 6, 'the classic lane uploads the count\'s colours, not the list\'s');
});

test('AUDIT GRASS-LIT2 C6: a rim cell placed a slice a frame asks the slope as a whole cell does - a walk\'s new cells stand on the hillside too', () => {
  const keep = () => 0, slope = () => [0.3, 0.9, -0.2];
  const placed = [];
  const field = createGrassField({ allocSlots() {}, clearSlot() {}, shiftSlots() {}, writeSlot: (_s, c) => placed.push(c) }, { keep, slope, range: 120, span: 150 });
  for (let f = 0; f < 3000 && field.update(0, 0) !== 0; f++);
  placed.length = 0;
  let ex = 0, sliced = 0;
  for (let f = 0; f < 400; f++) { ex += 0.5; field.update(ex, 0); if (field.pending) sliced++; }
  assert.ok(sliced > 10 && placed.length > 3, `the rim came in by slices (${sliced} frames, ${placed.length} cells)`);
  for (const c of placed) {
    assert.ok(c.count > 0);
    for (let i = 0; i < c.count; i++) assert.ok(Math.abs(c.slope[i * 2] - 0.3) < 1e-6 && Math.abs(c.slope[i * 2 + 1] + 0.2) < 1e-6, 'every blade of it on the slope');
  }
});

test('AUDIT GRASS-LIT2 C7: a root a hair off the pixel\'s low edge reads the edge\'s normal - never the row before the grid', () => {
  const g = HEIGHTMAP_DIMENSION;
  const data = new Float32Array(g * g);
  for (let x = 0; x < g; x++) for (let z = 0; z < g; z++) data[x * g + z] = 0.5 + 0.03 * Math.sin(x * 0.2) * Math.cos(z * 0.15);
  const { normals } = buildTerrainGrid(data, 1, (x, z) => 0.5 + 0.03 * Math.sin(x * 0.2) * Math.cos(z * 0.15));
  for (const [lx, lz] of [[-0.01, 3], [3, -0.02], [-0.03, -0.01]]) {
    const n = surfaceNormalAt(normals, lx, lz);
    assert.ok(n.every(Number.isFinite) && close(n, surfaceNormalAt(normals, Math.max(lx, 0), Math.max(lz, 0)), 1e-3), `${lx}, ${lz}: ${n}`);
  }
});

/** a world.js closure or hook lifted by its text and run over stand-ins for the scene's names */
function lift(text, names, values) {
  return new Function(...names, `const window = {};\n${text}\nreturn window;`)(...values);
}
const hookText = (w, start) => { const i = w.indexOf(start); assert.ok(i >= 0, start); return w.slice(i, w.indexOf('\n    };\n', i) + 7); };

test('AUDIT GRASS-LIT2 C8: the host\'s slope asks the drawn surface only where the pixel keeps its normals - a far pixel, or the field off, is level, not a throw', () => {
  const w = src('scenes/world.js');
  const start = w.indexOf('const slope = (x, z) => {\n        const hit = pieceAt(x, z);');
  const text = w.slice(start, w.indexOf('\n      };', start) + 9);
  const scratch = [0, 0, 0];
  const run = (hit) => new Function('pieceAt', 'surfaceNormalAt', 'grassNormalScratch', `${text}\nreturn slope;`)(() => hit, surfaceNormalAt, scratch)(10, 20);
  assert.equal(run(null), null, 'off the built pixels');
  assert.equal(run({ p: { groundNormals: null }, t: [0, 0, 0] }), null, 'a pixel drawn at a stride keeps no normals: level');
  const flat = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION * 3).map((_, i) => (i % 3 === 1 ? 1 : 0));
  assert.equal(run({ p: { groundNormals: flat }, t: [0, 0, 0] }), scratch, 'and one that keeps them is read into the one scratch');
});

test('AUDIT GRASS-LIT2 C9: the shot hooks run - the hillside hook keeps to a slope steep enough, the wood hook to the most forest on grass', () => {
  const w = src('scenes/world.js');
  const names = ['built', 'state', 'grassRecords', 'TERRAIN_TILE_DIM', 'surfaceNormalAt', 'heightAt', 'forestAt'];
  const g = HEIGHTMAP_DIMENSION;
  const normalsOf = (n) => new Float32Array(g * g * 3).map((_, i) => n[i % 3]);
  const lean = [0.5, 0.8, 0.2].map((v, _i, a) => v / Math.hypot(...a));
  const pixel = (px, py, normals, holes = []) => {
    const tilemapBytes = new Uint8Array(128 * 128).fill(2 << 2);   // record 2: grass
    for (const [tx, tz] of holes) tilemapBytes[tz * 128 + tx] = 5 << 2;
    return { px, py, groundArchive: 302, tilemapBytes, groundNormals: normals };
  };
  const flatP = pixel(3, 2, normalsOf([0, 1, 0])), hillP = pixel(4, 2, normalsOf(lean));
  const built = new Map([['3,2', flatP], ['4,2', hillP]]);
  const state = { current: { x: 3, y: 2 }, pixelTranslation: (px, py) => [px * 1000, 0, -py * 1000] };
  const peak = [40, 60];   // the wood's heart, on a tile that is not grass
  const forestAt = (wx, wz) => Math.exp(-((wx - 3 * 128 - peak[0]) ** 2 + (wz + 2 * 128 - peak[1]) ** 2) / 200);
  flatP.tilemapBytes[peak[1] * 128 + peak[0]] = 5 << 2;
  const hooks = lift(hookText(w, 'window.__grassSpot = (r = 6, skip = 0, steep = 0) => {') + '\n' + hookText(w, 'window.__forestSpot = (r = 10, here = false) => {'),
    names, [built, state, new Map([[302, new Set([2])]]), 128, surfaceNormalAt, () => 0, forestAt]);
  // level ground, no steepness asked: the player's own pixel, its first square, looking along it
  const any = hooks.__grassSpot(2);
  assert.deepEqual([any.pixel, any.yaw, any.normal], [[3, 2], 0, null]);
  // a hillside asked: the level pixel passes, the leaning one answers, its yaw down the slope
  const hill = hooks.__grassSpot(2, 0, 0.3);
  assert.deepEqual(hill.pixel, [4, 2]);
  assert.ok(Math.abs(hill.yaw - Math.atan2(lean[0], lean[2])) < 1e-6 && Math.hypot(hill.normal[0], hill.normal[2]) >= 0.3);
  assert.equal(hooks.__grassSpot(2, 0, 0.9), null, 'and none that steep, none');
  // the wood: the most forest of the squares whose middle is grass - the heart itself is not, so its neighbour
  const r = 2, wood = (tx, tz) => { let s = 0, k = 0; for (let dz = -r; dz <= r; dz += 2) for (let dx = -r; dx <= r; dx += 2) { s += forestAt(3 * 128 + tx + dx, -2 * 128 + tz + dz); k++; } return s / k; };
  const spot = hooks.__forestSpot(r, true);
  const tx = Math.round((spot.feet[0] - 3000) / 6.4 - 0.5), tz = Math.round((spot.feet[2] + 2000) / 6.4 - 0.5);
  assert.ok(flatP.tilemapBytes[tz * 128 + tx] >> 2 === 2, `the tile it stands on (${tx}, ${tz}) is grass`);
  assert.ok(Math.abs(spot.wood - wood(tx, tz)) < 1e-12 && spot.wood > 0.8, `its wood ${spot.wood}`);
  for (let z = r; z < 128 - r; z += r) for (let x = r; x < 128 - r; x += r) {
    if (flatP.tilemapBytes[z * 128 + x] >> 2 === 2) assert.ok(wood(x, z) <= spot.wood + 1e-12, `(${x}, ${z}) has no more`);
  }
  assert.ok(wood(...peak) > spot.wood, 'the heart itself has more, and is passed over');
  assert.deepEqual(spot.origin, [3000, -2000]);
});

test('AUDIT GRASS-LIT2 C10: the ground the lanterns are held to IS the terrain programs\' text - groundLanterns models TERRAIN_FS\'s loop and the lane\'s elPointLit diffuse, so a change to either fails here, not just in the picture', () => {
  const r = src('render/renderer.js');
  const at = r.indexOf('const TERRAIN_FS = `');
  const tfs = r.slice(at, r.indexOf('`;', at));
  assert.ok(tfs.includes('    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);\n    pointAcc += att * att * max(dot(n, L / max(d, 1e-4)), 0.0) * uPointColors[i];\n'), 'the classic lane: (1 - d/r)^2 on n.L');
  assert.ok(tfs.includes('lit += tex * pointAcc;'), 'on the albedo');
  assert.ok(EL_TERRAIN_FS.includes('    if (d >= uPointLights[i].w) continue;') && EL_TERRAIN_FS.includes('    float att = sh * elAttenuation(d, uPointLights[i].w);\n    acc += att * (max(dot(n, Ln), 0.0) + spec) * uPointColors[i];\n'), 'the lane: elAttenuation on n.L (the spec set aside, as groundLanterns says)');
  assert.ok(EL_TERRAIN_FS.includes('elPointLit(vWorldPos, n)'), 'and the lane\'s terrain reads it');
});

test('AUDIT GRASS-LIT2 C11: the probes measure what they say - the light probe\'s classic "was" is the blade before GRASS-LIT2, in GRASS_TONES, and the look probe paints the lane it boots', () => {
  // the twin paints with other tones on asking, its lane's own by default
  assert.deepEqual(grassLit(WOOD, 0.5, NOON, false, 1, GRASS_TONES_CLASSIC), grassLit(WOOD, 0.5, NOON, false));
  const old = grassLit(WOOD, 0.5, NOON, false, 1, GRASS_TONES), now = grassLit(WOOD, 0.5, NOON, false);
  assert.ok(old.every((v, i) => v > now[i]), 'the classic blade before GRASS-LIT2 was the brighter');
  // the light probe's two "was" columns take it; the docs quote that probe (0.21-0.52x and 1.34-1.43x before)
  const light = readFileSync(new URL('../tools/grassLightProbe.mjs', import.meta.url), 'utf8');
  assert.ok(light.includes('was = grassLit(mean, 0.5, base, lane, 1, GRASS_TONES)') && light.includes('was = grassLit(mean, 0.5, night, lane, 1, GRASS_TONES)'));
  // the look probe hands a palette to the lane booted - one argument painted the default lane's alone
  const look = readFileSync(new URL('../tools/grassLookProbe.mjs', import.meta.url), 'utf8');
  assert.ok(look.includes('window.__grassTones?.(x.tones, x.classic)') && look.includes('classic: v.classic ?? prefs.enhancedLighting === false'));
});
