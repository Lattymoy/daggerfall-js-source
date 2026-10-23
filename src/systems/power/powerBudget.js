// @ts-check
// PWR1 (2026-10-23, bible/05-Combat/Power-Arc.md section 4; Mac: "I want people to have power fantasy but I also want
// this to be balanced", then "Lets do all of it ... do it right. No band aids or short cuts"): ONE POWER BUDGET.
//
// THE CAUSE. Six registries composed a weapon blow in a chain (systems/entityMods.js weaponBlowMods: the sigil, the sets,
// the loot's powers, the Firmament, the weapon's mastery, the martial path - each a percent of the blow the last one
// left), each capped alone and none together; the guards and the evasions on the player's door the same (characters/
// playerEntity.js hurtPlayer: one roll an evasion, one percent a guard, chained); the leech, the round's regeneration,
// the kill's heals, the spell's price, the folds' skills summed with no ceiling at all. The stacked kit's six blow
// modifiers added +169% to a blow and composed to +318%, its Critical Strike stood at 192, and taking any ONE source
// away left it untouched (Power-Arc.md section 2): no nerf of one system moves a stack of them.
//
// THE LAW. Every source answers its PERCENT (or its points) on a named CHANNEL; the door SUMS them - never chains them -
// and passes the sum once through the channel's curve:
//   whole up to the channel's KNEE;
//   past it, knee + excess x S / (S + excess), S = CEILING - KNEE: a hyperbola that leaves the knee at slope 1 and
//   approaches the CEILING without reaching it - every piece still adds, less as the stack grows, and no stack runs away;
//   a sum at or below nothing passes whole (a keystone's price is a price).
// The KNEE is the most one system of the port's already gives on that channel UNCONDITIONALLY (the Firmament's blow group
// 30, its guard 30, the Raven's evasion 15, the loot's leech 10, a Legendary's resistance line 50 ...): a player who leans on
// one system's always-on share never meets the curve; a condition or a window that promises more (First Blood's +60 on a
// first blow, the Seer's mark of 20 off a throw, Soul Well's fifth from a trapped soul) lands on the curve as a stack does -
// the Stats page shows what lands. The CEILING is one law for every channel - CEILING_OVER_KNEE, half again the knee: every system together
// approaches half again what one system at its cap gives. Measured (Power-Arc.md section 4): the stacked kit at level 20
// fell from x1,400 the plain player's kill to x9.8, and lowering the blow's ceiling further moved the online kit nothing -
// its edge is many single sources' numbers, each under its knee, which the place answers (PWR3), not the budget.
//
// THE DOORS that read it, each summing what it used to chain: entityMods.js (the blow, the roll, and the folds' skills,
// armour and resistances), playerEntity.js hurtPlayer (the evasion and the guard - the two registries below), formulas.js
// (the leech, a ledger a blow), worldTick.js runMagicRoundsFor (the round's regeneration, a ledger a round), playerKills.js
// (the kill's heals, a ledger a kill), spell/spellPower.js (the spell and the pierce), spellcost.js (the price),
// castSpeed.js (the casting speed) and characters/weaponStates.js (the swing's pace).
//
// WHAT STAYS OUTSIDE (Power-Arc.md section 4, "what pools and what does not"): EVENTS - a power that turns a blow or a
// spell WHOLE on its own count, charge, cooldown or window (Dawnward's charges, Phantom Strike's window - martialPowers.js
// martialEvade, the Wardwright's Prismatic Ward - absorption.js `outside`), a death save and its tail (Unbroken's halving),
// and what is no percent (Iron Hide's ward and the Reprieve's shield in points, Gearward's winding, Bulwark's flat,
// Unyielding's ceiling on a single hit): each its own roll or its own points, its words whole, bound by its clock and by
// how few a player may wake (PWR2, attunement.js); THE SKILL'S OWN - the weapon's climb past 100 multiplies the landed
// blow (entityMods.js registerWeaponBlowMod `outside`), as the school's potency multiplies the landed spell; THE THORNS -
// Spite's share and the loot's points are two units on one blow, and a blow paid back never kills (BAL5: playerDoor.js
// paidBack), so the two shorten a fight and never end one; DFU'S OWN enchantments (enchantments.js - Daggerfall's item
// maker) keep DFU's own channel; and a refereed fight's referee (net/siege/siegeRef.js) holds every lane where players
// meet. Every window that only adds or lightens (Rallying Cleave, Cyclone, Earthsplitter, Living Aegis, Savage Whirl) is
// a NUMBER - under its channel's knee alone, so its words hold, and summed with the rest.
//
// A LEAF: it imports nothing, so every door above can read it with no cycle.
//
// Not a DFU member: the port's own systems, composed by the port's own law. Ledger A (PWR1).

