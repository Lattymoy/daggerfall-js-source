// EG-FULL (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 7, 9, 11, 12, 13 and 14): THE
// SPIRE'S WHOLE LAW (net/eliteGates/egLaw.js, net/eliteGates/egShape.js) - the four bands and their Brinks, the circle's plan with its variants'
// memory and its twists, the lords drawn by band with a Valkynaz every fifth Court, the nineteen decrees and the span
// decrees folded into the ground, every ground laid inside the wire's bound at every geo; and THE SHAPES every blow is
// stamped in - the stamps' bounds, the wind-up floor at THE ESCAPE BUILD's run, the width rule, the verdict on the struck
// screen, THE UNION FLOOR and THE TELEGRAPH BUDGET.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egBandOfCircle, egBandOfHall, egFirstHallOf, egCirclePlan, egCircleOf, egVariantsOf, egBossOf, egHallOf, egCircleSpecs, egGeoOf, egOnFight, egOnArrive, egAtDoor, egIsCourt,
  lawIsqrt, EG_BANDS, EG_BRINK_HALLS, EG_VARIANTS, EG_TWISTS, EG_TWIST_ON, EG_LORDS, EG_BAND_LORDS, EG_VALKYNAZ, EG_DECREES, EG_DECREE_FAMILIES, EG_DECREE_BY_KEY, EG_HALL_LEN_MAX,
  EG_BAND_PIECES } from '../../../src/net/eliteGates/egLaw.js';
import { egStampOk, egInShape, egInBlow, egEscapeM, egWidthOk, egWindupFloorMs, egFloorWindup, egBlowOf, egBlowVerdict, egShapeOrder, shDisc, shLane, shCone, shRing, shAll, shOut,
  EG_ESCAPE_MPS, EG_REACT_S, EG_WIDTH_MIN, EG_SHAPES_DRAWN_MAX } from '../../../src/net/eliteGates/egShape.js';
import { egUnionHolds } from '../../../src/net/eliteGates/egFloor.js';   // PIN MOVED: EG-H1 moved THE UNION FLOOR to net/eliteGates/egFloor.js, where the page says it lives - its law unchanged
import { runSpeed } from '../../../src/player/motor.js';
import { GATE_COURT_BOUND } from '../../../src/net/wire.js';
import { EG_FRAG_PIECES } from '../../../src/net/eliteGates/egFragLaw.js';

const SEEDS = [77, 5, 0xbeef, 0x7fffffff, 12345];

test('EG-FULL THE BANDS AND THE BRINKS (section 7): circles 1-5 the Broken Galleries, 6-10 the Soul Cairn, 11-15 the Shade Perilous, the Havoc Wellhead from 16; a hall\'s band its circle\'s; the Brinks open circles 6, 11 and 16 and no other (mutants: a band off by a circle; a Brink at circle 21)', () => {
  assert.equal(EG_BANDS.length, 4);
  const want = (c) => (c <= 5 ? 0 : c <= 10 ? 1 : c <= 15 ? 2 : 3);
  for (let c = 1; c <= 40; c++) {
    assert.equal(egBandOfCircle(c), want(c), `circle ${c}`);
    assert.equal(egBandOfHall(egFirstHallOf(c)), want(c));
    assert.equal(egBandOfHall(egFirstHallOf(c) + 4), want(c));
  }
  assert.deepEqual([...EG_BRINK_HALLS], [egFirstHallOf(6), egFirstHallOf(11), egFirstHallOf(16)]);
  for (const seed of SEEDS) for (let c = 1; c <= 30; c++) assert.equal(egCircleOf(seed, c)[0] === 'brink', c === 6 || c === 11 || c === 16, `seed ${seed} circle ${c}`);
});

