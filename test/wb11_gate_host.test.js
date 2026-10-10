// WB11 (2026-10-01 - Mac, offered adds in three kinds and asked four questions: "1. All three 2. Your choice 3. Your
// choice 4. Trial rotation"): HIS HOST - the Legion-Lord trial. The ninth trial in the marks' rotation (rebuilt for nine,
// net/gateLaw.js - its own pins are WB8b's) brings the bodies the relay runs beside him: the HARRIERS of the first phase
// (Imps at whoever stands farthest from him, Biting), the SAPPERS of the second (Atronachs walking at him - one that
// reaches him is drunk and heals him), the WARD-BEARERS of each new court (his ward holds while one stands; they Pulse
// at whoever comes near). Nothing of it runs, rolls or is said without the trial.
//
//   the tables      net/gateMods.js `legion`; net/gateBrain.js HOST_KINDS, HOST_BLOWS, the counts and the health
//   the brain       net/gateBrain.js stepHost (waves, walks, blows, the drinking), the bearers' wait, applyHostHit
//   the wire        `ahit`; `ad`, `amv`, `aatk`, `ah`, `adie`; the state's `lg`; the chart row's `a`; the brain's law 5
//   the relay       a blow on one of his host judged as it comes, its fall said to the court at once
//   the link        net/gateLink.js - the host folded, the gone kept for the court to play out
//   the court       scenes/gateHost.js through scenes/gateCourt.js - bodies, blows judged on me, words, the targets
//   the look        world/gateBoss.js hostLookOf, hostAct, hostCue, hostStandIn
//   the bar         ui/gateBossBar.js - the Ward-Bearers standing, his host counted
//   the plumbing    the dungeon context's swing, shaft and spell; the magic host's marks; the world host's doors
//
// Design: bible/11-Multiplayer/World-Bosses.md section 17.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  COURTS, COURT_R, COURT_CENTRE, PHASE_AT, HIT_KINDS, MELEE_REACH, POSE_SLACK, BOSS_TTK_S, HIT_CAP_X, HP_SEND_MS, SHIELD_MS, ATTACKS, OPENING_MS,
  HOST, HOST_KINDS, HOST_BLOWS, HOST_GONE, HOST_RISE_MS, HOST_HP_MIN, HARRIER_S, SAPPER_TEAM_S, BEARER_TEAM_S, HARRIERS_MAX, SAPPERS_MAX, HOST_STANDING_MAX,
  HARRY_FIRST_MS, HARRY_EVERY_MS, SAP_FIRST_MS, SAP_EVERY_MS, HOST_RIM_R, HOST_SPAWN_CLEAR, SAP_SPAWN_CLEAR, SAP_FROM_HIM, SAP_SPREAD, SAP_HEAL, SAP_FEEDS_MAX,
  SAP_REACH_SLACK, BEARER_RING_R, BEARER_WARD_MAX_MS, BEARER_PULSE_MS, BEARER_PULSE_NEAR, HARRIER_BITE_REACH,
  harrierCountFor, sapperCountFor, bearerCountFor, harrierHpFor, hostTeamHpFor, hostBlowUnder, hostAt, hostStateOf, dpsRef,
  newFight, joinFight, stepBrain, applyHit, applyHostHit, stateOf, fightProfile, BASE_PROFILE, damageChart,
} from '../src/net/gateBrain.js';
import { GATE_TRIALS, gateTrialOf } from '../src/net/gateMods.js';
import { validGateIn, validGateOut, GATE_HOST_MAX, GATE_HOST_KINDS, GATE_HOST_GONE, GATE_BRAIN_V, GATE_KINDS, GATE_OUT_KINDS } from '../src/net/wire.js';
import { foldGate, GATE_STATE_EMPTY, HOST_GONE_KEPT } from '../src/net/gateLink.js';
import { hostVerdict, hostTelegraphAt, STRIKE_LATE_MS } from '../src/net/gateStrike.js';
import { gateTimes, gateRoomKey } from '../src/net/gateLaw.js';
import { hostLookOf, hostAct, hostFallAct, hostCue, hostStandIn, HOST_LOOKS, HOST_FALL_MS, BOSS_ARMOR, WARD_COLOR } from '../src/world/gateBoss.js';
import { courtToDungeon } from '../src/world/gateArena.js';
import { createGateCourt } from '../src/scenes/gateCourt.js';
import { COURT_HOST_TEXT, hostShapes, HOST_SHAPES_MAX } from '../src/scenes/gateHost.js';
import { bossBarModel, BOSS_BAR_TEXT, destroyGateBossBar } from '../src/ui/gateBossBar.js';
import { destroyGateMarksCard, MARK_TIPS, MARK_ICONS } from '../src/ui/gateMarksView.js';
import { destroyGateGround } from '../src/ui/gateGroundView.js';
import { damageChartModel, DAMAGE_CHART_DELAY_MS, DAMAGE_CHART_TEXT } from '../src/ui/gateDamageChart.js';
import { TELEGRAPH_KIND } from '../src/render/gateTelegraph.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { fakeRooms } from './fakeRoom.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000;
function seeded(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const LEGION = Object.freeze(['burning', 'legion', 'echoing']);
function fightOf(lvs = [10, 10, 10, 10], md = LEGION) {
  const f = newFight(7, T0, T0 + 3_600_000, 'ruhn', md);
  lvs.forEach((lv, i) => assert.ok(joinFight(f, `s${i + 1}`, `P${i + 1}`, lv, T0, true)));
  return f;
}
const OFFS = [[3, 4], [-5, 2], [10, -8], [-12, 10], [6, 9], [-3, -11], [14, 2], [-9, -6]];
/** The fight's bodies standing in court `k`, at their offsets from its heart. */
const bodiesIn = (f, k = f.court, n = Object.keys(f.players).length, dead = []) => Array.from({ length: n }, (_, i) => ({ sub: `s${i + 1}`, x: COURTS[k][0] + OFFS[i][0], z: COURTS[k][1] + OFFS[i][1], dead: dead.includes(i) }));
const kindsOf = (out) => out.map((o) => o.k);
const HOST_WORDS = ['ad', 'amv', 'aatk', 'ah', 'adie'];

// ═══ THE TABLES ══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB11 the trial and the tables: Legion-Lord is the ninth trial and the only one with a host; three kinds by wire id (their bodies, their pace - none outruns a runner); two blows, each a disc from its body escaped well inside its wind-up at a run; the counts and the health sized to the court as the crystals are; the profile says `legion` under the trial alone (mutants: a kind\'s pace past a runner\'s; the Bite\'s disc wider than its wind-up lets a runner out of; a Sapper\'s health sized off one challenger)', () => {
  assert.equal(GATE_TRIALS.length, 9);
  assert.deepEqual(GATE_TRIALS.filter((t) => t.legion).map((t) => t.id), ['legion']);
  assert.equal(gateTrialOf('legion').name, 'Legion-Lord');
  assert.ok(MARK_TIPS.legion && MARK_ICONS.legion, 'a way to meet it and a sign');
  assert.deepEqual(HOST_KINDS.map((k) => [k.id, k.key]), [[0, 'harrier'], [1, 'sapper'], [2, 'bearer']]);
  assert.deepEqual(HOST, { harrier: 0, sapper: 1, bearer: 2 });
  for (const k of HOST_KINDS) assert.ok(k.speed < 7.6, `${k.key}: a runner outruns it`);
  assert.deepEqual(HOST_BLOWS.map((b) => b?.key ?? null), ['bite', null, 'pulse'], 'a Sapper strikes nobody');
  for (const B of HOST_BLOWS.filter(Boolean)) assert.ok((B.r / 7.6) * 1000 < B.windup / 2, `${B.key}: out of it from its own feet in under half its wind-up`);
  assert.deepEqual([0, 1, 2, 3, 4, 6, 7, 9, 10, 40].map(harrierCountFor), [2, 2, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.deepEqual([0, 1, 3, 4, 8, 12, 16, 40].map(sapperCountFor), [1, 1, 1, 2, 3, 4, 4, 4]);
  assert.deepEqual([0, 1, 5, 6, 12, 18, 40].map(bearerCountFor), [2, 2, 2, 3, 4, 4, 4]);
  assert.equal(HOST_STANDING_MAX, Math.max(HARRIERS_MAX, SAPPERS_MAX, 4));
  assert.ok(GATE_HOST_MAX >= HOST_STANDING_MAX && GATE_HOST_MAX >= harrierCountFor(1e9), 'the wire names every one that can stand');
  assert.equal(GATE_HOST_KINDS, HOST_KINDS.length); assert.equal(GATE_HOST_GONE, Object.keys(HOST_GONE).length);
  assert.equal(harrierHpFor([10, 20]), Math.round((HARRIER_S * (dpsRef(10) + dpsRef(20))) / 2), 'the court\'s MEAN reference');
  assert.equal(harrierHpFor([]), HOST_HP_MIN);
  assert.equal(hostTeamHpFor(SAPPER_TEAM_S, [10, 10, 10, 10], 2), Math.round((SAPPER_TEAM_S * 4 * dpsRef(10)) / 2), 'the court\'s WHOLE reference, shared');
  assert.equal(hostTeamHpFor(BEARER_TEAM_S, [1], 4), HOST_HP_MIN);
  // a Harrier is a few of one challenger's own blows at any level; a wave of Sappers falls to a court that splits up
  for (const lv of [1, 10, 30, 60]) assert.ok(harrierHpFor([lv]) / dpsRef(lv) <= HARRIER_S + 0.5, `level ${lv}: a few of its own blows (HOST_HP_MIN the least)`);
  for (const n of [1, 2, 4, 8, 16]) {
    const k = sapperCountFor(n), per = hostTeamHpFor(SAPPER_TEAM_S, Array(n).fill(20), k), rate = dpsRef(20) * n;
    assert.ok((per * k) / rate <= SAPPER_TEAM_S + 1e-9, `${n} challengers break a wave of ${k} in ${((per * k) / rate).toFixed(1)} s`);
  }
  assert.equal(BASE_PROFILE.legion, false);
  assert.equal(fightProfile(['rime', 'colossal', 'echoing']).legion, false);
  assert.equal(fightProfile(['rime', 'legion', 'echoing']).legion, true);
  // the blows under a profile: a Pulse in his aspect's element, Vengeful's weight on both, a Bite plain
  const venom = fightProfile(['venom', 'legion', 'vengeful']);
  assert.deepEqual([hostBlowUnder(HOST.bearer, venom).el, hostBlowUnder(HOST.harrier, venom).el], ['poison', null]);
  assert.equal(hostBlowUnder(HOST.harrier, venom).pct, HOST_BLOWS[0].pct * 1.25);
  assert.equal(hostBlowUnder(HOST.bearer, venom).base, HOST_BLOWS[2].base * 1.25);
  assert.equal(hostBlowUnder(HOST.sapper, venom), null);
});

// ═══ THE BRAIN ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB11 the host is the trial\'s alone: a fight under any other marks, or none, never makes one, rolls for one or says a word of one - its state carries no `lg` (mutants: the host run without the trial)', () => {
  for (const md of [null, ['rime', 'colossal', 'unyielding'], ['storm', 'soulhungry', 'echoing']]) {
    const f = fightOf([10, 10, 10], md);
    let calls = 0;
    const rng = seeded(3), counted = () => { calls++; return rng(); };
    const g = fightOf([10, 10, 10], md);
    for (let t = T0; t < T0 + 60_000; t += 250) {
      const out = stepBrain(f, t, bodiesIn(f), counted);
      assert.ok(!out.some((o) => HOST_WORDS.includes(o.k)), `${md}: no word of a host`);
      stepBrain(g, t, bodiesIn(g), seeded(t));
    }
    assert.equal(f.lg, null, `${md}: no host made`);
    assert.ok(!('lg' in stateOf(f)), 'nor said');
    assert.ok(calls > 0, 'he still rolls his own dice');
  }
});

