// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 33; section 6.4: "Online against another player, the
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
import { newGame, commit as commitPlays, reveal, iliacView, result as gameResult, deckValid, ILIAC_DECK_SIZE, ILIAC_HAND_MAX, ILIAC_HOLDINGS, ILIAC_TURNS } from './iliacHand.js';
import { cardById } from './iliacCards.js';
import { HOLDEM_SEATS_MIN, HOLDEM_SEATS_MAX } from './cardLaw.js';
import { HOLDEM_TABLES_MAX, HOLDEM_NAME_MAX } from './holdemTable.js';
import { ILIAC_RECEIPT_MAX, ILIAC_GAME_ID_RE } from './iliacReceipt.js';

/** MEASURE (CARDS10): a turn's clock - both seats' commits, or a pass for the one that has not. */
export const ILIAC_TURN_MS = 45000;
/** MEASURE (CARDS10): the first game's deal after the second seat; the next game's after one ends. */
export const ILIAC_FIRST_MS = 3000;
export const ILIAC_GAP_MS = 8000;
/** The most ranked results a table keeps waiting for the relay to sign. */
export const ILIAC_RESULTS_MAX = 32;
/** The longest a deck order (net/identityToken.js) may be on the wire. */
export const ILIAC_ORDER_MAX = 1024;
/** AUDIT CARDS-6 C6: a seat the clock passes this many turns running is stood up (a game under way conceded). */
export const ILIAC_IDLE_TURNS = 3;
/** AUDIT CARDS-6 C7: how long a ranked game keeps a seat whose socket went, for its own player to come back to (the
 *  arena's ARENA_GONE_MS - its own constant here: a card seat's grace is this table's law, tuned apart). */
export const ILIAC_GONE_MS = 15000;
/** AUDIT CARDS-6 E13: a stand that names the game before the one under way, heard this soon after that one's deal and
 *  before its seat has committed in it, was pressed over the last game's end - it concedes nothing (no contest). */
export const ILIAC_LATE_MS = 3000;
/** AUDIT CARDS-6 C7: a seat kept for its player's blink answers to no socket's id ('~' is no id's: wire.js ID_RE). */
const awayId = (p) => `~away${p}`;
/** A card id's longest (the catalog's are far shorter). */
const CARD_ID_MAX = 32;

/** A new table at a cloth of `chairs` (2..6), or null. */
export function newIliacTable({ chairs }) {
  if (!Number.isInteger(chairs) || chairs < HOLDEM_SEATS_MIN || chairs > HOLDEM_SEATS_MAX) return null;
  return {
    chairs, gameNo: 0, nextDealAt: 0, clockAt: 0, dealtAt: 0, id: /** @type {string|null} */ (null),
    seats: /** @type {any[]} */ ([null, null]),
    game: /** @type {any} */ (null), ranked: false,
    last: /** @type {any} */ (null),
    results: /** @type {{j: string, f: string[], r: number, h: string, to: string[]}[]} */ ([]),
  };
}

/** A seat in the room's frame: who, which chair, and whether his deck is vouched for (never the deck). */
const seatView = (s) => (s ? { id: s.id, name: s.name, chair: s.chair, ...(s.sub ? { ranked: true } : {}), ...(s.away ? { away: true } : {}) } : null);

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
 * AUDIT CARDS-6 C2: why `iliacSit` would refuse this sit ('no such chair', 'seated', 'taken', 'full', 'bad deck'), or
 * null when it would seat him - pure, nothing moved, so the relay asks it BEFORE it spends the room's sit budget (a sit
 * that seats nobody spends nobody's turn; one socket sending refused sits kept every card table in the room 'busy').
 * @param {any} t @param {{id: string, chair: number, deck: string[]}} p
 */
export function iliacSitRefusal(t, { id, chair, deck }) {
  if (!Number.isInteger(chair) || chair < 0 || chair >= t.chairs) return 'no such chair';
  if (iliacSeatOf(t, id) >= 0) return 'seated';
  if (t.seats.some((s) => s && s.chair === chair)) return 'taken';
  if (t.seats.every(Boolean)) return 'full';
  if (!Array.isArray(deck) || deckValid(deck) !== null) return 'bad deck';
  return null;
}

