// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EM3 — THE AUTOMAP'S INK: a dungeon floor drawn by the hand that drew
// the Iliac Bay.
//
// Mac (2026-09-21): "we're going to put our own spin on the automap and
// town map themselves, enhancing the look like how we did we the world
// map. The automap should become a 2d map and floor based instead of
// the current 3D implementation, streamlining it."
//
// `systems/automapFloors.js` answers WHAT to draw - the storeys a
// Daggerfall dungeon does not record, and one storey's walkable area as
// a coastline of chains in world units. This module is HOW: the same
// pen, the same halo, the same parchment as `ui/inkMap.js`, so the two
// sheets in one window are plainly one map.
//
// THE THREE WEIGHTS, and what each one means.
//
//   THE WALL is the outline of everything REVEALED on this storey, at
//   the pen's full weight. It is the shore of an island whose sea is
//   rock, which is why `boundarySegments` draws it: the walkable set is
//   the land.
//
//   THE WASH is the floor the player walked THIS RUN, laid under the
//   wall in the shore's own shade. This is DFU's grayscale law
//   (Automap.cs draws visited-this-run geometry brighter than
//   previously-revealed) read as INK rather than as brightness - a
//   hand-drawn plan does not have two greys, it has a tint where you
//   have been. Cell for cell, never a second outline: two outlines over
//   one room double every shared wall and read as a smudge.
//
//   THE MARKS are the beacon at the way in, the caret at the player,
//   and whatever the reveal record carries - doors, teleporters, the
//   player's own notes. They breathe on the overlay pass.
//
// THE FLOOR STRIP is the storey list, inked down the sheet's right edge
// in the tab strip's own hand (ui/mapStrip.js) and hit-tested the same
// way. Bottom storey at the BOTTOM, because that is where it is.
//
// Paper coordinates throughout, and the chains arrive in WORLD units,
// so the player's caret and the beacons land in the same space with no
// second transform. Guarded on a real 2D context, as every painter in
// this lane is.
// ═══════════════════════════════════════════════════════════════════

import { PEN, HALO_PEN, NAME_FACE, toPaper, paintCaret, paintPartyCarets, CARET_R } from './inkMap.js';
import { STRIP, stripScale, grabHit } from './mapStrip.js';

/** What each thing on a dungeon plan is drawn in. Every one of these is
 *  inkMap's own pen: the two sheets share a hand, and a colour invented
 *  here would be the first thing to give that away. */
export const PLAN_PEN = Object.freeze({
  wall: PEN.line,      // the outline of what has been revealed
  wash: PEN.wash,      // the floor walked THIS RUN (DFU's grayscale law, as ink)
  caret: PEN.player,   // the player, and which way they face
  beacon: PEN.select,  // the way in
  mark: PEN.soft,      // a door, a teleporter
  open: PEN.soft,      // DISC22-G: an edge onto floor not yet seen - a way on, not a wall
  note: PEN.name,      // what the player wrote down
  stair: PEN.line,     // DISC25-A: a stair onto another floor - the wall's own pen, because it is where the wall opens
  halo: PEN.halo,
});

/** The wall's weight, and the least it may thin to when the whole
 *  storey is fitted onto the sheet. */
export const WALL_PEN = 1.5;
export const WALL_PEN_MIN = 0.9;

/** The caret has ONE HOME in ui/inkMap.js (EM4: the town sheet grew
 *  an identical copy and the one-home gate caught it) - re-exported so
 *  a caller that has this module does not also have to reach for it. */
export { CARET_R } from './inkMap.js';
/** The beacon at the way in. */
export const BEACON_R = 7;
/** A door or a teleporter. */
export const MARK_R = 3.2;

/** The floor strip's own geometry, over the tab strip's scale so the
 *  two read as one hand. */
