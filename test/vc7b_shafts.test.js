// VC7b - LIGHT SHAFTS (2026-09-23, Mac: "I really want to improve the
// volumetric cloud system to be more immersive" - "All of the above").
//   - the beams: EL3's screen-space mask carries the sky map's own
//     transmittance, so a bank cuts the beams into spokes and a gap lets
//     them through; VC6c's covered-sun gate is untouched;
//   - the haze: the sun in the air, marched through the cloud shadow - lit
//     where the sun reaches the air, dark where a bank shades it, in every
//     direction; off without a deck, off indoors, off through `?haze=off`.
// What renders is tools/vc7bHazeProbe.mjs's to judge (the fake GL draws
// nothing); these pin the gate, the plumbing and the shader's laws.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AIR_HAZE_STEPS, AIR_HAZE_REACH, AIR_HAZE_G, AIR_HAZE_ISO, AIR_HAZE_GAIN } from '../src/render/airPass.js';
import { EL_LANE, hazeOn, syncLightingLane, elScatterDensity } from '../src/render/enhancedLighting.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { VolumetricClouds, COMPOSITE_FS } from '../src/render/volumetricClouds.js';
import { perspective } from '../src/world/mat4.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, TEXTURE1: 1001, TEXTURE2: 1002, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, DEPTH_ATTACHMENT: 36096, FRAMEBUFFER: 36160 };
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

// One world frame to the resolve, with the deck handed AFTER beginFrame (as both exterior hosts do), and the calls
// the resolve made. `sun` is the light's direction (toward the sun); the fog is the clear day's own (linear to 2400).
function frame({ deck = null, sun = [0, 0.42, 0.9], haze = true, fog = ['linear', 0, 0, 2400], proj = I } = {}) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true); r.setHaze(haze);
  r.setFog(fog[0], fog[1], fog[2], fog[3], new Float32Array([0.6, 0.65, 0.7]));
  r.textures.set('1_1', { id: 't' });
  const ap = r.air;
  r.beginFrame(proj, I, new Float32Array(sun), WORLD_FRAME);
  r.setCloudShadow(deck);
  r.drawMesh({ vao: { id: 'vao' }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }] }, I, null);
  calls.length = 0;
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });   // the resolve
  return { r, ap, calls };
}
const deckOf = (extra = {}) => ({ map: { id: 'shadowMap' }, rect: [-500, -500, 1 / 1000, 1], ...extra });
const u = (calls, name) => calls.filter((c) => c[1] === name && /^uniform/.test(c[0])).map((c) => c[2]);
// the framebuffer each program drew into: the bindFramebuffer right before its useProgram (quad() binds, then uses)
const drawsInto = (calls, ap, prog) => {
  const out = [];
  for (let i = 0; i < calls.length; i++) {
    if (calls[i][0] === 'useProgram' && calls[i][1] === prog.p) {
      for (let j = i - 1; j >= 0; j--) if (calls[j][0] === 'bindFramebuffer') { out.push(calls[j][2]); break; }
    }
  }
  return out;
};

test('VC7b: the constants', () => {
  assert.equal(AIR_HAZE_STEPS, 12);
  assert.equal(AIR_HAZE_REACH, 3000, 'past the clear day\'s fog end (2400): the reach is the haze\'s, not a cut');
  assert.equal(AIR_HAZE_G, 0.6);
  assert.equal(AIR_HAZE_ISO, 0.3);
  assert.equal(AIR_HAZE_GAIN, 1, 'the probe\'s calibration (airPass.js records the three it was measured against)');
});

test('VC7b: THE HAZE\'S GATE - a deck, the sun up past the shadow map\'s own floor, a fog with an extinction, the door open', () => {
  const on = frame({ deck: deckOf() });
  assert.equal(on.ap.stats.haze, true, 'a deck and a clear day\'s fog: the march runs');
  const H = u(on.calls, 'uHaze');
  assert.equal(H.length, 1);
  assert.ok(Math.abs(H[0][0] - elScatterDensity(1, 0, 0, 2400)) < 1e-9, `the extinction is the fog's own, the lane's law (${H[0][0]})`);
  assert.deepEqual(Array.from(H[0]).slice(1), [AIR_HAZE_GAIN, AIR_HAZE_REACH, 0], 'the gain and the reach');
  for (const [why, f] of [
    ['no deck (the classic skin, every interior)', frame({ deck: null })],
    ['a deck whose amount is 0', frame({ deck: deckOf({ rect: [-500, -500, 1 / 1000, 0] }) })],
    ['the sun under the shadow map\'s own floor (its march answers "no sun" at y <= 0.05)', frame({ deck: deckOf(), sun: [0, 0.04, 0.999] })],
    ['the door shut (?haze=off)', frame({ deck: deckOf(), haze: false })],
    ['no fog, no extinction', frame({ deck: deckOf(), fog: ['off', 0, 0, 0] })],
  ]) {
    assert.equal(f.ap.stats.haze, false, `${why}: no march`);
  }
  // THE SHADER MUST AGREE WITH THE PASS. With the sun ON SCREEN the beams draw through the same program, so a gate
  // the pass closed but whose extinction still reached uHaze would march anyway - `?haze=off` shutting nothing. The
  // identity view looks down -z, so under a real projection a sun ahead of it is on screen.
  const ahead = [0, 0.3, -0.954], proj = perspective(Math.PI / 3, 1.6, 0.1, 400);
  for (const [why, f] of [
    ['the door shut, the sun in view', frame({ deck: deckOf(), sun: ahead, haze: false, proj })],
    ['no deck, the sun in view', frame({ deck: null, sun: ahead, proj })],
    ['a deck whose amount is 0, the sun in view', frame({ deck: deckOf({ rect: [-500, -500, 1 / 1000, 0] }), sun: ahead, proj })],
  ]) {
    assert.equal(f.ap.stats.shafts, true, `${why}: the beams drew (else this is vacuous)`);
    assert.equal(f.ap.stats.haze, false, why);
    const H = u(f.calls, 'uHaze');
    assert.equal(H.length, 1, `${why}: the beams' program took a haze term`);
    assert.equal(H[0][0], 0, `${why}: and it is 0 - the shader's march is shut too`);
  }
});

