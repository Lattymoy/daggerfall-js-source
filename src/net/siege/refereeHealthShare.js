// @ts-check
// SHARED-HEALTH (2026-10-26, bible/06-Systems/Integrity-Arc.md section 5): ONE HEALTH POOL UNDER THE REFEREE. The referee's
// count (siegeVitality: 300 + 2 x Renown) is the player's own health as a share, not a second pool. The client reports its
// share and the last word it applied (`seen`); the count is that share of the referee's maximum plus every change the referee
// made since (the word log), so a lost report or a word in flight costs nothing. A loss is taken at once, never below 1.
// A pool no report has anchored is told to nobody. Pure: no clock, socket or storage (client half: refereeHealthMirror.js).
import { healCredit, spendCredit, shieldPaid, healthCapAt } from '../wild/pvpVitals.js'; // PVP-VITALS: a flagged fighter's rise is paid for
/** A share's whole, in parts: ten thousand, so a report rounds by a hundredth of a percent of the referee's count. */
export const HEALTH_SHARE_WHOLE = 10_000;

/** How long after a player's blow a fighter is in the fight and its heals are capped, ms: the zone's old mend window
 *  (net/wild/wildRef.js WILD_REF.mendMs, pinned equal in the test) and the rework's combat timer. */
export const PVP_HEAL_BLOCK_MS = 30_000;

/** PVP-HEALTH (the PvP rework, 2026-10-28, "Real health + armour"): a report's real maximum is the pool's whole, at
 *  most this - the best legitimate level-45 body (25 + 30 + 44 x 35 = 1,595 at
 *  every top roll, Renown's +147, Stoneskin's +25%, the sky's stars and a Fortify) with room over it. */
export const PVP_HEALTH_MAX = 3000;

/** PVP-HEAL: in a fight, every heal on a fighter (its regen, potions, spells, a side-mate's spells) together restores at
 *  most `base` of its whole in `windowMs`, plus `step` for each `per` points of Restoration past `from`, to `top`. */
export const PVP_HEAL = Object.freeze({ windowMs: 15_000, base: 0.25, top: 0.35, step: 0.01, per: 20, from: 100 });
/** PVP-HEAL: the share of the whole a fight's heals may restore per window at `restoration` (skill + gear). */
export const pvpHealShare = (restoration) => {
  const r = Number.isFinite(restoration) ? restoration : 0;
  return Math.min(
    PVP_HEAL.top,
    PVP_HEAL.base + PVP_HEAL.step * Math.max(0, Math.floor((r - PVP_HEAL.from) / PVP_HEAL.per)),
  );
};
/** The most Restoration a report may claim (skill + gear: a mastered 200 and every gear line). */
export const PVP_RESTORATION_MAX = 1000;

/** PVP-GUARD: the share of a player's blow a fighter's armour lets through, per cent, by the blow's kind - edged, blunt,
 *  unarmed (combat/pvpGuard.js reports it). Never under `min` (Daedric, its natural resistance and room over it), never
 *  over `max` (a weak body takes more). Unreported, a fighter wears nothing. */
export const PVP_GUARD = Object.freeze({ min: 10, max: 150, bare: 100 });
export const PVP_GUARD_KINDS = Object.freeze(['edged', 'blunt', 'unarmed']);
/** PVP-GUARD: a blow of `kind` (PVP_GUARD_KINDS) on `fighter`, after its armour - never under 1 where it was over 0. */
export function guardedBlow(fighter, kind, want) {
  const g = fighter?.share?.guard;
  const i = PVP_GUARD_KINDS.indexOf(kind);
  const kept = Array.isArray(g) && i >= 0 ? g[i] : PVP_GUARD.bare;
  return want > 0 ? Math.max(1, Math.round((want * kept) / 100)) : 0;
}

/** PVP-WARD (the owner, 2026-10-29: "so 85% resist", "do it"): the share of a player's spell a fighter's resistances let
 *  through, per cent, by DFU's element (fire, frost, poison, shock, magic). Never under `min`: no resistance, immunity
 *  included, takes more than 85%. */
export const PVP_WARD = Object.freeze({ min: 15, max: 100, elements: 5 });
/** PVP-WARD: a cast of element `el` (0-4; unnamed, magic) on `fighter`, after its resistance - at least 1 where it was over 0. */
export function wardedCast(fighter, el, want) {
  const w = fighter?.share?.ward;
  const kept = Array.isArray(w)
    ? (w[Number.isInteger(el) && el >= 0 && el < PVP_WARD.elements ? el : PVP_WARD.elements - 1] ?? PVP_WARD.max)
    : PVP_WARD.max;
  return want > 0 ? Math.max(1, Math.round((want * kept) / 100)) : 0;
}

