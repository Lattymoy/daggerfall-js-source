// @ts-check
// AUDIT POTION-MIGHT (2026-10-31, A1/A5 and D8; bible/11-Multiplayer/Elite-Gates.md section 21.1): WHAT EACH BLOW POWER
// ADDS, in one home - what a set tier and a Legendary or Gilded power add to one blow at their best moment, and the
// numbers WEAPON-GEAR and BAL9c read. The client's powers (weaponMastery.js, lootPowers.js), the ceiling's measure
// (tools/powerCeiling.mjs) and the account judge's kit might (net/kitMight.js) read these, never a copy of them.
import { RAMPAGE_STACKS, BLOOD_STACKS, COIL_STACKS } from './sigil/sigilSets.js';
import { SCHOOL_POTENCY_PER_POINT } from './spell/spellPower.js';

/** A set tier's most onto one blow (per cent), at its numbers `v` - sigilSetPowers.js setBlow, read at its best moment. */
export const SET_TIER_BLOW = Object.freeze({
  bloodfury: (/** @type {any} */ v) => v.more * 2,   // twice below half health
  rampage: (/** @type {any} */ v) => v.stack * RAMPAGE_STACKS,
  nightfall: (/** @type {any} */ v) => v.more,   // an unaware foe
  wrath: (/** @type {any} */ v) => v.more,
  riposte: (/** @type {any} */ v) => v.more,
  'run-them-down': (/** @type {any} */ v) => v.more,
  'no-escape': (/** @type {any} */ v) => v.more,
  'blood-for-blood': (/** @type {any} */ v) => v.stack * BLOOD_STACKS,
  constrict: (/** @type {any} */ v) => v.stack * COIL_STACKS,
  'tallow-ward': (/** @type {any} */ v) => v.more,
  'battlemages-discipline': (/** @type {any} */ v) => v.armed,   // a foe that takes the cast's element whole
  'bound-in-silk': (/** @type {any} */ v) => v.more,
  undertow: (/** @type {any} */ v) => v.more,   // the open sea
});
/** A Legendary or Gilded power's most onto one blow - lootPowers.js lootBlow - and the moment it needs: `fresh` the
 *  foe's first landed blow, `struck` a foe already struck to every stack, `any` either. */
export const POWER_BLOW = Object.freeze({
  bane: { pct: (/** @type {any} */ p) => p.pct, moment: 'any' },
  unaware: { pct: (/** @type {any} */ p) => p.pct, moment: 'any' },
  sanctified: { pct: (/** @type {any} */ p) => p.pct, moment: 'any' },
  flow: { pct: (/** @type {any} */ p) => p.pct * p.max, moment: 'any' },   // its stacks are mine, from any foe
  moon: { pct: (/** @type {any} */ p) => p.pct + p.beast, moment: 'any' },
  rage: { pct: (/** @type {any} */ p) => p.pct, moment: 'any' },
  execute: { pct: (/** @type {any} */ p) => p.pct, moment: 'any' },
  firstblood: { pct: (/** @type {any} */ p) => p.pct, moment: 'fresh' },
  toll: { pct: (/** @type {any} */ p) => p.pct, moment: 'any' },   // the third shot of the weapon, at any foe
  undertow: { pct: (/** @type {any} */ p) => p.pct * p.max, moment: 'struck' },
  broadside: { pct: (/** @type {any} */ p) => p.pct, moment: 'struck' },   // the other hand's mark: the pistol's shot landed on this foe
});
/** Each effective point of a weapon's climb past 100 is this much more of what it does (BAL9b's per point). */
export const WEAPON_POTENCY_PER_POINT = SCHOOL_POTENCY_PER_POINT;
/** The Axe's and the Blunt Weapon's: twice that, on their half of a foe's health. */
export const WEAPON_HALF_PER_POINT = 2 * WEAPON_POTENCY_PER_POINT;
/** WEAPON-GEAR: the percent each point of gear on a weapon skill adds to its blow (0.44: a sheet of 872, trained 200
 *  and 672 on it, is the climb's 40 + 296 = x4.36, the top mob was shown). */
export const WEAPON_GEAR_PER_POINT = 0.44;
/** WEAPON-GEAR: the most percent gear adds (727 points) - with the axe's 80, the ceiling's mastery top of 400. */
export const WEAPON_GEAR_PCT_MOST = 320;
/** BAL9c (bible/05-Combat/Balance-Arc.md section 15): all the potency a wearer's pieces sum to, at most (%) - focus's and
 *  castSpeed's own 30. */
export const POTENCY_CAP = 30;
/** BAL9c: all the loot adds to a damage spell's landing, potency and powers together, at most (%) - SPELL_CUT_MOST's 50. */
export const SPELL_POWER_MOST = 50;
