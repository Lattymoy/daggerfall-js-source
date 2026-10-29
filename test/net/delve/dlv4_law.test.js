// DLV4 (bible/03-World/Delve-II.md section 5): THE FIVE MORE KINDS' LAW - the Wellsprings, the Vigil, the Brazier Rite,
// the Weighing and the Seals: their numbers, their pieces' spots on floor the site law already asks, and the ledger's
// machine through each - its rising, its pieces struck, guarded, carried and held, its ends and its win. Each pin is held
// to fail under a one-character change of the rule it names (tools/mutants/dlv4.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DP, FLAME, WEIGHT, newDelveLedger, stepDelve, foldDelveWord, foldDelveHit, foldDelveAct, delveState, delvePhaseLeft, delveCarrier,
  isWaveKind, delveKindById, DELVE_HEART_VAULTS, DELVE_BURDEN, DELVE_REACH_M, delveErrandMs,
  SPRING_MIN, SPRING_MAX, springCount, SPRING_POUR_MS, SPRING_ALIVE, SPRING_TEAM_S, springHp, SPRING_MAX_MS, SPRING_R, SPRING_H,
  VIGIL_LIGHT, VIGIL_BLOW_LIGHT, VIGIL_BREATH_LIGHT, VIGIL_REST_MS, braziersFor, FLAME_LIFE_MS, FLAME_LIES_MS, DRIFT_MAX, DRIFT_EVERY_MS, PUZZLE_RISE_MS,
  WEIGH_RING_M, WEIGHTS, WEIGH_HOLD_MS, WEIGH_FRESH_MS, sealCount, SEAL_RING_M, sealHp, SEAL_WORK_MS, SEAL_SINK_MS, sealRouteM, sealWindowMs,
  springSpots, brazierSpots, vaultAxis, weighPlates, weightSpots, sealSpots, holdGates, delvePlates, litanyPlates, plateAt, driftSpots,
  HOLD_GATHER_MS, HOLD_BREATH_MS, HOLD_WAVE_MAX_MS, HOLD_CAPTAIN_MIN_MS, DELVE_LEAVE_MS, DELVE_LET_GO_MS, holdWaveSize,
} from '../../../src/net/delve/delveLaw.js';
import { STAR_LIGHT, STAR_BLOW_LIGHT, STAR_BREATH_LIGHT, STAR_BLOWS_BURST, starClearFloorMs } from '../../../src/net/starfall/starfallLaw.js';
import { KT_CARRY_PACE, ktLeastMs } from '../../../src/net/ketch/ketchBrain.js';
import { crystalHpFor, dpsRef, HOST_HP_MIN, HIT_KINDS, BUCKET_DEPTH_X, HIT_CAP_X, MELEE_REACH, POSE_SLACK } from '../../../src/net/gate/gateBrain.js';

const T0 = 1_000_000;
const site = (o = {}) => ({ i: 0, kind: 'wellsprings', x: 10, y: -2, z: 20, r: 4, tier: 'regular', vault: [13.4, -2, 20], ...o });
const word = (o = {}) => ({ lv: 10, o: 0, kw: 0, kn: 0, wc: 0, cf: 0, st: -1, hb: 0, ...o });
const say = (led, acct, w, nowMs, ctx = {}) => foldDelveWord(led, acct, `n-${acct}`, w, { party: true, inWard: true, plate: -1, nowMs, ...ctx });
const hit = (led, s, acct, j, d, nowMs, o = {}) => foldDelveHit(led, s, acct, { j, d, r: HIT_KINDS.Melee, q: nowMs, ...o.hit }, { party: true, inWard: true, pose: o.pose ?? [s.x, s.y, s.z], nowMs, ...o.ctx });
const act = (led, s, acct, a, j, pose, nowMs, ctx = {}) => foldDelveAct(led, s, acct, { a, j }, { party: true, inWard: true, pose, nowMs, ...ctx });
/** Words from `acct` every second from `from` to `to` (the encounter clock runs while a member is heard). */
function beat(led, acct, from, to, w = word()) { for (let t = from; t <= to; t += 1_000) say(led, acct, w, t); }

test('DLV4 THE KINDS: three fought in waves, four puzzles, numbered on from the Litany; the wire\'s number names its kind; the Litany\'s and the seals\' vaults at the heart (mutants: a kind\'s family swapped; a heart vault for all)', () => {
  assert.deepEqual(['hold', 'litany', 'wellsprings', 'vigil', 'brazier', 'weighing', 'seals'].map(isWaveKind), [true, false, true, true, false, false, false]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 0].map(delveKindById), ['hold', 'litany', 'wellsprings', 'vigil', 'brazier', 'weighing', 'seals', null, null]);
  assert.deepEqual(DELVE_HEART_VAULTS, ['litany', 'seals']);
  assert.equal(isWaveKind('constructor'), false);
});

