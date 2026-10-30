// ROAD-GRAPH (2026-10-30, the owner: "overworld travel in the pvp zone ... not allowing you to traverse to different
// locations reliably", then "Yes a proper fix"; bible/06-Systems/Travel-View.md ROAD-GRAPH): the roads' search past the
// Bay gave up after 100,000 cells, and 111 of 992 trips between Cyrodiil's towns said "no way". It now moves a chain at a
// time between junctions, keeps the chains for its network, and walks the network to its edge.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { planRoute, searchByRoad, ROUTE_COST, ROAD_PIECE_CAP } from '../../../src/systems/travel/travelRoute.js';
import { MAP_W, MAP_H, DIR } from '../../../src/world/road/roadNetwork.js';
import { beyondKey, setArenaRoads, arenaRoadByte } from '../../../src/world/arenaRoads.js';

afterEach(() => { setArenaRoads(null); });

const STEP = { '1,0': DIR.E, '1,-1': DIR.NE, '1,1': DIR.SE, '-1,0': DIR.W, '-1,-1': DIR.NW, '-1,1': DIR.SW, '0,1': DIR.S, '0,-1': DIR.N };
/** Roads through each run of points (each point the last one's neighbour), their bytes OR'd where runs meet. */
function roadMap(...runs) {
  const m = new Map();
  for (const pts of runs) {
    pts.forEach((p, k) => {
      let bits = 0;
      for (const j of [k - 1, k + 1]) if (j >= 0 && j < pts.length) bits |= STEP[`${pts[j][0] - p[0]},${pts[j][1] - p[1]}`];
      m.set(beyondKey(p[0], p[1]), (m.get(beyondKey(p[0], p[1])) ?? 0) | bits);
    });
  }
  return m;
}
const reader = (m) => (kind, x, y) => (kind === 'roads' ? m.get(beyondKey(x, y)) ?? 0 : 0);
const run = (x0, y0, x1, y1) => { const pts = []; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) pts.push([x0 + Math.sign(x1 - x0) * i, y0 + Math.sign(y1 - y0) * i]); return pts; };
const bay = () => ({ roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) });
const PRICE = { road: ROUTE_COST.road, track: ROUTE_COST.track, open: ROUTE_COST.open };
/** A plan's price read off its own pixels and kinds - the search's sum must be it. */
const priced = (r) => r.kinds.reduce((s, k, i) => s + (r.pixels[i].x !== r.pixels[i + 1].x && r.pixels[i].y !== r.pixels[i + 1].y ? Math.SQRT2 : 1) * PRICE[k], 0);

/** A switchback past the Bay: `rows` rows of `len` pixels, two apart, joined at alternate ends - one chain, no junction. */
function switchback(x0, y0, len, rows) {
  const pts = [];
  for (let k = 0; k < rows; k++) {
    for (let i = 0; i < len; i++) pts.push([k % 2 ? x0 + len - 1 - i : x0 + i, y0 + 2 * k]);
    if (k < rows - 1) pts.push([k % 2 ? x0 : x0 + len - 1, y0 + 2 * k + 1]);
  }
  const m = roadMap(pts);
  return { from: { x: pts[0][0], y: pts[0][1] }, to: { x: pts.at(-1)[0], y: pts.at(-1)[1] }, length: pts.length, isWater: (x, y) => !m.has(beyondKey(x, y)), beyond: reader(m) };
}

for (const [where, x0, y0] of [['Cyrodiil, the open zone', 1600, 700], ['Skyrim, past the zone', 1500, -400]]) {
  test(`ROAD-GRAPH ${where}: a road trip whose only way winds 120,000 pixels is walked by the road - the old spend of 100,000 said "no way"; and the same trip again reads the kept chain (mutant: the chains not kept)`, () => {
    const road = switchback(x0, y0, 1500, 80);
    const net = bay();
    const tally = { n: 0 };
    const r = planRoute(road.from, road.to, { ...net, isWater: road.isWater, pathsBeyond: road.beyond, tally });
    assert.ok(r, 'a way');
    assert.deepEqual([r.pixels[0], r.pixels.at(-1)], [road.from, road.to]);
    assert.equal(r.pixels.length, road.length, 'the whole road, no field crossed');
    assert.ok(r.kinds.every((k) => k === 'road'));
    assert.ok(tally.n > 100000 && tally.n < road.length + 2 * ROAD_PIECE_CAP + 100, `${tally.n} cells`);
    const again = { n: 0 };
    assert.deepEqual(planRoute(road.from, road.to, { ...net, isWater: road.isWater, pathsBeyond: road.beyond, tally: again }), r, 'the same way');
    assert.ok(again.n < 2 * ROAD_PIECE_CAP + 100, `kept: ${again.n} cells, the ends' floods and a handful`);
  });
}

