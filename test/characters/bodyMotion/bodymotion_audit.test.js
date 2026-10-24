// AUDIT BODY-MOTION (2026-10-19, Mac: "Audit this"; bible/01-Overview/audits/Audit-Body-Motion.md) - THE AUDIT'S PINS
// on the vendored retail biped: each fix the author's pass made, held where the lanes (and the pass's own probes) found
// it broken. The gait is fed its own travel, as the motor's travelAt hands it (player/motor.js), unless a pin says not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNif } from '../../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, injectSkeletonNodes, GRAPH_ROOT } from '../../../src/formats/morrowind/mwSkin.js';
import { MW_UNITS_PER_METER, MW_WEAPON_TYPE } from '../../../src/formats/morrowind/mwFirstPerson.js';
import { offWeaponBoneAddon } from '../../../src/combat/twoHands/mirrorRig.js';
import { applyClimbRig, rotAxisAngle, handFrame } from '../../../src/combat/climbRig.js';
import { mat33Mul } from '../../../src/formats/morrowind/mwNifMesh.js';
import { bodyOf, RAD, FOOT, turnOf } from '../../../src/characters/bodyMotion/bodyKit.js';
import { GAIT_STYLES, blendStyle, createGaitState, stepGait, gaitPose } from '../../../src/characters/bodyMotion/gait.js';
import { solveBody, ANKLE } from '../../../src/characters/bodyMotion/bodySolve.js';
import { createBodyMotion, sceneInput, motionWord } from '../../../src/characters/bodyMotion/bodyMotion.js';
import { createHipLantern } from '../../../src/systems/lanternSwing.js';
import { retailSkeleton } from '../../fixtures/mw/retailRig.mjs';

const sm = (s, pose, root) => skeletonSpaceMatrices(s, pose, root);
const file = parseNif(retailSkeleton());
const sk = buildSkeleton(file);
injectSkeletonNodes(sk, offWeaponBoneAddon(sk, GRAPH_ROOT, sm, file));
const body = bodyOf(sk, GRAPH_ROOT, sm);
const U = MW_UNITS_PER_METER;
const L = body.leg;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / len(a) / len(b)))) / RAD;

/**
 * The gait walked as the motor drives it: `script(t)` -> { forward, strafe, speed, running, sneaking, yaw, climb (m/s
 * up) }, the body's own travel summed and handed on each frame; `each({ i, t, g, s, w })` sees every frame's pose.
 */
function drive(script, seconds, each = null, hz = 60, state = createGaitState()) {
  const dt = 1 / hz, own = [0, 0, 0];
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    const t = i * dt, w = script(t);
    const yaw = w.yaw ?? 0, f = w.forward ?? 0, st = w.strafe ?? 0, mag = Math.hypot(f, st), v = w.speed ?? 0;
    if (mag > 0 && v > 0) {
      own[0] += ((Math.sin(yaw) * f + Math.cos(yaw) * st) / mag) * v * dt;
      own[2] += ((Math.cos(yaw) * f - Math.sin(yaw) * st) / mag) * v * dt;
      own[1] += (w.climb ?? 0) * dt;
    }
    const inp = {
      speed: v, forward: f, strafe: st, running: !!w.running, sneaking: !!w.sneaking, yaw, grounded: true, kind: 'male',
      legM: L / U, unitsPerM: U, unitsPerMz: U, travel: [...own], carriedYaw: 0, stance: null, stepTime: null,
    };
    stepGait(state, inp, body, dt);
    const g = gaitPose(state, inp, body);
    if (each) each({ i, t, g, s: state, inp });
  }
  return state;
}
/** The worst frame-to-frame change of the hips' height after `warm` seconds. */
const hipStep = (script, seconds, warm = 0.5, hz = 60) => {
  let prev = null, worst = 0;
  drive(script, seconds, ({ t, g }) => { if (prev != null && t >= warm) worst = Math.max(worst, Math.abs(g.hip.at[2] - prev)); prev = g.hip.at[2]; }, hz);
  return worst;
};
/** A foot's heel and ball over the ground (gaitPose's ankle, toe and up - the sole's two contacts). */
const contacts = (f) => ({
  heel: [0, 1, 2].map((k) => f.at[k] - f.toe[k] * FOOT.heel * L - f.up[k] * body.ankle),
  ball: [0, 1, 2].map((k) => f.at[k] + f.toe[k] * FOOT.ball * L - f.up[k] * body.ankle),
});

test('AUDIT BODY-MOTION GAIT-20 ON A SLOPE: up and down 20 degrees the walk dips no deeper than on the level (the stride shortens with the grade, the stance moves up it, the foot down it keeps the level\'s pitch), the run\'s trailing foot holds no hips down after toe-off, and every planted contact stands on the slope itself (mutants: AUDIT-BODY-MOTION-slope-unshifted, AUDIT-BODY-MOTION-slope-ends-level)', () => {
  const range = (deg, dirn, v, running) => {
    const tan = Math.tan(deg * RAD) * dirn;
    let lo = Infinity, hi = -Infinity, off = 0;
    drive(() => ({ forward: 1, speed: v, running, climb: v * tan }), 5, ({ t, g }) => {
      if (t < 2.5) return;
      lo = Math.min(lo, g.hip.at[2]); hi = Math.max(hi, g.hip.at[2]);
      for (const side of ['L', 'R']) {
        const f = g.feet[side];
        if (!f.stance) continue;
        const c = contacts(f), low = Math.min(c.heel[2] - tan * c.heel[1], c.ball[2] - tan * c.ball[1]);
        off = Math.max(off, Math.abs(low));
      }
    });
    return { range: hi - lo, off };
  };
  const level = range(0, 1, 2.6, false);
  for (const dirn of [1, -1]) {
    const r = range(20, dirn, 2.6, false);
    assert.ok(r.range <= level.range + 1, `${dirn > 0 ? 'up' : 'down'} 20 degrees the walk dips ${r.range.toFixed(1)} (the level's ${level.range.toFixed(1)})`);
    assert.ok(r.off < 0.1, `and the planted foot's lower contact stands on the slope (${r.off.toFixed(3)} off it)`);
  }
  assert.ok(hipStep(() => ({ forward: 1, speed: 6.5, running: true, climb: 6.5 * Math.tan(30 * RAD) }), 4, 2) < 2.5, 'running up 30 degrees, no frame drops the hips past the run\'s own spring');
});

