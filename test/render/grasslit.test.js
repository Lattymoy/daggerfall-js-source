// GRASS-LIT (2026-10-01, Mac: "drastically improve the grass texture that isn't super dark and blends well into the
// terrain") - the grass painted in the ground's own colours and lit by the ground's own light, on both lighting lanes,
// and the ambient occlusion read off the world without the field in it. The fragment stage is run on its OWN TEXT
// through test/glsl.mjs and held against the terrain programs' formulas (renderer.js TERRAIN_FS, enhancedLighting.js
// EL_TERRAIN_FS), term for term.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LAB_GRASS_HEAD, GAME_GRASS_VS, GAME_GRASS_FS, GRASSLIT_VS_EDITS, GRASSLIT_FS_EDITS, GRASS_TONES, GRASS_TONES_CLASSIC, GRASS_PALETTE,
  GRASS_SWARD, GRASS_SUN_LIFT, GRASS_FAR_BLEND, GRASS_TILE_MEANS, GRASS_ADAPT_UNIT, GRASS_CLOUD_UNIT, grassLit, LabGrassRenderer,
} from '../../src/render/labGrass.js';
import { elDecode, elDecode3, elEncode, elTonemapRGB, EL_EXPOSURE, EL_GLSL, EL_CODEC_GLSL } from '../../src/render/enhancedLighting.js';
import { AirPass, packAdapt, unpackAdapt } from '../../src/render/airPass.js';
import { Renderer, CLOUD_SHADOW_UNIT } from '../../src/render/renderer.js';
import { SHADOW_SUN_UNIT, SHADOW_POINT_UNIT, SHADOW_LO_UNIT } from '../../src/render/shadowPass.js';
import { glslFunctions } from '../glsl.mjs';

const src = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');
const close = (a, b, e = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) <= e);
const ONES = [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]];
const NOON = { amb: [0.9, 0.9, 0.9], sunCol: [0.8161765, 0.954361, 1], sunScale: 0.6, sunDir: [0, 1, 0] };
const DUSK = { amb: [0.42, 0.42, 0.42], sunCol: [0.8161765, 0.954361, 1], sunScale: 0.18, sunDir: [-0.96, 0.28, 0] };
const WOOD = GRASS_TILE_MEANS.woodland;
/** the eye's multiplier 1 as its sixteen-bit image holds it (LA-POST4) - 1.00004, not 1 */
const EYE_ONE = unpackAdapt(...packAdapt(1));

/** The grass fragment's colour, run on the compiled stage's own text: the smooth style at a blade's height `t`, the
 *  patch tint at its mean, no snow or wet or fog. `lane` hands the light DECODED as the host does under the lane. */
function fragment({ ground = WOOD, t = 0.5, light = NOON, lane = false, tones = lane ? GRASS_TONES : GRASS_TONES_CLASSIC, vSun = 1, vFar = 0, vNear = [0, 0, 0], vPoint = [0, 0, 0], adapt = 1 }) {   // GRASS-LIT2: each lane's own tones, and the lanterns
  const dec = (c) => (lane ? c.map(elDecode) : c);
  const [hi, lo] = packAdapt(adapt);
  const f = glslFunctions(LAB_GRASS_HEAD + GAME_GRASS_FS, {
    vT: t, vTint: 0.5, vFade: 1, vLam: Math.max(light.sunDir[1], 0), vSnow: 0, vWet: 0, vGround: [...ground], vMoonLam: 0,
    vUV: [0.5, 0.5], vVar: 0, vWorld: [0, 0, 10], vSun, vFar, vNear, vPoint,
    uAmb: dec(light.amb), uSunCol: dec(light.sunCol), uMoonCol: [0, 0, 0], uDim: 1, uSunScale: light.sunScale, uMoonScale: 0,
    uPixel: 0, uPxSteps: 8, uPxVariants: 8, uPxTintBands: 4, uLane: lane ? 1 : 0, uELExposure: EL_EXPOSURE,
    uGrassTone: tones.map((k) => [...k]),
    uFogColor: [0, 0, 0], uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0],
    uDwFog: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    gl_FragCoord: [3, 5, 0.5, 1], o: [0, 0, 0, 0],
    texture: (name) => (name === 'uAdapt' ? [hi / 255, lo / 255, 0, 1] : [0.75, 0.9, 0.5, 1]),
  });
  f.main();
  return f.globals.o.slice(0, 3);
}
/** the terrain's displayed colour for an albedo on flat ground, on each lane - TERRAIN_FS / EL_TERRAIN_FS's lit line */
function terrain(tex, light, lane, adapt = 1) {
  const diff = Math.max(light.sunDir[1], 0);
  if (!lane) return tex.map((v, i) => v * (light.amb[i] + light.sunCol[i] * light.sunScale * diff));
  const lit = tex.map((v, i) => elDecode(v) * (elDecode(light.amb[i]) + elDecode(light.sunCol[i]) * light.sunScale * diff) * EL_EXPOSURE * adapt);
  return elTonemapRGB(lit).map(elEncode);
}

