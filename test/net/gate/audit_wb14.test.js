// AUDIT WB14 (2026-10-20, Mac: "Please audit this and ensure perfection"): THE RELAY'S HALF OF THE PORTENTS ARC, pinned -
// each finding of the six cold lanes the relay's brain or Room owns, reproduced as its lane found it and held fixed
// (bible/01-Overview/audits/Audit-Breach-Portents.md - the lanes, the findings, the verdicts).
//
//   the brain        net/gate/gateBrain.js applyHit (LAW-1 the stun his whole's; LAW-3 no blow with every share out, no fall
//                    sundered), credit (LAW-3), kneel (LAW-4), payTithe and applyHostHit's `rng` (LAW-5, WIRE-4), stepTithe's
//                    court (LAW-2, RECORD-1), attacksFor's `kit` and the Chains' hold (LAW-6, LAW-10), stepVanguard's echo
//                    and its patience's word (LAW-7, RECORD-9), stepCaptive's gaolers (LAW-8) and their first Pulse (FIX-1),
//                    newFight's portents (LAW-9), begin's cooldown (LAW-11), rejoin's state (WIRE-3), the mending's
//                    (WIRE-5); and the laws a lane found unpinned (RECORD-2, -3, -4, -7, -8); the balance (PLAY-1 a half
//                    risen level with the other, PLAY-4 a Vanguard night's health); systems/gate/gateSpoils.js (PLAY-7)
//   the relay        server/src/index.js _gateFanKept (WIRE-2 - a tithe kept before it is said)
//
// Design: bible/11-Multiplayer/Breach-Portents.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newFight, joinFight, stepBrain, applyHit, applyHostHit, stateOf, attacksFor, fightProfile, hostAt, inCourt,
  ATTACKS, ATTACK_BY_ID, COURTS, FLOOR, HOST, HOST_GONE, HIT_KINDS, BRAIN_TICK_MS, OPENING_MS, PHASE_AT, HALF, SUNDER_KITS,
  SUNDER_PAIR_MS, SUNDER_LAST, SUNDER_LONE_MS, SUNDER_SPLIT_MIN, CROSS_WARD_MAX_MS, VG_STANDING_MAX, VG_PATIENCE_MS, VG_STAGES,
  CHAIN_HOLD_M, HOST_RISE_MS, BEARER_PULSE_FIRST_MS, STUN_HIT_X, COURT_R, COURT_CENTRE, BASE_PROFILE, VG_WORD, SUNDER_RISE, SUNDER_RISE_MIN,
  VG_TEAM_S, VG_SHARE_X,
} from '../../../src/net/gate/gateBrain.js';
import { gateTimes, gateRoomKey, gatePortentsOf, gateTitheOf } from '../../../src/net/gate/gateLaw.js';
import { validGateOut, GATE_BRAIN_V } from '../../../src/net/wire.js';
import { fakeRooms } from '../../fakeRoom.mjs';

const T0 = 1_000_000, WRATH = T0 + 3_600_000;
const seeded = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const kinds = (out, k) => out.filter((o) => o.k === k);

/** A fight of `n` at level 10 about the first court's heart - `pt` its portents, `md` its marks, `ti` its Tithe-Imp. */
function fight(n, pt = null, md = null, ti = null, { wrath = WRATH, seed = 3 } = {}) {
  const f = newFight(7, T0, wrath, 'ruhn', md, pt, ti);
  const where = {}, dead = {};
  for (let i = 0; i < n; i++) { joinFight(f, `s${i}`, `F${i}`, 10, T0, true); where[`s${i}`] = [3 + (i % 5), 3 + Math.floor(i / 5)]; }
  const bodies = () => Object.entries(where).filter(([, p]) => p).map(([sub, p]) => ({ sub, id: `peer-${sub}`, x: p[0], z: p[1], dead: !!dead[sub] }));
  const run = { f, where, dead, bodies, t: T0, out: [], rng: seeded(seed) };
  run.step = (k = 1) => { for (let i = 0; i < k; i++) { const o = stepBrain(f, run.t, bodies(), run.rng); for (const x of o) x._t = run.t; run.out.push(...o); run.t += BRAIN_TICK_MS; } return run; };
  run.until = (at) => { while (run.t < at) run.step(); return run; };
  run.put = (sub, court, dx = 2, dz = 0) => { const C = COURTS[court]; where[sub] = [C[0] + dx, C[1] + dz]; };
  run.all = (court) => Object.keys(where).forEach((s, i) => run.put(s, court, 2 + (i % 5) * 2, Math.floor(i / 5) * 2 - 4));
  /** a blow of `sub`'s, its purse and its hand full (the caps are WB4b's and WB11's, pinned there) */
  run.hit = (sub, d, b = undefined, at = run.t) => { const p = f.players[sub]; p.bucket = 1e9; p.rate = 4; const w = where[sub]; return applyHit(f, sub, d, HIT_KINDS.Spell, { x: w[0], z: w[1] }, at, null, b === 1 ? { b: 1 } : {}); };
  return run;
}
/** A Sundering night of four torn in two (the split layout): the Blade's two in the second court, the Flame's in the third,
 *  both halves past their turns and their wards. */
