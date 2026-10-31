// @ts-check
// WG2-TOWNS (bible/03-World/World-2-Canon.md, "Buildings and settlements"): THE TOWNS THE INSTALLED REGIONS HOLD, found by
// their pixel and their ordinal, and their lanes in the world's ids - a location index, a block a cell of their 8 x 8 grid,
// the plane their location stands on. A town lies wholly inside the pixel its centre is on (settlementGen.js), so that
// pixel is its location. Read on the thread that installed the bakes (gen2Ground.js gen2Install).
import { gen2Regions, gen2Stamp } from '../gen2/gen2Ground.js';
import { kernelUnits } from '../gen2/regionSampler.js';
import { worldPixelKey } from '../worldWide/worldGrid.js';
import { STREAMING_TERRAIN_SCALE, MAX_TERRAIN_HEIGHT } from '../terrain/terrainSampler.js';
import { SETTLEMENT_ORDINAL_MAX } from '../gen2/settle/buildingRecord.js';

/** Location indices count down from here, past the capitals' (tamrielCapitals.js -41,000,000). */
export const SETTLE2_INDEX_BASE = 42_000_000;
/** Block indices from here, a town's 64 cells each - past the Imperial City's lake (world/imperialBlocks.js 2,200,000). */
export const SETTLE2_BLOCK_INDEX = 2_300_000;
/** A town's location index. @param {number} ordinal */
export const settle2LocationIndex = (ordinal) => -(SETTLE2_INDEX_BASE + ordinal);

const NAME = /^WG2S([0-9A-Z]{4})([0-7])([0-7])\.RMB$/;
/** A town's block at its grid cell (bx east, by from the south): `WG2S` + its ordinal in four base-36 digits + bx + by.
 *  @param {number} ordinal @param {number} bx @param {number} by */
export const settle2BlockName = (ordinal, bx, by) => `WG2S${ordinal.toString(36).toUpperCase().padStart(4, '0')}${bx}${by}.RMB`;
/** A name's ordinal and cell, or null for none of ours. @param {string} name */
export function settle2BlockOf(name) {
  const m = NAME.exec(String(name));
  if (!m) return null;
  const ordinal = parseInt(m[1], 36);
  return ordinal >= 1 && ordinal <= SETTLEMENT_ORDINAL_MAX ? { ordinal, bx: Number(m[2]), by: Number(m[3]) } : null;
}
/** A block's fixed index. @param {number} ordinal @param {number} bx @param {number} by */
export const settle2BlockIndex = (ordinal, bx, by) => SETTLE2_BLOCK_INDEX + ordinal * 64 + by * 8 + bx;
/** The cell a fixed index names, or null. @param {number} index */
export function settle2BlockAt(index) {
  const k = index - SETTLE2_BLOCK_INDEX, ordinal = Math.floor(k / 64), c = k - ordinal * 64;
  return Number.isInteger(index) && k >= 64 && ordinal <= SETTLEMENT_ORDINAL_MAX ? { ordinal, bx: c % 8, by: Math.floor(c / 8) } : null;
}

/** The scene's metres (a pixel's own frame) of a height over the sea: the kernel's units at the streaming scale. @param {number} z */
export const sceneOf = (z) => kernelUnits(z) * STREAMING_TERRAIN_SCALE;
/** What a normalised sample of the ground is in the scene's metres (scenes/world.js worldHeight). */
export const WORLD_HEIGHT = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
/** THE PLANE a town's location stands on (the scene's metres): its plaza's level. Its models are laid from it to their
 *  own levels, and its ground is the region's (terrain/terrainGen.js, `own`). @param {any} town */
export const settle2Base = (town) => sceneOf(town.plaza.level);

let _index = { stamp: /** @type {?string} */ (null), byOrdinal: new Map(), byPixel: new Map() };
/** The installed towns by ordinal and by pixel; the first region's where two would share one. */
function index() {
  const stamp = gen2Stamp();
  if (_index.stamp === stamp) return _index;
  const byOrdinal = new Map(), byPixel = new Map();
  for (const region of gen2Regions()) {
    for (const town of region.towns ?? []) {
      const px = Math.floor(town.centre.x), py = Math.floor(town.centre.y), k = worldPixelKey(px, py);
      if (byPixel.has(k) || byOrdinal.has(town.ordinal)) { console.warn(`[wg2] ${town.id} shares its pixel or ordinal; it stands nowhere`); continue; }
      const at = { town, region, px, py };
      byOrdinal.set(town.ordinal, at);
      byPixel.set(k, at);
    }
  }
  return (_index = { stamp, byOrdinal, byPixel });
}
/** The town on a pixel - `{ town, region, px, py }` - or null. @param {number} px @param {number} py */
export const settle2TownAt = (px, py) => index().byPixel.get(worldPixelKey(px, py)) ?? null;
/** A town by its ordinal, or null. @param {number} ordinal */
export const settle2TownOf = (ordinal) => index().byOrdinal.get(ordinal) ?? null;
/** Every installed town, in its regions' order. */
export const settle2Towns = () => [...index().byOrdinal.values()];
