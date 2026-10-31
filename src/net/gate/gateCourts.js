// @ts-check
// GATE-COURTS (2026-10-26, the owner: "We need to develop instances for oblivion gate. The player counts are becoming
// too large for one instance"; asked, the owner chose fifty fighters a court, placed automatically with the party kept
// together, the gate in the world standing until every court's fight is over, and each court's kill said in the chat
// with the night said once on Discord - bible/11-Multiplayer/World-Bosses.md section 29): A NIGHT'S BURNING COURTS.
//
// A gate's night was ONE fight in one object (`gate:<day>`, GATE_FIGHTERS_MAX 256 seats, SCALE5d part two's copies past
// its sockets around that one fight). Now a night holds up to GATE_COURTS_MAX courts, each a fight of its own - its own
// Warden, health, phases, kill, receipts and spoils - in an object of its own: court 0 is `gate:<day>` as it always was,
// court k is `gate:<day>.<k>` (net/gate/gateLaw.js gateRoomKey). A court seats GATE_COURT_FIGHTERS; a party may run it
// GATE_PARTY_SLACK over to stand together.
//
// THE BOOK. Court 0's object keeps the night's seats - which court each account fights in - and nothing else decides it:
// every court asks the book before a newcomer joins its fight (server/src/index.js _gateSeatOf), so an account fights in
// one court a night and holds one receipt a night, as it always has. A newcomer comes to court 0 first; the book seats
// it in its party's court where one stands with room, else in the lowest court with room that has not won, and court 0
// answers `go` with the court when it is another (the page joins that court's room). The book hears each court's kill
// and says the night done once every court that seated a fighter has won after the seal - or at the wrath, if any did.
//
// PURE and a LEAF: no imports - the relay's bundle (net/wire.js, net/gate/gateLaw.js, server/src/index.js) reads it.
//
// Not a DFU member: Daggerfall has no other players and no world events. Ledger A (WB).

/** The fighters a court seats before the book opens the next (the owner's choice). */
export const GATE_COURT_FIGHTERS = 50;
/** The most courts a night opens - court indices 0 to GATE_COURTS_MAX - 1. GATE_COURTS_MAX x GATE_COURT_FIGHTERS fighters
 *  a night; past them a newcomer is the first court's watcher ('the court is full', COURT-WATCH - AUDIT GATE-COURTS C5: it
 *  stands at the door it asked at), as a full court's was. */
export const GATE_COURTS_MAX = 16;
/** How far over GATE_COURT_FIGHTERS a court seats a newcomer whose party fights there: a whole party (net/wire.js
 *  PARTY_MAX, 8 - pinned equal) stands in one court whoever of it came first. */
export const GATE_PARTY_SLACK = 7;
/** How long a seat the book gave but its court has not seen joined is held: a page sent on to its court that never
 *  arrives (a tab closed, a link lost) gives its seat back, so a court is never full of fighters who are not there. */
export const GATE_SEAT_PENDING_MS = 60_000;
/** AUDIT GATE-COURTS P10: how long the first court keeps an account's party as the hub said it - a full night's watcher
 *  asks for a seat every COURT_WATCH_ASK_MS, and asked the hub each time. */
export const GATE_MATES_KEEP_MS = 60_000;
/** AUDIT GATE-COURTS R3: how long past the wrath the book waits before it says a night some court won - a kill landed
 *  just before the wrath is told the book at the kill, inside one internal call (ROOM_CALL_MS's own scale), so its
 *  receipts are the book's before the rite's own are minted; under GATE_COLLAPSE_MS (10 s), when the night is forgotten,
 *  with a retry's room. */
export const GATE_NIGHT_GRACE_MS = 3_000;

/**
 * @typedef {[number, number, number]} GateSeat   [court, when the book gave it, 1 once its court saw it joined]
 * @typedef {{at: number, top: string[], n: number, rs: string[]}} GateCourtFall   a court's kill: when, its best three,
 *   its fighters, and the accounts it gave a receipt
 * @typedef {{d: number, s: Record<string, GateSeat>, f: Record<string, GateCourtFall>, end: number, told: number}} GateBook
 *   `end` the moment the night was said done (0 not yet), `told` 1 once the hub heard it
 */

/** A night's book, empty. @param {number} day @returns {GateBook} */
export const bookNew = (day) => ({ d: day, s: {}, f: {}, end: 0, told: 0 });

/** Is `b` a book - storage's own shape, read back after a wake? @param {any} b */
export const isGateBook = (b) => !!b && typeof b === 'object' && Number.isSafeInteger(b.d) && !!b.s && typeof b.s === 'object' && !!b.f && typeof b.f === 'object';

/** Is a court index a court's? @param {any} c */
export const courtOk = (c) => Number.isSafeInteger(c) && c >= 0 && c < GATE_COURTS_MAX;

/** Does a seat still count - joined, or given within GATE_SEAT_PENDING_MS? @param {GateSeat} s @param {number} now */
export const seatLive = (s, now) => s[2] === 1 || now - s[1] < GATE_SEAT_PENDING_MS;

/** Each court's live seats. @param {GateBook} book @param {number} now @returns {number[]} */
export function courtCounts(book, now) {
  const n = new Array(GATE_COURTS_MAX).fill(0);
  for (const s of Object.values(book.s)) if (seatLive(s, now)) n[s[0]]++;
  return n;
}

