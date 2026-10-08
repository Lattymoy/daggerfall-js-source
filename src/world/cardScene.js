// @ts-check
// CARDS3 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 3): THE CARDS ON THE TABLE - pure, DOM-free. The
// table's evening (systems/cardTableSession.js events) as card and chip bodies at the table's own places, each moving
// by world/cardMotion.js: the hole cards thrown from the dealer's hand to every seat in the deal's order, the player's
// own turned up to him; a burn before each street and the board thrown face down and turned; a folded hand slid to the
// muck; at a shown showdown every hand still in turned over. The chips are the view's own numbers laid out: each seat's
// stack before it, its bet nearer the middle, the pot in the middle - and a street's bets pushed into the pot, the pot
// pushed to its winner. `poses(t)` is the whole picture at clock `t` (seconds); nothing here draws.
//
// THE PLACES (all world, on the table's top): a seat's hole cards HOLE_IN past the edge before it, side by side; its bet
// BET_IN past the edge; its stack STACK_IN, to its right; the board in a row of BOARD_SLOTS along the table's long side,
// through its middle; the burn at the board's head; the muck and the pot either side of the board.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { CARD_W, CARD_T, DEAL_LIFT, dealMotion, flipMotion, flipShift, chipDiscs, pushAt, hashSeed, PUSH_S } from './cardMotion.js';
import { SEAT_OUT } from '../player/seatPose.js';

/** MEASURE (CARDS3): the places on the cloth, metres in from a seat's edge of the table. */
export const HOLE_IN = 0.12;
export const BET_IN = 0.26;
export const STACK_IN = 0.06;
export const STACK_SIDE = 0.13;
/** MEASURE (CARDS3): the board's row and the pot's and muck's offsets across it. */
export const BOARD_SLOTS = 5;
export const BOARD_GAP = CARD_W * 1.25;
export const POT_ACROSS = 0.13;
/** MEASURE (CARDS3): the deal's rhythm - between two cards thrown, and from a card's settling to its turning. */
export const DEAL_STAGGER = 0.11;
export const TURN_DELAY = 0.12;

const SEC = (ms) => ms / 1000;

/**
 * The table's places for its seats. `frame` from cardTables tableFrame; `seats` the physical seats (cardTableSeats -
 * `{feet, yaw}`); `seatOf[i]` the physical seat of the session's seat i.
 * @param {{centre: number[], axisYaw: number}} frame
 * @param {{feet: number[], yaw: number}[]} seats
 * @param {number[]} seatOf
 */
export function tablePlaces(frame, seats, seatOf) {
  const top = frame.centre[1];
  const a = [Math.sin(frame.axisYaw), Math.cos(frame.axisYaw)];   // along the board
  const p = [Math.cos(frame.axisYaw), 0 - Math.sin(frame.axisYaw)];   // across it
  const at = (u, v) => [frame.centre[0] + a[0] * u + p[0] * v, top, frame.centre[2] + a[1] * u + p[1] * v];
  const seatPlace = (s) => {
    const f = [Math.sin(s.yaw), Math.cos(s.yaw)], r = [Math.cos(s.yaw), 0 - Math.sin(s.yaw)];
    const inward = (d, side = 0) => [s.feet[0] + f[0] * (SEAT_OUT + d) + r[0] * side, top, s.feet[2] + f[1] * (SEAT_OUT + d) + r[1] * side];
    return {
      yaw: s.yaw,
      holes: [inward(HOLE_IN, -CARD_W * 0.56), inward(HOLE_IN, CARD_W * 0.56)],
      bet: inward(BET_IN), stack: inward(STACK_IN, STACK_SIDE),
      deal: [...inward(0).slice(0, 1), top + DEAL_LIFT, inward(0)[2]],   // the dealer's hand over the edge before him
    };
  };
  return {
    seats: seatOf.map((k) => seatPlace(seats[k])),
    board: Array.from({ length: BOARD_SLOTS }, (_, i) => at((i - (BOARD_SLOTS - 1) / 2) * BOARD_GAP, 0)),
    boardYaw: frame.axisYaw + Math.PI / 2,
    burn: at(-((BOARD_SLOTS + 1) / 2) * BOARD_GAP, 0),
    muck: at(0, POT_ACROSS),
    pot: at(0, -POT_ACROSS),
  };
}

