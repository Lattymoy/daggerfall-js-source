// EL2 - ENHANCED LIGHTING, TIER TWO: SHADOWS (2026-09-17, Mac: "enhance our
// lighting system tenfold" - tiers 1, 2 and 3).
//
// render/shadowPass.js records what the world pass draws and replays it
// depth-only from the light at the top of the next frame: a two-cascade
// sun map outdoors, a cube map from the nearest lantern indoors. The lane's
// shaders read the maps through SHADOW_GLSL. The matrices, the cube depth
// reference, the caster pick and the frame's kind are pure and pinned
// here; the record-and-replay is pinned on the fake GL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHADOW_SUN_SIZE, SHADOW_POINT_SIZE, SHADOW_CASCADES, SHADOW_SUN_DEPTH, SHADOW_MIN_SUN_Y, SHADOW_POINT_NEAR,
  SHADOW_SUN_UNIT, SHADOW_POINT_UNIT, SHADOW_RECORD_MAX, SHADOW_POINT_CASTERS,
  sunCascadeMatrices, sunTexelWorld, pointFaceMatrices, cubeDepthRef, pickShadowCaster, shadowKind,
  SHADOW_GLSL, DEPTH_FS, DEPTH_BB_FS, ShadowPass, shadowFarFor } from '../src/render/shadowPass.js';
import { EL_LANE, EL_MESH_FS, EL_BB_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_FAR_RING_FS } from '../src/render/enhancedLighting.js';
import { Renderer, CLOUD_SHADOW_UNIT, WORLD_FRAME } from '../src/render/renderer.js';
import { transformPoint } from '../src/world/mat4.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A point through a projection, with the perspective divide (transformPoint has none). */
const project = (m, x, y, z) => { const p = transformPoint(m, x, y, z); const w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [p[0] / w, p[1] / w, p[2] / w]; };

/** A recording fake GL (el1's, with the framebuffer calls the pass makes). */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE_CUBE_MAP_POSITIVE_X: 100, TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Float32Array.from(a) : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
const count = (calls, name) => calls.filter((c) => c[0] === name).length;

