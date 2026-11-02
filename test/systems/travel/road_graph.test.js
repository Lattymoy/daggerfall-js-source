// ROAD-GRAPH (2026-10-30, the owner: "overworld travel in the pvp zone ... not allowing you to traverse to different
// locations reliably", then "Yes a proper fix"; bible/06-Systems/Travel-View.md ROAD-GRAPH): the roads' search past the
// Bay gave up after 100,000 cells, and 111 of 992 trips between Cyrodiil's towns said "no way". It now moves a chain at a
// time between junctions and has no spend; a flood back from the goal bounds a refusal; the chains are kept on the ground
// the host owns (AUDIT ROAD-GRAPH, `01-Overview/audits/Audit-Road-Graph.md`).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { planRoute, planRouteSteps, searchByRoad, routeGround, ROUTE_COST, ROAD_PIECE_CAP, ROAD_BACK_EVERY, BEYOND_MAX_EXPANSIONS } from '../../../src/systems/travel/travelRoute.js';
import { MAP_W, MAP_H, DIR } from '../../../src/world/road/roadNetwork.js';
import { beyondKey, setArenaRoads, arenaRoadByte } from '../../../src/world/arenaRoads.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';

afterEach(() => { setArenaRoads(null); setTamrielTrace(null); setTamrielFit(null); });

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
const reader = (m, t = new Map()) => (kind, x, y) => (kind === 'roads' ? m.get(beyondKey(x, y)) ?? 0 : kind === 'tracks' ? t.get(beyondKey(x, y)) ?? 0 : 0);
const run = (x0, y0, x1, y1) => { const pts = []; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) pts.push([x0 + Math.sign(x1 - x0) * i, y0 + Math.sign(y1 - y0) * i]); return pts; };
const bay = () => ({ roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) });
const PRICE = { road: ROUTE_COST.road, track: ROUTE_COST.track, open: ROUTE_COST.open };
/** A plan's price read off its own pixels and kinds - the search's sum must be it. */
const priced = (r) => r.kinds.reduce((s, k, i) => s + (r.pixels[i].x !== r.pixels[i + 1].x && r.pixels[i].y !== r.pixels[i + 1].y ? Math.SQRT2 : 1) * PRICE[k], 0);
const joined = (r) => r.pixels.every((p, i) => i === 0 || Math.max(Math.abs(p.x - r.pixels[i - 1].x), Math.abs(p.y - r.pixels[i - 1].y)) === 1);
/** Each step's kind as the bytes say it: a road where both its pixels carry the step on the roads' bytes, else a track. */
const byBytes = (r, roads, tracks) => r.kinds.every((k, i) => {
  const a = r.pixels[i], b = r.pixels[i + 1], bit = STEP[`${b.x - a.x},${b.y - a.y}`], back = STEP[`${a.x - b.x},${a.y - b.y}`];
  const on = (m) => ((m.get(beyondKey(a.x, a.y)) ?? 0) & bit) && ((m.get(beyondKey(b.x, b.y)) ?? 0) & back);
  return k === (on(roads) ? 'road' : on(tracks) ? 'track' : 'open');
});
const dry = () => false;
/** A switchback: `rows` rows of `len` pixels, two apart, joined at alternate ends - one chain, no junction. */
function switchback(x0, y0, len, rows) {
  const pts = [];
  for (let k = 0; k < rows; k++) {
    for (let i = 0; i < len; i++) pts.push([k % 2 ? x0 + len - 1 - i : x0 + i, y0 + 2 * k]);
    if (k < rows - 1) pts.push([k % 2 ? x0 : x0 + len - 1, y0 + 2 * k + 1]);
  }
  return pts;
}

