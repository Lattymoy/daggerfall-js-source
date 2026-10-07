// THE TUTORIAL DUNGEON - the dungeon on the classic start's own cell (U31: settings.cfg Startup.StartCellX/Y, 109/158
// shipped: Daggerfall's Privateer's Hold), read off the CONFIGURED cell exactly as the classic start reads it, so a
// custom start cell moves it with the start. PH1 (worldModes.js, the online death's in-place respawn) asks it here;
// world.js's D-ONLINE2 respawn and its ONLINE-UNDERGROUND-LOAD1 load read the same two keys inline (pinned there by
// text). HOLD-SOLO (FIELD BUGS 2026-10-07b, the room it never shares) asks the SHIPPED cell's (isTutorialHold, below).
import { getInt } from './settings.js';
import { SETTINGS_DEFAULTS } from './settingsDefaults.js';
import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';

/** A map pixel ({ x, y }) is the classic start's cell. */
export const isStartCell = (px) => !!px && px.x === getInt('Startup', 'StartCellX') && px.y === getInt('Startup', 'StartCellY');

/** The map pixel a location (MapsFile's: its map table's longitude and latitude) stands on, or null. */
function pixelOf(loc) {
  const mt = loc?.mapTableData;
  return mt && Number.isFinite(mt.longitude) && Number.isFinite(mt.latitude) ? longitudeLatitudeToMapPixel(mt.longitude, mt.latitude) : null;
}

/** A location stands on the classic start's cell. */
export const isStartDungeon = (loc) => isStartCell(pixelOf(loc));

/** AUDIT FB1007b H1: the classic start's cell as SHIPPED (settings.cfg's own 109/158). */
export const SHIPPED_START_CELL = Object.freeze({ x: Number(SETTINGS_DEFAULTS.Startup.StartCellX), y: Number(SETTINGS_DEFAULTS.Startup.StartCellY) });

/** AUDIT FB1007b H1: THE DUNGEON NO ONE SHARES is the shipped start's - Daggerfall's Privateer's Hold - never a player's
 *  own start cell: that is a setting (the settings screen, the New Game pane), and online a setting that keyed no room
 *  took any dungeon a player named out of the shared world, fresh at every entry and its loot rolled anew. */
export function isTutorialHold(loc) {
  const px = pixelOf(loc);
  return !!px && px.x === SHIPPED_START_CELL.x && px.y === SHIPPED_START_CELL.y;
}
