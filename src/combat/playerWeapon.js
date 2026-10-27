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
  createWeaponMachine, machineAttack, machineStep, gestureDirection, strikeTicks, getMeleeWeaponAnimTime,
  MAX_GESTURE_SECONDS, BOW_DRAWN_HOLD_FRAME, machineCancelBowDraw, THUNDERLOCK_NUM_FRAMES, CLASSIC_UPDATE_INTERVAL,
  blowSchedule,   // MW-PACE1: the strike just begun, timed - what the Morrowind arm fits its blow into
} from '../characters/weaponStates.js';
import { GUN_FEEL, GUN_TICK_SECONDS, thunderlockReloadSeconds, PISTOLET_FEEL } from './gun/gunFeel.js';   // FIELD-GUN7: the lab's cadence, from the one home
import { DIRECTION_TO_STRIKE, ATTACKS_FP, sampleClip } from '../characters/anims.js';
import { combinePose } from '../characters/animate.js';
import { weaponTypeForItem, WEAPON_TYPES, isGunType, isPistoletType } from './fpsWeapon.js';
import { createPair, PAIR_TRIGGER } from './gun/pistolPair.js';   // PISTOL-PORT: a Pistolet fires on the pistol lab's own machines
import { WEAPONS } from '../characters/weapons.js';
import { POSES } from '../characters/poses.js';
import { calculateAttackDamage } from './formulas.js';
import { isShieldTemplate } from '../systems/armorMaterials.js';   // a12: UpdateHands' IsShield leg
import { equipDelayFor } from '../systems/equip.js';               // a12: ToggleHand's EquipDelayTimes[GroupIndex]
import { getBool, getFloat, getInt } from '../systems/settings/settings.js';   // AUDIT 28 W2b: MeleeAttackFriendlyProtection; W11: WeaponAttackThreshold, WeaponSwingMode
import { blowReaches, blowMult, scaleBlowDamage, playerBody, tellTechniqueLanded } from './technique/techniqueBlow.js';   // TECH1: a technique's blow - its shape and its weight, a leaf; MARTIAL3: and its landing told
import { HANDS_MODE, handsModeOf, strikeHandOf, twoHanded, offHandToHit, OFF_HAND_BLOW, offHandBurden, offHandHold, DUAL, gunHandOf, mixedStrike, otherHand, MIXED } from './twoHands/handsLaw.js';   // TWO-HANDS: which hand strikes, and what the off hand costs; MIXED-PAIR: a blade and a gun
import { getItemHands } from '../systems/equip.js';   // TWO-HANDS: a hand's item as the law reads it (one-handed or not)
import { readSwing } from './swingLaw.js';   // TWO-HANDS: the striking weapon's weight and the Strength, for the off hand's burden
import { liveStat } from '../systems/statMods.js';   // TWO-HANDS: the off hand's sureness reads the live Agility

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
// WeaponManager.cs:343's click draw lives in characters/weaponStates.js beside the gesture's own ways (AUDIT
// TOUCH-BUTTONS A7: the touch Attack button draws from it too, and the door's menu reads that module)
import { CLICK_ATTACK_DIRECTIONS } from '../characters/weaponStates.js';
export { CLICK_ATTACK_DIRECTIONS };

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
import { noteFirstUse } from '../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page
export { BOW_SWITCH_DIVISOR };

/** Internal_Strings.csv: usingRightHand / usingLeftHand - the two
 *  PopupMessage lines ToggleHand raises (:709, :711). */
export const USING_RIGHT_HAND_TEXT = 'Using weapon in right hand.';
export const USING_LEFT_HAND_TEXT = 'Using weapon in left hand.';

/** StartGameBehaviour.StartFromClassicSave :605-606, the whole line:
 *  `weaponManager.UsingRightHand = !saveVars.UsingLeftHandWeapon`.
 *  THE SEAM: formats/save/saveVarsFile.js has parsed the byte since SAV2
 *  (:183, offset 0x3D9) and systems/classicSave.js recorded it as
 *  "read but dropped - the port has no left-hand rig". It has one
 *  now; this is the import that classicSave's snapshot builder calls,
 *  kept here so the law and its citation live with the hand. */
export const usingRightHandFromSaveVars = (saveVars) => !saveVars?.usingLeftHandWeapon;

/**
 * HARD2c - THE PORT-SAVE HALF OF THE SAME PAIR.
 *
 * DFU writes the sheath and the hand as ONE pair and restores them as
 * ONE pair:
 *
 *   SerializablePlayer.cs:175-176   data.weaponDrawn   = !weaponManager.Sheathed;
 *                                   data.usingLeftHand = !weaponManager.UsingRightHand;
 *   SerializablePlayer.cs:420-421   weaponManager.Sheathed      = !data.weaponDrawn;
 *                                   weaponManager.UsingRightHand = !data.usingLeftHand;
 *
 * The port had that pair written out BY HAND in three hosts and read
 * back in three more - world.js, scenes/dungeonContext.js and
 * worldModes.js - and **AUDIT 63 F25 is what four copies of a two-line
 * law costs**: the port carried only the first of the two lines, so a
 * player fighting with the left-hand weapon loaded back holding the
 * right hand's item, or bare fists. By the time it was found the two
 * restore lines had drifted six and thirteen lines apart inside their
 * own hosts, and the comment that pointed between them cited line
 * numbers that no longer existed.
 *
 * So the pair lives here, beside `usingRightHandFromSaveVars` - the
 * CLASSIC-save half of the very same law - for the reason that one
 * already gives: the law and its citation live with the hand. The hosts
 * keep their rigs; they ask for the pair.
 *
 * @typedef {{ weaponDrawn: boolean, usingRightHand: boolean }} WeaponPose
 */

/**
 * SerializablePlayer.cs:175-176, off whichever rig is in the player's
 * hands.
 *
 * NULL IN, NULL OUT - AND NO CALLER RELIES ON THAT TODAY. The first
 * draft of this comment said the callers use it to mean "this mode has
 * no rig of its own to answer for"; AUDIT-176 found that false. All
 * three call sites pass a rig their host guarantees, and worldModes'
 * own "no rig here" answer is its `mode === 'interior' ? ... : null`
 * ternary, not this arm.
 *
 * It is kept, and the reason is worth stating because it is the one
 * BEHAVIOUR CHANGE this extraction made: the inline arithmetic it
 * replaced dereferenced the rig unguarded (`!rig.sheathed`), so a null
 * rig THREW - loudly, at the save. This returns null, and the composed
 * bag then simply omits the pair, which a presence-gated restore reads
 * as "leave the live hand". That is quieter, and quieter is worse.
 * `test/combat/hard2c_weaponpose.test.js` pins the difference rather than
 * leaving it to be discovered: if a caller ever does pass null, the
 * pin says what changed and when.
 */
export const weaponPoseOf = (w) => (w ? { weaponDrawn: !w.sheathed, usingRightHand: w.usingRightHand } : null);

