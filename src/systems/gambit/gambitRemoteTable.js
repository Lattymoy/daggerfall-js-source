// @ts-check
// KG5 (2026-10-15, bible/11-Multiplayer/Kings-Gambit.md sections 5.8, 10.7 and 18): THE RELAY'S KING'S GAMBIT TABLE AS
// THIS CLIENT SEES IT - pure, Iliac Hand's mirror's twin (systems/iliac/iliacRemoteTable.js). The relay builds the board, rolls
// every die and runs the clock (net/gambit/gambitTable.js); this keeps what it said and plays nothing.
//
// TWO PARTS. `RemoteGambitTable` is the room's table: the seats, whether each is ready, the game, the clock (the relay's
// `now` against this client's at a frame's arrival - the skew - turns its `clockAt` into seconds left here).
// `RemoteGambitSession` is one dealt game as the host's half of the client (scenes/gambitTableGame.js) plays it - the
// offline session's own face (systems/gambit/gambitTableSession.js: `state`, `act`, `tick`, `forfeit`, `drain`, `playing`, `over`,
// `shown`, `settlement`), so the panel, the log, the motion and the cloth read an online game as they read one with a
// regular:
//   - THE GUEST'S EYE: a seat-1 player reads the board turned about its middle (flipGambitState), so it is side 0 at its
//     own foot; its commands are turned back before they go (unflipCommand), and the cloth lays the turned board where
//     the host's lies (world/gambitCloth.js gambitPlaces `flip`). A watcher reads the host's.
//   - A COMMAND GOES TO THE RELAY: the law's own check first, here, on the board as told (a refusal said at once, in the
//     law's word); a lawful one is sent and nothing moves until the relay says so - one command on its way at a time,
//     a press made meanwhile held and sent once the board is told, checked again on it (AUDIT KG II B11).
//   - THE OTHER SIDE'S ACTIONS SHOWN APART (10.7, the mod's RemoteActionGap): a frame carrying the opponent's action
//     waits GAMBIT_REMOTE_GAP_MS after the last one shown, so the motion and the log read each in turn - a watcher's,
//     both sides' (AUDIT KG II B10).
//   - THE END IS THE RELAY'S: the room's `result` - a king's fall, a forfeit, a seat stood up by the clock or gone, no
//     contest - decides the game; the result is shown after the mod's beat (GAMBIT_RESULT_MS). Friendly: no gold. A
//     result this socket never heard (it dropped, and the relay gave the game away) is read off the table's `last` when
//     the next look tells it (AUDIT KG II B2).
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import { gambitRefusal } from '../../net/kingsGambit.js';
import { flipGambitState, flipGambitEvent, unflipCommand, GAMBIT_REMOTE_GAP_MS } from '../../net/gambit/gambitTable.js';
import { GAMBIT_RESULT_MS } from './gambitTableSession.js';

/** The law's own events: the side that gave them (side 0 the host's, as the relay tells them). */
const LAW_ACTIONS = Object.freeze(['move', 'attack', 'potion', 'end']);
/** A command unanswered this long is let go (a frame lost to a dropped socket - the next welcome asks the table again). */
export const GAMBIT_SENT_MS = 4000;
/** AUDIT KG II B11: the presses held while one is on its way - a turn's worth and its End. */
export const GAMBIT_HELD_MAX = 4;

export class RemoteGambitTable {
  /** @param {{myId: string|null}} p */
  constructor({ myId }) {
    this.myId = myId;
    this.state = /** @type {any} */ (null);
    this.error = /** @type {string|null} */ (null);
    this.skew = 0;
  }

  /** My seat at the table (0 the host, 1 the guest), or -1. */
  seat() { return this.state?.seats?.findIndex((/** @type {any} */ s) => s && s.id === this.myId) ?? -1; }
  /** The other seat's player, or null. */
  other() { const p = this.seat(); return p < 0 ? null : this.state.seats[1 - p] ?? null; }
  /** A seat's readiness (both seated, no game yet). @param {number} p */
  ready(p) { return !!this.state?.seats?.[p]?.ready; }

