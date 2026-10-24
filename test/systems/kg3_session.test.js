// KG3 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 5.7, 10.7 and 16): THE KING'S GAMBIT AGAINST A REGULAR,
// ITS CLOCK AND ITS GOLD. Driven over the law's own states (systems/gambit/gambitTableSession.js over net/kingsGambit.js and
// systems/gambit/gambitPatrons.js): the mod's beats - a turn's end 0.9 s after its last action, the regular's 1.2 s pause before
// each action, the result 1.3 s after the game is decided; a refused command changing nothing; a broken source voiding
// the game, never passing a turn in silence; what the gold does at each end (a win's pot, a loss and a forfeit, a game
// that did not stand, a game for fun); and a regular's night - the book on the save, its days, its bounds, its restore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GambitTableSession, GAMBIT_TURN_END_MS, GAMBIT_REGULAR_PAUSE_MS, GAMBIT_RESULT_MS, GAMBIT_STAKE_MULTS, GAMBIT_WIN_PAYS,
  GAMBIT_NIGHT_MULT, GAMBIT_PURSES_BOOK_MAX, GAMBIT_PURSES_NAMES_MAX, GAMBIT_LOG_MAX, stakeOf,
  gambitNightPaid, gambitNightLeft, gambitPursesAfter, gambitPursesRestore,
} from '../../src/systems/gambit/gambitTableSession.js';
import { GAMBIT_TIERS, regularAction } from '../../src/systems/gambit/gambitPatrons.js';
import { KG_POINT_BUDGET, KG_ACTIONS_PER_TURN, autoFill, gambitRefusal } from '../../src/net/kingsGambit.js';
import { xorshift } from '../../tools/kgMeasure.mjs';

const [AMATEUR, SEASONED, VETERAN, GRANDMASTER] = GAMBIT_TIERS;
const army = (seed) => autoFill([], KG_POINT_BUDGET, xorshift(seed));
const regular = (tier = SEASONED, name = 'Ana') => ({ name, seed: 7, tier });
const deal = (o = {}) => new GambitTableSession({ army: army(o.armySeed ?? 3), regular: regular(o.tier, o.name), stake: o.stake ?? 0, rand32: xorshift(o.seed ?? 11), now: o.now ?? 0 });
/** The player's own choice, the regulars' careful rules (no blunder): a command the law takes, or End turn. */
const choose = (s, rnd) => regularAction(s.state, 0, { blunder: 0 }, rnd) ?? { type: 'end' };

/** A game played out on the session's own clock, the player choosing as a careful regular would: answers the session,
 *  decided and shown, and the clock it ended on. */
function playOut(s, seed, { step = 100, cap = 4_000_000 } = {}) {
  const rnd = xorshift(seed);
  let now = 0;
  while (!s.shown && now < cap) {
    if (s.playing() && s.state.turn === 0 && !s.state.ending) assert.equal(s.act(choose(s, rnd), now), null, 'the careful choice is lawful');
    now += step;
    s.tick(now);
  }
  return { s, now };
}

test('KG3 the stake\'s and the beats\' numbers are the mod\'s, exported where their law lives (14.4: a typed number is a mutant the pins kill)', () => {
  assert.deepEqual([GAMBIT_TURN_END_MS, GAMBIT_REGULAR_PAUSE_MS, GAMBIT_RESULT_MS], [900, 1200, 1300], 'QueueTurnEnd, EnemyPause, the result\'s banner');
  assert.deepEqual([...GAMBIT_STAKE_MULTS], [1, 2, 5], 'the mod\'s three bets');
  assert.ok(Object.isFrozen(GAMBIT_STAKE_MULTS));
  assert.equal(GAMBIT_WIN_PAYS, 2, 'a win pays the stake back and as much again');
  assert.equal(GAMBIT_NIGHT_MULT, 15, 'a regular\'s night: fifteen least stakes (10.7)');
  assert.deepEqual([GAMBIT_PURSES_BOOK_MAX, GAMBIT_PURSES_NAMES_MAX, GAMBIT_LOG_MAX], [24, 6, 12]);
  assert.deepEqual(GAMBIT_TIERS.map((t) => GAMBIT_STAKE_MULTS.map((m) => stakeOf(t, m))), [[10, 20, 50], [50, 100, 250], [200, 400, 1000], [1000, 2000, 5000]]);
  for (const bad of [0, 3, -1, 1.5, NaN, '2', null]) assert.equal(stakeOf(SEASONED, /** @type {any} */ (bad)), 0, `no pick: ${bad}`);
});

