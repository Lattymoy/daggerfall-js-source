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

import { crossingWaters, inVeil, inEtherLaw, landfall, HOME_WATERS, ETHER_WORD, ETHER_SEA_NAME, CROSS_LAND_PX } from '../../world/ethericSea.js';
import { t } from '../textManager.js';   // ETHER-WILD: the open sea's warning, in the player's language (L10N4)

/** The voyage, either way (days). */
export const CROSS_DAYS = 3;
/** How often the helm's waters are asked (s). */
export const CROSS_CHECK_S = 0.5;

/**
 * A MAP PIXEL'S DISTANCE TO THE NEAREST LAND (Chebyshev, map pixels), out to `reach` (CROSS_LAND_PX; Infinity past it) - by
 * the map's one water law (`seaPixel(x, y)`: scenes/world.js's), each ring of pixels about it in turn; the last pixel's
 * answer kept (the helm asks the same pixel every CROSS_CHECK_S). HOST-SPLIT (SEA VENTURES, 2026-10-22): out of bootWorld
 * whole. Answers `(px, py) => distance`.
 */
export function createCrossLand(seaPixel, reach = CROSS_LAND_PX) {
  let at = null;
  return (px, py) => {
    const key = `${px},${py}`;
    if (at?.key === key) return at.d;
    let d = Infinity;
    ring: for (let r = 0; r <= reach; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && !seaPixel(px + dx, py + dy)) { d = r; break ring; }
      }
    }
    at = { key, d };
    return d;
  };
}
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

/** A sentence in the question's rows: broken at spaces into lines of at most `width` characters (the rows above are as
 *  wide), a word longer than a line standing alone - so one key carries a whole sentence in every language. */
export function questionRows(text, width = ROW_CHARS) {
  const rows = [];
  let row = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (row && row.length + 1 + word.length > width) { rows.push(row); row = word; } else row = row ? `${row} ${word}` : word;
  }
  if (row) rows.push(row);
  return rows;
}
/** The widest row of the question's own (its first lines' measure). */
export const ROW_CHARS = 56;
/** The question, in rows (ui/yesNoBox.js). ETHER-WILD (2026-10-21): `pvp` - online, where the open sea past Veilhaven's
 *  peace is an open PvP zone (systems/wild/etherWild.js) - says so before the way out is taken. */
export function crossingRows(way, { days = CROSS_DAYS, pvp = false } = {}) {
  const time = `${days} ${days === 1 ? 'day' : 'days'}`;
  return way === 'out'
    ? ['The Abecean runs empty to every horizon, and the stars', 'hang strangely low over the water. Sailors say that past', `here the sea is no longer the sea, but the ${ETHER_WORD}.`, '', `Set a course into the open sea? (${time}. Your ship,`, 'its crew and hold go with you.)',
      ...(pvp ? ['', ...questionRows(t('sea.wild.crossWarn', 'Past Veilhaven\'s peace the open sea is an open PvP zone. Other players may attack you there.'))] : [])]
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
