// AUDIT EG V, fix group F ("law"; bible/11-Multiplayer/Elite-Gates.md sections 7-13 and 31's AUDIT EG V record) - SPEC LAW 8,
// THE WAYS LAID: every change to how a hall is laid, in one law beside the four kept (net/eliteGates/egLaw.js EG_WAYS_LAW). Pins, each by
// its finding: L5-15 and L5-14 (a raised floor's way up - the law's half: a Rampart's caster pillars and the Wyrm's perches a
// stair each, the Council Rotunda two a balcony), L3-18 (the Reliquary Vault on a forked span - the law's half), L3-11 (a twist
// one trial hall in four), L5-5 (the Sinking Stair's island), L5-11 (a span's passages by circle), L5-9 (an Eclipse chamber's
// balcony within its havens' reach), L5-6 (the set pieces' margin, the Forge Line's hammers, the Tube's pace), L5-2 (THE
// TIMED SOLVER on THE LAW'S CLOCK, swept), L5-17 (THE LANDING ROOM's exception) - and THE LAW PIN (laws 4-7 byte for byte).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, egCirclePlan, egSpecDigest, egHeroSeam, egHeroLanding, egHeroStatic, EG_SPEC, EG_WAYS_LAW, EG_HERO_LAW, EG_HALL_LEN_MAX, EG_FORK_VAULT_CM, EG_SINK_LOW_CM, EG_PILLAR_UP_CM, EG_PERCH_UP_CM, EG_HERO_ALONG } from '../../../src/net/eliteGates/egLaw.js';
import { EG_LAWS, egLawKnown } from '../../../src/net/eliteGates/egDurable.js';
import { EG_SOLVE_LAW, EG_SET_MARGIN, EG_SET_KITS, EG_WINDOW_MIN, EG_WAIT_MAX, EG_SINK_MPS, EG_SINK_ON_S, EG_SIN_DEG, EG_HAMMER_LINE, EG_GAP_MIN_CM, egLawSin, egSpanProof, egSpanPairs, egPairWindows, egSpanBuildOf, egForgeLineClear, egJumpReach } from '../../../src/net/eliteGates/egSpanLaw.js';
import { EG_HAZARDS, EG_ECLIPSE_REACH_CM, EG_SET_PIECES, egEclipseShafts, egEclipseHolds, egFragChamber, egTubeFair, egSetPiece } from '../../../src/net/eliteGates/egFragLaw.js';
import { EG_HERO_FRAGS } from '../../../src/net/eliteGates/egHeroFrags.js';
import { egFightView, egWalkGraph } from '../../../src/net/eliteGates/egWalkGraph.js';
import { egBreachNew } from '../../../src/net/eliteGates/egBrain.js';

/** THE LAW PIN's 800 halls (test/net/eliteGates/eghero_lay.test.js's own): four seeds, two grounds, a hundred halls. */
const LAW_HALLS = [];
for (const seed of [77, 0xbeef, 3, 12345]) for (const geo of [0, 4]) for (let h = 1; h <= 100; h++) LAW_HALLS.push([seed, h, geo]);
const hash = (law) => { let acc = 0x811c9dc5; for (const [s, h, g] of LAW_HALLS) acc = Math.imul(acc ^ egSpecDigest(egHallOf(s, h, g, law)), 0x01000193) >>> 0; return acc >>> 0; };
/** Can a walker of hall `spec` go from region `a` to region `b` over its walk graph (its edges, either way they run)? */
function reaches(spec, from, to) {
  const G = egWalkGraph(egFightView(spec)), radj = new Map();
  G.adj.forEach((l, a) => l.forEach(([b]) => { const ra = G.nodes[a].rg, rb = G.nodes[b].rg; if (ra !== rb) { if (!radj.has(ra)) radj.set(ra, new Set()); radj.get(ra).add(rb); } }));
  const seen = new Set([from]), q = [from];
  while (q.length) { const k = q.shift(); for (const n of radj.get(k) ?? []) if (!seen.has(n)) { seen.add(n); q.push(n); } }
  return seen.has(to);
}
/** The walk graph's region of fight-ground piece `f` (egFightView(spec).fl's own). */
const regionOf = (spec, f) => { const view = egFightView(spec), G = egWalkGraph(view), i = view.fl.indexOf(f); return G.rg.findIndex((r) => r.f === i); };

