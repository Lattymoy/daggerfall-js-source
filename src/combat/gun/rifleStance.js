// RIFLE-STANCE (2026-10-17, Mac: "adjust the held animation for the thunderlock on the morrowind model. It should be like a
// rifle being held in an idle stance and a ready stance when in combat") - THE DWARVEN THUNDERLOCK HELD AS A LONG GUN on
// the Morrowind body, in both views. Design record: bible/05-Combat/Dwarven-Thunderlock.md, RIFLE-STANCE.
//
// Morrowind has no gun, so the Thunderlock borrows the crossbow's groups (characters/ownModels/ownWeaponModels.js
// `animateAs: 10`): the arms played whatever a crossbow clip does with a crossbow - and the gun, baked with its barrel
// along the Weapon Bone's +Y, rode the fist like a sword's grip, rolled onto its side. This module takes the arms off the
// clip while the gun is drawn and SOLVES them onto the gun: the right hand on its pistol grip, the left palm up under its
// forend, the gun itself held in one of two stances and eased between them -
//   LOW, the idle: the low ready - the grip at the right hip's front, the muzzle down and across toward the left foot;
//   AIM, in a fight: shouldered - the grip under the right eye, the barrel level down the body's own forward.
// The rig's own solver places the hands (combat/climbRig.js applyClimbRig - the climb's, the seat's, the running hands'),
// so this holds NO number about any skeleton: the body's frame is read off its shoulders and spine (third person) or its
// eye (first person, whose lens looks down the rig's +Y), every distance is a share of the right arm's own length, and
// the grip's frame in the hand is read off the Weapon Bone and the fingers each frame. The legs, the spine and the head
// keep the clip's walk.
//
// THE GUN'S FRAME (the shipped mesh, tools/bakeThunderlock.mjs): the barrel along +Y, the sights up +Z, its right +X, the
// grip at the origin. `GUN_GRIP_ATTITUDE` (on the gun's row, characters/ownModels/ownWeaponModels.js) turns it onto the
// Weapon Bone the way a hand holds a pistol grip, and this module reads whatever attitude the row carries.

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

/**
 * THE STANCES - each the gun's grip and frame in the BODY's frame (right, forward, up), the grip a share of the right
 * arm's length (shoulder to wrist) from its anchor: the right shoulder in third person, the eye in first. `pitch` turns
 * the barrel down from the body's forward, `yaw` across toward the body's left, `cant` rolls the gun about its barrel
 * (its top toward the right); `poleR` and `poleL` the way each elbow points (right, forward, up of the body). Tuned on
 * the retail biped in the port's own plate (the record's renders), not on a guess: the low ready holds the forend at
 * the belt with the muzzle down and across toward the left foot and the elbows back at the sides; the aim holds the gun
 * level at the collar, the right elbow out, the left under the forend.
 * RIFLE-AIM-LOW (2026-10-18, Mac: "the thunderlock in first person (morrowind) when shooting/aiming sits too high on the
 * screen"): the first person's aim stood the grip 0.17 of the arm under the eye with the barrel level, and a level
 * barrel runs off toward the picture's vanishing point - the crosshair - so the gun reached up over it (its top 0.20 of
 * the half-height above the middle, measured on the stand-in). It holds the grip 0.28 under the eye and the barrel 4
 * degrees down the lens: the whole gun under the crosshair (its top 0.17 of the half-height below it), the left hand's
 * fingers still on the forend in view and both arms on their holds. The picture is the eye's, so this holds on any
 * skeleton whose arms reach it.
 */
export const RIFLE_STANCES = Object.freeze({
  third: Object.freeze({
    low: Object.freeze({ grip: Object.freeze([-0.11, 0.27, -0.43]), pitch: 30, yaw: 30, cant: 10, poleR: Object.freeze([0.35, -1, -0.35]), poleL: Object.freeze([-0.5, -0.4, -1]) }),
    aim: Object.freeze({ grip: Object.freeze([-0.24, 0.42, 0.12]), pitch: 0, yaw: 0, cant: 0, poleR: Object.freeze([0.7, -0.2, -0.8]), poleL: Object.freeze([-0.3, 0, -1]) }),
  }),
  first: Object.freeze({
    low: Object.freeze({ grip: Object.freeze([0.25, 0.40, -0.34]), pitch: 12, yaw: 25, cant: 8, poleR: Object.freeze([0.6, -0.6, -1]), poleL: Object.freeze([-0.5, -0.2, -1]) }),
    aim: Object.freeze({ grip: Object.freeze([0.13, 0.40, -0.28]), pitch: 4, yaw: 0, cant: 0, poleR: Object.freeze([0.7, -0.2, -0.8]), poleL: Object.freeze([-0.3, 0, -1]) }),
  }),
});