test('AUDIT BODY-MOTION GAIT-21 A RUNNING TURN: a foot in the air swings round with the hips along their arc, so a full turn a second at a run never drops the hips as the landing foot comes in reach; and a foot flung out of reach (a run reversed from one strafe to the other, or turned from back to the side) takes the hips in by degrees as it comes back within it (taken at once, 15 to 17 units in a frame) - its pace never thrown by the other\'s strike (GAIT-22: the stride\'s clock set to it, 10); and turned fast, 2 to 4 radians a second then 2 back, under 10 units (RUN-STIFF: the stiffer run\'s higher hips, let go over a tenth of a leg, dropped 12 to 13.5) (mutants: AUDIT-BODY-MOTION-flight-chord, AUDIT-BODY-MOTION-reach-taken-at-once, RUN-STIFF-the-fade-a-tenth)', () => {
  for (const dps of [180, 360]) {
    const step = hipStep((t) => ({ forward: 1, speed: 8.1, running: true, yaw: t * dps * RAD }), 4, 1);
    assert.ok(step < 3, `running and turning ${dps} degrees a second, the hips' worst frame ${step.toFixed(2)} units`);
  }
  let rev = 0;
  for (let k = 0; k < 12; k++) { const t0 = 1.5 + k * 0.025; rev = Math.max(rev, hipStep((t) => ({ strafe: t < t0 ? 1 : -1, speed: 8.1, running: true }), t0 + 1, 1)); }
  assert.ok(rev < 7, `a run's strafe reversed, wherever in the stride: the hips' worst frame ${rev.toFixed(2)} units`);
  // a back run turned into a strafe while turning: a landing foot flung wide comes back into reach
  let wide = 0;
  for (let k = 0; k < 12; k++) {
    const t0 = 1.5 + k * 0.025;
    let yaw = 0, tp = 0;
    wide = Math.max(wide, hipStep((t) => { const w = t < t0 ? { forward: -1, turn: 1.4 } : { strafe: -1, turn: -0.8 }; yaw += w.turn * (t - tp); tp = t; return { forward: w.forward ?? 0, strafe: w.strafe ?? 0, speed: 8.1, running: true, yaw }; }, t0 + 1, 1));
  }
  assert.ok(wide < 11, `a back run turned into a strafe, turning: the hips' worst frame ${wide.toFixed(2)} units`);
  for (const [a, b] of [[2, -2], [3, -2], [4, -2]]) {
    let fast = 0;
    for (let k = 0; k < 12; k++) {
      const t0 = 1.5 + k * 0.025;
      let yaw = 0, tp = 0;
      fast = Math.max(fast, hipStep((t) => { const w = t < t0 ? { forward: -1, turn: a } : { strafe: -1, turn: b }; yaw += w.turn * (t - tp); tp = t; return { forward: w.forward ?? 0, strafe: w.strafe ?? 0, speed: 8.1, running: true, yaw }; }, t0 + 1, 1));
    }
    assert.ok(fast < 10, `a back run turning ${a} radians a second turned into a strafe turning ${-b}: the hips' worst frame ${fast.toFixed(2)} units`);
  }
});

