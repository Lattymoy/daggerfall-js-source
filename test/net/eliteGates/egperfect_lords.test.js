// EG-PERFECT (2026-10-18, the Elite Gates arc; Mac: "On top of this work lets do a detailed pass on the Elite Breaches. I want to
// ensure the boss attacks, the design of the halls, and everything is absolutely perfect"; bible/11-Multiplayer/Elite-Gates.md
// sections 13.2, 13.3 and 13.4) - THE LORDS' BLOWS FAIR AND WHOLE: each finding of the lords' audit pinned on fights the real
// producers stand (net/eliteGates/egLaw.js egHallOf, net/eliteGates/egBodies.js egFightNew, net/eliteGates/egLords.js egLordsNew,
// egLordsWake and egLordsStep), the union floor's own search (net/eliteGates/egFloor.js), the wire and the screens:
//   THE UNION FLOOR sees a haven CHECK (#1), a duelist's ring (#6), a pool a blow will leave and a blow live past its landing;
//   a feint's cut carries its instant and never glints (#2); the Valkynaz' signatures at their second phase, holding its line
//   (#3); Burning Perch the place's, and the perches risen again (#4); the Riposte's guard seen (#5); the duel's ring kept (#6);
//   a kit's placing drops a stale run (#7); a run carries its body (#8); Grath's pace after a Scorch (#9); a blow's several
//   marks drawn (#10); the Wingbeat told (#11); the Conquest in turn and to its banner's fall (#12); the perched breath's
//   reach (#13); the Gore alone at melee (#14); a Wraith's chain snaps (#15); the Crossing's swap only as it lands (#16); a
//   lord never chooses a blow the floor would drop (#17); the Last Lesson told and an island's fall told as it cracks (#18);
//   one phase a beat; fury's chain said only with its first; Seyth's own Eclipse its chip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egLordsNew, egLordsWake, egLordsStep, egLordsOf, egObjsOf, egObjBroken, egLordHit, EG_LESSON_TELL_MS, EG_CONQUEST_EVERY_MS, EG_CONQUEST_TELL_MS,
  EG_ZONE_FIGHT_MS, EG_WYRM_REACH_M, EG_ECLIPSE_NM, EG_SNAP_NM, EG_LATTICE_W, EG_LATTICE_STEP_MS, EG_CAGE_AGAIN_MS, EG_SHUN_MS } from '../../../src/net/eliteGates/egLords.js';
import { egFightNew, egFightState, egHas, EG_FL, egBodyById, egBlowsStep, egAim, egUnionHeld, egCut, EG_RING_KEEP_M, EG_TELL_LEAD_MS } from '../../../src/net/eliteGates/egBodies.js';
import { egUnionHolds, egHavenCheck } from '../../../src/net/eliteGates/egFloor.js';
import { shDisc, shOut, egInBlow, egChainGapMs, EG_ESCAPE_MPS, EG_REACT_S } from '../../../src/net/eliteGates/egShape.js';
import { egFightView } from '../../../src/net/eliteGates/egWalkGraph.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { EG_BEAT_TRIAL_MS } from '../../../src/net/eliteGates/egDurable.js';
import { EG_WIND_GRACE_MS, egWindGraceMs } from '../../../src/scenes/eliteGates/egFight.js';
import { egRimOf, EG_GUARD_GLINT, EG_SHADE_RIM, egEclipseOfBlows, egEclipseChip } from '../../../src/world/eliteGates/egTelegraph.js';
import { PHASE_AT } from '../../../src/net/gate/gateBrain.js';
import { validEgOut, EG_SAY_KEYS } from '../../../src/net/wire.js';
import { egGive8Hall } from '../../egGive8.mjs';
import { egHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { shRing } from '../../../src/net/eliteGates/egShape.js';

const T0 = 1_800_000_000_000;
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const wire = (f) => validEgOut(JSON.parse(JSON.stringify(f)));

/** A lord's fight stood and woken as the director stands it, on spec law 8's ground (test/egGive8.mjs); `step(here)` beats it in the
 *  director's order (the lords, then the blows' words), every frame kept. */
function court(seed, h, key, { n = 2, rng = seeded(seed), law9 = false, r = 0 } = {}) {
  let spec = law9 ? egHallOf(seed, h, 0) : egGive8Hall(seed, h, 0);   // spec law 8's ground, or the build's own (LAW 9: storeys judged by height)
  if (r) spec = { ...spec, fl: spec.fl.map((q) => (q.t === 'd' ? { ...q, r } : q)) };   // (EG-PERFECT's audit: a lord on a wider floor than its own)
  assert.equal(spec.lord, key, `hall ${h} of seed ${seed} is ${key}'s`);
  const subs = Array.from({ length: n }, (_, i) => `acct-${i}`);
  const F = egFightNew(spec, T0, subs.map(() => 40), subs), frames = [], view = egFightView(spec);
  egLordsNew(F, spec, key, T0, frames, { decrees: {}, n });
  egLordsWake(F, spec, T0, frames, { n });
  let now = T0;
  const step = (here, ctx = {}) => { now += 250; const out = []; egLordsStep(F, spec, now, here, rng, out, { decrees: {}, n, ...ctx }); egBlowsStep(F, view, now, here, out); frames.push(...out); return out; };
  return { spec, F, L: egLordsOf(F)[0], subs, frames, step, now: () => now, view, f: spec.fl?.find((q) => q.t === 'd') ?? { x: 0, z: 0, r: 18 } };
}
const on = (C, dx = 3, dz = 3) => C.subs.map((sub, j) => ({ sub, x: C.f.x + dx + j, z: C.f.z + dz }));

// ── #1: THE HAVENS IN THE SET ───────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #1 THE UNION FLOOR SEES A HAVEN CHECK (section 13.2): an Eclipse pending (its havens three moon-shafts, r 3), a member in the only shaft near enough - a disc thrown on that shaft to land before the Eclipse is HELD (it would leave them only the dark to stand in), the same disc on a far shaft is not, and a CHECK is never itself held; an errand\'s failure blow (`on`) is no landing of the set (mutants: a haven CHECK skipped by the set; the CHECK held; a named failure blow read as a landing)', () => {
  const now = T0, floor = (x, z) => Math.hypot(x, z) <= 26;
  const eclipse = { s: [shOut([[0, 0, 3], [20, 0, 3], [-20, 0, 3]])], at: now + 1500, wu: 6000, ch: 1 };
  assert.ok(egHavenCheck(eclipse) && !egHavenCheck({ ...eclipse, on: ['a'] }) && !egHavenCheck({ s: [['a']], ch: 1 }));
  const onMine = { s: [shDisc(0, 0, 3.5)], at: now + 1100, wu: 1400, ch: 0 }, onFar = { s: [shDisc(20, 0, 3.5)], at: now + 1100, wu: 1400, ch: 0 };
  assert.equal(egUnionHolds([eclipse], onMine, 0, 0, now, floor), true, 'the only near shaft taken before the Eclipse: held');
  assert.equal(egUnionHolds([eclipse], onFar, 0, 0, now, floor), false, 'a far shaft taken: not held');
  assert.equal(egUnionHolds([], onMine, 0, 0, now, floor), false, 'no Eclipse pending: an escapable disc');
  assert.equal(egUnionHolds([onMine], eclipse, 0, 0, now, floor), false, 'the CHECK itself is never held');
  assert.equal(egUnionHolds([{ ...eclipse, on: ['x'] }], onMine, 0, 0, now, floor), false, 'a named failure blow is no landing of the set');
});

