// WB8b (2026-09-28, Mac: "continue to refine and add detail to his encounters, and give him unique and different
// modifers on every 2 hour spawn") - THE WARDEN'S MARKS.
//
// Every gate (a game day, two real hours online) the Warden comes under ONE ASPECT - the element his elemental blows and
// his ground carry (Burning, Rime-Wrought, Storm-Crowned, Venom-Blooded) - and TWO TRIALS (Colossal, Unyielding,
// Vengeful, Scarring, Grudge-Bearer, Soul-Hungry, Dagon's Favoured, Echoing - and WB11a's ninth, Legion-Lord). The day's
// draw is a cycle: every aspect with every pair of trials ONCE each in 144 gates (112 for WB8b's eight), no two gates
// running sharing a mark, each round of four gates every aspect and eight of the nine trials, the ninth resting (AUDIT
// PRE-MERGE 0929 W1-4: a round - gates 4k to 4k+3 - not any four running)
// (net/gateLaw.js gateModsOf). The relay's brain fights under the fight's own marks (net/gateBrain.js fightProfile), says
// them in its state (`md`), and every screen resolves and draws the same law from them.
//
// Pinned here: the tables (net/gateMods.js), the cycle, the profile against the constants it replaces, each trial's law
// in the brain, the escape from every attack under every set of marks, the wire and the relay's draw.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GATE_ASPECTS, GATE_TRIALS, GATE_TRIALS_A_DAY, gateAspectOf, gateTrialOf, readGateMods, validGateMods, gateModsWords, GATE_FEEDS_MAX,
} from '../src/net/gateMods.js';
import { gateModsOf, gateMarksCycleLength, gateTimes, gateRoomKey, gateIndex, GATE_EVERY_DAYS } from '../src/net/gateLaw.js';
import {
  newFight, joinFight, applyHit, stepBrain, stateOf, attacksFor, pickTarget, windupOf, fightProfile, profileOf, attackUnder,
  BASE_PROFILE, SCAR_POOLS, FAVOURED_PHASE, ATTACKS, ATTACK_BY_ID, POOLS, BOSS_R, BOSS_H, SHIELD_MS, THREAT_PICK, THREAT_DECAY,
  BOSS_TTK_S, dpsRef, HIT_KINDS, MELEE_REACH, POSE_SLACK, PHASE_AT, COURT_CENTRE, BRAIN_TICK_MS, OPENING_MS, TURN_BREATH_MS,
  SEAT_KEEP_MS, RECEIPT_SHARE, hasPart, COURTS, CROSS_WARD_MAX_MS,
} from '../src/net/gateBrain.js';
import { validGateOut, GATE_OUT_KINDS, GATE_BRAIN_V, GATE_BRAIN_MIN, RELAY_VERSION } from '../src/net/wire.js';
import { fakeRooms } from './fakeRoom.mjs';

/** A seeded [0,1) source (mulberry32) - the room suite's own dice. */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const T0 = 1_000_000;
const WRATH = T0 + 3_600_000;
const body = (sub, x, z, dead = false) => ({ sub, x, z, dead });
/** A fight under marks `md`, with fighters at levels `lvs` (subs s1, s2, ...). */
function fightOf(md, lvs = [10]) {
  const f = newFight(7, T0, WRATH, 'ruhn', md);
  lvs.forEach((lv, i) => assert.ok(joinFight(f, `s${i + 1}`, `P${i + 1}`, lv, T0, true)));
  return f;
}
const apart = (x, y) => x[0] !== y[0] && !x.slice(1).some((k) => y.slice(1).includes(k));

