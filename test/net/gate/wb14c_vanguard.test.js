// WB14c (2026-10-19, Mac: "adding the chance of a gate to spawn with platforms of wave based adds that need to be defeated
// before encountering the boss", then "This is all yours to take on"): THE VANGUARD - on a Vanguard night the fighters
// arrive on the Bridgehead; its three waves, then the Muster's three (the last the Markynaz's), each platform cleared
// laying the walkway onward; the Markynaz down, the way to the Warden opens, and his opening begins as the first
// challenger stands before him.
//
//   the law          net/gate/gateBrain.js HOST_KINDS 3-5, HOST_BLOWS' Smash, Bolt and Rend, VG_STAGES, vanguardCountFor,
//                    stepVanguard (the waves, the clearings, the Markynaz and his Imps, his patience, his opening)
//   the relay        a blow on one of the Vanguard from the platform its body stands on; the judge's Smash and Rend
//   the wire         the state's `vg`, the `vgw` word (its walkway laid at its own moment on every screen), six host kinds
//   the screen       scenes/gate/gateVanguard.js (its words), the bar's line, the host's looks and its silence on its waves
//
// Design: bible/11-Multiplayer/Breach-Portents.md section 4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COURTS, FLOOR, WALKWAY, HOST, HOST_KINDS, HOST_BLOWS, HOST_RISE_MS, HOST_STANDING_MAX, HOST_GONE, OPENING_MS, BRAIN_TICK_MS, HIT_KINDS,
  VG_OPEN_MS, VG_WAVE_MAX_MS, VG_WAVE_LEFT, VG_STANDING_MAX, VG_STAGES, VG_KIND_W, VG_PATIENCE_MS, VG_PATIENCE_EVERY_MS, VG_CALL_MS, VG_CALL_N,
  VG_CASTER_KEEP, VG_CASTER_REACH, VG_WORD, vanguardCountFor, newVanguard, openedAt, vanguardHolds, newFight, joinFight, stepBrain, stateOf,
  applyHostHit, dpsRef, hostBlowUnder, BASE_PROFILE, ATTACKS, nightPlan, liveFloors,
} from '../../../src/net/gate/gateBrain.js';
import { judgeGate } from '../../../src/net/bossRef.js';
import { validGateOut, GATE_HOST_KINDS, GATE_HOST_MAX, GATE_HZ_MAX, GATE_VG_WORDS } from '../../../src/net/wire.js';
import { foldGate, GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import { vanguardLine, vanguardOut, VANGUARD_TEXT } from '../../../src/scenes/gate/gateVanguard.js';
import { waveLine, COURT_HOST_TEXT, hostShapes } from '../../../src/scenes/gate/gateHost.js';
import { bossBarModel } from '../../../src/ui/gate/gateBossBar.js';
import { hostLookOf, hostPulseColor, HOST_BITE_COLOR } from '../../../src/world/gate/gateBoss.js';
import { gatePortentsOf, gateModsOf } from '../../../src/net/gate/gateLaw.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000, WRATH = T0 + 3_600_000, RUN = 7.6;
const seeded = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const BH = COURTS[FLOOR.bridgehead], MU = COURTS[FLOOR.muster], C0 = COURTS[FLOOR.first];
const body = (sub, at, dx = 0, dz = 0) => ({ sub, id: `peer-${sub}`, x: at[0] + dx, z: at[1] + dz, dead: false });
/** A Vanguard night's fight, `n` fighters at level 10 seated. */
function vanguardFight(n = 2) {
  const f = newFight(7, T0, WRATH, 'ruhn', null, ['vanguard']);
  for (let i = 0; i < n; i++) joinFight(f, `s${i}`, `F${i}`, 10, T0, true);
  return f;
}
/** Beats from `t0` to `t1`, every BRAIN_TICK_MS; answers every frame said and the last moment. */
function beats(f, t0, t1, bodies, rng = seeded(5)) {
  const out = [];
  let t = t0;
  for (; t <= t1; t += BRAIN_TICK_MS) out.push(...stepBrain(f, t, typeof bodies === 'function' ? bodies(t) : bodies, rng));
  return { out, t };
}
const words = (out, e) => out.filter((o) => o.k === 'vgw' && (e === undefined || o.e === e));

// ═══ THE TABLES ══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14c the kinds and their blows: the Brute (a Daedroth), the Caster (a Daedra of his aspect) and the Markynaz (a Daedra Lord) beside the Imp, none outrunning a runner, each blow a disc a runner leaves in under half its wind-up; the Bolt his element\'s (mutants: a kind faster than a run; a blow past escape)', () => {
  assert.deepEqual(HOST_KINDS.slice(3, 6).map((k) => [k.id, k.key]), [[3, 'brute'], [4, 'caster'], [5, 'markynaz']]);   // PIN MOVED (WB14e): the Vanguard's three, the Tithe-Imp after them
  for (const K of HOST_KINDS) assert.ok(K.speed < RUN, K.key);
  assert.deepEqual(HOST_BLOWS.slice(3, 6).map((b) => [b.kind, b.key, b.r]), [[3, 'smash', 3], [4, 'bolt', 3], [5, 'rend', 4.5]]);   // PIN MOVED (WB14e): the Tithe-Imp's none after them
  for (const B of HOST_BLOWS.slice(3, 6)) assert.ok((B.r / RUN) * 1000 < B.windup / 2, B.key);
  assert.deepEqual(HOST_BLOWS.slice(3, 6).map((b) => b.name), ['Smash', 'Bolt', 'Rend']);
  assert.equal(hostBlowUnder(HOST.caster, BASE_PROFILE).el, 'fire');
  assert.equal(hostBlowUnder(HOST.brute, BASE_PROFILE).el, null);
  assert.deepEqual(HOST_RISE_MS.slice(3, 6), [1500, 1500, 2500]);   // PIN MOVED (WB14e): the Tithe-Imp's after them
  assert.equal(GATE_HOST_KINDS, HOST_KINDS.length);
  assert.ok(VG_STANDING_MAX <= GATE_HOST_MAX && HOST_STANDING_MAX === VG_STANDING_MAX);
  assert.ok(GATE_HZ_MAX >= 2 * (VG_STANDING_MAX + 1), 'two swings a second through the whole Vanguard and him pass the frame bucket');
  // the looks: Daggerfall's own bodies
  const look = (k, a) => hostLookOf(k, a).mobile;
  assert.deepEqual(['burning', 'rime', 'storm', 'venom'].map((a) => look(HOST.brute, a)), [27, 27, 27, 27]);
  assert.deepEqual(['burning', 'rime', 'storm', 'venom'].map((a) => look(HOST.caster, a)), [26, 25, 29, 32]);
  assert.deepEqual([hostLookOf(HOST.markynaz, 'burning').mobile, hostLookOf(HOST.markynaz, 'burning').name, hostLookOf(HOST.caster, 'venom').plural], [31, 'Markynaz', 'Liches']);
});

