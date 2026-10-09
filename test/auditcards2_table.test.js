// AUDIT CARDS-2 (2026-10-08, bible/01-Overview/Audit-Cards-2.md): THE TABLE - the cards' law, the patrons' play, the
// evening's clock, the regulars' book and the save. Driven, each the reproduction of a finding or a mutant the first
// pins let live: an uncontested pot that went to nobody (A1); a fold out of turn that left the action on a seat nobody
// could bet against (E3); an all-in run-out said as one street and a hand the blinds settled said with none (L1, L2);
// the last showdown kept for the panel (M7); a patron acting before his cards landed (M6); a bet and an all-in said as
// such (L10); standing as a blind out of turn (E2); the regulars' purses kept by the day and in the save (H2); the
// patrons' play against a price and a bettor (H2, the farmed faucet) and the Chen rows and lines the first table never
// reached (E8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newHand, act, foldSeat, freshDeck, parseCard, legalActions, viewFor } from '../src/net/cardLaw.js';
import {
  CardTableSession, seatPatrons, settleMs, STREET_OF, PURSE_MIN_BB, PURSE_MAX_BB, THINK_MS, THINK_SPREAD_MS,
  regularsFor, regularsAfter, regularsBookRestore, REGULARS_BOOK_MAX,
} from '../src/systems/cardTableSession.js';
import { chenScore, equity, patronDecision, PATRON_TEMPERS, PRICE_PER_DOUBLING, PRICE_FREE_BB, BETTOR_BEND, DEFEND, DEFEND_ODDS } from '../src/systems/cardPatrons.js';
import { DEAL_STAGGER, THROW_LAND_S, FLIP_S } from '../src/world/cardMotion.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
const C = (s) => s.split(' ').map(parseCard);
const deal = (stacks, deck = freshDeck()) => newHand({ seats: stacks.map((stack, i) => ({ id: `p${i}`, stack })), button: 0, sb: 5, bb: 10, deck });
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
/** A first draw that never bluffs, then a seeded source for the weighing. */
const roll = (first, seed = 3) => { const r = seeded(seed); let n = 0; return () => (n++ === 0 ? first : r()); };
const NO_BLUFF = 0xFFFFFFFE;

test('AUDIT CARDS-2 A1: an uncontested pot only folded seats reached goes to the seat still in, never to nobody', () => {
  // both blinds fold out of turn, then the one who acts folds to a seat that has put in nothing
  let st = deal([1000, 1000, 1000, 1000]);
  st = foldSeat(st, 1);
  st = foldSeat(st, 2);
  st = act(st, 3, { type: 'fold' });
  assert.equal(st.result.shown, false);
  assert.deepEqual(st.result.payouts, [15, 0, 0, 0], 'the blinds are the last seat\'s');
  assert.deepEqual(st.result.pots[0].winners, [0]);
  assert.equal(sum(st.seats.map((s) => s.stack)), 4000, 'not a chip lost');
});

test('AUDIT CARDS-2 E3: a fold out of turn ends a round nobody is left to bet in - no seat asked to act alone', () => {
  let st = deal([1000, 50, 1000, 1000]);
  const a = (seat, type, to) => { st = act(st, seat, to === undefined ? { type } : { type, to }); assert.ok(st, `${seat} ${type}`); };
  a(3, 'call'); a(0, 'call'); a(1, 'raise', 50); a(2, 'call'); a(3, 'call'); a(0, 'call');
  assert.equal(st.street, 'flop');
  st = foldSeat(st, 3);
  st = foldSeat(st, 0);
  assert.equal(st.toAct, -1, 'the all-in and the one seat against it: nobody to ask');
  assert.ok(st.result, 'the board runs out and the hand is shown');
  assert.equal(st.result.shown, true);
  assert.equal(sum(st.seats.map((s) => s.stack)), 3050);
});

