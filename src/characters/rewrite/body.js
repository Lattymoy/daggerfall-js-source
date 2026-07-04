// Vendored from project-final's Rewrite Engine (rewrite/rig/body.js) at C4a -
// same-owner code, flat-pathed; byte-parity against the canonical copy
// is pinned by test/rig.test.js over fixtures/bare-body-parity.json.
// Do not hand-diverge: upstream first, then re-vendor + re-capture.
// Third-person body for the game. Posed + animated rig extracted from the body-anim lab:
// full-body locomotion (pelvis bob/sway/twist + chest lean; legs IK from the moving hips to
// planted feet; gun + arms parented to the chest), plus crouch, slide, mantle, jump, firing.
// State: LOCOMOTION (gait + body motion) x GRIP (hand wrap) x HOLD (idle/aimed). buildBody(s)
// resolves the baked params and returns posed faces in LOCAL space; the caller rotates + places
// the body. No UI and no rendering here.
import { xformFaces, mapVerts, rotEuler, norm, sub, add, mul, mad, cross } from './math.js';
import { tprism, rseg, box } from './geometry.js';
import { skinRamp, solveTwoBone, forearm, hand, buildFoot } from './limb.js';


const DEG = 180 / Math.PI, TAU = Math.PI * 2;
const X = [1, 0, 0], Z = [0, 0, 1], CLOTH = [72, 67, 60];
const hn = (x) => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); }; // hash noise for the husk arm twitch
const hnz = (x) => hn(x) * 2 - 1;
let B = {}; // resolved per buildBody() call from the baked state library
let crystalGun = false; // bulwark exposed: swap the standard rifle mesh for the crystallized rifle
let bulwarkChargeAmt = 0, bulwarkFireAmt = 0, bulwarkMfxCfg = null; // crystal-rifle muzzle FX: charge wind-up amount, fire-burst amount, tuner cfg override
let huskBare = false; // husk reskin only, no clothes/crystals (tuner gait-clarity mode)
let huskSeed = 0;     // per-husk RNG seed -> randomised skin tone + casual attire
let huskNoCrys = false; // debug/tuner: render the clothed body with crystals off
let relicActive = false; // when set, gunAndArms renders the Sever dual-wield instead of the gun (Relics-Arc)
let ravagerGuns = false; // when set, renderHusk also mounts the Ravager's dual gun-blades on the solved wrists (B.ravagerGun = shape)

// ── tuned state library: loco + grip + holds(idle/aimed) ──
const RUN_GRIP = { ...WALK_GRIP, lhX: -0.0875, lhY: 0.0075, lhZ: -0.02, lhPitch: -12, lhYaw: -4 };
const IDLE_HOLD = { scale: 0.16, gunX: 0.13, gunY: 1.23, gunZ: 0.345, gunPitch: 44, gunYaw: -38, gunRoll: 0, rPoleX: 0.6, rPoleY: -1.15, rPoleZ: -0.3, lPoleX: -1.5, lPoleY: -1.5, lPoleZ: -1.5 };
const SLIDE_AIMED = { scale: 0.16, gunX: 0.155, gunY: 1.5, gunZ: 0.42, gunPitch: 5, gunYaw: 0, gunRoll: 0, rPoleX: 0.6, rPoleY: -1, rPoleZ: -0.3, lPoleX: -0.5, lPoleY: -1, lPoleZ: -0.1 }; // gun up + leveled to fire mid-slide
const SLIDE_IDLE = { scale: 0.16, gunX: 0.145, gunY: 1.3, gunZ: 0.395, gunPitch: -5, gunYaw: -38, gunRoll: 0, rPoleX: 0.7, rPoleY: -1.15, rPoleZ: -0.3, lPoleX: -1.5, lPoleY: -1.5, lPoleZ: -1.5 }; // gun braced low + leveled across body
const WALK_LOCO_RIFLE = { ...WALK_LOCO, strideAmp: 0.5, liftAmp: 0.18, cadence: 6.6, bobAmp: 0.046 }; // rifle walk: longer stride + more bob than the pistol
// ── pistol: one two-handed grip + low-ready idle + punched-out aimed, shared across every locomotion state (the body motion sells each state) ──
const PISTOL_IDLE = { scale: 0.18, gunX: 0.04, gunY: 1.09, gunZ: 0.52, gunPitch: 29, gunYaw: 0, gunRoll: 0, rPoleX: 0.5, rPoleY: -1, rPoleZ: -0.45, lPoleX: -0.5, lPoleY: -1, lPoleZ: -0.45 };
const STRAFE_LOCO_RIFLE = { ...STRAFE_LOCO, cadence: 5.6, swayAmp: 0.026, pelvisYaw: 5 }; // rifle strafe: marginally quicker cadence + more hip yaw
const CROUCH_LOCO_RIFLE = { ...CROUCH_LOCO, bobAmp: 0.06, swayAmp: 0.026, pelvisYaw: 2 }; // rifle crouch settles slightly (pistol crouch stays inert)
const CROUCHWALK_LOCO_RIFLE = { ...CROUCHWALK_LOCO, strideAmp: 0.32, bobAmp: 0.03 };
const PISTOL = { grip: { ...PISTOL_GRIP }, holds: { idle: { ...PISTOL_IDLE }, aimed: { ...PISTOL_AIMED } } }; // grip+holds shared by every state; loco is separate (per weapon)
export const STATES = {
  stand: { loco: { rifle: { ...ZERO_LOCO, ...SLIDE_POSE }, pistol: { ...ZERO_LOCO, ...SLIDE_POSE } }, rifle: { grip: null, holds: null }, pistol: PISTOL },   // rifle grip+holds shared with walk (set below)
  walk: { loco: { rifle: { ...WALK_LOCO_RIFLE, ...SLIDE_POSE }, pistol: { ...WALK_LOCO, ...SLIDE_POSE } }, rifle: { grip: { ...WALK_GRIP }, holds: { idle: { ...IDLE_HOLD, rPoleZ: -0.25 }, aimed: { ...WALK_AIMED } } }, pistol: PISTOL },
  run: { loco: { rifle: { ...RUN_LOCO, ...SLIDE_POSE }, pistol: { ...RUN_LOCO_PISTOL, ...SLIDE_POSE } }, rifle: { grip: { ...RUN_GRIP }, holds: { idle: { ...IDLE_HOLD }, aimed: { ...RUN_AIMED } } }, pistol: PISTOL },
  slide: { loco: { rifle: { ...SLIDE_LOCO }, pistol: { ...SLIDE_LOCO, trailPitch: -64 } }, rifle: { grip: { ...WALK_GRIP, rfCurl: 0.5 }, holds: { idle: { ...SLIDE_IDLE }, aimed: { ...SLIDE_AIMED } } }, pistol: PISTOL },
  crouch: { loco: { rifle: { ...CROUCH_LOCO_RIFLE }, pistol: { ...CROUCH_LOCO } }, rifle: { grip: { ...WALK_GRIP }, holds: { idle: { ...IDLE_HOLD }, aimed: { ...WALK_AIMED } } }, pistol: PISTOL }, // aim-only crouch
  crouchwalk: { loco: { rifle: { ...CROUCHWALK_LOCO_RIFLE }, pistol: { ...CROUCHWALK_LOCO } }, rifle: { grip: { ...WALK_GRIP }, holds: { idle: { ...IDLE_HOLD }, aimed: { ...WALK_AIMED } } }, pistol: PISTOL }, // moving crouch: directional gait under the pelvis drop
  strafe: { loco: { rifle: { ...STRAFE_LOCO_RIFLE }, pistol: { ...STRAFE_LOCO } }, rifle: { grip: { ...WALK_GRIP }, holds: { idle: { ...IDLE_HOLD }, aimed: { ...WALK_AIMED } } }, pistol: PISTOL }, // facing-fixed movement (legs via the directional gait)
};

// Leg-gait amplitudes (rifle) for a loco state, sourced from the presets above so they stay in sync - lets the enemy ease its stride between states instead of snapping it.
export const legAmp = (loco) => { const p = STATES[loco] && STATES[loco].loco.rifle; return { stride: (p && p.strideAmp) || 0, lift: (p && p.liftAmp) || 0 }; };
STATES.stand.rifle = STATES.walk.rifle; // by reference: stand always matches walk (rifle grip+holds); loco stays separate per state+weapon
// LMG (third person): mirrors the pistol's structure - ONE shared grip + idle/aimed hold across every state
// (the per-state gait still differs via loco), seeded from the rifle so the LMG has a working pose from day one.
// The lab tunes LMG_GRIP / LMG_IDLE / LMG_AIMED + the reload; the drum is bottom-mounted (not a box mag), so the
// support-hand mag target gets moved down there. Named literals so the tuned values bake back in cleanly.
const LMG_GRIP = { ...WALK_GRIP, lhX: -0.0225, lhY: 0.03, lhZ: 0.085, lhPitch: -188, lhYaw: 191, ltCurl: 1.8 }; // left hand re-wrapped for the LMG's vertical foregrip (the rifle's handguard is horizontal, so its wrap doesn't fit)
const LMG_IDLE = { ...IDLE_HOLD }; // match the rifle idle (low-ready) - the LMG is a two-handed long gun, so it holds the same way; its vertical foregrip is handled by LMG_GRIP's tuned left wrap
const LMG_AIMED = { ...WALK_AIMED };
const LMG = { grip: LMG_GRIP, holds: { idle: LMG_IDLE, aimed: LMG_AIMED } }; // grip+holds shared across states (like PISTOL); loco stays per-state
// Launcher (third person): its own hold, tuned in body-anim (diverged from the LMG seed) - the right hand
// holds like the rifle, the left hand re-wraps for the launcher's foregrip, and the aimed pose raises + pulls
// the tube in. Idle stays the shared low-ready.
const LAUNCHER_GRIP = { ...WALK_GRIP, lhX: -0.13, lhY: 0.09, lhZ: -0.0725, lhPitch: -58, lhYaw: -88, ltCurl: 1.8 };
const LAUNCHER = { grip: LAUNCHER_GRIP, holds: { idle: { ...IDLE_HOLD }, aimed: { ...WALK_AIMED, scale: 0.17, gunX: 0.22, gunY: 1.6, gunZ: 0.21 } } };
// Verdict (SAR, third person): a rifle-like marksman weapon, so its TP hold is seeded from the rifle (shared grip
// + idle/aimed like the LMG/Launcher); its own slot so a distinct hold can be tuned in body-anim later.
const SAR = { grip: { ...WALK_GRIP }, holds: { idle: { ...IDLE_HOLD }, aimed: { ...WALK_AIMED } } };
for (const st in STATES) { STATES[st].loco.lmg = { ...STATES[st].loco.rifle }; STATES[st].lmg = LMG; STATES[st].loco.launcher = { ...STATES[st].loco.rifle }; STATES[st].launcher = LAUNCHER; STATES[st].loco.sar = { ...STATES[st].loco.rifle }; STATES[st].sar = SAR; }
let locoState = 'walk', holdState = 'idle', weapon = 'rifle';
let lastHeavy = 'lmg'; // the player's most-recent Heavy -> which one rides the back when the sidearm is out (the holster is a 2-slot placeholder: a Heavy + the pistol; enemies never carry a Heavy, so this stays player-driven)
let aimPitch = 0; // player look pitch (radians); leans the upper body in third-person, 0 for enemies
const AIM_PITCH_FRAC = 0.5; // fraction of the look pitch carried in third-person: hipfire = the HEAD turns (head-only); ADS = the upper body leans so the gun follows the aim; 0 for enemies
// ── weapon fire: per-weapon recoil spring (kick split into back/rise/muzzle-climb), pistol slide rack, muzzle flash ──
const FIRE = {
  rifle: { rpm: 530, kick: 8, back: 0.05, rise: 0.04, climb: 0.28, yaw: 0.5, springK: 280, springC: 19, flash: 4.7, slide: 0, muzzle: [0, 0.1, 4.45] },
  pistol: { rpm: 280, kick: 15.5, back: 0.08, rise: 0.05, climb: 0.42, yaw: 0.4, springK: 320, springC: 19, flash: 4, slide: 0.5, muzzle: [0, 0.34, 1.05] },
};
const RELOAD = {
  rifle: { rgX: 0.02, rgY: -0.3, rgZ: -0.215, rgPitch: 41, rgYaw: -52, rgRoll: -8, lhDet: 0, lhfX: -0.01, lhfY: 1.1, lhfZ: 0.28, rDur: 1.8, rDown: 0.36, rUp: 0.66 },
  pistol: { rgX: 0.01, rgY: -0.3, rgZ: -0.3, rgPitch: 38, rgYaw: -13, rgRoll: 0, lhDet: 0.6, lhfX: -0.08, lhfY: 1, lhfZ: 0.27, rDur: 1.5, rDown: 0.38, rUp: 0.66 },
}; // reload: gun tilts to a reload pose (rg* added to the held gun); support hand detaches to the mag well by lhDet; rDown/rUp are timing fractions
RELOAD.lmg = { ...RELOAD.rifle }; // LMG TP reload: seeded from the rifle (gun-tilt + support hand to the mag); tuned in the lab (the drum is bottom-mounted, so the hand target moves down)
RELOAD.launcher = { ...RELOAD.rifle }; // Sunder (Launcher) TP reload: seeded from the rifle; without an entry B.rg* is undefined and the held gun+arms transform hits 0*undefined=NaN (invisible in 3rd person)
RELOAD.sar = { ...RELOAD.rifle }; // Verdict (SAR) TP reload: seeded from the rifle; same reason - a missing entry NaN-poisons the held-pose transform
let action = 'none'; // 'none' | 'mantle' | 'jump' | 'djump' | 'reload' (firing overlays via recoil/muzzleT)
let recoil = 0, recoilYaw = 0, slidePos = 0, muzzleT = 0, mantleU = 0, jumpU = 0, reloadU = 0, landDip = 0, leapU = 0, deathU = 0;
function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
function reloadAmt(u, down, up) { // 0 -> 1 (tilt in + hand to the mag) -> hold through the swap -> 0 (return)
  if (u < down) return smooth(u / down);
  if (u < up) return 1;
  return 1 - smooth((u - up) / (1 - up));
}
function kf(u, pts) { // smoothstep-interpolated keyframe track [[u,v]...]
  if (u <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1]; if (u >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * smooth((u - a) / (b - a)); }
  return last[1];
}
// ── jump: gun stays in hand; the torso coil/arch/tuck/absorb pitch + air-driven leg tuck play in place while the game's jumpY carries the body up. Double jump adds a second mid-air push (higher arc). air = foot tuck blend (0 grounded, 1 tucked). ──
const JUMP_DUR = 1.0, JUMP2_DUR = 1.35;
// jump arc: load -> explode (extend + push-off) -> knees-to-chest tuck -> reach -> land absorb.
// u: 0 launch, 0.5 apex, 1 touchdown. A real arc with distinct phases, not a static squat. Single jump uses J_*; the double-jump's second push uses J2_*.
const J_TUCK = [[0, 0], [0.10, 0.06], [0.40, 1.0], [0.58, 1.0], [0.78, 0.15], [1, 0]];          // knee tuck: extended at launch -> up to the chest at apex -> planted to land
const J_PELY = [[0, 0.08], [0.12, 0.04], [0.5, 0.0], [0.80, -0.04], [0.90, -0.20], [1, -0.11]]; // pelvis: stretch up off the launch -> drop into a deep land absorb -> recover
const J_PIT = [[0, -12], [0.14, -8], [0.44, 5], [0.6, 2], [0.80, 8], [0.90, 22], [1, 12]];      // torso: arch back (chest up) launching -> light curl at the tuck -> fold to absorb landing
const J_FP = [[0, -0.6], [0.12, -0.5], [0.45, -0.35], [0.7, -0.1], [0.88, 0.05], [1, 0]];       // foot pitch: toe-down push-off -> pointed in the tuck -> flat to plant
const J_FWD = [[0, -0.18], [0.12, -0.12], [0.45, 0.16], [0.58, 0.16], [0.82, 0.22], [1, 0.13]]; // foot z: trail back on push-off -> knees forward+up -> reach forward to land
const J_ARM = [[0, 0.08], [0.12, 0.10], [0.45, 0.04], [0.7, -0.02], [0.90, -0.10], [1, -0.04]]; // gun/arms: lift off the launch, brace, settle on the absorb
// double-jump second push: a sharp down-kick against the air, then a tighter + earlier snap-tuck with more curl - reads distinct from the ground jump.
const J2_TUCK = [[0, -0.12], [0.06, -0.16], [0.20, 0.7], [0.32, 1.15], [0.52, 1.08], [0.74, 0.2], [1, 0]]; // kick the legs down -> snap up tighter + earlier than the first jump
const J2_PIT = [[0, -7], [0.12, -3], [0.30, 15], [0.5, 11], [0.72, 6], [0.88, 22], [1, 12]];               // less launch arch (already airborne), more forward curl = a tighter tuck/flip
const J2_PELY = [[0, 0.0], [0.16, 0.02], [0.5, 0.0], [0.82, -0.05], [0.90, -0.19], [1, -0.11]];            // no ground stretch on the second push; still absorbs the landing
const J2_ARM = [[0, -0.04], [0.10, 0.17], [0.30, 0.10], [0.6, 0.0], [0.88, -0.09], [1, -0.04]];            // arms swing up hard on the push
// jump FEEL scales (1 = the baked look). The body-anim tuner drives these live + COPYs them back here. The
// pelvis splits into stretch (up off launch) vs absorb (land drop); the torso into arch (launch back) vs fold (land forward).
const JUMP_SCALE = { tuck: 1, stretch: 0.95, absorb: 1, arch: 0.35, fold: 0.4, reach: 1, arm: 1.1 };
export const JUMP = { TUCK: J_TUCK, PELY: J_PELY, PIT: J_PIT, FP: J_FP, FWD: J_FWD, ARM: J_ARM, J2: { TUCK: J2_TUCK, PIT: J2_PIT, PELY: J2_PELY, ARM: J2_ARM }, SCALE: JUMP_SCALE }; // curves + scales: single source the tuner imports so its preview can't drift from the game
// ── mantle: climb up + forward onto a ledge. Body rises (eUp leads) then moves forward (eFwd follows) + leans; both hands grab a ledge above, legs dangle -> plant; gun stowed (hidden). Loops. ──
const MANTLE = { dur: 1.5, rise: 1.45, fwd: 0.5, lean: 22, ledgeX: 0.3, ledgeY: 1.57, ledgeZ: 0.45, footHangY: 0.06, footPlantY: 1.55, footPlantZ: 0.42, footFwd0: 0.1 };
// per-weapon firing-cone configs. The cone is the bolt colour scheme (white-hot core -> cyan flares -> a
// forward-flaring blue cone), tunable per weapon in tools/flash-lab.html. All seeded identical (the shipped
// look); tune each in the lab + paste WEAPON_FLASH back. Geometry params are multiples of the muzzle scale s.
export { FLASH_DEF, WEAPON_FLASH, muzzleFlashFaces } from './muzzleFlash.js'; // base FX ride along
import { FLASH_DEF, WEAPON_FLASH, muzzleFlashFaces } from './muzzleFlash.js';
import { VOXLIGHT_SPEC, loftTorso, loftPair } from './bodySpec.js';
import { CROUCH_STANCE, WALK_GRIP, PISTOL_GRIP, WALK_AIMED, RUN_AIMED, PISTOL_AIMED, SLIDE_POSE, ZERO_LOCO, WALK_LOCO, RUN_LOCO, RUN_LOCO_PISTOL, STRAFE_LOCO, SLIDE_LOCO, CROUCH_LOCO, CROUCHWALK_LOCO } from './poseTables.js';
export { VOXLIGHT_SPEC, torsoProfile } from './bodySpec.js';
function buildFlash(out, tip, k, weapon) { out.push(...muzzleFlashFaces(tip, k, WEAPON_FLASH[FLASH_TYPE_KEY[weapon]] || FLASH_DEF)); } // third-person gun-local flash, keyed by weapon type