function sundered(opts = {}) {
  const run = fight(4, ['sunder'], null, null, opts), { f } = run;
  while (f.hp / f.max > PHASE_AT[0] + 0.005) { f.hp -= f.max * 0.01; run.step(); }
  for (let k = 0; k < 80 && !f.sd; k++) { f.hp = Math.min(f.hp, f.max * 0.659); run.step(); }
  assert.ok(f.sd?.two, 'torn in two, the split layout');
  run.put('s0', 1); run.put('s1', 1, 3); run.put('s2', 2); run.put('s3', 2, 3);
  for (let k = 0; k < 200 && (run.t < f.shieldUntil || run.t < f.sd.fl.shieldUntil || f.atk || f.sd.fl.atk); k++) run.step();
  return run;
}
/** A half's pool brought down to `left` (a fraction of his whole) by `sub`'s blows. */
function drain(run, sub, b, left = 0) {
  const { f } = run, H = b ? f.sd.fl : f.sd.bl;
  for (let g = 0; H.h > left + 1e-9 && !H.kn && g < 9000; g++) { run.hit(sub, Math.min(700, (H.h - left) * f.max + (left ? 0 : 1)), b); run.t += 1; }
}

// ═══ LAW ══════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WB14 LAW-1 the Reckoning\'s stun weights a blow on him whole - a Blade kneeling (its stun its own) makes the Flame take no more (mutants: the stun read sundered)', () => {
  const run = sundered(), { f } = run;
  const flameBlow = () => run.hit('s2', 100, 1);
  assert.equal(flameBlow(), 100, 'the Blade standing');
  drain(run, 's0', HALF.blade);
  assert.ok(f.sd.bl.kn && run.t < f.stunUntil, 'the Blade kneels, its stun on his own fields');
  assert.equal(flameBlow(), 100, 'the Flame takes what it took');
  // whole, a stun still weighs his blows (WB9c's law)
  const w = fight(2), P = w.f.players.s0;
  w.step(Math.ceil(OPENING_MS / BRAIN_TICK_MS) + 2); w.f.shieldUntil = 0; w.f.stunUntil = w.t + 5000; P.bucket = 1e9;
  assert.equal(w.hit('s0', 100), 100 * STUN_HIT_X);
});

test('AUDIT WB14 LAW-3 every share out of a sundered fight (nobody seen ABSENT_RETIRE_MS): the halves\' mending is kept in what he stands at, so the court come back finds his health its pools\'; no blow lands while there is no whole to strike; and he never falls sundered (mutants: the mending lost with nobody here; a blow at no whole - his pools NaN)', () => {
  const run = sundered(), { f } = run;
  drain(run, 's0', HALF.blade, 0.01); drain(run, 's2', HALF.flame, 0.01);
  const pools = () => f.sd.bl.h + f.sd.fl.h + SUNDER_LAST;
  assert.ok(Math.abs(f.hp - pools() * f.max) < 1);
  const saved = { ...run.where };
  for (const s of Object.keys(run.where)) run.where[s] = null;
  run.step(140);   // 35 s: every share out
  assert.equal(f.max, 0);
  const P0 = f.players.s0; P0.bucket = 1e9; P0.rate = 4;
  assert.equal(applyHit(f, 's0', 100, HIT_KINDS.Spell, { x: saved.s0[0], z: saved.s0[1] }, run.t), 0, 'no whole to strike (its share comes back with its next beat)');
  assert.ok(Number.isFinite(f.sd.bl.h) && Number.isFinite(f.sd.fl.h), 'the pools whole numbers');
  run.step(460);   // 150 s with nobody: the halves mend, alone in their courts
  assert.ok(f.sd.bl.h > 0.1 && f.sd.fl.h > 0.1, 'they mended');
  Object.assign(run.where, saved);
  run.step();
  assert.ok(f.max > 0);
  assert.ok(Math.abs(f.hp - pools() * f.max) < 1, 'his health is his pools\'');
  drain(run, 's0', HALF.blade); drain(run, 's2', HALF.flame);
  assert.ok(!f.fell, 'never fallen sundered');
  run.step(2);
  assert.ok(f.sd?.rj, 'both knelt: the Rejoining');
  assert.ok(Math.abs(f.hp - SUNDER_LAST * f.max) < 1);
});

test('AUDIT WB14 LAW-4 the Wrath is the clock\'s: a Blade kneeling in its wind-up keeps it - one word, landing at midnight (mutants: the kneel drops his blow whatever it is)', () => {
  const run = sundered({ wrath: T0 + 120_000 }), { f } = run;
  run.until(f.wrathAt - 400);
  assert.equal(f.atk?.a, ATTACKS.wrath.id, 'winding up');
  drain(run, 's0', HALF.blade);
  assert.ok(f.sd.bl.kn);
  assert.equal(f.atk?.a, ATTACKS.wrath.id, 'the Wrath kept');
  run.until(f.wrathAt + 2000);
  assert.deepEqual(kinds(run.out, 'atk').filter((o) => o.a === ATTACKS.wrath.id).map((o) => o.at), [f.wrathAt], 'one word, at midnight');
  assert.equal(f.wrath?.at, f.wrathAt);
});

