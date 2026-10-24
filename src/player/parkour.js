// CLIMB1 (2026-09-30, the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md):
// THE LEDGE SENSOR, THE MANTLE, THE CLAMBER AND THE VAULT. Mac: "a proper and
// detailed climbing system... Being able to latch, mantle, jump from one
// location to another ledge. Almost parkour like", after Assassin's Creed and
// Dying Light. The four calls: JUMP IS THE GRAB, THE SKILL SCALES IT (it gates
// no move), SHEER WALLS FREE-CLIMB ON GRIP, and LEAPS OF THEIR OWN scaled by
// Jumping.
//
// The port's own law, not DFU's: ClimbingMotor's classic path (climbing.js)
// has no idea what a ledge is - the wall-hug shoves the capsule over the lip
// (DISC21) - and its `AdvancedClimbing` arms (hang, rappel, corner wraps) are
// Ledger A off-road and stay so. This module is ENHANCED LANE ONLY: the motor
// consults it only when its host hands `parkour` deps whose switch answers
// yes (scenes/shared.js parkourSwitchOn), so the classic climb is untouched on
// the classic skin offline and with the row off.
//
// What CLIMB1 moves:
//   - MANTLE: a lip within reach of the hands (Jump pressed on the ground, Jump
//     held in the air, or the classic climb arriving under one) is climbed
//     onto - up the face, then over the lip - ending standing on the top, in
//     the middle of a narrow one, or crouched where only a crouch fits;
//   - CLAMBER: a top too thin to stand on (a parapet, a railing's top rail, a
//     thin fence) is climbed over onto the floor just behind it;
//   - VAULT: a lip at the waist or under whose top ends within a stride, taken
//     moving forward, is passed over and the body carries on beyond it.
// The path is SCRIPTED, not physics (the one thing both reference games do),
// and the WHOLE of it is proven clear before it starts (AUDIT CLIMB1 F2: the
// first sensor proved only the two ends, and a body stepped through railings,
// slots and lintels): every point the body passes through is a capsule the
// collider says fits, at the height the body will have there.
//
// What CLIMB2 moves (the second half of this file):
//   - HANG: a lip caught in the air at the chest or higher is HELD - the body
//     hangs under it, the eye just below the lip - and Forward (or a fresh
//     Jump) climbs up from there, Crouch lets go;
//   - SHIMMY: Left and Right move the hang along the lip, following its
//     height and a wall that curves, and stop where the lead hand finds
//     nothing to take;
//   - GRIP: a hold that runs out - its time the Climbing skill's and the
//     body's Fatigue's - and gives out when spent;
//   - FREE CLIMB: on the enhanced lane any wall is climbed without the
//     classic roll (Mac's "Free-climb on grip") - up, down and across, until
//     the grip gives; its top is a hang, and Forward over it a mantle.
//
// This module is pure - the collider is handed in - and it takes no motor
// constant at its top level: the motor imports this file, so a top-level read
// of a motor constant here would meet the cycle's TDZ. The numbers it shares
// with the motor are restated and pinned equal (test/auditclimb1, test/climb2).

import { KHAJIIT_CLIMBING_BONUS, climbingSpeed } from './climbing.js';
import { overcapClimbSpeed } from '../systems/skillSoftcap.js';   // CLIMB-PAST: the climb's pace past 100 (a leaf)

/** The lip height above the feet a standing body reaches with its hands, at
 *  Climbing 0 and at Climbing 100: a ledge at the chest, and one at the full
 *  stretch of the arms over a 1.8 m capsule. */
export const PARKOUR_REACH_MIN = 1.5;
export const PARKOUR_REACH_MAX = 2.1;
/** In the air or on the wall the arms are already up: this much more reach. */
export const PARKOUR_AIR_REACH = 0.15;
/** In the air a lip as low as the knees is still one to climb onto. On the
 *  ground the floor of the band is the step offset - under it the step
 *  ladder already walks the body up (collider.js _moveStep). */
export const PARKOUR_AIR_LOW = 0.25;
/** How far past the capsule's side the face may stand and still be grabbed. */
export const PARKOUR_WALL_REACH = 0.5;
/** The look must meet the face within 50 degrees of square. */
export const PARKOUR_FACING_DOT = Math.cos((50 * Math.PI) / 180);
/** A face is a wall while its normal's y is at most this (60 degrees from
 *  level or steeper); anything flatter is a slope the body walks. */
export const PARKOUR_FACE_MAX_NY = 0.5;
/** A top pitched past 50 degrees is a roof the body would slide off. AUDIT CLIMB-FIELD R1 (Mac: "You cant mantle the
 *  bottom of roofs"): it was 45, and Daggerfall's own steep roofs are not 45 - their vertices are whole units, and of
 *  the town blocks' 392 building models the 45-degree family runs 45.1 to 48.7 (157 models, ~2,500 placements, every
 *  one refused at its eave: no hang, no mantle, the free climb stalled under it). 50 takes all of them and stays inside
 *  what the probes were built for: the face scan's lean (a 50-degree roof's rung stands 0.084 back, past the 0.08 lean,
 *  so its eave still ends the face) and the top probes' rise (under PARKOUR_TOP_PROBE + s to a metre in). */
export const PARKOUR_TOP_MIN_NY = Math.cos((50 * Math.PI) / 180);
/** The run of the steepest top for a unit rise: a top rising a rung stands at least this many rungs back. */
export const PARKOUR_TOP_RUN = PARKOUR_TOP_MIN_NY / Math.sqrt(1 - PARKOUR_TOP_MIN_NY * PARKOUR_TOP_MIN_NY);
/** The wall scan's rung: level rays this far apart up the face. AUDIT CLIMB1
 *  G4: 0.2 at CLIMB1, and a table top thinner than a rung was found only when
 *  a rung happened to land in its edge. */
export const PARKOUR_SCAN_STEP = 0.1;
/** The face goes on while the next rung meets it within this much farther
 *  (a face leaning back up to ~38 degrees); farther, or nothing, and the face
 *  has ended under that rung - a 45-degree roof's rise is 0.1 a rung. */
export const PARKOUR_FACE_LEAN = 0.08;
/** CRACK-LIP (FIELD BUGS 2026-10-02): Daggerfall's stacked wall pieces stand a unit apart (2.5 cm) - a slot a level ray
 *  passes through, over the lower piece's own top. An opening no taller than this, the face going on above it at the
 *  depth it had below, is a crack: no lip, and the scan goes on up the wall. */
export const PARKOUR_CRACK = 0.03;
/** ...the slot's top and foot found to this (AUDIT): a measured slot reads up to two steps taller than it is. */
export const PARKOUR_CRACK_STEP = 0.0025;
/** The lip is the top just past the face: the down ray that finds it lands
 *  this far in. AUDIT CLIMB1 G1/G3: it was 0.2 in, which read a pitched
 *  roof's lip 0.2 up its slope and missed a fence thinner than 0.2 outright. */
export const PARKOUR_EDGE_INSET = 0.03;
/** The face under the lip is confirmed this far below it (a 4 cm table top's
 *  edge is still a face). */
export const PARKOUR_UNDER = 0.02;
/** The feet land the capsule's radius plus this past the face. */
export const PARKOUR_TOP_INSET = 0.12;
/** The top is sought from this far over it (plus a 45-degree slope's rise). */
export const PARKOUR_TOP_PROBE = 0.3;
/** The top's profile: a down ray every this far from the face, out to the walk. */
export const PARKOUR_TOP_STEP = 0.1;
export const PARKOUR_TOP_WALK = 1.0;
/** A surface more than this under the lip is past the top's far edge. */
export const PARKOUR_TOP_DROP = 0.1;
/** A top shallower than this is stood on by nobody - it is climbed over (the
 *  clamber) or vaulted; one at least this deep is stood on in its middle when
 *  the usual landing would overhang it (AUDIT CLIMB1 G3). */
export const PARKOUR_MIN_STAND_DEPTH = 0.28;
/** The landing may stand this far off the plane the lip's own slope draws: a
 *  flat tread 0.25 above its lip is the next stair, not this top (G5). */
export const PARKOUR_SLOPE_SLACK = 0.1;
/** On the ground, the floor just in front of the face must be the body's own
 *  - within this of the feet. A tread higher than that between the body and
 *  the face is a stair, and the face a riser further up it (AUDIT CLIMB1 G5:
 *  near a staircase's head a press mantled onto the landing two treads up). */
export const PARKOUR_FOOTING = 0.15;
/** Where the straight landing does not fit - an inner corner, a taller wall
 *  beside the ledge - the body slides along the face by these (G2). */
export const PARKOUR_NUDGE = Object.freeze([0, 0.15, -0.15, 0.3, -0.3]);
/** The body rises this far off the face, and this far over the lip. */
export const PARKOUR_UP_GAP = 0.04;
/** A mantle's step over the lip rises this much more at its middle. */
export const PARKOUR_MANTLE_ARC = 0.03;
/** "Clear": the push collider.penetrationAt reports, findClearFloor's own. */
export const PARKOUR_FIT_EPS = 0.03;
/** The body's radius (the motor's CAPSULE_RADIUS, restated for the cycle and
 *  pinned equal). */
export const PARKOUR_BODY_RADIUS = 0.35;
/** The body asked between the collider's spheres at least this often up its
 *  axis (bandsClear), by spheres this far inside the body's radius - so a
 *  thin feature between two samples sits no further in than a contact's
 *  PARKOUR_FIT_EPS (0.33 - sqrt(0.33^2 - 0.069^2) = 0.007 more than the 2 cm
 *  slack), and a wall the body leans on (at its radius, 2 cm clear of the
 *  sphere) or a 45-degree roof it stands on (1.5 cm) is no feature. The first
 *  cut sampled half as often a centimetre further in, and left 4.6 cm. */
export const PARKOUR_FIT_BAND = 0.1375;
export const PARKOUR_BAND_SLACK = 0.02;
/** AUDIT CLIMB2 G2: a free climber's move that would take the body into a
 *  moulding or a rail across the wall leans out past it instead - the hug let
 *  go of, then these far out from the face: the nearest that clears, within
 *  the wall's contact (PARKOUR_CONTACT). */
export const PARKOUR_LEAN = [0, 0.02, 0.05, 0.1];
/** SEAM-STEP (FIELD BUGS 2026-10-02): a free climber stuck going straight up moves along the wall to the nearest
 *  place within this that the body rises PARKOUR_SIDESTEP_RISE again (asked every PARKOUR_SIDESTEP_PROBE, both ways)
 *  - a hand's width past the corner of the 3.2 m dungeon unit above, never across the wall. */
export const PARKOUR_SIDESTEP_MAX = 0.45;
export const PARKOUR_SIDESTEP_PROBE = 0.05;
export const PARKOUR_SIDESTEP_RISE = 0.1;
/** ...and the way it went is kept until the body has risen this far past where it stuck. */
export const PARKOUR_SIDESTEP_CLEAR = 0.3;
/** HUG-TOUCH (FIELD BUGS 2026-10-02): the free climb presses the body to the face and this far in each step. */
export const PARKOUR_HUG_PRESS = 0.01;
/** STEP-BACK (FIELD BUGS 2026-10-02): the free climb finds the top of the face it held, stepping back over it, by level
 *  rays this far apart up the body. */
export const PARKOUR_STEP_SCAN = 0.02;
/** CORNER-TOP (FIELD BUGS 2026-10-02): the look turned this far along the held wall (sin 20 degrees) asks the top of
 *  the corner's other wall on that side. */
export const PARKOUR_CORNER_LOOK = Math.sin((20 * Math.PI) / 180);
/** AUDIT (FIELD BUGS 2026-10-02): the free climb's hold turned more than this (the dot of the normals, about 2.5
 *  degrees) onto a new face is asked along that face before it is followed. */
export const PARKOUR_TURN_HOLDS = 0.999;
/** The path is proven at least this often - under a quarter of the radius. */
export const PARKOUR_PATH_STEP = 0.08;
/** After a lip is found and every way onto or over it refused, the air catch
 *  and the top-out rest this many steps before asking again - the refusal
 *  proves the whole path at up to ten tries (1.4 ms on a railing), and held
 *  Jump would otherwise ask it every step. 50 ms is a few centimetres of fall. */
export const PARKOUR_QUIET_STEPS = 3;
/** THE TAP CATCH (Mac, 2026-10-01: "Take care of what is left including a
 *  jump catching a ledge" - his "Jump near a ledge catches"): a fresh press of
 *  Jump arms the air catch for the jump it makes, as if the key were still
 *  held, until the body is down again. A press on the ground that leaves it
 *  no jump (the grounded gate's) lapses after this long - the jump it would
 *  have made takes off on the press's own step. */
