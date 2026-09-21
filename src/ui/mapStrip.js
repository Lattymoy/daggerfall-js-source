// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EM1 — THE TAB STRIP, AND THE SLOT UNDER IT: the toggle Mac asked for,
// inked on the paper itself.
//
// Mac (2026-09-21): "instead of 3 seperate keybinds, adding a tab
// toggle ON THE MAP ITSELF."
//
// `systems/mapTabs.js` says WHICH sheets a place offers. This module is
// the other half: which one is LIVE, where each one's view is kept
// while the player is on another, and where the tabs sit on the
// parchment so a pointer can hit them.
//
// THE STRIP IS INKED, NOT CHROME. Every other control on this window is
// a DOM node laid over the sprite; the tabs are drawn on the sheet in
// the map's own pen, in PAPER coordinates. Two reasons, and the second
// is the one that matters: Mac asked for the toggle to be ON the map,
// and paper coordinates are the only space that survives MAP3's hands
// lane - when the Morrowind arm is holding the sheet, the canvas is
// laid over the paper's projected corners by a homography and a DOM
// tab would float in front of the arm. Inked, the tabs go round the
// corner with the paper and the pointer reaches them through the same
// inverse the marks are picked through, for free.
//
// THE STRIP SHOWS WHAT THIS PLACE OFFERS, AND NOTHING ELSE. A dimmed
// "The Bay" on a crypt's plan is clutter on a hand-drawn sheet, and it
// advertises a door that Mac's own sentence closed. Where one sheet is
// offered the strip reads as that sheet's NAME, which is what a drawn
// map has at its head anyway.
//
// EACH SHEET KEEPS ITS OWN VIEW. Leaving the town's streets for the bay
// and coming back must land where the player left, not at rest: the pan
// and the zoom belong to the sheet, not to the window, and a slot that
// forgets makes the tabs cost something to press.
//
// Pure geometry and pure state: no DOM, no host. `paintStrip` takes a
// context and is guarded the way every painter in this lane is (node
// drives these windows against a stub canvas with no 2D context), so
// the laws below are exercised with nothing rendered.
// ═══════════════════════════════════════════════════════════════════

import { MAP_SHEETS, sheetsFor, openOn } from '../systems/mapTabs.js';
import { PEN, HALO_PEN, NAME_FACE } from './inkMap.js';

/** The strip's geometry, in paper pixels at `refPaper` wide, scaled
 *  from there so the tabs keep their size against the sheet rather than
 *  against the screen. */
export const STRIP = Object.freeze({
  refPaper: 520,   // the paper width these numbers were chosen at
  scaleMin: 0.72,
  scaleMax: 1.35,
  font: 15,        // the hand face's size
  padX: 12,        // from the paper's left edge
  padY: 8,         // from the paper's top edge
  gap: 20,         // between one tab's ink and the next
  grab: 6,         // how far past the ink a pointer still hits a tab
  rule: 1.4,       // the live tab's underline
});

/** What each sheet is CALLED on the strip. A table rather than a field
 *  on the sheet object, because the automap's own name depends on where
 *  it is read - a shop's plan is not a dungeon's - and a sheet that
 *  names itself would have to be told the context anyway. */
export function sheetTitle(sheet, context) {
  if (sheet === 'automap') return context === 'building' ? 'Interior' : 'Dungeon';
  if (sheet === 'town') return 'Town';
  return 'The Bay';
}

/** The face the tabs are lettered in - the sheet's own, at the strip's
 *  size, so a tab reads as part of the map and not as a button. */
