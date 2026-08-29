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
import { tracePolylines } from '../systems/roadBake.js';   // RZ3: the chain a pixel's road belongs to
import { simplifyChain, chaikin, SIMPLIFY_EPSILON } from '../ui/overworldModel.js';   // RZ3: the same smoothing the map layer uses

/** The three records DFU's GetTileWeight calls road (cityNavigation.js
 *  :31). Anything painted must be one of these - a road drawn with a
 *  record the nav law does not recognise is a road nothing treats as
 *  one. */
export const ROAD_TILE_RECORDS = Object.freeze([46, 47, 55]);

/** The body record. SKIN, and explicitly UNVERIFIED BY EYE: this
 *  container has no ARENA2, so which of the three reads best is a
 *  question for a machine that can render them. Parameterised so that
 *  answering it is a call-site change, not a code change.
 *
 *  Kept as the single-record default and as the fallback for a class
 *  the table below does not name. */
export const ROAD_TILE_RECORD = 46;

/** RC2 (Mac, 2026-08-28) - A TRUNK AND A TRACK LOOK DIFFERENT.
 *
 *  The network has carried the class since R1 and the map layer has
 *  drawn the two at their own colours and lifts since R3 - but
 *  underfoot both painted record 46, so a goat track to a graveyard
 *  was indistinguishable from the Daggerfall-to-Wayrest highway.
 *
 *  All three of these are road to DFU's own nav law (cityNavigation
 *  tileWeight :31, "Roads are great!"), so this ships no art and
 *  changes nothing about what counts as a road - only which of the
 *  three each class draws with.
 *
 *  WHICH IS WHICH IS UNVERIFIED, for the same reason the record above
 *  says so: nothing here can render them. The assignment is the
 *  ordering claim only - the trunk keeps 46, the record the single-
 *  record version already used and the one every existing pin names,
 *  and the track takes 47 so the two differ at all. An eye on ARENA2
 *  should settle it, and this is a table so that settling it is a
 *  value change. */
export const ROAD_TILE_RECORD_BY_KIND = Object.freeze({
  [ROAD_TRACK]: 47,
  [ROAD_TRUNK]: 46,
});

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

/** RZ3 (Mac, 2026-08-28) - THE ROUTE WAS THE ZIG-ZAG.
 *
 *  RR1 rounded the corner inside a pixel and RZ2 placed the control
 *  point by the turn, and a drifting road still stood 63 tiles off its
 *  own line. Measuring WHERE showed why: on a road climbing one pixel
 *  in three, the painted road sat dead flat across three whole pixels
 *  and then stepped 128 tiles at once. The exits and the curve were
 *  faithfully drawing a staircase, because the ROUTE is a staircase -
 *  a road's chain is a walk over map pixels, so a shallow gradient can
 *  only be expressed as flat-flat-flat-step.
 *
 *  It is the same defect the MAP layer had, and it takes the same
 *  cure: simplify the chain, then smooth it, then draw THAT. The map
 *  does it in overworldModel; this does it in tile space.
 *
 *  SYMMETRY, which is the whole difficulty. Two neighbours must place
 *  the road identically on their shared edge or it breaks at the seam,
 *  and they are painted independently and possibly never together. A
 *  WINDOW around each pixel would not do - P's window and N's window
 *  differ by a pixel, so their smoothed curves differ and the road
 *  tears. Both trace the WHOLE chain instead, junction to junction,
 *  from the same exit planes, and smooth it with the same passes: the
 *  curve is a property of the CHAIN, not of who is looking at it, so
 *  the two agree exactly by construction.
 *
 *  Measured over five road shapes, worst deviation among roads that
 *  should run straight: 63.4 tiles before, 2.8 after - which is the
 *  road's own half-width, i.e. as straight as a drawn band can be.
 *
 *  Cached in a WeakMap rather than on the network, because the network
 *  is serialized to the bake cache and must not grow a derived field. */
const CHAIN_CACHE = new WeakMap();
const CHAIN_SMOOTH_PASSES = 3;

