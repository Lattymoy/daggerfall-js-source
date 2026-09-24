// EL5 - ENHANCED LIGHTING, THE FIELD (2026-09-17): the first report from the
// game, a town gate at night - "the lights from inside the city are all
// bleeding through, tanking my framerate too". Four laws, pinned:
//   - THE BOUNDS AND THE CULL (render/bounds.js): every bundle carries a
//     sphere, every record its world sphere, every replay its frustum.
//   - THE CASTERS: up to four lanterns cast, into six layers each of one
//     depth array; the receiver selects the face by hand.
//   - THE GLARE'S OCCLUSION IN WORLD UNITS, five taps.
//   - THE RESOLVE'S CONTRAST IN DISPLAY SPACE (the crushed darks).
// The real-GL side is tools/enhancedLightingProbe.mjs, which this file pins
// as a text (its checks are the field's checks).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spherePlanes, sphereInPlanes, boundsOf, transformSphere, recordVisible, subMeshVisible, batchVisible } from '../src/render/bounds.js';
import {
  SHADOW_POINT_CASTERS, SHADOW_POINT_SIZE, SHADOW_POINT_NEAR, pickShadowCaster, pickShadowCasters, pointFaceMatrices, faceBasis, SHADOW_GLSL, ShadowPass, shadowFarFor } from '../src/render/shadowPass.js';
import { AIR_GLARE_SLACK } from '../src/render/airPass.js';
import { EL_LANE, EL_MESH_FS, EL_BB_FS, EL_TERRAIN_FS, EL_CHAR_FS } from '../src/render/enhancedLighting.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { perspective, ortho, lookAt, multiply, transformPoint } from '../src/world/mat4.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-5) => Math.abs(a - b) <= eps;
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const project = (m, x, y, z) => { const p = transformPoint(m, x, y, z); const w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [p[0] / w, p[1] / w, p[2] / w]; };

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

test('EL5: the sphere planes of a view-projection (EV3\'s, normalised) and the sphere test - an ortho box and a perspective frustum, inside, outside, touching', () => {
  const box = multiply(ortho(10, 10, 0, 100), lookAt([0, 0, 50], [0, 0, 0], [0, 1, 0]));
  const p = spherePlanes(box);
  assert.equal(p.length, 24);
  for (let k = 0; k < 6; k++) assert.ok(near(Math.hypot(p[k * 4], p[k * 4 + 1], p[k * 4 + 2]), 1), 'normalised');
  assert.ok(sphereInPlanes(p, 0, 0, 0, 1), 'the centre');
  assert.ok(sphereInPlanes(p, 9.5, 0, 0, 1), 'a sphere touching the right face');
  assert.ok(!sphereInPlanes(p, 12, 0, 0, 1), 'past the right face');
  assert.ok(!sphereInPlanes(p, 0, 12, 0, 1), 'past the top');
  assert.ok(sphereInPlanes(p, 0, 0, -49, 0.5), 'at the far end of the box');
  assert.ok(!sphereInPlanes(p, 0, 0, -52, 0.5), 'behind the far plane');
  assert.ok(!sphereInPlanes(p, 0, 0, 52, 0.5), 'behind the light');
  const persp = multiply(perspective(Math.PI / 2, 1, 0.1, 20), lookAt([0, 0, 0], [0, 0, -1], [0, 1, 0]));
  const q = spherePlanes(persp);
  assert.ok(sphereInPlanes(q, 0, 0, -5, 1));
  assert.ok(sphereInPlanes(q, 4.5, 0, -5, 1), 'a 90-degree frustum: x up to z at the edge, plus the radius');
  assert.ok(!sphereInPlanes(q, 7, 0, -5, 1));
  assert.ok(!sphereInPlanes(q, 0, 0, 5, 1), 'behind the eye');
  assert.ok(!sphereInPlanes(q, 0, 0, -25, 1), 'past the far plane');
  // the planes are the same test the faces use: a record in front of face +x is out of face -x
  const faces = [0, 1, 2, 3, 4, 5].map(() => new Float32Array(16));
  pointFaceMatrices([0, 0, 0], 20, faces);
  assert.ok(sphereInPlanes(spherePlanes(faces[0]), 5, 0, 0, 0.5)); assert.ok(!sphereInPlanes(spherePlanes(faces[1]), 5, 0, 0, 0.5));
  assert.ok(sphereInPlanes(spherePlanes(faces[2]), 0, 5, 0, 0.5)); assert.ok(sphereInPlanes(spherePlanes(faces[5]), 0, 0, -5, 0.5));
});

