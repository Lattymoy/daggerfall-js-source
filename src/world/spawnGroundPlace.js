// @ts-check
// GROUND-AGREE (bible/01-Overview/bugs/Field-Bugs-2026-10-24b.md): THE PLACE A PIXEL'S GROUND IS SHAPED FOR.
//
// A location levels its whole pixel (DFU's BlendLocationTerrain, world/terrain/terrainTiles.js blendLocationTerrain), and
// online a spawned dungeon is a location. Whether a spawn STANDS is each client's clocks (TTL1, SPAWN-REBIRTH: seven days
// from its first entry, two from its clearing, twelve dead before it stands again), read when that client builds the
// pixel. Two clients that built one pixel on either side of a spawn's death stood on two grounds, so each drew the other
// player, and the other player's foes, sunk or floating. The ground must not wait on anything one client believes alone,
// so it is shaped for the spawn the roll stands - alive or dead - and only what stands follows the clocks.
//
// The gates are spawnedDungeonAt's (scenes/world.js), which stands the spawn: none offline, none past the Veil (the isles
// stand their own places), none in the open zone (its halls are stood, by the day), and none where the roll stands no
// spawn, on the sea, on a wet plateau or on a pixel a path crosses. The host hands in what it holds; this module reads
// nothing else of it.
import { CLIMATES } from '../formats/mapsTables.js';
import { inEther } from './ethericSea.js';
import { spawnsDungeon, pathFreePixel, WORLD_SALT } from './spawnedDungeons.js';
import { wildMaskOf, wildInside } from '../systems/wild/wildZone.js';

/**
 * What the host holds that the law reads.
 * @typedef {object} SpawnGroundHandles
 * @property {{ getClimateIndex(x: number, y: number): number }} maps the map files' climate page
 * @property {boolean} online whether the page plays online - spawned dungeons stand online alone
 * @property {boolean} etherSea whether the Eltheric Ocean streams (scenes/shared.js etherSeaOn)
 * @property {(px: number, py: number) => boolean} plateauDry whether a ruin's levelled plateau there stands over the
 *   beach (world/spawnedDungeons.js createSpawnGround)
 * @property {{ roads(): object | null }} terrainGen the terrain client - its road network, null until it lands
 * @property {(px: number, py: number) => object | null} cloneAt the spawn's location on the pixel, cloned from its
 *   template and not stood (scenes/world.js _spawnCloneAt)
 * @property {(px: number, py: number) => boolean} spawnGone whether the spawn's clocks have run out on the pixel
 *   (scenes/world.js tvSpawnGone)
 */

/**
 * The spawn law the ground and the Overworld share.
 * @param {SpawnGroundHandles} handles
 */
export function createSpawnGroundPlace(handles) {
  const { maps, online, etherSea, plateauDry, terrainGen, cloneAt, spawnGone } = handles;

  /** Is the open zone's mask on this pixel? The zone stands its own halls, never the spawner's roll. */
  function inOpenZone(px, py) {
    const mask = wildMaskOf(maps);
    return !!mask && wildInside(mask, px, py);
  }

  /**
   * The spawn the roll would stand on a pixel, as the Overworld marks one it has not built: the sea, a wet plateau and
   * a path across the pixel stand none. Before the road network lands a spawn stands provisionally, as
   * spawnedDungeonAt stands it, and the roads sweep builds the pixel again once the network is in.
   * @param {number} px @param {number} py
   * @param {{ clocks?: boolean }} [options] `clocks` false: the spawn alive or dead, for the ground
   */
  function spawnAt(px, py, { clocks = true } = {}) {
    if (maps.getClimateIndex(px, py) === CLIMATES.Ocean) return null;
    if (!plateauDry(px, py)) return null;
    if (clocks && spawnGone(px, py)) return null;
    const roads = terrainGen.roads();
    if (roads && !pathFreePixel(roads, px, py)) return null;
    return cloneAt(px, py);
  }

  /**
   * The place a pixel's ground is shaped for: what stands there, else online the spawn the roll stands, alive or dead.
   * @param {number} px @param {number} py
   * @param {object | null | undefined} stood the location that stands on the pixel, if any
   */
  function groundLocationAt(px, py, stood) {
    if (stood) return stood;
    if (!online) return null;
    if (etherSea && inEther(px, py)) return null;
    if (inOpenZone(px, py)) return null;
    if (!spawnsDungeon(WORLD_SALT, px, py)) return null;
    return spawnAt(px, py, { clocks: false });
  }

  return { spawnAt, groundLocationAt };
}
