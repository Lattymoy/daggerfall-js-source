// @ts-check
// LOCKPICK (2026-10-26, the owner: "I want to build a detailed lock picking minigame and introduce a lockpick item";
// bible/06-Systems/Lockpicking.md): THE TUMBLERS' LAW - what a lock is made of and how hard each part of it is, pure.
//
// DFU's own chance is the backbone (world/actionSystem.js interiorLockpickingChance for a door or a chest underground -
// FormulaHelper.CalculateInteriorLockpickingChance, 5 x (level - lock) + Lockpicking, 5..95 - and
// exteriorLockpickingChance for a building's front door - CalculateExteriorLockpickingChance, Lockpicking - 5 x lock,
// 5..95). Where DFU rolls that chance once, the minigame turns it into the lock's tolerance: the window a binding pin
// hangs at the shear line in, and the chance a slip snaps the pick. The Auto attempt is DFU's roll itself, a pick spent
// when it fails. The lock's own value says how it is built: how many pins (pinsFor) and how many of them spools
// (spoolsFor); the order its pins bind in is the lock's own, the same every visit (bindingOrder over lockSeed).
//
// Not a DFU member - Daggerfall rolls the chance and has no tumblers. Ledger A (LOCKPICK).
import { actBand } from '../../net/professionLaw.js';   // Foraging's attribute bands (FORAGE0 14.4), the acts' own

/** The pins a lock has: two at the least (a lock of 1-3), one more each 4 of its value, six at the most (16-19). A
 *  building's front door (quality / 2: 0-10) has 2-4, a chest (1-15) 2-5, a dungeon's door (2-18) 2-6. */
export const LOCK_PINS_MIN = 2;
export const LOCK_PINS_MAX = 6;
export const LOCK_PINS_STEP = 4;
/** A spool pin false-sets the first time it is set and must be set again: one from a lock of SPOOL_ONE, two from
 *  SPOOL_TWO. */
export const SPOOL_ONE = 8;
export const SPOOL_TWO = 14;

/**
 * THE ACT'S NUMBERS (seconds unless named):
 *   riseS        - the binding pin lifted to the shear line, on the average...
 *   riseJitter   - ...each lift its own, up to this share either way - a pin that rises in one beat a lift is a pin a
 *                  steady rhythm sets blind (a tap round the chambers at one pace opened a six-pin lock with no risk).
 *                  AUDIT LOCKPICK A2: the jitter must outspan what a press can set in - at DFU's 5% the hang at the best
 *                  Agility band and both graces (0.08 x 1.3 + 2 x 0.03 = 0.164 s) under the rise's own spread (0.2 x 2 x
 *                  0.45 = 0.18 s), so no one delay after a lift sets every rise; at 0.3, 0.18 and 0.05 every delay from
 *                  0.167 to 0.3 s set every pin at every chance, and a blind rhythm opened a 5% lock six times in ten.
 *                  Above it the hang grows with the chance and a steady, watching hand is the skill the lock rewards
 *   fallS        - the binding pin falling back from it
 *   springS      - a free pin's whole bounce, up and back (it never hangs)
 *   graceS       - a press this close to the hang (the rise's last of it, the fall's first) still sets
 *   windowMinS   - the hang at the shear line at DFU's 5% chance, before the attribute band...
 *   windowMaxS   - ...and at its 95%
 *   breakScale   - a slip snaps the pick at this share of the chance DFU's roll would fail...
 *   breakMin     - ...never under this...
 *   breakMax     - ...nor over this
 *   freeRisk     - a free pin lifted (not the binding one) snaps the pick at this share of a slip's chance: probing for
 *                  the binding pin is not free, so a hand that senses it, or a lock remembered, is worth having
 *   senseSkill   - from this Lockpicking the binding pin is told apart before it is lifted
 */
