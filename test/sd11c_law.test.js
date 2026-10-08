// SD11c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's AUDIT SD II): THE
// REMNANT'S LAW, ITS UNTESTED ARMS (the lens on the tests, L8 G5, G6, G7, G12) - the Echoes' and the Hearts' belief (a
// pose in the arena, a melee blow within reach of the body it meets), the one hand every body shares (four blows a
// second; one blow's number counted once across the bodies it meets), a fighter away from the arena taking its share out
// and back, and a body that has used its one blow twice running walking in. Each was pinned only by a count of call
// sites or by nothing: a refusal neutered with its text kept survived on all three bodies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newRemnantFight, joinRemnant, stepRemnant, applyRemnantHit, applyEchoHit, applyHeartHit, heartsOpen, blowsFor,
  SD_PHASE_AT, SD_OPENING_MS, SD_BREAK_MS, SD_ECHO_SPOTS, SD_ECHO, SD_HEART, SD_BLOWS,
} from '../src/net/sdRemnant.js';
import { HIT_KINDS, MELEE_REACH, POSE_SLACK, GATE_HIT_HZ_MAX, ABSENT_RETIRE_MS, REPEAT_MAX } from '../src/net/gateBrain.js';
import { SD_ARENA } from '../src/net/sdBrain.js';

const T0 = 1_800_000_000_000;
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const here = (subs, at) => subs.map((sub, k) => ({ sub, x: at[k]?.[0] ?? 0, z: at[k]?.[1] ?? -12, dead: false }));

/** A fight of `subs` woken past its opening; `phase` 2 (the Dragon Break, its Echoes up) or 3 (the Last Moment, a Reset's
 *  Hearts standing) when asked. Answers the fight and the instant it stands at. */
function fightAt(phase = 1, subs = ['a', 'b'], seed = 3) {
  const rng = seeded(seed), f = newRemnantFight(4, 1, T0);
  for (const sub of subs) joinRemnant(f, sub, sub.toUpperCase(), 30, T0);
  const at = subs.map((_, k) => [k * 2, -12]);
  let now = T0 + SD_OPENING_MS + 250;
  stepRemnant(f, now, here(subs, at), rng);
  if (phase >= 2) {
    f.hp = SD_PHASE_AT[0] * f.max - 1;
    now += 250; stepRemnant(f, now, here(subs, at), rng);
    assert.equal(f.phase, 2);
    now += SD_BREAK_MS + 250; stepRemnant(f, now, here(subs, at), rng);
  }
  if (phase >= 3) {
    for (const E of f.ec) { E.h = 0; E.downAt = now; }
    now += 250; stepRemnant(f, now, here(subs, at), rng);
    assert.equal(f.phase, 3);
    f.outUntil = 0; f.resetAt = now; f.rem.nextAt = 0; f.rem.atk = null; f.rem.mv = null;
    now += 250; stepRemnant(f, now, here(subs, at), rng);
    assert.ok(f.cx && heartsOpen(f, now), 'a Reset winding up, its Hearts standing');
  }
  return { f, now };
}