test('EG-PERFECT #1 THE GROUND A BLOW LEAVES (section 13.2): a pool a pending blow will leave (`F.mem.pools`) and a blow live past its landing (`sp`) burn in the set at every later landing - an Eclipse of two moon-shafts, the member in one: with that shaft burning at the Eclipse, a disc that takes the other is held; with nothing burning there, it is not (egUnionHeld) (mutants: pools unread; a live blow\'s span unread)', () => {
  const C = court(1, 75, 'seyth', { n: 1 });
  const F = C.F, fx = C.f.x, fz = C.f.z, here = [{ sub: 'acct-0', x: fx, z: fz }], now = C.now();
  F.blows.length = 0; F.zones = []; delete F.mem.pools;
  const eclipse = egAim(F, C.spec, { o: C.L.i, s: [shOut([[fx, fz, 3], [fx + 5.5, fz, 3]])], at: now + 2500, wu: 2500, p: 0.3, b: 0, nm: EG_ECLIPSE_NM, ch: 1 }, [], now - 3500, []);
  assert.ok(eclipse);
  const meteor = egAim(F, C.spec, { o: C.L.i, s: [shDisc(fx, fz, 2.5)], at: now + 1500, wu: 1500, p: 0.3, b: 0, nm: 'Meteor' }, [], now, []);
  assert.ok(meteor);
  const probe = { i: 999, o: C.L.i, s: [shDisc(fx + 5.5, fz, 3.5)], at: now + 2000, wu: 1300, ch: 0 };
  assert.equal(egUnionHeld(F, C.spec, probe, here, now), false, 'nothing burning over my shaft: the disc on the other is free');
  F.mem.pools = { [meteor.i]: [3.2, 6000, 0.1, 0] };
  assert.equal(egUnionHeld(F, C.spec, probe, here, now), true, 'the pending Meteor\'s pool burning my shaft at the Eclipse: the disc on the other is held');
  // a blow live past its landing (`sp`): a disc of r 5 on me landing at 2 s and burning to 8 s, then a ring taking every cell past
  // r 5 at 4 s - with the disc still burning there is nowhere left: held; were it gone at its landing, I would walk back into it
  delete F.mem.pools; F.blows.length = 0;
  const live = egAim(F, C.spec, { o: C.L.i, s: [shDisc(fx, fz, 5)], at: now + 2000, wu: 2000, p: 0.3, b: 0, nm: 'Burning Bridge', sp: 6000 }, [], now, []);
  assert.ok(live);
  const ring = { i: 998, o: C.L.i, s: [shRing(fx, fz, 5, 30)], at: now + 4000, wu: 1500, ch: 0 };
  assert.equal(egUnionHeld(F, C.spec, ring, here, now), true, 'a blow still live where I could stand: held');
  live.sp = 0;
  assert.equal(egUnionHeld(F, C.spec, ring, here, now), false, 'gone at its landing: its ground mine again, not held');
});

// ── #2: A FEINT'S CUT ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #2 A FEINT NEVER GLINTS (section 13.2, "Tells only the engine can give"): its cut says the instant it was cut at - its FEINT_AT, however late the relay\'s beat - the wire carries it, every screen freezes the fill there; and the WIND waits the relay\'s beat and the way here past FEINT_AT, so no feint\'s WIND sounds before its cut can come (mutants: the cut\'s instant dropped; the wire stripping it; the fill frozen at the frame; the grace the way alone)', () => {
  const F = { blows: [{ i: 7, at: T0 + 1500, wu: 1500 }] }, out = [];
  egCut(F, 7, out, T0 + 825);
  assert.deepEqual(out, [{ k: 'ecut', i: 7, at: T0 + 825 }]);
  assert.deepEqual(wire(out[0]), { k: 'ecut', i: 7, at: T0 + 825 }, 'the wire carries it');
  const C = court(1, 15, 'spellmaster', { n: 3 });
  for (let k = 0; k < 4 * 40 && !C.frames.some((f) => f.k === 'ecut'); k++) C.step(on(C));
  const cut = C.frames.find((f) => f.k === 'ecut'), eb = C.frames.find((f) => f.k === 'eb' && f.i === cut?.i);
  assert.ok(cut && eb, 'an image\'s feint cut');
  assert.equal(cut.at, eb.at - eb.wu + Math.round(eb.wu * 0.55), 'cut at its own FEINT_AT');
  let E = foldEg(EG_STATE_EMPTY, wire(egFightState(C.F, eb.at - eb.wu)), eb.at - eb.wu);
  E = foldEg(E, wire(eb), eb.at - eb.wu);
  const E2 = foldEg(E, wire(cut), cut.at + 180);
  assert.equal(E2.fight.blows[0].cut, cut.at, 'the screen freezes the fill at the cut\'s own instant, never its arrival');
  assert.ok(EG_WIND_GRACE_MS >= EG_BEAT_TRIAL_MS + 150, 'the WIND waits a beat and the way here');
});

// ── #3: THE VALKYNAZ' SIGNATURES AT THEIR SECOND PHASE ─────────────────────────────────────────────────────────────────────
test('EG-PERFECT #3 A SIGNATURE ERRAND STARTS AT ITS PHASE\'S TURN (section 13.2): Ilthys, Morvayn and Seyth fight a minute of their first phase with no banner, no chain, no mirror; at the second phase\'s turn each calls it, holding the third phase\'s line strictly above it (`hpFloor`) until its first round resolves - the banners broken, the chains\' twenty seconds run, both mirrors shattered (mutants: a signature at the wake; no hold; a hold never freed; a hold set over a health already past the line)', () => {
  const minute = (C) => { for (let k = 0; k < 4 * 60; k++) C.step(on(C)); };
  // Ilthys: the Conquest
  {
    const C = court(1, 25, 'ilthys', { n: 2 });
    minute(C);
    assert.equal(egObjsOf(C.F, 'banner').length, 0, 'Ilthys: no banner in her first phase');
    C.L.hp = C.L.max * 0.6; C.step(on(C));
    assert.equal(C.L.ph, 2);
    assert.ok(C.L.hpFloor > C.L.max * PHASE_AT[1] && C.L.hpFloor - 1 <= C.L.max * PHASE_AT[1], 'her line held strictly above the third phase\'s');
    for (let k = 0; k < 4 * 20; k++) C.step(on(C));
    const banners = egObjsOf(C.F, 'banner');
    assert.equal(banners.length, 3, 'three banners in her second phase');
    for (const b of banners) egObjBroken(C.F, C.spec, b, 'M0', C.now(), []);
    C.step(on(C));
    assert.equal(C.L.hpFloor, null, 'the round broken: her line freed');
  }
  // Morvayn: the Chaining
  {
    const C = court(1, 50, 'morvayn', { n: 3 });
    minute(C);
    assert.equal((C.F.mem.chains ?? []).length, 0, 'Morvayn: no chain in her first phase');
    C.L.hp = C.L.max * 0.6; C.step(on(C));
    assert.ok((C.F.mem.chains ?? []).length > 0 && C.L.hpFloor != null, 'chains at the turn, the line held');
    for (let k = 0; k < 4 * 21; k++) C.step(on(C));
    assert.equal(C.L.hpFloor, null, 'the first chains run: freed');
  }
  // Seyth: the Mirrorcourt
  {
    const C = court(1, 75, 'seyth', { n: 2 });
    minute(C);
    assert.equal(egLordsOf(C.F).filter((L) => egHas(L, EG_FL.mirror)).length, 0, 'Seyth: no mirror in his first phase');
    C.L.hp = C.L.max * 0.6; C.step(on(C));
    const mirrors = egLordsOf(C.F).filter((L) => egHas(L, EG_FL.mirror));
    assert.ok(mirrors.length === 2 && C.L.hpFloor != null, 'two mirrors at the turn, the line held');
    // a mirror shattered the seam's way (net/eliteGates/egLords.js egLordHit at nought)
    egLordHit(C.F, C.spec, mirrors[0], 'acct-0', 'M0', 1, null, C.now(), on(C), (mirrors[0].hp = 0, []));
    assert.ok(C.L.hpFloor != null, 'one shattered: still held');
    egLordHit(C.F, C.spec, mirrors[1], 'acct-0', 'M0', 1, null, C.now(), on(C), (mirrors[1].hp = 0, []));
    assert.equal(C.L.hpFloor, null, 'both shattered: freed');
  }
  // a burst past both lines: the second phase's mechanic still called, the third turned in the same beat, and no hold set over a
  // health already past its line
  {
    const C = court(1, 25, 'ilthys', { n: 2 });
    C.L.hp = C.L.max * 0.2;
    const o = C.step(on(C));
    assert.equal(C.L.ph, 3, 'the third phase');
    assert.deepEqual(o.filter((f) => f.k === 'eph').map((f) => f.ph), [2, 3], 'both turns said');
    assert.ok(C.F.mem.conquest && egObjsOf(C.F, 'banner').length === 1, 'the second phase\'s Conquest called, never skipped');
    assert.ok(C.L.hpFloor == null, 'no floor over the health it has');
  }
});

