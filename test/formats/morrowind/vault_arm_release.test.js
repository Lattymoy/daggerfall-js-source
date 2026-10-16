// VAULT-HANDS: the third-person arms must stop chasing a hold the rising body cannot reach.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { applyClimbRig, climbBones, climbRequestToRig, climbRequestToFirstPerson } from '../../../src/combat/climbRig.js';
import { ClimbPose, climbRigInput } from '../../../src/player/climb/climbPose.js';
import { PlayerMotor } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import { PeerClimbTrack } from '../../../src/net/peer/peerClimb.js';
import { MW_UNITS_PER_METER as U } from '../../../src/formats/morrowind/mwFirstPerson.js';

const retail = () => buildSkeleton(parseNif(new Uint8Array(readFileSync(new URL(
  '../../../vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif', import.meta.url)))));
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const plus = (a, b) => a.map((v, i) => v + b[i]);
const mats = (sk, pose) => skeletonSpaceMatrices(sk, pose, GRAPH_ROOT);
const poseWith = (sk, req) => {
  const pose = poseSkeleton(sk, null, null, 0);
  applyClimbRig(sk, pose, GRAPH_ROOT, skeletonSpaceMatrices, req);
  return mats(sk, pose);
};
const reach = (m, b) => distance(m.get(b.upper).t, m.get(b.fore).t) + distance(m.get(b.fore).t, m.get(b.hand).t);
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function fenceWorld(top) {
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10]), [0, 1, 2, 0, 2, 3], I);
  col.addMesh('fence', new Float32Array([-3, -1, 1, 3, -1, 1, 3, top, 1, -3, top, 1, -3, -1, 1.2, 3, -1, 1.2, 3, top, 1.2, -3, top, 1.2]),
    [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5], I);
  return col;
}

test('VAULT-HANDS: real vault releases unreachable arms across obstacle heights, frame rates and body scales', () => {
  const sk = retail(), bones = climbBones(sk);
  for (const top of [0.7, 1, 1.15]) for (const fps of [30, 60, 144]) {
    const motor = new PlayerMotor(fenceWorld(top), { speed: 50, running: 30 }, {
      parkour: { enabled: () => true, inputs: () => ({ climbing: 50 }) },
    });
    motor.spawn(0, 0.02, 0.4);
    const law = new ClimbPose();
    let vaultFrames = 0, checked = 0;
    for (let i = 0; i < 2.5 * fps; i++) {
      const time = i / fps;
      motor.update(1 / fps, { forward: time >= 5 / 60 && time < 1 ? 1 : 0,
        strafe: 0, run: false, jump: i === Math.round(fps / 6), crouch: false }, 0);
      const c = climbRigInput(motor, 0), out = law.update(1 / fps, c);
      if (c?.move?.kind !== 'vault') continue;
      vaultFrames++;
      for (const [weight, height] of [[1, 1], [0.85, 0.9], [1.15, 1.1]]) {
        const req = climbRequestToRig(out, { feet: c.feet, yaw: c.yaw, unitsPerMetre: U, weight, height });
        const ungripped = poseWith(sk, { ...req, hands: null });
        const posed = poseWith(sk, req);
        for (const s of ['L', 'R']) {
          const b = bones[s];
          if (req.hands[s] && distance(ungripped.get(b.upper).t, req.hands[s].at) > reach(ungripped, b) * 1.2) {
            checked++;
            assert.ok(distance(posed.get(b.hand).t, ungripped.get(b.hand).t) / U < 0.0001,
              `${top}m / ${fps}fps / ${weight},${height} / ${s}: unreachable grip still changes wrist`);
            for (const ref of [b.upper, b.fore, b.hand, ...b.fingers.flat()]) {
              assert.ok(distance([...posed.get(ref).a], [...ungripped.get(ref).a]) < 0.0001, 'released arm/fingers use the animation');
            }
          }
          for (const [a, z] of [[b.upper, b.fore], [b.fore, b.hand]]) {
            assert.ok(Math.abs(distance(posed.get(a).t, posed.get(z).t) - distance(ungripped.get(a).t, ungripped.get(z).t)) / U < 0.0001, 'bone lengths preserved');
          }
        }
      }
    }
    assert.ok(vaultFrames > 0 && checked > 0, 'real vault and out-of-reach frames exercised');
    assert.ok(!motor.climbMove && motor.grounded, 'vault completed and landed');
  }
});