test('EG-FULL THE VARIANTS\' MEMORY (section 9): every Yard and Rampart draws a variant its band has unlocked, never one of its kind\'s last min(2, unlocked - 1) draws (the first circle\'s Rift-Yard and Siege-Walk remembered), and a circle\'s two halls of one kind never share one; every variant is drawn somewhere (mutants: the memory forgotten; a band-locked variant drawn early)', () => {
  const drawn = new Set();
  for (const seed of SEEDS) {
    const last = { yard: ['riftyard'], rampart: ['siege'] };
    for (let c = 2; c <= 40; c++) {
      const plan = egCirclePlan(seed, c), band = egBandOfCircle(c);
      for (const i of [0, 3]) {
        const { kind, variant } = plan[i];
        if (kind === 'brink') continue;
        const open = egVariantsOf(kind, band);
        assert.ok(open.includes(variant), `${variant} is ${kind}'s in band ${band}`);
        const mem = Math.min(2, open.length - 1);
        if (open.length > 2) assert.ok(!last[kind].slice(-mem).includes(variant), `seed ${seed} circle ${c}: ${variant} repeats within ${mem}`);
        last[kind] = [...last[kind], variant].slice(-4);
        drawn.add(variant);
      }
      if (plan[0].kind === plan[3].kind) assert.notEqual(plan[0].variant, plan[3].variant, `circle ${c}'s two ${plan[0].kind}s`);
    }
  }
  for (const v of [...EG_VARIANTS.yard, ...EG_VARIANTS.rampart]) assert.ok(drawn.has(v), `${v} drawn`);
  assert.deepEqual(egVariantsOf('yard', 0).slice(0, 2), ['riftyard', 'wellspring']);
  assert.ok(egVariantsOf('yard', 0).length < egVariantsOf('yard', 3).length, 'deeper bands unlock more');
});

test('EG-FULL THE TWISTS (section 8.7): none in the first circle; never on a Court or a Brink, never two halls running, at most one Dagon\'s Bargain a circle, each on a kind it may ride; about one hall in four (mutants: a twisted Court; two twists running; two Bargains)', () => {
  let elig = 0, twisted = 0;
  const seen = new Set();
  for (const p of egCirclePlan(9, 1)) assert.equal(p.twist, null);
  for (const seed of SEEDS) {
    for (let c = 2; c <= 40; c++) {
      const plan = egCirclePlan(seed, c);
      let bargains = 0;
      plan.forEach((p, i) => {
        if (p.kind === 'court' || p.kind === 'brink') { assert.equal(p.twist, null, `a ${p.kind} twisted`); return; }
        elig++;
        if (!p.twist) return;
        twisted++; seen.add(p.twist);
        assert.ok(EG_TWISTS.includes(p.twist));
        assert.ok(EG_TWIST_ON[p.twist].includes(p.kind) || p.twist === 'scriptorium', `${p.twist} on a ${p.kind}`);
        if (i > 0) assert.equal(plan[i - 1].twist, null, `two twists running in circle ${c}`);
        if (p.twist === 'bargain') bargains++;
      });
      assert.ok(bargains <= 1);
    }
  }
  const share = twisted / elig;
  assert.ok(share > 0.1 && share < 0.35, `a twist in ${(share * 100).toFixed(0)}% of halls`);
  assert.ok(seen.size >= 6, 'most twists drawn');
});

test('EG-FULL THE LORDS (section 13.3): the first circle\'s Grath; every fifth Court a Valkynaz (Ilthys, Morvayn, Seyth, Garoth and Garoth after); every other drawn from its band\'s lords and the bands before, never one of the last min(2, pool - 1) drawn; all thirteen meet a company somewhere (mutants: a Wellhead lord in the Galleries; a lord twice running)', () => {
  assert.equal(Object.keys(EG_LORDS).length, 13);
  const met = new Set();
  for (const seed of SEEDS) {
    assert.equal(egBossOf(seed, 1), 'hound');
    assert.deepEqual([5, 10, 15, 20, 25, 30].map((c) => egBossOf(seed, c)), [...EG_VALKYNAZ, 'garoth', 'garoth']);
    const drawn = [];
    for (let c = 1; c <= 40; c++) {
      const L = egBossOf(seed, c);
      met.add(L);
      assert.ok(EG_LORDS[L], L);
      assert.equal(egHallOf(seed, egFirstHallOf(c) + 4).lord, L, 'the Court\'s spec names it');
      if (c % 5 === 0 || c === 1) continue;
      const band = egBandOfCircle(c), pool = EG_BAND_LORDS.slice(0, band + 1).flat();
      assert.ok(pool.includes(L), `${L} in circle ${c}'s pool`);
      const mem = Math.min(2, pool.length - 1);
      if (drawn.length) assert.ok(!drawn.slice(-mem).includes(L), `seed ${seed}: ${L} again at circle ${c}`);
      drawn.push(L);
    }
  }
  for (const L of Object.keys(EG_LORDS)) assert.ok(met.has(L), `${L} met`);
});

