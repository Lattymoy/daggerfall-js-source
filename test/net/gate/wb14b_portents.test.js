// WB14b (2026-10-19, Mac: "adding the chance of a gate to spawn with platforms of wave based adds ... the boss splitting
// and players having to split ... (chance based encounter modifer)", then "This is all yours to take on"): THE PORTENTS AND
// THE NIGHT'S FLOOR PLAN - the third kind of mark beside his aspect and his trials, drawn by a shuffle bag over the nights
// that can carry one, and the floors and walkways a night's portents stand: the Vanguard's Muster and Bridgehead, the
// Sundering's Rift Way, the Captive's Pen.
//
//   the table and the bag   net/gate/gateMods.js GATE_PORTENTS, validGatePortents; net/gate/gateLaw.js gatePortentsOf
//   the plan                net/gate/gateBrain.js COURTS, WALKS, nightPlan, liveFloors, onFloor, clampToFloor
//   the fight and the wire  newFight's `pt`, the state's `pt` and `xa` by walkway (xaWire); net/wire.js
//   the screen              world/gate/gateArena.js planOfDay, arrivalOf, the plan's model, collider, slabs, lights, arena;
//                           the telegraph's whole-arena shape over the plan's floors alone
//   the words               the chat (systems/gate/gateOmen.js), the map's card (gateTip), the marks card
//                           (ui/gate/gateMarksView.js portentRowsOf), the Discord omen post (net/gate/gateHerald.js)
//
// Design: bible/11-Multiplayer/Breach-Portents.md sections 1, 2 and 6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GATE_PORTENTS, GATE_DIRE, gateDireLine, GATE_TRIALS, CAPTIVE_NAMES, validGatePortents, portentOf, portentBits, hasPortent, gatePortentsWords } from '../../../src/net/gate/gateMods.js';
import { gatePortentsOf, gateModsOf, gateBossOf, gateTimes, marksLine, marksCarryPortent, portentsLine, gateTitheOf, captiveNameOf, PORTENT_BAG, isGateDay, TITHE_AFTER_MS, TITHE_SPREAD_MS, TITHE_ONE_IN } from '../../../src/net/gate/gateLaw.js';
import {
  COURTS, COURTS_HIS, COURT_R, COURT_CENTRE, FLOOR, WALKWAY, WALKS, WALK_ENDS, WALK_HALF_W, WALK_LEAD_MS, WALK_FORM_MS,
  nightPlan, PLAN_PLAIN, planOf, liveFloors, onFloor, clampToFloor, walkwayOf, finalCourt, newFight, joinFight, applyHeal, stateOf, xaWire,
} from '../../../src/net/gate/gateBrain.js';
import { validGateOut, GATE_COURT_BOUND, GATE_WALKS_MAX, GATE_FLOORS_MAX } from '../../../src/net/wire.js';
import { foldGate, crossLaid, GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import {
  planOfDay, arrivalOf, gateArenaBlock, buildCourtModel, courtFloorTris, walkSlabs, courtLights, courtArena, courtOpenings, courtToDungeon,
  COURT_ARCHIVE, COURT_RUNE_RECORD, ARRIVE_Z, WAY_IN_Z,
} from '../../../src/world/gate/gateArena.js';
import { telegraphShape, GateTelegraphRenderer } from '../../../src/render/gate/gateTelegraph.js';
import { ATTACKS } from '../../../src/net/gate/gateBrain.js';
import { TOWER_WINDOW, floorGap, deadlandsIslands, LAND_CLEAR_M } from '../../../src/world/deadlandsLand.js';
import { SIGIL_TOWER } from '../../../src/render/deadlands.js';
import { createGateOmen, gateTip } from '../../../src/systems/gate/gateOmen.js';
import { marksCardModel, drawGateMarksCard, destroyGateMarksCard, PORTENT_CSS } from '../../../src/ui/gate/gateMarksView.js';
import { omenPost } from '../../../src/net/gate/gateHerald.js';
import { createGateCourt } from '../../../src/scenes/gate/gateCourt.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000;
const WHOLE = WALK_LEAD_MS + WALK_FORM_MS;
/** The first gate day from `from` whose portents are `want` (null for a plain night). */
function dayOf(want, from = 0) {
  for (let d = from; d < from + 5000; d++) { const p = gatePortentsOf(d); if ((p?.join('+') ?? null) === want) return d; }
  throw new Error(`no day for ${want}`);
}
const at = (k, dx = 0, dz = 0) => [COURTS[k][0] + dx, COURTS[k][1] + dz];

// ═══ THE TABLE ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14b the portents: three, each its name, its one line, its tip and its receipt bit (1, 2, 4); the Dire Breach is no row - the Vanguard and the Sundering, its own line before theirs; a night\'s portents on the wire are one, or the Dire Breach\'s pair, in the table\'s order, known words alone (mutants: a pair the table never makes; an unknown word let through)', () => {
  assert.deepEqual(GATE_PORTENTS.map((p) => p.id), ['vanguard', 'sunder', 'captive']);
  assert.deepEqual(GATE_PORTENTS.map((p) => p.bit), [1, 2, 4]);
  for (const p of GATE_PORTENTS) { assert.ok(p.name && p.line.endsWith('.') && p.tip, p.id); assert.equal(portentOf(p.id), p); }
  assert.equal(portentOf('nope'), null);
  assert.deepEqual([...GATE_DIRE], ['vanguard', 'sunder']);
  assert.equal(validGatePortents(null), null);
  assert.equal(validGatePortents(undefined), null);
  assert.deepEqual(validGatePortents(['captive']), ['captive']);
  assert.deepEqual(validGatePortents(['sunder', 'vanguard']), ['vanguard', 'sunder'], 'the Dire Breach, in the table\'s order');
  for (const bad of [[], ['vanguard', 'captive'], ['sunder', 'captive'], ['vanguard', 'vanguard'], ['nope'], ['vanguard', 'sunder', 'captive'], 'vanguard', [1]]) assert.equal(validGatePortents(bad), undefined, JSON.stringify(bad));
  assert.equal(portentBits(['vanguard', 'sunder']), 3);
  assert.equal(portentBits(['captive']), 4);
  assert.equal(portentBits(null), 0);
  assert.ok(hasPortent(['vanguard', 'sunder'], 'sunder') && !hasPortent(null, 'sunder') && !hasPortent(['captive'], 'sunder'));
  assert.equal(gatePortentsWords(['vanguard', 'sunder']), 'The Vanguard · The Sundering');   // PIN MOVED (AUDIT WB14 TEXT-16): each a name of its own
  assert.equal(gatePortentsWords(null), '');
  assert.equal(portentsLine(['vanguard']), 'His vanguard holds the approach.');
  assert.equal(portentsLine(['vanguard', 'sunder']), `${gateDireLine()} His vanguard holds the approach. He tears in two at the second phase.`);
  assert.equal(portentsLine(null), '');
});

