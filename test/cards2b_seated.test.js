// CARDS2b (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 12; Mac: "a sort of table enviroment where you can
// see other players sprites"): THE SEATED BODY. Driven: the seated request's every point (player/seatPose.js) at two
// facings, its mapping into the rig's space (the climb rig's climbRequestToRig), and the pose SOLVED on retail's own
// biped - the hips level with the knees, the shins standing, the feet and the hands on their marks, the head lowered to
// the seated eye; the wire's `st` (bounded, omitted standing, sent at once, eased whole); the peer's seat request and its
// stillness. Held by source: the body drawn at the seat, the request handed to the rig, the third person following it,
// the pose the sender says, a hit and Escape standing you up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SEAT_TOP_STEP, SEAT_TOP_DEFAULT, SEAT_HIP_DROP, SEATED_EYE_HEIGHT, SEAT_FOOT_AHEAD, SEAT_FOOT_SIDE, SEAT_ANKLE,
  SEAT_HAND_AHEAD, SEAT_HAND_SIDE, SEAT_HAND_OVER, SEAT_LOOK_WEIGHT, seatTopByte, seatTopOf, seatRigInput,
} from '../src/player/seatPose.js';
import { EYE_HEIGHT } from '../src/player/motor.js';
import { parseNif } from '../src/formats/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../src/formats/mwSkin.js';
import { applyClimbRig, climbBones, climbRequestToRig } from '../src/combat/climbRig.js';
import { MW_UNITS_PER_METER } from '../src/formats/mwFirstPerson.js';
import { validPose, poseChanged, POSE_SEAT_TOP_MAX } from '../src/net/wire.js';
import { lerpPose } from '../src/net/online.js';
import { peerCamera, seatFor } from '../src/net/peerBodies.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const r3 = (v) => Math.round(v * 1000) / 1000;
const pt = (p) => p.map(r3);
const U = MW_UNITS_PER_METER;
const RETAIL = 'vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif';
const POSE = { x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0, mv: 0 };

test('CARDS2b the table\'s top on the wire: 5 cm steps, 1..40, and back', () => {
  assert.equal(POSE_SEAT_TOP_MAX, 40);
  assert.equal(SEAT_TOP_STEP, 0.05);
  assert.deepEqual([0.8, 0.77, 0.01, 0, -1, 2, 5, NaN].map(seatTopByte), [16, 15, 1, 1, 1, 40, 40, 1]);
  assert.deepEqual([16, 1, 40].map((b) => r3(seatTopOf(b))), [0.8, 0.05, 2]);
  assert.deepEqual([0, 41, 1.5, '16', undefined].map(seatTopOf), [SEAT_TOP_DEFAULT, SEAT_TOP_DEFAULT, SEAT_TOP_DEFAULT, SEAT_TOP_DEFAULT, SEAT_TOP_DEFAULT]);
});

test('CARDS2b the seated request: the hips dropped, the feet and the hands on their marks, the head on the table', () => {
  assert.deepEqual([SEAT_HIP_DROP, SEAT_FOOT_AHEAD, SEAT_FOOT_SIDE, SEAT_ANKLE, SEAT_HAND_AHEAD, SEAT_HAND_SIDE, SEAT_HAND_OVER, SEAT_LOOK_WEIGHT],
    [0.48, 0.45, 0.12, 0.08, 0.45, 0.2, 0.04, 0.6]);
  assert.equal(r3(SEATED_EYE_HEIGHT), r3(EYE_HEIGHT - SEAT_HIP_DROP), 'the seated eye is the standing eye lowered by the drop');
  // Facing +z (yaw 0): forward [0,0,1], right [1,0,0]; the left limbs at -x.
  const s = seatRigInput([10, 1, 20], 0, 0.8);
  assert.deepEqual(s.origin, [10, 1, 20]);
  assert.equal(s.yaw, 0);
  const q = s.req;
  assert.equal(q.w, 1);
  assert.deepEqual(q.offset, [0, -0.48, 0]);
  assert.deepEqual([q.feet.L.at, q.feet.R.at].map(pt), [[9.88, 1.08, 20.45], [10.12, 1.08, 20.45]]);
  assert.deepEqual([q.feet.L.toe, q.feet.L.pole, q.feet.L.w], [[0, 0, 1], [0, 0, 1], 1], 'the toes and the knees forward');
  assert.deepEqual([q.hands.L.at, q.hands.R.at].map(pt), [[9.8, 1.84, 20.45], [10.2, 1.84, 20.45]]);
  assert.deepEqual([q.hands.L.fingers, q.hands.L.palm, q.hands.L.w, q.hands.L.curl], [[0, 0, 1], [0, -1, 0], 1, 0.3], 'the fingers forward, the palms down');
  assert.deepEqual([q.hands.L.pole, q.hands.R.pole].map(pt), [[-0.707, -0.707, 0], [0.707, -0.707, 0]], 'the elbows out and down');
  assert.deepEqual([pt(q.look.at), q.look.w], [[10, 1.8, 21], 0.6]);
  // Facing +x (yaw PI/2): forward [1,0,0], right [0,0,-1] - the same pose turned.
  const t = seatRigInput([0, 0, 0], Math.PI / 2, 0.8).req;
  assert.deepEqual([t.feet.L.at, t.hands.R.at, t.look.at].map(pt), [[0.45, 0.08, 0.12], [0.45, 0.84, -0.2], [1, 0.8, 0]]);
});

