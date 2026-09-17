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
  SHADOW_CASTER_MIN_DISTANCE, SHADOW_SUN_UNIT, SHADOW_POINT_UNIT, SHADOW_RECORD_MAX,
  sunCascadeMatrices, sunTexelWorld, pointFaceMatrices, cubeDepthRef, pickShadowCaster, shadowKind,
  SHADOW_GLSL, DEPTH_FS, DEPTH_BB_FS, ShadowPass,
} from '../src/render/shadowPass.js';
import { EL_LANE, EL_MESH_FS, EL_BB_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_FAR_RING_FS } from '../src/render/enhancedLighting.js';
import { Renderer, CLOUD_SHADOW_UNIT } from '../src/render/renderer.js';
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

test('EL2: the constants - two cascades, the sizes, the reserved units above every foreign pass and beside the cloud shadow', () => {
  assert.deepEqual([...SHADOW_CASCADES], [40, 240]);
  assert.equal(SHADOW_SUN_SIZE, 2048); assert.equal(SHADOW_POINT_SIZE, 512); assert.equal(SHADOW_SUN_DEPTH, 600);
  assert.equal(SHADOW_MIN_SUN_Y, 0.05); assert.equal(SHADOW_POINT_NEAR, 0.1); assert.equal(SHADOW_CASTER_MIN_DISTANCE, 0.25);
  assert.equal(SHADOW_SUN_UNIT, 13); assert.equal(SHADOW_POINT_UNIT, 14); assert.equal(CLOUD_SHADOW_UNIT, 15);
  assert.equal(SHADOW_RECORD_MAX, 6000);
  assert.ok(near(sunTexelWorld(0), 80 / 2048) && near(sunTexelWorld(1), 480 / 2048));
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

test('EL2: the caster and the kind - the nearest lantern that is not the eye\'s own, and a sun with height or the cube', () => {
  const eye = [0, 1.5, 0];
  const lights = new Float32Array([
    0, 1.5, 0.1, 10,     // the candle at the eye - never the caster
    8, 2, 0, 12,         // a wall torch
    3, 2, 0, 0,          // a light with no range - never
    -4, 2, 0, 9,         // the nearest with a range
  ]);
  assert.equal(pickShadowCaster(lights, eye), 3);
  assert.equal(pickShadowCaster(lights, eye, 5), 1, 'a wider exclusion picks the torch');
  assert.equal(pickShadowCaster(new Float32Array(0), eye), -1);
  assert.equal(pickShadowCaster(new Float32Array([0, 1.5, 0, 10]), eye), -1, 'the eye\'s own alone is none');
  assert.equal(shadowKind(0.55, [0.3, 0.8, 0.2]), 'sun');
  assert.equal(shadowKind(0.55, [0.9, 0.04, 0.2]), 'point', 'a sun at the horizon is no sun');
  assert.equal(shadowKind(0, [0.45, 0.8, 0.35]), 'point', 'indoors: the interior\'s fake key light has scale 0');
  assert.equal(shadowKind(0.55, null), 'point');
});

test('EL2: the receiver block and the depth shaders - six uniforms, no dynamic mat4 index, PCF, the cutout; the five lane shaders carry the block and shadow the sun term', () => {
  for (const u of ['uniform sampler2DArrayShadow uSunShadow;', 'uniform mat4 uSunVP[2];', 'uniform vec4 uSunShadowParams;', 'uniform samplerCubeShadow uPointShadow;', 'uniform vec4 uPointShadowParams;', 'uniform int uShadowIndex;']) {
    assert.ok(SHADOW_GLSL.includes(u), u);
  }
  assert.match(SHADOW_GLSL, /precision highp sampler2DArrayShadow;\nprecision highp samplerCubeShadow;/, 'the shadow samplers have no default precision in ES 3.00');
  assert.match(SHADOW_GLSL, /mat4 vp = c == 0 \? uSunVP\[0\] : uSunVP\[1\];/, 'no dynamic index into the uniform array');
  assert.match(SHADOW_GLSL, /for \(int y = -1; y <= 1; y\+\+\)/, 'a 3x3 PCF');
  assert.match(SHADOW_GLSL, /float near = 0\.1;/, 'the cube near plane, the constant');
  assert.match(SHADOW_GLSL, /if \(uSunShadowParams\.w <= 0\.0\) return 1\.0;/); assert.match(SHADOW_GLSL, /if \(far <= 0\.0\) return 1\.0;/);
  assert.equal(DEPTH_FS, '#version 300 es\nprecision highp float;\nvoid main() {}');
  assert.match(DEPTH_BB_FS, /if \(texture\(uTex, vUV\)\.a < 0\.5\) discard;/);
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS]]) {
    assert.ok(fs.includes(SHADOW_GLSL), `${name} carries the block`);
    assert.match(fs, /cloudShadowAt\(vWorldPos\) \* sunShadowAt\(vWorldPos, n\)/, `${name}: the sun term wears both shadows`);
    assert.match(fs, /i == uShadowIndex \? pointShadowAt\(wp, n\) : 1\.0/, `${name}: the one lantern`);
  }
  assert.ok(EL_BB_FS.includes(SHADOW_GLSL));
  assert.match(EL_BB_FS, /in vec3 vBBBase;/);
  assert.match(EL_BB_FS, /vec3 base = vBBBase \+ vec3\(0\.0, 0\.5, 0\.0\);/, 'a flat reads its shadow half a unit up its base');
  assert.match(EL_BB_FS, /uBBSun \* cloudShadowAt\(vBBWorld\) \* sunShadowAt\(base, vec3\(0\.0, 1\.0, 0\.0\)\)/);
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
  assert.equal(count(calls, 'framebufferTextureLayer'), 2, 'two cascade framebuffers');
  assert.equal(calls.filter((c) => c[0] === 'framebufferTexture2D' && c[3] >= 100 && c[3] < 106).length, 6, 'six cube faces');
  assert.equal(calls.filter((c) => c[0] === 'texStorage3D').length, 1); assert.equal(calls.filter((c) => c[0] === 'texStorage2D').length, 1);
  assert.ok(calls.some((c) => c[0] === 'texParameteri' && c[2] === 1 && c[3] === 1), 'compare mode set');
  // the kept pass across swaps
  r.setLightingLane(null); assert.equal(r.shadows, null);
  r.setLightingLane(EL_LANE); assert.equal(r.shadows, sp, 'the same pass again');
  // frame 1 outdoors: the sun
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  const sun = new Float32Array([0.3, 0.8, 0.2]);
  r.beginFrame(I, I, sun);
  assert.equal(sp.count, 0, 'nothing recorded yet');
  const { mesh } = drawWorld(r);
  assert.equal(sp.count, 3, 'a mesh, a terrain, a billboard call');
  assert.equal(sp.records[0].mesh, mesh); assert.notEqual(sp.records[0].matrix, I, 'the matrix is COPIED'); assert.deepEqual([...sp.records[0].matrix], [...I]);
  // frame 2: the maps are drawn from frame 1's records, before the clear
  calls.length = 0;
  r.beginFrame(I, I, sun);
  const firstClear = calls.findIndex((c) => c[0] === 'clear' && c[1] === 16384 + 256);
  const depthClears = calls.filter((c, i) => c[0] === 'clear' && c[1] === 256 && i < firstClear);
  assert.equal(depthClears.length, 2, 'two cascades cleared before the frame\'s own clear');
  assert.equal(sp.kind, 'sun'); assert.equal(sp.stats.records, 3); assert.equal(sp.stats.sunDraws, 2 * (2 + 1 + 1), 'two sub-meshes, the terrain, the flat - per cascade');
  assert.equal(sp.count, 0, 'the records are spent'); assert.equal(sp.records[0].mesh, null, 'and released');
  assert.equal(sp.sunParams[3], 1); assert.equal(sp.shadowIndex, -1); assert.equal(sp.pointParams[3], 0);
  assert.ok(calls.some((c) => c[0] === 'colorMask' && c[1] === false), 'depth only'); assert.ok(calls.some((c) => c[0] === 'disable' && c[1] === 1), 'no culling under the light\'s projection');
  const bindNull = calls.findIndex((c) => c[0] === 'bindFramebuffer' && c[2] === null);
  assert.ok(bindNull > 0 && bindNull < firstClear, 'the canvas is back before the frame clears');
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uSunShadowParams' && c[2][3] === 1), 'the receiver hears the sun map is on');
  assert.ok(calls.some((c) => c[0] === 'uniformMatrix4fv' && c[1] === 'uSunVP' && c[3].length === 32), 'both cascades in one upload');
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uSunShadow' && c[2] === 13) && calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uPointShadow' && c[2] === 14));
  // frame 3 indoors: the cube from the nearest lantern that is not the eye's
  drawWorld(r);
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0);
  r.setPointLights(new Float32Array([0, 0, 0, 10, 6, 2, 1, 14]), new Float32Array([1, 1, 1]));
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0.45, 0.8, 0.35]));
  assert.equal(sp.kind, 'point'); assert.equal(sp.shadowIndex, 1, 'the eye\'s own light (at the origin, where the identity view puts the eye) is skipped');
  assert.deepEqual([...sp.pointParams], [6, 2, 1, 14]);
  assert.equal(sp.stats.pointDraws, 6 * 4, 'six faces');
  assert.equal(calls.filter((c) => c[0] === 'clear' && c[1] === 256).length, 6);
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uShadowIndex' && c[2] === 1));
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uSunShadowParams' && c[2][3] === 0), 'and the sun map is off');
  // frame 4: a destroyed mesh in last frame's records is skipped, a spectral flat and a concealed one cast nothing
  const w = drawWorld(r);
  r.destroyMesh(w.mesh);
  assert.equal(w.mesh._dead, true);
  r.drawBillboards([{ archive: 210, record: 1, vao: {}, indexCount: 6, size: { w: 1, h: 1 }, conceal: { x: 2 } }], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  r.beginFrame(I, I, new Float32Array([0.45, 0.8, 0.35]));
  assert.equal(sp.stats.pointDraws, 6 * 2, 'the terrain and the flat alone');
  // a panel frame records nothing and drops what it inherited
  drawWorld(r);
  assert.equal(sp.count, 3);
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => {
    assert.equal(sp.count, 0, 'dropped at the panel\'s beginFrame');
    drawWorld(r);
    assert.equal(sp.count, 0, 'a panel draw is not a caster');
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
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  for (let i = 0; i < SHADOW_RECORD_MAX + 50; i++) r.drawMesh(mesh, I, null);
  assert.equal(sp.count, SHADOW_RECORD_MAX, 'truncated at the ceiling');
  assert.equal(sp.records.length, SHADOW_RECORD_MAX, 'never past it');
  const first = sp.records[0];
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  r.drawMesh(mesh, I, null);
  assert.equal(sp.records[0], first, 'the same record object, reused');
});

