// @ts-check
// BODY-MOTION (2026-10-18; bible/04-Characters/Body-Motion.md) - THE SOLVE. A whole body's request laid on the skeleton
// over the clip's pose, in the order a body is built from the ground up:
//   1. THE HIPS turned to the body-frame turn asked (the pelvis and the bone that carries the thighs, together - the
//      rest's own build between them kept), then the body moved so the hips' middle stands where it was asked;
//   2. THE TRUNK: the chest turned to its own body-frame turn, the turn spread up the spine so it bends rather than
//      kinks; the neck and the collarbones put back on the chest as they stand at rest (the clip's own swings of them -
//      an attack clip's, a draw's - would carry the shoulders off the arms' requests);
//   3. THE HEAD turned to its own body-frame turn - level with the world however the trunk sways under it;
//   4. THE LEGS reached to their ankles (the climb's two-bone solve - combat/climbRig.js solveReach), the knee toward the
//      foot's way, the foot set to its toe and its sole's up;
//   5. THE ARMS reached to their wrists the same way, the hand set to its fingers' and its palm's ways - asked AFTER the
//      trunk is placed, through `arms(ctx)`, because where a hand goes is read off the shoulders it hangs from. The
//      fingers are the clip's: the stance's own group already shapes the hand (carry.js).
// A limb is solved off the composed trunk and its three bones' turns carried down to each other by hand, then written as
// locals - nothing re-composed (poseAssembly composes the skeleton once, after every slot).
// Every turn is TOWARD the request by the layer's weight `w` from wherever the clip put the bone, so the layer eases in
// and out over the clip without a pop. Writes new entries into `pose` (never a mutation of the rest's shared ones).
// Answers a small report, or null when nothing was posed.

import { solveReach, rotFrames, rotFromTo, rotFraction, handFrame, orthonormal, rotationPart } from '../../combat/climbRig.js';
import { algebra, clamp01, clamp, transpose, apply, mul, bodyTurn, fromColumns, bodyOf, turnOf, at, RAD } from './bodyKit.js';

const { sub, add, scale, dot, cross, norm, len, lerp3 } = algebra;

/** How the chest's turn is spread up the trunk: each bone below the chest takes this share of it, counted from the hips
 *  (the chest the whole) - so the spine bends rather than kinks. */
const TRUNK_SHARE = Object.freeze({ 2: [0.45], 3: [0.3, 0.65] });

/**
 * THE BODY'S FRAMES as they stand in `mats` now: the chest's [right, forward, up] (the chest bone's turn from rest,
 * squared as bodyOf squares it) and each shoulder's and wrist's point - what `arms(ctx)` reads. Exported for the pins.
 */
export function bodyFrames(body, mats) {
  const Rc = turnOf(mats, body.chest);
  const Rr = body.restRot.get(body.chest);
  if (!Rc || !Rr) return null;
  // the chest frame: the rest's own squared axes carried by the chest's turn since rest
  const M = mul(Rc, mul(transpose(Rr), transpose(body.chestFix)));
  return {
    chest: M,
    right: [M[0], M[3], M[6]], fwd: [M[1], M[4], M[7]], up: [M[2], M[5], M[8]],
    shoulder: { L: at(mats, body.bones.L.upper), R: at(mats, body.bones.R.upper) },
    wrist: { L: at(mats, body.bones.L.hand), R: at(mats, body.bones.R.hand) },
  };
}

/** THE ANKLE'S RANGE (degrees off the rest's own shin-to-toe angle): how far a foot in the air may draw its toes up toward
 *  the shin, and point them away (AUDIT BODY-MOTION GAIT-4: the swing's pitch is the ground's, so a run's mid-swing,
 *  its shin swung back, drew the toes up 82 degrees). A foot on the ground keeps the gait's: it stands on the ground. */
export const ANKLE = Object.freeze({ dorsi: 25, plantar: 50 });

