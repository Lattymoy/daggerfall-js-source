// Nature flat scatter for one wilderness map pixel.
// 1:1 translation of Daggerfall Unity's DefaultTerrainNature.LayoutNature
// (MIT, Daggerfall Workshop). Verbatim rules:
//   - Location rects (when present: rect.x > 0 && rect.y > 0) expand by
//     natureClearance 4 and exclude scatter inside (Rect.Contains:
//     min-inclusive, max-exclusive).
//   - elevationScale = clamp(rawWoodsByte / 128, 0.4, 1.0); Desert
//     climates scale all chances by 0.25.
//   - Per tile: skip if steepness > 50 degrees; roll against
//     chanceOnDirt 0.2 / chanceOnGrass 0.9 / chanceOnStone 0.05 (scaled);
//     any other tile record never scatters. Skip below the beach line
//     (tile-corner height * maxTerrainHeight, unscaled).
//   - Placed flats sit at (x * 6.4, sampledHeight - steepness / 70,
//     y * 6.4) - sunk slightly into slopes - with record in [1, 32).
//     Batch billboards anchor at centre-bottom (base), matching our
//     renderer batches.
// DEPARTURE (same Port-Ledger A row as the Perlin substitution):
// DFU seeds UnityEngine.Random with TerrainHelper.MakeTerrainKey - an
// engine-internal PRNG not in DFU source. We seed our byte-exact
// Unity.Mathematics Random port (umRandom.js) with the same verbatim
// key; the scatter is deterministic per pixel with the same statistics,
// but concrete positions differ from DFU. Pins pin OUR scatter.
// Presentation substitutions (our terrain is not a Unity Terrain
// object): steepness comes from central-difference gradients of the
// scaled heightfield at the tile corner; SampleHeight reduces to the
// exact corner sample because DFU's sample point x * heightmapScale *
// (hDim - 1) / tDim lands on integer sample coordinates.

import { UMRandom } from '../formats/umRandom.js';
import { perlinNoise } from './perlin.js';   // FOREST1: the forests' field rides the terrain's own noise
import {
  HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE,
  TERRAIN_SIZE, SCALED_BEACH_ELEVATION,
} from './terrainSampler.js';
import { WORLD_MAP_TILE_DIM, sampleHeight } from './terrainTiles.js';   // AUDIT LW-DRY: the sample's height, one home (WATER1's float)

const MAX_STEEPNESS = 50;
const SLOPE_SINK_RATIO = 70;
const BASE_CHANCE_ON_DIRT = 0.2;
const BASE_CHANCE_ON_GRASS = 0.9;
const BASE_CHANCE_ON_STONE = 0.05;
const NATURE_CLEARANCE = 4;
const CLIMATE_TYPE_DESERT = 0; // DFLocation.ClimateBaseType.Desert

/** World of Daggerfall's Tree records, by the climate's summer nature archive (LocationHelper.cs billboards). FOREST1:
 *  moved here from scenes/treeHost.js (which re-exports it) - the forests' layout reads it on the terrain worker, and
 *  the worker does not import a scene. */
export const TREE_RECORDS = Object.freeze({
  500: Object.freeze([12, 13, 14, 15, 16, 18, 30]),
  501: Object.freeze([11, 12, 13, 16, 30]),
  502: Object.freeze([12, 13, 15, 16, 17, 18, 30]),
  503: Object.freeze([5, 11, 12, 13, 28, 30]),
  504: Object.freeze([12, 13, 14, 15, 16, 17, 18, 25, 30]),
  506: Object.freeze([5, 11, 12, 13, 14, 15, 16, 24, 25, 30]),
  508: Object.freeze([13, 15, 16, 18, 24, 25, 30]),
  510: Object.freeze([5, 11, 12, 13, 15, 16, 24, 25, 30]),
});
export const isTreeRecord = (baseArchive, record) => !!TREE_RECORDS[baseArchive]?.includes(record);

