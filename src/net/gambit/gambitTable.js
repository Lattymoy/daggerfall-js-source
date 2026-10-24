// @ts-check
// KG5 (2026-10-15, bible/11-Multiplayer/Kings-Gambit.md sections 5.8, 10.7 and 18): THE RELAY'S KING'S GAMBIT TABLE -
// pure, DOM-free and plain-data (the relay checkpoints it whole), one home for the relay and its pins, Iliac Hand's
// table's twin (net/iliac/iliacTable.js). Section 5.8's decisions, built:
//
// THE RELAY RUNS THE GAME. The mod's link - every move through public brokers, both clients running the game and each
// settling its own purse - is refused (Tavern-Cards.md section 7: no client-dealt game online, ever). The relay builds
// the board and rolls every die from its own CSPRNG, handed in as `rand32` (net/kingsGambit.js newGambit, gambitAct,
// finishTurn), and keeps the law's state here; a command is the law's, refused in the law's own word when it is not.
//
// TWO SEATS OF A TABLE'S CHAIRS. A table index is one game's at a time (the relay refuses another game's sit while one
// sits - 'other game'); the client names the chair it took (world/card/cardTables.js), so every eye maps a seat to one chair.
// Seat 0 sat first and is the law's HOST - side 0, its king's row the board's foot at its chair; seat 1 is the guest.
//
// THE ARMIES AT READY (the mod's ARMY at Ready). A seated player builds an army on the client and says it at Ready; the
// relay keeps it, tells the room only that the seat is ready, and deals - both armies on the board, in the open - once
// both are. Nothing of a dealt game is hidden (section 11: the state is each seat's view), so the room is told the whole
// board with every event, and the tavern watches it.
//
// THE CLOCK (10.7). GAMBIT_TURN_MS a turn - the mod has none (its peer timeout is 40 s); an expired turn ends as End turn
// does, and a seat whose turn the clock has ended GAMBIT_IDLE_TURNS times running is stood up, its game forfeited
// (Iliac Hand's idle law). A turn ends GAMBIT_TURN_END_MS after its last action (the mod's beat). A stand, or a socket
// gone, forfeits the game under way (the mod's FORFEIT). KG6: at the gold table every Ready a stake, the pot the winner's.
//
// A STORED TABLE IS CHECKED when the room loads it (AUDIT KG A4): the law's steps trust the state they are handed and
// throw on a malformed one, so a table whose game the law did not mint is dropped (gambitTableValid).
//
// Every operation mutates the table it is handed and answers the messages it owes - `{to, frame}`, `to` null for the
// room or a player's id for that player alone; the relay stamps each with `t: 'gambit'`, the table's index and its clock.
//
// KG6 (2026-10-15, sections 10.7 and 19): GOLD AT THE RED TABLE AND THE SEASON. A gold table's seat says its stake at
// Ready - CARDS6's escrow, the realm service's order the relay checked and spent (net/gambit/gambitStakes.js: the mod's online
// stakes, both seats the same) - and the deal takes both into the pot; the end hands it out in cash-outs the relay signs
// (`cashouts`, net/card/cardReceipt.js): the whole pot the winner's, nothing the loser's, each stake its own player's when
// nobody won or the game was never dealt. A game between two accounts is RATED: its result queued for the relay to sign
// (`results`, net/gambit/gambitReceipt.js g1) and the season board to count.
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import {
  newGambit, gambitAct, finishTurn, armyRefusal, KG_COLS, KG_ROWS, KG_TILE, KG_COMMANDS, KG_HAZARD_KINDS, KG_LAYOUTS,
  KG_OPEN_FIELD, KG_MAX_UNITS, KG_MAX_HAZARDS, KG_ACTIONS_PER_TURN, KG_POTIONS_MAX, rosterUnit, KG_KING_CLASSES,
} from '../kingsGambit.js';
import { HOLDEM_SEATS_MIN, HOLDEM_SEATS_MAX } from '../card/cardLaw.js';
import { HOLDEM_TABLES_MAX, HOLDEM_NAME_MAX, HOLDEM_STAKE_MAX } from '../holdemTable.js';
import { gambitStakeOk } from './gambitStakes.js';
import { GAMBIT_GAME_ID_RE, GAMBIT_RECEIPT_MAX } from './gambitReceipt.js';
import { STAKE_ID_RE, ID_RE } from '../identityToken.js';   // AUDIT KG II A8: a queued cash-out's and result's ids, the shapes a receipt carries

/** MEASURE (KG5, 10.7): a turn's clock - first guess 60 s (Iliac Hand's is 45). */
export const GAMBIT_TURN_MS = 60000;
/** The mod's beat (TurnEndDelay): a turn ends this long after its last action or its End turn. */
export const GAMBIT_TURN_END_MS = 900;
/** The deal after both seats are ready. */
export const GAMBIT_FIRST_MS = 3000;
/** A seat whose turn the clock ended this many times running is stood up (Iliac Hand's ILIAC_IDLE_TURNS). */
export const GAMBIT_IDLE_TURNS = 3;
/** The mod's RemoteActionGap: an online opponent's actions shown at least this far apart on the client (10.7). */
export const GAMBIT_REMOTE_GAP_MS = 550;
/** The crowns a seat may wear: an index into the Bay deck's four (systems/gambit/gambitTableSession.js GAMBIT_CROWNS). */
export const GAMBIT_CROWN_COUNT = 4;
/** The most pieces a board holds: both kings and both armies at their most. */
export const GAMBIT_PIECES_MAX = 2 * (KG_MAX_UNITS + 1);
/** The longest refusal word on the wire. */
const WORD_MAX = 40;
/** KG6: the most cash-outs and rated results a stored table may hold queued for the relay to sign - the LOAD's bound
 *  (gambitTableValid; AUDIT KG II E20): every save signs and keeps them first, so a queue grows only while its writes fail. */