test('AUDIT WB14 LAW-2 / RECORD-1 the Tithe-Imp keeps to the court it rose in: he bounds out of it - the Sundering\'s halves to their courts - and it dives into the fire, never running over it after him; it never rises while he is in the air (mutants: it follows his court; it rises mid-bound)', () => {
  const f = newFight(7, T0, WRATH, 'ruhn', null, ['sunder'], 3000), rng = seeded(11);
  for (let i = 0; i < 4; i++) joinFight(f, `s${i}`, `F${i}`, 10, T0, true);
  const at = (C, dx, dz, i) => ({ sub: `s${i}`, id: `p${i}`, x: C[0] + dx, z: C[1] + dz, dead: false });
  const C0 = COURTS[0], C1 = COURTS[1], C2 = COURTS[2];
  const bodies = () => (f.sd && f.court === 1 ? [at(C1, 0, 6, 0), at(C1, 3, 6, 1), at(C2, 0, 6, 2), at(C2, 3, 6, 3)] : [at(C0, 0, 8, 0), at(C0, 3, 8, 1), at(C0, -3, 8, 2), at(C0, 0, -8, 3)]);
  let rose = null, gone = null, left = null, off = 0, turned = false;
  for (let t = T0; t < T0 + 120_000 && !gone; t += BRAIN_TICK_MS) {
    if (!turned && t >= T0 + OPENING_MS + 500) { f.hp = f.max * 0.6; turned = true; }
    const out = stepBrain(f, t, bodies(), rng);
    for (const o of out) {
      if (o.k === 'ad' && o.w === HOST.tithe) { rose = { t, court: f.court }; assert.notEqual(f.atk?.a, ATTACKS.cross.id, 'never mid-bound'); }
      if (o.k === 'adie' && rose && o.is.includes(f.tt.i)) gone = { t, w: o.w, court: f.court };
      if (o.k === 'amv') for (const m of o.m) if (m[0] === f.tt?.i && !inCourt(m[3], m[4], rose.court)) off++;
    }
    const a = f.lg?.ads.find((x) => x.k === HOST.tithe);
    if (a && !inCourt(a.x, a.z, rose.court)) off++;
    if (rose && left == null && f.court !== rose.court) left = t;
  }
  assert.ok(rose, 'it rose');
  assert.equal(rose.court, FLOOR.first);
  assert.ok(gone, 'and went');
  assert.equal(gone.w, HOST_GONE.fled, 'into the fire');
  assert.notEqual(gone.court, rose.court, 'as he left its court');
  assert.ok(left != null && gone.t - left <= BRAIN_TICK_MS, 'the beat he landed in another');
  assert.equal(off, 0, 'never a step off the court it rose in');
});

test('AUDIT WB14 LAW-5 / WIRE-4 a tithe is paid at its catch by the relay\'s dice - the kill or the Wrath a breath after it pays it all the same; caught without the dice, it is paid first thing the next beat, before the Wrath\'s return (mutants: paid only by a beat that steps the fight; paid behind the Wrath)', () => {
  const run = fight(2, null, null, 50_000), { f } = run;
  while (!f.lg?.ads.some((a) => a.k === HOST.tithe) && run.t < T0 + 200_000) { run.step(); f.hp = Math.max(f.hp, f.max * 0.7); }
  const imp = f.lg.ads.find((a) => a.k === HOST.tithe), [ix, iz] = hostAt(imp, run.t);
  run.where.s0 = [ix + 1, iz];
  const P = f.players.s0; P.bucket = 1e9; P.rate = 4;
  const fr = applyHostHit(f, 's0', imp.i, imp.h + 5, HIT_KINDS.Spell, { x: ix + 1, z: iz }, run.t + 10, null, seeded(77));
  assert.deepEqual(fr.map((o) => o.k), ['adie', 'tithe'], 'paid with its fall');
  assert.equal(fr[1].to, 's0');
  assert.ok(f.tt.paid);
  f.hp = 1;
  run.hit('s1', 50);
  assert.ok(f.fell);
  run.step(4);
  assert.equal(kinds(run.out, 'tithe').length, 0, 'once');
  // caught 100 ms before the Wrath's wind-up beat, with no dice: the next beat pays it
  const TI = 60_000, W = T0 + OPENING_MS + TI + 6000 + ATTACKS.wrath.windup;
  const late = fight(3, null, null, TI, { wrath: W, seed: 2 }), L = late.f;
  late.until(W - ATTACKS.wrath.windup);
  const i2 = L.lg?.ads.find((a) => a.k === HOST.tithe);
  assert.ok(i2, 'standing as the wind-up comes');
  i2.h = 1;
  late.out.push(...applyHostHit(L, 's0', i2.i, 50, HIT_KINDS.Spell, { x: i2.x, z: i2.z }, late.t - 100, 1));
  late.until(W + 2000);
  assert.ok(L.wrath);
  assert.equal(kinds(late.out, 'tithe').length, 1, 'paid');
});

