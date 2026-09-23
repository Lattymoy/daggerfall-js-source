// @ts-check
// LC1 (2026-09-23, Mac: "We need to take a chance and also make some insane improvements to our lighting system.
// Its already really good, but it could be much better while also improving performance"): CLUSTERED LIGHTS -
// the first step, and the foundation the rest stand on.
//
// THE COST IT REMOVES. Every lit fragment of the lane (enhancedLighting.js EL_POINT_LIT_GLSL) walked ALL of the
// frame's lights - up to EL_MAX_LIGHTS (48) - and asked each one "am I in your range" before doing any work. On a
// 1080p frame that is two million fragments times forty-eight lengths and compares, for a question whose answer
// is "no" for nearly all of them: a tavern's fragment is in range of three lanterns, a street's of one or two.
// And the cap was the loop's, so the world could never carry more lights than a fragment could afford to ask.
//
// THE SHAPE. The view frustum is cut into a grid of CLUSTER_X x CLUSTER_Y x CLUSTER_Z cells ("froxels": a tile
// of the screen by a slice of depth - the slices are exponential, thin near the eye and wide far off, so a cell
// is roughly a cube in world units at every distance). Once a frame, on the CPU, every light's sphere is projected
// into the cells it can touch and its index is written into each of their lists. The lists go to the GPU as two
// small integer textures: the GRID (one texel per cell: the offset and the count of its list) and the LIST (the
// light indices, in cell order). A fragment reads its own cell off gl_FragCoord and its view depth, and walks that
// cell's list alone - the same loop body as before, over two or three lights instead of forty-eight. The answer
// is bit-for-bit the same lit colour up to float summation order (tools/lightClusterProbe.mjs reads both back).
//
// CONSERVATIVE, NEVER LOSSY. A light is written into every cell its view-space bounding box touches: the box's
// eight corners, clamped to the near plane, are projected with the frame's own projection (the mirrored one the
// hosts pass - the same matrix the fragments went through), and the box's extent on screen is the hull of those
// corners. A fragment inside the sphere is inside the box, so its cell lists the light; a fragment outside the
// sphere but inside the box still runs the range test in the loop, which says no as it always did. The grid is
// therefore an ACCELERATION of the old loop and not a new lighting law: nothing lights that did not, nothing that
// lit goes dark.
//
// WHEN IT IS OFF. The grid is built for a WORLD frame on the lane (renderer.beginFrame, WORLD_FRAME); inside the
// character-sprite pass, the studio bake or a panel bracket - other views, other viewports - the shader's
// `uClusterOn` is 0 and the loop walks every light exactly as it did before LC1. The same fallback covers a
// frame whose lists would overflow CLUSTER_LIST_CAP (forty-eight lights each covering the whole screen), and the
// `?clusters=off` door, for a comparison on a real GPU. There is no third behaviour.
//
// Not a DFU member: Daggerfall Unity lights on Unity's forward renderer, which culls its own lights per object.
// Ledger A row (ENHANCED).

/** The grid: 16 tiles across, 9 down (a 16:9 tile is square at 16:9), 24 depth slices. 3456 cells. */
export const CLUSTER_X = 16;
export const CLUSTER_Y = 9;
export const CLUSTER_Z = 24;
export const CLUSTER_CELLS = CLUSTER_X * CLUSTER_Y * CLUSTER_Z;
/** The depth the slices span, in view units: the first slice ends near the eye, the last past every lantern's
 *  range (SHADOW_CASTER_MAX_RANGE is 120; a fragment beyond CLUSTER_FAR falls in the last slice). Exponential:
 *  slice k begins at NEAR * (FAR / NEAR)^(k / CLUSTER_Z). */
export const CLUSTER_NEAR = 0.25;
export const CLUSTER_FAR = 256;
/** The list texture: 256 wide, CLUSTER_LIST_ROWS tall, one byte (a light index) per texel. 64K entries is 48 lights each
 *  covering a third of the cells; a frame past it falls back to the plain loop rather than to a wrong list. */
export const CLUSTER_LIST_W = 256;
export const CLUSTER_LIST_ROWS = 256;
export const CLUSTER_LIST_CAP = CLUSTER_LIST_W * CLUSTER_LIST_ROWS;
/** The grid texture: one texel per cell, laid out (x + y * CLUSTER_X, z) - CLUSTER_X * CLUSTER_Y wide, CLUSTER_Z tall. */
export const CLUSTER_GRID_W = CLUSTER_X * CLUSTER_Y;
export const CLUSTER_GRID_H = CLUSTER_Z;
/** The two texture units the world shaders read the grid and the list on - below the air's (11, 12), the shadow
 *  maps' (13, 14) and the cloud shadow's (15), above the material units. */
