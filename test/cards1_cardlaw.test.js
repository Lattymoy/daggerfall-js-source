// CARDS1 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md - "Specifically Texas Hold'em"; Mac: "Hold'em first"): THE
// CARDS' LAW. Driven: the card's name both ways, the shuffle over a scripted source (the swap partner's range and the
// dice's rejection), every hand category and its tie-break ranks against hand-written tables, the best five of seven,
// the pots by contribution, and whole hands played through the state machine - the blinds and the deal's order, the
// big blind's option, the minimum raise, a short all-in that does not re-open the betting and two that do, the board
// run out, side pots and a split's odd chip at the showdown, the uncontested win, the seat's own view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RANKS, SUITS, DECK_SIZE, cardText, parseCard, freshDeck, shuffleDeck, rankFive, compareHands, bestHand, handName,
  HAND_HIGH_CARD, HAND_PAIR, HAND_TWO_PAIR, HAND_TRIPS, HAND_STRAIGHT, HAND_FLUSH, HAND_FULL_HOUSE, HAND_QUADS,
  HAND_STRAIGHT_FLUSH, sidePots, newHand, legalActions, act, timeoutAction, viewFor,
} from '../src/net/cardLaw.js';

const C = (s) => s.split(' ').map(parseCard);
const script = (xs) => { let i = 0; return () => { if (i >= xs.length) throw new Error('script ran dry'); return xs[i++]; }; };

/** A deck that deals `holes[i]` to seat i (in the deal's own order from the seat left of the button), then a burn,
 *  the flop, a burn, the turn, a burn, the river from `board`; the rest of the box after. */
function stacked({ button, holes, board = [] }) {
  const n = holes.length;
  const top = [];
  for (let r = 0; r < 2; r++) for (let k = 1; k <= n; k++) top.push(parseCard(holes[(button + k) % n][r]));
  const b = board.map(parseCard);
  const rest = freshDeck().filter((c) => !top.includes(c) && !b.includes(c));
  const burn = () => rest.shift();
  if (b.length) top.push(burn(), b[0], b[1], b[2], burn(), b[3], burn(), b[4]);
  return [...top, ...rest];
}
const table = (stacks, extra = {}) => ({ seats: stacks.map((stack, i) => ({ id: `p${i}`, stack })), button: 0, sb: 5, bb: 10, ...extra });
const play = (st, steps) => steps.reduce((s, [seat, type, to]) => {
  const next = act(s, seat, to === undefined ? { type } : { type, to });
  assert.ok(next, `refused: seat ${seat} ${type} ${to ?? ''} on ${s.street}`);
  return next;
}, st);

test('CARDS1 a card is its integer: rank c % 13, suit c / 13, named both ways', () => {
  assert.equal(RANKS, '23456789TJQKA');
  assert.equal(SUITS, 'cdhs');
  assert.deepEqual([0, 12, 13, 21, 37, 51].map(cardText), ['2c', 'Ac', '2d', 'Td', 'Kh', 'As']);
  assert.deepEqual(['2c', 'Ac', 'td', 'kH', 'AS'].map(parseCard), [0, 12, 21, 37, 51]);
  assert.deepEqual(freshDeck().map(cardText).map(parseCard), freshDeck());
  assert.deepEqual([-1, 52, 1.5, '3', null].map(cardText), [null, null, null, null, null]);
  assert.deepEqual(['', 'A', 'Asd', '1s', 'Ax', null].map(parseCard), [null, null, null, null, null, null]);
});

