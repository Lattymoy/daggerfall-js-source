// @ts-check
// SHARED-HEALTH (2026-10-26, bible/06-Systems/Integrity-Arc.md section 5, "Decisions (2026-10-26, SHARED-HEALTH)"):
// ONE HEALTH POOL UNDER THE REFEREE.
//
// The open zone, a duel and a siege each referee their fights on the relay, in the referee's own units (siegeVitality:
// 300 + 2 x Renown). Before this law that count was a second health pool: a player struck to none died with a full bar,
// and a potion healed a bar that no player fight reads. Now the referee's count is the player's own health, as a share:
//
//   - The client reports its health as a share of its maximum (`share`, in HEALTH_SHARE_WHOLE parts) and the last
//     referee word it applied (`seen`: the pool's epoch and word number). The referee's count for that report is the
//     share of its own maximum, plus every change the referee made that the client had not yet seen (the word log).
//     A lost report, a room changed or a word in flight therefore costs nothing: each report is the whole truth.
//   - A report below the count is a loss the client took from a foe, a fall or a poison: taken at once, never below 1
//     (the client's own death is its own word - the zone's `dd`, a duel's `dead`).
//   - A report above the count is a heal. NO HEAL MID-PVP: a fight between players never healed anyone - the zone and a
//     duel had no heal at all, a siege only its side-mates' heal spells - and a heal there is too strong. A heal is
//     refused for PVP_HEAL_BLOCK_MS after a player's blow on the fighter, and for a whole duel (the caller's
//     `healsBlocked`); the client's health is pulled back to the count. Outside a fight between players a heal is taken
//     whole, so a potion after a monster fight in the zone works as anywhere else.
//   - The referee's own changes (a blow, a cast, a relay foe's blow, a rise) are logged as words (`noteRefereeChange`),
//     each told to the fighter with the count, so its client sets its health to the same share.
//   - A pool the client has not reported into yet is not told to it: its count starts whole (newFighter), and a word
//     from it would heal the client to full. The relay asks for a report (`ask`) where it makes or resets a pool.
//
// PvP damage is thereby scaled as a share: a blow of 30 on a 302-count pool takes a tenth of any player's health.
//
// Pure: no clock (every `now` an argument), no socket, no storage. The relay's referees keep a HealthShare on each
// fighter (newFighter), and the client's mirror (net/siege/refereeHealthMirror.js) is the other half.

/** A share's whole, in parts: ten thousand, so a report rounds by a hundredth of a percent of the referee's count. */
export const HEALTH_SHARE_WHOLE = 10_000;

/** How long after a player's blow a report may not heal, ms: the zone's old mend window (net/wild/wildRef.js
 *  WILD_REF.mendMs, pinned equal in the test) - a fighter that long unstruck by a player is out of the fight. */
export const PVP_HEAL_BLOCK_MS = 30_000;

/** How many referee changes a pool remembers for reports that lag behind them. */
export const HEALTH_SHARE_LOG_MAX = 32;

/**
 * The share state the referee keeps on a fighter.
 * @typedef {object} HealthShare
 * @property {number} epoch   this pool's identity (its creation time, ms): a client's `seen` word number counts only
 *                            against the pool it came from
 * @property {number} word    the number of the referee's last change to the count
 * @property {Array<[number, number]>} log   `[word, change]` of the referee's recent changes (a blow negative)
 * @property {boolean} heard  a report has anchored this pool: only then is its count told to the client
 * @property {number} report  the number of the last report taken (echoed, so the client knows what the count includes)
 * @property {number} playerBlowAt  when a player's blow or harmful spell last landed on the count, ms (0: never)
 */

/**
 * A client's report, as the wire projects it (net/wire.js validVitIn).
 * @typedef {object} HealthReport
 * @property {number} report  the report's number, rising through the client's session
 * @property {number} share   the client's health over its maximum, in HEALTH_SHARE_WHOLE parts
 * @property {Array<[number, number]>} seen  `[epoch, word]` pairs: the last word the client applied from each pool
 */

/**
 * The referee's word on a pool, to its fighter (net/wire.js validVitOut, `k: 'h'`).
 * @typedef {object} PoolWord
 * @property {number} health  the count
 * @property {number} max     the count's whole
 * @property {number} epoch   the pool's epoch
 * @property {number} word    the pool's last change
 * @property {number} report  the last report the count includes
 */

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