test('CARDS2b the request in the rig\'s space: forward +Y, right +X, up +Z, in its units', () => {
  const s = seatRigInput([5, 0, 5], 0, 0.8);
  const r = climbRequestToRig(s.req, { feet: s.origin, yaw: s.yaw, unitsPerMetre: U });
  assert.deepEqual(pt(r.offset.map((v) => v / U)), [0, 0, -0.48]);
  assert.deepEqual(pt(r.feet.L.at.map((v) => v / U)), [-0.12, 0.45, 0.08]);
  assert.deepEqual(pt(r.hands.R.at.map((v) => v / U)), [0.2, 0.45, 0.84]);
  assert.deepEqual(pt(r.look.at.map((v) => v / U)), [0, 1, 0.8]);
});

test('CARDS2b solved on retail\'s biped: a chair\'s sitter - hips level with the knees, shins standing, feet and hands on their marks', () => {
  const sk = buildSkeleton(parseNif(new Uint8Array(readFileSync(new URL(`../${RETAIL}`, import.meta.url)))));
  const b = climbBones(sk);
  const at = (m, ref) => Array.from(m.get(ref).t).map((v) => v / U);
  const rest = skeletonSpaceMatrices(sk, poseSkeleton(sk, null, null, 0), GRAPH_ROOT);
  assert.deepEqual([at(rest, b.root)[2], at(rest, b.L.calf)[2], at(rest, b.head)[2]].map((v) => Math.round(v * 100) / 100), [1.09, 0.63, 1.7], 'the biped the numbers were measured on');
  const s = seatRigInput([0, 0, 0], 0, 0.8);
  const pose = poseSkeleton(sk, null, null, 0);
  const out = applyClimbRig(sk, pose, GRAPH_ROOT, skeletonSpaceMatrices, climbRequestToRig(s.req, { feet: s.origin, yaw: 0, unitsPerMetre: U }));
  const m = skeletonSpaceMatrices(sk, pose, GRAPH_ROOT);
  const hip = at(m, b.root), knee = at(m, b.L.calf), foot = at(m, b.L.foot), head = at(m, b.head);
  assert.ok(Math.abs(hip[2] - 0.61) < 0.01, `the hips on the chair: ${hip[2]}`);
  assert.ok(Math.abs(knee[2] - hip[2]) < 0.03, `the thighs level: knee ${knee[2]}, hip ${hip[2]}`);
  assert.ok(knee[1] - hip[1] > 0.4, `the knees forward: ${knee[1] - hip[1]}`);
  assert.ok(Math.abs(knee[1] - foot[1]) < 0.06, `the shins standing: knee ${knee[1]}, foot ${foot[1]}`);
  assert.deepEqual(foot.map((v) => Math.round(v * 100) / 100), [-0.12, 0.45, 0.08], 'the foot on its mark');
  assert.ok(out.reach.L < 0.01 && out.reach.R < 0.01, `the hands on the table: ${out.reach.L}, ${out.reach.R} units off`);
  assert.ok(Math.abs(head[2] - SEATED_EYE_HEIGHT) < 0.03, `the head where the seated eye looks from: ${head[2]}`);
});

