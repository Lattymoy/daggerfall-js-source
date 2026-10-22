// @ts-check
// DAY-TURN (2026-10-22, the owner: "The servers are on fire right now. We need to do something"; bible/01-Overview/bugs/
// Field-Bugs-2026-10-22.md DAY-TURN): A PAGE'S DAY TURNS AT ITS OWN MOMENT PAST MIDNIGHT.
//
// The books that keep a UTC day's answer - a profession's state, the ground's pixels and the dungeons (net/profBook.js),
// a town's hall, its economy and its seat witnessed once a day (npcHallBook.js, townEconBook.js, townSeatBook.js) - each
// asked the account service again the moment the day's number changed. Every page online changes it at the same second,
// 00:00:00 UTC, so every page asked at once: the live service's own points, three nights running, read `/v1/prof/state`
// 60 a minute at 23:57-23:59 and 3,544 at 00:00, the pixels' 1,250 a minute 3,761, and the one database's queue went
// from some 3,000 s of waiting a minute to 230,000 - a 503 for one ask in four, the sign-in's tokens refused, the relay
// refusing the hellos that followed - for two hours and more each night, its statements no busier than at 23:40 (D1's
// own insights): the turn's burst, then its retries, held the queue full.
//
// So each page turns its day at its own moment in DAY_TURN_SPREAD_MS past 00:00 UTC, chosen once, at random: the
// burst is spread over that span (a page in DAY_TURN_SPREAD_MS / 60,000 a minute). A book keeps an answer for the day
// it was read on until its page's turn - yesterday's for at most that span - and an answer read today is today's at
// once: a book compares a day it HOLDS with its turned day by `>=`, never `!==` (a fresh answer stamped today is never
// "another day" during the turn). The day each book reads by when it ASKS is still the UTC day - the service's, which
// is the law's. Motherlodes already turn at their own moment (motherlodeBook.js MOTHERLODE_TURN_SPREAD_MS).

/** The span past 00:00 UTC a page's day turns in: ten minutes - the turn's burst a tenth as steep a minute, and a
 *  day's caps, nodes and witnesses at most ten minutes late on any page. */
export const DAY_TURN_SPREAD_MS = 10 * 60_000;
const DAY_MS = 86_400_000;

let pageTurnMs = /** @type {number|null} */ (null);
/** This page's moment in the day's turn, ms past 00:00 UTC: chosen once a page, at random, inside DAY_TURN_SPREAD_MS.
 *  @param {() => number} [rand] */
export function dayTurnMs(rand = Math.random) {
  if (pageTurnMs == null) pageTurnMs = Math.floor(Math.max(0, Math.min(1, Number(rand()) || 0)) * DAY_TURN_SPREAD_MS) % DAY_TURN_SPREAD_MS;
  return pageTurnMs;
}
/** The day a book holds answers for at `ms`: the UTC day, turned `turnMs` past its midnight. With `turnMs` 0, the UTC
 *  day itself. @param {number} ms @param {number} [turnMs] */
export const turnedDayOf = (ms, turnMs = 0) => Math.floor((ms - turnMs) / DAY_MS);
/** Tests stand a fresh page. */
export const _resetDayTurnForTests = () => { pageTurnMs = null; };