export const PARKOUR_ARM_GRACE_S = 0.05;
/** A vault: the lip at the waist or under, the top ending within a stride. */
export const PARKOUR_VAULT_MAX = 1.2;
export const PARKOUR_VAULT_DEPTH = 0.9;
/** The body clears a thin top by this going over it; a vault leaves it with
 *  this rise. */
export const PARKOUR_VAULT_CLEAR = 0.08;
export const PARKOUR_VAULT_EXIT_VY = 1.0;
/** The slowest a vault leaves its far side, m/s - a standing vault still
 *  carries the body off the top rather than dropping it onto the edge. */
export const PARKOUR_VAULT_EXIT_MIN = 3.5;
/** DFU's fall-damage threshold (motor.js FALL_DAMAGE_THRESHOLD, AcrobatMotor's
 *  fallingDamageThreshold), restated for the cycle and pinned equal. A vault
 *  never leaps into a fall that hurts (G6); a catch at Climbing 0 holds only a
 *  fall that could not have hurt anyway (F6). */
export const PARKOUR_SAFE_DROP = 5;
/** A clamber comes down behind the thin top onto a floor at most this far
 *  under its lip, stepping off it at this pace. */
export const PARKOUR_OVER_DROP = 1.5;
export const PARKOUR_OVER_EXIT = 0.8;
/** How far a body may have FALLEN and still hold a lip it catches (Mac's
 *  "Skill scales it": the skill says whether a hard catch holds): the fall
 *  threshold at Climbing 0, three times it at 100. AUDIT CLIMB1 F6: every catch
 *  held and cancelled the fall above it - Jump held beside a tower was a fall
 *  from any height without a scratch. */
export const PARKOUR_CATCH_HOLD_MIN = PARKOUR_SAFE_DROP;
export const PARKOUR_CATCH_HOLD_MAX = 15;

// ---- CLIMB2 ----------------------------------------------------------------
/** A hanging body: the lip this far over its feet - the eye (motor.js
 *  EYE_HEIGHT 1.7, restated for the cycle) 0.1 under it, the hands on the lip
 *  at the head's height, the arms bent. */
export const PARKOUR_HANG_DROP = 1.8;
/** The body hangs this far off the face (a mantle's rise keeps the same). */
export const PARKOUR_HANG_GAP = PARKOUR_UP_GAP;
/** A lip is held only at the chest or higher: one lower is stepped onto (a
 *  body cannot hang from its knees). Under the heaviest pack's reach at
 *  Climbing 0 in the air (1.5 - 0.3 + 0.15), so a hang is always in reach. */
export const PARKOUR_HANG_LOW = 1.2;
/** A catch pulls the body into the hang in this long. */
export const PARKOUR_CATCH_S = 0.15;
/** A hand-hold is a top at least this deep past its face: a level ray over
 *  the lip that meets a wall within this of the face is the wall running on,
 *  not a ledge - a sill is, its wall set back (the face's lean, as CLIMB1's). */
export const PARKOUR_GRIP_DEPTH = PARKOUR_FACE_LEAN;
/** From one grip to the next a lip may rise or fall this much (a sloped
 *  coping, a stepped sill); the grip is sought in this window about it. */
export const PARKOUR_LIP_FOLLOW = 0.15;
/** ...and the face may turn this much (a round tower's wall, the rays' own
 *  scatter) - the dot of the two normals. */
export const PARKOUR_FACE_FOLLOW = Math.cos((30 * Math.PI) / 180);
/** The lead hand reaches this far along the lip past the body's middle: the
 *  shimmy stops where it finds nothing to take. */
export const PARKOUR_HAND_SPAN = 0.25;
/** THE GRIP (Mac's "Skill scales it": the skill sets grip time): the seconds a
 *  fresh hold lasts at Climbing 0 and at 100... */
export const PARKOUR_GRIP_MIN_S = 6;
export const PARKOUR_GRIP_MAX_S = 30;
/** ...and the fraction of it a body at Fatigue 0 has ("grip on Fatigue"). */
export const PARKOUR_GRIP_TIRED = 0.35;
/** A free climber held still on the wall, the feet on it too, spends the grip
 *  at this rate; hanging from the hands, shimmying and climbing spend it whole. */
export const PARKOUR_GRIP_REST = 0.5;
/** The grip comes back from nothing in this long, the feet on the ground. */
export const PARKOUR_GRIP_REGEN_S = 2.5;
/** Under this the grip is failing: the HUD's short colour, and the line once a
 *  hold. */
export const PARKOUR_GRIP_LOW = 0.25;
export const PARKOUR_GRIP_LOW_TEXT = 'Your grip is failing.';
/** A grip under this takes no new hold. */
export const PARKOUR_GRIP_MIN = 0.05;
/** The shimmy's pace, m/s, at Climbing 0 and 100. */
export const PARKOUR_SHIMMY_MIN = 0.6;
export const PARKOUR_SHIMMY_MAX = 1.4;
/** The free climb's pace: the classic climb's (Speed / 3, doubled under the
 *  Climbing spell - climbing.js climbingSpeed) times this, at 0 and 100. */
export const PARKOUR_CLIMB_MIN = 0.7;
export const PARKOUR_CLIMB_MAX = 1.3;
/** Forward held against a wall starts a free climb after this long, at 0 and
 *  100 (the classic's 14 system-timer units are 0.77 s, then a roll). */
export const PARKOUR_START_MIN_S = 0.6;
export const PARKOUR_START_MAX_S = 0.3;
/** A heavy pack (the proposal's "heavy packs cut your reach"): up to this
 *  share of what the body can carry costs nothing; a full pack costs this. */
export const PARKOUR_LOAD_FREE = 0.5;
export const PARKOUR_LOAD_CUT = 0.3;
/** A free climber keeps to the wall while a level ray from the axis meets it
 *  within the radius and this - at one of these shares of the body's height. */
export const PARKOUR_CONTACT = 0.15;
export const PARKOUR_CONTACT_AT = Object.freeze([0.8, 0.4, 0.2]);

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/** The Climbing skill the moves read: the classic law's own arithmetic
 *  (climbing.js climbingChance - +30 for a Khajiit, doubled under the
 *  Climbing effect), held to 0..100 because past 100 (SOFTCAP1) the reach,
 *  the grip and the pace's share have nowhere further to go. The points past
 *  100 go to the pace alone, read off the LIVE value as the classic climb's
 *  (CLIMB-PAST: shimmySpeed, freeClimbSpeed). */
export function parkourSkill({ climbing = 0, khajiit = false, enhanced = false } = {}) {
  let s = climbing + (khajiit ? KHAJIIT_CLIMBING_BONUS : 0);
  if (enhanced) s *= 2;
  return Math.min(100, Math.max(0, s));
}

/** The Jumping skill a vault reads (its pace; a vault trains Jumping too),
 *  held to 0..100 the same way. */
export function jumpingSkill({ jumping = 0 } = {}) {
  return Math.min(100, Math.max(0, jumping));
}

/** The lip height a standing body's hands reach at this skill - less under a
 *  heavy pack (CLIMB2): `load` is the pack's weight over what the body can
 *  carry (PlayerEntity.CarriedWeight / MaxEncumbrance), and past half of it
 *  the reach shortens, by PARKOUR_LOAD_CUT at a full pack. */
export function parkourReach(skill, load = 0) {
  const cut = PARKOUR_LOAD_CUT * clamp01((load - PARKOUR_LOAD_FREE) / (1 - PARKOUR_LOAD_FREE));
  return lerp(PARKOUR_REACH_MIN, PARKOUR_REACH_MAX, clamp01(skill / 100)) - cut;
}

/** The fall a caught lip still holds at this Climbing skill (metres). */
export function parkourCatchHold(skill) {
  return lerp(PARKOUR_CATCH_HOLD_MIN, PARKOUR_CATCH_HOLD_MAX, clamp01(skill / 100));
}

/** CLIMB2: the seconds a fresh hold lasts at this Climbing skill and this
 *  Fatigue (the body's current over its most, 0..1). */
export function gripSeconds(skill, fatigue = 1) {
  return lerp(PARKOUR_GRIP_MIN_S, PARKOUR_GRIP_MAX_S, clamp01(skill / 100)) * lerp(PARKOUR_GRIP_TIRED, 1, clamp01(fatigue));
}

/** CLIMB2: the shimmy's pace along a lip, m/s - CLIMB-PAST: times the
 *  classic climb's multiplier for the LIVE Climbing (skillSoftcap.js
 *  overcapClimbSpeed), so a mastered skill's points past 100 shimmy faster. */
export function shimmySpeed(skill, live = 0) {
  return lerp(PARKOUR_SHIMMY_MIN, PARKOUR_SHIMMY_MAX, clamp01(skill / 100)) * overcapClimbSpeed(live);
}

/** CLIMB2: the free climb's pace, m/s - the classic climb's over the motor's
 *  Speed (and the Climbing spell's doubling, and CLIMB-PAST's points past 100
 *  of the LIVE Climbing), times the skill's share. */
export function freeClimbSpeed(speed, skill, spell = false, live = 0) {
  return climbingSpeed(speed, spell, live) * lerp(PARKOUR_CLIMB_MIN, PARKOUR_CLIMB_MAX, clamp01(skill / 100));
}

/** CLIMB2: how long Forward is held against a wall before the free climb. */
export function freeStartSeconds(skill) {
  return lerp(PARKOUR_START_MIN_S, PARKOUR_START_MAX_S, clamp01(skill / 100));
}

/** Seconds a mantle takes: longer the higher the lip, a third quicker at
 *  Climbing 100 than at 0 (a 1.5 m lip: 0.75 s at 0, 0.46 s at 100). */
export function mantleDuration(rise, skill) {
  return (0.25 + 0.22 * Math.max(0, rise)) * (1.3 - 0.5 * clamp01(skill / 100));
}

/** Seconds a vault takes, the same shape and quicker - the Jumping skill's. */
export function vaultDuration(rise, skill) {
  return (0.22 + 0.12 * Math.max(0, rise)) * (1.2 - 0.3 * clamp01(skill / 100));
}

/** Roleplay & Realism's seam (AUDIT CLIMB1 F10): a registered gate answers a
 *  line when a climb must be refused ("You can't climb whilst holding your
 *  weapon."), null otherwise. The mantle and the clamber ask it; a vault is a
 *  leap and does not. One gate, the mod's (systems/roleplayRealism/rrInstall.js). */
let _gate = null;
export function registerParkourGate(fn) { _gate = typeof fn === 'function' ? fn : null; }
export const parkourRefusal = () => _gate?.() ?? null;

/** A capsule at these feet, this tall, stands in the open. Two questions,
 *  because penetrationAt is one of them only: it reports how far the
 *  resolve PUSHED the body, and the resolve will not depenetrate a body up
 *  into a ceiling - it reverts it (collider.js _resolveCapsule, "A body
 *  cannot be depenetrated UP into a ceiling") - so a standing body passing
 *  through a slab reads clear there. The ray up the axis to the head is the
 *  headroom. (A body wholly inside a thick solid would pass both; the path
 *  that reaches such a point crosses the solid's face on the way, and the
 *  path is proven at every step - pathClear.) */
export function capsuleFits(collider, p, height) {
  // CLIMB-DOWN: and never under the terrain - the meshes' resolve does not know it (the move's own clamp does: the
  // collider's restFloor), and a hang under a lip lower than its 1.8 m, outdoors, hung its feet in the ground
  if (collider.restFloor && p[1] < collider.restFloor(p[0], p[2]) - PARKOUR_FIT_EPS) return false;
  if (!(collider.penetrationAt(p, height) < PARKOUR_FIT_EPS) || !bandsClear(collider, p, height)) return false;
  return !Number.isFinite(collider.raycast([p[0], p[1] + 0.05, p[2]], [0, 1, 0], height - 0.1));
}

/** AUDIT CLIMB2 G2: THE BODY BETWEEN THE COLLIDER'S SPHERES. collider.js
 *  resolves the capsule as a chain of spheres at most a diameter apart, and
 *  between two of them it reaches only 0.22 m from the axis (standing: feet +
 *  0.625 and + 1.175) - a moulding, a rail or a cornice there sits up to
 *  0.16 m inside the 0.35 body and penetrationAt reads it clear. The bands are
 *  asked too: spheres PARKOUR_BAND_SLACK inside the body, every
 *  PARKOUR_FIT_BAND or less up the axis between its ends. */
