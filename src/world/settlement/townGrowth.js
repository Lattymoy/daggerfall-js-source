// @ts-check
// RMB-CONTRACTS RMBC6 (2026-10-31, bible/03-World/RMB-Contracts.md RD-18, RD-19): A TOWN GROWS. Every city, town and
// village keeps its legacy core whole - its blocks, its buildings and their keys (RD-9) - and its outskirts are laid out
// round it in rings on the land its pixel leaves: never on a road, the town's own ground, a camp or water, never within
// GROWTH_MARGIN of the pixel's edge, so the carve and its ease meet no neighbour. Worker-safe (world/ alone): the terrain
// worker lays the outskirts out and carves them; the host dresses the same layout from the same input.
import { hash32 } from '../blockHash.js';
import { layoutSettlement } from './settlementLayout.js';
import { carveSettlementGround } from './settlementGround.js';
import { sampleEnv, SAMPLE_M } from './settlementStand.js';
import { isOutdoorWaterTile } from '../terrain/terrainSurface.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, HEIGHTMAP_DIMENSION } from '../terrain/terrainSampler.js';

/** MAPS location types that grow (DFU DFRegion.LocationTypes): TownCity, TownHamlet, TownVillage. */
export const GROWTH_TYPES = Object.freeze([0, 1, 2]);
/** How far inside its pixel's edge an outskirts cell keeps, metres: a cell's diagonal and the carve's ease (28 m). */
export const GROWTH_MARGIN = 40;
/** The street between a town's rect and its core's square, metres. */
export const CORE_CLEAR = 6;
/** The tiles across a pixel. */
const TILES = HEIGHTMAP_DIMENSION - 1;
const UNIT_METRES = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;

/**
 * @typedef {{ place: number, name: string, type: number, style: string, seed: number, regionIndex: number, blocks: number }} GrowthJob - a town's
 * @typedef {{ xMin: number, xMax: number, yMin: number, yMax: number, mask?: Uint8Array|null }} TileRect - tiles, x east, y north
 */

/** The job of a built pixel's location (a MapsFile location), or null where it does not grow: a farm, a dungeon, a capital.
 *  @param {any} location @param {string} style its theatre's style key @param {number} regionIndex @returns {GrowthJob|null} */
export function townGrowthJob(location, style, regionIndex) {
  const type = location?.mapTableData?.locationType;
  if (!GROWTH_TYPES.includes(type) || location?.capital) return null;
  const place = location.mapTableData.mapId >>> 0, grid = location.exterior?.exteriorData;
  const blocks = Math.max(1, (grid?.width ?? 1) * (grid?.height ?? 1));   // RMBC8: its houses priced by its town's size
  return { place, name: String(location.name ?? ''), type, style, seed: hash32(place, 0x6e0b, type) >>> 0, regionIndex, blocks };
}

/**
 * The settlement input of a town's outskirts: the same from the same job, pixel and rect, on the worker and the host.
 * @param {GrowthJob} job @param {number} px @param {number} py @param {TileRect} rect @param {number} coreY its ground, metres
 */
export function growthInput(job, px, py, rect, coreY) {
  const centre = [((rect.xMin + rect.xMax) / 2) * SAMPLE_M, ((rect.yMin + rect.yMax) / 2) * SAMPLE_M];
  const half = (Math.max(rect.xMax - rect.xMin, rect.yMax - rect.yMin) / 2) * SAMPLE_M + CORE_CLEAR;
  const far = TILES * SAMPLE_M - GROWTH_MARGIN;
  return {
    place: job.place, origin: { px, py, east: 0, north: 0 }, seed: job.seed, archetype: 'outskirts', style: job.style,
    site: { east: centre[0], north: centre[1], radius: half * 2 }, roads: [], keys: /** @type {'anchored'} */ ('anchored'),   // RD-19: no ledger ships
    params: { bands: job.type === 0 ? 2 : 1, density: 0.7, open: 0.45 },   // a ring, two round a city; half its plots left open
    core: { centre, half, y: coreY }, bounds: { e0: GROWTH_MARGIN, e1: far, n0: GROWTH_MARGIN, n1: far },
  };
}

/**
 * What a cell may not take: a road's or track's tile, the town's own ground, a camp, a water tile.
 * @param {{ paths?: Uint8Array|null, mask?: Uint8Array|null, tilemap?: ArrayLike<number>|null, camps?: TileRect[] }} o
 */
export function growthBlocked({ paths = null, mask = null, tilemap = null, camps = [] }) {
  return (/** @type {number} */ e, /** @type {number} */ n) => {
    const x = Math.floor(e / SAMPLE_M), y = Math.floor(n / SAMPLE_M);
    if (x < 0 || y < 0 || x >= TILES || y >= TILES) return true;
    const i = y * TILES + x;
    if (paths?.[i] || mask?.[i] || (tilemap && isOutdoorWaterTile(tilemap[i]))) return true;
    return camps.some((camp) => x >= camp.xMin && x < camp.xMax && y >= camp.yMin && y < camp.yMax);
  };
}

