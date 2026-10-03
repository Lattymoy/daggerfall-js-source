// THE PLAYER NOTEBOOK (Q4-iv) - PlayerNotebook.cs whole. Three lists
// of token entries: NOTES (the player's own, dated), FINISHED QUESTS
// (filed at tombstone from the quest's active log), and MESSAGES (a
// 50-slot ring). The journal window's three static pages read these;
// the ACTIVE page reads the quest machine live.
//
// Tokens here are the port's message-token shape ({ formatting,
// text }) with the notebook's extra formatting names: 'highlight'
// (TextHighlight - the date headers), 'question'/'answer' (the talk
// arc files Q&A pairs), 'newline' (an explicit line BREAK, distinct
// from 'nothing' which joins wrapped lines).
//
// KEPT QUIRKS (C#'s own): MaxLineLenth 70 (the typo is theirs); the
// wrap prefixes EVERY line with one SPACE; a note page splits at
// maxLinesSmall*2 tokens and the continuation page carries NO date
// header; AddFinishedQuest's overflow files the overflowing entry,
// then the CURRENT message's tokens AGAIN as a separate headerless
// entry, then keeps appending to an empty entry - and the final add
// is unguarded, so an EMPTY entry can land; Clear() clears notes and
// finished quests but NOT the message ring; the save shape carries
// notes + finished quests only - THE MESSAGE RING IS NOT SAVED and
// empties on load; GetMessages answers the ring ROTATED (oldest
// first once it wraps).
//
// deps (all injectable):
//   dateTimeString()    - DaggerfallDateTime.Now.DateTimeString()
//   midDateTimeString() - Now.MidDateTimeString() (the quest header)
//   cityName()          - MacroHelper.CityName (the note header's %cn)

import { graphemesOf } from './graphemes.js';   // JOURNAL1: a long run is cut between the reader's characters
import { localizedStrings } from './textManager.js';   // L10N3d: DFU's Internal_Strings, read in the player's language

export const MAX_LINE_LENGTH = 70;         // PlayerNotebook.MaxLineLenth
export const MAX_MESSAGE_COUNT = 50;
const PREFIX_DATE_HEADER = 'D:';
const PREFIX_QUESTION = 'Q:';
const PREFIX_ANSWER = 'A:';

/** DaggerfallQuestJournalWindow.cs:34-35 - the page line caps the
 *  notebook's split laws lean on. */
export const MAX_LINES_QUESTS = 20;
export const MAX_LINES_SMALL = 28;

// Internal_Strings en literals.
const EN = localizedStrings({
  noteHeader: '{0} in {1}:',
  finishQuestHeader: '{0} {1} at {2}:',
  completedQuest: 'completed',
  endedQuest: 'ended',
  quest: 'Quest',
});
const format = (tpl, ...args) => tpl.replace(/\{(\d)\}/g, (_, i) => String(args[i]));

const NOTHING = Object.freeze({ formatting: 'nothing', text: '' });
const NEWLINE = Object.freeze({ formatting: 'newline', text: '' });

export class PlayerNotebook {
  constructor(deps = {}) {
    this.deps = deps;
    this.notes = [];             // token[][]
    this.finishedQuests = [];    // token[][]
    this.messages = [];          // the 50-slot ring
    this.nextMessageIndex = 0;
    // JOURNAL-CLEAN (2026-09-30, Discord: "Should there be a way to clean both finished and unfinished quests from
    // your journal for a cleaner look?"): the uids (as strings - the quest walk's own `id`, scenes/questBridge.js
    // questLog) of the ACTIVE quests the player has hidden from the journal. Hiding is the journal's, not the
    // machine's: a hidden quest keeps running, its clock keeps counting and the HUD's marks keep pointing - only the
    // journal's list leaves it out until it is unhidden or it ends (addFinishedQuest drops its id as it files it).
    this.hiddenQuests = [];
  }

  // ---- notes ----

  getNotes() { return [...this.notes]; }
  getNote(index) { return index < this.notes.length ? this.notes[index] : null; }
  removeNote(index) { this.notes.splice(index, 1); }