test('SD11c THE ECHOES AND THE HEARTS BELIEVE A POSE IN THE ARENA, AND A MELEE BLOW IN REACH (L8 G5): a melee blow on an Echo from ten metres is nothing, from two it lands; a spell from off the arena is nothing; the same for a Heart - believed as a blow on the Remnant is (mutants: the reach unread; the pose unread)', () => {
  const { f, now } = fightAt(2);
  const [ex, ez] = SD_ECHO_SPOTS[0];
  const h0 = f.ec[0].h;
  const reach = MELEE_REACH + POSE_SLACK + SD_ECHO.r;
  assert.deepEqual(applyEchoHit(f, 'a', 0, 10, HIT_KINDS.Melee, { x: ex + reach + 0.5, z: ez }, now, 1), []);
  assert.equal(f.ec[0].h, h0, 'out of reach: nothing');
  applyEchoHit(f, 'a', 0, 10, HIT_KINDS.Melee, { x: ex + 2, z: ez }, now + 300, 2);
  assert.equal(f.ec[0].h, h0 - 10, 'in reach: it lands');
  applyEchoHit(f, 'b', 0, 10, HIT_KINDS.Spell, { x: 0, z: SD_ARENA.r + POSE_SLACK + 1 }, now + 300, 3);
  assert.equal(f.ec[0].h, h0 - 10, 'off the arena: nothing, whatever the kind');
  applyEchoHit(f, 'b', 0, 10, HIT_KINDS.Spell, { x: ex + 20, z: ez }, now + 600, 4);
  assert.equal(f.ec[0].h, h0 - 20, 'a spell from across the arena: it lands');
  // a Heart
  const g = fightAt(3);
  const q = g.f.cx.c[0], qh = q.h;
  const hr = MELEE_REACH + POSE_SLACK + SD_HEART.r;
  const dir = Math.hypot(q.x, q.z) > 1 ? [q.x / Math.hypot(q.x, q.z), q.z / Math.hypot(q.x, q.z)] : [1, 0];
  const toward = (r) => ({ x: q.x - dir[0] * r, z: q.z - dir[1] * r });   // toward the centre - always inside the arena
  assert.deepEqual(applyHeartHit(g.f, 'a', 0, 5, HIT_KINDS.Melee, toward(hr + 0.5), g.now, 11), []);
  assert.equal(q.h, qh, 'out of reach: nothing');
  applyHeartHit(g.f, 'a', 0, 5, HIT_KINDS.Melee, toward(1), g.now + 300, 12);
  assert.equal(q.h, qh - 5, 'in reach: it lands');
  applyHeartHit(g.f, 'b', 0, 5, HIT_KINDS.Spell, { x: SD_ARENA.r + POSE_SLACK + 1, z: 0 }, g.now + 300, 13);
  assert.equal(q.h, qh - 5, 'off the arena: nothing');
});

test('SD11c ONE HAND FOR EVERY BODY (L8 G6): the fifth blow inside a second is nothing - on the Remnant, on an Echo and on a Heart; one blow\'s number that meets both Echoes is one blow (counted once, the second rides it) - pinned before by a count of call sites alone, which a refusal neutered with its text kept survived on all three (mutants: the hand unread on each body; each body charged)', () => {
  assert.equal(GATE_HIT_HZ_MAX, 4);
  // the Remnant
  const r = fightAt(1);
  const pose = { x: 0, z: -4 };
  const landed = [1, 2, 3, 4, 5].map((q) => applyRemnantHit(r.f, 'a', 1, HIT_KINDS.Spell, pose, r.now, q));
  assert.deepEqual(landed, [1, 1, 1, 1, 0], 'four a second, the fifth nothing');
  assert.equal(applyRemnantHit(r.f, 'a', 1, HIT_KINDS.Spell, pose, r.now + 250, 6), 1, 'a quarter second on: a token back');
  // an Echo
  const e = fightAt(2);
  const h0 = e.f.ec[0].h;
  for (let q = 1; q <= 5; q++) applyEchoHit(e.f, 'a', 0, 1, HIT_KINDS.Spell, pose, e.now, q);
  assert.equal(e.f.ec[0].h, h0 - 4, 'four landed, the fifth nothing');
  // one number meeting both Echoes is one blow
  const p = fightAt(2);
  const g0 = p.f.ec[0].h, s0 = p.f.ec[1].h;
  for (let q = 1; q <= 3; q++) applyEchoHit(p.f, 'a', 0, 1, HIT_KINDS.Spell, pose, p.now, q);
  applyEchoHit(p.f, 'a', 0, 1, HIT_KINDS.Spell, pose, p.now, 4);
  applyEchoHit(p.f, 'a', 1, 1, HIT_KINDS.Spell, pose, p.now, 4);
  assert.deepEqual([p.f.ec[0].h, p.f.ec[1].h], [g0 - 4, s0 - 1], 'the fourth blow met both - one token');
  applyEchoHit(p.f, 'a', 1, 1, HIT_KINDS.Spell, pose, p.now, 5);
  assert.equal(p.f.ec[1].h, s0 - 1, 'the fifth number: nothing');
  // a Heart
  const x = fightAt(3);
  const hearts = x.f.cx.c;
  for (const o of hearts) o.h = 100;
  for (let q = 1; q <= 5; q++) applyHeartHit(x.f, 'a', 0, 1, HIT_KINDS.Spell, pose, x.now, q);
  assert.equal(hearts[0].h, 96, 'four landed, the fifth nothing');
});

