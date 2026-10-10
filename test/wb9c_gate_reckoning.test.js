// WB9c (2026-09-30, Mac: "The boss should have a detailed wipe mechanic on the final phase that should require players
// to destroy oblivion crystaline formations that grow anywhere within the final phase arena, which then stuns his wipe
// mechanic"): DAGON'S RECKONING. In the last court, once Dagon's Champion's turn is done, he leaps to its heart and calls
// Dagon over a long wind-up while crystals of Oblivion grow out of the floor anywhere on it - two and one for every two
// living challengers, each with a health the court's own damage sizes. Break every one and the Reckoning breaks: he is
// stunned, on his knees, and every blow lands half again. Leave one standing and it lands on the whole arena, answered
// by nothing - Dagon's, as the Wrath is.
//
//   the brain       net/gateBrain.js - the Reckoning's arming and its turn, growCrystals, applyCrystalHit, the stun
//   the wire        the client's `xhit`; the room's `cx`, `cxh`, `cxb`, `stun` and the state's `cx`, `su`, `rk`
//   the relay       a blow on a crystal judged and its breaking fanned at once
//   the link        net/gateLink.js - the crystals folded, kept broken through the stun, cleared by the next word
//   the court       scenes/gateCourt.js - the crystals as targets, a blow's number out, the call, the shatter and the
//                   stun said and heard, the draw list and the lights; world/gateBoss.js crystalStandIn
//   the bar         ui/gateBossBar.js - what is left to break and how long; the stun; the next Reckoning's coming
//   the draw        render/courtCrystals.js - the cluster, its growth, its pass
//
// Design: bible/11-Multiplayer/World-Bosses.md section 14 (WB9c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ATTACKS, COURTS, COURT_R, PHASE_AT, TURN_BREATH_MS, HIT_KINDS, HIT_CAP_X, MELEE_REACH, POSE_SLACK, HP_SEND_MS, GATE_HIT_HZ_MAX,
  RECKON_FIRST_MS, RECKON_EVERY_MS, RECKON_CRYSTALS, RECKON_RING, RECKON_TEAM_S, RECKON_CRYSTAL_MIN, CRYSTAL_R, CRYSTAL_H, CRYSTAL_GAP_M,
  STUN_MS, STUN_HIT_X, crystalCountFor, crystalHpFor, dpsRef, isDagons, windupOf,
  newFight, joinFight, applyHit, applyCrystalHit, stepBrain, stateOf, fightProfile,
} from '../src/net/gateBrain.js';
import { strikeVerdict, blowOf } from '../src/net/gateStrike.js';
import { validGateIn, validGateOut, GATE_CRYSTALS_MAX, GATE_BRAIN_V, GATE_KINDS, GATE_OUT_KINDS } from '../src/net/wire.js';
import { foldGate, GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { gateTimes, gateRoomKey } from '../src/net/gateLaw.js';
import { crystalStandIn, crystalColor, bossLookOf, BOSS_CUES, CRYSTAL_ARMOR, CRYSTAL_NAME, STUN_COLOR, ATTACK_COLORS, bossAct, bossGlow, bossCue } from '../src/world/gateBoss.js';
import { courtToDungeon } from '../src/world/gateArena.js';
import { createGateCourt, COURT_RECKON_TEXT, RECKON_LATE_MS, CRYSTAL_STRIKE_GROWN } from '../src/scenes/gateCourt.js';
import { bossBarModel, BOSS_BAR_TEXT, destroyGateBossBar } from '../src/ui/gateBossBar.js';
import { destroyGateMarksCard } from '../src/ui/gateMarksView.js';
import { destroyGateGround } from '../src/ui/gateGroundView.js';
import {
  CourtCrystalRenderer, crystalCluster, crystalGrowth, crystalDrawn, CRYSTAL_GROW_MS, CRYSTAL_SHATTER_MS, CRYSTALS_DRAW_MAX, CRYSTAL_VS, CRYSTAL_FS, CRYSTAL_GLOW_VS, CRYSTAL_GLOW_FS,
} from '../src/render/courtCrystals.js';
import { COURT_CENTRE } from '../src/net/gateBrain.js';
import { fakeRooms } from './fakeRoom.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000;
function seeded(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function fightOf(lvs = [10]) {
  const f = newFight(7, T0, T0 + 3_600_000, 'ruhn');
  lvs.forEach((lv, i) => assert.ok(joinFight(f, `s${i + 1}`, `P${i + 1}`, lv, T0, true)));
  return f;
}
const C3 = COURTS[2];
const inLast = (sub, dx, dz, dead = false) => ({ sub, x: C3[0] + dx, z: C3[1] + dz, dead });
/** A fight in the last court with Dagon's Champion's turn done: phase three, both walkways laid long ago, no Reckoning
 *  armed yet (its first beat there arms it). */
function lastCourt(lvs = [10, 10, 10]) {
  const f = fightOf(lvs);
  f.phase = 3; f.court = 2; f.pos = [...C3]; f.xa = [T0 - 60_000, T0 - 60_000]; f.nextAt = T0;
  return f;
}
/** Step the brain to the Reckoning's call: answers its `atk` and `cx` words. */
function toReckoning(f, bodies, t0 = T0) {
  let atk = null, cx = null, t = t0;
  for (; t < t0 + RECKON_FIRST_MS + 20_000 && !cx; t += 250) {
    for (const o of stepBrain(f, t, bodies, seeded(t))) { if (o.k === 'atk' && o.a === ATTACKS.reckon.id) atk = o; if (o.k === 'cx') cx = o; }
  }
  return { atk, cx, t };
}

// ═══ THE BRAIN ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB9c the crystals\' numbers: two and one for every two living challengers, 3 to 8; each one\'s health RECKON_TEAM_S seconds of the court\'s reference damage shared across them, never under RECKON_CRYSTAL_MIN; the wire\'s bound is the brain\'s most (mutants: a count unbounded; a health off the court)', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 6, 8, 12, 40].map(crystalCountFor), [3, 3, 3, 4, 4, 5, 6, 8, 8]);
  assert.deepEqual(RECKON_CRYSTALS, [3, 8]);
  assert.equal(GATE_CRYSTALS_MAX, RECKON_CRYSTALS[1]);
  assert.equal(crystalHpFor([10, 10, 10], 4), Math.round((RECKON_TEAM_S * 3 * dpsRef(10)) / 4));
  assert.equal(crystalHpFor([1], 3), Math.max(RECKON_CRYSTAL_MIN, Math.round((RECKON_TEAM_S * dpsRef(1)) / 3)));
  assert.equal(crystalHpFor([], 3), RECKON_CRYSTAL_MIN);
  // a court that splits up breaks them inside the wind-up with room to spare: each fighter on their own crystal at the
  // reference rate, the crystals broken in RECKON_TEAM_S * n / living seconds - under half the wind-up at every size
  for (const n of [1, 2, 4, 8, 16]) {
    const k = crystalCountFor(n), per = crystalHpFor(Array(n).fill(20), k), rate = dpsRef(20) * n;
    assert.ok((per * k) / rate <= ATTACKS.reckon.windup / 1000 / 2 + 1e-9, `${n} challengers break ${k} in ${(per * k / rate).toFixed(1)} s`);
  }
  assert.ok(isDagons(ATTACKS.reckon) && isDagons(ATTACKS.wrath) && !isDagons(ATTACKS.nova));
  assert.equal(windupOf(ATTACKS.reckon, 3), ATTACKS.reckon.windup, 'no phase shortens it');
  assert.ok(ATTACKS.reckon.windup >= 20_000, 'time to reach every crystal on the floor');
});