/**
 * THE HOLD, in the gun's own frame (its grip at the origin, the shipped mesh's units - 70 to the metre): where the
 * left palm meets the forend's underside (its front, under the receiver), and how far the fingers close (radians, the
 * climb rig's `curl`).
 */
export const RIFLE_HOLD = Object.freeze({
  forend: Object.freeze([0, 13.5, -4.5]),
  curlR: 1.25,
  curlL: 0.95,
});

/** THE EASES (seconds): the hold coming on once the gun is drawn and off for the draw, the sheathe, the stone or a
 *  seat (`in`, `out`); the aim coming up and going down again (`up`, `down`); how long a shot keeps it up (`hold`);
 *  and how long a foe's harm on the player does (`fight` - the rig's signal, combat/weapon/weaponRig.js). */
export const RIFLE_EASE = Object.freeze({ in: 0.16, out: 0.1, up: 0.12, down: 0.55, hold: 6, fight: 12 });

/**
 * THE HOLD'S STATE, stepped once a frame: `{ w, ready, since }` - the hold's weight, the aim's share and the seconds
 * since the last shot. `wanted` the gun drawn and nothing else on the hands, `shooting` a shot in flight, `combat` the
 * fight's own signal. A fresh state is `{ w: 0, ready: 0, since: Infinity }`. Pure: answers a new state.
 */
export function rifleStanceStep(state, { wanted = false, shooting = false, combat = false, free = true, dt = 0 } = {}) {
  const s = state ?? { w: 0, ready: 0, since: Infinity };
  const since = shooting ? 0 : s.since + Math.max(0, dt);
  const toward = (v, goal, tau) => goal + (v - goal) * Math.exp(-Math.max(0, dt) / Math.max(1e-4, tau));
  const w = toward(s.w, wanted ? 1 : 0, wanted ? RIFLE_EASE.in : RIFLE_EASE.out);
  const up = shooting || combat || since < RIFLE_EASE.hold;
  const ready = toward(s.ready, up ? 1 : 0, up ? RIFLE_EASE.up : RIFLE_EASE.down);
  // AUDIT SPELL-HAND L3-10: a lone gun's FREE hand eases out as a spell takes it (and back as it goes), on the hold's own
  // ease - its placement was switched whole in a frame (combat/gun/pistolStance.js `free`)
  const f = toward(s.free ?? 1, free ? 1 : 0, free ? RIFLE_EASE.in : RIFLE_EASE.out);
  return { w: w < 1e-3 && !wanted ? 0 : w, ready, since, free: f };
}

const pos = (mats, ref) => (ref == null ? null : mats.get(ref)?.t ?? null);
/** A hand's palm: the wrist to its fingers' first joints (their middle) - else a tenth of the arm. */
function palmLength(mats, limb) {
  const w = pos(mats, limb.hand);
  const bases = limb.fingers.map((ch) => pos(mats, ch[0])).filter(Boolean);
  if (!w || !bases.length) return 0;
  return len(sub(scale(bases.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / bases.length), w));
}

/** The body's frame and the stance's anchor, read off the posed skeleton - or null. */
function bodyFrame(mats, bones, view, eyeRef) {
  const sR = pos(mats, bones.R.upper), eR = pos(mats, bones.R.fore), wR = pos(mats, bones.R.hand);
  if (!sR || !eR || !wR) return null;
  const arm = len(sub(eR, sR)) + len(sub(wR, eR));
  if (!(arm > 1e-6)) return null;
  if (view === 'first') {
    const eye = pos(mats, eyeRef);
    // the first-person lens looks down the rig's +Y, its up the rig's +Z (combat/fpArm.js's lookAt)
    return eye ? { right: [1, 0, 0], fwd: [0, 1, 0], up: [0, 0, 1], anchor: eye, arm } : null;
  }
  const sL = pos(mats, bones.L.upper);
  if (!sL) return null;
  const right = norm(sub(sR, sL));
  const low = pos(mats, bones.spine[0]), high = pos(mats, bones.neck);
  let up = low && high ? norm(sub(high, low)) : [0, 0, 1];
  up = norm(sub(up, scale(right, dot(up, right))));
  if (!(len(up) > 0.5)) up = [0, 0, 1];
  return { right, fwd: norm(cross(up, right)), up, anchor: sR, arm };
}

/** A stance's grip and frame in the rig: `{ grip, barrel, top }`. */
function stanceFrame(f, st) {
  const at = (v) => add(add(scale(f.right, v[0] * f.arm), scale(f.fwd, v[1] * f.arm)), scale(f.up, v[2] * f.arm));
  const p = st.pitch * RAD, y = st.yaw * RAD, c = st.cant * RAD;
  const barrel = norm(add(add(scale(f.fwd, Math.cos(p) * Math.cos(y)), scale(f.right, -Math.cos(p) * Math.sin(y))), scale(f.up, -Math.sin(p))));
  const level = norm(sub(f.up, scale(barrel, dot(f.up, barrel))));
  const side = cross(barrel, level);   // the gun's right
  const top = norm(add(scale(level, Math.cos(c)), scale(side, Math.sin(c))));
  return { grip: add(f.anchor, at(st.grip)), barrel, top };
}

