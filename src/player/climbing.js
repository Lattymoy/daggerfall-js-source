// CLIMBING (M3-slice, AUDIT 23 motor-3): DFU ClimbingMotor's CLASSIC
// path (MIT, Daggerfall Workshop) - the Climbing skill's consumer at
// last. AdvancedClimbing OFF is the port's law - Ledger A, THE
// `AdvancedClimbing` SCAFFOLDING IS OFF-ROAD, by name (the same doctrine
// as EnhancedCombatAI): the corner wraps, rappel/hanging handoffs, WallEject,
// ceiling releases and the overhang bumps are all gated on that setting and
// stay with it (RESIDUE). What classic climbing IS (ClimbingMotor.cs):
//   - hold Forward against a wall while horizontally stationary
//     (tolerance 0.12) for 14 system-timer units (x 0.0549254 s);
//     then a skill check at base 70 starts the climb - and a FAILED
//     ground start does NOT reset the timer, so it re-checks every
//     frame (:430-437, the verbatim tally-spam quirk); only the
//     airborne grasp (base 40, catching a wall mid-fall) resets on
//     failure;
//   - every 15 units climbing (5 while slipping) re-checks at base 50
//     (20 to regain a slipping hold); standing still on the wall
//     cannot slip (:450-454);
//   - the abort ladder (:391-405, classic arms): forward released,
//     wall contact lost, levitating, riding, a slip that reached the
//     ground, ground too close below while climbing down/slipping or
//     grasping (:318-320, height/2 + 0.12), or a start that drifted
//     past the horizontal tolerance;
//   - the skill tallies ONCE PER CHECK (ClimbingSkillCheck :828 -
//     before the auto-pass arms), and a failed roll UNDERWATER is
//     forgiven ("Water makes it easier to climb", :837-843).
// The movement itself (the classic ClimbMovement arm :754-758) and
// the wall probe live in the motor - they own the capsule.

import { SYSTEM_TIMER_UPDATES_DIVISOR } from './motor.js';

// ClimbingMotor.cs:75-84, verbatim.
export const CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY = 15;
export const REGAIN_HOLD_SKILL_CHECK_FREQUENCY = 5;
export const REGAIN_HOLD_MIN_CHANCE = 20;
export const START_CLIMB_MIN_CHANCE = 70;
export const CONTINUE_CLIMB_MIN_CHANCE = 50;
export const GRASP_WALL_MIN_CHANCE = 40;
// CalcFrequencyAndToleranceOfWallChecks' classic branch (:522-526).
export const START_CLIMB_SKILL_CHECK_FREQUENCY = 14;
export const START_CLIMB_HORIZONTAL_TOLERANCE = 0.12;
export const KHAJIIT_CLIMBING_BONUS = 30;   // FormulaHelper.CalculateClimbingChance racial arm
/** The HUD line ClimbingMotor.cs:603 pushes once an attempt -
 *  `climbingMode`, Internal_Strings.csv:371, verbatim. */
export const CLIMBING_MODE_TEXT = 'Climbing mode.';

const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));   // Mathf.Lerp clamps t

/** FormulaHelper.CalculateClimbingChance, verbatim: skill = live
 *  Climbing (+30 Khajiit; x2 under the Climbing effect - pends its
 *  effect, the seam is here), clamped 5..95; chance = (int)(Lerp(base,
 *  100, skill/100) + Lerp(0, 10, luck/100)). */
export function climbingChance(base, liveClimbing, liveLuck, { khajiit = false, enhanced = false } = {}) {
  let skill = liveClimbing + (khajiit ? KHAJIIT_CLIMBING_BONUS : 0);
  if (enhanced) skill *= 2;
  skill = Math.min(95, Math.max(5, skill));
  return Math.trunc(lerp(base, 100, skill * 0.01) + lerp(0, 10, liveLuck * 0.01));
}

/** PlayerSpeedChanger.GetClimbingSpeed: baseSpeed / 3 (x2 under the
 *  Climbing effect). baseSpeed is the motor's STALE Speed field - the
 *  climbing early-return sits above UpdateSpeed, the swim quirk. */
export function climbingSpeed(baseSpeed, enhanced = false) {
  return (baseSpeed / 3) * (enhanced ? 2 : 1);
}

/** The ClimbingCheck state machine, classic arms only. deps = {
 *  inputs: () => ({ climbing, luck, khajiit, enhanced }),
 *  tally: () => void        (TallySkill(Climbing, 1) - every check),
 *  rolls: () => [0,1)       (UnityEngine.Random - injectable, Ledger A),
 *  waterForgiven: () => bool (the underwater fail forgiveness),
 *  say: (line) => void       (the climbingMode HUD line) }. */
