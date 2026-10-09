// MAP-TOGGLE (2026-09-22, Mac: "Yes needs to be a toggle"): THE ONE
// QUESTION the three map doors ask - is the HELD map worn, or the
// classic windows? Until now the answer was the UI skin alone
// (ui/automapDoor.js, ui/townMapDoor.js, ui/travelMapDoor.js each
// forked on `isEnhanced()`), so a player who wanted DFU's own maps
// under the enhanced skin had to leave the whole skin. The Features
// home carries the switch now (`enhanced-map`, prefs `heldMap`, on
// by default), and this is where the three doors read it - one law,
// three callers, the shape quickLootOn/fpLightingOn already take.
//
// The skin still bounds it: the classic skin never wears the held map
// (the row's kinds say `enhanced`), and `document` for the reason every
// door gives - node drives the hosts headless and keeps the canvas
// window rather than getting a special case written for it.
import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';
import { pageParam } from '../systems/pageQuery.js';   // PERF-URL: the page's query, parsed once a search

/** The player's own switch (features.js, `enhanced-map`). */
export const enhancedMapOn = () => !!getPref('heldMap');

/** Has the player CHOSEN the held sheet - enhanced skin AND the switch
 *  on? The travel door's readiness asks this (the held map reads no
 *  ARENA2 art, so it is ready wherever it is chosen, headless included). */
export const heldMapChosen = () => isEnhanced() && enhancedMapOn();

/** Is the held sheet what the map doors OPEN? Chosen, AND a DOM to
 *  mount it in. */
export const heldMapWorn = () => heldMapChosen() && typeof document !== 'undefined';

/** EM3-3D (2026-09-27, Mac: "making the map like the og one in 3d again but only handrawn"): the held map's dungeon
 *  sheet is drawn in the round - turned, tilted and zoomed as DFU's 3D automap is - and V lays it flat as the plan.
 *  Mac: "The dungeon map becomes the new default option, the current 2d enhanced becomes an option, not removed" -
 *  the player's switch (features.js `dungeon-map-3d`, prefs `dungeonMap3d`, on by default) chooses it, and off is
 *  EM3's flat plan. `?dungeonmap=flat` stays the kill door. Both are read where the sheet is built, at each open. */
const dungeonMapUrlFlat = () => {
  try { return pageParam('dungeonmap') === 'flat'; } catch { return false; }   // PERF-URL
};
export const dungeonMap3dOn = () => getPref('dungeonMap3d') !== false && !dungeonMapUrlFlat();

/** TAMRIEL1 (2026-10-08, Mac: "the entirety of tamriel ... seen by players ingame"): the held map's world sheet zooms
 *  out past the Bay onto the whole continent (ui/tamrielInk.js), the Features row `tamriel-map` (prefs `tamrielMap`,
 *  on by default). Read where the window is built, so a change takes the next map opened. `?tamriel=off` is the kill
 *  door. */
const tamrielUrlOff = () => {
  try { return pageParam('tamriel') === 'off'; } catch { return false; }
};
export const tamrielMapOn = () => getPref('tamrielMap') !== false && !tamrielUrlOff();