export const GAMBIT_QUEUE_MAX = 16;
/** AUDIT KG II A1 (Iliac Hand's AUDIT CARDS-6 E13, ILIAC_LATE_MS): a stand that names the game before the one under way,
 *  heard this soon after that one's deal and before the seat acted in it, was pressed over the deal - no contest. */
export const GAMBIT_LATE_MS = 3000;

/** A new table at a cloth of `chairs` (2..6) - KG6: `gold` the realm's gold table, every Ready a stake - or null. */
export function newGambitTable({ chairs, gold = false }) {
  if (!Number.isInteger(chairs) || chairs < HOLDEM_SEATS_MIN || chairs > HOLDEM_SEATS_MAX) return null;
  return {
    chairs, gold: gold === true, gameNo: 0, nextDealAt: 0, clockAt: 0, endAt: /** @type {number|null} */ (null), dealtAt: 0,
    seats: /** @type {any[]} */ ([null, null]),
    game: /** @type {any} */ (null),
    last: /** @type {any} */ (null),
    // KG6: the dealt game's stakes (each seat's `{j, sub, amount}`), its id and its two accounts (rated when both are
    // accounts, and two), and what is owed: cash-outs and rated results, for the relay to sign
    pot: /** @type {any[]|null} */ (null), id: /** @type {string|null} */ (null), subs: /** @type {any[]|null} */ (null),
    cashouts: /** @type {any[]} */ ([]), results: /** @type {any[]} */ ([]),
  };
}

/** A seat in the room's frame: who, which chair, which crown, whether ready and for what stake - never the army it said
 *  at Ready, nor its account. */
const seatView = (/** @type {any} */ s) => (s ? { id: s.id, name: s.name, chair: s.chair, crown: s.crown, ...(s.ready ? { ready: true } : {}), ...(s.stake ? { stake: s.stake.amount } : {}) } : null);
/** KG6: the pot's gold, both stakes. @param {any[]|null} pot */
const potOf = (pot) => (pot ? pot.reduce((n, x) => n + (x?.amount ?? 0), 0) : 0);
/** KG6: whether the dealt game is rated - two accounts, not one. @param {any} t */
const ratedOf = (t) => !!t.subs && t.subs.every((/** @type {any} */ x) => typeof x === 'string') && t.subs[0] !== t.subs[1];

/** The room's view of the table: the seats, the game whole (nothing in a dealt game is hidden), the clock, the last
 *  game's end. @param {any} t */
export function gambitPublicView(t) {
  return {
    chairs: t.chairs, gameNo: t.gameNo, seats: t.seats.map(seatView), game: t.game,
    clockAt: t.game ? t.clockAt : 0, ...(t.game && t.endAt !== null ? { endAt: t.endAt } : {}), last: t.last,
    ...(t.gold ? { gold: true } : {}), ...(t.game && t.pot ? { pot: potOf(t.pot) } : {}), ...(t.game && ratedOf(t) ? { rated: true } : {}),
  };
}

/** The seat a player holds at this table (0 or 1), or -1. @param {any} t @param {string} id */
export const gambitSeatOf = (t, id) => t.seats.findIndex((/** @type {any} */ s) => s && s.id === id);
/** True when nobody sits at the table - the room forgets it. @param {any} t */
export const gambitEmpty = (t) => t.seats.every((/** @type {any} */ s) => !s);

const room = (/** @type {any} */ t, /** @type {any[]} */ events) => ({ to: null, frame: { events, state: gambitPublicView(t) } });

/**
 * Why `gambitSit` would refuse this sit ('no such chair', 'seated', 'taken', 'full', 'bad crown'), or null - pure,
 * nothing moved, so the relay asks it before it spends the room's sit budget (Iliac Hand's AUDIT CARDS-6 C2).
 * @param {any} t @param {{id: string, chair: number, crown: number}} p
 */
export function gambitSitRefusal(t, { id, chair, crown }) {
  if (!Number.isInteger(chair) || chair < 0 || chair >= t.chairs) return 'no such chair';
  if (gambitSeatOf(t, id) >= 0) return 'seated';
  if (t.seats.some((/** @type {any} */ s) => s && s.chair === chair)) return 'taken';
  if (t.seats.every(Boolean)) return 'full';
  if (!Number.isInteger(crown) || crown < 0 || crown >= GAMBIT_CROWN_COUNT) return 'bad crown';
  return null;
}

/**
 * A player sits in `chair` wearing `crown` - KG6: `sub` its account, when it has one (a game between two is rated).
 * Answers the messages, or an error word (gambitSitRefusal's).
 * @param {any} t @param {{id: string, name: string, chair: number, crown: number, now: number, sub?: string|null}} p
 */
