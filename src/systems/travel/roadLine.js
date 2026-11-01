// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ROAD-FOLLOW (2026-10-27, the owner's field report, item 6: "Road travel is not following roads properly in overworld
// travel"; bible/06-Systems/Travel-View.md ROAD-FOLLOW) - A ROAD PAST THE BAY IS WALKED AND DRAWN ON ITS CURVES.
//
// The Overworld's walk (OW-ROAD-TRUE: a road's or a track's leg walks its lane, travelOptions.js routeLane) and its drawn
// line (travelRoute.js routeDrawPoints) run pixel middle to pixel middle - Basic Roads' own geometry, where every arm of
// a pixel's compass byte is a straight band from its middle to an edge or a corner (roadPainter.js). Past the Bay the
// roads are drawn by VOYAGER2's law instead (world/road/roadCurves.js): a way through a pixel that turns is one quadratic
// from the one edge point to the other about the middle, passing 0.125 of a pixel (102 m) inside it at a 45-degree bend
// and 0.177 (145 m) at a right angle. So at every bend past the Bay the party walked across the inside of the bend, on
// the grass beside a road two tiles (12.8 m) wide: measured on the freeware's Cyrodiil, 12 to 17 per cent of every road
// journey's walked line lay off the painted road, where the plan's own steps were 97 to 100 per cent road (VOYAGER's
// OPEN (1) named it; curveApex was never wired).
//
// THE LAW: a route's pixel past the Bay that it turns in, by a road or a track in and out, is walked on the curve a
// byte draws between the two edges it crosses (ROAD-SMOOTH: the road's or the track's) - the leg ends at its apex (on the
// road) and the leg after it starts there and walks the curve's second half before its straight run. A pair the byte
// draws no curve for (a T's stem met square, a turn at a junction sharper than 45 degrees) is walked through the middle,
// as the painter draws it there; a way straight through, the Bay's pixels and the route's two ends are the middles they
// were. Each leg so walked carries its `line`: the native points of the painted road from the leg before's end to its
// own. Pure: the bytes in (the installed layer's reader by default), points out.
// ═══════════════════════════════════════════════════════════════════
import { curvesOf, curvePolyline, CURVE_STEPS, CURVE_DIM } from '../../world/road/roadCurves.js';
import { DIR_DELTA, MAP_H } from '../../world/road/roadNetwork.js';
import { arenaRoadByte } from '../../world/arenaRoads.js';
import { inBay } from '../../world/tamriel/tamrielFrame.js';
import { MP_WORLD_UNITS } from '../../world/road/pathData.js';

/** A tile's native units (a pixel's 32768 over its 128 tiles). */
const TILE_UNITS = MP_WORLD_UNITS / CURVE_DIM;
const MID = CURVE_DIM / 2;
/** The kinds of ground a byte paints a way on. */
const PAINTED = Object.freeze(['road', 'track']);
/** The bit of the step (dx, dy) out of a pixel (map y south). */
const BIT_OF = new Map(DIR_DELTA.map(([bit, dx, dy]) => [`${dx},${dy}`, bit]));
/** Each bit's edge point in a pixel's tile frame (x east, y north) - roadCurves.js's own EXIT. */
const EXIT = new Map(DIR_DELTA.map(([bit, dx, dy]) => [bit, [MID + MID * dx, MID - MID * dy]]));

/** The bit a route's step from `a` to its neighbour `b` leaves `a` by (0 for no neighbour step). */
export const stepBit = (a, b) => BIT_OF.get(`${b.x - a.x},${b.y - a.y}`) ?? 0;

/**
 * THE CURVE A BYTE DRAWS THROUGH ITS PIXEL from the edge `inBit` to the edge `outBit`: its points in the pixel's tile
 * frame (x east, y north, 0 to 128), CURVE_STEPS + 1 of them from `inBit`'s edge point to `outBit`'s - or null where the
 * byte draws no curve between the two (opposite edges: the straight band through the middle; a pair it draws none for:
 * the way is through the middle, as the lane walks it).
 * @param {number} bits @param {number} inBit @param {number} outBit
 * @returns {Array<[number, number]>|null}
 */
