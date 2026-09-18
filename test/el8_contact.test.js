// EL8 - ENHANCED LIGHTING, CONTACT SHADOWS AND THE CADENCE (2026-09-17, Mac:
// "1. Screen space contact shadows 2. Continue to find ways to improve
// performance while retaining quality").
//   - CONTACT SHADOWS off the PREVIOUS frame's depth, reprojected by the
//     previous frame's view-projection: the frame ping-pongs two depth
//     textures; every lantern without a caster slot marches toward its light.
//   - THE CASTER TABLE: light i's slot in one lookup (uCasterOf[48]).
//   - THE CADENCE: the far cascade every other frame, the far casters every
//     third, staggered - and at once when a slot's light changes.
//   - `?perf`: a GPU-timed line with the lane's counts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AIR_CONTACT_LENGTH, AIR_CONTACT_THICKNESS, AIR_CONTACT_STEPS, AIR_CONTACT_FLOOR, AIR_CONTACT_UNIT, AIR_CONTACT_GLSL, contactOn, AirPass,
} from '../src/render/airPass.js';
import {
  SHADOW_CASTER_TABLE, SHADOW_FAR_CASCADE_EVERY, SHADOW_FAR_CASTER_EVERY, SHADOW_NEAR_CASTERS, SHADOW_CASCADES, SHADOW_GLSL, SHADOW_POINT_CASTERS,
} from '../src/render/shadowPass.js';
import { EL_LANE, EL_MAX_LIGHTS, EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_BB_FS } from '../src/render/enhancedLighting.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { PerfMeter, perfOn, perfLine, PERF_EVERY } from '../src/render/perfMeter.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, DEPTH_ATTACHMENT: 36096, TRIANGLES: 4, QUERY_RESULT_AVAILABLE: 34919, QUERY_RESULT: 34918 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'getExtension') return () => null;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createQuery'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Float32Array.from(a) : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
const mesh = () => ({ vao: { id: 'vao-m' }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }] });

