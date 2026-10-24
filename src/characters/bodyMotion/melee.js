// @ts-check
// BODY-MOTION (2026-10-18; bible/04-Characters/Body-Motion.md) - THE BLOWS. A third-person melee strike as a whole
// body: the blade's path through the air, the trunk winding against it and unwinding through it, the hips leading the
// chest, the weight driven onto the lead foot and a step taken with it - in place of Morrowind's clip, which in third
// person took every bone (the legs froze mid-stride and slid: the recorded gap of Morrowind-Rules.md's rule 26).
//
// TIMED BY THE MACHINE, NOT BY A CLOCK OF ITS OWN. combat/fpArm.js already runs a blow through three sections - the
// wind-up to "<type> max attack", the release to "<type> hit" (fitted to Daggerfall's own hit: MW-PACE1), the
// follow-through - and this law reads each section's progress: the wind-up spans u 0..U.windup, the release U.windup..
// U.hit and lands ON the hit, the follow U.hit..1. A held wind-up holds its key; a release skipped part-way (the
// strength's skip) starts part-way. So the blade meets the target on the frame Daggerfall's machine deals the damage.
//
// A CHOREOGRAPHY is keys over u: the GRIP (the Weapon Bone's origin - where the fist closes) in arm lengths off the
// middle of the shoulders, in the BODY's frame [right, forward, up] (the facing, not the twisting chest - so the
// trunk's wind is the body's, and the path is the blade's); the BLADE's way and its true EDGE's (the cut leads with
// the edge: a slash's edge faces where it sweeps); the chest's turn [yaw, roll, pitch] and the hips' yaw (degrees -
// yaw + to the left, as the rig turns); the hips' SHIFT forward and DROP (legs); the lead foot's STEP (legs, laid only
// standing); and the free arm's [flex, abduct, elbow] (a counterweight). Keys are joined by Catmull-Rom splines,
// eased in at the start and out at the end; the first and last are the carry's own (the blow eases in from the stance
// and back out to it). Every key is the RIGHT hand's; a left-hand blow (a pair's, a left fist) is its mirror.

import { algebra, clamp01, smooth } from './bodyKit.js';

const { lerp, norm, cross, dot, scale, sub } = algebra;

/** The machine's sections on u: the wind-up ends at `windup`, the blade lands at `hit`. */
export const U = Object.freeze({ windup: 0.3, hit: 0.5 });

const k = (u, v) => Object.freeze({ u, ...v });
const STANCE_ONE = { grip: [0.55, 0.2, -0.82], blade: [0.3, 0.75, -0.6], edge: [0, 0.2, -1], chest: [0, 0, 0], hip: 0, shift: 0, drop: 0, step: 0, off: [3, 8, 12] };
const STANCE_TWO = { grip: [0.1, 0.42, -0.62], blade: [-0.3, 0.82, -0.48], edge: [0, 0.35, -1], chest: [0, 0, 0], hip: 0, shift: 0, drop: 0, step: 0, off: [0, 0, 0] };
const STANCE_FIST = { grip: [0.2, 0.32, 0.02], fingers: [0, 0.55, 0.85], palm: [-1, 0, 0], chest: [0, 0, 0], hip: 0, shift: 0, drop: 0, step: 0, off: [0, 0, 0] };

/**
 * THE CHOREOGRAPHIES - MELEE[family][blow], `blow` one of chop (a downward cut), slash (the forehand, right to left),
 * back (the backhand, left to right - Daggerfall's StrikeRight, MS1's reversed slash) and thrust. Families: 'one' (a
 * one-hander; also each blade of a pair), 'two' (a two-hander, a staff and a spear - both hands, the left on the haft,
 * carry.js: AUDIT BODY-MOTION DOC-16 - a staff's and a spear's are no families of their own, meleeFamilyOf), 'fists'
 * (bare hands: the straight, the hook, the overhand and the uppercut). Tuned on the retail biped through
 * tools/bodyMotionSheet.mjs's blow scenes; one frozen table, for Mac to move on his own data.
 */
