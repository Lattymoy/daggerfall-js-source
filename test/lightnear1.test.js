// LIGHT-NEAR1 (2026-09-23, kurkku on Discord, with video: "shadows disappear seemingly when you're too close to
// the light source" - a tavern lamp at head height, the shadows gone as the player walks under it): THERE IS NO
// CAMERA-DISTANCE RULE ANY MORE.
//
// F3 (2026-09-17) kept the light in the hand out of the caster slots by a proxy - "within 1.5 of the eye"
// (SHADOW_CASTER_MIN_DISTANCE, and AIR_GLARE_MIN_DISTANCE for the glare, pinned to be the same number) - and
// MAC-T1 replaced that proxy with the fact BY NAME: the torch and candle records say `carried`, every host with
// a player light composes through withPlayerLights, and the caster pick, the contact march (-2 in the caster
// table) and the glare skip a carried light in any camera. The proxy stayed beside the flag, and it was never
// the hand's alone: a hanging lantern is 2.6-3.2 up and the eye is 1.7, so within about a unit of it the
// nearest, brightest light in the room lost its cube map AND its contact march AND its glare in one step. This
// file pins the law as it is now - the hand's light is excluded by its flag, a scene light by nothing about
// its distance to the eye - in the picker, on the fake GL (the glare count), by shader text, and by the hosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, EL_MESH_FS } from '../src/render/enhancedLighting.js';
import { pickShadowCasters, pickShadowCaster, SHADOW_POINT_CASTERS } from '../src/render/shadowPass.js';
import { withPlayerLights } from '../src/scenes/magicCandle.js';
import { playerTorchLight } from '../src/systems/playerTorch.js';
import { perspective, mirrorProjectionX } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── THE FAKE GL (test/mact_bugs.test.js's rig, copied - each file carries its own) ──────────────
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
function drawWorld(r) {
  r.textures.set('1_1', { id: 't11' }); r.textures.set('210_1', { id: 't2101' });
  const mesh = { vao: { id: 'vao-m' }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const batch = { archive: 210, record: 1, vao: { id: 'vao-b' }, indexCount: 6, size: { w: 1, h: 2 }, origin: [1, 0, 1] };
  r.drawMesh(mesh, I, null);
  r.drawBillboards([batch], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
}
/** Two frames on the fake GL: the lights set, the world drawn, the first screen quad resolving the images - the
 *  glare count and the glare centres are the observables (el3_air's shape). The eye is at the origin (the identity
 *  view): a torch 3 units in front of it is the THIRD-PERSON case, well past the 1.5 the old camera-distance proxy read (LIGHT-NEAR1: gone). */
function glareFrame(lights) {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  const ap = r.air;
  r.setLighting(new Float32Array([0.5, 0.5, 0.5]), 0.55, new Float32Array([1, 1, 1]));
  const sun = new Float32Array([0.3, 0.8, -0.2]);
  const P = mirrorProjectionX(perspective(1, 1.6, 0.5, 6000));
  r.beginFrame(P, I, sun, WORLD_FRAME); drawWorld(r); r.drawScreenQuad({ id: 'hud' }, { x: 0, y: 0, w: 10, h: 10 });
  r.setPointLights(lights, new Float32Array([1, 0.7, 0.4]));
  r.beginFrame(P, I, sun, WORLD_FRAME); drawWorld(r);
  calls.length = 0;
  r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
  const centres = calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uCenter').map((c) => c.slice(2));
  return { r, ap, centres };
}
const torchEntity = { _torch: { range: 14 } };

test('LIGHT-NEAR1: the picker - a lamp overhead, a hand\'s width from the eye, is the nearest caster; the hand\'s own light is passed over by its flag alone (mutants: the 1.5 lower bound back, so the lamp loses its slot; the flag ignored)', () => {
  const eye = [0, 1.7, 0];
  const lamp = [0.2, 2.6, 0.3, 15];       // a hanging lantern (interiorLights.js: range 15) a unit up and a hand's width off - 0.96 from the eye
  const wall = [4, 2, 0, 12];             // a wall torch across the room
  const hand = [0.34, 1.0, -0.25, 14];    // Handheld Torches' flame, 0.8 away
  const lights = new Float32Array([...hand, ...lamp, ...wall]);
  assert.deepEqual(pickShadowCasters(lights, eye, SHADOW_POINT_CASTERS, new Uint8Array([1, 0, 0])), [1, 2], 'the lamp first, the wall torch second, the hand never');
  assert.equal(pickShadowCaster(lights, eye, new Uint8Array([1, 0, 0])), 1, 'the nearest caster is the lamp - the one the old rule dropped');
  assert.deepEqual(pickShadowCasters(lights, eye), [0, 1, 2], 'with no mask, nothing about distance excludes any of them');
  // right under it - the eye 0.3 from the light - it still casts: there is no distance under which a scene light is "the eye\'s own"
  assert.deepEqual(pickShadowCasters(new Float32Array([0, 2.0, 0, 15]), eye), [0]);
  // the signature: (lights, eye, max, carried) and (lights, eye, carried) - no minimum-distance argument to pass a stale number through
  assert.equal(pickShadowCasters.length, 2, 'lights, eye - max and carried default');
  assert.equal(pickShadowCaster.length, 2);
});

test('LIGHT-NEAR1: on the fake GL, a lantern a hand\'s width from the eye still draws its glare sprite, and the carried torch beside it still does not (mutant: the camera-distance glare skip back)', () => {
  const near = new Float32Array([0.3, 0.9, -0.4, 14]);   // a lantern 1.06 from the eye at the origin - under the old 1.5
  const torch = playerTorchLight(torchEntity, [0, -0.9, -0.2], 0);   // the first-person torch, carried
  assert.equal(torch.carried, true);
  const on = glareFrame(withPlayerLights(near, torch));
  assert.equal(on.ap.stats.glares, 1, 'one glare - the lantern\'s, a hand\'s width from the eye; none for the torch');
  assert.deepEqual(on.centres.map((c) => c.map((v) => +v.toFixed(2))), [[0.3, 0.9, -0.4]]);
  const bare = glareFrame(near);
  assert.equal(bare.ap.stats.glares, 1, 'and with no mask at all the lantern glares - distance excludes nothing');
});

test('LIGHT-NEAR1: by source - the two constants are gone, the shader\'s contact fallback reads the caster table and the range share alone, the glare loop reads the flag alone, and the picker\'s call passes the mask and nothing else (mutants: any of the three distance clauses back)', () => {
  const sp = rd('src/render/shadowPass.js'), el = rd('src/render/enhancedLighting.js'), air = rd('src/render/airPass.js');
  assert.doesNotMatch(sp, /export const SHADOW_CASTER_MIN_DISTANCE/);
  assert.doesNotMatch(air, /export const AIR_GLARE_MIN_DISTANCE/);
  assert.doesNotMatch(el, /SHADOW_CASTER_MIN_DISTANCE|uCamPos\) < /, 'the lit block reads no camera distance for a shadow');
  assert.match(EL_MESH_FS, /float sh = k >= 0 \? pointShadowAt\(k, wp, n\)\n\s*: \(k == -2 \|\| d > uPointLights\[i\]\.w \* 0\.7\) \? 1\.0/, 'the fallback: the hand by name, the range share, nothing else');
  assert.match(sp, /const casters = pickShadowCasters\(f\.pointLights, f\.eye, SHADOW_POINT_CASTERS, f\.carried, this\._heldCasters, this\._heldCasterN\);/);   // DISC6: and last frame's casters (the keep margin) - no distance clause
  assert.doesNotMatch(sp, /d < minDist/);
  assert.doesNotMatch(air, /Math\.hypot\(L\[i \* 4\] - eye\[0\]/, 'no glare skip by distance to the eye');
  assert.match(air, /if \(f\.carried && f\.carried\[i\]\) continue;   \/\/ MAC-T1/);
});

test('LIGHT-NEAR1: the hosts - every host that composes a player light does it through withPlayerLights (the mask is the whole of the hand\'s exclusion now), and the standalone interior scene, which has no player light, is the one bare setPointLights', () => {
  const w = rd('src/scenes/world.js'), ex = rd('src/scenes/exterior.js'), wm = rd('src/scenes/worldModes.js'), dg = rd('src/scenes/dungeon.js'), it = rd('src/scenes/interior.js');
  const composed = (src) => (src.match(/withPlayerLights\(/g) ?? []).length;
  const torches = (src) => (src.match(/playerTorchLight\(playerEntity/g) ?? []).length;
  assert.equal(composed(w), torches(w), 'world.js: every torch composed');
  assert.ok(composed(w) >= 2);
  assert.equal(composed(ex), torches(ex)); assert.ok(composed(ex) >= 1);
  assert.equal(composed(wm), torches(wm)); assert.ok(composed(wm) >= 2, 'the dungeon and the interior modes');
  assert.equal(composed(dg), torches(dg)); assert.ok(composed(dg) >= 1);
  assert.equal(torches(it), 0, 'the standalone interior scene carries no torch...');
  assert.match(it, /renderer\.setPointLights\(lit\.data, null, lit\.colors\);/, '...so its bare call has no hand to mask');
  assert.match(wm, /renderer\.setPointLights\(_itLit\.data, null, _itLit\.colors\);/, 'the interior mode\'s call hands the composed array, whose `carried` the renderer lifts');
  assert.match(rd('src/render/renderer.js'), /const carried = data\.carried \?\? null;/);
});
