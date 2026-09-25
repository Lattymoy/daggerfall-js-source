// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EM3 — THE AUTOMAP SHEET: the dungeon's plan, behind the sheet
// contract, on the same parchment as the Iliac Bay.
//
// Mac (2026-09-21): "The automap should become a 2d map and floor based
// instead of the current 3D implementation, streamlining it."
//
// This is the first sheet written to `ui/mapStrip.js`'s SHEET_MEMBERS
// from the outside - no back-reference to the window, no DOM, no
// renderer. It is handed the reveal record and the reveal index and it
// answers a coordinate space, some ink and a pointer.
//
// THE FRAME AND THE STOREY LIST ARE THE LEVEL'S; ONLY THE INK IS WHAT
// YOU HAVE SEEN. Both are derived over EVERY row in the index, revealed
// or not, and the plan is cut from the revealed ones alone. The
// alternative - deriving them from what has been revealed so far -
// renumbers the map as the player explores: walk down a stair you had
// not found and yesterday's "Floor 1" becomes "Floor 2", and the frame
// slides under the caret every time a new room is seen. Neither leaks
// anything: a frame is a box nobody draws, and a storey with nothing
// revealed on it draws nothing.
//
// THE TWO PASSES. `floorPlan` is run twice over one grid - once over
// the REVEALED rows for the outline, once over the rows visited THIS
// RUN for the wash, the second handed the first's storeys and bounds so
// the tint lands cell for cell inside the wall (automapFloors' own
// note). Inside a BUILDING every revealed row counts as visited, which
// is DFU's own law (AutomapModel.cs:46-72, the always-colour case the
// shipped window keeps at automapWindow.js:1222).
//
// THE SPACE. The held window's pan and zoom clamp a map that starts at
// (0,0), and a dungeon does not - it sits wherever its blocks were laid.
// So the sheet's own space is PLAN UNITS, measured from the level's
// north-west corner: x east from the west edge, y SOUTH from the north
// edge, because the paper's y grows down and north is up the sheet -
// the town sheet's law (EM-BUG3 `sheetY`) and the classic top view's
// (+Z up the panel). Everything crossing the seam converts in one place
// (`toPlan`), and the chains, the walked wash, the caret, the beacons
// and the notes all land in it, so nothing needs a second transform.
//
// DISC25-A: A FLOOR OF THIS MAP IS A SHEET, NOT A STOREY. The strip, the
// floor keys, the caret, the marks and the plan all count in SHEETS
// (automapFloors `groupSheets`: a run of storeys none of which lies over
// another), and the storeys stay underneath as the heights things are
// sorted by. The STAIRS between storeys are drawn: inside a sheet as a
// flight pointing up it, and onto another sheet as a flight named for
// the floor it reaches, which a press follows there.
// ═══════════════════════════════════════════════════════════════════

import {
  floorTriangles, deriveFloors, floorAt, planBounds, floorPlan, PLAN_CELL,
  levelField, storeyLinks, groupSheets, sheetOfStorey, fieldOccupancy,
} from '../systems/automapFloors.js';
import { boundarySegments, linkSegments, fitView, toPaper, toMap, viewCentredOn, scaleMinOf, FIT_MARGIN as INK_FIT_MARGIN } from './inkMap.js';
import { tryAddOrEditUserNote, setUserNote } from '../systems/automap.js';
import { readPartyBodies, PARTY_MARK_CSS } from './partyMapMarks.js';   // DISC23-A: the party's bodies, in this frame
import {
  paintPlanStatic, paintPlanOverlay, floorStripLayout, floorStripHit, paintFloorStrip, paintFloorStripParty, paintStairs,
} from './inkAutomap.js';
import { stripFont } from './mapStrip.js';

/** DISC25-A: the dungeon sheet's own keys, said on the window's foot while it is up - the floor keys were there
 *  since EM3 and nothing on the paper said so (tannim: "had the ability to press down to advance the plane"). */
export const AUTOMAP_HINT = 'drag to pan · scroll to zoom · PgUp/PgDn floors · click a stair to take it · Esc to close';

/** DISC25-A: two marks of one stair onto the same sheet nearer than this (metres) are drawn as one - a wide flight
 *  whose cells the grid splits, or a ramp that crosses two storey lines on its way to one floor. */
export const STAIR_MERGE = 6;