/**
 * PROF1 (bible/06-Systems/Professions-Arc.md 22): WHERE DFU'S OWN NATURE WOULD STAND, asked of ONE tile - the rules
 * layoutNature below applies, without its dice: not steeper than MAX_STEEPNESS, not on water under the beach line, on a
 * tile nature grows on (dirt, grass or stone), and never inside the location's rect widened by the nature clearance
 * (always tested here - an herb patch never stands in a town, where layoutNature's NT2 quirk may let a tree). Answers
 * the pixel-local base position the loop would give a flat on that tile, or null.
 * @param {Float32Array} heightmapData @param {Uint8Array} tilemapData
 * @param {{xMin:number,xMax:number,yMin:number,yMax:number}|null} locationRect
 * @param {number} x tile x (0-127) @param {number} y tile y (0-127)
 */
export function natureStandsAt(heightmapData, tilemapData, locationRect, x, y) {
  const hDim = HEIGHTMAP_DIMENSION;
  const tDim = WORLD_MAP_TILE_DIM;
  if (!heightmapData || !tilemapData || !(x >= 0 && x < tDim && y >= 0 && y < tDim)) return null;
  const heightScale = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;   // layoutNature's terrainScale, as it reads it
  const cell = TERRAIN_SIZE / (hDim - 1);
  const at = (a, b) => heightmapData[a * hDim + b] * heightScale;
  if (locationRect && x >= locationRect.xMin - NATURE_CLEARANCE && x < locationRect.xMax + NATURE_CLEARANCE
    && y >= locationRect.yMin - NATURE_CLEARANCE && y < locationRect.yMax + NATURE_CLEARANCE) return null;
  const tile = tilemapData[y * tDim + x] & 0x3f;
  if (tile !== 1 && tile !== 2 && tile !== 3) return null;
  const hl = at(Math.max(0, x - 1), y), hr = at(Math.min(hDim - 1, x + 1), y);
  const hd = at(x, Math.max(0, y - 1)), hu = at(x, Math.min(hDim - 1, y + 1));
  const steepness = Math.atan(Math.hypot((hr - hl) / (2 * cell), (hu - hd) / (2 * cell))) * (180 / Math.PI);
  if (steepness > MAX_STEEPNESS) return null;
  const hx = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (x / tDim))));
  const hy = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (y / tDim))));
  if (sampleHeight(heightmapData[hy + hx * hDim]) < SCALED_BEACH_ELEVATION) return null;
  const scale = TERRAIN_SIZE / tDim;
  return { x: x * scale, y: at(x, y) - steepness / SLOPE_SINK_RATIO, z: y * scale };
}

/** AUDIT 29 C11: whether (x, z) stands inside a rock piece's footprint (`rocks` a pixel's World of Daggerfall rock boxes,
 *  [x0, y0, z0, x1, y1, z1] in natureStandsAt's frame; the field's boxes overlap - a foot off one piece can land inside the
 *  next). NODE-CLEAR (AUDIT 2026-10-01 part four): ONE HOME - VEIN-CLEAR kept the veins out of the rocks, and a patch or a
 *  tree stood inside one, glowing and on the compass, where no look could reach it. */
export const insideRocks = (rocks, x, z) => (rocks ?? []).some((b) => x > b[0] && x < b[3] && z > b[2] && z < b[5]);

/**
 * ROCK-FOOT (FIELD BUGS 2026-10-01, "trying to mine boulders on the outside, but it's not letting people mine"): A ROCK
 * PIECE AS IT STANDS OUT OF THE GROUND - the XZ bounds of its mesh above the terrain (each vertex above the ground under
 * it, and each edge where it crosses the ground), `[x0, y0, z0, x1, y1, z1]` pixel-local, or null for a piece wholly
 * under the ground. World of Daggerfall's rock fields are hills of a few models scaled by hundreds, turned and sunk:
 * the whole mesh's box ran 90 m to over a kilometre where the rock showed a few metres, so a boulder's foot stood on its
 * edge far from any rock, or inside a neighbour's box and stood nowhere - under one boulder in ten stood on the shipped
 * layouts (a stand-in mesh: test/fb1001_rockfoot.test.js).
 * @param {ArrayLike<number>} positions model-local xyz @param {ArrayLike<number>} indices triangles
 * @param {ArrayLike<number>} m the piece's column-major 4x4 @param {Float32Array} heightmapData the pixel's samples
 */
