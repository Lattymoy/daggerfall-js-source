// @ts-check
// SEASON1 part three (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE HALL OF RECORDS AS A BOOK
// (bible/11-Multiplayer/Seats-Arc.md 9.2: "A Hall of Records book in every seat's palace ... read it as prose ... The book
// is read through the enhanced book window the port already has"). A seat's Chronicle, read by the law
// (net/townSeatLaw.js hallOfRecordsChapters), laid out as the book reader's own tokens - its title centred in the title
// face, each Season's chapter under its name, each line a paragraph - and handed to the reader's one door
// (ui/bookDoor.js createBookReaderWindow), which picks the skin's face. Pure: the rows are handed in.
//
// Not a DFU member: Daggerfall's books are files; this one is written from the server's Chronicle. Ledger A row.
import { RSC, TOKEN_TEXT } from '../formats/textRsc.js';
import { createBookReaderWindow } from './bookDoor.js';   // EB1: the reader's one door - it picks the skin's face
import { hallOfRecordsChapters, hallOfRecordsTitle, HALL_OF_RECORDS_EMPTY, chronicleLine, guildWords } from '../net/townSeatLaw.js';
import { heraldryOf, heraldryText } from '../net/heraldryLaw.js';   // HERALDRY-SHOWN: the Roll of Arms
import { chapterChronicleLine } from '../net/npcChapterLaw.js';   // CHAP4d: the region's chapters' seats
import { REGION_NAMES } from '../formats/mapsTables.js';

/** Who the book says wrote it. */
export const HALL_OF_RECORDS_AUTHOR = 'the Chronicle of the Seats';
/** The title face's font (ui/enhancedBook.js: 5 is the title cut). */
const TITLE_FONT = 5;
const text = (t) => ({ formatting: TOKEN_TEXT, text: t });
const nl = () => ({ formatting: RSC.NewLine });
const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The book's tokens: the title, centred in the title face; then each chapter - its Season's name centred, or none for
 *  rows from no counted Season - and its lines, each a paragraph with a blank row after; an empty Hall says so.
 *  HERALDRY-SHOWN: then the Roll of Arms (hallOfRecordsRoll), where `armsOf` knows any of its guilds'. */
export function hallOfRecordsTokens(seat, rows, zero = null, armsOf = null, chapterBook = null) {
  /** @type {any[]} */
  const out = [{ formatting: RSC.JustifyCenter }, { formatting: RSC.FontPrefix, x: TITLE_FONT }, text(hallOfRecordsTitle(seat)), nl(), nl()];   // the blank row puts the face and the centring back
  const chapters = hallOfRecordsChapters(rows, seat, zero);
  const said = hallOfRecordsChapterLines(chapterBook);   // CHAP4d
  if (!chapters.length && !said.length) return [...out, text(HALL_OF_RECORDS_EMPTY), nl()];
  if (!chapters.length) out.push(text(HALL_OF_RECORDS_EMPTY), nl(), nl());   // CHAP4d: the seat's empty, its region's chapters not
  for (const c of chapters) {
    if (c.heading) out.push({ formatting: RSC.JustifyCenter }, text(upper(c.heading)), nl(), nl());
    out.push({ formatting: RSC.JustifyLeft });
    for (const line of c.lines) out.push(text(line), nl(), nl());
  }
  const roll = hallOfRecordsRoll(rows, seat, armsOf);   // HERALDRY-SHOWN
  if (roll.length) {
    out.push({ formatting: RSC.JustifyCenter }, text(HALL_OF_RECORDS_ROLL), nl(), nl(), { formatting: RSC.JustifyLeft });
    for (const line of roll) out.push(text(line), nl(), nl());
  }
  // CHAP4d (Chapters-Arc 6): AND THE REGION'S CHAPTERS - every change of a guild chapter's seats in the seat's region, the
  // Chronicle the seats' own Hall keeps beside theirs (`chapterBook` the service's { rows, zero }; none offline)
  if (said.length) {
    out.push({ formatting: RSC.JustifyCenter }, text(hallOfRecordsChaptersTitle(seat)), nl(), nl(), { formatting: RSC.JustifyLeft });
    for (const line of said) out.push(text(line), nl(), nl());
  }
  return out;
}

