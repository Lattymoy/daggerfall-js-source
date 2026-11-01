// THE THIRD LAYOUT: A BRANCHING STREET TREE (settlementTree.js). A green at the heart, a trunk street through it from gate
// to gate, lanes off both at an angle, narrower lanes off those; every street a straight pad with plots either side, cut
// into terraces. Hrolfsfork, the tenth published settlement, is laid out so. Pins mutation-checked
// (tools/mutants/rmbc2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSettlement, dressSettlement, layoutSettlement, yardTrees } from '../../../src/world/settlement/settlementGen.js';
import { settlementPrint } from '../../../src/world/settlement/settlementContract.js';
import { distanceToSegment, padAt, edgeDistance } from '../../../src/world/settlement/settlementGeometry.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { greenSpot, hull, CHUNK_MAX, CHUNK_MIN } from '../../../src/world/settlement/settlementTree.js';
import { cellBarred } from '../../../src/world/settlement/settlementLayout.js';
import { featureReach, FEATURE_CLEAR, TREE_CLEAR } from '../../../src/world/settlement/settlementLimits.js';
import { SETTLEMENT_ROWS } from '../../../src/world/settlement/settlementPlaces.js';
import { SYNTHETIC } from '../../../tools/settlementProbe.mjs';

const PLACE = ((0x342 << 20) | 0x80000 | 9) >>> 0;
const input = (o = {}) => ({ place: PLACE, origin: { px: 1500, py: 100, east: 0, north: 0 }, seed: 4, archetype: 'lanes', style: 'Skyrim', site: { east: 409.6, north: 409.6, radius: 90 }, env: SYNTHETIC.lanes, ...o });
const laid = (o = {}) => { const i = input(o), L = layoutSettlement(i, i.env); return { i, L, made: dressSettlement(i, L) }; };
const dir = (bearing) => [Math.sin(bearing), Math.cos(bearing)], right = (bearing) => [Math.cos(bearing), -Math.sin(bearing)];
/** A point's place along a street and across it. */
const local = (seg, p) => { const d = dir(seg.bearing), r = right(seg.bearing), q = [p[0] - seg.start[0], p[1] - seg.start[1]]; return { along: q[0] * d[0] + q[1] * d[1], across: q[0] * r[0] + q[1] * r[1] }; };

test('TREE the shape: a green, two trunks from it, lanes off the trunks and the green, a narrower lane off a lane; every street on its pad down its middle, ranked by its kind, its pads no longer than CHUNK_MAX (mutants: the forks, the twigs, the ranks)', () => {
  const { L, made } = laid();
  assert.equal(made.report.ok, true, JSON.stringify(made.report.problems));
  assert.equal(L.layout, 'tree');
  const kinds = L.streets.map((s) => s.role);
  assert.deepEqual(kinds.slice(0, 2), ['trunk', 'trunk']);
  assert.ok(kinds.filter((k) => k === 'lane').length >= 4, kinds.join());
  assert.ok(L.streets.filter((s) => s.parent === 'plaza').length === 4, 'the trunks and a lane either side of the green');
  const twig = L.streets.find((s) => s.role === 'twig');
  assert.ok(twig && L.streets[twig.parent].role === 'lane', 'a twig off a lane');
  assert.ok(twig.width < L.streets[0].width, 'narrower');
  const segs = new Map(L.streets.map((s) => [s.index, s]));
  for (const street of made.plan.streets) {
    const cell = L.cells.find((c) => c.id === street.pad), seg = segs.get(cell.j);
    assert.equal(street.rank, { trunk: 'main', lane: 'side', twig: 'alley' }[seg.role], street.id);
    for (const p of street.path) assert.ok(Math.abs(local(seg, p).across) < 0.02, `${street.id} down its pad's middle`);
    assert.ok(cell.alongTo - cell.alongFrom <= CHUNK_MAX + 0.01 && (cell.alongTo - cell.alongFrom >= CHUNK_MIN - 0.01 || cell.alongTo === seg.length || cell.alongFrom === 0), `${cell.id} ${cell.alongFrom}..${cell.alongTo}`);
  }
});

