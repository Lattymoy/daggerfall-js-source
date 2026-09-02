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
// ROADS 20: THE TABLES ARE THE MOD'S, read from its own painter. A
// cardinal road is two tiles of 46 with no edge column; 47/55 are the
// diagonal's flanks. A track's diagonal inner is 51/52, not the
// cardinal's 11/26; a track's inside 90-degree corner takes 10/25 where
// a road takes nothing.
const ROAD_CENTRE = [TILE.NO_CHANGE, TILE.road, TILE.road, TILE.road];
const ROAD_DIAG_EDGE = [TILE.NO_CHANGE, TILE.roadDirt, TILE.roadGrass, TILE.roadGrass];
// A track is worn ground: dirt shows through grass, and it leaves stone
// and dirt alone because a dirt track on dirt is invisible anyway.
const TRACK_CENTRE = [TILE.NO_CHANGE, TILE.NO_CHANGE, 11, 26];
const TRACK_DIAG_CENTRE = [TILE.NO_CHANGE, TILE.NO_CHANGE, 51, 52];
const TRACK_DIAG_EDGE = [TILE.NO_CHANGE, TILE.NO_CHANGE, 12, 27];
const TRACK_ICORNER = [TILE.NO_CHANGE, TILE.NO_CHANGE, 10, 25];

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
      if (r) { if (write(tilemap, i, r, ROAD_CENTRE, ROAD_CENTRE, ROAD_DIAG_EDGE, ground)) painted++; continue; }
      // ROADS 20: a track's inside 90-degree corner (the mod's ICorner)
      // decided BEFORE the arm, because with no cardinal outer the
      // elbow tile IS the arm's centre and the mod overwrites it. Roads
      // have no corner tile and fall through to the arm.
      const ic = trackMask ? iCorner(x, y, trackMask) : null;
      if (ic) { const tile = TRACK_ICORNER[ground]; if (tile !== TILE.NO_CHANGE) { tilemap[i] = tile + (ic.rotate ? TILE.ROTATE : 0) + (ic.flip ? TILE.FLIP : 0); painted++; continue; } }
      const t = trackMask ? classify(x, y, trackMask) : null;
      if (t && write(tilemap, i, t, TRACK_CENTRE, TRACK_DIAG_CENTRE, TRACK_DIAG_EDGE, ground)) painted++;
    }
  }
  // ROADS 5: the ring AFTER the arms, so an arm crossing the ring's edge
  // annulus keeps its road surface and the ring fills in around it.
  if (locationRect) {
    painted += roadMask
      ? paintRing(tileData, tilemap, locationRect, ROAD_CENTRE, ROAD_DIAG_EDGE, tdDim)
      : paintRing(tileData, tilemap, locationRect, TRACK_CENTRE, TRACK_DIAG_EDGE, tdDim);
  }
  return painted;
}

// ROADS 5: THE RECT IS setLocationTiles' OWN SHAPE - inclusive
// {xMin, xMax, yMin, yMax} in tile space, already carrying the 2-3 tile
// clearance the terrain blends around a town. The first draft read
// {x, y, w, h}, which the seam never sends, so every test was
// `undefined >= x` and the guard was dead - the pre-seeded location
// tiles were the only thing keeping roads out of the streets, and
// nothing kept them out of the CLEARANCE band. Found by writing the
// ring, which had to know where the town ends.
function inRect(x, y, r) { return x >= r.xMin && x <= r.xMax && y >= r.yMin && y <= r.yMax; }

/** ROADS 5: THE RING ROAD. The original's roads circle a location
 *  because they never line up with its gates, and ours stop at the
 *  clearance edge for the same reason. So a pixel that carries a
 *  location AND a road paints a two-tile ring just outside the rect,
 *  with an edge tile beyond it, and every arm that reaches the town
 *  joins the ring instead of ending in a field. A track-only pixel
 *  rings in track. Clamped to the tile grid: a city whose clearance
 *  reaches the pixel edge rings on the sides that fit. */
