// FIELD BUGS 2026-10-12g SHOP-RATS - "Starter quests keep breaking": "Quests that spawn enemies inside of shops like the
// rat quests from the fighters guild keep spawning nothing. It seems like it works if it spawns them in a residence, but
// not in shops?" M0B00Y15 and M0C00Y14 (`Place _house_ local random` - any building, shops among them) `create foe` at
// the house: DFU's interior arm is PlaceFoeFreely alone, a bearing just outside the view with 5 m + 1.25 m clear, and a
// shop's counter and shelves leave it none - the wave waited forever. Over the real Collider in a shop-shaped room, the
// ring alone and the host's law (questFoeHost.js placeRoomQuestFoe). bible/01-Overview/bugs/Field-Bugs-2026-10-12g.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../../src/player/collider.js';
import { placeFoeFreely, PLACE_FOE_DEFAULTS } from '../../../src/systems/quest/sceneMount.js';
import { placeFoeEnv, entityOccupancy, placeRoomQuestFoe, roomMarkerSpot, ROOM_RING_MISSES, ROOM_NEAR_RING } from '../../../src/scenes/quest/questFoeHost.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function box(x0, y0, z0, x1, y1, z1) {
  const p = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const f = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [3, 2, 6], [3, 6, 7], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]];
  return { positions: p.flat(), indices: f.flat() };
}
function room(W, D, extra = [], H = 3.6) {
  const c = new Collider(() => -Infinity);
  let n = 0;
  for (const b of [[-0.2, -0.2, -0.2, W + 0.2, 0, D + 0.2], [-0.2, H, -0.2, W + 0.2, H + 0.2, D + 0.2], [-0.2, 0, -0.2, 0, H, D + 0.2],
    [W, 0, -0.2, W + 0.2, H, D + 0.2], [-0.2, 0, -0.2, W + 0.2, H, 0], [-0.2, 0, D, W + 0.2, H, D + 0.2], ...extra]) {
    const m = box(...b);
    c.addMesh(`m${n++}`, m.positions, m.indices, I);
  }
  return c;
}
// an 8 x 9 m shop: a counter across it, shelves down both side walls and the back
const SHOP = [[1.0, 0, 5.5, 7.0, 1.0, 6.2], [0, 0, 1.5, 0.5, 2.2, 9], [7.5, 0, 1.5, 8, 2.2, 9], [0, 0, 8.5, 8, 2.2, 9]];
const seeded = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const envAt = (c, feet, yaw, rolls, occupied = []) => placeFoeEnv({
  collider: c, playerFeet: [feet[0], feet[1] + 0.9, feet[2]], playerYawRad: yaw, fovDegrees: 65, rolls,
  isOccupied: entityOccupancy((f) => f.ai?.feet, () => occupied, feet),
});
const inRoom = (p, W, D) => p.x > 0 && p.x < W && p.z > 0 && p.z < D && Math.abs(p.y - PLACE_FOE_DEFAULTS.separationDistance) < 1e-6;

test('SHOP-RATS at a shop\'s counter, facing the keeper, DFU\'s ring never places a foe - the report; the host\'s law places one once the ring has missed ROOM_RING_MISSES times, never before (mutants: the misses never counted; the fallback at once; the near ring and the markers both gone)', () => {
  const c = room(8, 9, SHOP);
  const rolls = seeded(7);
  for (let i = 0; i < 400; i++) assert.equal(placeFoeFreely(envAt(c, [3 + (i % 9) * 0.25, 0, 4.6], 0, rolls)), null, 'the ring alone: nothing, ever');
  const handle = {};
  const markers = [[4, 0, 0.8], [6.8, 0, 2.5]];   // the room's enter marker by the door, a quest marker by the shelves
  let spot = null, calls = 0;
  while (!spot && calls < 200) { spot = placeRoomQuestFoe(envAt(c, [4, 0, 4.6], 0, rolls), handle, markers); calls++; }
  assert.equal(calls, ROOM_RING_MISSES, 'the ring tried as DFU tries it, every tick, until it has missed thirty times');
  assert.equal(handle.ringMisses, ROOM_RING_MISSES);
  assert.ok(spot && inRoom(spot, 8, 9), `a spot in the room, on its floor: ${JSON.stringify(spot)}`);
});

test('SHOP-RATS where DFU\'s ring places, it is DFU\'s ring: the same spot on the same tick, a miss counted only where the ring missed (mutants: the fallback first)', () => {
  const c = room(16, 14);
  const ring = seeded(3);
  let k = 0, want = null;
  for (; k < 20 && !want; k++) want = placeFoeFreely(envAt(c, [8, 0, 7], 0, ring));
  assert.ok(want, 'an open hall places');
  const law = seeded(3), handle = {};
  let got = null, n = 0;
  for (; n < 20 && !got; n++) got = placeRoomQuestFoe(envAt(c, [8, 0, 7], 0, law), handle, [[2, 0, 2]]);
  assert.equal(n, k, 'on the same tick');
  assert.deepEqual(got, want, 'the very spot the ring answered');
  assert.equal(handle.ringMisses ?? 0, k - 1, 'the ring\'s misses before it, and no more');
  assert.ok(Math.hypot(got.x - 8, got.z - 7) >= PLACE_FOE_DEFAULTS.minDistance, 'out at the ring\'s own distance');
});

test('SHOP-RATS the room\'s spots: the farthest within the ring\'s reach with a floor under it and clear - never one over nothing, one taken, or one past 20 m (mutants: the nearest first; the floor unchecked; the overlap unchecked; the reach unchecked)', () => {
  const c = room(30, 6);
  const env = envAt(c, [2, 0, 3], 0, seeded(1), [{ ai: { feet: [12, 0, 3] } }]);
  const spots = [
    [4, 0, 3],          // near
    [12, 0, 3],         // farther - but a foe stands there
    [9, 0, 3],          // the one
    [9, -6, 3.5],       // farther still in reach... no floor within 4 m under it (below the floor slab)
    [25, 0, 3],         // past the ring's 20 m
  ];
  const p = roomMarkerSpot(env, spots);
  assert.deepEqual([p.x, p.z], [9, 3], `the farthest clear spot with a floor, in reach: ${JSON.stringify(p)}`);
  assert.ok(Math.abs(p.y - PLACE_FOE_DEFAULTS.separationDistance) < 1e-6, 'its test point, the ring\'s own height over the floor');
  assert.equal(roomMarkerSpot(env, []), null);
  assert.deepEqual(ROOM_NEAR_RING, { minDistance: 2.5, lineOfSightCheck: false });
  assert.equal(ROOM_RING_MISSES, 30);
});

test('SHOP-RATS the interior host places a building\'s quest foe by the law, over the room\'s markers (mutants: the host back on the ring alone)', () => {
  const wm = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const body = wm.slice(wm.indexOf('  function tryPlaceInteriorQuestFoe(handle) {'), wm.indexOf('  /** ROAD-G G1: THE LOOSE-FOE STAND, INDOORS'));
  assert.match(body, /const spot = placeRoomQuestFoe\(env, handle, interiorCtx\.markers\?\.map\(\(m\) => \[m\.x, m\.y, m\.z\]\)\);/);
  assert.doesNotMatch(body, /placeFoeFreely\(env\)/);
});
