// TWO-HANDS (2026-10-16) - THE MORROWIND BODY'S SECOND HAND: an arm, or the whole body, posed as the mirror of another
// (bible/05-Combat/Two-Hands.md, the Morrowind lane). Morrowind has one weapon hand: its one-handed groups swing the right
// arm and let the left hang out of the view, its hand-to-hand groups throw each punch with the hand the clip was made
// for, and there is no clip for a left-hand blow or a second weapon at all. The sprite lane draws its left hand as the
// right in the mirror (combat/twoHands/twoHands.js); this is the same idea on a skeleton - THE LEFT ARM IS THE RIGHT ARM IN THE
// MIRROR - after the clip has posed it, before any piece is placed on it (formats/morrowind/mwFirstPerson.js poseAssembly, ahead
// of the climb's IK).
//
// It holds NO number about any skeleton (combat/climbRig.js's rule, CLIMB6): every bone's counterpart is found by its
// NAME (Bip01's "L"/"R", the attach family's "Left"/"Right", Morrowind's "Weapon Bone" and "Weapon Bone Left"), the
// mirror's plane is the skeleton's own middle (halfway between its two upper arms at rest), and a bone's mirror is
// taken against the REST pose of both bones - so the rule holds whatever way a skeleton's left bones' own axes run.
//
// THE LAW, IN EACH BONE'S OWN FRAME (TWO-HANDS AUDIT). A bone moves as its counterpart moves, in the mirror, FROM ITS
// OWN REST: its counterpart's motion from rest in its parent's frame (its local delta, RestL(m)^-1 . L(m)) is carried
// into this bone's axes by the mirror and laid on this bone's own rest local -
//
//     L'(b) = RestL(b) . K^(b)^-1 . [ RestL(m)^-1 . L(m) ] . K^(b),     K^(b) = the 3x3 of Rest(m)^-1 . S . Rest(b)
//
// where L is a bone's local (its transform against its parent), RestL its rest local, Rest its rest in the graph's
// space, m = m(b) its counterpart (itself for a bone on the middle) and S the reflection through the middle plane; K^
// is a constant of the skeleton, read once. At rest it is the rest; mirrored twice it is the pose; every bone's
// rotation in the graph's space is the mirror law's own, M'(b) = S . M(m) . Rest(m)^-1 . S . Rest(b) - so a skinned
// vertex of the left arm turns as the right arm's mirrored vertex does, and a part on "Weapon Bone Left" (which rule 13
// draws mirrored - attach.cpp's "Left" test, the bow's own law) turns as the mirror of the right hand's weapon. Where
// the rest pose is its own mirror (the fixture arm) it IS that law, translations and all. Where it is not, the
// difference is the point: the graph law hung each bone at the mirror of its counterpart's frame, so a turned
// counterpart swung the bone's JOINT off its parent by the rest's own asymmetry - on the retail biped, whose rest
// stands its legs 6.7 units off their mirror, a bent knee's mirror slid the other knee off its thigh, a turned upper arm
// slid the shoulder 0.52 units off the clavicle and a finger joint 10% off its bone. Here every joint stays where its
// parent carries it. A bone with no counterpart (the Shield Bone on the left forearm) keeps its local and rides its
// mirrored parent. Two more things follow, and both are the point:
//   - AN ARM SET FROM ANOTHER POSE HANGS FROM THIS FRAME'S BODY. Its bones' locals are the other pose's (copied, or
//     mirrored as above), so its shoulder stays where this frame's chest carries it - the source torso's twist never
//     moves it. (The first draft set an arm absolutely in the graph's space: on the retail biped, a 25-degree spine twist
//     left the shoulder 9.07 units off the chest. It is cur(P) . srcP^-1 . srcT(b), re-rooted on the parent P.)
//   - THE MIRROR READS NO MATRIX OF THE FRAME. A whole skeleton's transforms were composed for every frame (the clip's,
//     each pose's, every bone placed and every other bone ridden); the frame now reads only the locals it mirrors - and,
//     mirrored across the picture (`plane`, below), the chains to the eye and to each arm's parent alone (chainWorld).
//
// THE REQUEST (all optional):
//   full  - the whole pose mirrored: the torso turns the other way and each arm takes the other's;
//   limbs - { L, R }: an arm set, after `full`, from a pose: `{ pose, side, mirror }` - `pose` a poseSkeleton map (null:
//           the clip's own, as it stood before any change here; a map of the arm alone serves - limbSkeleton), `side`
//           the arm of it to read, `mirror` whether that arm is mirrored onto this side or copied as it stands. Either
//           way the arm hangs from this frame's parent;
//   plane - { ref, dx }: a mirrored arm is the mirror across the PICTURE's middle - the upright plane through the eye
//           (node `ref` as the clip poses it, `dx` across) - placed in the graph's space rather than hung from the chest
//           (pictureMirrorArm; the first-person arms, whose clips do not pose the body about the eye);
//   dip   - { L, R }: radians each arm is turned DOWN at its shoulder, over the composition (the guard: the arm not
//           striking lowered while the other strikes - TWO-HANDS AUDIT, Mac: "the other weapon in hand should lower
//           slightly"). The upper arm turns about its own joint in the upright plane through shoulder and wrist, so the
//           arm stays on its shoulder and every bone keeps its length; the caller eases the angle (handsLaw.js guardStep).
//           It is laid INTO the composition (TWO-HANDS AUDIT 2), so the carry starts from the arm as it was drawn, dip and
//           all: a request that stops asking for it under a new key (the hands taken by a sheet, the stone, a spell)
//           carries it off the arm as it carries every bone, never dropping it in a frame;
//   spread - radians both arms are turned OUTWARD (TWO-HANDS SPREAD, the first-person pair - Mac: "spread out the arms a
//           bit more sense it can make the weapons overlap"): each arm at its top (its clavicle, else its upper arm)
//           about the upright line through that top's own joint, each its own way out (the plan's `outward`), so a left
//           arm that was the right's mirror stays its mirror and no joint leaves its parent. Laid into the composition
//           after the dip; the caller eases the angle and says how far (fpArm.js);
//   carry - the no-pop: `{ key, dt, tau, state }` - a change of `key` (the composition) carries every bone from where it
//           was drawn last frame onto its new place over `tau` (ClimbPose's LIMB_TAU law); `state` is the caller's
//           object the carry lives in between frames, one per rig. A state that has drawn nothing (new, or reset - the
//           rig was not drawn: a view just entered, a rebuild) takes its first composition at once: there is nothing
//           on the screen to carry from.
// Answers the refs it wrote, or null when nothing was asked.
//
// THE SECOND WEAPON'S BONE (offWeaponBoneAddon): Morrowind's retail skeletons carry no "Weapon Bone Left" - in OpenMW it
// is an optional node under the left hand that only a modded skeleton has (the bow's attach bone, which falls back to
// "Weapon Bone" without it). A skeleton without one is given one made BY THIS MIRROR from its own Weapon Bone - hand to
// hand, in the frame the hands' skin is bound in - so the left hand's weapon is the right's in the glass, its grip in
// the left fist as the right's is in the right, on every skeleton.

