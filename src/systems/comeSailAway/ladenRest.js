// @ts-check
// LADEN-REST (the port's own; FIELD BUGS 2026-10-29e, "sometimes my bnoat begins to spin"): WHEN A LADEN HULL COMES TO
// REST AT THE LIGHT RATE. Come Sail Away scales every rate by the cargo mod, the rate a swing and a way are taken off by
// too, so a load at twice her hold (a mod of 0) kept both for good. The runtime (comeSailAway.js) asks these and takes the
// load's share off its rates while she rests. A leaf: it imports nothing. What her load is, the helm's panel says while it
// holds her (HEAVY-HINT, bible/01-Overview/bugs/Field-Bugs-2026-10-29d.md).
const f = Math.fround;

/** Her swing's step: toward `swing`, resting while it eases or is let go - AUDIT FB1029e S1: and while the helm is put
 *  against a laden swing, toward 0 alone, so past 0 the other way gathers at the load's rate. A light hull (`mod` 1) is
 *  the mod to the letter. @returns {{ rest: boolean, toward: number }} */
export function swingStep(/** @type {number} */ swing, /** @type {number} */ current, /** @type {number} */ mod) {
  const against = swing * current < 0 && mod < 1;
  return { rest: against || Math.abs(swing) < Math.abs(current), toward: against ? 0 : swing };
}

/** Whether her way rests: the way wanted (`wanted`) less than hers (`was`) and along her own line (`dot`, the two
 *  vectors' dot) - AUDIT FB1029e S5: a way wanted across it (her oars' slide) gathers at the load's rate. */
export const wayRests = (/** @type {number} */ wanted, /** @type {number} */ was, /** @type {number} */ dot) =>
  wanted < was && (wanted === 0 || dot >= f(f(wanted * was) * 0.999));
