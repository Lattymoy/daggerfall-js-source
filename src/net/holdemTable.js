// @ts-check
// CARDS5 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 17; Mac: "Do 3 4 and 5"): THE RELAY'S CARD TABLE -
// pure, DOM-free and plain-data (the relay checkpoints it whole), one home for the relay and its pins. Section 5's
// decisions, built: THE RELAY SHUFFLES (its own CSPRNG, handed in as `rand32` - shuffleDeck over the dice's unbiased
// draw) and keeps the deck in this state, which no frame ever carries; THE RELAY RUNS THE TABLE (whose turn, the legal
// actions, the pots - the cards' law, net/cardLaw.js); each seat is told ITS OWN hole cards in a frame addressed to it
// alone, the room the public hand (viewFor's spectator's view: no hand until a showdown shows it, a folded hand never);
// a seat that does not act in HOLDEM_CLOCK_MS is checked if it can be, folded if not (cardLaw timeoutAction); a seat
// whose player leaves is folded out of turn (cardLaw foldSeat) and stood up at the hand's end.
//
// A TABLE'S SEATS ARE ITS CHAIRS. The client names the chair it took (world/cardTables.js cardTableSeats - the same
// room, the same chairs, on every client), so the seat a frame names is a chair every eye at the table maps alike, and
// the hand's `seed` (drawn here) is the cloth's - the room sees one picture (section 3).
//
// FRIENDLY. A table the realm service does not escrow plays for no gold (section 5): every seat sits with
// HOLDEM_CHIPS_BB big blinds of chips, and a seat out of them stands up at the hand's end. Gold is CARDS6's.
//
// Every operation mutates the table it is handed and answers the messages it owes - `{to, frame}`, `to` null for the
// room or a player's id for that player alone; the relay stamps each with `t: 'holdem'`, the table's index and its clock.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { newHand, act, foldSeat, legalActions, viewFor, timeoutAction, shuffleDeck, HOLDEM_SEATS_MIN, HOLDEM_SEATS_MAX } from './cardLaw.js';

/** MEASURE (CARDS5, section 5's 30 s): a seat's clock - checked if it can be, folded if not, when it runs out. */
export const HOLDEM_CLOCK_MS = 30000;
/** MEASURE (CARDS5): the pause after a hand before the next deal; and a table's first deal after its second seat. */
export const HOLDEM_GAP_MS = 4000;
export const HOLDEM_FIRST_MS = 2500;
/** The friendly table's chips: a stake to play with, never gold. */
export const HOLDEM_CHIPS_BB = 100;
/** The big blinds a table may be opened at - the taverns' own stakes (systems/cardTableSession.js TABLE_STAKES; a pin
 *  holds the two alike - this file is the relay's and imports nothing of the client's). */
export const HOLDEM_BBS = Object.freeze([2, 10, 50]);
/** The tables one room keeps, and a seat's name's longest. */
export const HOLDEM_TABLES_MAX = 16;
export const HOLDEM_NAME_MAX = 40;

/** A seat's chips and hand in the room's frame: what anyone at the table may see. */
const seatView = (s) => (s ? { id: s.id, name: s.name, stack: s.stack, ...(s.leaving ? { leaving: true } : {}) } : null);

/**
 * A new table of `chairs` (2..6) at big blind `bb` (one of HOLDEM_BBS), or null.
 * @param {{chairs: number, bb: number}} p
 */
export function newTable({ chairs, bb }) {
  if (!Number.isInteger(chairs) || chairs < HOLDEM_SEATS_MIN || chairs > HOLDEM_SEATS_MAX || !HOLDEM_BBS.includes(bb)) return null;
  return {
    chairs, bb, sb: Math.max(1, Math.floor(bb / 2)),
    seats: /** @type {any[]} */ (Array.from({ length: chairs }, () => null)),
    hand: /** @type {any} */ (null), handSeats: /** @type {number[]} */ ([]), handNo: 0, button: -1, seed: 0,
    nextDealAt: 0, clockAt: 0, last: /** @type {any} */ (null),
  };
}

