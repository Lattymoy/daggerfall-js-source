// VAULT-HANDS v2: first-person Morrowind arms must release world holds, not keep chasing a projected ray.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { applyClimbRig, climbBones, climbRequestToFirstPerson } from '../../../src/combat/climbRig.js';
import { ClimbPose } from '../../../src/player/climb/climbPose.js';
import { planVault, movePoint } from '../../../src/player/parkour.js';
import { createFpArm } from '../../../src/combat/fpArm.js';
import { MW_UNITS_PER_METER as U } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { fixtureBodyDeps, countingRenderer } from '../../fixtures/mw/bodyRig.mjs';

const retail = () => buildSkeleton(parseNif(new Uint8Array(readFileSync(new URL(
  '../../../vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif', import.meta.url)))));
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const matrix = (sk, p) => skeletonSpaceMatrices(sk, p, GRAPH_ROOT);
const posed = (sk, req) => {
  const p = poseSkeleton(sk, null, null, 0);
  applyClimbRig(sk, p, GRAPH_ROOT, skeletonSpaceMatrices, req);
  return matrix(sk, p);
};
const view = { eye: [0, 1.7, 0], yaw: 0, pitch: 0, fov: Math.PI / 3,
  lensFov: Math.PI / 3, lensPitch: 0, rigEye: [0, 0, 125], unitsPerMetre: U };
const handRequest = (at, releaseAtReach = true) => ({ w: 1, hands: { R: {
  at, w: 1, fingers: [0, 0, 1], palm: [0, -1, 0], pole: [1, 0, 0], curl: 0.2, releaseAtReach,
} } });

test('VAULT-HANDS FP: a distant world grip on the same screen ray releases the arm', () => {
  const sk = retail(), b = climbBones(sk).R, base = matrix(sk, poseSkeleton(sk, null, null, 0));
  const shoulder = base.get(b.upper).t;
  const rigHold = [shoulder[0], shoulder[1] + 23, shoulder[2]];
  const delta = rigHold.map((v, i) => (v - view.rigEye[i]) / U);
  const near = [delta[0], view.eye[1] + delta[2], delta[1]];
  const far = near.map((v, i) => view.eye[i] + (v - view.eye[i]) * 10);
  const nearReq = climbRequestToFirstPerson(handRequest(near), view);
  const farReq = climbRequestToFirstPerson(handRequest(far), view);
  assert.ok(distance(nearReq.hands.R.ray.dir, farReq.hands.R.ray.dir) < 1e-9, 'same screen position');
  const nearPose = posed(sk, nearReq), farPose = posed(sk, farReq);
  assert.ok(distance(nearPose.get(b.hand).t, base.get(b.hand).t) > 1, 'reachable grip still poses the arm');
  assert.ok(distance(farPose.get(b.hand).t, base.get(b.hand).t) < 0.001, 'distant grip no longer drags the arm along its ray');
  for (const ref of [b.upper, b.fore, b.hand, ...b.fingers.flat()]) {
    assert.ok(distance([...farPose.get(ref).a], [...base.get(ref).a]) < 0.001, 'arm and fingers return to animation');
  }
});

test('VAULT-HANDS FP: world reach is independent of field of view', () => {
  const at = [0.15, 1.5, 0.4];
  const a = climbRequestToFirstPerson(handRequest(at), view);
  const b = climbRequestToFirstPerson(handRequest(at), { ...view, fov: Math.PI / 2 });
  assert.ok(a.hands.R.reachAt && b.hands.R.reachAt, 'a physical target accompanies the rendering ray');
  assert.ok(distance(a.hands.R.reachAt, b.hands.R.reachAt) < 1e-9, 'FOV cannot change physical arm reach');
  assert.ok(distance(a.hands.R.ray.dir, b.hands.R.ray.dir) > 0.01, 'screen projection still follows FOV');
});

test('VAULT-HANDS FP: grip fades before crossing the camera plane, without changing non-vault grips', () => {
  const get = (z, vault) => climbRequestToFirstPerson(handRequest([0.1, 1.5, z], vault), view)?.hands.R?.w ?? 0;
  assert.ok(get(0.051, true) < 0.001, 'almost released before the existing behind-camera cutoff');
  assert.ok(get(0.15, true) > 0.1 && get(0.15, true) < 0.9, 'intermediate grip weight');
  assert.equal(get(0.4, true), 1, 'full grip ahead');
  assert.equal(get(0.051, false), 1, 'hanging/climbing keep their prior map');
  assert.equal(get(0.049, true), 0, 'no grip behind the cutoff');
});

