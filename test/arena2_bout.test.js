// ARENA2 (2026-10-02, Mac: "Players can choose to watch AI fights ... and climb esclating tiers of opponents"): THE BOUT
// LAW, DRIVEN (systems/arenaBout.js) - every phase in order and on its clock, every way a bout ends (a yield by choice
// and by temper, a fall at the floor, a ring-out past the slack, the time limit and the judges' three counts), every
// event the crowd and the Herald hear, the refusals (a blow outside the fight, a yield above the line, a teammate's
// blow), a two-against-one and a Grand Melee, the purse by favour. Pure: the clock and the dice are the test's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newBout, boutTick, boutHit, boutMiss, boutFell, boutYield, boutPos, boutHealth, boutAtMarks, takeBoutEvents, boutLive,
  boutBefore, boutOver, boutTimeLeft, callMs, aiYields, judgeBout, boutTallies, boutPurse, sideNames, otherNames,
  standingSides, fighterShare, BOUT_PHASES, CALL_BEAT_MS, WALK_MAX_MS, COUNT_MS, BOUT_LIMIT_MS, END_HOLD_MS, VERDICT_MS,
  HEAL_HOLD_MS, YIELD_SHARE, STALL_MS, RING_SLACK_M, RING_OUT_MS, FLEE_MS, KNOCKDOWN_SHARE, COMEBACK_LOW,
  TEMPER_EVERY_MS, TEMPER_ROLL, PURSE_FAVOUR_MAX, PURSE_FAVOUR_MIN,
} from '../src/systems/arenaBout.js';
import { DUEL_OUT_SLACK_M, DUEL_OUT_MS, DUEL_HEAL_HOLD_MS, DUEL_COUNTDOWN_MS } from '../src/net/duelSession.js';

const RING = { centre: [0, 0], radius: 14 };
const two = (o = {}) => [
  { id: 'a', name: 'Aldo', side: 0, maxHealth: 100, temper: 0, ai: true, ...(o.a ?? {}) },
  { id: 'b', name: 'Bran', side: 1, maxHealth: 80, temper: 0, ai: true, ...(o.b ?? {}) },
];
const kinds = (ev) => ev.map((e) => e.k);
/** A bout run to its fight at t0 (the call's beats, the walk's marks, the count), events drained. */
function fighting(fighters = two(), t0 = 0, o = {}) {
  const b = newBout({ id: 'x', fighters, ring: RING, now: t0, ...o });
  boutTick(b, t0 + callMs(b));
  for (const f of b.fighters) boutAtMarks(b, f.id, t0 + callMs(b));
  boutTick(b, t0 + callMs(b) + COUNT_MS);
  takeBoutEvents(b);
  return { b, t: t0 + callMs(b) + COUNT_MS };
}

test('ARENA2 bout: the constants are the design\'s and the duel\'s own', () => {
  assert.deepEqual(BOUT_PHASES, ['call', 'walk', 'count', 'fight', 'end', 'verdict', 'heal', 'done']);
  assert.equal(YIELD_SHARE, 0.15, 'a fighter may yield at 15% of their health');
  assert.equal(STALL_MS, 8000, 'no blow for eight seconds is a stall');
  assert.equal(BOUT_LIMIT_MS, 180000, 'three minutes, then the judges');
  assert.equal(RING_SLACK_M, DUEL_OUT_SLACK_M, 'the ring-out slack is the duel\'s');
  assert.equal(RING_OUT_MS, DUEL_OUT_MS);
  assert.equal(HEAL_HOLD_MS, DUEL_HEAL_HOLD_MS, 'the healers\' hold is the duel\'s');
  assert.equal(COUNT_MS, DUEL_COUNTDOWN_MS, '3 - 2 - 1 is the duel\'s three seconds');
  assert.ok(KNOCKDOWN_SHARE === 0.25 && COMEBACK_LOW === 0.35 && FLEE_MS === 1500 && TEMPER_EVERY_MS === 1000 && TEMPER_ROLL === 0.45);
  assert.ok(CALL_BEAT_MS > 0 && WALK_MAX_MS > 0 && END_HOLD_MS > 0 && VERDICT_MS > 0);
});