/**
 * THE REQUEST - the climb rig's (combat/climbRig.js), in the rig's space: the right wrist where the gun's grip in the
 * hand puts it, the hand turned so the gun stands in the stance's frame, the left palm under the forend - at weight
 * `w`, between the low ready and the aim by `ready`. Read off `mats` (the skeleton as the clip posed it this frame):
 * the body's frame, the right arm's length, the Weapon Bone in the hand, the fingers' way and the palm's. `attitude`
 * the gun's own on the bone (`{ a, t }`, the part's preTransform - identity when null); `view` 'third' or 'first'
 * (`eyeRef` the eye's node). Null where the body has no arms, no Weapon Bone or no eye. Pure.
 */
export function rifleStanceRequest(skeleton, mats, { w = 1, ready = 0, view = 'third', eyeRef = null, attitude = null } = {}) {
  if (!(w > 0)) return null;
  const bones = climbBones(skeleton);
  const wb = skeleton?.byName?.get('weapon bone');
  if (!bones || wb == null || !mats.get(wb)) return null;
  const f = bodyFrame(mats, bones, view, eyeRef);
  const hand = mats.get(bones.R.hand);
  const fr = handFrame(mats, bones.R, 'R'), frL = handFrame(mats, bones.L, 'L');
  if (!f || !hand || !fr || !fr.palm || !frL) return null;
  const stances = RIFLE_STANCES[view === 'first' ? 'first' : 'third'];
  const lo = stanceFrame(f, stances.low), hi = stanceFrame(f, stances.aim);
  const k = Math.min(1, Math.max(0, ready));
  const grip = lerp3(lo.grip, hi.grip, k), barrel = norm(lerp3(lo.barrel, hi.barrel, k));
  const top = norm(sub(norm(lerp3(lo.top, hi.top, k)), scale(barrel, dot(norm(lerp3(lo.top, hi.top, k)), barrel))));
  const G = fromColumns(cross(barrel, top), barrel, top);   // the gun mesh's frame in the rig: x right, y barrel, z top
  // the Weapon Bone that stands the gun there (the mesh is attitude . v on it), and the hand that holds that bone
  const A = attitude?.a ?? [1, 0, 0, 0, 1, 0, 0, 0, 1], At = attitude?.t ?? [0, 0, 0];
  const Rwb = mat33Mul(G, transpose(turnOf(A)));
  const pWb = sub(grip, apply(Rwb, At));
  const Rh = turnOf(hand.a), Rb = turnOf(mats.get(wb).a);
  const relR = mat33Mul(transpose(Rh), Rb), relT = apply(transpose(Rh), sub(mats.get(wb).t, hand.t));
  const RhWant = mat33Mul(Rwb, transpose(relR));
  const wrist = sub(pWb, apply(RhWant, relT));
  const inHand = (v) => apply(RhWant, apply(transpose(Rh), v));
  // the left palm up under the forend, its fingers across under the barrel toward the gun's right
  const forend = add(grip, apply(G, RIFLE_HOLD.forend));
  const fingersL = norm(add(apply(G, [1, 0, 0]), scale(barrel, 0.25)));
  // the wrist behind the palm's middle by half the palm (wrist to knuckles, read off the hand), under the palm's skin
  const wristL = sub(sub(forend, scale(top, f.arm * 0.04)), scale(fingersL, palmLength(mats, bones.L) * 0.6));
  const pole = (a, b) => { const v = lerp3(a, b, k); return norm(add(add(scale(f.right, v[0]), scale(f.fwd, v[1])), scale(f.up, v[2]))); };
  return {
    w,
    hands: {
      R: { at: wrist, fingers: norm(inHand(fr.fingers)), palm: norm(inHand(fr.palm)), pole: pole(stances.low.poleR, stances.aim.poleR), curl: RIFLE_HOLD.curlR, shrug: 0 },
      L: { at: wristL, fingers: fingersL, palm: top, pole: pole(stances.low.poleL, stances.aim.poleL), curl: RIFLE_HOLD.curlL, shrug: 0 },
    },
  };
}

/**
 * THE HOLD ON THE SKELETON, written into `pose` over the clip's (formats/morrowind/mwFirstPerson.js poseAssembly's `hold`):
 * the request solved by the climb rig's own solver on this frame's body. Answers the solver's fit, or null.
 */
export function applyRifleStance(skeleton, pose, rootRef, skelMats, opts) {
  const req = rifleStanceRequest(skeleton, skelMats(skeleton, pose, rootRef), opts);
  return req ? applyClimbRig(skeleton, pose, rootRef, skelMats, req) : null;
}
