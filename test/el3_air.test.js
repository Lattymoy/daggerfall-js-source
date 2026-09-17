// EL3 - ENHANCED LIGHTING, TIER THREE: DEPTH AND AIR (2026-09-17, Mac:
// "enhance our lighting system tenfold" - tiers 1, 2 and 3).
//
// render/airPass.js: a depth image of the world from the camera (the
// shadow pass's records replayed under the camera's view-projection), and
// off it the ambient occlusion the lane's shaders multiply their ambient
// by, the bloom sourced from the emitters and the lanterns' glares, and
// the sun's shafts - composited by the frame's first screen-space draw.
// The reconstruction, the sun's screen position, the kernel and the glare
// are pure and pinned; the lifecycle is pinned on the fake GL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  airOn, AIR_AO_SCALE, AIR_BLOOM_SCALE, AIR_AO_RADIUS, AIR_AO_SAMPLES, AIR_AO_STRENGTH, AIR_AO_BIAS, AIR_BLOOM_STRENGTH,
  AIR_GLARE_SIZE, AIR_SHAFT_TAPS, AIR_SHAFT_DECAY, AIR_SHAFT_STRENGTH, AIR_SHAFT_REACH, AIR_AO_UNIT,
  projInfo, viewDepth, sunScreenUV, aoKernel, glareSize, AIR_AO_GLSL, EMIT_MESH_FS, EMIT_BB_FS, AirPass,
} from '../src/render/airPass.js';
import { EL_LANE, EL_MESH_FS, EL_BB_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_FAR_RING_FS } from '../src/render/enhancedLighting.js';
import { SHADOW_SUN_UNIT, SHADOW_POINT_UNIT } from '../src/render/shadowPass.js';
import { Renderer, CLOUD_SHADOW_UNIT } from '../src/render/renderer.js';
import { perspective, mirrorProjectionX, lookAt, transformPoint } from '../src/world/mat4.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** the first kernel sample the fixed seed produces - a page that seeds otherwise draws other noise */
const KERNEL_FIRST = [0.058618783950805664, 0.0077914586290717125, 0.00815090537071228];

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE_CUBE_MAP_POSITIVE_X: 100, TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, FRAMEBUFFER: 7, TRIANGLE_STRIP: 5, drawingBufferWidth: 320, drawingBufferHeight: 200, ONE: 1, SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771 };
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

