// @ts-check
// CHAT-R1 (2026-09-16, Mac: "an attached sidepanel on the chat ui
// showing all currently online players in alphabetical order.
// Scrollable"): WHO IS HERE, and in what order.
//
// The session already keeps the answer - `OnlineSession.peers`, a Map
// of id -> { id, name, ... } merged over every room it holds
// (WORLD6b-iii(b)) - and the panel already knows how to draw a name
// and its tag. What was missing is the bit between: a stable ORDER,
// and the player's own row among the others.
//
// PURE, and that is the point rather than a convenience. The panel is
// DOM and the session is a socket; the ordering law is neither, so it
// is pinned here by driving it with plain objects and no browser at
// all - which is what lets the awkward cases (two players called Bob,
// a name that is only spaces, a peer that arrives mid-sort) be
// written down as tests instead of as hopes.
//
// THE ORDER, and why each clause is there:
//   - by NAME, case-insensitively and NUMERICALLY, so `bob` sits with
//     `Bob` and `Player10` sits after `Player9` rather than between
//     `Player1` and `Player2`. `localeCompare` with `numeric` and
//     `sensitivity: 'base'` is one call for both. Note what `base` is
//     really doing here: it makes `bob` and `Bob` compare EQUAL, which
//     is what hands the decision to the tag clause below and makes the
//     order the same every time.
//
//     AUDIT-CHATR: this comment used to add "and it puts accented names
//     where a reader looks for them (Ä with A)". It cannot. Every name
//     in a row has been through `sanitizeName`, which keeps printable
//     ASCII and nothing else, so an accent never survives to reach the
//     sort. A true statement about `localeCompare` was a false statement
//     about THIS call.
//   - then by TAG, because two players may share a name exactly - the
//     panel shows `#tag` beside it for that reason - and a sort that
//     left them in Map order would swap them whenever a pose arrived.
//     A list that reorders itself under a reader's cursor is the bug
//     this clause exists to prevent.
//
// Not a DFU member: Daggerfall Unity has no chat and no roster.
// Ledger A row (ONLINE).
import { tagOf } from './chat.js';
import { sanitizeName } from './wire.js';

/** How many rows the panel will hold. The relay's own ROSTER_MAX
 *  bounds what a room reports; this is the drawing's own ceiling, so
 *  a room that somehow reported more cannot make the panel unbounded.
 *  Above it the list is cut and the count still tells the truth. */
export const ROSTER_ROWS_MAX = 200;

/**
 * One drawn row: the id it is keyed by, the name as the wire allows it,
 * the tag the chat lines already show beside a name, and whether it is
 * the player's own.
 * @typedef {{ id: string, name: string, tag: string, me: boolean }} RosterRow
 */

/**
 * What a roster is read off: an `OnlineSession`, or anything carrying
 * the same three. Every field is optional because a session that has
 * not opened yet has none of them, and that is a roster of ONE rather
 * than an error.
 * @typedef {{ id?: string|null, name?: string|null,
 *             peers?: Map<string, { id?: string|null, name?: string|null }>|null,
 *             roomCount?: number|null }} RosterSource
 */

/**
 * The rows the panel draws, in order.
 *
 * `total` counts everyone the room reports and `shown` what survived
 * the cap, so a cut list can say so rather than quietly lying about
 * how busy it is.
 *
 * @param {RosterSource|null|undefined} session
 * @returns {{ rows: RosterRow[], total: number, shown: number }}
 */
export function rosterRows(session) {
  /** @type {RosterRow[]} */
  const rows = [];
  const seen = new Set();
  /** @param {string|null|undefined} id @param {string|null|undefined} name @param {boolean} me */
  const push = (id, name, me) => {
    if (id == null || seen.has(id)) return;
    seen.add(id);
    rows.push({ id, name: sanitizeName(name), tag: tagOf(id), me });
  };
  // ME FIRST into the list, though not first in the ORDER - the sort
  // below puts the player wherever their name falls, because a roster
  // that pins you to the top is a roster you cannot find yourself in
  // by reading. The row is marked instead.
  push(session?.id ?? null, session?.name ?? '', true);
  for (const p of session?.peers?.values?.() ?? []) push(p?.id ?? null, p?.name ?? '', false);

  rows.sort((a, b) => {
    const n = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    return n !== 0 ? n : (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0);
  });
  // ROSTER-G: the count is the ROOM's when the relay said it (`n` on a channel's welcome) - a welcome list cut at
  // CHAT_ROSTER_MAX still says how many are online; a place's welcome says no `n`, and the rows are the count
  const n = Number(session?.roomCount);
  const total = Number.isFinite(n) && n > rows.length ? n : rows.length;
  return { rows: rows.slice(0, ROSTER_ROWS_MAX), total, shown: Math.min(rows.length, ROSTER_ROWS_MAX) };
}

/** The heading the panel shows: "Online - 3". A roster of one is
 *  still a number, because "Online" alone reads like a label for a
 *  list that failed to load. */
export const rosterTitle = (total) => `Online — ${total}`;
