// Floating-origin streaming logic for the world scene: which map pixels
// are in range, when the world recenters, and where everything sits.
// 1:1 semantics from Daggerfall Unity's StreamingWorld + FloatingOrigin
// (MIT, Daggerfall Workshop), as pure state - the scene owns assets.
// Verbatim:
//   - TerrainDistance 3: the desired set is the (2d+1)^2 pixel grid
//     around the player; IsInRange is |delta| <= TerrainDistance on both
//     axes, pixels beyond are collected (unloaded).
//   - World coordinates: SceneMapRatio = 1 / GlobalScale (40 native
//     units per scene unit); pixel = WorldCoordToMapPixel(worldX / 32768,
//     499 - worldZ / 32768) with C#-style truncating division. DFU
//     accumulates worldX/worldZ incrementally with the last player
//     position compensated on every recenter; the closed form here -
//     native = originPixelCorner + (scenePos - compensation) *
//     SceneMapRatio - is the same mapping without drift.
//   - FloatingOrigin: on a pixel change the whole world (and player)
//     shifts by (-dPixelX * 819.2, 0, +dPixelY * 819.2); vertical
//     recenter fires past +/-500 with yChange = -y. The compensation
//     vector accumulates every shift, and terrain placement is
//     (pixel - mapOrigin) * (819.2, -819.2) + compensation - map Y runs
//     south.
//   - Init matches ResetStreamingWorld: compensation zeroed on x/z,
//     mapOrigin = the player's current pixel.

import { TERRAIN_SIZE } from './terrainSampler.js';
import { GLOBAL_SCALE } from './meshReader.js';
import { WORLD_MAP_TILE_DIM, getLocationTerrainTileOrigin } from './terrainTiles.js';

export const TERRAIN_DISTANCE = 3;   // DFU's default (StreamingWorld.cs:56); D1: the world host passes the LIVE Experimental/TerrainDistance (1..4) into the constructor
const VERTICAL_THRESHOLD = 500;
// MapsFile.MinMapPixelX/Y and MaxMapPixelX/Y - max EXCLUSIVE, so the
// world map is 0..999 by 0..499 (terrainSampler keeps its own copy of
// the Y bound for the same reason: no reader dependency here).
const MIN_MAP_PIXEL_X = 0;
const MIN_MAP_PIXEL_Y = 0;
const MAX_MAP_PIXEL_X = 1000;
const MAX_MAP_PIXEL_Y = 500;
const SCENE_MAP_RATIO = 1 / GLOBAL_SCALE;
const NATIVE_PIXEL = 32768; // MapsFile world units per map pixel

/** Verbatim MapsFile.WorldCoordToMapPixel (truncating division). DFU
 * casts the accumulated float to int first; trunc(trunc(w) / k) equals
 * trunc(w / k) for positive integer k, so the single trunc here is the
 * same mapping. */
export function worldCoordToMapPixel(worldX, worldZ) {
  return {
    x: Math.trunc(worldX / NATIVE_PIXEL),
    y: 499 - Math.trunc(worldZ / NATIVE_PIXEL),
  };
}

/** Verbatim MapsFile.MapPixelToWorldCoords (pixel corner). */
export function mapPixelToWorldCoords(mapPixelX, mapPixelY) {
  return { x: mapPixelX * NATIVE_PIXEL, z: (499 - mapPixelY) * NATIVE_PIXEL };
}

/** MapsFile.WorldMapRMBDim - world units per RMB block. */
export const WORLD_MAP_RMB_DIM = 4096;

/** PlayerGPS.SetWorldLocationRect (PlayerGPS.cs:636-659): the
 *  location's footprint in WORLD units - the pixel corner, shifted by
 *  the terrain tile origin (x2, in tile units), sized by the exterior's
 *  RMB block count. */
