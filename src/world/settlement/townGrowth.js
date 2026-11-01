// @ts-check
// A TOWN GROWS. Every city, town and
// village keeps its legacy core whole - its blocks, its buildings and their keys - and its outskirts are laid out
// round it along its roads on the land its pixel leaves: never on the town's own ground, a camp or water (a road crosses a cell,
// its plots beside it), never within
// GROWTH_MARGIN of the pixel's edge, so the carve and its ease meet no neighbour. Worker-safe (world/ alone): the terrain
// worker lays the outskirts out and carves them; the host dresses the same layout from the same input.
import { hash32 } from '../blockHash.js';
import { dsin, dcos } from './exactMath.js';
import { layoutSettlement, rectEdge } from './settlementLayout.js';
import { carveSettlementGround } from './settlementGround.js';
import { sampleEnv, SAMPLE_M, SEA_M } from './settlementStand.js';
import { isOutdoorWaterTile } from '../terrain/terrainSurface.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, HEIGHTMAP_DIMENSION } from '../terrain/terrainSampler.js';

/** MAPS location types that grow (DFU DFRegion.LocationTypes): TownCity, TownHamlet, TownVillage. */
export const GROWTH_TYPES = Object.freeze([0, 1, 2]);
/** How far inside its pixel's edge an outskirts cell keeps, metres: a cell's diagonal and the carve's ease (28 m). */
export const GROWTH_MARGIN = 40;
/** The street between a town's rect and its core's rectangle, metres. */
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
  const blocks = Math.max(1, (grid?.width ?? 1) * (grid?.height ?? 1));   // Its houses priced by its town's size
  return { place, name: String(location.name ?? ''), type, style, seed: hash32(place, 0x6e0b, type) >>> 0, regionIndex, blocks };
}

/**
 * The settlement input of a town's outskirts: the same from the same job, pixel and rect, on the worker and the host.
 * @param {GrowthJob} job @param {number} px @param {number} py @param {TileRect} rect @param {number} coreY its ground, metres
 * @param {number[]} [roads] the bearings its roads leave by (roadsOut)
 */
export function growthInput(job, px, py, rect, coreY, roads = []) {
  const centre = coreCentre(rect), half = coreHalf(rect), far = TILES * SAMPLE_M - GROWTH_MARGIN;
  return {
    place: job.place, origin: { px, py, east: 0, north: 0 }, seed: job.seed, archetype: 'outskirts', style: job.style,
    site: { east: centre[0], north: centre[1], radius: Math.max(...half) * 2 }, roads, keys: /** @type {'anchored'} */ ('anchored'),   // No ledger ships
    params: { bands: job.type === 0 ? 4 : 3, density: 0.7, open: 0.4 },   // as deep as its roads lead, thinning off them
    core: { centre, half, y: coreY, clear: CORE_CLEAR }, bounds: { e0: GROWTH_MARGIN, e1: far, n0: GROWTH_MARGIN, n1: far },
  };
}

/** A town's core: its rect's middle, and its half sides east and north with a street round it, metres. @param {TileRect} rect */
export const coreCentre = (rect) => [((rect.xMin + rect.xMax) / 2) * SAMPLE_M, ((rect.yMin + rect.yMax) / 2) * SAMPLE_M];
export const coreHalf = (/** @type {TileRect} */ rect) => [((rect.xMax - rect.xMin) / 2) * SAMPLE_M + CORE_CLEAR, ((rect.yMax - rect.yMin) / 2) * SAMPLE_M + CORE_CLEAR];

/**
 * the bearings a town's roads leave it by, degrees clockwise from north - its path tiles met a street past its core's
 * edge all round, each run of them one road at its middle; none where no path or every way is one.
 * @param {Uint8Array|null} paths @param {number[]} centre @param {number[]} half its core's half sides
 */
