// FAR-SEA1 (2026-10-10, Mac: "Anyway we can fix the draw distance for oceans without affecting performance?") -
// THE SEA REACHES THE HORIZON. From a mountain over the sea the streamed water faded into the world fog at the fog's
// end, stood fully fogged to the streamed grid's square edge, and past it the far ring's sea came back at its 85%
// haze hold - darker than the band in front of it. Pinned with no GL and no game data: the horizon's one haze law
// (run on the shader's own text by test/glsl.mjs), the ring's sea and its look, the sea inside the hole and its gate,
// the water's sea-level arm and the frame's wiring.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from '../glsl.mjs';
import { HORIZON_HAZE_GLSL, SEA_LOOK_GLSL, RING_SEA_GLSL, SEA_HAZE_BAND } from '../../src/render/horizonHaze.js';
import {
  buildFarRingGrid, buildFarRingIndices, buildSeaFillIndices, seaFillCount, perspectiveFar, ringHeight, FarRingRenderer,
  RING_HAZE_HOLD, RING_RIM_START, RING_RIM_END, RING_RADIUS, RING_REBUILD_DRIFT, RING_SEA_UNIT,
} from '../../src/render/farRing.js';
import { EL_FAR_RING_FS } from '../../src/render/enhancedLighting.js';
import { classicShadowLane } from '../../src/render/classicShadowLane.js';
import { waterSurfaceFs, waterUniforms, WATER_F0, WATER_LIFT, WATER_TINT, SWELL_GALE } from '../../src/render/waterSurface.js';
import { FOG_GLSL } from '../../src/render/fogGlsl.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { perspective, mirrorProjectionX } from '../../src/world/mat4.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';

const rd = (p) => readFileSync(p, 'utf8');
const close = (a, b, m, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${m}: ${a} !~ ${b}`);
const haze = glslFunctions(HORIZON_HAZE_GLSL + SEA_LOOK_GLSL);
const hz = (d, start, end) => haze.horizonHaze(d, start, end, RING_RIM_START, RING_RIM_END, RING_HAZE_HOLD);

test('FAR-SEA1: the horizon\'s haze is the world fog\'s own ramp CAPPED at the hold, then closed over the ring\'s rim', () => {
  // nearer than the hold it is the world's linear fog exactly - DFU's sunny row, scaled to Land view 5 (0..4000)
  for (const d of [0, 400, 1000, 2000, 3000, 3400]) close(hz(d, 0, 4000), d / 4000, `d ${d}: the world's ramp`);
  // past it the hold - not the world's solid fog
  for (const d of [3500, 4000, 4500, 6000, 9000, RING_RIM_START]) close(hz(d, 0, 4000), RING_HAZE_HOLD, `d ${d}: the hold`);
  // the rim closes it into the sky
  const mid = (RING_RIM_START + RING_RIM_END) / 2;
  close(hz(mid, 0, 4000), RING_HAZE_HOLD + (1 - RING_HAZE_HOLD) * 0.5, 'half way through the rim, half the rest');
  close(hz(RING_RIM_END, 0, 4000), 1, 'the rim: all sky');
  close(hz(RING_RIM_END * 2, 0, 4000), 1, 'never past one');
  // a fog that starts late (Dynamic Skies' Sunny, 2000 to 3600 - AUDIT 61 F9) ramps from its own start
  close(hz(2000, 2000, 3600), 0, 'clear to the start');
  close(hz(2800, 2000, 3600), 0.5, 'half way');
  close(hz(5000, 2000, 3600), RING_HAZE_HOLD, 'and held');
  // the scaled form it replaced (hold * ramp) left the ring LESS fogged than the ground beside it inside the ramp
  assert.ok(Math.abs(hz(1000, 0, 4000) - RING_HAZE_HOLD * 0.25) > 0.01, 'capped, not scaled');
});

