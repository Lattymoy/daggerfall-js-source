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
const EN = Object.freeze({
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
  }

  /** GetNotebookSaveData (:264-306): entries flatten to LINE LISTS
   *  with the D:/Q:/A: formatting prefixes; ONE non-text token joins
   *  (dropped), a SECOND consecutive one lands an empty line (the
   *  lBreak law). Messages are NOT saved. */
  getSaveData() {
    return {
      notebookEntries: this.notes.map(convertEntry),
      finishedQuestEntries: this.finishedQuests.map(convertEntry),
    };
  }

  /** RestoreNotebookData (:308-315). */
  restoreSaveData(data) {
    this.notes = (data.notebookEntries ?? []).map(convertLines);
    this.finishedQuests = (data.finishedQuestEntries ?? []).map(convertLines);
  }
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
