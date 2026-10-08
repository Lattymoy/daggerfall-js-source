// @ts-check
import { TRAIL_CELL } from './automap.js';   // AUDIT DELVE C8: the trail's own grid
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
// AUDIT DELVE (bible/01-Overview/Audit-Delve.md): the trail is filled between the scan's samples (automapTrailTick - at
// a run a sample is 1.6 m from the last and skipped a cell, and the field broke into pieces, the compass falling back to
// the crow's line through the walls it promised never to point through); the cells are parsed once and added to as the
// trail grows, on numeric column keys, and the field is built again only when the player stands off it (a crawl's
// rebuild was 18-24 ms a second at 8,000 cells); and a step between two cells is asked of the host's static geometry
// once (`stepClear`, a waist-high ray past the doors and movers) - two corridors a thin wall apart, whose cells the
// trail's grid made neighbours, are not joined through it.
//
// Not a DFU member. Pure but for the reader's cache.

/** The prefs key (the `dungeon-way-out` Features row). */
export const WAY_PREF = 'dungeonWayOut';
/** The compass mark's colour: the parchment's own light, an arrow pointing up and out - clear of the quest's gold, the
 *  party's green, the boats' teal, the Detect red and the professions' five (ui/enhancedHud.js drawWayOutMark). */
export const WAY_MARK_CSS = '#efe6cf';
/** AUDIT DELVE D9: the arrow's body - the ink the parchment's light rims (the pale alone was lost among the letters). */
export const WAY_BODY_CSS = '#2b2418';
/** How far one step between two cells may climb or drop (m) - a stair's tread is half of it. */
export const WAY_STEP_DY = 1;
/** A place's cell is the nearest trail cell within this (m). */
export const WAY_SNAP_M = 2.5;
/** How many cells along the path the compass looks for the farthest it can see. */
export const WAY_LOOK_CELLS = 14;
/** Within this of the way in the mark is gone: the door is in front of the player (m). */
export const WAY_HERE_M = 3;
/** While the player stands off the field, it is built again at most this often (s). */
export const WAY_FIELD_S = 1;
/** While the player stands on it and the trail grows, it is built again this often (s) - a loop the trail closed is a
 *  shorter way out, but the way it has is still a way. */
export const WAY_REFIELD_S = 10;
/** How many steps one build asks `stepClear` about (AUDIT DELVE C9): each step is asked once and kept, so a walk asks
 *  a few a second; a long trail loaded whole is asked over a few builds, its steps taken as clear until they are. */
export const WAY_STEP_ASKS = 2000;

/** A trail column's key: its cell [x, z] as one number (AUDIT DELVE B2: no string built per lookup). */
export const cellColumn = (x, z) => (x + 0x8000) * 0x10000 + (z + 0x8000);

/**
 * @typedef {{ pts: number[][], col: Map<number, number[]>, read: number }} TrailCells
 */
/** The trail's cells (its keys `x,y,z` - the cell on TRAIL_CELL's grid and the feet's half-metre height,
 *  automapTrailTick's), as points at each cell's middle and an index by column. `cells`, given, is extended by the keys
 *  past the `read` it has (a trail only grows on one run, in insertion order). Pure but for `cells`.
 *  @param {Iterable<string>|null|undefined} trail @param {TrailCells} [cells] */
export function trailCells(trail, cells = { pts: [], col: new Map(), read: 0 }) {
  let k = 0;
  for (const key of trail ?? []) {
    if (k++ < cells.read) continue;
    const [x, y, z] = String(key).split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const i = cells.pts.length;
    cells.pts.push([(x + 0.5) * TRAIL_CELL, y, (z + 0.5) * TRAIL_CELL]);
    const c = cellColumn(x, z);
    const list = cells.col.get(c);
    if (list) list.push(i); else cells.col.set(c, [i]);
  }
  cells.read = k;
  return cells;
}

/** The nearest cell to `p` within `snap` (m), or -1. Pure. @param {TrailCells} cells @param {number[]} p */
export function nearestCell(cells, p, snap = WAY_SNAP_M) {
  if (!p) return -1;
  const cx = Math.floor(p[0] / TRAIL_CELL), cz = Math.floor(p[2] / TRAIL_CELL), r = Math.ceil(snap / TRAIL_CELL);
  let best = -1, bestD = snap;
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      for (const i of cells.col.get(cellColumn(cx + dx, cz + dz)) ?? []) {
        const q = cells.pts[i];
        const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
        if (d <= bestD) { bestD = d; best = i; }
      }
    }
  }
  return best;
}

/** A step's wall is between its two cells, not at either end (m): a cell's middle can stand a little behind the wall
 *  the player walked along (the capsule's 0.35 inside a one-metre cell leaves its middle up to 0.15 behind the face of
 *  a wall square to the grid), and the collider meets a face from either side - a hit this near an end is that cell's
 *  own wall, not one across the step. */
export const WAY_STEP_END_M = 0.25;
/** Does a hit at `hit` (m) along a step `len` long stand across it - a wall between the two cells? Pure. */
export const stepHitCuts = (hit, len, end = WAY_STEP_END_M) => Number.isFinite(hit) && hit > end && hit < len - end;

