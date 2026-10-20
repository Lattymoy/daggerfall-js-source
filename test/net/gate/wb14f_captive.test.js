// WB14f (2026-10-19, Mac: "And whatever else you can cook up", then "This is all yours to take on"): THE CAPTIVE - on a
// Captive night a knight of the Covenant kneels at the Pen's heart, chained to his gaolers (WB11's Ward-Bearer's body and
// Pulse under another name). At the Warden's wake the walkway to the Pen rises, and the gaolers as the first challenger
// stands in it (AUDIT WB14 LAW-8: sized for the fight then - at his wake it is the first few to come); the last one down,
// the knight is free, and the next Dagon's Reckoning to land lands on the Covenant's ward and on no fighter - its crystals
// still break for the stun, a Reckoning broken leaves the ward for the next, and it is spent once. Beside it, the AUDIT of
// WB14c this slice found: a blow on one of his host from the floor its body stands on (a Vanguard's platform, the Pen) is
// the court's to send, as it is the relay's to take.
//
//   the law          net/gate/gateBrain.js HOST_KINDS 7 (the gaoler), HOST_BLOWS 7, newCaptive, CAPTIVE_RING_R, stepCaptive,
//                    captiveWard, wardTakes, captiveSpent, notGaoler (the turn's crumble), applyCrystalHit (a broken
//                    Reckoning gives the ward back), stateOf's `cp`; net/gate/gateLaw.js captiveIndexOf; net/gate/gateMods.js
//                    CAPTIVE_DAMES
//   the relay        net/bossRef.js judgeGate (the warded Reckoning counts nobody)
//   the wire         GATE_HOST_KINDS 8, the state's `cp`, `cpf` and `cpw`
//   the screen       net/gate/gateLink.js (the fold), scenes/gate/gateCaptive.js (the knight, his chains, his words, the
//                    ward's gold), scenes/gate/gateCourt.js (the warded Reckoning spares me; my blows on his host from the
//                    floor it stands on), ui/gate/gateBossBar.js (the gaolers, then the ward), world/gate/gateBoss.js (the
//                    gaoler's look, the knight's)
//
// Design: bible/11-Multiplayer/Breach-Portents.md section 7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COURTS, COURT_R, FLOOR, WALKWAY, HOST, HOST_KINDS, HOST_BLOWS, HOST_RISE_MS, HOST_GONE, OPENING_MS, BRAIN_TICK_MS, HIT_KINDS, PHASE_AT, ATTACKS, RECKON_CLOSE_MS,
  BEARER_TEAM_S, BEARER_PULSE_FIRST_MS, CAPTIVE_RING_R, bearerCountFor, hostTeamHpFor, newFight, joinFight, stepBrain, stateOf, applyHostHit, applyCrystalHit,
  newCaptive, wardTakes, captiveSpent,
} from '../../../src/net/gate/gateBrain.js';
import { judgeGate } from '../../../src/net/bossRef.js';
import { captiveIndexOf, captiveNameOf } from '../../../src/net/gate/gateLaw.js';
import { CAPTIVE_NAMES, CAPTIVE_DAMES } from '../../../src/net/gate/gateMods.js';
import { validGateOut, GATE_HOST_KINDS } from '../../../src/net/wire.js';
import { foldGate, GATE_STATE_EMPTY, captiveOfState } from '../../../src/net/gate/gateLink.js';
import { createGateCourt } from '../../../src/scenes/gate/gateCourt.js';
import { createGateCaptive, captiveChains, captiveShown, CAPTIVE_TEXT, CAPTIVE_AT, CAPTIVE_GONE_MS } from '../../../src/scenes/gate/gateCaptive.js';
import { waveLine } from '../../../src/scenes/gate/gateHost.js';
import { hostLookOf, knightLookOf, knightAct, KNIGHT_MOBILE, WARD_COLOR } from '../../../src/world/gate/gateBoss.js';
import { bossBarModel, BOSS_BAR_TEXT } from '../../../src/ui/gate/gateBossBar.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import { TELEGRAPH_EDGE_SAFE } from '../../../src/render/gate/gateTelegraph.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000, WRATH = T0 + 3_600_000;
const seeded = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const PEN = COURTS[FLOOR.pen];
const BOSS = { id: 'ruhn', name: 'Valkynaz Ruhn', title: 'Warden of the Burning Court' };

