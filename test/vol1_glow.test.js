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
import { EL_LANE, EL_GLSL, EL_TONEMAP_GLSL, EL_SCATTER_GLSL, EL_BB_FS, EL_MESH_FS, volumetricsOn } from '../src/render/enhancedLighting.js';
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
  assert.match(fs, /const volFs = \(\{ shadow, tonemap, scatter \}, maxLights, linear\) => `#version 300 es/, 'AUDIT VOL1: built for a float target or a byte one');
  assert.match(fs, /\$\{shadow\}\n\$\{tonemap\}\n\$\{scatter\}/, 'the three blocks handed in');
  assert.match(fs, /vec3 vd = vec3\(ndc\.x \/ uProjInfo\.x, ndc\.y \/ uProjInfo\.y, -1\.0\);/, 'the view ray through the pixel, posAt\'s own terms');
  assert.match(fs, /vec3 dir = uViewRot \* \(vd \/ vlen\);\n  float dist = viewDist\(depthAt\(vUV\)\) \* vlen;/, 'into the world, to the surface\'s distance along the ray');
  assert.match(fs, /if \(length\(rel\) > dist \+ range\) continue;/, 'EL6\'s early-out');
  assert.match(fs, /int k = uCasterOf\[i\];\n    if \(k < 0\) \{ acc \+= elScatter\(rel, range, dir, dist\) \* uPointColors\[i\]; continue; \}/, 'no map: the closed form');
  assert.match(fs, /float hraw = dot\(hv, hv\);\n    float chord = range \* range - hraw;\n    if \(chord <= 0\.0\) continue;\n    chord = sqrt\(chord\);\n    float h2 = max\(hraw, 0\.0625\);\n    float ta = max\(0\.0, t0 - chord\), tb = min\(dist, t0 \+ chord\);/, 'AUDIT VOL1: the ray\'s CHORD through the sphere (a miss walks nothing), the closed form\'s own floor on h (0.25 squared)');
  assert.match(EL_SCATTER_GLSL, /float chord = range \* range - h2;\n  if \(chord <= 0\.0\) return 0\.0;\n  chord = sqrt\(chord\);/, 'and the closed form over the same chord');
  assert.match(fs, /for \(int s = 0; s < \$\{AIR_VOL_STEPS\}; s\+\+\) \{\n      float t = ta \+ \(float\(s\) \+ jitter\) \* dt;\n      float ds = t - t0;\n      sum \+= casterShadowOne\(k, Lr, uCamPos \+ dir \* t\) \/ \(h2 \+ ds \* ds\);/, 'the march: the same integrand, through the cube (DISC15: of either tier), jittered');
  assert.match(fs, /float jitter = bayer4\(gl_FragCoord\.xy\);/, 'the ordered jitter the blur averages');
  assert.match(fs, /\$\{linear\n\s*\? 'outColor = vec4\(acc, 1\.0\);[^\n]*\n\s*: 'outColor = vec4\(airEncode\(elTonemapRGB\(acc \* uScatter \* uExposure \* elAdapt\(\)\)\), 1\.0\);/, 'AUDIT VOL1: linear light into a float target, the tile\'s blur averaging LIGHT and the tone pass curving the average once (per-pixel tonemapping before the blur dimmed a halo\'s core by a quarter); the old path where there is no float target');
  const tone = a.slice(a.indexOf('const volToneFs = '), a.indexOf('const VOLBLUR_FS = `'));
  assert.match(tone, /outColor = vec4\(airEncode\(elTonemapRGB\(texture\(uSrc, vUV\)\.rgb \* uScatter \* uExposure \* elAdapt\(\)\)\), 1\.0\);/, 'the tone pass: as elFinish tonemaps the glow it adds');
  // the shadow block's air tap
  assert.match(SHADOW_GLSL, /float pointShadowOne\(int k, vec3 wp\) \{\n  vec4 P = uPointShadowParams\[k\];\n  float far = P\.w;\n  if \(far <= 0\.0\) return 1\.0;\n  vec3 d = wp - P\.xyz;/, 'one tap, no normal');
  assert.match(SHADOW_GLSL, /return texture\(uPointShadow, vec4\(uv, float\(k \* 6 \+ face\), cubeDepthOfM\(m - 0\.04, far\)\)\);\n\}/, 'the world-unit bias (AUDIT-EL F15), the face\'s layer');
  // the pass
  assert.match(a, /vol: color\(bw, bh, this\.volLinear\), volB: color\(bw, bh, this\.volLinear\),/, 'at the bloom\'s size, linear where the GL has a float target');
  assert.match(a, /this\.targets\.volOut = this\.volLinear \? color\(bw, bh\) : this\.targets\.volB;/, 'the byte image the readers take');
  assert.match(a, /this\.volLinear = !!\(gl\.getExtension\('EXT_color_buffer_float'\) \|\| gl\.getExtension\('EXT_color_buffer_half_float'\)\);/);
  assert.match(a, /if \(linear\) gl\.texImage2D\(gl\.TEXTURE_2D, 0, gl\.RGBA16F, cw, ch, 0, gl\.RGBA, gl\.HALF_FLOAT, null\);/);
  assert.match(a, /try \{\n\s*const vol = P\(QUAD_VS, volFs\(opts\.glsl, opts\.maxLights \?\? 48, this\.volLinear\), \['uDepth', 'uProjInfo', 'uRect', 'uCanvas', 'uCamPos', 'uViewRot', 'uPointLights', 'uPointColors', 'uPointCount', 'uScatter', 'uExposure', 'uAdapt'\]\);\n\s*if \(this\.volLinear\) this\.programs\.volTone = P\(QUAD_VS, volToneFs\(opts\.glsl\), \['uSrc', 'uScatter', 'uExposure', 'uAdapt'\]\);/, 'built with the lane\'s blocks, the tone pass only with a float target');
  assert.match(a, /\} catch \(e\) \{\n\s*this\.programs\.vol = null; this\.programs\.volTone = null;/, 'a shader the GL refuses costs the glow alone');
  assert.match(a, /if \(this\.f && this\.fresh\) this\._images\(\);\n\s*else \{ this\._blank\(quad\); this\.measured = false; \}\n\s*this\.fresh = false;/, 'AUDIT VOL1: the images for a frame the pass was PREPARED for alone - a menu\'s frame gets black images (the last world frame\'s glow was painted over it)');
  assert.match(a, /for \(const t of \[T\.bloom, T\.shaft, T\.volOut\]\) \{ quad\(this\.programs\.box, t\); gl\.clear\(gl\.COLOR_BUFFER_BIT\); \}/, 'the three the resolve adds, black');
  assert.match(a, /this\.fresh = true;   \/\/ AUDIT VOL1/, 'set at prepare');
  assert.match(a, /vec3 c = airDecode\(texture\(uFrame, uv\)\.rgb\) \+ airDecode\(texture\(uVol, t\)\.rgb\);   \/\/ AUDIT VOL1/, 'the eye adapts to the glow it will see');
  assert.match(a, /vec3 c = airDecode\(texture\(uFrame, uv\)\.rgb\) \+ airDecode\(texture\(uVol, vUV\)\.rgb\);/, 'and the bright pass blooms a halo\'s core');
  assert.match(a, /gl\.uniform1f\(this\.programs\.box\.uStrength, this\.aoParams\[1\]\);[^\n]*\n\s*gl\.drawArrays\(gl\.TRIANGLE_STRIP, 0, 4\);\n\s*\/\/ 1b\. VOL1[^\n]*\n\s*this\._volumetrics\(f, sp, quad, depthOn\);/, 'after the AO\'s blur, before the bloom source');
  assert.match(a, /const on = !!P\.vol && this\.volOn && n > 0 && f\.scatter > 0 && !!sp;/, 'the door, a lantern, an air with a density, the pass');
  assert.match(a, /sp\.upload\(P\.vol\.shadow\);/, 'the cube maps and the caster table');
  assert.match(a, /quad\(P\.volBlur, T\.volB\);\n\s*depthOn\(P\.volBlur\);/, 'blurred once, by depth (a plain blur put the air past a wall\'s edge onto the wall)');
  assert.equal(AIR_VOL_BLUR_SHARE, 0.15);
  assert.match(a, /float w = abs\(viewDist\(depthAt\(uv\)\) - here\) <= here \* \$\{AIR_VOL_BLUR_SHARE\} \? 1\.0 : 0\.0;/, 'a tap counts while its ray reaches within the share of the centre\'s distance');
  assert.match(a, /volBlur: P\(QUAD_VS, VOLBLUR_FS, \['uSrc', 'uTexel', 'uDepth', 'uProjInfo', 'uRect', 'uCanvas'\]\),/);
  assert.match(a, /c \+= airDecode\(texture\(uVol, wuv\)\.rgb\);   \/\/ VOL1/, 'added at the resolve, display-linear');
  assert.match(a, /gl\.activeTexture\(gl\.TEXTURE4\); gl\.bindTexture\(gl\.TEXTURE_2D, T\.volOut\.tex\); gl\.uniform1i\(P\.resolve\.uVol, 4\);/, 'the tonemapped image');
  assert.match(a, /if \(!on\) \{ quad\(P\.box, T\.volOut\); gl\.clearColor\(0, 0, 0, 1\); gl\.clear\(gl\.COLOR_BUFFER_BIT\);/, 'shut: the image the readers take, cleared');
  // the renderer hands the blocks over and the frame's gain and exposure
  const r = rd('src/render/renderer.js');
  assert.match(r, /glsl: \{ shadow: SHADOW_GLSL, tonemap: this\._lane\.tonemapGlsl, scatter: this\._lane\.scatterGlsl \}, maxLights: this\.maxPointLights \}\);/);
  assert.match(r, /scatter: this\._scatterGain\(\), exposure: this\._exposure,/, 'in prepare');
  assert.match(r, /gl\.uniform1f\(scLoc, this\._airGlows\(\) \? 0 : this\._scatterGain\(\)\);/, 'the lane\'s own glow is 0 where the air pass glows');
  assert.match(r, /_airGlows\(\) \{ return !!this\._air && this\._air\.fresh && this\._volumetricsWanted !== false && this\._spriteDepth === 0 && this\._studioDepth === 0 && !this\._panelSaved; \}/, 'the contact block\'s own gate, and the pass PREPARED for this frame (AUDIT VOL1: a frame that is not the world\'s keeps the lane\'s glow)');
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
  const vol = sources.find((s) => s.includes('uniform mat3 uViewRot;') && s.includes('uniform vec4 uPointLights['));   // VC7b: the shafts' shader takes the view's rotation too; the glow's alone walks the lanterns
  assert.ok(vol && vol.includes('float pointShadowOne(int k, vec3 wp)') && vol.includes('vec3 elTonemapRGB(vec3 c)') && vol.includes('float elScatter(vec3 L, float range, vec3 dir, float dist)'), 'the three blocks, in the one shader');
  assert.equal(ap.volOn, true);
  assert.equal(ap.volLinear, false, 'the fake GL has no float target: the byte path'); assert.equal(ap.programs.volTone, null); assert.equal(ap.targets, null);
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
  assert.equal(ap.targets.volOut, ap.targets.volB, 'the byte path: the blurred tonemapped image is the readers\' own');
  assert.ok(resolve.some((c) => c[0] === 'uniform1i' && c[1] === 'uVol' && c[2] === 2), 'read by the luminance and the bright pass on unit 2');
  assert.equal(ap.fresh, false, 'spent by the resolve');
  assert.ok(resolve.some((c) => c[0] === 'uniform1f' && c[1] === 'uScatter' && c[2] > 0), 'the fog\'s gain');
  assert.ok(resolve.some((c) => c[0] === 'uniform1i' && c[1] === 'uPointCount' && c[2] === 1));
  assert.ok(resolve.some((c) => c[0] === 'uniform1i' && c[1] === 'uVol' && c[2] === 4), 'read by the resolve on unit 4');
  assert.equal(resolve.filter((c) => c[0] === 'uniform2f' && c[1] === 'uDir').length, 4, 'the bloom\'s four gauss passes - the glow\'s blur is its own');
  assert.equal(resolve.filter((c) => c[0] === 'uniform2f' && c[1] === 'uTexel').length, 2, 'the AO\'s tile blur and the glow\'s');
  // a frame the pass was not prepared for (a menu's, a video's): black images, no measure, no march
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), 0);
  assert.equal(ap.fresh, false); assert.equal(r._airGlows(), false, 'the lane keeps its own glow on such a frame');
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  assert.equal(ap.stats.vol, false, 'not marched');
  assert.equal(calls.filter((c) => c[0] === 'clear' && c[1] === 16384).length >= 3, true, 'the bloom, the shafts and the glow cleared black');
  assert.equal(ap.measured, false, 'and the eye does not adapt to it');
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
  assert.match(rd('src/render/enhancedLighting.js'), /renderer\.setVolumetrics\?\.\(volumetricsOn\(search\)\);/, 'the door, at the lane\'s install');
});

