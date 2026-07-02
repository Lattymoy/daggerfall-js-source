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

export const TERRAIN_DISTANCE = 3;
const VERTICAL_THRESHOLD = 500;
const SCENE_MAP_RATIO = 1 / GLOBAL_SCALE;
const NATIVE_PIXEL = 32768; // MapsFile world units per map pixel

/** Verbatim MapsFile.WorldCoordToMapPixel (truncating division). */
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

  /** Start streaming with the player's scene position on this pixel. */
  init(mapPixelX, mapPixelY) {
    this.mapOrigin = { x: mapPixelX, y: mapPixelY };
    this.compensation = [0, 0, 0];
    this.current = { x: mapPixelX, y: mapPixelY };
    this.loaded.clear();
    return this._loadList();
  }

  /** Scene position -> native Daggerfall world coordinates. */
  worldCoords(scenePos) {
    const corner = mapPixelToWorldCoords(this.mapOrigin.x, this.mapOrigin.y);
    return {
      x: corner.x + (scenePos[0] - this.compensation[0]) * SCENE_MAP_RATIO,
      z: corner.z + (scenePos[2] - this.compensation[2]) * SCENE_MAP_RATIO,
    };
  }

  /** Translation for a pixel's local frame under current compensation. */
  pixelTranslation(px, py) {
    return [
      (px - this.mapOrigin.x) * TERRAIN_SIZE + this.compensation[0],
      this.compensation[1],
      -(py - this.mapOrigin.y) * TERRAIN_SIZE + this.compensation[2],
    ];
  }

  inRange(px, py) {
    return Math.abs(px - this.current.x) <= this.terrainDistance &&
      Math.abs(py - this.current.y) <= this.terrainDistance;
  }

  _loadList() {
    // Desired grid, nearest-first (player pixel leads, rings follow).
    const list = [];
    const d = this.terrainDistance;
    for (let py = this.current.y - d; py <= this.current.y + d; py++) {
      for (let px = this.current.x - d; px <= this.current.x + d; px++) {
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
