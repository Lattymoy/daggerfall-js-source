// @ts-check
// CHAP5a (2026-10-09, Mac: "Continue"; bible/11-Multiplayer/Chapters-Arc.md 9: "The hall's roll: the seats' holders,
// named on a board inside each hall"): THE HALL'S ROLL AS A BOOK. A DFU guild hall has no board; its bookshelf is the
// hall's own reading, so the roll is the shelf's first book - the chapter's state, its Master, its officers, off the
// chapter sheet (net/npcChapterLaw.js chapterRollTitle, chapterRollLines) - laid out as the book reader's own tokens, as
// the palace's Hall of Records is (ui/hallOfRecords.js), and handed to the reader's one door. Pure: the roll is handed in.
//
// Not a DFU member: Daggerfall's books are files; this one is written from the service's sheet. Ledger A row.

import { RSC, TOKEN_TEXT } from '../formats/textRsc.js';
import { createBookReaderWindow } from './bookDoor.js';   // the reader's one door - it picks the skin's face

/** Who the book says wrote it. */
export const CHAPTER_ROLL_AUTHOR = 'the chapter\'s clerk';
/** The title face's font (ui/enhancedBook.js: 5 is the title cut) - the Hall of Records' own. */
const TITLE_FONT = 5;
const text = (/** @type {string} */ t) => ({ formatting: TOKEN_TEXT, text: t });
const nl = () => ({ formatting: RSC.NewLine });

/** The book's tokens: the title, centred in the title face; then each line a paragraph with a blank row after.
 *  @param {{ title: string, lines: string[] }} roll */
export function chapterRollTokens(roll) {
  /** @type {any[]} */
  const out = [{ formatting: RSC.JustifyCenter }, { formatting: RSC.FontPrefix, x: TITLE_FONT }, text(roll.title), nl(), nl(), { formatting: RSC.JustifyLeft }];
  for (const line of roll.lines) out.push(text(line), nl(), nl());
  return out;
}

/** The roll as the reader's book. @param {{ title: string, lines: string[] }} roll */
export function chapterRollBook(roll) {
  const tokens = chapterRollTokens(roll);
  return { title: roll.title, author: CHAPTER_ROLL_AUTHOR, pageCount: 1, getPageTokens: () => tokens };
}

/** The book's window, through the reader's one door - what the hall's shelf opens for its roll. */
export const chapterRollWindow = (/** @type {{ title: string, lines: string[] }} */ roll) => createBookReaderWindow(chapterRollBook(roll));
