// WATER2 - THE BASIN (2026-09-11, Mac: "ponds not sitting like a
// texture and having depth in the ground (same for rivers)"). WATER1
// drew the water as the ground's own triangles lifted a hand's
// breadth: a pond was a film on a field, a river a blue road, and the
// shore the tile art's diagonal. Water lies IN the ground. This module
// is the pure half of putting it there:
//
//   - basinDepths: which grid vertices stand in water (every tile that
//     meets the vertex says its corner is water, off the WATER1 corner
//     table), and how far each is from the nearest dry vertex, eased
//     into a bowl: a quarter-circle profile from the bank to full depth
//     BASIN_RAMP vertices in. A one-tile stream is a shallow trough, a
//     lake a bowl, the sea a beach that falls away.
//   - carveBasin: the ground pass's vertices lowered by that depth, the
//     normals under and beside the carve recomputed with the grid's own
//     kernel (buildTerrainGrid's central differences) so the bank is lit
//     as a slope, and the far ring's skirt re-hung from the carved edge.
//   - waterMesh: the water's own vertices - the UNCARVED heights, so the
//     surface stays where the ground was - and the depth under each,
//     which the surface shader reads as the bed's distance: clear and
//     fading to nothing where the bed rises to meet it (the shoreline is
//     where water meets ground, not where the art's diagonal falls), and
//     dark and opaque where it is deep.
//
// The collider never sees any of this: world.js's heightAt reads the
// pixel's SAMPLES, and the samples are untouched. The player swims on
// a water tile at the height DFU swims at; only the picture has a bed.
import { WATER_MASK_TABLE } from '../world/waterCorners.js';   // MAC2: the corner table's one home
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../world/terrainSampler.js';
import { TERRAIN_SKIRT_DEPTH } from '../world/terrainSurface.js';

/** The bed at its deepest, world units below the surface (a tile is
 *  6.4; a man is about 1.8). */
export const BASIN_DEPTH = 5.0;
/** Vertices from the bank to full depth: the beach's width. */
export const BASIN_RAMP = 4;
/** A town's water (docks, moats - a flat quad with no grid to carve):
 *  one depth for the whole sheet. */
export const TOWN_WATER_DEPTH = 2.5;

/** The bowl's profile: 0 on the bank, 1 at BASIN_RAMP vertices in, a
 *  quarter circle between - steep off the bank, flat in the middle. */
export const basinProfile = (d) => Math.sin(Math.min(1, Math.max(0, d / BASIN_RAMP)) * Math.PI / 2);

/**
 * Is grid vertex (xi, zi) of a stride-`stride` grid in water: every tile
 * that meets its corner marks that corner water (a corner one tile
 * calls dirt is the shore). Corner bits are WATER1's: 1 = (0,0),
 * 2 = (1,0), 4 = (0,1), 8 = (1,1) in the tilemap's frame.
 */
export function vertexInWater(bytes, xi, zi, stride, tileDim = 128, table = WATER_MASK_TABLE) {
  const tx = xi * stride, tz = zi * stride;
  let seen = 0;
  const corner = (cx, cz, bit) => {
    if (cx < 0 || cz < 0 || cx >= tileDim || cz >= tileDim) return true;
    seen++;
    return (table[bytes[cz * tileDim + cx]] & bit) !== 0;
  };
  const wet = corner(tx, tz, 1) && corner(tx - 1, tz, 2) && corner(tx, tz - 1, 4) && corner(tx - 1, tz - 1, 8);
  return wet && seen > 0;
}

/**
 * The depth fraction (0..1 of BASIN_DEPTH) of every grid vertex of a
 * stride-`stride` grid over a `tileDim`-square tilemap, in
 * buildTerrainGrid's order (zi * g + xi). Null when no vertex is wet.
 */
