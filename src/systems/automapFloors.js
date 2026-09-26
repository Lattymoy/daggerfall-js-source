// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EM2 — THE FLOOR MODEL: a Daggerfall dungeon has no floors, so the
// map derives them.
//
// Mac (2026-09-21): "The automap should become a 2d map and floor
// based instead of the current 3D implementation, streamlining it."
//
// THERE IS NO FLOOR FIELD TO READ. An RDB dungeon is a 3D volume of
// blocks laid on an X/Z grid, each block holding geometry at whatever
// height its models sit at; `automapModel.js` says so in its own words
// ("the grid is 3D because multi-level dungeons stack heavily in XZ").
// DFU's own automap answers this with a CUT PLANE the player slides up
// and down - which is honest and unreadable, because the player has to
// hunt for the height at which a room appears. So the port derives the
// storeys the level actually has and names them, and the plan is the
// storey rather than a height.
//
// HOW A STOREY IS FOUND, and the mistake this went through first.
// Every revealed model carries its CPU triangles and its placement
// matrix (the reveal index has since ROAD-C c2/S7, for the picker).
// The triangles that FACE UP are the ones a player stands on - the
// same slope limit the motor walks by (SLOPE_LIMIT_DEG, one home) -
// so the first cut sorted THOSE heights and started a new storey
// wherever the gap exceeded FLOOR_MIN_GAP. A hand-built fixture of two
// rooms with a RAMP between them came back as ONE storey, and it was
// right to: a ramp puts a walkable triangle at every height between
// the floors it joins, so a gap-walk over the walkable set has no gap
// to find. Every real dungeon has ramps and stairs, so that cut would
// have answered "one floor" for most of the game.
//
// A STOREY IS DEFINED BY ITS FLAT FLOOR, and a ramp merely BELONGS to
// one. So there are two thresholds, and the split is the whole idea:
// LEVEL_NY (near-horizontal) picks the triangles allowed to VOTE for a
// storey, FLOOR_NY (the motor's own walk limit) picks the triangles
// DRAWN on it. A ramp is walked and drawn and votes for nothing.
// Among the voters, a gap wider than FLOOR_MIN_GAP starts a new storey
// - the player's own capsule plus the headroom a room needs, because a
// ledge you cannot stand up under is not a storey - and each storey's
// height is the AREA-WEIGHTED mean of its voters, so one great hall
// decides a floor's level and a stray step does not move it.
//
// HOW A STOREY IS DRAWN. Assign every WALKABLE triangle (voter or
// not) to the NEAREST storey, rasterise those triangles' XZ footprint
// into a grid of cells, and the storey's plan is the OUTLINE of the
// cells that are covered - which is `boundarySegments` + `linkSegments`, the same two
// functions that ink the Iliac Bay's coastline on the world map. The
// walkable area is an island and its shore is the wall. A ramp between
// two storeys lands on both, which is what a ramp is.
//
// Pure: no DOM, no renderer, no host. The rows come in, the plan comes
// out, and test/automapfloors.test.js drives it with hand-built
// geometry - two stacked rooms, a ramp, a partly revealed hall.
//
// DISC25-A (2026-09-25, tannim and kurkku on Discord, through Mac: "the
// plane you are on + stairs going down", "clicking stairs to move up or
// down a level is good"). Three things changed, and one reason sits under
// all three: on a real dungeon the model above was too literal. Privateer's
// Hold came out as THIRTEEN storeys, because Daggerfall lays its rooms on a
// 3.2 m grid and every step of that grid is a headroom apart; each sheet
// was a few corridor ends, and each corridor end was drawn as a wall,
// because the stair that carried it on belonged to the next storey.
//   - A CELL BELONGS TO THE STOREY ITS OWN SURFACE IS NEAREST, not the one
//     its triangle's centroid is nearest (`surfaceY`). A long ramp is two
//     great triangles; by centroid its split ran along the quad's diagonal
//     and could skip a storey altogether.
//   - THE WAYS BETWEEN STOREYS ARE FOUND (`levelField`, `storeyLinks`):
//     wherever the walkable surface of one storey meets another's within a
//     stair's rise, that is a stair or a ramp, and the plan draws it and
//     never walls it off.
//   - STOREYS THAT NEVER LIE OVER ONE ANOTHER SHARE A SHEET
//     (`groupSheets`): a floor of the map is a run of storeys, bottom
//     first, none of which covers another. Only where the dungeon really
//     stacks does the player turn the page.
// ═══════════════════════════════════════════════════════════════════

import { SLOPE_LIMIT_DEG, CAPSULE_HEIGHT, STEP_OFFSET } from '../player/motor.js';

/** A triangle is a FLOOR when its normal leans up no further than the
 *  motor's own slope limit - the same test `Collider._resolveSphere`
 *  grounds a capsule by (GROUND_NY), read from the one constant so a
 *  re-tuned motor moves both. */
export const FLOOR_NY = Math.cos((SLOPE_LIMIT_DEG * Math.PI) / 180);

/** The lean a triangle may have and still VOTE for a storey. A
 *  Daggerfall floor is laid flat; twenty degrees is slack for a model
 *  placed a little off square, and well clear of any ramp a player
 *  would read as a slope. Above this a surface is walked and drawn but
 *  is not evidence of a storey - see the header's ramp note. */
