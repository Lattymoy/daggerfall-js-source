// TELL6a - THE RING (bible/12-Enhanced-AI/Feud-Arc.md section 8.1; Mac, 2026-10-04: "breath more depth into it", then
// "Go" on every call). The first of TELL6's new shapes: an annulus 1.6-4.0 m about the foe's feet, a second's wind-up,
// x1.5 - the answer to the player who backs off, whose safe ground is the foe's own feet (the hug answers it). Thrown
// by the whole set of the massive brute, the atronachs and the Daedra Lord (TELL7) - heavy bodies all, so iron
// (TELL3); it chains into a slam (TELL5); its miss leaves a second's window (TELL4).
// The law (its numbers, the verdict all round, the ground's mirror of it, each blow's own quad); who throws it; ON THE
// REAL MOTOR an elite giant's ring landing on a player in its annulus and missing one who hugs its feet; the pass.
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
import { setTacticsClock, resetTactics, noteLocalPlayer } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, makeBlow, inBlow, blowShapesOf, BLOW, IRON_COLOR } from '../src/ai/foeBlows.js';
import { TELL, blowGuard, chainShape, punishSeconds } from '../src/ai/tells.js';
import { blowField, quadHalf, BLOW_KIND, BLOW_QUAD_HALF } from '../src/render/foeTelegraph.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

// ── the law ─────────────────────────────────────────────────────────

test('TELL6a: the ring - 1.6 to 4.0 m about its feet, a second\'s wind-up, x1.5; safe at its feet and past its edge, all round (mutants: any number moved; the feet not safe)', () => {
  assert.deepEqual({ ...BLOW.ring }, { windup: 1.0, rIn: 1.6, rOut: 4.0, mult: 1.5 });
  assert.ok(Object.isFrozen(BLOW.ring));
  const b = makeBlow('ring', [2, 0, -1], 0.7, 0);
  for (let a = 0; a < 2 * Math.PI; a += Math.PI / 8) {
    const at = (r) => inBlow(b, 2 + Math.sin(a) * r, -1 + Math.cos(a) * r);
    assert.equal(at(0.5), false, 'its feet are safe');
    assert.equal(at(1.59), false);
    assert.equal(at(1.61), true);
    assert.equal(at(3.0), true, 'all round - no facing');
    assert.equal(at(3.99), true);
    assert.equal(at(4.01), false);
  }
});

test('TELL6a: the ground reads the verdict\'s own law for every shape - blowField agrees with inBlow point for point, inside each blow\'s own quad, its glow with room (mutants: the mirror off; a quad too small)', () => {
  for (const kind of ['lunge', 'sweep', 'slam', 'ring']) {
    const b = makeBlow(kind, [0, 0, 0], 0, 0);
    const H = quadHalf(kind);
    let n = 0;
    for (let along = -H; along <= H; along += 0.17) {
      for (let across = -H; across <= H; across += 0.17) {
        const f = blowField(kind, across, along);
        assert.equal(f.inside, inBlow(b, -across, along), `${kind} at (${across.toFixed(2)}, ${along.toFixed(2)})`);
        if (f.inside) { n++; assert.ok(Math.abs(across) <= H - 0.5 && Math.abs(along) <= H - 0.5, `${kind}: its glow has room`); }
      }
    }
    assert.ok(n > 50, `${kind} drew something`);
  }
  assert.ok(quadHalf('ring') < quadHalf('lunge'), 'each its own size');
  assert.ok(BLOW_QUAD_HALF >= Math.max(...['lunge', 'sweep', 'slam', 'ring'].map((k) => quadHalf(k) - 0.3)), 'the whole quad still holds every shape');
  assert.equal(BLOW_KIND.ring, 3);
  const fs = rd('src/render/foeTelegraph.js');
  assert.match(fs, /float d = length\(vec2\(across, along\)\);\n\s*inside = d >= uP\.x && d <= uP\.y;/, 'the shader\'s annulus is the law\'s');
  assert.match(fs, /else if \(b\.kind === 'ring'\) gl\.uniform4f\(U\.uP, P\.rIn, P\.rOut, 0, 0\);/);
  assert.match(fs, /gl\.uniform1f\(U\.uHalf, quadHalf\(b\.kind, b\.ahead\)\);/);   // PIN MOVED (TELL6c: a leap's quad by its own point)
});

