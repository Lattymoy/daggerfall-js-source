// Classic mobile monster sprites (C11 - the monster pivot). Verbatim
// from DFU's DaggerfallMobileUnit + EnemyBasics animation tables
// (MIT, Daggerfall Workshop): 8 orientations over the fixed record
// layout - Move 0-4, PrimaryAttack 5-9, Hurt 10-14, Idle 15-19, the
// three back diagonals mirrored (FlipLeftRight) - the signed-angle
// orientation law, per-state frames-per-second, the attack frame
// SEQUENCES with the -1 damage marker, and the special tables (rat
// idle, ghost/wraith, slaughterfish). The scene owns rendering (a
// live billboard batch per foe); this module owns the state/frames.
//
// C14: the Spell anim state is LIVE (casters play over records 20-24
// when HasSpellAnimation - Orc Shaman - else the primary records,
// verbatim GetStateAnims). SpellAnimFrames only SEEDS the state: it
// is not one of AnimateEnemy's doingAttackAnimation states, so the
// run is a plain +1 walk from frames[0] to the record's frame count
// (AUDIT 18). RangedAttack1/2 are N/A
// for monsters (HasRangedAttack1 is class-enemy-only in EnemyBasics
// - the rigs' bow path owns it).
// C16: the -1 frame IS the damage moment (doMeleeDamage -> the scene's
// MeleeDamage resolution; the machine's hit frame stays the RIGS'
// clock).
//
// A5 (ROAD TO 1:1): the SEDUCER TRANSFORM PAIR, which stood flagged
// here since C16, is live. Daedra Seducer (29) is the one mobile with
// special states: SeducerTransform1 (record 23, crouch and grow wings)
// runs as a one-shot into SeducerTransform2 (record 22, stand and
// spread wings), whose end calls SetSpecialTransformationCompleted -
// and from that moment the winged form has its OWN four tables
// (records 20/21, player-facing only, no orientation) and a rewritten
// MobileEnemy: Flying behaviour, corpse 400/5, no idle, a spell
// animation of frames 0-3. The trigger is DaedraSeducerMobileBehaviour
// (8 seconds targeting the player, or the first wound), ported below.
//
// AUDIT 24 (wave 33): these two are LATCHES, not per-frame edges, and
// the names are DFU's for that reason. AnimateEnemy sets
// doMeleeDamage/shootArrow when the sequence reaches its -1 marker
// (DaggerfallMobileUnit.cs:303, :555-560) and the ONLY writer of false
// is the consumer, EnemyAttack.Update (:97-105), which is also the
// method that returns early while the entity is paralysed (:91-94). So
// a swing that reaches its damage frame during paralysis does not
// vanish - it waits, and lands the instant the paralysis clears. The
// port cleared both flags at the top of every update, which made them
// edges: a blow the player should have taken on waking was dropped.

import { rand } from '../formats/dfRandom.js';   // NT2 (F210): the gender roll is a DFRandom draw

// Speeds in frames-per-second (EnemyBasics).
export const MOVE_ANIM_SPEED = 6;
export const FLY_ANIM_SPEED = 10;   // flying enemies' move/idle clock (GetStateAnims override)
export const PRIMARY_ATTACK_ANIM_SPEED = 10;
export const HURT_ANIM_SPEED = 4;
export const IDLE_ANIM_SPEED = 4;

const A = (record, fps, flip, bounce = false) => ({ record, fps, flip, bounce });

