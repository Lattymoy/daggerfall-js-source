// WB14e (2026-10-19, Mac: "And whatever else you can cook up", then "This is all yours to take on"): THE TITHE-IMP - one
// night in five, unannounced, an Imp at 1.3 of its size burning gold rises at his court's rim farthest from him a while
// after his wake and runs from the nearest challenger; it strikes nobody, and dives into the fire TITHE_LIFE_MS after it
// rose. Caught, each challenger who struck it is handed its tithe - a seed of the relay's own, to that account alone:
// gold and a gem of the classic eight into the pack.
//
//   the law          net/gate/gateLaw.js gateTitheOf; net/gate/gateBrain.js HOST_KINDS 6, HOST_GONE.fled, TITHE_*, titheHpFor,
//                    stepTithe and titheBeat, applyHostHit's strikers, newFight's `ti`
//   the relay        server/src/index.js the night's moment at the fight's birth; _gateFan's `to` (one account's sockets)
//   the wire         GATE_HOST_KINDS 7, GATE_HOST_GONE 4, the `tithe` word
//   the screen       net/gate/gateLink.js (the fold), systems/gate/gateSpoils.js titheList, scenes/gate/gateCourt.js (the
//                    tithe into the pack, once), scenes/gate/gateHost.js (its words, its size, its gold), the bar
//
// Design: bible/11-Multiplayer/Breach-Portents.md section 9.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COURTS, HOST, HOST_KINDS, HOST_BLOWS, HOST_RISE_MS, HOST_GONE, HOST_RIM_R, HOST_HP_MIN, OPENING_MS, BRAIN_TICK_MS, HIT_KINDS, PHASE_AT,
  TITHE_LIFE_MS, TITHE_S, TITHE_FLEE_M, titheHpFor, dpsRef, newFight, joinFight, stepBrain, stateOf, applyHostHit, hostBlowUnder, BASE_PROFILE,
} from '../../../src/net/gate/gateBrain.js';
import { gateTitheOf, TITHE_ONE_IN, TITHE_AFTER_MS, TITHE_SPREAD_MS, gatePortentsOf, portentsLine, isGateDay } from '../../../src/net/gate/gateLaw.js';
import { validGateOut, GATE_HOST_KINDS, GATE_HOST_GONE } from '../../../src/net/wire.js';
import { foldGate, GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import { titheList, TITHE_GOLD_PER_LEVEL } from '../../../src/systems/gate/gateSpoils.js';
import { ITEM_GROUPS } from '../../../src/systems/loot/loot.js';
import { createGateCourt, COURT_TITHE_TEXT } from '../../../src/scenes/gate/gateCourt.js';
import { createSpoilsPool } from '../../../src/scenes/spoilsPool.js';
import { waveLine, COURT_HOST_TEXT } from '../../../src/scenes/gate/gateHost.js';
import { hostLookOf, hostFallAct, TITHE_SCALE, TITHE_GOLD } from '../../../src/world/gate/gateBoss.js';
import { bossBarModel } from '../../../src/ui/gate/gateBossBar.js';
import { courtToDungeon } from '../../../src/world/gate/gateArena.js';
import { GATE_SEAM } from '../../../src/net/bossSeam.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000, WRATH = T0 + 3_600_000, RUN = 7.6, TI = 60_000;
const seeded = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const C0 = COURTS[0];
const BOSS = { id: 'ruhn', name: 'Valkynaz Ruhn', title: 'Warden of the Burning Court' };

/** A night with a Tithe-Imp `ti` after his wake (none: null), `n` fighters at level 10 about the first court. */
function titheFight(n = 3, ti = TI, md = null) {
  const f = newFight(7, T0, WRATH, 'ruhn', md, null, ti);
  const where = {};
  for (let i = 0; i < n; i++) { joinFight(f, `s${i}`, `F${i}`, 10, T0, true); where[`s${i}`] = [Math.sin(i * 2.1) * 6, Math.cos(i * 2.1) * 6]; }
  const run = { f, where, t: T0, out: [], rng: seeded(9) };
  run.bodies = () => Object.entries(where).map(([sub, p]) => ({ sub, id: `peer-${sub}`, x: p[0], z: p[1], dead: false }));
  run.step = (k = 1) => { for (let i = 0; i < k; i++) { run.out.push(...stepBrain(f, run.t, run.bodies(), run.rng)); run.t += BRAIN_TICK_MS; } return run; };
  run.until = (at) => { while (run.t < at) run.step(); return run; };
  run.imp = () => f.lg?.ads.find((a) => a.k === HOST.tithe) ?? null;
  return run;
}
const rise = (run) => run.until(T0 + OPENING_MS + TI + 2 * BRAIN_TICK_MS);

// ═══ THE LAW ══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14e the night\'s draw: one gate in TITHE_ONE_IN carries a Tithe-Imp, its moment TITHE_AFTER_MS to TITHE_AFTER_MS + TITHE_SPREAD_MS after his wake, in whole seconds, the day\'s alone - never in the omen (mutants: every night; its moment past the spread)', () => {
  assert.deepEqual([TITHE_ONE_IN, TITHE_AFTER_MS, TITHE_SPREAD_MS], [5, 50_000, 100_000]);
  let n = 0, nights = 0;
  for (let d = 0; d < 20_000; d++) {
    if (!isGateDay(d)) continue;
    nights++;
    const ti = gateTitheOf(d);
    if (ti === null) continue;
    n++;
    assert.ok(ti >= TITHE_AFTER_MS && ti < TITHE_AFTER_MS + TITHE_SPREAD_MS && ti % 1000 === 0, `${d}: ${ti}`);
    assert.equal(gateTitheOf(d), ti, 'the day\'s alone');
  }
  assert.ok(Math.abs(n / nights - 1 / TITHE_ONE_IN) < 0.02, `${n} of ${nights}`);
  const omen = read('src/net/gate/gateHerald.js') + read('src/net/gate/gateMods.js');
  assert.ok(!/tithe/i.test(omen), 'never said before it comes');
  for (let d = 0; d < 400; d++) assert.ok(!/tithe/i.test(portentsLine(gatePortentsOf(d)) ?? ''), 'no portent of it - never in the omen');   // AUDIT WB14 (RECORD nit): the omen's words, not a list that never holds it
});