// ═══ THE TABLES ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB8b the tables: four aspects, each an element, an epithet, a name for each of his four elemental blows and the court\'s words; eight trials, each its numbers and one line; two a gate; unknown words dropped, one aspect at most on the wire (mutants: an aspect\'s element; a trial\'s number; the wire taking two aspects)', () => {
  assert.deepEqual(GATE_ASPECTS.map((a) => [a.id, a.el, a.epithet]), [
    ['burning', 'fire', 'the Burning'], ['rime', 'frost', 'the Rime-Wrought'], ['storm', 'shock', 'the Storm-Crowned'], ['venom', 'poison', 'the Venom-Blooded'],
  ]);
  for (const a of GATE_ASPECTS) {
    assert.deepEqual(Object.keys(a.names).sort(), ['hellfire', 'meteor', 'nova', 'spokes'], `${a.id}: a name for each elemental blow`);
    for (const k of ['omen', 'ground', 'stuff']) assert.ok(typeof a[k] === 'string' && a[k].length > 1, `${a.id}.${k}`);   // WB13b: the arrival's line and the floor's verb gone with the lines that said them
    assert.ok(!('arrive' in a) && !('floor' in a));
  }
  assert.deepEqual(gateAspectOf('burning').names, { hellfire: 'Hellfire', nova: 'Flame Nova', meteor: 'Meteor of Oblivion', spokes: 'Spokes of Dagon' }, 'the Burning Warden\'s are the attacks\' own');
  for (const [k, A] of Object.entries(gateAspectOf('burning').names)) assert.equal(A, ATTACKS[k].name);
  assert.deepEqual(gateAspectOf('rime').names, { hellfire: 'Rimefall', nova: 'Frost Nova', meteor: 'Hailstone of Oblivion', spokes: 'Spokes of Rime' });
  assert.deepEqual(GATE_TRIALS.map((t) => t.id), ['colossal', 'unyielding', 'vengeful', 'scarring', 'grudge', 'soulhungry', 'favoured', 'echoing', 'legion']);   // WB11a: the ninth
  assert.deepEqual(GATE_TRIALS.map((t) => t.name), ['Colossal', 'Unyielding', 'Vengeful', 'Scarring', 'Grudge-Bearer', 'Soul-Hungry', 'Dagon\'s Favoured', 'Echoing', 'Legion-Lord']);
  const T = (id) => gateTrialOf(id);
  assert.deepEqual([T('colossal').size, T('colossal').hp, T('colossal').slamR], [1.25, 1.25, 8.5]);
  assert.deepEqual([T('unyielding').shieldMs, T('unyielding').hit], [6000, 0.85]);
  assert.equal(T('vengeful').dmg, 1.25); assert.equal(T('scarring').groundMs, 1.5);
  assert.deepEqual([T('grudge').threatPick, T('grudge').threatDecay], [0.85, 0]);
  assert.equal(T('soulhungry').heal, 0.03);
  assert.equal(T('legion').legion, true, 'WB11a: Legion-Lord brings his host');
  for (const t of GATE_TRIALS) assert.ok(t.text.length > 10 && !t.text.endsWith('.'), `${t.id}: one line, said with its own stop`);
  assert.equal(GATE_TRIALS_A_DAY, 2);
  // WB11a: the cycle's shape - a round of four gates holds a pair of trials for every aspect, and one trial over at most
  // rests (the round-robin's bye); eight trials or nine for four aspects
  assert.equal(Math.floor(GATE_TRIALS.length / GATE_TRIALS_A_DAY), GATE_ASPECTS.length, 'the cycle\'s shape: a pair of trials for every aspect in a round, one over at most');
  // reading
  assert.deepEqual(readGateMods(null), { aspect: GATE_ASPECTS[0], trials: [] }, 'none: the Warden unmarked');
  assert.deepEqual(readGateMods(['rime', 'echoing', 'nope', 7, 'echoing']), { aspect: gateAspectOf('rime'), trials: [T('echoing')] }, 'unknown words dropped, a trial counted once');
  assert.equal(readGateMods(['colossal']).aspect.id, 'burning', 'no aspect reads as Burning');
  // the wire's shape
  assert.equal(validGateMods(null), null); assert.equal(validGateMods(undefined), null);
  assert.deepEqual(validGateMods(['storm', 'grudge', 'favoured']), ['storm', 'grudge', 'favoured']);
  for (const bad of [['storm', 'rime'], ['storm', 'grudge', 'favoured', 'echoing'], ['storm', 'nope'], 'storm', [1], {}]) assert.equal(validGateMods(bad), undefined, JSON.stringify(bad));
  const md = ['venom', 'scarring'];
  const copy = validGateMods(md); copy.push('x');
  assert.deepEqual(md, ['venom', 'scarring'], 'a copy, never the caller\'s own');
  assert.equal(gateModsWords(['rime', 'colossal', 'echoing']), 'the Rime-Wrought - Colossal, Echoing');
  assert.equal(gateModsWords(null), 'the Burning');
});

// ═══ THE DRAW ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB8b the draw: a CYCLE of 144 gates (WB11a - nine trials; 112 for WB8b\'s eight) - every aspect with every pair of trials exactly once - where no two gates running share an aspect or a trial (the cycle\'s wrap too), each round of four gates (4k to 4k+3) brings all four aspects and eight of the nine trials (the ninth resting, never one two rounds running), every trial as often, a pair comes back no sooner than 33 gates on and a whole set only after 144; a pure function of the day (mutants: the seam unchecked; a round\'s turn of the aspects dropped; the wrap unchecked; the bye\'s pair made a gate)', () => {
  const N = gateMarksCycleLength();
  assert.equal(N, GATE_ASPECTS.length * (GATE_TRIALS.length * (GATE_TRIALS.length - 1)) / 2, '4 x 36');
  assert.equal(N, 144);
  const seen = new Set();
  for (let d = 0; d < N; d++) {
    const md = gateModsOf(d);
    assert.equal(md.length, 1 + GATE_TRIALS_A_DAY);
    assert.ok(gateAspectOf(md[0]) && md.slice(1).every((k) => gateTrialOf(k)), 'an aspect, then its trials');
    assert.notEqual(md[1], md[2]);
    seen.add([md[0], ...md.slice(1).sort()].join(','));
  }
  assert.equal(seen.size, N, 'every set once');
  let lastAt = new Map(), pairAt = new Map(), minSet = Infinity, minPair = Infinity, rested = null;
  const each = new Map();
  for (let d = 0; d < N; d++) for (const k of gateModsOf(d).slice(1)) each.set(k, (each.get(k) ?? 0) + 1);
  assert.deepEqual([...new Set(each.values())], [N * GATE_TRIALS_A_DAY / GATE_TRIALS.length], 'every trial as often - 32 of the 144');
  for (let d = 0; d < 3 * N + 5; d++) {
    const md = gateModsOf(d);
    if (d > 0) assert.ok(apart(md, gateModsOf(d - 1)), `gates ${d - 1} and ${d} share nothing (${gateModsOf(d - 1)} / ${md})`);
    if (d % 4 === 3) {
      const r = [0, 1, 2, 3].map((k) => gateModsOf(d - 3 + k));
      assert.equal(new Set(r.map((m) => m[0])).size, 4, `the round ending at ${d}: every aspect`);
      const trials = new Set(r.flatMap((m) => m.slice(1)));
      assert.equal(trials.size, 8, `the round ending at ${d}: eight trials, none twice`);
      const rest = GATE_TRIALS.filter((t) => !trials.has(t.id)).map((t) => t.id);
      assert.equal(rest.length, 1, `the round ending at ${d}: one trial rests`);
      assert.notEqual(rest[0], rested, `the round ending at ${d}: never the same one two rounds running`);
      rested = rest[0];
    }
    const k = md.join(','), pk = md.slice(1).join(',');
    if (lastAt.has(k)) minSet = Math.min(minSet, d - lastAt.get(k));
    if (pairAt.has(pk)) minPair = Math.min(minPair, d - pairAt.get(pk));
    lastAt.set(k, d); pairAt.set(pk, d);
  }
  assert.equal(minSet, N, 'a set of marks comes back once the cycle does, and not before');
  assert.ok(minPair >= 33, `a pair of trials rests ${minPair} gates at least`);
  assert.ok(apart(gateModsOf(N - 1), gateModsOf(N)), 'the wrap: the cycle\'s last gate and its first share nothing');
  assert.equal(gateModsOf(5), gateModsOf(5), 'made once - the same frozen answer');
  assert.ok(Object.isFrozen(gateModsOf(5)));
  assert.deepEqual(gateModsOf(5 + N), gateModsOf(5));
  assert.equal(gateIndex(40), 40 / GATE_EVERY_DAYS);
  // the salt's own cycle, pinned where the field will meet it: the herald's day and the field's first nights
  // (WB11a moved every one: the cycle is nine trials' now - the first nights were burning, grudge, echoing; venom,
  // scarring, soul-hungry; storm, vengeful, favoured; rime, colossal, unyielding; and 538 burning, soul-hungry, echoing)
  assert.deepEqual([0, 1, 2, 3].map((d) => gateModsOf(d)), [['burning', 'echoing', 'legion'], ['venom', 'vengeful', 'grudge'], ['storm', 'colossal', 'soulhungry'], ['rime', 'scarring', 'favoured']]);
  assert.deepEqual(gateModsOf(538), ['storm', 'unyielding', 'soulhungry']);
});

