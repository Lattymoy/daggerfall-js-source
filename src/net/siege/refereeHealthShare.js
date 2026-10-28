// @ts-check
// SHARED-HEALTH (2026-10-26, bible/06-Systems/Integrity-Arc.md section 5): ONE HEALTH POOL UNDER THE REFEREE. The referee's
// count (siegeVitality: 300 + 2 x Renown) is the player's own health as a share, not a second pool. The client reports its
// share and the last word it applied (`seen`); the count is that share of the referee's maximum plus every change the referee
// made since (the word log), so a lost report or a word in flight costs nothing. A loss is taken at once, never below 1. A
// heal is refused for PVP_HEAL_BLOCK_MS after a player's blow and for a whole duel (`healsBlocked`): the client is pulled back
// to the count. A pool no report has anchored is told to nobody. Pure: no clock, socket or storage (client half: refereeHealthMirror.js).
/** A share's whole, in parts: ten thousand, so a report rounds by a hundredth of a percent of the referee's count. */
export const HEALTH_SHARE_WHOLE = 10_000;

/** How long after a player's blow a report may not heal, ms: the zone's old mend window (net/wild/wildRef.js
 *  WILD_REF.mendMs, pinned equal in the test) - a fighter that long unstruck by a player is out of the fight. */
export const PVP_HEAL_BLOCK_MS = 30_000;

/** How many referee changes a pool remembers for reports that lag behind them. */
export const HEALTH_SHARE_LOG_MAX = 32;

/** @typedef {{ epoch: number, word: number, log: Array<[number, number]>, heard: boolean, report: number, playerBlowAt: number }} HealthShare
 *  The referee's state on a fighter: the pool's identity (creation ms), its last change's number, `[word, change]` of recent changes, whether a report anchored it, the last report taken, and when a player last struck it (ms, 0 never). */
/** @typedef {{ report: number, share: number, seen: Array<[number, number]> }} HealthReport
 *  A client's report (net/wire.js validVitIn): its number, its health over its maximum in HEALTH_SHARE_WHOLE parts, and `[epoch, word]` of the last word it applied from each pool. */
/** @typedef {{ health: number, max: number, epoch: number, word: number, report: number }} PoolWord
 *  The referee's word on a pool to its fighter (net/wire.js validVitOut, `k: 'h'`): the count, its whole, the pool's epoch and last change, the last report the count includes. */

/** A fresh share state: unheard, never struck by a player. @param {number} now @returns {HealthShare} */
export function newHealthShare(now) {
  return { epoch: Math.trunc(now), word: 0, log: [], heard: false, report: 0, playerBlowAt: 0 };
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
 * @param {{ share?: HealthShare }} fighter @param {number} now
 */
export function resetHealthShare(fighter, now) {
  const share = shareOf(fighter, now);
  share.log = [];
  share.heard = false;
}

/** The changes the client had not seen when it reported, summed. */
function unseenChange(share, seen) {
  const pair = Array.isArray(seen) ? seen.find((s) => s[0] === share.epoch) : null;
  const seenWord = pair ? pair[1] : 0;
  let sum = 0;
  for (const [word, change] of share.log) if (word > seenWord) sum += change;
  return sum;
}

/** Whether a heal is refused now: mid-PvP, or where the caller says (a duel). */
const healRefused = (share, now, healsBlocked) => healsBlocked || now - (share.playerBlowAt || 0) < PVP_HEAL_BLOCK_MS;

/**
 * A CLIENT'S REPORT TAKEN into a fighter's count (`hp`, `max`, `down` - the referee's fighter). A fallen fighter takes
 * none. `healsBlocked`: the caller's word that no heal lands for this whole fight (a duel). Answers whether the report
 * was taken (the caller then tells the count back - poolWord).
 * @param {{ hp: number, max: number, down: boolean, share?: HealthShare }} fighter
 * @param {HealthReport} report @param {number} now @param {{ healsBlocked?: boolean }} [o]
 */
export function takeHealthReport(fighter, report, now, { healsBlocked = false } = {}) {
  if (!fighter || fighter.down) return false;
  const share = shareOf(fighter, now);
  const target = (report.share * fighter.max) / HEALTH_SHARE_WHOLE + unseenChange(share, report.seen);
  const difference = target - fighter.hp;
  if (difference <= -0.5) {
    fighter.hp = Math.max(1, Math.round(target));
  } else if (difference >= 0.5 && share.heard && !healRefused(share, now, healsBlocked)) {
    // An unheard pool starts whole, so nothing can rise in it.
    fighter.hp = Math.min(fighter.max, Math.round(target));
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
  return { health: Math.max(0, Math.trunc(fighter.hp)), max: fighter.max, epoch: share.epoch, word: share.word, report: share.report };
}

/** Whether a pool waits for a report to anchor it (the relay asks for one). @param {{ share?: HealthShare }} fighter */
export const poolUnheard = (fighter) => !fighter?.share?.heard;