/** The table's evening on the cloth. */
export class CardScene {
  /**
   * @param {{places: ReturnType<typeof tablePlaces>, playerSeat: number, tableSeed?: number}} p
   */
  constructor({ places, playerSeat, tableSeed = 0 }) {
    this.places = places;
    this.playerSeat = playerSeat;   // the session's seat index of the player
    this.tableSeed = tableSeed;
    /** @type {{id: string, card: number, seat: number, motions: any[]}[]} */
    this.cards = [];
    this.handNo = 0;
    this.board = 0;
    this.dealer = 0;
    this.pushes = [];   // { amount, from, to, t0, yaw }
    this.lastBets = new Map();   // session seat -> its bet on the street, for the push at the street's end
  }

  /** The place a card lies on the cloth: the top and its thickness, and a little more for each card under it. */
  _rest(p, layer = 0) { return [p[0], p[1] + CARD_T * (0.5 + layer), p[2]]; }

  /** The card's latest motion's end - where and how it rests now. */
  _restOf(c) { const m = c.motions[c.motions.length - 1]; return m.at(Infinity); }

  /**
   * One session event, at its clock. `holeOf(seat, r)` answers the card a seat's r-th hole card is, when the viewer may
   * know it (the player's own; everyone's at a shown showdown) - else -1.
   * @param {any} e
   * @param {(seat: number, r: number) => number} holeOf
   */
  onEvent(e, holeOf) {
    const t = SEC(e.at);
    if (e.t === 'hand') {
      this.cards = [];
      this.pushes = [];
      this.lastBets.clear();
      this.handNo = e.hand;
      this.board = 0;
      this.dealer = e.button;
      const n = e.seats.length, btn = e.seats.indexOf(e.button);
      const from = this.places.seats[e.button].deal;
      let order = 0;
      for (let r = 0; r < 2; r++) for (let k = 1; k <= n; k++) {
        const seat = e.seats[(btn + k) % n];
        const place = this.places.seats[seat];
        const mine = seat === this.playerSeat;
        const m = dealMotion({ from, to: this._rest(place.holes[r], r), yaw: place.yaw, roll: Math.PI, t0: t + DEAL_STAGGER * order++, seed: hashSeed(this.tableSeed, this.handNo, seat, r) });
        const motions = /** @type {any[]} */ ([m]);
        if (mine) motions.push(flipMotion({ pos: m.rest, yaw: m.at(Infinity).yaw, fromRoll: Math.PI, t0: m.t1 + TURN_DELAY, pivot: 'middle' }));   // he turns his own up where they lie
        this.cards.push({ id: `h${this.handNo}:${seat}:${r}`, card: mine ? holeOf(seat, r) : -1, seat, motions });
      }
      return;
    }
    if (e.t === 'street') {
      this._pushBets(t);
      const from = this.places.seats[this.dealer].deal;
      let order = 0;
      const burn = dealMotion({ from, to: this._rest(this.places.burn, this.cards.filter((c) => c.seat === -2).length), yaw: this.places.boardYaw, roll: Math.PI, t0: t, seed: hashSeed(this.tableSeed, this.handNo, 90 + this.board) });
      this.cards.push({ id: `b${this.handNo}:${this.board}`, card: -1, seat: -2, motions: [burn] });
      order++;
      for (let i = this.board; i < e.board.length; i++) {
        // thrown a width short: the dealer's turn over the edge lays it on its slot
        const m = dealMotion({ from, to: flipShift(this._rest(this.places.board[i]), this.places.boardYaw), yaw: this.places.boardYaw, roll: Math.PI, t0: t + DEAL_STAGGER * order++, seed: hashSeed(this.tableSeed, this.handNo, 100 + i) });
        this.cards.push({ id: `c${this.handNo}:${i}`, card: e.board[i], seat: -1, motions: [m, flipMotion({ pos: m.rest, yaw: m.at(Infinity).yaw, fromRoll: Math.PI, t0: m.t1 + TURN_DELAY })] });
      }
      this.board = e.board.length;
      return;
    }
    if (e.t === 'act' && e.type === 'fold') {
      // the folded hand slides face down to the muck
      let layer = this.cards.filter((c) => c.seat === -3).length;
      for (const c of this.cards.filter((x) => x.seat === e.seat)) {
        const at = this._restOf(c);
        c.motions.push(dealMotion({ from: at.pos, to: this._rest(this.places.muck, layer++), yaw: this.places.boardYaw, roll: Math.PI, t0: t, seed: hashSeed(this.tableSeed, this.handNo, 200 + layer) }));
        c.seat = -3;
      }
      return;
    }
    if (e.t === 'showdown') {
      this._pushBets(t);
      if (e.result.shown) {
        let order = 0;
        e.seats.forEach((seat, k) => {
          if (!e.holes[k]) return;
          for (const c of this.cards.filter((x) => x.seat === seat)) {
            const at = this._restOf(c);
            if (Math.cos(at.roll) > 0) continue;   // already face up (the player's own)
            c.card = e.holes[k][Number(c.id.split(':')[2])];
            c.motions.push(flipMotion({ pos: at.pos, yaw: at.yaw, fromRoll: at.roll, t0: t + DEAL_STAGGER * order++, pivot: 'middle' }));   // a hand shown turns where it lies
          }
        });
      }
      // the pot to its winner(s), after the turn
      const pot = e.result.pots.reduce((a, p) => a + p.amount, 0);
      const winners = e.result.payouts.map((p, k) => (p > 0 ? e.seats[k] : -1)).filter((s) => s >= 0);
      for (const w of winners) this.pushes.push({ amount: e.result.payouts[e.seats.indexOf(w)], from: this.places.pot, to: this.places.seats[w].stack, t0: t + 0.6, yaw: this.places.seats[w].yaw, toSeat: w, potShare: pot });
    }
  }

