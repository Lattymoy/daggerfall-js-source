// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BASIC ROADS' PATH DATA (TO1, moved here whole from systems/travel/travelPaths.js by AUDIT JUNGLE-ROADSIDE DOC-2,
// 2026-10-23): the four path arrays' order, the compass, the map pixel's world units and a path's width, and the reads
// of a pixel's path byte - Travel Options' port of Basic Roads' own (TravelOptionsMod.cs). One home under world/, so the
// terrain worker - which reaches world/ and formats/ alone (TAMRIEL2-WORKER) - reads the network by the same port the
// travel machine does (world/road/roadBand.js, the jungle's roadside pairs); systems/travel/travelPaths.js re-exports
// every name, and its follow machine reads them from here.
//
// BAY-LEFT-MAPS (2026-10-27, bible/06-Systems/Travel-Options.md BAY-LEFT-MAPS): PAST THE TABLE, THE ROADS PAST THE BAY. The
// mod's arrays are the Bay's 1000 x 500, and every read past them answered 0 - so on every road past the Bay Follow Paths
// said there was none, the junction map was blank and a walk on a road ran at the open ground's rate. Past the table a
// pixel's road and track bytes are TESA's layer's (world/arenaRoads.js arenaRoadByte - ROADS 1's compass, the same bits the
// table holds, installed on each thread that reads it, the terrain worker's included); it has no rivers or streams. On
// the table every byte is the mod's own, unchanged. The layer hands its reader in as it loads (setRoadsPastTable): this
// file never imports it, for the account Worker bundles this file (world/spawnedDungeons.js, for hash32) and holds no
// land past the Bay - its bundle and its deploy's path filter stay as they were (test/server/accountdeploy.test.js
// ACC1-CI).
// ═══════════════════════════════════════════════════════════════════
import { MAP_W, MAP_H } from './roadNetwork.js';

/** BAY-LEFT-MAPS: a road's or a track's compass byte past the table - (kind, x, y) => byte, kind 'roads' or 'tracks'.
 *  world/arenaRoads.js sets its arenaRoadByte here as it loads; a thread that never loads the layer reads 0 past the
 *  table, as one with no layer installed does.
 *  @type {(kind: string, x: number, y: number) => number} */
let roadsPastTable = () => 0;
/** @param {(kind: string, x: number, y: number) => number} read */
export const setRoadsPastTable = (read) => { roadsPastTable = read; };

/** TravelOptionsMod.cs:73-75 - the four path arrays, in the mod's own
 *  index order (and Basic Roads' own: it answers `getPathData` by it). */
export const PATH_ROADS = 0;
export const PATH_TRACKS = 1;
export const PATH_RIVERS = 2;
export const PATH_STREAMS = 3;
/** The four arrays' keys in the port's road bundle, by that index. */
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
 *  world/roadsProducer.js, Basic Roads' compass (OWN-WORK2: the port's
 *  own network). Past the mod's table, the roads past the Bay
 *  (dataPoint, BAY-LEFT-MAPS); off every network 0. */
export function pathsDataPoint(net, mapPixelX, mapPixelY) {
  return (dataPoint(net, PATH_ROADS, mapPixelX, mapPixelY) | dataPoint(net, PATH_TRACKS, mapPixelX, mapPixelY)) & 0xff;
}

/** BAY-LEFT-MAPS: roads OR tracks on the mod's own table alone - 0 past it, as the reads all were. The jungle's roadside
 *  pairs (world/jungle/jungleRoadside.js) stand astride the table's straight lanes; past the Bay a road is drawn as a
 *  curve (bible/03-World/Roads.md VOYAGER2), and a pair stood on a straight arm there would stand on the road's bend. */
export function tablePathsDataPoint(net, mapPixelX, mapPixelY) {
  if (!onTable(mapPixelX, mapPixelY)) return 0;
  return pathsDataPoint(net, mapPixelX, mapPixelY);
}

/** :815-819, GetRoadsDataPoint - roads alone, which is what decides
 *  whether a followed path is a ROAD (reckless speed, "Following a
 *  road.") or a dirt TRACK (cautious speed). */
export function roadsDataPoint(net, mapPixelX, mapPixelY) {
  return dataPoint(net, PATH_ROADS, mapPixelX, mapPixelY);
}

/** Is a pixel on the mod's table - the Bay's 1000 x 500? */
const onTable = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

/** One array's byte at a pixel, bounds-checked. The mod indexes
 *  `currMapPixel.X + (currMapPixel.Y * MapsFile.MaxMapPixelX)` with no
 *  check at all (:810) - off the map it would read another row or
 *  throw; the port answers 0, which every caller already treats as
 *  "no path here". BAY-LEFT-MAPS: past the table a road's or a track's
 *  byte is the roads past the Bay's (world/arenaRoads.js arenaRoadByte,
 *  handed in by setRoadsPastTable - none while no layer is installed or
 *  loaded, so a thread with no land past the Bay reads 0 there as
 *  before), and a river's or a stream's none. A
 *  spawn's road test (world/spawnedDungeons.js pathFreePixel) reads it
 *  too: no ruin stands on a road past the Bay. */
export function dataPoint(net, pathType, mapPixelX, mapPixelY) {
  if (!net) return 0;
  if (!onTable(mapPixelX, mapPixelY)) return pathType === PATH_ROADS || pathType === PATH_TRACKS ? roadsPastTable(PATH_KEYS[pathType], mapPixelX, mapPixelY) & 0xff : 0;
  const arr = net[PATH_KEYS[pathType]];
  if (!arr) return 0;
  return arr[mapPixelX + (mapPixelY * MAP_W)] & 0xff;
}