export function gambitSit(t, { id, name, chair, crown, now, sub = null }) {
  const no = gambitSitRefusal(t, { id, chair, crown });
  if (no) return no;
  const p = t.seats.findIndex((/** @type {any} */ s) => !s);
  t.seats[p] = { id, name: String(name ?? '').slice(0, HOLDEM_NAME_MAX), chair, crown, ready: false, army: null, idle: 0, sub: typeof sub === 'string' && sub ? sub : null, stake: null };
  return [room(t, [{ t: 'sit', seat: p, chair, name: t.seats[p].name, crown, at: now }])];
}

/**
 * Why `gambitReady` would refuse this Ready, or null - pure, so the relay asks it before it spends a stake's order
 * ('not seated', 'in a game', 'ready' - said once; 'bad army', 'bad crown'; KG6: 'stake needed' at the gold table,
 * 'friendly table' a stake anywhere else, 'stake differs' from the other seat's).
 * @param {any} t @param {{id: string, army: number[], crown?: number, stake?: number|null}} p `stake` the amount
 */
export function gambitReadyRefusal(t, { id, army, crown, stake = null }) {
  const p = gambitSeatOf(t, id);
  if (p < 0) return 'not seated';
  if (t.game) return 'in a game';
  if (t.seats[p].ready) return 'ready';
  if (!Array.isArray(army) || armyRefusal(army) !== null) return 'bad army';
  if (crown !== undefined && (!Number.isInteger(crown) || crown < 0 || crown >= GAMBIT_CROWN_COUNT)) return 'bad crown';
  if (t.gold && stake == null) return 'stake needed';
  if (!t.gold && stake != null) return 'friendly table';
  if (stake != null && !gambitStakeOk(stake)) return 'stake refused';
  const other = t.seats[1 - p];
  if (stake != null && other?.stake && other.stake.amount !== stake) return 'stake differs';
  return null;
}

/**
 * A seated player is READY with `army` (roster ids, lawful in KG_POINT_BUDGET - armyRefusal) and, again, the crown it
 * wears - KG6: at the gold table with `stake`, the relay's spent order's `{j, sub, amount}`. The room hears only that it
 * is (and for what stake); both ready, the deal waits GAMBIT_FIRST_MS. Answers the messages, or an error word
 * (gambitReadyRefusal's).
 * @param {any} t @param {{id: string, army: number[], crown?: number, now: number, stake?: any}} p
 */
export function gambitReady(t, { id, army, crown, now, stake = null }) {
  const no = gambitReadyRefusal(t, { id, army, crown, stake: stake ? stake.amount : null });
  if (no) return no;
  const p = gambitSeatOf(t, id);
  const s = t.seats[p];
  s.army = army.slice();
  if (crown !== undefined) s.crown = crown;
  s.stake = stake ? { j: stake.j, sub: stake.sub, amount: stake.amount } : null;
  s.ready = true;
  if (t.seats.every((/** @type {any} */ x) => x?.ready)) t.nextDealAt = now + GAMBIT_FIRST_MS;
  return [room(t, [{ t: 'ready', seat: p, at: now }])];
}

/** A ready seat takes it back before the deal. Answers the messages, or an error word. @param {any} t @param {{id: string, now: number}} p */
export function gambitUnready(t, { id, now }) {
  const p = gambitSeatOf(t, id);
  if (p < 0) return 'not seated';
  if (t.game) return 'in a game';
  const s = t.seats[p];
  s.ready = false;
  s.army = null;
  stakeBack(t, s, 'stood');
  return [room(t, [{ t: 'unready', seat: p, at: now }])];
}

/** KG6: a cash-out queued for the relay to sign - `r` gold home to stake `j`'s account (net/card/cardReceipt.js `w`'s word). */
function owe(/** @type {any} */ t, /** @type {string|null} */ to, /** @type {any} */ x, /** @type {number} */ r, /** @type {string} */ w) {
  t.cashouts.push({ to, j: x.j, s: x.sub, r, w });
}
/** KG6: a seat's stake, never dealt, handed back whole. */
function stakeBack(/** @type {any} */ t, /** @type {any} */ s, /** @type {string} */ w) {
  if (!s?.stake) return;
  owe(t, s.id, s.stake, s.stake.amount, w);
  s.stake = null;
}

/** The game decided (or forfeited by `left`, the seat that stood or gave it up): the end said, the seats to be ready
 *  again. `how`: 'king' (the law's), 'forfeit', 'idle' (the clock stood `left` up), 'left' (a stand or a socket gone),
 *  'void' (the relay's source broke - no contest). */
function finish(/** @type {any} */ t, /** @type {number} */ now, left = -1, how = 'king') {
  const winner = how === 'void' ? null : left >= 0 ? 1 - left : t.game.over?.winner ?? null;
  const end = { t: 'result', gameNo: t.gameNo, winner, how, names: t.seats.map((/** @type {any} */ s) => s?.name ?? null), at: now };
  t.last = { gameNo: t.gameNo, winner, how, names: end.names, game: t.game };
  // KG6: THE POT - the whole of it the winner's, nothing the loser's; each stake its own player's when nobody won
  const ids = [0, 1].map((k) => t.seats[k]?.id ?? null);
  if (t.pot) {
    for (const k of [0, 1]) {
      const x = t.pot[k];
      if (!x) continue;
      if (winner === null) owe(t, ids[k], x, x.amount, 'void');
      else owe(t, ids[k], x, k === winner ? potOf(t.pot) : 0, k === winner ? 'stood' : 'broke');
    }
  }
  // KG6: A RATED GAME'S RESULT - two accounts, somebody's win
  if (winner !== null && ratedOf(t) && t.id) t.results.push({ j: t.id, f: t.subs.slice(), r: winner, h: how, to: ids });
  t.pot = null; t.subs = null; t.id = null;
  t.game = null;
  t.endAt = null;
  t.clockAt = 0;
  for (const s of t.seats) if (s) { s.army = null; s.idle = 0; }   // ready again only by saying so (the deal let go of it)
  return end;
}