function paintRing(tileData, tilemap, r, centreTable, edgeTable, tdDim) {
  let n = 0;
  const band = (x0, x1, y0, y1, table, isCentre) => {
    for (let y = Math.max(0, y0); y <= Math.min(DIM - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(DIM - 1, x1); x++) {
        if (inRect(x, y, r)) continue;
        const i = y * DIM + x;
        if (tilemap[i] !== 0) continue;
        let ground = tileData[y * tdDim + x];
        if (ground > TILE.stone) ground = TILE.grass;
        // the ring's rotate follows the side it runs along; flip is the outer half
        const onEW = y < r.yMin || y > r.yMax;
        const outer = isCentre ? (x === x0 || x === x1 || y === y0 || y === y1) : false;
        if (write(tilemap, i, { centre: isCentre, rotate: onEW, flip: outer }, centreTable, centreTable, edgeTable, ground)) n++;
      }
    }
  };
  // The two-tile centre band FIRST, then the edge pass over the 3-deep
  // annulus - the loop skips painted tiles, so the edge pass only finds
  // the outermost ring left. The first draft had them the other way
  // round and the edge filled everything before the centre arrived.
  band(r.xMin - 2, r.xMax + 2, r.yMin - 2, r.yMax + 2, centreTable, true);
  band(r.xMin - 3, r.xMax + 3, r.yMin - 3, r.yMax + 3, edgeTable, false);
  return n;
}

function iCorner(x, y, mask) {
  if ((mask & DIR.N) && (mask & DIR.W) && x === MID_LO && y === MID_HI) return { rotate: false, flip: false };
  if ((mask & DIR.N) && (mask & DIR.E) && x === MID_HI && y === MID_HI) return { rotate: true, flip: true };
  if ((mask & DIR.S) && (mask & DIR.W) && x === MID_LO && y === MID_LO) return { rotate: true, flip: false };
  if ((mask & DIR.S) && (mask & DIR.E) && x === MID_HI && y === MID_LO) return { rotate: false, flip: true };
  return null;
}

function write(tilemap, i, c, centreTable, diagCentreTable, edgeTable, ground) {
  const tile = (c.centre ? (c.diag ? diagCentreTable : centreTable) : edgeTable)[ground];
  if (tile === TILE.NO_CHANGE) return false;
  let v = tile;
  if (c.rotate) v += TILE.ROTATE;
  if (c.flip) v += TILE.FLIP;
  // ROADS 11 (Audit 45 F8): no table here holds tile 0 - water is never
  // paved - so v is never 0 and the guard that used to map it to 0xff
  // was unreachable. Removed rather than kept as a mystery.
  tilemap[i] = v;
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
  const arm = (centre, rotate, flip, diag = false) => ({ centre, rotate, flip, diag });
  // AUDIT 45 F4: A DEAD-END ARM GETS A CAP. An arm that arrives alone -
  // N set, S not - would end square on the centre row; the tile just
  // past the centre on the FAR side takes the edge tile instead, so the
  // road rounds off where it stops rather than being cut with a knife.
  // Only when the opposite arm is absent, because with both present the
  // road runs straight through and there is nothing to cap.
  // It is decided LAST - see the bottom - because at a junction the cap
  // position of one arm is the centre of another, and the centre wins.
  // N: rows above the middle; S: rows below. Centre columns 63/64.
  // ROADS 20 (Mac: "ensure road width matches what the mod has"): TWO
  // TILES AND NOTHING BESIDE THEM. The mod's cardinal-outer entry is
  // null for roads and tracks alike; the edge tiles 47/55 flank the
  // DIAGONAL only. The first draft painted an edge column each side of
  // every cardinal arm - four tiles across where his are two.
  if (mask & DIR.N && y >= MID_HI && (x === MID_LO || x === MID_HI)) return arm(true, false, x === MID_HI);
  if (mask & DIR.S && y <= MID_LO && (x === MID_LO || x === MID_HI)) return arm(true, false, x === MID_HI);
  if (mask & DIR.E && x >= MID_HI && (y === MID_LO || y === MID_HI)) return arm(true, true, y === MID_HI);
  if (mask & DIR.W && x <= MID_LO && (y === MID_LO || y === MID_HI)) return arm(true, true, y === MID_HI);
  // NE runs up-right: x == y, above the middle. SW: the same line, below.
  const onNESW = x === y, nearNESW = Math.abs(x - y) === 1;
  if (mask & DIR.NE && x >= MID_HI) { if (onNESW) return arm(true, false, false, true); if (nearNESW) edge = edge || arm(false, false, x > y); }
  if (mask & DIR.SW && x <= MID_LO) { if (onNESW) return arm(true, false, false, true); if (nearNESW) edge = edge || arm(false, false, x > y); }
  // NW runs up-left: x + y == 127.
  const xm = 127 - x;
  const onNWSE = xm === y, nearNWSE = Math.abs(xm - y) === 1;
  if (mask & DIR.NW && x <= MID_LO) { if (onNWSE) return arm(true, true, false, true); if (nearNWSE) edge = edge || arm(false, true, xm < y); }
  if (mask & DIR.SE && x >= MID_HI) { if (onNWSE) return arm(true, true, false, true); if (nearNWSE) edge = edge || arm(false, true, xm < y); }
  // The cap, now that no arm has claimed this tile as its centre.
  const capN = (mask & DIR.N) && !(mask & DIR.S), capS = (mask & DIR.S) && !(mask & DIR.N);
  const capE = (mask & DIR.E) && !(mask & DIR.W), capW = (mask & DIR.W) && !(mask & DIR.E);
  // ROADS 9: the cap's ORIENTATION is the design's, not a guess. The
  // edge tile turns when x == y and mirrors when x == midHi, the same
  // expression for all four arms - tuned against the real tile art and
  // seen in the field, which no fixture here can be. A first draft used
  // a symmetric flip and would have oriented one of every cap's two
  // tiles wrong on the art it cannot see.
  if ((x === MID_LO || x === MID_HI) && ((capN && y === MID_LO) || (capS && y === MID_HI))) return arm(false, x === y, x === MID_HI);
  if ((y === MID_LO || y === MID_HI) && ((capE && x === MID_LO) || (capW && x === MID_HI))) return arm(false, x === y, x === MID_HI);
  return edge;
}

