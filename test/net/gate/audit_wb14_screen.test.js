// AUDIT WB14 (2026-10-20, Mac: "Please audit this and ensure perfection"): THE SCREEN'S HALF OF THE PORTENTS ARC, pinned -
// each finding of the six cold lanes a client owns, reproduced as its lane found it and held fixed
// (bible/01-Overview/audits/Audit-Breach-Portents.md).
//
//   the court        scenes/gate/gateCourt.js hostTargets (SCREEN-1), judge's first frame (SCREEN-2), perilAt's Wheel
//                    (SCREEN-7); scenes/gate/gateHost.js hostShapes nearest first (SCREEN-3); scenes/gate/gateCaptive.js
//                    reset and its chains' slots (SCREEN-4, SCREEN-10); scenes/gate/gateArsenal.js a watcher, an attack's
//                    number and moment (SCREEN-5, SCREEN-9)
//   the strike law   net/gate/gateStrike.js wheelStrikes, wheelSlack (SCREEN-6 - the relay's judge's too)
//   the floor        world/gate/gateArena.js courtOpenings (SCREEN-11); render/gate/gateTelegraph.js the wedges' fill (SCREEN-13)
//   the looks        world/gate/gateBoss.js LAND_SHAKE (SCREEN-12); ui/gate/gateGroundView.js the Gaze's white (SCREEN-14)
//   the words        the profile's names and the card's rows read live (TEXT-8), the phase card's (TEXT-9), the bar before
//                    a wave (TEXT-15)
//   the door         net/wire.js relaySupportsPortents, net/online.js portentsOk, scenes/world.js gateRefusal, and the relay
//                    letting go a fight from before the portents (WIRE-1 / SCREEN-8)
//
// Design: bible/11-Multiplayer/Breach-Portents.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newFight, joinFight, stepBrain, stateOf, fightProfile, ATTACKS, COURTS, COURT_R, FLOOR, HOST, HOST_BLOWS, BRAIN_TICK_MS, PHASE_AT, OPENING_MS, PHASE_NAMES,
  BASE_PROFILE, PLAN_PLAIN, nightPlan,
} from '../../../src/net/gate/gateBrain.js';
import { wheelStrikes, wheelSlack, inAttack } from '../../../src/net/gate/gateStrike.js';
import { validGateOut, RELAY_VERSION, GATE_PORTENTS_RELAY_MIN, relaySupportsPortents } from '../../../src/net/wire.js';
import { foldGate, GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import { createGateCourt, perilAt, courtPhaseCard, WHEEL_PERIL_MS } from '../../../src/scenes/gate/gateCourt.js';
import { hostShapes, HOST_SHAPES_MAX } from '../../../src/scenes/gate/gateHost.js';
import { createGateCaptive, captiveChains } from '../../../src/scenes/gate/gateCaptive.js';
import { createGateArsenal } from '../../../src/scenes/gate/gateArsenal.js';
import { courtOpenings, courtBraziers, courtToDungeon, arrivalOf } from '../../../src/world/gate/gateArena.js';
import { telegraphShape, telegraphField } from '../../../src/render/gate/gateTelegraph.js';
import { LAND_SHAKE, landShake, QUAKE_ON } from '../../../src/world/gate/gateBoss.js';
import { drawGateGround, destroyGateGround, groundViewModel } from '../../../src/ui/gate/gateGroundView.js';
import { bossBarModel } from '../../../src/ui/gate/gateBossBar.js';
import { portentRowsOf } from '../../../src/ui/gate/gateMarksView.js';
import { setLocale, patchLocaleTable, clearLocaleTables } from '../../../src/systems/textManager.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000, WRATH = T0 + 3_600_000;
const seeded = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const BOSS = { id: 'ruhn', name: 'Valkynaz Ruhn', title: 'Warden of the Burning Court' };
const ME = { health: 100, maxHealth: 100, level: 10 };

test('AUDIT WB14 SCREEN-1 sundered, a Tithe-Imp that rises in the Blade\'s court is offered to my blows there, beside his Flame wherever it is mine (mutants: the Flame alone offered sundered)', () => {
  const f = newFight(7, T0, WRATH, 'ruhn', null, ['sunder'], 0), rng = seeded(5), where = {};
  for (let i = 0; i < 4; i++) { joinFight(f, `s${i}`, `F${i}`, 10, T0, true); where[`s${i}`] = [3 + i, 3]; }
  const bodies = () => Object.entries(where).map(([sub, p]) => ({ sub, id: `peer-${sub}`, x: p[0], z: p[1], dead: false }));
  let t = T0;
  const step = () => { stepBrain(f, t, bodies(), rng); t += BRAIN_TICK_MS; };
  f.ti = null;   // the Imp held back until he is torn
  while (f.hp / f.max > PHASE_AT[0] + 0.005) { f.hp -= f.max * 0.01; step(); }
  for (let k = 0; k < 80 && !f.sd; k++) { f.hp = Math.min(f.hp, f.max * 0.659); step(); }
  assert.ok(f.sd?.two);
  const C1 = COURTS[FLOOR.second], C2 = COURTS[FLOOR.third];
  where.s0 = [C1[0] + 2, C1[1]]; where.s1 = [C1[0] + 5, C1[1]]; where.s2 = [C2[0] + 2, C2[1]]; where.s3 = [C2[0] + 5, C2[1]];
  for (let k = 0; k < 200 && (f.atk || f.court !== FLOOR.second); k++) step();
  f.ti = 0;
  for (let k = 0; k < 40 && !f.lg?.ads.some((a) => a.k === HOST.tithe); k++) step();
  const imp = f.lg.ads.find((a) => a.k === HOST.tithe);
  assert.ok(imp, 'risen, sundered');
  const s = foldGate(GATE_STATE_EMPTY, validGateOut(JSON.parse(JSON.stringify({ t: 'gate', ...stateOf(f) }))), t);
  assert.ok(s.sd && s.lg?.ads.length);
  const c = createGateCourt({ link: { state: () => s, watching: () => false }, now: () => t, feet: () => courtToDungeon(imp.x + 1, 0, imp.z), player: () => ME });
  c.frame();
  assert.ok(c.hostTargets().some((T) => T.i === imp.i), 'the Imp offered in the Blade\'s court');
});

test('AUDIT WB14 SCREEN-2 my first frame in the court judges where I stand now - a Wheel\'s blade that swept the spot before I stood there strikes nothing (mutants: the sweep judged from its landing)', () => {
  const at = 40_000, s = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 3, hp: 900, max: 1000, wrathAt: 1e12, x: 0, z: 0, ct: 0,
    atk: { i: 9, a: ATTACKS.wheel.id, at, x: 0, z: 0, yw: 0, tg: [] } };
  // a spot the blade passed in the turn's first second, now far behind it
  const spot = [Math.sin(0.2) * 15, Math.cos(0.2) * 15], now = at + 3000;
  assert.ok(wheelStrikes(s.atk, spot[0], spot[1], now, at, BASE_PROFILE), 'swept over it before');
  assert.ok(!wheelStrikes(s.atk, spot[0], spot[1], now, now, BASE_PROFILE), 'not now');
  const struck = [];
  const c = createGateCourt({ link: { state: () => s, watching: () => false }, now: () => now, feet: () => courtToDungeon(spot[0], 0, spot[1]), player: () => ME, strike: (d) => struck.push(d) });
  c.frame();
  assert.deepEqual(struck, [], 'my first frame: nothing');
});