test('WB11 the Harriers: the first wave HARRY_FIRST_MS after the fight began, one every HARRY_EVERY_MS through the first phase - harrierCountFor(the living in his court), each HARRIER_S of their mean reference, risen on the first court\'s rim clear of every challenger and of each other; each still while it rises, then at the challenger standing FARTHEST from him, and Biting within reach - a disc about itself, a step out of it in time is free (mutants: the nearest marked; the rise skipped; a wave on top of a challenger)', () => {
  const f = fightOf([10, 20, 10, 30]);
  const bodies = bodiesIn(f);
  let wave = null, t = T0;
  for (; t < T0 + HARRY_FIRST_MS + 1000 && !wave; t += 250) for (const o of stepBrain(f, t, bodies, seeded(t))) if (o.k === 'ad') wave = { ...o, t };
  assert.ok(wave, 'a wave rose');
  assert.equal(wave.t, T0 + HARRY_FIRST_MS, 'when it was due');
  assert.equal(wave.w, HOST.harrier);
  assert.equal(wave.a.length, harrierCountFor(4));
  assert.equal(wave.m, harrierHpFor([10, 20, 10, 30]));
  for (const [, x, z] of wave.a) {
    assert.ok(Math.abs(Math.hypot(x, z) - HOST_RIM_R) < 0.02, 'on the rim');
    for (const b of bodies) assert.ok(Math.hypot(b.x - x, b.z - z) >= HOST_SPAWN_CLEAR - 0.02, 'clear of every challenger');
  }
  const ids = wave.a.map((q) => q[0]);
  // still while it rises
  const rising = f.lg.ads.map((a) => ({ i: a.i, x: a.x, z: a.z }));
  for (; t < wave.t + HOST_RISE_MS[HOST.harrier] - 1; t += 250) stepBrain(f, t, bodies, seeded(t));
  assert.deepEqual(f.lg.ads.map((a) => ({ i: a.i, x: a.x, z: a.z })), rising, 'still while it rises');
  // then each at the challenger farthest from him (s4, at -12, 10 - he stands at the heart, unmoved by nobody's damage)
  f.pos = [0, 0];
  const far = bodies.reduce((m, b) => (Math.hypot(b.x, b.z) > Math.hypot(m.x, m.z) ? b : m));
  for (let k = 0; k < 4; k++, t += 250) stepBrain(f, t, bodies, seeded(t));
  for (const a of f.lg.ads) assert.equal(a.tg, far.sub, 'the one standing farthest from him');
  // run them down to their mark and see the Bite: a disc about the Harrier's own feet, wound up HOST_BLOWS' wind-up
  let bite = null;
  for (let k = 0; k < 80 && !bite; k++, t += 250) for (const o of stepBrain(f, t, bodies, seeded(t))) if (o.k === 'aatk') bite = { o, t };
  assert.ok(bite, 'it Bit');
  const [i, at, x, z] = bite.o.a[0];
  assert.ok(ids.includes(i));
  assert.equal(at, bite.t + HOST_BLOWS[0].windup);
  assert.ok(Math.hypot(far.x - x, far.z - z) <= HARRIER_BITE_REACH + 0.01, 'within reach of its mark');
  assert.equal(hostVerdict({ at, x, z }, HOST.harrier, far.x, far.z, at), 'hit', 'standing in it');
  const away = Math.hypot(far.x - x, far.z - z) > 0.01 ? [(far.x - x) / Math.hypot(far.x - x, far.z - z), (far.z - z) / Math.hypot(far.x - x, far.z - z)] : [1, 0];
  const run = (7.6 * HOST_BLOWS[0].windup) / 1000;
  assert.equal(hostVerdict({ at, x, z }, HOST.harrier, far.x + away[0] * run, far.z + away[1] * run, at), 'miss', 'a runner is out of it by the landing');
  // the next wave comes HARRY_EVERY_MS after the first rose, and no more stand than HARRIERS_MAX
  let next = null;
  for (; t < wave.t + HARRY_EVERY_MS + 1000 && !next; t += 250) for (const o of stepBrain(f, t, bodies, seeded(t))) if (o.k === 'ad') next = { ...o, t };
  assert.equal(next?.t, wave.t + HARRY_EVERY_MS);
  assert.ok(f.lg.ads.filter((a) => a.k === HOST.harrier).length <= HARRIERS_MAX);
  // a court crowding the rim: every Harrier still rises clear of every challenger, wherever the dice would have put it
  const crowd = fightOf([10, 10, 10, 10, 10, 10, 10, 10]);
  const rim = Array.from({ length: 8 }, (_, k) => ({ sub: `s${k + 1}`, x: Math.sin((k * Math.PI) / 4) * (HOST_RIM_R - 1), z: Math.cos((k * Math.PI) / 4) * (HOST_RIM_R - 1), dead: false }));
  for (let w = 0; w < 6; w++) {
    crowd.lg = null; crowd.startedAt = T0 + w * 100_000;
    let risen = null;
    for (let tt = crowd.startedAt; tt < crowd.startedAt + HARRY_FIRST_MS + 500 && !risen; tt += 250) for (const o of stepBrain(crowd, tt, rim, seeded(tt + w))) if (o.k === 'ad') risen = o;
    assert.ok(risen);
    for (const [, x, z] of risen.a) for (const b of rim) assert.ok(Math.hypot(b.x - x, b.z - z) >= HOST_SPAWN_CLEAR - 0.02, `wave ${w}: clear of the crowd at the rim`);
  }
  // a wave due with nobody in his court waits for somebody
  const g = fightOf([10]);
  for (let tt = T0; tt < T0 + HARRY_FIRST_MS + 5000; tt += 250) assert.ok(!stepBrain(g, tt, [], seeded(tt)).some((o) => o.k === 'ad'));
  assert.equal(g.lg.ads.length, 0);
});

/** A fight in the second court with the Burning Court's turn done: phase two, its walkway laid long ago, no wave armed. */
function secondCourt(lvs = [10, 10, 10, 10]) {
  const f = fightOf(lvs);
  f.phase = 2; f.court = 1; f.pos = [...COURTS[1]]; f.xa = [T0 - 60_000]; f.nextAt = T0; f.hp = f.max * 0.5;
  f.lg = { n: 0, ads: [], harryAt: 0, sapAt: 0, fed: 0, wardCt: 1, hSent: '', hSentAt: 0 };
  return f;
}