test('WB14c the stages: the Bridgehead then the Muster, each three waves and the walkway its clearing lays (3, then 4), sixty-one team seconds in all, the Muster\'s last the Markynaz\'s; a wave vanguardCountFor(the fighters on its platform), 3 to 10 (mutants: a stage\'s walkway swapped; a wave\'s count off)', () => {
  assert.deepEqual(VG_STAGES.map((S) => [S.floor, S.walk]), [[FLOOR.bridgehead, WALKWAY.muster], [FLOOR.muster, WALKWAY.warden]]);
  assert.deepEqual(VG_STAGES.map((S) => S.waves.map((W) => W.s)), [[7, 9, 10], [10, 11, 14]]);
  assert.equal(VG_STAGES.flatMap((S) => S.waves).reduce((s, W) => s + W.s, 0), 61);
  assert.deepEqual(VG_STAGES.flatMap((S) => S.waves.map((W) => W.lord)), [false, false, false, false, false, true]);
  assert.deepEqual(VG_STAGES[0].waves.map((W) => W.kinds), [[HOST.harrier], [HOST.harrier, HOST.brute], [HOST.brute, HOST.caster]]);
  assert.deepEqual([0, 1, 2, 3, 4, 6, 10, 16, 20, 40].map(vanguardCountFor), [3, 3, 3, 4, 4, 5, 7, 10, 10, 10]);
  assert.deepEqual(VG_KIND_W, [1, 0, 0, 2.5, 1.5, 6]);
  assert.deepEqual([VG_OPEN_MS, VG_WAVE_MAX_MS, VG_WAVE_LEFT, VG_PATIENCE_MS, VG_PATIENCE_EVERY_MS, VG_CALL_MS, VG_CALL_N], [6000, 30_000, 0.25, 240_000, 15_000, 15_000, 2]);
  assert.deepEqual(newVanguard(), { s: 0, w: 0, due: 0, rose: 0, last: 0, first: 0, pat: 0, said: false, lord: 0, call: 0, opened: false });   // AUDIT WB14 (RECORD-9): and its patience's word, said once
});

