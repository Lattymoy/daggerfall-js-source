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
  SEAT_TOP_STEP, SEAT_TOP_DEFAULT, SEAT_HIP_DROP, SEATED_EYE_HEIGHT, SEAT_OUT, SEAT_HAND_ON, SEAT_FOOT_AHEAD, SEAT_FOOT_SIDE,
  SEAT_ANKLE, SEAT_HAND_SIDE, SEAT_HAND_OVER, seatTopByte, seatTopOf, seatRigInput, seatRequestFor,
} from '../src/player/seatPose.js';
import { EYE_HEIGHT } from '../src/player/motor.js';
import { parseNif } from '../src/formats/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../src/formats/mwSkin.js';
import { applyClimbRig, climbBones, climbRequestToRig } from '../src/combat/climbRig.js';
import { MW_UNITS_PER_METER } from '../src/formats/mwFirstPerson.js';
import { validPose, poseChanged, POSE_SEAT_TOP_MAX } from '../src/net/wire.js';
import { lerpPose } from '../src/net/online.js';
import { peerCamera, seatFor } from '../src/net/peerBodies.js';
import { peerMoving } from '../src/net/peerClimb.js';
import { cardTableSeats } from '../src/world/cardTables.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const r3 = (v) => Math.round(v * 1000) / 1000;
const pt = (p) => p.map(r3);
const U = MW_UNITS_PER_METER;
const RETAIL = 'vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif';
const POSE = { x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0, mv: 0 };
const biped = (() => { let sk = null; return () => (sk ??= buildSkeleton(parseNif(new Uint8Array(readFileSync(new URL(`../${RETAIL}`, import.meta.url)))))); })();
/** The seat solved on retail's biped at a race: each joint as the WORLD has it (drawThird's own model: right and forward
 *  by the build, up by the height, about the seat's feet and facing). */
function solveSeat(seat, race = { weight: 1, height: 1 }) {
  const sk = biped(), b = climbBones(sk);
  const pose = poseSkeleton(sk, null, null, 0);
  const out = applyClimbRig(sk, pose, GRAPH_ROOT, skeletonSpaceMatrices, seatRequestFor(seat, { unitsPerMetre: U, ...race }));
  const m = skeletonSpaceMatrices(sk, pose, GRAPH_ROOT);
  const f = [Math.sin(seat.yaw), Math.cos(seat.yaw)], r = [Math.cos(seat.yaw), -Math.sin(seat.yaw)];
  const at = (ref) => {
    const t = m.get(ref).t, x = t[0] * race.weight / U, y = t[1] * race.weight / U, z = t[2] * race.height / U;
    return [seat.feet[0] + r[0] * x + f[0] * y, seat.feet[1] + z, seat.feet[2] + r[1] * x + f[1] * y];
  };
  return { out, hip: at(b.root), knees: [at(b.L.calf), at(b.R.calf)], feet: [at(b.L.foot), at(b.R.foot)], wrists: [at(b.L.hand), at(b.R.hand)], head: at(b.head) };
}

test('CARDS2b the table\'s top on the wire: 5 cm steps, 1..40, and back', () => {
  assert.equal(POSE_SEAT_TOP_MAX, 40);
  assert.equal(SEAT_TOP_STEP, 0.05);
  assert.deepEqual([0.8, 0.77, 0.01, 0, -1, 2, 5, NaN].map(seatTopByte), [16, 15, 1, 1, 1, 40, 40, 1]);
  assert.deepEqual([16, 1, 40].map((b) => r3(seatTopOf(b))), [0.8, 0.05, 2]);
  assert.deepEqual([0, 41, 1.5, '16', undefined].map(seatTopOf), [SEAT_TOP_DEFAULT, SEAT_TOP_DEFAULT, SEAT_TOP_DEFAULT, SEAT_TOP_DEFAULT, SEAT_TOP_DEFAULT]);
});

