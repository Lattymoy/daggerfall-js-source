// DLV1 (bible/03-World/Delve-II.md sections 3, 5 and 7): THE ENCOUNTER'S LAW - the kinds and their numbers, the pace,
// the pieces' spots, the plan's hash and the ledger's machine: the Hold's gathering, waves, breaths and captain, the
// Litany's show and plates, the party's leaving and silence, and who earned the win. Every number is the law's own; each
// pin is held to fail under a one-character change of the rule it names (tools/mutants/dlv1.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DELVE_KINDS, DELVE_KIND_NAMES, DELVE_FAMILIES, delveKind, DELVE_PARTY_MAX, delveParty, DELVE_PACE_MPS, delveErrandMs,
  DELVE_PRESENT_MS, DELVE_LEAVE_MS, DELVE_LET_GO_MS, DELVE_EARN_MS, DELVE_ORPHAN_MS,
  HOLD_WAVES, HOLD_GATHER_MS, HOLD_BREATH_MS, HOLD_WAVE_MAX_MS, HOLD_WAVE_MAX, holdWaveSize, HOLD_CAPTAIN_MIN_MS, HOLD_CAPTAIN_MAX_MS, holdCaptainTraits,
  litanyCount, LITANY_RING_M, LITANY_STAND_M, LITANY_SHOW_STEP_MS, litanyShowMs, LITANY_WAKE, litanyPlates, litanyOrder, holdGates,
  DELVE_WARD_PAD_M, inWard, plateAt, delvePlanHash, DP, newDelveLedger, delveWon, delveInWard, delveFoeOwner, stepDelve,
  foldDelveWord, delvePhaseLeft, delveState,
} from '../../../src/net/delve/delveLaw.js';
import { runSpeed } from '../../../src/player/motor.js';
import { STAR_KILL_MIN_MS, starClearFloorMs } from '../../../src/net/starfall/starfallLaw.js';

const T0 = 1_000_000;
const site = (o = {}) => ({ i: 0, kind: 'hold', x: 10, y: -2, z: 20, r: 4, tier: 'regular', vault: [13.4, -2, 20], ...o });
const word = (o = {}) => ({ lv: 10, o: 0, kw: 0, kn: 0, wc: 0, cf: 0, ...o });
/** A member's word: in the ward unless said, of the party unless said, on the plate it says unless said. */
const say = (led, acct, w, nowMs, ctx = {}) => foldDelveWord(led, acct, `n-${acct}`, w, { party: true, inWard: true, plate: w.st ?? -1, nowMs, ...ctx });

test('DLV1 THE KINDS: the Hold a wave on the wire as 1, the Litany a puzzle as 2; a name not its own is none (mutants: an id moved; a family swapped)', () => {
  assert.deepEqual(DELVE_KINDS, {
    hold: { id: 1, family: 'wave' }, litany: { id: 2, family: 'puzzle' }, wellsprings: { id: 3, family: 'wave' }, vigil: { id: 4, family: 'wave' },
    brazier: { id: 5, family: 'puzzle' }, weighing: { id: 6, family: 'puzzle' }, seals: { id: 7, family: 'puzzle' },
  }, 'DLV4: the five more kinds, numbered on');
  assert.deepEqual(DELVE_KIND_NAMES, ['hold', 'litany', 'wellsprings', 'vigil', 'brazier', 'weighing', 'seals']);
  assert.deepEqual(DELVE_FAMILIES, ['wave', 'puzzle']);
  assert.equal(delveKind('litany'), DELVE_KINDS.litany);
  assert.equal(delveKind('toString'), null, 'an object\'s own word is no kind');
  assert.equal(delveKind(1), null);
  assert.ok(Object.isFrozen(DELVE_KINDS) && Object.isFrozen(DELVE_KINDS.hold));
});

test('DLV1 THE PARTY AND THE PACE: one to eight; the delve pace is a weak character\'s run, player/motor.js runSpeed(30, 5) exactly; the errand floor its route at that pace and 1.5 s, ceiled to 10 ms (mutants: nine members; a pace off a stronger runner; the 1.5 s dropped)', () => {
  assert.equal(DELVE_PARTY_MAX, 8);
  assert.deepEqual([0, 1, 3.7, 8, 12, NaN, -4].map(delveParty), [1, 1, 3, 8, 8, 1, 1]);
  assert.equal(DELVE_PACE_MPS, runSpeed(30, 5));
  assert.deepEqual([0, -5, 1, 62.658].map(delveErrandMs), [1500, 1500, 1660, 11500]);
});