// ═══ THE FIGHT ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14c a Vanguard night\'s fight: its record from its birth and no opening said while it holds; a plain night\'s none, and its opening its birth\'s, as ever (mutants: the Vanguard on every night; his wake said while it holds)', () => {
  const f = vanguardFight();
  assert.ok(vanguardHolds(f));
  assert.equal(openedAt(f), null);
  const st = stateOf(f);
  assert.equal(st.op, undefined, 'no wake to say');
  assert.deepEqual(st.vg, [0, 0]);
  assert.deepEqual(validGateOut(JSON.parse(JSON.stringify(st))).vg, [0, 0], 'through the wire');
  const plain = newFight(7, T0, WRATH, 'ruhn');
  assert.equal(plain.vg, null);
  assert.equal(stateOf(plain).op, T0 + OPENING_MS);
  assert.equal(stateOf(plain).vg, undefined);
  assert.equal(newFight(7, T0, WRATH, 'ruhn', null, ['vanguard', 'sunder']).vg?.s, 0, 'the Dire Breach holds one too');
  const old = JSON.parse(JSON.stringify(plain)); delete old.openAt; delete old.vg;
  assert.equal(openedAt(old), T0, 'a fight checkpointed before WB14c: its birth');
});

test('WB14c the first wave rises VG_OPEN_MS after a fighter stands on the Bridgehead - nobody there, nothing rises; vanguardCountFor of them on its rim, each its share of the wave\'s team seconds, and he waits in his court through it all (mutants: the wave without its fighters; the health unshared; he fights the Vanguard\'s fighters)', () => {
  const f = vanguardFight(2);
  const away = [body('s0', C0, 30, 30), body('s1', C0, 31, 30)];   // standing nowhere the Vanguard holds
  let r = beats(f, T0, T0 + 20_000, away);
  assert.equal(r.out.filter((o) => o.k === 'ad').length, 0, 'nobody on its platform: it waits');
  const on = [body('s0', BH, 0, 4), body('s1', BH, 3, -2)];
  r = beats(f, T0 + 20_250, T0 + 20_250 + VG_OPEN_MS - 300, on);
  assert.equal(r.out.filter((o) => o.k === 'ad').length, 0, 'not yet');
  r = beats(f, r.t, r.t + 600, on);
  const ad = r.out.filter((o) => o.k === 'ad');
  assert.equal(ad.length, 1);
  assert.equal(ad[0].w, HOST.harrier);
  assert.equal(ad[0].a.length, vanguardCountFor(2));
  for (const [, x, z] of ad[0].a) assert.ok(Math.hypot(x - BH[0], z - BH[1]) > 15, 'on its rim');
  const total = 7 * 2 * dpsRef(10);
  assert.equal(ad[0].m, Math.round(total / vanguardCountFor(2)));
  assert.deepEqual(words(r.out).map((o) => [o.e, o.s, o.w]), [[VG_WORD.wave, 0, 1]]);
  assert.equal(r.out.filter((o) => o.k === 'atk').length, 0, 'he waits in his court');
  assert.deepEqual(stateOf(f).vg, [0, 1]);
  assert.ok(vanguardHolds(f));
});