/** An evening where the player goes all in at his first chance, the clock 100 ms a step; its events. */
function shove({ seed = 1, stack = 500, patrons = 2, until = 90000 } = {}) {
  const r = seeded(seed);
  const s = new CardTableSession({ player: { id: 'you', name: 'You', stack }, patrons: seatPatrons(['Ana', 'Bors', 'Cael'].slice(0, patrons), { bb: 10 }, r), stakes: { sb: 5, bb: 10 }, rand32: r, now: 0 });
  const events = [];
  for (let now = 0; now < until && !s.over; now += 100) {
    s.tick(now);
    const l = s.legal();
    if (l) s.playerAct(l.raise ? { type: 'raise', to: l.raise.max } : l.check ? { type: 'check' } : { type: 'call' }, now);
    events.push(...s.drain());
  }
  return { s, events };
}

test('AUDIT CARDS-2 L1, L2: every street crossed is said - an all-in run-out, and a hand the blinds settled at the deal', () => {
  const { events } = shove({ seed: 1 });
  // a hand whose showdown came with the whole board run out in one action
  const hands = [];
  for (const e of events) { if (e.t === 'hand') hands.push([]); else hands.at(-1)?.push(e); }
  const runout = hands.find((h) => { const sd = h.find((e) => e.t === 'showdown'); return sd?.result.shown && h.filter((e) => e.t === 'street' && e.at === sd.at).length === 3; });
  assert.ok(runout, 'a preflop all-in run out to the river');
  const streets = runout.filter((e) => e.t === 'street');
  assert.deepEqual(streets.map((e) => [e.street, e.board.length]), [['flop', 3], ['turn', 4], ['river', 5]], 'flop, turn and river, each its own event');
  assert.deepEqual(streets[2].board.slice(0, 3), streets[0].board);
  assert.deepEqual(STREET_OF, { 3: 'flop', 4: 'turn', 5: 'river' });
  // heads-up with three chips: the big blind's all-in settles the hand at the deal - its streets still said
  const tiny = new CardTableSession({ player: { id: 'you', name: 'You', stack: 3 }, patrons: [{ id: 'patron:0', name: 'Ana', temper: 'tight', stack: 500 }], stakes: { sb: 5, bb: 10 }, rand32: seeded(2), now: 0 });
  let first = [];
  for (let now = 0; now < 30000 && !first.some((e) => e.t === 'showdown'); now += 100) { tiny.tick(now); first.push(...tiny.drain()); }
  first = first.slice(0, 5);
  assert.deepEqual(first.map((e) => e.t), ['hand', 'street', 'street', 'street', 'showdown']);
});