/** The fit at rest has ONE HOME in ui/inkMap.js - re-exported so a
 *  pin that has this sheet does not also have to reach for it. */
export { FIT_MARGIN } from './inkMap.js';

/** A level with no geometry at all still answers a space, so the
 *  window's clamp has something finite to work in. */
const EMPTY_SIZE = Object.freeze({ width: 1, height: 1 });

/** DISC22-G: the least zoom the map opens at, in paper pixels per metre - a corridor several pixels wide and a
 *  room the size of a thumbnail. The rest view used to fit the WHOLE LEVEL, revealed or not: on an eight-by-eight
 *  block dungeon that was 1.1 px a metre, a corridor 3 px wide and the first room 12 px across. */
export const READABLE_SCALE = 4;

/** DISC22-G: THE LEVEL'S FRAME, SHARED BY EVERY OPEN. The held window builds a fresh sheet each time M is pressed,
 *  and each sheet re-derived every triangle in the level - so the cost of the floor model was paid on every open.
 *  The rows array is the reveal index's own, built once per level, so it keys the frame. */
const _frames = new WeakMap();   // rows -> { bounds, floors, field, links, sheets, sheetOf, full, pass }

/**
 * @typedef {{revealed?: Set<string>, visitedThisRun?: Set<string>, entranceDiscovered?: boolean,
 *            notes?: Map<number, {position: number[], note: string}>,
 *            teleporters?: Map<string, {entrance?: {pos: number[]}, exit?: {pos: number[]}}>}} AutomapRecord
 *
 * @param {{
 *   record?: () => AutomapRecord|null,
 *   model?: () => {rows?: Array<object>}|null,
 *   player?: () => {feet?: number[], yaw?: number}|null,
 *   startMarker?: {x:number,y:number,z:number}|null,
 *   insideBuilding?: boolean,
 *   title?: string,
 *   askText?: (initial: string, done: (text: string|null) => void) => void,
 *   party?: () => Array<{acct?: string|null, name?: string, feet?: number[], yaw?: number}>,
 * }} deps
 */
