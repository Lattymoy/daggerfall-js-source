// ═══════════════════════════════════════════════════════════════════
// EM3 — THE AUTOMAP DOOR: which map the AutoMap key opens underground,
// and the ONE place that builds either.
//
// The seventh seam of this shape (U50 chargen, U51 pause, U52 sheet,
// U53 pack, U61 the travel map, plus the front door itself): the
// classic skin gets DFU's own 3D automap panel, the enhanced skin gets
// THE HELD MAP with its automap sheet inked on the parchment - the
// dungeon's plan in the pen that drew the Iliac Bay, one storey at a
// time (EM3; ui/automapSheet.js's header carries the design,
// bible/10-UI/Enhanced-Maps-Arc.md the arc).
//
// THE CLASSIC WINDOW IS NOT RETIRED. `Held-Map-Arc.md`'s own law: a
// departure from DFU is a departure only where the enhanced skin is
// worn. `ui/automapWindow.js` keeps its 3D pass, its cut plane, its
// chrome, its console verbs and all of its pins.
//
// THE DEP BAGS DO NOT OVERLAP, which is why this is a fork and not a
// wrapper. The 3D window wants GPU meshes, draw lists, a texture remap,
// an arrow mesh and a camera; the sheet wants the reveal RECORD and the
// reveal INDEX and nothing else - it draws CPU triangles onto a canvas.
// So each arm is handed what it needs and the host hands both, which
// costs the host nothing: every field here is already on its bag.
//
// Like ui/travelMapDoor.js this is a STATIC import on both arms. The
// host opens this window from a key handler and drops the result into
// its overlay slot in the same breath; a dynamic import would make the
// slot briefly empty, which every host's `if (win)` guard reads as
// "no map".
// ═══════════════════════════════════════════════════════════════════

import { heldMapWorn } from './mapSkin.js';   // MAP-TOGGLE: the skin AND the player's switch
import { AutomapWindow, preloadAutomapArt, automapArtLoaded } from './automapWindow.js';
import { HeldMapWindow } from './heldMap.js';

export { preloadAutomapArt };

/** The gate a host asks before it opens the automap. The classic panel
 *  cannot draw without its native art; the enhanced sheet reads no
 *  ARENA2 raster at all - its data is the reveal index the host already
 *  keeps, and its one picture is the port's own sprite, fetched by the
 *  window itself. Same law as ui/travelMapDoor.js and ui/charSheetDoor.js. */
export function automapDoorReady() {
  return heldMapWorn() || automapArtLoaded();
}

/**
 * Build the automap this skin wears.
 *
 * `deps` is AutomapWindow's own bag plus two keys the classic arm
 * ignores: `where` (the flags systems/mapTabs.js derives the tab
 * context from) and `title` (what the strip calls this place). The
 * enhanced arm takes the reveal record and the reveal index off the
 * same bag, so a host that already opens the 3D map needs to add
 * nothing but those two.
 *
 * Answers null where this build cannot draw a map - the classic arm
 * without its art - so the hosts' `if (win)` guards keep meaning.
 */
export function createAutomapWindow(deps = {}) {
  // `document` for the reason every fork before this one gives: node
  // drives these hosts headless and keeps the canvas window rather than
  // getting a special case written for it.
  if (heldMapWorn()) {
    return new HeldMapWindow({
      where: deps.where ?? (() => ({ insideDungeon: !deps.insideBuilding, insideBuilding: !!deps.insideBuilding })),
      holder: deps.holder ?? null,   // MW-MAP1: the Morrowind arm's hands lane, where the host has an arm (combat/weaponRig.js sheetHolderOf)
      automap: {
        record: deps.record,
        model: () => deps.model ?? null,
        player: deps.player,
        startMarker: deps.startMarker ?? null,
        insideBuilding: !!deps.insideBuilding,
        title: deps.title ?? deps.dungeonName ?? '',
        party: deps.party ?? null,   // DISC23-A: the party members whose bodies stand in this level (the classic 3D arm ignores it)
      },
    });
  }
  return automapArtLoaded() ? new AutomapWindow(deps) : null;
}