// ── #12: THE CONQUEST IN TURN ───────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #12 THE CONQUEST IN TURN (section 13.4): her banners planted one every EG_CONQUEST_EVERY_MS, each third told EG_CONQUEST_TELL_MS and burning until its own banner falls - to the fight\'s end, kept (`whole`) - its fall ending its burn on every screen; the next Conquest only once the round\'s three are down (mutants: all three at once; a burn that goes out on its own; a broken banner\'s third still burning)', () => {
  const C = court(1, 25, 'ilthys', { n: 2 });
  C.L.hp = C.L.max * 0.6; C.step(on(C));
  const t0 = C.now(), count = () => egObjsOf(C.F, 'banner').length;
  assert.equal(count(), 1, 'one banner at the turn');
  const z0 = egObjsOf(C.F, 'banner')[0].zone;
  assert.equal(z0.from - t0, EG_CONQUEST_TELL_MS, 'its third told first');
  assert.ok(z0.until - t0 >= EG_ZONE_FIGHT_MS, 'burning to the fight\'s end');
  assert.ok(C.F.keep.some((q) => q.src === z0.i), 'kept whole');
  while (C.now() < t0 + EG_CONQUEST_EVERY_MS - 250) C.step(on(C));
  assert.equal(count(), 1, 'still one a moment before the second');
  C.step(on(C)); C.step(on(C));
  assert.equal(count(), 2, 'the second in its turn');
  const b0 = egObjsOf(C.F, 'banner')[0], said = [];
  egObjBroken(C.F, C.spec, b0, 'M0', C.now(), said);
  assert.ok(said.some((f) => f.k === 'ez' && f.i === z0.i && f.until === C.now()), 'its third\'s burn ended, said');
  assert.equal(C.F.keep.find((q) => q.src === z0.i).until, C.now(), 'and its keep with it');
});

// ── #4: BURNING PERCH AND THE PERCHES RISEN ─────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #4 BURNING PERCH IS THE PLACE\'S, AND THE PERCHES RISE AGAIN (section 13.3): a member on the perch the Wyrm leaves - its eruption said at once, never held (the perch\'s top is all of it, its only way off a stair); the pillars broken in its first phase rise again molten at its second\'s turn, said (mutants: Burning Perch through the union floor; no pillar risen)', () => {
  const W = court(1, 85, 'wyrm', { n: 1 });
  for (let k = 0; k < 8; k++) W.step([{ sub: 'acct-0', x: W.f.x + 3, z: W.f.z + 3 }]);
  const pillars = egObjsOf(W.F, 'pillar');
  assert.equal(pillars.length, 3);
  for (const p of pillars.filter((q) => q.i !== W.L.perch)) egObjBroken(W.F, W.spec, p, 'M0', W.now(), []);
  assert.equal(egObjsOf(W.F, 'pillar').length, 1);
  W.L.hp = W.L.max * 0.6;
  const o = W.step([{ sub: 'acct-0', x: W.f.x + 3, z: W.f.z + 3 }]);
  assert.equal(W.L.ph, 2);
  assert.equal(egObjsOf(W.F, 'pillar').length, 3, 'its perches risen again');
  assert.ok(o.some((f) => f.k === 'esay' && f.w === 'perches') && EG_SAY_KEYS.includes('perches'), 'said, and the wire carries it');
  const perch = egBodyById(W.F, W.L.perch), here = [{ sub: 'acct-0', x: perch.x, z: perch.z, y: perch.y }], said = [];
  egObjBroken(W.F, W.spec, perch, 'M0', W.now(), said);
  const eb = said.find((f) => f.k === 'eb' && f.nm === 'Burning Perch');
  assert.ok(eb && Math.hypot(eb.s[0][1] - perch.x, eb.s[0][2] - perch.z) < 0.01, 'said at once, on the perch');
  W.step(here);
  assert.ok(!W.F.held.some((h) => h.b.nm === 'Burning Perch') && W.F.blows.some((b) => b.nm === 'Burning Perch'), 'never held, a member on its perch or not');
});

// ── #5: THE RIPOSTE'S GUARD ─────────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #5 THE RIPOSTE\'S GUARD IS SEEN (section 13.3, "his blade raised, glinting"): a body flagged `lit` glints EG_GUARD_GLINT in every band, over the Shade\'s rim; unlit, the band\'s own (mutants: the flag unread; the Shade\'s rim over the guard)', () => {
  assert.deepEqual(egRimOf(0, EG_FL.lit), EG_GUARD_GLINT);
  assert.deepEqual(egRimOf(2, EG_FL.lit), EG_GUARD_GLINT, 'over the Shade\'s rim');
  assert.deepEqual(egRimOf(2, 0), EG_SHADE_RIM);
  assert.equal(egRimOf(0, 0), null);
  const C = court(1, 10, 'armsmaster', { n: 1 });
  let lit = false;
  for (let k = 0; k < 4 * 60 && !lit; k++) lit = C.step([{ sub: 'acct-0', x: C.L.x + 2, z: C.L.z }]).some((f) => f.k === 'efl' && f.i === C.L.i && (f.fl & EG_FL.lit));
  assert.ok(lit, 'his guard rises, flagged for every screen');
});