export function rockFootprint(positions, indices, m, heightmapData) {
  const n = Math.floor(positions.length / 3);
  const w = new Float64Array(n * 3), above = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12], wy = m[1] * x + m[5] * y + m[9] * z + m[13], wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    w[i * 3] = wx; w[i * 3 + 1] = wy; w[i * 3 + 2] = wz;
    above[i] = wy - groundAt(heightmapData, wx, wz);
  }
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const add = (x, y, z) => {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; if (y < y0) y0 = y; if (y > y1) y1 = y;
  };
  for (let i = 0; i < n; i++) if (above[i] >= 0) add(w[i * 3], w[i * 3 + 1], w[i * 3 + 2]);
  for (let t = 0; t + 2 < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e], b = indices[t + ((e + 1) % 3)];
      if ((above[a] >= 0) === (above[b] >= 0)) continue;
      const f = above[a] / (above[a] - above[b]);
      add(w[a * 3] + (w[b * 3] - w[a * 3]) * f, w[a * 3 + 1] + (w[b * 3 + 1] - w[a * 3 + 1]) * f, w[a * 3 + 2] + (w[b * 3 + 2] - w[a * 3 + 2]) * f);
    }
  }
  return x0 <= x1 ? [x0, y0, z0, x1, y1, z1] : null;
}

/**
 * PROF2: THE GROUND'S HEIGHT at a pixel-local point (metres, x east and z the tile rows' way - natureStandsAt's frame),
 * bilinear between the heightmap's four samples round it (a sample stands at each tile corner). A vein stands at a rock
 * piece's foot, which is on no tile's corner.
 * @param {Float32Array} heightmapData @param {number} mx @param {number} mz
 */
export function groundAt(heightmapData, mx, mz) {
  const hDim = HEIGHTMAP_DIMENSION;
  const cell = TERRAIN_SIZE / WORLD_MAP_TILE_DIM;
  const fx = Math.max(0, Math.min(hDim - 1, mx / cell)), fz = Math.max(0, Math.min(hDim - 1, mz / cell));
  const x0 = Math.min(hDim - 2, Math.floor(fx)), z0 = Math.min(hDim - 2, Math.floor(fz));
  const tx = fx - x0, tz = fz - z0;
  const h = (a, b) => heightmapData[a * hDim + b];
  const top = h(x0, z0) * (1 - tz) + h(x0, z0 + 1) * tz;
  const bot = h(x0 + 1, z0) * (1 - tz) + h(x0 + 1, z0 + 1) * tz;
  return (top * (1 - tx) + bot * tx) * MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
}

/** Verbatim TerrainHelper.MakeTerrainKey: ((short)y << 16) + (short)x. */
export function makeTerrainKey(mapPixelX, mapPixelY) {
  return (((mapPixelY << 16) >> 16) << 16) + ((mapPixelX << 16) >> 16);
}

/**
 * Scatter nature flats for one map pixel.
 * @param {Float32Array} heightmapData - generateSamples output (post-blend
 *   when a location is present); sample(x, y) = data[x * hDim + y].
 * @param {Uint8Array} tilemapData - 128x128 tile bytes (y * dim + x).
 * @param {object} opts
 * @param {number} opts.mapPixelX
 * @param {number} opts.mapPixelY
 * @param {number} opts.rawWorldHeight - WOODS byte for the pixel.
 * @param {number} opts.climateType - ClimateBaseType (0 Desert).
 * @param {{xMin,xMax,yMin,yMax}|null} opts.locationRect - tile space.
 * @param {?{archive:number, pois?:Array<{xMin:number,xMax:number,yMin:number,yMax:number,hide:boolean}>}} [opts.forests]
 *   FOREST1: the Real forests switch - the climate's summer nature archive and the pixel's places. Absent (or on a
 *   desert, or an archive with no Tree table), DFU's scatter below, byte for byte.
 * @returns {Array<{record:number,x:number,y:number,z:number}>} base
 *   positions in pixel-local world units.
 */
