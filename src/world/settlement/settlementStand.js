// @ts-check
// A SETTLEMENT ON ITS PIXEL, IN THE TERRAIN WORKER.
// A pixel no location stands on and a settlement does: its layout made on the pixel's own natural ground (the samples
// after the roads, before any carve), its pads carved into that ground, and the layout and the trees' clearing handed back
// with the pixel. Called by world/terrain/terrainGen.js generatePixelTerrain. Worker-safe: world/ alone.
import { settlementOnPixel, settlementInput } from './settlementPlaces.js';
import { layoutSettlement, yardTrees } from './settlementLayout.js';
import { hash32 } from '../blockHash.js';
import { carveSettlementGround } from './settlementGround.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, HEIGHTMAP_DIMENSION, TERRAIN_SIZE, SCALED_OCEAN_ELEVATION } from '../terrain/terrainSampler.js';

const M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
/** The sea's height in metres, and a sample's spacing. */
export const SEA_M = SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE;
export const SAMPLE_M = TERRAIN_SIZE / (HEIGHTMAP_DIMENSION - 1);

/** A pixel's ground for the generator: metres, bilinear between its samples (x east, y north); water under the sea's line.
 *  @param {ArrayLike<number>} samples normalized, `x * 129 + y` */
export function sampleEnv(samples) {
  const D = HEIGHTMAP_DIMENSION;
  const at = (x, y) => samples[Math.max(0, Math.min(D - 1, x)) * D + Math.max(0, Math.min(D - 1, y))] * M;
  const heightAt = (e, n) => {
    const x = e / SAMPLE_M, y = n / SAMPLE_M, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
  return { heightAt, waterAt: (e, n) => heightAt(e, n) < SEA_M + 0.5 };
}

/**
 * Lay out the pixel's settlement and carve its ground into `samples` in place; null where none stands.
 * @param {number} px @param {number} py @param {Float32Array} samples @param {(() => Float32Array)|null} [bare] the land with no road
 * @returns {{ mapId: number, ordinal: number, input: any, layout: ReturnType<typeof layoutSettlement>, moved: Float32Array, rect: { xMin: number, xMax: number, yMin: number, yMax: number } }|null}
 */
export function standSettlementGround(px, py, samples, bare = null) {
  const row = settlementOnPixel(px, py);
  if (!row) return null;
  const input = settlementInput(row, px, py);
  // Laid out on the land with no road cut into it (`bare()`, the kernel's), so its plan is its inputs' and the
  // land's whatever network a client stands; carved into the ground as it is
  const layout = layoutSettlement(input, sampleEnv(bare?.() ?? samples));
  const metres = Float64Array.from(samples, (s) => s * M);
  carveSettlementGround(metres, HEIGHTMAP_DIMENSION, SAMPLE_M, { pads: layout.pads, origin: input.origin }, layout.datum);
  const moved = new Float32Array(samples.length);   // what the carve moved each sample, as a grown town's: a record's move
  for (let i = 0; i < samples.length; i++) { const v = Math.fround(metres[i] / M); if (v !== samples[i]) { moved[i] = (v - samples[i]) * MAX_TERRAIN_HEIGHT; samples[i] = v; } }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of layout.pads) for (const [e, n] of p.poly) { x0 = Math.min(x0, e); x1 = Math.max(x1, e); y0 = Math.min(y0, n); y1 = Math.max(y1, n); }
  const tile = (m) => Math.max(1, Math.min(127, Math.round(m / SAMPLE_M)));
  return { mapId: input.place, ordinal: row.ordinal, input, layout, moved, rect: { xMin: tile(x0), xMax: tile(x1), yMin: tile(y0), yMax: tile(y1) } };
}

/** The tree records every climate's nature archive holds (terrainNature.js TREE_RECORDS), so a yard tree is a tree there. */
export const YARD_TREE_RECORDS = Object.freeze([13, 30]);

/**
 * A pixel's settlement's yard trees as its nature flats (pixel-local, x east, z north): each the land's own tree picture
 * on its pad's top, so the seasons, the wind and the axe treat it as the woods around it.
 * @param {{ input?: any, layout?: any } | null} settlement a stood pixel's @returns {Array<{ record: number, x: number, y: number, z: number }>}
 */
export function settlementTreeFlats(settlement) {
  if (!settlement?.input || !settlement.layout) return [];
  const top = new Map(settlement.layout.pads.map((pad) => [pad.id, settlement.layout.datum + pad.y]));
  return yardTrees(settlement.input, settlement.layout).map((tree) => ({
    record: YARD_TREE_RECORDS[hash32(...[...tree.id].map((char) => char.charCodeAt(0))) % YARD_TREE_RECORDS.length], x: tree.at[0], y: /** @type {number} */ (top.get(tree.pad)), z: tree.at[1],
  }));
}

/**
 * How far a built pixel's settlement carve moved the ground at a scene point, metres - its build's own `moved` field,
 * read between its samples; 0 off the pixel or where none stands.
 * @param {any} settlement a built pixel's @param {number[]} origin its translation @param {number} x @param {number} z
 * @param {number} cell a sample's spacing in scene units
 */
export function settlementMovedAt(settlement, origin, x, z, cell) {
  const field = settlement?.moved;
  if (!field) return 0;
  const dim = HEIGHTMAP_DIMENSION, cellX = (x - origin[0]) / cell, cellY = (z - origin[2]) / cell;
  if (!(cellX >= 0 && cellY >= 0 && cellX <= dim - 1 && cellY <= dim - 1)) return 0;
  const x0 = Math.min(dim - 2, Math.floor(cellX)), y0 = Math.min(dim - 2, Math.floor(cellY)), partX = cellX - x0, partY = cellY - y0;
  const at = (a, b) => field[a * dim + b];
  const height = (at(x0, y0) * (1 - partX) + at(x0 + 1, y0) * partX) * (1 - partY) + (at(x0, y0 + 1) * (1 - partX) + at(x0 + 1, y0 + 1) * partX) * partY;
  return height * STREAMING_TERRAIN_SCALE;
}