test('DLV4 THE NUMBERS: two to four sources pouring every 12 s, three alive each, 12 s of the party\'s damage, 5 min to break them; the relic\'s light the Starfall\'s, a minute\'s rest; three braziers, four for four; the flame 20 s carried and 10 s lying, two drifting foes 15 s apart, a 3 s rising; three plates 3 m out held 3 s; three to six seals 3 m out, 24 s and their route, 10 s sunk; the burden the Ketch\'s (mutants: each moved)', () => {
  assert.deepEqual([SPRING_MIN, SPRING_MAX, SPRING_POUR_MS, SPRING_ALIVE, SPRING_TEAM_S, SPRING_MAX_MS, SPRING_R, SPRING_H], [2, 4, 12_000, 3, 12, 300_000, 0.8, 1.6]);
  assert.deepEqual([VIGIL_LIGHT, VIGIL_BLOW_LIGHT, VIGIL_BREATH_LIGHT, VIGIL_REST_MS], [STAR_LIGHT, STAR_BLOW_LIGHT, STAR_BREATH_LIGHT, 60_000]);
  assert.deepEqual([VIGIL_LIGHT, VIGIL_BREATH_LIGHT], [100, 15]);
  assert.deepEqual([1, 2, 3, 4, 8, 0].map(braziersFor), [3, 3, 3, 4, 4, 3]);
  assert.deepEqual([FLAME_LIFE_MS, FLAME_LIES_MS, DRIFT_MAX, DRIFT_EVERY_MS, PUZZLE_RISE_MS], [20_000, 10_000, 2, 15_000, 3_000]);
  assert.deepEqual([WEIGH_RING_M, WEIGHTS, WEIGH_HOLD_MS, WEIGH_FRESH_MS], [3, 3, 3_000, 2_500]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(sealCount), [3, 3, 4, 4, 5, 5, 6, 6]);
  assert.deepEqual([SEAL_RING_M, SEAL_WORK_MS, SEAL_SINK_MS], [3, 24_000, 10_000]);
  assert.equal(DELVE_BURDEN, KT_CARRY_PACE); assert.equal(DELVE_BURDEN, 0.72);
  assert.equal(DELVE_REACH_M, 1.2);
});

test('DLV4 THE SOURCES\' COUNT AND HEALTH: drawn off the seed and the site, every count reached, the same each call; a source the party\'s twelve seconds of reference damage, never under the gate\'s floor; a seal Dagon\'s crystal (mutants: the salt; the range one short; the team\'s seconds; the floor dropped)', () => {
  const seen = new Set();
  for (let s = 0; s < 200; s++) { const k = springCount(s, 0); assert.ok(k >= 2 && k <= 4); seen.add(k); }
  assert.deepEqual([...seen].sort(), [2, 3, 4]);
  assert.equal(springCount(7, 1), springCount(7, 1));
  assert.deepEqual([1, 2, 3, 4, 5, 6].flatMap((seed) => [springCount(seed, 0), springCount(seed, 1)]), [3, 3, 4, 2, 3, 4, 2, 2, 2, 4, 4, 2], 'the counts the salt draws');
  assert.equal(springHp([10]), 12 * dpsRef(10));
  assert.equal(springHp([10, 20]), 12 * (dpsRef(10) + dpsRef(20)));
  assert.equal(springHp([]), HOST_HP_MIN);
  assert.equal(sealHp([10, 10], 3), crystalHpFor([10, 10], 3));
});

test('DLV4 THE PIECES\' SPOTS: sources and braziers on the ward\'s gates (two sources across it); the weights on the first three gates; the Weighing\'s plates 3 m out on the axes the vault does not take; the seals 3 m out round from north; every spot on floor the site law asks (mutants: a source beside its twin; a plate on the vault\'s axis; the seals\' slots)', () => {
  const s = site(), g = holdGates(s);
  assert.deepEqual(springSpots(s, 2), [g[0], g[2]], 'two sources face each other');
  assert.deepEqual(springSpots(s, 4), g);
  assert.deepEqual(brazierSpots(s, 3), g.slice(0, 3));
  assert.deepEqual(weightSpots(s), g.slice(0, 3));
  assert.equal(vaultAxis(s), 1, 'the vault east');
  assert.deepEqual(weighPlates(s), [[10, -2, 23], [10, -2, 17], [7, -2, 20]], 'north, south, west - never the vault\'s east');
  assert.equal(vaultAxis(site({ vault: [10, -2, 20] })), -1, 'a vault at the heart');
  assert.deepEqual(weighPlates(site({ vault: [10, -2, 16.6] })).map((p) => [p[0], p[2]]), [[10, 23], [13, 20], [7, 20]]);
  assert.deepEqual(sealSpots(s, 4), [[10, -2, 23], [13, -2, 20], [10, -2, 17], [7, -2, 20]]);
  assert.deepEqual(sealSpots(s, 3).map((p) => [p[0], p[2]]), [[10, 23], [12.12, 17.88], [7.88, 17.88]]);
  for (const k of [3, 4, 5, 6]) for (const p of sealSpots(s, k)) assert.ok(Math.abs(Math.hypot(p[0] - 10, p[2] - 20) - 3) < 0.01);
  assert.deepEqual(delvePlates(site({ kind: 'weighing' })), weighPlates(s));
  assert.deepEqual(delvePlates(site({ kind: 'litany' })), litanyPlates(s));
  assert.deepEqual(delvePlates(site({ kind: 'seals' })), []);
});

test('DLV4 THE SEALS\' WINDOW: 24 s and the errand floor of their route - the heart to the first, then round the ring (mutants: the route\'s first leg; the work\'s seconds)', () => {
  const p = sealSpots(site({ x: 0, y: 0, z: 0 }), 4);
  let d = 3;
  for (let j = 1; j < 4; j++) d += Math.hypot(p[j][0] - p[j - 1][0], p[j][2] - p[j - 1][2]);
  assert.ok(Math.abs(sealRouteM(4) - d) < 1e-9);
  assert.equal(sealWindowMs(4), SEAL_WORK_MS + delveErrandMs(sealRouteM(4)));
  assert.ok(sealWindowMs(6) > sealWindowMs(3), 'more seals, a longer route');
});

