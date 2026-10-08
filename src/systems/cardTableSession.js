// @ts-check
// CARDS4 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 14; Mac: "Hold'em first", "Real gold", "Yes, patrons
// play"): THE TAVERN TABLE'S EVENING - pure, DOM-free, clocked by the `now` it is handed. The player and the tavern's
// patrons at one card table, hand after hand of the cards' law (net/cardLaw.js), the patrons playing by their tempers
// (systems/cardPatrons.js). The host (scenes/worldModes.js) seats it, moves the gold in and out, and shows it; nothing
// here touches a purse, a window or the scene.
//
// THE EVENING. The player buys in for chips (the host takes the gold); patrons sit with purses of their own. Each hand
// the button moves one live seat on, the deck is shuffled from the table's source, and the action goes round: the
// player's own when it is his turn, a patron's after a moment's thought (THINK_MS and its spread, so the table has a
// rhythm and a patron is never instant). A patron who loses his purse leaves the table; when the player is alone, or out
// of chips, the evening is over. Standing up folds the player's hand out of turn (cardLaw foldSeat) - the chips in the
// pot stay there - and cashes out the rest at once.
//
// THE PRESENTER reads `events` (drained by the host): a hand dealt, an action taken, a street turned, a showdown, a
// patron leaving, the evening's end - each with the clock it happened on, so CARDS3's card bodies can throw the deal and
// slide the chips on it.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { newHand, act, foldSeat, legalActions, viewFor, shuffleDeck, HOLDEM_SEATS_MIN, HOLDEM_SEATS_MAX } from '../net/cardLaw.js';
import { patronDecision, unit, PATRON_TEMPERS } from './cardPatrons.js';
import { DEAL_STAGGER, THROW_LAND_S, FLIP_S, RIFFLE_S, GATHER_S } from '../world/cardMotion.js';

/** MEASURE (CARDS4): a patron's thought before he acts, and its spread - a table with a rhythm. */
export const THINK_MS = 900;
export const THINK_SPREAD_MS = 1300;
/** MEASURE (CARDS4): the pause after a hand's end before the next deal - the showdown seen, the pot pushed. */
export const HAND_GAP_MS = 3000;
/** The streets by the board's length - one event for each one crossed. */
export const STREET_OF = Object.freeze({ 3: 'flop', 4: 'turn', 5: 'river' });
/** AUDIT CARDS-2 M6: how long the cloth takes to show `cards` thrown (the deal's pace, the last one landing, a board's
 *  turn) - no patron acts on cards still in the air. */
export const settleMs = (cards, turned = false) => (cards > 0 ? Math.round(((cards - 1) * DEAL_STAGGER + THROW_LAND_S + (turned ? FLIP_S : 0)) * 1000) : 0);
/** MEASURE (CARDS4): the stakes a tavern's quality sets (its building's quality byte, 1..20) - the big blind in gold;
 *  the small blind half of it. */
export const TABLE_STAKES = Object.freeze([
  Object.freeze({ upTo: 7, bb: 2 }),
  Object.freeze({ upTo: 13, bb: 10 }),
  Object.freeze({ upTo: 20, bb: 50 }),
]);
/** MEASURE (CARDS4): a buy-in in big blinds - at least, at most, and a patron's purse's range. */
export const BUY_IN_MIN_BB = 20;
export const BUY_IN_MAX_BB = 100;
/** The buy-in the panel offers first. */
export const BUY_IN_START_BB = 40;
export const PURSE_MIN_BB = 30;
export const PURSE_MAX_BB = 120;

/** The stakes for a tavern of `quality`: `{sb, bb}`. */
export function stakesFor(quality) {
  const q = Math.max(1, Math.min(20, Math.round(Number(quality) || 1)));
  const { bb } = TABLE_STAKES.find((s) => q <= s.upTo) ?? TABLE_STAKES[TABLE_STAKES.length - 1];
  return { sb: Math.max(1, Math.floor(bb / 2)), bb };
}

/** The buy-in a player with `gold` may take at these stakes: `{min, max}`, or null when he cannot afford the least. */
export function buyInRange(gold, { bb }) {
  const min = BUY_IN_MIN_BB * bb, max = Math.min(BUY_IN_MAX_BB * bb, Math.floor(Number(gold) || 0));
  return max >= min ? { min, max } : null;
}

