// CARDS4 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 14): THE TABLE'S EVENING. Driven: the fold out of
// turn the law now takes (cardLaw foldSeat); the stakes a tavern's quality sets, the buy-in a purse allows, the patrons
// seated; whole evenings run on the clock - chips conserved hand after hand, the button walking the live seats, a
// patron acting only after his thought, a broke patron leaving, the evening ending broke, empty or left; and the
// player standing up mid-hand (his pot chips stay, the rest comes home) or between hands (all of it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newHand, act, foldSeat, freshDeck, legalActions } from '../src/net/cardLaw.js';
import {
  THINK_MS, THINK_SPREAD_MS, HAND_GAP_MS, TABLE_STAKES, BUY_IN_MIN_BB, BUY_IN_MAX_BB, PURSE_MIN_BB, PURSE_MAX_BB,
  stakesFor, buyInRange, seatPatrons, CardTableSession,
} from '../src/systems/cardTableSession.js';

const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
const table = (stacks) => ({ seats: stacks.map((stack, i) => ({ id: `p${i}`, stack })), button: 0, sb: 5, bb: 10, deck: freshDeck() });

test('CARDS4 a fold out of turn: the seat out, its chips in the pot, the action where it was', () => {
  const st = newHand(table([1000, 1000, 1000, 1000]));
  assert.equal(st.toAct, 3);
  const before = structuredClone(st);
  const f = foldSeat(st, 1);
  assert.deepEqual(st, before, 'the hand handed in is untouched');
  assert.equal(f.seats[1].folded, true);
  assert.equal(f.seats[1].total, 5, 'the small blind stays in the pot');
  assert.equal(f.toAct, 3, 'the action is where it was');
  assert.equal(foldSeat(f, 1), null, 'a seat already out');
  assert.equal(foldSeat(st, 9), null);
  // On its own turn it is the law's fold.
  assert.deepEqual(foldSeat(st, 3), act(st, 3, { type: 'fold' }));
  // The last opponent leaving ends the hand: the one left takes it, unshown.
  const hu = newHand(table([1000, 1000]));
  const won = foldSeat(hu, 1);
  assert.equal(won.result.shown, false);
  assert.deepEqual(won.seats.map((s) => s.stack), [1010, 990]);
  assert.equal(foldSeat(won, 0), null, 'a hand already over');
  // A round that waited only on the folded seat is over: the big blind folds out of turn while the small blind faces
  // nothing more - the flop comes.
  const limp = act(newHand(table([1000, 1000, 1000])), 0, { type: 'call' });
  const sb = act(limp, 1, { type: 'call' });
  assert.equal(sb.toAct, 2);
  const out = foldSeat(sb, 0);
  assert.equal(out.toAct, 2, 'the big blind still has his option');
});

test('CARDS4 the stakes, the buy-in, the patrons', () => {
  assert.deepEqual(TABLE_STAKES.map((s) => [s.upTo, s.bb]), [[7, 2], [13, 10], [20, 50]]);
  assert.deepEqual([1, 7, 8, 13, 14, 20, 0, 99, NaN].map(stakesFor), [
    { sb: 1, bb: 2 }, { sb: 1, bb: 2 }, { sb: 5, bb: 10 }, { sb: 5, bb: 10 }, { sb: 25, bb: 50 }, { sb: 25, bb: 50 }, { sb: 1, bb: 2 }, { sb: 25, bb: 50 }, { sb: 1, bb: 2 },
  ]);
  assert.deepEqual([BUY_IN_MIN_BB, BUY_IN_MAX_BB, PURSE_MIN_BB, PURSE_MAX_BB], [20, 100, 30, 120]);
  assert.deepEqual(buyInRange(5000, { bb: 10 }), { min: 200, max: 1000 });
  assert.deepEqual(buyInRange(350, { bb: 10 }), { min: 200, max: 350 });
  assert.equal(buyInRange(199, { bb: 10 }), null, 'cannot afford the least');
  const p = seatPatrons(['Ana', 'Bors', 'Cael', 'Dun', 'Eira', 'Fen', 'Gal'], { bb: 10 }, seeded(4));
  assert.equal(p.length, 5, 'six seats, one the player\'s');
  assert.deepEqual(p.map((x) => x.name), ['Ana', 'Bors', 'Cael', 'Dun', 'Eira']);
  for (const x of p) {
    assert.ok(['tight', 'loose', 'bluffer'].includes(x.temper));
    assert.ok(x.stack >= 300 && x.stack <= 1200 && x.stack % 10 === 0, `a purse in big blinds: ${x.stack}`);
  }
  assert.deepEqual(seatPatrons(['Ana', 'Bors'], { bb: 10 }, seeded(4)), p.slice(0, 2), 'the same source, the same patrons');
});

/** Run an evening: the player checks or calls (or folds when told to), the clock steps 100 ms. */
function evening({ seed = 1, patrons = 3, buyIn = 400, policy = 'cautious', until = 400000, hands = Infinity } = {}) {
  const rand32 = seeded(seed);
  const names = ['Ana', 'Bors', 'Cael', 'Dun', 'Eira'].slice(0, patrons);
  const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: buyIn }, patrons: seatPatrons(names, { bb: 10 }, rand32), stakes: { sb: 5, bb: 10 }, rand32, now: 0 });
  const events = [];
  let now = 0;
  for (; now < until && !s.over && s.handNo <= hands; now += 100) {
    s.tick(now);
    const legal = s.legal();
    // 'cautious': checks, calls up to two big blinds, folds the rest; 'fold': folds every bet
    if (legal) s.playerAct(legal.check ? { type: 'check' } : (policy === 'fold' || legal.call > 20) ? { type: 'fold' } : { type: 'call' }, now);
    events.push(...s.drain());
  }
  return { s, events, now };
}

