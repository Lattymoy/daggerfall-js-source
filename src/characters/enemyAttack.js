// Enemy attacks (C8 E2b). Verbatim port of DFU EnemyAttack.cs
// FixedUpdate/MeleeAnimation/ResetMeleeTimer (MIT, Daggerfall
// Workshop), driving the SHARED weaponStates machine - one timing
// implementation for player and enemies.
//   - MeleeTimer counts down every update, floored at 0
//   - speed floors at 8 ("so Drain Speed does not prevent attack ever
//     firing")
//   - at the CLASSIC UPDATE: DFRandom.rand() % speed >= (speed >> 3) + 6
//     && MeleeTimer == 0 -> try MeleeAnimation (DFU keeps classic's
//     reversed speed comparison; so do we)
//   - MeleeAnimation: target in sight, within 22.5deg yaw, and
//     distance <= MeleeDistance -> attack starts. DFU's gate reads
//     `MeleeDistance + senses.TargetRateOfApproach`, but
//     targetRateOfApproach is assigned a non-zero value ONLY inside
//     `if (DaggerfallUnity.Settings.EnhancedCombatAI)`
//     (EnemySenses.cs:354-363), so on the classic path the term is
//     identically 0 and the reach is a flat 2.25 (AUDIT 18)
//   - ResetMeleeTimer: Random.Range(1500, 3001) - an INT roll, one of
//     1501 discrete values - then - 50*(playerLevel-10)
//     + 450*(reflexes-2), floored at 0, / 980 (classicFrameUpdate)
//     - Unity Random slots stay uniform rolls (DFU's own choice);
//     DFRandom is used exactly where DFU uses it
// The strike itself: classic mobiles have ONE PrimaryAttack; our rigs
// play the authored 1H strike clips, so the strike is a uniform roll
// over STRIKES (the WeaponManager click-attack precedent), sampled
// through the shared machine's frame clock.
// E3 SHIPPED: callers wire the real playerLevel/reflexes/LiveSpeed
// (dungeonContext builds each EnemyAttack from the live entities);
// the constructor defaults (10 / 2 / 50) are neutral fallbacks only.

import { rand } from '../formats/dfRandom.js';
import {
  createWeaponMachine, machineAttack, machineStep,
  MELEE_NUM_FRAMES, CLASSIC_UPDATE_INTERVAL,
} from './weaponStates.js';
import { STRIKES, ATTACKS_1H, sampleClip } from './anims.js';
import { MELEE_DISTANCE, CLASSIC_MELEE_DISTANCE_VS_AI, withinYaw, MIN_RANGED_DISTANCE, MAX_RANGED_DISTANCE } from './enemyMotor.js';

export const ATTACK_SPEED_FLOOR = 8;               // EnemyAttack.cs speedFloor
export const ATTACK_YAW_DEG = 22.5;                // MeleeAnimation yaw gate
export const MELEE_TIMER_MIN_MS = 1500;            // ResetMeleeTimer Random.Range
export const MELEE_TIMER_MAX_MS = 3000;            // (inclusive)
export const MELEE_TIMER_LEVEL_MS = 50;            // per player level above 10
export const MELEE_TIMER_REFLEX_MS = 450;          // per reflexes step from average
// EnemyAttack.cs:28-29 - the ranged band. ONE HOME: enemyMotor.js, which
// needs them for DoRangedAttack's stand-off and which this module already
// imports from (wave 35 - declaring them here and importing them there
// would close a cycle).
export { MIN_RANGED_DISTANCE, MAX_RANGED_DISTANCE } from './enemyMotor.js';
// EnemyMotor.DoRangedAttack:592 - the bow cadence inside the band.
export const BOW_SHOT_CHANCE = 1 / 32;

export function resetMeleeTimer(playerLevel = 10, reflexes = 2, roll = Math.random()) {
  // Random.Range(int, int) returns an INT (DFU rolls whole ms).
  let t = MELEE_TIMER_MIN_MS + Math.floor(roll * (MELEE_TIMER_MAX_MS + 1 - MELEE_TIMER_MIN_MS));
  t -= MELEE_TIMER_LEVEL_MS * (playerLevel - 10);
  t += MELEE_TIMER_REFLEX_MS * (reflexes - 2);
  if (t < 0) t = 0;
  return t / 980;   // "Approximates classic frame update"
}

