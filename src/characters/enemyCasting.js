// Enemy spellcasting AI (S16, audit F15). Verbatim port of the DFU
// classic-AI shape (MIT, Daggerfall Workshop): EnemyMotor's
// DoRangedAttack spell branch (the 6..51.2m band, sight + 22.5deg
// yaw, Random.value < 1/40 per classic update, bow foes take the bow
// branch instead) and DoTouchSpell (melee range + the SHARED melee
// timer, which a touch cast resets), CanCastRangedSpell /
// CanCastTouchSpell selection (magicka > 0, a uniform pick over the
// range class - classic AI counts ByTouch AND CasterOnly as touch -
// then the EffectsAlreadyOnTarget veto), and the
// EntityEffectManager.Update rule "enemies always cast ready spell
// instantly once queued" - the decision IS the cast; the scene owns
// the spend + release. AUDIT 18: both branches also require
// DetectedTarget (EnemyMotor.cs:573 and :620), and both live inside
// TakeAction, which HandleNoAction (:359-365) skips once GiveUpTimer
// hits 0 - so a concealed target stops the casting entirely. The
// melee reach is a FLAT MeleeDistance: DFU's
// `+ senses.TargetRateOfApproach` term is only ever non-zero under
// EnhancedCombatAI (EnemySenses.cs:354-363). DFU's clear-path probe
// (HasClearPathToShootProjectile) rides the senses' LOS here (inSight
// gates every decision); the Enhanced Combat AI branches are off, as
// everywhere in this port.

import { CLASSIC_UPDATE_INTERVAL } from './weaponStates.js';
import { MELEE_DISTANCE, withinYaw } from './enemyMotor.js';
import { resetMeleeTimer } from './enemyAttack.js';
import { effectsAlreadyOnTarget } from '../systems/effects.js';
// SetReadySpell's silence refusal (EntityEffectManager.cs:314-316):
// `if ((!noSpellPointCost && SilenceCheck()) || castInProgress) return false`.
// DoTouchSpell reads that answer as the last term of its condition, so the
// gate belongs to the DECISION, not only to the executor below.
import { silenceBlocksCast } from '../systems/mysticism.js';

// AUDIT 24 (wave 24): EnemyAttack.cs's two ranged bounds have one
// home; this module declared them again. Wave 35 MOVED that home to
// enemyMotor.js (DoRangedAttack's stand-off needs them, and
// enemyAttack.js already imports from the motor) - enemyAttack.js
// re-exports, so this import still reads from the module it belongs to.
import { MIN_RANGED_DISTANCE, MAX_RANGED_DISTANCE } from './enemyAttack.js';
import { bloodCentre as sparkleCentre } from '../scenes/hitEffects.js';   // AUDIT 24 (wave 44): the same centre+height/8 point

export { MIN_RANGED_DISTANCE, MAX_RANGED_DISTANCE };
export const RANGED_SPELL_CHANCE = 1 / 40; // DoRangedAttack: Random.value < 1/40f
export const SPELL_YAW_DEG = 22.5;

/** CanCastRangedSpell: rangeType 2 (SingleTargetAtRange) or 4
 *  (AreaAtRange); null when out of magicka, listless, or the pick is
 *  vetoed (all its effects already on the target). */
export function pickRangedSpell(entity, target, rolls = Math.random) {
  if ((entity.magicka ?? 0) <= 0) return null;
  const ranged = (entity.spells ?? []).filter((sp) => sp.rangeType === 2 || sp.rangeType === 4);
  if (!ranged.length) return null;
  const sp = ranged[Math.floor(rolls() * ranged.length)];
  return effectsAlreadyOnTarget(sp, target) ? null : sp;
}

/**
 * The SELECTION-FREE half of CanCastRangedSpell (EnemyMotor.cs:759-789),
 * for EnemyMotor.DoRangedAttack's band gate.
 *
 * AUDIT 24 (wave 35). DFU's CanCastRangedSpell is not a predicate: it
 * picks a spell with `Random.Range(0, count)`, stores it as
 * SelectedSpell, and vetoes on EffectsAlreadyOnTarget and on a clear
 * shooting path - and DoRangedAttack calls it every frame the band
 * condition is evaluated, so it also decides whether the foe STANDS
 * OFF. The port's selection lives in EnemyCaster, one classic tick at a
 * time, and calling pickRangedSpell from the motor as well would draw a
 * second time off the shared stream every frame - the exact fault AUDIT
 * 21 F5 wrote the roll-order law about.
 *
 * So the motor asks the half that has no side effect: has this entity
 * the magicka and a ranged spell at all. FLAGGED, and narrow: in DFU
 * the EffectsAlreadyOnTarget veto and the clear-path test can send a
 * caster back to closing in, where here they gate only the cast.
 */
