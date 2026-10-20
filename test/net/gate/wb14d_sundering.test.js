// WB14d (2026-10-19, Mac: "the boss splitting and players having to split and navigate to beat both sides and then merging at
// the end for its final stand (chance based encounter modifer)", then "This is all yours to take on"): THE SUNDERING - on a
// Sundering night the second phase's turn tears him in two: Ruhn's Blade (his body) and Ruhn's Flame (a body of its own),
// in two courts with four or more challengers, side by side in one with fewer; each half a pool of what he has above
// SUNDER_LAST; a half brought down kneels, rises past the pair law, and both down together they rejoin at the first
// court's heart, where he stands whole for his last phase.
//
//   the law          net/gate/gateBrain.js ATTACKS 17 and 18, SUNDER_*, sunder/whole/kneel/rise/rejoin, stepSunder (the
//                    Flame's beat through its view of the fight), applyHit's `b`, profileOf's halves
//   the relay        net/bossRef.js judgeGate - the Flame's plain blows by its own body; server/src/index.js the hit's `b`
//   the wire         the state's `sd`, `sdh`, `kn`, `kr`, `rj`; `b` on a hit and on the Flame's `atk`, `mv`, `ph`
//   the screen       net/gate/gateLink.js (the fold), scenes/gate/gateFlame.js (its body, its blows, its words),
//                    scenes/gate/gateCourt.js (the cards, the targets, the bar's halves - ui/gate/gateBossBar.js)
//
// Design: bible/11-Multiplayer/Breach-Portents.md sections 5 and 6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COURTS, FLOOR, WALKWAY, ATTACKS, ATTACK_BY_ID, HALF, SUNDER_SPLIT_MIN, SUNDER_LAST, SUNDER_PAIR_MS, SUNDER_RISE, SUNDER_LONE_MS, SUNDER_MEND,
  SUNDER_SIZE, SUNDER_KITS, SUNDER_SIDE_M, SUNDER_TURN, PHASE_TURN, PHASE_AT, BRAIN_TICK_MS, HIT_KINDS, BOSS_R, BOSS_H, CROSS_WARD_MAX_MS,
  newFight, joinFight, stepBrain, stateOf, applyHit, profileOf, flameProfileOf, halfProfile, fightProfile, finalCourt, sunders, walkFormed,
  MELEE_REACH, RECKON_FIRST_MS,
} from '../../../src/net/gate/gateBrain.js';
import { judgeGate } from '../../../src/net/bossRef.js';
import { validGateIn, validGateOut } from '../../../src/net/wire.js';
import { foldGate, GATE_STATE_EMPTY, bossAt } from '../../../src/net/gate/gateLink.js';
import { flameOf, createGateFlame, FLAME_I, SUNDER_TEXT } from '../../../src/scenes/gate/gateFlame.js';
import { courtPhaseCard, SUNDER_CARD, createGateCourt } from '../../../src/scenes/gate/gateCourt.js';
import { bossBarModel, halfState, BOSS_BAR_TEXT } from '../../../src/ui/gate/gateBossBar.js';
import { halfName, flameLookOf, FLAME_LOOKS, ATTACK_COLORS, BOSS_CUES, bossPlace } from '../../../src/world/gate/gateBoss.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import { blowOf } from '../../../src/net/gate/gateStrike.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000, WRATH = T0 + 3_600_000;
const seeded = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const C0 = COURTS[FLOOR.first], C1 = COURTS[FLOOR.second], C2 = COURTS[FLOOR.third];
const BOSS = { id: 'ruhn', name: 'Valkynaz Ruhn', title: 'Warden of the Burning Court' };

/** A Sundering night's fight, `n` fighters at level 10, each standing where `where` says (sub -> [x, z]). */
function sunderFight(n, pt = ['sunder'], md = null) {
  const f = newFight(7, T0, WRATH, 'ruhn', md, pt);
  const where = {};
  for (let i = 0; i < n; i++) { joinFight(f, `s${i}`, `F${i}`, 10, T0, true); where[`s${i}`] = [3 + i, 3]; }
  const bodies = () => Object.entries(where).map(([sub, p]) => ({ sub, id: `peer-${sub}`, x: p[0], z: p[1], dead: false }));
  const run = { f, where, bodies, t: T0, out: [], rng: seeded(3) };
  run.step = (k = 1) => { for (let i = 0; i < k; i++) { const o = stepBrain(f, run.t, bodies(), run.rng); run.out.push(...o); judgeGate(f, bodies(), run.t); run.t += BRAIN_TICK_MS; } return run; };
  return run;
}
/** Bleed him to the second phase's turn and let the Sundering run to its end (the split). */
function toSplit(run) {
  const { f } = run;
  while (f.hp / f.max > PHASE_AT[0] + 0.005) { f.hp -= f.max * 0.01; run.step(); }
  for (let k = 0; k < 60 && !f.sd; k++) { f.hp = Math.min(f.hp, f.max * 0.659); run.step(); }
  return run;
}
/** Each fighter to a court: the first two to the Blade's, the rest to the Flame's (or all to the second court). */
function spread(run, two = true) {
  const subs = Object.keys(run.where);
  subs.forEach((sub, i) => { const C = !two || i < 2 ? C1 : C2; run.where[sub] = [C[0] + 2 + (i % 2), C[1] + (i % 3)]; });
  return run;
}
const kinds = (out, k) => out.filter((o) => o.k === k);
const atkKeys = (out, b) => out.filter((o) => o.k === 'atk' && (b === HALF.flame ? o.b === HALF.flame : o.b === undefined)).map((o) => ATTACK_BY_ID[o.a].key);
const hit = (run, sub, b, d = 500, r = HIT_KINDS.Spell) => { const p = run.where[sub]; return applyHit(run.f, sub, d, r, { x: p[0], z: p[1] }, run.t, null, b === HALF.flame ? { b: 1 } : {}); };