/** ROADS 10: the tile indices a road or track leaves in the tilemap,
 *  masked of their rotate/flip bits. The smoother reads these back. */
export const PATH_TILES = Object.freeze(new Set([TILE.road, TILE.roadDirt, TILE.roadGrass, 11, 12, 26, 27, 51, 52, 10, 25]));

/**
 * ROADS 10 (Audit 45's item 7): SMOOTH THE GROUND UNDER THE ROAD. The
 * heightmap carries terrain noise a cart would never tolerate, and a
 * road painted over it bumps with every sample. The design's own
 * smoother is rudimentary by its author's description - it looks for
 * road tiles and blurs the heights under them - and that is what this
 * is: every corner sample touched by a path tile takes the mean of its
 * 3x3 neighbourhood, read from the ORIGINAL heights so the blur is one
 * pass and order-independent. Nothing off a path tile moves, which is
 * what keeps the terrain around a road the terrain.
 *
 * @param {Float32Array} samples - 129x129 corner heights, row-major; mutated.
 * @param {Uint8Array} tilemap - 128x128 after the painter.
 * @returns {number} corners smoothed.
 */
export function smoothRoadHeights(samples, tilemap, hDim = 129) {
  const tDim = hDim - 1;
  const mark = new Uint8Array(hDim * hDim);
  let any = 0;
  for (let y = 0; y < tDim; y++) {
    for (let x = 0; x < tDim; x++) {
      if (!PATH_TILES.has(tilemap[y * tDim + x] & 0x3f)) continue;
      mark[y * hDim + x] = mark[y * hDim + x + 1] = mark[(y + 1) * hDim + x] = mark[(y + 1) * hDim + x + 1] = 1;
      any = 1;
    }
  }
  if (!any) return 0;
  const src = Float32Array.from(samples);
  let n = 0;
  for (let y = 0; y < hDim; y++) {
    for (let x = 0; x < hDim; x++) {
      if (!mark[y * hDim + x]) continue;
      let sum = 0; let cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= hDim) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= hDim) continue;
          sum += src[yy * hDim + xx]; cnt++;
        }
      }
      samples[y * hDim + x] = sum / cnt;
      n++;
    }
  }
  return n;
}