/**
 * A player sits in `chair` with `deck` (thirty catalog ids the law takes - deckValid). `sub`: his account, when the
 * relay checked a deck order for exactly this deck (the seat is ranked); none, a friendly seat. AUDIT CARDS-6 C5/D2:
 * `orderE`, that order's own expiry (epoch seconds) - it vouches for the next game dealt, and only while it is
 * unexpired at the deal; a ranked seat given none is never vouched for. Answers the messages, or an error word
 * (iliacSitRefusal's).
 * @param {any} t @param {{id: string, name: string, chair: number, deck: string[], now: number, sub?: string|null, orderE?: number}} p
 */
export function iliacSit(t, { id, name, chair, deck, now, sub = null, orderE }) {
  const no = iliacSitRefusal(t, { id, chair, deck });
  if (no) return no;
  const p = t.seats.findIndex((s) => !s);
  t.seats[p] = { id, name: String(name ?? '').slice(0, HOLDEM_NAME_MAX), chair, deck: deck.slice(), idle: 0, ...(sub ? { sub, vouchFor: t.gameNo + 1, vouchE: orderE } : {}) };
  const events = /** @type {any[]} */ ([{ t: 'sit', seat: p, chair, name: t.seats[p].name, at: now }]);
  if (!t.game && t.seats.every(Boolean)) {
    // AUDIT CARDS-6 C5/D2: two ranked seats - each is asked for a fresh order of the realm's, and the first game waits the
    // gap for it (ILIAC_GAP_MS, not ILIAC_FIRST_MS): the order a seat sat with may be long past its minute
    const ranked = t.seats.every((s) => s.sub);
    t.nextDealAt = Math.max(t.nextDealAt, now + (ranked ? ILIAC_GAP_MS : ILIAC_FIRST_MS));
    if (ranked) events.push(vouchAsked(now));
  }
  return [room(t, events)];
}
/** AUDIT CARDS-6 C5/D2: the room told the next ranked game deals on fresh orders - each ranked seat's client asks the
 *  realm again and says it back (`vouch`); a seat whose order is not unexpired at the deal plays that game friendly. */
const vouchAsked = (now) => ({ t: 'vouch', at: now });

/** The game decided (or conceded by `left`, the seat that stood): the end said, a ranked one queued for signing.
 *  `why`: 'idle' - the clock stood `left` up (AUDIT CARDS-6 C6); 'void' - no contest, nobody's (C7, E13). */
function finish(t, now, left = -1, why = null) {
  const voided = why === 'void';
  const r = left >= 0 || voided ? null : gameResult(t.game);
  const winner = voided ? null : left >= 0 ? 1 - left : r?.winner ?? null;
  const how = voided ? 'void' : left >= 0 ? 'left' : r?.by ?? 'draw';
  // AUDIT CARDS-6 C6: a game decided on the board, or by the clock standing a seat up, counts only when both seats
  // committed in it - an absent seat's games are nobody's win (one person's second account, never at the table, was a
  // signed win every five minutes); a stand of a seat's own still concedes, and no contest counts for nobody
  const counts = t.ranked && !!t.id && !voided && ((left >= 0 && why !== 'idle') || t.game.spoke.every(Boolean));
  const end = { t: 'end', gameNo: t.gameNo, winner, how, result: r, names: t.seats.map((s) => s?.name ?? null), ...(counts ? { ranked: true } : {}), at: now };
  if (counts) {
    const subs = t.game.subs;
    t.results.push({ j: t.id, f: subs.slice(), r: winner === null ? 2 : winner, h: how, to: t.game.ids.slice() });
    if (t.results.length > ILIAC_RESULTS_MAX) t.results.splice(0, t.results.length - ILIAC_RESULTS_MAX);
  }
  // AUDIT CARDS-6 C9: the board as the room last saw it kept with the end (the spectator's view - no hand, a card still
  // face down stays so), so a watcher sees the last reveal: the frame that carries it has no game any more
  t.last = { gameNo: t.gameNo, winner, how, result: r, names: end.names, ...(counts ? { ranked: true } : {}), view: iliacView(t.game, -1) };
  t.game = null;
  t.ranked = false;
  t.id = null;
  t.clockAt = 0;
  t.nextDealAt = now + ILIAC_GAP_MS;
  return end;
}

