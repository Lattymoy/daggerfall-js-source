// AUDIT EG III (2026-10-13, the Elite Gates arc's third audit; bible/11-Multiplayer/Elite-Gates.md sections 6.2, 7, 15, 16
// and 21) - THE COUNT, THE EARNER, THE DOOR AND THE MARKS, PINNED ON THE DIRECTOR (lane 2's findings 1, 2, 3, 5, 6, 11 and
// 18): every fixture is the producers' own - the breach and its halls from net/eliteGates/egBrain.js (egBreachNew, egEnter, egStep,
// egBlow, egDown, egWord, egHeal, egCount), its words through the wire (net/wire.js validEgOut, validEgIn).
//   #2  THE COUNT'S ONE LAW - a Redoubt's time from net/eliteGates/egLaw.js egCountRedoubt and egRedoubtHold (the Covenant's Press),
//       capped and clamped by the last word, none under THE COVENANT'S PATIENCE; THE SURPLUS banked from what the cap turns
//       away; THE GOLD RUN; the respite's budget, its Valkynaz's ten minutes, its 30 s floor and two-minute step; the closing's
//       fifteen seconds and the holds - each at the director, where the old pins held only a law it never called.
//   #18 THE GATHER WHOLE - a gather begun before the wait ends runs its eight seconds; the pull's hold needs no bound.
//   #3  THE EARNER (section 16.1) - ACTIVE in a hall is a part of its damage, of its healing, an errand's mark stood in or a
//       span crossed fairly; a step through a fight hall's door is not.
//   #5  LIFELINE - every rank buys something under the census's 30%.
//   #6  HUNTER'S MARK AND SPOTTER - an arrow from beyond 12 m (section 21).
//   #11 THE DOOR'S REACH - one number, the ring's, no pad.
//   #1  THE WEEK'S SEALING - a Redoubt the service paid already this week turns its circle's Reliquaries into 20 lumen.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validEgOut, validEgIn, EG_RUN_REL_MAX } from '../../../src/net/wire.js';
import { egHallOf, egCountRedoubt, egRedoubtHold, egCountOver, egCountLeft, EG_SEALED_MS, EG_ARRIVE_MAX_MS, EG_GATHER_MS, EG_CLOSING_COUNT_MS, EG_REDOUBT_HOLD_MS,
  EG_COUNT_CAP_MS, EG_LAST_WORD_MS, EG_DOOR_REACH_M, EG_DECREE_BY_KEY, EG_OPEN_ENDS, EG_TOLL_KINDS } from '../../../src/net/eliteGates/egLaw.js';
import * as egLaw from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow, egDown, egWord, egHeal, egCount, egEnd, egCensusDr, egActiveIn, egStateOf, EG_SURPLUS_MS, EG_SURPLUS_MAX, EG_GOLD_RUN_MS,
  EG_RESPITE_BUDGET_MS, EG_RESPITE_VALK_MS, EG_RESPITE_STEP_MS, EG_ACTIVE_SHARE, EG_ERRAND_STAND_MS, EG_ERRAND_MARKS, EG_REL_LUMEN, EG_TOUCH_M } from '../../../src/net/eliteGates/egBrain.js';