/** RR1: WeaponManager.Sheathed / ScreenWeapon.WeaponType, asked by a law
 *  that lives nowhere near the rig (Roleplay & Realism's climbing gate
 *  reads both, RoleplayRealism.cs:323). The rig registers a probe when
 *  it stands; a host with no rig answers null. */
let _poseProbe = null;
export function setWeaponPoseProbe(fn) { _poseProbe = typeof fn === 'function' ? fn : null; }
export const currentWeaponPose = () => _poseProbe?.() ?? null;

/**
 * SerializablePlayer.cs:420-421, into whichever rig is handed over.
 *
 * THE FLAG ONLY, and PRESENCE-GATED, which are two separate laws that
 * every copy of this used to restate:
 *
 *  - Flag only. The C# restore sets the property and calls no
 *    ApplyWeapon, because WeaponManager.Update's UpdateHands ends in
 *    ApplyWeapon on the very next frame (:699). The port's twin is the
 *    rig's per-frame `syncWorn` (updateHands + applyWeapon(claws)),
 *    which re-binds the screen weapon to the restored hand AND re-runs
 *    the shield override that forces the right hand (:656). A bare
 *    `applyWeapon()` here would drop the racial claws for a frame and
 *    would null a `bindWorn: false` rig's scripted weapon.
 *  - Presence-gated. A pre-field envelope - and the classic import
 *    before its own arm - leaves the LIVE hand alone rather than
 *    reading `undefined` as "sheathed, right hand".
 */
export function applyWeaponPose(w, pose) {
  if (!w || !pose) return false;
  if (pose.weaponDrawn != null) w.sheathed = !pose.weaponDrawn;
  if (pose.usingRightHand != null) w.usingRightHand = !!pose.usingRightHand;
  return true;
}

/**
 * SL-2 (AUDIT 65): the rig in the player's hands beats the host's own.
 *
 * DFU has ONE WeaponManager for every WorldContext and :175-176 reads
 * it wherever the save is taken; the world host has four rigs and read
 * its own EXTERIOR one unconditionally, so an F9 pressed inside a shop
 * recorded the street's sheath and hand. The mode host answers for the
 * rig actually drawn, and null outside interior mode.
 *
 * PER FIELD, not whole-bag, and that is deliberate: a mode host that
 * answers a PARTIAL pose - one built before a field existed - must
 * still compose exactly as it did before that field, member by member,
 * rather than blanking the host's own value. `??` and not `||`, so a
 * legitimately `false` flag survives.
 */
export const mergeWeaponPose = (live, own) => ({
  weaponDrawn: live?.weaponDrawn ?? own?.weaponDrawn,
  usingRightHand: live?.usingRightHand ?? own?.usingRightHand,
});

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

/** TWO-HANDS: a hand's item as combat/twoHands/handsLaw.js reads it - its WeaponTypes and its ItemHands (a custom class answers
 *  GetItemHands through the equip law) - or null for an empty hand. */
export function handDesc(item) {
  if (!item) return null;
  return { item, type: weaponTypeForItem(item), hands: getItemHands(item), shield: false };
}
/** TWO-HANDS: the left hand holding a shield (UpdateHands blanks its cache, so the law is told so outright). */
const SHIELD_HAND = Object.freeze({ item: true, shield: true });

/** AUDIT MIXED-PAIR L1-3: A RELOAD A FLOAT'S WIDTH FROM ITS END IS ENDED. The gun machine sums `dt * 1000` (gunMachine.js,
 *  the prototype's own, untouched), which lands a hair either side of `cooldownMs` by the frame rate - 126 frames of 16.67 ms
 *  are 2100.000000000003, 63 of 33.33 ms 2099.999999999998 - and a mixed pair's gun is asked only as the blade's blow ends:
 *  a hair short cost the gun a whole swing at 30 fps that 60 did not. Asked as the pair's turn is decided, the reload's
 *  own step ends it (the machine's `ready`); nothing else reads it. */