test('CARDS1 the shuffle: Fisher-Yates from the top, each partner drawn 0..i, the dice\'s rejection', () => {
  // i=3 draws 5 % 4 = 1 (swap 3,1); i=2's first draw, 2^32-1, sits past the largest multiple of 3 and is thrown back,
  // 7 % 3 = 1 (swap 2,1); i=1 draws 1 % 2 = 1 (itself).
  assert.deepEqual(shuffleDeck(script([5, 0xFFFFFFFF, 7, 1]), [0, 1, 2, 3]), [0, 2, 3, 1]);
  // A partner drawn from 0..i, never 0..i-1: an all-zero source sends every card to the bottom once, in turn.
  assert.deepEqual(shuffleDeck(() => 0, [0, 1, 2, 3]), [1, 2, 3, 0]);
  assert.deepEqual(shuffleDeck(script([3, 2, 1]), [0, 1, 2, 3]), [0, 1, 2, 3]);
  const box = freshDeck();
  let x = 2463534242;
  const xorshift = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; };
  const d = shuffleDeck(xorshift, box);
  assert.deepEqual(box, freshDeck(), 'the deck handed in is untouched');
  assert.deepEqual(d.slice().sort((a, b) => a - b), freshDeck());
  assert.notDeepEqual(d, freshDeck());
  // All six orders of three cards turn up, near evenly (the identity included - a swap that skipped itself never
  // leaves a card where it was).
  const seen = new Map();
  for (let k = 0; k < 6000; k++) { const o = shuffleDeck(xorshift, [0, 1, 2]).join(''); seen.set(o, (seen.get(o) ?? 0) + 1); }
  assert.deepEqual([...seen.keys()].sort(), ['012', '021', '102', '120', '201', '210']);
  for (const v of seen.values()) assert.ok(v > 850 && v < 1150, `order seen ${v} of 6000`);
  assert.doesNotMatch(readFileSync(new URL('../src/net/cardLaw.js', import.meta.url), 'utf8'), /2 \*\* 32/,
    'the unbiased draw has one home, net/dice.js drawBelow');
});

test('CARDS1 every category and its tie-break ranks, five cards', () => {
  const rows = [
    ['As Ks Qs Js Ts', HAND_STRAIGHT_FLUSH, [12]],
    ['5s 4s 3s 2s As', HAND_STRAIGHT_FLUSH, [3]],
    ['Ah Ad Ac As Kd', HAND_QUADS, [12, 11]],
    ['9s 9d 3h 3d 3c', HAND_FULL_HOUSE, [1, 7]],
    ['2h 7h 9h Jh Kh', HAND_FLUSH, [11, 9, 7, 5, 0]],
    ['Ah 2d 3c 4s 5d', HAND_STRAIGHT, [3]],
    ['Th Jd Qc Ks Ad', HAND_STRAIGHT, [12]],
    ['6h 7d 8c 9s Td', HAND_STRAIGHT, [8]],
    ['7h 7d 7c Ks 2d', HAND_TRIPS, [5, 11, 0]],
    ['4s 9h 4c 9d Ad', HAND_TWO_PAIR, [7, 2, 12]],
    ['Jh Jd 8c 4s 2d', HAND_PAIR, [9, 6, 2, 0]],
    ['Ah Qd 9c 6s 3d', HAND_HIGH_CARD, [12, 10, 7, 4, 1]],
    ['Kh Ad 2c 3s 4d', HAND_HIGH_CARD, [12, 11, 2, 1, 0]],   // no straight round the corner
  ];
  assert.deepEqual(rows.map(([h]) => rankFive(C(h))), rows.map(([, cat, ranks]) => ({ cat, ranks })));
  assert.deepEqual(rows.map(([h]) => handName(rankFive(C(h)))), [
    'Straight Flush', 'Straight Flush', 'Four of a Kind', 'Full House', 'Flush', 'Straight', 'Straight', 'Straight',
    'Three of a Kind', 'Two Pair', 'Pair', 'High Card', 'High Card',
  ]);
});

