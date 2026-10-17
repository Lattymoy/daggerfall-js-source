// AUDIT EG III (2026-10-13; bible/11-Multiplayer/Elite-Gates.md sections 6.1, 12, 15, 17.2, 21 and 23; the legion group's
// findings): THE BLOWS AND THE DIRECTOR'S RULES AS WRITTEN - Sweeping Arc splashing off every melee blow as host hits,
// Spillover carrying a spell's overkill, Counterstroke armed by a lord's blow landing near and its numbers declared once, the
// Binder's raise broken by what lands, No Quarter and Far Watch read by THE PAIR LAW, the Standard's aura by its own numbers,
// a Soul-Pool said in the blow that left it, the Cantrips used anywhere outside a lord's shield, a trial's absence counted from
// its wake, the way home's 'gone', and Lifeline held open only by a heal worth a window. Every fixture is the producers' own:
// the breach and its Court from the director, blows through egBlow, words through egWord, heals through egHeal.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, EG_SEALED_MS, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow, egWord, egHome, egHeal, egCensusDr, egWatchOf, egLifelineMin, EG_LIFELINE_MIN, EG_RD_WINDOW_MS } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ABSENT_TRIAL_MS } from '../../../src/net/eliteGates/egLaw.js';
import { EG_ROLE, EG_FL, egRaise, egAim, egSetFl, egHas, egBodyAt } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, egLegionRaise, egSquad } from '../../../src/net/eliteGates/egLegion.js';
import { egLordsOf, egLordsFell, egLordsWake } from '../../../src/net/eliteGates/egLords.js';
import { egVestigeX, EG_CANTRIPS } from '../../../src/net/eliteGates/egRun.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { EG_V_BY_KEY, EG_M_ID, EG_MASTERIES, EG_SWEEP_M, EG_MARK_MS, EG_COUNTER_MS, EG_COUNTER_X, EG_COUNTER_M, EG_SPILL_M, EG_AURA_EXTRA, EG_AURA_EXTRA_MAX } from '../../../src/net/eliteGates/egVestige.js';
import { HIT_KINDS, HIT_CAP_X, dpsRef, healRef } from '../../../src/net/gate/gateBrain.js';
import { bodyStruck } from '../../../src/net/bossBody.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LINE = { depth: 1, perS: 0.05 };
const vId = (key) => EG_V_BY_KEY[key].id;
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };

/** The Court of seed 12345's Hall 5 (Grath, the Hound - its near disc centred 0, 41, r 11), woken by the director with the
 *  company of three stood on it (`at`), the week's Proclamation `pr`, the strata `strata`, and the legion its beats raised
 *  cleared: `blow` strikes from where a member stands, `step` beats the director with the company standing. */
function court({ at = { 'acct-0': [0, 41], 'acct-1': [-6, 41], 'acct-2': [-6, 46] }, pr = 'pyre', strata = [], clear = true } = {}) {
  const rng = seeded(12345);
  const co = Array.from({ length: 3 }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [], pr });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.strata = [...strata];
  const spec = egHallOf(12345, 5, 0);
  B.h = 5; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  let gone = new Set();
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.filter(([sub]) => !gone.has(sub)).map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  for (let k = 0; k < 200 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial');
  for (const [sub, [x, z]] of Object.entries(at)) pos[sub] = { sx: spec.x0 + x, z };
  step();
  if (clear) B.F.bodies = B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  let q = 1;
  const blow = (sub, i, d, r, [x, z] = at[sub], o = {}) => { now += 300; return egBlow(B, sub, { k: 'hit', i, q: o.q ?? q++, d, r }, { sx: spec.x0 + x, y: 0, z }, now); };
  return { B, spec, pos, frames, step, blow, rng, now: () => now, away: (sub) => gone.add(sub), back: () => { gone = new Set(); } };
}
const adds = (S, pts, hp = 500) => egRaise(S.B.F, EG_ROLE.add, 0, pts, hp, S.now(), []);
/** The Court's lord felled by a member's arrow at its last point, and the Redoubt taken: the rest. */
function fell(S) {
  const lord = egLordsOf(S.B.F)[0];
  lord.hp = 1;
  S.blow('acct-0', lord.i, 50, HIT_KINDS.Shaft);
  assert.ok(egLordsFell(S.B.F), 'the lord fell');
  for (let k = 0; k < 8 && S.B.sg !== 'rest'; k++) S.step();
  assert.equal(S.B.sg, 'rest');
}

