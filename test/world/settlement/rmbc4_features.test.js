// A SETTLEMENT'S FEATURES STOOD. Every feature but a tree is one model in its style's stone on its own ground: a well, a
// fountain, a statue facing the way in, a market's stalls, a fort's walls and towers, a river town's docks, a garden's
// fence and beds. Its yard trees are the pixel's nature: a tree record every climate holds, on its pad's top, at the
// dressing's own points. A Hammerfell settlement and a Bay one. Pins mutation-checked (tools/mutants/rmbc4.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { featuresModel, featureSolids, stallsOf, FORT_WALL, FORT_TOWER, FENCE } from '../../../src/world/settlement/settlementFeatures.js';
import { MARKET_RING, featureReach } from '../../../src/world/settlement/settlementLimits.js';
import { validateSettlement } from '../../../src/world/settlement/settlementContract.js';
import { settlementGroundAt } from '../../../src/world/settlement/settlementGround.js';
import { generateSettlement, yardTrees, layoutSettlement, rowSquare, centreSpot } from '../../../src/world/settlement/settlementGen.js';
import { polarFrame } from '../../../src/world/settlement/settlementLayout.js';
import { DOCK_REACH, DOCK_OUT } from '../../../src/world/settlement/settlementLayout.js';
import { settlementTreeFlats, liveTreesOf, YARD_TREE_FALLBACK } from '../../../src/world/settlement/settlementStand.js';
import { TREE_RECORDS } from '../../../src/world/terrain/terrainNature.js';
import { padAt, edgeDistance, pointInRing, segmentRingDistance, distanceToSegment, segmentGap } from '../../../src/world/settlement/settlementGeometry.js';
import { art, CAPITAL_ART } from '../../../src/world/capitalShapes.js';
import { SYNTHETIC } from '../../../tools/settlementProbe.mjs';

const make = (archetype, style = 'Hammerfell') => {
  const input = { place: 9, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed: 7, archetype, style, site: { east: 400, north: 400, radius: 90 }, env: SYNTHETIC[archetype] };
  return { input, layout: layoutSettlement(input, SYNTHETIC[archetype]), plan: generateSettlement(input).plan };
};
const records = (m) => new Set(m.subMeshes.map((x) => `${x.textureArchive}/${x.textureRecord}`));
const key = (pic) => `${pic[0]}/${pic[1]}`;
/** The vertices of a model inside a box round a plan point (x east, z north). */
function near(m, at, reach) {
  const out = [];
  for (let i = 0; i < m.positions.length; i += 3) if (Math.abs(m.positions[i] - at[0]) <= reach && Math.abs(m.positions[i + 2] - at[1]) <= reach) out.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]]);
  return out;
}

test('FEATURES a well, a garden and a statue stand on their own ground in their style\'s stone; a tree is not modelled (mutants: the style\'s stone, the ground under it, a tree modelled)', () => {
  const { plan } = make('oasis'), datum = 50, m = featuresModel(plan, datum, 'Hammerfell');
  assert.ok(records(m).has(key(art(CAPITAL_ART.sandstone))), 'Hammerfell\'s sandstone');
  assert.ok(!records(featuresModel(plan, datum, 'Skyrim')).has(key(art(CAPITAL_ART.sandstone))) && records(featuresModel(plan, datum, 'Skyrim')).has(key(art(CAPITAL_ART.nordStone))), 'Skyrim\'s own');
  const well = plan.features.find((f) => f.kind === 'well'), top = datum + padAt(plan.pads, well.at).y;
  const at = near(featuresModel({ ...plan, features: [well] }, datum, 'Hammerfell'), well.at, 1.6);
  assert.ok(at.length > 20);
  assert.ok(Math.abs(Math.min(...at.map((v) => v[1])) - top) < 1e-4, 'its kerb\'s foot on its pad\'s top (a float32 model)');
  assert.ok(Math.max(...at.map((v) => v[1])) > top + 2.7, 'its roof over it');
  // a tree feature adds nothing: the pixel's nature stands it
  const trees = { ...plan, features: plan.features.filter((f) => f.kind === 'tree') };
  assert.ok(trees.features.length > 5);
  assert.equal(featuresModel(trees, datum).indices.length, 0);
  const fort = make('fort', 'HighRock'), statue = fort.plan.features.find((f) => f.kind === 'statue');
  const bronze = featuresModel({ ...fort.plan, features: [statue] }, datum, 'HighRock');
  assert.ok(records(bronze).has(key(art(CAPITAL_ART.bronze))), 'a bronze figure on its plinth');
});

