// CLIMB6 (2026-10-01, the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md; Mac: "Definitely want you to use the
// morrowind model to get correct animations for everything. Be as detailed as possible"): THE MORROWIND BODY ON THE
// WALL. The skeleton's half (combat/climbRig.js) - the reach solved on whatever skeleton it is handed: Weapon
// Sheathing's vendored retail-shaped biped (bones along their local X, three-digit hands, clavicles under the neck)
// and chains of random rest frames take a hold to the same place; the hands set by their fingers and palms, the
// elbows and knees to their poles, the body fitted under its hands, the shoulders drawn up. The climb's half
// (player/climb/climbPose.js) - every hold and every move puts the limbs ON the stone the motor proved: the hang's hands on
// the lip (past its edge, palms on its top), the shimmy hand over hand (each hold fixed while held, the hands never
// crossing), the free climb's diagonal gait (a hand every FEEL.REACH, the other foot half a reach after), the pull-up,
// the vault's tuck, the lower's squat and slide, the leap's reach, the wall run's steps. The maps into each rig
// (drawThird's model inverted; the first person matched on screen), the wire's move (ck/cy/cd), the peers' rebuild
// (net/peer/peerClimb.js PeerClimbTrack), the hook in poseAssembly, and the four hosts' snapshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, poseSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import {
  applyClimbRig, climbBones, handFrame, solveReach, rotFromTo, rotFrames, rotFraction, rotAxisAngle, onRay, RAY_REACH,
  climbRequestToRig, climbRequestToFirstPerson,
} from '../../../src/combat/climbRig.js';
import { ClimbPose, POSE, gait, shimmyGait, wallFrame, climbRigInput, peerLipY, floorGapAt } from '../../../src/player/climb/climbPose.js';
import { FEEL } from '../../../src/player/climb/climbFeel.js';
import { PARKOUR_HANG_DROP, movePoint, planLower } from '../../../src/player/parkour.js';
import { poseAssembly, MW_UNITS_PER_METER } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { NIF_TO_PASS } from '../../../src/combat/fpArm.js';
import { trs, multiply, transformPoint } from '../../../src/world/mat4.js';
import { validPose, poseChanged, CLIMB_MOVE_KINDS } from '../../../src/net/wire.js';
import { climbPoseOf, climbMoveOf } from '../../../src/player/motor.js';
import { PeerClimbTrack, peerMove } from '../../../src/net/peer/peerClimb.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const RETAIL = 'vendor/weapon-sheathing/Data Files/Animations/xbase_anim/xbase_anim_sh.nif';
const retail = () => buildSkeleton(parseNif(new Uint8Array(readFileSync(new URL('../../../' + RETAIL, import.meta.url)))));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const near = (a, b, eps, msg) => assert.ok(len(sub(a, b)) <= eps, `${msg}: ${a.map((v) => v.toFixed(4))} vs ${b.map((v) => v.toFixed(4))}`);
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const mats = (sk, pose) => skeletonSpaceMatrices(sk, pose, GRAPH_ROOT);

test('CLIMB6 C1: the reach on RETAIL bones - Weapon Sheathing\'s vendored biped (bones along their local X): 200 holds within reach taken to 1e-3 units, no bone stretched, the elbow on its pole\'s side, both hands set fingers-ahead palm-down exactly (mutants: the forearm left unturned, the pole ignored, the palm\'s handedness)', () => {
  const sk = retail(), b = climbBones(sk);
  assert.deepEqual(['L', 'R'].map((s) => b[s].fingers.length), [2, 2], 'the three-digit hand: two fingers...');
  assert.ok(b.L.thumb && b.R.thumb, '...and a thumb');
  assert.equal(b.L.toe, null, 'no toe bone (the foot turns by its rest axes)');
  for (let i = 0; i < 200; i++) {
    const s = i % 2 ? 'R' : 'L', lat = s === 'R' ? 1 : -1;
    const pose = poseSkeleton(sk, null, null, 0), m0 = mats(sk, pose);
    const S = m0.get(b[s].upper).t, E0 = m0.get(b[s].fore).t, W0 = m0.get(b[s].hand).t;
    const a = len(sub(E0, S)), bb = len(sub(W0, E0));
    const d = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], l = len(d), r = (0.25 + 0.6 * rnd()) * (a + bb);
    const T = [S[0] + d[0] / l * r, S[1] + d[1] / l * r, S[2] + d[2] / l * r];
    const pole = [lat, -0.3, -0.5];
    applyClimbRig(sk, pose, GRAPH_ROOT, skeletonSpaceMatrices, { w: 1, hands: { [s]: { at: T, pole } } });
    const m1 = mats(sk, pose), S1 = m1.get(b[s].upper).t, E1 = m1.get(b[s].fore).t, W1 = m1.get(b[s].hand).t;
    near(W1, T, 1e-3, `hold ${i}`);
    assert.ok(Math.abs(len(sub(E1, S1)) - a) < 1e-3 && Math.abs(len(sub(W1, E1)) - bb) < 1e-3, 'no bone stretched');
    const sw = sub(W1, S1), k = dot(sub(E1, S1), sw) / dot(sw, sw), perp = sub(sub(E1, S1), sw.map((v) => v * k));
    const pk = dot(pole, sw) / dot(sw, sw), pp = sub(pole, sw.map((v) => v * pk));
    assert.ok(dot(perp, pp) >= -1e-6, `the elbow on the pole's side (${i})`);
  }
  for (const s of ['L', 'R']) {
    const pose = poseSkeleton(sk, null, null, 0), S = mats(sk, pose).get(b[s].upper).t;
    applyClimbRig(sk, pose, GRAPH_ROOT, skeletonSpaceMatrices, { w: 1, hands: { [s]: { at: [S[0], S[1] + 25, S[2] + 5], pole: [s === 'R' ? 1 : -1, 0, -1], fingers: [0, 1, 0], palm: [0, 0, -1] } } });
    const fr = handFrame(mats(sk, pose), b[s], s);
    near(fr.fingers, [0, 1, 0], 1e-4, `${s} fingers ahead`);
    near(fr.palm, [0, 0, -1], 1e-4, `${s} palm down`);
    // read off the bones, not the frame's own sum: palm down and fingers ahead, a thumb lies inboard (a right one to -X)
    const thumbSide = mats(sk, pose).get(b[s].thumb[0]).t[0] - mats(sk, pose).get(b[s].hand).t[0];
    assert.ok(thumbSide * (s === 'R' ? -1 : 1) > 1, `${s} thumb inboard (${thumbSide.toFixed(2)})`);
  }
});