for (const [where, x0, y0] of [['Cyrodiil, the open zone', 1600, 700], ['Skyrim, past the zone', 1500, -400]]) {
  test(`ROAD-GRAPH ${where}: a road trip whose only way winds 120,000 pixels is walked by the road (the spend of 100,000 said "no way"); asked again over the kept graph it is the same way, for a fraction of the cells (mutants: the chains not kept, the keep never reused)`, () => {
    const pts = switchback(x0, y0, 1500, 80), m = roadMap(pts);
    setArenaRoads({ roads: m, tracks: new Map() });
    const from = { x: pts[0][0], y: pts[0][1] }, to = { x: pts.at(-1)[0], y: pts.at(-1)[1] };
    const o = { ...bay(), isWater: (x, y) => !m.has(beyondKey(x, y)), pathsBeyond: arenaRoadByte, roadKeep: { graph: null } };
    const tally = { n: 0 };
    const r = planRoute(from, to, { ...o, tally });
    assert.ok(r, 'a way');
    assert.equal(r.pixels.length, pts.length, 'the whole road, no field crossed');
    assert.ok(r.kinds.every((k) => k === 'road'));
    assert.ok(tally.n > 100000 && tally.n < pts.length * (1 + 1 / ROAD_BACK_EVERY) + 2 * ROAD_PIECE_CAP + 100, `${tally.n} cells`);
    const again = { n: 0 };
    assert.deepEqual(planRoute(from, to, { ...o, tally: again }), r, 'the same way');
    assert.ok(again.n < 2 * ROAD_PIECE_CAP + 100, `kept: ${again.n} cells, the ends' floods and a handful`);
  });
}

test('ROAD-GRAPH a trip to a road network that joins none of the start\'s is refused at the goal\'s side\'s cost - the flood back from the goal runs dry - where the search alone walked the whole of the start\'s first (mutant: the flood back unasked)', () => {
  const big = switchback(1600, 700, 1500, 80), small = run(1600, 1000, 11600, 1000);
  const beyond = reader(roadMap(big, small));
  const tally = { n: 0 };
  assert.equal(searchByRoad({ x: big[0][0], y: big[0][1] }, { x: 6600, y: 1000 }, { ...bay(), isWater: dry, beyond, tally }), null);
  assert.ok(tally.n < (1 + ROAD_BACK_EVERY) * small.length + 2 * ROAD_PIECE_CAP + 100, `${tally.n} cells, against the start's ${big.length}`);
  // the other way about, the search itself runs dry on the small network first (the two halves of the start's own chain
  // walked out and back: a chain from a pixel no junction is read back by no other)
  const back = { n: 0 };
  assert.equal(searchByRoad({ x: 6600, y: 1000 }, { x: big[0][0], y: big[0][1] }, { ...bay(), isWater: dry, beyond, tally: back }), null);
  assert.ok(back.n < 4 * small.length + 2 * ROAD_PIECE_CAP, `${back.n} cells`);
});

test('ROAD-GRAPH a plan whose network is laid again while it waits for its next slice is planned again on the network as it lies - a walk left mid-chain never goes on round a ring it was not on (mutant: the walk unasked)', () => {
  const L1 = roadMap(run(2000, 100, 7000, 100));
  // laid again: a ring where the road was, joining nothing, and the two ends joined by a road round it to the south
  const L2 = roadMap([...run(2100, 100, 6900, 100), ...run(6900, 101, 6900, 105), ...run(6899, 105, 2100, 105), ...run(2100, 104, 2100, 101), [2100, 100]],
    [...run(2000, 100, 2000, 120), ...run(2001, 120, 7000, 120), ...run(7000, 119, 7000, 100)]);
  setArenaRoads({ roads: L1, tracks: new Map() });
  const tally = { n: 0 };
  const it = planRouteSteps({ x: 2000, y: 100 }, { x: 7000, y: 100 }, { ...bay(), isWater: dry, pathsBeyond: arenaRoadByte, roadKeep: { graph: null }, tally });
  let r;
  do r = it.next(); while (!r.done && tally.n < 7000);
  assert.ok(!r.done, 'suspended inside the chain');
  setArenaRoads({ roads: L2, tracks: new Map() });
  // planned again at once: 11 slices here, where a walk left on the ring went round it until the flood back ran dry and
  // the ladder took over (142)
  for (let i = 0; i < 40 && !r.done; i++) r = it.next();
  assert.ok(r.done, `ended (${tally.n} cells)`);
  assert.ok(r.value?.pixels.some((p) => p.y === 120), 'by the road as it lies now');
});

