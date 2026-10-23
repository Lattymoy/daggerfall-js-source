// AUDIT EG IV (2026-10-13, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 8.3, 8.5, 8.6, 13.2, 13.3, 13.4 and 18)
// - THE LORDS' GROUP: the lords' and the Court's findings fixed, each pinned on fights the real producers stand (net/eliteGates/egLaw.js
// egHallOf, net/eliteGates/egBodies.js egFightNew, net/eliteGates/egLords.js egLordsNew, egLordsWake and egLordsStep, the director's net/eliteGates/egBrain.js
// egBreachNew, egEnter, egStep and egBlow): a fight of two lords won when both fall (lane 1 #1); the Examination's held line
// strictly above the third phase's (#2); a lord asleep takes no blow (#3); a mirror turns no phase (#4); the Last Lesson's last
// ring kept (#7); Gore never along a bridge (#8); the Haven Nova's route over the whole court (#9); Garoth's borrowed signature
// his own and named (#10, lane 9 #16); a proving champion at its court's ring (#11); Counterstroke armed at the blow (#19);
// fury beside a champion (#20); the Clan Muster at the turn, holding the next threshold (#21); one Rivalry card (#23); the Last
// Charge's third back as the next falls (#24); the Crossing and Burning Perch as lord blows (#26); the Twins' window the
// Echoes' constant (#32); THE COVENANT'S PATIENCE at the felling blow (lane 10 #1); the Rampart's march holding its gate (#17).
// The failure blows that name their members (#5) are pinned in egaudit4_lords_errands; the page's in egaudit4_lords_page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, EG_SEALED_MS, EG_WAKE_RING_MS, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow, champRing, EG_GATE_HOLD_M, EG_CHAMP_RING_M } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsNew, egLordsWake, egLordsStep, egLordsOf, egLordsAwake, egLordsFell, egLordHitX, egLordHit, egLordsShare, egLordsPairOf, egObjsOf, egObjBroken, egHoldHp, egHavenRouteM, egTtkRef,
  EG_TWIN_ONE_MS, EG_FURY_RATIO, EG_GAROTH_SIG_CARDS, EG_ZONE_FIGHT_MS, EG_LESSON_TELL_MS } from '../../../src/net/eliteGates/egLords.js';
import { egFightNew, egHas, EG_FL, EG_ROLE, egBodyById, egBlowsStep, egShareX, egBodiesOf, egAim } from '../../../src/net/eliteGates/egBodies.js';
import { egInShape, egErrandMs, shDisc } from '../../../src/net/eliteGates/egShape.js';
import { egFightView } from '../../../src/net/eliteGates/egWalkGraph.js';
import { EG_KIND } from '../../../src/net/eliteGates/egLegion.js';
import { EG_M_ID, EG_COUNTER_X } from '../../../src/net/eliteGates/egVestige.js';
import { egVestigeX } from '../../../src/net/eliteGates/egRun.js';
import { SD_ECHO_PAIR_MS } from '../../../src/net/superDungeon/sdRemnant.js';
import { HIT_KINDS, PHASE_AT, ATTACKS } from '../../../src/net/gate/gateBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { egGive8Hall } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courts and its
// lords, its courses along +z from the plate, where law 8 lays them) and stand on it still - a finder scans law 8's halls by
// name, and a breach stands in a circle given at law 8 as a breach of law 8's is given to a client (test/egGive8.mjs
// egGive8Hall); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and test/net/eliteGates/law9_rooms.test.js's

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const MIN = 60_000;
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** The first hall of a seed (from `from`) whose spec passes `ok` - `[seed, h, spec]`. */
function hallWhere(ok, { seeds = 400, from = 1, to = 200, step = 1 } = {}) {
  for (let seed = 1; seed <= seeds; seed++) for (let h = from; h <= to; h += step) { const s = egHallOf(seed, h, 0, 8); if (ok(s)) return [seed, h, s]; }
  throw new Error('no hall found');
}

/**
 * A lord's fight stood and woken as the director stands it (egHallOf, egFightNew, egLordsNew, egLordsWake) for `n` members at level
 * 40; `step(here, ctx)` beats it in the director's order - the lords, then the blows' words - every frame kept, the words it said
 * counted.
 */
function court(seed, h, key, { n = 2, rng = seeded(seed), decrees = {} } = {}) {
  const spec = egGive8Hall(seed, h, 0);
  assert.equal(spec.lord, key, `hall ${h} of seed ${seed} is ${key}'s`);
  const subs = Array.from({ length: n }, (_, i) => `acct-${i}`);
  const F = egFightNew(spec, T0, subs.map(() => 40), subs), frames = [], view = egFightView(spec), said = {};
  egLordsNew(F, spec, key, T0, frames, { decrees, n });
  egLordsWake(F, spec, T0, frames, { n });
  let now = T0;
  const step = (here, ctx = {}) => {
    now += 250;
    const out = [];
    egLordsStep(F, spec, now, here, rng, out, { decrees, n, ...ctx });
    egBlowsStep(F, view, now, here, out);
    for (const f of out) if (f.k === 'esay') said[f.w] = (said[f.w] ?? 0) + 1;
    frames.push(...out);
    return out;
  };
  return { spec, F, L: egLordsOf(F)[0], subs, frames, said, step, now: () => now, view, f: spec.fl?.find((q) => q.t === 'd') ?? { x: 0, z: 0, r: 18 } };
}
/**
 * A breach of `n` at hall `h` of `seed` (its Proclamation cleared), woken with the company on the arrival plate: `at` stands a
 * member (the hall's frame), `step` beats the director (its frames kept), `blow` strikes a body from where a member stands.
 */