test('FEATURES a fort\'s walls stand just outside its cells on the ground the carve leaves, sunk, crenellated, stepping round a taller sector on the shorter side; a tower projects at every corner and flanks its gate; a garden fenced round its plot (mutants: the step\'s side, the wall\'s line, the foot, the tower\'s corner, the gate\'s towers, the fence)', () => {
  const fort = make('fort', 'HighRock'), { plan, layout } = fort, datum = 20;
  const walls = plan.features.filter((f) => f.kind === 'wall'), towers = plan.features.filter((f) => f.kind === 'tower');
  assert.ok(walls.length > 3);
  // every run clear of every pad, so of every building, link and tree: the cells' rim is the wall's inner face
  for (const w of walls) for (let i = 0; i + 1 < w.path.length; i++) for (const pad of plan.pads) {
    assert.ok(segmentRingDistance(w.path[i], w.path[i + 1], pad.poly) >= FORT_WALL.thick / 2 + 0.2, `${w.id} run ${i} clear of ${pad.id}`);
  }
  assert.ok(walls.some((w) => w.path.some((p) => plan.pads.some((pad) => edgeDistance(p, pad.poly) < FORT_WALL.thick / 2 + 0.5))), 'and hard by it');
  // a step round a taller sector: a radial run beside the taller cell, on the side where no cell stands
  const g = layout.gateSectors[0], n = layout.sectors;
  const rims = layout.edges.map((_, j) => Math.max(...layout.cells.filter((c) => c.j === j && c.k > 0).map((c) => c.b)));
  assert.ok(rims.some((r, j) => Math.abs(r - rims[(j + 1) % n]) > 3), 'a ragged edge to step round');
  // a tower at every boundary with a wall beside it, the gate's two among them, each projecting outside its corner
  assert.equal(towers.length, n, 'one a corner');
  assert.ok(towers.some((t) => t.id === `tower${g}`) && towers.some((t) => t.id === `tower${(g + 1) % n}`), 'either side of the gate');
  // the gate's sides walled out to its own rim: the runs beside it end on its line
  const line = (j) => rims[j] + FORT_WALL.thick / 2 + 0.25, from = (p) => Math.hypot(p[0] - layout.c[0], p[1] - layout.c[1]);
  const before = walls.filter((w) => w.id.startsWith(`wall${(g + n - 1) % n}.`)).at(-1), after = walls.find((w) => w.id.startsWith(`wall${(g + 1) % n}.`));
  assert.ok(Math.abs(from(before.path.at(-1)) - line(g)) < 0.05 && Math.abs(from(after.path[0]) - line(g)) < 0.05, 'its sides closed');
  for (const t of towers) {
    assert.ok(plan.pads.every((pad) => !pointInRing(t.at, pad.poly) && edgeDistance(t.at, pad.poly) >= featureReach(t)), `${t.id} outside every cell`);
    const j = Number(t.id.slice(5)), top = Math.max(rims[j], rims[(j + n - 1) % n]);
    assert.ok(Math.abs(Math.hypot(t.at[0] - layout.c[0], t.at[1] - layout.c[1]) - (top + featureReach(t) + 0.25)) < 0.05, `${t.id} past its corner's taller rim, its eave too`);
  }
  // the wall's foot: the run's own ground, sunk; its merlons over its walk
  const one = { ...plan, features: [walls[0]] }, m = featuresModel(one, datum, 'HighRock');
  const ys = [];
  for (let i = 1; i < m.positions.length; i += 3) ys.push(m.positions[i]);
  const base = datum + Math.min(...walls[0].ground);
  assert.ok(Math.abs(Math.min(...ys) - (base - FORT_WALL.sink)) < 1e-3, `its foot sunk under its ground: ${Math.min(...ys)} for ${base - FORT_WALL.sink}`);
  assert.ok(Math.max(...ys) > base + FORT_WALL.h, 'its merlons over its walk');
  const rawGround = (p) => { const natural = SYNTHETIC.fort.heightAt(p[0], p[1]); return (settlementGroundAt(plan.pads, layout.datum, p[0], p[1], natural) ?? natural) - layout.datum; };
  for (const w of walls) for (const [i, y] of w.ground.entries()) assert.ok(Math.abs(y - Math.min(rawGround(w.path[i]), rawGround(w.path[i + 1]))) < 0.6 && y <= Math.min(rawGround(w.path[i]), rawGround(w.path[i + 1])) + 0.01, `${w.id} run ${i}: the lowest the carve leaves under it`);
  const tower = featuresModel({ ...plan, features: [towers[0]] }, datum, 'HighRock'), towerYs = [];
  for (let i = 1; i < tower.positions.length; i += 3) towerYs.push(tower.positions[i]);
  assert.ok(near(tower, towers[0].at, featureReach(towers[0]) + 1e-3).length === tower.positions.length / 3 && near(tower, towers[0].at, FORT_TOWER.r + 0.5).length < tower.positions.length / 3, 'a tower round its point, its eave its reach');
  assert.ok(Math.abs(Math.min(...towerYs) - (datum + towers[0].y - FORT_WALL.sink)) < 1e-3 && Math.max(...towerYs) > datum + towers[0].y + FORT_WALL.h + 2, 'on its own ground, sunk, over the walls');
  // the contract holds it: a wall moved onto a link, a tower onto a house, are refused
  const link = plan.links.find((l) => l.kind !== 'grade') ?? plan.links[0], house = plan.buildings[0];
  const codes = (features) => validateSettlement({ ...plan, footprint: undefined, features }).filter((p) => p.code === 'feature-blocks').length;
  assert.equal(codes(plan.features), 0);
  assert.ok(codes([...plan.features, { id: 'wallX', kind: 'wall', path: [link.a, link.b] }]) > 0, 'a wall across a way');
  assert.ok(codes([...plan.features, { id: 'towerX', kind: 'tower', at: house.at }]) > 0, 'a tower on a house');
  const garden = plan.features.find((f) => f.kind === 'garden'), plot = plan.plots.find((p) => `g${p.id}` === garden.id);
  const gm = featuresModel({ ...plan, features: [garden] }, datum, 'HighRock');
  for (const corner of plot.poly) assert.ok(near(gm, corner, 0.1).length > 0, 'a post at each corner');
  const ground = datum + padAt(plan.pads, garden.at).y, within = [];
  for (let i = 0; i < gm.positions.length; i += 3) if (edgeDistance([gm.positions[i], gm.positions[i + 2]], plot.poly) > 0.5 && pointInRing([gm.positions[i], gm.positions[i + 2]], plot.poly)) within.push(gm.positions[i + 1]);
  assert.ok(within.length > 20 && within.every((y) => y >= ground - 1e-6 && y < ground + FENCE.h), 'its beds within it, on its ground, under its rails');
  assert.ok(within.some((y) => y > ground + 0.4), 'greens over the soil');
});

