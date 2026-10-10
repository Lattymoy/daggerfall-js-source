// @ts-check
// WAGONS2 (2026-10-09, Mac: "3. People should be able to use the interior just like houses ... 4. ... allowing players
// to see inside/outside of house windows + the new wagon"; asked, the caravan's inside is "Caravan-shaped": built from
// the caravan itself - its size, its windows and its door, turned with the wagon): THE CARAVAN'S ROOM, AS A MODEL.
//
// WAGONS1 borrowed the small ship's cabin (Warm Ashes' SHIPAA00.RMB) for the caravan's room: a room of another shape,
// stood axis-aligned on the wagon however it was parked, its windows nowhere near the caravan's. This is the caravan's
// own inside: the body's measures (world/wagonModels.js MEASURED.caravan - its floor, its sides, its ends, its rounded
// roof) taken in by the boards' thickness, a floor, two side walls, two ends and a barrel ceiling under the roof, every
// face looking INTO the room. Each wall wears its picture on the caravan's own layout - the side walls on the side's
// heights and tile (world/wagonArt.js BANDS.roomSide, the side's u), the ends laid whole as the ends are (`endUv`) - so
// its windows' glass and its door stand exactly where the caravan's do: from inside, a window is a hole onto the world
// the caravan stands in; from outside, through the caravan's own window, this room is what is seen (scenes/
// horseCartPool.js draws it inside the body).
//
// The model is in the wagon's LIFTED frame (the parts' - wagonModels.js LIFT: metres, +x its right, +y up, +z the way
// it is pulled, the origin a metre over the ground under its rear wheels), so the one matrix that draws the caravan
// stands its room in it - outside as part of the wagon, inside as the interior host's room (scenes/caravanRoom.js).
//
// Pure: numbers in, a model out. Not a DFU member. Ledger A (WAGONS2).
import { MEASURED, LIFT } from './wagonModels.js';
import { WAGON_ARCHIVE, TEX, WAGON_TILE, SIDE_Y0, SIDE_Y1 } from './wagonArt.js';
import { planarUv } from './galleonMesh.js';

const M = MEASURED.caravan;
/** The boards' thickness: how far the room's walls stand in from the body's outside (m). */
export const CARAVAN_WALL = 0.06;
/** The room's measures, in the lifted frame: its half width, its floor, its eaves (the side walls' head), the barrel's
 *  peak, its rear wall and its front wall. */
export const CARAVAN_ROOM = Object.freeze({
  halfX: M.sideX - CARAVAN_WALL,
  floorY: M.floorY - LIFT + 0.01,
  eavesY: SIDE_Y1 - LIFT,
  peakY: M.endTopY - LIFT - CARAVAN_WALL,
  rearZ: M.rearZ + CARAVAN_WALL,
  frontZ: M.bedZ[1] - CARAVAN_WALL,
});
/** How many facets the barrel ceiling is drawn in. */
export const CEILING_FACETS = 8;