test('AUDIT CARDS-2 M7, M6, L10: the showdown kept till the next deal, the patron waits for the cloth, a bet and an all-in said', () => {
  const r = seeded(5);
  const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: seatPatrons(['Ana', 'Bors', 'Cael', 'Dun', 'Eira'], { bb: 10 }, r), stakes: { sb: 5, bb: 10 }, rand32: r, now: 0 });
  const events = [];
  let sawKept = false, sawCleared = false;
  for (let now = 0; now < 240000 && !s.over; now += 50) {
    s.tick(now);
    const l = s.legal();
    if (l) s.playerAct(l.check ? { type: 'check' } : l.call <= 20 ? { type: 'call' } : { type: 'fold' }, now);
    const got = s.drain();
    events.push(...got);
    const v = s.view();
    const sd = got.find((e) => e.t === 'showdown');
    if (sd) { assert.ok(!v.hand && v.showdown, 'the showdown in the view'); assert.deepEqual(v.showdown.result, sd.result); assert.deepEqual(v.showdown.board, sd.board); sawKept = true; }
    if (got.some((e) => e.t === 'hand') && sawKept) { assert.equal(v.showdown, null, 'gone at the next deal'); sawCleared = true; }
  }
  assert.ok(sawKept && sawCleared);
  // the first patron to act waits for the whole deal to land; after a street, for the street's cards to turn
  const n = 6;
  assert.equal(settleMs(n * 2), Math.round(((n * 2 - 1) * DEAL_STAGGER + THROW_LAND_S) * 1000));
  assert.equal(settleMs(3, true), Math.round((2 * DEAL_STAGGER + THROW_LAND_S + FLIP_S) * 1000));
  assert.equal(settleMs(0), 0);
  let hand = null, street = null, checked = 0;
  for (const e of events) {
    if (e.t === 'hand') { hand = e; street = null; continue; }
    if (e.t === 'street') { street = e; continue; }
    if (e.t !== 'act' || e.seat === 0) continue;
    const prev = events[events.indexOf(e) - 1];
    if (prev === hand) { assert.ok(e.at - hand.at >= settleMs(hand.seats.length * 2), `a patron acted ${e.at - hand.at} ms after the deal`); checked++; }
    if (street && prev === street) { assert.ok(e.at - street.at >= settleMs(street.street === 'flop' ? 3 : 1, true), `a patron acted ${e.at - street.at} ms after the ${street.street}`); checked++; }
  }
  assert.ok(checked > 10, `waits checked: ${checked}`);
  // the act event says a bet (a raise into nothing) and an all-in
  const acts = events.filter((e) => e.t === 'act' && e.type === 'raise');
  assert.ok(acts.some((e) => e.bet) && acts.some((e) => !e.bet), 'bets and raises both');
  for (const e of acts) if (e.bet) assert.notEqual(events.slice(0, events.indexOf(e)).reverse().find((x) => x.t === 'street' || x.t === 'hand')?.t, 'hand', 'a bet only after the flop');
  const { events: shoved } = shove({ seed: 3 });
  assert.ok(shoved.some((e) => e.t === 'act' && e.seat === 0 && e.allIn), 'the shove said all in');
  // a patron's thought is spread, not one beat
  const gaps = new Set();
  for (let i = 1; i < events.length; i++) if (events[i].t === 'act' && events[i].seat !== 0 && events[i - 1].t === 'act') gaps.add(events[i].at - events[i - 1].at);
  assert.ok([...gaps].some((g) => g >= THINK_MS + THINK_SPREAD_MS / 2), 'some thoughts run long');
});

test('AUDIT CARDS-2 E2: standing as the big blind out of turn - the blind stays in the pot, the hand plays on without him', () => {
  const r = seeded(12);
  const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: [{ id: 'patron:0', name: 'Ana', temper: 'tight', stack: 500 }, { id: 'patron:1', name: 'Bors', temper: 'tight', stack: 500 }], stakes: { sb: 5, bb: 10 }, rand32: r, now: 0 });
  let now = 0;
  // until a hand where the player is a blind with the action elsewhere
  for (; now < 600000; now += 100) {
    s.tick(now);
    const k = s.playerInHand;
    if (s.hand && k >= 0 && s.hand.seats[k].total > 0 && s.hand.toAct !== k) break;
    const l = s.legal();
    if (l) s.playerAct({ type: l.check ? 'check' : 'fold' }, now);
  }
  const k = s.playerInHand, h = s.hand;
  assert.ok(h && h.toAct !== k && h.seats[k].total > 0, 'a blind, out of turn');
  const inPot = h.seats[k].total, startStack = h.seats[k].stack + inPot;
  const potBefore = sum(h.seats.map((x) => x.total));
  s.drain();
  const back = s.leave(now);
  assert.equal(back, startStack - inPot, 'his stack less his blind');
  const ev = s.drain();
  assert.deepEqual(ev.map((e) => e.t), ['act', 'over']);
  assert.ok(s.hand ? sum(s.hand.seats.map((x) => x.total)) >= potBefore : true, 'his blind still in the pot');
  // heads-up, the stand ends the hand: the patron takes the pot at once, and it is said
  const hu = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: [{ id: 'patron:0', name: 'Ana', temper: 'tight', stack: 500 }], stakes: { sb: 5, bb: 10 }, rand32: seeded(4), now: 0 });
  hu.tick(0);
  hu.drain();
  const pk = hu.playerInHand, mine = hu.hand.seats[pk].total;
  assert.equal(hu.leave(10), 500 - mine);
  const end = hu.drain();
  assert.deepEqual(end.map((e) => e.t), ['act', 'showdown', 'over']);
  assert.equal(hu.seats[1].stack, 500 + mine, 'the pot is the patron\'s');
});

