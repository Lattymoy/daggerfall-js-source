// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 29; section 6.4: "Online against another player, the
// relay running the game exactly as it runs Hold'em - hidden hands, its own shuffle, its own clock"): THE RELAY'S ILIAC
// TABLE - pure, DOM-free and plain-data (the relay checkpoints it whole), one home for the relay and its pins, Hold'em's
// table's twin (net/holdemTable.js). Section 5's decisions, built for the second game:
//
// THE RELAY SHUFFLES. Its own CSPRNG, handed in as `rand32`, deals the game (net/iliacHand.js newGame: the holdings, both
// decks, the coin) and keeps the state here, which no frame ever carries; each seat is told ITS OWN view (iliacView at
// its seat - its hand, its own committed plays) in a frame addressed to it alone, the room the spectator's (iliacView at
// -1: counts, the face-up cards, never a hand). The reveal's events are the rules' own public words (a veiled play names
// no card, a fizzle none).
//
// THE RELAY RUNS THE CLOCK. A turn waits ILIAC_TURN_MS for both commits; a seat that has not committed by then passes
// (an empty commit), and the turn turns over. A game is six turns; after it, the next deals ILIAC_GAP_MS later while both
// still sit (a rematch, as the next hand at Hold'em).
//
// TWO SEATS OF A TABLE'S CHAIRS. A table index is Hold'em's or Iliac Hand's, never both at once (the relay refuses the
// other game's sit while one sits); the client names the chair it took (world/cardTables.js - the same room, the same
// chairs, on every client), so every eye maps a seat to one chair. Seat 0 sat first.
//
// RANKED (section 6.4, DECIDED: "a ladder"). A seat sat with a deck the account service vouched for (net/identityToken.js
// deck order: the account's realm character holds every card of it) carries its account; a game between two such seats
// of two accounts is RANKED, and its end - a win, a loss, a draw, or a seat that stood up mid-game, which concedes - is
// queued in `t.results` for the relay to sign (net/iliacReceipt.js i1) and hand both seats. A friendly game (any lawful
// deck, any player) counts for nothing.
//
// Every operation mutates the table it is handed and answers the messages it owes - `{to, frame}`, `to` null for the
// room or a player's id for that player alone; the relay stamps each with `t: 'iliac'`, the table's index and its clock.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { newGame, commit as commitPlays, reveal, iliacView, result as gameResult, deckValid, ILIAC_DECK_SIZE, ILIAC_HAND_MAX, ILIAC_HOLDINGS } from './iliacHand.js';
import { cardById } from './iliacCards.js';
import { HOLDEM_SEATS_MIN, HOLDEM_SEATS_MAX } from './cardLaw.js';
import { HOLDEM_TABLES_MAX, HOLDEM_NAME_MAX } from './holdemTable.js';
import { ILIAC_RECEIPT_MAX } from './iliacReceipt.js';

/** MEASURE (CARDS10): a turn's clock - both seats' commits, or a pass for the one that has not. */
export const ILIAC_TURN_MS = 45000;
/** MEASURE (CARDS10): the first game's deal after the second seat; the next game's after one ends. */
export const ILIAC_FIRST_MS = 3000;
export const ILIAC_GAP_MS = 8000;
/** The most ranked results a table keeps waiting for the relay to sign. */
export const ILIAC_RESULTS_MAX = 32;
/** The longest a deck order (net/identityToken.js) may be on the wire. */
export const ILIAC_ORDER_MAX = 1024;
/** A card id's longest (the catalog's are far shorter). */
const CARD_ID_MAX = 32;

/** A new table at a cloth of `chairs` (2..6), or null. */
export function newIliacTable({ chairs }) {
  if (!Number.isInteger(chairs) || chairs < HOLDEM_SEATS_MIN || chairs > HOLDEM_SEATS_MAX) return null;
  return {
    chairs, gameNo: 0, nextDealAt: 0, clockAt: 0, id: /** @type {string|null} */ (null),
    seats: /** @type {any[]} */ ([null, null]),
    game: /** @type {any} */ (null), ranked: false,
    last: /** @type {any} */ (null),
    results: /** @type {{j: string, f: string[], r: number, h: string, to: string[]}[]} */ ([]),
  };
}

/** A seat in the room's frame: who, which chair, and whether his deck is vouched for (never the deck). */
const seatView = (s) => (s ? { id: s.id, name: s.name, chair: s.chair, ...(s.sub ? { ranked: true } : {}) } : null);

/** The room's view of the table: the seats, the game as a spectator sees it, the clock, the last game's end. */
export function iliacPublicView(t) {
  return {
    chairs: t.chairs, gameNo: t.gameNo, seats: t.seats.map(seatView), ranked: !!t.ranked,
    game: t.game ? iliacView(t.game, -1) : null, clockAt: t.game ? t.clockAt : 0, last: t.last,
  };
}

