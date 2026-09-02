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
// reads the raceId chargen writes), and so are the proficiency
// modifiers this line used to say pend the career proficiency flags:
// CF1 put proficiencyModifiers in formulas.js ahead of the racial
// term, FormulaHelper.cs:602-609's order. Backstab is threaded by the host that
// keeps facing bookkeeping on foes.

import {
  createWeaponMachine, machineAttack, machineStep, gestureDirection,
  MAX_GESTURE_SECONDS, BOW_DRAWN_HOLD_FRAME, machineCancelBowDraw,
} from '../characters/weaponStates.js';
import { DIRECTION_TO_STRIKE, ATTACKS_FP, sampleClip } from '../characters/anims.js';
import { combinePose } from '../characters/animate.js';
import { weaponTypeForItem, WEAPON_TYPES } from './fpsWeapon.js';
import { WEAPONS } from '../characters/weapons.js';
import { POSES } from '../characters/poses.js';
import { calculateAttackDamage } from './formulas.js';
import { isShieldTemplate } from '../systems/armorMaterials.js';   // a12: UpdateHands' IsShield leg
import { equipDelayFor } from '../systems/equip.js';               // a12: ToggleHand's EquipDelayTimes[GroupIndex]
import { getBool, getFloat, getInt } from '../systems/settings.js';   // AUDIT 28 W2b: MeleeAttackFriendlyProtection; W11: WeaponAttackThreshold, WeaponSwingMode

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

/** The PRE-CHARGEN fallback weapon, Iron Dagger - PlayerWeapon's
 *  constructor default and nothing more. The items arc this used to
 *  wait on landed: systems/startingGear.js is
 *  ItemHelper.AssignStartingGear verbatim (ItemHelper.cs:1277-1364)
 *  and chargen routes every character through it, so a real character
 *  never holds this.
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
/** WeaponManager.cs:343 - Random.Range((int)UpRight, (int)DownRight + 1)
 *  over MouseDirections {None, UpLeft, Up, UpRight, Left, Right,
 *  DownLeft, Down, DownRight}: indices 3..8. */
export const CLICK_ATTACK_DIRECTIONS = Object.freeze(['UpRight', 'Left', 'Right', 'DownLeft', 'Down', 'DownRight']);

export function playerMeleeCanHit(dist, inView, losClear) {
  return dist <= WEAPON_REACH && inView && losClear;
}

// ── THE LEFT HAND (WeaponManager.cs, verbatim) ───────────────────────
//
// Classic Daggerfall fights with EITHER hand and H switches between
// them; the port had no hand state at all - one field bound to the
// right slot, and a weapon in the left hand could never be swung. The
// members below are WeaponManager's own, in its own order:
// usingRightHand (:74), holdingShield (:75), currentRightHandWeapon
// (:76), currentLeftHandWeapon (:77), UpdateHands (:646-676),
// ToggleHand (:702-729) and ApplyWeapon (:731-757).
//
// The hand is the WHOLE combat identity of a swing, not a cosmetic:
// strikingWeapon (:909), the skill tallied on a hit (:430-433), the
// hit sound (:564-567) and LastBowUsed (:415) all read the hand's
// weapon, and every one of those already reads `playerWeapon.weapon`
// here - so binding that ONE field to the used hand carries them all.

/** WeaponManager.cs:45 - the switch-delay divisor, a float. */
import { BOW_SWITCH_DIVISOR } from '../characters/weaponStates.js';   // ONE home (WeaponManager.cs:45); a12's switch law reads it here
export { BOW_SWITCH_DIVISOR };

/** Internal_Strings.csv: usingRightHand / usingLeftHand - the two
 *  PopupMessage lines ToggleHand raises (:709, :711). */
export const USING_RIGHT_HAND_TEXT = 'Using weapon in right hand.';
export const USING_LEFT_HAND_TEXT = 'Using weapon in left hand.';

/** StartGameBehaviour.StartFromClassicSave :605-606, the whole line:
 *  `weaponManager.UsingRightHand = !saveVars.UsingLeftHandWeapon`.
 *  THE SEAM: formats/saveVarsFile.js has parsed the byte since SAV2
 *  (:183, offset 0x3D9) and systems/classicSave.js recorded it as
 *  "read but dropped - the port has no left-hand rig". It has one
 *  now; this is the import that classicSave's snapshot builder calls,
 *  kept here so the law and its citation live with the hand. */
export const usingRightHandFromSaveVars = (saveVars) => !saveVars?.usingLeftHandWeapon;