// ── THE NUMBERS DECLARED ONCE (lane2 #16, lane2 #4) ──────────────────────────────────────────────────────────────────
test('AUDIT EG III SECTION 15\'S NUMBERS DECLARED ONCE (net/eliteGates/egVestige.js; net/eliteGates/egRun.js and net/eliteGates/egBrain.js import them, never a literal): Sweeping Arc\'s 3 m, a mark\'s 8 s, Counterstroke\'s 0.6 s, x1.4 and 6 m, Spillover\'s 6 m, each Mastery\'s number by its key; the Standard\'s reach its aura\'s 10 m, its stacking the aura law\'s +2% and +6% (mutants: each number; the Standard\'s literal back)', () => {
  assert.deepEqual([EG_SWEEP_M, EG_MARK_MS, EG_COUNTER_MS, EG_COUNTER_X, EG_COUNTER_M, EG_SPILL_M], [3, 8000, 600, 1.4, 6, 6]);
  assert.deepEqual(EG_M_ID, Object.fromEntries(EG_MASTERIES.map((M) => [M.key, M.id])));
  assert.deepEqual([EG_M_ID.immovable, EG_M_ID.counterstroke, EG_M_ID.spotter, EG_M_ID.spillover, EG_M_ID.spirebridge], [100, 101, 102, 103, 104]);
  assert.equal(EG_V_BY_KEY.standard.aura, 10);
  // the Standard's aura on a blow: the strongest within 10 m, +2% for each other holder, +6% at most
  const S = court(), { B } = S;
  const lord = egLordsOf(B.F)[0], add = { role: 1, x: 0, z: 44, hp: 100, max: 100 };
  const std = (r) => [[vId('standard'), r]];
  B.mem['acct-1'].vs = std(3); B.mem['acct-2'].vs = std(1);
  const here = (d1, d2) => [{ sub: 'acct-1', x: d1, z: 41 }, { sub: 'acct-2', x: d2, z: 41 }];
  assert.ok(near(egVestigeX(B, 'acct-0', { x: 0, z: 41 }, add, HIT_KINDS.Melee, S.now(), here(10, 10)).x, 1 + 0.1 + EG_AURA_EXTRA), 'two within 10 m: the strongest and 2%');
  assert.ok(near(egVestigeX(B, 'acct-0', { x: 0, z: 41 }, add, HIT_KINDS.Melee, S.now(), here(10, 10.01)).x, 1.1), 'the other past 10 m');
  assert.ok(EG_AURA_EXTRA_MAX === 0.06 && lord);
});