export const LEVEL_NY = Math.cos((20 * Math.PI) / 180);

/** The least a storey may stand above the one below it. The player is
 *  CAPSULE_HEIGHT tall and a room needs headroom over that; a surface
 *  closer than this to the floor under it is a step, a table or a
 *  balcony rail, not another storey. */
export const FLOOR_MIN_GAP = CAPSULE_HEIGHT + 1.2;

/** The plan's grid, in world units. One unit per cell draws a 51.2
 *  block as 51 cells: fine enough that a corridor is a corridor,
 *  coarse enough that the outline is a hand's line rather than a
 *  sawtooth (roundCorners softens what is left, as it does the coast). */
export const PLAN_CELL = 1;

/** A triangle smaller than this contributes no height and no ink - the
 *  seams and slivers a mesh is full of would each vote for a storey. */
export const MIN_TRI_AREA = 0.05;

/** DISC22-G: flat triangles within this of one another are ONE LEVEL - a floor laid across several models sits
 *  at one height give or take the file's 1/40 unit, and a stair's next step does not (its rise is several times
 *  this). The levels, not the triangles, are what the storeys are chosen from. */
export const LEVEL_TOL = 0.1;

/** DISC22-G: the least floor a level must carry to ANCHOR a storey of its own - a small room's floor (3 x 4 m).
 *  A stair step, a ledge, a dais is smaller and belongs to the storey nearest it; see deriveFloors. */
export const STOREY_MIN_AREA = 12;

/** DISC22-G: the levels this near a storey's anchor are its floor, and set its height (a floor laid a hair off
 *  square, a dais) - a stair's upper steps, further off, are assigned to it but do not lift it. */
export const STOREY_NEAR = 1;

/** DISC25-A: how far two walkable surfaces in neighbouring cells may differ in height and still be ONE WAY ON - a
 *  stair's tread to the next, or a ramp across one cell. The motor climbs STEP_OFFSET at a stride, and a one-metre
 *  cell can step over a tread, so two strides and a little slack; well short of the headroom that makes two
 *  surfaces a stack (FLOOR_MIN_GAP). */
export const STAIR_RISE = 2 * STEP_OFFSET + 0.2;

/** DISC25-A: two storeys may share a sheet while they overlap in no more than this many cells (square metres) - a
 *  landing's lip under a balcony, a pillar's cap. Past it one would hide the other, and they are two floors. */
export const SHEET_OVERLAP = 4;

/** DISC25-A: the cells of one stair that lie within this many cells of one another are one stair - a flight whose
 *  top edge the one-metre grid breaks in two is still one flight. */
export const LINK_JOIN = 2;

/** `matrix` is the row's placement (a column-major 4x4, the port's own
 *  convention); a row with none is already in world space. */
function tx(m, x, y, z, out) {
  if (!m) { out[0] = x; out[1] = y; out[2] = z; return out; }
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];

/** DISC22-G: every row's floor triangles, computed ONCE. The rows are the reveal index's own objects, built once
 *  per level, so a row's triangles are a pure function of it; before this every open of the map (and every
 *  storey change and every reveal) re-transformed the whole level - 2.8 s for a ten-by-ten-block dungeon. */
const _rowTris = new WeakMap();

/** The facing a triangle's own vertices carry, turned by the placement: the ARCH3D file's plane normal (meshReader
 *  flips its y with the positions', :135/:139), which is what DFU lights the face by. The upper 3x3 is a rotation
 *  (a placement never shears), so it turns a normal as it turns a point. */
function fileUp(m, n, i0, i1, i2) {
  let x = n[i0] + n[i1] + n[i2], y = n[i0 + 1] + n[i1 + 1] + n[i2 + 1], z = n[i0 + 2] + n[i1 + 2] + n[i2 + 2];
  if (m) {
    const ny = m[1] * x + m[5] * y + m[9] * z;
    const nx = m[0] * x + m[4] * y + m[8] * z;
    const nz = m[2] * x + m[6] * y + m[10] * z;
    x = nx; y = ny; z = nz;
  }
  const len = Math.hypot(x, y, z);
  return len > 0 ? y / len : NaN;
}

