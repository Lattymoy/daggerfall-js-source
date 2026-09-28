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
import { tagOf, inEarshot } from './chat.js';
import { sanitizeName, readBadge, readGuildTag } from './wire.js';   // GUILD1c: a row's guild tag, through the wire's own reader

/** How many rows the panel will hold. The relay's own ROSTER_MAX
 *  bounds what a room reports; this is the drawing's own ceiling, so
 *  a room that somehow reported more cannot make the panel unbounded.
 *  Above it the list is cut and the count still tells the truth. */
export const ROSTER_ROWS_MAX = 200;

/**
 * One drawn row: the id it is keyed by, the name as the wire allows it,
 * the tag the chat lines already show beside a name, and whether it is
 * the player's own.
 * @typedef {{ id: string, name: string, tag: string, me: boolean, title?: string|null, glyphs?: string[], gt?: string|null }} RosterRow
 */

/**
 * What a roster is read off: an `OnlineSession`, or anything carrying
 * the same three. Every field is optional because a session that has
 * not opened yet has none of them, and that is a roster of ONE rather
 * than an error.
 * CHAT-CHAN: `label` is what the list is OF - the heading's word ("Online" when none is said: the World channel, whose
 * members are everyone online). A channel tab that is not a room of its own hands a source composed for it (the
 * Party tab its party, the Local tab those in earshot) and names it.
 * `title` and `glyphs` are my own badge (ACC3c: the relay never sends me my own row), read by the wire's readBadge.
 * @typedef {{ id?: string|null, name?: string|null, title?: any, glyphs?: any, gt?: string|null,
 *             peers?: Map<string, { id?: string|null, name?: string|null, gt?: string|null }>|null,
 *             roomCount?: number|null, label?: string|null }} RosterSource
 */

/**
 * The rows the panel draws, in order.
 *
 * `total` counts everyone the room reports and `shown` what survived
 * the cap, so a cut list can say so rather than quietly lying about
 * how busy it is.
 *
 * @param {RosterSource|null|undefined} session
 * @returns {{ rows: RosterRow[], total: number, shown: number, label: string }}
 */
export function rosterRows(session) {
  /** @type {RosterRow[]} */
  const rows = [];
  const seen = new Set();
  /** @param {string|null|undefined} id @param {string|null|undefined} name @param {boolean} me */
  const push = (id, name, me, from = null) => {
    if (id == null || seen.has(id)) return;
    seen.add(id);
    // ACC3c: THE BADGE COMES ALONG, through the wire's own reader - the
    // roster is a list of NAMES and a name wears a title everywhere
    // else it is drawn, so a bare one here is the same name saying two
    // different things on one screen. `readBadge` rather than a second
    // spelling of the vocabulary check, for the reason it exists.
    rows.push({ id, name: sanitizeName(name), tag: tagOf(id), me, ...readBadge(from), gt: readGuildTag(from) });   // GUILD1c: and the guild's tag, through the wire's own reader
  };
  // ME FIRST into the list, though not first in the ORDER - the sort
  // below puts the player wherever their name falls, because a roster
  // that pins you to the top is a roster you cannot find yourself in
  // by reading. The row is marked instead.
  // MY OWN ROW WEARS MY OWN BADGE, and the session is where it lands:
  // the relay never sends me my own roster entry, so without this the
  // one name a player looks at most is the one name with no title on
  // it (ACC1d-MARK's shape, again - a signal true for everybody but
  // you reads as a fault in your own account).
  push(session?.id ?? null, session?.name ?? '', true, session);
  for (const p of session?.peers?.values?.() ?? []) push(p?.id ?? null, p?.name ?? '', false, p);

  rows.sort((a, b) => {
    const n = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    return n !== 0 ? n : (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0);
  });
  // ROSTER-G: the count is the ROOM's when the relay said it (`n` on a channel's welcome) - a welcome list cut at
  // CHAT_ROSTER_MAX still says how many are online; a place's welcome says no `n`, and the rows are the count
  const n = Number(session?.roomCount);
  const total = Number.isFinite(n) && n > rows.length ? n : rows.length;
  const label = typeof session?.label === 'string' && session.label ? session.label : 'Online';
  return { rows: rows.slice(0, ROSTER_ROWS_MAX), total, shown: Math.min(rows.length, ROSTER_ROWS_MAX), label };
}