test('AUDIT EG V L5-2 L5-5 L5-6 L5-9 L5-11 L5-14 L5-15 L5-17 L3-11 L3-18 THE LAW PIN (section 22): spec law 8 is the law (net/eliteGates/egLaw.js EG_WAYS_LAW, the solver\'s EG_SOLVE_LAW one law with it), laws 4 to 7 kept beside it their seven days each, byte for byte (their 800 halls hashed whole); law 8\'s 800 halls hashed whole; a breach opened records law 8 (mutants: law 8 not in the table; a law before moved; law 8 laid as law 7)', () => {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): spec law 9 is the build's law now, law 8 kept beside it its seven days
  // and still laid byte for byte as AUDIT EG V laid it (test/net/eliteGates/law9_rooms.test.js pins law 9); every pin below of law 8's ground
  // asks law 8 by name
  // PIN MOVED (EG-PERFECT, 2026-10-18): spec law 10 (THE BROKEN WAY) is the build's law, laws 4 to 9 kept beside it
  // (test/net/eliteGates/egperfect_broken.test.js pins law 10)
  assert.deepEqual([EG_SPEC, EG_WAYS_LAW, EG_SOLVE_LAW, EG_HERO_LAW], [10, 8, 8, 7]);
  assert.deepEqual({ ...EG_LAWS }, { 4: '2026-10-11', 5: '2026-10-12', 6: '2026-10-13', 7: '2026-10-13', 8: '2026-10-15', 9: '2026-10-16', 10: '2026-10-18' });
  assert.deepEqual([4, 5, 6, 7, 8, 9, 10, 11].map(egLawKnown), [true, true, true, true, true, true, true, false]);
  assert.ok((Date.parse(EG_LAWS[10]) - Date.parse(EG_LAWS[4])) / 86_400_000 <= 7, 'every law before inside its keep');
  assert.deepEqual([hash(4), hash(5), hash(6), hash(7)], [1228307904, 1301097644, 201408482, 2018192008], 'laws 4 to 7, byte for byte');
  assert.equal(hash(8), 3066462283, 'law 8, as AUDIT EG V lays it');
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'a', o: 'A', ew: 0, rh: 0, seed: 77, op: 1_800_000_000_000, co: [['a', 'A', 1]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  assert.equal(B.egv, 10, 'a breach opened now is of law 10 (PIN MOVED, THE ASCENT; EG-PERFECT)');
  for (const [s, h, g] of LAW_HALLS) for (const law of [8, 9]) assert.ok(egHallOf(s, h, g, law).len <= EG_HALL_LEN_MAX, `seed ${s} hall ${h} law ${law}: inside the wire's bound`);
});