function breachAt(seed, h, { n = 1, strata = [], tide = null, dc = [], wake = true } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = '';
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.strata = [...strata]; B.tide = tide; B.dc = dc;
  const spec = egGive8Hall(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 30 * MIN, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  const at = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  const blow = (sub, i, d, r, [x, z], q) => { now += 50; return egBlow(B, sub, { k: 'hit', i, q, d, r }, { sx: spec.x0 + x, y: 0, z }, now); };
  for (let k = 0; k < 120 && wake && B.sg !== 'trial'; k++) step();
  if (wake) assert.equal(B.sg, 'trial', `hall ${h} woke`);
  return { B, spec, pos, frames, step, at, blow, subs: co.map(([sub]) => sub), now: () => now, tick: (ms) => (now += ms) };
}
/** The Court's lords woken by the company standing in its wake ring. */
function wakeCourt(S) {
  for (const sub of S.subs) S.at(sub, S.spec.ring.x, S.spec.ring.z);
  for (let k = 0; k < 40 && !egLordsAwake(S.B.F); k++) S.step();
  assert.ok(egLordsAwake(S.B.F), 'the lords woke');
}
/** A lord felled where it stands by a member's arrow from beside it (its ward lifted - the blow is the fall's, not the ward's). */
let q = 1;
function fellLord(S, L, sub = 'acct-0') {
  L.ward = 0; egHas(L, EG_FL.ward) && (L.fl &= ~EG_FL.ward); L.hp = 1;
  const pose = [L.x + 1.5, L.z];
  S.at(sub, ...pose);
  return S.blow(sub, L.i, 500, HIT_KINDS.Shaft, pose, q++);
}

// ── lane 10 #1: THE COVENANT'S PATIENCE AT THE FELLING BLOW ───────────────────────────────────────────────────────────
test('AUDIT EG IV lane10 #1 THE COVENANT\'S PATIENCE AT THE FELLING BLOW (section 18: "When the lord falls, the Redoubt is taken and paid but adds no time; the rest runs; then the breach ends as the way home"): the count let run out with the Court\'s lord awake - the director arms the Covenant itself - and the lord felled: the beat after takes the Redoubt (`rd` cov 1, no time), never a tear; the rest runs to the way home, Reliquaries kept (mutants: the old test - a tear at the felling blow\'s beat)', () => {
  const S = breachAt(12345, 5, { n: 2 });
  wakeCourt(S);
  S.B.cnt = { left: 1000, at: S.now() };
  for (let k = 0; k < 8; k++) S.step();
  assert.equal(S.B.covenant, 1, 'the count spent while the lord is awake: the Covenant, armed by the director');
  assert.ok(S.frames.some((f) => f.k === 'esay' && f.w === 'covenant'));
  const L = egLordsOf(S.B.F)[0];
  fellLord(S, L);
  assert.ok(egLordsFell(S.B.F), 'felled');
  const out = S.step();
  assert.equal(S.B.end ?? null, null, 'no tear');
  const rd = out.find((f) => f.k === 'rd');
  assert.ok(rd && rd.cov === 1 && rd.g === 0, 'the Redoubt taken under the Covenant: paid, no time');
  for (let k = 0; k < 4 * 120 && !S.B.end; k++) S.step();
  assert.equal(S.B.end, 'home', 'the rest run, the way home');
  const ends = S.frames.filter((f) => f.k === 'end');
  assert.ok(ends.length && ends.every((f) => f.why === 'home'), 'every end the way home');
  // the count spent on the very beat the lord falls (no Covenant armed): the Redoubt, never a tear
  const T = breachAt(12345, 5, { n: 2 });
  wakeCourt(T);
  T.B.cnt = { left: 200, at: T.now() };
  fellLord(T, egLordsOf(T.B.F)[0]);
  const o2 = T.step();
  assert.ok(!T.B.end && o2.some((f) => f.k === 'rd'), 'a fall on the beat the count runs out takes the Redoubt');
});

// ── lane 1 #1: A FIGHT OF TWO LORDS IS WON WHEN BOTH FALL ──────────────────────────────────────────────────────────────
test('AUDIT EG IV lane1 #1 A COURT OF TWO LORDS (section 18): Clan Feud\'s champion beside the lord, the Twin Court\'s two lords and the Old Masters each fall plainly - the first fall takes no Redoubt, the second does; the Old Masters under the Twins\' 15 s law (one fallen and the other standing past SD_ECHO_PAIR_MS, the survivor raises it at half); the Twin Court\'s 0.6 never shrinks a champion beside it; a Deepway champion chamber stands no Vigil champion beside its own (mutants: the first fall wins; the pair law\'s window; the Old Masters never paired; the Vigil in a champion chamber)', () => {
  for (const [label, o] of [['Clan Feud', { tide: 'feud' }], ['the Twin Court', { strata: ['twincourt'] }]]) {
    const S = breachAt(12345, 5, { n: 2, ...o });
    wakeCourt(S);
    const lords = egLordsOf(S.B.F);
    assert.equal(lords.length, 2, `${label}: two lords`);
    fellLord(S, lords[1]);
    for (let k = 0; k < 4; k++) S.step();
    assert.ok(!egLordsFell(S.B.F) && S.B.sg === 'trial' && !S.B.rd, `${label}: one fallen, the other standing - no Redoubt`);
    fellLord(S, lords[0]);
    assert.ok(egLordsFell(S.B.F), `${label}: both fallen`);
    S.step();
    assert.equal(S.B.sg, 'rest', `${label}: the Redoubt`);
  }
  // the Twin Court beside Clan Feud: the two lords at 0.6, the champion at its own
  const K = breachAt(12345, 5, { n: 2, strata: ['twincourt', 'kynchampions'] }), KL = egLordsOf(K.B.F);
  const champ = KL.find((L) => L.champ);
  assert.ok(champ && KL.length === 3, 'a lord, its champion, and a second lord');
  const N = breachAt(12345, 5, { n: 2, tide: 'feud' }), plain = egLordsOf(N.B.F).find((L) => L.champ);
  assert.equal(champ.max, plain.max, 'the champion keeps its own health');
  // the Old Masters: a Spellmaster's Court, the Armsmaster beside him, under the Twins' law
  const [seed, h] = hallWhere((s) => s.kind === 'court' && s.lord === 'spellmaster', { step: 5, from: 5 });
  const M = breachAt(seed, h, { n: 2, strata: ['oldmasters'] });
  wakeCourt(M);
  const [sm, am] = egLordsOf(M.B.F);
  assert.deepEqual([sm.key, am.key], ['spellmaster', 'armsmaster']);
  assert.deepEqual(egLordsPairOf(M.B.F), { a: sm.i, b: am.i, ms: SD_ECHO_PAIR_MS }, 'paired under the Echoes\' law');
  assert.ok(fellLord(M, am).some((f) => f.k === 'esay' && f.w === 'twinfell'), 'the window opened');
  const fellAt = M.now();
  while (M.now() <= fellAt + SD_ECHO_PAIR_MS + 250) M.step();
  assert.ok(am.hp > 0 && Math.abs(am.hp - Math.round(am.max / 2)) <= 1 && !egHas(am, EG_FL.fell), 'past the window: raised at half');
  assert.ok(M.frames.some((f) => f.k === 'esay' && f.w === 'twinraised'));
  // both within the window: the Court is won
  fellLord(M, am);
  M.step();
  fellLord(M, sm);
  assert.ok(egLordsFell(M.B.F), 'both within the window: fallen');
  // a fight the director says bears the Old Masters (`F.mem.oldMasters`) pairs its Spellmaster and Armsmaster by that word alone
  const O = court(seed, h, 'spellmaster', { n: 2 }), oh = O.subs.map((sub, j) => ({ sub, x: O.f.x + 2 + j, z: O.f.z }));
  const [oa] = egLordsNew(O.F, O.spec, 'armsmaster', T0, [], { decrees: {}, n: 2, at: [O.f.x - 6, O.f.z] });
  egLordsWake(O.F, O.spec, T0, [], { n: 2 });
  assert.equal(egLordsPairOf(O.F), null, 'no word, no pair');
  O.F.mem.oldMasters = 1;
  assert.deepEqual(egLordsPairOf(O.F), { a: O.L.i, b: oa.i, ms: SD_ECHO_PAIR_MS }, 'the word: the two masters paired');
  oa.hp = 1;
  assert.ok(strike(O, oa, 5, oh).some((f) => f.k === 'esay' && f.w === 'twinfell'), 'the Armsmaster down: the window opened');
  const of = O.now();
  while (O.now() <= of + SD_ECHO_PAIR_MS + 250) O.step(oh);
  assert.ok(oa.hp > 0 && !egLordsFell(O.F), 'past it: raised by the Spellmaster');
  // a Deepway champion chamber under Kyn's Vigil: its own champion alone
  const [ds, dh] = hallWhere((s) => s.kind === 'deepway' && s.spots.chamber?.[0]?.obj === 1);
  const D = breachAt(ds, dh, { n: 2, dc: [[EG_DECREE_BY_KEY.vigil.id, 1]] });
  assert.equal(egLordsOf(D.B.F).length, 1, 'one champion - the chamber\'s');
  assert.ok(Math.hypot(egLordsOf(D.B.F)[0].x - D.spec.arrive.x, egLordsOf(D.B.F)[0].z - D.spec.arrive.z) > 10, 'never the Vigil\'s on the arrival plate');
});

// ── lane 1 #3 and #11: A LORD ASLEEP TAKES NO BLOW; A CHAMPION WAKES AT ITS COURT'S RING ─────────────────────────────────
test('AUDIT EG IV lane1 #3 A LORD ASLEEP TAKES NO BLOW (section 8.6: "The fastest member never meets the lord alone"): Grath on his far island, struck from beside him while the company stands outside his wake ring - nothing lands, he wakes at the ring alone; woken, the same blow lands; egLordHitX is 0 for a lord asleep (mutants: the sleeping refusal)', () => {
  const S = breachAt(12345, 5, { n: 2 });
  const L = egLordsOf(S.B.F)[0];
  assert.ok(!L.up2 && L.key === 'hound', 'Grath asleep');
  assert.equal(egLordHitX(S.B.F, L, 'acct-0', { x: L.x + 1, z: L.z }, HIT_KINDS.Melee, S.now()), 0, 'asleep: no weight');
  const hp = L.hp, pose = [L.x + 1.5, L.z];
  S.at('acct-0', ...pose); S.at('acct-1', ...pose);
  S.step();
  S.blow('acct-0', L.i, 300, HIT_KINDS.Melee, pose, q++);
  assert.equal(L.hp, hp, 'a blow from beside him, outside his ring: nothing');
  assert.ok(!L.up2, 'and he sleeps on');
  wakeCourt(S);
  S.at('acct-0', L.x + 1.5, L.z);
  S.blow('acct-0', L.i, 300, HIT_KINDS.Melee, [L.x + 1.5, L.z], q++);
  assert.ok(L.hp < hp, 'woken: it lands');
});

test('AUDIT EG IV lane1 #11 A CHAMPION WAKES AT ITS COURT\'S RING (sections 8.5 and 8.6): the Proving Walk\'s Kynreeve stands asleep at the hall\'s wake, the company on the arrival plate 50 m off; it wakes when every member stands in its ring (its court\'s floor, 1 m inside the edge) - or 20 s after the first does; a Deepway champion chamber\'s the same (mutants: woken with the hall; the ring\'s 20 s)', () => {
  const [seed, h, spec] = hallWhere((s) => s.kind === 'proving');
  const ring = champRing(spec), disc = spec.fl.find((f) => f.t === 'd' && Math.hypot(f.x - spec.foe.x, f.z - spec.foe.z) < f.r);
  assert.deepEqual(ring, { x: disc.x, z: disc.z, r: disc.r - 1 }, 'its ring: the court\'s heart, 1 m inside its edge');
  const S = breachAt(seed, h, { n: 2 });
  const L = egLordsOf(S.B.F)[0];
  for (let k = 0; k < 8; k++) S.step();
  assert.ok(!L.up2 && !S.frames.some((f) => f.k === 'esay' && f.w === 'wake'), 'asleep while the company stands on the plate');
  S.at('acct-0', ring.x, ring.z);
  for (let k = 0; k < 8; k++) S.step();
  assert.ok(!L.up2, 'one member in its ring: it waits for the other');
  S.at('acct-1', ring.x + 1, ring.z);
  S.step();
  assert.ok(L.up2 && S.frames.some((f) => f.k === 'esay' && f.w === 'wake'), 'all in its ring: it wakes');
  // one in the ring and the other kept out: 20 s after the first
  const T = breachAt(seed, h, { n: 2 });
  T.at('acct-0', ring.x, ring.z);
  T.step();
  const first = T.now(), K = egLordsOf(T.B.F)[0];
  while (T.now() < first + EG_WAKE_RING_MS - 250) T.step();
  assert.ok(!K.up2, 'not before 20 s');
  T.step(); T.step();
  assert.ok(K.up2, '20 s after the first');
  // a Deepway champion chamber: its chamber's ring
  const [ds, dh, dspec] = hallWhere((s) => s.kind === 'deepway' && s.spots.chamber?.[0]?.obj === 1);
  const dr = champRing(dspec), D = breachAt(ds, dh, { n: 1 }), DL = egLordsOf(D.B.F)[0];
  assert.ok(dr.r >= 4 && dr.x === dspec.spots.chamber[0].x && dr.z === dspec.spots.chamber[0].z, 'about its chamber');
  D.step();
  assert.ok(!DL.up2, 'asleep');
  D.at('acct-0', dr.x, dr.z);
  D.step();
  assert.ok(DL.up2, 'woken at its chamber\'s ring');
  assert.equal(EG_CHAMP_RING_M, 13);   // PIN MOVED (AUDIT EG V, b: L9-7 - the constant itself, never a bound it could slide under; its no-floor ring driven in test/net/eliteGates/egaudit5_b.test.js)
});

// ── lane 1 #19: COUNTERSTROKE ARMED AT THE BLOW ───────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane1 #19 COUNTERSTROKE\'S WHOLE 0.6 s (section 15): a lord\'s blow landed 100 ms ago beside its holder, no beat since - a melee blow on the lord takes x1.4 at once (mutants: armed only by the beat\'s census)', () => {
  const S = breachAt(12345, 5, { n: 1 });
  wakeCourt(S);
  const L = egLordsOf(S.B.F)[0], m = S.B.mem['acct-0'];
  m.mast = EG_M_ID.counterstroke;
  const pose = [L.x + 1.5, L.z];
  S.at('acct-0', ...pose);
  S.step();
  const land = S.now() + 800;
  egAim(S.B.F, S.spec, { o: L.i, s: [shDisc(pose[0], pose[1] + 4, 2)], at: land, wu: 800, p: 0.05, b: 0, el: null, nm: 'Test Blow' }, [], S.now(), []);
  S.tick(850);   // 100 ms past its landing (the blow's 50 ms with it), no beat
  const x = egVestigeX(S.B, 'acct-0', { x: pose[0], z: pose[1] }, L, HIT_KINDS.Melee, S.now(), []).x;
  assert.equal(x, 1, 'before the blow: not armed by the census yet');
  const hp = L.hp;
  S.blow('acct-0', L.i, 100, HIT_KINDS.Melee, pose, q++);
  assert.equal(m.lordLandedAt, land, 'armed at the blow');
  const base = breachAt(12345, 5, { n: 1 });
  wakeCourt(base);
  const BL = egLordsOf(base.B.F)[0];
  base.at('acct-0', BL.x + 1.5, BL.z); base.step();
  const bh = BL.hp;
  base.blow('acct-0', BL.i, 100, HIT_KINDS.Melee, [BL.x + 1.5, BL.z], 1);
  assert.ok(Math.abs((hp - L.hp) / (bh - BL.hp) - EG_COUNTER_X) < 0.02, `x${EG_COUNTER_X} on the blow (${hp - L.hp} against ${bh - BL.hp})`);
});