export function stripFont(paperW) {
  return `${Math.round(STRIP.font * stripScale(paperW))}px ${NAME_FACE}`;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** How much of the strip's reference size this sheet gets. Bounded at
 *  both ends: a tiny window must still be able to hit a tab, and a huge
 *  one must not letter the tabs like a headline. */
export function stripScale(paperW) {
  return clamp((paperW || STRIP.refPaper) / STRIP.refPaper, STRIP.scaleMin, STRIP.scaleMax);
}

/**
 * Where the tabs sit, in paper pixels. Takes the SLOT rather than the
 * context, because the slot's offer is the context's narrowed to the
 * sheets this window can actually ink - and a tab that inks nothing is
 * worse than no tab.
 *
 * `measure(text, fontPx)` is the canvas's own `measureText` where there
 * is a canvas; without one it falls back to a width per character,
 * which is enough for the laws (the order, the spacing, the hit test)
 * and never reaches a player.
 *
 * @param {{context?: string, ids?: readonly string[], live?: string|null}} slot
 * @param {{paperW?: number, measure?: ((t: string, f: number) => number)|null}} [opts]
 * @returns {{scale:number, fontPx:number, h:number, tabs:Array<{sheet:string,title:string,x:number,y:number,w:number,h:number,live:boolean}>}}
 */
export function stripLayout(slot, { paperW = STRIP.refPaper, measure = null } = {}) {
  const context = slot?.context ?? 'wilderness';
  const live = slot?.live ?? null;
  const scale = stripScale(paperW);
  const fontPx = STRIP.font * scale;
  const pad = { x: STRIP.padX * scale, y: STRIP.padY * scale };
  const gap = STRIP.gap * scale;
  const h = fontPx * 1.25;
  const width = (t) => (measure ? measure(t, fontPx) : t.length * fontPx * 0.52);
  const tabs = [];
  let x = pad.x;
  // The slot's ids are already in strip order (`sheetsFor` is, and the
  // narrowing keeps that order), and walking THEM rather than
  // MAP_SHEETS is what keeps a sheet this place does not offer - or
  // this build cannot draw - off the paper entirely.
  for (const sheet of slot?.ids ?? []) {
    const title = sheetTitle(sheet, context);
    const w = width(title);
    tabs.push({ sheet, title, x, y: pad.y, w, h, live: sheet === live });
    x += w + gap;
  }
  return { scale, fontPx, h: pad.y + h, tabs };
}

/**
 * Which tab a paper point hits, or null. The box is grown by `grab` on
 * every side: these are hand-lettered words with no button under them,
 * and a word's own ink is a thin target for a mouse and a hopeless one
 * for a thumb.
 */
export function stripHit(layout, px, py) {
  const g = STRIP.grab * (layout?.scale ?? 1);
  for (const t of layout?.tabs ?? []) {
    if (px >= t.x - g && px <= t.x + t.w + g && py >= t.y - g && py <= t.y + t.h + g) return t.sheet;
  }
  return null;
}

/**
 * Ink the strip. The live tab is the pen at full weight with a rule
 * under it; the others are `soft`, the same weight a border or a track
 * is drawn at - present, and plainly not what you are reading. Each is
 * haloed first, exactly as MAP-FIELD6 haloes every glyph and name, so
 * the letters hold against the parchment's own cracks.
 *
 * Paper coordinates: the caller has already put the context into paper
 * space (the DPR transform), and nothing here consults the view - the
 * strip does not pan or zoom with the map under it.
 */
export function paintStrip(ctx, layout, { font = null } = {}) {
  if (!ctx || !layout?.tabs?.length) return;
  // one offered sheet is a TITLE, not a toggle, and it is still drawn:
  // a hand-drawn plan has its name at its head.
  ctx.save();
  ctx.font = font ?? `${Math.round(layout.fontPx)}px ${NAME_FACE}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const t of layout.tabs) {
    ctx.lineWidth = 2 * HALO_PEN;
    ctx.strokeStyle = PEN.halo;
    ctx.lineJoin = 'round';
    ctx.strokeText(t.title, t.x, t.y);
    ctx.fillStyle = t.live ? PEN.name : PEN.soft;
    ctx.fillText(t.title, t.x, t.y);
    if (t.live) {
      const y = t.y + t.h;
      ctx.lineWidth = STRIP.rule * layout.scale;
      ctx.strokeStyle = PEN.line;
      ctx.beginPath();
      ctx.moveTo(t.x, y);
      ctx.lineTo(t.x + t.w, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * THE SLOT: which sheet is live, and what each one remembers.
 *
 * `context` is fixed for the life of a window - a map is opened from
 * where the player stands and they cannot walk while it is up - so it
 * is taken once, here, rather than re-asked per frame.
 *
 * THE OFFER IS NARROWED BY WHAT THIS WINDOW CAN INK. `has` is the set
 * of sheets the window was actually built with, and the slot's offer is
 * the context's own offer filtered by it. A tab that inks nothing is
 * worse than no tab - and this is the honest gate while the arc is
 * mid-flight: until EM3 and EM4 hand over the automap and town sheets,
 * a window that holds only the world sheet offers only the world, and
 * `empty` says so plainly at the door rather than opening a blank page.
 *
 * @param {{context?: string, wanted?: string|null, has?: readonly string[]|null}} [opts]
 */
export function createSheetSlot({ context = 'wilderness', wanted = null, has = null } = {}) {
  const offer = sheetsFor(context);
  const ids = Object.freeze(has ? offer.filter((s) => has.includes(s)) : [...offer]);
  let live = ids.length ? (ids.includes(openOn(context, wanted)) ? openOn(context, wanted) : ids[0]) : null;
  /** @type {Map<string, object>} each sheet's last view, while this window is open */
  const views = new Map();

  return {
    context,
    /** The sheets this place offers, in strip order. */
    get ids() { return ids; },
    get live() { return live; },
    /** Is more than one sheet reachable from here? The strip is drawn
     *  either way (it names the sheet); this is what says whether the
     *  toggle KEY does anything. */
    get toggles() { return ids.length > 1; },
    /** Nothing this place offers can be inked by this window. The host
     *  asks BEFORE it opens the map: a blank sheet is a bug report. */
    get empty() { return ids.length === 0; },

    /**
     * Put a sheet up. Refused - and the live sheet left alone - where
     * this place does not offer it, which is Mac's sentence enforced at
     * the one door rather than at each caller.
     * @param {string} sheet
     * @param {object|null} [currentView] the outgoing sheet's view, kept for its return
     * @returns {boolean} whether the live sheet moved
     */
    select(sheet, currentView = null) {
      // the slot's OWN ids, which are the place's offer narrowed to
      // what this window can ink - `sheetAvailable` alone would let a
      // caller select a sheet with no ink behind it
      if (!ids.includes(sheet) || sheet === live) return false;
      if (currentView) views.set(live, { ...currentView });
      live = sheet;
      return true;
    },

    /** The next sheet this place offers, wrapping - what the toggle key
     *  and a strip click with nothing under it do. */
    cycle(step = 1, currentView = null) {
      if (ids.length < 2) return false;
      const i = ids.indexOf(live);
      const next = ids[(((i + step) % ids.length) + ids.length) % ids.length];
      return this.select(next, currentView);
    },

    /** What this sheet was last looking at, or null for "at rest" - the
     *  window's own first-layout answer, which is the whole plan fitted
     *  to the paper. */
    viewOf(sheet) { return views.get(sheet) ?? null; },
    remember(sheet, view) { if (view) views.set(sheet, { ...view }); },
    forget(sheet) { views.delete(sheet); },
  };
}

/** Re-exported so a caller that has the slot does not also have to
 *  import the table to letter a strip. */
export { MAP_SHEETS };

// ── EM1: THE SHEET CONTRACT ──────────────────────────────────────
//
// What the held window asks of whatever is inked on its paper. The
// WINDOW owns the parchment, the hands, the pan, the zoom, the
// Morrowind pose and the closing; the SHEET owns the coordinate space,
// the ink and the pointer inside it.
//
// The three members that make a sheet a sheet are the space, the ink
// and the pointer. Keys and chrome are deliberately NOT here yet: the
// world map's keys are tangled with the window's own phases and boxes
// (the resume prompt, the info box, the travel panel), and the automap's
// (a floor up, a floor down) arrive with EM3 - deriving a hook's shape
// from ONE implementation is how a hook comes out the wrong shape.
//
// `mount`/`unmount` are how a sheet claims the shared chrome it needs
// (the world map's search box, ports button and legend) and gives it
// back on a tab switch, so the window itself never learns which sheet
// wants what.
export const SHEET_MEMBERS = Object.freeze([
  'id',            // one of MAP_SHEETS
  'size',          // () => {width, height} - the sheet's own coordinate space
  'ensure',        // () => model|null - build/refresh; null inks nothing
  'staticKey',     // () => string - what makes the kept ink layer stale
  'paintStatic',   // (ctx, env) => void - the ink that only the view moves
  'paintOverlay',  // (ctx, env) => void - what breathes, per frame
  'pickAt',        // (px, py) => void - a click on the paper
  'hoverLabel',    // (px, py) => void - the pointer's label
  'mark',          // (px, py) => void - the middle button
  'tick',          // (dt) => void - the sheet's own clock
  'mount',         // () => void - claim the shared chrome
  'unmount',       // () => void - give it back
  'homeView',      // (limits) => view|null - where this sheet rests; null = fit
]);

/** Does this object answer the whole contract? Used by the window's own
 *  pin rather than at runtime: a sheet that is missing a member should
 *  fail a test, not a frame. */
export function isSheet(s) {
  return !!s && SHEET_MEMBERS.every((m) => (m === 'id' ? typeof s.id === 'string' : typeof s[m] === 'function'));
}
