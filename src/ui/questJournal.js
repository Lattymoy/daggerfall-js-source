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
import { loadImg, nativeMetrics, drawImg, shadowText, DEFAULT_TEXT_COLOR, DEFAULT_SHADOW_COLOR } from './nativePanel.js';
import { drawText, measureText } from './text.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
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
/** MultiFormatTextLabel.SetText (:355-371): one colour per formatting.
 *  TextHighlight takes the label's HighlightColor, which defaults to
 *  DaggerfallUI.DaggerfallHighlightTextColor (:36); TextQuestion and
 *  TextAnswer take their own two - and Answer is
 *  DaggerfallDefaultInputTextColor, not the default text colour. */
export const JOURNAL_COLORS = Object.freeze({
  text: DEFAULT_TEXT_COLOR,
  newline: DEFAULT_TEXT_COLOR,
  highlight: [219 / 255, 130 / 255, 40 / 255, 1],   // DaggerfallHighlightTextColor
  question: [0.698, 0.812, 1.0, 1],                 // DaggerfallQuestionTextColor
  answer: [227 / 255, 223 / 255, 0, 1],             // DaggerfallDefaultInputTextColor
});

/** The four page titles, verbatim from Internal_Strings_en (ids 628,
 *  630, 632, 634) - AUDIT 24 (the seven-slice sweep): two of them were
 *  the port's own sentence case where the table title-cases both
 *  words. */
const TITLES = Object.freeze({
  activeQuests: 'Active Quests',
  finishedQuests: 'Finished Quests',
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
        // SetTextWithListEntries' five counted formattings
        // (DaggerfallQuestJournalWindow.cs:658-662). AUDIT 24 ui: the
        // last three were spelled with C#'s enum names, which the
        // notebook never emits - it files 'highlight'/'question'/
        // 'answer' (notebook.js:8-9), so every note and every
        // finished-quest entry silently lost its date/city header,
        // uncounted and undrawn, where DFU draws it in HighlightColor.
        // AUDIT 24 (the seven-slice sweep): the COLOUR rides with the
        // line. MultiFormatTextLabel.SetText (:355-371) gives each
        // token's label its own colour by formatting - TextHighlight
        // takes HighlightColor, TextQuestion and TextAnswer their own
        // two - and pageLines used to flatten all five to bare
        // strings, so the date/city headers, the finished-quest
        // headers and the whole talk-arc Q&A drew in the default
        // yellow. Rows are { text, color } now; the draw reads it.
        if (f === 'text' || f === 'newline' || f === 'highlight' || f === 'answer' || f === 'question') {
          out.push({ text: String(token.text ?? ''), color: JOURNAL_COLORS[f] ?? DEFAULT_TEXT_COLOR });
        }
      }
      if (out.length >= this.maxLines) break;
      out.push({ text: '', color: DEFAULT_TEXT_COLOR });   // the NewLineToken between entries (:602, :672)
    }
    return out;
  }

  draw(renderer, canvas, font, largeFont = null) {
    const m = nativeMetrics(canvas);
    // AUDIT 24 ui: this window's Setup assigns
    // `ParentPanel.BackgroundColor = ScreenDimColor` (DaggerfallQuestJournalWindow.cs:95),
    // which is Color.clear - the letterbox is NOT painted.
    drawScreenDimBackdrop(renderer, canvas);
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
    // AUDIT 24 ui: MultiFormatTextLabel.NewLine advances
    // `cursorY += lastLabel.TextHeight + rowLeading` (:259, rowLeading
    // 0), and TextLabel.TextHeight is `(int)(totalHeight * textScale)`
    // (:146-148) over font.GlyphHeight - an INT. At textScaleSmall 0.8
    // that is (int)(7 * 0.8) = 5, not 5.6: the float pitch drifted the
    // 28th small row 17px down, past the bottom of the log panel.
    const rowH = Math.trunc(font.fnt.fixedHeight * scale);
    const lines = this.pageLines();
    let y = ly;
    for (const row of lines) {
      const line = row.text;
      const color = row.color;
      if (line) {
        // AUDIT 24 ui: questLogLabel never sets ShadowColor, so it keeps
        // MultiFormatTextLabel.cs:37's `DaggerfallUI
        // .DaggerfallDefaultShadowColor` = Color32(93, 77, 12) and
        // hands it to every child label (:232) - not opaque black.
        drawText(renderer, font, line, m.ox + (lx + 1) * m.s, m.oy + (y + 1) * m.s, m.s * scale, DEFAULT_SHADOW_COLOR);
        drawText(renderer, font, line, m.ox + lx * m.s, m.oy + y * m.s, m.s * scale, color);
      }
      y += rowH;
    }
    // An empty page says so rather than showing a blank book - the same
    // honesty the settings screen owes a setting that does nothing.
    // AUDIT 24: `l.text`, not `l`. Wave 11 turned page rows from bare
    // strings into { text, color } so the highlight/question/answer
    // colours could ride with them - and an OBJECT is always truthy,
    // so this fallback went unreachable the same day it was written.
    // A page of nothing but empty rows drew a blank book again.
    if (!lines.some((l) => l.text)) {
      shadowText(renderer, font, this.mode === 'activeQuests' ? 'You have no active quests.' : 'Nothing is written here yet.', m, lx, ly);
    }
    return true;
  }
}