test('VC7b: THE MARCH\'S IMAGE IS AVERAGED - it writes the raw target, VOL1\'s depth-aware tile writes the shafts\' image; the beams alone write it directly', () => {
  const on = frame({ deck: deckOf() });
  const T = on.ap.targets, P = on.ap.programs;
  assert.ok(T.shaftRaw && T.shaftRaw !== T.shaft && T.shaftRaw.w === T.shaft.w && T.shaftRaw.h === T.shaft.h, 'its own target, the shafts\' size');
  assert.deepEqual(drawsInto(on.calls, on.ap, P.shaft), [T.shaftRaw.fbo], 'the march into the raw image');
  assert.ok(drawsInto(on.calls, on.ap, P.volBlur).includes(T.shaft.fbo), 'the tile into the shafts\' image the resolve adds');
  // the tile's own draw: the volBlur program used right after the shafts' image is bound (the AO's blur takes uSrc too)
  const use = on.calls.findIndex((c, i) => c[0] === 'useProgram' && c[1] === P.volBlur.p && on.calls.slice(0, i).reverse().find((d) => d[0] === 'bindFramebuffer')[2] === T.shaft.fbo);
  const src = on.calls.findIndex((c, i) => i > use && c[0] === 'uniform1i' && c[1] === 'uSrc');
  assert.ok(use > 0 && src > use && on.calls.slice(use, src).reverse().find((c) => c[0] === 'bindTexture')[2] === T.shaftRaw.tex, 'reading the raw image');
  const off = frame({ deck: null, sun: [0, 0.42, 0.9] });
  assert.ok(!drawsInto(off.calls, off.ap, off.ap.programs.shaft).includes(off.ap.targets.shaftRaw.fbo), 'no march: nothing goes through the raw image');
});

test('VC7b: THE SKY MAP IN THE MASK - bound on its own unit when the deck carries one, and switched off when it does not', () => {
  const sky = { id: 'skyMap' };
  const on = frame({ deck: deckOf({ sky }) });
  assert.deepEqual(u(on.calls, 'uCloudSkyOn'), [1]);
  assert.deepEqual(u(on.calls, 'uCloudSky'), [2], 'unit 2 - the depth is on 0, the shadow map on 1');
  const at = on.calls.findIndex((c) => c[0] === 'uniform1i' && c[1] === 'uCloudSky');
  assert.equal(on.calls.slice(0, at).reverse().find((c) => c[0] === 'bindTexture')[2], sky, 'the deck\'s sky map, bound right before');
  const none = frame({ deck: deckOf() });
  assert.deepEqual(u(none.calls, 'uCloudSkyOn'), [0], 'a deck without a sky map: the mask is the sky\'s alone');
  const R = u(on.calls, 'uViewRot');
  assert.equal(R.length, 1, 'the view\'s rotation, for a pixel\'s world direction');
  assert.deepEqual(u(on.calls, 'uLightDir').map((v) => Array.from(v)), [[0, 0.41999998688697815, 0.8999999761581421]]);
});

test('VC7b: THE DECK PUBLISHES THE SKY MAP once a sweep has filled it - its alpha is meaningless before', () => {
  const c = Object.create(VolumetricClouds.prototype);
  Object.assign(c, { mapOrigin: [10, 20], shadowMarched: true, shadowMap: { tex: { id: 'sh' } }, map: { tex: { id: 'sky' } }, sweeps: 0 });
  assert.equal(c.shadow.sky, null, 'no sweep yet: no sky map');
  assert.equal(c.shadow.map.id, 'sh');
  c.sweeps = 1;
  assert.equal(c.shadow.sky.id, 'sky', 'a sweep done: the sky map rides the deck');
  const shared = read('src/scenes/shared.js');
  assert.match(shared, /if \(clouds\?\.shadow\) Object\.assign\(enhancedSky\.cloudShadow, clouds\.shadow\);/, 'the one door every host\'s deck comes through - it carries every field the getter publishes');
});

