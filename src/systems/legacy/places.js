// @ts-check
// LEGACY1 (bible/06-Systems/Legacy-Arc.md section 4): THE HEIR IS BORN IN A TOWN. Project Legacy's `Teleport` threw
// the heir to a coordinate pair taken from two DIFFERENT entries of its forty (B11) - often the sea - and its retry
// re-rolled instead of searching near. The port names a PLACE: a town (a city, a hamlet or a village, MapsFile's
// LocationTypes), which the boot stands the heir in through its own `?region=&loc=` start - BAY-LEFT-B: and `seat`, the
// town's map id, by which the boot stands a seat past the Bay (scenes/bootStartHost.js).
//
// Pure over a region's tables (formats/mapsFile.js dfRegion: `mapTable[i]` and `mapNames[i]`), and over the world's
// nearest town (nearestTownAnywhere: the host's law over the world's registry).
import { LOCATION_TYPES, longitudeLatitudeToMapPixel } from '../../formats/mapsFile.js';

const TOWN_TYPES = new Set([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
export const isTownEntry = (e) => !!e && TOWN_TYPES.has(e.locationType);

/** The town standing ON `pixel` in this region, as `{ region, loc }`, or null. */
export function townAt(dfRegion, regionName, pixel) {
  const table = dfRegion?.mapTable ?? [];
  for (let i = 0; i < table.length; i++) {
    const e = table[i];
    if (!isTownEntry(e)) continue;
    const px = longitudeLatitudeToMapPixel(e.longitude, e.latitude);
    if (px.x === pixel?.x && px.y === pixel?.y) return { region: String(regionName), loc: String(dfRegion.mapNames?.[i] ?? '') };
  }
  return null;
}

/** The nearest town to `pixel` in this region by map-pixel distance, as `{ region, loc, pixel }`, or null. */
export function nearestTown(dfRegion, regionName, pixel) {
  const table = dfRegion?.mapTable ?? [];
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < table.length; i++) {
    const e = table[i];
    if (!isTownEntry(e) || !dfRegion.mapNames?.[i]) continue;
    const px = longitudeLatitudeToMapPixel(e.longitude, e.latitude);
    const d = (px.x - pixel.x) ** 2 + (px.y - pixel.y) ** 2;
    if (d < bestD) { bestD = d; best = { region: String(regionName), loc: String(dfRegion.mapNames[i]), pixel: px }; }
  }
  return best;
}

/** A town's kind as the world's nearest safe place names it (systems/deathRespawn.js SAFE_KINDS: a city, a hamlet and a
 *  village are each a `city`). */
const TOWN_KIND = 'city';
/**
 * The nearest town of THE WORLD (the open sea's region holds none - deathRespawn's SEA-RISE lesson). BAY-LEFT-B: it
 * walked MAPS.BSA's 62 regions, so a house that fell past the Bay with no seat bore its heir in a Bay town hundreds of
 * pixels away. Now the world's law: `nearestOf(pixel, accept)` is the host's nearest safe place of the world
 * (scenes/tamrielPlacesHost.js nearestTownOf - the registry's places, the Bay's MAPS.BSA rows and those past the Bay, and
 * the countryside's towns the session stood; systems/deathRespawn.js nearestSafePlace), a named town alone. Answers
 * `{ region, loc, pixel, mapId }`, or null.
 * @param {(pixel: { x: number, y: number }, accept: (hit: any) => boolean) => any} nearestOf
 * @param {readonly string[]} regionNames @param {{ x: number, y: number }} pixel
 */
export function nearestTownAnywhere(nearestOf, regionNames, pixel) {
  const p = pixel ? nearestOf?.(pixel, (hit) => hit.kind === TOWN_KIND && !!hit.place?.name)?.place : null;
  if (!p) return null;
  return { region: String(regionNames[p.region] ?? ''), loc: String(p.name), pixel: { x: p.px, y: p.py }, ...(Number.isFinite(p.mapId) ? { mapId: p.mapId >>> 0 } : {}) };
}

/** The boot's address for a birth: the page's own search with the load doors dropped and the birth's added - and the
 *  world host's scene door (`?world`, main.js), so the reload goes straight to the world as realmBootSearch's does: the
 *  front door would clear the menu's keys and ask again, and the birth would be lost behind it. LEGACY7: an online page's
 *  birth is the realm's (`realmnew`), as any character born online is. BAY-LEFT-B: and the town's map id (`seat`,
 *  LEGACY-HOME's kept id) where the place knows it - a seat past the Bay is in no MAPS.BSA table, and the boot stands it
 *  by its id (scenes/bootStartHost.js). */
export function birthSearch(search, personId, place) {
  const p = new URLSearchParams(search);
  for (const k of ['load', 'loadkey', 'classicload', 'classic', 'class', 'test', 'realm', 'realmnew', 'spawn', 'legacyborn', 'seat', 'start']) p.delete(k);   // AUDIT STARTS W8: and a dev boot's start - an heir is born where their birth names
  p.set('world', '1');
  if (p.has('online')) p.set('realmnew', '1');   // LEGACY7: online, a member is born into the realm (scenes/world.js legacyRealmBirth)
  p.set('legacyborn', String(personId));
  if (place?.region) p.set('region', place.region);
  if (place?.loc) p.set('loc', place.loc);
  if (Number.isInteger(place?.mapId)) p.set('seat', String(place.mapId >>> 0));   // BAY-LEFT-B
  return `?${p.toString()}`;
}

/** The boot's address for a member already played: the page's own search, their save picked by key - the menu's own
 *  Load door (`?load&loadkey=` over the classic start, as main.js sets them), through the world host's scene door. */
export function loadSearch(search, key) {
  const p = new URLSearchParams(search);
  for (const k of ['classicload', 'class', 'test', 'realm', 'realmnew', 'spawn', 'legacyborn', 'region', 'loc', 'seat', 'start']) p.delete(k);   // BAY-LEFT-B: and a birth's seat
  p.set('world', '1');
  p.set('classic', '1');
  p.set('load', '1');
  p.set('loadkey', String(key));
  return `?${p.toString()}`;
}
