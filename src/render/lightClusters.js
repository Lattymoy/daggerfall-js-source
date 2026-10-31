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

import { pageParam } from '../systems/pageQuery.js'; // PERF-URL: the page's query, parsed once a search

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
/** WL1: THE TEXTURES CARRY BANDS - the lanterns' (rows 0 to CLUSTER_GRID_H - 1 of the grid, the list's first
 *  CLUSTER_LIST_ROWS rows) and the window lights' (render/windowLight.js) past them, one sampler each for all; LIGHT-REACH:
 *  a third for the windows' far rows, so neither tier's lists can crowd the other's out. */
export const CLUSTER_BANDS = 3;
/** The two texture units the world shaders read the grid and the list on - below the air's (11, 12), the shadow
 *  maps' (13, 14) and the cloud shadow's (15), above the material units. */
// AUDIT LC1: units 9 and 10 are the grid's and the list's ALONE - both are bound as TEXTURE_2D, and a 2D array
// (the shadow maps, the terrain's tiles) bound to the same unit under a sampler2DArray would make the two samplers
// of one unit an INVALID_OPERATION at draw; every other unit the lane uses is below these
export const CLUSTER_GRID_UNIT = 9;
export const CLUSTER_LIST_UNIT = 10;

const LOG_FAR_NEAR = Math.log(CLUSTER_FAR / CLUSTER_NEAR);
/** The shader's z parameters: depth * x, then log * y is the slice. */
export const CLUSTER_Z_SCALE = CLUSTER_Z / LOG_FAR_NEAR;

