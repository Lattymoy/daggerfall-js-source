// AUDIT EG III (2026-10-13; bible/11-Multiplayer/Elite-Gates.md sections 8.5, 11.4, 14 and 22) - THE LAW GROUP, lane 1 #14:
// SPEC LAW 6, THE SPAN DECREES ON EVERY SPAN. Gale-Swept and Crumbling Halls touched a Span's High Road alone - never a Proving
// Walk, never THE FORK's Low Road - and at rank II laid one longer section where the page says two. Law 6 (net/eliteGates/egLaw.js
// EG_DECREE_LAW) lays them on every span: a Span's road, both of THE FORK's roads, a Proving Walk's second span (the one to
// its door); a section a rank, each Gust section on its island, each Crumble section laid straight on from the ground before
// it (no island of its own: one island fewer than a section brings). Laws 4 and 5 are kept byte for byte (THE LAW PIN, section
// 22), every hall of law 6 stays inside EG_HALL_LEN_MAX, and the solver proves every course it lays.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCirclePlan, egFirstHallOf, egSpecDigest, EG_SPEC, EG_DECREE_LAW, EG_HALL_LEN_MAX, EG_RELAY_MAX, egGeoOf, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { EG_LAWS, EG_LAW_KEEP_DAYS, egLawKnown } from '../../../src/net/eliteGates/egDurable.js';
import { egSpanProof } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egBreachNew, egStateOf } from '../../../src/net/eliteGates/egBrain.js';

/** The 800 halls THE LAW PIN hashes (test/net/eliteGates/egz_frag.test.js, test/net/eliteGates/eg6a_span.test.js): four seeds, two grounds, a hundred halls. */
const hash = (law) => {
  let acc = 0x811c9dc5;
  for (const seed of [77, 0xbeef, 3, 12345]) for (const geo of [0, 4]) for (let h = 1; h <= 100; h++) acc = Math.imul(acc ^ egSpecDigest(egHallOf(seed, h, geo, law)), 0x01000193) >>> 0;
  return acc >>> 0;
};
/** The traverses and Proving Walks of `seeds` over circles `c0`..`c1`, each `{ seed, h, c, spec }` at ground 0 (its kind). */
function spans(seeds, c0, c1) {
  const out = [];
  for (const seed of seeds) for (let c = c0; c <= c1; c++) {
    const plan = egCirclePlan(seed, c);
    for (let s = 1; s <= 4; s++) if (plan[s - 1].kind === 'span' || plan[s - 1].kind === 'proving') out.push({ seed, c, h: egFirstHallOf(c) + s - 1 });
  }
  return out;
}
/** Hall `spec`'s steps and islands on road `road` as one course in order: `['gust', ...]`, an island `'|'`. */
function course(spec, road, from = -Infinity, to = Infinity) {
  const ev = [];
  for (const s of spec.steps) if ((s.road ?? 0) === road && s.z > from && s.z < to) ev.push([s.z - s.d / 2, s.kind]);
  for (const q of spec.islands) if ((q.road ?? 0) === road && q.z > from && q.z < to) ev.push([q.z - q.r, '|']);
  return ev.sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}
/** A course's runs of `kind` (an island, or any other piece, ends a run): their lengths. */
function runs(ev, kind) {
  const out = [];
  let n = 0;
  for (const e of [...ev, '|']) { if (e === kind) n++; else if (n) { out.push(n); n = 0; } }
  return out;
}
/** Does every run of `kind` in the course begin on an island (an island just before it)? */
const onIsles = (ev, kind) => ev.every((e, k) => e !== kind || ev[k - 1] === kind || ev[k - 1] === '|');
/** The span decrees' ground (net/eliteGates/egLaw.js egGeoOf - Gale-Swept's rank and Crumbling Halls'). */
const geoOf = (gale, crumbling) => egGeoOf([...(gale ? [[EG_DECREE_BY_KEY.gale.id, gale]] : []), ...(crumbling ? [[EG_DECREE_BY_KEY.crumbling.id, crumbling]] : [])]);
/** A Proving Walk's court (its fight disc) - the span before it and the span after it. EG-HERO-LAY (spec law 7): or a hero
 *  chamber laid at the court's slot - its own floors, from its mouth to its far wall (net/eliteGates/egLaw.js `heroes`). */