// The standard orientation tables, verbatim (index = orientation 0..7:
// south/front, SW, W, NW, N/back, NE, E, SE).
export const MOVE_ANIMS = Object.freeze([
  A(0, MOVE_ANIM_SPEED, false), A(1, MOVE_ANIM_SPEED, false), A(2, MOVE_ANIM_SPEED, false), A(3, MOVE_ANIM_SPEED, false),
  A(4, MOVE_ANIM_SPEED, false), A(3, MOVE_ANIM_SPEED, true), A(2, MOVE_ANIM_SPEED, true), A(1, MOVE_ANIM_SPEED, true),
]);
export const PRIMARY_ATTACK_ANIMS = Object.freeze([
  A(5, PRIMARY_ATTACK_ANIM_SPEED, false), A(6, PRIMARY_ATTACK_ANIM_SPEED, false), A(7, PRIMARY_ATTACK_ANIM_SPEED, false), A(8, PRIMARY_ATTACK_ANIM_SPEED, false),
  A(9, PRIMARY_ATTACK_ANIM_SPEED, false), A(8, PRIMARY_ATTACK_ANIM_SPEED, true), A(7, PRIMARY_ATTACK_ANIM_SPEED, true), A(6, PRIMARY_ATTACK_ANIM_SPEED, true),
]);
export const HURT_ANIMS = Object.freeze([
  A(10, HURT_ANIM_SPEED, false), A(11, HURT_ANIM_SPEED, false), A(12, HURT_ANIM_SPEED, false), A(13, HURT_ANIM_SPEED, false),
  A(14, HURT_ANIM_SPEED, false), A(13, HURT_ANIM_SPEED, true), A(12, HURT_ANIM_SPEED, true), A(11, HURT_ANIM_SPEED, true),
]);
export const IDLE_ANIMS = Object.freeze([
  A(15, IDLE_ANIM_SPEED, false), A(16, IDLE_ANIM_SPEED, false), A(17, IDLE_ANIM_SPEED, false), A(18, IDLE_ANIM_SPEED, false),
  A(19, IDLE_ANIM_SPEED, false), A(18, IDLE_ANIM_SPEED, true), A(17, IDLE_ANIM_SPEED, true), A(16, IDLE_ANIM_SPEED, true),
]);
// Rat idle: the flips INVERT vs the standard idle (verbatim quirk).
export const RAT_IDLE_ANIMS = Object.freeze([
  A(15, IDLE_ANIM_SPEED, false), A(16, IDLE_ANIM_SPEED, true), A(17, IDLE_ANIM_SPEED, true), A(18, IDLE_ANIM_SPEED, true),
  A(19, IDLE_ANIM_SPEED, false), A(18, IDLE_ANIM_SPEED, false), A(17, IDLE_ANIM_SPEED, false), A(16, IDLE_ANIM_SPEED, false),
]);
// Ghost/wraith move (doubles as their idle) + attack: their own flip
// patterns, verbatim.
export const GHOST_WRAITH_MOVE_ANIMS = Object.freeze([
  A(0, MOVE_ANIM_SPEED, false), A(1, MOVE_ANIM_SPEED, false), A(2, MOVE_ANIM_SPEED, true), A(3, MOVE_ANIM_SPEED, false),
  A(4, MOVE_ANIM_SPEED, false), A(3, MOVE_ANIM_SPEED, true), A(2, MOVE_ANIM_SPEED, false), A(1, MOVE_ANIM_SPEED, true),
]);
export const GHOST_WRAITH_ATTACK_ANIMS = Object.freeze([
  A(5, PRIMARY_ATTACK_ANIM_SPEED, false), A(6, PRIMARY_ATTACK_ANIM_SPEED, false), A(7, PRIMARY_ATTACK_ANIM_SPEED, true), A(8, PRIMARY_ATTACK_ANIM_SPEED, false),
  A(9, PRIMARY_ATTACK_ANIM_SPEED, false), A(8, PRIMARY_ATTACK_ANIM_SPEED, true), A(7, PRIMARY_ATTACK_ANIM_SPEED, false), A(6, PRIMARY_ATTACK_ANIM_SPEED, true),
]);
// Slaughterfish move (also its idle): records 0-4 with BounceAnim.
export const SLAUGHTERFISH_MOVE_ANIMS = Object.freeze([
  A(0, MOVE_ANIM_SPEED, false, true), A(1, MOVE_ANIM_SPEED, false, true), A(2, MOVE_ANIM_SPEED, false, true), A(3, MOVE_ANIM_SPEED, false, true),
  A(4, MOVE_ANIM_SPEED, false, true), A(3, MOVE_ANIM_SPEED, true, true), A(2, MOVE_ANIM_SPEED, true, true), A(1, MOVE_ANIM_SPEED, true, true),
]);
// C14: RangedAttack1Anims (records 20-24, 10 fps) - for MONSTERS this
// is the SPELL table when HasSpellAnimation (Orc Shaman 21 only);
// actual ranged attacks belong to class enemies (rigs), N/A here.
export const RANGED_ATTACK1_ANIM_SPEED = 10;
export const RANGED_ATTACK1_ANIMS = Object.freeze([
  A(20, RANGED_ATTACK1_ANIM_SPEED, false), A(21, RANGED_ATTACK1_ANIM_SPEED, false), A(22, RANGED_ATTACK1_ANIM_SPEED, false), A(23, RANGED_ATTACK1_ANIM_SPEED, false),
  A(24, RANGED_ATTACK1_ANIM_SPEED, false), A(23, RANGED_ATTACK1_ANIM_SPEED, true), A(22, RANGED_ATTACK1_ANIM_SPEED, true), A(21, RANGED_ATTACK1_ANIM_SPEED, true),
]);