test('KG3 the beats: the turn ends 0.9 s after End turn, the regular pauses 1.2 s before each action, and the player\'s turn comes back 0.9 s after the regular\'s last (mutants: each beat; the pause skipped; the turn ended at once)', () => {
  const s = deal();
  assert.equal(s.turnOf(), 0, 'the host - the player - moves first');
  assert.equal(s.drain()[0].t, 'game', 'the deal said, the layout with it');
  assert.equal(s.act({ type: 'end' }, 1000), null);
  assert.ok(s.state.ending, 'the turn is ending');
  s.tick(1000 + GAMBIT_TURN_END_MS - 1);
  assert.equal(s.state.turn, 0, 'not before its beat');
  s.tick(1000 + GAMBIT_TURN_END_MS);
  assert.equal(s.state.turn, 1, 'the regular\'s turn');
  const t1 = 1000 + GAMBIT_TURN_END_MS;
  s.drain();
  s.tick(t1 + GAMBIT_REGULAR_PAUSE_MS - 1);
  assert.equal(s.state.actions, KG_ACTIONS_PER_TURN, 'the regular thinks first');
  s.tick(t1 + GAMBIT_REGULAR_PAUSE_MS);
  assert.ok(s.state.actions < KG_ACTIONS_PER_TURN || s.state.ending, 'an action at the pause\'s end');
  // the regular's turn plays out at its beats: each action a pause after the last, the turn's end GAMBIT_TURN_END_MS after
  // the turn began ending (the beats are whole tenths, so the clock in tenths lands on each exactly)
  let now = t1 + GAMBIT_REGULAR_PAUSE_MS, endingAt = s.state.ending ? now : null, actedAt = now;
  while (s.state.turn === 1 && now < t1 + 20_000) {
    const before = s.state.actions;
    now += 100;
    s.tick(now);
    if (s.state.turn === 1 && s.state.actions < before) { assert.equal(now - actedAt, GAMBIT_REGULAR_PAUSE_MS, 'a pause before each action'); actedAt = now; }
    if (s.state.turn === 1 && s.state.ending && endingAt === null) endingAt = now;
  }
  assert.equal(s.state.turn, 0, 'the turn comes back to the player');
  assert.equal(now - endingAt, GAMBIT_TURN_END_MS, 'GAMBIT_TURN_END_MS after the regular\'s turn began ending');
  assert.ok(s.drain().some((e) => e.t === 'turn' && e.side === 0), 'and the turn is said');
});

test('KG3 a refused command changes nothing and says its word; a command while the turn ends, or after the game, is the law\'s refusal too (mutants: a refusal applied; the state replaced)', () => {
  const s = deal();
  const before = structuredClone(s.state);
  const own = s.state.pieces.find((p) => p.side === 0);
  for (const [cmd, word] of [[{ type: 'move', piece: own.id, col: -1, row: 0 }, 'cell'], [{ type: 'attack', piece: own.id, target: own.id }, 'target'], [{ type: 'fly' }, 'shape'], [{ type: 'potion', piece: own.id }, 'full']]) {
    assert.equal(s.act(cmd, 5), word);
    assert.equal(word, gambitRefusal(before, 0, cmd), 'the law\'s own word');
    assert.deepEqual(s.state, before, 'nothing changed');
  }
  s.act({ type: 'end' }, 10);
  assert.equal(s.act({ type: 'end' }, 11), 'ending');
  s.forfeit(12);
  assert.equal(s.act({ type: 'end' }, 13), 'over');
});