// ── #6: THE DUEL'S RING ─────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #6 THE DUEL\'S RING HOLDS ITS LORD (section 13.3, "a ring of fire rises around the two"): while his own duel stands the Armsmaster goes at his duelist alone, every place he ends a run inside the ring, and the union floor plans a duelist\'s escape inside its fire - a disc at the ring\'s heart that leaves no cell inside it is held; Garoth\'s Slam, Meteor and Kyn\'s Due are set aside in his (mutants: the lord off his ring; a non-duelist struck; the duelist\'s floor the whole court; the ring-filling blows thrown)', () => {
  const C = court(1, 10, 'armsmaster', { n: 3 });
  C.L.duelAt = C.now();
  C.step(on(C));
  const ch = C.F.mem.challenge;
  assert.ok(ch && ch.r === 6, 'a ring stands');
  const duelist = ch.subs[0];
  // the duelist keeps to the ring's far side from him (4.5 m out, across its heart) - a Lunge's reach, its run toward the fire
  const far = () => { const dx = C.L.x - ch.x, dz = C.L.z - ch.z, d = Math.hypot(dx, dz) || 1; return { x: ch.x - (dx / d) * 4.5, z: ch.z - (dz / d) * 4.5 }; };
  const here = () => C.subs.map((sub, j) => (sub === duelist ? { sub, ...far() } : { sub, x: ch.x + 15 + j, z: ch.z + 15 }));
  let lunges = 0;
  for (let k = 0; k < 4 * 14 && C.F.mem.challenge; k++) {
    const o = C.step(here());
    lunges += o.filter((f) => f.k === 'eb' && f.nm === 'Lunge').length;
    for (const f of o.filter((q) => q.k === 'eb' && q.o === C.L.i)) for (const s of f.s) if (s[0] === 'd' || s[0] === 'c' || s[0] === 'l') assert.ok(Math.hypot(s[1] - ch.x, s[2] - ch.z) <= 12, `${f.nm} at the ring`);
    if (C.F.mem.challenge) assert.ok(dist(C.L, ch) <= ch.r - C.L.r + 0.5, `the lord inside his ring (${dist(C.L, ch).toFixed(2)} m)`);
  }
  assert.ok(lunges > 0, 'he lunged in the duel');
  // the union floor plans the duelist's escape inside the fire
  const F = C.F;
  F.mem.challenge = { by: C.L.i, subs: [duelist], x: ch.x, z: ch.z, r: 6, until: C.now() + 10_000 }; F.pg.ring = [ch.x, ch.z, 6]; F.blows.length = 0;
  const filling = { i: 990, o: C.L.i, s: [shDisc(ch.x, ch.z, 6 - EG_RING_KEEP_M + 0.2)], at: C.now() + 1600, wu: 1600, ch: 0 };
  assert.equal(egUnionHeld(F, C.spec, filling, [{ sub: duelist, x: ch.x, z: ch.z }], C.now()), true, 'a disc filling the ring: held for the duelist');
  // PIN MOVED (THE AUDIT): a member outside the duel is kept OUT of its ring (every screen's ringKeep) - the court beyond it is
  // theirs, its inside never: beside the ring under a disc over both, they run out; at its heart (where no screen stands them)
  // the ring's inside is no ground of theirs
  const over = { ...filling, i: 991, s: [shDisc(ch.x, ch.z, 8)] };
  assert.equal(egUnionHeld(F, C.spec, over, [{ sub: 'acct-x', x: ch.x + 6.6, z: ch.z }], C.now()), false, 'the same blow on a member outside the duel, beside its ring: the court is theirs');
  assert.equal(egUnionHeld(F, C.spec, filling, [{ sub: 'acct-x', x: ch.x, z: ch.z }], C.now()), true, 'the ring\'s inside no ground of theirs');
  // Garoth's ring-filling blows set aside in his duel
  const G = court(1, 100, 'garoth', { n: 2 });
  G.L.hp = G.L.max * 0.6; G.step(on(G));
  assert.ok(G.F.mem.challenge, 'the Clan Muster\'s duel');
  // (PIN MOVED, EG-PERFECT's audit: the member outside the duel stands beside its ring, where the court is theirs - inside it, THE
  // UNION FLOOR now holds every blow over the ring for them, and the duel's own setting-aside went unseen)
  const gch = G.F.mem.challenge, gd = gch.subs[0];
  const gHere = () => G.subs.map((sub, j) => (sub === gd ? { sub, x: gch.x + 1, z: gch.z } : { sub, x: gch.x + gch.r + 4 + j, z: gch.z }));
  const names = new Set();
  for (let k = 0; k < 4 * 14 && G.F.mem.challenge; k++) for (const f of G.step(gHere()).filter((q) => q.k === 'eb' && q.o === G.L.i)) names.add(f.nm);
  for (const nm of ['Slam', "The Kyn's Due"]) assert.ok(!names.has(nm), `no ${nm} in the duel`);
  assert.ok(![...names].some((n) => /Meteor|Comet|Hail|Bolt/.test(n) && n !== 'Wellfire'), 'no Meteor in the duel');
});

// ── #7, #8: RUNS ────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #7 #8 A RUN CARRIES ITS BODY, A KIT\'S PLACING DROPS IT (section 11.7): a champion\'s Charge walks its body down the lane from the landing, there within the run\'s time; the Night-Stalker vanishing mid-run rises at the true umbra and stays (mutants: the body moved only after its recovery; a stale run applied after a rising)', () => {
  // a champion's Charge
  const P = (() => { for (const [seed, h] of [[1, 3], [2, 3], [3, 3], [4, 3], [5, 3]]) { const spec = egGive8Hall(seed, h, 0); if (spec.kind === 'proving') return [seed, h, spec]; } return null; })();
  assert.ok(P, 'a Proving Walk');
  const [seed, , spec] = P, key = 'kynreeve';
  const subs = ['acct-0'], F = egFightNew(spec, T0, [40], subs), view = egFightView(spec), rng = seeded(seed);
  egLordsNew(F, spec, key, T0, [], { decrees: {}, n: 1 });
  egLordsWake(F, spec, T0, [], { n: 1 });
  const L = egLordsOf(F)[0];
  let now = T0, charge = null, path = [];
  for (let k = 0; k < 4 * 90 && !charge; k++) {
    now += 250;
    const here = [{ sub: 'acct-0', x: L.x + 12, z: L.z }], out = [];
    egLordsStep(F, spec, now, here, rng, out, { decrees: {}, n: 1 }); egBlowsStep(F, view, now, here, out);
    charge = out.find((f) => f.k === 'eb' && f.nm === 'Charge') ?? null;
  }
  assert.ok(charge, 'a Charge thrown');
  const start = [L.x, L.z];
  while (now < charge.at + (charge.sp ?? 900) + 250) { now += 250; const out = []; egLordsStep(F, spec, now, [{ sub: 'acct-0', x: start[0] + 30, z: start[1] }], rng, out, { decrees: {}, n: 1 }); egBlowsStep(F, view, now, [], out); path.push([now, L.x, L.z]); }
  const moved = path.filter(([t]) => t <= charge.at + (charge.sp ?? 900) + 250).some(([, x, z]) => Math.hypot(x - start[0], z - start[1]) > 3);
  assert.ok(moved, 'its body down the lane within its run');
  // the Night-Stalker: a run dropped as he vanishes
  const S = court(1, 55, 'stalker', { n: 2 });
  S.L.atk = { at: S.now() + 100, until: S.now() + 5000, to: [S.L.x + 9, S.L.z], run: 400 };
  S.F.mem.vanishAt = S.now();
  S.step(on(S));
  assert.equal(S.L.atk, null, 'the run dropped as he vanishes');
});

// ── #9, #14, #18: GRATH ─────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #9 #14 #18 GRATH\'S GROUND (section 13.3): a Scorch ends the hunt\'s pace and its marks; a company of one meets his Gore at melee; an island told fallen as it cracks - its void from its fall, a landing of the union floor from the crack\'s word (mutants: 5.2 m/s after a Scorch; the marks kept; the Gore\'s gap at one; the fall zoned only as it falls)', () => {
  const C = court(12345, 5, 'hound', { n: 2 });
  C.L.speed = 5.2; C.F.mem.scent = [{ sub: 'acct-0', until: C.now() + 8000 }];
  C.F.marks = [['acct-0', 0, C.now() + 8000, 1]];
  const isle = egObjsOf(C.F, 'isle').find((o) => dist(o, C.L) <= 11);
  isle.st = 1; isle.stAt = C.now() + 2000;
  C.step([{ sub: 'acct-0', x: C.L.x + 6, z: C.L.z }, { sub: 'acct-1', x: C.L.x - 6, z: C.L.z }]);
  assert.equal(C.L.speed, 3.4, 'his own pace again');
  assert.ok(!C.F.marks.some((m) => m[0] === 'acct-0' && m[1] === 0), 'the Scent\'s mark lifted');
  // an island cracking is told as a void from its fall: his Leap at the company on another island cracks his own
  const G = court(12345, 5, 'hound', { n: 2 });
  const other = egObjsOf(G.F, 'isle').find((o) => dist(o, G.L) > 11);
  G.F.mem.scentAt = Infinity;
  for (let k = 0; k < 4 * 40 && !(G.F.zones ?? []).some((z) => z.kind === 'void'); k++) G.step([{ sub: 'acct-0', x: other.x, z: other.z }, { sub: 'acct-1', x: other.x + 2, z: other.z }]);
  const v = (G.F.zones ?? []).find((z) => z.kind === 'void');
  assert.ok(v, 'the leap cracks his island');
  const cracked = egObjsOf(G.F, 'isle').find((o) => o.st === 1);
  assert.ok(cracked && v.from === cracked.stAt && v.until === cracked.stAt + 15_000, 'its void from its fall, told as it cracks');
  // a company of one: the Gore at melee
  const S = court(12345, 5, 'hound', { n: 1 });
  let gores = 0;
  for (let k = 0; k < 4 * 90; k++) gores += S.step([{ sub: 'acct-0', x: S.L.x + S.L.r + 1, z: S.L.z }]).filter((f) => f.k === 'eb' && f.nm === 'Gore').length;
  assert.ok(gores >= 4, `the Gore at melee for a company of one (${gores})`);
});

