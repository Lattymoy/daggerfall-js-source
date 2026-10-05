// TELL6b - THE CHARGE (bible/12-Enhanced-AI/Feud-Arc.md section 8.1; Mac, 2026-10-04: "breath more depth into it",
// then "Go" on every call). The gap-closer, and the answer to the archer and the kiter: TACT4 only ever wound up in
// reach; a charger of the whole set (the Grizzly, the Sabertooth, the Wereboar, the Centaur, the Orc Warlord) now winds
// one up from 5-12 m, its lane (9 m by 1.6 m) free of walls and cover, tracking through the first half of its wind-up.
// At its landing it RUNS the lane in 0.45 s along the collider - a wall ends it in a skid - and the verdict is swept
// between its turns (the world boss's chargeStrikes law), once: it stops on the player it runs into; past them, it
// overreaches at the lane's end. It never chains.
// The law (its numbers, its lane, the ground's mirror, the gap-closer's choice by distance, wall and cover); ON THE
// REAL MOTOR an elite grizzly's charge from 9 m running into a player who stands, and past one who steps out after its
// aim locks; the run's one-at-a-time; the ear.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { setTacticsClock, resetTactics, noteLocalPlayer, gapCloses, blowPool, GAP_CLOSERS } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, makeBlow, inBlow, blowShapesOf, windupNear, BLOW } from '../src/ai/foeBlows.js';
import { TELL, punishSeconds } from '../src/ai/tells.js';
import { blowField, quadHalf, BLOW_KIND } from '../src/render/foeTelegraph.js';
import { tellCues } from '../src/scenes/hostCombat.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

// ── the law ─────────────────────────────────────────────────────────

test('TELL6b: the charge - a 9 m by 1.6 m lane from its feet, 0.9 s, x1.5, run in 0.45 s, begun 5-12 m out; the ground draws it as a lane (mutants: any number moved; the lane narrowed)', () => {
  assert.deepEqual({ ...BLOW.charge }, { windup: 0.9, len: 9.0, halfW: 0.8, mult: 1.5, cross: 0.45, from: 5, to: 12 });
  const b = makeBlow('charge', [0, 0, 0], 0, 0);
  assert.equal(inBlow(b, 0, 8.9), true);
  assert.equal(inBlow(b, 0, 9.1), false);
  assert.equal(inBlow(b, -0.79, 4), true, 'wider than a lunge');
  assert.equal(inBlow(b, -0.81, 4), false);
  assert.equal(inBlow(b, 0, -0.5), false);
  const H = quadHalf('charge');
  for (let along = -H; along <= H; along += 0.23) {
    for (let across = -H; across <= H; across += 0.23) assert.equal(blowField('charge', across, along).inside, inBlow(b, -across, along));
  }
  assert.equal(BLOW_KIND.charge, BLOW_KIND.lunge, 'the shader\'s lane');
  assert.ok(H >= BLOW.charge.len + 0.5);
  assert.match(rd('src/render/foeTelegraph.js'), /if \(b\.kind === 'lunge' \|\| b\.kind === 'charge'\) gl\.uniform4f\(U\.uP, P\.len, P\.halfW, 0, 0\);/);
  assert.equal(punishSeconds('charge'), 1.4);
  assert.ok(TELL.TRACKERS.includes('charge'));
  assert.ok(GAP_CLOSERS.includes('charge'));   // PIN MOVED (TELL6c: the leap joins it)
});

