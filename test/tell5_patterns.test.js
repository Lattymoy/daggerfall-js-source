// TELL5 - PATTERNS: LENGTH, TRACKING, FEINTS, CHAINS (bible/12-Enhanced-AI/Feud-Arc.md section 7; Mac, 2026-10-04:
// "breath more depth into it", then "Go" on every call). Before it every wind-up of a shape was one length, aimed once,
// honest and alone - learnt in a fight and beaten by rote. Now its length is drawn (an elite's quicker, a revenant's
// by its rank, never under 0.55 s); a lunge turns after its target through the first half of its wind-up; a blade of
// the higher tier feints one wind-up in five (cut at 0.55, a plain blow at once, no glint, no WIND - the body never
// lies); and a brute of the higher tier, an elite or a revenant of rank 3 chains a second blow at its landing.
// The law (the lengths, the tiers, the families, the shapes a chain takes, the turn); on the real motor (a drawn length,
// a lunge tracking then locking and a sweep never turning, a feint cut into a plain blow with no verdict and no
// overreach, no feint from an ordinary foe, a chain from the new facing holding the one-at-a-time and the punish
// window for its last, a break ending it, no chain from an ordinary foe); the ground's dashed fade; the ear.
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
import { setTacticsClock, resetTactics, noteLocalPlayer, windupStruck, foeGlint } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, makeBlow, blowPhase, drawableBlows, windupNear, blowFamily, blowConnects, BLOW } from '../src/ai/foeBlows.js';
import { TELL_FEINT_FADE } from '../src/ai/blowShapes.js';
import { TELL, windupSeconds, isElite, higherTier, revenantRank, feints, chains, chainShape, trackYaw } from '../src/ai/tells.js';
import { tellCues } from '../src/scenes/hostCombat.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

// ── the law ─────────────────────────────────────────────────────────

test('TELL5: a wind-up\'s length - its shape\'s times U(0.9, 1.25), an elite\'s x0.9, a revenant\'s less 3% a rank, iron\'s 0.2 s after, never under 0.55 s; a chain\'s 0.5 s, never under 0.45 (mutants: any leg moved)', () => {
  assert.ok(near(windupSeconds(0.8, null, { roll: 0 }), 0.72));
  assert.ok(near(windupSeconds(0.8, null, { roll: 1 }), 1.0));
  assert.ok(near(windupSeconds(0.8, { eliteFoe: true }, { roll: 0 }), 0.648));
  assert.ok(near(windupSeconds(0.8, { elite: true }, { roll: 0 }), 0.648), 'an Elite Dungeon\'s foe is an elite here');
  assert.ok(near(windupSeconds(0.8, { revenant: { rank: 3 } }, { roll: 1 }), 0.91));
  assert.ok(near(windupSeconds(0.7, { eliteFoe: true, revenant: { rank: 5 } }, { roll: 0 }), 0.55), 'floored');
  assert.ok(near(windupSeconds(0.7, { eliteFoe: true, revenant: { rank: 5 } }, { roll: 0, guard: 'iron' }), 0.68195), 'iron\'s extra after, then the floor');
  assert.ok(near(windupSeconds(TELL.CHAIN_WINDUP, null, { roll: null, floor: TELL.CHAIN_FLOOR }), 0.5), 'a chain: no draw');
  assert.ok(near(windupSeconds(TELL.CHAIN_WINDUP, { eliteFoe: true, revenant: { rank: 3 } }, { roll: null, floor: TELL.CHAIN_FLOOR }), 0.45));
  const b = makeBlow('sweep', [0, 0, 0], 0, 10, null, 'poise', 0.93);
  assert.ok(near(b.land, 10.93), 'the mark fills on the drawn length');
  assert.ok(near(makeBlow('sweep', [0, 0, 0], 0, 10).land, 10 + BLOW.sweep.windup), 'none drawn: the shape\'s own');
});

