// EG-ZB (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 8.2, 11.7, 19 and 21):
// THE LEGION HUNTS, against the director (net/eliteGates/egBrain.js over net/eliteGates/egLegion.js and net/eliteGates/egWalkGraph.js) and the real Room
// (test/fakeRoom.mjs) - a span's Harriers shadowing the company and biting only on its islands and plates, its Divers
// waiting at them; the legion walking the hall's graph (an arch's wall, a chasm, a second floor's stair) and the fliers
// going about the rock; a blow struck only from the fight ground; a member off the floors past six seconds hunted; THE FAIR
// TRAIL's census (fallen segments, the drains, the traversal hazards, the Vestiges); the feats reading who a burning bridge
// caught.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRoom } from '../../fakeRoom.mjs';
import { EG_INTERNAL_OPEN, validEgOut } from '../../../src/net/wire.js';
import { egRoomKey, egHallOf, EG_SEALED_MS, EG_GATHER_MS, EG_CAST_BACK_LOSS } from '../../../src/net/eliteGates/egLaw.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egBreachNew, egEnter, egStep, egBlow, egCount, egPoseIn, egCensusDr, egCastBackCost, egWaveEveryMs, egLegionCap, EG_HUNT_AFTER_MS, EG_HUNT_RAISE, EG_OATH_DR, EG_FEATHER_CAST,
  EG_IMMOVABLE_DR, EG_DRAIN_TICK_MS, EG_WISP_AGAIN_MS } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE, egFightNew, egBodiesOf, egAim, egBodyNew } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, EG_LEGION_KINDS, egLegionStep, egLegionRaise, egWaveSize, egIsleAhead, EG_DIVER_WAIT_R } from '../../../src/net/eliteGates/egLegion.js';