export const MELEE = Object.freeze({
  one: Object.freeze({
    slash: [
      k(0, STANCE_ONE),
      k(0.3, { grip: [0.78, -0.12, 0.06], blade: [0.42, -0.84, 0.34], edge: [0.85, 0.5, 0], chest: [-38, 0, -2], hip: -14, shift: -0.03, drop: 0.01, step: 0.02, off: [30, 18, 50] }),
      k(0.5, { grip: [0.12, 0.66, -0.06], blade: [0.04, 1, -0.08], edge: [-1, 0, 0], chest: [6, 2, 7], hip: 12, shift: 0.05, drop: 0.03, step: 0.18, off: [-22, 26, 30] }),
      k(0.68, { grip: [-0.52, 0.38, -0.22], blade: [-0.88, 0.3, -0.25], edge: [-0.3, -0.95, 0], chest: [30, 3, 9], hip: 18, shift: 0.06, drop: 0.035, step: 0.18, off: [-30, 30, 25] }),
      k(0.86, { grip: [0.18, 0.4, -0.55], blade: [0.25, 0.85, -0.45], edge: [0, 0.2, -1], chest: [8, 0, 3], hip: 4, shift: 0.02, drop: 0.01, step: 0.06, off: [0, 10, 16] }),
      k(1, STANCE_ONE),
    ],
    back: [
      k(0, STANCE_ONE),
      // AUDIT BODY-MOTION MELEE-2: carried across the body out in front of it (straight to the wind-up, the forearm went 7
      // units through the chest)
      k(0.15, { grip: [0.18, 0.5, -0.3], blade: [-0.2, 0.35, 0.91], edge: [-0.35, 0.75, -0.55], chest: [16, 0, 0], hip: 5, shift: -0.01, drop: 0.005, step: 0, off: [-4, 14, 21] }),
      k(0.3, { grip: [-0.4, 0.4, 0.1], blade: [-0.8, -0.5, 0.33], edge: [-0.5, 0.86, 0], chest: [32, 0, 0], hip: 10, shift: -0.02, drop: 0.01, step: 0, off: [-10, 20, 30] }),
      k(0.5, { grip: [0.1, 0.62, -0.04], blade: [0.02, 1, -0.06], edge: [1, 0, 0], chest: [-4, -2, 6], hip: -8, shift: 0.05, drop: 0.03, step: 0.12, off: [10, 28, 40] }),
      k(0.68, { grip: [0.76, 0.24, -0.16], blade: [0.86, -0.32, -0.22], edge: [0.3, -0.95, 0], chest: [-30, -2, 7], hip: -14, shift: 0.05, drop: 0.03, step: 0.12, off: [20, 30, 40] }),
      k(0.86, { grip: [0.5, 0.3, -0.55], blade: [0.3, 0.85, -0.45], edge: [0, 0.2, -1], chest: [-6, 0, 2], hip: -3, shift: 0.01, drop: 0.01, step: 0.04, off: [4, 10, 16] }),
      k(1, STANCE_ONE),
    ],
    chop: [
      k(0, STANCE_ONE),
      k(0.3, { grip: [0.32, -0.05, 0.78], blade: [0.08, -0.72, 0.69], edge: [0.05, 0.7, 0.7], chest: [-16, 0, -10], hip: -6, shift: -0.04, drop: 0, step: 0.02, off: [25, 20, 40] }),
      k(0.5, { grip: [0.12, 0.62, 0.02], blade: [0, 0.86, -0.5], edge: [0, -0.5, -0.86], chest: [6, 0, 14], hip: 6, shift: 0.05, drop: 0.04, step: 0.16, off: [-15, 25, 30] }),
      k(0.68, { grip: [0.02, 0.46, -0.52], blade: [-0.05, 0.35, -0.94], edge: [0, -0.94, -0.35], chest: [12, 0, 20], hip: 8, shift: 0.07, drop: 0.06, step: 0.16, off: [-20, 25, 25] }),
      k(0.86, { grip: [0.35, 0.32, -0.6], blade: [0.25, 0.85, -0.45], edge: [0, 0.2, -1], chest: [3, 0, 5], hip: 2, shift: 0.02, drop: 0.02, step: 0.05, off: [0, 10, 16] }),
      k(1, STANCE_ONE),
    ],
    thrust: [
      k(0, STANCE_ONE),
      k(0.3, { grip: [0.48, -0.28, -0.32], blade: [0.04, 1, 0.1], edge: [0, 0, -1], chest: [-24, 0, -2], hip: -10, shift: -0.05, drop: 0.02, step: 0, off: [20, 15, 45] }),
      k(0.5, { grip: [0.14, 1.02, -0.04], blade: [0, 1, 0.02], edge: [0, 0, -1], chest: [18, 0, 10], hip: 10, shift: 0.1, drop: 0.06, step: 0.26, off: [-35, 20, 20] }),
      k(0.68, { grip: [0.18, 0.84, -0.1], blade: [0.02, 1, -0.05], edge: [0, 0, -1], chest: [12, 0, 8], hip: 8, shift: 0.08, drop: 0.05, step: 0.26, off: [-30, 20, 25] }),
      k(0.86, { grip: [0.45, 0.3, -0.5], blade: [0.25, 0.85, -0.45], edge: [0, 0.2, -1], chest: [3, 0, 3], hip: 2, shift: 0.02, drop: 0.02, step: 0.08, off: [0, 10, 16] }),
      k(1, STANCE_ONE),
    ],
  }),
  two: Object.freeze({
    slash: [
      k(0, STANCE_TWO),
      k(0.3, { grip: [0.5, -0.22, 0.22], blade: [0.4, -0.82, 0.42], edge: [0.85, 0.45, 0], chest: [-45, 0, -2], hip: -20, shift: -0.05, drop: 0.02, step: 0.02 }),
      k(0.5, { grip: [0, 0.58, -0.1], blade: [0, 1, -0.05], edge: [-1, 0, 0], chest: [6, 2, 8], hip: 14, shift: 0.07, drop: 0.05, step: 0.2 }),
      k(0.7, { grip: [-0.5, 0.26, -0.32], blade: [-0.9, 0.22, -0.35], edge: [-0.25, -0.97, 0], chest: [40, 3, 10], hip: 24, shift: 0.09, drop: 0.06, step: 0.2 }),
      k(0.88, { grip: [0, 0.42, -0.62], blade: [-0.2, 0.85, -0.5], edge: [0, 0.3, -1], chest: [10, 0, 4], hip: 6, shift: 0.02, drop: 0.02, step: 0.06 }),
      k(1, STANCE_TWO),
    ],
    back: [
      k(0, STANCE_TWO),
      k(0.15, { grip: [0.12, 0.5, -0.12], blade: [-0.25, 0.4, 0.88], edge: [-0.5, 0.75, -0.4], chest: [19, 0, -1], hip: 8, shift: -0.02, drop: 0.01, step: 0 }),
      k(0.3, { grip: [-0.4, 0.25, 0.3], blade: [-0.55, -0.72, 0.42], edge: [-0.8, 0.55, 0], chest: [38, 0, -2], hip: 16, shift: -0.04, drop: 0.02, step: 0 }),
      k(0.5, { grip: [0.05, 0.58, -0.08], blade: [0.02, 1, -0.05], edge: [1, 0, 0], chest: [-6, -2, 8], hip: -12, shift: 0.07, drop: 0.05, step: 0.16 }),
      k(0.7, { grip: [0.6, 0.22, -0.3], blade: [0.9, -0.25, -0.3], edge: [0.25, -0.97, 0], chest: [-36, -3, 9], hip: -20, shift: 0.08, drop: 0.05, step: 0.16 }),
      k(0.88, { grip: [0.15, 0.42, -0.62], blade: [-0.1, 0.85, -0.5], edge: [0, 0.3, -1], chest: [-8, 0, 4], hip: -5, shift: 0.02, drop: 0.02, step: 0.05 }),
      k(1, STANCE_TWO),
    ],
    chop: [
      k(0, STANCE_TWO),
      k(0.3, { grip: [0.12, -0.12, 0.85], blade: [0.05, -0.8, 0.6], edge: [0.02, 0.6, 0.8], chest: [-10, 0, -14], hip: -5, shift: -0.05, drop: 0, step: 0.02 }),
      k(0.5, { grip: [0.06, 0.55, 0.08], blade: [0, 0.82, -0.57], edge: [0, -0.57, -0.82], chest: [4, 0, 18], hip: 4, shift: 0.07, drop: 0.07, step: 0.2 }),
      k(0.7, { grip: [0.02, 0.4, -0.55], blade: [-0.05, 0.3, -0.95], edge: [0, -0.95, -0.3], chest: [8, 0, 26], hip: 6, shift: 0.09, drop: 0.1, step: 0.2 }),
      k(0.88, { grip: [0.1, 0.45, -0.6], blade: [-0.2, 0.85, -0.5], edge: [0, 0.3, -1], chest: [3, 0, 6], hip: 2, shift: 0.03, drop: 0.03, step: 0.06 }),
      k(1, STANCE_TWO),
    ],
    thrust: [
      k(0, STANCE_TWO),
      k(0.3, { grip: [0.44, -0.2, -0.36], blade: [-0.05, 1, 0.14], edge: [0, 0, -1], chest: [-22, 0, -2], hip: -12, shift: -0.06, drop: 0.02, step: 0 }),   // MELEE-2: drawn back beside the hip, clear of the belly on the way out
      k(0.5, { grip: [0.06, 0.88, -0.04], blade: [0, 1, 0.02], edge: [0, 0, -1], chest: [14, 0, 12], hip: 10, shift: 0.12, drop: 0.07, step: 0.3 }),
      k(0.7, { grip: [0.1, 0.72, -0.1], blade: [-0.05, 1, -0.05], edge: [0, 0, -1], chest: [10, 0, 10], hip: 8, shift: 0.1, drop: 0.06, step: 0.3 }),
      k(0.88, { grip: [0.1, 0.45, -0.6], blade: [-0.2, 0.85, -0.5], edge: [0, 0.3, -1], chest: [3, 0, 4], hip: 2, shift: 0.03, drop: 0.02, step: 0.08 }),
      k(1, STANCE_TWO),
    ],
  }),
  fists: Object.freeze({
    thrust: [
      k(0, STANCE_FIST),
      k(0.3, { grip: [0.28, 0.12, -0.06], fingers: [0, 0.6, 0.8], palm: [-1, 0, 0], chest: [-12, 0, 0], hip: -8, shift: -0.01, drop: 0.01, step: 0 }),
      k(0.5, { grip: [0.1, 0.96, -0.02], fingers: [0, 1, 0], palm: [0, 0, -1], chest: [26, 0, 4], hip: 16, shift: 0.05, drop: 0.02, step: 0.08 }),
      k(0.66, { grip: [0.12, 0.86, -0.03], fingers: [0, 1, 0], palm: [0, 0, -1], chest: [20, 0, 4], hip: 12, shift: 0.04, drop: 0.02, step: 0.08 }),
      k(0.86, { grip: [0.22, 0.4, 0], fingers: [0, 0.6, 0.8], palm: [-1, 0, 0], chest: [4, 0, 1], hip: 3, shift: 0.01, drop: 0, step: 0.02 }),
      k(1, STANCE_FIST),
    ],
    slash: [
      k(0, STANCE_FIST),
      k(0.3, { grip: [0.62, 0.12, 0], fingers: [-0.3, 0.9, 0.3], palm: [0, -0.3, -1], chest: [-22, 0, 0], hip: -10, shift: 0, drop: 0.02, step: 0 }),
      k(0.5, { grip: [0, 0.62, 0.02], fingers: [-1, 0.2, 0], palm: [0, 0, -1], chest: [32, 0, 4], hip: 18, shift: 0.04, drop: 0.03, step: 0.06 }),
      k(0.68, { grip: [-0.3, 0.45, 0], fingers: [-1, -0.2, 0], palm: [0, 0, -1], chest: [42, 0, 5], hip: 22, shift: 0.04, drop: 0.03, step: 0.06 }),
      k(0.86, { grip: [0.15, 0.36, 0.02], fingers: [0, 0.6, 0.8], palm: [-1, 0, 0], chest: [6, 0, 1], hip: 4, shift: 0.01, drop: 0, step: 0.02 }),
      k(1, STANCE_FIST),
    ],
    back: [
      k(0, STANCE_FIST),
      k(0.3, { grip: [0.35, 0.1, -0.45], fingers: [0, 0.3, 1], palm: [-0.6, -0.8, 0], chest: [-16, 0, 6], hip: -6, shift: 0, drop: 0.05, step: 0 }),
      k(0.5, { grip: [0.06, 0.6, 0.28], fingers: [0, -0.2, 1], palm: [0, -1, 0], chest: [20, 0, -6], hip: 12, shift: 0.04, drop: 0, step: 0.06 }),
      k(0.68, { grip: [0.04, 0.52, 0.36], fingers: [0, -0.3, 1], palm: [0, -1, 0], chest: [22, 0, -8], hip: 14, shift: 0.03, drop: 0, step: 0.06 }),
      k(0.86, { grip: [0.2, 0.36, 0.04], fingers: [0, 0.6, 0.8], palm: [-1, 0, 0], chest: [4, 0, 0], hip: 3, shift: 0.01, drop: 0, step: 0.02 }),
      k(1, STANCE_FIST),
    ],
    chop: [
      k(0, STANCE_FIST),
      k(0.3, { grip: [0.45, 0, 0.42], fingers: [0, 0.2, 1], palm: [-1, 0, 0], chest: [-14, 0, -6], hip: -6, shift: -0.01, drop: 0, step: 0 }),
      k(0.5, { grip: [0.12, 0.78, -0.08], fingers: [0, 0.8, -0.6], palm: [-1, 0, 0], chest: [16, 0, 12], hip: 10, shift: 0.05, drop: 0.04, step: 0.08 }),
      k(0.68, { grip: [0.02, 0.55, -0.35], fingers: [0, 0.4, -0.9], palm: [-1, 0, 0], chest: [18, 0, 16], hip: 12, shift: 0.05, drop: 0.05, step: 0.08 }),
      k(0.86, { grip: [0.22, 0.38, 0], fingers: [0, 0.6, 0.8], palm: [-1, 0, 0], chest: [4, 0, 2], hip: 3, shift: 0.01, drop: 0.01, step: 0.02 }),
      k(1, STANCE_FIST),
    ],
  }),
});

