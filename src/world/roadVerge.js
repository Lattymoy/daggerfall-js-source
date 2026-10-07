// ═══════════════════════════════════════════════════════════════════
// VERGE1 (2026-10-07, Mac: "Making sure objects, like trees, avoid
// pathways and roads. Currently they slightly overlap") - THE VERGE: a
// wilderness flat keeps its whole footprint off the roads and tracks.
//
// Every placer of the wild's flats asked ONE TILE - the one its root
// stands on - and never how wide the thing it stood there was. DFU's
// scatter roots a flat on its tile's corner, which on the road's east
// and north sides IS the road's edge (half the picture over it); Real
// forests roots each inside its own tile, 0.64-5.76 m from a road beside
// it; and Low Poly Trees stands a crown of 5-11 m about that root in the
// temperate woods. So the trees beside a road stood over it.
//
// Here a flat stands only where the DISC of its reach touches no road or
// track. The road is the band Basic Roads paints (world/roadPainter.js):
// two tiles - 6.4 m either side of the line from the pixel's centre to
// the edge or corner its compass bit names, the network roadClearance.js
// already reads for World of Daggerfall's pieces. Measured as a disc to a
// segment, not ROADS-CLEAR's grown square: a square reaches a diagonal
// road 1.41 times as far as it reaches a straight one. A diagonal's
// painted road is narrower than its band (its flanks are half tiles, 4.5
// m from the line), so a diagonal's verge is up to 1.9 m wider than its
// art; the band is the one law both kinds share. The band runs over the
// map pixel's edges as the paint does, and it carries the tracks laid
// over dirt, which the painter writes nothing for (AUDIT FOREST1 F8).
//
// THE REACH is the widest anything stands there on any client: the
// classic picture's half width (DFU's own record size, never a
// replacement's), or the crown Low Poly Trees stands for it (world/
// lptCrowns.js, the summer tree's or the winter one's, at the tree's own
// scale - lptVariety, a function of where it stands). Where flats stand
// is the room's ground online and the mod is the player's own (it draws
// the trees, it never moves them), so the mod's crown keeps a flat off
// the road on a client that draws none.
// ═══════════════════════════════════════════════════════════════════

import { pathsDataPoint, MP_WORLD_UNITS, N, NE, E, SE, S, SW, W, NW } from '../systems/travelPaths.js';
import { MAP_W, MAP_H } from './roadNetwork.js';
import { PATH_HALF_WIDTH, UNITS_PER_METRE } from './roadClearance.js';
import { LPT_CROWNS } from './lptCrowns.js';
import { lptVariety } from './lowPolyTrees.js';
import { getNatureArchive, SEASON } from './climateSwaps.js';
import { TILE } from './roadPainter.js';

/** A path's half width (m): Basic Roads paints a road or a track two tiles wide about its line. */
export const PATH_HALF_M = PATH_HALF_WIDTH / UNITS_PER_METRE;
/** A map pixel (m). */
const PIXEL_M = MP_WORLD_UNITS / UNITS_PER_METRE;
const HALF_M = PIXEL_M / 2;
/** Each compass bit's arm: from the pixel's centre to the edge or corner it names, in half pixels (x east, z north). */
const ARMS = Object.freeze([[N, 0, 1], [NE, 1, 1], [E, 1, 0], [SE, 1, -1], [S, 0, -1], [SW, -1, -1], [W, -1, 0], [NW, -1, 1]]);

/**
 * THE ROOM BESIDE THE ROAD: how far (m) a pixel-local point - x east, z north, from the pixel's south-west corner, the
 * frame the nature flats and roadClearance.js share - stands from the nearest edge of a road's or a track's band, in its
 * own pixel or any other a band within `reach` of it runs through; `reach` when none comes nearer, 0 on one.
 * @param {object|null} net terrainGen.roads() - null answers `reach` (nothing is painted)
 * @param {number} px @param {number} py the pixel @param {number} x @param {number} z @param {number} reach (m)
 */
