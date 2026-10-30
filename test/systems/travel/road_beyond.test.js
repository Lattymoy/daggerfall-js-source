// ROAD-BEYOND (2026-10-26, the owner: "road travel in the overworld needs to work properly outside of tamriel for
// overworld travel. I dont think it works currently"; bible/06-Systems/Travel-View.md ROAD-BEYOND) - A PLAN PAST THE BAY'S
// TABLE. Measured on the freeware's Tamriel through the host's own ground (routeGround as scenes/world.js tvRouteGround
// builds it) and the roads past the Bay as its regions lay them: the box never reached past an end beyond the table, so
// the Imperial City's way out round its lake was in no box (no way to Bruma, Chorrol or Cheydinhal); and the ladder's A*,
// a road a step under the field's price, flooded ~200 000 cells a rung - 4 to 11 seconds a long plan, and Bruma to
// Leyawiin "no way" after seven. Now: the roads first (searchByRoad), the box reaching past an end beyond the table, the
// ladder's whole spend counted, and a plan with no road the straight walk it is.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { planRoute, searchByRoad, routeGround, ROUTE_COST, BEYOND_MAX_EXPANSIONS, BEYOND_MARGIN, BY_ROAD_GREED, BY_ROAD_SEEK, ROUTE_MAX_EXPANSIONS, ROAD_END_SLACK, ROAD_PIECE_CAP } from '../../../src/systems/travel/travelRoute.js';
import { MAP_W, MAP_H, DIR } from '../../../src/world/road/roadNetwork.js';
import { beyondKey, setArenaRoads } from '../../../src/world/arenaRoads.js';

afterEach(() => { setArenaRoads(null); });
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const bay = () => ({ roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) });
const STEP = { '1,0': DIR.E, '1,-1': DIR.NE, '1,1': DIR.SE, '-1,0': DIR.W, '-1,-1': DIR.NW, '-1,1': DIR.SW, '0,1': DIR.S, '0,-1': DIR.N };
/** A road through `pts` (each the last one's neighbour) past the Bay, as a layer's reader. */
const roadThrough = (pts, kind = 'roads') => {
  const m = new Map();
  for (let k = 0; k < pts.length; k++) {
    let bits = 0;
    for (const j of [k - 1, k + 1]) if (j >= 0 && j < pts.length) bits |= STEP[`${pts[j][0] - pts[k][0]},${pts[j][1] - pts[k][1]}`];
    m.set(beyondKey(pts[k][0], pts[k][1]), (m.get(beyondKey(pts[k][0], pts[k][1])) ?? 0) | bits);
  }
  return (k, x, y) => (k === kind ? m.get(beyondKey(x, y)) ?? 0 : 0);
};
/** An L of road past the Bay: east along row 100 from 1100 to 1700, then south down column 1700 to row 400. */
const ell = () => {
  const pts = [];
  for (let x = 1100; x <= 1700; x++) pts.push([x, 100]);
  for (let y = 101; y <= 400; y++) pts.push([1700, y]);
  return pts;
};
const count = (kinds, k) => kinds.filter((q) => q === k).length;

test('ROAD-BEYOND the dials: the ladder\'s whole spend past the table, the open ground about the ends and how far a plan looks for a road from the wilds - op counts, never a clock (ROAD-GRAPH: the roads\' search has no spend)', () => {
  assert.equal(BEYOND_MAX_EXPANSIONS, 100000);
  assert.equal(BEYOND_MARGIN, 240);
  // PIN MOVED (ROAD-GRAPH, Travel-View.md): BY_ROAD_MAX_EXPANSIONS is gone - the roads' search walks its network to the edge
  assert.equal(BY_ROAD_GREED, 1.25);
  // PIN MOVED (ROAD-FOLLOW, Travel-View.md ROAD-FOLLOW): BY_ROAD_REACH (24 pixels of open ground about either end) is gone -
  // the open ground is each end's own leg (ROAD_END_SLACK rings past its nearest road) and a gap's narrowest crossing
  assert.equal(ROAD_END_SLACK, 2);
  assert.equal(ROAD_PIECE_CAP, 8192);
  assert.equal(BY_ROAD_SEEK, 96);
  assert.ok(BEYOND_MAX_EXPANSIONS < ROUTE_MAX_EXPANSIONS, 'the whole ladder past the table spends less than one rung on the Bay may');
});