  /** A street's end: every bet slides into the pot. */
  _pushBets(t) {
    for (const [seat, amount] of this.lastBets) if (amount > 0) this.pushes.push({ amount, from: this.places.seats[seat].bet, to: this.places.pot, t0: t, yaw: this.places.seats[seat].yaw });
    this.lastBets.clear();
  }

  /**
   * The picture at clock `t` (seconds): `{cards: [{card, pos, yaw, roll}], chips: [{value, pos}]}`. `view` is the
   * session's view() - the stacks, the bets and the pot are its numbers. It also notes each seat's bet, so a street's
   * end pushes what lay there (the host draws a frame between any two events, so the note is never stale).
   * @param {number} t
   * @param {any} view
   */
  poses(t, view) {
    const cards = [];
    for (const c of this.cards) {
      // the motion in force: the last one begun
      let m = c.motions[0];
      for (const x of c.motions) if (t >= x.t0) m = x;
      const p = m.at(t);
      if (p.held) continue;   // still in the dealer's hand
      cards.push({ card: c.card, pos: p.pos, yaw: p.yaw, roll: p.roll });
    }
    const chips = [];
    const live = this.pushes.filter((p) => t < p.t0 + PUSH_S);
    for (const p of live) chips.push(...chipDiscs(p.amount, pushAt(p.from, p.to, p.t0, Math.max(t, p.t0)), p.yaw));
    if (view) {
      const hand = view.hand;
      let pot = 0;
      view.seats.forEach((s, i) => {
        const place = this.places.seats[i];
        if (!place || s.gone) return;
        const k = view.handSeats.indexOf(i);
        const h = hand && k >= 0 ? hand.seats[k] : null;
        // chips still sliding home are not yet in the stack they slide to
        const coming = live.filter((p) => p.toSeat === i && t < p.t0 + PUSH_S).reduce((a, p) => a + p.amount, 0);
        const stack = (h ? h.stack : s.stack) - coming, bet = h ? h.bet : 0;
        if (h) { this.lastBets.set(i, bet); pot += h.total - h.bet; }
        chips.push(...chipDiscs(stack, place.stack, place.yaw));
        if (bet > 0) chips.push(...chipDiscs(bet, place.bet, place.yaw));
      });
      // the pot less the bets still sliding into it; none while it slides to its winner
      const sliding = live.filter((p) => p.to === this.places.pot).reduce((a, p) => a + p.amount, 0);
      if (pot - sliding > 0 && !live.some((p) => p.potShare)) chips.push(...chipDiscs(pot - sliding, this.places.pot, this.places.boardYaw));
    }
    return { cards, chips };
  }
}