  /** MoveNote (:64-72): remove-then-insert, the index correcting DOWN
   *  when the destination sat past the source. */
  moveNote(srcIdx, destIdx) {
    const item = this.notes[srcIdx];
    this.notes.splice(srcIdx, 1);
    if (destIdx > srcIdx) destIdx--;
    this.notes.splice(destIdx, 0, item);
  }

  /** AddNote(string) (:74-85): one dated note; index -1 appends. */
  addNote(str, index = -1) {
    if (!str) return;
    const note = this._createNote();
    wrapLinesIntoNote(note, str, 'text');
    if (index === -1) this.notes.push(note);
    else this.notes.splice(index, 0, note);
  }

  /** AddNote(tokens) (:87-107): the talk arc's Q&A filing - an empty
   *  token becomes a line BREAK, text wraps; the page splits at
   *  maxLinesSmall*2 tokens and the continuation carries NO header. */
  addNoteTokens(texts) {
    if (!texts || texts.length === 0) return;
    let note = this._createNote();
    for (const token of texts) {
      if (!token.text) note.push(NEWLINE);
      else wrapLinesIntoNote(note, token.text, token.formatting);
      if ((note.length - 2) >= (MAX_LINES_SMALL * 2)) {
        this.notes.push(note);
        note = this._createNote();
      }
    }
    this.notes.push(note);
  }

  _createNote() {
    return [
      { formatting: 'highlight', text: format(EN.noteHeader, this.deps.dateTimeString?.() ?? '', this.deps.cityName?.() ?? '') },
      NOTHING,
    ];
  }

  // ---- messages (the unsaved ring) ----

  /** GetMessages (:140-152): rotated - oldest first once wrapped. */
  getMessages() {
    const result = [];
    for (let i = this.nextMessageIndex; i < this.messages.length; i++) result.push(this.messages[i]);
    for (let i = 0; i < this.nextMessageIndex; i++) result.push(this.messages[i]);
    return result;
  }

  /** AddMessage (:154-167): fill to 50, then overwrite the oldest. */
  addMessage(str) {
    if (!str) return;
    const message = [{ formatting: 'center', text: '' }, { formatting: 'text', text: str }];
    if (this.messages.length < MAX_MESSAGE_COUNT) {
      this.messages.push(message);
    } else {
      this.messages[this.nextMessageIndex] = message;
      this.nextMessageIndex = (this.nextMessageIndex + 1) % MAX_MESSAGE_COUNT;
    }
  }

  // ---- finished quests ----

  getFinishedQuests() { return [...this.finishedQuests]; }
  getFinishedQuest(index) { return index < this.finishedQuests.length ? this.finishedQuests[index] : null; }
  removeFinishedQuest(index) { this.finishedQuests.splice(index, 1); }

  /** JOURNAL-CLEAN: the archive emptied in one stroke - the enhanced journal's "Clear archive". The notes and the
   *  hidden list are not the archive's, and stay. */
  clearFinishedQuests() { this.finishedQuests.length = 0; }

  // ---- JOURNAL-CLEAN: hidden active quests ----

  getHiddenQuests() { return [...this.hiddenQuests]; }
  isQuestHidden(id) { return id != null && this.hiddenQuests.includes(String(id)); }
  /** AUDIT JOURNAL-CLEAN F3: keep only the hidden ids of quests still RUNNING (`liveIds`). A quest ended any way but
   *  completion (the quest repair, a clear by name or prefix, an error) left its id behind, saved - and uids are reused
   *  after a load, so a new quest could start hidden. Answers how many were dropped. */
  pruneHiddenQuests(liveIds) {
    const live = new Set([...(liveIds ?? [])].map(String));
    const before = this.hiddenQuests.length;
    this.hiddenQuests = this.hiddenQuests.filter((id) => live.has(id));
    return before - this.hiddenQuests.length;
  }
  /** Answers whether the quest was newly hidden (a second hide of one id is not a second entry). */
  hideQuest(id) {
    if (id == null || this.isQuestHidden(id)) return false;
    this.hiddenQuests.push(String(id));
    return true;
  }
  /** Answers whether the quest had been hidden. */
  unhideQuest(id) {
    const i = id == null ? -1 : this.hiddenQuests.indexOf(String(id));
    if (i < 0) return false;
    this.hiddenQuests.splice(i, 1);
    return true;
  }

