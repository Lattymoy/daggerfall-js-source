// ═══════════════════════════════════════════════════════════════════
// GUARD-ONLINE (2026-09-26, Mac: "Guard the guild quest (mages guild) -
// wait time for this should be alot shorter"; asked, the window "Starts
// ~1 min after you arrive" and stands one game hour, online only).
//
// N0B10Y03 "Guard the Guild" watches the hall `daily from 00:00 to
// 03:00` (its _S.02_), and pays only once that window has closed again
// (_pcgetsgold_: `not _S.02_`). Offline the player loiters to midnight -
// DFU's own answer, untouched here. Online the world clock is the SHARED
// one: a game day is two real hours and a rest moves no world time
// (RESTX2), so the window came round once every two hours and a player
// who took the quest just after three waited nearly all of them
// (Field-Bugs-2026-09-25 DISC25-C left it for Mac; this is Mac's call).
//
// Online, and for the quests named below alone, the window is the
// player's ARRIVAL's: it opens `delaySeconds` of world time after they
// are first in the place, and stands `lengthSeconds`. A player who
// leaves after it has closed and comes back opens it again - a watch
// missed is not a quest lost - but one who stays (the thieves dead, the
// questor to be paid) does not: the payment waits on the window being
// shut. A DEPARTURE, recorded (Port-Ledger section A, GUARD-ONLINE).
// ═══════════════════════════════════════════════════════════════════

/** questName -> the place the watch is kept at (the script's own Place symbol, without its underscores) and the
 *  window, in seconds of the world's clock. Ten game minutes is fifty real seconds online, an hour five minutes. */
export const ONLINE_GUARD_WINDOWS = Object.freeze({
  N0B10Y03: Object.freeze({ place: 'magesguild', delaySeconds: 10 * 60, lengthSeconds: 60 * 60 }),
});

/**
 * The window's law, pure. `s` is the watching action's own state `{ guardAnchor, guardAway }` (saved with it);
 * `here` is whether the player stands in the place now, `now` the world's clock in seconds. Answers whether the
 * window stands, and moves the state.
 */
export function guardWindowStep(s, here, now, win) {
  if (s.guardAnchor == null) {
    if (!here) return false;
    s.guardAnchor = now;   // the arrival
    s.guardAway = false;
  }
  const t = now - s.guardAnchor;
  if (t < 0) {   // a clock behind the arrival (a load from another timeline): the watch starts over
    s.guardAnchor = here ? now : null;
    s.guardAway = false;
    return false;
  }
  if (t > win.delaySeconds + win.lengthSeconds) {   // closed
    if (!here) { s.guardAway = true; return false; }
    if (!s.guardAway) return false;   // still in the hall since it closed: shut, so the questor can pay
    s.guardAnchor = now;   // back after it closed: a new watch
    s.guardAway = false;
    return false;
  }
  return t >= win.delaySeconds;
}