test('CARDS2b the seated request: the hips dropped, the feet and the hands on their marks, no head turn; the body\'s distances follow its race', () => {
  assert.deepEqual([SEAT_HIP_DROP, SEAT_OUT, SEAT_HAND_ON, SEAT_FOOT_AHEAD, SEAT_FOOT_SIDE, SEAT_ANKLE, SEAT_HAND_SIDE, SEAT_HAND_OVER],
    [0.48, 0.35, 0.1, 0.45, 0.12, 0.08, 0.2, 0.04]);
  assert.equal(r3(SEATED_EYE_HEIGHT), r3(EYE_HEIGHT - SEAT_HIP_DROP), 'the seated eye is the standing eye lowered by the drop');
  // Facing +z (yaw 0): forward [0,0,1], right [1,0,0]; the left limbs at -x.
  const s = seatRigInput([10, 1, 20], 0, 0.8);
  assert.deepEqual([s.origin, s.yaw], [[10, 1, 20], 0]);
  const q = s.req;
  assert.equal(q.w, 1);
  assert.deepEqual(q.offset, [0, -0.48, 0]);
  assert.deepEqual([q.feet.L.at, q.feet.R.at].map(pt), [[9.88, 1.08, 20.45], [10.12, 1.08, 20.45]]);
  assert.deepEqual([q.feet.L.toe, q.feet.L.pole, q.feet.L.w], [[0, 0, 1], [0, 0, 1], 1], 'the toes and the knees forward');
  assert.deepEqual([q.hands.L.at, q.hands.R.at].map(pt), [[9.8, 1.84, 20.45], [10.2, 1.84, 20.45]], 'SEAT_OUT to the edge and SEAT_HAND_ON past it');
  assert.deepEqual([q.hands.L.fingers, q.hands.L.palm, q.hands.L.w, q.hands.L.curl], [[0, 0, 1], [0, -1, 0], 1, 0.3], 'the fingers forward, the palms down');
  assert.deepEqual([q.hands.L.pole, q.hands.R.pole].map(pt), [[-0.707, -0.707, 0], [0.707, -0.707, 0]], 'the elbows out and down');
  assert.equal('look' in q, false, 'AUDIT CARDS D1: no head turn - it carried the hands off their marks');
  // Facing +x (yaw PI/2): forward [1,0,0], right [0,0,-1] - the same pose turned.
  const t = seatRigInput([0, 0, 0], Math.PI / 2, 0.8).req;
  assert.deepEqual([t.feet.L.at, t.hands.R.at].map(pt), [[0.45, 0.08, 0.12], [0.45, 0.84, -0.2]]);
  // AUDIT CARDS D2: a build of 0.9 and a height of 1.1 - the drop and the ankle by the height, the feet's ahead and side
  // and the hands' side by the build; the hands' reach and height are the TABLE's and stand.
  const u = seatRigInput([0, 0, 0], 0, 0.8, { weight: 0.9, height: 1.1 }).req;
  assert.deepEqual([pt(u.offset), pt(u.feet.L.at), pt(u.hands.R.at)], [[0, -0.528, 0], [-0.108, 0.088, 0.405], [0.18, 0.84, 0.45]]);
});

test('CARDS2b the seat in the rig\'s space: forward +Y, right +X, up +Z, in its units, at its race', () => {
  const r = seatRequestFor({ feet: [5, 0, 5], yaw: 0, top: 0.8 }, { unitsPerMetre: U });
  assert.deepEqual(pt(r.offset.map((v) => v / U)), [0, 0, -0.48]);
  assert.deepEqual(pt(r.feet.L.at.map((v) => v / U)), [-0.12, 0.45, 0.08]);
  assert.deepEqual(pt(r.hands.R.at.map((v) => v / U)), [0.2, 0.45, 0.84]);
  const s = seatRigInput([5, 0, 5], 0, 0.8, { weight: 0.9, height: 1.1 });
  assert.deepEqual(seatRequestFor({ feet: [5, 0, 5], yaw: 0, top: 0.8 }, { unitsPerMetre: U, weight: 0.9, height: 1.1 }),
    climbRequestToRig(s.req, { feet: s.origin, yaw: 0, unitsPerMetre: U, weight: 0.9, height: 1.1 }), 'the world request at the race, through the climb rig\'s own mapping');
  assert.equal(seatRequestFor(null, { unitsPerMetre: U }), null);
  assert.equal(seatRequestFor({}, { unitsPerMetre: U }), null);
});

