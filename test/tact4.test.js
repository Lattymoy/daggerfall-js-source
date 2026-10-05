// TACT4 - TELEGRAPHED BLOWS (bible/12-Enhanced-AI/Tactics-Arc.md; Mac, 2026-10-02: "Introducing new attack patterns and
// smaller telegraphed attacks (like our world boss) but not overdoing it"; his calls: one or two, tier-based - level 10
// and up, or an elite foe). The law of the three shapes, the ground's reading of it, the verdict at the landing, the
// weight on DFU's own damage - and on the real motor and attack component: a foe of the tier winds up and stands it,
// its aim locked, the swing comes at the landing, a step out of the shape dodges it, a knock breaks it, one at a time
// near the player and a cooldown between; below the tier, against another foe, or with the switch off, never.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { setTacticsClock, resetTactics, noteLocalPlayer } from '../src/ai/tactics.js';
import {
  BLOW, blowShapesOf, blowTier, throwsBlows, makeBlow, inBlow, blowPhase, blowConnects, blowScaled, liveBlows, setLiveBlow,
  drawableBlows, resetBlows, windupNear, BLOW_TIER_LEVEL, BLOW_COOLDOWN_MIN, BLOW_FLASH, BLOW_VERDICT_LIFE, BLOW_NEAR,
} from '../src/ai/foeBlows.js';
import { blowField, BLOW_QUAD_HALF } from '../src/render/foeTelegraph.js';
import { TELL } from '../src/ai/tells.js';   // TELL5: the trackers

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

// ── the law ─────────────────────────────────────────────────────────

test('TACT4: who telegraphs - level 10 and up or an elite, of a family that has a shape; one or two shapes each', () => {
  assert.equal(BLOW_TIER_LEVEL, 10);
  assert.equal(blowTier({ level: 9 }), false);
  assert.equal(blowTier({ level: 10 }), true);
  assert.equal(blowTier({ level: 3, elite: true }), true);
  assert.equal(blowTier({ level: 3, eliteFoe: true }), true);
  assert.equal(blowTier(null), false);
  assert.deepEqual(blowShapesOf(M.GrizzlyBear), ['lunge']);
  assert.deepEqual(blowShapesOf(M.Giant), ['slam', 'sweep']);
  assert.deepEqual(blowShapesOf(M.Orc), ['sweep', 'lunge']);
  assert.deepEqual(blowShapesOf(M.Warrior), ['sweep', 'lunge'], 'a class');
  assert.deepEqual(blowShapesOf(M.Knight_CityWatch), ['sweep', 'lunge'], 'the watch');
  for (const n of ['Mage', 'Sorcerer', 'Healer', 'Ghost', 'Wraith', 'Imp', 'GiantBat', 'Rat', 'Lich', 'None']) assert.deepEqual(blowShapesOf(M[n]), [], n);
  for (const k of Object.values(M)) assert.ok(blowShapesOf(k).length <= 2, `one or two (${k})`);
  assert.equal(throwsBlows({ level: 12, mobileType: M.Orc }), true);
  assert.equal(throwsBlows({ level: 12, mobileType: M.Mage }), false);
});

test('TACT4: the shapes - the lunge\'s lane, the sweep\'s cone, the slam\'s disc ahead - facing any way', () => {
  for (const yaw of [0, Math.PI / 2, 2.1, -1.3]) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), wx = -fz, wz = fx;   // ahead, and across
    const at = (along, across) => [3 + fx * along + wx * across, 7 + fz * along + wz * across];
    const lunge = makeBlow('lunge', [3, 0, 7], yaw, 0), sweep = makeBlow('sweep', [3, 0, 7], yaw, 0), slam = makeBlow('slam', [3, 0, 7], yaw, 0);
    const hit = (b, along, across) => inBlow(b, ...at(along, across));
    assert.equal(hit(lunge, BLOW.lunge.len - 0.05, 0), true);
    assert.equal(hit(lunge, BLOW.lunge.len + 0.05, 0), false, 'past its end');
    assert.equal(hit(lunge, 2, BLOW.lunge.halfW + 0.05), false, 'beside the lane');
    assert.equal(hit(lunge, -1, 0), false, 'behind it');
    assert.equal(hit(sweep, 2, 0), true);
    assert.equal(hit(sweep, 1.5 * Math.cos(BLOW.sweep.halfArc - 0.05), 1.5 * Math.sin(BLOW.sweep.halfArc - 0.05)), true, 'inside the arc');
    assert.equal(hit(sweep, 1.5 * Math.cos(BLOW.sweep.halfArc + 0.1), 1.5 * Math.sin(BLOW.sweep.halfArc + 0.1)), false, 'outside the arc');
    assert.equal(hit(sweep, -0.3, 0), true, 'at its feet');
    assert.equal(hit(sweep, BLOW.sweep.r + 0.05, 0), false);
    assert.equal(hit(slam, BLOW.slam.ahead, BLOW.slam.r - 0.05), true);
    assert.equal(hit(slam, BLOW.slam.ahead + BLOW.slam.r + 0.05, 0), false);
    assert.equal(hit(slam, -1.2, 0), false, 'behind it');
  }
  assert.ok(BLOW.lunge.windup >= 0.6 && BLOW.slam.windup <= 0.9 && BLOW.sweep.windup >= 0.6, 'wind-ups of 0.6-0.9 s');
});