test('DLV1 THE CLOCKS: present 15 s after a word, the Hold failed at 30 s of nobody in the ward, a puzzle let go at 60 s of silence, earned within 15 s of the win, the foes\' machine believed 10 s; the captain\'s fall believed a kill\'s least time after it stands, its time 5 min (mutants: each moved)', () => {
  assert.deepEqual([DELVE_PRESENT_MS, DELVE_LEAVE_MS, DELVE_LET_GO_MS, DELVE_EARN_MS, DELVE_ORPHAN_MS], [15_000, 30_000, 60_000, 15_000, 10_000]);
  assert.deepEqual([HOLD_WAVES, HOLD_GATHER_MS, HOLD_BREATH_MS, HOLD_WAVE_MAX_MS, HOLD_WAVE_MAX, HOLD_CAPTAIN_MIN_MS, HOLD_CAPTAIN_MAX_MS], [3, 4_000, 5_000, 90_000, 12, STAR_KILL_MIN_MS, 300_000]);
  assert.deepEqual([LITANY_RING_M, LITANY_STAND_M, LITANY_SHOW_STEP_MS, LITANY_WAKE, DELVE_WARD_PAD_M], [2.5, 1.2, 1_000, 2, 2]);
});

test('DLV1 THE HOLD\'S NUMBERS: three for one, two more a member, one more a wave, never past twelve; the captain one boss trait, two in an Elite dungeon - an Abyss dungeon stands no site, so its tier is no case (mutants: a member counted three; the wave\'s step dropped; the cap lifted; the Elite a regular)', () => {
  const t = (w, n) => holdWaveSize(w, n);
  assert.deepEqual([t(1, 1), t(2, 1), t(3, 1), t(1, 2), t(2, 2), t(1, 4), t(3, 4), t(1, 5), t(3, 5), t(1, 8), t(3, 8)], [3, 4, 5, 5, 6, 9, 11, 11, 12, 12, 12]);
  assert.equal(t(1, 0), 3, 'nobody counted is one');
  assert.equal(t(0, 1), 3, 'no wave before the first');
  assert.deepEqual(['regular', 'elite', 'super', undefined].map(holdCaptainTraits), [1, 2, 1, 1]);
});

test('DLV1 THE LITANY\'S NUMBERS: four plates, five in an Elite dungeon; the show a second a plate and a second more (mutants: five everywhere; the held step dropped)', () => {
  assert.deepEqual(['regular', 'elite', 'super', undefined].map(litanyCount), [4, 5, 4, 4]);
  assert.deepEqual([4, 5].map(litanyShowMs), [5_000, 6_000]);
});

test('DLV1 THE PIECES: the plates 2.5 m round the heart on literal bearings, north first; the gates on the ward\'s diagonals half a metre in; every spot to the centimetre (mutants: a bearing turned; the ring widened; the gates on the rim)', () => {
  assert.deepEqual(litanyPlates(site()), [[10, -2, 22.5], [12.5, -2, 20], [10, -2, 17.5], [7.5, -2, 20]]);
  const five = litanyPlates(site({ tier: 'elite' }));
  assert.equal(five.length, 5);
  assert.deepEqual(five.slice(0, 3), [[10, -2, 22.5], [12.38, -2, 20.77], [11.47, -2, 17.98]]);
  for (const [x, , z] of five) assert.ok(Math.abs(Math.hypot(x - 10, z - 20) - 2.5) < 0.01, 'on the ring');
  assert.deepEqual(holdGates(site()), [[12.47, -2, 22.47], [12.47, -2, 17.53], [7.53, -2, 17.53], [7.53, -2, 22.47]]);
  assert.deepEqual(holdGates(site({ x: 0.001, z: 0 }))[0], [2.48, -2, 2.47], 'rounded after the offset');
});

test('DLV1 THE ORDER: a shuffle of the plates off the dungeon\'s seed and the site - every order of four and of five reached, each about as often, the same every call, a site\'s own (mutants: the salt; the site left out; the swap\'s reach one short)', () => {
  assert.deepEqual(litanyOrder(1, 0, 4), [0, 1, 3, 2]);
  assert.deepEqual(litanyOrder(1, 1, 5), [0, 1, 4, 2, 3]);
  assert.deepEqual(litanyOrder(7, 0, 4), [0, 1, 2, 3]);
  for (const [k, n, all] of [[4, 2400, 24], [5, 12000, 120]]) {
    const seen = new Map();
    for (let s = 0; s < n; s++) { const o = litanyOrder(s, 0, k); assert.deepEqual([...o].sort(), Array.from({ length: k }, (_, j) => j)); seen.set(o.join(''), (seen.get(o.join('')) ?? 0) + 1); }
    assert.equal(seen.size, all, `every order of ${k}`);
    assert.ok(Math.min(...seen.values()) > (n / all) * 0.6 && Math.max(...seen.values()) < (n / all) * 1.4, 'each about as often');
  }
  let differ = 0;
  for (let s = 0; s < 50; s++) if (litanyOrder(s, 0, 4).join('') !== litanyOrder(s, 1, 4).join('')) differ++;
  assert.ok(differ > 40, 'two sites of one dungeon draw their own');
  assert.deepEqual(litanyOrder(-1, 0, 4), litanyOrder(0xffffffff, 0, 4), 'the seed read unsigned');
});