test('VC7b: THE DOOR - `?haze=off`, read where the lane\'s other doors are, carried to the air pass', () => {
  assert.equal(hazeOn(''), true);
  assert.equal(hazeOn('?haze=off'), false);
  assert.equal(hazeOn('?haze=on'), true);
  const seen = [];
  const fake = { setLightingLane() {}, setExposure() {}, setAir() {}, setContact() {}, setClusters() {}, setShadowCache() {}, setVolumetrics() {}, setHaze: (on) => seen.push(on) };
  syncLightingLane(fake, '?haze=off');
  syncLightingLane(fake, '');
  assert.deepEqual(seen, [false, true]);
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setHaze(false);
  r.setLightingLane(EL_LANE); r.setAir(true);
  assert.equal(r.air.hazeOn, false, 'a door shut before the pass exists is the pass\'s door when it is built');
  r.setHaze(true);
  assert.equal(r.air.hazeOn, true);
});

test('VC7b: THE SHADER\'S LAWS - the ground under a point of air, the extinction, the phase, the jitter, the sky map read as the composite reads it', () => {
  const a = read('src/render/airPass.js');
  const fs = a.slice(a.indexOf('const SHAFT_FS = '), a.indexOf('}`;', a.indexOf('const SHAFT_FS = ')));
  // the point's sun ray meets y = 0 where the shadow map's own ray starts (volumetricClouds.js SHADOW_FS)
  assert.match(fs, /vec2 g = p\.xz - uLightDir\.xz \* \(p\.y \/ uLightDir\.y\);/, 'the ground under a point of air, along the sun');
  assert.match(read('src/render/volumetricClouds.js'), /vec3 p = vec3\(g\.x, 0\.0, g\.y\) \+ uLightDir \* t;/, '...which is where the shadow march starts its ray');
  assert.match(fs, /lit \+= cloudShadowAt\(vec3\(g\.x, 0\.0, g\.y\)\) \* exp\(-sigma \* t\);/, 'each step: the sun through the slab, the fog between it and the eye');
  assert.match(fs, /float reach = min\(viewDist\(depthAt\(vUV\)\) \* vlen, uHaze\.z\);/, 'the ray stops at the surface or the reach');
  assert.match(fs, /float t = dt \* bayer4\(gl_FragCoord\.xy\);/, 'jittered by the one Bayer, whose tile the blur averages');
  assert.match(fs, /for \(int i = 0; i < \$\{AIR_HAZE_STEPS\}; i\+\+\) \{/);
  assert.match(fs, /float hg = \(1\.0 - g2\) \/ pow\(1\.0 \+ g2 - 2\.0 \* \$\{glslFloat\(AIR_HAZE_G\)\} \* c, 1\.5\);/, 'Henyey-Greenstein');
  assert.match(fs, /float phase = mix\(hg, 1\.0, \$\{glslFloat\(AIR_HAZE_ISO\)\}\) \/ \(4\.0 \* PI\);/, 'with a share of isotropic, normalised');
  assert.match(fs, /return uSunColor \* \(lit \* sigma \* dt \* phase \* uHaze\.y\);/, 'the single-scattering sum');
  assert.match(fs, /if \(sigma <= 0\.0 \|\| uLightDir\.y <= 0\.05 \|\| uCloudShadowRect\.w <= 0\.0\) return vec3\(0\.0\);/, 'the shader\'s own gate, the pass\'s');
  // the sky map: the composite's parametrisation, line for line
  assert.match(fs, /return texture\(uCloudSky, vec2\(atan\(d\.x, d\.z\) \/ \(2\.0 \* PI\), max\(el, 0\.0\) \/ \(0\.5 \* PI\)\)\)\.a;/);
  assert.match(COMPOSITE_FS, /float az = atan\(dir\.x, dir\.z\);/);
  assert.match(COMPOSITE_FS, /vec2 uv = vec2\(az \/ \(2\.0 \* PI\), max\(el, 0\.0\) \/ \(0\.5 \* PI\)\);/, '...the same texel the sky is drawn from');
  assert.match(fs, /return sky \* near > 0\.0 \? sky \* near \* skyThrough\(uv\) : 0\.0;/, 'the beams\' mask carries it');
  assert.match(fs, /if \(uCloudSkyOn <= 0\.0\) return 1\.0;/, 'no sky map: the mask as it was');
  assert.match(fs, /vec3 c = haze\(\);\n  if \(uSunOn > 0\.0\) c \+= beams\(\);/, 'the haze needs the sun up, the beams need it on screen');
  // VC6c: the covered-sun gate, exactly as Mac asked it
  assert.match(fs, /return uSunColor \* \(acc \/ \$\{AIR_SHAFT_TAPS\}\.0 \* uShaftParams\.y \* through \* through\);/);
  // the renderer hands the fog's extinction, the lane's own law
  assert.match(read('src/render/renderer.js'), /haze: this\._lane \? this\._lane\.scatterDensity\(this\._fogMode, this\._fogDensity, this\._fogRange\[0\], this\._fogRange\[1\]\) : 0,/);
});
