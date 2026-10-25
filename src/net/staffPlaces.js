// @ts-check
// STAFF-EVENT (2026-10-24, mob: "needs to be bale to select a town or area for these events"; net/staffEvent/
// staffEventLaw.js, bible/11-Multiplayer/Staff-Events.md) - THE STAFF PANEL'S PLACE PICKER, the game's half. The places
// are the player's own game data (MAPS.BSA), never in the panel nor in this repository, so the panel over the game asks
// the game: a region's named places (each its location index, name, kind and map pixel), and where the staff member
// stands now (region, the location they stand in or -1, the map pixel). Read off the maps the game loaded, nothing new.
//
// The door's words (net/staffHook.js staffHookDoor):
//   { dfoStaff: 'places?', region } -> { dfoStaff: 'places', region, name, list: [{ loc, name, kind, px, py }] }
//   { dfoStaff: 'here?' }           -> { dfoStaff: 'here', region, name, loc, place, px, py } (region null: no map yet)
import { LOCATION_TYPES, longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { CHAT_REGION_COUNT } from './wire.js';

/** A region index the politic map has, or null (staffMap.js regionOf's, kept here: staffMap.js imports the hook). @param {unknown} r */
const regionOf = (r) => (Number.isInteger(r) && /** @type {number} */ (r) >= 0 && /** @type {number} */ (r) < CHAT_REGION_COUNT ? /** @type {number} */ (r) : null);

let _maps = /** @type {any} */ (null);
/** The game's maps, kept as the boot makes them (scenes/world.js) - so the door reads them with no wiring of its own. @template T @param {T} m @returns {T} */
export const gameMaps = (m) => { _maps = m; return m; };
/** The maps kept, or null (a page with no game). */
export const keptMaps = () => _maps;

/** The most places one answer carries (the largest region has fewer). */
export const STAFF_PLACES_MAX = 2000;

/** A location type's word, as the panel groups it. */
const KIND = /** @type {Map<number, string>} */ (new Map(Object.entries(LOCATION_TYPES).map(([k, v]) => [v, k])));
export const placeKind = (/** @type {number} */ t) => {
  const k = KIND.get(t) ?? 'None';
  return k.startsWith('Town') ? 'town' : k.startsWith('Dungeon') ? 'dungeon' : k.startsWith('Home') ? 'home' : k.startsWith('Religion') || k === 'Coven' ? 'temple' : k === 'Tavern' ? 'tavern' : k === 'Graveyard' ? 'graveyard' : 'other';
};

/**
 * A region's named places - towns first, then the rest, each by name.
 * @param {any} maps the game's MapsFile @param {unknown} r
 */
export function staffPlaces(maps, r) {
  const region = regionOf(r);
  if (region === null || !maps?.getRegion) return { dfoStaff: 'places', region, name: null, list: [] };
  const g = maps.getRegion(region);
  const table = g?.mapTable ?? [];
  const base = typeof maps.baseLocationCount === 'function' ? Math.min(table.length, maps.baseLocationCount(region)) : table.length;
  const list = [];
  for (let k = 0; k < base && list.length < STAFF_PLACES_MAX; k++) {
    const row = table[k];
    const name = String(g.mapNames?.[k] ?? '');
    if (!row || !name) continue;
    const p = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
    list.push({ loc: k, name: name.slice(0, 48), kind: placeKind(row.locationType), px: p.x, py: p.y });
  }
  list.sort((a, b) => Number(b.kind === 'town') - Number(a.kind === 'town') || a.name.localeCompare(b.name));
  return { dfoStaff: 'places', region, name: String(maps.getRegionName?.(region) ?? '').slice(0, 64) || null, list };
}

/**
 * Where the staff member stands: their map pixel's region, and the place there (a location on this pixel), or -1, and
 * its kind (a town is said as a city).
 * @param {any} maps @param {{ x: number, y: number } | null} px
 */
export function staffHere(maps, px) {
  const none = { dfoStaff: 'here', region: null, name: null, loc: -1, place: null, kind: null, px: null, py: null };
  if (!maps?.getRegionIndexAt || !px || !Number.isInteger(px.x) || !Number.isInteger(px.y)) return none;
  const region = regionOf(maps.getRegionIndexAt(px.x, px.y));
  if (region === null) return { ...none, px: px.x, py: px.y };
  const at = staffPlaces(maps, region).list.find((p) => p.px === px.x && p.py === px.y) ?? null;
  return { dfoStaff: 'here', region, name: String(maps.getRegionName?.(region) ?? '').slice(0, 64) || null, loc: at ? at.loc : -1, place: at?.name ?? null, kind: at?.kind ?? null, px: px.x, py: px.y };
}