test('TELL5: the tiers and the families - an elite (either flag), a champion, a revenant of rank 2 the higher tier; blades feint, brutes and elites and rank-3 revenants chain, given two shapes (mutants: the tier widened; the gap ignored)', () => {
  assert.equal(isElite({ eliteFoe: true }), true);
  assert.equal(isElite({ elite: true }), true);
  assert.equal(isElite({ level: 30 }), false);
  assert.equal(revenantRank({ revenant: { rank: 4 } }), 4);
  assert.equal(revenantRank({}), 0);
  assert.equal(higherTier({ champion: 'mighty' }), true);
  assert.equal(higherTier({ revenant: { rank: 2 } }), true);
  assert.equal(higherTier({ revenant: { rank: 1 } }), false);
  assert.equal(higherTier({ level: 25 }), false, 'never an ordinary foe of the tier');
  assert.equal(blowFamily(M.Orc), 'blade');
  assert.equal(blowFamily(M.Giant), 'brute');
  assert.equal(blowFamily(M.GrizzlyBear), 'beast');
  assert.equal(blowFamily(M.Warrior), 'blade', 'a class foe');
  assert.equal(blowFamily(M.Mage), null, 'a caster throws none');
  assert.equal(blowFamily(M.Rat), null);
  assert.equal(feints('blade', { eliteFoe: true }, 3), true);
  assert.equal(feints('blade', { eliteFoe: true }, 2), false, 'never two within three wind-ups');
  assert.equal(feints('brute', { eliteFoe: true }), false);
  assert.equal(feints('blade', { level: 20 }), false);
  const two = ['slam', 'sweep'];
  assert.equal(chains('brute', { champion: 'mighty' }, two), true);
  assert.equal(chains('brute', { level: 20 }, two), false);
  assert.equal(chains('blade', { elite: true }, ['sweep', 'lunge']), true, 'an elite of any family');
  assert.equal(chains('blade', { champion: 'mighty' }, ['sweep', 'lunge']), false, 'a champion blade: no');
  assert.equal(chains('blade', { revenant: { rank: 3 } }, ['sweep', 'lunge']), true);
  assert.equal(chains('beast', { eliteFoe: true }, ['lunge']), false, 'one shape: nothing to chain to');
  assert.equal(chainShape('sweep', ['sweep', 'lunge']), 'lunge');
  assert.equal(chainShape('slam', ['slam', 'sweep']), 'sweep');
  assert.equal(chainShape('ring', ['ring', 'slam', 'sweep']), 'slam');
  assert.equal(chainShape('lunge', ['sweep', 'lunge']), 'sweep');
  assert.equal(chainShape('ring', ['ring', 'sweep']), 'sweep', 'its law\'s missing: another of its own');
  assert.equal(chainShape('lunge', ['lunge']), null);
});

test('TELL5: the turn - at most 120 degrees a second, the short way round (mutants: the rate; the long way)', () => {
  const rate = (120 * Math.PI) / 180;
  assert.ok(near(trackYaw(0, 1, 0.1), rate * 0.1));
  assert.ok(near(trackYaw(0, -1, 0.1), -rate * 0.1));
  assert.ok(near(trackYaw(0, 0.05, 1), 0.05), 'no further than its target');
  assert.ok(trackYaw(3, -3, 0.01) > 3, 'across the seam, the short way');
  assert.equal(trackYaw(0, 1, -1), 0);
});

// ── on the real motor ───────────────────────────────────────────────

function foe({ level = 12, mobileType = M.Orc, at = [0, 0, 8], ent: extra = {} } = {}) {
  const c = new Collider(() => 0);
  const ent = { health: 300, maxHealth: 300, mobileType, level, ...extra };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  return { ai, atk, ent, c, mobileType, entity: ent, mobile: { meleeSeq: 0 } };
}
function run(foes, secs, player, each = null) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    for (const f of foes) {
      f.ai.update(DT, player); f.atk.update(DT, f.ai, player);
      // PIN MOVED (AUDIT TELL B9: a chain waits for its first blow's verdict to be spent) - the host's door spends it at
      // the sprite's strike, a frame step after the landing (this rig has no sprite)
      if (f.ai._blowVerdict != null && T - (f.ai._blowAt ?? T) >= 0.1) blowConnects(f.ai, false, T);
    }
    each?.(s);
  }
}
/** Math.random pinned at `r` while `fn` runs (0.05: a blow's chance passes, the first shape, a feint, a chain, an
 *  elite's iron). */
function pinned(r, fn) {
  const had = Math.random;
  Math.random = () => r;
  try { return fn(); } finally { Math.random = had; }
}
function untilWindup(f, player, secs = 60) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    run([f], DT, player);
    if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai) ?? null;
  }
  return null;
}

test('TELL5: ON THE MOTOR a wind-up\'s length is drawn at its start - an ordinary orc\'s, an elite\'s quicker on the same roll (mutants: the length undrawn; the elite\'s ignored)', () => {
  const o = foe();
  const ob = pinned(0.05, () => untilWindup(o, [0, 0, 0]));
  assert.ok(ob);
  assert.ok(near(ob.land - ob.start, windupSeconds(BLOW[ob.kind].windup, o.ent, { roll: 0.05 })));
  resetTactics(); resetBlows();
  const e = foe({ ent: { eliteFoe: true } });
  const eb = pinned(0.05, () => untilWindup(e, [0, 0, 0]));
  assert.ok(near(eb.land - eb.start, windupSeconds(BLOW[eb.kind].windup, e.ent, { roll: 0.05, guard: eb.guard })));
  assert.ok(eb.land - eb.start < BLOW[eb.kind].windup + (eb.guard === 'iron' ? TELL.IRON_EXTRA : 0));
});