// ── lane 10 #17: THE RAMPART'S MARCH HOLDS ITS GATE ──────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane10 #17 THE MARCH HOLDS THE GATE (section 8.3): a Rampart\'s Ward-Bearers are warded while any of its march stands within EG_GATE_HOLD_M (20 m) of the portcullis - said once (`gateheld`); a company that runs the walkway strikes nothing on them until the march there is broken, then they fall and the door opens (mutants: no ward; the 20 m; the march unmarked)', () => {
  assert.equal(EG_GATE_HOLD_M, 20);
  const [seed, h, spec] = hallWhere((s) => s.kind === 'rampart' && (s.variant === 'siege' || s.variant === 'fallingwall'));
  const S = breachAt(seed, h, { n: 2 });
  const gate = spec.gate, gx = (gate.bearers[0].x + gate.bearers[1].x) / 2;
  for (const sub of S.subs) S.at(sub, gx, gate.z - 5);
  for (let k = 0; k < 4 * 7; k++) S.step();   // the first march wave (6 s) rises at the gate
  const march = egBodiesOf(S.B.F, EG_ROLE.add).filter((a) => a.march);
  assert.ok(march.length > 0 && march.every((a) => Math.hypot(a.x - gx, a.z - gate.z) <= EG_GATE_HOLD_M), 'the march at the gate');
  const bearers = egBodiesOf(S.B.F, EG_ROLE.add, EG_KIND.bearer);
  assert.ok(bearers.length === 2 && bearers.every((b) => egHas(b, EG_FL.ward)), 'its Ward-Bearers warded');
  assert.equal(S.frames.filter((f) => f.k === 'esay' && f.w === 'gateheld').length, 1, 'said once');
  assert.ok(S.frames.filter((f) => f.k === 'esay' && f.w === 'gateheld').every((f) => validEgOut(f)), 'a word the wire takes');
  const b0 = bearers[0], hp = b0.hp;
  S.blow('acct-0', b0.i, 300, HIT_KINDS.Shaft, [b0.x, b0.z - 2], q++);
  assert.equal(b0.hp, hp, 'a blow on a warded bearer: nothing');
  // the march broken (every one of it slain where it stands): the ward falls and the bearers with it
  S.B.F.bodies = S.B.F.bodies.filter((a) => !a.march);
  S.step();
  assert.ok(bearers.every((b) => !egHas(b, EG_FL.ward)), 'the march gone: no ward');
  for (const b of bearers) { b.hp = 1; S.blow('acct-0', b.i, 300, HIT_KINDS.Shaft, [b.x, b.z - 2], q++); }
  for (let k = 0; k < 4 && S.B.sg === 'trial'; k++) S.step();
  assert.equal(S.B.sg, 'closing', 'both fallen: the door');
  // one of the march 20.5 m from the gate holds nothing
  const T = breachAt(seed, h, { n: 2 });
  for (const sub of T.subs) T.at(sub, gx, gate.z - 30);
  for (let k = 0; k < 4 * 7; k++) T.step();
  for (const a of egBodiesOf(T.B.F, EG_ROLE.add).filter((x) => x.march)) { a.mv = null; a.x = gx; a.z = gate.z - EG_GATE_HOLD_M - 0.5; }
  T.step();
  assert.ok(egBodiesOf(T.B.F, EG_ROLE.add, EG_KIND.bearer).every((b) => !egHas(b, EG_FL.ward)), 'past 20 m: no ward');
});