import { egRaise, egAim, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { healRef, HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { egFightView } from '../../../src/net/eliteGates/egWalkGraph.js';
import { EG_VESTIGES, EG_MASTERIES, EG_DR_MAX, EG_FAR_M } from '../../../src/net/eliteGates/egVestige.js';
import { EG_ASK_MS } from '../../../src/net/eliteGates/egRun.js';
import { EG_CLOSING_RING } from '../../../src/world/eliteGates/egLights.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1, 5, 7]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LINE = { depth: 1, perS: 0.05 };
const MIN = 60_000;
const vId = (key) => EG_VESTIGES.find((V) => V.key === key).id;
const SPOTTER = EG_MASTERIES.find((M) => M.key === 'spotter').id;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** A frame as the wire projects it (its `to` the fan's). */
const wire = (f) => { const { to: _to, ...rest } = f; return validEgOut(JSON.parse(JSON.stringify(rest))); };

/**
 * A breach of `n` on `seed` (its Proclamation cleared, so the decrees are the test's), every member admitted, standing on
 * hall `h`'s arrival plate a beat after its pull, the count running thirty minutes from its first wake. `step(ms)` beats the
 * director over each living member's place (`put` moves one, the hall's frame; `plate` back to the arrival plate); every
 * frame held to the wire (`bad` counts the refused).
 */
function breach(n, h, seed = 12345) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = '';
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 30 * MIN, at: 0 }; B.pulledAt = now; B.su = now + EG_ARRIVE_MAX_MS;
  const pos = {};
  const spec = () => egHallOf(seed, B.h, 0);
  const plate = (sub) => { pos[sub] = { x: spec().arrive.x + Number(sub.slice(5)) * 0.5, z: spec().arrive.z }; };
  for (const [sub] of co) plate(sub);
  const frames = [];
  let bad = 0;
  const step = (ms = 250) => {
    now += ms;
    const sp = spec();
    const o = egStep(B, now, co.filter(([sub]) => B.mem[sub].alive && pos[sub]).map(([sub]) => ({ sub, sx: sp.x0 + pos[sub].x, z: pos[sub].z, dead: false, at: now })), rng);
    for (const f of o) if (!wire(f)) bad++;
    frames.push(...o);
    return o;
  };
  const put = (sub, x, z) => { pos[sub] = { x, z }; };
  const away = (sub) => { delete pos[sub]; };
  const toTrial = () => { for (let k = 0; k < 400 && B.sg !== 'trial'; k++) step(); assert.equal(B.sg, 'trial', `hall ${B.h} woke`); };
  return { B, co, subs: co.map(([sub]) => sub), pos, plate, put, away, step, toTrial, frames, rng, spec, bad: () => bad, now: () => now, tick: (ms) => (now += ms) };
}
/** A Court's lord fallen at the next beat (its fight's own flag - net/eliteGates/egLords.js egLordsFell): the Redoubt. */
const fell = (S) => { S.B.F.mem.lordsFell = 1; return S.step(); };

// ── #2: THE COUNT'S ONE LAW ──────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III #2 THE REDOUBT\'S TIME, THE DIRECTOR\'S (section 6.2: `remaining = min(remaining + 15 min, the 30 min cap, the last word)`; net/eliteGates/egLaw.js egCountRedoubt, egRedoubtHold): a Court\'s fall gives fifteen minutes, held through the rest - twenty and fifteen are thirty in hand, never past the last word; under the Covenant\'s Press ten (rank II five); under THE COVENANT\'S PATIENCE none, the count held; the `rd` word says the gain the director took, the one law\'s own (mutants: the cap gone; the last word gone; the Press ignored; the Covenant paid; the law\'s hold unread)', () => {
  const at = (left, set = () => {}) => {
    const S = breach(2, 5);
    S.toTrial();
    set(S);
    S.B.cnt = { left, at: 0 };
    const before = egCountLeft(S.B.cnt, S.now() + 250);
    const out = fell(S);
    const r = out.find((f) => f.k === 'rd');
    assert.ok(r, 'the Redoubt said');
    assert.equal(S.B.sg, 'rest');
    assert.equal(S.B.cnt.at, 0, 'the count held through the rest');
    assert.equal(r.g, S.B.cnt.left - before, 'the gain said is the gain taken');
    return { S, r, left: S.B.cnt.left, before };
  };
  assert.deepEqual([EG_REDOUBT_HOLD_MS, EG_COUNT_CAP_MS], [15 * MIN, 30 * MIN]);
  assert.equal(at(10 * MIN).left, 25 * MIN, 'fifteen minutes');
  // a count running in the Court (as a trial runs it) is held at the fall, its fifteen minutes on what it had left
  const T = breach(2, 5);
  T.toTrial();
  T.B.cnt = { left: 10 * MIN, at: T.now() };
  const g = fell(T).find((f) => f.k === 'rd').g;
  assert.deepEqual([T.B.cnt.at, T.B.cnt.left, g], [0, 25 * MIN - 250, 15 * MIN], 'running, then held through the rest');
  assert.equal(at(20 * MIN).left, 30 * MIN, 'twenty and fifteen is thirty in hand at most');
  // the last word: three minutes of it left, the gain is three
  const lw = at(5 * MIN, (S) => { S.B.op = S.now() + 250 + 3 * MIN - EG_LAST_WORD_MS; });
  assert.equal(lw.left, 3 * MIN, 'never past the last word');
  assert.equal(lw.r.g, -2 * MIN, 'the last word clamps it below the count held');
  // THE COVENANT'S PRESS (section 14): ten minutes, five at its rank II
  const press = EG_DECREE_BY_KEY.press.id;
  assert.equal(at(5 * MIN, (S) => { S.B.dc = [[press, 1]]; }).left, 15 * MIN, 'the Press: ten');
  assert.equal(at(5 * MIN, (S) => { S.B.dc = [[press, 2]]; }).left, 10 * MIN, 'the Press II: five');
  assert.deepEqual([egRedoubtHold(0), egRedoubtHold(1), egRedoubtHold(2)], [15 * MIN, 10 * MIN, 5 * MIN]);
  // THE COVENANT'S PATIENCE: no time
  const cov = at(4 * MIN, (S) => { S.B.covenant = 1; });
  assert.deepEqual([cov.left, cov.r.g, cov.r.cov], [4 * MIN, 0, 1], 'the Covenant pays no time');
  // the one law: the director's count is egCountRedoubt's for the same count, hold and last word
  for (const [left, rank] of [[3 * MIN, 0], [18 * MIN, 0], [12 * MIN, 1], [29 * MIN, 2]]) {
    const { left: got, before } = at(left, (S) => { S.B.dc = rank ? [[press, rank]] : []; });
    assert.equal(got, egCountRedoubt({ left: before, at: 0 }, 0, EG_LAST_WORD_MS, egRedoubtHold(rank)).left, `the law's (${left / MIN} min, rank ${rank})`);
  }
});

