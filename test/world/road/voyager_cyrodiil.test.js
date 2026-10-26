// VOYAGER-CYRODIIL (2026-10-26, KPbICA: "For Cyrodill I would suggest to use this detailed map"; bible/03-World/Roads.md
// VOYAGER-CYRODIIL) - CYRODIIL'S NAMED ROADS (world/road/cyrodiilRoads.js): the table read off the reference map, the
// Red Ring Road round the Imperial City from its own span and gates, each road planned coarse over the land and cut into
// legs a region routes, and the host's spec read off the places that stand and the capital's own plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CYRODIIL_ROADS, RING_POINTS, RING_GAP, RING_REACH, RING_SHORE_GAP, LEG_MAX, COARSE, COARSE_MARGIN, SNAP_REACH,
  cyrodiilTrunkSpec, ringPoints, courseLegs, planTrunkLegs,
} from '../../../src/world/road/cyrodiilRoads.js';
import { buildRoadNetwork, MAP_W, MAP_H } from '../../../src/world/road/roadNetwork.js';
import { landForRoutes } from '../../../src/world/road/roadLand.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const flat = { heightAt: () => 20, walkable: () => true, wet: () => false };

test('VOYAGER-CYRODIIL the table: eight roads, their names and their cities in order as the reference map runs them, each city one TAMRIEL1 stands in the Imperial province; the ring\'s and the legs\' measures (mutant: a name, a stop, the order, a measure)', () => {
  assert.deepEqual(CYRODIIL_ROADS.map((r) => [r.name, !!r.ring, !!r.fromRing, r.stops.map((s) => (typeof s === 'string' ? s : [...s]))]), [
    ['Red Ring Road', true, false, []],
    ['Gold Road', false, true, ['Skingrad', 'Kvatch', 'Anvil']],
    ['Black Road', false, true, ['Chorrol']],
    ['Silver Road', false, true, ['Bruma']],
    ['Orange Road', false, false, ['Chorrol', 'Bruma']],
    ['Blue Road', false, true, ['Cheydinhal']],
    ['Yellow Road', false, true, [[191, 106], 'Leyawiin']],
    ['Green Road', false, true, ['Bravil', 'Leyawiin']],
  ]);
  const imperial = new Set(CITIES.filter((c) => c.province === 'Imperial').map((c) => c.name));
  for (const r of CYRODIIL_ROADS) for (const s of r.stops) if (typeof s === 'string') assert.ok(imperial.has(s), `${s} is Cyrodiil's`);
  assert.deepEqual([RING_POINTS, RING_GAP, RING_REACH, RING_SHORE_GAP, LEG_MAX, COARSE, COARSE_MARGIN, SNAP_REACH], [12, 3, 80, 2, 80, 4, 96, 6]);
  assert.ok(LEG_MAX < 100, 'a leg inside a region\'s apron (world/tamrielRoads.js REGION_APRON)');
});

