// PISTOL-STANCE (2026-10-22, the owner: "Yeah it needs its own stance. Same workflow we did to detail all the other
// animations. It needs an idle and active state just like the thunderlock") - THE DWARVEN PISTOLET HELD AS A PISTOL on
// the Morrowind body, in both views. Design record: bible/05-Combat/Dwarven-Pistolet.md, PISTOL-STANCE.
//
// Morrowind has no pistol, so the Pistolet borrows the throwing weapons' groups (characters/ownModels/ownWeaponModels.js
// `animateAs: 11`, MarksmanThrown - Morrowind's one one-handed ranged act): the arm played a dart's throw with a pistol in
// the fist. This module takes the arms off the clip while the gun is drawn and SOLVES them onto the gun, as
// combat/gun/rifleStance.js does for the Thunderlock (RIFLE-STANCE) - one gun hand, not two:
//   LOW, the idle: the pistol carried low in the hand, its muzzle at the ground ahead;
//   AIM, in a fight: the arm out, the pistol up and level down the body's forward.
// A PAIR (bible/05-Combat/Two-Hands.md, PISTOLET's gun pair) holds the second pistol in the left hand in the mirror of
// the right's stance, on the Weapon Bone Left the mirror makes (combat/twoHands/mirrorRig.js offWeaponBoneAddon). With
// one pistol the left hand is FREE and the stance places it too (`free`), so what the throw clip does with an empty hand
// never shows. The rig's own solver places the hands (combat/climbRig.js applyClimbRig), and like the rifle's this holds
// NO number about any skeleton: the body's frame is read off its shoulders and spine (third person) or its eye (first
// person, whose lens looks down the rig's +Y), and every distance is a share of the right arm's own length.
//
// When the hold stands and how the aim comes up are the rifle's own law (rifleStanceStep, RIFLE_EASE), stepped by the
// same arm (combat/fpArm.js stepRifle) - the two guns are held and raised alike; combat/gun/gunHold.js picks the stance by
// the row's `holdAs`.
//
// THE GUN'S FRAME (the shipped mesh, tools/modelPistolet.mjs): the barrel along +Y, the top up +Z, its right +X, the
// grip's middle at the origin. `PISTOL_GRIP_ATTITUDE` (the row's) turns it onto the Weapon Bone through the fist.

import { climbBones, handFrame, applyClimbRig } from '../climbRig.js';
import { mat33Mul } from '../../formats/morrowind/mwNifMesh.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const apply = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
/** A rig matrix's turn, its uniform scale divided out. */
const turnOf = (a) => { const s = Math.hypot(a[0], a[3], a[6]) || 1; return Array.from(a, (v) => v / s); };
/** The rotation whose columns are `x`, `y`, `z` (row-major, column vectors - the rig's own). */
const fromColumns = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
const RAD = Math.PI / 180;
/** A body-frame triple seen in the mirror across the body's middle: right becomes left. */
const mirrored = (v) => [-v[0], v[1], v[2]];

/**
 * THE STANCES - in the BODY's frame (right, forward, up), every distance a share of the right arm's length (shoulder to
 * wrist). The gun hand's (`low`, `aim`): `grip` the gun's grip from its anchor - the hand's own shoulder in third person,
 * the eye in first; `pitch` turns the barrel down from the body's forward, `yaw` across toward the body's left, `cant`
 * rolls it about the barrel (its top toward the right); `pole` the way the elbow points. Written for the RIGHT hand. A
 * PAIR holds its own rows (`pair.low`, `pair.aim`), each hand the other's mirror. The free left hand's (`free.low`,
 * `free.aim`, a single pistol): `at` the wrist from the left shoulder (third) or the eye (first), `fingers` and `palm` the
 * hand's own ways, `pole` its elbow's, `curl` how far the fingers close (radians, the climb rig's) - for the LEFT hand.
 *
 * THE OWNER'S PICKS (2026-10-22), from rendered sheets of three idles, three aims, two pairs and three free hands on the
 * retail biped in the port's plate and through the first-person lens (bible/05-Combat/Dwarven-Pistolet.md PISTOL-STANCE):
 *   - the IDLE "low, muzzle down": the arm at rest at the side, the pistol's muzzle 60 degrees down at the ground ahead;
 *     in first person low in the right of the picture, 45 down and turned 22 in;
 *   - the AIM "arm out, turned in to the eye line": the arm out to 1.12 of its length (the elbow near straight - the
 *     owner: "the arms should be protruding more, not as scrunched up to the face"; the first cut stood the grip 0.92
 *     out, which bent the elbow to 97 degrees, the grip riding well ahead of the wrist), the pistol level at the eye's
 *     height and in toward the middle, turned 7 degrees in; in first person right of the crosshair and under it, its
 *     barrel turned 12 degrees in so its side shows;
 *   - the PAIR "each straight out from its own shoulder" (the owner: "when duel wielding the mirror is too close
 *     together" - the single's aim mirrored brought the two muzzles together before the face): each gun level and
 *     parallel, before its own shoulder; in first person one in each lower corner, turned 8 degrees in;
 *   - the FREE hand "at the side": hanging by the thigh, the fingers loose.
 */