/**
 * AUDIT 28 W2b: MeleeDamage's FRIENDLY PROTECTION (WeaponManager.cs
 * :930-944). Under Settings.MeleeAttackFriendlyProtection (ships True)
 * the bounding-box pass skips three kinds of entity: a PlayerAlly
 * (`behaviour.Entity.Team`, the LIVE team), a foe whose motor is not
 * hostile (pacified), and a MobilePersonNPC (a townsperson - not in
 * any foe pool here; the hosts' civilian arm runs only after the pools
 * miss, which is :1057's fallback order already). A protected foe is
 * not immune: :1057-1064's vanilla SphereCast still strikes one when
 * it is the ONLY thing in front of the player.
 */
export function friendlyProtected(foe, { protection = getBool('MeleeAttacks', 'MeleeAttackFriendlyProtection') } = {}) {
  if (!protection) return false;
  if (foe?.entity?.team === 'PlayerAlly') return true;
  if (foe?.ai && foe.ai.isHostile === false) return true;
  return false;
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
    // a12 - WeaponManager's hand state (:74-77), same defaults: the
    // player starts on the RIGHT hand, holding no shield, with both
    // caches empty until the first UpdateHands.
    this.usingRightHand = true;
    this.holdingShield = false;
    this.currentRightHandWeapon = null;
    this.currentLeftHandWeapon = null;
    this.sheathed = true;   // classic starts sheathed; Z readies (WeaponManager.Sheathed)
    // DFU's Gesture: the timestamped trail, its vector sum and its
    // TRAVEL length (WeaponManager.cs:93-155).
    this._gpoints = [];
    this._gx = 0; this._gy = 0; this._gtravel = 0; this._gnow = 0; this._tracking = false;
  }

  /**
   * WeaponManager.UpdateHands' hand half (:648-676), verbatim order.
   *
   * THE SHIELD RULE IS THE WHOLE POINT OF THE FIRST BLOCK: a shield in
   * the left hand is not a weapon, so it FORCES the right hand
   * (`usingRightHand = true`, :656) and blanks the left cache - which
   * is also what makes ToggleHand's first line refuse to switch while
   * one is worn. DFU re-caches the melee graphics here so an unequipped
   * shield has art waiting (:659-660); the port's art cache is keyed by
   * (type, material) at the draw site and warms itself, so that line
   * has no port twin.
   *
   * DFU compares with CompareItems before writing each cache; the port
   * holds the item OBJECTS themselves out of the equip table, so the
   * write is the compare - assigning the same reference changes
   * nothing, and the caches carry no derived state to invalidate.
   */
  updateHands(rightHandItem, leftHandItem) {
    this.holdingShield = false;
    let left = leftHandItem ?? null;
    if (left && isShieldTemplate(left.templateIndex)) {
      this.usingRightHand = true;
      this.holdingShield = true;
      left = null;
    }
    this.currentRightHandWeapon = rightHandItem ?? null;
    this.currentLeftHandWeapon = left;
  }

  /**
   * WeaponManager.ApplyWeapon (:731-757). The racial override is the
   * FIRST arm (:735-739) and returns before either hand is read - V4's
   * wereclaws, which the rig hands in. Otherwise the used hand's item
   * IS the screen weapon, and a null one is SetMelee (:743-746,
   * :751-754): weaponTypeForItem(null) already answers Melee, which is
   * exactly SetMelee's WeaponType, and the port has no MetalType or
   * per-field sound to clear because the draw and swing clips are read
   * off the item at their own moment.
   *
   * `Reach = defaultWeaponReach` (:756) is the port's constant
   * WEAPON_REACH - nothing in this port writes Reach per weapon, so
   * there is no field to restore.
   */
  applyWeapon(racialWeapon = null) {
    if (racialWeapon) { this.weapon = racialWeapon; return this.weapon; }
    this.weapon = (this.usingRightHand ? this.currentRightHandWeapon : this.currentLeftHandWeapon) ?? null;
    return this.weapon;
  }

  /**
   * WeaponManager.ToggleHand (:702-729), verbatim.
   *
   * Refuses outright while the right hand is used and a shield is worn
   * (:704-705) - there is nothing to switch TO. Otherwise the hand
   * flips, one of the two classic lines is raised, and only then the
   * ENHANCEMENT arm runs: BowLeftHandWithSwitching (defaults False, so
   * the classic lane never pays it) bills the switch as
   * `sum over both hands of (EquipDelayTimes[GroupIndex] - 500)`,
   * divided by 1.7, onto the hand now in use.
   *
   * PORT NOTE (the CH3 collapse, equip.js:63): DFU keeps a countdown
   * PER HAND and this bill lands on the used one; the port sums both
   * into entity.equipCountdown, so the bill lands on the one clock.
   * Same delay, same block on the swing - only the per-hand split is
   * missing, and it is missing everywhere the collapse reaches.
   *
   * @returns the popup line, or null when the shield refused the switch.
   */
  toggleHand({
    bowSwitching = getBool('Enhancements', 'BowLeftHandWithSwitching'),
    entity = null,
    apply = true,
  } = {}) {
    if (this.usingRightHand && this.holdingShield) return null;
    this.usingRightHand = !this.usingRightHand;
    const message = this.usingRightHand ? USING_RIGHT_HAND_TEXT : USING_LEFT_HAND_TEXT;
    if (bowSwitching) {
      let switchDelay = 0;
      if (this.currentRightHandWeapon) switchDelay += equipDelayFor(this.currentRightHandWeapon) - 500;
      if (this.currentLeftHandWeapon) switchDelay += equipDelayFor(this.currentLeftHandWeapon) - 500;
      if (switchDelay > 0 && entity) entity.equipCountdown = (entity.equipCountdown ?? 0) + switchDelay / BOW_SWITCH_DIVISOR;
    }
    if (apply) this.applyWeapon();
    return message;
  }

  /** Drag-to-swing (WeaponManager.TrackMouseAttack over the ported
   *  gesture rules): accumulate while the attack button is held;
   *  fire when travel crosses Settings.WeaponAttackThreshold of the
   *  longest screen dimension (AUDIT 28 W11 - the field default
   *  weaponStates.ATTACK_THRESHOLD is what StartGameBehaviour overwrites).
   *  Returns the strike state when an attack starts. */
  gesture(dx, dy, held, dt, longestDim, {
    attackThreshold = getFloat('Controls', 'WeaponAttackThreshold', 0.001, 1.0),
    swingMode = getInt('Controls', 'WeaponSwingMode', 0, 2),
    bowDrawback = getBool('Controls', 'BowDrawback'),
    cancelHeld = false,
    rolls = Math.random,
  } = {}) {
    // AUDIT 23 (combat-2) - WeaponManager.cs:355-358: a bow never
    // tracks a swing; the attack input itself fires, forced to
    // StrikeDown (the BowDrawback-off classic instant shot - the
    // machine's StrikeUp draw half is that setting's other arm) and
    // only after the button was RELEASED since the last shot
    // (lastAttackHand == Hand.None).
    if (this.machine.isBow) {
      const rise = held && !this._bowHeld;
      this._bowHeld = held;
      const m = this.machine;
      if (bowDrawback) {
        // AUDIT 28 W12 (WeaponManager.cs:341, :353-360): the press DRAWS
        // (StrikeUp - the machine steps to the hold frame and waits);
        // drawn and holding, ActivateCenterObject held UN-draws without
        // an arrow (the >10 s timeout is the machine's own 'undraw'),
        // and letting the button go RELEASES (StrikeDown).
        if (m.state === 'StrikeUp' && m.frame === BOW_DRAWN_HOLD_FRAME) {
          if (cancelHeld) { machineCancelBowDraw(m, this.liveSpeed); return null; }
          if (!held && machineAttack(m, 'StrikeDown')) return 'StrikeDown';
          return null;
        }
        if (rise && m.state !== 'StrikeUp' && machineAttack(m, 'StrikeUp')) return 'StrikeUp';
        return null;
      }
      if (rise && machineAttack(m, 'StrikeDown')) return 'StrikeDown';
      return null;
    }
    this._bowHeld = false;
    // AUDIT 28 W11 (WeaponManager.cs:316-350): WeaponSwingMode 1 is
    // CLICK to attack, 2 is click OR hold - either way no swing is
    // tracked; the direction is Random.Range(UpRight, DownRight + 1),
    // six of MouseDirections' eight. Mode 0 (and every bow, above) is
    // the tracked gesture.
    if (swingMode !== 0) {
      const rise = held && !this._clickHeld;
      this._clickHeld = held;
      if (!held) { this._gestureClear(); return null; }
      if (!(rise || swingMode === 2)) { this._gestureClear(); return null; }
      const dir = CLICK_ATTACK_DIRECTIONS[Math.floor(rolls() * CLICK_ATTACK_DIRECTIONS.length)];
      const strike = DIRECTION_TO_STRIKE[dir];
      return machineAttack(this.machine, strike) ? strike : null;
    }
    this._clickHeld = false;
    // Gesture.Clear (:149-154) on release, and on the frame tracking
    // starts (:312, :328 - "Reset tracking if user not holding down").
    if (!held) { this._tracking = false; this._gestureClear(); return null; }
    if (!this._tracking) { this._tracking = true; this._gestureClear(); }
    const sum = this._gestureAdd(dx, dy, dt);
    // AUDIT 24 combat: the gate is TravelDist, the length of the TRAIL,
    // not the magnitude of the sum. DFU's Gesture keeps both and its
    // own comment says why - "This isn't equal to the magnitude of the
    // sum because the trail may bend" (:99-100) - and :808 compares
    // `_gesture.TravelDist/_longestDim`. The port had collapsed the two
    // into the one quantity DFU says is not the threshold: drag 60px
    // right then 50px left and DFU swings on a trail of 110 while the
    // port saw 10 and refused.
    // AUDIT 28 W11: the gate is the SETTING - StartGameBehaviour :263
    // writes Settings.WeaponAttackThreshold over WeaponManager's field
    // default (0.05, weaponStates.ATTACK_THRESHOLD), and the shipped ini
    // is 0.005. The port gated on the field default: ten times the
    // travel DFU asks for before a swing fires.
    if (this._gtravel / longestDim < attackThreshold) return null;
    const angle = Math.atan2(-sum[1], sum[0]) * 180 / Math.PI;   // screen-up positive
    const strike = DIRECTION_TO_STRIKE[gestureDirection(angle)];
    this._gestureClear();
    if (strike && machineAttack(this.machine, strike)) return strike;
    return null;
  }

  /** Gesture.Clear (WeaponManager.cs:149-154). */
  _gestureClear() {
    this._gpoints.length = 0;
    this._gx = 0; this._gy = 0; this._gtravel = 0;
  }

  /** Gesture.Add (:132-146), TrimOld (:111-123) first. AUDIT 24 combat:
   *  MaxGestureSeconds is a SLIDING WINDOW over a timestamped trail,
   *  not a hard reset - TrimOld drops only the points older than the
   *  window and subtracts each from the sum and the travel, so motion
   *  from 0.9s ago still counts at t=1.0s. The port zeroed the whole
   *  accumulator at every 1s boundary, throwing away the current
   *  frame's motion with it and roughly doubling the swing threshold
   *  for any drag that ran past a second. */
  _gestureAdd(dx, dy, dt) {
    this._gnow += dt;
    let old = 0;
    for (const p of this._gpoints) {
      if (this._gnow - p.t <= MAX_GESTURE_SECONDS) continue;
      old++;
      this._gx -= p.dx; this._gy -= p.dy;
      this._gtravel -= p.mag;
    }
    if (old) this._gpoints.splice(0, old);
    const mag = Math.hypot(dx, dy);
    this._gpoints.push({ t: this._gnow, dx, dy, mag });
    this._gx += dx; this._gy += dy; this._gtravel += mag;
    return [this._gx, this._gy];
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
  resolveHit(foes, playerCombat, canSee, rolls = Math.random, backstabOf = () => 0, say = null, onPoison = null, { protection } = {}) {
    const results = [];
    // AUDIT 28 W2b: TWO ARMS, as MeleeDamage has them. The box pass
    // strikes every unprotected foe in reach; the protected ones it
    // passed over are kept, and if NOTHING was struck the vanilla arm
    // (:1057-1064, one SphereCast down the look ray) takes the NEAREST
    // of them - "pacified NPCs and commoners can only be attacked if
    // they are the only targets in front of the player." The port has
    // no ray here (canSee is the hosts' FOV + LOS test), so the nearest
    // in-reach protected foe stands in for the first collider on the
    // ray; recorded in Audit-28.md.
    const protectedInReach = [];
    const strike = (foe) => {
      const damage = calculateAttackDamage(playerCombat, foe.entity, {
        ...playerAttackOptions(this.weapon, this.machine.state, backstabOf(foe), rolls), say,
        // C2-slice (AUDIT 23 combat-11): the PLAYER's poisoned blade
        // infects ITS victim - the formulas clear the weapon's poison
        // either way, so without this hook the dose vanished unspent.
        onInflictPoison: onPoison ? (att, tgt, pt) => onPoison(foe, pt) : null,
      });
      results.push({ foe, damage });
    };
    for (const foe of foes) {
      if (foe.dead || !foe.entity) continue;
      const { dist, inView, losClear } = canSee(foe);
      if (!playerMeleeCanHit(dist, inView, losClear)) continue;
      if (friendlyProtected(foe, protection === undefined ? {} : { protection })) { protectedInReach.push({ foe, dist }); continue; }
      strike(foe);
    }
    if (results.length === 0 && protectedInReach.length) {
      protectedInReach.sort((a, b) => a.dist - b.dist);
      strike(protectedInReach[0].foe);
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
