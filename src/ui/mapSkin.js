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

/** The player's own switch (features.js, `enhanced-map`). */
export const enhancedMapOn = () => !!getPref('heldMap');

/** Has the player CHOSEN the held sheet - enhanced skin AND the switch
 *  on? The travel door's readiness asks this (the held map reads no
 *  ARENA2 art, so it is ready wherever it is chosen, headless included). */
export const heldMapChosen = () => isEnhanced() && enhancedMapOn();

/** Is the held sheet what the map doors OPEN? Chosen, AND a DOM to
 *  mount it in. */
export const heldMapWorn = () => heldMapChosen() && typeof document !== 'undefined';