// ═══ THE PROFILE ══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB8b the profile: the Warden unmarked IS the constants - his body, his ward, his blows, his targeting, every attack\'s reach, phase, element, name, ground and weight; one profile a set of marks, made once; a word the wire would refuse is no marks at all (mutants: a base number moved; the cache keyed wrong)', () => {
  const P = BASE_PROFILE;
  assert.equal(fightProfile(null), P); assert.equal(fightProfile(undefined), P); assert.equal(fightProfile(['rime', 'rime']), P, 'two aspects: refused, unmarked');
  assert.equal(profileOf({}), P); assert.equal(profileOf({ md: null }), P);
  assert.deepEqual([P.md, P.el, P.size, P.bossR, P.bossH, P.hpX, P.shieldMs, P.hitX, P.dmgX, P.threatPick, P.threatDecay, P.feed, P.echo],
    [null, 'fire', 1, BOSS_R, BOSS_H, 1, SHIELD_MS, 1, 1, THREAT_PICK, THREAT_DECAY, 0, false]);
  for (const A of ATTACK_BY_ID) {
    const L = attackUnder(A);
    assert.deepEqual([L.r, L.phase, L.el, L.name, L.pct, L.base], [A.r, A.phase, A.el, A.name, A.pct, A.base ?? 0], A.key);
    assert.deepEqual(L.pool, A.pool ? { ...A.pool } : null, `${A.key}: its own ground, and none where it left none`);
  }
  const md = ['storm', 'colossal', 'echoing'];
  assert.equal(fightProfile(md), fightProfile([...md]), 'one profile a set of marks');
  assert.equal(fightProfile(md), profileOf({ md }));
  assert.ok(Object.isFrozen(fightProfile(md)) && Object.isFrozen(fightProfile(md).atk.slam));
});

test('WB8b the aspects: his fire is his aspect\'s element under his aspect\'s names - every elemental blow and all his ground - while his blade, his slam, his charge and his leap stay plain, and Dagon\'s Wrath is Dagon\'s fire whatever he wears (mutants: the Wrath turned; a plain blow given an element)', () => {
  for (const a of GATE_ASPECTS) {
    const P = fightProfile([a.id]);
    assert.equal(P.el, a.el);
    for (const k of ['hellfire', 'nova', 'meteor', 'spokes']) { assert.equal(P.atk[k].el, a.el, `${a.id} ${k}`); assert.equal(P.atk[k].name, a.names[k]); }
    for (const k of ['cleave', 'slam', 'charge', 'leap']) { assert.equal(P.atk[k].el, null, `${a.id} ${k}: plain`); assert.equal(P.atk[k].name, ATTACKS[k].name); }
    assert.equal(P.atk.wrath.el, 'fire'); assert.equal(P.atk.wrath.name, 'Dagon\'s Wrath');
  }
});