test('TREE the ways: every pad reached from the green; each street\'s terraces joined end to end down its middle, and a lane\'s first joined to its parent from the parent\'s street edge to its own street (mutants: the links\' ends, a lane\'s link)', () => {
  const { L, made } = laid();
  const segs = new Map(L.streets.map((s) => [s.index, s])), cells = new Map(L.cells.map((c) => [c.id, c]));
  const reach = new Set(['plaza']);
  for (let grew = true; grew;) { grew = false; for (const l of made.plan.links) if (reach.has(l.from) !== reach.has(l.to)) { reach.add(l.from); reach.add(l.to); grew = true; } }
  assert.equal(reach.size, made.plan.pads.length, 'all reached');
  for (const l of made.plan.links) {
    const f = cells.get(l.from), t = cells.get(l.to), seg = segs.get(t.j);
    if (f.j === t.j) {
      assert.ok(Math.abs(local(seg, l.a).across) < 0.02 && Math.abs(local(seg, l.b).across) < 0.02, `${l.id} down the street`);
      assert.ok(Math.abs(local(seg, l.a).along - t.alongFrom + 2.5) < 0.02, `${l.id} at the break`);
    } else if (f.id !== 'plaza') {
      const parent = segs.get(f.j), at = local(parent, l.a);
      assert.ok(Math.abs(Math.abs(at.across) - (parent.width / 2 + 0.5)) < 0.02 && Math.sign(at.across) === seg.side, `${l.id} leaves its parent's street edge on the lane's side`);
      assert.ok(Math.abs(local(seg, l.b).across) < 0.02 && Math.abs(local(seg, l.b).along - 2.5) < 0.02, `${l.id} lands on the lane's street`);
    } else assert.ok(Math.abs(local(seg, l.a).across) < 0.02, `${l.id} off the green down the street's own line`);
  }
});

test('TREE the plots: none in a lane\'s window or before a lane\'s landing; each house\'s door to its street, facing it; the green\'s well on the green clear of every way onto it (mutants: the windows, the landing, the facing, the green\'s clearance)', () => {
  const { L, made } = laid();
  const segs = new Map(L.streets.map((s) => [s.index, s])), cells = new Map(L.cells.map((c) => [c.id, c]));
  for (const plot of made.plan.plots) {
    const cell = cells.get(plot.pad), seg = segs.get(cell.j), pts = plot.poly.map((p) => local(seg, p));
    const lo = Math.min(...pts.map((p) => p.along)), hi = Math.max(...pts.map((p) => p.along)), side = Math.sign(pts[0].across);
    for (const w of seg.windows) if (w.side === side) assert.ok(hi <= w.from + 0.02 || lo >= w.to - 0.02, `${plot.id} out of the window ${w.from}..${w.to}`);
    if (cell.alongFrom === 0 && seg.parent !== 'plaza') assert.ok(lo >= 4 - 0.02, `${plot.id} past the lane's landing`);
  }
  for (const b of made.plan.buildings) {
    const seg = segs.get(cells.get(b.pad).j), door = local(seg, b.entrances[0].at), mid = local(seg, b.at);
    assert.ok(Math.abs(door.across) < Math.abs(mid.across), `${b.anchor}'s door on its street's side`);
    const face = (b.yaw * Math.PI) / 180, toward = [Math.sin(face), Math.cos(face)], r = right(seg.bearing);
    assert.ok(Math.abs(toward[0] * r[0] + toward[1] * r[1] + Math.sign(mid.across)) < 1e-6, `${b.anchor} faces its street`);
  }
  const well = made.plan.features.find((f) => f.id === 'centre');
  assert.ok(well && well.kind === 'well' && well.pad === 'plaza' && padAt(made.plan.pads, well.at)?.id === 'plaza');
  for (const l of made.plan.links.filter((x) => x.from === 'plaza' || x.to === 'plaza')) assert.ok(distanceToSegment(well.at, l.a, l.b) >= featureReach(well) + l.width / 2 + FEATURE_CLEAR - 1e-6, l.id);
  const square = [[0, 0], [30, 0], [30, 30], [0, 30]], across = { pads: [{ id: 'plaza', poly: square }], links: [{ id: 'x', from: 'plaza', to: 't0.0', a: [15, 15], b: [15, 40], width: 4 }], c: [15, 15], inner: 15, uStart: 0 };
  const moved = greenSpot('well', across), reach = featureReach({ kind: 'well' });
  assert.ok(moved && distanceToSegment(moved.at, [15, 15], [15, 40]) >= reach + 2 + FEATURE_CLEAR - 1e-6, 'a way across the middle: the well beside it');
  assert.ok(edgeDistance(moved.at, square) >= reach + FEATURE_CLEAR - 1e-6, 'and still on the green');
  const small = { ...across, pads: [{ id: 'plaza', poly: [[0, 0], [12, 0], [12, 12], [0, 12]] }], links: [{ ...across.links[0], a: [6, -10], b: [6, 40] }], c: [6, 6], inner: 6 };
  assert.equal(greenSpot('well', small), null, 'a small green with a way across it: no well');
  const market = greenSpot('market', L);
  assert.ok(market && market.size > 0 && market.pad === 'plaza', 'a market drawn in to fit');
  assert.equal(greenSpot('none', L), null);
  // the services: the green's beside it, the gates' on a trunk's outermost terrace
  const near = { Tavern: 'plaza', Temple: 'plaza', GeneralStore: 'gate', Armorer: 'gate' };
  for (const b of made.plan.buildings) {
    const name = Object.keys(BUILDING_TYPES).find((k) => BUILDING_TYPES[k] === b.type), cell = cells.get(b.pad);
    if (near[name] === 'plaza') assert.equal(cell.k, 1, `${name} beside the green`);
    if (near[name] === 'gate') assert.ok(segs.get(cell.j).role === 'trunk' && cell.k === Math.max(...L.cells.filter((c) => c.j === cell.j).map((c) => c.k)), `${name} out toward a gate`);
  }
});