const RELOAD_EPS_MS = 1e-6;
function settleReload(g) {
  if (g?.state === 'Cooling' && g.cooldownMs - g.cooledMs <= RELOAD_EPS_MS) { g._cool = g.cooldownMs; g.step(0); }
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
    noteFirstUse('combat');   // TUT1: the first weapon drawn
    const t = weaponTypeForItem(this.weapon);
    return t !== WEAPON_TYPES.Melee && t !== WEAPON_TYPES.None;
  }

  /** DISC28-D (Discord: "the speed attribute only affects the third-person animation, not the first-person swing
   *  rate"): the swing clock's Speed is the player's LIVE Speed, read on every step - FPSWeapon.GetAnimTickTime
   *  (FPSWeapon.cs:549-556) asks GetMeleeWeaponAnimTime(player.Stats.LiveSpeed ...) on each UpdateWeapon (:431), and
   *  the bow's cooldown asks the same stat. The rig hands a reader; a plain number is still accepted (a fixed-speed
   *  weapon, every test that pins the formula at 50). The weapon used to take a NUMBER once, and the rig gave it none,
   *  so every player swung at the default 50 while the third-person body and the widget's clone read the real stat. */
  get liveSpeed() { return this._liveSpeed(); }
  set liveSpeed(v) { this._liveSpeed = typeof v === 'function' ? v : () => v; }

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
    // TWO-HANDS (bible/05-Combat/Two-Hands.md): how the hands are held (combat/twoHands/handsLaw.js HANDS_MODE - DFU's one used
    // hand, both fists, or a pair), the strike in flight ({ hand, flurry, off } - strikeHandOf's answer as it began), and the
    // last strike's hand and the machine time it ended, which the next one alternates from. `usingRightHand` keeps
    // DFU's meaning and its saves: with both hands up it is the LEAD - the hand an exchange opens with.
    this.handsMode = HANDS_MODE.Single;
    this.leftBusy = false;   // a light carried in a hand - the rig's word, per frame (handsLaw.js handsModeOf)
    this.strike = null;
    this._lastHand = null;
    this._lastEnd = -Infinity;
    this._burdenCarry = 0;   // AUDIT 2: the fraction of a tick the off hand's last blow owed its burden, paid on its next (handsLaw.js offHandHold)
    /** PISTOL-PORT: the pistol lab's pair a Pistolet fires on (one pistol or two - `_pistolsFor`), each hand's strike as it
     *  was pulled and its direction - null for every other weapon. */
    this.pistols = null;
    this._pistolsAway = null;   // the pistols while another weapon is in use - their reloads run on (AUDIT PISTOLET A3)
    this._bladeTurn = false;   // MIXED-PAIR: the classic machine stepped as the pair's blade's last update, not as the pistols' mirror
    this._shotMirror = false;   // AUDIT MIXED-PAIR L1-4: the classic machine mirrors a shot - from its pull to its frames' end (`_pistolsStep`'s 'done')
    this._shotHand = null;   // AUDIT MIXED-PAIR L1-1: the hand whose shot's hit was last handed to the host - a gun pair's, while the arm holds it
    this._pistolHeld = null;   // AUDIT PISTOL-PORT A3: the items in each hand last frame, so a pistol moved takes its machine
    this._pistolHits = [];   // AUDIT PISTOL-PORT A2: the hands whose hit is due, handed to the host one an update
    this._classicCooldown = 0;   // AUDIT PISTOL-PORT C1: what the classic machine was owed when the pistols took it over
    this._pistolStrikes = { R: null, L: null };
    this._pistolDir = { R: 'StrikeDown', L: 'StrikeDown' };
    /** MIXED-PAIR: may a mixed pair's gun fire a pull - the rig's word (a Pellet for the shot, combat/weapon/weaponRig.js
     *  pelletsOwed); a pull it refuses falls to the blade (handsLaw.js mixedStrike). */
    this.gunReady = () => true;
    /** MIXED-PAIR: is a shot's hit still held for the Morrowind arm's release (MW-D42) - the rig's word; the gun's strike
     *  is not over, and the classic machine not the blade's, until it lands. */
    this.shotHeld = () => false;
    this.sheathed = true;   // classic starts sheathed; Z readies (WeaponManager.Sheathed)
    this.lastDrawMs = 0;   // PCO1: the last bow shot's weaponAnimTime (_bowAnimTimeMs)
    // TECH1 (bible/05-Combat/Weapon-Techniques.md): the swing in flight is a technique's - its blow (combat/technique/techniqueBlow.js:
    // the reach, the arc, the weight), set as the technique starts the swing and taken down once the machine is idle again
    // (combat/techniques.js), so every pool the ONE swing is offered to reads the same blow. Null for every other swing.
    this.techniqueBlow = null;
    this.animCtx = null;   // AUDIT-RR F1: the rig's thunk answering { entity, weaponType, usingRightHand } - what GetMeleeWeaponAnimTime's C# signature carries (player, weaponType, weaponHands)
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
   * MW-HAND (2026-09-26, Mac: "Weapons when swapped into left hand dont work showing fists - id say remove the ability
   * when in morrowind since its not visible"; asked, "Never on an empty hand"): THE MORROWIND LANE'S DEPARTURE. DFU
   * lets the hand in use be an empty one - H to a bare left hand is how a classic player fights with fists, and the
   * sprite shows which hand is up. The Morrowind arm draws one weapon and no second hand, so there a weapon in the
   * hand not in use was a weapon that would not show, over fists. In that lane (the rig calls this only while the arm
   * is built) the hand in use follows the weapons: an empty hand gives way to the other when it holds one.
   * @returns true when the hand moved.
   */
  followHeldHand() {
    if (this.usingRightHand && !this.currentRightHandWeapon && this.currentLeftHandWeapon) { this.usingRightHand = false; return true; }
    if (!this.usingRightHand && !this.currentLeftHandWeapon && this.currentRightHandWeapon) { this.usingRightHand = true; return true; }
    return false;
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
    // TWO-HANDS: the hands' mode follows the caches UpdateHands just wrote (a shield is not an empty hand - it reads as
    // the left hand's, a shield) and the beast's claws are always one hand
    this.handsMode = racialWeapon ? HANDS_MODE.Single : handsModeOf({
      right: handDesc(this.currentRightHandWeapon),
      left: this.holdingShield ? SHIELD_HAND : handDesc(this.currentLeftHandWeapon),
      leftBusy: this.leftBusy,
    });
    if (racialWeapon) { this.weapon = racialWeapon; return this.weapon; }
    // TWO-HANDS: the hand in use is the STRIKING hand while a strike of both hands is in flight, else the used hand -
    // so everything that reads `weapon` at the blow (the skill tallied, the swing's sound, the art) reads the weapon that
    // struck it, as DFU's every read of the used hand's item does (WeaponManager.cs:430-433, :909)
    this.weapon = this.handItem(this.activeHand);
    return this.weapon;
  }

  /** TWO-HANDS: the hand H leads with - DFU's used hand. */
  get leadHand() { return this.usingRightHand ? 'R' : 'L'; }
  /** TWO-HANDS: the hand in use this frame - the striking hand while a strike is in flight, else the lead. AUDIT MIXED-PAIR
   *  L1-1: A SHOT IS ITS GUN'S UNTIL IT LANDS - its frames, and a hit the Morrowind arm holds for its release after them
   *  (`shotHeld`, MW-D42): a mixed pair's gun hand wherever its strike was named, a gun pair's held shot's own hand - so
   *  the host that reads `weapon` at the hit reads the gun that fired it, never the lead blade or the lead pistol. */
  get activeHand() {
    if (this.mixedPair && this._gunStriking()) return /** @type {'R'|'L'} */ (this.gunHand);
    if (this.gunPair && this._shotHand && this.shotHeld() === true) return this._shotHand;
    return twoHanded(this.handsMode) && this.strike && this.machine.state !== 'Idle' ? this.strike.hand : this.leadHand;
  }
  /** TWO-HANDS: a hand's item, as UpdateHands cached it (null for an empty hand or a shield). */
  handItem(hand) { return (hand === 'L' ? this.currentLeftHandWeapon : this.currentRightHandWeapon) ?? null; }
  /** TWO-HANDS (AUDIT): the strike in flight is the OFF hand's - the blow a player-vs-player arm rolls carries the off
   *  hand's terms as resolveHit's does (combat/duelCombat.js resolveDuelStrike `off`). */
  get offStrike() { return !!(this.handsMode === HANDS_MODE.Dual && this.strike && this.machine.state !== 'Idle' && this.strike.off); }
  /** TWO-HANDS (AUDIT): the weapon AT REST - the lead hand's with both hands up, else the weapon in use. What the HUD's
   *  diamond and a technique read, so neither flickers to the off hand's item for its blows (the weapon in use is the
   *  striking hand's mid-blow - its art, its skill, its swing). */
  get restingWeapon() { return twoHanded(this.handsMode) && !this.weapon?.werecreatureClaws ? this.handItem(this.leadHand) : this.weapon; }
  /** TWO-HANDS (AUDIT 2): the blow in flight AS A BLOW - the off hand's OFF_HAND_BLOW.blowWeight, every other 1: what the
   *  hosts' tally counts a swing as (scenes/hostCombat.js tallySwingSkills), as the formula counts its riders. */
  get blowWeight() { return this.offStrike ? OFF_HAND_BLOW.blowWeight : 1; }
  /** AUDIT PISTOLET A1: is this item the OFF hand's in a pair - a shot's own weapon read at its impact (combat/arrowFlight.js
   *  playerArrowHitFoe). A shot lands after its strike is done, when `offStrike` has gone back to the lead, so the gun it
   *  left is what says whose shot it was: two Pistolets are two items. */
  isOffHandItem(item) { return !!item && this.handsMode === HANDS_MODE.Dual && item === this.handItem(this.leadHand === 'L' ? 'R' : 'L'); }
  /** TWO-HANDS: the strike in flight, or null - `{ hand, flurry, off }`. */
  get strikeInFlight() { return this.machine.state !== 'Idle' ? this.strike : null; }

  /** TWO-HANDS: the next strike, as the law answers it from the hands, the lead and the last blow. */
  _nextStrike() {
    return strikeHandOf({ mode: this.handsMode, lead: this.leadHand, last: this._lastHand, sinceLast: this.machine.now - this._lastEnd });
  }

  /**
   * PISTOLET: A PAIR OF GUNS - two Dwarven Pistolets, one in each hand (handsLaw.js DUAL_GUN_TYPES). They fire on the
   * pistol lab's own pair (PISTOL-PORT, `_pistolsFor` below): each pistol its own machine, its own six frames and its own
   * reload, the hands taking turns by the law's flurry - and a pull the law gives to a hand still reloading falls to the
   * loaded one (a sword can always swing; a pistol mid-reload cannot fire).
   */
  get gunPair() {
    return this.handsMode === HANDS_MODE.Dual && isGunType(weaponTypeForItem(this.handItem('R'))) && isGunType(weaponTypeForItem(this.handItem('L')));
  }
  /** MIXED-PAIR (handsLaw.js gunHandOf): the hand of a blade-and-Pistolet pair that holds the gun, or null. */
  get gunHand() {
    return this.handsMode === HANDS_MODE.Dual ? gunHandOf(handDesc(this.handItem('R')), handDesc(this.handItem('L'))) : null;
  }
  /** MIXED-PAIR: a blade in one hand and a Pistolet in the other. */
  get mixedPair() { return this.gunHand !== null; }
  /** MIXED-PAIR: the strike in flight is the mixed pair's gun's - its shot on the pistol's machine, mirrored on the classic
   *  one until its frames end (`_pistolsStep`'s 'done') - or its hit still held for the arm's release (`shotHeld`). AUDIT
   *  MIXED-PAIR L1-4: read off the mirror itself, not the strike's hand - a gun moved to the other hand (or a gun pair's
   *  pistol swapped for a blade) mid-shot is still a shot to its frames' end, never continued as the blade's swing. */
  _gunStriking() { return !!this.gunHand && (this._shotMirror || this.shotHeld() === true); }
  /** PISTOLET: is a hand's pistol loaded - its own machine Idle (a hand with no pistol is never waiting). */
  handLoaded(hand) { return this.pistols ? this.pistols[hand].state === 'Idle' : true; }
  /** PISTOLET: the machine time a hand's pistol is loaded again (0 when it is). */
  handReloadUntil(hand) {
    const left = this.pistols ? this._pistolLeft(hand) : 0;
    return left > 0 ? this.machine.now + left : 0;
  }

  /**
   * PISTOL-PORT (bible/05-Combat/Dwarven-Pistolet.md "PISTOL-PORT"; the owner: "I want the prototype itself implemented
   * just like we did with thunderlock"): A PISTOLET FIRES ON THE PISTOL LAB'S OWN MACHINES - one pistol, or a pair -
   * combat/gun/pistolPair.js createPair: two of the gun lab's machines and the page's trigger law, each pistol its own six
   * frames and its own reload, so a pair's second shot leaves while the first is still mid-shot, as it does on the page.
   * The classic machine keeps every reader it has as the pistols' MIRROR (`_pistolsMirror`): a strike while any pistol
   * fires, the latest one's frame, and the soonest a pistol is loaded; and its 'hit' is the pistol whose hit frame it is,
   * that hand's weapon and strike made current for the hosts that fire the shot. The pair, or null: a weapon that is no
   * Pistolet puts it by (`_pistolsAway`, stepped while it is, so a reload runs on the clock as AUDIT PISTOLET A3 kept it -
   * never skipped by drawing a sword and the pistol back); sheathed, the pistols in the hands keep theirs.
   */
  _pistolsFor() {
    const pair = this.gunPair, gh = this.gunHand;   // MIXED-PAIR: a blade-and-gun pair's one pistol is the gun hand's, whichever hand strikes
    const held = pair ? this.handItem('R') : gh ? this.handItem(gh) : (this.weapon ?? (this.sheathed ? this.handItem(this.leadHand) : null));
    if (!isPistoletType(weaponTypeForItem(held))) {
      if (this.pistols) this._pistolsPutBy();
      return null;
    }
    const trigger = pair ? PAIR_TRIGGER.Alternate : PAIR_TRIGGER.Single;
    if (!this.pistols) this._classicCooldown = this.machine.cooldownUntil;   // AUDIT PISTOL-PORT C1: kept for the weapon put by
    this.pistols ??= this._pistolsAway ?? createPair({ trigger, fps: PISTOLET_FEEL.fps, cooldownMs: PISTOLET_FEEL.reloadMs, hitFrame: PISTOLET_FEEL.hitFrame });
    this._pistolsAway = null;
    this.pistols.trigger = trigger;
    // AUDIT PISTOL-PORT A3: A RELOAD IS THE PISTOL'S, NOT THE HAND'S - a pistol moved to the other hand (unequipped and
    // worn in the other, its equip delay nought) takes its own machine with it; on the hand's, one Pistolet juggled
    // between the hands fired a pair's rate at full damage
    const R = this.handItem('R'), L = this.handItem('L'), was = this._pistolHeld;
    if (was && ((R && R === was.L && R !== was.R) || (L && L === was.R && L !== was.L))) [this.pistols.R, this.pistols.L] = [this.pistols.L, this.pistols.R];
    this._pistolHeld = { R, L };
    // one pistol is the page's single, on the machine of the hand that HOLDS it - a pair broken mid-reload keeps the
    // pistol left its own reload (AUDIT PISTOLET A3); where it is drawn is the rig's (pistolLane.js flipOf)
    this.pistols.lead = pair ? this.leadHand : gh ?? (held === this.handItem('L') && held !== this.handItem('R') ? 'L' : 'R');
    this.pistols.inPair = !!gh;   // MIXED-PAIR: one pistol, a hand of a pair - drawn on its own hand's side (combat/gun/pistolLane.js)
    // MIXED-PAIR (handsLaw.js MIXED.RELOAD): the gun beside a blade reloads one-handed - each machine's own reload, so a
    // pair that stops being mixed (the blade put away mid-reload) loads at a free hand's pace from there
    // AUDIT MIXED-PAIR L1-6: a reload under way keeps the share it has loaded - the rest loads at the new pace
    for (const h of /** @type {const} */ (['R', 'L'])) {
      const g = this.pistols[h], ms = PISTOLET_FEEL.reloadMs * (h === gh ? MIXED.RELOAD : 1);
      if (g.cooldownMs === ms) continue;
      if (g.state === 'Cooling' && g.cooldownMs > 0) g._cool *= ms / g.cooldownMs;
      g.cooldownMs = ms;
    }
    return this.pistols;
  }
  /** PISTOL-PORT: the seconds until a pistol is loaded again - its frames still to play and its reload, nought when Idle. */
  _pistolLeft(hand) {
    const g = this.pistols[hand];
    if (g.state === 'Idle') return 0;
    if (g.state === 'Cooling') return Math.max(0, g.cooldownMs - g.cooledMs) / 1000;
    return Math.max(0, g.frames / g.fps - g._t) + g.cooldownMs / 1000;   // THUNDERLOCK-ART2's audit: the machine's own cycle length, never the lab sheet's
  }
  /** PISTOL-PORT: the classic machine as the pistols' mirror - in the latest firing pistol's strike while any fires. */
  _pistolsMirror() {
    const m = this.machine, p = this.pistols, hands = p.hands();
    const firing = hands.filter((h) => p[h].state === 'Firing');
    const h = firing.includes(p.last) ? p.last : firing[0];
    m.state = h ? this._pistolDir[h] : 'Idle';
    m.frame = h ? p[h].frame : 0;
    m.tick = 1 / p.R.fps; m.hitFrame = p.R.hitFrame;   // AUDIT PISTOL-PORT C4: the pistols' own frame clock - the arm's flash runs on it
    // MIXED-PAIR: the gun's reload is the gun's alone - the blade beside it swings as soon as the shot's frames end
    m.cooldownUntil = this.mixedPair ? Math.max(m.now, this._classicCooldown) : m.now + Math.min(...hands.map((x) => this._pistolLeft(x)));   // AUDIT MIXED-PAIR L1-5: and what the machine was owed when the pistols took it (AUDIT PISTOL-PORT C1)
  }
  /** PISTOL-PORT: a pull - the page's (`pull`), or a technique's the lead hand's (`fireHand`). True when a pistol fired. */
  _pistolShot(state, lead, s = null) {
    const p = this.pistols, pair = this.gunPair;
    const fired = lead ? p.fireHand(p.lead) : p.pull(0);
    if (!fired.length) return false;
    const h = fired[0];
    // MIXED-PAIR: `s` is the law's strike for the gun hand (its flurry and its off), the pair's exchange the classic clock's
    this._pistolStrikes[h] = s ?? { hand: pair ? h : this.leadHand, flurry: !!p.lastShot?.flurry, off: pair && h !== this.leadHand };
    this._pistolDir[h] = state;
    this.strike = this._pistolStrikes[h];
    this._shotMirror = true;
    if (pair || s) this.weapon = this.handItem(h);
    this._pistolsMirror();
    return true;
  }
  /** AUDIT PISTOL-PORT A9: the pistols put by for another weapon - their reloads run on (`_pistolsAway`), and the classic
   *  machine stops mirroring them: no shot of theirs is still to land, nor finished as the new weapon's blow, and the new
   *  weapon never waits out a pistol's reload. AUDIT PISTOL-PORT C1: but it does wait out its OWN - the classic machine is
   *  given back what it was owed when the pistols took it (a Thunderlock swapped through a Pistolet for one frame by the
   *  quickslot key, its equip delay nought, fired again at once: three times its rate). */
  _pistolsPutBy() {
    const m = this.machine;
    this._pistolsAway = this.pistols; this.pistols = null; this._pistolHits.length = 0; this._shotMirror = false;
    // MIXED-PAIR: a blade-and-gun pair's gun put by mid-blow - the machine is the blade's, its blow lands as a swap never cut
    // one; AUDIT MIXED-PAIR L1-5: owing what it was owed when the pistols took it (AUDIT PISTOL-PORT C1)
    if (this._bladeTurn) { m.cooldownUntil = Math.max(this._classicCooldown, m.cooldownUntil); return; }
    m.state = 'Idle'; m.frame = 0; m.cooldownUntil = Math.max(this._classicCooldown, m.now); this.strike = null;
  }
  /** AUDIT PISTOL-PORT A5: the pistol shots pulled whose hit is not yet handed to the host - each owes its Pellet. */
  pistolShotsDue() {
    const p = this.pistols;
    return p ? this._pistolHits.length + p.hands().filter((h) => p[h].state === 'Firing' && p[h].frame < p[h].hitFrame).length : 0;
  }
  /**
   * PISTOL-PORT: one step of the pistols, on the machine's clock - each pistol's hit, the mirror, and the strike's end.
   * AUDIT PISTOL-PORT A2: ONE HIT AN UPDATE. Every host fires a 'hit' with the weapon, strike and blow the player weapon
   * holds as it reads the event, and two machines can hit in one step (a flurry pulled a frame apart, a 50 ms frame): both
   * were the second pistol's - its weapon, its off-hand blow, its barrel. So a hit due is queued, in the order the pistols
   * fired, and handed out one an update with its own hand current; the second lands a frame later, never as the first.
   * AUDIT PISTOL-PORT A6: a pistol no longer drawn (a pair broken between a pull and its hit) fires nothing.
   */
  _pistolsStep(dt) {
    const m = this.machine, p = this.pistols;
    m.now += dt;
    m.ranged = true;
    const ev = p.step(dt);
    const due = ['R', 'L'].filter((h) => ev[h] === 'hit');
    if (due.length === 2 && due[0] === p.last) due.reverse();   // the earlier shot first - `last` fired most recently
    this._pistolHits.push(...due);
    const evs = [];
    while (this._pistolHits.length) {
      const h = this._pistolHits.shift();
      if (!p.hands().includes(h)) continue;
      this.strike = this._pistolStrikes[h] ?? this.strike;
      if (this.gunPair) this.weapon = this.handItem(h);
      this._shotHand = h;
      evs.push('hit');
      break;
    }
    this._pistolsMirror();
    if (this.strike && m.state === 'Idle' && !this._pistolHits.length) {
      evs.push('done');
      // MIXED-PAIR: a blade-and-gun pair's exchange is the classic clock's, the blade's and the shot's alike - the shot's end
      // is the one the blade answers from
      if (this.mixedPair) { this._lastHand = this.strike.hand; this._lastEnd = m.now; }
      this._shotMirror = false;
      this.strike = null;   // the pistols keep their own flurry clock (pistolPair.js `last`, `lastEnd`) - the classic one is a sword's
    }
    return evs;
  }
  /** TWO-HANDS: a NEW strike begun on the machine - the law picks its hand, and with both hands up the weapon in use is
   *  that hand's from its first frame (a rig whose weapon no equip table supplies - bindWorn off - stays single, so
   *  its weapon is never touched). Every door that starts a melee strike comes through here; `lead` makes it the lead
   *  hand's whatever the exchange (a technique: the weapon it was chosen for). */
  _attack(state, { lead = false } = {}) {
    if (this.mixedPair) return this._mixedAttack(state, lead);   // MIXED-PAIR: the hands take turns, each by its own kind
    if (this._pistolsFor()) return this._pistolShot(state, lead);   // PISTOL-PORT: a Pistolet's pull is the page's
    return this._swing(state, lead ? { hand: this.leadHand, flurry: false, off: false } : this._nextStrike());
  }

  /**
   * MIXED-PAIR (handsLaw.js gunHandOf, mixedStrike): A BLADE AND A PISTOLET. The law names the hand (the lead opens, the
   * other answers inside FLURRY_WINDOW), and each hand strikes by its kind - the gun's pull on its own pistol machine (its
   * six frames and its reload, PISTOL-PORT), the blade's swing on the classic machine with every term a pair's blow has.
   * ONE STRIKE AT A TIME: a pull while either is in flight starts nothing (the classic machine is busy - mirroring the
   * shot while its frames play), so the blade fills the gun's reload and never rides over its shot. A pull the law gives a
   * gun that cannot fire (reloading, or no Pellet for it - `gunReady`) falls to the blade; a technique is the lead's
   * alone, and waits for a lead gun's reload.
   */
  _mixedAttack(state, lead) {
    const gh = this.gunHand;
    if (this.machine.state !== 'Idle' || this._gunStriking()) return false;
    const p = this._pistolsFor();
    settleReload(p?.[gh]);
    const gunReady = !!p && p[gh].state === 'Idle' && this.gunReady() !== false;
    const named = lead ? { hand: this.leadHand, flurry: false, off: false } : this._nextStrike();
    const s = lead ? named : mixedStrike(named, { gunHand: gh, gunReady, lead: this.leadHand });
    if (s.hand === gh) return gunReady && this._pistolShot(state, true, s);
    this._tuneClassic(weaponTypeForItem(this.handItem(s.hand)));   // the blade's law - the gun's last shot left the machine on its own clock
    return this._swing(state, s);
  }

  /** TWO-HANDS: a melee strike `s` (strikeHandOf's answer) begun on the classic machine. */
  _swing(state, s) {
    if (!machineAttack(this.machine, state)) return false;
    this.strike = s;
    if (twoHanded(this.handsMode) && !this.weapon?.werecreatureClaws) this.weapon = this.handItem(s.hand);
    // TWO-HANDS (AUDIT): a flurry's blow is thrown from the raised hand - it starts FLURRY_FROM_FRAME frames into its
    // swing (handsLaw.js DUAL: quickness in frames, never in a tick's time, so it is the same at every frame rate)
    // (a Pistolet never comes here - its pull is the page's, above, its six frames a mechanism's)
    if (s.flurry) this.machine.frame = DUAL.FLURRY_FROM_FRAME;
    // TWO-HANDS (AUDIT 2): the off hand's burden, in whole ticks held at its swing's end (handsLaw.js offHandHold) - read
    // off the striking weapon and the Strength as SWING-LAW reads them, on the tick this swing runs at
    if (this.offStrike) {
      const ctx = this.animCtx?.() ?? null;
      const w = ctx ? readSwing(ctx) : null;
      if (w) {
        const tick = this.machine.tick ?? getMeleeWeaponAnimTime(this.liveSpeed, ctx);
        const owed = offHandHold({ burden: offHandBurden(w.weight, w.strength), ticks: strikeTicks(this.machine), tick, carry: this._burdenCarry });
        this.machine.hold = owed.hold; this._burdenCarry = owed.carry;
      }
    }
    return true;
  }

  /**
   * TWO-HANDS: THE SWING'S CTX - what GetMeleeWeaponAnimTime is asked with (AUDIT-RR F1's { entity, weaponType,
   * usingRightHand }, the C#'s player, weaponType, weaponHands): the hand in use, so a mod that reads the weapon reads the
   * striking one. Nothing else: a tick's time is the weapon's whatever the hand (AUDIT 2) - a flurry's quickness is in
   * its frames (_attack's FLURRY_FROM_FRAME) and the off hand's burden in whole ticks held at its end (_attack's hold).
   */
  swingCtx(entity) {
    return { entity, weaponType: weaponTypeForItem(this.weapon), usingRightHand: this.activeHand === 'R' };
  }

  /**
   * DISC10-E L2: THE STRIKING WEAPON, which is not the screen weapon.
   * MeleeDamage hands the formula `strikingWeapon = usingRightHand ?
   * currentRightHandWeapon : currentLeftHandWeapon` (WeaponManager.cs:909)
   * - the HAND's item - while ApplyWeapon's racial arm (:735-739) changes
   * only what the SCREEN draws. A transformed lycanthrope's hands were
   * emptied by MorphSelf (:463-467) and the pack is refused to the beast,
   * so DFU's claws strike as the bare hand: hand-to-hand, no material
   * gate. The port handed the wereclaws marker item to the formula as a
   * weapon - the material gate (0 damage on anything silver-to-hit) and a
   * 0-0 weapon range, ~9 a swing where the beast's +30 HandToHand fist
   * does ~21. Everything else `weapon` carries (the draw, the swing sound,
   * the art) is the screen's and stays. BAL6-CLAWS (bible/05-Combat/
   * Balance-Arc.md section 12): BAL6 had the claws strike as silver; the
   * owner reverted it - the bare hand, ungated, DFU's. BAL6-GAUNTLETS: the
   * plate gauntlets the beast wears add their metal's damage to it, a port
   * departure (combat/clawMetal.js, read by both cores).
   */
  get strikingWeapon() {
    if (!this.weapon?.werecreatureClaws) return this.weapon;
    return this.handItem(this.activeHand);   // TWO-HANDS: the used hand - the beast is always single, so its lead
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
   * PORT NOTE (the CH3 collapse, equip.js:"the port's single"): DFU keeps a countdown
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
    // TWO-HANDS (AUDIT): with both hands up H picks the LEAD - nothing changes hands, so nothing is billed for a switch,
    // and the exchange in progress ENDS: the next blow opens a new one with the new lead (handsLaw.js strikeHandOf). Left
    // running, the blow after H was the old exchange's answer thrown by the new lead - a flurry's quickness with none of
    // the off hand's costs, every blow, for a key press between swings.
    if (twoHanded(this.handsMode)) { this._lastHand = null; this._lastEnd = -Infinity; }
    if (bowSwitching && !twoHanded(this.handsMode)) {
      let switchDelay = 0;
      if (this.currentRightHandWeapon) switchDelay += equipDelayFor(this.currentRightHandWeapon) - 500;
      if (this.currentLeftHandWeapon) switchDelay += equipDelayFor(this.currentLeftHandWeapon) - 500;
      if (switchDelay > 0 && entity) entity.equipCountdown = (entity.equipCountdown ?? 0) + switchDelay / BOW_SWITCH_DIVISOR;
    }
    // AUDIT 2: re-applied as ApplyWeapon does it - the racial arm first (WeaponManager.cs:735-739): the beast's claws stay
    // the weapon in use, one hand, so a transformed lycanthrope's H says DFU's line, not the fists'
    if (apply) this.applyWeapon(this.weapon?.werecreatureClaws ? this.weapon : null);
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
    // (lastAttackHand == Hand.None) - which the drawn bow keeps.
    // BOW-CLOCK departs for the instant shot below.
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
          if (!held && machineAttack(m, 'StrikeDown')) {
            // PCO1: the draw's length in milliseconds - FPSWeapon's
            // animTime, which WeaponManager hands CalculateAttackDamage
            // as `weaponAnimTime` and Roleplay Realism's archery reads.
            this.lastDrawMs = this._bowAnimTimeMs();
            return 'StrikeDown';
          }
          return null;
        }
        if (rise && m.state !== 'StrikeUp' && machineAttack(m, 'StrikeUp')) return 'StrikeUp';
        return null;
      }
      // BOW-CLOCK (FIELD BUGS 2026-10-09g, the owner's call on a player's "there is no way to actually just 'hold
      // attack' and continue to shoot arrows"): THE INSTANT SHOT REPEATS WHILE HELD - a DEPARTURE from DFU's
      // released-since-the-last-shot gate, for BowDrawback off alone. The machine still decides when: its cooldown
      // and its Idle refuse every frame until the bow is ready, so a held button looses the moment it is, at DFU's own
      // rate - and a press made early is not lost for being early. The drawn bow above keeps DFU's gate: it looses on
      // the button's release, so it cannot repeat on a hold.
      if (held && machineAttack(m, 'StrikeDown')) { this.lastDrawMs = this._bowAnimTimeMs(); return 'StrikeDown'; }   // PCO1: the instant shot has no draw (0 ticks held)
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
      const strike = this._rollClickStrike(rolls);
      return this._attack(strike) ? strike : null;   // TWO-HANDS: the law picks the hand
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
    if (strike && this._attack(strike)) return strike;   // TWO-HANDS: the law picks the hand
    return null;
  }

  /** AUDIT 68 S08-clickattack-direction-dup: WeaponManager.cs:343's
   *  roll over CLICK_ATTACK_DIRECTIONS - the swing-mode click and the
   *  touch button's clickAttack, one table. */
  _rollClickStrike(rolls) {
    return DIRECTION_TO_STRIKE[CLICK_ATTACK_DIRECTIONS[Math.floor(rolls() * CLICK_ATTACK_DIRECTIONS.length)]];
  }

  /** PCO1 / AUDIT 68 S08-bow-draw-time-wallclock: weaponAnimTime,
   *  `(int)(FPSWeapon.GetAnimTime() * 1000)` - the ticks the bow held in
   *  StrikeUp times its tick. GAME time: the machine counts them only
   *  while it steps (a pause mid-draw adds nothing) and keeps them across
   *  StrikeUp->StrikeDown; a shot loosed from Idle held none. */
  _bowAnimTimeMs() {
    const m = this.machine;
    return Math.trunc(m.ticks * (m.tick ?? CLASSIC_UPDATE_INTERVAL) * 1000);
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

  /** TECH1 (bible/05-Combat/Weapon-Techniques.md): A TECHNIQUE'S STRIKE - the machine's own strike `strike` begun for a
   *  weapon's technique (combat/techniques.js), by the same machineAttack a click takes; a bow's loose writes its draw
   *  time as the click's does (PCO1). True when it began - never mid-swing or in a bow's recovery. */
  techniqueStrike(strike) {
    if (!this._attack(strike, { lead: true })) return false;   // TWO-HANDS: a technique is the lead hand's - its weapon's (techniques.js reads it), never a flurry's
    if (this.machine.isBow) this.lastDrawMs = this._bowAnimTimeMs();
    return true;
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
    // AUDIT 68 S08-bow-draw-time-wallclock: and the shot's draw time is
    // written here too - a tap after a drawn shot inherited its value.
    if (this.machine.isBow) {
      if (!machineAttack(this.machine, 'StrikeDown')) return null;
      this.lastDrawMs = this._bowAnimTimeMs();
      return 'StrikeDown';
    }
    const strike = this._rollClickStrike(rolls);
    return this._attack(strike) ? strike : null;   // TWO-HANDS: the law picks the hand
  }

  /** @returns machine events; the caller resolves 'hit' via resolveHit. */
  update(dt) {
    // MIXED-PAIR: between the gun's shots the classic machine is the BLADE's - its type, its tick - whatever the hand at
    // rest; the gun's own machine reloads beside it (and its shot, while it plays, is mirrored as any Pistolet's)
    const blade = this.mixedPair && !this._gunStriking() ? this.handItem(otherHand(this.gunHand)) : null;
    // FPSWeapon.AnimateWeapon reads WeaponType every tick, and
    // weaponRig.syncWorn swaps this.weapon between the worn item and
    // null whenever the player sheathes - so the unarmed gate is READ
    // per step, never frozen at construction.
    const t = weaponTypeForItem(blade ?? this.weapon);
    this.machine.isUnarmed = t === WEAPON_TYPES.Melee || t === WEAPON_TYPES.Werecreature;
    // AUDIT 23 (combat-2): the bow half of the machine (0.0625 tick,
    // 7-frame release, bowSound frame 4, hit frame 5, GetBowCooldownTime)
    // was shipped but nothing ever set isBow - bows swung on the melee
    // clock. Read per step, exactly like the unarmed gate above.
    this.machine.isBow = t === WEAPON_TYPES.Bow;
    // ARROW2: the bow's idle frame is the setting's (FPSWeapon.cs:533-534) - read per step, as DFU reads Settings there
    this.machine.bowIdleDrawn = this.machine.isBow && !getBool('Controls', 'BowDrawback');
    const pistols = this._pistolsFor();
    this._bladeTurn = !!blade;
    if (pistols && !blade) return this._pistolsStep(dt);   // PISTOL-PORT: a Pistolet steps on the pistol lab's machines
    (pistols ?? this._pistolsAway)?.step(dt);   // and pistols put by for another weapon reload on (MIXED-PAIR: the pair's gun beside its blade)
    this._tuneClassic(t);
    const evs = machineStep(this.machine, dt, this.liveSpeed, this.animCtx?.() ?? null);
    // TWO-HANDS: a strike that ends is the one the next alternates from - its hand, and the machine time it ended
    if (evs.includes('done')) { this._lastHand = this.strike?.hand ?? this.leadHand; this._lastEnd = this.machine.now; this.strike = null; }
    return evs;
  }

  /** The classic machine's per-weapon law for WeaponTypes `t` - the ranged half, the frame count, the gun's own cadence
   *  (update(), each step; MIXED-PAIR: and a blade's swing begun beside the gun, whose shot left the machine on its clock). */
  _tuneClassic(t) {
    // THE PORT'S OWN WEAPON is RANGED but not a BOW, and the
    // difference is the whole of why it is worth saying: a bow DRAWS -
    // StrikeUp winds up, the string holds at frame 3, StrikeDown
    // looses - and a gun has a trigger. So it keeps the melee
    // one-shot (`isBow` false, its strip's seven frames instead of five through
    // `machine.frames`) and takes the RANGED half of the bow's laws -
    // the cooldown, and a shot that spends ammunition - through
    // `machine.ranged`. The skill it is scored on is Archery either
    // way; that is weaponSkillUsed's answer, not the machine's.
    const thunderlock = isGunType(t);   // PISTOL-PORT: the Thunderlock - a Pistolet never steps this machine (`_pistolsStep`, above)
    this.machine.ranged = t === WEAPON_TYPES.Bow || thunderlock;
    this.machine.frames = thunderlock ? THUNDERLOCK_NUM_FRAMES : null;
    // FIELD-GUN7: the frame clock (14fps) and the hit frame (the muzzle flash) stay the lab's.
    // BAL-ARCHERY: the reload is thunderlockReloadSeconds of live Speed, committed onto cooldownUntil
    // when the shot ends, so a Speed change mid-pump does not move the pump already running.
    this.machine.tick = thunderlock ? GUN_TICK_SECONDS : null;
    this.machine.cooldown = thunderlock ? thunderlockReloadSeconds(this.liveSpeed) : null;
    this.machine.hitFrame = thunderlock ? GUN_FEEL.hitFrame : null;
  }

  /** MW-PACE1: THE STRIKE JUST BEGUN, TIMED - when its hit lands and when it is done, at this frame's `dt`
   *  (characters/weaponStates.js blowSchedule: the machine's own tick, read off the same live Speed and the same
   *  GetMeleeWeaponAnimTime ask as update() above). Null for a ranged weapon or an idle machine. combat/weapon/weaponRig.js
   *  fpAttack hands it to the Morrowind arm, which fits its blow into it. */
  strikeSchedule(dt = 0) {
    return blowSchedule(this.machine, this.liveSpeed, this.animCtx?.() ?? null, dt);
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
    // TECH1: a technique's swing - its own reach and arc (a ring about the feet, a dash's lane, DFU's view at a longer
    // reach) for every foe that is no player's body, and its weight on the formula's number; `single` strikes the
    // nearest it reaches alone. A player's body takes the plain swing's test and number (TECH law 3: a technique never meets
    // a player).
    const tb = this.techniqueBlow;
    const techOn = (foe) => !!tb && !playerBody(foe);
    const singles = [];
    // TWO-HANDS (combat/twoHands/handsLaw.js DUAL): THE OFF HAND'S BLOW - in a pair, the hand that is not the lead strikes less
    // surely (a to-hit term by the live Agility, on the swing's own channel) and less hard (a share of the rolled damage,
    // a miss staying a miss). The lead's blow, every single weapon's and every fist's are DFU's own.
    const off = this.offStrike;   // AUDIT 2: the one predicate every arm reads (the duel's, the wild's, this)
    const offToHit = off ? offHandToHit(playerCombat ? liveStat(playerCombat, 'agility') : 50) : 0;
    const strike = (foe) => {
      const opts = playerAttackOptions(this.strikingWeapon, this.machine.state, backstabOf(foe), rolls);
      if (off) { opts.toHitMod += offToHit; Object.assign(opts, OFF_HAND_BLOW); }   // TWO-HANDS (AUDIT): the share inside the formula, ahead of every report; AUDIT 2: and the blow's weight
      if (techOn(foe) && Number.isFinite(tb.toHit)) opts.toHitMod += tb.toHit;   // the technique's own term beside the swing's
      const rolled = calculateAttackDamage(playerCombat, foe.entity, {
        ...opts, say,   // DISC10-E L2: the hand's item, never the claws marker
        unaware: foeUnaware(foe),   // SET2: the foe had not noticed me - read here, where its AI is in hand
        // C2-slice (AUDIT 23 combat-11): the PLAYER's poisoned blade
        // infects ITS victim - the formulas clear the weapon's poison
        // either way, so without this hook the dose vanished unspent.
        onInflictPoison: onPoison ? (att, tgt, pt) => onPoison(foe, pt) : null,
      });
      const blow = techOn(foe) ? scaleBlowDamage(rolled, blowMult(tb, foe)) : rolled;   // TECH1: a miss stays a miss
      if (techOn(foe)) tellTechniqueLanded(tb, foe, blow);   // MARTIAL3: a path's rider answers its signature's blow
      const damage = blow;   // TWO-HANDS (AUDIT): the off hand's share was laid inside the formula (blowShare)
      results.push({ foe, damage });
      this.onAttackResult?.({ foe, damage });   // WW1: OnAttackDamageCalculated's one consumer, the weapon widget's recoil
    };
    for (const foe of foes) {
      if (foe.dead || !foe.entity) continue;
      const sight = canSee(foe);
      const { dist, inView, losClear } = sight;
      if (!(techOn(foe) ? blowReaches(tb, foe, sight) : playerMeleeCanHit(dist, inView, losClear))) continue;
      // AUDIT TECH1: the fallback below stands in for DFU's look ray (the first collider it meets) - a technique's
      // all-round reach never widens it, so an ally or a foe at peace is struck only where a plain swing would strike it
      if (friendlyProtected(foe, protection === undefined ? {} : { protection })) { if (!techOn(foe) || playerMeleeCanHit(dist, inView, losClear)) protectedInReach.push({ foe, dist }); continue; }
      if (tb?.single && techOn(foe)) { singles.push({ foe, dist }); continue; }   // TECH1: the one blow waits for the nearest
      strike(foe);
    }
    if (singles.length) { singles.sort((a, b) => a.dist - b.dist); strike(singles[0].foe); }
    if (results.length === 0 && protectedInReach.length) {
      protectedInReach.sort((a, b) => a.dist - b.dist);
      strike(protectedInReach[0].foe);
    }
    // ARENA-FIX 9: the swing told, struck or not - a swing that reached nobody is a miss on the arena's sand (a blow
    // that reached a foe is told by the formula's own resolution)
    for (const fn of _swingListeners.values()) { try { fn(results.length); } catch { /* a listener is not the swing's problem */ } }
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
/** SET2 (Nocturnal's Shroud's Nightfall Strike, bible/11-Multiplayer/Sigil-Sets.md): has this foe NOT noticed the
 *  player - its AI's own `detected` (characters/enemy/enemyMotor.js: sight, earshot and stealth, vetoed by the illusion
 *  effects) is false. Read where the foe RECORD is in hand (the swing here, the arrow in arrowFlight.js): the formula is
 *  handed the entity, which knows nothing of its AI. A PUPPET (a foe another player's machine runs) is never unaware
 *  here - its AI is its owner's, and what this machine holds of it is not a word about whether it saw me. */
const _swingListeners = new Map();
/** ARENA-FIX 9: NAMED listeners told each melee hit frame's count of foes struck (PlayerWeapon.resolveHit - every host
 *  resolves the player's swing through it). A name re-registered replaces, `null` removes. */
export function registerPlayerSwingListener(name, fn) { if (typeof fn === 'function') _swingListeners.set(name, fn); else _swingListeners.delete(name); }

export const foeUnaware = (foe) => !!foe?.ai && !foe.puppet && foe.ai.detected === false && foe.entity?.revenant?.edge?.watchful !== true;   // RVN2: a Watchful revenant is never unaware

export function playerAttackOptions(weapon, machineState, backstabChance = 0, rolls = Math.random) {
  const swing = SWING_MODS[machineState] ?? { damage: 0, toHit: 0 };
  return { weapon, damageMod: swing.damage, toHitMod: swing.toHit, backstabChance, rolls };
}
