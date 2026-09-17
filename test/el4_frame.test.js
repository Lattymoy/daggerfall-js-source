// EL4 - ENHANCED LIGHTING, TIER FOUR: THE FRAME (2026-09-17, Mac: "Polished
// and exceptional detail. Proper darker dungeons. The goal isnt a half
// visioned system").
//
// The world drawn into a frame image every pass restores to (the
// frame-target law in render/renderTarget.js), eye adaptation measured off
// the frame's mean luminance and read by the lane's shaders, bloom from the
// frame's bright pass, a vignette and contrast in the resolve, the dungeon
// ambient scaled to the dark under the lane, and a glint from every lantern.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AIR_ADAPT_UNIT, AIR_LUM_SIZE, AIR_ADAPT_KEY, AIR_ADAPT_MIN, AIR_ADAPT_MAX, AIR_ADAPT_OPEN, AIR_ADAPT_CLOSE,
  AIR_LUM_LOG_RANGE, AIR_ADAPT_LOG_RANGE, AIR_BRIGHT_THRESHOLD, AIR_VIGNETTE, AIR_CONTRAST, AIR_ADAPT_MAX_DT,
  packLog, unpackLog, adaptStep, AIR_ADAPT_GLSL, AirPass, AIR_AO_UNIT,
} from '../src/render/airPass.js';
import { setFrameTarget, frameTarget, withTarget, finishVolume } from '../src/render/renderTarget.js';
import {
  EL_LANE, EL_GLSL, EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_BB_FS, EL_FAR_RING_FS, EL_DUNGEON_AMBIENT_SCALE, EL_SPEC_GLOSS, EL_SPEC_STRENGTH,
  dungeonAmbient, dungeonTrilight,
} from '../src/render/enhancedLighting.js';
import { Renderer } from '../src/render/renderer.js';
import { FarRingRenderer } from '../src/render/farRing.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, FRAMEBUFFER: 7, TRIANGLE_STRIP: 5, drawingBufferWidth: 320, drawingBufferHeight: 200, ONE: 1 };
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

test('EL4: the constants and the encodings - log luminance over 16 stops, the multiplier over 4, each the inverse of the other, 1 at the midpoint', () => {
  assert.equal(AIR_ADAPT_UNIT, 11); assert.ok(AIR_ADAPT_UNIT < AIR_AO_UNIT);
  assert.equal(AIR_LUM_SIZE, 32);
  assert.equal(AIR_ADAPT_KEY, 0.18); assert.equal(AIR_ADAPT_MIN, 0.7); assert.equal(AIR_ADAPT_MAX, 1.8);
  assert.equal(AIR_ADAPT_OPEN, 0.6); assert.equal(AIR_ADAPT_CLOSE, 3.0); assert.ok(AIR_ADAPT_CLOSE > AIR_ADAPT_OPEN, 'the eye closes faster than it opens');
  assert.deepEqual([...AIR_LUM_LOG_RANGE], [-12, 4]); assert.deepEqual([...AIR_ADAPT_LOG_RANGE], [-2, 2]);
  assert.equal(AIR_BRIGHT_THRESHOLD, 0.85); assert.equal(AIR_VIGNETTE, 0.28); assert.equal(AIR_CONTRAST, 1.04); assert.equal(AIR_ADAPT_MAX_DT, 0.1);
  for (const x of [0.001, 0.02, 0.18, 1, 4, 15]) assert.ok(near(unpackLog(packLog(x, AIR_LUM_LOG_RANGE), AIR_LUM_LOG_RANGE), x, x * 1e-9), `round trip ${x}`);
  assert.equal(packLog(1, AIR_ADAPT_LOG_RANGE), 0.5, 'a multiplier of 1 is the midpoint - the byte 128 the images start at');
  assert.equal(packLog(0, AIR_LUM_LOG_RANGE), 0, 'black clamps to the floor'); assert.equal(packLog(1e9, AIR_LUM_LOG_RANGE), 1);
  assert.match(AIR_ADAPT_GLSL, /uniform sampler2D uAdapt;/);
  assert.match(AIR_ADAPT_GLSL, /return exp2\(texture\(uAdapt, vec2\(0\.5\)\)\.r \* 4\.0 \+ \(-2\.0\)\);/, 'the shader decodes the same range');
});

