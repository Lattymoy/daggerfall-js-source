// SEA-TAUT (bible/01-Overview/bugs/Field-Bugs-2026-10-29g.md; a player: "the pathfinding is so broken for ships in this
// area, as it takes forever to get to the fights that aren't near to the shore"). A voyage past the Bay sails the sea
// lanes' plan (travelRoute.js planSeaLanes): its ends were flooded breadth first, a diagonal step counted as one, and the
// way to each pixel was the first neighbour's - in open water a run due east sailed as a "Λ", up to √2 the straight line
// (measured on the freeware's world with the planner before it: median 1.173, p90 1.364, max 1.403). The floods now count
// a step's own length, and the sailed stretch is pulled taut across the open water, its coasts the planner's own steps -
// counted and sliced as the floods are (PLAN-SLICES; AUDIT FB1029g F2: it ran as one block, 67 to 147 ms in one frame).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planSeaLanes, seaTaut, seaTautSteps, PLAN_YIELD_CELLS } from '../../../src/systems/travel/travelRoute.js';

const VOYAGE = { start: 'sea', goal: 'land', voyage: true };
const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
/** The sailed stretch's length (to its landfall) over the straight line between its ends. */
function sailedRatio(plan, from, to) {
  const sea = plan.pixels.slice(0, plan.kinds.indexOf('landfall') + 1);
  let len = 0;
  for (let k = 1; k < sea.length; k++) len += Math.hypot(sea[k].x - sea[k - 1].x, sea[k].y - sea[k - 1].y);
  return len / Math.hypot(to.x - from.x, to.y - from.y);
}
/** Each sailed step's straight line: every pixel water and all eight about it, or the planner's own one-pixel step. */
function stepsOpen(plan, isWater) {
  const open = (x, y) => [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => isWater(x + dx, y + dy)));
  for (let i = 1; i < plan.pixels.length; i++) {
    if (plan.kinds[i - 1] !== 'sea') continue;
    const a = plan.pixels[i - 1], b = plan.pixels[i];
    if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1) { assert.ok(isWater(b.x, b.y)); continue; }
    let { x, y } = a;
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
    assert.ok(open(x, y), `a run from open water (${x},${y})`);
    for (let err = dx - dy; x !== b.x || y !== b.y;) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      assert.ok(open(x, y), `over open water (${x},${y})`);
    }
  }
}

test('SEA-TAUT open water: a voyage past the table sails the straight line to her port, never the floods\' "Λ" (mutant: the pull undone - 1.357 the line)', () => {
  const isle = (x, y) => Math.abs(x - 1900) <= 1 && Math.abs(y - 420) <= 1;
  const isWater = (x, y) => !isle(x, y);
  const from = { x: 1500, y: 300 }, to = { x: 1900, y: 420 };
  const plan = planSeaLanes(from, to, { isWater, sea: VOYAGE });
  assert.ok(plan);
  assert.ok(sailedRatio(plan, from, to) <= 1.01, `${sailedRatio(plan, from, to)}`);
  assert.ok(plan.pixels.length < 12, 'a few long legs, not a pixel a leg');
  stepsOpen(plan, isWater);
  assert.equal(plan.kinds.length, plan.pixels.length - 1);
});

test('SEA-TAUT a sea of islets, no pixel of it open: the floods\' ways are the shortest a boat sails, a diagonal step its own length (mutant: a diagonal counted as one - 1.29 to 1.40 the line)', () => {
  const dots = (x, y) => x % 3 === 0 && y % 3 === 0;
  for (const to of [{ x: 1700, y: 300 }, { x: 1720, y: 340 }, { x: 1650, y: 240 }]) {
    const port = (x, y) => Math.abs(x - to.x) <= 1 && Math.abs(y - to.y) <= 1;
    const isWater = (x, y) => !dots(x, y) && !port(x, y);
    const from = { x: 1501, y: 301 };
    const plan = planSeaLanes(from, to, { isWater, sea: VOYAGE });
    assert.ok(plan, `${to.x},${to.y}`);
    assert.ok(sailedRatio(plan, from, to) <= 1.1, `${to.x},${to.y}: ${sailedRatio(plan, from, to)}`);
    stepsOpen(plan, isWater);
  }
});

