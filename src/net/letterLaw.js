// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MAIL1 - THE LETTER'S LAW, ONE HOME FOR BOTH ENDS.
//
// Addison Knox, on Discord: "An in-game mail system where players can
// send messages to offline players (e.g. notes, contracts,
// invitations)."
//
// A letter is words from one registered player to another, kept by the
// ACCOUNT SERVICE until its reader deletes it - the service is the one
// thing in this port that outlives a session, and it already knows who
// every registered player is by a handle nobody else can hold. The
// relay is not involved: a letter is for someone who is NOT online.
//
// THIS FILE IS THE SHAPE, AND BOTH ENDS READ IT. server-account's
// letters.js refuses what breaks it; the client's compose form caps its
// fields at the same numbers, so a letter a player can type is a letter
// the service takes (ACC1e's rule for a handle, applied to a letter).
// Imports run one way (server-account imports src, never the reverse:
// net/handleShape.js says why), and the account worker already carries
// wire.js through identityToken.js, so this adds nothing to its graph.
//
// ═══ A LETTER IS CLEANED, NEVER CUT ════════════════════════════════
//
// The characters a letter may carry are the chat's (wire.js
// visibleText: no control or format character, no half of a pair, no
// mark stack, the one emoji joiner) - the same law, not a copy of it.
// What differs is the SHAPE: a chat line is one line, and a letter
// keeps its lines, because a contract or an invitation is laid out.
// Each line's spaces collapse to one; a run of blank lines becomes one
// blank line; blank lines at either end go.
//
// A LETTER PAST ITS BOUND IS REFUSED, NOT TRIMMED. A service that cut a
// letter to fit would deliver words its sender did not send - the last
// clause of a contract, gone. The form will not let a player type past
// the bound, so a refusal here means a client that is not ours.
//
// Not a DFU member: Daggerfall Unity has no letters between players. Ledger A row (ONLINE).
// ═══════════════════════════════════════════════════════════════════
import { wordsLine, foldBlankLines } from './wire.js';   // JOURNAL1: a line of a player's words, and their layout - one home with the journal page's law

/** A subject's longest, in UTF-16 units (a field's maxlength counts the same units). */
export const LETTER_SUBJECT_MAX = 60;
/** A body's longest, in UTF-16 units. MAX_BODY_BYTES (server-account/src/service.js) is 4 KiB and a unit is at most
 *  three bytes of UTF-8 (an astral character is two units and four bytes), so the whole request - body, subject,
 *  the recipient's handle and the JSON around them - always fits; a pin does the arithmetic. */
export const LETTER_BODY_MAX = 800;
/** A body's most lines. Words bound the size; lines bound the HEIGHT - eight hundred newlines is one character a
 *  line and a letter that scrolls for ever. */
export const LETTER_LINES_MAX = 40;
/** The letters one reader keeps. At the bound a new letter is REFUSED to its sender ('inbox-full'); the reader's
 *  oldest is never deleted to make room, because a letter is kept until its reader says otherwise (the same law
 *  as a cloud save's SAVES_MAX). */
export const LETTERS_INBOX_MAX = 50;
/** One sender's letters in a window, to anyone: a registered player writes letters, not a mailing list. */
export const LETTERS_SENT_MAX = 20;
export const LETTERS_SENT_WINDOW_S = 60 * 60;
/** ...and to ONE reader in the same window. Registered-only and the mute are the other two walls; this is the one
 *  that stops a single player from filling another's box - LETTERS_INBOX_MAX would take three hours of it. */
export const LETTERS_PAIR_MAX = 5;
/** A letter's id - accounts.js mintId's shape (eighteen random bytes, base64url), which the reader hands back. */
export const LETTER_ID_RE = /^[A-Za-z0-9_-]{16,40}$/;

/** A line break, in any of the spellings a textarea or a paste produces - the two Unicode separators included,
 *  which visibleText would keep as ordinary characters and a reader would see as a break. */
const LINE_BREAK = /\r\n|\r|\n|\u2028|\u2029/;

/** A subject as the service keeps it: one line, cleaned (wire.js wordsLine - a line of a player's words, the journal
 *  page's law too). '' when nothing is left. */
export function cleanSubject(text) {
  return wordsLine(String(text ?? '').split(LINE_BREAK).join(' '));
}

/** A body as the service keeps it: its lines cleaned, a run of blank lines one blank line, none at either end (wire.js
 *  foldBlankLines). '' when nothing is left. Idempotent, so what the form shows after a send is what the reader gets. */
export function cleanBody(text) {
  return foldBlankLines(String(text ?? '').split(LINE_BREAK).map(wordsLine)).join('\n');
}

/**
 * A letter's words, checked: the cleaned subject and body, or the ONE word that refuses them - the service's answer
 * and the form's, so the two cannot disagree about what a letter is. Each word is spelled `return { error: '...' }`
 * because test/accountflow.test.js walks this file for the words the service can answer with (it returns these
 * verbatim), and a word it cannot see is a word a player meets raw.
 * @param {{subject?: unknown, body?: unknown}} letter
 * @returns {{ subject: string, body: string } | { error: 'no-subject' | 'subject-long' | 'no-body' | 'body-long' | 'body-lines' }}
 */
export function letterWords({ subject, body } = {}) {
  if (typeof subject !== 'string') return { error: 'no-subject' };
  if (typeof body !== 'string') return { error: 'no-body' };
  const s = cleanSubject(subject);
  if (!s) return { error: 'no-subject' };
  if (s.length > LETTER_SUBJECT_MAX) return { error: 'subject-long' };
  const b = cleanBody(body);
  if (!b) return { error: 'no-body' };
  if (b.length > LETTER_BODY_MAX) return { error: 'body-long' };
  if (b.split('\n').length > LETTER_LINES_MAX) return { error: 'body-lines' };
  return { subject: s, body: b };
}