test('CARDS1 the best five of seven, and the order of hands', () => {
  const best = (h) => { const b = bestHand(C(h)); return { cat: b.cat, ranks: b.ranks, cards: b.cards.map(cardText).sort() }; };
  // A flush in the board's spades over the straight the hole cards make.
  assert.deepEqual(best('Ah Kh 9s Ts Js Qs 2s'), { cat: HAND_FLUSH, ranks: [10, 9, 8, 7, 0], cards: ['2s', '9s', 'Js', 'Qs', 'Ts'] });
  // Three pairs: the top two, and the ace beats the third pair as the kicker.
  assert.deepEqual(best('Kh Kd 9s 9c 4h 4d Ac'), { cat: HAND_TWO_PAIR, ranks: [11, 7, 12], cards: ['9c', '9s', 'Ac', 'Kd', 'Kh'] });
  // The six-high straight, not the wheel inside it.
  assert.deepEqual(best('Ah 2d 3c 4s 5h 6d Kc'), { cat: HAND_STRAIGHT, ranks: [4], cards: ['2d', '3c', '4s', '5h', '6d'] });
  // Two trips: the full house from the higher trips and a pair of the lower (which two fives, the rank cannot say).
  assert.deepEqual(rankFive(bestHand(C('8h 8d 8c 5s 5h 5d 2c')).cards), { cat: HAND_FULL_HOUSE, ranks: [6, 3] });
  assert.equal(bestHand(C('As Ks Qs Js')), null);
  const order = ['Kh Ad 2c 3s 4d', 'Jh Jd 8c 4s 2d', '4s 9h 4c 9d Ad', '7h 7d 7c Ks 2d', 'Ah 2d 3c 4s 5d', '6h 7d 8c 9s Td',
    '2h 7h 9h Jh Kh', '9s 9d 3h 3d 3c', 'Ah Ad Ac As Kd', '5s 4s 3s 2s As', 'As Ks Qs Js Ts'].map((h) => rankFive(C(h)));
  for (let i = 0; i < order.length; i++) for (let j = 0; j < order.length; j++)
    assert.equal(Math.sign(compareHands(order[i], order[j])), Math.sign(i - j), `${i} vs ${j}`);
  // The kicker decides, and a tie is a tie whatever the suits.
  assert.ok(compareHands(rankFive(C('Ah Ad Kc 7s 2d')), rankFive(C('As Ac Qc 7d 2h'))) > 0);
  assert.ok(compareHands(rankFive(C('Ah Ad Kc 7s 3d')), rankFive(C('As Ac Kd 7d 2h'))) > 0);
  assert.equal(compareHands(rankFive(C('Ah Kd Qc Js 9d')), rankFive(C('As Kc Qd Jh 9c'))), 0);
});

test('CARDS1 the pots by contribution: layers, folded chips, the uncalled bet', () => {
  // Three all-ins of 100, 300, 300 - the main pot all three's, the side two's.
  assert.deepEqual(sidePots([100, 300, 300], [false, false, false]), [{ amount: 300, eligible: [0, 1, 2] }, { amount: 400, eligible: [1, 2] }]);
  // A folded blind is chips in the pot, never a pot of its own.
  assert.deepEqual(sidePots([6, 3, 6], [false, true, false]), [{ amount: 15, eligible: [0, 2] }]);
  // An uncalled raise: its top layer only its owner's.
  assert.deepEqual(sidePots([50, 200, 50], [false, false, false]), [{ amount: 150, eligible: [0, 1, 2] }, { amount: 150, eligible: [1] }]);
  // A short all-in's main pot, the folded seat's chips in both layers they reached.
  assert.deepEqual(sidePots([40, 100, 100, 70], [false, false, false, true]),
    [{ amount: 160, eligible: [0, 1, 2] }, { amount: 150, eligible: [1, 2] }]);
  assert.deepEqual(sidePots([0, 0], [false, false]), []);
});

