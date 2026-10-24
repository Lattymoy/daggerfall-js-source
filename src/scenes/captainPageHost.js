// @ts-check
// CAPT-LOG / CAPTAIN-TREE - THE CAPTAIN PAGE'S HOST HALF (HOST-SPLIT, 2026-10-17: out of scenes/world.js bootWorld, whose
// ceiling the ship's livery's wiring needed the room of; bible/03-World/Captains-Sea.md CAPT-LOG, Naval-Refit.md
// CAPTAIN-TREE). The Captain page (ui/captainPage.js) reads a model and opens the captain's stars; this builds the one
// and opens the other over the world host's runtimes - the captain's ledger (systems/naval/captainLedger.js), the sea
// fight's notoriety, the harbour office's contracts and charts.
//
//   deps = {
//     ledger              the captain's ledger (one a world host)
//     naval() -> the naval host | null             its notoriety in each crown's waters
//     office() -> the harbour office               its contracts held and charts marked, as the page reads them
//     minutes() -> the captain's own clock (minutes) - the letter's days
//     show(overlay)       the host's slot for a window (townTalk.showOverlay)
//     changed()           a sky accepted: every boat of mine read again on it, and the save told
//   }
import { perksOf, PERKS_REFUSED_AT, logLines } from '../systems/naval/captainLedger.js';
import { createCaptainStarsOverlay } from '../ui/naval/navalPlunderDoor.js';   // CAPTAIN-TREE: the stars' window

/** @param {{ ledger: any, naval: () => any, office: () => any, minutes: () => number, show: (overlay: any) => void, changed: () => void }} deps */
export function createCaptainPageHost(deps) {
  /** The page's model - each crown's standing, rank and favours (none while it hunts me), the letter of marque held and
   *  its days, the contracts under way (CAPT-BOARD), the caches marked (CAPT-CHARTS), the log in words, and (CAPTAIN-TREE)
   *  her level and the stars set of her points. */
  function model() {
    const L = deps.ledger, at = Math.floor(deps.minutes());   // the captain's own clock, the letter's
    const mq = L.marque(at);
    return {
      crowns: L.crowns().map((c) => { const n = deps.naval()?.notorietyOf?.(c.crown) ?? 0; return { ...c, notoriety: n, perks: perksOf(c.rank.rank, n) }; }),
      refusedAt: PERKS_REFUSED_AT,
      marque: mq ? { crown: mq.crown, days: Math.max(1, Math.ceil((mq.until - at) / 1440)) } : null,
      contracts: deps.office().pageContracts(),
      charts: deps.office().pageCharts(),
      log: logLines(L.log),
      stars: { ...L.captain(), set: L.tree().length - 1 },
    };
  }
  /** CAPTAIN-TREE: the captain's stars over the world (ui/captainTreeWindow.js, through the sea's window door) - answers
   *  whether it opened. */
  function openStars() {
    const w = createCaptainStarsOverlay({ ledger: deps.ledger, changed: deps.changed });
    if (w) deps.show(w);
    return !!w;
  }
  /** GROWTH3 (bible/10-UI/Growth.md section 6): what the captain's stars want drawn in the pause window's Growth tab -
   *  the ledger they are set on and the word that a sky was accepted (ui/captainTreeWindow.js's own deps). */
  const stars = () => ({ ledger: deps.ledger, changed: deps.changed });
  return { model, openStars, stars };
}
