// ═══════════════════════════════════════════════════════════════════
// DW-B: THE SEAFLOOR. DeepWaterFloorBuilder.ComputeHoleMask and
// DeepWaterFloorMesh (Iliac Puddle No More 1.2.2, jet082), as pure
// geometry over one streamed pixel:
//
//   HOLES  - 128 x 128 cells, a terrain tile each: a cell is carved out
//            of the ground (hole = false in Unity's TerrainData.SetHoles
//            sense) where the pixel's own heights call it water
//            (IsLocalPointWater - the carve threshold, 0.25 above the
//            sea), its four heightmap corners sit on the sea, and the
//            bake's fine mask carved it - or, on a pixel the fine bake
//            missed, where it is a pure water tile the coarse bake calls
//            sea.
//   FLOOR  - a 65 x 65 vertex grid (12.8 m quads) at the bathymetry's
//            depth under the sea, fitted up to the vanilla shore within
//            180 m of the coast, never above 5 cm under the surface; a
//            quad is drawn where any of its four cells is carved.
//   WALLS  - where a carved cell meets the pixel's edge and the bake does
//            not carve across it, a sloped skirt from just under the
//            surface down to the floor, both faces.
//
// Everything is PIXEL-LOCAL (x east, z north, meters from the south-west
// corner), the frame DFU's terrain transform gives the mesh and the frame
// the port builds the pixel in. `nearbyLocalY(lx, lz)` is the host's
// answer to DeepWaterTerrainLookup.TryGetByWorldPosition + a bilinear read
// of THAT terrain's heights - the neighbour's own heightmap when a point
// falls past this pixel's edge - or null where nothing is streamed.
// ═══════════════════════════════════════════════════════════════════

import { SCALED_OCEAN_ELEVATION, MAX_TERRAIN_HEIGHT, HEIGHTMAP_DIMENSION } from './terrainSampler.js';
import { heightSample, isLocalPointWater, isLocalPointPureWaterTile } from './deepWaterClassification.js';
import { sampleDepthMeters, depthBand01 } from './deepBathymetry.js';

const f32 = Math.fround;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * clamp01(t);
/** Mathf.SmoothStep. */
const smoothStep = (from, to, t) => { t = clamp01(t); t = -2 * t * t * t + 3 * t * t; return to * t + from * (1 - t); };

export const TILE_WORLD_SIZE = 819.2;
/** DeepWaterFloorMesh.VertexGridSize. */
export const VERTEX_GRID_SIZE = 65;
/** terrainData.holesResolution: a hole per terrain tile. */
export const HOLES_RESOLUTION = 128;
export const HOLE_BUFFER_METERS = 0.5;
const WALL_MINIMUM_DROP = 0.25;
const SHORE_WALL_SURFACE_INSET = 0.15;
const SHORE_WALL_BOTTOM_OVERLAP = 0.1;
const SHORE_WALL_TOP_TEXTURE_STRENGTH = 0.35;
const SKIRT_SLOPE_TANGENT = 0.6;
const BOUNDARY_SKIRT_MIN_WIDTH = 2;
const BOUNDARY_SKIRT_MAX_WIDTH = 8;
const SHORE_TERRAIN_FIT_METERS = 180;
const FLOOR_SURFACE_CLEARANCE = 0.05;

/** OceanElevation / MaxTerrainHeight, the float. */
export const OCEAN_THRESHOLD = f32(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT);

/**
 * ComputeHoleMask.
 * @param {object} mapData - {samples, tilemap}
 * @param {object} tile - the pixel's DeepWaterTileData
 * @param {object} bake - the DeepWatersBake
 * @returns {?{holes: Uint8Array, any: boolean}} holes[z * 128 + x]: 1 = the ground stays, 0 = carved.
 */