test('EL4: the adaptation step - toward key over luminance, clamped, slow into the dark and fast into the light, the step bounded, converging', () => {
  // a dark frame: the eye opens toward the ceiling, slowly
  const s1 = adaptStep(1, 0.02, 1 / 60);
  assert.ok(s1 > 1 && s1 < 1.02, `one frame opens a little: ${s1}`);
  assert.ok(near(s1, 1 + (AIR_ADAPT_MAX - 1) * (1 - Math.exp(-AIR_ADAPT_OPEN / 60)), 1e-12));
  // a bright frame: the eye closes toward the floor, fast
  const s2 = adaptStep(1, 2.0, 1 / 60);
  assert.ok(s2 < 1 && near(s2, 1 + (AIR_ADAPT_MIN - 1) * (1 - Math.exp(-AIR_ADAPT_CLOSE / 60)), 1e-12));
  assert.ok(Math.abs(s2 - 1) > Math.abs(s1 - 1) * 1.5, 'closing outruns opening');
  // the clamps: the ceiling is what keeps a dungeon dark
  let m = 1;
  for (let i = 0; i < 6000; i++) m = adaptStep(m, 0.001, 1 / 60);
  assert.ok(near(m, AIR_ADAPT_MAX, 1e-6), `a black frame ends at the ceiling: ${m}`);
  m = 1;
  for (let i = 0; i < 6000; i++) m = adaptStep(m, 100, 1 / 60);
  assert.ok(near(m, AIR_ADAPT_MIN, 1e-6), `a blinding frame ends at the floor: ${m}`);
  // a mid-grey frame is already home
  assert.ok(near(adaptStep(1, AIR_ADAPT_KEY, 1 / 60), 1, 1e-12));
  // the step is bounded: a one-second hitch integrates as a tenth
  assert.equal(adaptStep(1, 0.02, 1), adaptStep(1, 0.02, AIR_ADAPT_MAX_DT));
  assert.equal(adaptStep(1, 0.02, -5), 1, 'no negative time'); assert.equal(adaptStep(1, 0.02, 0), 1);
  // the GLSL is the same step
  const a = read('src/render/airPass.js');
  assert.match(a, /float target = clamp\(uAdaptParams\.y \/ max\(lum, 1e-6\), uAdaptParams\.z, uAdaptParams\.w\);/);
  assert.match(a, /float rate = target > prev \? uAdaptRates\.x : uAdaptRates\.y;/);
  assert.match(a, /float t = 1\.0 - exp\(-uAdaptParams\.x \* rate\);/);
  assert.match(a, /textureLod\(uLum, vec2\(0\.5\), \$\{Math\.log2\(AIR_LUM_SIZE\)\}\.0\)\.r/, 'the mean is the 32x32 image\'s top mip (the template names the size, not a literal)');
});