import { mat33Mul } from '../../formats/morrowind/mwNifMesh.js';
import { HELD_BONE_ALIASES } from '../heldPose.js';
import { rotAxisAngle } from '../climbRig.js';

// ---- the algebra: affines { a: row-major 3x3 (rotation x uniform scale), t: [3] }, column vectors ------------------

const apply = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mul = (A, B) => { const t = apply(A.a, B.t); return { a: mat33Mul(A.a, B.a), t: [t[0] + A.t[0], t[1] + A.t[1], t[2] + A.t[2]] }; };
const scaleOf = (a) => Math.hypot(a[0], a[3], a[6]) || 1;
/** The inverse of an affine whose 3x3 is a rotation times a uniform scale (every node's) - or a reflection times one. */
function inv(A) {
  const s2 = scaleOf(A.a) ** 2;
  const a = A.a;
  const ia = Float32Array.from([a[0] / s2, a[3] / s2, a[6] / s2, a[1] / s2, a[4] / s2, a[7] / s2, a[2] / s2, a[5] / s2, a[8] / s2]);
  const t = apply(ia, A.t);
  return { a: ia, t: [-t[0], -t[1], -t[2]] };
}
const transposed = (m) => Float32Array.from([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
/** A rotation matrix as a unit quaternion [x, y, z, w]. */
function quatOf(r) {
  const tr = r[0] + r[4] + r[8];
  let x, y, z, w;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (r[7] - r[5]) / s; y = (r[2] - r[6]) / s; z = (r[3] - r[1]) / s; }
  else if (r[0] > r[4] && r[0] > r[8]) { const s = Math.sqrt(1 + r[0] - r[4] - r[8]) * 2; w = (r[7] - r[5]) / s; x = s / 4; y = (r[1] + r[3]) / s; z = (r[2] + r[6]) / s; }
  else if (r[4] > r[8]) { const s = Math.sqrt(1 + r[4] - r[0] - r[8]) * 2; w = (r[2] - r[6]) / s; x = (r[1] + r[3]) / s; y = s / 4; z = (r[5] + r[7]) / s; }
  else { const s = Math.sqrt(1 + r[8] - r[0] - r[4]) * 2; w = (r[3] - r[1]) / s; x = (r[2] + r[6]) / s; y = (r[5] + r[7]) / s; z = s / 4; }
  const n = Math.hypot(x, y, z, w) || 1;
  return [x / n, y / n, z / n, w / n];
}
/** A unit quaternion's rotation matrix, into `out`. */
function matInto(out, [x, y, z, w]) {
  out[0] = 1 - 2 * (y * y + z * z); out[1] = 2 * (x * y - z * w); out[2] = 2 * (x * z + y * w);
  out[3] = 2 * (x * y + z * w); out[4] = 1 - 2 * (x * x + z * z); out[5] = 2 * (y * z - x * w);
  out[6] = 2 * (x * z - y * w); out[7] = 2 * (y * z + x * w); out[8] = 1 - 2 * (x * x + y * y);
  return out;
}
/** The rotation a share `k` of the way from identity to `q` (the short way), into `out`. */
function quatPowInto(out, q, k) {
  let [x, y, z, w] = q;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const ang = 2 * Math.acos(Math.min(1, w));
  const s = Math.sin(ang / 2);
  if (s < 1e-9) { out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1; return out; }
  const h = (ang * k) / 2, sh = Math.sin(h) / s;
  out[0] = x * sh; out[1] = y * sh; out[2] = z * sh; out[3] = Math.cos(h);
  return out;
}

// The frame's scratch (TWO-HANDS AUDIT: the mirror allocates its answer and nothing else). The module never re-enters
// itself, so one set serves every rig.
const scratchAffine = () => ({ a: new Float64Array(9), t: new Float64Array(3) });
const T0 = scratchAffine(), T1 = scratchAffine(), T2 = scratchAffine();
const Q = [0, 0, 0, 1], QM = new Float64Array(9);
/** out = A . B (affines; `out` aliases neither). */
function mulInto(out, A, B) {
  const a = A.a, b = B.a, o = out.a;
  for (let r = 0; r < 3; r++) {
    const a0 = a[r * 3], a1 = a[r * 3 + 1], a2 = a[r * 3 + 2];
    o[r * 3] = a0 * b[0] + a1 * b[3] + a2 * b[6];
    o[r * 3 + 1] = a0 * b[1] + a1 * b[4] + a2 * b[7];
    o[r * 3 + 2] = a0 * b[2] + a1 * b[5] + a2 * b[8];
    out.t[r] = a0 * B.t[0] + a1 * B.t[1] + a2 * B.t[2] + A.t[r];
  }
  return out;
}
/** A pose entry (`{ rotation, translation, scale }`, a bone's local) as an affine, into `out`. */
function affineInto(out, e) {
  const s = e.scale ?? 1;
  for (let i = 0; i < 9; i++) out.a[i] = e.rotation[i] * s;
  out.t[0] = e.translation[0]; out.t[1] = e.translation[1]; out.t[2] = e.translation[2];
  return out;
}
/** An affine as a fresh pose entry - the one thing the frame allocates per bone it writes. */
function entryOf(m) {
  const s = scaleOf(m.a);
  const rotation = new Float32Array(9);
  for (let i = 0; i < 9; i++) rotation[i] = m.a[i] / s;
  return { rotation, translation: [m.t[0], m.t[1], m.t[2]], scale: s };
}

// ---- the skeleton's mirror, read off it once ---------------------------------------------------------------------

/** A bone name's counterpart across the middle: Bip01's " l "/" r " (and a trailing one), the attach family's
 *  left/right, Morrowind's Weapon Bone and Weapon Bone Left. The name itself for a bone on the middle. Lower case. */
export function counterpartName(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'weapon bone') return 'weapon bone left';
  if (n === 'weapon bone left') return 'weapon bone';
  const swap = (s, a, b) => s.replace(new RegExp(`\\b${a}\\b`, 'g'), '\u0000').replace(new RegExp(`\\b${b}\\b`, 'g'), a).replace(/\u0000/g, b);
  return swap(swap(n, 'l', 'r'), 'left', 'right');
}