export function bandsClear(collider, p, height) {
  if (!collider.sphereOverlaps) return true;
  const axis = Math.max(0, height - 2 * PARKOUR_BODY_RADIUS);
  const n = Math.ceil(axis / PARKOUR_FIT_BAND - 1e-9);
  for (let i = 1; i < n; i++) {
    if (collider.sphereOverlaps([p[0], p[1] + PARKOUR_BODY_RADIUS + (axis * i) / n, p[2]], PARKOUR_BODY_RADIUS - PARKOUR_BAND_SLACK)) return false;
  }
  return true;
}

/** A level hit that is a wall the look meets: its distance, its horizontal
 *  normal toward the body, its bucket. */
function faceHit(collider, origin, dir, reach) {
  const hit = collider.raycastHit(origin, dir, reach);
  if (!Number.isFinite(hit.dist) || !hit.normal) return null;
  const [nx, ny, nz] = hit.normal;
  const l = Math.hypot(nx, nz);
  if (Math.abs(ny) > PARKOUR_FACE_MAX_NY || l < 1e-4) return null;
  if (-(nx * dir[0] + nz * dir[2]) / l < PARKOUR_FACING_DOT) return null;
  return { dist: hit.dist, normal: [nx / l, 0, nz / l], key: hit.key ?? null };
}

/** THE WALL, by rungs: level rays from the axis every PARKOUR_SCAN_STEP up the
 *  band; the lowest to meet a wall the look meets is the face. The scan then
 *  climbs on until a rung meets nothing within the face's lean - the first
 *  height the face is no longer there (`openY`), with the face's distance
 *  just under it (`faceDist`). No such height one rung past the reach is a
 *  wall that runs on above it (`openY` null). */
function scanFace(collider, feet, dir, low, high, reach) {
  let wall = null, faceDist = 0;
  for (let i = 0; ; i++) {
    const h = low + i * PARKOUR_SCAN_STEP;
    if (h > high + PARKOUR_SCAN_STEP + 1e-9) break;
    const y = feet[1] + h;
    if (!wall) {
      if (h > high + 1e-9) break;
      const f = faceHit(collider, [feet[0], y, feet[2]], dir, reach);
      if (f) { wall = { y, dist: f.dist, normal: f.normal, key: f.key }; faceDist = f.dist; }
      continue;
    }
    const d = collider.raycast([feet[0], y, feet[2]], dir, faceDist + PARKOUR_FACE_LEAN);
    if (!Number.isFinite(d)) {
      if (!faceGoesOn(collider, feet[0], y, feet[2], dir, faceDist, PARKOUR_SCAN_STEP)) return { ...wall, openY: y, faceDist };
      continue;   // CRACK-LIP: a crack between two of the wall's pieces, the face going on over it
    }
    faceDist = d;
  }
  return wall ? { ...wall, openY: null, faceDist } : null;
}

/** CRACK-LIP: is the opening a level ray at `y` passed through (the face met at `dist`, `below` under it) a crack - the
 *  face going on over it at that depth, the slot no taller than PARKOUR_CRACK? AUDIT: the slot itself is measured,
 *  its top and its foot each to PARKOUR_CRACK_STEP - the first cut asked one ray 4 cm over the open one, and an open
 *  ray anywhere up a slot read slots to 9 cm as cracks. */
function faceGoesOn(collider, x, y, z, dir, dist, below) {
  const meets = (yy) => {
    const d = collider.raycast([x, yy, z], dir, dist + PARKOUR_FACE_LEAN);
    return Number.isFinite(d) && Math.abs(d - dist) <= PARKOUR_FACE_LEAN;
  };
  let top = null;
  for (let h = PARKOUR_CRACK_STEP; h <= PARKOUR_CRACK + 1e-9 && top == null; h += PARKOUR_CRACK_STEP) if (meets(y + h)) top = y + h;
  if (top == null) return false;
  let foot = y - below;
  for (let h = PARKOUR_CRACK_STEP; h < below - 1e-9; h += PARKOUR_CRACK_STEP) if (meets(y - h)) { foot = y - h; break; }
  return top - foot <= PARKOUR_CRACK + 2 * PARKOUR_CRACK_STEP;
}

/** THE WALL, by its top (AUDIT CLIMB1 G4): a slab whose edge is thinner than a
 *  rung - a table top, a shelf - meets no rung. Down rays just ahead find its
 *  top instead, from a height a level ray found open, and the edge just under
 *  that top is the face. */
function scanSlab(collider, feet, dir, low, high, reach, radius) {
  const y0 = feet[1] + high + 0.05;
  for (const d of [radius + 0.1, radius + 0.25, reach]) {
    if (Number.isFinite(collider.raycast([feet[0], y0, feet[2]], dir, d + 0.02))) continue;
    const down = collider.surfaceHit([feet[0] + dir[0] * d, y0, feet[2] + dir[2] * d], [0, -1, 0], high + 0.05 - low);
    if (!Number.isFinite(down.dist) || !down.normal || down.normal[1] < PARKOUR_TOP_MIN_NY - PARKOUR_RAY_SCATTER) continue;
    const topY = y0 - down.dist;
    const f = faceHit(collider, [feet[0], topY - PARKOUR_UNDER, feet[2]], dir, reach);
    if (!f) continue;
    if (Number.isFinite(collider.raycast([feet[0], topY + 0.05, feet[2]], dir, f.dist + PARKOUR_FACE_LEAN))) continue;
    return { y: topY - PARKOUR_UNDER, dist: f.dist, normal: f.normal, key: f.key, openY: topY + 0.05, faceDist: f.dist };
  }
  return null;
}

/** The top's profile, walked away from the face along `into`: down rays from
 *  over a 45-degree rise (a 50-degree one's under it to a metre), every PARKOUR_TOP_STEP out to the walk. The top goes
 *  on while each finds a surface no more than PARKOUR_TOP_DROP under the lip;
 *  the first that does not is past its far edge, which a bisection finds to a
 *  centimetre (`depth`; null for a top that runs on past the walk). */
function topProfile(collider, face, into, lipY) {
  const onTop = (s) => {
    const oy = lipY + PARKOUR_TOP_PROBE + s;
    const h = collider.surfaceHit([face[0] + into[0] * s, oy, face[2] + into[2] * s], [0, -1, 0], PARKOUR_TOP_PROBE + s + PARKOUR_TOP_DROP);
    return Number.isFinite(h.dist);
  };
  let last = 0;
  for (let i = 0; ; i++) {
    const s = 0.05 + i * PARKOUR_TOP_STEP;
    if (s > PARKOUR_TOP_WALK + 1e-9) return { depth: null };
    if (onTop(s)) { last = s; continue; }
    let a = i === 0 ? PARKOUR_EDGE_INSET : last, b = s;
    for (let k = 0; k < 4; k++) { const mid = (a + b) / 2; if (onTop(mid)) a = mid; else b = mid; }
    return { depth: (a + b) / 2 };
  }
}

/** The landing on the top at `s` past the face at (fx, fz): the surface there,
 *  if it is the lip's own - no steeper than the top's limit (50), on the plane the
 *  lip's slope draws give or take the slack (a flat tread a riser above is the
 *  next stair), and no lower than the top's drop - with the feet lifted so the
 *  capsule's round foot rests on a slope rather than in it (r/cos - r). A
 *  surface too high to be the top is asked under once more: the probe's origin
 *  can stand inside a lid low over the top, and a ray out of a solid meets its
 *  underside (the top is still there - it is the fit's to refuse, "no-room"). */
function landingAt(collider, fx, fz, into, lipY, s, radius) {
  const px = fx + into[0] * s, pz = fz + into[2] * s, floor = lipY - PARKOUR_TOP_DROP;
  let oy = lipY + PARKOUR_TOP_PROBE + s;
  for (let tries = 0; tries < 2; tries++) {
    const h = collider.surfaceHit([px, oy, pz], [0, -1, 0], oy - floor);
    if (!Number.isFinite(h.dist) || !h.normal) return null;
    const ny = h.normal[1];
    const y = oy - h.dist;
    const tan = ny > 0 ? Math.sqrt(Math.max(0, 1 - ny * ny)) / ny : Infinity;
    if (ny >= PARKOUR_TOP_MIN_NY - PARKOUR_RAY_SCATTER && y - lipY <= s * tan + PARKOUR_SLOPE_SLACK) {
      let top = y + radius / ny - radius;
      // AUDIT CLIMB-ARC D2: a top that is the GROUND is stood on at the capsule's floor (restFloor - capsuleFits' own,
      // since CLIMB-DOWN), which on a real grade lies up to 8 cm over the drawn ground surfaceHit read: the fit refused
      // the landing it was asked about, and a bank's retaining wall could not be climbed onto
      if (h.key == null && collider.restFloor) { const rf = collider.restFloor(px, pz); if (Number.isFinite(rf)) top = Math.max(top, rf); }
      return { y: top, key: h.key ?? null };
    }
    oy = y - 0.02;
    if (oy <= floor) return null;
  }
  return null;
}

/** The two-segment path every move rides (movePoint), as the sensor proves it. */
const path = (from, up, to, split, arc) => ({ from: [from[0], from[1], from[2]], up, to, split, arc });
const splitFor = (rise) => Math.min(0.75, Math.max(0.45, 0.35 + 0.2 * rise));

/** THE PATH, PROVEN (AUDIT CLIMB1 F2/F3): the body fits at every point of the
 *  move at least every PARKOUR_PATH_STEP - under a quarter of the radius, so
 *  anything the path crosses is within the radius of some point's axis (a bar
 *  a centimetre thick through the middle of the body reads 0.35 deep). The
 *  body is `body` tall throughout: a crouched move is crouched from its first
 *  step (the motor flips the stance as the move begins). (The first sensor
 *  asked a straight column over the body's head instead; the real path leaves
 *  that column as it rises, so the column refused paths that were clear and
 *  proved nothing the points do not - the audit's mutation run found it.) */
function pathClear(collider, m, body) {
  const len = Math.hypot(m.up[0] - m.from[0], m.up[1] - m.from[1], m.up[2] - m.from[2])
    + Math.hypot(m.to[0] - m.up[0], m.to[1] - m.up[1], m.to[2] - m.up[2]) + 2 * m.arc;
  const n = Math.max(6, Math.ceil(len / PARKOUR_PATH_STEP));
  for (let i = 1; i <= n; i++) {
    if (!capsuleFits(collider, movePoint(m, i / n), body)) return false;
  }
  return true;
}

/**
 * THE LEDGE SENSOR. From the feet, looking along `dir` (a horizontal unit
 * vector), is there a lip the hands can take - and where would the body go?
 *
 *   1. THE WALL: rungs up the band (scanFace), or - for a slab thinner than a
 *      rung - its top from above (scanSlab).
 *   2. THE LIP: a down ray just past the face (PARKOUR_EDGE_INSET) from the
 *      first height the face is gone - never from a fixed height, which in a
 *      low room starts inside the ceiling - finds the top at the edge: level
 *      enough to stand on, inside the band, the face running up to it.
 *   3. THE TOP: its profile (topProfile) says how deep it is.
 *   4. THE LANDING: the radius and an inset past the face, or the middle of a
 *      top too shallow for that; the body fits there standing, else crouched;
 *      failing that, slid along the face; and the whole path to it proven
 *      (pathClear) - the stage a refusal reached is its reason: no top at the
 *      landing, no room on it, or no way up to it.
 *
 * `opts` = { low, high, radius, stand, crouch, height, footing } - the band,
 * the capsule's radius, its standing and crouched heights, its height now,
 * and whether the body stands on the ground (the stair check, G5).
 * Answers { ok: false, why } when there is no lip in reach, else { ok: true,
 * lipY, rise, normal, into, face, depth, faceKey, mantle, why } - `mantle` is
 * { up, top, crouch, split, arc, key } when the body can end on the top, else
 * null with the reason in `why` (a thin top is the clamber's or the vault's:
 * senseOver). The whys are what the pins and the probe read.
 */