/** Which family a carry class strikes with (carry.js carryClassOf), or null where the body does not choreograph its
 *  blows (a bow's shot, a spell - the clip's own). A staff and a spear swing the two-hander's arcs; a pair's blade the
 *  one-hander's. */
export function meleeFamilyOf(cls) {
  switch (cls) {
    case 'one': case 'dual': return 'one';
    case 'two': case 'wide': case 'spear': return 'two';
    case 'fists': return 'fists';
    default: return null;
  }
}

/** The blow's name in the table: Daggerfall's StrikeRight is the slash played backward (MS1's backhand). */
export const blowName = (type, reversed) => (type === 'slash' && reversed ? 'back' : type);

/**
 * WHERE ON u the machine stands: `section` 'windup' | 'release' | 'follow' and its `progress` (0..1, the section clip's
 * own completion - combat/fpArm.js clipCompletion). The wind-up eases in and out (a gathering), the release
 * accelerates into the hit (a blow is fastest at contact), the follow decelerates.
 */
export function blowU(section, progress) {
  const p = clamp01(progress);
  if (section === 'windup') return U.windup * smooth(p);
  if (section === 'release') return U.windup + (U.hit - U.windup) * Math.pow(p, 1.6);
  return U.hit + (1 - U.hit) * (1 - (1 - p) * (1 - p));
}