/** The URL door: `?clusters=off` walks every light in every fragment, as before LC1 (the air's `?air=off` shape). */
export function clustersOn(search = globalThis.location?.search ?? '') {
  return pageParam('clusters', search) !== 'off'; // PERF-URL
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
export function createClusterSpace(maxLights = 64) {
  return {
    counts: new Uint16Array(CLUSTER_CELLS),
    grid: new Uint16Array(CLUSTER_CELLS * 2),
    list: new Uint8Array(CLUSTER_LIST_CAP),
    total: 0, // list entries written
    lights: 0, // lights that touched the grid at all
    rows: 0, // list rows to upload
    need: 0, // the list entries the last build's lights asked for (over CLUSTER_LIST_CAP: it failed)
    built: false, // the last build's answer
    _tiles: new Int16Array(4), // AUDIT LC1: a slice's tile range, scratch
    _box: new Int16Array(7 * maxLights), // per light: x0 x1 y0 y1 z0 z1 nearFull (64 by default - the lane's cap is 48; WL1 asks for its own)
    _slices: new Int16Array(4 * CLUSTER_Z * maxLights), // LIGHT-REACH: per light and slice its tiles x0 x1 y0 y1, x0 -1 for none
    _sphere: new Float64Array(4 * maxLights), // LIGHT-REACH: a sphere light's view centre and radius, for its slices
    _vb: new Float64Array(6), // AUDIT LIGHT-REACH A1: a light's view box, x0 x1 y0 y1 d0 dFar (viewBoxCells)
  };
}

/** A view-space sphere's cells: writes [x0, x1, y0, y1, z0, z1, nearFull] into `box` at `at`, answers false when
 *  the sphere is wholly behind the eye or off-screen. `proj` is the frame's projection (any: the hosts' are
 *  x-mirrored perspectives - the corners are put through the matrix itself, not through a fov).
 *
 *  AUDIT LC1: THE NEAR BAND. The hosts' projections have near planes of 0.05 and 0.2 - closer than CLUSTER_NEAR
 *  (0.25), where the depth slices begin - so a fragment can be drawn at a depth the hull was never computed for:
 *  its tile is read at its own depth while the box's corners were clamped to 0.25, where the same extent projects
 *  narrower, and the hull can fall a tile short (a lamp whose reach passes a hand's width from the view axis, a
 *  door a foot from the eye). A sphere that reaches inside the band (depth - r < CLUSTER_NEAR) is therefore
 *  written to EVERY tile of slice 0 (`nearFull`) - the slice every fragment nearer than 0.25 lands in - and the
 *  hull serves the slices beyond; a sphere that lies wholly inside the band is slice 0, every tile. Nothing that
 *  lights goes dark. */
export function cellsOfSphere(vx, vy, vz, r, proj, box, at) {
  _sph[0] = vx;
  _sph[1] = vy;
  _sph[2] = vz;
  _sph[3] = r;
  return sphereCells(_sph, 0, proj, box, at, _vbScratch);
}
/** The sphere at `o` in `sph` (view centre, radius): its view box into `vb`, then its cells. */
function sphereCells(sph, o, proj, box, at, vb) {
  const vx = sph[o],
    vy = sph[o + 1],
    vz = sph[o + 2],
    r = sph[o + 3];
  vb[0] = vx - r;
  vb[1] = vx + r;
  vb[2] = vy - r;
  vb[3] = vy + r;
  vb[4] = -vz - r;
  vb[5] = -vz + r;
  return viewBoxCells(vb, proj, box, at);
}
const _sph = new Float64Array(4),
  _vbScratch = new Float64Array(6);
/** LIGHT-REACH: a view-space box's cells - x0..x1, y0..y1 and the view depths d0..d1 (d0 the nearer) - by the
 *  sphere's own rules (cellsOfSphere is this for the sphere's box). A light lit in a narrow volume (a window's beam)
 *  takes the box of that volume, not the box of its reach in every direction. */
export function cellsOfViewBox(x0, x1, y0, y1, d0, dFar, proj, box, at) {
  const vb = _vbScratch;
  vb[0] = x0;
  vb[1] = x1;
  vb[2] = y0;
  vb[3] = y1;
  vb[4] = d0;
  vb[5] = dFar;
  return viewBoxCells(vb, proj, box, at);
}
/** AUDIT LIGHT-REACH A1: cellsOfViewBox off `vb` [x0, x1, y0, y1, d0, dFar]. A frame's builds pass a light's floats
 *  through an array: a float handed to a call V8 does not inline is a heap number, and six of them a light tripled
 *  the garbage a night street's frame made. */
function viewBoxCells(vb, proj, box, at) {
  const x0 = vb[0],
    x1 = vb[1],
    y0 = vb[2],
    y1 = vb[3],
    d0 = vb[4],
    dFar = vb[5];
  if (dFar <= 0) return false; // wholly behind the eye
  const nearFull = d0 < CLUSTER_NEAR;
  box[at + 6] = nearFull ? 1 : 0;
  if (dFar < CLUSTER_NEAR) {
    // wholly inside the near band: slice 0, every tile, and no hull to compute
    box[at] = 0;
    box[at + 1] = CLUSTER_X - 1;
    box[at + 2] = 0;
    box[at + 3] = CLUSTER_Y - 1;
    box[at + 4] = 0;
    box[at + 5] = 0;
    return true;
  }
  const dNear = Math.max(d0, CLUSTER_NEAR);
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let c = 0; c < 8; c++) {
    const x = c & 1 ? x1 : x0;
    const y = c & 2 ? y1 : y0;
    const z = c & 4 ? -dFar : -dNear;
    const cw = proj[3] * x + proj[7] * y + proj[11] * z + proj[15];
    if (!(cw > 1e-6)) return false; // a corner at or behind the eye's plane (w <= 0) is never divided through: this light is left out of the grid (unreachable for a perspective after the near clamp)
    const nx = (proj[0] * x + proj[4] * y + proj[8] * z + proj[12]) / cw;
    const ny = (proj[1] * x + proj[5] * y + proj[9] * z + proj[13]) / cw;
    if (nx < minX) minX = nx;
    if (nx > maxX) maxX = nx;
    if (ny < minY) minY = ny;
    if (ny > maxY) maxY = ny;
  }
  if (minX > 1 || maxX < -1 || minY > 1 || maxY < -1) {
    if (!nearFull) return false;
    // off-screen beyond the band, but reaching into it: slice 0 alone, every tile
    box[at] = 0;
    box[at + 1] = CLUSTER_X - 1;
    box[at + 2] = 0;
    box[at + 3] = CLUSTER_Y - 1;
    box[at + 4] = 0;
    box[at + 5] = 0;
    return true;
  }
  box[at] = tile(minX, CLUSTER_X);
  box[at + 1] = tile(maxX, CLUSTER_X);
  box[at + 2] = tile(minY, CLUSTER_Y);
  box[at + 3] = tile(maxY, CLUSTER_Y);
  box[at + 4] = sliceOf(dNear);
  box[at + 5] = sliceOf(dFar);
  return true;
}
/** A clip-space coordinate's tile, clamped to the grid. */
function tile(n, cells) {
  const t = Math.floor((n + 1) * 0.5 * cells);
  return t < 0 ? 0 : t >= cells ? cells - 1 : t;
}
/** AUDIT LC1: the tile range of a light's box in slice `cz` - every tile in slice 0 for a light that reaches the
 *  near band, the hull otherwise. */