export function computeHoleMask(mapData, tile, bake) {
  if (!mapData.samples) return null;
  const num = HOLES_RESOLUTION;
  const holes = new Uint8Array(num * num);
  let any = false;
  const flag = !tile.usesLocalWaterFallback;
  const num2 = f32(1 / num);
  const num3 = OCEAN_THRESHOLD;
  const lim = f32(num3 + f32(1e-5));
  for (let i = 0; i < num; i++) {
    const fracZ = f32(f32(i + 0.5) * num2);
    for (let j = 0; j < num; j++) {
      holes[i * num + j] = 1;
      const fracX = f32(f32(j + 0.5) * num2);
      const flag2 = !flag && isLocalPointPureWaterTile(mapData, fracX, fracZ) && bake.isWaterAt(tile.mapPixelX, tile.mapPixelY, fracX, fracZ);
      if (isLocalPointWater(mapData, fracX, fracZ)
        && ((heightSample(mapData, i, j) <= lim && heightSample(mapData, i, j + 1) <= lim
          && heightSample(mapData, i + 1, j) <= lim && heightSample(mapData, i + 1, j + 1) <= lim) || flag2)) {
        let flag3 = true;
        if (flag3 && flag) flag3 = tile.isCarvedWater(tile.mapPixelX, tile.mapPixelY, fracX, fracZ);
        if (flag3) { holes[i * num + j] = 0; any = true; }
      }
    }
  }
  return { holes, any };
}

/** IsFloorQuadWater: a floor quad covers 2 x 2 hole cells; it is drawn when any is carved. */
export function isFloorQuadWater(holes, quadX, quadZ, quadResolution) {
  if (!holes || quadResolution <= 0) return true;
  const length = HOLES_RESOLUTION, length2 = HOLES_RESOLUTION;
  const num = f32(quadX / quadResolution), num2 = f32((quadX + 1) / quadResolution);
  const num3 = f32(quadZ / quadResolution), num4 = f32((quadZ + 1) / quadResolution);
  const num5 = clampInt(Math.floor(f32(num * length2)), 0, length2 - 1);
  const num6 = clampInt(Math.ceil(f32(num2 * length2)) - 1, 0, length2 - 1);
  const num7 = clampInt(Math.floor(f32(num3 * length)), 0, length - 1);
  const num8 = clampInt(Math.ceil(f32(num4 * length)) - 1, 0, length - 1);
  for (let i = num7; i <= num8; i++) for (let j = num5; j <= num6; j++) if (!holes[i * length2 + j]) return true;
  return false;
}

/** CreateVertexColor: (sqrt of the depth band, the climate band, the shore distance over 360 m, the texture's strength). */
export function createVertexColor(depth, climateBand, distanceToCoast, textureStrength = 1) {
  return [Math.sqrt(depthBand01(depth)), climateBand, clamp01(distanceToCoast / 360), clamp01(textureStrength)];
}

/**
 * DeepWaterFloorMesh.Build.
 * @param {object} ctx
 * @param {object} ctx.mapData - {samples, tilemap}
 * @param {object} ctx.tile - DeepWaterTileData
 * @param {Uint8Array} ctx.holes - computeHoleMask's
 * @param {number} ctx.oceanLocalY - the sea's local height (OceanElevation / MaxTerrainHeight * size.y)
 * @param {number} ctx.terrainHeight - terrainData.size.y (MaxTerrainHeight * TerrainScale)
 * @param {?number} ctx.waterDepth - the Water Depth setting
 * @param {(lx: number, lz: number) => ?number} [ctx.nearbyLocalY] - a streamed pixel's vanilla height here, local
 */