test('TACT4: the ground reads the verdict\'s own law - blowField agrees with inBlow point for point, and the quad holds every shape', () => {
  for (const kind of ['lunge', 'sweep', 'slam']) {
    const b = makeBlow(kind, [0, 0, 0], 0, 0);
    let n = 0;
    for (let along = -BLOW_QUAD_HALF; along <= BLOW_QUAD_HALF; along += 0.17) {
      for (let across = -BLOW_QUAD_HALF; across <= BLOW_QUAD_HALF; across += 0.17) {
        const f = blowField(kind, across, along);
        // inBlow's frame: across = -rx*fz + rz*fx with the facing +z, so a point (x, z) = (-across, along)
        assert.equal(f.inside, inBlow(b, -across, along), `${kind} at (${across.toFixed(2)}, ${along.toFixed(2)})`);
        if (f.inside) { n++; assert.ok(Math.abs(across) < BLOW_QUAD_HALF && Math.abs(along) < BLOW_QUAD_HALF); }
      }
    }
    assert.ok(n > 50, `${kind} drew something`);
  }
  const fs = rd('src/render/foeTelegraph.js');
  assert.match(fs, /inside = along >= -0\.3 && along <= uP\.x && abs\(across\) <= uP\.y;/, 'the shader\'s lane is the law\'s');
  assert.match(fs, /inside = d <= uP\.x && \(d < 0\.5 \|\| ang <= uP\.y\);/, '...its cone');
  assert.match(fs, /float d = length\(vec2\(across, along - uP\.y\)\);\n\s*inside = d <= uP\.x;/, '...its disc');
  assert.match(fs, /vec2 w = vec2\(-f\.y, f\.x\);/, 'and across is inBlow\'s across');
});

test('TACT4: the phase - filling through the wind-up, a flash at the landing, gone after it', () => {
  const b = makeBlow('slam', [0, 0, 0], 0, 10);
  assert.deepEqual(blowPhase(b, 10), { t: 0, flash: 0 });
  assert.ok(Math.abs(blowPhase(b, 10 + BLOW.slam.windup / 2).t - 0.5) < 1e-9);
  assert.deepEqual(blowPhase(b, b.land), { t: 1, flash: 1 });
  assert.ok(blowPhase(b, b.land + BLOW_FLASH / 2).flash > 0.4);
  assert.equal(blowPhase(b, b.land + BLOW_FLASH + 0.01), null);
  assert.equal(blowPhase(null, 0), null);
  // the ground's list: in range, and the spent ones dropped from the registry
  const a1 = {}, a2 = {}, a3 = {};
  setLiveBlow(a1, makeBlow('lunge', [0, 0, 0], 0, 10));
  setLiveBlow(a2, makeBlow('lunge', [100, 0, 0], 0, 10));
  setLiveBlow(a3, makeBlow('lunge', [1, 0, 0], 0, 0));
  const list = drawableBlows(10.2, [0, 0, 0], 40);
  assert.equal(list.length, 1, 'the near one; the far one is not drawn, the old one is gone');
  assert.equal(liveBlows().has(a3), false);
  assert.equal(liveBlows().size, 2);
});

