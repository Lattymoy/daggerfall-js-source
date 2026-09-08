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
// is the SOUTH edge and row 127 the NORTH (terrainSampler.js:155-156:
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
// ROADS 23: THE PAINTER IS A PORT. With Hazelnut's permission the
// painter below is BasicRoadsTexturing.cs's PaintPath, table-driven as
// he wrote it (MIT, Copyright (C) 2020 Hazelnut): six tile slots per
// path type, his exact conditions, his paint order. The earlier
// readings-from-a-description are gone with their approximations.
//
// A tile table is indexed by the ground under the tile - water, dirt,
// grass, stone - and answers the tile to write, or NO_CHANGE. Six
// slots: cardinal inner and outer, diagonal inner, outer and gap, and
// the inside 90-degree corner. A null slot is a slot the type does not
// paint - a road has no cardinal outer, which is why it is two tiles
// wide and not four.
const NC = TILE.NO_CHANGE;
// AUDIT 51: the tables are the mod's COLUMNS TOO, water included. His
// road table paves water (46/47 in column 0) - his data never routes a
// road across it, so it never shows, but the oracle compares columns.
export const ROAD_TILES = Object.freeze([
  [46, 46, 46, 46],   // cardinal inner
  null,               // cardinal outer
  [46, 46, 46, 46],   // diagonal inner
  [47, 47, 55, 55],   // diagonal outer
  null,               // diagonal gap
  null,               // inside corner
]);
export const TRACK_TILES = Object.freeze([
  [0, NC, 11, 26], null, [0, NC, 51, 52], [0, NC, 12, 27], null, [0, NC, 10, 25],
]);
export const STREAM_TILES = Object.freeze([
  [0, 6, 21, 31], null, [0, 48, 49, 50], [0, 7, 22, 32], null, [0, 5, 20, 30],
]);
export const RIVER_TILES = Object.freeze([
  [0, 0, 0, 0], [0, 6, 21, 31], [0, 0, 0, 0], [0, 5, 20, 30], [0, 7, 22, 32], [0, 5, 20, 30],
]);
const CARD_INN = 0, CARD_OUT = 1, DIAG_INN = 2, DIAG_OUT = 3, DIAG_GAP = 4, ICORNER = 5;

const DIM = 128;
const MID_LO = 63, MID_HI = 64;

/** The corner byte for a pixel: the EAST neighbour's SW|NW bits and the
 *  WEST neighbour's NE|SE bits, exactly as the mod derives it. A
 *  diagonal leaving a neighbour brushes this pixel's corner tile. */
export function pathCorners(mask, x, y, w = 1000) {
  const east = x + 1 < w ? mask[y * w + x + 1] : 0;
  const west = x > 0 ? mask[y * w + x - 1] : 0;
  return (east & 0x5) | (west & 0x50);
}

/**
 * The port's entry. Paint order is the mod's: roads, then rivers and
 * streams if water is on, then tracks - the first that paints a tile
 * wins, because a painted tile is skipped by the next.
 * @param {object} masks - { road, track, river, stream } bytes for this pixel
 * @param {object} corners - { road, track, river, stream } corner bytes
 */
export function paintRoads(tileData, tilemap, roadMask, trackMask, locationRect = null, tdDim = 129, opts = {}) {
  const masks = { road: roadMask | 0, track: trackMask | 0, river: opts.river | 0, stream: opts.stream | 0 };
  const corners = { road: opts.corners?.road | 0, track: opts.corners?.track | 0, river: opts.corners?.river | 0, stream: opts.corners?.stream | 0 };
  const water = !!opts.water;
  const anyCorner = corners.road || corners.track || (water && (corners.river || corners.stream));
  if (!masks.road && !masks.track && !(water && (masks.river || masks.stream)) && !anyCorner) return 0;
  let painted = 0;
  for (let y = 0; y < DIM; y++) {
    for (let x = 0; x < DIM; x++) {
      const i = y * DIM + x;
      if (tilemap[i] !== 0) continue;   // a location's own tile, or already painted
      // AUDIT 51: NO RECT SKIP. The mod does not skip the location rect;
      // a location's own tiles are non-zero and stop every painter by
      // themselves, and the rect's PADDING is painted through - arms
      // cross it, and a road then fills what is left of it (below).
      let ground = tileData[y * tdDim + x];
      if (ground > TILE.stone) ground = TILE.grass;
      const ctx = { tilemap, i, x, y, ground, rect: locationRect };
      if (paintPath(ctx, ROAD_TILES, masks.road, corners.road)) { painted++; continue; }
      if (water && paintPathWithSubPathJoins(ctx, RIVER_TILES, masks.river, corners.river, masks.stream)) { painted++; continue; }
      if (water && paintPath(ctx, STREAM_TILES, masks.stream, corners.stream)) { painted++; continue; }
      if (paintPath(ctx, TRACK_TILES, masks.track, corners.track)) painted++;
    }
  }
  return painted;
}

