// @ts-check
// BODY-MOTION (2026-10-18; bible/04-Characters/Body-Motion.md) - THE BODY, MEASURED. Everything the walking, carrying
// and striking laws know about a skeleton is read here, once per skeleton, off its REST pose - the joints' own places,
// never a bone axis: each leg's and each arm's length, the hips' and the shoulders' widths, how high the ankle stands
// over the sole, the bone that carries the thighs (retail's thighs hang from "Bip01 Spine", not the pelvis), the trunk's
// bones above it, and the frames the rest pose calls "facing forward". So the male skeleton, the female, the beast and
// a race scaled tall or short take the same request to the same place, as the climb (combat/climbRig.js) and the long
// gun (combat/gun/rifleStance.js) already do - and every distance a law asks for is a SHARE of the body's own leg or arm.
//
// RIG SPACE throughout (the space skeletonSpaceMatrices answers with GRAPH_ROOT): Morrowind units, Z up, the actor
// facing +Y, its right +X, the ground at z = 0 (the rig stands on its feet - fpArm.js drawThird places the rig root at
// them). Row-major 3x3 rotations, column vectors - the rig's own.

import { climbBones, rotFromTo, rotAxisAngle, rotationPart, restAxes } from '../../combat/climbRig.js';
import { mat33Mul } from '../../formats/morrowind/mwNifMesh.js';
import { wrapAngle } from '../../world/mat4.js';

// ---- the small algebra every law here shares ------------------------------------------------------------------------

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** Hermite's smoothstep: 0 at 0, 1 at 1, flat at both ends. */
export const smooth = (t) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
export const RAD = Math.PI / 180;
/** An angle wrapped into (-pi, pi] - world/mat4.js's, the one in the tree. */
export { wrapAngle };
/** The fractional part, always in [0, 1). */
export const frac = (x) => x - Math.floor(x);
/** Exponential ease of `v` toward `goal` with time constant `tau` over `dt` - frame-rate free. */
export const ease = (v, goal, tau, dt) => goal + (v - goal) * Math.exp(-Math.max(0, dt) / Math.max(1e-4, tau));
export const transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
export const apply = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
export const mul = (a, b) => mat33Mul(a, b);
/** The rotation whose columns are `x`, `y`, `z`. */
export const fromColumns = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
/** Rotations about the rig's own axes, by the right hand: `rotZ` turns +X toward +Y (a turn to the LEFT, seen from
 *  above), `rotY` turns +Z toward +X (the right side DOWN), `rotX` turns +Y toward +Z (the front UP). */
const rotX = (a) => rotAxisAngle([1, 0, 0], a);
const rotY = (a) => rotAxisAngle([0, 1, 0], a);
const rotZ = (a) => rotAxisAngle([0, 0, 1], a);
/** A body-frame turn: `yaw` about up (+ the left), `roll` about forward (+ the right side down), `pitch` about right
 *  (+ the front DOWN - a forward lean, a forward pelvic tilt), applied pitch first, then roll, then yaw. */
export const bodyTurn = (yaw, roll, pitch) => mul(rotZ(yaw), mul(rotY(roll), rotX(-pitch)));
/** A vector in the body frame ([right, forward, up] shares) as rig space under the turn `R` (identity: the rig's own). */
const inFrame = (R, v) => (R ? apply(R, v) : v);
/** Mirror a body-frame vector across the body's middle (right becomes left). */
export const mirrorX = (v) => [-v[0], v[1], v[2]];
/** Reflect `v` across the plane through the origin with unit normal `n`. */
export const reflect = (v, n) => sub(v, scale(n, 2 * dot(v, n)));
/** The vector algebra above, as ONE export. Its names are the plainest there are and other modules export their own
 *  under them (world/ships/galleonMesh.js's sub and cross, systems/weather/weatherFront.js's lerp, characters/animate.js's
 *  2D rotX), so the layer's are one name, unpacked by each module that uses them - one export, one home
 *  (test/systems/talk/audit24_onehome.test.js). */
export const algebra = Object.freeze({ sub, add, scale, dot, cross, len, norm, lerp, lerp3, inFrame });