/** The next game, if both seats sit: the relay's shuffle, each seat's view to it alone, the room the spectator's. */
function deal(t, now, rand32) {
  if (!t.seats.every((s) => s && !s.away)) return [];   // AUDIT CARDS-6 C7: never a game dealt to a seat whose player is gone
  const game = newGame({ decks: t.seats.map((s) => s.deck), rand32 });
  if (!game) return [];   // a deck the law took at the sit refuses nothing here - kept so a broken promise deals nothing
  // AUDIT CARDS-6 C5/D2: a seat's vouch is this game's - an order given since the last deal - and its order is unexpired
  // now; an older one (the realm character's cards could have changed hands since) deals this game friendly, signs nothing
  const vouched = (s) => !!s.sub && s.vouchFor === t.gameNo + 1 && s.vouchE * 1000 > now;
  const ranked = t.seats.every(vouched) && t.seats[0].sub !== t.seats[1].sub;
  game.ids = t.seats.map((s) => s.id);
  game.subs = ranked ? t.seats.map((s) => s.sub) : null;
  game.spoke = [false, false];   // AUDIT CARDS-6 C6: which seats have committed in this game (the clock's passes are not theirs)
  t.game = game;
  t.ranked = ranked;
  t.gameNo++;
  t.id = ranked ? gameId(rand32) : null;
  t.last = null;
  t.clockAt = now + ILIAC_TURN_MS;
  t.dealtAt = now;
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
    if (t.seats.every((s) => s?.sub)) events.push(vouchAsked(now));   // AUDIT CARDS-6 C5/D2: the next ranked game's orders, in the gap
    return [room(t, events), ...views];
  }
  t.clockAt = now + ILIAC_TURN_MS;
  return [room(t, events), ...owns(t)];
}

/**
 * A seat commits its turn's plays (`[{card: handIndex, holding}]`, hidden until both have). Answers the messages, or an
 * error word ('no game', 'not seated', 'stale', or the rules' refusal - net/iliacHand.js playsRefusal).
 * AUDIT CARDS-6 C3: `gameNo` and `turn` are the game and the turn its player saw (the relay's word always names them -
 * validIliacIn): a commit that crossed the clock's turnover, or a second press of Commit after the turn turned on the
 * first, is that turn's - 'stale', never the next turn's plays, made blind to a reveal he never saw.
 * @param {any} t @param {{id: string, plays: {card: number, holding: number}[], now: number, gameNo?: number, turn?: number}} p
 */
export function iliacCommit(t, { id, plays, now, gameNo, turn }) {
  if (!t.game) return 'no game';
  const p = iliacSeatOf(t, id);
  if (p < 0) return 'not seated';
  if ((gameNo !== undefined && gameNo !== t.gameNo) || (turn !== undefined && turn !== t.game.turn)) return 'stale';
  const no = commitPlays(t.game, p, plays);
  if (no) return no;
  t.game.spoke[p] = true;   // AUDIT CARDS-6 C6: he is at the table
  t.seats[p].idle = 0;
  const said = { t: 'commit', seat: p, at: now };   // the room hears that he has, never what
  if (t.game.players[1 - p].plays) return turnOverWith(t, now, said);
  // AUDIT CARDS-6 C8: and hears it alone - the table is the one it was told but for this seat's commit, so the frame
  // carries no state (it carried the whole public view, a kilobyte, to say one seat had committed)
  return [{ to: null, frame: { events: [said] } }, own(t, p)];
}
const turnOverWith = (t, now, first) => {
  const msgs = turnOver(t, now);
  msgs[0].frame.events.unshift(first);
  return msgs;
};