/**
 * Patrons for a table: one per name (at most the table's seats less the player's), each a temper and a purse drawn from
 * the table's source.
 * @param {string[]} names
 * @param {{bb: number}} stakes
 * @param {() => number} rand32
 * @param {number} [seats]
 */
export function seatPatrons(names, { bb }, rand32, seats = HOLDEM_SEATS_MAX) {
  const tempers = Object.keys(PATRON_TEMPERS);
  return names.slice(0, Math.max(0, seats - 1)).map((name, i) => ({
    id: `patron:${i}`, name,
    temper: tempers[Math.floor(unit(rand32) * tempers.length)],
    stack: (PURSE_MIN_BB + Math.floor(unit(rand32) * (PURSE_MAX_BB - PURSE_MIN_BB + 1))) * bb,
  }));
}

// AUDIT CARDS-2 H2: THE REGULARS' BOOK. A tavern's regulars keep their purses and their tempers for the game day - a
// regular you broke is gone till tomorrow, and standing up and sitting down again seats the same purses, never fresh
// ones (the audit's sim refilled them at every sitting and farmed them without end). The book rides the character's
// save (systems/save.js, beside the arena's ladder), so a load puts the regulars back as it puts the purse back.
/** MEASURE: the taverns the book remembers - the oldest day goes first. */
export const REGULARS_BOOK_MAX = 24;

/**
 * The regulars at a table today: the book's own for `key` (a building) on `day` at these stakes, else a fresh evening's
 * from seatPatrons. Answers patrons with chips (a broke one stays out). Never writes the book.
 * @param {any} book
 * @param {string} key
 * @param {number} day
 * @param {string[]} names
 * @param {{bb: number}} stakes
 * @param {() => number} rand32
 * @param {number} [seats]
 */
export function regularsFor(book, key, day, names, stakes, rand32, seats = HOLDEM_SEATS_MAX) {
  const fresh = seatPatrons(names, stakes, rand32, seats);
  const kept = book?.[key];
  if (!kept || kept.day !== day || kept.bb !== stakes.bb || !Array.isArray(kept.purses)) return fresh;
  return fresh.flatMap((p, i) => {
    const stack = Math.floor(Number(kept.purses[i]));
    const temper = PATRON_TEMPERS[kept.tempers?.[i]] ? kept.tempers[i] : p.temper;
    return Number.isSafeInteger(stack) && stack > 0 ? [{ ...p, temper, stack }] : [];
  });
}

/**
 * The book after an evening at `key` on `day`: every regular's purse as the table left it (a broke one at 0), by the
 * names' order. A new book; the oldest days dropped past REGULARS_BOOK_MAX.
 * @param {any} book
 * @param {string} key
 * @param {number} day
 * @param {string[]} names
 * @param {{bb: number}} stakes
 * @param {{name: string, stack: number, temper?: string, kind: string}[]} seats  the session's seats
 */
export function regularsAfter(book, key, day, names, stakes, seats) {
  const by = new Map(seats.filter((s) => s.kind === 'patron').map((s) => [s.name, s]));
  const kept = book?.[key]?.day === day && book[key].bb === stakes.bb ? book[key] : null;
  const purses = names.map((n, i) => (by.has(n) ? Math.max(0, by.get(n).stack) : (kept?.purses?.[i] ?? 0)));
  const tempers = names.map((n, i) => by.get(n)?.temper ?? kept?.tempers?.[i] ?? null);
  const next = { ...(book && typeof book === 'object' ? book : {}), [key]: { day, bb: stakes.bb, purses, tempers } };
  const keys = Object.keys(next).sort((a, b) => (next[b].day ?? 0) - (next[a].day ?? 0));
  return Object.fromEntries(keys.slice(0, REGULARS_BOOK_MAX).map((k) => [k, next[k]]));
}

/** The book as the save keeps it, and back - only well-formed entries, never more than REGULARS_BOOK_MAX. */
export function regularsBookRestore(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw).slice(0, REGULARS_BOOK_MAX)) {
    if (!v || !Number.isSafeInteger(v.day) || !Number.isSafeInteger(v.bb) || !Array.isArray(v.purses) || v.purses.length > HOLDEM_SEATS_MAX) continue;
    out[k] = { day: v.day, bb: v.bb, purses: v.purses.map((x) => Math.max(0, Math.floor(Number(x)) || 0)), tempers: Array.isArray(v.tempers) ? v.tempers.map((t) => (PATRON_TEMPERS[t] ? t : null)) : [] };
  }
  return out;
}

