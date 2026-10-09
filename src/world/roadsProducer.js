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

/**
 * WOD2: Basic Roads' `getPathsPoint` message (BasicRoadsMod.cs, the
 * GET_PATHS_POINT arm): the ROAD mask OR the TRACK mask at a map pixel,
 * read through BasicRoadsTexturing.GetPathDataPoint's own index
 * (`x + y * MapsFile.MaxMapPixelX`). Rivers and streams are not asked -
 * the message ORs the two path kinds and nothing else. It is how World of
 * Daggerfall keeps its camps off the roads (LocationLoader.cs:146-151).
 * @param {{roads:Uint8Array, tracks:Uint8Array}} net - his arrays
 * @returns {number} a byte; 0 when no road or track crosses the pixel
 */
export function basicRoadsPathsPoint(net, x, y) {
  const i = x + y * MAP_WIDTH;
  return (net.roads[i] | net.tracks[i]) & 0xff;
}

/**
 * CANAL-ARM (FIELD BUGS 2026-10-09b, "River/Stream Creation Turned Some Roads into Canals": "a lot of towns that usually
 * have straight dirt roads to them now have canals"): A COMPASS ARM A ROAD OR A TRACK CARRIES IS THE PATH'S. His arrays
 * share an arm between a path and a river or a stream at 32 arms of 30 pixels (a pixel's arm runs from its centre to
 * its edge - a water and a path that both meet a town's centre from one side share it). The painter paints the water
 * before the track (paintRoads, his order), so the whole arm was water where the track was, and a river along a road
 * flanked it with its banks; LANDFORM3 cuts the painted water into the land, so the arm was a straight sunken channel -
 * and since LANDFORM3 the room's rivers are on (onlineLane.js). Each such arm is the path's alone, once, as the arrays
 * load: the painter, the channel's cut and the maps all read the arrays, so all three agree. A crossing shares no arm
 * (the water and the path meet at the centre from different sides) - the fords and the causeways stand as they were.
 * Answers `net`, its river and stream arrays written in place.
 */
export function waterOffPaths(net) {
  for (let i = 0; i < net.roads.length; i++) {
    const path = net.roads[i] | net.tracks[i];
    if (!path) continue;
    if (net.rivers) net.rivers[i] &= ~path;
    if (net.streams) net.streams[i] &= ~path;
  }
  return net;
}

/** AUDIT LANDFORMS II G3: how long one of his files may take to arrive (each asked in turn) before the ask counts as
 *  failed. A fetch has no timeout of its own: one that never answered never settled, so the page stood roadless for the
 *  session - offline the port's own network never stood in, and online C3's retry never asked again. */
export const MOD_ROADS_FETCH_TIMEOUT_MS = 30000;

export async function loadModRoads(fetchFn = globalThis.fetch, urls = MOD_ROADS, timeoutMs = MOD_ROADS_FETCH_TIMEOUT_MS) {
  if (!fetchFn) return null;
  try {
    const out = {};
    for (const [k, url] of Object.entries(urls)) {
      // raced, so a fetch that ignores its signal times out too; the file's body inside the same span
      const ac = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
      let timer = null;
      const late = new Promise((_, no) => { timer = setTimeout(() => { ac?.abort(); no(new Error(`${url}: no answer in ${timeoutMs} ms`)); }, timeoutMs); });
      try {
        const r = await Promise.race([fetchFn(url, ac ? { signal: ac.signal } : undefined), late]);
        if (!r || !r.ok) return null;
        const b = new Uint8Array(await Promise.race([r.arrayBuffer(), late]));
        if (b.length !== MAP_WIDTH * MAP_HEIGHT) return null;   // the wrong file, or a truncated one, is no file
        out[k] = b;
      } finally { clearTimeout(timer); }
    }
    let n = 0; for (const v of out.roads) if (v) n++;
    return waterOffPaths({ ...out, source: 'basic-roads', stats: { source: 'basic-roads', roadPixels: n } });
  } catch { return null; }
}

/** AUDIT LANDFORMS C3: how many more times an online page asks for Basic Roads' arrays after the first ask failed. */
export const MOD_ROADS_RETRY_MAX = 12;

/**
 * AUDIT LANDFORMS C3: Basic Roads' arrays asked again in the background after a failed load - 5 s after, then doubling
 * to a minute between tries (WOD6's backoff, worldOfDaggerfall.js), `max` more tries. Online a room's ground is cut along
 * HIS network (the lane forces the mod), so the host asks again rather than stand one client on the port's own.
 * @param {object} [o]
 * @param {(ms: number) => Promise<void>} [o.wait] - the pause before each try
 * @param {(tries: number, ms: number) => void} [o.onTry] - told before each pause
 * @returns {Promise<?object>} his arrays (loadModRoads' shape), or null once every try failed
 */
export async function retryModRoads({ fetchFn = globalThis.fetch, urls = MOD_ROADS, wait = (ms) => new Promise((r) => setTimeout(r, ms)), max = MOD_ROADS_RETRY_MAX, onTry = null } = {}) {
  for (let tries = 0; tries < max; tries++) {
    const ms = Math.min(60000, 5000 * 2 ** tries);
    onTry?.(tries, ms);
    await wait(ms);
    const his = await loadModRoads(fetchFn, urls);
    if (his) return his;
  }
  return null;
}
