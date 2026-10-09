// @ts-check
// CARDS10 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 33; section 6.4: "At the same tavern table, seated
// the same way. Offline against a patron who has a deck of his own"): ILIAC HAND AGAINST A REGULAR - pure, DOM-free,
// clocked by the `now` it is handed, as the Hold'em evening is (systems/cardTableSession.js). The player (seat 0) and one
// of the tavern's regulars (seat 1) play one game of the rules engine (net/iliacHand.js); the regular plays by his temper
// and the tavern's grade (systems/iliacPatrons.js). The host (scenes/worldModes.js) seats it, shows it, and moves the
// card a game for keeps is won or lost; nothing here touches a pack, a window or the scene.
//
// THE TURN. Both commit hidden: the regular after a moment's thought (ILIAC_THINK_MS and its spread - never at once), the
// player when he presses; once both have, the turn is revealed after ILIAC_REVEAL_MS (the cards turned over together),
// and the regular starts thinking about the next. After the sixth turn the game is over: won, lost or drawn.
//
// FOR KEEPS (section 6.3, "A tavern regular who loses to you can pay in a card from his deck"): a game played `forKeeps`
// stakes a card each side - the winner takes one of the loser's deck (iliacPatrons.js forfeitCard, the table's source):
// the regular's paid into the player's pack, the player's taken from it. A draw pays nobody. Standing up from a game for
// keeps concedes it. AUDIT CARDS-6 B1: THE PLAYER'S STAKE IS DRAWN AT THE DEAL (`stake`) and the host lifts it out of
// his pack then, held by the table till the end - a pack emptied mid-game (the binder's Drop) lost a game for nothing,
// the take drawn at the end finding no card to take. A regular pays at most one card a game day (`forfeitsFor` /
// `forfeitsAfter` - the book the save keeps, as the Hold'em regulars' purses are kept), so a tavern is no mint: once he
// has paid, he plays for fun.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { newGame, commit, reveal, iliacView, legalPlays, playsRefusal, result as gameResult } from '../net/iliacHand.js';
import { patronPlays, forfeitCard } from './iliacPatrons.js';

/** MEASURE (CARDS10): a regular's thought before he commits a turn, and its spread. */
export const ILIAC_THINK_MS = 1400;
export const ILIAC_THINK_SPREAD_MS = 1800;
/** MEASURE (CARDS10): the beat between the second commit and the turn turned over. */
export const ILIAC_REVEAL_MS = 900;

/** A [0, 1) draw off a 32-bit source. */
export const unit32 = (/** @type {() => number} */ rand32) => () => (rand32() >>> 0) / 4294967296;

export class IliacTableSession {
  /**
   * @param {{player: {id: string, name: string, deck: string[]}, patron: {id: string, name: string, temper: string, grade: number, deck: string[]}, rand32: () => number, now: number, forKeeps?: boolean}} p
   */
  constructor({ player, patron, rand32, now, forKeeps = false }) {
    /** @type {[any, {id: string, name: string, temper: string, grade: number, deck: string[], kind: string}]} */
    this.seats = [{ ...player, kind: 'player' }, { ...patron, kind: 'patron' }];
    this.rand32 = rand32;
    this.unit = unit32(rand32);
    this.forKeeps = !!forKeeps;
    this.state = newGame({ decks: [player.deck, patron.deck], rand32 });
    this.events = [];
    this.over = this.state ? null : 'refused';   // a deck the rules refuse plays no game
    this.prize = null;                           // { from: 'patron'|'player', card } once a game for keeps is decided
    this.revealAt = null;
    this.thinkAt = now + this._thought();
    // AUDIT CARDS-6 B1: the player's card staked, drawn now - the one he pays if he loses or concedes (the host holds it)
    this.stake = this.forKeeps && this.state ? forfeitCard(player.deck, this.unit) : null;
    if (this.state) this._say({ t: 'game', holdings: this.state.holdings.map((h) => h.id), forKeeps: this.forKeeps }, now);
  }

  _thought() { return ILIAC_THINK_MS + Math.floor(this.unit() * ILIAC_THINK_SPREAD_MS); }
  _say(e, now) { this.events.push({ ...e, at: now }); }

  /** Both have committed: the reveal waits its beat. */
  _armReveal(now) { if (this.state.players[0].plays && this.state.players[1].plays) this.revealAt = now + ILIAC_REVEAL_MS; }

  /** The player's plays for this turn; null, or the rules' refusal word (nothing changes). */
  playerCommit(plays, now) {
    if (this.over || !this.state) return 'over';
    const no = commit(this.state, 0, plays);
    if (no) return no;
    this._say({ t: 'commit', p: 0, n: plays.length }, now);
    this._armReveal(now);
    return null;
  }

