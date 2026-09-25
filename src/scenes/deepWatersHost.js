// ═══════════════════════════════════════════════════════════════════
// DW-B (2026-09-25): ILIAC PUDDLE NO MORE IN THE STREAMED WORLD. The
// host half of DeepWaterFloorBuilder, DeepWaterTerrainCapRenderer and
// WaterSurfaceManager (jet082's 1.2.2): when a pixel is promoted - the
// port's publish of a built pixel - its Deep Waters are built from what
// the pixel streamed (deepWatersPixel.js, on the Deep Waters worker),
// and what comes back is stood in the world:
//
//   the FLOOR - drawn (the renderer's seafloor pass), walked on (the
//     world's heightAt answers the floor in a carved cell), and its
//     hole-edge WALLS a collider bucket of their own, as the mod's
//     MeshCollider stands them;
//   the CAP - a pure-ocean pixel's ground not drawn at all, or its water
//     texels clipped and repainted in the pixel's tilemap texture;
//   the SURFACE - the sea's own, drawn over the floor.
//
// WHEN, as the mod decides it (HandlePromote): a pixel within one of the
// player's (Chebyshev) is built as it is promoted - here, before the
// world publishes it, so the ground under a teleport is whole the moment
// it stands - and every other one is DEFERRED and built one at a time,
// the nearest to the player first (PumpDeferredBuilds). The bake is
// loaded when the mod initialises, before any terrain; here it may land
// after the first pixels (a first boot builds it for seconds), and when
// it lands every standing pixel is promoted again - the mod's own
// RefreshLoadedTiles(force), which its settings callback runs too.
//
// The mod's two geometry settings (Water Depth, Spawn Water Surfaces) are
// read at each build; a change re-promotes every standing pixel, as the
// mod's LoadSettings does. Its Enabled switch is the port's and is read
// once, at the world's mount (a flip reaches the next world, as World of
// Daggerfall's does).
// ═══════════════════════════════════════════════════════════════════

import { openDeepWaters, deepWatersLocationRects } from '../world/deepWatersClient.js';
import { modSetting, modSettingsGeneration } from '../systems/modSettings.js';
import { DeepWaterTileData } from '../world/deepWaterTileData.js';
import { sampleMeshLocalY, HOLES_RESOLUTION, TILE_WORLD_SIZE } from '../world/deepWaterFloor.js';
import { DW_OCEAN_LOCAL_Y } from '../world/deepWatersPixel.js';
import { mapDataHasWater, isLocalPointWater } from '../world/deepWaterClassification.js';
import { sampleDepthMeters } from '../world/deepBathymetry.js';

export const DEEP_WATERS_VENDOR = 'iliac-puddle-no-more';

/** The mod's switch (the port's Enabled). */
export function deepWatersOn() { return modSetting(DEEP_WATERS_VENDOR, 'Enabled') === true; }

/** DeepWaterFloorBuilder.SyncBuildChebyshevRadius: built as promoted within this of the player's pixel. */
export const SYNC_BUILD_CHEBYSHEV_RADIUS = 1;

const clampInt = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** DW-D: the swim's own settings (the stroke and the multiplier, the Argonian's breath) - the dungeon's swimmer reads them too. */
export function deepWatersSwimSettings() {
  const get = (k) => modSetting(DEEP_WATERS_VENDOR, k);
  return { swimSpeedMultiplier: Number(get('General.SwimSpeedMultiplier')), enableSwimStroke: get('General.EnableSwimStroke') === true, argonianInfiniteBreath: get('General.ArgonianInfiniteBreath') === true };
}

/** The settings a pixel's geometry is built from - DeepWaters.ApplySettings' two geometry reads. */
export function deepWatersGeometrySettings() {
  return {
    waterDepth: Number(modSetting(DEEP_WATERS_VENDOR, 'General.WaterDepth')),
    spawnSurfaces: modSetting(DEEP_WATERS_VENDOR, 'General.SpawnWaterSurfaces') === true,
  };
}

/**
 * The seafloor's pixel-local height in a carved cell, on the triangle the
 * floor draws there - null where the cell keeps its ground (the terrain's
 * own floor stands) or the pixel has no floor.
 */
export function carvedFloorLocalY(dw, lx, lz) {
  if (!dw || !dw.holes || !dw.floor) return null;
  const n = HOLES_RESOLUTION;
  const cx = Math.floor(lx / (TILE_WORLD_SIZE / n)), cz = Math.floor(lz / (TILE_WORLD_SIZE / n));
  if (cx < 0 || cz < 0 || cx >= n || cz >= n) return null;
  if (dw.holes[cz * n + cx]) return null;
  return sampleMeshLocalY(dw.floor, lx, lz);
}

