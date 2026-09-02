// ROADS 3: THE PRODUCER. The one place the road network is built from
// the player's own archives - MAPS.BSA for where the settlements are,
// WOODS.WLD for the ground between them - and the reason roadNetwork.js
// could stay pure. Nothing here is Hazelnut's; see bible/03-World/Roads.md.

import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { BASE_HEIGHT_SCALE, SCALED_BEACH_ELEVATION } from './terrainSampler.js';
import { buildRoadNetwork } from './roadNetwork.js';

/** Water, in the small heightmap's own units: the sampler calls a
 *  height at or below the beach elevation water, and a WOODS byte
 *  scales by BASE_HEIGHT_SCALE, so the threshold is the sampler's
 *  constant divided back - stated in ITS terms so the two cannot
 *  disagree about where the sea starts. */
export const WATER_BYTE = SCALED_BEACH_ELEVATION / BASE_HEIGHT_SCALE;

/** Every settlement on the map as a pixel and a type, from every
 *  region's map table. A region that fails to load contributes
 *  nothing rather than throwing - a half-copied archive gets the roads
 *  its data can support. */
export function settlementsOf(maps) {
  const out = [];
  // ROADS 11 (Audit 45 F5, corrected): MapsFile.autoDiscard is on by
  // default - DFU's own design - so loadRegion drops the previous region
  // each time and this sweep holds ONE region, never sixty-two. The
  // audit's memory concern was a misreading. Its only real cost is that
  // whichever region was loaded BEFORE the sweep gets dropped and would
  // reload on its next use, so it is put back afterwards.
  const before = maps._lastRegion ?? -1;
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region || !region.mapTable) continue;
    const regionStart = out.length;
    for (const row of region.mapTable) {
      if (!row) continue;
      const p = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
      // ROADS 8: the name rides the row so a stranded town can be NAMED
      // in the log rather than pointed at by pixel.
      out.push({ x: p.x, y: p.y, type: row.locationType, region: r, name: region.mapNames?.[out.length - regionStart] ?? null });
    }
  }
  if (before >= 0 && maps.loadRegion) maps.loadRegion(before);
  return out;
}

/**
 * Build the network from the archives. Synchronous and, measured on
 * the real map, under a second: the routes are short and the A* box is
 * tight. Returns null on any failure so the caller draws no roads
 * rather than no world - a road is never load-bearing.
 */
export function buildRoadsFromArchives(maps, woods, dials = {}) {
  try {
    return buildRoadsFromSettlements(settlementsOf(maps), woods, dials);
  } catch (e) {
    console.warn('[roads] no network - the world draws without roads:', e?.message ?? e);
    return null;
  }
}

/** AUDIT ROADS F2: the half that needs only the small heightmap and a
 *  settlement list, so the terrain WORKER can run it with its own
 *  woods - the list crosses the wire, the build does not touch the
 *  frame. buildRoadsFromArchives is the same-thread composition. */
export function buildRoadsFromSettlements(locations, woods, dials = {}) {
  try {
    const t0 = (globalThis.performance ?? Date).now();
    const heightAt = (x, y) => woods.getHeightMapValue(x, y);
    const isWater = (x, y) => woods.getHeightMapValue(x, y) <= WATER_BYTE;
    const net = buildRoadNetwork({ locations, heightAt, isWater, dials });
    net.stats.ms = Math.round((globalThis.performance ?? Date).now() - t0);
    net.stats.settlements = locations.length;
    return net;
  } catch (e) {
    console.warn('[roads] no network - the world draws without roads:', e?.message ?? e);
    return null;
  }
}