test('DLV1 THE WARD AND THE PLATE: the disc and 2 m, 3 m up or down; a plate within 1.2 m on its storey (mutants: the pad dropped; the storey widened; the plate\'s reach squared wrong)', () => {
  const s = site();
  assert.equal(inWard(s, 16, -2, 20), true, '6 m out: the rim');
  assert.equal(inWard(s, 16.01, -2, 20), false);
  assert.equal(inWard(s, 10, 1, 20), true); assert.equal(inWard(s, 10, 1.01, 20), false);
  assert.equal(inWard(s, 10, -5, 20), true); assert.equal(inWard(s, 10, -5.01, 20), false);
  assert.equal(inWard(s, 14.25, -2, 24.25), false, 'a corner past the circle');
  const plates = litanyPlates(s);
  assert.equal(plateAt(plates, 10, -2, 22.5), 0);
  assert.equal(plateAt(plates, 13.7, -2, 20), 1, '1.2 m off its plate');
  assert.equal(plateAt(plates, 13.71, -2, 20), -1);
  assert.equal(plateAt(plates, 12.5, 1, 20), 1); assert.equal(plateAt(plates, 12.5, 1.01, 20), -1);
  assert.equal(plateAt(plates, 10, -2, 20), -1, 'the heart is no plate');
});

test('DLV1 THE PLAN\'S HASH: every site\'s index, kind, heart, radius, vault to the centimetre and tier move it; under half a centimetre does not; the order of the sites counts (mutants: the vault left out; y left out; the count left out; the tier left out)', () => {
  const a = site(), b = site({ i: 1, kind: 'litany', x: 70, z: 20, vault: [73.4, -2, 20] });
  const h = delvePlanHash([a, b]);
  assert.equal(h, delvePlanHash([site(), site({ i: 1, kind: 'litany', x: 70, z: 20, vault: [73.4, -2, 20] })]), 'the same every call');
  assert.equal(typeof h, 'number');
  const moved = [
    [{ ...a, i: 2 }, b], [{ ...a, kind: 'litany' }, b], [{ ...a, x: 10.01 }, b], [{ ...a, y: -2.01 }, b], [{ ...a, z: 20.01 }, b], [{ ...a, r: 5 }, b],
    [{ ...a, vault: [13.41, -2, 20] }, b], [{ ...a, vault: [13.4, -1.99, 20] }, b], [{ ...a, vault: [13.4, -2, 20.01] }, b], [{ ...a, tier: 'elite' }, b], [b, a], [a],
  ];
  for (const sites of moved) assert.notEqual(delvePlanHash(sites), h);
  assert.equal(delvePlanHash([{ ...a, x: 10.004 }, b]), h, 'under half a centimetre');
  assert.notEqual(delvePlanHash([]), delvePlanHash([site({ x: 0, y: 0, z: 0, r: 0, i: 0, kind: 'none', vault: [0, 0, 0] })]), 'none is not one site of nothing');
  assert.equal(delvePlanHash([]), delvePlanHash(null));
});

test('DLV1 A NEW LEDGER: idle, the starter its owner, the Litany\'s order drawn, nothing moved; a word from outside the party or outside the ward starts nothing, and a ledger never woken lets go after 60 s with no word from the ward (mutants: a stranger counted; a word from the corridor counted; an idle ledger kept for ever)', () => {
  const led = newDelveLedger(site(), 'A', 7, T0);
  assert.equal(led.p, DP.idle); assert.equal(led.own, 'A'); assert.deepEqual(led.order, []); assert.equal(led.k, 0);
  const lit = newDelveLedger(site({ kind: 'litany', i: 1 }), 'A', 7, T0);
  assert.equal(lit.k, 4); assert.deepEqual(lit.order, litanyOrder(7, 1, 4));
  assert.deepEqual(foldDelveWord(led, 'X', 'x', word(), { party: false, inWard: true, nowMs: T0 }), []);
  assert.equal(Object.keys(led.a).length, 0, 'a stranger leaves no trace');
  assert.deepEqual(say(led, 'A', word(), T0, { inWard: false }), []);
  assert.equal(led.p, DP.idle, 'heard from the corridor: nothing starts');
  assert.equal(led.a.A.last, T0); assert.equal(led.a.A.inAt, -Infinity);
  assert.deepEqual(stepDelve(led, T0 + DELVE_LET_GO_MS - 1), [], 'idle, and kept');
  assert.deepEqual(stepDelve(led, T0 + DELVE_LET_GO_MS), [{ k: 'let' }], 'never woken in 60 s: let go - the site is free');
  assert.deepEqual(foldDelveWord(led, 'A', 'a', null, { party: true, inWard: true, nowMs: T0 }), [], 'no word, nothing');
  assert.deepEqual(DP, { idle: 0, gather: 1, wave: 2, breath: 3, captain: 4, show: 5, work: 6, won: 7, spring: 8, sunk: 9 }, 'DLV4: the Wellsprings\' pouring and the seals\' sinking');
});