/**
 * The walls' triangles, one face each: AppendHoleEdgeWalls writes every
 * segment's quad twice (both windings, the mod's cull-off look); a
 * collider needs the surface once.
 */
export function wallColliderIndices(floor) {
  if (!floor) return null;
  const all = floor.indices, start = floor.floorGridIndexCount | 0;
  if (all.length <= start) return null;
  const out = [];
  for (let i = start; i + 12 <= all.length; i += 12) {
    for (let k = 0; k < 6; k++) out.push(all[i + k]);
  }
  return out.length ? Uint32Array.from(out) : null;
}

/**
 * @param {object} deps
 * @param {object} deps.woods - the boot-smoothed WoodsFile
 * @param {?Uint8Array} deps.woodsBytes - its synced bytes (a copy crosses to the worker)
 * @param {Iterable<[number, number, object]>} deps.locations - [px, py, dfLocation] of every classic location
 * @param {object} deps.maps
 * @param {object} deps.blocks
 * @param {Map<string, object>} deps.built - the world's built pixels
 * @param {(x: number, y: number) => number} deps.climateAt - MapsFile climate, in-map coordinates
 * @param {() => {x: number, y: number}} deps.currentPixel - the player's pixel (PlayerGPS.CurrentMapPixel)
 * @param {object} deps.collider - the world's Collider
 * @param {(px: number, py: number, out: number[]) => number[]} deps.pixelTranslation
 * @param {object} deps.gpu - {create(entry, result) -> handle, destroy(handle), setTilemap(entry, bytes)}
 * @param {object} [deps.client] - test seam: an openDeepWaters-shaped client
 */