test('VOYAGER-CYRODIIL the spec: each city by the pixel its place stands on, a point of the course by the picture\'s fit; a road is cut at a city that does not stand; no capital, no ring and no road from it - the Orange Road, city to city, stands (mutants: the cut, the ring\'s guard, the from-ring guard)', () => {
  const at = { Skingrad: [100, 50], Kvatch: [80, 60], Anvil: [60, 70], Chorrol: [100, 20], Bruma: [130, 10], Cheydinhal: [200, 30], Bravil: [180, 120], Leyawiin: [190, 160] };
  const capital = { centre: [140, 60], half: 4, gates: [[135, 60]] };
  const spec = cyrodiilTrunkSpec({ cityAt: (n) => at[n] ?? null, pictureAt: (px, py) => [px * 2, py * 2], capital });
  assert.deepEqual(spec.ring, { centre: [140, 60], half: 4, gates: [[135, 60]] });
  assert.deepEqual(spec.roads.map((r) => [r.name, r.stops]), [
    ['Red Ring Road', []], ['Gold Road', [[100, 50], [80, 60], [60, 70]]], ['Black Road', [[100, 20]]], ['Silver Road', [[130, 10]]],
    ['Orange Road', [[100, 20], [130, 10]]], ['Blue Road', [[200, 30]]], ['Yellow Road', [[383, 213], [190, 160]]], ['Green Road', [[180, 120], [190, 160]]],
  ]);
  const noKvatch = cyrodiilTrunkSpec({ cityAt: (n) => (n === 'Kvatch' ? null : at[n] ?? null), pictureAt: (px, py) => [px, py], capital });
  assert.deepEqual(noKvatch.roads.find((r) => r.name === 'Gold Road').stops, [[100, 50]], 'the Gold Road to Skingrad, no further');
  const noCity = cyrodiilTrunkSpec({ cityAt: (n) => at[n] ?? null, pictureAt: (px, py) => [px, py], capital: null });
  assert.deepEqual(noCity.roads.map((r) => r.name), ['Orange Road'], 'with no Imperial City, the roads that leave it stand none');
  assert.equal(noCity.ring, null);
  assert.equal(cyrodiilTrunkSpec({ cityAt: () => null, pictureAt: () => [0, 0], capital: null }), null);
});

test('VOYAGER-CYRODIIL the Red Ring Road\'s points: on twelve bearings clockwise from north - with no water about the city, the span\'s half and RING_GAP out; a lake within reach, RING_SHORE_GAP short of its shore, never nearer than that; a bearing with no lake, the radius between its nearest neighbours\' by their share of the turn; snapped to land (mutants: the bearings, the gap, the shore\'s gap, the reach, the clamp, the shares, the open side)', () => {
  const ring = { centre: [100, 100], half: 4 };
  assert.deepEqual(ringPoints(ring, () => true, () => false), [
    [100, 93], [104, 94], [106, 96], [107, 100], [106, 104], [104, 106], [100, 107], [96, 106], [94, 104], [93, 100], [94, 96], [96, 94],
  ]);
  // a lake round the north, its shore 15 out: the ring 13 out on every bearing - the open south at the shore's reach too
  const north = (x, y) => y <= 85;
  assert.deepEqual(ringPoints(ring, (x, y) => !north(x, y), north), [
    [100, 87], [108, 87], [123, 86], [127, 100], [123, 114], [114, 123], [100, 127], [86, 123], [77, 114], [73, 100], [77, 86], [92, 87],
  ]);
  // the sea east of x 120 and a lake north of y 70: each bearing that meets either two short of it; south and west meet
  // neither, and take 37 and 57 (the bearings either side) by their shares - 41 one bearing from the 37, 53 one from the 57
  const wet = (x, y) => x >= 120 || y <= 70;
  assert.deepEqual(ringPoints(ring, (x, y) => !wet(x, y), wet), [
    [100, 72], [117, 71], [118, 89], [118, 100], [118, 111], [119, 132], [100, 141], [77, 139], [58, 125], [47, 100], [51, 71], [83, 71],
  ]);
  // water at the ray's start: the ring at the start, never nearer the city
  const moat = (x, y) => Math.hypot(x - 100, y - 100) >= 7.5 && Math.hypot(x - 100, y - 100) < 9;
  assert.deepEqual(ringPoints(ring, () => true, moat)[0], [100, 93]);
  // a point off the land snaps to the nearest land
  assert.deepEqual(ringPoints(ring, (x, y) => !(x === 100 && y === 93), () => false)[0], [99, 92]);
});