/** KG6: a game's id - 16 hex from the relay's source (Iliac Hand's game id's shape). */
const gameIdOf = (/** @type {() => number} */ rand32) => [rand32(), rand32()].map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');

/** The deal: both armies on the relay's board - the host's at the foot, the guest's at the head. */
function deal(/** @type {any} */ t, /** @type {number} */ now, /** @type {() => number} */ rand32) {
  const game = newGambit({ armies: t.seats.map((/** @type {any} */ s) => s.army), rand32 });
  if (!game) {
    // a source that broke (or an army that slipped the check at Ready): nobody's game - both asked to be ready again,
    // KG6: each stake handed back
    for (const s of t.seats) if (s) { s.ready = false; s.army = null; stakeBack(t, s, 'void'); }
    return [room(t, [{ t: 'unready', seat: 0, why: 'deal', at: now }, { t: 'unready', seat: 1, why: 'deal', at: now }])];
  }
  t.game = game;
  // KG6: the stakes into the pot, the game's id and its two accounts
  t.pot = t.gold ? t.seats.map((/** @type {any} */ s) => s.stake) : null;
  t.id = gameIdOf(rand32);
  t.subs = t.seats.map((/** @type {any} */ s) => s.sub ?? null);
  t.gameNo++;
  t.last = null;
  t.endAt = null;
  t.clockAt = now + GAMBIT_TURN_MS;
  t.dealtAt = now;
  for (const s of t.seats) { s.ready = false; s.army = null; s.idle = 0; s.stake = null; s.spoke = false; }   // AUDIT KG II A1: none has acted in it
  return [room(t, [{ t: 'game', gameNo: t.gameNo, layout: game.layout, crowns: t.seats.map((/** @type {any} */ s) => s.crown), at: now }])];
}

/** A step the law took: its events said, the game decided or the turn's end on its beat. */
function stepped(/** @type {any} */ t, /** @type {any} */ out, /** @type {number} */ now, /** @type {any[]} */ first = []) {
  t.game = out.state;
  const events = [...first, ...out.events.map((/** @type {any} */ e) => ({ ...e, at: now }))];
  if (t.game.over) events.push(finish(t, now));
  else if (t.game.ending) t.endAt = now + GAMBIT_TURN_END_MS;
  return [room(t, events)];
}

/**
 * A seat's COMMAND (the law's: move, attack, potion, end) in the game `gameNo` its panel showed. Answers the messages,
 * or an error word ('no game', 'not seated', 'stale', or the law's refusal - net/kingsGambit.js gambitRefusal).
 * @param {any} t @param {{id: string, cmd: any, gameNo?: number, now: number, rand32: () => number}} p
 */
export function gambitCommand(t, { id, cmd, gameNo, now, rand32 }) {
  if (!t.game) return 'no game';
  const p = gambitSeatOf(t, id);
  if (p < 0) return 'not seated';
  if (gameNo !== undefined && gameNo !== t.gameNo) return 'stale';
  const out = gambitAct(t.game, p, cmd, rand32);
  if ('refused' in out) {
    if (out.refused !== 'rand') return out.refused;
    return [room(t, [finish(t, now, -1, 'void')])];   // the relay's source broke: no contest
  }
  t.seats[p].idle = 0;   // at the table
  t.seats[p].spoke = true;   // AUDIT KG II A1: this seat has acted in the game - its stand concedes it
  return stepped(t, out, now);
}

/** A seat gives up the game under way (the mod's FORFEIT), keeping its chair. Answers the messages, or an error word.
 *  @param {any} t @param {{id: string, gameNo?: number, now: number}} p */
export function gambitForfeit(t, { id, gameNo, now }) {
  if (!t.game) return 'no game';
  const p = gambitSeatOf(t, id);
  if (p < 0) return 'not seated';
  if (gameNo !== undefined && gameNo !== t.gameNo) return 'stale';
  return [room(t, [{ t: 'forfeit', seat: p, at: now }, finish(t, now, p, 'forfeit')])];
}

/**
 * A player stands (or leaves the room, or its socket goes - the mod's FORFEIT online): a game under way is the other
 * seat's. Answers the messages - none when it was not seated. `idle`: the clock stood it up. AUDIT KG II A1: `gameNo`,
 * the game its panel showed when it pressed - a stand naming the game BEFORE the one under way, heard within
 * GAMBIT_LATE_MS of that one's deal and before the seat acted in it, was pressed over the deal: it concedes nothing, and
 * the game it never saw is let go (no contest - each stake home, nothing rated).
 * @param {any} t @param {{id: string, now: number, gameNo?: number, idle?: boolean}} p
 */