test('EL4: the frame-target law - the helper and the clouds restore the frame, not the canvas', () => {
  const { gl, calls } = recordingGl();
  const target = { fbo: { id: 'map' }, tex: {}, width: 4, height: 4, attached: false };
  assert.equal(frameTarget(), null);
  withTarget(gl, target, [0, 0, 8, 8], () => {});
  assert.equal(calls.filter((c) => c[0] === 'bindFramebuffer').at(-1)[2], null, 'no frame: the canvas');
  const frame = { id: 'frame' };
  setFrameTarget(frame);
  try {
    assert.equal(frameTarget(), frame);
    calls.length = 0;
    withTarget(gl, target, [0, 0, 8, 8], () => {});
    assert.equal(calls.filter((c) => c[0] === 'bindFramebuffer').at(-1)[2], frame, 'withTarget restores the frame');
    calls.length = 0;
    finishVolume(gl, { tex: {} }, [0, 0, 8, 8]);
    assert.equal(calls.filter((c) => c[0] === 'bindFramebuffer').at(-1)[2], frame, 'finishVolume restores the frame');
  } finally { setFrameTarget(null); }
  assert.equal(frameTarget(), null);
  const vc = read('src/render/volumetricClouds.js');
  assert.match(vc, /gl\.bindFramebuffer\(gl\.DRAW_FRAMEBUFFER, frameTarget\(\)\);/, 'the clouds\' blit restores the frame');
  assert.match(vc, /import \{[^}]*frameTarget[^}]*\} from '\.\/renderTarget\.js';/);
  assert.equal((read('src/render/renderer.js').match(/gl\.bindFramebuffer\(gl\.FRAMEBUFFER, this\._frameFbo \?\? null\);/g) || []).length, 3, 'the sprite pass\'s three restores hand back the frame');
  const others = ['src/render/enhancedSky.js', 'src/render/dynamicSkiesRenderer.js', 'src/render/precipitation.js', 'src/render/labGrass.js', 'src/render/skyRenderer.js', 'src/render/waterSurface.js', 'src/render/farRing.js'];
  for (const f of others) assert.ok(!/bindFramebuffer\(/.test(read(f)), `${f} binds no framebuffer of its own - it draws into whatever is bound`);
});

test('EL4: proper dark dungeons and the glints - the ambient scaled once under the lane, the trilight with it, as given otherwise; Blinn-Phong on the three lit shaders', () => {
  assert.equal(EL_DUNGEON_AMBIENT_SCALE, 0.35);
  const amb = new Float32Array([0.12, 0.12, 0.12]);
  assert.equal(dungeonAmbient(false, amb), amb, 'off: the host\'s own object');
  const dark = dungeonAmbient(true, amb);
  assert.ok(near(dark[0], 0.042, 1e-6) && near(dark[2], 0.042, 1e-6));
  const tri = { sky: [0.3, 0.3, 0.3], equator: [0.2, 0.2, 0.2], ground: [0.1, 0.1, 0.1] };
  assert.equal(dungeonTrilight(false, tri), tri); assert.equal(dungeonTrilight(true, null), null);
  const dt = dungeonTrilight(true, tri);
  assert.ok(near(dt.sky[0], 0.105) && near(dt.equator[1], 0.07) && near(dt.ground[2], 0.035));
  // the hosts: the standalone dungeon at boot and per frame, the world's dungeon mode - the trilight scaled once, the flat ambient once
  const d = read('src/scenes/dungeon.js'), w = read('src/scenes/worldModes.js');
  assert.match(d, /renderer\.setLighting\(dungeonAmbient\(lightingOn, new Float32Array\(DUNGEON_AMBIENT\)\), 0\);/);
  assert.match(d, /const _tri = dungeonTrilight\(lightingOn, betterAmbience\.dungeonAmbient\(\)\); renderer\.setLighting\(new Float32Array\(_tri \? _tri\.equator : dungeonAmbient\(lightingOn, ctx\.ambient\)\), 0, undefined, _tri\);/);
  assert.match(w, /const _tri = dungeonTrilight\(_on, betterAmbience\.dungeonAmbient\(\)\); renderer\.setLighting\(new Float32Array\(_tri \? _tri\.equator : dungeonAmbient\(_on, dungeonCtx\.ambient\)\), 0, undefined, _tri\);/);
  assert.ok(!/dungeonAmbient\(/.test(read('src/scenes/interior.js')), 'an interior (a shop, a tavern) keeps its daylight ambient');
  // the glints
  assert.equal(EL_SPEC_GLOSS, 24); assert.equal(EL_SPEC_STRENGTH, 0.12);
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS]]) {
    assert.match(fs, /vec3 H = normalize\(Ln \+ normalize\(uCamPos - wp\)\);/, `${name}: the half vector`);
    assert.match(fs, /float spec = pow\(max\(dot\(n, H\), 0\.0\), 24\.0\) \* 0\.12;/, `${name}: the gloss and the strength`);
    assert.match(fs, /\(max\(dot\(n, Ln\), 0\.0\) \+ spec\) \* uPointColors\[i\]/, `${name}: the glint in the lantern's colour, under its shadow and falloff`);
  }
  const flat = /vec3 elPointFlat\([\s\S]*?\n\}/.exec(EL_BB_FS)[0];
  assert.ok(!/spec|uCamPos/.test(flat), 'a flat has no normal and no glint');
});