/** The blow's weight over the carry at u: eased in over its first tenth, out over its last fifth. */
const blowWeight = (u) => smooth(u / 0.1) * (1 - smooth((u - 0.8) / 0.2));

/** Catmull-Rom across non-uniform keys on one number per key (`get`), zero speed at the ends - and at the HIT the
 *  stroke's own way and speed, the chord from the key before (AUDIT BODY-MOTION MELEE-10: read through to the follow-
 *  through's key, the blade met its target at half the speed it had reached on the way). */
function spline(keys, u, get) {
  const n = keys.length;
  if (u <= keys[0].u) return get(keys[0]);
  if (u >= keys[n - 1].u) return get(keys[n - 1]);
  let i = 0;
  while (i < n - 2 && u > keys[i + 1].u) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const h = k1.u - k0.u, t = (u - k0.u) / h;
  const p0 = get(k0), p1 = get(k1);
  const slope = (j) => {
    if (j <= 0 || j >= n - 1) return 0;
    if (keys[j].u === U.hit) return (get(keys[j]) - get(keys[j - 1])) / (keys[j].u - keys[j - 1].u);
    return (get(keys[j + 1]) - get(keys[j - 1])) / (keys[j + 1].u - keys[j - 1].u);
  };
  const m0 = slope(i) * h, m1 = slope(i + 1) * h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}