test('EL8: the constants, the door, the contact block and the table in the shaders', () => {
  assert.equal(AIR_CONTACT_LENGTH, 0.6); assert.equal(AIR_CONTACT_THICKNESS, 0.8); assert.equal(AIR_CONTACT_STEPS, 4); assert.equal(AIR_CONTACT_FLOOR, 0.15);
  assert.equal(AIR_CONTACT_UNIT, 12, 'the AO\'s old unit');
  assert.equal(contactOn('?x=1'), true); assert.equal(contactOn('?contact=off'), false); assert.equal(contactOn('?air=off&contact=off'), false);
  assert.equal(SHADOW_CASTER_TABLE, EL_MAX_LIGHTS, 'one slot per light the lane can hold');
  assert.equal(SHADOW_FAR_CASCADE_EVERY, 2); assert.equal(SHADOW_FAR_CASTER_EVERY, 3); assert.equal(SHADOW_NEAR_CASTERS, 2);
  assert.match(AIR_CONTACT_GLSL, /uniform sampler2D uPrevDepth;\nuniform mat4 uPrevVP;\nuniform vec4 uPrevProjInfo;/);
  assert.match(AIR_CONTACT_GLSL, /if \(uContactParams\.w <= 0\.0\) return 1\.0;/, 'off is lit');
  assert.match(AIR_CONTACT_GLSL, /float len = min\(dist, uContactParams\.x\);/, 'the march stops at the light');
  assert.match(AIR_CONTACT_GLSL, /for \(int i = 1; i <= 4; i\+\+\) \{/);
  assert.match(AIR_CONTACT_GLSL, /vec3 p = start \+ toLight \* \(len \* float\(i\) \/ 4\.0\);/, 'the steps as a float literal');
  // F3: the surface must have been in the previous frame where it stands, or nothing is marched
  assert.match(AIR_CONTACT_GLSL, /vec4 c0 = uPrevVP \* vec4\(start, 1\.0\);\n  if \(c0\.w <= 0\.0\) return 1\.0;\n  vec2 uv0 = c0\.xy \/ c0\.w \* 0\.5 \+ 0\.5;\n  if \(uv0\.x < 0\.0 \|\| uv0\.x > 1\.0 \|\| uv0\.y < 0\.0 \|\| uv0\.y > 1\.0\) return 1\.0;\n  float z0 = texture\(uPrevDepth, uv0\)\.r \* 2\.0 - 1\.0;\n  if \(abs\(c0\.w - uPrevProjInfo\.w \/ \(z0 \+ uPrevProjInfo\.z\)\) > uContactParams\.y\) return 1\.0;\n  for \(int i = 1;/, 'F3: the self-check before the march');
  assert.match(AIR_CONTACT_GLSL, /float sceneDist = uPrevProjInfo\.w \/ \(z \+ uPrevProjInfo\.z\);\n\s+float behind = c\.w - sceneDist;/, 'the previous frame\'s terms; c.w is the point\'s view distance under that projection');
  assert.match(AIR_CONTACT_GLSL, /if \(behind > 0\.02 && behind < uContactParams\.y\) return uContactParams\.z;/, 'an occluder within the thickness: the floor, not black');
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS]]) {
    assert.ok(fs.includes(AIR_CONTACT_GLSL), `${name} carries the contact block`);
    assert.match(fs, /int k = uCasterOf\[i\];[^\n]*\n(?:    \/\/[^\n]*\n)*    float sh = k >= 0 \? pointShadowAt\(k, wp, n\)\n      : \(k == -2 \|\| d > uPointLights\[i\]\.w \* 0\.7 \|\| length\(uPointLights\[i\]\.xyz - uCamPos\) < 1\.5\) \? 1\.0[^\n]*\n      : contactShadow\(wp, n, Ln, d\);/, `${name}: the table, then the map or the march - never for the hand's light, never past seven tenths of the range (F3, F5)`);
  }
  assert.ok(EL_BB_FS.includes('elPointFlat(vBBWorld, base)') && (EL_BB_FS.match(/elPointLit\(/g) || []).length === 1, 'a flat lights by elPointFlat, which marches nowhere (its own flat would occlude it); elPointLit is defined and never called there');
  assert.match(SHADOW_GLSL, /uniform int uCasterOf\[48\];/);
  assert.match(SHADOW_GLSL, /float shadowOfLight\(int i, vec3 wp, vec3 n\) \{\n  int k = uCasterOf\[i\];\n  return k >= 0 \? pointShadowAt\(k, wp, n\) : 1\.0;/);
  assert.ok(!/for \(int k = 0; k < \$\{SHADOW_POINT_CASTERS\}/.test(read('src/render/shadowPass.js')), 'no search over the casters per light');
  assert.ok(SHADOW_POINT_CASTERS === 6 && SHADOW_CASCADES.length === 3);
});

test('EL8: on the fake GL - the two depths ping-pong, the previous frame\'s view-projection reaches the march, the contact is off for the first frame, a sprite pass and a panel, and with the air off', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  r.textures.set('1_1', { id: 't' });
  // the air off: the contact sampler bound to the bare image, the params off
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  r.drawMesh(mesh(), I, null);
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uPrevDepth' && c[2] === AIR_CONTACT_UNIT), 'the sampler on its unit');
  let cp = calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uContactParams');
  assert.ok(cp.length > 0 && cp.every((c) => c[2][3] === 0), 'off without the air');
  r.setAir(true);
  const ap = r.air;
  ap._now = () => 1000;
  // frame 1: the first frame has no previous depth - off; the frame writes depth 1 (the swap runs first)
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  assert.equal(ap.frame.depthIndex, 1); assert.equal(ap.frame.depth, ap.frame.depths[1]); assert.equal(ap.frame.prevDepth, ap.frame.depths[0]);
  assert.ok(calls.some((c) => c[0] === 'framebufferTexture2D' && c[2] === 36096 && c[4] === ap.frame.depths[1]), 'this frame\'s depth attached');
  assert.equal(ap.prevValid, false);
  r.drawMesh(mesh(), I, null);
  cp = calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uContactParams');
  assert.ok(cp.length > 0 && cp.every((c) => c[2][3] === 0), 'no previous frame: off');
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  // frame 2: depth 0 is written, depth 1 (frame 1's) is the previous; the previous view-projection is frame 1's
  const P = new Float32Array([2, 0, 0, 0, 0, 2, 0, 0, 0, 0, -1.0002, -1, 0, 0, -0.2, 0]);
  calls.length = 0;
  r.beginFrame(P, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  assert.equal(ap.frame.depthIndex, 0); assert.equal(ap.frame.prevDepth, ap.frame.depths[1]);
  const fboBind = calls.findIndex((c) => c[0] === 'bindFramebuffer' && c[2] === ap.frame.fbo);
  assert.ok(fboBind >= 0 && calls.slice(fboBind).some((c) => c[0] === 'framebufferTexture2D' && c[2] === 36096 && c[4] === ap.frame.depths[0]), 'depth 0 attached to the frame\'s framebuffer for this frame (the swap re-attaches)');
  assert.equal(ap.prevValid, true);
  assert.deepEqual([...ap.prevVP], [...I], 'frame 1\'s view-projection (the identity) is the previous');
  r.drawMesh(mesh(), I, null);
  cp = calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uContactParams');
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  assert.ok(cp.length > 0 && cp.every((c) => c[2][3] === 1 && near(c[2][0], AIR_CONTACT_LENGTH) && near(c[2][1], AIR_CONTACT_THICKNESS) && near(c[2][2], AIR_CONTACT_FLOOR)), 'on, with the length, the thickness and the floor');
  const bind = calls.findIndex((c) => c[0] === 'uniform1i' && c[1] === 'uPrevDepth' && c[2] === AIR_CONTACT_UNIT);
  assert.ok(bind > 0 && calls.slice(0, bind).some((c) => c[0] === 'bindTexture' && c[2] === ap.frame.depths[1]), 'the previous depth bound on the unit before the sampler is pointed there');
  assert.ok(calls.some((c) => c[0] === 'uniformMatrix4fv' && c[1] === 'uPrevVP' && [...c[3]].every((v, i) => v === I[i])), 'frame 1\'s view-projection goes up');
  // a sprite pass takes no contact (another view)
  calls.length = 0;
  r.renderCharacterSprite({ vao: {}, count: 3 }, I, I, I, 8, 8);
  cp = calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uContactParams');
  assert.ok(cp.length > 0 && cp.every((c) => c[2][3] === 0), 'the sprite pass: off');
  // a panel frame neither
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  calls.length = 0;
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => { r.drawMesh(mesh(), I, null); });
  cp = calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uContactParams');
  assert.ok(cp.every((c) => c[2][3] === 0), 'a panel: off (the classic set declares none anyway)');
  // the door
  r.setContact(false);
  calls.length = 0;
  r.beginFrame(P, I, new Float32Array([0, 1, 0]), WORLD_FRAME);   // the mesh program's lane uniforms go up here
  r.drawMesh(mesh(), I, null);
  cp = calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uContactParams');
  assert.ok(cp.length > 0 && cp.every((c) => c[2][3] === 0), '?contact=off: off with the air on');
  assert.ok(AirPass);
});

test('EL8: the cadence - the far cascade every other frame, the near casters every frame, a far caster every third and at once when its light changes; the table', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  const sp = r.shadows;
  r.textures.set('1_1', { id: 't' });
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  const sun = new Float32Array([0.3, 0.8, 0.2]);
  const lights = (dx = 0) => new Float32Array([3, 1, 0, 10, 0, 1, 4, 10, -5 + dx, 1, 0, 10, 0, 1, -6, 10, 7, 1, 0, 10, 0, 1, 8, 10]);   // six lanterns at six distances, all casters, nearest first
  const frame = (L) => { r.setPointLights(L, new Float32Array([1, 1, 1])); r.beginFrame(I, I, sun, WORLD_FRAME); r.drawMesh(mesh(), I, null); r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); };
  frame(lights());   // frame 1 records; nothing replayed yet
  const runs = [];
  for (let f = 0; f < 6; f++) { calls.length = 0; frame(lights()); runs.push({ cascades: sp.stats.cascadesDrawn, faces: sp.stats.facesDrawn, frameNo: sp.frameNo }); }
  assert.equal(runs[0].cascades, 3, 'the first replay draws all three (a cascade never drawn is drawn now)');
  assert.deepEqual(runs.slice(1).map((x) => x.cascades), runs.slice(1).map((x) => (x.frameNo % SHADOW_FAR_CASCADE_EVERY === 0 ? 3 : 2)), 'then the far one every other frame');
  assert.ok(runs.slice(1).some((x) => x.cascades === 2) && runs.slice(1).some((x) => x.cascades === 3));
  assert.ok(runs.every((x) => x.faces >= 2 * 6), 'the two nearest casters every frame');
  assert.ok(runs.some((x) => x.faces === 6 * SHADOW_POINT_CASTERS) && runs.some((x) => x.faces < 6 * SHADOW_POINT_CASTERS), 'the far casters not every frame');
  assert.deepEqual([...sp.shadowIndex], [0, 1, 2, 3, 4, 5], 'nearest first (the eye at the origin)');
  assert.deepEqual([...sp.casterOf.slice(0, 8)], [0, 1, 2, 3, 4, 5, -1, -1], 'the table: light i\'s slot');
  assert.ok(calls.some((c) => c[0] === 'uniform1iv' && c[1] === 'uCasterOf' && c[2].length === SHADOW_CASTER_TABLE), 'the table goes up');
  // a far slot's light moves: its layers are drawn at once
  calls.length = 0;
  frame(lights(0.5));
  const movedFrame = sp.stats.facesDrawn;
  assert.ok(movedFrame >= 3 * 6, `the moved lantern's slot drawn this frame (${movedFrame} faces)`);
  // the far cascade's matrix is the one it was DRAWN with: the eye walks, the new matrix follows, the map's holds until its frame
  const eyeAt = (x) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, 0, 0, 1]);
  const walk = (x) => { r.setPointLights(lights(), new Float32Array([1, 1, 1])); r.beginFrame(I, eyeAt(x), sun, WORLD_FRAME); r.drawMesh(mesh(), I, null); r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); };
  const far = SHADOW_CASCADES.length - 1;
  for (let f = 0; f < 4; f++) {
    walk(30 + f * 20);
    const drawn = sp.frameNo % SHADOW_FAR_CASCADE_EVERY === 0;
    assert.deepEqual([...sp.sunVP[0]], [...sp._sunVPNew[0]], 'the near cascade\'s matrix is this frame\'s');
    if (drawn) assert.deepEqual([...sp.sunVP[far]], [...sp._sunVPNew[far]], 'drawn: the far matrix is this frame\'s');
    else assert.notDeepEqual([...sp.sunVP[far]], [...sp._sunVPNew[far]], 'held: the far matrix is the drawn frame\'s, not this one\'s');
  }
  // a sun that first shines at an odd frame: its far cascade, never drawn, is drawn now
  const r2 = new Renderer(recordingGl().canvas);
  r2.setLightingLane(EL_LANE);
  r2.textures.set('1_1', { id: 't' });
  const sp2 = r2.shadows;
  const frame2 = (sunScale) => { r2.setLighting(new Float32Array([0.5, 0.5, 0.5]), sunScale, new Float32Array([1, 1, 1])); r2.setPointLights(lights(), new Float32Array([1, 1, 1])); r2.beginFrame(I, I, sun, WORLD_FRAME); r2.drawMesh(mesh(), I, null); r2.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); };
  frame2(0); frame2(0);
  assert.equal(sp2.kind, 'point');
  frame2(0.55);
  assert.equal(sp2.kind, 'sun');
  assert.notEqual(sp2.frameNo % SHADOW_FAR_CASCADE_EVERY, 0, 'an odd frame');
  assert.equal(sp2.stats.cascadesDrawn, 3, `the sun's first frame at frame ${sp2.frameNo}: all three cascades, the far one never drawn before`);
});