test('WB11 the Sappers: armed as the Burning Court\'s turn is done, the first wave SAP_FIRST_MS on, one every SAP_EVERY_MS after; risen on the rim\'s far side from him (within SAP_SPREAD of the point opposite, never within SAP_FROM_HIM of him, SAP_SPAWN_CLEAR of a challenger), a health the court\'s whole reference shares; still while they rise, then straight at him; one that reaches him is drunk - SAP_HEAL of the health he stands for, said with his health after - and past SAP_FEEDS_MAX it burns out unheard (mutants: a Sapper risen at his side; drunk while still rising; drunk past the feedings)', () => {
  const f = secondCourt();
  const bodies = bodiesIn(f, 1);
  let wave = null, t = T0, him = null;
  for (; t < T0 + SAP_FIRST_MS + 2000 && !wave; t += 250) {
    const before = { pos: [...f.pos], yaw: f.yaw };   // where he stood as the beat began - the beat's host reads it
    for (const o of stepBrain(f, t, bodies, seeded(t))) if (o.k === 'ad') { wave = { ...o, t }; him = before; }
  }
  assert.ok(wave);
  assert.equal(wave.w, HOST.sapper);
  assert.equal(wave.t, T0 + SAP_FIRST_MS, 'armed the first beat the turn is done, the first SAP_FIRST_MS on');
  assert.equal(wave.a.length, sapperCountFor(4));
  assert.equal(wave.m, hostTeamHpFor(SAPPER_TEAM_S, [10, 10, 10, 10], wave.a.length));
  const C = COURTS[1];
  // the rim's far side from him: through the court's heart from where he stood (behind him, standing on it)
  const far = Math.hypot(him.pos[0] - C[0], him.pos[1] - C[1]) < 1 ? him.yaw + Math.PI : Math.atan2(C[0] - him.pos[0], C[1] - him.pos[1]);
  for (const [, x, z] of wave.a) {
    assert.ok(Math.hypot(x - him.pos[0], z - him.pos[1]) >= SAP_FROM_HIM - 0.02, 'far from him');
    for (const b of bodies) assert.ok(Math.hypot(b.x - x, b.z - z) >= SAP_SPAWN_CLEAR - 0.02, 'clear of the challengers');
    const a = Math.atan2(x - C[0], z - C[1]), d = Math.abs(Math.atan2(Math.sin(a - far), Math.cos(a - far)));
    assert.ok(d <= SAP_SPREAD + 0.01, `within its spread of the far side (${d.toFixed(2)})`);
  }
  // still while they rise: never drunk then, even beside him
  const s0 = f.lg.ads[0];
  s0.x = f.pos[0] + 1; s0.z = f.pos[1];
  const hp = f.hp;
  stepBrain(f, t, bodies, seeded(t));
  assert.ok(f.lg.ads.includes(s0), 'still rising - not drunk');
  assert.equal(f.hp, hp);
  // risen and beside him: drunk, his health said with it
  t = wave.t + HOST_RISE_MS[HOST.sapper];
  const out = stepBrain(f, t, bodies, seeded(t));
  const fed = out.find((o) => o.k === 'adie');
  assert.ok(fed && fed.is.includes(s0.i) && fed.w === HOST_GONE.fed);
  assert.equal(f.hp, Math.min(f.max, hp + SAP_HEAL * f.max));
  assert.deepEqual([fed.h, fed.m], [Math.round(f.hp), Math.round(f.max)]);
  assert.ok(!out.some((o) => o.k === 'hp'), 'the word says the health: no `hp` beside it');
  // the rest walk straight at him
  const walker = f.lg.ads[0];
  stepBrain(f, t + 250, bodies, seeded(t + 250));
  stepBrain(f, t + 1500, bodies, seeded(t + 1500));
  assert.ok(walker.mv && walker.mv.v === HOST_KINDS[HOST.sapper].speed);
  const toHim = Math.hypot(walker.mv.tx - f.pos[0], walker.mv.tz - f.pos[1]);
  assert.ok(toHim <= profileReach(f) + 0.05, `its walk ends at him (${toHim.toFixed(2)})`);
  // past his feedings, one that reaches him burns out against him - no heal, no health said
  f.lg.fed = SAP_FEEDS_MAX;
  walker.mv = null; walker.x = f.pos[0] + 0.5; walker.z = f.pos[1];
  const hp2 = f.hp;
  const out2 = stepBrain(f, t + 1750, bodies, seeded(t + 1750));
  const gone = out2.find((o) => o.k === 'adie' && o.is.includes(walker.i));
  assert.equal(gone.w, HOST_GONE.crumbled);
  assert.equal(gone.h, undefined);
  assert.equal(f.hp, hp2);
});
const profileReach = (f) => fightProfile(f.md).bossR + HOST_KINDS[HOST.sapper].r + SAP_REACH_SLACK;

test('WB11 the Ward-Bearers: they rise as the bound lands him in a new court (once a court), bearerCountFor(the fight\'s living), on a ring about its heart; from the first challenger\'s arrival his ward holds while one stands - and breaks into his profile\'s own ward as the last falls, the signature cast under it; held past BEARER_WARD_MAX_MS they crumble; each Pulses only with a challenger near, in his element (mutants: the ward never waits on them; their cap ignored; a Pulse at nobody)', () => {
  const f = fightOf([10, 10, 10, 10]);
  const run = (from, to, k = f.court) => { const outs = []; for (let t = from; t < to; t += 250) outs.push(...stepBrain(f, t, bodiesIn(f, k), seeded(t)).map((o) => ({ ...o, _t: t }))); return outs; };
  // into the second phase
  f.hp = f.max * (PHASE_AT[0] - 0.01); f.nextAt = T0;
  let outs = run(T0, T0 + 6000, 0);
  const raised = outs.find((o) => o.k === 'ad' && o.w === HOST.bearer);
  assert.ok(raised, 'they rose');
  assert.equal(f.court, 1);
  const cross = outs.find((o) => o.k === 'atk' && o.a === ATTACKS.cross.id);
  assert.ok(raised._t >= cross.at, 'as the bound lands');
  assert.equal(raised.a.length, bearerCountFor(4));
  for (const [, x, z] of raised.a) assert.ok(Math.abs(Math.hypot(x - COURTS[1][0], z - COURTS[1][1]) - BEARER_RING_R) < 0.02, 'on the ring');
  assert.equal(raised.m, hostTeamHpFor(BEARER_TEAM_S, [10, 10, 10, 10], raised.a.length));
  // the challengers come over: the ward holds to the bearers' cap, said
  outs = run(raised._t + 250, raised._t + 2000, 1);
  const held = outs.find((o) => o.k === 'ph');
  assert.ok(held, 'the ward\'s word at the arrival');
  assert.equal(held.until, held._t + BEARER_WARD_MAX_MS, 'as long as they can hold it');
  assert.equal(f.pending?.wait, 'bearers');
  // nothing of his is cast while they stand
  outs = run(raised._t + 2000, raised._t + 9000, 1);
  assert.ok(!outs.some((o) => o.k === 'atk'), 'he waits under it');
  // a Pulse at whoever is near, in his element - and none at nobody
  const pulses = outs.filter((o) => o.k === 'aatk').flatMap((o) => o.a);
  assert.ok(pulses.length >= 1, 'they Pulse at the challengers near them');
  for (const [i, , x, z] of pulses) {
    const a = f.lg.ads.find((q) => q.i === i);
    assert.equal(a.k, HOST.bearer);
    assert.ok(bodiesIn(f, 1).some((b) => Math.hypot(b.x - x, b.z - z) <= BEARER_PULSE_NEAR + 0.01), 'a challenger near');
  }
  assert.equal(hostBlowUnder(HOST.bearer, fightProfile(f.md)).el, 'fire');
  // cut them down: the last falls, his own ward from then, the signature under it
  const pose = { x: COURTS[1][0] + 3, z: COURTS[1][1] + 4 };
  let t = raised._t + 9000;
  const said = [];
  for (const b of [...f.lg.ads]) {
    for (let k = 0; k < 40 && f.lg.ads.includes(b); k++, t += 300) said.push(...applyHostHit(f, 's1', b.i, 50, HIT_KINDS.Spell, pose, t));
  }
  assert.equal(said.filter((o) => o.k === 'adie' && o.w === HOST_GONE.slain).length, raised.a.length, 'each said slain');
  assert.ok(said.every((o) => o.n === 'P1'), 'by the striker\'s name');
  outs = run(t, t + 1500, 1);
  const broke = outs.find((o) => o.k === 'ph');
  assert.equal(broke.until, broke._t + SHIELD_MS, 'his own ward as the last falls');
  assert.ok(outs.some((o) => o.k === 'atk' && o.a === ATTACKS.nova.id), 'the signature, cast under it');
  // a second fight that never cuts them down: crumbled at the cap
  const g = fightOf([10]);
  g.hp = g.max * (PHASE_AT[0] - 0.01); g.nextAt = T0;
  const outsG = [];
  for (let tt = T0; tt < T0 + 45_000; tt += 250) outsG.push(...stepBrain(g, tt, bodiesIn(g, g.court, 1), seeded(tt)).map((o) => ({ ...o, _t: tt })));
  const crumbled = outsG.find((o) => o.k === 'adie' && o.w === HOST_GONE.crumbled);
  const arrived = outsG.find((o) => o.k === 'ph' && o.until - o._t === BEARER_WARD_MAX_MS);
  assert.ok(crumbled && arrived);
  assert.ok(crumbled._t >= arrived._t + BEARER_WARD_MAX_MS && crumbled._t <= arrived._t + BEARER_WARD_MAX_MS + 250, 'crumbled at the cap');
  // once a court: nothing more rises in it
  assert.equal(outsG.filter((o) => o.k === 'ad' && o.w === HOST.bearer).length, 1);
  // and a Pulse at nobody never comes: a lone challenger at the new court's heart, clear of every Ward-Bearer's reach
  const lone = fightOf([10]);
  lone.hp = lone.max * (PHASE_AT[0] - 0.01); lone.nextAt = T0;
  let blows = 0;
  for (let tt = T0; tt < T0 + 20_000; tt += 250) {   // (inside the bearers' cap - they stand throughout)
    const k = lone.court, heart = { sub: 's1', x: COURTS[k][0], z: COURTS[k][1], dead: false };
    for (const o of stepBrain(lone, tt, [heart], seeded(tt))) if (o.k === 'aatk') blows++;
  }
  assert.ok(lone.lg.ads.some((a) => a.k === HOST.bearer), 'they stand');
  assert.ok(BEARER_RING_R > BEARER_PULSE_NEAR);
  assert.equal(blows, 0, 'nobody near them - no Pulse');
});