// ── lane 1 #2: THE EXAMINATION'S HELD LINE ────────────────────────────────────────────────────────────────────────────
/** A blow on a lord as the seam lands it: its health off, then the lord told (net/eliteGates/egLords.js egLordHit - a held line clamps). */
function strike(C, L, d, here, sub = 'acct-0') { const out = []; L.hp -= d; egLordHit(C.F, C.spec, L, sub, 'M0', d, { x: L.x + 2, z: L.z }, C.now(), here, out, {}); return out; }
test('AUDIT EG IV lane1 #2 THE EXAMINATION HOLDS ITS LINE STRICTLY ABOVE THE THIRD PHASE\'S (section 13.2): at every company of 1 to 8 at its real health, a burst past the line while the runes stand leaves the Spellmaster at egHoldHp - over 0.33 of his health, in his second phase, the Examination running; his share retired mid-Examination keeps the line strictly above it; the runes stood in order free it, and the Final Examination and a killing blow follow (mutants: the line rounded, at it; the share\'s rescale rounded)', () => {
  const [seed, h] = hallWhere((s) => s.kind === 'court' && s.lord === 'spellmaster', { step: 5, from: 5 });
  let rounded = 0;
  for (let n = 1; n <= 8; n++) {
    const C = court(seed, h, 'spellmaster', { n }), L = C.L;
    const here = C.subs.map((sub, j) => ({ sub, x: C.f.x + 3 + j, z: C.f.z + 3 }));
    C.step(here);
    if (Math.round(L.max * PHASE_AT[1]) / L.max <= PHASE_AT[1]) rounded++;
    strike(C, L, L.max * 0.45, here);
    C.step(here);
    assert.equal(L.ph, 2, `n ${n}: the Examination`);
    assert.equal(L.hpFloor, egHoldHp(L.max, PHASE_AT[1]), `n ${n}: its line`);
    assert.ok(L.hpFloor / L.max > PHASE_AT[1] && (L.hpFloor - 1) / L.max <= PHASE_AT[1], `n ${n}: the least health strictly above 0.33 (${L.hpFloor} of ${L.max})`);
    strike(C, L, L.max * 0.5, here);
    for (let k = 0; k < 4; k++) C.step(here);
    assert.deepEqual([L.ph, C.F.mem.exam?.kind, L.hp], [2, 'runes', L.hpFloor], `n ${n}: burst past it - held at the line, the second phase, the runes`);
    // PIN MOVED (FIELD BUGS 2026-10-19e LORD-SHARES, bible/01-Overview/bugs/Field-Bugs-2026-10-19e.md): an awake lord keeps a
    // fallen member's share, so the share that moves mid-Examination is one BROUGHT - a member recalled into the hall
    if (n >= 2) {
      const max0 = L.max;
      assert.equal(egLordsShare(C.F, 'acct-1', 40, false), false, `n ${n}: a fall keeps its share`);
      egLordsShare(C.F, 'acct-new', 40, true);
      assert.ok(L.max > max0 && L.hpFloor === egHoldHp(L.max, PHASE_AT[1]) && L.hp / L.max > PHASE_AT[1], `n ${n}: a share brought - the line strictly above at the new max`);
      C.step(here);
      assert.equal(L.ph, 2, `n ${n}: still the second phase`);
    }
    // the runes stood in their order: passed, the line freed
    for (let k = 0; k < 4 * 20 && C.F.mem.exam?.kind === 'runes'; k++) { const cur = egObjsOf(C.F, 'rune').find((r) => r.pt === C.F.mem.exam.next); if (cur) { here[0].x = cur.x; here[0].z = cur.z; } C.step(here); }
    assert.ok(!C.F.mem.exam && L.hpFloor == null, `n ${n}: passed, the line free`);
    while (L.stunUntil > C.now() || L.ward > C.now()) C.step(here);
    strike(C, L, L.max * 0.05, here);
    C.step(here);
    assert.deepEqual([L.ph, C.F.mem.exam?.kind], [3, 'seals'], `n ${n}: the Final Examination`);
    strike(C, L, L.max, here);
    assert.ok(egLordsFell(C.F), `n ${n}: a killing blow fells him`);
  }
  assert.ok(rounded >= 2, `the old line rounded to or under 0.33 for ${rounded} of the eight companies`);
  // a lord's max is fractional once a share is retired (net/gate/gateBrain.js retireShare), and there the float can put the next point
  // AT the line (113 / 342.4242424242424 reads as 0.33): the held line still stands over it
  for (const max of [342.4242424242424, 348.48484848484844, 621.2121212121211]) assert.ok(egHoldHp(max, PHASE_AT[1]) / max > PHASE_AT[1] && (Math.floor(max * PHASE_AT[1]) + 1) / max <= PHASE_AT[1], `strictly above at ${max}`);
});

