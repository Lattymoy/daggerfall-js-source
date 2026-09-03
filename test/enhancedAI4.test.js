// ENHANCED AI 4 - the motor reads the switch.
//
// A real Collider room, baked by AI 3's own bakeNavFromCollider, walked
// by a real EnhancedEnemyAI through its real classic step. The classic
// motor (EnemyAI) is driven through the same room as the control: the
// difference between the two IS the slice.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { bakeNavFromCollider } from '../src/ai/navBake.js';
import {
  EnhancedEnemyAI, makeNavWorld, navWalkable,
  REPATH_INT, REPATH_FAIL, STUCK_T, STUCK_EPS2, STUCK_NUDGE, WP_REACH, PATH_BUDGET_PER_FRAME, PROJECT_MARGIN,
} from '../src/ai/enhancedMotor.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const QUAD = new Uint32Array([0, 1, 2, 0, 2, 3]);
/** addMesh's third argument is a MATRIX, not the index list - the wave34
 *  helper's `I` is the identity, which this file's first draft misread as
 *  indices and fed the collider six vertices of garbage transform. */
const Id = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A 12x12 room with a wall down its middle leaving a gap at one end:
 *  a foe on one side, a target on the other, straight line blocked. */
function room({ gapAt = 'south' } = {}) {
  const c = new Collider(() => -1000);
  const quad = (key, a, b, cc, d) => c.addMesh(key, new Float32Array([...a, ...b, ...cc, ...d]), QUAD, Id);
  quad('floor', [0, 0, 0], [12, 0, 0], [12, 0, 12], [0, 0, 12]);
  // four outer walls, 3 tall
  quad('n', [0, 0, 0], [12, 0, 0], [12, 3, 0], [0, 3, 0]);
  quad('s', [12, 0, 12], [0, 0, 12], [0, 3, 12], [12, 3, 12]);
  quad('w', [0, 0, 12], [0, 0, 0], [0, 3, 0], [0, 3, 12]);
  quad('e', [12, 0, 0], [12, 0, 12], [12, 3, 12], [12, 3, 0]);
  // the divider at x = 6: from z = 0 to z = 9 (gap at the south end)
  const z1 = gapAt === 'south' ? 9 : 12, z0 = gapAt === 'south' ? 0 : 3;
  quad('divA', [5.8, 0, z0], [6.2, 0, z0], [6.2, 3, z0], [5.8, 3, z0]);
  quad('divB', [6.2, 0, z0], [6.2, 0, z1], [6.2, 3, z1], [6.2, 3, z0]);
  quad('divC', [6.2, 0, z1], [5.8, 0, z1], [5.8, 3, z1], [6.2, 3, z1]);
  quad('divD', [5.8, 0, z1], [5.8, 0, z0], [5.8, 3, z0], [5.8, 3, z1]);
  return c;
}

const senses = () => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5 });
/** One classic tick = four 1/60 steps (the motor tests' helper). */
const tick = (ai, target, s = senses()) => { for (let i = 0; i < 4; i++) ai.update(1 / 60, target, s, false); };

function foe(Cls, c, bake, feet, opts = {}) {
  const world = makeNavWorld();
  // rolls pinned: the classic detour picks its hand off `rolls`, which
  // defaults to Math.random - the first draft's classic CONTROL was a
  // coin toss and the round-the-wall pin passed alone and failed in the
  // suite.
  const ai = new Cls(c, [...feet], Math.PI / 2, { liveSpeed: 50, rolls: () => 0.5, nav: () => bake?.chf ?? null, navWorld: world, navSeed: 7, ...opts });
  ai.makeHostileToPlayer();
  return { ai, world };
}

const START = [2, 0, 2], TARGET = [10, 0, 2];   // either side of the divider, near its closed (north) end

