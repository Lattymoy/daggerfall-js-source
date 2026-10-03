// AUDIT PRE-MERGE 1003 (2026-10-03): the arena PR (#545) read again before its merge - its code finding pinned here.
// D1: a walk to a mark's pace outlived the walk. ARENA-FIX 8's walk in sets the motor's pace (WALK_PACE, 0.7), and the
// motor put it back only when it arrived itself (WALK_ARRIVE_M); the bout ends every walk in itself (its mark at
// MARK_ARRIVE_M, or the walk's limit at the count) with `walkGoal = null`, so every exhibition and ladder fighter that
// walked in fought its whole bout at 0.7 of its speed. The record: bible/11-Multiplayer/Arena.md "ARENA-FIX record" 8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArenaBouts, WALK_PACE } from '../src/scenes/arenaBouts.js';
import { newArenaLadder } from '../src/systems/arenaLadder.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { Collider } from '../src/player/collider.js';

const settle = () => new Promise((r) => setTimeout(r, 0));
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const floor = () => {
  const col = new Collider(() => -100);
  col.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4);
  return col;
};
const OPTS = { liveSpeed: 60, height: 1.8, centreOffset: 0.9 };

/** test/arena_fix.test.js's ARENA-FIX 8 rig: a floor, the bouts, a stage whose fighters are real motors on it. */
function walkingRig() {
  let t = 1000;
  const col = floor();
  const foes = [];
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder() };
  const A = createArenaBouts({ now: () => t, rng: () => 0.99, playerEntity: P, say: () => {}, notice: () => {}, heal: () => {}, drawHud: () => {} });
  const stage = { kind: 'floor', centre: () => [0, 0, 0],
    spawn: async (mobile, feet, o) => { const ai = new EnemyAI(col, [feet[0], 0, feet[2]], o.yaw ?? 0, OPTS); const f = { mobile, ai, entity: { health: 40, maxHealth: 40, bout: o.bout, items: [] } }; foes.push(f); return f; },
    remove: () => {}, heightAt: () => null };
  const step = (ms = 50) => { t += ms; for (const f of foes) f.ai.update(ms / 1000, [-6, 0, 0]); A.frame(ms / 1000, { playerFeet: [-6, 0, 0], sheathed: false }); };
  return { A, foes, stage, step };
}

/** How far a motor's pursuit carries it in `s` seconds after a target 40 m ahead of where it faces. */
function chase(ai, s = 2) {
  const from = [...ai.feet], dir = [Math.sin(ai.yaw), Math.cos(ai.yaw)];
  const target = [from[0] + dir[0] * 40, 0, from[2] + dir[1] * 40];
  for (let i = 0; i < s * 20; i++) ai.update(0.05, target);
  return Math.hypot(ai.feet[0] - from[0], ai.feet[2] - from[2]);
}

const LADDER = { tier: 0, bout: 0, champion: false, grand: false, opponents: [{ mobile: 138, level: 1 }], free: false, beasts: false, purse: 50, label: 'bout 1 of 3', tierName: 'The Pit' };
const EXHIBITION = { hour: 12, seed: 99, tier: 0, beasts: false, opponents: [{ mobile: 138, level: 1 }, { mobile: 139, level: 1 }] };

/** A bout asked and walked in to its count: its fighters, each walk ended by the bout itself. */
async function walkedIn(ask) {
  const r = walkingRig();
  r.A.setStage(r.stage);
  r.A.ask(ask);
  await settle();
  for (let i = 0; i < 500 && r.A.bout().phase !== 'count'; i++) r.step();
  assert.equal(r.A.bout().phase, 'count');
  assert.ok(r.A.bout().fighters.every((f) => f.atMark), 'every fighter walked to its mark');
  assert.ok(r.foes.length > 0 && r.foes.every((f) => !f.ai.walkGoal && !f.ai.walkArrived), 'and the bout ended each walk itself (MARK_ARRIVE_M), not the motor (WALK_ARRIVE_M) - the walks the pace outlived');
  return r.foes;
}
/** Its chase against a fighter that never walked, stood where it stands and facing as it faces. */
function asFresh(ai, what) {
  const fresh = new EnemyAI(floor(), [...ai.feet], ai.yaw, OPTS);
  const walked = chase(ai), never = chase(fresh);
  assert.ok(never > 8, `a fresh fighter runs (${never.toFixed(2)} m in 2 s)`);
  assert.ok(Math.abs(walked / never - 1) < 0.05, `${what} chases at its full speed: ${walked.toFixed(2)} m against ${never.toFixed(2)} m (WALK_PACE ${WALK_PACE} of it is ${(never * WALK_PACE).toFixed(2)})`);
}

test('AUDIT PRE-MERGE 1003 D1: a walk in the bout ends itself leaves no pace behind - the ladder\'s opponent and the exhibition\'s fighters on their marks chase as fast as ones that never walked (mutants: AUDIT1003-D1-*)', async () => {
  const [opponent] = await walkedIn({ where: 'floor', kind: 'ladder', next: LADDER });
  assert.equal(opponent.ai.isHostile, true, 'the ladder\'s opponent is the player\'s foe');
  asFresh(opponent.ai, 'the ladder\'s opponent');
  for (const f of await walkedIn({ where: 'floor', kind: 'exhibition', ex: EXHIBITION })) {
    f.ai.isHostile = true;   // the fight's target (characters/enemyTargets.js) stands in: released, it chases
    asFresh(f.ai, 'an exhibition fighter');
  }
});

test('AUDIT PRE-MERGE 1003 D1: the walk itself is still at its pace, and the motor\'s own end of it leaves none either (mutants: AUDIT1003-D1-*)', () => {
  const mk = () => new EnemyAI(floor(), [0, 0, 0], 0, OPTS);
  // the walk to a far mark against the pursuit to the same point: WALK_PACE of it
  const w = mk();
  w.walkTo([0, 0, 40], { pace: WALK_PACE });
  for (let i = 0; i < 40; i++) w.update(0.05, [50, 0, 50]);
  const walked = w.feet[2];
  const p = mk();
  const ran = chase(p);
  const share = walked / ran;
  assert.ok(Math.abs(share - WALK_PACE) < 0.05, `the walk in at ${share.toFixed(3)} of the pursuit (WALK_PACE ${WALK_PACE})`);
  // a walk the motor ends itself (WALK_ARRIVE_M), then a chase
  const a = mk();
  a.walkTo([0, 0, 2], { pace: WALK_PACE });
  for (let i = 0; i < 200 && !a.walkArrived; i++) a.update(0.05, [50, 0, 50]);
  assert.ok(a.walkArrived);
  asFresh(a, 'a fighter the motor stopped');
});