// AUDIT 26 F009: RangedAttack2Anims (EnemyBasics.cs:103-113 - records
// 25-29, RangedAttack2AnimSpeed 10, "475, 489, 490 humanoid mobiles
// only"). Battlemage (130) and Nightblade (133) carry
// hasRangedAttack2 AND hasSpellAnimation, so for them records 20-24
// are the SPELL-cast frames - a Battlemage shooting its bow off the
// one-table 'ranged' state played its spell-casting sprite.
export const RANGED_ATTACK2_ANIM_SPEED = 10;
export const RANGED_ATTACK2_ANIMS = Object.freeze([
  A(25, RANGED_ATTACK2_ANIM_SPEED, false), A(26, RANGED_ATTACK2_ANIM_SPEED, false), A(27, RANGED_ATTACK2_ANIM_SPEED, false), A(28, RANGED_ATTACK2_ANIM_SPEED, false),
  A(29, RANGED_ATTACK2_ANIM_SPEED, false), A(28, RANGED_ATTACK2_ANIM_SPEED, true), A(27, RANGED_ATTACK2_ANIM_SPEED, true), A(26, RANGED_ATTACK2_ANIM_SPEED, true),
]);

// C17: the female-thief idle (FemaleTexture 483) - record 11 rides
// the front diagonals, verbatim quirk.
export const FEMALE_THIEF_IDLE_ANIMS = Object.freeze([
  A(15, IDLE_ANIM_SPEED, false), A(11, IDLE_ANIM_SPEED, false), A(17, IDLE_ANIM_SPEED, false), A(18, IDLE_ANIM_SPEED, false),
  A(19, IDLE_ANIM_SPEED, false), A(18, IDLE_ANIM_SPEED, true), A(17, IDLE_ANIM_SPEED, true), A(11, IDLE_ANIM_SPEED, true),
]);

// A5: the Seducer's four special tables (EnemyBasics.cs:167-212).
// Every one is EIGHT COPIES OF ONE ROW - the source's own comment says
// "has player-facing orientation only", so the orientation index picks
// the same record and the same (false) flip whichever way the foe
// stands. All four run at MoveAnimSpeed, the transforms included.
const SEDUCER_ROW = (record) => Object.freeze(new Array(8).fill(null).map(() => A(record, MOVE_ANIM_SPEED, false)));
export const SEDUCER_TRANSFORM1_ANIMS = SEDUCER_ROW(23);   // crouch and grow wings
export const SEDUCER_TRANSFORM2_ANIMS = SEDUCER_ROW(22);   // stand and spread wings
export const SEDUCER_IDLE_MOVE_ANIMS = SEDUCER_ROW(21);    // the winged form's move, idle AND hurt
export const SEDUCER_ATTACK_ANIMS = SEDUCER_ROW(20);       // the winged form's attack AND spell

export const MOBILE_RAT = 0;
export const MOBILE_SLAUGHTERFISH = 11;
export const MOBILE_GHOST = 18;
export const MOBILE_GIANT_SCORPION = 20;
export const MOBILE_WRAITH = 23;
export const MOBILE_DAEDRA_SEDUCER = 29;

/** GetStateAnims, verbatim branch order (DaggerfallMobileUnit.cs:
 *  787-858). hasSpellAnimation routes the SPELL state to records 20-24;
 *  every other caster casts over the primary attack records - and note
 *  the Spell branch has NO ghost/wraith special (verbatim: they cast on
 *  PrimaryAttackAnims, not their own attack table).
 *
 *  A5: the Seducer branches are live. A DaedraSeducer with
 *  `specialTransformationCompleted` reads its winged tables in FIVE
 *  states - Move, PrimaryAttack, Hurt, Idle and Spell - each at the
 *  exact place C# puts it: SECOND in Move/PrimaryAttack/Idle (after
 *  the ghost/wraith arm, BEFORE the slaughterfish, the female thief
 *  and the rat), FIRST in Hurt and FIRST in Spell (ahead of the
 *  HasSpellAnimation ternary). The two transform states answer null
 *  when the mobile does not carry the flag, which is DFU's
 *  LogMobileError path - the caller falls back to Idle. */