test('EL4: the eye in the shaders - every lane shader and the far ring multiply their exposure by the adapted image', () => {
  assert.ok(EL_GLSL.includes(AIR_ADAPT_GLSL), 'the lane\'s block carries the eye');
  for (const [name, fs] of [['mesh', EL_MESH_FS], ['terrain', EL_TERRAIN_FS], ['char', EL_CHAR_FS], ['bb', EL_BB_FS]]) {
    assert.match(fs, /float ex = uELExposure \* elAdapt\(\);   \/\/ EL4/, `${name}: the eye rides the exposure`);
    assert.match(fs, /vec3 tm = elTonemap\(lit \* ex\);/); assert.match(fs, /col \+= elTonemap\(elInScatter\(wp\) \* ex\);/);
    assert.ok(!/lit \* uELExposure/.test(fs), `${name}: no bare exposure left`);
  }
  assert.match(EL_FAR_RING_FS, /float ex = uELExposure \* elAdapt\(\);/); assert.match(EL_FAR_RING_FS, /elTonemap\(lit \* ex\)/);
  const fr = read('src/render/farRing.js');
  assert.match(fr, /'uELExposure', 'uAdapt'\]/); assert.match(fr, /gl\.bindTexture\(gl\.TEXTURE_2D, adaptTex \?\? this\._adaptOne\(\)\);/);
  assert.match(fr, /new Uint8Array\(\[128, 128, 128, 255\]\)/, 'the bare image holds the multiplier 1');
  assert.match(read('src/scenes/world.js'), /adaptTex: renderer\.adaptTexture/);
  // the far ring on the lane binds the eye's unit
  const { gl, calls } = recordingGl();
  const ring = new FarRingRenderer(gl, { lane: EL_LANE });
  ring._built = true; ring.indexCount = 3; ring.vao = {};
  calls.length = 0;
  ring.draw(I, { origin: [0, 0, 0], lightDir: [0, 1, 0], ambient: new Float32Array(3), sunScale: 1, sunColor: new Float32Array(3), fogColor: new Float32Array(3), fogEnd: 100, fovY: 1, aspect: 1, exposure: 1.4, adaptTex: { id: 'adapt' } });
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uAdapt' && c[2] === 11));
  assert.ok(calls.some((c) => c[0] === 'bindTexture' && c[2]?.id === 'adapt'));
});