  moveFinishedQuest(srcIdx, destIdx) {
    const item = this.finishedQuests[srcIdx];
    this.finishedQuests.splice(srcIdx, 1);
    if (destIdx > srcIdx) destIdx--;
    this.finishedQuests.splice(destIdx, 0, item);
  }

  /** AddFinishedQuest(tokens) (:211-215): a raw entry, empty-guarded. */
  addFinishedQuestTokens(message) {
    if (message && message.length > 0) this.finishedQuests.push(message);
  }

  /** AddFinishedQuest(messages) (:217-239): the tombstone filing. The
   *  header is '<name> completed|ended at <date>:' (DisplayName else
   *  the 'Quest' literal); every log message's EXPANDED tokens append
   *  with a line break between. THE OVERFLOW QUIRK KEPT WHOLE: past
   *  maxLinesQuests*2 tokens the entry files, the CURRENT message's
   *  tokens file AGAIN as a separate headerless entry, and the loop
   *  keeps appending to a cleared (headerless) entry; the final push
   *  is unguarded, so an empty entry can land. */
  addFinishedQuest(messages) {
    if (!messages || messages.length === 0) return;
    const quest = messages[0].parentQuest;
    // JOURNAL-CLEAN: a hidden quest that ends is filed like any other - the archive shows it - and its hidden id,
    // which now names nothing live, goes.
    if (quest?.uid != null) this.unhideQuest(quest.uid);
    const questName = quest.displayName || EN.quest;
    let entry = this._createFinishedQuest(questName, quest.questSuccess);
    for (const msg of messages) {
      for (const token of msg.getTextTokens()) entry.push(token);
      entry.push(NEWLINE);
      if ((entry.length - 2) >= (MAX_LINES_QUESTS * 2)) {
        this.finishedQuests.push(entry);
        this.addFinishedQuestTokens(msg.getTextTokens());
        entry = [];
      }
    }
    this.finishedQuests.push(entry);
  }

  _createFinishedQuest(questName, success) {
    const status = success ? EN.completedQuest : EN.endedQuest;
    return [
      { formatting: 'highlight', text: format(EN.finishQuestHeader, questName, status, this.deps.midDateTimeString?.() ?? '') },
      NOTHING,
    ];
  }

  // ---- save, load & clear ----

  /** Clear (:258-262): notes + finished quests; the message ring
   *  SURVIVES a clear, C#'s own hole. */
  clear() {
    this.notes.length = 0;
    this.finishedQuests.length = 0;
    this.hiddenQuests.length = 0;   // JOURNAL-CLEAN: a new game hides nothing
  }

  /** GetNotebookSaveData (:264-306): entries flatten to LINE LISTS
   *  with the D:/Q:/A: formatting prefixes; ONE non-text token joins
   *  (dropped), a SECOND consecutive one lands an empty line (the
   *  lBreak law). Messages are NOT saved. */
  getSaveData() {
    return {
      notebookEntries: this.notes.map(convertEntry),
      finishedQuestEntries: this.finishedQuests.map(convertEntry),
      // JOURNAL-CLEAN: the port's own field beside DFU's two - written only when something is hidden, so a save with
      // nothing hidden is the shape it always was.
      ...(this.hiddenQuests.length ? { hiddenQuestIds: [...this.hiddenQuests] } : {}),
    };
  }

  /** RestoreNotebookData (:308-315). */
  restoreSaveData(data) {
    this.notes = (data.notebookEntries ?? []).map(convertLines);
    this.finishedQuests = (data.finishedQuestEntries ?? []).map(convertLines);
    // JOURNAL-CLEAN: an older save carries no list and hides nothing; a malformed one is read for what it holds.
    const hidden = Array.isArray(data.hiddenQuestIds) ? data.hiddenQuestIds : [];
    this.hiddenQuests = [...new Set(hidden.filter((id) => typeof id === 'string' || Number.isFinite(id)).map(String))];
  }
}