test('VOYAGER-CYRODIIL a course cut into legs: two points within LEG_MAX one leg; farther, the coarse plan\'s cuts, each leg within LEG_MAX and chained end to start; a lake between them gone round, every cut on land; a lake past the first box\'s reach gone round over the wider one; no way at all, the straight way cut (mutants: the cut\'s reach, the chain, the snap, the coarse water, the wider box, the straight cut)', () => {
  assert.deepEqual(courseLegs([10, 10], [80, 40], flat), [[[10, 10], [80, 40]]]);
  const legs = courseLegs([100, 100], [400, 160], flat);
  assert.ok(legs.length >= 4, `${legs.length} legs`);
  assert.deepEqual(legs[0][0], [100, 100]);
  assert.deepEqual(legs.at(-1)[1], [400, 160]);
  for (let k = 0; k < legs.length; k++) {
    assert.ok(cheb(legs[k][0], legs[k][1]) <= LEG_MAX, `leg ${k}: ${JSON.stringify(legs[k])}`);
    if (k) assert.deepEqual(legs[k][0], legs[k - 1][1], 'chained');
  }
  // a lake across the straight way: every cut on land
  const lake = (x, y) => Math.abs(x - 250) < 30 && Math.abs(y - 130) < 60;
  const round = courseLegs([100, 130], [400, 130], { heightAt: () => 20, walkable: (x, y) => !lake(x, y), wet: lake });
  for (const [a] of round.slice(1)) assert.ok(!lake(a[0], a[1]), `a cut on land: ${a}`);
  assert.ok(round.some(([a]) => Math.abs(a[1] - 130) >= 60), 'round the lake\'s end');
  // a lake 300 pixels across the way, past the first box's reach: the wider box goes round it
  const wide = (x, y) => Math.abs(x - 250) < 30 && Math.abs(y - 130) < 150;
  const wider = courseLegs([100, 130], [400, 130], { heightAt: () => 20, walkable: (x, y) => !wide(x, y), wet: wide });
  assert.ok(wider.some(([a]) => Math.abs(a[1] - 130) >= 150), `round its end: ${JSON.stringify(wider)}`);
  for (const [a, b] of wider) assert.ok(cheb(a, b) <= LEG_MAX, 'each leg within a region\'s grid');
  // no way at all: the straight way cut, each leg within LEG_MAX - none a region could not hold
  const wall = (x) => x >= 240 && x <= 260;
  assert.deepEqual(courseLegs([100, 130], [400, 130], { heightAt: () => 20, walkable: (x) => !wall(x), wet: wall }),
    [[[100, 130], [160, 130]], [[160, 130], [220, 130]], [[220, 130], [280, 130]], [[280, 130], [340, 130]], [[340, 130], [400, 130]]]);
});

test('VOYAGER-CYRODIIL the legs of every road: the ring round, each gate to its nearest ring point, each road from the ring point nearest its first city\'s bearing, city to city (mutants: the ring\'s closure, the gate, the bearing\'s pick)', () => {
  const spec = { ring: { centre: [200, 200], half: 4, gates: [[195, 200]] }, roads: [
    { name: 'Red Ring Road', ring: true, fromRing: false, stops: [] },
    { name: 'East', ring: false, fromRing: true, stops: [[260, 200]] },
    { name: 'North then east', ring: false, fromRing: false, stops: [[200, 150], [240, 140]] },
  ] };
  const legs = planTrunkLegs(spec, flat);
  const ring = ringPoints(spec.ring, () => true, () => false);
  for (let k = 0; k < RING_POINTS; k++) assert.deepEqual(legs[k], [ring[k], ring[(k + 1) % RING_POINTS]], `ring leg ${k}`);
  assert.deepEqual(legs[RING_POINTS], [[195, 200], [193, 200]], 'the west gate to the west point');
  assert.deepEqual(legs[RING_POINTS + 1], [[207, 200], [260, 200]], 'east from the east point');
  assert.deepEqual(legs[RING_POINTS + 2], [[200, 150], [240, 140]]);
  assert.equal(legs.length, RING_POINTS + 3);
  assert.deepEqual(planTrunkLegs(null, flat), []);
  // a bearing with no land in reach has no point: the ring closes over it
  const gap = { ...flat, walkable: (x, y) => Math.hypot(x - 200, y - 193) > 9 };
  const holed = planTrunkLegs({ ...spec, roads: spec.roads.slice(0, 1) }, gap);
  const pts = ringPoints(spec.ring, gap.walkable, () => false);
  assert.equal(pts[0], null);
  assert.deepEqual(holed.slice(0, RING_POINTS - 1), pts.slice(1).map((p, k, a) => [p, a[(k + 1) % a.length]]), 'eleven legs, the last from the eleventh point back to the first');
});