// ═══ THE BAG ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14b the bag: a night\'s portents from its day alone, the same every time; none on a Legion-Lord night; every other night that can carry one carries one - so no two gates running share a portent; each round of six brings the Vanguard twice, the Sundering twice, the Captive once and the Dire Breach once (mutants: the bag ignoring the Legion-Lord; two carriers running; a round short of its six)', () => {
  assert.deepEqual(PORTENT_BAG, ['vanguard', 'vanguard', 'sunder', 'sunder', 'captive', 'dire']);
  const N = 3000;
  let carriers = 0, carried = 0, prev = null, legion = 0;
  const round = [];
  const tally = new Map();
  for (let d = 0; d < N; d++) {
    assert.ok(isGateDay(d));
    const p = gatePortentsOf(d), md = gateModsOf(d);
    assert.equal(gatePortentsOf(d), p, 'made once: one answer every asker shares');
    if (!marksCarryPortent(md)) { legion++; assert.equal(p, null, `day ${d}: a Legion-Lord night carries none`); continue; }
    if (p) assert.deepEqual(validGatePortents(p), [...p], 'a valid set');
    if (carriers % 2 === 0) { assert.ok(p, `the ${carriers}th carrier carries one`); carried++; round.push(p.join('+')); }
    else assert.equal(p, null, `the ${carriers}th carrier rests`);
    if (p && prev) assert.fail(`day ${d}: two portents running`);
    prev = p;
    carriers++;
    if (round.length === PORTENT_BAG.length) {
      const c = (k) => round.filter((x) => x === k).length;
      assert.deepEqual([c('vanguard'), c('sunder'), c('captive'), c('vanguard+sunder')], [2, 2, 1, 1], `a round: ${round}`);
      for (const k of round) tally.set(k, (tally.get(k) ?? 0) + 1);
      round.length = 0;
    }
  }
  assert.ok(legion > 0.15 * N && legion < 0.3 * N, `Legion-Lord nights: ${legion}`);
  assert.ok(Math.abs(carried / N - 0.39) < 0.03, `about two nights in five carry one: ${carried} of ${N}`);
  assert.equal(gatePortentsOf(-1), null, 'no gate, no portent');
});

test('WB14b the Tithe-Imp and the captive by the day: one night in TITHE_ONE_IN has a Tithe-Imp, rising between TITHE_AFTER_MS and TITHE_AFTER_MS + TITHE_SPREAD_MS after his wake, whole seconds; the captive knight a name of the table (mutants: a Tithe-Imp every night)', () => {
  let n = 0;
  for (let d = 0; d < 2000; d++) {
    const t = gateTitheOf(d);
    if (t == null) continue;
    n++;
    assert.ok(t >= TITHE_AFTER_MS && t < TITHE_AFTER_MS + TITHE_SPREAD_MS && t % 1000 === 0, `${t}`);
    assert.ok(CAPTIVE_NAMES.map((n) => n()).includes(captiveNameOf(d)));
  }
  assert.ok(Math.abs(n / 2000 - 1 / TITHE_ONE_IN) < 0.04, `${n} of 2000`);
  assert.equal(gateTitheOf(-1), null);
});

