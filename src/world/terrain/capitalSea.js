// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RUMARE-WATER (2026-10-26, bible/03-World/Tamriel.md RUMARE-WATER; a departure from DFU's BlendLocationTerrain) - A
// CAPITAL AT THE SEA: ITS WATER THE SEA'S OWN, ITS LAND A FREEBOARD OVER IT. AUDIT TESA II C2 flattened a shore capital's
// every slice to the sea's floor (SCALED_OCEAN_ELEVATION, the sampler's clamp) so its harbour's water stood at the sea's
// height - and its streets with it, every sample of them the sea's. Every reader that asks heights of the water then
// called the city water:
//   - Iliac Puddle No More's carve (world/deepWater/deepWaterFloor.js computeHoleMask: a point at or under the ocean and
//     its corners there - deepWaterClassification.js isLocalPointWater counts a height as water whatever its tile), which
//     TAMRIEL-DEEP's continent bake now reaches, cut a shore capital's streets to the seabed;
//   - Come Sail Away's hull (systems/comeSailAway/comeSailAway.js nodeReadingAt: under 34 m is water) sailed them.
// So a capital flattened to the sea stands its LAND at CAPITAL_LAND - CAPITAL_FREEBOARD over the sea, past the carve's
// headroom and the hull's line - and only its WATER at the sea's own height (CAPITAL_SEA):
//   - a vertex is water where a tile of the location's own ground (the stamped tilemap, before the squares) has water at
//     it (world/water/waterCorners.js WATER_DRAW_MASK_TABLE - so the sheet drawn on it is level), or the Imperial City's
//     law says so (world/rumareWaters.js rumareSeaAt - its lake and the Waterfront's mouth, at the span's seams too, the
//     two slices of a seam asking the same law), or - past the location's rect, its rim - where the land's own ground
//     there is the sea (the sea reaching in), or on a seam with the capital's sea slice (`seaEdges`: both sides of it
//     water);
//   - every other vertex is land: CAPITAL_LAND inside the rect, the rim's blend never under it, and the Imperial City's
//     far shore rising to the land's own at the span's edge (rumareWaters.js rumareLandHeight);
//   - the span's outer edge is the land's own ground (the pixel past it stands there), water or land - so no seam opens.
// Its water so the sea's: the Deep Waters carve takes it into the deep (its corners at the ocean), the hull sails it, and
// the city's land stays the city's.
// ═══════════════════════════════════════════════════════════════════
import { SCALED_OCEAN_ELEVATION, MAX_TERRAIN_HEIGHT, HEIGHTMAP_DIMENSION } from './terrainSampler.js';
import { convertTile } from './terrainSurface.js';
import { WATER_DRAW_MASK_TABLE } from '../water/waterCorners.js';
import { rumareSeaAt, rumareLandHeight, rumareSlice } from '../rumareWaters.js';

const f32 = Math.fround;
/** A capital at the sea's land over the water, kernel units (1 m: past the carve's 0.25 headroom, deepWaterClassification.js
 *  DW_CARVE_THRESHOLD, and the hull's 34 m line). */
export const CAPITAL_FREEBOARD = 0.8;
/** The sea's own height and a capital at the sea's land's, normalized as the samples are. */
export const CAPITAL_SEA = f32(SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT);
export const CAPITAL_LAND = f32((SCALED_OCEAN_ELEVATION + CAPITAL_FREEBOARD) / MAX_TERRAIN_HEIGHT);
/** The flatten a capital at the sea takes (world/terrain/terrainGen.js flattenAt.sea): its land's - its location's models
 *  stand on it. */
export const CAPITAL_SEA_FLAT = Object.freeze({ avg: CAPITAL_LAND, classic: CAPITAL_LAND });
/** Is a natural sample the sea's (the sampler's clamp, with the bake's own epsilon). */
const SEA_LINE = f32(CAPITAL_SEA + f32(1e-5));

