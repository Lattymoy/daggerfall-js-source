// ═══════════════════════════════════════════════════════════════════
// DW-B: DeepWaterTileData.cs (Iliac Puddle No More 1.2.2, jet082) - what
// the deep bay knows about ONE streamed pixel: its climate and the 3 x 3
// climates around it (blended into the floor's base depth and colour
// band), whether it is ocean-connected (the pixel has water at all and
// the bake is in), whether the fine bake missed its water (the local
// fallback), and the distance-to-edge the floor's depth is built from.
//
// COORDINATES. The C# asks world positions and subtracts the terrain's
// transform position, cached per frame. The port asks PIXEL-LOCAL
// meters (lx east, lz north from the pixel's south-west corner) - the
// frame the pixel's terrain is built in, which the floating origin never
// moves - so `fracX = lx / 819.2` is the C#'s `(worldX - origin.x) /
// tileWorldSize` with the origin already taken off. The global-map
// fraction walk (GetGlobalMapFractions) is kept whole: a point just past
// the pixel's edge still resolves to the neighbour pixel's bake cells.
// ═══════════════════════════════════════════════════════════════════

import { climateBaseDepth, climateBandSignal } from './deepBathymetry.js';
import { mapDataHasWater, isLocalPointWater } from './deepWaterClassification.js';

const TILE_WORLD_SIZE = 819.2;
const OCEAN_CLIMATE = 223;
/** LocalWaterFallbackDistanceMeters: a local-fallback pixel's distance to the edge, everywhere. */
export const LOCAL_WATER_FALLBACK_DISTANCE_METERS = Math.fround(810.00006);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * clamp01(t);

export class DeepWaterTileData {
  /**
   * DeepWaterTileData.Initialize.
   * @param {object} deps
   * @param {number} deps.mapPixelX
   * @param {number} deps.mapPixelY
   * @param {object} deps.mapData - {samples, tilemap} of the streamed pixel
   * @param {number} deps.climateIndex - MapsFile climate at the pixel
   * @param {(x: number, y: number) => number} deps.climateAt - MapFileReader.GetClimateIndex (clamped by the caller's reader)
   * @param {?object} deps.bake - the DeepWatersBake, or null while it is not in (HasDistanceField false)
   */
  constructor({ mapPixelX, mapPixelY, mapData, climateIndex, climateAt, bake }) {
    this.mapPixelX = mapPixelX;
    this.mapPixelY = mapPixelY;
    this.mapData = mapData;
    this.climateIndex = climateIndex;
    this.bake = bake ?? null;
    this._climateAt = climateAt;
    this.usesLocalWaterFallback = false;
    this.biomeClimateIndex = this._resolveBiomeClimateIndex(climateIndex, mapPixelX, mapPixelY);
    this._baseDepth = new Float64Array(9);
    this._band = new Float64Array(9);
    this._cacheClimateNeighborhood();
    this.isOceanConnected = this._computeOceanConnectivity();
    this.initialized = true;
  }

  /** HasDistanceField: initialized and the bake loaded. */
  get hasDistanceField() { return !!(this.initialized && this.bake && this.bake.loaded); }

  /** GetDistanceToEdgeMeters. */
  getDistanceToEdgeMeters(lx, lz) {
    if (this.usesLocalWaterFallback) return LOCAL_WATER_FALLBACK_DISTANCE_METERS;
    if (!this.bake || !this.bake.loaded) return Number.MAX_VALUE;
    const g = this._global(lx, lz);
    if (this._shouldUseLocalEdgeDistance(g.mapPixelX, g.mapPixelY, g.fracX, g.fracZ)) {
      const num = this.bake.sampleLocalEdgeDistanceMeters(g.mapPixelX, g.mapPixelY, g.fracX, g.fracZ);
      return !(num < Number.MAX_VALUE) ? LOCAL_WATER_FALLBACK_DISTANCE_METERS : num;
    }
    return this.bake.sampleEdgeDistanceMeters(g.mapPixelX, g.mapPixelY, g.fracX, g.fracZ);
  }

