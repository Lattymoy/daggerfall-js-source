// @ts-check
// KG3 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 5.7, 10.5, 10.7 and 16; the owner: "Dont come back
// until this is completed in full"): THE KING'S GAMBIT AGAINST A REGULAR - pure, DOM-free, clocked by the `now` it is
// handed, as Iliac Hand's evening is (systems/iliac/iliacTableSession.js). The player (side 0, the host, at the board's foot)
// and one of the tavern's regulars (side 1) play one game of the law (net/kingsGambit.js); the regular plays as the
// mod's innkeeper played, at the regular's own tier (systems/gambit/gambitPatrons.js). The host (scenes/gambitTableGame.js)
// seats it, shows it and moves the gold; nothing here touches a purse, a window or the scene.
//
// THE BEATS ARE THE MOD'S (section 2.10, 10.7): a turn ends GAMBIT_TURN_END_MS after its last action or its End turn (the
// mod's QueueTurnEnd); the regular waits GAMBIT_REGULAR_PAUSE_MS before each action (AiTurnRoutine's pause); the result
// is shown GAMBIT_RESULT_MS after the game is decided. No clock offline: the player's turn lasts as long as the player
// likes (the mod's), and a game the law leaves undecided - two kings alone - the player ends, by a win or a forfeit.
//
// THE STAKE (5.7, 10.7): the regular's tier's least stake times one of GAMBIT_STAKE_MULTS, taken at the deal and held by
// the table (the host's); a win pays GAMBIT_WIN_PAYS times it - the stake back and as much from the regular - and a loss
// or a forfeit leaves it with the regular. A REGULAR'S NIGHT: a regular pays out at most GAMBIT_NIGHT_MULT times the
// tier's least stake a game day, net of what the regular won back - the book the save keeps (`gambitPurses`,
// GAMBIT_PURSES_BOOK_MAX taverns, the oldest day first out) - so a table is no mint; a stake past what is left of it is
// refused, and a regular whose night is spent plays for fun until tomorrow.
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import { gambitAct, finishTurn } from '../../net/kingsGambit.js';
import { GAMBIT_TURN_END_MS } from '../../net/gambit/gambitTable.js';
import { dealRegular, regularStep } from './gambitPatrons.js';
import { SUIT_CROWNS } from '../../render/cardFaces.js';   // the Bay deck's four crowns - pure, its painters take a canvas

/** THE MOD'S BEATS (2.10): the turn's end after its last action (KG5: its one home the relay's table's, which runs it
 *  online too), the regular's pause before each action, the result. */
export { GAMBIT_TURN_END_MS };
export const GAMBIT_REGULAR_PAUSE_MS = 1200;
export const GAMBIT_RESULT_MS = 1300;
/** The mod's three bets: the tier's least stake times one of these. */
export const GAMBIT_STAKE_MULTS = Object.freeze([1, 2, 5]);
/** What a win pays: this many times the stake - the stake back and as much from the regular. */
export const GAMBIT_WIN_PAYS = 2;
/** A REGULAR'S NIGHT (10.7): the most a regular pays out a game day, net, in the tier's least stakes. */
export const GAMBIT_NIGHT_MULT = 15;
/** The taverns the night's book remembers - the oldest day goes first (the Hold'em regulars' book's bound). */
export const GAMBIT_PURSES_BOOK_MAX = 24;
/** The regulars a table's entry remembers - a table's free chairs at the most. */
export const GAMBIT_PURSES_NAMES_MAX = 6;
/** The log's last lines kept (the port's own: the mod's AddLog keeps two - AUDIT KG C15). */
export const GAMBIT_LOG_MAX = 12;

/** THE CROWNS a king is chosen from (10.4), in the Bay deck's suit order (cardLaw's c, d, h, s) - each its key, the deck's
 *  crown lowercased; the player's first is Daggerfall, the game's own. */
export const GAMBIT_CROWNS = Object.freeze(SUIT_CROWNS.map((c) => c.crown.toLowerCase()));
export const GAMBIT_CROWN_FIRST = 'daggerfall';
/** A crown's index in GAMBIT_CROWNS, the first's for a key it does not hold. */
export const crownIndex = (/** @type {any} */ key) => { const i = GAMBIT_CROWNS.indexOf(key); return i >= 0 ? i : GAMBIT_CROWNS.indexOf(GAMBIT_CROWN_FIRST); };
/** The player's crown as the save keeps it, and back (10.4): one of the four, else Daggerfall. */
export const gambitCrownRestore = (/** @type {any} */ v) => GAMBIT_CROWNS[crownIndex(v)];