/** @typedef {{ knee: number, ceiling: number, unit: '%'|'points' }} Channel */

/** Every channel's ceiling over its knee: everything together approaches half again what one system gives alone. */
export const CEILING_OVER_KNEE = 1.5;
/** A channel from its knee: the ceiling the law's. @param {Omit<Channel, 'ceiling'>} c @returns {Readonly<Channel>} */
const channel = (c) => Object.freeze({ ...c, ceiling: c.knee * CEILING_OVER_KNEE });

/** THE CHANNELS - each one's knee (what one system already gives); the ceiling (what every system together approaches)
 *  is CEILING_OVER_KNEE's. A balance pass moves one number here. */
export const POWER_CHANNELS = Object.freeze(/** @type {Record<string, Readonly<Channel>>} */ ({
  // a weapon blow: every blow modifier's percent of the blow (the sky's blow group is 30 - firmamentLaw.js BLOW_CAP; a
  // Legendary's slayer line tops at 30). The weapon's climb past 100 is the skill's own, outside the sum (x1.4 whole -
  // entityMods.js registerWeaponBlowMod `outside: 'skill'`), as the school's potency is outside the spell's
  blow: channel({ knee: 30, unit: '%' }),
  // the weapon's roll: its own damage lines, its gems, its heirloom (a Legendary's damage line tops at 40 - AFFIX_RANGES)
  roll: channel({ knee: 40, unit: '%' }),
  // what lands on me lighter: every guard's percent (the sky's blowTaken is 30 - firmamentLaw.js STAT_DEFS)
  guard: channel({ knee: 30, unit: '%' }),
  // a foe's blow missing me entirely (the Raven's Wings give 15 - lootRarity.js LEGENDARY_POWERS)
  evade: channel({ knee: 15, unit: '%' }),
  // my damage spell (the sky's spellPower is 30)
  spell: channel({ knee: 30, unit: '%' }),
  // a spell's price (the sky's castCost is 25)
  castCut: channel({ knee: 25, unit: '%' }),
  // points off a foe's saving throw (the loot's Eye of Magnus gives 15)
  pierce: channel({ knee: 15, unit: 'points' }),
  // a Destruction spell at me absorbed - the port's own sources (Mora's Mantle gives 30 at its Eye); DFU's own effect,
  // career and enchantment keep their own rolls, and the Wardwright's window its own (absorption.js tryAbsorption)
  absorb: channel({ knee: 30, unit: '%' }),
  // the casting speed (the loot's castSpeed is 30 - lootPowers.js CAST_SPEED_CAP)
  castSpeed: channel({ knee: 30, unit: '%' }),
  // the swing's pace (the Short Blade's climb past 100 gives 40 alone - weaponMastery.js, MARTIAL2's x1.4; the swing
  // law's own most was 50, which the climb and the Bladedancer's 20 land at)
  pace: channel({ knee: 40, unit: '%' }),
  // a landed blow's share healed (the loot's leech is 10 - lootPowers.js LEECH_CAP)
  leech: channel({ knee: 10, unit: '%' }),
  // a round's health back, in tenths of a percent of the maximum (the sky's hpRegen is 10 - a whole percent)
  regen: channel({ knee: 10, unit: 'points' }),
  // a round's magicka back, the same tenths (the sky's mpRegen is 10)
  manaRegen: channel({ knee: 10, unit: 'points' }),
  // a kill's health back, percent of the maximum (Orc Rage gives 10)
  killHeal: channel({ knee: 10, unit: '%' }),
  // a kill's magicka back (Soul Siphon gives 15)
  killMana: channel({ knee: 15, unit: '%' }),
  // a skill's points from everything worn and allocated (a Legendary's skill line tops at 30 - lootRarity.js AFFIX_RANGES)
  skill: channel({ knee: 30, unit: 'points' }),
  // a body part's armour points from everything worn and allocated (a Legendary's armour line tops at 20 - AFFIX_RANGES)
  armor: channel({ knee: 20, unit: 'points' }),
  // an element's resistance from everything worn and allocated (a Legendary's resistance line tops at 50 - AFFIX_RANGES,
  // an Aetheric arc's whole; the rolled lines together stop at 45 - lootRarity.js RESIST_CAP)
  resist: channel({ knee: 50, unit: 'points' }),
}));
export const CHANNEL_IDS = Object.freeze(Object.keys(POWER_CHANNELS));