export class ClimbingState {
  constructor(deps = {}) {
    this.deps = deps;
    this.isClimbing = false;
    this.wasClimbing = false;
    this.isSlipping = false;
    this.startTimer = 0;
    this.continueTimer = 0;
    this.showModeMessage = true;   // showClimbingModeMessage: once per climb attempt
    this.lastHorizontal = null;    // lastHorizontalPosition (reset on every abort)
  }

  /** ClimbingSkillCheck (:826-846): tally FIRST, then the chance roll,
   *  a failed roll forgiven underwater. (perfectClimbing /
   *  overrideSkillCheck are debug/advanced - never set on classic.) */
  skillCheck(base) {
    this.deps.tally?.();
    const i = this.deps.inputs?.() ?? { climbing: 0, luck: 0 };
    const chance = climbingChance(base, i.climbing ?? 0, i.luck ?? 0, i);
    const rolls = this.deps.rolls ?? Math.random;
    if (Math.floor(rolls() * 100) >= chance) {          // Dice100.FailedRoll
      if (!this.deps.waterForgiven?.()) return false;   // dry land: the fail stands
    }
    return true;
  }

  /** StopClimbing (:490-495). */
  stop() {
    this.isClimbing = false;
    this.showModeMessage = true;
    this.startTimer = 0;
  }

  /** ClimbingCheck (:307-488), the classic arms, per fixed step.
   *  c = { forward, back, anyMove, falling, grounded, levitating,
   *  riding, touchingSides, horizontalPos: [x, z],
   *  tooCloseToGround: () => bool (thunk - short-circuit, :319) }.
   *  Returns isClimbing. */
  step(dt, c) {
    const airborneGraspWall = !this.isClimbing && !this.isSlipping && c.falling;
    const inputAbort = !c.forward;   // the classic abort key (:332)
    if (!this.lastHorizontal) this.lastHorizontal = [c.horizontalPos[0], c.horizontalPos[1]];
    const horizontallyStationary =
      Math.hypot(c.horizontalPos[0] - this.lastHorizontal[0], c.horizontalPos[1] - this.lastHorizontal[1])
        < START_CLIMB_HORIZONTAL_TOLERANCE;
    const slippedToGround = this.isSlipping && c.grounded;
    const nonOrthogonalStart = !this.isClimbing && c.forward && !horizontallyStationary;
    const climbingOrForwardOrGrasping = this.isClimbing || c.forward || airborneGraspWall;
    const tooClose = ((this.isClimbing && (c.back || this.isSlipping)) || airborneGraspWall)
      && !!c.tooCloseToGround?.();
    this.wasClimbing = this.isClimbing;
    if (inputAbort
        || !climbingOrForwardOrGrasping
        || !c.touchingSides
        || c.levitating
        || c.riding
        || slippedToGround
        || tooClose
        || nonOrthogonalStart) {
      this.stop();
      this.lastHorizontal = [c.horizontalPos[0], c.horizontalPos[1]];
    } else {
      // countdown to climbing start (:417-419)
      if (this.startTimer <= SYSTEM_TIMER_UPDATES_DIVISOR * START_CLIMB_SKILL_CHECK_FREQUENCY) {
        this.startTimer += dt;
      } else if (!this.isClimbing) {
        // grounded start: check(70), and a FAIL does NOT reset the
        // timer (:430-433); the airborne grasp resets on fail (:434-437)
        if (!airborneGraspWall) {
          if (this.skillCheck(START_CLIMB_MIN_CHANCE)) this.isClimbing = true;
        } else if (this.skillCheck(GRASP_WALL_MIN_CHANCE)) {
          this.isClimbing = true;
        } else {
          this.startTimer = 0;
        }
      }
      if (this.isClimbing) {
        // the continue cadence - faster while slipping (:443)
        if (this.continueTimer <= SYSTEM_TIMER_UPDATES_DIVISOR
            * (this.isSlipping ? REGAIN_HOLD_SKILL_CHECK_FREQUENCY : CONTINUE_CLIMBING_SKILL_CHECK_FREQUENCY)) {
          this.continueTimer += dt;
        } else {
          this.continueTimer = 0;
          if (!c.anyMove) this.isSlipping = false;   // "don't allow slipping if not moving" (:449-454)
          else if (this.isSlipping) this.isSlipping = !this.skillCheck(REGAIN_HOLD_MIN_CHANCE);
          else this.isSlipping = !this.skillCheck(CONTINUE_CLIMB_MIN_CHANCE);
        }
      }
    }
    if (this.isClimbing) {
      // the climbingMode HUD line, once per attempt (:601-605) -
      // AddHUDText takes the row verbatim, Internal_Strings.csv:371
      if (this.showModeMessage) {
        this.deps.say?.(CLIMBING_MODE_TEXT);
        this.showModeMessage = false;
      }
    } else {
      this.isSlipping = false;   // the not-climbing cleanup (:478)
    }
    return this.isClimbing;
  }
}