export const CLUSTER_GRID_UNIT = 9;
export const CLUSTER_LIST_UNIT = 10;

const LOG_FAR_NEAR = Math.log(CLUSTER_FAR / CLUSTER_NEAR);
/** The shader's z parameters: depth * x, then log * y is the slice. */
export const CLUSTER_Z_SCALE = CLUSTER_Z / LOG_FAR_NEAR;

/** The URL door: `?clusters=off` walks every light in every fragment, as before LC1 (the air's `?air=off` shape). */
export function clustersOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('clusters') !== 'off';
}

/** The depth slice a view depth falls in, the shader's own arithmetic (elCluster): the log of the depth over
 *  the near, scaled - clamped to the grid at both ends. */
export function sliceOf(depth) {
  if (!(depth > CLUSTER_NEAR)) return 0;
  const k = Math.floor(Math.log(depth / CLUSTER_NEAR) * CLUSTER_Z_SCALE);
  return k < 0 ? 0 : k >= CLUSTER_Z ? CLUSTER_Z - 1 : k;
}

/** The cell index of (tile x, tile y, slice z). */
export const clusterCellOf = (x, y, z) => x + y * CLUSTER_X + z * CLUSTER_X * CLUSTER_Y;

/** The workspace a renderer keeps and the builder fills: the per-cell counts, the grid texels (offset, count as
 *  uint16 pairs), the list, and what the last build found. */
export function createClusterSpace() {
  return {
    counts: new Uint16Array(CLUSTER_CELLS),
    grid: new Uint16Array(CLUSTER_CELLS * 2),
    list: new Uint8Array(CLUSTER_LIST_CAP),
    total: 0,        // list entries written
    lights: 0,       // lights that touched the grid at all
    rows: 0,         // list rows to upload
    built: false,    // the last build's answer
    _box: new Int16Array(6 * 64),   // per light: x0 x1 y0 y1 z0 z1 (up to 64 lights; the lane's cap is 48)
  };
}

/** A view-space sphere's cells: writes [x0, x1, y0, y1, z0, z1] into `box` at `at`, answers false when the
 *  sphere is behind the near plane or off-screen. `proj` is the frame's projection (any: the hosts' are
 *  x-mirrored perspectives - the corners are put through the matrix itself, not through a fov). */
export function cellsOfSphere(vx, vy, vz, r, proj, box, at) {
  const depth = -vz;
  const dFar = depth + r;
  if (dFar < CLUSTER_NEAR) return false;
  const dNear = Math.max(depth - r, CLUSTER_NEAR);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let c = 0; c < 8; c++) {
    const x = c & 1 ? vx + r : vx - r;
    const y = c & 2 ? vy + r : vy - r;
    const z = c & 4 ? -dFar : -dNear;
    const cw = proj[3] * x + proj[7] * y + proj[11] * z + proj[15];
    if (!(cw > 1e-6)) return false;   // a corner at or behind the eye's plane (w <= 0) is never divided through: the sphere is refused whole, and the loop walks every light
    const nx = (proj[0] * x + proj[4] * y + proj[8] * z + proj[12]) / cw;
    const ny = (proj[1] * x + proj[5] * y + proj[9] * z + proj[13]) / cw;
    if (nx < minX) minX = nx; if (nx > maxX) maxX = nx;
    if (ny < minY) minY = ny; if (ny > maxY) maxY = ny;
  }
  if (minX > 1 || maxX < -1 || minY > 1 || maxY < -1) return false;
  const tile = (n, cells) => { const t = Math.floor((n + 1) * 0.5 * cells); return t < 0 ? 0 : t >= cells ? cells - 1 : t; };
  box[at] = tile(minX, CLUSTER_X); box[at + 1] = tile(maxX, CLUSTER_X);
  box[at + 2] = tile(minY, CLUSTER_Y); box[at + 3] = tile(maxY, CLUSTER_Y);
  box[at + 4] = sliceOf(dNear); box[at + 5] = sliceOf(dFar);
  return true;
}

/**
 * THE BUILD, once a frame: `lights` is the renderer's flat [x, y, z, range] array (the first `count` entries),
 * `view` and `proj` the frame's matrices. Fills `space` and answers whether the grid is usable this frame: false
 * when the lists would overflow, and the shader walks every light instead. Two passes over each light's box -
 * count, then write - so the lists are one flat array in cell order with no per-cell allocation.
 */