export function createDeepWatersHost({ woods, woodsBytes = null, locations = [], maps = null, blocks = null, built, climateAt, currentPixel, collider = null, pixelTranslation = null, gpu = null, client = null }) {
  const dw = client ?? openDeepWaters({ woods, woodsBytes, rects: deepWatersLocationRects(woods, locations, maps, blocks) });
  let bake = null;
  let disposed = false;
  const deferred = new Map();   // key -> entry, promoted when its turn comes
  let inFlight = null;          // the deferred key on the worker now
  let settingsGen = modSettingsGeneration();
  let geometry = deepWatersGeometrySettings();

  const keyOf = (e) => `${e.px},${e.py}`;
  const isCurrent = (e) => built.get(keyOf(e)) === e;
  const climateClamped = (x, y) => climateAt(clampInt(x, 0, 999), clampInt(y, 0, 499));

  function jobFor({ px, py, samples, tilemap, tilemapBytes }) {
    const climates = new Array(9);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) climates[(dy + 1) * 3 + dx + 1] = climateClamped(px + dx, py + dy);
    const at = (x, y) => built.get(`${x},${y}`)?.samples ?? null;
    return {
      px, py, samples, tilemap, tilemapBytes, climates,
      neighbours: { w: at(px - 1, py), e: at(px + 1, py), s: at(px, py + 1), n: at(px, py - 1) },
      waterDepth: geometry.waterDepth, spawnSurfaces: geometry.spawnSurfaces,
    };
  }

  const centre = () => { const c = currentPixel(); return [c.x, c.y]; };

  /** A pixel with no water of its own and no sea in the bake at or beside it: the promote's answer is nothing, without the trip. */
  function isDry(pixel) {
    if (!bake || bake.mapPixelOrCardinalNeighborHasWaterCells(pixel.px, pixel.py)) return false;
    return !mapDataHasWater({ samples: pixel.samples, tilemap: pixel.tilemap });
  }

  /** The promote, on the worker - or its answer at once for a dry pixel. */
  function promote(pixel) {
    if (isDry(pixel)) return Promise.resolve(null);
    return dw.buildPixel(jobFor(pixel), centre());
  }

  /** The floors' wall buckets standing now - the probes that read the world as the mod's rays do skip them (IsShoreGround). */
  const wallBuckets = new Set();

  function restoreTilemap(entry) {
    if (entry._dwPatched) { gpu?.setTilemap?.(entry, entry.tilemapBytes); entry._dwPatched = false; }
  }

  /** RemoveFloor (and the surface's RemoveExisting): the floor, its walls and the surface go. */
  function release(entry) {
    const s = entry.deepWaters;
    if (!s) return;
    if (s.gpu) gpu?.destroy?.(s.gpu);
    if (s.bucket) { collider?.removeBucket(s.bucket); wallBuckets.delete(s.bucket); }
    entry.deepWaters = null;
  }

  /** Stand one result on its (still current) entry, replacing what stood there. */
  function apply(entry, result) {
    release(entry);
    // the cap: the patched TileMap, or the one the pixel streamed (DeepWaterTerrainCapRenderer.Restore)
    if (result?.cap?.tilemap) { gpu?.setTilemap?.(entry, result.cap.tilemap); entry._dwPatched = true; }
    else restoreTilemap(entry);
    if (!result || (!result.floor && !result.surface && !result.ocean)) return;
    const state = {
      ocean: result.ocean, fallback: result.fallback, biomeClimateIndex: result.biomeClimateIndex,
      holes: result.holes, floor: result.floor, surface: result.surface,
      hide: !!result.cap?.hide,
      gpu: null, bucket: null, _tile: null,
    };
    // the walls' collider, pixel-local through the live translation (the mod's MeshCollider over the floor mesh:
    // the floor itself is the world's heightAt in a carved cell)
    const wall = wallColliderIndices(result.floor);
    if (wall && collider && pixelTranslation) {
      state.bucket = `${keyOf(entry)}:deepwaters`;
      const o = [0, 0, 0];
      collider.addMesh(state.bucket, result.floor.positions, wall, IDENTITY, () => pixelTranslation(entry.px, entry.py, o));
      wallBuckets.add(state.bucket);
    }
    if (gpu && (result.floor || result.surface)) state.gpu = gpu.create(entry, result);
    entry.deepWaters = state;
  }

  /** RefreshLoadedTiles(force): every standing pixel, deferred nearest-first. */
  function refreshAll() {
    for (const e of built.values()) deferred.set(keyOf(e), e);
  }

  dw.ready.then((b) => {
    if (disposed || !b) return;
    bake = b;
    refreshAll();
  });

  return {
    get ready() { return dw.ready; },
    get bake() { return bake; },
    get pendingCount() { return deferred.size + (inFlight ? 1 : 0); },

    /**
     * HandlePromote's synchronous arm: a pixel within one of the player's,
     * built now - the world awaits it before it publishes. Null for every
     * other pixel, and while the bake is not in.
     * @param {{px: number, py: number, samples: Float32Array, tilemap: Uint8Array, tilemapBytes: Uint8Array}} pixel
     */
    promoteNear(pixel) {
      if (disposed || !bake) return null;
      if (chebyshev({ x: pixel.px, y: pixel.py }, currentPixel()) > SYNC_BUILD_CHEBYSHEV_RADIUS) return null;
      return promote(pixel);
    },

    /** The world published `entry`: stand the near result it awaited, or defer it. */
    published(entry, result = undefined) {
      if (disposed) return;
      if (result !== undefined) apply(entry, result);
      else if (bake) deferred.set(keyOf(entry), entry);
    },

    /** destroyPixel: the pixel's Deep Waters leave with it (its texture goes with the pixel). */
    destroyed(entry) {
      deferred.delete(keyOf(entry));
      release(entry);
      entry._dwPatched = false;
    },

    /** One frame's work: a settings change re-promotes everything; one deferred build goes out. */
    pump() {
      if (disposed) return;
      const g = modSettingsGeneration();
      if (g !== settingsGen) {
        settingsGen = g;
        const next = deepWatersGeometrySettings();
        if (next.waterDepth !== geometry.waterDepth || next.spawnSurfaces !== geometry.spawnSurfaces) {
          geometry = next;
          if (bake) refreshAll();
        }
      }
      if (!bake || inFlight || deferred.size === 0) return;
      const here = currentPixel();
      let bestKey = null, best = Infinity;
      for (const [k, e] of deferred) {
        if (!isCurrent(e)) { deferred.delete(k); continue; }
        const d = chebyshev({ x: e.px, y: e.py }, here);
        if (d < best) { best = d; bestKey = k; }
      }
      if (bestKey == null) return;
      const entry = deferred.get(bestKey);
      deferred.delete(bestKey);
      inFlight = bestKey;
      promote(entry).then((r) => {
        if (inFlight === bestKey) inFlight = null;
        if (!disposed && isCurrent(entry)) apply(entry, r);
      }, () => { if (inFlight === bestKey) inFlight = null; });
    },

    /** The floor's local height at a carved cell of `entry`, or null. */
    floorLocalY(entry, lx, lz) { return carvedFloorLocalY(entry?.deepWaters, lx, lz); },

    /**
     * DeepWaterWorld.TryGetWaterColumn + OutdoorSwimDriver.TryGetAuthoritativeWaterColumn:
     * the sea over a CARVED point and the seafloor under it - the built
     * floor's own triangle where the floor has one, the bathymetry's depth
     * where the pixel has no floor built - or null. World heights.
     * @param {object} entry - the built pixel the point lies on
     * @param {number} lx @param {number} lz - pixel-local
     * @param {number} baseY - the pixel's translation height
     * @returns {?{oceanY: number, seafloorY: number, depth: number, entry: object}}
     */
    waterColumn(entry, lx, lz, baseY = 0) {
      const seafloorY = this.swimmableSeafloorY(entry, lx, lz, baseY);
      if (seafloorY == null) return null;
      const oceanY = baseY + DW_OCEAN_LOCAL_Y;
      const depth = oceanY - seafloorY;
      return depth > 0 ? { oceanY, seafloorY, depth, entry } : null;
    },

    /**
     * OutdoorSwimDriver.TryGetSwimmableSeafloorWorldY: over carved water
     * (TryGetWaterColumn's gates), the floor mesh where it has a quad; a
     * built floor with no quad here is no swimmable seafloor at all; with no
     * floor built, the column's own bathymetry (ResolveSeafloorLocalY). The
     * world height, or null.
     */
    swimmableSeafloorY(entry, lx, lz, baseY = 0) {
      const s = entry?.deepWaters;
      const tile = this.tileOf(entry);
      if (!s || !tile || !tile.isOceanConnected || !tile.hasDistanceField) return null;
      const fx = lx / TILE_WORLD_SIZE, fz = lz / TILE_WORLD_SIZE;
      if (fx < 0 || fx > 1 || fz < 0 || fz > 1) return null;
      if (!isLocalPointWater({ samples: entry.samples, tilemap: entry.tilemap }, fx, fz)) return null;
      if (!tile.isCarvedWaterLocal(lx, lz)) return null;
      if (s.floor) {
        const y = sampleMeshLocalY(s.floor, lx, lz);   // TryGetCarvedSeafloorWorldY
        return y == null ? null : baseY + y;
      }
      const [nx, nz] = tile.getNoiseWorldCoords(lx, lz);
      return baseY + DW_OCEAN_LOCAL_Y - sampleDepthMeters(nx, nz, tile.getBlendedClimateBaseDepth(lx, lz), tile.getDistanceToEdgeMeters(lx, lz), geometry.waterDepth);
    },

    /**
     * DeepWaterWorld.TryGetWaterColumn itself: the same gates, the seafloor
     * the column's own bathymetry (ResolveSeafloorLocalY) whatever the floor
     * mesh says - the depth the fog's presentation, the shallow factor and
     * the nearby-column probes read - and beside it the rendered floor
     * (TryGetRenderedSeafloorWorldY: the mesh where it has a quad, else the
     * bathymetry). {oceanY, seafloorY, renderedSeafloorY, depth, entry}, or
     * null where the C# returns false.
     */
    rawWaterColumn(entry, lx, lz, baseY = 0) {
      const s = entry?.deepWaters;
      const tile = this.tileOf(entry);
      if (!s || !tile || !tile.isOceanConnected || !tile.hasDistanceField) return null;
      const fx = lx / TILE_WORLD_SIZE, fz = lz / TILE_WORLD_SIZE;
      if (fx < 0 || fx > 1 || fz < 0 || fz > 1) return null;
      if (!isLocalPointWater({ samples: entry.samples, tilemap: entry.tilemap }, fx, fz)) return null;
      if (!tile.isCarvedWaterLocal(lx, lz)) return null;
      const oceanY = baseY + DW_OCEAN_LOCAL_Y;
      const [nx, nz] = tile.getNoiseWorldCoords(lx, lz);
      const seafloorY = baseY + DW_OCEAN_LOCAL_Y - sampleDepthMeters(nx, nz, tile.getBlendedClimateBaseDepth(lx, lz), tile.getDistanceToEdgeMeters(lx, lz), geometry.waterDepth);
      const mesh = s.floor ? sampleMeshLocalY(s.floor, lx, lz) : null;
      return { oceanY, seafloorY, renderedSeafloorY: mesh != null ? baseY + mesh : seafloorY, depth: oceanY - seafloorY, entry };
    },

    /** The floors' wall buckets (the collider's filter takes keys: {skip: wallBuckets}). */
    get wallBuckets() { return wallBuckets; },

    /** The pure-ocean hide: the pixel's ground is not drawn. */
    hidden(entry) { return !!entry?.deepWaters?.hide; },

    /** The pixel's DeepWaterTileData, for the runtime's queries - made on first ask (the bake's planes are in by then). */
    tileOf(entry) {
      const s = entry?.deepWaters;
      if (!s || !bake) return null;
      if (!s._tile) {
        s._tile = new DeepWaterTileData({
          mapPixelX: entry.px, mapPixelY: entry.py, mapData: { samples: entry.samples, tilemap: entry.tilemap },
          climateIndex: climateAt(entry.px, entry.py), climateAt: climateClamped, bake,
        });
      }
      return s._tile;
    },

    oceanLocalY: DW_OCEAN_LOCAL_Y,

    dispose() {
      disposed = true;
      deferred.clear();
      for (const e of built.values()) release(e);
      dw.dispose();
    },
  };
}

const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
