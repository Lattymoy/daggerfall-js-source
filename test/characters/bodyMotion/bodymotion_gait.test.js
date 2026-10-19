// BODY-MOTION (2026-10-18, Mac: "I want to build improved animations for the morrowind rig (3rd person)" - "Improved
// running/walking for all races ... No band aids"; bible/04-Characters/Body-Motion.md) - THE GAIT AND THE SOLVE, on the
// vendored retail biped (test/fixtures/mw/retailRig.mjs - no Morrowind data in hand).
//
// What is pinned: Alexander's stride and its cap, the duty factor falling with the pace (a walk's double support, a
// run's flight); a planted foot standing still in the world while the body travels over it (the phase advanced by the
// distance over the stride - the property the faster-played walk clip broke); the hips held up by the standing legs (a
// walk's dip between steps, a run's sink at mid-stance); the steer (a strafe turns the hips, never the chest; a backpedal
// past its angle); the feet staying planted while the body turns on the spot and stepping back under it, the turn's side
// first; the families (the female track narrower, the beast on the ball of its foot) and a race's height striding longer;
// and the solve - the hips, the chest, the head and the ankles where they were asked on retail's own bones, and every
// rotation it writes kept a rotation (the compounding skew that put a climb's hand 0.05 units off its hold).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { MW_UNITS_PER_METER } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { applyClimbRig, orthonormal } from '../../../src/combat/climbRig.js';
import { bodyOf, bodyKindOf, frac, RAD, FOOT } from '../../../src/characters/bodyMotion/bodyKit.js';
import {
  GAIT_STYLES, STEER, TURN, strideLength, dutyFactor, blendStyle, createGaitState, stepGait, gaitPose, footPlace,
} from '../../../src/characters/bodyMotion/gait.js';
import { solveBody, bodyFrames } from '../../../src/characters/bodyMotion/bodySolve.js';
import { retailSkeleton } from '../../fixtures/mw/retailRig.mjs';

const sm = (sk, pose, root) => skeletonSpaceMatrices(sk, pose, root);
const sk = buildSkeleton(parseNif(retailSkeleton()));
const body = bodyOf(sk, GRAPH_ROOT, sm);
const U = MW_UNITS_PER_METER;
const legM = body.leg / U;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const at = (mats, name) => mats.get(sk.byName.get(name)).t;
const skew = (r) => { const c = (i, j) => r[i] * r[j] + r[i + 3] * r[j + 3] + r[i + 6] * r[j + 6]; return Math.max(Math.abs(c(0, 0) - 1), Math.abs(c(1, 1) - 1), Math.abs(c(2, 2) - 1), Math.abs(c(0, 1)), Math.abs(c(0, 2)), Math.abs(c(1, 2))); };

/** A frame bag for the gait (stepGait's input). */
const gin = (o = {}) => ({ speed: 0, forward: 0, strafe: 0, running: false, sneaking: false, yaw: 0, grounded: true, kind: 'male', legM, unitsPerM: U, ...o });
/** Walk the gait `seconds` at `hz` (60 Hz); `each(state, pose, t)` sees every frame's pose. */
function walk(input, seconds, each = null, state = createGaitState(), hz = 60) {
  const dt = 1 / hz;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    const inp = typeof input === 'function' ? input(i * dt) : input;
    stepGait(state, inp, body, dt);
    if (each) each(state, gaitPose(state, inp, body), i * dt, inp);
  }
  return state;
}

