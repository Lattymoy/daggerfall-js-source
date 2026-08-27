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
import { drawText, measureText, makeFont } from './text.js';
import { FntFile } from '../formats/fntFile.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { MAX_LINES_QUESTS, MAX_LINES_SMALL, MAX_LINE_LENGTH } from '../systems/notebook.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS, messageBoxArtLoaded } from './messageBox.js';
import { getMessageResources } from '../systems/quest/questMacros.js';   // QuestMacroHelper.GetMessageResources (:61-83)
import { REGION_NAMES, patchRegionIndex } from '../formats/mapsFile.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

let _art = null;
// AUDIT 24 (wave 40): DaggerfallQuestJournalWindow.cs:161-163 builds
// the title label with `Font = DaggerfallUI.LargeFont`, and
// DaggerfallUI.cs:153 is `LargeFont => GetFont(FontName.FONT0000)`.
// The port had the law written as a `largeFont` DRAW PARAMETER that no
// caller had ever passed - see the note on draw() below for what that
// cost - so the title has always drawn in the host font. It is a
// module-level warm now, beside the art it belongs with: one load, one
// home, and no signature carrying it.
let _largeFont = null;
export async function preloadQuestJournalArt(deps) {
  if (!_largeFont) {
    try { _largeFont = makeFont(deps.renderer, new FntFile().load(await deps.fetchBytes('FONT0000.FNT')), 'FONT0000'); }
    catch { console.warn('[journal] FONT0000.FNT unavailable; the title falls back to the host font'); }
  }
  if (_art) return;
  try { _art = await loadImg(deps, 'LGBK00I0.IMG'); }
  catch { console.warn('[journal] LGBK00I0.IMG unavailable; the logbook falls back to text'); }
}
export const questJournalArtLoaded = () => !!_art;
export const questJournalLargeFont = () => _largeFont;

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
 *  TextHighlight takes the LABEL's HighlightColor (:362-364);
 *  TextQuestion and TextAnswer take their own two - and Answer is
 *  DaggerfallDefaultInputTextColor, not the default text colour.
 *
 *  AUDIT 26 F163: the port took DaggerfallHighlightTextColor
 *  (219,130,40) as the highlight, which is MultiFormatTextLabel's
 *  DEFAULT (:36) - but this window overrides it outright:
 *  `questLogLabel.HighlightColor = Color.white`
 *  (DaggerfallQuestJournalWindow.cs:152). Every notebook date header
 *  and finished-quest header showed orange where DFU shows white. */