// ── COUNTERSTROKE (lane1 #17, lane2 #4) ──────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III COUNTERSTROKE (section 15: "a melee blow on a lord within 0.6 s after one of its blows lands within 6 m of you deals x1.4"): a lord\'s blow landing 4 m from its holder - never striking it - arms it at the landing, one 8 m off does not; armed, a melee blow on a lord 0.6 s after takes x1.4, a moment later none, an arrow or an add none, nor a member without the Mastery (mutants: armed only when struck; the 6 m; the 0.6 s; x1.4; the Mastery unread; an arrow counted)', () => {
  const S = court(), { B, spec } = S;
  const lord = egLordsOf(B.F)[0];
  for (const sub of ['acct-0', 'acct-1', 'acct-2']) B.mem[sub].mast = EG_M_ID.counterstroke;
  // a disc of 2 m about (0, 47): its edge 4 m from acct-0 at (0, 41), 4.1 m from acct-2 at (-6, 46), 6.5 m from acct-1 at (-6, 41)
  const land = S.now() + 1100;   // between beats: armed at its landing, never the beat that counts it
  const [bl] = [egAim(B.F, spec, { o: lord.i, s: [shDisc(0, 47, 2)], at: land, wu: 1100, p: 0.05, b: 0, el: null, nm: 'Test Blow' }, [], S.now(), [])];
  assert.ok(bl, 'the lord\'s blow aimed');
  while (S.now() < land + 300) S.step();
  assert.deepEqual([B.mem['acct-0'].lordLandedAt, B.mem['acct-1'].lordLandedAt, B.mem['acct-2'].lordLandedAt], [land, undefined, land],
    'acct-0 and acct-2, 4 m and 4.1 m off: armed at the landing; acct-1, 6.5 m off: not');
  assert.ok(!B.mem['acct-0'].struck, 'never struck');
  // the factor, as egVestigeX applies it
  const m = B.mem['acct-0'], at = { x: 0, z: 41 }, here = [];
  m.lordLandedAt = 50_000;
  const x = (r, body, now, mast = EG_M_ID.counterstroke) => { m.mast = mast; return egVestigeX(B, 'acct-0', at, body, r, now, here).x; };
  assert.deepEqual([x(HIT_KINDS.Melee, lord, 50_000 + EG_COUNTER_MS), x(HIT_KINDS.Melee, lord, 50_000 + EG_COUNTER_MS + 1), x(HIT_KINDS.Shaft, lord, 50_100), x(HIT_KINDS.Melee, { role: 1, x: 0, z: 42, hp: 9, max: 9 }, 50_100), x(HIT_KINDS.Melee, lord, 50_100, EG_M_ID.spotter)],
    [EG_COUNTER_X, 1, 1, 1, 1]);
});

// ── SWEEPING ARC (lane1 #19) ─────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III SWEEPING ARC THROUGH THE HOST HITS (section 15: "melee blows splash 20 / 35 / 50% to adds within 3 m of the target (relay host hits)"): a melee blow on the lord splashes its share on every add within 3 m of the lord as it stands - a blow on an add the same, the target never twice; an add 3.1 m off, a hidden add, a ward or a friend takes none; an arrow splashes nothing (mutants: the splash only off an add; the stale place read; the 3 m; the hidden struck; an arrow splashing)', () => {
  const S = court({ at: { 'acct-0': [15.32, 70.99], 'acct-1': [-6, 41], 'acct-2': [-6, 46] } }), { B } = S;
  const me = B.mem['acct-0'];
  me.vs = [[vId('sweeping'), 3]];
  // PIN MOVED (AUDIT EG IV, lane1 #3): a lord asleep takes no blow, so Grath is woken (his kit's own wake) before acct-0 strikes him
  // from beside him on his island - before, this struck him asleep, the company outside his wake ring
  egLordsWake(B.F, S.spec, S.now(), [], { n: 3 });
  const lord = egLordsOf(B.F)[0], [lx, lz] = egBodyAt(lord, S.now());
  const [A, X, H, W, Fr] = adds(S, [[lx + 2.9, lz], [lx - 3.1, lz], [lx, lz + 2], [lx, lz - 2], [lx + 1, lz + 1]]);
  egSetFl(B.F, H, EG_FL.hidden, true, []); egSetFl(B.F, W, EG_FL.ward, true, []); egSetFl(B.F, Fr, EG_FL.friend, true, []);
  const hl = lord.hp;
  S.blow('acct-0', lord.i, 20, HIT_KINDS.Melee);
  const got = hl - lord.hp;
  assert.ok(got > 0, `the lord struck (${got})`);
  assert.ok(near(A.hp, 500 - got * 0.5), `the add 2.9 m off takes half of what landed (${500 - A.hp} of ${got})`);
  assert.deepEqual([X.hp, H.hp, W.hp, Fr.hp], [500, 500, 500, 500], '3.1 m off, hidden, a ward, a friend: none');
  // the add walked: the splash finds it where it stands now
  X.mv = { x: X.x, z: X.z, tx: lx - 1, tz: lz, v: 100, at: S.now() };
  const h2 = lord.hp;
  S.blow('acct-0', lord.i, 20, HIT_KINDS.Melee);
  assert.ok(near(X.hp, 500 - (h2 - lord.hp) * 0.5), 'where it stands as the blow lands');
  // an arrow: nothing
  const a0 = A.hp;
  S.blow('acct-0', lord.i, 20, HIT_KINDS.Shaft);
  assert.equal(A.hp, a0, 'an arrow splashes nothing');
  // a blow on an add splashes its neighbour, never itself again
  const T = court(), [P, Q] = adds(T, [[0, 43], [2, 43]]);
  T.B.mem['acct-0'].vs = [[vId('sweeping'), 1]];
  T.blow('acct-0', P.i, 20, HIT_KINDS.Melee);
  assert.deepEqual([P.hp, Q.hp], [480, 496], 'Sweeping Arc I: a fifth of it on the add 2 m off');
});