/** A Captive night (`pt` - a plain one: null), `n` fighters at level 10 about the first court. */
function captiveFight(n = 3, pt = ['captive']) {
  const f = newFight(7, T0, WRATH, 'ruhn', null, pt, null);
  const where = {};
  for (let i = 0; i < n; i++) { joinFight(f, `s${i}`, `F${i}`, 10, T0, true); where[`s${i}`] = [Math.sin(i * 2.1) * 6, Math.cos(i * 2.1) * 6]; }
  const run = { f, where, t: T0, out: [], rng: seeded(9) };
  run.bodies = () => Object.entries(where).map(([sub, p]) => ({ sub, id: `peer-${sub}`, x: p[0], z: p[1], dead: false }));
  run.step = (k = 1) => { for (let i = 0; i < k; i++) { run.out.push(...stepBrain(f, run.t, run.bodies(), run.rng)); run.t += BRAIN_TICK_MS; } return run; };
  run.until = (at) => { while (run.t < at) run.step(); return run; };
  run.gaolers = () => f.lg?.ads.filter((a) => a.k === HOST.gaoler) ?? [];
  run.words = (k) => run.out.filter((o) => o.k === k);
  return run;
}
/** Past his wake and the walkway to the Pen laid whole - and (AUDIT WB14 LAW-8) one of them in at the Pen's rim a beat,
 *  his gaolers risen for it, then back where they stood. */
function woken(run) {
  run.until(T0 + OPENING_MS + 6000);
  const k = Object.keys(run.where).at(-1), was = run.where[k];
  run.where[k] = [PEN[0], PEN[1] + COURT_R - 1];
  run.step();
  run.where[k] = was;
  return run;
}
/** Every gaoler cut down from the Pen (each brought to a blow's reach first - the purse is WB11's, pinned there). */
function freeHim(run) {
  run.where.s0 = [PEN[0], PEN[1] + 1];
  for (const a of run.gaolers()) {
    a.h = 1;
    const out = applyHostHit(run.f, 's0', a.i, 5, HIT_KINDS.Spell, { x: PEN[0], z: PEN[1] + 1 }, run.t, run.t + a.i);
    run.out.push(...out);
    run.t += 300;
  }
  return run.step();
}
/** Him in his last phase in the third court, a Reckoning due now, every fighter before him. */
function toReckoning(run) {
  const f = run.f, C = COURTS[FLOOR.third];
  f.phase = 3; f.court = FLOOR.third; f.pos = [C[0], C[1]]; f.queue = []; f.pending = null; f.atk = null; f.move = null; f.shieldUntil = 0;
  f.xa = [T0, T0, ...f.xa.slice(2)];
  for (const k of Object.keys(run.where)) run.where[k] = [C[0] + 4, C[1] + Number(k.slice(1)) * 2];
  f.rk = run.t; f.nextAt = run.t;
  for (let i = 0; i < 400 && f.atk?.a !== ATTACKS.reckon.id; i++) run.step();
  assert.equal(f.atk?.a, ATTACKS.reckon.id, 'a Reckoning called');
  return run;
}

// ═══ THE LAW ══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14f the gaoler: a Ward-Bearer\'s body, Pulse and rising under another name; kind 7 on the wire; a captive only on a Captive night, each of its moments 0 until it comes; the knight the day\'s, a Dame drawn as Daggerfall\'s woman knight (mutants: a gaoler that walks; a captive on a plain night)', () => {
  const G = HOST_KINDS[HOST.gaoler], B = HOST_KINDS[HOST.bearer];
  assert.deepEqual([G.id, G.key, G.r, G.h, G.speed], [7, 'gaoler', B.r, B.h, 0]);
  const { kind: k1, name: n1, ...pulse } = HOST_BLOWS[HOST.gaoler], { kind: k2, name: n2, ...bearer } = HOST_BLOWS[HOST.bearer];
  assert.deepEqual(pulse, bearer, 'the Ward-Bearer\'s Pulse');
  assert.deepEqual([k1, n1, n2], [7, 'Ward Pulse', 'Ward Pulse']);
  assert.equal(HOST_RISE_MS[HOST.gaoler], HOST_RISE_MS[HOST.bearer]);
  assert.equal(GATE_HOST_KINDS, 8);
  assert.deepEqual(newCaptive(), { at: 0, n: 0, f: 0, w: 0, s: 0 });
  assert.deepEqual(newFight(7, T0, WRATH, 'ruhn', null, ['captive'], null).cp, newCaptive());
  for (const pt of [null, ['vanguard'], ['sunder'], ['vanguard', 'sunder']]) assert.equal(newFight(7, T0, WRATH, 'ruhn', null, pt, null).cp, null, String(pt));
  assert.equal(stateOf(newFight(7, T0, WRATH, 'ruhn')).cp, undefined, 'a plain night says none');
  for (let d = 0; d < 60; d++) { const k = captiveIndexOf(d); assert.ok(k >= 0 && k < CAPTIVE_NAMES.length); assert.equal(captiveNameOf(d), CAPTIVE_NAMES[k]()); }
  CAPTIVE_NAMES.forEach((n, k) => assert.equal(n().startsWith('Dame'), CAPTIVE_DAMES[k], n()));
  assert.equal(KNIGHT_MOBILE, 145);
  assert.deepEqual([knightLookOf(false).archive, knightLookOf(true).archive], [ENEMY_BASICS[145].maleTexture, ENEMY_BASICS[145].femaleTexture]);
  assert.deepEqual([knightLookOf(false).archive, knightLookOf(true).archive], [488, 487]);
  assert.equal(knightAct(false, 5000).act, 'chained'); assert.equal(knightAct(true, 5000).act, 'idle');
  const L = hostLookOf(HOST.gaoler, 'rime');
  assert.deepEqual([L.mobile, L.name, L.plural], [hostLookOf(HOST.bearer, 'rime').mobile, 'Gaoler', 'Gaolers']);
});

