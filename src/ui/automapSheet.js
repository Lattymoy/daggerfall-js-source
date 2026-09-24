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
// ═══════════════════════════════════════════════════════════════════

import {
  floorTriangles, deriveFloors, floorAt, planBounds, floorPlan, storeyOccupancy, PLAN_CELL,
} from '../systems/automapFloors.js';
import { boundarySegments, linkSegments, fitView, toPaper, toMap, viewCentredOn, scaleMinOf, FIT_MARGIN as INK_FIT_MARGIN } from './inkMap.js';
import { tryAddOrEditUserNote, setUserNote } from '../systems/automap.js';
import {
  paintPlanStatic, paintPlanOverlay, floorStripLayout, floorStripHit, paintFloorStrip,
} from './inkAutomap.js';
import { stripFont } from './mapStrip.js';

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
const _frames = new WeakMap();   // rows -> { bounds, floors, full: Map<storey, occupancy> }

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
 * }} deps
 */
export function createAutomapSheet(deps = {}) {
  /** the LEVEL's frame and storey list, derived once per index */
  let frame = null;        // { model, bounds, floors, origin }
  /** the cut plan, rebuilt when the storey or the reveal sets move */
  let cut = null;          // { key, plan, walked }
  let index = 0;           // which storey is up
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

  /** The level's frame and storey list, over EVERY row (the header's
   *  first law). Rebuilt only when the index itself changes.
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
      base = { bounds: planBounds(tris, PLAN_CELL), floors: deriveFloors(tris), full: new Map() };
      if (rows.length) _frames.set(rows, base);
    }
    frame = {
      model,
      rows,
      bounds: base.bounds,
      floors: base.floors,
      full: base.full,
      origin: base.bounds ? [base.bounds.x0, base.bounds.z1] : [0, 0],   // the west and NORTH edges: see toPlan
    };
    cut = null;
    // DISC22-G: A NEW LEVEL OPENS ON THE PLAYER'S STOREY. `index` started at 0 and nothing set it, so a player on
    // Floor 3 opened the map on Floor 1 - no caret, and a plan of somewhere else.
    const feet = deps.player?.()?.feet;
    const here = feet && frame.floors.length ? floorAt(frame.floors, feet[1]) : -1;
    index = here >= 0 ? here : Math.max(0, Math.min(frame.floors.length - 1, index));
    return frame;
  }

  /** DISC22-G: the storey's whole floor on the frame's grid, revealed or not - once per level and storey. */
  function fullFloor(f, i) {
    if (!f.bounds) return null;
    if (!f.full.has(i)) f.full.set(i, storeyOccupancy(f.rows, f.floors, i, f.bounds));
    return f.full.get(i);
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
   *  the new storey's rule. */
  function cutKey() {
    const r = rec();
    const walked = walkedKeys(r);
    return [index, r?.revealed?.size ?? -1, walked?.size ?? -1, r?.entranceDiscovered ? 1 : 0,
      r?.notes?.size ?? 0, r?.teleporters?.size ?? 0].join('|');
  }

  function ensure() {
    const f = ensureFrame();
    const r = rec();
    const model = f.model;
    if (!model?.rows?.length || !f.floors.length) return null;
    const seen = r?.revealed ?? null;
    const walked = walkedKeys(r);
    const key = cutKey();
    if (cut?.key === key) return cut;
    const plan = floorPlan(rowsIn(model, seen), index, {
      segments: boundarySegments, link: linkSegments, floors: f.floors, bounds: f.bounds,
      full: fullFloor(f, index),   // DISC22-G: the ways on - an edge onto floor not yet seen is not a wall
    });
    const tint = walked?.size
      ? floorPlan(rowsIn(model, walked), index, {
        segments: boundarySegments, link: linkSegments, floors: f.floors, bounds: f.bounds,
      })
      : null;
    // the chains and both grids arrive in WORLD units; the sheet's space
    // is plan units, north up - through the one seam
    for (const chain of [...plan.chains, ...(plan.openChains ?? [])]) for (const p of chain) [p.x, p.y] = toPlan(p.x, p.y);
    plan.occupancy = occToPlan(plan.occupancy, f.bounds);
    if (tint) tint.occupancy = occToPlan(tint.occupancy, f.bounds);
    cut = { key, plan, walked: tint };
    return cut;
  }

  /** Every mark this storey carries, in plan units: the notes the
   *  player wrote and the teleporters they have stepped through, each
   *  bucketed onto the storey NEAREST its own height - a note sits 0.7
   *  off whatever surface it was stuck to, so it is never on the floor
   *  plane and must not be assumed to be. */
  function marksHere() {
    const f = ensureFrame();
    const r = rec();
    const out = [];
    if (!f.floors.length || !r) return out;
    const mine = (y) => floorAt(f.floors, y) === index;
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
        // DISC22-G: an end whose partner is on ANOTHER storey says which
        const other = ends[1 - i];
        const there = other ? floorAt(f.floors, other[1]) : -1;
        out.push({ x, z, kind: 'teleporter', name: there >= 0 && there !== index ? `to ${f.floors[there].label}` : '' });
      });
    }
    return out;
  }

  /** DISC22-G: the teleporter pairs with BOTH ends on this storey, as lines in plan units. */
  function linksHere() {
    const f = ensureFrame();
    const r = rec();
    const out = [];
    if (!f.floors.length || !r) return out;
    for (const [, t] of r.teleporters ?? []) {
      const a = t?.entrance?.pos, b = t?.exit?.pos;
      if (!a || !b || floorAt(f.floors, a[1]) !== index || floorAt(f.floors, b[1]) !== index) continue;
      const [x0, z0] = toPlan(a[0], a[2]);
      const [x1, z1] = toPlan(b[0], b[2]);
      out.push({ x0, z0, x1, z1 });
    }
    return out;
  }

  /** DISC22-G: the revealed floor's extent on this storey, in plan units, or null. */
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

  /** DISC22-G: is paper point (px, py) on floor this storey has revealed? A note is stuck to something seen, as
   *  DFU's is stuck to what its ray hit. */
  function onRevealedFloor(mx, my) {
    const occ = ensure()?.plan?.occupancy;
    if (!occ) return false;
    return occ.at(Math.floor((mx - occ.x0) / occ.cell), Math.floor((my - occ.z0) / occ.cell));
  }

  /** The player, in plan units, and only while they are ON this storey
   *  - a caret drawn on a floor the player is not standing on is a lie
   *  the 3D map could not tell. */
  function playerHere() {
    const f = ensureFrame();
    const p = deps.player?.();
    const feet = p?.feet;
    if (!feet || !f.floors.length) return null;
    if (floorAt(f.floors, feet[1]) !== index) return null;
    const [x, z] = toPlan(feet[0], feet[2]);
    return { x, z, yaw: p?.yaw ?? 0 };
  }

  /** The way in, while it has been found, and only on its own storey. */
  function entranceHere() {
    const f = ensureFrame();
    const r = rec();
    const sm = deps.startMarker;
    if (!sm || !r?.entranceDiscovered || !f.floors.length) return null;
    if (floorAt(f.floors, sm.y) !== index) return null;
    const [x, z] = toPlan(sm.x, sm.z);
    return { x, z };
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

  /** A storey up (+1) or down (-1); false at the ends of the level. */
  function step(by) { return setFloor(index + by); }

  function setFloor(next) {
    const f = ensureFrame();
    const want = Math.max(0, Math.min(f.floors.length - 1, next));
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
      // the floor strip rides the kept layer with the plan, so pressing
      // a storey re-letters it and a breathing beacon does not
      const f = ensureFrame();
      strip = floorStripLayout(f.floors, index, {
        paperW: env.paperW,
        paperH: env.paperH,
        reserveTop: env.reserveTop ?? 0,   // EM5: below the tab strip's band
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
      });
    },

    pickAt(px, py) {
      const hit = floorStripHit(strip, px, py);
      if (hit != null) setFloor(hit);
    },

    hoverLabel(px, py) {
      const hit = floorStripHit(strip, px, py);
      if (hit != null) {
        const f = ensureFrame();
        return { label: f.floors.find((s) => s.index === hit)?.label ?? '', cursor: 'pointer' };
      }
    // A NOTE UNDER THE POINTER ANSWERS ITS OWN WORDS, which is the law
    // the 3D map's hover has (automapPick's hoverKeyForHit: a note hit
    // answers the note text itself). The pointer arrives in PAPER
    // pixels and the marks are in plan units, so the reach is measured
    // through the view the sheet was last painted with - which is the
    // view the player is pointing at.
      const mark = nearestMark(px, py);
      if (mark) return { label: mark.name || (deps.title ?? ''), cursor: 'pointer' };
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
      if (!lastView || !r?.notes || !f.floors.length || typeof deps.askText !== 'function') return false;
      const near = nearestMark(px, py);
      let id, fresh = false;
      if (near?.kind === 'note') id = near.id;
      else {
        const [mx, my] = toMap(lastView, px, py);
        if (!onRevealedFloor(mx, my)) return false;
        const [wx, wz] = fromPlan(mx, my);
        const res = tryAddOrEditUserNote(r, { point: [wx, f.floors[index].y, wz], normal: [0, 1, 0], name: '' });
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

    /** DISC22-G: the way in breathes while it is on the sheet, so the window repaints on its beat. */
    breathes() { return !!entranceHere(); },

    /**
     * THE FLOOR KEYS. A storey up and a storey down, on the two pairs a
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
      // DISC22-G: HOME BRINGS YOU BACK - to your own storey and the view the map opened at (DFU's 3D map has its
      // focus-on-player key); the window reads 'home' and resets its view
      if (code === 'Home') {
        const feet = deps.player?.()?.feet;
        const f = ensureFrame();
        if (feet && f.floors.length) setFloor(floorAt(f.floors, feet[1]));
        return 'home';
      }
      return false;
    },

    tick() { /* the plan is rebuilt off the reveal sets' own sizes, on demand */ },

    mount() { /* the automap claims none of the world map's chrome */ },
    unmount() { /* ...so it gives none back */ },

    /** At rest the whole storey is on the sheet, centred on the player
     *  where they are on it and on the plan's middle where they are
     *  not. A dungeon map that opens on the far corner is a map the
     *  player has to pan before it says anything. */
    homeView(limits) {
      // DISC22-G: WHAT HAS BEEN SEEN, AT A SIZE A PLAYER CAN READ. The fit was the whole LEVEL's - revealed or not -
      // which on a big dungeon is a corridor three pixels wide. It is the revealed floor of this storey now, never
      // zoomed out past READABLE_SCALE, centred on the player where they are on it and on what has been seen where
      // they are not; a storey with nothing seen falls back to inkMap's own fit.
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
    /** Which storey is up, and the list it came from. */
    get floor() { ensureFrame(); return index; },   // DISC22-G: the frame first - it is what sets the player's storey
    floors() { return ensureFrame().floors; },
    setFloor,
    /** Up and down a storey - what the floor keys ask for. */
    step,
    /** The strip's last layout, in paper px (null before the first paint). */
    get strip() { return strip; },
    get paperW() { return lastPaper; },
  };
}