test('ROAD-GRAPH a network moved is another\'s: the installed layer read again after an install, never its kept chains (mutant: the install\'s version unread)', () => {
  const net = bay(), dry = () => false;
  setArenaRoads({ roads: roadMap(run(1100, 100, 1700, 100)), tracks: new Map() });
  const straight = searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 100 }, { ...net, isWater: dry, beyond: arenaRoadByte });
  assert.ok(straight.pixels.some((p) => p.x === 1400 && p.y === 100));
  // the same road, its pixel at 1400 moved a row south
  setArenaRoads({ roads: roadMap([...run(1100, 100, 1399, 100), [1400, 101], ...run(1401, 100, 1700, 100)]), tracks: new Map() });
  const moved = searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 100 }, { ...net, isWater: dry, beyond: arenaRoadByte });
  assert.ok(moved.pixels.some((p) => p.x === 1400 && p.y === 101), 'by the road as it lies now');
  assert.ok(!moved.pixels.some((p) => p.x === 1400 && p.y === 100));
  assert.ok(Math.abs(moved.cost - priced(moved)) < 1e-9);
});

test('ROAD-GRAPH the ends and the forks: a goal beside the middle of a chain is left at its nearest pass, a goal down a fork is reached by it, a road\'s last pixel on the water (a harbour\'s) is stepped onto - and every plan costs what its own steps cost (mutants: the ends as chains, a chain past an end, a fork passed, the goal\'s neighbours chained)', () => {
  const net = bay(), dry = () => false;
  // the main road along row 100, a fork south from 1400 to row 300
  const m = roadMap(run(1100, 100, 1700, 100), run(1400, 100, 1400, 300));
  const beyond = reader(m);
  const beside = searchByRoad({ x: 1100, y: 100 }, { x: 1550, y: 104 }, { ...net, isWater: dry, beyond });
  assert.deepEqual(beside.pixels.at(-1), { x: 1550, y: 104 });
  assert.ok(beside.pixels.every((p) => p.x <= 1556), 'never on to the road\'s end and back');
  assert.ok(beside.kinds.filter((k) => k === 'open').length <= 6, 'the field only on the goal\'s own leg');
  assert.ok(Math.abs(beside.cost - priced(beside)) < 1e-9, `${beside.cost} against ${priced(beside)}`);
  const fork = searchByRoad({ x: 1100, y: 100 }, { x: 1400, y: 300 }, { ...net, isWater: dry, beyond });
  assert.equal(fork.cost, 500, 'east 300, down the fork 200');
  assert.ok(fork.kinds.every((k) => k === 'road'));
  assert.equal(fork.pixels.length, 501);
  // the fork's last pixel is the water: the step onto the goal is asked as the goal's, as the pixel search asked it
  const harbour = searchByRoad({ x: 1100, y: 100 }, { x: 1400, y: 300 }, { ...net, isWater: (x, y) => x === 1400 && y === 300, beyond });
  assert.ok(harbour, 'a way to the harbour');
  assert.equal(harbour.cost, 500);
});

test('ROAD-GRAPH a crossing\'s four arms, each reached from each: no arm of a fork is passed by a chain (mutant: a fork passed)', () => {
  const net = bay(), dry = () => false;
  const m = roadMap(run(1400, 100, 1400, 300), run(1300, 200, 1500, 200));
  const beyond = reader(m);
  const arms = [{ x: 1400, y: 100 }, { x: 1500, y: 200 }, { x: 1400, y: 300 }, { x: 1300, y: 200 }];
  for (const a of arms) {
    for (const b of arms) {
      if (a === b) continue;
      const r = searchByRoad(a, b, { ...net, isWater: dry, beyond });
      assert.ok(r, `${JSON.stringify(a)} to ${JSON.stringify(b)}`);
      assert.equal(r.cost, 200);
      assert.ok(r.kinds.every((k) => k === 'road'));
    }
  }
});

test('ROAD-GRAPH two ends\' legs that meet in a field are never joined across it: each end walks its own leg to the road (ROAD-FOLLOW\'s law, asked where the ends are searched a pixel at a time) - the cut is dearer by the road, and still not taken (mutant: the open ground everywhere)', () => {
  const net = bay(), dry = () => false;
  const beyond = reader(roadMap(run(1100, 100, 1300, 100)));
  // each 10 below the road: legs of 12 rings, the start's box to x 1162, the goal's from 1163
  const r = searchByRoad({ x: 1150, y: 110 }, { x: 1175, y: 110 }, { ...net, isWater: dry, beyond });
  assert.ok(r.kinds.includes('road'), 'by the road');
  assert.ok(r.cost > 25 * ROUTE_COST.open, `${r.cost}: never the straight cut of 87.5`);
  assert.ok(Math.abs(r.cost - priced(r)) < 1e-9);
});

test('ROAD-GRAPH a ring road that leaves a junction and comes back to it is walked: a goal beside its far side is reached round it', () => {
  const net = bay(), dry = () => false;
  // a road east to the junction at 1200, and a ring from it: east, south, west and back north to it
  const beyond = reader(roadMap(run(1100, 200, 1200, 200), [...run(1200, 200, 1300, 200), ...run(1300, 201, 1300, 300).slice(0), ...run(1299, 300, 1200, 300), ...run(1200, 299, 1200, 200)]));
  const r = searchByRoad({ x: 1100, y: 200 }, { x: 1300, y: 305 }, { ...net, isWater: dry, beyond });
  assert.ok(r, 'a way round the ring');
  assert.deepEqual(r.pixels.at(-1), { x: 1300, y: 305 });
  assert.ok(r.kinds.filter((k) => k === 'open').length <= 7, 'the field only on the goal\'s own leg');
  assert.ok(Math.abs(r.cost - priced(r)) < 1e-9);
});
