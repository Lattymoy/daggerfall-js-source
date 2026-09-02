// THE BOOK READER WINDOW (B1) - DaggerfallBookReaderWindow's CHROME
// and scroll law on the port's native-window idiom, over the CLASSIC
// book path. Naming the two halves honestly (AUDIT B-P1): DFU's
// window lays out LocalizedBook.Content, a markup STRING; for a
// classic BOK file that string comes from
// LocalizedBook.OpenClassicBookFile -> ConvertTokensToString over
// BookFile.GetPageTokens, which is the path this port takes directly.
// So the layout law ported here is ConvertTokensToString +
// CreateBookLabels (see layoutBookLines), not the localized
// string-table branch the port has no counterpart for.
//
// BOOK00I0.IMG background; the verbatim
// button rects - next page (208,188,14,8), previous (181,188,14,48 -
// the odd 48-height is DFU's own quirk, kept), exit (277,187,32,10
// with ButtonClick); the page panel at (10,21) 300x159 (the CLASSIC
// geometry - the SDF variant is a DFU-modern rendering mode the port
// does not have); the whole book lays out as ONE continuous scroll
// and the 159-high page height exists for the PAGE-TURN sound, which
// plays when the scroll's centre page changes (ScrollBook). Scroll
// steps are 24 (scrollAmount), reached by the buttons, the hosts'
// wheel seam, and the keyed arms (up/down - the port's keyboard
// convention for every native window; DFU's reader is mouse-only).
// OpenBook plays SoundClips.OpenBook, as DFU's Setup/OnPush do.
//
// ROAD-D D10 closed this file's interim, both halves of it.
//
// THE ROWS ARE MEASURED. Every label CreateBookLabels makes is a
// WRAPPING label (WrapText/WrapWords, MaxWidth = the page panel's
// 300 - DaggerfallBookReaderWindow.cs:259-271, :318-320), and
// LayoutBookLabels stacks them with `y += label.Size.y` (:317-328)
// where TextLabel's own Size.y is `rows.Count * font.GlyphHeight`
// (TextLabel.cs:708, :789). So a token that wraps to three rows
// advances three glyph heights and a token in a taller font advances
// by ITS height - which the old fixed 10px row could not express in
// either direction. maxHeight, and with it ScrollBook's clamp, is
// that same sum (:311, :328).
//
// FONTPREFIX SWITCHES THE FACE. `currentFont = GetFont((FontName)
// token.x - 1)` (:235-237) indexes DaggerfallFont.FontName
// (DaggerfallFont.cs:65-72), so 1 is FONT0000 and 5 is FONT0004; the
// state is sticky until the next prefix or an empty line's reset, and
// the reader starts in DaggerfallUI.DefaultFont (:210), which is the
// font the port's hosts already hand this window. All five FNTs load
// through the host's fetchBytes beside the art, each in its own guard
// - a missing FNT costs that face, never the book.
//
// A PARTIALLY VISIBLE LABEL DRAWS. ScrollBook's own enable test is
// `label.Position.y < pagePanel.Size.y && label.Position.y +
// label.Size.y > 0` (:193-194) - overlap, not containment - and the
// pixel cut comes from RestrictedRenderArea, which is the renderer's
// scissor bracket here (the same one chargenArt.js:1054 uses for the
// question scroll). The old whole-row clip popped the boundary line
// in and out instead of sliding it.

import { loadImg, nativeMetrics, drawImg, shadowText } from './nativePanel.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { drawText, measureText, makeFont } from './text.js';
import { FntFile } from '../formats/fntFile.js';   // ROAD-D D10: FontPrefix's five faces
import { wrapText } from './talkWindow.js';        // ROAD-D D10: TextLabel's word wrap, one home
import { RSC, TOKEN_TEXT } from '../formats/textRsc.js';
import { BookFile } from '../formats/bookFile.js';
import { getBookFileName, loadBookPrices } from '../systems/books.js';   // A2: the book-price warm
import { setBookAuthor } from '../systems/itemInfo.js';   // IM1: the %ba cache
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

export const BOOK_RECTS = Object.freeze({
  nextPage: [208, 188, 14, 8],
  previousPage: [181, 188, 14, 48],   // DFU's verbatim odd height
  exit: [277, 187, 32, 10],
});
export const PAGE_PANEL = Object.freeze({ x: 10, y: 21, w: 300, h: 159 });   // classic geometry
export const SCROLL_AMOUNT = 24;
/** MaxWidth = pagePanel.Size.x (:319) - the width every book label
 *  word-wraps at. */
