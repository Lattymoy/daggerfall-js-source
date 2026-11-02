// EG-PERFECT - SPEC LAW 10, THE BROKEN WAY, ITS PINS ONE BY ONE (bible/11-Multiplayer/Elite-Gates-Ascent.md section 11): each of the
// law's changes held on a hall or two that shows it (test/net/eliteGates/egperfect_broken.test.js holds them over 400 halls) and
// on the law's own pieces alone - fast enough that every mutant of tools/mutants/egperfect_broken.json is run against them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egAscentProof, EG_SPEC, EG_BROKEN_LAW, EG_BROKEN_TRIES, EG_RELAY_MAX, EG_STEP, EG_SEALED_MS, EG_CLOSING_FIGHT_MS } from '../../../src/net/eliteGates/egLaw.js';
import { EG_BROKEN_KINDS, EG_BROKEN_TURNED } from '../../../src/net/eliteGates/egAscent.js';
import { egSpanPairs, egSpanProof, egSpanOf, egPieceAt, egPairWindows, egSpanBuildOf, EG_GAP_MIN_CM, EG_GAP_MAX_CM, EG_RAIL_CLEAR, EG_DROP_CM, EG_DROP_LAW10_CM } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egRouteLegs } from '../../../src/net/eliteGates/egRouteProof.js';
import { egFragPassage, egFragChamber, egSetPiece, EG_ALCOVE_REACH_M } from '../../../src/net/eliteGates/egFragLaw.js';
import { egBreachNew, egEnter, egStep, egTrialAwaits, egClosingMs } from '../../../src/net/eliteGates/egBrain.js';
import { egBodiesOf, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { egRingSideOpen, EG_RING_WALL_SIDES } from '../../../src/net/eliteGates/egWalkGraph.js';
import { sdRng } from '../../../src/net/superDungeon/sdBrain.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const L10 = (seed, h, geo = 0) => egHallOf(seed, h, geo, 10);
const brokenOf = (s) => (s.route.courses ?? []).filter((g) => g.b).map((g) => ({ g, steps: s.steps.filter((q) => q.x >= g.x0 - 0.01 && q.x <= g.x1 + 0.01 && q.z >= g.z0 - 0.01 && q.z <= g.z1 + 0.01 && Math.abs(q.y - g.y0) < 0.01) }));

test('EG-PERFECT THE BROKEN WAY (unit) - THE LAW AND ITS BRIDGES: spec law 10 is the build\'s; seed 77\'s first halls break their bridges - along +z and turned - each onto one kind of its band\'s, a turned one onto the still kinds alone, every gap THE ENVELOPE\'s, and stand proven (mutants: the law\'s number; a bridge never broken; a turned bridge onto a Drift; a broken gap off THE ENVELOPE)', () => {
  assert.deepEqual([EG_SPEC, EG_BROKEN_LAW], [10, 10]);
  let turned = 0, straight = 0;
  for (const h of [1, 3, 4, 5]) {
    const s = L10(77, h), B = brokenOf(s);
    assert.ok(B.length >= 1, `77:${h}: a broken bridge`);
    assert.ok(egAscentProof(s).ok, `77:${h}: proven`);
    for (const { steps } of B) {
      const hd = steps[0].hd ?? 0;
      if (hd) turned++; else straight++;
      assert.ok(steps.every((q) => q.kind === steps[0].kind && (q.hd ?? 0) === hd), `77:${h}: one kind, one heading`);
      assert.ok((hd ? EG_BROKEN_TURNED : EG_BROKEN_KINDS[s.band]).includes(steps[0].kind), `77:${h}: a ${steps[0].kind} breaks a bridge heading ${hd}`);
      for (const q of steps) assert.ok(q.gap * 100 >= EG_GAP_MIN_CM - 1e-6 && q.gap * 100 <= EG_GAP_MAX_CM + 1e-6, `77:${h}: a gap of ${q.gap} m`);
    }
  }
  assert.ok(turned >= 4 && straight >= 1, `${turned} turned, ${straight} along +z`);
});

test('EG-PERFECT THE BROKEN WAY (unit) - THE FORK: a Gale-Swept span (77:7 on ground 4) forks, its Low Road linked by its bridge across and its own spans on, never a bridge that climbs; a deep span\'s fork (4:97 on ground 4 - its course 141 m with a trunk under two ranks) laid first and stands forked; a hall the planner refuses on every law-9 try stands on one of its own (77:37 on try 9, its courses whole - never the plainest; PIN MOVED, EG-PERFECT\'s audit: 77:57 lays on law 9\'s eighth try now its long bridges break in parts) (mutants: the Low Road\'s islands bridges; the fork second; a trunk under two ranks; the planner\'s own tries gone)', () => {
  const g = L10(77, 7, 4);
  assert.ok(g.fork && g.geo % 3 > 0, '77:7:4 forks under the Gale');
  for (const l of g.route.links.filter((q) => q.road === 1 && q.kind === 'bridge')) assert.ok(Math.abs(g.route.nodes[l.a][1] - g.route.nodes[l.b][1]) <= 0.6, 'a Low Road bridge level');
  assert.ok(g.route.links.some((q) => q.road === 1 && q.kind === 'span'), 'its Low Road its own spans');
  const deep = L10(4, 97, 4);
  assert.ok(deep.fork && deep.laid <= EG_RELAY_MAX + EG_BROKEN_TRIES, `4:97:4 forks (laid on try ${deep.laid})`);
  assert.ok(Math.min(...deep.steps.filter((q) => (q.road ?? 0) === 1).map((q) => q.z)) < Math.min(...deep.steps.filter((q) => !q.hd && (q.road ?? 0) === 0 && q.z > deep.fork.plate).map((q) => q.z), Infinity), 'its fork the first course along its way');
  const lean = L10(77, 37);
  assert.ok(lean.laid > EG_RELAY_MAX && lean.laid <= EG_RELAY_MAX + EG_BROKEN_TRIES, `77:37 on a try of the plan's own (${lean.laid})`);
  assert.ok(lean.fork, 'its courses whole - its fork among them');
});

test('EG-PERFECT THE BROKEN WAY (unit) - A FIGHT HALL\'S DOOR AND ITS CLOCKS: a Rift-Yard\'s (77:1, 77:14) and an Athenaeum\'s (77:13) rooms all before their trial, the door\'s bridge leaving the trial\'s ground; a Proving Walk\'s (77:3) rooms before its first course; the relay holds a law-10 Rift-Yard\'s clocks while its company stands on the arrival plate - no wave poured in 40 s - and its first wave pours once it stands on the court; law 9\'s poured from its wake (mutants: rooms after the trial; the door planned past rooms; the clocks never held)', () => {
  for (const h of [1, 13, 14, 3]) {
    const s = L10(77, h), R = s.route, rooms = s.rooms.map((q) => s.heroes[q.h]);
    const G = R.courses.filter((q) => !q.b), T = s.kind === 'proving' ? G[0] : G.find((q) => s.fight.x >= q.x0 - 1 && s.fight.x <= q.x1 + 1 && s.fight.z >= q.z0 - 1 && s.fight.z <= q.z1 + 1);
    const inT = (p) => p[0] >= T.x0 - 0.05 && p[0] <= T.x1 + 0.05 && p[2] >= T.z0 - 0.05 && p[2] <= T.z1 + 0.05 && p[1] >= T.y0 - 0.5 && p[1] <= T.y1 + 0.5;
    const inRoom = (p) => rooms.some((q) => p[0] >= q.box[0] - 0.05 && p[0] <= q.box[3] + 0.05 && p[2] >= q.box[2] - 0.05 && p[2] <= q.box[5] + 0.05 && p[1] >= q.box[1] - 0.5 && p[1] <= q.box[4] + 0.5);
    const first = R.main.findIndex((i) => inT(R.nodes[i])), last = R.main.findLastIndex((i) => inT(R.nodes[i]));
    assert.ok(first > 0 && s.rooms.length >= 1, `77:${h}: its way reaches its trial past rooms`);
    assert.ok(R.main.slice(first).every((i) => !inRoom(R.nodes[i])), `77:${h} (${s.kind}): no room past its trial`);
    if (s.kind !== 'proving') {
      assert.ok(R.main.length - 1 - last <= 1, `77:${h}: its door straight on from its trial`);
      // its closing (net/eliteGates/egBrain.js egClosingMs - the walk from its trial's end, a broken bridge's ground never taken for it) a few seconds past the fight's own
      const ms = egClosingMs(s);
      assert.ok(ms >= EG_CLOSING_FIGHT_MS && ms <= EG_CLOSING_FIGHT_MS + 6000, `77:${h}: a closing of ${ms} ms`);
    }
  }
  // the relay: a law-10 Rift-Yard's first wave waits for its company
  const yard = (egv) => {
    let s = 77;
    const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
    const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 77, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [], pr: 'rally' });
    B.egv = egv;
    let now = T0 + EG_SEALED_MS + 100;
    egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), 40, now);
    const spec = egHallOf(77, 1, 0, egv);
    B.h = 1; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
    let pos = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z, y: spec.arrive.y ?? 0 };
    const step = () => { now += 250; egStep(B, now, [{ sub: 'acct-0', ...pos, dead: false, at: now }], rng); };
    for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
    assert.equal(B.sg, 'trial', `law ${egv}: the yard woke`);
    for (let k = 0; k < 160; k++) step();   // 40 s on the arrival plate
    const early = egBodiesOf(B.F, EG_ROLE.add).length;
    pos = { sx: spec.x0 + spec.fight.x, z: spec.fight.z, y: spec.fight.y };
    for (let k = 0; k < 40; k++) step();   // 10 s on the court
    return { early, late: egBodiesOf(B.F, EG_ROLE.add).length };
  };
  assert.equal(egTrialAwaits(egHallOf(77, 1, 0, 10)), true);
  const w10 = yard(10), w9 = yard(9);
  assert.equal(w10.early, 0, 'law 10: no wave while its company walks its rooms');
  assert.ok(w10.late > 0, 'law 10: its first wave once its company stands on its court');
  assert.ok(w9.early > 0, 'law 9: its waves from its wake on the arrival plate');
});