test('TELL6b: who and when - a charger of the whole set, from 5-12 m, its lane free of walls and of cover; never in reach (mutants: the band; the wall; the cover)', () => {
  for (const t of [M.GrizzlyBear, M.SabertoothTiger, M.Wereboar, M.Centaur, M.OrcWarlord]) {
    assert.ok(blowShapesOf(t, { eliteFoe: true }).includes('charge'), `${t}`);
    assert.equal(blowShapesOf(t, { level: 30 }).includes('charge'), false, `${t}: an ordinary one never`);
  }
  assert.equal(blowShapesOf(M.Orc, { eliteFoe: true }).includes('charge'), false);
  const ai = { feet: [0, 0, 0], collider: new Collider(() => 0) };
  assert.equal(gapCloses(ai, 'charge', 4.9, 0, 4.9), false, 'too near');
  assert.equal(gapCloses(ai, 'charge', 5, 0, 5), true);
  assert.equal(gapCloses(ai, 'charge', 12, 0, 12), true);
  assert.equal(gapCloses(ai, 'charge', 12.1, 0, 12.1), false, 'too far');
  assert.equal(gapCloses(ai, 'lunge', 8, 0, 8), false, 'a blow of reach never');
  const walled = { feet: [0, 0, 0], collider: { raycast: () => 4, cover: null } };
  assert.equal(gapCloses(walled, 'charge', 8, 0, 8), false, 'a wall in its lane');
  const behind = { feet: [0, 0, 0], collider: { raycast: () => 20, cover: null } };
  assert.equal(gapCloses(behind, 'charge', 8, 0, 8), true, 'a wall past it is no matter');
  const treed = { feet: [0, 0, 0], collider: { raycast: () => Infinity, cover: { on: () => true, hit: () => 3 } } };
  assert.equal(gapCloses(treed, 'charge', 8, 0, 8), false, 'cover in its lane');
  // the pool: in reach its blows of reach, never the charge; out of it the charge alone
  const g = { mobileType: M.GrizzlyBear, level: 12, eliteFoe: true };
  assert.deepEqual(blowPool(ai, g, 2.5, true, 0, 2.5), ['lunge']);
  assert.deepEqual(blowPool(ai, g, 8, false, 0, 8), ['charge']);
  assert.deepEqual(blowPool(ai, g, 3.5, false, 0, 3.5), [], 'between reach and the band: nothing');
  assert.deepEqual(blowPool(ai, { mobileType: M.GrizzlyBear, level: 12 }, 8, false, 0, 8), [], 'an ordinary grizzly never charges');
});

// ── on the real motor ───────────────────────────────────────────────

function foe({ mobileType = M.GrizzlyBear, z = 6.5 } = {}) {
  const c = new Collider(() => 0);
  const ent = { health: 300, maxHealth: 300, mobileType, level: 12, eliteFoe: true };
  const ai = new EnemyAI(c, [0, 0, z], Math.PI, { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  return { ai, atk, ent, mobileType, mobile: { meleeSeq: 0 } };
}
function run(f, secs, player, each = null) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    f.ai.update(DT, player); f.atk.update(DT, f.ai, player);
    each?.();
  }
}
function pinned(r, fn) { const had = Math.random; Math.random = () => r; try { return fn(); } finally { Math.random = had; } }
/** Until `f` winds up a charge (rolls pinned: the chance passes, the first of the shapes it may throw from there). */
function untilCharge(f, player, secs = 20) {
  return pinned(0.05, () => {
    for (let s = 0; s < Math.round(secs / DT); s++) {
      run(f, DT, player);
      const b = f.ai._tac?.state === 'windup' ? liveBlows().get(f.ai) : null;
      if (b) return b;
    }
    return null;
  });
}

