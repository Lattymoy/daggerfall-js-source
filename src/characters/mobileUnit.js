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
// clock). DEFERRED (FLAGGED): the Seducer transform pair.
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

export const MOBILE_RAT = 0;
export const MOBILE_SLAUGHTERFISH = 11;
export const MOBILE_GHOST = 18;
export const MOBILE_GIANT_SCORPION = 20;
export const MOBILE_WRAITH = 23;

/** GetStateAnims, verbatim branch order (the Seducer/FemaleThief
 *  branches N/A: monsters only, no transformed seducer yet).
 *  hasSpellAnimation routes the SPELL state to records 20-24; every
 *  other caster casts over the primary attack records - and note the
 *  Spell branch has NO ghost/wraith special (verbatim: they cast on
 *  PrimaryAttackAnims, not their own attack table). */
export function stateAnims(state, mobileType, hasIdle, hasSpellAnimation = false, femaleThief = false, hasRangedAttack1 = true, hasRangedAttack2 = false) {
  if (state === 'move') {
    if (mobileType === MOBILE_GHOST || mobileType === MOBILE_WRAITH) return GHOST_WRAITH_MOVE_ANIMS;
    if (mobileType === MOBILE_SLAUGHTERFISH) return SLAUGHTERFISH_MOVE_ANIMS;
    return MOVE_ANIMS;
  }
  if (state === 'attack') {
    if (mobileType === MOBILE_GHOST || mobileType === MOBILE_WRAITH) return GHOST_WRAITH_ATTACK_ANIMS;
    return PRIMARY_ATTACK_ANIMS;
  }
  if (state === 'spell') return hasSpellAnimation ? RANGED_ATTACK1_ANIMS : PRIMARY_ATTACK_ANIMS;
  if (state === 'ranged') {
    // AUDIT 26 F009 - EnemyMotor.cs:594-597: RangedAttack1 only when
    // `HasRangedAttack1 && !HasRangedAttack2`, else RangedAttack2
    // (records 25-29, DaggerfallMobileUnit.cs:837-842). Battlemage and
    // Nightblade carry both flags plus hasSpellAnimation, so their
    // 20-24 records are spell frames - the one-table state drew them
    // for bow shots.
    return (hasRangedAttack1 && !hasRangedAttack2) ? RANGED_ATTACK1_ANIMS : RANGED_ATTACK2_ANIMS;
  }
  if (state === 'hurt') return HURT_ANIMS;
  // idle (branch order verbatim: ghost/wraith, seducer N/A, the
  // female thief 483, rat, slaughterfish, !hasIdle, idle)
  if (mobileType === MOBILE_GHOST || mobileType === MOBILE_WRAITH) return GHOST_WRAITH_MOVE_ANIMS;
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
  }

  _anims() {
    const femaleThief = this.basics.femaleTexture === 483 && this.gender === 'female';
    return stateAnims(this.state, this.mobileType, this.basics.hasIdle ?? false, this.basics.hasSpellAnimation ?? false, femaleThief, this.basics.hasRangedAttack1 ?? true, this.basics.hasRangedAttack2 ?? false);
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
    if (striking && this.state !== 'attack') this._change('attack');
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
      // IsPlayingOneShot() -> NextStateAfterCurrentOneShot() (default
      // Idle). The one-shots that reach this plain-run branch are Hurt
      // and Spell (the attack states exit through the iterator above).
      if (this.state === 'hurt' || this.state === 'spell') { this._change('idle'); return; }
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