test('EG-PERFECT THE BROKEN WAY (unit) - TWO KINDS AN APPROACH: a Court\'s (77:5), an Athenaeum\'s (77:13) and a Proving Walk\'s (77:3) approach run two kinds of its band\'s - the first circle a Drift and a Beat (mutants: one kind; the first circle still)', () => {
  for (const h of [5, 13, 3]) {
    const s = L10(77, h), first = s.route.courses.findIndex((g) => !g.b), g = s.route.courses[first];
    const steps = s.steps.filter((q) => !q.hd && (q.road ?? 0) === 0 && q.x >= g.x0 - 0.01 && q.x <= g.x1 + 0.01 && q.z >= g.z0 - 0.01 && q.z <= g.z1 + 0.01 && q.y >= g.y0 - 0.5 && q.y <= g.y1 + 0.5);
    const kinds = [];
    for (const q of steps) { const k = q.kind === 'riser' ? 'beat' : q.kind; if (kinds[kinds.length - 1] !== k) kinds.push(k); }
    assert.ok(kinds.length >= 2 && kinds[0] !== kinds[1], `77:${h}: ${kinds.join(', ')}`);
    if (s.c === 1) assert.deepEqual(kinds.slice(0, 2), ['drift', 'beat'], `77:${h}: the first circle's`);
  }
});