// ═══ THE TABLES ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14d the tables: the Sundering and the Rejoining, 17 and 18 - turns, never chosen, plain discs about his feet the relay counts; the halves\' kits split his arsenal between them, every key an attack (mutants: a kit naming no attack; the two discs elemental)', () => {
  assert.deepEqual([ATTACKS.sunder.id, ATTACKS.rejoin.id], [17, 18]);
  for (const A of [ATTACKS.sunder, ATTACKS.rejoin]) {
    assert.equal(A.shape, 'disc'); assert.equal(A.aim, 'self'); assert.equal(A.el, null, `${A.key}: his weight's, so the relay judges it`);
    assert.equal(A.w, 0); assert.ok(A.phase > 3, 'never in a phase\'s choice');
    assert.ok((A.r / 7.6) * 1000 < A.windup, `${A.key}: a runner leaves it`);
    assert.ok(ATTACK_COLORS[A.key] && BOSS_CUES.windup[A.key] && BOSS_CUES.land[A.key], `${A.key}: its colour and its cues`);
  }
  assert.deepEqual([ATTACKS.sunder.r, ATTACKS.sunder.windup, ATTACKS.rejoin.r, ATTACKS.rejoin.windup], [8, 2600, 9, 3200]);
  assert.deepEqual([SUNDER_SPLIT_MIN, SUNDER_LAST, SUNDER_PAIR_MS, SUNDER_RISE, SUNDER_LONE_MS, SUNDER_MEND], [4, 0.26, 20_000, 0.3, 10_000, 0.01]);
  assert.deepEqual(SUNDER_SIZE, [0.85, 0.75]);
  assert.deepEqual(SUNDER_KITS[HALF.blade], ['cleave', 'slam', 'charge', 'leap', 'chains']);
  assert.deepEqual(SUNDER_KITS[HALF.flame], ['hellfire', 'meteor', 'nova', 'brand']);
  for (const kit of SUNDER_KITS) for (const k of kit) assert.ok(ATTACKS[k], k);
  assert.equal(SUNDER_KITS[0].filter((k) => SUNDER_KITS[1].includes(k)).length, 0, 'no attack is both halves\'');
  assert.deepEqual(SUNDER_TURN.map((e) => e.a), ['leap', 'sunder']);
  assert.ok(sunders({ pt: ['sunder'] }) && sunders({ pt: ['vanguard', 'sunder'] }) && !sunders({ pt: ['vanguard'] }) && !sunders({ pt: null }));
  assert.equal(finalCourt({ pt: ['sunder'] }), FLOOR.first, 'his last stand in the first court');
});

test('WB14d the halves\' bodies: the Blade\'s profile is his marks\' at 0.85 of his size, the Flame\'s at 0.75 (Colossal\'s larger still), the rest of each his own; a whole Warden\'s untouched (mutants: the Blade at his whole size; the Flame\'s made from the Blade\'s)', () => {
  const P = fightProfile(null);
  assert.equal(profileOf({ md: null }), P, 'whole');
  const B = profileOf({ md: null, sd: {} }), F = flameProfileOf({ md: null, sd: {} });
  assert.ok(Math.abs(B.bossR - BOSS_R * 0.85) < 1e-9 && Math.abs(B.bossH - BOSS_H * 0.85) < 1e-9 && Math.abs(B.size - 0.85) < 1e-9);
  assert.ok(Math.abs(F.bossR - BOSS_R * 0.75) < 1e-9 && Math.abs(F.size - 0.75) < 1e-9, 'the Flame\'s from his, never from the Blade\'s');
  assert.equal(profileOf({ md: null, sd: {}, half: HALF.flame }), F, 'the Flame\'s view reads its own');
  assert.equal(B.atk, P.atk, 'his arsenal\'s lines'); assert.equal(B.half, HALF.blade); assert.equal(F.half, HALF.flame);
  const md = ['burning', 'colossal'], Q = fightProfile(md);
  assert.ok(Math.abs(halfProfile(Q, HALF.flame).bossR - Q.bossR * 0.75) < 1e-9 && Q.bossR > BOSS_R, 'a Colossal\'s halves are a Colossal\'s');
  assert.equal(halfProfile(Q, HALF.blade), halfProfile(Q, HALF.blade), 'made once a profile');
});

// ═══ THE TURN AND THE SPLIT ═══════════════════════════════════════════════════════════════════════════════════════

test('WB14d the turn: on a Sundering night the second phase leaps to his court\'s heart and calls the Sundering (a plain night bounds as WB9b); with four challengers he splits - the Blade to the second court over walkway 0, the Flame to the third over the Rift Way, never walkway 1 (mutants: the plain turn on a Sundering night; the Flame over walkway 1)', () => {
  const plain = toSplitPlain();
  assert.equal(atkKeys(plain.out)[atkKeys(plain.out).length - 1], 'cross', 'a plain night bounds');
  const run = toSplit(sunderFight(4));
  const { f } = run;
  const turn = atkKeys(run.out);
  assert.deepEqual(turn.slice(turn.indexOf('leap')), ['leap', 'sunder'], 'the leap to the heart, then the Sundering');
  const sd = run.out.find((o) => o.k === 'atk' && o.a === ATTACKS.sunder.id);
  assert.ok(Math.hypot(sd.x - C0[0], sd.z - C0[1]) < 0.01, 'called at his court\'s heart');
  assert.ok(f.sd && f.sd.two, 'four in the room: two courts');
  spread(run).step(40);
  assert.equal(f.court, FLOOR.second); assert.equal(f.sd.fl.court, FLOOR.third);
  assert.ok(Number.isFinite(f.xa[WALKWAY.second]) && Number.isFinite(f.xa[WALKWAY.rift]) && !Number.isFinite(f.xa[WALKWAY.third]), 'walkway 0 and the Rift Way, never walkway 1');
  const fl = run.out.find((o) => o.k === 'atk' && o.b === HALF.flame);
  assert.equal(ATTACK_BY_ID[fl.a], ATTACKS.cross); assert.deepEqual(fl.tg[0], [C2[0], C2[1]]);
});
function toSplitPlain() {
  const run = sunderFight(4, null);
  while (run.f.hp / run.f.max > PHASE_AT[0] + 0.005) { run.f.hp -= run.f.max * 0.01; run.step(); }
  run.f.hp = run.f.max * 0.659; run.step(2);
  return run;
}