test('VAULT-HANDS: reachable grips remain planted; release blends continuously before full extension', () => {
  const sk = retail(), bones = climbBones(sk), base = mats(sk, poseSkeleton(sk, null, null, 0));
  for (const s of ['L', 'R']) {
    const b = bones[s], shoulder = base.get(b.upper).t, length = reach(base, b);
    const goal = (ratio) => plus(shoulder, [0, ratio * length, 0]);
    const request = (ratio, releaseAtReach) => ({ w: 1, hands: { [s]: { at: goal(ratio), w: 1, releaseAtReach, pole: [s === 'R' ? 1 : -1, 0, -1] } } });
    const planted = poseWith(sk, request(0.7, true));
    assert.ok(distance(planted.get(b.hand).t, goal(0.7)) < 0.001, 'reachable hand still takes the hold');
    const far = poseWith(sk, request(1.2, true));
    assert.ok(distance(far.get(b.hand).t, base.get(b.hand).t) < 0.001, 'out-of-reach hand returns to the animated wrist');
    const ordinary = poseWith(sk, request(1.2, false));
    assert.ok(distance(ordinary.get(b.hand).t, base.get(b.hand).t) > 1, 'other climb modes retain their existing solve');
    let prev = null, blended = false;
    for (let i = 0; i <= 250; i++) {
      const ratio = 0.75 + i / 1000;
      const frame = poseWith(sk, request(ratio, true));
      const p = frame.get(b.hand).t;
      if (prev) assert.ok(distance(p, prev) / length < 0.03, 'no release-threshold wrist snap');
      if (ratio > 0.85 && ratio < 0.98 && distance(p, goal(ratio)) > length * 0.05 && distance(p, base.get(b.hand).t) > length * 0.05) blended = true;
      prev = p;
    }
    assert.ok(blended, 'release uses intermediate poses, not an on/off switch');
  }
});

test('VAULT-HANDS: remote vaults release unreachable hands through the same pose path', () => {
  const sk = retail(), b = climbBones(sk), track = new PeerClimbTrack(), law = new ClimbPose();
  let checked = 0;
  for (let i = 0; i < 30; i++) {
    const c = track.input({ cl: 3, ck: 4, cw: 0, cy: 100, cd: 60 }, [0, i / 30, i / 60], 0, i * 1000 / 60, null);
    const req = climbRequestToRig(law.update(1 / 60, c), { feet: c.feet, yaw: c.yaw, unitsPerMetre: U });
    const plain = poseWith(sk, { ...req, hands: null }), posed = poseWith(sk, req);
    for (const s of ['L', 'R']) if (req.hands[s] && distance(plain.get(b[s].upper).t, req.hands[s].at) > reach(plain, b[s]) * 1.2) {
      checked++;
      assert.ok(distance(plain.get(b[s].hand).t, posed.get(b[s].hand).t) < 0.001);
    }
  }
  assert.ok(checked > 0);
});

test('VAULT-HANDS: both modelled views receive the vault release, which clears on the next climb', () => {
  const law = new ClimbPose();
  const move = { kind: 'vault', from: [0, 0, 0], up: [0, 1.08, 0], to: [0, 1.08, 1], split: 0.4, t: 0.2 };
  const world = law.update(1 / 60, { feet: [0, 0.5, 0], yaw: 0, move });
  const map = { feet: [0, 0.5, 0], yaw: 0, unitsPerMetre: U };
  assert.equal(climbRequestToRig(world, map).hands.R.releaseAtReach, true);
  const fpMap = { eye: [0, 1.7, -1], yaw: 0, pitch: 0, fov: 1.2, lensFov: 1, rigEye: [0, 0, 100], unitsPerMetre: U };
  const fp = climbRequestToFirstPerson(world, fpMap);
  assert.equal(fp.hands.R.releaseAtReach, true);
  assert.ok(fp.hands.R.reachAt && fp.hands.R.ray, 'first person keeps both world reach and screen projection');
  const hang = law.update(1 / 60, { feet: [0, 0, 0], yaw: 0, mode: 'hang', normal: [0, 0, -1], lipY: 1.8, grip: 1 });
  assert.ok(!climbRequestToRig(hang, { ...map, feet: [0, 0, 0] }).hands.R.releaseAtReach, 'flag does not leak into hanging');
  assert.ok(!climbRequestToFirstPerson(hang, fpMap).hands.R.releaseAtReach, 'first-person hanging keeps its previous solve');
});