const courtOf = (spec) => {
  const d = spec.discs.find((x) => x.role === 'court');
  if (d) return d;
  const q = (spec.heroes ?? []).find((x) => x.cls === 'chamber');
  return q ? { z: (q.box[2] + q.box[5]) / 2, r: (q.box[5] - q.box[2]) / 2 } : undefined;
};

test('AUDIT EG III LAW 6 - THE LAW PIN (section 22): spec law 6 is the law, laws 4 and 5 kept beside it their seven days each, byte for byte (their 800 halls hashed whole); law 6 laid byte for byte as this audit laid it; a hall of no span decree is law 5\'s whole but its number; a breach opened records law 6, and one of law 5 draws law 5\'s halls (mutants: law 6 not in the table; the law before forgotten; law 6 laid on plain ground)', () => {
  // PIN MOVED (EG-HERO-LAY): spec law 7 (the heroes laid) is the build's law now, law 6 kept beside it its seven days and still
  // laid byte for byte as this audit laid it (test/net/eliteGates/eghero_lay.test.js pins law 7). PIN MOVED (AUDIT EG V, f): spec law 8 (the ways
  // laid) is the build's law, laws 4 to 7 kept beside it (test/net/eliteGates/egaudit5_f.test.js pins law 8). PIN MOVED (THE ASCENT - THE ROOMS,
  // 2026-10-16): spec law 9 (the hall a way of rooms) is the build's law, laws 4 to 8 kept beside it (test/net/eliteGates/law9_rooms.test.js)
  // PIN MOVED (EG-PERFECT, 2026-10-18): spec law 10 (THE BROKEN WAY) is the build's law, laws 4 to 9 kept beside it
  // (test/net/eliteGates/egperfect_broken.test.js pins law 10)
  assert.deepEqual([EG_SPEC, EG_DECREE_LAW], [10, 6]);
  assert.deepEqual({ ...EG_LAWS }, { 4: '2026-10-11', 5: '2026-10-12', 6: '2026-10-13', 7: '2026-10-13', 8: '2026-10-15', 9: '2026-10-16', 10: '2026-10-18' });
  assert.deepEqual([4, 5, 6, 7, 8, 9, 10, 3].map(egLawKnown), [true, true, true, true, true, true, true, false]);
  const days = (a, b) => (Date.parse(EG_LAWS[b]) - Date.parse(EG_LAWS[a])) / 86_400_000;
  assert.ok(days(4, 6) <= EG_LAW_KEEP_DAYS && days(5, 6) <= EG_LAW_KEEP_DAYS, 'every law before inside its keep');
  assert.equal(hash(4), 1228307904, 'law 4, byte for byte');
  assert.equal(hash(5), 1301097644, 'law 5, byte for byte');
  assert.equal(hash(6), 201408482, 'law 6, as this audit laid it');
  // plain ground (no span decree): law 6 lays law 5's hall, its number aside
  for (const h of [2, 7, 8, 12, 13, 26, 41, 63, 88]) {
    const a = egHallOf(77, h, 0, 5), b = egHallOf(77, h, 0, 6);
    assert.equal(JSON.stringify({ ...b, v: 5 }), JSON.stringify(a), `hall ${h}: law 6 on plain ground is law 5's`);
  }
  // the director: a breach opened now is of the build's law (PIN MOVED, EG-HERO-LAY: law 7; AUDIT EG V, f: law 8; THE ASCENT:
  // law 9; EG-PERFECT: law 10), one of law 6 draws law 6's halls, and one of law 5 law 5's (its stage's digest)
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'a', o: 'A', ew: 0, rh: 0, seed: 77, op: 1_800_000_000_000, co: [['a', 'A', 1]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  assert.equal(B.egv, 10, 'the breach records the law it opened under');
  B.h = 2;
  assert.equal(egStateOf(B, 1_800_000_000_000).dg, egSpecDigest(egHallOf(77, 2, 0, 10)));
  B.egv = 6;
  assert.equal(egStateOf(B, 1_800_000_000_000).dg, egSpecDigest(egHallOf(77, 2, 0, 6)), 'law 6\'s breach, law 6\'s hall');
  B.egv = 5;
  assert.equal(egStateOf(B, 1_800_000_000_000).dg, egSpecDigest(egHallOf(77, 2, 0, 5)), 'law 5\'s breach, law 5\'s hall');
});

test('AUDIT EG III LAW 6 - EVERY SPAN CARRIES THE DECREES (section 14: "every span (a Span\'s, a Proving Walk\'s) carries a Gust section ... two Gust sections"): Gale-Swept lays a Gust section a rank on every road of a Span - THE FORK\'s Low Road too - and on a Proving Walk\'s second span, each on its island, two pieces each at rank II; in the Galleries (no Gust of their own) exactly so; law 5 laid none on a Proving Walk or a Low Road and one at rank II (mutants: the Low Road\'s sections dropped; the Proving Walk\'s second span its own run; rank II one section; a Gust section with no island)', () => {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): the decrees' sections read along a course laid from the plate along +z
  // - spec law 8's line (laws 6 to 8 lay the decrees alike); a LAW 9 hall's courses stand along its way (test/net/eliteGates/law9_rooms.test.js)
  let walks = 0, lows = 0, highs = 0;
  for (const { seed, h } of spans([1, 2, 3, 5, 8, 13], 2, 12)) for (const gale of [1, 2]) {
    const spec = egHallOf(seed, h, geoOf(gale, 0), 8), galleries = spec.band === 0;
    const roads = spec.kind === 'proving' ? [course(spec, 0, courtOf(spec).z + courtOf(spec).r)] : spec.fork ? [course(spec, 0), course(spec, 1)] : [course(spec, 0)];
    for (const ev of roads) {
      const R = runs(ev, 'gust');
      if (galleries) {
        assert.equal(R.length, gale, `seed ${seed} hall ${h} (${spec.kind}${spec.fork ? ', forked' : ''}) Gale-Swept ${gale}: a Gust section a rank - ${ev.join(' ')}`);
        assert.ok(R.every((n) => (gale === 2 ? n === 2 : n >= 2 && n <= 3)), `its sections' pieces: ${R}`);
        assert.ok(onIsles(ev, 'gust'), `each on its island: ${ev.join(' ')}`);
      } else assert.ok(R.length >= gale, `seed ${seed} hall ${h}: at least a Gust section a rank`);
    }
    if (spec.kind === 'proving') walks++; else if (spec.fork) { lows++; highs++; } else highs++;
    // the law before: none on a Proving Walk's second span or a Low Road, one section at rank II (lane 1 #14's finding)
    if (galleries) {
      const old = egHallOf(seed, h, geoOf(gale, 0), 5);
      if (old.kind === 'proving') assert.equal(runs(course(old, 0, courtOf(old).z + courtOf(old).r), 'gust').length, 0, 'law 5: the Proving Walk untouched');
      else if (old.fork) assert.deepEqual([runs(course(old, 0), 'gust').length, runs(course(old, 1), 'gust').length], [1, 0], 'law 5: one section on the High Road, the Low Road none');
    }
  }
  assert.ok(walks >= 6 && lows >= 6 && highs >= 6, `${walks} Proving Walks, ${lows} Low Roads, ${highs} High Roads`);
});

