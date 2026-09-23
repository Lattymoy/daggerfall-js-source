// EL6 - ENHANCED LIGHTING, THE FIELD'S FOUR (2026-09-17, Mac: "1. Some
// shadows (like campfire) are wonky 2. Textures in the dark look weird
// 3. All lighting sources can be seen through walls 4. Need to
// comprehensively make this where it doesnt tank performance").
//   - a flame flat (the lights archive) never casts from a lantern;
//   - the SSAO's rotation is ordered to its blur, both encodes dithered;
//   - an emitter discards behind the frame's depth;
//   - the air's images are drawn at the resolve off the frame's own depth
//     texture - no camera replay, no AO fetch in a world shader.
// The pins the EL6 campaign found no test could fail (tools/mutants/el6.json).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AIR_EMIT_SLACK, AIR_AO_RESOLVE, EMIT_MESH_FS, EMIT_BB_FS } from '../src/render/airPass.js';
import { BAYER_GLSL, BAYER_MEAN, DITHER_GLSL } from '../src/render/orderedDither.js';
import { SHADOW_LIGHT_FLATS, SHADOW_POINT_CASTERS } from '../src/render/shadowPass.js';
import { EL_LANE, EL_MESH_FS, EL_BB_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_FAR_RING_FS } from '../src/render/enhancedLighting.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { LIGHTS_ARCHIVE } from '../src/world/cityLights.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, DEPTH_ATTACHMENT: 36096 };
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

