// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EM3-3D — THE DUNGEON IN THE ROUND: the automap sheet's plan, lifted
// back into three dimensions and drawn by the same hand.
//
// Mac (2026-09-27): "the enhanced dungeon map doesnt work in 2d ... making
// the map like the og one in 3d again but only handrawn", with a pencil
// sketch of an isometric dungeon for the look: floors as slabs with a
// ragged, hatched underside, thick walls cut at a height, flagstones,
// stairs as steps; and "you need to zoom in rotate it and all that what
// the classic one does".
//
// WHAT IT DRAWS FROM. Nothing new is read from the level. The storeys,
// the sheets, the stairs and the reveal are `systems/automap/automapFloors.js`'s
// (the level field the 2D plan is cut from, cell for cell), so the two
// renderings of one dungeon can never disagree about what has been seen:
//
//   A FLOOR CELL is a field cell with a REVEALED surface on this sheet's
//   storeys, standing at that surface's own height - so a flight of steps
//   is a run of cells climbing, and needs no stair model of its own.
//
//   A WALL CELL is an empty cell touching revealed floor (eight ways),
//   cut WALL_RISE above the highest floor it touches. It is a whole plan
//   cell thick, which on Daggerfall's one-metre grid is the sketch's own
//   proportion to a corridor.
//
//   AN OPENING is an edge onto the sheet's floor not yet seen, or onto a
//   stair's far side on another sheet (`pass`): no wall, a broken rim.
//
// THE CAMERA IS THE WINDOW'S VIEW, TURNED. The held window pans and zooms
// a flat space ({ox, oy, scale}, clamped by the sheet's size) and knows
// nothing of yaw or tilt. So the sheet's space in solid mode is the plan
// turned by `yaw` about its middle and foreshortened by `pitch`: an
// orthographic projection whose ground plane at the live sheet's height
// is exactly the window's flat space. At pitch 90 and yaw 0 it IS the 2D
// plan's space, unit for unit. Panning and zoom-to-cursor therefore stay
// the window's own code; only a turn or a tilt has to move the view, and
// the sheet hands that back through `reframe`.
//
// THE PAPER SHOWS THROUGH. The ink is laid on a transparent layer over
// the parchment, and a surface that must HIDE what is behind it is first
// cut out of the layer (destination-out) and then washed at a
// watercolour's strength. The paper's cracks and stains stay visible in
// every floor and every wall, and a wall still hides the room behind it.
//
// Pure except for the painters, which take a context and are guarded on a
// real 2D one, as every painter in this lane is.
// ═══════════════════════════════════════════════════════════════════

import { INK_RGB, PARCHMENT_RGB, rgba, PEN, HALO_PEN, NAME_FACE } from './inkMap.js';
import { STAIR_RISE, STOREY_NEAR } from '../../systems/automap/automapFloors.js';

/** The solid's proportions, in metres (plan units). */
export const SOLID = Object.freeze({
  wallRise: 1.9,     // a wall is cut this far above the floor it stands on
  slab: 0.7,         // the slab under a floor, before its ragged underside
  rag: 0.9,          // ...and how much deeper the underside wanders
  flat: 0.2,         // two surfaces nearer than this are one height (a floor's own unevenness is not a step)
  hole: 6,           // a gap in the floor this small (cells), closed all round by floor, is the raster's, not a pillar
  sight: 20,         // EM3-3D fix: how far (metres) a spot the player stood on sees across the floor, never through rock
  rays: 144,         // ...along this many sight lines
  trailRise: 1.5,    // ...and a trail point marks the floor within this height of its feet
  cutRise: 0.75,     // EM3-3D fix: a wall standing between the eye and the floor behind it is cut down to this - low
                     // enough to see the room over, high enough that a doorway still reads as a gap in a wall
  wallThick: 0.35,   // EM3-3D fix (Mac: "the walls dont need to be that thick"): a wall is drawn this thick, against its floor
  cutFacing: 0.15,   // ...when that floor lies this far (0..1, of a step straight away from the eye) behind it
});

/** EM3-3D fix: the rise of one drawn tread, in metres (a Daggerfall step is about this). */
export const STEP_RISE = 0.25;

/** The orbit: where it rests and how far it may go. The rest is a three-quarter view, as the sketch is drawn. */
export const ORBIT = Object.freeze({
  yawRest: -0.62,
  pitchRest: 1.12,   // EM3-3D classic: steep enough to look down into a room over the wall in front of it
  // Mac: "rotate it up and down as far as classic" - and then "sometimes iam able to rotate under the map that
  // shouldnt happen": at level (0) the eye is ON the floor's plane - the floors, one-sided, vanish edge-on and what
  // shows is the level's underside. The lowest tilt now always looks down on the floor, a little over 11 degrees.
  pitchMin: 0.2,
  pitchMax: Math.PI / 2,
  yawStep: Math.PI / 4,     // Q / E, and the turn buttons' press
  pitchStep: 0.16,          // R / F
  dragYaw: 0.008,           // radians per pixel of a right-drag
  dragPitch: 0.006,
  ease: 10,                 // per second, toward the goal
});

/** How strongly the storeys under the live one are drawn: one down, two down. Storeys above are cut away. */
export const GHOST = Object.freeze([1, 0.42, 0.22]);

const K_NONE = 0, K_FLOOR = 1, K_WALL = 2;
const DIRS = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]);   // N E S W on the plan (plan y runs SOUTH)

// ── THE MODEL ────────────────────────────────────────────────────────

/**
 * One sheet of the level, as solid cells on the PLAN grid (columns east, rows south - the level field's rows
 * reversed, the way automapSheet's occToPlan reverses the walked wash).
 *
 * @param {{w:number, h:number, cell:number, x0:number, z0:number, start:Int32Array, y:Float32Array, storey:Int16Array, row:Int32Array}|null} field
 * @param {number[]} storeys - the sheet's storeys
 * @param {{revealed?: Uint8Array|null, walked?: Uint8Array|null, pass?: Set<number>|null,
 *          planX0?: number, planY0?: number, rise?: number, storeyY?: ArrayLike<number>|null,
 *          trail?: Array<number[]>|null, cutYaw?: number, classified?: object|null}} [opts]
 *   `storeyY` is each storey's height (deriveFloors' `y`), what the floor is seeded at; `trail` is the world points
 *   the player has stood at (systems/automap/automap.js automapTrailPoints) - with it, only floor near them is drawn.
 *   `revealed` / `walked` are per-row masks; `pass` is field cell indices; `planX0`/`planY0` put the grid's NW
 *   corner into the sheet's plan units (the level's west edge and north edge are 0).
 */
export function buildSolid(field, storeys, opts = {}) {
  if (!field) return null;
  // EM3-3D fix (Mac: "when the walls disappear everytime it happens it lags"): the expensive half - which surface is
  // floor, what the player has seen, where the walls stand - does not depend on the turn, so a caller that keeps
  // `model.classified` hands it back as `opts.classified` and only the cutaway and the shapes are made again.
  const cls = opts.classified ?? classifySolid(field, storeys, opts);
  return shapeSolid(field, cls, opts);
}