/** The seat a player holds at this table (0 or 1), or -1. */
export const iliacSeatOf = (t, id) => t.seats.findIndex((s) => s && s.id === id);
/** True when nobody sits at the table - the room forgets it. */
export const iliacEmpty = (t) => t.seats.every((s) => !s);

const room = (t, events) => ({ to: null, frame: { events, state: iliacPublicView(t) } });
/** A seat's own frame: the game as he sees it (his hand, his plays), and the clock. */
const own = (t, p) => ({ to: t.seats[p].id, frame: { mine: { gameNo: t.gameNo, seat: p, view: iliacView(t.game, p), clockAt: t.clockAt } } });
const owns = (t) => (t.game ? [0, 1].filter((p) => t.seats[p]).map((p) => own(t, p)) : []);
/** A game's id off the relay's source: 64 bits, as hex. */
const gameId = (rand32) => [rand32(), rand32()].map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');

/**
 * A player sits in `chair` with `deck` (thirty catalog ids the law takes - deckValid). `sub`: his account, when the
 * relay checked a deck order for exactly this deck (the seat is ranked); none, a friendly seat. Answers the messages, or
 * an error word ('no such chair', 'taken', 'seated', 'full', 'bad deck').
 * @param {any} t @param {{id: string, name: string, chair: number, deck: string[], now: number, sub?: string|null}} p
 */
export function iliacSit(t, { id, name, chair, deck, now, sub = null }) {
  if (!Number.isInteger(chair) || chair < 0 || chair >= t.chairs) return 'no such chair';
  if (iliacSeatOf(t, id) >= 0) return 'seated';
  if (t.seats.some((s) => s && s.chair === chair)) return 'taken';
  const p = t.seats.findIndex((s) => !s);
  if (p < 0) return 'full';
  if (!Array.isArray(deck) || deckValid(deck) !== null) return 'bad deck';
  t.seats[p] = { id, name: String(name ?? '').slice(0, HOLDEM_NAME_MAX), chair, deck: deck.slice(), ...(sub ? { sub } : {}) };
  if (!t.game && t.seats.every(Boolean)) t.nextDealAt = Math.max(t.nextDealAt, now + ILIAC_FIRST_MS);
  return [room(t, [{ t: 'sit', seat: p, chair, name: t.seats[p].name, at: now }])];
}

/** The game decided (or conceded by `left`, the seat that stood): the end said, a ranked one queued for signing. */
function finish(t, now, left = -1) {
  const r = left >= 0 ? null : gameResult(t.game);
  const winner = left >= 0 ? 1 - left : r?.winner ?? null;
  const how = left >= 0 ? 'left' : r?.by ?? 'draw';
  const end = { t: 'end', gameNo: t.gameNo, winner, how, result: r, names: t.seats.map((s) => s?.name ?? null), ...(t.ranked ? { ranked: true } : {}), at: now };
  if (t.ranked && t.id) {
    const subs = t.game.subs;
    t.results.push({ j: t.id, f: subs.slice(), r: winner === null ? 2 : winner, h: how, to: t.game.ids.slice() });
    if (t.results.length > ILIAC_RESULTS_MAX) t.results.splice(0, t.results.length - ILIAC_RESULTS_MAX);
  }
  t.last = { gameNo: t.gameNo, winner, how, result: r, names: end.names, ...(t.ranked ? { ranked: true } : {}) };
  t.game = null;
  t.ranked = false;
  t.id = null;
  t.clockAt = 0;
  t.nextDealAt = now + ILIAC_GAP_MS;
  return end;
}

/** The next game, if both seats sit: the relay's shuffle, each seat's view to it alone, the room the spectator's. */
function deal(t, now, rand32) {
  if (!t.seats.every(Boolean)) return [];
  const game = newGame({ decks: t.seats.map((s) => s.deck), rand32 });
  if (!game) return [];   // a deck the law took at the sit refuses nothing here - kept so a broken promise deals nothing
  const ranked = t.seats.every((s) => s.sub) && t.seats[0].sub !== t.seats[1].sub;
  game.ids = t.seats.map((s) => s.id);
  game.subs = ranked ? t.seats.map((s) => s.sub) : null;
  t.game = game;
  t.ranked = ranked;
  t.gameNo++;
  t.id = ranked ? gameId(rand32) : null;
  t.last = null;
  t.clockAt = now + ILIAC_TURN_MS;
  const events = [{ t: 'game', gameNo: t.gameNo, holdings: game.holdings.map((h) => h.id), ...(ranked ? { ranked: true } : {}), at: now }];
  return [room(t, events), ...owns(t)];
}