export function basinDepths(bytes, stride = 1, tileDim = 128, table = WATER_MASK_TABLE) {
  const g = tileDim / stride + 1;
  const dist = new Int16Array(g * g).fill(-1);
  const queue = [];
  let any = false;
  for (let zi = 0; zi < g; zi++) {
    for (let xi = 0; xi < g; xi++) {
      const i = zi * g + xi;
      if (vertexInWater(bytes, xi, zi, stride, tileDim, table)) any = true;
      else { dist[i] = 0; queue.push(i); }
    }
  }
  if (!any) return null;
  // multi-source breadth-first from every dry vertex: the ring distance
  // of each wet vertex to the bank, capped at the ramp (past it the
  // profile is flat, and the walk stops)
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const d = dist[i];
    if (d >= BASIN_RAMP) continue;
    const xi = i % g, zi = (i - xi) / g;
    const step = (j) => { if (dist[j] < 0) { dist[j] = d + 1; queue.push(j); } };
    if (xi > 0) step(i - 1);
    if (xi < g - 1) step(i + 1);
    if (zi > 0) step(i - g);
    if (zi < g - 1) step(i + g);
  }
  const out = new Float32Array(g * g);
  for (let i = 0; i < g * g; i++) out[i] = dist[i] < 0 ? 1 : basinProfile(dist[i]);
  return out;
}

/**
 * Lower the ground under the water, in place: the grid's positions and
 * normals as buildTerrainGrid laid them (g * g vertices, then the far
 * ring's four skirt rows). Answers the same object.
 */
export function carveBasin(grid, depths, stride = 1) {
  const { positions, normals } = grid;
  const g = (HEIGHTMAP_DIMENSION - 1) / stride + 1;
  const cell = TERRAIN_SIZE / (HEIGHTMAP_DIMENSION - 1);
  const n = g * g;
  for (let i = 0; i < n; i++) if (depths[i] > 0) positions[i * 3 + 1] -= depths[i] * BASIN_DEPTH;
  // the kernel of buildTerrainGrid on the carved heights, for every
  // vertex the carve reaches (itself or a neighbour lowered); the
  // grid's own edge clamps where the ghost row would have been
  const y = (xi, zi) => positions[(Math.min(g - 1, Math.max(0, zi)) * g + Math.min(g - 1, Math.max(0, xi))) * 3 + 1];
  const touched = (xi, zi) => xi >= 0 && zi >= 0 && xi < g && zi < g && depths[zi * g + xi] > 0;
  for (let zi = 0; zi < g; zi++) {
    for (let xi = 0; xi < g; xi++) {
      if (!(touched(xi, zi) || touched(xi - 1, zi) || touched(xi + 1, zi) || touched(xi, zi - 1) || touched(xi, zi + 1))) continue;
      const nx = y(xi - 1, zi) - y(xi + 1, zi);
      const nz = y(xi, zi - 1) - y(xi, zi + 1);
      const ny = 2 * cell * stride;
      const l = Math.hypot(nx, ny, nz);
      const o = (zi * g + xi) * 3;
      normals[o] = nx / l; normals[o + 1] = ny / l; normals[o + 2] = nz / l;
    }
  }
  if (positions.length > n * 3) {
    // the skirt, re-hung: the same perimeter walk as buildTerrainGrid's
    const edges = [(i) => i, (i) => (g - 1) * g + i, (i) => i * g, (i) => i * g + (g - 1)];
    let o = n * 3;
    for (const edge of edges) {
      for (let i = 0; i < g; i++) {
        const src = edge(i) * 3;
        positions[o + 1] = positions[src + 1] - TERRAIN_SKIRT_DEPTH;
        normals[o] = normals[src]; normals[o + 1] = normals[src + 1]; normals[o + 2] = normals[src + 2];
        o += 3;
      }
    }
  }
  return grid;
}

/**
 * The water's own vertices, taken BEFORE the carve: the grid's g * g
 * positions as they stand (the surface's height is the ground's was)
 * and the bed's depth under each in world units.
 */
export function waterMesh(positions, depths, stride = 1) {
  const g = (HEIGHTMAP_DIMENSION - 1) / stride + 1;
  const n = g * g;
  const depth = new Float32Array(n);
  for (let i = 0; i < n; i++) depth[i] = depths[i] * BASIN_DEPTH;
  return { positions: positions.slice(0, n * 3), depths: depth };
}