const IDENT = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
/** A bone's rotation `Rt` taken toward by `w` from its own: the rotation to set. */
const toward = (Rc, Rt, w) => (w >= 1 ? Rt : mul(rotFraction(mul(Rt, transpose(Rc)), w), Rc));

/**
 * THE SOLVE. `plan`:
 *   w      - the layer's weight (0..1);
 *   hip    - { at: [x, y, z] the hips' middle, yaw, roll, pitch } (radians, bodyKit.js bodyTurn's sense);
 *   chest  - { yaw, roll, pitch } - the chest's turn in the body frame;
 *   head   - { yaw, roll, pitch } - the head's;
 *   feet   - { L, R }: { at, toe, up, w } - the ankle's point, the toes' way, the sole's up;
 *   armW   - { L, R }: how far each arm is the layer's (0 the clip's - a bow's, a spell's, a draw's, the long gun's, a
 *            torch's left): the chest, the neck and the head are the layer's as far as either arm is, each collarbone as
 *            far as its own arm is - the rest the clip's, so an aim the clip holds stays where it holds it;
 *   arms   - (ctx) => { L, R }: each a climb hand request ({ at, fingers, palm, pole, curl, w }) or null, asked with
 *            { body, mats, frames, skeleton } once the trunk stands.
 */
export function solveBody(skeleton, pose, rootRef, skelMats, plan) {
  const w = clamp01(plan?.w ?? 0);
  if (!(w > 0)) return null;
  const body = bodyOf(skeleton, rootRef, skelMats);
  if (!body) return null;
  const { bones } = body;
  const report = { hip: null, reach: { L: null, R: null }, feet: { L: null, R: null } };
  // 1-3. THE TRUNK, TOP DOWN, IN ONE PASS. Each bone this pass decides gets its rig rotation from the ones above it and
  // is written as its local; the skeleton is composed once after. (A turn - climbRig.js `turn` - re-composes its whole
  // subtree, and a body's trunk carries most of the tree: turned bone by bone, the hips and the spine were six
  // compositions of the whole skeleton a frame, for every body on the street.)
  const decided = new Map();   // ref -> its new rig rotation
  const localRot = (ref) => (pose.get(ref) ?? skeleton.nodes.get(ref).rest).rotation;
  /** A bone's rig rotation as the clip's pose stands it: its rotations down from the root (memoised - only the trunk's
   *  path is ever asked, so no whole skeleton is composed for it). */
  const clipRot = new Map();
  const R0 = (ref) => {
    if (clipRot.has(ref)) return clipRot.get(ref);
    const node = skeleton.nodes.get(ref);
    if (!node) return null;
    if (ref === rootRef) return IDENT;   // skeletonSpaceMatrices' own space: the root is the frame
    const p = node.parent;
    const R = p != null && p !== rootRef && skeleton.nodes.has(p) ? mul(R0(p), localRot(ref)) : localRot(ref);
    clipRot.set(ref, R);
    return R;
  };
  const touched = (ref) => { for (let r = ref; r != null && skeleton.nodes.has(r); r = skeleton.nodes.get(r).parent) if (decided.has(r)) return true; return false; };
  /** The rig rotation `ref` takes under what this pass has decided above it (its own local the clip's). */
  const rotNow = (ref) => {
    if (decided.has(ref)) return decided.get(ref);
    const p = skeleton.nodes.get(ref)?.parent;
    return p != null && skeleton.nodes.has(p) && touched(p) ? mul(rotNow(p), localRot(ref)) : R0(ref);
  };
  const order = [];
  const decide = (ref, Rt) => { if (ref == null || !R0(ref)) return; decided.set(ref, toward(rotNow(ref), Rt, w)); order.push(ref); };
  // the hips: the pelvis and the thigh-carrying bone turned together, the rest's own build between them kept
  if (plan.hip) {
    const D = mul(bodyTurn(plan.hip.yaw ?? 0, plan.hip.roll ?? 0, plan.hip.pitch ?? 0), body.hipFix);
    for (const ref of new Set([bones.pelvis, body.hipBone])) if (ref != null && body.restRot.has(ref)) decide(ref, mul(D, body.restRot.get(ref)));
  }
  // the trunk: the chest's turn spread up the spine; then the neck and the collarbones as they stand at rest on it (the
  // clip's own swings of them - an attack clip's, a draw's - would carry the shoulders off the arms' requests)
  // AUDIT BODY-MOTION RIG-4 / DOC-3 / CARRY-10: the upper body is whoever has the arms' - the layer's chest turn, lean
  // and collarbones under a bow's arms swung its hand 18.6 units and 38 degrees off the clip's aim, and turned a long
  // gun's barrel 9 to 14 degrees with the gait's counter-turn
  const armL = clamp01(plan.armW?.L ?? 1), armR = clamp01(plan.armW?.R ?? 1), armAny = Math.max(armL, armR);
  if (plan.chest) {
    const own = mul(mul(bodyTurn(plan.chest.yaw ?? 0, plan.chest.roll ?? 0, plan.chest.pitch ?? 0), body.chestFix), body.restRot.get(body.chest));
    const Rt0 = armAny >= 1 ? own : toward(R0(body.chest), own, armAny);   // the clip's chest where it stands, as far as the clip has the arms
    const chestNow = rotNow(body.chest);
    const Rt = toward(chestNow, Rt0, w);
    const Q = mul(Rt, transpose(chestNow));
    const shares = TRUNK_SHARE[body.trunk.length] ?? [];
    const carried = body.trunk.map((ref) => rotNow(ref));
    body.trunk.forEach((ref, i) => {
      decided.set(ref, ref === body.chest ? Rt : mul(rotFraction(Q, shares[i] ?? 0.5), carried[i]));
      order.push(ref);
    });
    for (const ref of [bones.neck, bones.L.clavicle, bones.R.clavicle]) {
      const parent = ref == null ? null : skeleton.nodes.get(ref).parent;
      const restOf = ref == null ? null : restRotOf(skeleton, body, ref), restParent = parent == null ? null : restRotOf(skeleton, body, parent);
      const share = ref === bones.L.clavicle ? armL : ref === bones.R.clavicle ? armR : armAny;
      if (restOf && restParent) decide(ref, toward(rotNow(ref), mul(rotNow(parent), mul(transpose(restParent), restOf)), share));
    }
  }
  // the head, level with the world however the trunk sways under it
  if (plan.head && bones.head != null && body.restRot.has(bones.head)) {
    decide(bones.head, toward(rotNow(bones.head), mul(bodyTurn(plan.head.yaw ?? 0, plan.head.roll ?? 0, plan.head.pitch ?? 0), body.restRot.get(bones.head)), armAny));
  }
  // written as locals, top down (each against its parent's NEW rotation), kept rotations; then composed once
  for (const ref of order) {
    const node = skeleton.nodes.get(ref);
    const local = pose.get(ref) ?? node.rest;
    const p = node.parent;
    const Rp = p != null && skeleton.nodes.has(p) ? rotNow(p) : null;
    pose.set(ref, { rotation: orthonormal(Rp ? mul(transpose(Rp), decided.get(ref)) : decided.get(ref)), translation: local.translation, scale: local.scale });
  }
  const mats = skelMats(skeleton, pose, rootRef);
  // the body moved so the hips' middle stands where it was asked: the root's own place, and every matrix under it
  if (plan.hip?.at) {
    const mid = scale(add(at(mats, bones.L.thigh), at(mats, bones.R.thigh)), 0.5);
    const dv = scale(sub(plan.hip.at, mid), w);
    if (len(dv) > 1e-6) moveSubtree(skeleton, pose, mats, bones, bones.root, dv);
    report.hip = scale(add(at(mats, bones.L.thigh), at(mats, bones.R.thigh)), 0.5);
  }
  // 4. the legs and the feet
  if (plan.feet) {
    for (const side of ['L', 'R']) {
      const f = plan.feet[side];
      if (f) report.feet[side] = poseFoot(skeleton, pose, mats, body, side, f, w);
    }
  }
  // 5. the arms, asked now the shoulders stand
  if (plan.arms) {
    const frames = bodyFrames(body, mats);
    const req = frames ? plan.arms({ body, mats, frames, skeleton }) : null;
    if (req) {
      for (const side of ['L', 'R']) {
        const h = req[side];
        if (!h || !h.at) continue;
        const wr = poseHand(skeleton, pose, mats, body, side, h, w);
        if (wr) report.reach[side] = len(sub(wr, h.at));
      }
    }
  }
  report.mats = mats;
  return report;
}