import { egFightView, egGroundAt, egWalkGraph, egWalkNext, egRegionAt, egArchCut, egAirNext, egAirClear, egAirOf, egAirKeep, EG_STRIKE_PAD_M, EG_ROCK_M } from '../../../src/net/eliteGates/egWalkGraph.js';
import { egSupportAt, egFallenAt, egFairNew, egFairPose, EG_HOLD } from '../../../src/net/eliteGates/egFair.js';
import { judgeShapes, judgePlace } from '../../../src/net/bossRef.js';
import { egHazardParts, EG_HAZARDS, egWispAt } from '../../../src/net/eliteGates/egFragLaw.js';
import { egFeatBits, EG_FEAT_BRIDGE, egCaughtBy } from '../../../src/net/eliteGates/egFeats.js';
import { shDisc, shLane } from '../../../src/net/eliteGates/egShape.js';
import { EG_VESTIGES, EG_MASTERIES, EG_DR_MAX } from '../../../src/net/eliteGates/egVestige.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1, 4, 11]);
  egGive8(77, [3]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LINE = { depth: 1, perS: 0.05 };
const vId = (key) => EG_VESTIGES.find((V) => V.key === key).id;

/**
 * A breach of `n` at hall `h` of `seed`, its trial woken with the company on the arrival plate: `at(sub, x, z, y?)` stands a
 * member (the hall's frame), `step(ms)` beats the director (the frames kept), `calls()` the dice it drew.
 */
function breachAt(seed, h, { n = 2 } = {}) {
  let calls = 0, s = seed;
  const rng = () => { calls++; s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const at = (sub, x, z, y) => { pos[sub] = { sx: spec.x0 + x, z, ...(y != null ? { y } : {}) }; };
  return { B, spec, pos, frames, step, at, rng, now: () => now, calls: () => calls };
}
/** The adds a frame list raised, by kind (`ead`). */
const raised = (frames, k) => frames.filter((f) => f.k === 'ead').flatMap((f) => f.a).filter((t) => t[1] === EG_ROLE.add && t[2] === k);

test('EG-ZB THE SPAN\'S LEGION (section 8.2): Harriers shadow the company along the course, raised by the director in the span stage - the first wave 4 s after the wake, egWaveSize(n) of them beside the members, each egWaveEveryMs(c), never past the legion\'s cap - drawing no die; over a platform they body-block and never bite, on an island they bite; Hunting Pack adds its own wave there (mutants: no span legion; a platform bitten; the cap passed; the first wave at the wake)', () => {
  const S = breachAt(12345, 2), { B, spec } = S;
  assert.equal(spec.kind, 'span');
  const plat = spec.steps.find((q) => q.kind === 'still') ?? spec.steps[0], isle = spec.islands[spec.islands.length - 1];   // an island no passage's floor reaches
  S.at('acct-0', plat.x, plat.z); S.at('acct-1', isle.x, isle.z);
  const dice = S.calls(), hw = B.hw;
  const firstBy = (pred) => { for (let k = 0; k < 400; k++) { const o = S.step(); if (pred(o)) return S.now(); } return 0; };
  const first = firstBy((o) => raised(o, EG_KIND.harrier).length > 0);
  assert.ok(first >= hw + 4000 && first < hw + 4250, `the first shadows 4 s after the wake (${first - hw} ms)`);
  assert.equal(raised(S.frames, EG_KIND.harrier).length, egWaveSize(2), 'a wave of egWaveSize(n)');
  const second = firstBy((o) => raised(o, EG_KIND.harrier).length > 0);
  assert.ok(second - first >= egWaveEveryMs(1) && second - first < egWaveEveryMs(1) + 250, 'the next at the hall\'s cadence');
  for (let k = 0; k < 120; k++) S.step();
  const adds = egBodiesOf(B.F, EG_ROLE.add);
  assert.equal(adds.length, egLegionCap(2, 1), 'the legion\'s cap holds');
  assert.ok(adds.every((a) => a.k === EG_KIND.harrier), 'Harriers, in the Galleries');
  assert.equal(S.calls(), dice, 'a span\'s legion draws no die');
  const bites = S.frames.filter((f) => f.k === 'eb' && f.nm === 'Bite');
  assert.ok(bites.length > 0, 'the island is bitten');
  for (const b of bites) assert.ok(Math.hypot(b.s[0][1] - isle.x, b.s[0][2] - isle.z) <= 3, 'every Bite at the islander');
  assert.ok(adds.some((a) => a.tg === 'acct-0' && Math.hypot(a.x - plat.x, a.z - plat.z) <= 2.5), 'the platform\'s member shadowed - and never bitten');
  // Hunting Pack (section 14): its own wave on a span, on its own clock
  const P = breachAt(12345, 2);
  P.B.F.D = { pack: 1 }; P.B.F.packAt = P.now() + 250; P.B.F.waveAt = P.now() + 60_000;
  P.step();
  assert.equal(raised(P.frames, EG_KIND.harrier).length, egWaveSize(2), 'the pack rises on a span');
});

test('EG-ZB THE DIVERS WAIT AT THE ISLANDS (sections 8.2 and 12): from the Shade every other span wave is led at half by Divers, risen over the island or plate the leading member stands on or comes to next; each circles that ground through the air and dives its member once they stand on it, at its kind\'s cadence - never a member on a platform (mutants: no Divers; a dive at a platform; the island ahead misread)', () => {
  const isles = [{ t: 'd', x: 0, z: 0, r: 5 }, { t: 'd', x: 0, z: 20, r: 3 }, { t: 'd', x: 0, z: 40, r: 3 }];
  assert.equal(egIsleAhead(isles, 2), isles[0], 'the ground it stands on');
  assert.equal(egIsleAhead(isles, 9), isles[1], 'past it, the next ahead');
  assert.equal(egIsleAhead(isles, 41), isles[2]);
  assert.equal(egIsleAhead(isles, 44), null, 'past the last, none');
  const S = breachAt(12345, 52), { B, spec } = S;
  assert.equal(spec.band, 2, 'the Shade');
  for (let k = 0; k < 18; k++) S.step();
  const divers = raised(S.frames, EG_KIND.diver);
  assert.equal(divers.length, Math.ceil(egWaveSize(2) / 2), 'the first wave led at half by Divers');
  assert.equal(raised(S.frames, EG_KIND.harrier).length, egWaveSize(2) - divers.length);
  const plate = spec.arrive;
  for (const t of divers) assert.ok(Math.abs(Math.hypot(t[4] - plate.x, t[5] - plate.z) - EG_DIVER_WAIT_R) <= 1.5, 'risen over the ground the leader stands on');
  for (let k = 0; k < 40; k++) S.step();
  const dives = S.frames.filter((f) => f.k === 'eb' && f.nm === 'Dive');
  assert.ok(dives.length > 0, 'a member on the plate is dived');
  // a member on a platform: the Diver waits over the next island and dives nobody
  const plat = spec.steps.filter((q) => q.road === 0 && q.z > plate.z + plate.r && q.z < spec.islands[0].z).pop() ?? spec.steps[0];
  S.at('acct-0', plat.x, plat.z); S.at('acct-1', plat.x + 0.5, plat.z);
  for (let k = 0; k < 8; k++) S.step();
  const n0 = S.frames.filter((f) => f.k === 'eb' && f.nm === 'Dive').length;
  for (let k = 0; k < 60; k++) S.step();
  assert.equal(S.frames.filter((f) => f.k === 'eb' && f.nm === 'Dive').length, n0, 'never a dive at a platform');
  const next = egIsleAhead(egFightView(spec).fl.filter((f) => f.g === 'island' || f.g === 'plate'), plat.z);
  for (const d of egBodiesOf(B.F, EG_ROLE.add).filter((a) => a.k === EG_KIND.diver)) assert.ok(Math.hypot(d.x - next.x, d.z - next.z) <= EG_DIVER_WAIT_R + 1.5, 'waiting over the island ahead');
});

test('EG-ZB THE LEGION WALKS THE GRAPH (section 11.7): the fight ground\'s pieces its regions (an arch\'s disc in two halves), its nodes the portals, drops, stairs and the arch\'s gap; a walker goes by the shortest way - through the arch\'s gap, up a second floor\'s stair (a balcony stepped off), over Grath\'s bridges - and never over a chasm; a charge is cut at the arch\'s wall; a flier goes about a covered passage\'s rock (mutants: the arch splitting nothing; no stair; no walk within a region; the walking-to node forgotten; the rock ignored; the run through the wall)', () => {
  const walk = (view, b, g, gy = NaN, steps = 60) => {
    const seen = [];
    for (let k = 0; k < steps; k++) {
      const [x, z, last] = egWalkNext(view, b, g[0], g[1], gy, b.r);
      seen.push([x, z, last, b.fr]);
      const d = Math.hypot(x - b.x, z - b.z);
      if (last && d < 0.05) break;
      const s = Math.min(d, 1.5);
      if (d > 0) { b.x += ((x - b.x) / d) * s; b.z += ((z - b.z) / d) * s; }
    }
    return seen;
  };
  // the arch (seed 77, hall 14 - a Rift-Yard's chamber whose arch splits its floor)
  const arch = egHallOf(77, 14, 0), va = egFightView(arch), Ga = egWalkGraph(va), d = arch.deco.find((q) => q.t === 'arch');
  assert.deepEqual(Ga.rg, [{ f: 0, side: -1 }, { f: 0, side: 1 }], 'the arch\'s disc in two halves');
  const w1 = walk(va, { x: 10, z: d.z + 10, r: 0.6 }, [-8, d.z - 12]);
  assert.deepEqual(w1[0].slice(0, 2), [d.x, d.z + 0.8], 'first to the gap');
  assert.ok(w1.some((q) => q[0] === d.x && q[1] === d.z - 0.8), 'through it');
  assert.deepEqual(w1[w1.length - 1].slice(2), [true, 0], 'and on to its goal, in the near half');
  assert.equal(egArchCut(va, 10, d.z + 5, 10, d.z - 5)?.[1], d.z, 'a straight run meets the wall');
  assert.equal(egArchCut(va, 0, d.z + 5, 0, d.z - 5), null, 'not through the gap');
  // the director: a Breaker on the far half charging a member on the near half - its charge stops at the wall, its walk goes by the gap
  const F = egFightNew(arch, T0, [40, 40]);
  const [br] = egLegionRaise(F, [EG_KIND.breaker], [[12, d.z + 6]], T0, [], {});
  br.up = 0;
  const here = [{ sub: 'a', x: 12, z: d.z - 6 }], out = [];
  egLegionStep(F, va, T0 + 1000, here, () => 0.5, out, {});
  assert.ok(br.runTo && Math.abs(br.runTo[1] - d.z) <= EG_LEGION_KINDS[EG_KIND.breaker].r + 0.5 && br.runTo[1] > d.z, 'the charge ends at the arch\'s wall');
  const F2 = egFightNew(arch, T0, [40, 40]);
  const [lk] = egLegionRaise(F2, [EG_KIND.lurker], [[10, d.z + 8]], T0, [], {});
  lk.up = 0; lk.fl = 0;
  egLegionStep(F2, va, T0 + 1000, [{ sub: 'a', x: 10, z: d.z - 12 }], () => 0.5, [], {});
  assert.deepEqual([lk.mv.tx, lk.mv.tz], [d.x, d.z + 0.8], 'a Lurker woken walks to the gap');
  // the balcony (seed 77, hall 12 - the Deepway's chamber, its second floors on their stairs)
  const bal = egHallOf(77, 12, 0), vb = egFightView(bal), q = bal.ramps[0];
  const up = walk(vb, { x: -5, z: q.az, r: 0.6 }, [q.bx + 5, q.bz], 4);
  assert.deepEqual(up[0].slice(0, 2), [q.ax, q.az], 'up by the stair\'s foot');
  assert.ok(up.some((s) => s[0] === q.bx && s[1] === q.bz), 'and its top');
  const lip = walk(vb, { x: q.bx - 2, z: q.bz + 5, r: 0.6 }, [q.bx + 5, q.bz], 4);
  assert.deepEqual(lip[0].slice(0, 2), [q.ax, q.az], 'from under its lip too: a ledge is stepped off, never climbed');
  const top = up[up.length - 1];
  assert.equal(top[2], true);
  assert.equal(vb.fl[egWalkGraph(vb).rg[top[3]].f].y, q.y1, 'on the second floor');
  const down = walk(vb, { x: q.bx + 5, z: q.bz, r: 0.6 }, [-5, q.az], 0);
  assert.equal(vb.fl[egWalkGraph(vb).rg[down[down.length - 1][3]].f].y, 0, 'and down again');
  // a passage's chasm (seed 12345, hall 2): a Lurker on its near floor never crosses to the far
  const sp = egHallOf(12345, 2, 0), vs = egFightView(sp), near = sp.fl[0];
  const lw = walk(vs, { x: 1, z: near.az + 2, r: 0.9 }, [0, sp.fl[1].az + 4]);
  assert.ok(lw.every((s) => s[1] <= near.bz + near.hw), 'it stays on its floor');
  // Grath's isles: from one to the next over the bridge
  let gs = null;
  for (let seed = 1; seed < 300 && !gs; seed++) { const h = egHallOf(seed, 5, 0); if (h.lord === 'hound') gs = h; }
  const vg = egFightView(gs), [i0, i1] = gs.spots.isle;
  const gw = walk(vg, { x: i0.x, z: i0.z, r: 0.6 }, [i1.x, i1.z], NaN, 80);
  const bridge = vg.fl.find((f) => f.t === 'l' && Math.hypot(f.ax - i0.x, f.az - i0.z) < 12 && Math.hypot(f.bx - i1.x, f.bz - i1.z) < 12);
  assert.ok(bridge && gw.some((s) => vg.fl[egWalkGraph(vg).rg[s[3]].f] === bridge), 'over the bridge');
  assert.deepEqual(gw[gw.length - 1].slice(0, 3), [i1.x, i1.z, true], 'to the far isle');
  // the air about a covered passage's rock (seed 12345, hall 2)
  const cave = sp.caves[0], A = egAirOf(sp), mid = (cave.z0 + cave.z1) / 2, outside = cave.x + cave.halfW + EG_ROCK_M + 4;
  assert.equal(egAirClear(A, outside, mid, cave.x, mid), false, 'the rock stands between');
  const way = egAirNext(sp, outside, mid, cave.x, mid);
  assert.ok(egAirClear(A, outside, mid, way[0], way[1]) && Math.abs(way[0] - cave.x) > cave.halfW, 'about the rock first');
  assert.deepEqual(egAirNext(sp, cave.x, mid, cave.x, cave.z1 + 5), [cave.x, cave.z1 + 5], 'inside, straight out of its mouth');
  assert.deepEqual(egAirKeep(sp, cave.x + cave.halfW + 1, mid), [cave.x + cave.halfW - 0.6, mid], 'a spot in the rock moved into the tunnel');
  const F3 = egFightNew(sp, T0, [40]);
  const [hr] = egLegionRaise(F3, [EG_KIND.harrier], [[outside + 0.7, mid]], T0, [], {});
  hr.up = 0;
  egLegionStep(F3, vs, T0 + 1000, [], () => 0.5, [], { span: 1, shadow: [{ sub: 'a', x: cave.x, z: mid }], isles: [] });
  assert.ok(hr.mv && egAirClear(A, hr.x, hr.z, hr.mv.tx, hr.mv.tz) && Math.abs(hr.mv.tx - cave.x) > cave.halfW, 'a shadow flies about the rock, never through it');
  assert.equal(egRegionAt(va, Ga, 0, d.z - 3)[0], 0);
});

test('EG-ZB A BLOW FROM THE FIGHT GROUND, AND THE HUNT (sections 11.7 and 21): a blow from traversal ground (a plate, the top of an arch\'s wall over the floor) strikes nothing, a false wall off the floor is struck from beside it; a member who stood on the fight floor and is off it past EG_HUNT_AFTER_MS is HUNTED - marked, a pair of Harriers risen where none stands, the Harriers on them, their Bite carrying `hn` and counted off the floors for that member alone; a member never yet on the floor is not; back on it, the mark is gone (mutants: the strike rule gone; the false wall unstruck; the height ignored; hunted at once; never hunted; the approach hunted; the mark kept; `hn` ignored)', () => {
  const S = breachAt(12345, 1), { B, spec } = S;
  assert.equal(spec.kind, 'yard');
  const f = spec.fl[0], rift = B.F.bodies.find((b) => b.role === EG_ROLE.obj && b.hp > 0);
  const stand = [rift.x - (rift.x - f.x) * 0.1, rift.z - (rift.z - f.z) * 0.1];
  const hit = (sub, p, q) => egBlow(B, sub, { k: 'hit', i: rift.i, q, d: 30, r: 2 }, p, S.now());
  const hp0 = rift.hp;
  hit('acct-0', { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z }, 1);
  assert.equal(rift.hp, hp0, 'from the arrival plate: nothing');
  hit('acct-0', { sx: spec.x0 + stand[0], y: 6.5, z: stand[1] }, 2);
  assert.equal(rift.hp, hp0, 'from 6.5 m over the floor\'s plan: nothing');
  hit('acct-0', { sx: spec.x0 + stand[0], y: 0, z: stand[1] }, 3);
  assert.ok(rift.hp < hp0, 'from the floor: it lands');
  assert.equal(egGroundAt(egFightView(spec), f.x + f.r + EG_STRIKE_PAD_M - 0.1, NaN, f.z, EG_STRIKE_PAD_M), f, 'the plan\'s pad');
  assert.equal(egGroundAt(egFightView(spec), f.x + f.r + EG_STRIKE_PAD_M + 0.1, NaN, f.z, EG_STRIKE_PAD_M), null, 'past it, traversal ground');
  // a false wall in its alcove, off the floor, struck from beside it - by a member off the floor too
  const fw = egBodyNew(B.F, EG_ROLE.obj, 0, f.x + f.r + 2.8, f.z, 1, { r: 1 });
  fw.t = 'fwall'; fw.alc = 0;
  egBlow(B, 'acct-0', { k: 'hit', i: fw.i, q: 4, d: 30, r: 0 }, { sx: spec.x0 + f.x + f.r + 1.8, z: f.z }, S.now() + 1000);
  assert.ok(!B.F.bodies.includes(fw), 'the false wall falls');
  // THE HUNT: on the floor, then off it
  S.at('acct-0', f.x, f.z); S.at('acct-1', f.x + 2, f.z);
  S.step();
  for (const a of egBodiesOf(B.F, EG_ROLE.add)) a.hp = 0;
  B.F.bodies = B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  B.F.waveAt = S.now() + 600_000;
  S.at('acct-1', spec.arrive.x, spec.arrive.z);
  const off = S.now();
  while (S.now() - off <= EG_HUNT_AFTER_MS - 250) S.step();
  assert.equal(B.F.marks.some((m) => m[1] === 7), false, 'not yet');
  S.step(); S.step();
  assert.ok(B.F.marks.some((m) => m[0] === 'acct-1' && m[1] === 7), 'hunted past six seconds');
  assert.ok(S.frames.some((fr) => fr.k === 'emk' && fr.m.some((m) => m[0] === 'acct-1' && m[1] === 7)), 'its mark said');
  const pack = egBodiesOf(B.F, EG_ROLE.add).filter((a) => a.k === EG_KIND.harrier);
  assert.equal(pack.length, EG_HUNT_RAISE, 'a pair rises where no Harrier stood');
  for (let k = 0; k < 60; k++) S.step();
  const bites = B.F.blows.filter((b) => b.hn === 'acct-1');
  assert.ok(bites.length > 0, 'the Harriers bite the hunted where they stand');
  // the census counts a hunted Bite off the floors for its member alone
  const bl = bites[bites.length - 1], at = bl.at, x = bl.s[0][1], z = bl.s[0][2], h = B.h;
  const tr = (px, pz) => [[at - 200, px, 0, pz, h], [at + 100, px, 0, pz, h]];
  const F2 = { h, blows: [{ ...bl, bh: [], bj: 0 }, { ...bl, i: bl.i + 1, hn: 'other', bh: [], bj: 0 }] };
  const got = judgeShapes(F2, [{ sub: 'acct-1', tr: tr(x, z) }], at + 900, egFightView(spec));
  assert.deepEqual(got.map((g) => g.i), [bl.i], 'off the floors, only its own hunt counts');
  // back on the floor: unmarked
  S.at('acct-1', f.x - 2, f.z);
  S.step();
  assert.equal(B.F.marks.some((m) => m[1] === 7), false, 'the hunt over');
  // a member never yet on the floor this hall - an approach crossed - is not hunted
  const T = breachAt(12345, 1);
  for (let k = 0; k < 40; k++) T.step();
  assert.equal((T.B.F.marks ?? []).some((m) => m[1] === 7), false, 'never on the floor, never hunted');
  // the trial over (the rifts closed - the door), the hunt's mark goes with it
  const D = breachAt(12345, 1), df = D.spec.fl[0];
  D.at('acct-0', df.x, df.z); D.at('acct-1', df.x + 1, df.z);
  D.step();
  D.at('acct-1', D.spec.arrive.x, D.spec.arrive.z);
  for (let k = 0; k < 30; k++) D.step();
  assert.ok(D.B.F.marks.some((m) => m[1] === 7));
  for (const o of D.B.F.bodies) if (o.role === EG_ROLE.obj) o.hp = 0;
  D.step();
  assert.equal(D.B.sg, 'closing');
  assert.equal(D.B.F.marks.some((m) => m[1] === 7), false, 'unmarked at the door');
  assert.ok(D.frames.some((fr) => fr.k === 'emk' && !fr.m.some((m) => m[1] === 7)), 'and said so');
});

test('EG-ZB THE FAIR TRAIL\'S CENSUS (section 21; EG-H1\'s departures 3, 10 and 11): a Falling Wall\'s and the Collapsing Tube\'s fallen segments hold nobody, and feet on one owe a cast-back; a fire fall is judged while it burns (seen) and the Forge Line\'s hammers counted; a soul-wisp\'s drain counted at the screens\' law and a Wraith\'s tether too; the census applies Bastion, Challenger\'s Oath, Steadfast Line and Immovable within 30%, and Featherstep\'s lighter cast-back (mutants: a fallen segment holding; the cast-back unowed; the burning unjudged; the drain uncounted; the Vestiges ignored; Bastion unbounded; the Oath on every blow; Immovable moving; the 30% passed; Featherstep ignored)', () => {
  // the Falling Wall (seed 12345, hall 16)
  const fw = egHallOf(12345, 16, 0), hw = T0, zf = fw.walk.z0 + 10;
  assert.equal(fw.variant, 'fallingwall');
  const fallAt = hw + 20_000 + (10 / 1.5) * 1000 + 1000;
  assert.equal(egSupportAt(fw, fw.walk.x, 0, zf, (hw + 5000) / 1000, false, hw), EG_HOLD.island, 'standing before the fall');
  assert.equal(egSupportAt(fw, fw.walk.x, 0, zf, fallAt / 1000, false, hw), EG_HOLD.none, 'fallen: nothing holds');
  assert.equal(egSupportAt(fw, fw.walk.x, 0, zf, fallAt / 1000), EG_HOLD.island, 'a trail with no wake judges as before');
  assert.equal(egFallenAt(fw, hw, fw.walk.x, 0, zf, fallAt), true);
  assert.equal(egFallenAt(fw, hw, fw.arrive.x, 0, fw.arrive.z + 4.8, fallAt), false, 'the plate it began beside still holds');
  const A = egFairNew(16, hw);
  assert.equal(A.hw, hw);
  egFairPose(A, fw, { x: fw.arrive.x, y: 0, z: fw.arrive.z }, fallAt - 400);
  egFairPose(A, fw, { x: fw.walk.x, y: 0, z: zf }, fallAt);
  assert.equal(A.sup[3], fw.arrive.z, 'the fair trail stands nobody on a fallen segment');
  // the Collapsing Tube (seed 12345, hall 17)
  const tb = egHallOf(12345, 17, 0), tz = tb.tube.z0 + 8, tAt = hw + (tb.tube.start + 3) * 1000;
  assert.equal(egSupportAt(tb, tb.tube.x, 0, tz, tAt / 1000, false, hw), EG_HOLD.none, 'the tube\'s floor fallen behind');
  assert.equal(egSupportAt(tb, tb.tube.x, 0, tz, (hw + 1000) / 1000, false, hw), EG_HOLD.island);
  // a pose on the fallen walkway owes the census a cast-back (egPoseIn)
  const W = breachAt(12345, 16);
  W.B.mem['acct-0'].hereH = 16;
  const t1 = W.B.hw + 20_000 + (10 / 1.5) * 1000 + 1000;
  egPoseIn(W.B, 'acct-0', { sx: fw.x0 + fw.arrive.x, y: 0, z: fw.arrive.z }, t1 - 400);
  egPoseIn(W.B, 'acct-0', { sx: fw.x0 + fw.walk.x, y: 0, z: zf }, t1);
  assert.equal(W.B.mem['acct-0'].cbOwe, 1, 'caught by fallen ground: one cast-back owed');
  egPoseIn(W.B, 'acct-0', { sx: fw.x0 + fw.walk.x, y: 0, z: zf + 0.2 }, t1 + 100);
  assert.equal(W.B.mem['acct-0'].cbOwe, 1, 'once');
  // a fire fall judged while it burns (seed 12345, hall 2): seen, share nought, in the census's hazards
  const S = breachAt(12345, 2), { B, spec } = S;
  const fall = spec.hazards.find((q) => q.kind === 'fall');
  let tl = B.hw;
  while (!egHazardParts(fall, tl / 1000).some((p) => p.st === 'live')) tl += 50;
  const fx = (fall.sh[0] + fall.sh[2]) / 2, fz = fall.sh[1];
  const F = B.F;
  const walker = [[tl - 600, fx, 0, fz - 3, B.h], [tl + 700, fx, 0, fz, B.h], [tl + 900, fx, 0, fz + 0.3, B.h]];
  judgePlace(F, egFightView(spec), B.hw, [{ sub: 'acct-0', tr: walker.slice(0, 1) }], tl);
  const seen = judgePlace(F, egFightView(spec), B.hw, [{ sub: 'acct-0', tr: walker }], tl + 1000).filter((q) => q.nm === EG_HAZARDS.fall.name);
  assert.deepEqual(seen.map((q) => [q.sub, q.share, q.k]), [['acct-0', 0, 1]], 'stepped into the burning: seen');
  // the hammer line (seed 12345, hall 76 - the Forge Line): counted
  const fl = egHallOf(12345, 76, 0), hz = fl.hazards.find((q) => q.kind === 'hammerline');
  let th = T0;
  while (!egHazardParts(hz, th / 1000).some((p) => p.st === 'live')) th += 50;
  const Fh = egFightNew(fl, T0, [40]);
  Fh.h = fl.h;
  const ht = [[th - 400, hz.spots[0][0], hz.y, hz.spots[0][1], fl.h], [th + 100, hz.spots[0][0], hz.y, hz.spots[0][1], fl.h]];
  judgePlace(Fh, fl, T0, [{ sub: 'x', tr: ht.slice(0, 1) }], th);
  assert.deepEqual(judgePlace(Fh, fl, T0, [{ sub: 'x', tr: ht }], th + 200).map((q) => q.share), [EG_HAZARDS.hammerline.pct], 'the Forge Line\'s hammers counted');
  // a soul-wisp's drain (seed 12345, hall 27): bound within its reach on a fight floor, a tick a second from a second in,
  // let go after its four seconds, bound again only six later
  const Wp = breachAt(12345, 27), ws = egHallOf(12345, 27, 0), wisp = ws.hazards.find((q) => q.kind === 'wisp');
  Wp.B.mem['acct-1'].alive = 0;
  const trail = [], drains = [], t0 = Wp.now();
  for (let t = t0; t <= t0 + 14_000; t += 250) {
    const [wx, wz] = egWispAt(wisp, t / 1000);
    trail.push([t, wx + 0.5, wisp.y - 1.2, wz, Wp.B.h]);
    if (trail.length > 30) trail.shift();
    egCount(Wp.B, t, [{ sub: 'acct-0', tr: trail }], LINE);
    drains.push([t, (Wp.B.mem['acct-0'].cs ?? [0, 0, 0, 0])[1]]);
  }
  const ticks = drains.filter((q, i) => i > 0 && q[1] > drains[i - 1][1]).map((q) => q[0] - t0);
  assert.ok(ticks.length >= 3, `the drain counted (${ticks.join(', ')})`);
  assert.equal(ticks[0], EG_DRAIN_TICK_MS, 'a tick a second from a second in');
  assert.ok(ticks[3] - ticks[2] >= EG_WISP_AGAIN_MS, 'let go after four seconds, bound again only six later');
  assert.equal(Wp.B.mem['acct-0'].cs[3], ticks.length * Math.round(EG_HAZARDS.wisp.pct * 1000), 'each a plain share');
  // a Wraith's tether drains its member within its reach
  const Wr = breachAt(12345, 1);
  const wb = egBodyNew(Wr.B.F, EG_ROLE.add, EG_KIND.wraith, 0, 30, 50, { r: 0.5 });
  Wr.B.F.tethers.push([wb.i, 'acct-0', 0, 810]);
  const wt = [], t2 = Wr.now();
  for (let t = t2; t <= t2 + 2600; t += 250) { wt.push([t, 3, 0, 30, Wr.B.h]); egCount(Wr.B, t, [{ sub: 'acct-0', tr: wt }], LINE); }
  assert.equal(Wr.B.mem['acct-0'].cs[1], 2, 'two ticks of the Wraith\'s drain');
  // THE CENSUS'S VESTIGES
  const V = breachAt(12345, 5, { n: 6 }), { B: VB } = V;
  const subs = Object.keys(VB.mem), me = subs[0], lord = egBodiesOf(VB.F, EG_ROLE.lord)[0];
  const trs = (pts, at) => subs.map((s, i) => ({ sub: s, tr: [[at - 1200, ...pts[i], VB.h], [at - 600, ...pts[i], VB.h], [at, ...pts[i], VB.h]] }));
  const cx = VB.F.bodies[0].x, cz = VB.F.bodies[0].z, at = V.now();
  const P = (dx) => [cx + dx, 0, cz];
  const far = [P(0), P(20), P(-20), P(30), P(-30), P(40)], close = [P(0), P(3), P(-3), P(4), P(-4), P(5)];
  const blow = { sub: me, at, o: 0 };
  assert.equal(egCensusDr(VB, VB.F, egFightView(V.spec), blow, trs(far, at)), 0, 'no Vestige, nothing spared');
  VB.mem[subs[1]].vs = [[vId('bastion'), 3]];
  assert.ok(Math.abs(egCensusDr(VB, VB.F, egFightView(V.spec), blow, trs(close, at)) - 0.12) < 1e-9, 'Bastion III within 6 m');
  assert.equal(egCensusDr(VB, VB.F, egFightView(V.spec), blow, trs(far, at)), 0, 'out of its reach');
  VB.mem[subs[2]].vs = [[vId('bastion'), 1]];
  assert.ok(Math.abs(egCensusDr(VB, VB.F, egFightView(V.spec), blow, trs(close, at)) - 0.14) < 1e-9, 'two holders: the strongest and 2%');
  for (const s of subs.slice(2)) VB.mem[s].vs = [[vId('bastion'), 3]];
  assert.ok(Math.abs(egCensusDr(VB, VB.F, egFightView(V.spec), blow, trs(close, at)) - 0.18) < 1e-9, 'five holders: the strongest and 6% at most');
  for (const s of subs.slice(1)) VB.mem[s].vs = [];
  VB.mem[me].vs = [[vId('oath'), 2]];
  assert.ok(Math.abs(egCensusDr(VB, VB.F, egFightView(V.spec), { ...blow, o: lord.i }, trs(far, at)) - EG_OATH_DR[1]) < 1e-9, 'the Oath: a lord\'s blow');
  assert.equal(egCensusDr(VB, VB.F, egFightView(V.spec), { ...blow, o: 0 }, trs(far, at)), 0, 'not the place\'s');
  VB.mem[me].vs = [[vId('steadfast'), 1]];
  assert.ok(Math.abs(egCensusDr(VB, VB.F, egFightView(V.spec), blow, trs(close, at)) - 0.05) < 1e-9, 'Steadfast Line with three allies near');
  assert.equal(egCensusDr(VB, VB.F, egFightView(V.spec), blow, trs(far, at)), 0, 'alone, not');
  VB.mem[me].vs = []; VB.mem[me].mast = EG_MASTERIES.find((M) => M.key === 'immovable').id;
  assert.equal(egCensusDr(VB, VB.F, egFightView(V.spec), blow, trs(far, at)), EG_IMMOVABLE_DR, 'Immovable, still a second on the floor');
  const moved = trs(far, at);
  moved[0].tr[1] = [at - 600, cx + 1, 0, cz, VB.h];
  assert.equal(egCensusDr(VB, VB.F, egFightView(V.spec), blow, moved), 0, 'moved: not');
  VB.mem[me].vs = [[vId('oath'), 3], [vId('steadfast'), 3]];
  for (const s of subs.slice(1)) VB.mem[s].vs = [[vId('bastion'), 3]];
  assert.equal(egCensusDr(VB, VB.F, egFightView(V.spec), { ...blow, o: lord.i }, trs(close, at)), EG_DR_MAX, 'together, never past 30%');
  // the census applies them to the count: a plain blow of 0.4 on a member beside a Bastion III holder counts 0.352
  VB.mem[me].vs = []; VB.mem[me].mast = -1;
  for (const s of subs.slice(2)) VB.mem[s].vs = [];
  const t3 = at + 2000, pts3 = close;
  const tr3 = subs.map((s, i) => ({ sub: s, tr: [[t3 - 300, ...pts3[i], VB.h], [t3 + 100, ...pts3[i], VB.h]] }));
  egAim(VB.F, V.spec, { o: 0, s: [shDisc(cx, cz, 2)], at: t3, wu: 1500, p: 0.4, b: 0, el: null, nm: 'Test Blow' }, [], t3 - 1500, []);
  const cs0 = VB.mem[me].cs?.[3] ?? 0;
  egCount(VB, t3 + 900, tr3, LINE);
  assert.equal(VB.mem[me].cs[3] - cs0, 352, 'Bastion III spares a twelfth part of it in the count');
  assert.equal(egCastBackCost([]), EG_CAST_BACK_LOSS);
  assert.deepEqual([1, 2, 3].map((r) => egCastBackCost([[vId('featherstep'), r]])), [...EG_FEATHER_CAST], 'Featherstep\'s 8, 6, 4%');
});

test('EG-ZB THE FEATS READ WHO A PLACE\'S BLOW CAUGHT (section 19; EG-E\'s departure closed): a blow that lingers (a burning bridge, its span) catches a member who steps into it after its landing, the census keeps who each blow caught by its name, and Grath\'s signature is the page\'s - felled with no member caught by a burning bridge, once the bridges burned (mutants: the span unjudged; the catch unkept; the bridge forgiven; the bridges unburned)', () => {
  const S = breachAt(12345, 5), { B, spec } = S;
  assert.equal(spec.lord, 'hound');
  const br = spec.spots.bridge[0], now = S.now(), F = B.F;
  const lane = shLane(br.x, br.z, br.bx, br.bz, 6);
  const bl = egAim(F, spec, { o: 0, s: [lane], at: now + 3000, wu: 3000, p: 0.2, b: 4, el: 'fire', nm: EG_FEAT_BRIDGE, sp: 12_000, ch: 1 }, [], now, []);
  assert.ok(bl);
  const mx = (br.x + br.bx) / 2, mz = (br.z + br.bz) / 2, isle = spec.spots.isle[0], h = B.h;
  // at the landing the member stands on an isle; five seconds into the burning they step onto the bridge
  const trail = [[now + 2900, isle.x, 0, isle.z, h], [now + 3100, isle.x, 0, isle.z, h], [now + 8000, mx, 0, mz, h], [now + 8200, mx, 0, mz, h]];
  B.mem['acct-1'].alive = 0;
  egCount(B, now + 4000, [{ sub: 'acct-0', tr: trail.slice(0, 2) }], LINE);
  assert.deepEqual(egCaughtBy(F, EG_FEAT_BRIDGE), [], 'not at its landing');
  egCount(B, now + 8300, [{ sub: 'acct-0', tr: trail }], LINE);
  assert.deepEqual(egCaughtBy(F, EG_FEAT_BRIDGE), ['acct-0'], 'caught while it burns');
  assert.equal(B.mem['acct-0'].cs[0], 1, 'seen in the census - fire, so nought counted');
  const ctx = { now: now + 9000 };
  F.mem.burnI = 0; F.lordAt = now; F.fellThisHall = 0;
  assert.equal(egFeatBits('hound', F, ctx), 0b011, 'a member caught: no signature');
  F.cg = {};
  assert.equal(egFeatBits('hound', F, ctx), 0b111, 'none caught: Unsinged');
  delete F.mem.burnI;
  assert.equal(egFeatBits('hound', F, ctx), 0b011, 'the bridges never burned: not yet');
  // a plain blow (no span) is judged at its landing alone
  const plain = { i: 99, o: 0, s: [shDisc(mx, mz, 3)], at: now + 3000, wu: 1000, p: 0.2, b: 0, el: null, nm: 'Test', ch: 0, pu: 0, sp: 0 };
  assert.deepEqual(judgeShapes({ h, blows: [plain] }, [{ sub: 'acct-0', tr: trail }], now + 8300, egFightView(spec)), [], 'a plain blow catches nobody after it landed');
});

/** A Spire-frame point (hall `spec`'s own x) as a pose in the dungeon's frame. */
const poseAt = (spec, x, z, y = 0) => { const [px, py, pz] = realmToDungeon(spec.x0 + x, y, z); return { x: px, y: py, z: pz, yaw: 0, pitch: 0 }; };
test('EG-ZB IN THE ROOM (server/src/index.js): the relay reads a pose\'s height with it - a blow from the floor lands, the same pose 6.5 m up and one from the arrival plate land nothing; a span\'s Harriers rise in the room\'s own beat, every frame passing the wire (mutants: the height dropped; the span legion gone)', async () => {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const B0 = 'feedfacecafe0bb0';
  const eg = fakeRoom(egRoomKey(B0), { now: () => clock });
  const w = console.warn; console.warn = () => {};
  try {
    const subs = ['acct-mac', 'acct-ann'];
    const co = subs.map((s, i) => [s, `M${i}`, i + 1]);
    const res = await eg.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_OPEN}`, { method: 'POST', body: JSON.stringify({ b: B0, ez: 'z'.repeat(20), s: co[0][0], o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 } }) }));
    assert.equal(res.status, 200);
    const beat = async (ms) => { const end = clock + ms; while (eg.alarm.at != null && eg.alarm.at <= end) { clock = Math.max(clock, eg.alarm.at); await eg.fire(); } clock = end; };
    clock += EG_SEALED_MS; await beat(1000);
    const spec = egHallOf(12345, 1, 0), socks = {};
    for (const [i, [sub]] of co.entries()) {
      const ws = eg.connect();
      await eg.hello(ws, `peer-${sub}`, poseAt(spec, spec.arrive.x, spec.arrive.z), { kind: 'linked', tokenSub: sub, charLevel: 20 });
      const z = await mintEgOrder({ o: 'egadmit', s: sub, eb: B0, ez: `${'b'.repeat(19)}${i}` }, (await eg.signer()).privateKey, { subtle: globalThis.crypto.subtle, nowS: Math.floor(clock / 1000) });
      await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z, lv: 20, bv: 2 }));
      socks[sub] = ws;
    }
    for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(spec, spec.arrive.x, spec.arrive.z));
    await beat(EG_GATHER_MS + 1000);
    const R = eg.room._eg;
    assert.equal(R.sg, 'trial');
    const f = spec.fl[0], rift = R.F.bodies.find((b) => b.role === EG_ROLE.obj && b.hp > 0);
    const sx = rift.x - (rift.x - f.x) * 0.1, sz = rift.z - (rift.z - f.z) * 0.1;
    const strike = async (y, q) => { await eg.pose(socks['acct-mac'], poseAt(spec, sx, sz, y)); clock += 300; await eg.raw(socks['acct-mac'], JSON.stringify({ t: 'eg', k: 'hit', i: rift.i, q, d: 30, r: 2 })); };
    const hp0 = rift.hp;
    await eg.pose(socks['acct-mac'], poseAt(spec, spec.arrive.x, spec.arrive.z)); clock += 300;
    await eg.raw(socks['acct-mac'], JSON.stringify({ t: 'eg', k: 'hit', i: rift.i, q: 1, d: 30, r: 2 }));
    assert.equal(rift.hp, hp0, 'from the plate: nothing');
    await strike(6.5, 2);
    assert.equal(rift.hp, hp0, '6.5 m over the floor: nothing');
    await strike(0, 3);
    assert.ok(rift.hp < hp0, 'on the floor: it lands');
    // a span's legion in the room's own beat (hall 2)
    const s2 = egHallOf(12345, 2, 0);
    R.h = 2; R.sg = 'arrive'; R.pulledAt = clock; R.su = clock + 30_000; R.F = null; R.gatherAt = 0;
    for (const sub of subs) R.mem[sub].hereH = 0;
    for (let k = 0; k < (EG_GATHER_MS + 6000) / 1000; k++) { for (const ws of Object.values(socks)) await eg.pose(ws, poseAt(s2, s2.arrive.x, s2.arrive.z)); await beat(1000); }
    assert.equal(R.sg, 'trial');
    const sent = socks['acct-ann'].sent.filter((m) => m.t === 'eg');
    const risen = sent.filter((m) => m.k === 'ead').flatMap((m) => m.a).filter((t) => t[1] === EG_ROLE.add && t[2] === EG_KIND.harrier);
    assert.ok(risen.length >= egWaveSize(2), 'the span\'s Harriers said to every screen');
    for (const m of sent) { const { t: _t, ...rest } = m; assert.ok(validEgOut(rest), `a frame the wire takes: ${m.k}`); }
  } finally { Date.now = realNow; console.warn = w; }
});