test('TELL6a: who throws it - the whole set of the massive brute, the atronachs and the Daedra Lord; never an ordinary one; iron on their weight; it chains into a slam; its miss a second\'s window (mutants: the ring for every brute)', () => {
  for (const [t, ent] of [[M.Giant, { eliteFoe: true }], [M.IronAtronach, { champion: 'mighty' }], [M.FleshAtronach, { elite: true }], [M.DaedraLord, { revenant: { rank: 1 } }]]) {
    assert.ok(blowShapesOf(t, ent).includes('ring'), `${t}`);
    assert.equal(blowShapesOf(t, { level: 30 }).includes('ring'), false, `${t}: an ordinary one keeps its family's`);
    assert.equal(blowGuard('ring', ENEMY_BASICS[t].weight), 'iron', `${t}: heavy - iron`);
  }
  for (const t of [M.Daedroth, M.Gargoyle, M.Dreugh, M.Orc, M.GrizzlyBear]) assert.equal(blowShapesOf(t, { eliteFoe: true }).includes('ring'), false, `${t}: none`);
  assert.equal(chainShape('ring', blowShapesOf(M.Giant, { eliteFoe: true })), 'slam');
  assert.equal(punishSeconds('ring'), 1.0);
  assert.equal(TELL.TRACKERS.includes('ring'), false, 'it never turns');
});

// ── on the real motor ───────────────────────────────────────────────

function foe(extra = { eliteFoe: true }) {
  const c = new Collider(() => 0);
  const ent = { health: 400, maxHealth: 400, mobileType: M.Giant, level: 12, ...extra };
  const ai = new EnemyAI(c, [0, 0, 8], Math.PI, { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  return { ai, atk, ent };
}
function run(f, secs, player) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    f.ai.update(DT, player); f.atk.update(DT, f.ai, player);
  }
}
/** Run until `f` winds up a ring - any other wind-up is wiped and the foe tries again. */
function untilRing(f, player, secs = 240) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    run(f, DT, player);
    const b = f.ai._tac?.state === 'windup' ? liveBlows().get(f.ai) : null;
    if (b?.kind === 'ring') return b;
    if (b) { resetTactics(); resetBlows(); f.ai._tac = null; f.ai._blowHold = false; f.ai._blowWind = false; }
  }
  return null;
}
function pinned(r, fn) { const had = Math.random; Math.random = () => r; try { return fn(); } finally { Math.random = had; } }

test('TELL6a: ON THE MOTOR an elite giant\'s ring lands on a player in its annulus - iron, red, its feet its own mark\'s centre (mutants: the ring never thrown; its verdict faced)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const b = untilRing(f, player);
  assert.ok(b, 'it wound a ring up');
  assert.equal(b.guard, 'iron');
  assert.equal(b.color, IRON_COLOR);
  const d = Math.hypot(player[0] - b.origin[0], player[2] - b.origin[2]);
  assert.ok(d > BLOW.ring.rIn && d < BLOW.ring.rOut, `I stood in its annulus (${d.toFixed(2)})`);
  let verdict = null;
  pinned(0.9, () => { for (let i = 0; i < 120 && verdict == null; i++) { run(f, DT, player); if (f.ai._blowVerdict != null) verdict = f.ai._blowVerdict; } });
  assert.equal(verdict, true);
});

test('TELL6a: ON THE MOTOR the hug answers the ring - a player at its feet is missed, and its iron window opens (mutants: the feet in the ring)', () => {
  const f = foe();
  const player = [0, 0, 0];
  const b = untilRing(f, player);
  assert.ok(b);
  const ux = (b.origin[0] - player[0]), uz = (b.origin[2] - player[2]), l = Math.hypot(ux, uz);
  player[0] = b.origin[0] - (ux / l) * 0.8; player[2] = b.origin[2] - (uz / l) * 0.8;   // in to its feet
  pinned(0.9, () => run(f, b.land - T + 0.1, player));   // 0.9: no chain - this pins the miss
  assert.equal(f.ai._tac.state, 'overreach');
  assert.ok(Math.abs(f.ai._tac.until - (f.ai._blowLandedAt + punishSeconds('ring', 'iron'))) < 1e-9, 'a second, iron\'s 0.3 s more');
});