test('TACT4: the verdict in place of the reach - spent once, a dodge spends the weight, a stale one ignored; the weight on DFU\'s roll', () => {
  const ai = {};
  assert.equal(blowConnects(ai, true), true, 'no blow: the classic reach');
  assert.equal(blowConnects(ai, false), false);
  assert.equal(blowScaled(ai, 7), 7);
  Object.assign(ai, { _blowVerdict: true, _blowMult: 1.5, _blowAt: 10 });
  assert.equal(blowConnects(ai, false, 10.5), true, 'in the shape: it lands though the reach says no');
  assert.equal(blowConnects(ai, false, 10.6), false, 'once');
  assert.equal(blowScaled(ai, 7), 11, 'x1.5, rounded');
  assert.equal(blowScaled(ai, 7), 7, 'once');
  Object.assign(ai, { _blowVerdict: false, _blowMult: 1.5, _blowAt: 10 });
  assert.equal(blowConnects(ai, true, 10.5), false, 'stepped out: dodged, whatever the reach');
  assert.equal(blowScaled(ai, 7), 7, 'and no weight left over for the next blow');
  Object.assign(ai, { _blowVerdict: true, _blowMult: 1.75, _blowAt: 10 });
  assert.equal(blowConnects(ai, false, 10 + BLOW_VERDICT_LIFE + 0.1), false, 'stale: the classic answer');
  assert.equal(blowScaled(ai, 7), 7);
  Object.assign(ai, { _blowMult: 1.75 });
  assert.equal(blowScaled(ai, 0), 0, 'a roll that missed stays a miss');
  Object.assign(ai, { _blowMult: 1.75 });
  assert.equal(blowScaled(ai, 1), 2);
});

// ── on the real motor ───────────────────────────────────────────────

function foe({ level = 12, mobileType = M.Orc, at = [0, 0, 8] } = {}) {
  const c = new Collider(() => 0);
  const ent = { health: 80, maxHealth: 80, mobileType, level };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  return { ai, atk, ent, c };
}
/** Frames against a player at `player`, noted facing +z each frame; `each(s)` after each. */
function run(foes, secs, player, each = null) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    for (const f of foes) { f.ai.update(DT, player); f.atk.update(DT, f.ai, player); }
    each?.(s);
  }
}
/** Run until `f` starts a wind-up (or `secs` pass); answers the blow. */
function untilWindup(foes, f, player, secs = 60) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    run(foes, DT, player);
    if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai) ?? null;
  }
  return null;
}

test('TACT4: a foe of the tier winds up and stands it, its aim locked; the swing comes at the landing, and standing in the shape it lands', () => {
  const f = foe();
  const player = [0, 0, 0];
  // PIN MOVED (TELL2, bible/12-Enhanced-AI/Feud-Arc.md 4.1): the swing BEGINS with the wind-up (held at its raised arm)
  // and the landing RELEASES it - the brain sees its blow at the landing (`_tacSwung`), never a second swing
  let blow = null, at = null, yaw = null, moved = 0, turned = 0, swingAt = null, verdict = null, tacAt = null, swungAt = null, began = null, seqAtStart = null, seqAtEnd = null, startAt = null, prevSeq = f.atk.swingSeq, prevTac = f.ai._tacSwung ?? 0;
  run([f], 60, player, () => {
    if (!blow && f.ai._tac?.state === 'windup') { blow = liveBlows().get(f.ai); at = [...f.ai.feet]; yaw = f.ai.yaw; startAt = T; seqAtStart = prevSeq; }   // the count before this frame - the swing may begin in the very frame the wind-up does
    prevSeq = f.atk.swingSeq;
    if (blow && began == null && f.atk.swingSeq !== seqAtStart) began = T;
    if (blow && f.ai._tac?.state === 'windup') f.atk.meleeTimer = 99;   // DFU's own clock could not swing now: only the landing can
    if (blow && f.ai._tac?.state === 'windup' && liveBlows().get(f.ai) === blow) {
      moved = Math.max(moved, Math.hypot(f.ai.feet[0] - at[0], f.ai.feet[2] - at[2]));
      turned = Math.max(turned, Math.abs(f.ai.yaw - yaw));
    }
    if (blow && verdict == null && f.ai._blowVerdict != null) { verdict = f.ai._blowVerdict; swingAt = T; tacAt = prevTac; seqAtEnd = f.atk.swingSeq; }   // the count before this frame - the release may come in the landing's own frame
    if (tacAt != null && swungAt == null && (f.ai._tacSwung ?? 0) !== tacAt) swungAt = T;
    prevTac = f.ai._tacSwung ?? 0;
  });
  assert.ok(began != null && began - startAt < 0.13, `the swing began with the wind-up (${startAt}, ${began})`);
  assert.ok(blow, 'it wound one up');
  assert.ok(moved < 0.02, `stood its wind-up (${moved.toFixed(3)})`);
  assert.ok(turned < 1e-9, 'its aim locked');
  assert.equal(verdict, true, 'the player stood in it');
  assert.ok(swingAt >= blow.land - 1e-9 && swingAt - blow.land < 0.1, 'the verdict at the landing');
  assert.ok(swungAt != null && swungAt - swingAt < 0.13, `and the swing released with it (${swungAt})`);
  assert.equal(seqAtEnd, began != null ? seqAtStart + 1 : seqAtEnd, 'the one swing - begun at the wind-up, never a second at the landing');
});