test('WB14c each next wave when VG_WAVE_LEFT of the last or fewer stand - or VG_WAVE_MAX_MS after it rose; the kinds dealt round its count; the third down, the Bridgehead is clear and walkway 3 rises, said with its moment (mutants: the next wave at once; the walkway never laid; the clearing unsaid)', () => {
  const f = vanguardFight(2);
  const on = [body('s0', BH, 0, 4), body('s1', BH, 3, -2)];
  let r = beats(f, T0, T0 + VG_OPEN_MS + 500, on);
  assert.equal(f.vg.w, 1);
  r = beats(f, r.t, r.t + 5000, on);
  assert.equal(f.vg.w, 1, 'its first still standing');
  // the clock: VG_WAVE_MAX_MS after it rose the next is due - and waits for somebody on its platform
  r = beats(f, r.t, f.vg.rose + VG_WAVE_MAX_MS + 1000, [body('s0', C0, 30, 30), body('s1', C0, 31, 30)]);
  assert.equal(f.vg.w, 1, 'due, and nobody on its platform: it waits for somebody');
  r = beats(f, r.t, r.t + 250, on);
  assert.equal(f.vg.w, 2, 'somebody: it rises');
  const w2 = r.out.filter((o) => o.k === 'ad');
  assert.deepEqual(w2.map((o) => o.w).sort(), [HOST.harrier, HOST.brute].sort(), 'Imps and Brutes, dealt round');
  const brute = f.lg.ads.find((a) => a.k === HOST.brute), imp = f.lg.ads.filter((a) => a.k === HOST.harrier).at(-1);
  assert.ok(brute.m > imp.m * 2, 'a Brute its larger share');
  // the share: one more than VG_WAVE_LEFT of the last standing holds the next; its share or fewer calls it
  const last = f.vg.last, wave2 = f.lg.ads.filter((a) => a.up >= f.vg.rose);
  f.lg.ads = wave2.slice(0, Math.floor(last * VG_WAVE_LEFT) + 1);
  r = beats(f, r.t, r.t + 2000, on);
  assert.equal(f.vg.w, 2, 'more than its share stand');
  f.lg.ads = f.lg.ads.slice(0, Math.floor(last * VG_WAVE_LEFT));
  r = beats(f, r.t, r.t + 500, on);
  assert.equal(f.vg.w, 3, 'its share or fewer: the next');
  assert.deepEqual(r.out.filter((o) => o.k === 'ad').map((o) => o.w).sort(), [HOST.brute, HOST.caster].sort(), 'Brutes and Casters');
  // all down: the Bridgehead clear
  f.lg.ads = [];
  r = beats(f, r.t, r.t + 300, on);
  const clear = words(r.out, VG_WORD.clear);
  assert.equal(clear.length, 1);
  assert.equal(clear[0].x, WALKWAY.muster);
  assert.ok(Number.isFinite(f.xa[WALKWAY.muster]) && clear[0].at === f.xa[WALKWAY.muster]);
  assert.deepEqual([f.vg.s, f.vg.w], [1, 0]);
  const plan = nightPlan(['vanguard']);
  assert.ok([...liveFloors(plan, f.xa, clear[0].at + 60_000)].includes(FLOOR.muster), 'the Muster floor once its walkway is laid');
  assert.ok(r.out.some((o) => o.k === 'st'), 'the state said at once');
});

test('WB14c the Muster: its waves wait for a fighter on it; its last the Markynaz\'s - who calls VG_CALL_N Imps every VG_CALL_MS - and his fall crumbles his Imps, lays walkway 4 and breaks the Vanguard (mutants: the Imps outliving him; the Vanguard broken with him standing)', () => {
  const f = vanguardFight(2);
  f.vg.s = 1; f.xa = [null, null, null, T0 - 60_000];
  const atBH = [body('s0', BH), body('s1', BH, 2)], atMU = [body('s0', MU, 0, 3), body('s1', MU, 3, 0)];
  let r = beats(f, T0, T0 + 20_000, atBH);
  assert.equal(r.out.filter((o) => o.k === 'ad').length, 0, 'nobody on the Muster yet');
  r = beats(f, r.t, r.t + VG_OPEN_MS + 500, atMU);
  assert.equal(f.vg.w, 1);
  f.lg.ads = []; r = beats(f, r.t, r.t + 300, atMU);
  f.lg.ads = []; r = beats(f, r.t, r.t + 300, atMU);
  assert.equal(f.vg.w, 3);
  const lord = f.lg.ads.find((a) => a.k === HOST.markynaz);
  assert.ok(lord && f.vg.lord === lord.i, 'the Markynaz risen');
  assert.equal(f.lg.ads.filter((a) => a.k === HOST.markynaz).length, 1);
  assert.equal(words(r.out, VG_WORD.lord).length, 1);
  assert.ok(lord.m > Math.max(...f.lg.ads.filter((a) => a.k === HOST.harrier).map((a) => a.m)) * 5, 'the lion\'s share');
  // his call: two Imps more
  f.lg.ads = f.lg.ads.filter((a) => a.k === HOST.markynaz);
  r = beats(f, r.t, f.vg.call + 300, atMU);
  assert.equal(f.lg.ads.filter((a) => a.k === HOST.harrier).length, VG_CALL_N);
  // his fall: his Imps crumble, the way opens
  f.lg.ads = f.lg.ads.filter((a) => a.k !== HOST.markynaz);
  r = beats(f, r.t, r.t + 600, atMU);
  const gone = r.out.find((o) => o.k === 'adie');
  assert.equal(gone.w, HOST_GONE.crumbled);
  assert.equal(f.lg.ads.length, 0);
  const broken = words(r.out, VG_WORD.broken);
  assert.equal(broken.length, 1);
  assert.equal(broken[0].x, WALKWAY.warden);
  assert.ok(Number.isFinite(f.xa[WALKWAY.warden]));
  assert.deepEqual(stateOf(f).vg, [2, 0]);
  assert.ok(vanguardHolds(f), 'broken - and he waits still for one to stand before him');
});