  /** IsBakedWater. */
  isBakedWater(lx, lz) {
    if (!this.bake || !this.bake.loaded) return false;
    const g = this._global(lx, lz);
    return this.bake.isWaterAt(g.mapPixelX, g.mapPixelY, g.fracX, g.fracZ);
  }

  /** IsCarvedWater(worldX, worldZ). */
  isCarvedWaterLocal(lx, lz) {
    const g = this._global(lx, lz);
    return this.isCarvedWater(g.mapPixelX, g.mapPixelY, g.fracX, g.fracZ);
  }

  /** IsCarvedWater(mapPixelX, mapPixelY, fracX, fracZ). */
  isCarvedWater(mapPixelX, mapPixelY, fracX, fracZ) {
    if (this.usesLocalWaterFallback) {
      if (mapPixelX !== this.mapPixelX || mapPixelY !== this.mapPixelY) return false;
      return isLocalPointWater(this.mapData, fracX, fracZ);
    }
    if (!this.bake || !this.bake.loaded || !this.bake.hasFineWaterMask) return false;
    if (this.bake.isCarvedWater(mapPixelX, mapPixelY, fracX, fracZ)) return true;
    return this._isLocalWaterMissedByFineBake(mapPixelX, mapPixelY, fracX, fracZ);
  }

  _isLocalWaterMissedByFineBake(mapPixelX, mapPixelY, fracX, fracZ) {
    if (mapPixelX === this.mapPixelX && mapPixelY === this.mapPixelY && this.bake.hasFineWaterMask
      && !this.bake.isCarvedWater(mapPixelX, mapPixelY, fracX, fracZ)) {
      return isLocalPointWater(this.mapData, fracX, fracZ);
    }
    return false;
  }

  _shouldUseLocalEdgeDistance(mapPixelX, mapPixelY, fracX, fracZ) {
    if (mapPixelX === this.mapPixelX && mapPixelY === this.mapPixelY && this.bake.hasFineWaterMask && isLocalPointWater(this.mapData, fracX, fracZ)) {
      if (this.bake.isWaterAt(mapPixelX, mapPixelY, fracX, fracZ)) return this._isLocalWaterMissedByFineBake(mapPixelX, mapPixelY, fracX, fracZ);
      return true;
    }
    return false;
  }

  /** GetNoiseWorldCoords: map-global meters, x east, z SOUTH (the bake's rows). */
  getNoiseWorldCoords(lx, lz) {
    const g = this._global(lx, lz);
    return [(g.mapPixelX + g.fracX) * TILE_WORLD_SIZE, (g.mapPixelY + (1 - g.fracZ)) * TILE_WORLD_SIZE];
  }

  /** GetBlendedClimate: the 3 x 3 neighbourhood's base depth and band, bilinear between pixel centres. */
  getBlendedClimate(lx, lz) {
    const g = this._global(lx, lz);
    const num = g.mapPixelX + g.fracX - 0.5;
    const num2 = g.mapPixelY + (1 - g.fracZ) - 0.5;
    const num3 = Math.floor(num);
    const num4 = Math.floor(num2);
    const num5 = num - num3;
    const num6 = num2 - num4;
    const num7 = clampInt(num3 - (this.mapPixelX - 1), 0, 2);
    const num8 = clampInt(num4 - (this.mapPixelY - 1), 0, 2);
    const num9 = Math.min(num7 + 1, 2);
    const num10 = Math.min(num8 + 1, 2);
    const d = this._baseDepth, b = this._band;
    const num11 = lerp(d[num8 * 3 + num7], d[num8 * 3 + num9], num5);
    const num12 = lerp(d[num10 * 3 + num7], d[num10 * 3 + num9], num5);
    const baseDepth = lerp(num11, num12, num6);
    const num13 = lerp(b[num8 * 3 + num7], b[num8 * 3 + num9], num5);
    const num14 = lerp(b[num10 * 3 + num7], b[num10 * 3 + num9], num5);
    return { baseDepth, band: lerp(num13, num14, num6) };
  }