test('WB14e the kind: an Imp at 1.3 of its body, under a runner\'s pace, that strikes nobody; risen as an Imp rises; fled its own way of going; ten seconds of the court\'s mean reference its health (AUDIT WB14 PLAY-6: four was a formality - a lone chaser caught it in 5 s of its 22) (mutants: a blow of its own; outrunning a runner)', () => {
  const K = HOST_KINDS[HOST.tithe];
  assert.deepEqual([K.id, K.key], [6, 'tithe']);
  assert.ok(Math.abs(K.r - HOST_KINDS[HOST.harrier].r * 1.3) < 1e-9 && Math.abs(K.h - HOST_KINDS[HOST.harrier].h * 1.3) < 1e-9);
  assert.ok(K.speed > HOST_KINDS[HOST.harrier].speed && K.speed < RUN, 'faster than an Imp, never than a runner');
  assert.equal(HOST_BLOWS[HOST.tithe], null); assert.equal(hostBlowUnder(HOST.tithe, BASE_PROFILE), null);
  assert.equal(HOST_RISE_MS[HOST.tithe], HOST_RISE_MS[HOST.harrier]);
  assert.equal(HOST_GONE.fled, 3);
  assert.equal(TITHE_LIFE_MS, 22_000); assert.equal(TITHE_S, 10);
  assert.equal(K.speed, 6.8, 'AUDIT WB14 (PLAY-6): a chase - 0.8 m/s under a runner');
  assert.equal(titheHpFor([10, 10, 10]), Math.round(TITHE_S * dpsRef(10)));
  assert.equal(titheHpFor([1]), Math.max(HOST_HP_MIN, Math.round(TITHE_S * dpsRef(1))));
  assert.equal(titheHpFor([]), HOST_HP_MIN);
  assert.deepEqual([GATE_HOST_KINDS, GATE_HOST_GONE], [8, 4]);   // PIN MOVED (WB14f): and the Captive's gaolers
});