test('AUDIT EG III #2 THE SURPLUS (section 6.2): what the cap turns away from a Redoubt is banked - every EG_SURPLUS_MS (five minutes) of it a Surplus, at most EG_SURPLUS_MAX (three) held, the rest kept toward the next; four minutes turned away buy none yet (mutants: the Surplus never banked; its five minutes; its three)', () => {
  assert.deepEqual([EG_SURPLUS_MS, EG_SURPLUS_MAX], [5 * MIN, 3]);
  const S = breach(2, 5);
  S.toTrial();
  S.B.cnt = { left: 20 * MIN, at: 0 };
  fell(S);
  assert.deepEqual([S.B.sur, S.B.surAcc], [1, 0], 'five minutes turned away: a Surplus');
  const T = breach(2, 5);
  T.toTrial();
  T.B.cnt = { left: 19 * MIN, at: 0 };
  fell(T);
  assert.deepEqual([T.B.sur, T.B.surAcc], [0, 4 * MIN], 'four minutes: none yet, kept');
  const V = breach(2, 5);
  V.toTrial();
  V.B.cnt = { left: 22 * MIN, at: 0 };
  fell(V);
  assert.deepEqual([V.B.sur, V.B.surAcc], [1, 2 * MIN], 'seven minutes: a Surplus, and two kept toward the next');
  const U = breach(2, 5);
  U.toTrial();
  U.B.sur = EG_SURPLUS_MAX; U.B.surAcc = 0;
  U.B.cnt = { left: 30 * MIN, at: 0 };
  fell(U);
  assert.deepEqual([U.B.sur, U.B.surAcc], [EG_SURPLUS_MAX, 15 * MIN], 'three held: none more, the time kept');
  assert.equal(egCountOver({ left: 20 * MIN, at: 0 }, 0, 15 * MIN), 5 * MIN);
});

test('AUDIT EG III #2 THE GOLD RUN (section 8.2): every living member across a span before the closing\'s fifteenth second - a minute more on the count, past the cap toward a Surplus; after the fifteenth second none; a company of one none (mutants: the run\'s minute halved; no gain; at any time; a company of one)', () => {
  assert.equal(EG_GOLD_RUN_MS, MIN);
  const run = ({ n = 2, since = 5000, left = 10 * MIN } = {}) => {
    const S = breach(n, 2);
    assert.equal(S.spec().kind, 'span');
    S.toTrial();
    for (const sub of S.subs) S.put(sub, S.spec().end.x, S.spec().end.z);
    S.B.sg = 'closing'; S.B.dn = S.now() - since; S.B.su = S.now() + 40_000;
    S.B.cnt = { left, at: 0 };
    for (const sub of S.subs) S.B.mem[sub].downH = S.B.h;
    const out = S.step();
    return { S, said: out.some((f) => f.k === 'esay' && f.w === 'goldrun') };
  };
  const a = run();
  assert.deepEqual([a.said, a.S.B.gold, a.S.B.cnt.left], [true, 1, 11 * MIN], 'a minute more');
  const late = run({ since: EG_CLOSING_COUNT_MS + 1 });
  assert.deepEqual([late.said, late.S.B.cnt.left], [false, 10 * MIN], 'after the fifteenth second: none');
  const solo = run({ n: 1 });
  assert.deepEqual([solo.said, solo.S.B.cnt.left], [false, 10 * MIN], 'a company of one is exempt');
  const capped = run({ left: 29.5 * MIN });
  assert.deepEqual([capped.S.B.cnt.left, capped.S.B.surAcc], [30 * MIN, 0.5 * MIN], 'past the cap: toward a Surplus');
});

test('AUDIT EG III #2 THE RESPITE (sections 6.2 and 16.4): EG_RESPITE_BUDGET_MS (fifteen minutes) a breach, EG_RESPITE_VALK_MS (ten) more at each Valkynaz\'s Redoubt; offered at the rest while 30 s of it are left; a yes holds the rest two minutes more (or what is left), out of the budget (mutants: the budget; the Valkynaz\'s ten; the two-minute step; the 30 s floor)', () => {
  assert.deepEqual([EG_RESPITE_BUDGET_MS, EG_RESPITE_VALK_MS, EG_RESPITE_STEP_MS], [15 * MIN, 10 * MIN, 2 * MIN]);
  const rest = ({ h = 5, resp = null } = {}) => {
    const S = breach(2, h);
    S.toTrial();
    assert.equal(S.B.resp, EG_RESPITE_BUDGET_MS, 'the breach\'s budget');
    fell(S);
    if (resp != null) S.B.resp = resp;
    const r0 = S.B.resp;
    for (let k = 0; k < 40 && !(S.B.asks ?? []).some((a) => a.q === 'ready'); k++) S.step();
    return { S, r0, offered: S.B.asks.some((a) => a.q === 'respite') };
  };
  assert.equal(rest({ h: 25 }).r0, EG_RESPITE_BUDGET_MS + EG_RESPITE_VALK_MS, 'a Valkynaz\'s Redoubt adds ten minutes');
  assert.equal(rest({ h: 5 }).r0, EG_RESPITE_BUDGET_MS, 'another adds none');
  assert.equal(rest({ resp: 29_999 }).offered, false, 'under 30 s: not offered');
  const yes = (resp) => {
    const { S, offered } = rest({ resp });
    assert.ok(offered, 'offered');
    const su = S.B.su;
    for (const sub of S.subs) egWord(S.B, sub, { k: 'vote', q: 'respite', y: 1 }, null, S.now(), S.rng);
    for (let k = 0; k < (EG_ASK_MS + 500) / 250 && S.B.resp === resp; k++) S.step();
    return [S.B.su - su, S.B.resp];
  };
  assert.deepEqual(yes(10 * MIN), [2 * MIN, 8 * MIN], 'two minutes, out of the budget');
  assert.deepEqual(yes(30_000), [30_000, 0], 'what is left');
});