test('WB14d the together layout: with fewer than four living challengers both halves bound to the second court and land either side of its heart; nothing lays the Rift Way (mutants: SUNDER_SPLIT_MIN off by one; both landing on one spot)', () => {
  for (const n of [1, 3]) {
    const run = toSplit(sunderFight(n));
    assert.equal(run.f.sd.two, false, `${n}: together`);
    spread(run, false).step(40);
    assert.equal(run.f.court, FLOOR.second); assert.equal(run.f.sd.fl.court, FLOOR.second);
    assert.ok(Math.abs(run.f.pos[0] - (C1[0] - SUNDER_SIDE_M)) < 0.5 || run.f.atk || run.f.move, 'the Blade west of its heart, or already about');
    const fl = run.out.find((o) => o.k === 'atk' && o.b === HALF.flame && ATTACK_BY_ID[o.a] === ATTACKS.cross);
    assert.deepEqual(fl.tg[0], [C1[0] + SUNDER_SIDE_M, C1[1]], 'the Flame east of it');
    const bl = run.out.find((o) => o.k === 'atk' && o.b === undefined && ATTACK_BY_ID[o.a] === ATTACKS.cross);
    assert.deepEqual(bl.tg[0], [C1[0] - SUNDER_SIDE_M, C1[1]]);
    assert.ok(!Number.isFinite(run.f.xa[WALKWAY.rift]));
  }
});

test('WB14d the pools: what he stands at above SUNDER_LAST, half each as a share of his whole - his health unchanged at the split - and the state said at once with the halves in it, before any word of the Flame\'s (mutants: the pools the whole of his health; the state a beat late)', () => {
  const run = toSplit(sunderFight(4));
  const { f } = run;
  const frac = f.hp / f.max;
  assert.ok(Math.abs(f.sd.m - (frac - SUNDER_LAST) / 2) < 1e-9 && Math.abs(f.sd.bl.h - f.sd.m) < 1e-12 && Math.abs(f.sd.fl.h - f.sd.m) < 1e-12);
  const iSt = run.out.findIndex((o) => o.k === 'st' && o.sd), iFl = run.out.findIndex((o) => o.b === HALF.flame);
  assert.ok(iSt >= 0 && (iFl < 0 || iSt < iFl), 'the halves said before the Flame speaks');
  const st = run.out[iSt];
  assert.equal(st.sd.two, 1); assert.equal(st.sd.m, Math.ceil(f.sd.m * f.max)); assert.deepEqual(st.sd.kn, [0, 0]);
  assert.deepEqual(validGateOut(st).sd, { two: 1, m: st.sd.m, h: st.sd.h, kn: [0, 0], lo: [0, 0], rj: 0, fl: { x: st.sd.fl.x, z: st.sd.fl.z, yw: st.sd.fl.yw, mv: null, atk: null, sh: st.sd.fl.sh, ct: FLOOR.first, su: 0 } });
});

test('WB14d the kits and the courts: over a split fight the Blade casts its own and his turn\'s, the Flame its own and its turn\'s (the bound, its Nova as its ward breaks), each in its own court, each its words its own (mutants: the Flame choosing from his whole arsenal; its words unnamed)', () => {
  const run = spread(toSplit(sunderFight(4))).step(400);
  const blade = atkKeys(run.out), flame = atkKeys(run.out, HALF.flame);
  const bk = new Set([...SUNDER_KITS[HALF.blade], 'leap', 'sunder', 'cross']), fk = new Set([...SUNDER_KITS[HALF.flame], 'cross']);
  assert.ok(blade.every((k) => bk.has(k)), blade.join()); assert.ok(flame.every((k) => fk.has(k)), flame.join());
  assert.ok(flame.includes('hellfire') && flame.includes('meteor'), 'its fire'); assert.ok(blade.includes('cleave') || blade.includes('slam'), 'his steel');
  assert.deepEqual(flame.slice(0, 2), ['cross', 'nova'], 'its turn: the bound, then the Nova as its ward breaks');
  assert.deepEqual(blade.slice(blade.indexOf('sunder') + 1, blade.indexOf('sunder') + 3), ['cross', 'slam'], 'the Blade\'s: the bound, then the Slam');
  for (const o of run.out.filter((x) => x.b === HALF.flame)) assert.ok(['atk', 'mv', 'ph'].includes(o.k), o.k);
  assert.ok(run.out.some((o) => o.k === 'ph' && o.b === HALF.flame), 'its ward\'s word');
  for (const o of run.out.filter((x) => x.k === 'atk' && x.b === HALF.flame && x.a !== ATTACKS.cross.id)) assert.ok(Math.hypot(o.x - C2[0], o.z - C2[1]) <= 24, 'cast in the third court');
  const ids = run.out.filter((o) => o.k === 'atk').map((o) => o.i);
  assert.equal(new Set(ids).size, ids.length, 'one count of attack numbers for both');
});

// ═══ THE BLOWS ════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14d a blow names its half: `b` 1 the Flame\'s pool, else the Blade\'s; each from its own court, past its own ward, measured from its own smaller body, never past its pool, each half\'s threat its own (mutants: a Flame blow on the Blade\'s pool; the Flame struck from the Blade\'s court; the pool uncapped)', () => {
  const run = spread(toSplit(sunderFight(4))).step(140);
  const { f } = run;
  f.shieldUntil = 0; f.sd.fl.shieldUntil = 0;
  const bl0 = f.sd.bl.h, fl0 = f.sd.fl.h, hp0 = f.hp;
  const got = hit(run, 's2', HALF.flame);
  assert.ok(got > 0 && Math.abs(f.sd.fl.h - (fl0 - got / f.max)) < 1e-12 && f.sd.bl.h === bl0 && Math.abs(f.hp - (hp0 - got)) < 1e-6);
  assert.ok(f.sd.fl.threat.s2 > 0 && !f.threat.s2, 'the Flame\'s threat');
  run.t += 1000;
  assert.equal(hit(run, 's0', HALF.flame), 0, 'not from the Blade\'s court');
  assert.ok(hit(run, 's0', HALF.blade) > 0 && f.threat.s0 > 0, 'the Blade, from its own');
  run.t += 1000;
  f.sd.fl.shieldUntil = run.t + 5000;
  assert.equal(hit(run, 's3', HALF.flame), 0, 'its ward');
  f.sd.fl.shieldUntil = 0;
  const near = [f.sd.fl.pos[0] + 1.5 * 0.75 + MELEE_REACH + 2.9, f.sd.fl.pos[1]];
  run.where.s3 = near; run.t += 1000;
  assert.ok(applyHit(f, 's3', 50, HIT_KINDS.Melee, { x: near[0], z: near[1] }, run.t, null, { b: 1 }) > 0, 'reach from the Flame\'s own smaller body');
  run.where.s3 = [near[0] + 0.9, near[1]]; run.t += 1000;
  assert.equal(applyHit(f, 's3', 50, HIT_KINDS.Melee, { x: near[0] + 0.9, z: near[1] }, run.t, null, { b: 1 }), 0);
  f.sd.fl.h = 10 / f.max; run.t += 1000;
  assert.ok(Math.abs(hit(run, 's2', HALF.flame) - 10) < 1e-6, 'never past its pool');
  assert.ok(f.sd.fl.kn > 0, 'and spent, it kneels');
});

