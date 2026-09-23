// VC7b - LIGHT SHAFTS (2026-09-23, Mac: "I really want to improve the
// volumetric cloud system to be more immersive" - "All of the above").
//   - the beams: EL3's screen-space mask carries the sky map's own
//     transmittance, so a bank cuts the beams into spokes and a gap lets
//     them through; VC6c's covered-sun gate is untouched;
//   - the haze: the sun in the air, marched through the cloud shadow - lit
//     where the sun reaches the air, dark where a bank shades it, in every
//     direction; off without a deck, off indoors, off through `?haze=off`.
// What renders is tools/vc7bHazeProbe.mjs's to judge (the fake GL draws
// nothing); these pin the gate and the plumbing, and run the shader's laws
// on SHAFT_FS itself (glsl.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AIR_HAZE_STEPS, AIR_HAZE_REACH, AIR_HAZE_G, AIR_HAZE_ISO, AIR_HAZE_GAIN, AIR_HAZE_PROBE_KEY, SHAFT_FS } from '../src/render/airPass.js';
import { fogForWeather } from '../src/world/weather.js';
import { glslFunctions } from './glsl.mjs';
import { EL_LANE, hazeOn, syncLightingLane, elScatterDensity } from '../src/render/enhancedLighting.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { VolumetricClouds, COMPOSITE_FS } from '../src/render/volumetricClouds.js';
import { perspective, lookAt } from '../src/world/mat4.js';

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
function frame({ deck = null, sun = [0, 0.42, 0.9], haze = true, fog = ['linear', 0, 0, 2400], proj = I, view = I, key = null } = {}) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true); r.setHaze(haze);
  if (key != null) r.setLighting(new Float32Array([0.3, 0.3, 0.3]), key, new Float32Array([1, 0.95, 0.85]));
  r.setFog(fog[0], fog[1], fog[2], fog[3], new Float32Array([0.6, 0.65, 0.7]));
  r.textures.set('1_1', { id: 't' });
  const ap = r.air;
  r.beginFrame(proj, view, new Float32Array(sun), WORLD_FRAME);
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
  assert.ok(AIR_HAZE_REACH > fogForWeather('sunny').end, 'past the clear day\'s fog end: the reach is the haze\'s, not a cut');
  assert.equal(AIR_HAZE_G, 0.6);
  assert.equal(AIR_HAZE_ISO, 0.3);
  // AUDIT-VC7 (B6): a share of the KEY light, tuned under the probe's key - the look it was tuned to, at that key
  assert.equal(AIR_HAZE_GAIN * AIR_HAZE_PROBE_KEY, 1, 'the probe\'s calibration (airPass.js records the three it was measured against)');
  assert.match(read('tools/vc7bHazeProbe.mjs'), /r\.setLighting\(new Float32Array\(\[0\.35, 0\.35, 0\.4\]\), AIR_HAZE_PROBE_KEY,/, 'the probe lights its scene with the key the gain names');
});

