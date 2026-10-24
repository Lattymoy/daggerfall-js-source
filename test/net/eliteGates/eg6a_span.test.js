// EG6a (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 9, 10.1, 10.2 and 10.5): THE SPAN
// GENERATOR AND THE CROSSING'S BOUND - net/eliteGates/egSpanLaw.js egSpanOf draws every course of a hall off the hall's die, one a road,
// and courseOf lays them (net/eliteGates/egLaw.js layHall stands the hall about the generator's edge); spec laws 4 and 5 lay byte for
// byte the halls they laid before; every hall's road is a course courseOf lays from its own record, and egCourseOf reads it
// back as the Steps' readers take it; the crossing's lower bound (EG_CROSS_MIN) is the timed solver's fastest crossing at
// THE FAST BUILD - its waits counted, any piece within its jump leapt past - less 15%, a measure that gates nothing.
// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): every hall read below is spec law 8's, by name - one course a road, laid
// from the plate along +z, as egCourseOf reads it; a LAW 9 hall's courses stand along its way (test/net/eliteGates/law9_rooms.test.js reads them
// course by course - net/eliteGates/egLaw.js egAscentCourses).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egSpanOf, courseOf, egCourseOf, egFastCross, egFastCrossAt, egFastReach, egCrossMin, egJumpLands, egSpanPairs, egPairWindows, egDieBetween, egRoadCross,
  EG_FAST_RUN_MPS, EG_FAST_JUMP_X, EG_CROSS_SLACK, EG_JUMP_MPS, EG_JUMP_G, EG_SOLVE_STEP_S, EG_SOLVE_HORIZON_S, EG_BEAT_CYCLE_S,
  EG_GAP_MIN_CM, EG_GAP_MAX_CM, EG_RISER_CM, EG_BEAT_HALF_MS, EG_STEP_DOWN_CM, EG_DROP_CM } from '../../../src/net/eliteGates/egSpanLaw.js';
import * as egLaw from '../../../src/net/eliteGates/egLaw.js';
import { egCrossMinMs, egFairMeasure, egFairNew } from '../../../src/net/eliteGates/egFair.js';
import { sdRng } from '../../../src/net/superDungeon/sdBrain.js';
import { runSpeed } from '../../../src/player/motor.js';
import { jumpSpeedMultiplier, SKILLS, SKILL_COUNT } from '../../../src/systems/skills.js';
import { SD_RISER_H, SD_BEAT_HALF } from '../../../src/world/superDungeon/sdSteps.js';

const { egHallOf, egSpecDigest, EG_STEP } = egLaw;