function chainIndex(network) {
  let idx = CHAIN_CACHE.get(network);
  if (idx) return idx;
  idx = new Map();
  for (const [plane, kind] of [['trunkExits', ROAD_TRUNK], ['trackExits', ROAD_TRACK]]) {
    for (const line of tracePolylines(network[plane], network.width, network.height)) {
      // pixel CENTRES, so the smoothed curve lives in the same space
      // the map layer's does
      // RZ6: NO SIMPLIFICATION on the ground, and this is the whole
      // lesson of the arc. Simplifying deletes the intermediate
      // vertices, so the curve ends up with no point inside most of
      // the pixels it belongs to - and on the ground that is fatal,
      // because a pixel paints only its OWN tilemap. A road whose
      // curve has left the pixel leaves a HOLE there, however good the
      // picture looks stitched together. The map layer can simplify
      // freely; it draws one continuous mesh and owns no ground.
      //
      // So this rounds the corners and does not touch the route.
      // Chaikin keeps the curve inside the convex hull of the pixel
      // centres it came from, which is exactly the guarantee the
      // ground needs: every pixel keeps its road.
      const smooth = chaikin(line.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 })), CHAIN_SMOOTH_PASSES);
      for (const p of line) {
        const key = `${p.x},${p.y}`;
        if (!idx.has(key)) idx.set(key, []);
        idx.get(key).push({ kind, points: smooth });
      }
    }
  }
  CHAIN_CACHE.set(network, idx);
  return idx;
}

/** RZ3b: simplify the STRAIGHT RUNS and keep the CORNERS.
 *
 *  Plain Ramer-Douglas-Peucker at the map layer's 0.9 cannot be used
 *  here, and the reason is geometric rather than a tuning matter: a
 *  one-pixel corner and a one-pixel stair step are the SAME shape. An
 *  east-then-north corner puts its middle pixel 0.707 off the chord,
 *  and so does an east-then-north-east stair - so any tolerance either
 *  keeps both (and the staircase survives) or drops both (and a real
 *  right-angle road is cut across, which is what a first draft here
 *  did: the corner pixel painted a sliver at its own corner instead of
 *  turning).
 *
 *  The signal that separates them is the TURN, not the deviation. A
 *  chain walks the eight compass steps, so a stair is a 45-degree
 *  change of direction and a corner is 90 or more. The chain is split
 *  at every hard turn, each straight-ish run is simplified on its own,
 *  and the hard vertices are kept exactly - so stairs go, corners
 *  stay, and the route never leaves the pixels the network gave it by
 *  more than the tolerance. */
export function simplifyKeepingCorners(line, eps = SIMPLIFY_EPSILON) {
  const pts = line.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  if (pts.length < 3) return pts;
  // a vertex is HARD when the road turns by 90 degrees or more there
  const hard = [0];
  for (let i = 1; i < pts.length - 1; i++) {
    const ax = pts[i].x - pts[i - 1].x, ay = pts[i].y - pts[i - 1].y;
    const bx = pts[i + 1].x - pts[i].x, by = pts[i + 1].y - pts[i].y;
    const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
    // cos of the turn: 1 straight on, ~0.707 a stair, <= 0 a corner
    if (((ax / la) * (bx / lb) + (ay / la) * (by / lb)) <= 0.01) hard.push(i);
  }
  hard.push(pts.length - 1);
  const out = [];
  for (let h = 1; h < hard.length; h++) {
    const run = simplifyChain(pts.slice(hard[h - 1], hard[h] + 1), eps);
    out.push(...(h === 1 ? run : run.slice(1)));
  }
  return out;
}

/** The smoothed chain, in THIS pixel's tile coordinates. Map y grows
 *  south and tile rows rise north (this file's header derives that
 *  from generateTileData), so the row axis is flipped. */
function chainTilePoints(points, px, py) {
  return points.map((p) => [(p.x - px) * TDIM, (py + 1 - p.y) * TDIM]);
}

