// FIELD BUGS 2026-10-09c - WALK-WHOLE, the Discord's "Card Table blocking": "This table is oddly placed, it's in 'The
// Gold Dungeon' in Menakat. I've seen this in other locations aswell. (same tavern layout)" - the screenshot a card
// table and its stools across the doorway between a tavern's two rooms.
//
// The walk (world/placedCardTable.js) stood the table at the cell NEAREST the entrance whose table and ring were clear
// floor - and past an entry room too small for the ring, the nearest such cell is the mouth of the doorway the walk
// left it by. A spot is passed over now when its table and ring, taken out of the walk, leave a walked cell unreachable
// from the entrance; a room with no other spot stands it where it stood (no tavern loses a table).
// `01-Overview/Field-Bugs-2026-10-09c.md`; `11-Multiplayer/Tavern-Cards.md` section 28.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placedTableSpot, PLACE_GRID_OFF, PLACE_CELL, PLACE_LANE_CELLS } from '../src/world/placedCardTable.js';
import { cardTablePropModel, CARD_TABLE_BOX } from '../src/world/cardTableProp.js';
import { trs, transformPoint } from '../src/world/mat4.js';
import { CAPSULE_RADIUS } from '../src/player/motor.js';

// taverntable.test.js's room: `floorAt(x, z)` its floor (null for none), `boxes` its solids
function room({ floorAt = () => 0, boxes = [] } = {}) {
  const near = (b, x, y, z) => Math.hypot(Math.max(b.min[0] - x, 0, x - b.max[0]), Math.max(b.min[1] - y, 0, y - b.max[1]), Math.max(b.min[2] - z, 0, z - b.max[2]));
  return {
    floor(x, y, z) {
      let best = floorAt(x, z);
      if (best != null && (best > y || best < y - 3)) best = null;
      for (const b of boxes) if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2] && b.max[1] <= y && (best == null || b.max[1] > best)) best = b.max[1];
      return best;
    },
    open(x, y, z, r) { return boxes.every((b) => near(b, x, y, z) >= r); },
  };
}
const wallX = (x, z0, z1) => ({ min: [x - 0.1, 0, z0], max: [x + 0.1, 3, z1] });
const wallZ = (z, x0, x1) => ({ min: [x0, 0, z - 0.1], max: [x1, 3, z + 0.1] });

// The report's shape: an entry room 4 m square, its door's marker by the west wall, a 1.2 m doorway east into a hall
// 10 m by 6 - the entry room too small for the table's ring 3 m in, so the walk goes on through the doorway.
const ENTRY_AND_HALL = [
  wallX(-2, -2.1, 2.1), wallZ(2, -2.1, 2.1), wallZ(-2, -2.1, 2.1),   // the entry room's west, north and south
  wallX(2, -3.1, -0.6), wallX(2, 0.6, 3.1),                            // the wall between, its doorway z -0.6..0.6
  wallZ(3, 2, 12.1), wallZ(-3, 2, 12.1), wallX(12, -3.1, 3.1),        // the hall
];
const START = [-1.5, 0, 0];

/** The whole prop's box (the table and its stools) where the spot stands it. */
function propBox(spot) {
  const m = trs(spot.x, spot.y, spot.z, 0, spot.yawDeg, 0);
  const p = cardTablePropModel().positions;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    const v = transformPoint(m, p[i], p[i + 1], p[i + 2]);
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], v[a]); max[a] = Math.max(max[a], v[a]); }
  }
  return { min, max };
}
/** Whether a body (the player's capsule) walks from `from` to `to` on a 10 cm grid, its knees clear. */
function bodyReaches(r, from, to) {
  const step = 0.1, key = (i, k) => `${i},${k}`;
  const seen = new Set([key(0, 0)]), q = [[0, 0]];
  const ti = Math.round((to[0] - from[0]) / step), tk = Math.round((to[2] - from[2]) / step);
  while (q.length) {
    const [i, k] = q.shift();
    if (i === ti && k === tk) return true;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nk = k + dk;
      if (seen.has(key(ni, nk)) || Math.abs(ni) > 200 || Math.abs(nk) > 200) continue;
      seen.add(key(ni, nk));
      if (r.open(from[0] + ni * step, 0.6, from[2] + nk * step, CAPSULE_RADIUS)) q.push([ni, nk]);
    }
  }
  return false;
}

test('WALK-WHOLE: past an entry room too small for it, the table stands in the hall beyond and the player still walks through the doorway and round it to the hall\'s far end (mutant: the walk\'s cut unasked)', () => {
  const spot = placedTableSpot(CARD_TABLE_BOX, START, room({ boxes: ENTRY_AND_HALL }));
  assert.ok(spot, 'a table stands');
  assert.ok(spot.cx - spot.hx > 2.1, 'in the hall, its ring past the wall between');
  assert.equal(PLACE_LANE_CELLS, 1);
  const prop = propBox(spot);
  assert.ok(prop.min[0] - 2.1 >= 2 * CAPSULE_RADIUS + PLACE_CELL, `a lane wider than a body by half a metre between the doorway and its nearest stool (${(prop.min[0] - 2.1).toFixed(2)} m)`);
  const furnished = room({ boxes: [...ENTRY_AND_HALL, prop] });
  assert.ok(bodyReaches(room({ boxes: ENTRY_AND_HALL }), START, [11, 0, 0]), 'the bare room walks (the probe is sound)');
  for (const to of [[11, 0, 0], [11, 0, 2.4], [11, 0, -2.4], [3, 0, 2.4], [3, 0, -2.4]]) {
    assert.ok(bodyReaches(furnished, START, to), `the player reaches (${to[0]}, ${to[2]}) with the table stood`);
  }
});

test('WALK-WHOLE: a room whose only floor for it closes the walk stands it there all the same - no tavern loses the table it had', () => {
  // a corridor east from the entrance into a room exactly the table's ring (seven cells by five), a corridor on east of
  // it to a dead end - every spot the ring fits cuts the far corridor off
  const [ox, oz] = PLACE_GRID_OFF;
  const floorAt = (x, z) => {
    const dx = x - ox, dz = z - oz;
    if (Math.abs(dz) <= 0.25 && dx >= -0.25 && dx <= 9.25) return 0;   // the corridors
    if (dx >= 2.9 && dx <= 6.1 && Math.abs(dz) <= 1.1) return 0;       // the room
    return null;
  };
  const spot = placedTableSpot(CARD_TABLE_BOX, [0, 0, 0], room({ floorAt }));
  assert.ok(spot, 'it stands');
  assert.deepEqual([Math.round((spot.cx - ox) * 100) / 100, Math.round((spot.cz - oz) * 100) / 100, spot.yawDeg], [4.5, 0, 0], 'the room\'s one spot');
});