test('BODY-MOTION THE BODY, MEASURED on retail\'s own bones: the legs and arms their bone lengths, the thighs hung from Bip01 Spine (the hip bone) with Spine1 and Spine2 the trunk above it, the ankle over the sole, the families by the skeleton\'s path (a creature\'s own model and a werewolf none) (mutants: BODY-MOTION-hip-bone-the-pelvis, BODY-MOTION-kind-any-path)', () => {
  assert.ok(body, 'a biped');
  assert.ok(Math.abs(body.leg - 69.8) < 0.3, `the leg ${body.leg}`);
  assert.ok(Math.abs(body.arm - 34.95) < 0.3, `the arm ${body.arm}`);
  assert.equal(sk.nodes.get(body.hipBone).name, 'Bip01 Spine', 'retail\'s thighs hang from the spine');
  assert.deepEqual(body.trunk.map((r) => sk.nodes.get(r).name), ['Bip01 Spine1', 'Bip01 Spine2']);
  assert.ok(body.ankle > 6 && body.ankle < 7.5, `the ankle ${body.ankle}`);
  assert.deepEqual(['meshes/base_anim.nif', 'meshes/base_anim_female.nif', 'meshes/base_animkna.nif', 'meshes/wolf/skin.nif', 'meshes/r/skeleton.nif', null].map(bodyKindOf),
    ['male', 'female', 'beast', null, null, null]);
});

test('BODY-MOTION THE STRIDE is Alexander\'s - 2.3 h (v^2/gh)^0.3 - capped at the style\'s longest; the duty factor falls with the Froude number, so a walk keeps both feet down between steps and a run flies (mutants: BODY-MOTION-stride-exponent, BODY-MOTION-stride-uncapped, BODY-MOTION-duty-flat)', () => {
  const h = 1;
  assert.ok(Math.abs(strideLength(1.6, h, GAIT_STYLES.walk) - 2.3 * Math.pow(1.6 * 1.6 / 9.81, 0.3)) < 1e-9, 'a slow walk strides as Alexander says');
  assert.equal(strideLength(4.43, h, GAIT_STYLES.walk), GAIT_STYLES.walk.strideMax, 'Daggerfall\'s walk pace is past a walk\'s longest stride: capped');
  assert.ok(strideLength(8.1, h, GAIT_STYLES.run) > strideLength(5.5, h, GAIT_STYLES.run), 'a faster run strides longer');
  assert.equal(strideLength(0, h, GAIT_STYLES.walk), 0);
  assert.ok(dutyFactor(1, h, GAIT_STYLES.walk) > 0.5 && dutyFactor(4.43, h, GAIT_STYLES.walk) > 0.5, 'a walk: both feet down between steps');
  assert.ok(dutyFactor(8.1, h, GAIT_STYLES.run) < 0.5, 'a run: a flight between steps');
  assert.ok(dutyFactor(8.1, h, GAIT_STYLES.run) < dutyFactor(4, h, GAIT_STYLES.run), 'and less ground the faster');
});

test('BODY-MOTION A PLANTED FOOT STANDS STILL: walking and running, each foot\'s ankle stays put in the world through the flat of its stance while the body travels over it - the stride\'s clock is the distance over the stride, so each foot strikes once a stride of ground (paced by time, a walk struck a quarter less often and a slow walk half again as often) (mutants: BODY-MOTION-phase-by-time, BODY-MOTION-stance-half-length, BODY-MOTION-stance-backward)', () => {
  for (const [name, inp] of [['walk', gin({ forward: 1, speed: 4.43 })], ['run', gin({ forward: 1, speed: 8.1, running: true })], ['slow walk', gin({ forward: 1, speed: 1.6 })]]) {
    const state = walk(inp, 1.5);
    let travel = 0, worst = 0, seen = 0;
    const planted = { L: null, R: null };
    // at 480 Hz: a run's flat foot lasts a frame and a half at 60
    walk(inp, 1.2, (s, g) => {
      travel += inp.speed / 480 * U;
      const P = blendStyle(s.run, s.sneak, 'male');
      for (const side of ['L', 'R']) {
        const u = frac(s.phase - (side === 'L' ? 0 : 0.5));
        const q = u / g.duty;
        const flat = u < g.duty && q > P.flat[0] + 0.02 && q < P.flat[1] - 0.02;
        if (!flat) { planted[side] = null; continue; }
        const world = [g.feet[side].at[0], g.feet[side].at[1] + travel, g.feet[side].at[2]];
        if (!planted[side]) planted[side] = world;
        else { worst = Math.max(worst, len(sub(world, planted[side]))); seen++; }
      }
    }, state, 480);
    assert.ok(seen > 10, `${name}: the flat of a stance was seen (${seen})`);
    assert.ok(worst < 0.02 * body.leg, `${name}: the planted foot slid ${worst.toFixed(3)} units`);
  }
  // PIN ADDED (AUDIT BODY-MOTION, the author's pass): a planted foot stands in the world however the clock runs, so the
  // slide above cannot tell a clock paced by time from one paced by the ground - the strikes over the ground can
  for (const [name, v] of [['slow walk', 1.6], ['walk', 4.43]]) {
    let strikes = 0, stride = 0, frames = 0;
    const was = { L: true, R: true };
    walk(gin({ forward: 1, speed: v }), 4, (s, g, t) => {
      if (t < 1) return;
      stride += g.stride; frames++;
      for (const side of ['L', 'R']) { if (g.feet[side].stance && !was[side]) strikes++; was[side] = g.feet[side].stance; }
    });
    const ratio = (strikes * (stride / frames) / 2) / (v * 3 * U);
    assert.ok(Math.abs(ratio - 1) < 0.2, `${name}: a strike every ${ratio.toFixed(2)} of half a stride of ground`);
  }
});