test('EL2: the renderer\'s wiring - the three draw paths record behind one gate, the maps are drawn before the clear, the destroys mark, the far ring takes no map', () => {
  const r = read('src/render/renderer.js');
  assert.equal((r.match(/this\._casting\) this\._shadows\.record/g) || []).length, 3, 'mesh, terrain, billboards');
  assert.match(r, /if \(!wire && this\._casting\) this\._shadows\.recordMesh\(mesh, modelMatrix, texRemap\);/, 'a wireframe draw (the automap) is not a caster');
  assert.match(r, /get _casting\(\) \{ return !!this\._shadows && !this\._panelSaved; \}/);
  const bf = r.slice(r.indexOf('beginFrame(proj, view, lightDir) {'), r.indexOf('beginFrame(proj, view, lightDir) {') + 2600);
  assert.ok(bf.indexOf('this._renderShadowMaps(view, lightDir)') < bf.indexOf('gl.clear('), 'the maps before the clear');
  assert.match(r, /if \(this\._panelSaved\) \{ this\._shadows\.discard\(\); return; \}/);
  assert.equal((r.match(/_dead = true;   \/\/ EL2/g) || []).length, 3, 'destroyMesh, destroyBillboardBatch, destroyBatch');
  assert.match(r, /this\._shadows = this\._shadowPass \?\?= new ShadowPass\(this\.gl, \{ build: \(vs, fs\) => this\._buildProgram\(vs, fs\), vs: \{ mesh: VS, bb: BB_VS, terrain: TERRAIN_VS \} \}\);/);
  assert.match(r, /if \(this\._shadows\) this\._shadows\.upload\(this\._el\[key\]\.shadow\);/);
  const sp = read('src/render/shadowPass.js');
  assert.ok(!/from '\.\/renderer\.js'/.test(sp), 'the pass imports nothing of the renderer');
  assert.ok(!/from '\.\/enhancedLighting\.js'/.test(sp), 'nor of the lane');
});