export function buildFloorMesh(ctx) {
  const { mapData, tile, holes, oceanLocalY, terrainHeight, waterDepth } = ctx;
  const nearbyLocalY = ctx.nearbyLocalY ?? (() => null);
  const num = TILE_WORLD_SIZE;
  const num2 = VERTEX_GRID_SIZE;
  const positions = [], colors = [], uvs = [], indices = [];
  const vertexLocalY = new Float32Array(num2 * num2);
  const floorQuadWater = new Uint8Array((num2 - 1) * (num2 - 1));
  const num3 = num / (num2 - 1);
  const oceanThreshold = OCEAN_THRESHOLD;
  const floor = { vertexLocalY, floorQuadWater };

  const sampleVanillaLocalY = (fracX, fracZ) => {
    if (!mapData.samples || oceanThreshold <= 1e-6) return oceanLocalY;
    const length = HEIGHTMAP_DIMENSION, length2 = HEIGHTMAP_DIMENSION;
    const n = clamp01(fracZ) * (length - 1);
    const n2 = clamp01(fracX) * (length2 - 1);
    const n3 = clampInt(Math.floor(n), 0, length - 2);
    const n4 = clampInt(Math.floor(n2), 0, length2 - 2);
    const n5 = n - n3, n6 = n2 - n4;
    const n7 = lerp(heightSample(mapData, n3, n4), heightSample(mapData, n3, n4 + 1), n6);
    const n8 = lerp(heightSample(mapData, n3 + 1, n4), heightSample(mapData, n3 + 1, n4 + 1), n6);
    return lerp(n7, n8, n5) / oceanThreshold * oceanLocalY;
  };
  // SampleNearbyVanillaLocalY: the highest of four points a meter out, where a terrain is streamed there.
  const sampleNearbyVanillaLocalY = (localX, localZ, fallbackLocalY) => {
    let best = fallbackLocalY;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const y = nearbyLocalY(localX + dx, localZ + dz);
      if (y != null && y > best) best = y;
    }
    return best;
  };
  const fitSeafloorToShoreTerrain = (localY, localX, localZ, shoreDistance) => {
    if (shoreDistance >= SHORE_TERRAIN_FIT_METERS || num <= 0) return localY;
    const fracX = localX / num, fracZ = localZ / num;
    let n = sampleVanillaLocalY(fracX, fracZ);
    n = Math.max(n, sampleNearbyVanillaLocalY(localX, localZ, n));
    let n2 = Math.min(oceanLocalY - FLOOR_SURFACE_CLEARANCE, n - FLOOR_SURFACE_CLEARANCE);
    n2 = Math.max(localY, n2);
    const n3 = 1 - smoothStep(0, 1, clamp01(shoreDistance / SHORE_TERRAIN_FIT_METERS));
    return lerp(localY, n2, n3);
  };
  const sampleSeafloorLocalY = (localX, localZ) => {
    const distanceToCoast = tile.getDistanceToEdgeMeters(localX, localZ);
    const { baseDepth, band } = tile.getBlendedClimate(localX, localZ);
    const [nx, nz] = tile.getNoiseWorldCoords(localX, localZ);
    let depth = sampleDepthMeters(nx, nz, baseDepth, distanceToCoast, waterDepth);
    const y = fitSeafloorToShoreTerrain(oceanLocalY - depth, localX, localZ, distanceToCoast);
    depth = Math.max(0, oceanLocalY - y);
    return { y, distanceToCoast, depth, band };
  };

  for (let i = 0; i < num2; i++) {
    const num4 = i * num3;
    for (let j = 0; j < num2; j++) {
      const num5 = j * num3;
      const distanceToEdgeMeters = tile.getDistanceToEdgeMeters(num5, num4);
      const { baseDepth, band } = tile.getBlendedClimate(num5, num4);
      const [nx, nz] = tile.getNoiseWorldCoords(num5, num4);
      let num6 = sampleDepthMeters(nx, nz, baseDepth, distanceToEdgeMeters, waterDepth);
      let localY = oceanLocalY - num6;
      localY = fitSeafloorToShoreTerrain(localY, num5, num4, distanceToEdgeMeters);
      localY = Math.min(localY, oceanLocalY - FLOOR_SURFACE_CLEARANCE);
      num6 = Math.max(0, oceanLocalY - localY);
      positions.push(num5, localY, num4);
      vertexLocalY[i * num2 + j] = localY;
      colors.push(...createVertexColor(num6, band, distanceToEdgeMeters));
      uvs.push(num5, num4);
    }
  }
  for (let k = 0; k < num2 - 1; k++) {
    for (let l = 0; l < num2 - 1; l++) {
      const flag = isFloorQuadWater(holes, l, k, num2 - 1);
      floorQuadWater[k * (num2 - 1) + l] = flag ? 1 : 0;
      if (flag) {
        const num7 = k * num2 + l, item = num7 + 1, num8 = num7 + num2, item2 = num8 + 1;
        indices.push(num7, num8, item2, num7, item2, item);
      }
    }
  }
  const floorGridIndexCount = indices.length;
  appendHoleEdgeWalls({ holes, tile, positions, colors, uvs, indices, oceanLocalY, num, floor, sampleVanillaLocalY, sampleNearbyVanillaLocalY, sampleSeafloorLocalY });
  return {
    positions: Float32Array.from(positions),
    colors: Float32Array.from(colors),
    uvs: Float32Array.from(uvs),
    indices: Uint32Array.from(indices),
    floorGridIndexCount,
    vertexLocalY,
    floorQuadWater,
    terrainHeight,
  };
}