test('GRASS-LIT: the numbers - the tones the field is painted with, the palette they come from, the shade, the lift, the blend', () => {
  assert.deepEqual(GRASS_TONES.map((t) => [...t]), [[0.92, 0.92, 0.97], [1.18, 1.24, 1.08], [1.38, 1.5, 1.14], [1.56, 1.7, 1.25]]);
  assert.deepEqual({ ...GRASS_PALETTE, root: [...GRASS_PALETTE.root], tip: [...GRASS_PALETTE.tip], top: [...GRASS_PALETTE.top] },
    { root: [0.852, 0.844, 0.953], tip: [1.135, 1.166, 1.089], top: [1.241, 1.275, 1.231] }, 'measured off TEXTURE.102/104/302/304/402, 2026-10-01');
  assert.deepEqual([GRASS_SWARD, GRASS_SUN_LIFT, [...GRASS_FAR_BLEND]], [0.9, 0.2, [0.12, 0.6]]);
  // the root is the ground in its own shade, the middle its light third and over, the tip and highlight brighter again
  assert.ok(GRASS_TONES[0].every((v, i) => v < 1 && v >= GRASS_PALETTE.root[i]), 'the root sits between the tile\'s dark third and its mean - it melts into the ground');
  for (let k = 1; k < 4; k++) assert.ok(GRASS_TONES[k].every((v, i) => v > GRASS_TONES[k - 1][i]), `tone ${k} is lighter than tone ${k - 1}`);
  assert.ok(GRASS_TONES[3][1] > GRASS_TONES[3][0] && GRASS_TONES[3][1] > GRASS_TONES[3][2], 'the highlight leans green, as a lit blade does');
});

test('GRASS-LIT: on the classic lane a blade in the ground\'s own colour is lit exactly as the ground under it (TERRAIN_FS\'s formula), and the tones only lighten it', () => {
  for (const light of [NOON, DUSK]) {
    for (const ground of Object.values(GRASS_TILE_MEANS)) {
      // t = 1: no sward shade; the rim is the sun's own 0.12 on top
      const got = fragment({ ground, t: 1, light, tones: ONES });
      const lam = Math.max(light.sunDir[1], 0);
      const want = terrain(ground, light, false).map((v, i) => v + light.sunCol[i] * light.sunScale * 0.12 * lam);
      assert.ok(close(got, want), `${ground}: ${got} vs ${want}`);
      // mid-blade: the sward's shade on the ambient alone, and the rim not yet
      const mid = fragment({ ground, t: 0.5, light, tones: ONES });
      const shade = GRASS_SWARD + (1 - GRASS_SWARD) * 0.5;
      assert.ok(close(mid, ground.map((v, i) => v * (light.amb[i] * shade + light.sunCol[i] * light.sunScale * lam))));
    }
  }
  // the classic lane's tones (GRASS-LIT2's GRASS_TONES_CLASSIC; AUDIT GRASS-LIT2: this said "the shipped tones", which
  // are the lane's): the root a touch under the ground, the middle and the tip over it - never the old two-thirds
  const g = terrain(WOOD, NOON, false);
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const root = fragment({ t: 0, light: NOON }), mid = fragment({ t: 0.5, light: NOON }), tip = fragment({ t: 0.9, light: NOON });
  assert.ok(lum(root) / lum(g) > 0.8 && lum(root) / lum(g) < 1, `the root ${(lum(root) / lum(g)).toFixed(2)}x the ground`);
  assert.ok(lum(mid) / lum(g) > 1.05 && lum(tip) / lum(g) > lum(mid) / lum(g), `the middle ${(lum(mid) / lum(g)).toFixed(2)}x, the tip ${(lum(tip) / lum(g)).toFixed(2)}x`);
});