test('KG3 the result after its beat: decided at once, shown GAMBIT_RESULT_MS later - a forfeit\'s too, the regular the winner (mutants: the beat; the result shown at once; the forfeit\'s winner)', () => {
  const s = deal({ stake: 50 });
  s.drain();
  s.forfeit(5000);
  assert.deepEqual(s.over, { winner: 1, by: 'forfeit' });
  assert.equal(s.playing(), false);
  assert.deepEqual(s.drain().map((e) => e.t), ['forfeit', 'decided']);
  s.tick(5000 + GAMBIT_RESULT_MS - 1);
  assert.equal(s.shown, false);
  s.tick(5000 + GAMBIT_RESULT_MS);
  assert.equal(s.shown, true);
  assert.deepEqual(s.drain(), [{ t: 'result', winner: 1, by: 'forfeit', at: 5000 + GAMBIT_RESULT_MS }]);
  s.forfeit(9000);
  assert.deepEqual(s.drain(), [], 'decided once');
});

test('KG3 THE GOLD at each end: a win pays twice the stake (the regular paid out the stake), a loss and a forfeit nothing (the regular won it back), a game that did not stand hands the stake back, a game for fun moves none (mutants: the pay; the net\'s sign; the void kept)', () => {
  let won = null, lost = null;
  for (let seed = 1; seed < 60 && !(won && lost); seed++) {
    const { s } = playOut(deal({ stake: 100, tier: AMATEUR, seed, armySeed: seed + 100 }), seed + 200);
    if (s.over.winner === 0 && !won) won = s;
    if (s.over.winner === 1 && !lost) lost = s;
  }
  assert.ok(won && lost, 'played out, both ends found');
  assert.equal(won.over.by, 'king');
  assert.deepEqual(won.settlement(), { pay: 100 * GAMBIT_WIN_PAYS, net: 100 });
  assert.deepEqual(lost.settlement(), { pay: 0, net: -100 });
  const f = deal({ stake: 250 });
  assert.equal(f.settlement(), null, 'nothing while undecided');
  f.forfeit(1);
  assert.deepEqual(f.settlement(), { pay: 0, net: -250 });
  const fun = deal({ stake: 0 });
  fun.forfeit(1);
  assert.deepEqual(fun.settlement(), { pay: 0, net: 0 });
  // a source that breaks mid-game: the game does not stand, the stake comes home, no turn passed in silence
  let n = 0;
  const live = xorshift(11);
  const breaks = () => (++n > 400 ? 1.5 : live());
  const v = new GambitTableSession({ army: army(3), regular: regular(VETERAN), stake: 400, rand32: breaks, now: 0 });
  assert.ok(v.playing(), 'dealt while the source held');
  const rnd = xorshift(5);
  for (let now = 0; v.playing() && now < 2_000_000; now += 100) {
    if (v.state.turn === 0 && !v.state.ending) v.act(choose(v, rnd), now);
    v.tick(now);
  }
  assert.deepEqual(v.over, { winner: null, by: 'void' });
  assert.deepEqual(v.settlement(), { pay: 400, net: 0 }, 'the stake back, the night untouched');
  // no deal at all: a source that is not one
  const none = new GambitTableSession({ army: army(3), regular: regular(), stake: 50, rand32: () => -1, now: 0 });
  assert.deepEqual([none.over, none.shown, none.playing(), none.turnOf()], [{ winner: null, by: 'void' }, true, false, null]);
  assert.deepEqual(none.settlement(), { pay: 50, net: 0 });
  // an army the law refuses deals nothing either
  assert.equal(new GambitTableSession({ army: [], regular: regular(), rand32: xorshift(1), now: 0 }).over.by, 'void');
});

test('KG3 a regular plays the whole game through the session to its end - a decided game shows its result, its log within the law\'s events (mutant: the regular never acts)', () => {
  for (const tier of GAMBIT_TIERS) {
    const s = deal({ tier, seed: 21 });
    const { now } = playOut(s, 9);
    assert.ok(s.shown && s.over && s.over.by === 'king', `${tier.key}: decided by a king's fall`);
    assert.ok(now < 4_000_000, `${tier.key}: within the cap`);
  }
});