test('EG-PERFECT THE BROKEN WAY (unit) - THE PASSAGES, THE DROP, THE RAILS, THE PENDULUM: a law-10 passage\'s chasm at THE ENVELOPE\'s gaps (the Mist Stair\'s at its least), law 9\'s as it was; a Drop at its road\'s floor falls 3-4.5 m below it; a run of Rails apart through its travels, the Forge\'s one belt, travelling neighbours that meet refused; a Pendulum\'s whole flight asked (mutants: the chasm spread as before; the Drop stilled; each Rail its own period; the neighbour held still; the Pendulum at its middle)', () => {
  for (const kit of ['caverns', 'stacks', 'ossuary', 'deep', 'mist']) {
    const g10 = egFragPassage(kit, sdRng(3), { law: 10 }).course.map((q) => q.gap), g9 = egFragPassage(kit, sdRng(3), { law: 9 }).course.map((q) => q.gap);
    assert.ok(g10.every((v) => v >= EG_GAP_MIN_CM && v <= EG_GAP_MAX_CM) && (kit !== 'mist' || g10.every((v) => v === EG_GAP_MIN_CM)), `${kit}: ${g10}`);
    assert.ok(g9.every((v) => v < EG_GAP_MIN_CM), `${kit} (law 9): ${g9}`);
  }
  const S = egSpanOf(1, 1, 0, { r: sdRng(7), sizes: EG_STEP, start: { x: 0, y: 500, z: 0, r: 500 }, checkR: 300, floors: true, broken: true });
  S.run('drop', 1);
  assert.ok(S.lay()[0].kind === 'drop' && 500 - S.y >= EG_DROP_LAW10_CM && 500 - S.y <= EG_DROP_CM, 'a Drop below its floor');
  const R = egSpanOf(1, 1, 1, { r: sdRng(11), sizes: EG_STEP, start: { x: 0, y: 0, z: 0, r: 500 }, checkR: 300, floors: true, broken: true });
  R.run('rail', 3);
  const rails = R.lay();
  assert.ok(rails.every((q) => q.period === rails[0].period && q.gap === rails[0].gap && q.amp <= Math.floor((q.gap - EG_RAIL_CLEAR * 100) / 2)), 'one gap, one period, travel under half the gap less the clear');
  // PIN MOVED (THE AUDIT): half a cycle as the travel reads a phase - its angle, π (egPieceAt: sin(2πt/period + phase)); a
  // period's half in its own units stood 172-258 degrees apart
  assert.deepEqual(rails.map((q) => q.phase), [0, Math.round(Math.PI * 1000), 0], 'half a cycle apart');
  const at = (q, t) => egPieceAt({ ...q, period: q.period / 1000, phase: q.phase / 1000 }, t).dz;
  for (const t of [0, 1.3, 2.9]) assert.ok(Math.abs(at(rails[0], t) + at(rails[1], t) * (rails[0].amp / rails[1].amp)) < 1e-2 * rails[0].amp, `the two neighbours opposed at ${t} s`);
  for (const c of [egFragPassage('forge', sdRng(5), { law: 10 }).course.filter((q) => q.k === 'rail'), egSetPiece('forgeline', sdRng(5), { law: 10 }).course]) assert.ok(c.every((q) => q.period === c[0].period && q.phase === c[0].phase), 'the Forge\'s one belt');
  // travelling neighbours that meet (each on its own period), in metres
  const meet = [0, 1].map((k) => ({ i: k, kind: 'rail', span: 0, x: 0, y: 0, z: 2.6 + 1.5 + k * 5.6, w: 3, d: 3, amp: 1.5, period: 6 + k * 1.3, phase: k * 1.5, beat: 0, gap: 2.6, road: 0, kit: '', after: k ? 3 : 0 }));
  assert.ok(egSpanProof({ v: 10, steps: meet }).why.some((w) => /beside it - travelling/.test(w)), 'law 10 refuses neighbours that meet');
  assert.ok(!egSpanProof({ v: 9, steps: meet }).why.some((w) => /beside it - travelling/.test(w)), 'law 9 held the neighbour still');
  // a Pendulum's gap: the whole flight asked at law 10, its middle alone at law 9 - some launch the middle lets through
  const pend = { i: 0, kind: 'pend', span: 0, x: 0, y: 0, z: 2.8 + 1.3, w: 3, d: 2.6, amp: 0, period: 4, phase: 0.3, beat: 0, gap: 2.8, road: 0, kit: '', after: 2.6 };
  const [p] = egSpanPairs({ steps: [pend], law: 10 });
  const w10 = egPairWindows(p, egSpanBuildOf(10)), w9 = egPairWindows(p, egSpanBuildOf(9));
  assert.ok(w10.open < w9.open, `the whole flight open ${w10.open.toFixed(2)} s against its middle's ${w9.open.toFixed(2)} s`);
});