test('GRASS-LIT: under Enhanced Lighting the blade runs the lane\'s own pipeline - decoded, exposed, adapted, tonemapped, encoded - and so meets the ground as EL_TERRAIN_FS draws it', () => {
  for (const adapt of [1, 0.5, 2.5]) {
    for (const light of [NOON, DUSK]) {
      const got = fragment({ t: 0.5, light, lane: true, tones: ONES, adapt });
      const shade = GRASS_SWARD + (1 - GRASS_SWARD) * 0.5;
      const lam = Math.max(light.sunDir[1], 0);
      const lit = WOOD.map((v, i) => elDecode(v) * (elDecode(light.amb[i]) * shade + elDecode(light.sunCol[i]) * light.sunScale * lam) * EL_EXPOSURE * unpackAdapt(...packAdapt(adapt)));
      assert.ok(close(got, elTonemapRGB(lit).map(elEncode), 1e-6), `adapt ${adapt}`);
    }
  }
  // with the sward's shade gone (t = 1) and the rim set aside, the blade IS the terrain's pixel
  const tip = fragment({ t: 1, light: NOON, lane: true, tones: ONES });
  const rim = NOON.sunCol.map((c) => elDecode(c) * NOON.sunScale * 0.12);
  assert.ok(close(tip.map((v, i) => v - rim[i]), terrain(WOOD, NOON, true, EYE_ONE), 1e-6));
  // and the lane's pipeline is not the classic's: the old blade, lit in display space, drifted from the lane's ground
  assert.ok(!close(fragment({ t: 0.5, lane: true, tones: ONES }), fragment({ t: 0.5, lane: false, tones: ONES }), 0.01));
});

test('GRASS-LIT: the JS twin is the shader, term for term, on both lanes - what tools/grassLightProbe.mjs prints is what the GPU draws', () => {
  for (const lane of [false, true]) for (const light of [NOON, DUSK]) for (const t of [0, 0.3, 0.7]) {
    for (const ground of Object.values(GRASS_TILE_MEANS)) {
      assert.ok(close(fragment({ ground, t, light, lane }), grassLit(ground, t, light, lane, EYE_ONE), 1e-6), `lane ${lane} t ${t}`);
    }
  }
});

test('GRASS-LIT: a root out of the sun (a cloud\'s shade, a tree\'s) loses the sun and its rim; the far field is the ground\'s colour; the player\'s light adds', () => {
  const shaded = fragment({ t: 1, vSun: 0, tones: ONES });
  assert.ok(close(shaded, WOOD.map((v, i) => v * NOON.amb[i])), 'the ambient alone - the ground under a tree is lit so');
  assert.ok(close(fragment({ t: 0.6, vFar: 1 }), fragment({ t: 0.6, tones: ONES })), 'at the range\'s far blend the tones give way to the ground\'s mean');
  const near = fragment({ t: 0.5, vNear: [0.2, 0.2, 0.2], tones: ONES });
  assert.ok(close(near.map((v, i) => v - WOOD[i] * 0.2), fragment({ t: 0.5, tones: ONES })), 'the player\'s light, on the albedo, as the ground takes it');
});

test('GRASS-LIT: the vertex stage reads the root\'s sun once - the deck and the sun map, lifted off the ground\'s own depth, only while the sun is up - and hands the far blend and the player\'s light down', () => {
  assert.ok(GAME_GRASS_VS.includes(`vSun = (gl_VertexID % 3 == 2 && uSunScale > 0.0) ? cloudShadowAt(rootW) * sunShadowAt(rootW + vec3(0.0, ${GRASS_SUN_LIFT}, 0.0), vec3(0.0, 1.0, 0.0)) : 0.0;`), 'the provoking vertex reads it');
  assert.ok(GAME_GRASS_VS.includes('flat out float vSun;') && GAME_GRASS_FS.includes('flat in float vSun;'), 'and hands it down flat - one value a triangle, the provoking vertex\'s');
  assert.ok(GAME_GRASS_VS.includes('vec3 rootW = vec3(root.x, gRootY + snowSurf, root.y);'), 'the root stands on the snow\'s surface, where the blade is planted');
  assert.ok(GAME_GRASS_VS.includes(`vFar = smoothstep(uRange * ${GRASS_FAR_BLEND[0]}, uRange * ${GRASS_FAR_BLEND[1]}, d);`));
  assert.ok(GAME_GRASS_VS.includes('vNear = iAtt * iAtt * max(dot(nrm, iL / max(iD, 1e-4)), 0.0) * uIndirectColor;'), 'R12\'s falloff, the ground\'s own');
  assert.ok(GAME_GRASS_VS.includes('vec3 nrm = normalize(vec3(-lean.y, 0.0, lean.x) + 1.2 * gN);'), 'GRASS-LIT2: about the ground\'s own normal (test/render/grasslit2.test.js) - level ground\'s is the old up');
  for (const name of ['float cloudShadowAt(vec3 wp)', 'float sunShadowAt(vec3 wp, vec3 n)']) assert.ok(GAME_GRASS_VS.includes(name), `the terrain's own reader: ${name}`);
  assert.equal(GRASSLIT_VS_EDITS.length, 6, 'GRASS-LIT2: and the height lane\'s two; AUDIT GRASS-LIT2 A6: and its word\'s comment'); assert.equal(GRASSLIT_FS_EDITS.length, 8);
  // the lane's codec is ONE text - EL_GLSL carries it, and so does the grass
  assert.ok(EL_GLSL.includes(EL_CODEC_GLSL) && GAME_GRASS_FS.includes(EL_CODEC_GLSL));
  // no weather dim from the host: the light is weathered already
  const w = src('scenes/world.js');
  assert.ok(w.includes('dim: 1, lane: renderer.lightingLane, exposure: renderer.exposure, adaptTex: renderer.adaptTexture,'));
});