// ── SPILLOVER (lane1 #8) ─────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III SPILLOVER (section 15: "a spell\'s overkill on an add carries to the nearest add within 6 m (relay host hits)"): a spell that fells an add carries what its claim held past it to the nearest add within 6 m - out of the member\'s purse, within the blow\'s own cap; an add 6.1 m off takes none; a melee blow, a spell that fells nothing, or a member without the Mastery carries nothing; it carries once (mutants: Spillover unapplied; the 6 m; the nearest unread; past the purse; a melee blow carried; the Mastery unread)', () => {
  const S = court(), { B } = S;
  const me = B.mem['acct-0'];
  me.mast = EG_M_ID.spillover;
  const [A] = adds(S, [[0, 44]], 30), [Y, X, Z] = adds(S, [[0, 48], [0, 49], [6.1, 44]], 500);
  const out = S.blow('acct-0', A.i, 100, HIT_KINDS.Spell);
  assert.ok(!B.F.bodies.includes(A), 'the add felled');
  assert.deepEqual([Y.hp, X.hp, Z.hp], [430, 500, 500], 'its 70 past it on the nearest within 6 m (4 m - never the one 5 m off), once');
  assert.ok(out.some((f) => f.k === 'edie'));
  // the claim past the blow's cap: the carry held to it - and past the purse, held to the purse
  const cap = HIT_CAP_X * dpsRef(40);
  for (const bucket of [null, 100]) {
    const T = court(), mt = T.B.mem['acct-0'];
    mt.mast = EG_M_ID.spillover;
    const [A2] = adds(T, [[0, 44]], 30), [X2] = adds(T, [[0, 47]], 5000);
    if (bucket != null) { mt.bucket = bucket; mt.bucketAt = T.now() + 300; }   // the purse at 100 as the blow lands
    T.blow('acct-0', A2.i, 1e6, HIT_KINDS.Spell);
    const want = bucket == null ? cap - 30 : bucket - 30;
    assert.ok(near(5000 - X2.hp, want), `${bucket == null ? 'the blow\'s cap' : 'the purse'} holds the carry (${5000 - X2.hp} of ${want})`);
  }
  // none: a melee blow, a spell that fells nothing (its claim past what landed), no Mastery, an add 6.1 m off alone
  for (const [mast, r, hp, d, at] of [[EG_M_ID.spillover, HIT_KINDS.Melee, 30, 100, [0, 46]], [EG_M_ID.spillover, HIT_KINDS.Spell, 5000, 1e6, [0, 46]], [EG_M_ID.spotter, HIT_KINDS.Spell, 30, 100, [0, 46]], [EG_M_ID.spillover, HIT_KINDS.Spell, 30, 100, [6.1, 42.5]]]) {
    const U = court();
    U.B.mem['acct-0'].mast = mast;
    const [A3] = adds(U, [[0, 42.5]], hp), [X3] = adds(U, [at], 500);
    U.blow('acct-0', A3.i, d, r);
    assert.equal(X3.hp, 500, `mastery ${mast}, kind ${r}, health ${hp}, the next add at ${at}: nothing carried`);
  }
  // a Shielded elite (section 8.7) whose shield takes what the spell landed past its health: it stands - no overkill
  const V = court();
  V.B.mem['acct-0'].mast = EG_M_ID.spillover;
  const squad = egSquad(V.B.F, [[0.7, 44]], V.now(), []), kv = squad.find((b) => egHas(b, EG_FL.shielded)), [X4] = adds(V, [[0, 47]], 500);
  kv.hp = 30; kv.shield = 20;
  V.blow('acct-0', kv.i, 100, HIT_KINDS.Spell, [kv.x, kv.z - 3]);   // from behind it, where its shield takes blows
  assert.deepEqual([kv.hp, kv.shield, X4.hp], [20, 0, 500], 'the shield soaked it: standing, nothing carried');
  assert.ok(squad.every((b) => b === kv || b.hp === b.max), 'the squad untouched');
});