/** PVP-SHIELD (the owner's triangle, 2026-10-29: "tune it to 55% win", "just barely"; the plan's "Shields max 25%"): what of
 *  a player's blow a fighter under the strongest Shield takes, per cent - a swing's and a shaft's. The pool itself is PvE's.
 *  PVP-KIT: a Shield's reported share runs `min`..`max` (the bar's 10-25%), and takes off that part of the strongest's. */
export const PVP_SHIELD = Object.freeze({ melee: 75, shaft: 65, min: 10, max: 25 });
/** PVP-SHIELD: a blow on `fighter` past its reported Shield (`shaft` an arrow's) - at least 1 where it was over 0. */
export function shieldedBlow(fighter, shaft, want) {
  const sh = Number(fighter?.share?.shield) || 0;
  if (!(sh > 0) || !(want > 0)) return want > 0 ? want : 0;
  const off = ((100 - (shaft ? PVP_SHIELD.shaft : PVP_SHIELD.melee)) * Math.min(sh, PVP_SHIELD.max)) / PVP_SHIELD.max;
  return Math.max(1, Math.round((want * (100 - off)) / 100));
}

/** PVP-EVADE (the owner, 2026-10-30: "if ur above other in lvl you shoulfd b harder to hit", "dodge mneed to worjk as well
 *  in pvp"): a player's swing or shaft that hit is still evaded whole - 0.05% for each point of live Dodging (gear
 *  counted) to 25% at 500, 2% for each level the struck one stands over its striker to 20%, and a gear power's evade
 *  (the Raven's), all three to 40%. Spells are never evaded. The client reports Dodging and the power, the relay rolls. */
export const PVP_EVADE = Object.freeze({
  perDodge: 0.05,
  dodgeMax: 25,
  perLevel: 2,
  levelMax: 20,
  max: 40,
  dodgeTop: 1000,
});
/** PVP-EVADE: the chance, per cent, that `fighter` (its reported Dodging and gear power) evades a blow from a striker of
 *  signed level `byLevel`, itself at signed level `toLevel` - an unsigned level gives no level part. */
export function pvpEvadeChance(fighter, byLevel, toLevel) {
  const sh = fighter?.share;
  const dodge = Math.min(PVP_EVADE.dodgeMax, PVP_EVADE.perDodge * Math.max(0, Number(sh?.dodge) || 0));
  const over = Number.isSafeInteger(byLevel) && Number.isSafeInteger(toLevel) ? Math.max(0, toLevel - byLevel) : 0;
  const level = Math.min(PVP_EVADE.levelMax, PVP_EVADE.perLevel * over);
  return Math.min(PVP_EVADE.max, dodge + level + Math.max(0, Number(sh?.evade) || 0));
}

/** How many referee changes a pool remembers for reports that lag behind them. */
export const HEALTH_SHARE_LOG_MAX = 32;

/** @typedef {{ epoch: number, word: number, log: Array<[number, number]>, heard: boolean, report: number, playerBlowAt: number, heals: Array<[number, number]>, resto: number, guard: number[]|null, ward: number[]|null, shield: number, dodge: number, evade: number }} HealthShare
 *  The referee's state on a fighter: the pool's identity (creation ms), its last change's number, `[word, change]` of recent changes, whether a report anchored it, the last report taken, when a player last struck it (ms, 0 never), `[at, healed]` in the heal window, and its reported Restoration. */
/** @typedef {{ report: number, share: number, seen: Array<[number, number]>, max?: number, resto?: number, guard?: number[], ward?: number[], shield?: number, dodge?: number, evade?: number, mp?: number, fp?: number, use?: number[] }} HealthReport
 *  A client's report (net/wire.js validVitIn): its number, its health over its maximum in HEALTH_SHARE_WHOLE parts, `[epoch, word]` of the last word it applied from each pool, and (PVP-HEALTH) its real maximum and Restoration, and (PVP-GUARD, PVP-WARD) its armour's and resistances' shares, and (PVP-SHIELD) a Shield on it. */
/** @typedef {{ health: number, max: number, epoch: number, word: number, report: number }} PoolWord
 *  The referee's word on a pool to its fighter (net/wire.js validVitOut, `k: 'h'`): the count, its whole, the pool's epoch and last change, the last report the count includes. */

