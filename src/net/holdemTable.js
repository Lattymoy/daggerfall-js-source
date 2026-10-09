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
import { STAKE_ID_RE } from './identityToken.js';   // CARDS6: a stake's id, the service's shape

/** MEASURE (CARDS5, section 5's 30 s): a seat's clock - checked if it can be, folded if not, when it runs out. */
export const HOLDEM_CLOCK_MS = 30000;
/** MEASURE (CARDS5): the pause after a hand before the next deal; and a table's first deal after its second seat. */
export const HOLDEM_GAP_MS = 4000;
export const HOLDEM_FIRST_MS = 2500;
/** AUDIT CARDS-3 C4: each street an all-in's run-out turns at the hand's end lengthens that pause - the cloth lays it
 *  street by street (its throws, its turn) before the hands show and the pot goes home. */
export const HOLDEM_RUNOUT_MS = 1400;
/** The friendly table's chips: a stake to play with, never gold. */
export const HOLDEM_CHIPS_BB = 100;
/** The big blinds a table may be opened at - the taverns' own stakes (systems/cardTableSession.js TABLE_STAKES; a pin
 *  holds the two alike - this file is the relay's and imports nothing of the client's). */
export const HOLDEM_BBS = Object.freeze([2, 10, 50]);
/** The tables one room keeps, and a seat's name's longest. */
export const HOLDEM_TABLES_MAX = 16;
export const HOLDEM_NAME_MAX = 40;
/** TAVERN-TABLES (2026-10-09, bible/11-Multiplayer/Tavern-Cards.md section 30; the owner, told a tavern's one table
 *  locked out whoever its first sitter was not: "Two tables per tavern"): THE GOLD TABLE IS AN INDEX. A tavern stands
 *  two card tables (scenes/interiorContext.js) - the first, nearest the entrance, plays for chips and seats everyone; the
 *  second, at this index, plays for gold and seats only a realm character's stake. The relay holds every sit to it, so
 *  no first sitter decides what a table plays for (CARDS6 let him, and one guest's chips, or one idle realm character's
 *  stake, shut the other kind out of the room's only table). */
export const HOLDEM_GOLD_TABLE = 1;
/** TAVERN-TABLES: whether the room's table at `index` plays for gold. */
export const holdemGoldTable = (index) => index === HOLDEM_GOLD_TABLE;

/** A seat's chips and hand in the room's frame: what anyone at the table may see. */
const seatView = (s) => (s ? { id: s.id, name: s.name, stack: s.stack, ...(s.leaving ? { leaving: true } : {}) } : null);

/** CARDS6: a gold table's stake, in big blinds - the offline table's own buy-in (systems/cardTableSession.js
 *  BUY_IN_MIN_BB, BUY_IN_MAX_BB; equal by pin, the relay's bundle never carries the session). */
export const HOLDEM_STAKE_MIN_BB = 20;
export const HOLDEM_STAKE_MAX_BB = 100;
/** CARDS6 follow-up (Tavern-Cards section 24): the least a top-up adds, in big blinds - a seat tops up between hands to
 *  no more than HOLDEM_STAKE_MAX_BB. */
export const HOLDEM_TOPUP_MIN_BB = 5;
/** CARDS6: the most cash-outs a table keeps waiting for the relay to sign. */
export const HOLDEM_CASHOUTS_MAX = 64;

/**
 * A new table of `chairs` (2..6) at big blind `bb` (one of HOLDEM_BBS), or null. CARDS6: `gold`, its seats sit with a
 * stake the service holds (net/identityToken.js stake order) - every seat or none.
 * @param {{chairs: number, bb: number, gold?: boolean}} p
 */
export function newTable({ chairs, bb, gold = false }) {
  if (!Number.isInteger(chairs) || chairs < HOLDEM_SEATS_MIN || chairs > HOLDEM_SEATS_MAX || !HOLDEM_BBS.includes(bb)) return null;
  return {
    chairs, bb, sb: Math.max(1, Math.floor(bb / 2)), gold: !!gold,
    cashouts: /** @type {{to: string, j: string, s: string, r: number, w: string}[]} */ ([]),   // CARDS6: what staked seats left with, for the relay to sign
    seats: /** @type {any[]} */ (Array.from({ length: chairs }, () => null)),
    hand: /** @type {any} */ (null), handSeats: /** @type {number[]} */ ([]), handNo: 0, button: -1, seed: 0,
    nextDealAt: 0, clockAt: 0, last: /** @type {any} */ (null),
  };
}