test('CARDS1 the blinds and the deal: heads-up the button posts small; the deal from the seat left of it', () => {
  const deck = stacked({ button: 0, holes: [['As', 'Ks'], ['Qh', 'Qd']] });
  const st = newHand({ ...table([1000, 1000]), deck });
  assert.deepEqual(st.seats.map((s) => [s.stack, s.bet, s.hole.map(cardText)]), [[995, 5, ['As', 'Ks']], [990, 10, ['Qh', 'Qd']]]);
  assert.equal(st.toAct, 0, 'heads-up, the button acts first before the flop');
  assert.equal(st.currentBet, 10);
  assert.deepEqual(st.deck, deck.slice(4));
  const three = newHand({ ...table([1000, 1000, 1000], { button: 1 }), deck: freshDeck() });
  assert.deepEqual(three.seats.map((s) => s.bet), [10, 0, 5], 'the small blind left of the button, the big after it');
  assert.equal(three.toAct, 1, 'three-handed the button is first to act');
  assert.deepEqual(three.seats.map((s) => s.hole), [[1, 4], [2, 5], [0, 3]]);
  // A blind bigger than a stack posts the stack, all-in.
  const short = newHand({ ...table([1000, 7]), deck: freshDeck() });
  assert.deepEqual(short.seats.map((s) => [s.stack, s.bet, s.allIn]), [[995, 5, false], [0, 7, true]]);
  assert.equal(short.currentBet, 10, 'a short big blind is still a full big blind to call');
  // The law refuses a table it cannot deal.
  for (const bad of [table([1000]), table([1, 1, 1, 1, 1, 1, 1]), table([1000, 0]), table([1000, 10.5]), table([1000, 1000], { sb: 0 }),
    table([1000, 1000], { sb: 10, bb: 5 }), table([1000, 1000], { button: 2 })])
    assert.equal(newHand({ ...bad, deck: freshDeck() }), null);
  assert.equal(newHand({ ...table([1000, 1000]), deck: freshDeck().slice(1) }), null);
  assert.equal(newHand({ ...table([1000, 1000]), deck: [...freshDeck().slice(1), 1] }), null);
});

test('CARDS1 the big blind\'s option, a check-down, the showdown', () => {
  const deck = stacked({ button: 0, holes: [['As', 'Ks'], ['Qh', 'Qd']], board: ['2c', '7d', '9h', '3s', '4c'] });
  let st = newHand({ ...table([1000, 1000]), deck });
  st = play(st, [[0, 'call']]);
  assert.deepEqual(legalActions(st, 1), { seat: 1, fold: true, check: true, call: 0, raise: { min: 20, max: 1000 } });
  st = play(st, [[1, 'check']]);
  assert.equal(st.street, 'flop');
  assert.deepEqual(st.board.map(cardText), ['2c', '7d', '9h']);
  assert.equal(st.toAct, 1, 'after the flop, heads-up, the big blind acts first');
  assert.deepEqual(legalActions(st, 1), { seat: 1, fold: true, check: true, call: 0, raise: { min: 10, max: 990 } });
  st = play(st, [[1, 'check'], [0, 'check'], [1, 'check'], [0, 'check'], [1, 'check'], [0, 'check']]);
  assert.equal(st.street, 'showdown');
  assert.equal(st.burned.length, 3);
  assert.deepEqual(st.board.map(cardText), ['2c', '7d', '9h', '3s', '4c']);
  assert.deepEqual(st.result.pots, [{ amount: 20, eligible: [0, 1], winners: [1] }]);
  assert.deepEqual(st.result.payouts, [0, 20]);
  assert.deepEqual(st.seats.map((s) => s.stack), [990, 1010]);
  const said = (h) => ({ cat: h.cat, ranks: h.ranks, cards: h.cards.map(cardText).sort() });
  assert.deepEqual(said(st.result.hands[1]), { cat: HAND_PAIR, ranks: [10, 7, 5, 2], cards: ['4c', '7d', '9h', 'Qd', 'Qh'] });
  assert.deepEqual(said(st.result.hands[0]), { cat: HAND_HIGH_CARD, ranks: [12, 11, 7, 5, 2], cards: ['4c', '7d', '9h', 'As', 'Ks'] });
  assert.equal(legalActions(st, 0), null, 'nobody acts in a finished hand');
});

