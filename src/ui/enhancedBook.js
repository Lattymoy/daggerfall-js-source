// EB1 - THE ENHANCED BOOK (2026-09-12).
//
// Mac: "For the book reader, I was wondering if we could use the
// animated book in my repo project-raum." Then: "Do it." Then, of
// the first cut: "This is beautiful. Can we use a more legible text?"
//
// So a Daggerfall book is READ IN A BOOK: project-raum's physical
// journal (vendor/raum-book/, Mac's own - a leather cover that flips
// open, two-page spreads, leaves that turn as a cloth fold about the
// spine, the fore-edge stack, the slide up from below the screen),
// with Daggerfall's words on its pages. The world stays standing
// behind it: Raum's rule ("only the book, not the entire screen") is
// the talk panel's rule too.
//
// ── PAINT AND BONES (PX23), AGAIN ────────────────────────────────
//
// This face owns no reading law. The classic BookReaderWindow
// (ui/bookReader.js) is the model under both faces: its constructor
// plays OpenBook, its `lines` are LocalizedBook's converted rows
// (one row per text token, sticky centring and FontPrefix, the empty
// line's reset - AUDIT B-P1, 26 F150, 24 ui), `placeBookLabels` is
// LayoutBookLabels (a wrapping label per row, its height its own
// face's rows), and its input() is the exit's ButtonClick. What this
// face adds is the one thing a two-page book needs that a scroll does
// not: PAGINATION. The placed label stream is cut into leaves by ROW
// - a row never straddles a leaf - which is a typesetter's cut over
// DFU's own layout, not a second layout. The page-turn plays per leaf
// turned, as DFU plays it per centre-page crossed.
//
// ── THE TYPE (EB2, Mac: "a more legible text") ───────────────────
//
// The first cut set the pages in Daggerfall's FNT faces, 7-pixel
// bitmaps scaled up, which were the least legible thing on the
// screen. The pages are set in the enhanced skin's own serif now -
// the display face the menus already load (Cormorant, with the
// system serif behind it) - anti-aliased at DEVICE resolution, in a
// size taken from the leaf so a page carries about twenty-seven
// lines whatever the screen. FontPrefix still switches the face:
// DFU's five FNTs become five cuts of the one serif - the small
// pair, the body, the big one and the title cut - so a book that
// sets its title in FONT0004 sets it large here too. The book
// itself keeps its pixels: the paper, the board and the stack are
// drawn at Raum's pixel size and blitted up (BOOK.paperScale), the
// type is drawn over them full-size.
//
// A canvas face wears FntFile's SHAPE - fixedHeight, fixedWidth and
// glyphWidth(index) - measured from the browser, so the classic's
// own measureText and wrapText lay the rows out unchanged and the
// wrap law stays the classic's (a word is measured as its glyph
// advances plus the spacing; kerning is not, which is DFU's law).
//
// ── THE SIZE ─────────────────────────────────────────────────────
//
// The book paints on a canvas the size of the view in device pixels.
// The leaf is sized off the view's HEIGHT - a book is tall - and
// capped by half the width; the text wraps to the leaf. A portrait
// phone gets a narrow leaf, as it gets a small classic page: the
// two-page spread is the book's shape and turning the phone is the
// answer.

import {
  BOOK, createBook, resizeBook, paintBook, openBook, closeBook, flipBook, finishFlip, bookHit, spreadCount,
} from '../../vendor/raum-book/book.js';
import { PAPER } from '../../vendor/raum-book/paper.js';
import { placeBookLabels } from './bookReader.js';
import { injectEnhancedFonts } from './enhancedStyle.js';
import { wrapText } from './talkWindow.js';
import { FNT_ASCII_START } from '../formats/fntFile.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** The page's ink: Raum's journal ink, on Raum's parchment. */
export const INK = css(PAPER.ink);
/** The leaf's text inset - Raum's own (book.js pageCanvas: x 8/12, y 10,
 *  w pageW-20, h pageH-24) - in device pixels now, so the face adds a
 *  margin of its own on top (`margin` below). */
export const LEAF_INSET = Object.freeze({ x: 8, y: 10, w: 20, h: 24 });

/** The serif the pages are set in: the enhanced skin's display face
 *  (enhancedStyle.js FONT_DISPLAY), the system serifs behind it. */
export const BOOK_FAMILY = "Cormorant, 'Cormorant Garamond', Georgia, 'Times New Roman', serif";

/** FontPrefix's five faces (DaggerfallFont.FontName, bookReader.js
 *  BOOK_FONT_NAMES: x 1..5 = FONT0000..FONT0004; 0 = no prefix, the
 *  default) as CUTS of the one serif: a scale on the body size and a
 *  weight. FONT0003 is DaggerfallUI.DefaultFont; FONT0004 is the
 *  large face a title page sets. */
