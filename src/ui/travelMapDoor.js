// ═══════════════════════════════════════════════════════════════════
// U61 — THE TRAVEL MAP DOOR: which map the travel key opens, and the
// ONE place that builds either.
//
// The sixth seam of this shape (U50 chargen, U51 pause, U52 sheet,
// U53 pack, plus the front door itself), and the first whose enhanced
// side is a GL window rather than a DOM twin: the classic skin gets
// DFU's TRAV0I00 window, the enhanced skin gets THE OVERWORLD - the
// whole Iliac Bay as a live relief the camera climbs to and flies
// across (ui/overworldMap.js's header carries the design).
//
// Both skins ride world.js's ONE construction seam
// (buildTravelMapWindow): the host says what it HAS - maps, mapDict,
// woods, the gold and transport hooks - and never which map that adds
// up to.
//
// UNLIKE the DOM doors this fork is a STATIC import on both arms: the
// overworld window must answer gotoPlace/activateTeleportationTravel
// synchronously (the journal and the guild service call them on the
// window the same breath they open it), and its heavy half - the
// relief build and the GL programs - is already lazy behind the first
// draw() frame, which the ascent's cloud veil covers. A dynamic
// import here would buy nothing and cost the one-shot contract.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import {
  TravelMapWindow, preloadTravelMapArt, travelMapArtLoaded, canFindPlace,
} from './travelMapWindow.js';
import { OverworldMapWindow } from './overworldMap.js';

export { preloadTravelMapArt, travelMapArtLoaded, canFindPlace };

/** The gate a host asks before it opens the map. The classic window
 *  cannot draw without TRAV0I00 and its region pages; the enhanced
 *  one reads no ART at all - its data (WOODS, MAPS, the PAKs) is what
 *  the world host already booted on, so a host that can hand the dep
 *  bag can open it. Same law as ui/charSheetDoor.js. */
export function travelMapDoorReady() {
  return isEnhanced() || travelMapArtLoaded();
}

/**
 * Build the map this skin wears. `deps` is TravelMapWindow's own bag
 * plus `woods`; the classic window ignores the extra key. Answers
 * null where this build cannot draw a map - the classic arm without
 * its art - so the hosts' `if (win)` guards keep meaning.
 */
export function createTravelMapWindow(deps = {}) {
  // `document` for the reason every fork before this one gives: node
  // drives these hosts headless and keeps the canvas window rather
  // than getting a special case written for it.
  if (isEnhanced() && typeof document !== 'undefined') {
    return new OverworldMapWindow(deps);
  }
  return travelMapArtLoaded() ? new TravelMapWindow(deps) : null;
}