test('WB14d the kneel and the pair law: a half spent kneels (its blow dropped, a stun of SUNDER_PAIR_MS, no blow taken), said once to the court; the other not brought down in time and it rises with SUNDER_RISE of its pool, his health with it (mutants: a kneeling half struck; the rise at the whole pool; never said)', () => {
  const run = spread(toSplit(sunderFight(4))).step(140);
  const { f } = run;
  f.shieldUntil = 0;
  f.sd.bl.h = 5 / f.max;
  hit(run, 's0', HALF.blade);
  const at = f.sd.bl.kn;
  assert.ok(at > 0 && f.atk === null && f.move === null && f.stunUntil === at + SUNDER_PAIR_MS);
  run.t += 1000;
  assert.equal(hit(run, 's1', HALF.blade), 0, 'a kneeling half takes nothing');
  run.out.length = 0; run.step(4);
  assert.deepEqual(kinds(run.out, 'kn'), [{ k: 'kn', b: HALF.blade, at }]);
  assert.ok(!run.out.some((o) => o.k === 'atk' && o.b === undefined), 'no blow of the Blade\'s while it kneels');
  const hp = f.hp;
  run.out.length = 0;
  while (run.t < at + SUNDER_PAIR_MS) run.step();
  run.step();
  const kr = kinds(run.out, 'kr');
  assert.equal(kr.length, 1); assert.equal(kr[0].b, HALF.blade); assert.equal(kr[0].h, Math.round(SUNDER_RISE * f.sd.m * f.max));
  assert.ok(Math.abs(f.sd.bl.h - SUNDER_RISE * f.sd.m) < 1e-12 && f.sd.bl.kn === 0 && f.stunUntil === 0 && f.hp > hp, 'risen, his health with it');
  assert.equal(kinds(run.out, 'kn').length, 0, 'said once');
});

test('WB14d THE REJOINING: both brought down within the pair law and they bound back to the first court (`rj`), the Blade to its heart and the Flame beside it, warded; the Rejoining is called there, and he stands whole at SUNDER_LAST - his last phase in the first court, its wait, the Spokes and the four between, his Reckonings armed there (mutants: the pair law ignored; the last phase in the third court; his health not SUNDER_LAST)', () => {
  const run = spread(toSplit(sunderFight(4))).step(140);
  const { f } = run;
  f.shieldUntil = 0; f.sd.fl.shieldUntil = 0;
  f.sd.bl.h = 5 / f.max; hit(run, 's0', HALF.blade);
  run.step(8);
  f.sd.fl.h = 5 / f.max; hit(run, 's2', HALF.flame);
  run.out.length = 0; run.step();
  assert.deepEqual(run.out.filter((o) => ['kn', 'rj'].includes(o.k)).map((o) => o.k), ['kn', 'rj'], 'the second kneel, then the Rejoining');
  assert.ok(f.sd.rj > 0 && Math.abs(f.hp - f.max * SUNDER_LAST) < 1e-6 && f.shieldUntil > run.t && f.sd.fl.shieldUntil > run.t);
  for (const sub of Object.keys(run.where)) run.where[sub] = [C0[0] + 3, C0[1] - 4];   // the court runs back with them
  run.out.length = 0; run.step(30);
  const crosses = run.out.filter((o) => o.k === 'atk' && o.a === ATTACKS.cross.id);
  assert.deepEqual(crosses.map((o) => [o.b ?? 0, o.tg[0]]).sort((a, b) => a[0] - b[0]), [[0, [C0[0], C0[1]]], [1, [C0[0] + SUNDER_SIDE_M, C0[1]]]]);
  run.step(40);
  const keys = atkKeys(run.out);
  assert.deepEqual(atkKeys(run.out, HALF.flame), ['cross'], 'the halves choose nothing while they go to rejoin');
  assert.ok(keys.includes('rejoin'), keys.join());
  assert.equal(f.sd, null, 'whole'); assert.equal(f.phase, 3); assert.equal(f.court, FLOOR.first);
  assert.ok(Math.abs(f.hp / f.max - SUNDER_LAST) < 1e-9);
  const ph = kinds(run.out, 'ph').filter((o) => o.n === 3 && o.b === undefined);
  assert.ok(ph.length >= 1, 'the last phase said');
  assert.deepEqual(keys.slice(keys.indexOf('rejoin') + 1, keys.indexOf('rejoin') + 3), ['spokes', 'spokes'], 'its signature in the first court');
  assert.ok(run.out.some((o) => o.k === 'st' && o.ph === 3 && !o.sd), 'the state says him whole');
  run.step(Math.ceil(RECKON_FIRST_MS / BRAIN_TICK_MS) + 20);
  assert.ok(atkKeys(run.out).includes('reckon') || f.rk !== 0, 'his Reckonings armed in the first court');
  assert.ok(profileOf(f).bossR === BOSS_R, 'his whole body again');
});

test('WB14d no last phase by his health: sundered, his health under PHASE_AT[1] turns nothing - the Rejoining alone begins it (mutants: the health\'s third phase on a Sundering night)', () => {
  const run = spread(toSplit(sunderFight(4))).step(140);
  const { f } = run;
  f.shieldUntil = 0;
  f.sd.bl.h = 0.001; f.hp = f.max * (SUNDER_LAST + f.sd.bl.h + f.sd.fl.h);
  f.sd.fl.h = 0.02; f.hp = f.max * (SUNDER_LAST + f.sd.bl.h + f.sd.fl.h);
  assert.ok(f.hp / f.max < PHASE_AT[1]);
  run.step(8);
  assert.equal(f.phase, 2); assert.ok(f.sd);
});