/** One row's floor triangles (uncached - see floorTriangles). */
function rowFloorTriangles(r, out) {
  const p = r?.positions, idx = r?.indices;
  if (!p || !idx) return out;
  const m = r.matrix ?? null;
  const normals = r.normals ?? null;
  for (let i = 0; i + 2 < idx.length; i += 3) {
    const i0 = idx[i] * 3, i1 = idx[i + 1] * 3, i2 = idx[i + 2] * 3;
    tx(m, p[i0], p[i0 + 1], p[i0 + 2], A);
    tx(m, p[i1], p[i1 + 1], p[i1 + 2], B);
    tx(m, p[i2], p[i2 + 1], p[i2 + 2], C);
    // the cross product's own length IS twice the area, and its y
    // over that length is the normal's y - one square root, and the
    // facing and the weight both fall out of it
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (!(len > 0)) continue;              // degenerate: no facing to read
    const area = len / 2;
    if (area < MIN_TRI_AREA) continue;
    // DISC22-G: THE FILE SAYS WHICH WAY A FACE LOOKS. EM2 took the geometric normal's ABS on the premise that the
    // port's meshes are "not reliably wound" - and abs() is exactly what made every CEILING a floor: one ceilinged
    // room was two storeys and a two-storey level four ("Floor 2" was Floor 1's ceiling, drawn again). The world
    // pass culls back faces (renderer.js CULL_FACE), so the winding is reliable after all - but the file's own
    // plane normal is better than either, because it is what the face was authored to be lit by. A ceiling looks
    // down, so it is not a floor. A row with no normals (a hand-built fixture, a machinery part) keeps EM2's abs.
    const up = normals ? fileUp(m, normals, i0, i1, i2) : Math.abs(ny) / len;
    if (!(up >= FLOOR_NY)) continue;
    out.push({
      y: (A[1] + B[1] + C[1]) / 3,
      area,
      flat: up >= LEVEL_NY,   // may it vote for a storey? (the header's ramp note)
      ax: A[0], az: A[2], bx: B[0], bz: B[2], cx: C[0], cz: C[2],
      ay: A[1], by: B[1], cy: C[1],   // DISC25-A: the corners' heights, so a cell reads the surface where it stands
    });
  }
  return out;
}

/**
 * Every up-facing triangle of these rows, in world space, as
 * `{ y, area, ax, az, bx, bz, cx, cz }` - the height it sits at, the
 * weight it carries and its XZ footprint. Rows with no CPU triangles
 * (a row the layout never kept geometry for) contribute nothing.
 * @param {Array<{positions?: Float32Array|number[]|null, indices?: Uint16Array|Uint32Array|number[]|null, normals?: Float32Array|number[]|null, matrix?: number[]|Float32Array|null}>} rows
 * @returns {Array<{y:number, area:number, ax:number, az:number, bx:number, bz:number, cx:number, cz:number}>}
 */
export function floorTriangles(rows) {
  const out = [];
  for (const r of rows ?? []) {
    if (!r || typeof r !== 'object') continue;
    let mine = _rowTris.get(r);
    if (!mine) { mine = rowFloorTriangles(r, []); _rowTris.set(r, mine); }
    for (const t of mine) out.push(t);
  }
  return out;
}

/**
 * The storeys these triangles stand on, bottom first. Only the FLAT
 * ones vote (the header's ramp note). A level with no flat surface at
 * all - a cave of nothing but slopes - falls back to the whole walkable
 * set rather than answering "no floors", because a map with no storey
 * on the strip is a map that draws nothing.
 *
 * DISC22-G: A STAIR IS NOT A STOREY, AND IT DOES NOT JOIN TWO. EM2 chained the voters - each within `minGap` of the
 * last run's top joined it - and a flight of stairs is a chain of flat steps, each well inside the gap of the one
 * below: two floors twelve metres apart came back as ONE storey at the steps' mean height (5.35), the player's
 * caret on neither. So the voters are gathered into LEVELS (flat surfaces at one height, LEVEL_TOL), the levels are
 * chained into RUNS as before, and inside a run each level carrying a real floor (STOREY_MIN_AREA) at least `minGap`
 * from a bigger one ANCHORS a storey of its own - biggest first, so the great hall is a storey and the landing
 * beside it is not. A run with no anchor at all (a stairwell's ledges alone, a terraced cave) is still one storey,
 * as EM2 had it. Every level then belongs to the nearest anchor of its run.
 * @param {Array<{y:number, area:number, flat?: boolean}>} tris
 * @param {{minGap?: number, minArea?: number}} [opts]
 * @returns {Array<{index:number, y:number, y0:number, y1:number, label:string}>}
 */
export function deriveFloors(tris, { minGap = FLOOR_MIN_GAP, minArea = STOREY_MIN_AREA } = {}) {
  if (!tris?.length) return [];
  const voters = tris.filter((t) => t.flat !== false);
  const sorted = [...(voters.length ? voters : tris)].sort((a, b) => a.y - b.y);
  /** the levels: flat surfaces at one height */
  /** @type {Array<{sum:number, area:number, lo:number, hi:number, y:number}>} */
  const levels = [];
  for (const t of sorted) {
    const last = levels[levels.length - 1];
    if (last && t.y - last.hi <= LEVEL_TOL) { last.sum += t.y * t.area; last.area += t.area; last.hi = t.y; }
    else levels.push({ sum: t.y * t.area, area: t.area, lo: t.y, hi: t.y, y: 0 });
  }
  for (const l of levels) l.y = l.area > 0 ? l.sum / l.area : l.lo;
  /** the runs: levels chained by the headroom rule, EM2's own */
  const runs = [];
  for (const l of levels) {
    const last = runs[runs.length - 1];
    if (last && l.lo - last[last.length - 1].hi <= minGap) last.push(l); else runs.push([l]);
  }
  const storeys = [];
  for (const run of runs) {
    const anchors = [];
    for (const l of [...run].filter((v) => v.area >= minArea).sort((a, b) => b.area - a.area)) {
      if (anchors.every((a) => Math.abs(a.y - l.y) >= minGap)) anchors.push(l);
    }
    if (!anchors.length) {
      // a run with no floor of its own is one storey, meaned by area (EM2's reading)
      const sum = run.reduce((n, l) => n + l.sum, 0), area = run.reduce((n, l) => n + l.area, 0);
      storeys.push({ y: area > 0 ? sum / area : run[0].lo, y0: run[0].lo, y1: run[run.length - 1].hi });
      continue;
    }
    anchors.sort((a, b) => a.y - b.y);
    const mine = anchors.map((a) => ({ a, levels: [] }));
    for (const l of run) {
      let best = mine[0], bestD = Infinity;
      for (const m of mine) { const d = Math.abs(m.a.y - l.y); if (d < bestD) { bestD = d; best = m; } }
      best.levels.push(l);
    }
    for (const { a, levels: ls } of mine) {
      const near = ls.filter((l) => Math.abs(l.y - a.y) <= STOREY_NEAR);
      const sum = near.reduce((n, l) => n + l.sum, 0), area = near.reduce((n, l) => n + l.area, 0);
      storeys.push({ y: area > 0 ? sum / area : a.y, y0: Math.min(...ls.map((l) => l.lo)), y1: Math.max(...ls.map((l) => l.hi)) });
    }
  }
  return storeys.map((st, index) => ({ index, y: st.y, y0: st.y0, y1: st.y1, label: `Floor ${index + 1}` }));
}

