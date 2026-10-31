// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MID-RING (2026-10-26, the owner: "we need to find a way to expand the overworld view distance without killing
// performance. Currently tiles visibly load in with distance"; bible/06-Systems/Travel-View.md MID-RING):
// THE MIDDLE RING'S GROUND - the streamed kernel's own heights, coarse, past the streamed grid.
//
// Past the streamed grid (Land View 5: 4.5 km) the horizon was the far ring alone (render/farRing.js EV8): one vertex a
// map pixel, 819 m apart, at the byte's macro height - the large heightmap's noise and the ground's own left out - so a
// pixel the stream built stood up out of a flat-faceted lowland as it landed, every hill at once. The middle ring is
// the same ground the stream builds, at MID_SUB cells a pixel side: each vertex is the pixel's own kernel
// (terrainSampler.js sampleKernel - the small heightmap's bicubic, the large one's, the ground noise, the ocean's floor,
// and with `landforms` the landforms' shaping, world/landforms.js) at a whole sample, so where the stream builds the
// pixel its ground lands on the shape the middle ring already showed. What it leaves out is a pixel's own build: a
// town's flattening, a road's bed, the trees - the ring is the land, as the far ring is.
//
// WORKER-SAFE: pure, node-tested modules only (the terrain worker runs it - world/terrain/terrainGenWorker.js 'midring').
// ═══════════════════════════════════════════════════════════════════

import {
  sampleKernel,
  HEIGHTMAP_DIMENSION,
  MAX_TERRAIN_HEIGHT,
  STREAMING_TERRAIN_SCALE,
  TERRAIN_SIZE,
} from './terrainSampler.js';
import { nodeGroundAt } from '../landforms.js'; // RELIEF-PEAKS: the far field's vertex on the kernel's own ground at its node

/** The middle ring's radius in map pixels round its base - 14: 11.5 km of the kernel's own ground every way. */
export const MID_RADIUS = 14;
/** Cells a pixel side - 8: a vertex every 102.4 m, every sixteenth of the kernel's 129 samples. */
export const MID_SUB = 8;
/** How far (pixels) the traveller drifts from the base before the ring is built again round them. */
export const MID_REBUILD_DRIFT = 3;

/** Vertices a side of a ring of `radius` pixels at `sub` cells a pixel. */
export const midRingSide = (radius = MID_RADIUS, sub = MID_SUB) => (2 * radius + 1) * sub + 1;

/** A pixel's own samples for the ring: (sub + 1) x (sub + 1), row j (north) by column i (east) - its kernel at whole
 *  samples (i, j) x the step, in world units. What a pixel's ring answers is this pixel's alone, so a worker keeps it by
 *  the pixel across the ring's rebuilds (terrainGenWorker.js). */
export function midRingPixel(woods, px, py, sub = MID_SUB, landforms = null) {
  const step = (HEIGHTMAP_DIMENSION - 1) / sub,
    world = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE,
    w = sub + 1;
  const kernel = sampleKernel(woods, px, py, HEIGHTMAP_DIMENSION, true, landforms);
  const out = new Float32Array(w * w);
  for (let j = 0; j <= sub; j++) for (let i = 0; i <= sub; i++) out[j * w + i] = kernel(i * step, j * step) * world;
  return out;
}

/** The vertex rows a band of the ring's pixel rows [pj0, pj1) holds - a row of pixels its sub rows, the last row of the
 *  ring its closing one too. */
export const midRingBandRows = (pj0, pj1, radius = MID_RADIUS, sub = MID_SUB) =>
  (pj1 - pj0) * sub + (pj1 === 2 * radius + 1 ? 1 : 0);