/** The turn-free half of buildSolid: floor, sight, walls. */
export function classifySolid(field, storeys, opts = {}) {
  const { w, h, cell, start, y, storey, row } = field;
  const rise = opts.rise ?? SOLID.wallRise;
  const want = new Set(storeys);
  const N = w * h;
  const kind = new Uint8Array(N), unseen = new Uint8Array(N), pass = new Uint8Array(N), walked = new Uint8Array(N);
  const top = new Float32Array(N).fill(-Infinity), base = new Float32Array(N);
  const at = (c, r) => (c < 0 || r < 0 || c >= w || r >= h) ? -1 : r * w + c;
  let yMin = Infinity, yMax = -Infinity;

  // WHICH SURFACE IS THE FLOOR. A cell holds every upward face over it - the floor, and above it the top of a
  // wall, a beam, a pillar's cap, a crate. Taking the highest (the first cut did) stood every one of those up as a
  // tower. The floor is what a player can WALK to: seeded where a surface lies at its own storey's height, and
  // grown cell to cell only across a rise the motor can climb (STAIR_RISE) - so a flight of steps is followed up,
  // and a wall's top, a beam and a crate's lid, which nothing walks onto, are left out.
  const cand = new Array(N);    // plan cell -> [{y, row}]
  const storeyY = opts.storeyY ?? null;
  const seedQ = [];
  const H = new Float32Array(N).fill(NaN), rowAt = new Int32Array(N).fill(-1);
  for (let gz = 0; gz < h; gz++) {
    const r = h - 1 - gz;
    for (let gx = 0; gx < w; gx++) {
      const k = gz * w + gx, i = r * w + gx;
      for (let e = start[k]; e < start[k + 1]; e++) {
        if (!want.has(storey[e])) continue;
        (cand[i] ??= []).push({ y: y[e], row: row[e] });
        const atStorey = storeyY ? Math.abs(y[e] - storeyY[storey[e]]) <= STOREY_NEAR : true;
        // a seed is the LOWEST surface at storey height in its cell (the floor under a table, not the table)
        if (atStorey && !(H[i] <= y[e])) { H[i] = y[e]; rowAt[i] = row[e]; }
      }
      if (Number.isFinite(H[i])) seedQ.push(i);
    }
  }
  for (let q = 0; q < seedQ.length; q++) {
    const i = seedQ[q], c = i % w, r = (i - c) / w;
    for (const [dc, dr] of DIRS) {
      const n = at(c + dc, r + dr);
      if (n < 0 || Number.isFinite(H[n]) || !cand[n]) continue;
      let best = null;
      for (const sfc of cand[n]) {
        const d = Math.abs(sfc.y - H[i]);
        if (d <= STAIR_RISE && (!best || d < Math.abs(best.y - H[i]))) best = sfc;
      }
      if (best) { H[n] = best.y; rowAt[n] = best.row; seedQ.push(n); }
    }
  }

  // THE RASTER'S GAPS. A cell is floor when its CENTRE lies in a floor triangle (automapFloors eachCellOf), and a
  // real room is laid in slivers and fans and seams, so it comes out pocked with one- and two-cell holes - and every
  // hole was rock touching floor, so it was walled all round: the forest of towers in a round room (Mac's shot,
  // 2026-09-27). A small gap closed all round by floor is floor, at its neighbours' height.
  {
    const mark = new Uint8Array(N);
    for (let i0 = 0; i0 < N; i0++) {
      if (Number.isFinite(H[i0]) || mark[i0]) continue;
      const comp = [i0]; mark[i0] = 1;
      let open = false, big = false, lo = Infinity, rowNb = -1;
      for (let q = 0; q < comp.length; q++) {
        const i = comp[q], c = i % w, r = (i - c) / w;
        for (const [dc, dr] of DIRS) {
          const n = at(c + dc, r + dr);
          if (n < 0) { open = true; continue; }
          if (Number.isFinite(H[n])) { if (H[n] < lo) { lo = H[n]; rowNb = rowAt[n]; } continue; }
          if (!mark[n]) { mark[n] = 1; comp.push(n); }
        }
        if (comp.length > SOLID.hole) big = true;
      }
      if (open || big || !Number.isFinite(lo)) continue;
      for (const i of comp) { H[i] = lo; rowAt[i] = rowNb; }
    }
  }

  // WHAT THE PLAYER HAS SEEN. EM3-3D fix (Mac: "it stopped rendering walls here"): the first cut drew floor within a
  // WALK of the trail, so a hall wider than twice that walk was cut off mid-floor, its far walls never drawn. Now each
  // spot stood on looks out along SOLID.rays sight lines across the floor, SOLID.sight metres, stopping at the first
  // cell that is not floor (a wall, a pillar, the drop to another storey) or a rise no stair makes. So a room is
  // uncovered wall to wall from inside it, a doorway shows the slice of the next room it looks into, and nothing is
  // ever seen through rock.
  let near = null;
  if (opts.trail) {
    near = new Uint8Array(N);
    const cellOf = (wx, wz) => {
      const gx = Math.floor((wx - field.x0) / cell), gz = Math.floor((wz - field.z0) / cell);
      return (gx < 0 || gz < 0 || gx >= w || gz >= h) ? -1 : (h - 1 - gz) * w + gx;
    };
    const from = new Uint8Array(N);
    const rays = SOLID.rays, reach = SOLID.sight / cell, stepL = 0.5;
    const dirs = Array.from({ length: rays }, (_, k) => [Math.cos((k / rays) * Math.PI * 2) * stepL, Math.sin((k / rays) * Math.PI * 2) * stepL]);
    for (const [wx, wy, wz] of opts.trail) {
      const i0 = cellOf(wx, wz);
      if (i0 < 0 || from[i0] || !Number.isFinite(H[i0]) || Math.abs(H[i0] - wy) > SOLID.trailRise) continue;
      from[i0] = 1; near[i0] = 1;
      const c0 = i0 % w, r0 = (i0 - c0) / w;
      for (const [dx, dy] of dirs) {
        let x = c0 + 0.5, y = r0 + 0.5, prev = i0;
        for (let t = stepL; t <= reach; t += stepL) {
          x += dx; y += dy;
          const n = at(Math.floor(x), Math.floor(y));
          if (n === prev) continue;
          if (n < 0 || !Number.isFinite(H[n]) || Math.abs(H[n] - H[prev]) > STAIR_RISE) break;
          // a step that crosses a corner must pass by floor on one side - never between two rock cells
          const pc = prev % w, pr = (prev - pc) / w, nc = n % w, nr = (n - nc) / w;
          if (pc !== nc && pr !== nr) {
            const s1 = at(nc, pr), s2 = at(pc, nr);
            if (!(s1 >= 0 && Number.isFinite(H[s1])) && !(s2 >= 0 && Number.isFinite(H[s2]))) break;
          }
          near[n] = 1; prev = n;
        }
      }
    }
    // the sight lines fan out, so far off they pass either side of a cell: a floor cell three of whose four
    // neighbours were seen was seen
    const fill = [];
    for (let i = 0; i < N; i++) {
      if (near[i] || !Number.isFinite(H[i])) continue;
      const c = i % w, r = (i - c) / w;
      let k = 0;
      for (const [dc, dr] of DIRS) { const n = at(c + dc, r + dr); if (n >= 0 && near[n]) k++; }
      if (k >= 3) fill.push(i);
    }
    for (const i of fill) near[i] = 1;
  }

  for (let i = 0; i < N; i++) {
    if (!Number.isFinite(H[i])) continue;
    const ri = rowAt[i];
    const shown = (!opts.revealed || opts.revealed[ri]) && (!near || near[i] === 1);
    if (!shown) { unseen[i] = 1; continue; }
    kind[i] = K_FLOOR; top[i] = H[i]; base[i] = H[i];
    if (opts.walked?.[ri]) walked[i] = 1;
    yMin = Math.min(yMin, H[i]); yMax = Math.max(yMax, H[i]);
  }
  for (const k of opts.pass ?? []) { const gx = k % w, gz = (k - gx) / w; pass[(h - 1 - gz) * w + gx] = 1; }
  // the walls: rock that touches revealed floor, cut a rise above the highest floor it touches
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c;
    if (kind[i] || unseen[i] || pass[i]) continue;
    let m = -Infinity;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const n = at(c + dc, r + dr);
      if (n >= 0 && kind[n] === K_FLOOR && top[n] > m) m = top[n];
    }
    if (m > -Infinity) { kind[i] = K_WALL; base[i] = m; top[i] = m + rise; }
  }
  // close the seams: rock held between two walls is wall (a pillar's heart, a partition one cell thin)
  for (let pass2 = 0; pass2 < 2; pass2++) for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) {
    const i = r * w + c;
    if (kind[i] || unseen[i] || pass[i]) continue;
    const nN = i - w, nS = i + w, nE = i + 1, nW = i - 1;
    const isW = (n) => kind[n] === K_WALL;
    if ((isW(nN) && isW(nS)) || (isW(nE) && isW(nW))) {
      const ns = [nN, nS, nE, nW].filter(isW);
      kind[i] = K_WALL; top[i] = Math.max(...ns.map((n) => top[n])); base[i] = Math.max(...ns.map((n) => base[n]));
    }
  }
  return { kind, top, base, unseen, pass, walked, yMin, yMax };
}