const ATTACH_OF = Object.fromEntries(Object.entries(HELD_BONE_ALIASES).map(([attach, bip]) => [bip, attach]));
const CLAVICLE = { L: ['bip01 l clavicle', ATTACH_OF['bip01 l clavicle']], R: ['bip01 r clavicle', ATTACH_OF['bip01 r clavicle']] };
const UPPER = { L: ['bip01 l upperarm', ATTACH_OF['bip01 l upperarm']], R: ['bip01 r upperarm', ATTACH_OF['bip01 r upperarm']] };
const HAND = { L: ['bip01 l hand', ATTACH_OF['bip01 l hand']], R: ['bip01 r hand', ATTACH_OF['bip01 r hand']] };

/** The plan, read off the skeleton as it stands (mirrorPlan memoises it, per skeleton and space). */
function buildPlan(skeleton, root, skelMats) {
  if (!skeleton?.nodes || !skeleton.byName) return null;
  const find = (names) => { for (const n of names) { if (!n) continue; const r = skeleton.byName.get(n); if (r !== undefined) return r; } return null; };
  const rest = skelMats(skeleton, new Map(), root);
  const upL = find(UPPER.L), upR = find(UPPER.R);
  if (upL == null || upR == null || !rest.get(upL) || !rest.get(upR)) return null;
  const x0 = (rest.get(upL).t[0] + rest.get(upR).t[0]) / 2;
  const children = new Map();
  for (const [ref, node] of skeleton.nodes) {
    if (!children.has(node.parent)) children.set(node.parent, []);
    children.get(node.parent).push(ref);
  }
  // parent first: a walk down from every node whose parent is not a bone
  const order = [];
  const walk = (ref) => { order.push(ref); for (const k of children.get(ref) ?? []) walk(k); };
  for (const [ref, node] of skeleton.nodes) if (!skeleton.nodes.has(node.parent)) walk(ref);
  const counterpart = new Map();
  for (const [ref, node] of skeleton.nodes) {
    const c = skeleton.byName.get(counterpartName(node.name));
    counterpart.set(ref, c !== undefined ? c : null);
  }
  const restOf = new Map(), restInv = new Map();
  for (const ref of order) { const m = rest.get(ref); if (m) { restOf.set(ref, m); restInv.set(ref, inv(m)); } }
  const arm = (s) => {
    const top = find(CLAVICLE[s]) ?? find(UPPER[s]);
    const set = [];
    const take = (ref) => { set.push(ref); for (const k of children.get(ref) ?? []) take(k); };
    if (top != null) take(top);
    return set;   // parent first, as `take` walks
  };
  const arms = { L: arm('L'), R: arm('R') };
  // a bone IN an arm whose name has no side (the left forearm's Shield Bone, the right hand's Weapon Bone on a rig with
  // no Weapon Bone Left) is no bone of the middle: it has no counterpart, and rides its arm
  for (const s of ['L', 'R']) for (const ref of arms[s]) if (counterpart.get(ref) === ref) counterpart.set(ref, null);
  const S = { a: Float32Array.from([-1, 0, 0, 0, 1, 0, 0, 0, 1]), t: [2 * x0, 0, 0] };
  // TWO-HANDS SPREAD: which way across is each arm's OUT - the side its upper arm stands on at rest, read, not assumed
  const outR = Math.sign(rest.get(upR).t[0] - rest.get(upL).t[0]) || 1;
  // THE MIRROR IN EACH BONE'S FRAME (the header's law): L'(b) = A(b) . L(m) . B(b), two constants a bone -
  // B(b) = K^(b), the 3x3 of K(b) = Rest(m)^-1 . S . Rest(b), and A(b) = RestL(b) . K^(b)^-1 . RestL(m)^-1
  const restLocal = (ref) => { const r = skeleton.nodes.get(ref).rest; return { a: Float32Array.from(r.rotation, (v) => v * (r.scale ?? 1)), t: [r.translation[0], r.translation[1], r.translation[2]] }; };
  const linear = (m) => ({ a: m.a, t: [0, 0, 0] });
  const link = new Map();
  for (const ref of order) {
    const m = counterpart.get(ref);
    if (m == null || !restOf.has(ref) || !restOf.has(m)) continue;
    const Kb = linear(mul(mul(restInv.get(m), S), restOf.get(ref)));
    link.set(ref, { m, A: mul(mul(restLocal(ref), inv(Kb)), inv(restLocal(m))), B: Kb });
  }
  const armSkeleton = (s) => ({ nodes: new Map(arms[s].map((ref) => [ref, skeleton.nodes.get(ref)])), byName: skeleton.byName });
  return {
    x0, order, counterpart, restOf, restInv, children, link,
    S,
    arms,
    armSkeletons: { L: armSkeleton('L'), R: armSkeleton('R') },
    hands: { L: find(HAND.L), R: find(HAND.R) },
    uppers: { L: upL, R: upR },
    outward: { L: -outR, R: outR },   // TWO-HANDS SPREAD: each arm's way out across the graph's x
    targets: new Map(),   // the frame's scratch: the composition's locals before they are written
    pictureK: new WeakMap(),   // each bone's K(b) across the picture, per bind sources (pictureMirrorArm) - read the first time an arm is mirrored
  };
}

