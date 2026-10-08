// CARDS4 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 14; Mac: "Yes, patrons play"): THE PATRONS' PLAY.
// Driven: the Chen score against the tabletop's own table, the equity against hands whose share is known (a made
// royal, a dead hand, aces against one random hand, a coin flip) and its determinism over a seeded source, and the
// decision every temper makes - always a legal action, folds what it should, bets what it should, bluffs as often as
// its temper says, sizes inside the law, calls by the pot's odds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCard, newHand, legalActions, viewFor, act, freshDeck, shuffleDeck } from '../src/net/cardLaw.js';
import { EQUITY_SAMPLES, PATRON_TEMPERS, TEMPER_NAMES, unit, chenScore, equity, patronDecision } from '../src/systems/cardPatrons.js';

const C = (s) => s.split(' ').map(parseCard);
const seeded = (seed = 2463534242) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
/** A source whose first draw is `first` (the bluff's roll) and the rest a seeded stream (the weighing's). */
const roll = (first) => { const s = seeded(3); let n = 0; return () => (n++ === 0 ? first : s()); };
const NO_BLUFF = 0xFFFFFFFE, BLUFF = 0;
const near = (v, want, tol, msg) => assert.ok(Math.abs(v - want) <= tol, `${msg}: ${v.toFixed(3)} vs ${want}`);

test('CARDS4 the Chen score: the tabletop\'s own table', () => {
  const rows = [
    ['As Ah', 20], ['Ks Kh', 16], ['Qs Qh', 14], ['Js Jh', 12], ['Ts Th', 10], ['5s 5h', 5], ['2s 2h', 5],
    ['As Ks', 12], ['As Kh', 10], ['Ts 9s', 8], ['5h 4h', 6], ['5h 4d', 4], ['7s 2d', -1], ['As 2d', 5], ['Kh Jd', 7], ['9s 7s', 7],
  ];
  assert.deepEqual(rows.map(([h]) => chenScore(C(h))), rows.map(([, s]) => s));
});

test('CARDS4 the equity: known shares, a seeded source, the dead cards out', () => {
  assert.equal(EQUITY_SAMPLES, 200);
  // A made royal flush cannot lose; a hand drawing dead on the river cannot win.
  assert.equal(equity(C('As Ks'), C('Qs Js Ts 2c 3d'), 3, seeded()), 1);
  near(equity(C('2c 7d'), C('As Ks Qs Js Ts'), 2, seeded()), 1 / 3, 1e-9, 'the board plays: a three-way split, every time');
  assert.equal(equity(C('2c 7d'), [], 0, seeded()), 1, 'nobody left to beat');
  // Aces against one random hand win about 85 % (the tabletop's figure); a pair against two overs is near a coin flip.
  near(equity(C('As Ah'), [], 1, seeded(), 2000), 0.852, 0.03, 'aces heads-up');
  near(equity(C('Qs Qh'), [], 1, seeded(7), 2000), 0.80, 0.03, 'queens heads-up');
  // The same source gives the same share; another gives another.
  assert.equal(equity(C('Jh Th'), C('9h 2c 3d'), 2, seeded(5)), equity(C('Jh Th'), C('9h 2c 3d'), 2, seeded(5)));
  assert.notEqual(equity(C('Jh Th'), C('9h 2c 3d'), 2, seeded(5)), equity(C('Jh Th'), C('9h 2c 3d'), 2, seeded(6)));
  // A card known dead is never dealt: with every card dead but the 7c and 8d, the one opponent holds them - the straight
  // over his king-high, every deal (counted live, he would win most of them).
  const shown = C('2c 3d 5h 6s 9c Jd Kh 7c 8d');
  const dead = freshDeck().filter((c) => !shown.includes(c));
  assert.equal(equity(C('2c 3d'), C('5h 6s 9c Jd Kh'), 1, seeded(), 50, dead), 0);
  assert.ok(equity(C('2c 3d'), C('5h 6s 9c Jd Kh'), 1, seeded(), 300) > 0, 'live, he wins or splits a share');
  near(unit(() => 0), 0, 0, 'unit 0'); near(unit(() => 0xFFFFFFFF), 1 - 2 ** -32, 1e-12, 'unit below 1');
});

/** A hand at the point where `seat` acts, after `steps`. */
function spot({ stacks = [1000, 1000, 1000], holes, steps = [], board = null, button = 0 }) {
  const deck = freshDeck().slice();
  // put the wanted holes where the deal hands them out (one card a seat from the button's left, twice)
  const want = holes.map((h) => (h ? C(h) : null));
  const n = stacks.length, order = [];
  for (let r = 0; r < 2; r++) for (let k = 1; k <= n; k++) order.push([(button + k) % n, r]);
  const used = new Set(want.flat().filter((c) => c != null).concat(board ? C(board) : []));
  const rest = shuffleDeck(seeded(9), deck.filter((c) => !used.has(c)));
  const top = order.map(([s, r]) => (want[s] ? want[s][r] : rest.shift()));
  const tail = board ? (() => { const b = C(board); return [rest.shift(), b[0], b[1], b[2], rest.shift(), b[3], rest.shift(), b[4]]; })() : [];
  let st = newHand({ seats: stacks.map((s, i) => ({ id: `p${i}`, stack: s })), button, sb: 5, bb: 10, deck: [...top, ...tail, ...rest] });
  for (const [seat, type, to] of steps) st = act(st, seat, to === undefined ? { type } : { type, to });
  return st;
}
const decide = (st, temper, rand32 = seeded(), samples = 300) => patronDecision({ view: viewFor(st, st.toAct), seat: st.toAct, legal: legalActions(st, st.toAct), temper: PATRON_TEMPERS[temper], rand32, samples });

