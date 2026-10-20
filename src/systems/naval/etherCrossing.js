// @ts-check
// ETHER-CROSSING (2026-10-11, the owner: "Sail far enough and you are prompted to travel into the open sea";
// bible/03-World/Eltheric-Ocean.md ETHER-CROSSING) - THE CROSSING: when it is offered, what it asks, what it takes. Pure: the
// world host (scenes/world.js) asks it of the helm's pixel and sails the voyage.
//
// OFFERED at a helm, under way or not, with no enemy near and no other player aboard: OUT on the open Abecean - the
// crossing waters (world/ethericSea.js crossingWaters: west of CROSS_X, CROSS_LAND_PX pixels and more from any land) -
// and HOME in the Veil. Once a way is asked and refused it is not asked again until the ship has left those waters
// (`createCrossingGate`): a captain who said no is not nagged at every swell.
//
// THE VOYAGE takes CROSS_DAYS (the clock's, as a journey's), and carries the captain, the ship at whose helm they stand,
// her crew and her hold: out to the open water off Veilhaven's quay, her bow on it; home to the Bay's waters the last
// crossing out set sail from (the ledger's), or the open Abecean off the Bay's mouth.

import { crossingWaters, inVeil, inEtherLaw, landfall, HOME_WATERS, ETHER_WORD, ETHER_SEA_NAME } from '../../world/ethericSea.js';

/** The voyage, either way (days). */
export const CROSS_DAYS = 3;
/** How often the helm's waters are asked (s). */
export const CROSS_CHECK_S = 0.5;

/** The way a helm's waters offer: 'out' (the crossing waters), 'home' (the Veil), or null. `landPx` the pixel's distance
 *  to the nearest land (the host's). */
export function crossingWayAt(px, py, landPx) {
  if (inVeil(px, py)) return 'home';
  if (crossingWaters(px, py, landPx)) return 'out';
  return null;
}

/** THE GATE: `offer(way)` answers whether to ask now - a way not asked since the ship came into its waters; `asked(way)`
 *  remembers it asked until the waters are left (`offer(null)` - or another way's waters - forgets it). AUDIT CAPTAIN'S
 *  SEA H13: the doc named a `refused`; X1: the host marks it asked only when the box shows. */
export function createCrossingGate() {
  let asked = null;
  return {
    offer(way) {
      if (way !== asked) asked = null;
      return !!way && asked == null;
    },
    asked(way) { asked = way ?? null; },
    get pending() { return asked; },
  };
}

/** Where a voyage makes landfall: out, off Veilhaven; home, the Bay's waters she set sail from, else the open Abecean
 *  (AUDIT CAPTAIN'S SEA X2: never a way out that lies in the Eltheric Ocean's own law). */
export function crossingTarget(way, from = null) {
  if (way === 'out') return landfall();
  return from && Number.isFinite(from.px) && Number.isFinite(from.py) && !inEtherLaw(from.px, from.py) ? { px: from.px, py: from.py } : { px: HOME_WATERS.px, py: HOME_WATERS.py };
}

/** The question, in rows (ui/yesNoBox.js). */
export function crossingRows(way, { days = CROSS_DAYS } = {}) {
  const time = `${days} ${days === 1 ? 'day' : 'days'}`;
  return way === 'out'
    ? ['The Abecean runs empty to every horizon, and the stars', 'hang strangely low over the water. Sailors say that past', `here the sea is no longer the sea, but the ${ETHER_WORD}.`, '', `Set a course into the open sea? (${time}. Your ship,`, 'its crew and hold go with you.)']
    : ['Ahead the Veil thins, and through it, faint as a memory,', 'lie the gray waters of the Iliac Bay.', '', `Set a course for home? (${time})`];
}
/** What the screen says at the landfall. */
export const crossingWords = (way) => (way === 'out'
  ? `Three days out of sight of land, and then the stars came down to meet the sea. You have crossed into ${ETHER_SEA_NAME}. Veilhaven lies ahead.`
  : 'The Veil closes astern, and the air smells of salt and tar again. The Iliac Bay, and home.');
/** Why a crossing is not asked (said once in those waters; AUDIT CAPTAIN'S SEA X1: asked as soon as the deck is clear,
 *  as the words promise - the refusal once marked the way asked, and the question never came back in those waters). */
export const CROSS_REFUSED = Object.freeze({
  passengers: 'Passengers can\'t cross the Veil. The crossing waits until no one else is aboard.',
  hostile: 'Not with an enemy at your heels.',
});
/** AUDIT CAPTAIN'S SEA X2: a Yes to a question the waters no longer ask (a load, a new helm, waters left) - said, and no
 *  voyage. */
export const CROSS_STALE = 'The moment has passed. Return to the crossing waters to be asked again.';
/** AUDIT CAPTAIN'S SEA X9: a voyage that could not be made - the ship and her captain where they set out. */
export const CROSS_FAILED = 'The crossing failed. You are back where you started.';