/**
 * A player stands (or leaves the room): a game under way is conceded to the other seat - ranked, a loss on the board.
 * Answers the messages - none when he was not seated.
 * AUDIT CARDS-6 E13: `gameNo`, the game his panel showed when he pressed - a stand naming the game BEFORE the one under
 * way, heard within ILIAC_LATE_MS of that one's deal and before he committed in it, was pressed over the last game's end
 * while the next was dealt: it concedes nothing, and the game he never saw is let go (no contest). `idle`: the clock
 * stood him up (C6).
 * @param {any} t @param {{id: string, now: number, gameNo?: number, idle?: boolean}} p
 */
export function iliacStand(t, { id, now, gameNo, idle = false }) {
  const p = iliacSeatOf(t, id);
  if (p < 0) return [];
  const events = [];
  let views = [];
  if (t.game) {
    const other = 1 - p;
    views = t.seats[other] && !t.seats[other].away ? [own(t, other)] : [];
    const late = Number.isInteger(gameNo) && gameNo < t.gameNo && now - t.dealtAt <= ILIAC_LATE_MS && !t.game.spoke[p];
    events.push(late ? finish(t, now, -1, 'void') : finish(t, now, p, idle ? 'idle' : null));
  }
  const name = t.seats[p].name, chair = t.seats[p].chair;
  t.seats[p] = null;
  events.push({ t: 'leave', seat: p, chair, name, ...(idle ? { idle: true } : {}), at: now });
  return [room(t, events), ...views];
}

/**
 * AUDIT CARDS-6 C5/D2: a seated player's deck vouched for again (`sub`: the account of the order the relay checked
 * against his seat's own deck, `orderE` its expiry) - for the next game dealt, as the sit's order was for the first.
 * Answers null, or an error word.
 * @param {any} t @param {{id: string, sub: string, orderE: number}} p
 */
export function iliacVouch(t, { id, sub, orderE }) {
  const p = iliacSeatOf(t, id);
  if (p < 0) return 'not seated';
  const s = t.seats[p];
  if (!s.sub || s.sub !== sub) return 'deck refused';   // a friendly seat stays one; an order is its own account's
  s.vouchFor = t.gameNo + 1;
  s.vouchE = orderE;
  return null;
}

/**
 * AUDIT CARDS-6 C7: a player's socket is gone (a close, or a send that failed). In a RANKED game under way his seat is
 * kept ILIAC_GONE_MS for him - its id no socket's, so nobody saying his id is told his hand - and the clock passes his
 * turns meanwhile; anywhere else he stands at once (a game under way conceded). Answers the messages.
 * @param {any} t @param {{id: string, now: number}} p
 */
export function iliacGone(t, { id, now }) {
  const p = iliacSeatOf(t, id);
  if (p < 0) return [];
  const s = t.seats[p];
  if (!t.game || !t.ranked || !s.sub) return iliacStand(t, { id, now });
  s.away = { at: now, id };
  s.id = awayId(p);
  return [room(t, [{ t: 'gone', seat: p, at: now }])];
}

/**
 * AUDIT CARDS-6 C7: a player back in the room (`id` the one his seat was kept for, `sub` his verified account): the seat
 * is his again, and he is told the table and his own view. Answers the messages (none when no seat was kept for him).
 * @param {any} t @param {{id: string, sub: string, now: number}} p
 */
export function iliacBack(t, { id, sub, now }) {
  const p = t.seats.findIndex((s) => s?.away && s.away.id === id && s.sub === sub);
  if (p < 0) return [];
  const s = t.seats[p];
  s.id = id;
  delete s.away;
  return [room(t, [{ t: 'back', seat: p, at: now }]), ...(t.game ? [own(t, p)] : [])];
}

/** AUDIT CARDS-6 C7: the game under way let go, no contest - both its players gone (the room drained, or both kept seats
 *  out of time together). Answers the messages (none with no game). */
export function iliacVoid(t, now) {
  if (!t.game) return [];
  const views = [0, 1].filter((p) => t.seats[p] && !t.seats[p].away).map((p) => own(t, p));
  return [room(t, [finish(t, now, -1, 'void')]), ...views];
}

/**
 * The clock: a turn whose time ran out passes for the seat that has not committed, and turns over; a table between
 * games deals when its pause is over. Answers the messages (none when nothing was due).
 * @param {any} t @param {number} now @param {() => number} rand32
 */