test('WB11 the turns and the ends: at a phase\'s turn every one standing crumbles (each kind is its phase\'s or its court\'s); the Wrath\'s word crumbles them; his fall takes them with him in silence (mutants: a host outliving its phase; a host fighting on through the Wrath)', () => {
  const f = fightOf([10, 10]);
  let t = T0;
  for (; t < T0 + HARRY_FIRST_MS + 2000; t += 250) stepBrain(f, t, bodiesIn(f), seeded(t));
  const standing = f.lg.ads.map((a) => a.i);
  assert.ok(standing.length);
  f.hp = f.max * (PHASE_AT[0] - 0.01);
  const out = stepBrain(f, t, bodiesIn(f), seeded(t));
  assert.deepEqual(kindsOf(out).slice(0, 2), ['ph', 'adie'], 'the turn, then its host gone');
  assert.deepEqual(out[1].is, standing); assert.equal(out[1].w, HOST_GONE.crumbled);
  assert.equal(f.lg.ads.length, 0);
  // the Wrath's word
  const g = fightOf([10, 10]);
  for (t = T0; t < T0 + HARRY_FIRST_MS + 2000; t += 250) stepBrain(g, t, bodiesIn(g), seeded(t));
  assert.ok(g.lg.ads.length);
  const w = stepBrain(g, g.wrathAt - ATTACKS.wrath.windup, bodiesIn(g), seeded(1));
  assert.ok(w.some((o) => o.k === 'adie' && o.w === HOST_GONE.crumbled));
  assert.ok(w.some((o) => o.k === 'atk' && o.a === ATTACKS.wrath.id));
  assert.equal(g.lg.ads.length, 0);
  // his fall
  const h = fightOf([60]);
  for (t = T0; t < T0 + HARRY_FIRST_MS + 2000; t += 250) stepBrain(h, t, bodiesIn(h), seeded(t));
  assert.ok(h.lg.ads.length);
  h.hp = 1;
  applyHit(h, 's1', 50, HIT_KINDS.Spell, { x: 3, z: 4 }, t);
  assert.ok(h.fell);
  assert.equal(h.lg.ads.length, 0);
  assert.ok(!stepBrain(h, t + 250, bodiesIn(h), seeded(2)).some((o) => HOST_WORDS.includes(o.k)), 'nothing more of it');
});

test('WB11 a blow on one of his host: the hand and the purse a blow on him is (his blow rate, the bucket, a melee blow within reach of its body, from the floor and from his court), counted as dealt and apart for the chart (`a`), never his threat; slain at nothing, said by the striker\'s name; a number nobody stands at is nothing (mutants: a blow from off his court; a melee blow from across the court; the host\'s share never counted)', () => {
  const f = fightOf([10, 10]);
  let t = T0;
  for (; t < T0 + HARRY_FIRST_MS + 1000; t += 250) stepBrain(f, t, bodiesIn(f), seeded(t));
  const a = f.lg.ads[0], [ax, az] = hostAt(a, t);
  const near = { x: ax + 1, z: az }, far = { x: -ax * 0.2, z: -az * 0.2 };
  assert.deepEqual(applyHostHit(f, 's1', a.i, 10, HIT_KINDS.Melee, { x: COURT_R + POSE_SLACK + 2, z: 0 }, t), [], 'off the floor');
  assert.equal(a.h, a.m);
  t += 1000;
  if (Math.hypot(far.x - ax, far.z - az) - HOST_KINDS[a.k].r > MELEE_REACH + POSE_SLACK) {
    applyHostHit(f, 's1', a.i, 10, HIT_KINDS.Melee, far, t);
    assert.equal(a.h, a.m, 'a swing from across the court');
  }
  // from the floor, but from a court he does not fight in (the second, its walkway laid): nothing - his host is his court's
  t += 1000;
  f.xa = [T0 - 60_000];
  assert.deepEqual(applyHostHit(f, 's1', a.i, 10, HIT_KINDS.Spell, { x: COURTS[1][0] + 2, z: COURTS[1][1] }, t), [], 'from another court');
  assert.equal(a.h, a.m);
  t += 1000;
  const p = f.players.s1, dealt = p.dealt, threat = f.threat.s1 ?? 0;
  applyHostHit(f, 's1', a.i, 7, HIT_KINDS.Melee, near, t);
  assert.equal(a.h, a.m - 7);
  assert.equal(p.dealt, dealt + 7, 'dealt - a part in the fight');
  assert.equal(p.hd, 7, 'and the host\'s share apart');
  assert.equal(f.threat.s1 ?? 0, threat, 'never his threat');
  // the cap a blow, the bucket - on another of them (a spell reaches it from anywhere in his court)
  t += 1000;
  const other = f.lg.ads.find((q) => q !== a);
  applyHostHit(f, 's1', other.i, 1e5, HIT_KINDS.Spell, near, t);
  assert.ok(p.clipped > 0, 'clipped and counted');
  // slain - said by name, gone from the floor
  let said = [];
  for (let k = 0; k < 20 && f.lg.ads.includes(a); k++) { t += 1000; said = applyHostHit(f, 's2', a.i, 40, HIT_KINDS.Shaft, near, t); }
  assert.deepEqual(said.map((o) => [o.k, o.is, o.w, o.n]), [['adie', [a.i], HOST_GONE.slain, 'P2']]);
  assert.equal(applyHostHit(f, 's2', a.i, 40, HIT_KINDS.Shaft, near, t + 2000).length, 0, 'nothing more at it');
  assert.equal(applyHostHit(f, 's2', 9999, 40, HIT_KINDS.Shaft, near, t + 3000).length, 0, 'a number nobody stands at');
  // the chart counts it apart
  f.fell = { at: t, top: [], n: 2, dm: damageChart(f) };
  const row = f.fell.dm.find((r) => r.n === 'P1');
  assert.equal(row.a, Math.round(p.hd));
  const plain = fightOf([10], null);
  applyHit(plain, 's1', 10, HIT_KINDS.Spell, { x: 3, z: 4 }, T0 + 9000);
  assert.ok(!('a' in damageChart(plain)[0]), 'a court with no host: no host column');
});