test('WB8b the trials, as numbers: Colossal a quarter larger and harder to fell with a longer slam; Unyielding\'s ward twice as long and blows 15% lighter; Vengeful\'s blows and ground a quarter heavier; Scarring\'s slam and leap scarring the floor and all ground half again as long; the Grudge-Bearer never forgetting; Soul-Hungry fed; Dagon\'s Favoured early; Echoing (mutants: each number unread)', () => {
  const C = fightProfile(['burning', 'colossal']);
  assert.deepEqual([C.size, C.bossR, C.bossH, C.hpX, C.atk.slam.r], [1.25, BOSS_R * 1.25, BOSS_H * 1.25, 1.25, 8.5]);
  // AUDIT PRE-MERGE 0929 W1-2: his blade reaches as far past his body as it did - the cone grows with it
  assert.equal(C.atk.cleave.r, ATTACKS.cleave.r + (C.bossR - BOSS_R), 'his blade reaches past his body as it did');
  assert.equal(BASE_PROFILE.atk.cleave.r, ATTACKS.cleave.r, 'unmarked, the constant exactly');
  // R3's law for every body he wears: wherever the Cleave may be chosen (a gap of its range past his body), a still
  // fighter stands inside its cone - a Colossal Warden cleaved air all phase one at 9.0-9.25 m, never walking in
  for (let i = 0; i < gateMarksCycleLength(); i++) {
    const P = fightProfile(gateModsOf(i));
    assert.ok(ATTACKS.cleave.range + P.bossR <= P.atk.cleave.r, `${P.md}: the Cleave is chosen at ${ATTACKS.cleave.range + P.bossR} m and reaches ${P.atk.cleave.r}`);
  }
  const U = fightProfile(['burning', 'unyielding']);
  assert.deepEqual([U.shieldMs, U.hitX], [6000, 0.85]);
  const V = fightProfile(['burning', 'vengeful']);
  for (const A of ATTACK_BY_ID) { assert.equal(V.atk[A.key].pct, A.pct * 1.25); assert.equal(V.atk[A.key].base, (A.base ?? 0) * 1.25); }
  assert.deepEqual(V.atk.meteor.pool, { r: POOLS.meteor.r, ms: POOLS.meteor.ms, pct: POOLS.meteor.pct * 1.25, base: POOLS.meteor.base * 1.25 });
  const S = fightProfile(['burning', 'scarring']);
  assert.deepEqual(S.atk.slam.pool, { r: SCAR_POOLS.slam.r, ms: SCAR_POOLS.slam.ms * 1.5, pct: SCAR_POOLS.slam.pct, base: SCAR_POOLS.slam.base });
  assert.deepEqual(S.atk.leap.pool, { r: SCAR_POOLS.leap.r, ms: SCAR_POOLS.leap.ms * 1.5, pct: SCAR_POOLS.leap.pct, base: SCAR_POOLS.leap.base });
  assert.equal(S.atk.hellfire.pool.ms, POOLS.hellfire.ms * 1.5); assert.equal(S.atk.cleave.pool, null, 'a blade leaves none');
  assert.equal(BASE_PROFILE.atk.slam.pool, null, 'no scar without the trial');
  const SV = fightProfile(['burning', 'scarring', 'vengeful']);
  assert.deepEqual(SV.atk.leap.pool, { r: 3.5, ms: 9000, pct: SCAR_POOLS.leap.pct * 1.25, base: SCAR_POOLS.leap.base * 1.25 }, 'the two together');   // WB9d: the scar's bite raised with every ground's
  const G = fightProfile(['burning', 'grudge']);
  assert.deepEqual([G.threatPick, G.threatDecay], [0.85, 0]);
  assert.equal(fightProfile(['burning', 'soulhungry']).feed, 0.03);
  const F = fightProfile(['burning', 'favoured']);
  assert.deepEqual(FAVOURED_PHASE, { hellfire: 1, meteor: 1, spokes: 2 });
  for (const A of ATTACK_BY_ID) assert.equal(F.atk[A.key].phase, FAVOURED_PHASE[A.key] ?? A.phase, A.key);
  assert.equal(fightProfile(['burning', 'echoing']).echo, true);
});

test('WB8b EVERY ATTACK STAYS ESCAPABLE under every set of marks: each wind-up (phase three\'s, a fifth shorter) outruns its shape from its middle at the player\'s 7.6 m/s - Colossal\'s slam, the lane as wide as his larger body - and his scarred ground is a step off (mutants: a reach grown past escape)', () => {
  const RUN = 7.6;
  for (let d = 0; d < gateMarksCycleLength(); d++) {
    const P = fightProfile(gateModsOf(d));
    const need = { cleave: P.atk.cleave.r / 2, slam: P.atk.slam.r, charge: Math.max(ATTACKS.charge.width / 2, P.bossR), hellfire: P.atk.hellfire.r,
      nova: (ATTACKS.nova.r1 - ATTACKS.nova.r0) / 2, leap: P.atk.leap.r, meteor: P.atk.meteor.r, spokes: ATTACKS.spokes.width / 2 };
    for (const [k, m] of Object.entries(need)) assert.ok(windupOf(ATTACKS[k], 3) / 1000 * RUN >= m, `${gateModsOf(d)}: ${k} - ${m} m in ${windupOf(ATTACKS[k], 3)} ms`);
    for (const A of ATTACK_BY_ID) if (P.atk[A.key].pool) assert.ok(P.atk[A.key].pool.r <= ATTACKS.meteor.pool.r, `${A.key}'s ground no wider than the meteor's`);
  }
});

// ═══ THE BRAIN UNDER HIS MARKS ════════════════════════════════════════════════════════════════════════════════════

