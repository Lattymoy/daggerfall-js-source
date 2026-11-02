// @ts-check
// DECK-WALK (2026-09-29, Mac: "There's an issue where enemies/allys can navigate on the railing of ships") - A SHIP'S
// WALKABLE DECK, read off her own colliders: where a body may stand, walk and be put.
//
// WHY THEY WALKED THE RAIL. A hull's collider is its whole visual mesh, and a Come Sail Away bulwark is a ramp: the
// Galleon's rises 43-49 degrees from 0.41 m over her 6.77 m deck to a rail top at 7.7, the Carrack's 50-56 degrees
// from the deck itself - every face under the capsule's SLOPE_LIMIT_DEG 70 (motor.js), so every one of them is floor
// to the collider's one-way rule, and a 1.8 m capsule driven into it climbed the rail and walked off it into the sea;
// the enemy motor's own obstacle probe reads a ramp as climbable. Nothing told a body where the deck was: the
// boarding's spots were blind rays over the hull's box (one of the Galleon's sixteen stood on her outer bow at 5.21
// m, others on her lower deck and in the Carrack's hold).
//
// THE DECK. A hull's triangles in her own frame, rasterised on a DECK_CELL grid over her extent: every surface under
// each cell's centre, and of those the FLOORS - a face within DECK_FLAT of level, with DECK_HEADROOM clear above it
// to the next surface (a boom, a yard, a quarterdeck's underside) and no wall through the cell rising off it (a mast,
// a gun's side, a cabin's: a wall's footprint marks every cell its edges cross, never only a centre it happens to
// cover). The deck is the floors that join the MAIN DECK (the level most of her floor stands at) cell to cell within
// DECK_STEP (a stair's tread) - so a rail's top, a mast's cap and a spar are no deck, however flat - kept DECK_INSET
// cells off every edge (the rail, a hatch), and of that her OPEN deck alone: the largest piece a walk joins (measured:
// the Small Ship's poop cabin and the Carrack's rooms under her half deck are pieces walled off from it). What it
// answers: whether a point is deck (`walkable`), the deck point nearest any point (`clamp` - a body pushed off it is
// put back on its edge; `nearest`, the cell's centre), well-spread spots to stand a muster on (`spots`), and a walk
// across it (`path`, A* cell to cell within DECK_STEP, the corners cut where the straight line is deck).
// AUDIT NAV2 F32: kept off her walls and her open side only, never off a bench (the Large Boat's midship thwarts, 0.6
// to 0.72 m: the inset took 18 of the 30 cells between them and left her 12, the Pirate Sloop's and the Coasting
// Trader's whole deck), and not kept off at all where that would take more than half her deck (the Rowboat's 4 of 13).
//
// ITS FRAME is her mesh node's (Boat.MeshObject - every collider of every hull hangs under it), baked at rest: the swell
// rolls and pitches that node, never her root, so a point goes into the deck through the node's live world matrix
// (`intoDeck`) and out of it the same way (`outOfDeck`). ONE LEVEL A CELL - the main deck's: where a covered deck
// stands under another (the Small Ship's at 3.64 m under her main deck at 6.77, the Carrack's 6.7 m half deck over
// hers at 3.64) the main deck is the one kept, the other no deck.
// AUDIT NAV2 F34: EVERY LEVEL A CELL HOLDS, AT HER MAIN DECK OR OVER IT - one level a cell cut the Small Ship's
// forecastle stair at 8.55 (the cells under its upper treads were her main deck beneath them), and the leash dragged a
// body on her forecastle 2.5 m down, one on her poop 3.2 m down and 4.3 m across: a player there was out of every
// boarder's reach. Her floors join cell to cell within DECK_JOIN, the motors' own step; her open deck is the grid's own
// `y`, its highest floor a cell (a stair's tread over the deck it climbs from), and every other piece is baked beside
// it (`more`: her poop, her cabins, the room under her forecastle - `heightAt`, `pieceAt` and `clamp` answer per
// piece), so a body stays on the piece it stands on. Under her main deck (her lower deck, her hold, a galley's rowers)
// nothing is deck. And every floor of hers whatever its level (`floors`) is what standing aboard her is (`under`).
// AUDIT GALLEON (2026-10-02): a part of hers that opens and shuts - a hatch's cover, a door (`moves`) - is a wall of
// hers as it stands shut and never a floor, so her hatchways are holes in her deck; and a body put aboard her comes
// down on her main deck's own floor across from where it stood, or on the floor of hers it already stands on (`land`).
// A wall marks a cell with its own height there, never its whole triangle's - her deck is the same however her faces
// are cut (D-wall); a floor to stand aboard on looks up; and her open deck is one walk.
// AUDIT GALLEON-2 (2026-10-03): the floors her parts that open stand over or in - a shut cover's top, a doorway a door's
// leaf alone walls, the margin either side - are baked beside her deck (`ajar`): what standing aboard reads and the
// leash lets a body stand on (DK1, DK3), never her walk; and the leash keeps a body to its piece's floor nearest the one
// it last stood on (`keep`, DK2: her open piece holds two levels in a cell since D-wall).

import { STEP_OFFSET } from '../../player/motor.js'; // AUDIT NAV2 F34: the motors' own step

export const DECK_CELL = 0.5;
export const DECK_FLAT = Math.cos((30 * Math.PI) / 180);
export const DECK_HEADROOM = 1.7;
export const DECK_STEP = 0.4;
export const DECK_INSET = 1;
/** AUDIT NAV2 F34: the most a walk climbs cell to cell - the motors' own step (a stair's riser, a coaming), and the
 *  join between two of her floors. */
export const DECK_JOIN = STEP_OFFSET;
/** AUDIT NAV2 F32: a bench's top over the floor it stands on (m) - a seat, under a body's hip (the Large Boat's
 *  thwarts stand 0.6 to 0.72 m): a deck is kept off her walls and her open side, never off one. */
export const DECK_BENCH = 0.9;
/** GALLEON (2026-10-01): a raised deck's least rise over her main deck (m) and its least size (cells) - a floor the
 *  inset may not cut off from her open deck when only its margin parts them (a narrow stair's flight, `keepFlights`). */
export const FLIGHT_OVER = 1;
export const FLIGHT_CELLS = 24;
/** GALLEON (2026-10-01): the most two floors a cell apart may differ and still join over a tread between them - two
 *  of the motors' steps (`linked`). */
export const FLIGHT_JOIN = 2 * DECK_JOIN;
/** AUDIT GN-D2: how far a cell's floor may stand off her main level and be her main deck's own floor (m) - half a
 *  step: a landing's (`land`). Every hull's main deck is one flat floor; the foot of a flight stands a tread over it
 *  (the new galleon's 0.29 m, within DECK_STEP - her muster's band). */
export const DECK_FLOOR = DECK_STEP / 2;
/** The level histogram's bin (m) the main deck is read off. */
const LEVEL_BIN = 0.25;
/** A near-vertical face (|n.y| under this share of its length) has no height at a point: a wall, a mast's side. */
const WALL_NY = 0.05;
/** AUDIT GN-D5: a cell's four side neighbours `[di, dk]`, in the order the walk's own 3 x 3 sweep meets them. */
const SIDE_STEPS = Object.freeze(
  [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ].map((s) => Object.freeze(s)),
);

/**
 * A world point into a deck's frame: through the inverse of her mesh node's world matrix `m` (column-major, affine),
 * written into `out` - no matrix made.
 * @param {ArrayLike<number>} m @param {ArrayLike<number>} p @param {number[]} [out]
 */
export function intoDeck(m, p, out = [0, 0, 0]) {
  const a00 = m[0],
    a10 = m[1],
    a20 = m[2],
    a01 = m[4],
    a11 = m[5],
    a21 = m[6],
    a02 = m[8],
    a12 = m[9],
    a22 = m[10];
  const c00 = a11 * a22 - a12 * a21,
    c01 = a12 * a20 - a10 * a22,
    c02 = a10 * a21 - a11 * a20;
  const det = a00 * c00 + a01 * c01 + a02 * c02;
  const k = det ? 1 / det : 0;
  const x = p[0] - m[12],
    y = p[1] - m[13],
    z = p[2] - m[14];
  out[0] = (c00 * x + (a02 * a21 - a01 * a22) * y + (a01 * a12 - a02 * a11) * z) * k;
  out[1] = (c01 * x + (a00 * a22 - a02 * a20) * y + (a02 * a10 - a00 * a12) * z) * k;
  out[2] = (c02 * x + (a01 * a20 - a00 * a21) * y + (a00 * a11 - a01 * a10) * z) * k;
  return out;
}

/**
 * A deck point out to the world through her mesh node's world matrix `m`, written into `out`.
 * @param {ArrayLike<number>} m @param {ArrayLike<number>} q @param {number[]} [out]
 */