/** The classic per-update attack roll (EnemyAttack.FixedUpdate). */
export function attackRollPasses(liveSpeed, randFn = rand) {
  const speed = Math.max(ATTACK_SPEED_FLOOR, liveSpeed);
  return randFn() % speed >= (speed >> 3) + 6;
}

/** Per-foe attack driver over the shared machine. */
export class EnemyAttack {
  /** rangedAttack: set by the scene when the foe HAS A BOW ATTACK
   *  (hasBowAttack - mobile flags, not the equipped weapon). */
  constructor({ liveSpeed = 50, playerLevel = 10, reflexes = 2, rolls = Math.random } = {}) {
    this.machine = createWeaponMachine(false);
    // AUDIT 39: FixedUpdate reads `entity.Stats.LiveSpeed` on every
    // pass (:69-72), under the source's own note that the floor exists
    // "so Drain Speed does not prevent attack ever firing" - so DFU
    // expects a live drain on a foe to bite. A number captured at
    // spawn cannot drain; callers that own the entity pass a THUNK.
    this._liveSpeed = typeof liveSpeed === 'function' ? liveSpeed : () => liveSpeed;
    this.playerLevel = playerLevel;
    this.reflexes = reflexes;
    this.rolls = rolls;   // ENGINE-PRNG: DoRangedAttack's Random.value + the strike/timer picks
    this.meleeTimer = 0;
    this._classicTimer = 0;
    this.firedRanged = false;   // C-slice: WHICH decision started the running swing
  }

  /** EnemyAttack.cs:70 - a READ, not a field, so nothing can freeze it. */
  get liveSpeed() { return this._liveSpeed(); }

