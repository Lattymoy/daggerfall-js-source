// @ts-check
// ═══════════════════════════════════════════════════════════════════
// VOYAGER2 (2026-10-26, KPbICA's spec forwarded by the owner: "Add slight curvatures for intersections and turns of the
// roads to make them more natural"; bible/03-World/Roads.md VOYAGER2) - THE ROADS PAST THE BAY ARE DRAWN AS CURVES.
//
// A road's or a track's way through a map pixel is its compass byte (ROADS 1's layout, world/road/roadNetwork.js DIR):
// the edges or corners it leaves by. Basic Roads draws each bit as a straight band from the pixel's centre out to its
// edge or corner (world/road/roadPainter.js, BasicRoadsTexturing.cs PaintPath, ported), so every bend is a 45 or 90
// degree kink at a pixel's centre and every junction a star. Past the Bay the network is the port's own
// (world/tamrielRoads.js), and it is drawn here by the port's own law instead - the Bay's roads stay Basic Roads' to the
// tile (its painter, its arrays), the departure is this land's alone:
//
//  - A WAY THROUGH (two bits) is one quadratic curve from the one bit's edge point to the other's, its control point the
//    pixel's centre: tangent to the step at both ends, so it meets the next pixel's curve with one heading (no kink at a
//    pixel's edge), and straight - the very band Basic Roads draws - where the two bits are opposite. A 45-degree bend
//    passes 0.125 of a pixel (102 m) inside the centre, a staircase of steps reads as one gentle line.
//  - A JUNCTION (three bits or more): every pair of bits a road may run through with no more than a 45-degree turn (the
//    two opposite, or three compass points apart) is its curve; a bit in no such pair - a road met square, a T - runs
//    straight in to the centre; and the centre is paved round (JUNCTION_R), the corners of the meeting rounded. So a
//    road joining at 45 degrees merges into the other as a Y, a fork splits as one, a T and a crossroads are a small
//    square.
//  - AN END (one bit): straight in to the centre - a town's, a node's.
//
// The curves are the one law of the road's line past the Bay: the painter paints them (paintCurvedPaths, at the kernel's
// seam: world/terrain/terrainGen.js hands it the pixel and the layer's reader), the verge measures from them
// (curveDistance, world/road/roadBand.js roadRoom), and the Overworld's walk and drawn line walk them (ROAD-FOLLOW:
// systems/travel/roadLine.js, a leg that turns ending at its curve's apex - curveApex's point). Each pixel's curves are its own
// byte's, so a band that spills over an edge or a corner into the next pixel is painted there from its neighbour's byte -
// seamless, with no corner byte.
//
// THE FRAME: a pixel's tiles, x east and y north, 0 to 128 (WORLD_MAP_TILE_DIM) - tile (x, y) the square [x, x+1] x
// [y, y+1], its ground the tileData corner (x, y) (world/terrain/terrainTiles.js assignTiles' own index, x + y * 129);
// row 0 is the south edge (roadPainter.js). Deterministic: sums, products and Math.sqrt alone (IEEE, correctly rounded) -
// the same tiles on every client.
// ═══════════════════════════════════════════════════════════════════
import { DIR_DELTA } from './roadNetwork.js';
import { RING } from '../townShape.js'; // TS9: a town's ring's codes (terrain/terrainTiles.js townRoadRing)

/** A pixel's tiles a side. */
export const CURVE_DIM = 128;
const MID = CURVE_DIM / 2;
/** How finely a curve is cut into straight runs - a 90-degree bend's sagitta under a tenth of a tile. */
export const CURVE_STEPS = 32;
/** A road's half width, tiles: its centre line within it paves a tile - two tiles across a cardinal road, Basic Roads'
 *  own width (roadPainter.js ROAD_TILES: x 63 and 64 down a north-south road). */
export const ROAD_HALF = 1;
/** Past a road's paving, its shoulder: the ground's corners within this many tiles more are worn to dirt, so the
 *  marching squares (terrainTiles.js assignTiles) blend the road into the grass at any angle. */
export const ROAD_SHOULDER = 0.9;
/** A track's half width, tiles: its centre line within it wears the ground's corners to dirt (the jungle's trails'
 *  own way, world/jungle/jungleTrails.js - the squares draw the track's edges). */