test('AUDIT CARDS-2 H2: the regulars\' book - today\'s purses kept, a broke regular out till tomorrow, the book in the save', () => {
  const names = ['Ana', 'Bors', 'Cael'];
  const fresh = regularsFor(null, 'k', 3, names, { bb: 10 }, seeded(1));
  assert.equal(fresh.length, 3);
  assert.deepEqual(fresh, seatPatrons(names, { bb: 10 }, seeded(1)), 'no book: a fresh evening');
  // the evening's end: Ana broke, Bors up, Cael as he sat
  const seats = [{ name: 'You', stack: 0, kind: 'player' }, { ...fresh[0], stack: 0, kind: 'patron' }, { ...fresh[1], stack: fresh[1].stack + 300, kind: 'patron' }, { ...fresh[2], kind: 'patron' }];
  const book = regularsAfter(null, 'k', 3, names, { bb: 10 }, seats);
  assert.deepEqual(book.k, { day: 3, bb: 10, purses: [0, fresh[1].stack + 300, fresh[2].stack], tempers: fresh.map((p) => p.temper) });
  const again = regularsFor(book, 'k', 3, names, { bb: 10 }, seeded(77));
  assert.deepEqual(again.map((p) => [p.name, p.stack, p.temper]), [['Bors', fresh[1].stack + 300, fresh[1].temper], ['Cael', fresh[2].stack, fresh[2].temper]], 'the same purses, the same tempers - Ana out');
  assert.equal(regularsFor(book, 'k', 4, names, { bb: 10 }, seeded(77)).length, 3, 'tomorrow, every one back with a fresh purse');
  assert.equal(regularsFor(book, 'k', 3, names, { bb: 50 }, seeded(77)).length, 3, 'other stakes, another table');
  assert.equal(regularsFor(book, 'other', 3, names, { bb: 10 }, seeded(77)).length, 3, 'another tavern, its own regulars');
  // an evening that seated only some leaves the rest's purses as the book had them
  const later = regularsAfter(book, 'k', 3, names, { bb: 10 }, [{ name: 'Bors', stack: 5, kind: 'patron' }]);
  assert.deepEqual(later.k.purses, [0, 5, fresh[2].stack]);
  // the book keeps the most recent REGULARS_BOOK_MAX taverns
  let big = {};
  for (let d = 0; d < REGULARS_BOOK_MAX + 5; d++) big = regularsAfter(big, `t${d}`, d, names, { bb: 10 }, seats);
  assert.equal(Object.keys(big).length, REGULARS_BOOK_MAX);
  assert.ok(!(('t0') in big) && (`t${REGULARS_BOOK_MAX + 4}` in big), 'the oldest day goes first');
  // the save's read keeps only well-formed rows
  assert.deepEqual(regularsBookRestore({ ok: { day: 2, bb: 10, purses: [5, '7', -3], tempers: ['tight', 'nonsense'] }, bad: { day: 'x' }, worse: null }), { ok: { day: 2, bb: 10, purses: [5, 7, 0], tempers: ['tight', null] } });
  assert.deepEqual(regularsBookRestore([1, 2]), {});
  assert.deepEqual(regularsBookRestore(undefined), {});
  // and the save carries it, both ways
  const entity = { name: 'Mac', goldPieces: 10, cardRegulars: book };
  const snap = snapshotPlayer(entity);
  assert.deepEqual(snap.cardRegulars, book);
  const back = {};
  restorePlayer(back, snap);
  assert.deepEqual(back.cardRegulars, book, 'a load puts the regulars back as it puts the purse back');
  restorePlayer(back, { ...snap, cardRegulars: undefined });
  assert.deepEqual(back.cardRegulars, {}, 'a save from before the book seats fresh regulars');
});