export function buildLightClusters(lights, count, view, proj, space) {
  const counts = space.counts, grid = space.grid, list = space.list, box = space._box;
  counts.fill(0);
  space.total = 0; space.lights = 0; space.rows = 0; space.built = false;
  const n = Math.min(count, box.length / 6, 255);   // a list entry is one byte
  let total = 0, touched = 0;
  for (let i = 0; i < n; i++) {
    const r = lights[i * 4 + 3];
    const at = i * 6;
    box[at] = -1;
    if (!(r > 0)) continue;
    const x = lights[i * 4], y = lights[i * 4 + 1], z = lights[i * 4 + 2];
    const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
    const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
    const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
    if (!cellsOfSphere(vx, vy, vz, r, proj, box, at)) { box[at] = -1; continue; }
    touched++;
    const x0 = box[at], x1 = box[at + 1], y0 = box[at + 2], y1 = box[at + 3], z0 = box[at + 4], z1 = box[at + 5];
    total += (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
    for (let cz = z0; cz <= z1; cz++) for (let cy = y0; cy <= y1; cy++) {
      const row = cy * CLUSTER_X + cz * CLUSTER_X * CLUSTER_Y;
      for (let cx = x0; cx <= x1; cx++) counts[row + cx]++;
    }
  }
  space.lights = touched;
  if (total > CLUSTER_LIST_CAP) return false;
  // the offsets: a prefix sum over the cells; the grid texel is (offset, count) and the count is reset to
  // serve as the write cursor
  let off = 0;
  for (let c = 0; c < CLUSTER_CELLS; c++) {
    grid[c * 2] = off; grid[c * 2 + 1] = counts[c];
    off += counts[c];
    counts[c] = 0;
  }
  for (let i = 0; i < n; i++) {
    const at = i * 6;
    if (box[at] < 0) continue;
    const x0 = box[at], x1 = box[at + 1], y0 = box[at + 2], y1 = box[at + 3], z0 = box[at + 4], z1 = box[at + 5];
    for (let cz = z0; cz <= z1; cz++) for (let cy = y0; cy <= y1; cy++) {
      const row = cy * CLUSTER_X + cz * CLUSTER_X * CLUSTER_Y;
      for (let cx = x0; cx <= x1; cx++) {
        const c = row + cx;
        list[grid[c * 2] + counts[c]++] = i;
      }
    }
  }
  space.total = total;
  space.rows = Math.min(CLUSTER_LIST_ROWS, Math.ceil(total / CLUSTER_LIST_W));
  space.built = true;
  return true;
}

/** The lights a cell lists, off a built space - the shader's own read, for a pin or a probe. */
export function cellLights(space, x, y, z) {
  const c = clusterCellOf(x, y, z);
  const off = space.grid[c * 2], cnt = space.grid[c * 2 + 1];
  return Array.from(space.list.subarray(off, off + cnt));
}

/** The cell a world point falls in, the shader's own arithmetic (elCluster) from the JS side: the screen tile off
 *  the projection and viewport, the slice off the view depth. Null behind the eye or off-screen. */
export function cellOfPoint(wp, view, proj, viewport) {
  const x = wp[0], y = wp[1], z = wp[2];
  const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
  const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
  const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
  const cw = proj[3] * vx + proj[7] * vy + proj[11] * vz + proj[15];
  if (!(cw > 1e-6)) return null;
  const nx = (proj[0] * vx + proj[4] * vy + proj[8] * vz + proj[12]) / cw;
  const ny = (proj[1] * vx + proj[5] * vy + proj[9] * vz + proj[13]) / cw;
  if (nx < -1 || nx > 1 || ny < -1 || ny > 1) return null;
  // the pixel, then the tile - as gl_FragCoord would carry it (the viewport's origin subtracted)
  const px = (nx + 1) * 0.5 * viewport[2], py = (ny + 1) * 0.5 * viewport[3];
  const tx = Math.min(CLUSTER_X - 1, Math.floor(px * CLUSTER_X / viewport[2]));
  const ty = Math.min(CLUSTER_Y - 1, Math.floor(py * CLUSTER_Y / viewport[3]));
  return [tx, ty, sliceOf(-vz)];
}

/** The mean list length over the cells a frame's fragments can land in - what a fragment walks on average
 *  instead of `count` (the probe's number). */
export function meanListLength(space) {
  let sum = 0;
  for (let c = 0; c < CLUSTER_CELLS; c++) sum += space.grid[c * 2 + 1];
  return sum / CLUSTER_CELLS;
}