test('AUDIT EG III #2 THE CLOSING AND THE HOLDS (section 6.2): the closing runs the count its first EG_CLOSING_COUNT_MS (15 s), then holds it - a straggler costs 15 s, not 45; the pull holds it to the wake, which runs it (mutants: the closing\'s hold deleted; the pull\'s hold)', () => {
  assert.equal(EG_CLOSING_COUNT_MS, 15_000);
  const S = breach(2, 1);
  S.toTrial();
  assert.ok(S.B.cnt.at > 0, 'a trial runs it');
  S.B.sg = 'closing'; S.B.dn = S.now(); S.B.su = S.now() + 20_000;
  const left0 = egCountLeft(S.B.cnt, S.now());
  for (let k = 0; k < (EG_CLOSING_COUNT_MS - 250) / 250; k++) S.step();
  assert.ok(S.B.cnt.at > 0, 'its first fifteen seconds run');
  S.step(); S.step();
  assert.equal(S.B.cnt.at, 0, 'then it holds');
  assert.equal(S.B.cnt.left, left0 - EG_CLOSING_COUNT_MS, 'fifteen seconds spent');
  for (let k = 0; k < 40 && S.B.sg === 'closing'; k++) S.step();
  assert.equal(S.B.sg, 'arrive', 'the pull');
  assert.equal(S.B.cnt.at, 0, 'held from the pull');
  S.toTrial();
  assert.equal(S.B.cnt.at, S.B.hw, 'the wake runs it');
  // the company through the door in the closing's first seconds: the pull itself holds the count
  S.B.sg = 'closing'; S.B.dn = S.now(); S.B.su = S.now() + 20_000;
  for (const sub of S.subs) S.B.mem[sub].downH = S.B.h;
  S.step();
  assert.equal(S.B.sg, 'arrive', 'every member down: pulled at once');
  assert.equal(S.B.cnt.at, 0, 'the pull holds it');
});

// ── #18: THE GATHER WHOLE ────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III #18 THE GATHER WHOLE (section 7): the hall wakes EG_GATHER_MS (8 s) after the last `here` - a gather begun at the 25th second of the wait runs to the 33rd, never cut at the wait\'s 30th; a member still missing at the 30th, the wait wakes it then; the count held from the pull to the wake, at most the two together (mutants: the gather cut by the wait; the wait never waking a missing member)', () => {
  const S = breach(2, 2);
  const pulled = S.B.pulledAt;
  S.away('acct-1');
  for (let k = 0; k < 100 && S.now() < pulled + 25_000; k++) S.step();
  assert.equal(S.B.sg, 'arrive');
  S.plate('acct-1');
  S.step();
  assert.equal(S.B.gatherAt, pulled + 25_250, 'every member here: the gather begins');
  for (let k = 0; k < 100 && S.now() < pulled + EG_ARRIVE_MAX_MS + 250; k++) S.step();
  assert.equal(S.B.sg, 'arrive', 'the wait\'s thirtieth second cuts no gather');
  assert.equal(S.B.cnt.at, 0, 'the count held');
  for (let k = 0; k < 100 && S.B.sg === 'arrive'; k++) S.step();
  assert.equal(S.B.hw, pulled + 25_250 + EG_GATHER_MS, 'its eight seconds whole');
  assert.ok(S.B.hw - pulled <= EG_ARRIVE_MAX_MS + EG_GATHER_MS);
  const M = breach(2, 2);
  M.away('acct-1');
  for (let k = 0; k < 200 && M.B.sg === 'arrive'; k++) M.step();
  assert.equal(M.B.hw, M.B.pulledAt + EG_ARRIVE_MAX_MS, 'a member missing: the wait wakes the hall');
  assert.equal(egLaw.EG_STAIR_HOLD_MS, undefined, 'no stair hold: the wait and the gather bound the hold');
});

// ── #3: THE EARNER ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III #3 ACTIVE IN A HALL, THE LAW (section 16.1): at least 1/(8n) of the hall\'s damage, or of what the company took healed in others, or EG_ERRAND_STAND_MS in an errand\'s mark, or a span crossed fairly - each on its own (mutants: the share\'s eighth; a blow of none counted; a heal of nothing taken counted; the errand unread; the crossing unread)', () => {
  assert.deepEqual([EG_ACTIVE_SHARE, EG_ERRAND_STAND_MS], [1 / 8, 1500]);
  const hall = { h: 7, n: 3, dealt: 240, took: 0.6, crossed: false };
  assert.equal(egActiveIn({ dh: 10 }, hall), true, 'a twenty-fourth of the hall\'s damage');
  assert.equal(egActiveIn({ dh: 9.99 }, hall), false, 'a hair under it');
  assert.equal(egActiveIn({ dh: 0 }, { ...hall, dealt: 0 }), false, 'nothing dealt in a hall of nothing dealt');
  assert.equal(egActiveIn({ hh: 0.025 }, hall), true, 'a twenty-fourth of what the company took, healed');
  assert.equal(egActiveIn({ hh: 0.0249 }, hall), false);
  assert.equal(egActiveIn({ hh: 0.5 }, { ...hall, took: 0 }), false, 'a heal where nobody was hurt is no part');
  assert.equal(egActiveIn({ erH: 7 }, hall), true, 'an errand\'s mark stood in this hall');
  assert.equal(egActiveIn({ erH: 6 }, hall), false, 'another hall\'s');
  assert.equal(egActiveIn({}, { ...hall, crossed: true }), true, 'a crossing');
  assert.equal(egActiveIn({ downH: 7 }, hall), false, 'a step through the door alone is not activity');
});

/** A hall's part counted for each member at its pull: the closing ended now, the director's next beat pulls the company. */
const pullNow = (S) => { const h = S.B.h; S.B.sg = 'closing'; S.B.dn = S.now() - 45_000; S.B.su = S.now() + 250; S.step(); assert.equal(S.B.h, h + 1, 'pulled'); };

