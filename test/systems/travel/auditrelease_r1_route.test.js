// AUDIT RELEASE R1-2 (2026-10-26; bible/01-Overview/audits/Audit-Release-R1.md) - the Travel View's ground past the table
// and the land that lands after it: routeGround (systems/travel/travelRoute.js) kept its answers past the Bay's table for
// the session (`dryBeyond`, dropped only past BEYOND_CACHE_MAX) and the sea lanes kept their water by the ground's
// `isWater` (planSeaLanes' _laneGround), while the host makes one ground a session (scenes/world.js tvRouteGround) and the
// trace, its relief and the fit land after the boot (world/tamriel/tamrielLand.js tamrielLandVersion). A plan asked before
// the land landed walked the authored continent's coast past the Bay ever after (AUDIT TESA III E2's routed item).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { routeGround } from '../../../src/systems/travel/travelRoute.js';
import { setTamrielTrace, tamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';

afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });
/** A trace all land but its rim, at the picture's own size (test/world/audittesa2r_roads.test.js's own). */
function landTrace() {
  const w = 320, h = 200, land = new Uint8Array(w * h).fill(1);
  for (let x = 0; x < w; x++) { land[x] = 0; land[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { land[y * w] = 0; land[y * w + w - 1] = 0; }
  return { w, h, land, province: new Uint8Array(w * h).fill(3) };
}

test('AUDIT RELEASE R1-2: the ground past the table is the land that stands at each ask - a trace landing (or another fit) after a plan drops the answers kept, and the water is another function then, so the sea lanes\' kept water is asked again; a ground with nothing past the table keeps its one function (mutants: the memo never dropped, the water\'s function kept)', () => {
  // the host's own read past the table: dry where the land stands - here, only once a trace has landed
  const beyond = () => !!tamrielTrace();
  const ground = routeGround(() => 0, () => 20, 3, 8, 8, beyond);
  const before = ground.isWater;
  assert.equal(before(-1, 3), true, 'before the trace, the sea past the table');
  assert.equal(before(9, 3), true);
  setTamrielTrace(landTrace());
  const after = ground.isWater;
  assert.notEqual(after, before, 'a new water once the land moved - planSeaLanes keys its kept tiles by it');
  assert.equal(after(-1, 3), false, 'the trace landed: dry past the table, the answer kept before it dropped');
  assert.equal(after(9, 3), false);
  assert.equal(ground.isWater, after, 'the same water while the land stands still');
  setTamrielFit({ ox: 0, oy: 0, ppu: 15.5 });
  assert.notEqual(ground.isWater, after, 'and another once the fit moved');
  assert.equal(after(2, 3), false, 'the table its own heights throughout');
  // the living world's ground (scenes/livingWorld/livingTrips.js): nothing past the table, one water for the session
  const bay = routeGround(() => 0, () => 20, 3, 8, 8);
  const w0 = bay.isWater;
  setTamrielTrace(null);
  assert.equal(bay.isWater, w0);
  assert.equal(w0(-1, 3), true);
});