test('WB14f his wake: the walkway to the Pen laid at its moment, said at once in the state; his gaolers risen as the first living challenger stands in the Pen - bearerCountFor of the fight then on a ring CAPTIVE_RING_R about the Pen\'s heart, BEARER_TEAM_S of their reference shared; none before, none on a plain night (mutants: risen at the fight\'s birth; one body sized whole; the walkway never laid; AUDIT WB14 LAW-8: sized at his wake, for the first few to come; risen with nobody in the Pen)', () => {
  const run = captiveFight(3);
  run.until(T0 + OPENING_MS - BRAIN_TICK_MS);
  assert.equal(run.f.cp.at, 0, 'not before his wake');
  assert.ok(!Number.isFinite(run.f.xa[WALKWAY.pen]));
  run.step(3);
  const at = run.f.cp.at;
  assert.ok(at >= T0 + OPENING_MS && at < T0 + OPENING_MS + 3 * BRAIN_TICK_MS);
  assert.equal(run.f.xa[WALKWAY.pen], at, 'laid at its moment');
  let st = run.out.filter((o) => o.k === 'st').at(-1);
  assert.deepEqual(st.cp, [at, 0, 0, 0, 0], 'the state says it at once');
  assert.ok(st.xa[WALKWAY.pen] === at);
  run.until(at + 20_000);
  assert.equal(run.gaolers().length, 0, 'nobody in the Pen: none risen');
  assert.equal(run.f.cp.f, 0, 'and never free for it');
  // AUDIT WB14 (LAW-8): nine more come before anyone reaches the Pen - the gaolers are the twelve's
  for (let i = 3; i < 12; i++) { joinFight(run.f, `s${i}`, `F${i}`, 10, run.t, true); run.where[`s${i}`] = [Math.sin(i) * 8, Math.cos(i) * 8]; }
  run.where.s0 = [PEN[0], PEN[1] + COURT_R - 1];
  run.step();
  const g = run.gaolers();
  assert.equal(g.length, bearerCountFor(12));
  assert.equal(bearerCountFor(12), 4);
  assert.equal(run.f.cp.n, g.length);
  for (const a of g) {
    assert.ok(Math.abs(Math.hypot(a.x - PEN[0], a.z - PEN[1]) - CAPTIVE_RING_R) < 0.02, 'on the ring');
    assert.equal(a.h, hostTeamHpFor(BEARER_TEAM_S, Array(12).fill(10), g.length), 'the twelve\'s reference shared');
  }
  const ad = run.words('ad');
  assert.equal(ad.length, 1); assert.equal(ad[0].w, HOST.gaoler);
  st = run.out.filter((o) => o.k === 'st').at(-1);
  assert.deepEqual(st.cp, [at, g.length, 0, 0, 0], 'the state says them at once');
  const small = woken(captiveFight(3));
  assert.equal(small.gaolers().length, bearerCountFor(3));
  for (const a of small.gaolers()) assert.equal(a.h, hostTeamHpFor(BEARER_TEAM_S, [10, 10, 10], small.gaolers().length));
  const plain = captiveFight(3, null); woken(plain);
  assert.equal(plain.f.lg, null, 'no gaolers on a plain night');
});