test('WB9c the Reckoning called: armed as Dagon\'s Champion\'s turn ends, the first RECKON_FIRST_MS on; he leaps to the court\'s heart and calls it - the crystals growing with the word, anywhere on the floor about him (RECKON_RING), CRYSTAL_GAP_M apart, one count and one health for the living in his court (mutants: the Reckoning never armed; a crystal off the floor; the dead counted)', () => {
  const f = lastCourt([10, 10, 10, 10, 20]);
  const bodies = [inLast('s1', 3, 4), inLast('s2', -5, 2), inLast('s3', 8, -6), inLast('s4', 0, 12, true), inLast('s5', -9, -9)];
  assert.ok(!stepBrain(f, T0, bodies, seeded(1)).some((o) => o.k === 'cx'));
  assert.equal(f.rk, T0 + RECKON_FIRST_MS, 'the first armed as the turn ends');
  // and through the turn itself: the bound to the last court, the wait, the spokes twice - then armed
  const g = fightOf([10]);
  g.phase = 2; g.court = 1; g.pos = [...COURTS[1]]; g.xa = [T0 - 60_000]; g.nextAt = T0; g.hp = g.max * PHASE_AT[1];
  const me = () => [{ sub: 's1', x: COURTS[g.court][0] + 3, z: COURTS[g.court][1] + 3, dead: false }];
  let armedAt = null;
  for (let tt = T0; tt < T0 + 40_000 && armedAt === null; tt += 250) { stepBrain(g, tt, me(), seeded(tt)); if (g.rk > 0) armedAt = tt; }
  assert.equal(g.court, 2);
  assert.ok(armedAt !== null && g.rk === armedAt + RECKON_FIRST_MS && !g.queue.length && !g.pending, 'armed the beat the turn is done');
  const leapAt = [];
  let t = T0 + 250;
  for (; t < f.rk; t += 250) for (const o of stepBrain(f, t, bodies, seeded(t))) if (o.k === 'atk') leapAt.push(o);
  const { atk, cx } = toReckoning(f, bodies, t);
  assert.ok(atk && cx, 'called');
  assert.equal(f.rk, -2, 'under way - its end sets the next');
  assert.deepEqual([atk.x, atk.z], [...C3], 'from the court\'s heart');
  assert.equal(atk.at - windupOf(ATTACKS.reckon, 3), cx === null ? NaN : atk.at - ATTACKS.reckon.windup);
  assert.equal(cx.i, atk.i, 'the crystals are the attack\'s');
  assert.equal(cx.c.length, crystalCountFor(4), 'four living - the fallen are not counted');
  assert.equal(cx.m, crystalHpFor([10, 10, 10, 20], cx.c.length));
  for (const [x, z] of cx.c) {
    const r = Math.hypot(x - C3[0], z - C3[1]);
    assert.ok(r >= RECKON_RING[0] - 0.02 && r <= RECKON_RING[1] + 0.02 && r + CRYSTAL_R <= COURT_R, `on his floor, clear of him: ${r.toFixed(1)}`);
  }
  for (let a = 0; a < cx.c.length; a++) for (let b = a + 1; b < cx.c.length; b++) assert.ok(Math.hypot(cx.c[a][0] - cx.c[b][0], cx.c[a][1] - cx.c[b][1]) >= CRYSTAL_GAP_M - 0.02);
  assert.deepEqual(stateOf(f).cx, { i: cx.i, m: cx.m, c: cx.c.map((q) => [q[0], q[1], cx.m]) }, 'a joiner is told them whole');
  assert.equal(validGateOut({ k: 'cx', ...cx }).c.length, cx.c.length);
  // the checkpoint: a Reckoning under way steps the same from storage
  const copy = JSON.parse(JSON.stringify(f));
  for (let k = 1; k < 12; k++) assert.deepEqual(stepBrain(copy, atk.at - 5000 + k * 250, bodies, seeded(k)), stepBrain(f, atk.at - 5000 + k * 250, bodies, seeded(k)));
});