export const hasRangedSpell = (entity) => ((entity?.magicka ?? 0) > 0)
  && (entity?.spells ?? []).some((sp) => sp.rangeType === 2 || sp.rangeType === 4);

/** CanCastTouchSpell, classic AI: rangeType 1 (ByTouch) or 0
 *  (CasterOnly). */
export function pickTouchSpell(entity, target, rolls = Math.random) {
  if ((entity.magicka ?? 0) <= 0) return null;
  const touch = (entity.spells ?? []).filter((sp) => sp.rangeType === 1 || sp.rangeType === 0);
  if (!touch.length) return null;
  const sp = touch[Math.floor(rolls() * touch.length)];
  return effectsAlreadyOnTarget(sp, target) ? null : sp;
}

/** Per-foe casting driver. The scene calls update() every frame and
 *  executes the returned decision (spend magicka, play the cast
 *  sound, self-assign or loose the missile). */
export class EnemyCaster {
  constructor(entity, rolls = Math.random) {
    this.entity = entity;
    this.rolls = rolls;
    this._classicTimer = 0;
  }

  /**
   * @param ai the foe's EnemyAI (senses: _dist, inSight, detected,
   *   giveUpTimer, yaw, feet)
   * @param attack the foe's EnemyAttack - the shared melee timer +
   *   one-shot state (no cast mid-swing), and rangedAttack (bow
   *   precedence over ranged spells, hasBowAttack's short-circuit)
   * @param playerEntity the target entity (the veto reads its
   *   activeEffects)
   * @returns { spell, touch } once per decision, or null
   */
  update(dt, ai, attack, playerFeet, playerEntity) {
    const ent = this.entity;
    if (!ent.spells?.length) return null;
    const dist = ai._dist;
    const idle = attack.machine.state === 'Idle';
    // AUDIT 26 F010: both cast branches live inside TakeAction, behind
    // `if (CanAct)` (:171-172) - a foe in knockback hit-stun or
    // paralysis casts nothing. `!== false` keeps bare-object ai stubs
    // on the permissive default.
    const canAct = ai.canAct !== false;
    // DoTouchSpell: sight + melee reach + the melee timer at 0; a
    // touch cast RESETS the melee timer (ResetMeleeTimer, verbatim).
    // AUDIT 26 F013: NO one-shot term - DFU's condition (:621-623) has
    // none (the only one-shot early-out above it covers the Seducer
    // transform states alone), so a foe whose melee timer floors to 0
    // mid-swing casts anyway and ChangeEnemyState CUTS the swing. The
    // port added `idle` here, delaying the cast by up to one swing and
    // landing an interrupted blow DFU would have cancelled. Reachable
    // where ResetMeleeTimer floors: player level ~22+ at low reflexes.
    if (canAct && ai.inSight && ai.detected && ai.giveUpTimer > 0
        && attack.meleeTimer === 0 && dist <= MELEE_DISTANCE) {
      const sp = pickTouchSpell(ent, playerEntity, this.rolls);
      // EnemyMotor.cs:619-628: SetReadySpell is the LAST term of
      // DoTouchSpell's `&&` chain and ResetMeleeTimer runs INSIDE the
      // body, after it. CanCastTouchSpell (the pick, and its roll) has
      // already run by then - so a silenced foe still draws the pick,
      // then SetReadySpell refuses, DoTouchSpell answers false, and the
      // SHARED melee timer is left alone for EnemyAttack's ordinary
      // swing.
      if (sp && !silenceBlocksCast(ent)) {
        // ChangeEnemyState(Spell) mid-swing REPLACES the attack anim
        // (:625-626), so the interrupted blow never reaches its damage
        // frame. The port's damage rides the attack machine, so the
        // cut lands there - the same cut enemyAttack's own mid-release
        // melee decision already makes.
        if (!idle) { attack.machine.state = 'Idle'; attack.machine.acc = 0; }
        attack.meleeTimer = resetMeleeTimer(attack.playerLevel, attack.reflexes, this.rolls());
        return { spell: sp, touch: true };
      }
    }
    // DoRangedAttack spell branch, on the classic cadence.
    const dx = playerFeet[0] - ai.feet[0], dz = playerFeet[2] - ai.feet[2];
    this._classicTimer += dt;
    let decision = null;
    while (this._classicTimer >= CLASSIC_UPDATE_INTERVAL) {
      this._classicTimer -= CLASSIC_UPDATE_INTERVAL;
      // The RANGED branch keeps its one-shot term - DFU's 1/40 roll
      // sits behind `if (!isPlayingOneShot)` (:588) exactly as the
      // 1/32 bow roll does; only the TOUCH arm has none.
      if (decision || attack.rangedAttack || !idle || !canAct || ai.giveUpTimer <= 0) continue;
      if (dist <= MIN_RANGED_DISTANCE || dist >= MAX_RANGED_DISTANCE) continue;
      if (!ai.inSight || !ai.detected || !withinYaw(ai.yaw, dx, dz, SPELL_YAW_DEG)) continue;
      if (this.rolls() >= RANGED_SPELL_CHANCE) continue;
      const sp = pickRangedSpell(ent, playerEntity, this.rolls);
      if (sp) decision = { spell: sp, touch: false };
    }
    return decision;
  }
}