/** Move bone `ref`'s joint, and everything under it, by the rig-space vector `dv`: its local translation, and every
 *  matrix of its subtree translated in place (a translation moves no bone's turn - nothing to re-compose). */
function moveSubtree(skeleton, pose, mats, bones, ref, dv) {
  const node = skeleton.nodes.get(ref);
  const local = pose.get(ref) ?? node.rest;
  const parent = mats.get(node.parent);
  let lv = dv;
  if (parent) {
    const sp = Math.hypot(parent.a[0], parent.a[3], parent.a[6]) || 1;
    lv = scale(apply(transpose(rotationPart(parent.a)), dv), 1 / sp);
  }
  pose.set(ref, { rotation: local.rotation, translation: [local.translation[0] + lv[0], local.translation[1] + lv[1], local.translation[2] + lv[2]], scale: local.scale });
  const stack = [ref];
  while (stack.length) {
    const r = stack.pop();
    const t = mats.get(r)?.t;   // this solve's own composition: its arrays are its own to move
    if (t) { t[0] += dv[0]; t[1] += dv[1]; t[2] += dv[2]; }
    for (const k of bones.children.get(r) ?? []) stack.push(k);
  }
}
/** A bone's rest rotation in the rig: bodyOf's where it kept one, else composed down the chain (memoised). */
const _restRots = new WeakMap();
function restRotOf(skeleton, body, ref) {
  if (body.restRot.has(ref)) return body.restRot.get(ref);
  let per = _restRots.get(skeleton);
  if (!per) { per = new Map(); _restRots.set(skeleton, per); }
  if (per.has(ref)) return per.get(ref);
  const chain = [];
  for (let r = ref; r != null && r >= 0 && skeleton.nodes.has(r); r = skeleton.nodes.get(r).parent) chain.push(skeleton.nodes.get(r));
  if (!chain.length) return null;
  /** @type {ArrayLike<number>} */
  let R = IDENT;
  for (let i = chain.length - 1; i >= 0; i--) R = mul(R, chain[i].rest.rotation);
  per.set(ref, R);
  return R;
}