/** The room's view of the table: the seats, the button, the hand as a spectator sees it, the clock, the last showdown. */
export function publicView(t) {
  return {
    chairs: t.chairs, bb: t.bb, sb: t.sb, handNo: t.handNo, button: t.button, seed: t.seed,
    seats: t.seats.map(seatView), handSeats: t.handSeats.slice(),
    hand: t.hand ? viewFor(t.hand, -1) : null, clockAt: t.hand && t.hand.toAct >= 0 ? t.clockAt : 0, last: t.last,
  };
}

/** The chair a player sits in at this table, or -1. */
export const chairOf = (t, id) => t.seats.findIndex((s) => s && s.id === id);
/** The chairs that can play the next hand: chips, and not leaving. */
const liveChairs = (t) => t.seats.flatMap((s, i) => (s && s.stack > 0 && !s.leaving ? [i] : []));

/** The room's message: the events and the table as it now stands. */
const room = (t, events) => ({ to: null, frame: { events, state: publicView(t) } });   // `state`, never `table` - the relay's frame names the table's index `table`

/** The seat to act's own message: what it may do, and until when. */
function turnOf(t) {
  if (!t.hand || t.hand.toAct < 0) return [];
  const chair = t.handSeats[t.hand.toAct];
  return [{ to: t.seats[chair].id, frame: { turn: { handNo: t.handNo, legal: legalActions(t.hand, t.hand.toAct), clockAt: t.clockAt } } }];
}

/**
 * After an action or the deal: every street crossed said, the hand's end settled - the chips home, the showdown kept,
 * the leavers and the broke stood up - else the next seat's clock started. Answers the events.
 */
function after(t, prev, now) {
  const h = t.hand, events = [];
  const from = prev ? prev.board.length : 0;
  for (const len of [3, 4, 5]) if (from < len && h.board.length >= len) events.push({ t: 'street', street: { 3: 'flop', 4: 'turn', 5: 'river' }[len], board: h.board.slice(0, len), at: now });
  if (!h.result) { t.clockAt = now + HOLDEM_CLOCK_MS; return events; }
  h.seats.forEach((s, k) => { const seat = t.seats[t.handSeats[k]]; if (seat) seat.stack = s.stack; });
  const end = { t: 'showdown', hand: t.handNo, seats: t.handSeats.slice(), result: structuredClone(h.result), board: h.board.slice(), holes: viewFor(h, -1).seats.map((s) => s.hole), at: now };
  events.push(end);
  t.last = end;
  t.seats.forEach((s, i) => {
    if (s && (s.leaving || s.stack <= 0)) { events.push({ t: 'leave', seat: i, name: s.name, broke: !s.leaving, at: now }); t.seats[i] = null; }
  });
  t.hand = null;
  t.handSeats = [];
  t.clockAt = 0;
  t.nextDealAt = now + HOLDEM_GAP_MS;
  return events;
}

/** The next hand, if two seats can play it: the button on, the relay's shuffle, the holes to their seats alone. */
function deal(t, now, rand32) {
  const live = liveChairs(t);
  if (live.length < HOLDEM_SEATS_MIN) return [];
  const at = live.findIndex((i) => i > t.button);
  t.button = live[at < 0 ? 0 : at];
  t.handSeats = live;
  t.handNo++;
  t.seed = rand32() >>> 0;
  t.last = null;
  t.hand = newHand({ seats: live.map((i) => ({ id: t.seats[i].id, stack: t.seats[i].stack })), button: live.indexOf(t.button), sb: t.sb, bb: t.bb, deck: shuffleDeck(rand32) });
  const events = [{ t: 'hand', hand: t.handNo, button: t.button, seats: live.slice(), seed: t.seed, at: now }];
  const holes = t.hand.seats.map((s, k) => ({ to: t.seats[live[k]].id, frame: { hole: { handNo: t.handNo, cards: s.hole.slice() } } }));
  events.push(...after(t, null, now));
  return [...holes, room(t, events), ...turnOf(t)];
}