function drawWorld(r) {
  r.textures.set('1_1', { id: 't11' }); r.textures.set('210_1', { id: 't2101' });
  r.emissionTextures.set('210_1', { id: 'e2101' });
  const mesh = { vao: { id: 'vao-m' }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const surface = { vao: { id: 'vao-t' }, indexCount: 6 };
  const batch = { archive: 210, record: 1, vao: { id: 'vao-b' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [1, 0, 1] };
  const plain = { archive: 210, record: 2, vao: { id: 'vao-p' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [2, 0, 1] };   // no emission map: nothing to bloom
  r.textures.set('210_2', { id: 't2102' });
  r.drawMesh(mesh, I, null);
  r.drawTerrain(surface, I, {}, {}, 6.4);
  r.drawBillboards([batch, plain], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
  return { mesh, surface, batch };
}

test('EL3: the door and the constants - ?air=off, the two scales, the AO\'s radius, count, strength and bias, the bloom and shaft gains, the unit below the shadow maps', () => {
  assert.equal(airOn(''), true); assert.equal(airOn('?air=off'), false); assert.equal(airOn('?air=on'), true);
  assert.equal(AIR_AO_SCALE, 0.5); assert.equal(AIR_BLOOM_SCALE, 0.25);
  assert.equal(AIR_AO_RADIUS, 0.8); assert.equal(AIR_AO_SAMPLES, 12); assert.equal(AIR_AO_STRENGTH, 1); assert.equal(AIR_AO_BIAS, 0.02);
  assert.equal(AIR_BLOOM_STRENGTH, 0.6); assert.equal(AIR_GLARE_SIZE, 0.35);
  assert.equal(AIR_SHAFT_TAPS, 32); assert.equal(AIR_SHAFT_DECAY, 0.96); assert.equal(AIR_SHAFT_STRENGTH, 0.35); assert.equal(AIR_SHAFT_REACH, 0.35);
  assert.equal(AIR_AO_UNIT, 12); assert.ok(AIR_AO_UNIT < SHADOW_SUN_UNIT && SHADOW_SUN_UNIT < SHADOW_POINT_UNIT && SHADOW_POINT_UNIT < CLOUD_SHADOW_UNIT, 'four reserved units, in a row');
  assert.ok(near(glareSize(18), 0.35 * Math.sqrt(18))); assert.equal(glareSize(-1), 0); assert.equal(glareSize(0), 0);
});

test('EL3: the depth reconstruction undoes the renderer\'s perspective, mirrored or not - the four numbers and the view depth against the matrix itself', () => {
  for (const mirror of [false, true]) {
    let proj = perspective(1.1, 1.6, 0.5, 6000);
    if (mirror) proj = mirrorProjectionX(proj);
    const info = projInfo(proj);
    assert.deepEqual([...info], [proj[0], proj[5], proj[10], proj[14]]);
    for (const z of [-0.6, -3, -40, -1500, -5990]) {
      // a view-space point at depth z projects to NDC z; the reconstruction gives z back
      const p = transformPoint(proj, 0.7, -0.2, z);
      const w = proj[3] * 0.7 + proj[7] * -0.2 + proj[11] * z + proj[15];
      const zNdc = p[2] / w;
      assert.ok(near(viewDepth(zNdc, info[2], info[3]), z, Math.abs(z) * 1e-5), `depth ${z} (mirror ${mirror}): ${viewDepth(zNdc, info[2], info[3])}`);
      // ...and the shader's xy reconstruction (ndc * (-z) / focal) lands on the point, mirror included
      const xNdc = p[0] / w, yNdc = p[1] / w;
      assert.ok(near(xNdc * (-z) / info[0], 0.7, 1e-4) && near(yNdc * (-z) / info[1], -0.2, 1e-4), `xy at ${z} (mirror ${mirror})`);
    }
  }
  assert.match(read('src/render/airPass.js'), /float vz = -uProjInfo\.w \/ \(z \+ uProjInfo\.z\);/, 'the GLSL is the same arithmetic');
  assert.match(read('src/render/airPass.js'), /return vec3\(ndc\.x \* \(-vz\) \/ uProjInfo\.x, ndc\.y \* \(-vz\) \/ uProjInfo\.y, vz\);/);
  assert.match(read('src/render/airPass.js'), /if \(dot\(n, -p\) < 0\.0\) n = -n;/, 'the normal faces the eye whatever the mirror did to the derivatives');
});

test('EL3: the sun\'s screen position - the centre when looked at, off-centre the way it should be, null behind the camera; a directional light is a point at infinity', () => {
  const proj = mirrorProjectionX(perspective(1.0, 1.5, 0.5, 6000));
  const eye = [10, 5, 10];
  // looking north (+z, Daggerfall's north) straight at a sun on the horizon
  let view = lookAt(eye, [10, 5, 20], [0, 1, 0]);
  let uv = sunScreenUV(proj, view, [0, 0, 1]);
  assert.ok(uv && near(uv[0], 0.5, 1e-6) && near(uv[1], 0.5, 1e-6), `dead centre: ${uv}`);
  // a sun above the view direction lands above the centre
  uv = sunScreenUV(proj, view, [0, Math.sin(0.3), Math.cos(0.3)]);
  assert.ok(uv && near(uv[0], 0.5, 1e-6) && uv[1] > 0.5, `above: ${uv}`);
  // a sun to world +x (east) lands screen-RIGHT of a camera facing north
  // under the mirrored projection - Unity's own presentation (the
  // handedness law in world/mat4.js)
  uv = sunScreenUV(proj, view, [Math.sin(0.3), 0, Math.cos(0.3)]);
  assert.ok(uv && uv[0] > 0.5, `east is screen right facing north: ${uv}`);
  // behind the camera: none
  assert.equal(sunScreenUV(proj, view, [0, 0, -1]), null);
  assert.equal(sunScreenUV(proj, view, [0, 0.2, -0.98]), null);
  // the far point is the direction's, not the eye's: a moved eye gives the same uv
  view = lookAt([-300, 80, 900], [-300, 80, 910], [0, 1, 0]);
  uv = sunScreenUV(proj, view, [0, Math.sin(0.3), Math.cos(0.3)]);
  assert.ok(uv && near(uv[0], 0.5, 1e-6) && uv[1] > 0.5);
});

test('EL3: the kernel - twelve samples in the +z hemisphere, inside the unit ball, denser near the origin, the same on every page', () => {
  const k = aoKernel();
  assert.equal(k.length, 36);
  let firstHalf = 0, secondHalf = 0;
  for (let i = 0; i < 12; i++) {
    const x = k[i * 3], y = k[i * 3 + 1], z = k[i * 3 + 2];
    assert.ok(z >= 0, `sample ${i} above the surface`);
    const l = Math.hypot(x, y, z);
    assert.ok(l <= 1 + 1e-9 && l > 0, `sample ${i} inside the ball and not the origin`);
    if (i < 6) firstHalf += l; else secondHalf += l;
  }
  assert.ok(firstHalf < secondHalf, 'the early samples sit nearer the origin');
  assert.deepEqual([...aoKernel()], [...k], 'deterministic');
  assert.ok(near(k[0], aoKernel(12)[0]));
  assert.ok(near(k[0], KERNEL_FIRST[0], 1e-6) && near(k[1], KERNEL_FIRST[1], 1e-6) && near(k[2], KERNEL_FIRST[2], 1e-6), `the fixed seed's first sample: ${k[0]}, ${k[1]}, ${k[2]}`);
});

test('EL3: the receiver block and the shaders - the AO by screen position, off at width 0; the three lit lane shaders multiply their ambient alone; the flat and the ring take none; the emission shaders', () => {
  assert.match(AIR_AO_GLSL, /uniform sampler2D uAO;\nuniform vec4 uAOInfo;/);
  assert.match(AIR_AO_GLSL, /if \(uAOInfo\.z <= 0\.0\) return 1\.0;/);
  assert.match(AIR_AO_GLSL, /vec2 uv = \(gl_FragCoord\.xy - uAOInfo\.xy\) \/ uAOInfo\.zw;/);
  assert.ok(EL_MESH_FS.includes(AIR_AO_GLSL) && EL_TERRAIN_FS.includes(AIR_AO_GLSL) && EL_CHAR_FS.includes(AIR_AO_GLSL));
  assert.match(EL_MESH_FS, /: uAmbient\) \* aoAt\(\);/, 'the mesh: the whole ambient (flat or trilight) under the AO');
  assert.match(EL_TERRAIN_FS, /tex \* \(uAmbient \* aoAt\(\) \+ uSunColor/); assert.match(EL_CHAR_FS, /albedo \* \(uAmbient \* aoAt\(\) \+ uSunColor/);
  for (const fs of [EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS]) assert.equal((fs.match(/\* aoAt\(\)/g) || []).length, 1, 'once: the sun and the lanterns keep their light');
  assert.ok(!EL_BB_FS.includes('aoAt') && !EL_FAR_RING_FS.includes('aoAt'), 'a flat and the ring take no AO');
  assert.equal(EL_LANE.air, true);
  assert.match(EMIT_MESH_FS, /texture\(uEmissionTex, vUV\)\.rgb \* uEmissionColor/);
  assert.match(EMIT_BB_FS, /if \(texture\(uTex, vUV\)\.a < 0\.5\) discard;/);
  const a = read('src/render/airPass.js');
  assert.match(a, /vis = \(ndc\.z \* 0\.5 \+ 0\.5\) <= d \+ 0\.002 \? 1\.0 : 0\.0;/, 'a glare hides behind the depth image');
  assert.match(a, /float sky = texture\(uDepth, uv\)\.r >= 0\.99999 \? 1\.0 : 0\.0;/, 'the shafts\' mask is the sky');
  assert.equal((a.match(/gl\.blendFunc\(gl\.ONE, gl\.ONE\);/g) || []).length, 2, 'additive: the bloom source and the composite');
  assert.ok(!/from '\.\/renderer\.js'/.test(a) && !/from '\.\/enhancedLighting\.js'/.test(a) && !/from '\.\/shadowPass\.js'/.test(a), 'a leaf');
});

test('EL3: the renderer builds the pass with the lane behind the door, sizes the images to the world viewport, draws them after the shadow maps and before the clear, composites on the first screen quad, and uploads the receiver', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  assert.equal(r.air, null, 'the lane alone: the door is the page\'s');
  const beforeAir = count(calls, 'compileShader');
  r.setAir(true);
  const ap = r.air;
  assert.ok(ap instanceof AirPass);
  assert.equal(count(calls, 'compileShader') - beforeAir, 16, 'eight programs: ao, box, gauss, shaft, composite, two emitters, the glare');
  r.setAir(false); assert.equal(r.air, null);
  r.setAir(true); assert.equal(r.air, ap, 'kept');
  r.setLightingLane(null); assert.equal(r.air, null, 'no lane, no air');
  r.setLightingLane(EL_LANE); assert.equal(r.air, ap, 'the lane back, the air back');
  // frame 1: nothing to replay yet, the images are allocated for the canvas
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  const sun = new Float32Array([0.3, 0.8, -0.2]);   // in front of an eye at the origin looking down -z (the identity view)
  const P = mirrorProjectionX(perspective(1, 1.6, 0.5, 6000));   // a real projection: the shafts want the sun's screen position
  calls.length = 0;
  r.beginFrame(P, I, sun);
  assert.equal(ap.width, 320); assert.equal(ap.height, 200);
  assert.equal(ap.targets.ao.w, 160); assert.equal(ap.targets.bloom.w, 80); assert.equal(ap.targets.depth.w, 320);
  assert.equal(calls.filter((c) => c[0] === 'texStorage2D').length, 1, 'the depth image');
  assert.equal(ap.pending, true, 'a composite is owed');
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uAO' && c[2] === AIR_AO_UNIT), 'the receiver\'s unit');
  const info = calls.find((c) => c[0] === 'uniform4fv' && c[1] === 'uAOInfo');
  assert.deepEqual([...info[2]], [0, 0, 320, 200], 'the viewport');
  drawWorld(r);
  // frame 2: the shadow maps, then the air's images (depth, ao, box, bloom source, gauss x4, shaft), then the clear
  calls.length = 0;
  r.setPointLights(new Float32Array([5, 2, 1, 14, 3, 3, 3, 0]), new Float32Array([1, 0.7, 0.4]));   // and a rangeless light, which glares not
  r.beginFrame(P, I, sun);
  const firstClear = calls.findIndex((c) => c[0] === 'clear' && c[1] === 16384 + 256);
  const before = calls.slice(0, firstClear);
  const depthClears = before.filter((c) => c[0] === 'clear' && c[1] === 256);
  assert.equal(depthClears.length, 3, 'two cascades, then the depth image');
  assert.equal(r.shadows.count, 0, 'the records are spent after both passes');
  assert.equal(ap.stats.emitDraws, 1, 'the flat with an emission map alone; the plain flat and the mesh (no mask resolved yet) emit nothing');
  assert.equal(ap.stats.glares, 1, 'one lantern');
  const targets = ap.targets;
  assert.equal(ap.stats.shafts, true, 'the sun is up');
  assert.equal(before.filter((c) => c[0] === 'drawArrays' && c[1] === 5).length, 1 + 1 + 4 + 1 + 1, 'ao, box, four gauss, the shaft, and one glare quad');
  const vpCalls = before.filter((c) => c[0] === 'viewport');
  assert.ok(vpCalls.some((c) => c[1] === 0 && c[3] === 160 && c[4] === 100), 'the AO at half');
  assert.ok(vpCalls.some((c) => c[3] === 80 && c[4] === 50), 'the bloom at a quarter');
  assert.deepEqual(vpCalls.at(-1).slice(1), [0, 0, 320, 200], 'the world viewport comes back before the frame');
  const lastBind = before.map((c, i) => [c, i]).filter(([c]) => c[0] === 'bindFramebuffer').at(-1);
  assert.equal(lastBind[0][2], null, 'the canvas is back');
  assert.ok(before.some((c) => c[0] === 'clearColor' && c[1] === 0 && c[2] === 0) && before.at(-1)[0] !== 'clearColor', 'the bloom target cleared black...');
  const lastClearColor = before.filter((c) => c[0] === 'clearColor').at(-1);
  assert.ok(near(lastClearColor[1], 0.53, 1e-3), '...and the frame\'s clear colour restored');
  // the first screen quad composites, once, and hands the 2D pass the full canvas
  calls.length = 0;
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  const comp = calls.findIndex((c) => c[0] === 'uniform2fv' && c[1] === 'uGain');
  assert.ok(comp >= 0, 'the composite drew');
  assert.ok(near(calls[comp][2][0], AIR_BLOOM_STRENGTH, 1e-6) && calls[comp][2][1] === 1, 'the bloom gain and the shafts\' (a float32 upload)');
  assert.ok(calls.some((c, i) => i > comp && c[0] === 'viewport' && c[3] === 320 && c[4] === 200), 'the full canvas after');
  assert.deepEqual(calls.filter((c) => c[0] === 'blendFunc').map((c) => [c[1], c[2]]), [[1, 1]], 'additive, ONE ONE');
  assert.equal(ap.pending, false);
  calls.length = 0;
  r.drawScreenQuad({ id: 'ui2' }, { x: 0, y: 0, w: 10, h: 10 });
  assert.ok(!calls.some((c) => c[0] === 'uniform2fv' && c[1] === 'uGain'), 'once a frame');
  // indoors at night: no shafts; the door closed: no render, no composite owed
  r.setLighting(new Float32Array([0.12, 0.12, 0.12]), 0);
  drawWorld(r);
  r.beginFrame(I, I, new Float32Array([0.45, 0.8, 0.35]));
  assert.equal(ap.stats.shafts, false);
  assert.equal(ap.targets, targets, 'the images are kept while the viewport keeps its size');
  r.setAir(false);
  assert.equal(ap.pending, false, 'closing the door owes nothing');
  drawWorld(r);
  calls.length = 0;
  r.beginFrame(P, I, sun);
  assert.ok(!calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uAOInfo'), 'no receiver upload with the air off');
  assert.equal(calls.filter((c) => c[0] === 'clear' && c[1] === 256).length, 6, 'the shadow maps alone (indoors now: the cube\'s six faces, no depth image)');
  // a panel frame draws no image and drops the records
  r.setAir(true);
  drawWorld(r);
  calls.length = 0;
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => {
    assert.equal(r.shadows.count, 0);
  });
  assert.ok(!calls.some((c) => c[0] === 'uniform2fv' && c[1] === 'uGain'), 'no composite inside a panel');
});

test('EL3: the renderer\'s wiring - the air rides the lane and the door, the composite hook sits on both screen-quad entry points, the record carries the flat\'s basis', () => {
  const r = read('src/render/renderer.js');
  assert.match(r, /const want = this\._airWanted && !!this\._lane\?\.air && !!this\._shadows;/);
  assert.equal((r.match(/this\._compositeAir\(\);   \/\/ EL3/g) || []).length, 2, 'drawScreenQuad and drawScreenQuadRun');
  assert.match(r, /if \(this\._air\) this\._air\.upload\(this\._el\[key\]\.ao\);/);
  assert.match(r, /this\._shadows\.recordBillboards\(batches, this\._flatWind, camRight, camUp\);/);
  const sp = read('src/render/shadowPass.js');
  assert.match(sp, /r\.right\.set\(camRight\); r\.up\.set\(camUp\);/);
  assert.ok(!/this\.discard\(\);\n  \}\n\n  \/\*\* One map's worth/.test(sp), 'the shadow pass no longer drops the records itself - the renderer does, after the air');
  assert.match(read('src/render/enhancedLighting.js'), /renderer\.setAir\(airOn\(search\)\)/, 'the door is read at the one sync');
  const f = read('src/systems/features.js');
  assert.match(f, /shadows, ambient occlusion in the corners, bloom on windows and flames, and '\n\s+\+ 'shafts of sunlight\./, 'the row says what the three tiers do');
});