export function gambitStand(t, { id, now, gameNo, idle = false }) {
  const p = gambitSeatOf(t, id);
  if (p < 0) return [];
  const events = [];
  const late = !!t.game && Number.isInteger(gameNo) && gameNo < t.gameNo && now - t.dealtAt <= GAMBIT_LATE_MS && !t.seats[p].spoke;
  if (t.game) events.push(late ? finish(t, now, -1, 'void') : finish(t, now, p, idle ? 'idle' : 'left'));
  else stakeBack(t, t.seats[p], 'stood');   // KG6: a stake never dealt goes home whole
  const { name, chair } = t.seats[p];
  t.seats[p] = null;
  // the other seat's readiness is its own; a game no longer waits on a chair left empty
  events.push({ t: 'leave', seat: p, chair, name, ...(idle ? { idle: true } : {}), at: now });
  return [room(t, events)];
}

/** No contest: the room drained with a game under way (both players gone - nobody's win). Answers the messages. @param {any} t @param {number} now */
export function gambitVoid(t, now) {
  return t.game ? [room(t, [finish(t, now, -1, 'void')])] : [];
}

/**
 * THE CLOCK: a turn ending ends on its beat (finishTurn: the hazards, the round, the other side's turn); a turn whose
 * time ran out ends as End turn does (a seat it does so GAMBIT_IDLE_TURNS times running is stood up); a table with both
 * seats ready deals when its pause is over. Answers the messages (none when nothing was due).
 * @param {any} t @param {number} now @param {() => number} rand32
 */
export function gambitTick(t, now, rand32) {
  if (t.game) {
    if (t.endAt !== null) {
      if (now < t.endAt) return [];
      t.endAt = null;
      const out = finishTurn(t.game, rand32);
      if ('refused' in out) return out.refused === 'rand' ? [room(t, [finish(t, now, -1, 'void')])] : [];
      const msgs = stepped(t, out, now);
      if (t.game) t.clockAt = now + GAMBIT_TURN_MS;   // the next side's turn, its own clock
      return msgs;
    }
    if (now < t.clockAt) return [];
    // the turn ran out: it ends as End turn does
    const side = t.game.turn, s = t.seats[side];
    const out = gambitAct(t.game, side, { type: 'end' }, rand32);
    if ('refused' in out) return [];
    if (s) s.idle = (s.idle ?? 0) + 1;
    const msgs = stepped(t, out, now, [{ t: 'timeout', seat: side, at: now }]);
    if (s && s.idle >= GAMBIT_IDLE_TURNS) msgs.push(...gambitStand(t, { id: s.id, now, idle: true }));
    return msgs;
  }
  return t.seats.every((/** @type {any} */ s) => s?.ready) && now >= t.nextDealAt ? deal(t, now, rand32) : [];
}

/** The clock the table next needs the relay's attention at, or null when nothing is due. @param {any} t */
export function gambitNextAt(t) {
  if (t.game) return t.endAt ?? t.clockAt;
  return t.seats.every((/** @type {any} */ s) => s?.ready) ? t.nextDealAt : null;
}

/** What a player newly come to the room (or asking) is owed: the table as the room sees it. @param {any} t @param {string} id */
export const gambitLook = (t, id) => [{ to: id, frame: { events: [], state: gambitPublicView(t) } }];

// ── THE STATE, CHECKED (AUDIT KG A4: a stored table the law did not mint is dropped) ────────────────────────────────

const intIn = (/** @type {any} */ x, /** @type {number} */ lo, /** @type {number} */ hi) => Number.isInteger(x) && x >= lo && x <= hi;
const LAYOUT_KEYS = Object.freeze([...KG_LAYOUTS.map((l) => l.key), KG_OPEN_FIELD.key]);
const TILES = Object.values(KG_TILE);

/**
 * Whether `st` is a game state the law could have minted - every field the law's steps read, of its type and in its
 * range: the board, its hazards (each on the board, of a kind, at most KG_MAX_HAZARDS), its pieces (each a roster unit or
 * a king, on the board's floor, one a cell, numbered apart), the turn and its actions, the round, the potions, the
 * end. True or false.
 * @param {any} st
 */
export function validGambitState(st) {
  if (!st || typeof st !== 'object' || !LAYOUT_KEYS.includes(st.layout)) return false;
  if (!Array.isArray(st.tiles) || st.tiles.length !== KG_COLS * KG_ROWS || !st.tiles.every((/** @type {any} */ x) => TILES.includes(x))) return false;
  if (!Array.isArray(st.hazards) || st.hazards.length > KG_MAX_HAZARDS) return false;
  for (const h of st.hazards) if (!h || typeof h !== 'object' || !intIn(h.col, 0, KG_COLS - 1) || !intIn(h.row, 0, KG_ROWS - 1) || !KG_HAZARD_KINDS.includes(h.kind) || typeof h.active !== 'boolean') return false;
  if (!Array.isArray(st.pieces) || st.pieces.length > GAMBIT_PIECES_MAX) return false;
  const ids = new Set(), cells = new Set();
  for (const p of st.pieces) {
    if (!p || typeof p !== 'object' || !intIn(p.id, 0, 10_000) || ids.has(p.id) || (p.side !== 0 && p.side !== 1)) return false;
    if (typeof p.king !== 'boolean' || typeof p.ranged !== 'boolean') return false;
    if (p.king ? !KG_KING_CLASSES.includes(p.unit) : !rosterUnit(p.unit)) return false;
    if (!intIn(p.col, 0, KG_COLS - 1) || !intIn(p.row, 0, KG_ROWS - 1) || st.tiles[p.row * KG_COLS + p.col] !== KG_TILE.floor) return false;
    const cell = p.row * KG_COLS + p.col;
    if (cells.has(cell)) return false;
    if (!intIn(p.level, 1, 100) || !intIn(p.maxHp, 1, 10_000) || !intIn(p.hp, 1, p.maxHp) || !intIn(p.atk, 0, 10_000)) return false;
    ids.add(p.id); cells.add(cell);
  }
  if (st.turn !== 0 && st.turn !== 1) return false;
  if (!intIn(st.actions, 0, KG_ACTIONS_PER_TURN) || !intIn(st.round, 1, 1_000_000) || typeof st.ending !== 'boolean') return false;
  if (!Array.isArray(st.potions) || st.potions.length !== 2 || !st.potions.every((/** @type {any} */ n) => intIn(n, 0, KG_POTIONS_MAX))) return false;
  if (st.over !== null && !(st.over && typeof st.over === 'object' && (st.over.winner === 0 || st.over.winner === 1) && (st.over.fallen === 0 || st.over.fallen === 1))) return false;
  return true;
}

