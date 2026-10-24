// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BASIC ROADS' PATH DATA (TO1, moved here whole from systems/travel/travelPaths.js by AUDIT JUNGLE-ROADSIDE DOC-2,
// 2026-10-23): the four path arrays' order, the compass, the map pixel's world units and a path's width, and the reads
// of a pixel's path byte - Travel Options' port of Basic Roads' own (TravelOptionsMod.cs). One home under world/, so the
// terrain worker - which reaches world/ and formats/ alone (TAMRIEL2-WORKER) - reads the network by the same port the
// travel machine does (world/road/roadBand.js, the jungle's roadside pairs); systems/travel/travelPaths.js re-exports
// every name, and its follow machine reads them from here.
// ═══════════════════════════════════════════════════════════════════
import { MAP_W, MAP_H } from './roadNetwork.js';

/** TravelOptionsMod.cs:73-75 - the four path arrays, in the mod's own
 *  index order (and Basic Roads' own: it answers `getPathData` by it). */
export const PATH_ROADS = 0;
export const PATH_TRACKS = 1;
export const PATH_RIVERS = 2;
export const PATH_STREAMS = 3;
/** The vendored arrays' keys in the port's road bundle, by that index. */
export const PATH_KEYS = Object.freeze(['roads', 'tracks', 'rivers', 'streams']);

/** TravelOptionsMod.cs:77-84. The compass mask, one bit an edge. */
export const N = 128;
export const NE = 64;
export const E = 32;
export const SE = 16;
export const S = 8;
export const SW = 4;
export const W = 2;
export const NW = 1;

/** The eight in the order the mod's own switches walk them (:821-843). */
export const DIRECTIONS = Object.freeze([N, NE, E, SE, S, SW, W, NW]);

/** TravelOptionsMod.cs:86-92 - the map pixel's world units and the
 *  bands inside it. MPworldUnits is MapsFile.WorldMapTerrainDim (the
 *  port's streamingWorld NATIVE_PIXEL); TSize is a terrain TILE
 *  (WorldMapTileDim 128 of them across a pixel, world/terrain/terrainTiles.js),
 *  and a path is two tiles wide. */
export const MP_WORLD_UNITS = 32768;
export const HALF_MP_WORLD_UNITS = MP_WORLD_UNITS / 2;      // 16384
export const T_SIZE = MP_WORLD_UNITS / 128;                 // 256 - one terrain tile
export const P_SIZE = T_SIZE * 2;                           // 512 - a path's width

/** TravelOptionsMod.cs:808-814, GetPathsDataPoint: roads OR tracks, one
 *  byte. `net` is the port's road bundle - the four Uint8Arrays of
 *  world/roadsProducer.js loadModRoads, or the generated fallback,
 *  which carries the same compass. A pixel off the map answers 0. */
export function pathsDataPoint(net, mapPixelX, mapPixelY) {
  return (dataPoint(net, PATH_ROADS, mapPixelX, mapPixelY) | dataPoint(net, PATH_TRACKS, mapPixelX, mapPixelY)) & 0xff;
}

/** :815-819, GetRoadsDataPoint - roads alone, which is what decides
 *  whether a followed path is a ROAD (reckless speed, "Following a
 *  road.") or a dirt TRACK (cautious speed). */
export function roadsDataPoint(net, mapPixelX, mapPixelY) {
  return dataPoint(net, PATH_ROADS, mapPixelX, mapPixelY);
}

/** One array's byte at a pixel, bounds-checked. The mod indexes
 *  `currMapPixel.X + (currMapPixel.Y * MapsFile.MaxMapPixelX)` with no
 *  check at all (:810) - off the map it would read another row or
 *  throw; the port answers 0, which every caller already treats as
 *  "no path here". */
export function dataPoint(net, pathType, mapPixelX, mapPixelY) {
  if (!net) return 0;
  if (mapPixelX < 0 || mapPixelY < 0 || mapPixelX >= MAP_W || mapPixelY >= MAP_H) return 0;
  const arr = net[PATH_KEYS[pathType]];
  if (!arr) return 0;
  return arr[mapPixelX + (mapPixelY * MAP_W)] & 0xff;
}