export function roadRoom(net, px, py, x, z, reach) {
  if (!net || !(reach > 0)) return Math.max(0, reach);
  const g = PATH_HALF_M + reach;
  // only the map's pixels are asked (OW-WOD-LAG's law, roadClearance.js): none past its edges has a road
  const ix0 = Math.max(-px, Math.floor((x - g) / PIXEL_M)), ix1 = Math.min(MAP_W - 1 - px, Math.floor((x + g) / PIXEL_M));
  const iz0 = Math.max(py - (MAP_H - 1), Math.floor((z - g) / PIXEL_M)), iz1 = Math.min(py, Math.floor((z + g) / PIXEL_M));
  let room = reach;
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const bits = pathsDataPoint(net, px + ix, py - iz);   // north (+z) is the row above: py - 1
      if (!bits) continue;
      const qx = x - (ix * PIXEL_M + HALF_M), qz = z - (iz * PIXEL_M + HALF_M);   // the point from that pixel's centre
      for (const [bit, sx, sz] of ARMS) {
        if (!(bits & bit)) continue;
        const ex = sx * HALF_M, ez = sz * HALF_M;
        const t = Math.min(1, Math.max(0, (qx * ex + qz * ez) / (ex * ex + ez * ez)));
        const d = Math.hypot(qx - t * ex, qz - t * ez) - PATH_HALF_M;
        if (d < room) room = Math.max(0, d);
      }
    }
  }
  return room;
}

/** Does a disc of `radius` (m) about the pixel-local point stand clear of every road and track? */
export const vergeClear = (net, px, py, x, z, radius) => roadRoom(net, px, py, x, z, radius) >= radius;

/**
 * A NATURE RECORD'S CROWN under Low Poly Trees (m, before the tree's own scale): the summer tree's or the winter one's,
 * whichever reaches farther - a season does not move a flat - or 0 for a record the mod leaves a picture.
 * @param {number} baseArchive the climate's summer nature archive (504, ...) @param {number} record
 */
export function lptCrownOf(baseArchive, record) {
  let crown = 0;
  for (const season of [SEASON.Summer, SEASON.Winter]) crown = Math.max(crown, LPT_CROWNS[`${getNatureArchive(baseArchive, season)}_${record}`] ?? 0);
  return crown;
}

/**
 * HOW FAR A WILDERNESS FLAT REACHES about its root (m): its classic picture's half width, or the crown Low Poly Trees
 * stands there at the tree's own scale, whichever is wider.
 * @param {number} halfWidth the record's classic picture's half width (rmbFlats.js classicBillboardSize's w / 2)
 * @param {number} baseArchive @param {number} record
 * @param {number} px @param {number} py the pixel @param {number} x @param {number} z the flat's root, pixel-local (m)
 */
export function natureReach(halfWidth, baseArchive, record, px, py, x, z) {
  const crown = lptCrownOf(baseArchive, record);
  return Math.max(halfWidth, crown > 0 ? crown * lptVariety(px, py, x, z, false).scale : 0);
}

// ═══════════════════════════════════════════════════════════════════
// LPT-FIT (2026-10-07, Mac: "roads still show on roads and pathways. You're not taking the entire model into account")
// - THE WHOLE TREE FITS ITS ROOM. VERGE1 refuses a WILD flat whose reach touches the road band, and that was all it
// asked: a location's own trees (a town's, a farm's, a tavern's RMB blocks - and road pixels are full of them) stand
// where DFU's block designer set a two-metre picture beside a street, and Low Poly Trees stands a 5-15 m crown on each.
// Nothing asked those of the road, nor of the location's own streets, nor of the paved ring Basic Roads lays round a
// town. So every Low Poly tree is drawn no wider than the room its root has: the nearest road, track or street tile of
// its pixel (pathTileMask) and, for the band crossing a pixel's edge, the network's (roadRoom). It is a scale, never a
// move - the trunk, its collider, Logging's tree and the room's ground stay where they stand; the mod draws the tree
// smaller, as it draws it at all, on the player's own client.
// ═══════════════════════════════════════════════════════════════════