test('ARENA2 bout: a bout needs two fighters on two sides', () => {
  assert.throws(() => newBout({ id: 'x', fighters: [two()[0]], ring: RING, now: 0 }), /two fighters/);
  assert.throws(() => newBout({ id: 'x', fighters: two({ b: { side: 0 } }), ring: RING, now: 0 }), /two sides/);
  const b = newBout({ id: 7, fighters: two({ a: { health: 0, temper: 9 } }), ring: RING, now: 5 });
  assert.equal(b.id, '7');
  assert.equal(b.fighters[0].health, 1, 'a fighter stands with at least 1');
  assert.equal(b.fighters[0].temper, 1, 'a temper is held to 0..1');
  assert.equal(b.fighters[1].health, 80, 'health defaults to the whole');
  assert.deepEqual(kinds(takeBoutEvents(b)), ['call']);
  assert.deepEqual(takeBoutEvents(b), [], 'a take drains');
});

test('ARENA2 bout: the call cries each fighter a beat apart, then the walk; the marks start the count; 3 - 2 - 1 on the second; Fight!', () => {
  const b = newBout({ id: 'x', fighters: two(), ring: RING, now: 0 });
  takeBoutEvents(b);
  assert.ok(boutBefore(b) && !boutLive(b) && !boutOver(b));
  assert.equal(boutTimeLeft(b, 0), BOUT_LIMIT_MS, 'before the fight the whole limit stands');
  boutTick(b, CALL_BEAT_MS - 1);
  assert.deepEqual(takeBoutEvents(b), []);
  boutTick(b, CALL_BEAT_MS);
  assert.deepEqual(takeBoutEvents(b).map((e) => [e.k, e.a]), [['crier', 'a']]);
  boutTick(b, 2 * CALL_BEAT_MS);
  assert.deepEqual(takeBoutEvents(b).map((e) => [e.k, e.a]), [['crier', 'b']]);
  assert.equal(b.phase, 'call');
  boutTick(b, callMs(b));
  assert.equal(b.phase, 'walk');
  assert.deepEqual(kinds(takeBoutEvents(b)), ['walk']);
  assert.equal(boutAtMarks(b, 'zz', callMs(b)), false, 'a stranger has no mark');
  boutAtMarks(b, 'a', callMs(b) + 10);
  assert.equal(b.phase, 'walk', 'one on their mark is not both');
  boutAtMarks(b, 'b', callMs(b) + 20);
  assert.equal(b.phase, 'count');
  const t0 = callMs(b) + 20;
  assert.deepEqual(takeBoutEvents(b).map((e) => [e.k, e.n]), [['count', 3]]);
  boutTick(b, t0 + 999);
  assert.deepEqual(takeBoutEvents(b), []);
  boutTick(b, t0 + 1000);
  assert.deepEqual(takeBoutEvents(b).map((e) => [e.k, e.n]), [['count', 2]]);
  boutTick(b, t0 + 2000);
  assert.deepEqual(takeBoutEvents(b).map((e) => [e.k, e.n]), [['count', 1]]);
  assert.equal(boutHit(b, { from: 'a', to: 'b', dmg: 5, now: t0 + 2500 }), false, 'no blow counts before the word');
  boutTick(b, t0 + COUNT_MS);
  assert.equal(b.phase, 'fight');
  assert.deepEqual(kinds(takeBoutEvents(b)), ['fight']);
  assert.equal(boutTimeLeft(b, t0 + COUNT_MS + 1000), BOUT_LIMIT_MS - 1000);
  assert.equal(boutAtMarks(b, 'a', t0 + COUNT_MS), false, 'the marks are the walk\'s alone');
});