test('CARDS2b solved on retail\'s biped at EVERY seat of a real table: hips level with the knees, shins standing, feet on their marks, both hands on the top', () => {
  const rest = skeletonSpaceMatrices(biped(), poseSkeleton(biped(), null, null, 0), GRAPH_ROOT), b = climbBones(biped());
  assert.deepEqual([rest.get(b.root).t[2], rest.get(b.L.calf).t[2], rest.get(b.head).t[2]].map((v) => Math.round(v / U * 100) / 100), [1.09, 0.63, 1.7], 'the biped the numbers were measured on');
  // AUDIT CARDS E3: the shape the producer mints - cardTableSeats' own seats round a 2 x 1 table at 0.8, at (3, 0, 7).
  const aabb = { min: [3, 0, 7], max: [5, 0.8, 8] };
  const seats = cardTableSeats({ aabb }, () => true);
  assert.equal(seats.length, 6);
  for (const seat of seats) {
    const p = solveSeat(seat);
    const tag = `${seat.side} seat at ${pt([seat.x, seat.z])}`;
    assert.ok(p.out.reach.L < 0.01 && p.out.reach.R < 0.01, `${tag}: the hands reach their marks`);
    for (const w of p.wrists) {
      assert.ok(w[0] > aabb.min[0] + 0.05 && w[0] < aabb.max[0] - 0.05 && w[2] > aabb.min[2] + 0.05 && w[2] < aabb.max[2] - 0.05, `${tag}: a wrist over the top, inside its edge: ${pt(w)}`);
      assert.ok(Math.abs(w[1] - 0.84) < 0.01, `${tag}: a forearm's thickness over the top: ${w[1]}`);
    }
    assert.ok(Math.abs(p.hip[1] - 0.61) < 0.01, `${tag}: the hips on the chair: ${p.hip[1]}`);
    for (const k of p.knees) assert.ok(Math.abs(k[1] - p.hip[1]) < 0.03, `${tag}: the thighs level`);
    for (const [i, k] of p.knees.entries()) assert.ok(Math.hypot(k[0] - p.feet[i][0], k[2] - p.feet[i][2]) < 0.06, `${tag}: the shins standing`);
    assert.ok(Math.abs(p.head[1] - SEATED_EYE_HEIGHT) < 0.03, `${tag}: the head where the seated eye looks from: ${p.head[1]}`);
  }
});