test('EL6: the constants and the shader laws - the lights archive, the emitter slack, the ordered rotation, the dither at both encodes, the scatter early-out', () => {
  assert.equal(SHADOW_LIGHT_FLATS, LIGHTS_ARCHIVE, 'the flame flats are the lights archive');
  assert.equal(SHADOW_POINT_CASTERS, 8);   // HQ1: eight, on SC1's cache
  assert.equal(AIR_EMIT_SLACK, 0.15); assert.equal(AIR_AO_RESOLVE, 0.75);
  const a = read('src/render/airPass.js');
  assert.match(a, /float ang = bayer4\(gl_FragCoord\.xy\) \* 6\.2831853;/, 'the AO rotation is the 4x4 ordered threshold');
  assert.ok(!/hash\(gl_FragCoord/.test(a), 'no hash rotation left');
  assert.match(a, /for \(int y = -2; y < 2; y\+\+\) \{\n    for \(int x = -2; x < 2; x\+\+\) \{/, 'and the blur is one 4x4 tile');
  assert.match(BAYER_GLSL, /float bayer4\(vec2 p\) \{/, 'the port\'s one Bayer (orderedDither.js), the skies\' too');
  assert.ok(DITHER_GLSL.includes(BAYER_GLSL), 'the world-fixed cell block composes it - one home');
  assert.equal(BAYER_MEAN, 0.46875);
  assert.ok(a.includes('${BAYER_GLSL}') && !/const DITHER_GLSL/.test(a), 'airPass takes it, defines none');
  assert.match(a, /  e \+= \(bayer4\(gl_FragCoord\.xy\) - \$\{BAYER_MEAN\}\) \/ 255\.0;   \/\/ EL6: the dither, at the byte, zero-mean/, 'the resolve dithers');
  const dither = `(bayer4(gl_FragCoord.xy) - ${BAYER_MEAN}) / 255.0`;
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['bb', EL_BB_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS]]) {
    assert.ok(fs.includes(BAYER_GLSL), `${name} carries the Bayer`);
    assert.ok(fs.includes(`return elEncode(col) + ${dither};`), `${name}: the lane's encode dithers, zero-mean`);
  }
  assert.ok(EL_FAR_RING_FS.includes(BAYER_GLSL));
  assert.ok(EL_FAR_RING_FS.includes(`outColor = vec4(elEncode(col) + ${dither}, 1.0);`), 'the ring\'s sky gradient dithers too');
  assert.match(EL_MESH_FS, /vec3 rel = uPointLights\[i\]\.xyz - uCamPos;\n    if \(length\(rel\) > dist \+ uPointLights\[i\]\.w\) continue;/, 'the in-scatter loop skips a lantern the ray cannot reach');
  assert.match(a, /return texture\(uDepth, \(uRect\.xy \+ wuv \* uRect\.zw\) \/ uCanvas\)\.r;/, 'the depth block samples the canvas-sized frame at the world rect');
  for (const [name, fs] of [['mesh', EMIT_MESH_FS], ['bb', EMIT_BB_FS]]) {
    assert.match(fs, /if \(occluded\(\)\) discard;   \/\/ EL6/, `${name}: an emitter behind the frame's depth does not bloom`);
    assert.match(fs, /return viewDist\(gl_FragCoord\.z\) > viewDist\(depthAt\(wuv\)\) \+ 0\.15;/, `${name}: its own slack, in world units`);
    assert.match(fs, /vec2 wuv = gl_FragCoord\.xy \/ uBloomSize;/);
  }
});

test('EL6: on the fake GL - nothing measured at prepare, the frame\'s depth is a texture on its framebuffer, every image pass gets the world rect', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  const ap = r.air;
  r.textures.set('1_1', { id: 't' });
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, -0.2]), WORLD_FRAME);
  assert.equal(ap.measured, false, 'prepare measures nothing - the resolve decides');
  assert.ok(ap.frame.depth && typeof ap.frame.depth === 'object', 'the frame\'s depth is a texture');
  assert.ok(calls.some((c) => c[0] === 'framebufferTexture2D' && c[2] === 36096 && c[4] === ap.frame.depth), 'attached as the frame\'s depth');
  assert.ok(!calls.some((c) => c[0] === 'renderbufferStorage'), 'no renderbuffer');
  r.drawMesh({ vao: { id: 'vao-m' }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }] }, I, null);
  r.textures.set('210_1', { id: 'flat' }); r.emissionTextures.set('210_1', { id: 'emis' });
  r.drawBillboards([{ archive: 210, record: 1, vao: { id: 'vao-b' }, indexCount: 6, size: { w: 1, h: 1 }, origin: [0, 0, -3] }], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));   // an emitter, for the depth on its unit
  calls.length = 0;
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  assert.equal(ap.measured, true, 'the frame drew: measured at the resolve');
  assert.equal(ap.stats.emitDraws, 1);
  const unit2 = calls.findIndex((c) => c[0] === 'uniform1i' && c[1] === 'uDepth' && c[2] === 2);
  assert.ok(unit2 > 0 && calls[unit2 - 1][0] === 'bindTexture' && calls[unit2 - 1][2] === ap.frame.depth, 'the emitter program takes the frame\'s depth on unit 2, bound right before the sampler is pointed there (its own textures sit on 0 and 1)');
  const rects = calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uRect');
  assert.ok(rects.length >= 4, `the AO, the luminance, the bright pass and the resolve all take the world rect (no sun: no shaft; no lantern: no glare) (${rects.length})`);
  assert.ok(rects.every((c) => c[2][2] === 320 && c[2][3] === 200));
  const depthBinds = calls.filter((c) => c[0] === 'bindTexture' && c[2] === ap.frame.depth).length;
  assert.ok(depthBinds >= 1, 'the frame\'s depth bound for the AO (no sun here: no shaft)');
  // a frame that draws nothing: not measured; and the counts are the frame's own - reset at prepare, counted at the resolve
  r.setPointLights(new Float32Array([2, 1, -3, 10]), new Float32Array([1, 1, 1]));
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, -0.2]), WORLD_FRAME);
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  assert.equal(ap.measured, false, 'AUDIT-EL F10 holds at the resolve');
  assert.equal(ap.stats.glares, 1, 'one lantern glared at that resolve');
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, -0.2]), WORLD_FRAME);
  assert.deepEqual(ap.stats, { emitDraws: 0, glares: 0, shafts: false }, 'prepare resets the counts - a probe reading them mid-frame reads this frame\'s');
});
