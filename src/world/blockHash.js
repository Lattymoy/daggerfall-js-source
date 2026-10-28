// @ts-check
// RUMARE-WATER (2026-10-26, bible/03-World/Tamriel.md RUMARE-WATER): THE BLOCK'S SIDE AND THE ONE MIX, A LEAF. Their home
// was world/spawnedDungeons.js, which reads the clock (systems/gameDate.js) and the road network (systems/travel/
// travelPaths.js); the Imperial City's plan (world/imperialCity.js) reads these two, and the terrain worker and the Deep
// Waters worker now read the plan (world/rumareWaters.js, the city's water law) - so they live here, and spawnedDungeons.js
// re-exports both, its importers as they were. The workers reach world/ and formats/ alone (test/world/tamriel2.test.js
// TAMRIEL2-WORKER).
import { TERRAIN_SIZE } from './terrain/terrainSampler.js';

/** FNV-1a-ish mix of a few small integers to an unsigned 32-bit. */
export function hash32(...ns) {
  let h = 0x811c9dc5;
  for (const n of ns) {
    h ^= n >>> 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}

/** A block's side, metres: eight to a pixel. */
export const BLOCK_M = TERRAIN_SIZE / 8;