test('WB14d a half alone mends: in the split layout a standing half with nobody living in its court SUNDER_LONE_MS mends SUNDER_MEND of its pool a second, never past it, his health with it, and says so (`lo`); never in the together layout, never while kneeling (mutants: a mend at once; past the pool; in the together layout)', () => {
  const run = spread(toSplit(sunderFight(4))).step(140);
  const { f } = run;
  f.sd.fl.h = f.sd.m * 0.5; f.hp = f.max * (SUNDER_LAST + f.sd.bl.h + f.sd.fl.h);
  for (const sub of ['s2', 's3']) run.where[sub] = [C1[0], C1[1] + 4];
  const h0 = f.sd.fl.h, hp0 = f.hp;
  run.step(Math.floor(SUNDER_LONE_MS / BRAIN_TICK_MS) - 2);
  assert.ok(Math.abs(f.sd.fl.h - h0) < 1e-12 && !f.sd.fl.mend, 'not yet');
  run.step(4 + 40);
  const mended = f.sd.fl.h - h0;
  assert.ok(mended > 0 && mended <= SUNDER_MEND * f.sd.m * 11 && f.hp > hp0, 'a share a second');
  assert.equal(stateOf(f).sd.lo[HALF.flame], 1); assert.equal(stateOf(f).sd.lo[HALF.blade], 0, 'the Blade has its two');
  run.step(400);
  assert.ok(f.sd.fl.h <= f.sd.m + 1e-12, 'never past its pool');
  const tog = spread(toSplit(sunderFight(2)), false).step(140);
  for (const sub of Object.keys(tog.where)) tog.where[sub] = [C0[0], C0[1]];
  tog.f.sd.fl.h = tog.f.sd.m * 0.5;
  tog.step(80);
  assert.equal(tog.f.sd.fl.h, tog.f.sd.m * 0.5, 'never together');
});

test('WB14d under his marks: Soul-Hungry\'s feeding heals each standing half by half its share, never past its pool; the Wrath stills his Flame (mutants: the feeding into his whole health; the Flame striking through the Wrath)', () => {
  const run = spread(toSplit(sunderFight(4, ['sunder'], ['burning', 'soulhungry']))).step(140);
  const { f } = run;
  const P = profileOf(f);
  f.players.s0.dealt = f.players.s0.share;   // a real part
  f.sd.bl.h = f.sd.m * 0.5; f.sd.fl.h = f.sd.m * 0.99; f.hp = f.max * (SUNDER_LAST + f.sd.bl.h + f.sd.fl.h);
  const b0 = f.sd.bl.h, hp0 = f.hp;
  const dead = () => run.bodies().map((b) => (b.sub === 's0' ? { ...b, dead: true } : b));
  run.out.push(...stepBrain(f, run.t, dead(), run.rng)); run.t += BRAIN_TICK_MS;
  assert.ok(Math.abs(f.sd.bl.h - (b0 + P.feed / 2)) < 1e-12, 'the Blade half its share');
  assert.ok(Math.abs(f.sd.fl.h - f.sd.m) < 1e-12, 'the Flame to its pool, no further');
  assert.ok(f.hp > hp0 && f.hp <= f.max * (SUNDER_LAST + 2 * f.sd.m) + 1e-6);
  const w = sunderFight(4);
  toSplit(w); spread(w).step(140);
  w.t = WRATH - ATTACKS.wrath.windup; w.step();
  assert.equal(w.f.sd.fl.atk, null); assert.equal(w.f.sd.fl.move, null);
});

test('WB14d the relay\'s judge: the Flame\'s plain blows by its own body (its bound\'s landing), the Sundering\'s and the Rejoining\'s discs as his; its elemental blows the struck screen\'s (mutants: the Flame\'s blow never judged)', () => {
  const run = toSplit(sunderFight(4));
  const { f } = run;
  const stood = run.bodies().map((b) => ({ ...b, x: C2[0] + 1, z: C2[1] }));
  for (let k = 0; k < 40 && !(f.sd.fl.atk && f.sd.fl.atk.a === ATTACKS.cross.id); k++) run.step();
  const a = f.sd.fl.atk;
  assert.equal(ATTACK_BY_ID[a.a], ATTACKS.cross);
  const got = judgeGate(f, stood, a.at + 400);
  assert.ok(got.length === 4 && got.every((g) => g.share === Math.min(1, blowOf(a, flameProfileOf(f)).pct)), 'its landing on those who ran ahead of it');
  for (const A of [ATTACKS.sunder, ATTACKS.rejoin]) assert.ok(!blowOf({ a: A.id }, profileOf(f)).saved, `${A.key}: counted`);
  // its fire: the struck screen's - a Meteor on all four counts nothing here
  const met = { i: 999, a: ATTACKS.meteor.id, at: run.t + 10, x: f.sd.fl.pos[0], z: f.sd.fl.pos[1], yw: 0, tg: [[C2[0] + 1, C2[1]]] };
  f.sd.fl.atk = met;
  assert.deepEqual(judgeGate(f, stood, met.at + 400), [], 'its element\'s');
});

