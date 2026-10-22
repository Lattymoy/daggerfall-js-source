// @ts-check
// FIELD BUGS 2026-10-21b VOYAGE-HOLD (bible/01-Overview/bugs/Field-Bugs-2026-10-21b.md; the Discord's #bug-reports,
// grayhatharry: "I bought a boat, sailed from one port town to another just a shy journey down the coast ... he informed me
// I hadn't sailed at all") - THE BERTH, as the naval host tells the harbour office (scenes/harbourOffice.js event).
//
// A berth is the boat at my helm lying in a port's waters with her way under YARD_SPEED and no hostile ship near
// (navalHost.js yardHere), said each sites step she is (SITE_CHECK_S). It says now whether she lies STILL - her own way
// under BERTH_STILL, the sea's current none of it - so the voyage is counted from where she last lay, not from the last
// moment a slow boat was in her port's waters (harbourOffice.js PORT_VOYAGE_M). And the helm let go in a port's waters is
// a berth too, still: Come Sail Away's StopSailingDelayed takes her way off at once, and a captain who brought her in at
// speed and stepped off the helm had made port - no berth had ever been said for it, so the voyage never ended.
//
// Not a DFU member (Come Sail Away has no harbourmaster; the berth is CAPT-BOARD's own).

/** Her own way (m/s) under which she lies still at a berth: her sails struck and no oar pulling, or warped to a quay. */
export const BERTH_STILL = 0.5;

/**
 * deps = {
 *   lies(boat) -> bool    she lies in a port's waters, her way under YARD_SPEED, no hostile ship near (navalHost yardHere)
 *   ownWay(boat) -> m/s   her own way through the water (the current's none of it; a boat aground none)
 *   clear() -> bool       no hostile ship near me
 *   event(ev)             the captain's (harbourOffice.js event)
 * }
 * @param {{ lies: (b: any) => boolean, ownWay: (b: any) => number, clear: () => boolean, event: (ev: any) => any }} deps
 */
export function createBerthWatch(deps) {
  /** The boat at my helm at the last step, or null. */
  let helm = /** @type {any} */ (null);
  return {
    /** A sites step: `boat` the boat at my helm (null when none), `port` the board port whose waters I stand in (null). */
    step(/** @type {any} */ boat, /** @type {{ key: string } | null | undefined} */ port) {
      if (boat && port && deps.lies(boat)) deps.event({ type: 'berth', port: port.key, boat: boat.uid ?? null, still: deps.ownWay(boat) <= BERTH_STILL });
      else if (!boat && helm && port && deps.clear()) deps.event({ type: 'berth', port: port.key, boat: helm.uid ?? null, still: true });   // the helm let go here
      helm = boat ?? null;
    },
  };
}