test('TACT4: a step out of the shape during the wind-up dodges it', () => {
  const f = foe();
  const player = [0, 0, 0];
  const blow = untilWindup([f], f, player);
  assert.ok(blow);
  // PIN MOVED (TELL5, bible/12-Enhanced-AI/Feud-Arc.md 7.2): a lunge turns after its target through the first half of its
  // wind-up, then locks - "a sidestep the moment the mark appears no longer beats a lunge". The step comes once its aim
  // is locked (at once for a sweep or a slam, which lock at their start)
  const lockAt = TELL.TRACKERS.includes(blow.kind) ? blow.start + TELL.TRACK_SHARE * (blow.land - blow.start) + 0.07 : 0;
  run([f], Math.max(0, lockAt - T), player);
  const at = [...f.ai.feet], yaw = f.ai.yaw;
  player[0] += 3.5; player[2] -= 1;   // out of every shape's reach from where it aimed
  let verdict = null, moved = 0, turned = 0;
  run([f], 1.5, player, () => {
    if (f.ai._tac?.state === 'windup') {
      moved = Math.max(moved, Math.hypot(f.ai.feet[0] - at[0], f.ai.feet[2] - at[2]));
      turned = Math.max(turned, Math.abs(f.ai.yaw - yaw));
    }
    if (verdict == null && f.ai._blowVerdict != null) verdict = f.ai._blowVerdict;
  });
  assert.equal(verdict, false, 'dodged');
  assert.ok(moved < 0.02, `it did not follow the dodge mid-wind-up (${moved.toFixed(3)})`);
  assert.ok(turned < 1e-9, 'nor turn after it - its aim was locked');
});

test('TACT4: committed - a wind-up lands where it was aimed though the target slips out of its sight behind it', () => {
  const f = foe();
  const player = [0, 0, 0];
  assert.ok(untilWindup([f], f, player));
  // straight behind the foe, out of its field of view
  const back = [-Math.sin(f.ai.yaw) * 2.5, 0, -Math.cos(f.ai.yaw) * 2.5];
  player[0] = f.ai.feet[0] + back[0]; player[2] = f.ai.feet[2] + back[2];
  let verdict = null, sawOut = false;
  run([f], 1.5, player, () => {
    if (!f.ai.inSight) sawOut = true;
    if (verdict == null && f.ai._blowVerdict != null) verdict = f.ai._blowVerdict;
  });
  assert.ok(sawOut, 'it lost sight of him');
  assert.equal(verdict, false, 'it landed (missing him), not broke off');
});

test('TACT4: a knock breaks the wind-up', () => {
  const f = foe();
  const player = [0, 0, 0];
  assert.ok(untilWindup([f], f, player));
  f.ai.knockbackSpeed = 2;   // a landed blow shoves it (the scene's own knock)
  let verdict = null;
  run([f], 2, player, () => { if (verdict == null && f.ai._blowVerdict != null) verdict = f.ai._blowVerdict; });
  assert.equal(verdict, null, 'no blow landed out of it');
  assert.notEqual(f.ai._tac.state, 'windup');
  assert.equal(liveBlows().has(f.ai), false, 'nothing left on the ground');
});

test('TACT4: sparingly - a cooldown between one foe\'s blows, and one wind-up near the player at a time', () => {
  const f = foe();
  const player = [0, 0, 0];
  const starts = [];
  let prev = null;
  run([f], 90, player, () => { const st = f.ai._tac?.state; if (st === 'windup' && prev !== 'windup') starts.push(T); prev = st; });
  assert.ok(starts.length >= 2, `it threw more than one (${starts.length})`);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= BLOW_COOLDOWN_MIN, `a cooldown between (${(starts[i] - starts[i - 1]).toFixed(1)} s)`);
  // two of the tier at the player: never two wind-ups at once
  resetTactics(); resetBlows();
  const a = foe({ at: [0, 0, 8] }), b = foe({ at: [8, 0, 0] });
  b.ai.collider = a.ai.collider;
  let both = 0;
  run([a, b], 90, player, () => { if (a.ai._tac?.state === 'windup' && b.ai._tac?.state === 'windup') both++; });
  assert.equal(both, 0);
  assert.ok(BLOW_NEAR >= 15);
  assert.equal(windupNear([0, 0, 0], T), a.ai._tac?.state === 'windup' || b.ai._tac?.state === 'windup');
});