const T = 128,
  H = HEIGHTMAP_DIMENSION;

/** Does a stamped tile of the location's ground have water at the vertex (x, y)? @param {Uint8Array} tilemap */
function stampedWaterAt(tilemap, x, y) {
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const tx = x - 1 + dx,
        ty = y - 1 + dy;
      if (tx < 0 || ty < 0 || tx >= T || ty >= T) continue;
      const t = tilemap[tx + ty * T];
      if (t === 0) continue; // unstamped: the squares' own, later
      // the vertex is the tile's corner (1 - dx, 1 - dy): bit 1 (0,0), 2 (1,0), 4 (0,1), 8 (1,1)
      if (WATER_DRAW_MASK_TABLE[convertTile(t)] & (1 << (1 - dx + 2 * (1 - dy)))) return true;
    }
  }
  return false;
}

/**
 * THE GROUND OF A CAPITAL AT THE SEA, after its flatten (CAPITAL_SEA_FLAT - every sample of its rect at CAPITAL_LAND, its
 * rim blended from it to the land's own): its water vertices let down to CAPITAL_SEA, its land at CAPITAL_LAND or over
 * it (the header's law). Mutates `S` in place.
 * @param {Float32Array} S the pixel's samples (x * 129 + y, y north), flattened
 * @param {Float32Array} natural the same samples before the flatten (the land's own ground)
 * @param {?Uint8Array} tilemap the location's stamped tiles (x + y * 128; 0 unstamped) - null where none is laid (the Deep
 *   Waters bake asks the law alone, world/tamrielWatersBake.js)
 * @param {{ xMin: number, xMax: number, yMin: number, yMax: number }} rect the location's rect, tile space
 * @param {number} px @param {number} py the Bay pixel
 * @param {?{ N?: boolean, E?: boolean, S?: boolean, W?: boolean }} [seaEdges] the pixel's sides shared with the capital's sea
 *   slice (or its own, a sea slice's) - world/tamrielCapitals.js synthesizeCapitalLocation
 */
export function capitalSeaGround(S, natural, tilemap, rect, px, py, seaEdges = null) {
  const city = rumareSlice(px, py);
  for (let x = 0; x < H; x++) {
    for (let y = 0; y < H; y++) {
      const i = x * H + y,
        bx = px + x / (H - 1),
        by = py + 1 - y / (H - 1);
      const inRect = x >= rect.xMin && x <= rect.xMax && y >= rect.yMin && y <= rect.yMax;
      const border = x === 0 || y === 0 || x === H - 1 || y === H - 1;
      const outer =
        (x === 0 && rect.xMin > 0) ||
        (x === H - 1 && rect.xMax < T) ||
        (y === 0 && rect.yMin > 0) ||
        (y === H - 1 && rect.yMax < T); // a side with a rim: the span's outer one
      if (outer) {
        S[i] = natural[i];
        continue;
      } // the span's outer edge: the land's own, as the pixel past it stands
      const stamped = !!tilemap && stampedWaterAt(tilemap, x, y);
      let sea;
      if (city)
        sea = rumareSeaAt(bx, by) || (!border && stamped); // the Imperial City: its plan's law, the seams the law's alone
      else if (!inRect)
        sea = stamped || natural[i] <= SEA_LINE; // the rim: the sea reaching in
      else if (
        border &&
        seaEdges &&
        ((x === 0 && seaEdges.W) ||
          (x === H - 1 && seaEdges.E) ||
          (y === 0 && seaEdges.S) ||
          (y === H - 1 && seaEdges.N))
      )
        sea = true;
      else sea = stamped;
      if (sea) S[i] = CAPITAL_SEA;
      else if (city) S[i] = Math.max(CAPITAL_LAND, rumareLandHeight(bx, by, CAPITAL_LAND, natural[i]));
      else S[i] = inRect ? CAPITAL_LAND : Math.max(S[i], CAPITAL_LAND);
    }
  }
}