test('WB14c his opening: the Vanguard broken, it begins as the first challenger stands in his court - its word, his wake OPENING_MS on, and his blows only after it; the new arsenal\'s cooldowns from it (mutants: the opening at the break; his blows before his wake)', () => {
  const f = vanguardFight(2);
  f.vg.s = 2; f.xa = [null, null, null, T0 - 60_000, T0 - 50_000];
  let r = beats(f, T0, T0 + 10_000, [body('s0', MU), body('s1', MU, 2)]);
  assert.ok(vanguardHolds(f) && !words(r.out, VG_WORD.open).length, 'on the walkway still');
  const before = [body('s0', C0, 0, 6), body('s1', C0, 2, 6)];
  r = beats(f, r.t, r.t + 250, before);
  const opened = words(r.out, VG_WORD.open);
  assert.equal(opened.length, 1);
  const at = opened[0].at;
  assert.ok(!vanguardHolds(f));
  assert.equal(openedAt(f), at);
  assert.equal(stateOf(f).op, at + OPENING_MS);
  r = beats(f, r.t, at + OPENING_MS - 300, before);
  assert.equal(r.out.filter((o) => o.k === 'atk').length, 0, 'his opening');
  r = beats(f, r.t, at + OPENING_MS + 6000, before);
  assert.ok(r.out.some((o) => o.k === 'atk'), 'his blows after his wake');
  assert.ok(read('src/net/gate/gateBrain.js').includes('woke: Number.isFinite(openedAt(f)) ? openedAt(f) + OPENING_MS : -Infinity'));
});

test('WB14c his patience: a Vanguard standing VG_PATIENCE_MS after its first wave, a Meteor of his falls on a fighter out on the platforms every VG_PATIENCE_EVERY_MS - laid on their platform, never his court - its word said once (mutants: the meteor clamped to his court; said every time)', () => {
  const f = vanguardFight(2);
  const on = [body('s0', BH, 0, 4), body('s1', BH, 3, -2)];
  let r = beats(f, T0, T0 + VG_OPEN_MS + 500, on);
  const first = f.vg.first;
  // the Vanguard never broken: waves come by the clock, and the meteors after his patience runs out
  r = beats(f, r.t, first + VG_PATIENCE_MS + 2 * VG_PATIENCE_EVERY_MS + 500, on);
  const meteors = r.out.filter((o) => o.k === 'atk' && o.a === ATTACKS.meteor.id);
  assert.ok(meteors.length >= 2, `${meteors.length} meteors`);
  assert.ok(meteors[0].at - ATTACKS.meteor.windup >= first + VG_PATIENCE_MS - BRAIN_TICK_MS);
  for (const m of meteors) assert.ok(Math.hypot(m.tg[0][0] - BH[0], m.tg[0][1] - BH[1]) < 25, 'on the Bridgehead');
  assert.equal(words(r.out, VG_WORD.patience).length, 1);
});