/** The turned half of buildSolid: the cutaway for `opts.cutYaw`, then the slabs, the floor and what stands. */
function shapeSolid(field, cls, opts = {}) {
  const { w, h, cell } = field;
  const N = w * h;
  const at = (c, r) => (c < 0 || r < 0 || c >= w || r >= h) ? -1 : r * w + c;
  const { unseen, pass, walked, yMin, yMax } = cls;
  const base = cls.base, top = cls.top.slice();   // the cut lowers tops: never the kept ones
  // THIN WALLS. A wall cell is drawn as a strip SOLID.wallThick deep against the floor it faces, not the whole metre
  // of rock; rock that touches no floor at all (the seams between two walls) is not drawn, so the paper shows
  // between two rooms' walls as it would between two walls on a plan.
  const kind = cls.kind.slice();
  const isF = (c, r) => { const n = at(c, r); return n >= 0 && cls.kind[n] === K_FLOOR; };
  const fx0 = new Float32Array(N), fy0 = new Float32Array(N), fx1 = new Float32Array(N).fill(cell), fy1 = new Float32Array(N).fill(cell);
  {
    const T = Math.min(cell, SOLID.wallThick);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (kind[i] !== K_WALL) continue;
      const W = isF(c - 1, r), E = isF(c + 1, r), Nn = isF(c, r - 1), S = isF(c, r + 1);
      let sx = 0, sy = 0;   // which side the strip hugs on each axis: -1 west/north, +1 east/south, 0 the whole cell
      if (W || E || Nn || S) {
        if ((W || E) && (Nn || S)) { sx = 0; sy = 0; }                      // floor round a corner of it: whole
        else if (W !== E) sx = W ? -1 : 1;
        else if (Nn !== S) sy = Nn ? -1 : 1;
      } else {
        const diag = [[-1, -1], [1, -1], [1, 1], [-1, 1]].filter(([dc, dr]) => isF(c + dc, r + dr));
        if (!diag.length) { kind[i] = K_NONE; continue; }                   // a seam: nothing to hug
        if (diag.every(([dc]) => dc === diag[0][0])) sx = diag[0][0];
        if (diag.every(([, dr]) => dr === diag[0][1])) sy = diag[0][1];
      }
      if (sx < 0) fx1[i] = T; else if (sx > 0) fx0[i] = cell - T;
      if (sy < 0) fy1[i] = T; else if (sy > 0) fy0[i] = cell - T;
    }
  }
  // THE CUTAWAY (Mac, with a shot of DFU's own 3D automap: "it doesnt show the wall that hides the floor ground,
  // thats a good mechanic to make the 3d map more visible"). Seen from `cutYaw`, a wall with floor BEHIND it - on
  // the far side from the eye - is cut down to a kerb, so the room it would hide lies open; a wall with its floor in
  // front of it (the far wall of a room, facing the eye) stands whole and gives the room its shape. The camera's own
  // law: plan direction (x, y) runs away from the eye by x*sin(yaw) + y*cos(yaw) (makeCamera's `depth`, negated).
  if (opts.cutYaw != null && Number.isFinite(opts.cutYaw)) {
    const sY = Math.sin(opts.cutYaw), cY = Math.cos(opts.cutYaw);
    const lowered = [];
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (kind[i] !== K_WALL) continue;
      let hides = false;
      for (let dr = -1; dr <= 1 && !hides; dr++) for (let dc = -1; dc <= 1 && !hides; dc++) {
        if (!dc && !dr) continue;
        const n = at(c + dc, r + dr);
        if (n < 0 || kind[n] !== K_FLOOR) continue;
        const away = -(dc * sY + dr * cY) / Math.hypot(dc, dr);
        if (away > SOLID.cutFacing) hides = true;
      }
      if (hides) lowered.push(i);
    }
    for (const i of lowered) top[i] = base[i] + SOLID.cutRise;
  }
  const px0 = opts.planX0 ?? 0, py0 = opts.planY0 ?? 0;
  const solid = (n) => n >= 0 && kind[n] !== K_NONE;
  const open = (n) => n >= 0 && (unseen[n] === 1 || pass[n] === 1);

  // the cut under the floor: every edge from solid onto nothing, merged along straight runs of one height
  const slabs = [];
  for (let d = 0; d < 4; d++) {
    const [dc, dr] = DIRS[d];
    const alongC = dr !== 0;
    const outer = alongC ? h : w, inner = alongC ? w : h;
    for (let o = 0; o < outer; o++) {
      let run = null;
      for (let q = 0; q <= inner; q++) {
        let edge = false, op = false, lvl = 0, ins = 0, a0 = 0, a1 = cell;
        if (q < inner) {
          const c = alongC ? q : o, r = alongC ? o : q, i = r * w + c;
          if (kind[i]) {
            const n = at(c + dc, r + dr);
            if (!solid(n)) {
              edge = true; op = open(n); lvl = kind[i] === K_FLOOR ? top[i] : base[i];
              // a thin wall's edge is its strip's, set in from the cell's
              ins = d === 0 ? fy0[i] : d === 2 ? cell - fy1[i] : d === 1 ? cell - fx1[i] : fx0[i];
              a0 = alongC ? fx0[i] : fy0[i]; a1 = alongC ? fx1[i] : fy1[i];
            }
          }
        }
        if (run && (!edge || op !== run.open || Math.abs(lvl - run.y) > SOLID.flat || ins !== run.ins || a0 > 0 || run.a1 < cell)) { slabs.push(run); run = null; }
        if (edge && !run) run = { d, open: op, y: lvl, ins, a0, a1: cell, c: alongC ? q : o, r: alongC ? o : q, len: 0 };
        if (edge) { run.len++; run.a1 = a1; }
      }
    }
  }
  for (const s of slabs) {
    const L = (s.len - 1) * cell + s.a1 - s.a0;   // from the first strip's start to the last one's end
    const cx = px0 + s.c * cell, cy = py0 + s.r * cell;
    if (s.d === 0) Object.assign(s, { x0: cx + s.a0, y0: cy + s.ins, x1: cx + s.a0 + L, y1: cy + s.ins });
    if (s.d === 2) Object.assign(s, { x0: cx + s.a0, y0: cy + cell - s.ins, x1: cx + s.a0 + L, y1: cy + cell - s.ins });
    if (s.d === 1) Object.assign(s, { x0: cx + cell - s.ins, y0: cy + s.a0, x1: cx + cell - s.ins, y1: cy + s.a0 + L });
    if (s.d === 3) Object.assign(s, { x0: cx + s.ins, y0: cy + s.a0, x1: cx + s.ins, y1: cy + s.a0 + L });
    s.nx = DIRS[s.d][0]; s.ny = DIRS[s.d][1];
  }

  // THE RAMPS first: a floor cell a climbable rise over a floor neighbour slopes down to it (its steepest one)
  const stepOf = new Array(N).fill(null);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c;
    if (kind[i] !== K_FLOOR) continue;
    let step = null;
    for (let d = 0; d < 4; d++) {
      const n = at(c + DIRS[d][0], r + DIRS[d][1]);
      if (n < 0 || kind[n] !== K_FLOOR) continue;
      const drop = top[i] - top[n];
      if (drop > SOLID.flat && drop <= STAIR_RISE && (!step || drop > step.drop)) step = { d, drop };
    }
    stepOf[i] = step;
  }
  // ...and a wall beside a ramp slopes with it, its top the ramp's own height above it, so a stairwell's walls run
  // up with the stair instead of climbing it in blocks
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c;
    if (kind[i] !== K_WALL) continue;
    let best = -1;
    for (let d = 0; d < 4; d++) {
      const n = at(c + DIRS[d][0], r + DIRS[d][1]);
      if (n >= 0 && kind[n] === K_FLOOR && (best < 0 || top[n] > top[best])) best = n;
    }
    const st = best >= 0 ? stepOf[best] : null;
    if (!st) continue;
    // only a ramp running ALONG the wall (a wall across its foot or head is a plain wall)
    const bc = best % w, br = (best - bc) / w, side = bc !== c ? 'x' : 'y';
    if ((side === 'x' && st.d % 2 === 1) || (side === 'y' && st.d % 2 === 0)) continue;
    const lift = top[i] - base[i];   // the wall's own height (whole, or the cutaway's kerb)
    top[i] = top[best] + lift;
    stepOf[i] = st;
  }

  // flat floor (nothing lower beside it) is laid in one pass; everything else stands and is sorted
  const flat = [], cols = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c;
    if (!kind[i]) continue;
    const faces = [];
    for (let d = 0; d < 4; d++) {
      const n = at(c + DIRS[d][0], r + DIRS[d][1]);
      if (solid(n)) { if (top[n] < top[i] - SOLID.flat) faces.push({ d, bottom: top[n] }); }
      else if (kind[i] === K_WALL) faces.push({ d, bottom: base[i] });
    }
    const x = px0 + c * cell, yy = py0 + r * cell;
    if (kind[i] === K_FLOOR && !faces.length) { flat.push({ x, y: yy, top: top[i], walked: walked[i], seed: (c * 73856093) ^ (r * 19349663) }); continue; }
    const same = (d) => { const n = at(c + DIRS[d][0], r + DIRS[d][1]); return n >= 0 && kind[n] === kind[i] && Math.abs(top[n] - top[i]) < SOLID.flat; };
    // EM3-3D fix: a flight's cell (and a wall beside one) is drawn as a RAMP (stepOf, above)
    const step = stepOf[i];
    cols.push({ x, y: yy, k: kind[i], top: top[i], faces, step,
      fp: kind[i] === K_WALL ? [x + fx0[i], yy + fy0[i], x + fx1[i], yy + fy1[i]] : null, rim: [0, 1, 2, 3].map((d) => !same(d)), walked: walked[i], seed: (c * 83492791) ^ (r * 2654435761) });
  }
  // a face's upright edge is inked only where the face turns or stops
  const colAt = new Map(cols.map((q) => [`${q.x},${q.y}`, q]));
  for (const q of cols) {
    q.ends = q.faces.map((f) => {
      const [dx, dy] = DIRS[f.d];
      return [[-dy, dx], [dy, -dx]].map(([tx, ty]) => {
        const nb = colAt.get(`${q.x + tx * cell},${q.y + ty * cell}`);
        if (!nb || Math.abs(nb.top - q.top) > SOLID.flat) return true;
        return !nb.faces.some((g) => g.d === f.d && Math.abs(g.bottom - f.bottom) < SOLID.flat);
      });
    });
  }
  // the drawn floor on the FIELD's own grid (rows with +Z), so the sheet can ask whether a stair's cells were walked
  const shown = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (kind[i] === K_FLOOR) { const c = i % w, r = (i - c) / w; shown[(h - 1 - r) * w + c] = 1; }
  return { cell, slabs, flat, cols, yMin, yMax, count: flat.length + cols.length, shown, classified: cls };
}

