// FIELD BUGS 2026-10-29f EAVE-FOOT (#feature-feedback, "Housing feedback & suggestions after 20 hours of decorating",
// item 13: "Fix the 'Inside the house' restriction in houses with extending rooftops - House hitboxes should only apply
// [to] the foundation"). FB1009 HOME-FOOT's eave law asked whether a roof's ground lies inside the walls by counting
// every upright face a ray from it crossed. A two-storey house's upper wall stands in its ground wall's plane as a face
// of its own, so one side was crossed twice: the eave read as the house, and many a house's own rooms as its yard. The
// walls that say it now are the ground floor's, and one plane is one crossing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as homeYards from '../../src/scenes/homeYards.js';
import { localAabb } from '../../src/render/frustum.js';
import { skipReal, game } from '../lwRealTown.mjs';

const { modelFootRects, yardLot, yardWhyNot, YARD_IN_HOUSE, YARD_MARGIN } = homeYards;

/** A model of upright quads `walls` ([x0, z0, x1, z1, y0, y1]) and flat quads `flats` ([x0, z0, x1, z1, y]). */
function model(walls, flats) {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (const [x0, z0, x1, z1, y0, y1] of walls) quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]);
  for (const [x0, z0, x1, z1, y] of flats) quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]);
  return { positions: new Float32Array(P), indices: new Uint32Array(I) };
}
/** A 10 m square's four sides between heights y0 and y1 - `split` the sides cut in two along their length. */
const sides = (y0, y1, split = [], [w, e] = [-5, 5]) => [
  ...(split.includes('w') ? [[w, -5, w, 0, y0, y1], [w, 0, w, 5, y0, y1]] : [[w, -5, w, 5, y0, y1]]),
  ...(split.includes('e') ? [[e, -5, e, 0, y0, y1], [e, 0, e, 5, y0, y1]] : [[e, -5, e, 5, y0, y1]]),
  [w, -5, e, -5, y0, y1], [w, 5, e, 5, y0, y1],
];
/** The westmost upright face standing on the ground floor - a real model's west wall. */
function groundWallWest({ positions: P, indices: I }) {
  let x = Infinity;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    if (Math.abs((P[b] - P[a]) * (P[c + 2] - P[a + 2]) - (P[c] - P[a]) * (P[b + 2] - P[a + 2])) >= 2e-3) continue;
    if (Math.min(P[a + 1], P[b + 1], P[c + 1]) < 2) x = Math.min(x, P[a], P[b], P[c]);
  }
  return x;
}
const covers = (m, x, z) => modelFootRects(m.positions, m.indices).some(([a, c, b, d]) => x >= a && x < b && z >= c && z < d);

test('EAVE-FOOT the eave of a two-storey house is the yard: its upper wall in the ground wall\'s plane is one crossing, not two (mutant: EAVEFOOT-crossings-counted)', () => {
  // the west side's ground wall laid in two faces, its upper wall in one; a roof hung 1.6 m past it
  const m = model([...sides(0, 3, ['w']), ...sides(3, 8)], [[-6.6, -5, 5, 5, 8]]);
  assert.equal(covers(m, -6, 0.5), false, 'under the eave');
  assert.equal(covers(m, 0, 0.5), true, 'under the roof, inside the walls');
  // and its rooms the house's, where the east side is the one laid in two
  const n = model([...sides(0, 3, ['e']), ...sides(3, 8)], [[-5, -5, 5, 5, 8]]);
  assert.equal(covers(n, 0, 0.5), true, 'its rooms');
  // a plinth along a wall stands in the wall's plane too
  const p = model([...sides(0, 3, ['e']), [5, -5, 5, 5, 0, 0.4]], [[-5, -5, 5, 5, 8]]);
  assert.equal(covers(p, 0, 0.5), true, 'its rooms, past the plinth');
});

test('EAVE-FOOT the foundation alone: an upper storey that stands out over open ground leaves that ground the yard - a wall whose foot is above the ground floor says nothing of what is under the roof (mutant: EAVEFOOT-every-wall)', () => {
  const m = model([...sides(0, 3), ...sides(3, 8, [], [-6.6, 6.6])], [[-6.6, -5, 6.6, 5, 8]]);
  assert.equal(covers(m, -6, 0.5), false, 'under the jetty, west');
  assert.equal(covers(m, 6, 0.5), false, 'and east');
  assert.equal(covers(m, 0, 0.5), true, 'the house on its foundation');
  const lid = model([], [[-1, -1, 1, 1, 3]]);
  assert.equal(covers(lid, 0, 0), true, 'a roof with no walls still covers its ground');
});

test('EAVE-FOOT the game\'s own houses (ARENA2): model 252 and its four kin (205-208, 90 of the Bay\'s houses) - the ground under their west eave the yard, their rooms the house; and model 340\'s rooms (68 houses), which read as its yard', { skip: skipReal }, () => {
  const { modelOf } = game();
  for (const id of [252, 205, 206, 207, 208]) {
    const m = modelOf(id);
    const box = localAabb(m.positions);
    const lot = yardLot([0, 0, 0], box, YARD_MARGIN, modelFootRects(m.positions, m.indices));
    const wall = groundWallWest(m);
    assert.ok(wall - box[0] >= 1.5, `${id}: its roof stands ${(wall - box[0]).toFixed(1)} m past its west wall`);
    assert.equal(yardWhyNot([(box[0] + wall) / 2, 0, 4], lot, []), null, `${id}: under the eave`);
    assert.equal(yardWhyNot([wall + 4, 0, 4], lot, []), YARD_IN_HOUSE, `${id}: inside`);
  }
  const m = modelOf(340);
  const lot = yardLot([0, 0, 0], localAabb(m.positions), YARD_MARGIN, modelFootRects(m.positions, m.indices));
  const box = localAabb(m.positions);
  assert.equal(yardWhyNot([(box[0] + box[3]) / 2, 0, (box[2] + box[5]) / 2], lot, []), YARD_IN_HOUSE, '340: its middle');
});

test('AUDIT FB1029f B7: two walls meeting at a V\'s point on a cell row are two crossings - one plane is one crossing, not one place (mutant: AUDITFB1029F-B7-crossing-by-place)', () => {
  // a north wall notched down to a point at (0, 4), on the row of cells whose middle is z 4
  const notch = [[-5, -5, 5, -5], [5, -5, 5, 5], [5, 5, 0, 4], [0, 4, -5, 5], [-5, 5, -5, -5]].map((w) => [...w, 0, 3]);
  const m = model(notch, [[-5, -5, 5, 5, 3]]);
  for (const x of [-4, -2, 2, 4]) assert.equal(covers(m, x, 4), true, `(${x}, 4) inside the walls`);
  assert.equal(covers(m, 0, 4.6), false, 'the notch itself the yard');
});