test('BODY-MOTION THE HIPS RIDE THE LEGS: a walk is highest over the standing foot and dips where both are down; a run sinks at mid-stance (the leg\'s spring) and rises in the flight; and no standing foot is ever asked past its leg\'s reach - nor through a reversal and a run of new keys, where the plan alone leaves a foot behind it (unheld, a leg asked 7 units past) (mutants: BODY-MOTION-walk-bob-inverted, BODY-MOTION-reach-unheld)', () => {
  for (const [name, inp, mid] of [['walk', gin({ forward: 1, speed: 3 }), 'high'], ['run', gin({ forward: 1, speed: 7, running: true }), 'low']]) {
    const state = walk(inp, 1.5);
    const g0 = gaitPose(state, inp, body);
    let atMid = [], between = [], over = 0;
    walk(inp, 1, (s, g) => {
      const u = frac(s.phase);
      const d = Math.abs(u - g.duty / 2);
      if (d < 0.02) atMid.push(g.hip.at[2]);
      if (Math.abs(u - (g.duty / 2 + 0.25)) < 0.02) between.push(g.hip.at[2]);
      for (const side of ['L', 'R']) {
        if (!g.feet[side].stance) continue;
        const sign = side === 'R' ? 1 : -1;
        const j = [g.hip.at[0] + Math.cos(g.hip.yaw) * sign * body.hipWidth / 2, g.hip.at[1] + Math.sin(g.hip.yaw) * sign * body.hipWidth / 2, g.hip.at[2] - sign * Math.sin(g.hip.roll) * body.hipWidth / 2];
        over = Math.max(over, len(sub(g.feet[side].at, j)) - body.legs[side]);
      }
    }, state);
    const m = atMid.reduce((a, b) => a + b, 0) / atMid.length, b = between.reduce((a, c) => a + c, 0) / between.length;
    assert.ok(atMid.length && between.length);
    if (mid === 'high') {
      assert.ok(m > b + 0.2, `${name}: highest over the standing foot (${m.toFixed(2)} over ${b.toFixed(2)})`);
      // over the standing foot the leg is slack under the hips: they stand at the walk's own height over the ankle - PIN
      // MOVED (AUDIT BODY-MOTION GAIT-3): the walk's carriage, which lowers with the pace (`heightFast`) so a fast walk's
      // legs reach its stance's ends
      const want = body.ankle + (GAIT_STYLES.walk.height + (GAIT_STYLES.walk.heightFast - GAIT_STYLES.walk.height) * g0.frShare) * body.leg;
      assert.ok(Math.abs(m - want) < 0.6, `${name}: at the walk's own height over the standing foot (${m.toFixed(2)}, the walk's ${want.toFixed(2)})`);
    }
    else assert.ok(m < b - 0.5, `${name}: sunk at mid-stance (${m.toFixed(2)} under ${b.toFixed(2)})`);
    assert.ok(over < 0.01, `${name}: a standing foot asked ${over.toFixed(3)} past its leg`);
  }
  // PIN ADDED (AUDIT BODY-MOTION, the author's pass): a steady gait's plan keeps its own feet in reach, so the hold the
  // legs put on the hips shows only where the plan cannot - a reversal's, a new key's
  for (const [name, input] of [['forward to back', (t) => gin({ forward: t < 1.5 ? 1 : -1, speed: 4.43 })], ['new keys', (t) => gin({ ...[{ forward: 1 }, { forward: 1, strafe: 1 }, { strafe: 1 }, { forward: -1, strafe: 1 }, { forward: -1 }, { forward: -1, strafe: -1 }][Math.floor(t * 3) % 6], speed: 4.43 })]]) {
    let over = 0;
    walk(input, 4, (s, g, t) => {
      if (t < 1) return;
      for (const side of ['L', 'R']) {
        if (!g.feet[side].stance) continue;
        const sign = side === 'R' ? 1 : -1;
        const j = [g.hip.at[0] + Math.cos(g.hip.yaw) * sign * body.hipWidth / 2, g.hip.at[1] + Math.sin(g.hip.yaw) * sign * body.hipWidth / 2, g.hip.at[2] - sign * Math.sin(g.hip.roll) * body.hipWidth / 2];
        over = Math.max(over, len(sub(g.feet[side].at, j)) - body.legs[side]);
      }
    });
    assert.ok(over < 0.01, `${name}: a standing foot asked ${over.toFixed(3)} past its leg`);
  }
});