test('WB14f the gaolers: their Pulse at whoever comes near in the Pen, never at one in his court; the relay leaves the Pulse to the struck screen (his element\'s); they outlive his phases\' turns, where a Tithe-Imp flees (mutants: a Pulse at the court; crumbled at the turn)', () => {
  const run = captiveFight(3);
  woken(run);
  const g = run.gaolers()[0];
  run.step(Math.ceil((HOST_RISE_MS[HOST.gaoler] + BEARER_PULSE_FIRST_MS) / BRAIN_TICK_MS));
  assert.ok(run.t > g.up + BEARER_PULSE_FIRST_MS, 'risen, its first Pulse due');
  assert.equal(run.words('aatk').length, 0, 'nobody near it yet');
  run.where.s1 = [g.x + 1, g.z];
  run.step(3);
  const pulses = run.words('aatk').flatMap((w) => w.a);
  assert.ok(pulses.some((p) => p[0] === g.i), 'at the one beside it');
  const far = captiveFight(3); woken(far);
  far.until(far.gaolers()[0].up + BEARER_PULSE_FIRST_MS + 4000);
  assert.equal(far.words('aatk').length, 0, 'nobody in the Pen, no Pulse');
  // the relay counts none of it
  const a = run.f.lg.ads.find((o) => o.atk);
  assert.ok(a);
  const shares = judgeGate(run.f, run.bodies().filter((b) => b.sub === 's1'), a.atk.at + 400);   // (the one in the Pen - his own blows in his court are his)
  assert.equal(shares.length, 0, 'his element\'s - the struck screen\'s');
  // a phase's turn: the gaolers stand
  const n = run.gaolers().length;
  run.f.hp = run.f.max * (PHASE_AT[0] - 0.01);
  run.step();
  assert.equal(run.f.phase, 2);
  assert.equal(run.gaolers().length, n, 'the Pen is no court of his');
  assert.ok(!run.words('adie').some((w) => w.w === HOST_GONE.crumbled && w.is.some((i) => run.gaolers().some((o) => o.i === i))));
});

test('WB14f his freeing: a blow on a gaoler only from the Pen (the floor its body stands on); the last one down frees him a beat on (`cpf`), the state saying it at once (mutants: struck from his court; freed with one still standing)', () => {
  const run = captiveFight(3);
  woken(run);
  const [a, b] = run.gaolers();
  a.h = 1;
  assert.deepEqual(applyHostHit(run.f, 's0', a.i, 5, HIT_KINDS.Spell, { x: 0, z: 0 }, run.t, 1), [], 'from his court: none');
  assert.equal(a.h, 1);
  const out = applyHostHit(run.f, 's0', a.i, 5, HIT_KINDS.Spell, { x: PEN[0], z: PEN[1] }, run.t + 300, 2);
  assert.deepEqual(out.map((o) => [o.k, o.w]), [['adie', HOST_GONE.slain]]);
  run.t += 400; run.step();
  assert.equal(run.f.cp.f, 0, 'one still stands');
  assert.equal(run.words('cpf').length, 0);
  b.h = 1;
  run.out.push(...applyHostHit(run.f, 's0', b.i, 5, HIT_KINDS.Spell, { x: PEN[0], z: PEN[1] }, run.t, 3));
  const at = run.t;
  run.step();
  assert.equal(run.f.cp.f, at, 'free');
  assert.deepEqual(run.words('cpf').map((w) => w.at), [at]);
  assert.equal(run.out.filter((o) => o.k === 'st').at(-1).cp[2], at);
});

// ═══ THE WARD ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14f the Covenant\'s ward: freed, the next Reckoning is given it at its word (`cpw`); it lands on none of the court - the relay counts nobody - where a Reckoning unwarded strikes each; and it is spent as it lands, said in the state (mutants: the ward given none; the judge counts it; spent before it lands)', () => {
  const run = freeHim(woken(captiveFight(3)));
  toReckoning(run);
  const A = run.f.atk;
  assert.deepEqual(run.words('cpw').map((w) => w.i), [A.i]);
  assert.equal(run.f.cp.w, A.i);
  assert.ok(wardTakes(run.f.cp, A));
  assert.ok(!captiveSpent(run.f.cp, A, A.at - 1));
  assert.ok(captiveSpent(run.f.cp, A, A.at));
  assert.deepEqual(judgeGate(run.f, run.bodies(), A.at + 50), [], 'on the ward, on nobody');
  run.until(A.at + BRAIN_TICK_MS);
  assert.equal(run.f.cp.s, A.at, 'spent as it landed');
  assert.equal(run.out.filter((o) => o.k === 'st').at(-1).cp[4], A.at);
  // unfreed: no ward, and it strikes each of them
  const held = toReckoning(woken(captiveFight(3)));
  assert.equal(held.f.cp.w, 0);
  assert.equal(held.words('cpw').length, 0);
  assert.equal(judgeGate(held.f, held.bodies(), held.f.atk.at + 50).length, 3, 'each of them');
  // spent, the next Reckoning lands as ever
  run.f.rk = run.t; run.f.atk = null; run.f.nextAt = run.t; run.f.pending = null; run.f.queue = [];
  for (let i = 0; i < 400 && !(run.f.atk?.a === ATTACKS.reckon.id && run.f.atk.i !== A.i); i++) run.step();
  assert.notEqual(run.f.atk.i, A.i);
  assert.equal(run.words('cpw').length, 1, 'spent once');
  assert.equal(judgeGate(run.f, run.bodies(), run.f.atk.at + 50).length, 3);
});