// ── rig ──
function mkFrame(yaw, pitch, roll, piv, trans) {
  const Rf = rotEuler(yaw, pitch, roll);
  const t = sub(add(piv, trans), Rf(piv));
  return { pt: (p) => add(Rf(p), t), faces: (fs) => xformFaces(fs, Rf, t) };
}
const compose = (A, Bf) => ({ pt: (p) => A.pt(Bf.pt(p)), faces: (fs) => A.faces(Bf.faces(fs)) });
function trunkLower(out) {
  if (SPEC.torsoRows) return; // full trace: the measured torso rows ARE the pelvis; the literal groin wedge would blotch the traced crotch gap
  { const v = SPEC.pelvis; tprism(out, [0, v.y0, 0], [0, v.y1, 0], X, Z, v.rx0, v.rz0, v.rx1, v.rz1, 12, CLOTH); }
  tprism(out, [0, 0.9, 0.01], [0, 0.765, 0.035], X, Z, 0.13, 0.16, 0.05, 0.085, 10, CLOTH);
}
function trunkUpperChest(out, ramp) {
  const { SK } = ramp;
  if (SPEC.torsoRows) {
    loftTorso(out, tprism, X, Z, SPEC.torsoRows, CLOTH);
    if (SPEC.torsoRelief) loftTorso(out, tprism, X, Z, SPEC.torsoRelief, CLOTH); // additive interior relief plates (drawn highlights as form; subset of the run)
    if (SPEC.backRelief) loftTorso(out, tprism, X, Z, SPEC.backRelief, CLOTH); // back-surface relief (sourced from the back paint sheet)
  } else {
    { const v = SPEC.chest; tprism(out, [0, v.y0, 0], [0, v.y1, 0], X, Z, v.rx0, v.rz0, v.rx1, v.rz1, 12, CLOTH); } // chest extends below the waist pivot (1.0) to overlap the hips, so the opposing pelvis/chest twist when moving doesn't tear a gap at the waist (the outline would otherwise read it as a seam at the chunky character resolution)
    { const c = SPEC.chest, u = SPEC.upperChest; tprism(out, [0, c.y1, 0], [0, u.y1, 0], X, Z, c.rx1, c.rz1, u.rx1, u.rz1, 12, CLOTH); }
  }
  if (SPEC.hairRows) { loftTorso(out, tprism, X, Z, SPEC.hairRows.map((r) => ({ ...r, cz: -0.03 })), SK); } // measured head/hair/traps mass (rows are exact single-run sprite widths); sits back so the face emerges - replaces the neck prism
  else { const v = SPEC.neck; tprism(out, [0, v.y0, v.z0], [0, v.y1, v.z1], X, Z, v.rx0, v.rz0, v.rx1, v.rz1, 12, SK); } // neck flares into the shoulders at the base so the head stays connected at the chunky character resolution (the outline would otherwise eat a 1px neck into a seam)
}
// the head/face, in chest-local space. Split out of trunkUpper so the husk can ride it on its own
// pivot (head tilt + twitch); the neck base above keeps it visually connected when tilted.
function headPieces(out, ramp) {
  const { SK, SKL, SKM } = ramp;
  const hd = SPEC.head || {};
  const s = hd.scale ?? 1.24, lf = hd.lift ?? -0.065, base = 1.62, hp = (p) => [p[0] * s, base + (p[1] - base) * s + lf, p[2] * s], hr = (r) => r * s;
  tprism(out, hp([0, 1.62, 0.006]), hp([0, 1.70, 0.01]), X, Z, hr(0.06), hr(0.072), hr(0.086), hr(0.10), 12, SK);
  tprism(out, hp([0, 1.70, 0.01]), hp([0, 1.785, 0.005]), X, Z, hr(0.086), hr(0.10), hr(0.093), hr(0.107), 12, SK);
  tprism(out, hp([0, 1.785, 0.005]), hp([0, 1.86, 0]), X, Z, hr(0.093), hr(0.107), hr(0.082), hr(0.094), 12, SK);
  tprism(out, hp([0, 1.86, 0]), hp([0, 1.9, -0.008]), X, Z, hr(0.082), hr(0.094), hr(0.062), hr(0.072), 12, SK);
  rseg(out, hp([-0.062, 1.792, 0.085]), hp([0.062, 1.792, 0.085]), [0, 1, 0], hr(0.013), hr(0.018), hr(0.013), hr(0.018), 6, SKM);
  rseg(out, hp([0, 1.778, 0.094]), hp([0, 1.738, 0.118]), X, hr(0.011), hr(0.011), hr(0.016), hr(0.02), 6, SKL);
  for (const sx of [1, -1]) rseg(out, hp([sx * 0.088, 1.75, 0.0]), hp([sx * 0.107, 1.744, 0.006]), Z, hr(0.016), hr(0.026), hr(0.013), hr(0.02), 6, SK);
}
function trunkUpper(out, ramp) { trunkUpperChest(out, ramp); headPieces(out, ramp); } // combined (unchanged for soldier paths)
function armToGrip(out, side, gripWrist, axis, fwd, wrapSign, curl, mirror, pole, size0, fg, ramp) {
  const size = size0 * (SPEC.handScale ?? 1);
  const { SK, SKL, SKM, SKD } = ramp;
  const AR = SPEC.arm || {};
  const ar = AR.r ?? 1;
  const S = [side * (AR.shoulderX ?? 0.235), AR.shoulderY ?? 1.5, 0];
  const [elbow, wrist] = solveTwoBone(S, gripWrist, AR.upper ?? 0.385, AR.fore ?? 0.335, pole);
  const armDir = norm(sub(elbow, S)); // deltoid seated on the joint, draped down the upper arm (reads as the top of the arm, not a detached pad)
  rseg(out, mad(S, [0, 1, 0], -0.02), mad(S, armDir, 0.16), Z, 0.036 * ar, 0.05 * ar, 0.0475 * ar, 0.04 * ar, 8, SK);
  rseg(out, S, elbow, Z, 0.076 * ar, 0.0707 * ar, 0.068 * ar, 0.0639 * ar, 8, SK);
  rseg(out, mad(elbow, [0, 1, 0], -0.04), mad(elbow, [0, 1, 0], 0.04), Z, 0.07 * ar, 0.07 * ar, 0.07 * ar, 0.07 * ar, 9, SK);
  forearm(out, elbow, wrist, 0.073 * (AR.rFore ?? ar), 0.038 * (AR.rFore ?? ar), SK, SKD); // classic forearm is thinner than its upper arm
  hand(out, { axis, fwd, wrist, wrapSign, mirror, size, curl, curlMul: fg.curlMul, fingerSpread: fg.spread, fingerLen: fg.len, thumbCurl: fg.tcurl, thumbSpread: fg.tspread, color: SK, colorL: SKL, colorM: SKM, colorD: SKD });
  return { shoulder: S, elbow, wrist }; // chest-local joints, for armor
}
// the Sever dual-wield (relic active): no gun - both arms IK to a ready stance and a scaled dagger mounts
// at each solved wrist along the hand's wrap axis (the flicker blade-arm pattern). Same joint contract.
function relicArms(out, wbX, wbY, ramp) {
  const J = [], dag = PLUGS.relic.severDaggerFaces(0.42);
  const fg = { curlMul: B.rfCurl, spread: B.rfSpread, len: B.rfLen, tcurl: B.rtCurl, tspread: B.rtSpread };
  // activation flourish: mu 0..1 across the cinematic (-1 = settled). raise sweeps a low crossed guard up to
  // the flared ready stance (~74% through, then holds); pop is a small back-half crest; matr assembles the
  // daggers from shatter chunks over the first half (fully formed by mu 0.5). lerp = guard -> ready by raise.
  const mu = B.manifestU, tt = Math.min(1, mu), lp = (g, r, k) => g + (r - g) * k;
  const raise = mu < 0 ? 1 : (function (t) { return t * t * (3 - 2 * t); })(Math.min(1, mu * 1.35));
  const pop = mu < 0 ? 0 : Math.sin(Math.PI * tt) * (mu > 0.5 ? 0.14 : 0);
  const matr = mu < 0 ? 1 : Math.min(1, mu * 2);
  for (const side of [1, -1]) {
    const W = [lp(side * 0.14, side * 0.56, raise) + wbX, lp(0.62, 1.16, raise) + wbY + pop * 0.5, lp(0.42, 0.24, raise)];
    const readyA = [side * 0.45, 0.74, 0.32], guardA = [side * 0.2, -0.55, 0.78];
    const a = norm([lp(guardA[0], readyA[0], raise), lp(guardA[1], readyA[1], raise) + pop, lp(guardA[2], readyA[2], raise)]);
    const w = norm(cross(a, [0, 0, 1])), f = cross(a, w);
    const j = armToGrip(out, side, W, a, [0, 0, 1], side, 0.92, side > 0, [side * 0.85, -0.55, 0.35], B.rHandSize, fg, ramp);
    const Rd = (p) => [w[0] * p[0] + f[0] * p[1] + a[0] * p[2], w[1] * p[0] + f[1] * p[1] + a[1] * p[2], w[2] * p[0] + f[2] * p[1] + a[2] * p[2]];
    let dagF = xformFaces(dag, Rd, mad(W, a, 0.03));
    if (matr < 1) dagF = PLUGS.death.crystalDeathFaces(dagF, 1 - matr); // reversed shatter -> assembled blade
    out.push(...dagF);
    J.push({ side, ...j });
  }
  return J;
}
function gunAndArms(out, wbX, wbY, ramp) {
  if (relicActive) return relicArms(out, wbX, wbY, ramp); // the manifested relic replaces the gun in every hold state
  const gun = crystalGun ? PLUGS.bulwark.buildCrystalRifle() : weapon === 'pistol' ? PLUGS.viewmodel.selPistol() : weapon === 'lmg' ? PLUGS.viewmodel.selLMG() : weapon === 'launcher' ? PLUGS.launcher.buildLauncher() : weapon === 'sar' ? PLUGS.viewmodel.selSAR() : weapon === 'sniper' ? PLUGS.viewmodel.selSniper() : PLUGS.viewmodel.selRifle();
  const fc = FIRE[weapon] || FIRE.rifle;
  const a = action === 'reload' ? reloadAmt(reloadU, B.rDown, B.rUp) : 0; // reload pose blend (0 = held, 1 = at the mag)
  const gR = rotEuler(B.gunYaw / DEG + recoilYaw + a * B.rgYaw / DEG, B.gunPitch / DEG - recoil * fc.climb + a * B.rgPitch / DEG, B.gunRoll / DEG + a * B.rgRoll / DEG);
  const gT = [B.gunX + wbX + a * B.rgX, B.gunY + wbY + recoil * fc.rise + a * B.rgY, B.gunZ - recoil * fc.back + a * B.rgZ];
  const gsc = crystalGun ? B.scale * crystalGunScale : B.scale; // oversize the crystal rifle (crystalGunScale = the live, tuner-overridable size)
  const gx = (p) => gR(mul(p, gsc));
  if (crystalGun) { B.rifleMuzzle = add(gx(gun.muzzle), gT); B.rifleAim = gR([0, 0, 1]); } // body-local muzzle point + bore direction (the rifle tuner launches darts from here)
  let gunFaces = xformFaces(gun.faces, gx, gT);
  if (crystalGun && B.matRifle < 1) gunFaces = PLUGS.death.crystalDeathFaces(gunFaces, 1 - B.matRifle); // materialize: reversed shatter -> chunks converge + assemble
  out.push(...gunFaces);
  out.push(...xformFaces(PLUGS.attachments.equippedScopeFaces(gun, weapon), gx, gT)); // pooled scope attachment (if any), on the rail
  if (gun.charge) out.push(...xformFaces(gun.charge, gx, gT)); // charging handle (split out of faces; static in 3rd person)
  if (gun.slide) {
    const sl = slidePos * fc.slide; // slide racks back along the bore (-z gun-local) on fire
    out.push(...xformFaces(sl ? gun.slide.map((f) => ({ ...f, p: mapVerts(f.p, (p) => [p[0], p[1], p[2] - sl]) })) : gun.slide, gx, gT));
  }
  if (gun.mag) out.push(...xformFaces(gun.mag, gx, gT));
  if (gun.fwd) out.push(...xformFaces(gun.fwd, gx, gT)); // SAR forward assembly (barrel + foregrip + muzzle brake); static in 3rd person - the break-breech hinge is FP-only
  if (gun.bolt) out.push(...xformFaces(gun.bolt, gx, gT)); // Knell bolt carrier + charging handle (split out; static in 3rd person - the cycling is FP-only)
  if (crystalGun) { // bulwark crystal rifle: idol-style crystalline charge gather + fire burst at the muzzle (replaces the generic flash)
    if (bulwarkChargeAmt > 0.01 || bulwarkFireAmt > 0.01) { const fx = []; PLUGS.bulwark.buildBulwarkMuzzleFX(fx, gun.muzzle, [0, 0, 1], bulwarkChargeAmt, bulwarkFireAmt, bulwarkMfxCfg || undefined); out.push(...xformFaces(fx, gx, gT)); }
  } else if (muzzleT > 0) { const flash = []; buildFlash(flash, fc.muzzle, muzzleT * fc.flash, weapon); out.push(...xformFaces(flash, gx, gT)); }
  const place = (p) => add(gx(p), gT), gr = gun.grips.right, gl = gun.grips.left;
  const rRot = rotEuler(B.rhYaw / DEG, B.rhPitch / DEG, B.rhRoll / DEG), lRot = rotEuler(B.lhYaw / DEG, B.lhPitch / DEG, B.lhRoll / DEG);
  const rW = add(place(gr.wrist), gR([B.rhX, B.rhY, B.rhZ]));
  const lWgun = add(place(gl.wrist), gR([B.lhX, B.lhY, B.lhZ]));
  const lDet = a * B.lhDet, lW = lDet > 0 ? mad(lWgun, sub([B.lhfX, B.lhfY, B.lhfZ], lWgun), lDet) : lWgun; // support hand leaves the foregrip for the mag-well during reload
  const rFg = { curlMul: B.rfCurl, spread: B.rfSpread, len: B.rfLen, tcurl: B.rtCurl, tspread: B.rtSpread };
  const lFg = { curlMul: B.lfCurl, spread: B.lfSpread, len: B.lfLen, tcurl: B.ltCurl, tspread: B.ltSpread };
  const lws = weapon === 'pistol' ? -1 : 1; // pistol support hand wraps the opposite way
  const rJ = armToGrip(out, 1, rW, gR(rRot(gr.axis)), gR(rRot(gr.fwd)), 1, B.rCurl, true, [B.rPoleX, B.rPoleY, B.rPoleZ], B.rHandSize, rFg, ramp);
  const lJ = armToGrip(out, -1, lW, gR(lRot(gl.axis)), gR(lRot(gl.fwd)), lws, B.lCurl, false, [B.lPoleX, B.lPoleY, B.lPoleZ], B.lHandSize, lFg, ramp);
  return [{ side: 1, ...rJ }, { side: -1, ...lJ }]; // chest-local arm joints, for armor
}
// unarmed (melee enemies): the arms hang at the sides, no weapon. Reuses the rig's arm builder with a
// hanging wrist target so the hand drops naturally; returns the same chest-local joints (for armor/crystal).
// Pose + a possessed twitch come from B (set by buildBody): armX/Y/Z place the wrist, armCurl bends the
// elbow, armTwitch (0..1) jitters/spasms the hang. Defaults reproduce the original hang.
// Bulwark shielded stance: ONE hand grips the shield (left), the right arm hangs free + swings with the
// gait. ph = gait phase (drives sway/swing so it isn't static); fire = firing-pose blend 0..1 (the shield
// braces forward). The shield mount used by buildBulwarkShield must match the left grip (same sway/fire).
function bulwarkShieldArms(out, ramp, ph, fire) {
  const j = [], FG = { curlMul: 0.5, spread: 0.5, len: 0.6, tcurl: 0.5, tspread: 0.45 };
  const sway = 0.03 * Math.sin(ph), bob = 0.02 * Math.cos(2 * ph); // heavy carry sway/bob during the walk
  // LEFT arm grips the shield (its inner edge), braces forward when firing
  const lW = [-0.24 + sway, 1.26 + bob + fire * 0.05, 0.54 + fire * 0.2]; // hand sits behind the shield with a BENT elbow (not full reach); firing presents it forward
  j.push({ side: -1, ...armToGrip(out, -1, lW, [-1, 0, 0.25], [0, -1, 0.1], -1, 0.6, false, [-0.55, -0.65, -0.1], 0.26, FG, ramp) }); // pole drops the elbow down-out -> a braced bend
  // RIGHT arm hangs free, swinging opposite the stride
  const swing = 0.14 * Math.sin(ph + Math.PI);
  const rW = [0.34, 0.74 + swing * 0.25, 0.1 + swing];
  j.push({ side: 1, ...armToGrip(out, 1, rW, [1, 0, 0.1], [0, -1, 0.05], 1, 0.4, true, [0.3, -0.4, -0.55], 0.25, FG, ramp) });
  return j;
}