test('AUDIT WB14 LAW-6 a half\'s kit is filtered before the run\'s law - a half repeats an attack as he does (twice running), where the other half\'s fresh ones once left it nothing (mutants: the kit filtered after)', () => {
  const blade = SUNDER_KITS[HALF.blade], ctx = { now: 1e9, used: { chains: 1e9 }, n: 3, woke: 0, kit: blade };   // (the Chains cooling)
  assert.deepEqual(attacksFor(2, 9, 0, ATTACKS.charge.id, BASE_PROFILE, 1, ctx).map((a) => a.key), ['charge'], 'the charge again, the Blade\'s only reach at 9 m');
  assert.deepEqual(attacksFor(2, 9, 0, ATTACKS.charge.id, BASE_PROFILE, 2, ctx), [], 'never thrice');
  assert.ok(attacksFor(2, 9, 0, ATTACKS.charge.id, BASE_PROFILE, 1, { ...ctx, kit: null }).every((a) => a.key !== 'charge'), 'whole, the fresh ones first');
  for (const a of attacksFor(2, 2, 3, -1, BASE_PROFILE, 1, { ...ctx, kit: SUNDER_KITS[HALF.flame] })) assert.ok(SUNDER_KITS[HALF.flame].includes(a.key), a.key);
});

test('AUDIT WB14 LAW-7 / RECORD-9 Echoing\'s meteor falls twice on the platforms too - his patience\'s each echoed a breath on; and his patience is said once, with the first meteor that falls, a beat with nobody out on the platforms keeping no word (mutants: his patience never echoed; the word said only at its first moment)', () => {
  const run = fight(3, ['vanguard'], ['burning', 'echoing']), { f } = run;
  run.all(FLOOR.bridgehead);
  run.step(5 * 60 * 4 + 40);
  const met = kinds(run.out, 'atk').filter((o) => o.a === ATTACKS.meteor.id);
  assert.ok(met.length >= 6);
  let echoes = 0;
  const span = ATTACKS.meteor.windup + ATTACKS.meteor.active + ATTACKS.meteor.recover;
  for (let k = 1; k < met.length; k++) if (met[k]._t - met[k - 1]._t < span + 1000) echoes++;
  assert.ok(echoes >= Math.floor(met.length / 2) - 1, `${echoes} of ${met.length} an echo`);
  assert.ok(met.every((m) => VG_STAGES.some((g) => inCourt(m.tg[0][0], m.tg[0][1], g.floor))), 'each on a platform');
  assert.equal(kinds(run.out, 'vgw').filter((w) => w.e === VG_WORD.patience).length, 1, 'his patience said once');
  // nobody out on the platforms at his patience's first moment: said with the first that falls
  const away = fight(3, ['vanguard']);
  away.all(FLOOR.bridgehead);
  away.until(T0 + VG_PATIENCE_MS - 20_000);
  const first = away.f.vg.first;
  assert.ok(first > 0);
  const W = COURTS[FLOOR.bridgehead], walk = [W[0] + 30, W[1] - 30];
  away.until(first + VG_PATIENCE_MS - 1000);
  for (const s of Object.keys(away.where)) away.where[s] = walk;
  away.until(first + VG_PATIENCE_MS + 1000);
  away.all(FLOOR.bridgehead);
  away.until(first + VG_PATIENCE_MS + 40_000);
  assert.equal(kinds(away.out, 'vgw').filter((w) => w.e === VG_WORD.patience).length, 1, 'said, once');
});

test('AUDIT WB14 LAW-8 / FIX-1 the gaolers are sized for the fight as the first challenger stands in the Pen, and their first Pulse is the Ward-Bearer\'s, staggered (mutants: sized at his wake; a gaoler\'s Pulse at its rising)', () => {
  const run = fight(2, ['captive']), { f } = run;
  run.until(T0 + OPENING_MS + 6000);
  assert.ok(f.cp.at > 0 && !f.cp.n, 'laid, none risen');
  for (let i = 2; i < 12; i++) { joinFight(f, `s${i}`, `F${i}`, 10, run.t, true); run.where[`s${i}`] = [3, 3]; }
  const PEN = COURTS[FLOOR.pen];
  run.where.s0 = [PEN[0], PEN[1] + COURT_R - 1];
  run.step();
  const g = f.lg.ads.filter((a) => a.k === HOST.gaoler);
  assert.equal(g.length, 4, 'the twelve\'s');
  for (const [k, a] of g.entries()) assert.equal(a.next - a.up, BEARER_PULSE_FIRST_MS - HOST_RISE_MS[HOST.gaoler] + k * 900, 'staggered, as theirs');
});