test('DLV1 THE HOLD, WHOLE: the ward rises, three waves each cleared no sooner than its floor, a breath between, the captain believed after 20 s, won - earned by those in the ward within 15 s (mutants: the gathering skipped; a clear before its floor; the breath shortened; four waves; the captain early; the earn window widened)', () => {
  const led = newDelveLedger(site(), 'A', 7, T0);
  let t = T0;
  assert.deepEqual(say(led, 'A', word({ o: 1 }), t), [{ k: 'gather' }]);
  assert.equal(delveFoeOwner(led, t), 'A', 'its machine stands the foes');
  assert.deepEqual(stepDelve(led, t + HOLD_GATHER_MS - 1), []);
  assert.deepEqual(say(led, 'B', word(), t + 2_000), [], 'B steps in during the gathering');
  t += HOLD_GATHER_MS;
  assert.deepEqual(say(led, 'A', word({ o: 1 }), t), [{ k: 'wave', w: 1, wz: 5 }], 'two in the ward: five foes');
  assert.equal(delvePhaseLeft(led), HOLD_WAVE_MAX_MS);
  // B's kills and clears are not believed: A's machine stands the foes
  assert.deepEqual(say(led, 'B', word({ o: 1, kw: 1, kn: 5, wc: 1 }), t + 5_000), []);
  assert.equal(led.kn, 0); assert.equal(led.fo, 'A');
  const floor = starClearFloorMs(5, 2);
  assert.equal(floor, 3 * STAR_KILL_MIN_MS);
  assert.deepEqual(say(led, 'A', word({ o: 1, kw: 1, kn: 3, wc: 1 }), t + floor - 10), [], 'cleared too soon');
  assert.equal(led.kn, 3, 'its deaths counted');
  assert.deepEqual(say(led, 'A', word({ o: 1, kw: 0, kn: 9 }), t + floor - 5), [], 'another wave\'s deaths are not this one\'s');
  assert.equal(led.kn, 3);
  t += floor;
  assert.deepEqual(say(led, 'A', word({ o: 1, kw: 1, kn: 5, wc: 1 }), t), [{ k: 'breath', w: 1 }]);
  assert.equal(delvePhaseLeft(led), HOLD_BREATH_MS);
  say(led, 'B', word(), t + 1);
  t += HOLD_BREATH_MS;
  assert.deepEqual(say(led, 'A', word({ o: 1, kw: 1, kn: 5, wc: 1 }), t), [{ k: 'wave', w: 2, wz: 6 }], 'the old wave\'s word clears nothing of the new');
  assert.equal(led.kn, 0);
  // wave 2 runs its full ninety seconds, both in the ward throughout
  for (let s = 10_000; s < HOLD_WAVE_MAX_MS; s += 10_000) { say(led, 'A', word({ o: 1 }), t + s); say(led, 'B', word(), t + s); }
  assert.deepEqual(stepDelve(led, t + HOLD_WAVE_MAX_MS), [{ k: 'breath', w: 2 }], 'a wave that runs long gives way');
  t += HOLD_WAVE_MAX_MS;
  assert.deepEqual(stepDelve(led, t + HOLD_BREATH_MS), [{ k: 'wave', w: 3, wz: 7 }]);
  t += HOLD_BREATH_MS;
  say(led, 'A', word({ o: 1 }), t); say(led, 'B', word(), t);
  t += starClearFloorMs(7, 2);
  say(led, 'B', word(), t - 1);
  assert.deepEqual(say(led, 'A', word({ o: 1, kw: 3, kn: 7, wc: 3 }), t), [{ k: 'breath', w: 3 }]);
  assert.deepEqual(say(led, 'A', word({ o: 1 }), t + HOLD_BREATH_MS), [{ k: 'captain', traits: 1 }], 'three waves, then the captain');
  t += HOLD_BREATH_MS;
  assert.equal(delvePhaseLeft(led), HOLD_CAPTAIN_MAX_MS, 'the captain\'s own time runs');
  assert.deepEqual(say(led, 'A', word({ o: 1, cf: 1 }), t + HOLD_CAPTAIN_MIN_MS - 10), [], 'fallen too soon: faster than any blow');
  assert.equal(delveWon(led), false);
  say(led, 'C', word(), t + 5_000, { inWard: false });
  for (let s = 5_000; s < 20_000; s += 5_000) say(led, 'A', word({ o: 1 }), t + s);
  const ev = say(led, 'A', word({ o: 1, cf: 1 }), t + 20_000);
  assert.deepEqual(ev, [{ k: 'won', earned: ['A'] }], 'B silent past 15 s, C never in the ward: neither earned');
  assert.equal(delveWon(led), true); assert.equal(led.wonAt, t + 20_000);
  assert.deepEqual(say(led, 'B', word(), t + 20_001), [], 'won is over');
  assert.deepEqual(stepDelve(led, t + 10 * DELVE_LEAVE_MS), [], 'and stays won');
});

