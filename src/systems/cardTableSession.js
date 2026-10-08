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

/** MEASURE (CARDS4): a patron's thought before he acts, and its spread - a table with a rhythm. */
export const THINK_MS = 900;
export const THINK_SPREAD_MS = 1300;
/** MEASURE (CARDS4): the pause after a hand's end before the next deal - the showdown seen, the pot pushed. */
export const HAND_GAP_MS = 3000;
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
    this.hand = newHand({
      seats: live.map((i) => ({ id: this.seats[i].id, stack: this.seats[i].stack })),
      button: live.indexOf(this.button), sb: this.stakes.sb, bb: this.stakes.bb, deck: shuffleDeck(this.rand32),
    });
    this._say({ t: 'hand', hand: this.handNo, button: this.button, seats: live.slice() }, now);
    this._think(now);
    this._afterAction(null, now);
  }

  /** The patron to act thinks from now. */
  _think(now) { this.thinkUntil = now + THINK_MS + Math.floor(unit(this.rand32) * THINK_SPREAD_MS); }

  /** After an action (or the deal): a street turned, the hand's end. */
  _afterAction(prev, now) {
    const h = this.hand;
    if (prev && h.board.length !== prev.board.length) this._say({ t: 'street', street: h.street, board: h.board.slice() }, now);
    if (h.result) {
      // The chips go home to the seats; a broke patron leaves.
      h.seats.forEach((s, k) => { this.seats[this.handSeats[k]].stack = s.stack; });
      this._say({ t: 'showdown', hand: this.handNo, seats: this.handSeats.slice(), result: structuredClone(h.result), board: h.board.slice(), holes: viewFor(h, -1).seats.map((s) => s.hole) }, now);
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
    this._say({ t: 'act', seat, type: action.type, to: action.to ?? null, paid }, now);
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
