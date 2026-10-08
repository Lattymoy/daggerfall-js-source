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
import { CARD_W, CARD_L, CARD_T, DEAL_LIFT, DEAL_STAGGER, dealMotion, flipMotion, flipShift, chipDiscs, pushAt, hashSeed, PUSH_S, SCOOP_LIFT, RIFFLE_S, riffleAt } from './cardMotion.js';
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
/** MEASURE (AUDIT CARDS-2 L6): a bet's clearance from the middle's things, and the least a small table squeezes the
 *  places in to. */
export const CHIP_CLEAR = 0.07;
export const PLACE_FIT_MIN = 0.35;
/** MEASURE (CARDS3): the deal's rhythm - from a card's settling to its turning (between two cards thrown is the
 *  motion's DEAL_STAGGER, which the session's clock waits on too). */
export const TURN_DELAY = 0.12;
/** MEASURE (AUDIT CARDS-2 M4): the beat between the last card turned and the pot's push. */
export const POT_BEAT = 0.35;

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
    // AUDIT CARDS-2 L6: a small table's places come in no closer than the middle's own things - the board's row (and its
    // burn) for a seat at an end, the pot and the muck for a seat along a side; a big table keeps the full distances
    const room = (frame.centre[0] - s.feet[0]) * f[0] + (frame.centre[2] - s.feet[2]) * f[1] - SEAT_OUT;
    const alongBoard = Math.abs(f[0] * a[0] + f[1] * a[1]) > Math.SQRT1_2;
    const clear = alongBoard ? (BOARD_SLOTS / 2 + 1) * BOARD_GAP + CARD_L / 2 + CHIP_CLEAR : POT_ACROSS + CHIP_CLEAR;
    const fit = Math.max(PLACE_FIT_MIN, Math.min(1, (room - clear) / BET_IN));
    const inward = (d, side = 0) => [s.feet[0] + f[0] * (SEAT_OUT + d * fit) + r[0] * side, top, s.feet[2] + f[1] * (SEAT_OUT + d * fit) + r[1] * side];
    return {
      yaw: s.yaw,
      holes: [inward(HOLE_IN, -CARD_W * 0.56), inward(HOLE_IN, CARD_W * 0.56)],
      bet: inward(BET_IN), stack: inward(STACK_IN, STACK_SIDE),
      deal: [...inward(0).slice(0, 1), top + DEAL_LIFT, inward(0)[2]],   // the dealer's hand over the edge before him
      deck: inward(BET_IN * 0.7, -CARD_W * 2.2),   // CARDS3b: where he riffles the deck, to the left of his bet
    };
  };
  return {
    seats: seatOf.map((k) => seatPlace(seats[k])),
    board: Array.from({ length: BOARD_SLOTS }, (_, i) => at((i - (BOARD_SLOTS - 1) / 2) * BOARD_GAP, 0)),
    boardYaw: frame.axisYaw + Math.PI / 2,
    burn: at(-(BOARD_SLOTS / 2 + 1) * BOARD_GAP, 0),   // a gap and a half off the first slot: never on its plane, jittered (AUDIT CARDS-2 L4)
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
    this.busyUntil = 0;          // the clock the cloth's last throw or turn ends on - the next street waits for it
    this.riffle = null;          // CARDS3b: the dealer's riffle before the deal - { t0, at, yaw }
  }

  /** The pose a card has at `t` - the motion in force (the last begun). */
  _poseOf(c, t) {
    let m = c.motions[0];
    for (const x of c.motions) if (t >= x.t0) m = x;
    return m.at(t);
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
      this.busyUntil = t;
      this.handNo = e.hand;
      if (Number.isInteger(e.seed)) this.tableSeed = e.seed >>> 0;   // CARDS5: the relay's deal names the cloth's seed - one picture for the room
      this.board = 0;
      this.dealer = e.button;
      const n = e.seats.length, btn = e.seats.indexOf(e.button);
      const from = this.places.seats[e.button].deal;
      // CARDS3b: the dealer riffles the deck first; the deal begins when the riffle is done
      this.riffle = { t0: t, at: this.places.seats[e.button].deck, yaw: this.places.seats[e.button].yaw };
      const dealAt = t + RIFFLE_S;
      let order = 0;
      for (let r = 0; r < 2; r++) for (let k = 1; k <= n; k++) {
        const seat = e.seats[(btn + k) % n];
        const place = this.places.seats[seat];
        const mine = seat === this.playerSeat;
        const m = dealMotion({ from, to: this._rest(place.holes[r], r), yaw: place.yaw, roll: Math.PI, t0: dealAt + DEAL_STAGGER * order++, seed: hashSeed(this.tableSeed, this.handNo, seat, r) });
        const motions = /** @type {any[]} */ ([m]);
        if (mine) motions.push(flipMotion({ pos: m.rest, yaw: m.at(Infinity).yaw, fromRoll: Math.PI, t0: m.t1 + TURN_DELAY, pivot: 'middle' }));   // he turns his own up where they lie
        this.cards.push({ id: `h${this.handNo}:${seat}:${r}`, card: mine ? holeOf(seat, r) : -1, seat, motions });
        this.busyUntil = Math.max(this.busyUntil, motions[motions.length - 1].t1);
      }
      return;
    }
    // AUDIT CARDS-2 L3: a seat's chips go out with its action - the call that closes a street comes out of the session in
    // one drain with the street, so the bet is noted here as well as from the view
    if (e.t === 'act' && e.paid > 0) this.lastBets.set(e.seat, (this.lastBets.get(e.seat) ?? 0) + e.paid);
    if (e.t === 'street') {
      this._pushBets(t);
      // AUDIT CARDS-2 L1: an all-in's run-out says its streets in one drain - each waits for the last one's cards
      const t0 = Math.max(t, this.busyUntil);
      const from = this.places.seats[this.dealer].deal;
      let order = 0;
      const burn = dealMotion({ from, to: this._rest(this.places.burn, this.cards.filter((c) => c.seat === -2).length), yaw: this.places.boardYaw, roll: Math.PI, t0, seed: hashSeed(this.tableSeed, this.handNo, 90 + this.board) });
      this.cards.push({ id: `b${this.handNo}:${this.board}`, card: -1, seat: -2, motions: [burn] });
      order++;
      for (let i = this.board; i < e.board.length; i++) {
        // thrown a width short: the dealer's turn over the edge lays it on its slot - the turn across the board's own
        // axis, and the slots a millimetre apart in height, so two neighbours never share a plane (AUDIT CARDS-2 L4)
        const m = dealMotion({ from, to: flipShift(this._rest(this.places.board[i], i & 1), this.places.boardYaw), yaw: this.places.boardYaw, roll: Math.PI, t0: t0 + DEAL_STAGGER * order++, seed: hashSeed(this.tableSeed, this.handNo, 100 + i) });
        const flip = flipMotion({ pos: m.rest, yaw: m.at(Infinity).yaw, fromRoll: Math.PI, t0: m.t1 + TURN_DELAY, acrossYaw: this.places.boardYaw });
        this.cards.push({ id: `c${this.handNo}:${i}`, card: e.board[i], seat: -1, motions: [m, flip] });
        this.busyUntil = Math.max(this.busyUntil, flip.t1);
      }
      this.board = e.board.length;
      return;
    }
    if (e.t === 'act' && e.type === 'fold') {
      // the folded hand slides face down to the muck
      let layer = this.cards.filter((c) => c.seat === -3).length;
      for (const c of this.cards.filter((x) => x.seat === e.seat)) {
        // AUDIT CARDS-2 M6: from where it is NOW - a card still in the air, or still turning, goes on from there (it
        // jumped to its rest first), and a face-up card turns down as it slides
        const at = this._poseOf(c, t);
        c.motions.push(dealMotion({ from: at.pos, to: this._rest(this.places.muck, layer++), yaw: this.places.boardYaw, roll: Math.PI, t0: t, seed: hashSeed(this.tableSeed, this.handNo, 200 + layer), fromYaw: at.yaw, fromRoll: at.roll }));
        c.seat = -3;
      }
      return;
    }
    if (e.t === 'showdown') {
      this._pushBets(t);
      // the hands turn once the board is down (a run-out still in the air), and the pot goes once they have turned
      const t0 = Math.max(t, this.busyUntil);
      if (e.result.shown) {
        let order = 0;
        e.seats.forEach((seat, k) => {
          if (!e.holes[k]) return;
          for (const c of this.cards.filter((x) => x.seat === seat)) {
            const at = this._restOf(c);
            if (Math.cos(at.roll) > 0) continue;   // already face up (the player's own)
            c.card = e.holes[k][Number(c.id.split(':')[2])];
            const flip = flipMotion({ pos: at.pos, yaw: at.yaw, fromRoll: at.roll, t0: t0 + DEAL_STAGGER * order++, pivot: 'middle' });   // a hand shown turns where it lies
            c.motions.push(flip);
            this.busyUntil = Math.max(this.busyUntil, flip.t1);
          }
        });
      }
      // the pot to its winner(s), after the turn - a share each, one after another (AUDIT CARDS-2 M4: until its push
      // begins a share is the pot's, drawn once in the pot's pile)
      const pot = e.result.pots.reduce((a, p) => a + p.amount, 0);
      const winners = e.result.payouts.map((p, k) => (p > 0 ? e.seats[k] : -1)).filter((s) => s >= 0);
      const at = Math.max(t0, this.busyUntil, t + PUSH_S) + POT_BEAT;   // and once the street's last bets are in it
      winners.forEach((w, n) => this.pushes.push({ amount: e.result.payouts[e.seats.indexOf(w)], from: this.places.pot, to: this.places.seats[w].stack, t0: at + n * PUSH_S * 0.5, yaw: this.places.seats[w].yaw, toSeat: w, potShare: pot }));
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
   * end pushes what lay there (with the action's own `paid`, onEvent - an act and its street come in one drain).
   * @param {number} t
   * @param {any} view
   */
  poses(t, view) {
    const cards = [];
    for (const c of this.cards) {
      const p = this._poseOf(c, t);
      if (p.held) continue;   // still in the dealer's hand
      cards.push({ card: c.card, pos: p.pos, yaw: p.yaw, roll: p.roll, id: c.id, seat: c.seat, settled: t >= c.motions[c.motions.length - 1].t1 });   // CARDS3b: whose, and at rest - the player's settled two are his to hold
    }
    if (this.riffle) cards.push(...riffleAt(t, this.riffle.t0, this.riffle.at, this.riffle.yaw));
    const chips = [];
    const live = this.pushes.filter((p) => t < p.t0 + PUSH_S);
    // a push is drawn once it begins; a pot share waiting its turn is still in the pot's pile (below)
    for (const p of live) if (t >= p.t0 || !p.potShare) chips.push(...chipDiscs(p.amount, pushAt(p.from, p.to, p.t0, Math.max(t, p.t0), p.potShare ? SCOOP_LIFT : 0), p.yaw));
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
        chips.push(...chipDiscs(stack, place.stack, place.yaw, true));
        if (bet > 0) chips.push(...chipDiscs(bet, place.bet, place.yaw));
      });
      // the pot less the bets still sliding into it; at a hand's end, the shares not yet pushed to their winners
      const sliding = live.filter((p) => p.to === this.places.pot).reduce((a, p) => a + p.amount, 0);
      const shares = live.filter((p) => p.potShare);
      const waiting = shares.length ? shares.filter((p) => t < p.t0).reduce((a, p) => a + p.amount, 0) - sliding : pot - sliding;
      if (waiting > 0) chips.push(...chipDiscs(waiting, this.places.pot, this.places.boardYaw));
    }
    return { cards, chips };
  }
}
