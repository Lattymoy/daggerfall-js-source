// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW-GATES-EVERYWHERE (A2b, 2026-10-26, the owner: "Every single thing here needs to be addressed. No exceptions.";
// bible/03-World/World-Wide.md WW-GATES-EVERYWHERE): WHERE A GATE'S KILL COUNTS, AS THIS CLIENT PUTS IT - the region its
// claim names to the account service (server-account/src/seatInfluence.js creditGate, net/townSeatLaw.js gateRegionOk:
// a Bay region for the Bay's lane, its own province's alone for a lane past it), the seats' and the chapters' word.
//
// Out of scenes/world.js (HOST-SPLIT: the host's `gateSeatWord` and `gateClaimReady` call it, a line each). The Bay's
// lane's region is its site's, off this client's own scan of the Bay's map (systems/gate/gateSite.js findGateSite - the
// service counts it where three claims agree), and its claim waits a while for that scan (GATE_SCAN_WAIT_MS, the
// host's). A lane past the Bay's is its theatre's province's (formats/mapsTables.js regionOfTheatre - WW-R's 62 to 69):
// the gate's number names its lane, so no scan is asked and its claim never waits on the Bay's.
//
// Not a DFU member. Ledger A (WW2).
// ═══════════════════════════════════════════════════════════════════
import { gateLaneOf } from '../../net/gate/gateLaw.js';
import { findGateSite } from '../../systems/gate/gateSite.js';
import { regionOfTheatre } from '../../formats/mapsTables.js';
import { BAY_THEATRE } from '../../world/worldWide/worldGrid.js';

/**
 * The region the kill of gate `d` (its number - net/gate/gateLaw.js gateNumber) counts in: the Bay's lane's by the Bay's
 * scan (`bayScan`, null until it is done - then null), a lane past the Bay's its province's. Null for no gate's number.
 * @param {number|undefined} d @param {any} bayScan systems/gate/gateSite.js gateScanner's scan, or null
 * @returns {number|null}
 */
export function gateSeatRegion(d, bayScan) {
  if (!Number.isSafeInteger(d) || /** @type {number} */ (d) < 0) return null;
  const lane = gateLaneOf(/** @type {number} */ (d));
  if (lane !== BAY_THEATRE) {
    const r = regionOfTheatre(lane);
    return r >= 0 ? r : null;
  }
  return bayScan ? (findGateSite(/** @type {number} */ (d), bayScan)?.region ?? null) : null;
}

/** Does the claim of gate `d` wait for the Bay's scan (`bayScan` null while it is not done)? The Bay's lane's alone - a
 *  lane past the Bay's region is its number's. */
export const gateClaimWaits = (/** @type {number|undefined} */ d, /** @type {any} */ bayScan) =>
  !bayScan && !(Number.isSafeInteger(d) && gateLaneOf(/** @type {number} */ (d)) !== BAY_THEATRE);