export const LOCKPICK_ACT = Object.freeze({
  riseS: 0.2,
  riseJitter: 0.45,
  fallS: 0.32,
  springS: 0.22,
  graceS: 0.03,
  windowMinS: 0.08,
  windowMaxS: 0.6,
  breakScale: 0.55,
  breakMin: 0.04,
  breakMax: 0.6,
  freeRisk: 0.35,
  senseSkill: 50,
});

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
/** DFU's chance, held to its own 5..95 (both formulas clamp so; a NaN is the floor). */
const chanceOf = (chance) => clamp(Number.isFinite(chance) ? chance : 5, 5, 95);

/** The pins a lock of `lock` has. Pure. */
export const pinsFor = (lock) => clamp(LOCK_PINS_MIN + Math.floor(Math.max(0, Number(lock) || 0) / LOCK_PINS_STEP), LOCK_PINS_MIN, LOCK_PINS_MAX);
/** The spool pins among them. Pure. */
export const spoolsFor = (lock) => ((Number(lock) || 0) >= SPOOL_TWO ? 2 : (Number(lock) || 0) >= SPOOL_ONE ? 1 : 0);
/** The hang at the shear line for DFU's `chance` (5..95), widened or narrowed by the Agility band `band` (actBand). Pure. */
export const setWindowS = (chance, band = 1) => {
  const A = LOCKPICK_ACT;
  return (A.windowMinS + ((A.windowMaxS - A.windowMinS) * (chanceOf(chance) - 5)) / 90) * (Number(band) > 0 ? Number(band) : 1);
};
/** The chance (0..1) a slip snaps the pick, for DFU's `chance`. Pure. */
export const slipBreakChance = (chance) => clamp(((100 - chanceOf(chance)) / 100) * LOCKPICK_ACT.breakScale, LOCKPICK_ACT.breakMin, LOCKPICK_ACT.breakMax);
/** The Agility band a lock is picked in - Foraging's four (x0.85 to x1.30), the acts' own. Pure. */
export const lockBand = (agility) => actBand(Number(agility) || 0);
/** Whether a hand of `skill` Lockpicking tells the binding pin apart before it lifts it. Pure. */
export const sensesBinding = (skill) => (Number(skill) || 0) >= LOCKPICK_ACT.senseSkill;

/** A lock's own seed from its name (FNV-1a, 32 bits): the same lock binds the same way every visit, on every client. */
export function lockSeed(key) {
  let h = 0x811c9dc5;
  const s = String(key ?? '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
/** A seeded stream (mulberry32) over `seed`. */
function stream(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** The order a lock's `n` pins bind in - a shuffle of 0..n-1 by its `seed` (Fisher-Yates). Pure. */
export function bindingOrder(n, seed) {
  const order = Array.from({ length: Math.max(0, n | 0) }, (_, i) => i);
  const r = stream(seed);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}
/** Which of a lock's `n` pins are spools (`spools` of them), by its `seed` - never the first to bind, so a lock always
 *  opens its account with a plain pin. Pure: an array of booleans, a pin each. */
export function spoolPins(n, spools, seed) {
  const order = bindingOrder(n, seed);
  const r = stream((seed ^ 0x9e3779b9) >>> 0);
  const pool = order.slice(1);
  const out = Array.from({ length: order.length }, () => false);
  for (let k = 0; k < Math.min(spools, pool.length); k++) {
    const j = k + Math.floor(r() * (pool.length - k));
    [pool[k], pool[j]] = [pool[j], pool[k]];
    out[pool[k]] = true;
  }
  return out;
}
/** THE AUTO ATTEMPT - DFU's own roll, each site's: underground (a door, a chest) Range(0, 100) under the chance
 *  (DaggerfallActionDoor.AttemptLockpicking's Dice100.FailedRoll); a building's front door Range(1, 101) under it
 *  (PlayerActivate.ActivateStaticDoor's `chance > Random.Range(1, 101)`). Pure. */
export const autoOpens = (chance, roll01, exterior = false) => (exterior ? 1 : 0) + Math.floor(Number(roll01) * 100) < chanceOf(chance);