  /** The clock moves: the regular commits once his thought is done; a turn both committed is revealed after its beat. */
  tick(now) {
    if (this.over || !this.state) return;
    const st = this.state;
    if (!st.players[1].plays && now >= this.thinkAt) {
      const s = this.seats[1];
      const plays = patronPlays(st, 1, s.temper, s.grade, this.unit);
      if (commit(st, 1, plays) !== null) commit(st, 1, []);   // a line the rules refuse (never, by its build) is a pass
      this._say({ t: 'commit', p: 1, n: st.players[1].plays.length }, now);
      this._armReveal(now);
    }
    if (this.revealAt !== null && now >= this.revealAt) {
      this.revealAt = null;
      for (const e of reveal(st)) this._say(e, now);
      if (st.over) this._finish(now);
      else this.thinkAt = now + this._thought();
    }
  }

  /** The game is decided: who won, and - for keeps - the card the loser pays. */
  _finish(now) {
    const r = gameResult(this.state);
    this.over = r.winner === 0 ? 'won' : r.winner === 1 ? 'lost' : 'draw';
    if (this.forKeeps && r.winner !== null) {
      const from = r.winner === 0 ? 'patron' : 'player';
      const card = from === 'patron' ? forfeitCard(this.seats[1].deck, this.unit) : this.stake;   // AUDIT CARDS-6 B1: the player's, his stake
      this.prize = card ? { from, card } : null;
    }
    this._say({ t: 'end', why: this.over, result: r, prize: this.prize }, now);   // the table's word (the rules' own 'over' came before it)
  }

  /** The plays the player may commit one at a time now (empty once he has, or the game is over). */
  legal() { return this.over || !this.state ? [] : legalPlays(this.state, 0); }
  /** Why a list of plays would be refused, or null - the panel's staging asks it. */
  refusal(plays) { return this.over || !this.state ? 'over' : playsRefusal(this.state, 0, plays); }

  /** The game as the player sees it (iliacView at seat 0), and the table's own: names, temper, keeps, the end. */
  view() {
    if (!this.state) return null;
    return {
      ...iliacView(this.state, 0),
      names: this.seats.map((s) => s.name), temper: this.seats[1].temper, grade: this.seats[1].grade,
      forKeeps: this.forKeeps, end: this.over, prize: this.prize ? { ...this.prize } : null,
      thinking: !this.over && !this.state.players[1].plays, revealing: this.revealAt !== null,
    };
  }

  /** The events since the last drain. */
  drain() { const e = this.events; this.events = []; return e; }

  /** The player stands up: a game under way is conceded - for keeps, his card is the regular's. Answers the prize. */
  leave(now) {
    if (!this.over && this.state) {
      this.over = 'left';
      if (this.forKeeps) this.prize = this.stake ? { from: 'player', card: this.stake } : null;   // AUDIT CARDS-6 B1: his stake
      this._say({ t: 'end', why: 'left', result: null, prize: this.prize }, now);
    }
    return this.prize;
  }
}

// ── THE FORFEITS' BOOK ────────────────────────────────────────────────────────────────────────────────────────────

/** MEASURE: the taverns the book remembers - the oldest day goes first (the Hold'em regulars' book's bound). */
export const FORFEITS_BOOK_MAX = 24;
/** The regulars at tavern `key` who have paid their card on `day` (the book's), as names. */
export function forfeitsFor(/** @type {any} */ book, /** @type {string} */ key, /** @type {number} */ day) {
  const e = book?.[key];
  return e && e.day === day && Array.isArray(e.paid) ? e.paid.filter((n) => typeof n === 'string') : [];
}
/** The book after regular `name` paid at `key` on `day`: a new book, the oldest days dropped past FORFEITS_BOOK_MAX. */
export function forfeitsAfter(/** @type {any} */ book, /** @type {string} */ key, /** @type {number} */ day, /** @type {string} */ name) {
  const paid = [...new Set([...forfeitsFor(book, key, day), name])];
  const next = { ...(book && typeof book === 'object' && !Array.isArray(book) ? book : {}), [key]: { day, paid } };
  // AUDIT CARDS-6 B6: a tie in the day puts the tavern just booked first - a full book of the same day dropped it
  const keys = Object.keys(next).sort((a, b) => (next[b]?.day ?? 0) - (next[a]?.day ?? 0) || (b === key ? 1 : 0) - (a === key ? 1 : 0));
  return Object.fromEntries(keys.slice(0, FORFEITS_BOOK_MAX).map((k) => [k, next[k]]));
}
/** The book as the save keeps it, and back - only well-formed entries, never more than FORFEITS_BOOK_MAX. */
export function forfeitsBookRestore(/** @type {any} */ raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw).slice(0, FORFEITS_BOOK_MAX)) {
    if (!v || !Number.isSafeInteger(v.day) || !Array.isArray(v.paid)) continue;
    out[k] = { day: v.day, paid: v.paid.filter((n) => typeof n === 'string').slice(0, 6) };
  }
  return out;
}