// ── lane 1 #4: A MIRROR TURNS NO PHASE ───────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane1 #4 A MIRROR TURNS NO PHASE (section 13.4, the Mirrorcourt): Seyth in his first phase, one of his mirrors struck to 30% - no phase turned for it, no Long Night laid, no ward raised on it (mutants: a mirror\'s phase turned)', () => {
  const C = court(1, 75, 'seyth', { n: 3 });
  const here = C.subs.map((sub, j) => ({ sub, x: C.f.x + 3 + j, z: C.f.z + 3 }));
  C.L.hp = C.L.max * 0.6;   // EG-PERFECT (PIN MOVED): the Mirrorcourt is his second phase's - turned at 0.66
  for (let k = 0; k < 4 * 12; k++) C.step(here);
  const mirrors = egLordsOf(C.F).filter((L) => egHas(L, EG_FL.mirror));
  assert.equal(mirrors.length, 2, 'his two mirrors');
  const m = mirrors[0];
  m.hp = Math.floor(m.max * 0.3);
  const out = C.step(here);
  assert.equal(C.L.ph, 2, 'Seyth in his second phase');
  assert.deepEqual([m.ph, out.filter((f) => f.k === 'eph' || f.k === 'edark'), out.filter((f) => f.k === 'esay' && f.w === 'phase'), m.ward], [1, [], [], 0], 'no phase turned, no Long Night, no ward');
});