/** A step between two cells, either way round, as one key (the asked steps, below). */
export const stepKey = (i, j) => (i < j ? i * 0x1000000 + j : j * 0x1000000 + i);

/**
 * THE FIELD: for every cell, the next cell toward `exit` (a cell index) - -1 where the way out cannot be walked from
 * it - and whether that step is a teleporter's jump. A breadth-first walk OUT from the way in over the reversed edges:
 * two cells side by side (the eight around a column, and the column itself a little up or down) within WAY_STEP_DY of
 * each other's height are a step both ways, unless `clear(i, j)` says a wall stands across it; a teleporter
 * (`portals`: [entranceCell, exitCell] pairs) is a step from its entrance to its exit only, so the walk reaches its
 * entrance from its exit. Pure but for what `clear` reads.
 * @param {TrailCells} cells @param {number} exit @param {ReadonlyArray<[number, number]>} [portals]
 * @param {(i: number, j: number) => boolean} [clear]
 */
export function wayField(cells, exit, portals = [], clear = undefined) {
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
    const cx = Math.floor(px / TRAIL_CELL), cz = Math.floor(pz / TRAIL_CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {   // the eight round the column, and the column itself (a ramp's cell over a cell)
        for (const j of cells.col.get(cellColumn(cx + dx, cz + dz)) ?? []) {
          if (seen[j] || Math.abs(cells.pts[j][1] - py) > WAY_STEP_DY) continue;
          if (clear && !clear(i, j)) continue;
          seen[j] = 1; next[j] = i; queue[tail++] = j;
        }
      }
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
  if (!(from >= 0) || !(from < field.next.length) || field.next[from] < 0) return null;
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

/** AUDIT SD III (D4): the most one aim spends asking `stepClear`, ms - a long trail loaded whole asked its 2,000 wall
 *  rays in one build (31 ms on a 135k-triangle level), and the steps left were asked by building the whole field again
 *  each second (30-40 ms, a second, for fifteen seconds). */
export const WAY_ASK_MS = 2;

/** AUDIT SD III (D4): the trail's new cells onto the field - each to a neighbour already on it, by the field's own step
 *  (and `clear`'s word), in the order they were stood in; one with none stays off until the field is built again. The
 *  field's arrays grow to hold them. Pure but for `field` and what `clear` reads.
 *  @param {TrailCells} cells @param {{ next: Int32Array, jump: Uint8Array }} field @param {number} from
 *  @param {(i: number, j: number) => boolean} [clear] */
export function attachCells(cells, field, from, clear = undefined) {
  const n = cells.pts.length;
  if (field.next.length < n) {
    const cap = Math.max(n, 2 * field.next.length);
    const next = new Int32Array(cap).fill(-1), jump = new Uint8Array(cap);
    next.set(field.next); jump.set(field.jump);
    field.next = next; field.jump = jump;
  }
  for (let j = from; j < n; j++) {
    const [px, py, pz] = cells.pts[j];
    const cx = Math.floor(px / TRAIL_CELL), cz = Math.floor(pz / TRAIL_CELL);
    let to = -1;
    for (let dx = -1; dx <= 1 && to < 0; dx++) {
      for (let dz = -1; dz <= 1 && to < 0; dz++) {
        for (const i of cells.col.get(cellColumn(cx + dx, cz + dz)) ?? []) {
          if (i === j || field.next[i] < 0 || Math.abs(cells.pts[i][1] - py) > WAY_STEP_DY) continue;
          if (clear && !clear(i, j)) continue;
          to = i;
          break;
        }
      }
    }
    if (to >= 0) { field.next[j] = to; field.jump[j] = 0; }
  }
  return field;
}

/**
 * THE HOST'S READER: `aim(trail, portals, exitAt, feet, sees, nowS)` answers the compass's [x, z] for the way out, or
 * null at the way in itself. `portals` are the walked teleporters ({ entrance: { pos }, exit: { pos } }); `exitAt`
 * the way in ([x, y, z]); `feet` where the player stands. The cells are parsed once and added to as the trail grows;
 * the field is built again at once when the trail is smaller (another run's record), the way in moved or a teleporter
 * was walked; and every WAY_REFIELD_S while the trail grows under a player on it. `stepClear(p, q)` (AUDIT DELVE C9),
 * given, says whether a step between two cells' points crosses no wall; each step is asked once and kept.
 * AUDIT SD III (D4): A WALK OVER NEW GROUND NEVER BUILDS IT WHOLE. The trail's new cells are attached to the field as
 * they come (attachCells); a player still off it - a fall, a Recall, a teleporter walked from a place the trail never
 * reached - has it built again at most every WAY_FIELD_S, then twice as long each time it leaves them off, up to
 * WAY_REFIELD_S. And the asks are paced: at most WAY_STEP_ASKS and WAY_ASK_MS an aim (`clock`, ms); a step past them is
 * taken as clear and asked in the aims that follow, and the field is built again (at most every WAY_FIELD_S) only if one
 * it walks proves walled.
 */
export function createWayOut({ fieldEvery = WAY_FIELD_S, refieldEvery = WAY_REFIELD_S, stepAsks = WAY_STEP_ASKS, askMs = WAY_ASK_MS, clock = () => performance.now() } = {}) {
  let size = -1, builtAt = -Infinity, exitKey = '', portalCount = -1, covered = 0, offWait = fieldEvery, walled = false, builds = 0;
  /** @type {TrailCells|null} */ let cells = null;
  /** @type {{ next: Int32Array, jump: Uint8Array }|null} */ let field = null;
  /** @type {Map<number, boolean>} */ let asked = new Map();
  /** the steps taken as clear unasked - pairs of cell indices, flat - and how far along them the asking is */
  let pending = [], pendingAt = 0;
  const reset = () => {
    size = -1; builtAt = -Infinity; exitKey = ''; portalCount = -1; covered = 0; offWait = fieldEvery; walled = false;
    cells = null; field = null; asked = new Map(); pending = []; pendingAt = 0;
  };
  return {
    /**
     * @param {Set<string>|null|undefined} trail @param {Iterable<any>|null|undefined} portals @param {number[]|null} exitAt
     * @param {number[]|null} feet @param {(p: number[]) => boolean} sees @param {number} nowS
     * @param {((p: number[], q: number[]) => boolean)|null} [stepClear]
     * @returns {number[]|null}
     */
    aim(trail, portals, exitAt, feet, sees, nowS, stepClear = null) {
      if (!exitAt || !feet) return null;
      if (Math.hypot(exitAt[0] - feet[0], exitAt[2] - feet[2]) <= WAY_HERE_M && Math.abs(exitAt[1] - feet[1]) <= WAY_STEP_DY * 2) return null;
      const n = trail?.size ?? 0;
      const ek = `${exitAt[0]},${exitAt[1]},${exitAt[2]}`;
      const tps = portals ? [...portals] : [];
      // a trail only grows on one run; one SMALLER than the cells' is another run's (a new record) - read again whole
      if (!cells || n < size || ek !== exitKey) { reset(); cells = trailCells(trail); }
      else if (n !== size) trailCells(trail, cells);
      const c = /** @type {TrailCells} */ (cells);
      // this aim's asks: a count and a clock (AUDIT SD III, D4)
      let left = stepAsks;
      const until = clock() + askMs;
      const spend = () => left-- > 0 && clock() < until;
      const clear = stepClear ? (/** @type {number} */ i, /** @type {number} */ j) => {
        const k = stepKey(i, j);
        const known = asked.get(k);
        if (known !== undefined) return known;
        if (!spend()) { pending.push(i, j); return true; }   // asked in the aims that follow; clear until then
        const ok = stepClear(c.pts[i], c.pts[j]) !== false;
        asked.set(k, ok);
        return ok;
      } : undefined;
      const build = () => {
        size = n; builtAt = nowS; exitKey = ek; portalCount = tps.length; walled = false; pending = []; pendingAt = 0; builds++;
        /** @type {[number, number][]} */ const ends = [];
        for (const t of tps) {
          const a = nearestCell(c, t?.entrance?.pos), b = nearestCell(c, t?.exit?.pos);
          if (a >= 0 && b >= 0) ends.push([a, b]);
        }
        field = wayField(c, nearestCell(c, exitAt), ends, clear);
        covered = c.pts.length;
      };
      const onField = (/** @type {number} */ i) => !!field && i >= 0 && i < field.next.length && field.next[i] >= 0;
      if (!field || tps.length !== portalCount) build();
      else if (covered < c.pts.length) { attachCells(c, field, covered, clear); covered = c.pts.length; }
      let from = nearestCell(c, feet);
      const grown = n !== size;
      if ((walled && nowS - builtAt >= fieldEvery) || (grown && nowS - builtAt >= refieldEvery) || (!onField(from) && nowS - builtAt >= offWait)) {
        build();
        from = nearestCell(c, feet);
        offWait = onField(from) ? fieldEvery : Math.min(refieldEvery, offWait * 2);   // still off: not again so soon
      } else if (onField(from)) offWait = fieldEvery;
      // the steps taken as clear, asked as the budget allows - a walled one the field walks builds it again
      if (stepClear && field) {
        const f = /** @type {{ next: Int32Array, jump: Uint8Array }} */ (field);
        while (pendingAt < pending.length && spend()) {
          const i = pending[pendingAt], j = pending[pendingAt + 1];
          pendingAt += 2;
          const k = stepKey(i, j);
          if (asked.has(k)) continue;
          const ok = stepClear(c.pts[i], c.pts[j]) !== false;
          asked.set(k, ok);
          if (!ok && (f.next[j] === i || f.next[i] === j)) walled = true;
        }
        if (pendingAt >= pending.length) { pending = []; pendingAt = 0; }
      }
      const p = field && from >= 0 ? wayPoint(c, field, from, sees) : null;
      return p ? [p[0], p[2]] : [exitAt[0], exitAt[2]];   // no walked way: the way in, as the crow flies
    },
    reset,
    /** How many times the whole field has been built (the tests', and a probe's). */
    builds: () => builds,
  };
}