/** PaintPathTile: write a slot's tile for this ground, with rotate and
 *  flip, unless the slot is null, the ground says NO_CHANGE, or (when
 *  overwrite is false) the tile is already painted. Water (0) is a real
 *  answer for a river and is stored as 0xff so the pipeline reads it as
 *  set - the same 0xFF the location tiles use. */
function tile(ctx, slot, rotate, flip, overwrite = true) {
  if (!slot) return false;
  if (!overwrite && ctx.tilemap[ctx.i] !== 0) return false;
  const t = slot[ctx.ground];
  if (t === NC) return false;
  // RotateFlipTile adds the bits BEFORE the zero check, so a rotated
  // water tile is 64/128/192 and only bare water becomes water_temp.
  let v = t;
  if (rotate) v += TILE.ROTATE;
  if (flip) v += TILE.FLIP;
  ctx.tilemap[ctx.i] = v === 0 ? 0xff : v;
  return true;
}

/** PaintPath, his conditions verbatim. */
function paintPath(ctx, T, m, corners) {
  const { x, y } = ctx;
  if (!m && !corners) return false;
  let has = false;
  // N-S: cardinal inner, then the cap (a DiagOut at the arm's start row)
  if ((((m & DIR.N) && (x === MID_LO || x === MID_HI) && y > MID_LO) || ((m & DIR.S) && (x === MID_LO || x === MID_HI) && y < MID_HI)) && T[CARD_INN]) {
    has = tile(ctx, T[CARD_INN], false, x === MID_HI) || has;
  }
  if ((((m & DIR.N) && (x === MID_LO || x === MID_HI) && y === MID_LO) || ((m & DIR.S) && (x === MID_LO || x === MID_HI) && y === MID_HI)) && T[DIAG_OUT]) {
    has = tile(ctx, T[DIAG_OUT], x === y, x === MID_HI, false) || has;
  }
  // E-W
  if ((((m & DIR.E) && (y === MID_LO || y === MID_HI) && x > MID_LO) || ((m & DIR.W) && (y === MID_LO || y === MID_HI) && x < MID_HI)) && T[CARD_INN]) {
    has = tile(ctx, T[CARD_INN], true, y === MID_HI) || has;
  }
  if ((((m & DIR.E) && (y === MID_LO || y === MID_HI) && x === MID_LO) || ((m & DIR.W) && (y === MID_LO || y === MID_HI) && x === MID_HI)) && T[DIAG_OUT]) {
    has = tile(ctx, T[DIAG_OUT], x === y, x === MID_HI, false) || has;
  }
  // NE-SW
  if ((((m & DIR.NE) && x === y && x > MID_LO) || ((m & DIR.SW) && x === y && x < MID_HI)) && T[DIAG_INN]) {
    has = tile(ctx, T[DIAG_INN], false, false) || has;
  }
  if ((((m & DIR.NE) && ((x === y + 1 && x > MID_LO) || (x + 1 === y && y > MID_LO))) || ((m & DIR.SW) && ((x === y + 1 && x <= MID_HI) || (x + 1 === y && y <= MID_HI)))) && T[DIAG_OUT] && !has) {
    has = tile(ctx, T[DIAG_OUT], false, x === y + 1) || has;
  }
  // NW-SE (mirrored in x)
  const xm = DIM - 1 - x;
  if ((((m & DIR.NW) && xm === y && x < MID_HI) || ((m & DIR.SE) && xm === y && x > MID_LO)) && T[DIAG_INN]) {
    has = tile(ctx, T[DIAG_INN], true, false) || has;
  }
  if ((((m & DIR.NW) && ((xm === y + 1 && x < MID_HI) || (xm + 1 === y && y > MID_LO))) || ((m & DIR.SE) && ((xm === y + 1 && x >= MID_LO) || (xm + 1 === y && y <= MID_HI)))) && T[DIAG_OUT] && !has) {
    has = tile(ctx, T[DIAG_OUT], true, xm !== y + 1) || has;
  }
  // Cardinal outer, only where nothing else painted
  if (T[CARD_OUT] && !has) {
    if (((m & DIR.N) && (x === MID_LO - 1 || x === MID_HI + 1) && y > MID_LO) || ((m & DIR.S) && (x === MID_LO - 1 || x === MID_HI + 1) && y < MID_HI)) {
      has = tile(ctx, T[CARD_OUT], false, x === MID_HI + 1, false) || has;
    }
    if (((m & DIR.E) && (y === MID_LO - 1 || y === MID_HI + 1) && x > MID_LO) || ((m & DIR.W) && (y === MID_LO - 1 || y === MID_HI + 1) && x < MID_HI)) {
      has = tile(ctx, T[CARD_OUT], true, y === MID_HI + 1) || has;
    }
  }
  // Diagonal gaps (the second ring), only where nothing else painted
  if (T[DIAG_GAP] && !has) {
    if (((m & DIR.NE) && ((x - 1 === y + 1 && x > MID_LO) || (x + 1 === y - 1 && y > MID_LO))) || ((m & DIR.SW) && ((x - 1 === y + 1 && x <= MID_HI) || (x + 1 === y - 1 && y <= MID_HI)))) {
      has = tile(ctx, T[DIAG_GAP], false, x - 1 === y + 1) || has;
    }
    if (((m & DIR.NW) && ((xm - 1 === y + 1 && x < MID_HI) || (xm + 1 === y - 1 && y > MID_LO))) || ((m & DIR.SE) && ((xm - 1 === y + 1 && x >= MID_LO) || (xm + 1 === y - 1 && y <= MID_HI)))) {
      has = tile(ctx, T[DIAG_GAP], true, xm - 1 !== y + 1) || has;
    }
  }
  // Inside 90-degree corners: overwrite the elbow
  if (T[ICORNER]) {
    const o = T[CARD_OUT] ? 1 : 0;
    if ((m & DIR.N) && (m & DIR.W) && x === MID_LO - o && y === MID_HI + o) tile(ctx, T[ICORNER], false, false);
    if ((m & DIR.N) && (m & DIR.E) && x === MID_HI + o && y === MID_HI + o) tile(ctx, T[ICORNER], true, true);
    if ((m & DIR.S) && (m & DIR.W) && x === MID_LO - o && y === MID_LO - o) tile(ctx, T[ICORNER], true, false);
    if ((m & DIR.S) && (m & DIR.E) && x === MID_HI + o && y === MID_LO - o) tile(ctx, T[ICORNER], false, true);
  }
  // "Paint roads around locations": a road pixel paves the rect's
  // padding - strictly inside the rect, roads only, whatever was left.
  // THIS is how the mod rings a town: the location's own tiles are
  // non-zero and untouched; the band between them and the rect's edge
  // becomes road.
  if (m && ctx.rect && T === ROAD_TILES && x > ctx.rect.xMin && x < ctx.rect.xMax && y > ctx.rect.yMin && y < ctx.rect.yMax) {
    ctx.tilemap[ctx.i] = 46;
    return true;
  }
  // Map pixel corners: a neighbour's diagonal brushes this pixel's corner
  if (corners && T[DIAG_OUT]) {
    if ((corners & DIR.NW) && x === DIM - 1 && y === DIM - 1) has = tile(ctx, T[DIAG_OUT], true, false) || has;
    if ((corners & DIR.SW) && x === DIM - 1 && y === 0) has = tile(ctx, T[DIAG_OUT], false, false) || has;
    if ((corners & DIR.SE) && x === 0 && y === 0) has = tile(ctx, T[DIAG_OUT], true, true) || has;
    if ((corners & DIR.NE) && x === 0 && y === DIM - 1) has = tile(ctx, T[DIAG_OUT], false, true) || has;
  }
  return has;
}