test('AUDIT WB14 LAW-9 / LAW-10 / LAW-11 the fight is built on the portents it keeps; the Chains never begun at one past their hold (Colossal\'s body is larger); the Unmaking\'s cooldown counts from its first cast, its echo the same Unmaking (mutants: built on the raw portents; begun past the hold; the echo stamping it again)', () => {
  const bad = newFight(7, T0, WRATH, 'ruhn', null, ['vanguard', 'captive'], null);
  assert.deepEqual([bad.pt, bad.vg, bad.cp, bad.openAt], [null, null, null, T0], 'no pair the table makes: a plain night');
  const P = fightProfile(['burning', 'colossal']);
  assert.ok(P.bossR > 2, 'Colossal');
  const ctx = { now: 1e9, used: {}, n: 3, woke: 0 };
  const chains = (gap) => attacksFor(1, gap, 0, -1, P, 1, ctx).some((a) => a === ATTACKS.chains);
  assert.ok(chains(CHAIN_HOLD_M - P.bossR - 0.5));
  assert.ok(!chains(CHAIN_HOLD_M - P.bossR + 0.01), 'past the hold from his centre');
  assert.ok(attacksFor(1, 14, 0, -1, BASE_PROFILE, 1, ctx).some((a) => a === ATTACKS.chains), 'the plain Warden\'s whole range');
  // the Unmaking and its echo
  const run = fight(3), { f } = run;
  run.step(Math.ceil(OPENING_MS / BRAIN_TICK_MS) + 2);
  f.phase = 3; f.used = {}; f.queue = []; f.pending = null; f.atk = null;
  for (let k = 0; k < 4000 && kinds(run.out, 'atk').filter((o) => o.a === ATTACKS.unmake.id).length < 2; k++) { run.step(); f.hp = Math.max(f.hp, f.max * 0.2); }
  const um = kinds(run.out, 'atk').filter((o) => o.a === ATTACKS.unmake.id);
  assert.equal(um.length, 2, 'cast and echoed');
  assert.equal(f.used.unmake, um[0]._t, 'from the first');
});

// ═══ WIRE ═════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WB14 WIRE-3 / WIRE-5 the Rejoining is said with the state in its beat - each half\'s ward in it - and a half\'s mending begun or ended is said at once (mutants: the ward left to the next state; the mending unsaid)', () => {
  const run = sundered(), { f } = run;
  // a half alone SUNDER_LONE_MS mends - and the state says it that beat
  run.where.s2 = null; run.where.s3 = null;
  let mendAt = null;
  for (let k = 0; k < 80 && mendAt == null; k++) { run.step(); if (f.sd.fl.mend) mendAt = run.t - BRAIN_TICK_MS; }
  assert.ok(mendAt != null, 'mending');
  const st = kinds(run.out, 'st').filter((o) => o._t === mendAt);
  assert.equal(st.length, 1, 'said that beat');
  assert.deepEqual(validGateOut(JSON.parse(JSON.stringify(st[0]))).sd.lo, [0, 1]);
  run.where.s2 = [COURTS[2][0] + 2, COURTS[2][1]]; run.where.s3 = [COURTS[2][0] + 5, COURTS[2][1]];
  run.step();
  assert.ok(!f.sd.fl.mend);
  assert.deepEqual(kinds(run.out, 'st').at(-1).sd.lo, [0, 0], 'and its end');
  // both down: the Rejoining, and the state with it
  drain(run, 's0', HALF.blade); drain(run, 's2', HALF.flame);
  run.step();
  const rj = kinds(run.out, 'rj').at(-1);
  assert.ok(rj);
  const st2 = kinds(run.out, 'st').filter((o) => o._t === rj._t);
  assert.equal(st2.length, 1, 'the state in its beat');
  assert.equal(st2[0].sh, rj.at + CROSS_WARD_MAX_MS, 'his ward');
  assert.equal(st2[0].sd.fl.sh, rj.at + CROSS_WARD_MAX_MS, 'and the Flame\'s');
});

test('AUDIT WB14 WIRE-2 the relay: a Tithe-Imp caught pays at its catch, the fight kept before the tithe is said - a wake before the next checkpoint finds it paid and the Imp gone, and pays nothing twice (mutants: said before it is kept)', async () => {
  let DAY = -1;
  for (let d = 100; d < 2000 && DAY < 0; d++) if (gateTitheOf(d) != null && !gatePortentsOf(d)) DAY = d;
  assert.ok(DAY > 0, 'a plain night with a Tithe-Imp');
  const TT = gateTimes(DAY), KEY = gateRoomKey(DAY);
  const realNow = Date.now; let clock = TT.openAt + 1000; Date.now = () => clock;
  const quiet = console.warn; console.warn = () => {};
  try {
    const world = fakeRooms({ now: () => clock }), r = world.room(KEY);
    const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += BRAIN_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'gate', ...o }));
    const at = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 3));
    const b = r.connect(); await r.hello(b, 'peer-0002', at(3, 3));
    for (const ws of [a, b]) await say(ws, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
    let f = r.room._fight, imp = null;
    for (let k = 0; k < 1600 && !imp; k++) { await tick(1); if (f.hp < f.max * 0.7) f.hp = f.max * 0.8; imp = f.lg?.ads.find((o) => o.k === HOST.tithe) ?? null; }
    assert.ok(imp, 'risen');
    let q = 100;
    for (let j = 0; j < 40 && f.lg.ads.includes(imp); j++) { await say(a, { k: 'ahit', i: imp.i, q: q++, d: 1e4, r: HIT_KINDS.Spell }); if (f.lg.ads.includes(imp)) await tick(1); }   // a spell, from where it stands
    assert.ok(!f.lg.ads.includes(imp), 'caught');
    const heard = ws => ws.sent.filter((m) => m.t === 'gate' && m.k === 'tithe');
    assert.equal(heard(a).length, 1, 'paid at the catch');
    assert.ok(r.store.get('gatefight').tt.paid, 'kept before it was said');
    r.wake();
    await tick(2);
    f = r.room._fight;
    assert.ok(!f.lg?.ads.some((o) => o.k === HOST.tithe), 'gone after the wake');
    await tick(8);
    assert.equal(heard(a).length, 1, 'never twice');
    assert.equal(heard(b).length, 0, 'to the one who struck it alone');
  } finally { Date.now = realNow; console.warn = quiet; }
});