const _plans = new WeakMap();
/**
 * The mirror's plan for a skeleton in the graph space `root` (memoised per skeleton and space): every bone's counterpart
 * ref, its rest transform and its inverse, the middle plane's x, the bones in parent-first order, each arm's bones (its
 * clavicle - else its upper arm - and everything under it), each arm's way out across (`outward`, TWO-HANDS SPREAD), and
 * each paired bone's mirror in its own frame (`link`).
 * Null for a skeleton with no pair of arms.
 */
export function mirrorPlan(skeleton, root, skelMats) {
  if (!skeleton?.nodes || !skeleton.byName) return null;
  let per = _plans.get(skeleton);
  if (!per) { per = new Map(); _plans.set(skeleton, per); }
  if (per.has(root)) return per.get(root);
  const plan = buildPlan(skeleton, root, skelMats);
  per.set(root, plan);
  return plan;
}

/**
 * The bones of `skeleton` a limb request `l` for arm `side` reads from its pose - the arm it copies (its own) or the arm
 * it mirrors (the other) - as a skeleton of their own (`{ nodes, byName }`), so a pose of another clip is sampled for
 * them alone (mwSkin.js poseSkeleton walks `nodes`). The whole skeleton where it has no pair of arms.
 */
export function limbSkeleton(skeleton, root, skelMats, side, l) {
  const plan = mirrorPlan(skeleton, root, skelMats);
  if (!plan || !l) return skeleton;
  const from = l.side === 'L' || l.side === 'R' ? l.side : side;
  return plan.armSkeletons[l.mirror && from !== side ? from : side];
}

/** Bone `link`'s mirrored local, given its counterpart's local `e` (a pose entry): A . L(m) . B (the header's law,
 *  RestL(b) . K^-1 . RestL(m)^-1 . L(m) . K^), a fresh entry. */
function mirrorLocal(link, e) {
  affineInto(T0, e);
  mulInto(T1, T0, link.B);
  return entryOf(mulInto(T2, link.A, T1));
}
const sameLocal = (p, q) => {
  if (p === q) return true;
  if (Math.abs((p.scale ?? 1) - (q.scale ?? 1)) > 1e-6) return false;
  for (let i = 0; i < 3; i++) if (Math.abs(p.translation[i] - q.translation[i]) > 1e-6) return false;
  for (let i = 0; i < 9; i++) if (Math.abs(p.rotation[i] - q.rotation[i]) > 1e-6) return false;
  return true;
};
/** A local carried a share `k` of its offset `off` back toward where it was drawn: its rotation turned by k of the
 *  offset's turn, its joint moved by k of the offset's move, its scale by k of the ratio - all in its parent's frame,
 *  so it rides wherever its (carried) parent is drawn. A fresh entry. */
function carried(off, base, k) {
  matInto(QM, quatPowInto(Q, off.q, k));
  const r = base.rotation, rotation = new Float32Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) rotation[i * 3 + j] = QM[i * 3] * r[j] + QM[i * 3 + 1] * r[3 + j] + QM[i * 3 + 2] * r[6 + j];
  const t = base.translation;
  return { rotation, translation: [t[0] + off.d[0] * k, t[1] + off.d[1] * k, t[2] + off.d[2] * k], scale: (base.scale ?? 1) * off.ds ** k };
}

/**
 * THE MIRROR ON THE SKELETON, written into `pose` (a poseSkeleton map) after the clip's - see the header for the
 * request. `skelMats` is the assembly's (mwSkin skeletonSpaceMatrices) - the plan's rests are read with it once - and
 * `root` its space (GRAPH_ROOT).
 * @returns {number[] | null} the refs written
 */
