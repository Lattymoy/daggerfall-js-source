// @ts-check
// ARM-BEHIND (2026-10-31, the owner: "the arm auras dont really hide behind the torso"; bible/04-Characters/Aura-Armory.md
// section 6): a sprite's arm piece is kept on the eye's side of the screen's upright line at its band's inner edge, so
// it never runs over the painted body - the clip's law, the draws it rides on, the shader's discard and the pass's upload.
// The pictures are tools/armoryProbe.mjs's and tools/armorySpriteProbe.mjs's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';
import { armClip, armoryDraws, armoryPrograms, ArmoryRenderer, ARMORY_PIECE_INDEX } from '../../src/render/armoryPass.js';
import { newPose } from '../../src/render/armoryPose.js';

const kept = (/** @type {number[]} */ c, /** @type {number[]} */ p) => c[0] * p[0] + c[1] * p[1] + c[2] * p[2] + c[3] >= 0;
const towardEye = (/** @type {number[]} */ p, /** @type {number[]} */ eye, /** @type {number} */ t) => p.map((v, i) => v + (eye[i] - v) * t);

test('ARM-BEHIND the clip: an arm\'s piece kept outside its band\'s inner edge, the body\'s side of it cut - for either arm, on a card turned any way, and a point lifted toward the eye on the same side (mutants: the edge at the band\'s middle; the side reversed; a plane not through the eye)', () => {
  for (const yaw of [0, 0.7, -2.1]) {
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)], at = [2, 0, -1], eye = [at[0] + 3 * Math.sin(yaw), 1.4, at[2] + 3 * Math.cos(yaw)];
    const on = (/** @type {number} */ dx, /** @type {number} */ y) => [at[0] + right[0] * dx, y, at[2] + right[2] * dx];
    const chest = on(0.02, 1.3);
    for (const sgn of [1, -1]) {
      const band = { dx: 0.3 * sgn, w: 0.1, y: 1.25 }, mid = on(band.dx, band.y), c = armClip(band, mid, chest, at, right, eye);
      assert.ok(Math.abs(c[1]) < 1e-12 && Math.abs(Math.hypot(c[0], c[2]) - 1) < 1e-9, 'upright, unit');
      assert.ok(Math.abs(c[0] * eye[0] + c[2] * eye[2] + c[3]) < 1e-9, 'through the eye');
      for (const y of [0.9, 1.25, 1.6]) {
        assert.ok(kept(c, on(0.26 * sgn, y)) && kept(c, on(0.4 * sgn, y)), `the arm kept (yaw ${yaw}, ${sgn})`);
        assert.ok(!kept(c, on(0.24 * sgn, y)) && !kept(c, on(0.02, y)), `the body cut (yaw ${yaw}, ${sgn})`);
        assert.ok(kept(c, towardEye(on(0.26 * sgn, y), eye, 0.02)) && !kept(c, towardEye(on(0.24 * sgn, y), eye, 0.02)), 'lifted toward the eye, the same');
      }
    }
  }
});

test('ARM-BEHIND the draws: on a card with its bands read, every draw of an arm piece carries its arm\'s clip - the bracers, the armlets, the spurs, the Insignia Armlet; a rig\'s and a card\'s with no band read carry none, nor any other piece\'s (mutants: one arm\'s draws left bare; a rig clipped)', () => {
  const card = newPose();
  Object.assign(card, { card: true, limbs: 'upper', bands: { L: { y: 1.3, dx: -0.3, w: 0.1 }, R: { y: 1.3, dx: 0.3, w: 0.1 } } });
  const w = (/** @type {any} */ pose) => ({ at: [0, 0, 0], yaw: 0, pose, seed: 0.37, kindle: 1, torn: -1, mounted: false, _d: 3 });
  const eye = [0, 1.4, 3], right = [1, 0, 0];
  for (const key of ['ashbound', 'eternalarmlets', 'crystalspurs', 'insigniaarmlet']) {
    const ds = armoryDraws(key, w(card), eye, true, right);
    assert.ok(ds.length > 0 && ds.every((d) => Array.isArray(d.clip)), `${key}: every draw clipped`);
    if (key !== 'insigniaarmlet') assert.equal(new Set(ds.map((d) => d.clip)).size, 2, `${key}: each arm its own`);
    assert.ok(armoryDraws(key, w(newPose()), eye, true, right).every((d) => !d.clip), `${key}: a rig's never`);
    const bare = newPose();
    Object.assign(bare, { card: true, limbs: 'upper' });
    assert.ok(armoryDraws(key, w(bare), eye, true, right).every((d) => !d.clip), `${key}: no band read, none`);
  }
  for (const key of ['burningcrown', 'emberheart', 'cinderstride']) assert.ok(armoryDraws(key, w(card), eye, true, right).every((d) => !d.clip), key);
});

test('ARM-BEHIND the shader RUN and the pass: a fragment on the cut side discarded, on the kept side drawn, a clip of nought keeps all; the pass hands each draw its clip and nought for one with none (mutants: the discard gone; the clip never uploaded)', () => {
  const fs = armoryPrograms(ARMORY_PIECE_INDEX.crystalspurs)[0][1];
  const run = (/** @type {number[]} */ uClip, /** @type {number[]} */ vWorld) => {
    const f = glslFunctions(fs, { vArm: [0.5, 0.5], vS: [1, 0.1, 0, 0], vWorld, uMesh: 0, uPart: 0, uTime: 3, uSeed: 0, uKindle: 1, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1, 3], uFace: 1, uScale: 1, uSize: 0, uGain: 1, uMirror: 1, uInk: [0, 0, 0], uField: [0, 0, 0], uClip });
    try { f.main(); return 'drawn'; } catch (e) { if (e instanceof GlslDiscard) return 'discarded'; throw e; }
  };
  assert.deepEqual([run([1, 0, 0, -0.25], [0.2, 1, 0]), run([1, 0, 0, -0.25], [0.3, 1, 0]), run([0, 0, 0, 0], [0.2, 1, 0])], ['discarded', 'drawn', 'drawn']);
  const calls = /** @type {any[]} */ ([]);
  const gl = new Proxy({}, { get: (_, k) => (typeof k === 'string' && /^[A-Z][A-Z_0-9]*$/.test(k) ? 1 : (/** @type {any[]} */ ...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return k === 'getExtension' ? null : {}; }) });
  const pass = new ArmoryRenderer(/** @type {any} */ (gl)), I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const card = newPose();
  Object.assign(card, { card: true, limbs: 'upper', bands: { L: { y: 1.3, dx: -0.3, w: 0.1 }, R: { y: 1.3, dx: 0.3, w: 0.1 } } });
  const clips = () => calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uClip').map((c) => Array.from(c[2]));
  pass.draw([{ kit: '00a00', at: [0, 0, 0], yaw: 0, pose: card, kindle: 1, torn: -1, _d: 3 }], I, I, [0, 1.4, 3], 1, null, true);
  assert.ok(clips().length > 0 && clips().every((c) => Math.hypot(c[0], c[2]) > 0.99), `${JSON.stringify(clips())}`);
  calls.length = 0;
  pass.draw([{ kit: '00a00', at: [0, 0, 0], yaw: 0, pose: newPose(), kindle: 1, torn: -1, _d: 3 }], I, I, [0, 1.4, 3], 2, null, true);
  assert.ok(clips().length > 0 && clips().every((c) => c.every((v) => v === 0)), 'a rig\'s: nought');
});
