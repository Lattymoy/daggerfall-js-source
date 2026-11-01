// A SETTLEMENT'S FEATURES STOOD. Every feature but a tree is one model in its style's stone on its own ground: a well, a
// fountain, a statue facing the way in, a market's stalls, a fort's walls and towers, a river town's docks, a garden's
// fence and beds. Its yard trees are the pixel's nature: a tree record every climate holds, on its pad's top, at the
// dressing's own points. A Hammerfell settlement and a Bay one. Pins mutation-checked (tools/mutants/rmbc4.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { featuresModel, FORT_WALL, FENCE } from '../../../src/world/settlement/settlementFeatures.js';
import { generateSettlement, yardTrees, layoutSettlement } from '../../../src/world/settlement/settlementGen.js';
import { settlementTreeFlats, YARD_TREE_RECORDS } from '../../../src/world/settlement/settlementStand.js';
import { TREE_RECORDS } from '../../../src/world/terrain/terrainNature.js';
import { padAt, edgeDistance, pointInRing } from '../../../src/world/settlement/settlementGeometry.js';
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

test('FEATURES a fort\'s walls run its rim on the ground under each end, sunk, crenellated; its towers stand at their points; a garden fenced round its plot (mutants: the wall\'s base, the towers, the fence)', () => {
  const { plan } = make('fort', 'HighRock'), datum = 20;
  const walls = plan.features.filter((f) => f.kind === 'wall'), towers = plan.features.filter((f) => f.kind === 'tower');
  assert.ok(walls.length > 3 && towers.length === walls.length, 'a wall between each pair of towers but the gate\'s');
  const one = { ...plan, features: [walls[0]] }, m = featuresModel(one, datum, 'HighRock');
  const ys = [];
  for (let i = 1; i < m.positions.length; i += 3) ys.push(m.positions[i]);
  const base = Math.min(...walls[0].path.map((p) => datum + (padAt(plan.pads, p)?.y ?? Infinity)).filter(Number.isFinite));
  assert.ok(Math.abs(Math.min(...ys) - (base - FORT_WALL.sink)) < 0.5, `its foot sunk under its ground: ${Math.min(...ys)} for ${base - FORT_WALL.sink}`);
  assert.ok(Math.max(...ys) > base + FORT_WALL.h, 'its merlons over its walk');
  const tower = featuresModel({ ...plan, features: [towers[0]] }, datum, 'HighRock');
  const towerYs = [];
  for (let i = 1; i < tower.positions.length; i += 3) towerYs.push(tower.positions[i]);
  assert.ok(tower.indices.length > 0 && near(tower, towers[0].at, 4).length === tower.positions.length / 3, 'a tower round its point');
  assert.ok(Math.max(...towerYs) > base + FORT_WALL.h + 3, 'over the walls');
  const garden = plan.features.find((f) => f.kind === 'garden'), plot = plan.plots.find((p) => `g${p.id}` === garden.id);
  const g = featuresModel({ ...plan, features: [garden] }, datum, 'HighRock');
  for (const corner of plot.poly) assert.ok(near(g, corner, 0.1).length > 0, 'a post at each corner');
  const ground = datum + padAt(plan.pads, garden.at).y, within = [];
  for (let i = 0; i < g.positions.length; i += 3) if (edgeDistance([g.positions[i], g.positions[i + 2]], plot.poly) > 0.5 && pointInRing([g.positions[i], g.positions[i + 2]], plot.poly)) within.push(g.positions[i + 1]);
  assert.ok(within.length > 20 && within.every((y) => y >= ground - 1e-6 && y < ground + FENCE.h), 'its beds within it, on its ground, under its rails');
  assert.ok(within.some((y) => y > ground + 0.4), 'greens over the soil');
});

test('FEATURES a river town\'s docks run out from its quay at its height; a wetland\'s market stands its stalls round its heart (mutants: the dock\'s deck, the stalls)', () => {
  const river = make('river', 'Sumurset'), datum = 10;
  const dock = river.plan.features.find((f) => f.kind === 'dock');
  const d = featuresModel({ ...river.plan, features: [dock] }, datum, 'Sumurset');
  const quay = datum + padAt(river.plan.pads, dock.path[0]).y;
  assert.ok(near(d, dock.path[1], 2).some((v) => Math.abs(v[1] - (quay + 0.1)) < 1e-4), 'its deck at its quay\'s height, out over the water');
  const wet = make('wetland', 'BlackMarsh'), centre = wet.plan.features.find((f) => f.kind === 'market');
  const mk = featuresModel({ ...wet.plan, features: [centre] }, datum, 'BlackMarsh');
  assert.ok(records(mk).has(key(art(CAPITAL_ART.cloth))), 'cloth awnings');
  const reach = [];
  for (let i = 0; i < mk.positions.length; i += 3) reach.push(Math.hypot(mk.positions[i] - centre.at[0], mk.positions[i + 2] - centre.at[1]));
  assert.ok(Math.max(...reach) < 7.5 && Math.min(...reach) > 2.5, 'five stalls round its heart, its middle open');
});

test('FEATURES the yard trees are the dressing\'s own and the pixel\'s nature: a tree record every climate holds, on its pad\'s top (mutants: a record one climate lacks, the pad\'s top, the dressing\'s draw)', () => {
  for (const [archive, trees] of Object.entries(TREE_RECORDS)) for (const r of YARD_TREE_RECORDS) assert.ok(trees.includes(r), `${r} a tree in ${archive}`);
  for (const [archetype, style] of [['village', 'IliacBay'], ['oasis', 'Hammerfell']]) {
    const { input, layout, plan } = make(archetype, style);
    const dressed = plan.features.filter((f) => f.kind === 'tree').map((f) => [f.id, f.pad, f.at]);
    assert.deepEqual(yardTrees(input, layout).map((t) => [t.id, t.pad, t.at]), dressed, `${style}: the dressing's trees`);
    const flats = settlementTreeFlats({ input, layout });
    assert.equal(flats.length, dressed.length);
    for (const [i, f] of flats.entries()) {
      const pad = layout.pads.find((p) => p.id === dressed[i][1]);
      assert.deepEqual([f.x, f.y, f.z], [dressed[i][2][0], layout.datum + pad.y, dressed[i][2][1]]);
      assert.ok(YARD_TREE_RECORDS.includes(f.record));
    }
    assert.ok(new Set(flats.map((f) => f.record)).size === YARD_TREE_RECORDS.length, 'both kinds of tree');
  }
  assert.deepEqual(settlementTreeFlats(null), []);
});