test('ROAD-BEYOND the box reaches past an end beyond the table: a traveller walled in by a lake to the north, east and west walks out south of her own row and round it - where the box stopped at her row, and there was no way (mutant: the reach)', () => {
  // the Imperial City's shape: the lake's wall north of her (rows 280-292) and down both her sides to row 310
  const lake = (x, y) => (y >= 280 && y <= 292 && x >= 1480 && x <= 1520) || (y >= 280 && y <= 310 && ((x >= 1480 && x <= 1484) || (x >= 1516 && x <= 1520)));
  const r = planRoute({ x: 1500, y: 300 }, { x: 1500, y: 260 }, { isWater: lake });
  assert.ok(r, 'a way');
  assert.ok(r.pixels.some((p) => p.y > 310), 'round the lake\'s foot, south of her own row');
  assert.ok(r.pixels.every((p) => !lake(p.x, p.y)), 'never through it');
  assert.deepEqual(r.pixels.at(-1), { x: 1500, y: 260 });
  // and the other way about: the end walled in is the goal
  assert.ok(planRoute({ x: 1500, y: 260 }, { x: 1500, y: 300 }, { isWater: lake }), 'and to her');
  // on the Bay the box is the map's, as it was: the table's own edge the bound
  const src = read('src/systems/travel/travelRoute.js');
  assert.match(src, /const reachOf = \(margin\) => \(past \? \{ x0: Math\.min\(bounds\.x0, offTable\(from\) \? from\.x - margin : Infinity/);
  assert.match(src, /: bounds\);\n/);
});

test('ROAD-BEYOND a long plan past the Bay walks its roads, found over the roads alone: every step a road\'s, the cells expanded a handful a pixel of the road - where the ladder flooded the field beside it (mutants: the roads first, the step\'s edge)', () => {
  const pathsBeyond = roadThrough(ell());
  const tally = { n: 0 };
  const r = planRoute({ x: 1100, y: 100 }, { x: 1700, y: 400 }, { ...bay(), pathsBeyond, tally });
  assert.equal(r.kinds.length, 900);
  assert.equal(count(r.kinds, 'road'), 900, 'the road all the way');
  assert.equal(r.cost, 900 * ROUTE_COST.road);
  assert.ok(tally.n < 5 * 900, `${tally.n} cells for a road of 900 - the roads' own search`);
  const own = { n: 0 };   // PIN MOVED (ROAD-GRAPH): no spend is handed - its count read instead
  assert.ok(searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 400 }, { ...bay(), beyond: pathsBeyond, tally: own }) && own.n < 5 * 900, `within five cells a pixel (${own.n})`);
  assert.equal(searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 400 }, { ...bay(), beyond: null }), null, 'no layer: none');
});

test('ROAD-BEYOND the open ground about the ends: a town in the field beside the road\'s end reached across it, a traveller in the wilds well off the road walks to it first (within BY_ROAD_SEEK) and then by it - the roads\' search, not the ladder\'s flood (mutants: the reach, the seek)', () => {
  const pathsBeyond = roadThrough(ell());
  // a town ten pixels past the road's end, across the field
  let tally = { n: 0 };
  const town = planRoute({ x: 1100, y: 100 }, { x: 1710, y: 410 }, { ...bay(), pathsBeyond, tally });
  assert.ok(count(town.kinds, 'road') >= 890 && count(town.kinds, 'open') <= 12, `the road, then the field: ${count(town.kinds, 'open')} open`);
  assert.ok(tally.n < 6000, `${tally.n} cells`);
  // a traveller 60 pixels south of the road's row, 300 along it - within BY_ROAD_SEEK (ROAD-FOLLOW: her own leg the 62 rings
  // about her, out to the road and two past)
  tally = { n: 0 };
  const wild = planRoute({ x: 1400, y: 160 }, { x: 1700, y: 400 }, { ...bay(), pathsBeyond, tally });
  const firstRoad = wild.kinds.indexOf('road');
  assert.ok(firstRoad > 0 && wild.kinds.slice(0, firstRoad).every((k) => k === 'open'), 'to the road first');
  assert.ok(wild.kinds.slice(firstRoad).filter((k) => k === 'open').length === 0, 'then by it to the end');
  assert.ok(tally.n < 20000, `${tally.n} cells: the roads' search, not the ladder's`);
});