/** A terrain tile (m): 128 to a map pixel. */
export const TILE_M = PIXEL_M / 128;
/** The smallest a fitted tree is drawn, of its prototype: a tree whose root stands on a path is a sapling, never
 *  nothing - its trunk's collider and its cover stand where DFU stands the flat, so it is never an invisible post. */
export const LPT_FIT_FLOOR = 0.2;

/**
 * THE PIXEL'S PATH TILES (128x128, 1 = a path): a tile the road painter wrote or marked (GRASS-PATH1's mask - a track
 * laid over dirt among them, VERGE1), or one of the 56-tile set's road records, 46/47/55 - the painter's three, which
 * a location's own streets wear too. The marching squares never write those three (terrainTiles.js's lookup), so on a
 * finished tilemap they are a road or a street and nothing else.
 * @param {Uint8Array} tilemap the pixel's finished tilemap (bits 6/7 the rotate and flip) @param {?Uint8Array} paths
 */
export function pathTileMask(tilemap, paths = null) {
  const out = new Uint8Array(tilemap.length);
  for (let i = 0; i < tilemap.length; i++) {
    const rec = tilemap[i] & 0x3f;
    out[i] = (paths && paths[i]) || rec === TILE.road || rec === TILE.roadDirt || rec === TILE.roadGrass ? 1 : 0;
  }
  return out;
}

/**
 * How far (m) a pixel-local point - x east, z north, from the pixel's south-west corner - stands from the nearest path
 * tile of its pixel (each tile the square [tx, tx + 1) x [ty, ty + 1) tiles, row 0 the south); `reach` when none comes
 * nearer, 0 on one.
 * @param {Uint8Array} mask pathTileMask's @param {number} x @param {number} z @param {number} reach (m)
 */
export function tileRoom(mask, x, z, reach) {
  if (!(reach > 0)) return Math.max(0, reach);
  const n = Math.ceil(reach / TILE_M);
  const cx = Math.floor(x / TILE_M), cz = Math.floor(z / TILE_M);
  let room = reach;
  for (let tz = Math.max(0, cz - n); tz <= Math.min(127, cz + n); tz++) {
    for (let tx = Math.max(0, cx - n); tx <= Math.min(127, cx + n); tx++) {
      if (!mask[tz * 128 + tx]) continue;
      const dx = Math.max(tx * TILE_M - x, 0, x - (tx + 1) * TILE_M);
      const dz = Math.max(tz * TILE_M - z, 0, z - (tz + 1) * TILE_M);
      const d = Math.hypot(dx, dz);
      if (d < room) room = d;
    }
  }
  return room;
}

/**
 * THE LARGEST A LOW POLY TREE MAY BE DRAWN at a root (its prototype's scale times this; the tree's own variety is
 * drawn under it): its room over its crown, never under LPT_FIT_FLOOR - Infinity where the crown is unknown (0).
 * @param {?Uint8Array} mask pathTileMask's (null - no tiles asked) @param {?object} net the roads (null - no band asked)
 * @param {number} px @param {number} py @param {number} x @param {number} z the root, pixel-local (m)
 * @param {number} crown the prototype's crown (m, at its prefab's scale) @param {number} widest the largest scale drawn
 */
export function lptFitCap(mask, net, px, py, x, z, crown, widest) {
  if (!(crown > 0)) return Infinity;
  const reach = crown * widest;
  let room = mask ? tileRoom(mask, x, z, reach) : reach;
  if (net) room = Math.min(room, roadRoom(net, px, py, x, z, reach));
  return room >= reach ? Infinity : Math.max(LPT_FIT_FLOOR, room / crown);
}