/** The heading the panel shows: "Online - 3". A roster of one is
 *  still a number, because "Online" alone reads like a label for a
 *  list that failed to load. CHAT-CHAN: the word is the list's own
 *  (`label` - "Party - 2", "Nearby - 1", "Wayrest - 7"). */
export const rosterTitle = (total, label = 'Online') => `${label} — ${total}`;

/**
 * CHAT-CHAN: THE PARTY TAB'S LIST - the party is not a room, so its roster is composed: my own row (the hub link's,
 * wearing my badge), and each party mate who is online, by the first tab they stand as - the peer id the hub names
 * them by, so the row's badge and its menu are the same peer the World roster offers. A mate the hub knows no badge
 * for is drawn by name alone. Null party: a list of one (the strip under the chat says why).
 * @param {{ members?: { acct: string, name?: string, online?: boolean, peers?: string[] }[] }|null|undefined} party
 * @param {RosterSource|null|undefined} hub   the World tab's link
 * @param {string|null} acct   my account
 * @returns {RosterSource}
 */
export function partyRosterSource(party, hub, acct) {
  const peers = new Map();
  for (const m of party?.members ?? []) {
    if (!m || m.acct === acct || !Array.isArray(m.peers) || !m.peers.length) continue;   // a mate with no tab standing is not online (the hub's row: `online` IS its tabs)
    const id = m.peers[0];
    const known = hub?.peers?.get?.(id) ?? null;
    peers.set(id, { ...(known ?? {}), id, name: m.name ?? known?.name ?? '' });
  }
  return { id: hub?.id ?? null, name: hub?.name ?? '', title: hub?.title ?? null, glyphs: hub?.glyphs ?? null, gt: hub?.gt ?? null, peers, label: 'Party' };
}

/**
 * GUILD1c: THE GUILD TAB'S LIST - the guild is not a room either, so its roster is composed: my own row (the hub link's,
 * wearing my badge), and every peer the hub link knows wearing my guild's TAG - the World roster's own peers, so a row's
 * badge and its menu are the same peer the World tab offers (a tag is one guild's: the service holds tags unique). The
 * hub introduces at most CHAT_ROSTER_MAX to a welcome, so a member it never introduced is not listed - their lines still
 * arrive. No tag: a list of one (the strip under the chat says why).
 * @param {RosterSource|null|undefined} hub   the World tab's link
 * @param {string|null} tag   my guild's tag
 * @returns {RosterSource}
 */
export function guildRosterSource(hub, tag) {
  const peers = new Map();
  if (tag) for (const [id, p] of hub?.peers ?? []) if (p?.gt === tag) peers.set(id, p);
  return { id: hub?.id ?? null, name: hub?.name ?? '', title: hub?.title ?? null, glyphs: hub?.glyphs ?? null, gt: hub?.gt ?? null, peers, label: 'Guild' };
}

/**
 * CHAT-CHAN: THE LOCAL TAB'S LIST - who would hear a line said now: the presence session's peers this host can place
 * (`near`, the host's peersNear) within earshot of `here` (net/chat.js inEarshot, the law a heard line is kept by).
 * @param {RosterSource|null|undefined} session   the presence session
 * @param {{ id: string, feet: number[] }[]|null|undefined} near
 * @param {number[]|null|undefined} here
 * @returns {RosterSource}
 */
export function localRosterSource(session, near, here) {
  const peers = new Map();
  for (const p of near ?? []) {
    if (!p || !inEarshot(here, p.feet)) continue;
    const known = session?.peers?.get?.(p.id);
    if (known) peers.set(p.id, known);
  }
  return { id: session?.id ?? null, name: session?.name ?? '', title: session?.title ?? null, glyphs: session?.glyphs ?? null, gt: session?.gt ?? null, peers, label: 'Nearby' };   // GUILD1c: my own row wears my tag
}