test('FEATURES a fort on a coast walls only the dry ground its cells stand on: a run breaks at the water, no tower stands in it (mutants: the wet run, the wet tower)', () => {
  const water = (e, n) => n < 392;
  const env = { heightAt: (e, n) => (water(e, n) ? 30 : 36 + 0.002 * (e - 400)), waterAt: water };
  const input = { place: 9, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed: 0xdeadbeef, archetype: 'fort', style: 'IliacBay', site: { east: 400, north: 400, radius: 90 }, env };
  const { plan } = generateSettlement(input), layout = layoutSettlement(input, env);
  const walls = plan.features.filter((f) => f.kind === 'wall'), towers = plan.features.filter((f) => f.kind === 'tower');
  assert.ok(walls.length > 0 && towers.length > 0);
  const walled = new Set(walls.map((w) => Number(w.id.slice(4).split('.')[0]))), built = new Set(layout.cells.filter((c) => c.k > 0).map((c) => c.j));
  for (let j = 0; j < layout.sectors; j++) assert.equal(walled.has(j), built.has(j) && !layout.gateSectors.includes(j), `sector ${j}: walled where its cells stand`);
  assert.ok(built.size < layout.sectors, 'a side open to the sea');
  assert.ok(towers.length < layout.sectors, 'no tower in it');
  for (const w of walls) for (let i = 0; i + 1 < w.path.length; i++) for (let k = 0; k <= 8; k++) {
    const p = [w.path[i][0] + ((w.path[i + 1][0] - w.path[i][0]) * k) / 8, w.path[i][1] + ((w.path[i + 1][1] - w.path[i][1]) * k) / 8];
    assert.ok(!water(...p), `${w.id} dry`);
  }
  for (const t of towers) assert.ok(!water(...t.at) && !water(t.at[0], t.at[1] - FORT_TOWER.r), `${t.id} dry`);
});