export function senseLedge(collider, feet, dir, opts) {
  const { low, high, radius, footing = false } = opts;
  if (!collider?.raycastHit) return { ok: false, why: 'no-collider' };
  const reach = radius + PARKOUR_WALL_REACH;
  const wall = scanFace(collider, feet, dir, low, high, reach) ?? scanSlab(collider, feet, dir, low, high, reach, radius);
  if (!wall) return { ok: false, why: 'no-wall' };
  if (wall.openY == null) return { ok: false, why: 'too-high' };
  const wn = wall.normal;                       // out of the wall, toward the body
  const into = [-wn[0], 0, -wn[2]];
  // 2. the lip
  const ey = wall.openY + 0.02;
  const ex = feet[0] + dir[0] * wall.faceDist + into[0] * PARKOUR_EDGE_INSET;
  const ez = feet[2] + dir[2] * wall.faceDist + into[2] * PARKOUR_EDGE_INSET;
  const down = collider.surfaceHit([ex, ey, ez], [0, -1, 0], ey - (wall.y - 0.05));
  if (!Number.isFinite(down.dist)) return { ok: false, why: 'no-top' };
  const lipY = ey - down.dist;
  if (!down.normal || down.normal[1] < PARKOUR_TOP_MIN_NY - PARKOUR_RAY_SCATTER) return { ok: false, why: 'steep-top' };
  const rise = lipY - feet[1];
  if (rise > high) return { ok: false, why: 'too-high' };
  if (rise < low - 0.05) return { ok: false, why: 'too-low' };
  const under = collider.raycastHit([feet[0], lipY - PARKOUR_UNDER, feet[2]], dir, wall.faceDist + 0.3);
  if (!Number.isFinite(under.dist)) return { ok: false, why: 'no-lip' };
  const face = [feet[0] + dir[0] * under.dist, lipY, feet[2] + dir[2] * under.dist];
  if (footing) {
    const f = collider.surfaceHit([face[0] + wn[0] * 0.1, lipY - PARKOUR_UNDER, face[2] + wn[2] * 0.1], [0, -1, 0], lipY - feet[1] + 0.5);
    if (Number.isFinite(f.dist) && lipY - PARKOUR_UNDER - f.dist - feet[1] > PARKOUR_FOOTING) return { ok: false, why: 'riser' };
  }
  // 3. the top
  const { depth } = topProfile(collider, face, into, lipY);
  const ledge = { ok: true, lipY, rise, normal: wn, into, face, depth, faceKey: wall.key, mantle: null, why: null };
  return landOn(collider, feet, ledge, opts);
}

/** AUDIT CLIMB-FIELD E3: an eave's hold as a ledge - its edge the face, its normal the wall's - and the way onto its roof
 *  from the hang under it (senseLedge's landing). The ledge sensor reads a lip off the face under it, and an eave
 *  standing out past the grab's reach has none in reach: its hang climbed onto nothing. Answers the ledge, `mantle` set
 *  when there is a way onto the top. */
export function senseEaveLedge(collider, feet, grip, opts) {
  const wn = grip.normal, into = [-wn[0], 0, -wn[2]], face = [grip.face[0], grip.lipY, grip.face[2]];
  const { depth } = topProfile(collider, face, into, grip.lipY);
  const ledge = { ok: true, lipY: grip.lipY, rise: grip.lipY - feet[1], normal: wn, into, face, depth, faceKey: grip.key ?? null, mantle: null, why: null };
  return landOn(collider, feet, ledge, opts);
}

/** senseLedge's 4th stage, THE LANDING, for the ledge it found (filled in place: `mantle`, or the refusal's `why`). */
function landOn(collider, feet, ledge, opts) {
  const { radius, crouch, stand, height = stand } = opts;
  const { lipY, rise, normal: wn, into, face, depth } = ledge;
  const full = radius + PARKOUR_TOP_INSET;
  let s;
  if (depth == null || depth >= full + 0.05) s = full;
  else if (depth >= PARKOUR_MIN_STAND_DEPTH) s = depth / 2;
  else { ledge.why = 'no-top'; return ledge; }
  const tangent = [-into[2], 0, into[0]];
  const bodies = height > crouch + 1e-6 ? [height, crouch] : [height];
  const split = splitFor(rise);
  let stage = 0;   // how far the best try got: 0 no top there, 1 no room on it, 2 no way up to it
  for (const body of bodies) {
    for (const n of PARKOUR_NUDGE) {
      const fx = face[0] + tangent[0] * n, fz = face[2] + tangent[2] * n;
      const land = landingAt(collider, fx, fz, into, lipY, s, radius);
      if (!land) continue;
      stage = Math.max(stage, 1);
      const top = [fx + into[0] * s, land.y + 0.02, fz + into[2] * s];
      if (!capsuleFits(collider, top, body)) continue;
      stage = 2;
      const upOff = radius + PARKOUR_UP_GAP;
      const up = [fx + wn[0] * upOff, lipY + PARKOUR_UP_GAP, fz + wn[2] * upOff];
      if (!capsuleFits(collider, up, body)) continue;
      if (!pathClear(collider, path(feet, up, top, split, PARKOUR_MANTLE_ARC), body)) continue;
      ledge.mantle = { up, top, crouch: body < height - 1e-6, split, arc: PARKOUR_MANTLE_ARC, key: land.key };
      return ledge;
    }
  }
  ledge.why = ['no-top', 'no-room', 'no-room-up'][stage];
  return ledge;
}

/**
 * OVER A THIN TOP - the vault's question and the clamber's, over a ledge
 * senseLedge found: does the top end within a stride of the face, is there a
 * floor behind it within `maxDrop` of the lip, and does the body pass over it
 * - the whole way proven - to a point past its far edge? Answers { up, over,
 * depth, floorY, key } or null. AUDIT CLIMB1 F3: the first vault asked only
 * its landing and one point over the top, and a down ray that started inside
 * the wall behind a step read "past the far edge": the body was vaulted into
 * the wall. G6: and it asked nothing of the far side - a railing over a 10 m
 * drop was vaulted into the drop.
 */
export function senseOver(collider, feet, ledge, opts, maxDrop) {
  if (!(ledge?.ok) || ledge.depth == null || ledge.depth > PARKOUR_VAULT_DEPTH) return null;
  const { radius, stand, height = stand } = opts;
  const { face, into, normal, lipY, depth } = ledge;
  const y = lipY + PARKOUR_VAULT_CLEAR;
  const out = depth + radius + 0.1;
  const tangent = [-into[2], 0, into[0]];
  for (const n of PARKOUR_NUDGE) {
    const fx = face[0] + tangent[0] * n, fz = face[2] + tangent[2] * n;
    const up = [fx + normal[0] * (radius + PARKOUR_UP_GAP), y, fz + normal[2] * (radius + PARKOUR_UP_GAP)];
    const over = [fx + into[0] * out, y, fz + into[2] * out];
    const below = collider.surfaceHit([over[0], y + 0.05, over[2]], [0, -1, 0], maxDrop + PARKOUR_VAULT_CLEAR + 0.05);
    if (!Number.isFinite(below.dist)) continue;
    if (!capsuleFits(collider, up, height) || !capsuleFits(collider, over, height)) continue;
    if (!pathClear(collider, path(feet, up, over, 0.4, 0.1), height)) continue;
    return { up, over, depth, floorY: y + 0.05 - below.dist, key: ledge.faceKey };
  }
  return null;
}

/** The vault's own question: a lip at the waist or under, and a fall beyond
 *  that could not hurt (PARKOUR_SAFE_DROP). */
export function senseVault(collider, feet, ledge, opts) {
  if (!(ledge?.ok) || ledge.rise > PARKOUR_VAULT_MAX) return null;
  return senseOver(collider, feet, ledge, opts, PARKOUR_SAFE_DROP);
}

/** A mantle's move: from the feet, up the face, onto the top - the path the
 *  sensor proved (its split and arc are the sensor's). The first segment's
 *  share of the time grows with the rise - a waist-high step-up is mostly the
 *  step over, a head-high pull-up mostly the pull. */
export function planMantle(feet, ledge, skill) {
  const { up, top, crouch, split, arc, key } = ledge.mantle;
  return {
    kind: 'mantle',
    from: [feet[0], feet[1], feet[2]],
    up: [...up],
    to: [...top],
    split, arc,
    dur: mantleDuration(ledge.rise, skill),
    crouch: !!crouch,
    exit: null,
    key: key ?? null,
    t: 0,
  };
}

/** A clamber's move: up the face, over the thin top, and off its far side at a
 *  step's pace onto the floor behind (a climb - it trains Climbing). */
export function planClamber(feet, ledge, over, skill) {
  return {
    kind: 'mantle',
    from: [feet[0], feet[1], feet[2]],
    up: [...over.up],
    to: [...over.over],
    split: 0.4, arc: 0.1,
    dur: mantleDuration(ledge.rise, skill) * 1.15,
    crouch: false,
    exit: [ledge.into[0] * PARKOUR_OVER_EXIT, ledge.into[2] * PARKOUR_OVER_EXIT],
    exitVy: 0,
    key: over.key ?? null,
    t: 0,
  };
}

/** A vault's move: from the feet up the face to clear the top, over it, and
 *  out beyond the far edge, where the body is handed back to the fall with
 *  its momentum along the wall's own normal (`exitSpeed` m/s) and a small
 *  rise. Its pace is the Jumping skill's. */
export function planVault(feet, ledge, vault, skill, exitSpeed) {
  const s = Math.max(PARKOUR_VAULT_EXIT_MIN, exitSpeed || 0);
  return {
    kind: 'vault',
    from: [feet[0], feet[1], feet[2]],
    up: [...vault.up],
    to: [...vault.over],
    split: 0.4, arc: 0.1,
    dur: vaultDuration(ledge.rise, skill),
    crouch: false,
    exit: [ledge.into[0] * s, ledge.into[2] * s],
    exitVy: PARKOUR_VAULT_EXIT_VY,
    key: vault.key ?? null,
    t: 0,
  };
}

/** Where a move's feet are at normalised time t: the rise (from -> up) eased
 *  at both ends, then the step over (up -> to) with a small arc over the lip.
 *  Both segments end where the sensor proved a capsule fits, and the first
 *  never comes nearer the face than `up` does. */
export function movePoint(m, t, out = [0, 0, 0]) {
  const u = clamp01(t);
  if (u <= m.split) {
    const k = smooth(m.split > 0 ? u / m.split : 1);
    out[0] = lerp(m.from[0], m.up[0], k);
    out[1] = lerp(m.from[1], m.up[1], k);
    out[2] = lerp(m.from[2], m.up[2], k);
  } else {
    const v = (u - m.split) / (1 - m.split);
    const k = smooth(v);
    out[0] = lerp(m.up[0], m.to[0], k);
    out[1] = lerp(m.up[1], m.to[1], v) + m.arc * Math.sin(Math.PI * v);
    out[2] = lerp(m.up[2], m.to[2], k);
  }
  return out;
}

/** Shift a move with the world (the motor's offsetOrigin) or with a deck that
 *  carries the body (carryBy) - and the lip of the hang it ends in (AUDIT
 *  CLIMB2 C5: left behind, the hang a catch or a corner arrived in sought its
 *  lip where it had been, and the hands let go). */
export function offsetMove(m, offset) {
  for (const p of [m.from, m.up, m.to]) {
    p[0] += offset[0]; p[1] += offset[1]; p[2] += offset[2];
  }
  if (m.hang) m.hang.lipY += offset[1];
  if (m.next) offsetMove(m.next, offset);   // CLIMB-DOWN: the move chained on after it
}

/** AUDIT CLIMB1 F5: a move onto what moves - a boat's hull, a lift - rides it.
 *  `was` and `now` are the bucket's poses ({ t, r } - collider.bucketPose); the
 *  path is carried by the rigid motion between them - into the bucket's frame
 *  at `was`, out at `now` (collider.js intoBucket's convention: local =
 *  r (p - t), so world = r-transposed local + t). */
export function carryMove(m, was, now) {
  const y0 = m.to[1];
  for (const p of [m.from, m.up, m.to]) carryPoint(p, was, now);
  if (m.hang) carryLip(m.hang, m.to[1] - y0, was, now);   // AUDIT CLIMB2 C5: the hang it ends in, as a hold is carried
  if (m.next) carryMove(m.next, was, now);   // CLIMB-DOWN: the move chained on after it
}

/** A hold's (or a move's hang's) wall turned with its bucket, its lip raised
 *  as far as the body under it. */
function carryLip(hold, rise, was, now) {
  const n = carryPoint([hold.normal[0], 0, hold.normal[2]], was, now, true);
  const l = Math.hypot(n[0], n[2]) || 1;
  hold.normal = [n[0] / l, 0, n[2] / l];
  if (hold.lipY != null) hold.lipY += rise;
}

/** A point carried by a bucket's rigid motion from `was` to `now` (turned
 *  only, with `turn` - a direction). */