/** KG6: a seat's stake as the relay spent it: its order's id, its account, one of the stakes. @param {any} x */
const stakeOk = (x) => !!x && typeof x === 'object' && typeof x.j === 'string' && x.j.length > 0 && x.j.length <= 64 && typeof x.sub === 'string' && gambitStakeOk(x.amount);
/** KG6: a queue of what is owed, each of its shape (absent on a table stored before KG6). @param {any} q @param {(x: any) => boolean} ok */
const queueOk = (q, ok) => q === undefined || (Array.isArray(q) && q.length <= GAMBIT_QUEUE_MAX && q.every((x) => !!x && typeof x === 'object' && ok(x)));

/**
 * A stored table, checked as the room loads it (AUDIT KG A4): its seats and its clock of their types, its game one the
 * law could have minted (validGambitState) or none. True or false - the relay drops a table this refuses.
 * @param {any} t
 */
export function gambitTableValid(t) {
  if (!t || typeof t !== 'object' || !intIn(t.chairs, HOLDEM_SEATS_MIN, HOLDEM_SEATS_MAX) || !Number.isSafeInteger(t.gameNo) || t.gameNo < 0) return false;
  if (!Array.isArray(t.seats) || t.seats.length !== 2) return false;
  for (const s of t.seats) {
    if (s === null) continue;
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || typeof s.name !== 'string' || !intIn(s.chair, 0, t.chairs - 1) || !intIn(s.crown, 0, GAMBIT_CROWN_COUNT - 1)) return false;
    if (typeof s.ready !== 'boolean' || !intIn(s.idle ?? 0, 0, GAMBIT_IDLE_TURNS)) return false;
    if (s.spoke !== undefined && typeof s.spoke !== 'boolean') return false;   // AUDIT KG II A1
    if (s.army !== null && !(Array.isArray(s.army) && armyRefusal(s.army) === null)) return false;
    if ((s.sub ?? null) !== null && typeof s.sub !== 'string') return false;   // KG6
    if ((s.stake ?? null) !== null && !(t.gold === true && stakeOk(s.stake))) return false;
  }
  // KG6: the pot (a gold game's two stakes), the game's id and accounts, the queues owed
  if (t.gold !== undefined && typeof t.gold !== 'boolean') return false;
  if ((t.pot ?? null) !== null && !(t.game && Array.isArray(t.pot) && t.pot.length === 2 && t.pot.every(stakeOk) && t.pot[0].amount === t.pot[1].amount)) return false;
  if ((t.id ?? null) !== null && !(typeof t.id === 'string' && GAMBIT_GAME_ID_RE.test(t.id))) return false;
  if ((t.subs ?? null) !== null && !(Array.isArray(t.subs) && t.subs.length === 2 && t.subs.every((/** @type {any} */ x) => x === null || typeof x === 'string'))) return false;
  // AUDIT KG II A8: only what the relay can sign and send - a cash-out a receipt can carry (else it is never signed, never
  // shifted, and every one behind it waits), a result with its two accounts and the two seats it goes to
  const seatId = (/** @type {any} */ x) => x === null || (typeof x === 'string' && x.length > 0 && x.length <= 64);
  if (!queueOk(t.cashouts, (/** @type {any} */ x) => seatId(x.to ?? null) && typeof x.j === 'string' && STAKE_ID_RE.test(x.j) && typeof x.s === 'string' && ID_RE.test(x.s) && Number.isSafeInteger(x.r) && x.r >= 0 && typeof x.w === 'string')) return false;
  if (!queueOk(t.results, (/** @type {any} */ x) => typeof x.j === 'string' && GAMBIT_GAME_ID_RE.test(x.j) && Array.isArray(x.f) && x.f.length === 2 && x.f.every((/** @type {any} */ s) => typeof s === 'string' && ID_RE.test(s)) && x.f[0] !== x.f[1]
    && (x.r === 0 || x.r === 1) && typeof x.h === 'string' && Array.isArray(x.to) && x.to.length === 2 && x.to.every(seatId))) return false;
  if (!Number.isFinite(t.nextDealAt) || !Number.isFinite(t.clockAt) || !(t.endAt === null || Number.isFinite(t.endAt))) return false;
  if (t.game !== null && !(validGambitState(t.game) && t.seats.every(Boolean))) return false;
  return true;
}