export const BOOK_WRAP_WIDTH = PAGE_PANEL.w;
/** FontPrefix's `(FontName)token.x - 1` (:236) over
 *  DaggerfallFont.FontName (DaggerfallFont.cs:65-72). Index 0 is "no
 *  prefix seen", which is DaggerfallUI.DefaultFont. */
export const BOOK_FONT_NAMES = Object.freeze(['FONT0000', 'FONT0001', 'FONT0002', 'FONT0003', 'FONT0004']);
export const bookFontName = (x) => BOOK_FONT_NAMES[(x | 0) - 1] ?? null;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

let _art = null;
export async function preloadBookArt(deps) {
  // A2: the boot that warms the reader's art warms the books' PRICES
  // too, and this is the one books boot all three hosts already call.
  // DFU opens the book file inside ItemBuilder.CreateRandomBook - one
  // read per mint - which a synchronous mint over an async data seam
  // cannot do, so the reads happen here and the mint reads a registry
  // (systems/books.js). Fire-and-forget: an unwarmed registry prices
  // books at the template's basePrice and says so, once, loudly.
  loadBookPrices(deps?.fetchBytes).catch(() => {});
  await loadBookFonts(deps);
  if (_art) return;
  try { _art = await loadImg(deps, 'BOOK00I0.IMG'); }
  catch { console.warn('[book] BOOK00I0.IMG unavailable; the text fallback stands in'); }
}
export const bookArtLoaded = () => !!_art;

// ROAD-D D10: the five FNT faces FontPrefix can name. Each is loaded
// in its OWN guard, the chargenArt.js:409 shape - a missing FNT costs
// that face and falls back to the host's font, never the book. The
// version counter is what tells a window laid out before the fonts
// landed to measure itself again.
const _fonts = new Map();
let _fontsVersion = 0;
export const bookFont = (x) => _fonts.get(bookFontName(x)) ?? null;
export const bookFontsVersion = () => _fontsVersion;
export async function loadBookFonts(deps) {
  if (!deps?.fetchBytes || !deps?.renderer) return;
  for (const name of BOOK_FONT_NAMES) {
    if (_fonts.has(name)) continue;
    try {
      _fonts.set(name, makeFont(deps.renderer, new FntFile().load(await deps.fetchBytes(`${name}.FNT`)), name));
      _fontsVersion++;
    } catch (e) { console.warn(`[book] ${name}.FNT unavailable; that FontPrefix falls back to the host font`, e?.message ?? e); }
  }
}

/** LayoutBookLabels (:307-330), pure. Each layout line becomes one
 *  WRAPPING label: its rows are wrapText at MaxWidth, its height is
 *  `rows.length * GlyphHeight` in ITS OWN face (TextLabel.cs:708),
 *  and the next label starts where it ends. An empty line still
 *  measures one row, because CreateNewTextLayout always pushes a
 *  final row even for no glyphs (TextLabel.cs:701-704). */
export function placeBookLabels(lines, fontFor, maxWidth = BOOK_WRAP_WIDTH) {
  const placed = [];
  let y = 0;
  for (const line of lines) {
    const face = fontFor(line.font);
    const rowH = face?.fnt?.fixedHeight ?? 0;
    const rows = line.text && face ? wrapText(face.fnt, line.text, maxWidth) : [line.text ?? ''];
    const h = rows.length * rowH;
    placed.push({ text: line.text, center: line.center, face, rows, rowH, y, h });
    y += h;
  }
  return { placed, maxHeight: y };
}

/** ScrollBook's enable test (:193-194) - OVERLAP with the panel, not
 *  containment, so the boundary label draws and the scissor cuts it. */
export const bookLabelVisible = (posY, h, panelH = PAGE_PANEL.h) => posY < panelH && posY + h > 0;

/** Token stream -> layout lines, LocalizedBook.ConvertTokensToString +
 *  CreateBookLabels' law (AUDIT B-P1, which corrected this):
 *   - EVERY non-formatting token is its own ROW (AUDIT 26 F150 - a
 *     label each, stacked by LayoutBookLabels). Justify tokens emit
 *     no row of their own; they set STICKY alignment that holds until
 *     the next justify token, so a centred passage stays centred
 *     across lines - but it applies only to the tokens that FOLLOW
 *     it, never to text already emitted.
 *   - PAGES CONCATENATE: DFU appends every page's converted text into
 *     one Content string, so a page not ending in NewLine merges with
 *     the next page's first line rather than closing a row.
 *   - PositionPrefix and SameLineOffset are "Unused" for books in
 *     DFU's own converter - dropped here too, bug-for-bug.
 *   - FontPrefix is sticky font state in DFU (currentFont, :235-237)
 *     and ROAD-D D10 applies it: `font` here is the token's raw x,
 *     which bookFontName maps onto DaggerfallFont.FontName. */