export function stateAnims(state, mobileType, hasIdle, hasSpellAnimation = false, femaleThief = false, hasRangedAttack1 = true, hasRangedAttack2 = false, seducerTransformed = false, hasSeducerTransform1 = false, hasSeducerTransform2 = false) {
  const wingedSeducer = mobileType === MOBILE_DAEDRA_SEDUCER && seducerTransformed;
  if (state === 'transform1') return hasSeducerTransform1 ? SEDUCER_TRANSFORM1_ANIMS : null;
  if (state === 'transform2') return hasSeducerTransform2 ? SEDUCER_TRANSFORM2_ANIMS : null;
  if (state === 'move') {
    if (mobileType === MOBILE_GHOST || mobileType === MOBILE_WRAITH) return GHOST_WRAITH_MOVE_ANIMS;
    if (wingedSeducer) return SEDUCER_IDLE_MOVE_ANIMS;
    if (mobileType === MOBILE_SLAUGHTERFISH) return SLAUGHTERFISH_MOVE_ANIMS;
    return MOVE_ANIMS;
  }
  if (state === 'attack') {
    if (mobileType === MOBILE_GHOST || mobileType === MOBILE_WRAITH) return GHOST_WRAITH_ATTACK_ANIMS;
    if (wingedSeducer) return SEDUCER_ATTACK_ANIMS;
    return PRIMARY_ATTACK_ANIMS;
  }
  if (state === 'spell') {
    if (wingedSeducer) return SEDUCER_ATTACK_ANIMS;   // :845 - ahead of the HasSpellAnimation ternary
    return hasSpellAnimation ? RANGED_ATTACK1_ANIMS : PRIMARY_ATTACK_ANIMS;
  }
  if (state === 'ranged') {
    // AUDIT 26 F009 - EnemyMotor.cs:594-597: RangedAttack1 only when
    // `HasRangedAttack1 && !HasRangedAttack2`, else RangedAttack2
    // (records 25-29, DaggerfallMobileUnit.cs:837-842). Battlemage and
    // Nightblade carry both flags plus hasSpellAnimation, so their
    // 20-24 records are spell frames - the one-table state drew them
    // for bow shots.
    return (hasRangedAttack1 && !hasRangedAttack2) ? RANGED_ATTACK1_ANIMS : RANGED_ATTACK2_ANIMS;
  }
  if (state === 'hurt') {
    if (wingedSeducer) return SEDUCER_IDLE_MOVE_ANIMS;   // :813-816 - the winged form has no hurt table of its own
    return HURT_ANIMS;
  }
  // idle (branch order verbatim: ghost/wraith, the winged seducer, the
  // female thief 483, rat, slaughterfish, !hasIdle, idle)
  if (mobileType === MOBILE_GHOST || mobileType === MOBILE_WRAITH) return GHOST_WRAITH_MOVE_ANIMS;
  if (wingedSeducer) return SEDUCER_IDLE_MOVE_ANIMS;
  if (femaleThief) return FEMALE_THIEF_IDLE_ANIMS;
  if (mobileType === MOBILE_RAT) return RAT_IDLE_ANIMS;
  if (mobileType === MOBILE_SLAUGHTERFISH) return SLAUGHTERFISH_MOVE_ANIMS;
  if (!hasIdle) return MOVE_ANIMS;
  return IDLE_ANIMS;
}

/** UpdateOrientation, verbatim: the signed angle between the
 *  enemy-to-camera direction and the enemy facing, orientation =
 *  -round(angle / 45) wrapped 0..7. Facing convention matches the
 *  player motor: forward = (sin yaw, 0, cos yaw). */
export function mobileOrientation(yaw, feet, cameraPos) {
  const dx = cameraPos[0] - feet[0], dz = cameraPos[2] - feet[2];
  const l = Math.hypot(dx, dz) || 1;
  const dirX = dx / l, dirZ = dz / l;
  const fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw);
  const dot = Math.max(-1, Math.min(1, dirX * fwdX + dirZ * fwdZ));
  let angle = (Math.acos(dot) * 180) / Math.PI;
  const crossY = dirZ * fwdX - dirX * fwdZ;
  angle *= -Math.sign(crossY) || 1;
  const orientation = -Math.round(angle / 45);
  return ((orientation % 8) + 8) % 8;
}

/** ApplyEnemyState's PrimaryAttack variant roll, verbatim: one
 *  Dice100 roll walks the chance ladder 2..5, remainder = frames 1. */
export function rollAttackFrames(basics, roll100) {
  let r = roll100;
  if (r <= (basics.chanceForAttack2 ?? 0) && basics.primaryAttackAnimFrames2) return basics.primaryAttackAnimFrames2;
  r -= basics.chanceForAttack2 ?? 0;
  if (r <= (basics.chanceForAttack3 ?? 0) && basics.primaryAttackAnimFrames3) return basics.primaryAttackAnimFrames3;
  r -= basics.chanceForAttack3 ?? 0;
  if (r <= (basics.chanceForAttack4 ?? 0) && basics.primaryAttackAnimFrames4) return basics.primaryAttackAnimFrames4;
  r -= basics.chanceForAttack4 ?? 0;
  if (r <= (basics.chanceForAttack5 ?? 0) && basics.primaryAttackAnimFrames5) return basics.primaryAttackAnimFrames5;
  return basics.primaryAttackAnimFrames ?? [0, 1, 2, 3, 4];
}

/**
 * One monster's animation unit. The scene feeds intent each frame
 * ({moving, striking, hurting}) plus the camera; the unit owns state
 * transitions (hurt > attack one-shots > move/idle), the fps clock,
 * and the frame/record/flip output.
 * @param frameCount (record) => frames in that record (texture data)
 */
