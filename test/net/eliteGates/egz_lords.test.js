// EG-ZK (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.7, 13.1 and 13.2,
// EG-H3's departure 3 and EG-ZB's departure 2): THE LORDS ON THE SEAM AND THE GRAPH, against the director (net/eliteGates/egBrain.js
// over net/eliteGates/egLords.js) on real halls - every lord and champion of the Spire through ONE plug of the boss seam
// (net/eliteGates/egLords.js EG_SEAM, net/bossSeam.js's seven members), the director calling it inside its one beat, each member the
// lords' own law handed the arguments the director handed it before (so every frame is the frame it said); and the lords
// walking the hall's graph - a champion in an arch's chamber through the arch, Grath along his bridges and never over the
// magma, a champion up a stair to a member on the floor above, a run cut at an arch's wall and never up a ledge's face.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, egOnFight, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, champRing } from '../../../src/net/eliteGates/egBrain.js';
import { EG_SEAM, EG_EARN_SHARE, EG_EARN_HALLS, egLordsFight, egLordsNew, egLordsStep, egLordHit, egLordHitX, egLordsOf, egLordsFell } from '../../../src/net/eliteGates/egLords.js';
import { egFightNew, egFightState, egHitBody, egBodyById } from '../../../src/net/eliteGates/egBodies.js';
import { BOSS_SEAM_KEYS } from '../../../src/net/bossSeam.js';
import { judgeShapes } from '../../../src/net/bossRef.js';
import { egFightView, egWalkGraph, egArchCut } from '../../../src/net/eliteGates/egWalkGraph.js';
import { egInBlow } from '../../../src/net/eliteGates/egShape.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1]);
  egGive8(1, [5]);
  egGive8(31337, [9]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };

/**
 * A breach of `n` at hall `h` of `seed`, its trial woken with the company on the arrival plate: `at(sub, x, z, y?)` stands a
 * member (the hall's frame), `step(ms)` beats the director (its frames kept), `here()` the census as the director keeps it.
 */
function breachAt(seed, h, { n = 1 } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [], pr: 'rally' });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  const at = (sub, x, z, y) => { pos[sub] = { sx: spec.x0 + x, z, ...(y != null ? { y } : {}) }; };
  const here = () => co.map(([sub]) => ({ sub, x: pos[sub].sx - spec.x0, z: pos[sub].z, ...(pos[sub].y != null ? { y: pos[sub].y } : {}) }));
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  return { B, spec, pos, frames, step, at, here, now: () => now };
}
/** PIN MOVED (AUDIT EG IV, lane1 #11; section 8.5: "It wakes at the wake ring"): a Proving Walk's champion stands asleep until the
 *  company stands in its court's ring (net/eliteGates/egBrain.js champRing) - the member steps in at the court's heart, a beat, and the
 *  champion is awake where it stood. Before, every champion here woke with the hall. */
function wokenAtRing(S, L) {
  const r = champRing(S.spec);
  S.at('acct-0', r.x, r.z, 0);
  S.step();
  assert.ok(L.up2, 'the champion woke at its ring');
}
/** Where a body was set down after blow `bl`'s word (its run's end: the first walk of no speed said after it). */
function placeAfter(frames, i, bl) {
  for (const f of frames.slice(frames.indexOf(bl) + 1)) if (f.k === 'emv') for (const m of f.m) if (m[0] === i && m[5] === 0) return [m[1], m[2]];
  return null;
}
/** A body's path as the frames said it: every walk's start and goal and every place, in order (`emv`). */
function pathOf(frames, i, from) {
  const path = [from];
  for (const f of frames) if (f.k === 'emv') for (const m of f.m) if (m[0] === i) path.push([m[1], m[2]], [m[3], m[4]]);
  return path;
}