test('TELL5: A LUNGE TRACKS - it turns after my sidestep at 120 degrees a second through the first half of its wind-up, the foe turning with its mark; then it locks (mutants: no tracking; tracking to the end)', () => {
  const f = foe({ mobileType: M.GrizzlyBear });   // a beast: the lunge alone
  const player = [0, 0, 0];
  const b = pinned(0.05, () => untilWindup(f, player));
  assert.equal(b?.kind, 'lunge');
  const y0 = b.yaw, lockAt = b.start + TELL.TRACK_SHARE * (b.land - b.start);
  player[0] += 3;   // a sidestep the moment the mark appears
  let yawAtLock = null, foeYawOk = true;
  run([f], b.land - T + 0.05, player, () => {
    if (yawAtLock == null && T >= lockAt + 0.07) yawAtLock = b.yaw;
    if (f.ai._tac.state === 'windup' && Math.abs(f.ai.yaw - b.yaw) > 1e-9 && b.yaw !== y0) foeYawOk = false;
  });
  const turned = Math.abs(b.yaw - y0);
  assert.ok(turned > 0.2, `it turned after me (${turned.toFixed(3)})`);
  assert.ok(turned <= (TELL.TRACK_RATE * Math.PI / 180) * (lockAt - b.start + 1 / 16) + 1e-9, 'no faster than its rate, no longer than its share');
  assert.equal(b.yaw, yawAtLock, 'locked from half-way');
  assert.ok(foeYawOk, 'the foe faced its mark');
});

test('TELL5: a sweep never turns - it locks at its start (mutants: every shape tracks)', () => {
  const f = foe();   // an orc: the sweep first on the pinned roll
  const player = [0, 0, 0];
  const b = pinned(0.05, () => untilWindup(f, player));
  assert.equal(b?.kind, 'sweep');
  const y0 = b.yaw;
  player[0] += 3;
  run([f], b.land - T - 0.02, player);
  assert.equal(b.yaw, y0);
});

test('TELL5: A FEINT - a higher-tier blade\'s wind-up cut at 0.55, no glint; a plain blow at once (no verdict, no weight, DFU\'s reach), no overreach; its mark fades out dashed; never one from an ordinary orc (mutants: no cut; the cut weighed; a feint glinting; an overreach after it)', () => {
  const f = foe({ ent: { eliteFoe: true } });
  const player = [0, 0, 0];
  const b = pinned(0.05, () => untilWindup(f, player));
  assert.equal(b?.feint, true, 'a blade of the higher tier, its one in five');
  assert.ok(near(b.cutAt, b.start + TELL.FEINT_AT * (b.land - b.start)));
  assert.equal(foeGlint(f.ai, T), null, 'no glint - the body never lies');
  run([f], b.cutAt - T - 0.02, player);
  assert.equal(f.ai._tac.state, 'windup', 'standing, its mark filling');
  run([f], 0.1, player);
  assert.ok(b.cut != null && b.cut >= b.cutAt, 'cut');
  assert.notEqual(f.ai._tac.state, 'windup');
  assert.notEqual(f.ai._tac.state, 'overreach', 'a feint is no missed blow');
  assert.equal(f.ai._blowVerdict ?? null, null, 'no verdict: DFU\'s reach decides');
  assert.equal(f.ai._blowMult, undefined, 'no weight: DFU\'s damage');
  assert.equal(blowConnects(f.ai, 'classic'), 'classic');
  assert.equal(f.ai._blowHold, false, 'its held swing goes at once');
  const ph = blowPhase(b, b.cut + TELL_FEINT_FADE / 3);
  assert.ok(near(ph.cut, 2 / 3) && near(ph.t, (b.cut - b.start) / (b.land - b.start)) && ph.t >= TELL.FEINT_AT - 1e-9, 'the fill frozen where it stopped (the brain\'s tick past FEINT_AT), fading');
  assert.equal(blowPhase(b, b.cut + TELL_FEINT_FADE + 0.01), null);
  assert.equal(windupNear([0, 0, 0], T), false, 'a cut feint is no wind-up near me');
  drawableBlows(b.cut + 1);
  assert.equal(liveBlows().has(f.ai), false, 'gone once faded');
  // an ordinary orc of the tier, on the same rolls: never a feint
  resetTactics(); resetBlows();
  const o = foe();
  assert.equal(pinned(0.05, () => untilWindup(o, player))?.feint, undefined);
});