export function iliacTick(t, now, rand32) {
  // AUDIT CARDS-6 C7: a kept seat whose player is not back in time stands (its game conceded) - both kept seats out of
  // time with a game under way, it is no contest
  const msgs = [];
  const due = [0, 1].filter((p) => t.seats[p]?.away && now - t.seats[p].away.at >= ILIAC_GONE_MS);
  if (due.length && t.game && t.seats.every((s) => s?.away)) msgs.push(...iliacVoid(t, now));
  for (const p of due) msgs.push(...iliacStand(t, { id: t.seats[p].id, now }));
  if (t.game) {
    if (now < t.clockAt) return msgs;
    const passed = [];
    for (const p of [0, 1]) if (!t.game.players[p].plays) { commitPlays(t.game, p, []); t.seats[p].idle = (t.seats[p].idle ?? 0) + 1; passed.push({ t: 'commit', seat: p, timeout: true, at: now }); }
    const turned = turnOver(t, now);
    turned[0].frame.events.unshift(...passed);
    msgs.push(...turned);
    // AUDIT CARDS-6 C6: a seat the clock has passed ILIAC_IDLE_TURNS turns running is not at the table - stood up
    for (const s of [...t.seats]) if (s && s.idle >= ILIAC_IDLE_TURNS) msgs.push(...iliacStand(t, { id: s.id, now, idle: true }));
    return msgs;
  }
  return t.seats.every(Boolean) && now >= t.nextDealAt ? [...msgs, ...deal(t, now, rand32)] : msgs;
}