test('WB8b the fight keeps its marks: newFight holds a valid set (a copy) and nothing else; the state says them and the wire takes them whole; a fight checkpointed before WB8 wakes unmarked (mutants: the marks dropped from the state; the wire refusing none)', () => {
  const md = ['rime', 'scarring', 'grudge'];
  const f = newFight(7, T0, WRATH, 'ruhn', md);
  assert.deepEqual(f.md, md); assert.notEqual(f.md, md);
  assert.equal(newFight(7, T0, WRATH, 'ruhn').md, null);
  assert.equal(newFight(7, T0, WRATH, 'ruhn', ['rime', 'storm']).md, null, 'a set the wire would refuse is none');
  const st = stateOf(f);
  assert.deepEqual(st.md, md);
  assert.deepEqual(validGateOut(JSON.parse(JSON.stringify(st))).md, md, 'through JSON and the wire');
  assert.equal(validGateOut({ ...st, md: null }).md, null);
  assert.equal(validGateOut({ ...st, md: undefined }).md, null, 'an older relay\'s state: unmarked');
  assert.equal(validGateOut({ ...st, md: ['rime', 'nope'] }), null, 'a word nobody knows refuses the state');
  const old = JSON.parse(JSON.stringify(f)); delete old.md;
  assert.equal(profileOf(old), BASE_PROFILE, 'a checkpoint from before the marks');
});

test('WB8b Colossal in the brain: each share a quarter more (the kill a quarter longer at the same bucket), and his body larger - a melee blow reaches him from further, and he walks up to stop short of his own larger body (mutants: the share unscaled; the gap from the old body; the walk to the old body)', () => {
  const f = fightOf(['burning', 'colossal']);
  assert.equal(f.max, BOSS_TTK_S * dpsRef(10) * 1.25);
  const plain = fightOf(null);
  const far = BOSS_R * 1.25 + MELEE_REACH + POSE_SLACK - 0.05;   // past the old body's reach, inside the colossus's
  assert.equal(applyHit(plain, 's1', 10, HIT_KINDS.Melee, { x: 0, z: far }, T0 + 1000), 0, 'unmarked: out of reach');
  assert.equal(applyHit(f, 's1', 10, HIT_KINDS.Melee, { x: 0, z: far }, T0 + 1000), 10, 'Colossal: his body meets it');
  // a walk at a fighter past his blade and short of his charge (phase one: 7 < gap < 8): he stops short by his own
  // body and a little
  for (const [md, R] of [[['burning', 'colossal'], BOSS_R * 1.25], [null, BOSS_R]]) {
    const g = fightOf(md);
    g.nextAt = T0;
    const mv = stepBrain(g, T0, [body('s1', 0, 9.75)], () => 0.5).find((o) => o.k === 'mv');
    assert.ok(mv, 'he walks');
    assert.ok(Math.abs(mv.tz - (9.75 - (R + 1))) < 0.011, `${md ?? 'unmarked'}: stops ${9.75 - mv.tz} m short - his own body and one`);
  }
});

test('WB8b Unyielding in the brain: his ward holds SHIELD_MS twice over at a phase\'s turn, and every blow lands 15% lighter - what the ward took off his, not a cap\'s (mutants: the old ward; the blow whole; the lightening counted as clipped)', () => {
  const f = fightOf(['burning', 'unyielding']);
  const full = f.hp;
  assert.equal(applyHit(f, 's1', 20, HIT_KINDS.Shaft, { x: 0, z: 8 }, T0 + 1000), 17);
  assert.equal(f.hp, full - 17);
  assert.equal(f.players.s1.clipped, 0, 'nothing clipped');
  f.hp = f.max * PHASE_AT[0]; f.nextAt = T0;
  const out = stepBrain(f, T0 + 2000, [body('s1', 0, 8)], seeded(3));
  // WB9b: the turn's ward holds through the bound and the wait in the next court; once a challenger crosses, HIS ward
  // holds from there - twice SHIELD_MS
  assert.deepEqual(out.find((o) => o.k === 'ph'), { k: 'ph', n: 2, until: T0 + 2000 + CROSS_WARD_MAX_MS });
  const t = f.atk.until;
  stepBrain(f, t, [body('s1', 0, 8)], seeded(3));
  const arrive = stepBrain(f, t + TURN_BREATH_MS, [body('s1', COURTS[1][0], COURTS[1][1] + 8)], seeded(3));
  assert.deepEqual(arrive.find((o) => o.k === 'ph'), { k: 'ph', n: 2, until: t + TURN_BREATH_MS + 6000 });
});

test('WB8b the Grudge-Bearer in the brain: his threat never forgets, and he goes at the one who hurt him most 85 times in a hundred (mutants: the decay kept; the old pick)', () => {
  const f = fightOf(['burning', 'grudge'], [10, 10]);
  applyHit(f, 's1', 50, HIT_KINDS.Shaft, { x: 0, z: 8 }, T0 + 1000);
  const before = f.threat.s1;
  stepBrain(f, T0 + 1000, [body('s1', 0, 8), body('s2', 4, 4)], seeded(1));
  for (let t = T0 + 1250; t < T0 + 20_000; t += 250) stepBrain(f, t, [body('s1', 0, 8), body('s2', 4, 4)], seeded(t));
  assert.equal(f.threat.s1, before, 'twenty seconds on, not a point forgotten');
  const plain = fightOf(null, [10, 10]);
  applyHit(plain, 's1', 50, HIT_KINDS.Shaft, { x: 0, z: 8 }, T0 + 1000);
  stepBrain(plain, T0 + 1000, [body('s1', 0, 8)], seeded(1));
  stepBrain(plain, T0 + 2000, [body('s1', 0, 8)], seeded(1));
  assert.ok(plain.threat.s1 < 50, 'unmarked, it fades');
  const bodies = [body('s1', 0, 8), body('s2', 4, 4)];
  let top = 0; const rng = seeded(11);
  for (let i = 0; i < 4000; i++) if (pickTarget(f, bodies, rng).sub === 's1') top++;
  assert.ok(Math.abs(top / 4000 - (0.85 + 0.15 / 2)) < 0.03, `${top / 4000}: the grudge's pick, and a fair share of the rest`);
});