test('WB14c the bodies: an Imp at the fighter farthest from him, a Brute and the Markynaz at the nearest and striking about themselves, a Caster at its distance and Bolting the feet of one within its reach (mutants: a Caster rushing in; a Bolt at its own feet)', () => {
  const f = vanguardFight(2);
  f.vg.s = 0; f.vg.w = 3; f.vg.last = 99;   // no more waves: these alone
  f.lg = { n: 3, ads: [], harryAt: 0, sapAt: 0, fed: 0, wardCt: -1, hSent: '', hSentAt: 0 };
  const near = body('s0', BH, 0, 2), far = body('s1', BH, 0, 14);
  f.lg.ads.push({ i: 1, k: HOST.brute, h: 50, m: 50, x: BH[0] + 6, z: BH[1] + 2, mv: null, atk: null, tg: null, tgAt: 0, up: 0, next: 0 });
  f.lg.ads.push({ i: 2, k: HOST.caster, h: 50, m: 50, x: BH[0] - 3, z: BH[1] + 2, mv: null, atk: null, tg: null, tgAt: 0, up: 0, next: Infinity });   // no Bolt due: its distance alone
  f.lg.ads.push({ i: 3, k: HOST.harrier, h: 50, m: 50, x: BH[0], z: BH[1] - 15, mv: null, atk: null, tg: null, tgAt: 0, up: 0, next: 0 });
  let r = beats(f, T0, T0 + 250, [near, far]);
  const mv = r.out.filter((o) => o.k === 'amv').flatMap((o) => o.m);
  const of = (i) => mv.find((m) => m[0] === i);
  assert.ok(of(1) && Math.hypot(of(1)[3] - near.x, of(1)[4] - near.z) < 3, 'the Brute at the nearest');
  assert.ok(of(2) && Math.hypot(of(2)[3] - near.x, of(2)[4] - near.z) > Math.hypot(f.lg.ads[1].x - near.x, f.lg.ads[1].z - near.z) + 3, 'the Caster away from one too near');
  f.lg.ads[1].next = 0; f.lg.ads[1].mv = null;   // its Bolt due
  r = beats(f, r.t + 250, r.t + 250, [near, far]);
  const bolt = r.out.filter((o) => o.k === 'aatk').flatMap((o) => o.a).find((a) => a[0] === 2);
  assert.ok(bolt && Math.hypot(bolt[2] - near.x, bolt[3] - near.z) < 0.01, 'a Bolt at a fighter\'s feet');
  assert.ok(Math.hypot(of(3)[3] - far.x, of(3)[4] - far.z) < 2, 'the Imp at the farthest from him');
  assert.deepEqual(VG_CASTER_KEEP, [10, 16]);
  assert.equal(VG_CASTER_REACH, 22);
  // the Brute in reach: its Smash about itself
  f.lg.ads[0].x = near.x + 1.5; f.lg.ads[0].z = near.z; f.lg.ads[0].mv = null;
  r = beats(f, r.t + 250, r.t + 500, [near, far]);
  const smash = r.out.filter((o) => o.k === 'aatk').flatMap((o) => o.a).find((a) => a[0] === 1);
  assert.ok(smash && Math.hypot(smash[2] - f.lg.ads[0].x, smash[3] - f.lg.ads[0].z) < 0.01);
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14c the relay takes a blow on one of the Vanguard from the platform its body stands on, never from another floor; and counts its Smash and Rend as plain blows, never its Bolt (mutants: blows from his court alone; the Bolt counted)', () => {
  const f = vanguardFight(2);
  f.lg = { n: 1, ads: [{ i: 1, k: HOST.brute, h: 500, m: 500, x: BH[0], z: BH[1] + 2, mv: null, atk: null, tg: null, tgAt: 0, up: 0, next: 0 }], harryAt: 0, sapAt: 0, fed: 0, wardCt: -1, hSent: '', hSentAt: 0 };
  const hit = (pose, t) => { const before = f.lg.ads[0].h; applyHostHit(f, 's0', 1, 20, HIT_KINDS.Spell, pose, t, t); return before - f.lg.ads[0].h; };
  assert.ok(hit({ x: BH[0], z: BH[1] - 3 }, T0 + 1000) > 0, 'from the Bridgehead');
  assert.equal(hit({ x: C0[0], z: C0[1] }, T0 + 3000), 0, 'from his court: no');
  const live = [{ sub: 's0', x: BH[0], z: BH[1] + 2, dead: false, tr: null }];
  f.lg.ads[0].atk = { at: T0 + 5000, x: BH[0], z: BH[1] + 2, until: T0 + 7000 };
  assert.ok(judgeGate(f, live, T0 + 5500).length >= 1, 'a Smash counted');
  f.lg.ads[0] = { ...f.lg.ads[0], k: HOST.caster, atk: { at: T0 + 9000, x: BH[0], z: BH[1] + 2, until: T0 + 10_000 } };
  assert.equal(judgeGate(f, live, T0 + 9500).length, 0, 'a Bolt is his element\'s: never counted');
});