function carryPoint(p, was, now, turn = false) {
  const wr = was.r, nr = now.r;
  const x = p[0] - (turn ? 0 : was.t[0]), y = p[1] - (turn ? 0 : was.t[1]), z = p[2] - (turn ? 0 : was.t[2]);
  const lx = wr ? wr[0] * x + wr[1] * y + wr[2] * z : x;
  const ly = wr ? wr[3] * x + wr[4] * y + wr[5] * z : y;
  const lz = wr ? wr[6] * x + wr[7] * y + wr[8] * z : z;
  p[0] = (nr ? nr[0] * lx + nr[3] * ly + nr[6] * lz : lx) + (turn ? 0 : now.t[0]);
  p[1] = (nr ? nr[1] * lx + nr[4] * ly + nr[7] * lz : ly) + (turn ? 0 : now.t[1]);
  p[2] = (nr ? nr[2] * lx + nr[5] * ly + nr[8] * lz : lz) + (turn ? 0 : now.t[2]);
  return p;
}

// ---------------------------------------------------------------------------
// CLIMB2 - THE HANG, THE SHIMMY, THE GRIP AND THE FREE CLIMB (the laws; the
// motor's _wallStep lives them).

/** The hand-hold's rungs: level rays this far apart down the lip's window. */
export const PARKOUR_GRIP_RUNG = 0.05;
/** What two rays at one surface may differ by and still read it as the
 *  surface it is (a 45-degree roof's rungs, a rung's height apart, are a
 *  rung back each; the float of the hit, not a centimetre of the shape). */
export const PARKOUR_RAY_SCATTER = 0.001;
/** A face the free climber's hands and feet press: its normal's y at most
 *  this (the classic probe took any hit; a floor or a ceiling is no wall). AUDIT CLIMB-FIELD R1: what a top is not -
 *  it was 0.7 (45.6 degrees), and a 46-degree roof was both a top to stand on and a wall to grab, the air's grab
 *  taking the roof itself for a free climb. */
export const PARKOUR_WALL_MAX_NY = PARKOUR_TOP_MIN_NY;

/**
 * THE HAND-HOLD. A lip near `lipY` on the face through `face` (a point on the
 * wall's face line - its y is not read) whose normal is `normal` (out of the
 * wall, toward the body): can the hands hold it, and where does the body hang
 * from it?
 *   1. THE EDGE - level rays from where a hanging body's axis would be, into
 *      the wall, down the window the lip may have moved in (PARKOUR_LIP_FOLLOW)
 *      every PARKOUR_GRIP_RUNG: the lip is where the wall steps OUT toward the
 *      body by the grip's depth - a rung meeting nothing, or a wall set back
 *      (a sill's), over one meeting the face where it was expected - or where
 *      a top no steeper than the top's limit (50) rises from it (an eave: its roof is
 *      the grip's depth back only a rung or two up, so the depth is read up
 *      the rungs the top rises through). A rung on the face is one the rung
 *      under it stands out from by no more than the edge's inset: a rung on
 *      a roof is not, however near the edge. No such step is no lip here: a
 *      wall that runs on through the window, or air;
 *   2. THE TOP - a ray down just past the face from the open rung: no steeper
 *      than the top's limit, in the window;
 *   3. THE FACE UNDER IT - a level ray just under the top meets the face, its
 *      normal within PARKOUR_FACE_FOLLOW of the one expected (the hang follows
 *      a curving wall and does not turn a corner); under an eave, whose roof
 *      runs on past the edge, the ray from the face's rung under the lip;
 *   4. THE HANG (with `fit`) - the body off the face by its radius and a gap,
 *      the lip PARKOUR_HANG_DROP over its feet, fitting there standing.
 * AUDIT CLIMB-FIELD E1: no lip on the face, and the face no plain wall - THE EAVE over it (senseEave, below; `eave`
 * false asks the face's own law alone).
 * Answers { lipY, normal, face, feet, key, eave? } or null. `opts` = { radius, stand }.
 */
export function senseGrip(collider, face, normal, lipY, opts, fit = true, eave = true) {
  if (!collider?.raycastHit || !Number.isFinite(lipY)) return null;
  const seen = new Map();
  const g = plainGrip(collider, face, normal, lipY, opts, fit, seen);
  if (g || !eave) return g;
  // AUDIT CLIMB-FIELD E1: no lip on the face - is there an eave over it? Not over a plain wall (every rung cast met the
  // face where it was expected), which is every step of a free climb up the middle of one - CRACK-LIP: a rung through a
  // crack between the wall's pieces, the face going on over it, is the plain wall's too
  const back = opts.radius + PARKOUR_HANG_GAP;
  const dir = [-normal[0], 0, -normal[2]], ox = face[0] + normal[0] * back, oz = face[2] + normal[2] * back;
  for (const [i, d] of seen) {
    if (Math.abs(d - back) <= PARKOUR_EDGE_INSET) continue;
    if (!Number.isFinite(d) && faceGoesOn(collider, ox, lipY + PARKOUR_LIP_FOLLOW - i * PARKOUR_GRIP_RUNG, oz, dir, back, PARKOUR_GRIP_RUNG)) continue;
    return senseEave(collider, face, normal, lipY, opts, fit);
  }
  return null;
}

/** senseGrip's own law: the lip on the face through `face` (above). `seen` keeps the rungs it cast. */
function plainGrip(collider, face, normal, lipY, opts, fit, seen) {
  const { radius, stand } = opts;
  const dir = [-normal[0], 0, -normal[2]];
  const back = radius + PARKOUR_HANG_GAP;
  const ox = face[0] + normal[0] * back, oz = face[2] + normal[2] * back;
  const far = back + PARKOUR_LIP_FOLLOW + PARKOUR_GRIP_DEPTH + 0.05;
  const rungs = Math.round((2 * PARKOUR_LIP_FOLLOW) / PARKOUR_GRIP_RUNG);
  const rungY = (i) => lipY + PARKOUR_LIP_FOLLOW - i * PARKOUR_GRIP_RUNG;
  const at = (i) => {   // rung i's distance into the wall (Infinity for none), each ray cast once
    if (!seen.has(i)) { const d = collider.raycast([ox, rungY(i), oz], dir, far); seen.set(i, Number.isFinite(d) ? d : Infinity); }
    return seen.get(i);
  };
  let hiY = null, loY = null;
  for (let i = 1; i <= rungs && hiY == null; i++) {
    const dist = at(i);
    // AUDIT CLIMB-FIELD R1: the rung over it need only stand back AT ALL - the depth below is the test. It asked the
    // edge's inset, and over an eave the rung over the face can stand a centimetre over the edge: a 46-degree roof's
    // rung 3 cm up stands 2.9 cm back, and with no rung higher in the window the eave was no hold
    if (Math.abs(dist - back) > PARKOUR_LIP_FOLLOW || at(i - 1) - dist <= PARKOUR_RAY_SCATTER) continue;
    if (dist - at(i + 1) > PARKOUR_EDGE_INSET) continue;   // a rung on a top rising away from the edge, not on the face
    // CRACK-LIP (FIELD BUGS 2026-10-02): an open rung with the face going on a crack's height over it is the slot
    // between two of the wall's pieces - a free climb took it for a lip, hung from it, found nothing there and let go
    if (!Number.isFinite(at(i - 1)) && faceGoesOn(collider, ox, rungY(i - 1), oz, dir, dist, PARKOUR_GRIP_RUNG)) continue;
    // AUDIT CLIMB2 C1: the step's depth, up the rungs a top no steeper than the top's limit rises through (each its
    // run back - PARKOUR_TOP_RUN rungs, a rung at 45 degrees, AUDIT CLIMB-FIELD R1 - less the rays' scatter: a wall
    // standing up again, or set back a few centimetres a rung, is no such top); a level top or a set-back wall is the
    // depth at the first
    let deep = at(i - 1);
    for (let j = i - 2; j >= i - 3 && deep - dist < PARKOUR_GRIP_DEPTH; j--) {
      if (at(j) - deep < PARKOUR_GRIP_RUNG * PARKOUR_TOP_RUN - PARKOUR_RAY_SCATTER) break;
      deep = at(j);
    }
    if (deep - dist >= PARKOUR_GRIP_DEPTH) { hiY = rungY(i - 1); loY = rungY(i); }
  }
  if (hiY == null) return null;
  // 2. the top, just past the face, from the open rung
  const d0 = collider.raycast([ox, loY, oz], dir, far);
  const ex = ox + dir[0] * (d0 + PARKOUR_EDGE_INSET), ez = oz + dir[2] * (d0 + PARKOUR_EDGE_INSET);
  const top = collider.surfaceHit([ex, hiY + 0.01, ez], [0, -1, 0], hiY - loY + 0.06);
  if (!Number.isFinite(top.dist) || !top.normal || top.normal[1] < PARKOUR_TOP_MIN_NY - PARKOUR_RAY_SCATTER) return null;
  const y = hiY + 0.01 - top.dist;
  if (Math.abs(y - lipY) > PARKOUR_LIP_FOLLOW + 0.01) return null;
  // 3. the face under it - under an eave the roof runs on past the edge, and the face is the rung's under the lip
  const under = faceHit(collider, [ox, y - PARKOUR_UNDER, oz], dir, far)
    ?? faceHit(collider, [ox, Math.min(y - PARKOUR_UNDER, loY - PARKOUR_GRIP_RUNG), oz], dir, far);
  if (!under || under.normal[0] * normal[0] + under.normal[2] * normal[2] < PARKOUR_FACE_FOLLOW - PARKOUR_RAY_SCATTER) return null;
  const n = under.normal;
  const fx = ox + dir[0] * under.dist, fz = oz + dir[2] * under.dist;
  // 4. the hang
  const feet = [fx + n[0] * back, y - PARKOUR_HANG_DROP, fz + n[2] * back];
  if (fit && !capsuleFits(collider, feet, stand)) return null;
  return { lipY: y, normal: n, face: [fx, y, fz], feet, key: top.key ?? under.key ?? null };
}

// ---- AUDIT CLIMB-FIELD E1: THE EAVE (Mac: "You cant mantle the bottom of roofs, you get stuck") -----------------------
//
// Daggerfall's roofs stand OUT from their walls: of the town blocks' 392 building models, 151 carry a soffit, the common
// one a 0.4 m overhang whose roof rises from a knife edge (ARCH3D 201: wall to 3.22, soffit 3.22 out to 0.4, the roof
// 37 degrees up from the edge; 127: a soffit falling 3.22 to 3.03 under a 46-degree roof). The hand-hold above reads the
// lip where a face steps OUT - and an eave steps IN: the free climb's head met the soffit, the rungs over it met the roof
// nearer than the wall, and the climber hung on under it until the grip ran out (measured on three real town blocks: 380
// of 612 climbs). So when the face shows no lip and is not a plain wall, the edge is sought OUT from it: down rays over
// the face's normal, from past the farthest eave the hands reach in, the first top met is the eave, its edge bisected.
// A face standing under that edge (a fascia, a sill's front) is the hand-hold's own law again, from that face; none (the
// wall set back under a soffit) is an overhang, and the body hangs free under the edge, off it as off a face.

/** The farthest an eave's edge stands out from the face line and is still in the hands' reach. */
export const PARKOUR_EAVE_OUT = 0.8;
/** The eave is sought in from past that by down rays this far apart, and its edge bisected this many times (3 mm). */
export const PARKOUR_EAVE_STEP = 0.1;
export const PARKOUR_EAVE_BISECT = 5;
/** ...and as far back as this inside the face line (a hang's re-ask, its face the edge, on an eave that curves in). */
export const PARKOUR_EAVE_IN = 0.2;
const DOWN = Object.freeze([0, -1, 0]);

/** THE EAVE. Over the face through `face` (normal `normal`, out of the wall), a lip near `lipY` standing out from it:
 *  answers senseGrip's grip (`eave: true` for an overhang's, its face the edge itself) or null. */
