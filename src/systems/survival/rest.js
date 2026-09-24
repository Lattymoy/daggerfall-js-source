// SURV4 - THE REST LAW: where you sleep decides what the sleep is
// worth, PURE. Mac's brief (2026-09-18): "Campfires in dungeons/outside
// + beds should act as the go-to rest options ... Resting toggle both
// offline/online should always be a last resort option that comes
// with a cost."
//
// THREE KINDS. A BED (a rented room, your own house, your ship) and a
// CAMP (within BY_FIRE_REACH of a lit fire - survival/camp.js) are the
// sleep: the rested hour pays DFU's whole recovery, the sleep debt
// clears at 1.5 hours an hour (needs.js), and the night is the night.
// Everything else - the rest window opened on a dungeon floor, a
// hillside, a guild hall's boards - is ROUGH: a last resort that costs.
// The rested hour pays HALF of DFU's recovery, the sleep debt pays down
// at 0.5 an hour and never below tired (needs.js's floor), the
// resting encounter roll runs TWICE a minute (systems/encounters.js),
// and you rise STIFF - speed and agility down for STIFF_HOURS.
//
// ONLINE the same: a rest is paced by the window's real-time timer
// (RESTX2) and the world's clock never moves (WORLD5), but the hour's
// recovery and its costs are the kind's, so a fire or a bed is a short
// real wait for a full restore and the window alone is the same wait
// for half of one and a stiff morning.
//
// THE GATE. Too cold to sleep without a fire, too hot to sleep at all:
// `restBlock` is the port's RegisterPreventRestCondition handler, the
// mod's own "You are too cold to sleep" reborn on DFU's own seam
// (restSession.js) - installed by the host that knows the felt
// temperature (SURV7's env feed), never here.
//
// SURV-TIERS (2026-09-23): THE KIND IS WHERE YOU SLEEP, THE COST IS THE
// TIER'S. A bed and a camp cost nothing in any tier. The rough night's
// price is the tier's rules' `roughRest` (survival/difficulty.js): Hard's
// is the half hour, the second ask and the stiff morning above; Casual's
// is DFU's own hour, one ask, no morning - the window stays the lesser
// sleep only in the debt it pays (needs.js), which is the reason to
// light a fire rather than a penalty for not. The gate is the tier's too
// (`restGate`: Hard's alone), read by the host's install (env.js).
import { survivalOf } from './needs.js';
import { HARD_RULES } from './difficulty.js';

export const REST_KIND = Object.freeze({ Bed: 'bed', Camp: 'camp', Rough: 'rough' });
/** What each kind costs: the hour's recovery (of DFU's), the resting encounter rolls a minute, the stiff hours after.
 *  `rough` is Hard's (the arc at full strength); a tier's own is its rules' `roughRest` (restCost). */
export const REST_COST = Object.freeze({
  bed: Object.freeze({ recovery: 1, encounters: 1, stiffHours: 0 }),
  camp: Object.freeze({ recovery: 1, encounters: 1, stiffHours: 0 }),
  rough: HARD_RULES.roughRest,
});
export const STIFF_HOURS = HARD_RULES.roughRest.stiffHours;   // AUDIT 68 S33-stiff-constants-dup: the hours stiffen() charges, not a copy
/** Speed and agility down by this while stiff (needs.js's survival entry carries it, and owns it). */
export { STIFF_PENALTY } from './needs.js';
export const REST_TEXT_SURVIVAL = Object.freeze({
  stiff: 'You rise stiff and sore from the hard ground.',
  // AUDIT SURV-TIERS (the third pass): the rough night's lesser sleep said in a tier with no stiff morning - a Casual
  // sleeper woke Drowsy from eight hours on the ground with no word for why
  sleptPoorly: 'You slept poorly on the bare ground.',
  tooCold: 'It is too cold to sleep here. Find a fire or shelter.',
  tooHot: 'It is too hot to sleep here.',
});

/** The kind of the rest about to start: a bed, a house or a ship sleep; a lit fire near sleeps; the rest is rough. */
export function restKind({ bed = false, houseOwned = false, ship = false, byFire = false } = {}) {
  if (bed || houseOwned || ship) return REST_KIND.Bed;
  if (byFire) return REST_KIND.Camp;
  return REST_KIND.Rough;
}
/** A kind's cost under a tier's rules (Hard's when none): a bed and a camp are the same in every tier; anything
 *  else - the rough kind, or a kind this law does not know - is the tier's rough price. */
export const restCost = (kind, rules = HARD_RULES) =>
  (kind === REST_KIND.Bed || kind === REST_KIND.Camp ? REST_COST[kind] : (rules ?? HARD_RULES).roughRest);