test('WB14f a Reckoning broken before it lands gives the ward back - the next one takes it; freed while one still winds up, the ward takes that one at once, never in its last RECKON_CLOSE_MS (mutants: the ward lost to a broken Reckoning; given in its last breath)', () => {
  const run = toReckoning(freeHim(woken(captiveFight(3))));
  const A = run.f.atk;
  assert.equal(run.f.cp.w, A.i);
  run.step(2);
  assert.ok(run.f.cx, 'its crystals');
  for (const q of run.f.cx.c) q.h = 1;
  run.f.cx.c.forEach((q, c) => {
    run.out.push(...applyCrystalHit(run.f, 's0', c, 5, HIT_KINDS.Spell, { x: COURTS[FLOOR.third][0] + 4, z: COURTS[FLOOR.third][1] }, run.t, run.t + c + 1));
    run.t += 300;
  });
  assert.equal(run.words('stun').length, 1, 'broken');
  assert.equal(run.f.cp.w, 0, 'the ward back');
  assert.equal(run.f.cp.s, 0, 'never spent');
  run.f.rk = run.t; run.f.stunUntil = 0; run.f.nextAt = run.t;
  for (let i = 0; i < 400 && !(run.f.atk?.a === ATTACKS.reckon.id && run.f.atk.i !== A.i); i++) run.step();
  assert.equal(run.f.cp.w, run.f.atk.i, 'the next one takes it');
  // freed mid-wind-up: at once
  const mid = toReckoning(woken(captiveFight(3)));
  const M = mid.f.atk;
  mid.t = M.at - 5000;
  freeHim(mid);
  assert.equal(mid.f.cp.w, M.i, 'the one winding up');
  // in its last breath: not that one
  const late = toReckoning(woken(captiveFight(3)));
  late.t = late.f.atk.at - RECKON_CLOSE_MS + 100 - 300 * late.gaolers().length;
  freeHim(late);
  assert.ok(late.f.cp.f > 0);
  assert.equal(late.f.cp.w, 0, 'too late for this one');
});

// ═══ THE WIRE AND THE FOLD ════════════════════════════════════════════════════════════════════════════════════════

test('WB14f the wire: the state\'s `cp` (five moments and counts, each 0 until it comes), `cpf` its moment, `cpw` the Reckoning\'s number - each bounded, every other field dropped; the fold holds the Captive by name and lays each word on it (mutants: a `cp` of any length; a `cpw` of no number; the freeing never folded)', () => {
  const st = stateOf(Object.assign(newFight(7, T0, WRATH, 'ruhn', null, ['captive'], null), { cp: { at: T0 + 16_000, n: 2, f: 0, w: 0, s: 0 } }));
  const v = validGateOut(st);
  assert.deepEqual(v.cp, [T0 + 16_000, 2, 0, 0, 0]);
  for (const bad of [[1, 2, 3, 4], [T0, 2, 0, 0, 0, 7], [-1, 2, 0, 0, 0], [T0, 99, 0, 0, 0], [T0, 2, 0, -1, 0], [T0, 2, 0, 1.5, 0], 'cp']) assert.equal(validGateOut({ ...st, cp: bad }), null, JSON.stringify(bad));
  assert.deepEqual(validGateOut({ k: 'cpf', at: T0, x: 1 }), { k: 'cpf', at: T0 });
  assert.equal(validGateOut({ k: 'cpf', at: 0 }), null);
  assert.deepEqual(validGateOut({ k: 'cpw', i: 4, at: T0, y: 2 }), { k: 'cpw', i: 4, at: T0 });
  for (const i of [0, -1, 1.5, '4']) assert.equal(validGateOut({ k: 'cpw', i, at: T0 }), null, String(i));
  assert.deepEqual(captiveOfState([1, 2, 3, 4, 5]), { at: 1, n: 2, f: 3, w: 4, s: 5 });
  assert.equal(captiveOfState(undefined), null);
  let s = foldGate(GATE_STATE_EMPTY, v, T0);
  assert.deepEqual(s.cp, { at: T0 + 16_000, n: 2, f: 0, w: 0, s: 0 });
  s = foldGate(s, { k: 'cpf', at: T0 + 30_000 }, T0 + 30_000);
  assert.equal(s.cp.f, T0 + 30_000);
  s = foldGate(s, { k: 'cpw', i: 9, at: T0 + 40_000 }, T0 + 40_000);
  assert.equal(s.cp.w, 9);
  assert.equal(foldGate(GATE_STATE_EMPTY, validGateOut(stateOf(newFight(7, T0, WRATH, 'ruhn'))), T0).cp, null, 'a plain night holds none');
  assert.equal(GATE_STATE_EMPTY.cp, null);
});