/** Which storey this height belongs to: the nearest one. A ramp's
 *  triangles split between the two it joins, which is a ramp. */
export function floorAt(floors, y) {
  if (!floors?.length) return -1;
  let best = 0, bestD = Infinity;
  for (let i = 0; i < floors.length; i++) {
    const d = Math.abs(floors[i].y - y);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * DISC25-A: the height of a floor triangle's own surface at (px, pz) - its plane, read at that point - or the
 * triangle's mean height where it carries no corners (a hand-built fixture) or stands edge-on in plan.
 * @param {{y:number, ax:number, az:number, bx:number, bz:number, cx:number, cz:number, ay?:number, by?:number, cy?:number}} t
 */
export function surfaceY(t, px, pz) {
  if (t.ay == null || t.by == null || t.cy == null) return t.y;
  const det = (t.bz - t.cz) * (t.ax - t.cx) + (t.cx - t.bx) * (t.az - t.cz);
  if (!(Math.abs(det) > 1e-12)) return t.y;
  const l1 = ((t.bz - t.cz) * (px - t.cx) + (t.cx - t.bx) * (pz - t.cz)) / det;
  const l2 = ((t.cz - t.az) * (px - t.cx) + (t.ax - t.cx) * (pz - t.cz)) / det;
  return l1 * t.ay + l2 * t.by + (1 - l1 - l2) * t.cy;
}

/** DISC25-A: the heights a SET of storeys answers for under `floorAt` - (lo, hi], nearest-wins with a tie going to
 *  the lower storey, exactly as floorAt breaks it - widened by a hair, because it only PREFILTERS: the cell's own
 *  floorAt is the law. */
function storeyBand(floors, set) {
  let lo = Infinity, hi = -Infinity;
  for (const i of set) {
    const below = i > 0 ? (floors[i - 1].y + floors[i].y) / 2 : -Infinity;
    const above = i < floors.length - 1 ? (floors[i].y + floors[i + 1].y) / 2 : Infinity;
    if (below < lo) lo = below;
    if (above > hi) hi = above;
  }
  return { lo: lo - 1e-6, hi: hi + 1e-6 };
}

/** The storeys `wanted` names: one index (clamped, EM2's reading) or a sheet's own list. */
function storeySet(floors, wanted) {
  if (Array.isArray(wanted) || wanted instanceof Set) {
    return [...wanted].filter((i) => Number.isInteger(i) && i >= 0 && i < floors.length).sort((a, b) => a - b);
  }
  return [Math.max(0, Math.min(floors.length - 1, wanted ?? 0))];
}

/** The triangles that can put a cell on these storeys: the ones whose corners reach into the set's band. */
function trianglesFor(tris, floors, set) {
  const { lo, hi } = storeyBand(floors, set);
  return tris.filter((t) => {
    const top = t.ay == null ? t.y : Math.max(t.ay, t.by, t.cy);
    const bottom = t.ay == null ? t.y : Math.min(t.ay, t.by, t.cy);
    return top > lo && bottom <= hi;
  });
}

/** The XZ bounds of these triangles, grown by one cell so the outline
 *  has a rim of empty to close against (an island that runs off the
 *  grid's edge has no shore there). */
export function planBounds(tris, cell = PLAN_CELL) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const t of tris) {
    x0 = Math.min(x0, t.ax, t.bx, t.cx); x1 = Math.max(x1, t.ax, t.bx, t.cx);
    z0 = Math.min(z0, t.az, t.bz, t.cz); z1 = Math.max(z1, t.az, t.bz, t.cz);
  }
  if (!(x1 >= x0)) return null;
  return { x0: x0 - cell, z0: z0 - cell, x1: x1 + cell, z1: z1 + cell };
}

/** Is (px, pz) inside the triangle? Barycentric by sign, tolerant of
 *  either winding (see floorTriangles' note). */