function armsDown(out, ramp) {
  const j = [], tw = B.armTwitch || 0, tt = B.t || 0;
  if (B.paperdoll && SPEC.armRows) { loftPair(out, tprism, X, Z, SPEC.armRows, ramp.SK, SPEC.armOverlay); return j; } // ROW TRACE: arms loft through measured per-row runs (+ optional additive tucked-hand overlay); hand geometry retires
  const ax = B.armX != null ? B.armX : 0.18, ay = B.armY != null ? B.armY : 0.9, az = B.armZ != null ? B.armZ : 0.06, cu = B.armCurl != null ? B.armCurl : 0.3;
  for (const side of [1, -1]) {
    // possessed twitch: constant micro-tremor + occasional sharp per-arm spasm spikes
    const sp = Math.max(0, hn(Math.floor(tt * 2.3) * 7.7 + side * 13) - 0.62) * 2.6;
    const jx = tw * (hnz(tt * 9.1 + side * 3) * 0.04 + sp * hnz(Math.floor(tt * 2.3) + side) * 0.16);
    const jy = tw * (hnz(tt * 7.7 + side * 5) * 0.035 + sp * 0.12);
    const jz = tw * (hnz(tt * 11.3 + side) * 0.04 + sp * hnz(Math.floor(tt * 2.3) * 3 + side) * 0.12);
    let wy = ay + jy, wz = az + jz;
    if (B.ravagerRecoil) { // the firing gun-blade's recoil is absorbed by the ARM: the hand kicks back toward the body + climbs, and the two-bone IK flexes to follow
      const rr = side > 0 ? (B.ravagerRecoil.R || 0) : (B.ravagerRecoil.L || 0), rg = B.ravagerGun || {};
      wy += (rg.recoilRise != null ? rg.recoilRise : 0.05) * rr; // muzzle climbs
      wz -= (rg.recoilKick != null ? rg.recoilKick : 0.09) * rr; // hand kicks back toward the shoulder
    }
    const po = B.paperdoll ? (side > 0 ? B.paperdoll.armR : B.paperdoll.armL) || {} : {}; // per-arm overrides: the classic paperdoll arms are ASYMMETRIC (contrapposto)
    const wrist = [side * (po.x ?? ax) + jx, po.y ?? wy, po.z ?? wz];
    const r = armToGrip(out, side, wrist, [side, 0, 0.1], [0, -1, 0.05], side > 0 ? 1 : -1, po.curl ?? cu, side > 0, [side * (po.poleX ?? 0.3), -0.4, -0.55], 0.25, { curlMul: 0.5, spread: 0.5, len: 0.6, tcurl: 0.5, tspread: 0.45 }, ramp);
    j.push({ side, ...r });
  }
  return j;
}
// Flicker combat: pose each blade-arm INDEPENDENTLY from a per-side pose { x, y, z, curl, roll } (absolute
// wrist target, NOT mirrored), so one blade can slash while the other guards or winds for the next hit.
// Returns joints with per-arm roll attached for buildFlickerBlades. L / R = the figure's left (side -1) /
// right (side +1) arm.
function flickerArmsPosed(out, ramp, L, R) {
  const j = [], FG = { curlMul: 0.5, spread: 0.5, len: 0.6, tcurl: 0.5, tspread: 0.45 };
  for (const side of [1, -1]) {
    const p = (side > 0 ? R : L) || { x: side * 0.56, y: 0.95, z: 0.2, curl: 0.42, roll: 0 };
    const r = armToGrip(out, side, [p.x, p.y, p.z], [side, 0, 0.1], [0, -1, 0.05], side > 0 ? 1 : -1, p.curl, side > 0, [side * 0.3, -0.4, -0.55], 0.25, FG, ramp);
    j.push({ side, roll: p.roll || 0, ...r });
  }
  return j;
}
function gaitFoot(side, phase) { // omnidirectional: the stride runs along the local move direction (fwd/back/lateral/diagonal), matching the FP legs
  const SFRAC = 0.6 - B.run * 0.25, ankleH = 0.06, s = side < 0 ? 1 : 0; // run shortens the stance -> flight phase
  const fn = ((((phase + (s ? Math.PI : 0)) % TAU) + TAU) % TAU) / TAU, moving = B.strideAmp > 1e-4;
  const dx = B.moveDir[0], dz = B.moveDir[1]; // unit local move dir; [0,1] = straight ahead
  let along = 0, lift = 0, fp = 0;
  if (moving) {
    if (fn < SFRAC) { const u = fn / SFRAC; along = B.strideAmp * (1 - 2 * u); }
    else { // swing: run reshapes it into a knee-drive recovery (lingers back, whips forward, heel folds up)
      const u = (fn - SFRAC) / (1 - SFRAC), au = u * (1 - B.run) + u * u * B.run, drive = Math.sin(u * Math.PI);
      along = B.strideAmp * (2 * au - 1); lift = Math.pow(drive, 0.8) * B.liftAmp + B.run * 0.24 * Math.pow(drive, 0.5); fp = (-0.4 - B.run * 0.45) * drive * dz;
    }
  }
  const centerFwd = moving ? 0.04 : 0.02;
  return { F: [side * SPEC.hipX + dx * along, ankleH + lift, centerFwd + dz * along], fp };
}
function bodyLeg(out, side, hipW, F, fp, ramp, legLen = 1) {
  const { SK, SKL, SKM, SKD } = ramp;
  if (B.paperdoll && SPEC.legRows) { // ROW TRACE: the classic legs loft through their measured per-row runs (geometry + stance in one; IK cannot produce the free leg's outward flare)
    const rows = side < 0 ? SPEC.legRows.neg : SPEC.legRows.pos;
    loftTorso(out, tprism, X, Z, rows, SK); // the trace runs through the FOOT rows - buildFoot retires (the classic boot, oblique and all, is in the data)
    const a = rows[rows.length - 1], h = rows[0], m = rows[(rows.length / 2) | 0];
    return { side, hip: [h.cx, h.y, 0], knee: [m.cx, m.y, 0], ankle: [a.cx, a.y, 0], fp };
  }
  const tr = SPEC.leg.thighR ?? 1, cr = SPEC.leg.calfR ?? 1, sr = 0.078 * cr;
  const [knee, ankle] = solveTwoBone(hipW, F, SPEC.leg.thigh * legLen, SPEC.leg.calf * legLen, [0, 0, 1]);
  const thighDir = norm(sub(knee, hipW)), calfDir = norm(sub(ankle, knee));
  rseg(out, mad(hipW, thighDir, -0.06), mad(hipW, thighDir, 0.215), X, 0.09 * tr, 0.0828 * tr, 0.115 * tr, 0.10925 * tr, 10, CLOTH);
  rseg(out, hipW, knee, X, 0.08 * tr, 0.0848 * tr, sr * 1.06, sr * 0.92, 8, SK);
  rseg(out, knee, ankle, X, sr * 1.02, sr * 0.96, sr * 0.82, sr * 0.78, 8, SK);
  rseg(out, mad(knee, [0, 1, 0], -0.05), mad(knee, [0, 1, 0], 0.05), Z, 0.074, 0.074, 0.074, 0.074, 9, SKL);
  rseg(out, mad(knee, calfDir, 0.13), mad(knee, calfDir, 0.2), X, sr, sr * 0.94, sr * 0.97, sr * 0.9, 8, SKD);
  rseg(out, mad(ankle, calfDir, -0.1), mad(ankle, calfDir, -0.03), X, sr * 0.85, sr * 0.8, sr * 0.82, sr * 0.76, 8, SKD);
  buildFoot(out, ankle, fp, { ankleH: SPEC.foot?.ankleH ?? 0.06, footL: SPEC.foot?.footL ?? 0.18, yaw: (B.paperdoll?.footYaw ?? 0) * side, SK, SKL, SKM, SKD }); // paperdoll splay, fit downstream
  return { side, hip: hipW, knee, ankle, fp }; // world-space joints (+foot pitch), for armor (side ignored there) + husk crystals/attire
}
function mantleArm(out, side, shoulder, target, ramp) {
  const { SK, SKL, SKM, SKD } = ramp;
  const [elbow, wrist] = solveTwoBone(shoulder, target, 0.385, 0.335, [side * 0.7, 0.3, 0.7]); // elbow out + forward for the climb
  rseg(out, shoulder, elbow, Z, 0.076, 0.0707, 0.068, 0.0639, 8, SK);
  rseg(out, mad(elbow, [0, 1, 0], -0.04), mad(elbow, [0, 1, 0], 0.04), Z, 0.07, 0.07, 0.07, 0.07, 9, SK);
  forearm(out, elbow, wrist, 0.073, 0.038, SK, SKD);
  const axis = norm(sub(target, shoulder)); // hand points at the ledge
  hand(out, { axis, fwd: [0, -1, 0], wrist, wrapSign: 1, mirror: side < 0, size: 0.24, curl: 1.7, curlMul: 1, fingerSpread: 0.3, fingerLen: 0.62, thumbCurl: 1.4, thumbSpread: 0.4, color: SK, colorL: SKL, colorM: SKM, colorD: SKD }); // grip over the edge
  return { shoulder, elbow, wrist }; // world-space joints, for armor
}
function mantleFoot(side, u) {
  const lift = smooth(Math.min(1, u / 0.72)); // feet rise from dangle to the ledge top
  const tuck = Math.sin(Math.PI * Math.min(1, u / 0.85)) * 0.18; // knees tuck up mid-climb
  const y = MANTLE.footHangY + (MANTLE.footPlantY - MANTLE.footHangY) * lift + tuck;
  const z = MANTLE.footFwd0 + (MANTLE.footPlantZ - MANTLE.footFwd0) * smooth(Math.max(0, (u - 0.4) / 0.6));
  return [side * 0.15, y, z];
}
// ── holstered weapon: the loadout slot NOT in hand, shown on the body, riding the rig frames.
//    large guns sling diagonally across the back (chest frame); small arms ride the thigh (pelvis). ──
const HOLSTER = {
  // the rifle clears the cape from a higher/further-out perch, so it has a per-cape placement;
  // the pistol rides low under the cape line and uses one placement either way.
  rifle: {
    caped: { x: 0.05, y: 1.46, z: -0.34, yaw: 60, pitch: 120, roll: -45 },
    bare: { x: -0.01, y: 1.47, z: -0.24, yaw: 60, pitch: 93, roll: -45 },
  },
  pistol: { x: 0.07, y: 1.02, z: -0.17, yaw: 77, pitch: 73, roll: -18 },
  lmg: {
    caped: { x: 0.05, y: 1.46, z: -0.33, yaw: 48, pitch: 114, roll: -36, scale: 0.155 },
    bare: { x: -0.01, y: 1.47, z: -0.24, yaw: 60, pitch: 93, roll: -45 },
  },
  launcher: { // the Sunder is a long tube - slings across the back; the caped variant is pushed out + re-angled to clear the cape (bare mirrors the LMG)
    caped: { x: 0.02, y: 1.56, z: -0.42, yaw: 60, pitch: 108, roll: -28, scale: 0.13 },
    bare: { x: -0.01, y: 1.48, z: -0.24, yaw: 60, pitch: 93, roll: -45, scale: 0.13 },
  },
  sniper: { // the Knell is a long rifle - slings across the back on the rifle's placement, scaled so its footprint matches the rifle's
    caped: { x: 0.05, y: 1.46, z: -0.34, yaw: 60, pitch: 120, roll: -45, scale: 0.12 },
    bare: { x: -0.01, y: 1.47, z: -0.24, yaw: 60, pitch: 93, roll: -45, scale: 0.12 },
  },
};
const HOL_SCALE = 0.16;
let HP = HOLSTER, holsterShown = true, capeWorn = false;
const gunSolid = (g) => [...g.faces, ...(g.slide || []), ...(g.charge || []), ...(g.mag || []), ...(g.fwd || []), ...(g.bolt || [])]; // the whole weapon, no muzzle flash
function renderHolster(out, C) {
  const stowed = weapon === 'pistol' ? lastHeavy : 'pistol'; // pistol is the secondary; the equipped Heavy (LMG or Launcher) rides the back when the sidearm is out
  const g = stowed === 'pistol' ? PLUGS.viewmodel.selPistol() : stowed === 'lmg' ? PLUGS.viewmodel.selLMG() : stowed === 'launcher' ? PLUGS.launcher.buildLauncher() : stowed === 'sniper' ? PLUGS.viewmodel.selSniper() : PLUGS.viewmodel.selRifle();
  const slot = stowed === 'pistol' ? HP.pistol : HP[stowed][capeWorn ? 'caped' : 'bare']; // the long guns adapt to the cape
  const sc = slot.scale || HOL_SCALE;
  const R = rotEuler(slot.yaw / DEG, slot.pitch / DEG, slot.roll / DEG);
  const gx = (p) => R(mul(p, sc));
  out.push(...C.faces(xformFaces(gunSolid(g), gx, [slot.x, slot.y, slot.z]))); // stowed weapon rides the back (chest frame)
}