test('EG-PERFECT THE BROKEN WAY (unit) - THE FITTINGS: a law-10 chamber\'s alcove at its court\'s rim within reach, its ring open there; its balcony 4 m up; a Rampart\'s pillars (77:11) off its bastions with their Gauntlet plates on their tops, its winch plates against its walkway (mutants: the alcove past the rim; the ring shut; the balcony low; a pillar over a bastion; the plate on the stair; the winch plate adrift)', () => {
  const r = () => 0.5, Q = egFragChamber('caverns', r, 2400, { law: 10, play: 'balcony' }), Q9 = egFragChamber('caverns', r, 2400, { law: 9, play: 'balcony' });
  const a = Q.alcoves[0], ra = Math.hypot(a.x, a.z);
  assert.ok(ra > 2400 && ra - 2400 <= EG_ALCOVE_REACH_M * 100 - 35, `its alcove ${ra - 2400} cm past the rim`);
  assert.ok(Math.hypot(Q9.alcoves[0].x, Q9.alcoves[0].z) - 2400 > EG_ALCOVE_REACH_M * 100, 'law 9\'s out of reach');
  assert.ok(Q.floors.every((f) => f.y >= 400) && Q9.floors.every((f) => f.y < 400), 'a balcony 4 m up');
  const d = { x: 0, z: 0, r: 25.5, y: 0 }, al = [{ x: a.x / 100, z: a.z / 100, y: 0 }];
  const open = (sp) => Array.from({ length: EG_RING_WALL_SIDES }, (_, k) => egRingSideOpen(sp, d, k)).filter(Boolean).length;
  assert.ok(open({ law: 10, alcoves: al }) > open({ v: 9, alcoves: al }), 'its ring open at it');
  const s = L10(77, 11), s9 = egHallOf(77, 11, 0, 9);
  const over = (q) => { const B = q.discs.filter((x) => x.role === 'bastion'); return q.discs.filter((x) => x.role === 'pillar').filter((p) => B.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < b.r + p.r)).length; };
  assert.ok(over(s) === 0 && over(s9) > 0, `77:11: ${over(s)} pillars over bastions (law 9: ${over(s9)})`);
  for (const sp of s.spots.pillar) { const p = s.discs.find((x) => x.role === 'pillar' && Math.hypot(x.x - sp.x, x.z - sp.z) < 0.01); assert.ok(Math.hypot(sp.plate[0] - p.x, sp.plate[1] - p.z) <= p.r - 0.5, 'its plate on its top'); }
  // a winch: seed 77's first Winch Rampart (Hall 31)
  const w = L10(77, 31);
  assert.equal(w.variant, 'winch');
  for (const q of w.discs.filter((x) => x.role === 'winch')) assert.ok(Math.abs(Math.abs(q.x - w.walk.x) - q.r - w.walk.halfW) < 0.01, '77:31: its winch plate against the walkway');
});