const vecAt = (keys, u, name) => {
  if (!keys[0][name]) return null;
  return [0, 1, 2].map((i) => spline(keys, u, (key) => key[name][i]));
};

/** The rotation whose columns are `x`, `y` (squared against x) and their cross, as a unit quaternion [w, x, y, z]. */
function quatOf(xIn, yIn) {
  const x = norm(xIn), y = norm(sub(yIn, scale(x, dot(yIn, x)))), z = cross(x, y);
  const m00 = x[0], m11 = y[1], m22 = z[2], tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; q = [S / 4, (y[2] - z[1]) / S, (z[0] - x[2]) / S, (x[1] - y[0]) / S]; }
  else if (m00 > m11 && m00 > m22) { const S = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [(y[2] - z[1]) / S, S / 4, (y[0] + x[1]) / S, (z[0] + x[2]) / S]; }
  else if (m11 > m22) { const S = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(z[0] - x[2]) / S, (y[0] + x[1]) / S, S / 4, (z[1] + y[2]) / S]; }
  else { const S = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(x[1] - y[0]) / S, (z[0] + x[2]) / S, (z[1] + y[2]) / S, S / 4]; }
  return q;
}
/** The quaternion's rotation's first two columns. */
function columnsOf(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1, [w, x, y, z] = q.map((v) => v / l);
  return [[1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)], [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)]];
}
/** Each key's hand frame as a quaternion, every one in the hemisphere of the key before it - memoised per blow (a blow
 *  begun from the carry's own hand is keyed afresh). */
