// ═══════════════════════════════════════════════════════════════════
// WOD2 - WORLD OF DAGGERFALL: THE LOADER.
//
// The port of LocationLoader.cs (vendor/world-of-daggerfall/Scripts/),
// the MonoBehaviour that hangs off DaggerfallTerrain.OnPromoteTerrainData
// and decides, every time a terrain tile is promoted, which of the mod's
// ~228,000 location instances stands on it, flattens the ground under
// it and places the prefab's objects. Four pieces, each pure:
//
//   LocationSession  - the instance LIST and how it grows: region 17's
//                      folder at Awake (:47-59), then the folder of every
//                      region the player enters (OnRegionChanged,
//                      :67-89; region 31 refused). Held as columns, in
//                      load order, because the order is the law below.
//   pickLocations    - AddLocation's loop (:101-172), verbatim in its
//                      order of tests: the FIRST valid instance naming a
//                      map pixel takes it, because placing it sets
//                      MapData.hasLocation and every later type-2
//                      instance `continue`s on that flag (:103-115).
//   flattenForLocation - the "Smooth the terrain" arm (:174-230): the
//                      mean of the prefab's rect (bounds INCLUSIVE, so a
//                      w x h prefab averages (w+1) x (h+1) samples),
//                      then every interior sample (1..127 on both axes -
//                      the tile's border rows are never touched, so a
//                      seam against the neighbour stays closed) is lerped
//                      toward it by 1 / (distance-from-rect + 1).
//   placeObjects     - the object loop (:232-252): each valid object at
//                      (terrainX * 6.4 + pos.x, avg * 1923.75 + pos.y,
//                      terrainY * 6.4 + pos.z), tile-local.
//
// Two readings are taken on purpose and recorded in
// bible/03-World/World-Of-Daggerfall.md:
//   - The C# math is float (Mathf / float fields); the flatten below
//     runs every step through Math.fround so the samples it writes are
//     the samples DFU's SetHeights received.
//   - `pathsDataPoint` is a STATIC byte the Basic Roads message fills
//     (:23, :146-151). The port's roads are always present, so the
//     callback always answers and the static never carries a stale
//     value between calls; `pathsPoint` absent is the no-mod case (0).
// A LEAF apart from the terrain constants, so the terrain worker can
// import it.
// ═══════════════════════════════════════════════════════════════════

import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from './terrainSampler.js';

/** LocationLoader.cs:14 - the tile's heightmap span in samples. */
export const WOD_TERRAIN_SIZE = 128;
/** :19 - TERRAINPIXELSIZE, one map pixel in Unity units. */
export const WOD_TERRAIN_PIXEL_SIZE = Math.fround(819.2);
/** :21 - TERRAIN_SIZE_MULTI = TERRAINPIXELSIZE / TERRAIN_SIZE, a C# float. */
export const WOD_TERRAIN_SIZE_MULTI = Math.fround(WOD_TERRAIN_PIXEL_SIZE / WOD_TERRAIN_SIZE);
/** :15-17 - MaxTerrainHeight * StreamingWorld.TerrainScale, read at run time: 1539 * 1.25 = 1923.75 in the game
 *  scene (terrainSampler.js STREAMING_TERRAIN_SCALE, TERRAIN-SCALE1) - the value the author's own commented-out
 *  constant (:18) names. */
export const WOD_TERRAIN_HEIGHT_MAX = Math.fround(MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE);
/** :53 - the folder Awake loads before any region event: the title
 *  screen stands in the Daggerfall region, and PlayerGPS.Start seeds its
 *  lastRegionIndex with it, so no event would ever name 17 first. */
export const WOD_AWAKE_REGION = 17;
/** :76 - "Ocean Region Detected! Unsupported!" */
export const WOD_REFUSED_REGION = 31;
/** :117-121 - the regions whose low tiles (worldHeight <= 2) are sea. */
export const WOD_OCEAN_REGIONS = Object.freeze([31, 3, 29, 28, 30]);