test('FEATURES a river town\'s docks run from its quay to the water and on past its edge, at its quay\'s height; a wetland\'s market keeps its stalls on its square, clear of every way onto it (mutants: the dock\'s water, the dock\'s deck, the market\'s ring, the ways)', () => {
  const river = make('river', 'Sumurset'), datum = 10, env = SYNTHETIC.river;
  const docks = river.plan.features.filter((f) => f.kind === 'dock');
  assert.ok(docks.length > 2);
  for (const dock of docks) {
    assert.ok(padAt(river.plan.pads, [dock.path[0][0] + (dock.path[0][0] - dock.path[1][0]) * 0.02, dock.path[0][1] + (dock.path[0][1] - dock.path[1][1]) * 0.02]), `${dock.id} leaves a quay`);
    assert.ok(env.waterAt(...dock.path[1]), `${dock.id} ends over water`);
    assert.ok(!env.waterAt(...dock.path[0]), `${dock.id} starts on land`);
  }
  // a pond off to one side: a dock that faces no water within its reach is not built
  const pondAt = (e, n) => Math.hypot(e - 480, n - 400) < 40, pond = { heightAt: (e, n) => (pondAt(e, n) ? 30 : 36), waterAt: pondAt };
  const beside = generateSettlement({ ...river.input, env: pond }), pondDocks = beside.plan.features.filter((f) => f.kind === 'dock');
  assert.ok(pondDocks.length > 0 && pondDocks.length < Math.max(1, Math.floor(layoutSettlement(river.input, pond).size / 24)), 'some built, not all');
  assert.deepEqual(validateSettlement(beside.plan), [], 'its outline holds its docks, out to the pond');
  for (const dk of pondDocks) assert.ok(pondAt(...dk.path[1]) && Math.hypot(dk.path[1][0] - dk.path[0][0], dk.path[1][1] - dk.path[0][1]) <= DOCK_REACH + DOCK_OUT, `${dk.id} out to the pond`);
  // a coast cut by inlets: a dock reaches past its quay's outline to the water, and the outline holds it
  const inletAt = (e, n) => n < 380 - (Math.floor(e / 25) % 2 ? 16 : 0), inlets = { heightAt: (e, n) => (inletAt(e, n) ? 30 : 36 + 0.01 * (n - 380)), waterAt: inletAt };
  const cut = generateSettlement({ ...river.input, env: inlets }), long = cut.plan.features.filter((f) => f.kind === 'dock');
  assert.ok(long.some((dk) => Math.hypot(dk.path[1][0] - dk.path[0][0], dk.path[1][1] - dk.path[0][1]) > -layoutSettlement(river.input, inlets).vOut + 5), 'a dock out past the quay\'s own reach');
  assert.deepEqual(validateSettlement(cut.plan), [], 'its outline holds it');
  const dock = docks[0], d = featuresModel({ ...river.plan, features: [dock] }, datum, 'Sumurset');
  const quay = datum + padAt(river.plan.pads, dock.path[0])?.y;
  assert.ok(near(d, dock.path[1], 2).some((v) => Math.abs(v[1] - (quay + 0.1)) < 1e-4), 'its deck at its quay\'s height, out over the water');
  const wet = make('wetland', 'BlackMarsh'), centre = wet.plan.features.find((f) => f.kind === 'market');
  assert.ok(centre.size < MARKET_RING, 'its ring drawn in on a small square');
  const mk = featuresModel({ ...wet.plan, features: [centre] }, datum, 'BlackMarsh');
  assert.ok(records(mk).has(key(art(CAPITAL_ART.cloth))), 'cloth awnings');
  const plaza = wet.plan.pads.find((p) => p.id === 'plaza'), ways = wet.plan.links.filter((l) => l.from === 'plaza' || l.to === 'plaza'), reach = [];
  for (let i = 0; i < mk.positions.length; i += 3) {
    const p = [mk.positions[i], mk.positions[i + 2]];
    reach.push(Math.hypot(p[0] - centre.at[0], p[1] - centre.at[1]));
    assert.ok(pointInRing(p, plaza.poly), 'on its square');
  }
  assert.ok(Math.max(...reach) <= featureReach(centre) + 1e-3 && Math.min(...reach) > centre.size - 2.5, 'five stalls round its heart, its middle open');
  assert.ok(ways.length > 3);
  for (const l of ways) assert.ok(distanceToSegment(centre.at, l.a, l.b) >= featureReach(centre) + l.width / 2, `clear of ${l.id}`);
});

test('FEATURES the yard trees are the pixel\'s own live species on their pads\' tops: the trees the kernel laid there (a zone\'s carry their archive), never a dead one; none laid, the climate\'s live trees (mutants: a dead tree taken, the zone\'s archive dropped, the pad\'s top)', () => {
  assert.ok(Object.values(TREE_RECORDS).every((trees) => trees.includes(YARD_TREE_FALLBACK)), 'the fallback a tree in every climate');
  // the woodlands (504): its great dead oak (30) is never taken; a zone's pine carries its archive
  assert.deepEqual(liveTreesOf([{ record: 13 }, { record: 30 }, { record: 16 }, { record: 2 }, { record: 13 }], 504), [[13, null], [16, null]]);
  assert.deepEqual(liveTreesOf([{ record: 25, archive: 504 }, { record: 13 }], 502), [[25, 504], [13, null]]);
  assert.deepEqual(liveTreesOf([], 503), [[13, null], [30, null], [5, null]], 'none laid: the desert\'s live trees, its snags and thorn left out');
  for (const [archetype, style] of [['village', 'IliacBay'], ['oasis', 'Hammerfell']]) {
    const { input, layout, plan } = make(archetype, style);
    const dressed = plan.features.filter((f) => f.kind === 'tree').map((f) => [f.id, f.pad, f.at]);
    assert.deepEqual(yardTrees(input, layout).map((t) => [t.id, t.pad, t.at]), dressed, `${style}: the dressing's trees`);
    const flats = settlementTreeFlats({ input, layout }, [{ record: 13 }, { record: 16 }, { record: 30 }], 504);
    assert.equal(flats.length, dressed.length);
    for (const [i, f] of flats.entries()) {
      const pad = layout.pads.find((p) => p.id === dressed[i][1]);
      assert.deepEqual([f.x, f.y, f.z], [dressed[i][2][0], layout.datum + pad.y, dressed[i][2][1]]);
      assert.ok([13, 16].includes(f.record) && f.archive === undefined);
    }
    assert.equal(new Set(flats.map((f) => f.record)).size, 2, 'both live kinds');
  }
  const zone = settlementTreeFlats({ input: make('village').input, layout: make('village').layout }, [{ record: 25, archive: 506 }], 504);
  assert.ok(zone.length > 0 && zone.every((f) => f.record === 25 && f.archive === 506), 'a zone\'s tree, its archive with it');
  assert.deepEqual(settlementTreeFlats(null), []);
});

