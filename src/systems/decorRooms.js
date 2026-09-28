// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR-ROOMS (2026-09-27, Discord: "For a house with multiple
// connects, add room switching tabs").
//
// A HOUSE OF SEVERAL ROOMS, FOUND IN ITS OWN WALLS. Daggerfall builds a
// building's interior as one scene and names no rooms in it, and the
// decorator treated the whole interior as one: its free camera starts
// at the owner's eye and flies no further than DECOR_FLY_LEASH, and
// since DECOR-SHELL it stops at every face - so a room behind a shut
// door, or up a stair and round a corner, could only be furnished by
// shutting the decorator, walking there and opening it again. The
// panel's tabs switch between the rooms instead: the flight starts in
// the room chosen, and the room's lists are that room's.
//
// A ROOM IS WHERE THE EYE CAN GO. The interior's own collider is
// sampled on a grid across its box: each column is cast down through
// every surface it meets, and a surface is FLOOR where a body stands on
// it - headroom above it (a table's underside is no floor) and a
// ceiling over it (a roof's top is no floor either). Two floors in
// neighbouring columns are one room when the rise between them is a
// step (a stair is a run of them) and nothing stands between them at
// waist height - a wall, or a door as it stands now, which is exactly
// what the flight itself cannot pass. The joined floors that are
// large enough to stand in are the rooms, lowest floor first.
//
// STEPPED, as the catalogue scan is: a few hundred rays a frame while
// the panel is up, never a hitch the moment it opens. Pure: the
// collider's `raycastHit` and the interior's box are arguments.
// Not a DFU member: Daggerfall Unity has no decorator. Ledger A.
// ═══════════════════════════════════════════════════════════════════

/** Metres between two samples of the floor. */
export const DECOR_ROOM_CELL = 1;
/** The most columns one house is sampled in - a larger house is sampled wider apart. */
export const DECOR_ROOM_MAX_COLUMNS = 4096;
/** A floor has at least this much room above it (a body stands there)... */
export const DECOR_ROOM_HEADROOM = 1.7;
/** ...and a ceiling within this: a surface with nothing over it is a roof's top, outside every room. */
export const DECOR_ROOM_CEILING = 10;
/** The most a floor rises from one sample to the next and stays one room - a stair's run of steps climbs. */
export const DECOR_ROOM_STEP = 0.75;
/** How high above the higher floor two neighbours are looked between - a wall stops it, a rug does not. */
export const DECOR_ROOM_WAIST = 1;
/** Fewer floors than this joined are a nook, a table top or a bed, never a room of their own. */
export const DECOR_ROOM_MIN_CELLS = 6;
/** The most surfaces one column is cast through. */
export const DECOR_ROOM_LEVELS = 8;
/** How many rays one step of the finder casts. */
export const DECOR_ROOM_RAYS_A_STEP = 600;
/** How far off the cells' middles the samples stand - off the round numbers walls are built on. */
export const DECOR_ROOM_OFFSET = 0.0173;
/** Where the flight starts in a room chosen: this far above its floor, the body's own eye. */
export const DECOR_ROOM_EYE = 1.6;

const DOWN = Object.freeze([0, -1, 0]);
const UP = Object.freeze([0, 1, 0]);

/**
 * THE FINDER for one interior: `raycastHit(origin, dir, max)` answers `{ dist }` (Infinity on a miss - player/collider.js
 * Collider.raycastHit) and `box` is the interior's `{ min: [x, y, z], max: [x, y, z] }`. `step(rays)` casts about that
 * many rays and answers whether it is done; `rooms()` the rooms once it is (null until then), each
 * `{ id, name, cells, floor, eye: [x, y, z] }` - `eye` where a flight begins in it; `roomOf(point)` the room a point
 * stands in (its floor beneath it), or null.
 * @param {{ raycastHit: (o: number[], d: readonly number[], max: number) => ({ dist: number }|null), box: { min: number[], max: number[] }, cell?: number }} o
 */