/** A lit frame on the lane: one mesh, one terrain surface, one billboard batch. */
function drawWorld(r) {
  r.textures.set('1_1', { id: 't11' }); r.textures.set('210_1', { id: 't2101' });
  const mesh = { vao: { id: 'vao-m' }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }, { textureArchive: 1, textureRecord: 1, startIndex: 6, primitiveCount: 2 }] };
  const surface = { vao: { id: 'vao-t' }, indexCount: 6 };
  const batch = { archive: 210, record: 1, vao: { id: 'vao-b' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [1, 0, 1] };
  r.drawMesh(mesh, I, null);
  r.drawTerrain(surface, I, {}, {}, 6.4);
  r.drawBillboards([batch], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  return { mesh, surface, batch };
}

test('EL2: the constants - three cascades (EL7), the sizes, the reserved units above every foreign pass and beside the cloud shadow', () => {
  assert.deepEqual([...SHADOW_CASCADES], [12, 48, 240], 'EL7: the room, the street, the town');
  assert.equal(SHADOW_SUN_SIZE, 2048); assert.equal(SHADOW_POINT_SIZE, 512); assert.equal(SHADOW_SUN_DEPTH, 600);
  assert.equal(SHADOW_MIN_SUN_Y, 0.05); assert.equal(SHADOW_POINT_NEAR, 0.1);   // LIGHT-NEAR1: no caster minimum distance any more - the hand's light is excluded by name
  assert.equal(SHADOW_SUN_UNIT, 13); assert.equal(SHADOW_POINT_UNIT, 14); assert.equal(CLOUD_SHADOW_UNIT, 15);
  assert.equal(SHADOW_RECORD_MAX, 6000);
  assert.ok(near(sunTexelWorld(0), 24 / 2048) && near(sunTexelWorld(1), 96 / 2048) && near(sunTexelWorld(2), 480 / 2048), 'EL7: 1.2 cm, 4.7 cm, 23 cm');
});

test('EL2: the sun cascades - the eye at the centre, the radius at the edge, the depth along the light, and the texel snap that holds a world point still', () => {
  const eye = [100.3, 20.7, -50.1];
  const L = [0.3, 0.8, 0.2]; const l = Math.hypot(...L); const ld = L.map((v) => v / l);
  const out = [new Float32Array(16), new Float32Array(16)];
  sunCascadeMatrices(eye, ld, out);
  for (let c = 0; c < 2; c++) {
    const r = SHADOW_CASCADES[c];
    const texelNdc = 2 / SHADOW_SUN_SIZE;
    const p = transformPoint(out[c], eye[0], eye[1], eye[2]);
    assert.ok(Math.abs(p[0]) <= texelNdc && Math.abs(p[1]) <= texelNdc, `cascade ${c}: the eye within a texel of the centre`);
    assert.ok(near(p[2], 0, 1e-4), 'the eye at the box\'s mid-depth (NDC 0)');
    // a point r units along the light's right axis lands on the edge
    const right = [ld[2], 0, -ld[0]]; const rl = Math.hypot(...right); right.forEach((v, i) => { right[i] = v / rl; });
    const q = transformPoint(out[c], eye[0] + right[0] * r, eye[1], eye[2] + right[2] * r);
    assert.ok(Math.abs(Math.abs(q[0]) - 1) <= texelNdc, `cascade ${c}: the radius is the edge: ${q[0]}`);
    // a point toward the light by the half-depth is at the near plane
    const n = transformPoint(out[c], eye[0] + ld[0] * SHADOW_SUN_DEPTH, eye[1] + ld[1] * SHADOW_SUN_DEPTH, eye[2] + ld[2] * SHADOW_SUN_DEPTH);
    assert.ok(near(n[2], -1, 1e-4), 'the light-side half-depth is the near plane');
    // the snap: the world origin's texel coordinate is integral
    const o = transformPoint(out[c], 0, 0, 0);
    const tx = o[0] * SHADOW_SUN_SIZE / 2, ty = o[1] * SHADOW_SUN_SIZE / 2;
    assert.ok(near(tx, Math.round(tx), 1e-3) && near(ty, Math.round(ty), 1e-3), `cascade ${c}: the origin on the texel grid (${tx}, ${ty})`);
  }
  // ...and moving the eye a fraction of a texel moves nothing on the grid
  const moved = [new Float32Array(16), new Float32Array(16)];
  sunCascadeMatrices([eye[0] + 0.011, eye[1], eye[2] - 0.007], ld, moved);
  const a = transformPoint(out[0], 12.5, 3, -7), b = transformPoint(moved[0], 12.5, 3, -7);
  const ta = a[0] * SHADOW_SUN_SIZE / 2 - b[0] * SHADOW_SUN_SIZE / 2;
  assert.ok(near(ta, Math.round(ta), 1e-3), 'a world point moves by a whole number of texels or not at all');
  // a vertical sun takes the Z up, and still builds
  const v = [new Float32Array(16), new Float32Array(16)];
  sunCascadeMatrices(eye, [0, 1, 0], v);
  assert.ok(Number.isFinite(v[0][0]) && v[0][0] !== 0);
});

test('EL2: the cube faces - a point on each axis lands on its face at the centre, and the shader\'s depth reference IS the depth the face wrote', () => {
  const pos = [3, 4, 5], far = 20;
  const faces = [0, 1, 2, 3, 4, 5].map(() => new Float32Array(16));
  pointFaceMatrices(pos, far, faces);
  const axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let f = 0; f < 6; f++) {
    for (const dist of [0.5, 2, 7.5, 19]) {
      const w = [pos[0] + axes[f][0] * dist, pos[1] + axes[f][1] * dist, pos[2] + axes[f][2] * dist];
      const p = project(faces[f], w[0], w[1], w[2]);
      assert.ok(near(p[0], 0, 1e-5) && near(p[1], 0, 1e-5), `face ${f}: the axis point at the centre`);
      const ref = cubeDepthRef(axes[f][0] * dist, axes[f][1] * dist, axes[f][2] * dist, far);
      assert.ok(near(p[2] * 0.5 + 0.5, ref, 1e-6), `face ${f} at ${dist}: the reference ${ref} is the face's depth ${p[2] * 0.5 + 0.5}`);
    }
    // an off-axis point on the same face: its major axis is the depth the face holds
    const w = [pos[0] + axes[f][0] * 6 + axes[(f + 2) % 6][0] * 2, pos[1] + axes[f][1] * 6 + axes[(f + 2) % 6][1] * 2, pos[2] + axes[f][2] * 6 + axes[(f + 2) % 6][2] * 2];
    const p = project(faces[f], w[0], w[1], w[2]);
    const ref = cubeDepthRef(w[0] - pos[0], w[1] - pos[1], w[2] - pos[2], far);
    assert.ok(near(p[2] * 0.5 + 0.5, ref, 1e-6), `face ${f} off axis`);
    assert.ok(Math.abs(p[0]) < 1 && Math.abs(p[1]) < 1, 'inside the face');
  }
  // THE FACE ORIENTATIONS are the cube map's own (the renderman table GL
  // samples by: +X reads s = -z, t = -y; -X s = z, t = -y; +Y s = x, t = z;
  // -Y s = x, t = -z; +Z s = x, t = -y; -Z s = -x, t = -y), which is what
  // the up vectors exist for - a flipped face is a shadow on the wrong wall
  const side = (f, o) => project(faces[f], pos[0] + axes[f][0] * 5 + o[0] * 2, pos[1] + axes[f][1] * 5 + o[1] * 2, pos[2] + axes[f][2] * 5 + o[2] * 2);
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  assert.ok(side(0, Z)[0] < 0 && side(0, Y)[1] < 0, '+X: +z left, +y down');
  assert.ok(side(1, Z)[0] > 0 && side(1, Y)[1] < 0, '-X: +z right, +y down');
  assert.ok(side(2, X)[0] > 0 && side(2, Z)[1] > 0, '+Y: +x right, +z up');
  assert.ok(side(3, X)[0] > 0 && side(3, Z)[1] < 0, '-Y: +x right, +z down');
  assert.ok(side(4, X)[0] > 0 && side(4, Y)[1] < 0, '+Z: +x right, +y down');
  assert.ok(side(5, X)[0] < 0 && side(5, Y)[1] < 0, '-Z: +x left, +y down');
  // the reference: 0 at the near plane, 1 at the far plane, monotone between
  assert.ok(near(cubeDepthRef(SHADOW_POINT_NEAR, 0, 0, far), 0, 1e-9));
  assert.ok(near(cubeDepthRef(0, far, 0, far), 1, 1e-9));
  let last = -1;
  for (let d = 0.1; d <= 20; d += 0.1) { const v = cubeDepthRef(d, 0, 0, far); assert.ok(v >= last); last = v; }
  assert.ok(near(cubeDepthRef(0.01, 0, 0, far), 0, 1e-9), 'inside the near plane clamps to it');
});