  /**
   * @param ai the foe's EnemyAI (senses + yaw + feet)
   * @param playerFeet
   * @returns events from the shared machine ('hit', 'done')
   */
  update(dt, ai, playerFeet, paused = false) {
    // ROAD-U: "Unable to attack when playing certain oneshot anims" -
    // FixedUpdate returns at :59-61 (`mobile.IsPlayingOneShot() &&
    // mobile.OneShotPauseActionsWhilePlaying()`), ABOVE the melee
    // countdown on the next line, above the `DFRandom.rand() % speed`
    // draw in the classic loop and above MeleeAnimation. The port had
    // the predicate but never reached it from here, so a transforming
    // Seducer ran its timer down and burned ~32 bytes of the ONE
    // shared DFRandom stream over the transformation - the desync
    // class this file already carries as AUDIT 24 characters-2 below.
    // EnemyAttack.Update (:88-94) is NOT gated on the pause - only on
    // paralysis - so the machine step below still runs: a swing
    // already in flight keeps being stepped, and only the DECISION
    // half stops.
    if (paused) return machineStep(this.machine, dt, this.liveSpeed);
    this.meleeTimer -= dt;
    if (this.meleeTimer < 0) this.meleeTimer = 0;
    const dist = ai._dist;
    this._classicTimer += dt;
    while (this._classicTimer >= CLASSIC_UPDATE_INTERVAL) {
      this._classicTimer -= CLASSIC_UPDATE_INTERVAL;
      // C2-slice (AUDIT 23 combat-12): the DFRandom byte DRAWS on
      // every classic tick - it is the LEFT operand of the source's
      // `rand-pass && MeleeTimer == 0` (FixedUpdate :81), and the
      // attack component draws even for a bow foe the band owns (the
      // band is the MOTOR's; the components both tick).
      // AUDIT 24 characters-2: and it draws MID-SWING too. The only
      // early return above the draw is the SeducerTransform one-shot
      // (:59-60 -> MobileUnit.OneShotPauseActionsWhilePlaying
      // :174-183), which is NOT the attack anims - so an enemy with a
      // strike in flight still burns one rand() per tick. The old
      // `machine.state !== 'Idle'` gate above this line held the draw
      // for the whole ~1s swing, and DFRandom is one shared global
      // stream: every later consumer read a different value.
      const meleePass = attackRollPasses(this.liveSpeed) && this.meleeTimer === 0;
      // mobile.IsPlayingOneShot() - true for any attack anim in flight.
      const oneShot = this.machine.state !== 'Idle';
      const dx = playerFeet[0] - ai.feet[0], dz = playerFeet[2] - ai.feet[2];
      // C-slice (AUDIT 23 combat-3): EnemyMotor.DoRangedAttack
      // (:570-614) OWNS a bow foe inside the 6..51.2 band (strict) -
      // its whole cadence is the 1/32 classic-update roll within the
      // 22.5deg yaw; no melee timer, no speed roll, and the melee
      // machine never runs from inside the band (DoRangedAttack
      // returns true even while only turning). Outside the band the
      // bow foe is a MELEE fighter - the fallback - so the reach
      // gate below applies to everyone.
      // AUDIT 24 characters-3: the band arm carries DoRangedAttack's
      // FULL gate - `inRange && TargetInSight && DetectedTarget`
      // (:573) - plus the CanAct chain that owns the call at all
      // (FixedUpdate :171 `if (CanAct) TakeAction()` -> HandleNoAction
      // :357-364 drops CanAct the moment GiveUpTimer hits 0). Sight
      // alone let a Chameleoned player be shot at, and let a foe that
      // had given up keep firing.
      // AUDIT 26 F010: the bow band rides `if (CanAct) TakeAction`
      // (:171-172), so a knocked-back or paralyzed foe holds its
      // fire - the roll is UnityEngine.Random (:592), not the shared
      // DFRandom stream, so gating it slides nothing. `!== false`
      // keeps the old callers (and the headless tests' bare-object
      // ai stubs) on the permissive default.
      if (this.rangedAttack && ai.canAct !== false && ai.inSight && ai.detected && ai.giveUpTimer > 0
          && dist > MIN_RANGED_DISTANCE && dist < MAX_RANGED_DISTANCE) {
        // ...and the 1/32 roll itself sits behind `if (!isPlayingOneShot)`
        // (:587), so a swing in flight DOES hold the bow roll.
        if (!oneShot && withinYaw(ai.yaw, dx, dz, ATTACK_YAW_DEG) && this.rolls() < BOW_SHOT_CHANCE) {
          const strike = STRIKES[Math.floor(this.rolls() * STRIKES.length)];
          if (machineAttack(this.machine, strike)) this.firedRanged = true;
        }
        continue;
      }
      if (!meleePass) continue;
      if (!ai.inSight || !withinYaw(ai.yaw, dx, dz, ATTACK_YAW_DEG)) continue;
      // MT-ii: MeleeAnimation's OWN reach (:157-160), which the port
      // exported as CLASSIC_MELEE_DISTANCE_VS_AI at C8 and never
      // consumed, because nothing but the player could be a target:
      //   float distance = MeleeDistance;
      //   if (!EnhancedCombatAI && Target != PlayerEntityBehaviour)
      //       distance = ClassicMeleeDistanceVsAI;
      // "Classic uses separate melee distance for targeting player
      // and for targeting other AI" - 1.5 rather than 2.25. Unarmed
      // (and against the player) the reach is unchanged.
      const vsAI = ai._armedTargeting && ai.target && !ai.target.isPlayer;
      if (dist > (vsAI ? CLASSIC_MELEE_DISTANCE_VS_AI : MELEE_DISTANCE)) continue;
      // MeleeAnimation (:151-176) has now returned TRUE, so FixedUpdate
      // :85 calls ResetMeleeTimer UNCONDITIONALLY - even when the state
      // change it just asked for did nothing. Classic mobiles have ONE
      // PrimaryAttack and ChangeEnemyState (MobileUnit :143-146) "only
      // changes if in a different state", so a melee decision landing
      // mid-melee-swing re-arms the timer and nothing else; landing
      // mid-BOW-release cuts the release short and starts the strike
      // (FPSWeapon's no-interrupt rule in machineAttack is the
      // PLAYER's screen weapon, not the mobile's).
      if (!oneShot || this.firedRanged) {
        if (oneShot) { this.machine.state = 'Idle'; this.machine.acc = 0; }
        const strike = STRIKES[Math.floor(this.rolls() * STRIKES.length)];
        if (machineAttack(this.machine, strike)) this.firedRanged = false;
      }
      this.meleeTimer = resetMeleeTimer(this.playerLevel, this.reflexes, this.rolls());
    }
    return machineStep(this.machine, dt, this.liveSpeed);
  }

  /** Pose for the rig this frame (null when idle). */
  pose() {
    const m = this.machine;
    if (m.state === 'Idle') return null;
    const frames = MELEE_NUM_FRAMES[m.state] ?? 5;
    const clip = ATTACKS_1H[m.state];
    if (!clip) return null;
    // sampleClip takes SECONDS - phase maps through clip.dur, capped just
    // under the end so the final frame still samples (units bug, audit
    // 2026-08-16: swings died at 40-66% and snapped to base).
    return sampleClip(clip, Math.min(0.9999, m.frame / (frames - 1)) * clip.dur);
  }
}
