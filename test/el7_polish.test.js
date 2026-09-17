// EL7 - ENHANCED LIGHTING, THE POLISH (2026-09-17, Mac: "Lets do #7 + I
// notice a bug with light sources, that have this bright translucent ball
// that isnt connected to the source").
//   - THE GLARE NEEDS A FLAME: presence in the frame's depth within a unit of
//     the light, five taps over the footprint; none for a light in the hand.
//   - THREE CASCADES by view distance (the room, the street, the town).
//   - THE RIGS CAST (createCharacterMesh's bundle, recorded from drawCharacter,
//     never from the sprite target or the studio) and THE WATER RECEIVES (its
//     own lane program with the receiver block).
//   - THE AO BLUR IS DEPTH-AWARE.
//   - glslFloat: a whole-number constant reaches a shader as a float literal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundsOf } from '../src/render/bounds.js';
import { SHADOW_CASCADES, sunTexelWorld, SHADOW_GLSL, ShadowPass } from '../src/render/shadowPass.js';
import { AIR_GLARE_SIZE, AIR_GLARE_SLACK, AIR_GLARE_MIN_DISTANCE, AIR_AO_RADIUS, glslFloat, glareSize } from '../src/render/airPass.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { waterSurfaceFs } from '../src/render/waterSurface.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, DEPTH_ATTACHMENT: 36096, TRIANGLES: 4 };
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

test('EL7: the constants and the shader laws - the glare\'s presence test and its size, the three cascades, the depth-aware blur, the float literal', () => {
  assert.equal(AIR_GLARE_SIZE, 0.25); assert.equal(AIR_GLARE_SLACK, 1.0); assert.equal(AIR_GLARE_MIN_DISTANCE, 1.5);
  assert.ok(near(glareSize(18), 0.25 * Math.sqrt(18)));
  assert.equal(glslFloat(1), '1.0'); assert.equal(glslFloat(1.0), '1.0'); assert.equal(glslFloat(0.15), '0.15'); assert.equal(glslFloat(2.5), '2.5');
  const a = read('src/render/airPass.js');
  assert.match(a, /return abs\(viewDist\(depthAt\(uv\)\) - lantern\) <= \$\{glslFloat\(AIR_GLARE_SLACK\)\} \? 1\.0 : 0\.0;/, 'presence: a surface within the slack of the light, either way');
  assert.match(a, /viewDist\(depthAt\(wuv\)\) \+ \$\{glslFloat\(AIR_EMIT_SLACK\)\};/, 'the emitter slack through the same door');
  assert.ok(!/<= \$\{AIR_GLARE_SLACK\}/.test(a) && !/\+ \$\{AIR_EMIT_SLACK\}/.test(a), 'no bare interpolation of a constant that could be whole');
  assert.match(a, /if \(eye && Math\.hypot\(L\[i \* 4\] - eye\[0\], L\[i \* 4 \+ 1\] - eye\[1\], L\[i \* 4 \+ 2\] - eye\[2\]\) < AIR_GLARE_MIN_DISTANCE\) continue;/, 'no glare for the light in the hand');
  assert.match(a, /float w = abs\(viewDist\(depthAt\(uv\)\) - here\) <= uBlurRange \? 1\.0 : 0\.0;/, 'the blur weighs a tap by its depth');
  assert.match(a, /outColor = vec4\(vec3\(wsum > 0\.0 \? acc \/ wsum : 1\.0\), 1\.0\);/, 'and normalises by the taps it kept');
  assert.match(a, /gl\.uniform1f\(this\.programs\.box\.uBlurRange, AIR_AO_RADIUS\);/); assert.equal(AIR_AO_RADIUS, 0.8);
  assert.deepEqual([...SHADOW_CASCADES], [12, 48, 240]);
  assert.ok(near(sunTexelWorld(0), 24 / 2048) && near(sunTexelWorld(2), 480 / 2048));
  assert.match(SHADOW_GLSL, /uniform mat4 uSunVP\[3\];/); assert.match(SHADOW_GLSL, /uniform vec4 uSunTexel;/);
  assert.match(SHADOW_GLSL, /int c = d < uSunShadowParams\.x \* 0\.9 \? 0 : d < uSunShadowParams\.y \* 0\.9 \? 1 : 2;/);
  assert.match(SHADOW_GLSL, /float texel = c == 0 \? uSunTexel\.x : c == 1 \? uSunTexel\.y : uSunTexel\.z;/);
  // the water surface with the receiver block: the shadow rides the cloud's
  const ws = waterSurfaceFs('float cloudShadowAt(vec3 p) { return 1.0; }', SHADOW_GLSL);
  assert.ok(ws.includes(SHADOW_GLSL) && ws.indexOf('uniform vec3 uCamPos;') < ws.indexOf(SHADOW_GLSL), 'the block after uCamPos, which it reads');
  assert.match(ws, /float shadow = cloudShadowAt\(vWorldPos\) \* sunShadowAt\(vWorldPos, n\);/);
  assert.match(waterSurfaceFs('float cloudShadowAt(vec3 p) { return 1.0; }'), /float shadow = cloudShadowAt\(vWorldPos\);/, 'the classic water takes none');
});