/** A fresh share state: unheard, never struck by a player. @param {number} now @returns {HealthShare} */
export function newHealthShare(now) {
  return {
    epoch: Math.trunc(now),
    word: 0,
    log: [],
    heard: false,
    report: 0,
    playerBlowAt: 0,
    heals: [],
    resto: 0,
    guard: null,
    ward: null,
    shield: 0,
    dodge: 0,
    evade: 0,
  };
}

/** A fighter's share state - made where a fighter kept from before this law (a siege's storage) has none. */
function shareOf(fighter, now) {
  if (!fighter.share) fighter.share = newHealthShare(now);
  return fighter.share;
}

/**
 * THE REFEREE CHANGED THE COUNT (a blow, a cast, a relay foe's blow, a rise): logged, so a report that had not seen it
 * still counts it. `change` is the count after minus before; `byPlayer` - a player's blow or harmful spell, which
 * opens the no-heal window. Answers the change's word number.
 * @param {{ share?: HealthShare }} fighter @param {number} change @param {number} now @param {boolean} [byPlayer]
 */
export function noteRefereeChange(fighter, change, now, byPlayer = false) {
  const share = shareOf(fighter, now);
  if (byPlayer) share.playerBlowAt = now;
  share.word += 1;
  share.log.push([share.word, change]);
  if (share.log.length > HEALTH_SHARE_LOG_MAX) share.log.shift();
  return share.word;
}

/**
 * THE POOL STARTS AGAIN (a rise after a fall, a return after long away, a count set whole): every earlier change is
 * forgotten - the word numbers run on, so a report that saw a word from before counts every change after the reset -
 * and the pool waits for a report to anchor it.
 * @param {{ share?: HealthShare, vitals?: { heard: boolean } }} fighter @param {number} now
 */
export function resetHealthShare(fighter, now) {
  const share = shareOf(fighter, now);
  share.log = [];
  share.heard = false;
  if (fighter.vitals) fighter.vitals.heard = false; // PVP-VITALS: the ledgers start again from the game's word too
}

/** Whether a fighter is in a fight: struck by a player inside PVP_HEAL_BLOCK_MS. @param {{ share?: HealthShare }} fighter @param {number} now */
export const inPvpFight = (fighter, now) => {
  const at = fighter?.share?.playerBlowAt || 0;
  return at > 0 && now - at < PVP_HEAL_BLOCK_MS;
};

/**
 * PVP-HEAL: how much a fighter may still be healed now - without bound out of a fight, else its window's share
 * (pvpHealShare at the best Restoration of the fighter's own and `healerResto`) less what the window already healed.
 * @param {{ max: number, share?: HealthShare }} fighter @param {number} now @param {number} [healerResto]
 */
export function healRoom(fighter, now, healerResto = 0) {
  if (!inPvpFight(fighter, now)) return Infinity;
  const share = shareOf(fighter, now);
  share.heals = (share.heals ?? []).filter((h) => now - h[0] < PVP_HEAL.windowMs);
  const whole = Math.floor(fighter.max * pvpHealShare(Math.max(share.resto || 0, healerResto || 0)));
  return Math.max(0, whole - share.heals.reduce((n, h) => n + h[1], 0));
}
/** PVP-HEAL: a heal of `n` spent from the fighter's window (only in a fight). */
export function spendHeal(fighter, now, n) {
  if (n > 0 && inPvpFight(fighter, now)) shareOf(fighter, now).heals.push([now, n]);
}

/** PVP-HEALTH: the pool's whole set to `max` (1..PVP_HEALTH_MAX), its count kept at the same share - but in a fight a
 *  rising whole adds no health, so a report that drops its maximum and lifts it again heals nothing. */
export function setPoolMax(fighter, max, now) {
  const to = Math.max(1, Math.min(PVP_HEALTH_MAX, Math.trunc(Number(max) || 0)));
  if (to === fighter.max) return;
  const kept = to > fighter.max && inPvpFight(fighter, now) ? fighter.hp : Math.round((fighter.hp * to) / fighter.max);
  if (fighter.hp > 0) fighter.hp = Math.max(1, Math.min(to, kept));
  fighter.max = to;
}

/** The changes the client had not seen when it reported, summed. */
function unseenChange(share, seen) {
  const pair = Array.isArray(seen) ? seen.find((s) => s[0] === share.epoch) : null;
  const seenWord = pair ? pair[1] : 0;
  let sum = 0;
  for (const [word, change] of share.log) if (word > seenWord) sum += change;
  return sum;
}