test('AUDIT EG III LAW 6 - CRUMBLING HALLS ON EVERY SPAN (section 14: "every span carries a Crumble section, and has one island fewer | two Crumble sections, two islands fewer"): a Crumble section a rank on every road of a Span and on a Proving Walk (rank II\'s second ending its first span), each laid straight on from the ground before it - never on an island of its own - two pieces each at rank II; a Proving Walk\'s second span is the decrees\' alone, in their order (mutants: rank II one section; a Crumble section on an island; the Low Road\'s second dropped; the Proving Walk\'s second section on its second span)', () => {
  let n = 0;
  for (const { seed, h } of spans([1, 2, 3, 5, 8, 13], 2, 12)) for (const cr of [1, 2]) {
    const spec = egHallOf(seed, h, geoOf(0, cr), 8);   // PIN MOVED (THE ASCENT): spec law 8's line - see the Gust's, above
    if (spec.kind === 'proving') {
      // the Proving Walk exactly: rank II's second section ends the first span; the second span is the Crumble section alone,
      // straight on from the court
      const C = courtOf(spec), first = course(spec, 0, -Infinity, C.z - C.r), second = course(spec, 0, C.z + C.r);
      assert.deepEqual(second, Array(cr === 2 ? 2 : second.length).fill('crumble'), `seed ${seed} hall ${h}: the second span the Crumble section alone - ${second.join(' ')}`);
      assert.ok(second.length >= 2 && second.length <= 3);
      if (cr === 2) assert.deepEqual(first.slice(-2), ['crumble', 'crumble'], 'rank II: the second section ends the first span');
      n++;
      continue;
    }
    for (const road of spec.fork ? [0, 1] : [0]) {
      const ev = course(spec, road), R = runs(ev, 'crumble');
      assert.ok(R.length >= cr, `seed ${seed} hall ${h} road ${road} Crumbling Halls ${cr}: a section a rank - ${ev.join(' ')}`);
    }
    n++;
  }
  assert.ok(n >= 40, `${n} halls`);
  // the decrees together on a Proving Walk's second span, in their order: each Gust section on its island, then the Crumble
  // section straight on from the last gust - no island of its own
  for (const { seed, h } of spans([1, 2, 3], 2, 12)) {
    const spec = egHallOf(seed, h, geoOf(2, 1), 8);
    if (spec.kind !== 'proving') continue;
    const C = courtOf(spec), ev = course(spec, 0, C.z + C.r);
    assert.match(ev.join(' '), /^\| gust gust \| gust gust( crumble){2,3}$/, `seed ${seed} hall ${h}: ${ev.join(' ')}`);
  }
});