export const PISTOL_STANCES = Object.freeze({
  third: Object.freeze({
    low: Object.freeze({ grip: Object.freeze([0.06, 0.2, -0.92]), pitch: 60, yaw: 0, cant: 0, pole: Object.freeze([0.2, -1, 0]) }),
    aim: Object.freeze({ grip: Object.freeze([-0.14, 1.12, 0.06]), pitch: 0, yaw: 7, cant: 0, pole: Object.freeze([0.4, 0, -1]) }),
    pair: Object.freeze({
      low: Object.freeze({ grip: Object.freeze([0.1, 0.2, -0.9]), pitch: 60, yaw: 0, cant: 0, pole: Object.freeze([0.2, -1, 0]) }),
      aim: Object.freeze({ grip: Object.freeze([0.04, 1.15, -0.04]), pitch: 0, yaw: 0, cant: 0, pole: Object.freeze([0.4, 0, -1]) }),
    }),
    free: Object.freeze({
      low: Object.freeze({ at: Object.freeze([-0.08, 0.06, -0.9]), fingers: Object.freeze([0, 0.2, -1]), palm: Object.freeze([1, 0, 0]), pole: Object.freeze([-0.2, -1, 0]), curl: 0.45 }),
      aim: Object.freeze({ at: Object.freeze([-0.1, 0.05, -0.85]), fingers: Object.freeze([0, 0.25, -1]), palm: Object.freeze([1, 0, 0]), pole: Object.freeze([-0.3, -1, 0]), curl: 0.6 }),
    }),
  }),
  first: Object.freeze({
    low: Object.freeze({ grip: Object.freeze([0.34, 0.6, -0.46]), pitch: 45, yaw: 22, cant: 0, pole: Object.freeze([0.6, -0.6, -1]) }),
    aim: Object.freeze({ grip: Object.freeze([0.22, 0.82, -0.35]), pitch: 2, yaw: 12, cant: 0, pole: Object.freeze([0.6, -0.2, -1]) }),
    pair: Object.freeze({
      low: Object.freeze({ grip: Object.freeze([0.4, 0.6, -0.46]), pitch: 45, yaw: 15, cant: 0, pole: Object.freeze([0.6, -0.6, -1]) }),
      aim: Object.freeze({ grip: Object.freeze([0.38, 0.82, -0.38]), pitch: 3, yaw: 8, cant: 0, pole: Object.freeze([0.6, -0.2, -1]) }),
    }),
    // a single pistol's empty left hand, low and out of the picture
    free: Object.freeze({
      low: Object.freeze({ at: Object.freeze([-0.35, 0.1, -0.9]), fingers: Object.freeze([0, 0.2, -1]), palm: Object.freeze([1, 0, 0]), pole: Object.freeze([-0.4, -1, 0]), curl: 0.45 }),
      aim: Object.freeze({ at: Object.freeze([-0.35, 0.1, -0.9]), fingers: Object.freeze([0, 0.2, -1]), palm: Object.freeze([1, 0, 0]), pole: Object.freeze([-0.4, -1, 0]), curl: 0.6 }),
    }),
  }),
});

/** How far a gun hand's fingers close round the grip (radians, the climb rig's `curl`) - the rifle's grip hand's. */
export const PISTOL_HOLD = Object.freeze({ curl: 1.25 });