/**
 * JOURNAL1: THE WORDS THE NOTEBOOK CAN TAKE. DFU's WrapLinesIntoNote (below, verbatim) throws when the first 71
 * characters left to wrap carry no SPACE - and in DFU that is unreachable, because the note box stops at 70 (the
 * classic journal's own cap, ui/questJournal.js). The port reached it the moment a surface let a longer note through:
 * the enhanced chronicle's composer takes 200, so a pasted address or one long word threw out of its submit handler
 * and the note was lost; and a page another player shows you, or a letter you keep, can carry anything.
 *
 * So the text is made TAKEABLE before it is handed over, and the wrap stays DFU's. The wrap breaks at a space and
 * nowhere else - not a tab, not a no-break space - so a run is what lies between SPACES, and every run longer than
 * MAX_LINE_LENGTH is cut into pieces of at most that many units with a space between each: the break the wrap then
 * spends, so the note reads as a hard-wrapped line would. Each cut falls between the reader's characters
 * (systems/graphemes.js, EMOTE1's law), and a character wider than a line on its own goes by its code points, so no
 * text can be refused. Text with no such run comes back as it was.
 */
export function breakableNote(str) {
  return String(str ?? '').split(/( +)/).map((run, k) => (k % 2 || run.length <= MAX_LINE_LENGTH ? run : pieces(run))).join('');
}

function pieces(run) {
  const out = [''];
  for (const g of graphemesOf(run)) {
    for (const u of g.length > MAX_LINE_LENGTH ? Array.from(g) : [g]) {
      if (out[out.length - 1].length + u.length > MAX_LINE_LENGTH) out.push('');
      out[out.length - 1] += u;
    }
  }
  return out.join(' ');
}

/** WrapLinesIntoNote (:121-138): break on the LAST space at or before
 *  column 70; EVERY emitted line takes a leading space, verbatim. */
export function wrapLinesIntoNote(note, str, formatting) {
  while (str.length > MAX_LINE_LENGTH) {
    const pos = str.lastIndexOf(' ', MAX_LINE_LENGTH);
    // AUDIT 24 (the seven-slice sweep): C# HANGS NOWHERE HERE - it
    // THROWS. `LastIndexOf` answers -1 when the first 71 characters
    // carry no space, and `Substring(0, -1)` is an
    // ArgumentOutOfRangeException. In JS `slice(0, -1)` is a legal
    // "drop the last character" and `slice(0)` is the SAME STRING, so
    // the loop made no progress and spun for ever - a frozen tab where
    // DFU shows an exception. A 71-character run with no space is
    // reachable: a quest name, a URL-ish token, any pasted note.
    if (pos < 0) {
      throw new RangeError('wrapLinesIntoNote: no break point in the first '
        + `${MAX_LINE_LENGTH + 1} characters (C#'s Substring(0, -1) throws here)`);
    }
    note.push({ formatting, text: ' ' + str.slice(0, pos) });
    note.push(NOTHING);
    str = str.slice(pos + 1);
  }
  note.push({ formatting, text: ' ' + str });
  note.push(NOTHING);
}

function convertEntry(entry) {
  const lines = [];
  let lineBreak = false;
  for (const token of entry) {
    if (token.formatting === 'text') lines.push(token.text);
    else if (token.formatting === 'highlight') lines.push(PREFIX_DATE_HEADER + token.text);
    else if (token.formatting === 'question') lines.push(PREFIX_QUESTION + token.text);
    else if (token.formatting === 'answer') lines.push(PREFIX_ANSWER + token.text);
    else if (lineBreak) lines.push('');
    else { lineBreak = true; continue; }
    lineBreak = false;
  }
  return lines;
}

function convertLines(entry) {
  const lines = [];
  for (const line of entry) {
    if (line.startsWith(PREFIX_DATE_HEADER)) {
      lines.push({ formatting: 'highlight', text: line.slice(PREFIX_DATE_HEADER.length) });
    } else if (line.startsWith(PREFIX_QUESTION)) {
      lines.push({ formatting: 'question', text: line.slice(PREFIX_QUESTION.length) });
    } else if (line.startsWith(PREFIX_ANSWER)) {
      lines.push({ formatting: 'answer', text: line.slice(PREFIX_ANSWER.length) });
    } else if (line) {
      lines.push({ formatting: 'text', text: line });
    }
    lines.push(line ? NOTHING : NEWLINE);
  }
  return lines;
}