/**
 * Lay a town's outskirts out on its pixel's ground and carve them in place; null where none stands (no room, no fit).
 * The town's rect and its ground mask are never carved.
 * @param {number} px @param {number} py @param {Float32Array} samples normalized, `x * 129 + y` @param {GrowthJob} job
 * @param {TileRect} rect @param {Parameters<typeof growthBlocked>[0]} bars
 */
export function standTownGrowth(px, py, samples, job, rect, bars) {
  const env = { ...sampleEnv(samples), blockedAt: growthBlocked({ ...bars, mask: bars.mask ?? rect.mask ?? null }) };
  const centre = [((rect.xMin + rect.xMax) / 2) * SAMPLE_M, ((rect.yMin + rect.yMax) / 2) * SAMPLE_M];
  const input = growthInput(job, px, py, rect, Math.round(env.heightAt(centre[0], centre[1]) * 100) / 100);
  const layout = layoutSettlement(input, env);
  const built = layout.pads.filter((pad) => !pad.legacy);
  if (built.length < 2) return null;
  const mask = bars.mask ?? rect.mask ?? null, core = /** @type {NonNullable<typeof layout.core>} */ (layout.core);
  // a sample is a corner of four tiles: kept when any of them is the town's, so a kept tile's whole surface stands
  const keep = (/** @type {number} */ e, /** @type {number} */ n) => {
    if (Math.abs(e - core.centre[0]) <= core.half && Math.abs(n - core.centre[1]) <= core.half) return true;
    const atX = Math.round(e / SAMPLE_M), atY = Math.round(n / SAMPLE_M);
    return !!mask && [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => {
      const x = atX + dx, y = atY + dy;
      return x >= 0 && y >= 0 && x < TILES && y < TILES && !!mask[y * TILES + x];
    });
  };
  const metres = Float64Array.from(samples, (sample) => sample * UNIT_METRES);
  carveSettlementGround(metres, HEIGHTMAP_DIMENSION, SAMPLE_M, { pads: layout.pads, origin: input.origin }, layout.datum, keep);
  // the carve as a record's frame reads it (landforms.js settlementMovedField's units): kernel units, x * 129 + y
  const moved = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const now = Math.fround(metres[i] / UNIT_METRES);
    if (now !== samples[i]) { moved[i] = (now - samples[i]) * MAX_TERRAIN_HEIGHT; samples[i] = now; }
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const pad of built) for (const [e, n] of pad.poly) { x0 = Math.min(x0, e); x1 = Math.max(x1, e); y0 = Math.min(y0, n); y1 = Math.max(y1, n); }
  const tile = (/** @type {number} */ metresAt) => Math.max(1, Math.min(TILES - 1, Math.round(metresAt / SAMPLE_M)));
  return { mapId: job.place, ordinal: -1, growth: true, job, input, layout, moved, rect: { xMin: tile(x0), xMax: tile(x1), yMin: tile(y0), yMax: tile(y1) } };
}

/** RMBC6: the trees' clearing of a grown town - its rect and its outskirts' as one, the outline's clearing given up for it;
 *  the location's own where it did not grow. @param {any} locationRect @param {any} settlement */
export function growthClearing(locationRect, settlement) {
  if (!locationRect || !settlement?.growth) return locationRect;
  const grown = settlement.rect;
  return { xMin: Math.min(locationRect.xMin, grown.xMin), xMax: Math.max(locationRect.xMax, grown.xMax), yMin: Math.min(locationRect.yMin, grown.yMin), yMax: Math.max(locationRect.yMax, grown.yMax) };
}

/**
 * RMBC6: how far a grown town's carve moved the ground at a scene point, metres - its build's own `moved` field, read
 * between its samples; 0 where its pixel is not built or did not grow (a record there re-stands when it is).
 * @param {any} settlement a built pixel's @param {number[]} origin its translation @param {number} x @param {number} z
 * @param {number} cell a sample's spacing in scene units
 */
export function grownMovedAt(settlement, origin, x, z, cell) {
  const field = settlement?.growth ? settlement.moved : null;
  if (!field) return 0;
  const dim = HEIGHTMAP_DIMENSION, cellX = (x - origin[0]) / cell, cellY = (z - origin[2]) / cell;
  if (!(cellX >= 0 && cellY >= 0 && cellX <= dim - 1 && cellY <= dim - 1)) return 0;
  const x0 = Math.min(dim - 2, Math.floor(cellX)), y0 = Math.min(dim - 2, Math.floor(cellY)), partX = cellX - x0, partY = cellY - y0;
  const at = (a, b) => field[a * dim + b];
  const height = (at(x0, y0) * (1 - partX) + at(x0 + 1, y0) * partX) * (1 - partY) + (at(x0, y0 + 1) * (1 - partX) + at(x0 + 1, y0 + 1) * partX) * partY;
  return height * STREAMING_TERRAIN_SCALE;
}