export function applyMirrorRig(skeleton, pose, root, skelMats, req) {
  const c = req?.carry ?? null;
  const st = c?.state ?? null;
  const composing = !!(req && (req.full || req.limbs?.L || req.limbs?.R));
  const dipping = !!(req?.dip && (req.dip.L > 0 || req.dip.R > 0));
  const spreading = !!(req?.spread > 0);   // TWO-HANDS SPREAD
  // a carry that has drawn nothing yet takes its first composition as it stands: there is no drawn pose to carry from
  if (st && st.key === undefined) { st.key = c.key; st.from = null; st.k = 0; st.last = null; }
  // a change of key with nothing of the mirror's on the arms (the clip's own pose stood last frame, no carry under way)
  // and nothing asked now: the clip's pose stands, and there is nothing to carry - no plan read, no bone walked
  if (st && st.key !== c.key && !st.last && !st.from && !composing && !dipping && !spreading) { st.key = c.key; return null; }
  const carrying = !!st && (!!st.from || st.key !== c.key);
  // nothing composed, no composition changing and none still carrying, no arm lowered or spread: the clip's pose stands
  if (!req || (!composing && !carrying && !dipping && !spreading)) { if (st) st.last = null; return null; }
  const plan = mirrorPlan(skeleton, root, skelMats);
  if (!plan) { if (st) { st.key = c.key; st.from = null; st.last = null; } return null; }
  // the clip's own pose: nothing is written into `pose` before step 4, so every read below sees the clip
  const clip = pose;
  const clipL = (ref) => clip.get(ref) ?? skeleton.nodes.get(ref).rest;
  const targets = plan.targets;
  targets.clear();
  // 1. the whole body in the mirror (a bone with no counterpart keeps its local and rides its mirrored parent)
  if (req.full) for (const ref of plan.order) { const k = plan.link.get(ref); if (k) targets.set(ref, mirrorLocal(k, clipL(k.m))); }
  // 2. an arm set from a pose: its own side's arm copied, or the other side's mirrored onto it - each bone's local read
  // off that pose, so the arm hangs from this frame's parent wherever this frame's torso stands; under `plane` a mirrored
  // arm is the mirror ACROSS THE PICTURE instead (pictureMirrorArm)
  let world = null;
  for (const side of /** @type {const} */ (['L', 'R'])) {
    const l = req.limbs?.[side];
    if (!l) continue;
    const src = l.pose ?? clip;
    const srcL = (ref) => src.get(ref) ?? skeleton.nodes.get(ref).rest;
    const from = l.side === 'L' || l.side === 'R' ? l.side : side;
    if (l.mirror && from !== side && req.plane) {
      world ??= chainWorld(skeleton, root, clipL);
      if (pictureMirrorArm(skeleton, plan, world, req.plane, side, from, srcL, clipL, targets)) continue;
    }
    for (const ref of plan.arms[side]) {
      if (l.mirror && from !== side) { const k = plan.link.get(ref); if (k) targets.set(ref, mirrorLocal(k, srcL(k.m))); else targets.delete(ref); }
      else targets.set(ref, srcL(ref));
    }
  }
  // 2b. the guard: an arm lowered at its shoulder, over the composition - laid into its locals, so the carry below starts
  // from what was drawn, the dip with it (the weight itself eases on its own: the caller's guardStep)
  if (dipping) {
    const cur = (ref) => targets.get(ref) ?? clipL(ref);
    for (const side of /** @type {const} */ (['L', 'R'])) { const e = dipArm(skeleton, cur, plan, side, req.dip[side]); if (e) targets.set(plan.uppers[side], e); }
  }
  // 2c. TWO-HANDS SPREAD: both arms turned out, each at its top about the upright line through its own joint, over the
  // composition and its dip - so the carry starts from what was drawn, the spread with it
  if (spreading) {
    const cur = (ref) => targets.get(ref) ?? clipL(ref);
    for (const side of /** @type {const} */ (['L', 'R'])) {
      const top = plan.arms[side][0];
      if (top == null) continue;
      const e = cur(top);
      targets.set(top, { rotation: mat33Mul(rotAxisAngle(uprightOver(skeleton, cur, top), -plan.outward[side] * req.spread), e.rotation), translation: e.translation, scale: e.scale });
    }
  }
  // 3. the carry, IN EACH BONE'S OWN FRAME: a new composition starts every bone from the local it was drawn with last
  // frame (the last composed frame's, or - nothing composed - the clip's own: this frame's, the frame before stood one
  // step back), its offset to its new local - the turn prev . now^-1, the joint's move, the scale's ratio - eased away.
  // Children ride their carried parents, so no joint leaves its bone and a bone no composition writes (the Shield Bone)
  // never leaves its hand.
  if (st) {
    if (st.key !== c.key) {
      const prevOf = st.last ?? clip;
      st.key = c.key;
      st.from = new Map();
      for (const ref of plan.order) {
        const prev = prevOf.get(ref) ?? clipL(ref), now = targets.get(ref) ?? clipL(ref);
        if (sameLocal(prev, now)) continue;
        st.from.set(ref, {
          q: quatOf(mat33Mul(prev.rotation, transposed(now.rotation))),
          d: [prev.translation[0] - now.translation[0], prev.translation[1] - now.translation[1], prev.translation[2] - now.translation[2]],
          ds: (prev.scale ?? 1) / (now.scale ?? 1),
        });
      }
      st.k = st.from.size ? 1 : 0;
    } else if (st.k > 0) st.k *= Math.exp(-Math.max(0, c.dt || 0) / Math.max(1e-4, c.tau || 0.06));
    if (st.k < 1e-3) { st.k = 0; st.from = null; }
  }
  // 4. written: the composition's locals, each carried by its offset while the carry stands
  const k = st?.from ? st.k : 0;
  const keep = !!st && (composing || !!st.from || dipping || spreading);
  const last = keep ? (st.drawn ??= new Map()) : null;
  if (last) last.clear();
  const wrote = [];
  for (const ref of plan.order) {
    let out = targets.get(ref);
    const off = k > 0 ? st.from.get(ref) : null;
    if (off) out = carried(off, out ?? clipL(ref), k);
    // every bone's drawn local is kept, written or the clip's: a bone the clip moves under a change of composition (the
    // striking arm as its blow begins) is carried from where it was drawn as the bones the composition writes are - the
    // two hands' blows ease in alike
    if (last) last.set(ref, out ?? clipL(ref));
    if (!out) continue;
    pose.set(ref, out);
    wrote.push(ref);
  }
  targets.clear();
  // what was drawn, for the next change to start from - kept only while a composition, its carry, a guard or a spread stands
  if (st) st.last = last;
  return wrote.length ? wrote : null;
}

/**
 * THE ARM MIRRORED ACROSS THE PICTURE (`plane`, the first-person arms - Mac, of the pair in first person: "No left
 * arm"). The law in each bone's frame hangs the mirrored arm from this frame's chest, so it lands where the right one
 * stands only when the chest stands on the eye's own middle. Morrowind's first-person clips pose the body to put the
 * weapon hand in view, not about the eye, and the pair's left arm hung from that body was out of the picture whole while
 * the right stood in it. With a plane, a mirrored arm is placed in the graph's space as the mirror of the other through
 * the upright plane through the eye (`plane.ref`, the camera node as this frame's clip poses it, moved `plane.dx`
 * across - the lens's own centre: fpArm's eye looks down the rig's +Y, so its picture's middle is that x):
 *
 *     W'(b) = P . W(m) . K(b),     K(b) = Rest(m)^-1 . S . Rest(b),     P = the reflection through x = the eye's x
 *
 * each bone's local re-rooted on its parent as drawn (the arm's own above it, the chest's for its top). At rest with the
 * eye on the middle it is the rest; whatever the body does, the left hand stands in the picture exactly where the right
 * would stand in the glass - the sprite lane's own law (combat/twoHands/twoHands.js). The arm's top stands where the picture puts
 * it, off the chest by as far as the body stands off the eye: in first person no chest is drawn (the "An arm set from
 * another pose" rule above is the body's, kept for the third-person rig and every arm COPIED). A bone with no
 * counterpart in the other arm (the Shield Bone) keeps its local and rides its parent. False (nothing written) where the
 * eye is not on the skeleton.
 */
function pictureMirrorArm(skeleton, plan, world, plane, side, from, srcL, clipL, targets) {
  if (!skeleton.nodes.has(plane.ref)) return false;
  const eye = world.get(plane.ref).t;
  const P = { a: S3, t: [2 * (eye[0] + (plane.dx || 0)), 0, 0] };
  const ks = pictureKs(plan, plane.binds);
  const src = new Map(), drawn = new Map();
  const parentWorld = (ref, own) => { const p = skeleton.nodes.get(ref).parent; return own.get(p) ?? world.get(p); };
  for (const ref of plan.arms[from]) src.set(ref, mul(parentWorld(ref, src), affineOf(srcL(ref))));
  for (const ref of plan.arms[side]) {
    const m = plan.counterpart.get(ref);
    const Wm = m != null ? src.get(m) : null;
    const up = parentWorld(ref, drawn);
    if (!Wm || !plan.restOf.has(ref)) { drawn.set(ref, mul(up, affineOf(clipL(ref)))); targets.delete(ref); continue; }
    const W = mul(mul(P, Wm), pictureK(skeleton, plan, plane.binds, ks, ref, m));
    drawn.set(ref, W);
    targets.set(ref, entryOf(mul(inv(up), W)));
  }
  return true;
}