test('CARDS1 a fold wins it uncontested: one pot, the cards unshown', () => {
  let st = newHand({ ...table([1000, 1000]), deck: freshDeck() });
  st = play(st, [[0, 'fold']]);
  assert.equal(st.result.shown, false);
  assert.deepEqual(st.result.pots, [{ amount: 15, eligible: [1], winners: [1] }]);
  assert.deepEqual(st.seats.map((s) => s.stack), [995, 1005]);
  assert.deepEqual(st.result.hands, {});
  assert.deepEqual(viewFor(st, -1).seats.map((s) => s.hole), [null, null]);
});

test('CARDS1 the minimum raise, and a short all-in that does not re-open the betting', () => {
  // Button 0, small blind 1 (45 behind it all told), big blind 2, under the gun 3.
  let st = newHand({ ...table([1000, 45, 1000, 1000]), deck: freshDeck() });
  assert.equal(st.toAct, 3);
  assert.deepEqual(legalActions(st, 3).raise, { min: 20, max: 1000 });
  assert.equal(act(st, 3, { type: 'raise', to: 19 }), null, 'less than the big blind again is no raise');
  st = play(st, [[3, 'raise', 30]]);
  assert.equal(st.minRaise, 20);
  assert.deepEqual(legalActions(st, 0).raise, { min: 50, max: 1000 });
  st = play(st, [[0, 'call']]);
  assert.deepEqual(legalActions(st, 1), { seat: 1, fold: true, check: false, call: 25, raise: { min: 45, max: 45 } }, 'all-in for less than a full raise is allowed');
  st = play(st, [[1, 'raise', 45]]);
  assert.equal(st.currentBet, 45);
  assert.equal(st.minRaise, 20, 'a short raise leaves the minimum where the last full raise set it');
  assert.deepEqual(legalActions(st, 2).raise, { min: 65, max: 1000 }, 'the big blind had not acted: it may raise');
  st = play(st, [[2, 'call']]);
  assert.deepEqual(legalActions(st, 3), { seat: 3, fold: true, check: false, call: 15, raise: null }, 'the opener already acted: call or fold');
  assert.equal(act(st, 3, { type: 'raise', to: 100 }), null);
  st = play(st, [[3, 'call']]);
  assert.deepEqual(legalActions(st, 0), { seat: 0, fold: true, check: false, call: 15, raise: null });
  st = play(st, [[0, 'call']]);
  assert.equal(st.street, 'flop');
  assert.equal(st.toAct, 2, 'after the flop the first seat left of the button that can still bet');
  assert.deepEqual(legalActions(st, 2).raise, { min: 10, max: 955 }, 'a new street\'s first bet is a big blind again');
  assert.deepEqual(st.seats.map((s) => s.total), [45, 45, 45, 45]);
});

test('CARDS1 two short all-ins that add up to a full raise re-open it', () => {
  // Button 0 (60 behind), small blind 1, big blind 2, 3 under the gun, 4 with 45.
  let st = newHand({ ...table([60, 1000, 1000, 1000, 45]), deck: freshDeck() });
  st = play(st, [[3, 'raise', 30], [4, 'raise', 45]]);
  assert.deepEqual(legalActions(st, 0).raise, { min: 60, max: 60 });
  st = play(st, [[0, 'raise', 60], [1, 'fold'], [2, 'call']]);
  assert.deepEqual(legalActions(st, 3), { seat: 3, fold: true, check: false, call: 30, raise: { min: 80, max: 1000 } });
  // With nobody left who could call a raise, there is no raise to make.
  const alone = play(newHand({ ...table([60, 1000, 1000, 1000, 45]), deck: freshDeck() }), [[3, 'raise', 30], [4, 'raise', 45], [0, 'raise', 60], [1, 'fold'], [2, 'fold']]);
  assert.deepEqual(legalActions(alone, 3), { seat: 3, fold: true, check: false, call: 30, raise: null });
});