/** X3-slice: THE ONE CAST EXECUTOR - "enemies always cast ready
 *  spell instantly once queued", extracted from the dungeon host so
 *  both foe pools release through the same arms (the M3 one-engine
 *  doctrine). The gates ride the deps:
 *  - the silence gate runs for enemies too, bypassed by a free
 *    rider exactly as the cost is (magic-15);
 *  - an ordinary cast spends the cost PRICED OFF THE PLAYER's magic
 *    skills (a null caster reads the player's skills in the source,
 *    the default setting), floored at 0 - selection only gates
 *    magicka > 0;
 *  - the element cast sound rings from the caster;
 *  - CasterOnly assigns to SELF; AreaAroundCaster explodes AT THE
 *    CASTER instantly with the caster excluded (magic-9); everything
 *    else looses a missile through the host's fire seam.
 *  RESIDUAL (both hosts, honest): enemy missiles resolve against
 *  the player only - foe-vs-foe friendly fire pends the missile
 *  seam's target sweep. */
export function castEnemySpell(f, spell, {
  noSpellPointCost = false, playerEntity, playerFeet = null,
  applySpell, foeSinks, calculateCastCost, silenceBlocksCast,
  playCastSound = null, explodeAt = null, fireMissile = null,
  hitEffects = null,   // AUDIT 24 (wave 44): ShowMagicSparkles
  rolls = Math.random,
} = {}) {
  if (!noSpellPointCost && silenceBlocksCast(f.entity)) return false;
  if (!noSpellPointCost) {
    const cost = calculateCastCost(spell, playerEntity).sp;
    f.entity.magicka = Math.max(0, (f.entity.magicka ?? 0) - cost);
  }
  const from = [f.ai.feet[0], f.ai.feet[1] + 1.2, f.ai.feet[2]];
  f._castPending = true;   // C14: the sprite Spell one-shot
  playCastSound?.(spell.element, from);
  // AUDIT 24 (wave 44) - EntityEffectManager.cs:2055-2068, right after
  // the cast sound and BEFORE the bundle is assigned. The gate is on
  // the target type: anything that is not SingleTargetAtRange (2) or
  // AreaAtRange (4) sparkles - so a self cast, a touch and an
  // area-around-caster do, and the two ranged ones do not, because
  // their visual is the missile.
  //
  // The sparkles bloom on the CASTER. `entityBehaviour` there is the
  // manager's own entity and an EntityEffectManager sits on the
  // caster, so `position + controller.center` with `y += height/8` is
  // this foe's own five-eighths point, not its target's.
  if (spell.rangeType !== 2 && spell.rangeType !== 4) {
    hitEffects?.showMagicSparkles(sparkleCentre(f.ai.feet, f.ai.height));
  }
  if (spell.rangeType === 0) {
    applySpell(spell, f.entity.level, f.entity, foeSinks(f), rolls, { entity: f.entity, sinks: foeSinks(f) });
    return true;
  }
  if (spell.rangeType === 3) {
    explodeAt?.([f.ai.feet[0], f.ai.feet[1] + 0.9, f.ai.feet[2]], spell, f.entity.level, playerFeet,
      { entity: f.entity, sinks: foeSinks(f) }, { excludeFoe: f });   // caster transform = mid-capsule
    return true;
  }
  fireMissile?.(from, spell, f.entity.level, f);
  return true;
}