test('AUDIT EG III #3 THE PULL COUNTS EACH PART (net/eliteGates/egBrain.js countPart): in a fight hall the member who dealt a twenty-fourth of three members\' damage counts, a hair less does not, and the one who only stepped through the door does not (AUDIT EG0 A6\'s leech); in a span the member who stepped through its door - a fair trail\'s step - counts and the one who never crossed does not; the hall\'s measures begin again (mutants: the door counted; the crossing unread; the measures kept)', () => {
  const S = breach(3, 1);
  S.toTrial();
  const [a, b, c] = S.subs.map((s) => S.B.mem[s]);
  a.dh = 92; b.dh = 4; c.downH = S.B.h;
  pullNow(S);
  assert.deepEqual([a.act, b.act, c.act], [1, 1, 0], 'the leech stepping through a fight hall\'s door earns no part');
  assert.deepEqual([a.dh, b.dh], [0, 0], 'the hall\'s damage begun again');
  const T = breach(3, 1);
  T.toTrial();
  T.B.mem['acct-0'].dh = 92; T.B.mem['acct-1'].dh = 3.99;
  pullNow(T);
  assert.equal(T.B.mem['acct-1'].act, 0, 'a hair under a twenty-fourth');
  const P = breach(2, 2);
  assert.ok(EG_TOLL_KINDS.includes(P.spec().kind), 'a crossed hall');
  P.toTrial();
  P.put('acct-0', P.spec().end.x, P.spec().end.z);
  P.step();
  assert.equal(P.B.sg, 'closing', 'the first across opens the door');
  assert.equal(egDown(P.B, 'acct-0', P.B.h, { sx: P.spec().x0 + P.spec().end.x, z: P.spec().end.z }, P.now()), true);
  pullNow(P);
  assert.deepEqual([P.B.mem['acct-0'].act, P.B.mem['acct-1'].act], [1, 0], 'the crossing counts; standing at the plate does not');
});

test('AUDIT EG III #3 AN ERRAND\'S MARK (section 16.1: "stood 1.5 s in an errand\'s mark"): a member on a Rampart\'s winch plate 1.5 s unbroken counts the hall, 1.25 s does not, and one step off begins it again; the stood-on errands\' objects are the lords\' and the halls\' own (mutants: the mark\'s 1.5 s; the step off unread; the plate\'s reach)', () => {
  assert.deepEqual([...EG_ERRAND_MARKS], ['rune', 'gem', 'isle', 'umbra', 'relic', 'stone', 'engine']);
  const S = breach(2, 31);
  assert.deepEqual([S.spec().kind, S.spec().variant], ['rampart', 'winch']);
  S.toTrial();
  const w = S.spec().spots.winch[0];
  S.put('acct-0', w.x + EG_TOUCH_M - 0.05, w.z);
  S.put('acct-1', w.x, w.z);
  for (let k = 0; k < 6; k++) S.step();   // stood from the first beat: 1.25 s at the sixth
  assert.notEqual(S.B.mem['acct-1'].erH, S.B.h, '1.25 s: not yet');
  S.put('acct-1', w.x + EG_TOUCH_M + 0.5, w.z);   // a step off
  S.step();
  S.put('acct-1', w.x, w.z);
  for (let k = 0; k < 6; k++) S.step();
  assert.equal(S.B.mem['acct-0'].erH, S.B.h, 'the plate\'s edge, 1.5 s unbroken');
  assert.notEqual(S.B.mem['acct-1'].erH, S.B.h, 'a step off begins it again');
  S.step();
  assert.equal(S.B.mem['acct-1'].erH, S.B.h, 'and 1.5 s after it stepped back on, it counts');
  pullNow(S);
  assert.deepEqual([S.B.mem['acct-0'].act, S.B.mem['acct-1'].act], [1, 1]);
});

test('AUDIT EG III #3 A HEALER\'S PART (section 16.1: "healed others for at least 1/(8n) of what the company took"): a companion\'s heal believed (egHeal) is its healer\'s part in the hall as a share of its receiver\'s body; what the company took is the census\'s (egCount); a healer whose heals reach a sixteenth of it counts, one whose heals reach less does not (mutants: the heal unkept; the census\'s share unkept)', () => {
  const S = breach(2, 1);
  S.toTrial();
  const spec = S.spec(), f = spec.fl[0], [me, healer] = S.subs;
  const t = S.now() + 100;
  egAim(S.B.F, spec, { o: 0, s: [shDisc(f.x, f.z, 2)], at: t, wu: 1500, p: 0.4, b: 0, el: null, nm: 'Test Blow' }, [], t - 1500, []);
  egCount(S.B, t + 900, [{ sub: me, tr: [[t - 300, f.x, 0, f.z, S.B.h], [t + 100, f.x, 0, f.z, S.B.h]] }, { sub: healer, tr: [[t - 300, f.x + 20, 0, f.z, S.B.h], [t + 100, f.x + 20, 0, f.z, S.B.h]] }], LINE);
  const took = S.B.ctk;
  assert.ok(Math.abs(took - 0.4) < 1e-9, `what the company took (${took})`);
  const pts = (share) => share * healRef(S.B.mem[me].lv);
  // PIN MOVED (AUDIT EG IV, lane3 #3): egHeal was asked with the receiver's word alone - a healer's part is now corroborated
  // by the room's relayed cast (`cast`, its seventh: server/src/index.js _egCastSaw); here the room saw the healer cast
  const saw = (by) => by === healer;
  assert.ok(egHeal(S.B, me, [[healer, pts(took / 16)]], t + 1000, LINE, undefined, saw) > 0, 'believed');
  assert.ok(Math.abs(S.B.mem[healer].hh - took / 16) < 1e-9, 'its part a share of the receiver\'s body');
  pullNow(S);
  assert.equal(S.B.mem[healer].act, 1, 'a sixteenth of what was taken: a part');
  const T = breach(2, 1);
  T.toTrial();
  T.B.ctk = 0.4;
  egHeal(T.B, 'acct-0', [['acct-1', 0.4 / 17 * healRef(40)]], T.now(), LINE, undefined, () => true);   // PIN MOVED (AUDIT EG IV): the room saw the cast
  pullNow(T);
  assert.equal(T.B.mem['acct-1'].act, 0, 'a seventeenth: none');
});