/** The per-row mask of the rows whose keys are in `keys` - what buildSolid takes for `revealed` and `walked`. */
export function rowMaskOf(keyIndex, count, keys) {
  const m = new Uint8Array(count);
  if (!keys) return m;
  for (const k of keys) { const i = keyIndex.get(k); if (i != null) m[i] = 1; }
  return m;
}

// ── THE CAMERA ───────────────────────────────────────────────────────

/**
 * The turned space for a plan `planW` x `planH`: where its corners land, and so the size the window clamps in.
 * The ground plane is the live sheet's height; the margins make room above it for the walls and below it for the
 * slabs, so the clamp never cuts a wall's top off the paper edge.
 * @param {number} planW @param {number} planH @param {number} yaw @param {number} pitch
 */
export function orbitFrame(planW, planH, yaw, pitch) {
  const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch);
  const mx = planW / 2, my = planH / 2;
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (const [a, b] of [[-mx, -my], [mx, -my], [mx, my], [-mx, my]]) {
    const u = a * cY - b * sY, v = (a * sY + b * cY) * sP;
    umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
  }
  const up = (SOLID.wallRise + 1) * cP, down = (SOLID.slab + SOLID.rag + 1) * cP;
  vmin -= up; vmax += down;
  return { yaw, pitch, cY, sY, cP, sP, mx, my, umin, vmin, width: Math.max(1, umax - umin), height: Math.max(1, vmax - vmin) };
}

/** The sheet-space point (U, V) of plan point (px, py) at height `y` over the ground `y0`. */
export function toSheet(fr, px, py, y, y0) {
  const a = px - fr.mx, b = py - fr.my;
  const u = a * fr.cY - b * fr.sY, r = a * fr.sY + b * fr.cY;
  return [u - fr.umin, r * fr.sP - (y - y0) * fr.cP - fr.vmin];
}
/** ...and back, onto the ground plane. */
export function fromSheet(fr, U, V) {
  const u = U + fr.umin, r = (V + fr.vmin) / (fr.sP >= 0 ? Math.max(0.2, fr.sP) : Math.min(-0.2, fr.sP));   // from under, too
  return [u * fr.cY + r * fr.sY + fr.mx, -u * fr.sY + r * fr.cY + fr.my];
}

/**
 * A camera for one paint: frame, the window's view, the ground height. `P` answers paper pixels; `depth` grows
 * toward the eye; `facing` says how much a plan-direction normal faces the eye, and `lit` how much light it takes
 * (the light comes from the page's upper left whatever way the sheet is turned, as a draughtsman shades).
 */
export function makeCamera(fr, view, y0) {
  const { cY, sY, cP, sP, mx, my, umin, vmin } = fr;
  const s = view.scale, ox = view.ox, oy = view.oy;
  const P = (px, py, y) => {
    const a = px - mx, b = py - my;
    return [(a * cY - b * sY - umin - ox) * s, ((a * sY + b * cY) * sP - (y - y0) * cP - vmin - oy) * s];
  };
  const depth = (px, py, y) => ((px - mx) * sY + (py - my) * cY) * cP + (y - y0) * sP;
  const face = (nx, ny) => {
    const sx = nx * cY - ny * sY, sz = nx * sY + ny * cY;
    return { facing: sz * cP, lit: -0.62 * sx + 0.78 * sz };
  };
  return { fr, view, y0, scale: s, P, depth, face };
}