test('DLV1 THE EARNERS: everyone heard in the ward within 15 s of the win, at 15 s exactly too (mutants: the window\'s edge)', () => {
  const led = newDelveLedger(site(), 'A', 7, T0);
  let t = T0;
  const beat = (until) => { while (t < until) { t = Math.min(until, t + 5_000); say(led, 'A', word({ o: 1 }), t); } };
  say(led, 'A', word({ o: 1 }), t);
  for (let w = 1; w <= HOLD_WAVES; w++) {
    beat(t + (w === 1 ? HOLD_GATHER_MS : HOLD_BREATH_MS));
    assert.equal(led.w, w);
    beat(t + 12 * STAR_KILL_MIN_MS);
    say(led, 'A', word({ o: 1, kw: w, kn: 12, wc: w }), t);
  }
  beat(t + HOLD_BREATH_MS);
  assert.equal(led.p, DP.captain);
  say(led, 'C', word(), t + HOLD_CAPTAIN_MIN_MS - DELVE_EARN_MS - 1);
  say(led, 'B', word(), t + HOLD_CAPTAIN_MIN_MS - DELVE_EARN_MS);
  assert.deepEqual(say(led, 'A', word({ o: 1, cf: 1 }), t + HOLD_CAPTAIN_MIN_MS)[0].earned, ['A', 'B']);
});

test('DLV1 THE FOES\' MACHINE: the first member to stand them keeps them while heard within 10 s, then another may; a member who stops standing them lets them go (mutants: a second owner believed; the orphan window)', () => {
  const led = newDelveLedger(site(), 'A', 7, T0);
  say(led, 'A', word({ o: 1 }), T0);
  say(led, 'B', word({ o: 1 }), T0 + DELVE_ORPHAN_MS);
  assert.equal(led.fo, 'A', 'heard 10 s ago: still A\'s');
  assert.equal(delveState(led, T0 + DELVE_ORPHAN_MS).fo, 1);
  say(led, 'B', word({ o: 1 }), T0 + DELVE_ORPHAN_MS + 1);
  assert.equal(led.fo, 'B', 'A silent past 10 s: B takes them');
  assert.equal(delveFoeOwner(led, T0 + 2 * DELVE_ORPHAN_MS + 1), 'B');
  assert.equal(delveFoeOwner(led, T0 + 2 * DELVE_ORPHAN_MS + 2), '');
  say(led, 'B', word({ o: 0 }), T0 + 12_000);
  assert.equal(led.fo, '', 'B lets them go');
  say(led, 'A', word({ o: 0 }), T0 + 12_001);
  assert.equal(led.fo, '');
});

test('DLV1 THE ENCOUNTER CLOCK: it runs while a member was heard in the ward within 15 s, stops after, and starts again at the next word - the party\'s leaving fails the Hold at 30 s, and the next word starts it over (mutants: the clock run through absence; the leave window)', () => {
  const led = newDelveLedger(site(), 'A', 7, T0);
  say(led, 'A', word({ o: 1 }), T0);
  stepDelve(led, T0 + HOLD_GATHER_MS);
  assert.equal(led.p, DP.wave);
  // silent 29 s from the last word: the clock ran 15 of them
  say(led, 'A', word({ o: 1 }), T0 + HOLD_GATHER_MS + 25_000);
  assert.equal(led.ec, 15_000, 'fifteen seconds past the last word, not twenty-nine');
  assert.equal(delvePhaseLeft(led), HOLD_WAVE_MAX_MS - (15_000 - HOLD_GATHER_MS));
  // out of the ward: heard, but nobody in it - the clock stops 15 s on, the attempt fails at 30 s
  const out = T0 + HOLD_GATHER_MS + 25_000;
  say(led, 'A', word({ o: 1 }), out + 5_000, { inWard: false });
  assert.deepEqual(stepDelve(led, out + DELVE_LEAVE_MS - 1), []);
  assert.equal(led.ec, 30_000, 'and 15 more past the word from inside');
  assert.deepEqual(stepDelve(led, out + DELVE_LEAVE_MS), [{ k: 'failed' }]);
  assert.equal(led.p, DP.idle); assert.equal(led.w, 0); assert.equal(led.ec, 0); assert.equal(led.fo, '');
  assert.equal(led.own, 'A', 'the ledger is still the owner\'s');
  assert.deepEqual(say(led, 'A', word(), out + 40_000), [{ k: 'gather' }], 'back in: the ward rises again');
  assert.deepEqual(stepDelve(led, out + 40_000 + HOLD_GATHER_MS), [{ k: 'wave', w: 1, wz: 3 }], 'from the first wave');
});