// ---- the body, measured ---------------------------------------------------------------------------------------------

const _bodies = new WeakMap();
/** The rig's rotation (its uniform scale divided out) of `ref` in `mats`, or null. */
export const turnOf = (mats, ref) => { const m = ref == null ? null : mats.get(ref); return m ? rotationPart(m.a) : null; };
export const at = (mats, ref) => (ref == null ? null : mats.get(ref)?.t ?? null);

/** Is `anc` an ancestor of `ref` on this skeleton? */
function isAncestor(skeleton, anc, ref) {
  for (let r = skeleton.nodes.get(ref)?.parent; r != null && r >= 0 && skeleton.nodes.has(r); r = skeleton.nodes.get(r).parent) {
    if (r === anc) return true;
  }
  return false;
}

/**
 * THE BODY, read once per skeleton off its rest pose (`skelMats(skeleton, new Map(), rootRef)` - every bone at its
 * own rest). Null where the skeleton is not a biped with two legs, two arms and a trunk (a creature, a fixture arm):
 * the layer then leaves it as the clip has it.
 *
 *  - `bones`: combat/climbRig.js climbBones - each side's arm and leg chain, the spine, neck, head, pelvis and root.
 *  - `leg`, `arm`: the mean bone length of the two legs (hip to ankle) and the two arms (shoulder to wrist).
 *  - `hipWidth`, `shoulderWidth`: hip joint to hip joint, shoulder to shoulder.
 *  - `ankle`: the ankle's height over the sole at rest (the lower ankle of the two - the rest stands on it).
 *  - `hipBone`: the bone that carries both thighs (their common parent - retail's "Bip01 Spine"); `trunk`: the spine's
 *    bones above it, the chest last (they bend the trunk; the hip bone and the pelvis turn the hips).
 *  - `restRot`: each trunk bone's, the pelvis's, the hip bone's and the head's rotation at rest; `hipFix`, `chestFix`:
 *    the turn that squares the rest's hips and shoulders to the body's right (+X) - a rest stood a little turned is
 *    not a stance the layer copies - keeping their forward tilt, which is the body's own build.
 *  - `restHip`: the hips' middle (between the hip joints) at rest; `restChestUp`: the chest's up (spine top to neck).
 *  - `foot`: the sole's geometry as shares of the leg (the rest has no toe bone to read it from): the ball of the foot
 *    `ball` ahead of the ankle, the heel `heel` behind it.
 *  - `wb`, `wbL`: the Weapon Bone and its left mirror ("Weapon Bone Left", the pair's - combat/twoHands/mirrorRig.js),
 *    or null.
 */
export function bodyOf(skeleton, rootRef, skelMats) {
  if (!skeleton || !skeleton.byName) return null;
  const hit = _bodies.get(skeleton);
  if (hit !== undefined) return hit;
  const body = measure(skeleton, rootRef, skelMats);
  _bodies.set(skeleton, body);
  return body;
}

/** THE SOLE, as shares of the leg's length: the ball of the foot ahead of the ankle and the heel behind it (an adult's
 *  foot is about 0.26 of the leg's length long; the ankle stands over its back fifth). */
export const FOOT = Object.freeze({ ball: 0.14, heel: 0.055 });