test('TELL5: A CHAIN - a higher-tier brute\'s landing (hit or miss) winds a second blow at once from the new facing, its law\'s shape, quick; the gap holds the one-at-a-time; the punish window waits for its last; the chain is one (mutants: no chain; the window after the first; a chain of chains)', () => {
  const f = foe({ mobileType: M.Giant, ent: { champion: 'mighty' } });
  const player = [0, 0, 0];
  const b1 = pinned(0.05, () => untilWindup(f, player));
  assert.equal(b1?.kind, 'slam');
  const wide = [player[0] + 4, 0, player[2] - 1.5];   // out of the slam - a miss
  player[0] = wide[0]; player[2] = wide[2];
  pinned(0.05, () => run([f], b1.land - T + 0.1, player));
  assert.equal(f.ai._tac.state, 'chain', 'the chain, not the punish window');
  assert.equal(f.ai.overreachUntil, 0);
  assert.equal(windupNear([0, 0, 0], T, null), true, 'still its one wind-up near me through the gap');
  pinned(0.05, () => run([f], TELL.CHAIN_GAP + 0.1, player));
  const b2 = liveBlows().get(f.ai);
  assert.equal(f.ai._tac.state, 'windup');
  assert.notEqual(b2, b1);
  assert.equal(b2.kind, 'sweep', 'a slam then a sweep');
  assert.equal(b2.chain, 1);
  assert.ok(near(b2.land - b2.start, windupSeconds(TELL.CHAIN_WINDUP, f.ent, { guard: b2.guard, roll: null, floor: TELL.CHAIN_FLOOR })), 'quick');
  assert.ok(near(b2.yaw, Math.atan2(player[0] - b2.origin[0], player[2] - b2.origin[2]), 0.05), 'from the new facing');
  const step = [b2.origin[0] + Math.sin(b2.yaw + Math.PI) * 6, 0, b2.origin[2] + Math.cos(b2.yaw + Math.PI) * 6];
  player[0] = step[0]; player[2] = step[2];   // behind it, well out: the chain's last blow misses
  pinned(0.05, () => run([f], b2.land - T + 0.1, player));
  assert.equal(f.ai._tac.state, 'overreach', 'its last blow missed: now the window');
});

test('TELL5: a break ends a chain; an ordinary giant never chains (mutants: the chain through a break; every brute chains)', () => {
  const f = foe({ mobileType: M.Giant, ent: { champion: 'mighty' } });
  const player = [0, 0, 0];
  const b1 = pinned(0.05, () => untilWindup(f, player));
  pinned(0.05, () => run([f], b1.land - T + 0.1 + TELL.CHAIN_GAP + 0.1, player));
  const b2 = liveBlows().get(f.ai);
  assert.equal(b2?.chain, 1);
  assert.equal(b2.guard, 'poise', 'a giant\'s sweep weighs');
  assert.equal(windupStruck(f.ai, f.ent, 3000, 1e9), 'stagger');
  pinned(0.05, () => run([f], 0.5, player));
  assert.notEqual(f.ai._tac.state, 'chain');
  assert.notEqual(f.ai._tac.state, 'windup');
  resetTactics(); resetBlows();
  const o = foe({ mobileType: M.Giant });
  const p2 = [0, 0, 0];
  const ob = pinned(0.05, () => untilWindup(o, p2));
  pinned(0.05, () => run([o], ob.land - T + 0.1, p2));
  assert.notEqual(o.ai._tac.state, 'chain');
});

// ── the ground and the ear ──────────────────────────────────────────

test('TELL5: the ground fades a cut feint out dashed; the ear plays no WIND for a feint and lands its plain blow at the strike (mutants: the fade unset; the feint\'s WIND)', async () => {
  const P = rd('src/render/foeTelegraph.js');
  assert.match(P, /uniform float uCut;/);
  assert.match(P, /if \(uCut > 0\.0\) oColor \*= uCut \* step\(0\.5, fract\(\(across \+ along\) \* 2\.5\)\);/);
  assert.match(P, /gl\.uniform1f\(U\.uCut, phase\.cut > 0 \? phase\.cut : 0\);/);
  const R = ENEMY_BASICS[M.Orc];
  const f = { mobileType: M.Orc, mobile: { meleeSeq: 0 }, ai: { feet: [0, 0, 0], _blowHold: true } };
  const blow = { start: 10, land: 10.8, feint: true };
  f.ai._tac = { state: 'windup', blow };
  const calls = [];
  const a = { play3d: (c) => calls.push(c) };
  assert.deepEqual(tellCues(f, a, 1, 10), [], 'no WIND');
  blow.cut = 10.44;
  f.ai._tac = { state: 'engage', blow: null }; f.ai._blowHold = false;
  assert.deepEqual(tellCues(f, a, 1, 10.45), []);
  f.mobile.meleeSeq++;
  assert.deepEqual(tellCues(f, a, 1, 10.5), [R.attackSound], 'the plain blow sounds at its strike');
});