/**
 * One circle of seed 12345 played by a company of two (net/egFull's auto-player, cut down): `acct-0` fights where a player
 * would, stands at each end plate and steps through each door; `acct-1` THE LEECH stands on each hall's arrival plate through
 * its trial and steps through its door in the closing - pulled from hall to hall. Answers the record at the Redoubt.
 */
function circle() {
  const S = breach(2, 1);
  S.B.su = S.now() + EG_ARRIVE_MAX_MS;
  let q = 1;
  for (let k = 0; k < 40_000 && !(S.B.sg === 'rest' || S.B.end); k++) {
    const spec = S.spec(), F = S.B.F;
    const live = F ? F.bodies.filter((b) => b.hp > 0 && !(b.fl & (2 | 16 | 128))) : [];
    const tgt = live.filter((b) => b.role === 1)[0] ?? live[0];
    if (S.B.sg === 'arrive') { S.plate('acct-0'); S.plate('acct-1'); }
    else if (S.B.sg === 'trial') {
      S.plate('acct-1');
      if (spec.kind === 'span' || spec.kind === 'brink') S.put('acct-0', spec.end.x, spec.end.z);
      else if (spec.kind === 'court' && F && !F.bodies.some((b) => b.role === 0 && b.up2)) S.put('acct-0', spec.ring.x, spec.ring.z);
      else if (tgt) { const yw = tgt.yaw ?? 0; S.put('acct-0', tgt.x - Math.sin(yw) * 1.5, tgt.z - Math.cos(yw) * 1.5); }
    } else if (S.B.sg === 'closing') { S.put('acct-0', spec.end.x, spec.end.z); S.put('acct-1', spec.end.x + 0.5, spec.end.z); }
    S.step();
    if (S.B.sg === 'trial' && tgt && S.B.F) { const p = S.pos['acct-0']; egBlow(S.B, 'acct-0', { k: 'hit', i: tgt.i, q: q++, d: 200, r: 1 }, { sx: S.spec().x0 + p.x, z: p.z }, S.now()); }
    if (S.B.sg === 'closing') for (const sub of S.subs) { const p = S.pos[sub]; egDown(S.B, sub, S.B.h, { sx: S.spec().x0 + p.x, z: p.z }, S.now()); }
  }
  return S;
}

test('AUDIT EG III #3 THE LEECH (AUDIT EG0 A6; section 16.1): a member who only stands on each arrival plate and steps through each door is pulled through a whole circle and earns no Redoubt - its fight halls give it nothing, its crossings two parts of the three; the member who fought earns it (mutants: a step through a fight hall\'s door counted)', () => {
  const S = circle();
  assert.equal(S.B.sg, 'rest', `the circle's Redoubt taken (hall ${S.B.h}, ${S.B.end ?? ''})`);
  const kinds = Array.from({ length: 5 }, (_, i) => egHallOf(12345, i + 1, 0).kind);
  const crossed = kinds.filter((k) => EG_TOLL_KINDS.includes(k)).length;
  assert.ok(crossed < 3, `circle 1 crosses ${crossed} halls`);
  const ws = S.B.owe.filter((o) => o.claims.q === 'w').map((o) => o.sub);
  assert.deepEqual(ws, ['acct-0'], 'the fighter earns; the leech nothing');
  assert.equal(S.bad(), 0);
});

// ── #5: LIFELINE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III #5 LIFELINE, EVERY RANK UNDER THE CAP (section 15: every Vestige\'s damage reduction together at most 30%): 20 / 25 / 30% - each rank\'s window spares a blow more than the rank below it in the census, III at the 30% cap and never past it; the old 40% bought nothing over II\'s 30% (mutants: III past the cap; II at it)', () => {
  const L = EG_VESTIGES.find((V) => V.key === 'lifeline');
  assert.deepEqual(L.v, [0.2, 0.25, 0.3]);
  assert.equal(EG_DR_MAX, 0.3);
  const S = breach(3, 1);
  S.toTrial();
  const spec = S.spec(), view = egFightView(spec), f = spec.fl[0], [me] = S.subs, t = S.now();
  const far = S.subs.map((s, i) => ({ sub: s, tr: [[t - 600, f.x + i * 8 - 8, 0, f.z, S.B.h], [t, f.x + i * 8 - 8, 0, f.z, S.B.h]] }));
  const dr = (v) => { S.B.mem[me].ll = [[t - 1000, t + 2000, v]]; return egCensusDr(S.B, S.B.F, view, { sub: me, at: t, o: 0 }, far); };
  const ranks = L.v.map(dr);
  assert.deepEqual(ranks, [0.2, 0.25, 0.3], 'each rank its own share');
  assert.ok(ranks[0] < ranks[1] && ranks[1] < ranks[2] && ranks[2] <= EG_DR_MAX, 'every rank buys something under the cap');
  assert.equal(ranks[2], EG_DR_MAX, 'III at the cap');
});