// ═══ THE WIRE AND THE SCREEN ═════════════════════════════════════════════════════════════════════════════════════════

test('WB14c the wire: the state\'s `vg` a pair (its stage to 2, its waves to 3), the `vgw` word its word, stage and waves and the walkway a clearing lays; folded, a clearing lays its walkway at its own moment and the stage moves on, and the word is kept for the court to say (mutants: the walkway left to the next state; a word past the table taken)', () => {
  assert.equal(GATE_VG_WORDS, Object.keys(VG_WORD).length);
  const w = (o) => validGateOut({ k: 'vgw', e: VG_WORD.clear, s: 0, w: 3, x: WALKWAY.muster, at: 5000, ...o });
  assert.deepEqual(w({}), { k: 'vgw', e: VG_WORD.clear, s: 0, w: 3, x: WALKWAY.muster, at: 5000 });
  for (const bad of [{ e: GATE_VG_WORDS }, { s: 3 }, { w: 4 }, { x: 6 }, { at: -1 }]) assert.equal(w(bad), null, JSON.stringify(bad));
  assert.deepEqual(w({ e: VG_WORD.wave, w: 1, x: undefined }), { k: 'vgw', e: VG_WORD.wave, s: 0, w: 1, at: 5000 });
  const base = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', hp: 900, max: 1000, vg: [0, 3], xa: [] };
  const s1 = foldGate(base, w({}), 5100);
  assert.equal(s1.xa[WALKWAY.muster], 5000);
  assert.deepEqual(s1.vg, [1, 0], 'onward to the Muster');
  assert.deepEqual(s1.vgw, { e: VG_WORD.clear, s: 0, w: 3, at: 5000 });
  const s2 = foldGate(s1, w({ e: VG_WORD.wave, s: 1, w: 1, x: undefined }), 6000);
  assert.deepEqual(s2.vg, [1, 1]);
  const st = { ...stateOf(vanguardFight()), d: 7 };
  const s3 = foldGate(s2, validGateOut(JSON.parse(JSON.stringify(st))), 7000);
  assert.deepEqual(s3.vgw, s2.vgw, 'a state keeps the last word for the court');
  for (const bad of [[3, 0], [0, 4], [0], 'x']) assert.equal(validGateOut({ ...JSON.parse(JSON.stringify(st)), vg: bad }), null, JSON.stringify(bad));
});