test('FEATURES no yard tree on a deck, nor in a walled town\'s outer band where its wall stands (mutants: the deck, the wall\'s band)', () => {
  const wet = make('wetland', 'BlackMarsh');
  const raised = new Set(wet.layout.cells.filter((c) => c.raised).map((c) => c.id));
  assert.ok(raised.size > 0 && yardTrees(wet.input, wet.layout).every((t) => !raised.has(t.pad)));
  const fort = make('fort', 'HighRock'), outer = new Set(fort.layout.cells.filter((c) => c.k === fort.layout.reachOf[c.j]).map((c) => c.id));
  const trees = yardTrees(fort.input, fort.layout);
  assert.ok(trees.length > 5 && trees.every((t) => !outer.has(t.pad)), 'clear of the wall');
  const open = make('village', 'IliacBay');
  assert.ok(yardTrees(open.input, open.layout).some((t) => open.layout.cells.find((c) => c.id === t.pad).k === open.layout.reachOf[open.layout.cells.find((c) => c.id === t.pad).j]), 'an open village\'s outer band has its trees');
});

test('FEATURES a row town\'s heart: its feature on the open plot nearest the middle of its arc, the garden there given up, no house moved; a river town\'s fountain in its style\'s marble (mutants: the row unhearted, the garden kept, the marble)', () => {
  for (const [archetype, style, kind] of [['river', 'IliacBay', 'fountain'], ['mining', 'Skyrim', 'well']]) {
    const { input, plan } = make(archetype, style);
    const centre = plan.features.find((f) => f.id === 'centre');
    assert.ok(centre && centre.kind === kind, `${archetype}: its ${kind}`);
    const plot = plan.plots.find((p) => pointInRing(centre.at, p.poly));
    assert.ok(plot && !plan.buildings.some((b) => b.anchor === plot.id) && !plan.features.some((f) => f.id === `g${plot.id}`), 'an open plot, its garden given up');
    assert.deepEqual(validateSettlement(plan).filter((p) => p.code === 'feature-blocks'), []);
    const open = generateSettlement({ ...input, published: [] }).plan.buildings.map((b) => b.anchor);
    assert.deepEqual(plan.buildings.map((b) => b.anchor), open, 'every house where it was');
  }
  const river = make('river', 'IliacBay').plan, fountain = { ...river, features: [river.features.find((f) => f.id === 'centre')] };
  assert.ok(records(featuresModel(fountain, 10, 'Sumurset')).has(key(art(CAPITAL_ART.marble))) && !records(featuresModel(fountain, 10, 'IliacBay')).has(key(art(CAPITAL_ART.marble))), 'marble where its style is');
});