test('EL2: the caster and the kind - the nearest lantern that is not the eye\'s own (by its flag: LIGHT-NEAR1), and a sun with height or the cube', () => {
  const eye = [0, 1.5, 0];
  const lights = new Float32Array([
    0, 1.5, 0.1, 10,     // the candle at the eye - carried, never the caster
    8, 2, 0, 12,         // a wall torch
    3, 2, 0, 0,          // a light with no range - never
    -4, 2, 0, 9,         // the nearest with a range
  ]);
  const carried = new Uint8Array([1, 0, 0, 0]);
  assert.equal(pickShadowCaster(lights, eye, carried), 3);
  assert.equal(pickShadowCaster(lights, eye), 0, 'LIGHT-NEAR1: unflagged, a light at the eye is a light like any other - the nearest caster');
  assert.equal(pickShadowCaster(new Float32Array(0), eye), -1);
  assert.equal(pickShadowCaster(new Float32Array([0, 1.5, 0, 10]), eye, new Uint8Array([1])), -1, 'the eye\'s own alone is none');
  assert.equal(shadowKind(0.55, [0.3, 0.8, 0.2]), 'sun');
  assert.equal(shadowKind(0.55, [0.9, 0.04, 0.2]), 'point', 'a sun at the horizon is no sun');
  assert.equal(shadowKind(0, [0.45, 0.8, 0.35]), 'point', 'indoors: the interior\'s fake key light has scale 0');
  assert.equal(shadowKind(0.55, null), 'point');
});