/** PaintPathWithSubPathJoins, his conditions verbatim - a river's joins
 *  with a stream, run AFTER PaintPath as his are: the map-pixel corner
 *  joins (SetPathTile(index, water): a bare 0 stored as water_temp), then
 *  the centre joins around the river's ICorner and CardOut slots - the
 *  N-S and E-W arms at the elbow and one and two tiles beyond it, and,
 *  when the path has a CardOut, the four diagonal arms meeting a
 *  cardinal or diagonal stream. None of it touches hasPath: a corner
 *  join's water does not stop the stream painter behind it, as his does
 *  not (MODS AUDIT: the port carried the corner join and the four N-S
 *  elbows, and the oracle shared the omission; the other 68 statements
 *  are ported here, and the oracle with them). The centre-join body is
 *  GENERATED from the C# by tools/roadsJoins.py, the same script that
 *  writes the oracle's - one reading of the source, not two.
 *  `m` is the river byte, `sub` the stream byte. */
function paintPathWithSubPathJoins(ctx, T, m, corners, sub) {
  const has = paintPath(ctx, T, m, corners);
  const { x, y } = ctx;
  const water = () => { ctx.tilemap[ctx.i] = 0xff; };
  const ic = (rotate, flip) => tile(ctx, T[ICORNER], rotate, flip);
  const co = (rotate, flip) => tile(ctx, T[CARD_OUT], rotate, flip);
  // Paint map pixel corner joins
  if (corners) {
    if (((corners & DIR.NW) && (sub & DIR.NE) && x === DIM - 1 && y === DIM - 1)
      || ((corners & DIR.SW) && (sub & DIR.SE) && x === DIM - 1 && y === 0)
      || ((corners & DIR.SE) && (sub & DIR.SW) && x === 0 && y === 0)
      || ((corners & DIR.NE) && (sub & DIR.NW) && x === 0 && y === DIM - 1)) water();
  }
  // Paint map pixel centre joins
  if (sub && T[ICORNER]) {
    const o = T[CARD_OUT] ? 1 : 0;
    // N-S path
    if ((m & DIR.N) && (sub & DIR.W) && x === MID_LO - o && y === MID_HI && !(m & DIR.W)) ic(false, false);
    if ((m & DIR.N) && (sub & DIR.E) && x === MID_HI + o && y === MID_HI && !(m & DIR.E)) ic(true, true);
    if ((m & DIR.S) && (sub & DIR.W) && x === MID_LO - o && y === MID_LO && !(m & DIR.W)) ic(true, false);
    if ((m & DIR.S) && (sub & DIR.E) && x === MID_HI + o && y === MID_LO && !(m & DIR.E)) ic(false, true);

    if ((m & DIR.N) && (sub & DIR.NW) && x === MID_LO - o && y === MID_HI + 1 && !(m & DIR.W)) ic(true, false);
    if ((m & DIR.N) && (sub & DIR.NW) && x === MID_LO - o && y === MID_HI + 2) ic(false, false);
    if ((m & DIR.N) && (sub & DIR.NE) && x === MID_HI + o && y === MID_HI + 1 && !(m & DIR.E)) ic(false, true);
    if ((m & DIR.N) && (sub & DIR.NE) && x === MID_HI + o && y === MID_HI + 2) ic(true, true);

    if ((m & DIR.S) && (sub & DIR.SW) && x === MID_LO - o && y === MID_LO - 1 && !(m & DIR.W)) ic(false, false);
    if ((m & DIR.S) && (sub & DIR.SW) && x === MID_LO - o && y === MID_LO - 2) ic(true, false);
    if ((m & DIR.S) && (sub & DIR.SE) && x === MID_HI + o && y === MID_LO - 1 && !(m & DIR.E)) ic(true, true);
    if ((m & DIR.S) && (sub & DIR.SE) && x === MID_HI + o && y === MID_LO - 2) ic(false, true);

    // E-W path
    if ((m & DIR.W) && (sub & DIR.N) && x === MID_LO && y === MID_HI + o && !(m & DIR.N)) ic(false, false);
    if ((m & DIR.E) && (sub & DIR.N) && x === MID_HI && y === MID_HI + o && !(m & DIR.N)) ic(true, true);
    if ((m & DIR.W) && (sub & DIR.S) && x === MID_LO && y === MID_LO - o && !(m & DIR.S)) ic(true, false);
    if ((m & DIR.E) && (sub & DIR.S) && x === MID_HI && y === MID_LO - o && !(m & DIR.S)) ic(false, true);

    if ((m & DIR.E) && (sub & DIR.NE) && x === MID_HI + 1 && y === MID_HI + o && !(m & DIR.N)) ic(false, false);
    if ((m & DIR.E) && (sub & DIR.NE) && x === MID_HI + 2 && y === MID_HI + o) ic(true, true);
    if ((m & DIR.E) && (sub & DIR.SE) && x === MID_HI + 1 && y === MID_LO - o && !(m & DIR.S)) ic(true, false);
    if ((m & DIR.E) && (sub & DIR.SE) && x === MID_HI + 2 && y === MID_LO - o) ic(false, true);

    if ((m & DIR.W) && (sub & DIR.NW) && x === MID_LO - 1 && y === MID_HI + o && !(m & DIR.N)) ic(true, true);
    if ((m & DIR.W) && (sub & DIR.NW) && x === MID_LO - 2 && y === MID_HI + o) ic(false, false);
    if ((m & DIR.W) && (sub & DIR.SW) && x === MID_LO - 1 && y === MID_LO - o && !(m & DIR.S)) ic(false, true);
    if ((m & DIR.W) && (sub & DIR.SW) && x === MID_LO - 2 && y === MID_LO - o) ic(true, false);

    if (T[CARD_OUT]) {
      // NE-SW path
      if ((m & DIR.NE) && (sub & DIR.SE) && x === MID_HI && y === MID_LO && !(m & DIR.SE)) water();
      if ((m & DIR.NE) && (sub & DIR.SE) && x === MID_HI + o && y === MID_LO && !(m & DIR.SE)) {
        if (!(m & DIR.E) && (sub & DIR.E)) {
          ic(false, true);
        } else {
          co(false, true);
        }
      } else if ((m & DIR.NE) && (sub & DIR.E) && x === MID_HI + 1 && y === MID_LO) co(true, false);

      if ((m & DIR.NE) && (sub & DIR.E) && x === MID_HI + 1 && y === MID_HI) water();
      if ((m & DIR.NE) && (sub & DIR.E) && x === MID_HI + 2 && y === MID_HI) ic(true, true);

      if ((m & DIR.SW) && (sub & DIR.SE) && x === MID_HI && y === MID_LO && !(m & DIR.SE)) water();
      if ((m & DIR.SW) && (sub & DIR.SE) && x === MID_HI && y === MID_LO - o && !(m & DIR.SE)) {
        if (!(m & DIR.S) && (sub & DIR.S)) {
          ic(false, true);
        } else {
          co(true, false);
        }
      } else if ((m & DIR.SW) && (sub & DIR.S) && x === MID_HI && y === MID_LO - 1) co(false, true);

      if ((m & DIR.SW) && (sub & DIR.S) && x === MID_LO && y === MID_LO - 1) water();
      if ((m & DIR.SW) && (sub & DIR.S) && x === MID_LO && y === MID_LO - 2) ic(true, false);


      if ((m & DIR.NE) && (sub & DIR.NW) && x === MID_LO && y === MID_HI && !(m & DIR.NW)) water();
      if ((m & DIR.NE) && (sub & DIR.NW) && x === MID_LO && y === MID_HI + o && !(m & DIR.NW)) {
        if (!(m & DIR.N) && (sub & DIR.N)) {
          ic(false, false);
        } else {
          co(true, true);
        }
      } else if ((m & DIR.NE) && (sub & DIR.N) && x === MID_LO && y === MID_HI + 1) co(false, false);

      if ((m & DIR.NE) && (sub & DIR.N) && x === MID_HI && y === MID_HI + 1) water();
      if ((m & DIR.NE) && (sub & DIR.N) && x === MID_HI && y === MID_HI + 2) ic(true, true);

      if ((m & DIR.SW) && (sub & DIR.NW) && x === MID_LO && y === MID_HI && !(m & DIR.SE)) water();
      if ((m & DIR.SW) && (sub & DIR.NW) && x === MID_LO - o && y === MID_HI && !(m & DIR.SE)) {
        if (!(m & DIR.W) && (sub & DIR.W)) {
          ic(false, false);
        } else {
          co(false, false);
        }
      } else if ((m & DIR.SW) && (sub & DIR.W) && x === MID_LO - 1 && y === MID_HI) co(true, true);

      if ((m & DIR.SW) && (sub & DIR.W) && x === MID_LO - 1 && y === MID_LO) water();
      if ((m & DIR.SW) && (sub & DIR.W) && x === MID_LO - 2 && y === MID_LO) ic(true, false);


      // NW-SE path
      if ((m & DIR.NW) && (sub & DIR.SW) && x === MID_LO && y === MID_LO && !(m & DIR.SW)) water();
      if ((m & DIR.NW) && (sub & DIR.SW) && x === MID_LO - o && y === MID_LO && !(m & DIR.SW)) {
        if (!(m & DIR.E) && (sub & DIR.W)) {
          ic(true, false);
        } else {
          co(false, false);
        }
      } else if ((m & DIR.NW) && (sub & DIR.W) && x === MID_LO - 1 && y === MID_LO) co(true, false);

      if ((m & DIR.NW) && (sub & DIR.W) && x === MID_LO - 1 && y === MID_HI) water();
      if ((m & DIR.NW) && (sub & DIR.W) && x === MID_LO - 2 && y === MID_HI) ic(false, false);

      if ((m & DIR.SE) && (sub & DIR.SW) && x === MID_LO && y === MID_LO && !(m & DIR.SW)) water();
      if ((m & DIR.SE) && (sub & DIR.SW) && x === MID_LO && y === MID_LO - o && !(m & DIR.SW)) {
        if (!(m & DIR.S) && (sub & DIR.S)) {
          ic(true, false);
        } else {
          co(true, false);
        }
      } else if ((m & DIR.SE) && (sub & DIR.S) && x === MID_LO && y === MID_LO - 1) co(false, false);

      if ((m & DIR.SE) && (sub & DIR.S) && x === MID_HI && y === MID_LO - 1) water();
      if ((m & DIR.SE) && (sub & DIR.S) && x === MID_HI && y === MID_LO - 2) ic(false, true);


      if ((m & DIR.NW) && (sub & DIR.NE) && x === MID_HI && y === MID_HI && !(m & DIR.NE)) water();
      if ((m & DIR.NW) && (sub & DIR.NE) && x === MID_HI && y === MID_HI + o && !(m & DIR.NE)) {
        if (!(m & DIR.N) && (sub & DIR.N)) {
          ic(true, true);
        } else {
          co(true, true);
        }
      } else if ((m & DIR.NW) && (sub & DIR.N) && x === MID_HI && y === MID_HI + 1) co(false, true);

      if ((m & DIR.NW) && (sub & DIR.N) && x === MID_LO && y === MID_HI + 1) water();
      if ((m & DIR.NW) && (sub & DIR.N) && x === MID_LO && y === MID_HI + 2) ic(false, false);

      if ((m & DIR.SE) && (sub & DIR.NE) && x === MID_HI && y === MID_HI && !(m & DIR.NE)) water();
      if ((m & DIR.SE) && (sub & DIR.NE) && x === MID_HI + o && y === MID_HI && !(m & DIR.NE)) {
        if (!(m & DIR.E) && (sub & DIR.E)) {
          ic(true, true);
        } else {
          co(false, true);
        }
      } else if ((m & DIR.SE) && (sub & DIR.E) && x === MID_HI + 1 && y === MID_HI) co(true, true);

      if ((m & DIR.SE) && (sub & DIR.E) && x === MID_HI + 1 && y === MID_LO) water();
      if ((m & DIR.SE) && (sub & DIR.E) && x === MID_HI + 2 && y === MID_LO) ic(false, true);
    }
  }
  return has;
}