export function createAutomapSheet(deps = {}) {
  /** the LEVEL's frame, storey list and sheets, derived once per index */
  let frame = null;        // { model, rows, bounds, floors, sheets, sheetOf, field, links, full, pass, origin }
  /** the cut plan, rebuilt when the sheet or the reveal sets move */
  let cut = null;          // { key, plan, walked, stairs, seen }
  let index = 0;           // which SHEET is up (DISC25-A)
  let strip = null;        // the floor strip's layout, in paper px
  let lastPaper = 0;
  let lastView = null;     // the view the sheet was last painted through


  const rec = () => deps.record?.() ?? null;
  const idx = () => deps.model?.() ?? null;

  /** World (x, z) into the sheet's own space. ONE home for the seam.
   *  DISC8-C (Discord: "The arrow is pointing in the right direction but
   *  when I go south on the map I go north"): the plan's y ran WITH +Z, so
   *  on paper (y down) north was down - the level drawn north-south
   *  mirrored under a caret whose heading (inkMap paintCaret) is north-up.
   *  The plan's y is now measured from the NORTH edge (`origin[1]` is
   *  bounds.z1). */
  const toPlan = (x, z) => [x - (frame?.origin[0] ?? 0), (frame?.origin[1] ?? 0) - z];

  /** DISC8-C: a floorOccupancy grid (rows run with +Z, world units)
   *  re-seated in plan space - the same cells, the rows reversed - so the
   *  walked wash lands under the walls it was cut with (it was left in
   *  WORLD units, a level's origin away from its own walls). */
  const occToPlan = (o, b) => (o ? {
    ...o,
    x0: o.x0 - b.x0,
    z0: (b.z1 - o.z0) - o.h * o.cell,
    at: (x, y) => o.at(x, o.h - 1 - y),
  } : o);

  /** The level's frame, storey list and sheets, over EVERY row (the
   *  header's first law). Rebuilt only when the index itself changes.
   *
   *  KEYED ON THE ROWS, NOT THE BAG. `deps.model()` is a function, and a
   *  host is free to hand back a fresh wrapper each call - two of the
   *  three do exactly that with other deps. Keying on the wrapper's
   *  identity re-derived every triangle in the level on every frame,
   *  which is the most expensive thing this module can do. The ROWS
   *  array is the reveal index's own and is built once per level, so it
   *  is the thing that actually says "this is a different dungeon".
   */
  function ensureFrame() {
    const model = idx();
    const rows = model?.rows ?? [];
    if (frame && frame.rows === rows) return frame;
    let base = _frames.get(rows);
    if (!base) {
      const tris = floorTriangles(rows);
      const bounds = planBounds(tris, PLAN_CELL);
      const floors = deriveFloors(tris);
      // DISC25-A: the level read once more, a cell at a time - the stairs and the sheets come off it
      const field = bounds && floors.length ? levelField(rows, floors, { bounds }) : null;
      const sheets = groupSheets(field, floors);
      base = {
        bounds, floors, field, sheets,
        links: storeyLinks(field),
        sheetOf: sheetOfStorey(sheets, floors.length),
        keyIndex: new Map(rows.map((r, i) => [/** @type {{key?: string}} */ (r).key, i])),
        full: new Map(), pass: new Map(),
      };
      if (rows.length) _frames.set(rows, base);
    }
    frame = {
      model,
      rows,
      ...base,
      origin: base.bounds ? [base.bounds.x0, base.bounds.z1] : [0, 0],   // the west and NORTH edges: see toPlan
    };
    cut = null;
    // DISC22-G: A NEW LEVEL OPENS ON THE PLAYER'S STOREY. `index` started at 0 and nothing set it, so a player on
    // Floor 3 opened the map on Floor 1 - no caret, and a plan of somewhere else. DISC25-A: on their SHEET.
    const feet = deps.player?.()?.feet;
    const here = feet ? sheetAt(frame, feet[1]) : -1;
    index = here >= 0 ? here : Math.max(0, Math.min(frame.sheets.length - 1, index));
    return frame;
  }

  /** DISC25-A: the sheet a height is on - the storey it is nearest, and that storey's sheet; -1 with none. */
  function sheetAt(f, y) {
    const s = floorAt(f.floors, y);
    return s >= 0 ? f.sheetOf[s] : -1;
  }

  /** DISC22-G: the sheet's whole floor on the frame's grid, revealed or not - once per level and sheet. */
  function fullFloor(f, i) {
    if (!f.field || !f.sheets[i]) return null;
    if (!f.full.has(i)) f.full.set(i, fieldOccupancy(f.field, f.sheets[i].storeys));
    return f.full.get(i);
  }

  /** DISC25-A: the far sides of the stairs that leave this sheet for another, as cells of the frame's grid - the
   *  edges the plan must leave open. Once per level and sheet. */
  function passCells(f, i) {
    if (!f.pass.has(i)) {
      const out = new Set();
      for (const l of f.links) if (f.sheetOf[l.from] === i && f.sheetOf[l.to] !== i) for (const k of l.far) out.add(k);
      f.pass.set(i, out);
    }
    return f.pass.get(i);
  }

  /** World (x, z) from the sheet's own space - toPlan's inverse. */
  const fromPlan = (px, py) => [px + (frame?.origin[0] ?? 0), (frame?.origin[1] ?? 0) - py];

  /** The rows of the index whose keys are in `keys`. */
  function rowsIn(model, keys) {
    if (!model?.rows || !keys) return [];
    return model.rows.filter((r) => keys.has(r.key));
  }

  /** DFU's always-colour case: inside a building every revealed row is a
   *  visited row (AutomapModel.cs:46-72). */
  function walkedKeys(r) {
    if (!r) return null;
    return deps.insideBuilding ? r.revealed : r.visitedThisRun;
  }

  /** Everything that makes the cut plan stale, as a string. Computed
   *  from the LIVE record rather than read off the cache, because a
   *  storey change drops the cache and `staticKey` would then answer
   *  "none" - and the window's kept ink layer is keyed on this, so a
   *  key that forgets what it is describing shows the old storey under
   *  the new storey's rule. DISC25-A: and the player's own sheet, which
   *  the strip marks. */
  function cutKey() {
    const you = youSheet();   // the frame first: building it is what sets the sheet a new level opens on
    const r = rec();
    const walked = walkedKeys(r);
    return [index, r?.revealed?.size ?? -1, walked?.size ?? -1, r?.entranceDiscovered ? 1 : 0,
      r?.notes?.size ?? 0, r?.teleporters?.size ?? 0, you].join('|');
  }

  function ensure() {
    const f = ensureFrame();
    const r = rec();
    const model = f.model;
    if (!model?.rows?.length || !f.sheets.length) return null;
    const seen = r?.revealed ?? null;
    const walked = walkedKeys(r);
    const key = cutKey();
    if (cut?.key === key) return cut;
    const storeys = f.sheets[index].storeys;
    const plan = floorPlan(rowsIn(model, seen), storeys, {
      segments: boundarySegments, link: linkSegments, floors: f.floors, bounds: f.bounds,
      full: fullFloor(f, index),   // DISC22-G: the ways on - an edge onto floor not yet seen is not a wall
      pass: passCells(f, index),   // DISC25-A: ...and an edge onto a stair's far side, on another sheet, is neither
    });
    const tint = walked?.size
      ? floorPlan(rowsIn(model, walked), storeys, {
        segments: boundarySegments, link: linkSegments, floors: f.floors, bounds: f.bounds,
      })
      : null;
    // DISC25-A: the stairs this sheet has SEEN - read on the world grid, before the plan moves into plan units
    const stairs = stairsOn(f, plan.occupancy);
    // the chains and both grids arrive in WORLD units; the sheet's space
    // is plan units, north up - through the one seam
    for (const chain of [...plan.chains, ...(plan.openChains ?? [])]) for (const p of chain) [p.x, p.y] = toPlan(p.x, p.y);
    plan.occupancy = occToPlan(plan.occupancy, f.bounds);
    if (tint) tint.occupancy = occToPlan(tint.occupancy, f.bounds);
    cut = { key, plan, walked: tint, stairs, seen: seenSheets(f, seen) };
    return cut;
  }

  /**
   * DISC25-A: THE STAIRS ON THIS SHEET, in plan units - those whose own side the player has revealed (`occ`, the
   * revealed plan on the world grid). A stair onto ANOTHER sheet is named for the floor it reaches, `up` or down,
   * and a press takes it; a stair between two storeys of THIS sheet is drawn once, from its lower end, pointing up
   * it. Marks of one flight onto one sheet are drawn as one (STAIR_MERGE).
   */
  function stairsOn(f, occ) {
    const out = [];
    if (!occ?.covered) return out;
    const sheets = f.sheets;
    for (const l of f.links) {
      if (f.sheetOf[l.from] !== index) continue;
      const to = f.sheetOf[l.to];
      const inside = to === index;
      if (inside && l.from > l.to) continue;   // the lower end draws a flight inside the sheet
      let seen = false;
      for (const k of l.cells) if (occ.covered[k]) { seen = true; break; }
      if (!seen) continue;
      const [x, z] = toPlan(l.x, l.z);
      const up = inside ? true : to > index;
      if (out.some((s) => s.to === to && s.up === up && Math.hypot(s.x - x, s.z - z) < STAIR_MERGE)) continue;
      out.push({
        x, z, dx: l.dx, dz: -l.dz,   // plan y runs south, world z north
        up, to, cross: !inside,
        name: inside ? '' : `${up ? 'up' : 'down'} to ${sheets[to]?.label ?? ''}`,
      });
    }
    return out;
  }

  /** DISC25-A: the sheets the player has revealed anything on - the strip draws the others faint. */
  function seenSheets(f, keys) {
    const out = new Set();
    if (!f.field || !keys?.size) return out;
    const mask = new Uint8Array(f.rows.length);
    for (const k of keys) { const i = f.keyIndex.get(k); if (i != null) mask[i] = 1; }
    const { storey, row, count } = f.field;
    for (let e = 0; e < count; e++) if (mask[row[e]]) out.add(f.sheetOf[storey[e]]);
    return out;
  }

  /** DISC25-A: the sheet the player stands on, or -1. */
  function youSheet() {
    const f = ensureFrame();
    const feet = deps.player?.()?.feet;
    return feet && f.sheets.length ? sheetAt(f, feet[1]) : -1;
  }

  /** Every mark this sheet carries, in plan units: the notes the
   *  player wrote and the teleporters they have stepped through, each
   *  bucketed onto the storey NEAREST its own height - a note sits 0.7
   *  off whatever surface it was stuck to, so it is never on the floor
   *  plane and must not be assumed to be - and so onto that storey's
   *  sheet. */
  function marksHere() {
    const f = ensureFrame();
    const r = rec();
    const out = [];
    if (!f.sheets.length || !r) return out;
    const mine = (y) => sheetAt(f, y) === index;
    for (const [id, n] of r.notes ?? []) {
      const p = n?.position;
      if (!p || !mine(p[1])) continue;
      const [x, z] = toPlan(p[0], p[2]);
      out.push({ x, z, kind: 'note', name: n.note ?? '', id });
    }
    for (const [, t] of r.teleporters ?? []) {
      const ends = [t?.entrance?.pos, t?.exit?.pos];
      ends.forEach((p, i) => {
        if (!p || !mine(p[1])) return;
        const [x, z] = toPlan(p[0], p[2]);
        // DISC22-G: an end whose partner is on ANOTHER sheet says which
        const other = ends[1 - i];
        const there = other ? sheetAt(f, other[1]) : -1;
        out.push({ x, z, kind: 'teleporter', name: there >= 0 && there !== index ? `to ${f.sheets[there].label}` : '' });
      });
    }
    return out;
  }

  /** DISC22-G: the teleporter pairs with BOTH ends on this sheet, as lines in plan units. */
  function linksHere() {
    const f = ensureFrame();
    const r = rec();
    const out = [];
    if (!f.sheets.length || !r) return out;
    for (const [, t] of r.teleporters ?? []) {
      const a = t?.entrance?.pos, b = t?.exit?.pos;
      if (!a || !b || sheetAt(f, a[1]) !== index || sheetAt(f, b[1]) !== index) continue;
      const [x0, z0] = toPlan(a[0], a[2]);
      const [x1, z1] = toPlan(b[0], b[2]);
      out.push({ x0, z0, x1, z1 });
    }
    return out;
  }

  /** DISC22-G: the revealed floor's extent on this sheet, in plan units, or null. */
  function revealedExtent() {
    const occ = ensure()?.plan?.occupancy;
    if (!occ) return null;
    let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
    for (let gy = 0; gy < occ.h; gy++) {
      for (let gx = 0; gx < occ.w; gx++) {
        if (!occ.at(gx, gy)) continue;
        if (gx < gx0) gx0 = gx; if (gx > gx1) gx1 = gx;
        if (gy < gy0) gy0 = gy; if (gy > gy1) gy1 = gy;
      }
    }
    if (!(gx1 >= gx0)) return null;
    return { x0: occ.x0 + gx0 * occ.cell, y0: occ.z0 + gy0 * occ.cell, x1: occ.x0 + (gx1 + 1) * occ.cell, y1: occ.z0 + (gy1 + 1) * occ.cell };
  }

  /** DISC22-G: is paper point (px, py) on floor this sheet has revealed? A note is stuck to something seen, as
   *  DFU's is stuck to what its ray hit. */
  function onRevealedFloor(mx, my) {
    const occ = ensure()?.plan?.occupancy;
    if (!occ) return false;
    return occ.at(Math.floor((mx - occ.x0) / occ.cell), Math.floor((my - occ.z0) / occ.cell));
  }

  /** DISC25-A: the height a note written at world (wx, wz) is pinned at - the storey of THIS sheet whose revealed
   *  surface lies under that cell (a sheet holds floors at several heights), else the sheet's own. A storey's
   *  height, not the surface's, so the note's lift off it can never carry it onto the next storey's sheet. */
  function noteHeight(f, wx, wz) {
    const sheet = f.sheets[index];
    const fl = f.field;
    const r = rec();
    if (fl && r?.revealed) {
      const gx = Math.floor((wx - fl.x0) / fl.cell), gz = Math.floor((wz - fl.z0) / fl.cell);
      if (gx >= 0 && gz >= 0 && gx < fl.w && gz < fl.h) {
        const k = gz * fl.w + gx;
        for (let e = fl.start[k]; e < fl.start[k + 1]; e++) {
          const s = fl.storey[e];
          if (sheet.storeys.includes(s) && r.revealed.has(f.rows[fl.row[e]]?.key)) return f.floors[s].y;
        }
      }
    }
    return sheet.y;
  }

  /** The player, in plan units, and only while they are ON this sheet
   *  - a caret drawn on a floor the player is not standing on is a lie
   *  the 3D map could not tell. */
  function playerHere() {
    const f = ensureFrame();
    const p = deps.player?.();
    const feet = p?.feet;
    if (!feet || !f.sheets.length) return null;
    if (sheetAt(f, feet[1]) !== index) return null;
    const [x, z] = toPlan(feet[0], feet[2]);
    return { x, z, yaw: p?.yaw ?? 0 };
  }

  /** DISC23-A: the party members standing on THIS sheet, in plan units - the player caret's own law (a member on
   *  another floor is not drawn on this one), read fresh on every paint because they walk while the map is up. */
  function partyHere() {
    const f = ensureFrame();
    if (!f.sheets.length) return [];
    const out = [];
    for (const m of readPartyBodies(deps.party)) {
      if (sheetAt(f, m.feet[1]) !== index) continue;
      const [x, z] = toPlan(m.feet[0], m.feet[2]);
      out.push({ x, z, yaw: m.yaw, name: m.name });
    }
    return out;
  }

  /** DISC23-A: the sheets the party stands on, as the strip's own indices. */
  function partyStoreys() {
    const f = ensureFrame();
    if (!f.sheets.length) return new Set();
    return new Set(readPartyBodies(deps.party).map((m) => sheetAt(f, m.feet[1])));
  }

  /** The way in, while it has been found, and only on its own sheet. */
  function entranceHere() {
    const f = ensureFrame();
    const r = rec();
    const sm = deps.startMarker;
    if (!sm || !r?.entranceDiscovered || !f.sheets.length) return null;
    if (sheetAt(f, sm.y) !== index) return null;
    const [x, z] = toPlan(sm.x, sm.z);
    return { x, z };
  }

  /** DISC25-A: the sheet the way out is on, once it has been found - the strip marks it. */
  function exitSheet() {
    const f = ensureFrame();
    const sm = deps.startMarker;
    return sm && rec()?.entranceDiscovered && f.sheets.length ? sheetAt(f, sm.y) : -1;
  }

  /** How near a pointer must come to a mark, in paper pixels. The same
   *  reach the world map picks a town at, because it is the same hand
   *  and the same sheet. */
  const MARK_REACH = 12;

  /** The mark under the pointer, or null. Paper pixels in, through the
   *  view the sheet was last painted with. */
  function nearestMark(px, py) {
    if (!lastView) return null;
    let best = null, bestD = MARK_REACH * MARK_REACH;
    for (const m of marksHere()) {
      const [x, y] = toPaper(lastView, m.x, m.z);
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  /** DISC25-A: the stair under the pointer, or null - the same reach as a mark. */
  function nearestStair(px, py) {
    if (!lastView) return null;
    let best = null, bestD = MARK_REACH * MARK_REACH;
    for (const s of ensure()?.stairs ?? []) {
      const [x, y] = toPaper(lastView, s.x, s.z);
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  /** A sheet up (+1) or down (-1); false at the ends of the level. */
  function step(by) { return setFloor(index + by); }

  function setFloor(next) {
    const f = ensureFrame();
    const want = Math.max(0, Math.min(f.sheets.length - 1, next));
    if (want === index) return false;
    index = want;
    cut = null;
    return true;
  }

  return {
    id: 'automap',

    size() {
      const f = ensureFrame();
      if (!f.bounds) return EMPTY_SIZE;
      return {
        width: Math.max(1, f.bounds.x1 - f.bounds.x0),
        height: Math.max(1, f.bounds.z1 - f.bounds.z0),
      };
    },

    ensure,

    staticKey() {
      // the LIVE key, not the cache's - see cutKey
      return `${cutKey()}|${deps.insideBuilding ? 'in' : 'dn'}`;
    },

    paintStatic(ctx, env) {
      const c = env.model ?? cut;
      paintPlanStatic(ctx, c?.plan ?? null, env.view, {
        paperW: env.paperW, paperH: env.paperH, dpr: env.dpr,
        walked: c?.walked ?? null,
      });
      // DISC25-A: the stairs ride the kept layer with the walls they open
      paintStairs(ctx, env.view, c?.stairs ?? [], { hands: env.reserveHands ?? null });
      // the floor strip rides the kept layer with the plan, so pressing
      // a storey re-letters it and a breathing beacon does not
      const f = ensureFrame();
      strip = floorStripLayout(f.sheets, index, {
        paperW: env.paperW,
        paperH: env.paperH,
        reserveTop: env.reserveTop ?? 0,   // EM5: below the tab strip's band
        hands: env.reserveHands ?? null,   // DISC25-A: ...and above the right gauntlet
        you: youSheet(), exit: exitSheet(), seen: c?.seen ?? null,
        measure: ctx?.measureText ? (t) => { ctx.font = stripFont(env.paperW); return ctx.measureText(t).width; } : null,
      });
      lastPaper = env.paperW;
      lastView = env.view;
      paintFloorStrip(ctx, strip, { font: stripFont(env.paperW) });
    },

    paintOverlay(ctx, env) {
      lastView = env.view;
      paintPlanOverlay(ctx, env.view, {
        paperW: env.paperW, paperH: env.paperH, dpr: env.dpr, pulse: env.pulse,
        player: playerHere(),
        entrance: entranceHere(),
        marks: marksHere(),
        links: linksHere(),
        party: partyHere(),   // DISC23-A
        partyFill: PARTY_MARK_CSS,
      });
      paintFloorStripParty(ctx, strip, partyStoreys(), PARTY_MARK_CSS);   // DISC23-A: and which floors they are on
    },

    pickAt(px, py) {
      const hit = floorStripHit(strip, px, py);
      if (hit != null) { setFloor(hit); return; }
      // DISC25-A (kurkku: "clicking stairs to move up or down a level is good"): a stair onto another floor turns
      // the page to it. The view stays where it is, and the plan units are the level's, so the stair's other end is
      // under the pointer that pressed it.
      const stair = nearestStair(px, py);
      if (stair?.cross) setFloor(stair.to);
    },

    hoverLabel(px, py) {
      const hit = floorStripHit(strip, px, py);
      if (hit != null) {
        const f = ensureFrame();
        return { label: f.sheets.find((s) => s.index === hit)?.label ?? '', cursor: 'pointer' };
      }
    // A NOTE UNDER THE POINTER ANSWERS ITS OWN WORDS, which is the law
    // the 3D map's hover has (automapPick's hoverKeyForHit: a note hit
    // answers the note text itself). The pointer arrives in PAPER
    // pixels and the marks are in plan units, so the reach is measured
    // through the view the sheet was last painted with - which is the
    // view the player is pointing at.
      // DISC23-A: a party member under the pointer answers their name, as a note answers its words
      if (lastView) {
        for (const m of partyHere()) {
          const [x, y] = toPaper(lastView, m.x, m.z);
          if ((x - px) ** 2 + (y - py) ** 2 <= MARK_REACH * MARK_REACH) return { label: m.name, cursor: '' };
        }
      }
      const mark = nearestMark(px, py);
      if (mark) return { label: mark.name || (deps.title ?? ''), cursor: 'pointer' };
      // DISC25-A: a stair names where it goes
      const stair = nearestStair(px, py);
      if (stair) return { label: stair.cross ? `Stairs ${stair.name}` : 'Stairs up', cursor: stair.cross ? 'pointer' : '' };
      return { label: deps.title ?? '', cursor: '' };
    },

    /**
     * DISC22-G: THE MIDDLE BUTTON WRITES A NOTE, as it does on DFU's 3D map (TryToAddOrEditUserNoteMarker..., the
     * one law in systems/automap.js): on a note, it edits that note; on revealed floor with no note within a metre,
     * it pins a new one at the storey's height and asks for its words. An empty answer takes the note away (the 3D
     * map's right double-click); a cancelled one leaves an edited note as it was and a new one unmade. The words
     * are asked through the window's own box (`deps.askText`), because a sheet has no DOM.
     */
    mark(px, py) {
      const f = ensureFrame();
      const r = rec();
      if (!lastView || !r?.notes || !f.sheets.length || typeof deps.askText !== 'function') return false;
      const near = nearestMark(px, py);
      let id, fresh = false;
      if (near?.kind === 'note') id = near.id;
      else {
        const [mx, my] = toMap(lastView, px, py);
        if (!onRevealedFloor(mx, my)) return false;
        const [wx, wz] = fromPlan(mx, my);
        const res = tryAddOrEditUserNote(r, { point: [wx, noteHeight(f, wx, wz), wz], normal: [0, 1, 0], name: '' });
        if (res.action !== 'add') return false;
        id = res.id; fresh = true;
      }
      deps.askText(r.notes.get(id)?.note ?? '', (text) => {
        if (text == null) { if (fresh) r.notes.delete(id); }
        else if (!String(text).trim()) r.notes.delete(id);
        else setUserNote(r, id, text);
        cut = null;
      });
      cut = null;
      return true;
    },

    /** DISC22-G: the way in breathes while it is on the sheet, so the window repaints on its beat. DISC23-A: and so
     *  does a party with anyone in this level - on ANY floor, so a member who climbs onto this one appears within a
     *  beat rather than when something else next repaints. */
    breathes() { return !!entranceHere() || readPartyBodies(deps.party).length > 0; },

    /** DISC25-A: what the window's foot says while this sheet is up. */
    hint() { return AUTOMAP_HINT; },

    /**
     * THE FLOOR KEYS. A floor up and a floor down, on the two pairs a
     * player reaches for without looking: PageUp/PageDown, and the
     * bracket keys beside them on every layout the port already binds
     * (the quickbar's own neighbours). The arrows are NOT taken - they
     * pan the sheet, on this map as on the bay, and a map whose arrows
     * mean two things depending on the tab is a map you have to think
     * about.
     */
    key(code) {
      if (code === 'PageUp' || code === 'BracketRight') return step(1);
      if (code === 'PageDown' || code === 'BracketLeft') return step(-1);
      // DISC22-G: HOME BRINGS YOU BACK - to your own floor and the view the map opened at (DFU's 3D map has its
      // focus-on-player key); the window reads 'home' and resets its view
      if (code === 'Home') {
        const feet = deps.player?.()?.feet;
        const f = ensureFrame();
        if (feet && f.sheets.length) setFloor(sheetAt(f, feet[1]));
        return 'home';
      }
      return false;
    },

    tick() { /* the plan is rebuilt off the reveal sets' own sizes, on demand */ },

    mount() { /* the automap claims none of the world map's chrome */ },
    unmount() { /* ...so it gives none back */ },

    /** At rest the whole floor is on the sheet, centred on the player
     *  where they are on it and on the plan's middle where they are
     *  not. A dungeon map that opens on the far corner is a map the
     *  player has to pan before it says anything. */
    homeView(limits) {
      // DISC22-G: WHAT HAS BEEN SEEN, AT A SIZE A PLAYER CAN READ. The fit was the whole LEVEL's - revealed or not -
      // which on a big dungeon is a corridor three pixels wide. It is the revealed floor of this sheet now, never
      // zoomed out past READABLE_SCALE, centred on the player where they are on it and on what has been seen where
      // they are not; a sheet with nothing seen falls back to inkMap's own fit.
      // the plan's second axis IS world z, which is the sheet's y
      const p = playerHere();
      const ext = revealedExtent();
      if (!ext && !p) return fitView(limits, null);
      const min = scaleMinOf(limits);
      const fit = ext ? INK_FIT_MARGIN * Math.min(limits.paperW / Math.max(1, ext.x1 - ext.x0), limits.paperH / Math.max(1, ext.y1 - ext.y0)) : min;
      const scale = Math.max(min, READABLE_SCALE, fit);   // the window's clamp holds the ceiling (inkMap SCALE_MAX)
      const c = p ? { x: p.x, y: p.z } : { x: (ext.x0 + ext.x1) / 2, y: (ext.y0 + ext.y1) / 2 };
      return viewCentredOn(c.x, c.y, scale, limits);
    },

    // ── the sheet's own handles, for the window's keys and its pins ──
    /** Which floor is up, and the list it came from. DISC25-A: SHEETS - each names the storeys it holds. */
    get floor() { ensureFrame(); return index; },   // DISC22-G: the frame first - it is what sets the player's floor
    floors() { return ensureFrame().sheets; },
    /** DISC25-A: the storeys underneath, the stairs between them, and the stairs this floor has seen. */
    storeys() { return ensureFrame().floors; },
    links() { return ensureFrame().links; },
    stairs() { return ensure()?.stairs ?? []; },
    /** DISC23-A: the party on this floor (plan units), and the floors the party stands on. */
    partyHere,
    partyStoreys,
    setFloor,
    /** Up and down a floor - what the floor keys ask for. */
    step,
    /** The strip's last layout, in paper px (null before the first paint). */
    get strip() { return strip; },
    get paperW() { return lastPaper; },
  };
}