test('FEATURES the details: a statue turned to the way in, water in a well, a market\'s five awnings, a dock\'s posts down into the water, rails at their two heights with one post at each corner, an authored field\'s rows and fence\'s rails (mutants: the facing, the water, the stalls, the posts, the rails, the corners, the field, the fence)', () => {
  const fort = make('fort', 'HighRock').plan, statue = fort.features.find((f) => f.kind === 'statue'), gate = fort.gates[0].at, B = art(CAPITAL_ART.bronze);
  const lean = (at) => {
    const m = featuresModel({ ...fort, gates: [{ ...fort.gates[0], at }], features: [statue] }, 0, 'HighRock'), way = [gate[0] - statue.at[0], gate[1] - statue.at[1]], length = Math.hypot(...way);
    let sum = 0, n = 0;
    for (const sm of m.subMeshes) if (sm.textureArchive === B[0] && sm.textureRecord === B[1]) for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i++) { const v = m.indices[i]; sum += ((m.positions[v * 3] - statue.at[0]) * way[0] + (m.positions[v * 3 + 2] - statue.at[1]) * way[1]) / length; n++; }
    return sum / n;
  };
  assert.ok(lean(gate) > 0.01 && lean([2 * statue.at[0] - gate[0], 2 * statue.at[1] - gate[1]]) < -0.01, 'its figure turned toward the gate');
  const oasis = make('oasis').plan, well = oasis.features.find((f) => f.kind === 'well');
  assert.ok(records(featuresModel({ ...oasis, features: [well] }, 0, 'Hammerfell')).has(key(art(CAPITAL_ART.water))), 'water in it');
  const wet = make('wetland', 'BlackMarsh').plan, market = featuresModel({ ...wet, features: [wet.features.find((f) => f.kind === 'market')] }, 0, 'BlackMarsh');
  const C = art(CAPITAL_ART.cloth), cloth = market.subMeshes.filter((sm) => sm.textureArchive === C[0] && sm.textureRecord === C[1]).reduce((n, sm) => n + sm.primitiveCount, 0);
  assert.equal(cloth, 5 * 12, 'five awnings, a box each');
  const river = make('river', 'Sumurset').plan, dock = river.features.find((f) => f.kind === 'dock'), deck = padAt(river.pads, dock.path[0]).y + 0.1;
  const dm = featuresModel({ ...river, features: [dock] }, 0, 'Sumurset'), length = Math.hypot(dock.path[1][0] - dock.path[0][0], dock.path[1][1] - dock.path[0][1]);
  let deep = 0;
  for (let i = 1; i < dm.positions.length; i += 3) if (Math.abs(dm.positions[i] - (deck - 3.2)) < 1e-3) deep++;
  assert.equal(deep, (Math.floor(length / 3) + 1) * 2 * 18, 'a post each side every 3 m, 3.2 m down from the deck (a box\'s face, 18 corners of its triangles)');
  // an authored plan's field and fence, and a garden's rails: two rails over the ground, one post at a corner
  const square = [[10, 10], [22, 10], [22, 18], [10, 18]], pad = { id: 'p', poly: [[0, 0], [40, 0], [40, 40], [0, 40]], y: 2 };
  const authored = (features) => featuresModel({ pads: [pad], plots: [{ id: 'yard', pad: 'p', poly: square }], features }, 0, 'IliacBay');
  const field = authored([{ id: 'f', kind: 'field', pad: 'p', at: [30, 30] }]), fence = authored([{ id: 'r', kind: 'fence', path: [[2, 2], [2, 12]] }]);
  assert.ok(field.indices.length > 0 && near(field, [30, 30], 6.01).length === field.positions.length / 3, 'its rows within its square');
  assert.ok(fence.indices.length > 0 && near(fence, [2, 7], 5.2).length === fence.positions.length / 3, 'its rails along its path');
  const railYs = new Set();
  for (let i = 1; i < fence.positions.length; i += 3) railYs.add(Math.round((fence.positions[i] - 2) * 100) / 100);
  const beyond = authored([{ id: 'r', kind: 'fence', path: [[44, 2], [44, 12]] }]);
  let lowest = Infinity;
  for (let i = 1; i < beyond.positions.length; i += 3) lowest = Math.min(lowest, beyond.positions[i]);
  assert.ok(Math.abs(lowest - 2) < 1e-4, 'off every pad, its posts on the nearest one\'s ground');
  for (const share of [0.4, 0.85]) assert.ok(railYs.has(Math.round((share * FENCE.h + 0.05) * 100) / 100), `a rail at ${share} of its height`);
  const garden = authored([{ id: 'gyard', kind: 'garden', pad: 'p', at: [16, 14] }]);
  let tops = 0;
  for (let i = 1; i < garden.positions.length; i += 3) if (Math.abs(garden.positions[i] - (2 + FENCE.h)) < 1e-4) tops++;
  const posts = square.reduce((n, p, i) => n + Math.max(1, Math.round(Math.hypot(square[(i + 1) % 4][0] - p[0], square[(i + 1) % 4][1] - p[1]) / FENCE.post)), 0);
  assert.equal(tops, posts * 18, 'a post\'s top each, none twice at a corner');
});

test('FEATURES a row town\'s heart keeps clear of a house: the open plot nearest its middle passed over where a house stands within the feature\'s reach (mutant: the houses unread)', () => {
  const frame = polarFrame([0, 0]), pad = { id: 'c1.0', poly: [[-30, 0], [30, 0], [30, 40], [-30, 40]], y: 0 };
  const layout = /** @type {any} */ ({ pads: [pad], cells: [{ id: 'c1.0', k: 1 }], links: [] });
  const gardens = [{ id: 'gA', kind: 'garden', pad: 'c1.0', at: [0, 20] }, { id: 'gB', kind: 'garden', pad: 'c1.0', at: [12, 20] }];
  assert.equal(rowSquare('fountain', frame, layout, gardens, [], 0)?.garden.id, 'gA', 'the nearer its middle');
  const house = { fp: [[-3, 22], [3, 22], [3, 30], [-3, 30]] };
  assert.equal(rowSquare('fountain', frame, layout, gardens, [house], 0)?.garden.id, 'gB', 'a house within its reach: the next');
  assert.equal(rowSquare('fountain', frame, layout, [{ id: 'g0', kind: 'garden', pad: 'c1.0', at: [0, 1] }, ...gardens], [], 0)?.garden.id, 'gA', 'one by its pad\'s rim passed over');
  const way = { ...layout, links: [{ id: 'l0', a: [-6, 22], b: [6, 22], width: 2 }] };
  assert.equal(rowSquare('fountain', frame, way, gardens, [], 0)?.garden.id, 'gB', 'a way two metres off: within its body\'s reach and half the way');
  const plots = new Map([['A', { id: 'A', poly: [[-1.5, 14], [1.5, 14], [1.5, 26], [-1.5, 26]] }], ['B', { id: 'B', poly: [[6, 14], [18, 14], [18, 26], [6, 26]] }]]);
  assert.equal(rowSquare('fountain', frame, layout, gardens, [], 0, plots)?.garden.id, 'gB', 'a plot too narrow for its body passed over');
});