export function layoutBookLines(bookFile) {
  const lines = [];
  let alignCenter = false, font = 0, lineTokens = 0;
  // AUDIT 24 ui: the stickiness holds only until an EMPTY LINE.
  // CreateBookLabels splits Content on '\n' and runs
  // ConvertStringToRSCTokens per line; an empty string converts to null
  // (DaggerfallStringTableImporter.cs:180-181), and that arm adds a
  // Left-aligned empty label and then resets alignment, colour and
  // scale - DFU's own comment says so
  // (DaggerfallBookReaderWindow.cs:221-228). A line that produced NO
  // tokens at all is that line; one carrying only a justify token is
  // not. Without the reset a centred heading followed by a blank line
  // centred the whole rest of the book.
  // AUDIT 26 F150: ONE ROW PER TEXT TOKEN, with the alignment current
  // at that token. CreateBookLabels' `default:` arm adds a SEPARATE
  // label per non-formatting token (:253), and LayoutBookLabels
  // stacks each one on its own row - `y += label.Size.y` (:317-328).
  // The port concatenated a line's Text tokens into one row and let a
  // JustifyCenter reach BACK over the text already accumulated, so
  // for `Text('A'), 0xFD, Text('B'), NewLine` DFU renders 'A' left and
  // 'B' centred on two rows where the port rendered one centred 'AB'.
  // Classic books that use 0xFD terminators - centred title pages,
  // poems - ran consecutive centred lines together on one over-wide
  // row with the centring shifted a line.
  const endLine = () => {
    if (lineTokens === 0) {
      // The empty line: DFU converts it to null tokens and takes the
      // arm that adds a Left-aligned empty label and THEN resets
      // alignment, colour and scale (:221-228). A line carrying only
      // a justify token is not this line - it converted to tokens.
      lines.push({ text: '', center: false, font: 0 });
      alignCenter = false; font = 0;
    }
    lineTokens = 0;
  };
  for (let page = 0; page < bookFile.pageCount; page++) {
    for (const token of bookFile.getPageTokens(page) ?? []) {
      if (token.formatting !== RSC.NewLine) lineTokens++;
      if (token.formatting === TOKEN_TEXT) {
        lines.push({ text: token.text ?? '', center: alignCenter, font });
      } else if (token.formatting === RSC.NewLine) {
        endLine();
      } else if (token.formatting === RSC.JustifyCenter) {
        alignCenter = true;
      } else if (token.formatting === RSC.JustifyLeft) {
        alignCenter = false;
      } else if (token.formatting === RSC.FontPrefix) {
        font = token.x ?? 0;
      }
      // PositionPrefix / SameLineOffset: unused for books (DFU)
    }
  }
  return lines;
}

/** The hosts' openBook hook (DaggerfallInventoryWindow's book arm:
 *  OpenBook then push the reader; a failed open is the "ruined book"
 *  box, which the CALLER shows via onFail - the inventory owns its
 *  boxes). showReader swaps the host's overlay to the built window. */
export function makeOpenBookHook({ fetchBytes, showReader }) {
  return async (item, onFail) => {
    const name = getBookFileName(item?.message ?? -1);
    if (!name) { onFail?.(); return; }
    try {
      const bookFile = new BookFile();
      bookFile.load(await fetchBytes(name), name);
      // IM1: the file's author line feeds the %ba cache - DFU reads it
      // at info time (BookAuthor :162-183); the port's read is here.
      setBookAuthor(item?.message, bookFile.author);
      showReader(new BookReaderWindow(bookFile));
    } catch (e) {
      console.warn(`[book] ${name} failed to open:`, e?.message ?? e);
      onFail?.();
    }
  };
}

export class BookReaderWindow {
  constructor(bookFile) {
    this.book = bookFile;
    this.lines = layoutBookLines(bookFile);
    // ROAD-D D10: measured at the first draw, because the port's
    // fonts arrive through an async seam where DFU's are ready at
    // Setup. Until then maxHeight is 0, which only makes ScrollBook's
    // down-clamp stricter - the window cannot scroll a book it has
    // not measured, and it measures on the frame it first draws.
    this.placed = [];
    this.maxHeight = 0;
    this._layoutFont = null;
    this._layoutVersion = -1;
    this.scrollPosition = 0;
    this.currentPage = 0;   // page-turn sound only
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam
    audio.playOneShot(SOUND.OpenBook, 1);   // Setup/OnPush (:59, :90)
  }

