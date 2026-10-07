// THE TUTORIAL DUNGEON - the dungeon on the classic start's own cell (U31: settings.cfg Startup.StartCellX/Y, 109/158
// shipped: Daggerfall's Privateer's Hold), read off the CONFIGURED cell exactly as the classic start reads it, so a
// custom start cell moves it with the start. PH1 (worldModes.js, the online death's in-place respawn) and HOLD-SOLO
// (FIELD BUGS 2026-10-07b, the room it never shares) ask it here; world.js's D-ONLINE2 respawn and its
// ONLINE-UNDERGROUND-LOAD1 load read the same two keys inline (pinned there by text).
import { getInt } from './settings.js';
import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';

/** A map pixel ({ x, y }) is the classic start's cell. */
export const isStartCell = (px) => !!px && px.x === getInt('Startup', 'StartCellX') && px.y === getInt('Startup', 'StartCellY');

/** A location (MapsFile's: its map table's longitude and latitude) stands on the classic start's cell. */
export function isStartDungeon(loc) {
  const mt = loc?.mapTableData;
  return !!mt && Number.isFinite(mt.longitude) && Number.isFinite(mt.latitude)
    && isStartCell(longitudeLatitudeToMapPixel(mt.longitude, mt.latitude));
}