const pos = (mats, ref) => (ref == null ? null : mats.get(ref)?.t ?? null);

/** The body's frame and both anchors, read off the posed skeleton - or null. */
function bodyFrame(mats, bones, view, eyeRef) {
  const sR = pos(mats, bones.R.upper), eR = pos(mats, bones.R.fore), wR = pos(mats, bones.R.hand);
  if (!sR || !eR || !wR) return null;
  const arm = len(sub(eR, sR)) + len(sub(wR, eR));
  if (!(arm > 1e-6)) return null;
  if (view === 'first') {
    const eye = pos(mats, eyeRef);
    // the first-person lens looks down the rig's +Y, its up the rig's +Z (combat/fpArm.js's lookAt); both hands from it
    return eye ? { right: [1, 0, 0], fwd: [0, 1, 0], up: [0, 0, 1], R: eye, L: eye, arm } : null;
  }
  const sL = pos(mats, bones.L.upper);
  if (!sL) return null;
  const right = norm(sub(sR, sL));
  const low = pos(mats, bones.spine[0]), high = pos(mats, bones.neck);
  let up = low && high ? norm(sub(high, low)) : [0, 0, 1];
  up = norm(sub(up, scale(right, dot(up, right))));
  if (!(len(up) > 0.5)) up = [0, 0, 1];
  return { right, fwd: norm(cross(up, right)), up, R: sR, L: sL, arm };
}

/** A body-frame triple in the rig. */
const inBody = (f, v) => add(add(scale(f.right, v[0]), scale(f.fwd, v[1])), scale(f.up, v[2]));

/** A gun stance's grip and frame in the rig - `{ grip, barrel, top }` - for the hand on side `s` (the left's the mirror). */
function stanceFrame(f, st, s) {
  const m = s === 'L' ? mirrored : (v) => v;
  const p = st.pitch * RAD, y = (s === 'L' ? -st.yaw : st.yaw) * RAD, c = (s === 'L' ? -st.cant : st.cant) * RAD;
  const barrel = norm(add(add(scale(f.fwd, Math.cos(p) * Math.cos(y)), scale(f.right, -Math.cos(p) * Math.sin(y))), scale(f.up, -Math.sin(p))));
  const level = norm(sub(f.up, scale(barrel, dot(f.up, barrel))));
  const side = cross(barrel, level);   // the gun's right
  const top = norm(add(scale(level, Math.cos(c)), scale(side, Math.sin(c))));
  return { grip: add(f[s], scale(inBody(f, m(st.grip)), f.arm)), barrel, top };
}

const MIRROR_X = Object.freeze([-1, 0, 0, 0, 1, 0, 0, 0, 1]);
/**
 * A hand ON its gun: the wrist where the gun's grip in this hand puts it, and the hand's fingers' and palm's ways - so
 * the gun, attached at `boneRef` under the hand with `attitude`, stands in the frame `G` with its grip at `grip`.
 * `mirror`: the part is placed mirrored in x before its bone (formats/morrowind/mwFirstPerson.js placeAtBone, rule 13 -
 * every part on a Left bone, the pair's second pistol): the mesh's own frame is then the reflection, its x the gun's
 * left, and the bone that stands it so is G . A^T . Mx - a turn again.
 */
function handOnGun(mats, limb, side, boneRef, G, grip, attitude, mirror = false) {
  const hand = mats.get(limb.hand), bone = mats.get(boneRef), fr = handFrame(mats, limb, side);
  if (!hand || !bone || !fr || !fr.palm) return null;
  const A = attitude?.a ?? [1, 0, 0, 0, 1, 0, 0, 0, 1], At = attitude?.t ?? [0, 0, 0];
  const Gm = mirror ? mat33Mul(G, MIRROR_X) : G;   // the mesh's frame: its x the gun's left when it is the mirror
  const Rwb = mirror ? mat33Mul(mat33Mul(Gm, transpose(turnOf(A))), MIRROR_X) : mat33Mul(Gm, transpose(turnOf(A)));
  const pWb = sub(grip, apply(Rwb, mirror ? apply(MIRROR_X, At) : At));
  const Rh = turnOf(hand.a), Rb = turnOf(bone.a);
  const relR = mat33Mul(transpose(Rh), Rb), relT = apply(transpose(Rh), sub(bone.t, hand.t));
  const RhWant = mat33Mul(Rwb, transpose(relR));
  const inHand = (v) => apply(RhWant, apply(transpose(Rh), v));
  return { at: sub(pWb, apply(RhWant, relT)), fingers: norm(inHand(fr.fingers)), palm: norm(inHand(fr.palm)) };
}