test('EG-FULL THE DECREES (section 12): twenty, numbered 0-19 once each, five families; the span decrees fold into the ground as one number (Gale-Swept\'s rank and three times Crumbling\'s) (mutants: a decree numbered twice; the fold swapped)', () => {
  // PIN MOVED (AUDIT EG V, a1: L2-10 built THE FRAYING, the twentieth - the ground's, numbered 19)
  assert.equal(EG_DECREES.length, 20);
  assert.deepEqual(EG_DECREES.map((d) => d.id), Array.from({ length: 20 }, (_, i) => i));
  assert.deepEqual([EG_DECREES[19].key, EG_DECREES[19].fam], ['fraying', 'ground']);
  assert.equal(EG_DECREE_FAMILIES.length, 5);
  for (const d of EG_DECREES) { assert.ok(EG_DECREE_FAMILIES.includes(d.fam), d.key); assert.equal(EG_DECREE_BY_KEY[d.key], d); }
  const g = EG_DECREE_BY_KEY.gale.id, cr = EG_DECREE_BY_KEY.crumbling.id;
  assert.equal(egGeoOf([]), 0);
  assert.equal(egGeoOf([[g, 1]]), 1);
  assert.equal(egGeoOf([[g, 2], [cr, 1]]), 5);
  assert.equal(egGeoOf([[cr, 2], [EG_DECREE_BY_KEY.pack.id, 1]]), 6);
});

test('EG-FULL EVERY GROUND, EVERY GEO (sections 11 and 13.3): over seeds, twenty circles and the span decrees\' grounds, every hall runs no longer than EG_HALL_LEN_MAX inside the gate\'s bound, has its arrival plate, its door (a Court none), its foe on its fight floor, every spot inside the bound; a span\'s pieces its band\'s (Gale-Swept adding gusts); the same bytes asked twice (mutants: a lord\'s ground off its floor; a gale with no gust)', () => {
  let n = 0;
  for (const seed of [77, 0xbeef, 3]) {
    for (let c = 1; c <= 20; c++) {
      for (const geo of [0, 1, 2, 4, 8]) {
        for (const s of egCircleSpecs(seed, c, geo)) {
          n++;
          assert.ok(s.len <= EG_HALL_LEN_MAX, `hall ${s.h} geo ${geo}: ${s.len} m`);
          assert.ok(s.arrive && egOnArrive(s, s.arrive.x, s.arrive.z), `hall ${s.h}'s arrival plate`);
          if (egIsCourt(s.h)) assert.equal(s.end, null); else assert.ok(s.end && egAtDoor(s, s.end.x, s.end.z), `hall ${s.h}'s door`);
          if (s.foe && s.fl?.length) assert.ok(egOnFight(s, s.foe.x, s.foe.z), `hall ${s.h} (${s.kind}/${s.lord ?? s.variant ?? ''}): its foe off its floor`);
          for (const list of Object.values(s.spots ?? {})) for (const p of list) assert.ok(Math.abs(p.x) <= GATE_COURT_BOUND && Math.abs(p.z) <= GATE_COURT_BOUND, `a spot out of bounds in hall ${s.h}`);
          if (s.kind === 'span') {
            const allowed = new Set([...EG_BAND_PIECES[s.band], 'still', 'ledge', ...(geo % 3 ? ['gust'] : []), ...(geo >= 3 ? ['crumble'] : [])]);
            // LAYER THREE: a fragment's inner course lays its own pieces (net/eliteGates/egFragLaw.js EG_FRAG_PIECES), the rest the band's
            for (const st of s.steps) assert.ok(st.kit ? EG_FRAG_PIECES[st.kit]?.includes(st.kind) : allowed.has(st.kind), `a ${st.kind} in band ${s.band}'s span${st.kit ? ` (${st.kit})` : ''}`);
            if (geo % 3) assert.ok(s.steps.some((st) => st.kind === 'gust') || s.walk?.some?.((w) => w.kind === 'gust') || JSON.stringify(s).includes('gust'), `Gale-Swept lays a gust in hall ${s.h}`);
          }
        }
      }
    }
  }
  assert.equal(n, 3 * 20 * 5 * 5);
  assert.equal(egHallOf(77, 12, 4), egHallOf(77, 12, 4));
  assert.notEqual(JSON.stringify(egHallOf(77, 2, 0)), JSON.stringify(egHallOf(77, 2, 1)), 'a decree changes the ground');
});