export function outOfDeck(m, q, out = [0, 0, 0]) {
  const x = q[0],
    y = q[1],
    z = q[2];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

/**
 * The deck of a hull.
 * @param {{ positions: ArrayLike<number>, indices: ArrayLike<number>, moves?: boolean }[]} meshes - triangles in the
 *   hull's own frame; AUDIT GN-D7: `moves` a part of hers that opens and shuts (a door, a hatch's cover) - its walls
 *   hers as it stands shut, never a floor
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} extent
 * @param {{ cell?: number, inset?: number }} [opts]
 */
export function buildDeck(meshes, extent, { cell = DECK_CELL, inset = DECK_INSET } = {}) {
  const nx = Math.max(1, Math.ceil((extent.maxX - extent.minX) / cell));
  const nz = Math.max(1, Math.ceil((extent.maxZ - extent.minZ) / cell));
  const minX = extent.minX,
    minZ = extent.minZ;
  /** @type {number[][]} every surface's height under each cell's centre */
  const surf = Array.from({ length: nx * nz }, () => []);
  /** @type {number[][]} of those, the flat ones' */
  const flat = Array.from({ length: nx * nz }, () => []);
  /** @type {number[][]} AUDIT GN-D-wall: of the flat, the ones looking up - what standing aboard her reads (`floors`) */
  const upFlat = Array.from({ length: nx * nz }, () => []);
  /** @type {number[][]} every wall's [bottom, top] through each cell, flattened - a near-vertical face has no height at
   *  a point, so its footprint marks every cell it crosses (a mast's 0.4 m between two cells' centres, a cabin's side) -
   *  AUDIT GN-D-wall: with its own height within the cell (`wallFace`), never the whole triangle's */
  const walls = Array.from({ length: nx * nz }, () => []);
  /** @type {number[][]} AUDIT GN2-DK3: such walls of a part that opens and shuts (a door's leaf), kept apart - a wall to
   *  her deck as any (`cand`, `bench`), and a floor one alone walls a doorway's (`doors`, her `ajar`) */
  const leaves = Array.from({ length: nx * nz }, () => []);
  /** @type {number[][]} AUDIT GN2-DK1: such a part's faces looking up, as it stands shut (a hatch's cover, a cargo door) */
  const lids = Array.from({ length: nx * nz }, () => []);
  /** @type {number[][]} GALLEON (2026-10-01): the flat faces' heights at the midpoint of the side each cell shares with
   *  its +x neighbour (`midX`) and its +z neighbour (`midZ`) - the tread between two cells' centres (`linked`) */
  const midX = Array.from({ length: nx * nz }, () => []),
    midZ = Array.from({ length: nx * nz }, () => []);
  /** A flat face's height at every grid point `(ox, oz)` cells off each cell's corner within it (`ni` x `nk` of them),
   *  into `into` - the centres' own barycentric reading. */
  const flatAt = (into, ox, oz, ni, nk, ax, ay, az, bx, by, bz, cx, cy, cz, det) => {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - minX) / cell - ox)),
      i1 = Math.min(ni - 1, Math.ceil((Math.max(ax, bx, cx) - minX) / cell - ox));
    const k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - minZ) / cell - oz)),
      k1 = Math.min(nk - 1, Math.ceil((Math.max(az, bz, cz) - minZ) / cell - oz));
    for (let k = k0; k <= k1; k++) {
      const z = minZ + (k + oz) * cell;
      for (let i = i0; i <= i1; i++) {
        const x = minX + (i + ox) * cell;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
        const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
        into[k * nx + i].push(l1 * ay + l2 * by + l3 * cy);
      }
    }
  };
  // AUDIT GN-D-wall: A WALL'S HEIGHT IN A CELL IS ITS OWN THERE. A near-vertical face marked every cell its three edges
  // crossed with the whole triangle's lowest and highest point, so her deck hung on how a face happened to be cut into
  // triangles: re-cut as Blender cuts it (tools/bakeGalleon.mjs), the new galleon's castle front - a flat 16-gon at z
  // -10.30 - holds a triangle from (-5.32, 6.18) to (-0.77, 8.77) whose sloping edge crosses her port flight's cell
  // 6.87 m up, and it walled that cell 6.18 to 8.77, over its tread: her castle's roof and her upper flight (168 cells)
  // fell out of her deck. Each cell a wall stands over is marked with the wall's own part within the cell's square -
  // the triangle cut to each row's band of z, then to each cell's band of x (Sutherland-Hodgman: never more than seven
  // corners), its lowest and highest corner - so a flat face walls a cell the same however it is cut (its triangles'
  // parts in a cell are its own part there, and meet where its cuts run: a bench's test reads them as it reads the
  // whole). The rows and a row's cells are the ones Math.floor finds under the face's own span (the grid's own rule):
  // a face on the line between two cells is the farther's alone, as a point on it is. Every hull's moved cells are
  // floors whose cells hold no wall between a step and a head over them (her side under her deck at the galleon's
  // entry ports and bow, a stair's stringer over a head under the Carrack's half deck, her forecastle's bulkhead head)
  // or walls a face's edges missed (a mast's partner, a bulwark's foot): the galleon 828 -> 838, the Carrack 433 ->
  // 511, the Large Galley 4013 -> 4016, the mod's galleon 690 -> 727 (AUDIT GN2-DK4: over her own extent, the pool's -
  // 714 -> 750 was over the new galleon's), the boats as they were. The bake 0.6-3.5 ms
  // dearer a hull (the Large Galley's 18 -> 21.5 ms); a 2 cm sampling of each face would visit 35-117 million points.
  const CUT = Array.from({ length: 5 }, () => new Float64Array(24));
  /** The `n` corners of `src` (x, y, z each) cut to where `sign` * (p[axis] - v) >= 0, into `dst`; how many it keeps. */
  const cutTo = (src, n, dst, axis, v, sign) => {
    let m = 0;
    for (let q = 0; q < n; q++) {
      const p = q * 3,
        r = q + 1 < n ? p + 3 : 0;
      const dp = sign * (src[p + axis] - v),
        dr = sign * (src[r + axis] - v);
      if (dp >= 0) {
        dst[m] = src[p];
        dst[m + 1] = src[p + 1];
        dst[m + 2] = src[p + 2];
        m += 3;
      }
      if ((dp > 0 && dr < 0) || (dp < 0 && dr > 0)) {
        const t = dp / (dp - dr);
        dst[m] = src[p] + (src[r] - src[p]) * t;
        dst[m + 1] = src[p + 1] + (src[r + 1] - src[p + 1]) * t;
        dst[m + 2] = src[p + 2] + (src[r + 2] - src[p + 2]) * t;
        m += 3;
      }
    }
    return m / 3;
  };
  /** AUDIT GN-D-wall: a near-vertical triangle into `into` (`walls`; AUDIT GN2-DK3: a leaf's `leaves`) - each cell it
   *  stands over, its own [bottom, top] there. */
  const wallFace = (into, ax, ay, az, bx, by, bz, cx, cy, cz) => {
    const [T, R, U, C, D] = CUT;
    T[0] = ax;
    T[1] = ay;
    T[2] = az;
    T[3] = bx;
    T[4] = by;
    T[5] = bz;
    T[6] = cx;
    T[7] = cy;
    T[8] = cz;
    const k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - minZ) / cell)),
      k1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - minZ) / cell));
    for (let k = k0; k <= k1; k++) {
      const z0 = minZ + k * cell,
        z1 = z0 + cell;
      const n = cutTo(R, cutTo(T, 3, R, 2, z0, 1), U, 2, z1, -1);
      if (n < 1) continue;
      let lo = Infinity,
        hi = -Infinity;
      for (let q = 0; q < n * 3; q += 3) {
        if (U[q] < lo) lo = U[q];
        if (U[q] > hi) hi = U[q];
      }
      const i0 = Math.max(0, Math.floor((lo - minX) / cell)),
        i1 = Math.min(nx - 1, Math.floor((hi - minX) / cell));
      for (let i = i0; i <= i1; i++) {
        const x0 = minX + i * cell,
          x1 = x0 + cell;
        const m = cutTo(C, cutTo(U, n, C, 0, x0, 1), D, 0, x1, -1);
        if (m < 1) continue;
        let bottom = Infinity,
          top = -Infinity;
        for (let q = 1; q < m * 3; q += 3) {
          if (D[q] < bottom) bottom = D[q];
          if (D[q] > top) top = D[q];
        }
        into[k * nx + i].push(bottom, top);
      }
    }
  };
  for (const m of meshes) {
    const p = m.positions,
      ix = m.indices,
      moves = !!m.moves;
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const a = ix[t] * 3,
        b = ix[t + 1] * 3,
        c = ix[t + 2] * 3;
      const ax = p[a],
        ay = p[a + 1],
        az = p[a + 2],
        bx = p[b],
        by = p[b + 1],
        bz = p[b + 2],
        cx = p[c],
        cy = p[c + 1],
        cz = p[c + 2];
      const ux = bx - ax,
        uy = by - ay,
        uz = bz - az,
        vx = cx - ax,
        vy = cy - ay,
        vz = cz - az;
      const nX = uy * vz - uz * vy,
        nY = uz * vx - ux * vz,
        nZ = ux * vy - uy * vx;
      const len = Math.hypot(nX, nY, nZ);
      if (!(len > 1e-12)) continue;
      if (Math.abs(nY) < WALL_NY * len) {
        wallFace(moves ? leaves : walls, ax, ay, az, bx, by, bz, cx, cy, cz);
        continue;
      }
      // AUDIT GN-D7: A PART THAT OPENS IS NO FLOOR. A hatch's cover, a door - a part the mod's Door Controller swings
      // (`moves`: the pool's, a collider with a DoorTrigger under it) - stands in her deck as the walls it raises shut
      // (a door's leaf across its doorway: her great cabin stays a room of its own) and never as a floor: shut, the
      // new galleon's two covers were 44 cells of her deck at 6.378 over her hatchways (the Carrack's cargo doors 80 at
      // 3.639 over her hold), and open they are holes - 208 of the 552 walks between her 24 main-deck spots crossed
      // one, her crew's hatch stood on one, and the leash stood a body fallen down one on the air over it. AUDIT GN2-DK1:
      // its faces looking up as it stands shut are its `lids` - what standing aboard reads, and the leash; never her walk
      const isFlat = Math.abs(nY) >= DECK_FLAT * len;
      if (moves && !(isFlat && nY > 0)) continue;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - minX) / cell - 0.5)),
        i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - minX) / cell - 0.5));
      const k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - minZ) / cell - 0.5)),
        k1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz, cz) - minZ) / cell - 0.5));
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-12) continue;
      for (let k = k0; k <= k1; k++) {
        const z = minZ + (k + 0.5) * cell;
        for (let i = i0; i <= i1; i++) {
          const x = minX + (i + 0.5) * cell;
          const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
          const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
          const l3 = 1 - l1 - l2;
          if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
          const y = l1 * ay + l2 * by + l3 * cy;
          if (moves) {
            lids[k * nx + i].push(y);
            continue;
          }
          surf[k * nx + i].push(y);
          if (isFlat) {
            flat[k * nx + i].push(y);
            if (nY > 0) upFlat[k * nx + i].push(y);
          }
        }
      }
      // AUDIT GN-D8: a TREAD is a face looking up - the flat class reads |n.y|, so a tread's underside (or a beam's)
      // a step from two floors joined them as well as its top; her side's midpoints read upward faces alone (every
      // join on every hull rests on a tread's top today, its underside beside it - the bakes unchanged)
      if (isFlat && nY > 0 && !moves) {
        flatAt(midX, 1, 0.5, nx - 1, nz, ax, ay, az, bx, by, bz, cx, cy, cz, det);
        flatAt(midZ, 0.5, 1, nx, nz - 1, ax, ay, az, bx, by, bz, cx, cy, cz, det);
      }
    }
  }
  // GALLEON (2026-10-01): A FLIGHT FINER THAN A CELL. Her floors join cell to cell within DECK_JOIN, read at the cells'
  // centres - and a stair whose treads run shallower than a cell (the new galleon's castle flights: 0.385 m treads on
  // 0.19-0.29 m risers) puts two risers between two centres at some of their gaps: AUDIT GN-D10, measured - four of a
  // flight's fourteen tread-to-tread gaps (0.50-0.51 m), three past the motors' step, and each flight stood cut three
  // times (at z -8.41, -9.91 and -12.91). Two floors in cells side by side join within FLIGHT_JOIN too where a floor at
  // the midpoint of the side they share lies a step of the motors' from each - the tread between them, every riser the
  // motors' own step. Never across a corner: a walk takes a flight square to it.
  /** Whether floor `h1` of cell `j` and floor `h2` of `n`, a side's neighbour of it, join. */
  const linked = (j, n, h1, h2) => {
    const d = Math.abs(h1 - h2);
    if (d <= DECK_JOIN) return true;
    if (!(d <= FLIGHT_JOIN)) return false;
    const mid =
      n - j === 1 && n % nx
        ? midX[j]
        : j - n === 1 && j % nx
          ? midX[n]
          : n - j === nx
            ? midZ[j]
            : j - n === nx
              ? midZ[n]
              : null;
    if (mid) for (const m of mid) if (Math.abs(m - h1) <= DECK_JOIN && Math.abs(m - h2) <= DECK_JOIN) return true;
    return false;
  };
  // each cell's candidate floors: a flat face with DECK_HEADROOM clear to the next surface above it, and no wall in the
  // cell rising more than a tread off it within a head's height (a coaming, a stair's riser, the hull's side below are
  // no wall to it). AUDIT GN2-DK3: a door's leaf a wall to it as any (her great cabin a room of its own) - and a floor
  // a leaf alone walls, looking up, a doorway's (`doors`)
  /** Whether a wall of `w` (a cell's `walls` or `leaves`) rises more than a tread off floor `y` within a head's height. */
  const rises = (w, y) => {
    for (let q = 0; q < w.length; q += 2) if (w[q + 1] > y + DECK_STEP && w[q] < y + DECK_HEADROOM) return true;
    return false;
  };
  /** @type {number[][]} */
  const doors = Array.from({ length: nx * nz }, () => []);
  /** @type {number[][]} */
  const cand = surf.map((all, j) => {
    const out = [];
    for (const y of flat[j]) {
      let clear = true;
      for (const o of all)
        if (o > y + 1e-3 && o < y + DECK_HEADROOM) {
          clear = false;
          break;
        }
      if (!clear || rises(walls[j], y)) continue;
      if (rises(leaves[j], y)) {
        if (upFlat[j].some((u) => Math.abs(u - y) < 1e-3) && !doors[j].some((q) => Math.abs(q - y) < 1e-3))
          doors[j].push(y);
        continue;
      }
      if (!out.some((q) => Math.abs(q - y) < 1e-3)) out.push(y);
    }
    return out.sort((q, r) => r - q);
  });
  // the main deck: the level most floors stand at
  const bins = new Map();
  for (const c of cand)
    for (const y of c) {
      const b = Math.round(y / LEVEL_BIN);
      bins.set(b, (bins.get(b) ?? 0) + 1);
    }
  let mainBin = null,
    most = 0;
  for (const [b, n] of bins)
    if (n > most || (n === most && mainBin != null && b > mainBin)) {
      most = n;
      mainBin = b;
    }
  const N = nx * nz;
  const y = new Float32Array(N).fill(NaN);
  if (mainBin == null) return deckOf({ cell, minX, minZ, nx, nz, y });
  const main = mainBin * LEVEL_BIN;
  // AUDIT NAV2 F34: every floor at her main deck or over it a node, as many a cell as stand in it (a floor keeps a
  // head's room over it, so no two in one cell lie within a step of each other) - `lv` their levels, a cell's from `at`
  const at = new Int32Array(N + 1),
    lv = [];
  for (let j = 0; j < N; j++) {
    at[j] = lv.length;
    for (let q = cand[j].length - 1; q >= 0; q--) if (cand[j][q] >= main - LEVEL_BIN) lv.push(cand[j][q]);
  }
  at[N] = lv.length;
  const M = lv.length,
    nodeCell = new Int32Array(M);
  for (let j = 0; j < N; j++) for (let a = at[j]; a < at[j + 1]; a++) nodeCell[a] = j;
  /** The live node of cell `c` a step of the motors' from `h` (DECK_JOIN), -1 for none - GALLEON: or, asked from the
   *  cell `from` beside it (a side's neighbour), a flight's tread from it (`linked`). */
  const joined = (c, h, live, from = -1) => {
    for (let a = at[c]; a < at[c + 1]; a++) if (live[a] && Math.abs(lv[a] - h) <= DECK_JOIN) return a;
    if (from >= 0) for (let a = at[c]; a < at[c + 1]; a++) if (live[a] && linked(from, c, h, lv[a])) return a;
    return -1;
  };
  /** AUDIT NAV2 F32: whether cell `c` beside a floor at `h` holds a bench - her floor running on under it, and
   *  everything over that floor within a head's room a plank's face or its edge, between a step and DECK_BENCH over it
   *  (the Large Boat's thwarts) - never a wall standing on the floor (a crate's side, a mast, a cabin's), nor her side's
   *  ramp. */
  const bench = (c, h) => {
    let floor = NaN;
    for (const q of flat[c]) if (Math.abs(q - h) <= DECK_STEP && !(Math.abs(floor - h) <= Math.abs(q - h))) floor = q;
    if (Number.isNaN(floor)) return false;
    let seat = false;
    for (const s of surf[c]) {
      if (!(s > floor + 1e-3 && s < floor + DECK_HEADROOM)) continue;
      if (s <= floor + DECK_STEP || s > floor + DECK_BENCH || !flat[c].includes(s)) return false;
      seat = true;
    }
    for (let pass = 0; pass < 2; pass++) {
      // her walls, and a leaf's (AUDIT GN2-DK3: kept apart, a wall as any)
      const w = pass ? leaves[c] : walls[c];
      for (let q = 0; q < w.length; q += 2) {
        if (!(w[q + 1] > floor + DECK_STEP && w[q] < floor + DECK_HEADROOM)) continue;
        if (w[q] <= floor + DECK_STEP || w[q + 1] > floor + DECK_BENCH) return false;
        seat = true;
      }
    }
    return seat;
  };
  /** Her nodes kept `passes` cells off every edge and pieced: `live`, each one's `piece`, the largest the `open` one. */
  const settle = (passes) => {
    const live = new Uint8Array(M).fill(1);
    // kept off every edge - AUDIT NAV2 F32: of her walls and her open side, never of a bench
    for (let pass = 0; pass < passes; pass++) {
      const edge = [];
      for (let a = 0; a < M; a++) {
        if (!live[a]) continue;
        const j = nodeCell[a],
          i = j % nx,
          k = (j - i) / nx,
          h = lv[a];
        const off = (ii, kk) =>
          ii < 0 || kk < 0 || ii >= nx || kk >= nz || (joined(kk * nx + ii, h, live, j) < 0 && !bench(kk * nx + ii, h));
        if (off(i - 1, k) || off(i + 1, k) || off(i, k - 1) || off(i, k + 1)) edge.push(a);
      }
      for (const a of edge) live[a] = 0;
    }
    return pieced(live);
  };
  /** Her `live` nodes pieced: each one's `piece`, the largest the `open` one. */
  const pieced = (live) => {
    // her pieces: the floors a walk's own steps join (`path`'s: within DECK_JOIN, no corner cut past an edge) - a cabin
    // under her poop or half deck, a passage walled off, is no open deck to stand a muster on or walk
    const piece = new Int32Array(M).fill(-1),
      sizes = [];
    for (let a0 = 0; a0 < M; a0++) {
      if (!live[a0] || piece[a0] >= 0) continue;
      const id = sizes.length,
        queue = [a0];
      piece[a0] = id;
      for (let q = 0; q < queue.length; q++) {
        const a = queue[q],
          j = nodeCell[a],
          i = j % nx,
          k = (j - i) / nx,
          h = lv[a];
        for (let dk = -1; dk <= 1; dk++)
          for (let di = -1; di <= 1; di++) {
            if (!di && !dk) continue;
            const ii = i + di,
              kk = k + dk;
            if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
            const b = joined(kk * nx + ii, h, live, di && dk ? -1 : j);
            if (b < 0 || piece[b] >= 0) continue;
            if (di && dk && (joined(k * nx + ii, h, live, j) < 0 || joined(kk * nx + i, h, live, j) < 0)) continue;
            piece[b] = id;
            queue.push(b);
          }
      }
      sizes.push(queue.length);
    }
    let open = -1;
    for (let p = 0; p < sizes.length; p++) if (open < 0 || sizes[p] > sizes[open]) open = p;
    return { live, piece, open, count: open < 0 ? 0 : sizes[open] };
  };
  // GALLEON (2026-10-01): A FLIGHT KEPT. The inset never takes a raised deck's way up: a stair narrower than its
  // margin - the new galleon's two 1.4 m flights up her castle (AUDIT GN-D10: a cell clear between the port well's
  // walls, two between the starboard's, the cells either side the walls') - went whole, and her castle with her helm
  // on it stood apart from her open deck, out of every boarder's and every hand's walk. Where a floor of hers
  // FLIGHT_OVER over her main deck and FLIGHT_CELLS at the least (a raised deck - never a crate's lid) was parted from
  // her open deck by the inset, every way up to it through nodes the inset took alone is kept a cell wide: the
  // shortest from her open deck as the inset left it, beside nothing it left but that deck and the raised one (so
  // never a second file up a flight already kept - the starboard's second clear cell stays the inset's), again while
  // one is found.
  const keepFlights = (s0, all) => {
    const high = main + FLIGHT_OVER;
    const sizes = new Int32Array(M);
    for (let a = 0; a < M; a++) if (s0.live[a]) sizes[s0.piece[a]]++;
    const raised = new Uint8Array(M),
      from = new Uint8Array(M);
    let any = false;
    for (let a = 0; a < M; a++) {
      if (!s0.live[a]) continue;
      if (s0.piece[a] === s0.open) from[a] = 1;
      else if (lv[a] > high && sizes[s0.piece[a]] >= FLIGHT_CELLS) {
        raised[a] = 1;
        any = true;
      }
    }
    if (!any) return s0;
    let s = s0;
    for (;;) {
      /** Whether node `b` the inset took stands beside one kept (not `by`, the way's own last) that ends no way up - a
       *  kept flight's, a stair's. */
      const beside = (b, by) => {
        const j = nodeCell[b],
          i = j % nx,
          k = (j - i) / nx;
        for (const [ii, kk] of [
          [i - 1, k],
          [i + 1, k],
          [i, k - 1],
          [i, k + 1],
        ]) {
          if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
          const c = joined(kk * nx + ii, lv[b], s.live, j);
          if (c >= 0 && c !== by && !from[c] && !raised[c]) return true;
        }
        return false;
      };
      const back = new Int32Array(M).fill(-2),
        queue = [];
      for (let a = 0; a < M; a++)
        if (from[a]) {
          back[a] = -1;
          queue.push(a);
        }
      let reached = -1;
      for (let q = 0; q < queue.length && reached < 0; q++) {
        const a = queue[q],
          j = nodeCell[a],
          i = j % nx,
          k = (j - i) / nx,
          h = lv[a];
        // AUDIT GN-D5: SIDE STEPS ALONE. A way kept is its own nodes alone - a diagonal step in it (its corners joined
        // in the bare deck, never revived) joined nothing once the way stood: a flight turning on its landing was kept
        // as six nodes of no piece's, its raised deck still apart. Square steps only, in the walk's own order - every
        // real hull's way was square already (the bakes unchanged)
        for (const [di, dk] of SIDE_STEPS) {
          const ii = i + di,
            kk = k + dk;
          if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
          const b = joined(kk * nx + ii, h, all, j);
          if (b < 0 || back[b] !== -2) continue;
          if (s.live[b]) {
            if (raised[b] && !from[a]) {
              back[b] = a;
              reached = b;
              break;
            }
            continue;
          }
          if (beside(b, a)) continue;
          back[b] = a;
          queue.push(b);
        }
      }
      if (reached < 0) return s;
      const live = Uint8Array.from(s.live);
      for (let a = reached; a >= 0; a = back[a]) live[a] = 1;
      s = pieced(live);
    }
  };
  // AUDIT NAV2 F32: kept off her edges while that leaves her the half of her open deck (the Rowboat's lost 9 of 13)
  let s = settle(inset);
  if (inset > 0) {
    const bare = settle(0);
    if (s.count * 2 < bare.count) s = bare;
    else s = keepFlights(s, bare.live);
  }
  // her open deck the grid's own, its highest floor a cell (a stair's tread over the deck it climbs from); AUDIT NAV2
  // F34: every other floor kept beside it with its piece - 0 her open deck's (the deck under her stair), from 1 her
  // others (her poop, her cabins, the room under her forecastle)
  const top = new Int32Array(N).fill(-1);
  for (let a = 0; a < M; a++)
    if (s.live[a] && s.piece[a] === s.open) {
      y[nodeCell[a]] = lv[a];
      top[nodeCell[a]] = a;
    }
  // AUDIT GN-D-wall: HER OPEN DECK IS ONE WALK. Her open piece joins her floors at every level, her walk (`path`) the
  // grid's own alone - so a cell whose open floor lies under the piece's own higher floor all round it stood in her
  // open deck apart from every walk: once her forecastle's bulkhead walled its opening by its lintel alone (1.8 m and
  // more over her deck), the room under the Carrack's forecastle opened to her waist, its floor under her forecastle's
  // but in four cells (x -0.18 and 1.32, z 14 to 15), and her lookout's bow fell in one - out of his walk and a hand's.
  // A cell of `y` no side step of the walk's own (`linked`) joins to her largest walk keeps its floor beside it (`more`,
  // piece 0: the leash's, as her deck under her stair is), never a cell of the walk - every hull's walk reached every
  // cell of hers before, and does again
  {
    const comp = new Int32Array(N).fill(-1),
      sizes = [];
    for (let j0 = 0; j0 < N; j0++) {
      if (Number.isNaN(y[j0]) || comp[j0] >= 0) continue;
      const c = sizes.length,
        stack = [j0];
      let n = 0;
      comp[j0] = c;
      while (stack.length) {
        const j = /** @type {number} */ (stack.pop()),
          i = j % nx;
        n++;
        for (let q = 0; q < 4; q++) {
          const b = q === 0 ? (i > 0 ? j - 1 : -1) : q === 1 ? (i < nx - 1 ? j + 1 : -1) : q === 2 ? j - nx : j + nx;
          if (b < 0 || b >= N || comp[b] >= 0 || Number.isNaN(y[b]) || !linked(j, b, y[j], y[b])) continue;
          comp[b] = c;
          stack.push(b);
        }
      }
      sizes.push(n);
    }
    let big = 0;
    for (let c = 1; c < sizes.length; c++) if (sizes[c] > sizes[big]) big = c;
    for (let j = 0; j < N; j++)
      if (comp[j] >= 0 && comp[j] !== big) {
        y[j] = NaN;
        top[j] = -1;
      }
  }
  const moreAt = new Int32Array(N + 1),
    moreY = [],
    morePiece = [],
    ids = new Map();
  for (let j = 0; j < N; j++) {
    moreAt[j] = moreY.length;
    for (let a = at[j]; a < at[j + 1]; a++) {
      if (!s.live[a] || a === top[j]) continue;
      let p = 0;
      if (s.piece[a] !== s.open) {
        p = ids.get(s.piece[a]) ?? ids.size + 1;
        ids.set(s.piece[a], p);
      }
      moreY.push(lv[a]);
      morePiece.push(p);
    }
  }
  moreAt[N] = moreY.length;
  // AUDIT NAV2 F36: and every floor of hers whatever its level (her lower deck, her hold, her rowers', a rail's top).
  // AUDIT GN-D-wall: A FLOOR TO STAND ABOARD ON LOOKS UP (as a tread does, GN-D8) - a face looking down at a candidate's
  // height (her bottom under the water, her flare's underside beneath her wale) is the roof over the sea beside her,
  // never a floor a body stands on. The whole-triangle walls of her hull's sides hid most of them; once a wall marks its
  // own height in a cell they stood the water round the new galleon aboard - 1.03% of the points round her hull (0.60%
  // under the old marking over her new cut alone), the Carrack's 1.51%, the Large Galley's 3.00% - and looking up, 0.00%,
  // 0.39% and 1.48%, every point a body stands on under her main deck aboard as before. Her deck reads both (a mesh
  // wound either way - the suites' little ships are wound down - and every hull's deck is the same either way)
  const floorAt = new Int32Array(N + 1),
    floorY = [];
  for (let j = 0; j < N; j++) {
    floorAt[j] = floorY.length;
    const up = upFlat[j];
    for (const q of cand[j])
      for (let n = 0; n < up.length; n++)
        if (Math.abs(up[n] - q) < 1e-3) {
          floorY.push(q);
          break;
        }
  }
  floorAt[N] = floorY.length;
  // AUDIT GN2-DK1/DK3: HER PARTS THAT OPEN, AJAR - floors beside her deck and never of it (D7: her walk, her spots and
  // a landing never on one), what standing aboard reads (`under`) and what the leash lets a body stand on (world.js
  // navalLeash). A part's faces looking up as it stands shut (`lids`: DK1 - the Carrack's cargo doors, 4 x 5 m mid her
  // main deck and spawned shut, were a hole: 600 of the 1575 points on them read ashore, and a boarder pressing across
  // them was held 2.48 m off a player there); a floor of hers at her main deck or over it a door's leaf alone walls
  // (`doors`: DK3 - no boarder went through a door of hers, one chasing a player in the new galleon's great cabin stood
  // 4.59 m off him at her castle's front; the motor's collider holds a shut door); and the margin her inset kept off
  // each - a floor of hers it took, beside one and within DECK_JOIN of it, `inset` cells out. The deck cannot know a
  // part's state (her Animator's, each boat's), so a lid stands as it stands shut: over an open hatchway a body is a
  // lid's for the frames it falls a step (DECK_STEP) and the leash's after. Every hull's deck the bake it was (y, more,
  // floors, flights); the bake 1-2.5 ms dearer a hull (the least of 30: the galleon's 6.4 -> 7.5, the Carrack's 7.5 -> 9)
  const ajarAt = new Int32Array(N + 1),
    ajarY = [];
  {
    const sets = Array.from({ length: N }, () => []);
    const add = (j, h) => {
      if (sets[j].some((q) => Math.abs(q - h) < 1e-3)) return false;
      sets[j].push(h);
      return true;
    };
    let front = [];
    for (let j = 0; j < N; j++) {
      for (const h of lids[j]) if (add(j, h)) front.push(j, h);
      for (const h of doors[j]) if (h >= main - LEVEL_BIN && add(j, h)) front.push(j, h);
    }
    for (let pass = 0; pass < inset && front.length; pass++) {
      const next = [];
      for (let q = 0; q < front.length; q += 2) {
        const j = front[q],
          h = front[q + 1],
          i = j % nx,
          k = (j - i) / nx;
        for (let dk = -1; dk <= 1; dk++)
          for (let di = -1; di <= 1; di++) {
            const ii = i + di,
              kk = k + dk;
            if ((!di && !dk) || ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
            const c = kk * nx + ii;
            for (let a = at[c]; a < at[c + 1]; a++)
              if (!s.live[a] && Math.abs(lv[a] - h) <= DECK_JOIN && add(c, lv[a])) next.push(c, lv[a]);
          }
      }
      front = next;
    }
    for (let j = 0; j < N; j++) {
      ajarAt[j] = ajarY.length;
      for (const h of sets[j]) ajarY.push(h);
    }
    ajarAt[N] = ajarY.length;
  }
  // GALLEON: her open deck's flights, for the walk - each side two of its cells share that only a tread joins (past
  // DECK_JOIN), bit 1 a cell's +x side, bit 2 its +z
  let flights = null;
  for (let j = 0; j < N; j++) {
    if (Number.isNaN(y[j])) continue;
    if ((j + 1) % nx && Math.abs(y[j + 1] - y[j]) > DECK_JOIN && linked(j, j + 1, y[j], y[j + 1]))
      (flights ??= new Uint8Array(N))[j] |= 1;
    if (j + nx < N && Math.abs(y[j + nx] - y[j]) > DECK_JOIN && linked(j, j + nx, y[j], y[j + nx]))
      (flights ??= new Uint8Array(N))[j] |= 2;
  }
  return deckOf({
    cell,
    minX,
    minZ,
    nx,
    nz,
    y,
    more: { at: moreAt, y: Float32Array.from(moreY), piece: Int32Array.from(morePiece) },
    floors: { at: floorAt, y: Float32Array.from(floorY) },
    flights,
    ajar: { at: ajarAt, y: Float32Array.from(ajarY) },
  });
}