test('EG-ZK THE LORDS ON THE SEAM (section 13.1; EG-H3\'s departure 3 retired): every lord and champion of the Spire through ONE plug of the boss seam - the contract\'s seven members and nothing else - and the director calls each through it inside its one beat: the birth of every lord it stands, a blow on a lord, the lords\' beat, the fight\'s state, the judge, the earning - never the lords\' own functions behind it (mutants: a member missing; the director calling a lord past the seam)', () => {
  assert.equal(EG_SEAM.name, 'eg');
  assert.deepEqual(Object.keys(EG_SEAM), ['name', ...BOSS_SEAM_KEYS]);
  for (const k of BOSS_SEAM_KEYS) assert.equal(typeof EG_SEAM[k], 'function', k);
  assert.ok(Object.isFrozen(EG_SEAM));
  const src = readFileSync(new URL('../../../src/net/eliteGates/egBrain.js', import.meta.url), 'utf8');
  for (const name of ['egLordsNew', 'egLordsStep', 'egLordHit', 'egLordHitX', 'judgeShapes', 'egFightState']) assert.ok(!new RegExp(`\\b${name}[(,]|import \\{[^}]*\\b${name}\\b`).test(src), `the director calls ${name} past the seam`);
  const calls = (m) => src.split(`EG_SEAM.${m}(`).length - 1;
  assert.deepEqual(BOSS_SEAM_KEYS.map((m) => [m, calls(m)]), [['new', 6], ['join', 3], ['hit', 2], ['step', 2], ['stateOf', 3], ['judge', 1], ['earned', 1]]);   // PIN MOVED (EG-ZQ): a blow's join, the seen-and-restore step's and a fall's (section 13.2's shares); PIN MOVED (EG-ZS): a member's blow, and a host hit on a lord (Bladestorm, Kindled Steel)
});