export const FACE_OF_PREFIX = Object.freeze({
  0: { scale: 1, weight: 400 },      // no prefix: the default face
  1: { scale: 0.9, weight: 400 },    // FONT0000
  2: { scale: 0.9, weight: 400 },    // FONT0001
  3: { scale: 1.15, weight: 600 },   // FONT0002
  4: { scale: 1, weight: 400 },      // FONT0003, the default
  5: { scale: 1.4, weight: 600 },    // FONT0004, the title
});

/** The body size, from the leaf: about twenty-seven lines a page, and
 *  never under thirteen CSS pixels on a phone. */
export const bodySize = (pageH, dpr = 1) => Math.max(12, Math.min(64, Math.max(Math.round(pageH / 27 / 1.3), Math.round(13 * dpr))));

// ── canvas faces, in FntFile's shape ──────────────────────────────
let _measure = null;   // an offscreen 2D context for measuring
const measurer = () => {
  if (!_measure) _measure = document.createElement('canvas').getContext('2d');
  return _measure;
};

/**
 * A face the classic's measureText and wrapText can lay out, in the
 * shape makeFont hands the classic window - `{ fnt }` - where the fnt
 * wears FntFile's: `fixedHeight` the line height, `fixedWidth` the
 * space plus one (spaceGlyphWidth is fixedWidth - 1), and
 * `glyphWidth(index)` the browser's advance for the glyph at
 * FNT_ASCII_START + index, less the one-pixel spacing the measure
 * adds back - so a word measures as it will draw. `fnt.font` is the
 * CSS font the row is drawn with.
 */
export function canvasFace(px, weight = 400, family = BOOK_FAMILY) {
  const font = `${weight} ${px}px ${family}`;
  const cache = new Map();
  const m = measurer();
  const advance = (ch) => { m.font = font; return m.measureText(ch).width; };
  const space = Math.max(1, Math.round(advance(' ')));
  const fnt = {
    canvas: true,
    font,
    px,
    fixedHeight: Math.round(px * 1.3),
    fixedWidth: space + 1,
    glyphWidth(index) {
      let w = cache.get(index);
      if (w === undefined) { w = Math.max(0, Math.round(advance(String.fromCharCode(FNT_ASCII_START + index))) - 1); cache.set(index, w); }
      return w;
    },
    getGlyphPixels() { return null; },
  };
  return { fnt };
}

/** A row of type on a page: the face's font, the ink, top-aligned at
 *  (x, y); `w` with align 'center' centres it in that width. */
export function paintRow(ctx, face, text, x, y, { color = INK, align = 'left', w = 0 } = {}) {
  const fnt = face?.fnt ?? face;
  if (!fnt?.font || !text) return;
  ctx.font = fnt.font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const dx = align === 'center' ? x + Math.max(0, (w - ctx.measureText(text).width) / 2) : x;
  ctx.fillText(text, Math.round(dx), Math.round(y));
}

// ── pagination (pure, tested) ─────────────────────────────────────
/**
 * Cut the placed label stream (placeBookLabels' output) into leaves of
 * `pageH` pixels, BY ROW: every wrapped row keeps its label's face,
 * centring and height, and a row that would cross the leaf's foot
 * opens the next leaf instead. A leaf never opens on a blank row (the
 * typesetter's rule; DFU's scroll has no leaves to open), and a book
 * with no rows is one blank leaf. Returns
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

/** The PAPER scale: device pixels per Raum pixel - an integer, from
 *  the view's short edge, so the paper's grain and tears stay chunky
 *  on a phone and a desktop alike. */
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
let uiW = 0, uiH = 0, dpr = 1;
let layoutKey = '';   // what the pages were cut against: leaf size and the fonts' arrival
let fontsReady = false;
let closing = false;
let listeners = [];

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The five cuts for this leaf's body size. */
function facesFor(px) {
  const faces = {};
  for (const [x, cut] of Object.entries(FACE_OF_PREFIX)) faces[x] = canvasFace(Math.round(px * cut.scale), cut.weight);
  return faces;
}

/** The book's pages, cut fresh from the model's layout law over THIS
 *  leaf's width and height. Each page paints its rows inside Raum's
 *  own inset plus a margin of the type's own size. */
function cutPages(px, faces) {
  const margin = Math.round(px * 0.9);
  const wrapW = BOOK.pageW - LEAF_INSET.w - margin * 2;
  const { placed } = placeBookLabels(model.lines, (x) => faces[x] ?? faces[0], wrapW);
  const pages = paginateBook(placed, BOOK.pageH - LEAF_INSET.h - margin);
  return pages.map((rows) => ({
    paint(pctx, x, y, w) {
      for (const row of rows) {
        paintRow(pctx, row.face ?? faces[0], row.text, x + margin, y + Math.round(margin / 2) + row.y, { align: row.center ? 'center' : 'left', w: w - margin * 2 });
      }
    },
  }));
}