// ── armor / outfit: layered over the posed rig, driven by its solved joints + frames.
//    reskin recolors the bare body to the undersuit; plates render per equipped piece. ──
const ARMOR_SPEED = { stand: 0, walk: 0.4, run: 1, slide: 0.7, crouch: 0, strafe: 0.5 };
function renderArmor(out, P, C, armJoints, legJoints, eq, t, phi, speed, armWorld = false, air = 0, headFrame = null) {
  B.rig = { P, C, armJoints, legJoints, armWorld, headFrame, t, phi, speed, air }; // expose the solved rig so the armor lab can ride the real bones (the outfit can't drift off the body)
  if (holsterShown) renderHolster(out, C); // the stowed weapon rides the back regardless of armor
  if (!eq) return;
  const pal = PLUGS.armor.SHADERS[eq.shader] || PLUGS.armor.SHADERS.ranger;
  PLUGS.armor.reskin(out, pal); // bare skin + base cloth -> undersuit, so the plates sit over a covered body
  const O = PLUGS.armor.OUTFITS[eq.set] || PLUGS.armor.OUTFITS.outfit1; // registry: one builder set per slot, so a new outfit is one entry (no branch here)
  const cfs = []; // chest-local group (rides C): chest + pauldrons, plus the hood / arms for sets that ride the chest
  if (eq.helmet && O.helmet) { if (O.helmetRidesHead) { const fs = []; O.helmet(fs, pal); out.push(...C.faces(headFrame ? headFrame.faces(fs) : fs)); } else O.helmet(cfs, pal); } // a helmet tracks the head frame (look pitch); a hood rides the chest
  if (eq.chest && O.chest) O.chest(cfs, pal);
  if (eq.pauldrons && O.pauldrons) for (const s of [1, -1]) O.pauldrons(cfs, pal, s);
  if (eq.arms && armJoints && O.arms && O.armsLocal && !armWorld) for (const a of armJoints) O.arms(cfs, pal, a.side, a.shoulder, a.elbow, a.wrist); // chest-local arms: cloth wraps whose accents ride the chest
  out.push(...C.faces(cfs));
  if (eq.arms && armJoints && O.arms && (!O.armsLocal || armWorld)) for (const a of armJoints) { const w = armWorld ? a : { shoulder: C.pt(a.shoulder), elbow: C.pt(a.elbow), wrist: C.pt(a.wrist) }; O.arms(out, pal, a.side, w.shoulder, w.elbow, w.wrist); } // world arms: plate, or any set during action poses where the joints are already world
  if (eq.legs && legJoints && O.legs) for (const l of legJoints) O.legs(out, pal, l.hip, l.knee, l.ankle); // world joints
  if (eq.cape && O.cape) O.cape(out, pal, C.pt, { t, phi, speed, air, ...eq.capeOpts }); // capeOpts/scarfOpts: optional live tuning (the armor lab's sliders); absent in-game -> baked defaults
  if (eq.scarf && O.scarf) O.scarf(out, pal, P.pt, { t, phi, speed, air, ...eq.scarfOpts });
}

// The Husk treatment, applied in the rig's OWN posed frames (mirrors renderArmor) so every crystal
// tracks: the body is drained to ashen, then head/torso/arm decorations build in chest-local + ride
// the chest frame C, and the leg crystals/nubs build on the already-world solved leg joints. Arm
// joints are chest-local here (armWorld for the vault, whose arm joints are already world).
function renderHusk(out, P, C, H, armJoints, legJoints, armWorld = false) {
  const fit = PLUGS.husk.huskOutfit(huskSeed);    // randomised scrap colours (per-enemy seed)
  PLUGS.husk.huskReskin(out);                     // drain the posed body to gaunt grey flesh (frame-agnostic)
  if (huskBare) return;                // gait-clarity mode: bare deformed body only
  const df = []; PLUGS.husk.buildHuskHunch(df, PLUGS.husk.HUSK); PLUGS.husk.buildHuskTorso(df, PLUGS.husk.HUSK); out.push(...C.faces(df)); // DEFORMATION: hunch + ribs/spine/lumps (chest frame)
  if (!armWorld && armJoints) { const af = []; PLUGS.husk.buildHuskArms(af, PLUGS.husk.HUSK, armJoints); out.push(...C.faces(af)); } // gnarled arms + claws
  if (armWorld && armJoints) PLUGS.husk.buildHuskArms(out, PLUGS.husk.HUSK, armJoints);
  if (ravagerGuns && armJoints) { // Ravager: a crystalline gun-blade gripped in each hand, riding the IK wrists
    if (!armWorld) { const gf = []; const mz = PLUGS.ravager.buildRavagerHandguns(gf, PLUGS.ravager.RAVAGER, armJoints, B.ravagerGun, B.ravagerRecoil); out.push(...C.faces(gf)); B.ravagerMuzzles = mz.map((m) => ({ p: C.pt(m.p), side: m.side })); } // chest-local tip -> body-local
    else { const mz = PLUGS.ravager.buildRavagerHandguns(out, PLUGS.ravager.RAVAGER, armJoints, B.ravagerGun, B.ravagerRecoil); B.ravagerMuzzles = mz.map((m) => ({ p: m.p, side: m.side })); } // already world/body-local
  }
  if (ravagerGuns && B.ravagerShroud !== false) { // crystal shroud off the back, body-local so it crystallises + shatters WITH the body
    const shSpeed = Math.min(1, (B.strideAmp || 0) * 2.2);
    PLUGS.ravager.buildRavagerShroud(out, C.pt, { t: B.t || 0, phi: (B.t || 0) * 6.0, speed: shSpeed, air: 0, ...(typeof B.ravagerShroud === 'object' ? B.ravagerShroud : {}) });
  }
  if (legJoints) PLUGS.husk.buildHuskLegs(out, PLUGS.husk.HUSK, legJoints);                                          // gaunt legs + toe claws (world joints)
  const sf = []; PLUGS.husk.buildHuskScraps(sf, fit); out.push(...C.faces(sf));                            // SCRAPS: torn cloth on the torso (chest frame)
  const wr = []; PLUGS.husk.buildHuskWaistRag(wr, fit); out.push(...P.faces(wr));                          // tattered waist rag (pelvis frame)
  if (legJoints) PLUGS.husk.buildHuskThighScrap(out, legJoints, fit);                                      // a thigh scrap (world joints)
  const ef = []; PLUGS.husk.buildHuskEyes(ef, PLUGS.husk.HUSK); out.push(...C.faces(H ? H.faces(ef) : ef));           // glowing red eyes (ride the tilted head)
  if (huskNoCrys) return;              // debug/tuner: deformed body, crystals off
  if (ravagerGuns) PLUGS.ravager.buildRavagerHood(out, C.pt, typeof B.ravagerHood === 'object' ? B.ravagerHood : {}); // Ravager: a ragged crystal hood on the chest frame (the head tilts inside it), in place of the husk skull-crystal
  else { const hf = []; PLUGS.husk.buildHeadCrystal(hf, PLUGS.husk.HUSK); out.push(...C.faces(H ? H.faces(hf) : hf)); } // head crystal rides the tilted head
  const cf = []; // chest-frame: torso growths/nubs + the chest-local arm crystals/nubs
  PLUGS.husk.buildCrystalGrowths(cf, PLUGS.husk.HUSK);
  PLUGS.husk.pepperTorso(cf, PLUGS.husk.HUSK);
  if (!armWorld && armJoints) { PLUGS.husk.buildArmCrystals(cf, PLUGS.husk.HUSK, armJoints); PLUGS.husk.pepperArms(cf, PLUGS.husk.HUSK, armJoints); }
  out.push(...C.faces(cf));
  if (armWorld && armJoints) { PLUGS.husk.buildArmCrystals(out, PLUGS.husk.HUSK, armJoints); PLUGS.husk.pepperArms(out, PLUGS.husk.HUSK, armJoints); } // already-world joints
  if (legJoints) { PLUGS.husk.buildLegCrystals(out, PLUGS.husk.HUSK, legJoints); PLUGS.husk.pepperLegs(out, PLUGS.husk.HUSK, legJoints); } // world joints
}

