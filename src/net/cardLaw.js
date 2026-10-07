// @ts-check
// CARDS1 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md - the Discord's "Card Games in Taverns", "Specifically Texas
// Hold'em"; Mac: "Hold'em first"): THE CARDS' LAW - pure, DOM-free, one home for both ends, the way `net/dice.js` is the
// dice's. The relay will deal from it (CARDS5) and the tavern's patrons will play by it (CARDS4); nothing here draws,
// sounds or waits.
//
// A CARD IS AN INTEGER 0..51: its rank `c % 13` (0 the deuce .. 12 the ace) and its suit `Math.floor(c / 13)` (clubs,
// diamonds, hearts, spades). Written the way the table writes it: `As`, `Td`, `2c`.
//
// THE SHUFFLE is Fisher-Yates over the dice's own unbiased draw (`drawBelow`), from whatever source of uniform 32-bit
// integers it is handed - the relay's crypto.getRandomValues, a test's script. Every one of the 52! orders is exactly
// as likely.
//
// THE HAND is No-Limit Texas Hold'em as a casino deals it, as a state machine whose every step returns a NEW state
// (the old one is never touched, so a relay can keep the last good one and a refused action changes nothing):
// blinds (heads-up the button posts the small one and acts first before the flop, last after it), the deal one card at
// a time from the seat left of the button, a burn before the flop, the turn and the river, four betting rounds, the
// minimum raise the last full raise, a short all-in that does not re-open the betting for a seat that already acted
// (until the short raises since its action add up to a full one), the board run out when nobody is left to bet, side
// pots by contribution, a split by the best five of seven, the odd chip to the first winner left of the button, an
// uncalled bet's layer home to its owner. Pots carry no rake.
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { drawBelow } from './dice.js';

export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';
export const DECK_SIZE = 52;
export const HOLDEM_SEATS_MIN = 2;
export const HOLDEM_SEATS_MAX = 6;

export const rankOf = (c) => c % 13;
export const suitOf = (c) => Math.floor(c / 13);
export const isCard = (c) => Number.isInteger(c) && c >= 0 && c < DECK_SIZE;

/** `As`, `Td`, `2c` - or null for what is not a card. */
export const cardText = (c) => (isCard(c) ? RANKS[rankOf(c)] + SUITS[suitOf(c)] : null);

/** The card a two-letter name names (`As`, `td`), or null. */
export function parseCard(text) {
  const t = String(text ?? '');
  if (t.length !== 2) return null;
  const r = RANKS.indexOf(t[0].toUpperCase());
  const s = SUITS.indexOf(t[1].toLowerCase());
  return r < 0 || s < 0 ? null : s * 13 + r;
}

/** The deck in its box order, 0..51. */
export const freshDeck = () => Array.from({ length: DECK_SIZE }, (_, i) => i);

/**
 * A shuffled copy of `deck` (a fresh one when none is handed): Fisher-Yates from the top down, each swap partner
 * drawn without bias.
 * @param {() => number} rand32
 * @param {number[]} [deck]
 */
export function shuffleDeck(rand32, deck = freshDeck()) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = drawBelow(i + 1, rand32);
    const t = d[i]; d[i] = d[j]; d[j] = t;
  }
  return d;
}

// ── THE HAND'S RANK ───────────────────────────────────────────────────────────────────────────────────────────────

export const HAND_HIGH_CARD = 0;
export const HAND_PAIR = 1;
export const HAND_TWO_PAIR = 2;
export const HAND_TRIPS = 3;
export const HAND_STRAIGHT = 4;
export const HAND_FLUSH = 5;
export const HAND_FULL_HOUSE = 6;
export const HAND_QUADS = 7;
export const HAND_STRAIGHT_FLUSH = 8;
export const HAND_NAMES = Object.freeze([
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
]);

/**
 * Five cards' rank: `{cat, ranks}` - the category, then the ranks that break a tie inside it, highest first (a full
 * house its trips then its pair; two pair the high pair, the low pair, the kicker; a straight its top card, the wheel
 * A-2-3-4-5 topped by its five).
 * @param {number[]} five
 */