export function locationWorldRect(dfLocation, mapPixelX, mapPixelY) {
  const origin = mapPixelToWorldCoords(mapPixelX, mapPixelY);
  const tileOrigin = getLocationTerrainTileOrigin(dfLocation);
  const minX = origin.x + tileOrigin.x * 2 * WORLD_MAP_TILE_DIM;
  const minZ = origin.z + tileOrigin.y * 2 * WORLD_MAP_TILE_DIM;
  return {
    minX,
    maxX: minX + dfLocation.exterior.exteriorData.width * WORLD_MAP_RMB_DIM,
    minZ,
    maxZ: minZ + dfLocation.exterior.exteriorData.height * WORLD_MAP_RMB_DIM,
  };
}

/** PlayerGPS.PlayerLocationRectCheck (:668-716). AUDIT 24 (the
 *  seven-slice sweep): IsPlayerInLocationRect is NOT "this map pixel
 *  carries a location" - C#'s own comment says so in as many words
 *  ("Player can be inside a map pixel with location but not inside
 *  location rect"). It is a world-coordinate test against the town's
 *  actual footprint, widened by one full city block on every side "to
 *  better match classic". A map pixel is 32768 units across; a
 *  1x1 town plus its slack is 12288. The port had been answering the
 *  pixel, which is up to seven times the area, and every consumer of
 *  the seam - the quest machine's `when pc enters/exits`, CreateFoe's
 *  `send` gate, the music director's location context - read that
 *  widened answer. */
export function isInLocationRect(worldX, worldZ, rect) {
  if (!rect) return false;
  const extraRect = WORLD_MAP_RMB_DIM;   // size of a full city block
  return worldX >= rect.minX - extraRect && worldX <= rect.maxX + extraRect
    && worldZ >= rect.minZ - extraRect && worldZ <= rect.maxZ + extraRect;
}

export class StreamingWorldState {
  constructor(terrainDistance = TERRAIN_DISTANCE) {
    this.terrainDistance = terrainDistance;
    this.mapOrigin = { x: 0, y: 0 };
    this.compensation = [0, 0, 0];
    this.current = { x: 0, y: 0 };
    this.loaded = new Map(); // key -> {px, py}, built or building
  }

  static key(px, py) {
    // String key: safe for negative/out-of-map pixel coordinates.
    return `${px},${py}`;
  }

  /** Start streaming with the player's scene position on this pixel.
   * Verbatim ResetStreamingWorld: x/z compensation zeroes, the vertical
   * component SURVIVES re-inits. */
  init(mapPixelX, mapPixelY) {
    this.mapOrigin = { x: mapPixelX, y: mapPixelY };
    this.compensation = [0, this.compensation[1], 0];
    this.current = { x: mapPixelX, y: mapPixelY };
    this.loaded.clear();
    return this._loadList();
  }

  /** Native world coordinates -> scene position under the CURRENT
   *  origin/compensation (worldCoords' inverse; the P-slice save
   *  stores natives so a quicksave survives any floating origin). */
  localFromWorld(nativeX, nativeZ) {
    const corner = mapPixelToWorldCoords(this.mapOrigin.x, this.mapOrigin.y);
    return [
      (nativeX - corner.x) / SCENE_MAP_RATIO + this.compensation[0],
      (nativeZ - corner.z) / SCENE_MAP_RATIO + this.compensation[2],
    ];
  }

  /** Scene position -> native Daggerfall world coordinates. */
  worldCoords(scenePos) {
    const corner = mapPixelToWorldCoords(this.mapOrigin.x, this.mapOrigin.y);
    return {
      x: corner.x + (scenePos[0] - this.compensation[0]) * SCENE_MAP_RATIO,
      z: corner.z + (scenePos[2] - this.compensation[2]) * SCENE_MAP_RATIO,
    };
  }

  /** Translation for a pixel's local frame under current compensation.
   *  EV2: `out` reuses a caller's array - the streaming draw loop and
   *  the collision floor ask this per pixel per frame, and the fresh
   *  three-array per call was measurable GC. Semantics unchanged. */
  pixelTranslation(px, py, out = [0, 0, 0]) {
    out[0] = (px - this.mapOrigin.x) * TERRAIN_SIZE + this.compensation[0];
    out[1] = this.compensation[1];
    out[2] = -(py - this.mapOrigin.y) * TERRAIN_SIZE + this.compensation[2];
    return out;
  }