test('ROAD-BEYOND the roads\' search walks the open ground about its ends alone, leaning on its goal: a road round three sides of a field is its way (the field\'s middle far from both ends), the plan the cheaper walk across it (TV2\'s law); a road broken far from its ends no way of its; the lean on the goal spends fewer cells (mutant: the cheaper kept; open ground everywhere is ROAD-GRAPH\'s two ends\' legs, the greed the lattice\'s)', () => {
  // the road north 150, east 100, south 150 - 400 a road's price; straight across the field 100 at 3.5 (350)
  const u = [];
  for (let y = 300; y >= 150; y--) u.push([1100, y]);
  for (let x = 1101; x <= 1200; x++) u.push([x, 150]);
  for (let y = 151; y <= 300; y++) u.push([1200, y]);
  const r = searchByRoad({ x: 1100, y: 300 }, { x: 1200, y: 300 }, { ...bay(), beyond: roadThrough(u) });
  assert.equal(count(r.kinds, 'road'), r.kinds.length, 'the road round, never the field\'s middle');
  assert.equal(r.cost, 400);
  // PIN MOVED (ROAD-FOLLOW): the plan keeps the road round - TV2's law asked the ladder for a way by the roads dearer than
  // the straight walk and kept its cut across the field (350); the road joins the two ends, so the road is the way
  const plan = planRoute({ x: 1100, y: 300 }, { x: 1200, y: 300 }, { ...bay(), pathsBeyond: roadThrough(u) });
  assert.equal(plan.cost, 400, 'round the field by the road');
  assert.equal(count(plan.kinds, 'open'), 0);
  // PIN MOVED (ROAD-FOLLOW): a road broken far from both ends (a pixel's bit with no bit back) - the roads' own search
  // crosses the gap, its one open step (roadEndsSteps' narrowest crossing), where the ladder walked it
  const gap = roadThrough(ell());
  const broken = (k, x, y) => (x === 1400 && y === 100 ? gap(k, x, y) & ~DIR.W : gap(k, x, y));
  const crossed = searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 400 }, { ...bay(), beyond: broken });
  assert.equal(count(crossed.kinds, 'open'), 1, 'the gap, one step');
  const walked = planRoute({ x: 1100, y: 100 }, { x: 1700, y: 400 }, { ...bay(), pathsBeyond: broken });
  assert.equal(count(walked.kinds, 'open'), 1, 'the plan steps it');
  // ROAD-FOLLOW: the open ground an end's own leg alone - both its pixels in the end's ring (ROAD_END_SLACK past the nearest
  // road): a road that passes a goal 8 pixels off before it comes round to 5 off is walked round, never cut from its first pass
  const twice = [];
  for (let x = 1100; x <= 1300; x++) twice.push([x, 100]);
  for (let y = 101; y <= 113; y++) twice.push([1300, y]);
  for (let x = 1299; x >= 1150; x--) twice.push([x, 113]);
  const round = searchByRoad({ x: 1100, y: 100 }, { x: 1205, y: 108 }, { ...bay(), beyond: roadThrough(twice) });
  assert.equal(count(round.kinds, 'open'), 5, 'the road round to its nearest pass, then its own leg');
  assert.ok(round.cost > 300, `${round.cost}: never the cut from the first pass across the field`);
  // PIN MOVED (ROAD-GRAPH): the roads' search has no spend - it walks its network to the edge (road_graph.test.js)
  // the lean: the road of 900 found in fewer cells than the plain A* walks (some 3,300 - the fields about its start)
  const leaned = { n: 0 };
  searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 400 }, { ...bay(), beyond: roadThrough(ell()), tally: leaned });
  assert.ok(leaned.n < 2800, `${leaned.n} cells`);
});