test('BODY-MOTION THE STEER: a strafe turns the hips toward the travel (to the right, clockwise: a negative turn) and the chest back to the facing; a backpedal (back and to the right) turns the hips the other way, their back toward the travel, never more than STEER.backMax (mutants: BODY-MOTION-steer-sign, BODY-MOTION-backpedal-never)', () => {
  const right = walk(gin({ strafe: 1, speed: 4.43 }), 1.5);
  assert.ok(right.psi < -50 * RAD && right.psi >= -STEER.max * RAD - 1e-9, `strafing right the hips turn right (${(right.psi / RAD).toFixed(1)})`);
  const left = walk(gin({ strafe: -1, speed: 4.43 }), 1.5);
  assert.ok(left.psi > 50 * RAD, 'and left, left');
  const g = gaitPose(right, gin({ strafe: 1, speed: 4.43 }), body);
  assert.ok(Math.abs(g.chest.yaw) < 12 * RAD, `the chest keeps the facing (${(g.chest.yaw / RAD).toFixed(1)})`);
  const back = walk(gin({ forward: -1, strafe: 0.6, speed: 4.43 }), 1.5);
  assert.equal(back.back, true, 'back and to the right: a backpedal');
  assert.ok(back.psi > 0 && back.psi <= STEER.backMax * RAD + 1e-9, `the hips turned left - their back toward the travel (${(back.psi / RAD).toFixed(1)})`);
  assert.equal(walk(gin({ forward: 1, speed: 4.43 }), 1.5).back, false);
});