/** The room's view of the table: the seats, the button, the hand as a spectator sees it, the clock, the last showdown. */
export function publicView(t) {
  return {
    chairs: t.chairs, bb: t.bb, sb: t.sb, gold: !!t.gold, handNo: t.handNo, button: t.button, seed: t.seed,
    seats: t.seats.map(seatView), handSeats: t.handSeats.slice(),
    hand: t.hand ? viewFor(t.hand, -1) : null, clockAt: t.hand && t.hand.toAct >= 0 ? t.clockAt : 0, last: t.last,
  };
}

/** CARDS-TIDY: the fields of a table as the room sees it (publicView's), each its own unit of a frame's delta. */
export const STATE_KEYS = Object.freeze(['chairs', 'bb', 'sb', 'gold', 'handNo', 'button', 'seed', 'seats', 'handSeats', 'hand', 'clockAt', 'last']);

/**
 * CARDS-TIDY: the relay's half of a room frame's delta - the fields of `state` that differ from `prev` (the last state
 * this room was told of this table), or null when the room was told none (a first frame, a wake: the whole state goes).
 * Lane E's measure: nine tenths of a frame was the same table again.
 * @param {any} prev @param {any} state
 */
export function stateDelta(prev, state) {
  if (!prev) return null;
  const d = {};
  for (const k of STATE_KEYS) if (JSON.stringify(prev[k]) !== JSON.stringify(state[k])) d[k] = state[k];
  return d;
}

/** CARDS6: a staked seat gone from the table - what it leaves with queued for the relay to sign (`t.cashouts`; kept with
 *  the table, so a hibernation between the stand and the signature loses nothing). */
function cashOut(t, seat) {
  if (!seat?.stake || seat.cashed) return;
  (t.cashouts ??= []).push({ to: seat.id, j: seat.stake, s: seat.sub, r: seat.stack, w: seat.stack > 0 ? 'stood' : 'broke' });
  if (t.cashouts.length > HOLDEM_CASHOUTS_MAX) t.cashouts.splice(0, t.cashouts.length - HOLDEM_CASHOUTS_MAX);
}

/** CARDS6: a staked leaver folded out of a hand that goes on - his stack behind is all he will ever have of it, so it
 *  is cashed out NOW (he is walking out of the room; at the hand's end he would be told nothing), never twice. */