test('EG-ZK EVERY MEMBER IS THE LORDS\' OWN LAW, frame for frame (section 13.1): on real fights the director stood, each seam member and the lords\' own functions it plugs, handed the same, say the same frames and leave the same fight - a Court\'s lord born and a champion born at its place, forty beats of Grath with the company in reach, a blow that fells him (the gate\'s hand and purse, the lord\'s own weight, his fall said), the fight\'s state at its clock, the judge on the shared-time trails; and join and earned keep the director\'s own rules (mutants: a birth\'s decrees or place lost; the beat\'s context lost; the lord\'s weight or the Vestiges\' dropped; his fall untold; the state at another clock; the judge off the fight ground; a witness joined; the earning\'s half-share or three halls moved)', () => {
  // new - the producer's fresh fight, born twice
  const spec5 = egHallOf(12345, 5, 0), now0 = T0 + 1000;
  for (const [key, at] of [['hound', undefined], ['kynreeve', [3, 45]]]) {
    const F1 = egFightNew(spec5, now0, [40, 32]), F2 = egFightNew(spec5, now0, [40, 32]), o1 = [], o2 = [];
    const f = EG_SEAM.new({ F: F1, spec: spec5, key, now: now0, out: o1, decrees: { colossal: 1 }, n: 2, at });
    const stood = egLordsNew(F2, spec5, key, now0, o2, { decrees: { colossal: 1 }, n: 2, at });
    assert.deepEqual([f.stood, o1, F1], [stood, o2, F2], `${key} born as the lords bear it`);
    assert.equal(f.F, F1);
    if (at) assert.deepEqual([f.stood[0].x, f.stood[0].z], at, 'the champion at its place');
    assert.equal(F1.mem.law.hpX, 1.25, 'the decrees reached the birth');
  }
  // step - Grath awake, the company in reach
  const S = breachAt(12345, 5, { n: 2 });
  S.at('acct-0', S.spec.ring.x, S.spec.ring.z); S.at('acct-1', S.spec.ring.x + 1, S.spec.ring.z);
  for (let k = 0; k < 24; k++) S.step();
  const L = egLordsOf(S.B.F)[0];
  assert.ok(L.up2 && L.key === 'hound', 'Grath awake');
  const F1 = structuredClone(S.B.F), F2 = structuredClone(S.B.F), r1 = seeded(9), r2 = seeded(9), ctx = { decrees: S.B.F.D, n: S.B.F.n, covenant: 0 };
  let now = S.now(), said = [];
  for (let k = 0; k < 40; k++) {
    now += 250;
    const here = [{ sub: 'acct-0', x: L.x + 1.5, z: L.z + 1.5 }, { sub: 'acct-1', x: L.x - 2, z: L.z - 6 }];
    const a = EG_SEAM.step(egLordsFight(F1, S.spec, ctx, now), now, here, r1), b = [];
    egLordsStep(F2, S.spec, now, here, r2, b, ctx);
    assert.deepEqual(a, b, `beat ${k}: the same frames`);
    said = said.concat(a);
  }
  assert.deepEqual(F1, F2, 'the same fight after forty beats');
  assert.ok(said.some((f) => f.k === 'esay') && F1.moves.length > 0 && F1.bl > S.B.F.bl, 'the beats said words, walked and committed blows');
  // hit - a blow on him stunned (STUN_HIT_X his own weight), then one that fells him, from beside him: the gate's hand and purse
  const H1 = structuredClone(F1), H2 = structuredClone(F1), m1 = structuredClone(S.B.mem['acct-0']), m2 = structuredClone(S.B.mem['acct-0']);
  const G1 = egBodyById(H1, L.i), G2 = egBodyById(H2, L.i);
  G1.ward = G2.ward = 0; G1.stunUntil = G2.stunUntil = now + 5000;
  const pose = { x: G1.x + 1.2, z: G1.z }, here = [{ sub: 'acct-0', x: pose.x, z: pose.z }], o1 = [], o2 = [];
  for (const [d, seq, hp] of [[60, 7, null], [300, 8, 40]]) {
    if (hp) G1.hp = G2.hp = hp;
    const at = now + seq * 300;
    const h1 = EG_SEAM.hit(egLordsFight(H1, S.spec, {}, at), 'acct-0', d, HIT_KINDS.Melee, pose, at, seq, { i: L.i, p: m1, x: 1.1, bx: 1.2, name: 'M0', here, out: o1, threatX: 2 });
    const h2 = egHitBody(H2, S.spec, m2, L.i, d, HIT_KINDS.Melee, pose, at, seq, 1.1 * egLordHitX(H2, G2, 'acct-0', pose, HIT_KINDS.Melee, at), 1.2);
    if (h2.got && h2.b) egLordHit(H2, S.spec, h2.b, 'acct-0', 'M0', h2.got, pose, at, here, o2, { threatX: 2 });
    assert.deepEqual([h1, o1, H1, m1], [h2, o2, H2, m2], `the same blow (${d}), the same fight`);
    assert.ok(h1.got > 0, 'it landed');
    if (!hp) assert.equal(h1.got, 60 * (1.1 * 1.5), 'its weight: the Vestiges\' x1.1 and the stun\'s x1.5');
  }
  assert.ok(egLordsFell(H1), 'the second felled him');
  assert.deepEqual(o1.filter((f) => f.k === 'efell').map((f) => [f.i, f.n]), [[L.i, 'M0']], 'his fall said by name');
  const isle = H1.bodies.find((b) => b.t === 'isle');
  for (const i of [999, isle.i]) {
    const p = structuredClone(S.B.mem['acct-0']), t = now + 60_000;   // a fresh purse: the seam, not the hand, refuses it
    assert.deepEqual(EG_SEAM.hit(egLordsFight(H1, S.spec, {}, t), 'acct-0', 300, 0, { x: isle.x, z: isle.z }, t, 1, { i, p, out: [] }), { got: 0, b: null }, 'no lord there, nothing');
  }
  // stateOf - the whole fight at the view's clock
  // judge - a blow landed on a member standing in it, judged on the shared-time trails
  const J = breachAt(12345, 5, { n: 1 });
  J.at('acct-0', J.spec.ring.x, J.spec.ring.z);
  let landed = null;
  for (let k = 0; k < 400 && !landed; k++) {
    J.step();
    landed = J.B.F?.blows.find((b) => b.at <= J.now() && !b.bj && J.here().some((m) => egInBlow(b, m.x, m.z))) ?? null;
  }
  assert.ok(landed, 'a lord\'s blow landed on the member');
  const tr = [], t1 = J.now() + 300;   // the member's trail past the landing, the judge a beat on
  for (let t = J.now() - 3000; t <= t1; t += 100) { const m = J.here()[0]; tr.push([t, m.x, 0, m.z, J.B.h]); }
  const view = egFightView(J.spec), K1 = structuredClone(J.B.F), K2 = structuredClone(J.B.F), bodies = [{ sub: 'acct-0', tr }];
  const j1 = EG_SEAM.judge(egLordsFight(K1, view, {}, t1), bodies, t1), j2 = judgeShapes(K2, bodies, t1, view);
  assert.deepEqual([j1, K1], [j2, K2], 'the same judgement');
  assert.ok(j1.some((x) => x.sub === 'acct-0' && x.i === landed.i), 'the landed blow judged');
  // stateOf - the whole fight at the view's clock: the landed blow said now, forgotten seconds on
  const states = [J.now(), J.now() + 5000].map((t) => EG_SEAM.stateOf(egLordsFight(J.B.F, null, {}, t)));
  assert.deepEqual(states, [egFightState(J.B.F, J.now()), egFightState(J.B.F, J.now() + 5000)]);
  assert.ok(states[0].bl.some((b) => b.i === landed.i) && !states[1].bl.some((b) => b.i === landed.i), 'its blows by its own clock');
  // join - the director's admission while a lord stands
  const lf = egLordsFight(F1, S.spec, {}, now);
  assert.equal(EG_SEAM.join(lf, 'acct-0', 'M0', 40, now, null, { admits: true }), true);
  assert.equal(EG_SEAM.join(lf, 'acct-0', 'M0', 40, now, null, { admits: false }), false, 'a witness, one gone home: never');
  assert.equal(EG_SEAM.join(egLordsFight(H1, S.spec, {}, now), 'acct-0', 'M0', 40, now, null, { admits: true }), false, 'the lords fallen: none to fight');
  // earned - the Redoubt's rule over the living company, at the lords' fall
  assert.deepEqual([EG_EARN_SHARE, EG_EARN_HALLS], [0.5, 3]);
  const rows = [[30, 0], [7, 0], [5, 2], [0, 3]].map(([dc, act], j) => [`acct-${j}`, { ...structuredClone(S.B.mem['acct-0']), dc, act }]);
  const fell = egLordsFight(H1, S.spec, { co: rows }, now), up = egLordsFight(F1, S.spec, { co: rows }, now);
  assert.deepEqual(rows.map(([sub]) => EG_SEAM.earned(fell, sub)), [true, true, false, true], 'half an even share of 42 (5.25) or three halls');
  assert.deepEqual(rows.map(([sub]) => EG_SEAM.earned(up, sub)), [false, false, false, false], 'nothing owed while the lord stands');
  assert.equal(EG_SEAM.earned(fell, 'acct-9'), false, 'no part, no receipt');
});