function tilesIn(box, at, cz, out) {
  if (cz === 0 && box[at + 6]) {
    out[0] = 0;
    out[1] = CLUSTER_X - 1;
    out[2] = 0;
    out[3] = CLUSTER_Y - 1;
  } else {
    out[0] = box[at];
    out[1] = box[at + 1];
    out[2] = box[at + 2];
    out[3] = box[at + 3];
  }
  return out;
}

/**
 * THE BUILD, once a frame: `lights` is the renderer's flat [x, y, z, range] array (the first `count` entries),
 * `view` and `proj` the frame's matrices. Fills `space` and answers whether the grid is usable this frame: false
 * when the lists would overflow, and the shader walks every light instead. Two passes over each light's box -
 * count, then write - so the lists are one flat array in cell order with no per-cell allocation.
 */
export function buildLightClusters(lights, count, view, proj, space) {
  return binLights(false, lights, count, view, proj, space);
}
/** A sphere light's cells (`lights` the renderer's [x, y, z, range] a light): its view centre and radius kept in the
 *  space's `_sphere` for its slices. */
function sphereLightCells(lights, i, view, proj, space, box, at) {
  const r = lights[i * 4 + 3],
    sph = space._sphere;
  if (!(r > 0)) return false;
  const x = lights[i * 4],
    y = lights[i * 4 + 1],
    z = lights[i * 4 + 2];
  sph[i * 4] = view[0] * x + view[4] * y + view[8] * z + view[12];
  sph[i * 4 + 1] = view[1] * x + view[5] * y + view[9] * z + view[13];
  sph[i * 4 + 2] = view[2] * x + view[6] * y + view[10] * z + view[14];
  sph[i * 4 + 3] = r;
  return sphereCells(sph, i * 4, proj, box, at, space._vb);
}
/** LIGHT-REACH: the depths slice k spans (the shader's sliceOf), widened by a thousandth for the GPU's rounding - a
 *  table (AUDIT LIGHT-REACH A2: two exp a slice a light were a tenth of the lanterns' build). */
const SLICE_LO = Float64Array.from({ length: CLUSTER_Z }, (_, k) =>
  k <= 0 ? 0 : CLUSTER_NEAR * Math.exp(k / CLUSTER_Z_SCALE) * 0.999,
);
const SLICE_HI = Float64Array.from({ length: CLUSTER_Z }, (_, k) =>
  k >= CLUSTER_Z - 1 ? Infinity : CLUSTER_NEAR * Math.exp((k + 1) / CLUSTER_Z_SCALE) * 1.001,
);
/** LIGHT-REACH: the sphere at `o` in `sph` (view centre, radius) - its tiles in one slice, narrowed in `out` (its box's
 *  tiles) to those of its cross-section there: the box of the sphere within the slab is as wide as its widest circle
 *  in the slab. A light near the edge of its depth took every tile its whole box did. False when the slab holds none. */