// ── #10: SEVERAL MARKS ──────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #10 A BLOW OF SEVERAL MARKS DRAWS THEM (section 13.2\'s targeting): over Seyth\'s Moonshatters at a company of six, every member is marked at least once - never only the company\'s first three (mutants: `here`\'s first three)', () => {
  const C = court(1, 75, 'seyth', { n: 6 });
  const here = C.subs.map((sub, j) => ({ sub, x: C.f.x + Math.sin(j) * 8, z: C.f.z + Math.cos(j) * 8 })), marked = new Set();
  for (let k = 0; k < 4 * 240; k++) for (const f of C.step(here).filter((q) => q.k === 'eb' && q.nm === 'Moonshatter')) for (const s of f.s) { const m = here.find((q) => Math.hypot(q.x - s[1], q.z - s[2]) < 0.6); if (m) marked.add(m.sub); }
  assert.ok(marked.size >= 5, `the company's marks drawn (${[...marked].join(' ')})`);
});

// ── #13: THE PERCHED BREATH ─────────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #13 THE PERCHED BREATH REACHES (section 13.3): perched, the Wyrm\'s Breath runs as far as its mark and 6 m past, never past EG_WYRM_REACH_M; grounded, its 16 m (mutants: 16 m from the perch)', () => {
  const W = court(1, 85, 'wyrm', { n: 1 });
  let br = null;
  for (let k = 0; k < 4 * 60 && !br; k++) br = W.step([{ sub: 'acct-0', x: W.f.x, z: W.f.z }]).find((f) => f.k === 'eb' && f.nm === 'Breath') ?? null;
  assert.ok(br, 'a Breath from the perch');
  const s = br.s[0], len = Math.hypot(s[3] - s[1], s[4] - s[2]);
  assert.ok(len > 16 && len <= EG_WYRM_REACH_M + 0.01, `its lane ${len.toFixed(1)} m`);
});

// ── #15: A WRAITH'S CHAIN ───────────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #15 A WRAITH\'S CHAIN SNAPS (section 13.4, "kill it to break the chain"): a company of one chained to a Wraith runs past 8 m of it - the snap lands on them (`on`), a CHECK; within 8 m nothing (mutants: a Wraith\'s chain binding nothing)', () => {
  const C = court(1, 50, 'morvayn', { n: 1 });
  C.L.hp = C.L.max * 0.6; C.step([{ sub: 'acct-0', x: C.f.x, z: C.f.z }]);
  const t = C.F.tethers.find((q) => q[2] === 2 && typeof q[0] !== 'string');
  assert.ok(t, 'the member alone chained to a Wraith');
  const w = egBodyById(C.F, t[0]);
  let snap = C.step([{ sub: 'acct-0', x: w.x + 3, z: w.z }]).find((f) => f.k === 'eb' && f.nm === EG_SNAP_NM);
  assert.ok(!snap, 'close: nothing');
  snap = C.step([{ sub: 'acct-0', x: w.x + 12, z: w.z }]).find((f) => f.k === 'eb' && f.nm === EG_SNAP_NM);
  assert.ok(snap && snap.ch === 1 && snap.on?.[0] === 'acct-0', 'stretched: the snap on them');
});

// ── #16: THE CROSSING ───────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #16 THE TWINS CHANGE COURTS ONLY AS THE CROSSING LANDS (section 13.3): a Crossing the union floor drops changes nothing and is tried again EG_CROSS_AGAIN_MS on; one said swaps them as it lands (mutants: the swap at the committed landing whatever became of the blow)', () => {
  const C = court(1, 35, 'twins', { n: 3 });
  const here = on(C), T = C.F.mem.twins, [a] = egLordsOf(C.F), az = a.z;
  T.crossAt = C.now() + 250;
  C.step(here);
  assert.ok(T.cross > 0 && T.swapAt > 0, 'a Crossing committed');
  // dropped: gone from the pending, the held and the said
  C.F.pend = (C.F.pend ?? []).filter((p) => p.b.i !== T.cross); C.F.held = C.F.held.filter((q) => q.b.i !== T.cross); C.F.blows = C.F.blows.filter((q) => q.i !== T.cross);
  for (let k = 0; k < 16; k++) C.step(here);
  assert.ok(Math.abs(a.z - az) < 1, 'no swap for a dropped Crossing');
  assert.ok(T.crossAt > C.now() && T.crossAt - C.now() <= 10_000, 'tried again soon');
});

// ── #17: A BLOW WEIGHED BEFORE IT IS CHOSEN ─────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #17 A LORD NEVER CHOOSES A BLOW THE FLOOR WOULD DROP (section 13.2): Ilthys against a member on a balcony for two minutes - no blow she commits is held past the union floor\'s ticks and dropped (mutants: the weighing skipped)', () => {
  const C = court(1, 25, 'ilthys', { n: 1, law9: true });   // LAW 9: the balcony its own storey (section 2), a floor of r 5
  const bal = (C.spec.fl ?? []).find((q) => q.t === 'd' && q !== C.f && (q.y ?? 0) > (C.f.y ?? 0) + 3);
  assert.ok(bal, 'a balcony over her floor');
  const here = [{ sub: 'acct-0', x: bal.x, z: bal.z, y: bal.y }], seenHeld = new Set(), said = new Set();
  for (let k = 0; k < 4 * 120; k++) { for (const f of C.step(here)) if (f.k === 'eb') said.add(f.i); for (const q of C.F.held) if (q.b.o === C.L.i) seenHeld.add(q.b.i); }
  const dropped = [...seenHeld].filter((i) => !said.has(i));
  assert.ok(dropped.length <= 1, `blows dropped: ${dropped.length}`);
});

// ── #18: THE LAST LESSON TOLD ───────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT #18 THE LAST LESSON\'S RING TOLD (section 13.2, "a ground burning told and not yet down"): each step of the ring burns EG_LESSON_TELL_MS after its word, and until the next is down - one ring at a time, never a gap (mutants: untold; a gap between rings)', () => {
  const C = court(1, 10, 'armsmaster', { n: 1 });
  C.L.hp = C.L.max * 0.3; C.step([{ sub: 'acct-0', x: C.f.x, z: C.f.z }]); C.step([{ sub: 'acct-0', x: C.f.x, z: C.f.z }]);
  assert.equal(C.L.ph, 3);
  let ez = null;
  for (let k = 0; k < 4 * 8 && !ez; k++) ez = C.step([{ sub: 'acct-0', x: C.f.x, z: C.f.z }]).find((f) => f.k === 'ez' && f.s[0] === 'r') ?? null;
  assert.ok(ez && ez.from - C.now() === EG_LESSON_TELL_MS, 'told first');
  let next = null;
  for (let k = 0; k < 4 * 8 && !next; k++) next = C.step([{ sub: 'acct-0', x: C.f.x, z: C.f.z }]).find((f) => f.k === 'ez' && f.s[0] === 'r') ?? null;
  assert.equal(next.from, ez.until, 'the next burns as the last goes out');
});