test('EL2: the receiver block and the depth shaders - six uniforms, no dynamic mat4 index, PCF, the cutout; the five lane shaders carry the block and shadow the sun term', () => {
  for (const u of ['uniform sampler2DArrayShadow uSunShadow;', 'uniform mat4 uSunVP[3];', 'uniform vec4 uSunShadowParams;', 'uniform vec4 uSunTexel;', 'uniform sampler2DArrayShadow uPointShadow;', `uniform vec4 uPointShadowParams[${SHADOW_POINT_CASTERS}];`, `uniform int uShadowIndex[${SHADOW_POINT_CASTERS}];`]) {   // EL5: the casters' layers in one array, a vec4 and an index per caster
    assert.ok(SHADOW_GLSL.includes(u), u);
  }
  assert.match(SHADOW_GLSL, /precision highp sampler2DArrayShadow;/, 'the shadow sampler has no default precision in ES 3.00');
  assert.ok(!SHADOW_GLSL.includes('samplerCubeShadow'), 'EL5: no cube sampler - the faces are layers, selected by hand');
  assert.match(SHADOW_GLSL, /float pointShadowAt\(int k, vec3 wp, vec3 n\)/); assert.match(SHADOW_GLSL, /float layer = float\(k \* 6 \+ face\);/);
  assert.match(SHADOW_GLSL, /float shadowOfLight\(int i, vec4 L, vec3 wp, vec3 n\) \{\n  int k = uCasterOf\[i\];\n  return k >= 0 \? casterShadowAt\(k, L, wp, n\) : 1\.0;/, 'EL8: the caster by the table, one lookup (DISC15: either tier)');
  assert.match(SHADOW_GLSL, /uniform int uCasterOf\[48\];/);
  assert.match(SHADOW_GLSL, /mat4 vp = c == 0 \? uSunVP\[0\] : c == 1 \? uSunVP\[1\] : uSunVP\[2\];/, 'no dynamic index into the uniform array (EL7: three)');
  assert.match(SHADOW_GLSL, /int c = d < uSunShadowParams\.x \* 0\.9 \? 0 : d < uSunShadowParams\.y \* 0\.9 \? 1 : 2;/, 'the cascade by view distance');
  assert.match(SHADOW_GLSL, /for \(int y = -1; y <= 1; y\+\+\)/, 'a 3x3 PCF');
  assert.match(SHADOW_GLSL, /float near = 0\.1;/, 'the cube near plane, the constant');
  assert.match(SHADOW_GLSL, /if \(uSunShadowParams\.w <= 0\.0\) return 1\.0;/); assert.match(SHADOW_GLSL, /if \(far <= 0\.0\) return 1\.0;/);
  assert.equal(DEPTH_FS, '#version 300 es\nprecision highp float;\nvoid main() {}');
  assert.match(DEPTH_BB_FS, /if \(texture\(uTex, vUV\)\.a < 0\.5\) discard;/);
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS]]) {
    assert.ok(fs.includes(SHADOW_GLSL), `${name} carries the block`);
    assert.match(fs, /cloudShadowAt\(vWorldPos\) \* sunShadowAt\(vWorldPos, n\)/, `${name}: the sun term wears both shadows`);
    assert.match(fs, /if \(d >= uPointLights\[i\]\.w\) continue;[^\n]*\n    vec3 Ln = L \/ max\(d, 1e-4\);\n    int k = uCasterOf\[i\];[^\n]*\n(?:    \/\/[^\n]*\n)*    float sh = k >= 0 \? casterShadowAt\(k, uPointLights\[i\], wp, n\)[^\n]*\n      : \(k == -2 \|\| d > uPointLights\[i\]\.w \* 0\.7\) \? 1\.0[^\n]*\n      : contactShadow\(wp, n, Ln, d\);/, `${name}: EL5 - out of the window nothing is computed; EL8: a caster's map by the table (DISC15: of either tier), else a contact shadow`);
  }
  assert.ok(EL_BB_FS.includes(SHADOW_GLSL));
  assert.match(EL_BB_FS, /in vec3 vBBBase;/);
  assert.match(EL_BB_FS, /vec3 base = vBBBase \+ vec3\(0\.0, 0\.5, 0\.0\);/, 'a flat reads its shadow half a unit up its base');
  // TREES1 (2026-09-19): a flat reads the SOFT lookup - the kernel at
  // every distance - because it samples once for a whole sprite and the
  // far cascade's one-tap trade is an antialiasing one that only holds
  // for a surface shading per fragment. EL2's own law here is unchanged:
  // the flat's sun term still wears both shadows, read at its base.
  assert.match(EL_BB_FS, /uBBSun \* cloudShadowAt\(vBBWorld\) \* sunShadowSoftAt\(base, vec3\(0\.0, 1\.0, 0\.0\)\)/);
  assert.match(EL_BB_FS, /elPointFlat\(vBBWorld, base\)/);
  assert.ok(!EL_FAR_RING_FS.includes('uSunShadow'), 'the far ring receives no shadow');
  assert.equal(EL_LANE.shadows, true);
  const r = read('src/render/renderer.js');
  assert.match(r, /out vec3 vBBBase;/); assert.match(r, /vBBBase = aCenter \+ uOrigin;/);
  assert.ok(!/uSunShadow/.test(r.slice(0, r.indexOf('export class Renderer'))), 'no classic shader receives a shadow');
});