test('TELL6b: ON THE MOTOR an elite grizzly 6.5 m out winds up a charge, and at its landing RUNS its lane - into a player who stands: a hit where it meets them, and it stops short of the lane\'s end (mutants: no run; the run never decided; it runs on through)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const b = untilCharge(f, player);
  assert.equal(b?.kind, 'charge', 'out of reach: the gap-closer');
  const d0 = Math.hypot(b.origin[0] - player[0], b.origin[2] - player[2]);
  assert.ok(d0 >= BLOW.charge.from && d0 <= BLOW.charge.to, `begun ${d0.toFixed(2)} m out`);
  let ran = null, verdict = null, verdictAt = null, at = null;
  pinned(0.9, () => run(f, b.land - T + 0.8, player, () => {
    if (ran == null && f.ai._tac.state === 'dash') { ran = T; at = [...f.ai.feet]; assert.equal(windupNear(player, T, null), true, 'its run is its one blow near me'); }
    if (verdict == null && f.ai._blowVerdict != null) { verdict = f.ai._blowVerdict; verdictAt = T; }
  }));
  assert.ok(ran != null && ran >= b.land - 1e-9, 'it ran at its landing');
  assert.equal(verdict, true, 'it ran into me');
  assert.ok(verdictAt - ran <= BLOW.charge.cross + 0.1, 'within its run');
  const stop = Math.hypot(f.ai.feet[0] - player[0], f.ai.feet[2] - player[2]);
  assert.ok(stop < 1.5, `it stopped where it met me (${stop.toFixed(2)})`);
  assert.ok(Math.hypot(f.ai.feet[0] - b.origin[0], f.ai.feet[2] - b.origin[2]) < BLOW.charge.len - 1.5, 'short of its lane\'s end');
  assert.equal(f.ai._tac.state === 'dash', false);
  assert.ok(Math.hypot(f.ai.feet[0] - at[0], f.ai.feet[2] - at[2]) > 4, 'it covered the ground fast');
});

test('TELL6b: ON THE MOTOR a step out of the lane after its aim locks - it runs past, to the lane\'s end, and overreaches there; it never chains, even a brute that could (mutants: the run decided at its start; the window missing; a run chained)', () => {
  const f = foe({ mobileType: M.OrcWarlord, z: 9 });   // an elite brute: it chains its other blows - never its charge
  const player = [0, 0, 0];
  const b = untilCharge(f, player);
  assert.equal(b?.kind, 'charge');
  const lockAt = b.start + TELL.TRACK_SHARE * (b.land - b.start) + 0.1;
  run(f, lockAt - T, player);
  const across = [-Math.cos(b.yaw), Math.sin(b.yaw)];
  player[0] += across[0] * 2.5; player[2] += across[1] * 2.5;   // off its locked lane
  assert.equal(inBlow(b, player[0], player[2]), false);
  pinned(0.05, () => run(f, b.land - T + BLOW.charge.cross + 0.2, player));   // 0.05: a chain would roll - it never does
  assert.equal(f.ai._tac.state, 'overreach', 'past me, spent');
  assert.ok(near(f.ai._tac.until - f.ai._blowLandedAt, punishSeconds('charge', b.guard, b.lateIn === true)));
  const ran = Math.hypot(f.ai.feet[0] - b.origin[0], f.ai.feet[2] - b.origin[2]);
  assert.ok(ran > 6, `to the lane's end (${ran.toFixed(2)})`);
});

test('TELL6b: the ear - its RELEASE before it runs, its LAND at the strike the run decides (mutants: the run silent)', () => {
  const R = ENEMY_BASICS[M.GrizzlyBear];
  const f = { mobileType: M.GrizzlyBear, mobile: { meleeSeq: 0 }, ai: { feet: [0, 0, 0], _blowHold: true } };
  const blow = { start: 10, land: 10.9, kind: 'charge' };
  f.ai._tac = { state: 'windup', blow };
  const a = { play3d: () => {} };
  tellCues(f, a, 1, 10);
  tellCues(f, a, 1, 10.7);
  f.ai._tac = { state: 'dash', dash: { blow } };
  assert.deepEqual(tellCues(f, a, 1, 10.95), [], 'running: no LAND yet');
  f.ai._tac = { state: 'engage', blow: null }; f.ai._blowLandedAt = 11.1; f.ai._blowHold = false;
  tellCues(f, a, 1, 11.1);
  f.mobile.meleeSeq++;
  assert.deepEqual(tellCues(f, a, 1, 11.2), [R.attackSound]);
});