test('CLIMB6 C2: CONVENTION-FREE - an arm whose rest frames are random rotations (nothing along X, Y or Z) takes every hold to the same place: the solve reads the joints, never an axis (mutant: a bone turned about a fixed local axis)', () => {
  for (let trial = 0; trial < 40; trial++) {
    const R = () => { const ax = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], l = len(ax); return rotAxisAngle(ax.map((v) => v / l), rnd() * 6.28); };
    // a chain root -> upper -> fore -> hand -> finger, each joint offset along its parent's (random) frame
    const node = (ref, name, parent, rotation, translation) => [ref, { ref, name, parent, rest: { rotation, translation, scale: 1 } }];
    const nodes = new Map([
      node(0, 'Bip01', -1, R(), [0, 0, 100]),
      node(1, 'Bip01 R UpperArm', 0, R(), [10, 0, 0]),
      node(2, 'Bip01 R Forearm', 1, R(), [0, 18, 0]),
      node(3, 'Bip01 R Hand', 2, R(), [0, 0, 17]),
      node(4, 'Bip01 R Finger1', 3, R(), [6, 0, 0]),
    ]);
    const sk = { nodes, byName: new Map([...nodes.values()].map((n) => [n.name.toLowerCase(), n.ref])) };
    const pose = poseSkeleton(sk, null, null, 0), m0 = mats(sk, pose);
    const S = m0.get(1).t, T = [S[0] + 12, S[1] + 15 * (rnd() - 0.5), S[2] + 20];
    applyClimbRig(sk, pose, GRAPH_ROOT, skeletonSpaceMatrices, { w: 1, hands: { R: { at: T, pole: [1, 0, -1], fingers: [0, 0, 1] } } });
    const m1 = mats(sk, pose);
    near(m1.get(3).t, T, 1e-3, `trial ${trial}: the wrist on the hold`);
    near(handFrame(m1, climbBones(sk).R, 'R').fingers, [0, 0, 1], 1e-3, `trial ${trial}: the fingers the way asked`);
  }
});

