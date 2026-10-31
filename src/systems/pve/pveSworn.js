// @ts-check
// FIXED-PVE SWORN-BOOST (bible/05-Combat/Fixed-PvE.md section 18, 2026-10-31: helpful but not overpowered, a
// booster): with fixed PvE on, a sworn revenant stands on the reference player at the player's
// level, not on its kind's Daggerfall numbers. A fresh one lands a fifth of a player's blow and has three fifths of a
// player's health; its rank, stars, devotion and the weapon the player gave it grow
// them, to at most SWORN_BLOW.most and SWORN_HEALTH.most. It always hits for less than the player and never outlasts
// them; its armour still guards it as Daggerfall's does. Ledger A (FIXED-PVE).
import { referencePlayer, DAMAGE_SPREAD } from './pveCategories.js';

/** A sworn one's blow over the reference player's: fresh, and the most growth takes it to. */
export const SWORN_BLOW = Object.freeze({ fresh: 0.2, most: 0.35 });
/** A sworn one's health over the reference player's: fresh, and the most growth takes it to. */
export const SWORN_HEALTH = Object.freeze({ fresh: 0.6, most: 1 });

/** What a given weapon grows a sworn one's blow by: a share a step of metal (Iron 0 .. Daedric 9) and a tier (0-3). */
export const SWORN_WEAPON = Object.freeze({ perMetal: 0.03, perTier: 0.1 });
/** The growth weapon `metal` and `tier` give, or 1 with none. @param {number} metal @param {number} tier */
export const swornWeaponGrow = (metal, tier) => 1 + SWORN_WEAPON.perMetal * Math.max(0, metal) + SWORN_WEAPON.perTier * Math.max(0, Math.min(3, tier));

/**
 * Stand sworn `entity` at the player's `level`: `grow` its blow and health over a fresh one's (rank, stars, devotion);
 * `fresh` a new stand at whole health, else the health it carries, held under the new whole. Answers the entity.
 * @param {any} entity @param {number} level @param {{ blow: number, health: number }} grow @param {boolean} fresh
 */
export function standSworn(entity, level, grow, fresh) {
  const ref = referencePlayer(level);
  const blow = ref.blow * Math.min(SWORN_BLOW.most, SWORN_BLOW.fresh * Math.max(1, grow.blow));
  const whole = Math.max(1, Math.round(ref.health * Math.min(SWORN_HEALTH.most, SWORN_HEALTH.fresh * Math.max(1, grow.health))));
  entity.pveBlow = [Math.max(1, Math.round(blow * (1 - DAMAGE_SPREAD))), Math.max(1, Math.round(blow * (1 + DAMAGE_SPREAD)))];
  entity.damageScale = 1;
  entity.maxHealth = whole;
  entity.health = fresh || !(entity.health > 0) ? whole : Math.min(entity.health, whole);
  return entity;
}