// ═══ ON MY SCREEN ═════════════════════════════════════════════════════════════════════════════════════════════════

const reckonState = (w) => ({
  ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 3, hp: 900, max: 1000, wrathAt: 1e12, x: COURTS[2][0], z: COURTS[2][1], pt: ['captive'], ct: FLOOR.third,
  atk: { i: 12, a: ATTACKS.reckon.id, at: 50_000, x: COURTS[2][0], z: COURTS[2][1], yw: 0, tg: [] }, cp: { at: 10_000, n: 2, f: 20_000, w, s: 0 }, lg: { ads: [], gone: [] },
});
test('WB14f the court: the Reckoning the ward takes lands on none of us here, where one unwarded strikes me; its telegraph in the ward\'s gold (mutants: struck all the same; drawn in Dagon\'s crimson)', () => {
  const run = (w) => {
    const struck = [], s = reckonState(w);
    const c = createGateCourt({ link: { state: () => s, watching: () => false }, now: () => 50_100, feet: () => courtToDungeon(COURTS[2][0] + 3, 0, COURTS[2][1]), player: () => ({ health: 100, maxHealth: 100, level: 10 }), strike: (d) => struck.push(d) });
    c.frame();
    return struck;
  };
  assert.deepEqual(run(12), [], 'on the ward');
  assert.equal(run(0).length, 1, 'unwarded, it strikes');
  assert.equal(run(11).length, 1, 'another Reckoning\'s ward is not this one\'s');
  const cap = createGateCaptive();
  const shape = { color: [1, 0, 0], edge: [1, 0, 0], style: 5 };
  assert.equal(cap.dress(shape, reckonState(12)).color, WARD_COLOR);
  assert.equal(shape.edge, TELEGRAPH_EDGE_SAFE);
  const red = { color: [1, 0, 0], edge: [1, 0, 0], style: 5 };
  assert.deepEqual(cap.dress(red, reckonState(0)).color, [1, 0, 0], 'his own, unwarded');
  assert.equal(cap.dress(null, reckonState(12)), null);
  assert.match(read('src/scenes/gate/gateCourt.js'), /if \(v === 'hit' && !wardTakes\(s\.cp, atk\)\) \{ if \(ATTACK_BY_ID\[atk\.a\] === ATTACKS\.wrath\) wrathLanded = true; land\(atk, P\); \}/);
});