export function rankFive(five) {
  const counts = new Array(13).fill(0);
  for (const c of five) counts[rankOf(c)]++;
  // Ranks by how many, then how high - [trips, pair] for a full house, [pair, pair, kicker] for two pair.
  const groups = [];
  for (let r = 12; r >= 0; r--) if (counts[r]) groups.push([counts[r], r]);
  groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const ranks = groups.map((g) => g[1]);
  const flush = five.every((c) => suitOf(c) === suitOf(five[0]));
  let top = -1;
  if (groups.length === 5) {
    if (ranks[0] - ranks[4] === 4) top = ranks[0];
    else if (ranks[0] === 12 && ranks[1] === 3) top = 3;   // the wheel: A-5-4-3-2, the five its top
  }
  if (top >= 0) return { cat: flush ? HAND_STRAIGHT_FLUSH : HAND_STRAIGHT, ranks: [top] };
  if (flush) return { cat: HAND_FLUSH, ranks };
  const shape = groups.map((g) => g[0]).join('');
  const cat = shape === '41' ? HAND_QUADS : shape === '32' ? HAND_FULL_HOUSE : shape === '311' ? HAND_TRIPS
    : shape === '221' ? HAND_TWO_PAIR : shape === '2111' ? HAND_PAIR : HAND_HIGH_CARD;
  return { cat, ranks };
}