/** The stake a pick puts down: the tier's least stake times the pick's multiplier, or 0 for no pick. */
export const stakeOf = (/** @type {{stake: number}} */ tier, /** @type {number} */ mult) => (GAMBIT_STAKE_MULTS.includes(mult) ? tier.stake * mult : 0);

export class GambitTableSession {
  /**
   * A game against a regular, dealt now - or a session over at once ('refused') when the law deals none (an army it
   * refuses, a source that is not one).
   * @param {{army: number[], regular: {name: string, seed: number, tier: {key: string, stake: number, budget: number, potions: number, blunder: number}}, stake?: number, rand32: () => number, now: number}} p
   */
  constructor({ army, regular, stake = 0, rand32, now }) {
    this.regular = { name: regular.name, seed: regular.seed };
    this.tier = regular.tier;
    this.stake = Number.isSafeInteger(stake) && stake > 0 ? stake : 0;
    this.rand32 = rand32;
    /** @type {any[]} */ this.events = [];
    this.endAt = null;      // the turn's end, while a turn is ending
    this.actAt = null;      // the regular's next action, on the regular's turn
    this.resultAt = null;   // the result's beat, once the game is decided
    this.shown = false;     // the result shown
    /** @type {{winner: number|null, by: 'king'|'forfeit'|'void'}|null} */ this.over = null;
    this.state = dealRegular({ army, tier: this.tier, rand32 });
    if (!this.state) { this.over = { winner: null, by: 'void' }; this.shown = true; return; }
    this._say({ t: 'game', layout: this.state.layout, stake: this.stake }, now);
  }

  _say(/** @type {any} */ e, /** @type {number} */ now) { this.events.push({ ...e, at: now }); }

  /** A step the law took: its events said, the game decided or its turn's end on the clock. */
  _apply(/** @type {{state: any, events: any[]}} */ out, /** @type {number} */ now) {
    this.state = out.state;
    for (const e of out.events) this._say(e, now);
    if (this.state.over) this._decide(this.state.over.winner, 'king', now);
    else if (this.state.ending) { this.endAt = now + GAMBIT_TURN_END_MS; this.actAt = null; }
  }

  /** The game is decided: who won and how; the result's beat starts. */
  _decide(/** @type {number|null} */ winner, /** @type {'king'|'forfeit'|'void'} */ by, /** @type {number} */ now) {
    if (this.over) return;
    this.over = { winner, by };
    this.endAt = this.actAt = null;
    this.resultAt = now + GAMBIT_RESULT_MS;
    this._say({ t: 'decided', winner, by }, now);
  }

  /** THE PLAYER'S COMMAND (side 0): null, or the law's refusal word - nothing changes. */
  act(/** @type {any} */ cmd, /** @type {number} */ now) {
    if (this.over || !this.state) return 'over';
    const out = gambitAct(this.state, 0, cmd, this.rand32);
    if ('refused' in out) {
      if (out.refused === 'rand') this._decide(null, 'void', now);   // the table's source broke: no game, no gold
      return out.refused;
    }
    this._apply(out, now);
    return null;
  }

  /** The clock moves: a turn ending ends after its beat; on the regular's turn the regular acts, a pause before each. */
  tick(/** @type {number} */ now) {
    if (this.over) {
      if (!this.shown && this.resultAt !== null && now >= this.resultAt) { this.shown = true; this._say({ t: 'result', ...this.over }, now); }
      return;
    }
    if (this.endAt !== null && now >= this.endAt) {
      this.endAt = null;
      const out = finishTurn(this.state, this.rand32);
      if ('refused' in out) { this._decide(null, 'void', now); return; }
      this._apply(out, now);
      if (!this.over && this.state.turn === 1) this.actAt = now + GAMBIT_REGULAR_PAUSE_MS;
      return;
    }
    if (this.state.turn !== 1 || this.state.ending || this.actAt === null || now < this.actAt) return;
    const step = regularStep(this.state, 1, this.tier, this.rand32, this.rand32);
    if (!step) { this._decide(null, 'void', now); return; }   // a broken source takes no step - never a turn passed in silence
    this._apply(step, now);
    if (!this.over && !this.state.ending) this.actAt = now + GAMBIT_REGULAR_PAUSE_MS;
  }

