// @ts-check
// ARM-BEHIND (2026-10-31, the owner: "the arm auras dont really hide behind the torso"; bible/04-Characters/Aura-Armory.md
// section 6): a sprite's arm piece is kept on the eye's side of the screen's upright line at its band's inner edge, so
// it never runs over the painted body - the clip's law, the draws it rides on, the shader's discard and the pass's upload.
// The pictures are tools/armoryProbe.mjs's and tools/armorySpriteProbe.mjs's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';
import { armClip, armWornSide, armoryDraws, armoryPrograms, ArmoryRenderer, ARMORY_PIECE_INDEX } from '../../src/render/armoryPass.js';
import { newPose, POSE_AT } from '../../src/render/armoryPose.js';

const kept = (/** @type {number[]} */ c, /** @type {number[]} */ p) => c[0] * p[0] + c[1] * p[1] + c[2] * p[2] + c[3] >= 0;
const towardEye = (/** @type {number[]} */ p, /** @type {number[]} */ eye, /** @type {number} */ t) => p.map((v, i) => v + (eye[i] - v) * t);

test('ARM-BEHIND the clip (PIN MOVED, AUDIT AURA-PIXEL C2/C3): an arm\'s piece kept on the arm\'s side of its inner edge running along the arm, sh to el, half its width in toward the chest - for either arm, on a card turned any way, a slanted arm\'s own outline kept at the shoulder, and a point lifted toward the eye on the same side (mutants: the edge at the arm\'s middle; the side reversed; a plane not through the eye; the edge upright)', () => {
  for (const yaw of [0, 0.7, -2.1]) {
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)], at = [2, 0, -1], eye = [at[0] + 3 * Math.sin(yaw), 1.4, at[2] + 3 * Math.cos(yaw)];
    const on = (/** @type {number} */ dx, /** @type {number} */ y) => [at[0] + right[0] * dx, y, at[2] + right[2] * dx];
    const chest = on(0.02, 1.3);
    for (const sgn of [1, -1]) {
      // a slanted arm: its middle 0.22 m out at the shoulder (1.45 m), 0.32 m out at the elbow (1.05 m), 0.1 m wide
      const sh = on(0.22 * sgn, 1.45), el = on(0.32 * sgn, 1.05), c = /** @type {number[]} */ (armClip(sh, el, 0.05, chest, right, eye));
      assert.ok(Math.abs(Math.hypot(c[0], c[1], c[2]) - 1) < 1e-9 && Math.abs(c[0] * eye[0] + c[1] * eye[1] + c[2] * eye[2] + c[3]) < 1e-9, 'unit, through the eye');
      for (const t of [0, 0.5, 1]) {
        const y = 1.45 - 0.4 * t, mid = (0.22 + 0.1 * t) * sgn;
        assert.ok(kept(c, on(mid, y)) && kept(c, on(mid - 0.04 * sgn, y)) && kept(c, on(mid + 0.2 * sgn, y)), `the arm kept, its own inner side too (yaw ${yaw}, ${sgn}, ${t})`);
        assert.ok(!kept(c, on(mid - 0.06 * sgn, y)) && !kept(c, on(0.02, y)), `the body cut (yaw ${yaw}, ${sgn}, ${t})`);
        assert.ok(kept(c, towardEye(on(mid - 0.04 * sgn, y), eye, 0.02)) && !kept(c, towardEye(on(mid - 0.06 * sgn, y), eye, 0.02)), 'lifted toward the eye, the same');
      }
    }
  }
  assert.equal(armClip([0, 1.4, 0], [0, 1.0, 0], 0.05, [0.1, 1.3, 0], [1, 0, 0], [0.05, 3, 0]), null, 'the eye on the edge\'s own line: none');
});