test('WB11 the checkpoint and the state: the host is plain numbers - a fight that went to storage steps exactly as the one that did not; the state names every one standing (its walk and its blow in flight), and the wire takes it whole (mutants: a field the state drops)', () => {
  const f = fightOf([10, 20, 30]);
  for (let t = T0; t < T0 + HARRY_FIRST_MS + 4000; t += 250) stepBrain(f, t, bodiesIn(f), seeded(t));
  const copy = JSON.parse(JSON.stringify(f));
  assert.deepEqual(copy, f);
  for (let t = T0 + HARRY_FIRST_MS + 4000; t < T0 + HARRY_FIRST_MS + 12_000; t += 250) assert.deepEqual(stepBrain(copy, t, bodiesIn(copy), seeded(t)), stepBrain(f, t, bodiesIn(f), seeded(t)));
  const st = stateOf(f);
  assert.ok(Array.isArray(st.lg) && st.lg.length === f.lg.ads.length);
  for (const [k, a] of f.lg.ads.entries()) {
    const q = st.lg[k];
    assert.deepEqual(q.slice(0, 4), [a.i, a.k, Math.ceil(a.h), a.m]);
    const r2 = (v) => Math.round(v * 100) / 100;
    assert.deepEqual(q.slice(4, 10), a.mv ? [a.mv.x, a.mv.z, a.mv.tx, a.mv.tz, a.mv.v, a.mv.at] : [r2(a.x), r2(a.z), r2(a.x), r2(a.z), 0, 0]);
    assert.deepEqual(q.slice(10), a.atk ? [a.atk.at, a.atk.x, a.atk.z] : [0, 0, 0]);   // AUDIT WB11 D7: read off the fight, not hostStateOf's own word again
  }
  assert.deepEqual(validGateOut(JSON.parse(JSON.stringify(st))).lg, st.lg, 'through JSON and the wire');
});

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB11 the wire: a blow on one of his host (`ahit` - its number, a sequence, a damage, a kind) projected field by field; the room\'s words of it - risen, walking, striking, its health, gone - and the state\'s host, each bounded; the chart row\'s `a`; the brain\'s law is 5 (mutants: a host body numbered nothing; a wave past the wire\'s most; a feeding\'s health past its whole)', () => {
  assert.equal(GATE_BRAIN_V, 5);
  assert.ok(GATE_KINDS.includes('ahit'));
  for (const k of HOST_WORDS) assert.ok(GATE_OUT_KINDS.includes(k), k);
  assert.deepEqual(validGateIn({ k: 'ahit', i: 4, q: 9, d: 12.5, r: 0, x: 1 }), { k: 'ahit', i: 4, q: 9, d: 12.5, r: 0 });
  for (const bad of [{ k: 'ahit', i: 0, q: 9, d: 12, r: 0 }, { k: 'ahit', i: 1.5, q: 9, d: 12, r: 0 }, { k: 'ahit', q: 9, d: 12, r: 0 }, { k: 'ahit', i: 2, q: 9, d: 0, r: 0 }, { k: 'ahit', i: 2, q: 9, d: 12, r: 3 }]) assert.equal(validGateIn(bad), null, JSON.stringify(bad));
  assert.deepEqual(validGateOut({ k: 'ad', w: 1, m: 90, a: [[3, 1, 2], [4, -5, 6]], at: 50, z: 1 }), { k: 'ad', w: 1, m: 90, a: [[3, 1, 2], [4, -5, 6]], at: 50 });
  assert.equal(validGateOut({ k: 'ad', w: 3, m: 90, a: [[3, 1, 2]], at: 50 }), null, 'no fourth kind');
  assert.equal(validGateOut({ k: 'ad', w: 0, m: 0, a: [[3, 1, 2]], at: 50 }), null, 'a body of no health');
  assert.equal(validGateOut({ k: 'ad', w: 0, m: 9, a: Array.from({ length: GATE_HOST_MAX + 1 }, (_, i) => [i + 1, 0, 0]), at: 50 }), null, 'past the most');
  assert.equal(validGateOut({ k: 'ad', w: 0, m: 9, a: [[0, 0, 0]], at: 50 }), null, 'numbered nothing');
  assert.deepEqual(validGateOut({ k: 'amv', m: [[3, 1, 2, 4, 5, 1.6, 77]] }), { k: 'amv', m: [[3, 1, 2, 4, 5, 1.6, 77]] });
  assert.equal(validGateOut({ k: 'amv', m: [[3, 1, 2, 4, 5, 25, 77]] }), null, 'a pace no body runs');
  assert.equal(validGateOut({ k: 'amv', m: [] }), null, 'a word of nothing');
  assert.deepEqual(validGateOut({ k: 'aatk', a: [[3, 900, 1, 2]] }), { k: 'aatk', a: [[3, 900, 1, 2]] });
  assert.equal(validGateOut({ k: 'aatk', a: [[3, 900, 1, 999]] }), null, 'off the arena');
  assert.deepEqual(validGateOut({ k: 'ah', h: [[3, 40], [4, 0]] }), { k: 'ah', h: [[3, 40], [4, 0]] });
  assert.deepEqual(validGateOut({ k: 'adie', is: [3], w: 0, n: ' Ann‮ ', at: 9 }), { k: 'adie', is: [3], w: 0, n: 'Ann', at: 9 });
  assert.deepEqual(validGateOut({ k: 'adie', is: [3], w: 1, h: 50, m: 100, at: 9 }), { k: 'adie', is: [3], w: 1, h: 50, m: 100, at: 9 });
  assert.equal(validGateOut({ k: 'adie', is: [3], w: 1, h: 150, m: 100, at: 9 }), null, 'past his whole');
  assert.equal(validGateOut({ k: 'adie', is: [3], w: 1, h: 50, at: 9 }), null, 'a health without its whole');
  assert.equal(validGateOut({ k: 'adie', is: [3], w: 3, at: 9 }), null);
  const st = { k: 'st', d: 5, b: 'ruhn', ph: 1, h: 50, m: 100, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: 9e12, n: 2, fell: null, wrath: null, md: [...LEGION] };
  assert.ok(!('lg' in validGateOut(st)), 'none said, none projected');
  const lg = [[1, 0, 20, 45, 1, 2, 3, 4, 5, 100, 0, 0, 0], [2, 2, 30, 30, 5, 5, 5, 5, 0, 0, 900, 5, 5]];
  assert.deepEqual(validGateOut({ ...st, lg }).lg, lg);
  assert.deepEqual(validGateOut({ ...st, lg: [] }).lg, [], 'a host of none - the trial, between waves');
  assert.equal(validGateOut({ ...st, lg: [[1, 0, 50, 45, 1, 2, 3, 4, 5, 100, 0, 0, 0]] }), null, 'a body past its whole');
  assert.equal(validGateOut({ ...st, lg: [[1, 0, 20, 45, 1, 2, 3, 4, 5, 100, 0, 0]] }), null, 'a tuple short');
  const row = { n: 'Ann', l: 10, d: 500, x: 0, h: 3, b: 90, f: 0 };
  assert.deepEqual(validGateOut({ k: 'fell', at: 9, top: [], n: 1, dm: [{ ...row, a: 120 }] }).dm[0].a, 120);
  assert.ok(!('a' in validGateOut({ k: 'fell', at: 9, top: [], n: 1, dm: [row] }).dm[0]));
  assert.equal(validGateOut({ k: 'fell', at: 9, top: [], n: 1, dm: [{ ...row, a: 600 }] }).dm, undefined, 'a share past the whole: no chart (the fall kept)');
});

test('WB11 the relay: a fighter\'s blow on one of his host is judged by the brain as it comes, and its fall said to the whole court at once (mutants: the blow judged as a blow on him; its fall said to the striker alone)', async () => {
  const DAY = 202, TT = gateTimes(DAY);
  const realNow = Date.now; let clock = TT.openAt + 1000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const r = world.room(gateRoomKey(DAY));
    const at = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 10));
    const b = r.connect(); await r.hello(b, 'peer-0002', at(3, 10));
    for (const s of [a, b]) await r.raw(s, JSON.stringify({ t: 'gate', k: 'in', lv: 10, bv: GATE_BRAIN_V }));
    const f = r.room._fight;
    f.lg = { n: 3, ads: [{ i: 3, k: HOST.harrier, h: 30, m: 30, x: 0, z: 11, mv: null, atk: null, tg: null, tgAt: 0, up: 0, next: 0 }], harryAt: 0, sapAt: 0, fed: 0, wardCt: -1, hSent: '', hSentAt: 0 };
    const hp = f.hp;
    await r.raw(a, JSON.stringify({ t: 'gate', k: 'ahit', i: 3, q: 1, d: 25, r: 0 }));
    assert.equal(f.lg.ads[0].h, 5, 'judged on the body');
    assert.equal(f.hp, hp, 'never on him');
    clock += 1000;
    await r.raw(a, JSON.stringify({ t: 'gate', k: 'ahit', i: 3, q: 2, d: 25, r: 0 }));
    for (const s of [a, b]) {
      const said = s.sent.filter((m) => m.t === 'gate' && m.k === 'adie');
      assert.equal(said.length, 1, 'every socket in the court, at once');
      assert.deepEqual([said[0].is, said[0].w], [[3], HOST_GONE.slain]);
    }
    assert.equal(f.lg.ads.length, 0);
  } finally { Date.now = realNow; }
});