/** AppendHoleEdgeWalls: the skirts along the pixel's edge where the carve stops at it. */
function appendHoleEdgeWalls(w) {
  const { holes, tile, positions, colors, uvs, indices, oceanLocalY, num: tileWorldSize, floor } = w;
  if (!holes || !tile) return;
  const length = HOLES_RESOLUTION, length2 = HOLES_RESOLUTION;
  const list = [];
  const across = (x, z, dx, dz) => {
    // IsBakedHoleAcrossBoundary: the cell centre one step over, in this pixel's local meters.
    const n = tileWorldSize / length2, n2 = tileWorldSize / length;
    const lx = (x + 0.5 + dx) * n, lz = (z + 0.5 + dz) * n2;
    if (tile.usesLocalWaterFallback) return true;
    return tile.isCarvedWaterLocal(lx, lz);
  };
  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length2; j++) {
      if (holes[i * length2 + j]) continue;
      if (j === 0 && !across(j, i, -1, 0)) list.push([j, i, j, i + 1]);
      if (j === length2 - 1 && !across(j, i, 1, 0)) list.push([j + 1, i + 1, j + 1, i]);
      if (i === 0 && !across(j, i, 0, -1)) list.push([j + 1, i, j, i]);
      if (i === length - 1 && !across(j, i, 0, 1)) list.push([j, i + 1, j + 1, i + 1]);
    }
  }
  if (list.length === 0) return;
  const stride = length2 + 1;
  const n2 = tileWorldSize / length2, n3 = tileWorldSize / length;
  const inward = new Map();
  for (const [ax, az, bx, bz] of list) {
    const n4 = (bx - ax) * n2, n5 = (bz - az) * n3;
    const n6 = Math.sqrt(n4 * n4 + n5 * n5);
    if (n6 < 0.0001) continue;
    const vx = n5 / n6, vz = -n4 / n6;
    for (const key of [az * stride + ax, bz * stride + bx]) {
      const v = inward.get(key) ?? [0, 0];
      inward.set(key, [v[0] + vx, v[1] + vz]);
    }
  }
  const skirtTopY = oceanLocalY - SHORE_WALL_SURFACE_INSET;
  const top = new Map(), bottom = new Map();
  const ensure = (vx, vz) => {
    const key = vz * stride + vx;
    if (top.has(key)) return;
    const n = (vx / length2) * tileWorldSize;
    const nz = (vz / length) * tileWorldSize;
    let n3v = w.sampleVanillaLocalY(vx / length2, vz / length);
    n3v = Math.max(n3v, w.sampleNearbyVanillaLocalY(n, nz, n3v));
    const n4 = Math.min(skirtTopY, n3v);
    let value = inward.get(key) ?? [0, 0];
    const sq = value[0] * value[0] + value[1] * value[1];
    value = sq > 1e-6 ? [value[0] / Math.sqrt(sq), value[1] / Math.sqrt(sq)] : [0, 0];
    const s1 = w.sampleSeafloorLocalY(n, nz);
    let n5 = s1.y;
    const m1 = sampleMeshLocalY(floor, n, nz);
    if (m1 != null) n5 = m1;
    const n6 = Math.max(0, n4 - n5);
    const n9 = clampNum(n6 / SKIRT_SLOPE_TANGENT, BOUNDARY_SKIRT_MIN_WIDTH, BOUNDARY_SKIRT_MAX_WIDTH);
    const n10 = clampNum(n + value[0] * n9, 0, tileWorldSize);
    const n11 = clampNum(nz + value[1] * n9, 0, tileWorldSize);
    const s2 = w.sampleSeafloorLocalY(n10, n11);
    let n12 = s2.y;
    const m2 = sampleMeshLocalY(floor, n10, n11);
    if (m2 != null) n12 = m2;
    const n13 = n12 - SHORE_WALL_BOTTOM_OVERLAP;
    const depth2 = Math.max(0, oceanLocalY - n13);
    const n14 = Math.max(0, oceanLocalY - n4);
    const n15 = 1 - clamp01(depth2 / 6);
    const depth3 = lerp(depth2, n14, n15 * 0.85);
    const band3 = lerp(s2.band, s1.band, n15 * 0.85);
    const dist3 = lerp(s2.distanceToCoast, s1.distanceToCoast, n15 * 0.85);
    top.set(key, positions.length / 3);
    positions.push(n, n4, nz);
    colors.push(...createVertexColor(n14, s1.band, s1.distanceToCoast, SHORE_WALL_TOP_TEXTURE_STRENGTH));
    uvs.push(n, nz);
    bottom.set(key, positions.length / 3);
    positions.push(n10, n13, n11);
    colors.push(...createVertexColor(depth3, band3, dist3));
    uvs.push(n10, n11);
  };
  for (const [ax, az, bx, bz] of list) { ensure(ax, az); ensure(bx, bz); }
  for (const [ax, az, bx, bz] of list) {
    const k3 = az * stride + ax, k4 = bz * stride + bx;
    const v2 = top.get(k3), v3 = top.get(k4), v4 = bottom.get(k3), v5 = bottom.get(k4);
    if (v2 == null || v3 == null || v4 == null || v5 == null) continue;
    if (Math.max(positions[v2 * 3 + 1] - positions[v4 * 3 + 1], positions[v3 * 3 + 1] - positions[v5 * 3 + 1]) < WALL_MINIMUM_DROP) continue;
    indices.push(v2, v3, v5, v2, v5, v4, v2, v5, v3, v2, v4, v5);
  }
}