// ═══ RECORD: laws a lane found unpinned ════════════════════════════════════════════════════════════════════════════

test('AUDIT WB14 RECORD-2 the pair law\'s window is SUNDER_PAIR_MS to the beat: a half kneeling rises no sooner, and once (mutants: the window halved)', () => {
  const run = sundered(), { f } = run;
  drain(run, 's0', HALF.blade);
  const kn = f.sd.bl.kn;
  run.out.length = 0;
  run.until(kn + SUNDER_PAIR_MS - 500);
  assert.equal(kinds(run.out, 'kr').length, 0, 'not yet');
  assert.equal(f.sd.bl.kn, kn);
  run.until(kn + SUNDER_PAIR_MS + 600);
  assert.equal(kinds(run.out, 'kr').length, 1, 'risen, once');
});

test('AUDIT WB14 RECORD-3 the Vanguard never stands past VG_STANDING_MAX - sixteen on the Bridgehead, every state read whole by the wire (mutants: the standing cap ignored)', () => {
  const run = fight(16, ['vanguard']), { f } = run;
  run.all(FLOOR.bridgehead);
  let most = 0, refused = 0, states = 0;
  for (let k = 0; k < 360; k++) {
    const n0 = run.out.length;
    run.step();
    most = Math.max(most, f.lg?.ads.length ?? 0);
    for (const o of run.out.slice(n0)) if (o.k === 'st') { states++; if (!validGateOut(JSON.parse(JSON.stringify({ t: 'gate', ...o })))?.st && !validGateOut(JSON.parse(JSON.stringify({ t: 'gate', ...o })))) refused++; }
  }
  assert.ok(most <= VG_STANDING_MAX && most >= 10, `${most} standing at most`);
  assert.ok(states > 5);
  assert.equal(refused, 0);
});

test('AUDIT WB14 RECORD-4 the Sundering and the Rejoining strike 45% + 12 and 50% + 14 of a fighter (the page said 30% + 8 and 45% + 12 - written as built) (mutants: either at the page\'s old numbers)', () => {
  assert.deepEqual([ATTACKS.sunder.pct, ATTACKS.sunder.base, ATTACKS.rejoin.pct, ATTACKS.rejoin.base], [0.45, 12, 0.5, 14]);
});

test('AUDIT WB14 RECORD-7 the laws a page states and nothing pinned: the split counts the living; the Tithe-Imp\'s moment from his wake after a Vanguard; none while the halves go to rejoin; the Brand and the Torment by those in his court; a wave sized by its platform; his patience on the platforms (mutants: each)', () => {
  // (a) the dead are not the split's: three living and a dead one fight together
  {
    const run = fight(4, ['sunder']), { f } = run;
    run.dead.s3 = true;
    while (f.hp / f.max > PHASE_AT[0] + 0.005) { f.hp -= f.max * 0.01; run.step(); }
    for (let k = 0; k < 80 && !f.sd; k++) { f.hp = Math.min(f.hp, f.max * 0.659); run.step(); }
    assert.equal(f.sd?.two, false, `${SUNDER_SPLIT_MIN} living to split`);
  }
  // (b) after a Vanguard the Imp's moment counts from his wake, not the fight's birth
  {
    const run = fight(2, ['vanguard'], null, 0), { f } = run;
    run.all(FLOOR.bridgehead);
    run.step(40);
    f.vg.s = VG_STAGES.length; f.lg.ads = [];
    run.all(FLOOR.first);
    run.step();
    const open = f.openAt;
    assert.ok(open > T0 + 9000);
    run.until(open + OPENING_MS - 500);
    assert.ok(!f.lg.ads.some((a) => a.k === HOST.tithe), 'not before his wake');
    run.until(open + OPENING_MS + 1500);
    assert.ok(f.tt?.at >= open + OPENING_MS, 'from it');
  }
  // (c) none while the halves go to rejoin
  {
    const run = sundered(), { f } = run;
    drain(run, 's0', HALF.blade); drain(run, 's2', HALF.flame);
    run.step();
    assert.ok(f.sd.rj);
    f.ti = 0;   // its moment long past - and the Blade's two still in his court, before his bound
    run.step(4);
    assert.ok(!f.tt?.at, 'not while they go to rejoin');
  }
  // (d) the Brand and the Torment need two in his court - one there and others elsewhere is one
  {
    const run = fight(3), { f } = run;
    run.step(Math.ceil(OPENING_MS / BRAIN_TICK_MS) + 2);
    run.put('s1', FLOOR.second); run.put('s2', FLOOR.second, 4);
    f.phase = 2; f.used = {}; f.startedAt = T0 - 600_000; f.openAt = T0 - 600_000;
    for (let k = 0; k < 2400; k++) { run.step(); f.hp = Math.max(f.hp, f.max * 0.5); f.phase = 2; }
    assert.ok(!kinds(run.out, 'atk').some((o) => o.a === ATTACKS.brand.id || o.a === ATTACKS.torment.id), 'never at one alone');
  }
  // (e) a wave is its platform's: two on the Bridgehead, ten elsewhere, a wave of two's
  {
    const run = fight(12, ['vanguard']), { f } = run;
    run.all(FLOOR.first);
    run.put('s0', FLOOR.bridgehead); run.put('s1', FLOOR.bridgehead, 4);
    run.step(40);
    const ad = kinds(run.out, 'ad');
    assert.ok(ad.length >= 1);
    assert.ok(f.lg.ads.length <= 4, `${f.lg.ads.length}: sized for the two`);
  }
  // (f) his patience falls on the platforms alone
  {
    const run = fight(3, ['vanguard']);
    run.all(FLOOR.bridgehead);
    run.until(T0 + 30_000);
    run.put('s2', FLOOR.first);
    run.until(T0 + VG_PATIENCE_MS + 120_000);
    const met = kinds(run.out, 'atk').filter((o) => o.a === ATTACKS.meteor.id);
    assert.ok(met.length > 3);
    assert.ok(met.every((m) => !inCourt(m.tg[0][0], m.tg[0][1], FLOOR.first)), 'never at his court');
  }
});