test('AUDIT EG III LAW 6 - INSIDE THE WIRE\'S BOUND, PROVEN (sections 9, 10.5): every traverse and Proving Walk of law 6, under every ground of the span decrees, runs no longer than EG_HALL_LEN_MAX (the gate\'s wire bound under it) and is laid by THE TIMED SOLVER without its last resort; the sweep crosses them with the real motor (tools/egSpanSolve.mjs --sweep, 25 seeds a band on every pull request) (mutants: a set piece\'s runs kept under two ranks; a Gust section beside an island already laid)', () => {
  let n = 0, longest = 0;
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): spec law 8's halls, laid by the solver inside EG_RELAY_MAX; a LAW 9
  // hall's bound (x, z and y) and its tries are test/net/eliteGates/law9_rooms.test.js's
  for (const { seed, h } of spans([1, 4, 5, 7, 21, 123, 190], 1, 20)) for (let geo = 0; geo <= 8; geo++) {
    const spec = egHallOf(seed, h, geo, 8);

    n++;
    longest = Math.max(longest, spec.len);
    assert.ok(spec.len <= EG_HALL_LEN_MAX, `seed ${seed} hall ${h} ground ${geo}: ${spec.len} m`);
    assert.ok(spec.laid <= EG_RELAY_MAX, `seed ${seed} hall ${h} ground ${geo}: laid by the solver (${spec.laid} tries)`);
    if (geo % 4 === 0) assert.ok(egSpanProof(spec).ok, `seed ${seed} hall ${h} ground ${geo}: proven`);
  }
  assert.ok(n > 1000 && longest > 140, `${n} halls, the longest ${longest} m`);
});
