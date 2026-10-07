// FLIGHT-FIRST (bible/06-Systems/Revenants.md section 38; Mac, 2026-10-07: "revenants often can easily be killed and
// recruited at rank 1 and player death advances their rank. Player death shouldnt be the common way of revenant growth,
// it should be more common for revenants to flee instead of being easily captured"). Measured before (tools/tellDuel.mjs,
// a Longsword, 300 fights a rank): ranks 1 and 2 knelt in every fight, and the one in ten that ran was brought down
// as it ran - no flight ever escaped, so the only deed that ranked a young revenant up was killing the player. Three
// causes: its roll (15%, at a fifth of its health a blow often carried it past), its run (its walk, 4.5-6 m/s, under a
// running player's 8.1) and a fault in the motor - a foe that broke while circling or backing off kept the brain's step
// (`_tacDir`) and ran on round the ring at the brain's pace. Now a revenant under its will's rank breaks at 35% on an
// 80% roll, every special foe's run is twice its walk, a run spent past 12 m is an escape, and the flee drops the
// brain's step. Pinned: the roll and the line by rank, the run's pace through a real motor, the step dropped, the
// cornered line, and the fight measured - a young revenant gets away more often than it kneels, a fast runner still
// runs it down, the will's ranks unmoved.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const N = await import('../src/systems/revenant.js');
const F = await import('../src/systems/revenantFeud.js');
const H = await import('../tools/tellDuel.mjs');
const { EnemyAI } = await import('../src/characters/enemyMotor.js');
const { Collider } = await import('../src/player/collider.js');
const { runSpeed } = await import('../src/player/motor.js');
const { setPref } = await import('../src/systems/uiPrefs.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');

setPref('lootRarity', true);
const orc = (over = {}) => ({ mobileType: M.Orc, level: 10, health: 60, maxHealth: 60, team: 'Monster', champion: 'mighty', ...over });
const rev = (rank, over = {}) => orc({ champion: undefined, revenant: { id: `ff-${rank}`, rank }, ...over });
const SEEDS = (n) => Array.from({ length: n }, (_, i) => 1 + i);
const fights = (opts, n) => SEEDS(n).map((seed) => H.revenantFight({ weapon: 'Longsword', mode: 'trade', ...opts, seed }));

test('FLIGHT-FIRST THE ROLL AND THE LINE: an elite or a champion runs at a fifth on 5%; a revenant under its will\'s rank at 35% on 80%; from its will\'s rank at a fifth on 15% (mutants: the young roll the old one\'s; the young line the old one\'s; the will\'s rank read as young)', () => {
  assert.deepEqual([N.REVENANT_FLEE_HEALTH, N.REVENANT_FLEE_HEALTH_YOUNG], [0.2, 0.35]);
  assert.deepEqual([N.REVENANT_FLEE_CHANCE, N.REVENANT_FLEE_CHANCE_YOUNG, N.REVENANT_FLEE_CHANCE_REVENANT], [0.05, 0.8, 0.15]);
  assert.equal(F.WILL_RANK, 3);
  const runs = (e, roll) => N.rollRevenantFlee(e, () => roll);
  assert.deepEqual([runs(orc(), 0.049), runs(orc(), 0.051)], [true, false], 'a champion: its very small chance');
  for (const rank of [1, 2]) assert.deepEqual([runs(rev(rank), 0.79), runs(rev(rank), 0.81)], [true, false], `rank ${rank}: its flight is its way out`);
  for (const rank of [3, 4, 5]) assert.deepEqual([runs(rev(rank), 0.149), runs(rev(rank), 0.151)], [true, false], `rank ${rank}: its will is`);
  const under = (e, share) => N.revenantFleeHealth({ ...e, health: e.maxHealth * share });
  assert.deepEqual([under(orc(), 0.19), under(orc(), 0.21)], [true, false], 'a champion: a fifth');
  for (const rank of [1, 2]) assert.deepEqual([under(rev(rank), 0.34), under(rev(rank), 0.36)], [true, false], `rank ${rank}: 35%`);
  for (const rank of [3, 5]) assert.deepEqual([under(rev(rank), 0.19), under(rev(rank), 0.21)], [true, false], `rank ${rank}: a fifth`);
  assert.equal(under(rev(1), 0), false, 'a dead one never');
});

