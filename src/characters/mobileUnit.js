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
// DEFERRED (FLAGGED): RangedAttack1/2 + Spell anim states (monster
// casters cast - S16 - without the cast anim yet), the Seducer
// transform pair, the -1 frame as the DAMAGE moment (damage rides
// the shared EnemyAttack machine, one law for all foes - the
// per-frame timing is a recorded refinement).

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

export const MOBILE_RAT = 0;
export const MOBILE_SLAUGHTERFISH = 11;
export const MOBILE_GHOST = 18;
export const MOBILE_GIANT_SCORPION = 20;
export const MOBILE_WRAITH = 23;

/** GetStateAnims, verbatim branch order (the Seducer/FemaleThief
 *  branches N/A: monsters only, no transformed seducer yet). */
export function stateAnims(state, mobileType, hasIdle) {
  if (state === 'move') {
    if (mobileType === MOBILE_GHOST || mobileType === MOBILE_WRAITH) return GHOST_WRAITH_MOVE_ANIMS;
    if (mobileType === MOBILE_SLAUGHTERFISH) return SLAUGHTERFISH_MOVE_ANIMS;
    return MOVE_ANIMS;
  }
  if (state === 'attack') {
    if (mobileType === MOBILE_GHOST || mobileType === MOBILE_WRAITH) return GHOST_WRAITH_ATTACK_ANIMS;
    return PRIMARY_ATTACK_ANIMS;
  }
  if (state === 'hurt') return HURT_ANIMS;
  // idle
  if (mobileType === MOBILE_GHOST || mobileType === MOBILE_WRAITH) return GHOST_WRAITH_MOVE_ANIMS;
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
  constructor(mobileType, basics, frameCount, rolls = Math.random) {
    this.mobileType = mobileType;
    this.basics = basics;
    this.frameCount = frameCount;
    this.rolls = rolls;
    this.state = 'idle';
    this.orientation = 0;
    this.frame = 0;
    this._timer = 0;
    this._reversed = false;
    this._attackFrames = null;
    this._iter = 0;
    this.hitFrame = false;   // set on the -1 marker (unconsumed - the timing refinement pends)
  }

  _anims() { return stateAnims(this.state, this.mobileType, this.basics.hasIdle ?? false); }

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
        this.hitFrame = true;
        this.frame = this._iter < this._attackFrames.length ? this._attackFrames[this._iter++] : 0;
      }
    }
  }

  /**
   * The scene's per-frame drive. Returns {record, frame, flip}.
   * `striking` is an EDGE - true on the update where the attack
   * STARTS (EnemyAttack.MeleeAnimation fires ChangeEnemyState ONCE);
   * a level signal would replay the sequence inside one swing.
   */
  update(dt, { moving = false, striking = false, hurting = false } = {}, yaw, feet, cameraPos) {
    this.hitFrame = false;
    // The DFU priority (audit 08-17): the attack edge overrides ANY
    // state - hurt included (ChangeEnemyState is unconditional at
    // MeleeAnimation); knockback-hurt never interrupts PrimaryAttack
    // (EnemyMotor gates on state != PrimaryAttack).
    if (striking && this.state !== 'attack') this._change('attack');
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
    const fps = (this.basics.behaviour === 'Flying' && (this.state === 'move' || this.state === 'idle'))
      ? FLY_ANIM_SPEED : a.fps;
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
    if (this.state === 'attack') {
      if (this._iter >= this._attackFrames.length) { this._change('idle'); return; }
      let f = this._attackFrames[this._iter++];
      if (f === -1) {
        this.hitFrame = true;   // the damage marker (presentation-only for now)
        if (this._iter < this._attackFrames.length) f = this._attackFrames[this._iter++];
        else { this._change('idle'); return; }
      }
      this.frame = Math.min(f, n - 1);
      return;
    }
    this.frame = this._reversed ? this.frame - 1 : this.frame + 1;
    if (this.frame >= n || (this._reversed && this.frame <= 0)) {
      if (this.state === 'hurt') { this._change('idle'); return; }   // one-shot -> Idle (NextStateAfterCurrentOneShot default)
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