// ── THE WIRE ─────────────────────────────────────────────────────────────────────────────────────────────────────

const GAMBIT_OPS = Object.freeze(['sit', 'stand', 'ready', 'unready', 'act', 'forfeit', 'look', 'ack']);
const gameNoOk = (/** @type {any} */ n) => Number.isSafeInteger(n) && n >= 0;
/** A command as the law reads it, its numbers in range - or null. @param {any} c */
function cmdOk(c) {
  if (!c || typeof c !== 'object' || !KG_COMMANDS.includes(c.type)) return null;
  if (c.type === 'end') return { type: 'end' };
  if (!intIn(c.piece, 0, 10_000)) return null;
  if (c.type === 'move') return intIn(c.col, 0, KG_COLS - 1) && intIn(c.row, 0, KG_ROWS - 1) ? { type: 'move', piece: c.piece, col: c.col, row: c.row } : null;
  if (c.type === 'attack') return intIn(c.target, 0, 10_000) ? { type: 'attack', piece: c.piece, target: c.target } : null;
  return { type: 'potion', piece: c.piece };
}

/**
 * A client's word to a King's Gambit table, checked: `{op, table, chair?, chairs?, crown?, army?, cmd?, gameNo?}` or null.
 * `sit` names the chair it takes, the cloth's chairs and its crown; `ready` its army (roster ids - the law checks them at
 * Ready), its crown and, at the gold table, its stake's order (KG6); `act` the law's command and the game it is for;
 * `forfeit` and `stand` the game its panel showed; `ack` a rated result the device holds (KG6); `unready` and `look`
 * the table alone.
 * @param {any} m
 */
export function validGambitIn(m) {
  if (!m || typeof m !== 'object' || !GAMBIT_OPS.includes(m.op)) return null;
  if (!Number.isInteger(m.table) || m.table < 0 || m.table >= HOLDEM_TABLES_MAX) return null;
  if (m.op === 'sit') {
    if (!intIn(m.chairs, HOLDEM_SEATS_MIN, HOLDEM_SEATS_MAX) || !intIn(m.chair, 0, m.chairs - 1) || !intIn(m.crown, 0, GAMBIT_CROWN_COUNT - 1)) return null;
    return { op: 'sit', table: m.table, chair: m.chair, chairs: m.chairs, crown: m.crown };
  }
  if (m.op === 'ready') {
    if (!Array.isArray(m.army) || m.army.length > KG_MAX_UNITS || !m.army.every((/** @type {any} */ x) => intIn(x, 0, 10_000))) return null;
    if (m.crown !== undefined && !intIn(m.crown, 0, GAMBIT_CROWN_COUNT - 1)) return null;
    if (m.stake !== undefined && !(typeof m.stake === 'string' && m.stake.length > 0 && m.stake.length <= HOLDEM_STAKE_MAX)) return null;   // KG6: the service's order on the stake
    return { op: 'ready', table: m.table, army: m.army.slice(), ...(m.crown !== undefined ? { crown: m.crown } : {}), ...(m.stake !== undefined ? { stake: m.stake } : {}) };
  }
  if (m.op === 'ack') return typeof m.j === 'string' && GAMBIT_GAME_ID_RE.test(m.j) ? { op: 'ack', table: m.table, j: m.j } : null;   // KG6: a rated result kept on the device
  if (m.op === 'act') {
    const cmd = cmdOk(m.cmd);
    return cmd && gameNoOk(m.gameNo) ? { op: 'act', table: m.table, gameNo: m.gameNo, cmd } : null;
  }
  if (m.op === 'forfeit' || m.op === 'stand') return m.gameNo === undefined || gameNoOk(m.gameNo) ? { op: m.op, table: m.table, ...(m.gameNo !== undefined ? { gameNo: m.gameNo } : {}) } : null;
  return { op: m.op, table: m.table };
}

/** A seat (0 or 1), or `none` where the field may say nobody. */
const seatOr = (/** @type {any} */ x, /** @type {any} */ none = undefined) => x === 0 || x === 1 || (none !== undefined && x === none);
/** An event of the room's, checked for the fields the panel reads off its own kind; the law's own by `t` alone. @param {any} e */
function eventOk(e) {
  if (!e || typeof e !== 'object' || typeof e.t !== 'string') return false;
  switch (e.t) {
    case 'sit': return seatOr(e.seat) && Number.isInteger(e.chair) && typeof e.name === 'string' && intIn(e.crown, 0, GAMBIT_CROWN_COUNT - 1);
    case 'leave': return seatOr(e.seat) && (e.name == null || typeof e.name === 'string');
    case 'ready': case 'unready': case 'timeout': case 'forfeit': return seatOr(e.seat);
    case 'game': return gameNoOk(e.gameNo) && LAYOUT_KEYS.includes(e.layout) && Array.isArray(e.crowns) && e.crowns.length === 2 && e.crowns.every((/** @type {any} */ c) => intIn(c, 0, GAMBIT_CROWN_COUNT - 1));
    case 'result': return seatOr(e.winner, null) && typeof e.how === 'string' && e.how.length <= WORD_MAX;
    case 'end': return seatOr(e.side);
    case 'move': return seatOr(e.side) && Number.isInteger(e.piece) && Array.isArray(e.from) && Array.isArray(e.to);
    case 'attack': return seatOr(e.side) && Number.isInteger(e.piece) && Number.isInteger(e.target) && Number.isInteger(e.damage);
    case 'potion': return seatOr(e.side) && Number.isInteger(e.piece) && Number.isInteger(e.healed);
    case 'hazard': return seatOr(e.side) && Number.isInteger(e.piece) && KG_HAZARD_KINDS.includes(e.kind) && Number.isInteger(e.damage);
    default: return true;
  }
}