/** <0, 0, >0 as hand `a` loses to, ties or beats hand `b`. */
export function compareHands(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat;
  for (let i = 0; i < Math.max(a.ranks.length, b.ranks.length); i++) {
    const d = (a.ranks[i] ?? -1) - (b.ranks[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

/**
 * The best five of five, six or seven cards: `{cat, ranks, cards}`, `cards` the five that make it.
 * @param {number[]} cards
 */
export function bestHand(cards) {
  if (cards.length < 5) return null;
  let best = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
      const h = rankFive(five);
      if (!best || compareHands(h, best) > 0) best = { ...h, cards: five };
    }
  return best;
}

/** The hand as the table says it: "Full House", "Pair". */
export const handName = (h) => HAND_NAMES[h.cat];

// ── THE POTS ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The pots one hand's contributions make: a layer for every level some seat put in, each `{amount, eligible}` - the
 * seats still in the hand that reached that level. A layer the same seats contest as the layer below joins it (a
 * folded blind is not a pot of its own), and so does one nobody still in reached; the main pot comes first, and an
 * uncalled bet is a top pot with one seat eligible - its own chips home.
 * @param {number[]} totals  what each seat put in this hand
 * @param {boolean[]} folded
 */
export function sidePots(totals, folded) {
  const levels = [...new Set(totals.filter((t) => t > 0))].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const t of totals) amount += Math.max(0, Math.min(t, level) - prev);
    const eligible = [];
    totals.forEach((t, i) => { if (!folded[i] && t >= level) eligible.push(i); });
    const last = pots[pots.length - 1];
    // A layer the same seats contest is the same pot; a layer nobody live reached joins the one below it.
    if (last && (!eligible.length || eligible.join() === last.eligible.join())) last.amount += amount;
    else pots.push({ amount, eligible });
    prev = level;
  }
  return pots;
}

// ── THE HAND, AS A STATE MACHINE ──────────────────────────────────────────────────────────────────────────────────

/** The streets, in order. `showdown` is the hand's end either way - shown down or won uncontested. */
export const STREETS = Object.freeze(['preflop', 'flop', 'turn', 'river', 'showdown']);
const BOARD_AFTER = { flop: 3, turn: 1, river: 1 };

const nextSeat = (n, i) => (i + 1) % n;
const canAct = (s) => !s.folded && !s.allIn;

/**
 * A new hand. `seats` are `{id, stack}` in table order (stack a whole number > 0), `button` the dealer's seat index,
 * `deck` a shuffled deck (shuffleDeck). Answers the hand's state, the blinds posted and the hole cards dealt, or null
 * for a table the law refuses.
 * @param {{seats: {id: string, stack: number}[], button: number, sb: number, bb: number, deck: number[]}} p
 */
export function newHand({ seats, button, sb, bb, deck }) {
  const n = seats?.length ?? 0;
  if (n < HOLDEM_SEATS_MIN || n > HOLDEM_SEATS_MAX) return null;
  if (!seats.every((s) => Number.isInteger(s.stack) && s.stack > 0)) return null;
  if (!Number.isInteger(sb) || !Number.isInteger(bb) || sb < 1 || bb < sb) return null;
  if (!Number.isInteger(button) || button < 0 || button >= n) return null;
  if (!Array.isArray(deck) || deck.length !== DECK_SIZE || new Set(deck).size !== DECK_SIZE || !deck.every(isCard)) return null;
  const st = {
    seats: seats.map((s) => ({ id: s.id, stack: s.stack, bet: 0, total: 0, hole: [], folded: false, allIn: false, acted: false, actedAt: 0 })),
    button, sb, bb,
    deck: deck.slice(), burned: [], board: [],
    street: 'preflop', toAct: -1, currentBet: 0, minRaise: bb,
    result: null,
  };
  // Heads-up the button is the small blind; otherwise the two seats after it.
  const sbSeat = n === 2 ? button : nextSeat(n, button);
  const bbSeat = nextSeat(n, sbSeat);
  post(st, sbSeat, sb);
  post(st, bbSeat, bb);
  st.currentBet = bb;   // a big blind all-in for less is still a full big blind to call (the casino's rule)
  for (let round = 0; round < 2; round++)
    for (let k = 1; k <= n; k++) st.seats[(button + k) % n].hole.push(st.deck.shift());
  st.toAct = firstToAct(st, nextSeat(n, bbSeat));
  return settleIfDone(st);
}

function post(st, i, amount) {
  const s = st.seats[i];
  const paid = Math.min(amount, s.stack);
  s.stack -= paid; s.bet += paid; s.total += paid;
  if (!s.stack) s.allIn = true;
}

/** The first seat from `from` round that still owes an action this round, or -1. A seat with nobody left to bet
 *  against owes one only when it faces a bet: there is nothing for it to check to. */
function firstToAct(st, from) {
  const n = st.seats.length;
  const bettors = st.seats.filter(canAct).length;
  for (let k = 0; k < n; k++) {
    const i = (from + k) % n;
    const s = st.seats[i];
    if (canAct(s) && (s.bet < st.currentBet || (!s.acted && bettors >= 2))) return i;
  }
  return -1;
}

const live = (st) => st.seats.filter((s) => !s.folded);

/**
 * What the seat to act may do: `{seat, fold, check, call, raise}` - `call` the chips a call puts in (0 when it cannot
 * call), `raise` null or `{min, max}` the totals this round a raise may make (`max` all-in; `min` the full raise, or
 * all-in when that is less). Null when it is nobody's turn or not this seat's.
 * @param {ReturnType<typeof newHand>} st
 * @param {number} seat
 */
export function legalActions(st, seat) {
  if (!st || st.result || st.toAct !== seat) return null;
  const s = st.seats[seat];
  const owe = st.currentBet - s.bet;
  const call = Math.min(owe, s.stack);
  const reach = s.bet + s.stack;   // all-in, as a total this round
  // A seat that acted may raise again only when the raising since its action adds up to a full raise.
  const open = !s.acted || st.currentBet - s.actedAt >= st.minRaise;
  const others = st.seats.some((o, i) => i !== seat && canAct(o));
  let raise = null;
  if (open && others && reach > st.currentBet) raise = { min: Math.min(st.currentBet + st.minRaise, reach), max: reach };
  return { seat, fold: true, check: owe <= 0, call: owe > 0 ? call : 0, raise };
}

/**
 * The hand after the seat to act acts: `{type: 'fold'|'check'|'call'}` or `{type: 'raise', to}` (`to` the seat's total
 * this round - a bet when nobody has bet). Null for an action the law refuses; the state handed in is never changed.
 * @param {ReturnType<typeof newHand>} st
 * @param {number} seat
 * @param {{type: string, to?: number}} action
 */
export function act(st, seat, action) {
  const legal = legalActions(st, seat);
  if (!legal || !action) return null;
  const next = structuredClone(st);
  const s = next.seats[seat];
  switch (action.type) {
    case 'fold': s.folded = true; break;
    case 'check': if (!legal.check) return null; break;
    case 'call': {
      if (!legal.call) return null;
      s.stack -= legal.call; s.bet += legal.call; s.total += legal.call;
      if (!s.stack) s.allIn = true;
      break;
    }
    case 'raise': {
      const to = action.to;
      if (!legal.raise || !Number.isInteger(to) || to < legal.raise.min || to > legal.raise.max) return null;
      const put = to - s.bet;
      s.stack -= put; s.bet = to; s.total += put;
      if (!s.stack) s.allIn = true;
      if (to - next.currentBet >= next.minRaise) next.minRaise = to - next.currentBet;   // a full raise sets the next
      next.currentBet = to;
      break;
    }
    default: return null;
  }
  s.acted = true;
  s.actedAt = next.currentBet;
  next.toAct = firstToAct(next, nextSeat(next.seats.length, seat));
  return settleIfDone(next);
}

/**
 * The seat clock's answer for a seat that did not act in time (CARDS5's): check when it can, fold when it cannot.
 * @param {ReturnType<typeof newHand>} st
 */
export function timeoutAction(st) {
  const legal = legalActions(st, st?.toAct ?? -1);
  return legal ? { type: legal.check ? 'check' : 'fold' } : null;
}

/** Ends the round when nobody owes an action, deals on, runs the board out, settles. Mutates the fresh copy it is handed. */
function settleIfDone(st) {
  if (live(st).length === 1) return finish(st, false);
  while (st.toAct < 0) {
    if (st.street === 'river') return finish(st, true);
    for (const s of st.seats) { s.bet = 0; s.acted = false; s.actedAt = 0; }
    st.currentBet = 0;
    st.minRaise = st.bb;
    st.street = STREETS[STREETS.indexOf(st.street) + 1];
    st.burned.push(st.deck.shift());
    for (let k = 0; k < BOARD_AFTER[st.street]; k++) st.board.push(st.deck.shift());
    st.toAct = firstToAct(st, nextSeat(st.seats.length, st.button));   // -1 when fewer than two can still bet
  }
  return st;
}

/**
 * The hand's end. Shown down: every pot to the best hand among its eligible seats, a split pot shared and its odd
 * chips dealt one each to the winners from the seat left of the button. Uncontested: the last seat takes it all, its
 * cards unshown.
 */
function finish(st, shown) {
  const n = st.seats.length;
  const totals = st.seats.map((s) => s.total);
  const folded = st.seats.map((s) => s.folded);
  const pots = sidePots(totals, folded);
  const hands = {};
  if (shown) st.seats.forEach((s, i) => { if (!s.folded) hands[i] = bestHand([...s.hole, ...st.board]); });
  const payouts = new Array(n).fill(0);
  const order = Array.from({ length: n }, (_, k) => (st.button + 1 + k) % n);
  const awarded = pots.map((pot) => {
    let winners = pot.eligible;
    if (shown && winners.length > 1) {
      let best = null;
      for (const i of winners) if (!best || compareHands(hands[i], best) > 0) best = hands[i];
      winners = winners.filter((i) => compareHands(hands[i], best) === 0);
    }
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    for (const i of order) {
      if (!winners.includes(i)) continue;
      payouts[i] += share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
    }
    return { amount: pot.amount, eligible: pot.eligible, winners };
  });
  st.seats.forEach((s, i) => { s.stack += payouts[i]; s.bet = 0; });
  st.street = 'showdown';
  st.toAct = -1;
  st.result = {
    shown,
    pots: awarded,
    payouts,
    hands: Object.fromEntries(Object.entries(hands).map(([i, h]) => [i, { cat: h.cat, ranks: h.ranks, cards: h.cards }])),
  };
  return st;
}

/**
 * The hand as one seat may see it - what the relay tells that seat (CARDS5): the deck and the burns never, another
 * seat's hole cards only when the hand was shown down and that seat was still in it. `seat` -1 is a spectator's view.
 * @param {ReturnType<typeof newHand>} st
 * @param {number} seat
 */
export function viewFor(st, seat) {
  const shown = !!st.result?.shown;
  return {
    button: st.button, sb: st.sb, bb: st.bb,
    board: st.board.slice(), street: st.street, toAct: st.toAct, currentBet: st.currentBet, minRaise: st.minRaise,
    seats: st.seats.map((s, i) => ({
      id: s.id, stack: s.stack, bet: s.bet, total: s.total, folded: s.folded, allIn: s.allIn,
      hole: i === seat || (shown && !s.folded) ? s.hole.slice() : null,
    })),
    result: st.result ? structuredClone(st.result) : null,
  };
}