const f32 = Math.fround;

// ── the session list ─────────────────────────────────────────────────

/**
 * The instance list, as LocationLoader holds it: `locationInstance`
 * (:12), appended to region by region and never cleared - a list for
 * the life of the game, not of a save. Stored as parallel columns so
 * AddLocation's full-list scan stays a tight typed-array loop.
 *
 * A region already appended is not appended again. The C# would
 * AddRange a revisited region's folder a second time, but a duplicate
 * can never win a pixel its first copy did not (the first copy is
 * earlier in the list, and the pixel's hasLocation latch stops the
 * scan's placements there), so the second copy changes nothing but the
 * scan's length.
 */
export class LocationSession {
  constructor() {
    this.count = 0;
    this._cap = 0;
    this.worldX = new Int32Array(0);
    this.worldY = new Int32Array(0);
    this.terrainX = new Int32Array(0);
    this.terrainY = new Int32Array(0);
    this.type = new Int32Array(0);
    this.locationID = new Int32Array(0);
    this.name = [];     // string per instance
    this.prefab = [];   // string per instance
    this.regions = [];  // folder order, as loaded
  }

  hasRegion(region) { return this.regions.includes(region); }

  _grow(extra) {
    const need = this.count + extra;
    if (need <= this._cap) return;
    const cap = Math.max(need, this._cap * 2, 1024);
    for (const k of ['worldX', 'worldY', 'terrainX', 'terrainY', 'type', 'locationID']) {
      const a = new Int32Array(cap);
      a.set(this[k].subarray(0, this.count));
      this[k] = a;
    }
    this._cap = cap;
  }

  /**
   * Append one region folder's instances (already in the folder's load
   * order - files by NTFS name order, instances in file order).
   * @param {number} region
   * @param {{count:number, worldX:ArrayLike<number>, worldY:ArrayLike<number>,
   *   terrainX:ArrayLike<number>, terrainY:ArrayLike<number>, type:ArrayLike<number>,
   *   locationID:ArrayLike<number>, name:string[], prefab:string[]}} cols
   * @returns {boolean} false when the region was already in the list
   */
  appendRegion(region, cols) {
    if (this.hasRegion(region)) return false;
    this._grow(cols.count);
    const o = this.count;
    for (let i = 0; i < cols.count; i++) {
      this.worldX[o + i] = cols.worldX[i];
      this.worldY[o + i] = cols.worldY[i];
      this.terrainX[o + i] = cols.terrainX[i];
      this.terrainY[o + i] = cols.terrainY[i];
      this.type[o + i] = cols.type[i];
      this.locationID[o + i] = cols.locationID[i];
      this.name.push(cols.name[i]);
      this.prefab.push(cols.prefab[i]);
    }
    this.count += cols.count;
    this.regions.push(region);
    return true;
  }

  /** The i-th instance as LocationData.cs's LocationInstance shape. */
  instance(i) {
    return {
      locationID: this.locationID[i], name: this.name[i], type: this.type[i], prefab: this.prefab[i],
      worldX: this.worldX[i], worldY: this.worldY[i], terrainX: this.terrainX[i], terrainY: this.terrainY[i],
    };
  }
}

// ── AddLocation's loop ───────────────────────────────────────────────

/**
 * AddLocation (LocationLoader.cs:91-256), the DECISION half: which
 * instances are placed on this tile, in order, and whether each
 * flattens. Everything before the flatten reads only the tile's map
 * data, so this runs before the terrain kernel and hands it the rects.
 *
 * @param {{mapPixelX:number, mapPixelY:number, hasLocation:boolean,
 *   mapRegionIndex:number, worldHeight:number}} tile - MapPixelData's
 *   fields the loop reads (worldHeight is the raw WOODS byte).
 * @param {LocationSession} session
 * @param {(name:string) => ?{height:number,width:number}} getPrefab -
 *   LoadLocationPrefab by name; null for a missing file (:156-160).
 * @param {?(x:number, y:number) => number} pathsPoint - Basic Roads'
 *   getPathsPoint (road | track mask at the map pixel); null when the
 *   mod is absent, and the static then keeps its 0.
 * @param {?(prefabName:string, prefab:object, rect:object) => boolean} siteClear -
 *   ROADS-CLEAR (a port departure, world/roadClearance.js): false refuses
 *   the instance as the road test above does - `continue`, so a later
 *   instance naming the pixel may still take it. Null is the mod exactly.
 * @returns {Array<{index:number, prefab:object, flatten:boolean,
 *   rect:{x:number,y:number,width:number,height:number}}>}
 */