test('EL5: boundsOf and transformSphere - the box centre, the farthest vertex, an index range, the largest axis scale', () => {
  const pos = new Float32Array([0, 0, 0, 4, 0, 0, 4, 2, 0, 0, 2, 0, 10, 10, 10, 12, 10, 10]);
  const all = boundsOf(pos);
  assert.deepEqual([...all].map((v) => +v.toFixed(4)), [6, 5, 5, +Math.hypot(6, 5, 5).toFixed(4)]);
  const idx = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 4]);
  const first = boundsOf(pos, idx, 0, 6);
  assert.deepEqual([...first].map((v) => +v.toFixed(4)), [2, 1, 0, +Math.hypot(2, 1).toFixed(4)], 'the quad alone');
  const second = boundsOf(pos, idx, 6, 3);
  assert.deepEqual([...second].map((v) => +v.toFixed(4)), [11, 10, 10, 1]);
  assert.deepEqual([...boundsOf(new Float32Array(0))], [0, 0, 0, 0], 'empty: a zero sphere');
  const m = new Float32Array([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 100, 200, 300, 1]);
  const out = new Float32Array(8);
  transformSphere(m, second, out, 4);
  assert.deepEqual([...out.slice(4)], [122, 230, 310, 3], 'the centre through the matrix, the radius by the largest scale, at the offset');
  assert.deepEqual([...out.slice(0, 4)], [0, 0, 0, 0], 'the rest untouched');
});

test('EL5: the casters - the nearest lanterns first, at most SHADOW_POINT_CASTERS, the eye\'s own and the flash skipped; the old pick is the first of them', () => {
  const L = new Float32Array([
    0, 0, 0, 10,      // the eye's own (the candle)
    30, 0, 0, 12,
    5, 0, 0, 9,
    -2, 0, 0, 0,      // rangeless
    1, 0, 0, 600,     // the lightning flash
    -10, 0, 0, 12,
    20, 0, 0, 14,
    12, 0, 0, 12,
  ]);
  const C = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]);   // LIGHT-NEAR1: the candle is the eye's own BY ITS FLAG, not by its distance
  assert.deepEqual(pickShadowCasters(L, [0, 0, 0], 6, C), [2, 5, 7, 6, 1], 'by distance: 5, 10, 12, 20, 30 - the five lanterns, all within six');
  assert.deepEqual(pickShadowCasters(L, [0, 0, 0], 4, C), [2, 5, 7, 6], 'at four: the one at 30 left out');
  assert.deepEqual(pickShadowCasters(L, [0, 0, 0], 2, C), [2, 5]);
  assert.equal(pickShadowCaster(L, [0, 0, 0], C), 2, 'the old pick is the nearest');
  assert.deepEqual(pickShadowCasters(L, [0, 0, 0]), [0, 2, 5, 7, 6, 1], 'LIGHT-NEAR1: unflagged, the light at the eye is the nearest caster of all');
  assert.deepEqual(pickShadowCasters(new Float32Array(0), [0, 0, 0]), []);
  assert.equal(SHADOW_POINT_CASTERS, 8);   // HQ1: eight, on SC1's cache
});