test('EG-FULL THE LAW\'S SQUARE ROOT: lawIsqrt is the floor of the square root in integers alone, exact past the doubles\' comfortable range (mutants: a float root)', () => {
  const big = (n) => { if (n < 2n) return n; let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; };
  let s = 12345;
  for (let k = 0; k < 2000; k++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const n = (s % 100_000) * (s % 90_000) + (s % 7);
    assert.equal(lawIsqrt(n), Number(big(BigInt(n))), `isqrt(${n})`);
  }
  assert.deepEqual([lawIsqrt(0), lawIsqrt(-4), lawIsqrt(1), lawIsqrt(15), lawIsqrt(16)], [0, 0, 1, 3, 4]);
});

test('EG-FULL THE STAMPS AND THE WIND-UP FLOOR (section 13.2): the six stamps bounded on the wire; each one\'s inside; THE ESCAPE BUILD\'s run is the motor\'s at Speed 40 and Running 20; every aimed blow\'s wind-up lengthened to its escape at that run plus the reaction, never shortened, a CHECK\'s untouched; THE WIDTH RULE (mutants: a NaN stamp; the floor shortening; a CHECK floored)', () => {
  assert.ok(Math.abs(EG_ESCAPE_MPS - runSpeed(40, 20)) < 1e-9, 'the escape build\'s run is the motor\'s');
  for (const s of [shDisc(0, 10, 3), shLane(0, 0, 0, 20, 4), shCone(0, 0, 0.5, 8, 90), shRing(0, 30, 4, 12), shAll(), shOut([[0, 30, 4], [10, 30, 3]])]) assert.ok(egStampOk(s), JSON.stringify(s));
  for (const bad of [['d', NaN, 0, 3], ['d', 0, 999, 3], ['d', 0, 0, 0], ['l', 0, 0, 1, 1], ['r', 0, 0, 12, 4], ['q', 1], ['h', 0, 0], ['a', 1], null]) assert.equal(egStampOk(bad), false, JSON.stringify(bad));
  assert.ok(egInShape(shDisc(0, 10, 3), 0, 12.9) && !egInShape(shDisc(0, 10, 3), 0, 13.1));
  assert.ok(egInShape(shLane(0, 0, 0, 20, 4), 1.9, 10) && !egInShape(shLane(0, 0, 0, 20, 4), 2.1, 10));
  assert.ok(egInShape(shCone(0, 0, 0, 8, 90), 0, 7) && !egInShape(shCone(0, 0, 0, 8, 90), 0, -2) && !egInShape(shCone(0, 0, 0, 8, 90), 7, 1));
  assert.ok(egInShape(shRing(0, 30, 4, 12), 0, 38) && !egInShape(shRing(0, 30, 4, 12), 0, 31));
  assert.ok(!egInShape(shOut([[0, 30, 4]]), 0, 31) && egInShape(shOut([[0, 30, 4]]), 0, 40), 'a haven is safe');
  for (const s of [shDisc(0, 0, 6), shLane(0, 0, 0, 30, 5), shCone(0, 0, 0, 12, 60), shRing(0, 0, 3, 11)]) {
    const floor = egWindupFloorMs(s);
    assert.ok(floor >= (egEscapeM(s) / EG_ESCAPE_MPS + EG_REACT_S) * 1000 - 1e-6, JSON.stringify(s));
    assert.equal(egFloorWindup(100, [s]), floor, 'a short wind-up lengthened');
    assert.equal(egFloorWindup(floor + 900, [s]), floor + 900, 'a long one kept');
  }
  assert.equal(egFloorWindup(100, [shAll()], true), 100, 'a CHECK keeps its own');
  assert.equal(egFloorWindup(100, [shDisc(0, 0, 6)], true), 100, 'an aimed CHECK too (its errand\'s floor is the brain\'s)');
  assert.equal(egBlowOf({ i: 1, s: [shDisc(0, 0, 6)], at: 5000, wu: 100, p: 0.2 }).wu, egWindupFloorMs(shDisc(0, 0, 6)));
  assert.equal(egWidthOk(shLane(0, 0, 0, 30, EG_WIDTH_MIN)), true);
  assert.equal(egWidthOk(shLane(0, 0, 0, 30, EG_WIDTH_MIN - 1)), false);
});