export function pickLocations(tile, session, getPrefab, pathsPoint = null, siteClear = null) {
  const out = [];
  let hasLocation = !!tile.hasLocation;
  const ocean = WOD_OCEAN_REGIONS.includes(tile.mapRegionIndex) && tile.worldHeight <= 2;
  const { worldX, worldY, terrainX, terrainY, type } = session;
  const px = tile.mapPixelX, py = tile.mapPixelY;
  let pathsDataPoint = 0;
  for (let i = 0; i < session.count; i++) {
    const t = type[i];
    // :103-115 - a tile that already holds a location: a type-0
    // instance ANYWHERE in the list ends the whole call; type 2 skips.
    if (hasLocation) {
      if (t === 0) return out;
      else if (t === 2) continue;
    }
    // :117-134 - the sea: the same two arms.
    if (ocean) {
      if (t === 0) return out;
      else if (t === 2) continue;
    }
    // :136-137
    if (px !== worldX[i] || py !== worldY[i]) continue;
    // :139-143
    const tx = terrainX[i], ty = terrainY[i];
    if (tx <= 0 || ty <= 0 || (tx > 128 || ty > 128)) continue;
    // :146-151 - Basic Roads' road|track mask at the instance's pixel.
    if (pathsPoint) pathsDataPoint = pathsPoint(worldX[i], worldY[i]) & 0xff;
    if (pathsDataPoint !== 0) continue;
    // :154-160
    const prefab = getPrefab(session.prefab[i]);
    if (prefab == null) continue;
    // :162-172 - NB the C# pairs terrainX with the prefab's HEIGHT and
    // terrainY with its WIDTH here, the transpose of the rect below.
    if ((tx + prefab.height > 128 || ty + prefab.width > 128)) continue;
    if ((tx + prefab.height > 127 || ty + prefab.width > 127)) continue;
    const rect = { x: tx, y: ty, width: prefab.width, height: prefab.height };
    // ROADS-CLEAR (2026-09-25, Mac: "Camps, mountains from WOD, shouldnt be placed on roads"): the mod asks only
    // this pixel's byte (:146-151), and a site's pieces reach into the next pixel's road - the port asks the site
    if (siteClear && !siteClear(session.prefab[i], prefab, rect)) continue;
    // :175-230 - types 0 and 2 run the identical smoothing arm and set
    // hasLocation; any other type places its objects unsmoothed.
    const flatten = t === 0 || t === 2;
    if (flatten) hasLocation = true;
    out.push({ index: i, prefab, flatten, rect });
  }
  return out;
}

// ── the smoothing arm ────────────────────────────────────────────────

/** GetDistanceFromRect (LocationLoader.cs:258-273), in C# floats. */
export function distanceFromRect(rect, x, y) {
  const xMin = rect.x, xMax = f32(rect.x + rect.width);
  const yMin = rect.y, yMax = f32(rect.y + rect.height);
  let sq = 0;
  if (x > xMax) sq = f32(sq + f32(f32(x - xMax) * f32(x - xMax)));
  else if (x < xMin) sq = f32(sq + f32(f32(xMin - x) * f32(xMin - x)));
  if (y > yMax) sq = f32(sq + f32(f32(y - yMax) * f32(y - yMax)));
  else if (y < yMin) sq = f32(sq + f32(f32(yMin - y) * f32(yMin - y)));
  return f32(Math.sqrt(sq));   // Mathf.Sqrt = (float)Math.Sqrt
}