function senseEave(collider, face, normal, lipY, opts, fit) {
  const { radius, stand } = opts;
  const n = normal, back = radius + PARKOUR_HANG_GAP;
  const y0 = lipY + PARKOUR_LIP_FOLLOW + 0.3, len = 2 * PARKOUR_LIP_FOLLOW + 0.3;
  // what a down ray `s` out from the face line meets, from over the window to under it, or null - the meshes' alone: an
  // eave is a building's, and the terrain is never a hold (CLIMB1's law - a cliff of heightmap is no eave to lower from)
  const down = (s) => {
    const h = collider.raycastHit([face[0] + n[0] * s, y0, face[2] + n[2] * s], DOWN, len);
    return Number.isFinite(h.dist) && h.normal ? h : null;
  };
  const isTop = (h) => !!h && h.normal[1] >= PARKOUR_TOP_MIN_NY - PARKOUR_RAY_SCATTER;
  // 1. THE EDGE: open air past the farthest eave, then in to the first thing met - a top, or no eave
  let a = PARKOUR_EAVE_OUT + PARKOUR_EAVE_STEP, b = null;
  if (down(a)) return null;
  for (let s = PARKOUR_EAVE_OUT; s >= -PARKOUR_EAVE_IN - 1e-9; s -= PARKOUR_EAVE_STEP) {
    const h = down(s);
    if (!h) { a = s; continue; }
    if (!isTop(h)) return null;
    b = s;
    break;
  }
  if (b == null) return null;
  for (let k = 0; k < PARKOUR_EAVE_BISECT; k++) { const m = (a + b) / 2; if (down(m)) b = m; else a = m; }
  const ex = face[0] + n[0] * b, ez = face[2] + n[2] * b;
  // 2. THE TOP: at the edge itself (its height, which the face under it is asked under), and a lip's inset in (the
  // hands' hold, in the window), running in the grip's depth no lower than the lip
  const atEdge = down(b - 0.005), inset = down(b - PARKOUR_EDGE_INSET), deep = down(b - PARKOUR_GRIP_DEPTH);
  if (!isTop(atEdge) || !isTop(inset) || !isTop(deep)) return null;
  const edgeY = y0 - atEdge.dist, y = y0 - inset.dist;
  if (Math.abs(y - lipY) > PARKOUR_LIP_FOLLOW + 0.01 || y0 - deep.dist < y - PARKOUR_TOP_DROP) return null;
  // 3. UNDER THE EDGE: a face there is the hand-hold's own law, from that face (a fascia, a sill's front - and a sill too
  // thin for the fingers is as thin from here); none in the grip's depth is an overhang
  const q = [ex + n[0] * back, Math.min(edgeY, y) - PARKOUR_UNDER, ez + n[2] * back];
  const under = collider.raycastHit(q, [-n[0], 0, -n[2]], back + PARKOUR_GRIP_DEPTH);
  if (Number.isFinite(under.dist)) {
    return plainGrip(collider, [q[0] - n[0] * under.dist, 0, q[2] - n[2] * under.dist], n, lipY, opts, fit, new Map());
  }
  // 4. THE HANG: under the edge, off it by the body's radius and the gap - turned with the roof where its pitch faces
  // within the follow of the face's (a round tower's cone), the face's own otherwise (a flat slab)
  const tn = inset.normal, tl = Math.hypot(tn[0], tn[2]);
  let nn = n;
  if (tl > 0.1 && (tn[0] * n[0] + tn[2] * n[2]) / tl >= PARKOUR_FACE_FOLLOW) nn = [tn[0] / tl, 0, tn[2] / tl];
  const feet = [ex + nn[0] * back, y - PARKOUR_HANG_DROP, ez + nn[2] * back];
  const hangs = !fit || capsuleFits(collider, feet, stand);
  return hangs ? { lipY: y, normal: nn, face: [ex, y, ez], feet, key: inset.key ?? null, eave: true } : null;
}

/** AUDIT CLIMB-FIELD E2: THE EAVE AHEAD. A jump at an eave whose wall stands back past the grab's reach (a body under
 *  or just outside a 0.4 m overhang has its wall 0.8-1.0 m off) meets no face for the ledge sensor to read the lip by,
 *  and caught nothing unless it stood under the soffit. From the body looking along `dir`: down rays ahead from over
 *  the band (`opts` the ledge sensor's: low, high, radius, stand), the first top in it is a roof - and its edge toward
 *  the body, sought by the eave's own law from there, is the hold: an overhang's only (a face under the edge is the
 *  ledge sensor's). Answers senseGrip's grip, or null. */
export function senseEaveAhead(collider, feet, dir, opts) {
  if (!collider?.raycastHit) return null;
  const { low, high, radius } = opts;
  const n = [-dir[0], 0, -dir[2]], y0 = feet[1] + high + 0.05;
  for (const d of [radius + 0.1, radius + 0.25, radius + PARKOUR_WALL_REACH]) {
    if (Number.isFinite(collider.raycast([feet[0], y0, feet[2]], dir, d + 0.02))) return null;
    const px = feet[0] + dir[0] * d, pz = feet[2] + dir[2] * d;
    const h = collider.raycastHit([px, y0, pz], DOWN, high + 0.05 - low);   // a roof: the meshes' (the eave's own law)
    if (!Number.isFinite(h.dist) || !h.normal || h.normal[1] < PARKOUR_TOP_MIN_NY - PARKOUR_RAY_SCATTER) continue;
    // the roof rises from its edge toward the point met: the edge is sought from there down the windows under it
    for (let k = 0; k < 4; k++) {
      const g = senseGrip(collider, [px, 0, pz], n, y0 - h.dist - k * 2 * PARKOUR_LIP_FOLLOW, opts);
      if (g) return g.eave && g.lipY - feet[1] >= low - 0.05 ? g : null;
    }
  }
  return null;
}

/** Is the way from `feet` into the hang the grip found clear the whole way
 *  (the catch's path, proven as a mantle's is)? */
export function catchClear(collider, feet, grip, height) {
  return pathClear(collider, path(feet, grip.feet, grip.feet, 1, 0), height);
}

/** A catch's move: from where the body was caught into the hang under the lip,
 *  in PARKOUR_CATCH_S. It ends in the hang (`hang`), not on a top. */
export function planCatch(feet, grip) {
  return {
    kind: 'catch',
    from: [feet[0], feet[1], feet[2]],
    up: [...grip.feet],
    to: [...grip.feet],
    split: 1, arc: 0,
    dur: PARKOUR_CATCH_S,
    crouch: false,
    exit: null,
    hang: { normal: [...grip.normal], lipY: grip.lipY },
    key: grip.key ?? null,
    t: 0,
  };
}

/** A corner the shimmy turns is another face turned from the one held past
 *  the follow (PARKOUR_FACE_FOLLOW - a bend the grip follows on its own, its
 *  30 degrees taken with the rays' scatter: a 12-sided room's bends, exactly
 *  that, fell between the two). AUDIT CLIMB2 G5: a
 *  building's square corner, an octagonal tower's 45 degrees, a hexagon's 60
 *  - the first cut took only corners within 30 degrees of square, and the
 *  shimmy stopped at the first bend of every tower or room that was not
 *  round. Round an outer corner the other face is sought this far past the
 *  edge (its turn read off it; one too sharp to meet there is taken as
 *  square). */
export const PARKOUR_CORNER_PROBE = 0.1;
/** Round an inner corner the body comes off the first face by this more. */
export const PARKOUR_CORNER_OFF = 0.1;
/** Round an outer corner the hands take the other face this far past the
 *  edge, and the body swings round the edge this far clear of it. */
export const PARKOUR_CORNER_IN = 0.25;
export const PARKOUR_CORNER_CLEAR = 0.1;

/** Is the whole of a move's path clear for a body this tall (pathClear)? */
export function moveClear(collider, m, height) {
  return pathClear(collider, m, height);
}

/** A corner's move: the hang carried round it by `mid` into the hang on the
 *  other face, at the shimmy's pace (`live`: the LIVE Climbing, shimmySpeed's).
 *  Unbilled: a shimmy is no new exertion. */
export function planCorner(from, mid, grip, skill, live = 0) {
  const len = Math.hypot(mid[0] - from[0], mid[1] - from[1], mid[2] - from[2])
    + Math.hypot(grip.feet[0] - mid[0], grip.feet[1] - mid[1], grip.feet[2] - mid[2]);
  return {
    kind: 'corner',
    from: [from[0], from[1], from[2]],
    up: [...mid],
    to: [...grip.feet],
    split: 0.5, arc: 0,
    dur: Math.max(0.2, len / shimmySpeed(skill, live)),
    crouch: false,
    exit: null,
    hang: { normal: [...grip.normal], lipY: grip.lipY },
    bill: false,
    key: grip.key ?? null,
    t: 0,
  };
}

/** The free climber's wall: level rays from the axis along `dir` (into the
 *  wall) at PARKOUR_CONTACT_AT shares of the body's height; the nearest to
 *  meet a wall within the radius and `reach` (PARKOUR_CONTACT; a climb down
 *  from a hang seeks the wall under a sill as far as the grab's own reach,
 *  PARKOUR_WALL_REACH, until the hug presses the body to it). Answers { dist,
 *  normal, key } (the normal out of the wall, level) or null. */
export function wallContact(collider, feet, dir, height, radius, reach = PARKOUR_CONTACT) {
  if (!collider?.raycastHit) return null;
  let best = null;
  for (const k of PARKOUR_CONTACT_AT) {
    const h = collider.raycastHit([feet[0], feet[1] + height * k, feet[2]], dir, radius + reach);
    if (!Number.isFinite(h.dist) || !h.normal || Math.abs(h.normal[1]) > PARKOUR_WALL_MAX_NY) continue;
    const l = Math.hypot(h.normal[0], h.normal[2]);
    if (!best || h.dist < best.dist) best = { dist: h.dist, normal: [h.normal[0] / l, 0, h.normal[2] / l], key: h.key ?? null };
  }
  return best;
}

/** A hold on what moves rides it: the body carried by the bucket's rigid
 *  motion, the wall's normal turned with it and the lip risen with the body. */
export function carryHold(pos, hold, was, now) {
  const y0 = pos[1];
  carryPoint(pos, was, now);
  carryLip(hold, pos[1] - y0, was, now);
}

// ---- CLIMB-DOWN: the way down (Mac: "So plsyers can get stuck on the very top of roofs") ----------------------------
//
// The climb took players up every wall, and only a fall brought them down: a roof's parapet walled a climber in for
// good (the vault and the clamber refuse its drop, the plain jump cannot clear it), and every other top asked the jump
// off it. Two ways down, both ending in the hang that Back climbs down from (or Crouch lets go of, a body's height
// lower than the top): CROUCH WALKED TO AN EDGE lowers the body over it into a hang from its lip (senseEdge, planLower -
// Assassin's Creed's and Dying Light's own climb down), and JUMP AT A THIN TOP over a drop the clamber would not take
// climbs over it into a hang on its far side (senseOverHang).

/** An edge the lower takes: the floor ahead of the body's front gone more than this under the feet (a step down the
 *  walk takes is none; a drop under the hang's own 1.8 m leaves no room to hang, which senseGrip's fit refuses). */
export const PARKOUR_EDGE_DROP = 1.0;
/** ...the floor asked this far past the body's front (its radius off the axis). */
export const PARKOUR_EDGE_AHEAD = 0.1;
/** The edge between the last floor and the first air, bisected to this. */
export const PARKOUR_EDGE_BISECT = 6;
/** The face under an edge: a level ray this far under the lip, back toward the body from this far out past the edge
 *  (under an eave it meets the wall the roof stands on, as the hang's own rays do). */
export const PARKOUR_EDGE_FACE_DROP = 0.1;
export const PARKOUR_EDGE_FACE_OUT = 0.6;
/** Seconds the lower takes over a lip the hands then hang from, at Climbing 0 and 100. */
export const PARKOUR_LOWER_MIN_S = 1.0;
export const PARKOUR_LOWER_MAX_S = 0.6;
/** The lower's first leg (out over the edge) as a share of its time; the rest is the drop into the hang. */
export const PARKOUR_LOWER_SPLIT = 0.4;

/** CLIMB-DOWN: seconds the lower into a hang takes at this Climbing skill. */
export function lowerDuration(skill) {
  return lerp(PARKOUR_LOWER_MIN_S, PARKOUR_LOWER_MAX_S, clamp01(skill / 100));
}

/** What the edge's floor is: ground the walk stands on - the motor's slopeLimit (70 degrees; restated, not read,
 *  for the import cycle, and pinned equal) - so the body walking down a 45-degree roof is on its floor to the eave. */
export const PARKOUR_EDGE_FLOOR_NY = Math.cos((70 * Math.PI) / 180);

/** The floor's height under a point, asked from `top` down `reach`, or null (none: past the edge). */
function floorAt(collider, x, top, z, reach) {
  const h = collider.surfaceHit([x, top, z], [0, -1, 0], reach);
  return Number.isFinite(h.dist) && h.normal && h.normal[1] >= PARKOUR_EDGE_FLOOR_NY ? top - h.dist : null;
}