test('AUDIT WB14 RECORD-8 after a long Vanguard the new arsenal waits its cooldowns from his wake, never from the fight\'s birth (mutants: the cooldowns from the birth)', () => {
  const run = fight(3, ['vanguard']), { f } = run;
  run.all(FLOOR.bridgehead);
  run.step(8);
  f.vg.s = VG_STAGES.length; f.lg.ads = [];
  run.t = T0 + 180_000; f.lastTickAt = run.t;
  run.all(FLOOR.first);
  run.step();
  const wake = f.openAt + OPENING_MS;
  run.until(wake + ATTACKS.chains.cd - 1000);
  const marked = kinds(run.out, 'atk').filter((o) => ATTACK_BY_ID[o.a]?.cd);
  assert.deepEqual(marked.map((o) => ATTACK_BY_ID[o.a].key), [], 'none of the six before its cooldown from his wake');
});

test('AUDIT WB14 WIRE-6 the account: a portent night\'s receipt fills the wealth budget a piece\'s room more for each portent it pays (one a bit, three at most) - the claim carries its portents to the fill and never in its answer (mutants: the fill a plain receipt\'s; the pieces miscounted; the portents said to the player)', async () => {
  const { portentPieces, grantSpoils, SPOILS_GRANT_PIECE, SPOILS_GRANT_BASE, SPOILS_GRANT_PER_LEVEL } = await import('../../../server-account/src/budget.js');
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, -1, 1.5, '3', null].map(portentPieces), [0, 1, 1, 2, 1, 2, 2, 3, 0, 0, 0, 0, 0]);
  const binds = [];
  const db = { prepare: (sql) => ({ bind: (...a) => ({ run: async () => binds.push([sql, a]) }) }) };
  await grantSpoils(db, 'p1'); await grantSpoils(db, 'p1', 2); await grantSpoils(db, 'p1', 9);
  assert.deepEqual(binds.map(([, a]) => a), [['p1', SPOILS_GRANT_BASE, SPOILS_GRANT_PER_LEVEL, 0], ['p1', SPOILS_GRANT_BASE, SPOILS_GRANT_PER_LEVEL, 2 * SPOILS_GRANT_PIECE], ['p1', SPOILS_GRANT_BASE, SPOILS_GRANT_PER_LEVEL, 3 * SPOILS_GRANT_PIECE]]);
  assert.match(binds[0][0], /allowance = allowance \+ \?2 \+ \?3 \* MAX\(1, COALESCE\(level_seen, 1\)\) \+ \?4/);
  const { readFileSync } = await import('node:fs');
  const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
  assert.match(read('server-account/src/accounts.js'), /if \(recorded\) return \{ recorded, day: c\.d, stones: embers, \.\.\.\(c\.p > 0 \? \{ portent: c\.p \} : \{\}\),/);
  const svc = read('server-account/src/index.js');
  assert.match(svc, /if \(r\.recorded === true\) await grantSpoils\(ctx\.db, who\.player\.id, portentPieces\(r\.portent\)\);/);
  assert.match(svc, /delete answer\.weirRow; delete answer\.portent;/);
});

// ═══ PLAY: the balance by simulation ══════════════════════════════════════════════════════════════════════════════

test('AUDIT WB14 PLAY-1 a half knelt past the pair law rises level with the other - SUNDER_RISE of its pool at most, SUNDER_RISE_MIN at least - so two sides out of step even out instead of kneeling and rising for ever (mutants: risen at SUNDER_RISE whatever the other holds)', () => {
  for (const [left, want] of [[0.1, 0.1], [0.01, SUNDER_RISE_MIN], [0.45, SUNDER_RISE]]) {
    const run = sundered(), { f } = run, m = f.sd.m;
    drain(run, 's2', HALF.flame, left * m);
    drain(run, 's0', HALF.blade);
    const kn = f.sd.bl.kn;
    run.until(kn + SUNDER_PAIR_MS + 600);
    assert.equal(kinds(run.out, 'kr').length, 1, 'risen');
    assert.ok(Math.abs(f.sd.bl.h - Math.min(SUNDER_RISE * m, Math.max(f.sd.fl.h, SUNDER_RISE_MIN * m))) < 1e-6, `the other at ${left}: ${(f.sd.bl.h / m).toFixed(3)} of a pool`);
    assert.ok(Math.abs(f.sd.bl.h / m - want) < 0.02);
    assert.ok(Math.abs(f.hp - (f.sd.bl.h + f.sd.fl.h + SUNDER_LAST) * f.max) < 1, 'his health its pools\'');
  }
});