// ── #6: HUNTER'S MARK AND SPOTTER ────────────────────────────────────────────────────────────────────────────────────────
/** The Court of seed 12345's Hall 5, woken, its legion cleared, an add of 500 at (0, 42.5); `blow(sub, r, [x, z])` a blow of
 *  `sub`'s of kind `r` on it from there. */
function markCourt(vs, mast = -1) {
  const S = breach(2, 5);
  S.toTrial();
  S.B.F.bodies = S.B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  S.B.mem['acct-0'].vs = vs; S.B.mem['acct-0'].mast = mast;
  const [A] = egRaise(S.B.F, EG_ROLE.add, 0, [[0, 42.5]], 500, S.now(), []);
  let q = 1;
  const blow = (r, [x, z]) => egBlow(S.B, 'acct-0', { k: 'hit', i: A.i, q: q++, d: 20, r }, { sx: S.spec().x0 + x, y: 0, z }, S.tick(300));
  return { S, A, blow };
}

test('AUDIT EG III #6 HUNTER\'S MARK AND SPOTTER READ AN ARROW FROM BEYOND 12 M (section 21: "need more than 12 m between the poses, where a forged kind gains nothing a real one would not"; section 15): an arrow from 13 m marks the foe, at 12 m or within none, a melee blow or a spell none - Hunter\'s Mark its rank\'s share, Spotter its 10%; the arrow\'s own blow lands either way (mutants: the distance unread; the kind unread; 12 m itself beyond)', () => {
  assert.equal(EG_FAR_M, 12);
  for (const [name, vs, mast, x] of [['Hunter\'s Mark', [[vId('huntersmark'), 2]], -1, 0.08], ['Spotter', [], SPOTTER, 0.1]]) {
    for (const [why, r, at] of [['an arrow from 1.5 m', HIT_KINDS.Shaft, [0, 41]], ['an arrow from 12 m', HIT_KINDS.Shaft, [0, 30.5]], ['a melee blow', HIT_KINDS.Melee, [0, 41]], ['a spell from 13 m', HIT_KINDS.Spell, [0, 29.5]]]) {
      const { A, blow } = markCourt(vs, mast);
      blow(r, at);
      assert.ok(A.hp < 500, `${name}: ${why} lands`);
      assert.equal(A.marked, undefined, `${name}: ${why} marks nothing`);
    }
    const { A, blow } = markCourt(vs, mast);
    blow(HIT_KINDS.Shaft, [0, 29.5]);
    assert.equal(A.marked?.x, x, `${name}: an arrow from 13 m marks it`);
    assert.equal(A.marked.by, 'acct-0');
  }
});

// ── #11: THE DOOR'S REACH ────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III #11 THE DOOR\'S REACH, ONE NUMBER (section 7: `down` "accepted only within EG_DOOR_REACH_M 3 m of it"; EG-ZE\'s closing ring): the relay hears a step through the door within 3 m of it and not at 3.2 m - the ring\'s own radius; no call of the door\'s law in src passes a pad, the screen\'s `down` among them (mutants: the relay\'s 2 m pad; the screen\'s 1 m)', () => {
  assert.equal(EG_DOOR_REACH_M, 3);
  assert.equal(EG_CLOSING_RING.r, EG_DOOR_REACH_M, 'the ring is the reach');
  const S = breach(2, 1);
  S.toTrial();
  const spec = S.spec();
  S.B.sg = 'closing'; S.B.dn = S.now(); S.B.su = S.now() + 20_000;
  const at = (d) => ({ sx: spec.x0 + spec.end.x + d, z: spec.end.z });
  assert.equal(egDown(S.B, 'acct-0', S.B.h, at(3.2), S.now()), false, '3.2 m: not at the door');
  assert.equal(egDown(S.B, 'acct-0', S.B.h, at(2.95), S.now()), true, 'inside the ring');
  const calls = [];
  const walk = (dir) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (/\.m?js$/.test(n)) for (const m of readFileSync(p, 'utf8').matchAll(/egAtDoor\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) calls.push([p, m[1]]); } };
  walk(new URL('../../../src', import.meta.url).pathname);
  // PIN MOVED (THE ASCENT - HEIGHT, LAW 9; Elite-Gates-Ascent.md section 2): the door's law takes the body's FEET after its
  // plan (`egAtDoor(spec, x, z, y)` - a hall that judges by height asks the door's own floor; the laws before ignore it, so
  // their every answer is the same), its pad after them, and still no caller passes a pad: three arguments, or a fourth that
  // is a height (a member's, a pose's, my own feet's `.y`, or the trail's `y`) - never a fifth
  const used = calls.filter(([, a]) => !/^spec, x, z, y = NaN, pad = 0$/.test(a));
  assert.ok(used.length >= 5, `the door's law is called (${used.length})`);
  const args = (a) => { let depth = 0, n = 1; for (const ch of a) { if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === ',' && depth === 0) n++; } return n; };
  const last = (a) => { let depth = 0, at = 0; for (let i = 0; i < a.length; i++) { const ch = a[i]; if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === ',' && depth === 0) at = i + 1; } return a.slice(at).trim(); };
  const feet = (a) => /(?:^|\.)y$/.test(last(a));
  for (const [p, a] of used) assert.ok(args(a) === 3 || (args(a) === 4 && feet(a)), `${p}: egAtDoor(${a}) - no pad`);
  assert.ok(used.some(([p]) => p.endsWith('scenes/eliteGates/egClient.js')), 'the screen\'s `down` among them');
});

