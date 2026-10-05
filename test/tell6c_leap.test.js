// TELL6c - THE LEAP (bible/12-Enhanced-AI/Feud-Arc.md section 8.1; Mac, 2026-10-04: "breath more depth into it", then
// "Go" on every call). A disc 1.8 m about the target's feet, up to 9 m off, locked at its start: the leaper of the
// whole set (the Spider, the Werewolf, the Sabertooth, the Vampire) crouches through its wind-up, then jumps - its last
// 0.35 s an arc to the point on the motor's own gravity - and the verdict is the point's at its landing. Begun 3-9 m
// out, a clear line to the target, ground under the point; never a flyer. It never chains; its miss leaves 1.2 s.
// The law (its numbers, its disc at its point, the ground's mirror and quad, the choice by distance, wall, cover,
// ground and flight); ON THE REAL MOTOR an elite spider's leap - the crouch, the jump, the landing on a player who
// stood, and on the empty ground a player left; the pool beside the charge.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { setTacticsClock, resetTactics, noteLocalPlayer, gapCloses, blowPool, GAP_CLOSERS } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, makeBlow, inBlow, blowShapesOf, fitBlowToGround, BLOW } from '../src/ai/foeBlows.js';
import { TELL, punishSeconds } from '../src/ai/tells.js';
import { blowField, quadHalf, BLOW_KIND } from '../src/render/foeTelegraph.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

// ── the law ─────────────────────────────────────────────────────────

test('TELL6c: the leap - a disc 1.8 m at its point, a second, x1.6, 3-9 m off, its last 0.35 s the jump; the ground draws the disc at the point in a quad of its own (mutants: any number moved; the disc at the feet)', () => {
  assert.deepEqual({ ...BLOW.leap }, { windup: 1.0, r: 1.8, mult: 1.6, from: 3, range: 9, arc: 0.35 });
  const b = makeBlow('leap', [0, 0, 0], 0, 0);
  b.ahead = 6;
  assert.equal(inBlow(b, 0, 6), true);
  assert.equal(inBlow(b, 1.79, 6), true);
  assert.equal(inBlow(b, 0, 7.9), false);
  assert.equal(inBlow(b, 0, 0.5), false, 'never at its own feet');
  const H = quadHalf('leap', 6);
  assert.ok(H >= 6 + BLOW.leap.r + 0.5 && H < quadHalf('leap', 9), 'its quad by its own point');
  for (let along = -H; along <= H; along += 0.21) {
    for (let across = -H; across <= H; across += 0.21) assert.equal(blowField('leap', across, along, 6).inside, inBlow(b, -across, along));
  }
  assert.equal(BLOW_KIND.leap, BLOW_KIND.slam, 'the shader\'s disc ahead');
  // PIN MOVED (RVN5: the pyre's disc shares the leap's uniforms - its own radius and point)
  assert.match(rd('src/render/foeTelegraph.js'), /else if \(b\.kind === 'leap' \|\| b\.kind === 'pyre'\) gl\.uniform4f\(U\.uP, P\.r, b\.ahead \?\? 0, 0, 0\);/);
  assert.match(rd('src/render/foeTelegraph.js'), /gl\.uniform1f\(U\.uHalf, quadHalf\(b\.kind, b\.ahead\)\);/);
  assert.equal(punishSeconds('leap'), 1.2);
  assert.equal(TELL.TRACKERS.includes('leap'), false, 'its point locks at its start');
  assert.deepEqual([...GAP_CLOSERS], ['charge', 'leap']);
});

test('TELL6c: who and when - a leaper of the whole set, 3-9 m out, a clear line, ground under its point, never a flyer; beside the charge in the pool (mutants: the band; the line; the ground)', () => {
  for (const t of [M.Spider, M.Werewolf, M.SabertoothTiger, M.Vampire]) {
    assert.ok(blowShapesOf(t, { eliteFoe: true }).includes('leap'), `${t}`);
    assert.equal(blowShapesOf(t, { level: 30 }).includes('leap'), false, `${t}: an ordinary one never`);
  }
  const ai = { feet: [0, 0, 0], collider: new Collider(() => 0) };
  const spider = { mobileType: M.Spider };
  assert.equal(gapCloses(ai, 'leap', 2.9, 0, 2.9, spider), false);
  assert.equal(gapCloses(ai, 'leap', 3, 0, 3, spider), true);
  assert.equal(gapCloses(ai, 'leap', 9, 0, 9, spider), true);
  assert.equal(gapCloses(ai, 'leap', 9.1, 0, 9.1, spider), false);
  const walled = { feet: [0, 0, 0], collider: { raycast: (o, d) => (d[1] < 0 ? 2.5 : 4), cover: null } };
  assert.equal(gapCloses(walled, 'leap', 6, 0, 6, spider), false, 'no clear line');
  const chasm = { feet: [0, 0, 0], collider: { raycast: () => Infinity, cover: null } };
  assert.equal(gapCloses(chasm, 'leap', 6, 0, 6, spider), false, 'no ground under its point');
  const ground = { feet: [0, 0, 0], collider: { raycast: (o, d) => (d[1] < 0 ? 2.5 : Infinity), cover: null } };
  assert.equal(gapCloses(ground, 'leap', 6, 0, 6, spider), true);
  assert.equal(gapCloses(ground, 'leap', 6, 0, 6, { mobileType: M.GiantBat }), false, 'never a flyer');
  const sab = { mobileType: M.SabertoothTiger, level: 12, eliteFoe: true };
  assert.deepEqual(blowPool(ai, sab, 7, false, 0, 7), ['charge', 'leap'], 'both closers in both bands');
  assert.deepEqual(blowPool(ai, sab, 4, false, 0, 4), ['leap']);
  assert.deepEqual(blowPool(ai, sab, 10, false, 0, 10), ['charge']);
  assert.deepEqual(blowPool(ai, sab, 2, true, 0, 2), ['lunge']);
});