test('EG-ZK A CHAMPION IN AN ARCH\'S CHAMBER GOES THROUGH THE ARCH (section 11.7; EG-ZB\'s departure 2 retired): the Proving Walk of seed 1\'s fifth circle stands its Kynreeve past a chokepoint arch\'s wall from a member on the other half - it walks to the arch\'s gap, through it, and on to the member, and no walk or place the frames say ever crosses the wall; a Charge run at the wall from beside it ends at the wall, its body clear (mutants: a lord walking straight; the run carried through)', () => {
  const S = breachAt(1, 23);
  const arch = S.spec.deco.find((d) => d.t === 'arch'), L = egLordsOf(S.B.F)[0];
  assert.ok(arch && L.key === 'kynreeve', 'the arch and its champion');
  assert.ok(L.z > arch.z, 'the champion stands past the wall');
  const mx = 12, mz = 44;   // the other half, beyond the gap: the straight way meets the wall 5.9 m out
  assert.ok(egArchCut(S.spec, L.x, L.z, mx, mz), 'the straight way is through the wall');
  S.at('acct-0', mx, mz);
  const from = [L.x, L.z], k0 = S.frames.length;
  let crossed = 0;
  for (let k = 0; k < 60; k++) { S.step(); if (L.z < arch.z - 0.4) crossed = crossed || k + 1; }
  const path = pathOf(S.frames.slice(k0), L.i, from);
  assert.deepEqual(path[2], [arch.x, arch.z + 0.8], 'its first walk: to the arch\'s gap');
  for (let j = 1; j < path.length; j++) assert.equal(egArchCut(S.spec, path[j - 1][0], path[j - 1][1], path[j][0], path[j][1]), null, `never through the wall (${path[j - 1]} -> ${path[j]})`);
  assert.ok(crossed > 0 && Math.abs(L.x - mx) + Math.abs(L.z - mz) < 6, `through the arch to the member (${L.x}, ${L.z})`);
  // set down off its walk (a run's end, a blink) on the near half beside the wall, it keeps no way on to the far gap node it
  // was walking to: back through the gap, never straight across the wall to that node
  const D = breachAt(1, 23), M = egLordsOf(D.B.F)[0], G = egWalkGraph(egFightView(D.spec));
  D.at('acct-0', mx, mz);
  for (let k = 0; k < 40 && !(M.wn >= 0 && G.nodes[M.wn].z < arch.z); k++) D.step();
  assert.ok(M.wn >= 0 && G.nodes[M.wn].z < arch.z, 'walking to the gap\'s far node');
  assert.ok(egArchCut(D.spec, 8, 49, G.nodes[M.wn].x, G.nodes[M.wn].z), 'from where it is set down, that node is across the wall');
  M.x = 8; M.z = 49; M.mv = null;
  D.at('acct-0', 10, 40);
  const k1 = D.frames.length;
  for (let k = 0; k < 12; k++) D.step();
  const back = pathOf(D.frames.slice(k1), M.i, [8, 49]);
  assert.ok(back.length > 2, 'it walked');
  for (let j = 1; j < back.length; j++) assert.equal(egArchCut(D.spec, back[j - 1][0], back[j - 1][1], back[j][0], back[j][1]), null, `never through the wall (${back[j - 1]} -> ${back[j]})`);
  // a Charge at a member across the wall, from beside it: the run ends at the wall
  const C = breachAt(1, 23), K = egLordsOf(C.B.F)[0];
  wokenAtRing(C, K);
  C.at('acct-0', 8, 38);
  K.x = 8; K.z = 51; K.mv = null; K.nextAt = C.now() + 250;
  let charge = null;
  for (let k = 0; k < 20 && !charge; k++) { C.step(); charge = C.frames.find((f) => f.k === 'eb' && f.o === K.i && f.nm === 'Charge') ?? null; }
  assert.ok(charge, 'it charges');
  for (let k = 0; k < 16; k++) C.step();
  const end = placeAfter(C.frames, K.i, charge);
  assert.ok(end && end[1] > arch.z, `the run ends at the wall (${end})`);
  assert.equal(end[1], Math.round((arch.z + K.r + 0.4) * 100) / 100, 'its body clear of the wall');
});

