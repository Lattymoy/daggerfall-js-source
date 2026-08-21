// U32: THE LOGBOOK - DaggerfallQuestJournalWindow, verbatim.
//
// The character sheet's LOGBOOK button had no window to open. This is
// that window, and every one of its four pages is backed by state the
// port already keeps:
//
//   Active quests  - QuestMachine.getAllQuestLogMessages()
//                    (systems/quest/machine.js:585, already verbatim)
//   Finished quests- PlayerNotebook.getFinishedQuests()
//   Notebook       - PlayerNotebook.getNotes()
//   Messages       - PlayerNotebook.getMessages() (the 50-slot ring)
//
// systems/notebook.js already carries MAX_LINES_QUESTS / MAX_LINES_SMALL
// and cites THIS window's :34-35 for them - the notebook was ported
// against a screen that did not exist yet. It exists now, and imports
// those constants from their one home rather than restating them.
import { loadImg, nativeMetrics, drawImg, shadowText, DEFAULT_TEXT_COLOR } from './nativePanel.js';
import { drawText, measureText } from './text.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { MAX_LINES_QUESTS, MAX_LINES_SMALL } from '../systems/notebook.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

let _art = null;
export async function preloadQuestJournalArt(deps) {
  if (_art) return;
  try { _art = await loadImg(deps, 'LGBK00I0.IMG'); }
  catch { console.warn('[journal] LGBK00I0.IMG unavailable; the logbook falls back to text'); }
}
export const questJournalArtLoaded = () => !!_art;

// :36 - the notebook and message pages draw smaller so more fits.
// drawText takes a float scale, so this is DFU's number, not an
// approximation of it.
const TEXT_SCALE_SMALL = 0.8;

/** The window's Buttons and panels (:113-160), verbatim. */
export const JOURNAL_RECTS = Object.freeze({
  dialog: [32, 187, 68, 10],      // cycles the category
  upArrow: [181, 188, 13, 7],
  downArrow: [209, 188, 13, 7],
  exit: [278, 187, 30, 9],
  title: [30, 22, 238, 16],
  log: [30, 38, 238, 138],
});
const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

/** JournalDisplay (:66-72). The order IS the cycle order (:248-264). */
export const JOURNAL_MODES = Object.freeze(['activeQuests', 'finishedQuests', 'notebook', 'messages']);

/** The page titles. DFU pulls these through TextManager; the port has
 *  no localisation table, so the English literals live here - the same
 *  call the rest of the port's native windows make. */
const TITLES = Object.freeze({
  activeQuests: 'Active quests',
  finishedQuests: 'Finished quests',
  notebook: 'Notebook',
  messages: 'Messages',
});

// TextLabel.ShadowColor = new Color(0f, 0.2f, 0.5f) (:207)
const TITLE_SHADOW = Object.freeze([0, 0.2, 0.5, 1]);

export class QuestJournalWindow {
  /**
   * @param {object} deps
   *   questMessages() - QuestMachine.getAllQuestLogMessages()
   *   notebook()      - the PlayerNotebook
   */
  constructor({ questMessages = () => [], notebook = () => null } = {}) {
    this.deps = { questMessages, notebook };
    this.done = false;
    this.isChoiceWindow = true;
    // OnPush (:190-200): the page resets to the top every open.
    this.mode = 'activeQuests';
    this.currentMessageIndex = 0;
    this.messageCount = 0;
    this.questMessages = questMessages() ?? [];
    audio.playOneShot(SOUND.OpenBook, 1);
  }

  /** The entries backing the current page, each a token[]. */
  entries() {
    const nb = this.deps.notebook();
    if (this.mode === 'activeQuests') return this.questMessages.map((m) => this._tokensOf(m));
    if (this.mode === 'finishedQuests') return nb?.getFinishedQuests() ?? [];
    if (this.mode === 'notebook') return nb?.getNotes() ?? [];
    return nb?.getMessages() ?? [];
  }

  /** A quest Message resolves to its tokens; the notebook already
   *  stores tokens. Both arrive here as token[]. */
  _tokensOf(message) {
    if (Array.isArray(message)) return message;
    const t = message?.getTextTokens?.();
    return Array.isArray(t) ? t : [];
  }

  get maxLines() { return (this.mode === 'activeQuests' || this.mode === 'finishedQuests') ? MAX_LINES_QUESTS : MAX_LINES_SMALL; }
  get textScale() { return (this.mode === 'activeQuests' || this.mode === 'finishedQuests') ? 1 : TEXT_SCALE_SMALL; }

  /** DialogButton_OnMouseClick (:248-269): cycle, and reset the page. */
  nextCategory() {
    const i = JOURNAL_MODES.indexOf(this.mode);
    this.mode = JOURNAL_MODES[(i + 1) % JOURNAL_MODES.length];
    this.currentMessageIndex = 0;
    audio.playOneShot(SOUND.OpenBook, 1);
    return true;
  }

