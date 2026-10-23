// @ts-check
// PWR1 (2026-10-23, bible/05-Combat/Power-Arc.md section 4): THE POWER BUDGET AS THE STATS PAGE SHOWS IT. Every source
// on a channel adds; the channel lands the sum through its curve (systems/power/powerBudget.js - whole to the knee, then
// approaching the ceiling). A power's own words say what it adds; this says what the whole channel adds and what lands, so
// a stack's diminishing - and a lone condition past the knee (First Blood's +60, the Seer's mark of 20) - is never hidden.
// Each figure is read through the reader its door lands (entityMods.js weaponBlowGain and weaponDamageGain,
// weaponStates.js swingPaceSum, powerBudget.js evadeChances and guardSum, castSpeed.js castSpeedSum, spell/spellPower.js
// spellPowerSum and spellPierceSum, absorption.js portAbsorbSum, the folds' budgetCut), so the page and the fight cannot
// disagree. What a blow alone opens (a ledger's leech, a kill's heal, a guard that answers a blow in flight) is not
// standing, and is not shown.
//
// Not a DFU member: the port's own law, shown. Ledger A (PWR1).

import { POWER_CHANNELS, budgeted, evadeChances, guardSum } from './powerBudget.js';
import { weaponBlowGain, weaponDamageGain, entityModsOf } from '../entityMods.js';
import { swingPaceSum } from '../../characters/weaponStates.js';
import { castSpeedSum } from '../castSpeed.js';
import { spellPowerSum, spellPierceSum } from '../spell/spellPower.js';
import { portAbsorbSum } from '../absorption.js';
import { weaponTypeForItem } from '../../combat/fpsWeapon.js';

/** The blow asked as the Stats page asks one - nothing kept (AUDIT MARTIAL L2 F7). */
const ESTIMATE = Object.freeze({ unaware: false, estimate: true });
/** A blow of this many points, so a gain reads as a percent. */
const BASE = 100;

/** @typedef {{ channel: string, key: string|number|null, unit: string, sum: number, landed: number, knee: number, ceiling: number }} BudgetRow */

/**
 * THE ROWS: every channel `entity` has a standing sum on now - the blow and the roll with `weapon` against `foe` (the
 * page's reference foe), the swing's pace, the evasion and the guard a foe's blow would meet, the cast's speed, the spell
 * and the pierce at `foe`, the absorption, and each skill, body part and element (`key`) the folds' curve held back. A
 * channel with nothing on it is left out. The card names them (ui/statsCard.js).
 * @param {any} entity
 * @param {{ weapon?: any, foe?: any, usingRightHand?: boolean }} [opts]
 * @returns {BudgetRow[]}
 */
export function powerBudgetRows(entity, { weapon = null, foe = null, usingRightHand = true } = {}) {
  /** @type {BudgetRow[]} */
  const rows = [];
  if (!entity) return rows;
  const add = (/** @type {string} */ channel, /** @type {number} */ sum, /** @type {string|number|null} */ key = null, landed = budgeted(channel, sum)) => {
    const c = POWER_CHANNELS[channel];
    if (c && Number.isFinite(sum) && sum > 0) rows.push({ channel, key, unit: c.unit, sum, landed, knee: c.knee, ceiling: c.ceiling });
  };
  const ask = (/** @type {() => number} */ fn) => { try { const v = fn(); return Number.isFinite(v) ? v : 0; } catch { return 0; } };
  const blowCtx = { blow: true, attacker: null };
  if (foe) add('blow', ask(() => (weaponBlowGain(weapon, BASE, entity, foe, ESTIMATE) * 100) / BASE));
  if (weapon) add('roll', ask(() => (weaponDamageGain(weapon, 10 * BASE) * 100) / (10 * BASE)));
  add('pace', ask(() => swingPaceSum({ entity, weaponType: weaponTypeForItem(weapon), usingRightHand })));
  add('evade', ask(() => evadeChances(entity, blowCtx).reduce((s, [, v]) => s + v, 0)));
  add('guard', ask(() => guardSum(entity, blowCtx)));
  add('castSpeed', ask(() => castSpeedSum(entity)));
  if (foe) { add('spell', ask(() => spellPowerSum(entity, foe))); add('pierce', ask(() => spellPierceSum(entity, foe))); }
  add('absorb', ask(() => portAbsorbSum(entity)));
  for (const c of entityModsOf(entity).budgetCut ?? []) add(c.channel, c.sum, c.key, c.landed);
  return rows;
}
