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
import { boundarySegments, linkSegments, fitView, toPaper, toMap, viewCentredOn, scaleMinOf, SCALE_MAX, FIT_MARGIN as INK_FIT_MARGIN } from './inkMap.js';
import { tryAddOrEditUserNote, setUserNote, automapTrailPoints } from '../systems/automap.js';
import { aabbContains } from '../systems/automapModel.js';   // TP-SEEN
import { readPartyBodies, PARTY_MARK_CSS } from './partyMapMarks.js';   // DISC23-A: the party's bodies, in this frame
import {
  paintPlanStatic, paintPlanOverlay, floorStripLayout, floorStripHit, paintFloorStrip, paintFloorStripParty, paintStairs,
} from './inkAutomap.js';
import { stripFont, STRIP } from './mapStrip.js';
import { dungeonInkFor, SLICE_ABOVE, rowMesh } from './inkDungeonGL.js';   // GL-LEAK: the page's one ink
import { INK_RGB as FLOOR_INK_RGB } from './inkMap.js';
const NAME_FACE_CSS = "'Cormorant', Georgia, serif";   // EM3-3D: the classic map's way, drawn
// EM3-3D: the same plan in the round, when the player has the solid map on (ui/mapSkin.js dungeonMap3dOn)
import {
  buildSolid, rowMaskOf, orbitFrame, SOLID, toSheet, fromSheet, makeCamera, paintSolidStatic, paintBeacon,
  orbitButtonsLayout, orbitButtonHit, paintOrbitButtons, paintCompass, easeOrbit, headingOnPaper, ORBIT, GHOST,
} from './inkDungeonSolid.js';

/** DISC25-A: the dungeon sheet's own keys, said on the window's foot while it is up - the floor keys were there
 *  since EM3 and nothing on the paper said so (tannim: "had the ability to press down to advance the plane"). */
export const AUTOMAP_HINT = 'drag to pan · scroll to zoom · PgUp/PgDn floors · click a stair to take it · Esc to close';
/** EM3-3D: ...and the solid map's, which turns and tilts as the classic 3D map does. */
// EM3-3D fix (Mac: "they key tips are not needed ... you have the buttons on the map"): the solid sheet says nothing
// on the foot. Its turn, tilt, plan and home are buttons on the paper, its floors a list to press, and the drag and
// the wheel are what any map does. (V, which the first line offered, is the TravelMap key and closed the map; the
// plan is P, and the plan button's own tip says so.)
export const AUTOMAP_HINT_3D = '';
/** EM3-3D fix: the solid sheet's flat-plan key - a letter no default binding carries (inputActions DEFAULT_BINDINGS). */
export const PLAN_KEY = 'KeyP';

/** EM3-3D: the view the solid sheet's marks and plan are handed to the plan painters in - they are projected to
 *  paper pixels first, so the painters' own toPaper is the identity. */
const PAPER_VIEW = Object.freeze({ ox: 0, oy: 0, scale: 1 });
/** EM3-3D fix: how much paper round the view the kept 3D image covers (each side, in papers), and how long a zoom
 *  must rest (seconds) before the scaled image is drawn afresh. */
export const IMAGE_MARGIN = 0.5;
export const ZOOM_REST_S = 0.18;
/** PLUS-MAP: the compass's radius on the 3D map (paper px). */
export const COMPASS_R = 24;
/** EM3-3D fix: the turn the cutaway is rebuilt at (the walls in front are cut for the nearest such step). */
export const CUT_STEP = Math.PI / 8;
/** EM3-3D fix: how strongly floors ABOVE the player's are inked on the solid sheet (theirs is full strength). */
export const ABOVE_STRENGTH = 0.7;
/** EM3-3D fix: the empty paper round the level on the solid sheet (metres), so any corner can be centred. */
export const SOLID_PAD_BASE = 48;
/** EM3-3D: how high the way-in's staff stands over its floor, in metres. */
const BEACON_STAFF = 3.2;

/** DISC25-A: two marks of one stair onto the same sheet nearer than this (metres) are drawn as one - a wide flight
 *  whose cells the grid splits, or a ramp that crosses two storey lines on its way to one floor. */
