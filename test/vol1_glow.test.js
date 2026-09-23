// VOL1 / BOUNCE1 (2026-09-23, Mac: "Continue" - the second arc's last step): THE LANTERNS' GLOW THROUGH THEIR
// SHADOWS, AND THEIR BOUNCE.
//
// EL1's glow was one closed-form integral per lantern per FRAGMENT in every world shader, unshadowed - a lamp behind
// a pillar glowed through it. The glow is the air pass's now (airPass.js VOL_FS): at the bloom's size, each lantern's
// overlap with the view ray is walked in AIR_VOL_STEPS jittered steps through the lantern's own cube map (one tap,
// pointShadowOne), a lantern with no map keeping the closed form; the sum is tonemapped as elFinish tonemaps it,
// blurred once and added at the resolve; the lane's own glow is 0 on a world frame the air pass glows for and stands
// elsewhere (a panel, a sprite pass, the door shut). BOUNCE1: a lantern's light comes back off the ground - one
// bounce, unshadowed, EL_BOUNCE of its attenuated colour, most on what faces down; a flat takes a wall's half share.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, EL_GLSL, EL_TONEMAP_GLSL, EL_SCATTER_GLSL, EL_BOUNCE, EL_BOUNCE_REACH, EL_BB_FS, EL_MESH_FS, bounceOn, volumetricsOn } from '../src/render/enhancedLighting.js';
import { AIR_VOL_STEPS, AIR_VOL_BLUR_SHARE } from '../src/render/airPass.js';
import { SHADOW_GLSL } from '../src/render/shadowPass.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, READ_FRAMEBUFFER: 36008, DRAW_FRAMEBUFFER: 36009, FRAMEBUFFER: 36160 };
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
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? a.slice() : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
const count = (calls, name) => calls.filter((c) => c[0] === name).length;
const last1f = (calls, name) => { const c = calls.filter((x) => x[0] === 'uniform1f' && x[1] === name); return c.length ? c[c.length - 1][2] : undefined; };