// ═══ THE LINK ════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB11 the link: his host folded - a wave risen (when, facing into the court), its walks (carried by the brain\'s own law), its blows, its health, the gone (where it stood at that moment, how, by whom - kept for the court, at most HOST_GONE_KEPT), a Sapper drunk moving his health; a whole state keeps what this screen saw rise; his fall and the Wrath clear it (mutants: the gone forgotten; a walk\'s word dropped)', () => {
  const st = { k: 'st', d: 5, b: 'ruhn', ph: 1, h: 50, m: 100, x: 0, z: 0, yw: 0, mv: null, atk: null, sh: 0, wr: 9e12, n: 2, fell: null, wrath: null, md: [...LEGION], lg: [] };
  let s = foldGate(GATE_STATE_EMPTY, st, 10);
  assert.deepEqual(s.lg, { ads: [], gone: [] });
  assert.equal(foldGate(GATE_STATE_EMPTY, { ...st, lg: undefined }, 10).lg, null, 'no host said, none held');
  s = foldGate(s, { k: 'ad', w: 0, m: 45, a: [[1, 22, 0], [2, -22, 0]], at: 100 }, 100);
  assert.deepEqual(s.lg.ads.map((a) => [a.i, a.k, a.h, a.m, a.rose]), [[1, 0, 45, 45, 100], [2, 0, 45, 45, 100]]);
  assert.ok(Math.abs(s.lg.ads[0].yaw - Math.atan2(-22, 0)) < 1e-9, 'facing into the court');
  s = foldGate(s, { k: 'amv', m: [[1, 22, 0, 12, 0, 5, 1000]] }, 1000);
  assert.deepEqual(hostAt(s.lg.ads[0], 2000), [17, 0], 'carried by the brain\'s law');
  s = foldGate(s, { k: 'aatk', a: [[2, 1900, -22, 0]] }, 1000);
  assert.deepEqual(s.lg.ads[1].atk, { at: 1900, x: -22, z: 0 });
  s = foldGate(s, { k: 'ah', h: [[1, 30]] }, 1100);
  assert.equal(s.lg.ads[0].h, 30);
  s = foldGate(s, { k: 'adie', is: [1], w: 0, n: 'Ann', at: 2000 }, 2000);
  assert.deepEqual(s.lg.ads.map((a) => a.i), [2]);
  assert.deepEqual(s.lg.gone, [{ i: 1, k: 0, x: 17, z: 0, w: 0, n: 'Ann', at: 2000 }], 'where it stood at that moment');
  const again = foldGate(s, { ...st, lg: [[2, 0, 45, 45, -22, 0, -22, 0, 0, 0, 1900, -22, 0]] }, 2100);
  assert.equal(again.lg.ads[0].rose, 100, 'what this screen saw rise is kept');
  assert.deepEqual(again.lg.gone, s.lg.gone, 'and the gone');
  // a Sapper drunk: his health moves with it
  let t = foldGate(again, { k: 'ad', w: 1, m: 90, a: [[5, 0, 20]], at: 3000 }, 3000);
  t = foldGate(t, { k: 'adie', is: [5], w: 1, h: 60, m: 100, at: 4000 }, 4000);
  assert.deepEqual([t.hp, t.max], [60, 100]);
  assert.equal(t.lg.gone.at(-1).w, HOST_GONE.fed);
  // the Ward-Bearers' rising says how many hold the ward
  t = foldGate(t, { k: 'ad', w: 2, m: 120, a: [[6, 9, 0], [7, -9, 0], [8, 0, 9]], at: 5000 }, 5000);
  assert.deepEqual(t.lg.ward, { n: 3, at: 5000, is: [6, 7, 8] });   // AUDIT WB11 C5: and which rose
  // at most HOST_GONE_KEPT
  for (let k = 0; k < HOST_GONE_KEPT + 5; k++) { t = foldGate(t, { k: 'ad', w: 0, m: 9, a: [[100 + k, 0, 0]], at: 6000 + k }, 6000); t = foldGate(t, { k: 'adie', is: [100 + k], w: 2, at: 6000 + k }, 6000); }
  assert.equal(t.lg.gone.length, HOST_GONE_KEPT);
  // his fall and the Wrath clear the floor
  assert.deepEqual(foldGate(t, { k: 'fell', at: 9000, top: [], n: 2 }, 9000).lg.ads, []);
  assert.deepEqual(foldGate(t, { k: 'wrath', at: 9000 }, 9000).lg.ads, []);
});

// ═══ THE LOOK ════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB11 the look: an Imp for every Harrier (hovering), the Atronach of his element for a Sapper, the nearest Daedra for a Ward-Bearer (the Seducer winged for the storm); its acts - rising out of the floor, winding up, striking, walking, idle - and its fall; its voice its own mobile\'s; its stand-in his law over its own mobile (mutants: a Sapper of the wrong element; the rise drawn standing)', () => {
  assert.deepEqual(HOST_LOOKS.sapper, { burning: 35, rime: 38, storm: 36, venom: 37 });
  assert.deepEqual(['burning', 'rime', 'storm', 'venom'].map((a) => hostLookOf(HOST.sapper, a).name), ['Fire Atronach', 'Ice Atronach', 'Iron Atronach', 'Flesh Atronach']);
  assert.deepEqual(['burning', 'rime', 'storm', 'venom'].map((a) => hostLookOf(HOST.bearer, a).name), ['Fire Daedra', 'Frost Daedra', 'Daedra Seducer', 'Daedroth']);
  assert.equal(hostLookOf(HOST.bearer, 'storm').winged, true);
  const imp = hostLookOf(HOST.harrier, 'venom');
  assert.deepEqual([imp.name, imp.plural, imp.mobile], ['Imp', 'Imps', 1]);
  assert.ok(imp.hover > 0, 'an Imp flies');
  assert.equal(hostLookOf(HOST.sapper, 'nope').mobile, 35, 'an aspect it does not know: the Burning\'s');
  const a = { i: 1, k: HOST.sapper, h: 10, m: 10, x: 0, z: 0, mv: null, atk: null, rose: 1000, yaw: 0 };
  const rising = hostAct(a, 1000 + HOST_RISE_MS[HOST.sapper] / 2, hostLookOf(1, 'burning'));
  assert.equal(rising.act, 'rise'); assert.ok(rising.sink > 0, 'under the floor still');
  assert.equal(hostAct(a, 1000 + HOST_RISE_MS[HOST.sapper], hostLookOf(1, 'burning')).act, 'idle');
  const walk = { ...a, mv: { x: 0, z: 0, tx: 10, tz: 0, v: 1.6, at: 5000 } };
  assert.equal(hostAct(walk, 6000, hostLookOf(1, 'burning')).act, 'walk');
  const bite = { ...a, k: HOST.harrier, atk: { at: 9000, x: 0, z: 0 } };
  assert.equal(hostAct(bite, 9000 - 100, imp).act, 'windup');
  assert.equal(hostAct(bite, 9050, imp).act, 'strike');
  assert.equal(hostFallAct({ i: 1, k: 0, x: 0, z: 0, w: 0, at: 100 }, 100 + HOST_FALL_MS / 2, imp).act, 'fall');
  assert.equal(hostFallAct({ i: 1, k: 0, x: 0, z: 0, w: 0, at: 100 }, 100 + HOST_FALL_MS, imp).act, 'gone');
  assert.equal(hostFallAct({ i: 1, k: 1, x: 0, z: 0, w: 1, at: 100 }, 101, imp).act, 'gone', 'drunk: into him at once');
  assert.ok(hostFallAct({ i: 1, k: 2, x: 0, z: 0, w: 2, at: 100 }, 100 + HOST_FALL_MS / 2, imp).sink > 0, 'crumbling, it sinks');
  assert.equal(hostCue('windup', 35).clip, ENEMY_BASICS[35].barkSound);
  assert.equal(hostCue('land', 26).clip, ENEMY_BASICS[26].attackSound);
  const e = hostStandIn(hostLookOf(HOST.bearer, 'rime'));
  assert.deepEqual([e.name, e.minMetalToHit, e.armor, e.pacifyImmune, e.mobileType], ['Frost Daedra', 0, BOSS_ARMOR, true, 25]);
});

test('WB11 the clock of a host blow and its verdict on me: its disc about where it was laid, judged at the first frame at or past its landing, a landing met too late lets it pass (mutants: the disc judged before its landing; a stale landing struck)', () => {
  const atk = { at: 5000, x: 1, z: 1 };
  assert.equal(hostVerdict(atk, HOST.harrier, 1, 1, 4999), 'wait');
  assert.equal(hostVerdict(atk, HOST.harrier, 1 + HOST_BLOWS[0].r - 0.01, 1, 5000), 'hit');
  assert.equal(hostVerdict(atk, HOST.harrier, 1 + HOST_BLOWS[0].r + 0.01, 1, 5000), 'miss');
  assert.equal(hostVerdict(atk, HOST.harrier, 1, 1, 5000 + HOST_BLOWS[0].active + STRIKE_LATE_MS + 1), 'miss', 'too late');
  assert.equal(hostVerdict(atk, HOST.sapper, 1, 1, 5000), 'miss', 'a Sapper strikes nobody');
  const c = hostTelegraphAt(atk, HOST.bearer, 5000 - HOST_BLOWS[2].windup / 2);
  assert.deepEqual([c.t, c.landing, c.over, c.key], [0.5, false, false, 'pulse']);
  assert.equal(hostTelegraphAt(atk, HOST.bearer, 5000).landing, true);
});

// ═══ THE COURT ═══════════════════════════════════════════════════════════════════════════════════════════════════

function court({ feet = [0, 0, 4] } = {}) {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const said = [], sounds = [], hsent = [], struck = [];
  const me = { health: 100, maxHealth: 100 };
  const c = createGateCourt({
    renderer: null, gl: null, audio: { play3d: (clip, p, v, o) => sounds.push(['clip', clip, p, o]), play3dId: (id, p, v, o) => sounds.push(['id', id, p, o]) },
    link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), feet: () => courtToDungeon(feet[0], 0, feet[2]), player: () => me,
    say: (t) => said.push(t), sendHost: (h) => { hsent.push(h); return true; }, strike: (dmg, how) => struck.push([dmg, how]),
  });
  return { c, link, clock, said, sounds, hsent, struck, me };
}
const stOf = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', phase: 1, hp: 800, max: 1000, fighters: 3, wrathAt: 10_000_000, md: LEGION, lg: { ads: [], gone: [] }, ...over });
const ad = (o) => ({ i: 1, k: HOST.harrier, h: 45, m: 45, x: 0, z: 6, mv: null, atk: null, rose: -Infinity, yaw: 0, ...o });