function inTri(px, pz, t) {
  const d1 = (px - t.bx) * (t.az - t.bz) - (t.ax - t.bx) * (pz - t.bz);
  const d2 = (px - t.cx) * (t.bz - t.cz) - (t.bx - t.cx) * (pz - t.cz);
  const d3 = (px - t.ax) * (t.cz - t.az) - (t.cx - t.ax) * (pz - t.az);
  const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(neg && pos);
}

/**
 * One storey's walkable area as a grid of covered cells. A cell is
 * covered when its CENTRE lies under one of the storey's triangles -
 * the same rule the terrain's own tile tests use, and the one that
 * makes the outline sit half a cell inside the geometry rather than
 * bleeding a cell past it.
 * DISC25-A: with `keep`, a cell is covered only where the triangle's OWN SURFACE at the cell's centre passes it -
 * `keep(height)` - which is how a ramp splits between the storeys it joins at the height it crosses the line
 * between them, rather than along whichever diagonal its quad was cut on.
 * @param {Array<{y:number, area:number, ax:number, az:number, bx:number, bz:number, cx:number, cz:number}>} tris - the storey's own
 * @param {{cell?: number, bounds?: {x0:number,z0:number,x1:number,z1:number}|null, keep?: ((y:number) => boolean)|null}} [opts]
 * @returns {{w:number, h:number, cell:number, x0:number, z0:number, covered:Uint8Array, at:(x:number,y:number)=>boolean}|null}
 */
export function floorOccupancy(tris, { cell = PLAN_CELL, bounds = null, keep = null } = {}) {
  const b = bounds ?? planBounds(tris, cell);
  if (!b || !tris?.length) return null;
  const w = Math.max(1, Math.ceil((b.x1 - b.x0) / cell));
  const h = Math.max(1, Math.ceil((b.z1 - b.z0) / cell));
  const covered = new Uint8Array(w * h);
  for (const t of tris) {
    eachCellOf(t, b, w, h, cell, (k, px, pz) => {
      if (covered[k]) return;
      if (!keep || keep(surfaceY(t, px, pz))) covered[k] = 1;
    });
  }
  return {
    w, h, cell, x0: b.x0, z0: b.z0, covered,
    at: (x, y) => x >= 0 && y >= 0 && x < w && y < h && covered[y * w + x] === 1,
  };
}

/** Every cell of a grid whose CENTRE lies under the triangle, as (index, centreX, centreZ) - the one raster both the
 *  occupancy and the level field lay triangles down with, so the two can never disagree about a cell. */
function eachCellOf(t, b, w, h, cell, visit) {
  const gx0 = Math.max(0, Math.floor((Math.min(t.ax, t.bx, t.cx) - b.x0) / cell));
  const gx1 = Math.min(w - 1, Math.ceil((Math.max(t.ax, t.bx, t.cx) - b.x0) / cell));
  const gz0 = Math.max(0, Math.floor((Math.min(t.az, t.bz, t.cz) - b.z0) / cell));
  const gz1 = Math.min(h - 1, Math.ceil((Math.max(t.az, t.bz, t.cz) - b.z0) / cell));
  for (let gz = gz0; gz <= gz1; gz++) {
    const pz = b.z0 + (gz + 0.5) * cell;
    for (let gx = gx0; gx <= gx1; gx++) {
      const px = b.x0 + (gx + 0.5) * cell;
      if (inTri(px, pz, t)) visit(gz * w + gx, px, pz);
    }
  }
}

/**
 * DISC22-G: THE OUTLINE, SPLIT INTO WALL AND OPENING. `boundarySegments` inks every edge between a covered cell and
 * an empty one as wall - and a doorway into a room not yet seen is exactly such an edge, so an unexplored exit was
 * drawn as solid wall and the map could not say where to go next (DFU's 3D map shows the open mouth of a corridor
 * you have not walked). `open(x, y)` says whether a cell is REAL floor on this storey, revealed or not; an edge whose
 * far cell is real floor is an OPENING, every other edge a WALL. Unit segments in grid cells, the shape
 * boundarySegments answers, so the same `link` joins both.
 * DISC25-A: `pass(x, y)` names the far cells of a STAIR - the next storey's surface a stair climbs onto, on another
 * sheet. An edge onto one is neither: not a wall, because the way goes on, and not an opening, because it goes on
 * to another floor, which the stair's own mark says. Every Daggerfall stair between two sheets was walled across its
 * middle before this, and read as a dead end.
 * @param {(x:number, y:number) => boolean} inside - the revealed cells
 * @param {(x:number, y:number) => boolean} open - the storey's real floor, revealed or not
 * @param {((x:number, y:number) => boolean)|null} [pass] - a stair's far side, on another sheet
 * @returns {{walls: number[][], openings: number[][]}}
 */
export function splitEdges(inside, open, width, height, pass = null) {
  const walls = [], openings = [];
  const sort = (ox, oy, seg) => {
    if (open(ox, oy)) openings.push(seg);
    else if (!pass?.(ox, oy)) walls.push(seg);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const here = inside(x, y);
      if (x + 1 < width && here !== inside(x + 1, y)) {
        const [ox, oy] = here ? [x + 1, y] : [x, y];
        sort(ox, oy, [x + 1, y, x + 1, y + 1]);
      }
      if (y + 1 < height && here !== inside(x, y + 1)) {
        const [ox, oy] = here ? [x, y + 1] : [x, y];
        sort(ox, oy, [x, y + 1, x + 1, y + 1]);
      }
    }
  }
  return { walls, openings };
}