export function layoutNature(heightmapData, tilemapData, opts) {
  if (opts.forests && opts.climateType !== CLIMATE_TYPE_DESERT && TREE_RECORDS[opts.forests.archive]) {
    return layoutForests(heightmapData, tilemapData, opts);
  }
  const hDim = HEIGHTMAP_DIMENSION;
  const tDim = WORLD_MAP_TILE_DIM;
  const worldHeight = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;   // TerrainNature.LayoutNature's terrainScale - the game scene's (TERRAIN-SCALE1)
  const cell = TERRAIN_SIZE / (hDim - 1);
  const at = (x, y) => heightmapData[x * hDim + y] * worldHeight;

  // Expand the location rect by the nature clearance when present.
  let rect = null;
  if (opts.locationRect && opts.locationRect.xMin > 0 && opts.locationRect.yMin > 0) {
    rect = {
      xMin: opts.locationRect.xMin - NATURE_CLEARANCE,
      xMax: opts.locationRect.xMax + NATURE_CLEARANCE,
      yMin: opts.locationRect.yMin - NATURE_CLEARANCE,
      yMax: opts.locationRect.yMax + NATURE_CLEARANCE,
    };
  }

  let elevationScale = opts.rawWorldHeight / 128;
  elevationScale = Math.min(1.0, Math.max(0.4, elevationScale));
  const climateScale = opts.climateType === CLIMATE_TYPE_DESERT ? 0.25 : 1.0;
  const chanceOnDirt = BASE_CHANCE_ON_DIRT * elevationScale * climateScale;
  const chanceOnGrass = BASE_CHANCE_ON_GRASS * elevationScale * climateScale;
  const chanceOnStone = BASE_CHANCE_ON_STONE * elevationScale * climateScale;

  // DFU: Random.InitState(MakeTerrainKey(x, y)) - our seeded substitute.
  const seed = makeTerrainKey(opts.mapPixelX, opts.mapPixelY) >>> 0;
  const rng = new UMRandom(seed === 0 ? 0x6e624eb7 : seed);

  const scale = TERRAIN_SIZE / tDim; // heightmapScale.x * (hDim - 1) / tDim
  const beachLine = SCALED_BEACH_ELEVATION;

  // Steepness in degrees from central-difference gradients at a corner.
  const steepnessAt = (x, y) => {
    const hl = at(Math.max(0, x - 1), y);
    const hr = at(Math.min(hDim - 1, x + 1), y);
    const hd = at(x, Math.max(0, y - 1));
    const hu = at(x, Math.min(hDim - 1, y + 1));
    const dx = (hr - hl) / (2 * cell);
    const dz = (hu - hd) / (2 * cell);
    return Math.atan(Math.hypot(dx, dz)) * (180 / Math.PI);
  };

  const flats = [];
  for (let y = 0; y < tDim; y++) {
    for (let x = 0; x < tDim; x++) {
      const steepness = steepnessAt(x, y);
      if (steepness > MAX_STEEPNESS) continue;
      // Rect.Contains: min-inclusive, max-exclusive. NT2 (F188): the
      // loop's guard re-evaluates `rect.x > 0 && rect.y > 0` on the
      // EXPANDED rect (TerrainNature.cs:124 - Unity's rect.x IS xMin
      // after `xMin -=`), so a location whose pre-clearance min sits in
      // (0, 4] on an axis gets the containment test DISABLED outright
      // and nature scatters across the town footprint - eight-block
      // places, verbatim. The port used to test containment
      // unconditionally and suppressed those billboards.
      if (rect && rect.xMin > 0 && rect.yMin > 0
        && x >= rect.xMin && x < rect.xMax && y >= rect.yMin && y < rect.yMax) continue;

      const tile = tilemapData[y * tDim + x] & 0x3f;
      if (tile === 1) {
        if (rng.nextFloatRange(0, 1) > chanceOnDirt) continue;
      } else if (tile === 2) {
        if (rng.nextFloatRange(0, 1) > chanceOnGrass) continue;
      } else if (tile === 3) {
        if (rng.nextFloatRange(0, 1) > chanceOnStone) continue;
      } else {
        continue;
      }

      const hx = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (x / tDim))));
      const hy = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (y / tDim))));
      // x & y swapped in heightmap, verbatim; unscaled height vs beach.
      // WATER-AUDIT: float32, as the tile job's twin of this line is.
      const height = sampleHeight(heightmapData[hy + hx * hDim]);
      if (height < beachLine) continue;

      const record = rng.nextIntRange(1, 32);
      flats.push({
        record,
        x: x * scale,
        y: at(x, y) - steepness / SLOPE_SINK_RATIO,
        z: y * scale,
      });
    }
  }
  return flats;
}

