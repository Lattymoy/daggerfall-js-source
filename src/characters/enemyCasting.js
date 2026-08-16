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
// the spend + release. DFU's clear-path probe
// (HasClearPathToShootProjectile) rides the senses' LOS here (inSight
// gates every decision); the Enhanced Combat AI branches are off, as
// everywhere in this port.

import { CLASSIC_UPDATE_INTERVAL } from './weaponStates.js';
import { MELEE_DISTANCE, withinYaw } from './enemyMotor.js';
import { resetMeleeTimer } from './enemyAttack.js';
import { effectsAlreadyOnTarget } from '../systems/effects.js';

export const MIN_RANGED_DISTANCE = 6;      // EnemyAttack.minRangedDistance (240 * GlobalScale)
export const MAX_RANGED_DISTANCE = 51.2;   // EnemyAttack.maxRangedDistance (2048 * GlobalScale)
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
    this._prevDist = null;
  }

  /**
   * @param ai the foe's EnemyAI (senses: _dist, inSight, yaw, feet)
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
    const approach = this._prevDist === null ? 0 : Math.max(0, this._prevDist - dist);
    this._prevDist = dist;
    const idle = attack.machine.state === 'Idle';
    // DoTouchSpell: sight + melee reach + the melee timer at 0; a
    // touch cast RESETS the melee timer (ResetMeleeTimer, verbatim).
    if (idle && ai.inSight && attack.meleeTimer === 0 && dist <= MELEE_DISTANCE + approach) {
      const sp = pickTouchSpell(ent, playerEntity, this.rolls);
      if (sp) {
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
      if (decision || attack.rangedAttack || !idle) continue;
      if (dist <= MIN_RANGED_DISTANCE || dist >= MAX_RANGED_DISTANCE) continue;
      if (!ai.inSight || !withinYaw(ai.yaw, dx, dz, SPELL_YAW_DEG)) continue;
      if (this.rolls() >= RANGED_SPELL_CHANCE) continue;
      const sp = pickRangedSpell(ent, playerEntity, this.rolls);
      if (sp) decision = { spell: sp, touch: false };
    }
    return decision;
  }
}