test('WB14e it rises once at its moment after his wake, at his court\'s rim on the side away from him, with the court\'s levels\' health - never before, never on a night without one (mutants: risen at the fight\'s birth; at the rim beside him; twice)', () => {
  const run = titheFight();
  run.until(T0 + OPENING_MS + TI - BRAIN_TICK_MS);
  assert.equal(run.imp(), null, 'not yet');
  Object.assign(run.f, { pos: [12, 5], move: null, atk: null, nextAt: Infinity });   // he stands off his court's heart, still
  rise(run);
  const ad = run.out.filter((o) => o.k === 'ad' && o.w === HOST.tithe);
  assert.equal(ad.length, 1);
  assert.equal(ad[0].m, titheHpFor([10, 10, 10]));
  const [, x, z] = ad[0].a[0], { f } = run;
  assert.ok(Math.abs(Math.hypot(x - C0[0], z - C0[1]) - HOST_RIM_R) < 0.02, 'at the rim');
  const toHim = Math.atan2(12 - C0[0], 5 - C0[1]), toIt = Math.atan2(x - C0[0], z - C0[1]);
  const apart = Math.abs(((toIt - toHim + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  assert.ok(apart > Math.PI / 2, `the far side from him (${apart.toFixed(2)} off his bearing)`);
  assert.ok(Math.hypot(x - 12, z - 5) > HOST_RIM_R, 'farther than the rim is from him');
  run.step(40);
  assert.equal(run.out.filter((o) => o.k === 'ad' && o.w === HOST.tithe).length, 1, 'once');
  assert.ok(validGateOut(ad[0]), 'its rising on the wire');
  assert.ok(stateOf(f).lg?.some((t) => t[1] === HOST.tithe), 'in the state');
  const none = titheFight(3, null).until(T0 + OPENING_MS + 200_000);
  assert.equal(none.imp(), null); assert.equal(none.f.tt, null);
});

test('WB14e it waits for a challenger before him, and never rises in his last phase (mutants: risen to an empty court; risen in Dagon\'s Champion\'s)', () => {
  const empty = titheFight();
  for (const sub of Object.keys(empty.where)) empty.where[sub] = [COURTS[1][0], COURTS[1][1]];
  rise(empty).step(8);
  assert.equal(empty.imp(), null, 'nobody before him');
  for (const sub of Object.keys(empty.where)) empty.where[sub] = [3, 3];
  empty.step(2);
  assert.ok(empty.imp(), 'then it rises');
  const late = titheFight();
  late.f.phase = 3;
  rise(late).step(8);
  assert.equal(late.imp(), null, 'his last phase: never');
});

test('WB14e it runs from the nearest challenger at its own pace, kept in his court, and along the rim when the rim stops it (mutants: running at them; stopping at the rim)', () => {
  const run = rise(titheFight()).step(Math.ceil(HOST_RISE_MS[HOST.tithe] / BRAIN_TICK_MS) + 1);
  const a = run.imp(), chaser = 's0';
  const mv = run.out.filter((o) => o.k === 'amv').flatMap((o) => o.m).filter((m) => m[0] === a.i);
  assert.ok(mv.length && mv.every((m) => m[5] === HOST_KINDS[HOST.tithe].speed || m[5] === 0), 'its own pace');
  for (let k = 0; k < 60; k++) {
    const b = run.imp();
    if (!b) break;
    const d = 1.5, ux = Math.sin(k), uz = Math.cos(k);
    run.where[chaser] = [b.x + ux * d, b.z + uz * d];
    const before = Math.hypot(b.x - run.where[chaser][0], b.z - run.where[chaser][1]);
    run.step(2);
    const c = run.imp();
    if (!c) break;
    assert.ok(Math.hypot(c.x - C0[0], c.z - C0[1]) <= 24, 'in his court');
    assert.ok(Math.hypot(c.x - run.where[chaser][0], c.z - run.where[chaser][1]) >= before - 0.05, 'away from them');
  }
  // cornered: a chaser between it and the heart - it goes along the rim, never stands
  const r = rise(titheFight()).step(6), b = r.imp();
  const ang = Math.atan2(b.x - C0[0], b.z - C0[1]);
  r.where.s0 = [C0[0] + Math.sin(ang) * (HOST_RIM_R - 1.2), C0[1] + Math.cos(ang) * (HOST_RIM_R - 1.2)];
  r.step(1);
  const m = r.imp().mv;
  assert.ok(m && Math.hypot(m.tx - m.x, m.tz - m.z) > 1, 'it moves');
  assert.ok(Math.abs(Math.hypot(m.tx - C0[0], m.tz - C0[1]) - HOST_RIM_R) < 2.5, 'along the rim');
  assert.ok(TITHE_FLEE_M > 0);
});

test('WB14e uncaught, it dives into the fire TITHE_LIFE_MS after it rose - or as his phase turns, before his host crumbles (mutants: it never leaves; it crumbles at the turn)', () => {
  const run = rise(titheFight());
  const at = run.f.tt.at;
  run.until(at + TITHE_LIFE_MS - BRAIN_TICK_MS);
  assert.ok(run.imp(), 'still running');
  run.step(2);
  const gone = run.out.filter((o) => o.k === 'adie' && o.w === HOST_GONE.fled);
  assert.equal(gone.length, 1); assert.equal(run.imp(), null);
  assert.ok(validGateOut(gone[0]));
  run.step(200);
  assert.equal(run.out.filter((o) => o.k === 'ad' && o.w === HOST.tithe).length, 1, 'never again');
  const turn = rise(titheFight()).step(4);
  turn.f.hp = turn.f.max * (PHASE_AT[0] - 0.01);
  turn.out.length = 0; turn.step();
  const words = turn.out.filter((o) => o.k === 'adie');
  assert.equal(words[0].w, HOST_GONE.fled, 'fled at the turn');
});

test('WB14e caught: each challenger whose blow landed on it is handed its tithe on the next beat - a seed of the relay\'s own each, to that account alone (`to`), once (mutants: the tithe to everyone; a struck-for-nothing fighter paid; paid twice)', () => {
  const run = rise(titheFight()).step(6);
  const a = run.imp(), p = (sub) => ({ x: a.x + 0.5, z: a.z });
  Object.assign(run.f.players.s2, { bucket: 0, bucketAt: run.t });   // a blow that lands for nothing (the purse spent)
  assert.deepEqual(applyHostHit(run.f, 's2', a.i, 10, HIT_KINDS.Spell, p('s2'), run.t, 9), []);
  assert.equal(run.f.lg.ads.find((o) => o.i === a.i).by ?? null, null, 'struck for nothing: no part of it');
  assert.deepEqual(applyHostHit(run.f, 's1', a.i, 10, HIT_KINDS.Spell, p('s1'), run.t, 1), []);
  assert.deepEqual(run.f.lg.ads.find((o) => o.i === a.i).by, ['s1']);
  const out = applyHostHit(run.f, 's0', a.i, 500, HIT_KINDS.Spell, p('s0'), run.t + 10, 2);
  assert.deepEqual(out.map((o) => [o.k, o.w, o.n]), [['adie', HOST_GONE.slain, 'F0']]);
  assert.deepEqual(run.f.tt.by, ['s1', 's0']);
  run.out.length = 0; run.step();
  const paid = run.out.filter((o) => o.k === 'tithe');
  assert.deepEqual(paid.map((o) => o.to).sort(), ['s0', 's1'], 'those who struck it, s2 never');
  assert.ok(paid.every((o) => Number.isSafeInteger(o.c) && o.c >= 0 && o.c <= 0xffffffff) && paid[0].c !== paid[1].c);
  assert.deepEqual(validGateOut(paid[0]), { k: 'tithe', c: paid[0].c, at: paid[0].at }, 'on the wire, `to` left to the relay');
  run.step(20);
  assert.equal(run.out.filter((o) => o.k === 'tithe').length, 2, 'once');
  assert.ok(run.f.tt.paid && run.f.tt.c.s0 === paid.find((o) => o.to === 's0').c);
});

test('WB14e beside the Legion-Lord\'s host it steps its own way - never a Ward-Bearer\'s pulse (mutants: stepped as a bearer)', () => {
  const run = rise(titheFight(3, TI, ['burning', 'legion'])).step(4);
  const a = run.imp();
  assert.ok(a, 'risen on a Legion night too');
  for (let k = 0; k < 24; k++) { const b = run.imp(); if (b) run.where.s0 = [b.x + 1, b.z]; run.step(); }   // a challenger at its heels, inside a Ward-Bearer's reach
  assert.ok(!run.out.some((o) => o.k === 'aatk' && o.a.some((x) => x[0] === a.i)), 'it strikes nobody');
  assert.ok(run.out.some((o) => o.k === 'amv' && o.m.some((x) => x[0] === a.i)), 'it runs');
});

// ═══ THE RELAY AND THE WIRE ═══════════════════════════════════════════════════════════════════════════════════════

test('WB14e the relay: a fight born with its night\'s moment (gateTitheOf), through the seam; a word with `to` goes to that fighter\'s sockets alone, without it (mutants: the tithe fanned to the court)', () => {
  const src = read('server/src/index.js');
  assert.match(src, /md: gateModsOf\(day\), pt: gatePortentsOf\(day\), ti: gateTitheOf\(day\) \}\);/);
  assert.match(src, /for \(const fr of frames\) if \(fr\.to != null\) \{ const \{ to, \.\.\.word \} = fr; const s = JSON\.stringify\(\{ t: 'gate', \.\.\.word \}\); for \(const \[ws, b\] of \[\.\.\.this\._courtSockets\(\)\]\) if \(b\.sub === to\) this\._send\(ws, s\); \}/);
  assert.match(src, /frames = frames\.filter\(\(fr\) => fr\.to == null\);/);
  assert.equal(GATE_SEAM.new({ day: 3, now: T0, wrathAt: WRATH, boss: 'ruhn', ti: 70_000 }).ti, 70_000);
  assert.equal(GATE_SEAM.new({ day: 3, now: T0, wrathAt: WRATH, boss: 'ruhn' }).ti, null);
  assert.equal(newFight(3, T0, WRATH, 'ruhn', null, null, -5).ti, null, 'nothing that is no moment');
  for (const c of [-1, 2 ** 32, 1.5]) assert.equal(validGateOut({ k: 'tithe', c, at: 9 }), null, String(c));
  assert.equal(validGateOut({ k: 'adie', is: [1], w: 4, at: 9 }), null, 'no fifth way of going');
});

// ═══ THE SCREEN ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14e the fold: my tithe kept on the state - through a state of the same fight, gone with a new one (mutants: the tithe lost at the next state; carried into another fight)', () => {
  const st = (d) => validGateOut({ ...stateOf(newFight(d, T0, WRATH, 'ruhn')), d });
  let s = foldGate(GATE_STATE_EMPTY, st(7), T0);
  s = foldGate(s, validGateOut({ k: 'tithe', c: 77, at: T0 + 5 }), T0 + 5);
  assert.deepEqual(s.tithe, { c: 77, at: T0 + 5 });
  assert.deepEqual(foldGate(s, st(7), T0 + 9).tithe, { c: 77, at: T0 + 5 });
  assert.equal(foldGate(s, st(8), T0 + 9).tithe, null);
});

