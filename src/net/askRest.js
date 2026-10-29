// @ts-check
// AUDIT PASS (2026-10-29; bible/06-Systems/Battle-Pass.md section 8): THE PAGE STANDS BACK - one rule for the finds a
// service decides, the Battle Pass's (systems/pass/passClient.js) and the Witches' Festival's (systems/festival/
// festivalClient.js). The service's word that it is shut rests the page and is read again after the rest, never kept for
// the page (a page loaded before a switch turned on asked nothing until it was reloaded). A refusal rests the page as long
// as its cause lasts. No jitter (net/backoff.js): a rest ends at the page's next deed, which spreads the asks. Not a DFU member.
import { utcDay } from './marksLaw.js';

/** `brief`: a find called closed (the two clocks may straddle an opening - read again after it), a rate, an enforced
 *  line's empty bucket, a read due that went unanswered. `long`: a read saying the service is shut for the account, a
 *  seat or a hold refused. The day's asks spent wait for the next UTC day. */
export const ASK_REST_MS = Object.freeze({ brief: 60_000, long: 10 * 60_000 });

/**
 * A page's rest for one service's finds: `nowMs()` the shared clock, `account()` the account asking - a rest is that
 * account's, and another signed in asks at once.
 * @param {{ nowMs: () => number, account: () => string|null }} doors
 */
export function createAskRest({ nowMs, account }) {
  let until = 0, of = /** @type {string|null} */ (null), shut = false, reread = false;
  const rest = (/** @type {number} */ at, /** @type {boolean} */ why) => { until = at; of = account(); shut = why; };
  const standing = () => of === account() && nowMs() < until;
  return {
    /** Whether a rest stands now: no find is asked. */
    resting: standing,
    /** Whether the rest standing is the service's word that it is shut (a window says `closed`). */
    shut: () => shut && standing(),
    /** Whether the service's state is read before the next find: a find was called closed, or `open`, the state's last
     *  word, is shut - a state kept from before a rest or a bind is never a veto. */
    due: (/** @type {unknown} */ open) => reread || open === false,
    /** A read answered, `open` its word: shut, the page rests and reads it again after; open, a shut rest ends. */
    heard(/** @type {unknown} */ open) {
      reread = false;
      if (open === false) rest(nowMs() + ASK_REST_MS.long, true);
      else if (open === true && shut) rest(0, false);
    },
    /** A read due that went unanswered: a brief rest, so it is not asked again on every deed. */
    unheard() { rest(nowMs() + ASK_REST_MS.brief, false); },
    /** A find refused, by its error: the page rests as long as the cause lasts. */
    refused(/** @type {unknown} */ error) {
      const now = nowMs();
      if (error === 'capped') rest((utcDay(Math.floor(now / 1000)) + 1) * 86_400_000, false);
      else if (error === 'closed') { rest(now + ASK_REST_MS.brief, false); reread = true; }
      else if (error === 'rate' || error === 'progress-play') rest(now + ASK_REST_MS.brief, false);
      else if (error === 'progress-seat' || error === 'trade-held') rest(now + ASK_REST_MS.long, false);
    },
    /** Bound anew: no rest, nothing to read again. */
    reset() { until = 0; of = null; shut = false; reread = false; },
  };
}