test('DLV4 THE WELLSPRINGS, WHOLE: the ward rises 4 s, the sources stand sized to the party in the ward then, a blow within reach breaks one by the gate\'s caps, the last stands the captain, its fall after one kill\'s least time wins (mutants: the size read at the step; a blow out of reach; a source broken by one blow past its cap; the captain skipped)', () => {
  const s = site(), led = newDelveLedger(s, 'A', 3, T0);
  const k = led.k;
  assert.equal(k, springCount(3, 0));
  assert.deepEqual(say(led, 'A', word({ o: 1, lv: 10 }), T0), [{ k: 'gather' }]);
  say(led, 'B', word({ lv: 20 }), T0 + 1_000);
  const ev = stepDelve(led, T0 + HOLD_GATHER_MS);
  assert.deepEqual(ev, [{ k: 'spring', n: k, h: springHp([10, 20]) }], 'two in the ward as they stand');
  assert.equal(led.p, DP.spring); assert.deepEqual(led.hp, Array(k).fill(springHp([10, 20])));
  assert.equal(delvePhaseLeft(led), SPRING_MAX_MS);
  const spots = springSpots(s, k);
  let t = T0 + HOLD_GATHER_MS;
  assert.deepEqual(hit(led, s, 'A', 0, 50, t += 100, { pose: [spots[0][0] + 6.4, s.y, spots[0][2]] }), [], 'a swing from past its reach: nothing');
  assert.equal(led.hp[0], springHp([10, 20]));
  assert.deepEqual(hit(led, s, 'X', 0, 50, t += 100), [], 'a stranger to the site\'s ledger: nothing');
  const cap = HIT_CAP_X * dpsRef(10);
  hit(led, s, 'A', 0, 1e6, t += 300, { pose: spots[0] });
  assert.equal(led.hp[0], springHp([10, 20]) - cap, 'one blow lands no more than its cap');
  // break them all: B's and A's blows, a second apart (the hand and the purse refill)
  for (let j = 0; j < k; j++) {
    for (let n = 0; led.hp[j] > 0 && n < 400; n++) { t += 1_000; say(led, 'A', word({ o: 1, lv: 10 }), t); say(led, 'B', word({ lv: 20 }), t); hit(led, s, 'B', j, 1e6, t + 10, { pose: spots[j] }); }
    assert.equal(led.hp[j], 0, `source ${j} broken`);
  }
  assert.equal(led.p, DP.captain, 'the last source stands the captain');
  const cs = t;
  assert.deepEqual(say(led, 'A', word({ o: 1, cf: 1 }), cs + 100), [], 'fallen faster than a blow');
  const won = say(led, 'A', word({ o: 1, cf: 1 }), cs + 10 + HOLD_CAPTAIN_MIN_MS + 1_000);
  assert.equal(won.at(-1).k, 'won');
  assert.deepEqual(won.at(-1).earned, ['A', 'B']);
});

test('DLV4 PIECES SIZED AT THEIR MOMENT: the sources, the seals and the braziers by the party in the ward as they stand, not when the step comes (mutants: each read at the step)', () => {
  // the next word 16.5 s on: the clock stopped at 16 s, when only the last to speak was still in the ward
  const late = (kind, members) => {
    const led = newDelveLedger(site({ kind }), 'A', 3, T0);
    members.forEach(([m, lv], n) => say(led, m, word({ o: n ? 0 : 1, lv }), n === members.length - 1 ? T0 + 1_000 : T0));
    say(led, 'A', word({ o: 1, lv: members[0][1] }), T0 + 16_500);
    return led;
  };
  assert.equal(late('wellsprings', [['A', 10], ['B', 20]]).hx, springHp([10, 20]));
  assert.equal(late('seals', [['A', 10], ['B', 20]]).hx, sealHp([10, 20], sealCount(2)));
  assert.equal(late('brazier', [['A', 10], ['B', 10], ['C', 10], ['D', 10]]).k, braziersFor(4));
  assert.notEqual(braziersFor(4), braziersFor(1), 'four counted, not the one left');
});

test('DLV4 THE WELLSPRINGS\' ENDS: the party gone 30 s fails it; the sources unbroken 5 min outlast the ward, said as theirs (mutants: the springs\' time; their end unmarked)', () => {
  const s = site(), led = newDelveLedger(s, 'A', 3, T0);
  say(led, 'A', word({ o: 1 }), T0);
  beat(led, 'A', T0, T0 + HOLD_GATHER_MS + SPRING_MAX_MS - 1_000, word({ o: 1 }));
  assert.equal(led.p, DP.spring);
  const ev = say(led, 'A', word({ o: 1 }), T0 + HOLD_GATHER_MS + SPRING_MAX_MS);
  assert.deepEqual(ev, [{ k: 'failed', outlasted: true, springs: true }]);
  const L = newDelveLedger(s, 'A', 3, T0);
  say(L, 'A', word({ o: 1 }), T0);
  assert.deepEqual(stepDelve(L, T0 + DELVE_LEAVE_MS), [{ k: 'failed' }]);
});

