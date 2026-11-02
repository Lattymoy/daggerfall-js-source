// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SPAWN-WORLD / PITS-WORLD (2026-10-26, bible/03-World/World-Wide.md WORLD-LANES; the owner, after the audit NO SYSTEM LEFT
// BEHIND IN THE BAY: "Every single thing here needs to be addressed. No exceptions.") - THE WORLD'S LANES OF MAP IDS.
//
// DFU's law names a place by its map pixel: a MapId's low 20 bits are MapsFile.getMapPixelID's `y * 1000 + x`
// (formats/mapsFile.js), unique on the Bay's 1000 x 500 and nowhere else - past the Bay two pixels a thousand apart share
// it. A place the port makes ON A PIXEL OF ITS OWN past the Bay - a spawned dungeon the world roll stands
// (world/spawnedDungeons.js spawnedMapId), an Ocean Hole's drowned dungeon (world/oceanHoles.js getAbyssMapId) - is named
// instead in a LANE of the world's: a run of DFU's 12-bit lanes over the world pixel's key (worldWide/worldGrid.js
// worldPixelKey, a whole number under 2^28) - its low 19 bits under 0x80000 in the id's low 20, its high 9 the lane's
// step in the high 12. So an id is
//   - never a Bay pixel id's: TESA II P6's law for every place the port made past the Bay (systems/discovery.js) - its
//     low 20 bits are 500,000 and up (0x80000 is 524,288), where every Bay pixel id is under 500,000 - so the discovered
//     places file it by its whole id and Immersive Travel's docks and capitals meet none of their pixel ids in it;
//   - none of the other lanes' whatever its pixel: MAPS.BSA's ids' high 12 reach 0x728 with a Bay pixel's low 20; the
//     Bay's spawns (salt 1), the Abyss Dungeons (salts 2049-4095, high 12 0x801-0xfff) and the Bay's abyss (0x600) carry a
//     Bay pixel's; Arena's (0xa7) and the isles' (0xe7, 0xe8) and the countryside's, the lairs' and the capitals'
//     (0x300-0x341) lanes are below these runs, and the zone halls' (net/wire.js WDUN_WORLD_LANE, the high 4 bits 0xf)
//     above them;
//   - unique per world pixel, and an unsigned 32-bit number the relay's room law admits (net/wire.js WORLD_ROOM,
//     `dungeon:m<1-10 digits>`) - under 0x60000000 for a spawn, and for an abyss in the Bay's abyss's own range
//     (0x60000000 to 0x7fffffff: the abyss's run starts at the Bay's 0x600, and only the flag tells the two apart), so the
//     readers that know an abyss by that range (scenes/dungeonContext.js, world/oceanHoles.js isAbyssMapId) meet every
//     abyss there and no spawn.
// The zone halls kept the high 4 bits (WW-C2); a lane there is the Abyss Dungeons' salts' (0xd00-0xfff), so these runs
// stand in DFU's 12 bits as the countryside's do.
// ═══════════════════════════════════════════════════════════════════
import { worldPixelKey, worldPixelOfKey, inWorldGrid, WORLD_PIXEL_KEYS } from './worldGrid.js';

/** How many of DFU's 12-bit lanes a world lane runs: the world's keys at 2^19 a lane. */
export const WORLD_LANE_RUN = WORLD_PIXEL_KEYS / 0x80000;
/** SPAWN-WORLD: a spawned dungeon past the Bay - DFU's lanes 0x380 to 0x57f. */
export const SPAWN_WORLD_LANE = 0x380;
/** PITS-WORLD: an Ocean Hole's abyss past the Bay - DFU's lanes 0x600 to 0x7ff, the Bay's abyss's own 0x600 the first
 *  (its ids carry a Bay pixel's low 20, these the flag), the Abyss Dungeons' first salt (2049, 0x801) past the last. */
export const ABYSS_WORLD_LANE = 0x600;
const LANES = Object.freeze([SPAWN_WORLD_LANE, ABYSS_WORLD_LANE]);
const FLAG = 0x80000,
  LOW = 0x7ffff;

/** A world pixel's map id in a lane. Throws for a lane that is none and a pixel off the world's grid.
 *  @param {number} lane @param {number} px @param {number} py */
export function worldLaneMapId(lane, px, py) {
  if (!LANES.includes(lane)) throw new RangeError(`lane ${lane}`);
  if (!inWorldGrid(px, py)) throw new RangeError(`pixel ${px},${py}`);
  const key = worldPixelKey(px, py);
  return (((lane + (key >>> 19)) << 20) | FLAG | (key & LOW)) >>> 0;
}

/** The lane a map id is in - SPAWN_WORLD_LANE or ABYSS_WORLD_LANE - or -1 for any other id. @param {unknown} id */
export function worldLaneOf(id) {
  const v = Number(id);
  if (!Number.isSafeInteger(v) || v < 0 || v > 0xffffffff || !(v & FLAG)) return -1;
  const step = (v >>> 20) & 0xfff;
  for (const lane of LANES) if (step >= lane && step < lane + WORLD_LANE_RUN) return lane;
  return -1;
}

/** Is a map id a world lane's? @param {unknown} id */
export const isWorldLaneMapId = (id) => worldLaneOf(id) >= 0;

/** The world pixel a lane's id names, [px, py], or null for any other id. @param {unknown} id */
export function worldLanePixel(id) {
  const lane = worldLaneOf(id);
  if (lane < 0) return null;
  const v = Number(id) >>> 0;
  return worldPixelOfKey((((v >>> 20) & 0xfff) - lane) * 0x80000 + (v & LOW));
}