// ── THE BINDER'S RAISE (lane1 #24) ───────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III THE BINDER\'S RAISE BROKEN BY WHAT LANDS (section 12: "a 6 s cast broken by blows that land a tenth of its health in it"): a forged claim the hand and the purse refuse counts nothing against the raise, so a point that lands after it breaks nothing; a blow that lands a tenth breaks it (mutants: the claim counted before the purse)', () => {
  const S = court(), { B } = S;
  const [bd, lk] = egLegionRaise(B.F, [EG_KIND.binder, EG_KIND.lurker], [[0, 44], [3, 44]], S.now(), [], { wave: 7 });
  S.blow('acct-0', lk.i, 5000, HIT_KINDS.Melee, [3, 42.5]);
  assert.ok(!B.F.bodies.includes(lk), 'the Lurker slain');
  for (let k = 0; k < 8 && !bd.cast; k++) S.step();
  assert.ok(bd.cast, 'the Binder raises the fallen');
  const out = S.blow('acct-0', bd.i, 1e6, HIT_KINDS.Melee, [-10, 41]);   // a melee blow from 10 m: refused by the hand's reach
  assert.equal(bd.hp, bd.max, 'refused');
  assert.ok(!out.some((f) => f.k === 'esay'));
  S.blow('acct-0', bd.i, 1, HIT_KINDS.Shaft);
  assert.ok(bd.cast && near(bd.cast.dmg, 1), `a point landed, the raise unbroken (${bd.cast?.dmg})`);
  // a claim past the purse: what lands counts, never the claim
  const m = B.mem['acct-0'];
  m.bucket = 5; m.bucketAt = S.now() + 300;
  S.blow('acct-0', bd.i, 100, HIT_KINDS.Shaft);
  assert.ok(bd.cast && near(bd.cast.dmg, 6), `five landed of a hundred claimed (${bd.cast?.dmg})`);
  const out2 = S.blow('acct-0', bd.i, bd.cast.max, HIT_KINDS.Shaft);
  assert.equal(bd.cast, null, 'a tenth landed: broken');
  assert.ok(out2.some((f) => f.k === 'esay' && f.w === 'raisebroken'));
});