test('ROAD-GRAPH the keep is the ground\'s: a host\'s planRoute spread over routeGround reuses the chains it walked; a network laid again, or another water, is walked afresh (mutants: the keep unhanded, the install\'s version unread, the water unkeyed)', () => {
  const pts = switchback(1600, 700, 600, 40);
  setArenaRoads({ roads: roadMap(pts), tracks: new Map() });
  const rg = routeGround(() => 0, () => 20, 3, MAP_W, MAP_H, () => true);
  const from = { x: pts[0][0], y: pts[0][1] }, to = { x: pts.at(-1)[0], y: pts.at(-1)[1] };
  const first = { n: 0 }, second = { n: 0 }, net0 = bay();
  const r = planRoute(from, to, { ...net0, ...rg, tally: first });
  assert.ok(r && r.kinds.every((k) => k === 'road'));
  assert.ok(rg.roadKeep.graph, 'kept on the ground');
  assert.deepEqual(planRoute(from, to, { ...net0, ...rg, tally: second }), r);
  assert.ok(second.n < first.n / 2, `${second.n} against ${first.n}`);
  // the same road, its pixel at (1800, 700) moved a row up: the next plan walks the network as it lies
  const moved = pts.filter((p) => !(p[0] === 1800 && p[1] === 700));
  const cut = moved.findIndex((p) => p[0] === 1801 && p[1] === 700);
  setArenaRoads({ roads: roadMap([...moved.slice(0, cut), [1800, 699], ...moved.slice(cut)]), tracks: new Map() });
  const again = planRoute(from, to, { ...net0, ...rg });
  assert.ok(again.pixels.some((p) => p.x === 1800 && p.y === 699) && !again.pixels.some((p) => p.x === 1800 && p.y === 700), 'by the road as it lies now');
  // the same network under another water: a road pixel drowned is no way, kept chains or not
  const keep = { graph: null }, net = bay();
  const o = { ...net, beyond: arenaRoadByte, keep };
  setArenaRoads({ roads: roadMap(run(1100, 100, 1700, 100), run(1300, 100, 1300, 95), run(1500, 100, 1500, 95)), tracks: new Map() });
  assert.ok(searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 100 }, { ...o, isWater: dry }));
  assert.equal(searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 100 }, { ...o, isWater: (x, y) => (x === 1400 && y === 100) || y !== 100 }), null);
});

test('ROAD-GRAPH the ends and the forks: a goal beside the middle of a chain is left at its nearest pass, a goal down a fork is reached by it from either side, a road\'s last pixel on the water (a harbour\'s) is stepped onto - every plan costs what its own steps cost (mutants: the ends as chains, a chain past an end, a fork passed, the goal\'s neighbours chained)', () => {
  const net = bay();
  const beyond = reader(roadMap(run(1100, 100, 1700, 100), run(1400, 100, 1400, 300)));
  const beside = searchByRoad({ x: 1100, y: 100 }, { x: 1550, y: 104 }, { ...net, isWater: dry, beyond });
  assert.deepEqual(beside.pixels.at(-1), { x: 1550, y: 104 });
  assert.ok(beside.pixels.every((p) => p.x <= 1556), 'never on to the road\'s end and back');
  assert.ok(beside.kinds.filter((k) => k === 'open').length <= 6, 'the field only on the goal\'s own leg');
  assert.ok(Math.abs(beside.cost - priced(beside)) < 1e-9, `${beside.cost} against ${priced(beside)}`);
  for (const from of [{ x: 1100, y: 100 }, { x: 1700, y: 100 }]) {
    const fork = searchByRoad(from, { x: 1400, y: 300 }, { ...net, isWater: dry, beyond });
    assert.equal(fork.cost, 500, 'along 300, down the fork 200');
    assert.ok(fork.kinds.every((k) => k === 'road'));
  }
  assert.equal(searchByRoad({ x: 1700, y: 100 }, { x: 1100, y: 100 }, { ...net, isWater: dry, beyond })?.cost, 600, 'and past the fork from the east');
  const harbour = searchByRoad({ x: 1100, y: 100 }, { x: 1400, y: 300 }, { ...net, isWater: (x, y) => x === 1400 && y === 300, beyond });
  assert.equal(harbour?.cost, 500, 'the harbour\'s pixel on the water, stepped onto as the goal');
});