/** DISC22-G: one storey's whole floor - revealed or not - on a given grid, for splitEdges. DISC25-A: `index` may be
 *  a sheet's list of storeys, and a cell is on them by its own surface's height. */
export function storeyOccupancy(rows, floors, index, bounds, cell = PLAN_CELL) {
  const set = storeySet(floors, index);
  const want = new Set(set);
  return floorOccupancy(trianglesFor(floorTriangles(rows), floors, set), { cell, bounds, keep: (y) => want.has(floorAt(floors, y)) });
}

// ─── DISC25-A: THE LEVEL, READ ONCE ─────────────────────────────────

/**
 * DISC25-A: THE LEVEL'S FIELD - every walkable surface of every row, laid on the plan's grid a cell at a time: for
 * each covered cell, the height the surface stands at THERE, the storey that height is nearest, and the row it came
 * from. Built once per level (the sheet keys it on the rows array, as it keys the storeys), it is what the stairs
 * and the sheets are read from; the plan itself is still cut from the revealed rows by floorPlan, through the same
 * raster and the same law, so the two agree cell for cell.
 *
 * Stored packed by cell (`start[k]..start[k+1]` are cell k's surfaces), because the stairs are found by walking
 * neighbouring cells and a map of arrays per cell is most of a big dungeon's heap.
 * @param {Array<object>} rows - the level's rows (the reveal index's own)
 * @param {Array<{y:number}>} floors - deriveFloors' storeys for those rows
 * @param {{cell?: number, bounds?: {x0:number,z0:number,x1:number,z1:number}|null}} [opts]
 */
export function levelField(rows, floors, { cell = PLAN_CELL, bounds = null } = {}) {
  if (!rows?.length || !floors?.length) return null;
  const b = bounds ?? planBounds(floorTriangles(rows), cell);
  if (!b) return null;
  const w = Math.max(1, Math.ceil((b.x1 - b.x0) / cell));
  const h = Math.max(1, Math.ceil((b.z1 - b.z0) / cell));
  const cellsOf = [], ys = [];
  const rowOf = [];
  rows.forEach((r, ri) => {
    for (const t of floorTriangles([r])) {
      eachCellOf(t, b, w, h, cell, (k, px, pz) => { cellsOf.push(k); ys.push(surfaceY(t, px, pz)); rowOf.push(ri); });
    }
  });
  const n = cellsOf.length;
  const start = new Int32Array(w * h + 1);
  for (let e = 0; e < n; e++) start[cellsOf[e] + 1]++;
  for (let k = 0; k < w * h; k++) start[k + 1] += start[k];
  const fill = start.slice(0, w * h);
  const y = new Float32Array(n), storey = new Int16Array(n), row = new Int32Array(n);
  for (let e = 0; e < n; e++) {
    const at = fill[cellsOf[e]]++;
    y[at] = ys[e];
    storey[at] = floorAt(floors, ys[e]);
    row[at] = rowOf[e];
  }
  return { w, h, cell, x0: b.x0, z0: b.z0, start, y, storey, row, count: n };
}

/**
 * DISC25-A: THE STAIRS. Wherever a surface of one storey meets a surface of another - in the same cell or the next
 * one over - within STAIR_RISE of its height, the floor climbs from one storey to the other there: a flight of steps
 * or a ramp. Each such meeting is recorded from BOTH sides, and the cells on each side are gathered into one stair
 * where they lie within LINK_JOIN of each other.
 *
 * A link says where the stair leaves storey `from` (`x`, `z`, world units: the middle of its cells on that side) and
 * which way it goes on the plan (`dx`, `dz`: toward the cells it climbs onto), plus the cells themselves - `cells`
 * on its own side, which is how the sheet tells whether the player has SEEN it, and `far`, the other storey's cells
 * it steps onto, which the plan must not wall off.
 * @param {ReturnType<typeof levelField>} field
 * @param {{rise?: number, join?: number}} [opts]
 * @returns {Array<{from:number, to:number, x:number, z:number, dx:number, dz:number, cells:Int32Array, far:Int32Array}>}
 */