test('EG6a THE SPAN GENERATOR (section 10.1): egSpanOf draws a hall\'s pieces off its die - the Steps\' timing at every depth, one riser a hall, Crumbles stepping down, every gap in the envelope - into one course spec a road, and courseOf lays them: the still ground the hall runs over between, its islands its checkpoints, the roads\' steps in the one count the hall laid them; its envelope is the hall law\'s and the Steps\' (mutants: courseOf\'s ground dropped; a piece\'s own x lost; the roads laid out of their count; a section\'s span forgotten; the riser twice; a crumble stepping up)', () => {
  // the envelope, one home: the hall law says the generator's numbers, the Steps' own pinned equal
  assert.deepEqual([egLaw.EG_GAP_MIN_CM, egLaw.EG_GAP_MAX_CM, egLaw.EG_RISER_CM, egLaw.EG_BEAT_HALF_MS, egLaw.EG_STEP_DOWN_CM, egLaw.EG_DROP_CM], [EG_GAP_MIN_CM, EG_GAP_MAX_CM, EG_RISER_CM, EG_BEAT_HALF_MS, EG_STEP_DOWN_CM, EG_DROP_CM]);
  assert.deepEqual([EG_GAP_MIN_CM, EG_GAP_MAX_CM, EG_STEP_DOWN_CM, EG_DROP_CM], [240, 320, 95, 450], 'THE ENVELOPE (section 10.4)');
  assert.deepEqual([EG_RISER_CM / 100, EG_BEAT_HALF_MS / 1000], [SD_RISER_H, SD_BEAT_HALF], 'the riser and the Beat\'s half are the Steps\'');
  const r = sdRng(0x6a6a);
  const S = egSpanOf(77, 2, 0, { r, sizes: EG_STEP, start: { x: 0, y: 0, z: 0, r: 500 }, checkR: 300 });
  S.run('drift', 2);
  const zi = S.check(S.gap());
  S.at(S.edge + 650, S.y);   // still ground run over (a court's bridge)
  S.run('beat', 5);          // a riser among five
  S.run('crumble', 2);       // back down
  S.road(1, { x: 1500, y: 0, z: zi, r: 300 });   // THE FORK's Low Road, from its island
  S.at(S.edge, -450);
  S.step('drop', S.gap(), { x: 1500, kit: 'caverns' });
  S.road(0);
  S.step('still', 240);
  S.at(S.edge, 120);         // the hall raises the road with no piece (a set piece's floor)
  S.check(250);              // and stands an island there: the checkpoint at that height
  const sum = (s) => [s.i, s.kind, s.span, s.x, s.y, s.z, s.gap, s.road, s.kit, s.amp, s.period, s.phase, s.beat];
  assert.deepEqual(S.lay().map(sum), [
    [0, 'drift', 0, 0, 0, 887, 267, 0, '', 168, 5100, 0, 0], [1, 'drift', 0, 0, 0, 1398, 271, 0, '', 181, 5300, 900, 0],
    [2, 'beat', 1, 0, 0, 3402, 264, 0, '', 0, 0, 0, 0], [3, 'beat', 1, 0, 0, 3952, 290, 0, '', 0, 0, 0, 1800],
    [4, 'riser', 1, 0, 230, 4212, 0, 0, '', 0, 0, 0, 0], [5, 'beat', 1, 0, 230, 4741, 269, 0, '', 0, 0, 0, 0],
    [6, 'beat', 1, 0, 230, 5303, 302, 0, '', 0, 0, 0, 1800], [7, 'crumble', 1, 0, 115, 5810, 247, 0, '', 0, 0, 0, 0],
    [8, 'crumble', 1, 0, 0, 6317, 247, 0, '', 0, 0, 0, 0], [9, 'drop', 1, 1500, -450, 2913, 255, 1, 'caverns', 0, 0, 0, 0],
    [10, 'still', 1, 0, 0, 6817, 240, 0, '', 0, 0, 0, 0],
  ], 'the hall\'s steps, in the one count it laid them (the Low Road\'s drop between the High Road\'s pieces)');
  const C = S.courses();
  assert.deepEqual(C.map((c) => ({ road: c.road, checkpoints: c.checkpoints, end: c.end, n: c.steps.length })), [
    { road: 0, checkpoints: [{ x: 0, y: 0, z: 0, r: 500 }, { x: 0, y: 0, z: 2058, r: 300 }, { x: 0, y: 120, z: 7497, r: 300 }], end: 7797, n: 10 },
    { road: 1, checkpoints: [{ x: 1500, y: 0, z: 2058, r: 300 }], end: 3213, n: 1 },
  ], 'one course a road: the arrival plate and the island its checkpoints; the Low Road from its own island');
  // fed through courseOf: each road's spec as said lays the very records the hall takes
  for (const [k, spec] of S.specs().entries()) assert.deepEqual(courseOf(spec).steps, C[k].steps);
  assert.equal(S.edge, 7797);
  // every gap the die drew is in the envelope; the riser's alone is nought
  for (const s of S.lay()) if (s.kind !== 'riser' && s.kind !== 'still') assert.ok(s.gap >= EG_GAP_MIN_CM && s.gap <= EG_GAP_MAX_CM, `${s.i}: ${s.gap}`);
  assert.equal(egDieBetween(() => 0.999999, 3, 5), 5);
  assert.equal(egDieBetween(() => 0, 3, 5), 3);
});

