// @ts-check
// ═══════════════════════════════════════════════════════════════════
// JOURNAL1 - A PAGE OF MY JOURNAL, SHOWN; AND ONE SHOWN TO ME, KEPT.
//
// Addison Knox, on Discord: "Player journals ... shared in-world for
// storytelling."
//
// THE JOURNAL IS THE ONE THE GAME ALREADY KEEPS: DFU's PlayerNotebook
// (systems/notebook.js), whose Notes the chronicle draws and whose
// composer writes. A second journal beside it would be two places a
// player's story lives. Sharing it is two doors, one for each way a
// story is passed on:
//
//   - SHOWN to a player standing near (within the reach a talk has,
//     player/socialPick.js SOCIAL_REACH) - a page frame through the
//     relay (net/wire.js pageLaw, net/online.js sendPage). It is HELD
//     OUT, never pushed: nothing opens over the reader's game on its
//     own. It waits for them (PageOffers, below), a line on their chat
//     says so, and they read it when they turn to me - the F-menu's
//     "Read their page" - in a window that offers to keep it
//     (ui/pageWindow.js);
//   - SENT as a letter, to a player anywhere, away or not - MAIL1's
//     form with the page written in it (letterOfPage).
//
// And what is shown or sent can be KEPT: a page into the reader's own
// journal as a note (keptPageTokens), a letter the same way
// (keptLetterTokens) - through the notebook's own AddNote(tokens), so
// it is dated and filed as every note is, with every line made
// takeable first (breakableNote): a page can carry what the notebook's
// wrap throws on.
//
// This file is the pure half: the shapes and the words. The host
// (scenes/world.js) wires it to the socket, the chronicle, the menu,
// the window and the letters.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A row (ONLINE).
// ═══════════════════════════════════════════════════════════════════
import { pageLaw, PAGE_LINES_MAX } from './wire.js';
import { breakableNote } from '../systems/notebook.js';

/** @typedef {{ head: string, lines: string[] }} Page */
/** @typedef {{ formatting: string, text: string }} NoteToken */

/** The token kinds that are a LINE of an entry - the chronicle's own set (ui/enhancedChronicle.js LINE_FORMATTINGS),
 *  less the break, which is a blank line here. */
const LINE_TOKENS = new Set(['text', 'highlight', 'question', 'answer']);
const DRAWN_TOKENS = new Set([...LINE_TOKENS, 'newline']);

/**
 * A NOTE AS A PAGE: the entry's dated head, and its lines as the notebook laid them out, a blank line where it filed a
 * break - through the page's law, so what comes back is the page a reader will be shown, or the word that says why
 * not. The head is the entry's first drawn token when that is a highlight (the chronicle's own reading, chronicleEntry);
 * a continuation, which the notebook files with no head, is a page with none.
 * @param {unknown} entry  a notebook entry (PlayerNotebook.getNote)
 * @returns {{ page: Page } | { error: string }}
 */
export function pageOfNote(entry) {
  const tokens = /** @type {NoteToken[]} */ (Array.isArray(entry) ? entry : []).filter((t) => DRAWN_TOKENS.has(t?.formatting));
  const headed = tokens[0]?.formatting === 'highlight';
  const head = headed ? String(tokens[0].text ?? '') : '';
  const lines = (headed ? tokens.slice(1) : tokens).map((t) => (t.formatting === 'newline' ? '' : String(t.text ?? '')));
  return pageLaw({ head, lines });
}

/** Why a page cannot be shown, in the journal's own words - the page law's word, said. */
export function pageRefusalText(error) {
  if (error === 'no-words') return 'There is nothing written on this page.';
  if (error === 'page-long') return `This page is too long to show - a page shows ${PAGE_LINES_MAX} lines at most.`;
  if (error === 'line-long') return 'A line on this page is too long to show.';
  if (error === 'head-long') return 'The date on this page is too long to show.';
  return 'This page cannot be shown.';
}

/** Lines as the notebook's tokens: each made takeable (breakableNote), a blank line a break (AddNote(tokens) files an
 *  empty token as one). */
const noteTokensOf = (lines) => lines.map((l) => ({ formatting: 'text', text: l ? breakableNote(l) : '' }));

/**
 * A PAGE KEPT: the note it becomes in the reader's journal, as notebook.addNoteTokens takes it. The notebook dates it
 * where and when it is KEPT (its own header); the first line says whose it was and when they wrote it; a blank line;
 * then the page as it was shown.
 * @param {string | null} name  the name the room knows the writer by
 * @param {Page} page
 * @returns {NoteToken[]}
 */
export function keptPageTokens(name, page) {
  const who = name || 'someone';
  return noteTokensOf([page.head ? `From the journal of ${who} - ${page.head}` : `From the journal of ${who}:`, '', ...page.lines]);
}