test('EG-ZK GRATH ALONG HIS BRIDGES (sections 11.7 and 13.3): the first Court\'s Hound, woken on the far island from a member at the lower island\'s rim, walks the bridge to them - every walk the frames say lies on the fight floor (the islands and the bridges), never over the magma; the same walk by the old straight way would cross it (mutants: a lord walking straight)', () => {
  const S = breachAt(12345, 5);
  const L = egLordsOf(S.B.F)[0];
  assert.equal(L.key, 'hound');
  S.at('acct-0', -8, 40);   // in the wake ring, on the lower island's far side
  const from = [L.x, L.z], k0 = S.frames.length;
  for (let k = 0; k < 24; k++) S.step();
  assert.ok(L.up2, 'he woke');
  const path = pathOf(S.frames.slice(k0), L.i, from).slice(0, 3);
  assert.ok(path.length === 3, 'he walked');
  let off = 0;
  const straight = (ax, az, bx, bz) => { for (let t = 0; t <= 1; t += 0.02) if (!egOnFight(S.spec, ax + (bx - ax) * t, az + (bz - az) * t, 0.25)) return false; return true; };
  for (let j = 1; j < path.length; j++) if (!straight(path[j - 1][0], path[j - 1][1], path[j][0], path[j][1])) off++;
  assert.equal(off, 0, `every walk on the floor (${JSON.stringify(path)})`);
  assert.ok(!straight(from[0], from[1], -8, 40), 'the straight way is over the magma');
  const bridge = S.spec.spots.bridge.find((b) => Math.hypot(path[2][0] - b.bx, path[2][1] - b.bz) < 2 || Math.hypot(path[2][0] - b.x, path[2][1] - b.z) < 2);
  assert.ok(bridge, `his first goal the bridge\'s end (${path[2]})`);
  // THE SCENT across the islands: the hunted fled to the island he is not on - he runs them down along the bridges
  const T = breachAt(12345, 5, { n: 2 });
  T.at('acct-0', T.spec.ring.x, T.spec.ring.z); T.at('acct-1', T.spec.ring.x + 1, T.spec.ring.z);
  const G = egLordsOf(T.B.F)[0];
  for (let k = 0; k < 12 && !G.up2; k++) T.step();
  assert.ok(G.up2, 'he woke');
  const spot = [-9, 46];   // the lower island's west rim
  assert.ok(Math.hypot(spot[0] - T.spec.spots.isle[0].x, spot[1] - T.spec.spots.isle[0].z) < 11 && Math.hypot(G.x - spot[0], G.z - spot[1]) > 30, 'the company on the island he is not on');
  T.at('acct-0', spot[0], spot[1]); T.at('acct-1', spot[0], spot[1] - 1);
  T.B.F.mem.scentAt = T.now() + 250;   // the Scent now
  const hunt = [G.x, G.z], scent = T.frames.length;
  for (let k = 0; k < 24; k++) T.step();
  assert.ok(T.frames.slice(scent).some((f) => f.k === 'esay' && f.w === 'scent'), 'the Scent');
  const run = pathOf(T.frames.slice(scent), G.i, hunt).filter((p, j, a) => j === 0 || p[0] !== a[j - 1][0] || p[1] !== a[j - 1][1]);
  assert.ok(run.length >= 3 && T.frames.slice(scent).some((f) => f.k === 'emv' && f.m.some((m) => m[0] === G.i && m[5] === 5.2)), 'hunted at 5.2 m/s');
  for (let j = 1; j < run.length; j++) assert.ok(straight(run[j - 1][0], run[j - 1][1], run[j][0], run[j][1]), `the hunt on the floor (${run[j - 1]} -> ${run[j]})`);
  assert.ok(!straight(hunt[0], hunt[1], spot[0], spot[1]), 'the straight way is over the magma');
});