/** A GL that records, answers every uniform location by its name and hands out ids. */
function recordingGl() {
  const calls = []; let ids = 0;
  const gl = new Proxy({}, { get(_, k) {
    if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (k === 'isEnabled') return () => false;
    if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture' || k === 'createFramebuffer') return () => ++ids;
    if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return k;
    return (...args) => { calls.push([k, ...args]); };
  } });
  return { gl, calls };
}

test('GRASS-LIT: the draw hands the shader the frame\'s light - linear under the lane, the deck and the sun map on their own units, the shipped tones; none of it, and the classic lane in sun', () => {
  const { gl, calls } = recordingGl();
  const r = new LabGrassRenderer(gl);
  r.count = 1; r.slotBox = [];   // a field with nothing in view: draw() runs its uploads and submits no slot
  let uploaded = null;
  const shadows = { upload: (loc) => { uploaded = loc; } };
  const cloud = { map: 'deckTex', rect: new Float32Array([1, 2, 0.5, 0.75]) };
  r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, {
    sunDir: new Float32Array([0, 1, 0]), amb: new Float32Array([0.5, 0.5, 0.5]), sunCol: new Float32Array([1, 0.9, 0.8]), sunScale: 0.6,
    lane: { decode3: elDecode3 }, exposure: 1.7, adaptTex: 'eyeTex', cloud, shadows, indirect: new Float32Array([1, 2, 3, 10]), indirectColor: new Float32Array([0.4, 0.4, 0.4]),
  }, { dir: [1, 0], speed: 0, windV: [0, 0] });
  const u = (name) => calls.filter((c) => c[1] === name).map((c) => c.slice(2));
  assert.deepEqual(u('uLane'), [[1]]);
  assert.deepEqual(u('uELExposure'), [[1.7]]);
  assert.ok(close([...u('uAmb')[0][0]], [0.5, 0.5, 0.5].map(elDecode), 1e-6), 'the ambient decoded (into a Float32Array)');
  assert.ok(close([...u('uSunCol')[0][0]], [1, 0.9, 0.8].map(elDecode), 1e-6), 'the sun decoded');
  assert.ok(close([...u('uIndirectColor')[0][0]], [0.4, 0.4, 0.4].map(elDecode), 1e-6), 'the player\'s light decoded');
  assert.deepEqual([...u('uGrassTone')[0][0]], [...new Float32Array(GRASS_TONES.flat())], 'the shipped tones, as a Float32Array holds them');
  assert.deepEqual(u('uDim'), [[1]], 'no dim handed is none');
  assert.deepEqual(u('uAdapt'), [[GRASS_ADAPT_UNIT]]);
  assert.deepEqual(u('uCloudShadowMap'), [[GRASS_CLOUD_UNIT]]);
  assert.equal(GRASS_CLOUD_UNIT, CLOUD_SHADOW_UNIT, 'the deck rides the renderer\'s own unit - the same map it binds there');
  assert.deepEqual([...u('uCloudShadowRect')[0][0]], [1, 2, 0.5, 0.75]);
  assert.ok(calls.some((c) => c[0] === 'bindTexture' && c[2] === 'deckTex') && calls.some((c) => c[0] === 'bindTexture' && c[2] === 'eyeTex'));
  assert.equal(uploaded, r.shadowLoc, 'the frame\'s ShadowPass binds its maps for this program, by the names it binds the terrain\'s');
  // the classic lane, no deck, no map, no player's light: display colours, full sun, the samplers on units of their own
  const b = recordingGl();
  const c = new LabGrassRenderer(b.gl);
  c.count = 1; c.slotBox = [];
  c.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, { sunDir: [0, 1, 0], amb: [0.5, 0.5, 0.5], sunCol: [1, 0.9, 0.8], dim: 1 }, { dir: [1, 0], speed: 0, windV: [0, 0] });
  const v = (name) => b.calls.filter((x) => x[1] === name).map((x) => x.slice(2));
  assert.deepEqual(v('uLane'), [[0]]);
  assert.deepEqual([...v('uAmb')[0][0]], [0.5, 0.5, 0.5]);
  assert.deepEqual([...v('uSunShadowParams')[0][0]], [0, 0, 0, 0], 'no map: the block answers full sun');
  assert.deepEqual([...v('uCloudShadowRect')[0][0]], [0, 0, 0, 0], 'no deck');
  assert.deepEqual([...v('uIndirect')[0][0]], [0, 0, 0, 0], 'no player\'s light');
  const units = new Map();
  for (const x of b.calls) if (x[0] === 'uniform1i' && /^u(?:GField|PxSheet|Adapt|CloudShadowMap|SunShadow|PointShadow|PointShadowLo)$/.test(x[1])) units.set(x[1], x[2]);
  assert.deepEqual(Object.fromEntries(units), { uGField: 3, uPxSheet: 4, uAdapt: GRASS_ADAPT_UNIT, uCloudShadowMap: GRASS_CLOUD_UNIT, uSunShadow: SHADOW_SUN_UNIT, uPointShadow: SHADOW_POINT_UNIT, uPointShadowLo: SHADOW_LO_UNIT });
  assert.equal(new Set(units.values()).size, units.size, 'every sampler on a unit of its own - two types on one unit is an invalid draw');
});