test('DLV4 THE VIGIL, WHOLE: the relic wakes, three waves as the Hold\'s, a breath\'s fifteen light back, the third wave\'s end the win - no captain (mutants: a captain after the vigil; the breath\'s light dropped)', () => {
  const s = site({ kind: 'vigil' }), led = newDelveLedger(s, 'A', 3, T0);
  assert.equal(led.lt, 100);
  say(led, 'A', word({ o: 1 }), T0);
  let t = T0 + HOLD_GATHER_MS;
  assert.deepEqual(say(led, 'A', word({ o: 1 }), t), [{ k: 'wave', w: 1, wz: holdWaveSize(1, 1) }]);
  say(led, 'A', word({ o: 1, hb: 6 }), t + 1);
  assert.equal(led.lt, 94, 'six blows: six light');
  t += starClearFloorMs(led.wz, 1);
  assert.deepEqual(say(led, 'A', word({ o: 1, kw: 1, kn: led.wz, wc: 1, hb: 6 }), t), [{ k: 'breath', w: 1 }]);
  assert.equal(led.lt, 100, 'the breath steadies it - never past full');
  for (let w = 2; w <= 3; w++) {
    t += HOLD_BREATH_MS;
    assert.equal(say(led, 'A', word({ o: 1, hb: 6 }), t)[0].k, 'wave');
    t += starClearFloorMs(led.wz, 1);
    const ev = say(led, 'A', word({ o: 1, kw: w, kn: led.wz, wc: w, hb: 6 }), t);
    if (w < 3) assert.deepEqual(ev, [{ k: 'breath', w }]);
    else assert.deepEqual(ev, [{ k: 'won', earned: ['A'] }], 'the third wave\'s end: won, no captain');
  }
});

test('DLV4 THE VIGIL\'S LIGHT: the foes\' blows believed at the Starfall\'s rate, the light gone fails it dark with a minute\'s rest; a wave run out gives way, the last one\'s end still the win (mutants: the rate unbounded; the rest dropped; the last wave out of time a loss)', () => {
  const s = site({ kind: 'vigil' }), led = newDelveLedger(s, 'A', 3, T0);
  say(led, 'A', word({ o: 1 }), T0);
  stepDelve(led, T0 + HOLD_GATHER_MS);
  say(led, 'A', word({ o: 1, hb: 500 }), T0 + HOLD_GATHER_MS + 1);
  assert.equal(led.lt, 100 - STAR_BLOWS_BURST, 'a burst at once, no more');
  say(led, 'B', word({ o: 0, hb: 500 }), T0 + HOLD_GATHER_MS + 2);
  assert.equal(led.lt, 100 - STAR_BLOWS_BURST, 'not the foes\' machine: no light taken');
  let ev = [], t = T0 + HOLD_GATHER_MS;
  for (let n = 1; n < 60 && led.p !== DP.idle; n++) { t += 1_000; ev = say(led, 'A', word({ o: 1, hb: 500 + n }), t); }
  assert.deepEqual(ev, [{ k: 'failed', dark: true, rest: VIGIL_REST_MS }]);
  // a wave that runs out its time gives way; past the third, the win
  const L = newDelveLedger(s, 'A', 3, T0);
  say(L, 'A', word({ o: 1 }), T0);
  let last = [];
  for (let q = T0; q <= T0 + HOLD_GATHER_MS + 3 * (HOLD_WAVE_MAX_MS + HOLD_BREATH_MS); q += 5_000) { last = say(L, 'A', word({ o: 1 }), q); if (L.p === DP.won) break; }
  assert.equal(L.p, DP.won); assert.equal(last.at(-1).k, 'won');
});

test('DLV4 THE VIGIL HANDED ON: each machine\'s blows are counted from its own nothing - a member who takes over the foes says its own count, and it is credited (AUDIT DLV4 F6; mutants: one count for every machine)', () => {
  const s = site({ kind: 'vigil' }), led = newDelveLedger(s, 'A', 3, T0);
  say(led, 'A', word({ o: 1 }), T0); say(led, 'B', word(), T0);
  stepDelve(led, T0 + HOLD_GATHER_MS);
  let t = T0 + HOLD_GATHER_MS;
  say(led, 'A', word({ o: 1, hb: 4 }), t += 1_000);
  assert.equal(led.lt, 100 - 4 * VIGIL_BLOW_LIGHT);
  say(led, 'A', word({ o: 0, hb: 4 }), t += 1_000);   // A stands them no longer
  say(led, 'B', word({ o: 1, hb: 0 }), t += 10);
  say(led, 'B', word({ o: 1, hb: 3 }), t += 1_000);
  assert.equal(led.lt, 100 - 7 * VIGIL_BLOW_LIGHT, 'B\'s three from its own nothing');
});

test('DLV4 THE RITE\'S FOES DRIFT IN off the rim: half a metre in on the axes the vault does not take - never on a gate, where a brazier\'s pedestal stands (AUDIT DLV4 F10; mutants: a gate\'s spot; the vault\'s axis)', () => {
  const s = site({ kind: 'brazier' }), d = driftSpots(s);
  assert.equal(d.length, 3);
  for (const p of d) {
    assert.ok(Math.abs(Math.hypot(p[0] - s.x, p[2] - s.z) - (s.r - 0.5)) < 0.011, 'on the rim, half a metre in');
    assert.ok(holdGates(s).every((g) => Math.hypot(g[0] - p[0], g[2] - p[2]) > 2), 'clear of every gate');
  }
  const v = s.vault, toward = (p) => (p[0] - s.x) * (v[0] - s.x) + (p[2] - s.z) * (v[2] - s.z);
  assert.ok(d.every((p) => toward(p) <= 0.01), 'none on the vault\'s axis');
});

