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
// So the sheet's own space is PLAN UNITS: world minus the level's
// bottom-left corner. Everything crossing the seam converts in one
// place (`toPlan`), and the chains, the caret, the beacons and the
// notes all land in it, so nothing needs a second transform.
// ═══════════════════════════════════════════════════════════════════

import {
  floorTriangles, deriveFloors, floorAt, planBounds, floorPlan, PLAN_CELL,
} from '../systems/automapFloors.js';
import { boundarySegments, linkSegments, fitView, toPaper } from './inkMap.js';
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

  /** World (x, z) into the sheet's own space. ONE home for the seam. */
  const toPlan = (x, z) => [x - (frame?.origin[0] ?? 0), z - (frame?.origin[1] ?? 0)];

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
    const tris = floorTriangles(rows);
    const bounds = planBounds(tris, PLAN_CELL);
    frame = {
      model,
      rows,
      bounds,
      floors: deriveFloors(tris),
      origin: bounds ? [bounds.x0, bounds.z0] : [0, 0],
    };
    cut = null;
    index = Math.max(0, Math.min(frame.floors.length - 1, index));
    return frame;
  }

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
    });
    const tint = walked?.size
      ? floorPlan(rowsIn(model, walked), index, {
        segments: boundarySegments, link: linkSegments, floors: f.floors, bounds: f.bounds,
      })
      : null;
    // the chains arrive in WORLD units; the sheet's space is plan units
    for (const chain of plan.chains) for (const p of chain) { p.x -= f.origin[0]; p.y -= f.origin[1]; }
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
    for (const [, n] of r.notes ?? []) {
      const p = n?.position;
      if (!p || !mine(p[1])) continue;
      const [x, z] = toPlan(p[0], p[2]);
      out.push({ x, z, kind: 'note', name: n.note ?? '' });
    }
    for (const [, t] of r.teleporters ?? []) {
      for (const end of [t?.entrance, t?.exit]) {
        const p = end?.pos;
        if (!p || !mine(p[1])) continue;
        const [x, z] = toPlan(p[0], p[2]);
        out.push({ x, z, kind: 'teleporter', name: '' });
      }
    }
    return out;
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

    mark() { /* the middle button marks a PLACE; a dungeon plan has none */ },

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
      // inkMap's own fit: the whole storey on the sheet, centred on the
      // player where they are ON it and left to the window's clamp
      // where they are not
      // the plan's second axis IS world z, which is the sheet's y
      const p = playerHere();
      return fitView(limits, p ? { x: p.x, y: p.z } : null);
    },

    // ── the sheet's own handles, for the window's keys and its pins ──
    /** Which storey is up, and the list it came from. */
    get floor() { return index; },
    floors() { return ensureFrame().floors; },
    setFloor,
    /** Up and down a storey - what the floor keys ask for. */
    step,
    /** The strip's last layout, in paper px (null before the first paint). */
    get strip() { return strip; },
    get paperW() { return lastPaper; },
  };
}
