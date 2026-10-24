// THE TUTORIAL DUNGEON - the dungeon on the classic start's own cell (U31: settings.cfg Startup.StartCellX/Y, 109/158
// shipped: Daggerfall's Privateer's Hold), read off the CONFIGURED cell exactly as the classic start reads it, so a
// custom start cell moves it with the start. PH1 (worldModes.js, the online death's in-place respawn) asks it here;
// world.js's D-ONLINE2 respawn and its ONLINE-UNDERGROUND-LOAD1 load read the same two keys inline (pinned there by
// text). HOLD-SOLO (FIELD BUGS 2026-10-07b) took the shipped cell's dungeon out of the shared world; HOLD-SHARED
// (2026-10-12) put it back, and nothing here keys a room. HOLD-ONCE (2026-10-12) asks isPrivateersHold, below: the Hold
// itself by its map id, never the configured cell.
import { getInt } from './settings/settings.js';
import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { PRIVATEERS_HOLD_MAP_ID } from '../world/dungeon/dungeonTextures.js';

/** A map pixel ({ x, y }) is the classic start's cell. */
export const isStartCell = (px) => !!px && px.x === getInt('Startup', 'StartCellX') && px.y === getInt('Startup', 'StartCellY');

/** The map pixel a location (MapsFile's: its map table's longitude and latitude) stands on, or null. */
function pixelOf(loc) {
  const mt = loc?.mapTableData;
  return mt && Number.isFinite(mt.longitude) && Number.isFinite(mt.latitude) ? longitudeLatitudeToMapPixel(mt.longitude, mt.latitude) : null;
}

/** A location stands on the classic start's cell. */
export const isStartDungeon = (loc) => isStartCell(pixelOf(loc));

/** HOLD-ONCE: a location is Daggerfall's Privateer's Hold - by its map id, so a custom start cell (a setting) moves
 *  the classic start and PH1 but never which dungeon is the Hold. */
export const isPrivateersHold = (loc) => ((loc?.mapTableData?.mapId ?? 0) >>> 0) === PRIVATEERS_HOLD_MAP_ID;

/** HOLD-ONCE: the word at a way back into the Hold, refused online. */
export const HOLD_ONCE_TEXT = 'You cannot go back into Privateer\'s Hold.';