test('WB11 the court: a wave\'s rising said once and heard where each rises (while it is news); each one a body my blows meet from his court - its number, its feet, its body, its stand-in; a blow of mine out as the wire\'s `ahit` (whole points, its own sequence); a blow of its own judged against my feet at its landing and landed through the court\'s door; a Sapper drunk, a Ward-Bearer cut down and the last, said (mutants: a stale wave said; a blow landed outside its disc; the targets offered from off his court)', () => {
  destroyGateBossBar(); destroyGateMarksCard(); destroyGateGround();
  const h = court();
  const tick = (t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); };
  // a wave, fresh: said once, each heard rising where it rises
  tick(10_000, stOf({ lg: { ads: [ad({ i: 1, x: 20, z: 6, rose: 9_900 }), ad({ i: 2, x: -20, z: 6, rose: 9_900 })], gone: [] } }));
  tick(10_100);
  assert.deepEqual(h.said.filter((t) => t.startsWith('Imps')), [COURT_HOST_TEXT.harriers('Valkynaz Ruhn', 'Imps')]);   // WB13b: "Imps rise from the fire!"
  assert.equal(h.sounds.filter((s) => s[1] === ENEMY_BASICS[1].barkSound).length, 2, 'each heard rising');
  // a stale wave (a screen come in late) is not said
  const late = court();
  late.link.st = stOf({ lg: { ads: [ad({ i: 9, rose: 0 })], gone: [] } }); late.clock.t = 50_000; late.c.frame();
  assert.equal(late.said.length, 0, 'nothing - the wave is stale (WB13b: and the marks are the card\'s, never a line)');
  // the targets: each standing one, from his court
  const T = h.c.hostTargets();
  assert.deepEqual(T.map((q) => q.i), [1, 2]);
  // AUDIT WB11 W4: met where it is drawn - 200 ms into its rise it is still under the floor by its sink
  const want = courtToDungeon(20, hostLookOf(0, 'burning').hover - HOST_KINDS[0].h * (1 - 200 / HOST_RISE_MS[0]), 6);
  assert.ok(T[0].feet.every((v, k) => Math.abs(v - want[k]) < 1e-9), `${T[0].feet} at ${want}`);
  assert.deepEqual([T[0].height, T[0].radius, T[0].mobile, T[0].name, T[0].entity.name], [HOST_KINDS[0].h, HOST_KINDS[0].r, 1, 'Imp', 'Imp']);
  const away = court({ feet: [COURTS[2][0], 0, COURTS[2][1]] });
  away.link.st = stOf({ lg: { ads: [ad({ i: 1 })], gone: [] } }); away.clock.t = 1; away.c.frame();
  assert.deepEqual(away.c.hostTargets(), [], 'from a court he does not fight in, nothing offered');
  // a blow of mine: out as `ahit`
  assert.equal(h.c.hostHit({ i: 1, d: 12.6, r: HIT_KINDS.Melee }), true);
  assert.deepEqual(h.hsent, [{ i: 1, q: 1, d: 13, r: HIT_KINDS.Melee }]);
  assert.equal(h.c.hostHit({ i: 1, d: 0.4, r: HIT_KINDS.Melee }), false, 'under a point is none');
  assert.equal(h.c.hostHit({ i: 77, d: 10, r: HIT_KINDS.Melee }), false, 'nobody of that number');
  // a Bite laid at my feet lands on me at its landing; one beside me does not
  tick(11_000, stOf({ lg: { ads: [ad({ i: 1, x: 0, z: 5, atk: { at: 11_900, x: 0, z: 5 } }), ad({ i: 2, x: 15, z: 6, atk: { at: 11_900, x: 15, z: 6 } })], gone: [] } }));
  assert.equal(h.struck.length, 0, 'not before its landing');
  tick(11_900);
  assert.equal(h.struck.length, 1, 'once - the one I stood in');
  const B = hostBlowUnder(HOST.harrier, fightProfile(LEGION));
  assert.deepEqual(h.struck[0], [Math.round(B.pct * 100 + B.base), { fire: false, el: null, name: 'Bite' }]);
  tick(12_000);
  assert.equal(h.struck.length, 1, 'judged once');
  // the gone: a Sapper drunk, a Ward-Bearer cut down by name, the last
  h.said.length = 0;
  const ward = { ads: [ad({ i: 5, k: HOST.bearer }), ad({ i: 6, k: HOST.bearer })], gone: [], ward: { n: 3, at: 12_000 } };
  tick(13_000, stOf({ phase: 2, shieldUntil: 40_000, lg: { ...ward, gone: [{ i: 4, k: HOST.bearer, x: 9, z: 0, w: 0, n: 'Ann', at: 12_990 }, { i: 3, k: HOST.sapper, x: 0, z: 2, w: 1, n: null, at: 12_995 }] } }));
  assert.ok(h.said.includes(COURT_HOST_TEXT.felled('Ann', 2)), 'cut down by name, how many stand');
  assert.ok(h.said.includes(COURT_HOST_TEXT.drunk('Valkynaz Ruhn', 'Fire Atronach')));
  assert.equal(COURT_HOST_TEXT.drunk('Valkynaz Ruhn', 'Ice Atronach'), 'An Ice Atronach reaches Valkynaz Ruhn and heals him.');   // WB13b: the effect
  h.said.length = 0;
  tick(14_000, stOf({ phase: 2, shieldUntil: 40_000, lg: { ads: [], gone: [{ i: 5, k: 2, x: 9, z: 0, w: 0, n: 'Bran', at: 13_990 }, { i: 6, k: 2, x: -9, z: 0, w: 0, n: 'Bran', at: 13_995 }] } }));
  assert.ok(h.said.includes(COURT_HOST_TEXT.felled('Bran', 0)));
  assert.equal(COURT_HOST_TEXT.felled('Bran', 0), 'The last Ward-Bearer falls. His ward is failing!');   // AUDIT WB11 D1
  h.c.leave();
  assert.deepEqual(h.c.state().host.bodies, []);
});

test('WB11 the ground and the bar: each blow\'s disc wound up on the floor (blows first, at most HOST_SHAPES_MAX), a Ward-Bearer\'s tether in the ward\'s gold while it holds, a Sapper\'s path faint; the bar counts the Ward-Bearers holding his ward (of how many rose) and the rest of his host in the foot (mutants: a tether drawn after the ward broke; the bearers uncounted)', () => {
  const P = fightProfile(LEGION);
  const s = stOf({ phase: 2, shieldUntil: 20_000, lg: { ads: [ad({ i: 1, k: HOST.harrier, atk: { at: 10_500, x: 2, z: 3 } }), ad({ i: 2, k: HOST.bearer, x: 9, z: 0 }), ad({ i: 3, k: HOST.sapper, x: -20, z: 0, mv: { x: -20, z: 0, tx: -3, tz: 0, v: 1.6, at: 9000 } })], gone: [], ward: { n: 3, at: 1 } } });
  const shapes = hostShapes(s, 10_000, P);
  assert.deepEqual(shapes.map((q) => q.kind), [TELEGRAPH_KIND.disc, TELEGRAPH_KIND.lane, TELEGRAPH_KIND.lane]);
  assert.deepEqual([shapes[0].origin, shapes[0].r], [[2, 3], HOST_BLOWS[0].r]);
  assert.ok(shapes[0].t > 0 && shapes[0].t < 1, 'winding up');
  assert.deepEqual(shapes[1].color, WARD_COLOR, 'the tether in the ward\'s gold');
  assert.ok(shapes[2].alpha < shapes[1].alpha, 'the path faint');
  assert.deepEqual(hostShapes({ ...s, shieldUntil: 0 }, 10_000, P).map((q) => q.kind), [TELEGRAPH_KIND.disc, TELEGRAPH_KIND.lane], 'no tether once the ward broke');
  assert.deepEqual(hostShapes({ ...s, fell: { at: 1 } }, 10_000, P), [], 'none once he has fallen');
  const many = { ...s, lg: { ...s.lg, ads: Array.from({ length: 12 }, (_, k) => ad({ i: k + 1, atk: { at: 10_500, x: k, z: 0 } })) } };
  assert.equal(hostShapes(many, 10_000, P).length, HOST_SHAPES_MAX);
  const bar = bossBarModel(s, 10_000, { name: 'Valkynaz Ruhn', title: 'Warden of the Burning Gate' });
  assert.equal(bar.host, BOSS_BAR_TEXT.host(2));
  const quiet = bossBarModel({ ...s, lg: { ...s.lg, ads: s.lg.ads.slice(1, 2) } }, 10_000, { name: 'Valkynaz Ruhn', title: 'Warden' });
  assert.equal(quiet.callout.text, 'Ward-Bearers - 1 of 3 stands');
  assert.equal(BOSS_BAR_TEXT.bearers(2, 2), 'Ward-Bearers - 2 stand');
  assert.equal(quiet.host, null, 'no host but the bearers');
  assert.equal(bossBarModel(stOf({ lg: null }), 10, { name: 'X', title: 'Y' }).host, null);
});

test('WB11 the damage chart: a court his host stood in shows each challenger\'s share of it in a column of its own; any other court\'s chart is as it was (mutants: the column shown for a court with no host)', () => {
  const dm = [{ n: 'P1', l: 10, d: 3000, x: 400, h: 20, b: 900, f: 0, a: 640 }, { n: 'P2', l: 10, d: 2000, x: 0, h: 9, b: 300, f: 1, a: 0 }];
  const m = damageChartModel({ at: 0, top: [], n: 2, dm }, { since: 0, now: DAMAGE_CHART_DELAY_MS + 1000 });
  assert.equal(m.hosted, true);
  assert.deepEqual(m.head, [...DAMAGE_CHART_TEXT.head, DAMAGE_CHART_TEXT.host]);
  assert.deepEqual(m.rows.map((r) => r.host), ['640', '0']);
  const plain = damageChartModel({ at: 0, top: [], n: 2, dm: dm.map(({ a, ...r }) => (void a, r)) }, { since: 0, now: DAMAGE_CHART_DELAY_MS + 1000 });
  assert.equal(plain.hosted, false);
  assert.deepEqual(plain.head, DAMAGE_CHART_TEXT.head);
  assert.ok(!('host' in plain.rows[0]));
});

