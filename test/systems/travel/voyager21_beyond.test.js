// VOYAGER2.1 (2026-10-26, KPbICA's spec forwarded by the owner: "Roads at current state does not behave like roads for
// Pathfinding system in Overworld view"; bible/06-Systems/Travel-View.md VOYAGER2.1) - THE ROADS PAST THE BAY ARE WALKED AS
// ROADS. The Overworld's planner (systems/travel/travelRoute.js planRoute) read no road's byte past the Bay's table
// (TV-BEYOND: "a step past the table reads no road's byte"), so a click past the Bay walked the open ground beside every
// road there at three and a half times a road's price. Now routeGround carries the layer's reader (world/arenaRoads.js -
// the roads past the Bay and the crossings' joins onto the Bay's own), spread into every plan the host makes, and a plan
// handed the Bay's roads (ROADS mode) walks them: a road a road's price, a track a track's, the crossing onto the Bay's
// roads one road.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { planRoute, routeGround, routeLegs, ROUTE_COST } from '../../../src/systems/travel/travelRoute.js';
import { MAP_W, MAP_H, DIR } from '../../../src/world/road/roadNetwork.js';
import { beyondKey, setArenaRoads, arenaRoadByte } from '../../../src/world/arenaRoads.js';
import { hostText } from '../../hostText.mjs';

afterEach(() => { setArenaRoads(null); });
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** A layer past the Bay: `cells` [x, y, bits, kind]. */
const layerOf = (cells) => {
  const out = { roads: new Map(), tracks: new Map(), join: new Map() };
  for (const [x, y, bits, kind = 'roads'] of cells) out[kind].set(beyondKey(x, y), bits);
  return out;
};
const reader = (layer) => (kind, x, y) => layer[kind]?.get(beyondKey(x, y)) ?? 0;
const bay = () => ({ roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) });
/** A road along row y from x0 to x1 (inclusive), each pixel its west and east bits but the ends'. */
const row = (y, x0, x1, kind = 'roads') => {
  const out = [];
  for (let x = x0; x <= x1; x++) out.push([x, y, (x > x0 ? DIR.W : 0) | (x < x1 ? DIR.E : 0), kind]);
  return out;
};

test('VOYAGER2.1 a road past the Bay is walked as a road: every step a road\'s, the plan a road\'s price - where it walked the open ground beside it at three and a half times it; a track a track\'s (mutants: the reader unread, a road\'s step a track\'s, the back bit)', () => {
  const layer = layerOf(row(100, 1010, 1030));
  const net = bay();
  const on = planRoute({ x: 1010, y: 100 }, { x: 1030, y: 100 }, { ...net, pathsBeyond: reader(layer) });
  assert.deepEqual(on.kinds, new Array(20).fill('road'));
  assert.equal(on.cost, 20 * ROUTE_COST.road);
  const before = planRoute({ x: 1010, y: 100 }, { x: 1030, y: 100 }, { ...net });
  assert.deepEqual(before.kinds, new Array(20).fill('open'), 'with no reader: TV-BEYOND\'s open ground');
  assert.equal(before.cost, 20 * ROUTE_COST.open);
  // a track
  const track = planRoute({ x: -40, y: 300 }, { x: -20, y: 300 }, { ...net, pathsBeyond: reader(layerOf(row(300, -40, -20, 'tracks'))) });
  assert.deepEqual(track.kinds, new Array(20).fill('track'));
  // a byte on one end alone is no road: two roads side by side are not one (TV2's law)
  const half = layerOf([[1010, 100, DIR.E], [1011, 100, 0]]);
  assert.deepEqual(planRoute({ x: 1010, y: 100 }, { x: 1011, y: 100 }, { ...net, pathsBeyond: reader(half) }).kinds, ['open']);
});

test('VOYAGER2.1 the road past the Bay is taken over the open ground: a town past the Bay reached by the road round, not the field straight across (mutant: the reader unread)', () => {
  // a road that bows north - along row 100 from 1010 to 1040 through row 96 - and the straight way across row 100 open
  const cells = [];
  const pts = [];
  for (let x = 1010; x <= 1040; x++) pts.push([x, 100 - Math.round(4 * Math.sin(((x - 1010) / 30) * Math.PI))]);
  for (let k = 0; k < pts.length; k++) {
    let bits = 0;
    for (const j of [k - 1, k + 1]) {
      if (j < 0 || j >= pts.length) continue;
      const dx = pts[j][0] - pts[k][0], dy = pts[j][1] - pts[k][1];
      bits |= { '1,0': DIR.E, '1,-1': DIR.NE, '1,1': DIR.SE, '-1,0': DIR.W, '-1,-1': DIR.NW, '-1,1': DIR.SW }[`${dx},${dy}`];
    }
    cells.push([pts[k][0], pts[k][1], bits]);
  }
  const r = planRoute({ x: 1010, y: 100 }, { x: 1040, y: 100 }, { ...bay(), pathsBeyond: reader(layerOf(cells)) });
  assert.ok(r.kinds.every((k) => k === 'road'), `by the road: ${r.kinds.join(',')}`);
  assert.ok(r.pixels.some((p) => p.y <= 97), 'round its bow');
});