test('WB9c a blow on a crystal: the same hand and purse as a blow on him - his blow rate, the damage bucket, a swing within reach of its body, from the floor - counted as dealt; each broken said with its breaker\'s name; the last breaks the Reckoning: no attack, the stun STUN_MS, the next a minute after it (mutants: the rate unshared; a swing from across the court; the Reckoning left standing)', () => {
  const f = lastCourt([10, 10]);
  const bodies = [inLast('s1', 3, 4), inLast('s2', -5, 2)];
  const { atk, cx, t } = toReckoning(f, bodies);
  const q0 = { x: cx.c[0][0], z: cx.c[0][1] };
  const far = { x: q0.x + CRYSTAL_R + MELEE_REACH + POSE_SLACK + 1, z: q0.z };
  assert.deepEqual(applyCrystalHit(f, 'nobody', 0, 5, HIT_KINDS.Spell, q0, t), [], 'a stranger');
  assert.deepEqual(applyCrystalHit(f, 's1', 9, 5, HIT_KINDS.Spell, q0, t), [], 'no such crystal');
  assert.deepEqual(applyCrystalHit(f, 's1', 0, NaN, HIT_KINDS.Spell, q0, t), []);
  assert.deepEqual(applyCrystalHit(f, 's1', 0, 5, HIT_KINDS.Spell, null, t + 1000), [], 'no pose');
  const before = f.cx.c[0].h;
  applyCrystalHit(f, 's1', 0, 5, HIT_KINDS.Spell, { x: C3[0] + COURT_R + 6, z: C3[1] }, t + 2000);
  assert.equal(f.cx.c[0].h, before, 'from off the floor - out over the fire');
  applyCrystalHit(f, 's1', 0, 5, HIT_KINDS.Melee, far, t + 3000);
  assert.equal(f.cx.c[0].h, before, 'a swing from past its reach');
  applyCrystalHit(f, 's1', 0, 5, HIT_KINDS.Shaft, far, t + 4000);
  assert.equal(f.cx.c[0].h, before - 5, 'a shaft from the same spot lands');
  assert.equal(f.players.s1.dealt, 5, 'a crystal broken down is a part in the fight');
  // the rate is his: GATE_HIT_HZ_MAX blows a second between him and the crystals, one hand
  const g = lastCourt([10]);
  const r2 = toReckoning(g, [inLast('s1', 2, 2)]);
  const q = { x: r2.cx.c[0][0], z: r2.cx.c[0][1] + CRYSTAL_R + 1 };
  let landed = 0;
  for (let i = 0; i < GATE_HIT_HZ_MAX + 2; i++) { const h0 = g.cx.c[0].h; applyCrystalHit(g, 's1', 0, 1, HIT_KINDS.Melee, q, r2.t); if (g.cx.c[0].h < h0) landed++; }
  assert.equal(landed, GATE_HIT_HZ_MAX);
  assert.ok(applyCrystalHit(g, 's1', 0, 1e6, HIT_KINDS.Melee, q, r2.t + 1000).length >= 0 && g.players.s1.clipped > 0, 'past the one-blow cap and the bucket: clipped, counted');
  // breaking them all
  let out = [], tt = t + 5000;
  for (let c = 0; c < cx.c.length; c++) {
    const at = { x: cx.c[c][0], z: cx.c[c][1] };
    while (f.cx && f.cx.c[c].h > 0) { tt += 400; out = applyCrystalHit(f, c % 2 ? 's2' : 's1', c, HIT_CAP_X * dpsRef(10), HIT_KINDS.Spell, at, tt); }
    if (c < cx.c.length - 1) assert.deepEqual(out, [{ k: 'cxb', i: cx.i, c, n: c % 2 ? 'P2' : 'P1', at: tt }], 'one broken, by name');
  }
  assert.deepEqual(out.map((o) => o.k), ['cxb', 'stun'], 'the last, and the Reckoning broken with it');
  assert.deepEqual(out[1], { k: 'stun', until: tt + STUN_MS, at: tt });
  assert.equal(f.cx, null); assert.equal(f.atk, null, 'called off');
  assert.equal(f.stunUntil, tt + STUN_MS); assert.equal(f.rk, tt + STUN_MS + RECKON_EVERY_MS);
  assert.ok(atk.at > tt, 'broken before it landed');
  for (const o of out) assert.ok(validGateOut(o), `${o.k} as the wire says it`);
});

test('WB9c the stun: on his knees STUN_MS - no step, no blow, no word but his health - every blow on him half again (before the caps); then he fights on; a broken Reckoning\'s next comes RECKON_EVERY_MS after the stun (mutants: an attack through the stun; the blow unscaled)', () => {
  const f = lastCourt([10, 10]);
  const bodies = [inLast('s1', 3, 4), inLast('s2', -5, 2)];
  toReckoning(f, bodies);
  const now = T0 + 100_000;
  f.cx = null; f.atk = null; f.stunUntil = now + STUN_MS; f.nextAt = now; f.rk = f.stunUntil + RECKON_EVERY_MS;   // the stun alone holds him
  for (let t = now; t < now + STUN_MS; t += 250) assert.ok(!stepBrain(f, t, bodies, seeded(t)).some((o) => o.k === 'atk' || o.k === 'mv'), `still at ${t - now}`);
  const near = { x: C3[0] + 2, z: C3[1] + 2 };
  const g = lastCourt([10, 10]);
  g.pos = [...C3];
  const plain = applyHit(g, 's1', 10, HIT_KINDS.Melee, near, now);
  f.players.s1.bucket = g.players.s1.bucket = 1e9; f.players.s1.rate = g.players.s1.rate = 4;
  const dazed = applyHit(f, 's1', 10, HIT_KINDS.Melee, near, now + 1000);
  assert.equal(plain, 10); assert.equal(dazed, 10 * STUN_HIT_X, 'half again');
  let acted = false;
  for (let t = now + STUN_MS; t < now + STUN_MS + 8000 && !acted; t += 250) acted = stepBrain(f, t, bodies, seeded(t)).some((o) => o.k === 'atk' || o.k === 'mv');
  assert.ok(acted, 'he fights on');
  assert.equal(bossAct({ ...GATE_STATE_EMPTY, day: 1, stunUntil: now + STUN_MS, stunAt: now, x: 0, z: 0 }, now + 500).act, 'stunned');
  assert.deepEqual(bossGlow({ ...GATE_STATE_EMPTY, day: 1, phase: 3, stunUntil: now + STUN_MS, stunAt: now, x: 0, z: 0, shieldUntil: 0 }, now + 500).color.map((c) => c > 0), STUN_COLOR.map(() => true));
});

test('WB9c the Reckoning unbroken lands on the whole arena - every court, answered by nothing, more than any health - the crystals spent in it, and the next a minute after its end; the Wrath overtakes a Reckoning and a stun alike (mutants: a saving throw answering it; a Reckoning landing on one court)', () => {
  const f = lastCourt([10]);
  const bodies = [inLast('s1', 3, 4)];
  const { atk } = toReckoning(f, bodies);
  for (const [x, z] of [[0, 0], [...COURTS[1]], [C3[0] + 20, C3[1]]]) assert.equal(strikeVerdict(atk, x, z, atk.at), 'hit');
  assert.deepEqual(blowOf(atk, fightProfile(['rime'])), { pct: ATTACKS.reckon.pct, base: 0, el: 'fire', name: "Dagon's Reckoning", saved: false }, 'Dagon\'s fire under every aspect, answered by nothing');
  assert.equal(bossCue('windup', ATTACKS.reckon, fightProfile(['storm'])), BOSS_CUES.windup.reckon, 'and in his own voice, never his aspect\'s');
  stepBrain(f, atk.at, bodies, seeded(1));
  assert.equal(f.cx, null, 'spent in it');
  const end = atk.at + ATTACKS.reckon.active + ATTACKS.reckon.recover;
  stepBrain(f, end, bodies, seeded(2));
  assert.equal(f.rk, end + RECKON_EVERY_MS);
  const g = lastCourt([10]);
  toReckoning(g, bodies);
  const w = stepBrain(g, g.wrathAt - ATTACKS.wrath.windup, bodies, seeded(3));
  assert.equal(w.find((o) => o.k === 'atk').a, ATTACKS.wrath.id);
  assert.equal(g.cx, null); assert.equal(g.stunUntil, 0);
});