/** CHAP4d: the chapters' section's heading - "The Chapters of Daggerfall" (the seat's region). */
export const hallOfRecordsChaptersTitle = (/** @type {any} */ seat) => `The Chapters of ${REGION_NAMES[seat?.region] ?? 'the Region'}`;
/** CHAP4d: the chapters' Chronicle in words (npcChapterLaw.js chapterChronicleLine), its rows' own order - a row it has
 *  no words for left out. */
export function hallOfRecordsChapterLines(/** @type {any} */ chapters) {
  if (!Array.isArray(chapters?.rows)) return [];
  return chapters.rows.map((/** @type {any} */ r) => chapterChronicleLine(r, chapters.zero ?? null)).filter(Boolean);
}

// HERALDRY-SHOWN (2026-10-02, Mac: "lets finish the build work"; Seats-Arc 8.1: the heraldry "drawn on ... the
// Chronicle"): the book reader draws text alone (a Daggerfall book has no pictures, on either face), so the Hall of
// Records carries its guilds' arms IN WORDS - a Roll of Arms after its chapters: each guild its lines name, in the order
// the book first names it, whose heraldry the client knows (`armsOf(tag, name)` - the host's seats' list and own guild).
/** The Roll of Arms' heading. */
export const HALL_OF_RECORDS_ROLL = 'The Roll of Arms';
/** The Roll's lines - "The Silver Hand <SH>: Azure bordered Gold, a Wolf." - for each guild a row's Chronicle line names
 *  (AUDIT HERALDRY H2: its words in the line - a guild the row carries but the line leaves out is not on the Roll), once,
 *  in the order the lines name them, whose heraldry `armsOf(tag, name)` knows (H3: the guild bearing that tag and name). */
export function hallOfRecordsRoll(rows, seat, armsOf = null) {
  if (typeof armsOf !== 'function') return [];
  const out = [], seen = new Set();
  for (const r of rows ?? []) {
    const line = chronicleLine(r, seat);
    if (!line) continue;
    const named = Object.values(r?.data ?? {})
      .filter((g) => g && typeof g === 'object' && typeof g.tag === 'string' && typeof g.name === 'string' && line.includes(guildWords(g)))
      .sort((a, b) => line.indexOf(guildWords(a)) - line.indexOf(guildWords(b)));
    for (const g of named) {
      // AUDIT2 GUILD2 G1: a guild renamed since is found as it is named now (the service's `now`), and said so
      const now = g.now && typeof g.now.tag === 'string' && typeof g.now.name === 'string' ? g.now : null;
      const tag = now?.tag ?? g.tag;
      if (seen.has(tag)) continue;   // once a guild, by its tag now
      seen.add(tag);
      const h = heraldryOf(armsOf(tag, now?.name ?? g.name));
      if (h) out.push(`${upper(guildWords(g))}${now ? ` (now ${guildWords(now)})` : ''}: ${heraldryText(h)}.`);
    }
  }
  return out;
}

/** THE BOOK the reader's door takes (ui/bookDoor.js createBookReaderWindow - it reads `title`, `author`, `pageCount`
 *  and `getPageTokens`): one page holding every token, as the reader joins pages anyway. */
export function hallOfRecordsBook(seat, rows, zero = null, armsOf = null, chapters = null) {
  const tokens = hallOfRecordsTokens(seat, rows, zero, armsOf, chapters);
  return { title: hallOfRecordsTitle(seat), author: HALL_OF_RECORDS_AUTHOR, pageCount: 1, getPageTokens: () => tokens };
}

/** The book's window, through the reader's one door - what a seat's palace shelf opens. */
export const hallOfRecordsWindow = (seat, rows, zero = null, armsOf = null, chapters = null) => createBookReaderWindow(hallOfRecordsBook(seat, rows, zero, armsOf, chapters));   // HERALDRY-SHOWN: `armsOf`, the Roll's
