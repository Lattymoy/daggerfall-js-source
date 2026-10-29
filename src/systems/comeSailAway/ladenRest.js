// @ts-check
// LADEN-REST (the port's own; FIELD BUGS 2026-10-29b, "sometimes my bnoat begins to spin"): WHEN A LADEN HULL COMES TO
// REST AT THE LIGHT RATE. Come Sail Away scales every rate by the cargo mod, the rate a swing and a way are taken off by
// too, so a load at twice her hold (a mod of 0) kept both for good. The runtime (comeSailAway.js) asks these and takes the
// load's share off its rates while she rests. A leaf: it imports nothing.
const f = Math.fround;

/** Her swing's step: toward `swing`, resting while it eases or is let go - AUDIT FB1029B S1: and while the helm is put
 *  against a laden swing, toward 0 alone, so past 0 the other way gathers at the load's rate. A light hull (`mod` 1) is
 *  the mod to the letter. @returns {{ rest: boolean, toward: number }} */
export function swingStep(/** @type {number} */ swing, /** @type {number} */ current, /** @type {number} */ mod) {
  const against = swing * current < 0 && mod < 1;
  return { rest: against || Math.abs(swing) < Math.abs(current), toward: against ? 0 : swing };
}

/** Whether her way rests: the way wanted (`wanted`) less than hers (`was`) and along her own line (`dot`, the two
 *  vectors' dot) - AUDIT FB1029B S5: a way wanted across it (her oars' slide) gathers at the load's rate. */
export const wayRests = (/** @type {number} */ wanted, /** @type {number} */ was, /** @type {number} */ dot) => wanted < was
  && (wanted === 0 || dot >= f(f(wanted * was) * 0.999));

/** Whether a hull's load word is said again this round: stopped dead (`mod` 0) with a hold to weigh against (AUDIT FB1029B
 *  S2: never the Carrack under Classic, which has none) while she is asked to move - her oars, her canvas or her helm. */
export const deadWordDue = (/** @type {number} */ mod, /** @type {number} */ threshold, /** @type {any} */ state) => mod === 0 && threshold > 0
  && (state.oarThrottle !== 0 || state.sailPosition !== 0 || state.TurnTarget !== 0);