/** @typedef {{ id: string, name: string, stack: number, kind: 'player'|'patron', temper?: string, gone?: boolean }} TableSeat */

/**
 * The evening. `player` `{id, name, stack}` (the buy-in, in chips = gold), `patrons` from seatPatrons, `stakes` from
 * stakesFor, `rand32` the table's source (the shuffle, the tempers' rolls, the thinking), `now` the clock it opens on.
 */
export class CardTableSession {
  /**
   * @param {{player: {id: string, name: string, stack: number}, patrons: {id: string, name: string, temper: string, stack: number}[], stakes: {sb: number, bb: number}, rand32: () => number, now: number}} p
   */
  constructor({ player, patrons, stakes, rand32, now }) {
    /** @type {TableSeat[]} */
    this.seats = [{ ...player, kind: 'player' }, ...patrons.map((p) => /** @type {TableSeat} */ ({ ...p, kind: 'patron' }))];
    this.stakes = stakes;
    this.rand32 = rand32;
    this.button = -1;          // a seat index into this.seats
    this.hand = null;          // the cardLaw state while a hand runs
    this.handSeats = [];       // the hand's seat index -> this.seats index
    this.handNo = 0;
    this.nextDealAt = now;     // the first hand deals at once
    this.thinkUntil = 0;       // the patron to act acts at this clock
    this.over = null;          // why the evening ended, once it has
    this.lastShowdown = null;  // the last hand's end, until the next deal - what beat you (AUDIT CARDS-2 M7)
    this.events = [];
  }

  /** This.seats' index of the player. */
  get playerSeat() { return this.seats.findIndex((s) => s.kind === 'player'); }
  /** The player's index in the running hand, or -1. */
  get playerInHand() { return this.handSeats.indexOf(this.playerSeat); }
  /** The seats that can play the next hand: chips, and still at the table. */
  liveSeats() { return this.seats.flatMap((s, i) => (s.stack > 0 && !s.gone ? [i] : [])); }

  _say(e, now) { this.events.push({ ...e, at: now }); }

  /** Deal the next hand, if the table can. */
  _deal(now) {
    const live = this.liveSeats();
    if (live.length < HOLDEM_SEATS_MIN || !live.includes(this.playerSeat)) {
      this.over = this.seats[this.playerSeat].stack > 0 ? 'empty' : 'broke';
      this._say({ t: 'over', why: this.over }, now);
      return;
    }
    // The button moves one live seat on (the first hand: the first live seat).
    const at = live.findIndex((i) => i > this.button);
    this.button = live[at < 0 ? 0 : at];
    this.handSeats = live;
    this.handNo++;
    this.lastShowdown = null;
    this.hand = newHand({
      seats: live.map((i) => ({ id: this.seats[i].id, stack: this.seats[i].stack })),
      button: live.indexOf(this.button), sb: this.stakes.sb, bb: this.stakes.bb, deck: shuffleDeck(this.rand32),
    });
    this._say({ t: 'hand', hand: this.handNo, button: this.button, seats: live.slice() }, now);
    this._think(now, settleMs(live.length * 2) + Math.round((GATHER_S + RIFFLE_S) * 1000));   // the first to act waits for the last hand's gathering, the riffle and the deal to land (CARDS-TIDY)
    this._afterAction(null, now);   // a hand the blinds settled at the deal still turns its streets (AUDIT CARDS-2 L2)
  }

  /** The patron to act thinks from now - and never before the cloth has shown what he is thinking about. */
  _think(now, settle = 0) { this.thinkUntil = now + Math.max(settle, THINK_MS + Math.floor(unit(this.rand32) * THINK_SPREAD_MS)); }