test('EL8: the perf readout - the door, the line, the meter without the extension', () => {
  assert.equal(perfOn('?perf'), true); assert.equal(perfOn('?air=off&perf&x'), true); assert.equal(perfOn('?perfect=1'), false); assert.equal(perfOn(''), false);
  assert.equal(perfLine(null, { draws: 12 }), '[perf] gpu n/a | draws 12');
  assert.equal(perfLine(6.25, { draws: 812, shadows: { cascadesDrawn: 2, sunDraws: 300, casters: 6, facesDrawn: 18, pointDraws: 90, culled: 1204, records: 900 }, air: { emitDraws: 12, glares: 5, shafts: true } }),
    '[perf] gpu 6.25ms | draws 812 | sun 2c/300d | lanterns 6k/18f/90d | culled 1204 | records 900 | emit 12 | glares 5 | shafts 1');
  const { gl } = recordingGl();
  const m = new PerfMeter(gl);
  assert.equal(m.ext, null, 'no extension on the fake');
  m.begin(); m.end();
  let line = null;
  for (let i = 0; i < PERF_EVERY; i++) line = m.frame({ draws: 1 });
  assert.equal(line, '[perf] gpu n/a | draws 1', 'a line every PERF_EVERY frames, the GPU column n/a without the extension');
  assert.equal(m.frame({ draws: 1 }), null);
  const r = read('src/render/renderer.js');
  assert.match(r, /this\._perf = perfOn\(\) \? new PerfMeter\(gl\) : null;/);
  assert.match(r, /if \(world && this\._perf\) \{ this\._perf\.begin\(\); this\.stats\.draws = 0; \}/, 'the clock starts with a world frame');
  assert.match(r, /this\._perf\.end\(\);\n\s+const line = this\._perf\.frame\(/, 'and stops at the resolve');
});
