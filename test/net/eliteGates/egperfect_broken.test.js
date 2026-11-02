// EG-PERFECT - SPEC LAW 10, THE BROKEN WAY (2026-10-18, Mac: "Traversing between sections should present a challenge,
// platforming should be detailed"; bible/11-Multiplayer/Elite-Gates-Ascent.md section 8, bible/11-Multiplayer/Elite-Gates.md
// section 31's EG-PERFECT record): law 9's way walked 48-69% of every hall on bridges, landings and stairs nothing touched. From
// spec law 10 a bridge the way takes breaks onto its band's pieces in every heading (a turned course read in its heading's own
// frame), THE FORK's Low Road is linked by its own spans, a fight hall's rooms stand before its trial and its door after it
// (its clocks awaiting its company), its approaches draw two of its band's kinds, its passages' chasms are as wide as THE
// ENVELOPE asks, a Drop falls below its road's floor, a run of Rails never meets itself, a Pendulum is proven over the whole
// flight, and the halls' fittings stand where a body reaches them - laws 4 to 9 byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egSpecDigest, egAscentProof, egAscentCourses, EG_SPEC, EG_BROKEN_LAW, EG_BROKEN_TRIES, EG_RELAY_MAX, EG_SPEC_SAID_MAX,
  EG_ASCENT_LAST_TRIES, EG_ASCENT_HERO_TRIES, EG_FORK_COURSE_CM, EG_FORK_THIRD_CM, EG_STEP } from '../../../src/net/eliteGates/egLaw.js';
import { EG_BROKEN_FOOT_CM, EG_BROKEN_PIECES, EG_BROKEN_MOST, EG_BROKEN_KINDS, EG_BROKEN_TURNED, EG_ASCENT_ROOMS, EG_ROUTE_LEN_MAX_M, EG_ROUTE_S_MAX, egRouteLength } from '../../../src/net/eliteGates/egAscent.js';
import { egSpanPairs, egSpanProof, egStepLocal, egAlongOf, egSpanOf, egPairWindows, egSpanBuildOf, egRouteCross, EG_SOLVE_FLIGHT_LAW, EG_GAP_MIN_CM, EG_GAP_MAX_CM, EG_RAIL_CLEAR, EG_DROP_CM, EG_DROP_LAW10_CM, EG_BEAT_HALF_MS } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egRouteLegs, egRouteSpanSteps } from '../../../src/net/eliteGates/egRouteProof.js';
import { egFragPassage, egFragChamber, egSetPiece, EG_FRAG_BROKEN_LAW, EG_ALCOVE_REACH_M } from '../../../src/net/eliteGates/egFragLaw.js';
import { EG_LAWS, egLawKnown } from '../../../src/net/eliteGates/egDurable.js';
import { egBreachNew, egTrialAwaits, EG_AWAIT_CLOCKS } from '../../../src/net/eliteGates/egBrain.js';
import { egRingSideOpen, EG_RING_WALL_SIDES } from '../../../src/net/eliteGates/egWalkGraph.js';
import { sweepStand, sweepCourse } from '../../../tools/egSpanSolve.mjs';
import { egRouteRoads } from '../../../src/net/eliteGates/egRouteProof.js';
import { sdRng } from '../../../src/net/superDungeon/sdBrain.js';

/** THE LAW PIN's 800 halls (test/net/eliteGates/law9_rooms.test.js's own): four seeds, two grounds, a hundred halls - laws 4 to 9
 *  hashed over them; law 10 over two of their seeds (its 400 halls lay in some three minutes - its whole 800 in some six). */
const LAW_HALLS = [];
for (const seed of [77, 0xbeef, 3, 12345]) for (const geo of [0, 4]) for (let h = 1; h <= 100; h++) LAW_HALLS.push([seed, h, geo]);
const L10_HALLS = LAW_HALLS.filter(([s]) => s === 77 || s === 3);
let _all = null;
const all = () => (_all ??= L10_HALLS.map(([s, h, g]) => egHallOf(s, h, g, 10)));
const hashOf = (specs) => { let acc = 0x811c9dc5; for (const q of specs) acc = Math.imul(acc ^ egSpecDigest(q), 0x01000193) >>> 0; return acc >>> 0; };
const at = (s) => `${s.seed}:${s.h}:${s.geo} (${s.kind})`;
/** The main way's longest stretch walked unbroken (m): walks, bridges and stairs between two span, climb or drop links. */
const longestOf = (s) => { let run = 0, best = 0; for (const g of egRouteLegs(s, 0)) { if (g.kind === 'span' || g.kind === 'climb' || g.kind === 'drop') { best = Math.max(best, run); run = 0; } else run += g.len; } return Math.max(best, run); };
/** A broken bridge's ground (route.courses marked `b`) and its pieces. */
const brokenOf = (s) => (s.route.courses ?? []).filter((g) => g.b).map((g) => ({ g, steps: s.steps.filter((q) => q.x >= g.x0 - 0.01 && q.x <= g.x1 + 0.01 && q.z >= g.z0 - 0.01 && q.z <= g.z1 + 0.01 && Math.abs(q.y - g.y0) < 0.01) }));
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };

test('EG-PERFECT THE BROKEN WAY - THE LAW PIN (section 22): spec law 10 is the law (EG_SPEC, net/eliteGates/egAscent.js EG_BROKEN_LAW, and its readers\' own - net/eliteGates/egFragLaw.js EG_FRAG_BROKEN_LAW, net/eliteGates/egSpanLaw.js EG_SOLVE_FLIGHT_LAW - pinned equal), kept in EG_LAWS from 2026-10-18 beside laws 4 to 9, each inside its seven days; laws 4 to 9 byte for byte (test/net/eliteGates/law9_rooms.test.js hashes their 800 halls); law 10\'s 400 hashed whole; a breach opened now records law 10 (mutants: law 10 not in the table; a reader\'s gate off its law)', () => {
  assert.deepEqual([EG_SPEC, EG_BROKEN_LAW, EG_FRAG_BROKEN_LAW, EG_SOLVE_FLIGHT_LAW], [10, 10, 10, 10]);
  assert.deepEqual({ ...EG_LAWS }, { 4: '2026-10-11', 5: '2026-10-12', 6: '2026-10-13', 7: '2026-10-13', 8: '2026-10-15', 9: '2026-10-16', 10: '2026-10-18' });
  assert.deepEqual([4, 5, 6, 7, 8, 9, 10, 11].map(egLawKnown), [true, true, true, true, true, true, true, false]);
  assert.ok((Date.parse(EG_LAWS[10]) - Date.parse(EG_LAWS[4])) / 86_400_000 <= 7, 'every law before inside its keep');
  // laws 4 to 9 byte for byte: test/net/eliteGates/law9_rooms.test.js hashes their 800 halls each (its law pin, unmoved)
  assert.equal(hashOf(all()), LAW10_HASH, 'law 10, as THE BROKEN WAY lays it');
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'a', o: 'A', ew: 0, rh: 0, seed: 77, op: 1_800_000_000_000, co: [['a', 'A', 1]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  assert.equal(B.egv, 10, 'a breach opened now is of law 10');
  for (const s of all()) assert.ok(s.v === 10 && s.law === 10, `${at(s)}: says its law`);
});
/** Law 10's 400 halls, hashed whole (the law pin - a change to any of them is a spec law of its own). */
const LAW10_HASH = 650998388;

test('EG-PERFECT THE BROKEN WAY - EVERY HALL LAYS AND STANDS (Elite-Gates-Ascent.md sections 1, 6, 7 and 8): each of the 400 is laid on a try the law gives (EG_RELAY_MAX, THE BROKEN WAY\'s own EG_BROKEN_TRIES, then the plainest), proven (egAscentProof - every course and every broken bridge by THE TIMED SOLVER where it stands, THE ROUTE\'S SANITY, the whole hall over THE ROUTE), said whole on the wire, inside the bound, its way rising and falling 10-30 m, no longer than EG_ROUTE_LEN_MAX_M nor slower than EG_ROUTE_S_MAX, through no more rooms than its kind draws; the plainest the rare last resort (mutants: the plan\'s own tries gone; a stretch\'s rooms never fewer)', (t) => {
  let worst = 0, plain = 0, last = 0;
  for (const s of all()) {
    assert.ok(s.laid < EG_RELAY_MAX + EG_BROKEN_TRIES + 1 + EG_ASCENT_LAST_TRIES + EG_ASCENT_HERO_TRIES, `${at(s)}: laid on a try the law gives`);
    const pr = egAscentProof(s);
    assert.ok(pr.ok, `${at(s)}: ${pr.why.slice(0, 3).join('; ')}`);
    const size = JSON.stringify(s).length;
    assert.ok(size <= EG_SPEC_SAID_MAX, `${at(s)}: ${size} characters`);
    for (const n of s.route.nodes) assert.ok(Math.abs(n[0]) <= 150 && n[2] >= -10 && n[2] <= 158 && Math.abs(n[1]) <= 60, `${at(s)}: a node at ${n} inside the bound`);
    const ys = s.route.main.map((i) => s.route.nodes[i][1]), rise = Math.max(...ys) - Math.min(...ys);
    assert.ok(rise >= 10 - 1e-9 && rise <= 30 + 1e-9, `${at(s)}: its way rises and falls ${rise} m`);
    assert.ok(s.rooms.length <= EG_ASCENT_ROOMS[s.kind][1], `${at(s)}: ${s.rooms.length} rooms`);
    const len = egRouteLength(s), secs = egRouteCross(s, 0).median;
    assert.ok(len <= EG_ROUTE_LEN_MAX_M && secs <= EG_ROUTE_S_MAX, `${at(s)}: ${len} m, ${secs} s`);
    worst = Math.max(worst, size); last = Math.max(last, s.laid);
    if (s.laid > EG_RELAY_MAX + EG_BROKEN_TRIES) plain++;
  }
  assert.ok(plain <= PLAIN_MAX, `${plain} of ${all().length} halls laid plainest`);
  t.diagnostic(`worst spec ${worst} chars, plainest ${plain}, last try ${last}`);
});
/** The plainest's bound over the 400 (law 9 laid 7% of its spans plainest, 12.8% from circle 11 - its Gale forks 89-98%). */
const PLAIN_MAX = 8;

test('EG-PERFECT THE BROKEN WAY - A BRIDGE BREAKS (Elite-Gates-Ascent.md section 8): every broken bridge\'s ground (`route.courses`\' `b`) holds EG_BROKEN_PIECES of one of its band\'s EG_BROKEN_KINDS (a turned one - along +x, -z or -x, `hd` - of the still kinds alone, EG_BROKEN_TURNED), each a gap of THE ENVELOPE past the last, at the Steps\' own timing (a Drift\'s swing and period, Beats half a cycle apart), a bridge\'s foot at either end; the way a bridge, a span over its pieces and a bridge; almost every hall breaks one, most break one turned, and the longest stretch the main way walks unbroken comes down (mutants: a bridge never broken; a turned bridge onto a Drift; a piece\'s gap off THE ENVELOPE; the turned course never read)', (t) => {
  let halls = 0, turnedHalls = 0, n = 0;
  const longest = [];
  for (const s of all()) {
    const B = brokenOf(s);
    if (B.length) halls++;
    if (s.steps.some((q) => q.hd)) turnedHalls++;
    longest.push(longestOf(s));
    for (const { g, steps } of B) {
      n++;
      assert.ok(steps.length >= EG_BROKEN_PIECES[0] && steps.length <= EG_BROKEN_MOST, `${at(s)}: ${steps.length} pieces on a broken bridge`);   // (PIN MOVED, THE AUDIT: a long bridge's more, to EG_BROKEN_MOST)
      const k = steps[0].kind, hd = steps[0].hd ?? 0;
      assert.ok(steps.every((q) => q.kind === k && (q.hd ?? 0) === hd), `${at(s)}: one kind, one heading`);
      assert.ok((hd ? EG_BROKEN_TURNED.filter((q) => EG_BROKEN_KINDS[s.band].includes(q)) : EG_BROKEN_KINDS[s.band]).includes(k), `${at(s)}: a ${k} breaks a bridge of band ${s.band} heading ${hd}`);
      for (const q of steps) assert.ok(q.gap >= EG_GAP_MIN_CM / 100 - 1e-9 && q.gap <= EG_GAP_MAX_CM / 100 + 1e-9, `${at(s)}: a gap of ${q.gap} m`);
      if (k === 'drift') for (const q of steps) assert.ok(q.amp >= 1 && q.amp <= 2 && q.period >= 4 && q.period <= 7, `${at(s)}: a Drift at the Steps' own swing`);
      if (k === 'beat') steps.forEach((q, i) => assert.equal(q.beat, (i % 2) * EG_BEAT_HALF_MS / 1000, `${at(s)}: Beats half a cycle apart`));
      // its feet: a bridge lane each side at its height
      const lane = (x, z) => s.lanes.some((l) => l.role === 'bridge' && Math.abs(l.y - g.y0) < 0.01 && Math.min(l.ax, l.bx) - l.hw - 0.01 <= x && x <= Math.max(l.ax, l.bx) + l.hw + 0.01 && Math.min(l.az, l.bz) - l.hw - 0.01 <= z && z <= Math.max(l.az, l.bz) + l.hw + 0.01);
      const L = steps.map(egStepLocal), first = L[0], lastP = L[L.length - 1];
      const back = (a) => { const [ac, al] = [first.x, a]; const u = [0, 1, 0, -1], c = [1, 0, -1, 0], h = hd; return [ac * u[(h + 1) % 4] + al * u[h], ac * c[(h + 1) % 4] + al * c[h]]; };
      const [nx, nz] = back(first.z - first.d / 2 - first.gap - EG_BROKEN_FOOT_CM / 200), [fx, fz] = back(lastP.z + lastP.d / 2 + lastP.after + EG_BROKEN_FOOT_CM / 200);
      assert.ok(lane(nx, nz) && lane(fx, fz), `${at(s)}: a bridge's foot either side of its break`);
      // its way: a span link over exactly its pieces
      const leg = egRouteLegs(s, 0).find((G) => G.kind === 'span' && G.steps.length && G.steps.every((q) => steps.includes(q)) && G.steps.length === steps.length);
      assert.ok(leg, `${at(s)}: its pieces one span of the main way`);
    }
  }
  assert.ok(halls >= 0.95 * all().length, `${halls} of ${all().length} halls break a bridge`);
  assert.ok(turnedHalls >= 0.8 * all().length, `${turnedHalls} of ${all().length} halls break one turned`);
  assert.ok(med(longest) <= LONGEST_MED, `the main way's longest unbroken walk, at its median, ${med(longest)} m`);
  t.diagnostic(`${n} broken bridges in ${halls} halls (${turnedHalls} turned), longest unbroken walk median ${med(longest).toFixed(1)} m`);
});
const LONGEST_MED = 200;

test('EG-PERFECT THE BROKEN WAY - A TURNED COURSE READ IN ITS OWN FRAME (net/eliteGates/egSpanLaw.js egStepLocal, egAlongOf; net/eliteGates/egRouteProof.js egRouteSpanSteps): a piece along +x, -z or -x is read across and along its heading - its top across and along it, its number, kind and clock its own; a span link along x takes the pieces of its line; its chain is THE TIMED SOLVER\'s chain of the same course laid along +z, window for window; a piece along +z is itself (mutants: the frame turned the wrong way; an x link\'s pieces never found; a turned chain meeting a +z one)', () => {
  // three Beats along +x from (10, 2, 50), each 2.6 m past the last; the same along +z
  const sz = { w: EG_STEP.beat.w / 100, d: EG_STEP.beat.d / 100 };
  const turned = [0, 1, 2].map((q) => ({ i: q, kind: 'beat', span: 0, x: 10 + 2.6 + sz.w / 2 + q * (2.6 + sz.w), y: 2, z: 50, w: sz.w, d: sz.d, amp: 0, period: 0, phase: 0, beat: (q % 2) * 1.8, gap: 2.6, road: 0, kit: '', after: q === 2 ? 2.6 : 0, ya: 2, hd: 1 }));
  const plain = [0, 1, 2].map((q) => ({ i: q, kind: 'beat', span: 0, x: 0, y: 2, z: 2.6 + sz.w / 2 + q * (2.6 + sz.w), w: sz.d, d: sz.w, amp: 0, period: 0, phase: 0, beat: (q % 2) * 1.8, gap: 2.6, road: 0, kit: '', after: q === 2 ? 2.6 : 0, ya: 2 }));
  assert.deepEqual(egAlongOf(1, 10, 50), [-50, 10], '+x: across is -z, along is x');
  assert.deepEqual(egAlongOf(2, 10, 50), [-10, -50], '-z: across is -x, along is -z');
  assert.deepEqual(egAlongOf(3, 10, 50), [50, -10], '-x: across is z, along is -x');
  const L = egStepLocal(turned[0]);
  assert.deepEqual([L.w, L.d, L.i, L.kind, L.beat], [sz.d, sz.w, 0, 'beat', 0], 'its top across and along its heading, its own number and clock');
  assert.equal(egStepLocal(plain[0]), plain[0], 'a piece along +z is itself');
  const pt = egSpanPairs({ steps: turned, law: 10 }), pp = egSpanPairs({ steps: plain, law: 10 });
  assert.equal(pt.length, pp.length, 'one chain');
  assert.deepEqual(pt.map((p) => [p.a?.i ?? -1, p.b?.i ?? -1]), pp.map((p) => [p.a?.i ?? -1, p.b?.i ?? -1]), 'the same pairs');
  const B = egSpanBuildOf(10);
  pt.forEach((p, k) => assert.deepEqual(egPairWindows(p, B), egPairWindows(pp[k], B), `pair ${k}: its windows the +z course's`));
  // a span link along x takes the pieces of its line, and no other
  const spec = { steps: [...turned, { ...plain[0], i: 3, x: 15, z: 60 }] };
  assert.deepEqual(egRouteSpanSteps(spec, [10, 2, 50], [26, 2, 50]).map((q) => q.i), [0, 1, 2]);
  assert.deepEqual(egRouteSpanSteps(spec, [26, 2, 50], [10, 2, 50]).map((q) => q.i), [0, 1, 2], 'either way it runs');
  // a turned piece never meets a +z one, however their numbers fall
  const mixed = egSpanPairs({ steps: [plain[0], { ...turned[1], i: 1 }], law: 10 });
  assert.ok(mixed.every((p) => !(p.a && p.b)), 'a turned piece and a +z one never one chain');
});

test('EG-PERFECT THE BROKEN WAY - THE FORK STANDS (section 11.4; the spans audit: "a bridge 4.50 m up" on every Gale-Swept fork): THE FORK\'s Low Road linked across to its first island by its bridge and on past its Drop, its passage and a Gale\'s islands by its own spans - its fork\'s course laid first (where the hall\'s bound holds its length: EG_FORK_COURSE_CM, its second passage left out past it; no trunk passage under two ranks of the decrees); from circle 2 a span forks, Gale or no Gale (mutants: the Low Road\'s islands all bridges; the fork\'s course second; its course unbounded)', () => {
  const spans = all().filter((s) => s.kind === 'span' && s.c >= 2), galeForks = spans.filter((s) => s.geo % 3 > 0 && s.fork);
  assert.ok(spans.filter((s) => s.fork).length >= 0.8 * spans.length, `${spans.filter((s) => s.fork).length} of ${spans.length} spans from circle 2 fork`);
  assert.ok(galeForks.length >= 1, 'a Gale-Swept span forks');
  for (const s of spans.filter((q) => q.fork)) {
    const low = s.route.links.filter((l) => l.road === 1 && l.kind === 'bridge');
    for (const l of low) assert.ok(Math.abs(s.route.nodes[l.a][1] - s.route.nodes[l.b][1]) <= 0.6, `${at(s)}: a Low Road bridge ${Math.abs(s.route.nodes[l.a][1] - s.route.nodes[l.b][1]).toFixed(2)} m up`);
    assert.ok(egRouteRoads(s).includes(1), `${at(s)}: its Low Road a road of its own`);
    // its course - the fork's island to the plate the roads meet at - inside the bound the plan holds it to
    const f = s.fork;
    assert.ok((f.plate - f.z) * 100 <= EG_FORK_COURSE_CM + EG_FORK_THIRD_CM, `${at(s)}: its course runs ${(f.plate - f.z).toFixed(1)} m past its fork`);
  }
  assert.equal(EG_FORK_COURSE_CM, 12500);
});

test('EG-PERFECT THE BROKEN WAY - A FIGHT HALL\'S DOOR FOLLOWS ITS TRIAL (the hall audit: the door 177-243 m past the trial, out of the closing\'s reach 76-100% of the time): a Rift-Yard\'s, an Athenaeum\'s and a Scriptorium\'s rooms all stand before its trial on the main way and its door\'s bridge leaves the trial\'s own ground; a Proving Walk\'s rooms all before its first course; and the relay holds such a trial\'s clocks (EG_AWAIT_CLOCKS) until its company stands on its floor (net/eliteGates/egBrain.js egTrialAwaits - law 10\'s yard, Athenaeum and Deepway; never the laws before) (mutants: rooms spread over every stretch; the door planned past more rooms; the clocks never held)', () => {
  const front = all().filter((s) => ['yard', 'athenaeum', 'scriptorium', 'proving'].includes(s.kind));
  assert.ok(front.length >= 20, `${front.length} fight halls`);
  for (const s of front) {
    const R = s.route, main = R.main, heroes = s.rooms.map((q) => s.heroes[q.h]);
    // the trial's ground: the course holding the fight's heart (a Proving Walk's first)
    const G = R.courses.filter((g) => !g.b), trial = s.kind === 'proving' ? G[0] : G.find((g) => s.fight && s.fight.x >= g.x0 - 1 && s.fight.x <= g.x1 + 1 && s.fight.z >= g.z0 - 1 && s.fight.z <= g.z1 + 1) ?? G[G.length - 1];
    const inT = (p) => p[0] >= trial.x0 - 0.05 && p[0] <= trial.x1 + 0.05 && p[2] >= trial.z0 - 0.05 && p[2] <= trial.z1 + 0.05 && p[1] >= trial.y0 - 0.5 && p[1] <= trial.y1 + 0.5;
    const inRoom = (p) => heroes.some((q) => p[0] >= q.box[0] - 0.05 && p[0] <= q.box[3] + 0.05 && p[2] >= q.box[2] - 0.05 && p[2] <= q.box[5] + 0.05 && p[1] >= q.box[1] - 0.5 && p[1] <= q.box[4] + 0.5);
    // (its first node on the trial's own ground - a room's mouth may stand inside the course's box, a Proving Walk's tower top)
    const firstIn = main.findIndex((i) => inT(R.nodes[i]) && !inRoom(R.nodes[i]));
    assert.ok(firstIn > 0, `${at(s)}: its way reaches its trial`);
    for (const i of main.slice(firstIn)) assert.ok(!inRoom(R.nodes[i]), `${at(s)}: no room on its way past its trial`);
    if (s.kind !== 'proving') {
      // the door's bridge leaves the trial's ground: the main way's last two links the door's (its bridge and its plate)
      const lastIn = main.findLastIndex((i) => inT(R.nodes[i]));
      assert.ok(main.length - 1 - lastIn <= 1, `${at(s)}: ${main.length - 1 - lastIn} links from its trial's ground to its door`);
    }
  }
  assert.deepEqual(EG_AWAIT_CLOCKS, ['waveAt', 'packAt', 'wanderAt', 'escortAt', 'ashAt', 'sparkAt', 'ventAt', 'quietUntil']);   // PIN MOVED (EG-PERFECT's audit): a Scriptorium's quiet held too
  // PIN MOVED (EG-PERFECT's audit): a Scriptorium's trial awaits its company too - its quiet ran from the wake while its rooms stood first
  for (const k of ['yard', 'athenaeum', 'deepway', 'scriptorium']) assert.equal(egTrialAwaits({ kind: k, law: 10 }), true, `law 10's ${k} awaits its company`);
  for (const k of ['span', 'court', 'rampart', 'proving', 'brink']) assert.equal(egTrialAwaits({ kind: k, law: 10 }), false, `a ${k} keeps its own time`);
  assert.equal(egTrialAwaits({ kind: 'yard', law: 9, v: 9 }), false, 'law 9\'s yard keeps the time it kept');
});

test('EG-PERFECT THE BROKEN WAY - APPROACHES OF TWO KINDS (section 8.6; the spans audit: every approach one kind, the first circle\'s `still`): a Court\'s, an Athenaeum\'s and a Proving Walk\'s first course draws two different kinds of its band\'s pieces in two runs (a Drift and a Beat in the first circle), an island between them at a Court from its sixth circle (mutants: one kind; the first circle still)', () => {
  const pick = all().filter((s) => (s.kind === 'court' || s.kind === 'athenaeum' || s.kind === 'proving'));
  assert.ok(pick.length >= 20);
  for (const s of pick) {
    const C = egAscentCourses(s).filter((c, k) => !s.route.courses[k].b), first = C[0].steps.filter((q) => (q.road ?? 0) === 0);
    const kinds = [];
    for (const q of first) { const k = q.kind === 'riser' ? 'beat' : q.kind; if (kinds[kinds.length - 1] !== k) kinds.push(k); if (kinds.length === 2) break; }
    assert.ok(kinds.length === 2 && kinds[0] !== kinds[1], `${at(s)}: its approach of ${kinds.join(', ')}`);
    if (s.c === 1) assert.deepEqual(kinds, ['drift', 'beat'], `${at(s)}: the first circle's a Drift and a Beat`);
  }
});

test('EG-PERFECT THE BROKEN WAY - THE ENVELOPE IN THE PASSAGES (section 10.4: "a gap is 2.4-3.2 m"; the traversal audit: the real motor ran through five of eight kits without a jump): from spec law 10 the Caverns\', the deep Caverns\', the Stacks\' and the Ossuary\'s chasms are as wide as their pieces at one gap of THE ENVELOPE, the Mist Stair\'s at its least; their length and width (the envelope a hero is baked to) and every law before\'s gaps unmoved (mutants: the chasm spread evenly as before; the Mist Stair\'s flights past its floors)', () => {
  const gaps = (kit, law, k = 0.37) => { const r = sdRng(1234 + Math.round(k * 1000)); const Q = egFragPassage(kit, r, { law }); return { Q, g: Q.course.map((q) => q.gap) }; };
  for (const kit of ['caverns', 'deep', 'stacks', 'ossuary', 'mist']) for (const k of [0.1, 0.5, 0.9]) {
    const { Q, g } = gaps(kit, 10, k), { Q: Q9, g: g9 } = gaps(kit, 9, k);
    assert.ok(g.every((v) => v >= EG_GAP_MIN_CM && v <= EG_GAP_MAX_CM), `${kit}: gaps ${g}`);
    assert.ok(g9.every((v) => v < EG_GAP_MIN_CM), `${kit}: law 9's ${g9} as it laid them`);
    assert.deepEqual([Q.len, Q.halfW], [Q9.len, Q9.halfW], `${kit}: its envelope unmoved`);
    assert.ok(Q.zA >= 200 && Q.len - Q.zB >= 200, `${kit}: its floors keep 2 m and more (${Q.zA}, ${Q.len - Q.zB})`);
    if (kit === 'mist') assert.ok(g.every((v) => v === EG_GAP_MIN_CM) && Q.yB === Q9.yB, 'the Mist Stair at the least gap, its foot as deep');
  }
  // and laid: every code-built passage of the 400 at THE ENVELOPE's gaps
  for (const s of all()) for (const f of s.frags) {
    if (f.cls !== 'passage' || f.hero || f.room || !['caverns', 'deep', 'stacks', 'ossuary', 'mist'].includes(f.kit)) continue;
    const own = s.steps.filter((q) => q.kit === f.kit && q.z > f.z0 && q.z < f.z1 && Math.abs(q.x - f.x) <= 2 && (q.road ?? 0) === (f.road ?? 0));
    for (const q of own) assert.ok(q.gap >= 2.4 - 1e-9 && q.gap <= 3.2 + 1e-9, `${at(s)}: ${f.kit}'s gap ${q.gap}`);
  }
});

test('EG-PERFECT THE BROKEN WAY - A DROP FALLS AND THE HIGH ROAD KEEPS TIME (the spans audit: no open-course Drop in 2,089 un-forked halls; half the High Roads padded with still slabs): a Drop drawn where its road stands at its floor falls EG_DROP_LAW10_CM to EG_DROP_CM below it (law 9 laid still slabs); a fork\'s High Road carried on past its Drop by Beats half a cycle apart, never a still slab (mutants: the Drop stilled; the padding still)', () => {
  for (const broken of [true, false]) {
    const S = egSpanOf(1, 1, 0, { r: sdRng(7), sizes: EG_STEP, start: { x: 0, y: 500, z: 0, r: 500 }, checkR: 300, floors: true, broken });
    S.run('drop', 1);
    const st = S.lay();
    if (broken) { assert.equal(st[0].kind, 'drop'); assert.ok(500 - S.y >= EG_DROP_LAW10_CM && 500 - S.y <= EG_DROP_CM, `fell ${500 - S.y} cm`); }
    else assert.ok(st.every((q) => q.kind === 'still') && S.y === 500, 'law 9: still slabs at its floor');
  }
  let padded = 0;
  for (const s of all().filter((q) => q.fork)) {
    const hi = s.steps.filter((q) => (q.road ?? 0) === 0 && Math.abs(q.y - s.fork.yLow) < 0.01 && Math.abs(q.x - s.fork.x) <= 2 && q.z > s.fork.z && q.z < s.fork.plate);
    const after = hi.filter((q, k) => k > 0 && hi[k - 1].kind === 'drop' || (k > 0 && hi.slice(0, k).some((p) => p.kind === 'drop')));
    for (const q of after) assert.notEqual(q.kind, 'still', `${at(s)}: a still slab padding its High Road`);
    padded += after.filter((q) => q.kind === 'beat').length ? 1 : 0;
  }
  assert.ok(padded >= 1, 'a High Road carried on by Beats');
});

test('EG-PERFECT THE BROKEN WAY - RAILS APART, A PENDULUM OVER THE WHOLE FLIGHT (the spans audit: rail neighbours met in 63 of 71 runs, 88 of 135 Forge Guts, 78 of 80 Forge Lines; 18% of a Pendulum\'s open launches flew through its weight): a run of Rails at one gap and one period, half a cycle apart, its travel under half the gap less EG_RAIL_CLEAR; the Forge\'s conveyors one belt; THE TIMED SOLVER refusing travelling neighbours that meet, and taking a Pendulum\'s weight at every twelfth of the flight (mutants: each Rail its own period; the neighbour held still; the Pendulum at its middle alone)', () => {
  const S = egSpanOf(1, 1, 1, { r: sdRng(11), sizes: EG_STEP, start: { x: 0, y: 0, z: 0, r: 500 }, checkR: 300, floors: true, broken: true });
  S.run('rail', 4);
  const R = S.lay();
  assert.equal(new Set(R.map((q) => q.gap)).size, 1, 'one gap');
  assert.equal(new Set(R.map((q) => q.period)).size, 1, 'one period');
  // PIN MOVED (EG-PERFECT's audit): half a cycle is π - net/eliteGates/egSpanLaw.js egPieceAt reads a Rail's phase (ms / 1000) as its angle,
  // and half the period read so turned them 172-258 degrees apart
  R.forEach((q, k) => { assert.equal(q.phase, (k % 2) * Math.round(Math.PI * 1000), 'half a cycle apart'); assert.ok(q.amp <= Math.floor((q.gap - EG_RAIL_CLEAR * 100) / 2), `travel ${q.amp} under half its gap less the clear`); });
  // laid in metres and proven: they never meet; two neighbours on their own periods (law 9's) do, and law 10 refuses them
  const m = (q, i) => ({ ...q, i, x: q.x / 100, y: q.y / 100, z: q.z / 100, w: q.w / 100, d: q.d / 100, amp: q.amp / 100, gap: q.gap / 100, period: q.period / 1000, phase: q.phase / 1000, after: 3 });
  const ok = R.map(m);
  assert.ok(!egSpanProof({ v: 10, steps: ok }).why.some((w) => /beside it - travelling/.test(w)), 'a law 10 run apart');
  const bad = ok.map((q, k) => ({ ...q, amp: 1.5, gap: 2.6, period: 6 + k * 1.3, phase: k * 1.5 }));
  let z = 0;
  for (const q of bad) { z += q.gap + q.d / 2; q.z = z; z += q.d / 2; }
  assert.ok(egSpanProof({ v: 10, steps: bad }).why.some((w) => /beside it - travelling/.test(w)), 'travelling neighbours that meet are refused');
  assert.ok(!egSpanProof({ v: 9, steps: bad }).why.some((w) => /beside it - travelling/.test(w)), 'law 9 held the neighbour still');
  for (const [kit, f] of [['forge', (r) => egFragPassage('forge', r, { law: 10 }).course.filter((q) => q.k === 'rail')], ['forgeline', (r) => egSetPiece('forgeline', r, { law: 10 }).course]]) {
    const c = f(sdRng(5));
    assert.ok(c.length >= 2 && c.every((q) => q.period === c[0].period && q.phase === c[0].phase), `${kit}: one belt`);
  }
  // A PENDULUM: some launch the law-9 solver lets through its weight, law 10's refuses (a real pair of a law 10 hall)
  let seen = 0;
  for (const s of all()) for (const p of egSpanPairs(s)) {
    if (p.b?.kind !== 'pend') continue;
    const w10 = egPairWindows(p, egSpanBuildOf(10)), w9 = egPairWindows(p, egSpanBuildOf(9));
    assert.ok(w10.open <= w9.open + 1e-9, `${at(s)}: the whole flight asks no less than its middle`);
    if (w10.open < w9.open - 1e-9) seen++;
  }
  assert.ok(seen >= 1, `${seen} Pendulums whose flight the middle alone let through`);
});

test('EG-PERFECT THE BROKEN WAY - THE HALLS\' FITTINGS WHERE A BODY REACHES THEM (the hall audit): from spec law 10 a chamber\'s alcove stands at its court\'s rim within reach (EG_ALCOVE_REACH_M of its floor) and its ring opens there (net/eliteGates/egWalkGraph.js egRingSideOpen - every reader of a ring); a balcony stands 4 m up and more; a Rampart\'s caster pillar on the side no bastion holds, its Gauntlet plate on its top; a Winch plate against the walkway; a Glade\'s braziers on its ground; a Captive\'s chains about its hero chamber\'s own line; a Reliquary Vault off its island\'s rim, a Proving Walk\'s a side span off its court (mutants: the alcove past the rim; the ring shut at it; the balcony as low as before; a pillar over a bastion; the plate on the stair; the winch plate adrift)', () => {
  // the chamber's law, alone
  const r = () => 0.5;   // an alcove drawn, on the +x side; a balcony at its range's middle
  const Q = egFragChamber('caverns', r, 2400, { law: 10, play: 'balcony' }), Q9 = egFragChamber('caverns', r, 2400, { law: 9, play: 'balcony' });
  const a = Q.alcoves[0], a9 = Q9.alcoves[0];
  assert.ok(a && Math.hypot(a.x, a.z) - 2400 <= EG_ALCOVE_REACH_M * 100 - 35 && Math.hypot(a.x, a.z) > 2400, `its alcove ${(Math.hypot(a.x, a.z) - 2400).toFixed(0)} cm past the rim`);
  assert.ok(Math.hypot(a9.x, a9.z) - 2400 > EG_ALCOVE_REACH_M * 100, 'law 9\'s out of reach');
  assert.ok(Q.floors.every((f) => f.y >= 400) && Q9.floors.some((f) => f.y < 400), 'a balcony 4 m up');
  const deep = egFragChamber('deep', () => 0.5, 1800, { law: 10 });
  assert.ok(deep.floors.every((f) => f.y === 400), 'the deep tide\'s dry floors 4 m up');
  for (const q of Q.ramps) assert.ok(Math.abs(q.y1 - q.y0) * 5 <= Math.hypot(q.bx - q.ax, q.bz - q.az) * 3 + 1, 'its stair no steeper than three in five');
  // the ring open at the alcove (law 10), shut there before
  const d = { x: 0, z: 0, r: 25.5, y: 0 }, spec10 = { law: 10, alcoves: [{ x: a.x / 100, z: a.z / 100, y: 0 }] }, spec9 = { v: 9, alcoves: spec10.alcoves };
  const open = (sp) => Array.from({ length: EG_RING_WALL_SIDES }, (_, k) => egRingSideOpen(sp, d, k)).filter(Boolean).length;
  assert.ok(open(spec10) > open(spec9), 'the ring opens at its alcove');
  // laid: the 400 halls' fittings
  let alcoves = 0, ramparts = 0;
  for (const s of all()) {
    // (the chamber's own: a passage's alcove in its wall may stand beside the ring - inside its chamber's length alone)
    const own = (q, w) => s.frags.some((f) => f.cls === 'chamber' && Math.abs(f.x - w.x) < 0.01 && q.z > f.z0 && q.z < f.z1);
    for (const w of (s.deco ?? []).filter((q) => q.t === 'wall' && q.kit)) for (const al of (s.alcoves ?? []).filter((q) => Math.abs(Math.hypot(q.x - w.x, q.z - w.z) - (w.r - 1.5)) < 3 && own(q, w))) {
      alcoves++;
      const R0 = w.r - (s.discs.some((q) => q.role === 'balcony' && Math.hypot(q.x - w.x, q.z - w.z) < w.r) ? 9 : 1.5);
      assert.ok(Math.hypot(al.x - w.x, al.z - w.z) - R0 <= EG_ALCOVE_REACH_M - 0.35 + 1e-6, `${at(s)}: an alcove within reach of its court`);
    }
    for (const q of s.discs.filter((q) => q.role === 'balcony')) for (const u of s.discs.filter((c) => c.role !== 'balcony' && c.y < q.y && Math.hypot(c.x - q.x, c.z - q.z) < c.r + q.r)) assert.ok(q.y - u.y >= 4 - 1e-6, `${at(s)}: a balcony ${(q.y - u.y).toFixed(2)} m over the ${u.role} under it`);
    if (s.kind === 'rampart') {
      ramparts++;
      const bast = s.discs.filter((q) => q.role === 'bastion'), pil = s.discs.filter((q) => q.role === 'pillar');
      for (const p of pil) assert.ok(!bast.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < b.r + p.r) || bast.filter((b) => Math.sign(b.x - s.walk.x) === Math.sign(p.x - s.walk.x) && Math.abs(b.z - p.z) < 11).length && bast.filter((b) => Math.sign(b.x - s.walk.x) === -Math.sign(p.x - s.walk.x) && Math.abs(b.z - p.z) < 11).length, `${at(s)}: a pillar over a bastion with a free side`);
      for (const sp of s.spots.pillar ?? []) { const p = pil.find((q) => Math.hypot(q.x - sp.x, q.z - sp.z) < 0.01); assert.ok(p && Math.hypot(sp.plate[0] - p.x, sp.plate[1] - p.z) <= p.r - 0.5, `${at(s)}: its Gauntlet plate on its pillar's top`); }
      for (const wq of s.discs.filter((q) => q.role === 'winch')) assert.ok(Math.abs(Math.abs(wq.x - s.walk.x) - wq.r - s.walk.halfW) < 0.01, `${at(s)}: its winch plate against the walkway`);
    }
    for (const b of s.spots.brazier ?? []) if (s.kind === 'court') assert.ok(s.discs.some((q) => Math.hypot(b.x - q.x, b.z - q.z) <= q.r + 1e-6), `${at(s)}: a brazier on its ground`);
    if (s.twist === 'vault') for (const v of s.spots.vault ?? []) {
      const onCourt = s.discs.some((q) => q.role === 'court' && Math.hypot(v.x - q.x, v.z - q.z) <= q.r + EG_ALCOVE_REACH_M + 1);
      assert.ok(!onCourt, `${at(s)}: its Vault taken only off its court`);
      const lane = s.lanes.find((l) => l.role === 'side' && (Math.hypot(l.bx - v.x, l.bz - v.z) < 4 || Math.hypot(l.ax - v.x, l.az - v.z) < 4));
      assert.ok(lane && !s.steps.some((q) => Math.abs(q.y - lane.y) < 0.5 && q.x >= Math.min(lane.ax, lane.bx) - lane.hw && q.x <= Math.max(lane.ax, lane.bx) + lane.hw && q.z >= Math.min(lane.az, lane.bz) - lane.hw && q.z <= Math.max(lane.az, lane.bz) + lane.hw), `${at(s)}: its side span over no piece`);
    }
  }
  assert.ok(ramparts >= 4 && alcoves >= 1, `${ramparts} Ramparts, ${alcoves} chamber alcoves`);
});