test('VC7b: THE HAZE\'S GATE - a deck, the sun up past the shadow map\'s own floor, a fog with an extinction, the door open', () => {
  const on = frame({ deck: deckOf() });
  assert.equal(on.ap.stats.haze, true, 'a deck and a clear day\'s fog: the march runs');
  const H = u(on.calls, 'uHaze');
  assert.equal(H.length, 1);
  assert.ok(Math.abs(H[0][0] - elScatterDensity(1, 0, 0, 2400)) < 1e-9, `the extinction is the fog's own, the lane's law (${H[0][0]})`);
  assert.deepEqual(Array.from(H[0]).slice(1, 3), [Math.fround(AIR_HAZE_GAIN), AIR_HAZE_REACH], 'the gain and the reach');
  assert.equal(H[0][3], Math.fround(on.r._sunScale), 'AUDIT-VC7 (B6): and the key light\'s scale, the frame\'s');
  const dim = frame({ deck: deckOf(), key: 0.3 });
  assert.equal(u(dim.calls, 'uHaze')[0][3], Math.fround(0.3), 'a storm\'s dimmed key dims the haze with it');
  for (const [why, f] of [
    ['no deck (the classic skin, every interior)', frame({ deck: null })],
    ['a deck whose amount is 0', frame({ deck: deckOf({ rect: [-500, -500, 1 / 1000, 0] }) })],
    ['the sun under the shadow map\'s own floor (its march answers "no sun" at y <= 0.05)', frame({ deck: deckOf(), sun: [0, 0.04, 0.999] })],
    ['the door shut (?haze=off)', frame({ deck: deckOf(), haze: false })],
    ['no fog, no extinction', frame({ deck: deckOf(), fog: ['off', 0, 0, 0] })],
    ['the key light out (a storm\'s sunScale, the sun still up)', frame({ deck: deckOf(), key: 0 })],
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
  // under a TURNED view (every frame above uses the identity, where a rotation and its transpose agree): the uploaded
  // world-from-view rotation carries the view's forward (-z) to the camera's world forward, and its up to world up's side
  const eye = [0, 2, 0], target = [300, 60, -400], V = lookAt(eye, target, [0, 1, 0]);
  const up = frame({ deck: deckOf({ sky }), view: V }).calls.find((c) => c[0] === 'uniformMatrix3fv' && c[1] === 'uViewRot');
  assert.equal(up[2], false, 'handed as it is laid out - column-major, untransposed');
  const Rt = up[3];
  const fwd = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]], fl = Math.hypot(...fwd);
  const mul = (m, v) => [0, 1, 2].map((r) => m[r] * v[0] + m[3 + r] * v[1] + m[6 + r] * v[2]);   // column-major, as uniformMatrix3fv(false) reads it
  mul(Rt, [0, 0, -1]).forEach((x, i) => assert.ok(Math.abs(x - fwd[i] / fl) < 1e-5, `forward ${i}`));
  mul(Rt, [1, 0, 0]).forEach((x, i) => assert.ok(Math.abs(x - V[i * 4]) < 1e-6, `right ${i}: the view's first row`));
  mul(Rt, [0, 1, 0]).forEach((x, i) => assert.ok(Math.abs(x - V[i * 4 + 1]) < 1e-6, `up ${i}: the view's second row`));
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

test('VC7b: THE SHADER\'S LAWS - run on SHAFT_FS itself: the phase, the march over its reach, the key, the ground under a point of air, the map\'s edge', () => {
  // the pass's own uniforms, a camera looking down world -z under a real projection, the frame's depth a surface D away
  const P = perspective(Math.PI / 3, 1.6, 0.1, 5000), W = 320, H = 200;
  const depthFor = (D) => ((P[14] / D - P[10]) + 1) / 2;   // the depth byte a view distance D wrote (viewDist's inverse)
  const shaft = (over = {}, shadow = () => 1) => {
    const f = glslFunctions(SHAFT_FS, {
      uProjInfo: [P[0], P[5], P[10], P[14]], uRect: [0, 0, W, H], uCanvas: [W, H], uViewRot: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      uEye: [0, 50, 0], uLightDir: [0, 0.5, -Math.sqrt(0.75)], uSunColor: [1, 1, 1], uHaze: [1e-3, 1, AIR_HAZE_REACH, 1],
      uCloudShadowRect: [-5000, -5000, 1 / 10000, 1], uCloudSkyOn: 0, uSunOn: 0, vUV: [0.5, 0.5], gl_FragCoord: [10.5, 7.5, 0, 1],
      textureLod: (name, uv) => (name === 'uDepth' ? [depthFor(1000), 0, 0, 1] : [0, 0, 0, uv[1]]),
      texture: (name, uv) => [shadow(uv), 0, 0, 1],
      ...over,
    });
    return f;
  };
  // THE PHASE, against its definition: Henyey-Greenstein at AIR_HAZE_G, AIR_HAZE_ISO of it isotropic, over 4 pi
  const PI = 3.14159265;   // the shader's own
  const g = AIR_HAZE_G, spec = (c) => ((1 - AIR_HAZE_ISO) * (1 - g * g) / Math.pow(1 + g * g - 2 * g * c, 1.5) + AIR_HAZE_ISO) / (4 * PI);
  const f0 = shaft();
  let sphere = 0;
  for (let k = 0; k < 4000; k++) { const c = -1 + (k + 0.5) / 2000; sphere += 2 * Math.PI * f0.hazePhase(c) / 2000; assert.ok(Math.abs(f0.hazePhase(c) - spec(c)) < 1e-12); }
  assert.ok(Math.abs(sphere - 1) < 1e-4, `over the sphere, one (${sphere.toFixed(6)})`);
  assert.ok(f0.hazePhase(1) > f0.hazePhase(0) && f0.hazePhase(0) > f0.hazePhase(-1), 'brightest toward the sun');
  // THE MARCH: AIR_HAZE_STEPS equal steps over the ray to the surface (here 1000 m, under the reach), each jittered by
  // the one Bayer, the sun through the fog from the eye - its own Riemann sum, and the phase at the view's angle
  const march = (f, sigma, reach) => { const dt = reach / AIR_HAZE_STEPS, b = f.bayer4([10.5, 7.5]); let sum = 0; for (let j = 0; j < AIR_HAZE_STEPS; j++) sum += Math.exp(-sigma * dt * (j + b)); return sum * sigma * dt; };
  const center = f0.haze(), c0 = Math.sqrt(0.75);   // the centre pixel looks down -z; the sun is 30 degrees up ahead of it
  assert.ok(Math.abs(center[0] - march(f0, 1e-3, 1000) * spec(c0)) < 1e-12, 'the surface stops it, and the steps cover it');
  const far = shaft({ textureLod: (name) => (name === 'uDepth' ? [1, 0, 0, 1] : [0, 0, 0, 0]) });   // the sky: the reach stops it
  assert.ok(Math.abs(far.haze()[0] - march(far, 1e-3, AIR_HAZE_REACH) * spec(c0)) < 1e-12, 'the sky: out to the reach');
  // THE RAY IS THE PIXEL'S: off the centre, with the sun set along that pixel's own world direction (worldDir, the
  // mask's), the phase is the forward peak - the ray is normalised, and it looks where the view looks
  for (const uv of [[0.9, 0.7], [0.15, 0.3]]) {
    const at = shaft({ vUV: uv }), d = at.worldDir(uv);
    const up = d.map((x, i) => (i === 1 ? Math.max(x, 0.2) : x)), L = up.map((x) => x / Math.hypot(...up));   // a sun up past the gate, near that direction
    const lit = shaft({ vUV: uv, uLightDir: L });
    const dir = lit.worldDir(uv), c = dir[0] * L[0] + dir[1] * L[1] + dir[2] * L[2];
    const vd = [(uv[0] * 2 - 1) / P[0], (uv[1] * 2 - 1) / P[5], -1], reach = 1000 * Math.hypot(...vd);
    assert.ok(Math.abs(lit.haze()[0] - march(lit, 1e-3, reach) * spec(c)) < 1e-9, `uv ${uv}: the phase at the pixel's own angle to the sun`);
  }
  const behind = shaft({ uLightDir: [0, 0.5, Math.sqrt(0.75)] }).haze()[0];
  assert.ok(Math.abs(behind / center[0] - spec(-c0) / spec(c0)) < 1e-9, 'the sun behind: the back of the phase');
  // AUDIT-VC7 (B6): THE KEY LIGHT - the haze is the sun's colour at the frame's scale, linearly; none, none
  assert.ok(Math.abs(shaft({ uHaze: [1e-3, 1, AIR_HAZE_REACH, 0.4] }).haze()[0] - 0.4 * center[0]) < 1e-12);
  assert.equal(shaft({ uHaze: [1e-3, 1, AIR_HAZE_REACH, 0] }).haze()[0], 0);
  // AUDIT-VC7 (R2): THE GROUND UNDER A POINT OF AIR is where its sun ray meets the maps' own ground - the eye's height,
  // which the maps are drawn from; the eye's world height moves nothing (stripes of shade 200 m across the square)
  const stripes = (uv) => (Math.floor(uv[1] * 50) % 2 ? 1 : 0.1);   // across the view ray, which runs along z
  const low = shaft({ uEye: [0, 50, 0] }, stripes).haze()[0], high = shaft({ uEye: [0, 900, 0] }, stripes).haze()[0];
  assert.ok(low > 0 && Math.abs(low - high) < 1e-12, `${low} at 50 m, ${high} at 900 m`);
  assert.ok(Math.abs(low - center[0]) > 1e-4, 'and the stripes do shade it (else this is vacuous)');
  // ...and a point of air ABOVE the eye reads the ground its sun ray meets - back along the sun by its height over its
  // slope - not the ground under it: a ray tipped up, each step's stripe summed by hand
  const upUV = [0.5, 0.9], tipped = shaft({ vUV: upUV }, stripes), td = tipped.worldDir(upUV), L0 = tipped.globals.uLightDir;
  const vd0 = [0, (0.9 * 2 - 1) / P[5], -1], R0 = 1000 * Math.hypot(...vd0), dt0 = R0 / AIR_HAZE_STEPS, b0 = tipped.bayer4([10.5, 7.5]);
  let want = 0;
  for (let j = 0; j < AIR_HAZE_STEPS; j++) {
    const t = dt0 * (j + b0), p = [td[0] * t, 50 + td[1] * t, td[2] * t], h = p[1] - 50;
    const g = [p[0] - L0[0] * h / L0[1], p[2] - L0[2] * h / L0[1]];
    want += stripes([(g[0] + 5000) / 10000, (g[1] + 5000) / 10000]) * Math.exp(-1e-3 * t);
  }
  want *= 1e-3 * dt0 * spec(td[0] * L0[0] + td[1] * L0[1] + td[2] * L0[2]);
  assert.ok(Math.abs(tipped.haze()[0] - want) < 1e-9, `the air above the eye, shaded where its sun ray meets the ground (${tipped.haze()[0]} against ${want})`);
  // AUDIT-VC7 (B7): PAST THE MAP'S EDGE its nearest known texel, never full sun - a low sun's ray meets the ground far
  // off, and under a solid deck the air there is shaded too
  const small = [-500, -500, 1 / 1000, 1], lowSun = [0, 0.12, -Math.sqrt(1 - 0.0144)];
  const solid = shaft({ uCloudShadowRect: small, uLightDir: lowSun, textureLod: (name) => (name === 'uDepth' ? [1, 0, 0, 1] : [0, 0, 0, 0]) }, (uv) => (uv[0] < 0 || uv[1] < 0 || uv[0] > 1 || uv[1] > 1 ? 1 : 0));
  assert.equal(solid.haze()[0], 0, 'every step shaded - the ones whose ground lies past the square read its edge');
  // THE SKY MAP IN THE MASK: the composite's own parametrisation - azimuth atan(x, z) over a turn, elevation over a
  // right angle - read at the pixel's world direction (the elevation's sign: up is up)
  const sky = (which) => shaft({ uCloudSkyOn: 1, uViewRot: [1, 0, 0, 0, 0.8, 0.6, 0, -0.6, 0.8], textureLod: (name, uv) => (name === 'uDepth' ? [1, 0, 0, 1] : [0, 0, 0, uv[which]]) });
  for (const uv of [[0.5, 0.5], [0.8, 0.9], [0.2, 0.6]]) {
    const d = sky(0).worldDir(uv);
    assert.ok(d[1] > 0, 'a view tipped up looks at the sky');
    assert.ok(Math.abs(sky(1).skyThrough(uv) - Math.asin(d[1]) / (0.5 * PI)) < 1e-12, `${uv}: its elevation`);
    assert.ok(Math.abs(sky(0).skyThrough(uv) - Math.atan2(d[0], d[2]) / (2 * PI)) < 1e-12, `${uv}: its azimuth`);
  }
  assert.match(COMPOSITE_FS, /float az = atan\(dir\.x, dir\.z\);/);
  assert.match(COMPOSITE_FS, /vec2 uv = vec2\(az \/ \(2\.0 \* PI\), max\(el, 0\.0\) \/ \(0\.5 \* PI\)\);/, '...the same texel the sky is drawn from');
  // the gates and the composition, as structure
  const fs = SHAFT_FS;
  assert.match(fs, /if \(sigma <= 0\.0 \|\| uLightDir\.y <= 0\.05 \|\| uCloudShadowRect\.w <= 0\.0\) return vec3\(0\.0\);/, 'the shader\'s own gate, the pass\'s');
  assert.match(fs, /return sky \* near > 0\.0 \? sky \* near \* skyThrough\(uv\) : 0\.0;/, 'the beams\' mask carries it');
  assert.match(fs, /if \(uCloudSkyOn <= 0\.0\) return 1\.0;/, 'no sky map: the mask as it was');
  assert.match(fs, /vec3 c = haze\(\);\n  if \(uSunOn > 0\.0\) c \+= beams\(\);/, 'the haze needs the sun up, the beams need it on screen');
  assert.match(fs, /return uSunColor \* \(acc \/ \d+\.0 \* uShaftParams\.y \* through \* through\);/, 'VC6c: the covered-sun gate, exactly as Mac asked it');
  assert.match(read('src/render/volumetricClouds.js'), /vec3 p = vec3\(g\.x, 0\.0, g\.y\) \+ uLightDir \* t;/, 'the shadow march starts its ray on the ground the haze reads');
});