/** The face under a lip at `lipY`, out from `edge` along `out` (horizontal unit): a level ray back toward the edge
 *  from PARKOUR_EDGE_FACE_OUT past it - { point, normal } (the normal out of the wall, level), or null. */
function faceUnder(collider, edge, out, lipY) {
  const o = [edge[0] + out[0] * PARKOUR_EDGE_FACE_OUT, lipY - PARKOUR_EDGE_FACE_DROP, edge[2] + out[2] * PARKOUR_EDGE_FACE_OUT];
  const h = faceHit(collider, o, [-out[0], 0, -out[2]], PARKOUR_EDGE_FACE_OUT + PARKOUR_WALL_REACH);
  if (!h || h.normal[0] * out[0] + h.normal[2] * out[2] < PARKOUR_FACING_DOT) return null;
  return { point: [o[0] - out[0] * h.dist, lipY, o[2] - out[2] * h.dist], normal: h.normal };
}

/**
 * THE EDGE (CLIMB-DOWN). From the feet, moving along `dir` (a horizontal unit vector): does the floor end within
 * the body's front (PARKOUR_EDGE_AHEAD past its radius) over a drop the walk would fall (PARKOUR_EDGE_DROP) - and is
 * there a lip there the hands can hang from, on the face under it, facing out along `dir`?
 *   1. THE EDGE - the floor asked at the front and, where it is gone, bisected back to the axis: the lip is the last
 *      floor's height (a pitched roof's eave, under the feet on its slope);
 *   2. THE FACE - a level ray back under the lip (faceUnder), facing out within PARKOUR_FACING_DOT of the way walked;
 *   3. THE HANG - senseGrip from outside, the body fitting under the lip, and the way out over the edge and down
 *      into the hang proven clear for the standing body (the move stands it).
 * Answers { grip, lipY } or null. `opts` = the ledge sensor's (radius, stand).
 */
export function senseEdge(collider, feet, dir, opts) {
  if (!collider?.surfaceHit || !collider.raycastHit) return null;
  const { radius, stand } = opts;
  const top = feet[1] + PARKOUR_TOP_PROBE, reach = PARKOUR_TOP_PROBE + PARKOUR_EDGE_DROP;
  const ahead = radius + PARKOUR_EDGE_AHEAD;
  if (floorAt(collider, feet[0] + dir[0] * ahead, top, feet[2] + dir[2] * ahead, reach) != null) return null;
  let lo = 0, hi = ahead, lipY = floorAt(collider, feet[0], top, feet[2], reach);
  if (lipY == null) return null;   // no floor under the axis: no edge the body stands at
  for (let i = 0; i < PARKOUR_EDGE_BISECT; i++) {
    const mid = (lo + hi) / 2;
    const y = floorAt(collider, feet[0] + dir[0] * mid, top, feet[2] + dir[2] * mid, reach);
    if (y == null) hi = mid; else { lo = mid; lipY = y; }
  }
  const edge = [feet[0] + dir[0] * lo, lipY, feet[2] + dir[2] * lo];
  // AUDIT CLIMB-FIELD E1: an eave standing further out than the face's ray reaches back (past 0.5 m) shows it no wall -
  // its hold is sought from the edge itself, the eave's own law (an overhang's only)
  const face = faceUnder(collider, edge, dir, lipY);
  const grip = face ? senseGrip(collider, face.point, face.normal, lipY, opts) : senseGrip(collider, edge, dir, lipY, opts);
  if (!face && !grip?.eave) return null;
  if (!grip) return null;
  const m = planLower(feet, grip, 0);
  return pathClear(collider, m, stand) ? { grip, lipY: grip.lipY } : null;
}

/** CLIMB-DOWN: the lower's move - out over the edge at the lip's height (a mantle's `up`, the body just off the
 *  face), then down the face into the hang under the lip. It ends held (`hang`), standing: the move stands a crouched
 *  body (`stand`) as the second leg begins - the eye rising on the stand's own clock while the feet go down, so it
 *  sinks the whole way, where stood at the start it rose 0.4 m over the edge before it fell. */
export function planLower(feet, grip, skill) {
  const n = grip.normal, off = PARKOUR_BODY_RADIUS + PARKOUR_UP_GAP;
  return {
    kind: 'lower',
    from: [feet[0], feet[1], feet[2]],
    up: [grip.face[0] + n[0] * off, Math.max(feet[1], grip.lipY) + PARKOUR_UP_GAP, grip.face[2] + n[2] * off],
    to: [...grip.feet],
    split: PARKOUR_LOWER_SPLIT, arc: 0,
    dur: lowerDuration(skill),
    crouch: false,
    stand: true,
    exit: null,
    hang: { normal: [...grip.normal], lipY: grip.lipY },
    key: grip.key ?? null,
    t: 0,
  };
}

/**
 * OVER A THIN TOP, INTO A HANG (CLIMB-DOWN): a parapet or a rail whose far side drops further than the clamber steps
 * down (PARKOUR_OVER_DROP) - climbed over, and the body lowered into a hang from the top's far edge, facing back at it.
 * The near face's `up` and the far edge's `over` are senseOver's points; the far face under the top (faceUnder,
 * from past the far edge) holds the hang (senseGrip). The way up and over, and the way down from there, proven clear.
 * Answers { up, over, grip } or null.
 */
export function senseOverHang(collider, feet, ledge, opts) {
  if (!(ledge?.ok) || ledge.depth == null || ledge.depth > PARKOUR_VAULT_DEPTH) return null;
  const { radius, stand } = opts;
  const { face, into, normal, lipY, depth } = ledge;
  const y = lipY + PARKOUR_VAULT_CLEAR;
  const tangent = [-into[2], 0, into[0]];
  for (const n of PARKOUR_NUDGE) {
    const fx = face[0] + tangent[0] * n, fz = face[2] + tangent[2] * n;
    const far = faceUnder(collider, [fx + into[0] * depth, lipY, fz + into[2] * depth], into, lipY);
    if (!far) continue;
    const grip = senseGrip(collider, far.point, far.normal, lipY, opts);
    if (!grip) continue;
    const off = radius + PARKOUR_UP_GAP;
    const up = [fx + normal[0] * off, y, fz + normal[2] * off];
    const over = [grip.face[0] + grip.normal[0] * off, y, grip.face[2] + grip.normal[2] * off];
    if (!capsuleFits(collider, up, stand) || !capsuleFits(collider, over, stand)) continue;
    if (!pathClear(collider, path(feet, up, over, 0.4, 0.1), stand)) continue;
    if (!pathClear(collider, path(over, over, grip.feet, 0, 0), stand)) continue;
    return { up, over, grip };
  }
  return null;
}

/** CLIMB-DOWN: over a thin top and down into a hang on its far side - a clamber's move up and over (billed as a
 *  climb), and chained on it (`next`) the drop into the hang, unbilled. */
export function planOverHang(feet, ledge, oh, skill) {
  const down = {
    kind: 'lower',
    from: [...oh.over],
    up: [...oh.over],
    to: [...oh.grip.feet],
    split: 0, arc: 0,
    dur: lowerDuration(skill) * (1 - PARKOUR_LOWER_SPLIT),
    crouch: false,
    stand: true,   // AUDIT CLIMB-ARC D4: a crouched Jump over the parapet hangs standing (the lower's own law), never crouched
    exit: null,
    hang: { normal: [...oh.grip.normal], lipY: oh.grip.lipY },
    key: oh.grip.key ?? null,
    t: 0,
  };
  return {
    kind: 'mantle',
    from: [feet[0], feet[1], feet[2]],
    up: [...oh.up],
    to: [...oh.over],
    split: 0.4, arc: 0.1,
    dur: mantleDuration(ledge.rise, skill) * 1.15,
    crouch: false,
    exit: null,
    key: ledge.faceKey ?? null,
    next: down,
    t: 0,
  };
}

// ---- CLIMB3: LEAPS (Mac's "Parkour leap, skill-scaled": "a leap from a hang or a sprint off an edge has its own
// longer, flatter arc scaled by Jumping; the plain jump is unchanged") ------------------------------------------------
//
// From a hold - the hang or the free climb - a fresh Jump leaps: with Left or Right to a hand-hold along the wall, with
// nothing (or Forward) and no top to climb onto to one above, with Back off the wall altogether (the eject). On the
// ground a running Jump at an edge is a running leap, and a running Jump at a wall runs up it. A leap to a hand-hold is
// a move along a proven path into the hang (as the catch is); the eject and the running leap are flights, the catch
// armed for them, its reach the leap's (magnetism). Every leap is the Jumping skill's: its reach, its pace, its arc.

/** A side leap reaches a hand-hold this far along the wall from the hands, at Jumping 0 and 100. */
export const PARKOUR_LEAP_SIDE_MIN = 1.5;
export const PARKOUR_LEAP_SIDE_MAX = 2.5;
/** An up leap reaches a lip this far over the one held, at Jumping 0 and 100. */
export const PARKOUR_LEAP_UP_MIN = 1.0;
export const PARKOUR_LEAP_UP_MAX = 1.8;
/** The search for a leap's hold: along the wall every this; the side leap's lips at these heights from the one held
 *  (each asked within senseGrip's own window, PARKOUR_LIP_FOLLOW). */
export const PARKOUR_LEAP_SCAN = 0.1;
export const PARKOUR_LEAP_HEIGHTS = Object.freeze([0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9]);
/** A leap to a hold flies its path at this pace (m/s, at Jumping 0 and 100), over this arc (a side leap's). */
export const PARKOUR_LEAP_SPEED_MIN = 4;
export const PARKOUR_LEAP_SPEED_MAX = 6;
export const PARKOUR_LEAP_ARC = 0.25;
/** The grip a leap off a hold spends at once (the hold it lands in spends its own after). */
export const PARKOUR_LEAP_GRIP = 0.1;
/** The eject: off the wall at this speed out (m/s) and this up, at Jumping 0 and 100. */
export const PARKOUR_EJECT_OUT_MIN = 3.5;
export const PARKOUR_EJECT_OUT_MAX = 5.5;
export const PARKOUR_EJECT_UP_MIN = 3.0;
export const PARKOUR_EJECT_UP_MAX = 4.5;
/** The running leap: a flight to a landing level with the take-off this far ahead, over an apex this high, at Jumping 0
 *  and 100 - longer than the plain running jump's 3.4-4.6 m at every skill, and flatter (its apex 0.5-1.1 m). */
export const PARKOUR_RUNLEAP_DIST_MIN = 4.0;
export const PARKOUR_RUNLEAP_DIST_MAX = 7.0;
export const PARKOUR_RUNLEAP_APEX_MIN = 0.45;
export const PARKOUR_RUNLEAP_APEX_MAX = 0.8;
/** ...asked when the floor ends this far ahead of the body's front - or the body left it running this long ago (the
 *  late jump: a press a beat after the edge still leaps, never a plain jump's). */
export const PARKOUR_RUNLEAP_EDGE = 1.2;
export const PARKOUR_COYOTE_S = 0.15;
/** Running is at least this share of the run's speed. */
export const PARKOUR_RUN_SHARE = 0.75;
/** Magnetism: in a leap's flight the catch reaches this much further. */
export const PARKOUR_LEAP_REACH = 0.25;
/** The wall run: a running Jump at a wall this near (from the body's front) runs up it this high (at the skills' 0 and
 *  100 - Climbing and Jumping, averaged) at this pace; a lip coming to the hands on the way is caught there. */
export const PARKOUR_WALLRUN_REACH = 1.0;
export const PARKOUR_WALLRUN_MIN = 1.0;
export const PARKOUR_WALLRUN_MAX = 2.0;
export const PARKOUR_WALLRUN_SPEED = 5;

/** CLIMB3: a leap's reach and pace at this Jumping skill. */
export function leapSideReach(jumping) { return lerp(PARKOUR_LEAP_SIDE_MIN, PARKOUR_LEAP_SIDE_MAX, clamp01(jumping / 100)); }
export function leapUpReach(jumping) { return lerp(PARKOUR_LEAP_UP_MIN, PARKOUR_LEAP_UP_MAX, clamp01(jumping / 100)); }
export function leapSpeed(jumping) { return lerp(PARKOUR_LEAP_SPEED_MIN, PARKOUR_LEAP_SPEED_MAX, clamp01(jumping / 100)); }
/** CLIMB3: the eject's launch - { out, up } m/s - at this Jumping skill. */
export function ejectLaunch(jumping) {
  const t = clamp01(jumping / 100);
  return { out: lerp(PARKOUR_EJECT_OUT_MIN, PARKOUR_EJECT_OUT_MAX, t), up: lerp(PARKOUR_EJECT_UP_MIN, PARKOUR_EJECT_UP_MAX, t) };
}
/** CLIMB3: the running leap's launch - { along, up } m/s - at this Jumping skill under this gravity: the apex and the
 *  distance (to a landing level with the take-off) are the law; the speeds follow. */