test('ROAD-GRAPH a crossing\'s four arms, each reached from each: no arm of a fork is passed by a chain (mutant: a fork passed)', () => {
  const net = bay();
  const beyond = reader(roadMap(run(1400, 100, 1400, 300), run(1300, 200, 1500, 200)));
  const arms = [{ x: 1400, y: 100 }, { x: 1500, y: 200 }, { x: 1400, y: 300 }, { x: 1300, y: 200 }];
  for (const a of arms) {
    for (const b of arms) {
      if (a === b) continue;
      const r = searchByRoad(a, b, { ...net, isWater: dry, beyond });
      assert.equal(r?.cost, 200, `${JSON.stringify(a)} to ${JSON.stringify(b)}`);
      assert.ok(r.kinds.every((k) => k === 'road'));
    }
  }
});

test('ROAD-GRAPH two ends\' legs that meet in a field are never joined across it: each end walks its own leg to the road (ROAD-FOLLOW\'s law, asked where the ends are searched a pixel at a time) - the cut is dearer by the road, and still not taken (mutant: the open ground everywhere)', () => {
  const beyond = reader(roadMap(run(1100, 100, 1300, 100)));
  // each 10 below the road: legs of 12 rings, the start's box to x 1162, the goal's from 1163
  const r = searchByRoad({ x: 1150, y: 110 }, { x: 1175, y: 110 }, { ...bay(), isWater: dry, beyond });
  assert.ok(r.kinds.includes('road'), 'by the road');
  assert.ok(r.cost > 25 * ROUTE_COST.open, `${r.cost}: never the straight cut of 87.5`);
  assert.ok(Math.abs(r.cost - priced(r)) < 1e-9);
});

test('ROAD-GRAPH rings: one that leaves a junction and comes back to it is walked to a goal beside its far side; one with no junction at all, both ends on it, is walked and ends (mutant: the ring unseen)', () => {
  const net = bay();
  const ringed = reader(roadMap(run(1100, 200, 1200, 200), [...run(1200, 200, 1300, 200), ...run(1300, 201, 1300, 300), ...run(1299, 300, 1200, 300), ...run(1200, 299, 1200, 200)]));
  const r = searchByRoad({ x: 1100, y: 200 }, { x: 1300, y: 305 }, { ...net, isWater: dry, beyond: ringed });
  assert.deepEqual(r?.pixels.at(-1), { x: 1300, y: 305 });
  assert.ok(r.kinds.filter((k) => k === 'open').length <= 7, 'the field only on the goal\'s own leg');
  assert.ok(Math.abs(r.cost - priced(r)) < 1e-9);
  const ring = [...run(1100, 100, 1200, 100), ...run(1200, 101, 1200, 200), ...run(1199, 200, 1100, 200), ...run(1100, 199, 1100, 101), [1100, 100]];
  // a slice at a time, and a bound on the slices: a walk round a ring with no end would never answer
  const it = planRouteSteps({ x: 1100, y: 100 }, { x: 1200, y: 200 }, { ...net, isWater: dry, pathsBeyond: reader(roadMap(ring)) });
  let bare;
  for (let i = 0; i < 2000 && !(bare = it.next()).done;) i++;
  assert.ok(bare.done, 'it ends');
  assert.equal(bare.value?.cost, 200);
});