// ═══ THE WIRE ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14d the wire: a hit names its half (`b` 1 kept, 0 dropped, anything else refused); the Flame\'s atk, mv and ph carry `b` 1 and nothing else; sdh, kn, kr and rj bounded; a state\'s halves whole or the state refused (mutants: a `b` of 2 kept; a pool past its whole kept)', () => {
  const H = { k: 'hit', q: 3, d: 40, r: 0 };
  assert.deepEqual(validGateIn({ ...H, b: 1 }), { ...H, b: 1 });
  assert.deepEqual(validGateIn({ ...H, b: 0 }), H);
  assert.equal(validGateIn({ ...H, b: 2 }), null);
  const atk = { k: 'atk', i: 5, a: 3, at: 9000, x: 1, z: 2, yw: 0.5, tg: [[1, 1]] };
  assert.equal(validGateOut({ ...atk, b: 1 }).b, 1); assert.equal(validGateOut(atk).b, undefined); assert.equal(validGateOut({ ...atk, b: 0 }), null);
  assert.equal(validGateOut({ k: 'mv', x: 1, z: 1, tx: 2, tz: 2, v: 3, at: 9000, b: 1 }).b, 1);
  assert.deepEqual(validGateOut({ k: 'ph', n: 2, until: 9000, b: 1 }), { k: 'ph', n: 2, until: 9000, b: 1 });
  assert.deepEqual(validGateOut({ k: 'sdh', h: [10, 20], m: 30 }), { k: 'sdh', h: [10, 20], m: 30 });
  assert.equal(validGateOut({ k: 'sdh', h: [10, 31], m: 30 }), null);
  assert.deepEqual(validGateOut({ k: 'kn', b: 1, at: 9000, x: 1 }), { k: 'kn', b: 1, at: 9000 });
  assert.equal(validGateOut({ k: 'kn', b: 2, at: 9000 }), null);
  assert.deepEqual(validGateOut({ k: 'kr', b: 0, h: 12, at: 9000 }), { k: 'kr', b: 0, h: 12, at: 9000 });
  assert.deepEqual(validGateOut({ k: 'rj', at: 9000 }), { k: 'rj', at: 9000 });
  const run = toSplit(sunderFight(4));
  const st = stateOf(run.f);
  assert.ok(validGateOut(st)?.sd);
  for (const bad of [{ h: [st.sd.m + 1, 0] }, { kn: [0] }, { two: 2 }, { lo: [0, 3] }, { fl: { ...st.sd.fl, ct: 9 } }]) assert.equal(validGateOut({ ...st, sd: { ...st.sd, ...bad } }), null, JSON.stringify(bad));
  assert.match(read('server/src/index.js'), /GATE_SEAM\.hit\(f, a\.sub, m\.d, m\.r, at, now, m\.q, m\.b === 1 \? \{ b: 1 \} : undefined\);/);
});

// ═══ THE SCREEN ═══════════════════════════════════════════════════════════════════════════════════════════════════

/** A court's state folded from a fight's own words (the relay's), as the session would. */
function folded(run) {
  let s = GATE_STATE_EMPTY;
  for (const o of [stateOf(run.f)]) s = foldGate(s, validGateOut(o), run.t);
  return s;
}

test('WB14d the fold: a state\'s halves held; the Flame\'s words (`b` 1) move its body and never his - its bound over the Rift Way lays walkway 2 at once; a kneel drops the half\'s blow and stuns it, a rising lifts it, the Rejoining ends both kneels; the Wrath stills the Flame; a word of the halves before a state that names them is nothing (mutants: a Flame blow folded as his; the Rift Way not laid)', () => {
  const run = toSplit(sunderFight(4));
  let s = folded(run);
  assert.ok(s.sd && s.sd.two && s.sd.fl.ct === FLOOR.first);
  const A = { k: 'atk', i: 77, a: ATTACKS.cross.id, at: run.t + 2400, x: 0, z: 0, yw: 0, tg: [[C2[0], C2[1]]], b: 1 };
  const s2 = foldGate(s, validGateOut(A), run.t);
  assert.equal(s2.sd.fl.atk.i, 77); assert.equal(s2.atk, s.atk, 'his own untouched');
  assert.equal(s2.xa[WALKWAY.rift], run.t, 'the Rift Way laid from its word');
  assert.ok(!Number.isFinite(s2.xa[WALKWAY.third]));
  const mv = foldGate(s2, validGateOut({ k: 'mv', x: 1, z: 2, tx: 3, tz: 4, v: 3, at: run.t, b: 1 }), run.t);
  assert.equal(mv.sd.fl.atk, null); assert.deepEqual([mv.sd.fl.x, mv.sd.fl.z], [1, 2]); assert.equal(mv.move, s.move);
  const ph = foldGate(mv, validGateOut({ k: 'ph', n: 2, until: run.t + 6000, b: 1 }), run.t);
  assert.equal(ph.sd.fl.sh, run.t + 6000); assert.equal(ph.shieldUntil, mv.shieldUntil);
  const kn = foldGate(s2, validGateOut({ k: 'kn', b: 1, at: run.t }), run.t);
  assert.equal(kn.sd.fl.atk, null); assert.equal(kn.sd.fl.su, run.t + SUNDER_PAIR_MS); assert.equal(kn.sd.h[1], 0); assert.equal(kn.sd.kn[1], run.t);
  const knB = foldGate({ ...s2, atk: { i: 3, a: 0, at: run.t + 500, x: 0, z: 0, yw: 0, tg: [] } }, validGateOut({ k: 'kn', b: 0, at: run.t }), run.t);
  assert.equal(knB.atk, null); assert.equal(knB.stunUntil, run.t + SUNDER_PAIR_MS); assert.equal(knB.stunAt, run.t);
  const kr = foldGate(kn, validGateOut({ k: 'kr', b: 1, h: 40, at: run.t + 1 }), run.t);
  assert.equal(kr.sd.kn[1], 0); assert.equal(kr.sd.h[1], 40); assert.equal(kr.sd.fl.su, 0);
  const rj = foldGate(knB, validGateOut({ k: 'rj', at: run.t + 2 }), run.t);
  assert.deepEqual([rj.sd.kn, rj.sd.h, rj.sd.rj, rj.stunUntil], [[0, 0], [0, 0], run.t + 2, 0]);
  const sdh = foldGate(s, validGateOut({ k: 'sdh', h: [5, 6], m: 50 }), run.t);
  assert.deepEqual([sdh.sd.h, sdh.sd.m], [[5, 6], 50]);
  const wr = foldGate(s2, validGateOut({ k: 'atk', i: 90, a: ATTACKS.wrath.id, at: run.t + 6000, x: 0, z: 0, yw: 0, tg: [] }), run.t);
  assert.equal(wr.sd.fl.atk, null, 'the Wrath stills it');
  const plain = { ...s, sd: null };
  assert.equal(foldGate(plain, validGateOut(A), run.t), plain);
  assert.equal(foldGate(plain, validGateOut({ k: 'kn', b: 0, at: run.t }), run.t), plain);
  const whole = foldGate(s2, validGateOut({ ...stateOf(run.f), sd: undefined }), run.t);
  assert.equal(whole.sd, null, 'a state that names none: he stands whole');
});