// ── fury's chain with its first ─────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT FURY\'S CHAIN IS SAID ONLY WITH ITS FIRST (section 13.2): a chained shape is said only once its first is - after it, its fill from the first\'s landing - and one whose first was dropped is never said (mutants: the chain said alone)', () => {
  const C = court(1, 75, 'seyth', { n: 1 });
  const F = C.F, now = C.now(), here = [{ sub: 'acct-0', x: C.f.x, z: C.f.z }];
  const pair = () => {
    F.blows.length = 0; F.held = []; F.pend = [];
    const first = egAim(F, C.spec, { o: C.L.i, s: [shDisc(C.f.x + 10, C.f.z, 3)], at: now + 1400, wu: 1400, p: 0.3, nm: 'Frost Lance' }, here, now, [], 400);
    const chain = egAim(F, C.spec, { o: C.L.i, s: [shDisc(C.f.x + 10, C.f.z, 3)], at: now + 2400, wu: 1000, ol: 1400, p: 0.3, nm: 'Frost Lance (fury)' }, here, now, [], 400);
    chain.after = first.i;
    return [first, chain];
  };
  // the first dropped (gone from the pending before its word): its chain is never said
  {
    const [first, chain] = pair(), out = [];
    F.pend = F.pend.filter((p) => p.b !== first);
    for (let k = 0; k < 8; k++) egBlowsStep(F, C.view, now + 400 + 250 * k, here, out);
    assert.ok(!out.some((f) => f.k === 'eb' && f.i === chain.i), 'its first dropped: never said');
  }
  // the chain's word before its first's (its first still pending): said after it, the fill from the first's landing
  {
    const [first, chain] = pair(), out = [];
    F.pend.reverse();
    egBlowsStep(F, C.view, now + 400, here, out);
    const fe = out.find((f) => f.k === 'eb' && f.i === first.i), ce = out.find((f) => f.k === 'eb' && f.i === chain.i);
    assert.ok(fe && ce && out.indexOf(ce) > out.indexOf(fe), 'said after its first');
    assert.equal(ce.at - ce.wu, fe.at, 'its fill from the first\'s landing');
  }
});

// ── Seyth's own Eclipse ─────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-PERFECT SEYTH\'S OWN ECLIPSE (sections 13.4 and 25.5): her Eclipse blow is read as the Vault\'s place hazard - told from its word, its chip counting down, live at its landing (mutants: a lord\'s Eclipse unread)', () => {
  const bl = { i: 4, nm: EG_ECLIPSE_NM, ch: 1, at: T0 + 6000, wu: 6000, s: [shOut([[1, 2, 3], [5, 6, 3]])] };
  assert.equal(egEclipseOfBlows([bl], T0 - 1), null, 'not yet told');
  const e = egEclipseOfBlows([bl], T0 + 1000);
  assert.ok(e && !e.live && Math.abs(e.secs - 5) < 1e-9 && e.havens.length === 2);
  assert.equal(egEclipseChip(e), 'The Eclipse - 5');
  assert.ok(egEclipseOfBlows([bl], T0 + 6100).live, 'live at its landing');
  assert.equal(egEclipseOfBlows([{ ...bl, nm: 'Slam' }], T0 + 1000), null, 'another blow is none');
});

// ── THE AUDIT'S UPGRADES: the Lattice a sweep, the cage again, Wellfire aimed ──────────────────────────────────────────
test('EG-PERFECT THE ARCANE LATTICE A SWEEP (the lords\' audit, the Spellmaster: "the 4 m gaps at 0 and +-8 m are never struck"): its strips EG_LATTICE_W wide side by side over his whole floor - no strip of it untouched - each landing EG_LATTICE_STEP_MS after the last, from the side farthest from its mark across it, so the strip safe is the one just burned (mutants: the four fixed strips; the strips landing at once; the sweep toward its mark\'s side first)', () => {
  const C = court(1, 15, 'spellmaster', { n: 1, rng: seeded(3) });
  let lattice = [];
  for (let k = 0; k < 600 && lattice.length < 2; k++) { C.step([{ sub: 'acct-0', x: C.f.x + 6, z: C.f.z + 2 }]); lattice = C.frames.filter((f) => f.k === 'eb' && f.nm === 'Arcane Lattice'); }
  assert.ok(lattice.length >= 2, 'the Lattice thrown');
  // the first throw's strips: every eb of that name within its sweep
  const t0 = lattice[0].at, sweep = C.frames.filter((f) => f.k === 'eb' && f.nm === 'Arcane Lattice' && f.at >= t0 && f.at <= t0 + EG_LATTICE_STEP_MS * 20).sort((a, b) => a.at - b.at);
  const n = Math.max(3, Math.floor((2 * C.f.r) / EG_LATTICE_W));
  assert.equal(sweep.length, n, `${sweep.length} strips over a floor of r ${C.f.r}`);
  sweep.forEach((b, j) => { if (j) assert.equal(b.at - sweep[j - 1].at, EG_LATTICE_STEP_MS, 'each a step after the last'); assert.equal(b.s[0][5], EG_LATTICE_W); });
  // side by side: each strip's line a strip's width from the last's, across the floor
  const mid = (b) => [(b.s[0][1] + b.s[0][3]) / 2, (b.s[0][2] + b.s[0][4]) / 2];
  for (let j = 1; j < sweep.length; j++) { const [ax, az] = mid(sweep[j - 1]), [bx, bz] = mid(sweep[j]); assert.ok(Math.abs(Math.hypot(bx - ax, bz - az) - EG_LATTICE_W) < 0.02, `strip ${j} a width from the last`); }
  // from the side farthest from its mark: the first strip farther from the member than the last
  const me = { x: C.f.x + 6, z: C.f.z + 2 }, d = (b) => Math.hypot(mid(b)[0] - me.x, mid(b)[1] - me.z);
  assert.ok(d(sweep[0]) > d(sweep[sweep.length - 1]), 'swept toward its mark');
});

test('EG-PERFECT THE FINAL EXAMINATION AGAIN (the lords\' audit, the Spellmaster: "phase 3\'s cage happens once"): from his third phase the cage closes again EG_CAGE_AGAIN_MS after the last resolved - failed or passed - never while one stands (mutants: once a fight; again at once)', () => {
  const C = court(1, 15, 'spellmaster', { n: 2, rng: seeded(5) });
  C.L.hp = C.L.max * (PHASE_AT[1] - 0.05);
  const here = () => on(C, 4, 4);
  const cages = () => C.frames.filter((f) => f.k === 'esay' && f.w === 'cage').length;
  for (let k = 0; k < 40 && cages() < 1; k++) C.step(here());
  assert.equal(cages(), 1, 'the cage at the third phase');
  // left to fail (8 s), then nothing until EG_CAGE_AGAIN_MS have passed
  for (let k = 0; k < 40 && C.F.mem.exam; k++) C.step(here());
  const failedAt = C.now();
  assert.ok(!C.F.mem.exam, 'resolved');
  for (let k = 0; (C.now() - failedAt) < EG_CAGE_AGAIN_MS - 1000; k++) C.step(here());
  assert.equal(cages(), 1, 'never again before its time');
  for (let k = 0; k < 20 && cages() < 2; k++) C.step(here());
  assert.equal(cages(), 2, 'the cage again');
});

test('EG-PERFECT WELLFIRE AIMED (the lords\' audit, Garoth: "aim Wellfire at the target rather than along the axes"): its two lanes cross over its mark, one along his bearing to it (mutants: the axes\' cross about himself)', () => {
  const C = court(1, 100, 'garoth', { n: 1, rng: seeded(9) });
  const me = { sub: 'acct-0', x: C.f.x + 7, z: C.f.z - 5 };
  let wf = null;
  for (let k = 0; k < 800 && !wf; k++) { C.step([me]); wf = C.frames.find((f) => f.k === 'eb' && f.nm === 'Wellfire'); }
  assert.ok(wf, 'Wellfire thrown');
  for (const s of wf.s) assert.ok(Math.hypot((s[1] + s[3]) / 2 - me.x, (s[2] + s[4]) / 2 - me.z) < 0.6, 'each arm\'s middle over its mark');
});