  /** ScrollBook, clamps verbatim: down stops when the last panel-full
   *  is reached, up stops at zero; the centre-page crossing plays the
   *  page turn. */
  scrollBook(amount) {
    if (amount < 0 && this.scrollPosition - PAGE_PANEL.h - amount < -this.maxHeight) return;
    if (amount > 0 && this.scrollPosition === 0) return;
    this.scrollPosition += amount;
    const centerPage = Math.trunc(this.scrollPosition / PAGE_PANEL.h + 0.5);
    if (this.currentPage !== centerPage) {
      this.currentPage = centerPage;
      audio.playOneShot(SOUND.PageTurn, 1);
    }
  }

  input(code) {
    if (code === 'Escape' || code === 'Enter' || code === 'KeyE') {
      audio.playOneShot(SOUND.ButtonClick, 1);
      this.done = true;
      return;
    }
    if (code === 'ArrowDown' || code === 'KeyN') this.scrollBook(-SCROLL_AMOUNT);
    if (code === 'ArrowUp' || code === 'KeyP') this.scrollBook(SCROLL_AMOUNT);
  }

  wheel(dir) {
    if (dir > 0) this.scrollBook(-SCROLL_AMOUNT);
    else if (dir < 0) this.scrollBook(SCROLL_AMOUNT);
  }

  click(vx, vy) {
    if (inRect(BOOK_RECTS.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this.done = true; return true; }
    if (inRect(BOOK_RECTS.nextPage, vx, vy)) { this.scrollBook(-SCROLL_AMOUNT); return true; }
    if (inRect(BOOK_RECTS.previousPage, vx, vy)) { this.scrollBook(SCROLL_AMOUNT); return true; }
    return true;   // an open window owns the pointer
  }

  /** LayoutBookLabels (:307-330). DFU runs it once, from Setup;
   *  here it re-runs whenever the font set it measured against has
   *  changed - the host's default font, or another FNT landing. */
  layout(defaultFont) {
    if (this._layoutFont === defaultFont && this._layoutVersion === bookFontsVersion()) return this.placed;
    const out = placeBookLabels(this.lines, (x) => bookFont(x) ?? defaultFont);
    this.placed = out.placed;
    this.maxHeight = out.maxHeight;
    this._layoutFont = defaultFont;
    this._layoutVersion = bookFontsVersion();
    return this.placed;
  }

  draw(renderer, canvas, font, s) {
    if (!_art) return this._drawFallback(renderer, canvas, font, s);
    const m = nativeMetrics(canvas);
    drawMenuBackdrop(renderer, canvas);
    drawImg(renderer, _art, m, 0, 0);
    const placed = this.layout(font);
    // RestrictedRenderArea over the page panel (:321-322): the pixel
    // cut, so a boundary label slides out instead of popping.
    renderer.setScreenScissor?.(m.ox + PAGE_PANEL.x * m.s, m.oy + PAGE_PANEL.y * m.s, PAGE_PANEL.w * m.s, PAGE_PANEL.h * m.s);
    try {
      for (const label of placed) {
        const posY = label.y + this.scrollPosition;   // label.Position.y, panel-relative
        if (!bookLabelVisible(posY, label.h)) continue;
        if (!label.text) continue;
        const face = label.face ?? font;
        for (let r = 0; r < label.rows.length; r++) {
          const y = PAGE_PANEL.y + posY + r * label.rowH;
          if (label.center) {
            shadowText(renderer, face, label.rows[r], m, PAGE_PANEL.x, y, { align: 'center', w: PAGE_PANEL.w });
          } else {
            shadowText(renderer, face, label.rows[r], m, PAGE_PANEL.x, y);
          }
        }
      }
    } finally { renderer.clearScreenScissor?.(); }
  }

  _drawFallback(renderer, canvas, font, s) {
    const W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const white = [0.9, 0.9, 0.85, 1];
    const start = Math.max(0, Math.trunc(-this.scrollPosition / 10));   // the art-less panel keeps its own 10px row
    this.lines.slice(start, start + 16).forEach((line, i) => {
      const t = line.text || ' ';
      const x = line.center ? (W - measureText(font.fnt, t) * s) / 2 : 20 * s;
      drawText(renderer, font, t, x, (16 + i * 10) * s, s, white);
    });
  }
}
