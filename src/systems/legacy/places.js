// @ts-check
// LEGACY1 (bible/06-Systems/Legacy-Arc.md section 4): THE HEIR IS BORN IN A TOWN. Project Legacy's `Teleport` threw
// the heir to a coordinate pair taken from two DIFFERENT entries of its forty (B11) - often the sea - and its retry
// re-rolled instead of searching near. The port names a PLACE: a town (a city, a hamlet or a village, MapsFile's
// LocationTypes), which the boot stands the heir in through its own `?region=&loc=` start.
//
// Pure over a region's tables (formats/mapsFile.js dfRegion: `mapTable[i]` and `mapNames[i]`).
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

/** The nearest town in ANY region (the open sea's region holds none - deathRespawn's SEA-RISE lesson). `maps` is
 *  formats/mapsFile.js's reader; the region resident before is put back. */
export function nearestTownAnywhere(maps, regionNames, pixel) {
  const before = maps?._lastRegion ?? -1;
  let best = null;
  let bestD = Infinity;
  for (let r = 0; r < (maps?.regionCount ?? 0); r++) {
    const hit = nearestTown(maps.getRegion(r), regionNames[r], pixel);
    if (!hit) continue;
    const d = (hit.pixel.x - pixel.x) ** 2 + (hit.pixel.y - pixel.y) ** 2;
    if (d < bestD) { bestD = d; best = hit; }
  }
  if (before >= 0 && typeof maps?.loadRegion === 'function') maps.loadRegion(before);
  return best;
}

/** The boot's address for a birth: the page's own search with the load doors dropped and the birth's added - and the
 *  world host's scene door (`?world`, main.js), so the reload goes straight to the world as realmBootSearch's does: the
 *  front door would clear the menu's keys and ask again, and the birth would be lost behind it. */
export function birthSearch(search, personId, place) {
  const p = new URLSearchParams(search);
  for (const k of ['load', 'loadkey', 'classicload', 'classic', 'class', 'test', 'realm', 'realmnew', 'spawn', 'legacyborn']) p.delete(k);
  p.set('world', '1');
  p.set('legacyborn', String(personId));
  if (place?.region) p.set('region', place.region);
  if (place?.loc) p.set('loc', place.loc);
  return `?${p.toString()}`;
}

/** The boot's address for a member already played: the page's own search, their save picked by key - the menu's own
 *  Load door (`?load&loadkey=` over the classic start, as main.js sets them), through the world host's scene door. */
export function loadSearch(search, key) {
  const p = new URLSearchParams(search);
  for (const k of ['classicload', 'class', 'test', 'realm', 'realmnew', 'spawn', 'legacyborn', 'region', 'loc']) p.delete(k);
  p.set('world', '1');
  p.set('classic', '1');
  p.set('load', '1');
  p.set('loadkey', String(key));
  return `?${p.toString()}`;
}