test('GRASS-LIT: the AO\'s depth is taken before the grass - one blit, the frame\'s framebuffer back, read by the AO and its blur and dropped after', () => {
  const { gl, calls } = recordingGl();
  const F = { fbo: 'frameFbo', depth: 'frameDepth', w: 640, h: 360 };
  const air = { gl, frame: F, f: {}, fresh: true };
  assert.equal(AirPass.prototype.snapshotAoDepth.call(air), true);
  const blit = calls.find((c) => c[0] === 'blitFramebuffer');
  assert.deepEqual(blit.slice(1), [0, 0, 640, 360, 0, 0, 640, 360, 'DEPTH_BUFFER_BIT', 'NEAREST']);
  assert.ok(calls.some((c) => c[0] === 'texStorage2D' && c[3] === 'DEPTH_COMPONENT24'), 'the frame\'s own format, so the blit is legal');
  assert.deepEqual(calls.filter((c) => c[0] === 'bindFramebuffer').at(-1), ['bindFramebuffer', 'FRAMEBUFFER', 'frameFbo'], 'the frame\'s framebuffer bound again for what draws next');
  assert.equal(F.aoTaken, true);
  const made = calls.filter((c) => c[0] === 'texStorage2D').length;
  AirPass.prototype.snapshotAoDepth.call(air);
  assert.equal(calls.filter((c) => c[0] === 'texStorage2D').length, made, 'the copy is made once a frame image and reused');
  // no world frame prepared, or no frame at all: nothing
  const none = recordingGl();
  assert.equal(AirPass.prototype.snapshotAoDepth.call({ gl: none.gl, frame: F, f: null, fresh: true }), false);
  assert.equal(AirPass.prototype.snapshotAoDepth.call({ gl: none.gl, frame: null, f: {}, fresh: true }), false);
  assert.equal(none.calls.length, 0);
  assert.equal(Renderer.prototype.snapshotAoDepth.call({ _air: null, _frameFbo: 'x' }), false, 'no air pass, no copy');
  // the AO and its blur read the copy; nothing else does; the next frame starts without one
  const air2 = src('render/airPass.js');
  const images = air2.slice(air2.indexOf('  _images() {'), air2.indexOf('    this._volumetrics(f, sp, quad, depthOn);'));
  assert.ok(images.includes('const aoDepth = F.aoTaken && F.aoDepth ? F.aoDepth : F.depth;') && images.includes('F.aoTaken = false;'));
  assert.ok(images.includes('depthOn(this.programs.ao, aoDepth);') && images.includes('depthOn(this.programs.box, aoDepth);'));
  assert.equal((images.match(/aoDepth\)/g) ?? []).length, 2, 'the AO and its blur, and nothing else');
  assert.ok(air2.includes('if (k.aoDepth) { gl.deleteTexture(k.aoDepth); gl.deleteFramebuffer(k.aoFbo); }'), 'freed with its frame');
  // the host takes it immediately before the grass draws
  const w = src('scenes/world.js');
  assert.ok(/renderer\.snapshotAoDepth\(\);[^\n]*\n\s+labGrass\.draw\(/.test(w));
});