test('DLV4 THE BRAZIER RITE, WHOLE: it rises 3 s, its braziers counted by the party then; the flame taken at the heart, carried no faster than the fastest runner bearing it, lights a brazier in reach, and goes back to the heart; every brazier lit wins (mutants: the count read early; the step law skipped; a lit brazier lit again; the flame kept after lighting)', () => {
  const s = site({ kind: 'brazier' }), led = newDelveLedger(s, 'A', 3, T0);
  assert.deepEqual(say(led, 'A', word(), T0), [{ k: 'gather' }]);
  for (const m of ['B', 'C', 'D']) say(led, m, word(), T0 + 1_000);
  assert.deepEqual(stepDelve(led, T0 + PUZZLE_RISE_MS), [{ k: 'work', n: 4 }], 'four in the ward: four braziers');
  assert.equal(led.p, DP.work);
  const heart = [s.x, s.y, s.z], b = brazierSpots(s, 4);
  let t = T0 + PUZZLE_RISE_MS;
  assert.deepEqual(act(led, s, 'A', 'take', -1, [heart[0] + 1.5, heart[1], heart[2]], t), [], 'out of reach of the flame');
  assert.deepEqual(act(led, s, 'A', 'take', -1, heart, t), [{ k: 'take' }]);
  assert.equal(delveCarrier(led), 'A');
  assert.deepEqual(act(led, s, 'B', 'take', -1, heart, t + 1), [], 'one flame, one carrier');
  const least = ktLeastMs(Math.hypot(b[0][0] - heart[0], b[0][2] - heart[2]), true);
  assert.deepEqual(act(led, s, 'A', 'light', 0, b[0], t + Math.floor(least) - 1), [], 'faster than any runner could carry it');
  assert.deepEqual(act(led, s, 'A', 'light', 0, b[0], t + Math.ceil(least)), [{ k: 'light', j: 0 }]);
  assert.equal(led.fl, FLAME.heart, 'the flame back at the heart');
  assert.equal(led.lb, 1);
  t += 2_000;
  for (let j = 1; j < 4; j++) {
    say(led, 'A', word(), t); say(led, 'B', word(), t);
    assert.deepEqual(act(led, s, 'B', 'take', -1, heart, t), [{ k: 'take' }]);
    assert.deepEqual(act(led, s, 'B', 'light', 0, b[0], t + 2_000), [], 'a lit brazier is lit already');
    const ev = act(led, s, 'B', 'light', j, b[j], t + 2_000);
    assert.equal(ev[0].k, 'light');
    t += 3_000;
    if (j === 3) assert.deepEqual(ev[1], { k: 'won', earned: ['A', 'B', 'C', 'D'] }, 'C and D heard in the ward 15 s before: earned, at the window\'s edge');
  }
});

test('DLV4 THE FLAME\'S CLOCK AND FALL: carried 20 s it gutters back to the heart; a carrier struck lets it fall where it stands, where it lies 10 s to be taken up, then gutters; a puzzle silent 60 s lets go (mutants: the life; the lie; the drop at the heart)', () => {
  const s = site({ kind: 'brazier' }), led = newDelveLedger(s, 'A', 3, T0);
  say(led, 'A', word(), T0); stepDelve(led, T0 + PUZZLE_RISE_MS);
  let t = T0 + PUZZLE_RISE_MS;
  act(led, s, 'A', 'take', -1, [s.x, s.y, s.z], t);
  beat(led, 'A', t, t + FLAME_LIFE_MS - 1_000);
  assert.equal(led.fl, FLAME.carried);
  assert.deepEqual(say(led, 'A', word(), t + FLAME_LIFE_MS), [{ k: 'gutter' }]);
  assert.equal(led.fl, FLAME.heart);
  t += FLAME_LIFE_MS + 1_000;
  act(led, s, 'A', 'take', -1, [s.x, s.y, s.z], t);
  assert.deepEqual(act(led, s, 'A', 'drop', -1, [12, s.y, 21], t + 500), [{ k: 'drop' }]);
  assert.equal(led.fl, FLAME.lying); assert.deepEqual(led.fx, [12, s.y, 21]);
  assert.deepEqual(delveState(led, t + 500).fx, [12, s.y, 21]);
  assert.deepEqual(act(led, s, 'B', 'take', -1, [s.x, s.y, s.z], t + 600), [], 'not at the heart: where it fell');
  say(led, 'B', word(), t + 600);
  assert.deepEqual(act(led, s, 'B', 'take', -1, [12.5, s.y, 21], t + 700), [{ k: 'take' }], 'taken up where it lies');
  act(led, s, 'B', 'drop', -1, [12, s.y, 21], t + 800);
  beat(led, 'B', t + 800, t + 800 + FLAME_LIES_MS - 1_000);
  assert.equal(led.fl, FLAME.lying);
  assert.deepEqual(say(led, 'B', word(), t + 800 + FLAME_LIES_MS), [{ k: 'gutter' }]);
  assert.deepEqual(stepDelve(led, t + 800 + FLAME_LIES_MS + DELVE_LET_GO_MS), [{ k: 'let' }]);
});