const clampNum = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * TrySampleMeshLocalY: the floor's height at a pixel-local point, on the
 * triangle the mesh draws there, or null off the floor's water quads.
 */
export function sampleMeshLocalY(floor, lx, lz) {
  if (!floor || !floor.vertexLocalY) return null;
  const num = lx / TILE_WORLD_SIZE, num2 = lz / TILE_WORLD_SIZE;
  if (num < 0 || num > 1 || num2 < 0 || num2 > 1) return null;
  const num3 = VERTEX_GRID_SIZE;
  const num4 = num * (num3 - 1), num5 = num2 * (num3 - 1);
  const num6 = clampInt(Math.floor(num4), 0, num3 - 2);
  const num7 = clampInt(Math.floor(num5), 0, num3 - 2);
  if (floor.floorQuadWater && !floor.floorQuadWater[num7 * (num3 - 1) + num6]) return null;
  const num8 = num6 + 1, num9 = num7 + 1;
  const num10 = clamp01(num4 - num6), num11 = clamp01(num5 - num7);
  const v = floor.vertexLocalY;
  const num12 = v[num7 * num3 + num6], num13 = v[num7 * num3 + num8], num14 = v[num9 * num3 + num6], num15 = v[num9 * num3 + num8];
  if (num10 >= num11) return num12 * (1 - num10) + num13 * (num10 - num11) + num15 * num11;
  return num12 * (1 - num11) + num14 * (num11 - num10) + num15 * num10;
}

/** TrySampleMeshLocalYAndSlope: the height and the triangle's slope in degrees. */
export function sampleMeshLocalYAndSlope(floor, lx, lz) {
  if (!floor || !floor.vertexLocalY) return null;
  const num = lx / TILE_WORLD_SIZE, num2 = lz / TILE_WORLD_SIZE;
  if (num < 0 || num > 1 || num2 < 0 || num2 > 1) return null;
  const num3 = VERTEX_GRID_SIZE;
  const num4 = num * (num3 - 1), num5 = num2 * (num3 - 1);
  const num6 = clampInt(Math.floor(num4), 0, num3 - 2);
  const num7 = clampInt(Math.floor(num5), 0, num3 - 2);
  if (floor.floorQuadWater && !floor.floorQuadWater[num7 * (num3 - 1) + num6]) return null;
  const num8 = num6 + 1, num9 = num7 + 1;
  const num10 = clamp01(num4 - num6), num11 = clamp01(num5 - num7);
  const v = floor.vertexLocalY;
  const num12 = v[num7 * num3 + num6], num13 = v[num7 * num3 + num8], num14 = v[num9 * num3 + num6], num15 = v[num9 * num3 + num8];
  let localY, num16, num17;
  if (num10 >= num11) { localY = num12 * (1 - num10) + num13 * (num10 - num11) + num15 * num11; num16 = num13 - num12; num17 = num15 - num13; }
  else { localY = num12 * (1 - num11) + num14 * (num11 - num10) + num15 * num10; num16 = num15 - num14; num17 = num14 - num12; }
  const num18 = TILE_WORLD_SIZE / (num3 - 1);
  const num19 = num16 / num18, num20 = num17 / num18;
  return { localY, slopeDegrees: Math.atan(Math.sqrt(num19 * num19 + num20 * num20)) * 57.29578 };
}