export const FLOOR_STRIP = Object.freeze({
  // THE STRIP LIVES IN THE PAPER'S TOP-RIGHT, and both numbers are the
  // reason. EM5's browser probe drew it right-aligned and CENTRED down
  // the edge, which put "Floor 1" squarely under the right gauntlet -
  // MAP-FIELD's lesson again, that the paper's rectangle is not the
  // part of it a player can SEE. The hands hold the sheet at its lower
  // corners, so the top-right quadrant is the clear parchment.
  padX: 26,     // in from the paper's RIGHT edge, clear of the thumb
  padY: 10,     // below the tab strip's own band
  gap: 7,       // between one storey's row and the next
  font: 13,
  grab: 6,
  rule: 1.3,
});

/** Which storeys are drawn on the strip when there are more than fit.
 *  A twelve-storey tower is not a thing Daggerfall builds, so this is a
 *  guard rather than a feature: past it the strip shows the live storey
 *  and its neighbours rather than running off the paper. */
export const FLOOR_STRIP_MAX = 12;

/**
 * Ink one storey's plan: the wash first, then the wall over it.
 *
 * `plan` is `floorPlan`'s answer over the REVEALED rows; `walked` is
 * the same call's answer over the rows visited this run, sharing the
 * first's storeys and bounds (automapFloors' two-passes-one-grid note).
 * `walked` may be null - a level opened before the player moved has a
 * plan and nothing to tint.
 *
 * @param {*} ctx - a 2D context
 * @param {{chains?: Array<Array<{x:number,y:number}>>, openChains?: Array<Array<{x:number,y:number}>>}} plan
 * @param {{ox:number, oy:number, scale:number}} view
 * @param {{paperW:number, paperH:number, dpr?:number, walked?:{occupancy?:*}|null, clear?:boolean}} opts
 */
