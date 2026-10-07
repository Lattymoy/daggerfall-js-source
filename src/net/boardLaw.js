// @ts-check
// ═══════════════════════════════════════════════════════════════════
// NOTICE1 (2026-09-28, Mac: "The new notice board should be a physical object that houses quests, the player auction
// house, etc"; "Go") — THE NOTICE BOARD'S LAW, ONE HOME FOR BOTH ENDS: what a board is, what a player's note is, who
// may pin one and how many, and the words and bounds the account service (server-account/src/board.js) and the
// client's window (ui/noticeWindow.js) both read. The record is bible/06-Systems/Professions-Arc.md 10.1 and 10.6
// (PROF0), and 10.7 as built.
//
// A BOARD IS ITS TOWN'S. Every rumour board of a town (BOUNTY1 took the other half, systems/bountyBoard.js
// questBoardIndices) shows the same notes: a note is pinned to the TOWN, keyed by its location's map id (MAPS.BSA's
// MapTableData.MapId, unsigned - regionHubs.js's key), so a board stood later for a seat or a hub is the same board.
//
// A NOTE IS A LETTER PINNED UP. Its words are MAIL1's (net/letterLaw.js letterWords: a subject and a body, cleaned,
// never cut, refused past their bounds) - one law for a player's words to other players, not a second one. What a
// note adds is where it hangs, how long, and one button.
//
// Pure: no clock, no DOM, no network.
// ═══════════════════════════════════════════════════════════════════
import { letterWords, LETTER_SUBJECT_MAX, LETTER_BODY_MAX, LETTER_LINES_MAX } from './letterLaw.js';

export { LETTER_SUBJECT_MAX as NOTE_SUBJECT_MAX, LETTER_BODY_MAX as NOTE_BODY_MAX, LETTER_LINES_MAX as NOTE_LINES_MAX };

/** The live notes one account may have pinned, on every board together (PROF0 10.6). */
export const NOTES_LIVE_MAX = 3;
/** How long a note may stand, in days - the author picks one; a week is the most (PROF0 10.6). */
export const NOTE_DAYS = Object.freeze([1, 3, 7]);
export const NOTE_DAY_S = 86400;
/** The player notes a board shows, newest first (PROF0 10.1: "30 player notes a board (newest shown)"). */
export const BOARD_NOTES_SHOWN = 30;
/** The server's notices a board shows, newest first (PROF0 10.1: "the last 20 server notices"). */
export const BOARD_NOTICES_SHOWN = 20;
/** A server notice's longest life, in days - a developer's word is news, not a monument. */
export const NOTICE_DAYS_MAX = 14;
/** Notes one account may pin an hour (PROF0 20: "notes 10"), and every board act (pin, take down, report) an hour. */
export const NOTES_PINNED_MAX = 10;
export const BOARD_OPS_MAX = 60;
export const BOARD_WINDOW_S = 3600;
/** A note hidden from everyone once this many different readers have reported it, until a moderator decides. AUDIT 28
 *  N3: only a report from an account that is neither muted nor a sprout (younger than titles.js SPROUT_S, fourteen
 *  days) counts toward it - three accounts registered this minute hid any note, and a muted flood's reports counted.
 *  Any registered reader's report still hides the note from that reader at once. */
export const NOTE_REPORTS_HIDE = 3;
/** How long the client keeps a board it has read before it asks again (PROF0 19: "a 60-second cache"). */
export const BOARD_CACHE_MS = 60_000;

/**
 * THE ONE BUTTON a note may carry (PROF0 10.6). Each is a way to answer the author, and each answers through a door
 * that already stands - nothing here is a new power:
 *   party - "Ask to join": a letter to the author asking for a party invitation (MAIL1); the author invites from the
 *           social panel as ever (SOC1's party.invite is the inviter's act, never the joiner's).
 *   guild - "Ask to join": a letter to the author asking for their guild's invitation (GUILD1: a member invites by
 *           handle; a guild has no application).
 *   duel  - "Challenge": DUEL1's own challenge, when the author is in the reader's room; otherwise a letter.
 *   commission - PROF6 (section 11, Professions-Arc 28): a crafter's advertisement - the board's Work tab opens its
 *           commission form with the author named (writLaw.js; the commission is the reader's to post).
 */
export const NOTE_BUTTONS = Object.freeze(['party', 'guild', 'duel', 'commission']);
/** The words each button wears. */
export const NOTE_BUTTON_LABEL = Object.freeze({
  party: 'Ask to join the party', guild: 'Ask to join the guild', duel: 'Challenge to a duel', commission: 'Commission a piece',
});