/** Kept for the pins that read it: which slot a tile falls in. */
export function classify(x, y, mask) {
  const t = new Uint8Array(DIM * DIM);
  const ctx = { tilemap: t, i: y * DIM + x, x, y, ground: TILE.grass };
  const has = paintPath(ctx, ROAD_TILES, mask, 0);
  if (!has) return null;
  const v = t[ctx.i];
  return { centre: (v & 0x3f) === 46, rotate: !!(v & TILE.ROTATE), flip: !!(v & TILE.FLIP), diag: false };
}

/** AUDIT 51: THE SMOOTHER IS THE MOD'S. SmoothRoadsJob, ported: for
 *  every tile that is road (46) or water_temp (0xff) - NOT edges, NOT
 *  tracks - the tile's four corner samples each take the five-point
 *  mean of themselves and their four orthogonal neighbours, IN PLACE
 *  and in scan order (so later corners read earlier results, as his
 *  does), over x,y in [1, hDim-3], skipping the location rect by
 *  Unity's Rect.Contains - min inclusive, MAX EXCLUSIVE (MODS AUDIT:
 *  the skip here was max-inclusive, one column and one row wider than
 *  his; the painter's ring test below has always been exclusive).
 *
 *  NO DIVERGENCE. This kernel joins TWO layouts, both DFU's: the
 *  TILEMAP is JobA.Idx(x, y, tDim) = x + y*tDim (TerrainHelper.cs:170,
 *  with JobHelpers.cs:19-22 Idx(r, c, dim) = r + c*dim) and the
 *  HEIGHTMAP is JobA.Idx(y, x, hDim) = y + x*hDim (TerrainSampler
 *  .cs:123) - which is what terrainSampler.js:144 writes and what every
 *  consumer in this tree reads (terrainTiles.js:146 and :317,
 *  terrainSurface.js:105-106, terrainNature.js:68 and :136). The mod
 *  reads its tile at Idx(x, y, tDim) and its corner base at
 *  Idx(y, x, hDim) - BOTH in the layout that owns them - and so does
 *  this: the tile at y*tDim + x, the base at x*hDim + y. Byte for byte
 *  his.
 *
 *  THE RECORD WAS WRONG TWICE, and MODS AUDIT (2026-09-08) closes it.
 *  AUDIT 51 wrote that the mod's base was "the transpose" and the port
 *  corrected it on the tile read; AUDIT 58 found the port's base was
 *  itself transposed (y*hDim + x - every road bed unsmoothed and a
 *  mirrored strip blurred in both lanes), fixed it to x*hDim + y, and
 *  kept the story that the mod diverges and the port corrects it. It
 *  does not: Idx(y, x, hDim) IS y + x*hDim IS x*hDim + y. AUDIT 58's
 *  fix made the port match the mod; there was never a departure to
 *  record, and the one on record here for six days was a false entry.
 *
 * @param {Float32Array} samples - 129x129 corner heights in the SAMPLER's
 *   layout, sample(x, y) = samples[x * hDim + y] (terrainSampler.js:144);
 *   mutated in place.
 * @param {Uint8Array} tilemap - 128x128 after the painter, tile(x, y) =
 *   tilemap[y * tDim + x] (terrainTiles.js:263). The two differ.
 * @returns {number} corner samples smoothed (with repeats, as his counts).
 */
export const SMOOTHED_TILES = Object.freeze(new Set([46, 0xff]));
export function smoothRoadHeights(samples, tilemap, hDim = 129, rect = null) {
  const tDim = hDim - 1;
  let n = 0;
  const smooth = (idx) => {
    samples[idx] = (samples[idx] + samples[idx + hDim] + samples[idx + 1] + samples[idx - hDim] + samples[idx - 1]) / 5;
    n++;
  };
  for (let y = 1; y < hDim - 2; y++) {
    for (let x = 1; x < hDim - 2; x++) {
      if (rect && x >= rect.xMin && x < rect.xMax && y >= rect.yMin && y < rect.yMax) continue;   // Rect.Contains: min in, max OUT
      const tile = tilemap[y * tDim + x];
      if (tile !== 46 && tile !== 0xff) continue;
      const idx = x * hDim + y;   // TerrainSampler.cs:123 JobA.Idx(y, x, hDim) - the HEIGHTMAP's layout, not the tilemap's
      smooth(idx); smooth(idx + 1); smooth(idx + hDim); smooth(idx + hDim + 1);
    }
  }
  return n;
}