test('BOUNCE1, WITHDRAWN BY ITS AUDIT: no bounce term anywhere - a per-lantern bounce with no visibility from the lit floor either leaks through walls (unshadowed, and every lantern past the eight has no map) or fills nothing (shadowed a reach off, a flat back is deeper in the umbra); the lit loops are EL1\'s own again, the lane declares no uELBounce, the doors are the glow\'s alone (mutant: the term back)', () => {
  for (const src of [EL_GLSL, EL_MESH_FS, EL_BB_FS]) assert.ok(!/uELBounce|EL_BOUNCE|bounce/i.test(src), 'no bounce in the lane\'s GLSL');
  assert.match(EL_MESH_FS, /float att = sh \* elAttenuation\(d, uPointLights\[i\]\.w\);\n    acc \+= att \* \(max\(dot\(n, Ln\), 0\.0\) \+ spec\) \* uPointColors\[i\];/, 'EL1\'s lit loop');
  assert.match(EL_BB_FS, /acc \+= sh \* elAttenuation\(d, uPointLights\[i\]\.w\) \* uPointColors\[i\];/, 'EL1\'s flat');
  assert.equal(EL_LANE.bounce, undefined);
  const loop = EL_MESH_FS.slice(EL_MESH_FS.indexOf('vec3 elPointLitWet('), EL_MESH_FS.indexOf('vec3 elPointLit('));
  assert.equal((loop.match(/acc \+=/g) || []).length, 1, 'the lit loop accumulates ONE term per light: the direct light (a bounce line under any name would be a second)');
  const el = rd('src/render/enhancedLighting.js'), r = rd('src/render/renderer.js');
  assert.ok(!/export (const|function) (EL_BOUNCE|bounceOn)/.test(el) && !/setBounce|_bounceWanted/.test(r), 'the constants, the door and the setter are gone');
  assert.match(el, /BOUNCE1 \(2026-09-23\), WITHDRAWN THE SAME DAY BY ITS AUDIT/, 'and the reason stands where the term stood');
  assert.match(el, /renderer\.setVolumetrics\?\.\(volumetricsOn\(search\)\); renderer\.setHaze\?\.\(hazeOn\(search\)\); \}/, 'the glow\'s door, then VC7b\'s haze - and no bounce door between or after them');
});