export function curveThrough(bits, inBit, outBit) {
  const a = EXIT.get(inBit),
    b = EXIT.get(outBit);
  if (!a || !b || inBit === outBit) return null;
  for (const q of curvesOf(bits).curves) {
    if (q[2] !== MID || q[3] !== MID) continue; // an end's straight run in to the middle
    const fwd = q[0] === a[0] && q[1] === a[1] && q[4] === b[0] && q[5] === b[1];
    const back = q[0] === b[0] && q[1] === b[1] && q[4] === a[0] && q[5] === a[1];
    if (!fwd && !back) continue;
    if (q[0] + q[4] === 2 * MID && q[1] + q[5] === 2 * MID) return null; // straight through: the lane's own line
    const p = curvePolyline(q),
      pts = [];
    for (let s = 0; s <= CURVE_STEPS; s++) pts.push(/** @type {[number, number]} */ ([p[2 * s], p[2 * s + 1]]));
    return fwd ? pts : pts.reverse();
  }
  return null;
}

/** A point of pixel (px, py)'s tile frame in native units ({x east, z north}: the pixel's south-west corner its origin -
 *  travelPaths.js mapPixelWorldOrigin - and its tile row 0 the south edge, roadPainter.js). */
export const nativeOfTile = (px, py, tx, ty) =>
  /** @type {[number, number]} */ ([
    px * MP_WORLD_UNITS + tx * TILE_UNITS,
    (MAP_H - 1 - py) * MP_WORLD_UNITS + ty * TILE_UNITS,
  ]);

/**
 * THE CURVE A ROUTE WALKS THROUGH ITS PIXEL `i` (not its first or last), native: the painted curve between the edges it
 * comes in and goes out by, where the pixel is past the Bay and the steps in and out are a road's or a track's (ROAD-SMOOTH:
 * either kind's paint) - else null (the lane's middle is on the painted road there, or no curve runs through).
 * @param {{x:number,y:number}[]} pixels @param {string[]} kinds @param {number} i
 * @param {{ byteAt?: (kind: string, x: number, y: number) => number, past?: (x: number, y: number) => boolean }} [o]
 * @returns {Array<[number, number]>|null}
 */
export function routeCurveAt(pixels, kinds, i, { byteAt = arenaRoadByte, past = (x, y) => !inBay(x, y) } = {}) {
  if (i <= 0 || i >= pixels.length - 1) return null;
  const a = kinds[i - 1],
    b = kinds[i];
  if (!PAINTED.includes(a) || !PAINTED.includes(b)) return null;
  const p = pixels[i];
  if (!past(p.x, p.y)) return null;
  const inBit = stepBit(p, pixels[i - 1]),
    outBit = stepBit(p, pixels[i + 1]);
  // ROAD-SMOOTH: the curve either kind paints through the two edges - the step in's kind first, then the other's: a route
  // that steps off a road onto a track (or back) where one is painted through both walks it, not the middle off both
  for (const kind of new Set([a, b, a === 'road' ? 'track' : 'road'])) {
    const bits = byteAt(kind === 'road' ? 'roads' : 'tracks', p.x, p.y);
    const tiles = bits & inBit && bits & outBit ? curveThrough(bits, inBit, outBit) : null;
    if (tiles) return tiles.map(([tx, ty]) => nativeOfTile(p.x, p.y, tx, ty));
  }
  return null;
}

/**
 * ROAD-FOLLOW: THE PAINTED LINES THE LEGS WALK - each leg `legs[k]` (routeLegs', `ix[k]` its pixel's index in `pixels`, -1
 * for a ring's or an end's own point) whose run turns on a curve at either end takes `line`: the native points from the
 * leg before's end (a curve's apex, where that leg ended on one) to its own end - the second half of the curve behind it,
 * then the first half of its own pixel's curve up to its apex (where it ends now), else its own pixel's middle. A leg on
 * no curve keeps no line (its lane middle to middle is the painted road). Answers `legs`, written in place.
 * @param {Array<any>} legs @param {number[]} ix @param {{x:number,y:number}[]} pixels @param {string[]} kinds
 * @param {Parameters<typeof routeCurveAt>[3]} [o]
 */