// ── #1: THE WEEK'S SEALING ───────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III #1 A REDOUBT ALREADY PAID THIS WEEK SEALS NONE (section 16.3): the member\'s word that the service answered its Redoubt paid already this week (`wkpaid`, the wire\'s) turns every Reliquary of that circle in its satchel into EG_REL_LUMEN (20) lumen - its run said; another circle\'s kept; a circle the breach never took, or none held, nothing; said again, nothing more; the end receipt opens only what is left (mutants: the lumen; the circle unread; the circle the breach never took believed; the run unsaid)', () => {
  assert.equal(EG_REL_LUMEN, 20);
  assert.deepEqual(validEgIn({ k: 'wkpaid', w: 3 }), { k: 'wkpaid', w: 3 });
  assert.equal(validEgIn({ k: 'wkpaid', w: 0 }), null);
  assert.equal(validEgIn({ k: 'wkpaid' }), null);
  const S = breach(2, 5);
  S.toTrial();
  fell(S);
  const m = S.B.mem['acct-0'];
  assert.deepEqual(m.rel, [1], 'a Reliquary sealed by the Redoubt');
  m.rel = [1, 1, 2]; m.lumen = 5; S.B.rd = 2;
  const out = egWord(S.B, 'acct-0', validEgIn({ k: 'wkpaid', w: 1 }), null, S.now(), S.rng);
  assert.deepEqual([m.rel, m.lumen], [[2], 5 + 2 * EG_REL_LUMEN], 'two of circle 1: forty lumen, circle 2\'s kept');
  const run = out.find((f) => f.k === 'run');
  assert.ok(run && wire(run), 'the run said');
  assert.deepEqual([run.r[1], run.r[2], run.r[8]], [1, 45, [2]], 'its count, its lumen and its circles');
  assert.deepEqual(egWord(S.B, 'acct-0', { k: 'wkpaid', w: 1 }, null, S.now(), S.rng), [], 'said again: nothing');
  assert.deepEqual(egWord(S.B, 'acct-0', { k: 'wkpaid', w: 3 }, null, S.now(), S.rng), [], 'a circle the breach never took');
  m.rel = [2, 3];
  assert.deepEqual(egWord(S.B, 'acct-0', { k: 'wkpaid', w: 3 }, null, S.now(), S.rng), [], 'nor one it took past its last Redoubt');
  assert.deepEqual(egWord(S.B, 'acct-1', { k: 'wkpaid', w: 2 }, null, S.now(), S.rng), [], 'none held: nothing');
  m.rel = [2];
  egEnd(S.B, 'home', S.now(), []);
  assert.deepEqual(S.B.owe.find((o) => o.sub === 'acct-0' && o.claims.q === 'x').claims.rl, [2], 'the end opens what is left');
});

test('AUDIT EG III #1 THE RUN\'S CIRCLES AND THE GOOD ENDS (sections 16.3 and 27.6): a run\'s row carries each Reliquary\'s circle (`r[8]`, the newest EG_RUN_REL_MAX) on the state and the wire, an older eight-field row still read; the way home, THE SEAL, the last word and a void open the Reliquaries (net/eliteGates/egLaw.js EG_OPEN_ENDS) - a void after the first wake among them; a fall, the tear and a wipe none (mutants: the circles unsaid; a void left out)', () => {
  assert.deepEqual([...EG_OPEN_ENDS], ['home', 'seal', 'last', 'void']);
  assert.equal(EG_RUN_REL_MAX, 64);
  const st = wire({ k: 'run', r: ['acct-0', 2, 0, 0, 0, [], [], -1, [3, 5]] });
  assert.deepEqual(st.r[8], [3, 5]);
  assert.ok(wire({ k: 'run', r: ['acct-0', 2, 0, 0, 0, [], [], -1] }), 'an eight-field row read');
  assert.equal(wire({ k: 'run', r: ['acct-0', 2, 0, 0, 0, [], [], -1, [0]] }), null, 'a circle of nought refused');
  assert.equal(wire({ k: 'run', r: ['acct-0', 2, 0, 0, 0, [], [], -1, Array(65).fill(1)] }), null, 'past the bound refused');
  for (const [why, open] of [['void', true], ['seal', true], ['last', true], ['tear', false], ['wipe', false]]) {
    const S = breach(2, 3);
    S.toTrial();
    for (const sub of S.subs) S.B.mem[sub].rel = [1, 2];
    egEnd(S.B, why, S.now(), []);
    const x = S.B.owe.find((o) => o.sub === 'acct-0' && o.claims.q === 'x').claims;
    assert.deepEqual(x.rl ?? null, open ? [1, 2] : null, `${why}: ${open ? 'opens them' : 'none'}`);
  }
  const S = breach(2, 3);
  S.toTrial();
  S.B.mem['acct-0'].rel = Array.from({ length: 70 }, (_, i) => i + 1);
  const row = wire(egStateOf(S.B, S.now())).ms.find((t) => t[0] === 'acct-0');
  assert.deepEqual([row[1], row[8].length, row[8][0], row[8].at(-1)], [70, 64, 7, 70], 'the state says the newest sixty-four');
});