test('ARENA2 bout: a walk that takes too long starts the count wherever they stand', () => {
  const b = newBout({ id: 'x', fighters: two(), ring: RING, now: 0 });
  boutTick(b, callMs(b));
  boutTick(b, callMs(b) + WALK_MAX_MS - 1);
  assert.equal(b.phase, 'walk');
  boutTick(b, callMs(b) + WALK_MAX_MS);
  assert.equal(b.phase, 'count');
});

test('ARENA2 bout: a blow - hit, crit, knockdown at a quarter or at the line, comeback once; the refusals', () => {
  const { b, t } = fighting();
  assert.equal(boutHit(b, { from: 'a', to: 'a', dmg: 5, now: t }), false, 'not oneself');
  assert.equal(boutHit(b, { from: 'zz', to: 'b', dmg: 5, now: t }), false, 'not a stranger');
  assert.equal(boutHit(b, { from: 'a', to: 'b', dmg: 0, now: t }), false, 'no damage, no blow');
  assert.equal(boutHit(b, { from: 'a', to: 'b', dmg: 10, health: 70, now: t + 10 }), true);
  assert.deepEqual(kinds(takeBoutEvents(b)), ['hit']);
  assert.equal(b.fighters[1].health, 70);
  assert.equal(b.fighters[0].dealt, 10);
  assert.equal(b.fighters[0].hits, 1);
  boutHit(b, { from: 'a', to: 'b', dmg: 20, crit: true, health: 50, now: t + 20 });
  assert.deepEqual(kinds(takeBoutEvents(b)), ['hit', 'crit', 'knockdown'], 'a quarter of 80 is 20: a knockdown');
  assert.equal(b.fighters[0].crits, 1);
  boutHit(b, { from: 'a', to: 'b', dmg: 3, now: t + 30 });
  assert.equal(b.fighters[1].health, 47, 'no health given: the damage taken off');
  boutHit(b, { from: 'a', to: 'b', dmg: 36, health: 11, now: t + 40 });
  const e = takeBoutEvents(b);
  assert.ok(kinds(e).includes('knockdown'), 'driven under the yield line is a knockdown');
  // B was down at 11/80 (13.75%) - A at 100/100; B strikes A down to 10/100 and draws level: a comeback, once
  boutHit(b, { from: 'b', to: 'a', dmg: 90, health: 10, now: t + 50 });
  assert.ok(kinds(takeBoutEvents(b)).includes('comeback'));
  boutHit(b, { from: 'b', to: 'a', dmg: 1, health: 9, now: t + 60 });
  assert.ok(!kinds(takeBoutEvents(b)).includes('comeback'), 'said once');
  // a teammate's blow counts nothing
  const g = fighting([{ id: 'a', side: 0, maxHealth: 50 }, { id: 'c', side: 0, maxHealth: 50 }, { id: 'b', side: 1, maxHealth: 50 }]);
  assert.equal(boutHit(g.b, { from: 'a', to: 'c', dmg: 5, now: g.t }), false);
});

test('ARENA2 bout: a miss counts for the judges; never outside the fight or for a stranger', () => {
  const { b, t } = fighting();
  assert.equal(boutMiss(b, { from: 'a', now: t }), true);
  assert.equal(b.fighters[0].misses, 1);
  assert.deepEqual(kinds(takeBoutEvents(b)), ['miss']);
  assert.equal(boutMiss(b, { from: 'zz', now: t }), false);
  const c = newBout({ id: 'y', fighters: two(), ring: RING, now: 0 });
  assert.equal(boutMiss(c, { from: 'a', now: 1 }), false);
});

test('ARENA2 bout: a STALL - no blow for eight seconds, said once, the clock reset by the next blow', () => {
  const { b, t } = fighting();
  boutTick(b, t + STALL_MS - 1);
  assert.deepEqual(takeBoutEvents(b), []);
  boutTick(b, t + STALL_MS);
  assert.deepEqual(kinds(takeBoutEvents(b)), ['stall']);
  boutTick(b, t + STALL_MS + 5000);
  assert.deepEqual(takeBoutEvents(b), [], 'once a stall');
  boutHit(b, { from: 'a', to: 'b', dmg: 1, now: t + 14000 });
  takeBoutEvents(b);
  boutTick(b, t + 14000 + STALL_MS);
  assert.deepEqual(kinds(takeBoutEvents(b)), ['stall'], 'a new stall after a blow');
});