  /** The player forfeits (the mod's FORFEIT) - every road off the seat while a game is under way: the regular wins. */
  forfeit(/** @type {number} */ now) {
    if (this.over || !this.state) return;
    this._say({ t: 'forfeit', side: 0 }, now);
    this._decide(1, 'forfeit', now);
  }

  /** Whether a game is under way (dealt and undecided). */
  playing() { return !!this.state && !this.over; }
  /** Whose the turn is - 0 the player's, 1 the regular's - while a game is under way, else null. */
  turnOf() { return this.playing() ? this.state.turn : null; }

  /**
   * WHAT THE GOLD DOES, once decided: `pay` the gold the table hands the player (the stake back and the regular's on a
   * win), `net` what the regular paid out net (+stake on a win, -stake on a loss: the night's book), both 0 for fun or
   * for a game that did not stand. Null while undecided.
   */
  settlement() {
    if (!this.over) return null;
    const { winner } = this.over;
    if (!this.stake || winner === null) return { pay: winner === null ? this.stake : 0, net: 0 };
    return winner === 0 ? { pay: this.stake * GAMBIT_WIN_PAYS, net: this.stake } : { pay: 0, net: -this.stake };
  }

  /** The events since the last drain. */
  drain() { const e = this.events; this.events = []; return e; }
}

// ── A REGULAR'S NIGHT: THE BOOK ───────────────────────────────────────────────────────────────────────────────────

/** What regular `name` has paid out net at table `key` on `day` (negative once the regular won back more). */
export function gambitNightPaid(/** @type {any} */ book, /** @type {string} */ key, /** @type {number} */ day, /** @type {string} */ name) {
  const e = book?.[key];
  const v = e && e.day === day && e.net && typeof e.net === 'object' ? e.net[name] : 0;
  return Number.isSafeInteger(v) ? v : 0;
}
/** What is left of regular `name`'s night at `tier`: the night's GAMBIT_NIGHT_MULT least stakes less what the regular
 *  has paid out net, never below 0. */
export function gambitNightLeft(/** @type {any} */ book, /** @type {string} */ key, /** @type {number} */ day, /** @type {string} */ name, /** @type {{stake: number}} */ tier) {
  return Math.max(0, tier.stake * GAMBIT_NIGHT_MULT - gambitNightPaid(book, key, day, name));
}
/** The book after regular `name` paid out `net` at table `key` on `day` (negative: won back): a new book, a day past
 *  the table's last starting it afresh, the oldest days dropped past GAMBIT_PURSES_BOOK_MAX - a tie in the day keeping the
 *  table just booked (AUDIT CARDS-6 B6's rule, the forfeits' book's). */
export function gambitPursesAfter(/** @type {any} */ book, /** @type {string} */ key, /** @type {number} */ day, /** @type {string} */ name, /** @type {number} */ net) {
  const base = book && typeof book === 'object' && !Array.isArray(book) ? book : {};
  const kept = base[key]?.day === day && base[key].net && typeof base[key].net === 'object' ? base[key].net : {};
  const names = { ...kept, [name]: gambitNightPaid(base, key, day, name) + (Number.isSafeInteger(net) ? net : 0) };
  const next = { ...base, [key]: { day, net: Object.fromEntries(Object.entries(names).slice(-GAMBIT_PURSES_NAMES_MAX)) } };
  const keys = Object.keys(next).sort((a, b) => (next[b]?.day ?? 0) - (next[a]?.day ?? 0) || (b === key ? 1 : 0) - (a === key ? 1 : 0));
  return Object.fromEntries(keys.slice(0, GAMBIT_PURSES_BOOK_MAX).map((k) => [k, next[k]]));
}
/** The book as the save keeps it, and back - only well-formed entries, never more than GAMBIT_PURSES_BOOK_MAX tables of
 *  GAMBIT_PURSES_NAMES_MAX regulars, every sum a safe integer. */
export function gambitPursesRestore(/** @type {any} */ raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw).slice(0, GAMBIT_PURSES_BOOK_MAX)) {
    if (!v || !Number.isSafeInteger(v.day) || !v.net || typeof v.net !== 'object' || Array.isArray(v.net)) continue;
    const net = Object.entries(v.net).filter(([n, x]) => typeof n === 'string' && Number.isSafeInteger(x)).slice(0, GAMBIT_PURSES_NAMES_MAX);
    out[k] = { day: v.day, net: Object.fromEntries(net) };
  }
  return out;
}