test('EL5: the face basis the shader selects by is pointFaceMatrices\' own - a point projects to the same uv both ways, on every face', () => {
  const faces = [0, 1, 2, 3, 4, 5].map(() => new Float32Array(16));
  const pos = [3, 4, 5], far = 20;
  pointFaceMatrices(pos, far, faces);
  const pts = [[9, 4.5, 6], [-4, 3, 4.2], [3.3, 11, 5.5], [2.5, -3, 4.4], [3.6, 4.1, 13], [2.2, 4.7, -2]];
  for (const q of pts) {
    const d = [q[0] - pos[0], q[1] - pos[1], q[2] - pos[2]];
    const a = d.map(Math.abs);
    const face = a[0] >= a[1] && a[0] >= a[2] ? (d[0] > 0 ? 0 : 1) : a[1] >= a[2] ? (d[1] > 0 ? 2 : 3) : d[2] > 0 ? 4 : 5;
    const m = Math.max(...a);
    const { x, y } = faceBasis(face);
    const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const shader = [dot(x, d) / m * 0.5 + 0.5, dot(y, d) / m * 0.5 + 0.5];
    const ndc = project(faces[face], q[0], q[1], q[2]);
    assert.ok(near(shader[0], ndc[0] * 0.5 + 0.5, 1e-4) && near(shader[1], ndc[1] * 0.5 + 0.5, 1e-4), `face ${face}: ${shader} vs ${[ndc[0] * 0.5 + 0.5, ndc[1] * 0.5 + 0.5]}`);
    assert.ok(ndc[2] > -1 && ndc[2] < 1, 'inside the face\'s depth');
  }
  assert.match(SHADOW_GLSL, /const vec3 FACE_X\[6\] = vec3\[6\]\(vec3\(0\.0, 0\.0, -1\.0\), vec3\(0\.0, 0\.0, 1\.0\), vec3\(1\.0, 0\.0, 0\.0\), vec3\(1\.0, 0\.0, 0\.0\), vec3\(1\.0, 0\.0, 0\.0\), vec3\(-1\.0, 0\.0, 0\.0\)\);/);
  assert.match(SHADOW_GLSL, /const vec3 FACE_Y\[6\] = vec3\[6\]\(vec3\(0\.0, -1\.0, 0\.0\), vec3\(0\.0, -1\.0, 0\.0\), vec3\(0\.0, 0\.0, 1\.0\), vec3\(0\.0, 0\.0, -1\.0\), vec3\(0\.0, -1\.0, 0\.0\), vec3\(0\.0, -1\.0, 0\.0\)\);/);
  assert.match(SHADOW_GLSL, /if \(a\.x >= a\.y && a\.x >= a\.z\) \{ face = d\.x > 0\.0 \? 0 : 1; m = a\.x; \}\n  else if \(a\.y >= a\.z\) \{ face = d\.y > 0\.0 \? 2 : 3; m = a\.y; \}\n  else \{ face = d\.z > 0\.0 \? 4 : 5; m = a\.z; \}/, 'the same major-axis selection');
  assert.match(SHADOW_GLSL, /vec2 uv = vec2\(dot\(FACE_X\[face\], d\), dot\(FACE_Y\[face\], d\)\) \/ max\(m, 1e-4\) \* 0\.5 \+ 0\.5;/);
  assert.match(SHADOW_GLSL, /float t = 1\.5 \/ 512\.0;/, 'the five taps a texel and a half apart');
  assert.match(SHADOW_GLSL, /int k = uCasterOf\[i\];\n  return k >= 0 \? casterShadowAt\(k, L, wp, n\) : 1\.0;\n\}/, 'a light with no caster is lit (the flat\'s path; EL8: by the table; DISC15: a caster of either tier)');
  assert.equal(SHADOW_POINT_SIZE, 512); assert.equal(SHADOW_POINT_NEAR, 0.1);
});

test('EL5: every lane shader takes any caster\'s shadow through shadowOfLight, after the range early-out; the flat too', () => {
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS]]) {
    assert.match(fs, /float d = length\(L\);\n    if \(d >= uPointLights\[i\]\.w\) continue;[^\n]*\n    vec3 Ln = L \/ max\(d, 1e-4\);\n    int k = uCasterOf\[i\];[^\n]*\n(?:    \/\/[^\n]*\n)*    float sh = k >= 0 \? casterShadowAt\(k, uPointLights\[i\], wp, n\)[^\n]*\n      : \(k == -2 \|\| d > uPointLights\[i\]\.w \* 0\.7\) \? 1\.0[^\n]*\n      : contactShadow\(wp, n, Ln, d\);/, `${name}: EL8 - a caster's map (DISC15: of either tier), else a contact shadow`);
    assert.ok(!/uShadowIndex \?/.test(fs), `${name}: no single-index compare left`);
  }
  assert.match(EL_BB_FS, /float d = length\(uPointLights\[i\]\.xyz - wp\);\n    if \(d >= uPointLights\[i\]\.w\) continue;[^\n]*\n    float sh = shadowOfLight\(i, uPointLights\[i\], base, vec3\(0\.0, 1\.0, 0\.0\)\);/);
  assert.match(EL_BB_FS, /acc \+= sh \* elAttenuation\(d, uPointLights\[i\]\.w\) \* uPointColors\[i\];/, 'the flat reuses the distance it tested');
});

