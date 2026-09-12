// EB1 - THE ENHANCED BOOK (2026-09-12).
//
// Mac: "For the book reader, I was wondering if we could use the
// animated book in my repo project-raum." Then: "Do it."
//
// So a Daggerfall book is READ IN A BOOK: project-raum's physical
// journal (vendor/raum-book/, Mac's own - a leather cover that flips
// open, two-page spreads, leaves that turn as a cloth fold about the
// spine, the fore-edge stack, the slide up from below the screen),
// with Daggerfall's words on its pages in Daggerfall's FNT faces. The
// world stays standing behind it: Raum's rule ("only the book, not
// the entire screen") is the talk panel's rule too.
//
// ── PAINT AND BONES (PX23), AGAIN ────────────────────────────────
//
// This face owns no reading law. The classic BookReaderWindow
// (ui/bookReader.js) is the model under both faces: its constructor
// plays OpenBook, its `lines` are LocalizedBook's converted rows
// (one row per text token, sticky centring and FontPrefix, the empty
// line's reset - AUDIT B-P1, 26 F150, 24 ui), `placeBookLabels` is
// LayoutBookLabels (a wrapping label per row, its height its own
// face's rows), `bookFont(x)` is FontPrefix's face table, and its
// input() is the exit's ButtonClick. What this face adds is the one
// thing a two-page book needs that a scroll does not: PAGINATION.
// The placed label stream is cut into leaves by ROW - a row never
// straddles a leaf - which is a typesetter's cut over DFU's own
// layout, not a second layout. The page-turn plays per leaf turned,
// as DFU plays it per centre-page crossed.
//
// ── THE GLYPHS ───────────────────────────────────────────────────
//
// Raum's pages are 2D canvases and the port's text path draws through
// the GL renderer, so the FNT faces get a 2D painter here: each face
// is expanded ONCE per ink colour into a 16x15 cell atlas canvas from
// FntFile.getGlyphPixels, and a row is drawImage per glyph with
// DrawText's own laws - the ASCII fold, a missing glyph drawn as a
// space, the drawn space advancing by the glyph width alone
// (DaggerfallFont.cs:328) while the measure adds the spacing.
//
// ── THE SIZE ─────────────────────────────────────────────────────
//
// The book paints at a LOGICAL resolution (UIK device pixels per
// logical pixel, an integer, so the pixel glyphs and Raum's pixel
// paper stay crisp) on a canvas the size of the view. The leaf is
// sized off the view's HEIGHT - a book is tall - and capped by half
// the width; the text wraps to the leaf. A portrait phone gets a
// narrow leaf, as it gets a small classic page: the two-page spread
// is the book's shape and turning the phone is the answer.

import {
  BOOK, createBook, resizeBook, paintBook, openBook, closeBook, flipBook, finishFlip, bookHit, spreadCount,
} from '../../vendor/raum-book/book.js';
import { PAPER } from '../../vendor/raum-book/paper.js';
import { bookFont, bookFontsVersion, placeBookLabels } from './bookReader.js';
import { measureText, asciiFold, hasGlyph, spaceGlyphWidth, FNT_SPACE_CODE } from './text.js';
import { wrapText } from './talkWindow.js';
import { FNT_GLYPH_DIM, FNT_GLYPH_COUNT, FNT_ASCII_START } from '../formats/fntFile.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** The page's ink: Raum's journal ink, on Raum's parchment. */
export const INK = css(PAPER.ink);
/** The leaf's text inset - Raum's own (book.js pageCanvas: x 8/12, y 10,
 *  w pageW-20, h pageH-24); the inner margin sits at the gutter. */
export const LEAF_INSET = Object.freeze({ x: 8, y: 10, w: 20, h: 24 });

// ── the FNT painter ───────────────────────────────────────────────
const ATLAS_COLS = 16;
const _atlases = new WeakMap();   // fnt -> Map(color -> canvas)

/** The face's glyphs as ONE canvas per ink: 240 cells of 16x16, the
 *  glyph in each cell's left `width` columns (FNT_GLYPH_DIM cells,
 *  the atlas text.js builds for GL, drawn here with fillRect). */