test('AUDIT BODY-MOTION GAIT-22 THE FEET\'S CLOCK: the stride\'s clock is the ground crossed and every flight keeps to it, each stance begins on its own foot\'s clock as far on as the frame ran past the strike, and the body\'s own clock catches up by the feet\'s pace - so after a reversal the feet step half a stride apart again, each foot set down at its stance\'s start (read off the stride\'s clock as it struck, it stood its first frame on the push\'s end - 43 degrees in a frame) and lifted by its end (begun at its start, a run\'s stood past it), and a steady run\'s strikes move no clock - nor, after a reversal at a walk, a jog or a run, does the clock jump more than a tenth of a stride in a frame (THE RUN: set at a strike, it jumped 0.12 to 0.31 - the stiffer run\'s hips no longer showed it) (mutants: AUDIT-BODY-MOTION-strike-sets-the-clock, AUDIT-BODY-MOTION-strike-at-its-start, AUDIT-BODY-MOTION-flight-off-the-clock)', () => {
  // walking forward, then back: the strikes alternate half a cycle apart once it has settled
  const strikes = { L: [], R: [] };
  const was = { L: null, R: null };
  drive((t) => ({ forward: t < 1.5 ? 1 : -1, speed: 4.43 }), 4, ({ t, s }) => {
    for (const side of ['L', 'R']) {
      const planted = !s.feet[side].swing;
      if (was[side] === false && planted && t > 2.5) strikes[side].push(t);
      was[side] = planted;
    }
  });
  const all = [...strikes.L.map((t) => [t, 'L']), ...strikes.R.map((t) => [t, 'R'])].sort((a, b) => a[0] - b[0]);
  assert.ok(all.length >= 5, `the backpedal steps (${all.length} strikes)`);
  const gaps = all.slice(1).map((e, k) => e[0] - all[k][0]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  for (let k = 0; k < gaps.length; k++) {
    assert.notEqual(all[k][1], all[k + 1][1], 'the feet alternate');
    assert.ok(Math.abs(gaps[k] - mean) < 0.2 * mean, `strikes half a stride apart (${gaps.map((x) => x.toFixed(3)).join(', ')})`);
  }
  // a steady run at 480 Hz: the clock each strike sets is where it already stood
  let jump = 0, lag = null;
  drive(() => ({ forward: 1, speed: 8.1, running: true }), 3, ({ t, s }) => { if (lag != null && t > 2) jump = Math.max(jump, Math.abs(s.lag - lag)); lag = s.lag; }, 480);
  assert.ok(jump < 0.01, `a steady run's strikes reset the clock by ${jump.toFixed(4)} of a stride at most`);
  // the first frames of each stance after a walk's reversal: the foot rolls from where it struck
  let roll = 0;
  for (let k = 0; k < 10; k++) {
    const t0 = 1.5 + k * 0.05, since = { L: 9, R: 9 }, last = { L: null, R: null };
    drive((t) => ({ forward: t < t0 ? 1 : -1, speed: 4.43 }), t0 + 1.2, ({ t, g }) => {
      for (const side of ['L', 'R']) {
        const f = g.feet[side], p = Math.atan2(f.toe[2], Math.hypot(f.toe[0], f.toe[1])) / RAD;
        since[side] = f.stance ? since[side] + 1 : 0;
        if (t > 1 && f.stance && since[side] >= 1 && since[side] <= 4 && last[side] != null) roll = Math.max(roll, Math.abs(p - last[side]));
        last[side] = p;
      }
    });
  }
  assert.ok(roll < 20, `after a reversal each foot rolls from its strike: ${roll.toFixed(1)} degrees in a frame at the most`);
  // a steady run's push: where each foot stands behind the hips as it lifts, against its stance's own end (A)
  let over = 0, lifts = 0;
  const stood = { L: true, R: true };
  drive(() => ({ forward: 1, speed: 8.1, running: true }), 4, ({ t, g, s }) => {
    for (const side of ['L', 'R']) {
      const f = g.feet[side];
      if (t > 2 && !f.stance && stood[side]) { over += -((f.at[0] - g.hip.at[0]) * s.dir[0] + (f.at[1] - g.hip.at[1]) * s.dir[1]) - (g.stride * g.duty) / 2; lifts++; }
      stood[side] = f.stance;
    }
  });
  assert.ok(lifts >= 6 && over / lifts < 0, `a run's foot lifts ${(over / lifts).toFixed(2)} units past its stance's end`);
  // after a reversal the body's clock catches up by the feet's pace - never set where a strike says
  for (const [way, v, running] of [['forward', 4.43, false], ['strafe', 4.43, false], ['strafe', 5.5, true], ['strafe', 8.1, true]]) {
    let clockJump = 0;
    for (let k = 0; k < 12; k++) {
      const t0 = 1.5 + k * 0.025;
      let prev = null;
      drive((t) => ({ [way]: t < t0 ? 1 : -1, speed: v, running }), t0 + 1.2, ({ t, s }) => {
        if (prev != null && t >= 1) { const d = s.phase - prev; clockJump = Math.max(clockJump, Math.abs(d - Math.round(d))); }
        prev = s.phase;
      });
    }
    assert.ok(clockJump < 0.1, `${way} reversed at ${v} m/s: the stride's clock jumped ${clockJump.toFixed(3)} of a stride in a frame`);
  }
});

test('AUDIT BODY-MOTION GAIT-23 A BACKPEDAL AND A NEW KEY: a backpedal\'s foot is the walk\'s played backward (it lands on its toes, as steeply as the walk leaves them, and leaves on its heel, as shallowly as the walk lands); and a run of new keys - each foot lifted once its leg no longer reaches it at the hips\' plan, a foot just off the ground asking no more reach than it did as it left - never drops the hips more than a walk\'s own dip in a frame; and the forward share eased, so a reversal rolls a standing foot over (read at once, it turned 48 degrees in a frame) (mutants: AUDIT-BODY-MOTION-backpedal-flipped, AUDIT-BODY-MOTION-leaving-drags, AUDIT-BODY-MOTION-along-unsmoothed)', () => {
  const P = blendStyle(0, 0, 'male');
  let strike = null, push = null;
  const st = drive(() => ({ forward: -1, speed: 4.43 }), 3, ({ t, s }) => {
    if (t < 2) return;
    for (const side of ['L', 'R']) {
      const f = s.feet[side];
      if (f.swing || !f.cur) continue;
      if (f.lastU != null && f.lastU < 0.06) strike = Math.min(strike ?? Infinity, f.cur.pitch / RAD);
      push = Math.max(push ?? -Infinity, f.cur.pitch / RAD);
    }
  });
  assert.equal(st.back, true, 'a backpedal');
  assert.ok(strike < -0.8 * P.toeOff, `it lands on its toes (${strike.toFixed(1)} degrees, the walk's push ${-P.toeOff})`);
  assert.ok(push < P.heel + 2, `and leaves on its heel no steeper than the walk lands (${push.toFixed(1)}, the walk's heel ${P.heel})`);
  const keys = [{ forward: 1 }, { forward: 1, strafe: 1 }, { strafe: 1 }, { forward: -1, strafe: 1 }, { forward: -1 }, { forward: -1, strafe: -1 }];
  const step = hipStep((t) => ({ ...keys[Math.min(5, Math.floor(t))], speed: 4.43 }), 6);
  assert.ok(step < 6, `a new key each second through all six ways: the hips' worst frame ${step.toFixed(2)} units`);
  // forward to back at a walk, the key let go at every twentieth of the stride
  let back = 0;
  for (let k = 0; k < 10; k++) { const t0 = 1.5 + k * 0.05; back = Math.max(back, hipStep((t) => ({ forward: t < t0 ? 1 : -1, speed: 4.43 }), t0 + 1.2, 1)); }
  assert.ok(back < 5.5, `and forward to back at a walk, wherever in the stride: the hips' worst frame ${back.toFixed(2)} units`);
  let turn = 0;
  for (let k = 0; k < 10; k++) {
    const t0 = 1.5 + k * 0.05, last = { L: null, R: null };
    drive((t) => ({ forward: t < t0 ? 1 : -1, speed: 4.43 }), t0 + 1.2, ({ t, g }) => {
      for (const side of ['L', 'R']) { const f = g.feet[side], p = Math.atan2(f.toe[2], Math.hypot(f.toe[0], f.toe[1])) / RAD; if (t > 1 && f.stance && last[side] != null) turn = Math.max(turn, Math.abs(p - last[side])); last[side] = f.stance ? p : null; }
    });
  }
  assert.ok(turn < 25, `a standing foot through the reversal: ${turn.toFixed(1)} degrees in a frame at the most`);
});

test('AUDIT BODY-MOTION GAIT-24 A FLIGHT TURNED FROM UNDER: a foot about to land as the way reverses is re-based to the new way\'s foothold and flies on - never set down where the old way had it, past its leg\'s reach (a walk broken into a run the other way set it down 58 units from its hip, the hips dropping to their floor) - its pitch and lift carried into the new path (read again from mid-swing, the foot was thrown up and down again 10 units against its swing in a frame) (mutants: AUDIT-BODY-MOTION-strike-before-rebase, AUDIT-BODY-MOTION-rebase-uncarried)', () => {
  const reach = Math.min(body.legs.L, body.legs.R) * 0.992, floor = Math.sqrt(reach * reach - (0.62 * L) ** 2);
  const LANE = { L: -1, R: 1 };
  let far = 0, jump = 0;
  for (const [a, b] of [[{ strafe: 1 }, { strafe: -1 }], [{ strafe: -1 }, { forward: 1, strafe: 1 }]]) for (let k = 0; k < 10; k++) {
    const t0 = 1.5 + k * 0.05, was = { L: true, R: true }, z = { L: [], R: [] };
    drive((t) => (t < t0 ? { ...a, speed: 4.43 } : { ...b, speed: 8.1, running: true }), t0 + 1, ({ t, g }) => {
      for (const side of ['L', 'R']) {
        const f = g.feet[side];
        if (t > 1 && f.stance && !was[side]) {
          const jx = g.hip.at[0] + Math.cos(g.hip.yaw) * LANE[side] * body.hipWidth * 0.5, jy = g.hip.at[1] + Math.sin(g.hip.yaw) * LANE[side] * body.hipWidth * 0.5;
          far = Math.max(far, Math.hypot(f.at[0] - jx, f.at[1] - jy));
        }
        // a jump against the foot's own motion (its frame's change off the last one's - a swing's own rise is smooth)
        const h = z[side];
        if (t > 1 && !f.stance && h.length === 2) jump = Math.max(jump, Math.abs(f.at[2] - 2 * h[1] + h[0]));
        was[side] = f.stance; z[side] = f.stance ? [] : [...h.slice(-1), f.at[2]];
      }
    });
  }
  assert.ok(far < floor, `every foot set down within its leg's reach of its hip at the hips' floor: the farthest ${far.toFixed(1)} units (the reach ${floor.toFixed(1)})`);
  // (a steady stride's swing: 1.5 to 2.5 units; re-based with its own lift and pitch read again, 9.7)
  assert.ok(jump < 7, `a foot in the air never thrown: its height's change off the last frame's ${jump.toFixed(2)} units at the most`);
});

test('AUDIT BODY-MOTION GAIT-25 A STANDING FOOT\'S OWN CLOCK: each foot on the ground keeps its own stance\'s progress, begun at its strike and run by the ground crossed, so the other foot\'s strike - which sets the stride\'s clock - never moves it: through a new key three times a second a standing foot rolls on as it stood (read off the stride\'s clock, an early strike threw it toward its push, 28 degrees in a frame) (mutants: AUDIT-BODY-MOTION-stance-on-the-stride-clock)', () => {
  const keys = [{ forward: 1 }, { forward: 1, strafe: 1 }, { strafe: 1 }, { forward: -1, strafe: 1 }, { forward: -1 }, { forward: -1, strafe: -1 }];
  let turn = 0;
  for (let k = 0; k < 10; k++) {
    const t0 = k * 0.033, last = { L: null, R: null };
    drive((t) => ({ ...keys[Math.floor((t + t0) * 3) % 6], speed: 4.43 }), 4, ({ t, g }) => {
      for (const side of ['L', 'R']) {
        const f = g.feet[side], p = Math.atan2(f.toe[2], Math.hypot(f.toe[0], f.toe[1])) / RAD;
        if (t > 1 && f.stance && last[side] != null) turn = Math.max(turn, Math.abs(p - last[side]));
        last[side] = f.stance ? p : null;
      }
    });
  }
  assert.ok(turn < 15, `a standing foot through new keys: ${turn.toFixed(1)} degrees in a frame at the most`);
});

test('AUDIT BODY-MOTION GAIT-1 / GAIT-2 / GAIT-5 / GAIT-6 / GAIT-7 / GAIT-12 / GAIT-15 / GAIT-16 THE GAIT\'S FIRST FINDINGS, each as the lane measured it: S turns the legs about in the frame it is pressed (it never backpedalled); a steady walk\'s and run\'s hips never pop (7.3 and 6.2 units a frame); a sneak standing still crouches (it stood bolt upright); a planted foot keeps its place in the world through the flat of its stance from a stand, to a stop, strafing and on a diagonal (it slid 32 to 36 units); a diagonal into the backpedal rolls the arms\' swing over (46 degrees in a frame); at 30 Hz the hips step no further for the time than at 60; and a NaN, an Infinity and a 5 s frame leave the gait whole (mutants: AUDIT-BODY-MOTION-reversal-eased, AUDIT-BODY-MOTION-sneak-stands-tall, AUDIT-BODY-MOTION-feet-ride-the-body, AUDIT-BODY-MOTION-swing-flipped, AUDIT-BODY-MOTION-nan-frame-kept)', () => {
  let th = null;
  drive((t) => ({ forward: t < 1.5 ? 1 : -1, speed: 4.43 }), 1.6, ({ t, s }) => { if (th == null && t >= 1.5) th = Math.abs(s.th) / RAD; });
  assert.ok(th > 175, `the frame S is pressed the legs go the other way (${th.toFixed(1)} degrees off the facing)`);
  for (const [name, w] of [['walk', { forward: 1, speed: 4.43 }], ['run', { forward: 1, speed: 8.1, running: true }]]) {
    const step = hipStep(() => w, 4, 1.5);
    assert.ok(step < 3, `a steady ${name}: the hips' worst frame ${step.toFixed(2)} units`);
  }
  let stand = 0, sneak = 0;
  drive(() => ({}), 2, ({ g }) => { stand = g.hip.at[2]; });
  drive(() => ({ sneaking: true }), 2, ({ g }) => { sneak = g.hip.at[2]; });
  assert.ok(stand - sneak > 0.08 * L, `a sneak standing still crouches ${(stand - sneak).toFixed(2)} units`);
  // the flat of a stance (both the heel and the ball down), each foot's ankle in the world
  const flatSlip = (script, seconds) => {
    let worst = 0;
    const pin = { L: null, R: null };
    drive(script, seconds, ({ t, g, s }) => {
      const tr = s.travel ?? [0, 0, 0];
      for (const side of ['L', 'R']) {
        const f = g.feet[side], c = contacts(f);
        if (!f.stance || t < 0.3 || Math.abs(c.heel[2] - c.ball[2]) > 0.3) { pin[side] = null; continue; }
        const at = [tr[0] * U + f.at[0], tr[2] * U + f.at[1]];
        if (!pin[side]) pin[side] = at; else worst = Math.max(worst, Math.hypot(at[0] - pin[side][0], at[1] - pin[side][1]));
      }
    });
    return worst;
  };
  for (const [name, script, seconds] of [['from a stand', (t) => (t < 1 ? {} : { forward: 1, speed: 4.43 }), 2.5], ['to a stop', (t) => (t < 1.5 ? { forward: 1, speed: 8.1, running: true } : {}), 3], ['strafing', () => ({ strafe: 1, speed: 4.43 }), 3], ['on a diagonal', () => ({ forward: 1, strafe: 1, speed: 4.43 }), 3]]) {
    const slid = flatSlip(script, seconds);
    assert.ok(slid < 0.5, `${name}: a planted foot slid ${slid.toFixed(3)} units`);
  }
  let swing = 0, prev = null;
  drive((t) => (t < 1.5 ? { strafe: 1, speed: 4.43 } : { forward: -1, strafe: 1, speed: 4.43 }), 3, ({ t, g }) => { if (prev != null && t > 1) swing = Math.max(swing, Math.abs(g.arm.swing - prev) / RAD); prev = g.arm.swing; });
  assert.ok(swing < 12, `into the backpedal on a diagonal the arms' swing turns ${swing.toFixed(1)} degrees in a frame at the most`);
  for (const w of [{ forward: 1, speed: 4.43 }, { forward: 1, speed: 8.1, running: true }]) {
    const at60 = hipStep(() => w, 3.5, 1, 60), at30 = hipStep(() => w, 3.5, 1, 30) / 2;
    assert.ok(at30 < at60 * 1.3, `at 30 Hz the hips step ${at30.toFixed(2)} a sixtieth of a second (at 60, ${at60.toFixed(2)})`);
  }
  const st = createGaitState(), own = [0, 0, 0];
  for (let i = 0; i < 200; i++) {
    const dt = i === 50 ? NaN : i === 60 ? Infinity : i === 70 ? 5 : 1 / 60;
    own[2] += 4.43 / 60;
    const inp = { speed: i === 80 ? NaN : 4.43, forward: 1, strafe: 0, running: false, sneaking: false, yaw: i === 90 ? NaN : 0, grounded: true, kind: 'male', legM: L / U, unitsPerM: U, unitsPerMz: U, travel: [...own], carriedYaw: 0, stance: null, stepTime: null };
    stepGait(st, inp, body, dt);
    const g = gaitPose(st, inp, body);
    assert.ok([g.hip.at[0], g.hip.at[1], g.hip.at[2], st.phase, g.feet.L.at[2], g.feet.R.at[2]].every(Number.isFinite), `frame ${i}: the gait whole`);
  }
});

test('AUDIT BODY-MOTION GAIT-4 THE ANKLE: a foot in the air stays within the ankle\'s own range of the shin the reach gives it (ANKLE - a run\'s mid-swing drew the toes up 82 degrees toward it); a foot on the ground keeps the gait\'s pitch (mutants: AUDIT-BODY-MOTION-ankle-unclamped)', () => {
  for (const [name, w] of [['run', { forward: 1, speed: 8.1, running: true }], ['walk', { forward: 1, speed: 4.43 }]]) {
    let worst = 0, seen = 0;
    drive(() => w, 2.5, ({ t, g }) => {
      if (t < 1.5) return;
      const pose = new Map();
      solveBody(sk, pose, GRAPH_ROOT, sm, { w: 1, hip: g.hip, chest: g.chest, head: { yaw: 0, roll: 0, pitch: 0 }, feet: g.feet });
      const mats = sm(sk, pose, GRAPH_ROOT);
      for (const side of ['L', 'R']) {
        if (g.feet[side].stance) continue;
        const B = body.bones[side], ax = body.footAxes[side], R = turnOf(mats, B.foot);
        const toe = [0, 1, 2].map((r) => R[r * 3] * ax.fwd[0] + R[r * 3 + 1] * ax.fwd[1] + R[r * 3 + 2] * ax.fwd[2]);
        const a = ang(sub(mats.get(B.calf).t, mats.get(B.foot).t), toe);
        worst = Math.max(worst, body.ankleRest[side] / RAD - a);
        seen++;
      }
    });
    assert.ok(seen > 20, `${name}: feet in the air were seen`);
    assert.ok(worst <= ANKLE.dorsi + 1, `${name}: a foot in the air drew its toes up ${worst.toFixed(1)} degrees toward the shin (the ankle's ${ANKLE.dorsi})`);
  }
});

test('AUDIT BODY-MOTION RIG-4 / DOC-3 / CARRY-10 THE UPPER BODY IS WHOEVER HAS THE ARMS\': over a clip that twists the spine and lifts a collarbone, a bow\'s, a spell\'s, a draw\'s and the long gun\'s arms stay where the clip holds them (the chest, the neck and the collarbones the clip\'s); a torch\'s left collarbone is the clip\'s and its right the layer\'s (mutants: AUDIT-BODY-MOTION-clip-chest-taken, AUDIT-BODY-MOTION-clip-clavicle-taken)', () => {
  const ref = (n) => sk.byName.get(n);
  const clipPose = () => {
    const pose = new Map();
    const turn = (name, axis, deg) => { const r = ref(name), n = sk.nodes.get(r), b = pose.get(r) ?? n.rest; pose.set(r, { rotation: mat33Mul(b.rotation, rotAxisAngle(axis, deg * RAD)), translation: b.translation, scale: b.scale }); };
    turn('bip01 spine1', [1, 0, 0], 20); turn('bip01 spine2', [1, 0, 0], 20); turn('bip01 r clavicle', [0, 0, 1], 15); turn('bip01 l clavicle', [0, 0, 1], -12);
    const m0 = sm(sk, pose, GRAPH_ROOT);
    const SL = m0.get(ref('bip01 l upperarm')).t, H = m0.get(ref('bip01 head')).t;
    applyClimbRig(sk, pose, GRAPH_ROOT, sm, { w: 1, hands: { L: { at: [SL[0] + 8, SL[1] + 52, SL[2]], pole: [-1, 0, -0.3] }, R: { at: [H[0] + 4, H[1] + 10, H[2] - 8], pole: [1, -0.3, -0.2] } } });
    return pose;
  };
  const clip = sm(sk, clipPose(), GRAPH_ROOT);
  const run = (scene) => {
    const m = createBodyMotion();
    let mats = null;
    for (let i = 0; i < 90; i++) { m.step(1 / 60, sceneInput(scene)); const pose = clipPose(); m.apply(sk, pose, GRAPH_ROOT, sm); mats = sm(sk, pose, GRAPH_ROOT); }
    return mats;
  };
  const way = (M, a, b) => sub(M.get(ref(b)).t, M.get(ref(a)).t);
  const turnOff = (M, n) => { const a = turnOf(M, ref(n)), b = turnOf(clip, ref(n)); return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6] + a[7] * b[7] + a[8] * b[8] - 1) / 2))) / RAD; };
  for (const [name, scene] of [['a bow', { weapon: MW_WEAPON_TYPE.MarksmanBow }], ['a spell', { weapon: MW_WEAPON_TYPE.LongBladeOneHand, spell: true }], ['the draw', { weapon: MW_WEAPON_TYPE.LongBladeOneHand, equip: true }], ['the long gun', { weapon: MW_WEAPON_TYPE.LongBladeOneHand, rifle: true }]]) {
    const M = run(scene);
    for (const side of ['l', 'r']) {
      // the whole body stands on the layer's hips (their height its own), the arms where the clip turns them
      assert.ok(ang(way(M, `bip01 ${side} forearm`, `bip01 ${side} hand`), way(clip, `bip01 ${side} forearm`, `bip01 ${side} hand`)) < 2, `${name}: the ${side} forearm the clip's`);
      assert.ok(turnOff(M, `bip01 ${side} clavicle`) < 1, `${name}: the ${side} collarbone the clip's`);
    }
    assert.ok(turnOff(M, 'bip01 spine2') < 1, `${name}: the chest the clip's`);
  }
  const torch = run({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, torch: true });
  assert.ok(turnOff(torch, 'bip01 l clavicle') > turnOff(torch, 'bip01 spine2') - 1 && turnOff(torch, 'bip01 spine2') > 5, 'a torch: the chest the layer\'s');
  const lc = (M) => { const a = turnOf(M, ref('bip01 l clavicle')), c = turnOf(M, ref('bip01 spine2')); return [a[0] * c[0] + a[3] * c[3] + a[6] * c[6], a[1] * c[1] + a[4] * c[4] + a[7] * c[7]]; };
  const lcClip = lc(clip), lcTorch = lc(torch);
  assert.ok(Math.abs(lcClip[0] - lcTorch[0]) < 0.02 && Math.abs(lcClip[1] - lcTorch[1]) < 0.02, 'and its left collarbone stands on the chest as the clip stands it');
});