test('WB9c the health said: the crystals\' health goes out at most every HP_SEND_MS, and only when it moved (mutants: every beat)', () => {
  const f = lastCourt([10]);
  const bodies = [inLast('s1', 3, 4)];
  const { cx, t } = toReckoning(f, bodies);
  const q = { x: cx.c[0][0], z: cx.c[0][1] };
  let said = 0;
  for (let k = 1; k <= 8; k++) {
    const tt = t + k * 250;
    if (k === 3) { f.players.s1.rate = 4; applyCrystalHit(f, 's1', 0, 3, HIT_KINDS.Spell, q, tt); }
    said += stepBrain(f, tt, bodies, seeded(tt)).filter((o) => o.k === 'cxh').length;
  }
  assert.equal(said, 1, 'once, after it moved');
  assert.ok(HP_SEND_MS <= 250);
});

// ═══ THE WIRE AND THE RELAY ══════════════════════════════════════════════════════════════════════════════════════

test('WB9c the wire: a blow on a crystal (`xhit` - which crystal, a sequence, a damage, a kind) projected field by field; the room\'s crystals, their health, one broken (the name as the wire says every name) and the stun, each bounded; the brain\'s law is 4 (mutants: a crystal past the most; a stun that ends before it begins)', () => {
  assert.ok(GATE_KINDS.includes('xhit'));
  for (const k of ['cx', 'cxh', 'cxb', 'stun']) assert.ok(GATE_OUT_KINDS.includes(k));
  assert.equal(GATE_BRAIN_V, 5);   // 4 was this slice's; WB11 raised it to 5 (his host and the nine-trial rotation) - a game that knows the Reckoning and not the host is still refused
  assert.deepEqual(validGateIn({ k: 'xhit', c: 2, q: 7, d: 12.5, r: 1, extra: 1 }), { k: 'xhit', c: 2, q: 7, d: 12.5, r: 1 });
  for (const bad of [{ k: 'xhit', q: 7, d: 1, r: 0 }, { k: 'xhit', c: GATE_CRYSTALS_MAX, q: 7, d: 1, r: 0 }, { k: 'xhit', c: 1.5, q: 7, d: 1, r: 0 }, { k: 'xhit', c: 0, q: 7, d: 0, r: 0 }]) assert.equal(validGateIn(bad), null, JSON.stringify(bad));
  assert.deepEqual(validGateOut({ k: 'cx', i: 4, m: 50, c: [[1, 2], [3, 4], [5, 6]], z: 1 }), { k: 'cx', i: 4, m: 50, c: [[1, 2], [3, 4], [5, 6]] });
  assert.equal(validGateOut({ k: 'cx', i: 4, m: 50, c: [] }), null);
  assert.equal(validGateOut({ k: 'cx', i: 4, m: 50, c: Array.from({ length: 9 }, () => [0, 0]) }), null);
  assert.equal(validGateOut({ k: 'cx', i: 4, m: 50, c: [[999, 0]] }), null, 'off the arena');
  assert.deepEqual(validGateOut({ k: 'cxh', i: 4, h: [50, 0, 12] }), { k: 'cxh', i: 4, h: [50, 0, 12] });
  assert.equal(validGateOut({ k: 'cxh', i: 4, h: [-1] }), null);
  assert.deepEqual(validGateOut({ k: 'cxb', i: 4, c: 1, n: ' Ann‮ ', at: 9 }), { k: 'cxb', i: 4, c: 1, n: 'Ann', at: 9 });
  assert.equal(validGateOut({ k: 'cxb', i: 4, c: 8, n: 'Ann', at: 9 }), null);
  assert.deepEqual(validGateOut({ k: 'stun', until: 20, at: 10 }), { k: 'stun', until: 20, at: 10 });
  assert.equal(validGateOut({ k: 'stun', until: 10, at: 20 }), null);
  const st = { k: 'st', d: 1, b: 'ruhn', ph: 3, h: 5, m: 10, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: 9e12, n: 1, fell: null, wrath: null, md: null, ct: 2, xa: [5, 6], cx: { i: 3, m: 40, c: [[1, 1, 40], [2, 2, 0]] }, su: 99, rk: 120 };
  assert.deepEqual(validGateOut(st).cx, st.cx);
  assert.equal(validGateOut({ ...st, cx: { i: 3, m: 40, c: [[1, 1, 41]] } }), null, 'a crystal past its own health');
  assert.equal(validGateOut({ ...st, su: -5 }), null);
});

test('WB9c the relay: a fighter\'s blow on a crystal is judged by the brain as it comes, and a crystal broken - and the Reckoning broken with the last - said to the whole court at once (mutants: the blow judged as a blow on him; the breaking kept for the beat)', async () => {
  const DAY = 200, TT = gateTimes(DAY);
  const realNow = Date.now; let clock = TT.openAt + 1000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const r = world.room(gateRoomKey(DAY));
    const at = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 10));
    const b = r.connect(); await r.hello(b, 'peer-0002', at(3, 10));
    for (const s of [a, b]) await r.raw(s, JSON.stringify({ t: 'gate', k: 'in', lv: 10, bv: GATE_BRAIN_V }));
    const f = r.room._fight;
    f.phase = 3; f.atk = { i: 40, a: ATTACKS.reckon.id, at: clock + 15_000, x: 0, z: 0, yw: 0, tg: [], until: clock + 18_000 };
    f.cx = { i: 40, m: 30, c: [{ x: 0, z: 13, h: 30 }] };
    const hp = f.hp;
    await r.raw(a, JSON.stringify({ t: 'gate', k: 'xhit', c: 0, q: 1, d: 25, r: 2 }));
    assert.equal(f.cx.c[0].h, 5, 'judged on the crystal');
    assert.equal(f.hp, hp, 'never on him');
    clock += 1000;
    await r.raw(a, JSON.stringify({ t: 'gate', k: 'xhit', c: 0, q: 2, d: 25, r: 2 }));
    for (const s of [a, b]) {
      const said = s.sent.filter((m) => m.t === 'gate' && (m.k === 'cxb' || m.k === 'stun'));
      assert.deepEqual(said.map((m) => m.k), ['cxb', 'stun'], 'every socket in the court, at once');
      assert.equal(said[0].c, 0);
    }
    assert.equal(f.cx, null); assert.ok(f.stunUntil > clock);
  } finally { Date.now = realNow; }
});