test('TREE the gates and the yards: a gate at each end of the trunk on its street; yard trees behind the plots, none in a window, none on a way; the outline the hull of every pad (mutants: a gate\'s end, the trees\' windows, their ways)', () => {
  const { i, L, made } = laid();
  const segs = new Map(L.streets.map((s) => [s.index, s])), cells = new Map(L.cells.map((c) => [c.id, c]));
  assert.equal(made.plan.gates.length, 2);
  for (const [n, g] of made.plan.gates.entries()) {
    const cell = cells.get(g.pad), seg = segs.get(cell.j), at = local(seg, g.at);
    assert.ok(cell.j === n && seg.role === 'trunk' && Math.abs(at.across) < 0.02 && Math.abs(at.along - (cell.alongTo - 1)) < 0.02, g.id);
    assert.equal(cell.alongTo, Math.max(...L.cells.filter((c) => c.j === n).map((c) => c.alongTo)), 'its trunk\'s far end');
  }
  const trees = yardTrees(i, L);
  assert.ok(trees.length > 10);
  for (const t of trees) {
    const cell = cells.get(t.pad), seg = segs.get(cell.j), at = local(seg, t.at);
    for (const w of seg.windows) if (w.side === Math.sign(at.across)) assert.ok(at.along <= w.from - TREE_CLEAR + 0.02 || at.along >= w.to + TREE_CLEAR - 0.02, t.id);
    for (const l of made.plan.links) assert.ok(distanceToSegment(t.at, l.a, l.b) >= l.width / 2 + TREE_CLEAR - 1e-6, `${t.id} off ${l.id}`);
  }
  assert.deepEqual(made.plan.footprint, hull(made.plan.pads.flatMap((p) => p.poly)));
  assert.deepEqual(hull([[0, 0], [2, 0], [1, 1], [2, 2], [0, 2], [1, 0]]), [[0, 0], [2, 0], [2, 2], [0, 2]], 'a hull drops what lies inside and on its edges');
});

test('TREE the trunk\'s way: as published, else out along a road, else along the slope\'s contour so it stands level; on a slope its lanes climb in terraces by stairs (mutants: the fix unread, the road unread, the contour turned)', () => {
  const deg = (L) => ((L.streets[0].bearing * 180) / Math.PI % 360 + 360) % 360;
  assert.ok(Math.abs(deg(laid({ fix: { layout: 'tree', bearing: 30 } }).L) - 30) < 1e-9, 'published');
  assert.ok(Math.abs(deg(laid({ roads: [120] }).L) - 120) < 1e-9, 'a road\'s');
  const slope = laid({ env: SYNTHETIC.mining });   // the ground rises north
  assert.ok(Math.abs(Math.cos(slope.L.streets[0].bearing)) < 0.1, `the trunk across the fall: ${deg(slope.L)}`);
  assert.equal(slope.made.report.ok, true, JSON.stringify(slope.made.report.problems));
  assert.ok(slope.made.report.relief > 8 && slope.made.plan.links.some((l) => l.kind === 'stairs'), 'terraces and their stairs');
  const spread = (kind) => { const ys = slope.L.cells.filter((c) => slope.L.streets.find((s) => s.index === c.j)?.role === kind).map((c) => c.h); return Math.max(...ys) - Math.min(...ys); };
  assert.ok(spread('trunk') < spread('lane'), `the trunk nearer level (${spread('trunk').toFixed(1)} m) than its lanes (${spread('lane').toFixed(1)} m)`);
});