// ═══ THE PLAN ════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14b the floors: the three courts first, then the Muster and the Bridgehead south of the first and the Pen east of it, all of COURT_R, never meeting; every walkway joins two of them, a walkway\'s length of fire between their rims (the Rift Way the long one past the second court\'s rim); every floor and walkway inside the wire\'s bound and out of the great tower\'s window; the Vanguard\'s walkway meets the first court clear of its bridge (mutants: a platform moved onto a court)', () => {
  assert.equal(COURTS.length, 6); assert.equal(COURTS_HIS, 3);
  assert.deepEqual(FLOOR, { first: 0, second: 1, third: 2, muster: 3, bridgehead: 4, pen: 5 });
  for (let a = 0; a < COURTS.length; a++) for (let b = a + 1; b < COURTS.length; b++) assert.ok(Math.hypot(COURTS[a][0] - COURTS[b][0], COURTS[a][1] - COURTS[b][1]) > 2 * COURT_R + 10, `floors ${a} and ${b}`);
  assert.ok(COURTS[FLOOR.muster][1] > COURT_R && COURTS[FLOOR.bridgehead][1] > COURTS[FLOOR.muster][1], 'the Vanguard south, the Bridgehead the further');
  assert.ok(COURTS[FLOOR.pen][0] > 2 * COURT_R, 'the Pen east');
  assert.deepEqual(WALK_ENDS.map((e) => [...e]), [[0, 1], [1, 2], [0, 2], [4, 3], [3, 0], [0, 5]]);
  assert.deepEqual(WALKWAY, { second: 0, third: 1, rift: 2, muster: 3, warden: 4, pen: 5 });
  assert.equal(GATE_WALKS_MAX, WALKS.length); assert.equal(GATE_FLOORS_MAX, COURTS.length);
  for (const w of WALKS) {
    assert.deepEqual(w, walkwayOf(w.k));
    const gap = Math.hypot(COURTS[w.b][0] - COURTS[w.a][0], COURTS[w.b][1] - COURTS[w.a][1]) - 2 * COURT_R;
    if (w.k === WALKWAY.rift) assert.ok(gap > 60 && gap < 80, `the Rift Way's fire ${gap.toFixed(1)} m`);
    else assert.ok(gap >= 18 && gap <= 30, `walkway ${w.k}'s fire ${gap.toFixed(1)} m`);
  }
  // the Rift Way passes the second court well clear of its rim
  const r = WALKS[WALKWAY.rift], c = COURTS[FLOOR.second];
  const t = (c[0] - r.ax) * r.ux + (c[1] - r.az) * r.uz, side = Math.abs((c[0] - r.ax) * r.uz - (c[1] - r.az) * r.ux);
  assert.ok(t > 0 && t < r.len && side - COURT_R - WALK_HALF_W > 12, `the second court's rim ${(side - COURT_R).toFixed(1)} m off it`);
  // the wire's bound holds every floor's far rim and the arrival
  for (const [x, z] of COURTS) assert.ok(Math.hypot(x, z) + COURT_R <= GATE_COURT_BOUND - 6, `a floor's far rim at ${(Math.hypot(x, z) + COURT_R).toFixed(1)}`);
  const az = (x, z) => Math.atan2(x, -z), off = (a) => Math.abs(Math.atan2(Math.sin(a - SIGIL_TOWER.az), Math.cos(a - SIGIL_TOWER.az)));
  for (let k = COURTS_HIS; k < COURTS.length; k++) assert.ok(off(az(...COURTS[k])) > TOWER_WINDOW + 0.1, `floor ${k} out of the great tower's window`);
  assert.ok(off(az(r.ux, r.uz)) > TOWER_WINDOW + 0.1, 'the Rift Way out of it');
  // walkway 4 meets the first court beside its bridge (+z), never over it
  const into = Math.atan2(-WALKS[WALKWAY.warden].uz, -WALKS[WALKWAY.warden].ux);
  assert.ok(Math.abs(Math.atan2(Math.sin(into - Math.PI / 2), Math.cos(into - Math.PI / 2))) > 0.45, 'clear of the bridge');
});