/** Both have committed: the turn turned over - its events to the room, each seat its own view; the end, if it was the
 *  last. */
function turnOver(t, now) {
  const events = reveal(t.game).map((e) => ({ ...e, at: now }));
  if (t.game.over) {
    const views = owns(t);   // the last turn's board, each seat's own, before the game is let go
    events.push(finish(t, now));
    return [room(t, events), ...views];
  }
  t.clockAt = now + ILIAC_TURN_MS;
  return [room(t, events), ...owns(t)];
}

/**
 * A seat commits its turn's plays (`[{card: handIndex, holding}]`, hidden until both have). Answers the messages, or an
 * error word ('no game', 'not seated', or the rules' refusal - net/iliacHand.js playsRefusal).
 * @param {any} t @param {{id: string, plays: {card: number, holding: number}[], now: number}} p
 */
export function iliacCommit(t, { id, plays, now }) {
  if (!t.game) return 'no game';
  const p = iliacSeatOf(t, id);
  if (p < 0) return 'not seated';
  const no = commitPlays(t.game, p, plays);
  if (no) return no;
  const said = { t: 'commit', seat: p, at: now };   // the room hears that he has, never what
  if (t.game.players[1 - p].plays) return turnOverWith(t, now, said);
  return [room(t, [said]), own(t, p)];
}
const turnOverWith = (t, now, first) => {
  const msgs = turnOver(t, now);
  msgs[0].frame.events.unshift(first);
  return msgs;
};

/**
 * A player stands (or leaves the room): a game under way is conceded to the other seat - ranked, a loss on the board.
 * Answers the messages - none when he was not seated.
 * @param {any} t @param {{id: string, now: number}} p
 */
export function iliacStand(t, { id, now }) {
  const p = iliacSeatOf(t, id);
  if (p < 0) return [];
  const events = [];
  let views = [];
  if (t.game) {
    const other = 1 - p;
    views = t.seats[other] ? [own(t, other)] : [];
    events.push(finish(t, now, p));
  }
  const name = t.seats[p].name, chair = t.seats[p].chair;
  t.seats[p] = null;
  events.push({ t: 'leave', seat: p, chair, name, at: now });
  return [room(t, events), ...views];
}

/**
 * The clock: a turn whose time ran out passes for the seat that has not committed, and turns over; a table between
 * games deals when its pause is over. Answers the messages (none when nothing was due).
 * @param {any} t @param {number} now @param {() => number} rand32
 */
export function iliacTick(t, now, rand32) {
  if (t.game) {
    if (now < t.clockAt) return [];
    const passed = [];
    for (const p of [0, 1]) if (!t.game.players[p].plays) { commitPlays(t.game, p, []); passed.push({ t: 'commit', seat: p, timeout: true, at: now }); }
    const msgs = turnOver(t, now);
    msgs[0].frame.events.unshift(...passed);
    return msgs;
  }
  return t.seats.every(Boolean) && now >= t.nextDealAt ? deal(t, now, rand32) : [];
}

/** The clock the table next needs the relay's attention at, or null when nothing is due (a seat empty). */
export function iliacNextAt(t) {
  if (t.game) return t.clockAt;
  return t.seats.every(Boolean) ? t.nextDealAt : null;
}

/** What a player newly come to the room (or asking) is owed: the table as the room sees it, and his own view if he
 *  holds a seat in the game. */
export function iliacLook(t, id) {
  const out = /** @type {any[]} */ ([{ to: id, frame: { events: [], state: iliacPublicView(t) } }]);
  const p = iliacSeatOf(t, id);
  if (t.game && p >= 0) out.push(own(t, p));
  return out;
}

// ── THE WIRE ─────────────────────────────────────────────────────────────────────────────────────────────────────

const ILIAC_OPS = Object.freeze(['sit', 'stand', 'commit', 'look']);
const cardIdOk = (x) => typeof x === 'string' && x.length > 0 && x.length <= CARD_ID_MAX;
const playsOk = (ps) => Array.isArray(ps) && ps.length <= ILIAC_HAND_MAX
  && ps.every((x) => x && typeof x === 'object' && Number.isInteger(x.card) && x.card >= 0 && x.card < ILIAC_HAND_MAX && Number.isInteger(x.holding) && x.holding >= 0 && x.holding < ILIAC_HOLDINGS);

/**
 * A client's word to an Iliac table, checked: `{op, table, chair?, chairs?, deck?, order?, plays?}` or null. `sit` names
 * the chair it takes, the cloth's chairs, the thirty cards of its deck (ids - the law checks them at the sit) and, for
 * a ranked seat, the service's deck order; `commit` the turn's plays; `stand` and `look` the table alone.
 * @param {any} m
 */