// ---- MIRROR-BIND: the picture's mirror read off the bind ---------------------------------------------------------
//
// TWO-HANDS MIRROR-BIND (2026-10-17, Mac: "adjust the positioning of the morrowind left hand duel wield model on first
// person, so its properly mirrored. Third person looks good"). The picture law's K(b) was the REST's, Rest(m)^-1 . S .
// Rest(b), translation and all - so a mirrored arm moved as its counterpart moved FROM ITS OWN REST, and stood where the
// right arm stands in the glass only where the rest is its own mirror. Third person's rest nearly is (xbase_anim: hands
// 1.09 units off each other's mirror); the first person's is a clip's first frame, posed for the weapon hand (retail's
// xbase_anim.1st.nif - no session has had it - and the MW-STEEL4 stand-in, its arms turned 70, 85 and -50 degrees off
// each other's mirror), and there the left hand stood 38 units off the right's mirror and its blade 65 (measured on the
// stand-in). What a mirrored arm must be on the screen is the right arm's MESH in the glass: a vertex skinned to a left
// bone, M'(b) . Bind(b)^-1 . v, must land where its mirror skinned to the right lands, P . M(m) . Bind(m)^-1 . S . v -
//
//     K(b) = Bind(m)^-1 . S . Bind(b)
//
// the bind's, which a skin bound symmetric (retail's Tri Shadow, a pair of gauntlets, the hands' mesh) makes a pure
// turn of the bone's own axes: no translation, so every joint stands EXACTLY at the mirror of its counterpart's. A node
// no skin binds whose name rule 13 mirrors (formats/morrowind/mwFirstPerson.js: a part on a node whose name holds "Left"
// is drawn with its x negated - Weapon Bone Left, the attach family's Left Hand and Left Wrist) is X: P . M(m) . X
// places the right part's mesh, drawn negated, exactly where the right one stands in the glass - the left blade in the
// left fist as the right is in the right, whatever the made bone's F was read from. A bone with no bind on either side
// and no such name keeps the rest's K as it stood: the fixture arm, whose rest IS its own mirror, is exactly the old law.

/**
 * MIRROR-BIND: each skin's binds - `{ a, t }` in the skin's own frame (an inverse bind undone), by skeleton ref - for the
 * picture's mirror: the skeleton file's own skinned shapes (`nif`; retail's Tri Shadow - its records' refs are the
 * skeleton's), then each skinned piece of an assembly (`pieces`, bound by name: their bones' refs are the skeleton's).
 * A skin whose data or shape is turned binds in another frame (its x not across the body) and is not read - the
 * hands' mirror's own rule (skinHandMirror). One Map a skin, file first.
 */
export function mirrorBindSources({ nif = null, pieces = null } = {}) {
  const out = [];
  const bindOf = (a, t) => inv({ a, t: [t[0], t[1], t[2]] });
  for (const shape of nif?.records ?? []) {
    const skin = Number.isInteger(shape?.skin) && shape.skin >= 0 ? nif.records[shape.skin] : null;
    const data = skin && Number.isInteger(skin.data) ? nif.records[skin.data] : null;
    if (!skin?.bones || !data?.bones || !unturned(data.transform) || !unturned(shape)) continue;
    const m = new Map();
    skin.bones.forEach((ref, i) => {
      const t = data.bones[i]?.transform;
      if (t && Number.isInteger(ref)) m.set(ref, bindOf(Float32Array.from(t.rotation, (v) => v * (t.scale ?? 1)), t.translation));
    });
    if (m.size) out.push(m);
  }
  for (const p of pieces ?? []) {
    const skin = p?.kind === 'skinned' ? p.batch?.skin : null;
    if (!skin?.bones || !unturned(skin.transform) || !unturned(skin.shapeTransform)) continue;
    const m = new Map();
    for (const b of skin.bones) if (b.ref != null && b.invBind) m.set(b.ref, bindOf(b.invBind.a, b.invBind.t));
    if (m.size) out.push(m);
  }
  return out;
}

const NO_BINDS = Object.freeze([]);
/** The picture's K for each bone, per bind sources (the rest's alone under none). */
function pictureKs(plan, binds) {
  const key = binds ?? NO_BINDS;
  let ks = plan.pictureK.get(key);
  if (!ks) { ks = new Map(); plan.pictureK.set(key, ks); }
  return ks;
}
/** The 3x3 of an affine with its uniform scale divided out. */
const turnOf = (m) => { const s = scaleOf(m.a); return Float32Array.from(m.a, (v) => v / s); };
/** Two binds a mirrored pair: each joint's y and z the other's, to a hundredth of the span between them. */
const mirroredBinds = (b, c) => {
  const span = Math.max(1, Math.hypot(b.t[0] - c.t[0], b.t[1] - c.t[1], b.t[2] - c.t[2]));
  return Math.abs(b.t[1] - c.t[1]) <= span * 0.01 && Math.abs(b.t[2] - c.t[2]) <= span * 0.01;
};
/**
 * MIRROR-BIND: bone `ref`'s K across the picture, its counterpart `m`, memoised in `ks`: a pair bound mirrored
 * (mirroredBinds) is the bind's turn - one skin binding both first (retail's Tri Shadow, the hands' mesh), else each
 * side's first (a left and a right piece, bound in one frame); an unbound node rule 13 mirrors is X; else the rest's.
 */