test('AUDIT WB14 SCREEN-3 the host\'s ground draws the blows nearest my feet first - the Vanguard\'s twelve winding up, the one on me drawn (mutants: drawn in body order)', () => {
  const C = COURTS[FLOOR.bridgehead], P = BASE_PROFILE, B = HOST_BLOWS[HOST.brute];
  const ads = [];
  for (let k = 0; k < 12; k++) { const x = C[0] - 15 + k * 2.6, z = C[1] + 10; ads.push({ i: k + 1, k: HOST.brute, h: 40, m: 40, x, z, mv: null, rose: -Infinity, yaw: 0, atk: { at: 10_000, x, z } }); }
  const s = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 1, hp: 900, max: 1000, wrathAt: 1e12, x: 0, z: 0, shieldUntil: 0, lg: { ads, gone: [] } };
  const mine = [ads[11].atk.x, ads[11].atk.z], now = 10_000 - B.windup / 2;
  const drawn = hostShapes(s, now, P, [], mine);
  assert.equal(drawn.length, HOST_SHAPES_MAX);
  assert.ok(drawn.some((sh) => sh.origin[0] === mine[0] && sh.origin[1] === mine[1]), 'the blow on me drawn');
  assert.ok(!hostShapes(s, now, P, []).some((sh) => sh.origin[0] === mine[0]), 'body order alone left it out');
});