test('EG-FULL THE VERDICT, THE UNION FLOOR AND THE TELEGRAPH BUDGET (sections 13.2, 21 and 25.4): a blow waits until it lands, strikes a member inside it at the landing, misses one outside, and lets pass a landing met too late; a new blow that with the pending ones would leave a member no floor is held, one that leaves a way is not; a screen draws at most EG_SHAPES_DRAWN_MAX, the blows over my feet first (mutants: a blow judged early; the union floor never holding; the budget drawing far blows first)', () => {
  const b = egBlowOf({ i: 1, s: [shDisc(0, 10, 3)], at: 10_000, wu: 2000, p: 0.2 });
  assert.equal(egBlowVerdict(b, 0, 10, 9_999), 'wait');
  assert.equal(egBlowVerdict(b, 0, 10, 10_000), 'hit');
  assert.equal(egBlowVerdict(b, 0, 20, 10_000), 'wait', 'outside it at the landing\'s first instant: still landing');
  assert.equal(egBlowVerdict(b, 0, 20, 10_001), 'miss');
  assert.equal(egBlowVerdict(b, 0, 10, 10_000 + 2000), 'miss', 'met too late, it passes');
  const onFloor = (x, z) => Math.hypot(x, z) <= 10;
  const all = egBlowOf({ i: 2, s: [shDisc(0, 0, 10.5)], at: 3000, wu: 3000, p: 0.2 });
  assert.equal(egUnionHolds([], all, 0, 0, 0, onFloor), true, 'the whole floor at once leaves nowhere');
  const half = egBlowOf({ i: 3, s: [shLane(-10, 0, 10, 0, 6)], at: 4000, wu: 4000, p: 0.2 });
  assert.equal(egUnionHolds([], half, 0, 0, 0, onFloor), false, 'a lane leaves a way out');
  const ring = egBlowOf({ i: 4, s: [shRing(0, 0, 3, 11)], at: 4500, wu: 4500, p: 0.2 });
  const core = egBlowOf({ i: 5, s: [shDisc(0, 0, 3.5)], at: 4600, wu: 4600, p: 0.2 });
  assert.equal(egUnionHolds([ring], core, 0, 0, 0, onFloor), true, 'a ring then its core, too close together, held');
  const late = egBlowOf({ i: 6, s: [shDisc(0, 0, 3.5)], at: 12_000, wu: 12_000, p: 0.2 });
  assert.equal(egUnionHolds([ring], late, 0, 0, 0, onFloor), false, 'the core long after the ring: time to step back in');
  const many = Array.from({ length: 40 }, (_, i) => egBlowOf({ i: i + 10, s: [shDisc(i * 2, 50, 2)], at: 5000 + i, wu: 2000, p: 0.1 }));
  const mine = egBlowOf({ i: 99, s: [shDisc(0, 0, 3)], at: 9000, wu: 2000, p: 0.1 });
  const order = egShapeOrder([...many, mine], [0, 0], 0);
  assert.equal(order.length, EG_SHAPES_DRAWN_MAX);
  assert.equal(order[0], mine, 'the blow over my feet first');
  assert.ok(egInBlow(mine, 0, 0));
});
