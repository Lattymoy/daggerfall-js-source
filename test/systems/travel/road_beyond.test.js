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

import { planRoute, searchByRoad, routeGround, ROUTE_COST, BEYOND_MAX_EXPANSIONS, BEYOND_MARGIN, BY_ROAD_MAX_EXPANSIONS, BY_ROAD_GREED, BY_ROAD_REACH, BY_ROAD_SEEK, ROUTE_MAX_EXPANSIONS } from '../../../src/systems/travel/travelRoute.js';
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

test('ROAD-BEYOND the dials: the ladder\'s whole spend past the table, the roads\' search\'s, the open ground about its ends and how far it looks for a road from the wilds - op counts, never a clock', () => {
  assert.equal(BEYOND_MAX_EXPANSIONS, 100000);
  assert.equal(BEYOND_MARGIN, 240);
  assert.equal(BY_ROAD_MAX_EXPANSIONS, 100000);
  assert.equal(BY_ROAD_GREED, 1.25);
  assert.equal(BY_ROAD_REACH, 24);
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
  assert.ok(searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 400 }, { ...bay(), beyond: pathsBeyond, maxExpansions: 5 * 900 }), 'within a spend of five cells a pixel');
  assert.equal(searchByRoad({ x: 1100, y: 100 }, { x: 1700, y: 400 }, { ...bay(), beyond: null }), null, 'no layer: none');
});

test('ROAD-BEYOND the open ground about the ends: a town in the field beside the road\'s end reached across it, a traveller in the wilds well off the road walks to it first (within BY_ROAD_SEEK) and then by it - the roads\' search, not the ladder\'s flood (mutants: the reach, the seek)', () => {
  const pathsBeyond = roadThrough(ell());
  // a town ten pixels past the road's end, across the field
  let tally = { n: 0 };
  const town = planRoute({ x: 1100, y: 100 }, { x: 1710, y: 410 }, { ...bay(), pathsBeyond, tally });
  assert.ok(count(town.kinds, 'road') >= 890 && count(town.kinds, 'open') <= 12, `the road, then the field: ${count(town.kinds, 'open')} open`);
  assert.ok(tally.n < 6000, `${tally.n} cells`);
  // a traveller 60 pixels south of the road's row, 300 along it - past BY_ROAD_REACH, within BY_ROAD_SEEK
  tally = { n: 0 };
  const wild = planRoute({ x: 1400, y: 160 }, { x: 1700, y: 400 }, { ...bay(), pathsBeyond, tally });
  const firstRoad = wild.kinds.indexOf('road');
  assert.ok(firstRoad > 0 && wild.kinds.slice(0, firstRoad).every((k) => k === 'open'), 'to the road first');
  assert.ok(wild.kinds.slice(firstRoad).filter((k) => k === 'open').length === 0, 'then by it to the end');
  assert.ok(tally.n < 20000, `${tally.n} cells: the roads' search, not the ladder's`);
});

test('ROAD-BEYOND the spend is counted: a goal past the Bay no way reaches costs at most the roads\' search, the ladder\'s whole spend and the walk\'s across country - never a rung of 200 000 four times over, twice (mutant: the ladder\'s spend)', () => {
  // the goal on an island of one pixel in a pond past the Bay; a road from the traveller that never reaches it
  const pond = (x, y) => Math.max(Math.abs(x - 1500), Math.abs(y - 500)) <= 6 && !(x === 1500 && y === 500);
  const pathsBeyond = roadThrough(ell());
  const tally = { n: 0 };
  assert.equal(planRoute({ x: 1100, y: 100 }, { x: 1500, y: 500 }, { ...bay(), isWater: pond, pathsBeyond, tally }), null);
  assert.ok(tally.n <= BY_ROAD_MAX_EXPANSIONS + 2 * BEYOND_MAX_EXPANSIONS, `${tally.n} cells`);
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
  assert.ok(t2.n <= BY_ROAD_MAX_EXPANSIONS + 2 * BEYOND_MAX_EXPANSIONS, `${t2.n} cells`);
});

test('ROAD-BEYOND the Bay\'s own plans are the Bay\'s: both ends on the table, no road\'s search and no other box (the source: the roads first only with an end past the table)', () => {
  const net = bay();
  for (let x = 100; x <= 140; x++) net.roads[200 * MAP_W + x] = (x > 100 ? DIR.W : 0) | (x < 140 ? DIR.E : 0);
  const r = planRoute({ x: 100, y: 200 }, { x: 140, y: 200 }, { ...net });
  assert.deepEqual(r.kinds, new Array(40).fill('road'));
  const src = read('src/systems/travel/travelRoute.js');
  assert.match(src, /const past = offTable\(from\) \|\| offTable\(to\);/);
  assert.match(src, /if \(past && beyond && \(!sea \|\| \(sea\.start === 'land' && sea\.goal !== 'sea'\)\)\) \{/);
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