export class MobileUnit {
  /** NT2 (F210) - GetTextureArchive's gender arm
   *  (DaggerfallMobileUnit.cs:621-630): a HUMAN enemy with unspecified
   *  gender rolls `DFRandom.random_range(0, 2)` - ONE draw off the
   *  shared classic LCG, == 0 male - and a monster stays unspecified,
   *  which reads as the male texture. The ENGINE-PRNG rule (Ledger A)
   *  says a DFRandom draw does NOT ride an injectable roll, so this
   *  reads the stream directly. Before this the hosts rolled
   *  Math.random at their spawn arms - and the dungeon LAYOUT path
   *  never rolled at all, so every random human class enemy stood male.
   */
  static resolveGender(gender, basics) {
    if (gender && gender !== 'unspecified') return gender;
    if (basics?.affinity === 'Human') return rand() % 2 === 0 ? 'male' : 'female';
    return 'unspecified';
  }

  constructor(mobileType, basics, frameCount, rolls = Math.random, gender = 'male') {
    this.mobileType = mobileType;
    this.basics = basics;
    this.gender = gender;   // C17: the female-thief idle route + host archives
    this.frameCount = frameCount;
    this.rolls = rolls;
    this.state = 'idle';
    this.orientation = 0;
    this.frame = 0;
    this._timer = 0;
    this._reversed = false;
    this._attackFrames = null;
    this._iter = 0;
    this.doMeleeDamage = false;   // LATCHED on the -1 marker; the consumer clears it (C16)
    this.shootArrow = false;      // C17: the ranged -1
    /** A5 - MobileUnit.SpecialTransformationCompleted (Base/MobileUnit
     *  .cs:50, DaggerfallMobileUnit.cs:121-124). Raised by
     *  setSpecialTransformationCompleted at the END of the second
     *  Seducer transform state, and by a save restore that finds the
     *  flag already raised ("Called when restoring save game if unit
     *  has raised transformation completed flag", :203-206). */
    this.specialTransformationCompleted = false;
    this._basicsOwned = false;
  }

  /** DFU's `summary.Enemy` is a STRUCT - a per-mobile COPY made at
   *  setup, which is why SetSpecialTransformationCompleted can write
   *  Behaviour/CorpseTexture/HasIdle straight onto it without touching
   *  the static EnemyBasics row (`MobileEnemy enemy = Enemy; ...;
   *  Enemy = enemy;`, :212-219). The port's rows are shared and frozen,
   *  so the copy is made the first time anything writes - lazily, so a
   *  caller holding `mobile.basics === ENEMY_BASICS[id]` keeps that
   *  identity until the mobile really does diverge. */
  _ownBasics() {
    if (!this._basicsOwned) { this.basics = { ...this.basics }; this._basicsOwned = true; }
    return this.basics;
  }

  /**
   * MobileUnit.SetSpecialTransformationCompleted (Base/MobileUnit.cs:
   * 208-224), verbatim: for the Daedra Seducer the winged form gets a
   * REWRITTEN MobileEnemy - Flying behaviour (which EnemyMotor.CanFly
   * reads live, :837-845 "This can change in the case of a transformed
   * Seducer"), the winged corpse 400/5 where the unwinged row carries
   * 400/6, no idle table, and a spell animation of frames 0-3. Then the
   * flag itself, which is raised for EVERY mobile type - the switch
   * only decides what else changes.
   */
  setSpecialTransformationCompleted() {
    if (this.mobileType === MOBILE_DAEDRA_SEDUCER) {
      const e = this._ownBasics();
      e.behaviour = 'Flying';
      e.corpseTexture = { archive: 400, record: 5 };
      e.hasIdle = false;
      e.hasSpellAnimation = true;
      e.spellAnimFrames = [0, 1, 2, 3];
    }
    this.specialTransformationCompleted = true;
  }

  /** MobileUnit.IsPlayingOneShot (Base/MobileUnit.cs:153-168) - Hurt,
   *  PrimaryAttack, the two RangedAttacks, Spell and the two Seducer
   *  transforms. */
  isPlayingOneShot() {
    return this.state === 'hurt' || this.state === 'attack' || this.state === 'ranged'
      || this.state === 'spell' || this.state === 'transform1' || this.state === 'transform2';
  }

  /** MobileUnit.OneShotPauseActionsWhilePlaying (:174-184) - the two
   *  transform states ALONE: "Seducer should not move and attack while
   *  transforming". Consumed by EnemyMotor.TakeAction (:465-466) and
   *  EnemyAttack.FixedUpdate (:60-61). */
  oneShotPauseActionsWhilePlaying() {
    return this.state === 'transform1' || this.state === 'transform2';
  }