test('FLIGHT-FIRST THE RUN: the flee law starts the motor\'s run at REVENANT_FLEE_PACE - twice its walk, through a real motor; every other run (the watch, a scattered band) at its walk (mutants: the pace unpassed; the motor\'s walk unpaced; the pace kept past a later run)', () => {
  assert.equal(N.REVENANT_FLEE_PACE, 2);
  const asked = [];
  const f = { entity: rev(1, { health: 10 }), ai: { feet: [0, 0, 0], isHostile: true, fleeLeft: 0, flee(...a) { asked.push(a); this.fleeLeft = a[1]; } } };
  assert.equal(N.revenantFleeStep(f, [0, 0, 0], { rolls: () => 0 }), 'start');
  assert.deepEqual(asked, [[[0, 0, 0], N.REVENANT_FLEE_SECONDS, N.REVENANT_FLEE_PACE]]);
  const ran = (pace) => {
    const ai = new EnemyAI(new Collider(() => 0), [0, 0, 4], 0, { vitals: () => orc(), liveSpeed: () => 50 });
    if (pace == null) ai.flee([0, 0, 0], 4); else ai.flee([0, 0, 0], 4, pace);
    for (let i = 0; i < 120; i++) ai.update(1 / 60, [0, 0, 0]);
    return { z: ai.feet[2] - 4, speed: ai.speed, pace: ai.fleePace };
  };
  const walk = ran(), run = ran(N.REVENANT_FLEE_PACE);
  assert.equal(walk.pace, 1);
  assert.ok(walk.z > walk.speed * 1.9 && walk.z <= walk.speed * 2, `its walk: ${walk.z.toFixed(2)} m in 2 s (its first classic tick still)`);
  assert.ok(Math.abs(run.z / walk.z - 2) < 0.01, `running for its life: ${run.z.toFixed(2)} m, twice its walk`);
  assert.ok(run.speed * N.REVENANT_FLEE_PACE > runSpeed(50, 50), 'faster than a player running at Speed and Running 50');
  const again = new EnemyAI(new Collider(() => 0), [0, 0, 4], 0, { vitals: () => orc(), liveSpeed: () => 50 });
  again.flee([0, 0, 0], 1, 2); again.flee([0, 0, 0], 1);
  assert.equal(again.fleePace, 1, 'a later run at its walk again');
});

test('FLIGHT-FIRST THE FAULT: a foe that breaks while the brain steps it (round the ring, backing off) runs straight away - the flee drops the brain\'s step (mutants: the step kept)', () => {
  const ai = new EnemyAI(new Collider(() => 0), [0, 0, 4], 0, { vitals: () => orc(), liveSpeed: () => 50 });
  ai._tacDir = [1, 0]; ai._tacSpeed = 0.5;   // TACT2's ring: sideways, at half its walk
  ai.flee([0, 0, 0], 4, N.REVENANT_FLEE_PACE);
  assert.equal(ai._tacDir, null);
  assert.equal(ai._tacSpeed, 1);
  for (let i = 0; i < 60; i++) ai.update(1 / 60, [0, 0, 0]);
  assert.ok(Math.abs(ai.feet[0]) < 0.01, `no sideways step (${ai.feet[0].toFixed(3)})`);
  assert.ok(ai.feet[2] - 4 > ai.speed * N.REVENANT_FLEE_PACE * 0.9, `away at its run (${(ai.feet[2] - 4).toFixed(2)} m in 1 s)`);
});