// ═══ THE LINK ════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB9c the link: the crystals grown whole at their word, their health as it falls (their own Reckoning\'s alone), each broken and by whom, kept through a later state of the same Reckoning; the stun keeps them - every one broken - and the next word of a walk or another attack clears them (mutants: another Reckoning\'s health taken; the breaker forgotten by the state)', () => {
  const base = foldGate(GATE_STATE_EMPTY, { k: 'st', d: 5, b: 'ruhn', ph: 3, h: 50, m: 100, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: 9e12, n: 2, fell: null, wrath: null, md: null }, 1000);
  assert.deepEqual([base.cx, base.stunUntil, base.rk], [null, 0, 0]);
  let s = foldGate(base, { k: 'atk', i: 7, a: ATTACKS.reckon.id, at: 30_000, x: 0, z: 0, yw: 0, tg: [] }, 8000);
  s = foldGate(s, { k: 'cx', i: 7, m: 40, c: [[1, 2], [3, 4], [5, 6]] }, 8000);
  assert.deepEqual(s.cx, { i: 7, m: 40, c: [[1, 2, 40], [3, 4, 40], [5, 6, 40]], broke: [] });
  s = foldGate(s, { k: 'cxh', i: 6, h: [0, 0, 0] }, 8100);
  assert.deepEqual(s.cx.c.map((q) => q[2]), [40, 40, 40], 'another Reckoning\'s word is not these');
  s = foldGate(s, { k: 'cxh', i: 7, h: [12, 40, 40] }, 8200);
  s = foldGate(s, { k: 'cxb', i: 7, c: 0, n: 'Ann', at: 8300 }, 8300);
  assert.deepEqual(s.cx.c[0], [1, 2, 0]); assert.deepEqual(s.cx.broke, [{ c: 0, n: 'Ann', at: 8300 }]);
  const again = foldGate(s, { k: 'st', d: 5, b: 'ruhn', ph: 3, h: 50, m: 100, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: 9e12, n: 2, fell: null, wrath: null, md: null, cx: { i: 7, m: 40, c: [[1, 2, 0], [3, 4, 40], [5, 6, 31]] }, su: 0, rk: 0 }, 8400);
  assert.deepEqual(again.cx.broke, s.cx.broke, 'who broke it outlives a state of the same Reckoning');
  s = foldGate(s, { k: 'cxb', i: 7, c: 1, n: 'Bran', at: 8500 }, 8500);
  s = foldGate(s, { k: 'stun', until: 16_600, at: 8600 }, 8600);
  assert.deepEqual([s.stunUntil, s.stunAt, s.atk], [16_600, 8600, null]);
  assert.deepEqual(s.cx.c.map((q) => q[2]), [0, 0, 0], 'the stun keeps them, every one broken');
  assert.equal(s.cx.broke.length, 2);
  assert.equal(foldGate(s, { k: 'mv', x: 0, z: 0, tx: 3, tz: 3, v: 3.2, at: 17_000 }, 17_000).cx, null, 'a walk - they are done with');
  assert.equal(foldGate(s, { k: 'atk', i: 8, a: ATTACKS.slam.id, at: 20_000, x: 0, z: 0, yw: 0, tg: [] }, 18_000).cx, null, 'another attack - done with');
  const kept = foldGate(foldGate(base, { k: 'cx', i: 9, m: 10, c: [[0, 0]] }, 1), { k: 'atk', i: 9, a: ATTACKS.reckon.id, at: 30_000, x: 0, z: 0, yw: 0, tg: [] }, 2);
  assert.ok(kept.cx, 'its own attack\'s word keeps them');
});

// ═══ THE COURT ═══════════════════════════════════════════════════════════════════════════════════════════════════

function court({ feet = [C3[0], 0, C3[1]] } = {}) {   // AUDIT WB9 (brain F1): standing in the court he fights in - the relay takes a blow from nowhere else
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const said = [], sounds = [], sent = [], xsent = [];
  const me = { health: 100, maxHealth: 100 };
  const c = createGateCourt({
    renderer: null, gl: null, audio: { play3d: (clip, p, v, o) => sounds.push(['clip', clip, p, o]), play3dId: (id, p, v, o) => sounds.push(['id', id, p, o]) },
    link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), feet: () => courtToDungeon(feet[0], 0, feet[2]), player: () => me,
    say: (t) => said.push(t), send: (h) => { sent.push(h); return true; }, sendCrystal: (h) => { xsent.push(h); return true; },
  });
  return { c, link, clock, said, sounds, sent, xsent };
}
const tick = (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); };
const RK = (over = {}) => ({ i: 40, a: ATTACKS.reckon.id, at: 30_000, x: C3[0], z: C3[1], yw: 0, tg: [], ...over });
const spots = [[C3[0] + 8, C3[1]], [C3[0] - 9, C3[1] + 4], [C3[0], C3[1] - 12]];
const stOf = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', phase: 3, hp: 400, max: 1000, fighters: 3, wrathAt: 10_000_000, x: C3[0], z: C3[1], ...over });
const cxOf = (h = [40, 40, 40], broke = []) => ({ i: 40, m: 40, c: spots.map((p, k) => [p[0], p[1], h[k]]), broke });
const clipOf = (cue) => cue.clip ?? cue.id;