/**
 * A TWO-BONE LIMB (`a` the upper bone, `b` the lower - its child - and `c` the end - the lower's child) reached to
 * `target` with its middle joint toward `pole`, the end turned by `end(R)` (handed the end's rotation as the reach
 * carries it, it answers the rotation wanted, or null to keep it). Each bone's turn is the least one that takes its own
 * direction onto the solve's, carried down to its child by hand; the three are written as locals, and `mats` is left as
 * it was (nothing after reads the limb's own bones). Answers where the end's joint now stands, or null where the chain is
 * not upper - lower - end.
 */
function reachLimb(skeleton, pose, mats, a, b, c, target, pole, end) {
  const nb = skeleton.nodes.get(b), nc = skeleton.nodes.get(c);
  if (!nb || !nc || nb.parent !== a || nc.parent !== b) return null;
  const S = at(mats, a), E = at(mats, b), W = at(mats, c);
  const Ra = turnOf(mats, a), Rb = turnOf(mats, b), Rc = turnOf(mats, c), Rp = turnOf(mats, skeleton.nodes.get(a).parent);
  if (!S || !E || !W || !Ra || !Rb || !Rc) return null;
  const sol = solveReach(S, len(sub(E, S)), len(sub(W, E)), target, pole, 0.999);
  const Da = rotFromTo(norm(sub(E, S)), norm(sub(sol.mid, S)));
  const Db = rotFromTo(norm(apply(Da, sub(W, E))), norm(sub(sol.end, sol.mid)));
  const Ra1 = mul(Da, Ra), Rb1 = mul(Db, mul(Da, Rb)), Rc0 = mul(Db, mul(Da, Rc));
  const Rc1 = (end && end(Rc0, mul(Db, Da), sol)) || Rc0;
  const write = (ref, Rparent, R) => {
    const local = pose.get(ref) ?? skeleton.nodes.get(ref).rest;
    pose.set(ref, { rotation: orthonormal(Rparent ? mul(transpose(Rparent), R) : R), translation: local.translation, scale: local.scale });
  };
  write(a, Rp, Ra1);
  write(b, Ra1, Rb1);
  write(c, Rb1, Rc1);
  return sol.end;
}