test('AUDIT BODY-MOTION RIG-3 / RIG-9 A PEER\'S LEGS WALK ITS OWN WAY, AND THE CARD SAYS OFF: a peer\'s camera carries the ground its drawn feet crossed (a strafe\'s across the facing - it carried only a forward move, and the legs walked forward under a body going sideways), never a jump\'s placement; and the layer\'s status reads off once the body is the clip\'s (mutants: AUDIT-BODY-MOTION-peer-travel-dropped, AUDIT-BODY-MOTION-peer-jump-walked, AUDIT-BODY-MOTION-card-stale)', async () => {
  const { PeerBodies, JUMP_UNITS } = await import('../../../src/net/peer/peerBodies.js');
  const flush = () => new Promise((r) => setTimeout(r, 0));
  let camOf = null;
  const rig = { attach(r, get) { camOf = get; }, async build() { return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode() { return true; }, thirdActive: () => true, update() {}, drawThird() { return true; }, unload() {} };
  const pb = new PeerBodies({ renderer: {}, createRig: () => rig, buildOpts: () => ({}), now: () => 1000 });
  const peer = { id: 'p1', name: 'p1', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, shown: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mv: 1 } };
  const toScene = (p) => [p.x, p.y, p.z];
  pb.sync([peer], toScene, 1 / 60, [0, 0, 0]);
  for (let i = 0; i < 8; i++) await flush();
  pb.sync([peer], toScene, 1 / 60, [0, 0, 0]);
  const t0 = [...(camOf().move.travel ?? [0, 0, 0])];
  for (let i = 0; i < 30; i++) { peer.shown = { ...peer.shown, x: peer.shown.x + 0.05 }; pb.sync([peer], toScene, 1 / 60, [0, 0, 0]); }
  const t1 = camOf().move.travel ? [...camOf().move.travel] : null;
  assert.ok(t1 && Math.abs(t1[0] - t0[0] - 1.5) < 1e-6 && Math.abs(t1[2] - t0[2]) < 1e-9, `strafing, the peer's camera carries its feet's own way (${t1?.map((v) => v.toFixed(3))})`);
  peer.shown = { ...peer.shown, x: peer.shown.x + JUMP_UNITS * 2 };
  pb.sync([peer], toScene, 1 / 60, [0, 0, 0]);
  assert.ok(Math.abs(camOf().move.travel[0] - t1[0]) < 1e-9, 'a jump is a placement, never a stride');
  // the card: on, then the whole body the clip's (dead)
  const m = createBodyMotion();
  pose({ forward: 1, speed: 3 }, 1, null, m);
  assert.notEqual(m.status().mode, 'off');
  for (let i = 0; i < 60; i++) m.step(1 / 60, sceneInput({ forward: 1, speed: 3, busy: 'dead' }));
  assert.equal(m.status().mode, 'off', 'the card says off once the body is the clip\'s');
});

