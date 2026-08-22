// U32: THE HISTORY WINDOW - DaggerfallPlayerHistoryWindow, verbatim.
//
// The character sheet's HISTORY button (charsheet.js) had no window to
// open, so it consumed the click and did nothing. This is that window.
//
// It reads playerEntity.backStory, which chargen has been composing
// since U13 and save.js has been round-tripping since - the data was
// prepared for this screen and had nowhere to go. chargenSession.js:170
// names DaggerfallPlayerHistoryWindow in its own comment.
//
// The art is LGBK00I0.IMG - the LOGBOOK background, shared with the
// quest journal. That is DFU's own choice (:26), not a stand-in: in
// classic your history and your log are the same book.
import { loadImg, nativeMetrics, drawImg, shadowText } from './nativePanel.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

let _art = null;
export async function preloadPlayerHistoryArt(deps) {
  if (_art) return;
  try { _art = await loadImg(deps, 'LGBK00I0.IMG'); }
  catch { console.warn('[history] LGBK00I0.IMG unavailable; the history window falls back to text'); }
}
export const playerHistoryArtLoaded = () => !!_art;

// DaggerfallPlayerHistoryWindow.cs:27-28
const EXTRA_LEADING = 0;
const MAX_PAGE_LINES = 21;
// The prose block's origin (:149 `int x = 20, y = 25;`)
const TEXT_X = 20;
const TEXT_Y = 25;

/** The window's Buttons (:59-71), verbatim.
 *
 *  prevPage really is 14x48 in DFU - a 48-tall rect starting at y 188
 *  runs 36px past the 200-tall panel. It is almost certainly a typo for
 *  8, but it is DFU's typo and it changes nothing a player can see: the
 *  panel clips it, so the reachable area is the same 12px strip. Ported
 *  as written rather than silently corrected. */
export const HISTORY_RECTS = Object.freeze({
  nextPage: [208, 188, 14, 8],
  prevPage: [181, 188, 14, 48],
  exit: [277, 187, 32, 10],
});
const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

export class PlayerHistoryWindow {
  constructor(entity) {
    this.entity = entity;
    this.done = false;
    this.pageStartLine = 0;
    this.isChoiceWindow = true;   // raw codes through the overlay seam, like CharSheet
    audio.playOneShot(SOUND.OpenBook, 1);   // Setup()/OnPush both play it (:74, :140)
  }

  get lines() { return this.entity?.backStory ?? []; }

  /** MoveNextPage (:183-192). Paging is by WHOLE pages, and the last
   *  page will not advance - there is no wrap. */
  nextPage(sound = true) {
    if (this.pageStartLine + MAX_PAGE_LINES < this.lines.length) {
      this.pageStartLine += MAX_PAGE_LINES;
      if (sound) audio.playOneShot(SOUND.OpenBook, 1);
      return true;
    }
    return false;
  }

  /** MovePreviousPage (:194-203). */
  prevPage(sound = true) {
    if (this.pageStartLine !== 0) {
      this.pageStartLine -= MAX_PAGE_LINES;
      if (sound) audio.playOneShot(SOUND.OpenBook, 1);
      return true;
    }
    return false;
  }

  /** Exit resets to the first page BEFORE closing (:127, :130) - reopen
   *  the book and it opens at the beginning, not where you left off. */
  close() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.pageStartLine = 0;
    this.done = true;
  }

  input(action, e = null) {
    const code = e?.code ?? action;
    if (action === 'confirm' || action === 'back' || action === 'Escape' || action === 'Enter'
      || code === 'Escape' || code === 'Enter') { this.close(); return true; }
    // The scroll wheel pages too (:103-119), and so do the arrows -
    // the port's overlay seam has no wheel of its own for this window.
    if (action === 'ArrowRight' || action === 'ArrowDown' || code === 'ArrowRight' || code === 'ArrowDown') return this.nextPage();
    if (action === 'ArrowLeft' || action === 'ArrowUp' || code === 'ArrowLeft' || code === 'ArrowUp') return this.prevPage();
    return false;
  }

  // AUDIT 24 ui: the OpenBook one-shot belongs to the two BUTTON
  // handlers (:83, :92); NativePanel_OnMouseScrollDown/Up (:97-111)
  // just page and re-layout, silently.
  wheel(dy) { return dy > 0 ? this.nextPage(false) : this.prevPage(false); }

  /** Every DFU button rect is answered or consumed, so a click can
   *  never fall through to the host's pointer-lock request - the same
   *  law AUDIT 18 established for the character sheet. */
  click(vx, vy) {
    const R = HISTORY_RECTS;
    if (inRect(R.exit, vx, vy)) { this.close(); return true; }
    if (inRect(R.nextPage, vx, vy)) { this.nextPage(); return true; }
    if (inRect(R.prevPage, vx, vy)) { this.prevPage(); return true; }
    return false;
  }

  /** LayoutPage (:144-167): the page's lines from pageStartLine, at
   *  most MAX_PAGE_LINES of them, each one glyph-height lower. */
  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    // The parent panel is BLACK behind the 320x200 page - the shared
    // helper, for the same reason every other native window uses it.
    drawMenuBackdrop(renderer, canvas);
    if (_art) drawImg(renderer, _art, m, 0, 0);
    const rowH = font.fnt.fixedHeight + EXTRA_LEADING;
    const lines = this.lines;
    let y = TEXT_Y;
    for (let i = this.pageStartLine; i < lines.length; i++) {
      shadowText(renderer, font, String(lines[i] ?? ''), m, TEXT_X, y);
      if (i - this.pageStartLine + 1 === MAX_PAGE_LINES) break;
      y += rowH;
    }
    // A character made before biographies existed, or one whose
    // backstory failed to compose, gets a sentence rather than a blank
    // book. NEVER TRAPS: the exit button is drawn by the art and still
    // answers, so there is always a way out.
    if (!lines.length) shadowText(renderer, font, 'No history has been recorded.', m, TEXT_X, TEXT_Y);
    return true;
  }
}