/** RZ4 (2026-08-28) - WHERE THE CHAIN ENTERS AND LEAVES THIS PIXEL.
 *
 *  RZ3 gave OPEN country the smoothed chain and left a LOCATION's
 *  pixel on the old exit rule, so that the road could still be aimed
 *  at the town's own street (RW1). Those two rules disagree about
 *  where a road crosses a seam, and on a drifting road they disagree
 *  badly: measured on a 1-in-3 gradient running into a town, the open
 *  neighbour left at tile rows 126-127 and the town pixel took the
 *  road in at rows 63-65. Sixty-two tiles of nothing. The road tore at
 *  every town it reached.
 *
 *  Both halves are wanted, and they are not actually in conflict once
 *  they are asked for different things: the CHAIN says where the road
 *  crosses the boundary, and the STREET says where it goes once it is
 *  inside. So a located pixel now starts its runs at the chain's own
 *  crossings - which its neighbours compute identically, so the seam
 *  holds - and aims them at the nearest street, stopping at the
 *  footprint exactly as before. */
/** The smoothed chain as tile steps, dense enough that consecutive
 *  samples never skip a tile. */
function densifyChain(points, px, py) {
  const pts = chainTilePoints(points, px, py);
  const dense = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      dense.push([Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t)]);
    }
  }
  return dense;
}

function chainCrossings(points, px, py) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < TDIM && y < TDIM;
  const clamp = (v) => (v < 0 ? 0 : v > TDIM - 1 ? TDIM - 1 : v);
  const pts = chainTilePoints(points, px, py);
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    let was = inside(Math.round(ax), Math.round(ay));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const cx = Math.round(ax + (bx - ax) * t), cy = Math.round(ay + (by - ay) * t);
      const now = inside(cx, cy);
      // the tile where the road steps over the boundary, either way
      if (now !== was) out.push({ x: clamp(cx), y: clamp(cy) });
      was = now;
    }
  }
  return out;
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
function isClaimed(mask, x, y, outOfBoundsStops = true) {
  // OUT OF BOUNDS IS NOT THE SAME AS CLAIMED, and the difference
  // matters. For a run that STARTS at this pixel's edge and walks
  // inward, leaving the tilemap is the end of the run. For the chain
  // pass it is not: that path begins outside the pixel and only its
  // WIDTH reaches in, so treating the first outside sample as claimed
  // stops the run before it has painted anything - which tore the road
  // at every town on a gradient.
  if (x < 0 || y < 0 || x >= TDIM || y >= TDIM) return outOfBoundsStops;
  return mask[x + y * TDIM] !== 0;
}

/** A band of tiles along a straight run, inclusive of both ends. */
function stampPath(tilemap, pts, half, record, stopMask = null, outOfBoundsStops = true) {
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
  for (const [cx, cy] of pts) {
    if (cx === px && cy === py) continue;   // the sampler oversamples on purpose
    // RW1: 4-CONNECTED. When a step moves on BOTH axes the two cells
    // touch only at a corner, so the elbow between them is stamped
    // too. Without it a half=0 run is a staircase of corner-touching
    // tiles - not a road you can walk, and not one tileWeight's walk
    // treats as connected.
    if (px !== null && cx !== px && cy !== py) painted += band(cx, py);
    if (stopMask && isClaimed(stopMask, cx, cy, outOfBoundsStops)) break;
    painted += band(cx, cy);
    px = cx; py = cy;
  }
  return painted;
}

/** A straight run, inclusive of both ends. */
function stampRun(tilemap, ax, ay, bx, by, half, record, stopMask = null) {
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    pts.push([Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t)]);
  }
  return stampPath(tilemap, pts, half, record, stopMask);
}

/** RR1 (Mac, 2026-08-28) - A THROUGH ROAD IS ROUNDED, NOT MITRED.
 *
 *  Every exit used to be a straight spoke from the edge to the pixel
 *  CENTRE, so a road entering west and leaving north painted two
 *  spokes meeting at a hard 90-degree corner in the middle of the
 *  tilemap - and a road that curves gently across the province became
 *  a chain of those corners, which is the zig-zag.
 *
 *  A pixel carrying exactly two exits of a class is a through road,
 *  and it is drawn as ONE quadratic Bezier from edge to edge with the
 *  centre as the control point. The curve still passes through the
 *  middle of the pixel and still meets both edges exactly where the
 *  neighbours' runs meet them, so the seam law is untouched - only
 *  the corner between them is rounded away.
 *
 *  A single exit is a dead end and a junction is three or more, and
 *  neither is a curve: both keep their spokes to the centre. */