test('CARDS4 an evening: chips conserved hand after hand, the button walking the live seats, patrons who think and leave broke', () => {
  const { s, events } = evening({ seed: 1, patrons: 3, buyIn: 400, until: 600000 });
  const start = 400 + seatPatrons(['Ana', 'Bors', 'Cael'], { bb: 10 }, seeded(1)).reduce((a, p) => a + p.stack, 0);
  const shows = events.filter((e) => e.t === 'showdown');
  assert.ok(shows.length >= 5, `hands played: ${shows.length}`);
  // After every hand the seats hold every chip there was.
  let seen = 0;
  for (const e of events) if (e.t === 'showdown') { seen++; assert.equal(e.result.payouts.reduce((a, b) => a + b, 0), e.result.pots.reduce((a, p) => a + p.amount, 0)); }
  assert.equal(s.seats.reduce((a, x) => a + x.stack, 0) + (s.hand ? s.hand.seats.reduce((a, x) => a + x.total, 0) + s.hand.seats.reduce((a, x) => a + x.stack, 0) - s.handSeats.reduce((a, i) => a + s.seats[i].stack, 0) : 0), start, 'not a chip made or lost');
  // The button moves to a live seat each hand, never stays put while two or more remain.
  const hands = events.filter((e) => e.t === 'hand');
  for (let i = 1; i < hands.length; i++) assert.notEqual(hands[i].button, hands[i - 1].button, `hand ${hands[i].hand}`);
  for (const h of hands) assert.ok(h.seats.includes(h.button));
  // A patron who left had no chips; nobody without chips is dealt in after.
  assert.ok(events.some((e) => e.t === 'leave'), 'a patron went broke this evening');
  for (const l of events.filter((e) => e.t === 'leave')) {
    assert.equal(s.seats[l.seat].stack, 0);
    assert.equal(s.view().seats[l.seat].gone, true, 'the panel shows the empty chair');
    assert.ok(!hands.some((h) => h.at > l.at && h.seats.includes(l.seat)), 'never dealt in again');
  }
  // Patrons wait their thought: every patron action at least THINK_MS after the event before it.
  let last = 0;
  for (const e of events) {
    if (e.t === 'act' && e.seat !== s.playerSeat) assert.ok(e.at - last >= THINK_MS, `a patron thought ${e.at - last} ms`);
    last = e.at;
  }
  assert.equal(seen, shows.length);
  assert.deepEqual([THINK_MS, THINK_SPREAD_MS, HAND_GAP_MS], [900, 1300, 3000]);
});

test('CARDS4 the next hand waits out the showdown\'s pause; the evening ends broke, empty or left', () => {
  const { events } = evening({ seed: 5, patrons: 2, until: 200000 });
  const shows = events.filter((e) => e.t === 'showdown'), hands = events.filter((e) => e.t === 'hand');
  for (const sh of shows) {
    const next = hands.find((h) => h.at > sh.at);
    if (next) assert.ok(next.at - sh.at >= HAND_GAP_MS, `the pause: ${next.at - sh.at}`);
  }
  // A player who folds every bet bleeds his blinds away: broke at last.
  const broke = evening({ seed: 6, patrons: 2, buyIn: 200, policy: 'fold', until: 5000000 });
  assert.equal(broke.s.over, 'broke');
  assert.deepEqual(broke.events.at(-1).t, 'over');
  // A table whose patrons are all broke is empty: one patron with no more than a blind's worth.
  const r = seeded(8);
  const lone = new CardTableSession({ player: { id: 'you', name: 'You', stack: 1000 }, patrons: [{ id: 'patron:0', name: 'Ana', temper: 'loose', stack: 10 }], stakes: { sb: 5, bb: 10 }, rand32: r, now: 0 });
  let now = 0;
  for (; now < 600000 && !lone.over; now += 100) { lone.tick(now); const l = lone.legal(); if (l) lone.playerAct(l.raise ? { type: 'raise', to: l.raise.max } : l.check ? { type: 'check' } : { type: 'call' }, now); }
  assert.ok(['empty', 'broke'].includes(lone.over), lone.over);
  if (lone.over === 'empty') assert.equal(lone.seats[0].stack, 1010, 'every chip his');
});

test('CARDS4 standing up: mid-hand his pot chips stay and the rest comes home; between hands, all of it', () => {
  const r = seeded(12);
  const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: [{ id: 'patron:0', name: 'Ana', temper: 'tight', stack: 500 }, { id: 'patron:1', name: 'Bors', temper: 'tight', stack: 500 }], stakes: { sb: 5, bb: 10 }, rand32: r, now: 0 });
  s.tick(0);
  assert.ok(s.hand, 'dealt at once');
  const k = s.playerInHand;
  const inPot = s.hand.seats[k].total;
  const chips = s.leave(10);
  assert.equal(chips, 500 - inPot, 'his stack less what he had put in');
  assert.equal(s.over, 'left');
  assert.equal(s.seats[s.playerSeat].stack, 0);
  assert.equal(s.view().seats[s.playerSeat].gone, true, 'his chair empty');
  assert.equal(s.leave(20), 0, 'a second stand takes nothing');
  assert.deepEqual(s.drain().map((e) => e.t).slice(-2), ['act', 'over']);
  // Between hands: every chip.
  const b = new CardTableSession({ player: { id: 'you', name: 'You', stack: 300 }, patrons: [{ id: 'patron:0', name: 'Ana', temper: 'tight', stack: 500 }], stakes: { sb: 5, bb: 10 }, rand32: seeded(2), now: 1000 });
  assert.equal(b.leave(0), 300);
  // The law is never asked for a folded leaver's chip: an evening run on after he left takes nothing from him.
  assert.equal(legalActions(newHand(table([10, 10])), 0).call, 5);
});