test('WB14f AUDIT of WB14c: my blow on one of his host goes out from the floor its body stands on - a Brute from its platform, a gaoler from the Pen - and from no other floor; the bodies offered are those on my floor (mutants: refused from a platform - WB14c\'s "from his court" - or offered across the fire)', () => {
  const BH = COURTS[FLOOR.bridgehead];
  const run = (where, ads, extra = {}) => {
    const sent = [], s = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 1, hp: 900, max: 1000, wrathAt: 1e12, x: 0, z: 0, lg: { ads, gone: [] }, ...extra };
    const c = createGateCourt({ link: { state: () => s, watching: () => false }, now: () => 5000, feet: () => courtToDungeon(where[0], 0, where[1]), player: () => ({ health: 100, maxHealth: 100, level: 10 }), sendHost: (h) => { sent.push(h); return true; } });
    c.frame();
    return { c, sent };
  };
  const brute = { i: 3, k: HOST.brute, h: 40, m: 40, x: BH[0] + 1, z: BH[1], mv: null, atk: null, rose: -Infinity, yaw: 0 };
  const onIt = run([BH[0], BH[1]], [brute], { vg: [0, 1], pt: ['vanguard'] });
  assert.deepEqual(onIt.c.hostTargets().map((T) => T.i), [3], 'offered on its platform');
  assert.equal(onIt.c.hostHit({ i: 3, d: 10, r: HIT_KINDS.Melee }), true, 'and the blow goes');
  assert.equal(onIt.sent.length, 1);
  const across = run([0, 0], [brute], { vg: [0, 1], pt: ['vanguard'] });
  assert.deepEqual(across.c.hostTargets(), [], 'never across the fire');
  assert.equal(across.c.hostHit({ i: 3, d: 10, r: HIT_KINDS.Melee }), false);
  const gaoler = { i: 4, k: HOST.gaoler, h: 40, m: 40, x: PEN[0] + 7, z: PEN[1], mv: null, atk: null, rose: -Infinity, yaw: 0 };
  const pen = run([PEN[0] + 6, PEN[1]], [gaoler], { pt: ['captive'], cp: { at: 1, n: 1, f: 0, w: 0, s: 0 } });
  assert.deepEqual(pen.c.hostTargets().map((T) => T.i), [4]);
  assert.equal(pen.c.hostHit({ i: 4, d: 10, r: HIT_KINDS.Melee }), true);
  // his host in his court, as ever (the Legion-Lord's)
  const harrier = { i: 5, k: HOST.harrier, h: 20, m: 20, x: 3, z: 3, mv: null, atk: null, rose: -Infinity, yaw: 0 };
  const court = run([2, 2], [harrier]);
  assert.equal(court.c.hostHit({ i: 5, d: 10, r: HIT_KINDS.Melee }), true);
});

test('WB14f the Captive\'s words: his chains as his gaolers rise, each gaoler cut down and how many stand, his freeing (and its gold), his ward taking a Reckoning, the Reckoning breaking on it (and the gold as he goes) - each once, while it is news; the gaolers\' rising no wave of his host (mutants: a line said twice; a stale freeing said)', () => {
  const said = [], bursts = [];
  const cap = createGateCaptive({ say: (x) => said.push(x), burst: (p, at) => bursts.push([p, at]) });
  const name = captiveNameOf(7);
  const base = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 1, hp: 900, max: 1000, wrathAt: 1e12, pt: ['captive'] };
  const g = (i, x) => ({ i, k: HOST.gaoler, h: 40, m: 40, x, z: PEN[1], mv: null, atk: null, rose: 10_000, yaw: 0 });
  let s = { ...base, cp: { at: 10_000, n: 3, f: 0, w: 0, s: 0 }, lg: { ads: [g(1, PEN[0] + 7), g(2, PEN[0] - 7), g(3, PEN[0])], gone: [] } };
  cap.frame(s, 10_100); cap.frame(s, 10_200);
  assert.deepEqual(said, [CAPTIVE_TEXT.chained(name)]);
  assert.equal(said[0], `${name} of the Covenant lies chained in the Pen. Cut down the gaolers!`);
  assert.equal(waveLine(s, HOST.gaoler, 'Ruhn', 'Gaolers'), null, 'its own words, never a wave of his host');
  s = { ...s, lg: { ads: [g(2, PEN[0] - 7), g(3, PEN[0])], gone: [{ i: 1, k: HOST.gaoler, x: PEN[0] + 7, z: PEN[1], w: HOST_GONE.slain, n: 'Ann', at: 12_000 }] } };
  cap.frame(s, 12_100); cap.frame(s, 12_200);
  assert.deepEqual(said.slice(1), ['Ann cuts down a gaoler. 2 stand.']);
  s = { ...s, lg: { ads: [g(3, PEN[0])], gone: [...s.lg.gone, { i: 2, k: HOST.gaoler, x: 0, z: 0, w: HOST_GONE.slain, n: '', at: 13_000 }] } };
  cap.frame(s, 13_100);
  assert.equal(said.at(-1), 'A challenger cuts down a gaoler. 1 stands.');
  s = { ...s, cp: { ...s.cp, f: 14_000 }, lg: { ads: [], gone: [...s.lg.gone, { i: 3, k: HOST.gaoler, x: 0, z: 0, w: HOST_GONE.slain, n: 'Bo', at: 13_900 }] } };
  const before = said.length;
  cap.frame(s, 14_100); cap.frame(s, 14_200);
  assert.deepEqual(said.slice(before), [CAPTIVE_TEXT.freed(name)], 'the last one down says his freeing alone');
  assert.equal(bursts.length, 1); assert.equal(bursts[0][1], 14_000);
  s = { ...s, phase: 3, atk: { i: 12, a: ATTACKS.reckon.id, at: 50_000, x: 0, z: 0, yw: 0, tg: [] }, cp: { ...s.cp, w: 12 } };
  cap.frame(s, 30_000); cap.frame(s, 30_100);
  assert.equal(said.at(-1), CAPTIVE_TEXT.ward(name));
  const n0 = said.length;
  cap.frame(s, 50_050); cap.frame(s, 50_100);
  assert.deepEqual(said.slice(n0), [CAPTIVE_TEXT.spent(name)]);
  assert.equal(bursts.length, 2); assert.equal(bursts[1][1], 50_000);
  // a freeing heard long after is not said
  const late = [];
  const cap2 = createGateCaptive({ say: (x) => late.push(x) });
  cap2.frame({ ...base, cp: { at: 10_000, n: 2, f: 14_000, w: 0, s: 0 }, lg: { ads: [], gone: [] } }, 60_000);
  assert.deepEqual(late, []);
});