test('WB14d the Flame\'s view: the state with its body in his place and its half\'s profile - one view a state; none while he stands whole (mutants: the view reading his place; a view made every frame)', () => {
  const run = spread(toSplit(sunderFight(4))).step(60);
  const s = folded(run);
  const F = flameOf(s);
  assert.deepEqual([F.x, F.z, F.yaw, F.shieldUntil], [s.sd.fl.x, s.sd.fl.z, s.sd.fl.yaw, s.sd.fl.sh]);
  assert.equal(F.atk, s.sd.fl.atk); assert.equal(F.half, HALF.flame); assert.equal(F.lg, null);
  assert.equal(profileOf(F).half, HALF.flame); assert.equal(profileOf(s).half, HALF.blade);
  assert.equal(flameOf(s), F, 'kept while the state is');
  assert.equal(flameOf({ ...s, sd: null }), null);
  assert.deepEqual(bossPlace(F, run.t), bossAt(F, run.t));
});

test('WB14d its look and its names: his aspect\'s Atronach at his scale, three quarters of him; the halves named for him and his aspect (mutants: the Flame drawn as him; one name for every aspect)', () => {
  assert.deepEqual(FLAME_LOOKS, { burning: 35, rime: 38, storm: 36, venom: 37 });
  assert.equal(flameLookOf('rime').mobile, 38); assert.equal(flameLookOf('nonesuch').mobile, 35); assert.equal(flameLookOf('storm').scale, 3);
  assert.equal(halfName(HALF.blade, fightProfile(null), BOSS.name), 'Ruhn\'s Blade');
  assert.deepEqual(['burning', 'rime', 'storm', 'venom'].map((id) => halfName(HALF.flame, fightProfile([id]), BOSS.name)), ['Ruhn\'s Flame', 'Ruhn\'s Rime', 'Ruhn\'s Storm', 'Ruhn\'s Venom']);
});