/** The switch the service's config holds (BOARD_OPEN): off, dev (the developers alone), on. */
export const BOARD_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const boardSwitchOf = (v) => (BOARD_SWITCH.includes(v) ? v : 'off');

/** A town's key: an unsigned 32-bit map id. */
export const boardKeyOk = (k) => Number.isSafeInteger(k) && k >= 0 && k <= 0xffffffff;
/** A note's id (accounts.js mintId's shape, as a letter's). */
export const NOTE_ID_RE = /^[A-Za-z0-9_-]{16,40}$/;
/** A request id, so a pin whose answer was lost and asked again is the same note, never two (ASYNC NEVER DROPS). */
export const BOARD_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;

/**
 * A note as the service keeps it, checked: its words (letterWords), its days and its button - or the ONE word that
 * refuses it. Each refusal is spelled `return { error: '...' }` so test/accountflow.test.js can walk this file for the
 * words the service answers with.
 * @param {{ subject?: unknown, body?: unknown, days?: unknown, button?: unknown }} note
 * @returns {{ subject: string, body: string, days: number, button: string|null } | { error: string }}
 */
export function noteWords({ subject, body, days, button } = {}) {
  const words = letterWords({ subject, body });
  if ('error' in words) return words;
  if (!NOTE_DAYS.includes(/** @type {number} */ (days))) return { error: 'bad-note-days' };
  if (button != null && !NOTE_BUTTONS.includes(/** @type {string} */ (button))) return { error: 'bad-note-button' };
  return { ...words, days: /** @type {number} */ (days), button: /** @type {string|null} */ (button ?? null) };
}

/**
 * A server notice's words and life, checked (the developers' - PROF0 10.1's red seal).
 * @param {{ subject?: unknown, body?: unknown, days?: unknown }} notice
 * @returns {{ subject: string, body: string, days: number } | { error: string }}
 */
export function noticeWords({ subject, body, days } = {}) {
  const words = letterWords({ subject, body });
  if ('error' in words) return words;
  if (!Number.isSafeInteger(days) || /** @type {number} */ (days) < 1 || /** @type {number} */ (days) > NOTICE_DAYS_MAX) return { error: 'bad-notice-days' };
  return { ...words, days: /** @type {number} */ (days) };
}

/** Whether a note is new to a reader who last read its board at `seenAt` (unix seconds; null never). */
export const noteIsNew = (note, seenAt) => Number.isFinite(note?.at) && (seenAt == null || note.at > seenAt);
/** The count that floats over a board: its notes and notices a reader has not seen. */
export function unseenCount(board, seenAt) {
  let n = 0;
  for (const x of [...(board?.notices ?? []), ...(board?.notes ?? [])]) if (noteIsNew(x, seenAt)) n++;
  return n;
}
/** "3 new" - or '' for none. */
export const unseenText = (n) => (n > 0 ? `${n} new` : '');

/**
 * AUDIT 28 N15: THE SUBJECT OF A LETTER ANSWERING A NOTE - "Re: " and the note's, NEVER CUT (MAIL1's law: a subject is
 * refused past its bound, never shortened): a subject that already answers something, or one "Re: " would carry past
 * the bound, is the note's own, whole.
 */
export function noteReplySubject(subject) {
  const s = String(subject ?? '');
  if (/^re:/i.test(s.trim())) return s;
  const re = `Re: ${s}`;
  return re.length <= LETTER_SUBJECT_MAX ? re : s;
}

/**
 * GUILD1e (2026-09-30, Mac: "Finish the seats"; Seats-Arc 8.2: "the hall carries ... a private guild board (the board's
 * Guilds tab, members only)"; PROF0 10.1's Guilds tab: "a guild's own notes, members only"). A GUILD'S NOTES are the
 * guild's, not a town's: read on the Guilds tab of any Notice Board and at the board standing in the guild's hall, by
 * its members alone. A note is a letter pinned up, as a town's is (noteWords, no button - a guild's members answer one
 * another in its chat); each member's live notes are bounded apart from the town boards' (a guild's word never takes
 * the place of a town's), and the board shows its newest.
 */
export const GUILD_NOTES_LIVE_MAX = 3;
export const GUILD_NOTES_SHOWN = 30;
/**
 * A guild note's words and days, checked - noteWords' law, with no button.
 * @param {{ subject?: unknown, body?: unknown, days?: unknown }} [note]
 */
export const guildNoteWords = ({ subject, body, days } = {}) => noteWords({ subject, body, days, button: null });

/** What the Notices tab pins under the rumour in a town that has a bounty board (PROF0 10.1, DECIDED). */
export const BOUNTY_BOARD_LINE = "The town's bounties are posted on its Bounty Board.";
