// FB1020c HARBOUR-REACH / BERTH-RING - THE PORT TOWNS ON THE GROUND THE GAME BUILDS, off the player's own ARENA2
// (tools/fetch-data.sh; ARENA2_PATH). The port law's towns (world/portSites.js portTownOnSea over the open sea, as
// scenes/world.js portOnSea and navalPortList ask it), and each map pixel's TileMap as scenes/pixelBuild.js builds it
// with Deep Waters off - a location's own tiles set first (setLocationTiles), DFU's blend over its samples
// (calcAvgMaxHeight, blendLocationTerrain), the tiles classified and marched (generateTileData, assignTiles), converted
// (convertTilemap) - read as world.js navalIsWater's no-Deep-Waters arm reads it: the tile's record 0 is water
// (comeSailAway.js tileMapIndexAtPosition). Deep Waters asks more of a berth (the deepest keel's draft), never less.
// Positions are world metres: x east, z north (MapsFile's pixel corner, mapPixelToWorldCoords). Null without ARENA2.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MapsFile, longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { buildMapDict, locationSummaryAt } from '../src/systems/map/mapDirectory.js';
import { isWaterPixel } from '../src/ui/overworldModel.js';
import { openSeaOf, portTownOnSea } from '../src/world/portSites.js';
import { isPortTown } from '../src/systems/portPlaces.js';
import { hasPort } from '../src/systems/travel/travelPorts.js';
import { generateSamples, TERRAIN_SIZE } from '../src/world/terrain/terrainSampler.js';
import { generateTileData, setLocationTiles, calcAvgMaxHeight, blendLocationTerrain, assignTiles } from '../src/world/terrain/terrainTiles.js';
import { convertTilemap } from '../src/world/terrain/terrainSurface.js';
import { locationWorldRect } from '../src/world/streamingWorld.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';

export const ARENA2 = process.env.ARENA2_PATH;
export const HAS_ARENA2 = !!ARENA2 && existsSync(ARENA2);

let _terrain;
/** The real map's port towns and ground, built once a process - or null without ARENA2. */
export function portTerrain() {
  if (_terrain !== undefined) return _terrain;
  if (!HAS_ARENA2) return (_terrain = null);
  const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const maps = new MapsFile();
  maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  maps.autoDiscard = false;
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const dict = buildMapDict(maps);
  const seaPixel = (x, y) => isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y));   // the world's one water law
  const mask = openSeaOf(seaPixel, 1000, 500);
  const openSea = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500 && mask[y * 1000 + x] === 1;
  const towns = [];
  for (const s of dict.values()) {
    const loc = maps.getLocation(s.regionIndex, s.mapIndex);
    if (!loc?.mapTableData || !isPortTown(loc, portTownOnSea(loc, hasPort, openSea))) continue;
    const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
    const r = locationWorldRect(loc, p.x, p.y);
    towns.push({ name: loc.name, region: maps.getRegion(s.regionIndex)?.name ?? '', px: p.x, py: p.y,
      rect: { minX: r.minX * GLOBAL_SCALE, maxX: r.maxX * GLOBAL_SCALE, minZ: r.minZ * GLOBAL_SCALE, maxZ: r.maxZ * GLOBAL_SCALE } });
  }
  const tiles = new Map();
  /** A map pixel's converted TileMap, as the pixel's build makes it (Deep Waters off). */
  const tileMapOf = (px, py) => {
    const key = `${px},${py}`;
    let out = tiles.get(key);
    if (out) return out;
    const tm = new Uint8Array(128 * 128);
    const s = locationSummaryAt(dict, px, py);
    const loc = s ? maps.getLocation(s.regionIndex, s.locationIndex ?? s.mapIndex) : null;
    const rect = loc?.exterior?.exteriorData ? setLocationTiles(loc, maps, blocks, tm) : null;
    const samples = generateSamples(woods, px, py);
    if (rect) blendLocationTerrain(samples, calcAvgMaxHeight(samples)[0], rect);
    assignTiles(generateTileData(samples, px, py), tm, true);
    tiles.set(key, out = convertTilemap(tm));
    return out;
  };
  /** world.js navalIsWater's no-Deep-Waters arm at a world point (metres): the tile's record 0. */
  const isWater = (x, z) => {
    const px = Math.floor(x / TERRAIN_SIZE), py = 499 - Math.floor(z / TERRAIN_SIZE);
    if (px < 0 || py < 0 || px >= 1000 || py >= 500) return false;
    const tx = Math.min(127, Math.max(0, Math.trunc(((x - px * TERRAIN_SIZE) / TERRAIN_SIZE) * 128)));
    const tz = Math.min(127, Math.max(0, Math.trunc(((z - (499 - py) * TERRAIN_SIZE) / TERRAIN_SIZE) * 128)));
    return (tileMapOf(px, py)[tz * 128 + tx] >> 2) === 0;
  };
  /** How many 45 m squares of water (seven 6.4 m tiles a side - room for the Small Ship, 41.8 m) a map pixel holds. */
  const shipWater = (px, py, K = 7) => {
    const tm = tileMapOf(px, py), S = new Int32Array(129 * 129);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) S[(y + 1) * 129 + x + 1] = ((tm[y * 128 + x] >> 2) === 0 ? 1 : 0) + S[y * 129 + x + 1] + S[(y + 1) * 129 + x] - S[y * 129 + x];
    let n = 0;
    for (let y = 0; y + K <= 128; y++) for (let x = 0; x + K <= 128; x++) if (S[(y + K) * 129 + x + K] - S[y * 129 + x + K] - S[(y + K) * 129 + x] + S[y * 129 + x] === K * K) n++;
    return n;
  };
  return (_terrain = { maps, woods, dict, openSea, towns, tileMapOf, isWater, shipWater });   // FIELD BUGS 2026-10-21d PASSAGE-IN: the heightmap the planner reads
}
