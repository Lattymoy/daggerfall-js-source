// THE IDENTIFY SPELL'S REFUND - the magicka the Identify effect gives back at cast time, which is also the magicka
// the identify window charges when the player clicks Identify (worldModes.js and dungeonContext.js read it as the
// window's `cost`).
//
// Daggerfall Unity refunds the effect's own spell point cost (Identify.cs:50-56, FormulaHelper.CalculateEffectCosts)
// and charges the same number in the window (Identify.cs:74, IdentifySpellCost). The two figures and the cast's own
// price come from one formula there, so a player who could cast the spell can always pay the window.
//
// The port prices a player's cast with more than that formula: the school a signature spell is cast in, and the
// registered cost modifiers and free casts (spellcost.js calculateCastCost - an awake Wardwright's Attuned Wards
// takes 20% off every Thaumaturgy spell). The refund once priced the effect without them (absorption.js
// effectCastingCost), so a discounted cast refunded, and the window then charged, more than the cast had spent. A
// player whose magicka pool was smaller than the undiscounted price could cast Identify but met "You do not have
// enough spell points left." on every click. Pricing the effect through the cast's own formula keeps the refund
// and the window's charge equal to what the cast spent on it.

import { calculateCastCost } from '../spellcost.js';

/** Identify.cs:54-55 - the refund never drops below 5. */
export const IDENTIFY_REFUND_FLOOR = 5;

/**
 * The magicka the Identify effect refunds, and the magicka the identify window then charges.
 *
 * The effect is priced alone, as a copy of its spell holding that one effect: DFU refunds only the Identify
 * effect's cost, and the other effects bundled with it stay paid. The copy keeps the spell's range type (the
 * target multiplier) and its signature path (the school it is cast in).
 *
 * @param {object} spell - the spell record that carries the effect.
 * @param {object} identifyEffect - the Identify effect (40, 255) of that spell.
 * @param {object} casterEntity - the entity whose skills and cost modifiers priced the cast.
 * @returns {number} spell points, at least IDENTIFY_REFUND_FLOOR.
 */
export function identifyRefund(spell, identifyEffect, casterEntity) {
  const identifyAlone = { ...spell, effects: [identifyEffect] };
  const { sp } = calculateCastCost(identifyAlone, casterEntity);
  return Math.max(IDENTIFY_REFUND_FLOOR, sp);
}
