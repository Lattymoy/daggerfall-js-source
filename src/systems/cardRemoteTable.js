// @ts-check
// CARDS5 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 17): THE RELAY'S TABLE AS THIS CLIENT SEES IT -
// pure, DOM-free. The relay deals and runs the table (net/holdemTable.js); this folds its frames - the room's events
// and the table as it stands, my own hole cards, my turn - into the very shapes the offline evening offers
// (systems/cardTableSession.js view(), legal(), drain()), so the panel (ui/cardTableHud.js) and the cloth
// (world/cardScene.js) read the one or the other alike. A seat is a CHAIR (the relay's own law): `seats` runs over the
// table's chairs, an empty one `kind: 'empty'`, mine `kind: 'player'`, another player's `kind: 'peer'`.
//
// THE CLOCKS. Every frame carries the relay's `now`; an event's `at` is the relay's too. Each is moved onto this
// client's clock at the frame's arrival (`at - now + local`), so a deal thrown on the relay's beat is thrown on mine.
//
// A HAND ALREADY UNDER WAY (a player come into the room, or a reload): the first table state of a hand no 'hand' event
// introduced is told as the events it would have taken - the deal, the streets, the folds - long enough ago that the
// cloth lays them at rest at once.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).

/** How long ago a hand already under way is told as having been dealt - past every throw and turn on the cloth. */
export const CATCH_UP_MS = 20000;

export class RemoteCardTable {
  /**
   * @param {{myId: string|null, chair?: number}} p - who I am at the relay, and the chair I sit in (-1 watching)
   */
  constructor({ myId, chair = -1 }) {
    this.myId = myId;
    this.chair = chair;
    this.state = /** @type {any} */ (null);
    this.hole = /** @type {{handNo: number, cards: number[]}|null} */ (null);
    this.turn = /** @type {any} */ (null);
    this.events = /** @type {any[]} */ ([]);
    this.seenHand = 0;     // the last hand an event (or a catch-up) introduced
    this.error = /** @type {string|null} */ (null);
  }

  /** The player's seat index (the chair), as the session's `playerSeat`. */
  get playerSeat() { return this.chair; }

  /**
   * One frame from the relay (online.js onHoldem: the frame and the local clock it arrived at, `at`).
   * @param {any} f
   */
  ingest(f) {
    const local = Number.isFinite(f.at) ? f.at : 0;
    const shift = (t) => (Number.isFinite(t) && Number.isFinite(f.now) ? t - f.now + local : local);
    if (typeof f.error === 'string') { this.error = f.error; return; }
    if (f.hole) { this.hole = f.hole; return; }
    if (f.turn) { this.turn = { ...f.turn, clockAt: shift(f.turn.clockAt) }; return; }
    if (!f.state) return;
    const st = f.state;
    const events = (f.events ?? []).map((e) => ({ ...e, at: shift(e.at) }));
    if (events.some((e) => e.t === 'hand')) this.seenHand = Math.max(this.seenHand, ...events.filter((e) => e.t === 'hand').map((e) => e.hand));
    else if (st.hand && st.handNo !== this.seenHand) {
      // a hand under way that no event of mine dealt: told as the events it took, long enough ago to lie at rest
      const then = local - CATCH_UP_MS;
      const caught = /** @type {any[]} */ ([{ t: 'hand', hand: st.handNo, button: st.button, seats: st.handSeats.slice(), seed: st.seed, at: then }]);
      for (const len of [3, 4, 5]) if (st.hand.board.length >= len) caught.push({ t: 'street', street: { 3: 'flop', 4: 'turn', 5: 'river' }[len], board: st.hand.board.slice(0, len), at: then });
      st.hand.seats.forEach((s, k) => { if (s.folded) caught.push({ t: 'act', seat: st.handSeats[k], type: 'fold', to: null, paid: 0, at: then }); });
      events.unshift(...caught);
      this.seenHand = st.handNo;
    }
    if (st.handNo !== this.state?.handNo) this.turn = null;
    this.state = st;
    if (this.chair >= 0 && !st.seats[this.chair]) this.chair = -1;   // stood up by the relay (out of chips, or gone)
    this.events.push(...events);
  }

  /** The events since the last drain (the session's own `drain`). */
  drain() { const e = this.events; this.events = []; return e; }

  /** What I may do now - the relay's word for my turn, while the hand it named is still mine to act in - or null. */
  legal() {
    const st = this.state, h = st?.hand;
    if (!h || this.chair < 0 || !this.turn || this.turn.handNo !== st.handNo) return null;
    return h.toAct >= 0 && st.handSeats[h.toAct] === this.chair ? this.turn.legal : null;
  }

  /** The table as the session's view(): chairs as seats, my hole cards in the hand at my chair, the last showdown. */
  view() {
    const st = this.state;
    if (!st) return null;
    const seats = st.seats.map((s, i) => (s
      ? { id: s.id, name: s.name, kind: i === this.chair ? 'player' : 'peer', stack: s.stack, gone: !!s.leaving }
      : { id: null, name: '', kind: 'empty', stack: 0, gone: true }));
    let hand = st.hand;
    if (hand && this.hole && this.hole.handNo === st.handNo) {
      const k = st.handSeats.indexOf(this.chair);
      if (k >= 0) hand = { ...hand, seats: hand.seats.map((s, j) => (j === k && !s.hole ? { ...s, hole: this.hole.cards.slice() } : s)) };
    }
    return { handNo: st.handNo, button: st.button, stakes: { sb: st.sb, bb: st.bb }, over: null, seats, handSeats: st.handSeats.slice(), hand, showdown: st.hand ? null : st.last };
  }

  /** The hole cards the cloth may show me: my own; everyone else's a back (-1) until a showdown says them. */
  holeOf(chair, r) {
    if (chair !== this.chair || !this.hole || this.hole.handNo !== this.state?.handNo) return -1;
    return this.hole.cards[r] ?? -1;
  }

  /** How many sit at the table (a table of one deals nothing). */
  get seated() { return this.state ? this.state.seats.filter(Boolean).length : 0; }

  /** My clock: how long I have left to act, in ms (0 when it is not my turn). */
  clockLeft(local) { return this.legal() && this.turn ? Math.max(0, this.turn.clockAt - local) : 0; }
}