/**
 * The ring's heights, world units, row by row from its south-west corner: vertex (gx, gz) is the pixel
 * (baseX - radius + floor(gx / sub), baseY + radius - floor(gz / sub)) at its own sample (gx % sub, gz % sub) x the
 * sample step - x east, z north, the streamed pixel's own local frame (world/terrain/terrainSurface.js buildTerrainGrid:
 * sample (x, z) at (x, z) x the cell). A pixel's last row and column are its neighbour's first (the kernel's seam law:
 * x = 128 of one pixel is x = 0 of the next), so each vertex is read once, from the pixel it opens. `rows` a band of
 * pixel rows [pj0, pj1) (the vertex rows it holds, midRingBandRows) - the worker answers a ring a band at a time, so the
 * stream's own jobs run between its bands; `pixel` a pixel's samples (midRingPixel, or a worker's kept copy of them).
 * MAP-WATERS: `Kind` the array the samples are laid in - a pixel's water flags (farClimate.js midRingWet) the same way.
 * @param {{ woods: any, baseX: number, baseY: number, radius?: number, sub?: number, landforms?: any, rows?: ?[number, number], pixel?: (px: number, py: number) => ArrayLike<number>, Kind?: Float32ArrayConstructor | Uint8ArrayConstructor }} o
 * @returns {Float32Array | Uint8Array}
 */
export function buildMidRingHeights({
  woods,
  baseX,
  baseY,
  radius = MID_RADIUS,
  sub = MID_SUB,
  landforms = null,
  rows = null,
  pixel = (px, py) => midRingPixel(woods, px, py, sub, landforms),
  Kind = Float32Array,
}) {
  const n = 2 * radius + 1,
    side = n * sub + 1,
    w = sub + 1;
  const [pj0, pj1] = rows ?? [0, n];
  const out = new Kind(midRingBandRows(pj0, pj1, radius, sub) * side);
  for (let pj = pj0; pj < pj1; pj++) {
    const py = baseY + radius - pj;
    for (let pi = 0; pi < n; pi++) {
      const px = baseX - radius + pi,
        own = pixel(px, py);
      const lastI = pi === n - 1 ? sub : sub - 1,
        lastJ = pj === n - 1 ? sub : sub - 1;
      for (let j = 0; j <= lastJ; j++) {
        const row = ((pj - pj0) * sub + j) * side + pi * sub;
        for (let i = 0; i <= lastI; i++) out[row + i] = own[j * w + i];
      }
    }
  }
  return out;
}

/** FAR-FIELD (BREATHTAKER 1, KPbICA's spec through the owner, 2026-10-26: "render landscapes and landforms way further
 *  than actual distance to load. To see the mountain from 300km"): THE FAR FIELD past the far ring - the heightmap a cell
 *  of FAR_CELL pixels at a time, out to FAR_RADIUS cells (393 km) round its base cell; its sea the majority's.
 *  RELIEF-PEAKS: a cell's vertex stands on the ground the kernel stands at its own point - its centre is the node of the
 *  byte north-west of it (`farFieldCell`'s `ground`, world/landforms.js nodeGroundAt). It stood at the highest of its nine
 *  samples' bytes, the far ring's law: up to a cell's whole relief over the ground at its vertex, and the large map left
 *  out - so the far field stood over the far ring at their meeting, and drew land above the horizon the ground has. */
export const FAR_CELL = 8;
export const FAR_RADIUS = 60;
/** How far (cells) the traveller drifts from the far field's base cell before it is built again round them. */
export const FAR_REBUILD_DRIFT = 2;
/** The pixels of a cell its height is read at, each way (nine a cell): past the Bay the heightmap's reader is the
 *  continent's authored ground (six microseconds a pixel), so a cell's 64 pixels would cost the field six seconds. */
export const FAR_SAMPLES = Object.freeze([1, 4, 6]);
/** Vertices a side of the far field - a vertex a cell, on the cell's own centre (world-fixed: a rebuild moves none). */
export const farFieldSide = (radius = FAR_RADIUS) => 2 * radius + 1;

/** A cell's climate left to the main thread's own reader (farFieldCell's third answer where the worker has none). */
export const FAR_CLIMATE_ASK = 255;

/** A cell's [its vertex's byte, samples at the sea's floor, its centre's climate, its vertex's ground] off the heightmap's
 *  own reader (`woods.getHeightMapValue` - the stream's ground past the Bay and the Eltheric Ocean's, as every kernel reads
 *  it; the clamp at the map's edge where the reader has none): the sea's count at FAR_SAMPLES, `climateAt` at the centre
 *  pixel (FAR_CLIMATE_ASK where it answers none, or none is handed), and RELIEF-PEAKS the byte whose node the vertex
 *  stands on (the cell's centre, a pixel corner: the byte north-west of it) with its ground there in world units
 *  (world/landforms.js nodeGroundAt - with `relief`, the Landforms row, the lift) - the cell's own, so a worker keeps it by
 *  the cell across the rebuilds. */