/**
 * A LEG: the reach to the ankle's point (the knee toward the foot's way, out a little - a knee never folds sideways),
 * then the foot turned so its toes and its sole's up are the request's. The foot's own axes are what the rig's +Y and
 * +Z were to it at rest (climbRig.js restAxes): a rest foot stood toed-out stays toed-out by as much.
 */
function poseFoot(skeleton, pose, mats, body, side, f, w) {
  const limb = body.bones[side];
  const k = clamp01((f.w ?? 1) * w);
  const A = at(mats, limb.foot);
  if (!(k > 0) || !f.at || !A) return null;
  const toe = f.toe ?? [0, 1, 0];
  const out = side === 'R' ? 1 : -1;
  const pole = norm(add([toe[0], toe[1], 0], [out * 0.12, 0, 0.02]));
  const ax = body.footAxes[side];
  return reachLimb(skeleton, pose, mats, limb.thigh, limb.calf, limb.foot, lerp3(A, f.at, k), pole, (Rf, _D, sol) => {
    if (!ax || !f.toe) return null;
    const curToe = norm(apply(Rf, ax.fwd)), curUp = norm(apply(Rf, ax.up));
    let toeTo = norm(lerp3(curToe, f.toe, k)), upTo = norm(lerp3(curUp, f.up ?? [0, 0, 1], k));
    // a foot in the air within the ankle's range of the shin the reach gave it (ANKLE)
    if (f.stance === false && sol) {
      const shin = norm(sub(sol.mid, sol.end));
      const a = Math.acos(clamp(dot(shin, toeTo), -1, 1)), rest = body.ankleRest?.[side] ?? Math.PI / 2;
      const want = clamp(a, rest - ANKLE.dorsi * RAD, rest + ANKLE.plantar * RAD);
      const across = sub(toeTo, scale(shin, dot(toeTo, shin)));
      if (want !== a && len(across) > 1e-6) {
        const t2 = add(scale(shin, Math.cos(want)), scale(norm(across), Math.sin(want)));
        upTo = norm(apply(rotFromTo(toeTo, t2), upTo));
        toeTo = t2;
      }
    }
    return mul(rotFrames(curToe, curUp, toeTo, upTo), Rf);
  });
}

/**
 * AN ARM (combat/climbRig.js poseArm's request - `at`, `fingers`, `palm`, `pole`, `w` - posed without its re-composing):
 * the wrist reached from where the clip holds it toward the request by the weight, the elbow's way eased from the
 * clip's to the request's, the hand turned to its fingers' and its palm's ways as they stand once the reach carries
 * it (climbRig.js handFrame - the fingers' bases and the thumb's side).
 */