test('TELL6c: the mark lies on the ground at its point - the fit samples the point, and the terrain outdoors (a mesh-only ray met no ground there) (mutants: the fit two metres out; the terrain unseen)', () => {
  const step = new Collider((x, z) => (z > 3 ? 1.5 : 0));   // a rise between the leaper and its point
  const b = makeBlow('leap', [0, 0, 0], 0, 0);
  b.ahead = 6;
  fitBlowToGround(b, step);
  assert.ok(Math.abs(b.slope[1] - 1.5 / 6) < 1e-6, `the disc up on the rise at its point (${b.slope[1]})`);
  const hill = new Collider((x, z) => 0.3 * z);
  const l = fitBlowToGround(makeBlow('lunge', [0, 0, 0], 0, 0), hill);
  assert.ok(Math.abs(l.slope[1] - 0.3) < 1e-6, 'a lunge on an outdoor hillside lies on it (AUDIT TACT D8, outdoors at last)');
});

// ── on the real motor ───────────────────────────────────────────────

function foe() {
  const c = new Collider(() => 0);
  const ent = { health: 200, maxHealth: 200, mobileType: M.Spider, level: 12, eliteFoe: true };
  const ai = new EnemyAI(c, [0, 0, 7], Math.PI, { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  return { ai, atk, ent };
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
function untilLeap(f, player, secs = 20) {
  return pinned(0.05, () => {
    for (let s = 0; s < Math.round(secs / DT); s++) {
      run(f, DT, player);
      const b = f.ai._tac?.state === 'windup' ? liveBlows().get(f.ai) : null;
      if (b) return b;
    }
    return null;
  });
}

test('TELL6c: ON THE MOTOR an elite spider 7 m out leaps - it crouches where it stands, jumps its last 0.35 s in an arc, and lands at its point on the player who stood there (mutants: no jump; no arc; the verdict at its feet)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const b = untilLeap(f, player);
  assert.equal(b?.kind, 'leap', 'out of reach: the gap-closer');
  const pt = [b.origin[0] + Math.sin(b.yaw) * b.ahead, b.origin[2] + Math.cos(b.yaw) * b.ahead];
  assert.ok(Math.hypot(pt[0] - player[0], pt[1] - player[2]) < 0.3, 'its point is my feet');
  const at = [...f.ai.feet];
  let crouchMoved = 0, peak = -Infinity, verdict = null;
  pinned(0.9, () => run(f, b.land - T + 0.15, player, () => {
    const jumpAt = b.land - BLOW.leap.arc;   // the law's, not the blow's word for it
    if (T < jumpAt - 0.02) crouchMoved = Math.max(crouchMoved, Math.hypot(f.ai.feet[0] - at[0], f.ai.feet[2] - at[2]));
    if (T > jumpAt && T < b.land) peak = Math.max(peak, f.ai.feet[1]);
    if (verdict == null && f.ai._blowVerdict != null) verdict = f.ai._blowVerdict;
  }));
  assert.ok(crouchMoved < 0.02, 'it crouched where it stood');
  assert.ok(peak > 0.1, `an arc (${peak.toFixed(2)} m up)`);
  assert.ok(Math.hypot(f.ai.feet[0] - pt[0], f.ai.feet[2] - pt[1]) < 0.8, 'it landed at its point');
  assert.equal(verdict, true, 'on me');
});

test('TELL6c: ON THE MOTOR a player who leaves the point before it lands - it lands on empty ground and overreaches there (mutants: the point following me)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const b = untilLeap(f, player);
  assert.equal(b?.kind, 'leap');
  run(f, 0.2, player);
  player[0] += 3;   // out of its disc
  assert.equal(inBlow(b, player[0], player[2]), false);
  pinned(0.9, () => run(f, b.land - T + 0.15, player));
  assert.equal(f.ai._tac.state, 'overreach');
  assert.ok(Math.abs(f.ai._tac.until - f.ai._blowLandedAt - punishSeconds('leap', b.guard, b.lateIn === true)) < 1e-9);
});