test('ROAD-GRAPH a chain\'s price and kinds: a diagonal chain between two junctions is priced at sqrt 2 a step, a track between two roads keeps its kind and price, and a chain read back from its far end is the same way reversed (mutants: the diagonal unpriced, a turn\'s kind swapped, the read back off by one)', () => {
  const net = bay();
  const diag = searchByRoad({ x: 1100, y: 100 }, { x: 1400, y: 200 }, { ...net, isWater: dry, beyond: reader(roadMap(run(1100, 100, 1200, 100), run(1200, 100, 1300, 200), run(1300, 200, 1400, 200), run(1200, 100, 1200, 95), run(1300, 200, 1300, 205))) });
  assert.ok(Math.abs(diag.cost - (200 + 100 * Math.SQRT2)) < 1e-9, `${diag.cost}`);
  assert.ok(Math.abs(diag.cost - priced(diag)) < 1e-9);
  // the track from 1200 to 1300, with a bend, between two roads with spurs (junctions at 1150 and 1350)
  const roads = roadMap(run(1100, 100, 1200, 100), run(1300, 100, 1400, 100), run(1150, 100, 1150, 95), run(1350, 100, 1350, 95));
  const tracks = roadMap([...run(1200, 100, 1250, 100), ...run(1251, 101, 1253, 103), ...run(1254, 103, 1254, 102), ...run(1255, 101, 1255, 101), ...run(1256, 100, 1300, 100)]);
  setArenaRoads({ roads, tracks });
  const o = { ...net, isWater: dry, beyond: arenaRoadByte, keep: { graph: null } };
  const there = searchByRoad({ x: 1100, y: 100 }, { x: 1400, y: 100 }, o);
  assert.ok(joined(there));
  assert.ok(there.kinds.filter((k) => k === 'track').length > 50, 'the track as a track');
  assert.ok(byBytes(there, roads, tracks), 'each step the kind its bytes say');
  assert.ok(Math.abs(there.cost - priced(there)) < 1e-9, `${there.cost} against ${priced(there)}`);
  const back = searchByRoad({ x: 1400, y: 100 }, { x: 1100, y: 100 }, o);
  assert.deepEqual(back.pixels, [...there.pixels].reverse(), 'the same way back');
  assert.deepEqual(back.kinds, [...there.kinds].reverse());
  assert.ok(byBytes(back, roads, tracks));
  assert.ok(Math.abs(back.cost - there.cost) < 1e-9);
});

test('ROAD-GRAPH a gap\'s crossing on the goal\'s side that lands mid-chain is taken, and a pixel a chain reached that a nearer step improved is walked the nearer way - every way joined pixel to pixel (mutants: the gaps unboxed, the chain\'s link kept)', () => {
  const net = bay();
  const g1 = searchByRoad({ x: 1100, y: 100 }, { x: 1400, y: 112 }, { ...net, isWater: dry, beyond: reader(roadMap(run(1100, 100, 1700, 100), run(1400, 105, 1400, 112), run(1300, 100, 1300, 95), run(1500, 100, 1500, 95))) });
  assert.ok(g1 && joined(g1));
  assert.ok(g1.pixels.some((p) => p.x === 1400 && p.y === 102), 'across the gap');
  assert.ok(Math.abs(g1.cost - priced(g1)) < 1e-9);
  const A = [[1100, 299], ...run(1100, 300, 1100, 400), ...run(1101, 400, 1400, 400), ...run(1400, 399, 1400, 299), ...run(1401, 299, 1499, 299)];
  const B = [[1100, 299], [1100, 298], ...run(1101, 298, 1497, 298)];
  const m = roadMap(run(1050, 299, 1100, 299), A, B);
  const g2 = searchByRoad({ x: 1050, y: 299 }, { x: 1500, y: 299 }, { ...net, isWater: (x, y) => !m.has(beyondKey(x, y)), beyond: reader(m) });
  assert.ok(g2 && joined(g2), 'no step longer than a pixel');
  assert.ok(Math.abs(g2.cost - priced(g2)) < 1e-9, `${g2.cost} against ${priced(g2)}`);
});

