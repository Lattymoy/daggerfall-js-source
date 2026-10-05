// @ts-check
// WAYOUT1 (the delve arc, 2026-10-05 - the player, on the dungeon blocks: "removing the esoteric nature of dungeons"):
// THE WAY OUT ON THE COMPASS.
//
// A Daggerfall dungeon is a maze, and the one place a lost player always wants is the way they came in. The held map
// already keeps where they have STOOD - the walked trail, a one-metre grid at the reveal scan's 5 Hz (systems/automap.js
// automapTrailTick), saved with the map - so the way out is that trail walked backwards: a breadth-first field from the
// way in over the cells stood in (a step between two cells may climb or drop WAY_STEP_DY, a storey's stair being a run
// of such steps), each walked teleporter an edge from its entrance to its exit (systems/automap.js teleporters). The
// compass points at the farthest cell along that path, WAY_LOOK_CELLS ahead at most, that the eye can see - so it turns
// the corners the player turned, and never points through a wall. Where the trail does not reach the way in (a Recall
// into the level, a save older than the trail), the mark stands on the way in itself, as the crow flies - the held
// map's own beacon, said on the compass.
//
// Not a DFU member. Pure but for the field's cache.

/** The prefs key (the `dungeon-way-out` Features row). */
export const WAY_PREF = 'dungeonWayOut';
/** The compass mark's colour: the parchment's own light, an arrow pointing up and out - clear of the quest's gold, the
 *  party's green, the boats' teal, the Detect red and the professions' five (ui/enhancedHud.js drawWayOutMark). */
export const WAY_MARK_CSS = '#efe6cf';
/** How far one step between two cells may climb or drop (m) - a stair's tread is half of it. */
export const WAY_STEP_DY = 1;
/** A place's cell is the nearest trail cell within this (m). */
export const WAY_SNAP_M = 2.5;
/** How many cells along the path the compass looks for the farthest it can see. */
export const WAY_LOOK_CELLS = 14;
/** Within this of the way in the mark is gone: the door is in front of the player (m). */
export const WAY_HERE_M = 3;
/** The field is rebuilt at most this often while the trail grows (s). */
export const WAY_FIELD_S = 1;

/**
 * @typedef {{ pts: number[][], col: Map<string, number[]> }} TrailCells
 */
/** The trail's cells (its keys `x,y,z` - the cell's corner and the feet's half-metre height, automapTrailTick's), as
 *  points at each cell's middle and an index by column. Pure. @param {Iterable<string>|null|undefined} trail */
export function trailCells(trail) {
  /** @type {TrailCells} */
  const out = { pts: [], col: new Map() };
  for (const k of trail ?? []) {
    const [x, y, z] = String(k).split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const i = out.pts.length;
    out.pts.push([x + 0.5, y, z + 0.5]);
    const c = `${x},${z}`;
    const list = out.col.get(c);
    if (list) list.push(i); else out.col.set(c, [i]);
  }
  return out;
}

/** The nearest cell to `p` within `snap` (m), or -1. Pure. @param {TrailCells} cells @param {number[]} p */
export function nearestCell(cells, p, snap = WAY_SNAP_M) {
  if (!p) return -1;
  const cx = Math.floor(p[0]), cz = Math.floor(p[2]), r = Math.ceil(snap);
  let best = -1, bestD = snap;
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      for (const i of cells.col.get(`${cx + dx},${cz + dz}`) ?? []) {
        const q = cells.pts[i];
        const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
        if (d <= bestD) { bestD = d; best = i; }
      }
    }
  }
  return best;
}

/**
 * THE FIELD: for every cell, the next cell toward `exit` (a cell index) - -1 where the way out cannot be walked from
 * it - and whether that step is a teleporter's jump. A breadth-first walk OUT from the way in over the reversed edges:
 * two cells side by side (the eight around a column) within WAY_STEP_DY of each other's height are a step both ways;
 * a teleporter (`portals`: [entranceCell, exitCell] pairs) is a step from its entrance to its exit only, so the walk
 * reaches its entrance from its exit. Pure.
 * @param {TrailCells} cells @param {number} exit @param {ReadonlyArray<[number, number]>} [portals]
 */