test('WB8b Soul-Hungry in the brain: a challenger who falls in the court feeds him a share of the health he stands for, ONCE a fight - said to the court (`fed`: the beat\'s names, his health after) - never past his whole, never unmarked. AUDIT PRE-MERGE 0929 W1-1: only a fall with a real part in the fight behind it (hasPart - AUDIT WBX R2\'s bar), and no more than GATE_FEEDS_MAX a fight; W1-3: one word a beat, naming every one (mutants: fed every beat; fed past his whole; the word unsaid; a fall with no part feeding; the ceiling unread; a word a name)', () => {
  const f = fightOf(['burning', 'soulhungry'], [10, 10]);
  f.hp = f.max / 2;
  // a fall with NO PART - no blow of note, no seat\'s worth stood: the throwaway guest\'s, and nothing
  assert.equal(hasPart(f.players.s1), false);
  assert.equal(stepBrain(f, T0 + 250, [body('s1', 0, 8, true), body('s2', 4, 4)], seeded(1)).filter((o) => o.k === 'fed').length, 0, 'a fall with no part in the fight feeds him');
  assert.equal(f.hp, f.max / 2);
  assert.equal(f.players.s1.fed, undefined, 'and is spent on nothing - a part earned later still counts');
  f.players.s1.stoodMs = SEAT_KEEP_MS;   // a seat\'s worth stood alive
  assert.equal(hasPart(f.players.s1), true);
  const out = stepBrain(f, T0 + 500, [body('s1', 0, 8, true), body('s2', 4, 4)], seeded(1));
  const fed = out.filter((o) => o.k === 'fed');
  assert.deepEqual(fed, [{ k: 'fed', ns: ['P1'], h: Math.round(f.max * 0.53), m: Math.round(f.max), at: T0 + 500 }]);
  assert.ok(Math.abs(f.hp - f.max * 0.53) < 1e-6);
  assert.deepEqual(validGateOut(fed[0]), fed[0], 'the wire takes it');
  assert.ok(!out.some((o) => o.k === 'hp'), 'the word says the health - no `hp` beside it');
  assert.equal(stepBrain(f, T0 + 750, [body('s1', 0, 8, true), body('s2', 4, 4)], seeded(1)).filter((o) => o.k === 'fed').length, 0, 'once');
  stepBrain(f, T0 + 1000, [body('s1', 0, 8), body('s2', 4, 4)], seeded(1));
  assert.equal(stepBrain(f, T0 + 1250, [body('s1', 0, 8, true), body('s2', 4, 4)], seeded(1)).filter((o) => o.k === 'fed').length, 0, 'a fall again, after a walk back in, feeds nothing more');
  // a part by blows: RECEIPT_SHARE of the fighter\'s own share dealt
  f.players.s2.dealt = RECEIPT_SHARE * f.players.s2.share;
  assert.equal(hasPart(f.players.s2), true);
  const whole = fightOf(['burning', 'soulhungry']);
  whole.players.s1.stoodMs = SEAT_KEEP_MS;
  stepBrain(whole, T0 + 500, [body('s1', 0, 8, true)], seeded(1));
  assert.equal(whole.hp, whole.max, 'never past his whole');
  const plain = fightOf(null);
  plain.hp = plain.max / 2;
  plain.players.s1.stoodMs = SEAT_KEEP_MS;
  assert.equal(stepBrain(plain, T0 + 500, [body('s1', 0, 8, true)], seeded(1)).filter((o) => o.k === 'fed').length, 0);
  assert.equal(plain.hp, plain.max / 2, 'unmarked, the fallen feed nothing');
  // W1-3: two falls in one beat are ONE word naming both
  const two = fightOf(['burning', 'soulhungry'], [10, 10, 10]);
  two.hp = two.max / 2;
  for (const p of Object.values(two.players)) p.stoodMs = SEAT_KEEP_MS;
  const both = stepBrain(two, T0 + 500, [body('s1', 0, 8, true), body('s2', 3, 8, true), body('s3', 4, 4)], seeded(1)).filter((o) => o.k === 'fed');
  assert.deepEqual(both.map((o) => o.ns), [['P1', 'P2']], 'two words with one moment - the court said the first name alone');
  assert.equal(both[0].h, Math.round(two.max * 0.56));
  // W1-1: THE CEILING - however many accounts fall, GATE_FEEDS_MAX feedings a fight (the throwaway army measured at
  // twenty-five: a fifth of his health to all but full)
  const lvs = Array.from({ length: GATE_FEEDS_MAX + 4 }, () => 10);
  const crowd = fightOf(['burning', 'soulhungry'], lvs);
  crowd.hp = crowd.max / 5;
  for (const p of Object.values(crowd.players)) p.stoodMs = SEAT_KEEP_MS;
  const fallen = lvs.map((_, i) => body(`s${i + 1}`, i, 8, true));
  const words = stepBrain(crowd, T0 + 500, fallen, seeded(1)).filter((o) => o.k === 'fed');
  assert.equal(words.length, 1);
  assert.equal(words[0].ns.length, GATE_FEEDS_MAX);
  assert.equal(crowd.feeds, GATE_FEEDS_MAX);
  assert.ok(Math.abs(crowd.hp - crowd.max * (0.2 + 0.03 * GATE_FEEDS_MAX)) < 1e-6);
  assert.equal(stepBrain(crowd, T0 + 750, fallen, seeded(1)).filter((o) => o.k === 'fed').length, 0, 'past the ceiling, a fall feeds nothing');
  assert.equal(GATE_FEEDS_MAX, 5);
});