test('WB14e its tithe: gold at TITHE_GOLD_PER_LEVEL a level (a fifth either way) and one gem of the classic eight, the seed\'s own (mutants: the gold unscaled; another seed\'s gem)', () => {
  const a = titheList(12345, 10), b = titheList(12345, 10), c = titheList(54321, 10);
  assert.deepEqual(a.map((p) => p.kind), ['gold', 'item']);
  assert.ok(a[0].gold >= TITHE_GOLD_PER_LEVEL * 10 * 0.8 && a[0].gold <= TITHE_GOLD_PER_LEVEL * 10 * 1.2);
  assert.equal(a[0].gold, b[0].gold); assert.equal(a[1].item.templateIndex, b[1].item.templateIndex);
  assert.ok(ITEM_GROUPS.Gems.includes(a[1].item.templateIndex) && a[1].item.group === 'Gems');
  const seen = new Set();
  for (let s = 0; s < 400; s++) seen.add(titheList(s * 7919, 5)[1].item.templateIndex);
  assert.equal(seen.size, ITEM_GROUPS.Gems.length, 'each of the eight');
  assert.ok(titheList(1, 30)[0].gold > titheList(1, 3)[0].gold * 5, 'by the level');
  assert.notDeepEqual([a[0].gold, a[1].item.templateIndex], [c[0].gold, c[1].item.templateIndex]);
});