test('FAR-SEA1: the constants - the hold is EV8\'s, the rim is the nearest rim a drifted base presents', () => {
  assert.equal(RING_HAZE_HOLD, 0.85);
  close(RING_RIM_END, (RING_RADIUS - RING_REBUILD_DRIFT) * TERRAIN_SIZE * 0.95, 'AUDIT EV F-R3\'s rim', 1e-6);
  close(RING_RIM_START, RING_RIM_END * 0.6, 'the close starts at six tenths of it', 1e-6);
  assert.ok(RING_RIM_START > (6 + 1) * TERRAIN_SIZE * Math.SQRT2, 'the rim opens past every streamed grid\'s farthest corner (Land view 6): the sea in the grid is held, never closed');
});

test('FAR-SEA1: the open sea\'s light is ONE text - the water surface calls it, and the ring\'s deep sea is its own arm', () => {
  const fs = waterSurfaceFs('', '');
  // AUDIT FAR-SEA1 C12: the water's own lines call the leaf - no second copy of the Fresnel, the sky, the light or the lobes
  assert.ok(fs.includes(SEA_LOOK_GLSL), 'the water takes the text');
  for (const line of ['float F = seaFresnel(NdV, uF0);', 'vec3 skyRefl = seaSkyRefl(R.y, uSkyZenith, uSkyHorizon);',
    'vec3 lit = body * seaLight(uAmbient, uSunColor, uSunScale * diff, uMoonColor, uMoonScale * mdiff);',
    'float spec = seaSunLobe(dot(n, H)) * uSunScale * shadow * (1.0 - foam);', 'float mspec = seaMoonLobe(dot(n, Hm)) * uMoonScale;',
    'own += seaGlints(uSunColor, spec, uMoonColor, mspec) + pointSpec * 1.2;',
    'own = lit * (vec3(1.0) - T) * (1.0 - F) + skyRefl * F;']) assert.ok(fs.includes(line), `the water: ${line}`);
  assert.ok(!/0\.85 - uF0|pow\(max\(dot\(n, H/.test(fs), 'and no copy of its own');
  // seaSky is the deep arm (T nothing): lit * (1 - F) + sky * F - at every facing, a negative one clamped (an eye under the
  // ring's sea faces its underside)
  const lit = [0.1, 0.2, 0.3], zen = [0.2, 0.35, 0.7], hor = [0.65, 0.78, 0.92];
  for (const ndv of [-0.3, 0, 0.05, 0.2, 0.6, 1]) {
    const c = Math.min(1, Math.max(0, ndv));
    const F = WATER_F0 + (0.85 - WATER_F0) * (1 - c) ** 5;
    const t = Math.min(1, Math.max(0, 0.2 + ndv * 1.4));
    const got = haze.seaSky(lit, ndv, zen, hor, WATER_F0);
    for (let k = 0; k < 3; k++) close(got[k], lit[k] * (1 - F) + (hor[k] + (zen[k] - hor[k]) * t) * F, `ndv ${ndv} channel ${k}`);
  }
  close(haze.seaLight([0.2, 0.2, 0.2], [1, 0.5, 0.25], 0.5, [0.1, 0.1, 0.1], 0.4)[1], 0.2 + 0.5 * 0.5 * 0.6 + 0.1 * 0.4, 'the light: the sun softly');
  close(haze.seaSunLobe(Math.cos(0.05)), Math.cos(0.05) ** 180, 'the sun\'s lobe, 180');
  close(haze.seaMoonLobe(Math.cos(0.05)), Math.cos(0.05) ** 220, 'the moon\'s, 220');
  close(haze.seaGlints([1, 1, 1], 0.5, [1, 1, 1], 0.5)[0], 1.6 * 0.5 + 0.7 * 0.5, 'their weights');
});

test('FAR-SEA1: every ring shader - classic, the lane, the classic-shadow lane - fades by the one law and lights its sea as the water', () => {
  const fr = rd('src/render/farRing.js');
  const classicFs = fr.slice(fr.indexOf('const FS = `#version 300 es'), fr.indexOf('}`;', fr.indexOf('const FS = `#version 300 es'))).replace('${RING_SEA_GLSL}', RING_SEA_GLSL);
  // PIN MOVED (OW-HORIZON, 2026-10-20): the land and the sea take the ring's sun at their point (cloudShadow.js ringSun - the
  // clouds' map where it knows the ground, the far law past it) where they took the scale whole
  const order = (text, lines, name) => {
    let at = -1;
    for (const l of lines) { const i = text.indexOf(l); assert.ok(i > at, `${name}: '${l}' in its place`); at = i; }
  };
  // AUDIT FAR-SEA1 C1: the whole output line, and the sea's line between the light and it - inverted or dead, it fails
  order(classicFs, ['float sun = ringSun();', 'vec3 lit = vColor * (uAmbient + uSunColor * (sun * diff) + uMoonColor * (uMoonScale * mdiff));',
    'float sea = vSea * uSeaLook;', 'if (sea > 0.0) lit = mix(lit, ringSea(uAmbient, uSunColor, uMoonColor, sun), sea);',
    'outColor = vec4(mix(lit, uFogColor, ringHaze(horizonHaze(vDist, uFogStart, uFogEnd, uRimStart, uRimEnd, uHazeHold))), 1.0);'], 'classic');   // BANTHA1: the jungle's haze over the horizon's
  // the lane: its ground through the tonemap into display space, the sea in the water's own space from the light as given
  for (const [name, text] of [['lane', EL_FAR_RING_FS], ['classic shadows', classicShadowLane().farRingFs]]) {
    order(text, ['float sun = ringSun();', 'vec3 shown = elEncode(elTonemapRGB(lit * ex));', 'float sea = vSea * uSeaLook;',
      'if (sea > 0.0) shown = mix(shown, ringSea(uSeaAmbient, uSeaSunColor, uSeaMoonColor, sun), sea);',
      'vec3 col = mix(shown, uFogColor, ringHaze(horizonHaze(vDist, uFogStart, uFogEnd, uRimStart, uRimEnd, uHazeHold)));'], name);
  }
  for (const text of [classicFs, EL_FAR_RING_FS]) {
    assert.ok(!/uHazeHold \* clamp\(/.test(text), 'the scaled ramp is gone');
    assert.ok(!/gl_FragDepth/.test(text), 'AUDIT FAR-SEA1 P1: no depth write - the pass places it at the far plane');
  }
  // AUDIT FAR-SEA1 C2: what the sea's look reads, as the vertex shader mints it
  for (const line of ['vSea = aSea;', 'vWorld = world;', 'vSeaBody = textureLod(uSeaTiles, vec3(0.5, 0.5, 0.0), 8.0).rgb * uSeaTint;']) assert.ok(fr.includes(line), `the VS: ${line}`);
  assert.ok(fr.includes('layout(location=3) in float aSea;'), 'the sea\'s weight an attribute');
  // ringSea, run: the water's deep sea at a flat normal - its body lit as the water's, its sky, its glints
  const L = [0.3, 0.2, 0.93], M = [0, 1, 0], eye = [0, 334, 0], wp = [0, 34, 5000];
  const f = glslFunctions(`uniform vec3 uLightDir; uniform float uSunScale; uniform vec3 uMoonDir; uniform float uMoonScale;\n${RING_SEA_GLSL}`, {
    vSea: 1, vWorld: wp, vSeaBody: [0.1, 0.15, 0.2], uEye: eye, uSkyZenith: [0.2, 0.35, 0.7], uSkyHorizon: [0.65, 0.78, 0.92], uSeaF0: WATER_F0, uSeaLook: 1,
    uLightDir: L, uSunScale: 0.54, uMoonDir: M, uMoonScale: 0,
  });
  const got = f.ringSea([0.9, 0.9, 0.9], [1, 0.95, 0.85], [0, 0, 0], 0.54);   // PIN MOVED (OW-HORIZON, 2026-10-20): the sun's scale handed at the sea's point
  const v = [eye[0] - wp[0], eye[1] - wp[1], eye[2] - wp[2]]; const vl = Math.hypot(...v); const V = v.map((x) => x / vl);
  const lit = [0.1, 0.15, 0.2].map((b, k) => b * (0.9 + [1, 0.95, 0.85][k] * (0.54 * L[1] * 0.6)));
  const h = [L[0] + V[0], L[1] + V[1], L[2] + V[2]]; const hl = Math.hypot(...h);
  const sky = haze.seaSky(lit, V[1], [0.2, 0.35, 0.7], [0.65, 0.78, 0.92], WATER_F0);
  for (let k = 0; k < 3; k++) close(got[k], sky[k] + [1, 0.95, 0.85][k] * 1.6 * (h[1] / hl) ** 180 * 0.54, `ringSea channel ${k}`, 1e-6);
  assert.ok(V[1] > 0, 'the facing is up from a sea below the eye');
});

test('FAR-SEA1: the ring\'s sea is a water pixel at the sea\'s own height - not land, not an Ocean-climate pixel standing up', () => {
  const W = 40, H = 40;
  const bytes = new Uint8Array(W * H).fill(0);
  bytes[20 * W + 20] = 60;   // an island
  bytes[20 * W + 21] = 2;    // shallows (a water byte, still at the sea's clamp)
  bytes[21 * W + 20] = 30;   // land under the Ocean climate
  const climateAt = (x, y) => (x === 20 && y === 21 ? CLIMATES.Ocean : 231);
  const g = buildFarRingGrid({ heightBytes: bytes, mapWidth: W, mapHeight: H, climateAt, baseX: 20, baseY: 20, radius: 3 });
  const at = (px, py) => g.sea[(py - 20 + 3) * g.side + (px - 20 + 3)];
  assert.equal(at(19, 19), 255, 'open sea');
  assert.equal(at(21, 20), 255, 'the shallows');
  assert.equal(at(20, 20), 0, 'the island');
  assert.equal(at(20, 21), 0, 'an Ocean-climate pixel above the sea is not the sea');
  assert.equal(g.positions[((20 - 20 + 3) * g.side + (19 - 20 + 3)) * 3 + 1], Math.fround(ringHeight(0)), 'and the sea stands at the clamp (f32 storage)');
});

test('FAR-SEA1: the sea inside the hole - only fully-inside cells, only four sea corners, never a cell the ring keeps, farthest first', () => {
  const W = 60, H = 60, baseX = 30, baseY = 30, radius = 8, d = 3;
  const bytes = new Uint8Array(W * H).fill(0);
  bytes[30 * W + 31] = 80;   // an island inside the streamed rect
  const g = buildFarRingGrid({ heightBytes: bytes, mapWidth: W, mapHeight: H, climateAt: () => 231, baseX, baseY, radius });
  const hole = { baseX, baseY, radius, holeX: 30, holeY: 30, holeRadius: d };
  const ring = buildFarRingIndices(hole);
  const { indices: fill, reach } = buildSeaFillIndices({ ...hole, sea: g.sea });
  const side = radius * 2 + 1;
  const cellOf = (i0) => [baseX - radius + (i0 % side), baseY - radius + Math.floor(i0 / side)];
  const cellsOf = (idx) => { const s = new Set(); for (let t = 0; t < idx.length; t += 6) s.add(cellOf(idx[t]).join(',')); return s; };
  const ringCells = cellsOf(ring), fillCells = cellsOf(fill);
  for (const c of fillCells) assert.ok(!ringCells.has(c), `cell ${c}: drawn once`);
  // the island's pixel is a corner of four cells: (30,29) (31,29) (30,30) (31,30) - every one left out
  for (const c of ['30,29', '31,29', '30,30', '31,30']) assert.ok(!fillCells.has(c), `cell ${c} touches the island`);
  assert.equal(fillCells.size, (2 * d) ** 2 - 4, 'every other fully-inside cell is the sea');
  assert.equal(ringCells.size + fillCells.size, (side - 1) ** 2 - 4, 'with the ring, the whole mesh but the island\'s four');
  // the same winding as the ring's cells
  assert.deepEqual([...fill.subarray(0, 6)].map((i) => i - fill[0]), [0, side, side + 1, 0, side + 1, 1]);
  // AUDIT FAR-SEA1 P1: farthest first - each cell's reach its farthest corner (pixel centres) from the hole pixel's centre
  assert.equal(reach.length, fillCells.size);
  for (let k = 0; k < reach.length; k++) {
    const [px, py] = cellOf(fill[k * 6]);
    const want = TERRAIN_SIZE * Math.hypot(Math.max(Math.abs(px - 30), Math.abs(px + 1 - 30)), Math.max(Math.abs(py - 30), Math.abs(py + 1 - 30)));
    close(reach[k], want, `cell ${px},${py}`, 1e-2);
    if (k) assert.ok(reach[k] <= reach[k - 1], 'descending');
  }
  close(reach[0], TERRAIN_SIZE * Math.hypot(3, 3), 'the corners first', 1e-2);
  // an all-land hole fills nothing
  const land = buildFarRingGrid({ heightBytes: new Uint8Array(W * H).fill(90), mapWidth: W, mapHeight: H, climateAt: () => 231, baseX, baseY, radius });
  assert.equal(buildSeaFillIndices({ ...hole, sea: land.sea }).indices.length, 0);
});

/** A GL that hands names for locations and records what it is told. */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && /^TEXTURE\d+$/.test(k)) return 1000 + Number(k.slice(7));
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls };
}

test('FAR-SEA1: the pass - the sea\'s attribute, its tail counted from the eye and the world\'s lens, its body, sky and Fresnel, at the far plane', () => {
  const { gl, calls } = recordingGl();
  const r = new FarRingRenderer(gl);
  const W = 400, H = 400;
  r.build({ heightBytes: new Uint8Array(W * H).fill(0), mapWidth: W, mapHeight: H, climateAt: () => 231, baseX: 200, baseY: 200 }, 200, 200, 6);
  assert.ok(calls.some((c) => c[0] === 'vertexAttribPointer' && c[1] === 3 && c[2] === 1 && c[3] === 'UNSIGNED_BYTE' && c[4] === true), 'the sea weight on location 3, one normalised byte');
  const side = RING_RADIUS * 2 + 1;
  assert.equal(r.ringCount, ((side - 1) ** 2 - 144) * 6, 'the ring keeps its hole');
  assert.equal(r.indexCount, (side - 1) ** 2 * 6, 'and an open sea fills it');
  const lens = mirrorProjectionX(perspective(1.1, 1.6, 0.2, 6000));
  const seaY = ringHeight(0), centre = [0.5 * TERRAIN_SIZE, 0, 0.5 * TERRAIN_SIZE];   // the base pixel's centre (z runs north)
  const opts = { origin: [0, 0, 0], lightDir: [0, 1, 0], ambient: [0.4, 0.4, 0.4], sunScale: 0.5, sunColor: [1, 1, 1], fogColor: [0.6, 0.7, 0.8], fogEnd: 4000, fovY: 1, aspect: 1.6, worldProj: lens };
  const draws = () => calls.filter((c) => c[0] === 'drawElements').map((c) => c[2]);
  const reach = r._fillReach;
  const expect = (eye) => seaFillCount(reach, { far: 6000 * 0.99, h: eye[1] - seaY, offset: Math.hypot(eye[0] - centre[0], eye[2] - centre[2]) });
  for (const eye of [[centre[0], seaY + 300, centre[2]], [centre[0] + 400, seaY + 300, centre[2] - 400], [centre[0], seaY + 3000, centre[2]]]) {
    calls.length = 0;
    r.draw(new Float32Array(16), { ...opts, eye });
    assert.deepEqual(draws(), [r.ringCount + 6 * expect(eye)], `eye ${eye.map(Math.round)}: the ring and the cells that can be past the plane, one draw`);
  }
  assert.ok(expect([centre[0], seaY + 300, centre[2]]) < reach.length / 4, 'from 300 up, a corner\'s worth of the 144 - not the hole');
  calls.length = 0;
  r.draw(new Float32Array(16), { ...opts, eye: [centre[0], seaY - 1, centre[2]] });
  assert.deepEqual(draws(), [r.ringCount], 'the eye under the sea: the ring alone');
  calls.length = 0;
  r.draw(new Float32Array(16), { ...opts, eye: [centre[0], seaY + 300, centre[2]], worldProj: null });
  assert.deepEqual(draws(), [r.ringCount], 'no lens to count from: no fill');
  // at the far plane by the viewport: depthRange(1, 1) around the draw, put back after
  const seq = calls.filter((c) => c[0] === 'depthRange' || c[0] === 'drawElements').map((c) => c.join(','));
  assert.deepEqual(seq, ['depthRange,1,1', `drawElements,TRIANGLES,${r.ringCount},UNSIGNED_INT,0`, 'depthRange,0,1']);
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uSeaLook')[2], 0, 'no sky handed (the classic panorama, the water off): the sea lit as ground, never a day sky at night');
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uSeaF0')[2], WATER_F0, 'the water\'s own Fresnel');
  close(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uRimEnd')[2], RING_RIM_END, 'the rim', 1e-6);
  calls.length = 0;
  const tiles = { id: 'tiles' };
  r.draw(new Float32Array(16), { ...opts, eye: [centre[0], seaY + 300, centre[2]], skyZenith: [0.1, 0.2, 0.3], skyHorizon: [0.4, 0.5, 0.6], seaTiles: tiles, seaTint: [0.5, 1, 2] });
  assert.deepEqual(calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uSkyZenith')[2], [0.1, 0.2, 0.3], 'the frame\'s sky');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uSkyHorizon')[2], [0.4, 0.5, 0.6], '...both of it');
  assert.equal(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uSeaLook')[2], 1, 'and the sea under it');
  const tint = calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uSeaTint')[2];
  [0.5, 1, 2].forEach((t, k) => close(tint[k], WATER_TINT[k] * t, `the water's tint under the sea's, channel ${k}`, 1e-6));
  const unit = calls.findIndex((c) => c[0] === 'activeTexture' && c[1] === 1000 + RING_SEA_UNIT);
  assert.deepEqual(calls[unit + 1], ['bindTexture', 'TEXTURE_2D_ARRAY', tiles], 'the water\'s tiles on the sea\'s unit');
  assert.equal(calls.find((c) => c[0] === 'uniform1i' && c[1] === 'uSeaTiles')[2], RING_SEA_UNIT);
  r.dispose();
  assert.equal(r.ringCount, 0);
});

test('FAR-SEA1: the water - the sea\'s level takes the ring\'s haze under linear fog when the host set it, nothing else does', () => {
  const fs = waterSurfaceFs('', '');
  assert.ok(fs.includes('uniform vec2 uSeaHaze;'), 'declared: the hold and the sea\'s height');
  assert.equal(SEA_HAZE_BAND, 1, 'one unit about the sea');
  assert.ok(fs.includes(`  if (uSeaHaze.x > 0.0 && uFogMode == 1) {
    float seaW = 1.0 - smoothstep(0.50, 1.00, abs(vWorldPos.y - uSeaHaze.y));
    fw = mix(fw, max(fw, 1.0 - uSeaHaze.x), seaW);
  }`), 'off unless set, linear fog only, the world\'s own factor floored at the hold over the sea\'s band, faded over its outer half');
  assert.ok(fs.indexOf('fw = mix(fw, max(fw, 1.0 - uSeaHaze.x), seaW);') > fs.indexOf('float fw = fogFactorAt(vWorldPos);')
    && fs.indexOf('fw = mix(fw, max(fw, 1.0 - uSeaHaze.x), seaW);') < fs.indexOf('vec3 fogged = own * fw'), 'between the world\'s factor and its use');
  // the band holds the sheet: its lift and a gale's whole swell, the sum of the trains' amplitudes, inside the unfaded half
  assert.ok(WATER_LIFT + SWELL_GALE < SEA_HAZE_BAND * 0.5, 'the sea\'s sheet inside its band\'s whole half, a lake 2 m above the coast outside it');
  // AUDIT FAR-SEA1 C4/P3: the floor IS the law - FOG_GLSL's own linear factor floored at 1 - hold is 1 - horizonHaze at
  // every distance the streamed sea stands (its farthest corner, Land view 6, short of the rim)
  const fog = glslFunctions(`uniform int uFogMode; uniform float uFogDensity; uniform vec2 uFogRange; uniform vec3 uCamPos;\n${FOG_GLSL}`, { uFogMode: 1, uFogRange: [2000, 3600], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0], uFogDensity: 0 });
  for (const d of [0, 1500, 2600, 3300, 3400, 3600, 5000, 8110]) {
    close(Math.max(fog.fogFactorAt([d, 0, 0]), 1 - RING_HAZE_HOLD), 1 - haze.horizonHaze(d, 2000, 3600, RING_RIM_START, RING_RIM_END, RING_HAZE_HOLD), `d ${d}`, 1e-6);
  }
  assert.ok(RING_RIM_START > (6.5 * Math.SQRT2 + 0.71) * TERRAIN_SIZE, 'the rim opens past the grid\'s farthest corner from anywhere in the player\'s pixel');
});

test('FAR-SEA1: the renderer - setSeaHaze reaches the water\'s frame block, beginFrame clears it, the open sea takes it too', () => {
  const { gl, calls } = recordingGl();
  const r = new Renderer({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const P = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1]), N = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), IX = new Uint32Array([0, 2, 1, 1, 2, 3]);
  const sheet = r.createWaterSheet(IX, { terrain: r.createTerrainSurface(P, N, IX) });
  const wu = waterUniforms({ seconds: 0, sky: { zenith: [0.2, 0.3, 0.6], horizon: [0.6, 0.7, 0.8] } });   // AUDIT FAR-SEA1 C11: the producer's shape
  const seaHaze = () => calls.filter((c) => c[0] === 'uniform2fv' && c[1] === 'uSeaHaze').map((c) => c[2]);
  const both = (got, want, m) => want.forEach((v, i) => close(got[i], v, `${m} ${i}`, 1e-3));
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  r.setSeaHaze(RING_HAZE_HOLD, 42.5);
  calls.length = 0;
  r.drawWaterSurface(sheet, I, { id: 'arr' }, { id: 'map' }, 6.4, wu);
  assert.equal(seaHaze().length, 1, 'once a call');
  both(seaHaze()[0], [RING_HAZE_HOLD, 42.5], 'the terrain\'s water');
  calls.length = 0;
  r.drawSeaSurfaces([{ h: { surface: { vao: { id: 'sea' }, count: 6 } }, model: I }], 0, wu, [1, 1, 1], { id: 'arr' });
  both(seaHaze()[0], [RING_HAZE_HOLD, 42.5], 'Iliac Puddle No More\'s open sea, the same block');
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  calls.length = 0;
  r.drawWaterSurface(sheet, I, { id: 'arr' }, { id: 'map' }, 6.4, wu);
  assert.equal(seaHaze()[0][0], 0, 'a frame\'s: the next frame is the world\'s fog alone until its host draws the ring');
  r.setSeaHaze(RING_HAZE_HOLD, 3); r.setSeaHaze(null);
  calls.length = 0;
  r.drawWaterSurface(sheet, I, { id: 'arr' }, { id: 'map' }, 6.4, wu);
  assert.equal(seaHaze()[0][0], 0, 'null turns it off');
});