function pictureK(skeleton, plan, binds, ks, ref, m) {
  let K = ks.get(ref);
  if (K) return K;
  const srcs = binds ?? NO_BINDS;
  let pair = srcs.map((s) => [s.get(ref), s.get(m)]).find(([b, c]) => b && c && mirroredBinds(b, c));
  if (!pair) {
    const b = srcs.find((s) => s.has(ref))?.get(ref), c = srcs.find((s) => s.has(m))?.get(m);
    if (b && c && mirroredBinds(b, c)) pair = [b, c];
  }
  if (pair) K = { a: mat33Mul(transposed(turnOf(pair[1])), mat33Mul(S3, turnOf(pair[0]))), t: [0, 0, 0] };
  else if (skeleton.nodes.get(ref).name.includes('Left') && !srcs.some((s) => s.has(ref))) K = { a: S3, t: [0, 0, 0] };   // rule 13's own test
  else K = mul(mul(plan.restInv.get(m), plan.S), plan.restOf.get(ref));
  ks.set(ref, K);
  return K;
}
/** The graph-space transforms of the clip's pose, read only along the chains asked (the eye's, an arm's parent's) - the
 *  frame composes no whole skeleton (TWO-HANDS AUDIT, L3 10). As mwSkin.js skeletonSpaceMatrices reads them: the root,
 *  and anything not a bone, the identity. */
function chainWorld(skeleton, root, localOf) {
  const memo = new Map();
  const get = (ref) => {
    if (ref === root || ref == null || ref < 0 || !skeleton.nodes.has(ref)) return IDENT_AFFINE;
    let m = memo.get(ref);
    if (!m) { m = mul(get(skeleton.nodes.get(ref).parent), affineOf(localOf(ref))); memo.set(ref, m); }
    return m;
  };
  return { get };
}
/** A pose entry as a fresh affine. */
const affineOf = (e) => { const s = e.scale ?? 1; return { a: Float32Array.from(e.rotation, (v) => v * s), t: [e.translation[0], e.translation[1], e.translation[2]] }; };

const IDENT3 = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const IDENT_AFFINE = Object.freeze({ a: IDENT3, t: [0, 0, 0] });
/** The graph's up (Morrowind's +Z) in the frame of bone `ref`'s parent, read off the chain's rotations as the locals
 *  `loc` have them (a uniform scale turns no way): Rp^T . z. A local turned about it by an angle turns its bone about
 *  the upright line through its own joint by that angle - the guard's way down is worked against it, the spread turns
 *  about it. */
function uprightOver(skeleton, loc, ref) {
  const chain = [];
  for (let r = skeleton.nodes.get(ref).parent; skeleton.nodes.has(r); r = skeleton.nodes.get(r).parent) chain.push(r);
  let Rp = IDENT3;
  for (let i = chain.length - 1; i >= 0; i--) Rp = mat33Mul(Rp, loc(chain[i]).rotation);
  return [Rp[6], Rp[7], Rp[8]];
}
/**
 * THE GUARD: arm `side`'s upper arm turned DOWN by `angle` radians about its own joint - in the upright plane through the
 * shoulder and the wrist as the locals `loc` (a bone's local by ref) have them, so the hand drops and the arm stays on its
 * shoulder (no joint moves off its parent, no bone changes its length). Worked in the upper arm's parent's frame: the
 * graph's up (Morrowind's +Z) read there off the chain's rotations, the wrist read off the arm's own locals. The upper
 * arm's turned local (a fresh entry), or null when there is no way down.
 */
function dipArm(skeleton, loc, plan, side, angle) {
  const up = plan.uppers[side], hand = plan.hands[side];
  if (!(angle > 0) || up == null || hand == null) return null;
  const upward = uprightOver(skeleton, loc, up);
  // the wrist from the shoulder, in the parent's frame: the arm's locals from the upper arm down to the hand
  const down = [];
  for (let r = hand; r !== up; r = skeleton.nodes.get(r).parent) { if (!skeleton.nodes.has(r)) return null; down.push(r); }
  let A = { a: Float32Array.from(IDENT3), t: [0, 0, 0] };
  for (const ref of [up, ...down.reverse()]) { const e = loc(ref); A = mul(A, { a: Float32Array.from(e.rotation, (v) => v * (e.scale ?? 1)), t: e.translation }); }
  const s0 = loc(up).translation;
  const d = [A.t[0] - s0[0], A.t[1] - s0[1], A.t[2] - s0[2]];
  // the axis that lowers it: d x up (a turn about it by a negative angle takes d toward -up)
  const n = [d[1] * upward[2] - d[2] * upward[1], d[2] * upward[0] - d[0] * upward[2], d[0] * upward[1] - d[1] * upward[0]];
  const nl = Math.hypot(n[0], n[1], n[2]);
  if (!(nl > 1e-6 * Math.hypot(d[0], d[1], d[2]))) return null;   // an arm hanging plumb has no way down
  const e = loc(up);
  return { rotation: mat33Mul(rotAxisAngle([n[0] / nl, n[1] / nl, n[2] / nl], -angle), e.rotation), translation: e.translation, scale: e.scale };
}

/**
 * Which hand a clip strikes with: the hand whose wrist travels the farther between two of its poses (the wind-up's
 * start and its hit), each a poseSkeleton map. 'R' or 'L', or null when neither hand moves or the skeleton has no pair.
 */
export function strikingSide(skeleton, root, skelMats, poseA, poseB) {
  const plan = mirrorPlan(skeleton, root, skelMats);
  if (!plan || plan.hands.L == null || plan.hands.R == null) return null;
  const a = skelMats(skeleton, poseA, root), b = skelMats(skeleton, poseB, root);
  const travel = (h) => { const p = a.get(h)?.t, q = b.get(h)?.t; return p && q ? Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) : 0; };
  const l = travel(plan.hands.L), r = travel(plan.hands.R);
  if (!(Math.max(l, r) > 1e-6)) return null;
  return r >= l ? 'R' : 'L';
}

// ---- the left hand's weapon bone --------------------------------------------------------------------------------

/** What a made Weapon Bone Left is said to come from in an assembly's `injected` (WS1's record of the addons, where a
 *  file's path stands): the function that made it. */
export const WEAPON_BONE_LEFT_SOURCE = 'mirrorRig.offWeaponBoneAddon';

