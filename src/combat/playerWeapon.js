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
// INTERIM_WEAPON is the PRE-CHARGEN fallback only (AUDIT 23: the
// items/inventory arc shipped and the rig binds the entity's worn
// weapon per frame - the old 'until the items arc' claim retired).
// Racial modifiers are LIVE
// (AUDIT 18 ported CalculateRacialModifiers into formulas.js, which
// reads the raceId chargen writes); proficiency modifiers pend the
// career proficiency flags. Backstab is threaded by the host that
// keeps facing bookkeeping on foes.

import {
  createWeaponMachine, machineAttack, machineStep, gestureDirection,
  ATTACK_THRESHOLD, MAX_GESTURE_SECONDS,
} from '../characters/weaponStates.js';
import { DIRECTION_TO_STRIKE, ATTACKS_FP, sampleClip } from '../characters/anims.js';
import { combinePose } from '../characters/animate.js';
import { weaponTypeForItem, WEAPON_TYPES } from './fpsWeapon.js';
import { WEAPONS } from '../characters/weapons.js';
import { POSES } from '../characters/poses.js';
import { calculateAttackDamage } from './formulas.js';

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

/** INTERIM starting weapon (items arc replaces): Iron Dagger.
 *  AUDIT 18: the baked minDamage/maxDamage are gone - the formulas
 *  resolve the span from templateIndex, as GetBaseDamageMin/Max do -
 *  and so is `flags: 0x10`. DaggerfallUnityItem.SetItem
 *  (DaggerfallUnityItem.cs:565) initialises `flags = 0` for every item
 *  the game generates; only the classic-save importer (:1563) and the
 *  artifact mask (:617, 0x820) ever write it, and neither touches bit
 *  0x10. So in DFU the Skeletal Warrior edged-damage halving at
 *  FormulaHelper.cs:742-744 applies to EVERY weapon; the port minted
 *  the bit by intent and had the rule exactly inverted. */