test('AUDIT EG V L5-15 L5-14 A RAISED FLOOR\'S WAY UP, THE LAW (sections 8.3, 13.3, 13.4): from law 8 a Rampart\'s every caster pillar is reached by a stair from the walkway\'s edge onto its top 2 m up (no flat side span under it), the Wyrm\'s every perch by a stair from the court onto its top 3 m up, the Council Rotunda\'s every balcony by two stairs from its floor - each foot on its floor, each top on its raised floor - and the walk graph climbs every one; law 7 laid none (mutants: a pillar\'s span flat; a perch\'s span flat; the Rotunda\'s stairs one a balcony; no stair at all)', () => {
  // the Rampart (seed 1's Hall 4): six pillars, six stairs, no side lane
  const R8 = egHallOf(1, 4, 0, 8), R7 = egHallOf(1, 4, 0, 7), walk = R8.walk;
  const pillars = R8.discs.filter((d) => d.role === 'pillar');
  assert.deepEqual([pillars.length, R8.ramps.length, R8.lanes.filter((l) => l.role === 'side').length], [6, 6, 0]);
  assert.deepEqual([R7.ramps.length, R7.lanes.filter((l) => l.role === 'side').length], [0, 6], 'law 7: a flat side span to each');
  assert.equal(EG_PILLAR_UP_CM, 200);
  for (const d of pillars) {
    const q = R8.ramps.find((r) => Math.abs(r.bz - d.z) < 1e-9 && Math.sign(r.bx) === Math.sign(d.x));
    assert.ok(q, 'its stair');
    assert.deepEqual([q.y0, q.y1, d.y], [0, 2, 2]);
    assert.ok(Math.abs(Math.abs(q.ax) - walk.halfW) < 1e-9 && Math.abs(Math.hypot(q.bx - d.x, q.bz - d.z) - d.r) < 1e-9, 'from the walkway\'s edge to the pillar\'s rim');
    const view = egFightView(R8), w = view.fl.find((f) => f.t === 'l'), p = view.fl.find((f) => f.t === 'd' && f.x === d.x && f.z === d.z);
    assert.ok(reaches(R8, regionOf(R8, w), regionOf(R8, p)), 'the walk graph climbs it');
  }
  // the Wyrm's perches (seed 1's Hall 85): three stairs from the court, no flat span in the fight floor
  const W8 = egHallOf(1, 85, 0, 8), W7 = egHallOf(1, 85, 0, 7);
  assert.equal(W8.lord, 'wyrm');
  const perches = W8.discs.filter((d) => d.role === 'perch'), court = W8.fl.find((f) => f.t === 'd' && f.r > 10);
  assert.deepEqual([perches.length, W8.ramps.length, W8.lanes.length, W8.fl.filter((f) => f.t === 'l').length], [3, 3, 0, 0]);
  assert.deepEqual([W7.ramps.length, W7.lanes.length, W7.fl.filter((f) => f.t === 'l').length], [0, 3, 3]);
  for (const d of perches) {
    const q = W8.ramps.find((r) => Math.abs(Math.hypot(r.bx - d.x, r.bz - d.z) - d.r) < 0.02);
    assert.ok(q && q.y0 === court.y && q.y1 === court.y + EG_PERCH_UP_CM / 100 && d.y === q.y1, 'a stair from the court onto the perch');
    assert.ok(Math.hypot(q.ax - court.x, q.az - court.z) < court.r, 'its foot on the court');
    assert.ok(reaches(W8, regionOf(W8, court), regionOf(W8, W8.fl.find((f) => f.t === 'd' && f.x === d.x && f.z === d.z))), 'the walk graph climbs it');
  }
  // the Council Rotunda (seed 1's Hall 25): two stairs a balcony
  const C8 = egHallOf(1, 25, 0, 8), C7 = egHallOf(1, 25, 0, 7);
  assert.equal(C8.lord, 'ilthys');
  assert.deepEqual([C8.ramps.length, C7.ramps.length], [6, 0]);
  const floor = C8.fl.find((f) => f.t === 'd' && f.r === 24);
  for (const b of C8.discs.filter((d) => d.role === 'balcony')) {
    const mine = C8.ramps.filter((q) => Math.hypot(q.bx - b.x, q.bz - b.z) < b.r);
    assert.equal(mine.length, 2, 'two stairs each');
    for (const q of mine) {
      assert.ok(Math.hypot(q.ax - floor.x, q.az - floor.z) < floor.r && q.y0 === floor.y && q.y1 === b.y, 'from the floor up onto the balcony');
      assert.ok(Math.atan2(q.y1 - q.y0, Math.hypot(q.bx - q.ax, q.bz - q.az)) < (60 * Math.PI) / 180, 'walkable');
    }
    assert.ok(Math.hypot(mine[0].bx - mine[1].bx, mine[0].bz - mine[1].bz) >= 4, 'either side of its middle');
    assert.ok(reaches(C8, regionOf(C8, floor), regionOf(C8, C8.fl.find((f) => f.t === 'd' && f.x === b.x && f.z === b.z))), 'the walk graph climbs to it');
    assert.ok(!reaches(C7, regionOf(C7, C7.fl.find((f) => f.r === 24)), regionOf(C7, C7.fl.find((f) => f.t === 'd' && f.x === b.x && f.z === b.z))), 'law 7: none');
  }
});

test('AUDIT EG V L3-18 THE RELIQUARY VAULT ON A FORKED SPAN, THE LAW (section 8.7: "a side span to a cache ... a Span or a Proving Walk"): from law 8 a forked span that turns the Vault lays it off the fork\'s island - a side span across from the Low Road\'s bridge to its disc EG_FORK_VAULT_CM out, where either road\'s company reaches it; law 7 laid a forked span\'s Vault nowhere (mutants: the vault left off the fork; the vault on the Low Road\'s side)', () => {
  let n = 0;
  // law 7's forked spans that turned the Vault (its plan's twists - a law of their own since law 8 rolls a third) laid none
  for (const [seed, h] of [[1, 122], [3, 52], [4, 22], [4, 87]]) {
    const s7 = egHallOf(seed, h, 0, 7);
    assert.ok(s7.fork && s7.twist === 'vault', `law 7: seed ${seed} hall ${h} a forked span that turns the Vault`);
    assert.deepEqual(s7.spots.vault ?? [], [], 'law 7: no vault');
  }
  for (const [seed, h] of [[1, 122], [3, 82], [4, 22]]) {
    const s8 = egHallOf(seed, h, 0, 8);
    assert.ok(s8.fork && s8.twist === 'vault', `seed ${seed} hall ${h}: a forked span turns the Vault`);
    const [v] = s8.spots.vault, isle = s8.islands.find((q) => q.road === 0 && Math.abs(q.z + q.r - s8.fork.z) < 1e-9);
    assert.deepEqual([v.x, v.z], [-EG_FORK_VAULT_CM / 100, isle.z], 'off the fork\'s island, across from the Low Road');
    assert.ok(s8.fork.lowX > 0, 'the Low Road the other side');
    const disc = s8.discs.find((d) => d.role === 'vault'), lane = s8.lanes.find((l) => l.role === 'side');
    assert.ok(disc && disc.x === v.x && disc.y === isle.y && lane && lane.y === isle.y, 'its disc and its side span at the island\'s height');
    assert.ok(Math.hypot(lane.ax - isle.x, lane.az - isle.z) < isle.r && Math.hypot(lane.bx - disc.x, lane.bz - disc.z) <= disc.r, 'the side span from the island to the disc');
    n++;
  }
  assert.equal(n, 3);
});