test('VOYAGER2.1 the crossing onto the Bay: the Bay\'s road to its edge, the crossing\'s join out of it (TESA5) and the road past it walked as one road (mutants: the join unread, the edge\'s reach)', () => {
  const net = bay();
  for (let x = 980; x <= 994; x++) net.roads[300 * MAP_W + x] = (x > 980 ? DIR.W : 0) | (x < 994 ? DIR.E : 0);   // his road, ending six pixels in
  // the crossing's run from his road's end out to the edge, its Bay pixels the join's (world/arenaRoads.js joinLayer)
  const layer = layerOf([...row(300, 994, 999).map(([x, y, b]) => [x, y, b | (x === 999 ? DIR.E : 0), 'join']), ...row(300, 1000, 1015)]);
  layer.roads.set(beyondKey(1000, 300), DIR.W | DIR.E);
  const r = planRoute({ x: 980, y: 300 }, { x: 1015, y: 300 }, { ...net, pathsBeyond: reader(layer) });
  assert.deepEqual(r.kinds, new Array(35).fill('road'));
  // a join is read near the edge alone (where TESA5 lays it): one deep in the Bay is the Bay's own byte
  const deep = layerOf([[500, 250, DIR.E, 'join'], [501, 250, DIR.W, 'join']]);
  assert.deepEqual(planRoute({ x: 500, y: 250 }, { x: 501, y: 250 }, { ...net, pathsBeyond: reader(deep) }).kinds, ['open']);
});

test('VOYAGER2.1 FREE walks across country past the Bay too: a plan handed no road of the Bay\'s reads none of the land past it (mutant: the mode\'s gate)', () => {
  const layer = layerOf(row(100, 1010, 1030));
  const free = planRoute({ x: 1010, y: 100 }, { x: 1030, y: 100 }, { roads: null, tracks: null, pathsBeyond: reader(layer) });
  assert.deepEqual(free.kinds, new Array(20).fill('open'));
});

test('VOYAGER2.1 the host\'s ground carries the installed layer\'s reader into every plan (routeGround\'s `pathsBeyond`, spread in by `...tvRouteGround()`), and the legs fold a road past the Bay as one (mutants: the default reader, the spread, the layer\'s presence)', () => {
  const g = routeGround(() => 0, () => 20, 3, 4, 4);
  assert.equal(g.pathsBeyond, null, 'no layer installed: none to read (the reader cost a long route a fifth more)');
  setArenaRoads(layerOf(row(-50, 1100, 1120)));
  assert.equal(g.pathsBeyond, arenaRoadByte, 'one installed: its reader, asked as the plan is made');
  assert.equal({ ...g }.pathsBeyond, arenaRoadByte, 'and the host\'s spread takes it');
  const r = planRoute({ x: 1100, y: -50 }, { x: 1120, y: -50 }, { ...bay(), ...routeGround(() => 0, () => 20, 3, MAP_W, MAP_H, () => true) });
  assert.deepEqual(r.kinds, new Array(20).fill('road'), 'the installed layer, through the ground');
  assert.deepEqual(routeLegs(r.pixels, r.kinds), [{ x: 1120, y: -50, kind: 'road' }], 'one straight leg on the road');
  const host = hostText('src/scenes/world.js');
  assert.match(host, /planRoute\(from, summary\.pixel, \{ roads: net\?\.roads \?\? null, tracks: net\?\.tracks \?\? null, \.\.\.tvRouteGround\(\)/);
  assert.match(host, /planRoute\(from, pix, \{ roads: wnet\?\.roads \?\? null, tracks: wnet\?\.tracks \?\? null, \.\.\.tvRouteGround\(\)/);
  assert.match(read('src/systems/travel/travelRoute.js'), /const beyond = roads \|\| tracks \? pathsBeyond : null;/);
});