export const INTERIM_WEAPON = Object.freeze({
  name: 'Dagger',
  templateIndex: WEAPONS.Dagger,   // audit 2026-08-17: without this, weaponTypeForItem -> None and the STARTING dagger drew no weapon art at all
  material: 0,        // Iron
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
  /** WeaponManager.ToggleSheath verbatim: flip; the DRAW sound plays
   *  only on UNsheathing a real weapon (not Melee/None). Returns true
   *  when the caller should play SOUND.DrawWeapon. Classic starts
   *  SHEATHED (parity audit 2026-08-17 - sheathing did not exist). */
  toggleSheath() {
    this.sheathed = !this.sheathed;
    if (this.sheathed) return false;
    const t = weaponTypeForItem(this.weapon);
    return t !== WEAPON_TYPES.Melee && t !== WEAPON_TYPES.None;
  }

  constructor({ liveSpeed = 50, weapon = INTERIM_WEAPON } = {}) {
    this.machine = createWeaponMachine(false);
    this.liveSpeed = liveSpeed;
    this.weapon = weapon;
    this.sheathed = true;   // classic starts sheathed; Z readies (WeaponManager.Sheathed)
    this._gx = 0; this._gy = 0; this._gt = 0; this._tracking = false;
  }

  /** Drag-to-swing (WeaponManager.TrackMouseAttack over the ported
   *  gesture rules): accumulate while the attack button is held;
   *  fire when travel crosses ATTACK_THRESHOLD of the longest screen
   *  dimension. Returns the strike state when an attack starts. */
  gesture(dx, dy, held, dt, longestDim) {
    // AUDIT 23 (combat-2) - WeaponManager.cs:355-358: a bow never
    // tracks a swing; the attack input itself fires, forced to
    // StrikeDown (the BowDrawback-off classic instant shot - the
    // machine's StrikeUp draw half is that setting's other arm) and
    // only after the button was RELEASED since the last shot
    // (lastAttackHand == Hand.None).
    if (this.machine.isBow) {
      const rise = held && !this._bowHeld;
      this._bowHeld = held;
      if (rise && machineAttack(this.machine, 'StrikeDown')) return 'StrikeDown';
      return null;
    }
    this._bowHeld = false;
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

  /** ClickToAttack verbatim (WeaponManager): a click fires an attack
   *  in a RANDOM direction from Range(UpRight, DownRight + 1) over
   *  the MouseDirections order - UpRight, Left, Right, DownLeft,
   *  Down, DownRight. The touch attack button rides this (a tap has
   *  no drag travel, so the gesture seam alone could never swing -
   *  Mac's 2026-08-14 live report). */
  clickAttack(rolls = Math.random) {
    // combat-2: the bow ignores the random-direction roll too - DFU's
    // click arm is bypassed by the forced bow direction (:355-358).
    if (this.machine.isBow) return machineAttack(this.machine, 'StrikeDown') ? 'StrikeDown' : null;
    const DIRS = ['UpRight', 'Left', 'Right', 'DownLeft', 'Down', 'DownRight'];
    const strike = DIRECTION_TO_STRIKE[DIRS[Math.floor(rolls() * DIRS.length)]];
    return machineAttack(this.machine, strike) ? strike : null;
  }

  /** @returns machine events; the caller resolves 'hit' via resolveHit. */
  update(dt) {
    // FPSWeapon.AnimateWeapon reads WeaponType every tick, and
    // weaponRig.syncWorn swaps this.weapon between the worn item and
    // null whenever the player sheathes - so the unarmed gate is READ
    // per step, never frozen at construction.
    const t = weaponTypeForItem(this.weapon);
    this.machine.isUnarmed = t === WEAPON_TYPES.Melee || t === WEAPON_TYPES.Werecreature;
    // AUDIT 23 (combat-2): the bow half of the machine (0.0625 tick,
    // 7-frame release, bowSound frame 4, hit frame 5, GetBowCooldownTime)
    // was shipped but nothing ever set isBow - bows swung on the melee
    // clock. Read per step, exactly like the unarmed gate above.
    this.machine.isBow = t === WEAPON_TYPES.Bow;
    return machineStep(this.machine, dt, this.liveSpeed);
  }

  /** The FP viewmodel pose this frame: the fpMelee1H base with the
   *  dedicated FP sweep composited on the machine's frame clock. */
  pose() {
    const base = POSES.fpMelee1H;
    const m = this.machine;
    if (m.state === 'Idle') return base;
    const clip = ATTACKS_FP[m.state];
    if (!clip) return base;
    const frames = 5;   // MELEE_NUM_FRAMES - all melee strikes
    // sampleClip takes SECONDS (u = t/dur; anims tests pin it): map the
    // frame phase through clip.dur or the back half of every strike dies
    // at the base pose (units bug, audit 2026-08-16).
    return combinePose(base, sampleClip(clip, Math.min(0.9999, m.frame / (frames - 1)) * clip.dur));
  }

  /**
   * Resolve the hit frame against foes. AUDIT 23 (combat-6): DFU's
   * MeleeDamage collects EVERY entity collider in the attack box
   * passing the FOV/LOS checks and runs WeaponDamage on each
   * (WeaponManager.cs:917 OverlapBox + :1051-1055 foreach) - the old
   * single-target break invented a rule DFU does not have.
   * @param foes [{entity, ai}] candidates
   * @param eye player eye position
   * @param canSee (foe) => {dist, inView, losClear}
   * @param playerCombat the player entity
   * @returns [{foe, damage}] - one entry per foe in reach
   */
  resolveHit(foes, playerCombat, canSee, rolls = Math.random, backstabOf = () => 0, say = null, onPoison = null) {
    const results = [];
    for (const foe of foes) {
      if (foe.dead || !foe.entity) continue;
      const { dist, inView, losClear } = canSee(foe);
      if (!playerMeleeCanHit(dist, inView, losClear)) continue;
      const damage = calculateAttackDamage(playerCombat, foe.entity, {
        ...playerAttackOptions(this.weapon, this.machine.state, backstabOf(foe), rolls), say,
        // C2-slice (AUDIT 23 combat-11): the PLAYER's poisoned blade
        // infects ITS victim - the formulas clear the weapon's poison
        // either way, so without this hook the dose vanished unspent.
        onInflictPoison: onPoison ? (att, tgt, pt) => onPoison(foe, pt) : null,
      });
      results.push({ foe, damage });
    }
    return results;
  }
}

/** The `attacker == player` option bag, in ONE place.
 *  FormulaHelper.CalculateAttackDamage takes the same entry for a
 *  melee swing (WeaponManager.cs:1054) and for a loosed arrow
 *  (DaggerfallMissile.AssignBowDamageToTarget -> WeaponManager.cs:546),
 *  so swing mods, backstab and the enemy-type modifier all apply to a
 *  bow shot too - and CalculateSwingModifiers keys on the SCREEN
 *  WEAPON's state, which for a bow release is StrikeDown (+4 damage,
 *  -10 to hit).
 *  AUDIT 18: the port's arrow fork built its own bag with only the
 *  weapon in it, so those channels were silently zero on every shot.
 *  Callers pass the machine state they are resolving - 'StrikeDown'
 *  for a bow release. Swing mods ride the source's channels: toHit
 *  onto chanceToHitMod, damage INTO the damage call (before the
 *  skeletal rules and the <1 floor) - not post-hoc. Backstab rides
 *  its own: chance onto chanceToHitMod, x3 roll AFTER the damage. */
export function playerAttackOptions(weapon, machineState, backstabChance = 0, rolls = Math.random) {
  const swing = SWING_MODS[machineState] ?? { damage: 0, toHit: 0 };
  return { weapon, damageMod: swing.damage, toHitMod: swing.toHit, backstabChance, rolls };
}