const _levels = new WeakMap();
/** Her main deck's level (her frame's y): the median of her deck's cells - AUDIT NAV2 F58: once a deck, which never
 *  changes (a sort of every cell, 0.46 ms on the galley, at every crew's first sight). Here beside the deck since F40:
 *  her crew's muster reads it as her crew host does. */
export function mainLevel(deck) {
  const was = _levels.get(deck);
  if (was !== undefined) return was;
  const ys = [];
  for (let j = 0; j < deck.y.length; j++) if (!Number.isNaN(deck.y[j])) ys.push(deck.y[j]);
  ys.sort((a, b) => a - b);
  const level = ys.length ? ys[ys.length >> 1] : 0;
  _levels.set(deck, level);
  return level;
}

const NO_SPOTS = Object.freeze([]);

/**
 * The deck's questions over a built grid (`buildDeck`'s, or one restored). AUDIT NAV2 F34: `more`, her floors other
 * than her open deck's own a cell (a cell's from `at`, each its `piece` - 0 her open deck, from 1 her others), and F36
 * `floors`, every floor of hers at any level (GN-D-wall: looking up) - neither in a grid made of `y` alone. GALLEON: `flights`, the sides of
 * her open deck's cells a flight's tread joins (bit 1 a cell's +x side, bit 2 its +z) - none in a grid made of `y`.
 * AUDIT GN2-DK1/DK3: `ajar`, the floors her parts that open stand over or in (a shut cover's top, a doorway a leaf alone
 * walls, the margin either side) - none in a grid made of `y`.
 * @param {{ cell: number, minX: number, minZ: number, nx: number, nz: number, y: Float32Array,
 *   more?: { at: Int32Array, y: Float32Array, piece: Int32Array } | null, floors?: { at: Int32Array, y: Float32Array } | null,
 *   flights?: Uint8Array | null, ajar?: { at: Int32Array, y: Float32Array } | null }} g
 */