test('WB8b Dagon\'s Favoured in the brain: the meteor and his marks from the first phase, the Spokes from the second (mutants: the phases unread)', () => {
  const F = fightProfile(['burning', 'favoured']);
  assert.deepEqual(attacksFor(1, 20, 0, -1, F).map((a) => a.key), ['charge', 'hellfire', 'meteor']);
  assert.deepEqual(attacksFor(1, 20, 0).map((a) => a.key), ['charge'], 'unmarked, the charge alone reaches the far in phase one');
  assert.ok(attacksFor(2, 20, 0, -1, F).some((a) => a.key === 'spokes'));
  assert.ok(!attacksFor(2, 20, 0).some((a) => a.key === 'spokes'));
});

test('WB8b Echoing in the brain: a meteor falls again a breath after the first - on the fighter it fell for, where they stand now; on the first\'s spot when they have fallen - and an echo has no echo; a phase\'s turn clears it (mutants: no echo; an echo of an echo; the echo on the first\'s spot with its fighter alive; the turn keeping it)', () => {
  const RNG = () => 0.999;   // the last open attack: at a fighter 12 m off in phase two, the meteor
  const meteorAt = (md) => {
    const f = fightOf(md);
    f.phase = 2; f.nextAt = T0;
    const first = stepBrain(f, T0, [body('s1', 0, 12)], RNG).find((o) => o.k === 'atk');
    assert.equal(first.a, ATTACKS.meteor.id, 'the meteor, at s1');
    assert.deepEqual(first.tg, [[0, 12]]);
    assert.equal(f.atk.who, 's1', 'the fighter it fell for is kept on the attack - the fight\'s own');
    assert.equal(validGateOut({ k: 'atk', ...first }).who, undefined, 'and never on the wire');
    return { f, first, end: f.atk.until };
  };
  const { f, end } = meteorAt(['burning', 'echoing']);
  assert.ok(!stepBrain(f, end, [body('s1', 6, -5)], RNG).some((o) => o.k === 'atk'), 'a breath first');
  assert.equal(f.pending?.echo, true);
  const echo = stepBrain(f, end + TURN_BREATH_MS, [body('s1', 6, -5)], RNG).find((o) => o.k === 'atk');
  assert.equal(echo.a, ATTACKS.meteor.id);
  assert.deepEqual(echo.tg, [[6, -5]], 'on its fighter, where they stand now');
  assert.equal(echo.at, end + TURN_BREATH_MS + windupOf(ATTACKS.meteor, 2), 'its whole wind-up, told at once');
  assert.equal(f.atk.echo, true);
  stepBrain(f, f.atk.until, [body('s1', 6, -5)], RNG);
  assert.equal(f.pending, null, 'an echo has no echo');
  const gone = meteorAt(['burning', 'echoing']);
  stepBrain(gone.f, gone.end, [body('s1', 6, -5, true)], RNG);
  assert.deepEqual(stepBrain(gone.f, gone.end + TURN_BREATH_MS, [body('s1', 6, -5, true)], RNG).find((o) => o.k === 'atk').tg, [[0, 12]], 'its fighter fallen: where the first fell');
  const plain = meteorAt(null);
  stepBrain(plain.f, plain.end, [body('s1', 6, -5)], RNG);
  assert.equal(plain.f.pending, null, 'unmarked, no echo');
  const turned = meteorAt(['burning', 'echoing']);
  stepBrain(turned.f, turned.end, [body('s1', 6, -5)], RNG);
  turned.f.hp = turned.f.max * PHASE_AT[1];
  const out = stepBrain(turned.f, turned.end + 50, [body('s1', 6, -5)], RNG);
  assert.ok(out.some((o) => o.k === 'ph'));
  assert.equal(turned.f.atk.a, ATTACKS.cross.id, 'the turn\'s bound (WB9b)');
  assert.ok(turned.f.pending === null && turned.f.queue.every((e) => !e.echo), 'the echo is gone with the turn');
});

// ═══ THE WIRE AND THE RELAY ═══════════════════════════════════════════════════════════════════════════════════════