test('WB14b the plan: a plain night is WB9b\'s three courts and two walkways from the first court; the Vanguard adds its platforms and walkways and arrives on the Bridgehead; the Sundering trades the walkway to the third for the Rift Way and fights its last phase in the first court; the Captive adds the Pen; the Dire Breach is the Vanguard and the Sundering; one plan a set, made once (mutants: the Rift Way on a plain night; the Vanguard arriving in the first court)', () => {
  assert.deepEqual({ ...PLAN_PLAIN, floors: [...PLAN_PLAIN.floors], walks: [...PLAN_PLAIN.walks] }, { key: '', pt: null, root: 0, floors: [0, 1, 2], walks: [0, 1] });
  const v = nightPlan(['vanguard']), s = nightPlan(['sunder']), c = nightPlan(['captive']), d = nightPlan(['vanguard', 'sunder']);
  assert.deepEqual([v.root, [...v.floors], [...v.walks]], [FLOOR.bridgehead, [0, 1, 2, 3, 4], [0, 1, 3, 4]]);
  assert.deepEqual([s.root, [...s.floors], [...s.walks]], [FLOOR.first, [0, 1, 2], [0, 2]]);
  assert.deepEqual([c.root, [...c.floors], [...c.walks]], [FLOOR.first, [0, 1, 2, 5], [0, 1, 5]]);
  assert.deepEqual([d.root, [...d.floors], [...d.walks]], [FLOOR.bridgehead, [0, 1, 2, 3, 4], [0, 2, 3, 4]]);
  assert.equal(nightPlan(['vanguard']), v, 'made once');
  assert.equal(nightPlan(['nope']), PLAN_PLAIN, 'a word nobody knows: a plain night');
  assert.equal(planOf({ pt: ['captive'] }), c); assert.equal(planOf(null), PLAN_PLAIN);
  assert.equal(finalCourt({ pt: null }), FLOOR.third); assert.equal(finalCourt({ pt: ['vanguard', 'sunder'] }), FLOOR.first);
});

test('WB14b the floor law, generalised: the plan\'s root always; each of its walkways as far as it is laid from a floor that is floor; each floor such a walkway reaches laid whole; a portent\'s floor never on a night without it, whatever is laid; the clamp holds a body to the same floor (mutants: a floor open before its walkway is whole; a walkway from a floor not yet reached)', () => {
  const V = nightPlan(['vanguard']);
  assert.deepEqual(liveFloors(V, [], T0), [FLOOR.bridgehead]);
  assert.ok(onFloor(...at(FLOOR.bridgehead, 3, 4), [], T0, 0, V) && !onFloor(...at(0), [], T0, 0, V), 'the Bridgehead, and not the first court');
  assert.ok(!onFloor(...at(FLOOR.bridgehead), [], T0) && onFloor(0, 0, [], T0), 'a plain night\'s root is the first court');
  const xa = [];
  xa[WALKWAY.muster] = T0;
  assert.deepEqual(liveFloors(V, xa, T0 + WHOLE - 1), [FLOOR.bridgehead], 'the Muster waits for the whole walkway');
  assert.deepEqual(liveFloors(V, xa, T0 + WHOLE), [FLOOR.bridgehead, FLOOR.muster]);
  const w = WALKS[WALKWAY.muster], mid = [w.ax + w.ux * w.len * 0.25, w.az + w.uz * w.len * 0.25];
  assert.ok(onFloor(...mid, xa, T0 + WALK_LEAD_MS + WALK_FORM_MS / 2, 0, V) && !onFloor(...mid, xa, T0 + WALK_LEAD_MS, 0, V), 'laid as far as it is');
  // walkway 4 laid before walkway 3 is whole: not floor - its start is not reached
  const early = [];
  early[WALKWAY.warden] = T0 - 99_999;
  const w4 = WALKS[WALKWAY.warden], on4 = [w4.ax + w4.ux * 5, w4.az + w4.uz * 5];
  assert.ok(!onFloor(...on4, early, T0, 0, V), 'a walkway from a floor not yet reached');
  early[WALKWAY.muster] = T0 - 99_999;
  assert.ok(onFloor(...on4, early, T0, 0, V) && onFloor(0, 0, early, T0, 0, V), 'both whole: the first court reached');
  assert.deepEqual(liveFloors(V, early, T0).sort(), [0, 3, 4], 'and no further than the walkways laid');
  // a plain night stands no portent's floor even with its walkway's word
  assert.ok(!onFloor(...at(FLOOR.pen), [T0 - 99_999, null, null, null, null, T0 - 99_999], T0), 'the Pen is the Captive\'s night\'s');
  assert.ok(onFloor(...at(FLOOR.pen), [T0 - 99_999, null, null, null, null, T0 - 99_999], T0, 0, nightPlan(['captive'])));
  // the Sundering: the Rift Way to the third court, never the walkway from the second
  const S = nightPlan(['sunder']), rift = [];
  rift[WALKWAY.rift] = T0 - 99_999;
  assert.ok(onFloor(...at(FLOOR.third), rift, T0, 0, S) && !onFloor(...at(FLOOR.third), rift, T0), 'the third by the Rift Way');
  assert.ok(!onFloor(...at(FLOOR.third), [T0 - 99_999, T0 - 99_999], T0, 0, S), 'and never by walkway 1');
  // the clamp: back onto the Bridgehead from the fire beside it
  const off = at(FLOOR.bridgehead, COURT_R + 4, 0), to = clampToFloor(...off, [], T0, 0.4, V);
  assert.ok(Math.abs(Math.hypot(to[0] - COURTS[FLOOR.bridgehead][0], to[1] - COURTS[FLOOR.bridgehead][1]) - (COURT_R - 0.4)) < 1e-9);
  assert.equal(clampToFloor(...at(FLOOR.bridgehead, 2, 2), [], T0, 0, V), null);
  assert.ok(clampToFloor(0, 0, [], T0, 0, V), 'the first court, before the Vanguard is broken, is the fire');
});