test('ARENA2 bout: the FALL - the floor reached ends it, the other side wins; the end holds, the verdict, the healers, done', () => {
  const { b, t } = fighting();
  assert.equal(boutFell(b, 'zz', t), false);
  assert.equal(boutFell(b, 'b', t + 100), true);
  assert.equal(b.fighters[1].health, 1, 'held at the floor');
  assert.deepEqual(kinds(takeBoutEvents(b)), ['fall', 'end']);
  assert.deepEqual(b.result, { side: 0, how: 'fall', winners: ['a'], losers: ['b'], judges: null });
  assert.ok(boutOver(b) && !boutLive(b));
  assert.equal(boutFell(b, 'a', t + 200), false, 'nothing falls after the end');
  assert.equal(boutTimeLeft(b, t + 200), b.fightAt + BOUT_LIMIT_MS - (t + 100), 'the clock stands where the fight ended');
  assert.equal(boutTimeLeft(b, t + 99999), b.fightAt + BOUT_LIMIT_MS - (t + 100), 'and stays there');
  boutTick(b, t + 100 + END_HOLD_MS - 1);
  assert.equal(b.phase, 'end');
  boutTick(b, t + 100 + END_HOLD_MS);
  assert.equal(b.phase, 'verdict');
  assert.deepEqual(takeBoutEvents(b).map((e) => [e.k, e.side, e.how]), [['verdict', 0, 'fall']]);
  boutTick(b, t + 100 + END_HOLD_MS + VERDICT_MS);
  assert.equal(b.phase, 'heal');
  boutTick(b, t + 100 + END_HOLD_MS + VERDICT_MS + HEAL_HOLD_MS);
  assert.equal(b.phase, 'done');
  assert.deepEqual(kinds(takeBoutEvents(b)), ['heal', 'done']);
});

test('ARENA2 bout: a YIELD by choice - refused above 15%, taken at or under it; never outside the fight', () => {
  const { b, t } = fighting();
  assert.equal(boutYield(b, 'b', t), 'early');
  boutHealth(b, 'b', 12);   // 15% of 80
  assert.equal(fighterShare(b.fighters[1]), 0.15);
  assert.equal(boutYield(b, 'zz', t), 'not-live');
  assert.equal(boutYield(b, 'b', t + 5), null);
  assert.deepEqual(kinds(takeBoutEvents(b)), ['yield', 'end']);
  assert.equal(b.result.how, 'yield');
  assert.equal(b.result.side, 0);
  assert.equal(boutYield(b, 'a', t + 6), 'not-live', 'nobody yields after the end');
  const c = newBout({ id: 'y', fighters: two(), ring: RING, now: 0 });
  assert.equal(boutYield(c, 'a', 1), 'not-live');
});

test('ARENA2 bout: an AI\'s TEMPER at the line - asked once a second, never above it, never with no temper', () => {
  assert.equal(aiYields(1, 0.5, () => 0), false, 'above the line, never');
  assert.equal(aiYields(0, 0.1, () => 0), false, 'no temper, never (a beast)');
  assert.equal(aiYields(1, 0.15, () => 0.449), true);
  assert.equal(aiYields(1, 0.15, () => 0.45), false, 'temper 1 is TEMPER_ROLL a roll');
  assert.equal(aiYields(0.5, 0.1, () => 0.2), true);
  assert.equal(aiYields(0.5, 0.1, () => 0.23), false);
  const { b, t } = fighting(two({ b: { temper: 1 } }));
  boutHealth(b, 'b', 10);
  let rolls = 0;
  const rng = () => { rolls++; return 0.99; };
  boutTick(b, t + 500, rng);
  assert.equal(rolls, 0, 'not before a second has passed');
  boutTick(b, t + 1000, rng);
  assert.equal(rolls, 1);
  boutTick(b, t + 1500, rng);
  assert.equal(rolls, 1, 'once a second');
  boutTick(b, t + 2000, () => 0);
  assert.equal(b.result?.how, 'yield', 'the roll that lands yields');
  // a player is never asked: their yield is their own
  const p = fighting(two({ b: { ai: false, temper: 1 } }));
  boutHealth(p.b, 'b', 1);
  boutTick(p.b, p.t + 5000, () => 0);
  assert.equal(p.b.result, null);
});

