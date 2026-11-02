// PORT-SHIPS (2026-10-27, the owner's field report, item 8: "I went to solitude and the ships at works were inside town
// walls"; bible/03-World/Holdings.md section 7, PORT-SHIPS) - EVERY PORT ON THE FREEWARE: each harbour sounded through the book
// (systems/naval/harbourBook.js) as the world host hands it - its town's keep (systems/naval/harbourKeep.js) and the
// ground over the sea's top - on the ground the game builds (test/portShipsWorld.mjs), and every berth's ship measured
// against this test's own reading of the town: inside its walls or on them, on a landmark over the water (a capital's
// measures; a walled town's registered wall line, exactly), and the ground under her waterplane. Before, sounded off the
// water alone: Solitude's six ships through its west wall in the Karth, Alinor's six in its river inside its walls, two of
// Torval's and one of the Waterfront's through a pier, and five ships at four ports with a side on a bank (the Bay's are
// portships_bay.test.js's).
import '../../modsOff.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { portShipsWorld, HAS_PORT_WORLD, measurePorts, soundPort } from '../../portShipsWorld.mjs';
import { CAPITALS, SOLITUDE } from '../../../src/world/tamrielCapitals.js';

const skip = HAS_PORT_WORLD ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
const BLOCK = 102.4;
const SOLITUDE_ANCHOR = CAPITALS.find((c) => c.key === 'solitude').anchor;
after(async () => { (await portShipsWorld())?.done(); });

test('PORT-SHIPS (ARENA2): EVERY PORT PAST THE BAY - the 36 harbours sounded as the host hands them: every berth\'s ship and her quay clear of her town\'s walls and its landmarks, her waterplane over ground under the sea, and every port its six berths still; sounded off the water alone they stood five of Solitude\'s at its west cliff\'s foot (SOLITUDE-RELIEF), two of them under its arch, Alinor\'s six inside them, two of Torval\'s and one of the Waterfront\'s through a pier, and five ships on a bank until RELIEF-PEAKS and FB1028 moved the shores (mutants: the keep unhanded; the ground unhanded; a law\'s arm)', { skip }, async () => {
  const w = await portShipsWorld();
  assert.equal(w.pastBay.length, 36, 'BAY-LEFT-SEA\'s 29 ports and COAST-PORT\'s seven');   // PIN MOVED (FIELD BUGS 2026-10-28b COAST-PORT)
  const before = measurePorts(w, w.pastBay, false), now = measurePorts(w, w.pastBay, true);
  assert.deepEqual(Object.fromEntries(before.filter((r) => r.wrong.length).map((r) => [r.name, r.wrong])), {
    'Waterfront District': ['pier'],
    Solitude: ['arch', 'arch'],   // PIN MOVED (SOLITUDE-RELIEF, bible/03-World/Arena-Provinces.md): on its rock its walls stand on cliffs, the Karth at their feet
    Alinor: ['walls', 'walls', 'walls', 'walls', 'walls', 'walls'],
    Torval: ['pier', 'pier'],
  }, 'sounded off the water alone');   // PIN MOVED (FB1028): Sunhold's and Woodhearth's banks were TS2's shore cliffs, eased to the sea now   // PIN MOVED (RELIEF-PEAKS, at its merge into #1184): the land past the Bay stands on the kernel's own large map, so the shores' ground moved - Windhelm's, Winterhold's, Shimmerene's and Skywatch's banks under the sea now, Sunhold's and Woodhearth's over it
  assert.deepEqual(now.filter((r) => r.wrong.length).map((r) => [r.name, r.wrong]), [], 'every berth stands');
  assert.deepEqual(now.map((r) => [r.name, r.berths.length]), before.map((r) => [r.name, 6]), 'every port its six berths');
  // PIN MOVED (FIELD BUGS 2026-10-28b COAST-PORT): Silinorin, a village, has no walls to keep - its berths stand as any port's
  assert.deepEqual(now.filter((r) => !r.keep).map((r) => r.name), ['Silinorin'], 'every port past the Bay keeps its town (a capital, or a city walled on its outline)');
});

test('PORT-SHIPS (ARENA2): SOLITUDE\'S SHIPS AT ITS DOCKS - five of its six berths on the water off its quay below the north cliff, each outside the walls, beside the quay between and past its two piers, the sixth on the sea past the east wall; none at the west cliff\'s foot in the Karth, where five lay (mutants: the walls\' band; the piers; the rock)', { skip }, async () => {
  const w = await portShipsWorld();
  const port = w.pastBay.find((p) => p.name === 'Solitude');
  const { rect, berths } = soundPort(w, port, true);
  const ax = rect.minX + SOLITUDE_ANCHOR[0] * BLOCK, az = rect.maxZ - SOLITUDE_ANCHOR[1] * BLOCK;
  const at = berths.map((b) => [Math.round(b.pos[0] - ax), Math.round(az - b.pos[1])]);   // the anchor's metres, z south
  const W = SOLITUDE.wall, D = SOLITUDE.docks, Q = SOLITUDE.quay;
  const docks = at.filter(([dx, dz]) => dz < D.edge && dx > Q.x0 - BLOCK / 2 && dx < Q.x1 + BLOCK / 2);
  assert.equal(docks.length, 5, `five at the docks: ${JSON.stringify(at)}`);
  assert.ok(at.every(([dx, dz]) => dx < W.west || dx > W.east || dz < W.north || dz > W.south), 'all six outside the walls');
  assert.ok(at.some(([dx]) => dx > D.piers[0] && dx < D.piers[1]), 'one between the piers');
  assert.ok(!at.some(([dx, dz]) => dx < 0 && dz > W.north), 'none at the west cliff\'s foot');
  const before = soundPort(w, port, false).berths.map((b) => [Math.round(b.pos[0] - ax), Math.round(az - b.pos[1])]);
  assert.equal(before.filter(([dx, dz]) => dx < 0 && dz > W.north).length, 5, 'where five lay, at the west cliff\'s foot');   // PIN MOVED (SOLITUDE-RELIEF): at the west wall's foot, on the flat
});