test('EL5: the renderer\'s bundles carry bounds - a mesh and each sub-mesh, a terrain surface, a billboard batch about its origin', () => {
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  const positions = new Float32Array([0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 50, 0, 0, 52, 0, 0, 52, 2, 0]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6]);
  const mesh = r.createMesh({ positions, normals: positions, uvs: new Float32Array(14), indices, subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }, { textureArchive: 1, textureRecord: 2, startIndex: 6, primitiveCount: 1 }] });
  assert.deepEqual([...mesh.bounds].map((v) => +v.toFixed(3)), [26, 1, 0, +Math.hypot(26, 1).toFixed(3)]);
  assert.deepEqual([...mesh.subMeshes[0]._bounds].map((v) => +v.toFixed(3)), [1, 1, 0, +Math.SQRT2.toFixed(3)], 'the quad');
  assert.deepEqual([...mesh.subMeshes[1]._bounds].map((v) => +v.toFixed(3)), [51, 1, 0, +Math.hypot(1, 1).toFixed(3)], 'the far triangle');
  assert.ok(Object.isExtensible(mesh.subMeshes[0]) && !('_bounds' in { textureArchive: 1 }), 'the copies are the renderer\'s own');
  const terrain = r.createTerrainSurface(new Float32Array([0, 0, 0, 6.4, 0, 0, 6.4, 0, 6.4, 0, 0, 6.4]), new Float32Array(12), new Uint32Array([0, 1, 2, 0, 2, 3]));
  assert.deepEqual([...terrain.bounds].map((v) => +v.toFixed(3)), [3.2, 0, 3.2, +Math.hypot(3.2, 3.2).toFixed(3)]);
  const batch = r.createBillboardBatch(210, 1, { w: 1, h: 2 }, [[0, 1, 0], [4, 1, 0]]);
  assert.deepEqual([...batch.bounds].map((v) => +v.toFixed(3)), [2, 1, 0, +(2 + Math.hypot(1, 2) / 2).toFixed(3)], 'the centres\' box plus a flat\'s half-diagonal');
});