test('BODY-MOTION TURNING ON THE SPOT: standing, the feet keep their place in the world while the body turns over them, and once twisted past TURN.step the foot on the turn\'s side steps back under the body first; a cut of more than TURN.snap re-plants both at once (mutants: BODY-MOTION-feet-turn-with-the-body, BODY-MOTION-step-the-wrong-foot)', () => {
  // PIN MOVED (AUDIT BODY-MOTION GAIT-8 / GAIT-11): each foot stands in the world on its own - a step is a foot's own
  // flight of kind 'step' - and a turn faster than TURN.rate is a cut (a flick, a teleport) that re-plants both, so the
  // small turn is turned at 4 radians a second, not in one frame
  const stepping = (st) => (st.feet.L.swing?.kind === 'step' ? 'L' : st.feet.R.swing?.kind === 'step' ? 'R' : null);
  const s = walk(gin(), 1);
  const before = gaitPose(s, gin(), body).feet.L.at;
  // a small turn to the right: the feet stay where they stand - in the rig they turn the other way (counter-clockwise)
  const small = 12 * RAD;
  walk((t) => gin({ yaw: Math.min(small, t * 4) }), 0.1, null, s);
  const after = gaitPose(s, gin({ yaw: small }), body).feet.L.at;
  const expect = [before[0] * Math.cos(small) - before[1] * Math.sin(small), before[0] * Math.sin(small) + before[1] * Math.cos(small)];
  assert.ok(Math.hypot(after[0] - expect[0], after[1] - expect[1]) < 0.05, `the left foot held its world place (${after[0].toFixed(2)},${after[1].toFixed(2)} vs ${expect[0].toFixed(2)},${expect[1].toFixed(2)})`);
  assert.equal(stepping(s), null, 'no step under TURN.step');
  // past it, turning right: the right foot steps first
  let first = null;
  walk((t) => gin({ yaw: small + t * 1.4 }), 0.6, (st) => { if (!first) first = stepping(st); }, s);
  assert.equal(first, 'R', 'turning right, the right foot opens first');
  walk(gin({ yaw: small + 0.84 }), 1.5, null, s);
  const settled = gaitPose(s, gin({ yaw: small + 0.84 }), body).feet;
  assert.ok(Math.abs(settled.L.at[0] - (body.restHip[0] - body.hipWidth / 2)) < 1 && Math.abs(settled.R.at[0] - (body.restHip[0] + body.hipWidth / 2)) < 1, 'both feet back under the body once the turn is done');
  walk(gin({ yaw: small + 0.84 + Math.PI }), 1 / 60, null, s);
  assert.equal(stepping(s), null, 'a half turn in one frame: re-planted, not stepped');
  assert.ok(TURN.step > 0 && TURN.snap > TURN.step);
});

test('BODY-MOTION THE FAMILIES\' AND THE RACES\' TERMS: the female style\'s track narrower and her pelvis\'s turn greater, the beast\'s foot set on its ball (the styles\' terms - bodymotion_claims.test.js walks them, AUDIT BODY-MOTION DOC-5); a leg half as long again in metres strides longer by Alexander\'s law, and one 1.4 times as long is asked of the rig (mutants: BODY-MOTION-female-track, BODY-MOTION-height-ignored)', () => {
  const track = (kind) => {
    const s = walk(gin({ forward: 1, speed: 4.43, kind }), 1.5);
    const g = gaitPose(s, gin({ forward: 1, speed: 4.43, kind }), body);
    return { width: blendStyle(s.run, s.sneak, kind).width, hipYaw: blendStyle(s.run, s.sneak, kind).hipYaw, bias: blendStyle(0, 0, kind).footBias, g };
  };
  const m = track('male'), f = track('female'), b = track('beast');
  assert.ok(f.width < m.width * 0.8, 'the female track narrower');
  assert.ok(f.hipYaw > m.hipYaw, 'and her pelvis turning more');
  assert.ok(b.bias < 0 && m.bias === 0, 'the beast on the ball of its foot');
  const tall = strideLength(4.43, legM * 1.5, GAIT_STYLES.run), short = strideLength(4.43, legM, GAIT_STYLES.run);
  assert.ok(tall > short * 1.1, 'a taller race strides longer');
  const s1 = walk(gin({ forward: 1, speed: 4.43, running: true, legM: legM * 1.4 }), 1);
  const s2 = walk(gin({ forward: 1, speed: 4.43, running: true }), 1);
  const st = (s, l) => gaitPose(s, gin({ forward: 1, speed: 4.43, running: true, legM: l }), body).stride;
  assert.ok(st(s1, legM * 1.4) > st(s2, legM) * 1.05, 'and the rig is asked for it');
});