/**
 * A CLIENT'S REPORT TAKEN into a fighter's count (`hp`, `max`, `down` - the referee's fighter). A fallen fighter takes
 * none. `healsBlocked`: the caller's word that no heal by report lands for this whole fight (a siege: its heals are
 * spells). In a fight a heal is held to the window's room (healRoom). PVP-VITALS: `sourced` (flagged) - a rise to the
 * relay's credit too, a Shield a paid one alone; `cl` the signed level, bounding the whole. Answers whether it was taken.
 * @param {{ hp: number, max: number, down: boolean, share?: HealthShare }} fighter
 * @param {HealthReport} report @param {number} now @param {{ healsBlocked?: boolean, sourced?: boolean, cl?: number|null }} [o]
 */
export function takeHealthReport(fighter, report, now, { healsBlocked = false, sourced = false, cl = null } = {}) {
  if (!fighter || fighter.down) return false;
  const share = shareOf(fighter, now);
  if (Number.isFinite(report.resto)) share.resto = Math.max(0, Math.min(PVP_RESTORATION_MAX, Math.trunc(report.resto)));
  if (Number.isFinite(report.max)) setPoolMax(fighter, Math.min(report.max, healthCapAt(cl, PVP_HEALTH_MAX)), now); // PVP-HEALTH: the pool's whole is the real maximum; PVP-VITALS: never past its signed level's
  if (Array.isArray(report.guard) && report.guard.length === PVP_GUARD_KINDS.length) {
    share.guard = report.guard.map((n) => Math.max(PVP_GUARD.min, Math.min(PVP_GUARD.max, Math.trunc(Number(n) || 0)))); // PVP-GUARD
  }
  if (Array.isArray(report.ward) && report.ward.length === PVP_WARD.elements) {
    share.ward = report.ward.map((n) => Math.max(PVP_WARD.min, Math.min(PVP_WARD.max, Math.trunc(Number(n) || 0)))); // PVP-WARD
  }
  if (typeof report.shield === 'number') share.shield = report.shield; // PVP-SHIELD; PVP-KIT: its share, 0 none
  if (Number.isFinite(report.dodge)) share.dodge = Math.max(0, Math.min(PVP_EVADE.dodgeTop, Math.trunc(report.dodge))); // PVP-EVADE
  if (Number.isFinite(report.evade)) share.evade = Math.max(0, Math.min(PVP_EVADE.max, Math.trunc(report.evade))); // PVP-EVADE: a gear power's
  if (sourced && !shieldPaid(fighter, now)) share.shield = 0; // PVP-VITALS: a Shield nobody paid for is none
  const target = (report.share * fighter.max) / HEALTH_SHARE_WHOLE + unseenChange(share, report.seen);
  const difference = target - fighter.hp;
  if (difference <= -0.5) {
    fighter.hp = Math.max(1, Math.round(target));
  } else if (difference >= 0.5 && share.heard && !healsBlocked) {
    // An unheard pool starts whole, so nothing can rise in it. PVP-HEAL: in a fight, to the window's room.
    // PVP-VITALS: a flagged fighter's rise, to the credit the relay granted it (regen, a potion, a paid heal)
    const got = Math.min(
      fighter.max - fighter.hp,
      Math.round(target) - fighter.hp,
      healRoom(fighter, now),
      sourced ? Math.floor(healCredit(fighter, now)) : Infinity,
    );
    if (got > 0) {
      fighter.hp += got;
      spendHeal(fighter, now, got);
      if (sourced) spendCredit(fighter, got, now);
    }
  }
  share.heard = true;
  share.report = Math.max(share.report, report.report);
  return true;
}

/**
 * The count as a word to its fighter - or null for a pool no report has anchored yet (its count would heal the client
 * to full).
 * @param {{ hp: number, max: number, share?: HealthShare }} fighter
 * @returns {PoolWord | null}
 */
export function poolWord(fighter) {
  const share = fighter?.share;
  if (!share || !share.heard) return null;
  return {
    health: Math.max(0, Math.trunc(fighter.hp)),
    max: fighter.max,
    epoch: share.epoch,
    word: share.word,
    report: share.report,
  };
}

/** Whether a pool waits for a report to anchor it (the relay asks for one). @param {{ share?: HealthShare }} fighter */
export const poolUnheard = (fighter) => !fighter?.share?.heard;