  /** GetBlendedClimateBaseDepth. */
  getBlendedClimateBaseDepth(lx, lz) { return this.getBlendedClimate(lx, lz).baseDepth; }

  _cacheClimateNeighborhood() {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const c = this._climateAtPixel(this.mapPixelX + j, this.mapPixelY + i);
        const k = (i + 1) * 3 + (j + 1);
        this._baseDepth[k] = climateBaseDepth(c);
        this._band[k] = climateBandSignal(c);
      }
    }
  }

  /** ClimateAtPixel: clamped to the map. */
  _climateAtPixel(mapX, mapY) {
    if (!this._climateAt) return this.climateIndex;
    return this._climateAt(clampInt(mapX, 0, 999), clampInt(mapY, 0, 499));
  }

  /** ResolveBiomeClimateIndex: an ocean pixel near land wears its neighbours' commonest climate. */
  _resolveBiomeClimateIndex(climateIndex, mapX, mapY) {
    if (climateIndex !== OCEAN_CLIMATE) return climateIndex;
    // With no bake the C#'s MapPixelHasLandCells answers false and every distance is float.MaxValue: offshore.
    if ((!this.bake || !this.bake.mapPixelHasLandCells(mapX, mapY)) && this._isFullyOffshore(mapX, mapY)) return climateIndex;
    if (!this._climateAt) return climateIndex;
    let result = climateIndex, best = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (j === 0 && i === 0) continue;
        const c = this._climateSafe(mapX + j, mapY + i, climateIndex);
        if (c === OCEAN_CLIMATE) continue;
        const n = this._countNeighborClimate(mapX, mapY, c, climateIndex);
        if (n > best) { result = c; best = n; }
      }
    }
    return result;
  }

  /** IsFullyOffshore: nine points of the pixel all more than 360 m from the coast. */
  _isFullyOffshore(mapX, mapY) {
    if (!this.bake || !this.bake.loaded) return true;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const fracX = Math.fround(0.125 + j * 0.375);
        const fracZ = Math.fround(0.125 + i * 0.375);
        if (this.bake.sampleDistanceMeters(mapX, mapY, fracX, fracZ) <= 360) return false;
      }
    }
    return true;
  }

  _countNeighborClimate(mapX, mapY, climate, fallback) {
    let n = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if ((j !== 0 || i !== 0) && this._climateSafe(mapX + j, mapY + i, fallback) === climate) n++;
      }
    }
    return n;
  }

  _climateSafe(mapX, mapY, fallback) {
    if (mapX < 0 || mapY < 0 || mapX >= 1000 || mapY >= 500) return fallback;
    return this._climateAt(mapX, mapY);
  }

  /** GetGlobalMapFractions, with NormalizeMapFractionX/Y. */
  _global(lx, lz) {
    const fracX2 = lx / TILE_WORLD_SIZE, fracZ2 = lz / TILE_WORLD_SIZE;
    const num = this.mapPixelX + fracX2;
    const num2 = this.mapPixelY + (1 - fracZ2);
    let mapPixelX = Math.floor(num);
    let mapPixelY = Math.floor(num2);
    let fracX = num - mapPixelX;
    let fracZ = 1 - (num2 - mapPixelY);
    if (mapPixelX < 0) { mapPixelX = 0; fracX = 0; } else if (mapPixelX >= 1000) { mapPixelX = 999; fracX = 1; } else fracX = clamp01(fracX);
    if (mapPixelY < 0) { mapPixelY = 0; fracZ = 1; } else if (mapPixelY >= 500) { mapPixelY = 499; fracZ = 0; } else fracZ = clamp01(fracZ);
    return { mapPixelX, mapPixelY, fracX, fracZ };
  }

  /** ComputeOceanConnectivity: the pixel has water and the bake is in; the fallback when its fine cells are none. */
  _computeOceanConnectivity() {
    if (!this.bake || !this.bake.loaded) return false;
    if (!mapDataHasWater(this.mapData)) return false;
    this.usesLocalWaterFallback = !this.bake.mapPixelHasFineWaterCells(this.mapPixelX, this.mapPixelY);
    return true;
  }
}
