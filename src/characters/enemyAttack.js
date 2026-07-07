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
//     distance <= MeleeDistance + rate-of-approach -> attack starts
//   - ResetMeleeTimer: Random.Range(1500, 3001) - 50*(playerLevel-10)
//     + 450*(reflexes-2), floored at 0, / 980 (classicFrameUpdate)
//     - Unity Random slots stay uniform rolls (DFU's own choice);
//     DFRandom is used exactly where DFU uses it
// The strike itself: classic mobiles have ONE PrimaryAttack; our rigs
// play the authored 1H strike clips, so the strike is a uniform roll
// over STRIKES (the WeaponManager click-attack precedent), sampled
// through the shared machine's frame clock.
// PENDING E3 (entity layer): playerLevel (stub 10 - zeroes its term),
// reflexes (stub 2, average - zeroes its term), per-enemy LiveSpeed.

import { rand } from '../formats/dfRandom.js';
import {
  createWeaponMachine, machineAttack, machineStep,
  MELEE_NUM_FRAMES, CLASSIC_UPDATE_INTERVAL,
} from './weaponStates.js';
import { STRIKES, ATTACKS_1H, sampleClip } from './anims.js';
import { MELEE_DISTANCE, withinYaw } from './enemyMotor.js';

export const ATTACK_SPEED_FLOOR = 8;               // EnemyAttack.cs speedFloor
export const ATTACK_YAW_DEG = 22.5;                // MeleeAnimation yaw gate
export const MELEE_TIMER_MIN_MS = 1500;            // ResetMeleeTimer Random.Range
export const MELEE_TIMER_MAX_MS = 3000;            // (inclusive)
export const MELEE_TIMER_LEVEL_MS = 50;            // per player level above 10
export const MELEE_TIMER_REFLEX_MS = 450;          // per reflexes step from average

export function resetMeleeTimer(playerLevel = 10, reflexes = 2, roll = Math.random()) {
  let t = MELEE_TIMER_MIN_MS + roll * (MELEE_TIMER_MAX_MS + 1 - MELEE_TIMER_MIN_MS);
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
  /** rangedAttack: set by the scene when the equipped weapon is a bow. */
  constructor({ liveSpeed = 50, playerLevel = 10, reflexes = 2 } = {}) {
    this.machine = createWeaponMachine(false);
    this.liveSpeed = liveSpeed;
    this.playerLevel = playerLevel;
    this.reflexes = reflexes;
    this.meleeTimer = 0;
    this._classicTimer = 0;
    this._prevDist = null;
  }

  /**
   * @param ai the foe's EnemyAI (senses + yaw + feet)
   * @param playerFeet
   * @returns events from the shared machine ('hit', 'done')
   */
  update(dt, ai, playerFeet) {
    this.meleeTimer -= dt;
    if (this.meleeTimer < 0) this.meleeTimer = 0;
    // rate of approach: how much the distance CLOSED since last update
    const dist = ai._dist;
    const approach = this._prevDist === null ? 0 : Math.max(0, this._prevDist - dist);
    this._prevDist = dist;
    this._classicTimer += dt;
    while (this._classicTimer >= CLASSIC_UPDATE_INTERVAL) {
      this._classicTimer -= CLASSIC_UPDATE_INTERVAL;
      if (this.machine.state !== 'Idle') continue;
      if (this.meleeTimer > 0) continue;
      if (!attackRollPasses(this.liveSpeed)) continue;
      const dx = playerFeet[0] - ai.feet[0], dz = playerFeet[2] - ai.feet[2];
      if (!ai.inSight || !withinYaw(ai.yaw, dx, dz, ATTACK_YAW_DEG)) continue;
      // Ranged (bow-equipped) foes attack from SIGHT - the melee
      // distance gate is the melee path's (EnemyAttack bow branch).
      if (!this.rangedAttack && dist > MELEE_DISTANCE + approach) continue;
      const strike = STRIKES[Math.floor(Math.random() * STRIKES.length)];
      if (machineAttack(this.machine, strike)) {
        this.meleeTimer = resetMeleeTimer(this.playerLevel, this.reflexes);
      }
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
    return sampleClip(clip, Math.min(1, m.frame / (frames - 1)));
  }
}