test('AUDIT EG V L3-11 A TWIST ONE TRIAL HALL IN FOUR (section 8.7: "about one hall in four ... never the Court, never two running"): law 8\'s plan rolls a third a slot, so with never two running a quarter of the trial halls turn; law 7\'s rolled a quarter (one in five); never a Court\'s, never a Brink\'s, never two running, at most one Bargain a circle (mutants: the roll a quarter in law 8; two running)', () => {
  const rate = (law) => {
    let trials = 0, tw = 0;
    for (let seed = 1; seed <= 400; seed++) for (let c = 2; c <= 30; c++) {
      const plan = egCirclePlan(seed, c, law);
      let bargains = 0;
      plan.forEach((p, i) => {
        if (p.kind === 'court') { assert.equal(p.twist, null); return; }
        trials++;
        if (!p.twist) return;
        tw++;
        assert.notEqual(p.kind, 'brink');
        assert.ok(!(i > 0 && plan[i - 1].twist), 'never two running');
        if (p.twist === 'bargain') bargains++;
      });
      assert.ok(bargains <= 1);
    }
    return tw / trials;
  };
  const r8 = rate(8), r7 = rate(7);
  assert.ok(r8 > 0.24 && r8 < 0.27, `law 8: ${r8.toFixed(3)} of the trial halls`);
  assert.ok(r7 > 0.19 && r7 < 0.22, `law 7: ${r7.toFixed(3)}`);
  // the kinds and variants the plan draws are the same under both laws (a Scriptorium a twist of slot 3's): only the twists moved
  const k = (p) => (p.kind === 'scriptorium' ? null : `${p.kind}:${p.variant}`);
  for (let seed = 1; seed <= 40; seed++) for (let c = 2; c <= 20; c++) {
    const a = egCirclePlan(seed, c, 8), b = egCirclePlan(seed, c, 7);
    a.forEach((p, i) => { if (k(p) && k(b[i])) assert.equal(k(p), k(b[i]), `seed ${seed} circle ${c} slot ${i + 1}`); });
  }
});

test('AUDIT EG V L5-5 THE SINKING STAIR\'S ISLAND (sections 8.9, 11.3: "Its course is a set-piece passage"): from law 8 the island after the Sinking Stair stands EG_SINK_LOW_CM under its last flight - where THE TIMED SOLVER takes its leap - and the step says the ground after it at that height (`ya`), so the Brink into the Cairn keeps its set piece: law 7\'s fell to the last resort (no Sinking Stair) at seed 8\'s Hall 26 under every rank of the span decrees, law 8\'s never over the seeds asked (mutants: the island at the flight\'s height; the ground after read at the step\'s own)', () => {
  assert.equal(EG_SINK_LOW_CM, Math.round(EG_SINK_MPS * EG_SINK_ON_S * 100));
  assert.equal(EG_SINK_LOW_CM, 50);
  const sinking = (s) => s.frags.some((f) => f.play === 'sinking');
  assert.ok(!sinking(egHallOf(8, 26, 8, 7)), 'law 7: seed 8\'s Brink laid on its last resort');
  let n = 0;
  for (let seed = 1; seed <= 12; seed++) for (let geo = 0; geo <= 8; geo++) {
    const s = egHallOf(seed, 26, geo, 8);
    assert.ok(sinking(s) && s.laid <= 2, `seed ${seed} ground ${geo}: the Sinking Stair stands (${s.laid} tries)`);
    const flights = s.steps.filter((q) => q.kind === 'sink'), last = flights[flights.length - 1];
    const isle = s.islands.find((q) => q.z > last.z && q.z - q.r - (last.z + last.d / 2) < 3);
    assert.ok(Math.abs(isle.y - (last.y - EG_SINK_LOW_CM / 100)) < 1e-9, 'the island at the leap\'s height');
    assert.equal(last.ya, isle.y, 'the step says it');
    const pair = egSpanPairs(s).find((p) => p.a === last && !p.b);
    assert.equal(pair.by, isle.y, 'the solver leaps to it');
    assert.ok(egPairWindows(pair, egSpanBuildOf(8)).worst12 >= EG_WINDOW_MIN * EG_SET_MARGIN, 'with the set piece\'s margin');
    n++;
  }
  assert.equal(n, 108);
  assert.ok(egHallOf(8, 26, 8, 8).frags.some((f) => f.play === 'sinking'), 'seed 8\'s, its own');
});

