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

/** Half-width in tiles, by road class - so 0 paints a single-tile
 *  line and 1 paints a 3-tile band. A tile is 819.2 / 128 = 6.4 world
 *  units, so a track lands at 6.4 units and a trunk near 19. SKIN.
 *
 *  RW1 (Mac, 2026-08-28): HALVED from track 1 / trunk 2, which put a
 *  trunk near 32 world units - a third of an RMB block, a motorway
 *  through farmland. A track at one tile is only possible because
 *  stampRun below is 4-CONNECTED: at these widths the old per-step
 *  rounding left a diagonal track as corner-touching dots, 0% of them
 *  with an orthogonal neighbour, which is both a broken picture and a
 *  road DFU's own tileWeight walk could not follow. */
export const ROAD_TILE_HALF_WIDTH = Object.freeze({
  [ROAD_TRACK]: 0,
  [ROAD_TRUNK]: 1,
});

/** The records a TOWN's own ground uses for its streets - the same
 *  three, since setLocationTiles stamps the RMB ground and
 *  cityNavigation's tileWeight calls exactly these "Roads are great!"
 *  (:31). Stored as a tileBitfield, so the record is the low 6 bits
 *  (the mask CityNavigation itself applies at :57). */
const recordOf = (v) => v & 0x3f;
export const isRoadTile = (v) => v !== 0 && ROAD_TILE_RECORDS.includes(recordOf(v));

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

/** Whether a cell belonged to the LOCATION before this paint began.
 *
 *  It has to be a SNAPSHOT, not a live read of the tilemap: a run
 *  paints a band as it goes, so a live test sees the road's own last
 *  band as "claimed" and stops the run two cells in. The mask is
 *  taken once per pixel, before any stamping.
 *
 *  Out of bounds counts as claimed, so a run stops at the tilemap
 *  edge rather than walking off it. */
function isClaimed(mask, x, y) {
  if (x < 0 || y < 0 || x >= TDIM || y >= TDIM) return true;
  return mask[x + y * TDIM] !== 0;
}

/** A band of tiles along a straight run, inclusive of both ends. */
function stampRun(tilemap, ax, ay, bx, by, half, record, stopMask = null) {
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  let painted = 0;
  let px = null, py = null;
  const band = (cx, cy) => {
    let n = 0;
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) {
        if (stamp(tilemap, cx + ox, cy + oy, record)) n++;
      }
    }
    return n;
  };
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const cx = Math.round(ax + (bx - ax) * t);
    const cy = Math.round(ay + (by - ay) * t);
    // RW1: 4-CONNECTED. When a step moves on BOTH axes the two cells
    // touch only at a corner, so the elbow between them is stamped
    // too. Without it a half=0 run is a staircase of corner-touching
    // tiles - not a road you can walk, and not one tileWeight's walk
    // treats as connected.
    if (px !== null && cx !== px && cy !== py) painted += band(cx, py);
    if (stopMask && isClaimed(stopMask, cx, cy)) break;
    painted += band(cx, cy);
    px = cx; py = cy;
  }
  return painted;
}

/**
 * Paint the road through one map pixel into its tilemap.
 *
 * Each exit is a run between that exit's EDGE tile and a target, so a
 * road entering west and leaving east crosses the pixel. Because both
 * sides of a boundary aim at the same shared edge, the runs meet: a
 * pixel's east run ends at column 127 and its neighbour's west run
 * starts at column 0, and those two columns are adjacent in the world.
 *
 * ── WHERE A RUN AIMS (RW1, Mac 2026-08-28) ───────────────────────
 *
 * On an empty pixel the target is the CENTRE, as it always was, and a
 * road that only enters ends there - a dead-end track.
 *
 * On a pixel carrying a LOCATION the centre is the wrong target and
 * used to produce the two faults Mac saw. setLocationTiles has already
 * stamped the town's own RMB ground over the middle of the pixel, and
 * stamp() refuses a claimed cell, so aiming at the centre meant:
 *
 *   - at a big town the road was ERASED wholesale. Measured on
 *     Daggerfall's real rect (11..116): a trunk crossing west to east
 *     kept 110 of 216 tiles and survived only as two detached fringes
 *     at x=0..10 and x=117..127. Two stubs connected to nothing.
 *   - at a dead end the run stopped at the pixel centre whether or not
 *     the location was there. A CUST 1x1 exterior is forced to tile
 *     (72,55) by getLocationTerrainTileOrigin, so the road ended six
 *     tiles short of the building, in open ground.
 *
 * So a run now aims at the town's OWN STREET instead: the nearest tile
 * carrying one of ROAD_TILE_RECORDS, which is what setLocationTiles
 * stamped for the town's paths and what cityNavigation's tileWeight
 * calls a road. The run walks inward from the edge and stops at the
 * first claimed cell, which is the town's boundary - so the highway
 * meets the street at the gate the street already comes out of, and
 * the 1:1 tile law is still never overwritten. A location with no
 * street tiles at all (a bare dungeon exterior) falls back to aiming
 * at the footprint's nearest claimed cell, which is its wall.
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

  // RW1: the town's own streets, found once per pixel. Empty on a
  // pixel with no location, which is most of the Iliac Bay.
  const streets = townStreetTiles(tilemap);
  const box = claimedBox(tilemap);
  const located = streets.length > 0 || box !== null;
  // The pre-paint snapshot the runs stop against (see isClaimed).
  const claimed = located ? Uint8Array.from(tilemap, (v) => (v === 0 ? 0 : 1)) : null;

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
      // Inward from the EDGE, so a run that meets the town stops at
      // its boundary instead of being erased cell by cell.
      const t = located ? aimFor(streets, box, e) : { x: MID, y: MID };
      painted += stampRun(tilemap, e.x, e.y, t.x, t.y, half, record, claimed);
    }
  }
  return painted;
}

/** Every tile the location's own ground stamped as street. */
function townStreetTiles(tilemap) {
  const out = [];
  for (let i = 0; i < tilemap.length; i++) {
    if (isRoadTile(tilemap[i])) out.push({ x: i % TDIM, y: (i / TDIM) | 0 });
  }
  return out;
}

/** The bounding box of everything the location stamped, or null on an
 *  empty pixel. */
function claimedBox(tilemap) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let i = 0; i < tilemap.length; i++) {
    if (tilemap[i] === 0) continue;
    const x = i % TDIM, y = (i / TDIM) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Where a run from `edge` should aim on a pixel carrying a location:
 *  the nearest STREET tile, so the road meets the town's own path.
 *
 *  A location with NO street tiles - a bare dungeon exterior - has
 *  none, and then the target is the nearest point of the footprint
 *  itself. Aiming at the pixel centre instead is the CUST bug: a 1x1
 *  exterior is forced to tile (72,55), so a centre-aimed run stopped
 *  seven tiles short of the building with open ground between. */
function aimFor(streets, box, edge) {
  let best = null, bestD = Infinity;
  for (const s of streets) {
    const d = (s.x - edge.x) ** 2 + (s.y - edge.y) ** 2;
    if (d < bestD) { bestD = d; best = s; }
  }
  if (best) return best;
  if (!box) return { x: MID, y: MID };
  return {
    x: Math.min(Math.max(edge.x, box.x0), box.x1),
    y: Math.min(Math.max(edge.y, box.y0), box.y1),
  };
}

export { ROAD_NONE, ROAD_TRACK, ROAD_TRUNK };