test('DLV1 THE LITANY, WHOLE: the order shown, then worked - a plate stood on and said lights in turn, a lit plate is free, a wrong one shows the order again; every plate in order wins (mutants: the show skipped; a plate said but not stood on; a lit plate punished; the order\'s last plate not winning)', () => {
  const led = newDelveLedger(site({ kind: 'litany' }), 'A', 1, T0);
  const order = litanyOrder(1, 0, 4);
  assert.deepEqual(order, [0, 1, 3, 2]);
  assert.deepEqual(say(led, 'A', word(), T0), [{ k: 'show', order }]);
  assert.equal(delvePhaseLeft(led), 5_000);
  assert.deepEqual(say(led, 'A', word({ st: 0 }), T0 + 1_000), [], 'nothing lights while it shows');
  assert.deepEqual(stepDelve(led, T0 + 5_000), [{ k: 'work' }]);
  let t = T0 + 5_000;
  assert.deepEqual(say(led, 'A', word({ st: 0 }), t += 100, { plate: 1 }), [], 'said one plate, stood on another: nothing');
  assert.deepEqual(say(led, 'A', word({ st: 9 }), t += 100, { plate: 9 }), [], 'no such plate');
  assert.deepEqual(say(led, 'A', word({ st: 0 }), t += 100), [{ k: 'lit', j: 0, next: 1 }]);
  assert.deepEqual(say(led, 'B', word({ st: 1 }), t += 100), [{ k: 'lit', j: 1, next: 2 }], 'any member of the party');
  assert.deepEqual(say(led, 'A', word(), t += 100), [], 'off the plate');
  assert.deepEqual(say(led, 'A', word({ st: 0 }), t += 100), [], 'a lit plate is stood on freely'); // stepped back onto, so judged (LITANY-STAND)
  assert.deepEqual(say(led, 'A', word({ st: 2 }), t += 100), [{ k: 'wrong', j: 2 }, { k: 'show', order }], 'out of turn: shown again, no foes in a regular dungeon');
  assert.equal(led.next, 0); assert.equal(led.shows, 2);
  stepDelve(led, t + 5_000);
  t += 5_000;
  for (const j of order.slice(0, 3)) say(led, 'A', word({ st: j }), t += 500);
  assert.equal(led.next, 3);
  assert.deepEqual(say(led, 'A', word({ st: 2 }), t += 500), [{ k: 'lit', j: 2, next: 4 }, { k: 'won', earned: ['A', 'B'] }]);
  assert.equal(delveWon(led), true);
});

test('LITANY-STAND: the plate a member stands on is in every word and judged once - stood on through the show it lights as the work begins, a word the room does not bear out counts on the next, a wrong plate stood on is not judged again until stepped off (mutants: judged every word; never stepped off; the show taking the step)', () => {
  const led = newDelveLedger(site({ kind: 'litany' }), 'A', 1, T0);
  const order = litanyOrder(1, 0, 4);
  assert.deepEqual(order, [0, 1, 3, 2]);
  assert.deepEqual(say(led, 'A', word({ st: 0 }), T0), [{ k: 'show', order }], 'woken standing on the first plate');
  assert.deepEqual(say(led, 'A', word({ st: 0 }), T0 + 4_000), [], 'nothing while it shows');
  assert.deepEqual(say(led, 'A', word({ st: 0 }), T0 + 5_000), [{ k: 'work' }, { k: 'lit', j: 0, next: 1 }], 'stood on through the show: lit as the work begins');
  assert.deepEqual(say(led, 'A', word({ st: 0 }), T0 + 5_100), [], 'judged once');
  assert.deepEqual(say(led, 'A', word({ st: 1 }), T0 + 5_200, { plate: -1 }), [], 'the room still hears me short of it');
  assert.deepEqual(say(led, 'A', word({ st: 1 }), T0 + 6_200), [{ k: 'lit', j: 1, next: 2 }], 'the next word, borne out');
  let t = T0 + 6_300;
  assert.deepEqual(say(led, 'A', word({ st: 2 }), t), [{ k: 'wrong', j: 2 }, { k: 'show', order }]);
  const after = [];
  for (let k = 0; k < 8; k++) after.push(...say(led, 'A', word({ st: 2 }), t += 1_000));
  assert.deepEqual(after, [{ k: 'work' }], 'stood on through the order shown again and on: no second wrong');
  assert.deepEqual(say(led, 'A', word(), t += 100), [], 'stepped off');
  assert.deepEqual(say(led, 'A', word({ st: 2 }), t += 100), [{ k: 'wrong', j: 2 }, { k: 'show', order }], 'and on again: judged again');
  assert.deepEqual(say(led, 'B', word({ st: 0 }), t += 6_000), [{ k: 'work' }, { k: 'lit', j: 0, next: 1 }], 'each member their own');
});