test('VOYAGER-CYRODIIL a named road\'s legs are routed as roads by the builder after the towns\' roads, taking them where they run its way (mutants: the trunks unread, the owner\'s test, the order)', () => {
  const N = MAP_W * MAP_H, heights = new Uint8Array(N).fill(20), water = new Uint8Array(N);
  const land = landForRoutes(heights, water, null, MAP_W, MAP_H);
  const towns = [{ x: 300, y: 200, type: LOCATION_TYPES.TownCity }, { x: 340, y: 200, type: LOCATION_TYPES.TownCity }];
  const base = { locations: towns, heightAt: () => 20, isWater: () => false, terrain: land };
  const net = buildRoadNetwork({ ...base, trunks: [[{ x: 280, y: 200 }, { x: 360, y: 200 }]] });
  assert.equal(net.stats.trunkLegs, 1);
  const path = [];
  for (let k = 0; k < net.stats.trunkPath.length; k += 2) path.push(`${net.stats.trunkPath[k]},${net.stats.trunkPath[k + 1]}`);
  assert.ok(path.includes('300,200') && path.includes('340,200'), 'through the towns on its way, on their road');
  assert.ok(net.roads[200 * MAP_W + 280] && net.roads[200 * MAP_W + 360], 'whole to its ends');
  const theirs = buildRoadNetwork({ ...base, trunks: [[{ x: 280, y: 200 }, { x: 360, y: 200 }]], owns: (n) => n.x > 350 });
  assert.equal(theirs.stats.trunkLegs, 0, 'a leg whose first end is another region\'s');
  assert.equal(buildRoadNetwork(base).stats.trunkLegs, undefined, 'none asked, none counted - the Bay\'s stats as they were');
  const src = read('src/world/road/roadNetwork.js');
  assert.ok(src.indexOf('for (const [i, j] of routed) {') < src.indexOf('for (const [a, b] of trunks ?? []) {'), 'after the towns\' roads');
  assert.ok(src.indexOf('for (const [a, b] of trunks ?? []) {') < src.indexOf('const paths = new Uint8Array(roads);'), 'before the tracks');
});

test('VOYAGER-CYRODIIL the host reads the Imperial City\'s ring and gates off the capital\'s own plan, none written: its span (capitalSpan), its walked gates (capitalGates), the cities by the places that stand; the roads\' worker plans the legs on its own ground, no capital\'s pixel a road\'s (mutant: a literal gate, the span unread)', () => {
  const host = read('src/scenes/tamrielRoadsHost.js');
  assert.match(host, /half: \(capitalSpan\(CAPITALS\[k\]\) \+ 1\) >> 1, gates: capitalGates\(k, \{ walkable \}\)\.map\(\(g\) => \[g\.x, g\.y\]\)/);
  assert.match(host, /const trunks = capitals \? cyrodiilTrunksFor\(forPixels, walkable\) : null;/);
  assert.doesNotMatch(host.slice(host.indexOf('export function cyrodiilTrunksFor')), /gates: \[\[\d/);
  const worker = read('src/world/tamrielRoadsWorker.js');
  assert.match(worker, /trunkLegs: planTrunkLegs\(m\.trunks \?\? null, \{ heightAt, walkable, wet \}\)/);
  assert.match(worker, /const walkable = \(x, y\) => !inBay\(x, y\) && heightAt\(x, y\) > WATER_BYTE && !held\.has\(`\$\{x\},\$\{y\}`\);/);
});