test('CLIMB6 C3: the algebra - the least rotation, the frame alignment, a fraction of a turn, the two-bone solve clamped to the bones, the ray\'s point at a distance (mutants: the fraction\'s angle, the clamp)', () => {
  const a = [1, 0, 0], b = [0, 0.6, 0.8];
  const M = rotFromTo(a, b);
  near([M[0], M[3], M[6]], b, 1e-6, 'a onto b');
  const F = rotFrames([1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
  near([F[0], F[3], F[6]], [0, 0, 1], 1e-6, 'f onto f');
  near([F[1], F[4], F[7]], [1, 0, 0], 1e-6, 'u onto u');
  const half = rotFraction(rotAxisAngle([0, 0, 1], 1.2), 0.5), want = rotAxisAngle([0, 0, 1], 0.6);
  for (let i = 0; i < 9; i++) assert.ok(Math.abs(half[i] - want[i]) < 1e-6, 'half the turn');
  const far = solveReach([0, 0, 0], 3, 2, [100, 0, 0], [0, 1, 0]);
  assert.ok(Math.abs(len(far.end) - 5 * 0.995) < 1e-6, 'never past the bones');
  const close = solveReach([0, 0, 0], 3, 2, [4, 0, 0], [0, 1, 0]);
  assert.ok(Math.abs(len(close.mid) - 3) < 1e-9 && Math.abs(len(sub(close.end, close.mid)) - 2) < 1e-9 && close.mid[1] > 0, 'the joint on the pole\'s side, the bones their lengths');
  const p = onRay([0, 0, 0], 5, { from: [0, -1, 0], dir: [1, 0, 0] });
  assert.ok(Math.abs(len(p) - 5) < 1e-9 && p[0] > 0, 'the point ahead on the ray at the distance');
  assert.ok(RAY_REACH > 0.8 && RAY_REACH < 1, 'a share of the arm');
});

test('CLIMB6 C4: THE BODY FITTED UNDER ITS HANDS - a hold over the head lets the body down (within the request\'s bound) until the farther hand is at 97 % of its bones; the offset moves it whole; the spine leans its share to the chest; the shoulders drawn up before the fit (mutants: the fit unbounded, the nearer hand deciding, the lean\'s axis)', () => {
  const sk = retail(), b = climbBones(sk);
  const pose0 = poseSkeleton(sk, null, null, 0), m0 = mats(sk, pose0);
  const SL = m0.get(b.L.upper).t, SR = m0.get(b.R.upper).t;
  const reach = (s, m) => len(sub(m.get(b[s].fore).t, m.get(b[s].upper).t)) + len(sub(m.get(b[s].hand).t, m.get(b[s].fore).t));
  const hold = (S, dz) => [S[0], S[1] + 15, S[2] + dz];
  const req = (down, dzL, dzR) => ({ w: 1, fit: { up: 0, down }, hands: { L: { at: hold(SL, dzL), pole: [-1, 0, 0] }, R: { at: hold(SR, dzR), pole: [1, 0, 0] } } });
  const pose = poseSkeleton(sk, null, null, 0);
  const out = applyClimbRig(sk, pose, GRAPH_ROOT, skeletonSpaceMatrices, req(30, 10, 14));
  const m1 = mats(sk, pose);
  assert.ok(out.fit < 0 && out.fit > -30, `let down (${out.fit.toFixed(2)})`);
  const farR = len(sub(m1.get(b.R.hand).t, m1.get(b.R.upper).t)) / reach('R', m1);
  const nearL = len(sub(m1.get(b.L.hand).t, m1.get(b.L.upper).t)) / reach('L', m1);
  assert.ok(Math.abs(farR - 0.97) < 2e-3, `the farther (higher) hand at 97 % of its reach, on its hold (${farR.toFixed(4)})`);
  assert.ok(nearL < 0.95, `the nearer hand bent, not deciding (${nearL.toFixed(4)})`);
  const bounded = poseSkeleton(sk, null, null, 0);
  assert.equal(applyClimbRig(sk, bounded, GRAPH_ROOT, skeletonSpaceMatrices, req(2, 10, 14)).fit, -2, 'never past the bound');
  const moved = poseSkeleton(sk, null, null, 0);
  applyClimbRig(sk, moved, GRAPH_ROOT, skeletonSpaceMatrices, { w: 1, offset: [0, 7, 0] });
  near(mats(sk, moved).get(b.head).t, sub(m0.get(b.head).t, [0, -7, 0]), 1e-3, 'the offset moves the body whole');
  const leant = poseSkeleton(sk, null, null, 0);
  applyClimbRig(sk, leant, GRAPH_ROOT, skeletonSpaceMatrices, { w: 1, lean: { pitch: 0.3 } });
  assert.ok(mats(sk, leant).get(b.head).t[1] > m0.get(b.head).t[1] + 5, 'a positive lean brings the chest forward (+Y)');
  const shrug = poseSkeleton(sk, null, null, 0);
  applyClimbRig(sk, shrug, GRAPH_ROOT, skeletonSpaceMatrices, { w: 1, hands: { R: { at: [SR[0], SR[1], SR[2] + 40], shrug: 0.5 } } });
  assert.ok(mats(sk, shrug).get(b.R.upper).t[2] > SR[2] + 1, 'the shoulder drawn up toward a hand over the head');
});

// ---- the climb's half --------------------------------------------------------------------------------------------

const N = [0, 0, -1];   // a wall facing the body at yaw 0 (forward +Z): its face POSE.FACE_BACK ahead
const step = (law, c, n = 1, dt = 1 / 60) => { let o; for (let i = 0; i < n; i++) o = law.update(dt, c); return o; };
const hang = (x = 0, extra = {}) => ({ feet: [x, 0, 0], yaw: 0, mode: 'hang', normal: N, lipY: PARKOUR_HANG_DROP, move: null, grip: 1, flight: null, floorGap: Infinity, ...extra });

test('CLIMB6 C5: HANGING - both hands on the lip in front of the body, HANDS_APART apart, each wrist WRIST_OVER over the top and WRIST_OUT past the face, the fingers over the top, the palms down, the elbows out and back; the feet on the face below, toes in, the knees forward; the body in to the wall and let down no further than the floor under it (mutants: the wrist under the lip, a hand across, the knee backward, the floor ignored)', () => {
  const law = new ClimbPose();
  const o = step(law, hang(), 90);
  assert.ok(o.w > 0.99, 'the weight in');
  const fr = wallFrame(N);
  for (const s of ['L', 'R']) {
    const h = o.hands[s], lat = s === 'R' ? 1 : -1;
    near(h.at, [lat * POSE.HANDS_APART / 2 * fr.right[0], PARKOUR_HANG_DROP + POSE.WRIST_OVER, POSE.FACE_BACK - POSE.WRIST_OUT], 1e-9, `${s} on the lip`);
    assert.ok(dot(h.fingers, fr.into) > 0.9 && h.fingers[1] < 0, 'the fingers over the top');
    assert.deepEqual(h.palm, [0, -1, 0], 'the palm on it');
    assert.ok(dot(h.pole, fr.right) * lat > 0.5 && dot(h.pole, fr.n) > 0, 'the elbow out and back');
    const f = o.feet[s];
    assert.ok(Math.abs(f.at[2] - (POSE.FACE_BACK - POSE.HANG_FOOT_OFF)) < 1e-9, 'the ankle off the face, the toes on it');
    assert.ok(dot(f.pole, fr.into) > 0.8, 'the knee bent forward, as a knee bends');
    assert.ok(f.hang > 0.9, 'the legs let out by their own length');
  }
  assert.ok(o.hands.R.at[0] > o.hands.L.at[0], 'the right hand on the right (world right is +X facing +Z)');
  near(o.offset, [0, 0, POSE.HANG_IN], 1e-9, 'in to the wall');
  assert.equal(o.fit.down, POSE.HANG_FIT_DOWN, 'let down to straight arms...');
  assert.equal(step(new ClimbPose(), hang(0, { floorGap: 0.05 }), 40).fit.down, 0.05 - POSE.FLOOR_CLEAR, '...never into a floor under the feet');
  assert.equal(new ClimbPose().update(1 / 60, null).w, 0, 'off the wall, no pose');
});

test('CLIMB6 C6: THE SHIMMY hand over hand - square over the hold just taken; the leading hand first the way the body goes (the right going right, the left going left), the other closing up after it, a grip landing every FEEL.SHIMMY_SPAN either way (the ear\'s); a held hand fixed on its stone (never sliding), one hand off the stone at a time, never crossing; stopped mid-reach a hand finishes onto the nearer stone and stays there, going on or back; and all of it through 60 random stop-and-go runs (mutants: the bands, the width, the leader, the settle, the restart)', () => {
  const LIP = PARKOUR_HANG_DROP + POSE.WRIST_OVER, span = FEEL.SHIMMY_SPAN;
  const onStone = (h) => Math.abs(h.at[1] - LIP) < 1e-6;
  // the stones: on a grid twice the span, the body square over stone 0 at the hold's taking
  const g0 = { R: shimmyGait(0, 2 * span, span / 2, POSE.SHIMMY_REACH * span), L: shimmyGait(0, 2 * span, 1.5 * span, POSE.SHIMMY_REACH * span) };
  for (const s of ['L', 'R']) assert.deepEqual([g0[s].anchor, g0[s].next, g0[s].swing], [0, 0, 0], `${s} on stone 0 at the start`);
  const fwd = shimmyGait(0.1, 0.5, 0.125, 0.2), back = shimmyGait(0.1 - 1e-9, 0.5, 0.125, 0.2);
  assert.ok(Math.abs(fwd.swing - back.swing) < 1e-6 && fwd.anchor === back.anchor && fwd.next === back.next, 'the same stones either way');
  for (const dir of [1, -1]) {
    const law = new ClimbPose();
    const o0 = step(law, hang(0), 30);
    for (const s of ['L', 'R']) near(o0.hands[s].at, [(s === 'R' ? 1 : -1) * POSE.HANDS_APART / 2, LIP, POSE.FACE_BACK - POSE.WRIST_OUT], 1e-9, `${s} square on the hold`);
    let x = 0, prev = null, first = null;
    const lands = [];
    for (let i = 0; i < 150; i++) {
      x += dir * 0.8 / 60;
      const o = law.update(1 / 60, hang(x));
      assert.ok(o.hands.R.at[0] - o.hands.L.at[0] > 0.15, `never crossing (${dir}, ${i})`);
      assert.ok(onStone(o.hands.L) || onStone(o.hands.R), `one hand off the stone at a time (${dir}, ${i})`);
      for (const s of ['L', 'R']) {
        const h = o.hands[s];
        if (onStone(h)) {
          if (prev && onStone(prev[s]) && Math.abs(prev[s].at[0] - h.at[0]) > 1e-9) assert.fail(`${s} slid along the lip while on it (${dir}, ${i})`);
          if (prev && !onStone(prev[s])) lands.push({ s, x: Math.abs(x) });
        } else {
          assert.ok(h.at[1] > LIP && h.at[2] < POSE.FACE_BACK - POSE.WRIST_OUT, 'a hand off the stone lifts clear and out');
          first ??= s;
        }
      }
      prev = { L: { at: [...o.hands.L.at] }, R: { at: [...o.hands.R.at] } };
    }
    assert.equal(first, dir > 0 ? 'R' : 'L', 'the leading hand first');
    assert.ok(lands.length >= 8, 'hand over hand');
    lands.forEach((l, i) => {
      assert.equal(l.s, (i % 2 === 0) === (dir > 0) ? 'R' : 'L', 'the hands in turn');
      assert.ok(Math.abs(l.x - (i + 1) * span) < 0.03 + 0.8 / 60, `a grip every span (${dir}: ${l.x.toFixed(3)} for ${((i + 1) * span).toFixed(3)})`);
    });
  }
  // stopped mid-reach: most of the way there it lands; barely off its stone it takes it back - and stays put after
  for (const [stopAt, want] of [[0.15, 'next'], [0.08, 'anchor']]) for (const then of [1, -1]) {
    const law = new ClimbPose();
    step(law, hang(0), 30);
    let x = 0;
    while (x < stopAt) { x += 0.6 / 60; law.update(1 / 60, hang(x)); }
    const g = shimmyGait(x, 2 * span, span / 2, POSE.SHIMMY_REACH * span);
    assert.ok(g.swing > 0.2 && g.swing < 0.8, 'stopped well into the right hand\'s reach');
    const o = step(law, hang(x), Math.ceil(POSE.SETTLE_S * 60) + 2);
    near(o.hands.R.at, [g[want] + POSE.HANDS_APART / 2, LIP, POSE.FACE_BACK - POSE.WRIST_OUT], 1e-9, `onto the ${want} stone (${stopAt})`);
    const was = o.hands.R.at.slice();   // (the law answers in one object, frame to frame)
    const on = law.update(1 / 60, hang(x + then * 0.6 / 60));
    assert.ok(Math.abs(on.hands.R.at[0] - was[0]) < 0.01, `going ${then > 0 ? 'on' : 'back'}, no jump (${stopAt}: ${(on.hands.R.at[0] - was[0]).toFixed(4)})`);
  }
  // a new hold is stone 0 again: the hands square on it however far the last one was walked
  const law = new ClimbPose();
  let x = 0;
  for (let i = 0; i < 40; i++) { x += 0.8 / 60; law.update(1 / 60, hang(x)); }
  const fresh = step(law, hang(x, { lipY: PARKOUR_HANG_DROP + 0.5 }), 30);
  near(fresh.hands.R.at, [x + POSE.HANDS_APART / 2, PARKOUR_HANG_DROP + 0.5 + POSE.WRIST_OVER, POSE.FACE_BACK - POSE.WRIST_OUT], 1e-9, 'square on the new hold');
  // stop and go, either way, at any pace: the same laws hold
  let seed = 3;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let run = 0; run < 60; run++) {
    const fz = new ClimbPose();
    let fx = 0, prev = null;
    step(fz, hang(0), 30);
    for (let seg = 0; seg < 12; seg++) {
      const v = rand() < 0.35 ? 0 : (rand() < 0.5 ? -1 : 1) * (0.2 + 0.8 * rand()), n = 5 + Math.floor(rand() * 60);
      for (let i = 0; i < n; i++) {
        fx += v / 60;
        const o = fz.update(1 / 60, hang(fx));
        const where = `run ${run} seg ${seg} frame ${i}`;
        assert.ok(onStone(o.hands.L) || onStone(o.hands.R), `one hand off at a time (${where})`);
        assert.ok(o.hands.R.at[0] - o.hands.L.at[0] > 0.15, `never crossing (${where})`);
        for (const s of ['L', 'R']) {
          assert.ok(Math.abs(o.hands[s].at[0] - fx - (s === 'R' ? 1 : -1) * POSE.HANDS_APART / 2) < 2 * span, `within reach (${where})`);
          if (prev && onStone(o.hands[s]) && onStone(prev[s]) && Math.abs(prev[s].at[0] - o.hands[s].at[0]) > 1e-9) assert.fail(`${s} slid (${where})`);
        }
        prev = { L: { at: [...o.hands.L.at] }, R: { at: [...o.hands.R.at] } };
      }
    }
  }
});

test('CLIMB6 C7: THE FREE CLIMB\'s diagonal gait - over the face the hands reach in turn, a reach every FEEL.REACH climbed, and each foot moves half a reach after the opposite hand; every hold fixed to the face while held; the hands over the head, the knees turned out (mutants: the foot\'s phase, the stride)', () => {
  const law = new ClimbPose();
  const climb = (y) => ({ feet: [0, y, 0], yaw: 0, mode: 'climb', normal: N, lipY: null, move: null, grip: 1, flight: null });
  step(law, climb(0), 20);
  const swingStart = { L: [], R: [], FL: [], FR: [] };
  const was = { L: false, R: false, FL: false, FR: false };
  let y = 0;
  for (let i = 0; i < 240; i++) {
    y += 0.5 / 60;
    const o = law.update(1 / 60, climb(y));
    const slots = { L: o.hands.L, R: o.hands.R, FL: o.feet.L, FR: o.feet.R };
    for (const [k, h] of Object.entries(slots)) {
      const off = k[0] === 'F' ? POSE.CLIMB_FOOT_OFF : 0.05;
      const swinging = Math.abs(h.at[2] - (POSE.FACE_BACK - off)) > 1e-6;
      if (swinging && !was[k]) swingStart[k].push(y);
      was[k] = swinging;
    }
    assert.ok(o.hands.L.at[1] > y + 1.5 && o.hands.R.at[1] > y + 1.5, 'the hands over the head');
    assert.ok(Math.abs(o.feet.R.pole[0]) > 0.7, 'the knees turned out');
  }
  const stride = 2 * FEEL.REACH;
  for (const k of ['L', 'R']) {
    const s = swingStart[k].slice(1);
    assert.ok(s.length >= 1, `${k} reaches`);
    for (let i = 1; i < s.length; i++) assert.ok(Math.abs(s[i] - s[i - 1] - stride) < 0.02, `${k} a reach every stride`);
  }
  assert.ok(Math.abs(((swingStart.L[0] - swingStart.R[0]) % stride + stride) % stride - FEEL.REACH) < 0.02, 'the hands half a stride apart');
  const lag = ((swingStart.FL.at(-1) - swingStart.R.at(-1)) % stride + stride) % stride;   // (the first may be a reach the start caught mid-way)
  assert.ok(Math.abs(lag - FEEL.REACH / 2) < 0.02, `the opposite foot half a reach after its hand (${lag.toFixed(3)})`);
  const lagR = ((swingStart.FR.at(-1) - swingStart.L.at(-1)) % stride + stride) % stride;
  assert.ok(Math.abs(lagR - FEEL.REACH / 2) < 0.02, `...on both sides (${lagR.toFixed(3)})`);
});

test('CLIMB6 C8: THE MOVES - a pull-up\'s hands on the edge through the rise then let go as the body stands; the vault\'s knees tucked up past the top; the lower squats to the edge with the feet planted, takes it, and its drawn body goes down at once to meet the hang; a leap reaches for the hold it flies to; the wall run puts its feet on the face (mutants: a move\'s hands left on, the tuck, the squat, the reach)', () => {
  // the pull-up
  const law = new ClimbPose();
  step(law, hang(), 30);
  const m = { kind: 'mantle', from: [0, 0, 0], up: [0, 1.84, 0], to: [0, 1.8, 0.75], split: 0.62, arc: 0.03, dur: 1.1, exit: null, t: 0 };
  const mc = (t) => { m.t = t; return { feet: movePoint(m, t), yaw: 0, mode: null, normal: null, lipY: null, move: m, grip: 1, flight: null }; };
  const rise = law.update(1 / 60, mc(0.3));
  assert.ok(Math.abs(rise.hands.R.at[0] - POSE.HANDS_APART / 2) < 1e-6 && Math.abs(rise.hands.R.at[1] - (1.8 + POSE.WRIST_OVER)) < 1e-6, 'the hand on the edge through the rise');
  assert.ok(rise.hands.R.w > 0.99, 'held');
  const end = law.update(1 / 60, mc(1));
  assert.ok(end.hands.R.w < 1e-6 && end.hands.L.w < 1e-6, 'let go as the body stands');
  // the vault
  const vl = new ClimbPose();
  const v = { kind: 'vault', from: [0, 0, 0], up: [0, 1.04, 0], to: [0, 1.1, 1.0], split: 0.4, arc: 0.1, dur: 0.6, exit: [0, 3.5], t: 0 };
  v.t = 0.5;
  const vo = vl.update(1 / 60, { feet: movePoint(v, 0.5), yaw: 0, move: v, grip: 1 });
  assert.ok(vo.feet.R.at[1] > movePoint(v, 0.5)[1] + 0.3, 'the knees tucked: the feet drawn up under the hips');
  assert.ok(vo.hands.R.at[1] > 1.0 && vo.hands.R.w > 0.5, 'the hands planted on the top');
  // the lower: planLower's own path from a roof (top y 0, face at z 0.39 facing -z)
  const ll = new ClimbPose();
  const grip = { normal: N, lipY: 0, face: [0, 0, 0.39], feet: [0, -1.8, 0] };
  const low = planLower([0, 0, 0.75], grip, 0);
  let lastY = Infinity;
  for (let i = 0; i <= 30; i++) {
    low.t = i / 30;
    const f = movePoint(low, low.t), o = ll.update(1 / 60, { feet: f, yaw: 0, move: low, grip: 1 });
    const drawn = f[1] + o.offset[1];
    assert.ok(drawn <= lastY + 1e-9, `the drawn body only goes down (${i})`);
    lastY = drawn;
    if (i === 6) near(o.feet.R.at, [POSE.FEET_APART / 2, 0, 0.75 + 0.05], 0.02, 'the feet planted on the roof through the squat (back from its edge)');
    if (i === 30) { assert.ok(Math.abs(o.offset[1]) < 1e-6, 'the drawn body meets the hang'); assert.ok(o.hands.R.w > 0.99, 'the hands hold the edge'); }
  }
  // the leap
  const lp = new ClimbPose();
  step(lp, hang(-1), 20);
  const leap = { kind: 'leap', from: [-1, 0, 0], up: [0.5, 0.35, 0], to: [2, 0, 0], split: 0.5, arc: 0.25, dur: 0.7, hang: { normal: N, lipY: 1.8 }, t: 0 };
  let lo;
  for (let i = 0; i <= 25; i++) { leap.t = i / 42; lo = lp.update(1 / 60, { feet: movePoint(leap, leap.t), yaw: 0, move: leap, grip: 1 }); }
  assert.ok(lo.hands.R.at[0] > 2, 'the hands reach for the hold flown to');
  // the wall run
  const wr = new ClimbPose();
  const run = { kind: 'wallrun', from: [0, 0, 0], up: [0, 1.4, 0], to: [0, 1.4, 0], split: 1, arc: 0, dur: 0.6, hang: { normal: N, lipY: 3.2 }, t: 0.4 };
  const wo = wr.update(1 / 60, { feet: movePoint(run, 0.4), yaw: 0, move: run, grip: 1 });
  assert.ok(wo.feet.L.at[2] > 0.2 && wo.feet.R.at[2] > 0.2, 'the feet on the face');
});

test('CLIMB6 C9: the grip failing trembles the hands and scrabbles the feet down the face; a leap\'s flight brings the arms up and forward; a catch rings the body as a pendulum, harder the faster it came (mutants: the tremble, the swing\'s speed)', () => {
  const calm = step(new ClimbPose(), hang(), 60), fail = step(new ClimbPose(), hang(0, { grip: 0.02 }), 60);
  assert.ok(len(sub(fail.hands.R.at, calm.hands.R.at)) > 1e-4, 'the hands tremble');
  let lowest = 0;
  const law = new ClimbPose();
  for (let i = 0; i < 120; i++) lowest = Math.min(lowest, law.update(1 / 60, hang(0, { grip: 0.02 })).feet.R.at[1] - calm.feet.R.at[1]);
  assert.ok(lowest < -0.04, `a foot slips down the face (${lowest.toFixed(3)})`);
  const fl = new ClimbPose().update(1 / 60, { feet: [0, 1, 0], yaw: 0, flight: { dir: [0, 0, 1], vy: -3 }, grip: 1 });
  assert.ok(fl.hands.R.at[2] > 0.3 && fl.hands.R.at[1] > 1 + 1.45, 'the arms up and forward in the flight');
  const amp = (speed) => { const l = new ClimbPose(); l.update(1 / 60, { feet: [0, 0, 0], yaw: 0, move: { kind: 'catch', from: [0, -1, 0], to: [0, 0, 0], hang: { normal: N, lipY: 1.8 }, t: 0.5, speed }, grip: 1 }); return l.swingAmp; };
  assert.ok(amp(8) > amp(0) && amp(0) > 0, 'harder the faster');
});

// ---- the maps into the rigs --------------------------------------------------------------------------------------

test('CLIMB6 C10: THE THIRD-PERSON MAP is drawThird\'s model inverted - every hold mapped into the rig and drawn back through the model lands where it was in the world, at any yaw and race scale; ways map as ways (mutants: the yaw\'s sign, the scales swapped)', () => {
  for (const [yaw, w, h] of [[0, 1, 1], [1.1, 0.9, 1.08], [-2.7, 1.1, 0.95]]) {
    const feet = [3, 2, -5];
    const u = 1 / MW_UNITS_PER_METER;
    const model = multiply(trs(feet[0], feet[1], feet[2], 0, yaw * 180 / Math.PI + 180, 0, -u * w, u * h, u * w), NIF_TO_PASS);
    const law = new ClimbPose();
    const c = { feet, yaw, mode: 'hang', normal: [-Math.sin(yaw), 0, -Math.cos(yaw)], lipY: feet[1] + 1.8, grip: 1 };
    const wq = step(law, c, 30);
    const rq = climbRequestToRig(wq, { feet, yaw, unitsPerMetre: MW_UNITS_PER_METER, weight: w, height: h });
    for (const s of ['L', 'R']) {
      const back = transformPoint(model, ...rq.hands[s].at);
      near([back[0], back[1], back[2]], wq.hands[s].at, 1e-4, `yaw ${yaw}: ${s} back where it was`);
    }
    assert.ok(rq.hands.R.at[0] > 0, 'the right hand on the rig\'s right (+X)');
    assert.ok(rq.hands.R.fingers[1] > 0.9, 'the fingers into the wall: the rig\'s forward (+Y)');
  }
});

test('CLIMB6 C11: THE FIRST-PERSON MAP matches the picture - a hold drawn by the world\'s lens and the hand drawn by the arm\'s lens (its own 60 degrees, at the rig\'s eye) land on the same point of the screen, at any world field of view and look pitch; a hold behind the eye asks no arm (mutants: the lens ratio, the pitch)', () => {
  const law = new ClimbPose();
  const wq = step(law, hang(), 30);
  const rigEye = [0, 0, 160], lensFov = Math.PI / 3, aspect = 16 / 9;
  for (const [fov, pitch] of [[Math.PI / 3, 0], [75 * Math.PI / 180, 0.25], [90 * Math.PI / 180, -0.2]]) {
    const eye = [0, 1.7, 0], yaw = 0;
    const rq = climbRequestToFirstPerson(wq, { eye, yaw, pitch, fov, lensFov, lensPitch: 0, rigEye });
    for (const s of ['L', 'R']) {
      const d = sub(wq.hands[s].at, eye);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const f = [0, sp, cp], r = [1, 0, 0], up = [0, cp, -sp];
      const worldNdc = [dot(d, r) / (dot(d, f) * Math.tan(fov / 2) * aspect), dot(d, up) / (dot(d, f) * Math.tan(fov / 2))];
      const q = onRay(rigEye, 30, rq.hands[s].ray);   // any point on the ray: the arm takes the one it reaches
      const v = sub(q, rigEye);
      const armNdc = [v[0] / (v[1] * Math.tan(lensFov / 2) * aspect), v[2] / (v[1] * Math.tan(lensFov / 2))];
      assert.ok(Math.abs(worldNdc[0] - armNdc[0]) < 1e-6 && Math.abs(worldNdc[1] - armNdc[1]) < 1e-6, `fov ${fov.toFixed(2)} pitch ${pitch}: ${s} on the hold in the picture`);
    }
  }
  assert.equal(climbRequestToFirstPerson(wq, { eye: [0, 1.7, 3], yaw: 0, pitch: 0, fov: 1, lensFov, rigEye }), null, 'holds behind the eye: no arm');
});

test('CLIMB6 C12: THE HOOK - poseAssembly lays the climb over the clip on the assembly\'s own skeleton before any piece is placed (the matrices it keeps carry it), and none is laid without a request', () => {
  const sk = retail(), b = climbBones(sk);
  const asm = () => ({ skeleton: sk, pieces: [], fns: { poseSkeleton, skelMats: skeletonSpaceMatrices } });
  const S = mats(sk, poseSkeleton(sk, null, null, 0)).get(b.R.upper).t, T = [S[0] + 5, S[1] + 20, S[2] + 15];
  const a = poseAssembly(asm(), { climb: { w: 1, hands: { R: { at: T, pole: [1, 0, -1] } } } });
  near(a.mats.get(b.R.hand).t, T, 1e-3, 'the hand on the hold in the kept matrices');
  assert.ok(a.climbFit, 'the fit reported');
  const plain = poseAssembly(asm(), {});
  assert.equal(plain.climbFit, null, 'no request, no climb');
  near(plain.mats.get(b.R.hand).t, mats(sk, poseSkeleton(sk, null, null, 0)).get(b.R.hand).t, 1e-6, 'the clip as it was');
});

// ---- the wire and the peers --------------------------------------------------------------------------------------

test('CLIMB6 C13: THE MOVE ON THE WIRE - a move in flight names its kind (ck), its lip over its start (cy, cm) and its time (cd, cs), minted off the motor\'s own move; a kind no move has, a lip or a time out of bounds is dropped (never clamped into another); off a move, and off the wall, none; a new kind or lip goes out at once (mutants: the kind clamped, the change unsent)', () => {
  const mantle = { kind: 'mantle', from: [0, 1, 0], up: [0, 2.84, 0], to: [0, 2.8, 0.7], dur: 1.1 };
  assert.deepEqual(climbMoveOf(mantle), { ck: CLIMB_MOVE_KINDS.indexOf('mantle') + 1, cy: 180, cd: 110 }, 'the edge is the top less the rise\'s gap');
  assert.deepEqual(climbMoveOf({ kind: 'lower', from: [0, 5, 0], to: [0, 3.2, 0], hang: { lipY: 5, normal: N }, dur: 0.8 }), { ck: 5, cy: 0, cd: 80 }, 'a hang\'s lip');
  assert.deepEqual(climbPoseOf({ mantling: true, climbFacing: 0.5, climbMove: mantle }), { cl: 3, cw: 0.5, ck: 3, cy: 180, cd: 110 });
  assert.deepEqual(climbPoseOf({ hanging: true, onWall: true, climbFacing: 0, climbMove: null }), { cl: 1, cw: 0 }, 'a hold names no move');
  const base = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  const pick = (p) => Object.fromEntries(Object.entries(validPose(p)).filter(([k]) => ['cl', 'cw', 'ck', 'cy', 'cd'].includes(k)));
  assert.deepEqual(pick({ ...base, cl: 3, cw: 0, ck: 3, cy: 180, cd: 110 }), { cl: 3, cw: 0, ck: 3, cy: 180, cd: 110 });
  assert.deepEqual(pick({ ...base, cl: 3, ck: 99, cy: 1e9, cd: -4 }), { cl: 3 }, 'no kind out of the list');
  assert.deepEqual(pick({ ...base, cl: 3, ck: 2.5 }), { cl: 3 });
  assert.deepEqual(pick({ ...base, cl: 3, ck: 3, cy: 9999, cd: 9999 }), { cl: 3, ck: 3 }, 'the lip and time dropped, the move kept');
  assert.deepEqual(pick({ ...base, cl: 1, ck: 3, cy: 5 }), { cl: 1 }, 'a hold carries no move');
  assert.deepEqual(pick({ ...base, ck: 3 }), {}, 'off the wall, nothing');
  const a = { ...base, cl: 3, cw: 0, ck: 3, cy: 180 };
  assert.equal(poseChanged(a, { ...a, ck: 7 }), true, 'another kind, at once');
  assert.equal(poseChanged(a, { ...a, cy: 120 }), true, 'another lip, at once');
});

test('CLIMB6 C14: A PEER\'S CLIMB rebuilt from its pose - a hang\'s lip PARKOUR_HANG_DROP over its feet and its wall facing the body; a move built once as it begins (its start the feet then, its lip cy over them, its edge a face ahead) and run on its own clock over cd; a new move is a new object; a peer climbing reaches the same law as the own body (mutants: the lip, the clock, a move rebuilt every frame)', () => {
  const tr = new PeerClimbTrack();
  const h = tr.input({ cl: 1, cw: 0 }, [2, 3, 4], 0, 0);
  assert.equal(h.mode, 'hang');
  assert.equal(h.lipY, peerLipY(3));
  near(h.normal, [-0, 0, -1], 1e-12, 'the wall the body faces');
  const a = tr.input({ cl: 3, cw: 0, ck: 3, cy: 180, cd: 110 }, [0, 0, 0], 0, 1000);
  const b = tr.input({ cl: 3, cw: 0, ck: 3, cy: 180, cd: 110 }, [0, 0.9, 0.1], 0, 1550);
  assert.equal(a.move, b.move, 'one move, built once');
  assert.ok(Math.abs(b.move.t - 0.5) < 1e-9, 'on its own clock');
  near(b.move.up, [0, 1.84, 0], 1e-9, 'the rise to the lip and its gap');
  const c = tr.input({ cl: 3, cw: 0, ck: 5, cy: 0, cd: 80 }, [0, 1.8, 0.7], 0, 1600);
  assert.notEqual(c.move, b.move, 'a new kind, a new move');
  assert.equal(c.move.hang.lipY, 1.8);
  assert.equal(tr.input({ cl: 0 }, [0, 0, 0], 0, 1700), null, 'off the wall, nothing');
  const law = new ClimbPose();
  const o = step(law, new PeerClimbTrack().input({ cl: 1, cw: 0 }, [0, 0, 0], 0, 0), 90);
  near(o.hands.R.at, [POSE.HANDS_APART / 2, PARKOUR_HANG_DROP + POSE.WRIST_OVER, POSE.FACE_BACK - POSE.WRIST_OUT], 1e-9, 'a peer\'s hands on its lip');
  assert.equal(peerMove('wallrun', [0, 0, 0], [0, 0, 1], null, 0.5).wall.normal[2], -1, 'a wall run with no lip ends on the face');
});

test('CLIMB6 C15: THE OWN BODY\'S SNAPSHOT off the motor - the hold, the move (the motor\'s own object), the body\'s feet and yaw as the hosts draw it, the classic climb\'s wall, a leap\'s flight, the floor under it; none off the wall (mutants: the move copied, the classic climb\'s wall)', () => {
  const move = { kind: 'mantle', from: [0, 0, 0] };
  const p = { onWall: true, hanging: true, wallNormal: N, climbHold: { lipY: 1.8 }, climbMove: move, grip: 0.4, bodyFeetAt: () => [1, 2, 3], bodyYawFor: () => 0.3, climbTrackPos: () => [1, 2, 2.5] };
  const c = climbRigInput(p, 1.2);
  assert.equal(c.move, move, 'the motor\'s own move');
  assert.deepEqual([c.mode, c.lipY, c.yaw, c.grip], ['hang', 1.8, 0.3, 0.4]);
  assert.deepEqual(c.feet, [1, 2, 3]);
  assert.deepEqual(c.track, [1, 2, 2.5], 'the body\'s own way (no carry)');
  const classic = climbRigInput({ climb: { isClimbing: true }, bodyFeetAt: () => [0, 0, 0], bodyYawFor: () => Math.PI / 2 }, 0);
  near(classic.normal, [-1, 0, -0], 1e-12, 'the classic climb faces its wall');
  assert.equal(classic.mode, 'climb');
  assert.ok(climbRigInput({ climbFlight: { dir: [0, 0, 1] }, velY: -2, bodyFeetAt: () => [0, 0, 0] }, 0).flight, 'a leap\'s flight');
  assert.equal(climbRigInput({ bodyFeetAt: () => [0, 0, 0] }, 0), null, 'nothing off the wall');
  const floor = { surfaceHit: (o, d, max) => ({ dist: Math.min(max, 0.35) }) };
  assert.ok(Math.abs(floorGapAt(floor, [0, 0, 0]) - 0.3) < 1e-9, 'the floor under the feet');
  assert.equal(floorGapAt(null, [0, 0, 0]), Infinity);
});

test('CLIMB6 C16: THE FOUR HOSTS hand the rig the snapshot (world, exterior, interiors in worldModes, the dungeon context through both its callers); the arm poses both views on it, keeps the hands on the screen when posed, and hides the weapon, the arrow and the torch from hands on the stone; the peers\' bodies rebuild it (mutants: a host unwired, the lowering kept over posed arms)', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    assert.match(rd(f), /move: motionBagOf\(player\),[^\n]*\n\s*climb: climbRigInput\(player, cam\.yaw\) \}\),/, `${f}: the weapon rig's camera carries the climb`);
  }
  assert.match(rd('src/scenes/dungeonContext.js'), /bob: \[0, _fpBobY\], climb: _fpClimb \}/, 'the dungeon context\'s camera');
  for (const f of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) assert.match(rd(f), /player\.feetAt\(\), climbRigInput\(player, cam\.yaw\), aimView\);/, `${f}: drawFoes hands it on`);
  const fp = rd('src/combat/fpArm.js');
  assert.match(fp, /climb: thirdClimb\(climbWorld, cam\),/, 'the body\'s pose');
  // PIN MOVED (TWO-HANDS): off the stone the same slot carries the running hands - the climb's request first, the run's
  // only where there is none (was: `climb: held ? null : firstClimb(climbWorld, cam),`)
  // PIN MOVED (TWO-HANDS AUDIT): the climb's request stands alone in the slot again, and the run is solved UNDER it at
  // what the climb leaves (`run:`, poseAssembly) - choosing one dropped the other whole the frame a climb began (was:
  // `climb: held ? null : (firstClimb(climbWorld, cam) ?? firstRun(cam)),`)
  assert.match(fp, /const fClimb = held \? null : firstClimb\(climbWorld, cam\);[^\n]*\n(?:[^\n]*\n){0,6}?\s*climb: fClimb,/, 'the arms\' pose (the sheet\'s hands are the sheet\'s)');
  assert.match(fp, /if \(climbHands && \(r\.slot === 'weapon' \|\| r\.slot === 'arrow' \|\| r\.slot === 'torch'\)\) r\.hidden = true;/, 'nothing in hands on the stone');
  assert.match(rd('src/combat/weapon/weaponRig.js'), /if \(_climbLower > 0 && !armsClimb\)/, 'posed arms stay on the screen');
  assert.match(rd('src/net/peer/peerBodies.js'), /b\.cam\.climb = \(b\.climbTrack \?\?= new PeerClimbTrack\(\)\)\.input\(peer\.shown, f, b\.yaw, this\._now\(\), this\._collider\(\)\);/, 'the peers\' bodies');
  // PIN MOVED (TWO-HANDS AUDIT): the running hands' reach is solved between the neck and the climb, under the climb's
  // request (`assembly.runFit`) - the climb's hook is still the last before the matrices
  // PIN MOVED (RIFLE-STANCE, 2026-10-17): a held long gun's hands (`hold`, combat/gun/rifleStance.js) are solved in the same
  // place, after the climb's slot and before the matrices
  // PIN MOVED (BODY-MOTION, 2026-10-18): the third-person body's own motion (`motion`, characters/bodyMotion/) is solved
  // after the neck and before the run - the climb's and the hold's hooks still the last before the matrices
  assert.match(rd('src/formats/morrowind/mwFirstPerson.js'), /applyFirstPersonNeck\([^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*assembly\.motionFit = motion \? motion\(skeleton, pose, GRAPH_ROOT, fns\.skelMats\) : null;\n(?:\s*\/\/[^\n]*\n)*\s*assembly\.runFit = run \? applyClimbRig\(skeleton, pose, GRAPH_ROOT, fns\.skelMats, run\) : null;\n(?:\s*\/\/[^\n]*\n)*\s*assembly\.climbFit = climb \? applyClimbRig\(skeleton, pose, GRAPH_ROOT, fns\.skelMats, climb\) : null;\n(?:\s*\/\/[^\n]*\n)*\s*assembly\.holdFit = hold \? hold\(skeleton, pose, GRAPH_ROOT, fns\.skelMats\) : null;\n\s*const mats = fns\.skelMats/, 'the hook between the neck and the matrices');
});