test('DLV4 THE WEIGHING, WHOLE: a weight taken at its home, carried no faster than a runner bearing it, set on a free plate; a member on a plate holds it while their word is fresh; all three held 3 s wins, any let go starts the count again - one player can carry two and stand on the third (mutants: the hold\'s time; a stale word holding; a set on a taken plate; the count kept after a let-go)', () => {
  const s = site({ kind: 'weighing' }), led = newDelveLedger(s, 'A', 3, T0);
  assert.deepEqual(say(led, 'A', word(), T0), [{ k: 'work', n: 3 }], 'no rising: three plates, three weights');
  const homes = weightSpots(s), plates = weighPlates(s);
  let t = T0;
  assert.deepEqual(act(led, s, 'A', 'take', 0, homes[0], t += 100), [{ k: 'take', j: 0 }]);
  assert.deepEqual(act(led, s, 'A', 'take', 1, homes[1], t += 100), [], 'one weight in the hands at a time');
  assert.equal(delveCarrier(led, 0), 'A');
  const least = ktLeastMs(Math.hypot(plates[0][0] - homes[0][0], plates[0][2] - homes[0][2]), true);
  assert.deepEqual(act(led, s, 'A', 'set', -1, plates[0], T0 + 100 + Math.floor(least) - 1), [], 'set down sooner than it could be carried there');
  t = T0 + 100 + Math.ceil(least) + 500;
  say(led, 'A', word(), t);
  assert.deepEqual(act(led, s, 'A', 'set', -1, plates[0], t), [{ k: 'set', j: 0, p: 0 }]);
  t += 1_000;
  act(led, s, 'A', 'take', 1, homes[1], t);
  say(led, 'A', word(), t + 5_000);
  assert.deepEqual(act(led, s, 'A', 'set', -1, plates[0], t + 5_000), [{ k: 'set', j: 1, p: -1 }], 'a plate already weighted: set down on the floor');
  assert.equal(led.wt[1].s, WEIGHT.floor);
  t += 6_000;
  act(led, s, 'A', 'take', 1, [led.wt[1].x, s.y, led.wt[1].z], t);
  say(led, 'A', word(), t + 4_000);
  act(led, s, 'A', 'set', -1, plates[1], t + 4_000);
  t += 5_000;
  // A stands on the third plate: held while A's word from it is fresh
  const on = (q) => say(led, 'A', word(), q, { plate: 2 });
  assert.deepEqual(on(t), [{ k: 'held' }]);
  assert.deepEqual(on(t + 1_000), []);
  assert.deepEqual(say(led, 'A', word(), t + 2_000, { plate: -1 }), [{ k: 'unheld' }], 'stepped off: the count stops');
  on(t + 2_500);
  on(t + 3_500); on(t + 4_500);
  assert.equal(led.p, DP.work, 'two seconds again: not yet');
  const ev = on(t + 5_500);
  assert.deepEqual(ev, [{ k: 'won', earned: ['A'] }], 'three seconds held: won by one player');
  // a word gone stale lets the plate go
  const L = newDelveLedger(s, 'A', 3, T0);
  say(L, 'A', word(), T0, { plate: 0 }); say(L, 'B', word(), T0, { plate: 1 }); say(L, 'C', word(), T0, { plate: 2 });
  assert.equal(L.hs, 0);
  assert.deepEqual(stepDelve(L, T0 + WEIGH_FRESH_MS + 1), [{ k: 'unheld' }], 'three words older than 2.5 s hold nothing');
});

test('DLV4 THE SEALS, WHOLE: they rise 3 s, counted and sized by the party then; broken within the window they win; the window run out they sink 10 s and rise again, counted anew (mutants: the window; the sink\'s rest; the count read early; a seal past reach struck)', () => {
  const s = site({ kind: 'seals', vault: [10, -2, 20] }), led = newDelveLedger(s, 'A', 3, T0);
  assert.deepEqual(say(led, 'A', word(), T0), [{ k: 'gather' }]);
  say(led, 'B', word(), T0 + 500); say(led, 'C', word(), T0 + 500);
  const ev = stepDelve(led, T0 + PUZZLE_RISE_MS);
  assert.deepEqual(ev, [{ k: 'seals', n: sealCount(3), h: sealHp([10, 10, 10], sealCount(3)), wl: sealWindowMs(sealCount(3)) }]);
  assert.equal(delvePhaseLeft(led), sealWindowMs(4));
  const spots = sealSpots(s, led.k);
  let t = T0 + PUZZLE_RISE_MS;
  assert.deepEqual(hit(led, s, 'A', 0, 1e6, t + 10, { pose: [spots[0][0] + 7, s.y, spots[0][2]] }), []);
  // the window runs out: they sink, then rise again
  beat(led, 'A', t, t + sealWindowMs(4) - 1_000);
  assert.equal(led.p, DP.work);
  assert.deepEqual(say(led, 'A', word(), t + sealWindowMs(4)), [{ k: 'sink' }]);
  assert.equal(led.p, DP.sunk); assert.deepEqual(led.hp, []);
  t += sealWindowMs(4);
  beat(led, 'A', t, t + SEAL_SINK_MS - 1_000);
  assert.equal(led.p, DP.sunk);
  const again = say(led, 'A', word(), t + SEAL_SINK_MS);
  assert.deepEqual(again, [{ k: 'seals', n: 3, h: sealHp([10], 3), wl: sealWindowMs(3) }], 'risen again for the one still there');
  t += SEAL_SINK_MS;
  for (let j = 0; j < 3; j++) {
    for (let n = 0; led.hp[j] > 0 && n < 50; n++) { t += 400; say(led, 'A', word(), t); hit(led, s, 'A', j, 1e6, t + 1, { pose: spots[j] }); }
  }
  assert.equal(led.p, DP.won);
});

test('DLV4 A BLOW\'S CAPS: a member\'s hand (four blows a second) and purse (fifteen seconds of their reference damage, three a second back), a shaft or a spell from anywhere in the ward, nothing on a piece already broken (mutants: the hand unread; a shaft held to a swing\'s reach)', () => {
  const s = site(), led = newDelveLedger(s, 'A', 3, T0);
  say(led, 'A', word({ o: 1, lv: 10 }), T0);
  stepDelve(led, T0 + HOLD_GATHER_MS);
  const spot = springSpots(s, led.k)[0], t = T0 + HOLD_GATHER_MS, far = [2 * s.x - spot[0], s.y, 2 * s.z - spot[2]], hp0 = led.hp[0];
  assert.ok(Math.hypot(far[0] - spot[0], far[2] - spot[2]) - SPRING_R > MELEE_REACH + POSE_SLACK, 'across the ward: past a swing\'s reach');
  hit(led, s, 'A', 0, 10, t + 1, { pose: far, hit: { r: HIT_KINDS.Shaft } });
  assert.equal(led.hp[0], hp0 - 10, 'a shaft from across the ward');
  for (let k = 0; k < 8; k++) hit(led, s, 'A', 0, 10, t + 2 + k, { pose: far, hit: { r: HIT_KINDS.Spell, q: 100 + k } });
  assert.equal(led.hp[0], hp0 - 10 - 30, 'a hand of four, three left in it: the rest refused');
  assert.ok(led.a.A.bucket < BUCKET_DEPTH_X * dpsRef(10));
});