test('EL2: the renderer builds the pass with the lane, records the three draw kinds outside a panel, and draws the maps at the top of the next frame under the frame\'s kind', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  assert.equal(r.shadows, null);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  assert.ok(sp instanceof ShadowPass);
  assert.equal(SHADOW_POINT_CASTERS, 8, 'HQ1: eight casters (AUDIT LIGHTING: the number itself, since every count below derives from it)');
  assert.equal(count(calls, 'framebufferTextureLayer'), 3 + 6 * SHADOW_POINT_CASTERS, 'three cascade framebuffers (EL7), then six layers per caster (EL5; EL6: six casters); AUDIT SC1: the static cache\'s six per caster wait for the first frame that wants them (audit_lighting)');
  assert.equal(calls.filter((c) => c[0] === 'framebufferTexture2D' && c[3] >= 100 && c[3] < 106).length, 0, 'EL5: no cube faces - the faces are layers');
  assert.equal(calls.filter((c) => c[0] === 'texStorage3D').length, 3, 'the sun array, the casters\' array and DISC15\'s one-texel lo stand-in (AUDIT SC1: the cache\'s, the casters\' shape again, on the first frame with a caster; DISC15: the lo tier\'s own, on the first room that asks)'); assert.equal(calls.filter((c) => c[0] === 'texStorage2D').length, 0);
  assert.ok(calls.some((c) => c[0] === 'texStorage3D' && c[4] === 512 && c[5] === 512 && c[6] === 6 * SHADOW_POINT_CASTERS), 'the casters\' six 512^2 layers each (HQ1: eight casters)');
  assert.ok(calls.some((c) => c[0] === 'texParameteri' && c[2] === 1 && c[3] === 1), 'compare mode set');
  // the kept pass across swaps
  r.setLightingLane(null); assert.equal(r.shadows, null);
  r.setLightingLane(EL_LANE); assert.equal(r.shadows, sp, 'the same pass again');
  // frame 1 outdoors: the sun
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  const sun = new Float32Array([0.3, 0.8, 0.2]);
  r.beginFrame(I, I, sun, WORLD_FRAME);
  assert.equal(sp.count, 0, 'nothing recorded yet');
  const { mesh } = drawWorld(r);
  assert.equal(sp.count, 3, 'a mesh, a terrain, a billboard call');
  assert.equal(sp.records[0].mesh, mesh); assert.notEqual(sp.records[0].matrix, I, 'the matrix is COPIED'); assert.deepEqual([...sp.records[0].matrix], [...I]);
  // frame 2: the maps are drawn from frame 1's records, before the clear
  calls.length = 0;
  r.beginFrame(I, I, sun, WORLD_FRAME);
  const firstClear = calls.findIndex((c) => c[0] === 'clear' && c[1] === 16384 + 256);
  const depthClears = calls.filter((c, i) => c[0] === 'clear' && c[1] === 256 && i < firstClear);
  assert.equal(depthClears.length, 3, 'three cascades cleared before the frame\'s own clear (EL7)');
  assert.equal(sp.kind, 'sun'); assert.equal(sp.stats.records, 3); assert.equal(sp.stats.sunDraws, 3 * (2 + 1 + 1), 'two sub-meshes, the terrain, the flat - per cascade');
  assert.equal(sp.count, 0, 'the records are spent'); assert.equal(sp.records[0].mesh, null, 'and released');
  assert.equal(sp.sunParams[3], 1); assert.deepEqual([...sp.shadowIndex], new Array(SHADOW_POINT_CASTERS).fill(-1)); assert.ok([...sp.pointParams].every((v) => v === 0)); assert.equal(sp.casters, 0, 'no lantern: no caster, sun or not');
  assert.ok(calls.some((c) => c[0] === 'colorMask' && c[1] === false), 'depth only'); assert.ok(calls.some((c) => c[0] === 'disable' && c[1] === 1), 'no culling under the light\'s projection');
  const bindNull = calls.findIndex((c) => c[0] === 'bindFramebuffer' && c[2] === null);
  assert.ok(bindNull > 0 && bindNull < firstClear, 'the canvas is back before the frame clears');
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uSunShadowParams' && c[2][3] === 1), 'the receiver hears the sun map is on');
  assert.ok(calls.some((c) => c[0] === 'uniformMatrix4fv' && c[1] === 'uSunVP' && c[3].length === 48), 'all three cascades in one upload');
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uSunTexel' && c[2][0] > 0 && c[2][2] > c[2][0]), 'EL7: the texel sizes, the town\'s the coarsest');
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uSunShadow' && c[2] === 13) && calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uPointShadow' && c[2] === 14));
  // frame 3 indoors: the cube from the nearest lantern that is not the eye's
  drawWorld(r);
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0);
  const lit = new Float32Array([0, 0, 0, 10, 6, 2, 1, 14]);
  lit.carried = new Uint8Array([1, 0]);   // LIGHT-NEAR1: the eye's own light is the eye's own BY ITS FLAG (withPlayerLights' mask, lifted by setPointLights) - not by sitting at the origin
  r.setPointLights(lit, new Float32Array([1, 1, 1]));
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
  assert.equal(sp.kind, 'point'); assert.deepEqual([...sp.shadowIndex], [1, ...new Array(SHADOW_POINT_CASTERS - 1).fill(-1)], 'the eye\'s own light (carried) is skipped');
  // PERF-FLICKER (2026-09-19): the w is the CUBE MAP's far plane, not the
  // lantern's live range - the light's range is animated (CityLightAnimator
  // wanders it inside a one-unit band, fourteen steps a second) and the
  // shadow pass compared that number to decide whether a slot had changed,
  // so every caster rebuilt all six faces every frame and EL8's schedule
  // was dead. It is rounded UP to SHADOW_FAR_QUANTUM, which the matrices,
  // the change test and this array all take - the map and the shader must
  // agree, because the fragment stage reconstructs depth from P.w - and
  // rounding UP means the far plane is never inside the lantern's reach,
  // so no shadow is clipped short. 14 -> 16.
  assert.deepEqual([...sp.pointParams], [6, 2, 1, shadowFarFor(14), ...new Array(4 * SHADOW_POINT_CASTERS - 4).fill(0)]); assert.equal(sp.casters, 1);
  assert.equal(shadowFarFor(14), 16, 'the quantum, by name and by value');
  assert.equal(sp.stats.pointDraws, 6 * 3, 'six faces of the two sub-meshes and the terrain (the fake bundles carry no bounds: nothing is culled); EL6: the flat is a light flat (archive 210) and never casts from a lantern');
  assert.equal(calls.filter((c) => c[0] === 'clear' && c[1] === 256).length, 6);
  assert.ok(calls.some((c) => c[0] === 'uniform1iv' && c[1] === 'uShadowIndex' && c[2][0] === 1 && c[2].length === SHADOW_POINT_CASTERS), 'EL5: the indices go up as one int array');
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uSunShadowParams' && c[2][3] === 0), 'and the sun map is off');
  // frame 4: a destroyed mesh in last frame's records is skipped, a spectral flat and a concealed one cast nothing
  const w = drawWorld(r);
  r.destroyMesh(w.mesh);
  assert.equal(w.mesh._dead, true);
  r.textures.set('201_1', { id: 't2011' });
  r.drawBillboards([{ archive: 201, record: 1, vao: {}, indexCount: 6, size: { w: 1, h: 1 }, conceal: { x: 2 } }], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  r.beginFrame(I, I, new Float32Array([0.45, 0.8, 0.35]), WORLD_FRAME);
  assert.equal(sp.stats.pointDraws, 6 * 1, 'the terrain alone (the flat is the lantern\'s own kind; the concealed one, of another archive, casts nothing)');
  // a panel frame records nothing and drops what it inherited
  drawWorld(r);
  assert.equal(sp.count, 3);
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => {
    assert.equal(sp.count, 3, 'AUDIT-EL F8: KEPT through the panel\'s beginFrame - they are the world\'s next frame\'s casters');
    drawWorld(r);
    assert.equal(sp.count, 3, 'a panel draw is not a caster');
  });
  // the classic set records nothing at all
  r.setLightingLane(null);
  drawWorld(r);
  assert.equal(sp.count, 0);
});

