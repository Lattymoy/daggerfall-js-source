// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW7 / LW-FIX2 (2026-10-05, bible/06-Systems/Living-World.md "LW7", "LW-FIX2"): THE TURNED WATCH - one of the watch a
// swing or the trample struck (DFU's conversion: the watchman's body gone, a guard stood in his place) is followed to
// his end. The guard the conversion stands carries the resident it came from (`livingFrom`, marked where it is stood:
// scenes/cityGuards.js resolveCivilianHit, systems/rrRidingHost.js's trample) - found by that mark, never by when or
// where it was stood. AUDIT-C6: the mark is the struck body's IDENTITY as it was struck (its `living` record, minted
// afresh each time the town's pool dresses a body) - the body itself is the pool's and dressed again, and a dead guard
// still wearing an old body's mark was found for the next watchman that body became. Cut down, the resident is slain for good - the town's own deed (livingTown.js slain: the hand's
// turn, their household turned, the witnesses' crime, at the place he was struck); the guard gone with the crime, or
// never stood within WATCH_WAIT beats, let be.
// ═══════════════════════════════════════════════════════════════════

/** The beats (host frames) a struck watchman's guard is looked for before he is let be. */
export const WATCH_WAIT = 600;

/**
 * One beat over the turned watch: each one's guard found by its mark, a guard cut down the town's deed, a guard gone or
 * never stood let be. `turned` is the host's list (changed in place); `from` the struck body's identity record.
 * @param {{ res: any, from: any, town: any, at: number[], guard: any, waited: number }[]} turned
 * @param {readonly any[]} guards - the watch standing now (cityGuards.guards)
 */
export function watchStep(turned, guards) {
  for (let i = turned.length - 1; i >= 0; i--) {
    const w = turned[i];
    w.guard ??= guards.find((g) => g.livingFrom === w.from) ?? null;
    if (w.guard?.dead) { w.town.slain({ living: { id: w.res.id, res: w.res, town: w.town }, pos: w.at }); turned.splice(i, 1); }
    else if (w.guard ? !guards.includes(w.guard) : ++w.waited > WATCH_WAIT) turned.splice(i, 1);
  }
}