/** Raum's inscription seam (vendor/raum-book/book.js drawJournal), in
 *  this port's faces: the cover's title in the title cut, everything
 *  else in the body; a `w` wraps the words to it and centres them. */
function inscribe(faces) {
  return (ictx, str, x, y, { face, color = INK, w = 0 } = {}) => {
    // the cover's words wrap to `w`; a bare call is a page number or
    // BLANK, set small at Raum's corner (its y is a 7-pixel hand's row,
    // so the small cut is lifted to sit inside the leaf)
    if (!(w > 0)) { const sm = faces[1]; paintRow(ictx, sm, String(str ?? ''), x, y - sm.fnt.fixedHeight + 8, { color }); return; }
    const f = face === 'title' ? faces[5] : faces[0];
    const rows = wrapText(f.fnt, String(str ?? ''), w);
    rows.forEach((row, i) => paintRow(ictx, f, row, x, y + i * f.fnt.fixedHeight, { color, align: 'center', w }));
  };
}

function fit() {
  dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
  const W = globalThis.innerWidth || 1, H = globalThis.innerHeight || 1;
  const w = Math.max(1, Math.floor(W * dpr)), h = Math.max(1, Math.floor(H * dpr));
  if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
  uiW = w; uiH = h;
  BOOK.paperScale = uiScale(W, H, dpr);
  const { pw, ph } = leafSize(uiW, uiH);
  const key = `${pw}x${ph}#${fontsReady ? 1 : 0}`;
  if (key === layoutKey) return;
  layoutKey = key;
  resizeBook(book, pw, ph);
  const px = bodySize(ph, dpr);
  const faces = facesFor(px);
  book.pages = cutPages(px, faces);
  BOOK.inscribe = inscribe(faces);
  book.cache.clear();
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
  const hit = bookHit(book, uiW, uiH, e.clientX * dpr, e.clientY * dpr);
  if (hit === 'outside') { exit(); return; }
  if (hit && typeof hit === 'object') turn(hit.side ? +1 : -1);   // TAP ANYWHERE FLIPS (Raum): left back, right forward
}
function onWheel(e) { e.preventDefault(); if (e.deltaY) turn(Math.sign(e.deltaY)); }

/**
 * Mount the book on `canvasEl` (the door's overlay canvas). `d.model`
 * is the classic BookReaderWindow; `d.onExit` runs when the closed
 * book has left the screen; `d.relock` is the host's pointer-lock
 * request, run inside the closing gesture (MAC1). Returns the frame
 * arm the door's draw() calls.
 */
export function mountEnhancedBook(canvasEl, d = {}) {
  injectEnhancedFonts();
  el = canvasEl;
  ctx = el.getContext('2d');
  model = d.model;
  onExit = d.onExit ?? (() => {});
  relock = d.relock ?? (() => {});
  closing = false;
  layoutKey = '';
  fontsReady = false;
  // the serif arrives async (the skin's one web-font request); the
  // pages are cut again when it lands, since the measures change
  const fonts = globalThis.document?.fonts;
  if (fonts?.load) {
    Promise.all([fonts.load(`400 20px ${BOOK_FAMILY}`), fonts.load(`600 20px ${BOOK_FAMILY}`)])
      .then(() => { fontsReady = true; layoutKey = ''; }, () => { fontsReady = true; layoutKey = ''; });
  } else fontsReady = true;
  BOOK.cover = { title: model.book?.title || 'A Book', subtitle: model.book?.author ? `by ${model.book.author}` : '' };
  book = createBook([]);
  listeners = [['pointerdown', onPointer], ['wheel', onWheel], ['contextmenu', (e) => e.preventDefault()]];
  for (const [type, fn] of listeners) el.addEventListener(type, fn, { passive: false });
  return {
    /** Per frame: size to the view, cut the pages when the leaf or
     *  the fonts changed, paint; the first frame opens the cover. */
    frame() {
      if (!el || !ctx) return;
      fit();
      if (book.phase === 'closed' && !book.open && !closing) openBook(book, now());
      ctx.clearRect(0, 0, uiW, uiH);
      paintBook(ctx, book, uiW, uiH, null, now());
      if (closing && book.phase === 'closed') { const done = onExit; onExit = () => {}; done(); }
    },
    key: bookKey,
    spreads: () => (book ? spreadCount(book.pages) : 0),
    destroy() {
      for (const [type, fn] of listeners) el?.removeEventListener(type, fn);
      listeners = [];
      BOOK.inscribe = null;
      BOOK.paperScale = 1;
      el = null; ctx = null; model = null; book = null; onExit = () => {}; relock = () => {};
    },
  };
}