test('AUDIT EG V L5-11 A SPAN\'S PASSAGES BY CIRCLE (section 11.4: "in circles 1-2 every span carries one passage; in circles 3-10, one or two; deeper, up to three"): from law 8 a forked span\'s way to the fork runs through a passage one span in two from circle 3 and every span from circle 11 (never under three ranks of the span decrees, whose sections take its room) - both roads pass through it - and deeper the Low Road\'s still ground is a second passage where the hall has room; every hall inside EG_HALL_LEN_MAX; law 7 laid one (mutants: no passage on the way to the fork; a trunk passage under three ranks of the span decrees; the deep spans\' way a passage one in two; the third never)', () => {
  const seen = {};
  for (let seed = 1; seed <= 20; seed++) for (let c = 1; c <= 24; c++) for (const geo of c <= 1 ? [0] : [0, 1, 3, 8]) {
    const h = 5 * (c - 1) + 2, s = egHallOf(seed, h, geo, 8);
    if (s.kind !== 'span') continue;
    const n = s.frags.filter((f) => f.cls === 'passage').length, extra = (geo % 3) + Math.floor(geo / 3);
    const band = c <= 2 ? '1-2' : c <= 10 ? '3-10' : extra <= 2 ? '11+' : '11+ decrees';
    (seen[band] ??= new Set()).add(n);
    assert.ok(s.len <= EG_HALL_LEN_MAX, `seed ${seed} hall ${h} ground ${geo}: ${s.len} m`);
    assert.ok(s.frags.length <= 4, 'the hall\'s cap of four');
    if (s.fork && n >= 2) {
      const trunk = s.frags.find((f) => f.road === 0 && f.cls === 'passage');
      if (c <= 10 || extra <= 2) assert.ok(trunk && trunk.z1 <= s.fork.z, 'the first on the way to the fork, both roads through it');
    }
    if (!s.fork || !(c >= 3 && extra <= 2)) continue;
    assert.equal(egHallOf(seed, h, geo, 7).frags.filter((f) => f.cls === 'passage').length, 1, 'law 7: one');
  }
  assert.deepEqual([...seen['1-2']], [1]);
  assert.deepEqual([...seen['3-10']].sort(), [1, 2]);
  assert.deepEqual([...seen['11+']].sort(), [2, 3]);
  assert.deepEqual([...seen['11+ decrees']], [1]);
});

test('AUDIT EG V L5-9 THE ECLIPSE\'S REACH (section 11.2: "the nearest is never more than 20 m away"): from law 8 a code-built Eclipse chamber whose balcony would stand past its havens\' reach (a Shade Rift-Yard\'s court of 20 m and more) takes the arch in its place, and over the law\'s halls every point of every fight floor of an Eclipse chamber - the code-built and the hero - stands within EG_ECLIPSE_REACH_CM of its nearest moon-shaft\'s edge at every moment the shafts stand; law 7\'s balcony in a 26 m court stood 26 m off (mutants: the balcony kept in a wide court; the bound loosened)', () => {
  assert.equal(EG_ECLIPSE_REACH_CM, 2000);
  assert.ok(egEclipseHolds(1913 + 700) && !egEclipseHolds(1914 + 700), 'a balcony stands in a court of R 19.13 m at most');
  assert.ok(egEclipseHolds(2600), 'a 26 m court\'s rim within it');
  const zero = () => 0;
  assert.equal(egFragChamber('eclipse', zero, 2200, { law: 8 }).play, 'arch');
  assert.equal(egFragChamber('eclipse', zero, 2200, { law: 7 }).play, 'balcony');
  assert.equal(egFragChamber('eclipse', zero, 1600, { law: 8 }).play, 'balcony', 'a Deepway\'s 16 m chamber keeps its balcony');
  assert.equal(egFragChamber('gloam', zero, 2600, { law: 8 }).play, 'balcony', 'another kit\'s balcony unmoved');
  for (const [seed, h] of [[22, 69], [27, 74], [43, 71], [50, 64]]) {
    assert.equal(egHallOf(seed, h, 0, 7).frags.find((f) => f.kit === 'eclipse').play, 'balcony');
    assert.equal(egHallOf(seed, h, 0, 8).frags.find((f) => f.kit === 'eclipse').play, 'arch');
  }
  const worst = (s) => {
    let w = 0;
    for (const hz of s.hazards.filter((q) => q.kind === 'eclipse')) {
      const pts = [];
      for (const f of s.fl) {
        if (f.t === 'd') { if (Math.hypot(f.x - hz.x, f.z - hz.z) > 40) continue; pts.push([f.x, f.z]); for (let a = 0; a < 360; a += 15) pts.push([f.x + f.r * Math.sin((a * Math.PI) / 180), f.z + f.r * Math.cos((a * Math.PI) / 180)]); }
        else if (f.t === 'p') for (const p of f.poly) if (Math.hypot(p[0] - hz.x, p[1] - hz.z) < 40) pts.push(p);
      }
      for (let t = 0; t < 40; t += 0.5) {
        const sh = egEclipseShafts(hz, t);
        for (const [x, z] of pts) w = Math.max(w, Math.min(...sh.map((q) => Math.hypot(x - q[0], z - q[1]))) - EG_HAZARDS.eclipse.r);
      }
    }
    return w;
  };
  assert.ok(worst(egHallOf(43, 71, 0, 7)) > 24, 'law 7\'s balcony in a 26 m court past the reach');
  let n = 0;
  for (let seed = 1; seed <= 40; seed++) for (let h = 51; h <= 75; h++) {
    const s = egHallOf(seed, h, 0, 8);
    if (!s.hazards.some((q) => q.kind === 'eclipse')) continue;
    n++;
    assert.ok(worst(s) <= EG_ECLIPSE_REACH_CM / 100 + 1e-6, `seed ${seed} hall ${h}: ${worst(s).toFixed(2)} m from a haven`);
  }
  assert.ok(n >= 40, `${n} Eclipse halls`);
});