test('CARDS4 the tempers, and every decision a legal one', () => {
  assert.deepEqual(TEMPER_NAMES, ['tight', 'loose', 'bluffer']);
  assert.deepEqual(PATRON_TEMPERS.tight, { play: 0.5, raise: 0.72, bluff: 0.03, edge: 0.05 });
  // A thousand random spots, every temper: the action is always one the law takes.
  const r = seeded(11);
  for (let k = 0; k < 300; k++) {
    let st = newHand({ seats: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, stack: 200 + (r() % 800) })), button: k % 4, sb: 5, bb: 10, deck: shuffleDeck(r) });
    let guard = 0;
    while (!st.result && guard++ < 60) {
      const temper = TEMPER_NAMES[(st.toAct + k) % 3];
      const a = decide(st, temper, r, 40);
      const next = act(st, st.toAct, a);
      assert.ok(next, `an illegal ${JSON.stringify(a)} from a ${temper} patron on ${st.street}`);
      st = next;
    }
    assert.ok(st.result, 'the hand ends');
  }
});

test('CARDS4 what each temper does: folds rags to a raise, raises aces, checks a weak hand, calls the odds after the flop', () => {
  // Under the gun raises to 40; the button holds seven-deuce - every temper folds it (the bluffer only when he does not bluff).
  const rags = spot({ holes: ['7s 2d', null, null], steps: [] });
  const raised = spot({ stacks: [1000, 1000, 1000, 1000], holes: [null, null, null, null], steps: [[3, 'raise', 40]] });
  assert.equal(raised.toAct, 0);
  const sevenDeuce = spot({ stacks: [1000, 1000, 1000, 1000], holes: ['7s 2d', null, null, null], steps: [[3, 'raise', 40]] });
  for (const t of ['tight', 'loose']) assert.deepEqual(decide(sevenDeuce, t, roll(NO_BLUFF)), { type: 'fold' }, `${t} folds seven-deuce to a raise`);
  assert.deepEqual(decide(sevenDeuce, 'bluffer', roll(NO_BLUFF)), { type: 'fold' }, 'the bluffer too, when he does not bluff');
  assert.equal(decide(sevenDeuce, 'bluffer', roll(BLUFF)).type, 'raise', 'and raises it when he does');
  assert.equal(rags.toAct, 0);
  // Aces raise, for every temper, and the raise is inside the law.
  const aces = spot({ stacks: [1000, 1000, 1000, 1000], holes: ['As Ah', null, null, null], steps: [[3, 'raise', 40]] });
  for (const t of TEMPER_NAMES) {
    const a = decide(aces, t, roll(NO_BLUFF));
    const legal = legalActions(aces, 0);
    assert.equal(a.type, 'raise', `${t} raises aces`);
    assert.ok(a.to >= legal.raise.min && a.to <= legal.raise.max, `${t}'s raise inside the law: ${a.to}`);
  }
  // A middling hand the loose patron plays and the tight one folds: king-jack off (Chen 7, 0.35).
  const kj = spot({ stacks: [1000, 1000, 1000, 1000], holes: ['Kh Jd', null, null, null], steps: [[3, 'raise', 40]] });
  assert.deepEqual(decide(kj, 'tight', roll(NO_BLUFF)), { type: 'fold' });
  assert.deepEqual(decide(kj, 'loose', roll(NO_BLUFF)), { type: 'call' });
  // The big blind's option with a weak hand checks, when nobody bluffs.
  const limped = spot({ holes: [null, null, '9c 4d'], steps: [[0, 'call'], [1, 'call']] });
  assert.equal(limped.toAct, 2);
  assert.deepEqual(decide(limped, 'tight', roll(NO_BLUFF)), { type: 'check' });
  // After the flop: a flush draw facing a quarter-pot bet calls (about 35 % against odds of 1 in 6); top of nothing folds a pot-sized one.
  const draw = spot({ stacks: [1000, 1000], holes: ['Ah 5h', null], board: '9h 2h Kc 3s 7d', steps: [[0, 'call'], [1, 'check']] });
  assert.equal(draw.street, 'flop');
  const bet = act(draw, 1, { type: 'raise', to: 10 });
  assert.equal(bet.toAct, 0);
  assert.deepEqual(decide(bet, 'tight', roll(NO_BLUFF)), { type: 'call' }, 'the odds are there');
  const air = spot({ stacks: [1000, 1000], holes: ['8c 4d', null], board: 'As Kh Qh 2s 7d', steps: [[0, 'call'], [1, 'check']] });
  const big = act(air, 1, { type: 'raise', to: 40 });
  assert.deepEqual(decide(big, 'tight', roll(NO_BLUFF)), { type: 'fold' }, 'nothing against a pot-sized bet folds');
});
