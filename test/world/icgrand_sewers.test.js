// IC-GRAND (2026-10-26; the KPbICA spec the owner forwarded: "Sewage system (that will be used for creating Sewers in the
// future)"; bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL CITY'S SEWERS as a law and its data, pinned: a main
// under every avenue, radial and ring road and Green Emperor Way, each falling to where it pours; every radial's culvert to
// the lake; the branches under the districts' own streets draining to the nearest main; the covers in the streets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMPERIAL_SEWERS, imperialSewerMains, imperialSewerOutfalls, radialDepthAt, outfallAt, mainDepthAt, sewerCoversIn, mainUnder, nearestMain, sewerBranchesIn } from '../../src/world/imperialSewers.js';
import { IMPERIAL, imperialRoads, imperialLand, imperialRoadAt, polar } from '../../src/world/imperialCity.js';
import { streetKind, fabricGroundAt, GROUND } from '../../src/world/imperialFabric.js';
import { fabricCellModel } from '../../src/world/imperialFabricModels.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';

const S = IMPERIAL_SEWERS, B = BLOCK_M;

test('IC-GRAND THE MAINS - one under each avenue and each radial from its head to the city wall, its culvert on under the isle to the lake; the ring roads\' and Green Emperor Way\'s in runs from between two radials to each; every main falling to where it pours, a ring into its radial over the radial\'s own invert (mutants: a radial uphill; a ring\'s drop unread; a culvert to dry land)', () => {
  const mains = imperialSewerMains(), roads = imperialRoads();
  assert.equal(imperialSewerMains(), mains, 'made once');
  const radials = roads.filter((r) => r.kind === 'avenue' || r.kind === 'radial');
  assert.equal(radials.length, 18, 'six avenues and twelve radials - a straight road every fifteen degrees');
  for (const rd of radials) {
    const m = mains.find((q) => q.id === `${rd.kind}:${rd.b}`);
    assert.ok(m && m.kind === 'radial' && m.into === `outfall:${rd.b}`, `${rd.kind} ${rd.b}`);
    assert.ok(m.depth1 > m.depth0, 'falling outward');
    assert.ok(Math.abs(Math.hypot(...m.path[1]) - IMPERIAL.cityWall.r) < 1e-6, 'to the city wall');
    const out = mains.find((q) => q.id === m.into);
    assert.ok(out.kind === 'outfall' && out.into === 'lake' && out.depth1 >= out.depth0, 'its culvert on, falling');
    const end = out.path[out.path.length - 1];
    assert.equal(imperialLand(...polar(rd.b, Math.hypot(...end) + 5)), false, 'it pours into the water');
    assert.equal(imperialLand(...end), true, 'its mouth on the shore');
  }
  assert.equal(imperialSewerOutfalls().length, 18);
  assert.ok(Math.abs(radialDepthAt(IMPERIAL.cityWall.r) - (S.headDepth + (IMPERIAL.cityWall.r - IMPERIAL.way.r0) * S.MAIN_FALL)) < 1e-9);
  const rings = mains.filter((m) => m.kind === 'ring' || m.kind === 'way');
  assert.equal(rings.filter((m) => m.kind === 'ring').length, IMPERIAL.roads.rings.length * radials.length * 2, 'each ring road in runs, two between each pair of radials');
  for (const m of rings) {
    const into = mains.find((q) => q.id === m.into);
    assert.ok(into && into.kind === 'radial', `${m.id} into a radial`);
    assert.ok(m.depth1 > m.depth0, `${m.id}: falling toward it`);
    assert.ok(Math.abs(m.depth1 - (mainDepthAt(into, ...m.path[m.path.length - 1]) - S.RING_DROP)) < 1e-6, `${m.id}: over the radial's invert by its drop`);
  }
  assert.ok(rings.some((m) => m.kind === 'way'), 'Green Emperor Way\'s');
  const [x, z] = polar(IMPERIAL.bridge.b + 1, 6000);
  assert.ok(nearestMain(x, z), 'a main near every point');
  const fall = outfallAt(IMPERIAL.waterfront.b0 + 10);
  assert.ok(Math.hypot(...fall) > IMPERIAL.waterfront.r1 - 6, 'the Waterfront\'s culvert to its quay\'s edge (a 4 m step)');
});

test('IC-GRAND THE COVERS - a manhole every MANHOLE_EVERY on a main\'s road, a grate at each kerb beside it, each on its road; none over a culvert under the isle; the cell\'s model lays them (mutants: the spacing; a grate off the road)', () => {
  const [x0, z0] = polar(30, 3000), box = [x0 - 400, z0 - 400, x0 + 400, z0 + 400];
  const covers = sewerCoversIn(...box);
  const manholes = covers.filter((c) => c.kind === 'manhole'), grates = covers.filter((c) => c.kind === 'grate');
  assert.ok(manholes.length > 5 && grates.length === 2 * manholes.length, `${manholes.length} manholes, ${grates.length} grates`);
  for (const c of covers) assert.ok(imperialRoadAt(...c.at, 0.01), `a cover on its road at ${c.at}`);
  for (const c of manholes) assert.ok(mainUnder(...c.at), 'a manhole over its main');
  const avenue = manholes.filter((c) => c.main === 'avenue:30').map((c) => Math.hypot(...c.at)).sort((a, b) => a - b);
  for (let i = 1; i < avenue.length; i++) assert.ok(Math.abs(avenue[i] - avenue[i - 1] - S.manholeEvery) < 1e-6, 'every sixty metres');
  assert.equal(sewerCoversIn(...polar(30, IMPERIAL.cityWall.r + 400), ...polar(30, IMPERIAL.cityWall.r + 600)).length, 0, 'none past the city wall');
});

test('IC-GRAND THE BRANCHES - under a cell\'s streets (a lane and wider, never an alley), shallow, each draining to the nearest main, a manhole every BRANCH_MANHOLE; the cell\'s model lays their covers (mutants: an alley a branch; a branch draining nowhere)', () => {
  let branches = 0, covers = 0, cell = null;
  for (let k = 0; k < 60 && !cell; k++) {
    const [x, z] = polar(20 + (k % 10) * 3, 3000 + Math.floor(k / 10) * 200), r = Math.floor(z / B + 100), c = Math.floor(x / B + 100);
    const got = sewerBranchesIn(r, c);
    if (got.branches.length) cell = [r, c, got];
  }
  assert.ok(cell, 'a cell of the Market District with branches');
  const [r, c, { branches: list, covers: cv }] = cell;
  for (const br of list) {
    branches++;
    assert.ok(br.street !== 'alley' && ['lane', 'side', 'main'].includes(br.street), br.street);
    assert.equal(br.depth, S.branchDepth);
    assert.ok(br.depth < radialDepthAt(IMPERIAL.way.r0), 'shallower than any main');
    assert.ok(br.drainsTo, 'to a main');
    const mid = [(br.a[0] + br.b[0]) / 2, (br.a[1] + br.b[1]) / 2];
    assert.equal(fabricGroundAt(...mid), GROUND.street, 'under a street');
  }
  covers = cv.length;
  assert.ok(branches > 0 && covers > 0);
  assert.equal(streetKind(3.2), 'alley');
  const m = fabricCellModel(r, c);
  assert.ok(m && m.subMeshes.length > 0, 'the cell\'s model, its covers with it');
});