test('AUDIT BODY-MOTION RIG-7 THE HIP LANTERN rides the hips: the way the body goes is read in the hips\' frame, so a strafe\'s lantern - the hips turned 60 degrees toward the travel under it - swings mostly fore and aft in theirs (mutants: AUDIT-BODY-MOTION-lantern-in-the-facing)', () => {
  const swingOf = (hipYaw) => {
    const lantern = createHipLantern(), rot = new Float32Array(9);
    let worst = { fore: 0, side: 0 };
    const cam = { yaw: 0, move: { forward: 0, strafe: 1, speed: 4.43 } };
    for (let i = 0; i < 120; i++) {
      if (i === 60) cam.move = { forward: 0, strafe: 0, speed: 0 };   // the stop: the hang swings on along the way it went
      lantern.step(cam, 1 / 60, null, rot, hipYaw);
      worst = { fore: Math.max(worst.fore, Math.abs(lantern.swing.fore)), side: Math.max(worst.side, Math.abs(lantern.swing.side)) };
    }
    return worst;
  };
  const facing = swingOf(0), hips = swingOf(-60 * RAD);
  assert.ok(facing.side > facing.fore, 'read in the facing, a strafe swings the hang sideways');
  assert.ok(hips.fore > hips.side, `read in the hips (turned right 60 degrees), it swings fore and aft in theirs (${hips.fore.toFixed(3)} over ${hips.side.toFixed(3)})`);
  void GAIT_STYLES;
});