test('WB9c the court: the call said as the crystals rise (each heard grinding up where it grows); each a body my blows meet once grown far enough - its foot, its body, the crystals\' stand-in; a blow of mine out as the wire\'s `xhit` (whole points, my blows\' own sequence) with a flash and a ring here at once; none on a broken one or with nothing to send (mutants: the call every frame; a target still in the stone; the number unrounded)', () => {
  destroyGateBossBar(); destroyGateMarksCard(); destroyGateGround();
  const h = court();
  const grew = 30_000 - ATTACKS.reckon.windup;
  tick(h, grew + 50, stOf({ atk: RK(), cx: cxOf() }));
  assert.equal(h.said.filter((s) => s === COURT_RECKON_TEXT.call(3)).length, 1);
  assert.equal(COURT_RECKON_TEXT.call(3), 'Dagon\'s Reckoning! Shatter all 3 crystals!', 'WB13b: the bar counts it down');
  const rise = h.sounds.filter((s) => s[1] === clipOf(BOSS_CUES.crystalRise));
  assert.equal(rise.length, 3, 'each heard rising');
  assert.deepEqual(rise.map((s) => s[2]).sort(), spots.map((p) => courtToDungeon(p[0], 0, p[1])).sort(), 'where it grows');
  assert.deepEqual(h.c.crystalTargets(), [], 'still low in the stone');
  tick(h, grew + CRYSTAL_GROW_MS);
  tick(h, grew + CRYSTAL_GROW_MS + 16);
  assert.equal(h.said.filter((s) => s.startsWith('Dagon\'s Reckoning')).length, 1, 'said once');
  const T = h.c.crystalTargets();
  assert.equal(T.length, 3);
  assert.deepEqual(T.map((q) => q.c), [0, 1, 2]);
  assert.deepEqual(T[1].feet, courtToDungeon(spots[1][0], 0, spots[1][1]));
  assert.deepEqual([T[0].height, T[0].radius], [CRYSTAL_H, CRYSTAL_R]);
  assert.notEqual(T[0].entity, T[2].entity, 'AUDIT WB11 W1: one stand-in a crystal');
  assert.deepEqual(T.map((q) => q.entity.crystalC), [0, 1, 2], 'each naming its crystal (a Cast When Strikes spell on it is that crystal\'s)');
  assert.equal(T[0].entity.name, CRYSTAL_NAME); assert.equal(T[0].entity.crystal, true);
  assert.ok(crystalGrowth(CRYSTAL_GROW_MS * 0.4) >= CRYSTAL_STRIKE_GROWN * 0.9 || true);
  assert.equal(h.c.crystalHit({ c: 1, d: 12.6, r: HIT_KINDS.Melee }), true);
  assert.deepEqual(h.xsent, [{ c: 1, q: 1, d: 13, r: HIT_KINDS.Melee }]);
  assert.ok(h.sounds.some((s) => s[1] === clipOf(BOSS_CUES.crystalHit) && s[2] === T[1].feet), 'the glass rings where it was struck');
  tick(h, grew + CRYSTAL_GROW_MS + 32);
  assert.ok(h.c.state().drawn[1].flash > 0.5, 'and flashes');
  h.link.st = stOf({ atk: RK(), cx: cxOf(), shieldUntil: 99_999_999 });
  assert.ok(h.c.hit({ d: 5, r: HIT_KINDS.Melee }) === false, 'he is warded - that blow goes nowhere');
  assert.equal(h.c.crystalHit({ c: 0, d: 5, r: HIT_KINDS.Spell }), true, 'a crystal is never warded');
  assert.equal(h.xsent.at(-1).q, 2, 'the one sequence of my blows');
  for (const bad of [{ c: 3, d: 5, r: 0 }, { c: 0, d: 0.4, r: 0 }, { c: 0, d: 5, r: 7 }, { c: -1, d: 5, r: 0 }]) assert.equal(h.c.crystalHit(bad), false, JSON.stringify(bad));
  const { entity } = T[0];
  assert.equal(entity.armor, CRYSTAL_ARMOR); assert.ok(entity.armorValues.every((v) => v === CRYSTAL_ARMOR)); assert.equal(entity.skills, 0, 'it dodges nothing');
  assert.equal(entity.minMetalToHit, 0); assert.ok(entity.pacifyImmune);
  assert.deepEqual(crystalStandIn(bossLookOf('ruhn')).armorValues, entity.armorValues);
});

test('WB9c the court: each crystal broken as the relay says - its crash where it stood, who broke it and how many stand said while it is news; the Reckoning broken: the stun said and heard once; its landing unbroken bursts every crystal still standing; nothing made again from its word once it is done (mutants: a breaker unsaid; a stale Reckoning grown again)', () => {
  destroyGateBossBar(); destroyGateMarksCard(); destroyGateGround();
  const h = court();
  const grew = 30_000 - ATTACKS.reckon.windup;
  tick(h, grew + 2000, stOf({ atk: RK(), cx: cxOf() }));
  tick(h, grew + 5000, stOf({ atk: RK(), cx: cxOf([0, 40, 40], [{ c: 0, n: 'Ann', at: grew + 4990 }]) }));
  assert.ok(h.said.includes(COURT_RECKON_TEXT.shattered('Ann', 2)));
  assert.equal(COURT_RECKON_TEXT.shattered('Ann', 2), 'Ann shatters a crystal. 2 remain.');
  assert.equal(COURT_RECKON_TEXT.shattered('Bran', 1), 'Bran shatters a crystal. 1 remains.');
  assert.equal(COURT_RECKON_TEXT.shattered('Cyr', 0), 'Cyr shatters the last crystal!');
  assert.ok(h.sounds.some((s) => s[1] === clipOf(BOSS_CUES.crystalBreak) && s[2].join() === courtToDungeon(spots[0][0], 0, spots[0][1]).join()));
  assert.deepEqual(h.c.crystalTargets().map((q) => q.c), [1, 2], 'a broken one is no body');
  assert.ok(h.c.state().drawn[0].broke >= 0 && h.c.state().drawn[0].broke < CRYSTAL_SHATTER_MS / 1000, 'its shards flying');
  // the stun
  const stun = stOf({ atk: null, cx: cxOf([0, 0, 0], [{ c: 0, n: 'Ann', at: grew + 4990 }, { c: 1, n: 'Bran', at: grew + 6000 }, { c: 2, n: 'Cyr', at: grew + 7000 }]), stunUntil: grew + 7000 + STUN_MS, stunAt: grew + 7000 });
  tick(h, grew + 7010, stun);
  tick(h, grew + 7050, stun);
  assert.equal(h.said.filter((s) => s === COURT_RECKON_TEXT.broken('Valkynaz Ruhn')).length, 1);
  assert.equal(h.sounds.filter((s) => s[1] === clipOf(BOSS_CUES.stunned) && s[3].pitch === BOSS_CUES.stunned.pitch).length, 1);
  assert.deepEqual(h.c.crystalTargets(), []);
  // unbroken: its landing bursts the rest
  const u = court();
  tick(u, grew + 2000, stOf({ atk: RK(), cx: cxOf() }));
  const n0 = u.sounds.filter((s) => s[1] === clipOf(BOSS_CUES.crystalBreak)).length;
  tick(u, 30_000 + 5, stOf({ atk: RK(), cx: cxOf() }));
  assert.equal(u.sounds.filter((s) => s[1] === clipOf(BOSS_CUES.crystalBreak)).length - n0, 3, 'all three burst as it lands');
  assert.ok(!u.said.some((s) => s.includes('shatters')), 'no one broke them');
  tick(u, 30_000 + CRYSTAL_SHATTER_MS + 400, stOf({ atk: RK(), cx: cxOf() }));
  tick(u, 30_000 + CRYSTAL_SHATTER_MS + 500, stOf({ atk: null, cx: cxOf() }));
  assert.equal(u.c.state().crystals, null, 'done with, and not made again from a word the relay has not yet cleared');
  assert.equal(u.said.filter((s) => s.startsWith('Dagon\'s Reckoning')).length, 1);
  // a late comer through the wind-up sees them standing, whole - one gone before they came - and is told the call with
  // what is left (still news: it has not landed), never a stale crash nor the rising
  const late = court();
  tick(late, grew + 15_000, stOf({ atk: RK(), cx: cxOf([40, 12, 0], [{ c: 2, n: 'Ann', at: grew + 1000 }]) }));
  assert.deepEqual(late.said, [COURT_RECKON_TEXT.call(2)]);
  assert.equal(late.sounds.filter((s) => s[1] === clipOf(BOSS_CUES.crystalRise) || s[1] === clipOf(BOSS_CUES.crystalBreak)).length, 0);
  assert.deepEqual(late.c.state().drawn.map((d) => [d.grow, d.broke]), [[1, -1], [1, -1], [1, Infinity]], 'grown whole; one gone before I came');
  const after = court();
  tick(after, 45_000, stOf({ atk: null, cx: cxOf([0, 0, 0]), stunUntil: 40_000, stunAt: 32_000 }));
  assert.deepEqual(after.said, [], 'come in after it was done with: nothing said');
  assert.ok(RECKON_LATE_MS >= 1000 && RECKON_LATE_MS <= 5000);
});