const BULWARK_HUNCH = 0.12; // a heavy forward lean baked into the chest - the mass carries forward
const BULWARK_SCALE = 1.2;  // the Bulwark is a major - markedly larger than the Husk/player; scaled about the feet
const CRYSTAL_GUN_SCALE = 1.6; // the crystallized rifle is oversized - scaled up (geometry + grips) so the hands still hold it
let crystalGunScale = CRYSTAL_GUN_SCALE; // live value used by the render; buildBody resets it from the spec each call (CRYSTAL_GUN_SCALE unless a tuner passes crystalGunScale) so the bulwark-anim lab can preview a dialed size before it's baked
const BULWARK_LEG_LIFT = 0.28; // raise the whole body so the (lengthened) legs read longer with feet still planted
const FLICKER_SCALE_Y = 1.16, FLICKER_SCALE_XZ = 0.82; // the Flicker is taller than the Husk but THIN - stretched up + drawn in (gaunt/consumed), not a hulking mass like the Bulwark
const FLICKER_PULSE = 2.0; // rad/s - the purple crystal glows brighter/dimmer on this slow clock ("pulsing purple"); ~3s period

// Flicker treatment (mirrors renderHusk): drain the rig to gaunt flesh, then NO head / NO eyes / NO head
// crystal - a scattered crystal CLUSTER where the skull was; both arms REPLACED by crystal BLADES; the torso
// + legs densely peppered + consumed. All PURPLE (P = FLICKER). The gaunt hunch + idle breathe/shift/
// convulsion come from the shared figure() path (isFlicker), the same as the Husk.
function renderFlicker(out, P, C, H, armJoints, legJoints, armWorld = false) {
  const PAL = PLUGS.flicker.FLICKER; // the P param is the pelvis frame (dispatch parity with renderHusk); colors come from the FLICKER palette
  const cfg = B.flickerCfg || {}; // tuner dials (blades / cluster / consumption); empty = the baked defaults
  // the PULSE: the purple crystal glows brighter + dimmer on a slow clock (the flicker is "pulsing purple").
  // only the crystal pulses - the gaunt flesh body is steady. CRYSTAL is a brightness-modulated FLICKER.
  const f = 0.82 + 0.36 * (0.5 + 0.5 * Math.sin((B.t || 0) * FLICKER_PULSE));
  const pul = (c) => [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f))];
  const CRYSTAL = { ...PAL, crystal: pul(PAL.crystal), crystalL: pul(PAL.crystalL), crystalD: pul(PAL.crystalD), glow: pul(PAL.glow) };
  PLUGS.husk.huskReskin(out, { SK: PAL.flesh, SKL: PAL.fleshL, SKM: PAL.fleshM, SKD: PAL.fleshD }); // drain the posed body to gaunt flesh (steady, no pulse)
  const df = []; PLUGS.husk.buildHuskHunch(df, PAL); PLUGS.husk.buildHuskTorso(df, PAL); out.push(...C.faces(df)); // gaunt ribbed/consumed torso (flesh, chest frame)
  if (legJoints) PLUGS.husk.buildHuskLegs(out, PAL, legJoints);                                        // gaunt legs (flesh, world joints)
  const hf = []; if (B.idol) PLUGS.idol.buildIdolHead(hf, CRYSTAL, PLUGS.idol.IGLOW, cfg); else PLUGS.flicker.buildFlickerHeadCluster(hf, CRYSTAL, cfg); out.push(...C.faces(H ? H.faces(hf) : hf)); // Idol: an iconic sensor-crowned head; Flicker: the headless scattered-crystal cluster (both pulsing)
  const cf = []; // chest-frame: the flicker's own torso consumption + fine pepper (pulsing)
  PLUGS.flicker.buildFlickerConsumption(cf, CRYSTAL, cfg);
  PLUGS.husk.pepperTorso(cf, CRYSTAL);
  out.push(...C.faces(cf));
  // the blade-arms, optionally DEMATERIALIZING (the displaced blink dissolve - PURPLE shards, not the husk-white
  // crystallize). demat 0 = solid blades, 1 = scattered into thin air; the caller reverses it to rematerialize.
  if (armJoints) {
    const blink = B.flickerDemat || 0; // the whole-flicker blink dissolve (applies to every blade / the emitter)
    if (B.idol) { // Idol: the two arms FUSE into one forward beam emitter (no slashing blades)
      const bf = []; const mz = PLUGS.idol.buildIdolEmitter(bf, CRYSTAL, armJoints, B.idolEmitter); // the merged emitter, built from both IK arm joints at once; returns the muzzle (lens tip)
      out.push(...(armWorld ? bf : C.faces(bf)));
      B.idolMuzzle = armWorld ? mz : C.pt(mz); // chest-local lens tip -> body-local; the beam + muzzle FX mount here (scaled with the body below)
      // the Idol's blink is a whole-body reposition teleport - it dissolves EVERYTHING together (below), not per-limb
    } else for (const a of armJoints) {
      const i = a.side > 0 ? 1 : 0; // R = 1, L = 0
      if (B.armGone && B.armGone[i]) continue; // Slice 2: a fully-shattered blade-arm draws nothing
      const dm = Math.max(blink, B.armDemat ? B.armDemat[i] : 0); // the blink dissolve OR this arm's shatter/regrow dissolve, whichever is further along
      let bf = []; PLUGS.flicker.buildFlickerBlades(bf, CRYSTAL, [a], cfg, B.flickerRoll || 0); // this arm's blade rides its IK joint; roll = wrist/hand rotation
      if (dm > 0) bf = PLUGS.death.flickerDematFaces(bf, dm, CRYSTAL, { cell: 0.13 }); // dissolve IN PLACE - full crystallize+tumble+spark fidelity, finer cell for the thin blades
      out.push(...(armWorld ? bf : C.faces(bf))); // chest-local joints route through C; world-joint paths place directly
    }
  }
  if (legJoints) { PLUGS.husk.buildLegCrystals(out, CRYSTAL, legJoints); PLUGS.husk.pepperLegs(out, CRYSTAL, legJoints); }   // peppered/consumed legs (pulsing, world joints)
  // DEATH shatters the whole body (the husk-style exploding crystal-death via flickerBurst, no longer dissolving in place). The Idol
  // ALSO blinks as one whole body - its reposition teleport dissolves everything together (the melee Flicker instead
  // blinks per-blade above). 0 = solid, 1 = gone. Whichever dissolve is further along wins.
  const whole = Math.max(B.flickerDeath || 0, B.idol ? (B.flickerDemat || 0) : 0);
  if (whole > 0) { const dis = B.flickerBurst ? PLUGS.death.crystalDeathFaces(out, whole, PLUGS.death.CRYSTAL_DEATH, CRYSTAL) : PLUGS.death.flickerDematFaces(out, whole, CRYSTAL); out.length = 0; out.push(...dis); } // DEATH (flickerBurst): the husk-style exploding shatter, kept in the flicker's PURPLE; blink/spawn: dematerialize in place (no outward launch)
}

// Bulwark treatment (mirrors renderHusk): drain the rig + limbs to flesh, slab on the heavy flesh mass +
// crystal distortions (chest frame), and grow the bulging crystal head (head frame). No gaunt deform - the
// opposite of the Husk: this body is a hulking mass. The crystal head replaces the skull (no human head is
// drawn by the caller). Shield + rifle are layered on by enemy.js, not here.
function renderBulwark(out, P, C, H, armJoints, legJoints, shieldHP = 1, ph = 0, fire = 0, demat = 0, t = 0) {
  PLUGS.husk.huskReskin(out); // bare rig + limbs -> ashen flesh
  PLUGS.bulwark.buildBulwarkLegBulk(out, legJoints || []);                               // heavy muscled legs (world joints, follow the gait)
  { const fs = []; PLUGS.bulwark.buildBulwarkArmBulk(fs, armJoints || []); out.push(...C.faces(fs)); } // heavy muscled arms (chest-local joints)
  { const fs = []; PLUGS.bulwark.buildBulwarkBulk(fs); out.push(...C.faces(fs)); }       // the flesh mass
  { const fs = []; PLUGS.bulwark.buildBulwarkCrystals(fs); out.push(...C.faces(fs)); }   // smaller crystal distortions
  { const fs = []; PLUGS.bulwark.buildBulwarkHead(fs); out.push(...C.faces(H.faces(fs))); } // bulging crystal head (rides the head tilt frame)
  if (shieldHP >= 0) {
    let fs = []; PLUGS.bulwark.buildBulwarkBubble(fs, shieldHP, t, fire); // crystalline bubble ENCLOSING the figure, rippling on t; core/muzzle on the front
    if (demat > 0) fs = PLUGS.death.crystalDeathFaces(fs, demat); // core-break: crystallize -> shatter into thin air; reform: the reverse (demat 1 -> 0)
    const inv = 1 / BULWARK_SCALE; fs = fs.map((f) => ({ ...f, p: mapVerts(f.p, (v) => [v[0] * inv, v[1] * inv, v[2] * inv]) })); // the whole bulwark body is scaled by BULWARK_SCALE after this; the bubble is tuned at 1.0x (the tuner overlays it unscaled, and the weakpoint/muzzle/hitbox use raw coreZ), so pre-divide it to land at 1.0x rather than inheriting the major's 1.2x
    out.push(...fs); // body-local (NOT C.faces): the bubble surrounds the whole body + holds steady, it is not parented to the chest
  }
}