/**
 * THE CURVE: a channel's summed `x` as it lands - whole to the knee, then knee + e x S / (S + e) (e the excess past the
 * knee, S the ceiling's span over it). A sum at or below nothing passes whole. An unknown channel passes whole.
 * @param {string} channel @param {number} x
 */
export function budgeted(channel, x) {
  const c = POWER_CHANNELS[channel];
  if (!c || !Number.isFinite(x) || x <= c.knee) return Number.isFinite(x) ? x : 0;
  const span = c.ceiling - c.knee;
  const e = x - c.knee;
  return c.knee + (e * span) / (span + e);
}
/** The share of a summed `x` that lands (1 at or under the knee; the curve over the sum past it). */
export const landedShare = (channel, x) => (x > 0 ? budgeted(channel, x) / x : 1);

// ── THE LEDGER: a channel whose sources pay out one after another (the leech's listeners a blow, the round's hooks) ──
/**
 * A LEDGER over one channel for one event (a blow's leech, a round's regeneration, a kill's heals): each source asks
 * `take(x)` with its own percent and is answered what lands of it - the curve over the running sum, less what the
 * sources before it already landed. The whole lands as the curve over the sum, whatever order the sources ask in.
 * @param {string} channel
 */
export function openLedger(channel) {
  let sum = 0, landed = 0;
  return Object.freeze({
    channel,
    /** @param {number} x */
    take(x) {
      if (!Number.isFinite(x) || x === 0) return 0;
      sum += x;
      const now = budgeted(channel, sum);
      const got = now - landed;
      landed = now;
      return got;
    },
    /** What the ledger has summed and landed so far. */
    get sum() { return sum; },
    get landed() { return landed; },
  });
}
/** A source's share through `ledger` when one is open, else its own percent whole (a door that opened none - a test's
 *  direct call, a tool). @param {{ take: (x: number) => number } | null | undefined} ledger @param {number} x */
export const ledgerShare = (ledger, x) => (ledger ? ledger.take(x) : x);

// ── THE PLAYER'S DOOR: the evasion and the guard, summed (characters/playerEntity.js hurtPlayer reads them) ──
/** @typedef {{ blow: boolean, attacker: any }} HurtCtx */
/** @typedef {{ chance: (entity: any, ctx: HurtCtx) => number, said?: (entity: any) => void }} EvadeSource */
const _evades = new Map();
const _guards = new Map();
/**
 * A source of EVASION: `chance(entity, ctx)` the percent (0..100) a FOE'S BLOW at me misses entirely, and `said(entity)`
 * its voice when the door's one roll lands on it. Asked only for a foe's blow (the door's mark). A non-object removes the
 * name. @param {string} name @param {EvadeSource | null} src
 */
export function registerEvadeSource(name, src) { if (src && typeof src.chance === 'function') _evades.set(name, src); else _evades.delete(name); }
/**
 * A source of GUARD: `fn(entity, ctx) -> percent` lighter a hurt lands on me now (a price is negative). `ctx.blow` says
 * whether the hurt is a foe's blow (the door's mark) - a guard that answers blows alone reads it. A non-function removes.
 * @param {string} name @param {((entity: any, ctx: HurtCtx) => number) | null} fn
 */
export function registerGuardSource(name, fn) { if (typeof fn === 'function') _guards.set(name, fn); else _guards.delete(name); }

let _rand = Math.random;
/** Tests: the evasion's roll. */
export function _setPowerBudgetRandForTests(/** @type {(() => number) | null} */ fn) { _rand = typeof fn === 'function' ? fn : Math.random; }