test('WB14d the cards: a Sundering night\'s second turn is the Sundering\'s (bring both down together), its last stand Dagon\'s Champion back in the first court - carded as the Rejoining begins, never twice; a plain night\'s as WB13e (mutants: the plain card on a Sundering night; the last card twice)', () => {
  assert.deepEqual(courtPhaseCard(2, ['sunder']), { kicker: 'II', main: SUNDER_CARD.main(), sub: SUNDER_CARD.sub() });
  assert.deepEqual(courtPhaseCard(3, ['sunder']), { kicker: 'III', main: 'Dagon\'s Champion', sub: 'Back to the first court.' });
  assert.deepEqual(SUNDER_CARD.main(), 'The Sundering'); assert.equal(SUNDER_CARD.sub(), 'Bring both halves down together.');
  assert.equal(courtPhaseCard(2).sub, 'Follow him over the walkway.'); assert.equal(courtPhaseCard(3, ['vanguard']).sub, 'Follow him to the last court.');
  const gc = read('src/scenes/gate/gateCourt.js');
  assert.match(gc, /if \(s\.sd\?\.rj && !rjCarded\) \{ rjCarded = true; if \(t - s\.sd\.rj <= FED_LATE_MS\)/);
  assert.match(gc, /if \(c && !\(s\.phase === 3 && rjCarded\)\) beat =/);
});

test('WB14d the bar: sundered, the halves side by side under his health - each its name, its pool\'s share and its line (Kneels with its seconds, Warded, Alone); a Sundering night\'s last mark at SUNDER_LAST; the callout the Flame\'s where I stand in its court alone (mutants: one track; the Blade\'s blow called in the Flame\'s court)', () => {
  const run = spread(toSplit(sunderFight(4))).step(140);
  let s = folded(run);
  s = { ...s, sd: { ...s.sd, h: [s.sd.m, Math.round(s.sd.m / 2)], kn: [run.t - 4000, 0], lo: [0, 1], fl: { ...s.sd.fl, sh: 0 } }, stunUntil: run.t - 4000 + SUNDER_PAIR_MS, shieldUntil: 0 };
  const m = bossBarModel(s, run.t, BOSS);
  assert.deepEqual(m.marks, [PHASE_AT[0], SUNDER_LAST]);
  assert.deepEqual(m.halves.map((h) => h.name), ['Ruhn\'s Blade', 'Ruhn\'s Flame']);
  assert.ok(Math.abs(m.halves[1].frac - 0.5) < 0.01 && m.halves[0].frac === 1);
  assert.deepEqual(m.halves.map((h) => h.state), [BOSS_BAR_TEXT.kneels(16), BOSS_BAR_TEXT.alone()]);
  assert.equal(halfState({ ...s, sd: { ...s.sd, kn: [0, 0], lo: [0, 0], fl: { ...s.sd.fl, sh: run.t + 3000 } } }, HALF.flame, run.t), BOSS_BAR_TEXT.halfWarded());
  assert.equal(bossBarModel({ ...s, sd: null }, run.t, BOSS).halves, null, 'whole: one track');
  const fa = { i: 9, a: ATTACKS.meteor.id, at: run.t + 1500, x: s.sd.fl.x, z: s.sd.fl.z, yw: 0, tg: [[s.sd.fl.x, s.sd.fl.z]] };
  const withF = { ...s, atk: { i: 8, a: ATTACKS.cleave.id, at: run.t + 700, x: s.x, z: s.z, yw: 0, tg: [] }, sd: { ...s.sd, fl: { ...s.sd.fl, atk: fa } } };
  assert.equal(bossBarModel(withF, run.t, BOSS, null, { flame: flameOf(withF), flameMine: true }).callout.text, 'Meteor of Oblivion', 'in its court, its blow');
  assert.equal(bossBarModel(withF, run.t, BOSS, null, { flame: flameOf(withF), flameMine: false }).callout.text, 'Cleave');
  assert.equal(bossBarModel({ ...s, atk: null, stunUntil: run.t + 9000, stunAt: run.t }, run.t, BOSS).callout, null, 'a kneel is never his stun\'s word');
  assert.equal(bossBarModel({ ...s, sd: null, atk: null, stunUntil: run.t + 9000, stunAt: run.t }, run.t, BOSS).callout.text, BOSS_BAR_TEXT.stunned(9), 'his own stun says itself');
});

/** A court driven over a state, my feet at (x, z) of the court's frame. */
function court(stateRef, clock, feetAt, sent) {
  return createGateCourt({
    link: { state: () => stateRef.s, receipt: () => null, watching: () => false }, now: () => clock.t,
    feet: () => courtToDungeon(feetAt[0], 0, feetAt[1]), player: () => ({ health: 100, maxHealth: 100 }),
    strike: (d, how) => sent.push(['strike', d, how?.name]), send: (h) => { sent.push(['hit', h]); return true; }, say: (x) => sent.push(['say', x]),
  });
}

test('WB14d the court: the Flame\'s blow judged on my feet once; its body offered to my blows from its own court alone, out as the `hit` word with `b` 1 - never through its ward or its kneel; the kneeling Blade turns a blow; the Sundering\'s moments said while news (mutants: the Flame struck from the Blade\'s court; its blow judged twice; the kneel never said)', () => {
  const run = spread(toSplit(sunderFight(4))).step(140);
  const s0 = folded(run);
  const F0 = s0.sd.fl, ref = { s: { ...s0, sd: { ...s0.sd, fl: { ...F0, sh: 0, su: 0 } } } }, clock = { t: run.t }, sent = [];
  const here = [F0.x + 2, F0.z + 1];
  const c = court(ref, clock, here, sent);
  c.frame();
  const tg = c.hostTargets();
  assert.equal(tg.length, 1); assert.equal(tg[0].i, FLAME_I);
  assert.ok(Math.abs(tg[0].radius - BOSS_R * 0.75) < 1e-9 && tg[0].entity.warded === false);
  assert.equal(c.hostHit({ i: FLAME_I, d: 33.4, r: HIT_KINDS.Melee }), true);
  const h = sent.find((x) => x[0] === 'hit')[1];
  assert.equal(h.b, 1); assert.equal(h.d, 33);
  ref.s = { ...ref.s, sd: { ...ref.s.sd, fl: { ...ref.s.sd.fl, sh: clock.t + 5000 } } };
  c.frame();
  assert.equal(c.hostHit({ i: FLAME_I, d: 30, r: HIT_KINDS.Melee }), false, 'its ward');
  ref.s = { ...ref.s, sd: { ...ref.s.sd, fl: { ...ref.s.sd.fl, sh: 0 } } };
  const far = court(ref, clock, [C1[0], C1[1]], []);
  far.frame();
  assert.equal(far.hostTargets().length, 0, 'from the Blade\'s court, no Flame to strike');
  assert.equal(far.hostHit({ i: FLAME_I, d: 30, r: HIT_KINDS.Melee }), false);
  // its blow on my feet - a Meteor where I stand, judged once at its landing
  const met = { i: 51, a: ATTACKS.meteor.id, at: clock.t + 3000, x: F0.x, z: F0.z, yw: 0, tg: [[here[0], here[1]]] };
  ref.s = { ...ref.s, sd: { ...ref.s.sd, fl: { ...ref.s.sd.fl, atk: met } } };
  c.frame();
  clock.t = met.at + 300; c.frame();
  clock.t += 200; c.frame();
  assert.equal(sent.filter((x) => x[0] === 'strike').length, 1, 'once');
  assert.equal(c.state().flame.judgedI, 51);
  // the kneel said, and the Blade kneeling turns a blow
  ref.s = { ...ref.s, sd: { ...ref.s.sd, kn: [clock.t, 0] }, stunUntil: clock.t + SUNDER_PAIR_MS, stunAt: clock.t };
  c.frame();
  assert.ok(sent.some((x) => x[0] === 'say' && x[1] === SUNDER_TEXT.kneels('Ruhn\'s Blade')), 'said to the court');
  const blade = court(ref, clock, [C1[0] + 2, C1[1]], []);
  blade.frame();
  assert.equal(blade.target().warded, true, 'a kneeling Blade turns it');
  assert.equal(blade.hit({ d: 40, r: HIT_KINDS.Melee }), false);
});

test('WB14d the court draws it: the Flame\'s telegraph and its mark in the court\'s pass, its glow in its lights, its sprite among its batches; the halves\' words, the Rejoining\'s line and its card while news (mutants: the Flame\'s shapes never drawn; the Rejoining unsaid)', () => {
  const src = read('src/scenes/gate/gateCourt.js');
  assert.match(src, /for \(const fs of flame\.shapes\(\)\) \{ pass\.draw\(fs, proj, view, eye, seconds, fog, COURT_CENTRE, _walked, _floors\); drew = true; \}/);
  assert.match(src, /for \(const l of flame\.lights\(s, t\)\) _lights\.push\(l\);/);
  assert.match(src, /for \(const b of flame\.batches\(\)\) _batches\.push\(b\);/);
  assert.match(src, /flame\.offerBodies\(bodiesLane, s, now\(\)\);/);
  assert.match(src, /if \(i === FLAME_I\) return !!s && s\.day !== null && flame\.hit\(s, \{ d, r \}, t\);/);
  const run = spread(toSplit(sunderFight(4))).step(140);
  const s0 = folded(run), sent = [], clock = { t: run.t };
  const f = createGateFlame({ say: (x) => sent.push(x), bossName: () => BOSS.name });
  const atk = { i: 61, a: ATTACKS.nova.id, at: clock.t + 2000, x: s0.sd.fl.x, z: s0.sd.fl.z, yw: 0, tg: [] };
  f.frame({ ...s0, sd: { ...s0.sd, fl: { ...s0.sd.fl, atk } } }, clock.t);
  assert.equal(f.shapes().length, 2, 'its mark and its blow');
  f.frame({ ...s0, sd: { ...s0.sd, rj: clock.t } }, clock.t + 10);
  assert.deepEqual(sent, [SUNDER_TEXT.rejoin()]);
  f.frame({ ...s0, sd: null }, clock.t + 20);
  assert.equal(f.shapes().length, 0, 'whole: no Flame');
});
