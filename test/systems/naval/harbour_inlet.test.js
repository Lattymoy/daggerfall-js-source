// SHIP AUDIT (2026-10-27, the owner: "a comprehensive audit across everything ... this needs to be perfect"; bible/01-Overview/
// audits/Audit-Ship-Ready.md) - A HARBOUR'S BERTHS ON A WAY OUT TO SEA. Lillandril on the freeware, once RELIEF-PEAKS moved
// it a pixel: the berths nearest the town lay in an inlet along its side with no way out, the open sea past its other side,
// and findHarbour (systems/naval/shipLife.js) answered no harbour at all - six ships missing from a port past the Bay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findHarbour } from '../../../src/systems/naval/shipLife.js';

/** A town (0..100 east, 0..300 north) between a closed inlet along its east side (100..200 east, 0..300 north - land
 *  round it every way) and the open sea west of a strip of shore (west of -60). */
const RECT = { minX: 0, maxX: 100, minZ: 0, maxZ: 300 };
const inlet = (x, z) => x > 100 && x < 200 && z > 0 && z < 300;
const sea = (x) => x < -60;
const water = (x, z) => sea(x) || inlet(x, z);

test('SHIP AUDIT: a town with a closed inlet nearer its middle than the sea - the berths on the sea, never none (mutants: the retry dropped; the inlet\'s shores kept)', () => {
  const h = findHarbour({ rect: RECT, isWater: water });
  assert.ok(h, 'a harbour - the sea is in reach');
  assert.ok(h.berths.length >= 2, `berths (${h.berths.length})`);
  assert.ok(h.berths.every((b) => b.pos[0] < -60 && b.normal[0] < 0), `every berth on the sea, facing it: ${JSON.stringify(h.berths.map((b) => b.pos.map(Math.round)))}`);
  assert.ok(h.mouth[0] < -60, 'its mouth on the open sea');
});

test('SHIP AUDIT: the inlet alone, no sea in reach - no harbour, as before', () => {
  assert.equal(findHarbour({ rect: RECT, isWater: inlet }), null);
});

test('SHIP AUDIT: the sea alone - the berths the search always took (the retry never asked)', () => {
  const plain = findHarbour({ rect: RECT, isWater: (x) => sea(x) });
  const both = findHarbour({ rect: RECT, isWater: water });
  assert.deepEqual(both.berths.map((b) => b.pos), plain.berths.map((b) => b.pos), 'the same berths as with no inlet');
});