test('CARDS2b the race on the biped: the legs sit true at every build and height; a short body reaches the top, a tall one comes as near as its arms go (AUDIT CARDS D2)', () => {
  const seat = { feet: [0, 0, 0], yaw: 0, top: 0.8 };
  for (const race of [{ weight: 1, height: 1 }, { weight: 1, height: 0.9 }, { weight: 0.9, height: 1.1 }, { weight: 0.9, height: 1.3 }]) {
    const p = solveSeat(seat, race);
    const tag = `build ${race.weight}, height ${race.height}`;
    for (const k of p.knees) assert.ok(Math.abs(k[1] - p.hip[1]) < 0.03, `${tag}: the thighs level: knee ${k[1]}, hip ${p.hip[1]}`);
    for (const [i, k] of p.knees.entries()) assert.ok(Math.hypot(k[0] - p.feet[i][0], k[2] - p.feet[i][2]) < 0.06, `${tag}: the shins standing`);
    assert.ok(Math.abs(p.hip[1] - 0.61 * race.height) < 0.01, `${tag}: the hips at the knees' height: ${p.hip[1]}`);
  }
  assert.ok(solveSeat(seat, { weight: 1, height: 0.9 }).out.reach.L < 0.01, 'a shorter body still lays its hands on the top');
  const tall = solveSeat(seat, { weight: 0.9, height: 1.1 });
  for (const w of tall.wrists) assert.ok(w[2] > 0.38 && w[1] > 0.84 && w[1] < 0.9, `a taller, slighter body: its wrists just short and just over their marks, as the page says: ${pt(w)}`);
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

test('CARDS2b the peer\'s seat: its feet, facing and top, kept while still, rebuilt on any change; no walk, no stride, no slide (AUDIT CARDS C5, D6, E5)', () => {
  const b = {};
  const a = seatFor(b, [1, 0, 2], 0.5, 18);
  assert.deepEqual(a, { feet: [1, 0, 2], yaw: 0.5, top: seatTopOf(18) }, 'at the top the pose names (18 steps, 0.9 m)');
  assert.equal(seatFor(b, [1, 0, 2], 0.5, 18), a, 'kept');
  assert.notEqual(seatFor(b, [1, 0, 2.1], 0.5, 18), a, 'rebuilt as the arrival eases in');
  const c = seatFor(b, [1, 0, 2.1], 0.5, 18);
  assert.equal(seatFor(b, [1, 0, 2.1], 0.5, 19).top, seatTopOf(19), 'another table\'s top');
  assert.equal(seatFor(b, [1, 0, 2.1], 0.7, 19).yaw, 0.7, 'another facing');
  assert.notEqual(c, seatFor(b, [1, 0, 2.1], 0.5, 18));
  const moving = { ...POSE, mv: 1 };
  assert.equal(peerMoving(moving), true);
  assert.equal(peerMoving({ ...moving, st: 16 }), false, 'a sitter is no walker - one law for the body, its footsteps and the sprite\'s stride');
  assert.equal(peerCamera({ ...moving, st: 16 }, [0, 0, 0], 2).move.forward, 0);
  // A sit and a stand are a place taken, not a walk: the drawn pose jumps to the seat (and back) whole.
  const standing = validPose({ ...POSE, x: 0, z: 0 }), seated = validPose({ ...POSE, x: 2, z: 1, st: 16 });
  assert.deepEqual([lerpPose(standing, seated, 0.2).x, lerpPose(standing, seated, 0.2).z], [2, 1]);
  assert.deepEqual([lerpPose(seated, standing, 0.2).x, lerpPose(seated, standing, 0.2).z], [0, 0]);
  assert.equal(lerpPose(standing, validPose({ ...POSE, x: 2, z: 1 }), 0.25).x, 0.5, 'a walk still eases');
});

test('CARDS2b by source: the pose the seat says, the request to the peers\' rigs, a hit and Escape', () => {
  const wm = read('src/scenes/worldModes.js');
  const has = (src, s, why) => assert.ok(src.includes(s), why ?? s);
  has(wm, "    cardSeat = { table: i, seat: k, eye: st.eye.slice(), feet: st.feet.slice(), yaw: st.yaw, top: st.top, free: ");
  // PIN MOVED (AUDIT CARDS-6 B4): a blow - never a round of damage over time, told from inside the player's minute pass
  has(wm, "  registerPlayerHurtListener('cards-seat', (_e, hurt) => { if (cardSeat && hurt.after < hurt.before && !tickInFlight()) standFromCardTable(); });", 'a hit stands you up');
  const esc = wm.indexOf("    if (mode === 'interior' && cardSeat && actionOf(e, keys) === 'Escape' && !interiorKeyCtx.uiOverlayActive) { standFromCardTable(); e.preventDefault(); return; }");   // KB1: the registry's Escape, never its raw code
  assert.ok(esc > 0 && esc < wm.indexOf('    // U43: THE ONE DISPATCH.'), 'Escape stands you up, spent above the one dispatch');
  has(wm, "    seatPose: () => (mode === 'interior' && cardSeat ? { feet: cardSeat.feet, yaw: cardSeat.yaw, st: seatTopByte(cardSeat.top) } : null),");
  const arm = read('src/combat/fpArm.js');
  has(arm, '  function thirdClimb(cw, cam) {\n    if (cam && cam.seat) { climbLast = null; return thirdSeat(cam); }', 'AUDIT CARDS D5: the seat wins the climb\'s slot, over any climb\'s tail');
  has(arm, '    return seatRequestFor(cam && cam.seat, { unitsPerMetre: MW_UNITS_PER_METER, weight: rs.weight, height: rs.height });', 'AUDIT CARDS E2: at the rig\'s units and the body\'s race');
  has(read('src/scenes/world.js'), '    seatedPeers: () => seatedPeerFeet(),', 'AUDIT CARDS B3: the host learns the others\' seats');
  has(read('src/scenes/world.js'), '    for (const p of online.peers.values()) if (p.shown?.st && online.visible(p)) out.push(onlineToScene(p.shown));', 'the seated peers I can see, at their scene feet');
  const w = read('src/scenes/world.js');
  has(w, "    if (seated) { const w = sceneToOnline(seated.feet); pose.x = w[0]; pose.y = w[1]; pose.z = w[2]; pose.yaw = seated.yaw; }", 'the pose is the seat\'s, in the room\'s frame');
  const at = w.indexOf('    const seated = modes?.seatPose?.() ?? null;');
  const frameAt = w.indexOf('    sceneToOnline = nativeFrame ? campToWire');
  assert.ok(frameAt > 0 && at > frameAt, 'after the frame is known');   // AUDIT CARDS E8: never vacuous on a -1
  const st = w.indexOf('    if (seated) arm.st = seated.st;');
  assert.ok(st > 0 && st > w.indexOf('      ...climbPoseOf(player),   // CLIMB5:') && st < w.indexOf('    else online.sendPose({ ...pose, ...arm, ...poseFx() });'), 'the seat byte on the arm, before it is sent');
  const pb = read('src/net/peerBodies.js');
  has(pb, '    b.cam.seat = peer.shown.st ? seatFor(b, f, b.yaw, peer.shown.st) : null;', 'the peer\'s body seated at its drawn feet and facing');
});