// ── NO QUARTER AND FAR WATCH BY THE PAIR LAW (lane1 #16) ─────────────────────────────────────────────────────────────
test('AUDIT EG III NO QUARTER AND FAR WATCH ARE ACCORDS (section 15: "Two members within 10 m, holding a named pair"): Culling Edge reaches an add under a third while Fallen\'s Due burns only with a mate holding Fallen\'s Due within 10 m - never the holder of both alone, never a mate 200 m off; Watchfire\'s company keeps Far Watch with another member holding Long Sight within 10 m - never its own Long Sight, never one 10.1 m off (mutants: No Quarter read off the company; the holder its own mate; Far Watch read off the company; the reach)', () => {
  const S = court(), { B } = S;
  B.F.fellThisHall = 1;   // an ally fell this hall: Fallen's Due burns
  const add = { role: 1, x: 0, z: 43, hp: 30, max: 100 };   // at 30%: under a third, over a quarter
  const x = (here) => egVestigeX(B, 'acct-0', { x: 0, z: 41 }, add, HIT_KINDS.Melee, S.now(), here).x;
  B.mem['acct-0'].vs = [[vId('culling'), 3], [vId('fallensdue'), 1]]; B.mem['acct-1'].vs = []; B.mem['acct-2'].vs = [];
  assert.ok(near(x([]), 1.1), 'the holder of both alone: Fallen\'s Due\'s +10%, no Culling Edge at 30%');
  B.mem['acct-0'].vs = [[vId('culling'), 3]]; B.mem['acct-1'].vs = [[vId('fallensdue'), 1]];
  assert.ok(near(x([{ sub: 'acct-1', x: 200, z: 41 }]), 1.1), 'the mate 200 m off: none');
  assert.ok(near(x([{ sub: 'acct-1', x: 10, z: 41 }]), Math.min(1.6, 1.1 * 1.6)), 'the mate within 10 m: No Quarter');
  // Far Watch: the Watchfire holder's Long Sight company, by the poses the director holds
  B.mem['acct-0'].vs = [[vId('watchfire'), 1], [vId('longsight'), 1]]; B.mem['acct-1'].vs = []; B.mem['acct-2'].vs = [[vId('longsight'), 1]];
  B.mem['acct-0'].pose = { x: 0, z: 41, h: 5 }; B.mem['acct-1'].pose = { x: -6, z: 41, h: 5 }; B.mem['acct-2'].pose = { x: 10.1, z: 41, h: 5 };
  assert.deepEqual(egWatchOf(B).map((w) => [w.sub, w.ls]), [['acct-0', []]], 'its own Long Sight is no pair; a holder 10.1 m off none');
  B.mem['acct-2'].pose = { x: 10, z: 41, h: 5 };
  assert.deepEqual(egWatchOf(B).map((w) => [w.sub, w.ls]), [['acct-0', [[10, 41]]]], 'a mate within 10 m: Far Watch over its place');
});

// ── A SOUL-POOL SAID IN ITS BLOW (lane3 #12) ─────────────────────────────────────────────────────────────────────────
test('AUDIT EG III A SOUL-POOL SAID AS IT APPEARS (section 14\'s Soul-Pools; section 23\'s `ez`): an add a member slays leaves its pool in that blow\'s own frames - never the last beat\'s, already fanned (mutants: the beat\'s frames written)', () => {
  const S = court({ pr: 'soulpools' }), { B } = S;
  assert.equal(B.F.D.soulpools, 1);
  const [A] = adds(S, [[0, 43]], 10);
  const beat = S.step();
  const n = beat.length;
  const out = S.blow('acct-0', A.i, 50, HIT_KINDS.Melee);
  assert.ok(!B.F.bodies.includes(A));
  const pool = out.filter((f) => f.k === 'ez' && f.kind === 'soul');
  assert.equal(pool.length, 1, 'the pool in the blow\'s frames');
  assert.deepEqual(pool[0].s, shDisc(0, 43, 2.5));
  assert.equal(beat.length, n, 'the beat before untouched');
});