test('AUDIT LITANY-STAND: a party - a member who stays on a lit plate through another\'s wrong one has it lit again as the work begins, and the next plate lights under whoever stands there; a wrong plate stood on through the show is not judged until stepped onto (mutants: stayed plates never heard; stayed plates always judged)', () => {
  const led = newDelveLedger(site({ kind: 'litany', tier: 'elite' }), 'A', 1, T0);
  const order = led.order;
  say(led, 'A', word({ st: order[0] }), T0);
  say(led, 'B', word({ st: order[1] }), T0 + 1_000);
  assert.deepEqual(say(led, 'A', word({ st: order[0] }), T0 + 6_000), [{ k: 'work' }, { k: 'lit', j: order[0], next: 1 }]);
  assert.deepEqual(say(led, 'B', word({ st: order[1] }), T0 + 6_100), [{ k: 'lit', j: order[1], next: 2 }], 'stood on through the show, lit when its turn comes');
  let t = T0 + 6_200;
  assert.deepEqual(say(led, 'C', word({ st: order[3] }), t), [{ k: 'wrong', j: order[3] }, { k: 'wake', n: LITANY_WAKE }, { k: 'show', order }], 'C out of turn');
  assert.deepEqual(say(led, 'A', word({ st: order[0] }), t += 6_000), [{ k: 'work' }, { k: 'lit', j: order[0], next: 1 }], 'A never moved: lit again');
  assert.deepEqual(say(led, 'B', word({ st: order[1] }), t += 100), [{ k: 'lit', j: order[1], next: 2 }], 'B never moved: lit in its turn');
  assert.deepEqual(say(led, 'C', word({ st: order[3] }), t += 100), [], 'C never moved: no second wrong, no more foes');
  assert.deepEqual(say(led, 'D', word({ st: order[4] }), t += 100), [{ k: 'wrong', j: order[4] }, { k: 'wake', n: LITANY_WAKE }, { k: 'show', order }], 'a step onto a wrong plate is judged');
  assert.deepEqual(say(led, 'E', word({ st: order[2] }), t += 2_000), [], 'E steps onto a plate as the order shows');
  assert.deepEqual(say(led, 'D', word({ st: order[4] }), t += 4_000), [{ k: 'work' }], 'D stood on through the show: not judged again');
  assert.deepEqual(say(led, 'E', word({ st: order[2] }), t += 100), [], 'E still on it, out of turn, as the work begins: nothing');
  assert.equal(led.next, 0);
});

test('DLV1 THE LITANY IN AN ELITE DUNGEON: five plates, a wrong one wakes two foes; a party silent 60 s lets it go, and the next word shows it from the start (mutants: the wake in every dungeon; the let-go window; a let-go Litany keeping its lit plates)', () => {
  const led = newDelveLedger(site({ kind: 'litany', tier: 'elite' }), 'A', 1, T0);
  assert.equal(led.k, 5);
  say(led, 'A', word(), T0);
  assert.deepEqual(stepDelve(led, T0 + 6_000), [{ k: 'work' }], 'five plates: six seconds');
  const order = led.order;
  say(led, 'A', word({ st: order[0] }), T0 + 6_100);
  assert.deepEqual(say(led, 'A', word({ st: order[2] }), T0 + 6_200), [{ k: 'wrong', j: order[2] }, { k: 'wake', n: 2 }, { k: 'show', order }]);
  assert.deepEqual(stepDelve(led, T0 + 12_200), [{ k: 'work' }]);
  say(led, 'A', word({ st: order[0] }), T0 + 12_300);
  assert.equal(led.next, 1);
  say(led, 'A', word(), T0 + 12_400, { inWard: false });
  assert.deepEqual(stepDelve(led, T0 + 12_300 + DELVE_LET_GO_MS - 1), [], 'a word from outside is no word at the site');
  assert.deepEqual(stepDelve(led, T0 + 12_300 + DELVE_LET_GO_MS), [{ k: 'let' }]);
  assert.equal(led.p, DP.idle); assert.equal(led.next, 0, 'its lit plate dark again');
  const again = newDelveLedger(site({ kind: 'litany', tier: 'elite' }), 'A', 1, T0 + 100_000);   // the caller drops a let-go ledger
  assert.deepEqual(say(again, 'A', word(), T0 + 100_000), [{ k: 'show', order }], 'shown from the start');
  assert.deepEqual(stepDelve(again, T0 + 100_000 + 30_000), [{ k: 'work' }], 'a Litany never fails for the party\'s leaving, only lets go');
});

test('DLV1 THE SCREEN\'S STATE: the site, kind, phase, wave, size, deaths, time left, the party in the ward, the foes stood, the next plate - no account named; a ledger holds sixteen accounts at most (mutants: the in-ward count from every word heard)', () => {
  const led = newDelveLedger(site({ i: 2 }), 'acct-secret', 7, T0);
  say(led, 'acct-secret', word({ o: 1 }), T0);
  say(led, 'acct-other', word(), T0 + 1, { inWard: false });
  const st = delveState(led, T0 + 2);
  assert.deepEqual(st, { k: 'dl', s: 2, kd: 1, p: DP.gather, w: 0, wz: 0, kn: 0, wl: HOLD_GATHER_MS - 1, nd: 1, fo: 1, nx: 0 });
  assert.ok(!JSON.stringify(st).includes('acct'), 'no account in it');
  assert.deepEqual(delveInWard(led, T0 + DELVE_PRESENT_MS), ['acct-secret']);
  assert.deepEqual(delveInWard(led, T0 + DELVE_PRESENT_MS + 1), []);
  for (let k = 0; k < 20; k++) say(led, `m${k}`, word(), T0 + 10 + k);
  assert.equal(Object.keys(led.a).length, 2 * DELVE_PARTY_MAX);
  assert.equal(led.a['m19'], undefined, 'the seventeenth is not kept');
  const fresh = newDelveLedger(site(), 'big', 7, T0);
  say(fresh, 'big', word({ lv: 500 }), T0);
  assert.equal(fresh.a.big.lv, 99, 'a level past the law clamped');
  assert.equal(led.a['acct-secret'].nm, 'n-acct-secret');
});