export function sphereSlice(sph, o, cz, proj, out) {
  const vx = sph[o],
    vy = sph[o + 1],
    vz = sph[o + 2],
    r = sph[o + 3];
  const dc = -vz,
    lo = SLICE_LO[cz],
    hi = SLICE_HI[cz];
  const dz = dc < lo ? lo - dc : dc > hi ? dc - hi : 0;
  if (dz >= r) return false;
  const rs = Math.sqrt(r * r - dz * dz),
    dA = Math.max(lo, dc - r, CLUSTER_NEAR),
    dB = Math.min(hi, dc + r);
  if (!(dB > dA)) return true; // within the near band: the box's own tiles
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let c = 0; c < 8; c++) {
    const x = c & 1 ? vx + rs : vx - rs,
      y = c & 2 ? vy + rs : vy - rs,
      z = c & 4 ? -dB : -dA;
    const cw = proj[3] * x + proj[7] * y + proj[11] * z + proj[15];
    if (!(cw > 1e-6)) return true;
    const nx = (proj[0] * x + proj[4] * y + proj[8] * z + proj[12]) / cw,
      ny = (proj[1] * x + proj[5] * y + proj[9] * z + proj[13]) / cw;
    if (nx < minX) minX = nx;
    if (nx > maxX) maxX = nx;
    if (ny < minY) minY = ny;
    if (ny > maxY) maxY = ny;
  }
  if (minX > 1 || maxX < -1 || minY > 1 || maxY < -1) return false;
  out[0] = Math.max(out[0], tile(minX, CLUSTER_X));
  out[1] = Math.min(out[1], tile(maxX, CLUSTER_X));
  out[2] = Math.max(out[2], tile(minY, CLUSTER_Y));
  out[3] = Math.min(out[3], tile(maxY, CLUSTER_Y));
  return out[0] <= out[1] && out[2] <= out[3];
}
/** LIGHT-REACH: THE BUILD for lights bounded by boxes: `boxes` holds LC_BOX floats a light - a world box's centre and
 *  its three half-axes (each a vector: the axis times half its length, any orientation). The view-space box of each
 *  is its centre in view and, on each view axis, the sum of the half-axes' lengths along it. */
export function buildLightClusterBoxes(boxes, count, view, proj, space) {
  return binLights(true, boxes, count, view, proj, space);
}
/** A box light's cells (`boxes` LC_BOX floats a light). */
function boxLightCells(boxes, i, view, proj, space, box, at) {
  const vb = space._vb,
    o = i * LC_BOX,
    x = boxes[o],
    y = boxes[o + 1],
    z = boxes[o + 2];
  const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
  const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
  const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
  let ex = 0,
    ey = 0,
    ez = 0;
  for (let k = o + 3; k < o + LC_BOX; k += 3) {
    const ax = boxes[k],
      ay = boxes[k + 1],
      az = boxes[k + 2];
    ex += Math.abs(view[0] * ax + view[4] * ay + view[8] * az);
    ey += Math.abs(view[1] * ax + view[5] * ay + view[9] * az);
    ez += Math.abs(view[2] * ax + view[6] * ay + view[10] * az);
  }
  if (!(ex + ey + ez > 0)) return false;
  vb[0] = vx - ex;
  vb[1] = vx + ex;
  vb[2] = vy - ey;
  vb[3] = vy + ey;
  vb[4] = -vz - ez;
  vb[5] = -vz + ez;
  return viewBoxCells(vb, proj, box, at);
}
/** LIGHT-REACH: a box light's floats - its centre, then three half-axis vectors. */
export const LC_BOX = 12;
/** The two passes both builds share, over `src`'s lights - boxes (`boxes` true) or spheres, whose slices each narrow
 *  to the sphere's cross-section there (LIGHT-REACH). The first pass keeps each slice's tiles, so the second writes the
 *  same cells it counted. AUDIT LIGHT-REACH A1: no callback a build - two closures a frame were its last garbage. */