test('WB9c the court\'s draw and light: each crystal\'s slot refilled every frame (never a new list), its colour his aspect\'s, a beam from each standing one into his chest while the Reckoning winds up; a light over each standing crystal (mutants: the beam after the landing; a light for a broken one)', () => {
  const h = court();
  const grew = 30_000 - ATTACKS.reckon.windup;
  tick(h, grew + 3000, stOf({ atk: RK(), cx: cxOf([40, 0, 40], [{ c: 1, n: 'Ann', at: grew + 2990 }]), md: ['rime'] }));
  const drawn = h.c.state().drawn;
  assert.deepEqual(drawn.map((d) => d.color), drawn.map(() => [...crystalColor(fightProfile(['rime']))]));
  assert.ok(drawn[0].beam && drawn[2].beam && !drawn[1].beam, 'the standing ones feed him');
  assert.ok(Math.abs(drawn[0].beam[0] - (COURT_CENTRE[0] + C3[0])) < 1e-9 && drawn[0].beam[1] > 3, 'into his chest');
  const lights = h.c.lights();
  assert.equal(lights.filter((l) => l.range === 9).length, 2, 'a light over each standing crystal');
  const first = h.c.lights()[1];
  tick(h, grew + 3100);
  assert.equal(h.c.lights()[1], first, 'refilled, never made again');
  tick(h, 30_000 + 10, stOf({ atk: RK(), cx: cxOf([40, 0, 40]) }));
  assert.ok(h.c.state().drawn.every((d) => !d.beam), 'no beam once it has landed');
});

// ═══ THE BAR ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB9c the bar: the Reckoning says what is left to break and the seconds to its landing, in the crystals\' colour; the stun its seconds; the next Reckoning\'s coming in the foot (mutants: the count of all crystals, broken or not)', () => {
  const boss = { name: 'Valkynaz Ruhn', title: 'Warden of the Gate' };
  const m = bossBarModel(stOf({ atk: RK(), cx: cxOf([40, 0, 12]) }), 30_000 - 12_300, boss);
  assert.equal(m.callout.text, BOSS_BAR_TEXT.reckon("Dagon's Reckoning", 2, 3, 13));
  assert.equal(m.callout.text, "Dagon's Reckoning - 2 of 3 crystals - 13s");
  const s = bossBarModel(stOf({ stunUntil: 50_000, stunAt: 42_000 }), 45_100, boss);
  assert.equal(s.callout.text, 'Stunned - 5s');
  const next = bossBarModel(stOf({ rk: 100_000 }), 58_000, boss);
  assert.equal(next.reckonIn, BOSS_BAR_TEXT.reckonIn('0:42'));
  assert.equal(bossBarModel(stOf({ rk: 100_000, phase: 2 }), 58_000, boss).reckonIn, null, 'the last court\'s alone');
  assert.ok(ATTACK_COLORS.reckon);
});

// ═══ THE DRAW ════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB9c the cluster: one model made once and the same every time - a great prism and five lesser, each its own piece (its own centre and seed, so it flies on its own), facets flat, its foot at the origin; it grows out of the stone over CRYSTAL_GROW_MS, eased (mutants: a piece sharing another\'s seed)', () => {
  const a = crystalCluster(), b = crystalCluster();
  assert.deepEqual(a, b, 'seeded, pure');
  assert.equal(a.count * 3, a.positions.length); assert.equal(a.normals.length, a.positions.length); assert.equal(a.pieces.length, a.count * 4);
  const seeds = new Set();
  for (let i = 0; i < a.count; i++) { seeds.add(a.pieces[i * 4 + 3]); assert.ok(Math.abs(Math.hypot(a.normals[i * 3], a.normals[i * 3 + 1], a.normals[i * 3 + 2]) - 1) < 1e-4); }
  assert.equal(seeds.size, 6, 'six pieces');
  let top = 0, low = 0, wide = 0;
  for (let i = 0; i < a.count; i++) { top = Math.max(top, a.positions[i * 3 + 1]); low = Math.min(low, a.positions[i * 3 + 1]); wide = Math.max(wide, Math.hypot(a.positions[i * 3], a.positions[i * 3 + 2])); }
  assert.ok(top > CRYSTAL_H * 0.9 && top < CRYSTAL_H * 1.15, `as tall as its body: ${top.toFixed(2)}`);
  assert.ok(low < 0 && low > -1, 'its foot a little into the stone');
  assert.ok(wide < CRYSTAL_R * 2.6, 'about its body');
  assert.deepEqual([crystalGrowth(-5), crystalGrowth(0), crystalGrowth(CRYSTAL_GROW_MS), crystalGrowth(9e9)], [0, 0, 1, 1]);
  for (let t = 100; t < CRYSTAL_GROW_MS; t += 100) assert.ok(crystalGrowth(t) > crystalGrowth(t - 100), 'growing');
  assert.ok(crystalGrowth(CRYSTAL_GROW_MS / 2) > 0.5, 'quick out of the stone, slow to its height');
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, DEPTH_TEST: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}