/**
 * The "Smooth the terrain" arm (LocationLoader.cs:181-200 / :210-229),
 * over the port's sample layout (DFU heightmapSamples[y, x] is
 * samples[x * 129 + y]). Mutates `samples`; returns the average height
 * the arm stores in MapData.averageHeight.
 * @param {Float32Array} samples - 129 x 129, normalized.
 * @param {{x:number,y:number,width:number,height:number}} rect
 * @returns {number}
 */
export function flattenForLocation(samples, rect, hDim = HEIGHTMAP_DIMENSION) {
  let count = 0;
  let tmp = 0;
  for (let x = rect.x; x <= rect.x + rect.width; x++) {
    for (let y = rect.y; y <= rect.y + rect.height; y++) {
      tmp = f32(tmp + samples[x * hDim + y]);
      count++;
    }
  }
  const avg = f32(tmp / count);
  for (let x = 1; x <= 127; x++) {
    for (let y = 1; y <= 127; y++) {
      const i = x * hDim + y;
      const a = samples[i];
      // Mathf.Lerp(a, b, t) = a + (b - a) * Clamp01(t)
      let t = f32(1 / f32(distanceFromRect(rect, x, y) + 1));
      if (t > 1) t = 1; else if (t < 0) t = 0;
      samples[i] = f32(a + f32(f32(avg - a) * t));
    }
  }
  return avg;
}

/**
 * Run a pick list's smoothing arms in order over the kernel's samples
 * and answer, per pick, the MapData.averageHeight its objects stand on
 * (:238): its own mean when it flattened, else whatever the tile held
 * then - `initialAverage` (DFU's own, 0 on a pixel with no location)
 * or an earlier pick's. Also answers the rect MapData.locationRect ends
 * holding, which the nature layout reads (null = unchanged).
 * @param {Float32Array} samples
 * @param {Array<{flatten:boolean, rect:object}>} picks
 * @param {number} initialAverage
 * @returns {{averages:number[], locationRect:?{xMin:number,xMax:number,yMin:number,yMax:number}}}
 */
export function applyPicks(samples, picks, initialAverage = 0) {
  const averages = [];
  let average = initialAverage;
  let locationRect = null;
  for (const p of picks) {
    if (p.flatten) {
      average = flattenForLocation(samples, p.rect);
      locationRect = {
        xMin: p.rect.x, xMax: p.rect.x + p.rect.width,
        yMin: p.rect.y, yMax: p.rect.y + p.rect.height,
      };
    }
    averages.push(average);
  }
  return { averages, locationRect };
}

// ── the object loop ──────────────────────────────────────────────────

/**
 * The object loop (LocationLoader.cs:232-252) for one pick: every
 * object ValidateValue accepts, at its tile-local position. `validate`
 * is LocationHelper.ValidateValue (wodLocationData.js).
 * @param {{rect:object, prefab:{obj:Array<object>}}} pick
 * @param {number} averageHeight - normalized, from applyPicks.
 * @param {(type:number, name:string) => boolean} validate
 * @returns {Array<{obj:object, pos:[number,number,number]}>}
 */
export function placeObjects(pick, averageHeight, validate) {
  const out = [];
  const baseX = f32(pick.rect.x * WOD_TERRAIN_SIZE_MULTI);
  const baseY = f32(averageHeight * WOD_TERRAIN_HEIGHT_MAX);
  const baseZ = f32(pick.rect.y * WOD_TERRAIN_SIZE_MULTI);
  for (const obj of pick.prefab.obj) {
    if (!validate(obj.type, obj.name)) continue;
    out.push({ obj, pos: [f32(baseX + obj.pos.x), f32(baseY + obj.pos.y), f32(baseZ + obj.pos.z)] });
  }
  return out;
}