export const TRACK_HALF = 0.75;
/** A junction's paving round its centre, tiles from the centre line's meeting: a small square, its corners rounded. */
export const JUNCTION_R = 2.5;
/** The ground's kinds (roadPainter.js TILE): a road is never paved over water - a ford, the bank either side. */
const WATER = 0,
  DIRT = 1,
  GRASS = 2;
const ROAD_TILE = 46;

/** Each bit's edge point, tiles (x east, y north): the edge's middle for a cardinal, the corner for a diagonal. */
const EXIT = new Map(DIR_DELTA.map(([bit, dx, dy]) => [bit, Object.freeze([MID + MID * dx, MID - MID * dy])]));

/**
 * THE CURVES A BYTE DRAWS, in its pixel's tile frame: each a quadratic `[ax, ay, cx, cy, bx, by]` (an end straight in
 * to the centre is one too, its control halfway), and `hub` - the junction's paving round the centre (none for fewer
 * than three bits). Kept a byte: 256 at the most.
 * @param {number} bits
 * @returns {{ curves: ReadonlyArray<ReadonlyArray<number>>, hub: boolean }}
 */
export function curvesOf(bits) {
  const b = bits & 0xff;
  let hit = _curves[b];
  if (hit) return hit;
  const ks = [];
  for (let k = 0; k < 8; k++) if (b & DIR_DELTA[k][0]) ks.push(k);
  const out = [];
  const quad = (ka, kb) => {
    const a = EXIT.get(DIR_DELTA[ka][0]),
      c = EXIT.get(DIR_DELTA[kb][0]);
    out.push(Object.freeze([a[0], a[1], MID, MID, c[0], c[1]]));
  };
  const end = (ka) => {
    const a = EXIT.get(DIR_DELTA[ka][0]);
    out.push(Object.freeze([a[0], a[1], (a[0] + MID) / 2, (a[1] + MID) / 2, MID, MID]));
  };
  if (ks.length === 1) end(ks[0]);
  else if (ks.length === 2) quad(ks[0], ks[1]);
  else if (ks.length > 2) {
    const paired = new Set();
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const d = Math.abs(ks[i] - ks[j]),
          sep = Math.min(d, 8 - d);
        if (sep >= 3) {
          quad(ks[i], ks[j]);
          paired.add(ks[i]);
          paired.add(ks[j]);
        }
      }
    }
    for (const k of ks) if (!paired.has(k)) end(k);
  }
  hit = Object.freeze({ curves: Object.freeze(out), hub: ks.length > 2 });
  _curves[b] = hit;
  return hit;
}
/** @type {Array<ReturnType<typeof curvesOf>>} */
const _curves = new Array(256);

/** A quadratic's points, CURVE_STEPS + 1 of them, as [x0, y0, x1, y1, ...] - kept a curve. */
const _polys = new WeakMap();
export function curvePolyline(q) {
  let p = _polys.get(q);
  if (p) return p;
  p = new Float64Array(2 * (CURVE_STEPS + 1));
  for (let s = 0; s <= CURVE_STEPS; s++) {
    const t = s / CURVE_STEPS,
      u = 1 - t;
    p[2 * s] = u * u * q[0] + 2 * u * t * q[2] + t * t * q[4];
    p[2 * s + 1] = u * u * q[1] + 2 * u * t * q[3] + t * t * q[5];
  }
  _polys.set(q, p);
  return p;
}