test('FAR-SEA1: the world host - the ring takes the water\'s sky, body and eye, and the sea its haze, on a frame the ring is drawn', () => {
  const w = rd('src/scenes/world.js');
  const at = w.indexOf('    const frameRing = () => {   // PERF-V8');
  assert.ok(at > 0);
  const ring = w.slice(at, w.indexOf('    frameRing();', at));
  assert.ok(ring.includes("if (farRing && fogNow.mode === 'linear') {"), 'the ring\'s own gate');
  assert.ok(ring.includes('skyZenith: waterSkyNow?.zenith, skyHorizon: waterSkyNow?.horizon, eye: renderer._camPos, worldProj: renderer._proj,'), 'the dome\'s sky; the eye and the world\'s own lens the fill is counted from');
  assert.ok(ring.includes('seaTiles: waterSkyNow ? snowCover.arrayOf(seaGroundArchive()) : null, seaTint: _dwFrame && !_dwFrame.underwater ? _dwFrame.look.topColor : null,'), 'the water\'s own body: the camera climate\'s tiles, Iliac Puddle No More\'s tint');   // AUDIT PRECIP GROUND-2 (PIN MOVED): the set as the snow lane holds it - its twin, whose first half it is
  assert.match(ring, /\n      if \(waterSkyNow\) renderer\.setSeaHaze\(RING_HAZE_HOLD, seaYNow\);\n    \}\n    \};\n$/,
    'the gate\'s last statement, only with a sky to reflect - never on a frame without the ring (?ring=off, exp fog), where the held sea would meet the bare sky');
  // AUDIT FAR-SEA1 C3: found, and before the ring
  const seaYAt = w.indexOf('    const seaYNow = farRing ? tvSeaY() : 0;');
  assert.ok(seaYAt > 0 && seaYAt < at, 'the sea\'s height read before the ring');
  const skyAt = w.indexOf('    const waterSkyNow = waterOn ? sky.waterSky() : null;');
  assert.ok(skyAt > 0 && skyAt < at, 'the sky read once, with the water on');
  assert.ok(w.indexOf('    frameRing();') < w.indexOf('    frameWater();'), 'the haze is set before the water draws');
  // one home for the sea's climate: Iliac Puddle No More's sea and the ring's sea read the same archive
  assert.equal((w.match(/snowCover\.arrayOf\(seaGroundArchive\(\)\)/g) || []).length, 2, 'the open sea and the ring\'s sea, one body');   // AUDIT PRECIP GROUND-2 (PIN MOVED)
  assert.equal((w.match(/renderer\.tileArrays\.get\(seaGroundArchive\(\)\)/g) || []).length, 0, 'never the bare set, which the snow lane does not upload');
  assert.match(w, /import \{ FarRingRenderer, ringDisabled, ringHeight, RING_HAZE_HOLD, BuiltPixels \} from '\.\.\/render\/farRing\.js';/);   // PIN MOVED (OW-HORIZON, 2026-10-20): and the built pixels the ring's hole is keyed by
  // THE FOUR HOSTS: the fixed city draws the water and no ring, the interiors and the dungeons neither - none sets it
  for (const f of ['src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js', 'src/tools/waterLab.js']) assert.ok(!rd(f).includes('setSeaHaze'), `${f}: the world's fog alone`);
  // the lens reads back the world's far plane
  close(perspectiveFar(mirrorProjectionX(perspective(1.1, 1.6, 0.2, 6000))), 6000, 'the far plane from the world\'s own lens', 10);
});