test('DLV1 THE CAPTAIN\'S TIME AND THE ENDS: a captain not fallen in 5 min of the encounter clock ends the attempt (outlasted); a word in the ward at the very moment an attempt ends starts nothing in the same fold - the caller drops the ledger (mutants: the captain\'s time unread; the fold run on past its end)', () => {
  const led = newDelveLedger(site(), 'A', 7, T0);
  let t = T0;
  const beat = (until) => { while (t < until) { t = Math.min(until, t + 5_000); say(led, 'A', word({ o: 1 }), t); } };
  say(led, 'A', word({ o: 1 }), t);
  for (let w = 1; w <= HOLD_WAVES; w++) {
    beat(t + (w === 1 ? HOLD_GATHER_MS : HOLD_BREATH_MS));
    beat(t + 12 * STAR_KILL_MIN_MS);
    say(led, 'A', word({ o: 1, kw: w, kn: 12, wc: w }), t);
  }
  beat(t + HOLD_BREATH_MS);
  assert.equal(led.p, DP.captain);
  const cs = t;
  beat(cs + HOLD_CAPTAIN_MAX_MS - 5_000);
  assert.equal(led.p, DP.captain, 'fought, not fallen: still running');
  assert.deepEqual(say(led, 'A', word({ o: 1 }), cs + HOLD_CAPTAIN_MAX_MS), [{ k: 'failed', outlasted: true }], 'outlasted - and nothing after it in the fold');
  assert.equal(led.p, DP.idle);
  // the leave's end and a step back in, in one fold: the end alone
  const L = newDelveLedger(site(), 'A', 7, T0);
  say(L, 'A', word({ o: 1 }), T0);
  say(L, 'A', word({ o: 1 }), T0 + 1_000, { inWard: false });
  assert.deepEqual(say(L, 'A', word({ o: 1 }), T0 + DELVE_LEAVE_MS), [{ k: 'failed' }], 'never [failed, gather]');
});

test('DLV1 A MOMENT THAT IS NO NUMBER moves nothing, and the clock runs on after it; a word heard late moves no time back (mutants: a NaN taken; a presence moved back)', () => {
  const led = newDelveLedger(site(), 'A', 7, T0);
  say(led, 'A', word({ o: 1 }), T0);
  assert.deepEqual(stepDelve(led, NaN), []);
  assert.deepEqual(say(led, 'A', word({ o: 1 }), Infinity), []);
  assert.equal(led.stepAt, T0);
  assert.deepEqual(stepDelve(led, T0 + HOLD_GATHER_MS), [{ k: 'wave', w: 1, wz: 3 }], 'the clock runs on');
  say(led, 'A', word({ o: 1 }), T0 + 10_000);
  say(led, 'A', word({ o: 1 }), T0 + 2_000);   // a late word
  assert.equal(led.inAt, T0 + 10_000); assert.equal(led.a.A.inAt, T0 + 10_000); assert.equal(led.a.A.last, T0 + 10_000);
  assert.deepEqual(stepDelve(led, T0 + 10_000 + DELVE_LEAVE_MS - 1), [], 'not failed early');
});

test('DLV1 A WAVE SIZED AT ITS MOMENT: the party in the ward as the wave stands, not when the step comes (mutants: the size read at the step)', () => {
  const led = newDelveLedger(site(), 'A', 7, T0);
  for (const m of ['A', 'B', 'C', 'D']) say(led, m, word({ o: m === 'A' ? 1 : 0 }), T0);
  // the next word 16 s on: the wave stood at 4 s, when all four were in the ward
  assert.deepEqual(say(led, 'A', word({ o: 1 }), T0 + 16_000), [{ k: 'wave', w: 1, wz: holdWaveSize(1, 4) }]);
  assert.equal(led.n, 4);
});

test('DLV1 AN ACCOUNT\'S NAME IS NEVER AN OBJECT\'S: "constructor" and "__proto__" are accounts like any other, and nothing lands on Object.prototype (mutants: a plain object)', () => {
  const led = newDelveLedger(site(), 'constructor', 7, T0);
  say(led, 'constructor', word({ o: 1 }), T0);
  say(led, '__proto__', word(), T0 + 1);
  assert.deepEqual(delveInWard(led, T0 + 2), ['__proto__', 'constructor']);
  assert.equal(Object.prototype.nm, undefined); assert.equal({}.inAt, undefined);
  assert.equal(Object.getPrototypeOf(led.a), null);
});