const S3 = Float32Array.from([-1, 0, 0, 0, 1, 0, 0, 0, 1]);
const unturned = (r) => !r?.rotation || [1, 0, 0, 0, 1, 0, 0, 0, 1].every((v, i) => Math.abs(r.rotation[i] - v) < 1e-6);
/**
 * TWO-HANDS AUDIT 2: THE HANDS' MIRROR AS THE SKIN HOLDS THEM - the 3x3 F of Bind(a)^-1 . S . Bind(b), Bind a bone's bind
 * (where it stood when the skin was bound), read off the first skinned shape of the skeleton's own file whose skin binds
 * both bones (`nif` the parsed file; `a`, `b` refs of it). Retail's skeletons carry one, the "Tri Shadow" over the whole
 * Bip01 chain (never drawn - rule 59), bound in the T-pose - EXACTLY symmetric, where the rest (the idle's first frame)
 * stands its hands 1.09 units off each other's mirror. Read in the skin's own frame (an inverse bind maps the mesh into
 * the bone, so Bind^-1 is its 3x3 and Bind its inverse), x across the body: a skin whose NiSkinData or shape is turned
 * binds in another frame and is not read. Null where no skin binds both.
 */
function skinHandMirror(nif, a, b) {
  for (const shape of nif?.records ?? []) {
    const skin = Number.isInteger(shape?.skin) && shape.skin >= 0 ? nif.records[shape.skin] : null;
    const data = skin && Number.isInteger(skin.data) ? nif.records[skin.data] : null;
    if (!skin?.bones || !data?.bones) continue;
    const ia = skin.bones.indexOf(a), ib = skin.bones.indexOf(b);
    if (ia < 0 || ib < 0 || !data.bones[ia]?.transform || !data.bones[ib]?.transform) continue;
    if (!unturned(data.transform) || !unturned(shape)) continue;
    const invBind = (i) => { const t = data.bones[i].transform; return { a: Float32Array.from(t.rotation, (v) => v * (t.scale ?? 1)), t: [0, 0, 0] }; };
    return mul(mul(invBind(ia), { a: S3, t: [0, 0, 0] }), inv(invBind(ib))).a;
  }
  return null;
}

/**
 * TWO-HANDS AUDIT: A WEAPON BONE LEFT FOR A SKELETON THAT HAS NONE, made by the mirror from the skeleton's own Weapon
 * Bone - a bone addon (WS1's shape: a parsed NIF whose one marked node hangs under a node the skeleton has) for
 * mwSkin.js injectSkeletonNodes. Retail Morrowind's skeletons (xbase_anim, xbase_anim.1st) have none: OpenMW treats
 * "Weapon Bone Left" as an optional node under the left hand (a bow's attach bone falls back to "Weapon Bone" without
 * it), so the left hand's weapon had nowhere to hang. The node is hung under the Weapon Bone's parent's counterpart (the
 * left hand), MIRRORED HAND TO HAND (TWO-HANDS AUDIT 2) - its local in the left hand the Weapon Bone's in the right, in
 * the mirror:
 *
 *     local(Weapon Bone Left) = F^-1 . local(Weapon Bone) . X          (X = diag(-1, 1, 1))
 *
 * F the 3x3 of Bind(right hand)^-1 . S . Bind(left hand) off the skeleton file's own skin (`nif`, skinHandMirror) -
 * the frame the hand's mesh is bound in, so the grip sits in the left fist exactly as the right's sits in the right -
 * and with no such skin the rest's own, the 3x3 of Rest(right hand)^-1 . S . Rest(left hand) (the mirror law's K^ for
 * the hands). No translation term: the first cut hung the node at S . Rest(Weapon Bone) . X in the graph's space,
 * which carried the REST's asymmetry into the hand - on the retail biped the left grip stood 1.4 units off and 2.8
 * degrees turned in the left fist (the rest's hands 1.09 units off each other's mirror, the bind's exactly on it). X
 * turns the node's own x back: rule 13 draws every part on a "Left" node with x negated (attach.cpp's substring test),
 * so a sword hung here lands as the mirror of the sword in the right hand, which is what a second hand holds. Where the
 * rest is its own mirror (the fixture arm, which carries both nodes) the authored Weapon Bone Left is exactly this
 * (pinned). Read off one rest pass and two names (TWO-HANDS AUDIT 2: it built the whole mirror plan, ~0.7 ms a body).
 * The node is named as Morrowind names it (the bow's attach bone, WEAPON_ATTACH_BONE's MarksmanBow row): the Weapon
 * Bone's own name and " Left" - the counterpart counterpartName gives it, and the "Left" rule 13 reads.
 * Null where nothing is to be made: a Weapon Bone Left is there, no Weapon Bone, or the Weapon Bone's parent has no
 * counterpart.
 */
export function offWeaponBoneAddon(skeleton, root, skelMats, nif = null) {
  const wb = skeleton?.byName?.get('weapon bone');
  if (wb === undefined || skeleton.byName.has(counterpartName('weapon bone'))) return null;
  const pr = skeleton.nodes.get(wb).parent;
  const pl = skeleton.nodes.has(pr) ? skeleton.byName.get(counterpartName(skeleton.nodes.get(pr).name)) : undefined;
  if (pl === undefined || pl === pr) return null;
  let F = skinHandMirror(nif, pr, pl);
  if (!F) {
    const rest = skelMats(skeleton, new Map(), root);
    if (!rest.get(pr) || !rest.get(pl)) return null;
    F = mul(mul(inv({ a: rest.get(pr).a, t: [0, 0, 0] }), { a: S3, t: [0, 0, 0] }), { a: rest.get(pl).a, t: [0, 0, 0] }).a;
  }
  const e = skeleton.nodes.get(wb).rest;
  const local = mul(mul(inv({ a: F, t: [0, 0, 0] }), { a: Float32Array.from(e.rotation, (v) => v * (e.scale ?? 1)), t: [e.translation[0], e.translation[1], e.translation[2]] }), { a: S3, t: [0, 0, 0] });
  const s = scaleOf(local.a);
  return {
    roots: [0],
    records: [
      { type: 'NiNode', name: skeleton.nodes.get(pl).name, rotation: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]), translation: [0, 0, 0], scale: 1, children: [1], extra: -1 },
      { type: 'NiNode', name: `${skeleton.nodes.get(wb).name} Left`, rotation: Float32Array.from(local.a, (v) => v / s), translation: [local.t[0], local.t[1], local.t[2]], scale: s, children: [], extra: 2 },
      { type: 'NiStringExtraData', string: 'BONE', next: -1 },
    ],
  };
}