function measure(skeleton, rootRef, skelMats) {
  const bones = climbBones(skeleton);
  if (!bones) return null;
  const { L, R } = bones;
  const need = [L.thigh, L.calf, L.foot, R.thigh, R.calf, R.foot, L.upper, L.fore, L.hand, R.upper, R.fore, R.hand];
  if (need.some((r) => r == null) || bones.spine.length === 0 || bones.root == null) return null;
  const rest = skelMats(skeleton, new Map(), rootRef);
  const p = (ref) => at(rest, ref);
  if (need.some((r) => !p(r))) return null;
  const legOf = (s) => len(sub(p(s.calf), p(s.thigh))) + len(sub(p(s.foot), p(s.calf)));
  const armOf = (s) => len(sub(p(s.fore), p(s.upper))) + len(sub(p(s.hand), p(s.fore)));
  const leg = (legOf(L) + legOf(R)) / 2, arm = (armOf(L) + armOf(R)) / 2;
  if (!(leg > 1e-3 && arm > 1e-3)) return null;
  // the bone both thighs hang from, and the trunk above it (the spine bones that are not its ancestors or it)
  const thighParentL = skeleton.nodes.get(L.thigh)?.parent, thighParentR = skeleton.nodes.get(R.thigh)?.parent;
  const hipBone = thighParentL === thighParentR && skeleton.nodes.has(thighParentL) ? thighParentL : (bones.pelvis ?? bones.spine[0]);
  const trunk = bones.spine.filter((r) => r !== hipBone && !isAncestor(skeleton, r, hipBone) && !isAncestor(skeleton, r, L.thigh));
  if (!trunk.length) return null;
  const chest = trunk[trunk.length - 1];
  const restRot = new Map();
  for (const r of [bones.pelvis, hipBone, ...trunk, bones.neck, bones.head]) if (r != null && rest.get(r)) restRot.set(r, rotationPart(rest.get(r).a));
  const hipRight = norm(sub(p(R.thigh), p(L.thigh)));
  const shoulderRight = norm(sub(p(R.upper), p(L.upper)));
  const flat = (v) => norm([v[0], v[1], 0]);
  const restHip = scale(add(p(L.thigh), p(R.thigh)), 0.5);
  const neckAt = p(bones.neck) ?? p(bones.head) ?? add(p(chest), [0, 0, leg * 0.15]);
  const footAxes = { L: restAxes(skeleton, L.foot), R: restAxes(skeleton, R.foot) };
  // the ankle at rest: the angle from the shin (ankle to knee) to the toes' way - the ankle's range is read off it (bodySolve.js)
  const ankleAt = (s, ax) => Math.acos(clamp(dot(norm(sub(p(s.calf), p(s.foot))), norm(apply(rotationPart(rest.get(s.foot).a), ax.fwd))), -1, 1));
  return Object.freeze({
    bones, leg, arm,
    legs: { L: legOf(L), R: legOf(R) },
    arms: { L: armOf(L), R: armOf(R) },
    hipWidth: len(sub(p(R.thigh), p(L.thigh))),
    shoulderWidth: len(sub(p(R.upper), p(L.upper))),
    ankle: Math.max(0, Math.min(p(L.foot)[2], p(R.foot)[2])),
    hipBone, trunk, chest,
    restRot,
    // only the turn about up and about forward is squared away: X onto +X by the least rotation leaves the tilt alone
    hipFix: rotFromTo(flat(hipRight)[0] > 0.5 ? hipRight : [1, 0, 0], [1, 0, 0]),
    chestFix: rotFromTo(flat(shoulderRight)[0] > 0.5 ? shoulderRight : [1, 0, 0], [1, 0, 0]),
    restHip,
    restChestUp: norm(sub(neckAt, p(chest))),
    footAxes,
    ankleRest: { L: footAxes.L ? ankleAt(L, footAxes.L) : Math.PI / 2, R: footAxes.R ? ankleAt(R, footAxes.R) : Math.PI / 2 },
    headAxes: bones.head != null ? restAxes(skeleton, bones.head) : null,
    wb: skeleton.byName.get('weapon bone') ?? null,
    wbL: skeleton.byName.get('weapon bone left') ?? null,
  });
}

/**
 * The SKELETON FAMILY a body is drawn on, read off the path it was built from (combat/fpArm.js tpSkeletonPath):
 * 'beast' for base_animkna (Khajiit and Argonian), 'female' for base_anim_female, 'male' for base_anim - the three gaits
 * BODY_STYLES carries. Anything else - a werewolf's body, a creature's own model - is no family the layer walks: null.
 */
export function bodyKindOf(path) {
  const s = String(path ?? '').toLowerCase();
  if (!s.includes('base_anim') || s.includes('wolf')) return null;
  if (s.includes('kna')) return 'beast';
  if (s.includes('female')) return 'female';
  return 'male';
}