/**
 * THE REQUEST - the climb rig's (combat/climbRig.js), in the rig's space: the right wrist on its pistol in the stance,
 * and the left either on the pair's second pistol in the mirror (`pair`) or placed free - at weight `w`, between the
 * idle and the aim by `ready`. Read off `mats` (the skeleton as the clip posed it this frame). `attitude` the gun's own
 * on the bone (`{ a, t }`); `view` 'third' or 'first' (`eyeRef` the eye's node); `stances` the table (PISTOL_STANCES -
 * a sheet hands its own options). Null where the body has no arms, no Weapon Bone, no eye, or a pair with no Weapon Bone
 * Left. Pure.
 */
export function pistolStanceRequest(skeleton, mats, { w = 1, ready = 0, view = 'third', eyeRef = null, attitude = null, pair = false, stances = PISTOL_STANCES } = {}) {
  if (!(w > 0)) return null;
  const bones = climbBones(skeleton);
  const wb = skeleton?.byName?.get('weapon bone'), wbL = skeleton?.byName?.get('weapon bone left');
  if (!bones || wb == null || !mats.get(wb) || (pair && (wbL == null || !mats.get(wbL)))) return null;
  const f = bodyFrame(mats, bones, view, eyeRef);
  if (!f) return null;
  const set = stances[view === 'first' ? 'first' : 'third'];
  const guns = pair ? set.pair : set;   // a pair's own rows, wider than the single's mirror
  const k = Math.min(1, Math.max(0, ready));
  const blend = (a, b) => { const top0 = norm(lerp3(a.top, b.top, k)); const barrel = norm(lerp3(a.barrel, b.barrel, k)); return { grip: lerp3(a.grip, b.grip, k), barrel, top: norm(sub(top0, scale(barrel, dot(top0, barrel)))) }; };
  const gunHand = (s) => {
    const g = blend(stanceFrame(f, guns.low, s), stanceFrame(f, guns.aim, s));
    const G = fromColumns(cross(g.barrel, g.top), g.barrel, g.top);   // the gun mesh's frame in the rig: x right, y barrel, z top
    const h = handOnGun(mats, bones[s], s, s === 'L' ? wbL : wb, G, g.grip, attitude, s === 'L');
    const m = s === 'L' ? mirrored : (v) => v;
    return h && { ...h, pole: norm(inBody(f, m(lerp3(guns.low.pole, guns.aim.pole, k)))), curl: PISTOL_HOLD.curl, shrug: 0 };
  };
  const freeHand = () => {
    const lo = set.free.low, hi = set.free.aim;
    const at = add(f.L, scale(inBody(f, lerp3(lo.at, hi.at, k)), f.arm));
    const fingers = norm(inBody(f, lerp3(lo.fingers, hi.fingers, k)));
    const palm0 = norm(inBody(f, lerp3(lo.palm, hi.palm, k)));
    return { at, fingers, palm: norm(sub(palm0, scale(fingers, dot(palm0, fingers)))), pole: norm(inBody(f, lerp3(lo.pole, hi.pole, k))), curl: lo.curl + (hi.curl - lo.curl) * k, shrug: 0 };
  };
  const R = gunHand('R'), L = pair ? gunHand('L') : freeHand();
  if (!R || !L) return null;
  return { w, hands: { R, L } };
}

/**
 * THE HOLD ON THE SKELETON, written into `pose` over the clip's (formats/morrowind/mwFirstPerson.js poseAssembly's `hold`):
 * the request solved by the climb rig's own solver on this frame's body. Answers the solver's fit, or null.
 */
export function applyPistolStance(skeleton, pose, rootRef, skelMats, opts) {
  const req = pistolStanceRequest(skeleton, skelMats(skeleton, pose, rootRef), opts);
  return req ? applyClimbRig(skeleton, pose, rootRef, skelMats, req) : null;
}