export function deckOf(g) {
  const { cell, minX, minZ, nx, nz, y } = g;
  const more = g.more ?? null,
    floors = g.floors ?? null,
    flights = g.flights ?? null,
    ajar = g.ajar ?? null;
  /** GALLEON: whether a walk steps from cell `j` to `n` beside it - within DECK_JOIN, or (a side's neighbour) over a
   *  flight's tread (`flights`). */
  const steps = (j, n) => {
    const d = Math.abs(y[n] - y[j]);
    if (d <= DECK_JOIN) return true;
    if (!flights || !(d <= FLIGHT_JOIN)) return false;
    return n - j === 1
      ? n % nx !== 0 && (flights[j] & 1) !== 0
      : j - n === 1
        ? j % nx !== 0 && (flights[n] & 1) !== 0
        : n - j === nx
          ? (flights[j] & 2) !== 0
          : j - n === nx
            ? (flights[n] & 2) !== 0
            : false;
  };
  const cellOf = (x, z) => {
    const i = Math.floor((x - minX) / cell),
      k = Math.floor((z - minZ) / cell);
    return i < 0 || k < 0 || i >= nx || k >= nz ? -1 : k * nx + i;
  };
  const centre = (j) => {
    const i = j % nx,
      k = (j - i) / nx;
    return [minX + (i + 0.5) * cell, y[j], minZ + (k + 0.5) * cell];
  };
  /** AUDIT NAV2 F34: piece `p`'s floor in cell `j` - her open deck's own (0), else one of `more` - or NaN. */
  const levelOf = (j, p) => {
    if (p <= 0) return y[j];
    if (more) for (let n = more.at[j]; n < more.at[j + 1]; n++) if (more.piece[n] === p) return more.y[n];
    return NaN;
  };
  /** AUDIT GN2-DK2: of piece `p`'s floors in cell `j` the one nearest `h` - her open deck's (0) its top floor and those
   *  of it under that (`more`'s, her deck under her stair), every piece's for -1 - or NaN. */
  const floorNear = (j, p, h) => {
    let best = p > 0 ? NaN : y[j],
      d = Number.isNaN(best) ? Infinity : Math.abs(best - h);
    if (more)
      for (let n = more.at[j]; n < more.at[j + 1]; n++) {
        if (p >= 0 && more.piece[n] !== p) continue;
        const e = Math.abs(more.y[n] - h);
        if (e < d) {
          d = e;
          best = more.y[n];
        }
      }
    return best;
  };
  let pieces = 1;
  if (more) for (let n = 0; n < more.piece.length; n++) if (more.piece[n] >= pieces) pieces = more.piece[n] + 1;
  /** The deck cell whose square lies nearest `(x, z)`, -1 for none: rings out from the point's own cell (clamped onto
   *  the grid), stopping once no farther ring can hold a nearer square - ring r + 1 lies r cells off at the least.
   *  AUDIT NAV2 F34: a cell of piece `ringPiece`'s (her open deck's, 0, unless asked). AUDIT GN-D2/D4: whose floor
   *  stands within `ringBand` (DECK_STEP) of `ringLevel` when one is asked - her main deck's (`mainLevel`: her
   *  lookout's bow; a landing over her rail her main deck's own floor, DECK_FLOOR), never a raised deck. AUDIT GN2-DK2:
   *  `ringNear`, of the piece's floors in a cell the one nearest the level (`floorNear` - her deck under her stair too,
   *  every piece's for -1), that floor `ringH` (the leash's, `keep`). */
  let ringBest = -1,
    ringD = Infinity,
    qx = 0,
    qz = 0,
    ringPiece = 0,
    ringLevel = NaN,
    ringBand = DECK_STEP,
    ringNear = false,
    ringH = NaN;
  const visit = (i, k) => {
    if (i < 0 || k < 0 || i >= nx || k >= nz) return;
    const j = k * nx + i;
    const h = ringNear ? floorNear(j, ringPiece, ringLevel) : ringPiece ? levelOf(j, ringPiece) : y[j];
    if (Number.isNaN(h) || Math.abs(h - ringLevel) > ringBand) return; // (no level asked: NaN, never over)
    const x0 = minX + i * cell,
      z0 = minZ + k * cell;
    const dx = qx < x0 ? x0 - qx : qx > x0 + cell ? qx - x0 - cell : 0;
    const dz = qz < z0 ? z0 - qz : qz > z0 + cell ? qz - z0 - cell : 0;
    const d = dx * dx + dz * dz;
    if (d < ringD) {
      ringD = d;
      ringBest = j;
      ringH = h;
    }
  };
  const nearestCell = (x, z, p = 0, level = NaN, band = DECK_STEP, near = false) => {
    if (!count || p >= pieces) return -1;
    ringBest = -1;
    ringD = Infinity;
    qx = x;
    qz = z;
    ringPiece = near ? p : p > 0 ? p : 0;
    ringLevel = level ?? NaN;
    ringBand = band;
    ringNear = near;
    const ci = Math.min(nx - 1, Math.max(0, Math.floor((x - minX) / cell)));
    const ck = Math.min(nz - 1, Math.max(0, Math.floor((z - minZ) / cell)));
    const far = Math.max(ci, nx - 1 - ci, ck, nz - 1 - ck);
    for (let r = 0; r <= far; r++) {
      for (let k = ck - r; k <= ck + r; k++) {
        if (k === ck - r || k === ck + r) for (let i = ci - r; i <= ci + r; i++) visit(i, k);
        else {
          visit(ci - r, k);
          visit(ci + r, k);
        }
      }
      if (ringBest >= 0 && ringD <= (r * cell) ** 2) break;
    }
    return ringBest;
  };
  /** `(x, z)` brought into cell `j`'s square, a hair inside it, at piece `piece`'s floor there - into `out`. */
  const squareOf = (j, x, z, out, piece) => {
    const i = j % nx,
      k = (j - i) / nx,
      e = cell * 1e-3;
    const x0 = minX + i * cell,
      z0 = minZ + k * cell;
    out[0] = Math.min(x0 + cell - e, Math.max(x0 + e, x));
    out[1] = piece > 0 ? levelOf(j, piece) : y[j];
    out[2] = Math.min(z0 + cell - e, Math.max(z0 + e, z));
    return out;
  };
  /** Whether the straight line from `p0` to `p1` stays on deck: every cell it crosses (a grid walk, never samples - a
   *  sample steps over the corner two blocked cells share), and at a corner it passes through both cells beside it too
   *  (the walk's own corner rule), stepping no more than DECK_JOIN from one cell to the next (GALLEON: or up a flight). */
  const lineOnDeck = (p0, p1) => {
    let i = Math.floor((p0[0] - minX) / cell),
      k = Math.floor((p0[2] - minZ) / cell);
    const i1 = Math.floor((p1[0] - minX) / cell),
      k1 = Math.floor((p1[2] - minZ) / cell);
    if (i < 0 || k < 0 || i >= nx || k >= nz || Number.isNaN(y[k * nx + i])) return false;
    const dx = p1[0] - p0[0],
      dz = p1[2] - p0[2],
      si = Math.sign(dx),
      sk = Math.sign(dz);
    const tdx = si ? cell / Math.abs(dx) : Infinity,
      tdz = sk ? cell / Math.abs(dz) : Infinity;
    let tx = si ? (minX + (si > 0 ? i + 1 : i) * cell - p0[0]) / dx : Infinity;
    let tz = sk ? (minZ + (sk > 0 ? k + 1 : k) * cell - p0[2]) / dz : Infinity;
    let was = k * nx + i;
    const on = (ii, kk) =>
      ii >= 0 && kk >= 0 && ii < nx && kk < nz && !Number.isNaN(y[kk * nx + ii]) && steps(was, kk * nx + ii);
    for (let n = Math.abs(i1 - i) + Math.abs(k1 - k); (i !== i1 || k !== k1) && n >= 0; n--) {
      if (Math.abs(tx - tz) < 1e-9) {
        // through a corner
        if (!on(i + si, k) || !on(i, k + sk)) return false;
        i += si;
        k += sk;
        tx += tdx;
        tz += tdz;
      } else if (tx < tz) {
        i += si;
        tx += tdx;
      } else {
        k += sk;
        tz += tdz;
      }
      if (!on(i, k)) return false;
      was = k * nx + i;
    }
    return i === i1 && k === k1;
  };
  // the walk's scratch, made once a deck: a cell's cost and step back are this walk's while `seen` holds its stamp
  const cost = new Float64Array(y.length),
    from = new Int32Array(y.length),
    seen = new Uint32Array(y.length),
    shut = new Uint32Array(y.length);
  const heapF = [],
    heapJ = [];
  let stamp = 0;
  const heapPush = (f, j) => {
    let n = heapF.length;
    heapF.push(f);
    heapJ.push(j);
    while (n > 0) {
      const up = (n - 1) >> 1;
      if (heapF[up] <= f) break;
      heapF[n] = heapF[up];
      heapJ[n] = heapJ[up];
      n = up;
    }
    heapF[n] = f;
    heapJ[n] = j;
  };
  const heapPop = () => {
    const top = heapJ[0],
      lastF = heapF.pop(),
      lastJ = heapJ.pop();
    const len = heapF.length;
    if (len) {
      let n = 0;
      for (;;) {
        const l = 2 * n + 1,
          r = l + 1;
        let m = n,
          mf = lastF;
        if (l < len && heapF[l] < mf) {
          m = l;
          mf = heapF[l];
        }
        if (r < len && heapF[r] < mf) {
          m = r;
          mf = heapF[r];
        }
        if (m === n) break;
        heapF[n] = heapF[m];
        heapJ[n] = heapJ[m];
        n = m;
      }
      heapF[n] = lastF;
      heapJ[n] = lastJ;
    }
    return top;
  };
  let count = 0,
    sx = 0,
    sz = 0;
  for (let j = 0; j < y.length; j++)
    if (!Number.isNaN(y[j])) {
      count++;
      const c = centre(j);
      sx += c[0];
      sz += c[2];
    }
  /** AUDIT NAV2 F58: the spots made, a count's once (frozen); her cells' centres laid out once for them. AUDIT GN-D9:
   *  and a count's at a level (`spotsAt`, by the level) - each looked up before anything is filtered or laid out. */
  const spotsMade = new Map(),
    spotsAt = new Map();
  let spotCells = null,
    spotX = null,
    spotZ = null;
  const deck = {
    ...g,
    /** How many cells are deck. */
    count,
    /** Whether `(x, z)` (her frame) stands on deck. */
    walkable(x, z) {
      const j = cellOf(x, z);
      return j >= 0 && !Number.isNaN(y[j]);
    },
    /** The deck's height under `(x, z)`, or NaN off it. AUDIT NAV2 F34: of every piece's floors there the one nearest
     *  `h` when it is asked (a body's own height - her deck under her stair, the tread over it, her poop over her
     *  cabin); her open deck's own when it is not. AUDIT GN-D1: of `piece`'s floors alone when one is asked (0 her open
     *  deck's - its top floor there and those of it under that, her deck under her stair) - the floor a body's own
     *  piece holds there, NaN where that piece has none: the leash (world.js navalLeash) sets a body off every floor
     *  on its own piece's from any height (up off her bulwark's ramp, out of a fall), else on that piece's edge
     *  (`clamp`), NEVER ON ANOTHER PIECE'S FLOOR MORE THAN A STEP OFF. The floor nearest its height of any piece's, at
     *  any distance, dropped a boarder hugging the new galleon's port well wall (x -3.71: the wall stands 3 mm inside a
     *  cell of her great cabin's floor) off her flight 2.2-4.8 m onto her cabin's floor (192 of the 1275 points on its
     *  treads), and lifted a foe in her cabin 2.3-4.8 m onto a tread or her castle's roof (364 of 5705).
     *  @param {number} x @param {number} z @param {number} [h] @param {number} [piece] */
    heightAt(x, z, h, piece) {
      const j = cellOf(x, z);
      if (j < 0) return NaN;
      const p = piece == null ? -1 : Math.max(0, piece); // -1: every piece's
      if (h == null || !more) return p > 0 ? NaN : y[j];
      return floorNear(j, p, h);
    },
    /** AUDIT NAV2 F34: the piece whose floor under `(x, z)` stands nearest `h` - 0 her open deck, from 1 her others (her
     *  poop, a cabin) - or -1 off every floor of hers there. AUDIT GN2-DK3: -1 too where that floor lies more than `band`
     *  off `h` - a body on no floor of hers (a shut cover, a doorway: `ajar`). @param {number} x @param {number} z
     *  @param {number} h @param {number} [band] */
    pieceAt(x, z, h, band = Infinity) {
      const j = cellOf(x, z);
      if (j < 0) return -1;
      let best = Number.isNaN(y[j]) ? -1 : 0,
        d = best < 0 ? Infinity : Math.abs(y[j] - h);
      if (more)
        for (let n = more.at[j]; n < more.at[j + 1]; n++) {
          const e = Math.abs(more.y[n] - h);
          if (e < d) {
            d = e;
            best = more.piece[n];
          }
        }
      return d <= band ? best : -1;
    },
    /** AUDIT GN2-DK1/DK3: of the floors her parts that open stand over or in under `(x, z)` (`ajar`: a shut cover's top,
     *  a doorway, the margin either side) the one nearest `h`, or NaN - never her deck's (`heightAt`).
     *  @param {number} x @param {number} z @param {number} h */
    ajarAt(x, z, h) {
      const j = ajar ? cellOf(x, z) : -1;
      if (j < 0) return NaN;
      let best = NaN,
        d = Infinity;
      for (let n = ajar.at[j]; n < ajar.at[j + 1]; n++) {
        const e = Math.abs(ajar.y[n] - h);
        if (e < d) {
          d = e;
          best = ajar.y[n];
        }
      }
      return best;
    },
    /**
     * AUDIT GN2-DK2: where the leash (world.js navalLeash) puts a body off every floor at `(x, z)` (her frame) that last
     * stood at height `ref` on `piece` (-1: on none of hers - a shut cover, a doorway - and any piece's): that piece's
     * floor there nearest `ref` when it lies within FLIGHT_JOIN of it (a tread a frame's step up, her deck under her
     * stair); else the nearest point of that piece's cells holding a floor within FLIGHT_JOIN of `ref`, at that floor;
     * else its edge at any level (`clamp`). NEVER A LEVEL OF ITS PIECE MORE THAN A FLIGHT OFF WHERE ONE LIES WITHIN: her
     * open piece holds two levels in a cell since D-wall (her deck under the Carrack's forecastle beside her walk, piece
     * 0), and its floor nearest the body's height of the moment, or its edge at any level, set a walk 2-3 m onto the other
     * (the Carrack's 124 of 32904 walks over her floors at her main deck or over it, 6 of 8 across her forecastle stair's
     * top treads, 185 of 914 standing points under it; the mod's galleon's 43 of 19880 - none before D-wall). `[x, y, z]`
     * into `out`; null for a hull with no deck (`out` untouched).
     * @param {number} x @param {number} z @param {number} ref @param {number} [piece] @param {number[]} [out]
     */
    keep(x, z, ref, piece = 0, out = [0, 0, 0]) {
      const p = piece < 0 ? -1 : piece,
        c = cellOf(x, z),
        own = c < 0 ? NaN : floorNear(c, p, ref);
      if (Math.abs(own - ref) <= FLIGHT_JOIN) {
        out[0] = x;
        out[1] = own;
        out[2] = z;
        return out;
      }
      const j = nearestCell(x, z, p, ref, FLIGHT_JOIN, true);
      if (j >= 0) {
        const h = ringH;
        squareOf(j, x, z, out, 0);
        out[1] = h;
        return out;
      }
      return deck.clamp(x, z, out, Math.max(0, p));
    },
    /**
     * AUDIT NAV2 F36: whether a floor of hers - any, at any level: her decks, her hold, a galley's rowers', a rail's top
     * - stands under a point: within `reach` of `(x, z)` (her frame), no more than a step over `h` and no more than a
     * head's room under it (feet up on her rail, a gun, a crate). Standing aboard her. AUDIT GN2-DK1: a shut cover's top
     * too (`ajar` - the Carrack's cargo doors read 600 of their 1575 points ashore).
     * @param {number} x @param {number} z @param {number} h @param {number} [reach]
     */
    under(x, z, h, reach = 0) {
      const r = Math.ceil(reach / cell),
        ci = Math.floor((x - minX) / cell),
        ck = Math.floor((z - minZ) / cell);
      const lo = h - DECK_HEADROOM,
        hi = h + DECK_STEP,
        rr = reach * reach;
      for (let k = Math.max(0, ck - r); k <= Math.min(nz - 1, ck + r); k++) {
        for (let i = Math.max(0, ci - r); i <= Math.min(nx - 1, ci + r); i++) {
          const x0 = minX + i * cell,
            z0 = minZ + k * cell;
          const dx = x < x0 ? x0 - x : x > x0 + cell ? x - x0 - cell : 0,
            dz = z < z0 ? z0 - z : z > z0 + cell ? z - z0 - cell : 0;
          if (dx * dx + dz * dz > rr) continue;
          const j = k * nx + i;
          if (ajar)
            for (let n = ajar.at[j]; n < ajar.at[j + 1]; n++) if (ajar.y[n] >= lo && ajar.y[n] <= hi) return true; // AUDIT GN2-DK1: a shut cover stood on
          if (floors) {
            for (let n = floors.at[j]; n < floors.at[j + 1]; n++)
              if (floors.y[n] >= lo && floors.y[n] <= hi) return true;
            continue;
          }
          if (y[j] >= lo && y[j] <= hi) return true;
          if (more)
            for (let n = more.at[j]; n < more.at[j + 1]; n++) if (more.y[n] >= lo && more.y[n] <= hi) return true;
        }
      }
      return false;
    },
    /** The centre of the deck cell nearest `(x, z)` - `[x, y, z]` in her frame - or null for a hull with no deck. AUDIT
     *  GN-D4: of her cells within DECK_STEP of `level` alone when it is asked (her main deck's - her lookout's bow: the
     *  Carrack's lookout kept his watch up her forecastle's stair).
     *  @param {number} x @param {number} z @param {number} [level] */
    nearest(x, z, level = NaN) {
      const j = nearestCell(x, z, 0, level);
      return j < 0 ? null : centre(j);
    },
    /**
     * The deck point nearest `(x, z)` - the point itself on deck, else the nearest point of the nearest cell's square,
     * a hair inside it - `[x, y, z]` in her frame, written into `out`; null for a hull with no deck. A body pushed off
     * her deck is put back on its edge, sliding along it as it presses, never snapped to a cell's centre. AUDIT NAV2
     * F34: of `piece` - her open deck (0) unless another is asked (the one a body stood on: her poop, a cabin). AUDIT
     * GN-D-wall: and of its cells within DECK_STEP of `level` alone when one is asked (a talk's place at the floor the
     * man talked to stands on, crewLife.js - never up a flight beside him); null where none stands there.
     * @param {number} x @param {number} z @param {number[]} [out] @param {number} [piece] @param {number} [level]
     */
    clamp(x, z, out = [0, 0, 0], piece = 0, level = NaN) {
      const j = nearestCell(x, z, piece, level);
      return j < 0 ? null : squareOf(j, x, z, out, piece);
    },
    /**
     * AUDIT GN-D2: where a body put aboard her from `(x, h, z)` (her frame) comes down - a boarder over her rail, the
     * player at a boarding's start (world.js navalDeckLanding): where it stands when it stands on a floor of hers already
     * (any piece's, within DECK_STEP of `h`: her castle's roof, a tread, her great cabin - never moved off it), else the
     * point nearest it of her MAIN deck's own floor (a cell within DECK_FLOOR of `mainLevel`), never a raised deck's
     * edge nor a flight's tread: from 1.5 m off the new galleon's side aft of z -9 a landing came down on her flights'
     * treads and her castle's roof, the Carrack's on her forecastle and her stair's head - and her flights' foot treads,
     * 0.29 m up, lie within a step of her main deck (her muster's rail and spots stand on them as on it). AUDIT
     * GN-D-wall: ACROSS FROM IT - of the row of cells it stands in, the main-deck cell nearest it, and the nearest of all
     * only where its row holds none (abeam her castle, past her stem): the nearest of all drew a man 9 m off the new
     * galleon's side at z 2 along it to the corner her deck turns at her entry port (z 1.09; her bulwark opens there
     * from z -0.58 to 1.58 and her deck reaches a cell further out - 9.40 m off against 9.86 m across). `[x, y, z]` into
     * `out`; null for a hull with no deck.
     * @param {number} x @param {number} z @param {number} h @param {number[]} [out]
     */
    land(x, z, h, out = [0, 0, 0]) {
      if (!count) return null;
      const on = deck.heightAt(x, z, h);
      if (Math.abs(on - h) <= DECK_STEP) {
        out[0] = x;
        out[1] = on;
        out[2] = z;
        return out;
      }
      const lv = mainLevel(deck),
        k = Math.floor((z - minZ) / cell);
      let j = -1,
        best = Infinity;
      if (k >= 0 && k < nz) {
        for (let i = 0; i < nx; i++) {
          const c = k * nx + i,
            x0 = minX + i * cell;
          if (!(Math.abs(y[c] - lv) <= DECK_FLOOR)) continue; // (NaN off her deck: never within)
          const dx = x < x0 ? x0 - x : x > x0 + cell ? x - x0 - cell : 0;
          if (dx < best) {
            best = dx;
            j = c;
          }
        }
      }
      if (j < 0) j = nearestCell(x, z, 0, lv, DECK_FLOOR);
      return j < 0 ? null : squareOf(j, x, z, out, 0);
    },
    /**
     * Her rail's deck point on `side` (+1 her starboard, her frame's +x; -1 port) at `z`: the outermost deck cell of the
     * row there - or of the nearest row with deck - `[x, y, z]` its centre, into `out`; null for a hull with no deck.
     * (The deck point nearest a point far abeam is her widest cell whatever `z` is asked - a tapered hull's rail is no
     * clamp's.) AUDIT NAV2 F40: never past her centreline - a row whose deck lies all on her other side has no rail on
     * this one (the Small Ship's forecastle stair's top row answered a starboard rail at 0.68 m to port) - and at `level`
     * when asked, a cell within DECK_STEP of it: her main deck's rail (`mainLevel`), where her crew musters, never a
     * raised deck's edge (F34's stair and forecastle are her deck now).
     * @param {number} side @param {number} z @param {number[]} [out] @param {number} [level]
     */
    rail(side, z, out = [0, 0, 0], level = NaN) {
      if (!count) return null;
      const k0 = Math.min(nz - 1, Math.max(0, Math.floor((z - minZ) / cell)));
      for (let r = 0; r < nz; r++) {
        for (let pass = 0; pass < (r ? 2 : 1); pass++) {
          const k = pass ? k0 + r : k0 - r;
          if (k < 0 || k >= nz) continue;
          for (let n = 0; n < nx; n++) {
            const i = side > 0 ? nx - 1 - n : n,
              j = k * nx + i,
              x = minX + (i + 0.5) * cell;
            if (x * side < 0) break; // past her centreline: this row has no rail on `side`
            if (Number.isNaN(y[j]) || Math.abs(y[j] - level) > DECK_STEP) continue; // (no level asked: NaN, never over)
            out[0] = x;
            out[1] = y[j];
            out[2] = minZ + (k + 0.5) * cell;
            return out;
          }
        }
      }
      return null;
    },
    /** `n` spots spread across the deck - farthest-point sampling from the cell nearest her middle - `[x, y, z]`; GALLEON:
     *  across her cells within DECK_STEP of `level` alone when it is asked.
     *  AUDIT NAV2 F58: made once a count and kept, frozen, the spots too (every caller reads or copies them - world.js
     *  navalDeckSpots, crewLife.js), each pass's distances off her cells' centres laid out once in Float64Arrays (the
     *  float32 a Float32Array rounds to would break a tie another way than the fresh sampling's): a centre made a cell a
     *  pass was the Large Galley's spots(24) 1.3 ms and 3.7 MB, every crew stood and every boarding. */
    spots(n, level) {
      if (!count || n <= 0) return NO_SPOTS;
      // AUDIT GN-D9: THE CACHE FIRST - a cached call at a level filtered her every cell before it looked (130-170 us and
      // 30-70 KB on the new galleon and the Carrack, each crew stood and each muster; 0.1 us now); a level's spots are
      // kept by the level, one that keeps her every cell sharing her whole deck's
      const kept = level == null ? spotsMade : (spotsAt.get(level) ?? spotsAt.set(level, new Map()).get(level));
      let made = kept.get(n);
      if (made) return made;
      if (!spotCells) {
        spotCells = new Int32Array(count);
        spotX = new Float64Array(count);
        spotZ = new Float64Array(count);
        for (let j = 0, q = 0; j < y.length; j++) {
          if (Number.isNaN(y[j])) continue;
          const i = j % nx,
            k = (j - i) / nx;
          spotCells[q] = j;
          spotX[q] = minX + (i + 0.5) * cell;
          spotZ[q] = minZ + (k + 0.5) * cell;
          q++;
        }
      }
      // GALLEON (2026-10-01): `level` asked, her cells within DECK_STEP of it alone - her main deck's, her hands' work
      // (crewLife.js), never her castle's roof up its flights; every cell of hers within it, her whole deck's spots
      let cells = spotCells,
        xs = spotX,
        zs = spotZ,
        m = count;
      if (level != null) {
        const keep = [];
        for (let q = 0; q < count; q++) if (Math.abs(y[spotCells[q]] - level) <= DECK_STEP) keep.push(q);
        if (!keep.length) {
          kept.set(n, NO_SPOTS);
          return NO_SPOTS;
        }
        if (keep.length < count) {
          m = keep.length;
          cells = Int32Array.from(keep, (q) => spotCells[q]);
          xs = Float64Array.from(keep, (q) => spotX[q]);
          zs = Float64Array.from(keep, (q) => spotZ[q]);
        }
      }
      if (m === count && kept !== spotsMade) {
        // the level keeps her every cell: her whole deck's spots, one array
        made = spotsMade.get(n);
        if (made) {
          kept.set(n, made);
          return made;
        }
      }
      let first;
      if (m === count) first = deck.nearest(sx / count, sz / count);
      else {
        let cx = 0,
          cz = 0;
        for (let q = 0; q < m; q++) {
          cx += xs[q];
          cz += zs[q];
        }
        cx /= m;
        cz /= m;
        let b = 0,
          bd = Infinity;
        for (let q = 0; q < m; q++) {
          const d = (xs[q] - cx) ** 2 + (zs[q] - cz) ** 2;
          if (d < bd) {
            bd = d;
            b = q;
          }
        }
        first = centre(cells[b]);
      }
      const out = [Object.freeze(first)];
      const far = new Float64Array(m).fill(Infinity);
      while (out.length < Math.min(n, m)) {
        const last = out[out.length - 1],
          lx = last[0],
          lz = last[2];
        let best = -1,
          bestD = -1;
        for (let q = 0; q < m; q++) {
          const dx = xs[q] - lx,
            dz = zs[q] - lz,
            d = dx * dx + dz * dz;
          if (d < far[q]) far[q] = d;
          if (far[q] > bestD) {
            bestD = far[q];
            best = q;
          }
        }
        if (bestD <= 0) break;
        out.push(Object.freeze(centre(cells[best])));
      }
      made = Object.freeze(out);
      kept.set(n, made);
      if (m === count) spotsMade.set(n, made);
      return made;
    },
    /**
     * A walk from `a` to `b` (her frame, `[x, z]`): the deck cells' centres from the one nearest `a` to the one nearest
     * `b`, cell to cell within DECK_JOIN (AUDIT NAV2 F34: the motors' own step - up her stair onto her forecastle; GALLEON:
     * or a flight's tread, side to side - up the new galleon's castle stair), the
     * corners cut where the straight line between two stays on deck; null when no walk joins them.
     */
    path(a, b) {
      const s = deck.nearest(a[0], a[1]),
        e = deck.nearest(b[0], b[1]);
      if (!s || !e) return null;
      const js = cellOf(s[0], s[2]),
        je = cellOf(e[0], e[2]);
      stamp = (stamp + 1) >>> 0 || 1;
      if (stamp === 1) {
        seen.fill(0);
        shut.fill(0);
      }
      heapF.length = 0;
      heapJ.length = 0;
      const ex = e[0],
        ez = e[2];
      // AUDIT NAV2 F61: the straight line home a square root of its own - Math.hypot's care for overflow is 1.6x the cost,
      // on metres of deck it guards nothing
      const h = (j) => {
        const i = j % nx,
          k = (j - i) / nx,
          dx = minX + (i + 0.5) * cell - ex,
          dz = minZ + (k + 0.5) * cell - ez;
        return Math.sqrt(dx * dx + dz * dz);
      };
      cost[js] = 0;
      from[js] = -1;
      seen[js] = stamp;
      heapPush(h(js), js);
      while (heapF.length) {
        const j = heapPop();
        if (shut[j] === stamp) continue;
        shut[j] = stamp;
        if (j === je) break;
        const i = j % nx,
          k = (j - i) / nx;
        for (let dk = -1; dk <= 1; dk++)
          for (let di = -1; di <= 1; di++) {
            if (!di && !dk) continue;
            const ii = i + di,
              kk = k + dk;
            if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
            const n = kk * nx + ii;
            if (shut[n] === stamp || Number.isNaN(y[n]) || !steps(j, n)) continue;
            if (di && dk && !(steps(j, k * nx + ii) && steps(j, kk * nx + i))) continue; // no corner cut past the edge (AUDIT NAV2 F34: nor past a drop - a stair's tread beside the deck it climbs from)
            const c = cost[j] + (di && dk ? Math.SQRT2 : 1) * cell;
            if (seen[n] !== stamp || c < cost[n]) {
              seen[n] = stamp;
              cost[n] = c;
              from[n] = j;
              heapPush(c + h(n), n);
            }
          }
      }
      if (shut[je] !== stamp) return null;
      const cells = [];
      for (let j = je; j !== -1; j = from[j]) cells.push(j);
      cells.reverse();
      // the corners cut: from each corner on, the farthest cell ahead whose straight line from it stays on deck - AUDIT
      // NAV2 F61: each line walked cell by cell from its corner, so the cut is quadratic in the walk's cells at the
      // worst (a long straight run: every cell ahead tried, each line as long as the run so far), never linear
      const out = [centre(cells[0])];
      let at = 0;
      while (at < cells.length - 1) {
        let next = at + 1;
        const p0 = centre(cells[at]);
        for (let q = at + 2; q < cells.length && lineOnDeck(p0, centre(cells[q])); q++) next = q;
        out.push(centre(cells[next]));
        at = next;
      }
      return out;
    },
  };
  return deck;
}