test('WB14b the fight keeps its portents: newFight holds a valid set (a copy) and nothing else; the state says them (none, a plain night) and the crossings by walkway, a hole null and none after the last; the wire takes both; the relay\'s door judges a heal from the night\'s floor (mutants: the portents dropped from the state; the crossings filtered into each other\'s places)', () => {
  const f = newFight(7, T0, T0 + 3_600_000, 'ruhn', null, ['sunder', 'vanguard']);
  assert.deepEqual(f.pt, ['vanguard', 'sunder']);
  assert.equal(newFight(7, T0, T0 + 3_600_000, 'ruhn').pt, null);
  assert.equal(newFight(7, T0, T0 + 3_600_000, 'ruhn', null, ['vanguard', 'captive']).pt, null, 'a set the wire would refuse is none');
  const st = stateOf(f);
  assert.deepEqual(st.pt, ['vanguard', 'sunder']);
  assert.equal('pt' in stateOf(newFight(7, T0, T0 + 3_600_000, 'ruhn')), false, 'a plain night says none');
  assert.deepEqual(validGateOut(JSON.parse(JSON.stringify(st))).pt, ['vanguard', 'sunder']);
  assert.equal(validGateOut({ ...st, pt: ['nope'] }), null);
  assert.deepEqual(xaWire([T0, undefined, T0 + 5]), [T0, null, T0 + 5]);
  assert.deepEqual(xaWire([T0, null, null]), [T0]);
  assert.deepEqual(xaWire(null), []);
  f.xa = []; f.xa[WALKWAY.muster] = T0;
  assert.deepEqual(stateOf(f).xa, [null, null, null, T0]);
  assert.deepEqual(validGateOut(JSON.parse(JSON.stringify(stateOf(f)))).xa, [null, null, null, T0]);
  const s = foldGate(GATE_STATE_EMPTY, validGateOut(JSON.parse(JSON.stringify(stateOf(f)))), T0);
  assert.deepEqual(s.pt, ['vanguard', 'sunder']); assert.equal(planOf(s), nightPlan(['vanguard', 'sunder']));
  // a heal said from the Bridgehead: believed on the Vanguard's night, not on a plain one
  for (const [pt, ok] of [[['vanguard'], true], [null, false]]) {
    const g = newFight(7, T0, T0 + 3_600_000, 'ruhn', null, pt);
    joinFight(g, 'a', 'A', 10, T0, true); joinFight(g, 'b', 'B', 10, T0, true);
    const got = applyHeal(g, 'a', 'b', 30, { x: COURTS[FLOOR.bridgehead][0], z: COURTS[FLOOR.bridgehead][1] }, T0 + 1000);
    assert.equal(got > 0, ok, JSON.stringify(pt));
  }
  // the relay births the fight on the night's draw
  assert.match(read('server/src/index.js'), /md: gateModsOf\(day\), pt: gatePortentsOf\(day\), ti: gateTitheOf\(day\) \}\);/);
  assert.match(read('src/net/bossSeam.js'), /new: \(\{ day, now, wrathAt, boss, md = null, pt = null, ti = null \}\) => newFight\(day, now, wrathAt, boss, md, pt, ti\),/);
});

test('WB14b a bound lays its walkway on every screen: over a walkway of the night\'s own past WB9b\'s two (the Flame\'s Rift Way) it lays that one alone; WB9b\'s bounds lay theirs as they did (mutants: the Rift Way laid as walkways 0 and 1)', () => {
  const s = { ...GATE_STATE_EMPTY, day: 1, pt: ['sunder'], xa: [T0] };
  const word = { k: 'atk', i: 9, a: ATTACKS.cross.id, at: T0 + 20_000, x: 0, z: 0, yw: 0, tg: [[...COURTS[FLOOR.third]]] };
  const laid = crossLaid(s, word).xa;
  assert.equal(laid[WALKWAY.rift], T0 + 20_000 - ATTACKS.cross.windup);
  assert.equal(laid[WALKWAY.third], undefined, 'never walkway 1');
  assert.equal(laid[WALKWAY.second], T0, 'the second\'s as it was');
  assert.deepEqual(crossLaid({ ...s, xa: laid }, word), {}, 'never twice');
  assert.deepEqual(crossLaid({ ...GATE_STATE_EMPTY, day: 1, xa: [] }, word).xa, [T0 + 20_000 - ATTACKS.cross.windup, T0 + 20_000 - ATTACKS.cross.windup], 'a plain night\'s (an old checkpoint\'s) bound to the third lays both');
});