export function fntAtlas(fnt, color = INK) {
  let byColor = _atlases.get(fnt);
  if (!byColor) { byColor = new Map(); _atlases.set(fnt, byColor); }
  let c = byColor.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = ATLAS_COLS * FNT_GLYPH_DIM;
  c.height = (FNT_GLYPH_COUNT / ATLAS_COLS) * FNT_GLYPH_DIM;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  for (let gi = 0; gi < FNT_GLYPH_COUNT; gi++) {
    const px = fnt.getGlyphPixels(gi, 1);
    if (!px) continue;
    const ox = (gi % ATLAS_COLS) * FNT_GLYPH_DIM, oy = Math.floor(gi / ATLAS_COLS) * FNT_GLYPH_DIM;
    for (let y = 0; y < fnt.fixedHeight; y++) {
      for (let x = 0; x < FNT_GLYPH_DIM; x++) if (px[y * FNT_GLYPH_DIM + x]) ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
  byColor.set(color, c);
  return c;
}

/** DrawText's walk (DaggerfallFont.cs:305-330), onto a 2D context:
 *  the fold, a glyph the face lacks CAST TO A SPACE, the drawn space
 *  advancing by the glyph width alone. `w` with align 'center'
 *  centres the row in that width (TextLabel's HorizontalAlignment). */
export function paintFnt(ctx, fnt, text, x, y, { color = INK, align = 'left', w = 0 } = {}) {
  if (!fnt || !text) return;
  const atlas = fntAtlas(fnt, color);
  let cx = Math.round(align === 'center' ? x + Math.max(0, (w - measureText(fnt, text)) / 2) : x);
  const h = fnt.fixedHeight;
  for (const ch of text) {
    let code = asciiFold(ch.charCodeAt(0));
    if (!hasGlyph(code)) code = FNT_SPACE_CODE;
    if (code === FNT_SPACE_CODE) { cx += spaceGlyphWidth(fnt); continue; }
    const gi = code - FNT_ASCII_START;
    const gw = fnt.glyphWidth(gi);
    if (gw > 0) {
      ctx.drawImage(atlas, (gi % ATLAS_COLS) * FNT_GLYPH_DIM, Math.floor(gi / ATLAS_COLS) * FNT_GLYPH_DIM, gw, h, cx, y, gw, h);
    }
    cx += gw + 1;   // classicGlyphSpacing
  }
}

// ── pagination (pure, tested) ─────────────────────────────────────
/**
 * Cut the placed label stream (placeBookLabels' output) into leaves of
 * `pageH` logical pixels, BY ROW: every wrapped row keeps its label's
 * face, centring and height, and a row that would cross the leaf's
 * foot opens the next leaf instead. A leaf never opens on a blank
 * row (the typesetter's rule; DFU's scroll has no leaves to open),
 * and a book with no rows is one blank leaf. Returns
 * [[{ text, center, face, rowH, y }...]...].
 */
export function paginateBook(placed, pageH) {
  const pages = [[]];
  let y = 0;
  for (const label of placed) {
    for (let r = 0; r < label.rows.length; r++) {
      const text = label.rows[r] ?? '';
      const rowH = Math.max(1, label.rowH | 0);
      let page = pages[pages.length - 1];
      if (y + rowH > pageH && page.length) { page = []; pages.push(page); y = 0; }
      if (!page.length && !text) continue;   // no leaf opens on white
      page.push({ text, center: !!label.center, face: label.face, rowH, y });
      y += rowH;
    }
  }
  return pages;
}

/** UIK: device pixels per logical pixel - an integer, from the view's
 *  short edge, so a phone and a desktop both get a leaf whose glyphs
 *  are a readable size and stay pixel-crisp. */
export const uiScale = (w, h, dpr = 1) => Math.max(1, Math.round(Math.min(w, h) * dpr / 300));

/** The leaf, off the view: as tall as the view allows (a book is
 *  tall), no wider than half the view less the gutter, and never a
 *  squat slab - the height is capped at 1.6 widths. */
export function leafSize(uiW, uiH) {
  let ph = Math.max(60, Math.floor(uiH * 0.84));
  const pw = Math.max(48, Math.min(Math.floor((uiW - 16) / 2) - 8, Math.floor(ph * 0.72)));
  ph = Math.min(ph, Math.floor(pw * 1.6));
  return { pw, ph };
}

// ── the mount ─────────────────────────────────────────────────────
let el = null;        // the overlay canvas
let ctx = null;
let model = null;
let book = null;
let onExit = () => {};
let relock = () => {};
let uiW = 0, uiH = 0, uik = 1;
let layoutKey = '';   // what the pages were cut against: font version, default font, leaf size
let closing = false;
let listeners = [];

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The book's pages, cut fresh from the model's layout law over THIS
 *  leaf's width and height. Each page paints its rows with the FNT
 *  painter inside Raum's own inset. */
function cutPages(defaultFont) {
  const wrapW = BOOK.pageW - LEAF_INSET.w;
  const { placed } = placeBookLabels(model.lines, (x) => bookFont(x) ?? defaultFont, wrapW);
  const pages = paginateBook(placed, BOOK.pageH - LEAF_INSET.h);
  return pages.map((rows) => ({
    paint(pctx, x, y, w) {
      for (const row of rows) {
        const fnt = row.face?.fnt ?? defaultFont?.fnt;
        paintFnt(pctx, fnt, row.text, x, y + row.y, { align: row.center ? 'center' : 'left', w });
      }
    },
  }));
}

/** Raum's inscription seam (vendor/raum-book/book.js drawJournal), in
 *  this port's faces: the cover's title in the largest FNT loaded
 *  (FontPrefix 5, FONT0004), everything else in the default face; a
 *  `w` wraps the words to it. */
function inscribe(defaultFont) {
  return (ictx, str, x, y, { face, color = INK, w = 0 } = {}) => {
    const fnt = (face === 'title' ? (bookFont(5)?.fnt ?? defaultFont?.fnt) : defaultFont?.fnt) ?? null;
    if (!fnt) return;
    const rows = w > 0 ? wrapText(fnt, String(str ?? ''), w) : [String(str ?? '')];
    rows.forEach((row, i) => paintFnt(ictx, fnt, row, x, y + i * fnt.fixedHeight, { color, align: w > 0 ? 'center' : 'left', w }));
  };
}

function fit(defaultFont) {
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
  const W = globalThis.innerWidth || 1, H = globalThis.innerHeight || 1;
  uik = uiScale(W, H, dpr);
  const w = Math.max(1, Math.floor(W * dpr / uik)), h = Math.max(1, Math.floor(H * dpr / uik));
  if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
  uiW = w; uiH = h;
  const { pw, ph } = leafSize(uiW, uiH);
  const key = `${pw}x${ph}#${bookFontsVersion()}#${defaultFont?.fnt?.fixedHeight ?? 0}`;
  if (key === layoutKey) return;
  layoutKey = key;
  resizeBook(book, pw, ph);
  book.pages = cutPages(defaultFont);
  BOOK.inscribe = inscribe(defaultFont);
}

/** A turn, Raum's way: a mid-flight tap snaps the flip and chains. */
function turn(dir) {
  if (!book || closing) return;
  finishFlip(book);
  if (flipBook(book, dir, now())) audio.playOneShot(SOUND.PageTurn, 1);   // ScrollBook's page-turn, per leaf
}

/** The exit: the model's ButtonClick and done (the classic's own
 *  input arm), then the cover shuts and the book sinks - the frame
 *  that sees it land calls onExit. The relock rides THIS gesture. */
function exit() {
  if (!book || closing) return;
  closing = true;
  if (!model.done) model.input('Escape');
  relock();
  closeBook(book, now());
}

export function bookKey(code) {
  if (code === 'Escape' || code === 'Enter' || code === 'KeyE') { exit(); return true; }
  if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyN' || code === 'PageDown' || code === 'Space') { turn(+1); return true; }
  if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyP' || code === 'PageUp') { turn(-1); return true; }
  return false;
}

function onPointer(e) {
  if (!book) return;
  e.preventDefault();
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
  const hit = bookHit(book, uiW, uiH, e.clientX * dpr / uik, e.clientY * dpr / uik);
  if (hit === 'outside') { exit(); return; }
  if (hit && typeof hit === 'object') turn(hit.side ? +1 : -1);   // TAP ANYWHERE FLIPS (Raum): left back, right forward
}
function onWheel(e) { e.preventDefault(); if (e.deltaY) turn(Math.sign(e.deltaY)); }

/**
 * Mount the book on `canvasEl` (the door's overlay canvas). `d.model`
 * is the classic BookReaderWindow; `d.onExit` runs when the closed
 * book has left the screen; `d.relock` is the host's pointer-lock
 * request, run inside the closing gesture (MAC1). Returns the frame
 * arm the door's draw() calls with the host's default font.
 */
export function mountEnhancedBook(canvasEl, d = {}) {
  el = canvasEl;
  ctx = el.getContext('2d');
  model = d.model;
  onExit = d.onExit ?? (() => {});
  relock = d.relock ?? (() => {});
  closing = false;
  layoutKey = '';
  BOOK.cover = { title: model.book?.title || 'A Book', subtitle: model.book?.author ? `by ${model.book.author}` : '' };
  book = createBook([]);
  listeners = [['pointerdown', onPointer], ['wheel', onWheel], ['contextmenu', (e) => e.preventDefault()]];
  for (const [type, fn] of listeners) el.addEventListener(type, fn, { passive: false });
  return {
    /** Per frame: size to the view, cut the pages when the fonts or
     *  the leaf changed, paint; the first frame opens the cover. */
    frame(defaultFont) {
      if (!el || !ctx) return;
      fit(defaultFont);
      if (book.phase === 'closed' && !book.open && !closing) openBook(book, now());
      ctx.clearRect(0, 0, uiW, uiH);
      ctx.imageSmoothingEnabled = false;
      paintBook(ctx, book, uiW, uiH, null, now());
      if (closing && book.phase === 'closed') { const done = onExit; onExit = () => {}; done(); }
    },
    key: bookKey,
    spreads: () => (book ? spreadCount(book.pages) : 0),
    destroy() {
      for (const [type, fn] of listeners) el?.removeEventListener(type, fn);
      listeners = [];
      BOOK.inscribe = null;
      el = null; ctx = null; model = null; book = null; onExit = () => {}; relock = () => {};
    },
  };
}