// ---- THE CARRY AND THE BLOWS on the posed body (the motion stepped and posed at 60 Hz on the rest, the clip's stand-in) ----
const W = MW_WEAPON_TYPE;
const CLASS_WEAPON = { one: W.LongBladeOneHand, two: W.LongBladeTwoHand, wide: W.BluntTwoWide, spear: W.SpearTwoWide, dual: W.LongBladeOneHand };
/** Retail-like lengths (units ahead of the grip, behind it) the pins hold the weapon line to: a longsword's, a claymore's,
 *  a staff's, a spear's. */
const WEAPON_LINE = { one: [85, 10], two: [110, 22], wide: [90, 35], spear: [110, 45], dual: [85, 10] };
const GAIT = { idle: {}, walk: { forward: 1, speed: 4.43 }, run: { forward: 1, speed: 8.1, running: true }, sneak: { forward: 1, speed: 1.9, sneaking: true } };
const pt = (m, name) => m.get(sk.byName.get(name)).t;
const axisOf = (m, name, col) => { const a = m.get(sk.byName.get(name)).a, l = Math.hypot(a[col], a[col + 3], a[col + 6]); return [a[col] / l, a[col + 3] / l, a[col + 6] / l]; };
const addV = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
/** The closest distance from point `p` to the segment a-b. */
const toSeg = (a, b, p) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return len(sub(p, addV(a, scl(ab, t)))); };
/** The motion stepped and posed at 60 Hz: `scene(t)` the scene's input, `each(mats, t, motion)` every frame. */
function pose(scene, seconds, each = null, motion = createBodyMotion()) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const t = i / 60;
    motion.step(1 / 60, sceneInput(typeof scene === 'function' ? scene(t) : scene));
    const p = new Map();
    motion.apply(sk, p, GRAPH_ROOT, sm);
    if (each) each(sm(sk, p, GRAPH_ROOT), t, motion);
  }
  return motion;
}
/** The weapon line's lowest point and how far into the thighs and the torso it goes (capsules about the bones). */
function bladeAgainst(m, cls, wb = 'weapon bone') {
  const g = pt(m, wb), b = axisOf(m, wb, 1), [tip, pom] = WEAPON_LINE[cls];
  const segs = [[sub(g, scl(b, pom)), sub(g, scl(b, 4))], [addV(g, scl(b, 4)), addV(g, scl(b, tip))]];
  const caps = [[pt(m, 'bip01 r thigh'), pt(m, 'bip01 r calf'), 6.5], [pt(m, 'bip01 l thigh'), pt(m, 'bip01 l calf'), 6.5], [pt(m, 'bip01 pelvis'), pt(m, 'bip01 neck'), 9]];
  let into = 0;
  for (const [a, c, r] of caps) for (const [p0, p1] of segs) for (let k = 0; k <= 10; k++) into = Math.max(into, r - toSeg(a, c, addV(p0, scl(sub(p1, p0), k / 10))));
  return { lowest: Math.min(g[2] + b[2] * tip, g[2] - b[2] * pom), into };
}
/** The wrist's ulnar deviation (degrees, + toward the little finger) - the hand's fingers off the forearm's line,
 *  across the palm. */
function ulnar(m, side) {
  const B = body.bones[side], fo = sub(m.get(B.hand).t, m.get(B.fore).t);
  const fr = handFrame(m, B, side), lat = cross(fr.palm, fr.fingers);
  const th = ang(fo, fr.fingers), phi = Math.atan2(dot(norm(fo), norm(lat)), dot(norm(fo), fr.palm));
  const dev = th * Math.sin(phi);
  return side === 'R' ? -dev : dev;
}
const machine = (hitAt = 0.4, seconds = 1, windShare = 0.7) => {
  const tw = hitAt * windShare, tr = hitAt - tw, tf = seconds - hitAt, out = [];
  for (let t = 1 / 60; t < seconds - 1e-9; t += 1 / 60) out.push(t < tw ? { section: 'windup', progress: t / tw } : t < hitAt ? { section: 'release', progress: (t - tw) / tr } : { section: 'follow', progress: (t - hitAt) / tf });
  return out;
};

test('AUDIT BODY-MOTION CARRY-1/2/3/7/8/9/12 EVERY CARRY ROW, HELD: in each class and gait the wrists stay in their range (ulnar deviation under 40 degrees - the guard\'s 78 to 88, the sneak\'s 70 to 75), the weapon above the ground and out of the thighs and the trunk, and a two-handed class\'s left hand on its haft - the two-hander\'s at a run too, TWO-RUN (mutants: AUDIT-BODY-MOTION-two-guard-old, AUDIT-BODY-MOTION-spear-short, AUDIT-BODY-MOTION-two-sneak-low, AUDIT-BODY-MOTION-run-supinated)', () => {
  const bad = [];
  for (const cls of Object.keys(CLASS_WEAPON)) for (const [g, w] of Object.entries(GAIT)) {
    const scene = { weapon: CLASS_WEAPON[cls], hands: cls === 'dual' ? 'dual' : 'single', ...w };
    pose(scene, 2, (m, t) => {
      if (t < 1.4) return;
      const b = bladeAgainst(m, cls);
      if (b.lowest < 0) bad.push(`${cls} ${g}: the weapon ${(-b.lowest).toFixed(1)} into the ground`);
      if (b.into > 2) bad.push(`${cls} ${g}: the weapon ${b.into.toFixed(1)} into the body`);
      for (const side of cls === 'one' ? ['R'] : ['R', 'L']) { const u = ulnar(m, side); if (u > 40) bad.push(`${cls} ${g}: the ${side} wrist ${u.toFixed(0)} degrees ulnar`); }
      if (['two', 'wide', 'spear'].includes(cls) && (g !== 'run' || cls === 'two')) {   // TWO-RUN: the two-hander's run in both hands
        const g0 = pt(m, 'weapon bone'), b0 = axisOf(m, 'weapon bone', 1), v = sub(pt(m, 'weapon bone left'), g0);
        const off = len(sub(v, scl(b0, dot(v, b0))));
        if (off > 1.5) bad.push(`${cls} ${g}: the left hand ${off.toFixed(1)} off the haft`);
      }
    });
  }
  assert.deepEqual([...new Set(bad)].slice(0, 12), []);
});

test('AUDIT BODY-MOTION CARRY-4/6 THE CARRY BETWEEN GAITS: from a stand into a run and back, each class\'s blade turns along an even path round the outside of the body (never over 18 degrees a frame - the summed ways swung it 20 to 41), stays above the ground (a claymore\'s tip went 28 units under it), and the haft hand comes off and onto the haft by its share (it leapt 30 units in a frame) (mutants: AUDIT-BODY-MOTION-blade-summed, AUDIT-BODY-MOTION-grip-at-half, AUDIT-BODY-MOTION-shares-first-order)', () => {
  for (const cls of Object.keys(CLASS_WEAPON)) for (const [from, to] of [['idle', 'run'], ['run', 'idle'], ['run', 'sneak']]) {
    const scene = (t) => ({ weapon: CLASS_WEAPON[cls], hands: cls === 'dual' ? 'dual' : 'single', ...(t < 1.5 ? GAIT[from] : GAIT[to]) });
    let prev = null, prevL = null, turn = 0, jump = 0, lowest = Infinity;
    pose(scene, 2.5, (m, t) => {
      const b = axisOf(m, 'weapon bone', 1), wl = pt(m, 'bip01 l hand');
      if (t >= 1.4) {
        if (prev) turn = Math.max(turn, ang(prev, b));
        if (prevL) jump = Math.max(jump, len(sub(wl, prevL)));
        lowest = Math.min(lowest, bladeAgainst(m, cls).lowest);
      }
      prev = b; prevL = wl;
    });
    assert.ok(turn < 18, `${cls} ${from}->${to}: the blade turned ${turn.toFixed(1)} degrees in a frame`);
    assert.ok(lowest > 0, `${cls} ${from}->${to}: the weapon reached ${lowest.toFixed(1)} under the ground`);
    assert.ok(jump < 7, `${cls} ${from}->${to}: the left hand moved ${jump.toFixed(1)} units in a frame`);
  }
});

