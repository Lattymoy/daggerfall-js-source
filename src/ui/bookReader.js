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
// INTERIM, loud: lines draw in the host font at a fixed 10px row -
// DFU measures per-label heights and honors FontPrefix switches; the
// port's font set has one book face today. A row not fully inside
// the panel is clipped WHOLE (the question-scroll interim, same row).

import { loadImg, nativeMetrics, drawImg, shadowText } from './nativePanel.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { drawText, measureText } from './text.js';
import { RSC, TOKEN_TEXT } from '../formats/textRsc.js';
import { BookFile } from '../formats/bookFile.js';
import { getBookFileName } from '../systems/books.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

export const BOOK_RECTS = Object.freeze({
  nextPage: [208, 188, 14, 8],
  previousPage: [181, 188, 14, 48],   // DFU's verbatim odd height
  exit: [277, 187, 32, 10],
});
export const PAGE_PANEL = Object.freeze({ x: 10, y: 21, w: 300, h: 159 });   // classic geometry
export const SCROLL_AMOUNT = 24;
const ROW_H = 10;   // interim fixed row (see header)

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

let _art = null;
export async function preloadBookArt(deps) {
  if (_art) return;
  try { _art = await loadImg(deps, 'BOOK00I0.IMG'); }
  catch { console.warn('[book] BOOK00I0.IMG unavailable; the text fallback stands in'); }
}
export const bookArtLoaded = () => !!_art;

/** Token stream -> layout lines, LocalizedBook.ConvertTokensToString +
 *  CreateBookLabels' law (AUDIT B-P1, which corrected this):
 *   - a LINE is closed by NewLine alone: ConvertTokensToString writes
 *     '\n' for NewLine and nothing else breaks the string, and
 *     CreateBookLabels splits Content on '\n' (:218).
 *   - a LINE IS NOT A ROW. Every Text token in a line becomes its OWN
 *     word-wrapping label (the switch's default arm, :253-254) and
 *     LayoutBookLabels stacks them one under the other (y +=
 *     label.Size.y, :326). Adjacent Text tokens are merged back into
 *     one token by the string round trip - ConvertStringToRSCTokens
 *     only cuts a text run where MARKUP appears
 *     (DaggerfallStringTableImporter.cs:183-210) - so a row is a RUN
 *     of Text tokens uninterrupted by a justify or font token, and a
 *     justify token mid-line starts a new row.
 *   - alignment and font are STICKY state (:210-211) applied to the
 *     labels created AFTER the token sets them (:240-245, :253-254):
 *     a justify token at the END of a line centres the NEXT row, not
 *     the row it closes, and the stickiness holds across newlines.
 *   - PAGES CONCATENATE: DFU appends every page's converted text into
 *     one Content string, so a page not ending in NewLine merges with
 *     the next page's first line rather than closing a row.
 *   - PositionPrefix and SameLineOffset are "Unused" in DFU's own
 *     converter (LocalizedBook.cs:305-310) - they put NOTHING in the
 *     string, so they neither split a text run nor keep a line from
 *     counting as empty.
 *   - FontPrefix is sticky font state in DFU (currentFont); the port
 *     has one book face, so it is recorded and not yet applied (the
 *     loud interim in this file's header). */
export function layoutBookLines(bookFile) {
  const lines = [];
  let alignCenter = false, font = 0;
  let row = null;         // the label being accumulated, or none
  let lineTokens = 0;     // tokens this line put IN the string
  // A row closes when the state that made it changes, and at the end
  // of its line - each label is created with the state standing when
  // its first Text token arrived.
  const closeRow = () => { if (row) { lines.push(row); row = null; } };
  // AUDIT 24 ui: an empty line - one that converted to no tokens at
  // all (DaggerfallStringTableImporter.cs:180-181) - adds a Left,
  // DEFAULT-FONT empty label and then resets alignment, colour and
  // scale; DFU's own comment says so (:221-228). currentFont is NOT
  // reset. Without the reset a centred heading followed by a blank
  // line centred the whole rest of the book.
  const endLine = () => {
    closeRow();
    if (lineTokens === 0) {
      lines.push({ text: '', center: false, font: 0 });
      alignCenter = false;
    }
    lineTokens = 0;
  };
  for (let page = 0; page < bookFile.pageCount; page++) {
    for (const token of bookFile.getPageTokens(page) ?? []) {
      if (token.formatting === RSC.NewLine) {
        endLine();
      } else if (token.formatting === TOKEN_TEXT) {
        lineTokens++;
        if (!row) row = { text: '', center: alignCenter, font };
        row.text += token.text;
      } else if (token.formatting === RSC.JustifyCenter) {
        lineTokens++;
        closeRow();
        alignCenter = true;
      } else if (token.formatting === RSC.JustifyLeft) {
        lineTokens++;
        closeRow();
        alignCenter = false;
      } else if (token.formatting === RSC.FontPrefix) {
        lineTokens++;
        closeRow();
        font = token.x ?? 0;
      }
      // PositionPrefix / SameLineOffset: unused for books (DFU) - they
      // are not counted, because they write nothing into the string
    }
  }
  // The trailing partial line closes the book (DFU's final split entry)
  closeRow();
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
    this.maxHeight = this.lines.length * ROW_H;
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

  draw(renderer, canvas, font, s) {
    if (!_art) return this._drawFallback(renderer, canvas, font, s);
    const m = nativeMetrics(canvas);
    drawMenuBackdrop(renderer, canvas);
    drawImg(renderer, _art, m, 0, 0);
    const top = PAGE_PANEL.y, bottom = PAGE_PANEL.y + PAGE_PANEL.h;
    for (let i = 0; i < this.lines.length; i++) {
      const y = top + this.scrollPosition + i * ROW_H;
      if (y < top || y + ROW_H > bottom) continue;   // whole-row clip (interim)
      const line = this.lines[i];
      if (!line.text) continue;
      if (line.center) {
        shadowText(renderer, font, line.text, m, PAGE_PANEL.x, y, { align: 'center', w: PAGE_PANEL.w });
      } else {
        shadowText(renderer, font, line.text, m, PAGE_PANEL.x, y);
      }
    }
  }

  _drawFallback(renderer, canvas, font, s) {
    const W = canvas.width, H = canvas.height;
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: W, h: H }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const white = [0.9, 0.9, 0.85, 1];
    const start = Math.max(0, Math.trunc(-this.scrollPosition / ROW_H));
    this.lines.slice(start, start + 16).forEach((line, i) => {
      const t = line.text || ' ';
      const x = line.center ? (W - measureText(font.fnt, t) * s) / 2 : 20 * s;
      drawText(renderer, font, t, x, (16 + i * 10) * s, s, white);
    });
  }
}