// ═══════════════════════════════════════════════════════════════════
// FOREST1 (2026-10-01, the Discord's "Real Forests" thread: "Currently
// trees are just even spaced around the whole map in temperate areas. It
// would be more interesting and realistic if the trees crowded closer
// together into forests, which could hide interesting pois inside.
// Outside of forests would be rolling plains.") - REAL FORESTS, the
// port's own departure from DefaultTerrainNature, behind the Features
// row `realForests` (systems/features.js) and nowhere else.
//
// DFU rolls every grass tile against one flat chance and picks one of
// the archive's 31 records at random, so a Tree is ~a third of a field
// spread evenly over the whole map, each at its tile's corner - the grid
// the thread describes. Here:
//   - ONE FIELD FOR THE WHOLE BAY. forestCover is a pure function of the
//     WORLD tile (the map pixel's 128 tiles plus the tile, north up as
//     pixelTranslation stands them), so a forest runs on across a map
//     pixel's edge, and every client - and the terrain worker - stands
//     the same one. Three octaves of the terrain's own Perlin noise
//     (world/perlin.js), each turned by an exact rational rotation (no
//     sin or cos, whose last bit differs between engines) over a slow
//     warp, so the edges wander instead of running along an axis. A
//     pixel samples it on a FOREST.lattice-tile lattice and reads between
//     the samples (forestField) - the lattice is the world's, so two
//     pixels share their edge's samples and the field stays continuous.
//   - FORESTS AND PLAINS. Inside a forest most grass tiles stand a Tree
//     (the archive's World of Daggerfall Tree records) with some
//     undergrowth; outside, the plains keep a light scatter of bushes,
//     flowers and rocks and the odd lone tree. Dirt takes less, stone
//     least. Deserts (DFU's Desert base type - the Desert and the
//     Subtropical climates) keep DFU's scatter whole.
//   - NO GRID. Each flat stands somewhere inside its own tile, never on
//     its corner, on the ground there (groundAt) - inside its tile, so
//     never on the road tile beside it; and never on a tile the road
//     painter laid a track over (its `paths` mask - a track over dirt
//     leaves the record dirt).
//   - EVERY TILE ITS OWN DICE (AUDIT FOREST1 F6). A tile's draws are a
//     hash of its WORLD tile, not a stream walked across the pixel - so a
//     place one peer stands and another does not (a spawned dungeon's
//     clock is the character's) moves the flats about that place alone,
//     never every tile after it, and Logging's trees stay where the room
//     sees them.
//   - PLACES IN THE WOODS. Around a dungeon, a keep, a shrine, a ruin, a
//     graveyard, a coven or a World of Daggerfall site (a camp, a fort,
//     a ruin - never its rock fields and mountains, AUDIT FOREST1 F1,
//     which are scenery and stand where the field puts them) the woods
//     close in, round a clearing that is the place's whole footprint (a
//     site's objects, not only its rect - AUDIT FOREST1 F7) widened by
//     DFU's clearance; around a town, a farm or a tavern they draw back
//     into fields. The pull fades out toward the pixel's edges, so it
//     never cuts a forest off at one. The location's rect is tested
//     whole here, as natureStandsAt does - NT2's quirk (trees across an
//     eight-block town) is DFU's scatter's.
//   - THE COST. A wholly wooded grass pixel stands ~0.5 Trees a tile -
//     about 8,000, against DFU's 1,700-4,200 on the same ground (its
//     0.9 x the WOODS byte's elevation scale x ~9 Tree records of 31);
//     with about 45% of the land wooded and the plains nearly bare, the
//     average pixel stands about what DFU's uplands do, and fewer flats
//     in all. DFU's elevation scale is not applied (a lowland wood is a
//     wood). The far rings draw every Tree (world/flatDistance.js), so a
//     wooded horizon costs more than DFU's - the Features row is the dial.
// ═══════════════════════════════════════════════════════════════════