/** The distance from (x, y) to the segment (ax, ay)-(bx, by). */
function segDist(x, y, ax, ay, bx, by) {
  const ex = bx - ax,
    ey = by - ay,
    L = ex * ex + ey * ey;
  let t = L > 0 ? ((x - ax) * ex + (y - ay) * ey) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - ax - t * ex,
    dy = y - ay - t * ey;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * HOW FAR A POINT STANDS FROM A BYTE'S ROAD LINE, tiles - its pixel's tile frame - less the junction's paving where the
 * hub is nearer: 0 on the line. The verge's question (world/road/roadBand.js roadRoom) and the walk's.
 * @param {number} bits @param {number} x @param {number} y
 */
export function curveDistance(bits, x, y) {
  const { curves, hub } = curvesOf(bits);
  let best = Infinity;
  for (const q of curves) {
    // a quadratic lies inside the box of its three points: a point farther from that box than the best yet is passed
    const bx = Math.max(Math.min(q[0], q[2], q[4]) - x, 0, x - Math.max(q[0], q[2], q[4]));
    const by = Math.max(Math.min(q[1], q[3], q[5]) - y, 0, y - Math.max(q[1], q[3], q[5]));
    if (bx * bx + by * by >= best * best) continue;
    const p = curvePolyline(q);
    for (let s = 0; s < CURVE_STEPS; s++) {
      const d = segDist(x, y, p[2 * s], p[2 * s + 1], p[2 * s + 2], p[2 * s + 3]);
      if (d < best) best = d;
    }
  }
  if (hub) {
    const dx = x - MID,
      dy = y - MID,
      d = Math.sqrt(dx * dx + dy * dy) - (JUNCTION_R - ROAD_HALF);
    if (d < best) best = Math.max(0, d);
  }
  return best;
}

/** The ground's rows and columns a band reaches past its line: a road's paving and shoulder. */
const REACH = ROAD_HALF + ROAD_SHOULDER + 1;
/** tan(22.5 degrees): a run within it of a compass axis is that axis's. */
const TAN_HALF_POINT = 0.41421356237309503;
/** A tile's lie by its nearest run (curveField `lie`): the run's axis, and which side of the line the tile is. */
export const LIE = Object.freeze({ EW: 0, NS: 1, NESW: 2, NWSE: 3, HUB: 4, SIDE: 8 });

/**
 * The least distance, tiles, from each tile centre and each corner of a pixel to the curves of its own byte and its
 * eight neighbours' (`byteAt(x, y)`, the map's pixels; north is y - 1) that come within REACH of it - a band that
 * spills over an edge or a corner is measured where it lands - and each tile's LIE: the axis of the run nearest it
 * (LIE.EW, NS, NESW, NWSE - a run within 22.5 degrees of it - or HUB, a junction's paving) with LIE.SIDE where the tile
 * stands north of an east-west run, east of a north-south one, south-east of a north-east one, north-east of a
 * north-west one (Basic Roads' own flipped rows and columns, roadPainter.js paintPath).
 * @param {number} px @param {number} py @param {number} own the pixel's own byte @param {(x: number, y: number) => number} byteAt
 * @returns {{ tiles: Float32Array, corners: Float32Array, lie: Uint8Array } | null} null where no curve comes near
 */
export function curveField(px, py, own, byteAt) {
  const D = CURVE_DIM,
    C = D + 1;
  let f = null;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const bits = dx === 0 && dy === 0 ? own : byteAt(px + dx, py + dy);
      if (!bits) continue;
      const { curves, hub } = curvesOf(bits);
      const ox = dx * D,
        oy = -dy * D; // the neighbour's frame in this one's: north (map y - 1) is +y
      f ??= {
        tiles: new Float32Array(D * D).fill(Infinity),
        corners: new Float32Array(C * C).fill(Infinity),
        lie: new Uint8Array(D * D),
      };
      for (const q of curves) {
        const p = curvePolyline(q);
        for (let s = 0; s < CURVE_STEPS; s++)
          stampSegment(f, ox + p[2 * s], oy + p[2 * s + 1], ox + p[2 * s + 2], oy + p[2 * s + 3], 0);
      }
      if (hub) stampSegment(f, ox + MID, oy + MID, ox + MID, oy + MID, JUNCTION_R - ROAD_HALF);
    }
  }
  return f;
}

/** Lower the field's distances to one segment (less `grow`) over the tiles and corners within REACH + grow of it, each
 *  tile it is now nearest taking its lie. */