test('EG-PERFECT THE BROKEN WAY - THE REAL MOTOR CROSSES IT (tools/egSpanSolve.mjs - the sweep\'s pilot, a turned course crossed in its heading\'s frame): every proven road of seed 77\'s first circle and of a deeper circle walked by the real motor from the arrival plate to the door, its broken bridges - turned among them - jumped pair by pair (mutants: the pilot\'s frame unturned)', () => {
  for (const [seed, c, geo] of [[77, 1, 0], [3, 7, 4]]) {
    const S = sweepStand(seed, c, geo);
    let k = 0, turned = 0;
    for (const spec of S.specs) for (const road of egRouteRoads(spec)) {
      turned += spec.steps.filter((q) => q.hd).length;
      const r = sweepCourse(S, spec, road, 1_800_000_000 + 0.37 + 200 * k++);
      assert.ok(r.ok, `${seed}:${spec.h} road ${road}: ${r.step} - ${r.why}`);
    }
    assert.ok(turned > 0, `${seed} circle ${c}: a turned bridge crossed`);
    S.span.clear();
  }
});

test('EG-PERFECT THE AUDIT\'S HALLS (spec law 10; Elite-Gates-Ascent.md section 11, "The audit"): over the law pin\'s 400 law 10 halls - no Gust run laid straight on from a timed piece (THE TIMED SOLVER weighs no gust: the real motor fell where a Crumble went under it); no bridge of 30 m walked whole but one over another floor (an approach\'s long run laid as bridges of 18-25 m, each broken on its own; a break slid along its bridge to where it stands apart); a fork\'s High Road Drop falling its full height; no Drift swinging within a body\'s width of a room; every hall\'s way asking a jump; a lone piece a still slab in few broken bridges; seed 77\'s hall 92 its fork (mutants: a Gust drawn in an approach; the long run one bridge; the break only in the middle; a High Road Drop drawn; a swing tested against no joined leg; a hall of no jump kept; a lone still slab drawn; the fork first on the plan\'s own tries)', () => {
  let gust = 0, long = 0, hiDrop = 0, near = 0, noJump = 0, broken = 0, oneStill = 0, forks = 0;
  for (const s of all()) {
    const st = s.steps;
    for (let i = 1; i < st.length; i++) {
      const a = st[i - 1], b = st[i];
      if (b.kind === 'gust' && (a.road ?? 0) === (b.road ?? 0) && !a.hd && !b.hd && ['crumble', 'bone', 'beat', 'vent', 'sink'].includes(a.kind) && Math.abs(b.z - b.d / 2 - (b.gap ?? 0) - (a.z + a.d / 2)) < 0.01) gust++;
    }
    for (const l of s.lanes) {
      if (l.role !== 'bridge' || Math.hypot(l.bx - l.ax, l.bz - l.az) < 30) continue;
      const x0 = Math.min(l.ax, l.bx) - l.hw, x1 = Math.max(l.ax, l.bx) + l.hw, z0 = Math.min(l.az, l.bz) - l.hw, z1 = Math.max(l.az, l.bz) + l.hw;
      const over = [...s.lanes.filter((q) => q !== l).map((q) => [Math.min(q.ax, q.bx) - q.hw, Math.min(q.az, q.bz) - q.hw, Math.max(q.ax, q.bx) + q.hw, Math.max(q.az, q.bz) + q.hw, q.y]), ...s.discs.map((d) => [d.x - d.r, d.z - d.r, d.x + d.r, d.z + d.r, d.y]), ...(s.heroes ?? []).map((q) => [q.box[0], q.box[2], q.box[3], q.box[5], q.box[1]]), ...st.map((q) => [q.x - q.w / 2, q.z - q.d / 2, q.x + q.w / 2, q.z + q.d / 2, q.y])];
      if (!over.some((b) => b[2] > x0 && b[0] < x1 && b[3] > z0 && b[1] < z1 && Math.abs(b[4] - l.y) > 0.5)) long++;
    }
    if (s.fork) {
      forks++;
      const hi = st.filter((q) => (q.road ?? 0) === 0), j = hi.findLastIndex((q) => q.kind === 'drop');
      if (j > 0 && hi[j - 1].y - hi[j].y < EG_DROP_LAW10_CM / 100 - 0.01) hiDrop++;
    }
    for (const q of st.filter((p) => p.kind === 'drift')) for (const r of (s.heroes ?? []).filter((h) => h.room)) {
      const B = r.box;
      if (q.y + 0.1 < B[1] || q.y - 0.5 > B[4]) continue;
      if (Math.hypot(Math.max(0, B[0] - (q.x + q.w / 2 + q.amp), q.x - q.w / 2 - q.amp - B[3]), Math.max(0, B[2] - (q.z + q.d / 2), q.z - q.d / 2 - B[5])) < 0.35) near++;
    }
    if (!(s.route?.links ?? []).some((l) => l.kind === 'span')) noJump++;
    for (const g of (s.route?.courses ?? []).filter((q) => q.b)) {
      const ps = st.filter((q) => q.x >= g.x0 - 0.05 && q.x <= g.x1 + 0.05 && q.z >= g.z0 - 0.05 && q.z <= g.z1 + 0.05 && Math.abs(q.y - g.y0) < 0.6);
      broken++;
      if (ps.length === 1 && ps[0].kind === 'still') oneStill++;
    }
  }
  assert.equal(gust, 0, 'no Gust run on from a timed piece');
  assert.equal(long, 0, 'no bridge of 30 m walked whole over open void');
  assert.equal(hiDrop, 0, 'every High Road Drop its full fall');
  assert.equal(near, 0, 'no Drift\'s swing within a body of a room');
  assert.equal(noJump, 0, 'every way a jump');
  assert.ok(broken > 1000 && oneStill / broken < 0.08, `${oneStill} of ${broken} broken bridges one still slab`);
  assert.ok(forks >= 40 && egHallOf(77, 92, 0, 10).fork, `${forks} forks, seed 77's hall 92 among them`);
});