test('AUDIT EG V L5-6 THE SET PIECES\' MARGIN (section 11.3: "proven by the solver at the span build with at least 25% margin"): from law 8 THE TIMED SOLVER holds every pair of a set piece\'s course to a window of EG_WINDOW_MIN x EG_SET_MARGIN in every 12 s and its next within EG_WAIT_MAX / EG_SET_MARGIN, the Collapsing Tube to be outrun by THE SPAN BUILD with the margin (egTubeFair\'s, read by the law), and the Forge Line to be crossed from every start clear of its hammers (egForgeLineClear); the Forge Line\'s conveyors stand THE ENVELOPE\'s least gap apart, so every Brink keeps its set piece (mutants: the margin dropped; the window\'s margin dropped; the hammers judged nowhere; a struck crossing passed; a body under a live hammer let on; the conveyors 3.2 m apart)', () => {
  assert.deepEqual([EG_SET_MARGIN, EG_SET_KITS], [1.25, ['sinking', 'moonpath', 'forgeline']]);
  assert.deepEqual({ ...EG_HAMMER_LINE }, { period: 5000, tell: 1400, live: 300, r: 3 });
  assert.deepEqual([EG_HAZARDS.hammerline.period, EG_HAZARDS.hammerline.tell, EG_HAZARDS.hammerline.live], [5000, 1400, 300], 'one home');
  assert.ok(egTubeFair({ mps: 4.0 }) && !egTubeFair({ mps: 4.4 }), 'the Tube outrun with the margin');
  assert.match(egSpanProof({ v: 8, steps: [], tube: { mps: 4.5 } }).why.join(), /Collapsing Tube/);
  assert.equal(egSpanProof({ v: 7, steps: [], tube: { mps: 4.5 } }).ok, true, 'law 7 never asked it');
  // the conveyors: law 7's 3.2 m apart closed on the leap half their cycle - its Forge Line asks 3.5 s of a wait, past the margin
  assert.deepEqual([egSetPiece('forgeline', () => 0, { law: 7 }).course[0].gap, egSetPiece('forgeline', () => 0, { law: 8 }).course[0].gap], [320, EG_GAP_MIN_CM]);
  const s7 = egHallOf(1, 76, 0, 7);
  assert.equal(egSpanProof(s7).ok, true);
  assert.match(egSpanProof({ ...s7, v: 8 }).why.join(), /past a set piece's margin/, 'law 7\'s Forge Line under law 8: refused');
  // every set piece of law 8, over the seeds asked: laid, proven, each of its pairs inside the margin on THE LAW'S CLOCK
  const B = egSpanBuildOf(8);
  let pieces = 0;
  for (let seed = 1; seed <= 10; seed++) for (const geo of [0, 2, 4, 8]) for (const h of [26, 51, 76]) {
    const s = egHallOf(seed, h, geo, 8), f = s.frags.find((q) => EG_SET_PIECES.includes(q.play));
    assert.ok(f, `seed ${seed} hall ${h} ground ${geo}: its set piece stands`);
    assert.equal(egSpanProof(s).ok, true);
    for (const p of egSpanPairs(s).filter((q) => EG_SET_KITS.includes(q.a?.kit) || EG_SET_KITS.includes(q.b?.kit))) {
      const w = egPairWindows(p, B);
      assert.ok(w.worst12 >= EG_WINDOW_MIN * EG_SET_MARGIN && w.wait <= EG_WAIT_MAX / EG_SET_MARGIN, `seed ${seed} hall ${h}: a window of ${w.worst12} s, a wait of ${w.wait} s`);
    }
    if (f.play === 'forgeline') assert.equal(egForgeLineClear(s, f), true, 'clear of its hammers');
    pieces++;
  }
  assert.equal(pieces, 120);
  // THE HAMMERS: a Forge Line whose first conveyor must be ridden past a hammer's beat - landed on only rolled 1.5 m back and leapt
  // off only rolled 1.5 m out, a 20 s roll: 5.4 s aboard at the least, past the hammer's 5 s - is refused, and passed with no hammer
  const s8 = egHallOf(1, 76, 0, 8), rails = s8.steps.filter((q) => q.kit === 'forgeline');
  assert.ok(rails.length === 3 && s8.hazards.filter((h) => h.kind === 'hammerline').length === 3 && rails.every((q) => q.gap === EG_GAP_MIN_CM / 100));
  const rail = (i, z, gap, amp, period) => ({ i, kind: 'rail', span: 0, x: 0, y: 0, z, w: 3, d: 3, amp, period, phase: 0, beat: 0, gap, road: 0, kit: 'forgeline', after: i === 2 ? 2.4 : 0 });
  const steps = [rail(0, 10, 4.76, 2, 20), rail(1, 17.76, 4.76, 0, 6), rail(2, 23.16, 2.4, 0, 6)];
  const hammers = steps.map((q, k) => ({ kind: 'hammerline', i: k, x: 0, z: q.z, y: 0, period: 0, phase: 0, w: 0, r: 3, ring: 0, sh: null, spots: [[0, q.z]], lanes: null, path: null }));
  const line = { play: 'forgeline', z0: 3, z1: 26, road: 0 }, slow = { v: 8, steps, hazards: hammers, frags: [line] };
  assert.equal(egSpanPairs(slow).length, 4, 'into, between and out of its three');
  assert.equal(egForgeLineClear(slow, line), false, 'struck on every crossing');
  assert.equal(egForgeLineClear({ ...slow, hazards: [] }, line), true, 'unstruck with no hammer');
  assert.match(egSpanProof(slow).why.join(), /clear of its hammers/, 'the solver refuses it');
  // THE WINDOW'S MARGIN: a Moon Path's conveyor reached only at the foot of its 2 m roll - 0.6 s open in every 12 s, its longest
  // wait 2.85 s: inside the plain bounds, under the margin's 0.625 s - refused for the margin alone
  const moon = { i: 0, kind: 'rail', span: 0, x: 0, y: 0, z: 10, w: 3, d: 3, amp: 2, period: 3, phase: 0, beat: 0, gap: 5.22, road: 0, kit: 'moonpath', after: 2.4 };
  const [into] = egSpanPairs({ v: 8, steps: [moon] }), wm = egPairWindows(into, B);
  assert.ok(wm.worst12 >= EG_WINDOW_MIN && wm.worst12 < EG_WINDOW_MIN * EG_SET_MARGIN && wm.wait <= EG_WAIT_MAX / EG_SET_MARGIN, `a window of ${wm.worst12} s, a wait of ${wm.wait} s`);
  assert.match(egSpanProof({ v: 8, steps: [moon] }).why.join(), /0: a window of 0\.60 s in some 12 s, under a set piece's margin/);
  assert.doesNotMatch(egSpanProof({ v: 8, steps: [{ ...moon, kit: null }] }).why.join(), /window|wait/, 'no set piece: no margin');
});

test('AUDIT EG V L5-2 THE TIMED SOLVER ON THE LAW\'S CLOCK (section 9: "the law files decide only in integers ... a source sweep refuses"): from law 8 the solver takes every piece\'s place on THE LAW\'S CLOCK (a whole-degree table of sines, a literal, read between its degrees - egLawSin) and compares squares, never Math.hypot - so a law-8 hall is laid with every transcendental refused outright, while a law-7 one asks Math.sin; the sweep holds net/eliteGates/egSpanLaw.js\'s generator, the law\'s clock and the solver free of every one (mutants: a Drift\'s or a Rail\'s or a Pendulum\'s place on Math.sin under law 8; a shaft crossed on the screens\' clock; the hypot back)', () => {
  // the table: the sine of every whole degree, times a million, rounded
  assert.equal(EG_SIN_DEG.length, 91);
  for (let d = 0; d <= 90; d++) assert.equal(EG_SIN_DEG[d], Math.round(Math.sin((d * Math.PI) / 180) * 1e6), `sin ${d}`);
  for (let k = -800; k <= 800; k++) { const x = k * 0.0123; assert.ok(Math.abs(egLawSin(x) - Math.sin(x)) < 4e-5, `egLawSin(${x})`); }
  assert.deepEqual([egLawSin(0), egLawSin(Math.PI / 2), egLawSin(-Math.PI / 2)], [0, 1, -1]);
  // a law-8 hall laid with every transcendental refused: none is asked
  const BANNED = ['sin', 'cos', 'tan', 'atan2', 'hypot', 'pow', 'exp', 'log', 'cbrt'], kept = BANNED.map((k) => Math[k]);
  const lay = (law) => { egHeroSeam(EG_HERO_FRAGS); for (const [seed, h, geo] of [[1, 26, 0], [2, 51, 4], [3, 76, 8], [5, 57, 2], [7, 82, 1], [9, 12, 5], [4, 4, 0]]) egHallOf(seed, h, geo, law); };
  try {
    BANNED.forEach((k) => { Math[k] = () => { throw new Error(`Math.${k} asked`); }; });
    assert.doesNotThrow(() => lay(8), 'law 8 decides on the law\'s clock alone');
    assert.doesNotThrow(() => lay(9), 'and law 9 (THE ASCENT - its route planner and its rooms, their sanity and their proof)');

    assert.throws(() => lay(7), /Math\.sin asked/, 'law 7 on the screens\' clock');
    // a shaft's own crossing on its hall's law: a Drift in a shaft proven with the screens' clock refused
    const drift = { i: 0, kind: 'drift', span: 0, x: 0, y: 0, z: 10, w: 3, d: 3, amp: 1, period: 4, phase: 0, beat: 0, gap: 2.4, road: 0, kit: null, after: 2.4 };
    const shaft = { steps: [drift], frags: [{ cls: 'shaft', z0: 5, z1: 15, road: 0 }] };
    assert.doesNotThrow(() => assert.equal(egSpanProof({ ...shaft, v: 8 }).ok, true), 'law 8\'s shaft on the law\'s clock');
    assert.throws(() => egSpanProof({ ...shaft, v: 7 }), /Math\.sin asked/);
  } finally { BANNED.forEach((k, i) => { Math[k] = kept[i]; }); egHeroSeam(EG_HERO_FRAGS); }
  // the source sweep: the generator, the law's clock and the solver ask no transcendental
  const src = readFileSync('src/net/eliteGates/egSpanLaw.js', 'utf8');
  const slice = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); assert.ok(a >= 0 && b > a, `${from} .. ${to}`); return src.slice(a, b); };
  const swept = [slice('// ── AUDIT EG V (lane5 #2; spec law 8, section 9): THE LAW\'S CLOCK', '// ── end THE LAW\'S CLOCK'), slice('export function egSpanOf(', 'export function egCourseOf('), slice('function jumpLands(', '/** EG6a: does THE SPAN BUILD\'s jump on'), slice('export function egPairWindows(', '/** THE MEDIAN (section 10.5)'), slice('export function egRoadCross(', '/** EG6a: the farthest a leap'), slice('export function egSpanProof(', '// ── AUDIT EG III (2026-10-13, lane 1 #7')];
  for (const s of swept) assert.ok(!/Math\.(sin|cos|tan|atan2|hypot|pow|exp|log|cbrt)\s*\(/.test(s), `no transcendental asked: ${s.slice(0, 60)}`);
});