function stampSegment(f, ax, ay, bx, by, grow) {
  const D = CURVE_DIM,
    C = D + 1,
    r = REACH + grow;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r)),
    x1 = Math.min(D, Math.ceil(Math.max(ax, bx) + r));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r)),
    y1 = Math.min(D, Math.ceil(Math.max(ay, by) + r));
  if (x0 > x1 || y0 > y1) return;
  const ex = bx - ax,
    ey = by - ay,
    aex = Math.abs(ex),
    aey = Math.abs(ey),
    L = ex * ex + ey * ey;
  const axis =
    grow > 0 || L === 0
      ? LIE.HUB
      : aey <= TAN_HALF_POINT * aex
        ? LIE.EW
        : aex <= TAN_HALF_POINT * aey
          ? LIE.NS
          : ex * ey > 0
            ? LIE.NESW
            : LIE.NWSE;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dc = Math.max(0, segDist(x, y, ax, ay, bx, by) - grow);
      if (dc < f.corners[x + y * C]) f.corners[x + y * C] = dc;
      if (x >= D || y >= D) continue;
      const cx = x + 0.5,
        cy = y + 0.5;
      const dt = Math.max(0, segDist(cx, cy, ax, ay, bx, by) - grow);
      if (!(dt < f.tiles[y * D + x])) continue;
      f.tiles[y * D + x] = dt;
      // the side: the tile's offset from the run's nearest point, across the axis
      let t = L > 0 ? ((cx - ax) * ex + (cy - ay) * ey) / L : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ox = cx - ax - t * ex,
        oy = cy - ay - t * ey;
      const side =
        axis === LIE.EW
          ? oy > 0
          : axis === LIE.NS
            ? ox > 0
            : axis === LIE.NESW
              ? ox - oy > 0
              : axis === LIE.NWSE
                ? ox + oy > 0
                : false;
      f.lie[y * D + x] = axis | (side ? LIE.SIDE : 0);
    }
  }
}

/** Basic Roads' diagonal flank (roadPainter.js ROAD_TILES' diagonal outer), by the ground: half paving, half the
 *  ground's edge. */
const FLANK = Object.freeze([47, 47, 55, 55]);
/** TS9: a ring's half tile by its code (terrainTiles.js RING) - [rotate, flip] that turn the diagonal's edge so its road
 *  lies toward that corner, as the mod's own flanks turn it (a NE-SW road's flank at x = y + 1, its road north and west:
 *  flip; at x + 1 = y, south and east: neither; a NW-SE road's, north and east: rotate; south and west: both). Its home is
 *  here, beside the flank it turns: Basic Roads' painter (roadPainter.js) and this one both lay it. */
export const RING_HALF = Object.freeze({
  [RING.NW]: [false, true],
  [RING.NE]: [true, false],
  [RING.SE]: [false, false],
  [RING.SW]: [true, true],
});
/** A paved tile's byte by its lie and its distance off the line, Basic Roads' rotations and flips (roadPainter.js
 *  paintPath: an east-west run's tiles rotated, its north row flipped; a north-south run's east column flipped; a
 *  diagonal's tile on the line its inner, rotated on the north-west run, the two either side its flanks). */
function pavedTile(lie, d, ground) {
  const axis = lie & 7,
    side = (lie & LIE.SIDE) !== 0;
  if (axis === LIE.EW) return ROAD_TILE + 64 + (side ? 128 : 0);
  if (axis === LIE.NS) return ROAD_TILE + (side ? 128 : 0);
  if (axis === LIE.HUB) return ROAD_TILE;
  const nw = axis === LIE.NWSE;
  if (d < 0.5) return ROAD_TILE + (nw ? 64 : 0);
  return FLANK[ground > 3 ? 2 : ground] + (nw ? 64 : 0) + (side ? 128 : 0);
}

/**
 * VOYAGER2: PAINT A PIXEL PAST THE BAY'S ROADS AND TRACKS AS CURVES, at the kernel's seam (world/road/roadPainter.js
 * paintRoads hands it the pixel past the Bay; before the marching squares, as Basic Roads' painter runs):
 *  - a road paves every tile its line comes within ROAD_HALF of (tile 46, ROAD_TILES' own), never one of water (a ford)
 *    nor one already set (a location's own tile); its shoulder wears the grass's corners within ROAD_SHOULDER more to dirt;
 *  - a track wears the grass's corners within TRACK_HALF of its line to dirt (the squares draw its edges, as the jungle's
 *    trails' are); a road's tile is never a track's;
 *  - a road on a location's pixel paves the rect's padding round it, Basic Roads' "paint roads around locations".
 * `paths` (GRASS-PATH1) is told every tile a road paves and every tile a track or a shoulder wears half or more of.
 * Answers how many tiles it paved.
 * @param {Uint8Array} tileData 129 x 129 corners @param {Uint8Array} tilemap 128 x 128
 * @param {{ px: number, py: number, road: number, track: number, byteAt: (kind: 'roads'|'tracks', x: number, y: number) => number,
 *   rect?: any, paths?: ?Uint8Array, tdDim?: number }} o
 */