test('EG6a THE HALLS THE GENERATOR LAYS, BYTE FOR BYTE (section 22\'s law pin kept): spec laws 4 and 5 lay the 800 halls they laid before it, hashed whole; every hall\'s every road is a course courseOf lays from its own record - its gaps, its pieces\' tops and places, the ground run over between, its rises (mutants: the hall\'s steps laid apart from its courses; the end not run on to its goal; a road switched late)', () => {
  const hash = (law) => {
    let acc = 0x811c9dc5;
    for (const seed of [77, 0xbeef, 3, 12345]) for (const geo of [0, 4]) for (let h = 1; h <= 100; h++) acc = Math.imul(acc ^ egSpecDigest(egHallOf(seed, h, geo, law)), 0x01000193) >>> 0;
    return acc >>> 0;
  };
  assert.equal(hash(4), 1228307904, 'law 4, byte for byte (test/net/eliteGates/egz_frag.test.js\'s pin)');
  assert.equal(hash(5), 1301097644, 'law 5, byte for byte as it was laid before the generator');
  // the round trip: each road's course re-said as a courseOf spec lays its own steps again
  let roads = 0;
  for (const seed of [1, 46, 0xbeef]) for (let h = 1; h <= 100; h += 3) {
    const spec = egHallOf(seed, h, h % 9, 8);
    for (const road of [0, 1]) {
      const c = egCourseOf(spec, road);
      if (!c?.steps.length) continue;
      roads++;
      const st = c.checkpoints[0], sections = [{ span: c.steps[0].span, pieces: [] }];
      let edge = st.z + st.r, y = st.y, ci = 1;
      for (const s of c.steps) {
        while (ci < c.checkpoints.length && c.checkpoints[ci].z < s.z) {   // an island before this piece: its section closed
          const q = c.checkpoints[ci++], sec = sections[sections.length - 1];
          if (q.y !== y) { sec.pieces.push({ ground: 0, rise: q.y - y }); y = q.y; }
          sec.check = q.z - q.r - edge; edge = q.z + q.r;
          sections.push({ span: sec.span + 1, pieces: [] });
        }
        const sec = sections[sections.length - 1], near = s.z - s.d / 2 - s.gap;
        sec.span = s.span;
        if (Math.abs(near - edge) > 1e-9) sec.pieces.push({ ground: near - edge, rise: 0 });
        sec.pieces.push({ kind: s.kind, gap: s.gap, size: { w: s.w, d: s.d }, rise: s.y - y, x: s.x, i: s.i, kit: s.kit, amp: s.amp, period: s.period, phase: s.phase, beat: s.beat });
        edge = s.z + s.d / 2; y = s.y;
      }
      const laid = courseOf({ road, start: st, checkR: 3, toEnd: 0, sections }).steps;
      assert.equal(laid.length, c.steps.length);
      for (let k = 0; k < laid.length; k++) {
        const a = laid[k], b = c.steps[k];
        assert.deepEqual([a.i, a.kind, a.span, a.road, a.kit], [b.i, b.kind, b.span, b.road, b.kit], `seed ${seed} hall ${h} road ${road} step ${b.i}`);
        for (const f of ['x', 'y', 'z', 'w', 'd', 'gap']) assert.ok(Math.abs(a[f] - b[f]) < 1e-6, `seed ${seed} hall ${h} road ${road} step ${b.i}: ${f} ${a[f]} != ${b[f]}`);
      }
    }
  }
  assert.ok(roads > 60, `${roads} roads laid again`);
});

test('EG6a THE COURSE A READER TAKES (egCourseOf, section 10.1): a hall\'s road as the Steps\' readers take it - its steps the spec\'s of that road; its checkpoints where it begins (the arrival plate, the Low Road\'s island) and its islands; its end where it meets its goal (the end plate\'s edge, the Low Road\'s last step, a Court\'s ground\'s end); none for a road not laid (mutants: the Low Road begun on the plate; the end plate\'s middle; a road\'s steps mixed)', () => {
  const f = egHallOf(1, 7, 0, 8);
  assert.ok(f.fork, 'a forked span');
  const c0 = egCourseOf(f, 0), c1 = egCourseOf(f, 1);
  assert.deepEqual(c0.checkpoints[0], { x: f.arrive.x, y: 0, z: f.arrive.z, r: f.arrive.r }, 'the High Road begins on the arrival plate');
  assert.deepEqual(c0.checkpoints.slice(1), f.islands.filter((q) => q.road === 0).map((q) => ({ x: q.x, y: q.y, z: q.z, r: q.r })));
  assert.equal(c0.end, f.end.z - f.end.r, 'its goal the end plate\'s edge');
  assert.deepEqual(c0.steps, f.steps.filter((s) => s.road === 0));
  const isle = f.islands.find((q) => q.road === 1);
  assert.deepEqual(c1.checkpoints, [{ x: isle.x, y: isle.y, z: isle.z, r: isle.r }], 'the Low Road begins on its own island');
  const last = f.steps.filter((s) => s.road === 1).at(-1);
  assert.equal(c1.end, last.z + last.d / 2);
  assert.ok(c1.steps.every((s) => s.road === 1) && c1.steps.length === f.steps.filter((s) => s.road === 1).length);
  assert.equal(egCourseOf(f, 2), null, 'an alcove\'s side way is no road');
  const court = egHallOf(1, 10, 0, 8);
  assert.equal(court.kind, 'court');
  assert.equal(egCourseOf(court, 0).end, court.len, 'a Court\'s approach meets its lord\'s ground');
  assert.equal(egCourseOf(court, 1), null);
  // PIN MOVED (EG-HERO-LAY, spec law 7): a hero chamber laid in a Rift-Yard brings its own inner course - the yard's course is
  // its hero's pieces alone, inside its box
  const yard = egHallOf(1, 9, 0, 8), own = (s) => (yard.heroes ?? []).some((q) => s.z >= q.box[2] && s.z <= q.box[5]);
  assert.equal(yard.kind, 'yard');
  assert.deepEqual(egCourseOf(yard, 0).steps.filter((s) => !own(s)), [], 'a Rift-Yard lays no course of its own');
});