// ═══ THE SCREEN ══════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14b the night\'s court on the screen: its plan by its day (the relay\'s draw, the same law); its fighters arrive on its root floor and its way in burns there; the model, the collider, the slabs and the braziers are the plan\'s - a plain night\'s WB9b\'s - and a portent\'s platform keeps no rune ring; the motor holds a body to the night\'s floor (mutants: the platforms on every night; the arrival in the first court on the Vanguard\'s)', () => {
  const vd = dayOf('vanguard'), pd = dayOf(null), cd = dayOf('captive');
  assert.equal(planOfDay(vd), nightPlan(['vanguard'])); assert.equal(planOfDay(pd), PLAN_PLAIN); assert.equal(planOfDay(null), PLAN_PLAIN);
  assert.deepEqual(arrivalOf(PLAN_PLAIN), { at: [0, ARRIVE_Z], wayIn: [0, WAY_IN_Z] });
  const va = arrivalOf(planOfDay(vd));
  assert.deepEqual(va.at, [COURTS[FLOOR.bridgehead][0], COURTS[FLOOR.bridgehead][1] + ARRIVE_Z]);
  assert.ok(Math.hypot(va.wayIn[0], va.wayIn[1]) < GATE_COURT_BOUND, 'its way in inside the wire\'s bound');
  const marker = gateArenaBlock(vd).rdbBlock.objectRootList[0].rdbObjects[0];
  const [mx, , mz] = courtToDungeon(...[va.at[0], 0, va.at[1]]);
  assert.deepEqual([marker.xPos, marker.zPos], [Math.round(mx * 40), Math.round(mz * 40)], 'the start marker on the Bridgehead');
  // the model: a plain night's three floors, the Vanguard's five, runes on his courts alone
  const flags = (m) => { const P = m.positions, out = new Set(); for (const sm of m.subMeshes) if (sm.textureArchive === COURT_ARCHIVE && sm.textureRecord === COURT_RUNE_RECORD) for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i++) { const x = P[i * 3] - COURT_CENTRE[0], z = P[i * 3 + 2] - COURT_CENTRE[2]; let k = 0, bd = Infinity; COURTS.forEach(([cx, cz], j) => { const dd = Math.hypot(x - cx, z - cz); if (dd < bd) { bd = dd; k = j; } }); out.add(k); } return [...out].sort(); };
  assert.deepEqual(flags(buildCourtModel()), [0, 1, 2]);
  assert.deepEqual(flags(buildCourtModel(['vanguard'])), [0, 1, 2], 'no rune ring on a platform he never stands on');
  assert.ok(buildCourtModel(['vanguard']).positions.length > buildCourtModel().positions.length, 'and the platforms stand');
  const area = (tris) => { let a = 0; for (let i = 0; i < tris.length; i += 9) a += Math.abs((tris[i + 3] - tris[i]) * (tris[i + 8] - tris[i + 2]) - (tris[i + 5] - tris[i + 2]) * (tris[i + 6] - tris[i])) / 2; return a; };
  const disc = Math.PI * COURT_R * COURT_R, deck = (k) => WALKS[k].len * 2 * WALK_HALF_W;
  assert.ok(Math.abs(area(courtFloorTris(['captive'])) - (4 * disc + deck(0) + deck(1) + deck(5))) / (4 * disc) < 0.01, 'the Captive\'s collider: four floors, three decks');
  assert.deepEqual([...new Set(walkSlabs(['sunder']).map((sl) => sl.walk))], [WALKWAY.second, WALKWAY.rift]);
  assert.equal(walkSlabs(['sunder']), walkSlabs(['sunder']), 'made once a plan');
  assert.ok(courtLights(nightPlan(['vanguard'])).length > courtLights().length, 'the platforms\' braziers');
  assert.equal(courtOpenings(FLOOR.pen, nightPlan(['captive'])).length, 1, 'the Pen opens on its walkway');
  // the motor's arena: the night's floor
  const a = courtArena([], T0, vd);
  assert.equal(a.clamp(courtToDungeon(...[COURTS[FLOOR.bridgehead][0] + 2, 0, COURTS[FLOOR.bridgehead][1]]), 0.4), null, 'on the Bridgehead');
  assert.ok(a.clamp(courtToDungeon(0, 0, 0), 0.4), 'the first court is fire until the Vanguard is broken');
  a.day = pd;
  assert.equal(a.clamp(courtToDungeon(0, 0, 0), 0.4), null, 'a plain night\'s');
  a.day = cd;
  assert.ok(a.clamp(courtToDungeon(...[COURTS[FLOOR.pen][0], 0, COURTS[FLOOR.pen][1]]), 0.4), 'the Pen is fire until its walkway is laid');   // AUDIT WB14 (RECORD nit): `cd` read, not a filler
});