// GREEDY-BEYOND's mutants' sweep: ROAD-FOLLOW keeps the roads' search on its roads, so one long road costs it few cells
// leaning or not (ROAD-BEYOND-no-greed lived), and no pin asked it without a layer (-no-layer-still-searched lived)
test('ROAD-BEYOND the roads\' search leans on its goal over a lattice of roads - the same way, at the same price, in far fewer cells than the plain A* (ROAD-GRAPH: 67,180 measured, its chains walked and the flood back counted); and with no layer past the Bay it searches nothing (mutants: the greed; the layer unasked)', () => {
  const lines = [];
  for (let y = 100; y <= 300; y += 4) { const p = []; for (let x = 1100; x <= 1500; x++) p.push([x, y]); lines.push(roadThrough(p)); }
  for (let x = 1100; x <= 1500; x += 4) { const p = []; for (let y = 100; y <= 300; y++) p.push([x, y]); lines.push(roadThrough(p)); }
  const lattice = (k, x, y) => lines.reduce((b, f) => b | f(k, x, y), 0);
  const tally = { n: 0 };
  const r = searchByRoad({ x: 1100, y: 100 }, { x: 1500, y: 300 }, { ...bay(), beyond: lattice, tally });
  assert.equal(r.cost, 600, 'by the roads, as short as the lattice allows');
  assert.equal(count(r.kinds, 'road'), r.kinds.length);
  assert.ok(tally.n < 50000, `${tally.n} cells`);   // PIN MOVED (ROAD-GRAPH): 36,011 - a junction every fourth pixel, its chains walked, the flood back's quarter
  assert.equal(searchByRoad({ x: 1100, y: 100 }, { x: 1500, y: 300 }, { ...bay() }), null, 'no layer: no search');
  const net = bay();
  for (let x = 100; x <= 140; x++) net.roads[200 * MAP_W + x] = (x > 100 ? DIR.W : 0) | (x < 140 ? DIR.E : 0);
  assert.equal(searchByRoad({ x: 100, y: 200 }, { x: 140, y: 200 }, { ...net }), null, 'nor over the Bay\'s own roads: the layer is its subject');
});

test('ROAD-BEYOND the ladder\'s rungs past the table are no wider than BEYOND_MARGIN about the ends: a causeway running off a thousand pixels is asked no further (the whole map\'s rung there allotted millions of cells for a spend that walks a hundred thousand), and the roads\' search asks a pixel\'s water only for a step its road\'s edge leaves by away from the ends (mutants: the rung, the edge)', () => {
  // the land a causeway one pixel wide along row 100 from 1100 to 3000; the goal on another
  let far = 0;
  const wet = (x, y) => { if (x > far) far = x; return !((y === 100 && x >= 1100 && x <= 3000) || (y === 300 && x >= 1100 && x <= 1150)); };
  assert.equal(planRoute({ x: 1100, y: 100 }, { x: 1150, y: 300 }, { isWater: wet }), null);
  assert.ok(far <= 1150 + BEYOND_MARGIN + 1, `asked out to ${far}`);
  // the roads' search: a pixel's water asked about the ends, and along the road only for the road's own steps
  let asks = 0;
  const tally = { n: 0 };
  searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 400 }, { ...bay(), beyond: roadThrough(ell()), isWater: () => { asks++; return false; }, tally });
  assert.ok(asks < 6 * tally.n, `${asks} asks for ${tally.n} cells (every neighbour's asked, some eight a cell)`);
});

// PIN MOVED (GREEDY-BEYOND, bible/06-Systems/Travel-View.md): the walk across country that spends its count leans on its goal
// once more (BEYOND_GREED), with its own count - a third BEYOND_MAX_EXPANSIONS
test('ROAD-BEYOND the spend is counted: a goal past the Bay no way reaches costs at most the ladder\'s whole spend, the walk\'s across country and its lean on the goal - never a rung of 200 000 four times over, twice (mutant: the ladder\'s spend)', () => {
  // the goal on an island of one pixel in a pond past the Bay; a road from the traveller that never reaches it
  const pond = (x, y) => Math.max(Math.abs(x - 1500), Math.abs(y - 500)) <= 6 && !(x === 1500 && y === 500);
  const pathsBeyond = roadThrough(ell());
  const tally = { n: 0 };
  assert.equal(planRoute({ x: 1100, y: 100 }, { x: 1500, y: 500 }, { ...bay(), isWater: pond, pathsBeyond, tally }), null);
  assert.ok(tally.n <= 3 * (BEYOND_MAX_EXPANSIONS + 1), `${tally.n} cells`);   // ROAD-GRAPH: no road comes near the goal, so the roads' search is never asked; each spend counts one past it
});