test('FLIGHT-FIRST THE CORNER: its run spent within 12 m it is cornered, past it escaped (mutants: the line moved back to 20)', () => {
  assert.equal(N.REVENANT_ESCAPE_NEAR, 12);
  const spent = (d) => {
    const f = { entity: rev(1, { health: 10 }), ai: { feet: [0, 0, 0], isHostile: true, fleeLeft: 0, flee(_, s) { this.fleeLeft = s; } } };
    N.revenantFleeStep(f, [0, 0, 0], { rolls: () => 0 });
    f.ai.fleeLeft = 0;
    return N.revenantFleeStep(f, [d, 0, 0]);
  };
  assert.deepEqual([spent(11.9), spent(12.1), spent(19)], ['cornered', 'escape', 'escape']);
});

test('FLIGHT-FIRST THE FIGHT: a young revenant fought with a Longsword gets away more often than it kneels, and every flight a runner at Speed and Running 50 chases escapes; a fast runner still runs it down; from rank 3 the will still decides (mutants: the young roll the old one\'s; the pace unpassed; the step kept; the line moved back to 20)', () => {
  for (const rank of [1, 2]) {
    const rows = fights({ rank }, 40);
    const fled = rows.filter((x) => x.end === 'fled').length, knelt = rows.filter((x) => x.end === 'knelt').length;
    assert.ok(fled > knelt, `rank ${rank}: fled ${fled}, knelt ${knelt}`);
    assert.ok(rows.filter((x) => x.flight).every((x) => x.end === 'fled'), `rank ${rank}: every flight escapes`);
  }
  const fast = fights({ rank: 1, runner: runSpeed(90, 90) }, 40).filter((x) => x.flight);
  assert.ok(fast.length > 0 && fast.every((x) => x.end === 'knelt'), 'a fast runner runs every one down');
  assert.ok(fast.some((x) => x.caught), 'brought down as it runs (`caught`)');
  const will = fights({ rank: 3 }, 40);
  assert.ok(will.filter((x) => x.end === 'tore').length > will.filter((x) => x.end === 'knelt').length, 'rank 3, trading blows: its will mostly holds');
});

test('FLIGHT-FIRST THE MEASURE: the will\'s targets read the fights its will decided - a flight that got away decided nothing; a rank\'s weight is read off ranks 1 and 5 never running (mutants: the will read off every fight; a fled fight counted as decided; the weight read off the running cells; the weight\'s cells running)', () => {
  const c = H.revenantCell({ weapon: 'Longsword', mode: 'trade', rank: 1 }, 12);
  assert.ok(c.fled > 0 && c.knelt > 0, 'the cell holds both');
  assert.equal(c.will, +(c.knelt / (c.knelt + c.tore)).toFixed(3));
  const cell = (mode, weak, kneel, will) => ({ weapon: 'Longsword', mode, weak, kneel, will, raw: { mean: 10, hitsOnMe: 1 } });
  const byRank = (m1, m5) => ['trade', 'dodge'].flatMap((mode) => [1, 2, 3, 4, 5].map((rank) => ({ mode, rank, raw: { mean: rank === 5 ? m5 : m1, hitsOnMe: 0 } })));
  const v = H.feudVerdict([cell('trade', false, 0.08, 0.1), cell('dodge', false, 0.6, 0.8), cell('trade', true, 0.85, 0.95)], byRank(10, 16), byRank(6, 15));
  assert.deepEqual([v.WILL_WEAK, v.WILL_DODGE, v.WILL_TRADE].map((x) => [x.kneel, x.held]), [[0.95, true], [0.8, true], [0.1, true]], 'its will read off the fights it decided');
  assert.deepEqual([v.RANKS.trade, v.RANKS.held], [2.5, true], 'rank 5 over rank 1, off the weight\'s cells');
  const m = H.measureFeud({ fights: 2, weapons: ['Longsword'] });
  assert.deepEqual(m.weight.map((x) => `${x.mode}/${x.rank}/${x.flights}`), ['trade/1/0', 'trade/5/0', 'dodge/1/0', 'dodge/5/0'], 'never running');
  assert.equal(m.verdict.RANKS.trade, +(m.weight[1].raw.mean / m.weight[0].raw.mean).toFixed(2), 'the real measure reads them');
});