test('AUDIT CARDS-2 H2: the patrons play the price and the bettor - a shove is called by a shover\'s hands, top pair folds to an overbet', () => {
  assert.deepEqual([PRICE_PER_DOUBLING, PRICE_FREE_BB, BETTOR_BEND, DEFEND, DEFEND_ODDS], [0.05, 3, 0.5, 0.6, 0.33]);
  const spot = (holes, steps, stacks = [1000, 1000, 1000, 1000], board = null) => {
    let st = deal(stacks);
    for (const [seat, type, to] of steps) st = act(st, seat, to === undefined ? { type } : { type, to });
    if (board) st.board = C(board);
    st.seats[st.toAct].hole = C(holes);
    return st;
  };
  const decide = (st, temper, first = NO_BLUFF) => patronDecision({ view: viewFor(st, st.toAct), seat: st.toAct, legal: legalActions(st, st.toAct), temper: PATRON_TEMPERS[temper], rand32: roll(first), samples: 400 });
  // under the gun shoves 1000 (100 big blinds): tight folds jacks (Chen 12, 0.6 - over his open line of 0.5), calls aces
  const jj = spot('Js Jd', [[3, 'raise', 1000]]);
  assert.equal(jj.toAct, 0);
  assert.equal(decide(jj, 'tight').type, 'fold', 'jacks are not a call for a hundred big blinds');
  assert.notEqual(decide(spot('As Ad', [[3, 'raise', 1000]]), 'tight').type, 'fold', 'aces are');
  // the same jacks call a three big blind open
  assert.notEqual(decide(spot('Js Jd', [[3, 'raise', 30]]), 'tight').type, 'fold', 'an open\'s price costs the line nothing');
  // loose plays king-jack (0.35) for an open, folds it to a shove
  assert.equal(decide(spot('Kh Jd', [[3, 'raise', 30]]), 'loose').type, 'call');
  assert.equal(decide(spot('Kh Jd', [[3, 'raise', 1000]]), 'loose').type, 'fold');
  // a cheap price is defended: the big blind facing a min-raise plays a hand under his open line (tight, Chen 9 = 0.45)
  const minr = spot('Ks Js', [[3, 'raise', 20], [0, 'fold'], [1, 'fold']]);
  assert.equal(minr.toAct, 2);
  assert.equal(decide(minr, 'tight').type, 'call', 'a min-raise into the blind no longer takes it');
  // after the flop, on A-7-2: middle pair calls a half-pot bet and folds to a three-pot overbet; top pair raises the small
  // bet and only calls the overbet (the bettor's range bends the raise as it bends the call); a set raises them all
  const flop = (to, hole) => {
    let st = deal([2000, 2000]);
    st = act(st, 0, { type: 'call' }); st = act(st, 1, { type: 'check' });
    st.board = C('Ac 7d 2s');
    st = act(st, 1, { type: 'raise', to });
    st.seats[0].hole = C(hole);
    return st;
  };
  assert.equal(decide(flop(10, '7h 6h'), 'tight').type, 'call', 'half the pot: the odds are there');
  assert.equal(decide(flop(60, '7h 6h'), 'tight').type, 'fold', 'three times the pot is a strong hand\'s bet');
  assert.equal(decide(flop(10, 'Ah 4c'), 'tight').type, 'raise');
  assert.equal(decide(flop(60, 'Ah 4c'), 'tight').type, 'call', 'top pair calls the overbet, never raises into it');
  assert.equal(decide(flop(60, '7s 7c'), 'tight').type, 'raise', 'a set raises it');
});