const _frames = new WeakMap();
function framesOf(keys, a, b) {
  let per = _frames.get(keys);
  if (!per) { per = new Map(); _frames.set(keys, per); }
  const name = `${a}/${b}`;
  if (!per.has(name)) {
    let prev = null;
    per.set(name, keys.map((key) => {
      let q = quatOf(key[a], key[b]);
      if (prev && q[0] * prev[0] + q[1] * prev[1] + q[2] * prev[2] + q[3] * prev[3] < 0) q = q.map((v) => -v);
      prev = q;
      return q;
    }));
  }
  return per.get(name);
}

/** A blow's keys begun on `from.start` and ended on `from.end`, in place of the standing stance's: each the hand (the
 *  right hand's, in the body frame - its grip and its blade and edge, or a fist's fingers and palm: the carry's own
 *  where it stands now) and, begun where a blow this one cut stood, the trunk's wind too (its chest, hips, shift, drop,
 *  step and free arm). */
const CHANNELS = Object.freeze(['grip', 'blade', 'edge', 'fingers', 'palm', 'chest', 'hip', 'shift', 'drop', 'step', 'off']);
function fromCarry(keys, from) {
  if (!from || (!from.start && !from.end)) return keys;
  const pick = (key, at) => {
    if (!at) return key;
    const o = { ...key };
    for (const n of CHANNELS) if (at[n] != null && key[n] != null) o[n] = at[n];
    return Object.freeze(o);
  };
  return [pick(keys[0], from.start), ...keys.slice(1, -1), pick(keys[keys.length - 1], from.end)];
}
/**
 * THE HAND'S FRAME at u - the blade's and the edge's ways (or a fist's fingers' and palm's), as the keys' frames splined
 * as rotations (AUDIT BODY-MOTION MELEE-1: each way splined on its own and normalised, a blade turning past a quarter
 * turn between keys passed through nothing and flipped 100 to 150 degrees in one frame). Answers [`a`, `b` squared
 * against it] - or null.
 */
