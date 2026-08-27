// ═══════════════════════════════════════════════════════════════════
// R5 — THE ROAD ON THE GROUND.
//
// R1 generated the network, R2 cached it, R3 drew it on the map, R4
// made travel follow it. This is where it becomes something you can
// stand on: the network painted into the 128x128 terrain tilemap of
// each streamed map pixel.
//
// ── THE SEAM ALREADY EXISTED ─────────────────────────────────────
//
// assignTiles skips any tilemap cell that is already non-zero ("Do
// nothing if in location rect as texture already set"), which is how
// setLocationTiles stamps a town's RMB ground before marching squares
// runs. Roads use the SAME rule and the same seam: paint after the
// location, skip anything already stamped, and the 1:1 tile law is
// not touched at all. A town's own ground therefore wins inside its
// rect - the road runs up to the wall and the town takes over, which
// is what it should do anyway.
//
// ── NO NEW ART ───────────────────────────────────────────────────
//
// Records 46, 47 and 55 are already road in Daggerfall's ground
// archives - cityNavigation.js's tileWeight is DFU's GetTileWeight
// verbatim and gives exactly those three weight 15, "Roads are
// great!". So this paints classic's own tiles and ships nothing.
//
// WHICH of the three reads best, and at what width, is a question for
// a machine with ARENA2 - this environment has none, so the record is
// a parameter with a stated default rather than a decision made blind.
//
// ── ROW 127 IS NORTH, AND THAT IS DERIVED, NOT ASSUMED ───────────
//
// generateTileData computes
//
//     longitude = MAX_WORLD_TILE_COORD_Z - mapPixelY * 128 + y
//
// so longitude FALLS as the map pixel goes south (y grows south, the
// port's convention everywhere) and RISES with the tile row. Pixel
// (px, py) at row 127 therefore sits at longitude L+127, while its
// NORTH neighbour (px, py-1) at row 0 sits at L+128 - consecutive, so
// those are the two rows that touch. Tile row 127 is the north edge
// and row 0 is the south edge, which is the opposite of what a naive
// reading of "row 0 first" would give, and getting it backwards would
// break every road at every pixel boundary while each pixel looked
// perfectly correct on its own. The pin holds the claim against
// generateTileData's ACTUAL output rather than against this comment.
//
// Latitude is the easy direction: mapPixelX * 128 + x, rising with
// both, so column 127 is east and column 0 is west.
// ═══════════════════════════════════════════════════════════════════

import { WORLD_MAP_TILE_DIM } from './terrainTiles.js';
import { DIRS, ROAD_NONE, ROAD_TRACK, ROAD_TRUNK, roadExitsAt } from '../systems/roads.js';

/** The three records DFU's GetTileWeight calls road (cityNavigation.js
 *  :31). Anything painted must be one of these - a road drawn with a
 *  record the nav law does not recognise is a road nothing treats as
 *  one. */
export const ROAD_TILE_RECORDS = Object.freeze([46, 47, 55]);

/** The body record. SKIN, and explicitly UNVERIFIED BY EYE: this
 *  container has no ARENA2, so which of the three reads best is a
 *  question for a machine that can render them. Parameterised so that
 *  answering it is a call-site change, not a code change. */
export const ROAD_TILE_RECORD = 46;

/** Half-width in tiles, by road class - so 1 paints a 3-tile band.
 *  A tile is 819.2 / 128 = 6.4 world units, so a trunk lands near 32
 *  units wide and a track near 19. SKIN. */
export const ROAD_TILE_HALF_WIDTH = Object.freeze({
  [ROAD_TRACK]: 1,
  [ROAD_TRUNK]: 2,
});

const TDIM = WORLD_MAP_TILE_DIM;
const MID = TDIM >> 1;

/**
 * Where an exit meets the edge of this pixel's tilemap.
 *
 * East is column 127 and west is column 0 (latitude rises with both
 * the map pixel and the tile column). North is ROW 127 and south is
 * row 0 - see the header; longitude rises with the tile row while the
 * map pixel's y grows southward.
 */
export function exitTile(dir) {
  const { dx, dy } = DIRS[dir];
  return {
    x: dx > 0 ? TDIM - 1 : dx < 0 ? 0 : MID,
    y: dy < 0 ? TDIM - 1 : dy > 0 ? 0 : MID,
  };
}

/** Stamp one tile if nothing has claimed it. The skip rule is
 *  assignTiles's own, so a town's stamped ground always wins. */
function stamp(tilemap, x, y, record) {
  if (x < 0 || y < 0 || x >= TDIM || y >= TDIM) return false;
  const i = x + y * TDIM;
  if (tilemap[i] !== 0) return false;
  tilemap[i] = record;
  return true;
}

/** A band of tiles along a straight run, inclusive of both ends. */
function stampRun(tilemap, ax, ay, bx, by, half, record) {
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  let painted = 0;
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const cx = Math.round(ax + (bx - ax) * t);
    const cy = Math.round(ay + (by - ay) * t);
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) {
        if (stamp(tilemap, cx + ox, cy + oy, record)) painted++;
      }
    }
  }
  return painted;
}

/**
 * Paint the road through one map pixel into its tilemap.
 *
 * Each exit is a run from the pixel CENTRE out to that exit's edge
 * tile, so a road entering west and leaving east crosses the pixel,
 * and a road that only enters ends in the middle - which is what a
 * road into a dead-end village looks like. Because both sides of a
 * boundary aim at the same shared edge, the runs meet: a pixel's east
 * run ends at column 127 and its neighbour's west run starts at
 * column 0, and those two columns are adjacent in the world.
 *
 * Call it AFTER setLocationTiles and BEFORE assignTiles.
 *
 * @param {Uint8Array} tilemap - 128x128, the pixel's tilemap
 * @param {object|null} network - the baked road network
 * @param {number} px @param {number} py - map pixel
 * @returns {number} tiles painted (0 when no road crosses this pixel)
 */
export function paintRoadTiles(tilemap, network, px, py, {
  record = ROAD_TILE_RECORD, halfWidth = ROAD_TILE_HALF_WIDTH,
} = {}) {
  if (!network) return 0;
  const { trunk, track } = roadExitsAt(network, px, py);
  // A FAST PATH, not a guard: the per-plane `if (!bits) continue`
  // below already paints nothing when both planes are empty, proven by
  // hashing the output of five pixels with and without this line. It
  // stays because the streamer calls this for every pixel it loads and
  // most of the Iliac Bay has no road on it, and it is labelled as
  // subsumed so the next reader does not mistake it for the thing
  // doing the work.
  if (!trunk && !track) return 0;

  let painted = 0;
  // Track first, trunk second, so where the two share a pixel the
  // trunk's wider band wins the middle - the same order the map layer
  // draws them in.
  for (const [bits, kind] of [[track, ROAD_TRACK], [trunk, ROAD_TRUNK]]) {
    if (!bits) continue;
    const half = halfWidth[kind] ?? 1;
    for (let d = 0; d < 8; d++) {
      if (!(bits & DIRS[d].bit)) continue;
      const e = exitTile(d);
      painted += stampRun(tilemap, MID, MID, e.x, e.y, half, record);
    }
  }
  return painted;
}

export { ROAD_NONE, ROAD_TRACK, ROAD_TRUNK };