/** Every evasion source's chance on this blow, as `[name, percent]` - the positive ones. */
export function evadeChances(/** @type {any} */ entity, /** @type {HurtCtx} */ ctx) {
  /** @type {Array<[string, number]>} */
  const out = [];
  for (const [name, src] of _evades) {
    try { const v = src.chance(entity, ctx); if (Number.isFinite(v) && v > 0) out.push([name, v]); } catch { /* a source is not the blow's problem */ }
  }
  return out;
}
/** THE EVASION: one roll against the evade channel's curve over every source's chance; when it lands, the source it
 *  lands on (picked in proportion to their chances, from the same roll) says so. Answers whether the blow missed. */
export function rollEvade(/** @type {any} */ entity, /** @type {HurtCtx} */ ctx) {
  const chances = evadeChances(entity, ctx);
  if (!chances.length) return false;
  const sum = chances.reduce((s, [, v]) => s + v, 0);
  const p = Math.min(100, budgeted('evade', sum));
  const roll = _rand() * 100;
  if (!(roll < p)) return false;
  let at = (roll / p) * sum;
  for (const [name, v] of chances) {
    if (at < v) { try { _evades.get(name)?.said?.(entity); } catch { /* a voice is not the blow's problem */ } break; }
    at -= v;
  }
  return true;
}
/** Every guard source's percent on this hurt, summed (a price counts against them). */
export function guardSum(/** @type {any} */ entity, /** @type {HurtCtx} */ ctx) {
  let s = 0;
  for (const fn of _guards.values()) { try { const v = fn(entity, ctx); if (Number.isFinite(v) && v !== 0) s += v; } catch { /* as above */ } }
  return s;
}
/** The fraction a guarded hurt leaves, ONE CARRY FOR A FOE'S BLOWS AND ONE FOR EVERY OTHER HURT (AUDIT UICALM-FIRM1 L1
 *  M4's law, which the sky kept for its own two channels: their sums may have opposite signs, and one shared carry made a
 *  lighter spell land harder). */
let _guardOwed = { blow: 0, other: 0 };
/** THE GUARD: a hurt of `dmg`, lighter by the guard channel's curve over every source's percent - whole points, the
 *  fraction carried to the next hurt of its kind (AUDIT SCHOOLS L1 M2's law, which each guard kept alone). Never below 0. */
export function guardHurt(/** @type {any} */ entity, /** @type {number} */ dmg, /** @type {HurtCtx} */ ctx) {
  if (!(dmg > 0)) return dmg;
  const pct = budgeted('guard', guardSum(entity, ctx));
  if (!pct) return dmg;
  const k = ctx?.blow ? 'blow' : 'other';
  const exact = (dmg * pct) / 100 + _guardOwed[k];
  const whole = pct >= 0 ? Math.floor(exact + 1e-9) : Math.ceil(exact - 1e-9);
  _guardOwed[k] = exact - whole;
  return Math.max(0, dmg - whole);
}

// ── THE BLOW: the registries' answers, summed ──
/** @type {WeakMap<object, number>} */
let _blowCarry = new WeakMap();
/**
 * A BLOW'S SUM THROUGH ITS CURVE: `base` the blow before any modifier, `gained` what every modifier added to it, asked
 * each at `base` (entityMods.js weaponBlowMods); answers the blow that lands - `base + gained` whole while the gain is
 * at or under the knee's share, else `base` plus the curve's share of the gain, whole points, the fraction carried on
 * `key` (the weapon, or the striker's fists) unless `estimate` (the Stats page's reading keeps nothing).
 * @param {string} channel @param {number} base @param {number} gained @param {object | null} key @param {boolean} [estimate]
 */
export function landGain(channel, base, gained, key, estimate = false) {
  if (!(base > 0) || !Number.isFinite(gained) || gained === 0) return base + (Number.isFinite(gained) ? gained : 0);
  const pct = (gained * 100) / base;
  const lands = budgeted(channel, pct);
  if (lands === pct) return base + gained;
  const exact = (base * lands) / 100 + ((key && _blowCarry.get(key)) || 0);
  const more = Math.floor(exact + 1e-9);
  if (key && !estimate) _blowCarry.set(key, Math.max(0, exact - more));
  return base + more;
}

/** Tests only: every fraction carried, and the roll. */
export function _resetPowerBudgetForTests() { _blowCarry = new WeakMap(); _guardOwed = { blow: 0, other: 0 }; _rand = Math.random; }