export function farFieldCell(woods, cx, cy, cell = FAR_CELL, seaByte = 0, climateAt = null, relief = false) {
  let n = 0;
  for (const v of FAR_SAMPLES)
    for (const u of FAR_SAMPLES) if (woods.getHeightMapValue(cx * cell + u, cy * cell + v) <= seaByte) n++;
  const nx = cx * cell + cell / 2 - 1,
    ny = cy * cell + cell / 2 - 1,
    byteAt = (x, y) => woods.getHeightMapValue(x, y);
  const c = climateAt ? climateAt(Math.floor(cx * cell + cell / 2), Math.floor(cy * cell + cell / 2)) : FAR_CLIMATE_ASK;
  return [byteAt(nx, ny), n, c, nodeGroundAt(byteAt, nx, ny, relief) * STREAMING_TERRAIN_SCALE];
}

/**
 * The far field's cells round (baseCX, baseCY) - cell (cx, cy) the pixels [cx * cell, cx * cell + cell) both ways - row
 * by row from the north-west (the far ring's own order: rows run south): each cell's vertex's byte (`high`), how many of its
 * samples are the sea's floor (`low`: at or under the byte the ocean clamps; FAR_SAMPLES.length ** 2 a cell), its centre's
 * climate (`clim`, FAR_CLIMATE_ASK where the reader `climateAt` answers none) and RELIEF-PEAKS its vertex's ground (`ground`,
 * world units - farFieldCell's; `relief` the Landforms row). `rows` a band [j0, j1) of the field's rows (a worker answers
 * it a band at a time); `cellAt` a cell's answer (farFieldCell, or a worker's kept copy).
 * @param {{ woods: any, baseCX: number, baseCY: number, radius?: number, cell?: number, seaByte?: number, rows?: ?[number, number], climateAt?: ?((x: number, y: number) => number), relief?: boolean, cellAt?: (cx: number, cy: number) => number[] }} o
 * @returns {{ high: Uint8Array, low: Uint8Array, clim: Uint8Array, ground: Float32Array }}
 */
export function buildFarFieldBytes({
  woods,
  baseCX,
  baseCY,
  radius = FAR_RADIUS,
  cell = FAR_CELL,
  seaByte = 0,
  rows = null,
  climateAt = null,
  relief = false,
  cellAt = (cx, cy) => farFieldCell(woods, cx, cy, cell, seaByte, climateAt, relief),
}) {
  const side = farFieldSide(radius),
    [j0, j1] = rows ?? [0, side];
  const high = new Uint8Array((j1 - j0) * side),
    low = new Uint8Array((j1 - j0) * side),
    clim = new Uint8Array((j1 - j0) * side),
    ground = new Float32Array((j1 - j0) * side);
  for (let j = j0; j < j1; j++) {
    for (let i = 0; i < side; i++) {
      const [m, n, c, g] = cellAt(baseCX - radius + i, baseCY - radius + j),
        o = (j - j0) * side + i;
      high[o] = m;
      low[o] = n;
      clim[o] = c;
      ground[o] = g;
    }
  }
  return { high, low, clim, ground };
}

/** The ring's normals off its heights by central differences at its own cell (one-sided at its rim) - the streamed
 *  grid's own law (buildTerrainGrid: nx = left - right, nz = down - up, ny = 2 x the span); into `out`, rows [z0, z1)
 *  (a stepped build's share), all of them by default. */
export function midRingNormals(
  heights,
  side,
  sub = MID_SUB,
  out = new Float32Array(side * side * 3),
  z0 = 0,
  z1 = side,
) {
  const cell = TERRAIN_SIZE / sub;
  const h = (x, z) => heights[Math.max(0, Math.min(side - 1, z)) * side + Math.max(0, Math.min(side - 1, x))];
  for (let z = z0; z < z1; z++) {
    for (let x = 0; x < side; x++) {
      const nx = h(x - 1, z) - h(x + 1, z),
        nz = h(x, z - 1) - h(x, z + 1),
        ny = 2 * cell;
      const l = Math.hypot(nx, ny, nz),
        o = (z * side + x) * 3;
      out[o] = nx / l;
      out[o + 1] = ny / l;
      out[o + 2] = nz / l;
    }
  }
  return out;
}