test('WB14c on my screen: the Vanguard\'s words - its first wave, each clearing, the Markynaz, his patience - and nothing for its other waves; its waves never said as his host\'s; the bar says its platform and wave; my blows reach its bodies from its platforms; a Bolt in his element\'s colour (mutants: a wave said twice over; the bar silent; blows from his court alone)', () => {
  assert.equal(vanguardLine({ e: VG_WORD.wave, s: 0, w: 1 }), VANGUARD_TEXT.rises());
  assert.equal(vanguardLine({ e: VG_WORD.wave, s: 0, w: 2 }), null);
  assert.equal(vanguardLine({ e: VG_WORD.wave, s: 1, w: 1 }), null);
  assert.equal(vanguardLine({ e: VG_WORD.clear, s: 0 }), 'The Bridgehead is clear.');
  assert.equal(vanguardLine({ e: VG_WORD.lord, s: 1 }), 'The Markynaz rises.');
  assert.equal(vanguardLine({ e: VG_WORD.broken, s: 1 }), 'The Vanguard is broken. The way to the Warden opens.');   // PIN MOVED (AUDIT WB14 TEXT-4): said as the Muster empties - a Brute may outlive the Markynaz
  assert.equal(vanguardLine({ e: VG_WORD.patience }, 'Valkynaz Ruhn'), 'Valkynaz Ruhn tires of waiting.');
  assert.equal(vanguardLine({ e: VG_WORD.open }), null);
  assert.ok(vanguardOut({ vg: [1, 2] }) && !vanguardOut({ vg: [2, 0] }) && !vanguardOut({ vg: null }));
  assert.equal(waveLine({ vg: [0, 1] }, HOST.harrier, 'Ruhn', 'Imps'), null, 'its Imps are the Vanguard\'s');
  assert.equal(waveLine({ vg: null }, HOST.harrier, 'Ruhn', 'Imps'), COURT_HOST_TEXT.harriers('Ruhn', 'Imps'), 'his host\'s, as ever');
  assert.equal(waveLine({ vg: null }, HOST.brute, 'Ruhn', 'Daedroths'), null);
  const boss = { name: 'Valkynaz Ruhn', title: 'Warden of the Burning Gate' };
  const s = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', hp: 900, max: 1000, vg: [0, 2], lg: { ads: [{ i: 1, k: HOST.brute, h: 1, m: 1, x: 0, z: 0 }], gone: [] } };
  assert.equal(bossBarModel(s, T0, boss).host, 'The Vanguard - Bridgehead, wave 2 of 3');
  assert.equal(bossBarModel({ ...s, vg: [1, 3] }, T0, boss).host, 'The Vanguard - Muster, wave 3 of 3');
  assert.equal(bossBarModel({ ...s, vg: [2, 0] }, T0, boss).host, 'His host: 1', 'broken: his host\'s line as ever');
  const gc = read('src/scenes/gate/gateCourt.js');
  assert.match(gc, /if \(k >= 0 && s\.lg\) for \(const T of host\.targets\(\)\) if \(nearestCourt\(T\.feet\[0\] - COURT_CENTRE\[0\], T\.feet\[2\] - COURT_CENTRE\[2\]\) === k\) _hostMine\.push\(T\);/);   // PIN MOVED (WB14f, AUDIT of WB14c): each body from the floor it stands on - the blow itself is pinned on the court, from a platform (test/net/gate/wb14f_captive.test.js)   // PIN MOVED (AUDIT WB14 SCREEN-1): beside his Flame, sundered
  assert.match(gc, /const line = t - s\.vgw\.at <= FED_LATE_MS \? vanguardLine\(s\.vgw, bossOf\(s\)\.name\) : null; if \(line\) say\(line\);/);
  // a Bolt drawn in his element's colour
  const bs = { ...s, lg: { ads: [{ i: 1, k: HOST.caster, h: 1, m: 1, x: 0, z: 0, atk: { at: T0 + 1000, x: 2, z: 2 } }, { i: 2, k: HOST.brute, h: 1, m: 1, x: 0, z: 0, atk: { at: T0 + 1000, x: 4, z: 4 } }] }, shieldUntil: 0, wrathAt: 1e12 };
  const sh = hostShapes(bs, T0 + 500, BASE_PROFILE);
  assert.deepEqual(sh[0].color, hostPulseColor(BASE_PROFILE));
  assert.deepEqual(sh[1].color, HOST_BITE_COLOR);
});

test('WB14c never on a plain night: its stages, its waves and its words are a Vanguard night\'s alone - a plain night\'s fight raises nothing, says no `vgw`, and its state no `vg` (mutants: the Vanguard on every night)', () => {
  const f = newFight(7, T0, WRATH, 'ruhn');
  for (let i = 0; i < 2; i++) joinFight(f, `s${i}`, `F${i}`, 10, T0, true);
  const r = beats(f, T0, T0 + 30_000, [body('s0', BH), body('s1', C0, 0, 6)]);
  assert.equal(r.out.filter((o) => o.k === 'vgw' || o.k === 'ad').length, 0);
  assert.equal(stateOf(f).vg, undefined);
  for (let d = 0; d < 400; d++) { const pt = gatePortentsOf(d); if (pt?.includes('vanguard')) assert.ok(!(gateModsOf(d) ?? []).includes('legion'), `day ${d}`); }   // AUDIT WB14 (RECORD nit): the night's marks - a portent list never holds 'legion'
});