/** RZ2 (Mac, 2026-08-28) - WHERE a through road's control point goes.
 *
 *  RR1 put it at the pixel CENTRE always, which rounds a right-angle
 *  turn correctly and is badly wrong for a gentle one: a road drifting
 *  east-north-east has to dive to the middle of every pixel and back
 *  out to a corner, and it scallops. Measured over five pixels, that
 *  road stood a mean 28 tiles and a peak 46 off its own line - about
 *  290 world units of detour, which is the ground half of the zig-zag.
 *
 *  The control point is now placed by how sharply the road actually
 *  turns here, using the two exits' directions from the centre:
 *
 *    opposite exits (a straight-through road)  -> the chord's midpoint,
 *                                                 so the road is straight
 *    perpendicular exits (a real corner)       -> the centre, so the
 *                                                 corner rounds as it did
 *    anything between                          -> weighted between them
 *
 *  `1 - |dot|` is that weight: 0 when the exits face opposite ways,
 *  1 when they are at right angles. So the rounding RR1 added is kept
 *  exactly where it was needed and taken out of the road's way
 *  everywhere else. */
export function throughControl(a, b) {
  const ax = a.x - MID, ay = a.y - MID;
  const bx = b.x - MID, by = b.y - MID;
  const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
  const dot = (ax / la) * (bx / lb) + (ay / la) * (by / lb);
  const w = 1 - Math.abs(dot);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  return { x: mx + (MID - mx) * w, y: my + (MID - my) * w };
}