test('AUDIT WB14 PLAY-4 on a Vanguard night his health is less its Vanguard\'s - each share VG_SHARE_X of a plain night\'s, the waves\' 61 team seconds off his 240 (mutants: his health a plain night\'s)', () => {
  assert.equal(VG_TEAM_S, 61);
  assert.equal(VG_SHARE_X, (240 - 61) / 240);
  const plain = newFight(7, T0, WRATH, 'ruhn'), vg = newFight(7, T0, WRATH, 'ruhn', null, ['vanguard']), dire = newFight(7, T0, WRATH, 'ruhn', null, ['vanguard', 'sunder']);
  for (const f of [plain, vg, dire]) joinFight(f, 's0', 'F0', 30, T0, true);
  assert.ok(Math.abs(vg.max - plain.max * VG_SHARE_X) < 1e-6);
  assert.ok(Math.abs(dire.max - plain.max * VG_SHARE_X) < 1e-6, 'the Dire Breach\'s too');
  assert.equal(newFight(7, T0, WRATH, 'ruhn', null, ['sunder']).vg, null);
});

test('AUDIT WB14 PLAY-7 a portent\'s pieces go through every pass the others had - socketed about as often - and nothing drawn before them moves (mutants: the passes skipped)', async () => {
  const { rollSpoils } = await import('../../../src/systems/gate/gateSpoils.js');
  let socketed = 0, n = 0;
  for (let s = 1; s <= 300; s++) {
    const seed = (s * 2654435761) >>> 0, plain = rollSpoils(seed, 30, 0), rich = rollSpoils(seed, 30, 1);
    assert.deepEqual(rich.pieces.slice(0, plain.pieces.length).map((q) => [q.item.name, q.tier, (q.item.sockets ?? []).length]), plain.pieces.map((q) => [q.item.name, q.tier, (q.item.sockets ?? []).length]));
    const q = rich.pieces.at(-1);
    n++; if ((q.item.sockets ?? []).length) socketed++;
  }
  assert.ok(socketed / n > 0.06, `${socketed} of ${n} socketed`);
});

test('AUDIT WB14 RECORD-6 two claims a test\'s title made and nothing held: while the Vanguard holds he waits - a body that stands in his court before the way to him is laid draws no blow of his; and the ward spent is said once, never a state a beat after (mutants: the Vanguard never holding him; the ward spent again each beat)', () => {
  const run = fight(3, ['vanguard']), { f } = run;
  run.all(FLOOR.bridgehead);
  run.step(40);
  run.put('s0', FLOOR.first, 3, 0);   // a pose in his court, no walkway to it
  run.out.length = 0;
  run.step(120);
  assert.ok(!f.vg.opened);
  assert.equal(kinds(run.out, 'atk').filter((o) => o.a !== ATTACKS.meteor.id).length, 0, 'no blow of his');
  assert.equal(kinds(run.out, 'mv').length, 0, 'nor a step');
  // the ward spent: one state for it
  const c = fight(3, ['captive']);
  c.until(T0 + OPENING_MS + 6000);
  const PEN = COURTS[FLOOR.pen];
  c.where.s2 = [PEN[0], PEN[1] + COURT_R - 1];
  c.step();
  for (const a of c.f.lg.ads.filter((o) => o.k === HOST.gaoler)) { const P = c.f.players.s2; P.bucket = 1e9; P.rate = 4; c.out.push(...applyHostHit(c.f, 's2', a.i, a.h + 1, HIT_KINDS.Spell, { x: PEN[0], z: PEN[1] + COURT_R - 1 }, c.t, null, c.rng)); c.t += 300; }
  c.step();
  assert.ok(c.f.cp.f > 0, 'free');
  const C = COURTS[FLOOR.third];
  Object.assign(c.f, { phase: 3, court: FLOOR.third, pos: [C[0], C[1]], queue: [], pending: null, atk: null, move: null, shieldUntil: 0, rk: c.t, nextAt: c.t });
  c.f.xa = [T0, T0, ...c.f.xa.slice(2)];
  for (const k of Object.keys(c.where)) c.where[k] = [C[0] + 4, C[1] + Number(k.slice(1)) * 2];
  for (let i = 0; i < 400 && c.f.atk?.a !== ATTACKS.reckon.id; i++) c.step();
  const A = c.f.atk;
  assert.equal(c.f.cp.w, A.i);
  c.until(A.at + BRAIN_TICK_MS);
  assert.equal(c.f.cp.s, A.at);
  const n0 = c.out.length;
  c.step(8);
  assert.ok(kinds(c.out.slice(n0), 'st').length <= 1, 'said once');
});