test('EL4: the frame lifecycle on the fake GL - bound for the world pass, every restore back to it, measured and resolved on the first screen quad, the eye\'s image swapping, released with the door', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);
  let t = 1000;
  r.setAir(true);
  const ap = r.air;
  ap._now = () => t;
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  assert.equal(ap.frame, null, 'no frame until a world pass');
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, -0.2]));
  assert.ok(ap.frame && ap.frame.w === 320 && ap.frame.h === 200, 'the frame image is the canvas\'s size');
  assert.equal(frameTarget(), ap.frame.fbo, 'and the frame target the passes restore to');
  assert.equal(r._frameFbo, ap.frame.fbo);
  assert.equal(ap.adaptIndex, 0);
  assert.equal(calls.filter((c) => c[0] === 'texImage2D' && c[3] === 1 && c[4] === 1 && c[9]?.[0] === 128 && c[9]?.[3] === 255).length, 2, 'both 1x1 eye images start at the multiplier 1 (the byte 128)');
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uAdapt' && c[2] === 11), 'the mesh program reads the eye');
  const clear = calls.findIndex((c) => c[0] === 'clear' && c[1] === 16384 + 256);
  const bindBefore = calls.slice(0, clear).filter((c) => c[0] === 'bindFramebuffer').at(-1);
  assert.equal(bindBefore[2], ap.frame.fbo, 'the clear lands in the frame');
  // a foreign pass mid-frame hands the frame back
  calls.length = 0;
  withTarget(r.gl, { fbo: { id: 'map' }, tex: {}, width: 4, height: 4, attached: false }, [0, 0, 320, 200], () => {});
  assert.equal(calls.filter((c) => c[0] === 'bindFramebuffer').at(-1)[2], ap.frame.fbo);
  // the first screen quad: the luminance, the mip chain, the adaptation step into the other image, the bright pass, the blur, the resolve to the canvas
  t = 1016;
  calls.length = 0;
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  const names = calls.filter((c) => c[0] === 'useProgram').map((c) => c[1]);
  assert.ok(calls.some((c) => c[0] === 'generateMipmap'), 'the mean by mip');
  assert.equal(ap.adaptIndex, 1, 'the eye\'s image swapped');
  const ad = calls.find((c) => c[0] === 'uniform4fv' && c[1] === 'uAdaptParams');
  assert.ok(ad && ad[2][0] === 0 && near(ad[2][1], 0.18, 1e-6) && near(ad[2][2], 0.7, 1e-6) && near(ad[2][3], 1.8, 1e-6), 'the first resolve integrates no time; the key and the clamps ride along');
  assert.ok(calls.some((c) => c[0] === 'uniform1f' && c[1] === 'uThreshold' && near(c[2], 0.85, 1e-6)), 'the bright pass');
  const grade = calls.find((c) => c[0] === 'uniform4fv' && c[1] === 'uGrade');
  assert.ok(grade && near(grade[2][2], 0.28, 1e-6) && near(grade[2][3], 1.04, 1e-6), 'the vignette and the contrast');
  const resolveBind = calls.findIndex((c) => c[0] === 'bindFramebuffer' && c[2] === null);
  assert.ok(resolveBind > 0 && calls.slice(resolveBind).some((c) => c[0] === 'uniform4fv' && c[1] === 'uGrade'), 'the resolve draws to the canvas');
  assert.equal(frameTarget(), null, 'the frame target is released'); assert.equal(r._frameFbo, null);
  assert.equal(ap.pending, false);
  assert.ok(names.length >= 6, 'the resolve ran its programs');
  // the next frame integrates the time since the last resolve, bounded
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, -0.2]));
  t = 1016 + 5000;
  calls.length = 0;
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  const ad2 = calls.find((c) => c[0] === 'uniform4fv' && c[1] === 'uAdaptParams');
  assert.ok(near(ad2[2][0], AIR_ADAPT_MAX_DT, 1e-6), 'five seconds integrate as the bound');
  assert.equal(ap.adaptIndex, 0, 'swapped back');
  // the far ring's texture is the current eye
  assert.equal(r.adaptTexture, ap.adapt[0].tex);
  // the door closes mid-frame: the frame target is released and nothing is owed
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, -0.2]));
  assert.equal(frameTarget(), ap.frame.fbo);
  r.setAir(false);
  assert.equal(frameTarget(), null); assert.equal(r._frameFbo, null); assert.equal(ap.pending, false);
  calls.length = 0;
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  assert.ok(!calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uGrade'), 'no resolve owed');
  // a panel frame keeps the canvas
  r.setAir(true);
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => {
    assert.equal(r._frameFbo, null); assert.equal(frameTarget(), null);
  });
  // a resize reallocates the frame
  canvas.clientWidth = 640; canvas.clientHeight = 400;
  const old = ap.frame;
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, -0.2]));
  assert.notEqual(ap.frame, old); assert.equal(ap.frame.w, 640);
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  assert.equal(frameTarget(), null);
});
