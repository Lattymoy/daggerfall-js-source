// HOME-LINE (FIELD BUGS 2026-10-11b, bible/01-Overview/bugs/Field-Bugs-2026-10-11b.md; the Discord's "Property Problem" -
// ShikiX3: "I can't place in front of my door but I can place in front of another's home"; afjiz: "my property line goes a
// little far into the property beside me"; Mac: "Split at the midline"). A home's lot is its footprint grown YARD_MARGIN
// (6 m), never shared, so two houses standing closer than 12 m overlapped and the owner could decorate the step before a
// neighbour's door (the half refused before the owner's own door was HOME-FOOT's, 2026-10-09). Now no part of a piece may
// stand nearer another building's ground than the house's own: the ground between two houses is split down its middle,
// a tie the house's. And a piece that MEETS another building's ground is refused as it was, wherever its points stand
// (the case the line alone cannot see: a neighbour's corner poking into a long piece's edge). Pure: no game data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yardLot, yardWhyNot, yardGapTo, YARD_MARGIN, YARD_ON_OTHER, YARD_IN_HOUSE, YARD_OFF_LOT } from '../../src/scenes/homeYards.js';

// the owner's house: its box [-4, -3] to [4, 3] round its own place, its door on the south wall (z -3)
const BOX = [-4, 0, -3, 4, 5, 3];
const lot = yardLot([0, 0, 0], BOX);
// the neighbour's house 4 m east of it, door south too: the midline between the two walls at x 6
const NEIGHBOUR = [[8, -3, 16, 3]];
const CHAIR = [[-0.25, -0.25], [0.25, -0.25], [0.25, 0.25], [-0.25, 0.25]];

test('HOME-LINE: the owner\'s door step is the yard\'s, the neighbour\'s - inside the owner\'s 6 m lot - is the neighbour\'s', () => {
  assert.equal(YARD_MARGIN, 6);
  assert.deepEqual(lot.lot, [-10, -9, 10, 9], 'the lot reaches past the neighbour\'s west wall');
  assert.equal(yardWhyNot([0, 0, -3.6], lot, NEIGHBOUR, CHAIR), null, 'before the owner\'s own door');
  assert.equal(yardWhyNot([9, 0, -3.6], lot, NEIGHBOUR, CHAIR), YARD_ON_OTHER, 'before the neighbour\'s door: theirs (the report)');
  assert.equal(yardWhyNot([9, 0, -3.6], lot, [], CHAIR), null, 'no building\'s ground of itself - the line is what refuses it');
  assert.equal(yardWhyNot([12, 0, -3.6], lot, NEIGHBOUR, CHAIR), YARD_OFF_LOT, 'and further along, off the lot as before');
  assert.equal(yardWhyNot([10, 0, 0], lot, NEIGHBOUR), YARD_ON_OTHER, 'on its walls, their ground as before');
  assert.equal(yardWhyNot([0, 0, 0], lot, NEIGHBOUR), YARD_IN_HOUSE, 'in the owner\'s, the house as before');
});

test('HOME-LINE: the ground between is split down its middle - every part of a piece on the owner\'s side, a tie the owner\'s', () => {
  assert.equal(yardWhyNot([5.9, 0, 0], lot, NEIGHBOUR), null, '1.9 m from the owner\'s wall, 2.1 from theirs');
  assert.equal(yardWhyNot([6.1, 0, 0], lot, NEIGHBOUR), YARD_ON_OTHER, 'past the middle');
  assert.equal(yardWhyNot([6, 0, 0], lot, NEIGHBOUR), null, 'on it, the house\'s');
  assert.equal(yardWhyNot([5.6, 0, 0], lot, NEIGHBOUR, CHAIR), null, 'a chair wholly on the owner\'s side');
  assert.equal(yardWhyNot([5.9, 0, 0], lot, NEIGHBOUR, CHAIR), YARD_ON_OTHER, 'its middle on the owner\'s side, its east edge past the line');
  // the far side of the owner's house is the owner's however near the lot's edge: no neighbour there
  assert.equal(yardWhyNot([-9, 0, 0], lot, NEIGHBOUR, CHAIR), null);
  assert.equal(yardGapTo(NEIGHBOUR, 9, -3.6).toFixed(3), '0.600');
  assert.equal(yardGapTo([], 0, 0), Infinity, 'no neighbours, nothing nearer');
});

test('HOME-LINE: a piece that meets another building\'s ground is refused whatever side of the line its points stand - a neighbour\'s corner poking into a long bench\'s edge', () => {
  const pillar = [[4.5, 0.7, 10, 0.8]];   // a neighbour's ground reaching to 0.5 m of the owner's east wall
  const bench = [[-0.3, -1.5], [0.3, -1.5], [0.3, 1.5], [-0.3, 1.5]];   // 0.6 by 3, along the wall
  const at = [4.35, 0, 0];
  const points = [[at[0], at[2]], ...bench.map(([dx, dz]) => [at[0] + dx, at[2] + dz])];
  assert.ok(points.every(([x, z]) => yardGapTo(pillar, x, z) > yardGapTo([lot.house], x, z)), 'every point of it nearer the owner\'s wall');
  assert.equal(yardWhyNot(at, lot, pillar, bench), YARD_ON_OTHER, 'and yet it lies across the neighbour\'s ground');
  assert.equal(yardWhyNot(at, lot, [], bench), null, 'which alone refuses it');
});
