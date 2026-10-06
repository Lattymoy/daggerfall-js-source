// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW7 / LW-FIX2 / WATCH-FIX (2026-10-05, bible/06-Systems/Living-World.md "LW7", "LW-FIX2", "WATCH-FIX"): THE TURNED
// WATCH - a resident the watch's conversion took (DFU's: the walker's body gone, a guard stood in its place - a swing, the
// trample, the crime response's arms, the minute's sweep, the town watch's summons) is followed through the guard that
// stands for them to its end. Every such guard carries the resident it came from (`livingFrom`, put on it where it is
// stood: scenes/cityGuards.js turnNpc, systems/rrRidingHost.js's trample; a load's by the id alone) - AUDIT-C6: the
// struck body's IDENTITY as it was struck (its `living` record, minted afresh each time the town's pool dresses a body),
// never the body, which is the pool's and dressed again.
//
// WATCH-FIX: followed from the beat its guard is first seen, the resident is LENT to it - off the street while it stands,
// never taken for the day - and at its end:
//   - cut down by the player's own blow (`killedBy` 'player'): one of the watch is SLAIN - the town's whole deed
//     (livingTown.js slain: the hand's turn, their household turned, the witnesses' crime, where he fell);
//   - cut down by any other hand (a beast, a fall, a reflected blow, another player's): one of the watch is KILLED - dead
//     for good, and nobody's regard of the player moved (livingTown.js killed);
//   - gone with no body (walked away with the crime, run from a beast, taken by a spell, swept with the world): BACK to
//     their day. So is one the conversion took who is not of the watch (DFU's witness arm takes every walker after a
//     guard has seen): a guard stood in their place, they stepped aside - its end is never their death.
// The first cut read any `dead` as a kill: the watch walking off when the crime cleared slew the resident by the player's
// hand and turned the palace household against them; and a resident only the swing had marked was taken for the day.
// ═══════════════════════════════════════════════════════════════════

/** The beats (host frames) a guard's resident is looked for (a load's guard knows only the id) before it is let be. */
export const WATCH_WAIT = 600;

/**
 * @typedef {{ guard: any, from: { id: string, res?: any, town?: any }, res: any, town: any, lent: boolean, waited: number }} Turned
 */

/**
 * One beat over the turned watch. `turned` is the host's list (changed in place); `guards` the watch standing now
 * (cityGuards.guards - a cut-down guard stays in it while his body lies). `resolve(id)` finds a resident by id - its
 * `{ town, res }`, or null while its town is not stood; `localOf(town, feet)` a world point in the town's own frame
 * (where he fell, for the witnesses).
 * @param {Turned[]} turned @param {readonly any[]} guards
 * @param {{ resolve?: (id: string) => ({ town: any, res: any }|null), localOf?: (town: any, feet: number[]) => (number[]|null) }} [o]
 */
export function watchStep(turned, guards, { resolve = () => null, localOf = (_town, feet) => feet } = {}) {
  for (const g of guards) {
    if (!g?.livingFrom || g.livingFollowed) continue;
    g.livingFollowed = true;   // followed once, whatever its end - a body lying in the list is never a second deed
    const from = g.livingFrom;
    turned.push({ guard: g, from, res: from.res ?? null, town: from.town ?? null, lent: false, waited: 0 });
  }
  for (let i = turned.length - 1; i >= 0; i--) {
    const w = turned[i];
    if (!w.res || !w.town) { const got = resolve(w.from.id); if (got) { w.res = got.res; w.town = got.town; } }
    if (!w.lent && w.res && w.town) { w.town.lend(w.res); w.lent = true; }
    const g = w.guard;
    const ended = !!g.dead || !guards.includes(g);
    if (!ended) {
      if (!w.lent && ++w.waited > WATCH_WAIT) turned.splice(i, 1);   // a load's guard whose resident is never found: let be
      continue;
    }
    turned.splice(i, 1);
    if (!w.lent) continue;   // nobody was lent to it
    if (g.dead && g.corpse && w.res.guard) {
      const person = { living: { id: w.res.id, res: w.res, town: w.town }, pos: localOf(w.town, g.ai?.feet ?? null) };
      if (g.killedBy === 'player') w.town.slain(person);
      else w.town.killed(person);
    } else w.town.back(w.res);
  }
}
