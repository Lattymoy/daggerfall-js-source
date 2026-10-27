// PORT-SHIPS (2026-10-27; bible/03-World/Holdings.md section 7, PORT-SHIPS) - EVERY PORT OF THE BAY ON THE FREEWARE: the port
// law's 106 towns sounded through the harbour book as the world host hands it (their walled cities' keep - TS7 - and the
// ground over the sea's top) on the ground the game builds (test/portShipsWorld.mjs), measured as portships_real.test.js
// measures the ports past the Bay. Sounded off the water alone, four ships at three of them stood a side on a bank.
import '../../modsOff.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { portShipsWorld, HAS_PORT_WORLD, measurePorts } from '../../portShipsWorld.mjs';

const skip = HAS_PORT_WORLD ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
/** The Bay's ports with a ship on a bank, sounded off the water alone. */
const BAY_BEFORE = Object.freeze({ Chestertower: ['land'], Pilliweyn: ['land'], Wadijerareg: ['land', 'land'] });
after(async () => { (await portShipsWorld())?.done(); });

test('PORT-SHIPS (ARENA2): EVERY PORT OF THE BAY - the port law\'s 106 towns sounded as the host hands them: every berth stands (its walls - TS7 - and the ground), and every port keeps as many berths as it had; sounded off the water alone, four ships at three ports stood a side on a bank, Chestertower\'s 28 m up (mutants: the ground unhanded)', { skip }, async () => {
  const w = await portShipsWorld();
  assert.equal(w.bay.length, 106, 'the port law\'s 106');
  const before = measurePorts(w, w.bay, false), now = measurePorts(w, w.bay, true);
  assert.deepEqual(Object.fromEntries(before.filter((r) => r.wrong.length).map((r) => [r.name, r.wrong])), BAY_BEFORE, 'sounded off the water alone');
  assert.deepEqual(now.filter((r) => r.wrong.length).map((r) => [r.name, r.wrong]), [], 'every berth stands');
  assert.deepEqual(now.map((r) => [r.name, r.berths.length]), before.map((r) => [r.name, r.berths.length]), 'every port as many berths as it had');
  assert.ok(now.some((r) => r.keep) && now.some((r) => !r.keep), 'the walled cities keep their towns, the rest none');
});