test('BODY-MOTION THE FOOT\'S ROCKERS: a toes-up foot turns about its heel and a heels-up foot about its ball - whichever touches stays on the ground where it touched (mutants: BODY-MOTION-rocker-pivot)', () => {
  const flat = footPlace([0, 0], 0, [0, 1], body);
  for (const pitch of [-35 * RAD, 15 * RAD]) {
    const p = footPlace([0, 0], pitch, [0, 1], body);
    // the touching point: the heel (behind the ankle along the foot, under it) or the ball (ahead of it)
    const along = pitch > 0 ? FOOT.heel * body.leg : -FOOT.ball * body.leg;
    const contactOf = (f) => sub(f.at, [f.toe[0] * along + f.up[0] * body.ankle, f.toe[1] * along + f.up[1] * body.ankle, f.toe[2] * along + f.up[2] * body.ankle]);
    const touched = contactOf(p), was = contactOf({ ...flat, toe: flat.toe, up: flat.up });
    assert.ok(Math.abs(touched[2]) < 1e-9, 'the touching point on the ground');
    assert.ok(Math.abs(touched[1] - was[1]) < 1e-9, 'where it touched');
    assert.ok(p.at[2] > flat.at[2], 'and the ankle raised by the roll');
  }
});

test('BODY-MOTION THE SOLVE on retail\'s bones: the hips\' middle where asked, the chest turned as asked in the body\'s frame, the head level, each ankle on its point and every rotation it writes a rotation - so the climb\'s hand laid over it still lands on its hold (mutants: BODY-MOTION-hips-not-moved, BODY-MOTION-chest-turn-dropped, BODY-MOTION-turn-unsquared)', () => {
  const s = walk(gin({ forward: 1, speed: 4.43 }), 1.3);
  const g = gaitPose(s, gin({ forward: 1, speed: 4.43 }), body);
  const pose = new Map();
  const plan = { w: 1, hip: g.hip, chest: { yaw: 0.3, roll: 0, pitch: 0.12 }, head: { yaw: 0, roll: 0, pitch: 0 }, feet: g.feet };
  const rep = solveBody(sk, pose, GRAPH_ROOT, sm, plan);
  const mats = sm(sk, pose, GRAPH_ROOT);
  const mid = [(at(mats, 'bip01 l thigh')[0] + at(mats, 'bip01 r thigh')[0]) / 2, (at(mats, 'bip01 l thigh')[1] + at(mats, 'bip01 r thigh')[1]) / 2, (at(mats, 'bip01 l thigh')[2] + at(mats, 'bip01 r thigh')[2]) / 2];
  assert.ok(len(sub(mid, g.hip.at)) < 0.05, `the hips where asked (${len(sub(mid, g.hip.at)).toFixed(3)})`);
  const F = bodyFrames(body, mats);
  assert.ok(Math.abs(Math.atan2(F.right[1], F.right[0]) - 0.3) < 0.01, 'the chest turned to the left as asked');
  assert.ok(Math.abs(Math.asin(-F.fwd[2]) - 0.12) < 0.02, 'and leaning forward as asked');
  const Rh = mats.get(sk.byName.get('bip01 head')).a;
  const headFwd = [Rh[0] * body.headAxes.fwd[0] + Rh[1] * body.headAxes.fwd[1] + Rh[2] * body.headAxes.fwd[2], Rh[3] * body.headAxes.fwd[0] + Rh[4] * body.headAxes.fwd[1] + Rh[5] * body.headAxes.fwd[2], Rh[6] * body.headAxes.fwd[0] + Rh[7] * body.headAxes.fwd[1] + Rh[8] * body.headAxes.fwd[2]];
  assert.ok(Math.abs(headFwd[2]) < 0.02 && headFwd[1] > 0.99, 'the head level, looking ahead');
  for (const side of ['L', 'R']) assert.ok(len(sub(at(mats, `bip01 ${side.toLowerCase()} foot`), g.feet[side].at)) < 0.05, `the ${side} ankle on its point`);
  assert.ok(rep.feet.L && rep.feet.R);
  let worst = 0;
  for (const [, e] of pose) worst = Math.max(worst, skew(e.rotation));
  assert.ok(worst < 1e-5, `every rotation a rotation (${worst})`);
  // a deep climb (combat/climbRig.js: the body moved and swung, the spine bent, the shoulders drawn, both arms, both legs,
  // the look) - over the moving body and alone: every turn's local kept a rotation, so its hands land on their holds
  const deep = { w: 1, offset: [0, 4, -3], swing: { pitch: 0.3, roll: 0.1 }, lean: { pitch: 0.4, roll: 0.1 }, fit: { up: 10, down: 10 },
    hands: { L: { at: [-15, 20, 120], fingers: [0, 1, 0], palm: [0, 0, -1], curl: 1, shrug: 0.5 }, R: { at: [15, 20, 125], fingers: [0, 1, 0], palm: [0, 0, -1], curl: 1, shrug: 0.5 } },
    feet: { L: { at: [-8, 15, 30], toe: [0, 1, 0] }, R: { at: [8, 12, 25], toe: [0, 1, 0] } }, look: { at: [0, 200, 150] } };
  for (const [name, p] of [['over the body', pose], ['alone', new Map()]]) {
    const fit = applyClimbRig(sk, p, GRAPH_ROOT, sm, deep);
    let sq = 0;
    for (const [, e] of p) sq = Math.max(sq, skew(e.rotation));
    assert.ok(sq < 1e-6, `${name}: the climb's rotations rotations (${sq.toExponential(2)})`);
    assert.ok(fit.reach.L < 1e-4 && fit.reach.R < 1e-4, `${name}: both hands on their holds (${fit.reach.L.toExponential(2)}, ${fit.reach.R.toExponential(2)})`);
  }
  assert.ok(skew(orthonormal([1, 0.01, 0, 0, 1, 0.02, 0, 0, 1])) < 1e-6, 'orthonormal squares a skewed matrix');
  assert.ok(orthonormal([-1, 0, 0, 0, 1, 0, 0, 0, 1])[0] === -1, 'and keeps a mirror a mirror');
});

