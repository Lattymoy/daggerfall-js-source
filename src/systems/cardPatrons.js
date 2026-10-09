// @ts-check
// CARDS4 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 14; Mac: "Yes, patrons play"): THE TAVERN'S PATRONS
// AT THE CARD TABLE - pure, DOM-free. How a patron weighs his cards and what he does with them: no Daggerfall member
// (Daggerfall has no card games), the port's own, played against the cards' law (net/cardLaw.js) exactly as a player is.
//
// THE WEIGHING. Before the flop, the Chen formula - the tabletop's own two-card score (high card, a pair doubled, suited,
// the gap, the small connector), 20 for aces down to below nothing for seven-deuce - over 20. After it, the hand's
// EQUITY: the share of the pot it wins, Monte Carlo over the cards still unseen - the opponents' holes and the rest of the
// board dealt at random EQUITY_SAMPLES times and every showdown judged by the law's own bestHand, a split counted as its
// share. Every random draw comes from the source handed in (the table's), so a hand replayed from a seed plays the same.
//
// THE TEMPER. A patron is TIGHT (plays few hands, bets them hard), LOOSE (plays many, calls light) or a BLUFFER (bets what
// he does not hold). Each is four numbers (PATRON_TEMPERS): the preflop score he plays from, the strength he raises with, how
// often he bets air, and the edge over the pot's odds he wants before he calls.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { rankOf, suitOf, freshDeck, bestHand, compareHands } from '../net/cardLaw.js';
import { drawBelow } from '../net/dice.js';

/** MEASURE (CARDS4): showdowns dealt per equity - 200 gives a share to about 3 points, at a few milliseconds a weighing. */
export const EQUITY_SAMPLES = 200;

/** MEASURE (CARDS4): the three tempers - `play` the preflop score (Chen / 20) a hand needs to go on, `raise` the strength
 *  that bets or raises, `bluff` the chance of betting air, `edge` the margin over the pot's odds a call wants. */
export const PATRON_TEMPERS = Object.freeze({
  tight: Object.freeze({ play: 0.5, raise: 0.72, bluff: 0.03, edge: 0.05 }),
  loose: Object.freeze({ play: 0.3, raise: 0.66, bluff: 0.08, edge: -0.03 }),
  bluffer: Object.freeze({ play: 0.35, raise: 0.62, bluff: 0.25, edge: 0 }),
});
export const TEMPER_NAMES = Object.freeze(Object.keys(PATRON_TEMPERS));
/** MEASURE (AUDIT CARDS-2 H2): the price and the bettor. Before the flop the line a hand plays from rises by
 *  PRICE_PER_DOUBLING for each doubling of the call past PRICE_FREE_BB big blinds (an open's price) - a shove is called
 *  by a shover's hands, not a
 *  limper's; after it, equity weighed against a random hand is bent by the bet's size (strength ^ (1 + BETTOR_BEND x
 *  bet / pot before it, at most BETTOR_BET_MAX)) - a big bet is a strong hand's, and top pair is not good against it.
 *  Without them a nut-only shover took +350 big blinds an hour off the regulars (AUDIT CARDS-2 lane F). */
export const PRICE_PER_DOUBLING = 0.05;
export const PRICE_FREE_BB = 3;
/** MEASURE (AUDIT CARDS-2 H2): and a cheap price is defended - the line falls by DEFEND x how far the pot's odds are
 *  under DEFEND_ODDS (a min-raise into the blinds no longer takes them two times in three). */
export const DEFEND = 0.6;
export const DEFEND_ODDS = 0.33;
export const BETTOR_BEND = 0.5;
export const BETTOR_BET_MAX = 3;

/** A uniform number in [0, 1) off the source - one 32-bit draw. */
export const unit = (rand32) => (rand32() >>> 0) / 2 ** 32;

/**
 * The Chen formula's score for two hole cards (the tabletop's own: Bill Chen's): the high card (an ace 10, a king 8, a
 * queen 7, a jack 6, the rest half their pips), a pair doubled (5 at least), +2 suited, less 1/2/4/5 for a gap of
 * 1/2/3/4 or more, +1 for a connector or one-gapper below the queen; rounded half up. 20 for aces, -1 for seven-deuce
 * off.
 * @param {number[]} hole
 */