/** Ease an orbit {yaw, pitch, goalYaw, goalPitch} toward its goal over `dt` seconds, the short way round. */
export function easeOrbit(o, dt) {
  const k = Math.min(1, (dt || 0) * ORBIT.ease);
  let dy = o.goalYaw - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  o.yaw = Math.abs(dy) < 1e-4 ? o.goalYaw : o.yaw + dy * k;
  const dp = o.goalPitch - o.pitch;
  o.pitch = Math.abs(dp) < 1e-4 ? o.goalPitch : o.pitch + dp * k;
  return o;
}

/** A heading on the plan (a caret's yaw: 0 is north, up the plan) as the same heading on the paper of a turned
 *  sheet - `project(px, py)` answers paper pixels for a plan point at the mark's own height. */
export function headingOnPaper(project, px, py, yaw) {
  const [x, y] = project(px, py), [ax, ay] = project(px + Math.sin(yaw), py - Math.cos(yaw));
  return Math.atan2(ax - x, -(ay - y));
}

// ── THE HAND ─────────────────────────────────────────────────────────

/** A wobble that belongs to the WORLD point, so a line keeps its shape as the sheet turns. */
function wob(amp, x, y, z, s) {
  return [
    amp * (Math.sin(x * 3.1 + z * 1.7 + y * 2.3 + s) * 0.55 + Math.sin(x * 7.3 - z * 5.9 + y * 4.1 + s * 1.9) * 0.3 + Math.sin(x * 17.7 + z * 13.1 - y * 9.7 + s * 3.3) * 0.15),
    amp * (Math.sin(x * 2.3 - z * 3.3 + y * 1.1 + s * 1.3 + 2) * 0.55 + Math.sin(-x * 6.1 + z * 7.7 + y * 5.3 + s * 2.1) * 0.3 + Math.sin(x * 15.3 - z * 19.1 + y * 11.3 + s) * 0.15),
  ];
}
const rag = (x, z) => SOLID.slab + SOLID.rag * (0.35 * (0.5 + 0.5 * Math.sin(x * 0.9 + z * 0.63)) + 0.35 * (0.5 + 0.5 * Math.sin(x * 2.4 - z * 1.8 + 1.3)) + 0.3 * (0.5 + 0.5 * Math.sin(x * 5.1 + z * 3.9)));
function rnd(seed) { let s = (seed | 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }

/** The pens for one storey, at `k` of full strength. Ink is rgba over the parchment; a wash is ink at a
 *  watercolour's strength. */
function pens(k) {
  return {
    line: rgba(INK_RGB, 0.92 * k), mid: rgba(INK_RGB, 0.6 * k), soft: rgba(INK_RGB, 0.38 * k),
    hatch: rgba(INK_RGB, 0.55 * k), hatchLight: rgba(INK_RGB, 0.32 * k), joints: rgba(INK_RGB, 0.34 * k),
    washLit: rgba(INK_RGB, 0.035 * k), washDark: rgba(INK_RGB, 0.13 * k), washSlab: rgba(INK_RGB, 0.08 * k),
    washWalked: rgba(INK_RGB, 0.075 * k), washTop: rgba(INK_RGB, 0.02 * k),
  };
}

// ── THE PAINTERS ─────────────────────────────────────────────────────

/**
 * Ink the sheets, lowest first: `layers` is [{model, y0, strength}] where `y0` is that model's own ground height
 * (the ghosts under the live sheet are drawn at their real depth, so they sit under it in the round).
 * @param {*} ctx
 * @param {Array<{model: ReturnType<typeof buildSolid>, strength: number}> & {cell?: number}} layers
 * @param {ReturnType<typeof makeCamera>} cam
 * @param {{paperW:number, paperH:number, dpr?:number, clear?:boolean, draft?:boolean}} opts
 */
export function paintSolidStatic(ctx, layers, cam, opts) {
  if (!ctx?.setTransform) return;
  const { paperW, paperH, dpr = 1 } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (opts.clear !== false) ctx.clearRect(0, 0, paperW, paperH);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (opts.draft) { paintSolidDraft(ctx, layers, cam, opts); return; }
  const s = cam.scale;
  const detail = s >= 6;                           // hatching and a trembling pen only once a cell is big enough to hold them
  const stones = s >= 8;
  const amp = detail ? Math.max(0.3, Math.min(0.8, s * 0.06)) : 0;
  const lw = Math.max(0.7, Math.min(1.6, s * 0.11));
  const margin = (SOLID.wallRise + SOLID.slab + SOLID.rag + 2) * s;
  const onPaper = (X, Y) => X > -margin && Y > -margin && X < paperW + margin && Y < paperH + margin;
  const P = cam.P;
  const seg = (x0, y0, z0, x1, y1, z1, sd, move = true) => {
    const n = amp ? Math.max(1, Math.min(8, Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0) * s / 12))) : 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
      const [X, Y] = P(x, z, y);
      const [ox, oy] = amp ? wob(amp, x, y, z, sd) : [0, 0];
      if (i === 0 && move) ctx.moveTo(X + ox, Y + oy); else ctx.lineTo(X + ox, Y + oy);
    }
  };
  // EM3-3D fix: closed by a line back to the start, NOT closePath - in Chrome a closePath on a path of thousands of
  // sub-paths costs time in the path's whole length, so the floor's one batched path was quadratic (seconds a frame)
  const poly = (pts) => {
    let X0 = 0, Y0 = 0;
    pts.forEach(([x, z, y], i) => { const [X, Y] = P(x, z, y); if (i) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); X0 = X; Y0 = Y; } });
    ctx.lineTo(X0, Y0);
  };
  /** hide what is behind, then wash */
  const cover = (pts, wash) => {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000'; ctx.beginPath(); poly(pts); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (wash) { ctx.fillStyle = wash; ctx.fill(); }
  };

  /** EM3-3D fix (Mac: "the stairs can just be ramps like in the classic mode"): a flight's cell is a RAMP - one
   *  sloped face from its low edge (the neighbour it climbs from) up to its own height, so a run of such cells is
   *  one smooth slope, as DFU's 3D automap draws Daggerfall's stairs. */
  const rampH = (c, px, pz) => {
    const cs = layers.cell ?? 1, { d, drop } = c.step;
    const a = d === 0 ? (pz - c.y) / cs : d === 2 ? (c.y + cs - pz) / cs : d === 1 ? (c.x + cs - px) / cs : (px - c.x) / cs;
    return c.top - drop * (1 - Math.max(0, Math.min(1, a)));
  };
  const paintTreads = (c, T) => {
    const cs = layers.cell ?? 1;
    const [x, z, x1, z1] = c.fp ?? [c.x, c.y, c.x + cs, c.y + cs];
    const corners = [[x, z], [x1, z], [x1, z1], [x, z1]].map(([px, pz]) => [px, pz, rampH(c, px, pz)]);
    cover(corners, c.k === K_FLOOR && c.walked ? T.washWalked : T.washTop);
    const { d } = c.step;
    if (c.k !== K_FLOOR) {
      // a wall's sloped top: its rims, as a flat wall's are inked
      ctx.strokeStyle = T.line; ctx.lineWidth = lw * 1.1; ctx.beginPath();
      for (let e = 0; e < 4; e++) { if (!c.rim[e]) continue; const [A, B] = [corners[e], corners[(e + 1) % 4]]; seg(A[0], A[2], A[1], B[0], B[2], B[1], 16); }
      ctx.stroke();
      return;
    }
    // the fall line, lightly, so the face reads as a slope and not as a floor seen askew
    ctx.strokeStyle = T.joints; ctx.lineWidth = lw * 0.5; ctx.beginPath();
    for (const b of [0.25, 0.5, 0.75]) {
      const [p0x, p0z] = d % 2 ? [x, z + b * cs] : [x + b * cs, z], [p1x, p1z] = d % 2 ? [x + cs, z + b * cs] : [x + b * cs, z + cs];
      seg(p0x, rampH(c, p0x, p0z), p0z, p1x, rampH(c, p1x, p1z), p1z, 14);
    }
    ctx.stroke();
    // its edges, where the ramp stops (its sides onto something lower, and its top onto a drop)
    ctx.strokeStyle = T.line; ctx.lineWidth = lw * 0.8; ctx.beginPath();
    for (let e = 0; e < 4; e++) {
      if (e === d || !c.rim[e]) continue;
      const [A, B] = [corners[e], corners[(e + 1) % 4]];
      seg(A[0], A[2], A[1], B[0], B[2], B[1], 15);
    }
    ctx.stroke();
  };

  for (const { model, strength } of layers) {
    if (!model) continue;
    const T = pens(strength);
    const cell = model.cell;
    layers.cell = cell;

    // 1. THE CUT under each floor: the slab's side, ragged and hatched, far to near
    const slabs = model.slabs
      .map((q) => ({ q, d: cam.depth((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, q.y - 0.5) }))
      .sort((a, b) => a.d - b.d);
    for (const { q } of slabs) {
      if (cam.face(q.nx, q.ny).facing <= 0.001) continue;
      const [ax, ay] = P(q.x0, q.y0, q.y), [bx, by] = P(q.x1, q.y1, q.y);
      if (!onPaper(ax, ay) && !onPaper(bx, by) && !onPaper((ax + bx) / 2, (ay + by) / 2)) continue;
      const len = Math.hypot(q.x1 - q.x0, q.y1 - q.y0);
      const n = Math.max(2, Math.ceil(len * 1.5));
      const topPts = [], botPts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = q.x0 + (q.x1 - q.x0) * t, z = q.y0 + (q.y1 - q.y0) * t;
        topPts.push([x, z, q.y]); botPts.push([x, z, q.y - rag(x, z)]);
      }
      cover([...topPts, ...[...botPts].reverse()], q.open ? T.washLit : T.washSlab);
      if (detail) {
        const lit = cam.face(q.nx, q.ny).lit;
        const sp = Math.max(0.2, 3.2 / s) * (lit > 0.3 ? 1.6 : 1);
        const rr = rnd((q.x0 * 997 + q.y0 * 131 + q.d * 7) | 0);
        ctx.strokeStyle = q.open ? T.hatchLight : T.hatch; ctx.lineWidth = lw * 0.5;
        ctx.beginPath();
        for (let u = sp * 0.5; u < len; u += sp) {
          const t = u / len, x = q.x0 + (q.x1 - q.x0) * t, z = q.y0 + (q.y1 - q.y0) * t;
          const b = rag(x, z);
          const [X0, Y0] = P(x, z, q.y - 0.05 - rr() * 0.15), [X1, Y1] = P(x, z, q.y - b * (0.5 + rr() * 0.45));
          ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = q.open ? T.soft : T.mid; ctx.lineWidth = lw * 0.85;
      ctx.beginPath();
      botPts.forEach(([x, z, y], i) => { const [X, Y] = P(x, z, y); const [ox, oy] = amp ? wob(amp * 1.4, x, y, z, 5) : [0, 0]; if (i) ctx.lineTo(X + ox, Y + oy); else ctx.moveTo(X + ox, Y + oy); });
      ctx.stroke();
      if (q.open) ctx.setLineDash?.([3, 4]);
      ctx.strokeStyle = q.open ? T.soft : T.line; ctx.lineWidth = lw;
      ctx.beginPath(); seg(q.x0, q.y, q.y0, q.x1, q.y, q.y1, 1); ctx.stroke();
      ctx.setLineDash?.([]);
      ctx.strokeStyle = T.mid; ctx.lineWidth = lw * 0.75;
      ctx.beginPath();
      seg(q.x0, q.y, q.y0, q.x0, q.y - rag(q.x0, q.y0), q.y0, 2);
      seg(q.x1, q.y, q.y1, q.x1, q.y - rag(q.x1, q.y1), q.y1, 2);
      ctx.stroke();
    }

    // 2. THE FLOOR that nothing stands above: cut out and washed in one pass, then its flagstones
    const shown = [];
    for (const f of model.flat) {
      const [X, Y] = P(f.x + cell / 2, f.y + cell / 2, f.top);
      if (onPaper(X, Y)) shown.push(f);
    }
    const e = 0.02;
    const quad = (f) => [[f.x - e, f.y - e, f.top], [f.x + cell + e, f.y - e, f.top], [f.x + cell + e, f.y + cell + e, f.top], [f.x - e, f.y + cell + e, f.top]];
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000'; ctx.beginPath();
    for (const f of shown) poly(quad(f));
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = T.washWalked; ctx.beginPath();
    for (const f of shown) if (f.walked) poly(quad(f));
    ctx.fill();
    if (stones) {
      ctx.strokeStyle = T.joints; ctx.lineWidth = lw * 0.55; ctx.beginPath();
      const g = 0.07, cut = 0.12;
      for (const f of shown) {
        const rr = rnd(f.seed);
        const x0 = f.x + g, z0 = f.y + g, x1 = f.x + cell - g, z1 = f.y + cell - g, y = f.top;
        const j = () => (rr() - 0.5) * 0.05;
        const pts = [[x0 + cut, z0 + j()], [x1 - cut, z0 + j()], [x1 + j(), z0 + cut], [x1 + j(), z1 - cut], [x1 - cut, z1 + j()], [x0 + cut, z1 + j()], [x0 + j(), z1 - cut], [x0 + j(), z0 + cut]];
        let sx = 0, sy = 0;
        pts.forEach(([u, w2], i) => { const [X, Y] = P(u, w2, y); const [ox, oy] = amp ? wob(amp * 0.6, u, y, w2, 9) : [0, 0]; if (i) ctx.lineTo(X + ox, Y + oy); else { ctx.moveTo(X + ox, Y + oy); sx = X + ox; sy = Y + oy; } });
        ctx.lineTo(sx, sy);   // not closePath: see poly
        if (rr() < 0.12) {
          const u0 = x0 + 0.15 + rr() * 0.3, w0 = z0 + 0.1 + rr() * 0.4;
          const [A, B] = P(u0, w0, y), [C, D] = P(u0 + 0.2, w0 + 0.08, y), [E, F] = P(u0 + 0.3, w0 + 0.25, y);
          ctx.moveTo(A, B); ctx.lineTo(C, D); ctx.lineTo(E, F);
        }
      }
      ctx.stroke();
    }

    // 3. WHAT STANDS: walls, steps, anything raised - far to near, each cut out of what is behind it
    const cols = [];
    for (const c of model.cols) {
      const [X, Y] = P(c.x + cell / 2, c.y + cell / 2, c.top);
      if (onPaper(X, Y)) cols.push({ c, d: cam.depth(c.x + cell / 2, c.y + cell / 2, c.top - 0.5) });
    }
    cols.sort((a, b) => a.d - b.d);
    for (const { c } of cols) {
      const t = c.top, cs = cell;
      // a thin wall stands on its strip (`fp`), anything else on the whole cell
      const [x, z, x1, z1] = c.fp ?? [c.x, c.y, c.x + cs, c.y + cs];
      const edges = [[[x, z], [x1, z]], [[x1, z], [x1, z1]], [[x1, z1], [x, z1]], [[x, z1], [x, z]]];
      const faceLen = (d) => (d % 2 ? z1 - z : x1 - x);
      c.faces.forEach((f, fi) => {
        const [nx, ny] = DIRS[f.d];
        const L = cam.face(nx, ny);
        if (L.facing <= 0.001) return;
        const [[ax, az], [bx, bz]] = edges[f.d];
        const bot = Number.isFinite(f.bottom) ? f.bottom : t - SOLID.wallRise;
        // a ramp's side is cut under its slope
        const ta = c.step ? rampH(c, ax, az) : t, tb = c.step ? rampH(c, bx, bz) : t;
        if (c.step && Math.max(ta, tb) <= bot + 1e-3) return;
        const q = [[ax, az, bot], [bx, bz, bot], [bx, bz, Math.max(bot, tb)], [ax, az, Math.max(bot, ta)]];
        const dark = L.lit < 0.15;
        cover(q, dark ? T.washDark : T.washLit);
        if (detail) {
          const hgt = t - bot;
          const sp = Math.max(0.16, 2.8 / s) * (dark ? 1 : L.lit > 0.55 ? 3 : 1.8);
          const rr = rnd(c.seed + f.d);
          ctx.strokeStyle = dark ? T.hatch : T.hatchLight; ctx.lineWidth = lw * 0.5;
          ctx.beginPath();
          const fl = faceLen(f.d);
          for (let u = sp * (0.3 + rr() * 0.5); u < fl; u += sp) {
            const k = u / fl, px = ax + (bx - ax) * k, pz = az + (bz - az) * k;
            const [X0, Y0] = P(px, pz, bot + hgt * (0.03 + rr() * 0.12)), [X1, Y1] = P(px, pz, t - hgt * (0.03 + rr() * 0.1));
            ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = T.mid; ctx.lineWidth = lw * 0.7;
        ctx.beginPath(); seg(ax, bot, az, bx, bot, bz, 4); ctx.stroke();
        const ends = c.ends[fi];
        ctx.strokeStyle = T.line; ctx.lineWidth = lw * 0.85;
        ctx.beginPath();
        if (ends[1]) seg(ax, bot, az, ax, Math.max(bot, ta), az, 6);
        if (ends[0]) seg(bx, bot, bz, bx, Math.max(bot, tb), bz, 6);
        ctx.stroke();
      });
      if (c.step) { paintTreads(c, T); continue; }
      const pad = 0.006;
      cover([[x - pad, z - pad, t], [x1 + pad, z - pad, t], [x1 + pad, z1 + pad, t], [x - pad, z1 + pad, t]],
        c.k === K_FLOOR ? (c.walked ? T.washWalked : null) : T.washTop);
      ctx.strokeStyle = T.line; ctx.lineWidth = lw * (c.k === K_WALL ? 1.1 : 0.8);
      ctx.beginPath();
      edges.forEach(([[ax, az], [bx, bz]], d) => { if (c.rim[d]) seg(ax, t, az, bx, t, bz, 0); });
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * EM3-3D fix (Mac: "it loses alot of frames"): THE QUICK SKETCH, while the sheet is turning. The full drawing cuts
 * every face out of what is behind it, in depth order - tens of thousands of fills on a big dungeon, far too many to
 * redraw every frame of a turn. While it turns, each floor is a handful of batched strokes instead: the floor washed,
 * the walls' faces washed, the walls' tops and the floor's edges inked. The full drawing comes back when it stops.
 */
function paintSolidDraft(ctx, layers, cam, opts) {
  const { paperW, paperH } = opts;
  const s = cam.scale, P = cam.P;
  const lw = Math.max(0.7, Math.min(1.4, s * 0.1));
  const m = (SOLID.wallRise + 2) * s;
  const on = (X, Y) => X > -m && Y > -m && X < paperW + m && Y < paperH + m;
  const quad = (x0, z0, x1, z1, y) => {
    const [a, b] = P(x0, z0, y), [c, d] = P(x1, z0, y), [e, f] = P(x1, z1, y), [g, h] = P(x0, z1, y);
    ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.lineTo(e, f); ctx.lineTo(g, h); ctx.lineTo(a, b);   // not closePath: see poly
  };
  for (const { model, strength } of layers) {
    if (!model) continue;
    const T = pens(strength), cell = model.cell;
    ctx.fillStyle = rgba(INK_RGB, 0.05 * strength); ctx.beginPath();
    for (const f of model.flat) { const [X, Y] = P(f.x, f.y, f.top); if (on(X, Y)) quad(f.x, f.y, f.x + cell, f.y + cell, f.top); }
    for (const c of model.cols) if (c.k === K_FLOOR) { const [X, Y] = P(c.x, c.y, c.top); if (on(X, Y)) quad(c.x, c.y, c.x + cell, c.y + cell, c.top); }
    ctx.fill();
    // the walls' faces that look at the eye, washed; their tops and the floor's cut edges inked
    ctx.fillStyle = T.washDark; ctx.beginPath();
    const rims = [];
    for (const c of model.cols) {
      const [X, Y] = P(c.x, c.y, c.top);
      if (!on(X, Y)) continue;
      const x = c.x, z = c.y, t = c.top, cs = cell;
      const edges = [[[x, z], [x + cs, z]], [[x + cs, z], [x + cs, z + cs]], [[x + cs, z + cs], [x, z + cs]], [[x, z + cs], [x, z]]];
      for (const f of c.faces) {
        if (cam.face(DIRS[f.d][0], DIRS[f.d][1]).facing <= 0.001) continue;
        const [[ax, az], [bx, bz]] = edges[f.d];
        const bot = Number.isFinite(f.bottom) ? f.bottom : t - SOLID.wallRise;
        const [p0, p1] = P(ax, az, bot), [p2, p3] = P(bx, bz, bot), [p4, p5] = P(bx, bz, t), [p6, p7] = P(ax, az, t);
        ctx.moveTo(p0, p1); ctx.lineTo(p2, p3); ctx.lineTo(p4, p5); ctx.lineTo(p6, p7); ctx.lineTo(p0, p1);
      }
      edges.forEach((e, d) => { if (c.rim[d]) rims.push([e, t]); });
    }
    ctx.fill();
    ctx.strokeStyle = T.line; ctx.lineWidth = lw; ctx.beginPath();
    for (const [[[ax, az], [bx, bz]], t] of rims) { const [a, b] = P(ax, az, t), [c2, d] = P(bx, bz, t); ctx.moveTo(a, b); ctx.lineTo(c2, d); }
    for (const q of model.slabs) {
      if (q.open) continue;
      const [a, b] = P(q.x0, q.y0, q.y), [c2, d] = P(q.x1, q.y1, q.y);
      if (!on(a, b) && !on(c2, d)) continue;
      ctx.moveTo(a, b); ctx.lineTo(c2, d);
    }
    ctx.stroke();
  }
}

// ── WHAT STANDS OVER THE INK ─────────────────────────────────────────

/**
 * The classic's beacon at the way in: a staff standing up out of the floor with a pennant, and the ring round its
 * foot (paper px). Drawn before the plan overlay so the plan's own ring and arrow sit on its foot.
 */
export function paintBeacon(ctx, foot, head, pulse = 0) {
  if (!ctx?.beginPath || !foot || !head) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (const pass of ['halo', 'ink']) {
    ctx.strokeStyle = pass === 'halo' ? PEN.halo : PEN.select;
    ctx.lineWidth = pass === 'halo' ? 1.6 + 2 * HALO_PEN : 1.6;
    ctx.beginPath(); ctx.moveTo(foot[0], foot[1]); ctx.lineTo(head[0], head[1]); ctx.stroke();
  }
  const fw = 13, fh = 8, wv = Math.sin(pulse * Math.PI * 2) * 1.5;
  const [hx, hy] = head;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.quadraticCurveTo(hx + fw * 0.5, hy + fh * 0.3 + wv, hx + fw, hy + fh * 0.5);
  ctx.quadraticCurveTo(hx + fw * 0.5, hy + fh * 0.7 - wv, hx, hy + fh);
  ctx.closePath();
  ctx.strokeStyle = PEN.halo; ctx.lineWidth = 2 * HALO_PEN; ctx.stroke();
  ctx.fillStyle = PEN.select; ctx.fill();
  ctx.restore();
}

/** The orbit controls, inked on the sheet between the thumbs: turn, tilt, the flat plan, find me. */
export const ORBIT_BUTTONS = Object.freeze([
  Object.freeze({ id: 'turnLeft', tip: 'Turn left (Q)' }),
  Object.freeze({ id: 'turnRight', tip: 'Turn right (E)' }),
  Object.freeze({ id: 'tiltUp', tip: 'Tilt toward top-down (R)' }),
  Object.freeze({ id: 'tiltDown', tip: 'Tilt toward side view (F)' }),
  Object.freeze({ id: 'floorUp', tip: 'Up a floor (PgUp)' }),
  Object.freeze({ id: 'floorDown', tip: 'Down a floor (PgDn)' }),
  Object.freeze({ id: 'flat', tip: 'Flat plan or 3D (P)' }),
  Object.freeze({ id: 'home', tip: 'Back to you (Home)' }),
]);
export const BUTTON_R = 13;   // EM3-3D fix: a target a gauntleted hand can hit

/** Where the buttons sit: a row along the paper's foot, centred in the clear parchment between the hands. */
export function orbitButtonsLayout(paperW, paperH, hands = null) {
  const r = BUTTON_R, gap = 2 * r + 7;
  let x0 = 0, x1 = paperW;
  for (const h of hands ?? []) {
    if (h.x1 < paperW / 2) x0 = Math.max(x0, h.x1); else x1 = Math.min(x1, h.x0);
  }
  const mid = (x0 + x1) / 2, y = paperH - r - 10;
  const first = mid - ((ORBIT_BUTTONS.length - 1) * gap) / 2;
  return ORBIT_BUTTONS.map((b, i) => ({ ...b, x: first + i * gap, y, r }));
}
export function orbitButtonHit(layout, px, py) {
  for (const b of layout ?? []) if ((px - b.x) ** 2 + (py - b.y) ** 2 <= (b.r + 3) ** 2) return b;
  return null;
}
export function paintOrbitButtons(ctx, layout, { flat = false, hover = null } = {}) {
  if (!ctx?.beginPath || !layout?.length) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const b of layout) {
    const { x, y } = b, r = b.r * (hover === b.id ? 1.08 : 1), g = r * 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = PEN.halo; ctx.lineWidth = 2 * HALO_PEN + 1.2; ctx.stroke();
    ctx.fillStyle = rgba(PARCHMENT_RGB, 0.55); ctx.fill();
    ctx.strokeStyle = PEN.line; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath(); ctx.lineWidth = 1.3; ctx.strokeStyle = PEN.line; ctx.fillStyle = PEN.line;
    const head = (ax, ay, a) => { ctx.moveTo(ax + Math.cos(a + 2.5) * g * 0.55, ay + Math.sin(a + 2.5) * g * 0.55); ctx.lineTo(ax, ay); ctx.lineTo(ax + Math.cos(a - 2.5) * g * 0.55, ay + Math.sin(a - 2.5) * g * 0.55); };
    if (b.id === 'turnLeft' || b.id === 'turnRight') {
      const left = b.id === 'turnLeft';
      const a0 = left ? -0.4 : Math.PI + 0.4, a1 = left ? Math.PI + 0.2 : -0.2;
      ctx.arc(x, y + g * 0.1, g, a0, a1, left);
      head(x + Math.cos(a1) * g, y + g * 0.1 + Math.sin(a1) * g, a1 + (left ? -Math.PI / 2 : Math.PI / 2));
    } else if (b.id === 'tiltUp' || b.id === 'tiltDown') {
      const s = b.id === 'tiltUp' ? -1 : 1;
      ctx.moveTo(x - g, y + g * 0.35 * s); ctx.lineTo(x + g, y - g * 0.35 * s);
      ctx.moveTo(x, y - g * 0.2 * s); ctx.lineTo(x, y - g * 0.95 * s);
      head(x, y - g * 0.95 * s, s < 0 ? Math.PI / 2 : -Math.PI / 2);
    } else if (b.id === 'floorUp' || b.id === 'floorDown') {
      // three steps and the way they go
      const s = b.id === 'floorUp' ? -1 : 1, w = g * 0.5;
      ctx.moveTo(x - g, y + g * 0.7); ctx.lineTo(x - g + w, y + g * 0.7); ctx.lineTo(x - g + w, y + g * 0.2);
      ctx.lineTo(x - g + 2 * w, y + g * 0.2); ctx.lineTo(x - g + 2 * w, y - g * 0.3); ctx.lineTo(x - g + 3 * w, y - g * 0.3);
      const tip = y + s * g * 0.75;   // up: the tip at the top
      ctx.moveTo(x + g * 0.65, y - s * g * 0.75); ctx.lineTo(x + g * 0.65, tip);
      head(x + g * 0.65, tip, s < 0 ? -Math.PI / 2 : Math.PI / 2);
    } else if (b.id === 'flat') {
      if (flat) {
        ctx.font = `600 ${Math.round(r * 0.95)}px ${NAME_FACE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('3D', x, y + 1);
      } else {
        ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.62); ctx.rotate(Math.PI / 4);
        ctx.rect(-g * 0.72, -g * 0.72, g * 1.44, g * 1.44); ctx.moveTo(0, -g * 0.72); ctx.lineTo(0, g * 0.72); ctx.moveTo(-g * 0.72, 0); ctx.lineTo(g * 0.72, 0);
        ctx.restore();
      }
    } else if (b.id === 'home') {
      ctx.stroke(); ctx.beginPath(); ctx.fillStyle = PEN.player;
      ctx.moveTo(x, y - g); ctx.lineTo(x + g * 0.62, y + g * 0.7); ctx.lineTo(x, y + g * 0.35); ctx.lineTo(x - g * 0.62, y + g * 0.7); ctx.closePath(); ctx.fill();
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** The compass: a needle pointing the way north lies on the turned sheet, and its N. `north` is the paper
 *  direction of north (unit), `squash` how much of it the tilt leaves. */
export function paintCompass(ctx, x, y, north, squash = 1, r = 13) {
  if (!ctx?.beginPath) return;
  const na = Math.atan2(north[1], north[0]);
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(PARCHMENT_RGB, 0.35); ctx.fill();
  ctx.strokeStyle = PEN.halo; ctx.lineWidth = 2 * HALO_PEN; ctx.stroke();
  ctx.strokeStyle = PEN.line; ctx.lineWidth = r > 18 ? 1.4 : 1; ctx.stroke();
  if (r > 18) {   // a compass rose's inner ring and its four quarter ticks, where there is room for them
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.strokeStyle = PEN.soft; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath();
    for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + Math.atan2(north[1], north[0]); ctx.moveTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.strokeStyle = PEN.line; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.rotate(na + Math.PI / 2);
  const L = r * 0.85 * Math.max(0.3, squash);
  ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(r * 0.22, 0); ctx.lineTo(0, L); ctx.lineTo(-r * 0.22, 0); ctx.closePath();
  ctx.fillStyle = rgba(PARCHMENT_RGB, 0.9); ctx.fill(); ctx.strokeStyle = PEN.line; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(r * 0.22, 0); ctx.lineTo(-r * 0.22, 0); ctx.closePath(); ctx.fillStyle = PEN.line; ctx.fill();
  ctx.rotate(-(na + Math.PI / 2));
  ctx.font = `600 ${Math.round(Math.max(12, r * 0.62))}px ${NAME_FACE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const off = r + Math.max(8, r * 0.42);
  const lx = Math.cos(na) * off, ly = Math.sin(na) * off;
  ctx.lineWidth = 2 * HALO_PEN; ctx.strokeStyle = PEN.halo; ctx.strokeText('N', lx, ly);
  ctx.fillStyle = PEN.name; ctx.fillText('N', lx, ly);
  ctx.restore();
}