// ── lane 1 #7: THE LAST LESSON'S LAST RING ────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane1 #7 THE LAST LESSON\'S LAST RING (section 13.3: "the court\'s edge closes 1 m every 6 s, to r 12"): each ring burns until the next closes it; the last, at r 12, stands to the fight\'s end (mutants: the last ring 6 s long)', () => {
  const C = court(1, 10, 'armsmaster', { n: 1 });
  const here = [{ sub: 'acct-0', x: C.f.x + 2, z: C.f.z }];
  C.L.hp = C.L.max * 0.3;
  C.step(here);
  assert.equal(C.L.ph, 3, 'the Last Lesson');
  const burning = () => (C.F.zones ?? []).filter((z) => z.kind === 'burn' && z.s[0] === 'r' && z.from <= C.now() && z.until > C.now()).map((z) => z.s[3]);
  const t0 = C.now(), closes = Math.ceil(C.f.r - 12) * 6000;
  // EG-PERFECT (PIN MOVED): each ring told EG_LESSON_TELL_MS before it burns - the first burns 7.5 s after the turn
  for (let t = t0 + EG_LESSON_TELL_MS; C.now() < t0 + closes + 12_000;) { C.step(here); if (C.now() > t + 6000) { t = C.now(); assert.equal(burning().length, 1, `one ring burns at ${(C.now() - t0) / 1000} s`); } }
  assert.deepEqual(burning(), [12], 'at r 12');
  const last = C.F.zones.find((z) => z.kind === 'burn' && z.s[0] === 'r' && z.s[3] === 12);
  assert.equal(last.until - last.from, EG_ZONE_FIGHT_MS, 'to the fight\'s end');
  assert.ok(EG_ZONE_FIGHT_MS >= 3_600_000);
});

// ── lane 1 #8: NO GORE ALONG A BRIDGE ─────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane1 #8 GRATH NEVER GORES ALONG A BRIDGE (section 13.3: "No lane is ever laid along a bridge"): the company on a bridge\'s middle for 90 s - Grath comes to them and fights, but no Gore is laid; on his own island he gores them (mutants: Gore at a member off his island)', () => {
  const C = court(12345, 5, 'hound', { n: 2 });
  const br = C.spec.spots.bridge.find((b) => Math.abs(b.z - b.bz) < 1);   // the bridge between the two upper islands
  const mid = { x: (br.x + br.bx) / 2, z: (br.z + br.bz) / 2 };
  const here = C.subs.map((sub, j) => ({ sub, x: mid.x + j * 0.5, z: mid.z }));
  for (let k = 0; k < 4 * 90; k++) C.step(here);
  assert.deepEqual(C.frames.filter((f) => f.k === 'eb' && f.nm === 'Gore'), [], 'no Gore at a member on a bridge');
  assert.ok(C.frames.some((f) => f.k === 'eb' && f.o === C.L.i), 'he fought them');
  const G = court(12345, 5, 'hound', { n: 1, rng: () => 0.1 });
  const on = [{ sub: 'acct-0', x: G.L.x + 7, z: G.L.z }];
  G.L.nextAt = T0;
  for (let k = 0; k < 4 * 6; k++) G.step(on);
  assert.ok(G.frames.some((f) => f.k === 'eb' && f.nm === 'Gore'), 'on his own island: gored');
});

// ── lane 1 #9: THE HAVEN NOVA'S ROUTE ─────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane1 #9 THE HAVEN NOVA\'S WIND-UP KEEPS THE ERRAND FLOOR OVER THE WHOLE COURT (section 13.3): with two, three and four havens its route is no shorter than the true longest (a 10 cm grid over the court) and at most 0.4 m over it - the court\'s heart among them (10 m from four havens: 2.94 s, never the old 2.42); the Nova as cast winds up its errand floor (mutants: the heart unsampled; the grid\'s bound dropped)', () => {
  const C = court(1, 15, 'spellmaster', { n: 1 }), f = C.f;
  const all = C.spec.spots.haven.map((p) => [p.x, p.z, 3]);
  const exact = (hv) => { let w = 0; for (let x = -f.r; x <= f.r; x += 0.1) for (let z = -f.r; z <= f.r; z += 0.1) { if (x * x + z * z > f.r * f.r) continue; let b = Infinity; for (const p of hv) b = Math.min(b, Math.max(0, Math.hypot(f.x + x - p[0], f.z + z - p[1]) - p[2])); w = Math.max(w, b); } return w; };
  const got = [];
  for (const k of [2, 3, 4]) {
    const hv = all.slice(0, k), t = exact(hv), m = egHavenRouteM(hv, f);
    assert.ok(m >= t && m <= t + 0.4, `${k} havens: measured ${m.toFixed(2)} m against ${t.toFixed(2)} m`);
    got.push([k, Math.round(t * 10) / 10, egErrandMs(m)]);
  }
  assert.deepEqual(got, [[2, 25.7, 5230], [3, 19.2, 4310], [4, 10, 2990]], 'the page\'s routes and wind-ups');
  assert.ok(got[2][2] >= egErrandMs(10), 'four havens: the heart\'s 10 m kept');
  // the Nova as the Spellmaster casts it: its wind-up the measure's
  for (const [n, k] of [[2, 2], [4, 3], [6, 4]]) {
    const S = court(1, 15, 'spellmaster', { n, rng: () => 0.01 });
    const here = S.subs.map((sub, j) => ({ sub, x: S.f.x + 2 + j * 0.5, z: S.f.z + 2 }));
    let nova = null;
    for (let k2 = 0; k2 < 4 * 40 && !nova; k2++) { S.step(here); nova = S.frames.find((x) => x.k === 'eb' && x.nm === 'Haven Nova') ?? null; }
    assert.ok(nova, `n ${n}: the Nova`);
    assert.equal(nova.wu, egErrandMs(egHavenRouteM(all.slice(0, k), f)), `n ${n}: ${k} havens, its wind-up the errand floor of the measure`);
  }
});