  /**
   * A frame of the relay's for this table, at this client's `localNow` (ms, the epoch's). Answers the room's events it
   * carried ([] for a refusal).
   * @param {any} f @param {number} localNow
   */
  apply(f, localNow) {
    if (Number.isFinite(f.now)) this.skew = f.now - localNow;
    if (typeof f.error === 'string') { this.error = f.error; return []; }
    if (f.state) this.state = f.state;
    this.error = null;
    return Array.isArray(f.events) ? f.events : [];
  }

  /** The seconds the turn's clock has left at `localNow` (null with no game). @param {number} localNow */
  clockLeft(localNow) {
    const at = this.state?.game ? this.state.clockAt : 0;
    return at ? Math.max(0, Math.ceil((at - (localNow + this.skew)) / 1000)) : null;
  }
}

/** The relay's way the game ended, as the panel's words read it: a king's fall, a forfeit (given up, stood up by the
 *  clock or gone), or no contest. @param {string} how */
export const overBy = (how) => (how === 'king' ? 'king' : how === 'void' ? 'void' : 'forfeit');

export class RemoteGambitSession {
  /**
   * One dealt game, read from seat `side` (0 the host, 1 the guest - a watcher reads the host's). `watch`: a watcher's -
   * both sides' actions shown apart (AUDIT KG II B10); `midway`: a game opened under way, not dealt this frame - no deal's
   * muster, no StartBattle (AUDIT KG II B18).
   * @param {{side: number, game: any, gameNo: number, send: (cmd: any) => boolean, forfeit: () => boolean, now: number, watch?: boolean, midway?: boolean}} p
   */
  constructor({ side, game, gameNo, send, forfeit, now, watch = false, midway = false }) {
    this.side = side === 1 ? 1 : 0;
    this.watch = !!watch;
    /** @type {any[]} */ this.held = [];   // AUDIT KG II B11: presses made while one was on its way
    this.gameNo = gameNo;
    this.sendCmd = send;
    this.sendForfeit = forfeit;
    /** @type {any[]} */ this.events = [];
    /** @type {{events: any[], game: any, theirs: boolean}[]} */ this.queue = [];
    this.shownAt = -Infinity;   // the last of the other side's actions shown
    this.sentAt = /** @type {number|null} */ (null);
    this.resultAt = /** @type {number|null} */ (null);
    this.shown = false;
    /** @type {{winner: number|null, by: 'king'|'forfeit'|'void', how: string}|null} */ this.over = null;
    this.stake = 0;
    this.state = this.view(game);
    this._say({ t: 'game', layout: this.state.layout, stake: 0, ...(midway ? { midway: true } : {}) }, now);
  }

  /** The relay's board as this seat reads it. @param {any} game */
  view(game) { return this.side === 1 ? flipGambitState(game) : game; }
  /** A relay event as this seat reads it. @param {any} e */
  _ev(e) { return this.side === 1 ? flipGambitEvent(e) : e; }
  _say(/** @type {any} */ e, /** @type {number} */ now) { this.events.push({ ...e, at: now }); }

  /**
   * A frame of the room's for this game (`events` and the table's `state`), queued to be shown on the clock.
   * @param {any[]} events @param {any} state
   */
  feed(events, state) {
    const last = state?.last?.gameNo === this.gameNo ? state.last : null;
    const game = state?.game ?? last?.game ?? null;
    const theirs = events.some((e) => LAW_ACTIONS.includes(e.t) && (this.watch || e.side === 1 - this.side));
    // AUDIT KG II B2: the game ended while this socket was away (the relay stood it up - 'left' - and told the room, not
    // it): the table's `last` says how, as the next look tells it
    const told = !state?.game && last && !events.some((e) => e.t === 'result');
    this.queue.push({ events: told ? [...events, { t: 'result', gameNo: last.gameNo, winner: last.winner, how: last.how }] : events, game, theirs });
  }