test('AUDIT WB14 SCREEN-4 / SCREEN-10 the Captive leaves nothing behind - no batch, light or chain handed on once I have left; and his chains are their slots, refilled (mutants: the lists kept; a new shape a frame)', () => {
  const made = [];
  const renderer = { createBillboardBatch: () => { const b = { vao: {}, dead: false }; made.push(b); return b; }, destroyBillboardBatch: (b) => { b.dead = true; b.vao = null; }, updateBillboardBatch() {} };
  const cap = createGateCaptive({ renderer, getTexture: () => ({ frames: [{ width: 40, height: 80 }] }), uploadRecordFrame: () => ({}), cam: () => [0, 0, 0] });
  const s = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 1, hp: 900, max: 1000, wrathAt: 1e12, pt: ['captive'], cp: { at: 1000, n: 1, f: 0, w: 0, s: 0 },
    lg: { ads: [{ i: 1, k: HOST.gaoler, h: 10, m: 10, x: COURTS[FLOOR.pen][0] + 7, z: COURTS[FLOOR.pen][1], mv: null, atk: null, rose: -Infinity, yaw: 0 }], gone: [] } };
  cap.frame(s, 5000);
  cap.leave();
  assert.deepEqual([cap.batches().length, cap.lights().length, cap.shapes().length], [0, 0, 0], 'nothing handed on');
  const out = [];
  captiveChains(s, 5000, out);
  const first = out[0];
  captiveChains(s, 5100, out);
  assert.equal(out[0], first, 'the same slot');
  assert.equal(out.length, 1);
});

test('AUDIT WB14 SCREEN-5 / SCREEN-9 a watcher is never blinded by the Gaze nor told to look away; an attack is its number and its moment - one numbered again by a woken room is judged (mutants: the watcher blinded; the number alone)', () => {
  const lands = [];
  let watching = true;
  const A = createGateArsenal({ me: () => 'me', placeOf: () => null, others: () => [], land: (atk) => lands.push(atk.i), watching: () => watching });
  const st = (atk) => ({ ...GATE_STATE_EMPTY, day: 7, phase: 3, atk });
  const gaze = (at, i = 17) => ({ i, a: ATTACKS.gaze.id, at, x: 0, z: 10, yw: 0, tg: [] });
  assert.equal(A.order(st(gaze(5000)), 4000, BASE_PROFILE, [0, 0], 0), null, 'no order for a watcher');
  A.judge(st(gaze(5000)), 5100, BASE_PROFILE, [0, 0], 0, true);
  assert.deepEqual([lands.length, A.blindAt()], [0, -Infinity], 'nor its blinding');
  watching = false;
  A.judge(st(gaze(9000)), 9100, BASE_PROFILE, [0, 0], 0, true);
  assert.deepEqual(lands, [17]);
  A.judge(st(gaze(30_000)), 30_100, BASE_PROFILE, [0, 0], 0, true);   // the same number, a new moment
  assert.deepEqual(lands, [17, 17], 'judged again');
  A.judge(st(gaze(30_000)), 30_200, BASE_PROFILE, [0, 0], 0, true);
  assert.equal(lands.length, 2, 'once');
  assert.match(read('src/scenes/gate/gateCourt.js'), /watching: \(\) => watching\(\),   \/\/ AUDIT WB14 \(SCREEN-5\)/);
});

test('AUDIT WB14 SCREEN-6 the Wheel strikes the blade it draws - a capsule, its round tip, no body past its roots - on the screen and in the relay\'s judge alike (mutants: the side\'s slack past the tip; his body\'s ring)', () => {
  const A = ATTACKS.wheel, half = A.width / 2;
  const inCap = (x, y) => { const t = Math.max(0, Math.min(A.len, x)); return Math.hypot(x - t, y) <= half; };
  let bad = 0;
  for (let d = 0.5; d <= A.len + half; d += 0.1) for (let a = 0; a <= 0.5; a += 0.002) if (inCap(d * Math.cos(a), d * Math.sin(a)) !== (a <= wheelSlack(d, A.len, half) + 1e-9) && Math.abs(a - wheelSlack(d, A.len, half)) > 0.003) bad++;
  assert.equal(bad, 0, 'the slack is the capsule\'s');
  const atk = { i: 1, a: A.id, at: 1000, x: 0, z: 0, yw: 0, tg: [] }, P = fightProfile(['burning', 'colossal']);
  const past = [Math.sin(0.09) * (A.len + 1.2), Math.cos(0.09) * (A.len + 1.2)];   // beside the tip, outside its round end
  assert.ok(!wheelStrikes(atk, past[0], past[1], 1001, 1000, BASE_PROFILE), 'past the drawn tip');
  assert.ok(P.bossR > half + 0.3);
  assert.ok(!wheelStrikes(atk, half + 0.3, 0, 1001, 1000, P), 'Colossal: no ring at his feet past the blades\' roots');   // (square to both blades)
  assert.ok(!inAttack(atk, half + 0.3, 0, P));
});

