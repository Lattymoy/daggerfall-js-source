// ROADS 2: THE PAINTER. Runs at the one seam in the terrain pipeline
// where a road can go: after generateTileData has classified the ground
// (water/dirt/grass/stone) and BEFORE assignTiles runs its marching
// squares, so a road tile is written over a KNOWN ground type and the
// squares then blend the ground around it. That seam is DFU's own and
// it is where Hazelnut's Basic Roads paints too; the design is credited
// in roadNetwork.js. The code here is written from the design, not
// ported from it: the geometry of a two-tile road down the centre of a
// 128-grid is the geometry, whoever writes it.
//
// THE GRID. Map Y runs south, and inside a pixel's 128x128 tilemap row 0
// is the SOUTH edge and row 127 the NORTH (terrainSampler.js:150-151:
// "y=0 of py equals y=128 of py+1"). So the N bit paints from the
// centre UP in y, S paints down, E right, W left. Diagonals follow.
//
// THE TILES. Classic's 56-tile terrain set carries the road: 46 is the
// road surface, 47 its dirt edge, 55 its grass edge. Tracks take a
// dirt-on-ground tile chosen by what is underneath. The enhanced skin's
// own road SURFACE is a separate slice; this module only decides WHICH
// tile index sits where, which is the same job in both skins.
//
// LOCATIONS are left alone: their tiles are pre-seeded by
// setLocationTiles and a road that ran into a town's own tilemap would
// paint over its streets. So a road stops at the location rect - it
// reaches the town's edge, which is what a road does.

import { DIR } from './roadNetwork.js';

export const TILE = Object.freeze({
  water: 0, dirt: 1, grass: 2, stone: 3,
  road: 46, roadDirt: 47, roadGrass: 55,
  NO_CHANGE: 99,
  ROTATE: 64, FLIP: 128,
});

/** Indexed by the ground type under the tile: [water, dirt, grass, stone]
 *  -> the tile to write, or NO_CHANGE. Water is never paved: a road
 *  bit over water is a routing bug and this refuses to hide it. */
const ROAD_CENTRE = [TILE.NO_CHANGE, TILE.road, TILE.road, TILE.road];
const ROAD_EDGE = [TILE.NO_CHANGE, TILE.roadDirt, TILE.roadGrass, TILE.roadGrass];
// A track is worn ground: dirt shows through grass, and it leaves stone
// and dirt alone because a dirt track on dirt is invisible anyway.
const TRACK_CENTRE = [TILE.NO_CHANGE, TILE.NO_CHANGE, 11, 26];
const TRACK_EDGE = [TILE.NO_CHANGE, TILE.NO_CHANGE, 12, 27];

const DIM = 128;
const MID_LO = 63, MID_HI = 64;

/**
 * @param {Uint8Array} tileData - generateTileData's 129x129 corner grid.
 * @param {Uint8Array} tilemap - 128x128, row-major (y*128+x); mutated.
 * @param {number} roadMask - the pixel's road byte.
 * @param {number} trackMask - the pixel's track byte.
 * @param {?{x:number,y:number,w:number,h:number}} locationRect - tiles to leave alone.
 * @returns {number} tiles painted.
 */
export function paintRoads(tileData, tilemap, roadMask, trackMask, locationRect = null, tdDim = 129) {
  if (!roadMask && !trackMask) return 0;
  let painted = 0;
  for (let y = 0; y < DIM; y++) {
    for (let x = 0; x < DIM; x++) {
      const i = y * DIM + x;
      if (tilemap[i] !== 0) continue;   // a location's own tile, or already painted
      if (locationRect && inRect(x, y, locationRect)) continue;
      let ground = tileData[y * tdDim + x];
      if (ground > TILE.stone) ground = TILE.grass;
      const r = roadMask ? classify(x, y, roadMask) : null;
      if (r) { if (write(tilemap, i, r, ROAD_CENTRE, ROAD_EDGE, ground)) painted++; continue; }
      const t = trackMask ? classify(x, y, trackMask) : null;
      if (t && write(tilemap, i, t, TRACK_CENTRE, TRACK_EDGE, ground)) painted++;
    }
  }
  return painted;
}

function inRect(x, y, r) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; }

function write(tilemap, i, c, centreTable, edgeTable, ground) {
  const tile = (c.centre ? centreTable : edgeTable)[ground];
  if (tile === TILE.NO_CHANGE) return false;
  let v = tile;
  if (c.rotate) v += TILE.ROTATE;
  if (c.flip) v += TILE.FLIP;
  // 0 is "unset" to the pipeline; water is never the answer here anyway.
  tilemap[i] = v === 0 ? 0xff : v;
  return true;
}

/**
 * Is tile (x, y) on a path leaving through one of `mask`'s edges, and is
 * it the road's centre or its edge? Cardinals are two tiles wide on the
 * centre columns/rows (63, 64) from the middle to the edge, with an edge
 * tile either side; diagonals are one tile wide on the diagonal itself
 * with an edge tile on each flank. A tile that is the centre of ANY
 * arm wins, so junctions read as one surface.
 */
export function classify(x, y, mask) {
  let edge = null;
  const arm = (centre, rotate, flip) => ({ centre, rotate, flip });
  // N: rows above the middle; S: rows below. Centre columns 63/64.
  if (mask & DIR.N && y >= MID_HI) {
    if (x === MID_LO || x === MID_HI) return arm(true, false, x === MID_HI);
    if (x === MID_LO - 1 || x === MID_HI + 1) edge = edge || arm(false, false, x === MID_HI + 1);
  }
  if (mask & DIR.S && y <= MID_LO) {
    if (x === MID_LO || x === MID_HI) return arm(true, false, x === MID_HI);
    if (x === MID_LO - 1 || x === MID_HI + 1) edge = edge || arm(false, false, x === MID_HI + 1);
  }
  if (mask & DIR.E && x >= MID_HI) {
    if (y === MID_LO || y === MID_HI) return arm(true, true, y === MID_HI);
    if (y === MID_LO - 1 || y === MID_HI + 1) edge = edge || arm(false, true, y === MID_HI + 1);
  }
  if (mask & DIR.W && x <= MID_LO) {
    if (y === MID_LO || y === MID_HI) return arm(true, true, y === MID_HI);
    if (y === MID_LO - 1 || y === MID_HI + 1) edge = edge || arm(false, true, y === MID_HI + 1);
  }
  // NE runs up-right: x == y, above the middle. SW: the same line, below.
  const onNESW = x === y, nearNESW = Math.abs(x - y) === 1;
  if (mask & DIR.NE && x >= MID_HI) { if (onNESW) return arm(true, false, false); if (nearNESW) edge = edge || arm(false, false, x > y); }
  if (mask & DIR.SW && x <= MID_LO) { if (onNESW) return arm(true, false, false); if (nearNESW) edge = edge || arm(false, false, x > y); }
  // NW runs up-left: x + y == 127.
  const xm = 127 - x;
  const onNWSE = xm === y, nearNWSE = Math.abs(xm - y) === 1;
  if (mask & DIR.NW && x <= MID_LO) { if (onNWSE) return arm(true, true, false); if (nearNWSE) edge = edge || arm(false, true, xm < y); }
  if (mask & DIR.SE && x >= MID_HI) { if (onNWSE) return arm(true, true, false); if (nearNWSE) edge = edge || arm(false, true, xm < y); }
  return edge;
}