export function createDecorRooms({ raycastHit, box, cell = DECOR_ROOM_CELL }) {
  const ok = box && [0, 1, 2].every((i) => Number.isFinite(box.min?.[i]) && Number.isFinite(box.max?.[i]) && box.max[i] >= box.min[i]);
  const spanX = ok ? box.max[0] - box.min[0] : 0;
  const spanZ = ok ? box.max[2] - box.min[2] : 0;
  let size = cell > 0 ? cell : DECOR_ROOM_CELL;
  while (Math.ceil(spanX / size) * Math.ceil(spanZ / size) > DECOR_ROOM_MAX_COLUMNS) size *= 1.25;
  // the samples stand in the MIDDLE of their cells, a hair off the round numbers a room is built on: a sample on a
  // wall's own plane sees through it both ways and would join the rooms either side of it
  const nx = ok ? Math.max(1, Math.ceil(spanX / size)) : 0;
  const nz = ok ? Math.max(1, Math.ceil(spanZ / size)) : 0;
  const x0 = ok ? box.min[0] + (spanX - (nx - 1) * size) / 2 + DECOR_ROOM_OFFSET : 0;
  const z0 = ok ? box.min[2] + (spanZ - (nz - 1) * size) / 2 + DECOR_ROOM_OFFSET : 0;
  const top = ok ? box.max[1] + 0.5 : 0;
  const bottom = ok ? box.min[1] - 0.5 : 0;
  const cast = (o, d, max) => {
    let h = null;
    try { h = raycastHit(o, d, max); } catch { h = null; }
    const dist = h?.dist;
    return typeof dist === 'number' && dist >= 0 ? dist : Infinity;
  };

  /** @type {{ x: number, y: number, z: number, col: number }[]} */
  const nodes = [];
  /** @type {number[][]} column -> its floors' node indices */
  const byCol = Array.from({ length: nx * nz }, () => []);
  let col = 0;          // the next column to sample
  let link = 0;         // the next node to join to its neighbours
  const parent = [];
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };
  /** @type {any[]|null} */
  let found = null;
  /** @type {Map<number, number>} a kept component's root -> its room's index */
  const roomOfRoot = new Map();

  /** One column: every floor it passes through, top down. Answers the rays it cast. */
  function sample(c) {
    const x = x0 + (c % nx) * size;
    const z = z0 + Math.floor(c / nx) * size;
    let y = top;
    let rays = 0;
    for (let level = 0; level < DECOR_ROOM_LEVELS && y > bottom; level++) {
      const d = cast([x, y, z], DOWN, y - bottom);
      rays++;
      if (!Number.isFinite(d)) break;
      const fy = y - d;
      const head = cast([x, fy + 0.05, z], UP, DECOR_ROOM_CEILING);
      rays++;
      if (head >= DECOR_ROOM_HEADROOM && Number.isFinite(head)) {
        const i = nodes.length;
        nodes.push({ x, y: fy, z, col: c });
        parent.push(i);
        byCol[c].push(i);
      }
      y = fy - 0.05;
    }
    return rays;
  }

  /** One node joined to its floors east and south of it (west and north joined it on their turn). */
  function joinNode(i) {
    const a = nodes[i];
    const cx = a.col % nx;
    const cz = Math.floor(a.col / nx);
    let rays = 0;
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      if (cx + dx >= nx || cz + dz >= nz) continue;
      for (const j of byCol[a.col + dx + dz * nx]) {
        const b = nodes[j];
        if (Math.abs(b.y - a.y) > DECOR_ROOM_STEP) continue;
        const from = [a.x, Math.max(a.y, b.y) + DECOR_ROOM_WAIST, a.z];
        const dir = [dx, 0, dz];
        const d = cast(from, dir, size);
        rays++;
        if (d >= size - 1e-6) join(i, j);
      }
    }
    return rays;
  }

  function finish() {
    /** @type {Map<number, number[]>} */
    const groups = new Map();
    for (let i = 0; i < nodes.length; i++) {
      const r = find(i);
      let g = groups.get(r);
      if (!g) { g = []; groups.set(r, g); }
      g.push(i);
    }
    const kept = [...groups.entries()].filter(([, g]) => g.length >= DECOR_ROOM_MIN_CELLS).map(([root, g]) => {
      const floor = Math.min(...g.map((i) => nodes[i].y));
      const cxm = g.reduce((s, i) => s + nodes[i].x, 0) / g.length;
      const czm = g.reduce((s, i) => s + nodes[i].z, 0) / g.length;
      // the flight begins over the floor nearest the room's middle - a floor, so never inside a wall or a cupboard
      let best = g[0];
      let bestD = Infinity;
      for (const i of g) {
        const n = nodes[i];
        const dd = (n.x - cxm) ** 2 + (n.z - czm) ** 2 + (n.y - floor) ** 2;
        if (dd < bestD) { bestD = dd; best = i; }
      }
      const n = nodes[best];
      return { root, cells: g.length, floor, eye: [n.x, n.y + DECOR_ROOM_EYE, n.z] };
    });
    // lowest floor first, then the larger; ties by where it stands, so the same house numbers its rooms the same way
    kept.sort((a, b) => a.floor - b.floor || b.cells - a.cells || a.eye[0] - b.eye[0] || a.eye[2] - b.eye[2]);
    found = kept.map((r, k) => {
      roomOfRoot.set(r.root, k);
      return Object.freeze({ id: k + 1, name: `Room ${k + 1}`, cells: r.cells, floor: r.floor, eye: Object.freeze(r.eye) });
    });
  }

  function step(budget = DECOR_ROOM_RAYS_A_STEP) {
    if (found) return true;
    let spent = 0;
    while (spent < budget && col < nx * nz) spent += sample(col++);
    while (spent < budget && col >= nx * nz && link < nodes.length) spent += joinNode(link++);
    if (col >= nx * nz && link >= nodes.length) finish();
    return !!found;
  }

  /** The room a point stands in: the floor beneath it in its column or the next ones out, no more than a storey down. */
  function roomOf(p) {
    if (!found || !Array.isArray(p) || !nx) return null;
    const cx = Math.round((p[0] - x0) / size);
    const cz = Math.round((p[2] - z0) / size);
    let best = null;
    let bestD = Infinity;
    for (let r = 0; r <= 2 && best === null; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const gx = cx + dx, gz = cz + dz;
          if (gx < 0 || gz < 0 || gx >= nx || gz >= nz) continue;
          for (const i of byCol[gx + gz * nx]) {
            const n = nodes[i];
            const below = p[1] - n.y;
            if (below < -0.3 || below > 3.5) continue;
            const k = roomOfRoot.get(find(i));
            if (k === undefined) continue;
            const d = (n.x - p[0]) ** 2 + (n.z - p[2]) ** 2 + below * 0.01;
            if (d < bestD) { bestD = d; best = found[k]; }
          }
        }
      }
    }
    return best;
  }

  return {
    step,
    done: () => !!found,
    rooms: () => found,
    roomOf,
    /** How far along, 0..1 - the columns, then the joins. */
    progress: () => (found ? 1 : (col + link) / Math.max(1, nx * nz + nodes.length)),
  };
}