/** FOREST1's numbers, in one place. Tiles are DFU's (6.4 m). */
export const FOREST = Object.freeze({
  /** forestCover's octaves: wavelength (tiles), weight, the rotation's (cos, sin) - 3-4-5, 7-24-25 and 5-12-13
   *  triangles, exact - and an offset into the noise. */
  octaves: Object.freeze([
    Object.freeze({ wave: 192, weight: 0.58, c: 0.8, s: 0.6, off: 17.3 }),
    Object.freeze({ wave: 72, weight: 0.27, c: 0.28, s: 0.96, off: 91.7 }),
    Object.freeze({ wave: 26, weight: 0.15, c: 5 / 13, s: 12 / 13, off: 53.1 }),
  ]),
  /** the warp: how far (tiles) and how slowly (wavelength, tiles) the field's input wanders */
  warp: 48, warpWave: 140,
  /** where the field turns from plain to forest - about 45% of the land is forest */
  edge: Object.freeze([0.495, 0.525]),
  /** a pixel samples the field every this many world tiles and reads between (a power of two dividing 128) */
  lattice: 4,
  /** a grass tile's chances: a Tree and undergrowth inside a forest; a Tree and ground cover on a plain */
  forestTree: 0.5, undergrowth: 0.12, plainTree: 0.02, plainCover: 0.1,
  /** the ground's share of those chances, by DFU's tile record (1 dirt, 2 grass, 3 stone) */
  ground: Object.freeze({ 1: 0.6, 2: 1, 3: 0.15 }),
  /** where in its tile a flat may stand (a fraction of the tile, each way) */
  inset: Object.freeze([0.1, 0.9]),
  /** the woods about a place: full inside `near` tiles of its footprint, none past `far`; a town's fields the same way */
  hide: Object.freeze({ near: 10, far: 30, pull: 1 }),
  clear: Object.freeze({ near: 6, far: 26, pull: 1 }),
  /** the pull fades out over this many tiles before the pixel's edge */
  edgeFade: 12,
  /** how wooded a flat's tile must be for Logging to call it a tree of the woods (scenes/treeHost.js standTrees) */
  woods: 0.5,
});
/** tan(MAX_STEEPNESS) squared - the steepness test on the gradient itself, no arctangent in the decision */
const TAN_MAX_STEEP_SQ = Math.tan(MAX_STEEPNESS * Math.PI / 180) ** 2;

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * THE FOREST FIELD at a world tile: ~0.4..0.6, forest where it is high. `tx` east, `tz` north, in tiles - a map
 * pixel's tile (x, y) is (mapPixelX * 128 + x, -mapPixelY * 128 + y).
 * @param {number} tx @param {number} tz
 */
