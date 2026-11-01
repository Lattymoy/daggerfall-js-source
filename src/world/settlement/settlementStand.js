// @ts-check
// A SETTLEMENT ON ITS PIXEL, IN THE TERRAIN WORKER.
// A pixel no location stands on and a settlement does: its layout made on the pixel's own natural ground (the samples
// after the roads, before any carve), its pads carved into that ground, and the layout and the trees' clearing handed back
// with the pixel. Called by world/terrain/terrainGen.js generatePixelTerrain. Worker-safe: world/ alone.
import { settlementOnPixel, settlementInput } from './settlementPlaces.js';
import { layoutSettlement } from './settlementLayout.js';
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
 * @returns {{ mapId: number, ordinal: number, layout: ReturnType<typeof layoutSettlement>, rect: { xMin: number, xMax: number, yMin: number, yMax: number } }|null}
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
  for (let i = 0; i < samples.length; i++) { const v = Math.fround(metres[i] / M); if (v !== samples[i]) samples[i] = v; }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of layout.pads) for (const [e, n] of p.poly) { x0 = Math.min(x0, e); x1 = Math.max(x1, e); y0 = Math.min(y0, n); y1 = Math.max(y1, n); }
  const tile = (m) => Math.max(1, Math.min(127, Math.round(m / SAMPLE_M)));
  return { mapId: input.place, ordinal: row.ordinal, layout, rect: { xMin: tile(x0), xMax: tile(x1), yMin: tile(y0), yMax: tile(y1) } };
}