export function paintPlanStatic(ctx, plan, view, opts) {
  if (!ctx?.setTransform) return;
  const { paperW, paperH, dpr = 1 } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (opts.clear !== false) ctx.clearRect(0, 0, paperW, paperH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // THE WASH: the cells walked this run, filled. Drawn as rectangles in
  // ONE path so the shared edges between neighbouring cells never show
  // as seams in a translucent fill - a per-cell fillRect at this alpha
  // leaves a visible grid.
  const occ = opts.walked?.occupancy ?? null;
  if (occ) {
    const cell = occ.cell;
    ctx.fillStyle = PLAN_PEN.wash;
    ctx.beginPath();
    for (let gz = 0; gz < occ.h; gz++) {
      for (let gx = 0; gx < occ.w; gx++) {
        if (!occ.at(gx, gz)) continue;
        // a RUN of covered cells becomes one rectangle
        let run = 1;
        while (gx + run < occ.w && occ.at(gx + run, gz)) run++;
        const [x0, y0] = toPaper(view, occ.x0 + gx * cell, occ.z0 + gz * cell);
        const [x1, y1] = toPaper(view, occ.x0 + (gx + run) * cell, occ.z0 + (gz + 1) * cell);
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
        gx += run - 1;
      }
    }
    ctx.fill();
  }

  // THE WALL: the outline of everything revealed on this storey.
  ctx.strokeStyle = PLAN_PEN.wall;
  ctx.lineWidth = Math.max(WALL_PEN_MIN, Math.min(WALL_PEN * 1.6, view.scale * 0.22));
  ctx.beginPath();
  for (const chain of plan?.chains ?? []) {
    if (chain.length < 2) continue;
    let first = true;
    for (const p of chain) {
      const [x, y] = toPaper(view, p.x, p.y);
      if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
    }
  }
  ctx.stroke();

  // DISC22-G: THE WAYS ON - an edge of what has been revealed that opens onto real floor not yet seen, drawn light
  // and broken, so a doorway into a room still to be found reads as a doorway (the 3D map shows the open mouth)
  const open = plan?.openChains ?? [];
  if (open.length) {
    ctx.strokeStyle = PLAN_PEN.open;
    ctx.lineWidth = Math.max(1, ctx.lineWidth * 0.6);
    ctx.setLineDash?.([3, 4]);
    ctx.beginPath();
    for (const chain of open) {
      if (chain.length < 2) continue;
      let first = true;
      for (const p of chain) {
        const [x, y] = toPaper(view, p.x, p.y);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
    }
    ctx.stroke();
    ctx.setLineDash?.([]);
  }
}

/**
 * The marks that breathe: the beacon at the way in, the doors and
 * teleporters, the notes, and the player's caret last so nothing is
 * drawn over it.
 *
 * Positions are in the plan's own world units (x, z). `player` carries
 * a `yaw` in radians, measured the way the motor measures it, and the
 * caret points along it - a dot on a dungeon plan tells you where you
 * are and a caret tells you which way you are facing, which is the
 * question a player actually has underground.
 *
 * @param {*} ctx
 * @param {{ox:number, oy:number, scale:number}} view
 * @param {{paperW:number, paperH:number, dpr?:number, clear?:boolean, pulse?:number,
 *          player?:{x:number,z:number,yaw?:number}|null,
 *          entrance?:{x:number,z:number}|null,
 *          marks?:Array<{x:number,z:number,kind?:string,name?:string}>,
 *          links?:Array<{x0:number,z0:number,x1:number,z1:number}>,
 *          party?:Array<{x:number,z:number,yaw?:number,name?:string}>, partyFill?:string}} opts
 */
export function paintPlanOverlay(ctx, view, opts) {
  if (!ctx?.setTransform) return;
  const { paperW, paperH, dpr = 1 } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (opts.clear) ctx.clearRect(0, 0, paperW, paperH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pulse = opts.pulse ?? 0;

  // DISC22-G: A TELEPORTER'S TWO ENDS, JOINED - both ends on this storey are one broken line between two rings, so a
  // pair reads as a pair (DFU's 3D map draws the connection); an end whose partner is on another storey carries
  // that storey's name instead (the mark's own `name`)
  if (opts.links?.length) {
    ctx.strokeStyle = PLAN_PEN.mark;
    ctx.lineWidth = 1.2;
    ctx.setLineDash?.([2, 3]);
    ctx.beginPath();
    for (const l of opts.links) {
      const [x0, y0] = toPaper(view, l.x0, l.z0);
      const [x1, y1] = toPaper(view, l.x1, l.z1);
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    ctx.setLineDash?.([]);
  }

  for (const m of opts.marks ?? []) {
    const [x, y] = toPaper(view, m.x, m.z);
    if (m.kind === 'note') {
      // a note is its own WORD on the paper, haloed like every other
      // name on this sheet (MAP-FIELD6)
      ctx.font = `12px ${NAME_FACE}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 2 * HALO_PEN;
      ctx.strokeStyle = PLAN_PEN.halo;
      ctx.strokeText(m.name ?? '', x, y - 4);
      ctx.fillStyle = PLAN_PEN.note;
      ctx.fillText(m.name ?? '', x, y - 4);
      continue;
    }
    ctx.strokeStyle = PLAN_PEN.mark;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (m.kind === 'teleporter') {
      // a ring inside a ring: you come out somewhere else
      ctx.arc(x, y, MARK_R, 0, Math.PI * 2);
      ctx.moveTo(x + MARK_R * 0.5, y);
      ctx.arc(x, y, MARK_R * 0.5, 0, Math.PI * 2);
      if (m.name) {
        ctx.stroke();
        ctx.beginPath();
        ctx.font = `11px ${NAME_FACE}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 2 * HALO_PEN;
        ctx.strokeStyle = PLAN_PEN.halo;
        ctx.strokeText(m.name, x, y + MARK_R + 2);
        ctx.fillStyle = PLAN_PEN.mark;
        ctx.fillText(m.name, x, y + MARK_R + 2);
        continue;
      }
    } else {
      // a door: a stroke across the opening
      ctx.moveTo(x - MARK_R, y); ctx.lineTo(x + MARK_R, y);
    }
    ctx.stroke();
  }

  if (opts.entrance) {
    const [x, y] = toPaper(view, opts.entrance.x, opts.entrance.z);
    ctx.strokeStyle = PLAN_PEN.beacon;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, BEACON_R + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    // and the way OUT, drawn inside it
    ctx.beginPath();
    ctx.moveTo(x, y + BEACON_R * 0.55);
    ctx.lineTo(x, y - BEACON_R * 0.55);
    ctx.moveTo(x - BEACON_R * 0.4, y - BEACON_R * 0.15);
    ctx.lineTo(x, y - BEACON_R * 0.55);
    ctx.lineTo(x + BEACON_R * 0.4, y - BEACON_R * 0.15);
    ctx.stroke();
  }

  // DISC23-A: the party members on this storey, under the player's own caret
  if (opts.party?.length && opts.partyFill) {
    paintPartyCarets(ctx, opts.party.map((m) => {
      const [x, y] = toPaper(view, m.x, m.z);
      return { x, y, yaw: m.yaw, name: m.name };
    }), { fill: opts.partyFill, halo: PLAN_PEN.halo });
  }

  if (opts.player) {
    const [x, y] = toPaper(view, opts.player.x, opts.player.z);
    // the caret is inkMap's, so the dungeon and the town point the
    // same way for the same reason
    paintCaret(ctx, x, y, opts.player.yaw ?? 0, { fill: PLAN_PEN.caret, halo: PLAN_PEN.halo });
  }
}

/** DISC25-A: the least the strip shows however little clear paper the hands leave - the live floor and one either
 *  side, or a chevron where there are more. */
export const FLOOR_STRIP_MIN = 3;

/**
 * The floor strip: one row per floor down the paper's right edge,
 * BOTTOM FLOOR AT THE BOTTOM, because that is where it is. The live
 * one is the pen at full weight with a rule under it, exactly as a tab
 * is - a reader who has learnt the tabs has learnt this.
 *
 * `measure(text, fontPx)` is the canvas's own where there is one.
 *
 * DISC25-A: THE STRIP STOPS ABOVE THE RIGHT GAUNTLET. On a real dungeon (Privateer's Hold was thirteen floors) it
 * ran down the whole edge and three rows sat under the thumb - EM5's own finding, that the paper's rectangle is
 * not the part a player can see, which `hands` (the window's reserveHands, paper px) now answers. Where the floors
 * do not fit, the strip shows the live one and its neighbours with a CHEVRON at the end that has more (`more`: +1
 * above, -1 below), which is itself a row: pressing it takes the next floor that way. And three marks: `you` (the
 * floor the player stands on), `exit` (the floor the way out is on, once found), and `seen` (the floors anything
 * has been revealed on - the rest are written faint, so a press on one is not a surprise).
 *
 * @param {Array<{index:number, label:string}>} floors - bottom first, as the sheet answers
 * @param {number} live
 * @param {{paperW?:number, paperH?:number, measure?:Function|null, reserveTop?:number,
 *          hands?:Array<{x0:number,x1:number,y0:number,y1:number}>|null, you?:number, exit?:number, seen?:Set<number>|null}} [opts]
 */
export function floorStripLayout(floors, live, opts = {}) {
  const { paperW = STRIP.refPaper, measure = null } = opts;
  const scale = stripScale(paperW);
  const fontPx = FLOOR_STRIP.font * scale;
  const rowH = fontPx * 1.25;
  const gap = FLOOR_STRIP.gap * scale;
  const padX = FLOOR_STRIP.padX * scale;
  const padY = FLOOR_STRIP.padY * scale;
  const width = (t) => (measure ? measure(t, fontPx) : t.length * fontPx * 0.52);
  // TOP-ANCHORED, under whatever band the caller reserves (the tab
  // strip's). The stack still reads top floor first, so Floor 1 is
  // lowest - it is where the paper is clear that changed, not the order.
  const top = (opts.reserveTop ?? 0) + padY;
  const all = floors ?? [];
  const widest = all.reduce((m, f) => Math.max(m, width(f.label)), 0);
  const left = paperW - padX - widest;
  // DISC25-A: the room above the right hand, in rows
  let max = FLOOR_STRIP_MAX;
  for (const h of opts.hands ?? []) {
    if (h.x1 <= left || h.x0 >= paperW || h.y0 <= top) continue;
    max = Math.min(max, Math.floor((h.y0 - padY - top + gap) / (rowH + gap)));
  }
  max = Math.max(FLOOR_STRIP_MIN, max);
  const win = stripWindow(all, live, max);
  const rows = [];
  const push = (row) => rows.push({ ...row, h: rowH, y: top + rows.length * (rowH + gap) });
  const chevron = fontPx * 1.1;
  if (win.above >= 0) push({ index: win.above, label: '', more: 1, w: chevron, x: paperW - padX - chevron, live: false });
  for (let i = win.shown.length - 1; i >= 0; i--) {
    const f = win.shown[i];    // top of the paper is the TOP floor
    const w = width(f.label);
    push({
      index: f.index, label: f.label, w,
      x: paperW - padX - w,
      live: f.index === live,
      you: f.index === opts.you,
      exit: f.index === opts.exit,
      faint: !!opts.seen && !opts.seen.has(f.index) && f.index !== live,
    });
  }
  if (win.below >= 0) push({ index: win.below, label: '', more: -1, w: chevron, x: paperW - padX - chevron, live: false });
  return { scale, fontPx, rows };
}

/** DISC25-A: the floors the strip shows in `max` rows, and the floor each chevron leads to (-1 for none): the live
 *  floor and its neighbours, a chevron taking a row wherever floors are hidden. */
function stripWindow(all, live, max) {
  if (all.length <= max) return { shown: all, above: -1, below: -1 };
  const shown = visibleFloors(all, live, Math.max(1, max - 2));
  const lo = all.indexOf(shown[0]), hi = all.indexOf(shown[shown.length - 1]);
  return {
    shown,
    above: hi < all.length - 1 ? all[hi + 1].index : -1,
    below: lo > 0 ? all[lo - 1].index : -1,
  };
}

/** Which storeys the strip shows. Everything, until there are more than
 *  `max` (FLOOR_STRIP_MAX unless the caller has less room) - then the
 *  live one and as many neighbours as fit, so the strip stays on the paper. */
export function visibleFloors(floors, live, max = FLOOR_STRIP_MAX) {
  const all = floors ?? [];
  if (all.length <= max) return all;
  const at = Math.max(0, all.findIndex((f) => f.index === live));
  let lo = at - (max >> 1);
  lo = Math.max(0, Math.min(all.length - max, lo));
  return all.slice(lo, lo + max);
}

/** Which storey a paper point hits, or null. The tab strip's own grab
 *  law, which is where the NEAREST rule comes from: these rows sit a
 *  gap apart narrower than two grab bands, so a first-match hit handed
 *  every press near a seam to the row above it. */
export function floorStripHit(layout, px, py) {
  const rows = layout?.rows ?? [];
  const i = grabHit(rows, px, py, FLOOR_STRIP.grab * (layout?.scale ?? 1));
  return i < 0 ? null : rows[i].index;
}

/** DISC25-A: how faint a floor nothing has been revealed on is written, against the soft pen of the others. */
export const FLOOR_UNSEEN_ALPHA = 0.45;

/** Ink the floor strip. Same hand as the tabs: haloed, the live row at
 *  full weight with a rule, the rest soft. DISC25-A: a floor with nothing
 *  revealed on it faint; a chevron where more floors are hidden; and after
 *  the word, a caret where the player stands and a ring where the way out is. */
export function paintFloorStrip(ctx, layout, { font = null } = {}) {
  if (!ctx?.save || !layout?.rows?.length) return;
  ctx.save();
  ctx.font = font ?? `${Math.round(layout.fontPx)}px ${NAME_FACE}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const s = layout.scale ?? 1;
  for (const r of layout.rows) {
    if (r.more) { paintStripChevron(ctx, r, s); continue; }
    ctx.lineWidth = 2 * HALO_PEN;
    ctx.strokeStyle = PEN.halo;
    ctx.lineJoin = 'round';
    if (r.faint) ctx.globalAlpha = FLOOR_UNSEEN_ALPHA;
    ctx.strokeText(r.label, r.x, r.y);
    ctx.fillStyle = r.live ? PEN.name : PEN.soft;
    ctx.fillText(r.label, r.x, r.y);
    if (r.faint) ctx.globalAlpha = 1;
    if (r.live) {
      ctx.lineWidth = FLOOR_STRIP.rule * layout.scale;
      ctx.strokeStyle = PEN.line;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + r.h);
      ctx.lineTo(r.x + r.w, r.y + r.h);
      ctx.stroke();
    }
    // the marks after the word, in the pad between it and the paper's edge
    let mx = r.x + r.w + FLOOR_MARK.gap * s;
    const my = r.y + r.h / 2;
    if (r.you) {
      const k = FLOOR_MARK.r * s;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + k * 1.6, my - k);
      ctx.lineTo(mx + k * 1.6, my + k);
      ctx.closePath();
      ctx.lineWidth = 2 * HALO_PEN;
      ctx.strokeStyle = PEN.halo;
      ctx.stroke();
      ctx.fillStyle = PLAN_PEN.caret;
      ctx.fill();
      mx += k * 1.6 + FLOOR_MARK.gap * s;
    }
    if (r.exit) {
      const k = FLOOR_MARK.r * s;
      ctx.beginPath();
      ctx.arc(mx + k, my, k, 0, Math.PI * 2);
      ctx.lineWidth = 1.6 * s;
      ctx.strokeStyle = PLAN_PEN.beacon;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** DISC25-A: the marks a floor wears after its word on the strip, in strip units. */
export const FLOOR_MARK = Object.freeze({ r: 3, gap: 4 });

/** DISC25-A: a chevron row - more floors that way - drawn as ink, not a glyph a face may not carry. */
function paintStripChevron(ctx, r, s) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, k = r.h * 0.28;
  ctx.beginPath();
  ctx.moveTo(cx - k * 1.4, cy + r.more * k * 0.6);
  ctx.lineTo(cx, cy - r.more * k * 0.6);
  ctx.lineTo(cx + k * 1.4, cy + r.more * k * 0.6);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2 * HALO_PEN + 1.4 * s;
  ctx.strokeStyle = PEN.halo;
  ctx.stroke();
  ctx.lineWidth = 1.4 * s;
  ctx.strokeStyle = PEN.soft;
  ctx.stroke();
}

/** DISC25-A: a stair's mark, in paper px - three treads across the way it goes and a head pointing along it. */
export const STAIR_GLYPH = Object.freeze({ tread: 4.5, step: 3, head: 4, label: 11 });

/**
 * DISC25-A: THE STAIRS - where the floor climbs from one storey to the next, which the plan had drawn as nothing
 * (or, where the next storey was on another sheet, as a WALL across the stair's middle). Each is three treads across
 * the way it goes and a head pointing along it, the way a plan draws a flight: toward the far side it climbs onto.
 * A stair onto another floor is in the wall's full pen and names the floor it reaches ("up to Floor 3") beyond its
 * head, unless the word would land under a hand (EM5: a sheet lays no word there); a stair inside this floor is in
 * the soft pen, points up it, and is left unnamed.
 * @param {*} ctx
 * @param {{ox:number, oy:number, scale:number}} view
 * @param {Array<{x:number, z:number, dx:number, dz:number, cross?:boolean, name?:string}>} stairs - plan units
 * @param {{hands?:Array<{x0:number,x1:number,y0:number,y1:number}>|null}} [opts]
 */
export function paintStairs(ctx, view, stairs, opts = {}) {
  if (!ctx?.setTransform || !stairs?.length) return;
  const G = STAIR_GLYPH;
  const under = (x, y) => (opts.hands ?? []).some((h) => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1);
  // a name that would land on one already written is left to the hover: two flights side by side, one up and one
  // down, wrote their words through each other in the first real-dungeon shot
  const placed = [];
  ctx.save?.();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of stairs) {
    const [x, y] = toPaper(view, s.x, s.z);
    let dx = s.dx ?? 0, dy = s.dz ?? 0;
    const len = Math.hypot(dx, dy);
    if (len > 1e-6) { dx /= len; dy /= len; } else { dx = 0; dy = -1; }
    const nx = -dy, ny = dx;
    const pen = s.cross ? PLAN_PEN.stair : PLAN_PEN.mark;
    // the halo under the whole mark, then the ink over it
    for (const pass of ['halo', 'ink']) {
      ctx.strokeStyle = pass === 'halo' ? PLAN_PEN.halo : pen;
      ctx.lineWidth = pass === 'halo' ? 2 * HALO_PEN + 1.2 : 1.2;
      ctx.beginPath();
      for (const t of [-G.step, 0, G.step]) {
        const cx = x + dx * t, cy = y + dy * t;
        ctx.moveTo(cx - nx * G.tread, cy - ny * G.tread);
        ctx.lineTo(cx + nx * G.tread, cy + ny * G.tread);
      }
      const hx = x + dx * (G.step + G.head + 1.5), hy = y + dy * (G.step + G.head + 1.5);
      ctx.moveTo(hx - dx * G.head - nx * G.head * 0.8, hy - dy * G.head - ny * G.head * 0.8);
      ctx.lineTo(hx, hy);
      ctx.lineTo(hx - dx * G.head + nx * G.head * 0.8, hy - dy * G.head + ny * G.head * 0.8);
      ctx.stroke();
    }
    if (s.cross && s.name) {
      const lx = x + dx * (G.step + G.head + 5), ly = y + dy * (G.step + G.head + 5);
      if (under(lx, ly)) continue;
      ctx.font = `${G.label}px ${NAME_FACE}`;
      ctx.textAlign = Math.abs(dx) < 0.35 ? 'center' : (dx > 0 ? 'left' : 'right');
      ctx.textBaseline = Math.abs(dy) < 0.35 ? 'middle' : (dy > 0 ? 'top' : 'bottom');
      const tw = ctx.measureText?.(s.name)?.width ?? s.name.length * G.label * 0.5;
      const bx = ctx.textAlign === 'center' ? lx - tw / 2 : (ctx.textAlign === 'left' ? lx : lx - tw);
      const by = ctx.textBaseline === 'middle' ? ly - G.label / 2 : (ctx.textBaseline === 'top' ? ly : ly - G.label);
      const box = { x0: bx - 2, y0: by - 1, x1: bx + tw + 2, y1: by + G.label + 1 };
      if (placed.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
      placed.push(box);
      ctx.lineWidth = 2 * HALO_PEN;
      ctx.strokeStyle = PLAN_PEN.halo;
      ctx.strokeText(s.name, lx, ly);
      ctx.fillStyle = PLAN_PEN.stair;
      ctx.fillText(s.name, lx, ly);
    }
  }
  ctx.restore?.();
}

/** DISC23-A: the dot a storey wears on the strip while a party member stands on it, in strip units. */
export const FLOOR_PARTY_DOT = Object.freeze({ r: 3, gap: 5 });

/**
 * DISC23-A: WHICH FLOOR YOUR FRIEND IS ON. A member is drawn only on their own storey (the player caret's law), so a
 * member one floor down is on no plan the player is looking at - and "find each other" is exactly that question. The
 * strip answers it: a dot in the party's green beside every storey a member stands on, so the next press is the right
 * one. On the overlay, not the kept layer, because members change storeys while the plan under them does not.
 * @param {*} ctx
 * @param {{scale:number, rows:Array<{index:number, x:number, y:number, h:number, more?:number}>}|null} layout
 * @param {Set<number>} storeys
 * @param {string} fill
 */
export function paintFloorStripParty(ctx, layout, storeys, fill) {
  if (!ctx?.beginPath || !layout?.rows?.length || !storeys?.size) return;
  const r = FLOOR_PARTY_DOT.r * layout.scale, gap = FLOOR_PARTY_DOT.gap * layout.scale;
  for (const row of layout.rows) {
    if (row.more || !storeys.has(row.index)) continue;   // DISC25-A: a chevron is not a floor
    const x = row.x - gap - r, y = row.y + row.h / 2;
    ctx.lineWidth = 2 * HALO_PEN;
    ctx.strokeStyle = PLAN_PEN.halo;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
  }
}