test('ENHANCED AI 4: the classic motor is untouched', () => {
  const motor = rd('src/characters/enemyMotor.js');
  // DFU's own EnhancedCombatAI is NAMED in the classic file (its header
  // says it ports the classic path), so the test is for the PORT's
  // enhanced symbols, not the word.
  assert.ok(!/navmesh|findPath|EnhancedEnemyAI|enhancedMotor|navWorld/.test(motor), 'decision #1: enemyMotor.js carries no enhanced code');
  const ours = rd('src/ai/enhancedMotor.js');
  assert.ok(/extends EnemyAI/.test(ours), 'the enhanced motor is a subclass, not a fork');
  assert.ok(!/_classicTick\s*\(/.test(ours.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'it overrides the DESTINATION, not the classic tick');
});

test('ENHANCED AI 4: the constants are project-final\u2019s, verbatim', () => {
  // enemyShared.js:7-12 and enemy.js:402 at project-final 8ba9100.
  assert.equal(REPATH_INT, 0.4); assert.equal(REPATH_FAIL, 0.5);
  assert.equal(STUCK_T, 0.6); assert.equal(STUCK_EPS2, 0.02 * 0.02);
  assert.equal(STUCK_NUDGE, 0.35); assert.equal(WP_REACH, 0.45);
  assert.equal(PATH_BUDGET_PER_FRAME, 3);
  assert.ok(PROJECT_MARGIN > 0 && PROJECT_MARGIN < 0.5, 'adaptation 1\u2019s margin is small and positive');
});

test('ENHANCED AI 4: the bake reads the room, and the divider is in it', () => {
  const c = room();
  const bake = bakeNavFromCollider(c, { anchor: START });
  assert.ok(bake && bake.chf, 'the room bakes');
  assert.ok(navWalkable(bake.chf, 2, 2), 'the foe\u2019s side is walkable');
  assert.ok(navWalkable(bake.chf, 10, 2), 'the target\u2019s side is walkable');
  assert.ok(!navWalkable(bake.chf, 6, 5), 'the divider is not');
  assert.ok(!navWalkable(bake.chf, -1, 5), 'off the map is not');
});

test('ENHANCED AI 4: the enhanced motor goes ROUND the divider; the classic one is stopped by it', () => {
  const c = room();
  const bake = bakeNavFromCollider(c, { anchor: START });
  const run = (Cls, useBake) => {
    const { ai } = foe(Cls, c, useBake ? bake : null, START);
    let minGap = Infinity, southmost = -Infinity;
    for (let n = 0; n < 60 * 4; n++) {           // 16 s of classic ticks
      tick(ai, TARGET);
      southmost = Math.max(southmost, ai.feet[2]);
      minGap = Math.min(minGap, Math.hypot(ai.feet[0] - TARGET[0], ai.feet[2] - TARGET[2]));
    }
    return { feet: ai.feet, minGap, southmost, ai };
  };
  const enhanced = run(EnhancedEnemyAI, true);
  // It reached melee range of the target on the far side of the wall...
  assert.ok(enhanced.minGap <= enhanced.ai.stopDistance + 0.6, `enhanced never closed (min gap ${enhanced.minGap.toFixed(2)})`);
  // ...and it went via the gap at the south end, not through the divider.
  assert.ok(enhanced.southmost > 9, `enhanced did not go round the south end (southmost z ${enhanced.southmost.toFixed(2)})`);
  assert.ok(enhanced.ai.navStats.repaths > 0, 'no route was ever solved');
  // The control: classic AttemptMove + detour, with no bake. Its detour
  // is a 0.75 s hand-swap against the wall; in this room it does not
  // find the far gap in the same time. This is the behaviour the slice
  // exists to change, stated as a measurement rather than assumed.
  const classic = run(EnemyAI, false);
  assert.ok(classic.minGap > enhanced.minGap + 1, `classic closed as well as enhanced (${classic.minGap.toFixed(2)} vs ${enhanced.minGap.toFixed(2)}) - the slice changes nothing`);
  // And an enhanced motor with NO bake is the classic motor: never traps.
  const bare = run(EnhancedEnemyAI, false);
  assert.ok(Math.abs(bare.minGap - classic.minGap) < 1e-9 && Math.abs(bare.feet[0] - classic.feet[0]) < 1e-9,
    'without a bake the enhanced motor must walk exactly where the classic one walks');
});

test('ENHANCED AI 4: no bake, no route, or a detour = the classic destination, exactly', () => {
  const c = room();
  const bake = bakeNavFromCollider(c, { anchor: START });
  const a = foe(EnemyAI, c, null, START).ai;
  const b = foe(EnhancedEnemyAI, c, null, START).ai;
  tick(a, TARGET); tick(b, TARGET);
  assert.deepEqual(b.destination, a.destination, 'no bake: the destinations are one');
  // With a bake but the classic detour running, the detour wins.
  const d = foe(EnhancedEnemyAI, c, bake, START).ai;
  tick(d, TARGET);
  assert.ok(d.path, 'a route was held');
  d.avoidObstaclesTimer = 0.5; d.detourDestination = [3, 0, 3];
  d._getDestination(TARGET);
  assert.deepEqual(d.destination, [3, 0, 3], 'the classic detour outranks the route - never-traps for dynamic obstacles');
});

test('ENHANCED AI 4: a bake that vanishes under a held route is the classic answer THAT tick', () => {
  // `nav()` is a thunk because the host can clear the bake (a level
  // change) while a foe still holds a route to it. _step nulls the route
  // the step AFTER, but the classic tick runs INSIDE the step - so the
  // destination guard must read the thunk too, or the foe steers one
  // tick along a route to a mesh that no longer exists.
  const c = room();
  const bake = bakeNavFromCollider(c, { anchor: START });
  let live = bake;
  const world = makeNavWorld();
  const e = new EnhancedEnemyAI(c, [...START], Math.PI / 2, { liveSpeed: 50, rolls: () => 0.5, nav: () => live?.chf ?? null, navWorld: world, navSeed: 7 });
  e.makeHostileToPlayer();
  tick(e, TARGET);
  assert.ok(e.path, 'a route is held');
  live = null;                                   // the bake is gone
  const k = new EnemyAI(c, [...e.feet], e.yaw, { liveSpeed: 50, rolls: () => 0.5 });
  k.makeHostileToPlayer(); k.predictedTargetPos = e.predictedTargetPos; k.inSight = e.inSight; k.destination = e.destination;
  e._getDestination(TARGET); k._getDestination(TARGET);
  assert.deepEqual(e.destination, k.destination, 'with no bake the destination is classic, route or no route');
});

test('ENHANCED AI 4: a foe that stops pursuing drops its route', () => {
  // The route is refreshed only while pursuing, so one held across a
  // give-up would be followed on resume until its timer ran out -
  // toward a goal the foe no longer believes in.
  const c = room();
  const bake = bakeNavFromCollider(c, { anchor: START });
  const { ai } = foe(EnhancedEnemyAI, c, bake, START);
  tick(ai, TARGET);
  assert.ok(ai.path, 'a route is held');
  // Not by zeroing giveUpTimer - senses refill it every step the target
  // is detected (motor :1478), and the target is standing in plain
  // sight. A PACIFIED foe with no foe target has CanAct false (the
  // C-slice law): that is a foe that has stopped pursuing.
  ai.isHostile = false;
  ai.update(1 / 60, TARGET, senses(), false);
  assert.equal(ai.canAct, false, 'the pacify gate did not close');
  assert.equal(ai.path, null, 'the route did not drop with the pursuit');
});

test('ENHANCED AI 4: adaptation 1 - an intermediate corner is projected past the stop distance; the goal is not', () => {
  const c = room();
  const bake = bakeNavFromCollider(c, { anchor: START });
  const { ai } = foe(EnhancedEnemyAI, c, bake, START);
  tick(ai, TARGET);
  assert.ok(ai.path && ai.path.length >= 3, `a route with corners (${ai.path?.length})`);
  // Force the foe right next to its first corner and ask again.
  const wp = ai.path[1];
  ai.pathI = 1;
  ai.feet[0] = wp[0] - 0.6; ai.feet[2] = wp[2];     // 0.6 away: past WP_REACH, inside stopDistance
  ai._getDestination(TARGET);
  const d = Math.hypot(ai.destination[0] - ai.feet[0], ai.destination[2] - ai.feet[2]);
  assert.ok(d >= ai.stopDistance + PROJECT_MARGIN - 1e-9, `the corner was not projected (${d.toFixed(2)} < ${ai.stopDistance})`);
  // Same DIRECTION as the corner - steering is unchanged.
  const ang = (x, z) => Math.atan2(x, z);
  assert.ok(Math.abs(ang(ai.destination[0] - ai.feet[0], ai.destination[2] - ai.feet[2]) - ang(wp[0] - ai.feet[0], wp[2] - ai.feet[2])) < 1e-9, 'projection changed the heading');
  // The goal is never projected: stand 0.6 from the LAST point and the
  // destination IS that point, so the classic stop fires there.
  const goal = ai.path[ai.path.length - 1];
  ai.pathI = ai.path.length - 1;
  ai.feet[0] = goal[0] - 0.6; ai.feet[2] = goal[2];
  ai._getDestination(TARGET);
  assert.deepEqual(ai.destination, [goal[0], goal[1], goal[2]], 'the goal must not be projected');
});

test('ENHANCED AI 4: the waypoint advance is his - within WP_REACH, never past the last', () => {
  const c = room();
  const bake = bakeNavFromCollider(c, { anchor: START });
  const { ai } = foe(EnhancedEnemyAI, c, bake, START);
  tick(ai, TARGET);
  const n = ai.path.length;
  ai.pathI = 1;
  // Stand ON the last point: every intermediate is farther than reach,
  // so pathI must NOT advance past index 1 just because the last is near.
  ai.feet[0] = ai.path[1][0]; ai.feet[2] = ai.path[1][2];   // on corner 1 exactly
  ai._getDestination(TARGET);
  assert.ok(ai.pathI >= 2 || n === 2, 'a reached corner advances');
  ai.pathI = n - 1;
  ai.feet[0] = ai.path[n - 1][0]; ai.feet[2] = ai.path[n - 1][2];
  ai._getDestination(TARGET);
  assert.equal(ai.pathI, n - 1, 'the last point never advances past itself');
});

test('ENHANCED AI 4: repath rides his cadence, his budget, and his fail back-off', () => {
  const c = room();
  const bake = bakeNavFromCollider(c, { anchor: START });
  const { ai, world } = foe(EnhancedEnemyAI, c, bake, START);
  // First tick paths at once (repathT starts 0).
  tick(ai, TARGET);
  assert.equal(ai.navStats.repaths, 1);
  assert.ok(ai.repathT > 0 && ai.repathT <= REPATH_INT, 'a found route holds for REPATH_INT');
  // The hold: no second solve until the cadence expires.
  world.pathBudget = PATH_BUDGET_PER_FRAME;
  tick(ai, TARGET);
  assert.equal(ai.navStats.repaths, 1, 'the hold is respected');
  // The budget: with none left, a due repath is skipped, and repathT
  // stays <= 0 so it retries next frame rather than backing off.
  ai.repathT = 0; world.pathBudget = 0;
  ai.update(1 / 60, TARGET, senses(), false);
  assert.equal(ai.navStats.repaths, 1, 'no budget, no solve');
  assert.ok(ai.repathT <= 0, 'a budget skip does not consume the cadence');
  world.pathBudget = 1;
  ai.update(1 / 60, TARGET, senses(), false);
  assert.equal(ai.navStats.repaths, 2, 'the next frame\u2019s budget solves it');
  assert.equal(world.pathBudget, 0, 'and consumes the budget');
  // The fail back-off: an unreachable GOAL backs off REPATH_FAIL.
  // Tested on the law directly - moving the TARGET off the map does
  // not make the goal unreachable, because the goal is the foe's
  // predictedTargetPos, the last place it believed the target was,
  // and that is on the mesh. Which is correct: a foe paths to where
  // it thinks you are. (The first draft of this pin expected a null
  // route from an off-map target and was asserting the wrong thing.)
  ai.repathT = 0; world.pathBudget = 3;
  ai._repathToward(bake.chf, -50, -50, 1 / 60);
  assert.equal(ai.path, null, 'an unreachable goal yields no route');
  assert.equal(ai.repathT, REPATH_FAIL, 'and backs off REPATH_FAIL');
  assert.equal(ai.navStats.fails, 1);
  // ...and while backing off, a due-looking frame does NOT solve.
  world.pathBudget = 3;
  ai._repathToward(bake.chf, TARGET[0], TARGET[2], 1 / 60);
  assert.equal(ai.path, null, 'the back-off holds even though the goal is reachable now');
});

test('ENHANCED AI 4: the epoch drops a held route', () => {
  const c = room();
  const bake = bakeNavFromCollider(c, { anchor: START });
  const { ai, world } = foe(EnhancedEnemyAI, c, bake, START);
  tick(ai, TARGET);
  assert.ok(ai.path);
  world.navEpoch++;               // an obstacle changed (his Slice 9)
  world.pathBudget = 3;
  ai.update(1 / 60, TARGET, senses(), false);
  assert.equal(ai.pathEpoch, world.navEpoch, 'the route was re-solved on the new epoch');
  assert.equal(ai.navStats.repaths, 2);
});

test('ENHANCED AI 4: the stuck watchdog nudges through the COLLIDER and drops the route', () => {
  const c = room();
  const bake = bakeNavFromCollider(c, { anchor: START });
  const { ai } = foe(EnhancedEnemyAI, c, bake, START);
  tick(ai, TARGET);
  assert.ok(ai.path);
  // Pin the feet: every step the collider is told to move, but we put
  // the foe back, so the watchdog sees no progress.
  const x0 = ai.feet[0], z0 = ai.feet[2];
  let fired = 0;
  // Room for the classic TURN first: the watchdog only counts while
  // `moving`, and a foe facing +x with a route heading south spends its
  // first ticks turning in place (classic turns in place). Then STUCK_T
  // of pinned feet, with margin.
  const steps = 240 + Math.ceil(STUCK_T / (1 / 60)) + 2;
  for (let i = 0; i < steps; i++) {
    const before = ai.navStats.stuckFires;
    ai.feet[0] = x0; ai.feet[2] = z0;
    ai.update(1 / 60, TARGET, senses(), false);
    if (ai.navStats.stuckFires > before) { fired++; break; }
  }
  assert.equal(fired, 1, 'the watchdog fires after STUCK_T of no progress');
  assert.equal(ai.path, null, 'and drops the route so the next solve starts from the nudged spot');
  assert.equal(ai.repathT, 0);
  // The nudge went through the collider (adaptation 2): the foe is
  // still on the floor, inside the room, and on walkable nav.
  assert.ok(ai.feet[0] > 0 && ai.feet[0] < 12 && ai.feet[2] > 0 && ai.feet[2] < 12, 'the nudge left the room');
  assert.ok(navWalkable(bake.chf, ai.feet[0], ai.feet[2]), 'the nudge landed off the mesh');
});

test('ENHANCED AI 4: a broken navmesh costs the feature, never the dungeon', () => {
  const c = room();
  // A chf with no mesh makes findPath return null - that is the fail
  // back-off, not a fault, and it is never-traps working as designed
  // (the first draft of this pin used one and could not latch). The
  // fault path needs a chf that THROWS on any read.
  const poison = new Proxy({}, { get() { throw new Error('poisoned chf'); } });
  const { ai } = foe(EnhancedEnemyAI, c, { chf: poison }, START);
  const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
  try {
    for (let i = 0; i < 8; i++) tick(ai, TARGET);
  } finally { console.warn = warn; }
  assert.equal(ai.navBroken, true, 'the fallback latched');
  assert.equal(warned, 1, 'logged once, not every step');
  assert.equal(ai.path, null);
  // And it still walks - the classic step ran throughout.
  assert.ok(Math.hypot(ai.feet[0] - START[0], ai.feet[2] - START[2]) > 0.5, 'the foe stopped moving');
});

test('ENHANCED AI 4: the host chooses the motor by the switch and refills the budget each frame', () => {
  const host = rd('src/scenes/dungeonContext.js');
  assert.equal((host.match(/getPref\('enhancedAI'\) \? D\.EnhancedEnemyAI : D\.EnemyAI/g) || []).length, 2, 'both construction sites choose by the pref');
  assert.ok(/nav: \(\) => enhancedNav\.chf, navWorld: enhancedNav\.world/.test(host), 'the bake is a thunk and the world is the host\u2019s');
  assert.ok(/enhancedNav\.world\.pathBudget = enhancedNav\.world\.budgetPerFrame/.test(host), 'the budget is refilled once a frame (his enemy.js:404)');
  // THE BUG MAC FOUND. buildFoeAt runs in buildDungeonContext's top-level
  // flow and reads `enhancedNav.world` at construction; the object must
  // therefore be declared ABOVE the foe block, or every foe hits the
  // temporal dead zone inside its per-foe try and is left a floating
  // billboard with no motor. Pinned by line ORDER, since no node test
  // can run this host without ARENA2.
  const decl = host.indexOf('const enhancedNav = {');
  const firstMint = host.indexOf('async function buildFoeAt(');
  const lazy = host.indexOf('const [shared, engineRig');
  assert.ok(decl > 0 && firstMint > 0 && lazy > 0);
  assert.ok(decl < lazy, 'enhancedNav must be declared before the lazy foe block');
  assert.ok(decl < firstMint, 'enhancedNav must be declared before buildFoeAt');
  assert.ok(/enhancedNav\.world = makeNavWorld\(\)/.test(host), 'one world per host, made in the lazy block');
  // The other two hosts are AI 5 and do not construct it yet - stated.
  for (const f of ['src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js']) {
    assert.ok(!/EnhancedEnemyAI/.test(rd(f)), `${f} is AI 5, not this slice`);
  }
});