test('KG3 A REGULAR\'S NIGHT, the book on the save: paid out net by table, day and name; what is left of the night never below 0; a new day starts afresh; the oldest days dropped past the bound, a tie keeping the table just booked; names capped; the restore keeps only what the book could have written (mutants: the day kept; the bound; the tie\'s side; the names\' cap; the restore\'s checks)', () => {
  const day = 400;
  let book = gambitPursesAfter(undefined, 't1', day, 'Ana', 50);
  book = gambitPursesAfter(book, 't1', day, 'Ana', 100);
  book = gambitPursesAfter(book, 't1', day, 'Bors', -50);
  assert.deepEqual(book, { t1: { day, net: { Ana: 150, Bors: -50 } } });
  assert.equal(gambitNightPaid(book, 't1', day, 'Ana'), 150);
  assert.equal(gambitNightPaid(book, 't1', day + 1, 'Ana'), 0, 'tomorrow\'s night is a new one');
  assert.equal(gambitNightPaid(book, 't2', day, 'Ana'), 0);
  assert.equal(gambitNightLeft(book, 't1', day, 'Ana', SEASONED), SEASONED.stake * GAMBIT_NIGHT_MULT - 150);
  assert.equal(gambitNightLeft(book, 't1', day, 'Bors', SEASONED), SEASONED.stake * GAMBIT_NIGHT_MULT + 50, 'won back: more to pay');
  assert.equal(gambitNightLeft(gambitPursesAfter(book, 't1', day, 'Ana', 10_000), 't1', day, 'Ana', SEASONED), 0, 'never below 0');
  assert.deepEqual(gambitPursesAfter(book, 't1', day + 1, 'Ana', 50), { t1: { day: day + 1, net: { Ana: 50 } } }, 'a new day at the table starts afresh');
  // the bound: the oldest days out, the table just booked kept on a tie
  let big = {};
  for (let i = 0; i < GAMBIT_PURSES_BOOK_MAX; i++) big = gambitPursesAfter(big, `k${i}`, day - i, 'Ana', 10);
  assert.equal(Object.keys(big).length, GAMBIT_PURSES_BOOK_MAX);
  const more = gambitPursesAfter(big, 'new', day - GAMBIT_PURSES_BOOK_MAX + 1, 'Ana', 10);
  assert.equal(Object.keys(more).length, GAMBIT_PURSES_BOOK_MAX);
  assert.ok(Object.hasOwn(more, 'new'), 'a tie in the day keeps the table just booked');
  assert.ok(!Object.hasOwn(more, `k${GAMBIT_PURSES_BOOK_MAX - 1}`), 'the oldest of the tie goes');
  let names = {};
  for (let i = 0; i < GAMBIT_PURSES_NAMES_MAX + 3; i++) names = gambitPursesAfter(names, 't', day, `R${i}`, 1);
  assert.equal(Object.keys(names.t.net).length, GAMBIT_PURSES_NAMES_MAX, 'a table\'s free chairs at the most');
  assert.ok(Object.hasOwn(names.t.net, `R${GAMBIT_PURSES_NAMES_MAX + 2}`), 'the newest kept');
  // the save's road: only well-formed entries, bounded, sums safe integers
  for (const junk of [null, undefined, 7, 'x', [], [1, 2]]) assert.deepEqual(gambitPursesRestore(junk), {});
  const raw = { a: { day: 3, net: { Ana: 5, Bad: 1.5, Nan: NaN, Big: 2 ** 60 } }, b: { day: 'x', net: {} }, c: { day: 2, net: [1] }, d: null, e: { day: 1, net: { Z: -3 } } };
  assert.deepEqual(gambitPursesRestore(raw), { a: { day: 3, net: { Ana: 5 } }, e: { day: 1, net: { Z: -3 } } });
  const many = Object.fromEntries(Array.from({ length: GAMBIT_PURSES_BOOK_MAX + 5 }, (_, i) => [`k${i}`, { day: i, net: { A: 1 } }]));
  assert.equal(Object.keys(gambitPursesRestore(many)).length, GAMBIT_PURSES_BOOK_MAX);
  assert.deepEqual(gambitPursesRestore(gambitPursesRestore(book)), book, 'the book round-trips');
  assert.equal(gambitNightPaid({ t: { day, net: { Ana: 'x' } } }, 't', day, 'Ana'), 0, 'a sum that is no integer counts nothing');
  assert.equal(GRANDMASTER.stake * GAMBIT_NIGHT_MULT, 15000, '10.7: a Grandmaster\'s night, fifteen thousand');
});