export function storeyLinks(field, { rise = STAIR_RISE, join = LINK_JOIN } = {}) {
  if (!field) return [];
  const { w, h, start, y, storey } = field;
  /** per ordered pair `from * 65536 + to`: the near cells, and the far cells each near cell steps onto */
  const pairs = new Map();
  const add = (s, t, a, b) => {
    const key = s * 65536 + t;
    let p = pairs.get(key);
    if (!p) pairs.set(key, p = { near: new Set(), far: new Map() });
    p.near.add(a);
    let f = p.far.get(a);
    if (!f) p.far.set(a, f = new Set());
    f.add(b);
  };
  const meet = (i, a, j, b) => {
    const s = storey[i], t = storey[j];
    if (s === t || !(Math.abs(y[i] - y[j]) <= rise)) return;
    add(s, t, a, b);
    add(t, s, b, a);
  };
  for (let k = 0; k < w * h; k++) {
    const e0 = start[k], e1 = start[k + 1];
    if (e0 === e1) continue;
    const gx = k % w, gz = (k - gx) / w;
    for (let i = e0; i < e1; i++) for (let j = i + 1; j < e1; j++) meet(i, k, j, k);
    for (const n of [gx + 1 < w ? k + 1 : -1, gz + 1 < h ? k + w : -1]) {
      if (n < 0) continue;
      for (let i = e0; i < e1; i++) for (let j = start[n]; j < start[n + 1]; j++) meet(i, k, j, n);
    }
  }
  const centre = (cells) => {
    let sx = 0, sz = 0;
    for (const k of cells) { sx += k % w; sz += Math.floor(k / w); }
    return [field.x0 + (sx / cells.length + 0.5) * field.cell, field.z0 + (sz / cells.length + 0.5) * field.cell];
  };
  const links = [];
  for (const [key, { near, far }] of [...pairs].sort((a, b) => a[0] - b[0])) {
    const from = Math.floor(key / 65536), to = key % 65536;
    const left = new Set(near);
    for (const seed of [...near].sort((a, b) => a - b)) {
      if (!left.has(seed)) continue;
      left.delete(seed);
      const comp = [seed];
      for (let q = 0; q < comp.length; q++) {
        const k = comp[q], gx = k % w, gz = (k - gx) / w;
        for (let dz = -join; dz <= join; dz++) {
          for (let dx = -join; dx <= join; dx++) {
            const x = gx + dx, z = gz + dz;
            if (x < 0 || z < 0 || x >= w || z >= h) continue;
            const n = z * w + x;
            if (left.has(n)) { left.delete(n); comp.push(n); }
          }
        }
      }
      comp.sort((a, b) => a - b);
      const farCells = [...new Set(comp.flatMap((k) => [...far.get(k)]))].sort((a, b) => a - b);
      const [x, z] = centre(comp);
      const [fx, fz] = centre(farCells);
      const len = Math.hypot(fx - x, fz - z);
      links.push({
        from, to, x, z,
        dx: len > 1e-6 ? (fx - x) / len : 0,
        dz: len > 1e-6 ? (fz - z) / len : 0,
        cells: Int32Array.from(comp),
        far: Int32Array.from(farCells),
      });
    }
  }
  return links;
}

/**
 * DISC25-A: THE SHEETS - the floors of the map, each a run of storeys, bottom first, no two of which lie over one
 * another. Two storeys STACK in a cell where both have a surface there further apart than a stair's rise (nearer,
 * it is the stair itself); past SHEET_OVERLAP such cells, one would be drawn over the other and they must be two
 * floors. Greedy from the bottom, which is the fewest sheets any run-of-storeys cut can make, and it keeps the
 * floors in the order a player climbs them.
 * @param {ReturnType<typeof levelField>} field
 * @param {Array<{index:number, y:number, y0:number, y1:number}>} floors
 * @param {{overlap?: number, rise?: number}} [opts]
 * @returns {Array<{index:number, storeys:number[], y:number, y0:number, y1:number, label:string}>}
 */
export function groupSheets(field, floors, { overlap = SHEET_OVERLAP, rise = STAIR_RISE } = {}) {
  const n = floors?.length ?? 0;
  if (!n) return [];
  const stack = new Int32Array(n * n);
  const area = new Int32Array(n);
  if (field) {
    const { start, y, storey } = field;
    const seen = new Int32Array(n).fill(-1);
    const pairSeen = new Int32Array(n * n).fill(-1);
    for (let k = 0; k + 1 < start.length; k++) {
      const e0 = start[k], e1 = start[k + 1];
      for (let i = e0; i < e1; i++) {
        const s = storey[i];
        if (seen[s] !== k) { seen[s] = k; area[s]++; }
        for (let j = i + 1; j < e1; j++) {
          const t = storey[j];
          if (t === s || !(Math.abs(y[i] - y[j]) > rise)) continue;
          const pair = Math.min(s, t) * n + Math.max(s, t);
          if (pairSeen[pair] !== k) { pairSeen[pair] = k; stack[pair]++; }
        }
      }
    }
  }
  const runs = [];
  let run = [];
  for (let i = 0; i < n; i++) {
    if (run.every((j) => stack[j * n + i] <= overlap)) run.push(i);
    else { runs.push(run); run = [i]; }
  }
  if (run.length) runs.push(run);
  return runs.map((storeys, index) => {
    // the sheet's height is its broadest storey's: the floor most of it is (a note is pinned there, a tie to the lower)
    let main = storeys[0];
    for (const s of storeys) if (area[s] > area[main]) main = s;
    return {
      index, storeys,
      y: floors[main].y,
      y0: Math.min(...storeys.map((s) => floors[s].y0 ?? floors[s].y)),
      y1: Math.max(...storeys.map((s) => floors[s].y1 ?? floors[s].y)),
      label: `Floor ${index + 1}`,
    };
  });
}

/** DISC25-A: which sheet each storey is on, as an array indexed by storey. */
export function sheetOfStorey(sheets, count) {
  const out = new Int16Array(count).fill(-1);
  for (const s of sheets ?? []) for (const i of s.storeys) if (i >= 0 && i < count) out[i] = s.index;
  return out;
}