test('WB14e the court: my tithe into my pack once (the spoils\' own door), its gold burst where it fell, and what it was said; a watcher has none (mutants: taken every frame; never said)', () => {
  const taken = [], said = [];
  const st = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 1, hp: 900, max: 1000, wrathAt: 1e12, x: 0, z: 0,
    lg: { ads: [], gone: [{ i: 1, k: HOST.tithe, x: 4, z: -3, w: HOST_GONE.slain, n: 'F0', at: 5000 }] }, tithe: { c: 999, at: 5000 } };
  const link = { state: () => st, watching: () => false };
  const c = createGateCourt({ link, now: () => 5100, feet: () => courtToDungeon(2, 0, 2), player: () => ({ health: 100, maxHealth: 100, level: 10 }), takeSpoil: (p) => taken.push(p), say: (x) => said.push(x) });
  c.frame(); c.frame();
  const want = titheList(999, 10);
  assert.equal(taken.length, 2, 'once');
  assert.equal(taken[0].gold, want[0].gold); assert.equal(taken[1].item.templateIndex, want[1].item.templateIndex);
  assert.ok(said.includes(COURT_TITHE_TEXT.mine(want[0].gold, want[1].item.name)));
  assert.ok(c.state().bursts.some((b) => b.color === TITHE_GOLD && Math.abs(b.at[0] - courtToDungeon(4, 1, -3)[0]) < 1e-9), 'its gold where it fell');
  const w = [];
  const watcher = createGateCourt({ link: { state: () => st, watching: () => true }, now: () => 5100, feet: () => courtToDungeon(2, 0, 2), player: () => ({ health: 100, maxHealth: 100, level: 10 }), takeSpoil: (p) => w.push(p) });
  watcher.frame();
  assert.equal(w.length, 0);
  // the court's door is the spoils pool's own: its `take`, the host's takeGateSpoil (scenes/world.js hands the court the pool alone)
  const viaPool = [];
  const pool = createSpoilsPool({ ray: () => null, now: () => 5100, take: (p) => viaPool.push(p) });
  createGateCourt({ link, spoils: pool, now: () => 5100, feet: () => courtToDungeon(2, 0, 2), player: () => ({ health: 100, maxHealth: 100, level: 10 }) }).frame();
  assert.deepEqual(viaPool.map((p) => p.kind), want.map((p) => p.kind), 'through the pool\'s take, once');
  const court = /const gateCourt = gateLink \? createGateCourt\(\{[\s\S]*?\n {2}\}\) : null;/.exec(read('src/scenes/world.js'))[0];
  assert.match(court, /spoils: spoilsPool,/);
  assert.doesNotMatch(court, /takeSpoil/, 'the court is handed the pool, its door with it');
  assert.match(read('src/scenes/world.js'), /const spoilsPool = createSpoilsPool\(\{[\s\S]{0,600}?take: takeGateSpoil,/);
});

test('WB14e its words, its look and the bar: its bolt said as it rises, its catching by name, its escape; an Imp\'s sprite at TITHE_SCALE named the Tithe-Imp; sinking into the fire as it flees; never counted his host (mutants: no line at its rising; an escape said as a catch; counted on the bar)', () => {
  assert.equal(waveLine({}, HOST.tithe, 'Ruhn', 'Tithe-Imps'), COURT_HOST_TEXT.tithe());
  assert.equal(COURT_HOST_TEXT.titheCaught('Ann'), 'Ann catches the Tithe-Imp! Its tithe goes to all who struck it.');   // PIN MOVED (AUDIT WB14 TEXT-11): nothing spills - it goes into their packs
  assert.deepEqual([COURT_TITHE_TEXT.mine(594, 'Ruby'), COURT_TITHE_TEXT.mine(1200, 'Emerald'), COURT_TITHE_TEXT.mine(600, 'Amber')], ['You take its tithe of 594 gold and a Ruby.', 'You take its tithe of 1,200 gold and an Emerald.', 'You take its tithe of 600 gold and an Amber.'], 'AUDIT WB14 (TEXT-1): the gem with its article');
  assert.equal(COURT_HOST_TEXT.titheEscaped(), 'The Tithe-Imp escapes into the fire.');
  assert.match(read('src/scenes/gate/gateHost.js'), /else if \(g\.k === HOST\.tithe && !s\.fell && s\.wrath == null\) say\(g\.w === 0 \? COURT_HOST_TEXT\.titheCaught\(g\.n\) : COURT_HOST_TEXT\.titheEscaped\(\)\);/);
  const L = hostLookOf(HOST.tithe, 'rime');
  assert.deepEqual([L.mobile, L.name, L.scale], [1, 'Tithe-Imp', TITHE_SCALE]);
  assert.equal(hostLookOf(HOST.harrier, 'rime').scale, 1);
  assert.ok(hostFallAct({ k: HOST.tithe, w: HOST_GONE.fled, at: 0 }, 450, L).sink > 0, 'into the fire');
  assert.equal(hostFallAct({ k: HOST.tithe, w: HOST_GONE.slain, at: 0 }, 450, L).sink, 0);
  const s = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 1, hp: 900, max: 1000, wrathAt: 1e12, lg: { ads: [{ i: 1, k: HOST.tithe, h: 50, m: 60, x: 0, z: 0 }], gone: [] } };
  assert.equal(bossBarModel(s, 100, BOSS).host, null, 'no host of his');
});
