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
// track. The road is the band Basic Roads paints (world/road/roadPainter.js):
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

import { MP_WORLD_UNITS } from './pathData.js';
import { UNITS_PER_METRE } from './roadClearance.js';
import { roadRoom } from './roadBand.js';
import { LPT_CROWNS } from '../lptCrowns.js';
import { lptVariety } from '../lowPolyTrees.js';
import { getNatureArchive, SEASON } from '../climateSwaps.js';
import { TILE } from './roadPainter.js';

/** A map pixel (m). */
const PIXEL_M = MP_WORLD_UNITS / UNITS_PER_METRE;
// JUNGLE-ROADSIDE: the band itself - its half width, its arms and the room beside it - lives in world/road/roadBand.js,
// one home the terrain worker reaches too (it stands the jungle's roadside pairs off it)
export { PATH_HALF_M, ARMS, roadRoom } from './roadBand.js';

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

/**
 * FB1020c TRUNK-FIT (a player's report, 2026-10-20: "Fountain inside a tree in Crossleigh behind a house west of The
 * Emperor's Gear Store"): THE TRUNK FITS ITS ROOM TOO. LPT-FIT keeps a Low Poly tree's crown off the roads and streets;
 * nothing kept its TRUNK off the town's own things. A location's block stands its ground scenery on a 6.4 m grid that
 * reads none of its misc flats (RMBLayout.AddNatureFlats), so Daggerfall's authors set pictures a metre or two from a
 * fountain or a crate - Crossleigh's GENRAS01 stands TEXTURE.504's tree 12 1.58 m from its fountain (212, 2) - and Low
 * Poly Trees stands that tree's trunk 3.42 m about its root where it meets the ground: the fountain inside it. So a
 * location's Low Poly tree is drawn no wider than the room its root has to the nearest SOLID flat of its pixel - a body
 * (world/propBodies.js flatBody: a fountain, a well, a crate, a statue, its own measured foot) - over its trunk
 * (world/lptCrowns.js LPT_TRUNKS). A scale, never a move, as LPT-FIT's: the root, its collider, Logging's tree and its
 * cover stand where DFU stands the flat. A departure from DFU with Low Poly Trees (MeshReplacement.cs
 * ImportCustomFlatGameobject stands the prefab whole) - Port-Ledger A, TRUNK-FIT.
 * @param {ReadonlyArray<{c: ArrayLike<number>, r: number}>|null} solids the pixel's solid bodies, pixel-local (`c` x, y, z)
 * @param {number} x @param {number} z the root, pixel-local (m)
 * @param {number} trunk the prototype's trunk at the ground (m, at its prefab's scale) @param {number} widest the largest scale drawn
 */
export function lptTrunkCap(solids, x, z, trunk, widest) {
  if (!(trunk > 0) || !solids?.length) return Infinity;
  let room = Infinity;
  for (const s of solids) room = Math.min(room, Math.hypot(s.c[0] - x, s.c[2] - z) - s.r);
  return room >= trunk * widest ? Infinity : Math.max(LPT_FIT_FLOOR, room / trunk);
}