test('ARENA2 bout: FLEE - outside the line for a second and a half, said once a time out; RING-OUT past the slack for two seconds', () => {
  const { b, t } = fighting();
  assert.equal(boutPos(b, 'zz', [0, 0]), false);
  assert.equal(boutPos(b, 'a', [NaN, 0]), false);
  boutPos(b, 'a', [RING.radius + 1, 0]);
  boutTick(b, t + 10);
  boutTick(b, t + 10 + FLEE_MS - 1);
  assert.deepEqual(takeBoutEvents(b), []);
  boutTick(b, t + 10 + FLEE_MS);
  assert.deepEqual(takeBoutEvents(b).map((e) => [e.k, e.a]), [['flee', 'a']]);
  boutTick(b, t + 10 + FLEE_MS + 3000);
  assert.ok(!kinds(takeBoutEvents(b)).includes('flee'), 'once');
  boutPos(b, 'a', [0, 0]);
  boutTick(b, t + 6000);
  assert.equal(b.fighters[0].fleeing, false, 'back inside: the next time out is a new flight');
  // past the slack
  boutPos(b, 'b', [0, -(RING.radius + RING_SLACK_M + 0.5)]);
  boutTick(b, t + 7000);
  boutTick(b, t + 7000 + RING_OUT_MS - 1);
  assert.equal(b.result, null);
  boutTick(b, t + 7000 + RING_OUT_MS);
  assert.deepEqual(b.result.how, 'ringout');
  assert.equal(b.result.side, 0);
});

test('ARENA2 bout: TIME - three minutes, then the judges: damage dealt, then hits, then fewer misses; level on all three a draw', () => {
  assert.equal(judgeBout([]), null);
  assert.equal(judgeBout([{ side: 0, dealt: 10, hits: 1, misses: 9 }, { side: 1, dealt: 9, hits: 9, misses: 0 }]), 0, 'damage first');
  assert.equal(judgeBout([{ side: 0, dealt: 10, hits: 1, misses: 0 }, { side: 1, dealt: 10, hits: 2, misses: 9 }]), 1, 'then hits');
  assert.equal(judgeBout([{ side: 0, dealt: 10, hits: 2, misses: 3 }, { side: 1, dealt: 10, hits: 2, misses: 1 }]), 1, 'then the fewer misses');
  assert.equal(judgeBout([{ side: 0, dealt: 10, hits: 2, misses: 1 }, { side: 1, dealt: 10, hits: 2, misses: 1 }]), null, 'level: a draw');
  assert.equal(judgeBout([{ side: 3, dealt: 1, hits: 1, misses: 1 }]), 3, 'one side is its own winner');
  const { b, t } = fighting();
  boutHit(b, { from: 'a', to: 'b', dmg: 10, now: t + 1 });
  boutHit(b, { from: 'b', to: 'a', dmg: 9, now: t + 2 });
  takeBoutEvents(b);
  boutTick(b, t + BOUT_LIMIT_MS - 1);
  assert.equal(b.result, null);
  assert.deepEqual(kinds(takeBoutEvents(b)), ['stall'], 'three minutes of nothing more is a stall first');
  boutTick(b, t + BOUT_LIMIT_MS);
  assert.deepEqual(kinds(takeBoutEvents(b)), ['timeout', 'end']);
  assert.equal(b.result.how, 'judges');
  assert.equal(b.result.side, 0);
  assert.equal(b.result.judges.length, 2);
  const d = fighting();
  boutTick(d.b, d.t + BOUT_LIMIT_MS);
  assert.equal(d.b.result.side, null, 'nothing struck: a draw');
  assert.deepEqual(d.b.result.winners, []);
  assert.equal(newBout({ id: 'l', fighters: two(), ring: RING, now: 0, limitMs: 1000 }).limitMs, 1000, 'a limit of its own');
});