/** The clock the table next needs the relay's attention at, or null when nothing is due (a seat empty). */
export function iliacNextAt(t) {
  // AUDIT CARDS-6 C7: and a kept seat's time out - never a deal while one is kept (deal() deals none: a past deal time
  // would arm the alarm for now, again and again, until he is back or stood)
  const away = t.seats.filter((s) => s?.away).map((s) => s.away.at + ILIAC_GONE_MS);
  const at = t.game ? t.clockAt : t.seats.every((s) => s && !s.away) ? t.nextDealAt : null;
  return away.length ? Math.min(at ?? Infinity, ...away) : at;
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

const ILIAC_OPS = Object.freeze(['sit', 'stand', 'commit', 'look', 'vouch', 'ack']);
const cardIdOk = (x) => typeof x === 'string' && x.length > 0 && x.length <= CARD_ID_MAX;
const playsOk = (ps) => Array.isArray(ps) && ps.length <= ILIAC_HAND_MAX
  && ps.every((x) => x && typeof x === 'object' && Number.isInteger(x.card) && x.card >= 0 && x.card < ILIAC_HAND_MAX && Number.isInteger(x.holding) && x.holding >= 0 && x.holding < ILIAC_HOLDINGS);
const orderOk = (o) => typeof o === 'string' && o.length > 0 && o.length <= ILIAC_ORDER_MAX;
const gameNoOk = (n) => Number.isSafeInteger(n) && n >= 0;

/**
 * A client's word to an Iliac table, checked: `{op, table, chair?, chairs?, deck?, order?, plays?, gameNo?, turn?, j?}`
 * or null. `sit` names the chair it takes, the cloth's chairs, the thirty cards of its deck (ids - the law checks them
 * at the sit) and, for a ranked seat, the service's deck order; `commit` the turn's plays and (AUDIT CARDS-6 C3) the
 * game and turn they are for; `stand` the table and (E13) the game its panel showed; `look` the table alone; `vouch`
 * (C5) a seated deck's fresh order; `ack` (C1) a ranked result's game id this device keeps now.
 * @param {any} m
 */
export function validIliacIn(m) {
  if (!m || typeof m !== 'object' || !ILIAC_OPS.includes(m.op)) return null;
  if (!Number.isInteger(m.table) || m.table < 0 || m.table >= HOLDEM_TABLES_MAX) return null;
  if (m.op === 'sit') {
    if (!Number.isInteger(m.chairs) || m.chairs < HOLDEM_SEATS_MIN || m.chairs > HOLDEM_SEATS_MAX) return null;
    if (!Number.isInteger(m.chair) || m.chair < 0 || m.chair >= m.chairs) return null;
    if (!Array.isArray(m.deck) || m.deck.length !== ILIAC_DECK_SIZE || !m.deck.every(cardIdOk)) return null;
    if (m.order !== undefined && !orderOk(m.order)) return null;
    return { op: 'sit', table: m.table, chair: m.chair, chairs: m.chairs, deck: m.deck.slice(), ...(m.order !== undefined ? { order: m.order } : {}) };
  }
  if (m.op === 'commit') {
    if (!gameNoOk(m.gameNo) || !Number.isInteger(m.turn) || m.turn < 1 || m.turn > ILIAC_TURNS) return null;
    return playsOk(m.plays) ? { op: 'commit', table: m.table, gameNo: m.gameNo, turn: m.turn, plays: m.plays.map((x) => ({ card: x.card, holding: x.holding })) } : null;
  }
  if (m.op === 'stand') return m.gameNo === undefined || gameNoOk(m.gameNo) ? { op: 'stand', table: m.table, ...(m.gameNo !== undefined ? { gameNo: m.gameNo } : {}) } : null;
  if (m.op === 'vouch') return orderOk(m.order) ? { op: 'vouch', table: m.table, order: m.order } : null;
  if (m.op === 'ack') return typeof m.j === 'string' && ILIAC_GAME_ID_RE.test(m.j) ? { op: 'ack', table: m.table, j: m.j } : null;
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
  if (!Array.isArray(m.events) || m.events.length > 96 || !m.events.every(eventOk)) return false;
  // AUDIT CARDS-6 C8: a seat's commit, said alone - the table is the one the room was told, but for it
  if (m.state === undefined) return m.events.length > 0 && m.events.every((e) => e.t === 'commit');
  const s = m.state;
  if (!s || typeof s !== 'object' || !Number.isInteger(s.chairs) || s.chairs < HOLDEM_SEATS_MIN || s.chairs > HOLDEM_SEATS_MAX) return false;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !s.seats.every((x) => x === null || (x && typeof x.id === 'string' && typeof x.name === 'string' && Number.isInteger(x.chair) && x.chair >= 0 && x.chair < s.chairs))) return false;
  if (!Number.isInteger(s.gameNo) || !Number.isFinite(s.clockAt)) return false;
  // AUDIT CARDS-6 C9/C10: the last game's end as the panel reads it - who won and how, and the board it ended on
  if (s.last != null && !(typeof s.last === 'object' && seatOr(s.last.winner, null) && typeof s.last.how === 'string' && (s.last.view === undefined || (viewOk(s.last.view) && s.last.view.viewer === -1)))) return false;
  return s.game === null || (viewOk(s.game) && s.game.viewer === -1);
}

/** A seat (0 or 1), or `none` where the field may say nobody. */
const seatOr = (x, none) => x === 0 || x === 1 || (none !== undefined && x === none);
/**
 * AUDIT CARDS-6 C10: an event of the room's, checked for the fields the panel reads off its own kind (scenes/
 * iliacTableGame.js iliacOnlineLine and the phase it keeps) - a hostile relay's `{t: 'game'}` with no holdings threw
 * in the panel's update, after the table had taken the state. The rules' own reveal events are read by `t` alone.
 * @param {any} e
 */
function eventOk(e) {
  if (!e || typeof e !== 'object' || typeof e.t !== 'string') return false;
  switch (e.t) {
    case 'sit': return seatOr(e.seat) && Number.isInteger(e.chair) && typeof e.name === 'string';
    case 'leave': return seatOr(e.seat) && (e.name == null || typeof e.name === 'string');
    case 'commit': case 'gone': case 'back': return seatOr(e.seat);
    case 'game': return Number.isInteger(e.gameNo) && Array.isArray(e.holdings) && e.holdings.length === ILIAC_HOLDINGS && e.holdings.every(cardIdOk);
    case 'end': return seatOr(e.winner, null) && typeof e.how === 'string';
    case 'turn': return Number.isInteger(e.turn);
    default: return true;
  }
}