test('FEATURES a district drawn again draws its own yard trees again and no other\'s (mutant: the district\'s seed unread)', () => {
  const { input, layout } = make('village', 'IliacBay'), sector = (t) => layout.cells.find((c) => c.id === t.pad).j;
  const was = yardTrees(input, layout);
  const changed = new Set(), kept = new Set();
  for (let j = 0; j < layout.sectors; j++) {
    const again = yardTrees({ ...input, districtSeeds: { [`d${j}`]: 0x5eed + j } }, layout);
    const ids = (list, own) => list.filter((t) => (sector(t) === j) === own).map((t) => t.id).join();
    if (ids(again, true) !== ids(was, true)) changed.add(j);
    if (ids(again, false) === ids(was, false)) kept.add(j);
  }
  assert.ok(changed.size >= layout.sectors / 2, `${changed.size} of ${layout.sectors} districts drawn afresh`);
  assert.equal(kept.size, layout.sectors, 'every other district\'s trees kept');
});

test('FEATURES a fort\'s gate opens clear: no tower and no wall within a metre of the way straight out of it, whichever sector stands taller (mutants: the gate\'s tower set back, its step, the run stopped short)', () => {
  let gates = 0;
  for (const style of ['HighRock', 'Hammerfell', 'Skyrim']) for (let seed = 1; seed <= 14; seed++) {
    const { plan, report } = generateSettlement({ place: 9, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed, archetype: 'fort', style, site: { east: 400, north: 400, radius: 90 }, env: SYNTHETIC.fort });
    if (!report.ok) continue;
    for (const g of plan.gates) {
      const c = report.centre, d = Math.hypot(g.at[0] - c[0], g.at[1] - c[1]), end = [g.at[0] + ((g.at[0] - c[0]) / d) * 14, g.at[1] + ((g.at[1] - c[1]) / d) * 14];
      for (const t of plan.features.filter((f) => f.kind === 'tower')) assert.ok(distanceToSegment(t.at, g.at, end) >= featureReach(t) + 1, `${style} ${seed}: ${t.id} out of the way`);
      for (const w of plan.features.filter((f) => f.kind === 'wall')) for (let i = 0; i + 1 < w.path.length; i++) {
        assert.ok(segmentGap(w.path[i], w.path[i + 1], g.at, end) >= FORT_WALL.thick / 2 + 1, `${style} ${seed}: ${w.id} out of the way`);
        for (const pad of plan.pads) assert.ok(segmentRingDistance(w.path[i], w.path[i + 1], pad.poly) >= FORT_WALL.thick / 2, `${style} ${seed}: ${w.id} off ${pad.id}`);
      }
      gates++;
    }
  }
  assert.ok(gates > 30, `${gates} gates`);
});

test('FEATURES the solids a body may not stand in: a fort\'s every wall run, a tower out to its eave, a market\'s stalls on its own ring (mutants: the walls, the eave, the ring)', () => {
  const { plan } = make('fort', 'HighRock'), solids = featureSolids(plan), wall = plan.features.find((f) => f.kind === 'wall'), tower = plan.features.find((f) => f.kind === 'tower');
  const middle = [(wall.path[0][0] + wall.path[1][0]) / 2, (wall.path[0][1] + wall.path[1][1]) / 2];
  assert.ok(solids.some((ring) => pointInRing(middle, ring)), 'its wall\'s run');
  const out = [tower.at[0] - make('fort', 'HighRock').layout.c[0], tower.at[1] - make('fort', 'HighRock').layout.c[1]], far = Math.hypot(...out);
  const eave = [tower.at[0] + (out[0] / far) * (FORT_TOWER.r + FORT_TOWER.eave - 0.1), tower.at[1] + (out[1] / far) * (FORT_TOWER.r + FORT_TOWER.eave - 0.1)];   // out past its wall
  assert.ok(solids.some((ring) => pointInRing(eave, ring)), 'its tower to its eave');
  const market = { ...plan, features: [{ id: 'm', kind: 'market', pad: 'plaza', at: [0, 0], size: 3.5 }] };
  for (const stall of stallsOf([0, 0], 'm', 3.5)) assert.ok(featureSolids(market).some((ring) => pointInRing(stall, ring)), 'a stall on its drawn-in ring');
});