export function forestCover(tx, tz) {
  const w = FOREST.warpWave, k = 2 * FOREST.warp;
  const wx = tx + (perlinNoise(tx / w + 211.3, tz / w + 7.9) - 0.5) * k;
  const wz = tz + (perlinNoise(tx / w + 37.1, tz / w + 151.7) - 0.5) * k;
  let n = 0;
  for (const o of FOREST.octaves) n += perlinNoise((wx * o.c - wz * o.s) / o.wave + o.off, (wx * o.s + wz * o.c) / o.wave + o.off) * o.weight;
  return n;
}

/** How much forest a world tile is, exactly: 0 a plain, 1 the woods, between them its edge. */
export const forestAt = (tx, tz) => smoothstep(FOREST.edge[0], FOREST.edge[1], forestCover(tx, tz));

/**
 * A PIXEL'S FOREST, as the layout reads it: forestAt on the world's FOREST.lattice lattice over the pixel and its
 * far edge (the next pixel's first samples - the same world tiles, so the same numbers), read bilinearly between.
 * Answers `(x, y) => wood` for the pixel's tiles. Twenty-seven times fewer field samples than a tile each.
 * @param {number} mapPixelX @param {number} mapPixelY
 */
export function forestField(mapPixelX, mapPixelY) {
  const L = FOREST.lattice, n = WORLD_MAP_TILE_DIM / L + 1;
  const ox = mapPixelX * WORLD_MAP_TILE_DIM, oz = -mapPixelY * WORLD_MAP_TILE_DIM;
  const g = new Float64Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g[j * n + i] = forestAt(ox + i * L, oz + j * L);
  return (x, y) => {
    const fx = x / L, fy = y / L;
    const i = Math.min(n - 2, Math.floor(fx)), j = Math.min(n - 2, Math.floor(fy));
    const u = fx - i, v = fy - j;
    const a = g[j * n + i], b = g[j * n + i + 1], c = g[(j + 1) * n + i], d = g[(j + 1) * n + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;   // weights, so a lattice point reads its sample exactly
  };
}

/** A tile's own dice: draw `k` of world tile (tx, tz), uniform in [0, 1) - an integer hash (murmur3's finaliser over
 *  the three words), so it is the same number on every engine and owes nothing to the tiles drawn before it. */
export function tileDraw(tx, tz, k) {
  let h = Math.imul(tx | 0, 0x9e3779b1) ^ Math.imul(tz | 0, 0x85ebca77) ^ Math.imul((k | 0) + 0x632be5ab, 0xc2b2ae3d);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The places' pull on a pixel tile (+ the woods close in, - they draw back), faded toward the pixel's edges. A
 *  place's footprint is `{ xMin, xMax, yMin, yMax }` in tiles, max-exclusive, as DFU's rects. */
export function placesPull(pois, x, y) {
  if (!pois?.length) return 0;
  const tDim = WORLD_MAP_TILE_DIM;
  const fade = smoothstep(0, FOREST.edgeFade, Math.min(x, y, tDim - 1 - x, tDim - 1 - y));
  if (fade <= 0) return 0;
  let pull = 0;
  for (const p of pois) {
    const dx = Math.max(p.xMin - x, 0, x - (p.xMax - 1)), dy = Math.max(p.yMin - y, 0, y - (p.yMax - 1));
    const ring = p.hide ? FOREST.hide : FOREST.clear;
    const k = (1 - smoothstep(ring.near, ring.far, Math.sqrt(dx * dx + dy * dy))) * ring.pull;
    pull += p.hide ? k : -k;
  }
  return pull * fade;
}

const coverRecords = new Map();
/** An archive's records that are not Trees (DFU's 1..31): the plains' and the undergrowth's. */
function coverOf(archive) {
  let out = coverRecords.get(archive);
  if (!out) {
    out = Object.freeze(Array.from({ length: 31 }, (_, i) => i + 1).filter((r) => !isTreeRecord(archive, r)));
    coverRecords.set(archive, out);
  }
  return out;
}

/** FOREST1's layoutNature: the same answer's shape (plus each flat's `wood`), DFU's tests on the tile, the forests'
 *  chances and places, a tile's own dice. */
function layoutForests(heightmapData, tilemapData, opts) {
  const hDim = HEIGHTMAP_DIMENSION;
  const tDim = WORLD_MAP_TILE_DIM;
  const yScale = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;   // layoutNature's terrainScale (TERRAIN-SCALE1)
  const cell = TERRAIN_SIZE / (hDim - 1);
  const at = (x, y) => heightmapData[x * hDim + y] * yScale;
  const scale = TERRAIN_SIZE / tDim;
  const trees = TREE_RECORDS[opts.forests.archive];
  const cover = coverOf(opts.forests.archive);
  const pois = opts.forests.pois ?? [];
  const paths = opts.forests.paths ?? null;
  // the clearings: the location's rect and every place's footprint, widened by DFU's clearance
  const clear = [opts.locationRect, ...pois].filter((r) => r && r.xMax > r.xMin && r.yMax > r.yMin).map((r) => ({
    xMin: r.xMin - NATURE_CLEARANCE, xMax: r.xMax + NATURE_CLEARANCE, yMin: r.yMin - NATURE_CLEARANCE, yMax: r.yMax + NATURE_CLEARANCE,
  }));
  const woodAt = forestField(opts.mapPixelX, opts.mapPixelY);
  const ox = opts.mapPixelX * tDim, oz = -opts.mapPixelY * tDim;
  const [in0, in1] = FOREST.inset;

  const flats = [];
  for (let y = 0; y < tDim; y++) {
    for (let x = 0; x < tDim; x++) {
      const ti = y * tDim + x;
      const ground = FOREST.ground[tilemapData[ti] & 0x3f];
      if (!ground || paths?.[ti]) continue;
      if (clear.some((r) => x >= r.xMin && x < r.xMax && y >= r.yMin && y < r.yMax)) continue;
      const hl = at(Math.max(0, x - 1), y), hr = at(Math.min(hDim - 1, x + 1), y);
      const hd = at(x, Math.max(0, y - 1)), hu = at(x, Math.min(hDim - 1, y + 1));
      const gx = (hr - hl) / (2 * cell), gz = (hu - hd) / (2 * cell);
      const g2 = gx * gx + gz * gz;
      if (g2 > TAN_MAX_STEEP_SQ) continue;
      const hx = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (x / tDim))));
      const hy = Math.min(hDim - 1, Math.max(0, Math.trunc(hDim * (y / tDim))));
      if (sampleHeight(heightmapData[hy + hx * hDim]) < SCALED_BEACH_ELEVATION) continue;

      const wood = Math.min(1, Math.max(0, woodAt(x, y) + placesPull(pois, x, y)));
      const tree = (FOREST.plainTree + (FOREST.forestTree - FOREST.plainTree) * wood) * ground;
      const under = (FOREST.plainCover + (FOREST.undergrowth - FOREST.plainCover) * wood) * ground;
      const wx = ox + x, wz = oz + y;
      const roll = tileDraw(wx, wz, 0);
      if (roll >= tree + under) continue;
      const pool = roll < tree ? trees : cover;
      const record = pool[Math.floor(tileDraw(wx, wz, 1) * pool.length)];
      const mx = (x + in0 + (in1 - in0) * tileDraw(wx, wz, 2)) * scale;
      const mz = (y + in0 + (in1 - in0) * tileDraw(wx, wz, 3)) * scale;
      const steepness = Math.atan(Math.sqrt(g2)) * (180 / Math.PI);
      flats.push({ record, x: mx, y: groundAt(heightmapData, mx, mz) - steepness / SLOPE_SINK_RATIO, z: mz, wood });
    }
  }
  return flats;
}