test('WB8b the wire: the brain\'s law (3 at WB8b; 5 since WB11) - a game that does not know the marks is refused and told to reload; the room says `fed`, projected field by field; the relay was world128 - world126 on its branch, one relay past main\'s OW6L (world127) at the merge - and PENITENT\'s badge vocabulary moved it on (world129) (mutants: the law not raised; a `fed` taken raw)', () => {
  assert.equal(GATE_BRAIN_V, 5); assert.equal(GATE_BRAIN_MIN, 5);   // WB9b/c: 4 - the three courts, the bound and the Reckoning; WB11: 5 - his host and the nine-trial rotation
  assert.equal(RELAY_VERSION, 'world155');   // ARENA4 moved it on last (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main's FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant's name, nm, and a beaten one's kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon's Breach - its words in the omen's lines and the herald's posts, the faithful's rite - main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc's six relays renumbered past main's HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room); SEAT1c moved it on (world145: the seats' titles and glyphs - five generic title ids, a `ts` claim beside them, four glyphs); SEAT1b moved it on (world144: the Watch's tick - a `watch` frame carrying a `k1` receipt the relay signs, net/watchReceipt.js); ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose's climb - `cl`, `cw` and a move's `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the host of the Legion-Lord - the `ahit` blow on one of it, the words `ad`, `amv`, `aatk`, `ah` and `adie` of the room, `lg` in the state, `a` in a chart row, the brain law 5; GATE-HEAL's `heal` and a chart row's `hl` with it - main's HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`, the kills of quest foes a member held for a partner, counted by every copy of the quest); before it GATE-UX moved it on (world136: the damage chart made at the kill - every challenger and their part, ranked, on the `fell` word of the court and on the fall in the state (`dm`)); before it WB9 moved it on (world135: the three courts of the Warden and the Reckoning of Dagon - his court and the walkways laid in the state (`ct`, `xa`), the crystals, their breaking and the stun (`cx`, `cxh`, `cxb`, `stun`, `su`, `rk`) and a blow on a crystal (`xhit`), judged and fanned by the relay - main's PARTY-MAP took world134 first); before it PARTY-MAP moved it on (world134: the `amap` frame, the automap rows a Shared Cartography caster reveals, to the party alone); before it SOFTCAP1 moved it on (world133: the party pose `cl`, a member character level for mentor mode); before it STRIKE-SHARED moved it on (world132: the strike spell on a hit and the trapper on a dead foe, both read by the clients alone); before it MERGE 2 moved it on (world131: the professions branch, BOUNTY1 + AUDIT 28 - `bq` and `lv` on the party pose, `k`, `a` and `t` on a bounty row - world125 on its branch, never deployed, a number VOICE1 took on main); before it REALM-DOOR moved it on (world130: the door refuses a token the account service signed as naming no realm character), past PENITENT's badge vocabulary (world129); WB8's marks were world128
  assert.ok(GATE_OUT_KINDS.includes('fed'));
  assert.deepEqual(validGateOut({ k: 'fed', ns: ['Ann'], h: 5, m: 10, at: 99, x: 1 }), { k: 'fed', ns: ['Ann'], h: 5, m: 10, at: 99 });
  assert.deepEqual(validGateOut({ k: 'fed', ns: ['  Ann\u0007\u202e ', 'Bran'], h: 5, m: 10, at: 99 }).ns, ['Ann', 'Bran'], 'each name as the wire says every name');
  const most = Array.from({ length: GATE_FEEDS_MAX }, (_, i) => `P${i}`);
  assert.equal(validGateOut({ k: 'fed', ns: most, h: 5, m: 10, at: 99 }).ns.length, GATE_FEEDS_MAX);
  for (const bad of [{ k: 'fed', ns: 'Ann', h: 5, m: 10, at: 99 }, { k: 'fed', ns: [], h: 5, m: 10, at: 99 }, { k: 'fed', ns: [...most, 'one more'], h: 5, m: 10, at: 99 },
    { k: 'fed', ns: [3], h: 5, m: 10, at: 99 }, { k: 'fed', n: 'Ann', h: 5, m: 10, at: 99 },
    { k: 'fed', ns: ['Ann'], h: 11, m: 10, at: 99 }, { k: 'fed', ns: ['Ann'], h: 5, m: 10, at: 0 }, { k: 'fed', ns: ['Ann'], h: -1, m: 10, at: 9 }]) assert.equal(validGateOut(bad), null, JSON.stringify(bad));
});

test('WB8b the relay: a gate\'s room fights under THE DAY\'S MARKS (gateModsOf - kept on the fight, said in the state every joiner is told), and refuses a game that says the old law (mutants: the fight born unmarked; the old law let in)', async () => {
  const DAY = 200, TT = gateTimes(DAY);
  const realNow = Date.now; let clock = TT.openAt + 1000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const r = world.room(gateRoomKey(DAY));
    const at = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
    const old = r.connect(); await r.hello(old, 'peer-0002', at(0, 10));
    await r.raw(old, JSON.stringify({ t: 'gate', k: 'in', lv: 10, bv: 2 }));
    assert.deepEqual(old.sent.filter((m) => m.t === 'gate'), [{ t: 'gate', k: 'no', m: 'the gate is closed' }], 'a game from before the marks: told to reload');
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 10));
    await r.raw(a, JSON.stringify({ t: 'gate', k: 'in', lv: 10, bv: GATE_BRAIN_V }));
    assert.deepEqual(r.room._fight.md, [...gateModsOf(DAY)]);
    const st = a.sent.find((m) => m.t === 'gate' && m.k === 'st');
    assert.deepEqual(st.md, [...gateModsOf(DAY)], 'the joiner is told his marks');
    for (let i = 0; i < Math.ceil(OPENING_MS / BRAIN_TICK_MS) + 2; i++) { clock += BRAIN_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); }
    assert.deepEqual(r.room._fight.md, [...gateModsOf(DAY)], 'and fights under them');
  } finally { Date.now = realNow; }
});
