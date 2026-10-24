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
// real work: `systems/map/mapTabs.js` says a town offers the streets AND
// the bay, so the held window opens on the town sheet with the world
// sheet one press away - and the travel key opens the same window on
// the other tab. Two keys, one window, and neither of them a third map.
// FB1020c STREETS-TAB: the travel key's half is built now - its window
// (ui/travel/travelMapDoor.js) holds the streets too while the player
// stands in a town, their bag the one `townSheetBag` below builds for
// the town key's, and it opens on the bay (scenes/exteriorAutomapToggle.js
// travelTown). The town key's bay is still not handed over (the travel
// guards; scenes/exteriorAutomapToggle.js says why).
//
// Static on both arms, for the reason ui/travel/travelMapDoor.js gives: the
// host drops the result into its overlay slot in the same breath, and
// a dynamic import would make the slot briefly empty.
// ═══════════════════════════════════════════════════════════════════

import { heldMapWorn } from '../map/mapSkin.js';   // MAP-TOGGLE: the skin AND the player's switch
import { ExteriorAutomapWindow, preloadExteriorAutomapArt, exteriorAutomapArtLoaded } from '../exteriorAutomapWindow.js';
import { HeldMapWindow } from '../heldMap.js';
import { yardTownBlocks } from '../../world/merchantYards/merchantYardMap.js';   // YARDS-FOUND: the town's yards on either map
import { noteFirstUse } from '../../systems/tutorials.js';   // TUT1: the first touch of a system pops its tutorial page

export { preloadExteriorAutomapArt };

/** The gate a host asks before it opens the town map. The classic
 *  window cannot draw without its native art; the enhanced sheet reads
 *  no ARENA2 raster at all - the block grids are bytes the host already
 *  holds. Same law as ui/travel/travelMapDoor.js and ui/automap/automapDoor.js. */
export function townMapDoorReady() {
  return heldMapWorn() || exteriorAutomapArtLoaded();
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
 *
 * YARDS-FOUND (2026-10-10): `yards` - the town's Stable and Wagon Yard
 * (world/merchantYards/merchantYardSites.js's sites, the location's frame) - are laid
 * on the block rows HERE, once, for whichever map is built: their ground
 * in a shop's byte and their names among the landmarks
 * (world/merchantYards/merchantYardMap.js yardTownBlocks).
 *
 * SHIPYARDS-FOUND (2026-10-11): `ports` - a port town's shipyard and
 * lighthouse (world/portSites.js's sites, the same frame) - laid the
 * same way, the lighthouse in a house's byte.
 */
export function createTownMapWindow(deps = {}) {
  noteFirstUse('automap');   // TUT1: the town's map is the same page
  if (heldMapWorn()) {
    return new HeldMapWindow({
      ...(deps.travel ?? {}),
      where: deps.where ?? (() => ({ inLocation: true })),
      openOnSheet: deps.openOnSheet ?? null,
      holder: deps.holder ?? null,   // MW-MAP1: the Morrowind arm's hands lane, where the host has an arm (combat/weapon/weaponRig.js sheetHolderOf)
      town: townSheetBag(deps),   // FB1020c STREETS-TAB: the streets' bag has one home - the travel key's window takes the same
    });
  }
  return exteriorAutomapArtLoaded() ? new ExteriorAutomapWindow(laidOn(deps)) : null;
}

/** YARDS-FOUND / SHIPYARDS-FOUND: the town's sites laid on its block rows, once, for whichever map is built - the
 *  classic window's rows and the held sheet's alike. */
function laidOn(deps) {
  if (deps.ports?.length) deps = { ...deps, blocks: yardTownBlocks(deps.blocks ?? [], deps.ports) };   // SHIPYARDS-FOUND: a port town's shipyard and lighthouse, the same way
  if (deps.yards?.length) deps = { ...deps, blocks: yardTownBlocks(deps.blocks ?? [], deps.yards) };
  return deps;
}

/**
 * FB1020c STREETS-TAB (a player's report, 2026-10-20: "citizens who mark locations on your map don't leave a mark" -
 * the mark is a building on the town's plan, and the travel key's map, which the dial's Map opens too, held no streets
 * to show it on): THE TOWN SHEET'S BAG, ONE HOME. `deps` is the town
 * key's own bag (createTownMapWindow's, above); the answer is what ui/town/townSheet.js createTownSheet takes - the
 * block rows with the town's yards and port sites laid on them, the building summaries and the discovery record the
 * talk's mark writes to, the player and the party in the location's frame, the marks. Both doors build the streets
 * from here: the town key's window (createTownMapWindow) and the travel key's (scenes/exteriorAutomapToggle.js travelTown, which
 * hands it to ui/travel/travelMapDoor.js as `town`) - so the streets one tab away on the travel map are the M key's,
 * mark for mark.
 */
export function townSheetBag(deps = {}) {
  deps = laidOn(deps);
  return {
    gridW: deps.gridW ?? 0,
    gridH: deps.gridH ?? 0,
    blocks: deps.blocks ?? [],
    buildings: deps.buildings,
    discovered: deps.discovered,
    revealAll: deps.revealAll ?? null,
    player: deps.townPlayer ?? null,
    party: deps.townParty ?? null,   // DISC23-A: the party in these streets, feet in the location's frame (the classic window ignores it)
    boards: deps.townBoards ?? null,   // TOWN-MARKS: the Notice Boards, feet in the location's frame (the classic window ignores them)
    homes: deps.townHomes ?? null,   // TOWN-MARKS: the player housing, by building key
    homesVersion: deps.townHomesVersion ?? null,
    questBuildings: deps.townQuestBuildings ?? null,   // GUIDE8's Town tier (AUDIT DELVE): the buildings a quest's journal names here
    title: deps.locationName ?? '',
  };
}