test('ROAD-BEYOND a plan with no road past the Bay is the straight walk it is: the ladder\'s heuristic the field\'s own price there, so a walk of 600 pixels expands some cells a pixel - where a road\'s price flooded the whole box and found none in the spend (mutant: hCost)', () => {
  const tally = { n: 0 };
  const r = planRoute({ x: 1100, y: 100 }, { x: 1700, y: 300 }, { tally });
  assert.ok(r, 'a walk');
  assert.equal(count(r.kinds, 'open'), r.kinds.length);
  assert.ok(tally.n < 25 * 600, `${tally.n} cells (the walk's ties among them)`);
  // and a plan handed the roads where no road joins its ends walks across country too, never "no way"
  const lone = roadThrough([[3000, 3000], [3001, 3000]]);
  const t2 = { n: 0 };
  const across = planRoute({ x: 1100, y: 100 }, { x: 1700, y: 700 }, { ...bay(), pathsBeyond: lone, tally: t2 });
  assert.ok(across && count(across.kinds, 'open') === across.kinds.length, 'across country');
  assert.ok(t2.n <= 2 * (BEYOND_MAX_EXPANSIONS + 1), `${t2.n} cells`);   // ROAD-GRAPH: nor here - the lone road joins neither end
});

test('ROAD-BEYOND the Bay\'s own plans are the Bay\'s: both ends on the table, no road\'s search and no other box (the source: the roads first only with an end past the table)', () => {
  const net = bay();
  for (let x = 100; x <= 140; x++) net.roads[200 * MAP_W + x] = (x > 100 ? DIR.W : 0) | (x < 140 ? DIR.E : 0);
  const r = planRoute({ x: 100, y: 200 }, { x: 140, y: 200 }, { ...net });
  assert.deepEqual(r.kinds, new Array(40).fill('road'));
  const src = read('src/systems/travel/travelRoute.js');
  assert.match(src, /const past = offTable\(from\) \|\| offTable\(to\);/);
  // PIN MOVED (ROAD-FOLLOW): and only where the roads join the two ends (roadEndsSteps' `strict`)
  assert.match(src, /if \(past && beyond && ends\?\.strict && \(!sea \|\| \(sea\.start === 'land' && sea\.goal !== 'sea'\)\)\) \{/);
});

// ── WITH ARENA2: the freeware's own Tamriel ─────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
test('ROAD-BEYOND on the freeware\'s Tamriel, the host\'s own ground: the Imperial City to Bruma is a way round Lake Rumare (it was none - the box stopped at the city\'s row), Bruma to Leyawiin a way across Cyrodiil (none after seven seconds), each within the spend', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { groundWoods, groundClimateIndex } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { WATER_BYTE } = await import('../../../src/world/roadsProducer.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (test/ui/tamriel4.test.js)
  try {
    const w = new WoodsFile(); w.load(bytes('WOODS.WLD'));
    const woods = groundWoods(w);
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    const climate = groundClimateIndex(maps.getClimateIndex.bind(maps));
    // scenes/world.js tvRouteGround: the ground's height, the Bay's water, and past it the composed ground's (tvWater)
    const tvWater = (x, y) => woods.getHeightMapValue(x, y) <= WATER_BYTE;
    const rg = routeGround(climate, (x, y) => woods.getHeightMapValue(x, y), WATER_BYTE, MAP_W, MAP_H, (x, y) => !tvWater(x, y));
    const IC = { x: 2069, y: 658 }, BRUMA = { x: 2046, y: 325 }, LEYAWIIN = { x: 2511, y: 1224 };   // world/arenaPlaces.js arenaPixels at the fit
    for (const [a, b, label] of [[IC, BRUMA, 'the Imperial City to Bruma'], [BRUMA, LEYAWIIN, 'Bruma to Leyawiin']]) {
      const tally = { n: 0 };
      const r = planRoute(a, b, { ...rg, tally });
      assert.ok(r, `${label}: a way`);
      assert.deepEqual(r.pixels.at(-1), b);
      assert.ok(r.pixels.slice(1, -1).every((p) => !rg.isWater(p.x, p.y)), `${label}: never a swim`);
      assert.ok(tally.n <= 2 * BEYOND_MAX_EXPANSIONS, `${label}: ${tally.n} cells`);
    }
    assert.ok(planRoute(IC, BRUMA, { ...rg }).pixels.some((p) => p.y > IC.y), 'round the lake, south of the city\'s own row');
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