function poseHand(skeleton, pose, mats, body, side, h, w) {
  const limb = body.bones[side];
  const k = clamp01((h.w ?? 1) * w);
  const S = at(mats, limb.upper), E = at(mats, limb.fore), W = at(mats, limb.hand);
  if (!(k > 0) || !h.at || !S || !E || !W) return null;
  const sw = norm(sub(W, S));
  const clipElbow = norm(sub(E, add(S, scale(sw, dot(sub(E, S), sw)))));
  const pole = h.pole ? norm(lerp3(len(clipElbow) > 0.5 ? clipElbow : h.pole, h.pole, k)) : clipElbow;
  const fr = h.fingers ? handFrame(mats, limb, side) : null;
  return reachLimb(skeleton, pose, mats, limb.upper, limb.fore, limb.hand, lerp3(W, h.at, k), pole, (Rh, D) => {
    if (!fr) return null;
    const f0 = norm(apply(D, fr.fingers)), p0 = fr.palm ? norm(apply(D, fr.palm)) : null;
    const want = norm(lerp3(f0, h.fingers, k));
    return mul(p0 && h.palm ? rotFrames(f0, p0, want, norm(lerp3(p0, h.palm, k))) : rotFromTo(f0, want), Rh);
  });
}

/**
 * A HAND THAT HOLDS A WEAPON, asked by the weapon: the grip (the Weapon Bone's origin, where the fist closes) at `grip`
 * - or the wrist at `wrist`, the grip where the hand then puts it (a carry's arm is built by its angles, a blow's by its
 * grip),
 * the blade along `blade` (the bone's +Y - out of the thumb's side) and its true edge toward `edge` (the bone's +X - the
 * knuckles' way; squared against the blade). Answers the climb hand request that stands the bone there: the wrist
 * where the grip puts it, the fingers' and the palm's ways carried from the hand's own (the Weapon Bone rides the hand -
 * their relation is read off the bones each frame, so no number about any hand or any weapon is held here) - with the
 * grip it stands at and the weapon's frame (`frame`: blade, edge and the blade's flat) for a second hand to close on.
 * Null where the hand or the bone is missing. `wbRef` the bone (the Weapon Bone, or its left mirror), `side` the hand's.
 */
export function gripRequest(mats, body, side, wbRef, { grip = null, wrist = null, blade, edge, pole = null, w = 1 }) {
  const limb = body.bones[side];
  const hand = mats.get(limb.hand), wb = wbRef == null ? null : mats.get(wbRef);
  if (!hand || !wb) return null;
  const fr = handFrame(mats, limb, side);
  if (!fr || !fr.palm) return null;
  const b = norm(blade);
  let e = sub(edge, scale(b, dot(edge, b)));
  if (len(e) < 1e-4) e = sub([0, 0, -1], scale(b, -b[2]));
  e = norm(e);
  const Rwb = fromColumns(e, b, cross(e, b));
  const Rh = turnOf(mats, limb.hand), Rb = turnOf(mats, wbRef);
  const relR = mul(transpose(Rh), Rb), relT = apply(transpose(Rh), sub(wb.t, hand.t));
  const RhWant = mul(Rwb, transpose(relR));
  const inHand = (v) => norm(apply(RhWant, apply(transpose(Rh), v)));
  const off = apply(RhWant, relT);
  const wristAt = wrist ?? sub(grip, off);
  return {
    at: wristAt, fingers: inHand(fr.fingers), palm: inHand(fr.palm), pole, w,
    grip: grip ?? add(wristAt, off), frame: { blade: b, edge: e, flat: cross(e, b) },
  };
}

/** Where the Weapon Bone stands and how it is turned (the grip, the blade, the edge) in `mats` - or null. */
export function weaponFrame(mats, wbRef) {
  const m = wbRef == null ? null : mats.get(wbRef);
  if (!m) return null;
  const R = turnOf(mats, wbRef);
  return { grip: m.t, blade: [R[1], R[4], R[7]], edge: [R[0], R[3], R[6]], flat: [R[2], R[5], R[8]] };
}