test('TACT4: one at a time - while another foe winds up near the player, no other begins', () => {
  const other = {};
  const held = makeBlow('slam', [0, 0, 1], 0, 0);
  held.land = 1e9;   // a wind-up that is still running
  setLiveBlow(other, held);
  assert.equal(windupNear([0, 0, 0], 1), true);
  assert.equal(windupNear([0, 0, 0], 1, other), false, 'not counting itself');
  assert.equal(windupNear([BLOW_NEAR + 5, 0, 0], 1), false, 'far off it is no one\'s business');
  const f = foe();
  assert.equal(untilWindup([f], f, [0, 0, 0], 40), null, 'it waits its turn');
  setLiveBlow(other, null);
  assert.ok(untilWindup([f], f, [0, 0, 0], 60), 'and goes once the other is done');
});

test('TACT4: never below the tier, never a caster, never with the switch off', () => {
  for (const [opts, why] of [[{ level: 9 }, 'below the tier'], [{ mobileType: M.Mage }, 'a caster']]) {
    resetTactics(); resetBlows();
    const f = foe(opts);
    assert.equal(untilWindup([f], f, [0, 0, 0], 40), null, why);
  }
  resetTactics(); resetBlows();
  setPref('enhancedAI', false);
  const f = foe();
  assert.equal(untilWindup([f], f, [0, 0, 0], 40), null, 'the switch off');
  assert.equal(f.ai._blowVerdict ?? null, null);
});

// ── the hosts ───────────────────────────────────────────────────────

test('TACT4: every host resolves the blow through the verdict and the weight, and draws the ground under the bodies', () => {
  const ex = rd('src/scenes/exteriorFoes.js');
  assert.match(ex, /if \(blowConnects\(f\.ai, meleeHitConnects\(f\.ai\._dist, f\.ai\.inSight, withinYaw\(f\.ai\.yaw, hdx, hdz, MELEE_HIT_YAW_DEG\)\)\)\) \{/);
  assert.match(ex, /const dmg = blowScaled\(f\.ai, partyHit\(calculateAttackDamage\(f\.entity, playerEntity, \{/);
  const g = rd('src/scenes/cityGuards.js');
  assert.match(g, /if \(blowConnects\(g\.ai, meleeHitConnects\(g\.ai\._dist, g\.ai\.inSight, withinYaw\(g\.ai\.yaw, hdx, hdz, MELEE_HIT_YAW_DEG\)\)\)\) \{/);
  assert.match(g, /const dmg = blowScaled\(g\.ai, calculateAttackDamage\(g\.entity, playerEntity, \{/);
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /if \(!blowConnects\(f\.ai, foeDeps\.meleeHitConnects\(f\.ai\._dist, f\.ai\.inSight, foeDeps\.withinYaw\(f\.ai\.yaw, hdx, hdz, foeDeps\.MELEE_HIT_YAW_DEG\)\)\)\) \{/);
  assert.match(d, /const dmg = blowScaled\(f\.ai, _weighHit\(f, foeDeps\.calculateAttackDamage\(/);
  const a = rd('src/characters/enemyAttack.js');
  assert.match(a, /if \(ai\._blowSwing\) \{\n\s*ai\._blowSwing = false;/, 'the forced swing');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) assert.match(rd(f), /renderer\.drawFoeTelegraphs\?\.\(drawableBlows\(tacticsNow\(\), /, f);
  assert.equal((rd('src/scenes/worldModes.js').match(/renderer\.drawFoeTelegraphs\?\.\(drawableBlows\(tacticsNow\(\), player\.pos\)\);/g) ?? []).length, 2, 'the dungeon\'s pass and the interior\'s');
  assert.match(rd('src/render/renderer.js'), /drawFoeTelegraphs\(list\) \{[\s\S]{0,1200}this\.markForeignPass\(\);/);
});