test('VOL1: the march by source - the air pass builds the glow from the lane\'s curve and integral and the shadow block handed in (still a leaf), walks each caster\'s overlap in AIR_VOL_STEPS jittered steps through pointShadowOne, keeps the closed form for a lantern with no map, tonemaps as elFinish does, blurs once and adds at the resolve (mutants: the shadow tap dropped; the closed form for every light; the glow unblurred; the resolve not adding it)', () => {
  assert.equal(AIR_VOL_STEPS, 8);
  const a = rd('src/render/airPass.js');
  assert.ok(!/from '\.\/renderer\.js'/.test(a) && !/from '\.\/enhancedLighting\.js'/.test(a) && !/from '\.\/shadowPass\.js'/.test(a), 'a leaf still');
  const fs = a.slice(a.indexOf('const volFs = ('), a.indexOf('const BOX_FS = `'));
  assert.match(fs, /const volFs = \(\{ shadow, tonemap, scatter \}, maxLights\) => `#version 300 es/);
  assert.match(fs, /\$\{shadow\}\n\$\{tonemap\}\n\$\{scatter\}/, 'the three blocks handed in');
  assert.match(fs, /vec3 vd = vec3\(ndc\.x \/ uProjInfo\.x, ndc\.y \/ uProjInfo\.y, -1\.0\);/, 'the view ray through the pixel, posAt\'s own terms');
  assert.match(fs, /vec3 dir = uViewRot \* \(vd \/ vlen\);\n  float dist = viewDist\(depthAt\(vUV\)\) \* vlen;/, 'into the world, to the surface\'s distance along the ray');
  assert.match(fs, /if \(length\(rel\) > dist \+ range\) continue;/, 'EL6\'s early-out');
  assert.match(fs, /int k = uCasterOf\[i\];\n    if \(k < 0\) \{ acc \+= elScatter\(rel, range, dir, dist\) \* uPointColors\[i\]; continue; \}/, 'no map: the closed form');
  assert.match(fs, /float h2 = max\(dot\(hv, hv\), 0\.0625\);/, 'the closed form\'s own floor on h (0.25 squared)');
  assert.match(fs, /for \(int s = 0; s < \$\{AIR_VOL_STEPS\}; s\+\+\) \{\n      float t = ta \+ \(float\(s\) \+ jitter\) \* dt;\n      float ds = t - t0;\n      sum \+= pointShadowOne\(k, uCamPos \+ dir \* t\) \/ \(h2 \+ ds \* ds\);/, 'the march: the same integrand, through the cube, jittered');
  assert.match(fs, /float jitter = bayer4\(gl_FragCoord\.xy\);/, 'the ordered jitter the blur averages');
  assert.match(fs, /outColor = vec4\(airEncode\(elTonemapRGB\(acc \* uScatter \* uExposure \* elAdapt\(\)\)\), 1\.0\);/, 'tonemapped as elFinish tonemaps the glow it adds');
  // the shadow block's air tap
  assert.match(SHADOW_GLSL, /float pointShadowOne\(int k, vec3 wp\) \{\n  vec4 P = uPointShadowParams\[k\];\n  float far = P\.w;\n  if \(far <= 0\.0\) return 1\.0;\n  vec3 d = wp - P\.xyz;/, 'one tap, no normal');
  assert.match(SHADOW_GLSL, /return texture\(uPointShadow, vec4\(uv, float\(k \* 6 \+ face\), cubeDepthOfM\(m - 0\.04, far\)\)\);\n\}/, 'the world-unit bias (AUDIT-EL F15), the face\'s layer');
  // the pass
  assert.match(a, /vol: color\(bw, bh\), volB: color\(bw, bh\),/, 'at the bloom\'s size, with the blur\'s other half');
  assert.match(a, /vol: opts\.glsl \? P\(QUAD_VS, volFs\(opts\.glsl, opts\.maxLights \?\? 48\), \['uDepth', 'uProjInfo', 'uRect', 'uCanvas', 'uCamPos', 'uViewRot', 'uPointLights', 'uPointColors', 'uPointCount', 'uScatter', 'uExposure', 'uAdapt'\]\) : null,/);
  assert.match(a, /gl\.uniform1f\(this\.programs\.box\.uStrength, this\.aoParams\[1\]\);[^\n]*\n\s*gl\.drawArrays\(gl\.TRIANGLE_STRIP, 0, 4\);\n\s*\/\/ 1b\. VOL1[^\n]*\n\s*this\._volumetrics\(f, sp, quad, depthOn\);/, 'after the AO\'s blur, before the bloom source');
  assert.match(a, /const on = !!P\.vol && this\.volOn && n > 0 && f\.scatter > 0 && !!sp;/, 'the door, a lantern, an air with a density, the pass');
  assert.match(a, /sp\.upload\(P\.vol\.shadow\);/, 'the cube maps and the caster table');
  assert.match(a, /quad\(P\.volBlur, T\.volB\);\n\s*depthOn\(P\.volBlur\);/, 'blurred once, by depth (a plain blur put the air past a wall\'s edge onto the wall)');
  assert.equal(AIR_VOL_BLUR_SHARE, 0.15);
  assert.match(a, /float w = abs\(viewDist\(depthAt\(uv\)\) - here\) <= here \* \$\{AIR_VOL_BLUR_SHARE\} \? 1\.0 : 0\.0;/, 'a tap counts while its ray reaches within the share of the centre\'s distance');
  assert.match(a, /volBlur: P\(QUAD_VS, VOLBLUR_FS, \['uSrc', 'uTexel', 'uDepth', 'uProjInfo', 'uRect', 'uCanvas'\]\),/);
  assert.match(a, /c \+= airDecode\(texture\(uVol, wuv\)\.rgb\);   \/\/ VOL1/, 'added at the resolve, display-linear');
  assert.match(a, /gl\.activeTexture\(gl\.TEXTURE4\); gl\.bindTexture\(gl\.TEXTURE_2D, T\.volB\.tex\); gl\.uniform1i\(P\.resolve\.uVol, 4\);/, 'the blurred image');
  // the renderer hands the blocks over and the frame's gain and exposure
  const r = rd('src/render/renderer.js');
  assert.match(r, /glsl: \{ shadow: SHADOW_GLSL, tonemap: this\._lane\.tonemapGlsl, scatter: this\._lane\.scatterGlsl \}, maxLights: this\.maxPointLights \}\);/);
  assert.match(r, /scatter: this\._scatterGain\(\), exposure: this\._exposure,/, 'in prepare');
  assert.match(r, /gl\.uniform1f\(scLoc, this\._airGlows\(\) \? 0 : this\._scatterGain\(\)\);/, 'the lane\'s own glow is 0 where the air pass glows');
  assert.match(r, /_airGlows\(\) \{ return !!this\._air && this\._volumetricsWanted !== false && this\._spriteDepth === 0 && this\._studioDepth === 0 && !this\._panelSaved; \}/, 'the contact block\'s own gate');
  assert.equal(EL_LANE.tonemapGlsl, EL_TONEMAP_GLSL); assert.equal(EL_LANE.scatterGlsl, EL_SCATTER_GLSL);
  assert.ok(EL_GLSL.includes(EL_TONEMAP_GLSL) && EL_GLSL.includes(EL_SCATTER_GLSL), 'the lane takes the same two blocks - one curve, one integral');
});

test('VOL1: on the fake GL - a world frame with a lantern in a fogged air marches the glow (the shader built from the lane\'s blocks: pointShadowOne, elTonemapRGB and elScatter in its source), blurs it and adds it; the lane\'s uELScatter is 0 on that frame and the gain in a panel; the door shut clears the image and hands the glow back to the lane (mutants: the door ignored; the lane\'s glow left on under the air; the gain dropped from prepare)', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  const ap = r.air;
  assert.ok(ap.programs.vol, 'the program, with the lane\'s blocks in hand');
  const sources = calls.filter((c) => c[0] === 'shaderSource').map((c) => c[2]);
  const vol = sources.find((s) => s.includes('uniform mat3 uViewRot;'));
  assert.ok(vol && vol.includes('float pointShadowOne(int k, vec3 wp)') && vol.includes('vec3 elTonemapRGB(vec3 c)') && vol.includes('float elScatter(vec3 L, float range, vec3 dir, float dist)'), 'the three blocks, in the one shader');
  assert.equal(ap.volOn, true);
  r.textures.set('1_1', { id: 't' });
  r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0, new Float32Array([1, 1, 1]));
  r.setFog('exp', 0.03, 60, 180, new Float32Array([0.02, 0.02, 0.03]));
  const mesh = { vao: { id: 'vao' }, buffers: [], bounds: new Float32Array([0, 1, 0, 4]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const frame = () => { r.setPointLights(new Float32Array([0, 2, -3, 12]), new Float32Array([1, 0.8, 0.5])); calls.length = 0; r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME); r.drawMesh(mesh, I, null); const mid = calls.length; r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); return mid; };
  frame(); const mid = frame();
  assert.equal(ap.stats.vol, true, 'marched');
  const world = calls.slice(0, mid);
  assert.equal(last1f(world, 'uELScatter'), 0, 'the lane\'s own glow off on the world frame');
  const resolve = calls.slice(mid);
  assert.equal(count(resolve, 'uniformMatrix3fv'), 1, 'the view\'s rotation, transposed, once');
  assert.ok(resolve.some((c) => c[0] === 'uniform1f' && c[1] === 'uScatter' && c[2] > 0), 'the fog\'s gain');
  assert.ok(resolve.some((c) => c[0] === 'uniform1i' && c[1] === 'uPointCount' && c[2] === 1));
  assert.ok(resolve.some((c) => c[0] === 'uniform1i' && c[1] === 'uVol' && c[2] === 4), 'read by the resolve on unit 4');
  assert.equal(resolve.filter((c) => c[0] === 'uniform2f' && c[1] === 'uDir').length, 4, 'the bloom\'s four gauss passes - the glow\'s blur is its own');
  assert.equal(resolve.filter((c) => c[0] === 'uniform2f' && c[1] === 'uTexel').length, 2, 'the AO\'s tile blur and the glow\'s');
  // a panel: the lane glows for itself
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => {
    calls.length = 0;
    r.setPointLights(new Float32Array([0, 2, -3, 12]), new Float32Array([1, 1, 1]));
    r.drawMesh(mesh, I, null);
    assert.equal(r._airGlows(), false, 'a panel: the air pass draws no glow there, so the lane keeps its own (the gate; the value rides it by source above)');
  });
  // the door shut
  r.setVolumetrics(false);
  assert.equal(ap.volOn, false);
  const mid2 = frame();
  assert.equal(ap.stats.vol, false, 'not marched');
  assert.ok(last1f(calls.slice(0, mid2), 'uELScatter') > 0, 'the lane glows for itself again');
  assert.equal(calls.slice(mid2).filter((c) => c[0] === 'uniform2f' && c[1] === 'uTexel').length, 1, 'the AO\'s tile blur alone');
  assert.ok(!calls.slice(mid2).some((c) => c[0] === 'uniform1i' && c[1] === 'uPointCount'), 'the march not drawn');
  assert.equal(volumetricsOn('?volumetrics=off'), false); assert.equal(volumetricsOn(''), true);
  assert.match(rd('src/render/enhancedLighting.js'), /renderer\.setVolumetrics\?\.\(volumetricsOn\(search\)\); renderer\.setBounce\?\.\(bounceOn\(search\)\);/, 'the doors, at the lane\'s install');
});

test('BOUNCE1: a lantern\'s light comes back off the ground - EL_BOUNCE of its attenuated colour in the lit loop, through the lantern\'s shadow read a REACH off the surface (a wall between rooms stays dark, a pillar\'s back fills), most on what faces down (0.5 - 0.5 n.y), a flat taking a wall\'s half through its base\'s own shadow; the renderer uploads the share on the lane and 0 behind the door; the classic set declares none (mutants: the bounce read at the surface; unshadowed; the weight dropped; the door ignored)', () => {
  assert.equal(EL_BOUNCE, 0.18); assert.equal(EL_LANE.bounce, EL_BOUNCE); assert.equal(EL_BOUNCE_REACH, 1.5);
  assert.match(EL_GLSL, /uniform float uELBounce;/);
  assert.match(EL_MESH_FS, /float attOpen = elAttenuation\(d, uPointLights\[i\]\.w\);\n    float att = sh \* attOpen;\n    acc \+= att \* \(max\(dot\(n, Ln\), 0\.0\) \+ spec\) \* uPointColors\[i\];\n    float bsh = k >= 0 \? pointShadowOne\(k, wp \+ n \* 1\.5\) : 1\.0;[^\n]*\n    acc \+= uELBounce \* bsh \* attOpen \* \(0\.5 - 0\.5 \* n\.y\) \* uPointColors\[i\];/, 'the bounce: the lantern\'s shadow a reach off the surface (not the surface\'s own sh), the open attenuation, weighted by facing the ground');
  assert.match(EL_BB_FS, /acc \+= sh \* \(1\.0 \+ uELBounce \* 0\.5\) \* attOpen \* uPointColors\[i\];/, 'a flat: the wall\'s half, through its base\'s shadow');
  assert.equal(bounceOn('?bounce=off'), false); assert.equal(bounceOn(''), true);
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  const mesh = { vao: { id: 'vao' }, buffers: [], bounds: new Float32Array([0, 1, 0, 4]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  r.textures.set('1_1', { id: 't' });
  const draw = () => { calls.length = 0; r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME); r.drawMesh(mesh, I, null); r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); return last1f(calls, 'uELBounce'); };
  assert.equal(draw(), undefined, 'the classic set never speaks of it');
  r.setLightingLane(EL_LANE);
  assert.equal(draw(), EL_BOUNCE, 'the lane: the share');
  r.setBounce(false);
  assert.equal(draw(), 0, 'behind the door: none');
  r.setBounce(true);
  assert.equal(draw(), EL_BOUNCE);
});