function binLights(boxes, src, count, view, proj, space) {
  const counts = space.counts,
    grid = space.grid,
    list = space.list,
    box = space._box,
    st = space._slices;
  counts.fill(0);
  space.total = 0;
  space.lights = 0;
  space.rows = 0;
  space.built = false;
  const n = Math.min(count, box.length / 7, 255); // a list entry is one byte
  const t4 = space._tiles;
  let total = 0,
    touched = 0;
  for (let i = 0; i < n; i++) {
    const at = i * 7;
    box[at] = -1;
    if (
      !(boxes
        ? boxLightCells(src, i, view, proj, space, box, at)
        : sphereLightCells(src, i, view, proj, space, box, at))
    ) {
      box[at] = -1;
      continue;
    }
    touched++;
    const z0 = box[at + 4],
      z1 = box[at + 5];
    for (let cz = z0; cz <= z1; cz++) {
      const s = (i * CLUSTER_Z + cz) * 4;
      tilesIn(box, at, cz, t4);
      if (!boxes && !(cz === 0 && box[at + 6]) && !sphereSlice(space._sphere, i * 4, cz, proj, t4)) {
        st[s] = -1;
        continue;
      }
      st[s] = t4[0];
      st[s + 1] = t4[1];
      st[s + 2] = t4[2];
      st[s + 3] = t4[3];
      const x0 = t4[0],
        x1 = t4[1],
        y0 = t4[2],
        y1 = t4[3];
      total += (x1 - x0 + 1) * (y1 - y0 + 1);
      for (let cy = y0; cy <= y1; cy++) {
        const row = cy * CLUSTER_X + cz * CLUSTER_X * CLUSTER_Y;
        for (let cx = x0; cx <= x1; cx++) counts[row + cx]++;
      }
    }
  }
  space.lights = touched;
  space.need = total; // WL1: what the lights asked for - a builder that may leave some out sizes its next try by it
  if (total > CLUSTER_LIST_CAP) return false;
  // the offsets: a prefix sum over the cells; the grid texel is (offset, count) and the count is reset to
  // serve as the write cursor
  let off = 0;
  for (let c = 0; c < CLUSTER_CELLS; c++) {
    grid[c * 2] = off;
    grid[c * 2 + 1] = counts[c];
    off += counts[c];
    counts[c] = 0;
  }
  for (let i = 0; i < n; i++) {
    const at = i * 7;
    if (box[at] < 0) continue;
    const z0 = box[at + 4],
      z1 = box[at + 5];
    for (let cz = z0; cz <= z1; cz++) {
      const s = (i * CLUSTER_Z + cz) * 4;
      if (st[s] < 0) continue;
      const x0 = st[s],
        x1 = st[s + 1],
        y0 = st[s + 2],
        y1 = st[s + 3];
      for (let cy = y0; cy <= y1; cy++) {
        const row = cy * CLUSTER_X + cz * CLUSTER_X * CLUSTER_Y;
        for (let cx = x0; cx <= x1; cx++) {
          const c = row + cx;
          list[grid[c * 2] + counts[c]++] = i;
        }
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
  const off = space.grid[c * 2],
    cnt = space.grid[c * 2 + 1];
  return Array.from(space.list.subarray(off, off + cnt));
}

/** The cell a world point falls in, the shader's own arithmetic (elCluster) from the JS side: the screen tile off
 *  the projection and viewport, the slice off the view depth. Null behind the eye or off-screen. */
export function cellOfPoint(wp, view, proj, viewport) {
  const x = wp[0],
    y = wp[1],
    z = wp[2];
  const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
  const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
  const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
  const cw = proj[3] * vx + proj[7] * vy + proj[11] * vz + proj[15];
  if (!(cw > 1e-6)) return null;
  const nx = (proj[0] * vx + proj[4] * vy + proj[8] * vz + proj[12]) / cw;
  const ny = (proj[1] * vx + proj[5] * vy + proj[9] * vz + proj[13]) / cw;
  if (nx < -1 || nx > 1 || ny < -1 || ny > 1) return null;
  // the pixel, then the tile - as gl_FragCoord would carry it (the viewport's origin subtracted)
  const px = (nx + 1) * 0.5 * viewport[2],
    py = (ny + 1) * 0.5 * viewport[3];
  const tx = Math.min(CLUSTER_X - 1, Math.floor((px * CLUSTER_X) / viewport[2]));
  const ty = Math.min(CLUSTER_Y - 1, Math.floor((py * CLUSTER_Y) / viewport[3]));
  return [tx, ty, sliceOf(-vz)];
}

/** The mean list length over the cells a frame's fragments can land in - what a fragment walks on average
 *  instead of `count` (the probe's number). */
export function meanListLength(space) {
  let sum = 0;
  for (let c = 0; c < CLUSTER_CELLS; c++) sum += space.grid[c * 2 + 1];
  return sum / CLUSTER_CELLS;
}
