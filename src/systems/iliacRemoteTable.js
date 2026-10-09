// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 33): THE RELAY'S ILIAC TABLE AS THIS CLIENT SEES IT -
// pure, the Hold'em client's twin (systems/cardRemoteTable.js). The relay deals and runs the game (net/iliacTable.js);
// this keeps what it said - the room's table (`state`: the seats, the game as a spectator sees it, the clock), this
// player's own view of the game when he sits in it (`mine`: his hand, his plays) - and answers the view the panel and
// the cloth read: his own while he plays, the spectator's while he watches. Nothing here deals, judges or keeps a card.
//
// THE CLOCK IS THE RELAY'S. A frame carries the relay's `now`; the skew between it and this client's clock at its
// arrival turns the relay's `clockAt` into seconds left here.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).

export class RemoteIliacTable {
  /** @param {{myId: string|null}} p */
  constructor({ myId }) {
    this.myId = myId;
    this.state = /** @type {any} */ (null);
    this.mine = /** @type {any} */ (null);
    this.error = /** @type {string|null} */ (null);
    this.skew = 0;
    this.receipts = /** @type {string[]} */ ([]);
  }

  /** My seat at the table (0 or 1), or -1. */
  seat() { return this.state?.seats?.findIndex((s) => s && s.id === this.myId) ?? -1; }
  /** Whether I sit and the table waits for a second player. */
  waiting() { return this.seat() >= 0 && !this.state?.game && !this.state?.seats?.every(Boolean); }

  /**
   * A frame of the relay's for this table, at this client's `localNow` (ms, the epoch's). Answers the room's events it
   * carried ([] for my own view, a receipt or a refusal).
   * @param {any} f @param {number} localNow
   */
  apply(f, localNow) {
    if (Number.isFinite(f.now)) this.skew = f.now - localNow;
    if (typeof f.error === 'string') { this.error = f.error; return []; }
    if (typeof f.receipt === 'string') { this.receipts.push(f.receipt); return []; }
    if (f.mine) { this.mine = f.mine; this.error = null; return []; }
    if (!f.state && Array.isArray(f.events)) {
      // AUDIT CARDS-6 C8: a seat's commit said alone (net/iliacTable.js iliacCommit) - the table I was told, that seat committed
      for (const e of f.events) { const pl = e.t === 'commit' ? this.state?.game?.players?.[e.seat] : null; if (pl) pl.committed = true; }
      return f.events;
    }
    if (f.state) {
      this.state = f.state;
      // a new game dealt takes my view of the old one with it; a game just ended keeps it (its last board - the relay
      // sends each seat its own after the room's end), until the next is dealt
      if (this.mine && this.mine.gameNo !== f.state.gameNo) this.mine = null;
      if (this.seat() < 0) this.mine = null;
    }
    return Array.isArray(f.events) ? f.events : [];
  }

  /** The game as this client shows it - my own view while I play it, the spectator's while I watch (AUDIT CARDS-6 C9:
   *  a watched game's last board after its end, the relay's `last`) - with the seats' names; null with no game on the
   *  cloth. */
  view() {
    if (!this.state) return null;
    const v = this.seat() >= 0 ? (this.mine?.gameNo === this.state.gameNo ? this.mine.view : this.state.game) : this.state.game ?? this.state.last?.view ?? null;
    if (!v) return null;
    return { ...v, names: this.state.seats.map((s) => s?.name ?? null), forKeeps: false, ranked: !!(this.state.ranked || this.state.last?.ranked) };
  }

  /** The seconds my turn's clock has left at `localNow` (0 with no game). */
  clockLeft(localNow) {
    const at = this.state?.game ? this.state.clockAt : 0;
    return at ? Math.max(0, Math.ceil((at - (localNow + this.skew)) / 1000)) : 0;
  }
}
