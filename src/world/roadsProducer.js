// ROADS 3: THE PRODUCER. The one place the road network is built from
// the player's own archives - MAPS.BSA for where the settlements are,
// WOODS.WLD for the ground between them - and the reason roadNetwork.js
// could stay pure. OWN-WORK2: it is the Bay's only network - roads,
// tracks, rivers and streams, all ours.

import { longitudeLatitudeToMapPixel, LOCATION_TYPES } from '../formats/mapsFile.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';
import { BASE_HEIGHT_SCALE, SCALED_BEACH_ELEVATION } from './terrain/terrainSampler.js';
import { buildRoadNetwork, ROAD_TYPES, TRACK_TYPES } from './road/roadNetwork.js';
import { VOYAGER_DIALS, RIVER_FORD, landForRoutes, landGrain } from './road/roadLand.js';   // The land's law past the Bay, on it too
import { linkGaps } from './road/roadGaps.js';   // And ROAD-GAPS' links
import { buildRiverNetwork, riverPrices } from './road/riverNetwork.js';   // The Bay's rivers and streams

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
 *  frame. buildRoadsFromArchives is the same-thread composition.
 *  OWN-WORK2: the rivers first (road/riverNetwork.js), then the roads by
 *  the law the roads past the Bay take (world/tamrielRoads.js): the
 *  land's (road/roadLand.js), each river priced as a ford, a place on its
 *  own pixel's land, the pieces linked (road/roadGaps.js), and a road
 *  out to the Bay's edges (edgeGates). No road on the sea. */
export function buildRoadsFromSettlements(locations, woods, dials = {}) {
  try {
    const t0 = (globalThis.performance ?? Date).now();
    const W = MAP_WIDTH, H = MAP_HEIGHT, heights = new Uint8Array(W * H), water = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = woods.getHeightMapValue(x, y); heights[y * W + x] = h; water[y * W + x] = h <= WATER_BYTE ? 1 : 0; }
    const { rivers, streams, stats: riverStats } = buildRiverNetwork({ heights, water, W, H, dials: dials.rivers });
    const dry = water.slice();
    for (const l of locations) if ((ROAD_TYPES.has(l.type) || TRACK_TYPES.has(l.type)) && l.x >= 0 && l.y >= 0 && l.x < W && l.y < H) dry[l.y * W + l.x] = 0;
    const land = landForRoutes(heights, dry, null, W, H, VOYAGER_DIALS, landGrain);
    land.river = riverPrices(rivers, streams, RIVER_FORD);
    const gates = edgeGates(dry, W, H);
    const net = buildRoadNetwork({ locations: [...locations, ...gates], heightAt: (x, y) => heights[y * W + x], isWater: (x, y) => dry[y * W + x] === 1, dials, terrain: land });
    net.stats.linked = linkGaps(net, W, H, { blocked: (u, v) => dry[v * W + u] === 1, owns: () => true });
    waterOffPaths(Object.assign(net, { rivers, streams }));   // An arm a path and a water share is the path's
    net.stats.ms = Math.round((globalThis.performance ?? Date).now() - t0);
    net.stats.settlements = locations.length;
    net.stats.rivers = riverStats;
    net.stats.gates = gates.length;
    return net;
  } catch (e) {
    console.warn('[roads] no network - the world draws without roads:', e?.message ?? e);
    return null;
  }
}

/** How far apart along each of the Bay's edges a road runs out to it, pixels. */
export const EDGE_GATE_SPACING = 100;

/**
 * THE BAY'S WAYS OUT. The Bay's roads join its towns, and the land goes on past its edges to the provinces,
 * whose roads meet the Bay's where one reaches an edge (world/arenaRoads.js arenaJoins, TESA5). So each EDGE_GATE_SPACING
 * of an edge takes a road node: the dry edge pixel nearest the stretch's middle with three dry pixels inward of it. The
 * build joins each to the towns of its land; none stands where the edge is the sea.
 * @param {Uint8Array} water 1 the sea's @param {number} W @param {number} H
 * @returns {Array<{ x: number, y: number, type: number, name: null, region: number }>}
 */
export function edgeGates(water, W, H, spacing = EDGE_GATE_SPACING) {
  const edges = [(u, k) => [u, k], (u, k) => [u, H - 1 - k], (u, k) => [k, u], (u, k) => [W - 1 - k, u]];
  const out = [], seen = new Set();
  edges.forEach((at, e) => {
    const len = e < 2 ? W : H;
    for (let s0 = 0; s0 < len; s0 += spacing) {
      const s1 = Math.min(len, s0 + spacing), mid = (s0 + s1) >> 1;
      for (let d = 0; d < spacing; d++) {
        const u = d % 2 ? mid + ((d + 1) >> 1) : mid - (d >> 1);
        if (u < s0 || u >= s1) continue;
        if (![0, 1, 2, 3].every((k) => { const [x, y] = at(u, k); return water[y * W + x] === 0; })) continue;
        const [x, y] = at(u, 0);
        if (!seen.has(y * W + x)) { seen.add(y * W + x); out.push({ x, y, type: LOCATION_TYPES.TownCity, name: null, region: -1 }); }
        break;
      }
    }
  });
  return out;
}

/**
 * Basic Roads' `getPathsPoint` message (BasicRoadsMod.cs, the
 * GET_PATHS_POINT arm): the ROAD mask OR the TRACK mask at a map pixel,
 * read through BasicRoadsTexturing.GetPathDataPoint's own index
 * (`x + y * MapsFile.MaxMapPixelX`). Rivers and streams are not asked -
 * the message ORs the two path kinds and nothing else. It is how World of
 * Daggerfall keeps its camps off the roads (LocationLoader.cs:146-151).
 * @param {{roads:Uint8Array, tracks:Uint8Array}} net - the Bay's network
 * @returns {number} a byte; 0 when no road or track crosses the pixel
 */
export function basicRoadsPathsPoint(net, x, y) {
  const i = x + y * MAP_WIDTH;
  return (net.roads[i] | net.tracks[i]) & 0xff;
}

/**
 * CANAL-ARM (FIELD BUGS 2026-10-09b, "River/Stream Creation Turned Some Roads into Canals"): A COMPASS ARM A ROAD OR A
 * TRACK CARRIES IS THE PATH'S. The painter paints the water before the track (paintRoads), so a shared arm was water
 * where the track ran, and LANDFORM3 cut it into the land - a sunken channel to the town. Each such arm is the path's
 * alone, once, as the network is built: the painter, the channel's cut and the maps all read the arrays, so all three
 * agree. A crossing shares no arm - its ford stands. Answers `net`, its river and stream arrays written in place.
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