test('WB14b the telegraph over the night\'s floors: a shape over the whole arena (the Wrath, the Reckoning) is drawn over the plan\'s floors alone - a portent\'s platform has no ground on another night; a plain call draws WB9b\'s three (mutants: the whole arena over every floor of the table)', () => {
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 4 }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }) });
  const pass = new GateTelegraphRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const wrath = telegraphShape({ i: 1, a: ATTACKS.wrath.id, at: T0 + 6000, x: 0, z: 0, yw: 0, tg: [] }, 1, T0 + 3000);
  pass.draw(wrath, I, I, [0, 0, 0], 1);
  assert.equal(pass.drawn, 3, 'a plain call: his three courts');
  pass.draw(wrath, I, I, [0, 0, 0], 1, null, undefined, null, { courts: COURTS, r: COURT_R, ks: nightPlan(['vanguard']).floors });
  assert.equal(pass.drawn, 5, 'the Vanguard\'s night: its five floors');
  pass.draw(wrath, I, I, [0, 0, 0], 1, null, undefined, null, { courts: [[0, 0]], r: 10 });
  assert.equal(pass.drawn, 1, 'another floor\'s own courts (the Hour\'s, the Spire\'s): all of them');
  assert.match(read('src/scenes/gate/gateCourt.js'), /_floors\.ks = planOf\(s\)\.floors;/);
});

test('WB14b the Deadlands keep clear of every floor of every night: no island within LAND_CLEAR_M of a portent\'s platform or walkway either, so the land is one land whatever the night (mutants: the land keeping clear of his three alone)', () => {
  for (const isl of deadlandsIslands()) assert.ok(floorGap(isl.x, isl.z) >= isl.r * 1.35 + LAND_CLEAR_M);
  for (let k = COURTS_HIS; k < COURTS.length; k++) assert.ok(floorGap(...at(k)) < 0, `floor ${k} counted`);
  const r = WALKS[WALKWAY.rift];
  assert.ok(floorGap(r.ax + r.ux * r.len / 2, r.az + r.uz * r.len / 2) < 0, 'the Rift Way counted');
});