export function validIliacIn(m) {
  if (!m || typeof m !== 'object' || !ILIAC_OPS.includes(m.op)) return null;
  if (!Number.isInteger(m.table) || m.table < 0 || m.table >= HOLDEM_TABLES_MAX) return null;
  if (m.op === 'sit') {
    if (!Number.isInteger(m.chairs) || m.chairs < HOLDEM_SEATS_MIN || m.chairs > HOLDEM_SEATS_MAX) return null;
    if (!Number.isInteger(m.chair) || m.chair < 0 || m.chair >= m.chairs) return null;
    if (!Array.isArray(m.deck) || m.deck.length !== ILIAC_DECK_SIZE || !m.deck.every(cardIdOk)) return null;
    if (m.order !== undefined && !(typeof m.order === 'string' && m.order.length > 0 && m.order.length <= ILIAC_ORDER_MAX)) return null;
    return { op: 'sit', table: m.table, chair: m.chair, chairs: m.chairs, deck: m.deck.slice(), ...(m.order !== undefined ? { order: m.order } : {}) };
  }
  if (m.op === 'commit') return playsOk(m.plays) ? { op: 'commit', table: m.table, plays: m.plays.map((x) => ({ card: x.card, holding: x.holding })) } : null;
  return { op: m.op, table: m.table };
}

/** A card in a view: a uid, and a catalog id unless it lies face down. */
const viewCardOk = (c) => c && typeof c === 'object' && Number.isSafeInteger(c.uid) && (c.down === true || (typeof c.id === 'string' && !!cardById(c.form ?? c.id)));
/** AUDIT-shaped: what the client's panel and cloth read off a view (net/iliacHand.js iliacView). */
function viewOk(v) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.holdings) || v.holdings.length !== ILIAC_HOLDINGS || !Array.isArray(v.players) || v.players.length !== 2) return false;
  if (!Number.isInteger(v.turn) || !Number.isInteger(v.viewer) || v.viewer < -1 || v.viewer > 1) return false;
  for (const hd of v.holdings) {
    if (!hd || typeof hd.id !== 'string' || !cardById(hd.id) || !Number.isInteger(hd.room) || !Array.isArray(hd.sides) || hd.sides.length !== 2) return false;
    if (!hd.sides.every((s) => Array.isArray(s) && s.length <= 12 && s.every(viewCardOk))) return false;
    if (!Array.isArray(hd.power) || hd.power.length !== 2 || !hd.power.every(Number.isFinite)) return false;
  }
  for (const pl of v.players) {
    if (!pl || typeof pl !== 'object' || !Number.isInteger(pl.handCount) || !Number.isInteger(pl.deckCount) || !Number.isInteger(pl.magicka)) return false;
    if (pl.hand !== undefined && !(Array.isArray(pl.hand) && pl.hand.length <= ILIAC_HAND_MAX && pl.hand.every(viewCardOk))) return false;
    if (pl.discard !== undefined && !(Array.isArray(pl.discard) && pl.discard.length <= 2 * ILIAC_DECK_SIZE)) return false;
  }
  return true;
}

/**
 * The relay's word from an Iliac table, checked on the client: a table index and one of the room's `events` with the
 * table's `state`, a seat's own view (`mine`), a ranked game's receipt, or a refusal. True or false.
 * @param {any} m
 */
export function validIliacOut(m) {
  if (!m || typeof m !== 'object' || !Number.isInteger(m.table) || m.table < 0 || m.table >= HOLDEM_TABLES_MAX) return false;
  if (typeof m.error === 'string') return m.error.length <= 40;
  if (m.receipt !== undefined) return typeof m.receipt === 'string' && m.receipt.length <= ILIAC_RECEIPT_MAX;   // net/iliacReceipt.js reads it
  if (m.mine) return Number.isInteger(m.mine.gameNo) && (m.mine.seat === 0 || m.mine.seat === 1) && Number.isFinite(m.mine.clockAt) && viewOk(m.mine.view) && m.mine.view.viewer === m.mine.seat;
  if (!Array.isArray(m.events) || m.events.length > 96 || !m.events.every((e) => e && typeof e.t === 'string')) return false;
  const s = m.state;
  if (!s || typeof s !== 'object' || !Number.isInteger(s.chairs) || s.chairs < HOLDEM_SEATS_MIN || s.chairs > HOLDEM_SEATS_MAX) return false;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !s.seats.every((x) => x === null || (x && typeof x.id === 'string' && typeof x.name === 'string' && Number.isInteger(x.chair) && x.chair >= 0 && x.chair < s.chairs))) return false;
  if (!Number.isInteger(s.gameNo) || !Number.isFinite(s.clockAt)) return false;
  return s.game === null || (viewOk(s.game) && s.game.viewer === -1);
}