test('FEATURES the ground under the coast and the walls as it is: a tower whose ring the shore cuts is not built; a run\'s foot is its lowest ground, a dip mid-run too; a dock stops at a narrow river\'s far bank (mutants: the tower\'s centre alone, a run\'s ends alone, the far bank)', () => {
  const dry = make('fort', 'HighRock'), towers = dry.plan.features.filter((f) => f.kind === 'tower'), t = towers[1];
  const away = [t.at[0] - dry.layout.c[0], t.at[1] - dry.layout.c[1]], length = Math.hypot(...away), pool = [t.at[0] + (away[0] / length) * 3.2, t.at[1] + (away[1] / length) * 3.2];
  const wetAt = (e, n) => Math.hypot(e - pool[0], n - pool[1]) < 1.5, coast = { heightAt: (e, n) => (wetAt(e, n) ? 30 : SYNTHETIC.fort.heightAt(e, n)), waterAt: wetAt };
  const cut = generateSettlement({ ...dry.input, env: coast }).plan;
  assert.ok(!wetAt(...t.at) && !cut.features.some((f) => f.id === t.id), 'the tower its pool reaches into, gone');
  // a trench under a deck fort's wall run, its middle: the land's own ground, no carve holding it
  const decks = make('fort', 'Valenwood'), wall = decks.plan.features.find((f) => f.kind === 'wall' && f.path.length > 2), [a, b] = [wall.path[1], wall.path[2]], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const trench = { heightAt: (e, n) => SYNTHETIC.fort.heightAt(e, n) - (Math.hypot(e - mid[0], n - mid[1]) < 1.2 ? 2.5 : 0) };
  const dipped = generateSettlement({ ...decks.input, env: trench }).plan.features.find((f) => f.id === wall.id);
  assert.ok(dipped.ground[1] < wall.ground[1] - 1.5, `its foot down into the trench: ${dipped.ground[1]} for ${wall.ground[1]}`);
  // a river five metres wide, land beyond it
  const riverAt = (e, n) => n < 357.5 && n > 352.5, narrow = { heightAt: (e, n) => (riverAt(e, n) ? 30 : 36 + 0.002 * n), waterAt: riverAt };
  const docks = generateSettlement({ ...make('river', 'Sumurset').input, env: narrow }).plan.features.filter((f) => f.kind === 'dock');
  assert.ok(docks.length > 0 && docks.every((d) => riverAt(...d.path[1])), 'every dock ends over the river, none on its far bank');
});

test('FEATURES a wall run never buried by the ground it climbs: on a steep slope each stretch takes its own foot; no hairline step between two wall lines (mutants: one foot a run, the hairline)', () => {
  const steep = { heightAt: (e, n) => 40 + 0.75 * (e - 400) + 0.2 * (n - 400) };
  const input = { ...make('fort', 'Valenwood').input, env: steep }, { plan } = generateSettlement(input), datum = layoutSettlement(input, steep).datum;
  const walls = plan.features.filter((f) => f.kind === 'wall');
  assert.ok(walls.length > 0);
  for (const w of walls) for (let i = 0; i + 1 < w.path.length; i++) {
    const [a, b] = [w.path[i], w.path[i + 1]], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    assert.ok(length >= 0.1, `${w.id} run ${i}: no hairline (${length.toFixed(3)} m)`);
    let top = -Infinity;
    for (let k = 0; k <= 20; k++) {
      const [e, n] = [a[0] + ((b[0] - a[0]) * k) / 20, a[1] + ((b[1] - a[1]) * k) / 20], natural = steep.heightAt(e, n);
      top = Math.max(top, settlementGroundAt(plan.pads, datum, e, n, natural) ?? natural);   // the ground as the carve leaves it
    }
    assert.ok(top - (datum + w.ground[i]) <= FORT_WALL.h - 1, `${w.id} run ${i}: its top over the ground it climbs`);
  }
});

test('FEATURES no fort draws a hairline step where two sectors\' wall lines nearly meet; a square\'s feature looks outward from its preferred distance when every spot inward is taken (mutants: the hairline, the inward search alone)', () => {
  let runs = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const { plan } = generateSettlement({ ...make('fort', 'HighRock').input, seed });
    for (const w of plan.features.filter((f) => f.kind === 'wall')) for (let i = 0; i + 1 < w.path.length; i++, runs++) assert.ok(Math.hypot(w.path[i + 1][0] - w.path[i][0], w.path[i + 1][1] - w.path[i][1]) >= 0.1, `seed ${seed}: ${w.id} run ${i}`);
  }
  assert.ok(runs > 1000);
  const frame = polarFrame([0, 0]), ring = Array.from({ length: 32 }, (_, i) => frame.toW((i / 32) * 2 * Math.PI, 30));
  const spokes = Array.from({ length: 24 }, (_, i) => ({ id: `l${i}`, from: 'plaza', to: `c${i}`, a: [0, 0], b: frame.toW((i / 24) * 2 * Math.PI, 12), width: 1 }));
  const spot = centreSpot('well', frame, /** @type {any} */ ({ cells: [{ id: 'plaza', poly: ring }], links: spokes }), 0.13, 5);
  assert.ok(spot && Math.hypot(...spot.at) > 12, `outward past the spokes: ${spot && Math.hypot(...spot.at)}`);
});