// ── THE AUDIT (2026-10-18, Mac: "Lets audit this and ensure perfection") ───────────────────────────────────────────────
test('EG-PERFECT AUDIT A1 THE WYRM FLIES FROM ITS RISEN PERCHES; A BURST PAST BOTH LINES RAISES NONE (section 13.3): a company that broke all three perches in its first phase grounds it for good - at its second phase its perches rise and it takes flight again from one (it stayed grounded, its Meteor and Burning Perches gone); a burst past both lines turns its third at once and raises nothing it would only stand on (mutants: the risen perches never flown to; the burst raising them)', () => {
  const me = (W) => [{ sub: 'acct-0', x: W.f.x + 3, z: W.f.z + 3 }];
  const W = court(1, 85, 'wyrm', { n: 1 });
  for (let k = 0; k < 8; k++) W.step(me(W));
  for (const p of egObjsOf(W.F, 'pillar')) egObjBroken(W.F, W.spec, p, 'M0', W.now(), []);
  for (let k = 0; k < 4 * 30; k++) W.step(me(W));
  assert.ok(egHas(W.L, EG_FL.grounded) && !W.L.groundedUntil, 'grounded for good: its landing ran out with no perch standing');
  W.L.hp = W.L.max * 0.6;
  const o = W.step(me(W));
  assert.ok(o.some((f) => f.k === 'esay' && f.w === 'perches') && egObjsOf(W.F, 'pillar').length === 3, 'its perches risen at its second phase');
  for (let k = 0; k < 4; k++) W.step(me(W));
  assert.ok(egHas(W.L, EG_FL.fly) && !egHas(W.L, EG_FL.grounded) && egObjsOf(W.F, 'pillar').some((p) => p.i === W.L.perch), 'in flight again, on a risen perch');
  const X = court(1, 85, 'wyrm', { n: 1 });
  for (let k = 0; k < 8; k++) X.step(me(X));
  for (const p of egObjsOf(X.F, 'pillar')) egObjBroken(X.F, X.spec, p, 'M0', X.now(), []);
  X.step(me(X));
  X.L.hp = X.L.max * 0.3;
  const o2 = X.step(me(X));
  assert.deepEqual(o2.filter((f) => f.k === 'eph').map((f) => f.ph), [2, 3], 'both turns taken');
  assert.ok(!o2.some((f) => f.k === 'esay' && f.w === 'perches') && egObjsOf(X.F, 'pillar').length === 0, 'no perches risen for a Wyrm grounded for good');
});

test('EG-PERFECT AUDIT A2 A BURST PAST BOTH LINES TAKES THE THIRD\'S CAGE ALONE (section 13.4): the Spellmaster burst from her first phase to her third in one beat lays no Examination\'s runes (they stood the rest of the fight under the cage that overwrote them) - her Final Examination\'s seals alone (mutant: the Examination laid on the way through)', () => {
  const S = court(1, 15, 'spellmaster', { n: 2 });
  const here = () => S.subs.map((sub, j) => ({ sub, x: S.f.x + 4 + j, z: S.f.z + 4 }));
  for (let k = 0; k < 12; k++) S.step(here());
  S.L.hp = S.L.max * 0.3;
  const o = S.step(here());
  assert.deepEqual(o.filter((f) => f.k === 'eph').map((f) => f.ph), [2, 3]);
  assert.equal(S.F.mem.exam?.kind, 'seals', 'the cage');
  assert.equal(egObjsOf(S.F, 'rune').length, 0, 'no runes laid');
  assert.ok(!o.some((f) => f.k === 'esay' && f.w === 'examination'));
});

test('EG-PERFECT AUDIT A3 THE CAGED STANDS WHERE IT IS (section 13.4, the Final Examination; every screen holds a caged member\'s feet): no aimed blow lands on a caged member while the cage holds it - one said before the cage closed is cut as it closes, one not yet said is held by THE UNION FLOOR, the cage its only ground (the cage closes again every EG_CAGE_AGAIN_MS) (mutants: the union floor planning the caged an escape; the told blow not cut)', () => {
  const C = court(1, 15, 'spellmaster', { n: 2 });
  const pos = { 'acct-0': [C.f.x + 5, C.f.z + 5], 'acct-1': [C.f.x - 8, C.f.z - 8] };
  const here = () => Object.entries(pos).map(([sub, [x, z]]) => ({ sub, x, z }));
  for (let k = 0; k < 12; k++) C.step(here());
  C.L.hp = C.L.max * 0.6; for (let k = 0; k < 8; k++) C.step(here());
  for (const r of egObjsOf(C.F, 'rune')) egObjBroken(C.F, C.spec, r, 'x', C.now(), []);
  C.F.mem.exam = null; C.L.hpFloor = null;
  C.L.hp = C.L.max * 0.3;
  let cages = 0, hits = 0, cuts = 0;
  for (let k = 0; k < 4 * 180; k++) {
    const caged = C.F.mem.exam?.kind === 'seals' ? C.F.mem.exam.bound : null, a = k / 20;
    for (const sub of Object.keys(pos)) if (sub !== caged) pos[sub] = sub === 'acct-1' ? [C.f.x + 10 * Math.sin(a), C.f.z + 10 * Math.cos(a)] : [C.f.x + 6 * Math.cos(a), C.f.z - 6 * Math.sin(a)];
    const o = C.step(here());
    if (o.some((f) => f.k === 'esay' && f.w === 'cage')) cages++;
    cuts += o.filter((f) => f.k === 'ecut').length;
    for (const b of C.F.blows) {
      if (b._c || C.now() < b.at) continue;
      b._c = 1;
      const cs = C.F.mem.exam?.kind === 'seals' ? C.F.mem.exam.bound : caged;
      if (cs && !b.on && !b.ch && egInBlow(b, pos[cs][0], pos[cs][1])) hits++;
    }
  }
  assert.ok(cages >= 3, `${cages} cages closed`);
  assert.equal(hits, 0, 'no aimed blow on the caged');
  assert.ok(cuts >= 1, `${cuts} told blows cut as a cage closed`);
});

test('EG-PERFECT AUDIT A4 A CHAINED SHAPE CARRIES A LEAD ONLY WHILE ITS FIRST IS TO LAND (section 13.2; net/wire.js): fury\'s chained shape held by THE UNION FLOOR past its first\'s landing is said with no outline lead - it was said with `ol: 0`, which every screen\'s wire refuses (the blow landed undrawn) (mutant: the lead written raw)', () => {
  const C = court(1, 75, 'seyth', { n: 1 });
  const { F, spec, L } = C;
  F.blows.length = 0; F.held.length = 0; F.pend = []; F.zones = [];
  const fx = C.f.x, fz = C.f.z, t0 = C.now(), wu = 1000, gap = egChainGapMs(wu, [shDisc(fx, fz, 3)]);
  const first = egAim(F, spec, { o: L.i, s: [shDisc(fx, fz, 3)], at: t0 + wu, wu, p: 0.4, b: 12, nm: 'Lunge' }, [], t0, [], EG_TELL_LEAD_MS);
  const chain = egAim(F, spec, { o: L.i, s: first.s, at: first.at + gap - EG_TELL_LEAD_MS, wu: gap, ol: first.at - t0 - EG_TELL_LEAD_MS, p: 0.4, b: 12, nm: 'Lunge (fury)' }, [], t0, [], EG_TELL_LEAD_MS);
  chain.after = first.i;
  egAim(F, spec, { o: L.i, s: [shOut([[fx, fz, 1]])], at: t0 + 500 + wu + gap + 100, wu: 6000, p: 0.3, b: 0, nm: 'The Eclipse', ch: 1 }, [], t0 - 6000, []);
  const A = [{ sub: 'acct-0', x: fx + 4, z: fz }];
  let said = null;
  for (const dt of [500, 850, 1200, 1550]) { const now = t0 + dt, o = []; egBlowsStep(F, C.view, now, now >= first.at ? [] : A, o); said ??= o.find((f) => f.k === 'eb' && f.nm === 'Lunge (fury)') ?? null; }
  assert.ok(said, 'the chain said past its first\'s landing');
  assert.equal(said.ol, undefined, 'no lead');
  assert.ok(wire(said), 'every screen takes it');
});