test('AUDIT EG V L5-17 THE LANDING ROOM\'S EXCEPTION (EG-HERO-LAY\'s fit rule: "a piece that moves along the course"): from law 8 only a Rail and a Drum - whose motion runs along the course - are left to the solver; a Drift swings across it and a Pendulum\'s step stands still, so each is landed on as still ground; law 7 excepted all four (mutants: a Drift excepted under law 8; a Rail judged)', () => {
  assert.deepEqual([...EG_HERO_ALONG], ['rail', 'drum']);
  const REF = EG_HERO_FRAGS.egRefFrag, T = { ...REF, variant: 'test' };
  const short = (kind) => ({ ...T, course: T.course.map((c, i) => (i === 1 ? { ...c, kind, amp: c.amp || 100, d: 100, z: c.z - 120 } : c)) });
  assert.equal(T.course[1].kind, 'drift');
  assert.match(egHeroLanding(short('drift')), /piece 1 \(drift\)/, 'law 8: a Drift landed on as still ground');
  assert.equal(egHeroLanding(short('drift'), 7), '', 'law 7 excepted it');
  assert.match(egHeroLanding(short('pend'), 8), /piece 1 \(pend\)/);
  assert.equal(egHeroLanding(short('rail')), '', 'a Rail moves along the course');
  assert.equal(egHeroLanding(short('drum')), '');
  assert.equal(egHeroStatic(short('drift'), false, 7), '');
  assert.match(egHeroStatic(short('drift')), /drift/, 'the fit holds it');
  // every registered hero still fits its slot under law 8 (no shipped hero lays a Drift or a Pendulum in its course)
  for (const [id, L] of Object.entries(EG_HERO_FRAGS)) if (id !== 'egRefFrag') assert.equal(egHeroStatic(L), '', id);
  assert.equal(egJumpReach(0).reach > 3.2, true);
});