test('AUDIT BODY-MOTION CARRY-5/13 A CLASS CHANGED: the stance\'s feet step into the new class\'s (they were thrown 11 units in a frame) from the old class\'s place by the new one\'s share (switched at once, a foot moved 1.9 units a frame), and a class changed back while its blend still runs turns the blend about where it stands (it began afresh, a 3.9-unit leap) (mutants: AUDIT-BODY-MOTION-stance-switched, AUDIT-BODY-MOTION-blend-restarted)', () => {
  let feet = null, worst = 0;
  pose((t) => ({ weapon: W.LongBladeTwoHand, shown: t >= 1, spell: false }), 2, (m) => {
    const f = [pt(m, 'bip01 l foot'), pt(m, 'bip01 r foot')];
    if (feet) worst = Math.max(worst, len(sub(f[0], feet[0])), len(sub(f[1], feet[1])));
    feet = f;
  });
  assert.ok(worst < 2.5, `a two-hander drawn standing: a foot moved ${worst.toFixed(2)} units in a frame (stepped, not thrown)`);
  for (const [name, scene] of [['put away', (t) => ({ weapon: W.LongBladeTwoHand, shown: t < 1 })], ['a claymore for a spear', (t) => ({ weapon: t >= 1 ? W.SpearTwoWide : W.LongBladeTwoHand, shown: true })]]) {
    let at = null, most = 0;
    pose(scene, 2.5, (m) => {
      const f = [pt(m, 'bip01 l foot'), pt(m, 'bip01 r foot')];
      if (at) most = Math.max(most, len(sub(f[0], at[0])), len(sub(f[1], at[1])));
      at = f;
    });
    assert.ok(most < 1.5, `${name} standing: a foot moved ${most.toFixed(2)} units in a frame`);
  }
  let prev = null, leap = 0;
  pose((t) => ({ weapon: W.LongBladeTwoHand, shown: !(t >= 1 && t < 1.08) }), 1.6, (m, t) => {
    const r = pt(m, 'bip01 r hand');
    if (prev && t > 0.9) leap = Math.max(leap, len(sub(r, prev)));
    prev = r;
  });
  assert.ok(leap < 3, `put away and drawn again mid-blend: the right hand moved ${leap.toFixed(2)} units in a frame`);
});

test('AUDIT BODY-MOTION MELEE-1/2/10 A BLOW\'S PATH: each blow\'s hand frame is splined as a rotation (no frame flips - it turned 100 to 150 degrees in one), begins on the carry\'s own hand (a run\'s blow turned 139 degrees in its ease-in), keeps the striking arm out of the trunk (a backhand\'s went 8 units in), and meets its target near its own top speed (MELEE-10: at half of it) (mutants: AUDIT-BODY-MOTION-frames-summed, AUDIT-BODY-MOTION-blow-from-guard, AUDIT-BODY-MOTION-backhand-through, AUDIT-BODY-MOTION-hit-tangent-through)', () => {
  for (const cls of ['one', 'two']) for (const [type, reversed] of [['slash', false], ['slash', true], ['chop', false], ['thrust', false]]) {
    const scene = { weapon: CLASS_WEAPON[cls], hands: 'single' };
    const motion = pose(scene, 1.5);
    let prev = null, turn = 0, deep = 0, prevGrip = null, top = 0, atHit = null;
    const fr = machine();
    fr.forEach((f, i) => {
      pose({ ...scene, blow: { type, reversed, hand: 'R', ...f, strength: 1 } }, 1 / 60, (m) => {
        const b = axisOf(m, 'weapon bone', 1), g = pt(m, 'weapon bone');
        if (prev) turn = Math.max(turn, ang(prev, b));
        prev = b;
        const a = pt(m, 'bip01 pelvis'), c = pt(m, 'bip01 neck');
        for (const p of [pt(m, 'bip01 r hand'), scl(addV(pt(m, 'bip01 r hand'), pt(m, 'bip01 r forearm')), 0.5)]) deep = Math.max(deep, 9 - toSeg(a, c, p));
        // the speed into the hit: the release's last frame (the follow's clock starts slower - the machine's own pace)
        if (prevGrip) { const v = len(sub(g, prevGrip)); top = Math.max(top, v); if (f.section === 'release') atHit = v; }
        prevGrip = g;
      }, motion);
      void i;
    });
    const name = `${cls} ${reversed ? 'back' : type}`;
    assert.ok(turn < 60, `${name}: the blade turned ${turn.toFixed(0)} degrees in a frame`);
    assert.ok(deep < 3, `${name}: the striking arm ${deep.toFixed(1)} units into the trunk`);
    if (!reversed) assert.ok(atHit > 0.75 * top, `${name}: the grip met its target at ${(atHit / top * 100).toFixed(0)} per cent of its top speed`);
  }
  // begun at a run: the ease-in from the carry's own trailing blade
  for (const cls of ['one', 'two']) {
    const scene = { weapon: CLASS_WEAPON[cls], hands: 'single', ...GAIT.run };
    const motion = pose(scene, 1.5);
    let prev = null, turn = 0;
    machine().slice(0, 12).forEach((f) => pose({ ...scene, blow: { type: 'slash', reversed: false, hand: 'R', ...f, strength: 1 } }, 1 / 60, (m) => {
      const b = axisOf(m, 'weapon bone', 1);
      if (prev) turn = Math.max(turn, ang(prev, b));
      prev = b;
    }, motion));
    assert.ok(turn < 25, `${cls} at a run: the blow's ease-in turned the blade ${turn.toFixed(0)} degrees in a frame`);
  }
});

