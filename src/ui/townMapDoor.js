// ═══════════════════════════════════════════════════════════════════
// EM4 — THE TOWN MAP DOOR: which map the AutoMap key opens in a city,
// and the ONE place that builds either.
//
// The eighth seam of this shape (U50 chargen, U51 pause, U52 sheet,
// U53 pack, U61 the travel map, EM3 the dungeon automap, plus the front
// door itself): the classic skin gets DFU's own rotating town map, the
// enhanced skin gets THE HELD MAP with the town's plan traced onto the
// parchment and its names set in the hand the Iliac Bay's are.
//
// THE CLASSIC WINDOW IS NOT RETIRED. `ui/exteriorAutomapWindow.js`
// keeps its camera, its rotation, its compass, its console verbs and
// all of its pins; a departure here is a departure only where the
// enhanced skin is worn.
//
// A TOWN OFFERS TWO TABS, which is the first place Mac's tab law does
// real work: `systems/mapTabs.js` says a town offers the streets AND
// the bay, so the held window opens on the town sheet with the world
// sheet one press away - and the travel key opens the same window on
// the other tab. Two keys, one window, and neither of them a third map.
//
// Static on both arms, for the reason ui/travelMapDoor.js gives: the
// host drops the result into its overlay slot in the same breath, and
// a dynamic import would make the slot briefly empty.
// ═══════════════════════════════════════════════════════════════════

import { isEnhanced } from '../systems/uiSkin.js';
import { ExteriorAutomapWindow, preloadExteriorAutomapArt, exteriorAutomapArtLoaded } from './exteriorAutomapWindow.js';
import { HeldMapWindow } from './heldMap.js';

export { preloadExteriorAutomapArt };

/** The gate a host asks before it opens the town map. The classic
 *  window cannot draw without its native art; the enhanced sheet reads
 *  no ARENA2 raster at all - the block grids are bytes the host already
 *  holds. Same law as ui/travelMapDoor.js and ui/automapDoor.js. */
export function townMapDoorReady() {
  return (isEnhanced() && typeof document !== 'undefined') || exteriorAutomapArtLoaded();
}

/**
 * Build the town map this skin wears.
 *
 * `deps` is ExteriorAutomapWindow's own bag plus the two keys the
 * classic arm ignores: `where` (the flags mapTabs derives the tab
 * context from) and `travel` (the world sheet's bag, so the bay tab is
 * live from a town). A host that already opens the classic window adds
 * nothing but those.
 *
 * Answers null where this build cannot draw a map, so the hosts'
 * `if (win)` guards keep meaning.
 */
export function createTownMapWindow(deps = {}) {
  if (isEnhanced() && typeof document !== 'undefined') {
    return new HeldMapWindow({
      ...(deps.travel ?? {}),
      where: deps.where ?? (() => ({ inLocation: true })),
      openOnSheet: deps.openOnSheet ?? null,
      holder: deps.holder ?? null,   // MW-MAP1: the Morrowind arm's hands lane, where the host has an arm (combat/weaponRig.js sheetHolderOf)
      town: {
        gridW: deps.gridW ?? 0,
        gridH: deps.gridH ?? 0,
        blocks: deps.blocks ?? [],
        buildings: deps.buildings,
        discovered: deps.discovered,
        revealAll: deps.revealAll ?? null,
        player: deps.townPlayer ?? null,
        title: deps.locationName ?? '',
      },
    });
  }
  return exteriorAutomapArtLoaded() ? new ExteriorAutomapWindow(deps) : null;
}