test('EL7: boundsOf with a stride - a rig\'s interleaved vertices', () => {
  const packed = new Float32Array([0, 0, 0, 9, 9, 9, 9, 9, 9, 4, 0, 0, 9, 9, 9, 9, 9, 9, 4, 2, 0, 9, 9, 9, 9, 9, 9]);
  assert.deepEqual([...boundsOf(packed, null, 0, -1, 9)].map((v) => +v.toFixed(4)), [2, 1, 0, +Math.hypot(2, 1).toFixed(4)], 'the positions alone, nine floats apart');
});

test('EL7: on the fake GL - the rigs are recorded and replayed (never from the sprite pass), the cascades\' texels go up, the water draws on its lane program with the maps', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  assert.equal(r.waterSurfaceProgramLane, null);
  r.setLightingLane(EL_LANE);
  assert.ok(r.waterSurfaceProgramLane && r._wsLane?.shadow?.sunShadow === 'uSunShadow', 'the lane\'s water program, with the receiver\'s locations');
  assert.ok(r.shadows.programs.char, 'the rigs\' depth program');
  const rig = r.createCharacterMesh(new Float32Array(9 * 6), {});
  assert.ok(rig.bounds instanceof Float32Array && rig.bounds.length === 4);
  rig.ranges = [{ first: 0, count: 3 }, { first: 3, count: 3, hidden: true }];
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  r.drawCharacter(rig, I);
  assert.equal(r.shadows.count, 1, 'recorded');
  assert.equal(r.shadows.records[0].kind, 3); assert.equal(r.shadows.records[0].mesh, rig);
  r.renderCharacterSprite(rig, I, I, I, 8, 8);   // the sprite pass draws the rig to its own target: no record
  assert.equal(r.shadows.count, 1, 'the sprite pass is not a caster');
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  const rigDraws = calls.filter((c) => c[0] === 'drawArrays' && c[1] === 4 && c[2] === 0 && c[3] === 3);
  assert.equal(rigDraws.length, SHADOW_CASCADES.length, 'the visible range once per cascade');
  assert.equal(calls.filter((c) => c[0] === 'drawArrays' && c[1] === 4 && c[2] === 3 && c[3] === 3).length, 0, 'the hidden range never');
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uSunTexel' && c[2].length === 4 && near(c[2][0], 24 / 2048) && near(c[2][1], 96 / 2048) && near(c[2][2], 480 / 2048)), 'the three texels up');
  assert.ok(calls.some((c) => c[0] === 'uniformMatrix4fv' && c[1] === 'uSunVP' && c[3].length === 48), 'three cascades in one upload');
  // the water surface: the lane program and the maps
  calls.length = 0;
  r.drawWaterSurface({ vao: { id: 'w' }, indexCount: 6 }, I, { id: 'arr' }, { id: 'map' }, 6.4, { lift: 0.08, time: 0, windDir: [1, 0], windStrength: 0, rain: 0, scroll: 0, zenith: new Float32Array(3), horizon: new Float32Array(3), tint: new Float32Array(3), opacity: 0.9, f0: 0.02, shoreSoft: 0.16 });
  assert.ok(calls.some((c) => c[0] === 'useProgram' && c[1] === r.waterSurfaceProgramLane), 'the lane\'s water program');
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uSunShadow' && c[2] === 13), 'the sun map on its unit for the water');
  r.setLightingLane(null);
  calls.length = 0;
  r.drawWaterSurface({ vao: { id: 'w' }, indexCount: 6 }, I, { id: 'arr' }, { id: 'map' }, 6.4, { lift: 0.08, time: 0, windDir: [1, 0], windStrength: 0, rain: 0, scroll: 0, zenith: new Float32Array(3), horizon: new Float32Array(3), tint: new Float32Array(3), opacity: 0.9, f0: 0.02, shoreSoft: 0.16 });
  assert.ok(calls.some((c) => c[0] === 'useProgram' && c[1] === r.waterSurfaceProgram) && !calls.some((c) => c[1] === 'uSunShadow'), 'classic: the classic program, no map');
  assert.ok(ShadowPass);
});