test('VAULT-HANDS FP: vault ascent releases in both camera modes across pitch/FOV and preserves bone lengths', () => {
  const sk = retail(), bones = climbBones(sk), base = matrix(sk, poseSkeleton(sk, null, null, 0));
  let visibleFarCases = 0;
  for (const fov of [Math.PI / 3, Math.PI / 2]) for (const pitch of [-0.6, 0, 0.3]) for (const fixed of [true, false]) {
    const law = new ClimbPose();
    const m = planVault([0, 0, 0], { rise: 1, into: [0, 0, 1] }, { up: [0, 1.08, 0], over: [0, 1.08, 1] }, 50, 4);
    for (let i = 0; i <= 40; i++) {
      m.t = i / 60;
      const feet = movePoint(m, m.t), world = law.update(m.dur / 60, { feet, yaw: 0, move: m });
      const req = climbRequestToFirstPerson(world, { ...view, eye: [feet[0], feet[1] + 1.7, feet[2]], fov, pitch, lensPitch: fixed ? 0 : pitch });
      const mat = posed(sk, req);
      for (const s of ['L', 'R']) {
        const b = bones[s];
        const lengths = [[b.upper, b.fore], [b.fore, b.hand]];
        for (const [a, z] of lengths) assert.ok(Math.abs(distance(mat.get(a).t, mat.get(z).t) - distance(base.get(a).t, base.get(z).t)) < 0.001, 'bone lengths');
        if (m.t >= 0.4 && m.t <= 0.55 && req?.hands[s]) {
          visibleFarCases++;
          assert.ok(distance(mat.get(b.hand).t, base.get(b.hand).t) < 0.001, 'body above obstacle: first-person wrist is released');
        }
      }
    }
  }
  assert.ok(visibleFarCases > 0, 'actually exercised visible distant holds, not just culled ones');
});

test('VAULT-HANDS FP: the actual Morrowind rig update releases unreachable vault hands and survives interruption/view switching', async () => {
  const cam = { pos: [0, 2.8, 0], yaw: 0, pitch: 0, bob: [0, 0],
    move: { grounded: false, forward: 0, strafe: 0, speed: 0 }, climb: null };
  const make = async (camera) => {
    const arm = createFpArm();
    arm.attach(countingRenderer(), () => camera);
    const result = await arm.build({ race: 'fprace', deps: fixtureBodyDeps() });
    assert.equal(result.ok, true);
    return { arm, result };
  };
  const controlCam = { ...cam }, control = await make(controlCam), actual = await make(cam);
  const move = { kind: 'vault', from: [0, 0, 0], up: [0, 1.08, 0], to: [0, 1.08, 1], split: 0.4, t: 0.5 };
  cam.climb = { feet: [0, 1.1, 0], yaw: 0, move };
  const bones = climbBones(actual.result.arm.skeleton);
  for (let i = 0; i < 25; i++) {
    cam.pitch = controlCam.pitch = [0, -0.4, 0.3][i % 3];
    cam.yaw = controlCam.yaw = i % 2 ? 0.2 : -0.2;
    actual.arm.setFollowCamera(i % 2 === 0); control.arm.setFollowCamera(i % 2 === 0);
    if (i === 10) { cam.climb = null; cam.pos = [1, 3, 0]; }
    if (i === 15) { assert.equal(actual.arm.setViewMode('third'), true); assert.equal(control.arm.setViewMode('third'), true); }
    if (i === 16) { assert.equal(actual.arm.setViewMode('first'), true); assert.equal(control.arm.setViewMode('first'), true); }
    actual.arm.update(1 / 60); control.arm.update(1 / 60);
    if (i === 15) continue;
    for (const s of ['L', 'R']) {
      assert.ok(distance(actual.result.arm.mats.get(bones[s].hand).t, control.result.arm.mats.get(bones[s].hand).t) < 0.001, 'actual first-person update uses physical reach');
    }
    for (let piece = 0; piece < actual.result.arm.pieces.length; piece++) {
      const a = actual.result.arm.pieces[piece].positions, c = control.result.arm.pieces[piece].positions;
      assert.ok(a.every((v, j) => Number.isFinite(v) && Math.abs(v - c[j]) < 0.001), 'skinned/rigid arm vertices match the released animation');
    }
  }
});