// ── THE CANTRIPS (lane1 #21) ─────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III THE CANTRIPS ANYWHERE OUTSIDE A LORD\'S SHIELD (section 17.2): at a Redoubt\'s rest Stillness is used and spent (the next hall\'s first wave late); Sight is kept where no hall\'s fight stands to show; in a Court of two lords, the second\'s shield refuses one as the first\'s does (mutants: refused at the rest; the second lord unread; Sight spent on nothing)', () => {
  const idOf = (key) => EG_CANTRIPS.findIndex((C) => C.key === key);
  // the Twin Court: two lords; the second's shield up
  const T = court({ strata: ['twincourt'] }), { B: TB } = T;
  const L = egLordsOf(TB.F);
  assert.equal(L.length, 2, 'two lords');
  const tm = TB.mem['acct-0'];
  tm.cant = [idOf('mending')];
  egSetFl(TB.F, L[1], EG_FL.ward, true, []);
  assert.deepEqual(egWord(TB, 'acct-0', { k: 'cant', i: 0 }, null, T.now(), T.rng), [], 'the second lord\'s shield refuses it');
  assert.deepEqual(tm.cant, [idOf('mending')]);
  egSetFl(TB.F, L[1], EG_FL.ward, false, []); L[1].ward = 0;
  assert.ok(egWord(TB, 'acct-0', { k: 'cant', i: 0 }, null, T.now(), T.rng).some((f) => f.k === 'eheal'), 'no shield up: used');
  // the rest: the lord felled, the Redoubt taken
  const S = court(), { B } = S;
  fell(S);
  assert.equal(B.sg, 'rest');
  const m = B.mem['acct-0'];
  m.cant = [idOf('stillness'), idOf('sight')];
  const used = egWord(B, 'acct-0', { k: 'cant', i: 0 }, null, S.now(), S.rng);
  assert.equal(B.still, 1, 'Stillness at the rest: the next hall\'s first wave late');
  assert.deepEqual(m.cant, [idOf('sight')], 'spent');
  assert.ok(used.some((f) => f.k === 'esay' && f.w === 'cantrip'));
  assert.deepEqual(egWord(B, 'acct-0', { k: 'cant', i: 0 }, null, S.now(), S.rng), [], 'Sight, with no hall\'s fight to show: kept');
  assert.deepEqual(m.cant, [idOf('sight')]);
});

// ── A TRIAL'S ABSENCE, AND THE WAY HOME'S END (lane3 #2, lane3 #13) ─────────────────────────────────────────────────
test('AUDIT EG III ABSENCE COUNTS ONLY IN A TRIAL (section 6.1: "180 s gone in a trial ... Absence on the stair or at a rest never counts"): a member whose socket dropped as the rest began stands through the rest, the stair and 179 s of the next hall\'s trial, and falls past 180 s of it (mutants: the absence counted from its last pose)', () => {
  const S = court(), { B } = S;
  fell(S);
  assert.equal(B.sg, 'rest');
  S.away('acct-1');
  let woke = 0;
  for (let k = 0; k < 4 * 400 && !woke; k++) { S.step(); if (B.sg === 'trial') woke = S.now(); }
  assert.ok(woke > 0, 'the next hall woke');
  assert.ok(B.mem['acct-1'].alive, 'not fallen by the rest and the stair');
  while (S.now() < woke + EG_ABSENT_TRIAL_MS - 1000) S.step();
  assert.ok(B.mem['acct-1'].alive, '179 s into the trial: standing');
  while (S.now() < woke + EG_ABSENT_TRIAL_MS + 500) S.step();
  assert.equal(B.mem['acct-1'].alive, 0, 'past 180 s of it: fallen');
});