function frameAt(keys, u, a, b) {
  if (!keys[0][a] || !keys[0][b]) return null;
  const qs = framesOf(keys, a, b);
  const at = keys.map((key, i) => ({ u: key.u, q: qs[i] }));
  const q = [0, 1, 2, 3].map((i) => spline(at, u, (key) => key.q[i]));
  return columnsOf([q[0], q[1], q[2], q[3]]);
}

/**
 * THE BLOW AT u - the RIGHT hand's, in the body frame: { grip, blade, edge (or fingers, palm for a fist), chest [yaw,
 * roll, pitch] (degrees), hip, shift, drop, step, off } - and `w`, its weight over the carry. `side` 'L' mirrors it
 * across the body's middle (a left-hand blow). `from`: { start, end } - where the blow begins and ends in place of the
 * standing stance: the carry's own striking hand now (AUDIT BODY-MOTION MELEE-1: begun from the standing guard, a
 * running two-hander's blade trailing behind turned 139 degrees in a frame to the guard on its way to the wind-up behind
 * it), and for a blow that cut another the hand and the trunk where that one stood, its weight `w` held over the wind-up
 * (MELEE-6: begun from the carry, a follow-through cut by the next blow leapt 1.4 arm lengths). Null where the family has
 * no such blow.
 */
export function blowPose(family, blow, u, side = 'R', from = null) {
  const table = MELEE[family]?.[blow];
  if (!table) return null;
  const keys = fromCarry(table, from);
  // a blow begun where one it cut stood holds the body from its start, and hands it to its own weight over its wind-up
  const held = from?.start?.w ? from.start.w * (1 - smooth(u / U.windup)) : 0;
  const m = side === 'L' ? -1 : 1;
  const mx = (v) => (v ? [v[0] * m, v[1], v[2]] : null);
  const chest = vecAt(keys, u, 'chest') ?? [0, 0, 0];
  const nrm = (v) => (v ? norm(v) : null);
  const weapon = frameAt(keys, u, 'blade', 'edge'), fist = frameAt(keys, u, 'fingers', 'palm');
  return {
    w: Math.max(blowWeight(u), held), u, side,
    grip: mx(vecAt(keys, u, 'grip')),
    blade: nrm(mx(weapon?.[0] ?? null)), edge: nrm(mx(weapon?.[1] ?? null)),
    fingers: nrm(mx(fist?.[0] ?? null)), palm: nrm(mx(fist?.[1] ?? null)),
    chest: [chest[0] * m, chest[1] * m, chest[2]],
    hip: spline(keys, u, (key) => key.hip ?? 0) * m,
    shift: spline(keys, u, (key) => key.shift ?? 0),
    drop: spline(keys, u, (key) => key.drop ?? 0),
    step: spline(keys, u, (key) => key.step ?? 0),
    off: keys[0].off ? [0, 1, 2].map((i) => spline(keys, u, (key) => (key.off ?? [0, 0, 0])[i])) : null,
  };
}

/** The strength the blow lands with scales its wind (the chest's and the hips' turn, the shift and the step) between
 *  `lo` and 1 - a tap barely turns the body, a full swing throws it. */
export const STRENGTH_WIND = Object.freeze({ lo: 0.65 });
export const windFor = (strength) => lerp(STRENGTH_WIND.lo, 1, clamp01(strength ?? 1));