test('ARM-BEHIND the draws (PIN MOVED, AUDIT AURA-PIXEL C1): on a card every arm piece\'s draws carry their arm\'s clip, its band read or not - the bracers, the armlets, the spurs, the Insignia Armlet; a far arm never read clear wears none; a rig\'s carry none, nor any other piece\'s (mutants: one arm\'s draws left bare; a rig clipped; the far bare arm worn)', () => {
  const card = newPose();
  Object.assign(card, { card: true, limbs: 'upper', bands: { L: { y: 1.3, dx: -0.3, w: 0.1 }, R: { y: 1.3, dx: 0.3, w: 0.1 } } });
  const w = (/** @type {any} */ pose) => ({ at: [0, 0, 0], yaw: 0, pose, seed: 0.37, kindle: 1, torn: -1, mounted: false, _d: 3 });
  const eye = [0, 1.4, 3], right = [1, 0, 0];
  const bare = newPose();
  Object.assign(bare, { card: true, limbs: 'upper', bands: { L: null, R: null } });
  for (const key of ['ashbound', 'eternalarmlets', 'crystalspurs', 'insigniaarmlet']) {
    const ds = armoryDraws(key, w(card), eye, true, right);
    assert.ok(ds.length > 0 && ds.every((d) => Array.isArray(d.clip)), `${key}: every draw clipped`);
    if (key !== 'insigniaarmlet') assert.equal(new Set(ds.map((d) => d.clip)).size, 2, `${key}: each arm its own`);
    assert.ok(armoryDraws(key, w(newPose()), eye, true, right).every((d) => !d.clip), `${key}: a rig\'s never`);
    assert.ok(armoryDraws(key, w(bare), eye, true, right).every((d) => Array.isArray(d.clip)), `${key}: no band read, clipped all the same`);
  }
  // from the front and 45 degrees to the wearer's left, the right arm is the far one: never read clear, it wears none
  const side = [3 * Math.sin(-Math.PI / 4), 1.4, 3 * Math.cos(-Math.PI / 4)];
  assert.deepEqual([armWornSide(bare, [0, 0, 1], [0, 1.3, 0], side, 'left'), armWornSide(bare, [0, 0, 1], [0, 1.3, 0], side, 'right')].map((v) => !!v), [true, false]);
  assert.deepEqual([armWornSide(card, [0, 0, 1], [0, 1.3, 0], side, 'right'), armWornSide(newPose(), [0, 0, 1], [0, 1.3, 0], side, 'right')].map((v) => !!v), [true, true], 'read clear, or a rig: worn');
  assert.equal(armoryDraws('ashbound', w(bare), side, true, right).length < armoryDraws('ashbound', w(card), side, true, right).length, true, 'the bare far arm\'s bracer not drawn');
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

test('CHEST-CENTRE (2026-10-31, the owner: "The aura armory chest piece also isnt centwrwd at some angles"): on a card the chest piece stands on the eye\'s line through the picture\'s chest from every side - the heart before the card from the front and behind it from behind, the Sigil\'s back the other way round; a rig\'s stays its chest\'s face (mutants: the depth along the facing again; the Sigil\'s back 0.24 m behind the card)', () => {
  const card = newPose();
  Object.assign(card, { card: true, limbs: 'upper' });
  const ci = POSE_AT.chest;
  card.dx[ci / 3] = 0.07;   // the picture's chest a little off the card's middle
  const at = [1, 0, -2], right = [1, 0, 0], w = { at, yaw: 0, pose: card, seed: 0.37, kindle: 1, torn: -1, mounted: false, _d: 3 };
  const onPic = [at[0] + 0.07, card.pts[ci + 1], at[2]];   // the picture's chest on the card
  const line = (/** @type {number[]} */ p, /** @type {number[]} */ eye) => {   // how far p stands off the eye's line through the picture's chest
    const d = [onPic[0] - eye[0], onPic[1] - eye[1], onPic[2] - eye[2]], q = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
    const c = [d[1] * q[2] - d[2] * q[1], d[2] * q[0] - d[0] * q[2], d[0] * q[1] - d[1] * q[0]];
    return Math.hypot(...c) / Math.hypot(...d);
  };
  const near = (/** @type {number[]} */ p, /** @type {number[]} */ eye) => Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]) < Math.hypot(onPic[0] - eye[0], onPic[1] - eye[1], onPic[2] - eye[2]);
  for (const deg of [0, 45, 135, 180, 225, 315]) {
    const a = (deg * Math.PI) / 180, eye = [at[0] + 3 * Math.sin(a), 1.5, at[2] + 3 * Math.cos(a)], front = Math.cos(a) > 0;
    const heart = armoryDraws('emberheart', w, eye, true, right).find((d) => d.mesh === 2);
    const sigil = armoryDraws('eternalsigil', w, eye, true, right).filter((d) => d.mesh === 2);
    for (const d of [heart, ...sigil]) assert.ok(d && line(d.A, eye) < 1e-9, `${deg}: on the eye's line through the picture's chest (${d && line(d.A, eye)})`);
    assert.equal(near(heart.A, eye), front, `${deg}: the heart before the card from the front, behind it from behind`);
    assert.equal(near(sigil[1].A, eye), !front, `${deg}: the Sigil's back before the card from behind`);
  }
  const rig = armoryDraws('emberheart', { ...w, pose: newPose() }, [1, 1.5, 1], true, right).find((d) => d.mesh === 2);
  assert.ok(rig && Math.abs(rig.A[2] - (at[2] + newPose().pts[ci + 2])) < 1e-9, 'a rig\'s on its chest\'s face');
});