test('SD11c A FIGHTER AWAY TAKES ITS SHARE OUT, AND BRINGS IT BACK (L8 G7): a fighter whose body stands off the arena for ABSENT_RETIRE_MS takes its share out of the Remnant at the fraction it stands at - in the Dragon Break the Echoes rescaled with it; back in the arena, its share comes back at the fraction it stands at then (a return never heals) (mutants: never retired; retired whole; restored whole)', () => {
  assert.equal(ABSENT_RETIRE_MS, 30_000);
  const rng = seeded(5), f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0); joinRemnant(f, 'b', 'B', 30, T0);
  const share = f.players.b.share;
  const max0 = f.max;
  let now = T0 + SD_OPENING_MS + 250;
  const at = (bx, bz) => [{ sub: 'a', x: 0, z: -12, dead: false }, { sub: 'b', x: bx, z: bz, dead: false }];
  stepRemnant(f, now, at(2, -12), rng);
  f.hp = 0.8 * f.max;   // struck down to four fifths
  const away = [0, SD_ARENA.r + 40];   // back at the Threshold: off the arena
  for (let t = 0; t <= ABSENT_RETIRE_MS; t += 1000) { now += 1000; stepRemnant(f, now, at(...away), rng); }
  assert.equal(f.players.b.retired, true, 'away past its time: retired');
  assert.ok(Math.abs(f.max - (max0 - share)) < 1e-6, 'its share out of the whole');
  const hpOut = f.hp;
  assert.ok(Math.abs(hpOut - 0.8 * (max0 - share)) < 1e-3 * max0, 'at the fraction it stood at');
  now += 1000; stepRemnant(f, now, at(2, -12), rng);
  assert.equal(f.players.b.retired, false, 'back in the arena: restored');
  assert.ok(Math.abs(f.max - max0) < 1e-6);
  assert.ok(f.hp <= 0.8 * max0 + 1e-6 && f.hp >= hpOut, 'at the fraction it stands at - never a heal past it');
  // in the Dragon Break the Echoes rescale with the share
  const e = fightAt(2, ['a', 'b']);
  const before = e.f.ec.map((E) => E.h);
  const pool = (g) => Math.max(0, g.hp - SD_PHASE_AT[1] * g.max);
  let t = e.now;
  for (let s = 0; s <= ABSENT_RETIRE_MS; s += 1000) { t += 1000; stepRemnant(e.f, t, [{ sub: 'a', x: 0, z: -12, dead: false }, { sub: 'b', x: 0, z: SD_ARENA.r + 40, dead: false }], seeded(9)); }
  assert.equal(e.f.players.b.retired, true);
  const after = e.f.ec.map((E) => E.h);
  assert.ok(after[0] < before[0] && after[1] < before[1], 'both Echoes smaller');
  assert.ok(Math.abs(after[0] + after[1] - pool(e.f)) < 1e-6, 'and still the break\'s pool');
});

test('SD11c NEVER A BLOW THRICE RUNNING (L8 G12): a body whose one blow in reach is the one it has used REPEAT_MAX times running has none, and walks in; once, it may use it again; another in reach is always chosen first (the Testing row claimed this pinned, and no test reached it) (mutants: the run unread)', () => {
  assert.equal(REPEAT_MAX, 2);
  const V = SD_BLOWS.volley.id;
  assert.deepEqual(blowsFor(20, V, 2, true), [], 'a paired Echo at range, the Volley twice running: nothing');
  assert.deepEqual(blowsFor(20, V, 1, true).map((A) => A.id), [V], 'once: again');
  assert.deepEqual(blowsFor(20, V, 2, false).map((A) => A.id), [SD_BLOWS.hand.id], 'unpaired: the Hand instead');
  assert.deepEqual(blowsFor(3, SD_BLOWS.stomp.id, 5, false).map((A) => A.id), [SD_BLOWS.hand.id, V], 'close in, others first');
});