test('WB14f the knight on the floor and his chains: shown from his gaolers\' rising until CAPTIVE_GONE_MS after his ward is spent; a chain from each gaoler to him in Dagon\'s crimson while he is held, none once free (mutants: shown before the Pen; never gone; chains after his freeing)', () => {
  const g = (i, x) => ({ i, k: HOST.gaoler, h: 40, m: 40, x, z: PEN[1], mv: null, atk: null, rose: 10_000, yaw: 0 });
  const base = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 1, hp: 900, max: 1000, wrathAt: 1e12, pt: ['captive'] };
  assert.ok(!captiveShown({ ...base, cp: newCaptive() }, 5000), 'not before the Pen');
  const held = { ...base, cp: { at: 10_000, n: 2, f: 0, w: 0, s: 0 }, lg: { ads: [g(1, PEN[0] + 7), g(2, PEN[0] - 7), { ...g(3, 0), k: HOST.tithe }], gone: [] } };
  assert.ok(captiveShown(held, 11_000));
  const ch = captiveChains(held, 11_000);
  assert.equal(ch.length, 2, 'one a gaoler');
  for (const c of ch) assert.deepEqual(c.end, [CAPTIVE_AT[0], CAPTIVE_AT[1]]);
  assert.deepEqual(ch[0].origin, [PEN[0] + 7, PEN[1]]);
  assert.equal(captiveChains({ ...held, cp: { ...held.cp, f: 12_000 } }, 12_100).length, 0, 'free');
  const spent = { ...base, cp: { at: 10_000, n: 2, f: 12_000, w: 12, s: 50_000 } };
  assert.ok(captiveShown(spent, 50_000 + CAPTIVE_GONE_MS - 1));
  assert.ok(!captiveShown(spent, 50_000 + CAPTIVE_GONE_MS));
  assert.ok(!captiveShown({ ...held, fell: { at: 1 } }, 11_000), 'gone with his fall');
  assert.deepEqual(CAPTIVE_AT, COURTS[FLOOR.pen]);
});

test('WB14f the bar: his gaolers standing, then the Covenant\'s ward over the court until it is spent - never counted his host; the warded Reckoning\'s callout in the ward\'s gold (mutants: the gaolers counted his host; the ward said after it is spent)', () => {
  const g = (i) => ({ i, k: HOST.gaoler, h: 40, m: 40, x: PEN[0], z: PEN[1] });
  const base = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 1, hp: 900, max: 1000, wrathAt: 1e12, pt: ['captive'], shieldUntil: 0 };
  assert.equal(bossBarModel({ ...base, cp: { at: 1, n: 2, f: 0, w: 0, s: 0 }, lg: { ads: [g(1), g(2)], gone: [] } }, 100, BOSS).host, BOSS_BAR_TEXT.gaolers(2));
  assert.equal(BOSS_BAR_TEXT.gaolers(2), 'Gaolers: 2');
  assert.equal(bossBarModel({ ...base, cp: { at: 1, n: 2, f: 50, w: 0, s: 0 }, lg: { ads: [], gone: [] } }, 100, BOSS).host, 'The Covenant\'s ward');
  assert.equal(bossBarModel({ ...base, cp: { at: 1, n: 2, f: 50, w: 12, s: 90 }, lg: { ads: [], gone: [] } }, 100, BOSS).host, null, 'spent');
  const r = reckonState(12);
  const m = bossBarModel({ ...r, cx: { i: 12, m: 30, c: [[0, 0, 30]], broke: [] } }, 40_000, BOSS);
  assert.equal(m.host, 'The Covenant\'s ward');
  assert.equal(m.callout.color, `rgb(${WARD_COLOR.map((v) => Math.round(v * 255)).join(', ')})`);
});