test('CARDS2b the seat on the wire: 1..40 relayed, anything else no seat, omitted standing, sent at once, eased whole', () => {
  assert.equal(validPose({ ...POSE, st: 16 }).st, 16);
  for (const bad of [0, 41, 1.5, '16', -3, null]) assert.equal('st' in validPose({ ...POSE, st: bad }), false, `st ${bad}`);
  assert.deepEqual(validPose({ ...POSE }), validPose({ ...POSE, st: 0 }), 'a standing pose keeps the bytes it had');
  assert.equal('st' in validPose(POSE), false);
  assert.equal(poseChanged(validPose(POSE), validPose({ ...POSE, st: 16 })), true, 'sitting down is news');
  assert.equal(poseChanged(validPose({ ...POSE, st: 16 }), validPose({ ...POSE, st: 17 })), true);
  assert.equal(poseChanged(validPose({ ...POSE, st: 16 }), validPose({ ...POSE, st: 16 })), false);
  assert.equal(lerpPose(validPose(POSE), validPose({ ...POSE, st: 16 }), 0.2).st, 16, 'the seat is discrete');
  assert.equal('st' in lerpPose(validPose({ ...POSE, st: 16 }), validPose(POSE), 0.2), false, 'and gone on a stand');
});

test('CARDS2b the peer\'s seat: the same request at its drawn feet and facing, kept while it stands still; no walk into the chair', () => {
  const b = {};
  const a = seatFor(b, [1, 0, 2], 0.5, 18);
  assert.deepEqual(a, seatRigInput([1, 0, 2], 0.5, 0.9), 'at the top the pose names (18 steps, 0.9 m)');
  assert.equal(seatFor(b, [1, 0, 2], 0.5, 18), a, 'kept');
  assert.notEqual(seatFor(b, [1, 0, 2.1], 0.5, 18), a, 'rebuilt as the arrival eases in');
  const moving = { ...POSE, mv: 1 };
  assert.equal(peerCamera(moving, [0, 0, 0], 2).move.forward, 1);
  assert.equal(peerCamera({ ...moving, st: 16 }, [0, 0, 0], 2).move.forward, 0, 'a sitter arriving at the chair does not walk');
});

test('CARDS2b by source: the body at the seat, the request to the rig, the sender, a hit and Escape', () => {
  const wm = read('src/scenes/worldModes.js');
  const has = (src, s, why) => assert.ok(src.includes(s), why ?? s);
  has(wm, 'mwViewDrawBody(canvas, { proj, view, eye: mwv.eye, feet: cardSeat ? cardSeat.feet : player.bodyFeetAt(), yaw: cardSeat ? cardSeat.yaw : player.bodyYawFor(cam.yaw), viewYaw: cam.yaw });', 'the interior body drawn at the seat');
  has(wm, '      seat: cardSeat?.rig ?? null }),', 'the rig handed the seat');
  has(wm, "    cardSeat = { table: i, seat: k, eye: st.eye.slice(), feet: st.feet.slice(), yaw: st.yaw, top: st.top, rig: seatRigInput(st.feet, st.yaw, st.top) };");
  has(wm, "  registerPlayerHurtListener('cards-seat', (_e, hurt) => { if (cardSeat && hurt.after < hurt.before) standFromCardTable(); });", 'a hit stands you up');
  has(wm, '    togglePause(doorOpts = {}) {\n      if (cardSeat && !doorOpts.at) { standFromCardTable(); return; }', 'Escape stands you up, first');
  has(wm, '    seatPose: () => (cardSeat ? { feet: cardSeat.feet, yaw: cardSeat.yaw, st: seatTopByte(cardSeat.top) } : null),');
  const arm = read('src/combat/fpArm.js');
  has(arm, '            climb: thirdClimb(climbWorld, cam) ?? thirdSeat(cam),   // CLIMB6; CARDS2b: or the seat');
  has(arm, '    return climbRequestToRig(s.req, { feet: s.origin, yaw: s.yaw, unitsPerMetre: MW_UNITS_PER_METER, weight: rs.weight, height: rs.height });');
  const w = read('src/scenes/world.js');
  has(w, "    if (seated) { const w = sceneToOnline(seated.feet); pose.x = w[0]; pose.y = w[1]; pose.z = w[2]; pose.yaw = seated.yaw; }", 'the pose is the seat\'s, in the room\'s frame');
  assert.ok(w.indexOf('    const seated = modes?.seatPose?.() ?? null;') > w.indexOf('    sceneToOnline = nativeFrame ? campToWire'), 'after the frame is known');
  has(w, '      st: seated?.st,   // CARDS2b');
  const pb = read('src/net/peerBodies.js');
  has(pb, '    b.cam.seat = peer.shown.st ? seatFor(b, f, b.yaw, peer.shown.st) : null;', 'the peer\'s body seated at its drawn feet and facing');
});
