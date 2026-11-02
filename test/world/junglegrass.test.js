// JUNGLE-GRASS (2026-10-19, the owner: "Grass isnt showing within the new jungle region"). BANTHA2's floor carpets the
// jungle's ground with a second field of the grass system - the owner's tall tuft and archive 500's sedge, ferns, fronds,
// broad leaves, palmlets and blooms - and keeps the meadow's own grass out of every point it claims (the meadow's colour law
// would take the jungle's red earth's hue: render/jungleFloorArt.js). The owner thinned that floor from 2.5 plants a square
// metre to 1.8 ("Reduce the amount of ground flora. Its a little too much"), and at 1.8 its tufts and sedge stood 0.88 a
// square metre - two fifths of the 2.27 the meadow stands everywhere else - so the jungle read as leaves on bare mud. Now
// the floor's FLORA stands at the rate the owner judged, plant for plant, and its GRASS at the meadow's own rate.
// bible/03-World/Bantha-Jungle.md "The floor".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUNGLE_FLOOR_PLANTS, JUNGLE_FLOOR_JUDGED, JUNGLE_FLOOR_GRASS, JUNGLE_FLOOR_PLANTS_M2, floorPick } from '../../src/render/jungleFloorArt.js';
import { MEADOW_BLADES_PER_TUFT, MEADOW_LUSH } from '../../src/render/grassMeadow.js';
import { LAB_GRASS, ladderPick } from '../../src/render/labGrass.js';
import { JUNGLE_FLOOR, floorDensity } from '../../src/scenes/jungleFloorHost.js';

/** the floor the owner judged at 1.8 a square metre: each plant's share at the poor end and the lush (the last the rest) */
const JUDGED = { grass: [0.42, 0.3], sedge: [0.16, 0.1], fern: [0.12, 0.2], frond: [0.1, 0.16], broadleaf: [0.05, 0.08], palmlet: [0.06, 0.07], bloom: [0.04, 0.05], spike: [0.05, 0.04] };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('JUNGLE-GRASS the floor\'s grass is the meadow\'s own: its tufts and sedge a square metre, at the mean of the patch\'s ends, are the meadow\'s plants a square metre (its blades over the lab\'s measuring span, three a tuft) - where the judged floor stood two fifths of it (mutants: the grass the judged floor\'s; the meadow\'s blades taken for its tufts)', () => {
  const meadow = LAB_GRASS.density / MEADOW_BLADES_PER_TUFT / (2 * LAB_GRASS.densitySpan) ** 2;
  assert.ok(near(JUNGLE_FLOOR_GRASS, meadow));
  assert.ok(near(meadow, 2.2675736961451247, 1e-12), 'the meadow\'s 2.27 at the grass row\'s Full');
  const grassAt = (end) => JUNGLE_FLOOR_PLANTS.filter((p) => p.grass).reduce((s, p) => s + p.share[end], 0) * JUNGLE_FLOOR_PLANTS_M2;
  assert.ok(near((grassAt(0) + grassAt(1)) / 2, meadow, 1e-9), `the floor's grass at the meadow's rate (${((grassAt(0) + grassAt(1)) / 2).toFixed(3)})`);
  assert.ok(grassAt(0) > grassAt(1), 'a poor patch keeps more grass than a lush one, as it did');
  const judgedGrass = [0, 1].map((end) => (JUDGED.grass[end] + JUDGED.sedge[end]) * JUNGLE_FLOOR_JUDGED);
  assert.ok((judgedGrass[0] + judgedGrass[1]) / 2 < 0.45 * meadow, 'the judged floor\'s grass: under half the meadow\'s - the report');
  assert.deepEqual(JUNGLE_FLOOR_PLANTS.filter((p) => p.grass).map((p) => p.name), ['grass', 'sedge']);
});

test('JUNGLE-GRASS the flora stands as the owner judged it, plant for plant: a fern, a frond, a broad leaf, a palmlet, a bloom and a spike as many a square metre at each end of the patch as at 1.8 - none thicker for the grass (mutants: the flora scaled with the grass; the judged rate moved)', () => {
  assert.equal(JUNGLE_FLOOR_JUDGED, 1.8, 'the owner\'s ("Its a little too much" at 2.5)');
  for (const p of JUNGLE_FLOOR_PLANTS.filter((x) => !x.grass)) {
    for (const end of [0, 1]) assert.ok(near(p.share[end] * JUNGLE_FLOOR_PLANTS_M2, JUDGED[p.name][end] * JUNGLE_FLOOR_JUDGED, 1e-12), `${p.name} at the ${end ? 'lush' : 'poor'} end`);
  }
  // the tuft and the sedge keep their judged proportion
  for (const end of [0, 1]) {
    const [g, s] = JUNGLE_FLOOR_PLANTS.slice(0, 2).map((p) => p.share[end]);
    assert.ok(near(g / s, JUDGED.grass[end] / JUDGED.sedge[end], 1e-12));
  }
});

test('JUNGLE-GRASS the floor\'s plants a square metre are its grass and its flora: every end\'s shares whole, the last the rest; the host\'s density and the vertex stage\'s ladder read them (mutants: the plants the judged 1.8; a share past the byte)', () => {
  for (const end of [0, 1]) assert.ok(near(JUNGLE_FLOOR_PLANTS.reduce((s, p) => s + p.share[end], 0), 1, 1e-12), `the ${end ? 'lush' : 'poor'} end whole`);
  const flora = [0, 1].map((end) => Object.entries(JUDGED).filter(([k]) => k !== 'grass' && k !== 'sedge').reduce((s, [, v]) => s + v[end], 0));
  assert.ok(near(JUNGLE_FLOOR_PLANTS_M2, JUNGLE_FLOOR_GRASS + (JUNGLE_FLOOR_JUDGED * (flora[0] + flora[1])) / 2, 1e-12));
  assert.equal(JUNGLE_FLOOR.plants, JUNGLE_FLOOR_PLANTS_M2);
  assert.ok(near(floorDensity(1), JUNGLE_FLOOR_PLANTS_M2 * MEADOW_BLADES_PER_TUFT * (2 * LAB_GRASS.densitySpan) ** 2, 1e-6));
  // the ladder the vertex stage runs and floorPick agree on the new shares at both ends
  const art = { variants: JUNGLE_FLOOR_PLANTS.map(() => ({ scale: 1 })) };
  const ladder = ladderPick(JUNGLE_FLOOR_PLANTS.map((p, i) => [i, p.share[0], p.share[1]]));
  assert.ok(typeof ladder === 'string' && ladder.length > 0);
  const counts = [0, 1].map(() => new Array(JUNGLE_FLOOR_PLANTS.length).fill(0));
  for (const [end, tint] of [[0, MEADOW_LUSH[0] - 0.01], [1, MEADOW_LUSH[1] + 0.01]]) for (let r = 0; r < 1; r += 1 / 4096) counts[end][floorPick(art, r, tint).variant]++;
  for (const end of [0, 1]) JUNGLE_FLOOR_PLANTS.forEach((p, i) => assert.ok(near(counts[end][i] / 4096, p.share[end], 1 / 1024), `${p.name}: the pick's share at the ${end ? 'lush' : 'poor'} end`));
});