  /** The arrows step by ONE ENTRY, not one page (:271-283) - a subtle
   *  thing to get wrong, and the reason this does not look like the
   *  history window's paging. Neither end wraps. */
  scrollUp(sound = true) {
    if (sound) audio.playOneShot(SOUND.PageTurn, 1);
    if (this.currentMessageIndex - 1 >= 0) { this.currentMessageIndex -= 1; return true; }
    return false;
  }

  scrollDown(sound = true) {
    if (sound) audio.playOneShot(SOUND.PageTurn, 1);
    if (this.currentMessageIndex + 1 < this.messageCount) { this.currentMessageIndex += 1; return true; }
    return false;
  }

  close() { audio.playOneShot(SOUND.ButtonClick, 1); this.done = true; }

  input(action, e = null) {
    const code = e?.code ?? action;
    if (action === 'confirm' || action === 'back' || code === 'Escape' || code === 'Enter') { this.close(); return true; }
    if (code === 'ArrowDown' || action === 'ArrowDown') return this.scrollDown();
    if (code === 'ArrowUp' || action === 'ArrowUp') return this.scrollUp();
    if (code === 'Tab' || action === 'Tab') return this.nextCategory();
    return false;
  }

  /** MainPanel scroll (:285-297) - no sound on the wheel, unlike the
   *  arrow buttons. */
  wheel(dy) { return dy > 0 ? this.scrollDown(false) : this.scrollUp(false); }

  click(vx, vy) {
    const R = JOURNAL_RECTS;
    if (inRect(R.exit, vx, vy)) { this.close(); return true; }
    if (inRect(R.dialog, vx, vy)) { this.nextCategory(); return true; }
    if (inRect(R.upArrow, vx, vy)) { this.scrollUp(); return true; }
    if (inRect(R.downArrow, vx, vy)) { this.scrollDown(); return true; }
    // Every other rect on the page is consumed rather than allowed to
    // fall through to the host's pointer-lock request.
    return inRect(R.log, vx, vy) || inRect(R.title, vx, vy);
  }

  /** SetTextActiveQuests / SetTextWithListEntries (:565-676): walk the
   *  entries from currentMessageIndex, emitting a line per Text or
   *  NewLine token, stopping at maxLines, with a blank line after each
   *  whole entry. */
  pageLines() {
    const entries = this.entries();
    this.messageCount = entries.length;
    const out = [];
    for (let i = this.currentMessageIndex; i < entries.length; i++) {
      if (out.length >= this.maxLines) break;
      for (const token of entries[i] ?? []) {
        if (out.length >= this.maxLines) break;
        const f = token?.formatting;
        if (f === 'text' || f === 'newline' || f === 'textHighlight' || f === 'textAnswer' || f === 'textQuestion') {
          out.push(String(token.text ?? ''));
        }
      }
      if (out.length >= this.maxLines) break;
      out.push('');   // the NewLineToken between entries (:602, :672)
    }
    return out;
  }

  draw(renderer, canvas, font, largeFont = null) {
    const m = nativeMetrics(canvas);
    drawMenuBackdrop(renderer, canvas);
    if (_art) drawImg(renderer, _art, m, 0, 0);

    // The title, centred in its panel, in the LARGE font when the host
    // has one (:203-210).
    const [tx, ty, tw] = JOURNAL_RECTS.title;
    const tf = largeFont ?? font;
    const title = TITLES[this.mode];
    const titleW = measureText(tf.fnt, title);
    drawText(renderer, tf, title, m.ox + (tx + (tw - titleW) / 2 + 1) * m.s, m.oy + (ty + 1) * m.s, m.s, TITLE_SHADOW);
    drawText(renderer, tf, title, m.ox + (tx + (tw - titleW) / 2) * m.s, m.oy + ty * m.s, m.s, DEFAULT_TEXT_COLOR);

    // The log body.
    const [lx, ly] = JOURNAL_RECTS.log;
    const scale = this.textScale;
    const rowH = font.fnt.fixedHeight * scale;
    const lines = this.pageLines();
    let y = ly;
    for (const line of lines) {
      if (line) {
        drawText(renderer, font, line, m.ox + (lx + 1) * m.s, m.oy + (y + 1) * m.s, m.s * scale, [0, 0, 0, 1]);
        drawText(renderer, font, line, m.ox + lx * m.s, m.oy + y * m.s, m.s * scale, DEFAULT_TEXT_COLOR);
      }
      y += rowH;
    }
    // An empty page says so rather than showing a blank book - the same
    // honesty the settings screen owes a setting that does nothing.
    if (!lines.some((l) => l)) {
      shadowText(renderer, font, this.mode === 'activeQuests' ? 'You have no active quests.' : 'Nothing is written here yet.', m, lx, ly);
    }
    return true;
  }
}
