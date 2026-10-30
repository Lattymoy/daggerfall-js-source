// ZONE-ROADS (2026-10-30, the owner: "overworld travel in the pvp zone ... not allowing you to traverse to different
// locations reliably"; bible/06-Systems/Travel-View.md ZONE-ROADS): the roads' search past the Bay gave up after 100,000
// cells. Cyrodiil's winding roads need up to 255,449 between two of its towns, so 111 of 992 town trips said "no way".
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { planRoute, BY_ROAD_MAX_EXPANSIONS, ROAD_PIECE_CAP } from '../../../src/systems/travel/travelRoute.js';
import { MAP_W, MAP_H, DIR } from '../../../src/world/road/roadNetwork.js';
import { beyondKey, setArenaRoads } from '../../../src/world/arenaRoads.js';

afterEach(() => { setArenaRoads(null); });

/** A switchback road past the Bay: `rows` rows of `len` pixels, two apart, joined at alternate ends. */
function switchback(x0, y0, len, rows) {
  const pts = [];
  for (let k = 0; k < rows; k++) {
    const y = y0 + 2 * k;
    for (let i = 0; i < len; i++) pts.push([k % 2 ? x0 + len - 1 - i : x0 + i, y]);
    if (k < rows - 1) pts.push([k % 2 ? x0 : x0 + len - 1, y + 1]);
  }
  const step = { '1,0': DIR.E, '1,-1': DIR.NE, '1,1': DIR.SE, '-1,0': DIR.W, '-1,-1': DIR.NW, '-1,1': DIR.SW, '0,1': DIR.S, '0,-1': DIR.N };
  const m = new Map();
  pts.forEach((p, k) => {
    let bits = 0;
    for (const j of [k - 1, k + 1]) if (j >= 0 && j < pts.length) bits |= step[`${pts[j][0] - p[0]},${pts[j][1] - p[1]}`];
    m.set(beyondKey(p[0], p[1]), bits);
  });
  return { from: { x: pts[0][0], y: pts[0][1] }, to: { x: pts.at(-1)[0], y: pts.at(-1)[1] }, length: pts.length, on: (x, y) => m.has(beyondKey(x, y)), beyond: (kind, x, y) => (kind === 'roads' ? m.get(beyondKey(x, y)) ?? 0 : 0) };
}

for (const [where, x0, y0] of [['Cyrodiil, the open zone', 1600, 700], ['Skyrim, past the zone', 1500, -400]]) {
  test(`ZONE-ROADS ${where}: a road trip whose only way winds past 100,000 cells is walked by the road, inside the spend - at 100,000 it was "no way" (mutant: the spend back to 100,000)`, () => {
    assert.equal(BY_ROAD_MAX_EXPANSIONS, 300000);
    const road = switchback(x0, y0, 1500, 80);
    const roads = { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) };
    const tally = { n: 0 };
    const r = planRoute(road.from, road.to, { ...roads, isWater: (x, y) => !road.on(x, y), pathsBeyond: road.beyond, tally });
    assert.ok(r, 'a way');
    assert.deepEqual([r.pixels[0], r.pixels.at(-1)], [road.from, road.to]);
    assert.equal(r.pixels.length, road.length, 'the whole road, no field crossed');
    assert.ok(r.kinds.every((k) => k === 'road'));
    assert.ok(tally.n > 100000 && tally.n <= BY_ROAD_MAX_EXPANSIONS + 2 * ROAD_PIECE_CAP, `${tally.n} cells`);
  });
}