// ── lane 1 #10 and lane 9 #16: GAROTH'S BORROWED SIGNATURE ───────────────────────────────────────────────────────────
test('AUDIT EG IV lane1 #10 and lane9 #16 GAROTH\'S OLDER SIGNATURE IS HIS (section 13.4): at Redoubt 25 the Mirrorcourt - his own mirrors (his key, his look), never Seyth\'s, returning as Seyth\'s do, and no Eclipse or moon-shafts in the Clan Pit; at Redoubt 20 the Chaining in pairs (chains of three are Morvayn\'s Last Rites alone); the third phase\'s card names the signature (The Mirrorcourt. / The Chaining. / The Conquest.) (mutants: Seyth\'s mirrors; the Eclipse borrowed; chains of three; the old card; no return)', () => {
  assert.deepEqual(EG_GAROTH_SIG_CARDS, { ilthys: 'The Conquest.', morvayn: 'The Chaining.', seyth: 'The Mirrorcourt.' });
  const card = (C) => C.frames.filter((f) => f.k === 'esay' && f.w === 'phase').map((f) => f.t);
  // Redoubt 25: the Mirrorcourt
  const M = court(1, 125, 'garoth', { n: 1 }), mh = [{ sub: 'acct-0', x: M.f.x + 4, z: M.f.z + 4 }];
  M.L.hp = M.L.max * 0.3;
  for (let k = 0; k < 4 * 120; k++) M.step(mh);
  assert.deepEqual(card(M), ['The Clan Muster.', 'The Mirrorcourt.'], 'its card - EG-PERFECT (PIN MOVED): a burst past both lines takes every turn, each with its card');
  const mirrors = M.F.bodies.filter((b) => b.role === EG_ROLE.lord && egHas(b, EG_FL.mirror));
  assert.ok(mirrors.length >= 2 && mirrors.every((b) => b.key === 'garoth' && b.k === M.L.k), 'his own mirrors: his key and his look');
  assert.deepEqual([M.frames.filter((f) => f.k === 'eb' && f.nm === 'The Eclipse').length, M.said.eclipse ?? 0, M.F.pg.shafts ?? null], [0, 0, null], 'no Eclipse in the Clan Pit, no moon-shafts');
  const m0 = mirrors.find((b) => b.hp > 0);
  m0.hp = 1;
  strike(M, m0, 5, mh);
  assert.equal(M.F.mem.mirrorsAt, M.now() + 20_000, 'a mirror down: it returns 20 s on');
  // Redoubt 20: the Chaining, in pairs
  const R = court(1, 100, 'garoth', { n: 4 }), rh = R.subs.map((sub, j) => ({ sub, x: R.f.x + 2 + j, z: R.f.z + 2 }));
  R.L.hp = R.L.max * 0.3;
  for (let k = 0; k < 4 * 30 && !(R.F.mem.chains ?? []).length; k++) R.step(rh);
  assert.deepEqual(card(R), ['The Clan Muster.', 'The Chaining.'], 'its card - EG-PERFECT (PIN MOVED): every turn taken, each with its card');
  assert.deepEqual(R.F.mem.chains.map((c) => c.length), [2, 2], 'four members: two pairs');
  const V = court(1, 50, 'morvayn', { n: 3 }), vh = V.subs.map((sub, j) => ({ sub, x: V.f.x + 2 + j, z: V.f.z + 2 }));
  V.L.hp = V.L.max * 0.3;
  V.F.mem.chainAt = T0 + 1000;
  for (let k = 0; k < 8; k++) V.step(vh);
  assert.deepEqual(V.F.mem.chains.map((c) => c.length), [3], 'Morvayn\'s own Last Rites: a three');
  // Redoubt 30: the Conquest's card
  const I = court(1, 150, 'garoth', { n: 1 });
  I.L.hp = I.L.max * 0.3;
  I.step([{ sub: 'acct-0', x: I.f.x + 2, z: I.f.z }]);
  assert.deepEqual(card(I), ['The Clan Muster.', 'The Conquest.'], 'EG-PERFECT (PIN MOVED): every turn taken, each with its card');
});

// ── lane 1 #20: FURY BESIDE A CHAMPION ───────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane1 #20 FURY BESIDE A CLAN FEUD CHAMPION (sections 13.2 and 18): at 1.5 x ttkRef the Court\'s lord turns to fury with its champion standing beside it - the lord flagged, never the champion; the champion\'s blows keep their own shares and chain nothing (mutants: fury held back by a champion; the champion\'s shares under fury; its blows chained)', () => {
  const S = breachAt(12345, 5, { n: 2, tide: 'feud' });
  wakeCourt(S);
  const [lord, champ] = egLordsOf(S.B.F);
  assert.ok(!lord.champ && champ.champ, 'a lord and its champion');
  S.B.F.mem.lordWokeAt = S.now() - EG_FURY_RATIO * egTtkRef(S.B.F.c) * 1000;
  const k0 = S.frames.length;
  S.step();
  assert.ok(S.frames.slice(k0).some((f) => f.k === 'esay' && f.w === 'fury'), 'fury');
  assert.deepEqual([egHas(lord, EG_FL.fury), egHas(champ, EG_FL.fury)], [true, false], 'the lord\'s, never the champion\'s');
  S.B.F.mem.furyNext = S.now(); S.B.F.mem.furySteps = 2;
  S.step();
  assert.ok(S.B.F.mem.furyX > 1 && S.B.F.mem.furySteps >= 3, 'its shares grown, its blows chained');
  for (const sub of S.subs) S.at(sub, champ.x + 2, champ.z);
  const k1 = S.frames.length;
  for (let k = 0; k < 4 * 30; k++) S.step();
  const cb = S.frames.slice(k1).filter((f) => f.k === 'eb' && f.o === champ.i);
  assert.ok(cb.length > 0, 'the champion fought on');
  assert.ok(cb.every((f) => !f.nm.endsWith('(fury)')), 'its blows chain nothing');
  const law = S.B.F.mem.law, pct = Object.fromEntries(['cleave', 'slam', 'charge'].map((k) => [ATTACKS[k].name, ATTACKS[k].pct]));
  for (const f of cb) assert.ok(Math.abs(f.p - pct[f.nm] * egShareX(S.B.F.c, law.dmgX)) < 1e-9, `${f.nm}: its own share (${f.p})`);
});