test('EG-ZK A CHAMPION UP THE STAIR, AND NO RUN UP A LEDGE\'S FACE (sections 11.7 and 8.5): the Proving Walk of seed 31337\'s ninth circle has a second floor 4 m up, its stair from the floor; a member on it - the Kynmarcher walks to the stair\'s foot, climbs it, and comes to the member on the floor above; it never runs a Charge at a member on another floor\'s height, and a run that would end up a ledge\'s face ends on its own floor (mutants: a lord walking straight; a Charge up the ledge; the run carried up)', () => {
  const S = breachAt(31337, 43);
  const L = egLordsOf(S.B.F)[0], q = S.spec.ramps[0], up = S.spec.fl.find((f) => f.t === 'd' && f.y > 3);
  assert.ok(L.key === 'kynmarcher' && q && up, 'the champion, its stair and its upper floor');
  wokenAtRing(S, L);
  S.at('acct-0', up.x + 3.5, up.z, up.y);
  const from = [L.x, L.z], k0 = S.frames.length;
  let topAt = 0;
  for (let k = 0; k < 60; k++) { S.step(); if (!topAt && Math.hypot(L.x - q.bx, L.z - q.bz) < 0.75) topAt = k + 1; }
  const path = pathOf(S.frames.slice(k0), L.i, from);
  assert.deepEqual(path[2], [q.ax, q.az], 'first to the stair\'s foot');
  assert.ok(path.some((p) => p[0] === q.bx && p[1] === q.bz), 'then up it, to its top');
  assert.ok(topAt > 0 && Math.hypot(L.x - up.x, L.z - up.z) <= up.r, `on the floor above (${L.x}, ${L.z})`);
  assert.ok(!S.frames.slice(k0).some((f) => f.k === 'eb' && f.o === L.i && f.nm === 'Charge'), 'no Charge at a member on another height');
  // a Charge along its own floor at a member under the ledge's lip: its run would end up on the ledge, and ends below it
  const C = breachAt(31337, 43), K = egLordsOf(C.B.F)[0], lower = C.spec.fl.find((f) => f.t === 'd' && f.y === 0);
  wokenAtRing(C, K);
  C.at('acct-0', lower.x + 13, lower.z, 0);
  K.x = lower.x - 5.5; K.z = lower.z; K.mv = null; K.nextAt = C.now() + 250;
  let charge = null;
  for (let k = 0; k < 24 && !charge; k++) { C.step(); charge = C.frames.find((f) => f.k === 'eb' && f.o === K.i && f.nm === 'Charge') ?? null; }
  assert.ok(charge, 'it charges along its own floor');
  for (let k = 0; k < 16; k++) C.step();
  const end = placeAfter(C.frames, K.i, charge);
  assert.ok(end, 'its run ended');
  assert.deepEqual(end, [Math.round((lower.x + lower.r - K.r) * 100) / 100, lower.z], 'the run ends on its own floor, under the ledge');
});