export function paintCurvedPaths(
  tileData,
  tilemap,
  { px, py, road, track, byteAt, rect = null, paths = null, tdDim = CURVE_DIM + 1 },
) {
  const D = CURVE_DIM;
  const roads = curveField(px, py, road, (x, y) => byteAt('roads', x, y));
  const tracks = curveField(px, py, track, (x, y) => byteAt('tracks', x, y));
  if (!roads && !tracks) return 0;
  let paved = 0;
  const worn = new Uint8Array(tdDim * tdDim);
  const wear = (i) => {
    if (tileData[i] === GRASS) tileData[i] = DIRT;
    worn[i] = 1;
  };
  for (let y = 0; y < tdDim; y++) {
    for (let x = 0; x < tdDim; x++) {
      const i = x + y * tdDim,
        c = x + y * (D + 1);
      if (tileData[i] === WATER) continue;
      if (rect && x >= rect.xMin && x <= rect.xMax && y >= rect.yMin && y <= rect.yMax) continue; // the town's own ground, to its edge
      if ((roads && roads.corners[c] <= ROAD_HALF + ROAD_SHOULDER) || (tracks && tracks.corners[c] <= TRACK_HALF))
        wear(i);
    }
  }
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < D; x++) {
      const t = y * D + x,
        i = x + y * tdDim;
      if (tilemap[t] !== 0) continue;
      if (roads && roads.tiles[t] <= ROAD_HALF && tileData[i] !== WATER) {
        tilemap[t] = pavedTile(roads.lie[t], roads.tiles[t], tileData[i]);
        paved++;
        if (paths) paths[t] = 1;
        continue;
      }
      if (paths && worn[i] + worn[i + 1] + worn[i + tdDim] + worn[i + tdDim + 1] >= 2) paths[t] = 1;
    }
  }
  // Basic Roads' "paint roads around locations": a road's pixel paves its location rect's padding (TOWN-SHAPES: its ring)
  // - AUDIT BAY-LEFT F2: and TS9's half tiles at its angled edges, as Basic Roads' painter lays them on the Bay
  // (roadPainter.js paintPath): the diagonal's own edge by the ground, turned by RING_HALF, never over the sea nor over a
  // tile a road's curve paved here
  if (road && rect) {
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < D; x++) {
        const t = y * D + x,
          code = rect.ring ? rect.ring[t] : 0,
          half = code ? RING_HALF[code] : null;
        if (
          tilemap[t] !== 0 ||
          !(rect.ring ? code === RING.road || half : x > rect.xMin && x < rect.xMax && y > rect.yMin && y < rect.yMax)
        )
          continue;
        const ground = tileData[x + y * tdDim];
        if (ground === WATER) continue; // AUDIT TESA III E1-1: never the sea a shore town keeps
        tilemap[t] = half ? FLANK[ground > 3 ? 2 : ground] + (half[0] ? 64 : 0) + (half[1] ? 128 : 0) : ROAD_TILE;
        paved++;
        if (paths) paths[t] = 1;
      }
    }
  }
  return paved;
}

/**
 * VOYAGER2: WHERE A WALK ALONG A CURVED ROAD TURNS (ROAD-FOLLOW: the point roadLine.js's legs end at, its curve's own middle) - the point of a pixel's curve halfway between the bit it comes in
 * by and the bit it leaves by (tiles, the pixel's frame): the bend's own apex, on the painted road; the centre for a way
 * straight through or a pair the byte draws no curve for (a T's arm).
 * @param {number} bits @param {number} inBit the edge it comes in by @param {number} outBit the edge it leaves by
 */
export function curveApex(bits, inBit, outBit) {
  const a = EXIT.get(inBit),
    b = EXIT.get(outBit);
  if (!a || !b) return [MID, MID];
  for (const q of curvesOf(bits).curves) {
    const ends =
      (q[0] === a[0] && q[1] === a[1] && q[4] === b[0] && q[5] === b[1]) ||
      (q[0] === b[0] && q[1] === b[1] && q[4] === a[0] && q[5] === a[1]);
    if (ends && q[2] === MID && q[3] === MID)
      return [0.25 * q[0] + 0.5 * MID + 0.25 * q[4], 0.25 * q[1] + 0.5 * MID + 0.25 * q[5]];
  }
  return [MID, MID];
}