/**
 * The rested hour, by kind: `tick()` is the host's DFU hour
 * (scenes/shared.js restVitals - health, fatigue, magicka at their
 * rates, the Medical tally); a rough hour keeps only `recovery` of what
 * it gained. Answers the hour's "fully healed" only when nothing was
 * taken back.
 *
 * PARTY-REST10 (2026-09-21, per-request: confirmed by direct testing - a rough hour's kept fraction was
 * TRUNCATED AND DISCARDED independently every single hour, never carried forward. DFU's own recovery formula
 * (healthRecoveryRate) is typically a SMALL WHOLE NUMBER per hour (often exactly 1 at low level) - half of 1,
 * floored, is 0, forever, no matter how many hours pass, for any character whose raw hourly gain never
 * happens to be even. This was flagged once already (PARTY-REST4's own write-up: "confirmed... intentional,
 * punishing design") but "intentional" described the RATE being halved, never a raw gain landing on exactly
 * the wrong parity being locked out of Rough rest's health recovery FOR THE REST OF THE GAME - which is what
 * actually happened once tested. `carry`, when passed, banks the fractional remainder Math.trunc discards
 * this hour so the NEXT call (the next simulated hour) starts from it instead of from zero - two half-points
 * become one whole point over two hours, rather than two zeros forever. Optional and defaults to a fresh,
 * per-call {0,0,0}: a caller that does not keep `carry` across hours (this function's only caller before this
 * change, and every existing single-hour test) gets EXACTLY the old one-hour-at-a-time truncation, unchanged.
 *
 * SURV-TIERS: `rules` is the resting player's tier (Hard's when none) - a Casual rough hour keeps the whole hour.
 */
export function restHour(entity, kind, tick, carry = { health: 0, fatigue: 0, magicka: 0 }, rules = HARD_RULES) {
  const c = restCost(kind, rules);
  const h0 = entity.health ?? 0, f0 = entity.fatigue ?? 0, m0 = entity.magicka ?? 0;
  const healed = !!tick();
  if (c.recovery >= 1) return healed;
  const h1 = entity.health ?? 0, f1 = entity.fatigue ?? 0, m1 = entity.magicka ?? 0;
  const rawH = (h1 - h0) * c.recovery + carry.health;
  const rawF = (f1 - f0) * c.recovery + carry.fatigue;
  const rawM = (m1 - m0) * c.recovery + carry.magicka;
  const gainH = Math.trunc(rawH), gainF = Math.trunc(rawF), gainM = Math.trunc(rawM);
  carry.health = rawH - gainH; carry.fatigue = rawF - gainF; carry.magicka = rawM - gainM;
  entity.health = h0 + gainH;
  entity.fatigue = f0 + gainF;
  entity.magicka = m0 + gainM;
  return healed && entity.health === h1 && entity.fatigue === f1 && entity.magicka === m1;
}

/** Rising from a rough night: stiff until `now` + the kind's hours under the tier's rules (Hard's when none).
 *  False when the kind costs none - every kind, in Casual. */
export function stiffen(entity, now, kind = REST_KIND.Rough, rules = HARD_RULES) {
  const hours = restCost(kind, rules).stiffHours;
  if (!(hours > 0)) return false;
  const s = survivalOf(entity, now);
  s.stiffUntil = Math.max(s.stiffUntil ?? 0, now + hours * 60);
  return true;
}
export const isStiff = (s, now) => Number.isFinite(s?.stiffUntil) && now < s.stiffUntil;

/** The prevent-rest gate: too cold without a fire or a roof, too hot anywhere. Null when the sleep may start. */
export function restBlock({ tempWord = 'comfortable', byFire = false, insideBuilding = false } = {}) {
  if ((tempWord === 'freezing' || tempWord === 'deadly cold') && !byFire && !insideBuilding) return REST_TEXT_SURVIVAL.tooCold;
  if (tempWord === 'scorching') return REST_TEXT_SURVIVAL.tooHot;
  return null;
}
/**
 * RegisterPreventRestCondition's pair for the gate: the handler reads
 * the host's env each poll and the message is the FIRST block's word
 * - DFU's seam takes one message per handler, so the cold and the
 * heat are two handlers. `register(handler, message)` is
 * restSession.js's own.
 */
export function installSurvivalRestGate(readEnv, register, { enabled = () => true } = {}) {
  // AUDIT SURV B/C: a reader that answers null is a host that does not own the mode (the world's under a dungeon,
  // the interior's outdoors) - it says nothing, so the seam's first true answer is always the live host's
  const block = () => {
    const e = readEnv?.();
    if (!e || !enabled()) return null;
    return restBlock(e);
  };
  const cold = () => block() === REST_TEXT_SURVIVAL.tooCold;
  const hot = () => block() === REST_TEXT_SURVIVAL.tooHot;
  register(cold, REST_TEXT_SURVIVAL.tooCold);
  register(hot, REST_TEXT_SURVIVAL.tooHot);
  return [cold, hot];
}