// ═══ THE WORDS ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('WB14b the night\'s portents said before the gate, everywhere his marks are: the chat\'s line after his marks (the Dire Breach\'s own first), the map\'s card a line of their names, the marks card a row each after his trials, the Discord omen post after the marks; none of it on a plain night (mutants: the portents unsaid in the chat; the card\'s row missing; the post without them)', () => {
  const plain = dayOf(null, 600), van = dayOf('vanguard', 600), dire = dayOf('vanguard+sunder', 600);
  const SITE = { place: 'Copperham, Wrothgarian Mountains', near: 'Copperham', px: 400, py: 200, spot: [409.6, 409.6], ring: { cx: 400.3, cy: 200.6, r: 2 } };
  const chat = (day) => { const said = []; const o = createGateOmen({ now: () => gateTimes(day).openAt + 1000, site: () => SITE, say: (s) => said.push(s), localTime: (m) => `L${m}` }); o.frame(); return said; };
  const boss = gateBossOf(van).name;
  assert.deepEqual(chat(van).slice(-2), [marksLine({ boss, md: gateModsOf(van) }), 'His vanguard holds the approach.'], 'after the marks, the chat\'s own line');
  assert.deepEqual(chat(dire).at(-1), `${gateDireLine()} His vanguard holds the approach. He tears in two at the second phase.`, 'the Dire Breach: its line, then each of its two');
  assert.deepEqual(chat(plain).at(-1), marksLine({ boss, md: gateModsOf(plain) }), 'a plain night: the marks, and nothing after them');
  const tip = (day) => gateTip({ site: SITE, phase: 'open', t: { day } }, { to: 'seal', ms: 60_000 }).lines;
  assert.equal(tip(van).at(-1), 'The Vanguard');
  assert.equal(tip(dire).at(-1), 'The Vanguard · The Sundering');   // PIN MOVED (AUDIT WB14 TEXT-16)
  assert.equal(tip(plain).length, tip(van).length - 1, 'a plain night: no line for them');
  const card = marksCardModel(gateModsOf(dire), { name: boss }, { mode: 'gate', pt: gatePortentsOf(dire) });
  assert.deepEqual(card.portents.map((p) => [p.kind, p.id, p.name, p.text]), [['portent', 'vanguard', 'The Vanguard', GATE_PORTENTS[0].line], ['portent', 'sunder', 'The Sundering', GATE_PORTENTS[1].line]]);
  assert.ok(card.key.endsWith('|vanguard,sunder'), 'a card of its own: the marks the same, the portents not');
  assert.deepEqual(marksCardModel(gateModsOf(plain), { name: boss }, { mode: 'gate', pt: null }).portents, []);
  assert.ok(!marksCardModel(gateModsOf(plain), { name: boss }, { mode: 'gate' }).key.includes('|'), 'a plain card\'s key is WB8b\'s');
  // the card's node: a row more for each portent, made the first night that has one, in Dagon's crimson; hidden on a plain night
  const made = [];
  const node = (tag) => { const n = { tag, style: {}, className: '', textContent: '', innerHTML: '', children: [], append(...c) { this.children.push(...c); }, remove() {} }; made.push(n); return n; };
  const doc = { createElement: node, body: node('body'), head: { append() {} }, getElementById: () => null };
  destroyGateMarksCard();
  drawGateMarksCard(marksCardModel(gateModsOf(plain), { name: boss }, { mode: 'gate' }), { doc });
  const root = doc.body.children[0], shown = () => root.children.slice(2).filter((r) => r.style.display !== 'none').map((r) => r.children[1].children[0].textContent);
  assert.equal(root.children.length, 5, 'a plain card: his aspect and two trials, as WB9a made it');
  drawGateMarksCard(card, { doc });
  assert.equal(root.children.length, 7);
  assert.deepEqual(shown().slice(-2), ['The Vanguard', 'The Sundering']);
  assert.deepEqual(root.children.slice(-2).map((r) => r.children[0].style.color), [PORTENT_CSS, PORTENT_CSS]);
  drawGateMarksCard(marksCardModel(gateModsOf(plain), { name: boss }, { mode: 'gate' }), { doc });
  assert.equal(shown().length, 3, 'the portents\' rows hidden on a plain night, never removed');
  destroyGateMarksCard();
  const post = (day) => omenPost({ day, place: 'Copperham' }).content;
  assert.ok(post(van).endsWith(' tonight, ' + gateModsOf(van).slice(1).map((id) => GATE_TRIALS.find((t) => t.id === id).name).join(' and ') + '. His vanguard holds the approach.'), post(van));
  assert.ok(post(dire).endsWith(`. ${gateDireLine()} His vanguard holds the approach. He tears in two at the second phase.`), post(dire));
  assert.ok(post(plain).endsWith('tonight, ' + gateModsOf(plain).slice(1).map((id) => GATE_TRIALS.find((t) => t.id === id).name).join(' and ') + '.'), post(plain));
  assert.ok(post(dire).length < 2000, 'a Discord message\'s bound');
  // the screens ask the day's own: the court's card its fight's, the gate's its day's
  assert.match(read('src/scenes/gate/gateCourt.js'), /marksCardModel\(s\.md, bossOf\(s\), \{ mode: 'arrive', since: marksAt, now: t, pt: s\.pt \}\)/);
  assert.match(read('src/scenes/gate/gatePool.js'), /marksCardModel\(gateModsOf\(g\.day\), gateBossOf\(g\.day\), \{ mode: 'gate', pt: gatePortentsOf\(g\.day\) \}\)/);
});

test('WB14b a new night\'s fight is judged anew: the court\'s reset clears what it judged, heard and landed before it lays the night\'s arrival - a Slam numbered as the last night\'s lands again (mutants: the resets lost behind the arrival)', async () => {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 }, struck = [], me = { health: 1000, maxHealth: 1000 };
  const renderer = { textures: new Set(), createBillboardBatch: (archive, record, size) => ({ archive, record, size, bounds: new Float32Array(4) }), destroyBillboardBatch: () => {} };
  const c = createGateCourt({ renderer, gl: null, getTexture: async () => null, link, now: () => clock.t, feet: () => courtToDungeon(1, 0, 1), player: () => me, strike: (dmg) => { struck.push(dmg); } });
  const night = (day, at) => ({ ...GATE_STATE_EMPTY, day, boss: 'ruhn', hp: 900, max: 1000, fighters: 1, wrathAt: 1e12, atk: { i: 5, a: ATTACKS.slam.id, at, x: 0, z: 0, yw: 0, tg: [] } });
  const a = dayOf(null, 600), b = dayOf(null, a + 1);
  for (const [day, at] of [[a, 10_000], [b, 20_000]]) {
    link.st = night(day, at);
    clock.t = at - 1000; c.frame(); await new Promise((r) => setImmediate(r));
    clock.t = at + 5; c.frame(); await new Promise((r) => setImmediate(r));
  }
  assert.equal(struck.length, 2, 'each night\'s Slam on me, though both are its fight\'s fifth');
  c.leave();
  assert.match(read('src/scenes/gate/gateCourt.js'), /day = d; judged = noMark\(\); cued = noMark\(\); landed = noMark\(\); phaseHeard = 0; fellCued = false; wrathLanded = false;\n\s+arriveAt\(d\);/);
});