/** The barrel's circle across the room: its centre's height and its radius, through both eaves and the peak. */
export function ceilingArc(room = CARAVAN_ROOM) {
  const { halfX: X, eavesY: e, peakY: p } = room;
  const cy = (X * X + e * e - p * p) / (2 * (e - p));   // |(X, e) - (0, cy)| = p - cy
  return { cy, r: p - cy, half: Math.asin(X / (p - cy)) };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** A point of the room in the caravan's bake frame (metres over the ground) - the frame its pictures are laid in. */
const baked = (p) => [p[0], p[1] + LIFT, p[2]];
/** The side walls' picture: u the caravan's side's own along its tile (`out` the side's outward normal), v up the
 *  side's heights (1 its eaves) - BANDS.roomSide's slice, world/galleonModel.js bandPiece's law. */
const sideUv = (out) => (p) => { const b = baked(p); return [planarUv(b, out, [WAGON_TILE.roomSide[0], 1])[0], Math.min(1, Math.max(0, (b[1] - SIDE_Y0) / (SIDE_Y1 - SIDE_Y0)))]; };
/** An end's picture laid whole (wagonModels.js endUv's law): `sign` -1 the front's, 1 the rear's, as seen from outside. */
const endUv = (sign) => (p) => { const b = baked(p); return [0.5 + (sign * b[0]) / (2 * M.sideX), (b[1] - M.floorY) / (M.endTopY - M.floorY)]; };

/**
 * THE ROOM'S MODEL: `{ positions, normals, uvs, indices, subMeshes, doors }` (the renderer's model shape, every face
 * looking in), on the caravan's pictures - the built ones, or a paint's (`records`: each built TEX record's stand-in,
 * world/wagonArt.js lookRecord; absent, the built).
 */
export function caravanRoomModel({ records = null } = {}) {
  const R = CARAVAN_ROOM, { cy, r, half } = ceilingArc(R);
  const rec = (k) => records?.[k] ?? TEX[k];
  const groups = new Map();
  const group = (k) => { const g = groups.get(k) ?? { p: [], n: [], uv: [], i: [] }; groups.set(k, g); return g; };
  /** A convex polygon facing `n` (its corners in either order - each triangle is wound to face `n`, the renderer's
   *  front: cross(b - a, c - a) along the normal), on picture `k`; `uv` a corner's picture point (or each corner's, in
   *  order); `normals` per corner (a curved face's) or n. */
  const poly = (k, corners, n, uv, normals = null) => {
    const g = group(k), base = g.p.length / 3;
    corners.forEach((c, i) => { g.p.push(...c); g.n.push(...(normals ? normals[i] : n)); g.uv.push(...(typeof uv === 'function' ? uv(c) : uv[i])); });
    const flip = dot(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])), n) < 0;
    for (let i = 1; i + 1 < corners.length; i++) g.i.push(...(flip ? [base, base + i + 1, base + i] : [base, base + i, base + i + 1]));
  };
  const { halfX: X, floorY: f, eavesY: e, rearZ: zr, frontZ: zf } = R;
  // the floor, along the caravan (planarUv's floor: u fore and aft)
  poly('roomFloor', [[-X, f, zr], [X, f, zr], [X, f, zf], [-X, f, zf]], [0, 1, 0], (p) => planarUv(p, [0, 1, 0], WAGON_TILE.roomFloor));
  // the two side walls, each looking across the room, laid on its own side's picture
  poly('roomSide', [[X, f, zr], [X, f, zf], [X, e, zf], [X, e, zr]], [-1, 0, 0], sideUv([1, 0, 0]));
  poly('roomSide', [[-X, f, zr], [-X, f, zf], [-X, e, zf], [-X, e, zr]], [1, 0, 0], sideUv([-1, 0, 0]));
  // the barrel: a facet each step of the arc, its normals the arc's (toward its centre), its v the arc's length
  const at = (k) => { const a = -half + (2 * half * k) / CEILING_FACETS; return { x: r * Math.sin(a), y: cy + r * Math.cos(a), n: [-Math.sin(a), -Math.cos(a), 0], s: r * (a + half) }; };
  for (let k = 0; k < CEILING_FACETS; k++) {
    const a = at(k), b = at(k + 1), [tu, tv] = WAGON_TILE.roomCeiling;
    const m = -half + (2 * half * (k + 0.5)) / CEILING_FACETS, mid = [-Math.sin(m), -Math.cos(m), 0];
    poly('roomCeiling', [[a.x, a.y, zr], [b.x, b.y, zr], [b.x, b.y, zf], [a.x, a.y, zf]], mid,
      [[zr / tu, a.s / tv], [zr / tu, b.s / tv], [zf / tu, b.s / tv], [zf / tu, a.s / tv]], [a.n, b.n, b.n, a.n]);
  }
  // the two ends: a wall to the eaves and the barrel's gable over it, one polygon each (convex: the arc bows out)
  const gable = [];
  for (let k = CEILING_FACETS; k >= 0; k--) { const a = at(k); gable.push([a.x, a.y]); }
  const end = (z) => [[-X, f, z], [X, f, z], ...gable.map(([x, y]) => [x, y, z])];
  poly('roomRear', end(zr), [0, 0, 1], endUv(1));
  poly('roomFront', end(zf), [0, 0, -1], endUv(-1));
  // one model: a sub-mesh a picture, in TEX order
  const positions = [], normals = [], uvs = [], indices = [], subMeshes = [];
  for (const k of ['roomFloor', 'roomSide', 'roomCeiling', 'roomRear', 'roomFront']) {
    const g = groups.get(k), base = positions.length / 3, start = indices.length;
    positions.push(...g.p); normals.push(...g.n); uvs.push(...g.uv);
    for (const i of g.i) indices.push(base + i);
    subMeshes.push({ textureArchive: WAGON_ARCHIVE, textureRecord: rec(k), startIndex: start, primitiveCount: g.i.length / 3 });
  }
  return { name: 'Caravan room', positions: Float32Array.from(positions), normals: Float32Array.from(normals), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices), subMeshes, doors: [] };
}

/** Where a player stands entering the room: just inside its door (the rear end's middle), on its floor - the room's
 *  enter marker (lifted frame). */
export const CARAVAN_ENTER = Object.freeze([0, CARAVAN_ROOM.floorY, CARAVAN_ROOM.rearZ + 0.3]);
/** Where its lantern hangs: the barrel's peak, half way along the room (lifted frame). */
export const CARAVAN_LANTERN = Object.freeze([0, CARAVAN_ROOM.peakY, (CARAVAN_ROOM.rearZ + CARAVAN_ROOM.frontZ) / 2]);
