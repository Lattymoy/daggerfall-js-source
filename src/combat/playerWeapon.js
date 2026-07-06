// Player melee vs foes (C8 E3c). Verbatim from DFU WeaponManager.cs /
// FormulaHelper.cs (MIT, Daggerfall Workshop):
//   - reach: defaultWeaponReach 2.25 + SphereCastRadius 0.25
//   - hit rule (base MeleeAttackDetection): the foe's center within
//     reach of the eye, inside the camera view, with clear LOS
//     through the level collider
//   - swing modifiers (CalculateSwingModifiers): StrikeUp -4dmg/+10hit,
//     StrikeDownRight -2/+5, StrikeDownLeft +2/-5, StrikeDown +4/-10
//     ("classic does not apply swing modifiers to unarmed attacks")
//   - the strike itself rides the SHARED weaponStates machine
//     (drag-to-swing gestureDirection + ATTACK_THRESHOLD, the combat
//     layer's ported input)
// INTERIM (loud): the equipped weapon is an Iron Dagger until the
// items/inventory arc - every field the formulas need is explicit
// here so the real item system swaps in as plumbing. Proficiency and
// racial modifiers pend chargen (both 0 in the interim, as the
// entity has no career/race yet); backstab pends facing bookkeeping
// on foes (E3d with the FP viewmodel).

import {
  createWeaponMachine, machineAttack, machineStep, gestureDirection,
  ATTACK_THRESHOLD, MAX_GESTURE_SECONDS,
} from '../characters/weaponStates.js';
import { DIRECTION_TO_STRIKE } from '../characters/anims.js';
import {
  calculateAttackDamage, enemyGroupOf, WEAPON_MIN_DAMAGE, WEAPON_MAX_DAMAGE,
} from './formulas.js';

export const DEFAULT_WEAPON_REACH = 2.25;   // WeaponManager.cs:35
export const SPHERE_CAST_RADIUS = 0.25;     // WeaponManager.cs:51
export const WEAPON_REACH = DEFAULT_WEAPON_REACH + SPHERE_CAST_RADIUS;

// FormulaHelper.CalculateSwingModifiers verbatim ({damage, toHit})
export const SWING_MODS = Object.freeze({
  StrikeUp: { damage: -4, toHit: 10 },
  StrikeDownRight: { damage: -2, toHit: 5 },
  StrikeDownLeft: { damage: 2, toHit: -5 },
  StrikeDown: { damage: 4, toHit: -10 },
  StrikeLeft: { damage: 0, toHit: 0 },
  StrikeRight: { damage: 0, toHit: 0 },
});

/** INTERIM starting weapon (items arc replaces): Iron Dagger. */
export const INTERIM_WEAPON = Object.freeze({
  name: 'Dagger',
  material: 0,        // Iron
  flags: 0x10,        // edged
  minDamage: WEAPON_MIN_DAMAGE.Dagger,
  maxDamage: WEAPON_MAX_DAMAGE.Dagger,
});

/**
 * The verbatim hit rule against one foe. `inView` and `losClear` are
 * provided by the caller (projection + collider live scene-side).
 */
export function playerMeleeCanHit(dist, inView, losClear) {
  return dist <= WEAPON_REACH && inView && losClear;
}

/** Per-player weapon driver over the shared machine + gesture input. */
export class PlayerWeapon {
  constructor({ liveSpeed = 50, weapon = INTERIM_WEAPON } = {}) {
    this.machine = createWeaponMachine(false);
    this.liveSpeed = liveSpeed;
    this.weapon = weapon;
    this._gx = 0; this._gy = 0; this._gt = 0; this._tracking = false;
  }

  /** Drag-to-swing (WeaponManager.TrackMouseAttack over the ported
   *  gesture rules): accumulate while the attack button is held;
   *  fire when travel crosses ATTACK_THRESHOLD of the longest screen
   *  dimension. Returns the strike state when an attack starts. */
  gesture(dx, dy, held, dt, longestDim) {
    if (!held) { this._tracking = false; this._gx = 0; this._gy = 0; this._gt = 0; return null; }
    if (!this._tracking) { this._tracking = true; this._gx = 0; this._gy = 0; this._gt = 0; }
    this._gx += dx; this._gy += dy; this._gt += dt;
    if (this._gt > MAX_GESTURE_SECONDS) { this._gx = 0; this._gy = 0; this._gt = 0; return null; }
    const travel = Math.hypot(this._gx, this._gy);
    if (travel / longestDim < ATTACK_THRESHOLD) return null;
    const angle = Math.atan2(-this._gy, this._gx) * 180 / Math.PI;   // screen-up positive
    const strike = DIRECTION_TO_STRIKE[gestureDirection(angle)];
    this._gx = 0; this._gy = 0; this._gt = 0;
    if (strike && machineAttack(this.machine, strike)) return strike;
    return null;
  }

  /** @returns machine events; the caller resolves 'hit' via resolveHit. */
  update(dt) {
    return machineStep(this.machine, dt, this.liveSpeed);
  }

  /**
   * Resolve the hit frame against foes. Verbatim single-target rule
   * with swing + material paths through calculateAttackDamage.
   * @param foes [{entity, ai}] candidates
   * @param eye player eye position
   * @param canSee (foe) => {dist, inView, losClear}
   * @param playerCombat the player entity
   * @returns [{foe, damage}]
   */
  resolveHit(foes, playerCombat, canSee, rolls = Math.random) {
    const swing = SWING_MODS[this.machine.state] ?? { damage: 0, toHit: 0 };
    const results = [];
    for (const foe of foes) {
      if (foe.dead || !foe.entity) continue;
      const { dist, inView, losClear } = canSee(foe);
      if (!playerMeleeCanHit(dist, inView, losClear)) continue;
      // swing mods ride the source's channels: toHit onto
      // chanceToHitMod, damage INTO the damage call (before the
      // skeletal rules and the <1 floor) - not post-hoc
      const damage = calculateAttackDamage(playerCombat, foe.entity, {
        weapon: this.weapon,
        targetGroup: enemyGroupOf(foe.entity.affinity),
        damageMod: swing.damage,
        toHitMod: swing.toHit,
        rolls,
      });
      results.push({ foe, damage });
      break;   // one target per swing (the ray resolves a single center)
    }
    return results;
  }
}