export function roadsOut(paths, centre, half) {
  if (!paths) return [];
  const steps = 360, hit = new Uint8Array(steps);
  for (let a = 0; a < steps; a++) {
    const angle = (a / steps) * 2 * Math.PI, radius = rectEdge(half, angle) + 12;
    const x = Math.floor((centre[0] + radius * dsin(angle)) / SAMPLE_M), y = Math.floor((centre[1] + radius * dcos(angle)) / SAMPLE_M);
    hit[a] = x >= 0 && y >= 0 && x < TILES && y < TILES && paths[y * TILES + x] ? 1 : 0;
  }
  const first = hit.indexOf(0);
  if (first < 0) return [];
  const out = [];
  for (let k = 1, start = -1; k <= steps; k++) {
    const a = (first + k) % steps;
    if (hit[a] && start < 0) start = k;
    if (!hit[a] && start >= 0) { out.push((((first + (start + k - 1) / 2) % steps) * 360) / steps); start = -1; }
  }
  return out;
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
 * @param {TileRect} rect @param {Parameters<typeof growthBlocked>[0] & { wet?: ((e: number, n: number) => boolean)|null }} bars - `wet` its rivers and lakes
 */
export function standTownGrowth(px, py, samples, job, rect, bars) {
  // a road bars a building, never a cell - the town's ground, a camp and water bar the cell
  const roads = bars.paths ?? null;
  const env = { ...sampleEnv(samples, bars.wet ?? null), blockedAt: growthBlocked({ ...bars, paths: null, mask: bars.mask ?? rect.mask ?? null }), roadAt: roads ? growthBlocked({ paths: roads }) : undefined };
  const centre = coreCentre(rect), half = coreHalf(rect);
  const input = growthInput(job, px, py, rect, Math.round(env.heightAt(centre[0], centre[1]) * 100) / 100, roadsOut(bars.paths ?? null, centre, half));
  const layout = layoutSettlement(input, env);
  const built = layout.pads.filter((pad) => !pad.legacy);
  if (built.length < 2) return null;
  const mask = bars.mask ?? rect.mask ?? null, core = /** @type {NonNullable<typeof layout.core>} */ (layout.core);
  // a sample is a corner of four tiles: kept when any of them is the town's, so a kept tile's whole surface stands
  const keep = (/** @type {number} */ e, /** @type {number} */ n) => {
    if (Math.abs(e - core.centre[0]) <= core.half[0] && Math.abs(n - core.centre[1]) <= core.half[1]) return true;
    const atX = Math.round(e / SAMPLE_M), atY = Math.round(n / SAMPLE_M);
    return !!mask && [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => {
      const x = atX + dx, y = atY + dy;
      return x >= 0 && y >= 0 && x < TILES && y < TILES && !!mask[y * TILES + x];
    });
  };
  const metres = Float64Array.from(samples, (sample) => sample * UNIT_METRES);
  carveSettlementGround(metres, HEIGHTMAP_DIMENSION, SAMPLE_M, { pads: layout.pads, origin: input.origin }, layout.datum, keep, SEA_M, bars.wet ?? null);
  // the carve as a record's frame reads it (settlementStand.js settlementMovedAt's units): kernel units, x * 129 + y
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

/** The trees' clearing of a grown town - its rect and its outskirts' as one, the outline's clearing given up for it;
 *  the location's own where it did not grow. @param {any} locationRect @param {any} settlement */
export function growthClearing(locationRect, settlement) {
  if (!locationRect || !settlement?.growth) return locationRect;
  const grown = settlement.rect;
  return { xMin: Math.min(locationRect.xMin, grown.xMin), xMax: Math.max(locationRect.xMax, grown.xMax), yMin: Math.min(locationRect.yMin, grown.yMin), yMax: Math.max(locationRect.yMax, grown.yMax) };
}

/** The ground a built pixel's settlement keeps (its town and outskirts as one, or a published settlement's own), the
 *  kernel's trees' clearing - herbs and ore keep off it too. @param {any} entry a built pixel's */
export const settlementClearing = (entry) => growthClearing(entry?.locationRect ?? null, entry?.settlement) ?? entry?.settlement?.rect ?? null;