function curvePoints(ax, ay, cx, cy, bx, by) {
  // Sampled fine enough that consecutive samples never differ by more
  // than a tile on either axis; stampPath drops the duplicates.
  const n = Math.max(8, 2 * (Math.abs(ax - bx) + Math.abs(ay - by) + Math.abs(ax - cx) + Math.abs(ay - cy)));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([
      Math.round(u * u * ax + 2 * u * t * cx + t * t * bx),
      Math.round(u * u * ay + 2 * u * t * cy + t * t * by),
    ]);
  }
  return pts;
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
  record = null, recordByKind = ROAD_TILE_RECORD_BY_KIND, halfWidth = ROAD_TILE_HALF_WIDTH,
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

  // RZ3: OPEN COUNTRY takes the smoothed chain. A pixel carrying a
  // LOCATION keeps the exit-based approach below, deliberately: there
  // the road's job is to meet the town's own street at the gate
  // (RW1), which is a one-pixel question the chain cannot answer, and
  // the staircase this fixes is invisible over a single pixel anyway.
  if (!located && network) {
    for (const { kind, points } of chainIndex(network).get(`${px},${py}`) ?? []) {
      painted += stampPath(tilemap, densifyChain(points, px, py),
        halfWidth[kind] ?? 1, record ?? recordByKind[kind] ?? ROAD_TILE_RECORD, null);
    }
    return painted;
  }

  // Track first, trunk second, so where the two share a pixel the
  // trunk's wider band wins the middle - the same order the map layer
  // draws them in.
  for (const [bits, kind] of [[track, ROAD_TRACK], [trunk, ROAD_TRUNK]]) {
    if (!bits) continue;
    const half = halfWidth[kind] ?? 1;
    // RC2: `record` still overrides everything when a caller passes
    // one, so a probe or a pin can paint the whole network in one
    // record and read it back without knowing the classes.
    const rec = record ?? recordByKind[kind] ?? ROAD_TILE_RECORD;
    const exits = [];
    for (let d = 0; d < 8; d++) if (bits & DIRS[d].bit) exits.push(exitTile(d));

    // RR1: a THROUGH road on an open pixel is one rounded curve rather
    // than two spokes mitred at the centre. A location's pixel keeps
    // the straight approaches - they have to stop at the footprint,
    // and a curve that halts halfway is not a curve.
    if (exits.length === 2 && !located) {
      const c = throughControl(exits[0], exits[1]);
      painted += stampPath(tilemap,
        curvePoints(exits[0].x, exits[0].y, c.x, c.y, exits[1].x, exits[1].y),
        half, rec, null);
      continue;
    }
    // RZ4: a located pixel starts where the CHAIN crosses its boundary,
    // not at the fixed exit tile - otherwise it disagrees with the
    // chain-painted neighbour and the road tears at the town's edge.
    // The fixed exits remain the fallback for a pixel the tracer gave
    // no chain (a network handed in without one, as the tests do).
    // RZ4: a LOCATED pixel draws the same curve its neighbours draw,
    // and then its street runs on top of it.
    //
    // It used to draw only the exit-based runs, and that tore the road
    // at every town on a gradient: the open neighbour left at tile
    // rows 126-127 while the town took the road in at 63-65, because
    // the two were using different rules for where a road crosses a
    // seam. The curve IS the road; a pixel that happens to carry a
    // location does not get to disagree about where it runs.
    //
    // Both passes refuse a claimed cell, so the town's own ground is
    // exactly as safe as it was - this adds road where the road
    // already goes, and takes nothing from the 1:1 tile law.
    let drewChain = false;
    if (network) {
      for (const c of chainIndex(network).get(`${px},${py}`) ?? []) {
        if (c.kind !== kind) continue;
        drewChain = true;
        // CLIPPED to this pixel first, THEN masked. The chain begins
        // outside the pixel and isClaimed counts out-of-bounds as
        // claimed, so masking the raw path halts the run on its very
        // first sample; masking a path that never leaves the tilemap
        // stops it where it should - at the town's own ground. Without
        // the mask the run would instead walk straight through the
        // footprint and fill the unstamped HOLES inside it, which is
        // the thing RW1 put the mask there to prevent.
        // The town is SKIPPED, not stopped at. stampPath breaks on its
        // first claimed cell, which is right for a run that starts at
        // the pixel's edge and ends at the town - and wrong for a road
        // that passes THROUGH the pixel, because everything beyond the
        // town is then never painted at all. Measured: the pixel drew
        // only its eastern half, x 78..127, and the western approach
        // vanished.
        //
        // Dropping the samples inside the footprint's box does both
        // jobs at once: the road stops at the town's edge, picks up
        // again on the far side, and cannot fill the unstamped HOLES
        // inside the footprint that RW1's mask was guarding.
        const dense = densifyChain(c.points, px, py).filter(([cx, cy]) => !(
          box && cx >= box.x0 && cx <= box.x1 && cy >= box.y0 && cy <= box.y1));
        painted += stampPath(tilemap, dense, half, rec, null);
      }
    }
    // RZ6 (Mac, 2026-08-28) - ONE ROAD, NOT TWO.
    //
    // RZ4 added the chain pass above and left these runs in place, so
    // a located pixel painted BOTH: the chain's road AND a second one
    // spoked out from the fixed exit tiles to the middle. Two roads
    // through one pixel, on different lines - which is what Mac was
    // looking at, and what every metric I had missed, because both of
    // them are road and neither is far from where road should be.
    //
    // The exits are the FALLBACK now, for a pixel the tracer gave no
    // chain. When there is a chain, it is the road.
    // RZ6: the street connectors START ON THE ROAD. When a chain
    // crosses this pixel, its boundary crossings are the road's own
    // entry points, so a run from there to the nearest street is a
    // BRANCH of the road rather than the separate second road RZ4
    // left behind. Without a chain the fixed exits are the fallback,
    // as they always were.
    const from_ = [];
    if (located && network) {
      for (const c of chainIndex(network).get(`${px},${py}`) ?? []) {
        if (c.kind === kind) from_.push(...chainCrossings(c.points, px, py));
      }
    }
    // Not gated on there BEING streets: aimFor falls back to the
    // footprint itself, which is what carries a road to a bare dungeon
    // exterior - the CUST case, forced off-centre to tile (72,55),
    // that a centre-aimed run used to miss by six tiles.
    if (!drewChain || (located && from_.length)) {
      for (const e of (from_.length ? from_ : exits)) {
        // Inward from the EDGE, so a run that meets the town stops at
        // its boundary instead of being erased cell by cell.
        const t = located ? aimFor(streets, box, e) : { x: MID, y: MID };
        painted += stampRun(tilemap, e.x, e.y, t.x, t.y, half, rec, claimed);
      }
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