test('EL5: the replays cull - a record outside a face\'s frustum is not drawn, a sub-mesh outside is skipped, a batch outside too; a bundle without bounds always draws', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  assert.ok(calls.some((c) => c[0] === 'texStorage3D' && c[6] === 6 * SHADOW_POINT_CASTERS), 'six layers per caster');
  assert.equal(calls.filter((c) => c[0] === 'framebufferTextureLayer').length, 3 + 6 * SHADOW_POINT_CASTERS);   // EL7: three cascades; SC1: the live layers (AUDIT SC1: the cache's come with the first frame that wants them)
  r.textures.set('1_1', { id: 't' }); r.textures.set('201_1', { id: 'b' }); r.textures.set('210_1', { id: 'flame' });
  // a mesh of two sub-meshes: one at the origin (in the lantern's range), one 100 units out
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 100, 0, 0, 101, 0, 0, 101, 1, 0]);
  const mesh = r.createMesh({ positions, normals: positions, uvs: new Float32Array(12), indices: new Uint32Array([0, 1, 2, 3, 4, 5]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }, { textureArchive: 1, textureRecord: 1, startIndex: 3, primitiveCount: 1 }] });
  const nearBatch = r.createBillboardBatch(201, 1, { w: 1, h: 1 }, [[2, 0, 0]]);
  const farBatch = r.createBillboardBatch(201, 1, { w: 1, h: 1 }, [[0, 0, 200], [1, 0, 200]]);   // two flats: 12 indices, told apart from the near one's 6
  const flames = r.createBillboardBatch(210, 1, { w: 1, h: 1 }, [[3, 0, 0], [3, 0, 1], [3, 0, -1]]);   // EL6: the lights archive by the lantern - three flats, 18 indices, never a lantern's caster
  const farTerrain = r.createTerrainSurface(new Float32Array([300, 0, 0, 306, 0, 0, 306, 0, 6, 300, 0, 6, 303, 1, 3]), new Float32Array(15), new Uint32Array([0, 1, 4, 1, 2, 4, 2, 3, 4]));   // 9 indices, 300 units out
  const bare = { vao: { id: 'bare' }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }] };   // no bounds: a hand-built bundle
  r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0);
  r.setPointLights(new Float32Array([3, 1, 0, 10, 0, 1, 40, 8]), new Float32Array([1, 1, 1]));   // two lanterns: range 10 by the mesh, range 8 forty units down z
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  r.drawMesh(mesh, I, null);
  r.drawMesh(bare, I, null);
  r.drawTerrain(farTerrain, I, {}, {}, 6.4);
  r.drawBillboards([nearBatch, farBatch, flames], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  assert.equal(sp.count, 4);
  assert.equal(sp.records[0].bounded, true); assert.equal(sp.records[1].bounded, false); assert.equal(sp.records[2].bounded, true);
  assert.deepEqual([...sp.records[0].subSpheres.slice(4, 8)].map((v) => +v.toFixed(3)), [100.5, 0.5, 0, +Math.hypot(0.5, 0.5).toFixed(3)], 'the far sub-mesh\'s world sphere');
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  assert.equal(sp.kind, 'point'); assert.equal(sp.casters, 2, 'both lanterns cast'); assert.deepEqual([...sp.shadowIndex], [0, 1, ...new Array(SHADOW_POINT_CASTERS - 2).fill(-1)], 'nearest first');
  // PERF-FLICKER: the w is the CUBE MAP's own far plane - the lantern's
  // range rounded UP to SHADOW_FAR_QUANTUM, so the animated flicker cannot
  // read as "this light changed" and rebuild six faces a frame. 10 -> 12;
  // 8 is already a multiple and is untouched, which is the pin's own proof
  // that the rounding is UP and not a blanket widening.
  assert.deepEqual([...sp.pointParams].slice(0, 8), [3, 1, 0, shadowFarFor(10), 0, 1, 40, shadowFarFor(8)]);
  assert.deepEqual([shadowFarFor(10), shadowFarFor(8)], [12, 8]);
  // twelve faces: the near sub-mesh is in front of some (drawn there), the far one is out of every face's far plane; the bare mesh draws on all twelve; the far terrain and the far batch never
  assert.ok(sp.stats.pointDraws < 12 * 5, `culled: ${sp.stats.pointDraws} of 60 draws`);
  assert.ok(sp.stats.culled > 0);
  const drawn = calls.filter((c) => c[0] === 'drawElements');
  assert.equal(drawn.filter((c) => c[4] === 12).length, 0, 'the far sub-mesh (index offset 12) was never drawn from a lantern');
  assert.equal(drawn.filter((c) => c[2] === 9).length, 0, 'the far terrain (9 indices) was never drawn - the record\'s own sphere');
  assert.equal(drawn.filter((c) => c[2] === 12).length, 0, 'the far batch (12 indices) was never drawn');
  assert.equal(drawn.filter((c) => c[2] === 18).length, 0, 'EL6: the flames (archive 210, in range) were never drawn from a lantern - a flame is the lantern');
  assert.ok(drawn.filter((c) => c[2] === 3 && c[4] === 0).length >= 12 + 1, 'the bare mesh drew on every face of both lanterns (and the near sub-mesh on at least one)');
  const bbDraws = drawn.filter((c) => c[2] === 6);
  assert.ok(bbDraws.length >= 1 && bbDraws.length < 12, `the near batch: ${bbDraws.length} draws of a possible 12`);
  // the pure helpers agree with the record
  const planes = spherePlanes(multiply(perspective(Math.PI / 2, 1, 0.1, 10), lookAt([3, 1, 0], [4, 1, 0], [0, -1, 0])));
  assert.equal(recordVisible(planes, sp.records[0]), true, 'the whole mesh\'s sphere (centred at 50, radius 50) reaches back into the face - the sub-mesh test is what culls');
  assert.equal(subMeshVisible(planes, sp.records[0], 1), false, 'the far sub-mesh is beyond the face\'s far plane');
  assert.equal(recordVisible(planes, sp.records[1]), true, 'unbounded: always');
  assert.equal(batchVisible(planes, farBatch), false); assert.equal(batchVisible(planes, { vao: {} }), true);
});