test('EG6a THE CROSSING\'S BOUND AT THE FAST BUILD (sections 10.2 and 10.5): THE FAST BUILD is the motor\'s - Speed 100, Running 100 with Fleetfoot III, Jumping 100 with the Jump spell and athleticism improved (2.3, a 2.68 m apex); its crossing waits for a timed piece it cannot leap and leaps past one it can; EG_CROSS_MIN is its fastest less 15%, never below the road\'s length at its run, the fair trail\'s measure (mutants: no wait counted; no leap past a piece; the bound at the span build; the slack lost; the Low Road\'s bridges unrun)', () => {
  assert.ok(Math.abs(EG_FAST_RUN_MPS - runSpeed(100, 100) * 1.1) < 1e-9, 'the fast build\'s run is the motor\'s, Fleetfoot III on it');
  const skills = new Array(SKILL_COUNT).fill(0);
  skills[SKILLS.Jumping] = 100;
  const fast = { career: { abilityFlagsAndSpellPointsBitfield: 0x1406 }, skills, _enchantMods: { improvedAthleticism: true }, activeEffects: [{ kind: 'jumping' }] };
  assert.ok(Math.abs(EG_FAST_JUMP_X - jumpSpeedMultiplier(fast)) < 1e-9, 'AcrobatMotor\'s multiplier at the fast build');
  assert.ok(Math.abs(EG_FAST_JUMP_X - 2.3) < 1e-9);
  assert.ok(Math.abs((EG_JUMP_MPS * EG_FAST_JUMP_X) ** 2 / (2 * EG_JUMP_G) - 2.68) < 0.005, 'a 2.68 m apex');
  assert.ok(Math.abs(egFastReach(0).air - (2 * EG_JUMP_MPS * EG_FAST_JUMP_X) / EG_JUMP_G) < 1e-9);
  assert.ok(egFastReach(0).reach > 14 && egFastReach(-4.5).reach > egFastReach(0).reach && egFastReach(2.6).reach > 0 && egFastReach(2.7).reach === 0);
  assert.equal(EG_CROSS_SLACK, 0.15);
  // a lone Beat it cannot leap past (ground 10 m before it, 11 m after - past its reach together): gone as it comes, it waits
  const beat = { i: 0, kind: 'beat', span: 0, x: 0, y: 0, z: 16.3, w: 3, d: 2.6, amp: 0, period: 0, phase: 0, beat: 0, gap: 10, road: 0, kit: '', after: 11 };
  const lone = { arrive: { x: 0, z: 0, r: 5 }, end: { x: 0, z: 40, r: 5 }, steps: [beat] };
  const floor = 40 / EG_FAST_RUN_MPS;
  const at = (spec, t0) => egFastCrossAt(spec, 0, t0);
  // a start whose landing falls in the Beat's gap: its arrival waits for the beat's return
  let late = null;
  for (let t0 = 0; t0 < EG_BEAT_CYCLE_S && late == null; t0 += 0.05) if (at(lone, t0) > floor + 0.5) late = t0;
  assert.ok(late != null, 'some start waits for the Beat');
  assert.ok(at(lone, late) <= floor + EG_BEAT_CYCLE_S, 'never more than a cycle');
  assert.ok(Math.abs(egFastCross(lone, 0) - floor) < 1e-6, 'its fastest start never waits: the road\'s length at the fast run');
  // a Beat 8 m on with a still step beyond it within the fast build's jump: it leaps past the Beat whenever it is gone, and
  // never waits; alone, the same Beat holds it at some start
  const near = { ...beat, z: 14.3, gap: 8, after: 11 }, still = { ...beat, i: 1, kind: 'still', z: 19.3, gap: 2.4, after: 2.4 };
  const alone = { ...lone, steps: [near] }, leap = { ...lone, steps: [{ ...near, after: 0 }, still] };
  assert.equal(egSpanPairs(leap).length, 3);
  let waited = 0, leapt = 0, starts = 0;
  for (let k = 0; k < 72; k++) { const t0 = k * 0.05; starts++; if (at(alone, t0) > floor + 0.1) waited++; if (Math.abs(at(leap, t0) - floor) < 1e-6) leapt++; }
  assert.ok(waited > 10, `alone, the Beat holds it (${waited} starts)`);
  assert.equal(leapt, starts, 'with a still step in reach beyond it, never: leapt past');
  // a leap DOWN past it: a Drop 18 m on, 4.5 m under - past the level reach (14.3 m), inside the falling one - is leapt from
  // the ground's height, never the Drop's
  const drop = { ...beat, i: 1, kind: 'drop', y: -4.5, z: 26, w: 6, d: 6, gap: 7.4, after: 2 };
  const down = { ...lone, end: { x: 0, z: 40, r: 5 }, steps: [{ ...near, after: 0 }, drop] };
  assert.ok(egFastReach(0).reach < 18 && egFastReach(-4.5).reach > 18);
  let downLeapt = 0;
  for (let k = 0; k < 72; k++) if (Math.abs(at(down, k * 0.05) - floor) < 1e-6) downLeapt++;
  assert.equal(downLeapt, 72, 'leapt down past the Beat at every start');
  // the Low Road crosses the trunk first: a Beat on the trunk holds it as it holds the High Road
  const forked = { arrive: { x: 0, z: 0, r: 5 }, end: { x: 0, z: 60, r: 5 }, fork: { x: 0, z: 31, lowX: 15 },
    steps: [beat, { ...beat, i: 1, kind: 'still', x: 15, z: 40, gap: 2.4, after: 3, road: 1 }] };
  const lowFloor = 60 / EG_FAST_RUN_MPS + 30 / EG_FAST_RUN_MPS;
  let trunkWait = 0;
  for (let k = 0; k < 72; k++) if (egFastCrossAt(forked, 1, k * 0.05) > lowFloor + 0.1) trunkWait++;
  assert.ok(trunkWait > 10, `the trunk's Beat holds the Low Road too (${trunkWait} starts)`);
  // the bound, and its measure
  assert.equal(egCrossMin(lone, 0), Math.round(floor * (1 - EG_CROSS_SLACK) * 1000));
  for (const [seed, h] of [[1, 7], [46, 8], [77, 2], [3, 18]]) {
    const spec = egHallOf(seed, h, 0, 8);
    for (const road of spec.fork ? [0, 1] : [0]) {
      const across = road === 1 ? (2 * Math.abs(spec.fork.lowX - spec.fork.x)) / EG_FAST_RUN_MPS : 0, len = (spec.end.z - spec.arrive.z) / EG_FAST_RUN_MPS;
      assert.ok(egFastCross(spec, road) >= len + across - 1e-9, `seed ${seed} hall ${h} road ${road}: never below its length at the fast run`);
      assert.ok(egFastCross(spec, road) < egRoadCross(spec, road).fast + len, 'faster than the span build');
      assert.equal(egCrossMinMs(spec, road), egCrossMin(spec, road), 'the fair trail\'s bound is the law\'s');
    }
  }
  const court = egHallOf(1, 10, 0, 8);
  assert.equal(egCrossMinMs(court), 0, 'a Court has no door to cross to');
  const spec = egHallOf(1, 7, 0, 8), A = { ...egFairNew(), span: 4000, cross: 9000, road: 1, blind: 0, cblind: 0 };
  assert.equal(egFairMeasure(A, spec)[1], Math.round(egCrossMin(spec, 1) / 100), 'the measure carries the bound');
  assert.ok(egCrossMin(spec, 1) > egCrossMin(spec, 0), 'the Low Road\'s bridges across and back run too');
});

test('EG6a egJumpLands IS THE SOLVER\'S OWN ANSWER (the sweep\'s pilot launches inside its windows): its landing launches over the horizon are each pair\'s open share (mutants: another answer than the windows\')', () => {
  const spec = egHallOf(46, 8, 1, 8);
  let pairs = 0;
  for (const pair of egSpanPairs(spec)) {
    const w = egPairWindows(pair), n = Math.round(EG_SOLVE_HORIZON_S / EG_SOLVE_STEP_S);
    let open = 0;
    for (let k = 0; k < n; k++) if (egJumpLands(pair, k * EG_SOLVE_STEP_S)) open++;
    assert.ok(Math.abs(open * EG_SOLVE_STEP_S - w.open) < 1e-9);
    if (w.open < EG_SOLVE_HORIZON_S) pairs++;
  }
  assert.ok(pairs >= 2, 'some timed pairs');
});