export function wayField(cells, exit, portals = []) {
  const n = cells.pts.length;
  const next = new Int32Array(n).fill(-1), jump = new Uint8Array(n);
  if (!(exit >= 0 && exit < n)) return { next, jump };
  /** @type {Map<number, number[]>} the reversed teleporter edges: exit cell -> entrance cells */
  const back = new Map();
  for (const [a, b] of portals) {
    if (a >= 0 && b >= 0 && a !== b) { const l = back.get(b); if (l) l.push(a); else back.set(b, [a]); }
  }
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  queue[tail++] = exit; seen[exit] = 1; next[exit] = exit;
  while (head < tail) {
    const i = queue[head++];
    const [px, py, pz] = cells.pts[i];
    const cx = Math.floor(px), cz = Math.floor(pz);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        for (const j of cells.col.get(`${cx + dx},${cz + dz}`) ?? []) {
          if (seen[j] || Math.abs(cells.pts[j][1] - py) > WAY_STEP_DY) continue;
          seen[j] = 1; next[j] = i; queue[tail++] = j;
        }
      }
    }
    // the same column, a little up or down (a ramp's cell over a cell), is a step too
    for (const j of cells.col.get(`${cx},${cz}`) ?? []) {
      if (seen[j] || Math.abs(cells.pts[j][1] - py) > WAY_STEP_DY) continue;
      seen[j] = 1; next[j] = i; queue[tail++] = j;
    }
    for (const j of back.get(i) ?? []) {
      if (seen[j]) continue;
      seen[j] = 1; next[j] = i; jump[j] = 1; queue[tail++] = j;
    }
  }
  return { next, jump };
}

/**
 * WHERE THE COMPASS POINTS from cell `from`: along the field toward the way out, the farthest cell within `look` steps
 * that `sees(point)` says the eye can see - never past a teleporter's jump (the mark stands on the teleporter until it
 * is taken). If nothing ahead is seen, the first step. Null when `from` has no way out. Pure but for what `sees` reads.
 * @param {TrailCells} cells @param {{ next: Int32Array, jump: Uint8Array }} field @param {number} from
 * @param {(p: number[]) => boolean} sees
 */
export function wayPoint(cells, field, from, sees, look = WAY_LOOK_CELLS) {
  if (!(from >= 0) || field.next[from] < 0) return null;
  let i = from, best = null, first = null;
  for (let s = 0; s < look; s++) {
    if (field.jump[i] === 1) { first ??= cells.pts[i]; break; }   // the teleporter's own cell: the mark stands on it
    const j = field.next[i];
    if (j < 0 || j === i) break;
    const p = cells.pts[j];
    first ??= p;
    if (sees(p)) best = p;
    i = j;
  }
  return best ?? first ?? cells.pts[from];
}

/**
 * THE HOST'S READER: `aim(trail, portals, exitAt, feet, sees, nowS)` answers the compass's [x, z] for the way out, or
 * null at the way in itself. `portals` are the walked teleporters ({ entrance: { pos }, exit: { pos } }); `exitAt`
 * the way in ([x, y, z]); `feet` where the player stands. The cells and the field are kept while the trail is the same
 * size (a trail only grows) and rebuilt at most every WAY_FIELD_S while it grows - at once when it is smaller (another
 * run's record) or the way in moved.
 */
export function createWayOut({ fieldEvery = WAY_FIELD_S } = {}) {
  let size = -1, builtAt = -Infinity, exitKey = '';
  /** @type {TrailCells|null} */ let cells = null;
  /** @type {{ next: Int32Array, jump: Uint8Array }|null} */ let field = null;
  return {
    /**
     * @param {Set<string>|null|undefined} trail @param {Iterable<any>|null|undefined} portals @param {number[]|null} exitAt
     * @param {number[]|null} feet @param {(p: number[]) => boolean} sees @param {number} nowS
     * @returns {number[]|null}
     */
    aim(trail, portals, exitAt, feet, sees, nowS) {
      if (!exitAt || !feet) return null;
      if (Math.hypot(exitAt[0] - feet[0], exitAt[2] - feet[2]) <= WAY_HERE_M && Math.abs(exitAt[1] - feet[1]) <= WAY_STEP_DY * 2) return null;
      const n = trail?.size ?? 0;
      const ek = `${exitAt[0]},${exitAt[1]},${exitAt[2]}`;
      // a trail only grows on one run; one SMALLER than the field's is another run's (a new record) - rebuilt at once
      if ((n !== size || ek !== exitKey) && (n < size || nowS - builtAt >= fieldEvery || !cells || ek !== exitKey)) {
        size = n; builtAt = nowS; exitKey = ek;
        cells = trailCells(trail);
        const ends = [];
        for (const t of portals ?? []) {
          const a = nearestCell(cells, t?.entrance?.pos), b = nearestCell(cells, t?.exit?.pos);
          if (a >= 0 && b >= 0) ends.push(/** @type {[number, number]} */ ([a, b]));
        }
        field = wayField(cells, nearestCell(cells, exitAt), ends);
      }
      const from = cells ? nearestCell(cells, feet) : -1;
      const p = cells && field && from >= 0 ? wayPoint(cells, field, from, sees) : null;
      return p ? [p[0], p[2]] : [exitAt[0], exitAt[2]];   // no walked way: the way in, as the crow flies
    },
    reset() { size = -1; builtAt = -Infinity; exitKey = ''; cells = null; field = null; },
  };
}
