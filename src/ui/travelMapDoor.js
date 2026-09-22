// ═══════════════════════════════════════════════════════════════════
// U61 — THE TRAVEL MAP DOOR: which map the travel key opens, and the
// ONE place that builds either.
//
// The sixth seam of this shape (U50 chargen, U51 pause, U52 sheet,
// U53 pack, plus the front door itself): the classic skin gets DFU's
// TRAV0I00 window, the enhanced skin gets THE HELD MAP - Mac's own
// sprite of two hands holding a parchment, with the Iliac Bay inked
// onto the sheet at runtime (MAP1; ui/heldMap.js's header carries the
// design, bible/10-UI/Held-Map-Arc.md the arc). It replaced the 3D
// relief map (ui/overworldMap.js, RETIRED 2026-09-18) whole.
//
// Both skins ride world.js's ONE construction seam
// (buildTravelMapWindow): the host says what it HAS - maps, mapDict,
// woods, the gold and transport hooks - and never which map that adds
// up to.
//
// UNLIKE the DOM doors this fork is a STATIC import on both arms: the
// held-map window must answer gotoPlace/activateTeleportationTravel
// synchronously (the journal and the guild service call them on the
// window the same breath they open it), and its heavy half - the ink
// chains - is already lazy behind the first tick. A dynamic import
// here would buy nothing and cost the one-shot contract.
// ═══════════════════════════════════════════════════════════════════

import { heldMapWorn, heldMapChosen } from './mapSkin.js';   // MAP-TOGGLE: the skin AND the player's switch
import {
  TravelMapWindow, preloadTravelMapArt, travelMapArtLoaded, canFindPlace,
} from './travelMapWindow.js';
import { HeldMapWindow } from './heldMap.js';

export { preloadTravelMapArt, travelMapArtLoaded, canFindPlace };

/** The gate a host asks before it opens the map. The classic window
 *  cannot draw without TRAV0I00 and its region pages; the enhanced
 *  one reads no ARENA2 art at all - its data (WOODS, MAPS, the PAKs)
 *  is what the world host already booted on, and its one picture is
 *  the port's own sprite, fetched by the window itself - so a host
 *  that can hand the dep bag can open it. Same law as
 *  ui/charSheetDoor.js. */
export function travelMapDoorReady() {
  return heldMapChosen() || travelMapArtLoaded();
}

/**
 * Build the map this skin wears. `deps` is TravelMapWindow's own bag
 * plus `woods`; the classic window ignores the extra key. Answers
 * null where this build cannot draw a map - the classic arm without
 * its art - so the hosts' `if (win)` guards keep meaning.
 *
 * SOC6 (Mac: "Party members should be able to be seen on the world
 * map, regardless of their location"): the bag also takes an optional
 * `party: () => [{acct, name, px, py, in, loc, online, leader}]`, and
 * BOTH arms take it - the held map as green rings with names in ink,
 * the classic one as green dots on the region page. It is a FUNCTION, read
 * on each window's own refresh, because a party changes while a map is
 * open; a host with no party (offline, solo, or any host that never
 * heard of the hub) passes none and both maps draw none.
 */
export function createTravelMapWindow(deps = {}) {
  // `document` for the reason every fork before this one gives: node
  // drives these hosts headless and keeps the canvas window rather
  // than getting a special case written for it.
  if (heldMapWorn()) {
    return new HeldMapWindow(deps);
  }
  return travelMapArtLoaded() ? new TravelMapWindow(deps) : null;
}
