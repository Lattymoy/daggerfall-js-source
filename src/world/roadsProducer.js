// ROADS 3: THE PRODUCER. The one place the road network is built from
// the player's own archives - MAPS.BSA for where the settlements are,
// WOODS.WLD for the ground between them - and the reason roadNetwork.js
// could stay pure. Nothing here is Hazelnut's; see bible/03-World/Roads.md.

import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';
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

/** ROADS 22: HIS NETWORK, 1:1. Basic Roads' four arrays, vendored with
 *  Hazelnut's permission (vendor/roads-hazelnut/README.md, credited on
 *  the About screen), served as assets and read byte-exact. The
 *  generator above is the FALLBACK now - a map where these cannot load
 *  still gets roads, just not his. Each is 500,000 bytes: one per map
 *  pixel, the same compass mask the painter reads, which is why they
 *  drop straight in. Rivers and streams ride along for the slice that
 *  paints them; the mod ships them off by default and so does the port. */
export const MOD_ROADS = Object.freeze({
  roads: new URL('../../vendor/roads-hazelnut/roadData.bytes', import.meta.url).href,
  tracks: new URL('../../vendor/roads-hazelnut/trackData.bytes', import.meta.url).href,
  rivers: new URL('../../vendor/roads-hazelnut/riverData.bytes', import.meta.url).href,
  streams: new URL('../../vendor/roads-hazelnut/streamData.bytes', import.meta.url).href,
});

export async function loadModRoads(fetchFn = globalThis.fetch, urls = MOD_ROADS) {
  if (!fetchFn) return null;
  try {
    const out = {};
    for (const [k, url] of Object.entries(urls)) {
      const r = await fetchFn(url);
      if (!r || !r.ok) return null;
      const b = new Uint8Array(await r.arrayBuffer());
      if (b.length !== MAP_WIDTH * MAP_HEIGHT) return null;   // the wrong file, or a truncated one, is no file
      out[k] = b;
    }
    let n = 0; for (const v of out.roads) if (v) n++;
    return { ...out, source: 'basic-roads', stats: { source: 'basic-roads', roadPixels: n } };
  } catch { return null; }
}