export const STAIR_MERGE = 6;
/** TP-SEEN: how far (m) outside a revealed row's box a teleporter may stand and still count as seen with it. */
export const PORTAL_SEEN_TOL = 1.5;
/** TURN-AT-MOUSE: the player this near the paper's middle (px) counts as centred, and a right-drag turns about them. */
export const ME_MIDDLE_PX = 40;
/** ALL-FLOORS: the key that shows every explored floor at once, and back. */
export const ALL_FLOORS_KEY = 'KeyL';
let _fullMapPref = false;

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
 *            teleporters?: Map<string, {entrance?: {pos: number[]}, exit?: {pos: number[]}}>,
 *            trail?: Set<string>, trailAll?: boolean}} AutomapRecord
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
 *   solid?: boolean,
 *   domTools?: boolean,
 *   portals?: Map<string, {entrance?: {pos: number[]}, exit?: {pos: number[]}}>
 *     | (() => Map<string, {entrance?: {pos: number[]}, exit?: {pos: number[]}}>|null),
 *   fires?: ReadonlyArray<number[]> | (() => ReadonlyArray<number[]>|null),
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

  // ── EM3-3D: THE SOLID MAP'S OWN STATE ──
  // `solid` is fixed for the sheet's life (the window builds a sheet per open, and the switch takes effect at the
  // next open). The orbit eases toward its goal on the sheet's own clock; `framedAt` is the orbit the window's view
  // was last laid out for, and `reframe` hands the window a new view whenever the two part.
  const solidOn = !!deps.solid;
  // PLUS-MAP (Mac: "adjust this ui for this map to the enhanced plus standard with buttons"): with `domTools` the
  // window draws the 3D map's controls and its floor readout as Enhanced Plus buttons (tools/status/press below), so
  // the paper carries only the map and its compass
  const domTools = !!deps.domTools;
  /** @type {{yaw: number, pitch: number, goalYaw: number, goalPitch: number}} */
  const orbit = { yaw: ORBIT.yawRest, pitch: ORBIT.pitchRest, goalYaw: ORBIT.yawRest, goalPitch: ORBIT.pitchRest };
  let framedAt = null;
  let wantHome = false;
  // ME-PAN fix: the Me button / Home key asked for the view centred on the player (not the whole-dungeon rest)
  let wantMe = false;
  const _extCache = new WeakMap();   // occupancy grid / solid model -> its drawn extent (plan units)
  let lastPaperH = 0;
  let lastHands = null;
  let hoverButton = null;
  let hoverNote = null;      // NOTE-PIN: the waypoint under the pointer (its id), drawn lit
  let noteBoxes = [];        // NOTE-PIN: each waypoint's pin and word as last painted, in paper px
  let hoverStair = null;      // the stair under the pointer, the only one whose name is inked
  let hoverRow = null;        // EM3-3D fix: the floor row under the pointer, lit so it reads as a button
  const solids = new Map();   // sheet index -> { key, model }
  let glInk;                  // EM3-3D classic: the GPU ink (inkDungeonGL), null where there is no WebGL2
  let fullMap = _fullMapPref;   // ALL-FLOORS: every explored floor drawn at once (the toggle outlives the open)
  let viewFloor = null;       // EM3-3D: the storey (index into the frame's floors) the slice stands on; null = the player's
  let floorShift = 0;         // ...metres the view still owes the window after a floor change (reframe pays it)
  // EM3-3D: THE TURN'S PIVOT - a WORLD point (plan x, y and a height) and the paper point it is held at while the
  // sheet turns or tilts. Chosen once when a turn begins and let go when it has settled, never re-read from the
  // paper in between (that inverse degenerates as the sheet comes down level, which was the jump at a low tilt).
  let pivotW = null, pivotP = null, holding = false;
  let pivotFrom = null;
  let meLock = false;   // ME-PIVOT: Me was pressed and the view has not been moved since - turns go about the player   // TURN-AT-MOUSE: the paper point a right-drag began on - the turn is about the floor under it
  let solidImage = null;      // EM3-3D fix: the full drawing, kept over the paper and a margin (paintSolid)
  let solidBlitted = false;   // ...last painted scaled, mid-zoom: a fresh drawing is owed once the zoom rests
  let clockNow = 0, lastZoomAt = -1e9, lastScale = null;


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
      r?.notes?.size ?? 0, r?.teleporters?.size ?? 0, you, r?.trail?.size ?? 0, r?.trailAll ? 1 : 0].join('|');
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
    // EM3-3D fix: on the solid sheet a stair is known where its cells are DRAWN (walked near), not merely revealed
    const drawn = solidOn && trailInfo().useTrail ? solidOf(index)?.shown ?? null : null;
    const sheets = f.sheets;
    for (const l of f.links) {
      if (f.sheetOf[l.from] !== index) continue;
      const to = f.sheetOf[l.to];
      const inside = to === index;
      if (inside && l.from > l.to) continue;   // the lower end draws a flight inside the sheet
      let seen = false;
      for (const k of l.cells) if (drawn ? drawn[k] : occ.covered[k]) { seen = true; break; }
      if (!seen) continue;
      const [x, z] = toPlan(l.x, l.z);
      const up = inside ? true : to > index;
      if (out.some((s) => s.to === to && s.up === up && Math.hypot(s.x - x, s.z - z) < STAIR_MERGE)) continue;
      out.push({
        y: f.floors[l.from]?.y ?? sheets[index]?.y ?? 0,   // EM3-3D: the height the flight leaves from
        x, z, dx: l.dx, dz: -l.dz,   // plan y runs south, world z north
        up, to, cross: !inside,
        known: inside || listed(to),   // EM3-3D fix: a floor not yet walked is not a page to turn to
        name: inside ? '' : listed(to) ? `${up ? 'up' : 'down'} to ${sheets[to]?.label ?? ''}` : `${up ? 'up' : 'down'} - not explored yet`,
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
    const mine = (y) => solidOn || sheetAt(f, y) === index;   // EM3-3D: the solid map shows every floor
    for (const [id, n] of r.notes ?? []) {
      const p = n?.position;
      if (!p || !mine(p[1])) continue;
      const [x, z] = toPlan(p[0], p[2]);
      out.push({ x, z, y: p[1], kind: 'note', name: n.note ?? '', id });
    }
    for (const [, t] of r.teleporters ?? []) {
      const ends = [t?.entrance?.pos, t?.exit?.pos];
      ends.forEach((p, i) => {
        if (!p || !mine(p[1])) return;
        const [x, z] = toPlan(p[0], p[2]);
        // DISC22-G: an end whose partner is on ANOTHER sheet says which
        const other = ends[1 - i];
        const there = other ? sheetAt(f, other[1]) : -1;
        out.push({ x, z, y: p[1], kind: 'teleporter', name: there >= 0 && there !== index ? `to ${f.sheets[there].label}` : '' });
      });
    }
    // TP-SEEN: a teleporter not walked yet is on the map once the spot it stands on has been SEEN - drawn as the same
    // ring in a ring, named "Teleporter". Where it leads stays unknown (no far end, no line) until it is walked.
    for (const [key, t] of seenPortals()) {
      if (r.teleporters?.has?.(key)) continue;
      const p = t.entrance.pos;
      if (!mine(p[1])) continue;
      const [x, z] = toPlan(p[0], p[2]);
      out.push({ x, z, y: p[1], kind: 'teleporter', name: 'Teleporter', unwalked: true });
    }
    // REST3: a dungeon's own campfire, once the spot it stands on has been SEEN (TP-SEEN's law) - drawn as a flame
    for (const p of seenFires()) {
      if (!mine(p[1])) continue;
      const [x, z] = toPlan(p[0], p[2]);
      out.push({ x, z, y: p[1], kind: 'fire', name: 'Campfire' });
    }
    return out;
  }

  /** REST3: the level's placed campfires (deps.fires, [x, y, z]) whose spot lies in a revealed row. */
  function seenFires() {
    const all = typeof deps.fires === 'function' ? deps.fires() : deps.fires;
    const r = rec();
    const f = ensureFrame();
    if (!all?.length || !r?.revealed?.size) return [];
    const rows = f.rows ?? [];
    if (_fireMemo && _fireMemo.all === all && _fireMemo.rows === rows && _fireMemo.n === r.revealed.size && _fireMemo.rec === r) return _fireMemo.out;
    const out = all.filter((p) => rows.some((row) => r.revealed.has(row.key) && row.aabb && aabbContains(row.aabb, p, PORTAL_SEEN_TOL)));
    _fireMemo = { all, rows, n: r.revealed.size, rec: r, out };
    return out;
  }
  let _fireMemo = null;

  /** TP-SEEN: the level's portals (deps.portals, key -> connection) whose entrance lies in a revealed row. */
  function seenPortals() {
    const all = typeof deps.portals === 'function' ? deps.portals() : deps.portals;
    const r = rec();
    const f = ensureFrame();
    if (!all?.size || !r?.revealed?.size) return [];
    const rows = f.rows ?? [];
    // asked on every paint and every hover: kept until the reveal, the rows or the portal list move
    if (_portalMemo && _portalMemo.all === all && _portalMemo.rows === rows && _portalMemo.n === r.revealed.size && _portalMemo.rec === r) return _portalMemo.out;
    const out = [];
    for (const [key, t] of all) {
      const p = t?.entrance?.pos;
      if (!p) continue;
      if (rows.some((row) => r.revealed.has(row.key) && row.aabb && aabbContains(row.aabb, p, PORTAL_SEEN_TOL))) out.push([key, t]);
    }
    _portalMemo = { all, rows, n: r.revealed.size, rec: r, out };
    return out;
  }
  let _portalMemo = null;

  /** DISC22-G: the teleporter pairs with BOTH ends on this sheet, as lines in plan units. */
  function linksHere() {
    const f = ensureFrame();
    const r = rec();
    const out = [];
    if (!f.sheets.length || !r) return out;
    for (const [, t] of r.teleporters ?? []) {
      const a = t?.entrance?.pos, b = t?.exit?.pos;
      if (!a || !b || (!solidOn && (sheetAt(f, a[1]) !== index || sheetAt(f, b[1]) !== index))) continue;
      const [x0, z0] = toPlan(a[0], a[2]);
      const [x1, z1] = toPlan(b[0], b[2]);
      out.push({ x0, z0, x1, z1, y0: a[1], y1: b[1] });
    }
    return out;
  }

  /** DISC22-G: the revealed floor's extent on this sheet, in plan units, or null. */
  function revealedExtent() {
    const occ = ensure()?.plan?.occupancy;
    if (!occ) return null;
    // ME-PAN fix: asked by the pan clamp on every drag, so kept per occupancy grid (a new grid is a new reveal)
    if (_extCache.has(occ)) return _extCache.get(occ);
    const e = revealedExtentOf(occ);
    _extCache.set(occ, e);
    return e;
  }
  function revealedExtentOf(occ) {
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

  /** EM3-3D fix: the rest zoom, under the window's ceiling where the window will hold it there - its clamp keeps the
   *  view's corner, not its middle, so a rest asked nearer than SCALE_MAX opened with the player off in a corner.
   *  (Where even the whole-space fit is past the ceiling the clamp answers the fit whatever is asked.) */
  function restScale(min, fit) {
    const want = Math.max(READABLE_SCALE, fit);
    return Math.max(min, want > SCALE_MAX && min < SCALE_MAX ? SCALE_MAX : want);
  }

  /** EM3-3D fix: the solid sheet's DRAWN floor's extent, in plan units - what the rest view fits when only the walked
   *  part of the floor is on the paper. */
  function drawnExtent(i = index) {
    const m = solidOf(i);
    if (!m?.count) return null;
    if (_extCache.has(m)) return _extCache.get(m);
    const e = drawnExtentOf(m);
    _extCache.set(m, e);
    return e;
  }
  function drawnExtentOf(m) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of [...m.flat, ...m.cols]) {
      if (q.k != null && q.k !== 1) continue;   // floor cells only (a wall column is K_WALL)
      if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y;
    }
    return x1 >= x0 ? { x0, y0, x1: x1 + m.cell, y1: y1 + m.cell } : null;
  }

  /** ME-PAN fix: the corners of everything drawn, in the window's space (sheet space when solid, plan units when
   *  flat) - what the rest view fits and what the pan clamp keeps on the paper. */
  function contentPts() {
    const pts = [];
    if (solidOn) {
      const fr = orbitNow(), y0 = groundY(), f = ensureFrame();
      for (let i = 0; i < f.sheets.length; i++) {
        const m = sheetExtent(i), e = m?.e;
        if (!e) continue;
        for (const yy of [m.yMin, m.yMax + SOLID.wallRise]) for (const [x, y] of [[e.x0, e.y0], [e.x1, e.y0], [e.x1, e.y1], [e.x0, e.y1]]) pts.push(toSheet(fr, x, y, yy, y0));
      }
      const ext = pts.length ? null : revealedExtent();
      if (ext) for (const [x, y] of [[ext.x0, ext.y0], [ext.x1, ext.y0], [ext.x1, ext.y1], [ext.x0, ext.y1]]) pts.push(toSheet(fr, x, y, y0, y0));
    } else {
      const ext = revealedExtent();
      if (ext) pts.push([ext.x0, ext.y0], [ext.x1, ext.y1]);
    }
    return pts;
  }
  /** ME-PAN fix: one sheet's drawn floor extent and heights, turn-free - asked on every pan and every frame of a turn,
   *  so it reuses any cut of the sheet already built (the floor cells are the same at every cut) and is kept until the
   *  reveal or the trail moves. Never builds a model per turn step for every floor. */
  const _sheetExt = new Map();   // sheet index -> { key, e, yMin, yMax }
  function sheetExtent(i) {
    const f = ensureFrame(), r = rec();
    const walked = walkedKeys(r), t = trailInfo();
    const key = `${r?.revealed?.size ?? -1}|${walked?.size ?? -1}|${t.useTrail ? t.size : 'all'}`;
    const have = _sheetExt.get(i);
    if (have && have.key === key && have.rows === f.rows) return have;
    const kept = solids.get(i);
    const m = (kept && kept.seenKey === key && kept.rows === f.rows ? kept.byCut.values().next().value : null) ?? solidOf(i);
    const e = m?.count ? drawnExtentOf(m) : null;
    const out = { key, rows: f.rows, e, yMin: m?.yMin ?? 0, yMax: m?.yMax ?? 0 };
    _sheetExt.set(i, out);
    return out;
  }
  /** TURN-STEADY: each revealed row's FLOOR triangles (up-facing, as the ink draws them), in world space with their
   *  xz boxes - kept per row, for the pick. */
  const _floorTris = new WeakMap();
  function floorTrisOf(row) {
    let t = _floorTris.get(row);
    if (t) return t;
    const m = rowMesh(row), out = [];
    for (let k = 0; k < m.count; k += 3) {
      if (Math.abs(m.nrm[k * 4 + 1]) <= 0.6) continue;   // level faces: a floor (a ceiling sits over the cut)
      const o = k * 3, P = m.pos;
      const ax = P[o], ay = P[o + 1], az = P[o + 2], bx = P[o + 3], by = P[o + 4], bz = P[o + 5], cx = P[o + 6], cy = P[o + 7], cz = P[o + 8];
      out.push({ ax, az, bx, bz, cx, cz, y: (ay + by + cy) / 3, x0: Math.min(ax, bx, cx), x1: Math.max(ax, bx, cx), z0: Math.min(az, bz, cz), z1: Math.max(az, bz, cz) });
    }
    _floorTris.set(row, out);
    return out;
  }
  /**
   * TURN-STEADY (Mac: "it sometimes moves the whole map around instead of staying centered when i hold right mouse
   * button"): WHAT IS UNDER A PAPER POINT, exactly as it is drawn. The pivot was where the paper point met the ground
   * plane of the floor being looked at - over empty paper, a wall, or another floor, a point far off the map, and a
   * turn about a point far off the map swings the whole map round it. Now the point is picked on the drawn floors
   * themselves (the revealed rows' up-facing faces, under the cut, as the ink draws them): the highest one under the
   * point - the one the eye sees - or null where there is no floor under it.
   */
  function drawnUnder(px, py, view, fr, y0) {
    const f = ensureFrame(), r = rec();
    if (!f.bounds || !r?.revealed) return null;
    const clip = sliceY(), yv = viewBase();
    const storeys = f.floors.map((q) => q.y);
    const cutAt = (y) => {
      if (!fullMap) return clip;
      let base = storeys[0] ?? y;
      for (const s0 of storeys) if (s0 <= y + 0.35) base = Math.max(base, s0);
      return Math.min(clip, base + SLICE_ABOVE);
    };
    const U = view.ox + px / view.scale, V0 = view.oy + py / view.scale;
    const [ox0, oz1] = f.origin;
    let best = null;
    for (const row of rowsIn(f.model, r.revealed)) {
      for (const t of floorTrisOf(row)) {
        if (t.y > cutAt(t.y) + 0.05 || (best && t.y <= best.y)) continue;
        const [qx, qy] = fromSheet(fr, U, V0 + (t.y - y0) * fr.cP);
        const x = qx + ox0, z = oz1 - qy;
        if (x < t.x0 || x > t.x1 || z < t.z0 || z > t.z1) continue;
        const d1 = (x - t.bx) * (t.az - t.bz) - (t.ax - t.bx) * (z - t.bz);
        const d2 = (x - t.cx) * (t.bz - t.cz) - (t.bx - t.cx) * (z - t.cz);
        const d3 = (x - t.ax) * (t.cz - t.az) - (t.cx - t.ax) * (z - t.az);
        const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (neg && pos) continue;
        best = { px: qx, py: qy, y: t.y };
      }
    }
    void yv;
    return best;
  }
  /** TURN-STEADY: the middle of everything drawn, in plan units, at the floor being looked at - the pivot of last
   *  resort, so a turn with nothing under the middle of the paper still turns about the map and not about the paper. */
  function drawnMiddle() {
    const b = drawnBox();
    return b ? { px: (b.x0 + b.x1) / 2, py: (b.y0 + b.y1) / 2, y: viewBase() } : null;
  }
  /** TURN-FIXED: the 3D middle of everything explored (plan units + a height) - the one fixed turn pivot. */
  function exploredMiddle() {
    const f = ensureFrame();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, lo = Infinity, hi = -Infinity;
    for (let i = 0; i < f.sheets.length; i++) {
      const m = sheetExtent(i), e = m?.e;
      if (!e) continue;
      x0 = Math.min(x0, e.x0); y0 = Math.min(y0, e.y0); x1 = Math.max(x1, e.x1); y1 = Math.max(y1, e.y1);
      lo = Math.min(lo, m.yMin); hi = Math.max(hi, m.yMax);
    }
    if (!(x1 >= x0)) return drawnMiddle();
    const y = Number.isFinite(lo) && Number.isFinite(hi) ? (lo + hi) / 2 : viewBase();
    return { px: (x0 + x1) / 2, py: (y0 + y1) / 2, y };
  }
  /** TURN-STEADY: the box of everything drawn, in plan units, or null. */
  function drawnBox() {
    const f = ensureFrame();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < f.sheets.length; i++) {
      const e = sheetExtent(i)?.e;
      if (!e) continue;
      x0 = Math.min(x0, e.x0); y0 = Math.min(y0, e.y0); x1 = Math.max(x1, e.x1); y1 = Math.max(y1, e.y1);
    }
    return x1 >= x0 ? { x0, y0, x1, y1 } : null;
  }

  /** TURN-AT-MOUSE: is the player within a few dozen pixels of the paper's middle in this view? */
  function playerNearMiddle(view, limits) {
    const me = mePoint();
    if (!me || !view) return false;
    const dx = (me[0] - view.ox) * view.scale - limits.paperW / 2, dy = (me[1] - view.oy) * view.scale - limits.paperH / 2;
    return dx * dx + dy * dy <= ME_MIDDLE_PX * ME_MIDDLE_PX;
  }
  /** ME-PAN fix: the player in the window's space, or null. */
  function mePoint() {
    const p = playerHere();
    if (!p) return null;
    if (!solidOn) return [p.x, p.z];
    const y0 = groundY();
    return toSheet(orbitNow(), p.x, p.z, p.y ?? y0, y0);
  }
  /** ME-PAN fix: the rest zoom - the whole walked map fitted, under the window's ceiling. */
  function restScaleOf(limits, pts = contentPts()) {
    const min = scaleMinOf(limits);
    if (!pts.length) return restScale(min, min);
    const us = pts.map((q) => q[0]), vs = pts.map((q) => q[1]);
    const w = Math.max(...us) - Math.min(...us), h = Math.max(...vs) - Math.min(...vs);
    return restScale(min, INK_FIT_MARGIN * Math.min(limits.paperW / Math.max(1, w), limits.paperH / Math.max(1, h)));
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
    if (!solidOn && sheetAt(f, feet[1]) !== index) return null;
    const [x, z] = toPlan(feet[0], feet[2]);
    return { x, z, y: feet[1], yaw: p?.yaw ?? 0 };
  }

  /** DISC23-A: the party members standing on THIS sheet, in plan units - the player caret's own law (a member on
   *  another floor is not drawn on this one), read fresh on every paint because they walk while the map is up. */
  function partyHere() {
    const f = ensureFrame();
    if (!f.sheets.length) return [];
    const out = [];
    for (const m of readPartyBodies(deps.party)) {
      if (!solidOn && sheetAt(f, m.feet[1]) !== index) continue;
      const [x, z] = toPlan(m.feet[0], m.feet[2]);
      out.push({ x, z, y: m.feet[1], yaw: m.yaw, name: m.name });
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
    if (!solidOn && sheetAt(f, sm.y) !== index) return null;
    const [x, z] = toPlan(sm.x, sm.z);
    return { x, z, y: sm.y };
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
  /** NOTE-PIN: the waypoint whose pin or words are under paper point (px, py), as last painted, or null. */
  function noteBoxHit(px, py) {
    return [...noteBoxes].reverse().find((b) => px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1) ?? null;
  }
  function nearestMark(px, py) {
    if (!lastView) return null;
    // NOTE-PIN: a waypoint is taken anywhere on its pin or its word, not only at the point it is stuck in
    const box = noteBoxHit(px, py);
    if (box) { const m = marksHere().find((q) => q.kind === 'note' && q.id === box.id); if (m) return m; }
    let best = null, bestD = MARK_REACH * MARK_REACH;
    for (const m of marksHere()) {
      const [x, y] = markPaper(m);
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
      const [x, y] = markPaper(s);
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  // ── EM3-3D fix: WHERE THE PLAYER HAS BEEN ──────────────────────
  // Mac: "it should only uncover where i actually was and not show all floors". The walked trail
  // (systems/automap.js automapTrailTick) is the one record of that. With it, the strip lists the floors the player
  // has stood on and nothing else, the floor keys step between those, and the solid sheet draws only floor near the
  // trail. A record with no trail point at all (a save older than the trail) or a RevealAll falls back to the reveal.
  let trailMemo = null;   // { rec, size, rows, useTrail, points, visited }
  function trailInfo() {
    const f = ensureFrame();
    const r = rec();
    const size = r?.trail?.size ?? 0;
    if (trailMemo && trailMemo.rec === r && trailMemo.size === size && trailMemo.rows === f.rows && trailMemo.all === !!r?.trailAll) return trailMemo;
    const useTrail = size > 0 && !r?.trailAll && !deps.insideBuilding;
    const points = useTrail ? automapTrailPoints(r) : null;
    const visited = new Set();
    if (points && f.sheets.length) for (const p of points) { const s = sheetAt(f, p[1]); if (s >= 0) visited.add(s); }
    trailMemo = { rec: r, size, rows: f.rows, all: !!r?.trailAll, useTrail, points, visited };
    return trailMemo;
  }
  /** The sheets the strip lists: the walked ones, the player's own and the one that is up - or, with no trail to
   *  go by, every one. Bottom first, as the strip wants them. */
  function listedSheets() {
    const f = ensureFrame();
    if (!f.sheets.length) return [];
    const t = trailInfo();
    // no trail to go by (a save older than it, RevealAll): the whole list, unseen floors faint, as it always was
    if (!t.useTrail) return f.sheets;
    const keep = new Set(t.visited);
    const you = youSheet();
    if (you >= 0) keep.add(you);
    keep.add(index);
    return f.sheets.filter((s) => keep.has(s.index));
  }
  const listed = (i) => listedSheets().some((s) => s.index === i);

  // ── EM3-3D: THE SOLID MAP ──────────────────────────────────────

  /** The plan's own size in plan units - the level's box. */
  function planSize() {
    const f = ensureFrame();
    return f.bounds ? [Math.max(1, f.bounds.x1 - f.bounds.x0), Math.max(1, f.bounds.z1 - f.bounds.z0)] : [1, 1];
  }
  /** The turned space at this orbit (or another). */
  function orbitNow(yaw = orbit.yaw, pitch = orbit.pitch) {
    const [w, h] = planSize();
    const fr = orbitFrame(w, h, yaw, pitch);
    const fl = ensureFrame().floors;
    const span = fl.length ? Math.max(0, fl[fl.length - 1].y - fl[0].y) : 0;   // every floor is on the sheet
    const SOLID_PAD = SOLID_PAD_BASE + span;
    // EM3-3D fix: MARGIN ROUND THE LEVEL. The window clamps its view to the space it is handed, and the level's own
    // box put the corner the player walked in against the paper's edge instead of in the middle of it. Every mapping
    // reads umin/vmin off this one frame, so widening it here moves nothing but the clamp.
    return { ...fr, umin: fr.umin - SOLID_PAD, vmin: fr.vmin - SOLID_PAD, width: fr.width + 2 * SOLID_PAD, height: fr.height + 2 * SOLID_PAD };
  }
  /** The live sheet's height: the ground the window's flat space is laid at. */
  function groundY() { const f = ensureFrame(); return f.sheets[index]?.y ?? 0; }
  /** Plan point (px, py) at world height y, in paper pixels through the last view. */
  function paperOf(px, py, y, view = lastView) {
    const [U, V] = toSheet(orbitNow(), px, py, y ?? groundY(), groundY());
    return toPaper(view, U, V);
  }
  /** Paper pixels back to the plan, on the live sheet's ground. */
  function planOfPaper(px, py, view = lastView, y = groundY()) {
    const [U, V] = toMap(view, px, py);
    const fr = orbitNow();
    return fromSheet(fr, U, V + (y - groundY()) * fr.cP);   // a point at height y lies (y - y0)cP higher on the paper
  }
  /** Where a mark (plan units, with its own height where it has one) is on the paper, in either mode. */
  function markPaper(m) {
    if (!solidOn) return toPaper(lastView, m.x, m.z);
    return paperOf(m.x, m.z, m.y);
  }
  /** One sheet as solid cells, rebuilt when the reveal moves. */
  function solidOf(i, bucket = Math.round(orbit.yaw / CUT_STEP)) {
    const f = ensureFrame();
    const r = rec();
    if (!f.field || !f.sheets[i] || !f.bounds) return null;
    const walked = walkedKeys(r);
    // the walked trail decides what is drawn - unless there is none to go by (a map older than its trail, RevealAll)
    const t = trailInfo();
    const useTrail = t.useTrail;
    // EM3-3D fix: the cutaway depends on which way the sheet is turned, so each sheet keeps one model per sixteenth
    // of a turn (`CUT_STEP`) over one classification. A turn that comes back to a step it has drawn draws it again
    // for nothing, and the steps either side of the rest are made while the map is still (warmCuts).
    const seenKey = `${r?.revealed?.size ?? -1}|${walked?.size ?? -1}|${useTrail ? t.size : 'all'}`;
    let kept = solids.get(i);
    if (!kept || kept.seenKey !== seenKey || kept.rows !== f.rows) { kept = { seenKey, rows: f.rows, byCut: new Map(), classified: null }; solids.set(i, kept); }
    const have = kept.byCut.get(bucket);
    if (have) return have;
    const fl = f.field;
    const model = buildSolid(fl, f.sheets[i].storeys, {
      revealed: rowMaskOf(f.keyIndex, f.rows.length, r?.revealed ?? null),
      walked: rowMaskOf(f.keyIndex, f.rows.length, walked ?? null),
      pass: passCells(f, i),
      storeyY: f.floors.map((s) => s.y),
      trail: useTrail ? t.points : null,
      cutYaw: bucket * CUT_STEP,
      classified: kept.classified,
      planX0: fl.x0 - f.bounds.x0,
      planY0: f.bounds.z1 - (fl.z0 + fl.h * fl.cell),
    });
    kept.classified = model?.classified ?? null;
    kept.byCut.set(bucket, model);
    return model;
  }
  /** EM3-3D fix: one cut ahead per still tick - the steps either side of the rest, for every sheet - so a turn
   *  finds its walls already made instead of stopping to make them. */
  function warmCuts() {
    if (glInk) return;   // the GPU ink draws the geometry itself: no cell models to make ahead
    if (Math.abs(orbit.goalYaw - orbit.yaw) > 1e-4) return;
    const f = ensureFrame();
    const here = Math.round(orbit.yaw / CUT_STEP);
    for (const off of [1, -1, 2, -2]) {
      for (let i = 0; i < f.sheets.length; i++) {
        const kept = solids.get(i);
        if (!kept || !kept.classified || kept.byCut.has(here + off)) continue;
        solidOf(i, here + off);
        return;
      }
    }
  }
  function paintSolid(ctx, env) {
    const f = ensureFrame();
    const c = env.model ?? cut;
    lastView = env.view; lastPaper = env.paperW; lastPaperH = env.paperH; lastHands = env.reserveHands ?? null;
    if (!f.sheets.length) { ctx?.clearRect?.(0, 0, env.paperW * (env.dpr ?? 1), env.paperH * (env.dpr ?? 1)); return; }
    const cam = makeCamera(orbitNow(), env.view, groundY());
    // EM3-3D (Mac: "just make it like the classic dungeon 3d map but in this drawn style"): the dungeon's OWN
    // geometry, every revealed model, back faces unseen and sliced over the player's head, as DFU's 3D automap -
    // inked by the GPU. The cell model below stays for a page with no WebGL2 (and for the pins).
    if (glInk === undefined || glInk?.lost?.()) glInk = dungeonInkFor(ctx?.canvas?.ownerDocument ?? null);   // GL-LEAK: the page's one ink, not a context per open (a lost one built anew)
    if (glInk && f.bounds) {
      const r = rec();
      glInk.setMesh(`${r?.revealed?.size ?? 0}|${f.rows.length}`, rowsIn(f.model, r?.revealed ?? null), solids);   // GL-LEAK: this sheet's rows (the ink is the page's)
      const ox0 = f.origin[0], oz1 = f.origin[1];
      const dpr = env.dpr ?? 1;
      const img = glInk.render({
        paper: (x, y, z) => cam.P(x - ox0, oz1 - z, y),
        depth: (x, y, z) => cam.depth(x - ox0, oz1 - z, y),
        clipY: sliceY(), W: Math.max(1, Math.round(env.paperW * dpr)), H: Math.max(1, Math.round(env.paperH * dpr)), dpr, scale: env.view.scale,
        storeys: fullMap ? f.floors.map((q) => q.y) : null,   // ALL-FLOORS: each storey cut at its own slice
        focusY: viewBase(),   // ALL-FLOORS: the floor inked in full - the player's (or the one paged to)
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, env.paperW * dpr, env.paperH * dpr);
      ctx.drawImage(img, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }
    // EM3-3D fix (Mac: "you should still see everything else not only the floor youre in ... the whole map in 3d
    // only discover where you were"): EVERY floor, at its own height, lowest first so the ones above lie over it -
    // each drawn only where the player has been. Floors over the player's own are drawn a little lighter, so the
    // floor they stand on still reads first.
    const layers = [];
    for (let i = 0; i < f.sheets.length; i++) {
      const model = solidOf(i);
      if (model?.count) layers.push({ model, strength: i > index ? ABOVE_STRENGTH : GHOST[0] });
    }
    void c;
    const dpr = env.dpr ?? 1;
    // EM3-3D fix (Mac: "when i rotate the map it loses all details thats bad and makes it look cheap"): a turn is
    // drawn in full, every frame - the pen, the hatching and the stones as at rest. Only the kept image is skipped
    // (a turn changes every pixel of it).
    if (orbitMoving()) {
      solidBlitted = false;
      paintSolidStatic(ctx, layers, cam, { paperW: env.paperW, paperH: env.paperH, dpr });
      return;
    }
    // no DOM to keep an image in (the pins): the drawing straight onto the paper, as before
    // (the image is made in the paper's OWN page - the sheet reaches for no global DOM, the contract's law)
    const page = ctx?.canvas?.ownerDocument ?? null;
    const canKeep = !!ctx?.drawImage && typeof page?.createElement === 'function';
    if (!canKeep) { paintSolidStatic(ctx, layers, cam, { paperW: env.paperW, paperH: env.paperH, dpr }); return; }
    // ...and otherwise the full drawing is KEPT as an image over the paper and a margin round it. A pan is then one
    // blit of it; a zoom scales the blit while the wheel is still turning, and draws afresh once it rests.
    const v = env.view, sc = v.scale;
    const turnKey = `${orbit.yaw.toFixed(5)}|${orbit.pitch.toFixed(5)}|${dpr}|${layers.map((l) => l.model.count).join(',')}|${solidKeys()}`;
    const vw = env.paperW / sc, vh = env.paperH / sc;
    const k = solidImage;
    const inside = k && k.turnKey === turnKey && Math.abs(k.scale - sc) < 1e-9 &&
      v.ox >= k.u0 && v.oy >= k.v0 && v.ox + vw <= k.u0 + k.w / sc && v.oy + vh <= k.v0 + k.h / sc;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, env.paperW * dpr, env.paperH * dpr);
    if (!inside && k && k.turnKey === turnKey && Math.abs(k.scale - sc) > 1e-9 && clockNow - lastZoomAt < ZOOM_REST_S) {
      // mid-zoom: the kept image, scaled
      const r = sc / k.scale;
      ctx.drawImage(k.canvas, (k.u0 - v.ox) * sc * dpr, (k.v0 - v.oy) * sc * dpr, k.canvas.width * r, k.canvas.height * r);
      solidBlitted = true;
      return;
    }
    solidBlitted = false;
    if (!inside) {
      const u0 = v.ox - vw * IMAGE_MARGIN, v0 = v.oy - vh * IMAGE_MARGIN;
      const w = env.paperW * (1 + 2 * IMAGE_MARGIN), h = env.paperH * (1 + 2 * IMAGE_MARGIN);
      const canvas = k?.canvas ?? page.createElement('canvas');
      const W = Math.ceil(w * dpr), Hh = Math.ceil(h * dpr);
      if (canvas.width !== W || canvas.height !== Hh) { canvas.width = W; canvas.height = Hh; }
      const kctx = canvas.getContext('2d');
      if (!kctx) { paintSolidStatic(ctx, layers, cam, { paperW: env.paperW, paperH: env.paperH, dpr }); return; }
      paintSolidStatic(kctx, layers, makeCamera(orbitNow(), { ox: u0, oy: v0, scale: sc }, groundY()), { paperW: w, paperH: h, dpr });
      solidImage = { canvas, turnKey, scale: sc, u0, v0, w, h };
    }
    const K = solidImage;
    ctx.drawImage(K.canvas, Math.round((K.u0 - v.ox) * sc * dpr), Math.round((K.v0 - v.oy) * sc * dpr));
  }
  /** EM3-3D classic: where the slice cuts - over the player's feet, or over the floor that is up. */
  function sliceY() {
    // ALL-FLOORS (Mac: "a button that shows the full map of what we explored so far"): the slice over the highest
    // explored floor, so every floor walked is drawn at once - the lower ones under it, faded with their depth
    if (fullMap) return Math.max(viewBase(), topExploredY()) + SLICE_ABOVE;
    return viewBase() + SLICE_ABOVE;
  }
  /** ALL-FLOORS: the highest floor of anything revealed (the floor of each revealed row, its box's foot), kept per
   *  reveal. A row that climbs (a stair) counts at its foot, so a stairwell does not lift the cut into a ceiling. */
  let _topMemo = null;
  function topExploredY() {
    const f = ensureFrame(), r = rec();
    const n = r?.revealed?.size ?? 0;
    if (_topMemo && _topMemo.rows === f.rows && _topMemo.n === n && _topMemo.rec === r) return _topMemo.y;
    let y = -Infinity;
    for (const row of f.rows ?? []) {
      if (!r?.revealed?.has(row.key)) continue;
      if (row.aabb) { y = Math.max(y, row.aabb.min[1]); continue; }
      // a row with no box (a hand-built one): its own lowest vertex, as the GPU ink places it
      const m = rowMesh(row);
      let lo = Infinity;
      for (let i = 1; i < m.pos.length; i += 3) if (m.pos[i] < lo) lo = m.pos[i];
      if (Number.isFinite(lo)) y = Math.max(y, lo);
    }
    if (!Number.isFinite(y)) y = viewBase();
    _topMemo = { rows: f.rows, n, rec: r, y };
    return y;
  }
  function toggleFullMap() {
    fullMap = !fullMap;
    _fullMapPref = fullMap;
    viewFloor = null; floorShift = 0;
    return true;
  }
  /** The height the slice stands on: the storey paged to, else the player's feet. */
  function viewBase() {
    const f = ensureFrame();
    if (viewFloor != null && f.floors[viewFloor]) return f.floors[viewFloor].y;
    const feet = deps.player?.()?.feet;
    return Number.isFinite(feet?.[1]) ? feet[1] : groundY();
  }
  /** The storey the slice stands on now, as an index into the frame's floors (lowest first). */
  function viewStorey() {
    const f = ensureFrame();
    if (viewFloor != null) return viewFloor;
    const y = viewBase();
    let best = 0;
    f.floors.forEach((s, i) => { if (Math.abs(s.y - y) < Math.abs(f.floors[best].y - y)) best = i; });
    return best;
  }
  /** EM3-3D: the floor readout - "Floor 6 of 16", and "you are on 5" when the slice is on another floor. */
  function floorWords() {
    const fl = ensureFrame().floors;
    if (fl.length < 2) return null;
    const at = viewStorey();
    let you = null;
    const feet = deps.player?.()?.feet;
    if (Number.isFinite(feet?.[1])) {
      let b = 0;
      fl.forEach((q, i) => { if (Math.abs(q.y - feet[1]) < Math.abs(fl[b].y - feet[1])) b = i; });
      if (b !== at) you = b + 1;
    }
    return { at: at + 1, of: fl.length, you, top: at >= fl.length - 1, bottom: at <= 0 };
  }
  /** EM3-3D (Mac: "we need going floors up and down buttons"): the slice to the next storey up (+1) or down (-1) -
   *  every storey of the level, as the classic map's own up and down do - and the view follows it, so the floor
   *  stays where it was on the paper. False at the top or the bottom. */
  function floorStep(by) {
    const f = ensureFrame();
    if (!f.floors.length) return false;
    if (fullMap) { fullMap = false; _fullMapPref = false; }   // ALL-FLOORS: paging a floor is looking at ONE floor
    const from = viewStorey(), to = from + by;
    if (to < 0 || to >= f.floors.length) return false;
    const was = viewBase();
    viewFloor = to;
    floorShift += f.floors[to].y - was;
    return true;
  }
  /** Everything the solid models are built from, as a key - a kept image of an older reveal is not reused. */
  function solidKeys() {
    const r = rec();
    return `${r?.revealed?.size ?? -1}|${r?.trail?.size ?? 0}|${r?.trailAll ? 1 : 0}|${index}`;
  }
  function orbitMoving() {
    return Math.abs(orbit.goalYaw - orbit.yaw) > 1e-4 || Math.abs(orbit.goalPitch - orbit.pitch) > 1e-4;
  }
  function paintSolidOverlay(ctx, env) {
    lastView = env.view;
    const P = (m) => (m ? paperOf(m.x, m.z, m.y, env.view) : null);
    const flat = (m) => { const p = P(m); return p ? { ...m, x: p[0], z: p[1] } : null; };
    const me = playerHere();
    let player = null;
    if (me) {
      // the caret points where the player faces ON THE TURNED SHEET: the plan heading, projected
      const [x, y] = P(me);
      player = { x, z: y, yaw: headingOnPaper((px, py) => paperOf(px, py, me.y, env.view), me.x, me.z, me.yaw) };
    }
    const party = partyHere().map((m) => {
      const [x, y] = P(m);
      return { ...m, x, z: y, yaw: headingOnPaper((px, py) => paperOf(px, py, m.y, env.view), m.x, m.z, m.yaw ?? 0) };
    });
    const links = linksHere().map((l) => {
      const [x0, z0] = paperOf(l.x0, l.z0, l.y0, env.view), [x1, z1] = paperOf(l.x1, l.z1, l.y1, env.view);
      return { x0, z0, x1, z1 };
    });
    const ent = entranceHere();
    paintPlanOverlay(ctx, PAPER_VIEW, {
      paperW: env.paperW, paperH: env.paperH, dpr: env.dpr, pulse: env.pulse,
      player, entrance: flat(ent), marks: marksHere().map(flat).filter(Boolean), links, party, partyFill: PARTY_MARK_CSS,
      hoverNote, noteBoxes: (noteBoxes = []),
    });
    // the classic's beacon: a staff standing up out of the way in
    if (ent) paintBeacon(ctx, paperOf(ent.x, ent.z, ent.y, env.view), paperOf(ent.x, ent.z, ent.y + BEACON_STAFF, env.view), env.pulse ?? 0);
    // the compass, turning with the sheet, under the tab strip
    // PLUS-MAP (Mac: "make it a bit bigger put it into the upper right"): the compass stands in the paper's upper
    // right corner, clear of the sheet's title on the left
    const CR = COMPASS_R;
    const [cx, cy] = [env.paperW - CR - 26, (env.reserveTop ?? 0) + CR + 18];
    const [w, h] = planSize();
    const [n0x, n0y] = paperOf(w / 2, h / 2, groundY(), env.view), [n1x, n1y] = paperOf(w / 2, h / 2 - 1, groundY(), env.view);
    const len = Math.hypot(n1x - n0x, n1y - n0y) || 1;
    paintCompass(ctx, cx, cy, [(n1x - n0x) / len, (n1y - n0y) / len], len / Math.max(1e-6, env.view.scale), CR);
    // EM3-3D: which floor the slice is on, beside the compass, when the level has more than one - and that it is not
    // the player's own, when it is not
    const fl = ensureFrame().floors;
    if (!domTools && fl.length > 1 && ctx.fillText) {
      const at = viewStorey(), mine = viewFloor == null;
      ctx.save();
      ctx.font = `${Math.round(13)}px ${NAME_FACE_CSS}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = `rgba(${FLOOR_INK_RGB.join(',')}, ${mine ? 0.75 : 0.95})`;
      let you = '';
      if (!mine) {
        const feet = deps.player?.()?.feet;
        if (Number.isFinite(feet?.[1])) {
          let b = 0;
          fl.forEach((q, i) => { if (Math.abs(q.y - feet[1]) < Math.abs(fl[b].y - feet[1])) b = i; });
          if (b !== at) you = ` \u00b7 you are on ${b + 1}`;
        }
      }
      ctx.fillText(`Floor ${at + 1} of ${fl.length}${you}`, cx + 22, cy);
      ctx.restore();
    }
    // EM3-3D fix (Mac: "shouldnt show the floor transitions in the middle of the map"): a stair's glyph and name
    // only while the pointer is on it - the steps themselves are in the drawing
    if (hoverStair) {
      const [x, y] = paperOf(hoverStair.x, hoverStair.z, hoverStair.y, env.view);
      const [ax, ay] = paperOf(hoverStair.x + hoverStair.dx, hoverStair.z + hoverStair.dz, hoverStair.y, env.view);
      paintStairs(ctx, PAPER_VIEW, [{ ...hoverStair, x, z: y, dx: ax - x, dz: ay - y }], { hands: env.reserveHands ?? null });
    }
    if (!domTools) paintOrbitButtons(ctx, orbitButtonsLayout(env.paperW, env.paperH, env.reserveHands ?? null), {
      flat: orbit.goalPitch >= ORBIT.pitchMax - 1e-3, hover: hoverButton,
    });
  }
  /** Ease the orbit toward its goal. */
  function orbitTick(dt) { easeOrbit(orbit, dt); }
  function turn(by) { orbit.goalYaw += by; return true; }
  function tilt(by) { orbit.goalPitch = Math.max(ORBIT.pitchMin, Math.min(ORBIT.pitchMax, orbit.goalPitch + by)); return true; }
  // EM3-3D fix: the plan is a PLAN - north up, as the classic's and every paper map's is; back in the round the
  // sheet returns to the turn it had
  let yawBeforeFlat = null;
  function toggleFlat() {
    if (orbit.goalPitch >= ORBIT.pitchMax - 1e-3) {
      orbit.goalPitch = ORBIT.pitchRest;
      if (yawBeforeFlat != null) orbit.goalYaw = yawBeforeFlat;
      yawBeforeFlat = null;
    } else {
      yawBeforeFlat = orbit.goalYaw;
      orbit.goalPitch = ORBIT.pitchMax;
      orbit.goalYaw = Math.round(orbit.goalYaw / (2 * Math.PI)) * 2 * Math.PI;
    }
    return true;
  }
  function pressButton(id) {
    if (id === 'turnLeft') turn(-ORBIT.yawStep);
    else if (id === 'turnRight') turn(ORBIT.yawStep);
    else if (id === 'tiltUp') tilt(ORBIT.pitchStep);
    else if (id === 'tiltDown') tilt(-ORBIT.pitchStep);
    else if (id === 'flat') toggleFlat();
    else if (id === 'allFloors') toggleFullMap();
    else if (id === 'floorUp') floorStep(1);
    else if (id === 'floorDown') floorStep(-1);
    else if (id === 'home') {
      viewFloor = null; floorShift = 0;
      const feet = deps.player?.()?.feet;
      const f = ensureFrame();
      if (feet && f.sheets.length) setFloor(sheetAt(f, feet[1]));
      wantHome = false; wantMe = true; meLock = true;   // ME-PAN fix: centred on YOU; ME-PIVOT: and turned about you
    }
  }

  /**
   * EM3-3D fix (Mac: "the floors in the top right are very badly clickable"): THE STRIP'S WHOLE ROW IS THE BUTTON.
   * A press was taken only on the word's own ink (and a few pixels round it) - a narrow target on a sheet held in
   * gauntlets. Now the band from a little left of the widest word to the paper's edge is the strip, each row owns the
   * height half-way to its neighbours, and the nearest row takes the press.
   */
  function stripHitWide(px, py) {
    const rows = strip?.rows ?? [];
    if (!rows.length) return null;
    const s = strip.scale ?? 1;
    const x0 = Math.min(...rows.map((r) => r.x)) - STRIP.grab * 4 * s;
    const y0 = rows[0].y - STRIP.grab * s, y1 = rows[rows.length - 1].y + rows[rows.length - 1].h + STRIP.grab * s;
    if (px < x0 || py < y0 || py > y1) return null;
    let best = null, bestD = Infinity;
    for (const r of rows) { const d = Math.abs(py - (r.y + r.h / 2)); if (d < bestD) { bestD = d; best = r; } }
    return best ? best.index : null;
  }

  /** The floor row a paper point presses, or null: the word itself first, then the row's whole band. */
  function stripAt(px, py) { return floorStripHit(strip, px, py) ?? stripHitWide(px, py); }

  /** EM3-3D fix: the band the strip's rows own, in paper px - the same box stripHitWide takes presses in. */
  function stripBand() {
    const rows = strip?.rows ?? [];
    if (!rows.length) return null;
    const s = strip.scale ?? 1;
    const x0 = Math.min(...rows.map((r) => r.x)) - STRIP.grab * 4 * s;
    return { x0, x1: lastPaper, s, rows };
  }
  /** A faint wash behind the list, so it reads as a thing to press and not as more writing on the map. */
  function paintStripPlate(ctx, st) {
    const b = stripBand();
    if (!ctx?.fillRect || !b || st !== strip) return;
    const y0 = b.rows[0].y - STRIP.grab * b.s, last = b.rows[b.rows.length - 1], y1 = last.y + last.h + STRIP.grab * b.s;
    ctx.save();
    ctx.fillStyle = 'rgba(60, 44, 24, 0.10)';
    ctx.fillRect(b.x0, y0, b.x1 - b.x0 - 4 * b.s, y1 - y0);
    ctx.restore();
  }
  /** The row under the pointer, lit. */
  function paintStripHover(ctx, st, row) {
    const b = stripBand();
    if (!ctx?.fillRect || !b || row == null) return;
    const i = b.rows.findIndex((r) => r.index === row);
    if (i < 0) return;
    const r = b.rows[i];
    const up = i > 0 ? (b.rows[i - 1].y + b.rows[i - 1].h + r.y) / 2 : r.y - STRIP.grab * b.s;
    const dn = i < b.rows.length - 1 ? (r.y + r.h + b.rows[i + 1].y) / 2 : r.y + r.h + STRIP.grab * b.s;
    ctx.save();
    ctx.fillStyle = 'rgba(60, 44, 24, 0.16)';
    ctx.fillRect(b.x0, up, b.x1 - b.x0 - 4 * b.s, dn - up);
    ctx.restore();
  }

  /** A sheet up (+1) or down (-1) - EM3-3D fix: the next one the strip LISTS that way; false at the ends. */
  function step(by) {
    const list = listedSheets().map((s) => s.index);
    const next = by > 0 ? list.find((i) => i > index) : [...list].reverse().find((i) => i < index);
    return next == null ? false : setFloor(next);
  }

  function setFloor(next) {
    const f = ensureFrame();
    const want = Math.max(0, Math.min(f.sheets.length - 1, next));
    if (want === index) return false;
    index = want;
    cut = null;
    // EM3-3D fix: each floor sits at its own height on the turned sheet, so the view that framed the last one looks
    // at empty paper after a press - the page turns to the new floor's own rest view, as it opened
    if (solidOn) wantHome = true;
    hoverRow = null;
    return true;
  }

  return {
    id: 'automap',

    size() {
      if (solidOn) { const fr = orbitNow(); return { width: fr.width, height: fr.height }; }
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
      const turned = solidOn ? `|${fullMap ? 'all' : 'one'}|${sliceY().toFixed(2)}|${orbit.yaw.toFixed(4)}|${orbit.pitch.toFixed(4)}|${orbitMoving() ? 'm' : 's'}|${solidBlitted && clockNow - lastZoomAt >= ZOOM_REST_S ? 'fresh' : ''}` : '';
      return `${cutKey()}|${deps.insideBuilding ? 'in' : 'dn'}${turned}`;
    },

    paintStatic(ctx, env) {
      const c = env.model ?? cut;
      if (solidOn) paintSolid(ctx, env);
      else paintPlanStatic(ctx, c?.plan ?? null, env.view, {
        paperW: env.paperW, paperH: env.paperH, dpr: env.dpr,
        walked: c?.walked ?? null,
      });
      // DISC25-A: the stairs ride the kept layer with the walls they open (EM3-3D: the solid map inks its own)
      if (!solidOn) paintStairs(ctx, env.view, c?.stairs ?? [], { hands: env.reserveHands ?? null });
      // the floor strip rides the kept layer with the plan, so pressing
      // a storey re-letters it and a breathing beacon does not
      const f = ensureFrame();
      lastPaper = env.paperW;
      lastView = env.view;
      // EM3-3D fix (Mac: "the classic mode also didnt have the floor 1,2,3,4 shown in the upper right"): the solid
      // map is the whole dungeon at once, so it has no floors to page between and no list
      if (solidOn) { strip = null; void f; return; }
      strip = floorStripLayout(listedSheets(), index, {   // EM3-3D fix: only the floors the player has been on
        paperW: env.paperW,
        paperH: env.paperH,
        reserveTop: env.reserveTop ?? 0,   // EM5: below the tab strip's band
        hands: env.reserveHands ?? null,   // DISC25-A: ...and above the right gauntlet
        you: youSheet(), exit: exitSheet(), seen: c?.seen ?? null,
        measure: ctx?.measureText ? (t) => { ctx.font = stripFont(env.paperW); return ctx.measureText(t).width; } : null,
      });
      lastPaper = env.paperW;
      lastView = env.view;
      paintStripPlate(ctx, strip);
      paintFloorStrip(ctx, strip, { font: stripFont(env.paperW) });
    },

    paintOverlay(ctx, env) {
      lastView = env.view;
      if (solidOn) { paintSolidOverlay(ctx, env); return; }
      paintPlanOverlay(ctx, env.view, {
        paperW: env.paperW, paperH: env.paperH, dpr: env.dpr, pulse: env.pulse,
        player: playerHere(),
        entrance: entranceHere(),
        marks: marksHere(),
        links: linksHere(),
        party: partyHere(),   // DISC23-A
        partyFill: PARTY_MARK_CSS,
        hoverNote, noteBoxes: (noteBoxes = []),   // NOTE-PIN
      });
      paintStripHover(ctx, strip, hoverRow);
      paintFloorStripParty(ctx, strip, partyStoreys(), PARTY_MARK_CSS);   // DISC23-A: and which floors they are on
    },

    pickAt(px, py) {
      if (solidOn && !domTools) {
        const b = orbitButtonHit(orbitButtonsLayout(lastPaper, lastPaperH, lastHands), px, py);
        if (b) { pressButton(b.id); return; }
      }
      const hit = stripAt(px, py);
      if (hit != null) { setFloor(hit); return; }
      // NOTE-PIN (Mac: "a small clickable waypoint next to the note"): one click on a waypoint - its pin or its words -
      // opens it to rename (clear it to take it away)
      if (noteBoxHit(px, py)) { this.mark(px, py); return; }
      // DISC25-A (kurkku: "clicking stairs to move up or down a level is good"): a stair onto another floor turns
      // the page to it. The view stays where it is, and the plan units are the level's, so the stair's other end is
      // under the pointer that pressed it.
      // (the solid map shows every floor at once - a stair is steps in the drawing, not a page to turn)
      const stair = solidOn ? null : nearestStair(px, py);
      if (stair?.cross && stair.known) setFloor(stair.to);
    },

    /**
     * EM3-3D fix (Mac: "those floors there are almost not clickable"): IS THIS POINT ONE OF THE SHEET'S BUTTONS? The
     * window asks on the press: a press on a floor row or an on-paper button is a PRESS, taken whole - it never
     * starts a pan, so a hand that moves a few pixels while it clicks (every hand does) still turns the page. Before
     * this, four pixels of drift made the press a drag of the map, and the floor list read as dead.
     */
    control(px, py) {
      if (solidOn && !domTools && orbitButtonHit(orbitButtonsLayout(lastPaper, lastPaperH, lastHands), px, py)) return true;
      return stripAt(px, py) != null || !!noteBoxHit(px, py);   // NOTE-PIN: a press on a waypoint is a click, not a pan
    },

    hoverLabel(px, py) {
      hoverStair = null;
      hoverRow = null;
      hoverNote = null;
      if (solidOn && !domTools) {
        const b = orbitButtonHit(orbitButtonsLayout(lastPaper, lastPaperH, lastHands), px, py);
        hoverButton = b?.id ?? null;
        if (b) return { label: b.tip, cursor: 'pointer' };
      }
      const hit = stripAt(px, py);
      if (hit != null) {
        const f = ensureFrame();
        hoverRow = hit;
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
          const [x, y] = markPaper(m);
          if ((x - px) ** 2 + (y - py) ** 2 <= MARK_REACH * MARK_REACH) return { label: m.name, cursor: '' };
        }
      }
      const mark = nearestMark(px, py);
      // NOTE-PIN: a waypoint lights up and says how to change it
      if (mark?.kind === 'note') { hoverNote = mark.id; return { label: `${mark.name || 'Note'} - click to rename, empty to remove`, cursor: 'pointer' }; }
      if (mark) return { label: mark.name || (deps.title ?? ''), cursor: 'pointer' };
      // DISC25-A: a stair names where it goes
      const stair = solidOn ? null : nearestStair(px, py);
      hoverStair = null;
      if (stair) return { label: stair.cross ? `Stairs ${stair.name}` : 'Stairs up', cursor: stair.cross && stair.known ? 'pointer' : '' };
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
        // EM3-3D: on the solid map a note goes on the floor being looked at, where the pointer meets it
        const [mx, my] = solidOn ? planOfPaper(px, py, lastView, viewBase()) : toMap(lastView, px, py);
        if (!solidOn && !onRevealedFloor(mx, my)) return false;
        const [wx, wz] = fromPlan(mx, my);
        const res = tryAddOrEditUserNote(r, { point: [wx, solidOn ? viewBase() + 0.1 : noteHeight(f, wx, wz), wz], normal: [0, 1, 0], name: '' });
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
    breathes() { return !!entranceHere() || readPartyBodies(deps.party).length > 0 || hoverRow != null || hoverNote != null || (solidOn && (!!(hoverStair || hoverButton) || solidBlitted)); },   // EM3-3D fix: a scaled blit is redrawn once the zoom rests   // EM3-3D: a hovered stair's name and a hovered button are inked on the beat

    /** DISC25-A: what the window's foot says while this sheet is up. */
    hint() { return solidOn ? AUTOMAP_HINT_3D : AUTOMAP_HINT; },

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
      // EM3-3D: the classic 3D map's turn and tilt, on the solid sheet
      if (solidOn) {
        if (code === 'KeyQ') return turn(-ORBIT.yawStep);
        if (code === 'KeyE') return turn(ORBIT.yawStep);
        if (code === 'KeyR') return tilt(ORBIT.pitchStep);
        if (code === 'KeyF') return tilt(-ORBIT.pitchStep);
        if (code === PLAN_KEY) return toggleFlat();
        if (code === ALL_FLOORS_KEY) return toggleFullMap();
      }
      if (solidOn && (code === 'PageUp' || code === 'BracketRight')) { floorStep(1); return true; }
      if (solidOn && (code === 'PageDown' || code === 'BracketLeft')) { floorStep(-1); return true; }
      if (code === 'PageUp' || code === 'BracketRight') return step(1);
      if (code === 'PageDown' || code === 'BracketLeft') return step(-1);
      // DISC22-G: HOME BRINGS YOU BACK - to your own floor and the view the map opened at (DFU's 3D map has its
      // focus-on-player key); the window reads 'home' and resets its view
      if (code === 'Home') {
        viewFloor = null; floorShift = 0;   // EM3-3D: and the slice back to the player's own floor
        const feet = deps.player?.()?.feet;
        const f = ensureFrame();
        if (feet && f.sheets.length) setFloor(sheetAt(f, feet[1]));
        if (solidOn) { wantHome = false; wantMe = true; meLock = true; }   // ME-PAN fix: setFloor asked for the rest view; Home wants the player
        return 'home';
      }
      return false;
    },

    tick(dt) { clockNow += dt || 0; if (solidOn) { orbitTick(dt); warmCuts(); } /* the plan is rebuilt off the reveal sets' own sizes, on demand */ },

    /**
     * EM3-3D: THE VIEW, AFTER A TURN. The window pans and zooms a flat space and cannot know the sheet turned under
     * it; asked every tick, this answers a new view when the orbit has moved since the view was laid out (the plan
     * point under the paper's middle stays under it), or the rest view once the Home button has asked for it, and
     * null otherwise. The window clamps whatever it is handed.
     */
    reframe(view, limits) {
      if (!solidOn || !view) return null;
      if (lastScale !== view.scale) { lastScale = view.scale; lastZoomAt = clockNow; }
      if (wantMe) { wantMe = false; wantHome = false; floorShift = 0; framedAt = { yaw: orbit.yaw, pitch: orbit.pitch }; pivotW = null; return this.meView(limits, view); }
      if (wantHome) { wantHome = false; floorShift = 0; framedAt = { yaw: orbit.yaw, pitch: orbit.pitch }; return this.homeView(limits); }
      if (!framedAt) { framedAt = { yaw: orbit.yaw, pitch: orbit.pitch }; return null; }
      // a floor paged: the paper moves by the storey's height, so the new floor lies where the old one did
      if (floorShift) {
        const dv = -floorShift * orbitNow().cP;   // the frame's own cos(pitch)
        floorShift = 0;
        return { ...view, oy: view.oy + dv };
      }
      const settled = Math.abs(orbit.goalYaw - orbit.yaw) < 1e-6 && Math.abs(orbit.goalPitch - orbit.pitch) < 1e-6;
      if (Math.abs(framedAt.yaw - orbit.yaw) < 1e-6 && Math.abs(framedAt.pitch - orbit.pitch) < 1e-6) {
        if (settled && !holding) { pivotW = null; pivotFrom = null; }
        return null;
      }
      // EM3-3D fix (Mac: "it still doesnt stay centered when hold right click and rotating it"): a turn or a tilt
      // keeps STILL what is in the middle of the paper - the floor being looked at, where the middle of the paper
      // meets it - as the classic map turns about its pivot. The point is fixed in the WORLD when the turn begins
      // and put back at the same paper point every frame, so nothing drifts and nothing jumps near level.
      const y0 = groundY(), yv = viewBase();
      const before = orbitNow(framedAt.yaw, framedAt.pitch), after = orbitNow();
      if (!pivotW) {
        // TURN-AT-MOUSE (Mac: "it should rotate from where your mouse is starting the rotating with right click when
        // not centered on the player"): a right-drag turns about the floor under the point it began on; keys, buttons
        // and the stick, and a drag begun while the player is in the middle, turn about the middle as before
        // TURN-CENTRED (Mac: "when rotating the map is still able to move outside of the map window - it should be if
        // i drag leftclick there but not while rotate"): a turn is ALWAYS about the middle of the paper, and the middle
        // is always a point on the map - the drawn floor under it, else the plane under it held inside what is drawn,
        // else you, else the middle of everything drawn. What sits in the middle of the window stays there, so a turn
        // can never carry the map out of the window; only a left-drag moves it. (A pivot at the pointer swung
        // everything else round a point near the paper's edge, and off it.)
        const cx = limits.paperW / 2, cy = limits.paperH / 2;
        const me = playerHere();
        const meW = me ? { px: me.x, py: me.z, y: me.y ?? yv } : null;
        // ME-PIVOT (Mac: "it still tries to always rotate around the player - that should only work when you click
        // me and dont move the map after it"): the player is the pivot ONLY while the view is still the one Me left
        // (meLock - any pan or off-centre zoom lets it go). Otherwise: the floor drawn under the middle, else the
        // middle's own point on the floor being looked at. Never the player as a fallback.
        // TURN-FIXED (Mac: "rotating with right click sometimes causes the 3d map to move around the window - it
        // should NEVER do that, it needs a fixed rotate point in the middle of the parts you already explored"):
        // the pivot is ALWAYS the middle of everything explored (drawn), in 3D - the same world point every turn,
        // wherever the view was left - so the model spins in place and never travels across the paper. Only Me's
        // lock (turn about the player) overrides it. The paper-middle pick is gone: it changed with every pan.
        if (meLock && meW) pivotW = meW;
        if (!pivotW) pivotW = exploredMiddle();
        if (!pivotW) pivotW = drawnUnder(cx, cy, view, before, y0);
        if (!pivotW) {
          const U = view.ox + cx / view.scale, V = view.oy + cy / view.scale + (yv - y0) * before.cP;
          const [qx, qy] = fromSheet(before, U, V);
          pivotW = { px: qx, py: qy, y: yv };
        }
        const [U, V] = toSheet(before, pivotW.px, pivotW.py, pivotW.y, y0);
        pivotP = { x: (U - view.ox) * view.scale, y: (V - view.oy) * view.scale };
      }
      const [U2, V2] = toSheet(after, pivotW.px, pivotW.py, pivotW.y, y0);
      framedAt = { yaw: orbit.yaw, pitch: orbit.pitch };
      if (settled && !holding) { pivotW = null; pivotFrom = null; }
      return { ...view, ox: U2 - pivotP.x / view.scale, oy: V2 - pivotP.y / view.scale, turned: true };
    },

    /** EM3-3D: a right-drag, in screen pixels - across turns the sheet, up and down tilts it. */
    orbitBy(dx, dy) {
      if (!solidOn) return false;
      orbit.goalYaw += dx * ORBIT.dragYaw;
      orbit.goalPitch = Math.max(ORBIT.pitchMin, Math.min(ORBIT.pitchMax, orbit.goalPitch + dy * ORBIT.dragPitch));
      return true;
    },
    /** PLUS-MAP: the 3D map's controls, for the window to draw as Enhanced Plus buttons - null on a flat sheet. Each
     *  is the on-paper button it replaces, with the key that does the same. */
    tools() {
      if (!solidOn) return null;
      const flat = orbit.goalPitch >= ORBIT.pitchMax - 1e-3;
      const fw = floorWords();
      return [
        { id: 'turnLeft', group: 'turn', label: 'Turn', key: 'Q', icon: 'turnLeft', title: 'Turn left' },
        { id: 'turnRight', group: 'turn', label: 'Turn', key: 'E', icon: 'turnRight', title: 'Turn right' },
        { id: 'tiltUp', group: 'tilt', label: 'Tilt', key: 'R', icon: 'tiltUp', title: 'Tilt toward a plan', disabled: orbit.goalPitch >= ORBIT.pitchMax - 1e-3 },
        { id: 'tiltDown', group: 'tilt', label: 'Tilt', key: 'F', icon: 'tiltDown', title: 'Tilt toward the side', disabled: orbit.goalPitch <= ORBIT.pitchMin + 1e-3 },
        ...(fw ? [
          { id: 'floorDown', group: 'floor', label: 'Down', key: 'PgDn', icon: 'floorDown', title: 'Down a floor', disabled: fw.bottom },
          { id: 'floorUp', group: 'floor', label: 'Up', key: 'PgUp', icon: 'floorUp', title: 'Up a floor', disabled: fw.top },
        ] : []),
        { id: 'flat', group: 'view', label: flat ? '3D' : 'Plan', key: 'P', icon: flat ? 'solid' : 'plan', title: flat ? 'Back to 3D' : 'Flat plan', on: flat },
        ...(fw ? [{ id: 'allFloors', group: 'view', label: 'All', key: 'L', icon: 'allFloors', title: fullMap ? 'Back to one floor' : 'Every floor explored', on: fullMap }] : []),
        { id: 'home', group: 'view', label: 'Me', key: 'Home', icon: 'home', title: 'Back to you' },
      ];
    },
    /** PLUS-MAP: the floor readout beside the floor buttons ("Floor 6 of 16", "you are on 5"), or null. */
    toolStatus() { const w = solidOn ? floorWords() : null; return w && fullMap ? { ...w, all: true } : w; },
    /** ALL-FLOORS: is every explored floor on the paper? */
    get allFloors() { return solidOn && fullMap; },
    /** PLUS-MAP: a tool pressed - as its on-paper button was. Answers 'home' for the window to reset its view. */
    press(id) {
      if (!solidOn) return false;
      pressButton(id);
      return id === 'home' ? 'home' : true;
    },
    /** ME-PIVOT: the player moved the view themselves (a pan, a pinch, a zoom off the middle) - turns stop going about
     *  the player until Me is pressed again.
     *  TURN-STEADY (Mac: "dragging it around while a turn is still easing snaps it back / moves the whole map"): a
     *  turn started with Q/E or a turn button eases over several ticks with the button not held, so a pivot picked
     *  before the drag stays live through it - and reframe() only ever recomputes ox/oy FROM that pivot, so a pan or
     *  a pinch landing between two turn ticks was silently thrown away, and the map snapped back toward the stale
     *  pivot the next tick. Dropping the pivot here forces the very next reframe() to pick a fresh one off the view
     *  as the pan just left it, so the pan sticks and the turn carries on smoothly from there instead of overriding it.
     */
    viewMoved({ keepMe = false } = {}) { if (!keepMe) meLock = false; pivotW = null; pivotP = null; pivotFrom = null; },
    /** ME-PIVOT: is a turn about the player now (for the pins)? */
    get meLocked() { return meLock; },
    /** TURN-STEADY: world (x, z) as plan units (for the probes). */
    planOf(x, z) { ensureFrame(); return toPlan(x, z); },
    /** TURN-STEADY: the world point the turn in hand is about (plan units + height), or null - for the probes. */
    get pivot() { return pivotW ? { ...pivotW, paper: pivotP ? { ...pivotP } : null } : null; },
    /** TURN-AT-MOUSE: a right-drag begins at paper point (px, py) - the next turn is about the floor under it. */
    orbitFrom(px, py) {
      if (!solidOn || !Number.isFinite(px) || !Number.isFinite(py)) return false;
      pivotW = null; pivotFrom = { x: px, y: py };
      return true;
    },
    /** EM3-3D: a hand is on the turn (the right button held, the stick thrown): the pivot is kept until it lets go. */
    orbitHold(on) { holding = !!on; },
    /** EM3-3D: where plan point (px, py) at height y lies on the paper now (for the pins and probes). */
    paperAt(px, py, y) { return solidOn && lastView ? paperOf(px, py, y, lastView) : null; },
    /** EM3-3D: the plan point under paper point (px, py) on the floor being looked at (for the pins and probes). */
    planAt(px, py) { return solidOn && lastView ? planOfPaper(px, py, lastView, viewBase()) : null; },
    /** EM3-3D: the storey the slice stands on (index into the level's floors, lowest first). */
    get viewStorey() { return solidOn ? viewStorey() : null; },
    /** EM3-3D: two fingers turning, in radians of their own turn - the sheet turns with them. */
    twist(rad) {
      if (!solidOn || !Number.isFinite(rad)) return false;
      orbit.goalYaw -= rad; orbit.yaw -= rad;
      return true;
    },
    /** EM3-3D: is this sheet the solid one? The window asks before it gives the right button to the orbit. */
    get solid() { return solidOn; },
    /** EM3-3D: the orbit as it stands (radians), for the pins. */
    get orbit() { return { yaw: orbit.yaw, pitch: orbit.pitch, goalYaw: orbit.goalYaw, goalPitch: orbit.goalPitch }; },

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
      const ext = solidOn ? drawnExtent() ?? revealedExtent() : revealedExtent();
      if (!ext && !p) return fitView(limits, null);
      if (solidOn) {
        // EM3-3D: the same rest, measured in the turned space - the seen floor's corners as they land there
        // EM3-3D fix: THE WHOLE WALKED DUNGEON, every floor at its own height, is what the rest view fits
        const fr = orbitNow(), y0 = groundY();
        const min3 = scaleMinOf(limits);
        const pts = contentPts();
        let fit3 = min3, mid = null;
        if (pts.length) {
          const us = pts.map((q) => q[0]), vs = pts.map((q) => q[1]);
          const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
          fit3 = INK_FIT_MARGIN * Math.min(limits.paperW / Math.max(1, u1 - u0), limits.paperH / Math.max(1, v1 - v0));
          mid = [(u0 + u1) / 2, (v0 + v1) / 2];
        }
        // EM3-3D fix: under the window's ceiling BEFORE centring - the clamp keeps the corner, not the middle, so a
        // rest asked closer than SCALE_MAX opened with the player up in the paper's corner
        const scale3 = restScale(min3, fit3);
        // centred on the whole of it; on the player instead where that would leave them off the paper
        const me = p ? toSheet(fr, p.x, p.z, p.y ?? y0, y0) : null;
        let [cu, cv] = mid ?? me;
        if (me && (Math.abs(me[0] - cu) * scale3 > limits.paperW * 0.42 || Math.abs(me[1] - cv) * scale3 > limits.paperH * 0.42)) [cu, cv] = me;
        return viewCentredOn(cu, cv, scale3, limits);
      }
      const min = scaleMinOf(limits);
      const fit = ext ? INK_FIT_MARGIN * Math.min(limits.paperW / Math.max(1, ext.x1 - ext.x0), limits.paperH / Math.max(1, ext.y1 - ext.y0)) : min;
      const scale = restScale(min, fit);   // capped first, so the centre holds
      const c = p ? { x: p.x, y: p.z } : { x: (ext.x0 + ext.x1) / 2, y: (ext.y0 + ext.y1) / 2 };
      return viewCentredOn(c.x, c.y, scale, limits);
    },

    /** ME-PAN fix: THE ME BUTTON. The player in the middle of the paper, at the rest zoom (or nearer, if the map is
     *  already zoomed in past it) - the rest view centred on the whole walked dungeon and only fell back to the
     *  player when they were off the paper, so Me mostly did nothing visible. No player here: the rest view. */
    meView(limits, view = null) {
      const me = mePoint();
      if (!me) return this.homeView(limits);
      const rest = restScaleOf(limits);
      const scale = Math.min(SCALE_MAX, Math.max(rest, view?.scale ?? 0));
      return viewCentredOn(me[0], me[1], scale, limits);
    },

    /** ME-PAN fix: THE PAN CLAMP'S BOX - what has been drawn (and the player, as `me`), in the window's space. The
     *  window keeps it on the paper (inkMap PAN_SLACK), and always lets the view that centres the player stand.
     *  Null (nothing drawn): the window's own clamp alone. */
    panBox() {
      const pts = contentPts();
      const me = mePoint();
      if (me) pts.push(me);
      if (!pts.length) return null;
      const us = pts.map((q) => q[0]), vs = pts.map((q) => q[1]);
      return { x0: Math.min(...us), y0: Math.min(...vs), x1: Math.max(...us), y1: Math.max(...vs), ...(me ? { me } : {}) };
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