test('AUDIT EG III THE WAY HOME\'S END (section 23\'s `end`: "\'gone\' (every member out: fallen twice, forsaken or home), \'wipe\' (no living member)"): the last living member taking the way home at a rest ends the breach \'gone\'; a company felled in a hall ends it \'wipe\' (mutants: the rest\'s end a wipe)', () => {
  const S = court(), { B } = S;
  fell(S);
  while (S.now() < B.rdAt + EG_RD_WINDOW_MS) S.step();
  for (const sub of ['acct-0', 'acct-1', 'acct-2']) assert.equal(egHome(B, sub, S.now(), []), true, `${sub} went home`);
  const out = S.step();
  assert.equal(B.end, 'gone');
  assert.ok(out.some((f) => f.k === 'end' && f.why === 'gone'));
  const W = court();
  for (const sub of ['acct-0', 'acct-1', 'acct-2']) W.B.mem[sub].recall = 0;
  const o = egStep(W.B, W.now() + 250, ['acct-0', 'acct-1', 'acct-2'].map((sub) => ({ sub, sx: 0, z: 0, dead: true, at: W.now() + 250 })), W.rng);
  assert.equal(W.B.end, 'wipe');
  assert.ok(o.some((f) => f.k === 'end' && f.why === 'wipe'));
});

// ── LIFELINE HELD OPEN ONLY BY A HEAL (lane3 #7) ─────────────────────────────────────────────────────────────────────
test('AUDIT EG III A HEAL WORTH A LIFELINE WINDOW (section 15\'s Lifeline, in the census - section 21): a member under 30% saying a Lifeline holder\'s heal of a point every second opens no window; a heal believed at a twentieth of its reference body (EG_LIFELINE_MIN of net/gate/gateBrain.js healRef) or more opens one (mutants: any point opening a window; the minimum unread; the claim read before the bucket)', () => {
  assert.equal(EG_LIFELINE_MIN, 0.05);
  assert.deepEqual([egLifelineMin(40), egLifelineMin(1), egLifelineMin(99)], [0.05 * healRef(40), 0.05 * healRef(1), 0.05 * healRef(60)]);
  const S = court(), { B } = S;
  const me = B.mem['acct-0'];
  B.mem['acct-1'].vs = [[vId('lifeline'), 3]];
  bodyStruck(me, 0.8, S.now(), LINE);
  let now = S.now();
  const saw = () => true;   // PIN MOVED (AUDIT EG V, d: lane4 L4-7 - Lifeline opens only on a heal a relayed cast backs): the healer's cast seen
  for (let k = 0; k < 6; k++, now += 1000) {
    assert.equal(egHeal(B, 'acct-0', [['acct-1', 1]], now, LINE, undefined, saw), 1, 'believed');
    assert.equal(egCensusDr(B, null, null, { sub: 'acct-0', at: now + 500 }, []), 0, `t+${k}: a point's heal spares nothing`);
  }
  assert.equal(me.ll, undefined, 'no window');
  const min = egLifelineMin(me.lv);
  egHeal(B, 'acct-0', [['acct-1', Math.ceil(min) - 1]], now, LINE, undefined, saw);
  assert.equal(me.ll, undefined, 'a point short of the minimum: none');
  egHeal(B, 'acct-0', [['acct-1', Math.ceil(min)]], now + 10, LINE, undefined, saw);
  assert.deepEqual(me.ll, [[now + 10 - 1000, now + 10 + 3000, 0.3]], 'the minimum: Lifeline III\'s window');   // PIN MOVED (AUDIT EG III's merge with the count group, lane2 #5): Lifeline III is 30% (20 / 25 / 30)
  // believed through the bucket: a claim past it, believed short of the minimum, opens none
  const T = court(), tm = T.B.mem['acct-0'];
  T.B.mem['acct-1'].vs = [[vId('lifeline'), 1]];
  bodyStruck(tm, 0.8, T.now(), LINE);
  tm.hb = Math.ceil(min) - 1; tm.hbAt = T.now();
  egHeal(T.B, 'acct-0', [['acct-1', 1000]], T.now(), LINE, undefined, saw);
  assert.equal(tm.ll, undefined, 'the bucket believed a point short: none');
});
