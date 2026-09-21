// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EM1 — THE TAB LAW: one map, three sheets, and where each one is
// readable.
//
// Mac (2026-09-21): "instead of 3 seperate keybinds, adding a tab
// toggle on the map itself. So if you open it in a dungeon, the world
// map would be not accessible, same for the town map."
//
// The enhanced skin had THREE map windows reached three ways - the
// dungeon automap and the building automap on the AutoMap key, the
// town map on the same key outdoors, the world map on TravelMap. They
// are ONE window now (the held parchment, ui/heldMap.js), and what is
// inked on the sheet is a TAB. This module is the only thing that says
// which tabs a place offers, because that question is asked in four
// hosts and answered on one sheet, and a fourth host that forgets is
// how a player ends up looking at a town map from inside a crypt.
//
// THE CONTEXT IS DERIVED, NOT DECLARED. A host does not say "show the
// automap tab"; it says what it IS - inside a dungeon, inside a
// building, standing in a town, out in the wilderness - off the same
// PlayerEnterExit flags every other law reads (isPlayerInsideDungeon,
// isPlayerInside) plus whether the map pixel under the player carries
// a location at all. The tabs follow.
//
// THE TABLE, and the one sentence behind it: INSIDE IS INSIDE.
//
//   dungeon      automap             a crypt offers its own plan and nothing else
//   building     automap             a shop is inside too (Mac's own answer)
//   town         town, world         the streets, and the bay you would travel
//   wilderness   world               no streets to draw and no walls to cut
//
// Pure: no DOM, no Electron, no host. The window asks it, the hosts
// feed it, and test/maptabs.test.js pins it by value and by the
// derivation - so a fifth sheet or a fifth context cannot be added in
// one place and forgotten in the other.
// ═══════════════════════════════════════════════════════════════════

/** Every sheet the one map can ink, in the order the tab strip shows
 *  them. The strip's order is this array's, so a sheet added here
 *  lands in the strip and in the availability table or the pin fails. */
export const MAP_SHEETS = Object.freeze(['automap', 'town', 'world']);

/** Every place the map can be opened from. */
export const MAP_CONTEXTS = Object.freeze(['dungeon', 'building', 'town', 'wilderness']);

/** What each context offers, in MAP_SHEETS order. */
const AVAILABLE = Object.freeze({
  dungeon: Object.freeze(['automap']),
  building: Object.freeze(['automap']),
  town: Object.freeze(['town', 'world']),
  wilderness: Object.freeze(['world']),
});

/**
 * Where the player is, in the map's own terms, off the flags every
 * host already keeps. The order of the tests IS the law: a building
 * inside a dungeon (a castle's own rooms) is the DUNGEON's, and a
 * building in a town is not the town's.
 * @param {{insideDungeon?: boolean, insideBuilding?: boolean, inLocation?: boolean}} flags
 * @returns {string} one of MAP_CONTEXTS
 */
export function mapContextOf({ insideDungeon = false, insideBuilding = false, inLocation = false } = {}) {
  if (insideDungeon) return 'dungeon';
  if (insideBuilding) return 'building';
  return inLocation ? 'town' : 'wilderness';
}

/**
 * The sheets this context offers, in strip order. An unknown context
 * offers the WORLD alone rather than nothing: a map that opens blank
 * is a bug report, and the bay is readable from anywhere the player
 * can stand.
 * @param {string} context
 * @returns {readonly string[]}
 */
export function sheetsFor(context) {
  return AVAILABLE[context] ?? AVAILABLE.wilderness;
}

/** The tab the map opens on: the first its context offers. */
export function defaultSheetFor(context) {
  return sheetsFor(context)[0];
}

/** May this sheet be inked from here? The tab strip draws every sheet
 *  and dims the rest, so this is asked per tab rather than per open. */
export function sheetAvailable(context, sheet) {
  return sheetsFor(context).includes(sheet);
}

/**
 * The sheet to land on when the map is opened with one in mind - the
 * TravelMap key asking for the world, a quest asking for the town. The
 * ask is honoured when the place offers it and dropped when it does
 * not, so no caller has to know the table.
 * @param {string} context
 * @param {string|null} wanted
 * @returns {string}
 */
export function openOn(context, wanted = null) {
  return wanted && sheetAvailable(context, wanted) ? wanted : defaultSheetFor(context);
}