/** The courts a fighter has joined - the courts the night holds. @param {GateBook} book @returns {Set<number>} */
export const courtsJoined = (book) => new Set(Object.values(book.s).filter((s) => s[2] === 1).map((s) => s[0]));

/**
 * THE SEAT: the court `sub` fights in tonight, or null for none (every court that may take it is full, or the gate no
 * longer admits a newcomer). Records the seat it gives - JOINED only where the court that asked is its court and says its
 * fight takes a newcomer now (`can`: its Warden stands and the gate admits - AUDIT GATE-COURTS R4/C3: a seat marked
 * joined that no fight took held the night open to the wrath), else pending - and lets go of the pending seats that
 * lapsed.
 *   - A seat it holds is its court whatever that court did since (won, or full): one court a night. But a PENDING seat in
 *     a court that has won since is no seat (AUDIT GATE-COURTS R2/P5: the page was sent on to a Warden already fallen,
 *     whose court refuses it) - it is placed again, as a newcomer.
 *   - A newcomer (`admits` - the gate's window, net/gate/gateLaw.js gateAdmits) is seated in the lowest court where one
 *     of its party (`mates`, the hub's members) holds a live seat, that has not won and seats fewer than
 *     GATE_COURT_FIGHTERS + GATE_PARTY_SLACK; else in the lowest court that has not won and seats fewer than
 *     GATE_COURT_FIGHTERS.
 * @param {GateBook} book
 * @param {string} sub
 * @param {{asked: number, now: number, admits: boolean, can?: boolean, mates?: ReadonlyArray<string>}} o
 * @returns {number|null}
 */
export function placeSeat(book, sub, { asked, now, admits, can = false, mates = [] }) {
  for (const [k, s] of Object.entries(book.s)) if (k !== sub && !seatLive(s, now)) delete book.s[k];
  const had = book.s[sub];
  if (had && seatLive(had, now) && !(had[2] !== 1 && book.f[had[0]])) {
    if (had[0] === asked && can) had[2] = 1;
    return had[0];
  }
  if (!admits) return null;
  const n = courtCounts(book, now);
  const open = (c, cap) => !book.f[c] && n[c] < cap;
  let court = null;
  for (const m of mates) {
    const s = m !== sub ? book.s[m] : null;
    if (s && seatLive(s, now) && open(s[0], GATE_COURT_FIGHTERS + GATE_PARTY_SLACK) && (court === null || s[0] < court)) court = s[0];
  }
  for (let c = 0; court === null && c < GATE_COURTS_MAX; c++) if (open(c, GATE_COURT_FIGHTERS)) court = c;
  if (court === null) return null;
  book.s[sub] = [court, now, court === asked && can ? 1 : 0];
  return court;
}

/**
 * A court's kill, heard by the book (once a court - the first word kept, a court's own retries changing nothing).
 * @param {GateBook} book
 * @param {number} court
 * @param {GateCourtFall} fall
 */
export function courtFell(book, court, { at, top, n, rs }) {
  if (!courtOk(court) || book.f[court]) return;
  book.f[court] = { at, top: [...top], n, rs: [...rs] };
}

/**
 * IS THE NIGHT DONE? After the seal (no newcomer can open a court), once every court a fighter joined has won; or
 * GATE_NIGHT_GRACE_MS past the wrath, once any has (the rest are cast back with it). Never while a court that seated a
 * fighter still fights before the wrath - its gate stands in the world for it.
 * @param {GateBook} book
 * @param {number} now
 * @param {{sealAt: number, wrathAt: number}} t   the night's times (net/gate/gateLaw.js gateTimes)
 */
export function nightDone(book, now, t) {
  const won = Object.keys(book.f).length;
  if (!won) return false;
  if (now >= t.wrathAt + GATE_NIGHT_GRACE_MS) return true;
  if (now < t.sealAt) return false;
  for (const c of courtsJoined(book)) if (!book.f[c]) return false;
  return true;
}

/**
 * The night's word (the hub's `fell`, the herald's card): when it was said, the best three of the court that won first,
 * the fighters of every court that won, the courts that won (`w`) and the courts the night held (`cs`).
 * @param {GateBook} book
 * @param {number} at
 */
export function nightWord(book, at) {
  const falls = Object.values(book.f).sort((a, b) => a.at - b.at);
  return { at, top: falls[0]?.top ?? [], n: falls.reduce((s, f) => s + f.n, 0), w: falls.length, cs: Math.max(courtsJoined(book).size, falls.length) };
}

/**
 * WB12d's rite, under the courts: those who broke the faithful's rite and hold no court's receipt - each is owed a
 * receipt of the rite alone, minted once, at the night's end (a court still fighting could yet give one its own).
 * @param {GateBook} book
 * @param {Iterable<string>} helpers
 */
export function riteOnly(book, helpers) {
  const had = new Set(Object.values(book.f).flatMap((f) => f.rs));
  return [...new Set(helpers)].filter((h) => !had.has(h));
}

/** When the book next needs its beat: the seal, then the wrath's grace, while the night is not said done; null after.
 *  @param {GateBook} book @param {{sealAt: number, wrathAt: number}} t @param {number} now */
export const bookNextAt = (book, t, now) => (book.end ? null : now < t.sealAt ? t.sealAt : now < t.wrathAt + GATE_NIGHT_GRACE_MS ? t.wrathAt + GATE_NIGHT_GRACE_MS : null);