test('SEA-TAUT the pull: a run only over open water, the coast\'s steps kept, the ends kept; a route of two pixels as it was', () => {
  const water = (x, y) => !(y === 3 && x >= 4 && x <= 6);   // a bar of land
  const route = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 }, { x: 7, y: 2 }, { x: 8, y: 2 }, { x: 9, y: 1 }, { x: 10, y: 0 }];
  const taut = seaTaut(route, water);
  assert.deepEqual(taut[0], route[0]);
  assert.deepEqual(taut.at(-1), route.at(-1));
  assert.ok(taut.some((p) => p.y === 2 && p.x >= 4 && p.x <= 6), 'along the bar its own steps');
  assert.deepEqual(seaTaut([{ x: 0, y: 0 }, { x: 1, y: 0 }], water), [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  assert.deepEqual(seaTaut(route, () => true), [route[0], route.at(-1)], 'all open: one run');
});

test('SEA-TAUT in slices (PLAN-SLICES; AUDIT FB1029g F2): the pull counts each pixel a line asks in the plan\'s tally and yields between two lines once PLAN_YIELD_CELLS are asked, never one long task - the same pull run to its end; the sea lanes\' plan runs it so (mutants: the yield, the count, the plan\'s pull uncounted)', () => {
  // a zigzag round a chain of islets (many short runs, gallops), and a long run past two islets (long bisects)
  const zigzag = { water: (x, y) => !(y === 50 && x % 40 === 20), route: [] };
  for (let x = 0; x <= 4000; x++) zigzag.route.push({ x, y: 40 + Math.round(10 * Math.sin(x / 15)) });
  const run = { water: (x, y) => !(y === 1 && (x === 2500 || x === 5000)), route: [] };
  for (let x = 0; x <= 6000; x++) run.route.push({ x, y: 0 });
  for (const { water, route } of [zigzag, run]) {
    const tally = { n: 0 }, it = seaTautSteps(route, water, tally);
    let r, yields = 0, last = 0, most = 0;
    while (!(r = it.next()).done) { yields++; most = Math.max(most, tally.n - last); last = tally.n; }
    assert.deepEqual(r.value, seaTaut(route, water), 'the same pull');
    assert.ok(tally.n > 4 * PLAN_YIELD_CELLS, `${tally.n} line pixels asked, each counted`);
    assert.ok(yields >= Math.floor(tally.n / (PLAN_YIELD_CELLS + route.length)), `${yields} yields over ${tally.n} cells`);
    assert.ok(most <= PLAN_YIELD_CELLS + route.length, `at most ${most} cells between two yields - a slice and a line`);
  }
  assert.match(readFileSync(new URL('../../../src/systems/travel/travelRoute.js', import.meta.url), 'utf8'), /const taut = yield\* seaTautSteps\(pixels, isWater, tally\);/, 'the voyage\'s pull in the plan\'s slices, its cells the plan\'s');
});

test('SEA-TAUT with ARENA2: forty voyages past the Bay between open waters sail within a hundredth of the straight line nine times in ten (measured before, the planner at main\'s 043338ef6: median 1.173, p90 1.364, max 1.403) (mutants: the pull; the floods\' diagonal)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { groundWoods, groundMaps, tamrielClimateAt, dropGroundCache } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const ground = groundWoods(woods);
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const water = (x, y) => isWaterPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y));
    const open = (x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (!water(x + dx, y + dy)) return false; return true; };
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
    const ratios = [];
    while (ratios.length < 40) {
      const a = { x: Math.floor(-150 + rnd() * 500), y: Math.floor(550 + rnd() * 1200) }, b = { x: Math.floor(-150 + rnd() * 500), y: Math.floor(550 + rnd() * 1200) };
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (!open(a.x, a.y) || !open(b.x, b.y) || d < 80 || d > 450) continue;
      const plan = planSeaLanes(a, b, { seaWater: water, isWater: water, sea: { start: 'sea', goal: 'sea' } });
      assert.ok(plan, `${a.x},${a.y} to ${b.x},${b.y}`);
      let len = 0;
      for (let k = 1; k < plan.pixels.length; k++) len += Math.hypot(plan.pixels[k].x - plan.pixels[k - 1].x, plan.pixels[k].y - plan.pixels[k - 1].y);
      ratios.push(len / d);
    }
    ratios.sort((p, q) => p - q);
    console.log(`[sea-taut] 40 voyages: median ${ratios[20].toFixed(3)}, p90 ${ratios[36].toFixed(3)}, max ${ratios[39].toFixed(3)}`);
    // the most a voyage sails round land that stands across its straight line; the floods' diagonal alone made p90 1.023
    assert.ok(ratios[36] <= 1.01 && ratios[39] <= 1.1, `p90 ${ratios[36]}, max ${ratios[39]}`);
  } finally { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); }
});