function figure(phase, eq, t) {
  if (action === 'mantle') {
    const ramp = skinRamp(0.89), u = mantleU;
    const eUp = smooth(u); // rise spread across the climb
    const eFwd = smooth(Math.max(0, (u - 0.4) / 0.6)); // forward onto the top, later
    const rise = MANTLE.rise * eUp, fwd = MANTLE.fwd * eFwd;
    const lean = (MANTLE.lean / DEG) * Math.sin(Math.PI * Math.min(1, u / 0.86)); // lean into the pull, straighten on top
    const rel = smooth(Math.max(0, (u - 0.5) / 0.5)); // hands let go of the ledge as the body stands
    const P = mkFrame(0, 0, 0, [0, SPEC.pelvisY, 0], [0, 0, 0]); // vault (rise + fwd) is the game's pos/jumpY; rise/fwd below only offsets the feet under the fixed pelvis
    const C = compose(P, mkFrame(0, lean, 0, [0, 1.0, 0], [0, 0, 0]));
    const out = [];
    { const fs = []; trunkLower(fs); out.push(...P.faces(fs)); }
    { const fs = []; trunkUpper(fs, ramp); out.push(...C.faces(fs)); }
    const armJoints = [];
    for (const side of [1, -1]) {
      const sh = C.pt([side * 0.235, 1.5, 0]);
      const ledge = [side * MANTLE.ledgeX, MANTLE.ledgeY, MANTLE.ledgeZ];
      const neutral = [sh[0] + side * 0.12, sh[1] - 0.62, sh[2] + 0.18]; // arm comes to rest at the side
      const target = [ledge[0] + (neutral[0] - ledge[0]) * rel, ledge[1] + (neutral[1] - ledge[1]) * rel, ledge[2] + (neutral[2] - ledge[2]) * rel];
      if (!(SPEC.hairRows && SPEC.armRows)) { const capFs = []; const dv = SPEC.deltoid; rseg(capFs, [side * dv.x0, dv.y0, 0], [side * dv.x1, dv.y1, 0], Z, dv.rU0, dv.rV0, dv.rU1, dv.rV1, 8, ramp.SK); out.push(...C.faces(capFs)); } // deltoid cap rides the chest - retires under a full trace (the hair/traps + arm rows carry the shoulder silhouette; the cap doubles it and blotches the arm gap)
      armJoints.push({ side, ...mantleArm(out, side, sh, target, ramp) });
    }
    const legJoints = [];
    for (const side of [1, -1]) { const mf = mantleFoot(side, u); legJoints.push(bodyLeg(out, side, P.pt([side * SPEC.hipX, SPEC.pelvisY, 0]), [mf[0], mf[1] - rise, mf[2] - fwd], 0, ramp)); } // feet offset down/back by the suppressed rise: dangle below, then plant level with the (game-vaulted) pelvis
    renderArmor(out, P, C, armJoints, legJoints, eq, t, 0, 0.2, true); // arm joints are world-space here (the arms reach the ledge)
    return out;
  }
  if (action === 'jump' || action === 'djump') {
    const ramp = skinRamp(0.89), u = jumpU, dbl = action === 'djump';
    const TUCK = dbl ? J2_TUCK : J_TUCK, PIT = dbl ? J2_PIT : J_PIT, PELY = dbl ? J2_PELY : J_PELY, ARM = dbl ? J2_ARM : J_ARM; // the second jump gets its own snappier push
    const S = JUMP_SCALE; // jump feel scales (1 = baked); split stretch/absorb on the pelvis + arch/fold on the torso so each is its own dial
    const pelyR = kf(u, PELY), pely = pelyR >= 0 ? pelyR * S.stretch : pelyR * S.absorb; // up off the launch (stretch) vs the land-absorb drop
    const pitR = kf(u, PIT), pit = (pitR <= 0 ? pitR * S.arch : pitR * S.fold) / DEG;     // launch arch-back vs land fold-forward
    const arm = kf(u, ARM) * S.arm;
    const airSgn = Math.max(-1, Math.min(1, (0.5 - u) * 2)); // +1 launch -> 0 apex -> -1 fall: drives the cape/scarf billow
    const P = mkFrame(0, pit * 0.35, 0, [0, SPEC.pelvisY, 0], [0, pely, 0]);  // pelvis tilts + stretches up off the launch / drops to absorb the landing
    const C = compose(P, mkFrame(0, pit, 0, [0, 1.0, 0], [0, 0, 0])); // spine arches back launching, folds forward to absorb
    const out = [];
    { const fs = []; trunkLower(fs); out.push(...P.faces(fs)); }
    { const fs = []; trunkUpper(fs, ramp); out.push(...C.faces(fs)); }
    let armJoints = null; const legJoints = [];
    { const fs = []; armJoints = gunAndArms(fs, 0, arm, ramp); out.push(...C.faces(fs)); } // gun lifts off the launch, settles into the absorb
    // ── asymmetric legs: the +x leg leads (fixed). Each leg samples the arc at its own phase, tucks to its
    //    own height + splay, and plants staggered, so the tuck reads natural instead of two legs glued together. ──
    const LEAD = 1, PH = 0.035, SPLAY = 0.05, STAGZ = 0.09;
    const absorb = smooth(Math.max(0, Math.min(1, (u - 0.70) / 0.25))); // landing-absorb ramp (staggers the plant)
    for (const side of [1, -1]) {
      const lead = side === LEAD;
      const uS = Math.max(0, Math.min(1, u + (lead ? PH : -PH)));      // lead leg runs a hair ahead through the arc
      const tuckS = kf(uS, TUCK) * S.tuck * (lead ? 1.06 : 0.85);    // lead knee drives higher; trail tucks looser
      const hipW = P.pt([side * SPEC.hipX, SPEC.pelvisY, 0]);
      const footX = side * (0.14 + SPLAY * tuckS);                    // knees splay apart through the tuck
      const footY = 0.06 + 0.68 * tuckS;
      const footZ = 0.04 + kf(uS, J_FWD) * S.reach + (lead ? 1 : -1) * STAGZ * absorb; // staggered plant: lead foot forward, trail back
      legJoints.push(bodyLeg(out, side, hipW, [footX, footY, footZ], kf(uS, J_FP), ramp));
    }
    renderArmor(out, P, C, armJoints, legJoints, eq, t, 0, 0.3, false, airSgn);
    return out;
  }
  // ── husk quadruped leap: a bespoke pounce path (parallels the jump). huskLeap drives the pelvis
  //    rise/drop + forward travel, the torso dive + fold, the per-leg coil->tuck->plant, the foot pitch
  //    and the arm reach (front legs); then the husk treatment is layered on (renderHusk). ──
  if (eq && eq.husk && action === 'leap') {
    const ramp = skinRamp(0.89), u = leapU, g = B.leapCfg || PLUGS.husk.HUSK_LEAP;
    const lp = PLUGS.husk.huskLeap(u, PLUGS.husk.HUSK_ARMS, g);
    const P = mkFrame(0, lp.pitch * 0.32, 0, [0, SPEC.pelvisY, 0], [0, lp.pelY, lp.fwd]); // pelvis: rise/drop + travel, tips into the dive
    const C = compose(P, mkFrame(0, lp.pitch + lp.fold, 0, [0, 1.0, 0], [0, 0, 0])); // chest dives forward + folds
    const out = [];
    { const fs = []; trunkLower(fs); out.push(...P.faces(fs)); }
    { const fs = []; trunkUpper(fs, ramp); out.push(...C.faces(fs)); }
    B.armX = lp.armX; B.armY = lp.armY; B.armZ = lp.armZ; B.armCurl = lp.armCurl; B.armTwitch = lp.armTwitch; // arms reach to plant
    let armJoints = null; const legJoints = [];
    { const fs = []; armJoints = armsDown(fs, ramp); out.push(...C.faces(fs)); }
    // legs coil/tuck/plant, staggered + splayed per side (the lead leg drives a hair harder)
    const SPLAY = 0.06, STAG = 0.05, tuckAmt = Math.max(0, lp.footY - 0.06);
    for (const side of [1, -1]) {
      const lead = side === 1;
      const hipW = P.pt([side * SPEC.hipX, SPEC.pelvisY, 0]);
      const footX = side * (0.14 + SPLAY * Math.min(1, tuckAmt * 2.6));
      const footY = 0.06 + tuckAmt * (lead ? 1.05 : 0.88);
      const footZ = lp.fwd + lp.footFwd + (lead ? 1 : -1) * STAG * tuckAmt;
      legJoints.push(bodyLeg(out, side, hipW, [footX, footY, footZ], lp.footPitch, ramp));
    }
    renderHusk(out, P, C, null, armJoints, legJoints, false);
    return out;
  }
  // ── husk melee maul: a planted double-claw rake. huskAttack drives the arm thrust + body fold +
  //    head (via B), and now the lunge legs: the pelvis drives forward + sinks as the body folds, over
  //    a staggered stance (lead foot forward, trail back) that establishes on the wind-up, so the legs
  //    extend/compress into the strike via IK instead of standing as rigid posts. The whole-body
  //    tip/lurch (jPitch/jZ) is the caller's post-xform, exactly as for the gait. ──
  if (eq && eq.husk && action === 'attack') {
    const ramp = skinRamp(0.89);
    const P = mkFrame(0, 0, 0, [0, SPEC.pelvisY, 0], [0, -(B.atkSink || 0), B.atkFwd || 0]); // pelvis lunges forward + sinks (knees bend via IK)
    const C = compose(P, mkFrame(B.atkTwist || 0, (B.huskBend || 0) + aimPitch * AIM_PITCH_FRAC, B.atkRoll || 0, [0, 1.0, 0], [0, 0, 0])); // chest folds hard over the feet + twists into the diagonal rake (yaw) + tilts (roll)
    const H = mkFrame(B.headTurn || 0, B.headTilt || 0, B.headCock || 0, [0, 1.55, 0], [0, 0, 0]); // head whips on its own neck
    const out = [];
    { const fs = []; trunkLower(fs); out.push(...P.faces(fs)); }
    { const fs = []; trunkUpperChest(fs, ramp); out.push(...C.faces(fs)); }
    { const fs = []; headPieces(fs, ramp); out.push(...C.faces(H.faces(fs))); }
    let armJoints = null; const legJoints = [];
    { const fs = []; armJoints = armsDown(fs, ramp); out.push(...C.faces(fs)); }
    const stance = B.atkStance || 0;
    for (const side of [1, -1]) { // staggered lunge stance: lead foot plants forward, trail drives from behind
      const lead = side === 1;
      const hipW = P.pt([side * SPEC.hipX, SPEC.pelvisY, 0]);
      const footZ = lead ? stance : -stance * 0.8;
      legJoints.push(bodyLeg(out, side, hipW, [side * 0.14, 0.06, footZ], (lead ? -0.15 : -0.32), ramp)); // trail foot rolls onto the ball (push-off)
    }
    renderHusk(out, P, C, H, armJoints, legJoints);
    return out;
  }
  // ── flicker attack: a planted blade strike, driven through the WHOLE rig. The caller sets a per-arm attack
  //    pose (flickerSlash / flickerOverhead / flickerCombo) via B.armL / B.armR - each blade posed
  //    INDEPENDENTLY (one cuts, the other guards), the active elbow extending late (the whip) + the wrist
  //    rolling; atkFwd/atkSink/atkStance lunge the pelvis over a stagger so the knees bend via IK - same
  //    machinery as the husk maul, flicker treatment. ──
  if (eq && eq.flicker && action === 'strike') {
    const ramp = skinRamp(0.89);
    const P = mkFrame(B.atkPelYaw || 0, 0, 0, [0, SPEC.pelvisY, 0], [0, -(B.atkSink || 0), B.atkFwd || 0]); // pelvis PIVOTS (yaw) + lunges + sinks -> hips drive the chain, knees bend via IK
    const C = compose(P, mkFrame(B.atkTwist || 0, (B.huskBend || 0) + aimPitch * AIM_PITCH_FRAC, B.atkRoll || 0, [0, 1.0, 0], [0, 0, 0])); // chest twists RELATIVE to the pelvis (the spine coils + whips) + folds + tilts
    const H = mkFrame(B.headTurn || 0, B.headTilt || 0, B.headCock || 0, [0, 1.55, 0], [0, 0, 0]); // the crystal head-cluster whips on its own driven turn (lagged after the chest)
    const out = [];
    { const fs = []; trunkLower(fs); out.push(...P.faces(fs)); }
    { const fs = []; trunkUpperChest(fs, ramp); out.push(...C.faces(fs)); } // chest only (headless)
    let armJoints = null; const legJoints = [];
    { const fs = []; armJoints = flickerArmsPosed(fs, ramp, B.armL, B.armR); } // flesh discarded - the flicker's arms are crystal blades; each posed INDEPENDENTLY (one slashes, one guards)
    const stance = B.atkStance || 0;
    for (const side of [1, -1]) { // staggered lunge stance: lead foot plants forward, trail drives off the ball
      const lead = side === 1;
      const hipW = P.pt([side * SPEC.hipX, SPEC.pelvisY, 0]);
      const footZ = lead ? stance : -stance * 0.8;
      legJoints.push(bodyLeg(out, side, hipW, [side * 0.14, 0.06, footZ], (lead ? -0.15 : -0.32), ramp)); // trail foot rolls onto the ball (push-off)
    }
    renderFlicker(out, P, C, H, armJoints, legJoints);
    return out;
  }
  // ── husk crystal-death pose: the rig flails at EVERY joint on the killing blow - a violent recoil
  //    (arms flung overhead + spread, head snapped back, torso arched, knees buckling) loosening into
  //    a limp trailing throw. The crystallize/shatter + the knockback launch are layered on by the
  //    caller (crystalDeathFaces + crystalDeathRig); this branch only poses + skins the body. ──
  if (eq && eq.husk && action === 'death') {
    const ramp = skinRamp(0.89), u = deathU, dp = PLUGS.death.deathPose(u);
    const P = mkFrame(0, dp.pelPitch, 0, [0, SPEC.pelvisY, 0], [0, 0, 0]);
    const C = compose(P, mkFrame(0, dp.chestPitch, 0, [0, 1.0, 0], [0, 0, 0])); // torso arches back off the hit
    const Hd = mkFrame(dp.headTurn, dp.headTilt, dp.headCock, [0, 1.55, 0], [0, 0, 0]); // head snaps + lolls
    const out = [];
    { const fs = []; trunkLower(fs); out.push(...P.faces(fs)); }
    { const fs = []; trunkUpper(fs, ramp); out.push(...C.faces(fs)); }
    B.armX = dp.armX; B.armY = dp.armY; B.armZ = dp.armZ; B.armCurl = dp.armCurl; B.armTwitch = 0; // arms flung overhead
    let armJoints = null; const legJoints = [];
    { const fs = []; armJoints = armsDown(fs, ramp); out.push(...C.faces(fs)); }
    for (const side of [1, -1]) { // legs buckle + splay + trail, asymmetrically
      const lead = side === 1;
      const hipW = P.pt([side * SPEC.hipX, SPEC.pelvisY, 0]);
      const footX = side * (0.14 + dp.footSplay);
      const footY = 0.06 + (dp.footY - 0.06) * (lead ? 1.12 : 0.82);
      const footZ = (lead ? 1 : -1) * dp.footStag;
      legJoints.push(bodyLeg(out, side, hipW, [footX, footY, footZ], dp.footPitch, ramp));
    }
    renderHusk(out, P, C, Hd, armJoints, legJoints, false);
    return out;
  }
  if (eq && eq.bulwark && action === 'death') { // bulwark crystal-death: same flail pose on the major's body; the caller layers crystalDeathFaces (crystallize -> shatter) + crystalDeathRig (launch)
    const ramp = skinRamp(0.89), u = deathU, dp = PLUGS.death.deathPose(u), exposed = crystalGun; // exposed death keeps gripping the rifle; shielded death flings the arms + drops the shield
    const P = mkFrame(0, dp.pelPitch, 0, [0, SPEC.pelvisY, 0], [0, BULWARK_LEG_LIFT, 0]); // raised like the live bulwark
    const C = compose(P, mkFrame(0, dp.chestPitch, 0, [0, 1.0, 0], [0, 0, 0]));
    const Hd = mkFrame(dp.headTurn, dp.headTilt, dp.headCock, [0, 1.55, 0], [0, 0, 0]);
    const out = [];
    { const fs = []; trunkLower(fs); out.push(...P.faces(fs)); }
    { const fs = []; trunkUpperChest(fs, ramp); out.push(...C.faces(fs)); } // chest only; the crystal head replaces the skull
    let armJoints = null; const legJoints = [];
    if (exposed) { const fs = []; armJoints = gunAndArms(fs, 0, 0, ramp); out.push(...C.faces(fs)); } // the body reacts but stays gripping the crystal rifle
    else { B.armX = dp.armX; B.armY = dp.armY; B.armZ = dp.armZ; B.armCurl = dp.armCurl; B.armTwitch = 0; const fs = []; armJoints = armsDown(fs, ramp); out.push(...C.faces(fs)); } // arms flung overhead
    for (const side of [1, -1]) {
      const lead = side === 1;
      const hipW = P.pt([side * SPEC.hipX, SPEC.pelvisY, 0]);
      const footX = side * (0.14 + dp.footSplay);
      const footY = 0.06 + (dp.footY - 0.06) * (lead ? 1.12 : 0.82);
      const footZ = (lead ? 1 : -1) * dp.footStag;
      legJoints.push(bodyLeg(out, side, hipW, [footX, footY, footZ], dp.footPitch, ramp, 1.5)); // longer bulwark legs
    }
    renderBulwark(out, P, C, Hd, armJoints, legJoints, exposed ? -1 : (B.shieldHP != null ? B.shieldHP : 1), 0, 0, 0); // shielded: body + shield shatter together; exposed: body + rifle
    return out;
  }
  if (eq && eq.flicker && action === 'death') { // flicker/idol crystal-death: the same flail pose on the displaced rig (covers the idol too = eq.flicker + B.idol). renderFlicker draws the blade-arms / fused emitter + (flickerBurst) the exploding purple shatter; the caller adds crystalDeathRig's backward launch + tumble
    const ramp = skinRamp(0.89), u = deathU, dp = PLUGS.death.deathPose(u);
    const P = mkFrame(0, dp.pelPitch, 0, [0, SPEC.pelvisY, 0], [0, 0, 0]);
    const C = compose(P, mkFrame(0, dp.chestPitch, 0, [0, 1.0, 0], [0, 0, 0])); // torso arches back off the hit
    const Hd = mkFrame(dp.headTurn, dp.headTilt, dp.headCock, [0, 1.55, 0], [0, 0, 0]); // the scattered cluster / idol crown rides this
    const out = [];
    { const fs = []; trunkLower(fs); out.push(...P.faces(fs)); }
    { const fs = []; trunkUpperChest(fs, ramp); out.push(...C.faces(fs)); } // chest only; renderFlicker replaces the skull with the crystal cluster (idol: the crowned head)
    B.armX = dp.armX; B.armY = dp.armY; B.armZ = dp.armZ; B.armCurl = dp.armCurl; B.armTwitch = 0; // arms flung overhead; the blade-arms / fused emitter ride them
    let armJoints = null; const legJoints = [];
    { const fs = []; armJoints = armsDown(fs, ramp); } // the flicker draws NO flesh arms - armsDown only solves the shoulder joints for renderFlicker to mount the blades / emitter
    for (const side of [1, -1]) { // legs buckle + splay + trail, asymmetrically (same as the husk)
      const lead = side === 1;
      const hipW = P.pt([side * SPEC.hipX, SPEC.pelvisY, 0]);
      const footX = side * (0.14 + dp.footSplay);
      const footY = 0.06 + (dp.footY - 0.06) * (lead ? 1.12 : 0.82);
      const footZ = (lead ? 1 : -1) * dp.footStag;
      legJoints.push(bodyLeg(out, side, hipW, [footX, footY, footZ], dp.footPitch, ramp));
    }
    renderFlicker(out, P, C, Hd, armJoints, legJoints);
    return out;
  }
  if (locoState === 'slide') {
    const ramp = skinRamp(0.89);
    const pYaw = B.pelvisYaw / DEG;
    const P = mkFrame(pYaw, B.pelvisPitch / DEG, B.pelvisRoll / DEG, [0, SPEC.pelvisY, 0], [0, -B.crouch, 0]);
    const C = compose(P, mkFrame(-pYaw * B.counterFrac, B.chestLean / DEG + (holdState === 'aimed' ? aimPitch * AIM_PITCH_FRAC : 0), B.lateralFlex / DEG, [0, 1.0, 0], [0, 0, 0]));
    const H = mkFrame(0, (holdState === 'aimed' ? 0 : aimPitch * AIM_PITCH_FRAC), 0, [0, 1.55, 0], [0, 0, 0]); // hipfire: head tracks the look (chest level); on ADS the chest aim-lean carries it
    const out = [];
    { const fs = []; trunkLower(fs); out.push(...P.faces(fs)); }
    { const fs = []; trunkUpperChest(fs, ramp); out.push(...C.faces(fs)); }
    { const fs = []; headPieces(fs, ramp); out.push(...C.faces(H.faces(fs))); } // head on its own pitch frame
    let armJoints = null; const legJoints = [];
    { const fs = []; armJoints = gunAndArms(fs, 0, 0, ramp); out.push(...C.faces(fs)); }
    const leadSign = B.leadSide >= 0 ? 1 : -1;
    for (const side of [1, -1]) {
      const hipW = P.pt([side * SPEC.hipX, SPEC.pelvisY, 0]);
      const lead = side === leadSign;
      const F = lead ? [side * 0.14, B.leadY, B.leadFwd] : [side * 0.14, B.trailY, -B.trailBack];
      legJoints.push(bodyLeg(out, side, hipW, F, (lead ? B.leadPitch : B.trailPitch) / DEG, ramp));
    }
    renderArmor(out, P, C, armJoints, legJoints, eq, t, 0, ARMOR_SPEED.slide, false, 0, H);
    return out;
  }
  const ramp = skinRamp(0.89), phi = phase + B.gaitPhase / DEG;
  const isHusk = !!(eq && eq.husk);
  const isBulwark = !!(eq && eq.bulwark);
  const isFlicker = !!(eq && eq.flicker);
  if (isBulwark) { B.bobAmp *= 2.2; B.swayAmp *= 1.6; B.chestLean *= 1.4; B.pelvisYaw *= 1.3; } // heavy body character; the jerky/uneven stride + lift + phase come from bulwarkGait
  const bobY = -B.bobAmp * Math.cos(2 * phi), swayX = B.swayAmp * Math.sin(phi);
  const pYaw = (B.pelvisYaw / DEG) * Math.sin(phi), pRoll = (B.pelvisRoll / DEG) * Math.sin(phi), pPitch = B.pelvisPitch / DEG;
  const cYaw = -pYaw * B.counterFrac, flex = (B.lateralFlex / DEG) * Math.sin(phi);
  const wbX = B.weaponBob * Math.sin(phi), wbY = B.weaponBob * 0.6 * Math.sin(2 * phi);
  const isCrouch = locoState === 'crouch', dropped = isCrouch || locoState === 'crouchwalk', crouchLead = B.leadSide >= 0 ? 1 : -1;
  const spd = Math.min(1, B.strideAmp / 0.28); // movement amount 0..1
  // husk idle life: a slow breath (the chest rises + settles) + a weight shift that lists the hips onto
  // one leg then the other, so a standstill reads as a coiled, restless creature instead of a statue.
  // Both fade in only as it stops (1 - spd), handing back to the gait's bob/sway once it moves.
  const idleAmt = (isHusk || isBulwark || isFlicker) ? 1 - spd : 0;
  const huskBreathe = idleAmt * 0.016 * Math.sin(B.t * 1.5);
  const huskWShift = idleAmt * (Math.sin(B.t * 0.8) * 0.6 + Math.sin(B.t * 0.33 + 1.3) * 0.4);
  const wX = swayX - (isCrouch ? crouchLead * (B.crouchWeight || 0) : 0) + huskWShift * 0.03; // stationary crouch lists onto the back leg; husk weight-shift slides the hips
  const pdShift = B.paperdoll ? (B.paperdoll.hipShift ?? 0.045) * (B.paperdoll.weightSide ?? 1) : 0; // contrapposto: hips list over the weight leg
  const P = mkFrame(pYaw, pPitch, pRoll + huskWShift * 0.05, [0, SPEC.pelvisY, 0], [wX + pdShift, bobY - (dropped ? B.crouch : 0) - landDip * 0.18 + (isBulwark ? BULWARK_LEG_LIFT : 0) + huskBreathe * 0.3, 0]); // husk: hips list onto the weighted leg + lift a touch on the breath
  const leanPitch = (B.chestLean / DEG) * B.moveDir[1] * spd; // fwd/back lean follows the move direction (chestLean is the magnitude) - a backpedal leans back, not into a baked forward lean
  const leanRoll = 0.05 * B.moveDir[0] * spd;                 // list into a lateral move (kept subtle)
  const creature = isHusk || isBulwark || isFlicker; // husk + bulwark + flicker all convulse/hunch/breathe (feet planted, spine snaps)
  const C = compose(P, mkFrame(cYaw + (creature ? B.convYaw || 0 : 0), leanPitch + (creature ? (B.huskBend || 0) + huskBreathe * 0.6 + (B.convPitch || 0) : 0) + (isBulwark ? BULWARK_HUNCH : 0) + (holdState === 'aimed' ? aimPitch * AIM_PITCH_FRAC : 0), flex + leanRoll - huskWShift * 0.04 + (creature ? B.convRoll || 0 : 0), [0, 1.0, 0], [0, huskBreathe, 0])); // husk hunches + breathes (chest rises) + counter-lists the hips + convulses (tremor/spasm snap the spine, feet stay planted); bulwark leans its mass forward; on ADS the chest leans to the look pitch so the gun follows the aim (hipfire stays level - head-only)
  const H = mkFrame(B.headTurn || 0, (B.headTilt || 0) + (holdState === 'aimed' ? 0 : aimPitch * AIM_PITCH_FRAC), B.headCock || 0, [0, 1.55, 0], [0, 0, 0]); // head frame about the neck base (chest-local): creatures' headTurn/tilt/cock (aimPitch 0) + the player's HIPFIRE look tracking (head-only, chest level); on ADS the head pitch rides the chest aim-lean instead so it does not double up; the flicker's crystal cluster rides it
  const out = [];
  { const fs = []; trunkLower(fs); out.push(...P.faces(fs)); }
  if (isHusk) {
    { const fs = []; trunkUpperChest(fs, ramp); out.push(...C.faces(fs)); }
    { const fs = []; headPieces(fs, ramp); out.push(...C.faces(H.faces(fs))); } // head rides its own tilt frame
  } else if (isBulwark || isFlicker) {
    { const fs = []; trunkUpperChest(fs, ramp); out.push(...C.faces(fs)); } // chest only; the crystal replaces the skull (renderBulwark = bulging head / renderFlicker = scattered cluster)
  } else {
    { const fs = []; trunkUpperChest(fs, ramp); out.push(...C.faces(fs)); }
    { const fs = []; headPieces(fs, ramp); out.push(...C.faces(H.faces(fs))); } // head on its own pitch frame: tracks the look up/down while the chest stays level
  }
  let armJoints = null; const legJoints = [];
  { const fs = []; armJoints = (isBulwark && weapon === 'none') ? bulwarkShieldArms(fs, ramp, phi, B.fireU || 0) : weapon === 'none' ? armsDown(fs, ramp) : gunAndArms(fs, wbX, wbY, ramp); if (!isFlicker) out.push(...C.faces(fs)); } // shielded bulwark holds one-handed; other melee hang their arms; the flicker draws NO flesh arms (its arms are crystal blades, built in renderFlicker - armsDown still gives the shoulder joints)
  for (const side of [1, -1]) {
    const hipW = P.pt([side * SPEC.hipX, SPEC.pelvisY, 0]);
    let g;
    if (isCrouch) { // asymmetric staggered stance (slide-style), not a symmetric squat
      const lead = side === crouchLead;
      g = { F: [side * (lead ? B.leadX : B.trailX), lead ? B.leadY : B.trailY, lead ? B.leadFwd : -B.trailBack], fp: (lead ? B.leadPitch : B.trailPitch) / DEG };
    } else g = gaitFoot(side, phase); // walk / run / strafe all stride along moveDir now (omnidirectional)
    if (B.paperdoll) { // static contrapposto (paperdoll viewport): weight foot tucks under the listed pelvis, free foot plants out + forward - matches the classic BODY pose the item art seats on
      const pd = B.paperdoll, ws = pd.weightSide ?? 1;
      g = side === ws
        ? { F: [side * SPEC.hipX * (pd.weightIn ?? 0.5) + pdShift, 0.06, 0.02], fp: 0 }
        : { F: [side * (SPEC.hipX + (pd.freeOut ?? 0.06)), 0.06, pd.freeFwd ?? 0.15], fp: 0 };
    }
    const F = isBulwark ? [g.F[0] + side * 0.06, g.F[1], g.F[2]] : g.F; // bulwark plants a touch wider
    legJoints.push(bodyLeg(out, side, hipW, F, g.fp, ramp, isBulwark ? 1.5 : 1)); // longer legs for the bulwark
  }
  if (eq && eq.husk) renderHusk(out, P, C, H, armJoints, legJoints);
  else if (eq && eq.flicker) renderFlicker(out, P, C, H, armJoints, legJoints);
  else if (eq && eq.bulwark) renderBulwark(out, P, C, H, armJoints, legJoints, B.shieldHP != null ? B.shieldHP : 1, phi, B.fireU || 0, B.dematShield || 0, t);
  else renderArmor(out, P, C, armJoints, legJoints, eq, t, phi, ARMOR_SPEED[locoState] ?? 0.4, false, 0, H);
  return out;
}