test('DLV4 A LEVEL FOR THE ATTEMPT: an account\'s level is the one its record was made at - a word may say it lower, never higher, so the pieces sized as they rise and the purse its blows spend read one level (AUDIT DLV4 F4; mutants: a level raised mid-attempt)', () => {
  const s = site(), led = newDelveLedger(s, 'A', 3, T0);
  say(led, 'A', word({ o: 1, lv: 1 }), T0);
  stepDelve(led, T0 + HOLD_GATHER_MS);
  assert.equal(led.hx, springHp([1]));
  say(led, 'A', word({ o: 1, lv: 60 }), T0 + HOLD_GATHER_MS + 10);
  assert.equal(led.a.A.lv, 1, 'never raised while it stands');
  hit(led, s, 'A', 0, 1e6, T0 + HOLD_GATHER_MS + 20, { pose: springSpots(s, led.k)[0] });
  assert.equal(led.hp[0], springHp([1]) - HIT_CAP_X * dpsRef(1), 'its blow capped at the level it rose at');
  say(led, 'A', word({ o: 1, lv: 0 }), T0 + HOLD_GATHER_MS + 30);
  assert.equal(led.a.A.lv, 1, 'nor under one');
});

test('DLV4 THE FLAME LET FALL: taken up where it lies, it keeps its life off the heart and the walk from it - a fall and a taking up again light no brazier sooner, and a blow every few seconds never renews it (AUDIT DLV4 F1, F3; mutants: the life renewed at a taking up; the walk from where it fell)', () => {
  const s = site({ kind: 'brazier' }), led = newDelveLedger(s, 'A', 3, T0), heart = [s.x, s.y, s.z];
  say(led, 'A', word({ lv: 10 }), T0);
  let t = T0 + PUZZLE_RISE_MS;
  say(led, 'A', word({ lv: 10 }), t);
  const b = brazierSpots(s, led.k)[0];
  act(led, s, 'A', 'take', -1, heart, t += 10);
  assert.equal(led.fl, FLAME.carried);
  act(led, s, 'A', 'drop', -1, b, t += 5);   // a lying pose at the brazier
  act(led, s, 'A', 'take', -1, b, t += 5);
  assert.deepEqual(act(led, s, 'A', 'light', 0, b, t += 5), [], 'its walk still the heart\'s: lit no sooner than a carrier could bring it');
  assert.equal(led.lb, 0);
  // struck every 5 s: its life is still the heart's 20 s
  const t0 = t;
  for (; t < t0 + FLAME_LIFE_MS - 100; t += 5_000) { say(led, 'A', word({ lv: 10 }), t); act(led, s, 'A', 'drop', -1, heart, t + 1); act(led, s, 'A', 'take', -1, heart, t + 2); }
  const ev = say(led, 'A', word({ lv: 10 }), t0 - 25 + FLAME_LIFE_MS + 10);
  assert.ok(ev.some((e) => e.k === 'gutter'), 'guttered at its life off the heart');
  assert.equal(led.fl, FLAME.heart);
});

test('DLV4 A PIECE CARRIED OUT OF THE WARD goes home: a word or a let-go from outside it sends the flame to the heart and a weight to its home - nobody stays burdened past the ward; a carrier silent 15 s loses it so (AUDIT DLV4 F2; mutants: the word out of the ward unread; the let-go out of the ward refused; the silent carrier kept)', () => {
  const s = site({ kind: 'brazier' }), led = newDelveLedger(s, 'A', 3, T0), heart = [s.x, s.y, s.z];
  say(led, 'A', word(), T0); say(led, 'A', word(), T0 + PUZZLE_RISE_MS);
  act(led, s, 'A', 'take', -1, heart, T0 + PUZZLE_RISE_MS + 10);
  assert.deepEqual(say(led, 'A', word(), T0 + PUZZLE_RISE_MS + 500, { inWard: false }), [{ k: 'gutter' }], 'a word from outside the ward: the flame home');
  assert.equal(led.fl, FLAME.heart);
  act(led, s, 'A', 'take', -1, heart, T0 + PUZZLE_RISE_MS + 600);
  assert.deepEqual(foldDelveAct(led, s, 'A', { a: 'drop', j: -1 }, { party: true, inWard: false, pose: [s.x + 9, s.y, s.z], nowMs: T0 + PUZZLE_RISE_MS + 700 }), [{ k: 'gutter' }], 'let go out of the ward: home');
  act(led, s, 'A', 'take', -1, heart, T0 + PUZZLE_RISE_MS + 800);
  say(led, 'B', word(), T0 + PUZZLE_RISE_MS + 900);
  assert.ok(say(led, 'B', word(), T0 + PUZZLE_RISE_MS + 800 + 15_001).some((e) => e.k === 'gutter'), 'its carrier silent 15 s: home');
  const g = site({ kind: 'weighing' }), lw = newDelveLedger(g, 'A', 3, T0), home = weightSpots(g)[0];
  say(lw, 'A', word(), T0);
  act(lw, g, 'A', 'take', 0, home, T0 + 10);
  assert.equal(lw.wt[0].s, WEIGHT.carried);
  assert.deepEqual(say(lw, 'A', word(), T0 + 500, { inWard: false }), [{ k: 'back', j: 0 }], 'a weight carried out: home');
  assert.equal(lw.wt[0].s, WEIGHT.home);
  act(lw, g, 'A', 'take', 0, home, T0 + 600);
  say(lw, 'B', word(), T0 + 700);
  assert.ok(say(lw, 'B', word(), T0 + 500 + 15_001).some((e) => e.k === 'back'), 'its carrier silent: home');
});