// ── lane 1 #21: THE CLAN MUSTER AT THE TURN ──────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane1 #21 GAROTH\'S CLAN MUSTER IS A SIGNATURE ERRAND (section 13.2: "the shield holds until the errand is called, and blows past the next threshold are refused until it resolves"): his phase turn calls the honour duel in the same beat, inside his ward, and holds the next line - past it nothing lands while the duel stands; its end frees it; the third phase\'s duel holds his fall (mutants: the duel called 3.5 s on; no line held; the line kept past the duel)', () => {
  const C = court(1, 100, 'garoth', { n: 3 }), L = C.L;
  const here = C.subs.map((sub, j) => ({ sub, x: C.f.x + 3 + j, z: C.f.z + 3 }));
  C.step(here);
  strike(C, L, L.max * 0.4, here);
  const out = C.step(here);
  assert.equal(L.ph, 2, 'his second phase');
  assert.ok(out.some((f) => f.k === 'esay' && f.w === 'challenge') && L.ward > C.now(), 'the duel called at the turn, his ward up');
  assert.equal(L.hpFloor, egHoldHp(L.max, PHASE_AT[1]), 'the next line held');
  const by = () => C.subs.find((s) => !C.F.mem.challenge?.subs.includes(s));   // a member outside the duel (the challenged's own tenth ends it)
  strike(C, L, L.max * 0.5, here, by());
  assert.equal(L.hp, L.hpFloor, 'past it: nothing');
  for (let k = 0; k < 8; k++) C.step(here);
  assert.equal(L.ph, 2, 'no third phase while the duel stands');
  while (C.F.mem.challenge) C.step(here);
  assert.equal(L.hpFloor, null, 'the duel over: the line free');
  strike(C, L, L.max * 0.05, here);
  C.step(here);
  assert.ok(L.ph === 3 && C.F.mem.challenge && L.hpFloor === egHoldHp(L.max, 0), 'the third phase: a duel, his fall held');
  strike(C, L, L.max, here, by());
  assert.ok(!egLordsFell(C.F) && L.hp === L.hpFloor, 'he stands while it does');
  while (C.F.mem.challenge) C.step(here);
  strike(C, L, L.max, here);
  assert.ok(egLordsFell(C.F), 'the duel over: he falls');
});

// ── lane 1 #23, #24, #26, #32 ─────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV lane1 #23 and #32 THE TWINS: each twin turns its own phase, the Rivalry card said once a fight; their window is the Echoes\' own constant (SD_ECHO_PAIR_MS, 15 s) and the one court\'s EG_TWIN_ONE_MS (20 s) (mutants: Rivalry said twice; the window\'s literals)', () => {
  const C = court(1, 35, 'twins', { n: 3 });
  const here = C.subs.map((sub, j) => ({ sub, x: C.f.x + 3 + j, z: C.f.z + 3 }));
  C.step(here);
  for (const L of egLordsOf(C.F)) L.hp = L.max * 0.6;
  const out = C.step(here);
  assert.equal(out.filter((f) => f.k === 'eph').length, 2, 'both turned');
  assert.deepEqual(C.frames.filter((f) => f.k === 'esay' && f.w === 'phase').map((f) => f.t), ['Rivalry.'], 'the card once');
  const [a, b] = egLordsOf(C.F);
  assert.deepEqual(egLordsPairOf(C.F), { a: a.i, b: b.i, ms: SD_ECHO_PAIR_MS });
  assert.deepEqual([SD_ECHO_PAIR_MS, EG_TWIN_ONE_MS], [15_000, 20_000]);
  const O = court(1, 35, 'twins', { n: 2 });
  assert.equal(egLordsPairOf(O.F).ms, EG_TWIN_ONE_MS, 'one court: 20 s');
  const src = readFileSync(new URL('../../../src/net/eliteGates/egLords.js', import.meta.url), 'utf8');
  assert.ok(!/one \? 20_000 : 15_000|15_000\)\)/.test(src), 'no literal window');
});

test('AUDIT EG IV lane1 #24 THE LAST CHARGE\'S FALLEN THIRD RISES AS THE NEXT FALLS (section 13.4): each third told 5 s and fallen until the next third falls - 25 s on, never at its telling (mutants: risen at 20 s)', () => {
  const C = court(1, 25, 'ilthys', { n: 1 });
  const here = [{ sub: 'acct-0', x: C.f.x + 2, z: C.f.z }];
  C.L.hp = C.L.max * 0.3;
  for (let k = 0; k < 4 * 50; k++) C.step(here);
  const voids = C.frames.filter((f) => f.k === 'ez' && f.kind === 'void').map((f) => [f.from, f.until]);
  assert.ok(voids.length >= 2, 'two thirds fallen');
  for (let j = 1; j < voids.length; j++) assert.equal(voids[j - 1][1], voids[j][0], 'it rises as the next falls');
  assert.equal(voids[0][1] - voids[0][0], 20_000, 'fallen 20 s');
});

test('AUDIT EG IV lane1 #26 THE CROSSING AND BURNING PERCH ARE LORD BLOWS (section 13.2: "Depth adds 2% a circle"): the Twins\' Crossing at its depth\'s share, committed with the lead and the courts changed as it lands; the Wyrm\'s Burning Perch at its depth\'s share, through the union floor (mutants: the Crossing\'s fixed 35%; Burning Perch aimed past the floor)', () => {
  const C = court(1, 35, 'twins', { n: 3 });
  const here = C.subs.map((sub, j) => ({ sub, x: C.f.x + 3 + j, z: C.f.z + 3 }));
  C.F.mem.twins.crossAt = T0 + 500;
  const [a, b] = egLordsOf(C.F), az = a.z;
  let swapped = 0;
  for (let k = 0; k < 4 * 5; k++) { C.step(here); if (!swapped && Math.abs(a.z - az) > 5) swapped = C.now(); }
  const cross = C.frames.find((f) => f.k === 'eb' && f.nm === 'The Crossing');
  assert.ok(swapped >= cross.at && swapped < cross.at + 250, `they change courts as it lands (${swapped - cross.at} ms after)`);
  assert.ok(cross && Math.abs(cross.p - 0.35 * egShareX(C.F.c)) < 1e-9 && cross.p > 0.35, `its depth's share (${cross?.p})`);
  assert.equal(C.F.mem.twins.swapAt, 0, 'changed');
  assert.ok(Math.abs(a.z - az) > 5 && Math.abs(b.z - az) < 1, 'they changed courts');
  const W = court(1, 85, 'wyrm', { n: 1 });
  const wh = [{ sub: 'acct-0', x: W.f.x + 3, z: W.f.z + 3 }];
  for (let k = 0; k < 8; k++) W.step(wh);
  W.L.hp = W.L.max * 0.5;
  for (let k = 0; k < 16; k++) W.step(wh);
  const said = [];   // EG-PERFECT (PIN MOVED): thrown as the place's - said at once, never held (egLords.js lordBlow's `place`)
  egObjBroken(W.F, W.spec, egBodyById(W.F, W.L.perch), 'M0', W.now(), said);
  for (let k = 0; k < 4; k++) W.step(wh);
  const perch = said.find((f) => f.k === 'eb' && f.nm === 'Burning Perch');
  assert.ok(perch && Math.abs(perch.p - 0.45 * egShareX(W.F.c)) < 1e-9, `its depth's share (${perch?.p})`);
});