/**
 * DISC25-A: a set of storeys' surfaces off the level field as an occupancy grid - all of them (the sheet's whole
 * floor, for the openings), or only the rows `rowMask` lets through.
 * @param {ReturnType<typeof levelField>} field
 * @param {number[]} storeys
 * @param {{rowMask?: Uint8Array|null}} [opts]
 */
export function fieldOccupancy(field, storeys, { rowMask = null } = {}) {
  if (!field) return null;
  const { w, h, start, storey, row } = field;
  const want = new Set(storeys);
  const covered = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) {
    for (let e = start[k]; e < start[k + 1]; e++) {
      if (want.has(storey[e]) && (!rowMask || rowMask[row[e]])) { covered[k] = 1; break; }
    }
  }
  return {
    w, h, cell: field.cell, x0: field.x0, z0: field.z0, covered,
    at: (x, y) => x >= 0 && y >= 0 && x < w && y < h && covered[y * w + x] === 1,
  };
}

/**
 * THE WHOLE PLAN, for one storey: the rows in, the storey list and the
 * chosen storey's chains out. `chains` are in WORLD units (x, z), so
 * the player's caret and the beacons land in the same space with no
 * second transform.
 *
 * `link` and `segments` are the ink renderer's own two functions
 * (ui/inkMap.js boundarySegments / linkSegments), handed in rather
 * than imported so this module stays free of the UI layer - the same
 * shape `inkMap` itself is driven with, and the pins drive it with the
 * real pair.
 *
 * TWO PASSES OVER ONE GRID. The automap draws what has been REVEALED
 * as an outline and washes the part the player walked THIS RUN, which
 * is two plans over the same rows. Handing `floors` and `bounds` back
 * in makes the second pass share the first's storeys and its grid, so
 * the wash lands cell for cell inside the outline; derived separately
 * they would disagree about both, because a smaller row set has fewer
 * storeys and a tighter box.
 *
 * DISC25-A: `wanted` may be a SHEET's list of storeys, cut as one plan (see groupSheets); a cell is on the plan when
 * its own surface is nearest one of them (floorOccupancy's `keep`); and `pass` - a Set of cell indices on the plan's
 * grid, the far sides of stairs onto other sheets - is handed to splitEdges, so those edges are left open.
 *
 * @param {Array<object>} rows - the REVEALED rows (the caller filters; the map draws what has been seen)
 * @param {number|number[]|null} wanted - the storey to cut, clamped into range; or a sheet's storeys
 * @param {{cell?: number, minGap?: number, segments?: Function|null, link?: Function|null, floors?: Array<object>|null, bounds?: {x0:number,z0:number,x1:number,z1:number}|null, full?: object|null, pass?: Set<number>|null}} [opts]
 * @returns {{floors: Array<object>, index: number, chains: Array<Array<{x:number,y:number}>>, openChains: Array<Array<{x:number,y:number}>>, occupancy: object|null, bounds: object|null}}
 */
/** The plain outline, for a caller that hands `full` without `segments`: every edge a wall. */
function boundarySegmentsLocal(inside, w, h) { return splitEdges(inside, () => false, w, h).walls; }

export function floorPlan(rows, wanted, {
  cell = PLAN_CELL, minGap = FLOOR_MIN_GAP, segments = null, link = null,
  floors: given = null, bounds: box = null, full = null, pass = null,
} = {}) {
  const tris = floorTriangles(rows);
  const floors = given?.length ? given : deriveFloors(tris, { minGap });
  if (!floors.length) return { floors, index: -1, chains: [], openChains: [], occupancy: null, bounds: box };
  const set = storeySet(floors, wanted);
  const index = set.length ? set[0] : -1;
  const want = new Set(set);
  const mine = set.length ? trianglesFor(tris, floors, set) : [];
  const bounds = box ?? planBounds(mine, cell);
  const occ = floorOccupancy(mine, { cell, bounds, keep: (y) => want.has(floorAt(floors, y)) });
  if (!occ || !link || (!segments && !full)) return { floors, index, chains: [], openChains: [], occupancy: occ, bounds };
  const toWorld = (chain) => chain.map((p) => ({ x: occ.x0 + p.x * cell, y: occ.z0 + p.y * cell }));
  // DISC22-G: with the storey's whole floor on the same grid, an edge onto real floor not yet seen is an opening
  const sameGrid = full && full.w === occ.w && full.h === occ.h && full.x0 === occ.x0 && full.z0 === occ.z0;
  if (sameGrid) {
    const through = pass?.size ? (x, y) => pass.has(y * occ.w + x) : null;
    const { walls, openings } = splitEdges((x, y) => occ.at(x, y), (x, y) => full.at(x, y), occ.w, occ.h, through);
    return { floors, index, chains: link(walls).map(toWorld), openChains: link(openings).map(toWorld), occupancy: occ, bounds };
  }
  const segs = (segments ?? boundarySegmentsLocal)((x, y) => occ.at(x, y), occ.w, occ.h);
  return { floors, index, chains: link(segs).map(toWorld), openChains: [], occupancy: occ, bounds };
}