test('DLV4 A POSE IS THREE NUMBERS: the game\'s feet are a motor\'s Float32Array, and a blow or an act from one is read as any other; a pose with no number in it is no pose - a NaN walks past no reach (mutants: a typed array refused; the pose\'s numbers unread)', () => {
  const s = site(), led = newDelveLedger(s, 'A', 3, T0);
  say(led, 'A', word({ o: 1 }), T0); stepDelve(led, T0 + HOLD_GATHER_MS);
  const q = springSpots(s, led.k)[0], hp0 = led.hp[0];
  hit(led, s, 'A', 0, 5, T0 + HOLD_GATHER_MS + 1, { pose: new Float32Array(q) });
  assert.equal(led.hp[0], hp0 - 5, 'the motor\'s own feet');
  hit(led, s, 'A', 0, 5, T0 + HOLD_GATHER_MS + 300, { pose: [NaN, s.y, NaN] });
  assert.equal(led.hp[0], hp0 - 5, 'a NaN pose: nothing');
  const b = site({ kind: 'brazier' }), lb = newDelveLedger(b, 'A', 3, T0);
  say(lb, 'A', word(), T0); say(lb, 'A', word(), T0 + PUZZLE_RISE_MS);
  act(lb, b, 'A', 'take', -1, new Float32Array([b.x, b.y, b.z]), T0 + PUZZLE_RISE_MS + 10);
  assert.equal(lb.fl, FLAME.carried, 'an act from the motor\'s feet');
});

test('DLV4 THE SCREEN\'S STATE BY KIND: each kind says its own pieces, no account named; the Hold\'s shape untouched (mutants: a kind\'s field missing; the carrier named)', () => {
  const W = newDelveLedger(site(), 'acct-1', 3, T0);
  say(W, 'acct-1', word({ o: 1 }), T0); stepDelve(W, T0 + HOLD_GATHER_MS);
  const ws = delveState(W, T0 + HOLD_GATHER_MS);
  assert.deepEqual([ws.kd, ws.p, ws.n, ws.h.length, ws.hx], [3, DP.spring, W.k, W.k, springHp([10])]);
  const V = newDelveLedger(site({ kind: 'vigil' }), 'acct-1', 3, T0);
  assert.equal(delveState(V, T0).lt, 100);
  const B = newDelveLedger(site({ kind: 'brazier' }), 'acct-1', 3, T0);
  say(B, 'acct-1', word(), T0); stepDelve(B, T0 + PUZZLE_RISE_MS);
  act(B, site({ kind: 'brazier' }), 'acct-1', 'take', -1, [10, -2, 20], T0 + PUZZLE_RISE_MS);
  const bs = delveState(B, T0 + PUZZLE_RISE_MS);
  assert.deepEqual([bs.n, bs.lb, bs.fl, bs.fx], [3, 0, FLAME.carried, []]);
  assert.ok(!JSON.stringify(bs).includes('acct'), 'the carrier never named');
  const G = newDelveLedger(site({ kind: 'weighing' }), 'acct-1', 3, T0);
  say(G, 'acct-1', word(), T0);
  assert.deepEqual(delveState(G, T0).wt, [[0, -1, 0, 0], [0, -1, 0, 0], [0, -1, 0, 0]]);
  assert.equal(delveState(G, T0).hd, -1);
  const H = newDelveLedger(site({ kind: 'hold' }), 'acct-1', 3, T0);
  assert.deepEqual(Object.keys(delveState(H, T0)), ['k', 's', 'kd', 'p', 'w', 'wz', 'kn', 'wl', 'nd', 'fo', 'nx']);
});

test('DLV4 A STRANGER AND A STRANGER\'S HANDS: no act or blow from outside the party, from outside the ward, or from a member never heard, moves anything (mutants: the party unread on an act; an act with no record; the ward unread on a blow)', () => {
  const s = site({ kind: 'brazier' }), led = newDelveLedger(s, 'A', 3, T0);
  say(led, 'A', word(), T0); stepDelve(led, T0 + PUZZLE_RISE_MS);
  assert.deepEqual(act(led, s, 'A', 'take', -1, [10, -2, 20], T0 + PUZZLE_RISE_MS, { party: false }), []);
  assert.deepEqual(act(led, s, 'A', 'take', -1, [10, -2, 20], T0 + PUZZLE_RISE_MS, { inWard: false }), []);
  assert.deepEqual(act(led, s, 'Q', 'take', -1, [10, -2, 20], T0 + PUZZLE_RISE_MS + 1), [], 'of the party, but no word heard from it yet: no record, no hands');
  assert.equal(led.fl, FLAME.heart);
  const W = newDelveLedger(site(), 'A', 3, T0);
  say(W, 'A', word({ o: 1 }), T0); stepDelve(W, T0 + HOLD_GATHER_MS);
  const hp = W.hp[0];
  hit(W, site(), 'A', 0, 10, T0 + HOLD_GATHER_MS + 1, { ctx: { inWard: false } });
  hit(W, site(), 'A', 0, 10, T0 + HOLD_GATHER_MS + 2, { ctx: { party: false } });
  assert.equal(W.hp[0], hp);
  assert.equal(plateAt(weighPlates(s), 10, -2, 23), 0);
});