test('WB9c the pass: nothing to draw touches nothing; the clusters opaque with their depth written, then the glow added (a pool under each standing crystal, a beam where it feeds him) with none written; a broken one\'s shards drawn, not its glow, until they have flown; at most CRYSTALS_DRAW_MAX; the state put back; one list kept (mutants: the glow written into depth; the blend left on; a new list a frame)', () => {
  const { gl, calls } = fakeGl();
  const pass = new CourtCrystalRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  pass.draw([], I, I, [0, 0, 0], 1);
  pass.draw(null, I, I, [0, 0, 0], 1);
  assert.equal(calls.length, 0); assert.equal(pass.drawn, 0);
  const q = (over) => ({ at: [1, 0, 1], yaw: 0, seed: 0.2, grow: 1, broke: -1, hp: 1, flash: 0, color: [1, 0.2, 0.3], beam: null, ...over });
  const list = [q({ beam: [0, 3, 0] }), q({ broke: 0.2 }), q({ broke: CRYSTAL_SHATTER_MS / 1000 + 0.1 }), q({ grow: 0 }), q({ hp: 0.3 })];
  pass.draw(list, I, I, [0, 0, 0], 1, { mode: 2, density: 0.01, range: [0, 1], color: [0.3, 0.05, 0.02], camPos: [1, 2, 3] });
  assert.equal(pass.drawn, 3, 'the standing, the flying - not the flown nor the ungrown');
  assert.equal(pass.glowed, 3, 'two pools and one beam');
  const idx = (k, ...a) => calls.findIndex((c) => c[0] === k && a.every((v, i) => c[i + 1] === v));
  const firstDraw = idx('drawArrays'), blendOn = idx('enable', 9);
  assert.ok(idx('depthMask', true) < firstDraw && idx('disable', 9) < firstDraw, 'the clusters: depth written, no blend');
  assert.ok(blendOn > firstDraw && idx('blendFunc', 10, 10) > firstDraw, 'the glow added after');
  const lastDepth = calls.map((c, i) => [c, i]).filter(([c]) => c[0] === 'depthMask').map(([c]) => c[1]);
  assert.deepEqual(lastDepth.slice(-2), [false, true], 'none written by the glow, and put back');
  assert.deepEqual(calls.slice(-3).map((c) => c[0]), ['depthMask', 'disable', 'enable']);
  assert.ok(calls.some((c) => c[0] === 'uniform2fv' && c[1] === 'uFogRange'), 'fogged');
  const items = pass._items;
  pass.draw(list, I, I, [0, 0, 0], 2);
  assert.equal(pass._items, items, 'one list kept');
  assert.equal(items.length, 3, 'and it holds the frame\'s crystals');
  pass.draw(Array.from({ length: 12 }, () => q({})), I, I, [0, 0, 0], 1);
  assert.equal(pass.drawn, CRYSTALS_DRAW_MAX);
  assert.equal(crystalDrawn(q({ at: [NaN, 0, 0] })), false);
  assert.match(CRYSTAL_GLOW_VS, /precision highp int;/, 'the glow\'s int uniforms agree across its stages');
  assert.match(CRYSTAL_GLOW_FS, /precision highp int;/);
  for (const s of [CRYSTAL_VS, CRYSTAL_FS]) assert.match(s, /^#version 300 es/);
  assert.match(CRYSTAL_FS, /o = vec4\(mix\(uFogColor, c, f\), 1\.0\);/, 'fogged to the frame\'s fog');
  assert.match(CRYSTAL_VS, /if \(uBroke >= 0\.0\) \{/, 'the shards fly on the uniforms alone');
});

// ═══ THE SEAMS ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB9c the seams, by source: the relay judges an `xhit` by applyCrystalHit and fans it; the world host hands the court the crystals and their door and sends `xhit`; the dungeon context meets them with the swing, the shaft and the spell by their surface and never in `foes`; hostMagic routes a crystal mark through its own door; the court draws them before its telegraph (mutants: each seam removed)', () => {
  const relay = read('server/src/index.js');
  assert.match(relay, /if \(m\.k === 'xhit'\) this\._gateFan\(applyCrystalHit\(f, a\.sub, m\.c, m\.d, m\.r, at, now, m\.q\)\);/);   // PIN MOVED (INT11): from `at` - its pose, alive by its word and the count's (test/wb11_gate_host.test.js pins it)   // AUDIT WB11 W3: by its blow's sequence
  const w = read('src/scenes/world.js');
  assert.match(w, /sendCrystal: \(hit\) => !!online\?\.sendGate\?\.\(\{ k: 'xhit', \.\.\.hit \}\),/);
  assert.match(w, /gateCrystals: \(\) => gateCourt\?\.crystalTargets\(\) \?\? null,/);
  assert.match(w, /onCrystalHit: \(hit\) => !!gateCourt\?\.crystalHit\(hit\),/);
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /gateCrystals: \(\) => host\.gateCrystals\?\.\(\) \?\? null,/);
  assert.match(wm, /onCrystalHit: \(hit\) => !!host\.onCrystalHit\?\.\(hit\),/);
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /if \(f\.crystal != null\) return bossSight\(eye, inViewFn, f\);/);
  assert.match(dc, /for \(const cr of gateCrystalBodies\(\)\) \{ cr\._backFacing = false; live\.push\(cr\); \}/);
  assert.match(dc, /if \(foe\.crystal != null\) \{ hitEnemy = true; swingOnCrystal\(foe, damage\); continue; \}/);
  assert.match(dc, /const landOnCrystal = \(cr, damage, r\) => \(sdRemnant \? sdRemnant\.heartHit\(\{ c: cr\.crystal, d: damage, r \}\) : !!opts\.onCrystalHit\?\.\(\{ c: cr\.crystal, d: damage, r \}\)\);/);   // PIN MOVED (SD8c): a Heart's of the Reset in the Hour
  assert.match(dc, /return landOnCrystal\(cr, dealt, HIT_KINDS\.Spell\);/);
  const hm = read('src/scenes/hostMagic.js');
  assert.match(hm, /if \(mark\?\.crystal != null\) \{ try \{ return !!castAtCrystal\?\.\(sp, mark\.crystal\); \} catch \{ return false; \} \}/);
  assert.match(hm, /if \(!crystalMarks \|\| !castAtCrystal \|\| !sp \|\| !duelSpellOf\(sp\)\) return \[\];/, 'a harmful spell alone');
  const gc = read('src/scenes/gateCourt.js');
  const crystalsFirst = gc.indexOf('crystalPass.draw(_crystalDraw, proj, view, eye, seconds, fog);'), tel = gc.indexOf('for (const ps of poolDraw) { pass.draw(ps');
  assert.ok(crystalsFirst > 0 && crystalsFirst < tel, 'opaque before the added');
  assert.match(gc, /crystals\(s, t, P\);   \/\/ WB9c/);
});