test('EL5: the glare hides in world units at five taps, the resolve grades in display space, and the probe checks the field\'s two laws', () => {
  const a = read('src/render/airPass.js');
  assert.equal(AIR_GLARE_SLACK, 0.25, 'EL7: the flame within the slack of its light; F4: a quarter unit, the flat and nothing else');
  assert.match(a, /float viewDist\(float d01\) \{\n  float z = d01 \* 2\.0 - 1\.0;\n  return uProjInfo\.w \/ \(z \+ uProjInfo\.z\);/, 'the depth image linearised the way the AO does');
  assert.match(a, /float lantern = -vc\.z;/);
  assert.ok(!/<= d \+ 0\.002/.test(a), 'no hyperbolic constant left');
  assert.match(a, /depthOn\(P\);   \/\/ EL5\/EL6/); assert.match(a, /if \(f\.carried && f\.carried\[i\]\) continue;   \/\/ MAC-T1/, 'the hand\'s light skipped by its flag (LIGHT-NEAR1: the camera-distance skip is gone)');
  assert.match(a, /vec3 e = airEncode\(max\(c, vec3\(0\.0\)\)\);\n  e = \(e - 0\.5\) \* uGrade\.w \+ 0\.5;\n  e \+= \(bayer4\(gl_FragCoord\.xy\) - \$\{BAYER_MEAN\}\) \/ 255\.0;/, 'the contrast after the encode, about mid-grey; EL6: dithered at the byte, zero-mean');
  assert.ok(!/c = \(c - 0\.18\) \* uGrade\.w \+ 0\.18;/.test(a), 'the linear pivot is gone');
  assert.match(a, /import \{ spherePlanes, recordVisible, subMeshVisible, batchVisible \} from '\.\/bounds\.js';/, 'the leaf imports a leaf');
  const b = read('src/render/bounds.js');
  assert.match(b, /^import \{ frustumPlanes \} from '\.\/frustum\.js';/m, 'bounds.js imports EV3\'s plane extraction and nothing else (one home)');
  assert.equal((b.match(/^import /gm) || []).length, 1);
  const probe = read('tools/enhancedLightingProbe.mjs');
  assert.match(probe, /if \(bleed > 0\.005\) failures\.push\(`lantern A bleeds through the wall/, 'the bleed check (EL6: the eye frozen, five times tighter)');
  assert.match(probe, /if \(emitBleed > 0\.002\) failures\.push\(`the emitter behind the wall blooms through it/, 'EL6: the emitter check');
  assert.match(probe, /if \(!\(front\.bloom\?\.sum > 0\)\) failures\.push\('an emitter in view put nothing in the bloom source/, 'EL6: and the occlusion discriminates');
  assert.match(probe, /if \(r\.air\) r\.air\._now = \(\) => 1000;/, 'EL6: the eye frozen for the comparisons');
  assert.match(probe, /if \(!\(shadowLane - shadowNoA < 0\.01\)\) failures\.push/, 'the shadow check (EL7: A\'s own contribution behind the wall, none)');
  assert.match(probe, /if \(!\(openLane - openNoA > 0\.02\)\) failures\.push/, 'and beside it, some');
  assert.match(probe, /sh\.culledTotal === 0\) failures\.push\('the replays culled nothing/, 'the cull check (SC1: summed over the frames - a still room replays nothing on its last)');
  assert.match(probe, /'--use-angle=swiftshader'/, 'a real GL, software');
});