export function chenScore(hole) {
  const [a, b] = hole;
  const hi = Math.max(rankOf(a), rankOf(b)), lo = Math.min(rankOf(a), rankOf(b));
  const value = (r) => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2);
  let s = value(hi);
  if (hi === lo) return Math.ceil(Math.max(5, s * 2));
  if (suitOf(a) === suitOf(b)) s += 2;
  const gap = hi - lo - 1;
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 10) s += 1;
  return Math.ceil(s);
}

/**
 * The hand's equity: the share of the pot `hole` wins over `board` against `opponents` unseen hands, Monte Carlo over
 * `samples` deals of the cards nobody has shown (`dead` - cards known out of play, a folded hand's never; the burns are
 * unknown and stay in). A tie is its share.
 * @param {number[]} hole
 * @param {number[]} board
 * @param {number} opponents
 * @param {() => number} rand32
 * @param {number} [samples]
 * @param {number[]} [dead]
 */
export function equity(hole, board, opponents, rand32, samples = EQUITY_SAMPLES, dead = []) {
  if (opponents < 1) return 1;
  const known = new Set([...hole, ...board, ...dead]);
  const live = freshDeck().filter((c) => !known.has(c));
  const need = opponents * 2 + (5 - board.length);
  let won = 0;
  const pool = live.slice();
  for (let n = 0; n < samples; n++) {
    // a partial Fisher-Yates: the first `need` cards of the pool, each drawn without bias
    for (let i = 0; i < need; i++) {
      const j = i + drawBelow(pool.length - i, rand32);
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const full = board.concat(pool.slice(opponents * 2, need));
    const mine = bestHand([...hole, ...full]);
    let best = 1, ties = 1;
    for (let o = 0; o < opponents; o++) {
      const c = compareHands(bestHand([pool[o * 2], pool[o * 2 + 1], ...full]), mine);
      if (c > 0) { best = 0; break; }
      if (c === 0) ties++;
    }
    if (best) won += 1 / ties;
  }
  return won / samples;
}

/**
 * What a patron does with the action on him: `{type}` or `{type: 'raise', to}`, always one `legal` allows (net/cardLaw.js
 * legalActions). `view` is the hand as his seat sees it (viewFor); `temper` one of PATRON_TEMPERS.
 * @param {{view: any, seat: number, legal: any, temper: {play: number, raise: number, bluff: number, edge: number}, rand32: () => number, samples?: number}} p
 */
export function patronDecision({ view, seat, legal, temper, rand32, samples = EQUITY_SAMPLES }) {
  const bluffing = unit(rand32) < temper.bluff;   // the decision's FIRST draw - the weighing's come after it
  const me = view.seats[seat];
  const opponents = view.seats.filter((s, i) => i !== seat && !s.folded).length;
  const pot = view.seats.reduce((a, s) => a + s.total, 0);
  const preflop = view.board.length === 0;
  const strength = preflop ? chenScore(me.hole) / 20 : equity(me.hole, view.board, opponents, rand32, samples);
  const call = legal.call;
  const odds = call > 0 ? call / (pot + call) : 0;   // the share of the pot after the call this call buys
  // facing a bet after the flop, what the hand is worth against the bettor - for the raise as for the call
  const pot0 = Math.max(1, pot - call);
  const facing = !preflop && call > 0 ? strength ** (1 + BETTOR_BEND * Math.min(BETTOR_BET_MAX, call / pot0)) : strength;
  const strong = facing >= temper.raise;
  // A bet or a raise: sized off the pot - a half to the whole of it, more the stronger - clamped to what the law allows.
  const raiseTo = () => {
    const want = view.currentBet + Math.round(pot * (0.5 + Math.min(1, Math.max(0, strength - temper.raise) * 2)));
    return { type: 'raise', to: Math.min(legal.raise.max, Math.max(legal.raise.min, want)) };
  };
  if (legal.raise && (strong || bluffing)) return raiseTo();
  if (legal.check) return { type: 'check' };
  // Facing a bet: before the flop, a hand under his temper's line folds; after it, a call wants its odds and his edge.
  const bb = Math.max(1, view.bb || 1);
  const plays = preflop
    ? strength >= temper.play + PRICE_PER_DOUBLING * Math.log2(Math.max(1, call / (PRICE_FREE_BB * bb))) - DEFEND * Math.max(0, DEFEND_ODDS - odds)
    : facing >= odds + temper.edge;
  if (plays || call <= 0) return { type: 'call' };
  return { type: 'fold' };
}