test('ARENA2 bout: TWO AGAINST ONE - a side is out when all of it is; the judges count a side\'s whole; names joined', () => {
  const { b, t } = fighting([
    { id: 'you', name: 'Hero', side: 0, maxHealth: 100, ai: false },
    { id: 'k', name: 'Knight', side: 1, maxHealth: 60 }, { id: 'h', name: 'Healer', side: 1, maxHealth: 40 },
  ]);
  boutFell(b, 'k', t + 1);
  assert.equal(b.result, null, 'the healer still stands');
  assert.deepEqual(standingSides(b).sort(), [0, 1]);
  assert.equal(sideNames(b, 1), 'Knight and Healer');
  assert.equal(otherNames(b, 1), 'Hero');
  boutHealth(b, 'h', 5);
  boutYield(b, 'h', t + 2);
  assert.equal(b.result.side, 0);
  assert.deepEqual(b.result.losers, ['k', 'h']);
  const tal = boutTallies(b);
  assert.equal(tal.length, 2);
  assert.equal(tal.find((x) => x.side === 1).standing, false);
});

test('ARENA2 bout: A GRAND MELEE - every fighter a side of their own, the last standing wins', () => {
  const { b, t } = fighting([
    { id: 'you', name: 'Hero', side: 0, maxHealth: 100, ai: false },
    { id: 'f0', name: 'A', side: 1, maxHealth: 50 }, { id: 'f1', name: 'B', side: 2, maxHealth: 50 }, { id: 'f2', name: 'C', side: 3, maxHealth: 50 },
  ]);
  assert.equal(boutHit(b, { from: 'f0', to: 'f1', dmg: 5, now: t }), true, 'they fight each other too');
  boutFell(b, 'f0', t + 1);
  boutFell(b, 'f1', t + 2);
  assert.equal(b.result, null);
  boutFell(b, 'you', t + 3);
  assert.equal(b.result.side, 3);
  assert.equal(b.result.how, 'fall');
  assert.equal(sideNames(b, 3), 'C');
  assert.equal(otherNames(b, 3), 'Hero, A and B');
});

test('ARENA2 bout: the PURSE by favour - a darling\'s raised by half at most, a villain\'s cut by a quarter at most, whole gold', () => {
  assert.equal(PURSE_FAVOUR_MAX, 0.5);
  assert.equal(PURSE_FAVOUR_MIN, -0.25);
  assert.equal(boutPurse(100, 0), 100);
  assert.equal(boutPurse(100, 1), 150);
  assert.equal(boutPurse(100, 5), 150, 'favour held to 1');
  assert.equal(boutPurse(100, -1), 75);
  assert.equal(boutPurse(100, 0.33), 117);
  assert.equal(boutPurse(-5, 1), 0);
  assert.equal(boutPurse('x', 'y'), 0);
  assert.equal(boutHealth(fighting().b, 'zz', 3), false);
});

test('ARENA2 bout: the clock after a bout that never fought reads 0, never NaN', () => {
  const b = newBout({ id: 'nf', fighters: [{ id: 'a', side: 0, maxHealth: 10 }, { id: 'b', side: 1, maxHealth: 10 }], ring: { centre: [0, 0], radius: 14 }, now: 0 });
  b.phase = 'done';
  assert.equal(boutTimeLeft(b, 5000), 0);
});