export function roadLineLegs(legs, ix, pixels, kinds, o = {}) {
  const half = CURVE_STEPS / 2;
  let behind = null; // the second half of the curve the leg before ended on - from its apex
  for (let k = 0; k < legs.length; k++) {
    const leg = legs[k],
      i = ix[k];
    const plain = i >= 0 && !leg.at && !leg.ring && (leg.kind === 'road' || leg.kind === 'track');
    if (!plain) {
      behind = null;
      continue;
    }
    const curve = routeCurveAt(pixels, kinds, i, o);
    if (behind || curve) {
      const p = pixels[i],
        line = [
          ...(behind ? behind.slice(1) : []),
          ...(curve ? curve.slice(0, half + 1) : [nativeOfTile(p.x, p.y, MID, MID)]),
        ];
      leg.line = line.filter((q, j) => j === 0 || q[0] !== line[j - 1][0] || q[1] !== line[j - 1][1]);
    }
    behind = curve ? curve.slice(half) : null;
  }
  return legs;
}

/** The native point a leg ends at: its line's last, else its pixel's middle (`mid(leg)`, native {x, z}). */
export function legEnd(leg, mid) {
  const q = leg?.line?.[leg.line.length - 1];
  return q ? { x: q[0], z: q[1] } : mid(leg);
}

/** The point of a line of runs (`pts`, native [x, z]) nearest `me`, and the run it lies on. */
export function nearestOnLine(pts, me) {
  let best = { x: pts[0][0], z: pts[0][1], seg: 0, d: Infinity };
  for (let s = 0; s + 1 < pts.length; s++) {
    const [ax, az] = pts[s],
      [bx, bz] = pts[s + 1],
      dx = bx - ax,
      dz = bz - az,
      L = dx * dx + dz * dz;
    const t = L > 0 ? Math.max(0, Math.min(1, ((me.x - ax) * dx + (me.z - az) * dz) / L)) : 0;
    const x = ax + dx * t,
      z = az + dz * t,
      d = Math.hypot(me.x - x, me.z - z);
    if (d < best.d) best = { x, z, seg: s, d };
  }
  return best;
}

/** A line of runs cut at its point nearest `me`: its points up to there, that point last. */
export function lineUpTo(pts, me) {
  const n = nearestOnLine(pts, me);
  return [...pts.slice(0, n.seg + 1), /** @type {[number, number]} */ ([n.x, n.z])];
}

/** ROAD-FOLLOW: the drawn route's runs - its points (routeDrawPoints', one a leg, each with the painted road's points
 *  before it, `via`) as runs `draw(ax, az, bx, bz, out)` from `start` on: each leg along its road. */
export function drawRouteRuns(natives, start, draw, out) {
  for (let i = start + 1; i < natives.length; i++) {
    let a = natives[i - 1];
    for (const q of [...(natives[i].via ?? []), natives[i]]) {
      draw(a[0], a[1], q[0], q[1], out);
      a = q;
    }
  }
  return out;
}

/** ROAD-FOLLOW: the traveller's own run of the drawn line - from where they are (`at`) through the painted road's points
 *  still ahead on the leg they walk (`native.via` from the run `seg` its walk is on - none walked yet while a town's streets
 *  or a rejoin come first, `seg` 0) to its end. */
export function drawOwnRun(at, native, seg, draw, out) {
  let a = [at.x, at.z];
  for (const q of [...(native.via ?? []).slice(Math.max(0, seg | 0)), native]) {
    draw(a[0], a[1], q[0], q[1], out);
    a = q;
  }
  return out;
}