  /** The clock moves: the queued frames shown in turn - the other side's actions GAMBIT_REMOTE_GAP_MS apart - and the
   *  result after its beat. @param {number} now */
  tick(now) {
    if (this.sentAt !== null && now - this.sentAt >= GAMBIT_SENT_MS) this.sentAt = null;
    while (this.queue.length) {
      const q = this.queue[0];
      if (q.theirs && now < this.shownAt + GAMBIT_REMOTE_GAP_MS) break;
      this.queue.shift();
      if (q.theirs) this.shownAt = now;
      this._show(q, now);
    }
    // AUDIT KG II B11: a press held while another was on its way goes once the board is told - checked again on it
    while (this.held.length && this.sentAt === null && !this.queue.length) {
      const cmd = this.held.shift();
      const no = this.over ? null : gambitRefusal(this.state, 0, cmd) ?? this._send(cmd, now);
      if (no) this._say({ t: 'refused', why: no, cmd }, now);
    }
    if (this.over) this.held = [];
    if (this.over && !this.shown && this.resultAt !== null && now >= this.resultAt) { this.shown = true; this._say({ t: 'result', ...this.over }, now); }
  }

  _show(/** @type {{events: any[], game: any}} */ q, /** @type {number} */ now) {
    if (q.game) this.state = this.view(q.game);
    for (const e of q.events) {
      if (e.t === 'result') {
        if (this.over || e.gameNo !== this.gameNo) continue;
        const winner = e.winner === null ? null : this.side === 1 ? 1 - e.winner : e.winner;
        this.over = { winner, by: overBy(e.how), how: e.how };
        this.resultAt = now + GAMBIT_RESULT_MS;
        this._say({ t: 'decided', winner, by: this.over.by, how: e.how }, now);
      } else if (e.t === 'timeout') this._say({ t: 'timeout', side: this.side === 1 ? 1 - e.seat : e.seat }, now);
      else if (e.t === 'forfeit') this._say({ t: 'forfeit', side: this.side === 1 ? 1 - e.seat : e.seat }, now);
      else if (e.t !== 'game' && e.t !== 'sit' && e.t !== 'leave' && e.t !== 'ready' && e.t !== 'unready') this._say(this._ev(e), now);
    }
    this.sentAt = null;   // the relay answered
  }

  /** THE PLAYER'S COMMAND (side 0 as read): null, or the law's refusal word - checked here on the board as told, then
   *  sent; nothing moves until the relay says so. @param {any} cmd @param {number} now */
  act(cmd, now) {
    if (this.over || !this.state) return 'over';
    const no = gambitRefusal(this.state, 0, cmd);
    if (no) return no;
    // one command on its way at a time: a press made meanwhile is held, sent once the board is told (AUDIT KG II B11)
    if (this.sentAt !== null || this.queue.length) { if (this.held.length < GAMBIT_HELD_MAX) this.held.push(cmd); return null; }
    return this._send(cmd, now);
  }
  /** A lawful command to the relay: null, or 'link' when the link will not carry it. @param {any} cmd @param {number} now */
  _send(cmd, now) {
    if (!this.sendCmd(this.side === 1 ? unflipCommand(cmd) : cmd)) return 'link';
    this.sentAt = now;
    return null;
  }

  /** The player forfeits (the mod's FORFEIT): said to the relay, whose result decides it. */
  forfeit(/** @type {number} */ _now) {
    if (this.over || !this.state) return;
    this.sendForfeit();
  }

  /** Whether the game is under way (dealt and undecided). */
  playing() { return !!this.state && !this.over; }
  /** Whose the turn is, as read - 0 this seat's - while the game is under way. */
  turnOf() { return this.playing() ? this.state.turn : null; }
  /** Online the regulars' gold is never in it: a friendly game pays nothing (5.8). */
  settlement() { return this.over ? { pay: 0, net: 0 } : null; }
  /** The events since the last drain. */
  drain() { const e = this.events; this.events = []; return e; }
}