  /** PlaceTerrain's first statement (StreamingWorld.cs:855-860): a
   *  pixel outside the world map is never placed. The port has no crash
   *  to show for it - WoodsFile clamps and PakFile answers -1, which
   *  getWorldClimateSettings turns into Temperate/Woodlands - so an
   *  off-map pixel would stream a whole invented terrain, its climate,
   *  its ground archive and its nature scatter where DFU leaves the
   *  edge of the world empty. */
  static onMap(px, py) {
    return px >= MIN_MAP_PIXEL_X && px < MAX_MAP_PIXEL_X
      && py >= MIN_MAP_PIXEL_Y && py < MAX_MAP_PIXEL_Y;
  }

  inRange(px, py) {
    return StreamingWorldState.onMap(px, py) &&
      Math.abs(px - this.current.x) <= this.terrainDistance &&
      Math.abs(py - this.current.y) <= this.terrainDistance;
  }

  _loadList() {
    // Desired grid, nearest-first (player pixel leads, rings follow).
    const list = [];
    const d = this.terrainDistance;
    for (let py = this.current.y - d; py <= this.current.y + d; py++) {
      for (let px = this.current.x - d; px <= this.current.x + d; px++) {
        if (!StreamingWorldState.onMap(px, py)) continue;
        if (this.loaded.has(StreamingWorldState.key(px, py))) continue;
        list.push({ px, py });
      }
    }
    list.sort((a, b) => {
      const ca = Math.max(Math.abs(a.px - this.current.x), Math.abs(a.py - this.current.y));
      const cb = Math.max(Math.abs(b.px - this.current.x), Math.abs(b.py - this.current.y));
      if (ca !== cb) return ca - cb;
      const ea = (a.px - this.current.x) ** 2 + (a.py - this.current.y) ** 2;
      const eb = (b.px - this.current.x) ** 2 + (b.py - this.current.y) ** 2;
      return ea - eb;
    });
    for (const p of list) this.loaded.set(StreamingWorldState.key(p.px, p.py), p);
    return list;
  }

  /** Drop a pixel from the loaded set (after the scene destroys it). */
  release(px, py) {
    this.loaded.delete(StreamingWorldState.key(px, py));
  }

  /**
   * Per-frame step. Mutates compensation on recenters.
   * @param {number[]} camPos - scene position; caller applies the
   *   returned offset to it (FloatingOrigin shifts the player too).
   * @returns {{offset:number[]|null, load:Array, unload:Array,
   *   pixelChanged:boolean, current:{x,y}}}
   */
  update(camPos) {
    const offset = [0, 0, 0];
    let moved = false;

    // Vertical recenter, verbatim threshold.
    if (camPos[1] < -VERTICAL_THRESHOLD || camPos[1] > VERTICAL_THRESHOLD) {
      offset[1] = -camPos[1];
      moved = true;
    }

    const w = this.worldCoords(camPos);
    const pixel = worldCoordToMapPixel(w.x, w.z);
    const pixelChanged = pixel.x !== this.current.x || pixel.y !== this.current.y;
    let load = [];
    const unload = [];
    if (pixelChanged) {
      // Verbatim FloatingOrigin: (-xChange, y, +zChange).
      offset[0] = -(pixel.x - this.current.x) * TERRAIN_SIZE;
      offset[2] = (pixel.y - this.current.y) * TERRAIN_SIZE;
      moved = true;
      this.current = pixel;
    }
    if (moved) {
      this.compensation[0] += offset[0];
      this.compensation[1] += offset[1];
      this.compensation[2] += offset[2];
    }
    if (pixelChanged) {
      load = this._loadList();
      for (const p of this.loaded.values()) {
        if (!this.inRange(p.px, p.py)) unload.push({ px: p.px, py: p.py });
      }
    }
    return { offset: moved ? offset : null, load, unload, pixelChanged, current: this.current };
  }
}