test('TREE its ground keeps it: a lane cut short where it would meet water or barred ground, a deck town raised on posts, every plan to the contract (mutants: the water, the bars, the deck)', () => {
  const barred = (e) => e > 470 && e < 520;
  const bars = laid({ env: { ...SYNTHETIC.lanes, blockedAt: (e) => barred(e) } });
  assert.equal(bars.made.report.ok, true, JSON.stringify(bars.made.report.problems));
  const env = { heightAt: () => 0, blockedAt: (e) => barred(e) };
  for (const pad of bars.made.plan.pads) assert.equal(cellBarred(pad.poly, env, undefined), false, `${pad.id} off the barred ground`);
  assert.ok(bars.made.plan.pads.length < laid().made.plan.pads.length, 'a lane cut short');
  const wet = laid({ env: { ...SYNTHETIC.lanes, waterAt: (e) => e < 380 } });
  assert.equal(wet.made.report.ok, true);
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], nine = (poly) => [...poly, ...poly.map((p, k) => mid(p, poly[(k + 1) % 4])), mid(poly[0], poly[2])];
  for (const c of wet.L.cells) if (c.id !== 'plaza') assert.ok(nine(c.poly).filter(([e]) => e < 380).length <= 2, `${c.id} three parts dry`);
  assert.ok(wet.L.cells.length < laid().L.cells.length, 'its lanes cut short at the water');
  const deck = laid({ style: 'Valenwood' });
  assert.equal(deck.made.report.ok, true, JSON.stringify(deck.made.report.problems));
  assert.ok(deck.made.plan.pads.every((p) => p.base === 'raised'), 'on decks');
});

test('TREE one draw: the same inputs lay the same plan, the worker\'s hand-off dresses to it, another seed another; a district drawn afresh moves its own plots alone (mutants: the tree unseeded, a district\'s draw shared)', () => {
  const a = laid(), b = laid();
  assert.equal(settlementPrint(a.made.plan), settlementPrint(b.made.plan));
  const handed = JSON.parse(JSON.stringify(a.L));
  assert.equal(settlementPrint(dressSettlement(a.i, handed).plan), settlementPrint(a.made.plan));
  assert.notEqual(settlementPrint(laid({ seed: 5 }).made.plan), settlementPrint(a.made.plan));
  assert.notDeepEqual(laid({ seed: 5 }).L.streets, a.L.streets, 'its streets drawn by the seed');
  const lane = a.L.streets.find((s) => s.role === 'lane'), fresh = dressSettlement({ ...a.i, districtSeeds: { [`d${lane.index}`]: 99 } }, a.L).plan;
  const byDistrict = (plan, mine) => plan.plots.filter((p) => (p.district === `d${lane.index}`) === mine).map((p) => p.id + JSON.stringify(p.poly)).join();
  assert.equal(byDistrict(fresh, false), byDistrict(a.made.plan, false), 'every other district as it was');
  assert.notEqual(byDistrict(fresh, true), byDistrict(a.made.plan, true), 'its own drawn afresh');
});

test('TREE Hrolfsfork: the tenth published settlement, a village of lanes in Skyrim, its trunk\'s way fixed; laid on its archetype\'s ground it keeps the contract (mutant: the bearing unpublished)', () => {
  const row = SETTLEMENT_ROWS.find((r) => r.name === 'Hrolfsfork');
  assert.ok(row && row.archetype === 'lanes' && row.style === 'Skyrim' && row.fix.layout === 'tree' && Number.isFinite(row.fix.bearing));
  const made = generateSettlement(input({ place: PLACE, seed: row.seed, fix: row.fix, site: row.site, ledger: { place: PLACE, ...row.ledger } }));
  assert.equal(made.report.ok, true, JSON.stringify(made.report.problems));
  assert.ok(Math.abs(made.report.bearing - row.fix.bearing) < 0.01);
});