// ═══ THE PLUMBING ════════════════════════════════════════════════════════════════════════════════════════════════

test('WB11 the plumbing, read: the world host sends a blow on one of his host as the wire\'s `ahit` and hands the court\'s host down; the modes hand it to the dungeon context; the context meets it with the swing, the shaft and the spell, never in `foes`; the magic host routes a spell that met one through its door (mutants: the world host\'s door dropped; the swing blind to it)', () => {
  const w = read('src/scenes/world.js'), m = read('src/scenes/worldModes.js'), d = read('src/scenes/dungeonContext.js'), g = read('src/scenes/hostMagic.js'), r = read('server/src/index.js');
  assert.match(w, /sendHost: \(hit\) => !!online\?\.sendGate\?\.\(\{ k: 'ahit', \.\.\.hit \}\),/);
  assert.match(w, /gateHost: \(\) => gateCourt\?\.hostTargets\(\) \?\? null,/);
  assert.match(w, /onHostHit: \(hit\) => !!gateCourt\?\.hostHit\(hit\),/);
  assert.match(m, /gateHost: \(\) => host\.gateHost\?\.\(\) \?\? null,/);
  assert.match(m, /onHostHit: \(hit\) => !!host\.onHostHit\?\.\(hit\),/);
  assert.match(d, /for \(const hb of gateHostBodies\(\)\) \{ hb\._backFacing = false; live\.push\(hb\); \}/, 'the swing meets them');
  assert.match(d, /if \(foe\.host != null\) \{ hitEnemy = true; swingOnHost\(foe, damage, lookDir\); continue; \}/);
  assert.match(d, /const hb = gateHostBodies\(\)\.find\(\(q\) => !struckBy\(q\) && missileHitsCapsule\(m\.pos, q\.ai\.feet, q\.ai\.height, q\.ai\.radius\)\);/, 'the shaft');   // PIN MOVED (TECH1's follow-up, bible/05-Combat/Weapon-Techniques.md): a body a piercing shaft has struck is passed, so one overlapping it under the shaft is met
  assert.match(d, /castAtHost: opts\.gateHost \? \(sp, i\) => spellOnHost\(sp, i\) : null,/, 'the spell');
  assert.match(d, /const landOnHost = \(hb, damage, r\) => \(sdRemnant \? sdRemnant\.echoHit\(\{ i: hb\.host, d: damage, r \}\) : !!opts\.onHostHit\?\.\(\{ i: hb\.host, d: damage, r \}\)\);/);   // PIN MOVED (SD8c): an Echo's in the Hour
  assert.match(g, /const crystals = \[\.\.\.crystalMarksFor\(sp\), \.\.\.hostMarksFor\(sp\)\];/);
  assert.match(g, /if \(mark\?\.host != null\) \{ try \{ return !!castAtHost\?\.\(sp, mark\.host\); \} catch \{ return false; \} \}/);
  assert.match(r, /else if \(m\.k === 'ahit'\) this\._gateFan\(applyHostHit\(f, a\.sub, m\.i, m\.d, m\.r, a\.pose && !a\.pose\.dd \? this\._courtOf\(a\.pose\) : null, now, m\.q\)\);/, 'the relay judges it (AUDIT WB11 W3: by its blow\'s sequence)');
});

test('WB11 a whole Legion-Lord fight, stepped: Harriers in the first court, crumbled at the turn; Ward-Bearers as he lands in the second; Sappers there once its turn is done; Ward-Bearers again in the third - every word of the host the wire takes, and never more standing than the wire can name (mutants: a kind out of its phase)', () => {
  const f = fightOf([10, 10, 10, 10, 10, 10]);
  const seen = [];
  let t = T0;
  const step = (k, n = 1) => { for (let i = 0; i < n; i++, t += 250) for (const o of stepBrain(f, t, bodiesIn(f, k), seeded(t))) { if (HOST_WORDS.includes(o.k)) { assert.ok(validGateOut(JSON.parse(JSON.stringify(o))), `${o.k} is a word the wire takes`); seen.push({ ...o, phase: f.phase, court: f.court }); } assert.ok((f.lg?.ads.length ?? 0) <= HOST_STANDING_MAX); } };
  step(0, (HARRY_FIRST_MS + HARRY_EVERY_MS + 2000) / 250);
  assert.ok(seen.filter((o) => o.k === 'ad').every((o) => o.w === HOST.harrier && o.phase === 1));
  f.hp = f.max * (PHASE_AT[0] - 0.01);
  for (let k = 0; k < 400 && f.court !== 1; k++) step(0);
  step(1, (BEARER_WARD_MAX_MS + SAP_FIRST_MS + SAP_EVERY_MS + 8000) / 250);
  const second = seen.filter((o) => o.k === 'ad' && o.court === 1).map((o) => o.w);
  assert.deepEqual([...new Set(second)].sort(), [HOST.sapper, HOST.bearer].sort(), 'Ward-Bearers, then Sappers');
  assert.equal(second[0], HOST.bearer);
  f.hp = f.max * (PHASE_AT[1] - 0.01);
  for (let k = 0; k < 400 && f.court !== 2; k++) step(1);
  step(2, 40);
  const third = seen.filter((o) => o.k === 'ad' && o.court === 2).map((o) => o.w);
  assert.deepEqual(third, [HOST.bearer], 'the last court: its Ward-Bearers alone');
  void OPENING_MS; void SAP_EVERY_MS; void BEARER_PULSE_MS; void HP_SEND_MS; void HIT_CAP_X; void BOSS_TTK_S;
});

test('WB11 the bodies drawn: each one standing a billboard of its own mobile\'s sprite at its place (an Imp over the floor, one rising under it), its frame uploaded once; the court hands them on with his; one gone plays its fall and is put away after it; leaving the court puts every one away (mutants: a body never put away; a rising one drawn standing)', async () => {
  const made = [], destroyed = [], uploads = [], loaded = [];
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 60 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = {
    textures: new Set(),
    createBillboardBatch: (archive, rkey) => { const b = { archive, record: rkey, size: null, bounds: [0, 0, 0, 0], origin: null }; made.push(b); return b; },
    destroyBillboardBatch: (b) => destroyed.push(b),
  };
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const c = createGateCourt({
    renderer, gl: null, audio: null, link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20), feet: () => courtToDungeon(0, 0, 4), player: () => ({ health: 100, maxHealth: 100 }),
    getTexture: async (a) => { loaded.push(a); return tex; }, uploadRecordFrame: (a, r, f) => { uploads.push(`${a}_${r}#${f}`); renderer.textures.add(`${a}_${r}#${f}`); },
  });
  const frame = (t, st) => { if (st) link.st = st; clock.t = t; c.frame(); };
  frame(1000, stOf({ lg: { ads: [ad({ i: 1, x: 20, z: 6, rose: -Infinity }), ad({ i: 2, k: HOST.sapper, x: -20, z: 6, rose: 900 })], gone: [] } }));
  await new Promise((r) => setTimeout(r, 0));
  frame(1016);
  assert.deepEqual(loaded.filter((a) => a !== ENEMY_BASICS[31].maleTexture).sort(), [ENEMY_BASICS[1].maleTexture, ENEMY_BASICS[35].maleTexture].sort(), 'each mobile\'s sprite, loaded once (his own beside them)');
  const host = c.batches().filter((b) => b.archive === ENEMY_BASICS[1].maleTexture || b.archive === ENEMY_BASICS[35].maleTexture);
  assert.equal(host.length, 2, 'a billboard each, handed on with the court\'s');
  const imp = host.find((b) => b.archive === ENEMY_BASICS[1].maleTexture), sapper = host.find((b) => b.archive === ENEMY_BASICS[35].maleTexture);
  const impAt = courtToDungeon(20, 0, 6);
  assert.ok(Math.abs(imp.origin[0] - impAt[0]) < 1e-9 && Math.abs(imp.origin[2] - impAt[2]) < 1e-9, 'where it stands');
  assert.ok(imp.origin[1] > impAt[1] + 0.5, 'an Imp over the floor');
  assert.ok(sapper.origin[1] < courtToDungeon(-20, 0, 6)[1], 'one still rising: under the floor yet');
  const n = uploads.length;
  frame(1032);
  assert.equal(uploads.length, n, 'a frame uploaded once');
  // one gone: its fall played, then put away
  frame(2000, stOf({ lg: { ads: [ad({ i: 2, k: HOST.sapper, x: -20, z: 6, rose: 900 })], gone: [{ i: 1, k: 0, x: 20, z: 6, w: 0, n: 'Ann', at: 1990 }] } }));
  assert.ok(c.batches().includes(imp), 'falling, still drawn');
  frame(1990 + HOST_FALL_MS + 10);
  assert.ok(destroyed.includes(imp) && !c.batches().includes(imp), 'put away after its fall');
  c.leave();
  assert.ok(destroyed.includes(sapper), 'leaving the court puts every one away');
});