export function runLeapLaunch(jumping, gravity) {
  const t = clamp01(jumping / 100);
  const apex = lerp(PARKOUR_RUNLEAP_APEX_MIN, PARKOUR_RUNLEAP_APEX_MAX, t), dist = lerp(PARKOUR_RUNLEAP_DIST_MIN, PARKOUR_RUNLEAP_DIST_MAX, t);
  const up = Math.sqrt(2 * gravity * apex);
  return { along: dist / ((2 * up) / gravity), up };
}
/** CLIMB3: the wall run's height at these skills. */
export function wallRunHeight(climbing, jumping) {
  return lerp(PARKOUR_WALLRUN_MIN, PARKOUR_WALLRUN_MAX, clamp01((clamp01(climbing / 100) + clamp01(jumping / 100)) / 2));
}

/**
 * THE LEAP'S HOLD (CLIMB3). From the hang under `held` ({ face, normal, lipY, feet } - the hold now), a hand-hold the
 * leap reaches: `way` 'up' (a lip over this one, up the same face, from PARKOUR_LIP_FOLLOW past it to `reach`) or
 * 'side' with `side` +1/-1 (the hands' right or left facing the wall: lips along the wall from two hand spans to
 * `reach`, nearest first, each at the heights PARKOUR_LEAP_HEIGHTS from this one). The way there - an arc for a side
 * leap - proven clear for the standing body. Answers the grip (senseGrip's) with the move's `up`, or null.
 */
export function senseLeapHold(collider, feet, held, way, reach, opts, side = 0) {
  if (!collider?.raycastHit || !held) return null;
  const { stand, radius } = opts;
  const n = held.normal, t = [-n[2] * side, 0, n[0] * side], back = radius + PARKOUR_HANG_GAP;
  // the face under a lip near `lipY` along the column of a body at `face` (on the held face's line): the NEAREST face
  // level rays meet in the lip's window - the face under a lip is what stands out (a moulding proud of the wall, a
  // sill), and the held face's own line can be 0.15 m behind it or more (the free climb's hands are on the wall)
  const faceNear = (face, lipY) => {
    const ox = face[0] + n[0] * back, oz = face[2] + n[2] * back;
    let best = null;
    for (let y = lipY - PARKOUR_LIP_FOLLOW - PARKOUR_GRIP_RUNG; y <= lipY + PARKOUR_LIP_FOLLOW + 1e-9; y += PARKOUR_GRIP_RUNG) {
      const h = faceHit(collider, [ox, y, oz], [-n[0], 0, -n[2]], back + PARKOUR_WALL_REACH);
      if (h && (!best || h.dist < best)) best = h.dist;
    }
    return best == null ? face : [ox - n[0] * best, lipY, oz - n[2] * best];
  };
  const tryGrip = (face, lipY, arc) => {
    const g = senseGrip(collider, faceNear(face, lipY), n, lipY, opts);
    if (!g || Math.abs(g.lipY - held.lipY) < 1e-3 && Math.hypot(g.feet[0] - feet[0], g.feet[2] - feet[2]) < 0.05) return null;
    // the way there: out from the wall first to the further of the two holds' distances (a free climber is pressed to
    // the wall, and a hold's lip can stand out over it), then on - an up leap rises there, a side leap arcs over the
    // midpoint
    const out = Math.max(feet[0] * n[0] + feet[2] * n[2], g.feet[0] * n[0] + g.feet[2] * n[2]);
    const mid = way === 'up'
      ? [g.feet[0], feet[1] + 0.25 * (g.feet[1] - feet[1]), g.feet[2]]
      : [(feet[0] + g.feet[0]) / 2, Math.max(feet[1], g.feet[1]) + arc, (feet[2] + g.feet[2]) / 2];
    const shift = out - (mid[0] * n[0] + mid[2] * n[2]);
    mid[0] += n[0] * shift; mid[2] += n[2] * shift;
    return pathClear(collider, path(feet, mid, g.feet, way === 'up' ? 0.3 : 0.5, 0), stand) ? { ...g, up: mid, split: way === 'up' ? 0.3 : 0.5 } : null;
  };
  if (way === 'up') {
    // each ask covers its own window (PARKOUR_LIP_FOLLOW either side): the asks tile the reach, and a lip found past
    // it is not taken
    for (let d = 2 * PARKOUR_LIP_FOLLOW; d - PARKOUR_LIP_FOLLOW <= reach + 1e-9; d += 2 * PARKOUR_LIP_FOLLOW) {
      const g = tryGrip(held.face, held.lipY + d, 0);
      if (g && g.lipY > held.lipY + PARKOUR_LIP_FOLLOW && g.lipY - held.lipY <= reach + 1e-9) return g;
    }
    return null;
  }
  // the lip held runs on this far that way unbroken - the shimmy's, not a leap's: a leap at its own height is to a hold
  // past where it ends (across a gap, a pillar, a window's frame)
  // AUDIT CLIMB-ARC L9: FOLLOWED as the shimmy follows it - each probe a span on from the last grip, along ITS face and
  // at ITS lip's height (a sloped coping, a round tower's ring) - not along the held face's line at the held height,
  // which left a curving or rising lip early and leapt along the very lip the hands could shimmy. Every grip the run
  // passes is kept: a candidate on one of them is the same lip.
  let runs = 0;
  const run = [];
  for (let at = { face: held.face, normal: n, lipY: held.lipY }; runs + PARKOUR_HAND_SPAN <= reach;) {
    const tt = [-at.normal[2] * side, 0, at.normal[0] * side];
    const g = senseGrip(collider, [at.face[0] + tt[0] * PARKOUR_HAND_SPAN, at.lipY, at.face[2] + tt[2] * PARKOUR_HAND_SPAN], at.normal, at.lipY, opts, false);
    if (!g || g.normal[0] * at.normal[0] + g.normal[2] * at.normal[2] < PARKOUR_FACE_FOLLOW - PARKOUR_RAY_SCATTER) break;
    run.push(g);
    at = { face: g.face, normal: g.normal, lipY: g.lipY };
    runs += PARKOUR_HAND_SPAN;
  }
  const onRun = (g) => run.some((r) => Math.hypot(r.face[0] - g.face[0], r.face[2] - g.face[2]) < PARKOUR_HAND_SPAN && Math.abs(r.lipY - g.lipY) < PARKOUR_LIP_FOLLOW);
  for (let s = 2 * PARKOUR_HAND_SPAN; s <= reach + 1e-9; s += PARKOUR_LEAP_SCAN) {
    const face = [held.face[0] + t[0] * s, held.lipY, held.face[2] + t[2] * s];
    for (const dy of PARKOUR_LEAP_HEIGHTS) {
      if (Math.abs(dy) > reach - s + 0.3) continue;   // the reach is the leap's whole way, along and up or down
      if (Math.abs(dy) < PARKOUR_LIP_FOLLOW && s <= runs + PARKOUR_HAND_SPAN) continue;
      const g = tryGrip(face, held.lipY + dy, PARKOUR_LEAP_ARC);
      if (g && !(Math.abs(g.lipY - held.lipY) < PARKOUR_LIP_FOLLOW && s <= runs + PARKOUR_HAND_SPAN) && !onRun(g)) return g;
    }
  }
  return null;
}

/** CLIMB3: a leap's move into the hold senseLeapHold found - its path's own `up`, at the leap's pace. */
export function planLeap(feet, g, jumping) {
  const len = Math.hypot(g.up[0] - feet[0], g.up[1] - feet[1], g.up[2] - feet[2]) + Math.hypot(g.feet[0] - g.up[0], g.feet[1] - g.up[1], g.feet[2] - g.up[2]);
  return {
    kind: 'leap',
    from: [feet[0], feet[1], feet[2]],
    up: [...g.up],
    to: [...g.feet],
    split: g.split ?? 0.5, arc: 0,
    dur: 0.15 + len / leapSpeed(jumping),
    crouch: false,
    exit: null,
    hang: { normal: [...g.normal], lipY: g.lipY },
    key: g.key ?? null,
    t: 0,
  };
}

/**
 * THE WALL RUN (CLIMB3). Running at a wall along `dir`: its face within PARKOUR_WALLRUN_REACH of the body's front, and
 * the body running up it `height` - and a lip the hands then reach (`reach` over the run's top, the air catch's) is
 * caught: the run goes on to the hang under it. No lip there, the run ends against the wall, the hands on it (a free
 * climb). Answers { up, to, grip, normal } (`grip` the lip it ends in, or null) or null. The way there proven clear.
 */
export function senseWallRun(collider, feet, dir, height, reach, opts) {
  if (!collider?.raycastHit) return null;
  const { radius, stand } = opts;
  const hit = faceHit(collider, [feet[0], feet[1] + stand * 0.5, feet[2]], dir, radius + PARKOUR_WALLRUN_REACH);
  if (!hit) return null;
  const n = hit.normal, back = radius + PARKOUR_HANG_GAP;
  const fx = feet[0] + dir[0] * hit.dist, fz = feet[2] + dir[2] * hit.dist;
  const up = [fx + n[0] * back, feet[1] + 0.1, fz + n[2] * back];
  // the lip the run comes to: the first height the face is gone, along the run's own column
  let lipTop = null;
  for (let y = feet[1] + stand * 0.5; y <= feet[1] + height + reach + 1e-9; y += PARKOUR_SCAN_STEP) {
    if (!Number.isFinite(collider.raycast([up[0], y, up[2]], [-n[0], 0, -n[2]], back + PARKOUR_FACE_LEAN + 0.05))) { lipTop = y; break; }
  }
  let grip = null, top = feet[1] + height;
  if (lipTop != null) {
    grip = senseGrip(collider, [fx, lipTop, fz], n, lipTop - PARKOUR_SCAN_STEP / 2, opts);
    if (!grip) return null;   // a lip with no hold under it: no run
    top = grip.feet[1];
  }
  const to = grip ? [...grip.feet] : [up[0], top, up[2]];
  if (to[1] <= feet[1] + 0.2) return null;
  return pathClear(collider, path(feet, up, to, 0.25, 0), stand) ? { up, to, grip, normal: n, key: hit.key ?? null } : null;   // AUDIT CLIMB-ARC L11: the face's own key - a run with no lip rides its hull too
}

/** CLIMB3: the wall run's move - in to the wall and up it at PARKOUR_WALLRUN_SPEED; it ends in the hang at the lip it
 *  came to, or on the wall (`wall`: the hands take it, a free climb). */
export function planWallRun(feet, run) {
  const len = Math.hypot(run.up[0] - feet[0], run.up[2] - feet[2]) + (run.to[1] - run.up[1]);
  return {
    kind: 'wallrun',
    from: [feet[0], feet[1], feet[2]],
    up: [...run.up],
    to: [...run.to],
    split: 0.25, arc: 0,
    dur: 0.1 + len / PARKOUR_WALLRUN_SPEED,
    crouch: false,
    exit: null,
    hang: run.grip ? { normal: [...run.grip.normal], lipY: run.grip.lipY } : null,
    wall: run.grip ? null : { normal: [...run.normal] },
    key: run.grip?.key ?? run.key ?? null,
    t: 0,
  };
}

/** CLIMB3: does the floor end within `ahead` of the body's front along `dir` - a drop past it the walk would fall
 *  (PARKOUR_EDGE_DROP), asked every PARKOUR_LEAP_SCAN? The running leap's edge (a gap between roofs, a wall top's end). */
export function senseDrop(collider, feet, dir, radius, ahead) {
  if (!collider?.surfaceHit) return false;
  // AUDIT CLIMB-ARC L1: each sample asked from the floor the last one found - a BREAK in the floor, not depth under the
  // feet: a staircase falls a riser a tread and never reads as an edge (the running Jump down it was a 7-38 m leap)
  const reach = PARKOUR_TOP_PROBE + PARKOUR_EDGE_DROP;
  let prev = feet[1];
  for (let s = radius; s <= radius + ahead + 1e-9; s += PARKOUR_LEAP_SCAN) {
    const y = floorAt(collider, feet[0] + dir[0] * s, prev + PARKOUR_TOP_PROBE, feet[2] + dir[2] * s, reach);
    if (y == null) return true;
    prev = y;
  }
  return false;
}
