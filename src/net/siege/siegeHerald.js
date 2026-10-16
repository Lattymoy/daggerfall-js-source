// @ts-check
// AUDIT-SEATS G1 (2026-10-01, Mac: "Finish the seats"): THE BATTLES ANNOUNCED IN THE SERVER'S VOICE (bible/11-Multiplayer/
// Seats-Arc.md 6.3: "Announcements - in the server's voice (RED1's red text, and EVENT1's welcome record for late
// joiners), at the Turning and 24 hours, 1 hour and 5 minutes before: 'The Silver Hand <SH> has won the Right of Siege at
// Anticlere. The Ebon Oath <EO> holds its Charter. Battle is joined Wednesday at 20:00 UTC.'"). SEAT2a part one left them
// the relay half's; no relay keeps a clock of the week's battles, so they are this client's, CROWN2's red lines' way
// (net/townSeatBook.js sayRed): a timer off the seats' list.
//
// WHAT IT SAYS: each battle the list names this week at a seat this client's own derivation holds (a seat it lacks is
// never honoured), in its announcement's words (net/townSeatLaw.js battleAnnouncement), in red on every chat tab, at four
// marks - the Turning that placed it (its seat week's start), 24 hours, 1 hour and 5 minutes before battle is joined -
// and never once it is joined. ONCE A MARK A BATTLE A PAGE: a mark said is never said again however often the list is
// read; a page opened late (EVENT1's late joiner) hears the latest mark passed, once, and not the ones before it - the
// record, then the marks still to come. A line the chat cannot take yet (none made) is offered again the next second.
//
// THE SCHEDULE: the list names each battle's kind and two guilds but not its start (server-account/src/seatInfluence.js
// battlesOf - the rights, not the placed battles), so the start is read ONCE a seat a week from that seat's standings
// (`fight`: its start in seconds, `moved`, `state`) - or from the list itself, where it carries `startsAt`, which spares
// the read (asked of the service: AUDIT-SEATS's report). A void battle is never announced.
//
// Pure - the list, the read, the chat and the clock are handed in. Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
import { battleAnnouncement, seatWeekOf, seatWeekStartMs } from '../townSeatLaw.js';

/** How long before battle is joined each mark falls, ms - after the Turning's own. */
export const SIEGE_HERALD_BEFORE_MS = Object.freeze({ day: 24 * 3_600_000, hour: 3_600_000, five: 5 * 60_000 });
/** The marks, in order. */
export const SIEGE_HERALD_MARKS = Object.freeze(['turning', 'day', 'hour', 'five']);
/** How often the timer looks, ms. */
export const SIEGE_HERALD_TICK_MS = 1000;

/** A placed battle's announcement in its own words - the standings' `fight` carries its start in SECONDS (the service's
 *  `starts_at`), and the law's words read milliseconds. Null for none. */
export const fightAnnouncement = (f, seatName) => (f && Number.isFinite(f.startsAt) ? battleAnnouncement({ ...f, startsAt: f.startsAt * 1000 }, seatName) : null);

/** When each mark falls for a battle of seat week `week` joined at `startMs`: `[[mark, atMs], ...]` in SIEGE_HERALD_MARKS'
 *  order. @param {number} week @param {number} startMs @returns {Array<[string, number]>} */
export function heraldMarks(week, startMs) {
  return [['turning', seatWeekStartMs(week)], ['day', startMs - SIEGE_HERALD_BEFORE_MS.day], ['hour', startMs - SIEGE_HERALD_BEFORE_MS.hour], ['five', startMs - SIEGE_HERALD_BEFORE_MS.five]];
}
/** The latest mark passed at `nowMs` - its index in SIEGE_HERALD_MARKS - or -1: none passed yet, or battle joined. */
export function heraldDue(week, startMs, nowMs) {
  if (!(nowMs < startMs)) return -1;
  let due = -1, dueAt = -Infinity;
  heraldMarks(week, startMs).forEach(([, at], i) => { if (at <= nowMs && at >= dueAt) { due = i; dueAt = at; } });
  return due;
}

/**
 * THE HERALD. `seats()` the seats' list as last read (net/townSeatBook.js `data.seats` - each `{ key, battle }`), null
 * while the seats are shut; `fightOf(key)` a seat's placed battle (the standings' `fight`, or null); `nameOf(key)` the
 * seat's name in this client's own derivation (null: a seat it lacks); `say(text, atMs)` the line in red (false: no chat
 * yet); `nowMs()` the relay's clock. `tick()` each frame - it looks once a SIEGE_HERALD_TICK_MS.
 * @param {{ seats: () => any, fightOf: (key: number) => any, nameOf: (key: number) => (string|null), say: (text: string, atMs: number) => boolean, nowMs?: () => number }} deps
 */
export function createSiegeHerald({ seats, fightOf, nameOf, say, nowMs = () => Date.now() }) {
  /** @type {Map<number, { week: number, startMs: number|null, line: string|null }>} each battle seat's, this week */
  const known = new Map();
  /** @type {Map<string, number>} `${key}:${week}` -> the latest mark said this page */
  const said = new Map();
  let seen = null, lookedAt = -Infinity;
  /** A battle's schedule and words, from the standings' `fight` (or the list's own). */
  function fill(entry, f, name) {
    if (!f?.kind || !Number.isFinite(f.startsAt) || f.state === 'void') return;
    entry.startMs = f.startsAt * 1000;
    if (Number.isSafeInteger(f.week)) entry.week = f.week;
    entry.line = fightAnnouncement(f, name);
  }
  /** The list read afresh: each battle at a seat this client holds, its schedule asked once a seat a week. */
  function note(list, now) {
    if (!Array.isArray(list)) return;
    const week = seatWeekOf(now);
    const named = new Set(list.filter((s) => s?.battle).map((s) => s.key));
    for (const key of [...known.keys()]) if (!named.has(key)) known.delete(key);   // a battle the list no longer names is not announced
    for (const s of list) {
      if (!s?.battle || !Number.isSafeInteger(s.key)) continue;
      const name = nameOf(s.key);
      if (!name || known.get(s.key)?.week === week) continue;
      const entry = { week, startMs: null, line: null };
      known.set(s.key, entry);
      const b = s.battle;
      if (Number.isFinite(b.startsAt)) { fill(entry, { kind: b.kind, startsAt: b.startsAt, moved: b.moved, state: b.state, attackerGuild: b.guild, defenderGuild: b.against, week }, name); continue; }
      Promise.resolve().then(() => fightOf(s.key)).then((f) => { if (known.get(s.key) === entry) fill(entry, f, name); }, () => {});
    }
  }
  return {
    tick() {
      const now = nowMs();
      if (now - lookedAt < SIEGE_HERALD_TICK_MS) return;
      lookedAt = now;
      const list = seats();
      if (list !== seen) { seen = list; note(list, now); }
      for (const [key, e] of known) {
        if (!e.line || e.startMs == null) continue;
        const due = heraldDue(e.week, e.startMs, now);
        const id = `${key}:${e.week}`;
        if (due < 0 || (said.get(id) ?? -1) >= due) continue;
        if (say(e.line, heraldMarks(e.week, e.startMs)[due][1]) === false) continue;   // no chat yet: the next look offers it again
        said.set(id, due);
      }
    },
    /** What it knows, for the pins: each seat's `{ week, startMs, line }`. */
    get known() { return known; },
  };
}