// ── entry: resolve the baked params for (loco, hold, weapon) and pose the body in LOCAL space ──
// s = { loco, hold, weapon, phase, action, mantleU, jumpU, recoil, recoilYaw, slidePos, muzzleT }
// The bare-humanoid plugs (Toolkit-Arc S5): inert sockets, so buildBody(s) with NO plugs poses the base
// rig with empty hands - the toolkit's demo body. Covers exactly what the base path touches: the held +
// stowed gun mounts, the scope rail, the relic hands, the armor pass (identity), and the one ungated
// treatment default (ravager RGUN). Everything else is state-gated and never fires bare.
const EMPTY_GUN = { faces: [], grips: { // empty hands still IK somewhere: the rifle's grip frame, sans rifle
  right: { wrist: [0.04, -0.42, -0.26], axis: [0.19, 0.93, 0.33], fwd: [0, 0, 1] },
  left: { wrist: [0, -0.34, 2.02], axis: [0, 0, 1], fwd: [0, 0.6, 0.4] },
} };
export const BARE_PLUGS = {
  viewmodel: { selRifle: () => EMPTY_GUN, selPistol: () => EMPTY_GUN, selLMG: () => EMPTY_GUN, selSAR: () => EMPTY_GUN, selSniper: () => EMPTY_GUN, buildPistol: () => EMPTY_GUN },
  launcher: { buildLauncher: () => EMPTY_GUN },
  attachments: { equippedScopeFaces: () => [] },
  relic: { severDaggerFaces: () => [] },
  armor: { SHADERS: { ranger: null }, reskin: () => {}, OUTFITS: { outfit1: {} } },
  ravager: { RGUN: {} },
};
let SPEC = VOXLIGHT_SPEC;
let PLUGS = null; // Toolkit-Arc S4b-ii: the content seam - the consumer's plugs, set per call (same module-let pattern as locoState/weapon)
function buildBody(s, plugs, spec) {
  PLUGS = plugs || BARE_PLUGS;
  SPEC = spec || VOXLIGHT_SPEC;
  locoState = s.loco; weapon = s.weapon;
  if (weapon === 'lmg' || weapon === 'launcher' || weapon === 'sniper') lastHeavy = weapon; // remember the equipped Heavy for the back-holster
  holdState = locoState === 'crouch' ? 'aimed' : s.hold; // crouch is aim-only (matches the lab)
  action = s.action || 'none';
  mantleU = s.mantleU || 0; jumpU = s.jumpU || 0; reloadU = s.reloadU || 0; landDip = s.landDip || 0; leapU = s.leapU || 0; deathU = s.deathU || 0;
  recoil = s.recoil || 0; recoilYaw = s.recoilYaw || 0; slidePos = s.slidePos || 0; muzzleT = s.muzzleT || 0;
  aimPitch = s.aimPitch || 0; // third-person upper-body lean toward the look pitch
  HP = s.holster && typeof s.holster === 'object' ? s.holster : HOLSTER; // lab passes tuned transforms
  holsterShown = s.holster !== false; // pass holster:false to hide the stowed weapon
  capeWorn = s.capeWorn !== undefined ? s.capeWorn : !!(s.equipped && s.equipped.cape); // selects the holster variant
  const st = STATES[locoState];
  const wkey = weapon === 'pistol' ? 'pistol' : weapon === 'lmg' ? 'lmg' : weapon === 'launcher' ? 'launcher' : weapon === 'sar' ? 'sar' : 'rifle'; // unarmed (melee) reuses the rifle loco/grip; the LMG, Launcher, and SAR have their own (seeded from rifle, tuned in the lab)
  B = { ...st.loco[wkey], ...st[wkey].grip, ...(st[wkey].holds[holdState] || st[wkey].holds.aimed), ...RELOAD[wkey] }; // unknown hold -> aimed, never a null body (holds are idle | aimed)
  B.moveDir = s.moveDir || [0, 1]; // unit local move direction (omnidirectional gait + lean); [0,1] = straight ahead
  if (s.strideAmp != null) B.strideAmp = s.strideAmp; // eased leg-stride amplitude (enemy spool in/out + strafe<->walk); absent -> preset value, so the player is unchanged
  if (s.liftAmp != null) B.liftAmp = s.liftAmp;
  if (s.swayAmp != null) B.swayAmp = s.swayAmp; // strafe-sway / hip-list override; absent -> preset, so enemies (shared 'strafe' loco) are unchanged
  if (s.pelvisRoll != null) B.pelvisRoll = s.pelvisRoll;
  B.run = s.run || 0; // 0..1 sprint blend: morphs the gait toward a run (flight phase + knee-drive recovery)
  B.t = s.t || 0; // animation clock (husk arm twitch)
  B.armX = s.armX != null ? s.armX : (s.idol ? PLUGS.idol.IDOL_ARM.armX : s.flicker ? PLUGS.flicker.FLICKER_ARM.armX : undefined); B.armY = s.armY != null ? s.armY : (s.idol ? PLUGS.idol.IDOL_ARM.armY : s.flicker ? PLUGS.flicker.FLICKER_ARM.armY : undefined); B.armZ = s.armZ != null ? s.armZ : (s.idol ? PLUGS.idol.IDOL_ARM.armZ : s.flicker ? PLUGS.flicker.FLICKER_ARM.armZ : undefined); B.armCurl = s.armCurl != null ? s.armCurl : (s.idol ? PLUGS.idol.IDOL_ARM.armCurl : s.flicker ? PLUGS.flicker.FLICKER_ARM.armCurl : undefined); B.armTwitch = s.armTwitch || 0; // arm pose + twitch; the flicker rests with blades OUT / the idol draws them in to fuse the emitter (the IK places each wrist), undefined elsewhere -> armsDown defaults
  B.shieldHP = s.shieldHP; // bulwark shield core HP fraction (1 full -> 0 broken, <0 = exposed/no shield)
  B.fireU = s.fireU; // bulwark shield-fire pose blend (0 carry -> 1 braced firing)
  B.dematShield = s.dematShield || 0; // shield dematerialize 0..1 (crystallize -> shatter away on core-break)
  B.matRifle = s.matRifle != null ? s.matRifle : 1; // crystal rifle materialize 0..1 (1 = fully formed)
  crystalGun = !!s.crystalGun; // bulwark exposed -> crystallized rifle mesh
  crystalGunScale = s.crystalGunScale != null ? s.crystalGunScale : CRYSTAL_GUN_SCALE; // rifle oversize: the baked CRYSTAL_GUN_SCALE in-game; a tuner can override it live to dial a new size
  bulwarkChargeAmt = 0; bulwarkFireAmt = 0; bulwarkMfxCfg = null; // reset each call (module vars); set below only for the bulwark rifle
  if (s.bulwark && crystalGun) { // the bulwark holds the crystal rifle with its OWN dialable poses (BULWARK_HOLD), not the shared player rifle holds
    Object.assign(B, s.bulwarkHold || PLUGS.bulwark.BULWARK_HOLD[holdState] || PLUGS.bulwark.BULWARK_HOLD.idle); // idle (lowered) / aimed (up to fire); tuner can pass a live hold
    const ch = s.bulwarkCharge != null ? s.bulwarkCharge : 0; // 0..1 wind-up blend (sim feeds muzzleGlow); 1 = fully braced charge pose
    if (ch > 0) { const cp = s.bulwarkChargePose || PLUGS.bulwark.BULWARK_CHARGE; for (const k in cp) B[k] += (cp[k] - B[k]) * ch; } // ease the held pose toward the braced charge pose
    const rc = s.bulwarkRecoil != null ? s.bulwarkRecoil : 0; // 0..1 per-shot kick (sim feeds the decaying fire amount)
    if (rc > 0) { const rco = s.bulwarkRecoilCfg || PLUGS.bulwark.BULWARK_RECOIL; B.gunZ -= rco.back * rc; B.gunY += rco.rise * rc; B.gunPitch -= rco.climb * rc; } // gun drives back + up + climbs
    bulwarkChargeAmt = ch; bulwarkFireAmt = rc; bulwarkMfxCfg = s.bulwarkMfx || null; // feed the muzzle FX (charge gather + fire burst); gunAndArms reads these
  }
  B.paperdoll = s.paperdoll || null; // static contrapposto stance cfg (paperdoll viewport): { weightSide, weightIn, freeOut, freeFwd, hipShift } - feet + pelvis; optional { armX, armY, armZ, armCurl } override the hanging-arm wrist targets (fit against the classic silhouette downstream)
  if (B.paperdoll) for (const k of ['armX', 'armY', 'armZ', 'armCurl']) if (B.paperdoll[k] != null) B[k] = B.paperdoll[k]; // fitted hanging-arm overrides ride the stance cfg
  B.headTilt = s.headTilt || 0; B.headTurn = s.headTurn || 0; B.headCock = s.headCock || 0; B.huskBend = s.bend || 0; // husk head tilt/twitch + forward fold
  B.atkFwd = s.atkFwd || 0; B.atkSink = s.atkSink || 0; B.atkStance = s.atkStance || 0; // husk maul: pelvis lunge-forward + sink (knees bend) + staggered foot stance
  B.atkTwist = s.atkTwist || 0; B.atkRoll = s.atkRoll || 0; // husk maul: chest twist (yaw) + tilt (roll) into the diagonal rake
  B.atkPelYaw = s.atkPelYaw || 0; // flicker attack: pelvis YAW (the hips pivot into the swing - drives the chain, twists the planted legs)
  B.convPitch = s.convPitch || 0; B.convRoll = s.convRoll || 0; B.convYaw = s.convYaw || 0; // husk tremor/spasm convulsion, articulated to the chest (feet stay planted)
  B.leapCfg = s.leapCfg || null; // tunable quadruped-leap config (husk leap branch)
  huskBare = !!s.huskBare;
  huskSeed = s.seed || 0;
  huskNoCrys = !!s.huskNoCrystals;
  relicActive = !!s.relic; // the player's active relic: dual daggers replace the chest gun
  B.manifestU = s.manifestU != null ? s.manifestU : -1; // Sever activation cinematic 0..1 (-1 idle): drives the dagger materialize + the raise flourish
  ravagerGuns = !!s.ravager; // the Ravager renders as a Husk + dual gun-blades
  B.ravagerGun = s.ravagerGun ? { ...PLUGS.ravager.RGUN, ...s.ravagerGun } : PLUGS.ravager.RGUN; // gun-blade shape (tuner overrides)
  B.ravagerShroud = s.ravagerShroud; // shroud/mantle cfg overrides; undefined = default, false = off (tuner toggle)
  B.ravagerHood = s.ravagerHood; // hood cfg overrides; undefined = default
  B.ravagerRecoil = s.ravagerRecoil || null; // per-gun recoil { L, R } (0..1) - the firing gun kicks back + flashes
  B.ravagerMuzzles = null; // body-local gun-blade muzzle points, repopulated by renderHusk from the solved (recoiled) wrists; the rig is the source of truth
  B.flickerCfg = s.flickerCfg || {}; // flicker tuner dials (blades / cluster / consumption); empty = baked defaults
  B.flickerSwing = s.flickerSwing || {}; // (legacy) unused now the blades ride the IK
  B.flickerRoll = s.flickerRoll || 0; // shared wrist roll (symmetric rest/walk paths)
  B.armL = s.armL || null; B.armR = s.armR || null; // flicker combat: per-arm poses { x, y, z, curl, roll } - one blade slashes while the other guards
  B.armGone = s.armGone || null; // Slice 2: [Lgone, Rgone] - a shattered blade-arm draws no blade (renderFlicker drops its joint); null = both intact
  B.armDemat = s.armDemat || null; // Slice 2: [L, R] per-arm dissolve 0 (solid) -> 1 (gone) - the shatter dissolve + the regrow materialize (reversed). renderFlicker applies it per blade
  B.flickerDemat = s.flickerDemat || 0; // flicker blink: blade-arm dematerialize 0 (solid) -> 1 (dissolved into thin air); reversed = rematerialize
  B.flickerDeath = s.flickerDeath || 0; // flicker DEATH: the WHOLE body dematerializes 0 (alive) -> 1 (gone); with flickerBurst it shatters + launches like the husk instead of dissolving in place
  B.flickerBurst = !!s.flickerBurst; // DEATH only: explode the whole-body shatter outward (husk-style) rather than the in-place blink dissolve
  B.idol = !!s.idol; B.idolEmitter = s.idolEmitter || {}; B.idolMuzzle = null; // Idol: render as a Flicker but fuse the arms into the beam emitter (tuner overrides the emitter shape); muzzle repopulated by renderFlicker from the solved wrists
  const eq = (s.husk || s.ravager) ? { ...(s.equipped || {}), husk: true } : s.bulwark ? { ...(s.equipped || {}), bulwark: true } : (s.flicker || s.idol) ? { ...(s.equipped || {}), flicker: true } : (s.equipped || null); // husk/ravager/bulwark/flicker/idol -> crystal treatment instead of armor (ravager = husk + gun-blades; idol = flicker + a fused beam emitter)
  const body = figure(s.phase || 0, eq, s.t || 0);
  if (s.bulwark) { const S = BULWARK_SCALE; if (B.rifleMuzzle) B.rifleMuzzle = [B.rifleMuzzle[0] * S, B.rifleMuzzle[1] * S, B.rifleMuzzle[2] * S]; return body.map(f => ({ ...f, p: mapVerts(f.p, v => [v[0] * S, v[1] * S, v[2] * S]) })); } // grow the major about the feet (origin); the muzzle tracks the scale (the bore direction is scale-invariant)
  if (s.flicker || s.idol) { if (B.idolMuzzle) B.idolMuzzle = [B.idolMuzzle[0] * FLICKER_SCALE_XZ, B.idolMuzzle[1] * FLICKER_SCALE_Y, B.idolMuzzle[2] * FLICKER_SCALE_XZ]; return body.map(f => ({ ...f, p: mapVerts(f.p, v => [v[0] * FLICKER_SCALE_XZ, v[1] * FLICKER_SCALE_Y, v[2] * FLICKER_SCALE_XZ]) })); } // stretch up + draw in: tall + thin, about the feet (origin); the muzzle tracks the scale
  return body;
}

// the Ravager gun-blade muzzles from the most recent buildBody, body-local (one entry per gun: { p, side }).
// huskBody + the tuner world-transform these so bolts + the charge spawn exactly on the rendered muzzles.
export function lastRavagerMuzzles() { return B.ravagerMuzzles; }

// the Idol's beam emitter muzzle (lens tip) from the most recent buildBody, body-local. The tuner + game
// world-transform it so the charged beam + muzzle burst loose exactly from the rendered lens.
export function lastIdolMuzzle() { return B.idolMuzzle; }
export function lastBulwarkMuzzle() { return B.rifleMuzzle; } // body-local rifle muzzle point (rifle tuner: dart launch origin)
export function lastBulwarkAim() { return B.rifleAim; } // body-local rifle bore direction (unit)
export function lastRig() { return B.rig; } // solved pelvis/chest frames + arm/leg joints from the last buildBody (the armor lab rides these real bones)

export { buildBody, AIM_PITCH_FRAC, BULWARK_SCALE };