/**
 * A LETTER KEPT: the same, for a letter (net/mail.js's shape): who wrote it and what about, a blank line, its lines.
 * @param {{ from: string, subject: string, body: string }} letter
 * @returns {NoteToken[]}
 */
export function keptLetterTokens(letter) {
  return noteTokensOf([`A letter from ${letter.from}: ${letter.subject}`, '', ...String(letter.body ?? '').split('\n')]);
}

/** The subject a page sent as a letter carries - the page's own head is a date, longer than a subject may be. */
export const PAGE_LETTER_SUBJECT = 'A page from my journal';

/**
 * A PAGE AS A LETTER: the draft MAIL1's form opens on - the page's head as its first line, a blank line, the page. The
 * letter's law judges it when it is sent (net/letterLaw.js letterWords): a page past a letter's bound is refused there,
 * in the form, with the draft kept to be cut down - never cut here.
 * @param {Page} page
 * @returns {{ subject: string, body: string }}
 */
export function letterOfPage(page) {
  return { subject: PAGE_LETTER_SUBJECT, body: (page.head ? [page.head, '', ...page.lines] : page.lines).join('\n') };
}

/** How long a page held out waits for its reader. */
export const PAGE_HOLD_MS = 5 * 60 * 1000;
/** A writer who holds out page after page is said to the reader once in this long - their pages still land. */
export const PAGE_NOTICE_MS = 30 * 1000;
/** The most writers whose pages wait at once; past it, the stalest writer's page goes. */
export const PAGE_OFFERS_MAX = 8;

/**
 * THE PAGES HELD OUT TO ME, one per writer - the newest a writer held out replaces their last (and is not kept yet), and
 * a page waits PAGE_HOLD_MS for me to read it. The writer's name is the one the room knew them by when they held it
 * out, so a page read or kept after they left still says whose it was. `now` is a monotonic clock (a wall clock that
 * steps must not age a page).
 */
export class PageOffers {
  /** @param {{ now?: () => number }} [o] */
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
    /** @type {Map<string, { page: Page, name: string | null, at: number, saidAt: number, kept: boolean }>} */
    this.held = new Map();
  }

  /** A page held out to me by `id`. True when it is to be SAID - their first, or the first in PAGE_NOTICE_MS. */
  offer(id, page, name = null) {
    const t = this.now();
    const was = this.held.get(id);
    const say = !was || t - was.saidAt >= PAGE_NOTICE_MS;
    this.held.delete(id);   // re-inserted, so the map's order is the writers' order of last holding one out
    this.held.set(id, { page, name: name || null, at: t, saidAt: say ? t : was.saidAt, kept: false });
    while (this.held.size > PAGE_OFFERS_MAX) this.held.delete(this.held.keys().next().value);
    return say;
  }

  /** The page `id` holds out to me now - `{ page, name, kept }` - or null: one that waited PAGE_HOLD_MS is gone. */
  get(id) {
    const o = this.held.get(id);
    if (!o) return null;
    if (this.now() - o.at > PAGE_HOLD_MS) { this.held.delete(id); return null; }
    return { page: o.page, name: o.name, kept: o.kept };
  }

  /** `page`, which `id` held out, is in my journal now - so reading it again offers no second copy. Only THAT page: a
   *  newer one they held out while I was reading the last is not kept by keeping the last. */
  markKept(id, page) { const o = this.held.get(id); if (o && o.page === page) o.kept = true; }

  /** The writers who are not in the room any more take their pages with them - `ids` anything that answers `has` (the
   *  session's own peer map), walked with no copy, since a frame asks it. */
  keepOnly(ids) {
    for (const id of this.held.keys()) if (!ids.has(id)) this.held.delete(id);
  }

  clear() { this.held.clear(); }
}

/** The line that says a page is held out: whose, and how to read it (`how` - the host's word for turning to them: the
 *  key the F-menu is bound to, or a tap). */
export function pageOfferText(name, how = null) {
  return `${name || 'Someone'} holds out a page of their journal - ${how || 'turn to them'} to read it.`;
}

/** The line the writer reads when a page went, and the ones for when it did not. */
export const pageShownText = (name) => `You hold out the page to ${name || 'them'}.`;
export const pageTooFarText = (name) => `${name || 'They'} ${name ? 'is' : 'are'} not near enough any more.`;
export const PAGE_UNSUPPORTED_TEXT = 'The server cannot carry a page yet.';
export const PAGE_NO_READERS_TEXT = 'No one is near enough to show it to.';
/** The reader's line when the page they turned to read is no longer held out (it waited too long). */
export const PAGE_GONE_TEXT = 'That page is no longer held out to you.';