export const JOURNAL_COLORS = Object.freeze({
  text: DEFAULT_TEXT_COLOR,
  newline: DEFAULT_TEXT_COLOR,
  highlight: [1, 1, 1, 1],                          // Color.white, this window's override
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

/** CreateDialogBox's three rows for baseKey "confirmFind" (:487-489)
 *  and the line HandleQuestClicks composes the place with (:478-481),
 *  verbatim from Internal_Strings.csv :799-801 and :1344. The port has
 *  no localisation table, so the English literals live here - the same
 *  call the rest of the port's native windows make. */
export const FIND_PLACE_TEXT = Object.freeze({
  head: 'Travel to location',
  action: 'Do you want to open the world map to travel to:',
  note: '(Note: you can cancel travel from the world map)',
  /** locationInRegionProvince, "{0} in {1} province". */
  locationInRegion: (locationName, regionName) => `${locationName} in ${regionName} province`,
});

/** F160: CreateDialogBox's six strings and the note prompt -
 *  Internal_Strings_en verbatim (m_Id 636-641, 645), the same table
 *  FIND_PLACE_TEXT came from. */
export const CONFIRM_TEXT = Object.freeze({
  moveHead: 'Move entry',
  move: 'Do you want to change the position of this entry?',
  move2: '(It will be moved to before the next entry clicked)',
  removeHead: 'Delete entry',
  remove: 'Are you sure you want to remove this entry?',
  remove2: '(It will be deleted permanently and cannot be restored)',
});
export const ENTER_NOTE_PROMPT = 'Enter your note:';

export class QuestJournalWindow {
  /**
   * @param {object} deps
   *   questMessages() - QuestMachine.getAllQuestLogMessages()
   *   notebook()      - the PlayerNotebook
   *   mode            - the DisplayMode the window opens on
   */
  constructor({
    questMessages = () => [], notebook = () => null, mode = 'activeQuests',
    // HandleQuestClicks' three world questions (:439-466). PlayerGPS's
    // current location name, DfTravelMapWindow.CanFindPlace (:1134-1146)
    // and GotoPlace (:214-217) - the last is the HOST's, because only a
    // host that owns a travel map can be sent to one. A host without one
    // leaves it null and the find dialog is never offered, which is the
    // same nothing DFU does when CanFindPlace says no.
    currentLocationName = () => '', canFindPlace = () => false, gotoPlace = null,
  } = {}) {
    this.deps = { questMessages, notebook, currentLocationName, canFindPlace, gotoPlace };
    this.done = false;
    this.isChoiceWindow = true;
    // OnPush (:190-200): the page resets to the top every open.
    //
    // U43: the DisplayMode the window opens ON is the caller's. DFU
    // has TWO doors into this one window and they differ only here -
    // dfuiOpenQuestJournalWindow (the LogBook binding) pushes it as
    // it stands, and dfuiOpenNotebookWindow sets
    // `DisplayMode = JournalDisplay.Notebook` first
    // (DaggerfallUI.cs:704-711). Both are in GameManager's one
    // dispatch chain (:541-548).
    this.mode = JOURNAL_MODES.includes(mode) ? mode : 'activeQuests';
    this.currentMessageIndex = 0;
    this.messageCount = 0;
    this.questMessages = questMessages() ?? [];
    // entryLineMap (:40) - one entry index per DRAWN LINE, rebuilt with
    // the page, and the whole of what turns a click's y into an entry.
    this.entryLineMap = [];
    this.selectedEntry = null;
    // findPlace (:78) and the dialog it arms (:481-484).
    this.findPlace = null;
    this.findBox = null;
    // F160: the move/remove confirm (CreateDialogBox, :487-505) and
    // the EnterNote input box (:507-526).
    this.moveRemoveBox = null;
    this.noteBox = null;
    this._font = null;
    audio.playOneShot(SOUND.OpenBook, 1);
  }

  /** questLogLabel.LineHeight - the pitch the page was last drawn at,
   *  which is what HandleClick divides by (:391). */
  get lineHeight() { return Math.trunc((this._font?.fnt?.fixedHeight ?? 0) * this.textScale); }

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
    this.selectedEntry = null;   // F160: DialogButton resets it (:267) - a stale pick must not arm a move
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
    // The find dialog is a pushed window in DFU, so it owns the keys
    // while it is up - Escape is its No, Enter its Yes.
    // F160: the EnterNote field (DaggerfallInputMessageBox) - chars,
    // backspace, Enter submits, Escape cancels; MaxLineLenth 70.
    if (this.noteBox) {
      if (action === 'confirm' || code === 'Enter') return this._submitNote();
      if (action === 'back' || code === 'Escape') { this.noteBox = null; this.selectedEntry = null; return true; }
      if (action === 'backspace' || code === 'Backspace') { this.noteBox.value = this.noteBox.value.slice(0, -1); return true; }
      if (typeof action === 'string' && action.startsWith('char:') && this.noteBox.value.length < MAX_LINE_LENGTH) { this.noteBox.value += action.slice(5); return true; }
      return true;
    }
    if (this.moveRemoveBox) {
      if (action === 'confirm' || code === 'Enter' || action === 'char:y' || action === 'char:Y') return this.answerMoveRemove(MB_BUTTONS.Yes);
      if (action === 'back' || code === 'Escape' || action === 'char:n' || action === 'char:N') return this.answerMoveRemove(MB_BUTTONS.No);
      return true;
    }
    if (this.findBox) {
      if (action === 'back' || code === 'Escape') return this.answerFindPlace(MB_BUTTONS.No);
      if (action === 'confirm' || code === 'Enter') return this.answerFindPlace(MB_BUTTONS.Yes);
      return true;
    }
    if (action === 'confirm' || action === 'back' || code === 'Escape' || code === 'Enter') { this.close(); return true; }
    if (code === 'ArrowDown' || action === 'ArrowDown') return this.scrollDown();
    if (code === 'ArrowUp' || action === 'ArrowUp') return this.scrollUp();
    if (code === 'Tab' || action === 'Tab') return this.nextCategory();
    return false;
  }

  /** MainPanel scroll (:285-297) - no sound on the wheel, unlike the
   *  arrow buttons. */
  wheel(dy) { return dy > 0 ? this.scrollDown(false) : this.scrollUp(false); }

  click(vx, vy, right = false) {
    const R = JOURNAL_RECTS;
    // F160: the confirm and input boxes own the screen while open.
    if (this.moveRemoveBox) {
      if (!this.moveRemoveBox.box) return this.answerMoveRemove(MB_BUTTONS.No);
      const hit = messageBoxHit(this.moveRemoveBox.box, vx, vy);
      if (hit !== null) return this.answerMoveRemove(hit);
      return true;
    }
    if (this.noteBox) return true;   // keys drive the note field
    if (this.findBox) {
      // A box the popup art could not draw has no buttons to hit, so a
      // click dismisses it rather than trapping the window - the same
      // answer its No button gives.
      if (!this.findBox.box) return this.answerFindPlace(MB_BUTTONS.No);
      const hit = messageBoxHit(this.findBox.box, vx, vy);
      if (hit !== null) return this.answerFindPlace(hit);
      return true;   // a modal box eats what misses its buttons
    }
    if (inRect(R.exit, vx, vy)) { this.close(); return true; }
    if (inRect(R.dialog, vx, vy)) { this.nextCategory(); return true; }
    if (inRect(R.upArrow, vx, vy)) { this.scrollUp(); return true; }
    if (inRect(R.downArrow, vx, vy)) { this.scrollDown(); return true; }
    // QuestLogLabel_OnMouseClick (:322-325) - the log panel's click is
    // the journal's one navigation aid, and it was consumed and dropped.
    if (inRect(R.log, vx, vy)) { this.handleClick(vy, right); return true; }   // F160: the remove gesture rides the button
    // Every other rect on the page is consumed rather than allowed to
    // fall through to the host's pointer-lock request.
    // F160: TitlePanel_OnMouseClick (:297-300) - EnterNote(0).
    if (inRect(R.title, vx, vy)) { this.enterNote(0); return true; }
    return false;
  }

  /** SetTextActiveQuests / SetTextWithListEntries (:565-676): walk the
   *  entries from currentMessageIndex, emitting a line per Text or
   *  NewLine token, stopping at maxLines, with a blank line after each
   *  whole entry. */
  pageLines() {
    const entries = this.entries();
    this.messageCount = entries.length;
    const out = [];
    // entryLineMap (:574, :594, :603): one push per EMITTED LINE, of the
    // entry's ABSOLUTE index - not its offset from currentMessageIndex -
    // and the blank line that closes each entry belongs to that entry
    // too, so a click on the gap under a quest still selects it.
    const map = [];
    // F160: SetTextWithListEntries tags the GAP line with a NEGATIVE
    // boundary (:673-674, `entryLineMap.Add(--boundary)`) - the
    // click-between-entries add-note gesture and the move target
    // decode both ride the sign; SetTextActiveQuests tags it with
    // the entry (:602-603).
    let boundary = 0;
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
          map.push(i);
        }
      }
      if (out.length >= this.maxLines) break;
      out.push({ text: '', color: DEFAULT_TEXT_COLOR });   // the NewLineToken between entries (:602, :672)
      map.push(this.mode === 'activeQuests' ? i : --boundary);
    }
    this.entryLineMap = map;
    return out;
  }

  // ── HandleClick (:385-436) and the find-place dialog ───────────────

  /**
   * HandleClick's line-to-entry half (:385-401). A click past the last
   * mapped line takes the LAST entry rather than nothing (:393-396) -
   * DFU's, and it is why clicking the empty space below a short page
   * still opens the bottom quest.
   *
   * Only the ACTIVE QUESTS arm is here: the finished-quest and notebook
   * arms of HandleClick (:405-435) move, remove and annotate entries,
   * which is a separate feature the port has not built.
   */
  handleClick(vy, remove = false) {
    this.pageLines();
    if (!this.entryLineMap.length) return false;
    const pitch = this.lineHeight;
    if (pitch <= 0) return false;
    // F160: :390 captures the PREVIOUS pick before overwriting - a
    // set value here is an ARMED move (confirmMove answered Yes).
    const moveSrcIdx = this.selectedEntry;
    const line = Math.trunc((vy - JOURNAL_RECTS.log[1]) / pitch);
    this.selectedEntry = line < this.entryLineMap.length
      ? this.entryLineMap[line]
      : this.entryLineMap[this.entryLineMap.length - 1];
    if (this.mode === 'activeQuests') {
      return this._handleQuestClicks(this.questMessages[this.selectedEntry] ?? null);
    }
    // F160: the finished-quest and notebook arms (:403-435).
    if (moveSrcIdx == null) {
      if (this.selectedEntry < 0) return this.enterNote(this.selectedEntry);   // add between (:408-411)
      const entry = this.getEntry(this.selectedEntry);
      if (entry && entry.length > 0) {
        // CreateDialogBox (:487-505): heading centred, the action
        // line, a blank, the entry (TextHighlight - flattened, the
        // findBox precedent), the explanation; Yes/No.
        const entryStr = String(entry[0]?.text ?? '');
        this.moveRemoveBox = {
          rows: [
            { text: remove ? CONFIRM_TEXT.removeHead : CONFIRM_TEXT.moveHead, center: true },
            { text: remove ? CONFIRM_TEXT.remove : CONFIRM_TEXT.move, center: false },
            { text: '', center: false },
            { text: entryStr, center: true },
            { text: remove ? CONFIRM_TEXT.remove2 : CONFIRM_TEXT.move2, center: false },
          ],
          box: null,
          remove,
        };
      }
      return true;
    }
    // the SECOND click of a move (:426-434): a boundary decodes to
    // the position before the next entry.
    if (this.selectedEntry < 0) this.selectedEntry = -this.selectedEntry + this.currentMessageIndex;
    this.moveEntry(moveSrcIdx, this.selectedEntry);
    this.selectedEntry = null;
    audio.playOneShot(SOUND.PageTurn, 1);   // editNotebook = SoundClips.PageTurn (:31)
    return true;
  }

  /** GetEntry/MoveEntry/RemoveEntry (:528-564) - per-mode dispatch
   *  onto the notebook store; every other mode answers nothing. */
  getEntry(i) {
    const nb = this.deps.notebook();
    if (this.mode === 'finishedQuests') return nb?.getFinishedQuest(i) ?? null;
    if (this.mode === 'notebook') return nb?.getNote(i) ?? null;
    return null;
  }

  moveEntry(src, dst) {
    const nb = this.deps.notebook();
    if (this.mode === 'finishedQuests') nb?.moveFinishedQuest(src, dst);
    else if (this.mode === 'notebook') nb?.moveNote(src, dst);
  }

  removeEntry(i) {
    const nb = this.deps.notebook();
    if (this.mode === 'finishedQuests') nb?.removeFinishedQuest(i);
    else if (this.mode === 'notebook') nb?.removeNote(i);
  }

  /** RemoveEntry_OnButtonClick (:332-344) / MoveEntry_OnButtonClick
   *  (:346-351): remove acts on Yes and clears either way; move
   *  clears ONLY on non-Yes - a Yes leaves the pick ARMED for the
   *  next click to consume. */
  answerMoveRemove(button) {
    const b = this.moveRemoveBox;
    this.moveRemoveBox = null;
    if (!b) return true;
    if (b.remove) {
      if (button === MB_BUTTONS.Yes) {
        this.removeEntry(this.selectedEntry);
        if (this.currentMessageIndex === this.selectedEntry) this.currentMessageIndex = 0;   // :337-338
        audio.playOneShot(SOUND.PageTurn, 1);
      }
      this.selectedEntry = null;
    } else if (button !== MB_BUTTONS.Yes) {
      this.selectedEntry = null;
    }
    return true;
  }

  /** EnterNote (:507-526) - the NOTEBOOK only (:509); finished
   *  quests move and remove but never take a note. The negative
   *  index decode is :511's. */
  enterNote(index) {
    if (this.mode !== 'notebook') return true;
    this.selectedEntry = -index + this.currentMessageIndex;
    this.noteBox = { value: '' };
    return true;
  }

  /** EnterNote_OnGotUserInput (:365-374): empty adds nothing; either
   *  way the pick clears. */
  _submitNote() {
    const text = this.noteBox?.value ?? '';
    this.noteBox = null;
    if (text.length) {
      this.deps.notebook()?.addNote(text, this.selectedEntry);
      audio.playOneShot(SOUND.PageTurn, 1);   // editNotebook
    }
    this.selectedEntry = null;
    return true;
  }

  /** GetLastPlaceMentionedInMessage (:469-485): the LAST Place resource
   *  any macro in the message names. Not ParentQuest.LastPlaceReferenced -
   *  DFU's own comment says that sends the player to an unrelated home
   *  location for the last NPC processed - and a message that names no
   *  Place at all (the Dark Brotherhood initiation keeps its entry
   *  secret) answers null. */
  _lastPlaceMentionedInMessage(message) {
    const resources = getMessageResources(message);
    if (!resources || resources.length === 0) return null;
    let lastPlace = null;
    for (const resource of resources) if (resource?.isPlace) lastPlace = resource;
    return lastPlace;
  }

  /** HandleQuestClicks (:439-466). Three gates before the offer: the
   *  message names a Place, that Place has a location name, and it is
   *  not the one the player is standing in - then CanFindPlace decides,
   *  through the CANONICAL name, whether the map can even show it. */
  _handleQuestClicks(message) {
    const place = this._lastPlaceMentionedInMessage(message);
    const site = place?.siteDetails ?? null;
    if (!site?.locationName) return false;
    if (site.locationName === this.deps.currentLocationName()) return false;
    if (!this.deps.gotoPlace) return false;
    if (!this.deps.canFindPlace(site.regionName, site.locationName)) return false;
    this.findPlace = place;
    // :474-481 - the workaround for saves written before SiteDetails
    // carried a regionIndex, and the region NAME the dialog shows comes
    // off the patched index.
    const regionIndex = patchRegionIndex(site.regionIndex ?? 0, site.regionName ?? '');
    const entryStr = FIND_PLACE_TEXT.locationInRegion(site.locationName, REGION_NAMES[regionIndex] ?? site.regionName ?? '');
    // CreateDialogBox (:486-504): heading, the action line, a blank, the
    // entry in TextHighlight, then the explanation - and Yes/No.
    this.findBox = {
      rows: [
        { text: FIND_PLACE_TEXT.head, center: true },
        { text: FIND_PLACE_TEXT.action, center: false },
        { text: '', center: false },
        { text: entryStr, center: true },
        { text: FIND_PLACE_TEXT.note, center: false },
      ],
      box: null,
    };
    return true;
  }

  /** FindPlace_OnButtonClick (:353-363). The box closes either way; on
   *  Yes the JOURNAL closes too and the travel map opens already on the
   *  place - CloseWindow, GotoPlace, then the open message. */
  answerFindPlace(button) {
    const place = this.findPlace;
    this.findBox = null;
    this.findPlace = null;
    if (button !== MB_BUTTONS.Yes || !place) return true;
    // The box's own click already sounded (messageBoxHit); DFU's
    // CloseWindow here plays nothing, so this does not go through
    // close().
    this.done = true;
    this.deps.gotoPlace?.(place);
    return true;
  }

  // AUDIT 24 (wave 40) - THE LIVE CRASH.
  //     TypeError: can't access property "glyphWidth", s is undefined
  // This took a fourth parameter called `largeFont`. Every OTHER window
  // in src/ui takes `(renderer, canvas, font, s)` where s is the HUD
  // scale, and that is what the one caller passes: CharSheet.draw
  // forwards its own four arguments straight through to `this.child`
  // (charsheet.js:240). So the logbook received the SCALE - a number -
  // in its font slot, `largeFont ?? font` picked it because a number is
  // not nullish, and `measureText(3.fnt, title)` reached measureText
  // with undefined. Opening the character sheet and pressing LOGBOOK
  // crashed the scene, every time, on every host with quests.
  //
  // Nothing had ever passed a real font here, so the parameter had
  // never once done its job - it existed only to be filled by mistake.
  // The signature takes THREE now, like every other native-panel
  // window in here (nativeInventory, nativeTalk, nativeTrade,
  // playerHistory) - this window scales through nativeMetrics(canvas)
  // and never needed a fourth. A parameter it does not declare is a
  // parameter nothing can fill by mistake. The large font is a module
  // warm instead; test/audit24_wave40.test.js holds the whole family
  // to the one shape.
  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    this._font = font;   // questLogLabel's own font, and its LineHeight
    // AUDIT 24 ui: this window's Setup assigns
    // `ParentPanel.BackgroundColor = ScreenDimColor` (DaggerfallQuestJournalWindow.cs:95),
    // which is Color.clear - the letterbox is NOT painted.
    drawScreenDimBackdrop(renderer, canvas);
    if (_art) drawImg(renderer, _art, m, 0, 0);

    // The title, centred in its panel, in the LARGE font when the host
    // has one (:203-210).
    const [tx, ty, tw] = JOURNAL_RECTS.title;
    const tf = _largeFont ?? font;   // :163 Font = DaggerfallUI.LargeFont (FONT0000)
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

    // The find-place dialog, over the page it was raised from. A host
    // without the popup art keeps the journal drawable and simply never
    // shows the box, the same refusal the rest of the port's doors give.
    // F160: the move/remove confirm and the note field draw over the
    // page, the findBox idiom.
    if (this.moveRemoveBox && messageBoxArtLoaded()) {
      this.moveRemoveBox.box = layoutMessageBox(font, this.moveRemoveBox.rows, [MB_BUTTONS.Yes, MB_BUTTONS.No]);
      drawMessageBox(renderer, m, font, this.moveRemoveBox.box);
    }
    if (this.noteBox && messageBoxArtLoaded()) {
      // DaggerfallInputMessageBox: the entry line under the prompt in
      // one parchment box; the sizing row fixes the width the way
      // WidthOverride = 318 does (:521), so the box does not breathe
      // as the note grows.
      const entry = ` > ${this.noteBox.value}_`;
      const box = layoutMessageBox(font, [{ text: ENTER_NOTE_PROMPT, center: false }, { text: entry, center: false }], [],
        { sizingRows: [ENTER_NOTE_PROMPT, ` > ${'M'.repeat(44)}_`] });
      drawMessageBox(renderer, m, font, box);
    }
    if (this.findBox && messageBoxArtLoaded()) {
      this.findBox.box = layoutMessageBox(font, this.findBox.rows, [MB_BUTTONS.Yes, MB_BUTTONS.No]);
      drawMessageBox(renderer, m, font, this.findBox.box);
    }
    return true;
  }
}