/**
 * A player sits in `chair` with the friendly chips. Answers the messages, or an error word.
 * @param {any} t @param {{id: string, name: string, chair: number, now: number}} p
 */
export function sit(t, { id, name, chair, now }) {
  if (!Number.isInteger(chair) || chair < 0 || chair >= t.chairs) return 'no such chair';
  if (t.seats[chair]) return 'taken';
  if (chairOf(t, id) >= 0) return 'seated';
  t.seats[chair] = { id, name: String(name ?? '').slice(0, HOLDEM_NAME_MAX), stack: HOLDEM_CHIPS_BB * t.bb };
  if (!t.hand && liveChairs(t).length === HOLDEM_SEATS_MIN) t.nextDealAt = Math.max(t.nextDealAt, now + HOLDEM_FIRST_MS);
  return [room(t, [{ t: 'sit', seat: chair, name: t.seats[chair].name, at: now }])];
}

/**
 * A player stands (or leaves the room): folded out of turn if a hand holds him, stood up at its end; at once if not.
 * Answers the messages - none when he was not seated.
 * @param {any} t @param {{id: string, now: number}} p
 */
export function stand(t, { id, now }) {
  const chair = chairOf(t, id);
  if (chair < 0) return [];
  const k = t.hand ? t.handSeats.indexOf(chair) : -1;
  if (k < 0) {
    const name = t.seats[chair].name;
    t.seats[chair] = null;
    return [room(t, [{ t: 'leave', seat: chair, name, broke: false, at: now }])];
  }
  t.seats[chair].leaving = true;
  if (t.hand.seats[k].folded) return [room(t, [])];
  const prev = t.hand;
  t.hand = foldSeat(prev, k);
  const events = [{ t: 'act', seat: chair, type: 'fold', to: null, paid: 0, at: now }, ...after(t, prev, now)];
  return [room(t, events), ...turnOf(t)];
}

/** One action at the hand by the seat to act - the law's. */
function play(t, k, action, now, extra = {}) {
  const prev = t.hand;
  const next = act(prev, k, action);
  if (!next) return null;
  t.hand = next;
  const chair = t.handSeats[k];
  const paid = next.seats[k].total - prev.seats[k].total;
  const events = [{ t: 'act', seat: chair, type: action.type, to: action.type === 'raise' ? action.to : null, paid, bet: action.type === 'raise' && prev.currentBet === 0, allIn: next.seats[k].allIn && !prev.seats[k].allIn, at: now, ...extra }, ...after(t, prev, now)];
  return [room(t, events), ...turnOf(t)];
}

/**
 * The seat to act acts. Answers the messages, or an error word (not his turn, or the law refuses it).
 * @param {any} t @param {{id: string, action: {type: string, to?: number}, now: number}} p
 */
export function actAt(t, { id, action, now }) {
  if (!t.hand || t.hand.toAct < 0) return 'no hand';
  const k = t.hand.toAct;
  if (t.seats[t.handSeats[k]]?.id !== id) return 'not your turn';
  return play(t, k, action, now) ?? 'refused';
}

/**
 * The clock: a seat whose time ran out is checked or folded; a table between hands deals when its pause is over.
 * Answers the messages (none when nothing was due).
 * @param {any} t @param {number} now @param {() => number} rand32
 */
export function tick(t, now, rand32) {
  if (t.hand) {
    if (t.hand.toAct < 0 || now < t.clockAt) return [];
    const a = timeoutAction(t.hand);
    return a ? play(t, t.hand.toAct, a, now, { timeout: true }) ?? [] : [];
  }
  return now >= t.nextDealAt ? deal(t, now, rand32) : [];
}

/** The clock the table next needs the relay's attention at, or null when nothing is due (fewer than two to play). */
export function nextAt(t) {
  if (t.hand) return t.hand.toAct >= 0 ? t.clockAt : null;
  return liveChairs(t).length >= HOLDEM_SEATS_MIN ? t.nextDealAt : null;
}

/** True when nobody sits at the table - the room forgets it. */
export const emptyTable = (t) => t.seats.every((s) => !s);