/**
 * The relay's word from a King's Gambit table, checked on the client: a table index and the room's `events` with the
 * table's `state`, or a refusal. True or false.
 * @param {any} m
 */
export function validGambitOut(m) {
  if (!m || typeof m !== 'object' || !Number.isInteger(m.table) || m.table < 0 || m.table >= HOLDEM_TABLES_MAX) return false;
  if (typeof m.error === 'string') return m.error.length <= WORD_MAX;
  if (m.receipt !== undefined) return typeof m.receipt === 'string' && m.receipt.length <= GAMBIT_RECEIPT_MAX;   // KG6: a rated game's result
  if (!Array.isArray(m.events) || m.events.length > 64 || !m.events.every(eventOk)) return false;
  const s = m.state;
  if (!s || typeof s !== 'object' || !intIn(s.chairs, HOLDEM_SEATS_MIN, HOLDEM_SEATS_MAX)) return false;
  if (!Array.isArray(s.seats) || s.seats.length !== 2 || !s.seats.every((/** @type {any} */ x) => x === null || (x && typeof x.id === 'string' && typeof x.name === 'string' && intIn(x.chair, 0, s.chairs - 1) && intIn(x.crown, 0, GAMBIT_CROWN_COUNT - 1) && (x.stake === undefined || gambitStakeOk(x.stake))))) return false;
  if (s.pot !== undefined && !(Number.isSafeInteger(s.pot) && s.pot > 0)) return false;   // KG6
  if (!gameNoOk(s.gameNo) || !Number.isFinite(s.clockAt) || (s.endAt !== undefined && !Number.isFinite(s.endAt))) return false;
  if (s.last != null && !(typeof s.last === 'object' && seatOr(s.last.winner, null) && typeof s.last.how === 'string' && (s.last.game == null || validGambitState(s.last.game)))) return false;
  return s.game === null || (validGambitState(s.game) && s.seats.every(Boolean));
}

// ── THE GUEST'S EYE: the board turned about its middle ───────────────────────────────────────────────────────────

/** A cell turned about the board's middle (the four layouts are point-symmetric: the guest's head is its own foot). */
export const flipCell = (/** @type {number[]} */ [c, r]) => [KG_COLS - 1 - c, KG_ROWS - 1 - r];
/**
 * A state as the GUEST reads it: the board turned about its middle and the sides swapped, so the guest is side 0 at
 * its own foot - the host's half of the client (scenes/gambitTableGame.js) plays it as it plays the host's, and the cloth
 * lays it on the board turned with it (world/gambitCloth.js gambitPlaces `flip`), every cell on the felt where it was.
 * @param {any} st
 */
export function flipGambitState(st) {
  if (!st) return st;
  const tiles = new Array(KG_COLS * KG_ROWS);
  for (let r = 0; r < KG_ROWS; r++) for (let c = 0; c < KG_COLS; c++) tiles[(KG_ROWS - 1 - r) * KG_COLS + (KG_COLS - 1 - c)] = st.tiles[r * KG_COLS + c];
  return {
    ...st, tiles,
    hazards: st.hazards.map((/** @type {any} */ h) => { const [col, row] = flipCell([h.col, h.row]); return { ...h, col, row }; }),
    pieces: st.pieces.map((/** @type {any} */ p) => { const [col, row] = flipCell([p.col, p.row]); return { ...p, col, row, side: 1 - p.side }; }),
    turn: 1 - st.turn, potions: [st.potions[1], st.potions[0]],
    over: st.over ? { winner: 1 - st.over.winner, fallen: 1 - st.over.fallen } : null,
  };
}
/** The room's own events: a seat's number in them (a result's winner too, read against its names) is the relay's
 *  chair order and stays as it is; a deal's crowns turn with the board, the guest's own first. */
const ROOM_EVENTS = Object.freeze(['sit', 'leave', 'ready', 'unready', 'timeout', 'forfeit', 'result', 'game']);
/** An event of the game as the guest reads it (its sides swapped, its cells turned). @param {any} e */
export function flipGambitEvent(e) {
  if (ROOM_EVENTS.includes(e.t)) return e.t === 'game' ? { ...e, crowns: [e.crowns[1], e.crowns[0]] } : { ...e };
  const out = { ...e };
  for (const k of ['side', 'winner', 'fallen']) if (e[k] === 0 || e[k] === 1) out[k] = 1 - e[k];
  for (const k of ['from', 'to']) if (Array.isArray(e[k])) out[k] = flipCell(e[k]);
  if (Array.isArray(e.cells)) out.cells = e.cells.map(flipCell);
  return out;
}
/** A command the guest gives, as the relay reads it (its cell turned back; a piece's number is its own). @param {any} cmd */
export function unflipCommand(cmd) {
  if (cmd?.type !== 'move') return cmd;
  const [col, row] = flipCell([cmd.col, cmd.row]);
  return { ...cmd, col, row };
}