test('ROAD-GRAPH (AUDIT H1) the roads\' search that finds none leaves the ladder its own count: two networks over ROAD_PIECE_CAP joined only across a five-pixel field are walked by their roads, asked cold or over the kept graph - the ladder had what the roads\' search left, and walked the field (mutant: the ladder\'s count not its own)', () => {
  const line = run;
  const snake = (x0, y0, len, rows, dir) => { const pts = []; for (let k = 0; k < rows; k++) { for (let i = 0; i < len; i++) pts.push([k % 2 ? x0 + dir * (len - 1 - i) : x0 + dir * i, y0 + 2 * k]); if (k < rows - 1) pts.push([k % 2 ? x0 : x0 + dir * (len - 1), y0 + 2 * k + 1]); } return pts; };
  const from = { x: 3000, y: 1000 }, to = { x: 3200, y: 1000 };
  const A = [...line(2600, 1000, 3000, 1000), ...line(3000, 999, 3000, 900), ...line(3001, 900, 3195, 900)];
  const B = [...line(3200, 900, 3200, 1000), ...line(3201, 1000, 3600, 1000)];
  setArenaRoads({ roads: roadMap(A, [A[0], ...snake(2600, 1002, 300, 31, -1)], B, [B.at(-1), ...snake(3600, 1002, 300, 31, 1)]), tracks: new Map() });
  const o = { ...bay(), isWater: dry, pathsBeyond: arenaRoadByte, roadKeep: { graph: null } };
  for (const ask of ['cold', 'warm']) {
    const r = planRoute(from, to, o);
    assert.equal(r?.kinds.filter((k) => k === 'open').length, 5, `${ask}: by the roads, the field's five pixels between`);
    assert.equal(r.cost, 412.5);
  }
});

test('ROAD-GRAPH with a boat to hand, a trip to other land (the land\'s pieces part them) never walks the home roads first - the boat\'s search is asked alone (mutant: the roads asked anyway)', () => {
  const W = 60, H = 30, box = (x0, x1, y0, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const west = box(20, 24, 10, 14), east = box(28, 32, 10, 14);
  const land = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (west(x, y) || east(x, y)) land[y * W + x] = 1;
  setTamrielTrace({ w: W, h: H, land, province: land.slice() });
  setTamrielFit({ ox: 0, oy: 0, ppu: 100 });
  const rg = routeGround(() => 0, () => 20, 3, MAP_W, MAP_H, (x, y) => west(Math.floor(x / 100), Math.floor(y / 100)) || east(Math.floor(x / 100), Math.floor(y / 100)));
  const home = switchback(2010, 1010, 480, 240), isle = switchback(2810, 1010, 480, 20);
  const tally = { n: 0 };
  const r = planRoute({ x: home[0][0], y: home[0][1] }, { x: isle.at(-1)[0], y: isle.at(-1)[1] }, { ...bay(), ...rg, pathsBeyond: reader(roadMap(home, isle)), sea: { start: 'land', again: true, goal: 'land' }, tally });
  assert.ok(r?.kinds.includes('embark'), 'over the water');
  assert.ok(tally.n <= 2 * ROAD_PIECE_CAP + BEYOND_MAX_EXPANSIONS + 100, `${tally.n} cells: the ends' floods and the boat's search, never the home isle's ${home.length} pixels of road`);
});