function cashOutFolded(t, chair, k) {
  const seat = t.seats[chair];
  if (!seat?.stake || seat.cashed || !t.hand || t.handSeats[k] !== chair) return;
  (t.cashouts ??= []).push({ to: seat.id, j: seat.stake, s: seat.sub, r: t.hand.seats[k].stack, w: t.hand.seats[k].stack > 0 ? 'stood' : 'broke' });
  seat.cashed = true;
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
    if (s && (s.leaving || s.stack <= 0)) { events.push({ t: 'leave', seat: i, name: s.name, broke: s.stack <= 0, at: now }); cashOut(t, s); t.seats[i] = null; }
  });
  t.hand = null;
  t.handSeats = [];
  t.clockAt = 0;
  t.nextDealAt = now + HOLDEM_GAP_MS + HOLDEM_RUNOUT_MS * events.filter((e) => e.t === 'street').length;   // AUDIT CARDS-3 C4: a run-out's streets are on the cloth first
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
 * AUDIT CARDS-6 C2 (Iliac's iliacSitRefusal's twin): why `sit` would refuse this sit, or null when it would seat him
 * (his own chair taken back included) - pure, nothing moved, so the relay asks it BEFORE it spends the room's sit budget:
 * a socket sending sits refused 'taken' four a second kept every card table in the room 'busy' (AUDIT CARDS-3 A4's order).
 * @param {any} t @param {{id: string, chair: number, stake?: {j: string, sub: string, amount: number}|null}} p
 */
export function sitRefusal(t, { id, chair, stake = null }) {
  if (!Number.isInteger(chair) || chair < 0 || chair >= t.chairs) return 'no such chair';
  const mine = chairOf(t, id);
  if (mine >= 0 && t.seats[mine].leaving) return t.seats[mine].cashed ? 'cashed out' : null;   // CARDS6: his stack went home in a receipt - the chair is not his to play again
  if (!!t.gold !== !!stake) return t.gold ? 'gold table' : 'friendly table';   // CARDS6: every seat staked, or none
  if (t.seats[chair]) return 'taken';
  if (mine >= 0) return 'seated';
  if (stake && !(stake.amount >= HOLDEM_STAKE_MIN_BB * t.bb && stake.amount <= HOLDEM_STAKE_MAX_BB * t.bb)) return 'bad stake';
  return null;
}

/**
 * A player sits in `chair` with the friendly chips - CARDS6: or, at a gold table, with his stake (`{j, sub, amount}`,
 * the service's order the relay checked). Answers the messages, or an error word.
 * @param {any} t @param {{id: string, name: string, chair: number, now: number, stake?: {j: string, sub: string, amount: number}|null}} p
 */
export function sit(t, { id, name, chair, now, stake = null }) {
  const no = sitRefusal(t, { id, chair, stake });
  if (no) return no;
  // AUDIT CARDS-3 E-N1: a player whose socket dropped mid-hand is folded and marked leaving - back in the room, his sit
  // keeps his own chair (whichever he names): he plays the next hand, never 'taken' by his own ghost until this one ends.
  // CARDS6: at a gold table with the stake his seat already holds (the relay asks no stake of him again)
  const mine = chairOf(t, id);
  if (mine >= 0 && t.seats[mine].leaving) {
    delete t.seats[mine].leaving;
    if (!t.hand && liveChairs(t).length === HOLDEM_SEATS_MIN) t.nextDealAt = Math.max(t.nextDealAt, now + HOLDEM_FIRST_MS);
    return [room(t, [{ t: 'sit', seat: mine, name: t.seats[mine].name, at: now }])];
  }
  t.seats[chair] = { id, name: String(name ?? '').slice(0, HOLDEM_NAME_MAX), stack: stake ? stake.amount : HOLDEM_CHIPS_BB * t.bb, ...(stake ? { stake: stake.j, sub: stake.sub } : {}) };
  if (!t.hand && liveChairs(t).length === HOLDEM_SEATS_MIN) t.nextDealAt = Math.max(t.nextDealAt, now + HOLDEM_FIRST_MS);
  return [room(t, [{ t: 'sit', seat: chair, name: t.seats[chair].name, at: now }])];
}

/**
 * CARDS6 follow-up (section 24): THE TOP-UP - a gold table's seat adds a stake of its own account's to its stack, never
 * while a hand holds it (the chips in play are the hand's) and never past HOLDEM_STAKE_MAX_BB. `stake` `{ j, sub, amount
 * }`, its spend the relay's. `check` alone: the refusal word or null, nothing moved. Answers the messages, or a word.
 * @param {any} t @param {{id: string, stake: {j: string, sub: string, amount: number}, now: number}} p @param {boolean} [check]
 */
export function topUp(t, { id, stake, now }, check = false) {
  const chair = chairOf(t, id);
  const seat = chair >= 0 ? t.seats[chair] : null;
  if (!seat || seat.leaving) return 'not seated';
  if (!t.gold || !seat.stake) return 'friendly table';
  if (stake.sub !== seat.sub) return 'stake refused';
  if (t.hand && t.handSeats.includes(chair)) return 'in hand';
  if (!(stake.amount >= HOLDEM_TOPUP_MIN_BB * t.bb && seat.stack + stake.amount <= HOLDEM_STAKE_MAX_BB * t.bb)) return 'bad stake';
  if (check) return null;
  seat.stack += stake.amount;
  return [room(t, [{ t: 'topup', seat: chair, name: seat.name, amount: stake.amount, at: now }])];
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
    cashOut(t, t.seats[chair]);   // CARDS6
    t.seats[chair] = null;
    return [room(t, [{ t: 'leave', seat: chair, name, broke: false, at: now }])];
  }
  t.seats[chair].leaving = true;
  if (t.hand.seats[k].folded) { cashOutFolded(t, chair, k); return [room(t, [])]; }
  const prev = t.hand;
  t.hand = foldSeat(prev, k);
  const events = [{ t: 'act', seat: chair, type: 'fold', to: null, paid: 0, at: now }, ...after(t, prev, now)];
  cashOutFolded(t, chair, k);
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

const HOLDEM_OPS = Object.freeze(['sit', 'stand', 'act', 'look', 'void', 'ack', 'topup']);   // CARDS6: a stake never sat given back; a cash-out heard; a seat's top-up
/** CARDS6: the longest a stake order (or a receipt's id) may be on the wire. */
export const HOLDEM_STAKE_MAX = 1024;
const ACTION_TYPES = Object.freeze(['fold', 'check', 'call', 'raise']);
const chipsOk = (n) => Number.isSafeInteger(n) && n >= 0;
const stakeWordOk = (w) => typeof w === 'string' && w.length > 0 && w.length <= HOLDEM_STAKE_MAX;
const seatOk = (s) => s === null || (s && typeof s.id === 'string' && typeof s.name === 'string' && chipsOk(s.stack));

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
    if (m.stake !== undefined && !stakeWordOk(m.stake)) return null;
    return { op: 'sit', table: m.table, chair: m.chair, chairs: m.chairs, bb: m.bb, ...(m.stake !== undefined ? { stake: m.stake } : {}) };
  }
  if (m.op === 'void') return stakeWordOk(m.stake) ? { op: 'void', table: m.table, stake: m.stake } : null;   // CARDS6
  if (m.op === 'topup') return stakeWordOk(m.stake) ? { op: 'topup', table: m.table, stake: m.stake } : null;   // CARDS6 follow-up
  if (m.op === 'ack') return typeof m.j === 'string' && STAKE_ID_RE.test(m.j) ? { op: 'ack', table: m.table, j: m.j } : null;   // CARDS6
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
  if (m.n !== undefined && !(Number.isSafeInteger(m.n) && m.n >= 0)) return false;   // AUDIT CARDS-4 D1: the table's frame number
  if (m.cashout !== undefined) return typeof m.cashout === 'string' && m.cashout.length <= HOLDEM_STAKE_MAX;   // CARDS6: a staked seat's receipt (net/cardReceipt.js reads it)
  if (m.hole) return Number.isInteger(m.hole.handNo) && Array.isArray(m.hole.cards) && m.hole.cards.length === 2 && m.hole.cards.every((c) => Number.isInteger(c) && c >= 0 && c < 52);
  if (m.turn) return Number.isInteger(m.turn.handNo) && !!m.turn.legal && typeof m.turn.legal === 'object' && Number.isFinite(m.turn.clockAt);
  if (!Array.isArray(m.events) || m.events.length > 32 || !m.events.every((e) => e && typeof e.t === 'string')) return false;
  if (m.delta !== undefined) {
    // CARDS-TIDY: a delta - the changed fields alone, each as the whole state would have it (the client checks the merge)
    const d = m.delta;
    if (m.state !== undefined || !d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).some((k) => !STATE_KEYS.includes(k))) return false;
    if (d.chairs !== undefined && !(Number.isInteger(d.chairs) && d.chairs >= HOLDEM_SEATS_MIN && d.chairs <= HOLDEM_SEATS_MAX)) return false;
    if (d.bb !== undefined && !HOLDEM_BBS.includes(d.bb)) return false;
    return d.seats === undefined || (Array.isArray(d.seats) && d.seats.length <= HOLDEM_SEATS_MAX && d.seats.every(seatOk));
  }
  if (!m.state || typeof m.state !== 'object') return false;
  const t = m.state;
  return Number.isInteger(t.chairs) && t.chairs >= HOLDEM_SEATS_MIN && t.chairs <= HOLDEM_SEATS_MAX && Array.isArray(t.seats) && t.seats.length === t.chairs
    && t.seats.every(seatOk) && HOLDEM_BBS.includes(t.bb) && handShapeOk(t);
}
/** AUDIT CARDS-4 D6: the rest of a table's shape - what the client's catch-up and panel read off it (a merge of a delta
 *  is checked whole here: a `handSeats` of null threw in the catch-up). Fields a state never had stay unasked. */
function handShapeOk(t) {
  const chair = (x) => Number.isInteger(x) && x >= 0 && x < t.chairs;
  if (t.handNo !== undefined && !(Number.isSafeInteger(t.handNo) && t.handNo >= 0)) return false;
  if (t.button !== undefined && !(t.button === -1 || chair(t.button))) return false;
  if (t.seed !== undefined && !Number.isSafeInteger(t.seed)) return false;
  if (t.clockAt !== undefined && !Number.isFinite(t.clockAt)) return false;
  if (t.gold !== undefined && typeof t.gold !== 'boolean') return false;
  if (t.handSeats !== undefined && !(Array.isArray(t.handSeats) && t.handSeats.length <= t.chairs && t.handSeats.every(chair))) return false;
  if (t.hand === undefined || t.hand === null) return true;
  const h = t.hand;
  return typeof h === 'object' && Array.isArray(h.board) && h.board.length <= 5 && h.board.every((c) => Number.isInteger(c) && c >= 0 && c < 52)
    && Array.isArray(h.seats) && Array.isArray(t.handSeats) && h.seats.length === t.handSeats.length && h.seats.every((s) => s && typeof s === 'object');
}