test('AUDIT CARDS-2 E8: the Chen rows the first table missed, the lines exactly met, the raise sized by strength, the odds with the call', () => {
  for (const [hand, want] of [['Qs 9d', 5], ['Ks 9d', 4], ['Qs Jd', 7], ['Js Td', 7], ['Js 9d', 6]]) assert.equal(chenScore(C(hand)), want, hand);
  const decide = (st, temper) => patronDecision({ view: viewFor(st, st.toAct), seat: st.toAct, legal: legalActions(st, st.toAct), temper: PATRON_TEMPERS[temper], rand32: roll(NO_BLUFF), samples: 400 });
  // a three big blind open (odds 30/75 = 0.4, no price, no defence): Chen 6 = 0.30 meets loose's line exactly and plays
  let st = deal([1000, 1000, 1000, 1000]);
  st = act(st, 3, { type: 'raise', to: 30 });
  st.seats[0].hole = C('Js 9d');
  assert.equal(decide(st, 'loose').type, 'call', 'a line met is a line played');
  // the raise is sized by strength: aces raise more than queens, both over the bluffer's line (0.62; queens Chen 14 = 0.70)
  let base = deal([5000, 5000, 5000, 5000]);
  base = act(base, 3, { type: 'call' });
  const aces = structuredClone(base); aces.seats[0].hole = C('As Ah');
  const qq = structuredClone(base); qq.seats[0].hole = C('Qs Qh');
  const a = decide(aces, 'bluffer'), q = decide(qq, 'bluffer');
  assert.equal(a.type, 'raise'); assert.equal(q.type, 'raise');
  assert.ok(a.to > q.to, `aces ${a.to} over queens ${q.to}`);
  // the odds count the call (call / (pot + call), the share of the pot after it) - an edge set between the true odds and
  // the mistaken call / pot makes the one call and the other fold, on the patron's own seeded weighing
  let river = deal([1000, 1000]);
  river = act(river, 0, { type: 'call' }); river = act(river, 1, { type: 'check' });
  river.board = C('2c 7d 9h Jc Ks');
  river = act(river, 1, { type: 'raise', to: 20 });
  river.seats[0].hole = C('Kh 3d');
  const view = viewFor(river, 0), legal = legalActions(river, 0);
  const pot = view.seats.reduce((x, y) => x + y.total, 0), call = legal.call;
  const r = roll(NO_BLUFF); r();
  const e = equity(view.seats[0].hole, view.board, 1, r, 400);
  const facing = e ** (1 + BETTOR_BEND * Math.min(3, call / (pot - call)));
  const edge = facing - (call / (pot + call) + call / pot) / 2;
  const temper = { play: 0, raise: 2, bluff: 0, edge };
  assert.equal(patronDecision({ view, seat: 0, legal, temper, rand32: roll(NO_BLUFF), samples: 400 }).type, 'call');
  // and the weighing is against the opponents still IN: two folded seats are no hands to beat - an edge between the
  // equity against one hand and against three makes the patron call only when he counts the one
  let multi = deal([1000, 1000, 1000, 1000]);
  multi = act(multi, 3, { type: 'call' }); multi = act(multi, 0, { type: 'fold' }); multi = act(multi, 1, { type: 'fold' }); multi = act(multi, 2, { type: 'check' });
  multi.board = C('Qc 8d 3h');
  multi = act(multi, 2, { type: 'raise', to: 10 });
  multi.seats[3].hole = C('Qh 9s');
  const mv = viewFor(multi, 3), ml = legalActions(multi, 3);
  const mpot = mv.seats.reduce((x, y) => x + y.total, 0);
  const bend = (eq) => eq ** (1 + BETTOR_BEND * Math.min(3, ml.call / (mpot - ml.call)));
  const r1 = roll(NO_BLUFF); r1(); const one = bend(equity(mv.seats[3].hole, mv.board, 1, r1, 400));
  const r3 = roll(NO_BLUFF); r3(); const three = bend(equity(mv.seats[3].hole, mv.board, 3, r3, 400));
  assert.ok(one > three + 0.05, `against one ${one.toFixed(3)}, against three ${three.toFixed(3)}`);
  const odds3 = ml.call / (mpot + ml.call);
  assert.equal(patronDecision({ view: mv, seat: 3, legal: ml, temper: { play: 0, raise: 2, bluff: 0, edge: (one + three) / 2 - odds3 }, rand32: roll(NO_BLUFF), samples: 400 }).type, 'call');
});

test('AUDIT CARDS-2 E8: a purse reaches both ends of its range', () => {
  assert.equal(seatPatrons(['Ana'], { bb: 10 }, () => 0)[0].stack, PURSE_MIN_BB * 10);
  assert.equal(seatPatrons(['Ana'], { bb: 10 }, () => 0xFFFFFFFF)[0].stack, PURSE_MAX_BB * 10);
});