test('AUDIT WB14 SCREEN-7 the Wheel\'s peril stands the whole of its turn - a spot a blade sweeps over within WHEEL_PERIL_MS (mutants: the peril gone as it lands)', () => {
  const at = 10_000, atk = { i: 1, a: ATTACKS.wheel.id, at, x: 0, z: 0, yw: 0, tg: [] };
  const s = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 3, hp: 900, max: 1000, wrathAt: 1e12, atk, x: 0, z: 0 };
  for (const dt of [1000, 2500, 4000]) {
    const t = at + dt, ahead = 0.25 + (ATTACKS.wheel.spin * dt) / 1000;   // 0.25 rad ahead of the blade now
    const p = [Math.sin(ahead) * 10, Math.cos(ahead) * 10];
    assert.ok(wheelStrikes(atk, p[0], p[1], t + WHEEL_PERIL_MS, t, BASE_PROFILE) || wheelStrikes({ ...atk, yw: atk.yw + Math.PI }, p[0], p[1], t + WHEEL_PERIL_MS, t, BASE_PROFILE), 'a blade reaches it within the second');
    const pr = perilAt(s, t, BASE_PROFILE, p[0], p[1], 0);
    assert.ok(pr, `+${dt} ms: the peril said`);
  }
});

test('AUDIT WB14 SCREEN-11 the night\'s arrival keeps its clearing - the Vanguard\'s Bridgehead no brazier behind its way in (mutants: the first court\'s alone)', () => {
  const plan = nightPlan(['vanguard']);
  assert.ok(courtOpenings(FLOOR.bridgehead, plan).includes(Math.PI / 2));
  const a = arrivalOf(plan), wayIn = a.wayIn;
  for (const [, p] of courtBraziers(FLOOR.bridgehead, plan)) assert.ok(Math.hypot(p[0] - wayIn[0], p[2] - wayIn[1]) > 4, `a brazier ${Math.hypot(p[0] - wayIn[0], p[2] - wayIn[1]).toFixed(1)} m from the way in`);
  assert.ok(courtOpenings(0, PLAN_PLAIN).includes(Math.PI / 2), 'the first court\'s bridge as ever');
});

test('AUDIT WB14 SCREEN-12 / SCREEN-13 the Sundering and the Rejoining are felt as his bound is; the Unmaking\'s fill meets the rim it is seen at (mutants: shaking nothing; the fill to its reach past the floor)', () => {
  for (const k of ['sunder', 'rejoin']) {
    assert.ok(QUAKE_ON.includes(k));
    assert.ok(landShake(ATTACKS[k], 0) > 0, k);
    for (const d of [0, 10, 30]) assert.equal(landShake(ATTACKS[k], d), landShake(ATTACKS.cross, d), `${k} at ${d} m`);
    assert.ok(!(k in LAND_SHAKE), 'the bound\'s shake, not a kind of its own');
  }
  const atk = { i: 1, a: ATTACKS.unmake.id, at: 5000, x: 0, z: 0, yw: 0, tg: [[0, 0]] };
  const sh = telegraphShape(atk, 3, 4000, BASE_PROFILE);
  assert.ok(sh);
  const f = telegraphField(sh, 0, COURT_R - 0.01);
  assert.ok(Math.abs(f.s - 1) < 0.01, `${f.s.toFixed(3)} at the rim`);
  assert.match(read('src/render/gate/gateTelegraph.js'), /s = d \/ min\(uR, rimDist\(uOrigin, rel \/ max\(d, 1e-4\), uCourt, uFloorR\)\);   \/\/ AUDIT WB14 \(SCREEN-13\)/, 'and in the shader');
});

test('AUDIT WB14 SCREEN-14 the Gaze\'s white washes the screen through the HUD\'s hide - the rim and the warning hidden with it (mutants: the white hidden with the HUD)', () => {
  const nodes = [];
  const el = () => { const n = { style: {}, className: '', remove() {}, append() {} }; nodes.push(n); return n; };
  const doc = { createElement: el, getElementById: () => ({}), body: { append() {} }, head: null };
  destroyGateGround();
  const m = groundViewModel({ now: 1000, blindAt: 900 });
  assert.ok(m.blind > 0);
  drawGateGround(m, { hidden: true, doc });
  const blind = nodes.find((n) => n.className === 'wb-ground-blind');
  assert.ok(blind && Number(blind.style.opacity) > 0, 'white');
  assert.equal(nodes.find((n) => n.className === 'wb-ground-warn').style.display, 'none');
  drawGateGround(null, { doc });
  assert.equal(Number(blind.style.opacity), 0, 'gone with the model');
  destroyGateGround();
});