test('CARDS1 all-in before the flop: the board runs out, the pots split by contribution', () => {
  const deck = stacked({ button: 0, holes: [['As', 'Ah'], ['3d', '5h'], ['Kd', 'Kh']], board: ['2c', '7d', '9h', 'Js', '4c'] });
  let st = newHand({ ...table([100, 300, 500]), deck });
  st = play(st, [[0, 'raise', 100], [1, 'raise', 300]]);
  assert.equal(st.minRaise, 200);
  st = play(st, [[2, 'call']]);
  assert.equal(st.street, 'showdown', 'nobody left to bet against: the board is dealt out');
  assert.deepEqual(st.board.map(cardText), ['2c', '7d', '9h', 'Js', '4c']);
  assert.deepEqual(st.result.pots, [{ amount: 300, eligible: [0, 1, 2], winners: [0] }, { amount: 400, eligible: [1, 2], winners: [2] }]);
  assert.deepEqual(st.seats.map((s) => s.stack), [300, 0, 600]);
  assert.equal(st.seats.reduce((a, s) => a + s.stack, 0), 900, 'no chip made or lost');
});

test('CARDS1 a split pot: the odd chip to the first winner left of the button; a folded hand stays hidden', () => {
  const deck = stacked({ button: 0, holes: [['2c', '3d'], ['4h', '5h'], ['6c', '7d']], board: ['Ts', 'Js', 'Qs', 'Ks', 'As'] });
  let st = newHand({ ...table([1000, 1000, 1000], { sb: 3, bb: 6 }), deck });
  st = play(st, [[0, 'call'], [1, 'fold'], [2, 'check']]);
  for (let k = 0; k < 3; k++) st = play(st, [[2, 'check'], [0, 'check']]);
  assert.deepEqual(st.result.pots, [{ amount: 15, eligible: [0, 2], winners: [0, 2] }]);
  assert.deepEqual(st.result.payouts, [7, 0, 8]);
  assert.deepEqual(st.seats.map((s) => s.stack), [1001, 997, 1002]);
  assert.deepEqual(viewFor(st, -1).seats.map((s) => s.hole && s.hole.map(cardText)), [['2c', '3d'], null, ['6c', '7d']]);
  assert.deepEqual(Object.keys(st.result.hands), ['0', '2']);
});

test('CARDS1 the seat\'s own view: its cards, never another\'s, never the deck', () => {
  const st = newHand({ ...table([1000, 1000, 1000]), deck: freshDeck() });
  const v = viewFor(st, 1);
  assert.deepEqual(v.seats.map((s) => s.hole), [null, [0, 3], null]);
  assert.equal('deck' in v, false);
  assert.equal('burned' in v, false);
  assert.deepEqual(viewFor(st, -1).seats.map((s) => s.hole), [null, null, null]);
  v.seats[1].hole.push(99);
  assert.deepEqual(st.seats[1].hole, [0, 3], 'the view is a copy');
});

test('CARDS1 an action never touches the hand it is handed; a refused one is null; the seat clock', () => {
  const st = newHand({ ...table([1000, 1000, 1000]), deck: freshDeck() });
  const before = structuredClone(st);
  const after = act(st, 0, { type: 'raise', to: 40 });
  assert.deepEqual(st, before);
  assert.equal(after.currentBet, 40);
  assert.equal(act(st, 1, { type: 'call' }), null, 'out of turn');
  assert.equal(act(st, 0, { type: 'check' }), null, 'a check facing a bet');
  assert.equal(act(st, 0, { type: 'bet' }), null);
  assert.equal(act(st, 0, null), null);
  assert.equal(act(st, 0, { type: 'raise', to: 1001 }), null, 'more than the stack');
  assert.equal(act(st, 0, { type: 'raise', to: 25.5 }), null);
  assert.deepEqual(timeoutAction(st), { type: 'fold' });
  const limped = play(st, [[0, 'call'], [1, 'call']]);
  assert.deepEqual(timeoutAction(limped), { type: 'check' }, 'the big blind\'s option times out to a check');
  assert.equal(DECK_SIZE, 52);
});