test('AUDIT BODY-MOTION MELEE-4/6/12 A BLOW\'S TRUNK AND FEET: the lead foot steps (lifted - it slid 15 units flat), quickly enough to land with the blow (the stand\'s own step came down a fifth of a second after the hit); a blow the machine drops part-way is let go over the layer\'s ease (the hand leapt 0.9 to 1.2 arm lengths), one cut by the next begins where it stood (1.4); and the strength the release reads is followed, never stepped to (the chest turned 14 degrees in a frame) (mutants: AUDIT-BODY-MOTION-step-slow, AUDIT-BODY-MOTION-drop-at-once, AUDIT-BODY-MOTION-cut-from-carry, AUDIT-BODY-MOTION-wind-stepped)', () => {
  const A = body.arm, scene = { weapon: W.LongBladeTwoHand, hands: 'single' };
  // the step: lifted, and down again within the blow's follow-through (the machine's hit at 0.4 s)
  let rest = null, lift = 0, up = null, down = null;
  const m0 = pose(scene, 2, (m) => { rest = pt(m, 'bip01 l foot'); });
  machine().forEach((f, i) => pose({ ...scene, blow: { type: 'chop', reversed: false, hand: 'R', ...f, strength: 1 } }, 1 / 60, (m) => {
    const h = pt(m, 'bip01 l foot')[2] - rest[2], t = (i + 1) / 60;
    lift = Math.max(lift, h);
    if (up == null && h > 0.3) up = t;
    else if (up != null && down == null && h < 0.3) down = t;
  }, m0));
  assert.ok(lift > 2, `the blow's lead foot lifts ${lift.toFixed(2)} units as it steps`);
  assert.ok(down != null && down - 0.4 < 0.15, `and is down ${(down - 0.4).toFixed(3)} s after the hit`);
  // dropped part-way, and cut by the next
  const jumpAt = (mutate) => {
    const m = pose({ weapon: W.LongBladeOneHand, hands: 'single' }, 1.5);
    let prev = null, worst = 0, cut = false;
    machine().forEach((f, i) => {
      const u = f.section === 'windup' ? 0 : 1;
      if (i > 30) cut = true;
      const input = cut ? mutate(i) : { weapon: W.LongBladeOneHand, hands: 'single', blow: { type: 'slash', reversed: false, hand: 'R', ...f, strength: 1 } };
      void u;
      pose(input, 1 / 60, (mm) => { const g = pt(mm, 'weapon bone'); if (prev && cut) worst = Math.max(worst, len(sub(g, prev)) / A); prev = g; }, m);
    });
    return worst;
  };
  const dropped = jumpAt(() => ({ weapon: W.LongBladeOneHand, hands: 'single', blow: null }));
  assert.ok(dropped < 0.45, `a blow dropped in its follow-through: the grip moved ${dropped.toFixed(2)} arm lengths in a frame`);
  const cutBy = jumpAt((i) => ({ weapon: W.LongBladeOneHand, hands: 'single', blow: { type: 'slash', reversed: false, hand: 'R', section: 'windup', progress: Math.min(1, (i - 30) / 17), strength: 1 } }));
  assert.ok(cutBy < 0.3, `cut by the next blow: the grip moved ${cutBy.toFixed(2)} arm lengths in a frame`);
  // the strength set only as the release begins
  const chestTurn = (strength) => {
    const m = pose(scene, 1.5);
    let prev = null, at = 0;
    machine().slice(0, 22).forEach((f) => pose({ ...scene, blow: { type: 'slash', reversed: false, hand: 'R', ...f, strength: f.section === 'windup' ? 1 : strength } }, 1 / 60, (mm) => {
      const r = sub(pt(mm, 'bip01 r upperarm'), pt(mm, 'bip01 l upperarm')), y = Math.atan2(r[1], r[0]) / RAD;
      if (prev != null && f.section === 'release') at = Math.max(at, Math.abs(y - prev));
      prev = y;
    }, m));
    return at;
  };
  assert.ok(chestTurn(0.1) < chestTurn(1) + 3, `a weak blow's release turns the shoulders ${chestTurn(0.1).toFixed(1)} degrees a frame at most (a full one ${chestTurn(1).toFixed(1)})`);
});

test('AUDIT BODY-MOTION MELEE-7/8/9/11 WHO STRIKES AND HOW FAR: a weapon held alone strikes with its own (right) hand whichever hand the machine leads with; a strafe\'s blow turns the hips back toward the facing and twists the chest no more than 50 degrees off them (BLOW_TRUNK - it was 80 to 92); a staff\'s and a spear\'s left hand slides along the haft to where its arm reaches (0.2 to 0.54 arm lengths short); and the pair\'s guard lowers the arm whose fellow strikes (mutants: AUDIT-BODY-MOTION-empty-hand-strikes, AUDIT-BODY-MOTION-twist-unbound, AUDIT-BODY-MOTION-haft-fixed, AUDIT-BODY-MOTION-guard-dropped)', () => {
  const A = body.arm;
  const hitWith = (hand, extra = {}) => {
    const scene = { weapon: W.LongBladeOneHand, hands: 'single', ...extra };
    const m = pose(scene, 1.5);
    let at = null, twist = 0;
    machine().forEach((f) => pose({ ...scene, blow: { type: 'slash', reversed: false, hand, ...f, strength: 1 } }, 1 / 60, (mm) => {
      const sh = (pt(mm, 'bip01 l upperarm')[1] + pt(mm, 'bip01 r upperarm')[1]) / 2;
      if (!at && f.section === 'follow') at = (pt(mm, 'weapon bone')[1] - sh) / A;
      const c = sub(pt(mm, 'bip01 r upperarm'), pt(mm, 'bip01 l upperarm')), h = sub(pt(mm, 'bip01 r thigh'), pt(mm, 'bip01 l thigh'));
      twist = Math.max(twist, Math.abs(((Math.atan2(c[1], c[0]) - Math.atan2(h[1], h[0])) / RAD + 540) % 360 - 180));
    }, m));
    return { at, twist };
  };
  assert.ok(hitWith('L').at > 0.4, `led with the left, the sword's grip stands ${hitWith('L').at.toFixed(2)} arm lengths ahead at the hit`);
  const strafe = hitWith('R', { strafe: 1, speed: 4.43 });
  assert.ok(strafe.twist < 56, `a strafe's blow twists the shoulders ${strafe.twist.toFixed(0)} degrees off the hips`);
  for (const cls of ['wide', 'spear']) {
    const scene = { weapon: CLASS_WEAPON[cls], hands: 'single' };
    const m = pose(scene, 1.5);
    let off = 0;
    machine().forEach((f) => pose({ ...scene, blow: { type: 'thrust', reversed: false, hand: 'R', ...f, strength: 1 } }, 1 / 60, (mm) => {
      const g0 = pt(mm, 'weapon bone'), b0 = axisOf(mm, 'weapon bone', 1), v = sub(pt(mm, 'weapon bone left'), g0);
      off = Math.max(off, len(sub(v, scl(b0, dot(v, b0)))) / A);
    }, m));
    assert.ok(off < 0.12, `${cls}: through a thrust the left hand stands ${off.toFixed(2)} arm lengths off the haft`);
  }
  const rightAt = (guard) => {
    const scene = { weapon: W.LongBladeOneHand, hands: 'dual' };
    const m = pose(scene, 1.5);
    let z = null;
    machine().slice(0, 24).forEach((f) => pose({ ...scene, guard, blow: { type: 'slash', reversed: false, hand: 'L', ...f, strength: 1 } }, 1 / 60, (mm) => { z = pt(mm, 'bip01 r hand')[2]; }, m));
    return z;
  };
  assert.ok(rightAt(null) - rightAt({ L: 0, R: 0.35 }) > 3, 'the guard lowers the right blade while the left strikes');
});

test('AUDIT SPELL-HAND L3-5 THE SPELL HAND\'S LEFT ARM IS THE CLIP\'S ON THE BODY: a spell readied in the free hand beside a one-handed weapon leaves the left arm to the clip (the Spell idle\'s, composed by the arm), as a torch\'s and a shield\'s - the right arm the layer\'s carry; without it both arms are the layer\'s (mutant: the spell hand unread by the carry)', () => {
  const arms = (scene) => { const m = createBodyMotion(); for (let i = 0; i < 90; i++) m.step(1 / 60, sceneInput(scene)); return m.status().arms; };
  const plain = arms({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, forward: 1, speed: 100 });
  assert.ok(plain.L > 0.9 && plain.R > 0.9, `a blade alone: both arms the layer's (${plain.L.toFixed(2)}, ${plain.R.toFixed(2)})`);
  const spell = arms({ weapon: MW_WEAPON_TYPE.LongBladeOneHand, forward: 1, speed: 100, spellHand: true });
  assert.equal(spell.L, 0, 'the spell hand\'s left arm: the clip\'s');
  assert.ok(spell.R > 0.9, 'the weapon\'s arm: the layer\'s carry');
  assert.equal(motionWord({ spellHand: true }).spellHand, true, 'the rig\'s word carries it');
});