/** What a player newly come to the room (or asking) is owed: the table as the room sees it, and his own hole cards and
 *  turn if he holds a seat in the hand. */
export function tableLook(t, id, now) {
  const out = /** @type {any[]} */ ([{ to: id, frame: { events: [], state: publicView(t) } }]);
  const chair = chairOf(t, id);
  const k = t.hand && chair >= 0 ? t.handSeats.indexOf(chair) : -1;
  if (k >= 0) {
    out.push({ to: id, frame: { hole: { handNo: t.handNo, cards: t.hand.seats[k].hole.slice() } } });
    if (t.hand.toAct === k) out.push(...turnOf(t));
  }
  void now;
  return out;
}

const HOLDEM_OPS = Object.freeze(['sit', 'stand', 'act', 'look']);
const ACTION_TYPES = Object.freeze(['fold', 'check', 'call', 'raise']);
const chipsOk = (n) => Number.isSafeInteger(n) && n >= 0;

/**
 * A client's word to the table, checked: `{op, table, chair?, chairs?, bb?, action?}` or null. `sit` names the chair it
 * takes, the table's chairs and its stakes (the table opens at them; a table already open keeps its own); `act` the
 * law's action; `stand` and `look` the table alone.
 * @param {any} m
 */
export function validHoldemIn(m) {
  if (!m || typeof m !== 'object' || !HOLDEM_OPS.includes(m.op)) return null;
  if (!Number.isInteger(m.table) || m.table < 0 || m.table >= HOLDEM_TABLES_MAX) return null;
  if (m.op === 'sit') {
    if (!Number.isInteger(m.chair) || m.chair < 0 || m.chair >= HOLDEM_SEATS_MAX) return null;
    if (!Number.isInteger(m.chairs) || m.chairs < HOLDEM_SEATS_MIN || m.chairs > HOLDEM_SEATS_MAX || m.chair >= m.chairs) return null;
    if (!HOLDEM_BBS.includes(m.bb)) return null;
    return { op: 'sit', table: m.table, chair: m.chair, chairs: m.chairs, bb: m.bb };
  }
  if (m.op === 'act') {
    const a = m.action;
    if (!a || typeof a !== 'object' || !ACTION_TYPES.includes(a.type)) return null;
    if (a.type === 'raise' && !chipsOk(a.to)) return null;
    return { op: 'act', table: m.table, action: a.type === 'raise' ? { type: 'raise', to: a.to } : { type: a.type } };
  }
  return { op: m.op, table: m.table };
}

/**
 * The relay's word from a table, checked on the client: a table index and one of the room's `events` with the table's
 * `state` as it stands, a seat's own `hole` cards, or its `turn` (the legal actions and the clock). True or false.
 * @param {any} m
 */
export function validHoldemOut(m) {
  if (!m || typeof m !== 'object' || !Number.isInteger(m.table) || m.table < 0 || m.table >= HOLDEM_TABLES_MAX) return false;
  if (typeof m.error === 'string') return m.error.length <= 40;   // the relay's refusal of a word (a chair taken, not your turn)
  if (m.hole) return Number.isInteger(m.hole.handNo) && Array.isArray(m.hole.cards) && m.hole.cards.length === 2 && m.hole.cards.every((c) => Number.isInteger(c) && c >= 0 && c < 52);
  if (m.turn) return Number.isInteger(m.turn.handNo) && !!m.turn.legal && typeof m.turn.legal === 'object' && Number.isFinite(m.turn.clockAt);
  if (!Array.isArray(m.events) || m.events.length > 32 || !m.state || typeof m.state !== 'object') return false;
  const t = m.state;
  return Number.isInteger(t.chairs) && t.chairs >= HOLDEM_SEATS_MIN && t.chairs <= HOLDEM_SEATS_MAX && Array.isArray(t.seats) && t.seats.length === t.chairs
    && t.seats.every((s) => s === null || (s && typeof s.id === 'string' && typeof s.name === 'string' && chipsOk(s.stack)))
    && HOLDEM_BBS.includes(t.bb) && m.events.every((e) => e && typeof e.t === 'string');
}