test('AUDIT WB14 TEXT-8 / TEXT-9 / TEXT-15 the words read in the player\'s language as they are said - the profile\'s attack names, the card\'s portent rows, the phase card - and the bar counts no wave before one has risen (mutants: the names frozen in the first language; the phase\'s name in English beside its order; "wave 1 of 3" before any)', () => {
  const P = fightProfile(['burning']), rows = portentRowsOf(['vanguard']);
  assert.equal(P.atk.chains.name, 'Chains of the Warden');
  try {
    patchLocaleTable('xx', 'Port_Strings', [['gate.attack.chains', 'Ketten'], ['gate.portent.vanguard.name', 'Vorhut'], ['gate.phase.court', 'Der Hof'], ['gate.phase.follow2', 'Folge ihm.']]);
    setLocale('xx');
    assert.equal(P.atk.chains.name, 'Ketten', 'the same profile, the new language');
    assert.equal(rows[0].name, 'Vorhut', 'the same row');
    assert.deepEqual([PHASE_NAMES[1], courtPhaseCard(2).main, courtPhaseCard(2).sub], ['Der Hof', 'Der Hof', 'Folge ihm.']);
  } finally { setLocale('en'); clearLocaleTables('xx'); }
  const s = { ...GATE_STATE_EMPTY, day: 7, boss: 'ruhn', phase: 1, hp: 900, max: 1000, wrathAt: 1e12, x: 0, z: 0, vg: [0, 0], pt: ['vanguard'] };
  assert.equal(bossBarModel(s, T0, BOSS).host, 'The Vanguard - Bridgehead', 'no wave counted yet');
  assert.equal(bossBarModel({ ...s, vg: [1, 0] }, T0, BOSS).host, 'The Vanguard - Muster');
  assert.equal(bossBarModel({ ...s, vg: [0, 2] }, T0, BOSS).host, 'The Vanguard - Bridgehead, wave 2 of 3');
});

test('AUDIT WB14 WIRE-1 / SCREEN-8 a portent night\'s door refuses a relay from before the portents (its fight is fought plain - on floors the screen does not build); a new relay lets go unfallen a fight from before them it wakes on a portent night (mutants: the door open on an old relay; the old fight kept)', () => {
  // the relay version that says WB14b is the portents' relay
  const w = read('src/net/wire.js');
  const line = w.split('\n').find((l) => /RELAY_VERSION = 'world\d+';   \/\/ WB14b/.test(l)) ?? w.split('\n').find((l) => /^\/\/ world\d+: WB14b/.test(l));
  assert.ok(line, 'WB14b\'s version line');
  assert.equal(Number(/world(\d+)/.exec(line)[1]), GATE_PORTENTS_RELAY_MIN, 'GATE_PORTENTS_RELAY_MIN is the version that drew them first');
  assert.ok(relaySupportsPortents(RELAY_VERSION));
  assert.ok(!relaySupportsPortents(`world${GATE_PORTENTS_RELAY_MIN - 1}`));
  assert.ok(!relaySupportsPortents(null));
  const o = read('src/net/online.js');
  assert.match(o, /if \(primary\) \{ this\.gateOk = relaySupportsGate\(relayV\); this\.portentsOk = relaySupportsPortents\(relayV\); \}/);
  assert.match(read('src/scenes/world.js'), /gateRefusal: \(g\) => \(!online\?\.gateOk \|\| online\?\.terminal \|\| \(!!gatePortentsOf\(g\.day\) && !online\?\.portentsOk\) \? GATE_TEXT\.notYet/);
  assert.match(read('server/src/index.js'), /if \(this\._fight && !\('pt' in this\._fight\) && !this\._fight\.fell && !this\._fight\.wrath && gatePortentsOf\(this\._fight\.day\)\) \{ this\._fight = null; await this\.state\.storage\.delete\('gatefight'\); \}/);
  assert.ok('pt' in newFight(7, T0, WRATH, 'ruhn'), 'every fight since says its portents, a plain night\'s null');
  assert.equal(OPENING_MS > 0, true);
});