  /** MobileUnit.IsAttacking (:190-201) - the three attack states. */
  isAttacking() {
    return this.state === 'attack' || this.state === 'ranged';
  }

  /** DaedraSeducerMobileBehaviour.StartTransformation (:87-92) -
   *  ChangeEnemyState(SeducerTransform1). Public because the trigger
   *  below re-raises it every frame until it takes. */
  startTransformation() {
    this._change('transform1');
  }

  /** AnimateEnemy's NextStateAfterCurrentOneShot (:594-610): the two
   *  transform states chain (1 -> 2 -> completed -> idle); everything
   *  else falls back to Idle. */
  _nextStateAfterOneShot() {
    if (this.state === 'transform1') return 'transform2';
    if (this.state === 'transform2') { this.setSpecialTransformationCompleted(); return 'idle'; }
    return 'idle';
  }

  _anims() {
    const femaleThief = this.basics.femaleTexture === 483 && this.gender === 'female';
    return stateAnims(this.state, this.mobileType, this.basics.hasIdle ?? false, this.basics.hasSpellAnimation ?? false, femaleThief, this.basics.hasRangedAttack1 ?? true, this.basics.hasRangedAttack2 ?? false,
      this.specialTransformationCompleted, this.basics.hasSeducerTransform1 ?? false, this.basics.hasSeducerTransform2 ?? false);
  }

  _change(state) {
    // ApplyEnemyStateChange: idle<->move keeps the frame for enemies
    // without idle anims (their idle IS the move loop).
    const pair = (a, b) => (this.state === a && state === b) || (this.state === b && state === a);
    const keepFrame = !(this.basics.hasIdle ?? false) && pair('idle', 'move');
    this.state = state;
    if (!keepFrame) { this.frame = 0; this._reversed = false; }
    if (state === 'attack') {
      this._attackFrames = rollAttackFrames(this.basics, Math.floor(this.rolls() * 100) + 1);
      this.frame = this._attackFrames[0];
      this._iter = 1;
      // ApplyEnemyState's up-front check: one of the Frost Daedra's
      // attack variants STARTS with the hit frame (-1) - flag damage
      // now and advance to the next frame (audit 08-17).
      if (this.frame === -1) {
        this.doMeleeDamage = true;
        this.frame = this._iter < this._attackFrames.length ? this._attackFrames[this._iter++] : 0;
      }
    }
    // C14: ApplyEnemyState's Spell branch SEEDS from SpellAnimFrames
    // (currentFrame = frames[0]; frameIterator = 1) - but AnimateEnemy's
    // doingAttackAnimation is PrimaryAttack/RangedAttack1/RangedAttack2
    // ONLY (DaggerfallMobileUnit.cs:536-538), so that iterator is never
    // consumed for Spell: the state steps as a PLAIN frame run from the
    // seed until currentFrame >= NumFrames, then exits as a one-shot
    // (AUDIT 18).
    if (state === 'spell') {
      this._attackFrames = this.basics.spellAnimFrames ?? [0];
      this.frame = Math.max(0, this._attackFrames[0]);
      this._iter = 1;
      this._reversed = false;
    }
    // C17: the RangedAttack1 one-shot (ApplyEnemyState's ranged
    // branch) - the -1 marker is the shootArrow moment.
    if (state === 'ranged') {
      this._attackFrames = this.basics.rangedAttackAnimFrames ?? [0];
      this.frame = Math.max(0, this._attackFrames[0]);
      this._iter = 1;
    }
    // A5: ApplyEnemyState's two Seducer arms (DaggerfallMobileUnit.cs:
    // 268-288). Each SWITCHES THE SPRITE ALIGNMENT before seeding -
    // transform1 goes Flying "while crouched and growing wings",
    // transform2 back to General "while standing and spreading wings" -
    // and then seeds StateAnimFrames from the row's own sequence,
    // exactly as the Spell arm above does. Neither is a
    // doingAttackAnimation state, so the iterator is never consumed and
    // the run is a plain +1 walk that exits through the one-shot chain.
    if (state === 'transform1' || state === 'transform2') {
      this._ownBasics().behaviour = state === 'transform1' ? 'Flying' : 'General';
      this._attackFrames = (state === 'transform1'
        ? this.basics.seducerTransform1Frames : this.basics.seducerTransform2Frames) ?? [0];
      this.frame = Math.max(0, this._attackFrames[0]);
      this._iter = 1;
      this._reversed = false;
    }
    // ApplyEnemyState's null-table guard (:290-298): "Enemy does not
    // have animation for {state} state. Defaulting to Idle state." A
    // mobile asked for a transform it does not carry lands in Idle.
    if (this._anims() == null) {
      this.state = 'idle';
      this.frame = 0;
      this._reversed = false;
    }
  }

