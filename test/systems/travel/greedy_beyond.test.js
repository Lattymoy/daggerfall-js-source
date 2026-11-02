// GREEDY-BEYOND (2026-10-28, the owner of the Imperial City's refusal from Daggerfall: "Yes fix that";
// bible/06-Systems/Travel-View.md GREEDY-BEYOND): an all-open plan past the Bay that spends its count leans on its goal
// (BEYOND_GREED) once, with its own count. On open ground every monotone path costs the same, so a detour near the goal
// made the exact search expand the whole parallelogram between the ends, and a joined place said "no way by land".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { planRoute, routeGround, ROUTE_COST, BEYOND_MAX_EXPANSIONS, BEYOND_GREED } from '../../../src/systems/travel/travelRoute.js';
import { MAP_W, MAP_H } from '../../../src/world/road/roadNetwork.js';

/** The octile distance at the field's price: no way between the two is cheaper. */
const floor = (a, b) => { const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y); return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * ROUTE_COST.open; };
const FROM = { x: 1100, y: 100 }, TO = { x: 2600, y: 500 };
/** A wall of water in front of the goal, open at its top: the way round it is short, the exact search's flood is not. */
const wall = (x, y) => x === 2590 && y >= 420 && y <= 700;

test('GREEDY-BEYOND the lean: a long walk past the Bay with a wall before its goal spent the exact count and said "no way"; it is now a way round the wall, within BEYOND_GREED of the cheapest, every step on dry ground (mutants: the lean dropped; the lean the exact search again; its count unbounded)', () => {
  assert.equal(BEYOND_GREED, 3);
  const tally = { n: 0 };
  const r = planRoute(FROM, TO, { isWater: wall, tally });
  assert.ok(r, 'a way');
  assert.deepEqual([r.pixels[0], r.pixels.at(-1)], [FROM, TO]);
  assert.ok(r.pixels.every((p) => !wall(p.x, p.y)), 'never through the wall');
  assert.ok(r.pixels.some((p) => p.y < 420 && p.x >= 2580), 'round its open top');
  assert.ok(r.cost <= BEYOND_GREED * floor(FROM, TO), `${Math.round(r.cost)} against ${Math.round(floor(FROM, TO))}`);
  assert.ok(r.cost <= 1.1 * floor(FROM, TO), 'and far nearer the cheapest than its bound (1.073 measured)');
  assert.ok(tally.n > BEYOND_MAX_EXPANSIONS && tally.n <= 2 * BEYOND_MAX_EXPANSIONS, `the exact count spent, then the lean's own: ${tally.n} cells`);
});

test('GREEDY-BEYOND untouched: a walk the exact search finds inside its count is the same walk, at the same count; a box that held no way is not searched again - the plan spends its rungs\' own cells and no more (mutants: the lean asked of every refusal; the lean asked first)', () => {
  const t1 = { n: 0 };
  const open = planRoute(FROM, TO, { tally: t1 });
  assert.ok(open && t1.n < BEYOND_MAX_EXPANSIONS, `no wall: the exact walk (${t1.n} cells)`);
  assert.ok(Math.abs(open.cost - floor(FROM, TO)) < 1e-6, 'the cheapest there is');
  // a basin past the Bay walled by water all round, the goal outside it: every rung floods the basin and finds no way
  const basin = (x, y) => (Math.abs(x - 1500) === 60 && Math.abs(y - 300) <= 60) || (Math.abs(y - 300) === 60 && Math.abs(x - 1500) <= 60);
  const from = { x: 1500, y: 300 }, to = { x: 1600, y: 320 };
  const rungs = [6, 20, 60, 240].map((m) => { const t = { n: 0 }; assert.equal(planRoute(from, to, { isWater: basin, tally: t, margins: [m] }), null); return t.n; });
  const t2 = { n: 0 };
  assert.equal(planRoute(from, to, { isWater: basin, tally: t2 }), null, 'no way out of the basin');
  assert.ok(t2.n < BEYOND_MAX_EXPANSIONS, `the ladder's boxes, not its count (${t2.n})`);
  assert.equal(t2.n, rungs.reduce((a, b) => a + b, 0), 'its rungs\' own cells, no lean after them');
});

test('GREEDY-BEYOND the wiring: the lean comes after the walk across country, is asked only of a plan past the Bay with no boat, its box the widest rung\'s', () => {
  const src = readFileSync(new URL('../../../src/systems/travel/travelRoute.js', import.meta.url), 'utf8');
  const fall = src.indexOf('if (!best && past && (roads || tracks) && !sea)\n    return yield* planRouteSteps(');
  const lean = src.indexOf('if (!best && past && !roads && !tracks && !sea && tally.n - spent >= BEYOND_MAX_EXPANSIONS) {');
  assert.ok(fall > 0 && lean > fall, 'after the roads\' plan falls to the walk across country');
  assert.match(src.slice(lean, src.indexOf('\n  }\n', lean)), /bounds: reachOf\(BEYOND_MARGIN\),\n\s*margin: BEYOND_MARGIN,\n\s*maxExpansions: BEYOND_MAX_EXPANSIONS,\n\s*openBlocked,\n\s*goalExempt,\n\s*peakAt,\n\s*sea,\n\s*beyond,\n\s*hCost: BEYOND_GREED \* ROUTE_COST\.open/);
});

// ── WITH ARENA2: the freeware's own Tamriel ─────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
test('GREEDY-BEYOND on the freeware\'s Tamriel, the host\'s own ground with no roads past the Bay landed: Daggerfall, Bruma and Leyawiin to the Imperial City are ways (each "no way" before), Daggerfall\'s within a tenth of the cheapest (7,574, measured uncapped); Daggerfall to Bruma is the walk it was, at its count', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
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
    const tvWater = (x, y) => woods.getHeightMapValue(x, y) <= WATER_BYTE;
    const rg = routeGround(climate, (x, y) => woods.getHeightMapValue(x, y), WATER_BYTE, MAP_W, MAP_H, (x, y) => !tvWater(x, y));
    const IC = { x: 2069, y: 658 }, DF = { x: 207, y: 213 }, BRUMA = { x: 2046, y: 325 }, LEYAWIIN = { x: 2511, y: 1224 };
    for (const [a, label] of [[DF, 'Daggerfall'], [BRUMA, 'Bruma'], [LEYAWIIN, 'Leyawiin']]) {
      const tally = { n: 0 };
      const r = planRoute(a, IC, { ...rg, tally });
      assert.ok(r, `${label} to the Imperial City: a way`);
      assert.deepEqual(r.pixels.at(-1), IC);
      assert.ok(r.pixels.slice(1, -1).every((p) => !rg.isWater(p.x, p.y)), `${label}: never a swim`);
      assert.ok(tally.n <= 2 * BEYOND_MAX_EXPANSIONS, `${label}: ${tally.n} cells`);
      if (a === DF) assert.ok(r.cost <= 1.1 * 7574, `Daggerfall: ${Math.round(r.cost)}`);
    }
    const tally = { n: 0 };
    const r = planRoute(DF, BRUMA, { ...rg, tally });
    assert.deepEqual([Math.round(r.cost), tally.n], [6898, 52257], 'Daggerfall to Bruma: untouched');
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