  /** After an action (or the deal): a street turned, the hand's end. */
  _afterAction(prev, now) {
    const h = this.hand;
    // AUDIT CARDS-2 L1: one event for every street crossed - an all-in runs the flop, the turn and the river out in one
    // action, and each is a street of its own on the cloth (its burn, its cards) and in the log
    const from = prev ? prev.board.length : 0;
    for (const len of [3, 4, 5]) if (from < len && h.board.length >= len) this._say({ t: 'street', street: STREET_OF[len], board: h.board.slice(0, len) }, now);
    if (h.board.length > from && !h.result) this.thinkUntil = Math.max(this.thinkUntil, now + settleMs(h.board.length - from, true));
    if (h.result) {
      // The chips go home to the seats; a broke patron leaves.
      h.seats.forEach((s, k) => { this.seats[this.handSeats[k]].stack = s.stack; });
      const end = { t: 'showdown', hand: this.handNo, seats: this.handSeats.slice(), result: structuredClone(h.result), board: h.board.slice(), holes: viewFor(h, -1).seats.map((s) => s.hole) };
      this.lastShowdown = structuredClone(end);
      this._say(end, now);
      for (const i of this.handSeats) {
        const s = this.seats[i];
        if (s.kind === 'patron' && s.stack <= 0 && !s.gone) { s.gone = true; this._say({ t: 'leave', seat: i, name: s.name }, now); }
      }
      this.nextDealAt = now + HAND_GAP_MS;
      this.hand = null;
      this.handSeats = [];
    }
  }

  /** One action at the hand, by this.seats index; false when the law refuses it. */
  _act(seat, action, now) {
    const k = this.handSeats.indexOf(seat);
    const prev = this.hand;
    const next = act(prev, k, action);
    if (!next) return false;
    this.hand = next;
    const paid = next.seats[k].total - prev.seats[k].total;
    // a raise into no bet is a bet; a seat left with nothing is all in (AUDIT CARDS-2 L10: the log says which)
    this._say({ t: 'act', seat, type: action.type, to: action.to ?? null, paid, bet: action.type === 'raise' && prev.currentBet === 0, allIn: next.seats[k].allIn && !prev.seats[k].allIn }, now);
    this._think(now);
    this._afterAction(prev, now);
    return true;
  }

  /** The clock moves: a patron whose thought is done acts; a finished hand's pause runs out and the next is dealt. */
  tick(now) {
    if (this.over) return;
    if (!this.hand) { if (now >= this.nextDealAt) this._deal(now); return; }
    const k = this.hand.toAct;
    if (k < 0) return;
    const seat = this.handSeats[k];
    const s = this.seats[seat];
    if (s.kind !== 'patron' || now < this.thinkUntil) return;
    const action = patronDecision({ view: viewFor(this.hand, k), seat: k, legal: legalActions(this.hand, k), temper: PATRON_TEMPERS[s.temper], rand32: this.rand32 });
    this._act(seat, action, now);
  }

  /** What the player may do now (legalActions), or null when it is not his turn. */
  legal() {
    const k = this.playerInHand;
    return this.hand && k >= 0 ? legalActions(this.hand, k) : null;
  }

  /** The player acts; false when it is not his turn or the law refuses it. */
  playerAct(action, now) {
    if (!this.legal()) return false;
    return this._act(this.playerSeat, action, now);
  }

  /** The table as the player sees it: the hand's view at his seat, and every seat's name, kind, stack and whether gone. */
  view() {
    const k = this.playerInHand;
    return {
      handNo: this.handNo, button: this.button, stakes: { ...this.stakes }, over: this.over,
      seats: this.seats.map((s) => ({ id: s.id, name: s.name, kind: s.kind, stack: s.stack, gone: !!s.gone })),
      handSeats: this.handSeats.slice(),
      hand: this.hand ? viewFor(this.hand, k) : null,
      showdown: this.lastShowdown ? structuredClone(this.lastShowdown) : null,
    };
  }

  /** The events since the last drain. */
  drain() { const e = this.events; this.events = []; return e; }

  /**
   * The player stands up: his hand folded out of turn (its chips stay in the pot), the evening over for him. Answers the
   * chips he takes away - the host turns them back into gold.
   */
  leave(now) {
    const p = this.playerSeat;
    const k = this.playerInHand;
    if (this.hand && k >= 0 && !this.hand.seats[k].folded) {
      const prev = this.hand;
      const next = foldSeat(prev, k);
      if (next) { this.hand = next; this._say({ t: 'act', seat: p, type: 'fold', to: null, paid: 0 }, now); this._afterAction(prev, now); }
    }
    // Mid-hand, his stack is the hand's (what he had not put in); between hands, the seat's.
    const chips = this.hand && k >= 0 ? this.hand.seats[k].stack : this.seats[p].stack;
    this.seats[p].stack = 0;
    if (this.hand && k >= 0) this.hand.seats[k].stack = 0;   // folded: the law never asks it for a chip again
    this.seats[p].gone = true;
    if (!this.over) { this.over = 'left'; this._say({ t: 'over', why: 'left' }, now); }
    return chips;
  }
}