test('EG-PERFECT AUDIT A5 A LORD WEIGHS ITS BLOW\'S OWN BURNING POOL BEFORE IT CHOOSES IT (section 13.2): Dusk\'s Hellfire, whose pool would leave a member no ground before a haven CHECK lands, is never committed - its weighing saw no pool (its number 0) and THE UNION FLOOR then held and dropped it said (mutant: the pool left out of the weighing)', () => {
  const D = court(1, 70, 'dusk', { n: 1 });
  const { F, spec, L } = D, me = { sub: 'acct-0', x: D.f.x + 4, z: D.f.z + 4 };
  for (let k = 0; k < 12; k++) D.step([me]);
  L.hp = L.max * 0.6; for (let k = 0; k < 4; k++) D.step([me]);
  L.cds['Dusk Dive'] = 1e15;
  F.blows.length = 0; F.held.length = 0; F.pend = []; F.zones = [];
  const now = D.now();
  egAim(F, spec, { o: L.i, s: [shOut([[me.x, me.z, 1]])], at: now + 250 + 400 + 2000 + 1500, wu: 6000, p: 0.3, b: 0, nm: 'The Eclipse', ch: 1 }, [], now - 6000, []);
  L.nextAt = 0; L.atk = null;
  let touched = 0;
  for (let k = 0; k < 8; k++) { D.step([me]); if ([...F.pend.map((q) => q.b), ...F.held.map((h) => h.b), ...F.blows].some((b) => b?.nm === 'Hellfire')) touched++; }
  assert.equal(touched, 0, 'Hellfire never committed');
});

test('EG-PERFECT AUDIT A6 THE GUARD\'S GLINT AND THE WIND\'S GRACE (sections 13.3 and 13.2; scenes/eliteGates/egFight.js): the guard\'s glint is a lord\'s alone - a Binder raising the fallen is lit too, and is to be struck; the WIND waits the beat\'s grace only on a Spellmaster\'s image (whose blows feint) - every other body\'s the way here alone, so a blow under 0.89 s sounds it at all (mutants: a Binder glinting as a guard; every body at the beat\'s grace)', () => {
  assert.equal(egRimOf(0, EG_FL.lit, true), EG_GUARD_GLINT);
  assert.notEqual(egRimOf(0, EG_FL.lit, false), EG_GUARD_GLINT, 'a lit Binder no guard');
  assert.equal(egWindGraceMs(EG_FL.mirror), EG_WIND_GRACE_MS);
  assert.equal(egWindGraceMs(0), 150);
  assert.ok(EG_WIND_GRACE_MS > 150);
  // Riposte (wu 650): its WIND has a window at the honest grace, none at the beat's
  const wu = 650, win = (g) => wu * (1 - 0.55) - g;
  assert.ok(win(egWindGraceMs(0)) > 100 && win(egWindGraceMs(EG_FL.mirror)) < 50);
});

test('EG-PERFECT AUDIT A7 THE PERCHED BREATH REACHES THE COURT\'S FAR RIM, THE LATTICE SWEEPS RIM TO RIM AND NEVER OVER ITSELF, THE CONQUEST TELLS THE WORST WAY OFF (sections 13.3 and 13.4): EG_WYRM_REACH_M covers a law 10 Wyrm\'s court from its perches (30 m off a r 22 court: 52 m); the Lattice\'s strips cover its floor\'s width (its count rounded up) and its next sweep comes only once the last strip has landed; the Conquest\'s tell covers a run the court\'s whole radius (mutants: the reach at 40 m; the strips rounded down; the cooldown the row\'s 12 s; the tell 3.5 s)', () => {
  assert.ok(EG_WYRM_REACH_M >= 30 + 22, 'the far rim within reach');
  assert.ok(EG_CONQUEST_TELL_MS >= (24 / EG_ESCAPE_MPS + EG_REACT_S) * 1000, `the Conquest's tell ${EG_CONQUEST_TELL_MS} ms`);
  // her own court (r 18 - nine strips exactly), and a floor of r 23 (the Old Masters' court stands her on Garoth's ground at
  // Redoubt 25): 11.5 strips' width - twelve, a sweep of 15.4 s past her 12 s cooldown
  for (const r of [0, 23]) {
    const C = court(1, 15, 'spellmaster', { n: 2, r });
    const here = () => C.subs.map((sub, j) => ({ sub, x: C.f.x + 4 + j, z: C.f.z + 4 }));
    for (let k = 0; k < 12; k++) C.step(here());
    const lands = [];
    for (let k = 0; k < 4 * 150; k++) for (const f of C.step(here())) if (f.k === 'eb' && f.nm === 'Arcane Lattice') lands.push(f.at);
    lands.sort((x, y) => x - y);
    // a sweep's strips land EG_LATTICE_STEP_MS apart; two sweeps over each other land between them
    const sweeps = [];
    for (const at of lands) { const last = sweeps.at(-1); if (last && at - last.at(-1) <= EG_LATTICE_STEP_MS + 300) last.push(at); else sweeps.push([at]); }
    assert.ok(sweeps.length >= 2, `r ${C.f.r}: ${sweeps.length} sweeps`);
    for (let j = 1; j < lands.length; j++) assert.ok(lands[j] - lands[j - 1] >= EG_LATTICE_STEP_MS - 1, `r ${C.f.r}: a sweep only once the last has landed (${lands[j] - lands[j - 1]} ms between strips)`);
    for (const q of sweeps) assert.ok(q.length * EG_LATTICE_W >= 2 * C.f.r - 1e-6, `${q.length} strips over a ${(2 * C.f.r).toFixed(1)} m floor`);
  }
});

test('EG-PERFECT AUDIT A8 A LORD LETS BE A MEMBER IT CANNOT FAIRLY STRIKE (section 13.2, THE UNION FLOOR\'s weighing): when every blow a lord draws for its target would leave that member no ground (one off the floor\'s rim, as on a balcony), it turns to the rest of the company for EG_SHUN_MS - the Kyn Reeve, always at the top of its threat, threw one blow in a minute at a court where a member stood so; a company of one is still its target (mutant: the member never let be)', () => {
  const run = (subs, off) => {
    const spec = egHallOf(1, 15, 0), F = egFightNew(spec, T0, subs.map(() => 40), subs), view = egFightView(spec), rng = seeded(1), frames = [];
    egLordsNew(F, spec, 'kynreeve', T0, frames, { decrees: {}, n: subs.length });
    egLordsWake(F, spec, T0, frames, { n: subs.length });
    const L = egLordsOf(F)[0], f = spec.fl.find((q) => q.t === 'd');
    L.threat[subs[0]] = 1e6;
    const here = () => subs.map((sub, j) => (j === 0 ? { sub, x: f.x + f.r + off, z: f.z, y: f.y ?? 0 } : { sub, x: f.x + 3, z: f.z + 3, y: f.y ?? 0 }));
    let now = T0, blows = 0, shunned = null;
    for (let k = 0; k < 4 * 60; k++) {
      now += 250;
      const out = [];
      egLordsStep(F, spec, now, here(), rng, out, { decrees: {}, n: subs.length });
      egBlowsStep(F, view, now, here(), out);
      blows += out.filter((q) => q.k === 'eb' && q.o === L.i).length;
      if (L.shun) shunned = L.shun;
    }
    return { blows, shunned };
  };
  const two = run(['acct-0', 'acct-1'], 3);
  assert.equal(two.shunned?.[0], 'acct-0', 'the member off the rim let be');
  assert.ok(two.shunned[1] - T0 > 0 && EG_SHUN_MS > 4000, 'for longer than a target is kept');
  assert.ok(two.blows >= 8, `${two.blows} blows in a minute at the rest of the company`);
  const one = run(['acct-0'], 3);
  assert.ok(one.blows <= 2, `a company of one: still its target (${one.blows} blows)`);
});