  /**
   * The scene's per-frame drive. Returns {record, frame, flip}.
   * `striking` is an EDGE - true on the update where the attack
   * STARTS (EnemyAttack.MeleeAnimation fires ChangeEnemyState ONCE);
   * a level signal would replay the sequence inside one swing.
   */
  update(dt, { moving = false, striking = false, hurting = false, casting = false, rangedStriking = false } = {}, yaw, feet, cameraPos) {
    // NO RESET HERE (wave 33). DoMeleeDamage/ShootArrow are latches that
    // only EnemyAttack.Update clears, after it has used them.
    // The DFU priority (audit 08-17): the attack edge overrides ANY
    // state - hurt included (ChangeEnemyState is unconditional at
    // MeleeAnimation); knockback-hurt never interrupts PrimaryAttack
    // (EnemyMotor gates on state != PrimaryAttack ONLY - so hurt CAN
    // interrupt a Spell mid-cast, verbatim). C14: casting is an edge
    // like striking (the cast decision fires ChangeEnemyState once).
    //
    // A5, CORRECTED AT ROAD-U: ...unless a one-shot that PAUSES
    // ACTIONS is playing. This block is the ANIM half alone - it holds
    // the sequence against a strike, cast or hurt INTENT while the
    // clock below keeps stepping it. The other two halves are spent
    // where DFU spends them, and the comment that used to stand here
    // claimed all three fed this one block, which was false: the
    // ACTOR went on acting. EnemyMotor.TakeAction returns at :464-466
    // (enemyMotor.js's `paused`, which also carries
    // KnockbackMovement's :267-269 return - no shove, no decay, no
    // CanAct write) and EnemyAttack.FixedUpdate returns at :59-61
    // (enemyAttack.js's `paused` - no melee timer, no DFRandom draw,
    // no MeleeAnimation). Both read this predicate off the mobile, in
    // the two pools that can hold a Seducer (scenes/dungeonContext.js
    // and scenes/exteriorFoes.js; the city watch is Knight_CityWatch
    // and can never enter a transform state).
    if (this.isPlayingOneShot() && this.oneShotPauseActionsWhilePlaying()) {
      // no intent this frame
    } else if (striking && this.state !== 'attack') this._change('attack');
    else if (rangedStriking && this.state !== 'ranged' && this.state !== 'attack') this._change('ranged');
    else if (casting && this.state !== 'spell' && this.state !== 'attack') this._change('spell');
    else if (hurting && this.state !== 'hurt' && this.state !== 'attack') this._change('hurt');
    else if (this.state === 'idle' || this.state === 'move') {
      const want = moving ? 'move' : 'idle';
      if (want !== this.state) this._change(want);
    }

    // Orientation (per frame, verbatim). A switch rescales the frame
    // proportionally to the new record's count - UpdateOrientation's
    // Ancient Lich note (archive 288: back diagonals have 8 frames
    // where the rest have 4; carrying frame 5 into a 4-frame record
    // would overflow).
    const anims = this._anims();
    const o = mobileOrientation(yaw, feet, cameraPos);
    if (o !== this.orientation) {
      const oldN = this.frameCount(anims[this.orientation].record);
      const n = this.frameCount(anims[o].record);
      if (oldN > 0) this.frame = Math.floor((this.frame * n) / oldN);
      this.orientation = o;
    }

    // The fps clock: step one frame per 1/fps (AnimateEnemy). Flying
    // enemies move/idle at FlyAnimSpeed 10 (GetStateAnims' tail
    // override; audit 08-17) - the table stays frozen, the clock
    // overrides.
    const a = anims[this.orientation];
    let fps = (this.basics.behaviour === 'Flying' && (this.state === 'move' || this.state === 'idle'))
      ? FLY_ANIM_SPEED : a.fps;
    // AUDIT 23 (characters-11) - DaggerfallMobileUnit.cs:530-534: the
    // anim clock divides by FrameSpeedDivisor (EnemyAttack.cs:70-77
    // mints PermanentSpeed / max(8, LiveSpeed), so a Drain-Speed foe
    // animates slower), floored at 4 fps when a custom divisor bites.
    const div = this.frameSpeedDivisor ?? 1;
    if (div > 1) { fps = fps / div; if (fps < 4) fps = 4; }
    this._timer += dt;
    const stepEvery = 1 / fps;
    while (this._timer >= stepEvery) {
      this._timer -= stepEvery;
      this._stepFrame(a);
    }
    // OrientEnemy: scorpion animations are inverted (verbatim quirk).
    const flip = this.mobileType === MOBILE_GIANT_SCORPION ? !a.flip : a.flip;
    return { record: a.record, frame: this.frame, flip };
  }