test('EL2: the record pool is bounded and reused', () => {
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  const mesh = { vao: {}, subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }] };
  r.textures.set('1_1', {});
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  for (let i = 0; i < SHADOW_RECORD_MAX + 50; i++) r.drawMesh(mesh, I, null);
  assert.equal(sp.count, SHADOW_RECORD_MAX, 'truncated at the ceiling');
  assert.equal(sp.records.length, SHADOW_RECORD_MAX, 'never past it');
  const first = sp.records[0];
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  r.drawMesh(mesh, I, null);
  assert.equal(sp.records[0], first, 'the same record object, reused');
});

test('EL2: the renderer\'s wiring - the three draw paths record behind one gate, the maps are drawn before the clear, the destroys mark, the far ring takes no map', () => {
  const r = read('src/render/renderer.js');
  assert.equal((r.match(/this\._casting\) this\._shadows\.record/g) || []).length, 3, 'mesh, terrain, billboards');
  assert.match(r, /if \(this\._casting && this\._spriteDepth === 0 && this\._studioDepth === 0\) this\._shadows\.recordCharacter\(mesh, modelMatrix\);/, 'EL7: the rigs, never from the sprite target or the studio');
  assert.match(r, /if \(!wire && this\._casting\) this\._shadows\.recordMesh\(mesh, modelMatrix, texRemap\);/, 'a wireframe draw (the automap) is not a caster');
  assert.match(r, /get _casting\(\) \{ return !!this\._shadows && !this\._panelSaved; \}/);
  const bf = r.slice(r.indexOf('beginFrame(proj, view, lightDir, opts = null) {'), r.indexOf('beginFrame(proj, view, lightDir, opts = null) {') + 3200);   // AUDIT-EL F5; LC1: the grid's build sits between the passes and the clear, so the window grew
  const passes = bf.indexOf('this._beginLane(proj, view, lightDir, opts?.world === true)');
  assert.ok(passes > 0 && passes < bf.indexOf('gl.clear('), 'the maps before the clear (EL3: with the air\'s images; AUDIT-EL F5: one call, for a WORLD frame)');
  assert.match(r, /if \(this\._shadows && world\) this\._renderPasses\(proj, view, lightDir\);/);
  assert.match(r, /const sp = this\._shadows;   \/\/ AUDIT-EL F8: a panel frame never reaches here/, 'a panel frame keeps the records');
  assert.match(r, /    sp\.discard\(\);\n    this\._restoreWorldViewport\(\);/, 'the records are dropped after both passes and the world viewport comes back');
  assert.equal((r.match(/_dead = true;   \/\/ EL2/g) || []).length, 3, 'destroyMesh, destroyBillboardBatch, destroyBatch');
  assert.match(r, /this\._shadows = this\._shadowPass \?\?= new ShadowPass\(this\.gl, \{ build: \(vs, fs\) => this\._buildProgram\(vs, fs\), vs: \{ mesh: VS, bb: BB_VS, terrain: TERRAIN_VS, char: CHAR_VS \} \}\);/);
  assert.match(r, /if \(this\._shadows\) this\._shadows\.upload\(this\._el\[key\]\.shadow\);/);
  const sp = read('src/render/shadowPass.js');
  assert.ok(!/from '\.\/renderer\.js'/.test(sp), 'the pass imports nothing of the renderer');
  assert.ok(!/from '\.\/enhancedLighting\.js'/.test(sp), 'nor of the lane');
});