test('BODY-MOTION THE SOLVE EASES: at half its weight the head stands about half the way from the clip\'s pose to the request - the layer comes on and goes off without a pop (mutants: BODY-MOTION-weight-ignored)', () => {
  const g = gaitPose(walk(gin(), 0.5), gin(), body);
  const ask = { hip: { ...g.hip, at: [g.hip.at[0], g.hip.at[1] + 10, g.hip.at[2] - 6] }, chest: { yaw: 0.5, roll: 0, pitch: 0.3 }, feet: g.feet };
  const restM = sm(sk, new Map(), GRAPH_ROOT);
  const full = new Map(), half = new Map();
  solveBody(sk, full, GRAPH_ROOT, sm, { w: 1, ...ask });
  solveBody(sk, half, GRAPH_ROOT, sm, { w: 0.5, ...ask });
  const fm = sm(sk, full, GRAPH_ROOT), hm = sm(sk, half, GRAPH_ROOT);
  const head = (m) => at(m, 'bip01 head');
  const dFull = len(sub(head(fm), head(restM))), dHalf = len(sub(head(hm), head(restM)));
  assert.ok(dHalf > dFull * 0.3 && dHalf < dFull * 0.7, `half the weight, about half the way (${dHalf.toFixed(2)} of ${dFull.toFixed(2)})`);
  assert.equal(solveBody(sk, new Map(), GRAPH_ROOT, sm, { w: 0, ...ask }), null, 'no weight: nothing posed');
});