  _stepFrame(a) {
    const n = Math.max(1, this.frameCount(a.record));
    // doingAttackAnimation (AnimateEnemy): PrimaryAttack and the two
    // RangedAttack states only - Spell is deliberately NOT in it.
    if (this.state === 'attack' || this.state === 'ranged') {
      if (this._iter >= this._attackFrames.length) { this._change('idle'); return; }
      let f = this._attackFrames[this._iter++];
      if (f === -1) {
        if (this.state === 'ranged') this.shootArrow = true;   // AnimateEnemy
        else this.doMeleeDamage = true;   // C16: the scene resolves on it, then clears it
        if (this._iter < this._attackFrames.length) f = this._attackFrames[this._iter++];
        else { this._change('idle'); return; }
      }
      this.frame = Math.min(f, n - 1);
      return;
    }
    this.frame = this._reversed ? this.frame - 1 : this.frame + 1;
    if (this.frame >= n || (this._reversed && this.frame <= 0)) {
      // IsPlayingOneShot() -> NextStateAfterCurrentOneShot(). The
      // one-shots that reach this plain-run branch are Hurt, Spell and
      // (A5) the two Seducer transforms - the attack states exit
      // through the iterator above. The chain is the source's:
      // transform1 -> transform2 -> SetSpecialTransformationCompleted
      // -> idle, everything else straight to idle.
      if (this.state === 'hurt' || this.state === 'spell'
        || this.state === 'transform1' || this.state === 'transform2') {
        this._change(this._nextStateAfterOneShot());
        return;
      }
      if (a.bounce && !this._reversed) {
        this.frame = Math.max(0, n - 2);
        this._reversed = true;
      } else {
        this.frame = 0;
        this._reversed = false;
      }
    }
  }
}

/** DaedraSeducerMobileBehaviour.secondsToTransform (:23) - the source's
 *  own note: "0.0 will disable transform completely". */
export const SECONDS_TO_TRANSFORM = 8.0;

/**
 * A5 - DaedraSeducerMobileBehaviour (Internal/DaedraSeducerMobile-
 * Behaviour.cs), verbatim. DFU hangs this component on the seducer's
 * mobile at setup (SetupDemoEnemy.cs:191-195, gated on the mobile ID)
 * and its Update is the whole trigger:
 *
 *   1. once the transformation is COMPLETE, raise SuppressInfighting
 *      and do nothing else forever - "A transformed Seducer is excluded
 *      from infighting due to sprite limitations (has player facing
 *      sprites only)". Raised on every frame rather than once, which is
 *      how a save restored past the transform gets the flag back;
 *   2. once the transformation has STARTED, keep re-raising
 *      SeducerTransform1 on any frame that is in some other state -
 *      "This prevents some other state (e.g. hurt) breaking switch to
 *      transformation";
 *   3. otherwise, while the seducer is TARGETING THE PLAYER and the
 *      countdown still has time on it, spend the countdown and
 *      transform the moment it is hurt or the eight seconds run out.
 *      The player-target gate is there so the player is close enough to
 *      witness it; the countdown so a winged form can reach a player
 *      the humanoid form cannot (the source names Direnni Tower).
 *
 * `targetIsPlayer` is the port's spelling of `enemySenses.Target ==
 * GameManager.Instance.PlayerEntityBehaviour` - the host reads its own
 * candidate machine and answers.
 */
export class SeducerTransformBehaviour {
  constructor(mobile, entity) {
    this.mobile = mobile;
    this.entity = entity;
    this.transformCountdown = SECONDS_TO_TRANSFORM;
    this.transformStarted = false;
  }

  /** DFU's StartTransformation (:87-92): zero the countdown, raise the
   *  first state, and latch `transformStarted` so arm 2 keeps trying. */
  startTransformation() {
    this.transformCountdown = 0;
    this.mobile.startTransformation();
    this.transformStarted = true;
  }

  update(dt, targetIsPlayer = false) {
    const m = this.mobile;
    if (!m || !this.entity) return;   // the :48-49 reference guard
    if (m.specialTransformationCompleted) {
      this.entity.suppressInfighting = true;
      return;
    }
    if (this.transformStarted && m.state !== 'transform1' && m.state !== 'transform2') {
      this.startTransformation();
      return;
    }
    if (targetIsPlayer && this.transformCountdown > 0) {
      // "Check if if hurt" (:74-75) - CurrentHealth < MaxHealth, any
      // wound at all, not a threshold.
      const isHurt = (this.entity.health ?? 0) < (this.entity.maxHealth ?? 0);
      this.transformCountdown -= dt;   // spent BEFORE the test, as C# spends it
      if (isHurt || this.transformCountdown <= 0) this.startTransformation();
    }
  }
}
